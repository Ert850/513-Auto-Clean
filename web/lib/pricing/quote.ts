import { mileageFeeCents } from "./mileage.js";
import type { PricingRules } from "./rules.js";
import { applySurchargeCents, computeSurcharge, type SurchargeContext } from "./surcharge.js";
import { computeTax, SEED_TAX_TABLE, type TaxTable } from "./tax.js";

export type ServiceCategory = "interior" | "exterior" | "other";

export interface PackageRef {
  id: string;
  name: string;
  category: ServiceCategory;
  priceCents: number;
  durationMin: number;
}

/**
 * A chosen add-on tier. Flat priced: severity tiers replaced the old hourly
 * rate because "how many hours of pet hair is this?" is a question a customer
 * cannot answer honestly and Elijah can only judge on site.
 */
export interface AddonRef {
  id: string;
  name: string;
  tierId: string;
  tierLabel: string;
  priceCents: number;
  durationMin: number;
}

/** Paint correction plus its ceramic coating term. */
export interface CorrectionRef {
  tierId: string;
  tierLabel: string;
  priceCents: number;
  durationMin: number;
  coatingId: string;
  coatingLabel: string;
  coatingAddCents: number;
}

export interface CartVehicle {
  label: string;
  packages: PackageRef[];
  addons: AddonRef[];
  /** Set when Showroom Ready is chosen instead of a standard package. */
  showroomHours?: number;
  correction?: CorrectionRef;
}

export interface CartInput {
  vehicles: CartVehicle[];
  /**
   * Averaged one-way drive minutes. Null before a slot is chosen, in which
   * case travel reads as pending rather than as $0.
   */
  oneWayMinutes: number | null;
  /** Null before a slot is chosen: no start time means no time-of-day surcharge. */
  surchargeContext: SurchargeContext | null;
  /** Drives the county sales tax rate. Null until the address is entered. */
  zip: string | null;
}

export type LineKind =
  | "package"
  | "showroom"
  | "addon"
  | "correction"
  | "coating"
  | "combo_discount"
  | "additional_vehicle_discount"
  | "surcharge"
  | "travel"
  | "tax";

export interface QuoteLine {
  kind: LineKind;
  label: string;
  vehicleIndex: number | null;
  amountCents: number; // negative for discounts
  durationMin: number;
}

export interface Quote {
  lines: QuoteLine[];
  serviceSubtotalCents: number;
  surchargeCents: number;
  surchargeBp: number;
  surchargeCapped: boolean;
  travelCents: number;
  travelIsEstimate: boolean;
  taxCents: number;
  taxRateBp: number;
  taxIsEstimate: boolean;
  taxCounty: string | null;
  totalCents: number;
  depositCents: number;
  balanceCents: number;
  payAfterEligible: boolean;
  serviceDurationMin: number;
  hasShowroom: boolean;
}

/**
 * The quote engine. Pure: no clock, no network, no database.
 *
 * ORDER OF OPERATIONS IS LOAD-BEARING:
 *
 *   1. package prices (or Showroom Ready hours), per vehicle
 *   2. add-ons, flat priced by severity tier, per vehicle
 *   3. paint correction plus any ceramic upgrade, per vehicle
 *   4. combo discount -$15 when ONE VEHICLE gets both interior and exterior
 *   5. -10% off each vehicle after the first, on that vehicle's own subtotal
 *   6. => serviceSubtotal
 *   7. premium surcharge, on serviceSubtotal ONLY, never on travel
 *   8. travel, once per appointment regardless of vehicle count
 *   9. sales tax on (service + surcharge + travel)
 *  10. => total, then deposit
 *
 * Ohio taxes vehicle washing and waxing as a service, and charges forming part
 * of the price of a taxable service are generally taxable too, so travel sits
 * inside the tax base rather than outside it.
 */
export function quote(
  cart: CartInput,
  r: PricingRules,
  taxTable: TaxTable = SEED_TAX_TABLE,
  year: number = new Date().getFullYear(),
): Quote {
  const lines: QuoteLine[] = [];
  let showroomDeposit = 0;
  let hasShowroom = false;

  cart.vehicles.forEach((vehicle, vi) => {
    const vLines: QuoteLine[] = [];

    if (vehicle.showroomHours && vehicle.showroomHours > 0) {
      hasShowroom = true;
      const hrs = Math.max(vehicle.showroomHours, r.showroom.minimumHours);
      vLines.push({
        kind: "showroom",
        label: "Showroom Ready (" + hrs + " hrs at $" + r.showroom.hourlyCents / 100 + "/hr)",
        vehicleIndex: vi,
        amountCents: hrs * r.showroom.hourlyCents,
        durationMin: hrs * 60,
      });
      showroomDeposit += r.showroom.depositCents;
    }

    for (const pkg of vehicle.packages) {
      vLines.push({
        kind: "package", label: pkg.name, vehicleIndex: vi,
        amountCents: pkg.priceCents, durationMin: pkg.durationMin,
      });
    }

    for (const a of vehicle.addons) {
      vLines.push({
        kind: "addon",
        label: a.tierLabel && a.tierLabel !== a.name ? a.name + ": " + a.tierLabel : a.name,
        vehicleIndex: vi, amountCents: a.priceCents, durationMin: a.durationMin,
      });
    }

    if (vehicle.correction) {
      const c = vehicle.correction;
      vLines.push({
        kind: "correction", label: c.tierLabel, vehicleIndex: vi,
        amountCents: c.priceCents, durationMin: c.durationMin,
      });
      if (c.coatingAddCents > 0) {
        vLines.push({
          kind: "coating", label: "Ceramic coating, " + c.coatingLabel,
          vehicleIndex: vi, amountCents: c.coatingAddCents, durationMin: 0,
        });
      }
    }

    // Combo applies per vehicle: one car getting both interior and exterior.
    const hasInt = vehicle.packages.some((p) => p.category === "interior");
    const hasExt = vehicle.packages.some((p) => p.category === "exterior");
    if (hasInt && hasExt) {
      vLines.push({
        kind: "combo_discount", label: "Interior + exterior discount",
        vehicleIndex: vi, amountCents: -r.comboDiscountCents, durationMin: 0,
      });
    }

    lines.push(...vLines);

    // Every vehicle after the first takes 10% off ITS OWN subtotal.
    if (vi > 0 && r.additionalVehicleDiscountBp > 0) {
      const sub = vLines.reduce((s, l) => s + l.amountCents, 0);
      const d = Math.round((sub * r.additionalVehicleDiscountBp) / 10_000);
      if (d > 0) {
        lines.push({
          kind: "additional_vehicle_discount",
          label: "Bulk discount, " + r.additionalVehicleDiscountBp / 100 + "% off vehicle " + (vi + 1),
          vehicleIndex: vi, amountCents: -d, durationMin: 0,
        });
      }
    }
  });

  const serviceSubtotalCents = lines.reduce((s, l) => s + l.amountCents, 0);
  const serviceDurationMin = lines.reduce((s, l) => s + l.durationMin, 0);

  const bd = cart.surchargeContext
    ? computeSurcharge(cart.surchargeContext, r.surcharge)
    : { timeOfDayBp: 0, priorityBp: 0, appliedBp: 0, capped: false };

  const surchargeCents = applySurchargeCents(serviceSubtotalCents, bd.appliedBp);
  if (surchargeCents > 0) {
    lines.push({
      kind: "surcharge", label: "Premium time, +" + bd.appliedBp / 100 + "%",
      vehicleIndex: null, amountCents: surchargeCents, durationMin: 0,
    });
  }

  const travelIsEstimate = cart.oneWayMinutes === null;
  const travelCents = travelIsEstimate ? 0 : mileageFeeCents(cart.oneWayMinutes as number, r.mileage);
  if (travelCents > 0) {
    lines.push({ kind: "travel", label: "Travel", vehicleIndex: null, amountCents: travelCents, durationMin: 0 });
  }

  const taxableBase = serviceSubtotalCents + surchargeCents + travelCents;
  const taxIsEstimate = !cart.zip;
  const t = taxIsEstimate
    ? { taxCents: 0, rateBp: 0, county: null as string | null }
    : computeTax(taxableBase, cart.zip as string, taxTable, year);
  if (t.taxCents > 0) {
    lines.push({
      kind: "tax", label: "Sales tax, " + (t.rateBp / 100).toFixed(2) + "%",
      vehicleIndex: null, amountCents: t.taxCents, durationMin: 0,
    });
  }

  const totalCents = taxableBase + t.taxCents;

  // Showroom carries a flat deposit because its total is open ended; take
  // whichever is larger so a big mixed booking is never under-secured.
  const pctDeposit = Math.round((totalCents * r.depositBp) / 10_000);
  const depositCents = Math.max(pctDeposit, showroomDeposit);

  return {
    lines, serviceSubtotalCents, surchargeCents,
    surchargeBp: bd.appliedBp, surchargeCapped: bd.capped,
    travelCents, travelIsEstimate,
    taxCents: t.taxCents, taxRateBp: t.rateBp, taxIsEstimate, taxCounty: t.county,
    totalCents, depositCents, balanceCents: totalCents - depositCents,
    payAfterEligible: totalCents <= r.payAfterMaxCents,
    serviceDurationMin, hasShowroom,
  };
}

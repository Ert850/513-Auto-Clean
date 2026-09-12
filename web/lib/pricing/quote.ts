import {
  findPromo,
  promoDiscountCents as promoValueCents,
  type PromoRejection,
  type PromoResult,
} from "./promos.js";
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

/** The correction or coating tier chosen on top of Showroom Ready Exterior. */
export interface CorrectionRef {
  tierId: string;
  tierLabel: string;
  /** Added on top of the package base, not the whole price. */
  addCents: number;
  addMin: number;
  coatingId: string;
  coatingLabel: string;
  coatingAddCents: number;
  /** Canopy when the customer has no garage. */
  canopyCents?: number;
}

export interface CartVehicle {
  label: string;
  /** Flat upcharge for this vehicle's size, applied ONCE, not per package. */
  sizeUpchargeCents?: number;
  sizeLabel?: string;
  packages: PackageRef[];
  addons: AddonRef[];
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
  /** Customer chose to settle the whole thing now, which earns a discount. */
  payInFull?: boolean;
  /**
   * Promo code as typed. Looked up here, never trusted as an amount: the
   * browser sends letters and the engine decides what they are worth.
   */
  promoCode?: string | null;
  /**
   * Separate trips. Normally 1, because every vehicle is done in one visit.
   * Two vehicles booked at different times means driving out twice, so travel
   * is charged twice.
   */
  visits?: number;
}

export type LineKind =
  | "package"
  | "addon"
  | "correction"
  | "coating"
  | "canopy"
  | "size_upcharge"
  | "combo_discount"
  | "promo_discount"
  | "pay_in_full_discount"
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
  /** The code that actually applied, normalised. Null when none did. */
  promoCode: string | null;
  promoDiscountCents: number;
  /** Why a supplied code did not apply, for the message shown to the customer. */
  promoRejected: PromoRejection | null;
  surchargeBp: number;
  surchargeCapped: boolean;
  travelCents: number;
  travelIsEstimate: boolean;
  taxCents: number;
  taxRateBp: number;
  taxIsEstimate: boolean;
  taxCounty: string | null;
  totalCents: number;
  /** Zero unless deposits are reintroduced via pricingRules. */
  depositCents: number;
  balanceCents: number;
  payInFullDiscountCents: number;
  /** What they would save by paying now, for the "or save 5%" prompt. */
  payInFullSavingsCents: number;
  payAfterEligible: boolean;
  serviceDurationMin: number;
  /**
   * The COMPARABLE total without the multi-vehicle discount: same travel,
   * same tax, discount removed. Anything less than a like-for-like figure
   * makes the struck-through price look wrong next to the real one.
   */
  grossBeforeMultiCents: number;
  multiVehicleDiscountCents: number;
}

/**
 * The quote engine. Pure: no clock, no network, no database.
 *
 * ORDER OF OPERATIONS IS LOAD-BEARING:
 *
 *   1. package prices, per vehicle
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
/**
 * What the surcharge line is actually for.
 *
 * Two different things can raise it and they are not the same thing to the
 * person reading the line. Booking at 7am is premium time. Booking for
 * tomorrow at 10am is a rush, and 10am is explicitly a standard hour: a line
 * reading "Premium time" against a mid-morning slot is a line that invites
 * an argument, and deserves one.
 */
export function surchargeLabel(bd: { timeOfDayBp: number; priorityBp: number; appliedBp: number }): string {
  const pct = "+" + bd.appliedBp / 100 + "%";
  if (bd.priorityBp > 0 && bd.timeOfDayBp > 0) return "Rush booking and premium time, " + pct;
  if (bd.priorityBp > 0) return "Rush booking, " + pct;
  return "Premium time, " + pct;
}

export function quote(
  cart: CartInput,
  r: PricingRules,
  taxTable: TaxTable = SEED_TAX_TABLE,
  year: number = new Date().getFullYear(),
): Quote {
  const lines: QuoteLine[] = [];

  cart.vehicles.forEach((vehicle, vi) => {
    const vLines: QuoteLine[] = [];

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
        amountCents: c.addCents, durationMin: c.addMin,
      });
      if (c.coatingAddCents > 0) {
        vLines.push({
          kind: "coating", label: c.coatingLabel + " coating",
          vehicleIndex: vi, amountCents: c.coatingAddCents, durationMin: 0,
        });
      }
      if (c.canopyCents && c.canopyCents > 0) {
        vLines.push({
          kind: "canopy", label: "Canopy setup, no garage",
          vehicleIndex: vi, amountCents: c.canopyCents, durationMin: 30,
        });
      }
    }

    // Size upcharge is per VEHICLE, not per package: a large SUV booked for
    // interior and exterior pays the $25 once.
    const anyWork = vLines.length > 0;
    if (anyWork && vehicle.sizeUpchargeCents && vehicle.sizeUpchargeCents > 0) {
      // Reads as an adjustment to what was booked, not as a fourth thing
      // somebody ordered. "Medium vehicle $10" sitting under two packages
      // looks like a third package; "Size, medium vehicle" does not.
      vLines.push({
        kind: "size_upcharge",
        label: "Size, " + (vehicle.sizeLabel ?? "vehicle").toLowerCase() + " vehicle",
        vehicleIndex: vi,
        amountCents: vehicle.sizeUpchargeCents,
        durationMin: 0,
      });
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
  });

  // Two or more vehicles takes the discount off EVERYTHING, first one
  // included, so adding a car visibly lowers a price already accepted.
  if (cart.vehicles.length > 1 && r.additionalVehicleDiscountBp > 0) {
    const gross = lines.reduce((s, l) => s + l.amountCents, 0);
    const d = Math.round((gross * r.additionalVehicleDiscountBp) / 10_000);
    if (d > 0) {
      lines.push({
        kind: "additional_vehicle_discount",
        label:
          r.additionalVehicleDiscountBp / 100 + "% off, " + cart.vehicles.length + " vehicles",
        vehicleIndex: null,
        amountCents: -d,
        durationMin: 0,
      });
    }
  }

  // The promo comes off the SERVICE, after every other discount and before
  // travel and tax. Travel is a pass-through cost rather than margin, so
  // discounting it would mean paying for the privilege of driving.
  const beforePromoCents = lines.reduce((s, l) => s + l.amountCents, 0);
  const promoLookup: PromoResult = cart.promoCode
    ? findPromo(cart.promoCode, { serviceCents: beforePromoCents })
    : { promo: null, rejected: null };

  const promoDiscountCents = promoValueCents(promoLookup.promo, beforePromoCents);

  if (promoDiscountCents > 0 && promoLookup.promo) {
    lines.push({
      kind: "promo_discount",
      label: promoLookup.promo.label,
      vehicleIndex: null,
      amountCents: -promoDiscountCents,
      durationMin: 0,
    });
  }

  const serviceSubtotalCents = lines.reduce((s, l) => s + l.amountCents, 0);
  const serviceDurationMin = lines.reduce((s, l) => s + l.durationMin, 0);
  const multiVehicleDiscountCents = -lines
    .filter((l) => l.kind === "additional_vehicle_discount")
    .reduce((s, l) => s + l.amountCents, 0);

  const bd = cart.surchargeContext
    ? computeSurcharge(cart.surchargeContext, r.surcharge)
    : { timeOfDayBp: 0, priorityBp: 0, appliedBp: 0, capped: false };

  const surchargeCents = applySurchargeCents(serviceSubtotalCents, bd.appliedBp);
  if (surchargeCents > 0) {
    lines.push({
      kind: "surcharge", label: surchargeLabel(bd),
      vehicleIndex: null, amountCents: surchargeCents, durationMin: 0,
    });
  }

  const travelIsEstimate = cart.oneWayMinutes === null;
  const visits = Math.max(1, cart.visits ?? 1);
  const perVisit = travelIsEstimate ? 0 : mileageFeeCents(cart.oneWayMinutes as number, r.mileage);
  const travelCents = perVisit * visits;
  if (travelCents > 0) {
    lines.push({
      kind: "travel",
      label: visits > 1 ? "Travel, " + visits + " separate visits" : "Travel",
      vehicleIndex: null,
      amountCents: travelCents,
      durationMin: 0,
    });
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

  const grossTotalCents = taxableBase + t.taxCents;

  // Paying in full at booking earns a discount off the whole total. Computed
  // on the gross so the saving matches the headline percentage the customer
  // was shown, rather than a smaller number they have to reconcile.
  const payInFullSavingsCents = Math.round((grossTotalCents * r.payInFullDiscountBp) / 10_000);
  const payInFullDiscountCents = cart.payInFull ? payInFullSavingsCents : 0;
  if (payInFullDiscountCents > 0) {
    lines.push({
      kind: "pay_in_full_discount",
      label: "Paid in full, " + r.payInFullDiscountBp / 100 + "% off",
      vehicleIndex: null,
      amountCents: -payInFullDiscountCents,
      durationMin: 0,
    });
  }

  const totalCents = grossTotalCents - payInFullDiscountCents;

  // Price the same booking again with the discount switched off, so the
  // struck-through figure is a true like-for-like comparison rather than a
  // service subtotal sitting next to a total that includes travel and tax.
  const grossBeforeMultiCents =
    multiVehicleDiscountCents > 0
      ? quote(cart, { ...r, additionalVehicleDiscountBp: 0 }, taxTable, year).totalCents
      : totalCents;

  // Normally zero: deposits were removed to cut booking friction, and a card
  // on file is what confirms the slot. Kept as a rule so reintroducing them
  // stays a config change rather than a rewrite.
  const depositCents = Math.round((totalCents * r.depositBp) / 10_000);

  return {
    promoCode: promoLookup.promo ? promoLookup.promo.code : null,
    promoDiscountCents,
    promoRejected: promoLookup.rejected,
    lines, serviceSubtotalCents, surchargeCents,
    surchargeBp: bd.appliedBp, surchargeCapped: bd.capped,
    travelCents, travelIsEstimate,
    taxCents: t.taxCents, taxRateBp: t.rateBp, taxIsEstimate, taxCounty: t.county,
    totalCents, depositCents, balanceCents: totalCents - depositCents,
    payInFullDiscountCents, payInFullSavingsCents,
    payAfterEligible: totalCents <= r.payAfterMaxCents,
    serviceDurationMin,
    grossBeforeMultiCents,
    multiVehicleDiscountCents,
  };
}

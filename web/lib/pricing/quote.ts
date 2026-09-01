import { mileageFeeCents } from "./mileage.js";
import type { PricingRules } from "./rules.js";
import { applySurchargeCents, computeSurcharge, type SurchargeContext } from "./surcharge.js";

export type ServiceCategory = "interior" | "exterior" | "other";

export interface PackageRef {
  id: string;
  name: string;
  category: ServiceCategory;
  priceCents: number;
  durationMin: number;
}

export interface AddonRef {
  id: string;
  name: string;
  /** Hours requested. Floored to rules.addonMinHours — most add-ons are quoted at 1hr. */
  hours: number;
}

export interface CartVehicle {
  /** "2018 Honda CR-V" — display only, does not affect price. */
  label: string;
  packages: PackageRef[];
  addons: AddonRef[];
}

export interface CartInput {
  vehicles: CartVehicle[];
  /**
   * Averaged one-way drive minutes. Null before a slot is chosen, in which case
   * the quote returns travelCents 0 and `travelIsEstimate: true` so the UI can
   * label it honestly rather than implying a final number.
   */
  oneWayMinutes: number | null;
  /** Null before a slot is chosen — no start time means no time-of-day surcharge. */
  surchargeContext: SurchargeContext | null;
}

export type LineKind =
  | "package"
  | "addon"
  | "combo_discount"
  | "surcharge"
  | "travel";

export interface QuoteLine {
  kind: LineKind;
  label: string;
  /** Which vehicle this belongs to, or null for booking-level lines. */
  vehicleIndex: number | null;
  amountCents: number; // negative for discounts
  durationMin: number;
}

export interface Quote {
  lines: QuoteLine[];
  /** Packages + add-ons - combo discounts. The base the surcharge applies to. */
  serviceSubtotalCents: number;
  surchargeCents: number;
  surchargeBp: number;
  surchargeCapped: boolean;
  travelCents: number;
  travelIsEstimate: boolean;
  totalCents: number;
  depositCents: number;
  /** Balance collected after the job when paying by deposit. */
  balanceCents: number;
  payAfterEligible: boolean;
  /** Hands-on work only. Travel is tracked separately — see travelCommitmentMinutes. */
  serviceDurationMin: number;
}

/**
 * The quote engine. Pure: no clock, no network, no database.
 *
 * ORDER OF OPERATIONS IS LOAD-BEARING and was settled explicitly:
 *
 *   1. package prices, per vehicle
 *   2. add-ons at $50/hr with a 1-hour minimum, per vehicle
 *   3. combo discount -$15 when ONE VEHICLE gets both interior and exterior
 *   4. => serviceSubtotal
 *   5. premium surcharge, applied to serviceSubtotal ONLY (never to travel)
 *   6. travel fee, added once per appointment regardless of vehicle count
 *   7. => total, then deposit = 50% of total
 *
 * Travel sits after the surcharge and is never discounted or marked up.
 */
export function quote(cart: CartInput, r: PricingRules): Quote {
  const lines: QuoteLine[] = [];

  cart.vehicles.forEach((vehicle, vi) => {
    for (const pkg of vehicle.packages) {
      lines.push({
        kind: "package",
        label: pkg.name,
        vehicleIndex: vi,
        amountCents: pkg.priceCents,
        durationMin: pkg.durationMin,
      });
    }

    for (const addon of vehicle.addons) {
      const hours = Math.max(addon.hours, r.addonMinHours);
      lines.push({
        kind: "addon",
        label: hours === 1 ? addon.name : `${addon.name} (${hours} hrs)`,
        vehicleIndex: vi,
        amountCents: Math.round(hours * r.addonRateCents),
        durationMin: Math.round(hours * 60),
      });
    }

    // Combo applies per vehicle: one car getting both interior and exterior.
    // Two cars each getting both therefore earn it twice, which is the natural
    // reading of "book interior and exterior together and save $15".
    const hasInterior = vehicle.packages.some((p) => p.category === "interior");
    const hasExterior = vehicle.packages.some((p) => p.category === "exterior");
    if (hasInterior && hasExterior) {
      lines.push({
        kind: "combo_discount",
        label: "Interior + exterior discount",
        vehicleIndex: vi,
        amountCents: -r.comboDiscountCents,
        durationMin: 0,
      });
    }
  });

  const serviceSubtotalCents = lines.reduce((sum, l) => sum + l.amountCents, 0);
  const serviceDurationMin = lines.reduce((sum, l) => sum + l.durationMin, 0);

  const breakdown = cart.surchargeContext
    ? computeSurcharge(cart.surchargeContext, r.surcharge)
    : { timeOfDayBp: 0, priorityBp: 0, appliedBp: 0, capped: false };

  const surchargeCents = applySurchargeCents(serviceSubtotalCents, breakdown.appliedBp);
  if (surchargeCents > 0) {
    lines.push({
      kind: "surcharge",
      label: `Premium time (+${breakdown.appliedBp / 100}%)`,
      vehicleIndex: null,
      amountCents: surchargeCents,
      durationMin: 0,
    });
  }

  const travelIsEstimate = cart.oneWayMinutes === null;
  const travelCents = travelIsEstimate ? 0 : mileageFeeCents(cart.oneWayMinutes!, r.mileage);
  if (travelCents > 0) {
    lines.push({
      kind: "travel",
      label: "Travel",
      vehicleIndex: null,
      amountCents: travelCents,
      durationMin: 0,
    });
  }

  const totalCents = serviceSubtotalCents + surchargeCents + travelCents;
  const depositCents = Math.round((totalCents * r.depositBp) / 10_000);

  return {
    lines,
    serviceSubtotalCents,
    surchargeCents,
    surchargeBp: breakdown.appliedBp,
    surchargeCapped: breakdown.capped,
    travelCents,
    travelIsEstimate,
    totalCents,
    depositCents,
    balanceCents: totalCents - depositCents,
    payAfterEligible: totalCents <= r.payAfterMaxCents,
    serviceDurationMin,
  };
}

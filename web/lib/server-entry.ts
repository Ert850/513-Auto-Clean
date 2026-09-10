/**
 * Server entry point.
 *
 * Bundled to netlify/functions/_pricing.mjs so the payment functions can
 * RECOMPUTE a total from ids rather than trusting whatever amount the browser
 * sends. Without this, anyone could pay $1 for a $400 detail by editing one
 * number in the request, and the funnel would look perfectly normal doing it.
 *
 * Same code the unit tests cover, same code the browser bundle uses.
 */
import {
  ADDONS,
  COATING_COVERAGE,
  COATING_EXPLAINER,
  COATING_TERMS,
  CORRECTION_RULES,
  CORRECTION_TIERS,
  MAINTENANCE_PLAN,
  addonsFor,
  findAddon,
  findCoatingTerm,
  findCorrectionTier,
  isSelectable,
  isUnpriced,
  unavailableReason,
} from "./catalog/addons.js";
import {
  SEED_CATALOG,
  VEHICLE_SIZES,
  findPackage,
  packagesFor,
  vehicleSize,
} from "./catalog/seed.js";
import { componentsOf } from "./catalog/types.js";
import { DEFAULT_RULES } from "./pricing/rules.js";
import { SEED_TAX_TABLE } from "./pricing/tax.js";
import { minutesOfDay } from "./pricing/surcharge.js";
import { localMinutesOfDay } from "./availability/slots.js";
import { estimateOneWayMinutes } from "./travel/zipRanges.js";
import { quote, type AddonRef, type CartInput, type PackageRef } from "./pricing/quote.js";

/** What the browser is allowed to send: ids and quantities, never money. */
export interface WireVehicle {
  label?: string;
  sizeId?: string;
  packageIds?: string[];
  addons?: { addonId: string; tierId: string }[];
  correction?: { tierId: string; coatingId: string; noGarage?: boolean };
}

export interface WireCart {
  vehicles: WireVehicle[];
  zip?: string | null;
  /** Epoch ms of the chosen slot, or null. */
  slot?: number | null;
  priority?: boolean;
  /** Separate trips, when two vehicles could not share a slot. */
  visits?: number;
  payInFull?: boolean;
  /**
   * The code as the customer typed it. NOT an amount. The engine looks it
   * up in the same table the funnel used and decides what it is worth, so
   * a request claiming a 90% discount gets repriced at whatever the table
   * actually says, or at nothing.
   */
  promoCode?: string | null;
}

export interface PricedCart {
  totalCents: number;
  serviceSubtotalCents: number;
  surchargeBp: number;
  serviceDurationMin: number;
  /** The code that survived server side lookup. Null when none did. */
  promoCode: string | null;
  promoDiscountCents: number;
  lines: { label: string; amountCents: number }[];
  /** Anything the browser asked for that we refused to price. */
  rejected: string[];
}

/**
 * Rebuild a cart from ids and price it. Every number comes from the catalog,
 * so a tampered request cannot change what is charged: at worst it names a
 * package that does not exist, which lands in `rejected`.
 */
export function priceFromWire(wire: WireCart): PricedCart {
  const rejected: string[] = [];

  const vehicles = (wire.vehicles ?? []).map((wv) => {
    const size = wv.sizeId ? vehicleSize(wv.sizeId) : undefined;
    if (wv.sizeId && !size) rejected.push(`unknown size ${wv.sizeId}`);

    const packages: PackageRef[] = [];
    for (const id of wv.packageIds ?? []) {
      const p = findPackage(id);
      if (!p) { rejected.push(`unknown package ${id}`); continue; }
      packages.push({
        id: p.id, name: p.name, category: p.category,
        priceCents: p.priceCents, durationMin: p.durationMin,
      });
    }

    const addons: AddonRef[] = [];
    for (const a of wv.addons ?? []) {
      const def = findAddon(a.addonId);
      const tier = def?.tiers.find((t) => t.id === a.tierId);
      if (!def || !tier || tier.priceCents === null) {
        rejected.push(`unknown or unpriced add-on ${a.addonId}/${a.tierId}`);
        continue;
      }
      addons.push({
        id: def.id, name: def.name, tierId: tier.id, tierLabel: tier.label,
        priceCents: tier.priceCents, durationMin: tier.durationMin,
      });
    }

    let correction;
    if (wv.correction) {
      const tier = findCorrectionTier(wv.correction.tierId);
      const term = findCoatingTerm(wv.correction.coatingId);
      if (!tier || !term) {
        rejected.push(`unknown correction ${wv.correction.tierId}/${wv.correction.coatingId}`);
      } else {
        correction = {
          tierId: tier.id,
          tierLabel: tier.label,
          addCents: tier.addCents,
          addMin: tier.addMin,
          coatingId: term.id,
          coatingLabel: term.label,
          coatingAddCents: term.addCents,
          ...(wv.correction.noGarage ? { canopyCents: CORRECTION_RULES.canopyCents } : {}),
        };
      }
    }

    return {
      label: wv.label ?? "Vehicle",
      sizeUpchargeCents: size?.upchargeCents ?? 0,
      sizeLabel: size?.label ?? "",
      packages,
      addons,
      ...(correction ? { correction } : {}),
    };
  });

  const cart: CartInput = {
    vehicles,
    // Same estimator the funnel used, so the amount charged matches the
    // amount shown. A ZIP we do not cover prices as no travel rather than
    // guessing, and gets picked up at confirmation.
    oneWayMinutes: wire.zip ? estimateOneWayMinutes(wire.zip) : null,
    surchargeContext: wire.slot
      ? { startMinutesLocal: localMinutesOfDay(wire.slot), priorityBooking: Boolean(wire.priority) }
      : wire.priority
        ? { startMinutesLocal: minutesOfDay(12), priorityBooking: true }
        : null,
    zip: wire.zip ?? null,
    ...(wire.payInFull ? { payInFull: true } : {}),
    ...(wire.promoCode ? { promoCode: wire.promoCode } : {}),
    ...(wire.visits ? { visits: Math.max(1, Math.min(wire.visits, wire.vehicles.length || 1)) } : {}),
  };

  const q = quote(cart, DEFAULT_RULES, SEED_TAX_TABLE);

  return {
    totalCents: q.totalCents,
    serviceSubtotalCents: q.serviceSubtotalCents,
    surchargeBp: q.surchargeBp,
    serviceDurationMin: q.serviceDurationMin,
    promoCode: q.promoCode,
    promoDiscountCents: q.promoDiscountCents,
    lines: q.lines.map((l) => ({ label: l.label, amountCents: l.amountCents })),
    rejected,
  };
}

import { addonIcon } from "./catalog/icons.js";

export { MAX_ONE_WAY_MINUTES } from "./travel/zipRanges.js";
export { PROMOS, findPromo, normalisePromo, promoDiscountCents, promoMessage } from "./pricing/promos.js";
export { parseIcsBusy, mergeBusy } from "./booking/ics.js";
export { mileageFeeCents } from "./pricing/mileage.js";

export {
  ADDONS,
  addonIcon,
  COATING_COVERAGE,
  COATING_EXPLAINER,
  COATING_TERMS,
  CORRECTION_RULES,
  CORRECTION_TIERS,
  DEFAULT_RULES,
  MAINTENANCE_PLAN,
  SEED_CATALOG,
  VEHICLE_SIZES,
  addonsFor,
  componentsOf,
  findAddon,
  findPackage,
  isSelectable,
  isUnpriced,
  packagesFor,
  quote,
  unavailableReason,
  vehicleSize,
};

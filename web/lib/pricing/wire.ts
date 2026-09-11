/**
 * The wire cart: what the browser is allowed to send, and the gate that
 * checks it before a single number is computed.
 *
 * Three rules, learned the expensive way in the September 2026 stress test:
 *
 *   1. The browser sends IDS, never money and never a verdict. It does not
 *      get to say "this is not a priority booking" or "I am paying in full".
 *      Those are DERIVED here from the slot and from the payment mode.
 *   2. Anything the catalog marks as coming soon, unavailable or unpriced is
 *      rejected here, whatever the funnel showed. The funnel and this file
 *      read the same flags, so they agree, but only this file is trusted.
 *   3. Garbage is refused, not tolerated. A slot of 1e20 used to crash the
 *      payment function; an empty ZIP used to skip sales tax. Every field
 *      has a shape and a range and fails closed.
 *
 * Pure: no I/O, no clock. The caller passes `nowMs`.
 */
import { findAddon, findCoatingTerm, findCorrectionTier, isSelectable } from "../catalog/addons.js";
import { findPackage, vehicleSize } from "../catalog/seed.js";
import { MAX_ONE_WAY_MINUTES } from "../travel/zipRanges.js";

/* ---------------- shapes ---------------- */

export interface WireVehicle {
  label?: string;
  sizeId?: string;
  packageIds?: string[];
  addons?: { addonId: string; tierId: string }[];
  correction?: { tierId: string; coatingId: string; noGarage?: boolean };
}

export interface WireAddress {
  line1?: string;
  city?: string;
  region?: string;
  zip?: string;
}

export interface WireCart {
  vehicles: WireVehicle[];
  zip?: string | null;
  /** Epoch ms of the chosen slot, or null for a request without a time. */
  slot?: number | null;
  /**
   * IGNORED on the server. Priority is derived from the slot. Kept on the
   * type so an old browser sending it is not a validation failure.
   */
  priority?: boolean;
  /** Separate trips, when two vehicles could not share a slot. */
  visits?: number;
  /** IGNORED on the server. Derived from the payment mode. */
  payInFull?: boolean;
  promoCode?: string | null;
  address?: WireAddress | null;
  kind?: "booking" | "inquiry";
}

export interface WireContact {
  name: string;
  /** E.164, +1 and ten digits. */
  phone: string;
  email?: string;
}

export interface WireConsent {
  /** The terms version the customer saw, e.g. "2026-09-11". */
  termsVersion?: string;
  sms?: boolean;
  media?: boolean;
  /** The card-on-file authorisation. Required before a card is saved. */
  mandateAccepted?: boolean;
}

export interface CleanBooking {
  cart: WireCart;
  contact: WireContact;
  consent: WireConsent;
  kind: "booking" | "inquiry";
  /** Derived from `mode`, never from the cart. */
  payInFull: boolean;
}

export type WireValidation =
  | { ok: true; booking: CleanBooking }
  | { ok: false; error: string; message: string };

/* ---------------- limits ---------------- */

export const WIRE_LIMITS = {
  maxVehicles: 6,
  maxPackagesPerVehicle: 4,
  maxAddonsPerVehicle: 24,
  maxLabel: 60,
  maxName: 80,
  maxEmail: 120,
  maxLine1: 120,
  maxCity: 60,
  maxRegion: 30,
  maxPromo: 32,
  /** How far ahead a slot may be. Past this it is a conversation, not a form. */
  maxDaysAhead: 400,
  /**
   * ZIPs we will price. Ohio is 43000 to 45999, Kentucky 40000 to 42799,
   * Indiana 46000 to 47999. Everything else is outside the twelve hour
   * radius by geography alone, and would otherwise be taxed at a guessed
   * rate, which is worse than a polite refusal.
   */
  zipPattern: /^4[0-7]\d{3}$/,
};

const DAY = 86_400_000;

/* ---------------- helpers ---------------- */

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const str = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length <= max ? s : null;
};

/** Ten US digits, with or without a leading 1, any punctuation. */
export function normalisePhone(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  if (digits.length !== 10) return null;
  // No area code starts with 0 or 1 in the North American plan.
  if (/^[01]/.test(digits)) return null;
  return "+1" + digits;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/* ---------------- the gate ---------------- */

export interface ValidateOptions {
  nowMs: number;
  /** "pay_now" or "card_only". Anything else is treated as card_only. */
  mode?: unknown;
  /** Default true. The travel estimator can validate a cart without one. */
  requireAddress?: boolean;
  /** Default true. */
  requireContact?: boolean;
}

export function validateWire(body: unknown, opts: ValidateOptions): WireValidation {
  const fail = (error: string, message: string): WireValidation => ({ ok: false, error, message });

  if (!isObj(body)) return fail("bad_body", "The request was not understood.");
  const cart = body["cart"];
  if (!isObj(cart)) return fail("empty_cart", "Nothing to price.");

  /* ---- vehicles ---- */
  const rawVehicles = cart["vehicles"];
  if (!Array.isArray(rawVehicles) || rawVehicles.length === 0) return fail("empty_cart", "Nothing to price.");
  if (rawVehicles.length > WIRE_LIMITS.maxVehicles) {
    return fail("too_many_vehicles", `We can book up to ${WIRE_LIMITS.maxVehicles} vehicles online. Ask us about more.`);
  }

  const vehicles: WireVehicle[] = [];
  let anything = false;

  for (const rv of rawVehicles) {
    if (!isObj(rv)) return fail("bad_vehicle", "A vehicle entry was not understood.");

    const v: WireVehicle = {};

    if (rv["label"] !== undefined) {
      const label = str(rv["label"], WIRE_LIMITS.maxLabel);
      if (label === null) return fail("bad_label", "That vehicle description is too long.");
      if (label) v.label = label;
    }

    if (rv["sizeId"] !== undefined && rv["sizeId"] !== null) {
      if (typeof rv["sizeId"] !== "string" || !vehicleSize(rv["sizeId"])) {
        return fail("unknown_size", "That vehicle size is not one we offer.");
      }
      v.sizeId = rv["sizeId"];
    }

    /* packages: real, bookable, unique, one per category */
    const pkgIds = rv["packageIds"] ?? [];
    if (!Array.isArray(pkgIds)) return fail("bad_packages", "Packages were not understood.");
    if (pkgIds.length > WIRE_LIMITS.maxPackagesPerVehicle) return fail("bad_packages", "Too many packages on one vehicle.");
    const seenCat = new Set<string>();
    const seenPkg = new Set<string>();
    const packageIds: string[] = [];
    for (const id of pkgIds) {
      if (typeof id !== "string") return fail("bad_packages", "Packages were not understood.");
      const p = findPackage(id);
      if (!p) return fail("unknown_package", "One of those packages does not exist.");
      if (p.comingSoon) {
        return fail("not_bookable_yet", `${p.name} is not bookable yet. You can register interest and book the rest.`);
      }
      if (seenPkg.has(p.id)) return fail("duplicate_package", `${p.name} is on the same vehicle twice.`);
      if (seenCat.has(p.category)) {
        return fail("one_per_category", `Pick one ${p.category} package per vehicle.`);
      }
      seenPkg.add(p.id);
      seenCat.add(p.category);
      packageIds.push(p.id);
    }
    v.packageIds = packageIds;

    /* add-ons: real, selectable, priced, unique */
    const rawAddons = rv["addons"] ?? [];
    if (!Array.isArray(rawAddons)) return fail("bad_addons", "Add-ons were not understood.");
    if (rawAddons.length > WIRE_LIMITS.maxAddonsPerVehicle) return fail("bad_addons", "Too many add-ons on one vehicle.");
    const seenAddon = new Set<string>();
    const addons: { addonId: string; tierId: string }[] = [];
    for (const ra of rawAddons) {
      if (!isObj(ra) || typeof ra["addonId"] !== "string" || typeof ra["tierId"] !== "string") {
        return fail("bad_addons", "Add-ons were not understood.");
      }
      const def = findAddon(ra["addonId"]);
      if (!def) return fail("unknown_addon", "One of those add-ons does not exist.");
      if (!isSelectable(def)) return fail("addon_unavailable", `${def.name} is not available right now.`);
      const tier = def.tiers.find((t) => t.id === ra["tierId"]);
      if (!tier || tier.priceCents === null) return fail("unknown_addon", `${def.name} does not have that option.`);
      if (seenAddon.has(def.id)) return fail("duplicate_addon", `${def.name} is on the same vehicle twice.`);
      seenAddon.add(def.id);
      addons.push({ addonId: def.id, tierId: tier.id });
    }
    v.addons = addons;

    /* correction: only while the package that carries it is bookable */
    if (rv["correction"] !== undefined && rv["correction"] !== null) {
      const rc = rv["correction"];
      if (!isObj(rc) || typeof rc["tierId"] !== "string" || typeof rc["coatingId"] !== "string") {
        return fail("bad_correction", "Correction options were not understood.");
      }
      const host = findPackage("showroom-exterior");
      if (!host || host.comingSoon) {
        return fail("not_bookable_yet", "Paint correction is not bookable yet. You can register interest.");
      }
      if (!findCorrectionTier(rc["tierId"]) || !findCoatingTerm(rc["coatingId"])) {
        return fail("unknown_correction", "That correction option does not exist.");
      }
      v.correction = {
        tierId: rc["tierId"],
        coatingId: rc["coatingId"],
        ...(rc["noGarage"] === true ? { noGarage: true } : {}),
      };
    }

    if (packageIds.length || addons.length || v.correction) anything = true;
    vehicles.push(v);
  }
  if (!anything) return fail("empty_cart", "Pick at least one service.");

  /* ---- kind and slot ---- */
  const kind: "booking" | "inquiry" = cart["kind"] === "inquiry" ? "inquiry" : "booking";

  let slot: number | null = null;
  const rawSlot = cart["slot"];
  if (rawSlot !== undefined && rawSlot !== null) {
    if (typeof rawSlot !== "number" || !Number.isFinite(rawSlot)) {
      return fail("bad_slot", "That time was not understood.");
    }
    if (rawSlot <= opts.nowMs) return fail("slot_in_past", "That time has already passed. Pick another.");
    if (rawSlot > opts.nowMs + WIRE_LIMITS.maxDaysAhead * DAY) {
      return fail("slot_too_far", "That is further ahead than we book online. Ask us.");
    }
    slot = Math.round(rawSlot);
  }
  if (kind === "inquiry" && slot !== null) {
    return fail("inquiry_has_slot", "A request cannot carry a fixed time.");
  }

  /* ---- payment mode drives payInFull, nothing else does ---- */
  const payInFull = opts.mode === "pay_now";
  if (payInFull && slot === null) {
    return fail("inquiry_cannot_prepay", "We do not take payment in full for a time that is not confirmed yet.");
  }

  /* ---- visits ---- */
  let visits: number | undefined;
  if (cart["visits"] !== undefined && cart["visits"] !== null) {
    const n = cart["visits"];
    if (typeof n !== "number" || !Number.isInteger(n) || n < 1 || n > vehicles.length) {
      return fail("bad_visits", "Separate visits were not understood.");
    }
    visits = n;
  }

  /* ---- promo ---- */
  let promoCode: string | null = null;
  if (cart["promoCode"] !== undefined && cart["promoCode"] !== null) {
    const code = str(cart["promoCode"], WIRE_LIMITS.maxPromo);
    if (code === null) return fail("bad_promo", "That promo code is too long to be one of ours.");
    promoCode = code || null;
  }

  /* ---- address, and the ZIP that tax and travel come from ---- */
  let address: WireAddress | null = null;
  let zip: string | null = null;
  const rawAddr = cart["address"];
  if (rawAddr !== undefined && rawAddr !== null) {
    if (!isObj(rawAddr)) return fail("bad_address", "The address was not understood.");
    const line1 = str(rawAddr["line1"], WIRE_LIMITS.maxLine1);
    const city = str(rawAddr["city"], WIRE_LIMITS.maxCity);
    const region = str(rawAddr["region"] ?? "", WIRE_LIMITS.maxRegion);
    const z = str(rawAddr["zip"], 10);
    if (line1 === null || city === null || region === null || z === null) {
      return fail("bad_address", "Part of the address is too long.");
    }
    address = { line1, city, region, zip: z };
    zip = z;
  }
  if (opts.requireAddress !== false) {
    if (!address || !address.line1 || !address.city) {
      return fail("missing_address", "We need the address the vehicle will be at.");
    }
  }
  if (zip === null && typeof cart["zip"] === "string") zip = cart["zip"].trim();
  if (opts.requireAddress !== false || zip !== null) {
    if (!zip || !/^\d{5}$/.test(zip)) return fail("bad_zip", "We need a 5 digit ZIP so we can work out tax and travel.");
    if (!WIRE_LIMITS.zipPattern.test(zip)) {
      return fail("zip_out_of_area", "That ZIP is outside the area we can drive to. Ask us if you think that is wrong.");
    }
  }

  /* ---- contact ---- */
  let contact: WireContact = { name: "", phone: "" };
  const rawContact = body["contact"];
  if (opts.requireContact !== false || rawContact !== undefined) {
    if (!isObj(rawContact)) return fail("missing_contact", "We need a name and a phone number.");
    const name = str(rawContact["name"], WIRE_LIMITS.maxName);
    if (!name) return fail("bad_name", "We need your name.");
    const phone = normalisePhone(rawContact["phone"]);
    if (!phone) return fail("bad_phone", "That does not look like a US phone number.");
    contact = { name, phone };
    if (rawContact["email"] !== undefined && rawContact["email"] !== null && rawContact["email"] !== "") {
      const email = str(rawContact["email"], WIRE_LIMITS.maxEmail);
      if (!email || !EMAIL.test(email)) return fail("bad_email", "That email address does not look right.");
      contact.email = email.toLowerCase();
    }
  }

  /* ---- consent, carried through for the record ---- */
  const consent: WireConsent = {};
  const rawConsent = body["consent"];
  if (isObj(rawConsent)) {
    if (typeof rawConsent["termsVersion"] === "string") consent.termsVersion = rawConsent["termsVersion"].slice(0, 20);
    if (typeof rawConsent["sms"] === "boolean") consent.sms = rawConsent["sms"];
    if (typeof rawConsent["media"] === "boolean") consent.media = rawConsent["media"];
    if (rawConsent["mandateAccepted"] === true) consent.mandateAccepted = true;
  }

  const clean: WireCart = {
    vehicles,
    zip,
    slot,
    kind,
    ...(visits !== undefined ? { visits } : {}),
    ...(promoCode ? { promoCode } : {}),
    ...(address ? { address } : {}),
    payInFull,
  };

  return { ok: true, booking: { cart: clean, contact, consent, kind, payInFull } };
}

/** The drive cap, applied after the server has measured. */
export function driveTooFar(oneWayMinutes: number | null | undefined): boolean {
  return typeof oneWayMinutes === "number" && oneWayMinutes > MAX_ONE_WAY_MINUTES;
}

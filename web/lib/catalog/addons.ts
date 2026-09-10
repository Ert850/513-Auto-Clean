/**
 * Add-ons.
 *
 * Severity tiers rather than an hourly rate, because "how many hours of pet
 * hair is this?" is a question a customer cannot answer honestly and Elijah can
 * only judge on site.
 *
 * `priceCents: null` means not priced yet. Those render as "price on request"
 * and cannot be selected, for the same reason unpriced components cannot be
 * added: a guessed number either overcharges the customer or erodes margin.
 */

export type AddonScope = "interior" | "exterior";

export interface AddonTier {
  id: string;
  label: string;
  priceCents: number | null;
  description?: string;
  durationMin: number;
  /** Renders an asterisk against the price. */
  asterisk?: string;
}

export interface Addon {
  id: string;
  name: string;
  scope: AddonScope;
  description: string;
  note?: string;
  /**
   * Tiers are mutually exclusive by construction: choosing one replaces any
   * other tier of the same add-on. Stain work relies on this, since a customer
   * should never be able to buy both the reduction and the removal.
   */
  tiers: AddonTier[];
  /**
   * At least one of these packages must be in the cart for the same vehicle.
   * Used by Ozone, which cannot do its job on a vehicle that has not had the
   * organic material removed first.
   */
  requiresAnyPackageId?: string[];
  /** Alternatively satisfied by holding any of these add-on tiers. */
  requiresAnyAddonTier?: { addonId: string; tierIds: string[] }[];
  /** Shown when the requirement is unmet, in place of a bare disabled state. */
  requirementMessage?: string;
}

export const ADDONS: Addon[] = [
  /* ---------------- interior ---------------- */
  {
    id: "pet-hair",
    name: "Pet Hair Removal",
    scope: "interior",
    description: "Seats, carpets, and every crevice it has worked its way into.",
    tiers: [
      {
        id: "std",
        label: "Pet hair removal",
        priceCents: 5000,
        durationMin: 60,
        asterisk: "Quote may change upon inspection. Shorter, coarser fibers weave into fabric and take considerably longer to lift.",
      },
    ],
  },
  {
    id: "stain",
    name: "Stain Treatment",
    scope: "interior",
    description: "Two levels. Pick the one that matches what you are dealing with.",
    tiers: [
      {
        id: "minor",
        label: "Minor to moderate treatment",
        priceCents: 5000,
        durationMin: 60,
        description: "Stain treatment, scrubbing and reduction. Removes 70 to 90% of the stain.",
      },
      {
        id: "major",
        label: "Moderate to major removal",
        priceCents: 10000,
        durationMin: 120,
        description: "Three stage treatment: scrubbing, steam scrub, extraction. Removes 90 to 100% of the stain.",
      },
    ],
  },
  {
    id: "steam",
    name: "Full Vehicle Steam Treatment",
    scope: "interior",
    description: "All safe portions of the vehicle sanitized and scrubbed with a steamer.",
    tiers: [{ id: "std", label: "Full vehicle", priceCents: 7500, durationMin: 90 }],
  },
  {
    id: "ozone",
    name: "Ozone Odor Reset",
    scope: "interior",
    description: "60 to 80% reduction of organic odors.",
    tiers: [{ id: "std", label: "Ozone treatment", priceCents: 5000, durationMin: 60 }],
    // Ozone attacks what is left in the air and the plastics. Running it over
    // material that has not been extracted first mostly wastes the customer's
    // money, so it is gated rather than merely discouraged.
    requiresAnyPackageId: ["full-interior", "showroom-interior"],
    requiresAnyAddonTier: [{ addonId: "stain", tierIds: ["minor", "major"] }],
    requirementMessage:
      "Ozone needs the source removed first. Add it to a Full Interior or Showroom Ready, or pair it with a stain treatment.",
  },
  {
    id: "seat-removal",
    name: "Seat Removal",
    scope: "interior",
    description: "Electronic disconnect, full seat removal, and a full clean under and around the seats.",
    tiers: [{ id: "std", label: "Front seats out", priceCents: 10000, durationMin: 120 }],
  },

  /* ---------------- exterior ---------------- */
  {
    id: "headlight",
    name: "Headlight Restoration",
    scope: "exterior",
    description: "Oxidation removal, 2000 grit wet sand, 3000 grit wet sand, dry, then ceramic coated.",
    tiers: [{ id: "std", label: "Both headlights", priceCents: 7500, durationMin: 90 }],
  },
  {
    id: "tire-rim-shine",
    name: "Tire and Rim Shine",
    scope: "exterior",
    description: "Deep clean and dress the tires and rims.",
    tiers: [{ id: "std", label: "All four", priceCents: null, durationMin: 30 }],
  },
  {
    id: "paint-decon",
    name: "Paint Decontamination",
    scope: "exterior",
    description: "Chemical decontamination to strip embedded iron and fallout. Required before any paint correction.",
    tiers: [{ id: "std", label: "Full vehicle", priceCents: null, durationMin: 45 }],
  },
  {
    id: "clay-bar",
    name: "Clay Bar",
    scope: "exterior",
    description: "Mechanically lifts anything decontamination leaves behind, all panels.",
    tiers: [{ id: "std", label: "All panels", priceCents: null, durationMin: 60 }],
  },
  {
    id: "hard-water",
    name: "Hard Water Spot Removal",
    scope: "exterior",
    description: "For etched sprinkler and well water spotting on paint and glass.",
    tiers: [{ id: "std", label: "Full vehicle", priceCents: null, durationMin: 60 }],
  },
  {
    id: "engine-bay",
    name: "Engine Bay Detail",
    scope: "exterior",
    description: "Cleaned, dressed and protected.",
    tiers: [{ id: "std", label: "Engine bay", priceCents: null, durationMin: 30 }],
  },
];

export function addonsFor(scope: AddonScope): Addon[] {
  return ADDONS.filter((a) => a.scope === scope);
}

export function findAddon(id: string): Addon | undefined {
  return ADDONS.find((a) => a.id === id);
}

/** True when every tier of an add-on is still unpriced, so it cannot be sold. */
export function isUnpriced(a: Addon): boolean {
  return a.tiers.every((t) => t.priceCents === null);
}

/**
 * Is an add-on's requirement satisfied by what is already in this vehicle?
 * Returns null when it is, or the message explaining what is missing.
 */
export function addonBlockedReason(
  a: Addon,
  ctx: { packageIds: string[]; addonTiers: { addonId: string; tierId: string }[] },
): string | null {
  const needsPackage = a.requiresAnyPackageId?.length ? a.requiresAnyPackageId : null;
  const needsAddon = a.requiresAnyAddonTier?.length ? a.requiresAnyAddonTier : null;
  if (!needsPackage && !needsAddon) return null;

  const packageOk = needsPackage
    ? needsPackage.some((id) => ctx.packageIds.includes(id))
    : false;

  const addonOk = needsAddon
    ? needsAddon.some((req) =>
        ctx.addonTiers.some((t) => t.addonId === req.addonId && req.tierIds.includes(t.tierId)),
      )
    : false;

  // Either route satisfies it, which is what "Full tier OR basic plus stain
  // treatment" means.
  return packageOk || addonOk ? null : (a.requirementMessage ?? "Not available with this package.");
}

/* ================= paint correction ================= */

export interface CorrectionTier {
  id: string;
  label: string;
  priceCents: number;
  result: string;
  asterisk: boolean;
  durationMin: number;
}

export interface CoatingUpgrade {
  id: string;
  label: string;
  addCents: number;
  asterisk: boolean;
}

export const PAINT_CORRECTION = {
  id: "paint-correction",
  name: "Paint Correction and Ceramic Coating",
  scope: "exterior" as const,
  requiresAddonIds: ["paint-decon"],
  minimumPackageId: "basic-exterior",
  includedCoating: "1 year ceramic coating",
  tiers: [
    {
      id: "one-step", label: "1 step paint polish", priceCents: 40000, durationMin: 240,
      result: "Looks perfect from about 5 feet away", asterisk: true,
    },
    {
      id: "two-step", label: "2 step paint correction", priceCents: 90000, durationMin: 480,
      result: "Looks perfect from about 2 feet away", asterisk: true,
    },
    {
      id: "three-step", label: "3 step paint correction", priceCents: 180000, durationMin: 720,
      result: "Removes 90% of all defects", asterisk: false,
    },
  ] as CorrectionTier[],
  coatingUpgrades: [
    { id: "1yr", label: "1 year (included)", addCents: 0, asterisk: true },
    { id: "2yr", label: "2 year", addCents: 10000, asterisk: true },
    { id: "5yr", label: "5 year", addCents: 15000, asterisk: true },
    { id: "10yr", label: "10 year", addCents: 25000, asterisk: true },
  ] as CoatingUpgrade[],
  asteriskNote:
    "With proper maintenance: washing the vehicle monthly at minimum, and refreshing the coating with a sacrificial sealant annually.",
};

export const MAINTENANCE_PLAN = {
  id: "maintenance-plan",
  name: "Coating Maintenance Plan",
  monthlyCents: 14900,
  monthsFreeOnAnnual: 1,
  annualCents: 14900 * 11,
  includes: [
    "Monthly pre-wash and hand wash",
    "Bug and tar remover",
    "Decontamination",
    "Wheel and tire clean",
    "Sealant application twice a year",
  ],
};

/* ================= service levels ================= */

/**
 * Quality tiers Elijah assigns per service, per part of the vehicle.
 * Deliberately NOT derived from the package: an Express is not automatically
 * "all Good", so he sets each one and the ladder reflects what actually
 * differs rather than an assumption.
 */
export const SERVICE_LEVELS = [
  { level: 1, id: "good", label: "Good", asterisk: false },
  { level: 2, id: "better", label: "Better", asterisk: false },
  { level: 3, id: "best", label: "Best", asterisk: false },
  { level: 4, id: "perfect", label: "Perfect", asterisk: true },
] as const;

export type ServiceLevel = 1 | 2 | 3 | 4;

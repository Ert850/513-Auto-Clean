/**
 * Add-ons.
 *
 * Most are fixed-price with a small set of severity tiers rather than an
 * open-ended hourly rate, because "how many hours of pet hair is this?" is a
 * question a customer cannot answer and Elijah can only judge on site. Tiers
 * let someone self-select honestly and still land on a real number.
 *
 * `priceCents: null` means Elijah has not priced it yet. Those render as
 * "price on request" and cannot be selected, for the same reason unpriced
 * components cannot be added: a guessed number either overcharges the
 * customer or erodes the margin.
 */

export type AddonScope = "interior" | "exterior";

export interface AddonTier {
  id: string;
  label: string;
  priceCents: number | null;
  description?: string;
  durationMin: number;
}

export interface Addon {
  id: string;
  name: string;
  scope: AddonScope;
  description: string;
  /** Extra caveat shown under the tiers. */
  note?: string;
  tiers: AddonTier[];
  /** Add-ons this one cannot be bought without. */
  requiresAddonIds?: string[];
  /** Minimum package required, by package id. */
  requiresPackageIds?: string[];
}

export const ADDONS: Addon[] = [
  /* ---------------- interior ---------------- */
  {
    id: "pet-hair",
    name: "Pet Hair Removal",
    scope: "interior",
    description: "Seats, carpets, and every crevice it has worked its way into.",
    note: "Shorter, coarser fibers weave into fabric and take far longer to lift, so a small dog can be more work than a big one.",
    tiers: [
      { id: "minor", label: "Minor", priceCents: 5000, description: "A light dusting, mostly on one surface", durationMin: 60 },
      { id: "moderate", label: "Moderate", priceCents: 7500, description: "Noticeable through the seats and carpet", durationMin: 90 },
      { id: "heavy", label: "Heavy", priceCents: 10000, description: "Woven in throughout, visible everywhere", durationMin: 120 },
    ],
  },
  {
    id: "stain-treatment",
    name: "Stain Treatment",
    scope: "interior",
    description: "A Full Interior includes stain reduction. These go further.",
    tiers: [
      {
        id: "reduction", label: "Stain reduction", priceCents: 5000, durationMin: 60,
        description: "Treatment, scrub, steam, and wipe removal. Typically 75 to 90% reduction. Already included with Full Interior.",
      },
      {
        id: "extraction", label: "Stain extraction", priceCents: 10000, durationMin: 120,
        description: "Everything in reduction, but double treated with heavy soaking and triple extraction. For vomit, heavy set stains, and smells.",
      },
      {
        id: "intensive", label: "Full vehicle intensive", priceCents: 20000, durationMin: 240,
        description: "Stains across the whole vehicle. Four hours of extraction and steaming on every surface.",
      },
    ],
  },
  {
    id: "steam",
    name: "Full Vehicle Steam Treatment",
    scope: "interior",
    description: "Useful for sanitization and decontamination.",
    tiers: [{ id: "std", label: "Full vehicle", priceCents: 5000, durationMin: 60 }],
  },
  {
    id: "ozone",
    name: "Ozone Odor Reset",
    scope: "interior",
    description: "An ozone machine runs in the vehicle for an hour, pulling smells out of the plastics, seats, trim, and ventilation.",
    tiers: [{ id: "std", label: "One hour treatment", priceCents: 5000, durationMin: 60 }],
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
    name: "Tire & Rim Shine",
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
    description: "Cleaned, dressed, and protected.",
    tiers: [{ id: "std", label: "Engine bay", priceCents: null, durationMin: 30 }],
  },
];

/* ================= paint correction ================= */

export interface CorrectionTier {
  id: string;
  label: string;
  priceCents: number;
  /** Plain-language promise, with the maintenance asterisk where it applies. */
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
  name: "Paint Correction & Ceramic Coating",
  scope: "exterior" as const,
  /** Cannot be sold without decon, and not on an Express wash. */
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

/** Optional plan that keeps a coating inside its warranty conditions. */
export const MAINTENANCE_PLAN = {
  id: "maintenance-plan",
  name: "Coating Maintenance Plan",
  monthlyCents: 14900,
  /** Pay for a year up front and one month is free, so 11 months buys 12. */
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
 *
 * Deliberately NOT derived from the package: an Express is not automatically
 * "all Good", and a Basic is not automatically "all Better". He sets each one,
 * so the ladder reflects what actually differs rather than an assumption.
 */
export const SERVICE_LEVELS = [
  { level: 1, id: "good", label: "Good", asterisk: false },
  { level: 2, id: "better", label: "Better", asterisk: false },
  { level: 3, id: "best", label: "Best", asterisk: false },
  { level: 4, id: "perfect", label: "Perfect", asterisk: true },
] as const;

export type ServiceLevel = 1 | 2 | 3 | 4;

/* ================= showroom ready ================= */

export const SHOWROOM_READY = {
  id: "showroom-ready",
  name: "Showroom Ready",
  tagline: "Extreme attention to detail, priced by the hour on condition.",
  hourlyCents: 10000,
  minimumHours: 6,
  get minimumCents() { return this.hourlyCents * this.minimumHours; },
  /** Flat deposit rather than a percentage, because the total is open ended. */
  depositCents: 60000,
  level: 4 as ServiceLevel,
  note: "Priced at $100/hour with a 6 hour minimum. Final price depends on the vehicle's starting condition and the time it takes. Exterior Showroom Ready is extreme detail work, not a paint correction.",
};

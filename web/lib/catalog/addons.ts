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
        description: "Treatment, scrubbing and wipe reduction. Removes 70 to 90% of the stain.",
      },
      {
        id: "major",
        label: "Moderate to major removal",
        priceCents: 10000,
        durationMin: 120,
        description: "Treatment, scrubbing, upholstery extraction, 250 degree steaming and wipe removal. Removes 90 to 100% of the stain.",
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
    description:
      "Ozone (O3) destroys the compounds causing the smell instead of covering them. 60 to 90% reduction of organic odors. Must be paired with a stain treatment, or Full Interior and above.",
    note:
      "A generator converts the oxygen in the air (O2) into ozone (O3). That extra atom is unstable, so it breaks away and oxidises odor molecules, bacteria and smoke residue on contact. Because it works as a gas it reaches the vents, headliner and seat foam that wiping cannot. It then reverts to ordinary oxygen and leaves nothing behind. The vehicle is sealed while it runs and aired out afterwards.",
    tiers: [{ id: "std", label: "Ozone treatment", priceCents: 5000, durationMin: 60 }],
    // Ozone attacks what is left in the air and the plastics. Running it over
    // material that has not been extracted first mostly wastes the customer's
    // money, so it is gated rather than merely discouraged.
    requiresAnyPackageId: ["full-interior", "showroom-interior"],
    requiresAnyAddonTier: [{ addonId: "stain", tierIds: ["minor", "major"] }],
    requirementMessage:
      "Ozone needs the source removed first. Pair it with a stain treatment, or add it to a Full Interior or Showroom Ready.",
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

/**
 * Showroom Ready Exterior is Full Exterior plus one of these. Choosing a tier
 * is required, which is why they live here rather than as optional add-ons.
 *
 * PRICING IS DELIBERATELY HIGH. Elijah is starting out on correction work and
 * does not want these booked yet, so the numbers discourage without being
 * absurd. They sit at the top of the local market rather than beyond it.
 * Lower them as he gets reps in.
 *
 * DURATIONS come from published trade figures: a 1 step polish is 4 to 8
 * hours of labour, a 2 step 10 to 16, a 3 step 20 to 40 plus. Prep and the
 * coating itself add roughly 3 hours, and there is extra padding here because
 * he is new to it. Hard paint can add another 20 to 30% on top.
 */

export interface CorrectionTier {
  id: string;
  label: string;
  /** Added on top of the Full Exterior base. */
  addCents: number;
  /** Added on top of the Full Exterior duration. */
  addMin: number;
  result: string;
  detail: string;
  asterisk: boolean;
}

export const CORRECTION_TIERS: CorrectionTier[] = [
  {
    id: "coating-only",
    label: "Ceramic coating only",
    addCents: 55000,
    addMin: 5 * 60,
    result: "3 to 5 years of protection, no correction",
    detail:
      "Panel wipe, coating applied and levelled by hand, then left to cure. Existing swirls and scratches stay as they are, sealed under the coating.",
    asterisk: true,
  },
  {
    id: "one-step",
    label: "1 step paint correction, then coating",
    addCents: 85000,
    addMin: 12 * 60,
    result: "Looks perfect from about 5 feet away",
    detail:
      "One cutting and finishing pass lifts most light swirling and haze, then the coating goes on. Removes roughly 60 to 70% of visible defects.",
    asterisk: true,
  },
  {
    id: "two-step",
    label: "2 step paint correction, then coating",
    addCents: 150000,
    addMin: 18 * 60,
    result: "Looks perfect from about 2 feet away",
    detail:
      "A compounding pass to cut deeper defects, then a refining pass to bring the gloss back, then the coating. Removes roughly 80 to 90%.",
    asterisk: true,
  },
  {
    id: "three-step",
    label: "3 step paint correction, then coating",
    addCents: 260000,
    addMin: 30 * 60,
    result: "Removes 90%+ of all defects",
    detail:
      "Heavy cut, refine, then a final jewelling pass under inspection lighting before coating. This is show car work and runs across several days.",
    asterisk: false,
  },
];

export const COATING_TERMS = [
  { id: "3yr", label: "3 year", addCents: 0, asterisk: true },
  { id: "5yr", label: "5 year", addCents: 15000, asterisk: true },
  { id: "10yr", label: "10 year", addCents: 30000, asterisk: true },
];

export const CORRECTION_RULES = {
  /**
   * Temporary. Elijah is not ready to take these at short notice, so they sit
   * two weeks out. Set to 0 to remove the delay entirely without touching
   * anything else.
   */
  minLeadDays: 14,
  /** Correction runs across days, so it starts on a weekend morning. */
  weekendOnly: true,
  allowedStartsMin: [8 * 60, 10 * 60],
  /**
   * Only the first day gets scheduled. The rest is arranged directly, because
   * a 30 hour job cannot sit in one calendar slot and pretending otherwise
   * would block a fortnight of availability.
   */
  firstDayMin: 8 * 60,
  garageRequired: true,
  canopyCents: 5000,
  canopyNote:
    "Correction and coating need a controlled space: no direct sun, no wind, no dust settling on wet coating. If you do not have a garage we bring a canopy.",
  asteriskNote:
    "With proper maintenance: washing the vehicle monthly at minimum, and refreshing the coating with a sacrificial sealant annually.",
};

/** Optional plan that keeps a coating inside its warranty conditions. */
export const MAINTENANCE_PLAN = {
  id: "maintenance-plan",
  name: "Coating Maintenance Plan",
  monthlyCents: 14900,
  monthsFreeOnAnnual: 1,
  annualCents: 14900 * 11,
  includes: [
    "Monthly pre-wash and hand wash",
    "Bug remover",
    "Decontamination",
    "Wheel and tire clean",
    "Sealant application twice a year",
  ],
};

export function findCorrectionTier(id: string): CorrectionTier | undefined {
  return CORRECTION_TIERS.find((t) => t.id === id);
}

export function findCoatingTerm(id: string) {
  return COATING_TERMS.find((t) => t.id === id);
}

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

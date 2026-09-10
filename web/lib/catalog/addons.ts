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
  /** See ServiceComponent.videoUrl. Reserved for the (i) markers. */
  videoUrl?: string;
}

export interface Addon {
  id: string;
  name: string;
  scope: AddonScope;
  description: string;
  /**
   * Plain explanation of what actually happens, shown behind a "How it works"
   * toggle on every add-on. Customers buy what they understand, and half of
   * these are jargon otherwise.
   *
   * The (i) marker and an autoplaying clip will sit alongside this later,
   * driven by videoUrl. Neither renders yet.
   */
  note?: string;
  /**
   * Listed but not bookable. Used for work Elijah is not ready to take on,
   * so the capability is visible without the risk of someone buying it.
   */
  unavailable?: boolean;
  unavailableNote?: string;
  /** See ServiceComponent.videoUrl. Reserved for the (i) markers. */
  videoUrl?: string;
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
    note:
      "Pet hair does not vacuum out once it has woven into fabric. It gets lifted mechanically first, with rubber tools and a horsehair brush that drag the fibers back out of the weave, then vacuumed and gone over again. The second pass is where most of it actually comes out.",
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
    note:
      "A stain is either sitting on the fibers or has soaked into them. Treatment breaks the bond so it can be agitated loose and wiped away, which handles anything on the surface. Removal goes further: heat and moisture pull what has soaked in back up out of the padding, and an extractor takes it away rather than pushing it deeper. That is why the deeper option costs more time, not just more product.",
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
    note:
      "Steam cleans with heat rather than chemicals. It softens grease and grime so it wipes off instead of being scrubbed at, gets into vents, seams and seat rails that no cloth reaches, and the heat kills bacteria on contact. Everything dries in minutes because there is very little water involved.",
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
    note:
      "The worst of an interior collects under the seats, where a vacuum wand cannot reach past the rails. The battery is disconnected first so the airbag sensors in the seat are safe to unplug, the seats come out on their bolts, and the whole floor is cleaned properly before they go back in and get torqued to spec.",
    tiers: [{ id: "std", label: "Front seats out", priceCents: 10000, durationMin: 120 }],
  },

  /* ---------------- exterior ---------------- */
  {
    id: "headlight",
    name: "Headlight Restoration",
    scope: "exterior",
    description: "Oxidation removal, 2000 grit wet sand, 3000 grit wet sand, dry, then ceramic coated.",
    note:
      "Headlights yellow because UV breaks down the factory coating on the outside of the plastic. Polishing alone buffs the haze off but leaves the plastic bare, so it clouds again within months. Sanding takes the damaged layer off properly, progressively finer grits bring the clarity back, and a ceramic coating replaces the UV protection that failed in the first place.",
    tiers: [{ id: "std", label: "Both headlights", priceCents: 7500, durationMin: 90 }],
  },
  {
    id: "tire-rim-shine",
    name: "Tire and Rim Shine",
    scope: "exterior",
    description: "Deep clean and dress the tires and rims.",
    note:
      "Brake dust is not dirt, it is hot metal particles that embed themselves into the wheel finish. A dedicated cleaner dissolves the iron so it rinses off instead of being scrubbed in, then the tire gets a dressing that blocks UV, which is what causes the browning and cracking on sidewalls.",
    tiers: [{ id: "std", label: "All four", priceCents: null, durationMin: 30 }],
  },
  {
    id: "paint-decon",
    name: "Paint Decontamination",
    scope: "exterior",
    description: "Chemical decontamination to strip embedded iron and fallout.",
    note:
      "Paint that still feels rough after a wash is holding contamination the soap cannot lift: rail dust, industrial fallout and brake particles that have bonded to the clear coat. An iron remover dissolves them chemically. Skipping this before any polish or coating means grinding those particles into the paint.",
    tiers: [{ id: "std", label: "Full vehicle", priceCents: null, durationMin: 45 }],
  },
  {
    id: "clay-bar",
    name: "Clay Bar or Clay Towel",
    scope: "exterior",
    description: "Mechanically lifts anything decontamination leaves behind, all panels.",
    note:
      "Chemical decon handles metal particles; clay handles everything else, like overspray, tree sap residue and road film. It shears the bonded contamination off the surface as it glides, always on a wet panel so nothing gets dragged. The paint goes from feeling like fine sandpaper to feeling like glass.",
    tiers: [{ id: "std", label: "All panels", priceCents: null, durationMin: 60 }],
  },
  {
    id: "hard-water",
    name: "Hard Water Spot Removal",
    scope: "exterior",
    description: "For etched sprinkler and well water spotting on paint and glass.",
    note:
      "Hard water leaves dissolved minerals behind when it dries, and in sun those minerals etch a ring into the clear coat. Caught early a mild acid dissolves them off. Left long enough the etching is physical damage in the paint and needs polishing out, which is a correction job rather than this one.",
    tiers: [{ id: "std", label: "Full vehicle", priceCents: null, durationMin: 60 }],
  },
  {
    id: "engine-bay",
    name: "Engine Bay Detail",
    scope: "exterior",
    description: "Cleaned, dressed and protected.",
    note:
      "Sensitive electronics get covered first, then a degreaser is left to dwell and agitated by hand rather than blasted with a pressure washer, which is how water finds its way into connectors. Everything is blown dry and the plastics and hoses get a dressing that stops them fading and cracking under engine heat.",
    tiers: [{ id: "std", label: "Engine bay", priceCents: null, durationMin: 30 }],
  },
  {
    id: "ceramic-sealant",
    name: "Ceramic Sealant",
    scope: "exterior",
    description: "Six months or so of gloss and beading, applied over clean paint.",
    note:
      "A sprayable sealant that bonds to the clear coat and leaves a slick, hydrophobic layer. Water beads and rolls off instead of sheeting and drying into spots, and dirt struggles to key onto the surface, so the car stays cleaner between washes. Far quicker than a coating, and it does not need the paint corrected first.",
    tiers: [{ id: "std", label: "Full vehicle", priceCents: null, durationMin: 45 }],
  },
  {
    id: "ceramic-coating",
    name: "Ceramic Coating",
    scope: "exterior",
    description: "Years of protection rather than months. Booked as Showroom Ready Exterior.",
    note:
      "A real coating cures into a hard glass-like layer chemically bonded to the clear coat, which is why it lasts years rather than months. It also locks in whatever the paint looks like at the time, so any swirls underneath are sealed in with it. That is why coatings are sold with correction rather than on their own, and why this one lives inside Showroom Ready Exterior.",
    unavailable: true,
    unavailableNote:
      "Booked through Showroom Ready Exterior, which includes the prep a coating needs.",
    tiers: [{ id: "std", label: "Full vehicle", priceCents: null, durationMin: 300 }],
  },
  {
    id: "paint-polish",
    name: "Paint Polish",
    scope: "exterior",
    description: "A single machine pass to lift light swirling and bring the gloss back.",
    note:
      "Swirl marks are thousands of fine scratches in the clear coat, usually from washing. A polish uses an abrasive on a machine pad to level a microscopic amount of clear coat down to the base of those scratches, so they stop catching light. It is removing material, which is why it is done sparingly and by someone who knows how much is there.",
    unavailable: true,
    unavailableNote: "Temporarily unavailable while we build up our correction setup.",
    tiers: [{ id: "std", label: "Single stage", priceCents: null, durationMin: 300 }],
  },
  {
    id: "paint-correction",
    name: "Paint Correction",
    scope: "exterior",
    description: "Multi stage cutting and refining for deeper defects.",
    note:
      "Correction is polishing taken further: a cutting compound removes the defect, then progressively finer passes remove the haze the cutting itself leaves behind. Two and three stage work is how you get a finish that holds up under direct light rather than only looking right in the shade.",
    unavailable: true,
    unavailableNote: "Temporarily unavailable. Available inside Showroom Ready Exterior.",
    tiers: [{ id: "std", label: "Multi stage", priceCents: null, durationMin: 600 }],
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
 * Can a customer actually add this right now?
 *
 * Unpriced and unavailable are different states with the same answer: the
 * add-on is still LISTED either way, because hiding a service hides the fact
 * that we do it. It just cannot be selected.
 */
export function isSelectable(a: Addon): boolean {
  return !a.unavailable && !isUnpriced(a);
}

export function unavailableReason(a: Addon): string | null {
  if (a.unavailable) return a.unavailableNote ?? "Temporarily unavailable.";
  if (isUnpriced(a)) return "Price on request, ask us and we will quote it.";
  return null;
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
 *
 * EVERY tier coats the whole vehicle, not just the paint: wheels, plastic
 * trim and glass are included throughout. Stated once here and surfaced in
 * the UI, rather than repeated on each tier.
 */

export const COATING_COVERAGE =
  "Every coating covers the whole vehicle: paint, wheels, plastic trim and glass.";

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
      "Panel wipe, then coating applied and levelled by hand across paint, wheels, plastic trim and glass, and left to cure. Existing swirls and scratches stay as they are, sealed under the coating.",
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
    addCents: 149500,
    addMin: 18 * 60,
    result: "Looks perfect from about 2 feet away",
    detail:
      "A compounding pass to cut deeper defects, then a refining pass to bring the gloss back, then the coating. Removes roughly 80 to 90%.",
    asterisk: true,
  },
  {
    id: "three-step",
    label: "3 to 4 step paint correction, then coating",
    addCents: 225000,
    addMin: 30 * 60,
    result: "Removes 90%+ of all defects, reflective trim included",
    detail:
      "Heavy cut, refine, then a final jewelling pass under inspection lighting before coating, with a fourth pass where the paint needs it. Reflective trim is corrected and coated alongside the paint. This is show car work and runs across several days.",
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

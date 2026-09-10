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
  /**
   * Kept to roughly one line, around 60 to 70 characters. The add-on cards
   * sit in a grid, and a description three times the length of its neighbour
   * is what made that grid ragged. Anything longer belongs in `note`.
   */
  description: string;
  /** Key into ADDON_ICONS in ./icons.ts. */
  icon: string;
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
   *
   * An unavailable add-on still shows its price. Withholding the number does
   * not stop anyone wanting the work, it only stops them knowing whether it
   * is in their budget when it opens up.
   */
  unavailable?: boolean;
  unavailableNote?: string;
  /**
   * Packages that already contain this work. Most exterior add-ons are also
   * components of Full Exterior, and selling one on top of the other charges
   * twice for the same job.
   *
   * The message names the package rather than deriving it, because importing
   * the package catalog here would make the two modules circular.
   */
  includedIn?: { packageIds: string[]; message: string };
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

/**
 * Correction and coating prices, on top of the Full Exterior base.
 *
 * Declared here rather than only inside CORRECTION_TIERS because the Add-ons
 * table quotes the same work at the same numbers. One constant, so the tier
 * list and the add-on list cannot drift apart.
 */
export const CORRECTION_ADD_CENTS = {
  coatingOnly: 55000,
  oneStep: 85000,
  twoStep: 149500,
  threeStep: 225000,
} as const;

/** Shown on everything gated behind Elijah building up his correction setup. */
const CORRECTION_SOON = "Temporarily unavailable.";

export const ADDONS: Addon[] = [
  /* ---------------- interior ---------------- */
  {
    id: "pet-hair",
    name: "Pet Hair Removal",
    scope: "interior",
    icon: "paw",
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
    icon: "droplet",
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
    icon: "steam",
    description: "Every safe surface sanitized and scrubbed with a steamer.",
    note:
      "Steam cleans with heat rather than chemicals. It softens grease and grime so it wipes off instead of being scrubbed at, gets into vents, seams and seat rails that no cloth reaches, and the heat kills bacteria on contact. Everything dries in minutes because there is very little water involved.",
    tiers: [{ id: "std", label: "Full vehicle", priceCents: 7500, durationMin: 90 }],
  },
  {
    id: "ozone",
    name: "Ozone Odor Reset",
    scope: "interior",
    icon: "molecule",
    description: "Ozone (O3) destroys the compounds causing the smell, not just the smell.",
    note:
      "A generator converts the oxygen in the air (O2) into ozone (O3). That extra atom is unstable, so it breaks away and oxidises odor molecules, bacteria and smoke residue on contact. Because it works as a gas it reaches the vents, headliner and seat foam that wiping cannot. It then reverts to ordinary oxygen and leaves nothing behind. The vehicle is sealed while it runs and aired out afterwards. Expect a 60 to 90% reduction in organic odors. It has to be paired with a stain treatment, or with a Full Interior or above, because ozone cannot remove what is still soaked into the fabric.",
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
    icon: "seat",
    description: "Front seats out, the floor underneath cleaned properly, then refitted.",
    note:
      "The worst of an interior collects under the seats, where a vacuum wand cannot reach past the rails. The battery is disconnected first so the airbag sensors in the seat are safe to unplug, the seats come out on their bolts, and the whole floor is cleaned properly before they go back in and get torqued to spec.",
    tiers: [{ id: "std", label: "Front seats out", priceCents: 10000, durationMin: 120 }],
  },

  /* ---------------- exterior ---------------- */
  {
    id: "headlight",
    name: "Headlight Restoration",
    scope: "exterior",
    icon: "headlight",
    description: "Yellowing sanded off, clarity polished back, then ceramic coated.",
    note:
      "Headlights yellow because UV breaks down the factory coating on the outside of the plastic. Polishing alone buffs the haze off but leaves the plastic bare, so it clouds again within months. Sanding takes the damaged layer off properly, progressively finer grits bring the clarity back, and a ceramic coating replaces the UV protection that failed in the first place.",
    tiers: [{ id: "std", label: "Both headlights", priceCents: 7500, durationMin: 90 }],
  },
  {
    id: "tire-rim-shine",
    name: "Tire and Rim Shine",
    scope: "exterior",
    icon: "wheel",
    description: "Brake dust dissolved off the rims, tires cleaned and dressed.",
    note:
      "Brake dust is not dirt, it is hot metal particles that embed themselves into the wheel finish. A dedicated cleaner dissolves the iron so it rinses off instead of being scrubbed in, then the tire gets a dressing that blocks UV, which is what causes the browning and cracking on sidewalls.",
    includedIn: {
      packageIds: ["basic-exterior", "full-exterior", "showroom-exterior"],
      message: "Already included from Basic Exterior up. No need to add it.",
    },
    tiers: [{ id: "std", label: "All four", priceCents: 3500, durationMin: 30 }],
  },
  {
    id: "paint-decon",
    name: "Paint Decontamination",
    scope: "exterior",
    icon: "spray",
    description: "Chemical decontamination to strip embedded iron and fallout.",
    note:
      "Paint that still feels rough after a wash is holding contamination the soap cannot lift: rail dust, industrial fallout and brake particles that have bonded to the clear coat. An iron remover dissolves them chemically. Skipping this before any polish or coating means grinding those particles into the paint.",
    includedIn: {
      packageIds: ["full-exterior", "showroom-exterior"],
      message: "Already included in Full Exterior. No need to add it.",
    },
    tiers: [{ id: "std", label: "Full vehicle", priceCents: 4500, durationMin: 45 }],
  },
  {
    id: "clay-bar",
    name: "Clay Bar or Clay Towel",
    scope: "exterior",
    icon: "bar",
    description: "Lifts what chemical decon leaves behind, across every panel.",
    note:
      "Chemical decon handles metal particles; clay handles everything else, like overspray, tree sap residue and road film. It shears the bonded contamination off the surface as it glides, always on a wet panel so nothing gets dragged. The paint goes from feeling like fine sandpaper to feeling like glass.",
    includedIn: {
      packageIds: ["full-exterior", "showroom-exterior"],
      message: "Already included in Full Exterior. No need to add it.",
    },
    // Claying paint that has not been chemically decontaminated first drags
    // bonded iron across the clear coat, so the two are sold together, the
    // same way ozone is gated behind stain work.
    requiresAnyAddonTier: [{ addonId: "paint-decon", tierIds: ["std"] }],
    requirementMessage:
      "Clay goes on after the chemical decontamination, never before it. Add Paint Decontamination first, or step up to Full Exterior, which includes both.",
    tiers: [{ id: "std", label: "All panels", priceCents: 4500, durationMin: 60 }],
  },
  {
    id: "hard-water",
    name: "Hard Water Spot Removal",
    scope: "exterior",
    icon: "spots",
    description: "For etched sprinkler and well water spotting on paint and glass.",
    note:
      "Hard water leaves dissolved minerals behind when it dries, and in sun those minerals etch a ring into the clear coat. Caught early a mild acid dissolves them off. Left long enough the etching is physical damage in the paint and needs polishing out, which is a correction job rather than this one.",
    includedIn: {
      packageIds: ["full-exterior", "showroom-exterior"],
      message: "Already included in Full Exterior. No need to add it.",
    },
    tiers: [{ id: "std", label: "Full vehicle", priceCents: 5000, durationMin: 60 }],
  },
  {
    id: "engine-bay",
    name: "Engine Bay Detail",
    scope: "exterior",
    icon: "engine",
    description: "Degreased by hand, blown dry, then dressed and protected.",
    note:
      "Sensitive electronics get covered first, then a degreaser is left to dwell and agitated by hand rather than blasted with a pressure washer, which is how water finds its way into connectors. Everything is blown dry and the plastics and hoses get a dressing that stops them fading and cracking under engine heat.",
    includedIn: {
      packageIds: ["full-exterior", "showroom-exterior"],
      message: "Already included in Full Exterior. No need to add it.",
    },
    tiers: [{ id: "std", label: "Engine bay", priceCents: 5000, durationMin: 30 }],
  },
  {
    id: "ceramic-sealant",
    // "Ceramic Wax Sealant", never "Ceramic Coating". Those are months against
    // years of durability and hundreds of dollars apart, and the industry
    // blurs the two constantly.
    name: "Ceramic Wax Sealant",
    scope: "exterior",
    icon: "shield",
    description: "Six months of gloss and beading. A sealant, not a ceramic coating.",
    note:
      "A sprayable ceramic infused wax that bonds to the clear coat and leaves a slick, hydrophobic layer. Water beads and rolls off instead of sheeting and drying into spots, and dirt struggles to key onto the surface, so the car stays cleaner between washes. This is not a ceramic coating: a coating cures hard, lasts years, and needs the paint corrected first. This goes on in under an hour, lasts about six months, and can be topped up whenever you like.",
    includedIn: {
      packageIds: ["full-exterior", "showroom-exterior"],
      message: "Already included in Full Exterior. No need to add it.",
    },
    tiers: [{ id: "std", label: "Full vehicle", priceCents: 3500, durationMin: 45 }],
  },
  {
    id: "ceramic-coating",
    name: "Ceramic Coating",
    scope: "exterior",
    icon: "gem",
    description: "Years of protection rather than months, bonded to the clear coat.",
    note:
      "A real coating cures into a hard glass-like layer chemically bonded to the clear coat, which is why it lasts years rather than months. It also locks in whatever the paint looks like at the time, so any swirls underneath are sealed in with it. That is why coatings are sold with correction rather than on their own, and why this one lives inside Showroom Ready Exterior.",
    unavailable: true,
    unavailableNote:
      "Booked through Showroom Ready Exterior, which includes the prep a coating needs.",
    tiers: [
      {
        id: "std",
        label: "Coating only, no correction",
        priceCents: CORRECTION_ADD_CENTS.coatingOnly,
        durationMin: 300,
      },
    ],
  },
  {
    id: "paint-polish",
    name: "Paint Polish",
    scope: "exterior",
    icon: "polisher",
    description: "One machine pass to lift light swirling and bring the gloss back.",
    note:
      "Swirl marks are thousands of fine scratches in the clear coat, usually from washing. A polish uses an abrasive on a machine pad to level a microscopic amount of clear coat down to the base of those scratches, so they stop catching light. It is removing material, which is why it is done sparingly and by someone who knows how much is there.",
    unavailable: true,
    unavailableNote: CORRECTION_SOON,
    tiers: [
      {
        id: "std",
        label: "1 step, with coating",
        priceCents: CORRECTION_ADD_CENTS.oneStep,
        durationMin: 12 * 60,
      },
    ],
  },
  {
    id: "paint-correction",
    name: "Paint Correction",
    scope: "exterior",
    icon: "correct",
    description: "Multi stage cutting and refining for deeper defects and etching.",
    note:
      "Correction is polishing taken further: a cutting compound removes the defect, then progressively finer passes remove the haze the cutting itself leaves behind. Two and three stage work is how you get a finish that holds up under direct light rather than only looking right in the shade.",
    unavailable: true,
    unavailableNote: CORRECTION_SOON,
    tiers: [
      {
        id: "two-step",
        label: "2 step, with coating",
        priceCents: CORRECTION_ADD_CENTS.twoStep,
        durationMin: 18 * 60,
      },
      {
        id: "three-step",
        label: "3 to 4 step, with coating",
        priceCents: CORRECTION_ADD_CENTS.threeStep,
        durationMin: 30 * 60,
      },
    ],
  },
];

/** Lowest priced tier, used to order the list. Unpriced sorts to the end. */
function fromCents(a: Addon): number {
  const priced = a.tiers.filter((t) => t.priceCents !== null).map((t) => t.priceCents as number);
  return priced.length ? Math.min(...priced) : Number.POSITIVE_INFINITY;
}

/**
 * Cheapest first, always.
 *
 * Sorting here rather than in each renderer means the front page, the funnel
 * and anything built later cannot disagree about the order, and a new add-on
 * lands in the right place the moment it is priced. Ties keep their declared
 * order, which groups the two $50s sensibly rather than alphabetically.
 */
export function addonsFor(scope: AddonScope): Addon[] {
  return ADDONS.filter((a) => a.scope === scope).sort((x, y) => fromCents(x) - fromCents(y));
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
  // Checked first: telling someone what is missing is pointless when the work
  // is already paid for inside the package they picked.
  if (a.includedIn && a.includedIn.packageIds.some((id) => ctx.packageIds.includes(id))) {
    return a.includedIn.message;
  }

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

/**
 * Plain explanation shown above the correction tiers.
 *
 * The "does not" half matters most. A coating gets sold as armour far too
 * often, and a customer who paid four figures expecting rock chip protection
 * has a fair complaint. Saying it up front costs one sentence and prevents
 * that conversation entirely.
 */
export const COATING_EXPLAINER = {
  heading: "What is a ceramic coating?",
  body:
    "A liquid polymer that chemically bonds to your clear coat and cures into a hard, glass-like layer. It is not a wax sitting on top that washes away in a few months, it becomes part of the surface and stays there for years.",
  does: [
    "Makes the paint strongly hydrophobic, so water beads up and rolls off instead of sheeting and drying into spots",
    "Keeps dirt, brake dust and road film from keying into the surface, so the car stays cleaner between washes and washes far faster",
    "Blocks UV, which is what oxidises and fades paint over time",
    "Resists the things that actually etch paint: bird droppings, bug guts, tree sap, road salt",
    "Adds real depth and gloss, and holds it rather than dulling after a month",
  ],
  doesNot: [
    "Stop rock chips. Nothing you can apply to paint does; a coating is microns thick and a stone at highway speed is not going to notice it",
    "Prevent dents, door dings or scratches deep enough to reach the clear coat",
    "Remove defects that are already there. Whatever the paint looks like when it goes on is what gets sealed in, which is why correction comes first",
    "Mean you never wash the car again. It means washing is quicker and the results last",
  ],
  /**
   * Answers "why does it cost that much" before it is asked. Almost all of
   * the price is hours, and correction cannot be rushed: it is levelling
   * paint by hand, in passes, checking under lights between each one.
   */
  timing: [
    "Coating only, about 9 hours. Wash, decontaminate, clay, panel wipe, then apply and level the coating by hand and let it cure.",
    "1 step correction, about 16 hours, usually across two days.",
    "2 step correction, about 22 hours, two to three days.",
    "3 to 4 step correction, about 34 hours, three to four days.",
  ],
  timingNote:
    "Nearly all of that is labour. Correction is levelling paint by hand, one pass at a time, checking under inspection lighting between each, and hard paint can add another 20 to 30% on top. The coating itself then has to be applied and levelled panel by panel before it flashes.",
  why:
    "Worth it if you keep your vehicles a while, park outside, or are tired of the paint looking tired. If you are about to sell, or the car lives in a garage and rarely gets dirty, a sealant is usually the better value.",
};

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
    addCents: CORRECTION_ADD_CENTS.coatingOnly,
    addMin: 5 * 60,
    result: "3 to 5 years of protection, no correction",
    detail:
      "Panel wipe, then coating applied and levelled by hand across paint, wheels, plastic trim and glass, and left to cure. Existing swirls and scratches stay as they are, sealed under the coating.",
    asterisk: true,
  },
  {
    id: "one-step",
    label: "1 step paint correction, then coating",
    addCents: CORRECTION_ADD_CENTS.oneStep,
    addMin: 12 * 60,
    result: "Looks perfect from about 5 feet away",
    detail:
      "One cutting and finishing pass lifts most light swirling and haze, then the coating goes on. Removes roughly 60 to 70% of visible defects.",
    asterisk: true,
  },
  {
    id: "two-step",
    label: "2 step paint correction, then coating",
    addCents: CORRECTION_ADD_CENTS.twoStep,
    addMin: 18 * 60,
    result: "Looks perfect from about 2 feet away",
    detail:
      "A compounding pass to cut deeper defects, then a refining pass to bring the gloss back, then the coating. Removes roughly 80 to 90%.",
    asterisk: true,
  },
  {
    id: "three-step",
    label: "3 to 4 step paint correction, then coating",
    addCents: CORRECTION_ADD_CENTS.threeStep,
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

// lib/catalog/addons.ts
var CORRECTION_ADD_CENTS = {
  coatingOnly: 55e3,
  /** Upgrade from the standard 3 to 5 year coating to a 7 year one. */
  sevenYear: 15e3,
  oneStep: 85e3,
  twoStep: 149500,
  threeStep: 225e3
};
var CORRECTION_SOON = "Temporarily unavailable.";
var ADDONS = [
  /* ---------------- interior ---------------- */
  {
    id: "pet-hair",
    name: "Pet Hair Removal",
    scope: "interior",
    icon: "paw",
    description: "Seats, carpets, and every crevice it has worked its way into.",
    note: "Pet hair does not vacuum out once it has woven into fabric. It gets lifted mechanically first, with rubber tools and a horsehair brush that drag the fibers back out of the weave, then vacuumed and gone over again. The second pass is where most of it actually comes out.",
    tiers: [
      {
        id: "std",
        label: "Pet hair removal",
        priceCents: 5e3,
        durationMin: 60,
        asterisk: "Quote may change upon inspection. Shorter, coarser fibers weave into fabric and take considerably longer to lift."
      }
    ]
  },
  {
    id: "stain",
    name: "Stain Treatment",
    scope: "interior",
    icon: "droplet",
    description: "Two levels. Pick the one that matches what you are dealing with.",
    note: "A stain is either sitting on the fibers or has soaked into them. Treatment breaks the bond so it can be agitated loose and wiped away, which handles anything on the surface. Removal goes further: heat and moisture pull what has soaked in back up out of the padding, and an extractor takes it away rather than pushing it deeper. That is why the deeper option costs more time, not just more product.",
    tiers: [
      {
        id: "minor",
        label: "Minor to moderate treatment",
        priceCents: 5e3,
        durationMin: 60,
        description: "Treatment, scrubbing and wipe reduction. Removes 70 to 90% of the stain."
      },
      {
        id: "major",
        label: "Moderate to major removal",
        priceCents: 1e4,
        durationMin: 120,
        description: "Treatment, scrubbing, upholstery extraction, 250 degree steaming and wipe removal. Removes 90 to 100% of the stain."
      }
    ]
  },
  {
    id: "steam",
    name: "Full Vehicle Steam Treatment",
    scope: "interior",
    icon: "steam",
    description: "Every safe surface sanitized and scrubbed with a steamer.",
    note: "Steam cleans with heat rather than chemicals. It softens grease and grime so it wipes off instead of being scrubbed at, gets into vents, seams and seat rails that no cloth reaches, and the heat kills bacteria on contact. Everything dries in minutes because there is very little water involved.",
    tiers: [{ id: "std", label: "Full vehicle", priceCents: 7500, durationMin: 90 }]
  },
  {
    id: "ozone",
    name: "Ozone Odor Reset",
    scope: "interior",
    icon: "molecule",
    description: "Ozone (O3) destroys the compounds causing the smell, not just the smell.",
    note: "A generator converts the oxygen in the air (O2) into ozone (O3). That extra atom is unstable, so it breaks away and oxidises odor molecules, bacteria and smoke residue on contact. Because it works as a gas it reaches the vents, headliner and seat foam that wiping cannot. It then reverts to ordinary oxygen and leaves nothing behind. The vehicle is sealed while it runs and aired out afterwards. Expect a 60 to 90% reduction in organic odors. It has to be paired with a stain treatment, or with a Full Interior or above, because ozone cannot remove what is still soaked into the fabric.",
    tiers: [{ id: "std", label: "Ozone treatment", priceCents: 5e3, durationMin: 60 }],
    // Ozone attacks what is left in the air and the plastics. Running it over
    // material that has not been extracted first mostly wastes the customer's
    // money, so it is gated rather than merely discouraged.
    requiresAnyPackageId: ["full-interior", "showroom-interior"],
    requiresAnyAddonTier: [{ addonId: "stain", tierIds: ["minor", "major"] }],
    requirementMessage: "Ozone needs the source removed first. Pair it with a stain treatment, or add it to a Full Interior or Showroom Ready."
  },
  {
    id: "seat-removal",
    name: "Seat Removal",
    scope: "interior",
    icon: "seat",
    description: "Front seats out, the floor underneath cleaned properly, then refitted.",
    note: "The worst of an interior collects under the seats, where a vacuum wand cannot reach past the rails. The battery is disconnected first so the airbag sensors in the seat are safe to unplug, the seats come out on their bolts, and the whole floor is cleaned properly before they go back in and get torqued to spec.",
    tiers: [{ id: "std", label: "Front seats out", priceCents: 1e4, durationMin: 120 }]
  },
  /* ---------------- exterior ---------------- */
  {
    id: "scratch-reduction",
    name: "Scratch and Ding Reduction",
    scope: "exterior",
    icon: "scratch",
    description: "Small nicks, dings and scratches reduced, not a full correction.",
    note: "Spot work on the places you point out, rather than a panel by panel correction of the whole vehicle. The area is cleaned and decontaminated, then the paint immediately around the mark is levelled with a compound and refined back to gloss so the scratch stops catching light. How much comes out depends entirely on depth. If you can catch a fingernail in it, it has gone through the clear coat, and nothing brings that back, because correction removes a little clear coat and cannot add any. Anything shallower usually disappears or drops to almost invisible. We will walk the car with you and tell you which of yours is which before we start.",
    // A full correction tier already levels the whole vehicle, so charging
    // for spot work on top of it is charging twice for the same pass.
    includedIn: {
      packageIds: ["showroom-exterior"],
      message: "Already covered by the correction tier on Showroom Ready Exterior."
    },
    tiers: [
      {
        id: "std",
        label: "Spot correction",
        priceCents: 15e3,
        durationMin: 120,
        asterisk: "Starting quote. It covers a handful of marks. More scratches and dings around the paint raise it, and we agree the number with you before any work starts."
      }
    ]
  },
  {
    id: "headlight",
    name: "Headlight Restoration",
    scope: "exterior",
    icon: "headlight",
    description: "Yellowing sanded off, clarity polished back, then ceramic coated.",
    note: "Headlights yellow because UV breaks down the factory coating on the outside of the plastic. Polishing alone buffs the haze off but leaves the plastic bare, so it clouds again within months. Sanding takes the damaged layer off properly, progressively finer grits bring the clarity back, and a ceramic coating replaces the UV protection that failed in the first place.",
    tiers: [{ id: "std", label: "Both headlights", priceCents: 7500, durationMin: 90 }]
  },
  {
    id: "tire-rim-shine",
    name: "Tire and Rim Shine",
    scope: "exterior",
    icon: "wheel",
    description: "Brake dust dissolved off the rims, tires cleaned and dressed.",
    note: "Brake dust is not dirt, it is hot metal particles that embed themselves into the wheel finish. A dedicated cleaner dissolves the iron so it rinses off instead of being scrubbed in, then the tire gets a dressing that blocks UV, which is what causes the browning and cracking on sidewalls.",
    includedIn: {
      packageIds: ["basic-exterior", "full-exterior", "showroom-exterior"],
      message: "Already included from Basic Exterior up. No need to add it."
    },
    tiers: [{ id: "std", label: "All four", priceCents: 3500, durationMin: 30 }]
  },
  {
    id: "paint-decon",
    name: "Paint Decontamination",
    scope: "exterior",
    icon: "spray",
    description: "Chemical decontamination to strip embedded iron and fallout.",
    note: "Paint that still feels rough after a wash is holding contamination the soap cannot lift: rail dust, industrial fallout and brake particles that have bonded to the clear coat. An iron remover dissolves them chemically. Skipping this before any polish or coating means grinding those particles into the paint.",
    includedIn: {
      packageIds: ["full-exterior", "showroom-exterior"],
      message: "Already included in Full Exterior. No need to add it."
    },
    tiers: [{ id: "std", label: "Full vehicle", priceCents: 4500, durationMin: 45 }]
  },
  {
    id: "clay-bar",
    name: "Clay Bar or Clay Towel",
    scope: "exterior",
    icon: "bar",
    description: "Lifts what chemical decon leaves behind, across every panel.",
    note: "Chemical decon handles metal particles; clay handles everything else, like overspray, tree sap residue and road film. It shears the bonded contamination off the surface as it glides, always on a wet panel so nothing gets dragged. The paint goes from feeling like fine sandpaper to feeling like glass.",
    includedIn: {
      packageIds: ["full-exterior", "showroom-exterior"],
      message: "Already included in Full Exterior. No need to add it."
    },
    // Claying paint that has not been chemically decontaminated first drags
    // bonded iron across the clear coat, so the two are sold together, the
    // same way ozone is gated behind stain work.
    requiresAnyAddonTier: [{ addonId: "paint-decon", tierIds: ["std"] }],
    requirementMessage: "Clay goes on after the chemical decontamination, never before it. Add Paint Decontamination first, or step up to Full Exterior, which includes both.",
    tiers: [{ id: "std", label: "All panels", priceCents: 4500, durationMin: 60 }]
  },
  {
    id: "hard-water",
    name: "Hard Water Spot Removal",
    scope: "exterior",
    icon: "spots",
    description: "For etched sprinkler and well water spotting on paint and glass.",
    note: "Hard water leaves dissolved minerals behind when it dries, and in sun those minerals etch a ring into the clear coat. Caught early a mild acid dissolves them off. Left long enough the etching is physical damage in the paint and needs polishing out, which is a correction job rather than this one.",
    includedIn: {
      packageIds: ["full-exterior", "showroom-exterior"],
      message: "Already included in Full Exterior. No need to add it."
    },
    tiers: [{ id: "std", label: "Full vehicle", priceCents: 5e3, durationMin: 60 }]
  },
  {
    id: "engine-bay",
    name: "Engine Bay Detail",
    scope: "exterior",
    icon: "engine",
    description: "Degreased by hand, blown dry, then dressed and protected.",
    note: "Sensitive electronics get covered first, then a degreaser is left to dwell and agitated by hand rather than blasted with a pressure washer, which is how water finds its way into connectors. Everything is blown dry and the plastics and hoses get a dressing that stops them fading and cracking under engine heat.",
    includedIn: {
      packageIds: ["full-exterior", "showroom-exterior"],
      message: "Already included in Full Exterior. No need to add it."
    },
    tiers: [{ id: "std", label: "Engine bay", priceCents: 5e3, durationMin: 30 }]
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
    note: "A sprayable ceramic infused wax that bonds to the clear coat and leaves a slick, hydrophobic layer. Water beads and rolls off instead of sheeting and drying into spots, and dirt struggles to key onto the surface, so the car stays cleaner between washes. This is not a ceramic coating: a coating cures hard, lasts years, and needs the paint corrected first. This goes on in under an hour, lasts about six months, and can be topped up whenever you like.",
    includedIn: {
      packageIds: ["full-exterior", "showroom-exterior"],
      message: "Already included in Full Exterior. No need to add it."
    },
    tiers: [{ id: "std", label: "Full vehicle", priceCents: 3500, durationMin: 45 }]
  },
  {
    id: "ceramic-coating",
    name: "Ceramic Coating",
    scope: "exterior",
    icon: "gem",
    description: "3 to 5 years of protection with proper maintenance, bonded to the clear coat.",
    note: "A real coating cures into a hard glass-like layer chemically bonded to the clear coat, which is why it lasts years rather than months. It also locks in whatever the paint looks like at the time, so any swirls underneath are sealed in with it. That is why coatings are sold with correction rather than on their own, and why this one lives inside Showroom Ready Exterior.",
    unavailable: true,
    unavailableNote: "Booked through Showroom Ready Exterior, which includes the prep a coating needs.",
    tiers: [
      {
        id: "std",
        label: "3 to 5 year coating, no correction",
        priceCents: CORRECTION_ADD_CENTS.coatingOnly,
        durationMin: 300
      },
      {
        id: "7yr",
        label: "7 year coating, no correction",
        priceCents: CORRECTION_ADD_CENTS.coatingOnly + CORRECTION_ADD_CENTS.sevenYear,
        // A longer life coating is a thicker, harder product with a longer
        // cure, not the same bottle sold twice.
        durationMin: 360
      }
    ]
  },
  {
    id: "paint-polish",
    name: "Paint Polish",
    scope: "exterior",
    icon: "polisher",
    description: "One machine pass to lift light swirling and bring the gloss back.",
    note: "Swirl marks are thousands of fine scratches in the clear coat, usually from washing. A polish uses an abrasive on a machine pad to level a microscopic amount of clear coat down to the base of those scratches, so they stop catching light. It is removing material, which is why it is done sparingly and by someone who knows how much is there.",
    unavailable: true,
    unavailableNote: CORRECTION_SOON,
    tiers: [
      {
        id: "std",
        label: "1 step, with coating",
        priceCents: CORRECTION_ADD_CENTS.oneStep,
        durationMin: 12 * 60
      }
    ]
  },
  {
    id: "paint-correction",
    name: "Paint Correction",
    scope: "exterior",
    icon: "correct",
    description: "Multi stage cutting and refining for deeper defects and etching.",
    note: "Correction is polishing taken further: a cutting compound removes the defect, then progressively finer passes remove the haze the cutting itself leaves behind. Two and three stage work is how you get a finish that holds up under direct light rather than only looking right in the shade.",
    unavailable: true,
    unavailableNote: CORRECTION_SOON,
    tiers: [
      {
        id: "two-step",
        label: "2 step, with coating",
        priceCents: CORRECTION_ADD_CENTS.twoStep,
        durationMin: 18 * 60
      },
      {
        id: "three-step",
        label: "3 to 4 step, with coating",
        priceCents: CORRECTION_ADD_CENTS.threeStep,
        durationMin: 30 * 60
      }
    ]
  }
];
function fromCents(a) {
  const priced = a.tiers.filter((t) => t.priceCents !== null).map((t) => t.priceCents);
  return priced.length ? Math.min(...priced) : Number.POSITIVE_INFINITY;
}
function addonsFor(scope) {
  return ADDONS.filter((a) => a.scope === scope).sort((x, y) => fromCents(x) - fromCents(y));
}
function findAddon(id) {
  return ADDONS.find((a) => a.id === id);
}
function isUnpriced(a) {
  return a.tiers.every((t) => t.priceCents === null);
}
function isSelectable(a) {
  return !a.unavailable && !isUnpriced(a);
}
function unavailableReason(a) {
  if (a.unavailable) return a.unavailableNote ?? "Temporarily unavailable.";
  if (isUnpriced(a)) return "Price on request, ask us and we will quote it.";
  return null;
}
var COATING_COVERAGE = "Every coating covers the whole vehicle: paint, wheels, plastic trim and glass.";
var COATING_EXPLAINER = {
  heading: "What is a ceramic coating?",
  body: "A liquid polymer that chemically bonds to your clear coat and cures into a hard, glass-like layer. It is not a wax sitting on top that washes away in a few months, it becomes part of the surface and stays there for years.",
  does: [
    "Makes the paint strongly hydrophobic, so water beads up and rolls off instead of sheeting and drying into spots",
    "Keeps dirt, brake dust and road film from keying into the surface, so the car stays cleaner between washes and washes far faster",
    "Blocks UV, which is what oxidises and fades paint over time",
    "Resists the things that actually etch paint: bird droppings, bug guts, tree sap, road salt",
    "Adds real depth and gloss, and holds it rather than dulling after a month"
  ],
  doesNot: [
    "Stop rock chips. Nothing you can apply to paint does; a coating is microns thick and a stone at highway speed is not going to notice it",
    "Prevent dents, door dings or scratches deep enough to reach the clear coat",
    "Remove defects that are already there. Whatever the paint looks like when it goes on is what gets sealed in, which is why correction comes first",
    "Mean you never wash the car again. It means washing is quicker and the results last"
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
    "3 to 4 step correction, about 34 hours, three to four days."
  ],
  timingNote: "Nearly all of that is labour. Correction is levelling paint by hand, one pass at a time, checking under inspection lighting between each, and hard paint can add another 20 to 30% on top. The coating itself then has to be applied and levelled panel by panel before it flashes.",
  why: "Worth it if you keep your vehicles a while, park outside, or are tired of the paint looking tired. If you are about to sell, or the car lives in a garage and rarely gets dirty, a sealant is usually the better value."
};
var CORRECTION_TIERS = [
  {
    id: "coating-only",
    label: "Ceramic coating only",
    addCents: CORRECTION_ADD_CENTS.coatingOnly,
    addMin: 5 * 60,
    result: "3 to 5 years of protection, no correction",
    detail: "Panel wipe, then coating applied and levelled by hand across paint, wheels, plastic trim and glass, and left to cure. Existing swirls and scratches stay as they are, sealed under the coating.",
    asterisk: true
  },
  {
    id: "one-step",
    label: "1 step paint correction, then coating",
    addCents: CORRECTION_ADD_CENTS.oneStep,
    addMin: 12 * 60,
    result: "Looks perfect from about 5 feet away",
    detail: "One cutting and finishing pass lifts most light swirling and haze, then the coating goes on. Removes roughly 60 to 70% of visible defects.",
    asterisk: true
  },
  {
    id: "two-step",
    label: "2 step paint correction, then coating",
    addCents: CORRECTION_ADD_CENTS.twoStep,
    addMin: 18 * 60,
    result: "Looks perfect from about 2 feet away",
    detail: "A compounding pass to cut deeper defects, then a refining pass to bring the gloss back, then the coating. Removes roughly 80 to 90%.",
    asterisk: true
  },
  {
    id: "three-step",
    label: "3 to 4 step paint correction, then coating",
    addCents: CORRECTION_ADD_CENTS.threeStep,
    addMin: 30 * 60,
    result: "Removes 90%+ of all defects, reflective trim included",
    detail: "Heavy cut, refine, then a final jewelling pass under inspection lighting before coating, with a fourth pass where the paint needs it. Reflective trim is corrected and coated alongside the paint. This is show car work and runs across several days.",
    asterisk: false
  }
];
var COATING_TERMS = [
  { id: "3yr", label: "3 to 5 year", addCents: 0, asterisk: true },
  { id: "7yr", label: "7 year", addCents: CORRECTION_ADD_CENTS.sevenYear, asterisk: true },
  { id: "10yr", label: "10 year", addCents: 3e4, asterisk: true }
];
var CORRECTION_RULES = {
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
   * Kept for the shape of an old booking record. NOT used for scheduling any
   * more: a long job is planned across consecutive days by planDays in
   * lib/availability/multiDay.ts, rather than having its first morning
   * booked and the rest left to a phone call.
   */
  firstDayMin: 8 * 60,
  garageRequired: true,
  canopyCents: 5e3,
  canopyNote: "Correction and coating need a controlled space: no direct sun, no wind, no dust settling on wet coating. If you do not have a garage we bring a canopy.",
  asteriskNote: "With proper maintenance: washing the vehicle monthly at minimum, and refreshing the coating with a sacrificial sealant annually."
};
var MAINTENANCE_PLAN = {
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
    "Sealant application twice a year"
  ]
};
function findCorrectionTier(id) {
  return CORRECTION_TIERS.find((t) => t.id === id);
}
function findCoatingTerm(id) {
  return COATING_TERMS.find((t) => t.id === id);
}

// lib/catalog/seed.ts
var VEHICLE_SIZES = [
  { id: "small", label: "Small", examples: "Sedan, coupe, hatchback", upchargeCents: 0 },
  { id: "medium", label: "Medium", examples: "SUV, truck, crossover", upchargeCents: 1e3 },
  { id: "large", label: "Large", examples: "3 row SUV, 7+ passenger van", upchargeCents: 2500 }
];
var c = (id, name, category, durationMin, removable = true) => ({
  id,
  name,
  category,
  durationMin,
  valueCents: null,
  materialsCostCents: null,
  removable
});
var COMPONENTS = [
  /* ---- interior: basic ---- */
  c("int-blowout", "Blowout and vacuum of seats, carpet and trunk", "interior", 45, false),
  c("int-mats-clean", "Clean floor mats", "interior", 15),
  c("int-surfaces", "Clean surfaces", "interior", 20),
  c("int-grime", "Remove major interior grime", "interior", 30),
  /* ---- interior: full ---- */
  c("int-vac-deep", "Thorough vacuum of seats, carpet and trunk", "interior", 45, false),
  c("int-engrained", "Remove engrained particles", "interior", 40),
  c("int-shampoo", "Shampoo scrub upholstery", "interior", 60),
  c("int-mats-dress", "Wash and dress floor mats", "interior", 20),
  c("int-leather", "Condition leather", "interior", 30),
  c("int-glass", "Clean glass", "interior", 15),
  c("int-jams", "Clean door jams", "interior", 15),
  c("int-crevice", "Brush detail every crack and crevice", "interior", 45),
  /* ---- interior: showroom ---- */
  c("int-steam-full", "Full upholstery and applicable trim steam treatment", "interior", 60),
  c("int-fiber-removal", "Individual removal of engrained fibers in upholstery", "interior", 90),
  c("int-mat-protect", "Floor mat water resistant protection", "interior", 20),
  c("int-trim-ceramic", "Full trim ceramic sealant coating and protection", "interior", 45),
  c("int-metal-ceramic", "Ceramic sealant protection of all interior metal and paint", "interior", 45),
  /* ---- exterior ---- */
  c("ext-rinse-hubcaps", "Rinse exterior and scrub hubcaps", "exterior", 15, false),
  c("ext-prewash", "Pre-wash", "exterior", 15, false),
  c("ext-bug", "Bug removal", "exterior", 20),
  c("ext-handwash-gentle", "Gentle hand wash", "exterior", 25, false),
  c("ext-handwash", "Hand wash", "exterior", 30, false),
  c("ext-windows", "Clean windows and mirrors", "exterior", 10),
  c("ext-towel-dry", "Towel dry all surfaces", "exterior", 15),
  c("ext-blow-towel", "Blow dry and towel dry", "exterior", 20),
  c("ext-wheels", "Wheels: hubcaps, tires and wheel wells scrubbed", "exterior", 30),
  c("ext-tire-dress", "Tire dressing", "exterior", 10),
  c("ext-paint-decon", "Paint decontamination", "exterior", 45),
  c("ext-clay-towel", "Clay towel", "exterior", 30),
  c("ext-water-spot", "Hard water spot treatment", "exterior", 30),
  c("ext-engine-bay", "Engine bay clean and protect", "exterior", 30),
  c("ext-ceramic", "Ceramic wax sealant applied", "exterior", 45)
];
var BASIC_INT_IDS = ["int-blowout", "int-mats-clean", "int-surfaces", "int-grime"];
var FULL_INT_IDS = [
  "int-vac-deep",
  "int-engrained",
  "int-shampoo",
  "int-mats-dress",
  "int-leather",
  "int-glass",
  "int-jams",
  "int-crevice"
];
var BASIC_EXT_IDS = [
  "ext-prewash",
  "ext-bug",
  "ext-handwash",
  "ext-blow-towel",
  "ext-wheels",
  "ext-tire-dress"
];
var PACKAGES = [
  /* ---------------- interior ---------------- */
  {
    id: "maintenance-interior",
    slug: "maintenance-interior",
    name: "Maintenance",
    category: "interior",
    tagline: "Keeps a already-detailed car right, at a lower price.",
    note: "The same work as a Basic Interior, priced lower because a car detailed a month or two ago has far less built up in it. It resets the everyday mess: crumbs, dust, fingerprints, mats. It does NOT include shampooing, stain work or anything deep, because there should not be anything deep left. If it has been longer than three months, or something has been spilled since, start from Basic or Full instead.",
    priceCents: 9500,
    durationMin: 105,
    componentIds: [...BASIC_INT_IDS],
    featured: false,
    sortOrder: 0,
    /** Returning customers only, 1 to 3 months after a previous detail. */
    requiresPriorDetail: { minMonths: 1, maxMonths: 3 }
  },
  {
    id: "basic-interior",
    slug: "basic-interior",
    name: "Basic Interior",
    category: "interior",
    tagline: "A solid clean that gets the everyday grime out.",
    note: "A blowout and thorough vacuum through the seats, carpet and trunk, mats cleaned, surfaces wiped down, and the visible grime taken off. The car looks and feels clean when you get back in it. It does NOT shampoo or extract the upholstery, treat set-in stains, condition leather, or brush out every seam and crevice. A vacuum and air compressor blow out alone does not lift what has worked its way down into the upholstery, so engrained fibers, pet hair and grit in the carpet will not all come out, and stains already in the fabric will still be there. Most will come out with a Full Interior, or with Basic plus pet hair removal, a stain treatment, or both.",
    priceCents: 12500,
    durationMin: 120,
    componentIds: [...BASIC_INT_IDS],
    featured: false,
    sortOrder: 1
  },
  {
    id: "full-interior",
    slug: "full-interior",
    name: "Full Interior",
    category: "interior",
    tagline: "A deep, top to bottom detail that makes it feel new again.",
    note: "Everything in Basic, then the deep work: engrained particles pulled out of the carpet, upholstery shampooed and scrubbed, mats washed and dressed, leather conditioned, glass and door jams cleaned, and every crack and crevice brush detailed. Stain reduction is part of it. It does NOT guarantee a stain comes out completely, steam sanitize the whole vehicle, or remove the seats to get underneath them. Most engrained fibers and pet hair come out at this level, but the truly stubborn ones woven deep into the carpet backing need the individual fiber lifting in Showroom Ready. Deep set stains want the extraction add-on and lingering smells want ozone.",
    priceCents: 21500,
    durationMin: 240,
    componentIds: [...FULL_INT_IDS],
    featured: true,
    sortOrder: 2
  },
  {
    id: "showroom-interior",
    slug: "showroom-interior",
    name: "Showroom Ready",
    category: "interior",
    tagline: "Everything in Full, taken to its limit.",
    note: "Everything in Full, then taken as far as an interior goes: the whole cabin steamed and sanitized, engrained fibers lifted out individually rather than vacuumed at, floor mats given a water resistant treatment, and a ceramic coating on the trim and on the interior metal and paint so it stays this way. It does NOT repair damage. Tears, burns, cracked trim and worn out material are still tears, burns, cracked trim and worn out material. This makes everything that is there as good as it can get.",
    priceCents: 39500,
    durationMin: 420,
    // 6 to 8 hours, quoted at 7
    durationMaxMin: 480,
    componentIds: [
      ...FULL_INT_IDS,
      "int-steam-full",
      "int-fiber-removal",
      "int-mat-protect",
      "int-trim-ceramic",
      "int-metal-ceramic"
    ],
    featured: false,
    sortOrder: 3,
    supersetOf: "full-interior",
    pricePlus: true
  },
  /* ---------------- exterior ---------------- */
  {
    id: "express-exterior",
    slug: "express-exterior",
    name: "Express Exterior",
    category: "exterior",
    tagline: "A clean hand wash and dry to bring back the shine.",
    note: "A rinse, hubcaps scrubbed, a gentle hand wash and a towel dry, with the windows and mirrors cleaned. It takes the surface dirt off and it is quick. It does NOT decontaminate or clay the paint, dress the tires, touch the engine bay, or leave any protection behind. The paint will still feel rough to the touch afterwards, because a wash cannot remove what is bonded to it.",
    priceCents: 7500,
    durationMin: 75,
    componentIds: ["ext-rinse-hubcaps", "ext-handwash-gentle", "ext-windows", "ext-towel-dry"],
    featured: false,
    sortOrder: 1
  },
  {
    id: "basic-exterior",
    slug: "basic-exterior",
    name: "Basic Exterior",
    category: "exterior",
    tagline: "A thorough hand wash with wheels and tires done properly.",
    note: "A pre-wash to lift the loose grit before anything touches the paint, bug removal, a proper hand wash, blow dry and towel dry, and the wheels done properly: hubcaps, tires and wheel wells scrubbed, then tires dressed. It does NOT decontaminate or clay the paint, remove water spotting, clean the engine bay, or leave a ceramic wax sealant on it. The paint is clean but still not smooth, and there is no lasting protection. That is the step up to Full.",
    priceCents: 12500,
    durationMin: 120,
    componentIds: [...BASIC_EXT_IDS],
    featured: true,
    sortOrder: 2
  },
  {
    id: "full-exterior",
    slug: "full-exterior",
    name: "Full Exterior",
    category: "exterior",
    tagline: "Strips what a wash cannot reach, then protects the paint underneath. Decontaminated, clayed, engine bay cleaned and finished with a ceramic wax sealant.",
    note: "Everything in Basic, then the paint is actually decontaminated: iron and fallout dissolved chemically, a clay towel to shear off what is left, hard water spotting treated, the engine bay cleaned and protected, and a ceramic wax sealant applied so water beads and dirt struggles to stick. It does NOT correct the paint. Swirl marks, scratches and etching stay exactly as they are, and the sealant goes on over the top of them. Removing those means machine polishing, which is Showroom Ready.",
    priceCents: 24500,
    durationMin: 240,
    componentIds: [
      ...BASIC_EXT_IDS,
      "ext-paint-decon",
      "ext-clay-towel",
      "ext-water-spot",
      "ext-engine-bay",
      "ext-ceramic"
    ],
    featured: false,
    sortOrder: 3,
    supersetOf: "basic-exterior"
  },
  {
    id: "showroom-exterior",
    slug: "showroom-exterior",
    // Spelled out because "Showroom Ready" alone reads as a deeper wash next
    // to the interior package of the same name, and this is neither the same
    // work nor the same order of price.
    name: "Showroom Ready (Paint Correction and Protection)",
    category: "exterior",
    // Everything in Full Exterior, then a required correction or coating
    // tier on top. The base here is the Full Exterior work; the tier adds its
    // own price and hours. See CORRECTION_TIERS in ./addons.ts.
    tagline: "Everything in Full Exterior, then the swirls come out and a real ceramic coating goes on. Pick how far to take it below.",
    note: "Everything in Full Exterior, then the paint is machine corrected and a durable ceramic coating goes on the paint, wheels, plastic trim and glass. How much correction depends on the tier you pick below. It does NOT repair physical damage. Dents, rock chips and any scratch deep enough to have gone through the clear coat cannot be polished out, because correction removes a little clear coat, it does not add any. We will tell you what will and will not come out before we start.",
    priceCents: 24500,
    durationMin: 240,
    requiresCorrectionTier: true,
    // Not taking these yet. Listed with a price and an explanation so people
    // can see it is coming and say they want it.
    comingSoon: true,
    comingSoonNote: "We are building up to correction work. Register your interest and we will come to you first when it opens.",
    schedulingDurationMin: 480,
    componentIds: [
      ...BASIC_EXT_IDS,
      "ext-paint-decon",
      "ext-clay-towel",
      "ext-water-spot",
      "ext-engine-bay",
      "ext-ceramic"
    ],
    featured: false,
    sortOrder: 4,
    supersetOf: "full-exterior",
    pricePlus: true
  }
];
var SEED_CATALOG = {
  components: Object.fromEntries(COMPONENTS.map((x) => [x.id, x])),
  packages: PACKAGES
};
function packagesFor(category) {
  return SEED_CATALOG.packages.filter((p) => p.category === category).sort((a, b) => a.sortOrder - b.sortOrder);
}
function findPackage(id) {
  return SEED_CATALOG.packages.find((p) => p.id === id);
}
function vehicleSize(id) {
  return VEHICLE_SIZES.find((v) => v.id === id);
}

// lib/catalog/types.ts
function componentsOf(pkg, catalog) {
  return pkg.componentIds.map((id) => catalog.components[id]).filter((c2) => c2 !== void 0);
}

// lib/pricing/rules.ts
var DEFAULT_RULES = {
  mileage: {
    freeMinutes: 10,
    tier1RateCents: 100,
    // $1.00/min
    tier2StartMin: 30,
    tier2BaseCents: 2e3,
    // $20 accumulated at 30 min
    tier2RateCents: 150,
    // $1.50/min
    roundToCents: 500,
    // $5
    roundDownBelowMin: 20,
    roundNearestBelowMin: 30
  },
  surcharge: {
    earlyBeforeMinutes: 10 * 60,
    // before 10:00 (10:00 itself is not premium)
    lateFromMinutes: 18 * 60,
    // 18:00 onward, so a 6:00 PM start IS premium
    timeOfDayBp: 2e3,
    // +20%
    priorityBp: 2e3,
    // +20%
    maxTotalBp: 3e3
    // 20% each, +30% when both apply
  },
  window: {
    minLeadDays: 3
  },
  comboDiscountCents: 2500,
  // $25 for interior and exterior together
  comboPerVehicle: true,
  additionalVehicleDiscountBp: 1e3,
  // 10% off everything at 2+ vehicles
  addonRateCents: 5e3,
  // $50/hr
  addonMinHours: 1,
  depositBp: 0,
  // no deposit; a card on file confirms the slot
  payInFullDiscountBp: 500,
  // 5% for paying in full at booking
  payAfterMaxCents: 19500,
  // $195
  cancellationFlatFeeCents: 2500,
  // $25
  refundMidWindowBp: 5e3,
  // 50% of deposit
  cancelMidWindowBp: 5e3,
  // 24 to 72 hrs: half the booking
  cancelLateWindowBp: 1e4,
  // under 24 hrs: the whole booking
  lateRescheduleFeeBp: 1e3,
  // 10% per late move, FLAT, never compounding
  rescheduleCreditDays: 30,
  shortNoticeChangeBp: 2e3,
  // 20%, same as priority booking
  refundFullWindowHours: 72,
  refundMidWindowHours: 24
};
var MAX_BOOKING_CENTS = 75e4;

// lib/pricing/tax.ts
var SEED_TAX_TABLE = {
  ratesStaleAfter: 2026,
  fallbackRateBp: 780,
  // Hamilton County, the busiest by far
  rates: [
    { county: "hamilton", state: "OH", rateBp: 780, verifiedYear: 2026 },
    { county: "butler", state: "OH", rateBp: 650, verifiedYear: 2026 },
    { county: "warren", state: "OH", rateBp: 675, verifiedYear: 2026 },
    { county: "clermont", state: "OH", rateBp: 675, verifiedYear: 2026 },
    { county: "montgomery", state: "OH", rateBp: 750, verifiedYear: 2026 },
    // KY: 6% statewide, no local sales tax.
    { county: "kenton", state: "KY", rateBp: 600, verifiedYear: 2026 },
    { county: "campbell", state: "KY", rateBp: 600, verifiedYear: 2026 },
    { county: "boone", state: "KY", rateBp: 600, verifiedYear: 2026 },
    // IN: 7% statewide, no local sales tax.
    { county: "dearborn", state: "IN", rateBp: 700, verifiedYear: 2026 },
    { county: "franklin", state: "IN", rateBp: 700, verifiedYear: 2026 },
    { county: "ripley", state: "IN", rateBp: 700, verifiedYear: 2026 }
  ],
  zipToCounty: {
    // Hamilton County, OH
    "451": { county: "hamilton", state: "OH" },
    "452": { county: "hamilton", state: "OH" },
    // Butler / Warren / Clermont, OH
    "450": { county: "butler", state: "OH" },
    "raw-45036": { county: "warren", state: "OH" },
    "raw-45103": { county: "clermont", state: "OH" },
    // Montgomery, OH
    "454": { county: "montgomery", state: "OH" },
    // N. Kentucky
    "410": { county: "kenton", state: "KY" },
    "she-41011": { county: "kenton", state: "KY" },
    "raw-41071": { county: "campbell", state: "KY" },
    "raw-41042": { county: "boone", state: "KY" },
    // SE Indiana
    "470": { county: "dearborn", state: "IN" }
  }
};
function lookupRate(zip, table, currentYear) {
  const clean = (zip || "").trim().slice(0, 5);
  const exact = table.zipToCounty["raw-" + clean];
  const prefix = table.zipToCounty[clean.slice(0, 3)];
  const hit = exact ?? prefix;
  const stale = currentYear > table.ratesStaleAfter;
  if (!hit) {
    return { rateBp: table.fallbackRateBp, county: null, state: null, usedFallback: true, stale };
  }
  const row = table.rates.find((r) => r.county === hit.county && r.state === hit.state);
  if (!row) {
    return { rateBp: table.fallbackRateBp, county: hit.county, state: hit.state, usedFallback: true, stale };
  }
  return { rateBp: row.rateBp, county: row.county, state: row.state, usedFallback: false, stale };
}
function computeTax(taxableBaseCents, zip, table, currentYear) {
  const r = lookupRate(zip, table, currentYear);
  return {
    ...r,
    taxCents: Math.round(taxableBaseCents * r.rateBp / 1e4)
  };
}

// lib/time/zone.ts
function zoneOffsetMs(utcMs, timeZone) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
  const parts = dtf.formatToParts(new Date(utcMs));
  const get = (type) => {
    const p = parts.find((x) => x.type === type);
    return p ? Number(p.value) : 0;
  };
  const asIfUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second")
  );
  return asIfUtc - utcMs;
}
function zonedToUtc(y, mo, d, h, mi, s, timeZone) {
  const guess = Date.UTC(y, mo - 1, d, h, mi, s);
  const off1 = zoneOffsetMs(guess, timeZone);
  const once = guess - off1;
  const off2 = zoneOffsetMs(once, timeZone);
  const twice = guess - off2;
  if (off1 === off2) return twice;
  const off3 = zoneOffsetMs(twice, timeZone);
  if (off3 === off2) return twice;
  return guess - Math.min(off2, off3);
}
function localParts(ms, timeZone) {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const [y, mo, d] = dtf.format(new Date(ms)).split("-").map(Number);
  return { y, mo, d };
}
function localDayStart(ms, timeZone) {
  const { y, mo, d } = localParts(ms, timeZone);
  return zonedToUtc(y, mo, d, 0, 0, 0, timeZone);
}

// lib/pricing/surcharge.ts
function computeSurcharge(ctx, r) {
  const isEarlyOrLate = ctx.startMinutesLocal < r.earlyBeforeMinutes || ctx.startMinutesLocal >= r.lateFromMinutes;
  const timeOfDayBp = isEarlyOrLate ? r.timeOfDayBp : 0;
  const priorityBp = ctx.priorityBooking ? r.priorityBp : 0;
  const uncapped = timeOfDayBp + priorityBp;
  const appliedBp = Math.min(uncapped, r.maxTotalBp);
  return { timeOfDayBp, priorityBp, appliedBp, capped: uncapped > r.maxTotalBp };
}
function applySurchargeCents(baseCents, appliedBp) {
  return Math.round(baseCents * appliedBp / 1e4);
}
function slotNeedsPriority(slotMs, nowMs, r, timeZone = "America/New_York") {
  if (!Number.isFinite(slotMs) || !Number.isFinite(nowMs)) return false;
  const dayIndex = (ms) => Math.round(localDayStart(ms, timeZone) / 864e5);
  return dayIndex(slotMs) < dayIndex(nowMs) + r.minLeadDays;
}

// lib/availability/slots.ts
var DEFAULT_BOOKING_WINDOW = {
  earliestStartMin: 6 * 60,
  // 10pm. Which does NOT mean any job can start at 10pm: serviceEndByMin
  // still has to be met, so a 10pm start is only ever available to a job of
  // two hours or less. The rule falls out of the arithmetic rather than
  // needing a clause of its own.
  latestStartMin: 22 * 60,
  serviceEndByMin: 24 * 60,
  // Washing a car you cannot see is how panels get missed and paint gets
  // marred. Exterior work has a harder cut-off than interior work.
  latestExteriorStartMin: 20 * 60
};
var IGNORE_RETURN_AFTER_MIN = 18 * 60;
var TIME_BANDS = [
  {
    id: "early",
    label: "Early Morning",
    fromMin: 6 * 60,
    toMin: 10 * 60,
    premium: true,
    preferMin: 8 * 60,
    range: "6am to 10am"
  },
  {
    id: "midday",
    label: "Midday",
    fromMin: 10 * 60,
    toMin: 14 * 60,
    premium: false,
    preferMin: 10 * 60,
    range: "10am to 2pm"
  },
  {
    id: "afternoon",
    label: "Afternoon",
    fromMin: 14 * 60,
    toMin: 18 * 60,
    premium: false,
    preferMin: 16 * 60,
    range: "2pm to 6pm"
  },
  {
    id: "evening",
    label: "Late Evening",
    fromMin: 18 * 60,
    // Exclusive, and a 10pm start is allowed, so this is a minute past it.
    toMin: 22 * 60 + 1,
    premium: true,
    // Earliest in the band rather than a fixed hour: a late job should be as
    // early as it can be, not as late as it is allowed to be.
    preferMin: 18 * 60,
    range: "6pm to 10pm"
  }
];
function localMinutesOfDay(ms, timeZone = "America/New_York") {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(new Date(ms));
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return h % 24 * 60 + m;
}

// lib/travel/zipRanges.ts
var MAX_ONE_WAY_MINUTES = 12 * 60;
var ZIP_RANGES = [
  // Cincinnati core
  { zip: "45220", area: "Clifton", minMin: 2, maxMin: 8 },
  { zip: "45219", area: "Corryville, UC", minMin: 3, maxMin: 9 },
  { zip: "45216", area: "Elmwood Place", minMin: 6, maxMin: 12 },
  { zip: "45217", area: "St Bernard", minMin: 6, maxMin: 12 },
  { zip: "45223", area: "Northside", minMin: 5, maxMin: 11 },
  { zip: "45225", area: "Camp Washington", minMin: 5, maxMin: 11 },
  { zip: "45232", area: "Winton Place", minMin: 7, maxMin: 13 },
  { zip: "45229", area: "Avondale", minMin: 5, maxMin: 11 },
  { zip: "45206", area: "Walnut Hills", minMin: 7, maxMin: 13 },
  { zip: "45207", area: "Evanston", minMin: 8, maxMin: 14 },
  { zip: "45212", area: "Norwood", minMin: 8, maxMin: 15 },
  { zip: "45202", area: "Downtown, OTR", minMin: 9, maxMin: 16 },
  { zip: "45214", area: "West End", minMin: 8, maxMin: 15 },
  { zip: "45224", area: "College Hill", minMin: 9, maxMin: 16 },
  { zip: "45237", area: "Bond Hill, Roselawn", minMin: 9, maxMin: 16 },
  { zip: "45208", area: "Hyde Park", minMin: 11, maxMin: 18 },
  { zip: "45209", area: "Oakley", minMin: 10, maxMin: 17 },
  { zip: "45213", area: "Pleasant Ridge", minMin: 12, maxMin: 18 },
  { zip: "45226", area: "Mount Lookout", minMin: 13, maxMin: 20 },
  { zip: "45227", area: "Madeira, Mariemont", minMin: 15, maxMin: 23 },
  { zip: "45215", area: "Reading, Wyoming", minMin: 12, maxMin: 19 },
  { zip: "45211", area: "Westwood", minMin: 12, maxMin: 20 },
  { zip: "45238", area: "Delhi, Price Hill", minMin: 14, maxMin: 23 },
  { zip: "45239", area: "Monfort Heights", minMin: 13, maxMin: 21 },
  { zip: "45231", area: "Mount Healthy", minMin: 13, maxMin: 21 },
  { zip: "45230", area: "Anderson", minMin: 17, maxMin: 26 },
  { zip: "45233", area: "Sayler Park", minMin: 18, maxMin: 27 },
  { zip: "45236", area: "Kenwood, Deer Park", minMin: 14, maxMin: 21 },
  { zip: "45243", area: "Indian Hill", minMin: 17, maxMin: 25 },
  { zip: "45244", area: "Newtown", minMin: 18, maxMin: 27 },
  { zip: "45245", area: "Batavia", minMin: 25, maxMin: 35 },
  { zip: "45255", area: "Cherry Grove", minMin: 20, maxMin: 29 },
  { zip: "45240", area: "Forest Park", minMin: 16, maxMin: 24 },
  { zip: "45246", area: "Springdale", minMin: 16, maxMin: 24 },
  { zip: "45241", area: "Sharonville", minMin: 17, maxMin: 26 },
  { zip: "45242", area: "Blue Ash", minMin: 17, maxMin: 26 },
  { zip: "45249", area: "Symmes", minMin: 21, maxMin: 30 },
  { zip: "45247", area: "Bridgetown", minMin: 16, maxMin: 25 },
  { zip: "45248", area: "Dent", minMin: 17, maxMin: 26 },
  { zip: "45251", area: "Colerain", minMin: 15, maxMin: 24 },
  { zip: "45252", area: "Groesbeck", minMin: 16, maxMin: 25 },
  { zip: "45150", area: "Milford", minMin: 22, maxMin: 32 },
  { zip: "45140", area: "Loveland", minMin: 24, maxMin: 34 },
  { zip: "45069", area: "West Chester", minMin: 25, maxMin: 35 },
  { zip: "45011", area: "Hamilton", minMin: 28, maxMin: 40 },
  { zip: "45013", area: "Hamilton west", minMin: 30, maxMin: 42 },
  { zip: "45014", area: "Fairfield", minMin: 24, maxMin: 34 },
  { zip: "45015", area: "Fairfield north", minMin: 26, maxMin: 36 },
  { zip: "45040", area: "Mason", minMin: 28, maxMin: 39 },
  { zip: "45036", area: "Lebanon", minMin: 34, maxMin: 46 },
  { zip: "45066", area: "Springboro", minMin: 38, maxMin: 50 },
  { zip: "45044", area: "Middletown", minMin: 40, maxMin: 52 },
  { zip: "45005", area: "Franklin", minMin: 40, maxMin: 52 },
  { zip: "45056", area: "Oxford", minMin: 42, maxMin: 55 },
  { zip: "45030", area: "Harrison", minMin: 26, maxMin: 36 },
  { zip: "45103", area: "Batavia east", minMin: 28, maxMin: 38 },
  // Northern Kentucky
  { zip: "41011", area: "Covington", minMin: 12, maxMin: 20 },
  { zip: "41014", area: "Covington south", minMin: 14, maxMin: 22 },
  { zip: "41016", area: "Covington west", minMin: 14, maxMin: 22 },
  { zip: "41017", area: "Fort Mitchell", minMin: 17, maxMin: 26 },
  { zip: "41071", area: "Newport", minMin: 13, maxMin: 21 },
  { zip: "41073", area: "Bellevue", minMin: 15, maxMin: 23 },
  { zip: "41075", area: "Fort Thomas", minMin: 17, maxMin: 25 },
  { zip: "41076", area: "Cold Spring", minMin: 20, maxMin: 29 },
  { zip: "41018", area: "Erlanger", minMin: 20, maxMin: 29 },
  { zip: "41042", area: "Florence", minMin: 23, maxMin: 33 },
  { zip: "41048", area: "Hebron", minMin: 25, maxMin: 35 },
  { zip: "41005", area: "Burlington", minMin: 26, maxMin: 36 },
  { zip: "41051", area: "Independence", minMin: 25, maxMin: 35 },
  { zip: "41091", area: "Union", minMin: 28, maxMin: 38 },
  { zip: "41001", area: "Alexandria", minMin: 25, maxMin: 35 },
  { zip: "41094", area: "Walton", minMin: 30, maxMin: 41 },
  // Southeast Indiana
  { zip: "47025", area: "Lawrenceburg", minMin: 27, maxMin: 37 },
  { zip: "47001", area: "Aurora", minMin: 31, maxMin: 42 },
  { zip: "47060", area: "West Harrison", minMin: 26, maxMin: 36 },
  { zip: "47012", area: "Brookville", minMin: 40, maxMin: 52 },
  { zip: "47006", area: "Batesville", minMin: 45, maxMin: 58 }
];
var PREFIX_FALLBACK = {
  "452": { area: "Cincinnati", minMin: 8, maxMin: 22 },
  "451": { area: "Greater Cincinnati", minMin: 15, maxMin: 35 },
  "450": { area: "Butler County", minMin: 24, maxMin: 42 },
  "454": { area: "Dayton area", minMin: 45, maxMin: 65 },
  "410": { area: "Northern Kentucky", minMin: 14, maxMin: 36 },
  "470": { area: "Southeast Indiana", minMin: 27, maxMin: 52 }
};
function estimateOneWayMinutes(zip) {
  const hit = lookupZip(zip);
  if (!hit) return null;
  return Math.round((hit.minMin + hit.maxMin) / 2);
}
function lookupZip(zip) {
  const clean = (zip || "").trim().slice(0, 5);
  if (!/^\d{5}$/.test(clean)) return null;
  const exact = ZIP_RANGES.find((z) => z.zip === clean);
  if (exact) return { found: true, area: exact.area, minMin: exact.minMin, maxMin: exact.maxMin };
  const pre = PREFIX_FALLBACK[clean.slice(0, 3)];
  if (pre) return { found: false, ...pre };
  return null;
}

// lib/pricing/promos.ts
var PROMOS = [
  {
    code: "LIKENEW",
    label: "LIKENEW, 10% off",
    percentBp: 1e3,
    active: true,
    blurb: "10% off your service."
  },
  {
    // Not advertised anywhere on the site. It works when somebody types it,
    // which is the point: Elijah hands it out to friends, family and anyone
    // working for him, and nothing on the page invites a stranger to guess
    // at it. If it ever leaks, set active to false and it stops that minute.
    code: "FRIANDFAM",
    label: "FRIANDFAM, 25% off",
    percentBp: 2500,
    active: true,
    blurb: "Friends and family rate, 25% off your service."
  }
];
function normalisePromo(code) {
  return String(code ?? "").trim().toUpperCase().replace(/\s+/g, "");
}
function findPromo(code, opts = {}) {
  const wanted = normalisePromo(code);
  if (!wanted) return { promo: null, rejected: "empty" };
  const hit = PROMOS.find((p) => normalisePromo(p.code) === wanted);
  if (!hit || !hit.active) return { promo: null, rejected: "unknown" };
  if (hit.expiresOn) {
    const today = opts.today ?? /* @__PURE__ */ new Date();
    const stamp = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" + String(today.getDate()).padStart(2, "0");
    if (stamp > hit.expiresOn) return { promo: null, rejected: "expired" };
  }
  if (hit.minServiceCents !== void 0 && opts.serviceCents !== void 0 && opts.serviceCents < hit.minServiceCents) {
    return { promo: null, rejected: "too_small" };
  }
  return { promo: hit, rejected: null };
}
function promoDiscountCents(promo, serviceCents) {
  if (!promo || serviceCents <= 0) return 0;
  const raw = promo.percentBp ? Math.round(serviceCents * promo.percentBp / 1e4) : promo.amountCents ?? 0;
  return Math.max(0, Math.min(raw, serviceCents));
}
function promoMessage(rejected) {
  switch (rejected) {
    case "expired":
      return "That code has expired.";
    case "too_small":
      return "That code needs a larger booking.";
    case "empty":
      return "Enter a code.";
    default:
      return "We do not recognise that code.";
  }
}

// lib/pricing/mileage.ts
function mileageFeeCents(oneWayMinutes, r) {
  if (!Number.isFinite(oneWayMinutes) || oneWayMinutes <= r.freeMinutes) return 0;
  const t = oneWayMinutes;
  const raw = t <= r.tier2StartMin ? (t - r.freeMinutes) * r.tier1RateCents : r.tier2BaseCents + (t - r.tier2StartMin) * r.tier2RateCents;
  const step = r.roundToCents;
  if (t < r.roundDownBelowMin) return Math.floor(raw / step) * step;
  if (t < r.roundNearestBelowMin) return Math.round(raw / step) * step;
  return Math.ceil(raw / step) * step;
}
function averageOneWayMinutes(outboundMinutes, returnMinutes) {
  return (outboundMinutes + returnMinutes) / 2;
}

// lib/pricing/quote.ts
function quote(cart, r, taxTable = SEED_TAX_TABLE, year = (/* @__PURE__ */ new Date()).getFullYear()) {
  const lines = [];
  cart.vehicles.forEach((vehicle, vi) => {
    const vLines = [];
    for (const pkg of vehicle.packages) {
      vLines.push({
        kind: "package",
        label: pkg.name,
        vehicleIndex: vi,
        amountCents: pkg.priceCents,
        durationMin: pkg.durationMin
      });
    }
    for (const a of vehicle.addons) {
      vLines.push({
        kind: "addon",
        label: a.tierLabel && a.tierLabel !== a.name ? a.name + ": " + a.tierLabel : a.name,
        vehicleIndex: vi,
        amountCents: a.priceCents,
        durationMin: a.durationMin
      });
    }
    if (vehicle.correction) {
      const c2 = vehicle.correction;
      vLines.push({
        kind: "correction",
        label: c2.tierLabel,
        vehicleIndex: vi,
        amountCents: c2.addCents,
        durationMin: c2.addMin
      });
      if (c2.coatingAddCents > 0) {
        vLines.push({
          kind: "coating",
          label: c2.coatingLabel + " coating",
          vehicleIndex: vi,
          amountCents: c2.coatingAddCents,
          durationMin: 0
        });
      }
      if (c2.canopyCents && c2.canopyCents > 0) {
        vLines.push({
          kind: "canopy",
          label: "Canopy setup, no garage",
          vehicleIndex: vi,
          amountCents: c2.canopyCents,
          durationMin: 30
        });
      }
    }
    const anyWork = vLines.length > 0;
    if (anyWork && vehicle.sizeUpchargeCents && vehicle.sizeUpchargeCents > 0) {
      vLines.push({
        kind: "size_upcharge",
        label: (vehicle.sizeLabel ?? "Vehicle size") + " vehicle",
        vehicleIndex: vi,
        amountCents: vehicle.sizeUpchargeCents,
        durationMin: 0
      });
    }
    const hasInt = vehicle.packages.some((p) => p.category === "interior");
    const hasExt = vehicle.packages.some((p) => p.category === "exterior");
    if (hasInt && hasExt) {
      vLines.push({
        kind: "combo_discount",
        label: "Interior + exterior discount",
        vehicleIndex: vi,
        amountCents: -r.comboDiscountCents,
        durationMin: 0
      });
    }
    lines.push(...vLines);
  });
  if (cart.vehicles.length > 1 && r.additionalVehicleDiscountBp > 0) {
    const gross = lines.reduce((s, l) => s + l.amountCents, 0);
    const d = Math.round(gross * r.additionalVehicleDiscountBp / 1e4);
    if (d > 0) {
      lines.push({
        kind: "additional_vehicle_discount",
        label: r.additionalVehicleDiscountBp / 100 + "% off, " + cart.vehicles.length + " vehicles",
        vehicleIndex: null,
        amountCents: -d,
        durationMin: 0
      });
    }
  }
  const beforePromoCents = lines.reduce((s, l) => s + l.amountCents, 0);
  const promoLookup = cart.promoCode ? findPromo(cart.promoCode, { serviceCents: beforePromoCents }) : { promo: null, rejected: null };
  const promoDiscountCents2 = promoDiscountCents(promoLookup.promo, beforePromoCents);
  if (promoDiscountCents2 > 0 && promoLookup.promo) {
    lines.push({
      kind: "promo_discount",
      label: promoLookup.promo.label,
      vehicleIndex: null,
      amountCents: -promoDiscountCents2,
      durationMin: 0
    });
  }
  const serviceSubtotalCents = lines.reduce((s, l) => s + l.amountCents, 0);
  const serviceDurationMin = lines.reduce((s, l) => s + l.durationMin, 0);
  const multiVehicleDiscountCents = -lines.filter((l) => l.kind === "additional_vehicle_discount").reduce((s, l) => s + l.amountCents, 0);
  const bd = cart.surchargeContext ? computeSurcharge(cart.surchargeContext, r.surcharge) : { timeOfDayBp: 0, priorityBp: 0, appliedBp: 0, capped: false };
  const surchargeCents = applySurchargeCents(serviceSubtotalCents, bd.appliedBp);
  if (surchargeCents > 0) {
    lines.push({
      kind: "surcharge",
      label: "Premium time, +" + bd.appliedBp / 100 + "%",
      vehicleIndex: null,
      amountCents: surchargeCents,
      durationMin: 0
    });
  }
  const travelIsEstimate = cart.oneWayMinutes === null;
  const visits = Math.max(1, cart.visits ?? 1);
  const perVisit = travelIsEstimate ? 0 : mileageFeeCents(cart.oneWayMinutes, r.mileage);
  const travelCents = perVisit * visits;
  if (travelCents > 0) {
    lines.push({
      kind: "travel",
      label: visits > 1 ? "Travel, " + visits + " separate visits" : "Travel",
      vehicleIndex: null,
      amountCents: travelCents,
      durationMin: 0
    });
  }
  const taxableBase = serviceSubtotalCents + surchargeCents + travelCents;
  const taxIsEstimate = !cart.zip;
  const t = taxIsEstimate ? { taxCents: 0, rateBp: 0, county: null } : computeTax(taxableBase, cart.zip, taxTable, year);
  if (t.taxCents > 0) {
    lines.push({
      kind: "tax",
      label: "Sales tax, " + (t.rateBp / 100).toFixed(2) + "%",
      vehicleIndex: null,
      amountCents: t.taxCents,
      durationMin: 0
    });
  }
  const grossTotalCents = taxableBase + t.taxCents;
  const payInFullSavingsCents = Math.round(grossTotalCents * r.payInFullDiscountBp / 1e4);
  const payInFullDiscountCents = cart.payInFull ? payInFullSavingsCents : 0;
  if (payInFullDiscountCents > 0) {
    lines.push({
      kind: "pay_in_full_discount",
      label: "Paid in full, " + r.payInFullDiscountBp / 100 + "% off",
      vehicleIndex: null,
      amountCents: -payInFullDiscountCents,
      durationMin: 0
    });
  }
  const totalCents = grossTotalCents - payInFullDiscountCents;
  const grossBeforeMultiCents = multiVehicleDiscountCents > 0 ? quote(cart, { ...r, additionalVehicleDiscountBp: 0 }, taxTable, year).totalCents : totalCents;
  const depositCents = Math.round(totalCents * r.depositBp / 1e4);
  return {
    promoCode: promoLookup.promo ? promoLookup.promo.code : null,
    promoDiscountCents: promoDiscountCents2,
    promoRejected: promoLookup.rejected,
    lines,
    serviceSubtotalCents,
    surchargeCents,
    surchargeBp: bd.appliedBp,
    surchargeCapped: bd.capped,
    travelCents,
    travelIsEstimate,
    taxCents: t.taxCents,
    taxRateBp: t.rateBp,
    taxIsEstimate,
    taxCounty: t.county,
    totalCents,
    depositCents,
    balanceCents: totalCents - depositCents,
    payInFullDiscountCents,
    payInFullSavingsCents,
    payAfterEligible: totalCents <= r.payAfterMaxCents,
    serviceDurationMin,
    grossBeforeMultiCents,
    multiVehicleDiscountCents
  };
}

// lib/catalog/icons.ts
var ADDON_ICONS = {
  /** Paw print. */
  paw: '<circle cx="6.8" cy="9.5" r="1.9"/><circle cx="11.4" cy="6.8" r="1.9"/><circle cx="16.6" cy="9" r="1.9"/><path d="M7.2 16.6c0-2.5 2.2-4.3 4.7-4.3s4.7 1.8 4.7 4.3c0 2-1.6 3.4-3.4 3.4-.9 0-1.1-.4-1.3-.4s-.4.4-1.3.4c-1.8 0-3.4-1.4-3.4-3.4z"/>',
  /** A droplet on a surface: a stain being lifted. */
  droplet: '<path d="M12 3.4c3 3.7 4.6 6.3 4.6 8.4a4.6 4.6 0 1 1-9.2 0c0-2.1 1.6-4.7 4.6-8.4z"/><path d="M4 20.5h16"/>',
  /** Vapour rising off a surface. */
  steam: '<path d="M4 20.5h16"/><path d="M8 17c0-2 2-2.6 2-4.6S8 9.4 8 7.4"/><path d="M12 17c0-2 2-2.6 2-4.6S12 9.4 12 7.4"/><path d="M16 17c0-2 2-2.6 2-4.6"/>',
  /** Three bonded atoms: O3. */
  molecule: '<circle cx="6.6" cy="15.2" r="3"/><circle cx="17.4" cy="15.2" r="3"/><circle cx="12" cy="6.6" r="3"/><path d="M9.4 13.1 10.6 10.7"/><path d="M14.6 13.1 13.4 10.7"/><path d="M9.6 15.2h4.8"/>',
  /** A car seat, back and base. */
  seat: '<path d="M8.5 3.5h3.5a2 2 0 0 1 2 2v7.5H8.5a2 2 0 0 1-2-2v-5.5a2 2 0 0 1 2-2z"/><path d="M6.5 13h9.5a3 3 0 0 1 3 3v1.5H9.5a3 3 0 0 1-3-3z"/><path d="M8.5 17.5v3"/><path d="M17.5 17.5v3"/>',
  /** A headlight housing throwing beams. */
  headlight: '<path d="M4 6.5h4.5a7 7 0 0 1 0 11H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z"/><path d="M15 8.5h5"/><path d="M15.5 12H21"/><path d="M15 15.5h5"/>',
  /** A wheel with spokes. */
  wheel: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3"/><path d="M12 3.5v5.5"/><path d="M12 15v5.5"/><path d="M3.5 12H9"/><path d="M15 12h5.5"/>',
  /** A spray bottle with mist. */
  spray: '<path d="M9 9.5h5a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-7.5a2 2 0 0 1 2-2z"/><path d="M10 9.5V6h4"/><path d="M14 6l3.2-1.4"/><path d="M19.5 7.2 21 6.7"/><path d="M19.2 10.2l1.6.3"/><path d="M19.8 3.6 21 3"/>',
  /** A clay block moving across a panel. */
  bar: '<rect x="7" y="9" width="12" height="6.5" rx="2.5"/><path d="M2.5 9h2.5"/><path d="M1.5 12.2h3.5"/><path d="M2.5 15.5h2.5"/>',
  /** Water spots, struck through. */
  spots: '<path d="M8.2 4.6c1.9 2.3 2.9 4 2.9 5.2a2.9 2.9 0 1 1-5.8 0c0-1.2 1-2.9 2.9-5.2z"/><path d="M16.4 11.4c1.5 1.8 2.2 3.1 2.2 4.1a2.2 2.2 0 1 1-4.4 0c0-1 .7-2.3 2.2-4.1z"/><path d="M3.5 20.5 20.5 3.5"/>',
  /** An engine block with an intake. */
  engine: '<rect x="3.5" y="10" width="12" height="7.5" rx="1.5"/><path d="M15.5 12.2h2.2l2.8 2.6v2.7h-5"/><path d="M6.5 10V7.2h4.5V10"/><path d="M8.5 7.2h4.5"/>',
  /** A shield protecting a bead of water. */
  shield: '<path d="M12 2.6 19.5 5.4v5.9c0 4.8-3.2 8.1-7.5 9.6-4.3-1.5-7.5-4.8-7.5-9.6V5.4z"/><path d="M12 8.6c1.7 2 2.5 3.3 2.5 4.4a2.5 2.5 0 1 1-5 0c0-1.1.8-2.4 2.5-4.4z"/>',
  /** A faceted gem: hard, glass-like, permanent. */
  gem: '<path d="M6.5 3.5h11l3 5-8.5 12L3.5 8.5z"/><path d="M3.5 8.5h17"/><path d="M9.7 8.5 12 3.7l2.3 4.8L12 20.5"/>',
  /** A panel with two scratches and a spot being worked. */
  scratch: '<rect x="2.5" y="5.5" width="19" height="13" rx="2.5"/><path d="M7 15.8 10.6 9.2"/><path d="M12.4 15.2 14.4 11.4"/><circle cx="17.4" cy="9.6" r="2.2"/>',
  /** A rotary polisher head. */
  polisher: '<circle cx="10" cy="14" r="5.8"/><circle cx="10" cy="14" r="2.2"/><path d="M14.3 10.1 17.8 6.6l3.1 3.1-3.5 3.5"/>',
  /** A polisher lifting swirl marks out of the paint. */
  correct: '<circle cx="9.2" cy="14.6" r="5.4"/><path d="M13.2 10.8 17 7"/><path d="M15.2 5 19 8.8"/><path d="M6 12.8c1.4 1.1 3.2 1.1 4.6 0"/><path d="M6.4 16.6c1.4 1.1 3.2 1.1 4.6 0"/>'
};
function addonIcon(name) {
  return name && ADDON_ICONS[name] || '<circle cx="12" cy="12" r="8.5"/>';
}

// lib/pricing/wire.ts
var WIRE_LIMITS = {
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
  zipPattern: /^4[0-7]\d{3}$/
};
var DAY = 864e5;
var isObj = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
var str = (v, max) => {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length <= max ? s : null;
};
function normalisePhone(raw) {
  if (typeof raw !== "string") return null;
  let digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  if (digits.length !== 10) return null;
  if (/^[01]/.test(digits)) return null;
  return "+1" + digits;
}
var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
function validateWire(body, opts) {
  const fail = (error, message) => ({ ok: false, error, message });
  if (!isObj(body)) return fail("bad_body", "The request was not understood.");
  const cart = body["cart"];
  if (!isObj(cart)) return fail("empty_cart", "Nothing to price.");
  const rawVehicles = cart["vehicles"];
  if (!Array.isArray(rawVehicles) || rawVehicles.length === 0) return fail("empty_cart", "Nothing to price.");
  if (rawVehicles.length > WIRE_LIMITS.maxVehicles) {
    return fail("too_many_vehicles", `We can book up to ${WIRE_LIMITS.maxVehicles} vehicles online. Ask us about more.`);
  }
  const vehicles = [];
  let anything = false;
  for (const rv of rawVehicles) {
    if (!isObj(rv)) return fail("bad_vehicle", "A vehicle entry was not understood.");
    const v = {};
    if (rv["label"] !== void 0) {
      const label = str(rv["label"], WIRE_LIMITS.maxLabel);
      if (label === null) return fail("bad_label", "That vehicle description is too long.");
      if (label) v.label = label;
    }
    if (rv["sizeId"] !== void 0 && rv["sizeId"] !== null) {
      if (typeof rv["sizeId"] !== "string" || !vehicleSize(rv["sizeId"])) {
        return fail("unknown_size", "That vehicle size is not one we offer.");
      }
      v.sizeId = rv["sizeId"];
    }
    const pkgIds = rv["packageIds"] ?? [];
    if (!Array.isArray(pkgIds)) return fail("bad_packages", "Packages were not understood.");
    if (pkgIds.length > WIRE_LIMITS.maxPackagesPerVehicle) return fail("bad_packages", "Too many packages on one vehicle.");
    const seenCat = /* @__PURE__ */ new Set();
    const seenPkg = /* @__PURE__ */ new Set();
    const packageIds = [];
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
    const rawAddons = rv["addons"] ?? [];
    if (!Array.isArray(rawAddons)) return fail("bad_addons", "Add-ons were not understood.");
    if (rawAddons.length > WIRE_LIMITS.maxAddonsPerVehicle) return fail("bad_addons", "Too many add-ons on one vehicle.");
    const seenAddon = /* @__PURE__ */ new Set();
    const addons = [];
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
    if (rv["correction"] !== void 0 && rv["correction"] !== null) {
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
        ...rc["noGarage"] === true ? { noGarage: true } : {}
      };
    }
    if (packageIds.length || addons.length || v.correction) anything = true;
    vehicles.push(v);
  }
  if (!anything) return fail("empty_cart", "Pick at least one service.");
  const kind = cart["kind"] === "inquiry" ? "inquiry" : "booking";
  let slot = null;
  const rawSlot = cart["slot"];
  if (rawSlot !== void 0 && rawSlot !== null) {
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
  const payInFull = opts.mode === "pay_now";
  if (payInFull && slot === null) {
    return fail("inquiry_cannot_prepay", "We do not take payment in full for a time that is not confirmed yet.");
  }
  let visits;
  if (cart["visits"] !== void 0 && cart["visits"] !== null) {
    const n = cart["visits"];
    if (typeof n !== "number" || !Number.isInteger(n) || n < 1 || n > vehicles.length) {
      return fail("bad_visits", "Separate visits were not understood.");
    }
    visits = n;
  }
  let promoCode = null;
  if (cart["promoCode"] !== void 0 && cart["promoCode"] !== null) {
    const code = str(cart["promoCode"], WIRE_LIMITS.maxPromo);
    if (code === null) return fail("bad_promo", "That promo code is too long to be one of ours.");
    promoCode = code || null;
  }
  let address = null;
  let zip = null;
  const rawAddr = cart["address"];
  if (rawAddr !== void 0 && rawAddr !== null) {
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
  let contact = { name: "", phone: "" };
  const rawContact = body["contact"];
  if (opts.requireContact !== false || rawContact !== void 0) {
    if (!isObj(rawContact)) return fail("missing_contact", "We need a name and a phone number.");
    const name = str(rawContact["name"], WIRE_LIMITS.maxName);
    if (!name) return fail("bad_name", "We need your name.");
    const phone = normalisePhone(rawContact["phone"]);
    if (!phone) return fail("bad_phone", "That does not look like a US phone number.");
    contact = { name, phone };
    if (rawContact["email"] !== void 0 && rawContact["email"] !== null && rawContact["email"] !== "") {
      const email = str(rawContact["email"], WIRE_LIMITS.maxEmail);
      if (!email || !EMAIL.test(email)) return fail("bad_email", "That email address does not look right.");
      contact.email = email.toLowerCase();
    }
  }
  const consent = {};
  const rawConsent = body["consent"];
  if (isObj(rawConsent)) {
    if (typeof rawConsent["termsVersion"] === "string") consent.termsVersion = rawConsent["termsVersion"].slice(0, 20);
    if (typeof rawConsent["sms"] === "boolean") consent.sms = rawConsent["sms"];
    if (typeof rawConsent["media"] === "boolean") consent.media = rawConsent["media"];
    if (rawConsent["mandateAccepted"] === true) consent.mandateAccepted = true;
  }
  const clean = {
    vehicles,
    zip,
    slot,
    kind,
    ...visits !== void 0 ? { visits } : {},
    ...promoCode ? { promoCode } : {},
    ...address ? { address } : {},
    payInFull
  };
  return { ok: true, booking: { cart: clean, contact, consent, kind, payInFull } };
}
function driveTooFar(oneWayMinutes) {
  return typeof oneWayMinutes === "number" && oneWayMinutes > MAX_ONE_WAY_MINUTES;
}

// lib/site/legal.ts
var LEGAL = {
  termsEffective: "2026-09-11",
  privacyEffective: "2026-09-11"
};
function longDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  });
}

// lib/site/legalFingerprint.ts
function legalFingerprint(html) {
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<!--[\s\S]*?-->/g, " ").replace(/<[^>]+>/g, " ").replace(/Effective [A-Z][a-z]+ \d{1,2}, \d{4}(?: &middot; | · )(?:Version|Last updated) [\w, -]+/g, " ").replace(/&[a-z]+;|&#\d+;/g, " ").replace(/\s+/g, " ").trim();
  let a = 2166136261;
  let b = 16777619;
  for (let i = 0; i < text.length; i++) {
    const c2 = text.charCodeAt(i);
    a = Math.imul(a ^ c2, 16777619) >>> 0;
    b = Math.imul(b ^ c2, 2166136261) >>> 0;
  }
  return a.toString(16).padStart(8, "0") + b.toString(16).padStart(8, "0");
}

// lib/booking/ics.ts
var DAY_MS = 864e5;
function parseTime(value, params, fallbackZone) {
  const v = value.trim();
  const dateOnly = /^(\d{4})(\d{2})(\d{2})$/.exec(v);
  if (dateOnly && (params["VALUE"] === "DATE" || v.length === 8)) {
    const [, y2, mo2, d2] = dateOnly;
    return {
      ms: zonedToUtc(Number(y2), Number(mo2), Number(d2), 0, 0, 0, fallbackZone),
      allDay: true
    };
  }
  const dt = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/.exec(v);
  if (!dt) return null;
  const [, y, mo, d, h, mi, s, z] = dt;
  if (z) {
    return { ms: Date.UTC(+y, +mo - 1, +d, +h, +mi, +s), allDay: false };
  }
  const zone = usableZone(params["TZID"], fallbackZone);
  return { ms: zonedToUtc(+y, +mo, +d, +h, +mi, +s, zone), allDay: false };
}
var WINDOWS_ZONES = {
  "eastern standard time": "America/New_York",
  "eastern daylight time": "America/New_York",
  "us eastern standard time": "America/Indiana/Indianapolis",
  "central standard time": "America/Chicago",
  "mountain standard time": "America/Denver",
  "pacific standard time": "America/Los_Angeles",
  "utc": "UTC",
  "gmt standard time": "Europe/London"
};
var zoneOk = /* @__PURE__ */ new Map();
function usableZone(tzid, fallbackZone) {
  if (!tzid) return fallbackZone;
  const mapped = WINDOWS_ZONES[tzid.trim().toLowerCase()];
  if (mapped) return mapped;
  let ok = zoneOk.get(tzid);
  if (ok === void 0) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: tzid });
      ok = true;
    } catch {
      ok = false;
    }
    zoneOk.set(tzid, ok);
  }
  return ok ? tzid : fallbackZone;
}
function parseDuration(v) {
  const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(v.trim());
  if (!m) return null;
  const sign = m[1] === "-" ? -1 : 1;
  const ms = (Number(m[2] ?? 0) * 7 * 86400 + Number(m[3] ?? 0) * 86400 + Number(m[4] ?? 0) * 3600 + Number(m[5] ?? 0) * 60 + Number(m[6] ?? 0)) * 1e3;
  return sign * ms;
}
function readLines(text) {
  const unfolded = text.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "");
  const out = [];
  for (const line of unfolded.split("\n")) {
    if (!line) continue;
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const head = line.slice(0, colon);
    const value = line.slice(colon + 1);
    const bits = head.split(";");
    const name = (bits[0] ?? "").toUpperCase();
    const params = {};
    for (const bit of bits.slice(1)) {
      const eq = bit.indexOf("=");
      if (eq < 0) continue;
      params[bit.slice(0, eq).toUpperCase()] = bit.slice(eq + 1).replace(/^"|"$/g, "");
    }
    out.push({ name, params, value });
  }
  return out;
}
function collectEvents(lines, zone) {
  const events = [];
  let cur = null;
  let depth = 0;
  for (const line of lines) {
    if (line.name === "BEGIN") {
      if (line.value === "VEVENT") {
        cur = {
          uid: "",
          start: null,
          end: null,
          durationMs: null,
          rrule: null,
          exDates: [],
          rDates: [],
          recurrenceId: null,
          cancelled: false,
          transparent: false
        };
        depth = 0;
      } else if (cur) {
        depth++;
      }
      continue;
    }
    if (line.name === "END") {
      if (line.value === "VEVENT" && cur) {
        events.push(cur);
        cur = null;
      } else if (cur && depth > 0) {
        depth--;
      }
      continue;
    }
    if (!cur || depth > 0) continue;
    switch (line.name) {
      case "UID":
        cur.uid = line.value;
        break;
      case "DTSTART":
        cur.start = parseTime(line.value, line.params, zone);
        break;
      case "DTEND":
        cur.end = parseTime(line.value, line.params, zone);
        break;
      case "DURATION":
        cur.durationMs = parseDuration(line.value);
        break;
      case "RRULE":
        cur.rrule = line.value;
        break;
      case "RECURRENCE-ID":
        cur.recurrenceId = parseTime(line.value, line.params, zone);
        break;
      case "STATUS":
        if (line.value.toUpperCase() === "CANCELLED") cur.cancelled = true;
        break;
      case "TRANSP":
        if (line.value.toUpperCase() === "TRANSPARENT") cur.transparent = true;
        break;
      case "EXDATE":
        for (const v of line.value.split(",")) {
          const t = parseTime(v, line.params, zone);
          if (t) cur.exDates.push(t.ms);
        }
        break;
      case "RDATE":
        for (const v of line.value.split(",")) {
          const t = parseTime(v, line.params, zone);
          if (t) cur.rDates.push(t.ms);
        }
        break;
      default:
        break;
    }
  }
  return events;
}
var WEEKDAY = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
function parseRule(text, zone) {
  const parts = {};
  for (const bit of text.split(";")) {
    const eq = bit.indexOf("=");
    if (eq > 0) parts[bit.slice(0, eq).toUpperCase()] = bit.slice(eq + 1);
  }
  const freq = (parts["FREQ"] ?? "").toUpperCase();
  if (!freq) return null;
  const untilRaw = parts["UNTIL"];
  const until = untilRaw ? parseTime(untilRaw, {}, zone)?.ms ?? null : null;
  return {
    freq,
    interval: Math.max(1, Number(parts["INTERVAL"] ?? 1)),
    count: parts["COUNT"] ? Number(parts["COUNT"]) : null,
    until,
    byDay: (parts["BYDAY"] ?? "").split(",").map((d) => WEEKDAY[d.replace(/^[+-]?\d+/, "").toUpperCase()]).filter((n) => n !== void 0),
    byMonthDay: (parts["BYMONTHDAY"] ?? "").split(",").map(Number).filter((n) => Number.isFinite(n) && n !== 0)
  };
}
function expand(startMs, rule, from, to, cap) {
  const out = [];
  const hardEnd = rule.until !== null ? Math.min(to, rule.until) : to;
  if (startMs > hardEnd) return out;
  let emitted = 0;
  const push = (ms) => {
    if (rule.count !== null && emitted >= rule.count) return false;
    emitted++;
    if (ms >= from && ms <= hardEnd) out.push(ms);
    return true;
  };
  if (rule.freq === "DAILY") {
    const step = rule.interval * DAY_MS;
    let ms = startMs;
    if (rule.count === null && from > startMs) {
      ms = startMs + Math.floor((from - startMs) / step) * step;
    }
    for (let i = 0; i < cap && ms <= hardEnd; i++, ms += step) {
      if (!push(ms)) break;
    }
    return out;
  }
  if (rule.freq === "WEEKLY") {
    const week = rule.interval * 7 * DAY_MS;
    const days = rule.byDay.length ? rule.byDay : [new Date(startMs).getUTCDay()];
    let anchor = startMs;
    if (rule.count === null && from - week > startMs) {
      anchor = startMs + Math.floor((from - week - startMs) / week) * week;
    }
    for (let i = 0; i < cap && anchor <= hardEnd + week; i++, anchor += week) {
      const base = new Date(anchor);
      for (const d of days) {
        const shift = (d - base.getUTCDay() + 7) % 7;
        const ms = anchor + shift * DAY_MS;
        if (ms < startMs) continue;
        if (ms > hardEnd) continue;
        if (!push(ms)) return out;
      }
    }
    return out;
  }
  if (rule.freq === "MONTHLY" || rule.freq === "YEARLY") {
    const stepMonths = rule.freq === "YEARLY" ? 12 * rule.interval : rule.interval;
    const d0 = new Date(startMs);
    for (let i = 0; i < cap; i++) {
      const ms = Date.UTC(
        d0.getUTCFullYear(),
        d0.getUTCMonth() + i * stepMonths,
        rule.byMonthDay[0] ?? d0.getUTCDate(),
        d0.getUTCHours(),
        d0.getUTCMinutes(),
        d0.getUTCSeconds()
      );
      if (ms > hardEnd) break;
      if (!push(ms)) break;
    }
    return out;
  }
  return out;
}
function parseIcsBusy(text, opts) {
  const zone = opts.timeZone ?? "America/New_York";
  const cap = opts.maxOccurrences ?? 400;
  const events = collectEvents(readLines(text), zone);
  const overridden = /* @__PURE__ */ new Set();
  for (const e of events) {
    if (e.recurrenceId) overridden.add(`${e.uid}@${e.recurrenceId.ms}`);
  }
  const raw = [];
  for (const e of events) {
    if (e.cancelled || e.transparent || !e.start) continue;
    if (e.start.allDay && !opts.includeAllDay) continue;
    let lengthMs;
    if (e.end) lengthMs = e.end.ms - e.start.ms;
    else if (e.durationMs !== null) lengthMs = e.durationMs;
    else lengthMs = e.start.allDay ? DAY_MS : 0;
    if (lengthMs <= 0) lengthMs = e.start.allDay ? DAY_MS : 30 * 60 * 1e3;
    const starts = [];
    if (e.rrule && !e.recurrenceId) {
      const rule = parseRule(e.rrule, zone);
      if (rule) starts.push(...expand(e.start.ms, rule, opts.from - lengthMs, opts.to, cap));
    } else {
      starts.push(e.start.ms);
    }
    starts.push(...e.rDates);
    for (const s of starts) {
      if (e.exDates.includes(s)) continue;
      if (!e.recurrenceId && overridden.has(`${e.uid}@${s}`)) continue;
      const end = s + lengthMs;
      if (end <= opts.from || s >= opts.to) continue;
      raw.push({ start: Math.max(s, opts.from), end: Math.min(end, opts.to) });
    }
  }
  return mergeBusy(raw);
}
function mergeBusy(list) {
  if (!list.length) return [];
  const sorted = list.slice().sort((a, b) => a.start - b.start);
  const out = [{ ...sorted[0] }];
  for (const next of sorted.slice(1)) {
    const last = out[out.length - 1];
    if (next.start <= last.end) last.end = Math.max(last.end, next.end);
    else out.push({ ...next });
  }
  return out;
}

// lib/pricing/cancellation.ts
function chargeBpForNotice(hoursUntilStart, r) {
  if (hoursUntilStart >= r.refundFullWindowHours) return 0;
  if (hoursUntilStart >= r.refundMidWindowHours) return r.cancelMidWindowBp;
  return r.cancelLateWindowBp;
}
function bucketForNotice(hoursUntilStart, r) {
  if (hoursUntilStart >= r.refundFullWindowHours) return "gte72h";
  if (hoursUntilStart >= r.refundMidWindowHours) return "24h_to_72h";
  return "lt24h";
}
function computeCancellation(input, r) {
  const total = Math.max(0, Math.round(input.totalCents));
  const paid = Math.max(0, Math.round(input.paidCents ?? 0));
  const settle = (bucket2, fee2, explanation) => ({
    bucket: bucket2,
    feeCents: fee2,
    dueCents: Math.max(0, fee2 - paid),
    refundCents: Math.max(0, paid - fee2),
    explanation
  });
  if (input.ownerCancelled) {
    return settle(
      "owner_cancelled",
      0,
      "We cancelled, so there is no charge and anything you paid comes back in full."
    );
  }
  if (input.waived) return settle("waived", 0, "Cancellation fee waived.");
  if (!Number.isFinite(input.hoursUntilStart)) {
    return settle("needs_review", 0, "We could not work out the notice on this booking. Someone will check it by hand before anything is charged.");
  }
  const bucket = bucketForNotice(input.hoursUntilStart, r);
  const fee = Math.round(total * chargeBpForNotice(input.hoursUntilStart, r) / 1e4);
  if (bucket === "gte72h") {
    return settle(
      bucket,
      0,
      `Cancelled more than ${r.refundFullWindowHours} hours ahead, so there is no charge.`
    );
  }
  if (bucket === "24h_to_72h") {
    return settle(
      bucket,
      fee,
      `Cancelled inside ${r.refundFullWindowHours} hours, so ${r.cancelMidWindowBp / 100}% of the booking applies. Rescheduling instead puts the same amount toward your new date.`
    );
  }
  return settle(
    bucket,
    fee,
    `Cancelled inside ${r.refundMidWindowHours} hours, so the booking is charged in full. Rescheduling instead puts the whole amount toward your new date.`
  );
}
function computeReschedule(input, r) {
  const total = Math.max(0, Math.round(input.totalCents));
  const paid = Math.max(0, Math.round(input.paidCents ?? 0));
  const priorLate = Math.max(0, Math.floor(input.lateMoves ?? 0));
  const free = (bucket2, explanation) => ({
    bucket: bucket2,
    prepayCents: 0,
    dueNowCents: 0,
    creditCents: paid,
    lateFeeCents: 0,
    lateFeeBp: 0,
    creditValidDays: paid > 0 ? r.rescheduleCreditDays : 0,
    explanation
  });
  if (input.ownerInitiated) {
    return free("owner_cancelled", "We moved it, so there is nothing to pay and nothing changes.");
  }
  if (input.waived) return free("waived", "Reschedule charge waived.");
  if (!Number.isFinite(input.hoursUntilStart)) {
    return free("needs_review", "We could not work out the notice on this booking. Someone will check it by hand before anything is charged.");
  }
  const bucket = bucketForNotice(input.hoursUntilStart, r);
  if (bucket === "gte72h") {
    return free(
      "gte72h",
      `Moved with more than ${r.refundFullWindowHours} hours notice, so there is nothing to pay.`
    );
  }
  const prepay = Math.round(total * chargeBpForNotice(input.hoursUntilStart, r) / 1e4);
  if (bucket === "24h_to_72h") {
    return {
      bucket,
      prepayCents: prepay,
      dueNowCents: Math.max(0, prepay - paid),
      creditCents: Math.max(prepay, paid),
      lateFeeCents: 0,
      lateFeeBp: 0,
      creditValidDays: r.rescheduleCreditDays,
      explanation: `Moved inside ${r.refundFullWindowHours} hours, so ${r.cancelMidWindowBp / 100}% is taken now and goes straight onto your new booking. No fee for moving it.`
    };
  }
  const lateFeeBp = r.lateRescheduleFeeBp;
  const lateFeeCents = Math.round(total * lateFeeBp / 1e4);
  return {
    bucket,
    prepayCents: prepay,
    dueNowCents: Math.max(0, prepay - paid),
    creditCents: Math.max(prepay, paid),
    lateFeeCents,
    lateFeeBp,
    creditValidDays: r.rescheduleCreditDays,
    explanation: `Moved inside ${r.refundMidWindowHours} hours, so the booking is taken in full now and held as credit for ${r.rescheduleCreditDays} days. A ${r.lateRescheduleFeeBp / 100}% late move fee applies` + (priorLate > 0 ? `, the same ${lateFeeBp / 100}% as last time. This is late move number ${priorLate + 1}.` : ".")
  };
}
function cancellationLadder(r) {
  return [
    {
      id: "gte72h",
      when: `${r.refundFullWindowHours} hours or more before`,
      cancel: "No charge",
      reschedule: "Free, nothing to pay",
      bp: 0
    },
    {
      id: "24h_to_72h",
      when: `${r.refundMidWindowHours} to ${r.refundFullWindowHours} hours before`,
      cancel: `${r.cancelMidWindowBp / 100}% of the booking, kept`,
      reschedule: `${r.cancelMidWindowBp / 100}% taken now, all of it credited to the new date`,
      bp: r.cancelMidWindowBp
    },
    {
      id: "lt24h",
      when: `Less than ${r.refundMidWindowHours} hours before`,
      cancel: "The full booking, kept",
      reschedule: `Paid in full now, credited for ${r.rescheduleCreditDays} days, plus a flat ${r.lateRescheduleFeeBp / 100}% late move fee`,
      bp: r.cancelLateWindowBp
    }
  ];
}

// lib/site/capabilities.ts
var CAPABILITIES = [
  {
    id: "cardOnFile",
    what: "Taking a card at booking and charging it when the work is done",
    live: false,
    blockedBy: "Stripe keys"
  },
  {
    id: "digitalWallets",
    what: "Apple Pay, Google Pay, PayPal and Venmo at checkout",
    live: false,
    blockedBy: "Stripe and PayPal accounts"
  },
  {
    id: "liveCalendar",
    what: "Reading real availability, so a chosen time is genuinely open",
    live: false,
    blockedBy: "Google Calendar API key and a public availability calendar"
  },
  {
    id: "measuredTravel",
    what: "Measuring the real drive at the appointment time, traffic included",
    live: false,
    blockedBy: "Google Routes API key and SHOP_ORIGIN_ADDRESS"
  },
  {
    id: "automatedMessages",
    what: "Automatic confirmations, reminders and an on-the-way text",
    live: false,
    blockedBy: "Twilio A2P 10DLC registration and Resend"
  },
  {
    id: "bookingLink",
    what: "A customer link for moving a time or changing services without calling",
    live: false,
    blockedBy: "Neon Postgres, so there is a stored booking to point at"
  },
  {
    id: "placesAutocomplete",
    what: "Address suggestions as the customer types, from Google Places",
    live: false,
    blockedBy: "Google browser key in js/config.js"
  },
  {
    id: "botCheck",
    what: "Cloudflare Turnstile in front of the payment step",
    live: false,
    blockedBy: "TURNSTILE_SECRET_KEY in Netlify and turnstileSiteKey in js/config.js"
  }
];
var PROCESSORS = [
  { name: "Netlify", does: "hosts the website and runs the code behind the booking form. Keeps standard server logs, including IP addresses." },
  { name: "Web3Forms", does: "delivers your question or booking request to our email inbox." },
  { name: "Google (Gmail and Fonts)", does: "is where our email lives, so anything you send us is stored there, and serves the typefaces on this site, which means Google receives your IP address when a page loads." },
  { name: "OpenStreetMap", does: "provides the service area map tiles and looks up places you type into the map search. Your IP address and that search text go to OpenStreetMap." },
  { name: "cdnjs (Cloudflare)", does: "serves the map library, so Cloudflare receives your IP address when the map loads." },
  { name: "Google Places", does: "suggests addresses as you type in the booking form. What you type in that box goes to Google.", capability: "placesAutocomplete" },
  { name: "Google Maps (Routes)", does: "measures the drive to your address so we can price travel. This happens from our server, with your address, not from your browser.", capability: "measuredTravel" },
  { name: "Google Calendar", does: "holds our availability. Your browser reads our open times from it.", capability: "liveCalendar" },
  { name: "Stripe", does: "takes card payments and keeps your card on file. Card details go straight to Stripe over an encrypted connection; we never see or store the card number.", capability: "cardOnFile" },
  { name: "PayPal", does: "takes PayPal and Venmo payments.", capability: "digitalWallets" },
  { name: "Twilio", does: "sends our appointment text messages.", capability: "automatedMessages" },
  { name: "Resend", does: "sends our confirmation and reminder emails.", capability: "automatedMessages" },
  { name: "Neon", does: "stores bookings in our database so your booking link works.", capability: "bookingLink" },
  { name: "Cloudflare Turnstile", does: "checks that a booking is being made by a person, before payment. It may set a cookie to do so.", capability: "botCheck" }
];
function liveProcessors() {
  return PROCESSORS.filter((p) => !p.capability || isLive(p.capability));
}
function dormantProcessors() {
  return PROCESSORS.filter((p) => p.capability && !isLive(p.capability));
}
function isLive(id) {
  return CAPABILITIES.find((c2) => c2.id === id)?.live ?? false;
}
function pending() {
  return CAPABILITIES.filter((c2) => !c2.live);
}
var GATED_COPY = [
  {
    id: "howToChange",
    capability: "bookingLink",
    live: 'Easiest way is your <strong>booking link</strong>, which is in the confirmation we sent when you booked. Open it and you can move the time, change what is included, or cancel, and it shows you what each one costs before you commit. Otherwise call or text <a href="tel:+15132792915">(513) 279-2915</a>.',
    notYet: 'Call or text <a href="tel:+15132792915">(513) 279-2915</a>, or reply to the confirmation we sent you. A text is fine and you do not need a reason.'
  },
  {
    id: "changeSelfService",
    capability: "bookingLink",
    live: "Your booking link works this out and shows you the number before you confirm anything.",
    notYet: "Ask us and we will work out the number for you before you agree to anything."
  },
  {
    id: "paymentMethods",
    capability: "digitalWallets",
    live: "We take cards, Apple Pay, Google Pay, PayPal, Venmo and cash.",
    notYet: "If you would rather settle another way, ask us and we will sort it out."
  },
  {
    id: "travelBasis",
    capability: "measuredTravel",
    live: "After that we charge for the real drive out to you, measured at the time you picked with the traffic of that hour, rather than a flat call-out fee.",
    notYet: "After that we charge for the drive out to you rather than a flat call-out fee, worked out from your address and the time you picked."
  },
  {
    id: "confirmation",
    capability: "automatedMessages",
    live: "When you book online you pick the time that suits you and we confirm it straight away by text and email.",
    notYet: "When you book online you pick the time that suits you and we confirm it, usually within a few hours, by text or email."
  },
  {
    id: "messages",
    capability: "automatedMessages",
    live: "We ask when you book whether we can text you about your detail. If you say yes we will confirm the booking, remind you beforehand and let you know when we are on the way.",
    notYet: "We ask when you book whether we can text you about your detail. If you say yes we will use it to confirm the booking, remind you beforehand and let you know when we are on the way."
  }
];
function copyFor(id) {
  const row = GATED_COPY.find((c2) => c2.id === id);
  if (!row) throw new Error(`No gated copy for "${id}"`);
  return isLive(row.capability) ? row.live : row.notYet;
}

// lib/server-entry.ts
function priceFromWire(wire, opts = {}) {
  const rejected = [];
  const vehicles = (wire.vehicles ?? []).map((wv) => {
    const size = wv.sizeId ? vehicleSize(wv.sizeId) : void 0;
    if (wv.sizeId && !size) rejected.push(`unknown size ${wv.sizeId}`);
    const packages = [];
    for (const id of wv.packageIds ?? []) {
      const p = findPackage(id);
      if (!p) {
        rejected.push(`unknown package ${id}`);
        continue;
      }
      packages.push({
        id: p.id,
        name: p.name,
        category: p.category,
        priceCents: p.priceCents,
        durationMin: p.durationMin
      });
    }
    const addons = [];
    for (const a of wv.addons ?? []) {
      const def = findAddon(a.addonId);
      const tier = def?.tiers.find((t) => t.id === a.tierId);
      if (!def || !tier || tier.priceCents === null) {
        rejected.push(`unknown or unpriced add-on ${a.addonId}/${a.tierId}`);
        continue;
      }
      addons.push({
        id: def.id,
        name: def.name,
        tierId: tier.id,
        tierLabel: tier.label,
        priceCents: tier.priceCents,
        durationMin: tier.durationMin
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
          ...wv.correction.noGarage ? { canopyCents: CORRECTION_RULES.canopyCents } : {}
        };
      }
    }
    return {
      label: wv.label ?? "Vehicle",
      sizeUpchargeCents: size?.upchargeCents ?? 0,
      sizeLabel: size?.label ?? "",
      packages,
      addons,
      ...correction ? { correction } : {}
    };
  });
  const nowMs = opts.nowMs ?? Date.now();
  const priority = wire.slot ? slotNeedsPriority(wire.slot, nowMs, DEFAULT_RULES.window) : false;
  const payInFull = opts.payInFull ?? false;
  const cart = {
    vehicles,
    // A measured drive wins. The ZIP band estimate is the fallback for a
    // site without a Maps key, and prices an uncovered ZIP as no travel
    // rather than guessing.
    oneWayMinutes: opts.measuredOneWayMinutes ?? (wire.zip ? estimateOneWayMinutes(wire.zip) : null),
    // Priority is DERIVED from the slot. The browser used to send a boolean
    // and this trusted it, which was a 20% discount for anyone who edited one
    // word of the request. Without a slot there is no window to be inside.
    surchargeContext: wire.slot ? { startMinutesLocal: localMinutesOfDay(wire.slot), priorityBooking: priority } : null,
    zip: wire.zip ?? null,
    ...payInFull ? { payInFull: true } : {},
    ...wire.promoCode ? { promoCode: wire.promoCode } : {},
    ...wire.visits ? { visits: Math.max(1, Math.min(wire.visits, wire.vehicles.length || 1)) } : {}
  };
  const q = quote(cart, DEFAULT_RULES, SEED_TAX_TABLE);
  return {
    totalCents: q.totalCents,
    serviceSubtotalCents: q.serviceSubtotalCents,
    surchargeBp: q.surchargeBp,
    serviceDurationMin: q.serviceDurationMin,
    oneWayMinutes: cart.oneWayMinutes,
    priority,
    travelSource: opts.measuredOneWayMinutes != null ? "routes" : cart.oneWayMinutes != null ? "estimate" : "none",
    promoCode: q.promoCode,
    promoDiscountCents: q.promoDiscountCents,
    lines: q.lines.map((l) => ({ label: l.label, amountCents: l.amountCents })),
    rejected
  };
}
export {
  ADDONS,
  CAPABILITIES,
  COATING_COVERAGE,
  COATING_EXPLAINER,
  COATING_TERMS,
  CORRECTION_RULES,
  CORRECTION_TIERS,
  DEFAULT_RULES,
  GATED_COPY,
  LEGAL,
  MAINTENANCE_PLAN,
  MAX_BOOKING_CENTS,
  MAX_ONE_WAY_MINUTES,
  PROCESSORS,
  PROMOS,
  SEED_CATALOG,
  VEHICLE_SIZES,
  WIRE_LIMITS,
  addonIcon,
  addonsFor,
  averageOneWayMinutes,
  cancellationLadder,
  componentsOf,
  computeCancellation,
  computeReschedule,
  copyFor,
  dormantProcessors,
  driveTooFar,
  estimateOneWayMinutes,
  findAddon,
  findPackage,
  findPromo,
  isLive,
  isSelectable,
  isUnpriced,
  legalFingerprint,
  liveProcessors,
  longDate,
  mergeBusy,
  mileageFeeCents,
  normalisePhone,
  normalisePromo,
  packagesFor,
  parseIcsBusy,
  pending,
  priceFromWire,
  promoDiscountCents,
  promoMessage,
  quote,
  slotNeedsPriority,
  unavailableReason,
  validateWire,
  vehicleSize
};

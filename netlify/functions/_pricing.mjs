// lib/catalog/addons.ts
var ADDONS = [
  /* ---------------- interior ---------------- */
  {
    id: "pet-hair",
    name: "Pet Hair Removal",
    scope: "interior",
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
    description: "All safe portions of the vehicle sanitized and scrubbed with a steamer.",
    note: "Steam cleans with heat rather than chemicals. It softens grease and grime so it wipes off instead of being scrubbed at, gets into vents, seams and seat rails that no cloth reaches, and the heat kills bacteria on contact. Everything dries in minutes because there is very little water involved.",
    tiers: [{ id: "std", label: "Full vehicle", priceCents: 7500, durationMin: 90 }]
  },
  {
    id: "ozone",
    name: "Ozone Odor Reset",
    scope: "interior",
    description: "Ozone (O3) destroys the compounds causing the smell instead of covering them. 60 to 90% reduction of organic odors. Must be paired with a stain treatment, or Full Interior and above.",
    note: "A generator converts the oxygen in the air (O2) into ozone (O3). That extra atom is unstable, so it breaks away and oxidises odor molecules, bacteria and smoke residue on contact. Because it works as a gas it reaches the vents, headliner and seat foam that wiping cannot. It then reverts to ordinary oxygen and leaves nothing behind. The vehicle is sealed while it runs and aired out afterwards.",
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
    description: "Electronic disconnect, full seat removal, and a full clean under and around the seats.",
    note: "The worst of an interior collects under the seats, where a vacuum wand cannot reach past the rails. The battery is disconnected first so the airbag sensors in the seat are safe to unplug, the seats come out on their bolts, and the whole floor is cleaned properly before they go back in and get torqued to spec.",
    tiers: [{ id: "std", label: "Front seats out", priceCents: 1e4, durationMin: 120 }]
  },
  /* ---------------- exterior ---------------- */
  {
    id: "headlight",
    name: "Headlight Restoration",
    scope: "exterior",
    description: "Oxidation removal, 2000 grit wet sand, 3000 grit wet sand, dry, then ceramic coated.",
    note: "Headlights yellow because UV breaks down the factory coating on the outside of the plastic. Polishing alone buffs the haze off but leaves the plastic bare, so it clouds again within months. Sanding takes the damaged layer off properly, progressively finer grits bring the clarity back, and a ceramic coating replaces the UV protection that failed in the first place.",
    tiers: [{ id: "std", label: "Both headlights", priceCents: 7500, durationMin: 90 }]
  },
  {
    id: "tire-rim-shine",
    name: "Tire and Rim Shine",
    scope: "exterior",
    description: "Deep clean and dress the tires and rims.",
    note: "Brake dust is not dirt, it is hot metal particles that embed themselves into the wheel finish. A dedicated cleaner dissolves the iron so it rinses off instead of being scrubbed in, then the tire gets a dressing that blocks UV, which is what causes the browning and cracking on sidewalls.",
    tiers: [{ id: "std", label: "All four", priceCents: null, durationMin: 30 }]
  },
  {
    id: "paint-decon",
    name: "Paint Decontamination",
    scope: "exterior",
    description: "Chemical decontamination to strip embedded iron and fallout.",
    note: "Paint that still feels rough after a wash is holding contamination the soap cannot lift: rail dust, industrial fallout and brake particles that have bonded to the clear coat. An iron remover dissolves them chemically. Skipping this before any polish or coating means grinding those particles into the paint.",
    tiers: [{ id: "std", label: "Full vehicle", priceCents: null, durationMin: 45 }]
  },
  {
    id: "clay-bar",
    name: "Clay Bar or Clay Towel",
    scope: "exterior",
    description: "Mechanically lifts anything decontamination leaves behind, all panels.",
    note: "Chemical decon handles metal particles; clay handles everything else, like overspray, tree sap residue and road film. It shears the bonded contamination off the surface as it glides, always on a wet panel so nothing gets dragged. The paint goes from feeling like fine sandpaper to feeling like glass.",
    tiers: [{ id: "std", label: "All panels", priceCents: null, durationMin: 60 }]
  },
  {
    id: "hard-water",
    name: "Hard Water Spot Removal",
    scope: "exterior",
    description: "For etched sprinkler and well water spotting on paint and glass.",
    note: "Hard water leaves dissolved minerals behind when it dries, and in sun those minerals etch a ring into the clear coat. Caught early a mild acid dissolves them off. Left long enough the etching is physical damage in the paint and needs polishing out, which is a correction job rather than this one.",
    tiers: [{ id: "std", label: "Full vehicle", priceCents: null, durationMin: 60 }]
  },
  {
    id: "engine-bay",
    name: "Engine Bay Detail",
    scope: "exterior",
    description: "Cleaned, dressed and protected.",
    note: "Sensitive electronics get covered first, then a degreaser is left to dwell and agitated by hand rather than blasted with a pressure washer, which is how water finds its way into connectors. Everything is blown dry and the plastics and hoses get a dressing that stops them fading and cracking under engine heat.",
    tiers: [{ id: "std", label: "Engine bay", priceCents: null, durationMin: 30 }]
  },
  {
    id: "ceramic-sealant",
    name: "Ceramic Sealant",
    scope: "exterior",
    description: "Six months or so of gloss and beading, applied over clean paint.",
    note: "A sprayable sealant that bonds to the clear coat and leaves a slick, hydrophobic layer. Water beads and rolls off instead of sheeting and drying into spots, and dirt struggles to key onto the surface, so the car stays cleaner between washes. Far quicker than a coating, and it does not need the paint corrected first.",
    tiers: [{ id: "std", label: "Full vehicle", priceCents: null, durationMin: 45 }]
  },
  {
    id: "ceramic-coating",
    name: "Ceramic Coating",
    scope: "exterior",
    description: "Years of protection rather than months. Booked as Showroom Ready Exterior.",
    note: "A real coating cures into a hard glass-like layer chemically bonded to the clear coat, which is why it lasts years rather than months. It also locks in whatever the paint looks like at the time, so any swirls underneath are sealed in with it. That is why coatings are sold with correction rather than on their own, and why this one lives inside Showroom Ready Exterior.",
    unavailable: true,
    unavailableNote: "Booked through Showroom Ready Exterior, which includes the prep a coating needs.",
    tiers: [{ id: "std", label: "Full vehicle", priceCents: null, durationMin: 300 }]
  },
  {
    id: "paint-polish",
    name: "Paint Polish",
    scope: "exterior",
    description: "A single machine pass to lift light swirling and bring the gloss back.",
    note: "Swirl marks are thousands of fine scratches in the clear coat, usually from washing. A polish uses an abrasive on a machine pad to level a microscopic amount of clear coat down to the base of those scratches, so they stop catching light. It is removing material, which is why it is done sparingly and by someone who knows how much is there.",
    unavailable: true,
    unavailableNote: "Temporarily unavailable while we build up our correction setup.",
    tiers: [{ id: "std", label: "Single stage", priceCents: null, durationMin: 300 }]
  },
  {
    id: "paint-correction",
    name: "Paint Correction",
    scope: "exterior",
    description: "Multi stage cutting and refining for deeper defects.",
    note: "Correction is polishing taken further: a cutting compound removes the defect, then progressively finer passes remove the haze the cutting itself leaves behind. Two and three stage work is how you get a finish that holds up under direct light rather than only looking right in the shade.",
    unavailable: true,
    unavailableNote: "Temporarily unavailable. Available inside Showroom Ready Exterior.",
    tiers: [{ id: "std", label: "Multi stage", priceCents: null, durationMin: 600 }]
  }
];
function addonsFor(scope) {
  return ADDONS.filter((a) => a.scope === scope);
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
var CORRECTION_TIERS = [
  {
    id: "coating-only",
    label: "Ceramic coating only",
    addCents: 55e3,
    addMin: 5 * 60,
    result: "3 to 5 years of protection, no correction",
    detail: "Panel wipe, then coating applied and levelled by hand across paint, wheels, plastic trim and glass, and left to cure. Existing swirls and scratches stay as they are, sealed under the coating.",
    asterisk: true
  },
  {
    id: "one-step",
    label: "1 step paint correction, then coating",
    addCents: 85e3,
    addMin: 12 * 60,
    result: "Looks perfect from about 5 feet away",
    detail: "One cutting and finishing pass lifts most light swirling and haze, then the coating goes on. Removes roughly 60 to 70% of visible defects.",
    asterisk: true
  },
  {
    id: "two-step",
    label: "2 step paint correction, then coating",
    addCents: 149500,
    addMin: 18 * 60,
    result: "Looks perfect from about 2 feet away",
    detail: "A compounding pass to cut deeper defects, then a refining pass to bring the gloss back, then the coating. Removes roughly 80 to 90%.",
    asterisk: true
  },
  {
    id: "three-step",
    label: "3 to 4 step paint correction, then coating",
    addCents: 225e3,
    addMin: 30 * 60,
    result: "Removes 90%+ of all defects, reflective trim included",
    detail: "Heavy cut, refine, then a final jewelling pass under inspection lighting before coating, with a fourth pass where the paint needs it. Reflective trim is corrected and coated alongside the paint. This is show car work and runs across several days.",
    asterisk: false
  }
];
var COATING_TERMS = [
  { id: "3yr", label: "3 year", addCents: 0, asterisk: true },
  { id: "5yr", label: "5 year", addCents: 15e3, asterisk: true },
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
   * Only the first day gets scheduled. The rest is arranged directly, because
   * a 30 hour job cannot sit in one calendar slot and pretending otherwise
   * would block a fortnight of availability.
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
  c("ext-ceramic", "Ceramic sealant applied", "exterior", 45)
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
    note: "A blowout and thorough vacuum through the seats, carpet and trunk, mats cleaned, every surface wiped down, and the visible grime taken off. The car looks and feels clean when you get back in it. It does NOT shampoo or extract the upholstery, treat set-in stains, condition leather, or brush out every seam and crevice. Stains that are already in the fabric will still be there. If the carpet is marked or the car smells, you want Full, or Basic with a stain treatment added.",
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
    note: "Everything in Basic, then the deep work: engrained particles pulled out of the carpet, upholstery shampooed and scrubbed, mats washed and dressed, leather conditioned, glass and door jams cleaned, and every crack and crevice brush detailed. Stain reduction is part of it. It does NOT guarantee a stain comes out completely, steam sanitize the whole vehicle, or remove the seats to get underneath them. Deep set stains want the extraction add-on and lingering smells want ozone.",
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
    priceCents: 6500,
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
    note: "A pre-wash to lift the loose grit before anything touches the paint, bug removal, a proper hand wash, blow dry and towel dry, and the wheels done properly: hubcaps, tires and wheel wells scrubbed, then tires dressed. It does NOT decontaminate or clay the paint, remove water spotting, clean the engine bay, or leave a ceramic sealant on it. The paint is clean but still not smooth, and there is no lasting protection. That is the step up to Full.",
    priceCents: 11500,
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
    tagline: "Strips what a wash cannot reach, then protects the paint underneath. Decontaminated, clayed, engine bay cleaned and sealed with ceramic.",
    note: "Everything in Basic, then the paint is actually decontaminated: iron and fallout dissolved chemically, a clay towel to shear off what is left, hard water spotting treated, the engine bay cleaned and protected, and a ceramic sealant applied so water beads and dirt struggles to stick. It does NOT correct the paint. Swirl marks, scratches and etching stay exactly as they are, and the sealant goes on over the top of them. Removing those means machine polishing, which is Showroom Ready.",
    priceCents: 21e3,
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
    tagline: "Everything in Full Exterior, then corrected and ceramic coated.",
    note: "Everything in Full Exterior, then the paint is machine corrected and a durable ceramic coating goes on the paint, wheels, plastic trim and glass. How much correction depends on the tier you pick below. It does NOT repair physical damage. Dents, rock chips and any scratch deep enough to have gone through the clear coat cannot be polished out, because correction removes a little clear coat, it does not add any. We will tell you what will and will not come out before we start.",
    priceCents: 21e3,
    durationMin: 240,
    requiresCorrectionTier: true,
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
  // 10% off the 2nd vehicle onward
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
  refundFullWindowHours: 72,
  refundMidWindowHours: 24
};

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

// lib/pricing/surcharge.ts
function minutesOfDay(hour, minute = 0) {
  return hour * 60 + minute;
}
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

// lib/availability/slots.ts
var DEFAULT_BOOKING_WINDOW = {
  earliestStartMin: 6 * 60,
  latestStartMin: 20 * 60,
  serviceEndByMin: 24 * 60
};
var IGNORE_RETURN_AFTER_MIN = 18 * 60;
var PREFERRED_STARTS = {
  weekday: [6 * 60, 8 * 60, 10 * 60, 16 * 60, 18 * 60, 20 * 60],
  weekend: [6 * 60, 8 * 60, 10 * 60, 16 * 60, 18 * 60, 20 * 60]
};
var TIME_WINDOWS = [
  { id: "early", label: "Early", fromMin: 6 * 60, toMin: 8 * 60, premium: true },
  { id: "morning", label: "Morning", fromMin: 10 * 60, toMin: 12 * 60, premium: false },
  { id: "afternoon", label: "Afternoon", fromMin: 12 * 60, toMin: 16 * 60, premium: false },
  { id: "evening", label: "Evening", fromMin: 16 * 60, toMin: 18 * 60, premium: false },
  { id: "late", label: "Late", fromMin: 18 * 60, toMin: 20 * 60, premium: true }
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
    if (vi > 0 && r.additionalVehicleDiscountBp > 0) {
      const sub = vLines.reduce((s, l) => s + l.amountCents, 0);
      const d = Math.round(sub * r.additionalVehicleDiscountBp / 1e4);
      if (d > 0) {
        lines.push({
          kind: "additional_vehicle_discount",
          label: "Bulk discount, " + r.additionalVehicleDiscountBp / 100 + "% off vehicle " + (vi + 1),
          vehicleIndex: vi,
          amountCents: -d,
          durationMin: 0
        });
      }
    }
  });
  const serviceSubtotalCents = lines.reduce((s, l) => s + l.amountCents, 0);
  const serviceDurationMin = lines.reduce((s, l) => s + l.durationMin, 0);
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
  const travelCents = travelIsEstimate ? 0 : mileageFeeCents(cart.oneWayMinutes, r.mileage);
  if (travelCents > 0) {
    lines.push({ kind: "travel", label: "Travel", vehicleIndex: null, amountCents: travelCents, durationMin: 0 });
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
  const depositCents = Math.round(totalCents * r.depositBp / 1e4);
  return {
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
    serviceDurationMin
  };
}

// lib/server-entry.ts
function priceFromWire(wire) {
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
  const cart = {
    vehicles,
    oneWayMinutes: null,
    surchargeContext: wire.slot ? { startMinutesLocal: localMinutesOfDay(wire.slot), priorityBooking: Boolean(wire.priority) } : wire.priority ? { startMinutesLocal: minutesOfDay(12), priorityBooking: true } : null,
    zip: wire.zip ?? null,
    ...wire.payInFull ? { payInFull: true } : {}
  };
  const q = quote(cart, DEFAULT_RULES, SEED_TAX_TABLE);
  return {
    totalCents: q.totalCents,
    serviceSubtotalCents: q.serviceSubtotalCents,
    surchargeBp: q.surchargeBp,
    serviceDurationMin: q.serviceDurationMin,
    lines: q.lines.map((l) => ({ label: l.label, amountCents: l.amountCents })),
    rejected
  };
}
export {
  ADDONS,
  COATING_COVERAGE,
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
  priceFromWire,
  quote,
  unavailableReason,
  vehicleSize
};

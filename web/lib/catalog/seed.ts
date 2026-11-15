import type { Catalog, Package, ServiceComponent } from "./types.js";

/**
 * Seed catalog. Prices confirmed with Elijah, September 2026.
 *
 * COMPONENT VALUES ARE NULL ON PURPOSE. See ServiceComponent.valueCents:
 * a component without a price cannot be added or removed, because inventing a
 * number would either overcharge a customer or quietly erode margin.
 * Customization switches on per component as Elijah prices them in admin.
 */

/* ===================== vehicle size ===================== */

/**
 * Flat upcharge applied ONCE PER VEHICLE, not per package, because it reflects
 * the vehicle rather than the work. A large SUV booked for interior and
 * exterior pays the $25 once.
 */
export interface VehicleSize {
  id: "small" | "medium" | "large";
  label: string;
  examples: string;
  upchargeCents: number;
  /**
   * Extra time a bigger vehicle takes, once per vehicle like the upcharge.
   * Owner, November 10: about 15 minutes more for medium and 30 for large.
   * It used to be zero, so a large SUV was scheduled into a small car's time.
   */
  extraMin: number;
}

export const VEHICLE_SIZES: VehicleSize[] = [
  { id: "small", label: "Small", examples: "Sedan, coupe, hatchback", upchargeCents: 0, extraMin: 0 },
  { id: "medium", label: "Medium", examples: "SUV, truck, crossover", upchargeCents: 1000, extraMin: 15 },
  { id: "large", label: "Large", examples: "3 row SUV, 7+ passenger van", upchargeCents: 2500, extraMin: 30 },
];

/* ===================== components ===================== */

const c = (
  id: string,
  name: string,
  category: "interior" | "exterior",
  durationMin: number,
  removable = true,
): ServiceComponent => ({
  id,
  name,
  category,
  durationMin,
  valueCents: null,
  materialsCostCents: null,
  removable,
});

const COMPONENTS: ServiceComponent[] = [
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
  c("ext-ceramic", "Ceramic wax sealant applied", "exterior", 45),
];

const BASIC_INT_IDS = ["int-blowout", "int-mats-clean", "int-surfaces", "int-grime"];

const FULL_INT_IDS = [
  "int-vac-deep",
  "int-engrained",
  "int-shampoo",
  "int-mats-dress",
  "int-leather",
  "int-glass",
  "int-jams",
  "int-crevice",
];

const BASIC_EXT_IDS = [
  "ext-prewash",
  "ext-bug",
  "ext-handwash",
  "ext-blow-towel",
  "ext-wheels",
  "ext-tire-dress",
];

/* ===================== packages ===================== */

const PACKAGES: Package[] = [
  /* ---------------- interior ---------------- */
  {
    id: "maintenance-interior",
    slug: "maintenance-interior",
    name: "Maintenance",
    category: "interior",
    tagline: "Keeps an already detailed car right, at a lower price.",
    note:
      "The same work as a Basic Interior, priced lower because a car detailed a month or two ago has far less built up in it. It resets the everyday mess: crumbs, dust, fingerprints, mats. It does NOT include shampooing, stain work or anything deep, because there should not be anything deep left. If it has been longer than three months, or something has been spilled since, start from Basic or Full instead.",
    notIncluded: ["Shampoo or stain work", "Deep cleaning: it keeps an already detailed car that way"],
    tip: "Been longer than three months, or a spill since? Start from Basic or Full instead.",
    priceCents: 11500,
    durationMin: 105,
    componentIds: [...BASIC_INT_IDS],
    featured: false,
    sortOrder: 0,
    /** Returning customers only, 1 to 3 months after a previous detail. */
    requiresPriorDetail: { minMonths: 1, maxMonths: 3 },
  },
  {
    id: "basic-interior",
    slug: "basic-interior",
    name: "Basic Interior",
    category: "interior",
    tagline: "A solid clean that gets the everyday grime out.",
    note:
      "A blowout and thorough vacuum through the seats, carpet and trunk, mats cleaned, surfaces wiped down, and the visible grime taken off. The car looks and feels clean when you get back in it. It does NOT shampoo or extract the upholstery, treat set-in stains, condition leather, or brush out every seam and crevice. A vacuum and air compressor blow out alone does not lift what has worked its way down into the upholstery, so engrained fibers, pet hair and grit in the carpet will not all come out, and stains already in the fabric will still be there. Most will come out with a Full Interior, or with Basic plus pet hair removal, a stain treatment, or both.",
    notIncluded: ["Shampooing or extracting the upholstery", "Treating set-in stains", "Leather conditioning", "Every seam and crevice brushed out"],
    tip: "Pet hair or stains? Add pet hair removal or a stain treatment, or pick Full Interior.",
    priceCents: 14500,
    durationMin: 120,
    componentIds: [...BASIC_INT_IDS],
    featured: false,
    sortOrder: 1,
  },
  {
    id: "full-interior",
    slug: "full-interior",
    name: "Full Interior",
    category: "interior",
    tagline: "A deep, top to bottom detail that makes it feel new again.",
    note:
      "Everything in Basic, then the deep work: engrained particles pulled out of the carpet, upholstery shampooed and scrubbed, mats washed and dressed, leather conditioned, glass and door jams cleaned, and every crack and crevice brush detailed. Stain reduction is part of it. It does NOT guarantee a stain comes out completely, steam sanitize the whole vehicle, or remove the seats to get underneath them. Most engrained fibers and pet hair come out at this level, but the truly stubborn ones woven deep into the carpet backing need the individual fiber lifting in Showroom Ready Restoration. Deep set stains want the Stain Treatment extra and lingering smells want the Ozone Odor Reset.",
    notIncluded: ["Every set-in stain gone completely: some only fade", "Steam sanitizing the whole vehicle", "Taking the seats out to clean underneath"],
    tip: "Deep stains or smells? Add a Stain Treatment or the Ozone Odor Reset. The most stubborn pet hair needs Showroom Ready Restoration.",
    priceCents: 23500,
    durationMin: 240,
    componentIds: [...FULL_INT_IDS],
    // "Most popular" moved to Full Interior + Steam, the lead offer (Elijah, November 12).
    featured: false,
    sortOrder: 2,
  },
  {
    // Elijah, November 11 to 13: Full Interior + Steam as its own package, the
    // lead offer. Its price is Full plus the $80 steam that Full gets, so the
    // steam extra on Full and this package always cost the same.
    id: "full-steam-interior",
    slug: "full-steam-interior",
    name: "Full Interior + Steam",
    category: "interior",
    tagline: "Our most popular detail: Full Interior with the whole cabin steam sanitized.",
    note:
      "Everything in Full Interior, then the whole vehicle steamed: every safe surface sanitized and scrubbed with heat rather than chemicals, into the vents, seams and seat rails that no cloth reaches. The heat kills bacteria on contact and everything dries in minutes. It does NOT guarantee a stain comes out completely or repair damage. Deep set stains want the Stain Treatment extra and lingering smells want the Ozone Odor Reset.",
    notIncluded: ["Every set-in stain gone completely: some only fade", "Repairing tears, burns or worn out material"],
    tip: "Deep stains or smells? Add a Stain Treatment or the Ozone Odor Reset.",
    priceCents: 31500,
    // Steam counts as an hour on top of Full here (Elijah, November 12).
    durationMin: 300,
    componentIds: [...FULL_INT_IDS, "int-steam-full"],
    featured: true,
    sortOrder: 3,
    supersetOf: "full-interior",
  },
  /* ---------------- exterior ---------------- */
  {
    id: "express-exterior",
    slug: "express-exterior",
    name: "Express Exterior",
    category: "exterior",
    tagline: "A clean hand wash and dry to bring back the shine.",
    note:
      "A rinse, hubcaps scrubbed, a gentle hand wash and a towel dry, with the windows and mirrors cleaned. It takes the surface dirt off and it is quick. It does NOT decontaminate or clay the paint, dress the tires, touch the engine bay, or leave any protection behind. The paint will still feel rough to the touch afterwards, because a wash cannot remove what is bonded to it.",
    notIncluded: ["Decontaminating or claying the paint", "Tire dressing", "The engine bay", "Any lasting protection"],
    tip: "Paint still rough to the touch? A wash cannot remove what is bonded to it. Basic or Full can.",
    priceCents: 7500,
    durationMin: 75,
    componentIds: ["ext-rinse-hubcaps", "ext-handwash-gentle", "ext-windows", "ext-towel-dry"],
    featured: false,
    sortOrder: 1,
  },
  {
    id: "basic-exterior",
    slug: "basic-exterior",
    name: "Basic Exterior",
    category: "exterior",
    tagline: "A thorough hand wash with wheels and tires done properly.",
    note:
      "A pre-wash to lift the loose grit before anything touches the paint, bug removal, a proper hand wash, blow dry and towel dry, and the wheels done properly: hubcaps, tires and wheel wells scrubbed, then tires dressed. It does NOT decontaminate or clay the paint, remove water spotting, clean the engine bay, or leave a ceramic wax sealant on it. The paint is clean but still not smooth, and there is no lasting protection. That is the step up to Full.",
    notIncluded: ["Decontaminating or claying the paint", "Removing water spotting", "The engine bay", "A ceramic wax sealant"],
    tip: "Want smooth, protected paint? That is the step up to Full Exterior.",
    priceCents: 12500,
    durationMin: 120,
    componentIds: [...BASIC_EXT_IDS],
    featured: true,
    sortOrder: 2,
  },
  {
    id: "full-exterior",
    slug: "full-exterior",
    name: "Full Exterior",
    category: "exterior",
    tagline:
      "Strips what a wash cannot reach, then protects the paint underneath. Decontaminated, clayed, engine bay cleaned and finished with a ceramic wax sealant.",
    note:
      "Everything in Basic, then the paint is actually decontaminated: iron and fallout dissolved chemically, a clay towel to shear off what is left, hard water spotting treated, the engine bay cleaned and protected, and a ceramic wax sealant applied so water beads and dirt struggles to stick. It does NOT correct the paint. Swirl marks, scratches and etching stay exactly as they are, and the sealant goes on over the top of them. Removing those means machine polishing, which is Paint Correction and Protection.",
    notIncluded: ["Correcting swirl marks, scratches or etching"],
    tip: "Want those gone? That takes machine polishing, which is Paint Correction and Protection.",
    priceCents: 24500,
    durationMin: 240,
    componentIds: [
      ...BASIC_EXT_IDS,
      "ext-paint-decon",
      "ext-clay-towel",
      "ext-water-spot",
      "ext-engine-bay",
      "ext-ceramic",
    ],
    featured: false,
    sortOrder: 3,
    supersetOf: "basic-exterior",
  },
  {
    id: "showroom-exterior",
    slug: "showroom-exterior",
    // Renamed from "Showroom Ready (Paint Correction and Protection)" (Elijah,
    // November 12; Emmett, November 14). The id stays, so old links still open.
    name: "Paint Correction and Protection",
    category: "exterior",
    // Everything in Full Exterior, then a required correction or coating
    // tier on top. The base here is the Full Exterior work; the tier adds its
    // own price and hours. See CORRECTION_TIERS in ./addons.ts.
    tagline:
      "Everything in Full Exterior, then the swirls come out and a real ceramic coating goes on. Pick how far to take it below.",
    note:
      "Everything in Full Exterior, then the paint is machine corrected and a durable ceramic coating goes on the paint, wheels, plastic trim and glass. How much correction depends on the tier you pick below. It does NOT repair physical damage. Dents, rock chips and any scratch deep enough to have gone through the clear coat cannot be polished out, because correction removes a little clear coat, it does not add any. We will tell you what will and will not come out before we start.",
    notIncluded: ["Repairing dents, rock chips or scratches through the clear coat"],
    tip: "We will tell you what will and will not come out before we start.",
    priceCents: 24500,
    durationMin: 240,
    requiresCorrectionTier: true,
    // Not taking these yet. Listed with a price and an explanation so people
    // can see it is coming and say they want it.
    comingSoon: true,
    comingSoonNote:
      "We are building up to correction work. Register your interest and we will come to you first when it opens.",
    schedulingDurationMin: 480,
    componentIds: [
      ...BASIC_EXT_IDS,
      "ext-paint-decon",
      "ext-clay-towel",
      "ext-water-spot",
      "ext-engine-bay",
      "ext-ceramic",
    ],
    featured: false,
    sortOrder: 4,
    supersetOf: "full-exterior",
    pricePlus: true,
  },
];

export const SEED_CATALOG: Catalog = {
  components: Object.fromEntries(COMPONENTS.map((x) => [x.id, x])),
  packages: PACKAGES,
};

export function packagesFor(category: "interior" | "exterior"): Package[] {
  return SEED_CATALOG.packages
    .filter((p) => p.category === category)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * Packages that no longer exist, and what an old quote link, saved draft or
 * cached page asking for one gets instead (November 14). Showroom Ready
 * (interior) became Full Interior plus the Showroom Ready Restoration add-on.
 */
export const LEGACY_PACKAGES: Record<string, { packageId: string; addons: { addonId: string; tierId: string }[] }> = {
  "showroom-interior": { packageId: "full-interior", addons: [{ addonId: "showroom-restoration", tierId: "std" }] },
};

/** A vehicle's packages and add-ons with any retired package swapped for its replacement. */
export function upgradeLegacy<A extends { addonId: string; tierId: string }>(
  packageIds: readonly string[],
  addons: readonly A[],
): { packageIds: string[]; addons: { addonId: string; tierId: string }[] } {
  const ids: string[] = [];
  const extra: { addonId: string; tierId: string }[] = [];
  for (const id of packageIds) {
    const to = LEGACY_PACKAGES[id];
    if (!to) { ids.push(id); continue; }
    if (!ids.includes(to.packageId)) ids.push(to.packageId);
    for (const a of to.addons) if (!addons.some((x) => x.addonId === a.addonId) && !extra.some((x) => x.addonId === a.addonId)) extra.push(a);
  }
  return { packageIds: ids, addons: [...addons.map((a) => ({ addonId: a.addonId, tierId: a.tierId })), ...extra] };
}

export function findPackage(id: string): Package | undefined {
  return SEED_CATALOG.packages.find((p) => p.id === id);
}

export function vehicleSize(id: string): VehicleSize | undefined {
  return VEHICLE_SIZES.find((v) => v.id === id);
}

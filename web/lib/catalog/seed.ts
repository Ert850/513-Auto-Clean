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
}

export const VEHICLE_SIZES: VehicleSize[] = [
  { id: "small", label: "Small", examples: "Sedan, coupe, hatchback", upchargeCents: 0 },
  { id: "medium", label: "Medium", examples: "SUV, truck, crossover", upchargeCents: 1000 },
  { id: "large", label: "Large", examples: "3 row SUV, 7+ passenger van", upchargeCents: 2500 },
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
  c("ext-ceramic", "Ceramic sealant applied", "exterior", 45),
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
    tagline: "Keeps a already-detailed car right, at a lower price.",
    priceCents: 9500,
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
    priceCents: 12500,
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
    priceCents: 21500,
    durationMin: 240,
    componentIds: [...FULL_INT_IDS],
    featured: true,
    sortOrder: 2,
  },
  {
    id: "showroom-interior",
    slug: "showroom-interior",
    name: "Showroom Ready",
    category: "interior",
    tagline: "Everything in Full, taken to its limit.",
    priceCents: 39500,
    durationMin: 420, // 6 to 8 hours, quoted at 7
    durationMaxMin: 480,
    componentIds: [
      ...FULL_INT_IDS,
      "int-steam-full",
      "int-fiber-removal",
      "int-mat-protect",
      "int-trim-ceramic",
      "int-metal-ceramic",
    ],
    featured: false,
    sortOrder: 3,
    supersetOf: "full-interior",
    pricePlus: true,
  },

  /* ---------------- exterior ---------------- */
  {
    id: "express-exterior",
    slug: "express-exterior",
    name: "Express Exterior",
    category: "exterior",
    tagline: "A clean hand wash and dry to bring back the shine.",
    priceCents: 6500,
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
    priceCents: 11500,
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
      "Strips what a wash cannot reach, then protects the paint underneath. Decontaminated, clayed, engine bay cleaned and sealed with ceramic.",
    priceCents: 21000,
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
    name: "Showroom Ready",
    category: "exterior",
    // Everything in Full Exterior, then a required correction or coating
    // tier on top. The base here is the Full Exterior work; the tier adds its
    // own price and hours. See CORRECTION_TIERS in ./addons.ts.
    tagline: "Everything in Full Exterior, then corrected and ceramic coated.",
    priceCents: 21000,
    durationMin: 240,
    requiresCorrectionTier: true,
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

export function findPackage(id: string): Package | undefined {
  return SEED_CATALOG.packages.find((p) => p.id === id);
}

export function vehicleSize(id: string): VehicleSize | undefined {
  return VEHICLE_SIZES.find((v) => v.id === id);
}

import type { Catalog, Package, ServiceComponent } from "./types.js";

/**
 * Seed catalog. Prices confirmed with Elijah; component wording is verbatim
 * from the live site so the funnel and the marketing page never disagree.
 *
 * COMPONENT VALUES ARE NULL ON PURPOSE. See ServiceComponent.valueCents,
 * a component without a price cannot be added or removed, because inventing
 * a number here would either overcharge a customer or quietly erode margin.
 * Customization switches on per-component as Elijah prices them in admin.
 */

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
  // ---- interior ----
  c("int-vac-quick", "Quick vacuum of seats & carpets", "interior", 20, false),
  c("int-vac-full", "Full vacuum of seats & carpets", "interior", 30, false),
  c("int-vac-deep", "Thorough vacuum, seats, carpets & trunk", "interior", 45, false),
  c("int-mats-rinse", "Rinse & refresh floor mats", "interior", 10),
  c("int-mats-clean", "Clean & rinse floor mats", "interior", 15),
  c("int-mats-dress", "Wash & dress floor mats", "interior", 20),
  c("int-wipe", "Wipe down surfaces", "interior", 15),
  c("int-trim-wipe", "Wipe trim & all surfaces", "interior", 20),
  c("int-glass", "Clean interior glass", "interior", 10),
  c("int-glass-all", "Clean all glass", "interior", 15),
  c("int-crevice", "Brush-detail tight crevices", "interior", 25),
  c("int-crevice-deep", "Clean glass & detail every crevice", "interior", 35),
  c("int-shampoo", "Shampoo upholstery & steam-treat stains", "interior", 75),
  c("int-leather", "Condition leather, restore & protect trim", "interior", 45),

  // ---- exterior ----
  c("ext-rinse-hubcaps", "Rinse exterior & scrub hubcaps", "exterior", 15, false),
  c("ext-prewash", "Pre-wash", "exterior", 15, false),
  c("ext-bugtar", "Bug & tar treatment", "exterior", 20),
  c("ext-handwash-gentle", "Gentle hand wash", "exterior", 25, false),
  c("ext-handwash", "Hand wash", "exterior", 30, false),
  c("ext-windows", "Clean windows & mirrors", "exterior", 10),
  c("ext-towel-dry", "Towel dry all surfaces", "exterior", 15),
  c("ext-blow-towel", "Blow dry & towel dry", "exterior", 20),
  c("ext-wheels", "Wheels: hubcaps, tires & wheel wells scrubbed", "exterior", 30),
  c("ext-tire-dress", "Tire dressing & protection", "exterior", 10),
  c("ext-paint-decon", "Paint decontamination", "exterior", 45),
  c("ext-water-spot", "Hard water spot treatment", "exterior", 30),
  c("ext-engine-bay", "Engine bay clean & protect", "exterior", 30),
  c("ext-ceramic", "Ceramic sealant applied", "exterior", 45),
];

const BASIC_EXT_IDS = [
  "ext-prewash",
  "ext-bugtar",
  "ext-handwash",
  "ext-blow-towel",
  "ext-wheels",
  "ext-tire-dress",
];

const PACKAGES: Package[] = [
  {
    id: "express-interior",
    slug: "express-interior",
    name: "Express Interior",
    category: "interior",
    tagline: "A fast reset for a car that just needs a quick refresh.",
    priceCents: 8500,
    durationMin: 75,
    componentIds: ["int-vac-quick", "int-mats-rinse", "int-wipe", "int-glass"],
    featured: false,
    sortOrder: 1,
  },
  {
    id: "basic-interior",
    slug: "basic-interior",
    name: "Basic Interior",
    category: "interior",
    tagline: "A solid clean that gets the everyday grime out.",
    priceCents: 11500,
    durationMin: 120,
    componentIds: [
      "int-vac-full",
      "int-mats-clean",
      "int-trim-wipe",
      "int-glass-all",
      "int-crevice",
    ],
    featured: false,
    sortOrder: 2,
  },
  {
    id: "full-interior",
    slug: "full-interior",
    name: "Full Interior",
    category: "interior",
    tagline: "A deep, top-to-bottom detail that makes it feel new again.",
    priceCents: 19500,
    durationMin: 240,
    componentIds: [
      "int-vac-deep",
      "int-shampoo",
      "int-mats-dress",
      "int-leather",
      "int-crevice-deep",
    ],
    featured: true,
    sortOrder: 3,
  },
  {
    id: "express-exterior",
    slug: "express-exterior",
    name: "Express Exterior",
    category: "exterior",
    tagline: "A clean hand wash and dry to bring back the shine.",
    priceCents: 6500,
    durationMin: 75,
    componentIds: [
      "ext-rinse-hubcaps",
      "ext-handwash-gentle",
      "ext-windows",
      "ext-towel-dry",
    ],
    featured: false,
    sortOrder: 4,
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
    sortOrder: 5,
  },
  {
    id: "full-exterior",
    slug: "full-exterior",
    name: "Full Exterior",
    category: "exterior",
    // Deliberately a strict superset of Basic, that ladder is the whole
    // reason to step up, so the composition makes it literal.
    tagline: "The full restore, decon, protect & seal with ceramic.",
    priceCents: 21000,
    durationMin: 240,
    componentIds: [
      ...BASIC_EXT_IDS,
      "ext-paint-decon",
      "ext-water-spot",
      "ext-engine-bay",
      "ext-ceramic",
    ],
    featured: false,
    sortOrder: 6,
  },
];

export const SEED_CATALOG: Catalog = {
  components: Object.fromEntries(COMPONENTS.map((x) => [x.id, x])),
  packages: PACKAGES,
};

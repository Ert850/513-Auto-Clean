// lib/catalog/addons.ts
var ADDONS = [
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
    tiers: [{ id: "std", label: "Front seats out", priceCents: 1e4, durationMin: 120 }]
  },
  /* ---------------- exterior ---------------- */
  {
    id: "headlight",
    name: "Headlight Restoration",
    scope: "exterior",
    description: "Oxidation removal, 2000 grit wet sand, 3000 grit wet sand, dry, then ceramic coated.",
    tiers: [{ id: "std", label: "Both headlights", priceCents: 7500, durationMin: 90 }]
  },
  {
    id: "tire-rim-shine",
    name: "Tire and Rim Shine",
    scope: "exterior",
    description: "Deep clean and dress the tires and rims.",
    tiers: [{ id: "std", label: "All four", priceCents: null, durationMin: 30 }]
  },
  {
    id: "paint-decon",
    name: "Paint Decontamination",
    scope: "exterior",
    description: "Chemical decontamination to strip embedded iron and fallout. Required before any paint correction.",
    tiers: [{ id: "std", label: "Full vehicle", priceCents: null, durationMin: 45 }]
  },
  {
    id: "clay-bar",
    name: "Clay Bar",
    scope: "exterior",
    description: "Mechanically lifts anything decontamination leaves behind, all panels.",
    tiers: [{ id: "std", label: "All panels", priceCents: null, durationMin: 60 }]
  },
  {
    id: "hard-water",
    name: "Hard Water Spot Removal",
    scope: "exterior",
    description: "For etched sprinkler and well water spotting on paint and glass.",
    tiers: [{ id: "std", label: "Full vehicle", priceCents: null, durationMin: 60 }]
  },
  {
    id: "engine-bay",
    name: "Engine Bay Detail",
    scope: "exterior",
    description: "Cleaned, dressed and protected.",
    tiers: [{ id: "std", label: "Engine bay", priceCents: null, durationMin: 30 }]
  }
];
function findAddon(id) {
  return ADDONS.find((a) => a.id === id);
}
var MAINTENANCE_PLAN = {
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
    "Sealant application twice a year"
  ]
};

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
  c("ext-bugtar", "Bug and tar treatment", "exterior", 20),
  c("ext-handwash-gentle", "Gentle hand wash", "exterior", 25, false),
  c("ext-handwash", "Hand wash", "exterior", 30, false),
  c("ext-windows", "Clean windows and mirrors", "exterior", 10),
  c("ext-towel-dry", "Towel dry all surfaces", "exterior", 15),
  c("ext-blow-towel", "Blow dry and towel dry", "exterior", 20),
  c("ext-wheels", "Wheels: hubcaps, tires and wheel wells scrubbed", "exterior", 30),
  c("ext-tire-dress", "Tire dressing and protection", "exterior", 10),
  c("ext-paint-decon", "Paint decontamination", "exterior", 45),
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
  "ext-bugtar",
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
    tagline: "The full restore: decon, protect and seal with ceramic.",
    priceCents: 21e3,
    durationMin: 240,
    componentIds: [
      ...BASIC_EXT_IDS,
      "ext-paint-decon",
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
    name: "Showroom Ready",
    category: "exterior",
    // PRICE TO CONFIRM: mirrors the interior Showroom at $395 because no
    // separate exterior figure was given. It is an anchor, so the exact
    // number matters less than that it sits clearly above Full.
    tagline: "Everything in Full, taken to its limit. Not a paint correction.",
    priceCents: 39500,
    durationMin: 420,
    durationMaxMin: 480,
    componentIds: [
      ...BASIC_EXT_IDS,
      "ext-paint-decon",
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
function findPackage(id) {
  return SEED_CATALOG.packages.find((p) => p.id === id);
}
function vehicleSize(id) {
  return VEHICLE_SIZES.find((v) => v.id === id);
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
  comboDiscountCents: 1500,
  // $15
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
        amountCents: c2.priceCents,
        durationMin: c2.durationMin
      });
      if (c2.coatingAddCents > 0) {
        vLines.push({
          kind: "coating",
          label: "Ceramic coating, " + c2.coatingLabel,
          vehicleIndex: vi,
          amountCents: c2.coatingAddCents,
          durationMin: 0
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
    return {
      label: wv.label ?? "Vehicle",
      sizeUpchargeCents: size?.upchargeCents ?? 0,
      sizeLabel: size?.label ?? "",
      packages,
      addons
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
  DEFAULT_RULES,
  findAddon,
  findPackage,
  priceFromWire,
  quote,
  vehicleSize
};

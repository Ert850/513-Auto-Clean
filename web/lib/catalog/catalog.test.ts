import { describe, expect, it } from "vitest";
import {
  ADDONS,
  CORRECTION_ADD_CENTS,
  CORRECTION_TIERS,
  addonBlockedReason,
  addonsFor,
  findAddon,
  isSelectable,
  isUnpriced,
  unavailableReason,
} from "./addons.js";
import { ADDON_ICONS, addonIcon } from "./icons.js";
import { popularityOf } from "./popularity.js";
import { ZIP_GEO, zipGeo } from "../travel/zipGeo.js";
import { ZIP_RANGES } from "../travel/zipRanges.js";

const get = (id: string) => {
  const a = findAddon(id);
  if (!a) throw new Error("no add-on " + id);
  return a;
};

const ctx = (packageIds: string[], addonTiers: { addonId: string; tierId: string }[] = []) => ({
  packageIds,
  addonTiers,
});

describe("add-on pricing", () => {
  it("has a price on every add-on, including the ones not bookable yet", () => {
    const unpriced = ADDONS.filter(isUnpriced).map((a) => a.id);
    expect(unpriced).toEqual([]);
  });

  it("keeps correction work visible and priced, but not selectable", () => {
    for (const id of ["ceramic-coating", "paint-polish", "paint-correction"]) {
      const a = get(id);
      expect(isSelectable(a), id).toBe(false);
      expect(isUnpriced(a), id).toBe(false);
      expect(unavailableReason(a), id).toBeTruthy();
    }
  });

  it("says only 'temporarily unavailable' on polish and correction", () => {
    expect(unavailableReason(get("paint-polish"))).toBe("Temporarily unavailable.");
    expect(unavailableReason(get("paint-correction"))).toBe("Temporarily unavailable.");
  });

  it("quotes correction at the same numbers as the Showroom Ready tiers", () => {
    expect(get("ceramic-coating").tiers[0]!.priceCents).toBe(CORRECTION_ADD_CENTS.coatingOnly);
    expect(get("paint-polish").tiers[0]!.priceCents).toBe(CORRECTION_ADD_CENTS.oneStep);
    expect(get("paint-correction").tiers.map((t) => t.priceCents)).toEqual([
      CORRECTION_ADD_CENTS.twoStep,
      CORRECTION_ADD_CENTS.threeStep,
    ]);
    // The tier list is the other consumer of the same constant.
    expect(CORRECTION_TIERS.map((t) => t.addCents)).toEqual([
      CORRECTION_ADD_CENTS.coatingOnly,
      CORRECTION_ADD_CENTS.oneStep,
      CORRECTION_ADD_CENTS.twoStep,
      CORRECTION_ADD_CENTS.threeStep,
    ]);
  });

  it("does not call the wax sealant a coating", () => {
    const a = get("ceramic-sealant");
    expect(a.name).toBe("Ceramic Wax Sealant");
    expect(a.description.toLowerCase()).toContain("not a ceramic coating");
  });
});

describe("add-on presentation", () => {
  it("gives every add-on a description that fits the card", () => {
    // The grid went ragged when one blurb was thirty characters and its
    // neighbour was a hundred and eighty. Enforced rather than eyeballed.
    const bad = ADDONS.filter((a) => a.description.length < 45 || a.description.length > 80)
      .map((a) => `${a.id} (${a.description.length})`);
    expect(bad).toEqual([]);
  });

  it("returns add-ons cheapest first, in both scopes", () => {
    for (const scope of ["interior", "exterior"] as const) {
      const prices = addonsFor(scope).map((a) => {
        const priced = a.tiers.filter((t) => t.priceCents !== null).map((t) => t.priceCents!);
        return priced.length ? Math.min(...priced) : Number.POSITIVE_INFINITY;
      });
      const sorted = prices.slice().sort((x, y) => x - y);
      expect(prices, scope).toEqual(sorted);
    }
  });

  it("gives every add-on its own icon, not a shared default", () => {
    const missing = ADDONS.filter((a) => !ADDON_ICONS[a.icon]).map((a) => a.id);
    expect(missing).toEqual([]);
    const used = new Set(ADDONS.map((a) => a.icon));
    expect(used.size).toBe(ADDONS.length);
  });

  it("falls back to a shape rather than to nothing", () => {
    expect(addonIcon(undefined)).toContain("<circle");
    expect(addonIcon("no-such-icon")).toContain("<circle");
  });
});

describe("add-on availability rules", () => {
  it("will not clay paint that has not been chemically decontaminated", () => {
    const clay = get("clay-bar");
    expect(addonBlockedReason(clay, ctx(["basic-exterior"]))).toMatch(/decontamination/i);
    expect(
      addonBlockedReason(clay, ctx(["basic-exterior"], [{ addonId: "paint-decon", tierId: "std" }])),
    ).toBeNull();
  });

  it("refuses to sell work the chosen package already contains", () => {
    for (const id of ["paint-decon", "clay-bar", "hard-water", "engine-bay", "ceramic-sealant"]) {
      expect(addonBlockedReason(get(id), ctx(["full-exterior"])), id).toMatch(/already included/i);
      expect(addonBlockedReason(get(id), ctx(["showroom-exterior"])), id).toMatch(/already included/i);
    }
  });

  it("still sells those add-ons on top of a Basic Exterior", () => {
    expect(addonBlockedReason(get("paint-decon"), ctx(["basic-exterior"]))).toBeNull();
    expect(addonBlockedReason(get("hard-water"), ctx(["basic-exterior"]))).toBeNull();
    expect(addonBlockedReason(get("engine-bay"), ctx(["basic-exterior"]))).toBeNull();
    expect(addonBlockedReason(get("ceramic-sealant"), ctx(["basic-exterior"]))).toBeNull();
  });

  it("treats wheels as included from Basic Exterior up, but not on Express", () => {
    const tires = get("tire-rim-shine");
    expect(addonBlockedReason(tires, ctx(["express-exterior"]))).toBeNull();
    expect(addonBlockedReason(tires, ctx(["basic-exterior"]))).toMatch(/already included/i);
  });

  it("leaves interior add-ons alone", () => {
    for (const a of addonsFor("interior")) {
      // Ozone is the one interior add-on with a requirement, and it is a
      // prerequisite rather than an overlap.
      if (a.id === "ozone") continue;
      expect(addonBlockedReason(a, ctx(["full-interior"])), a.id).toBeNull();
    }
  });
});

describe("most popular ranking", () => {
  it("starts on Full Interior and Basic Exterior, as Elijah seeded it", () => {
    const packages = [
      "full-interior",
      "basic-exterior",
      "basic-interior",
      "full-exterior",
      "express-exterior",
      "showroom-interior",
      "showroom-exterior",
    ];
    const ranked = packages.slice().sort((a, b) => popularityOf(b) - popularityOf(a));
    expect(ranked[0]).toBe("full-interior");
    expect(ranked[1]).toBe("basic-exterior");
  });

  it("sorts anything unranked to the bottom rather than the top", () => {
    expect(popularityOf("something-new")).toBe(0);
    expect(popularityOf("full-interior")).toBeGreaterThan(0);
  });

  it("ranks every add-on and package that exists", () => {
    const unranked = ADDONS.filter((a) => popularityOf(a.id) === 0).map((a) => a.id);
    expect(unranked).toEqual([]);
  });
});

describe("travel map geography", () => {
  it("has a map point for every ZIP we price", () => {
    const missing = ZIP_RANGES.filter((z) => !zipGeo(z.zip)).map((z) => z.zip);
    expect(missing).toEqual([]);
  });

  it("has no map point we cannot price", () => {
    const priced = new Set(ZIP_RANGES.map((z) => z.zip));
    const orphans = ZIP_GEO.filter((g) => !priced.has(g.zip)).map((g) => g.zip);
    expect(orphans).toEqual([]);
  });

  it("keeps every point inside the Cincinnati region", () => {
    for (const g of ZIP_GEO) {
      expect(g.lat, g.zip).toBeGreaterThan(38.5);
      expect(g.lat, g.zip).toBeLessThan(40);
      expect(g.lon, g.zip).toBeGreaterThan(-85.5);
      expect(g.lon, g.zip).toBeLessThan(-84);
    }
  });

  it("puts the compass the right way round", () => {
    const at = (z: string) => {
      const p = zipGeo(z);
      if (!p) throw new Error("no point " + z);
      return p;
    };
    expect(at("45011").lat).toBeGreaterThan(at("45202").lat); // Hamilton north of downtown
    expect(at("41042").lat).toBeLessThan(at("45202").lat); // Florence south of downtown
    expect(at("45230").lon).toBeGreaterThan(at("45238").lon); // Anderson east of Delhi
    expect(at("47025").lon).toBeLessThan(at("45220").lon); // Lawrenceburg west of Clifton
  });
});

describe("the add-on price list, as advertised", () => {
  const tier = (addonId: string, tierId = "std") =>
    findAddon(addonId)!.tiers.find((t) => t.id === tierId)!;

  it("charges what the page says", () => {
    expect(tier("ceramic-sealant").priceCents).toBe(3500);
    expect(tier("clay-bar").priceCents).toBe(3500);
    expect(tier("tire-rim-shine").priceCents).toBe(4500);
    expect(tier("paint-decon").priceCents).toBe(4500);
    expect(tier("hard-water").priceCents).toBe(5000);
    expect(tier("engine-bay").priceCents).toBe(5000);
  });

  it("keeps correction work off the menu until the setup exists", () => {
    for (const id of ["scratch-reduction", "ceramic-coating", "paint-polish", "paint-correction"]) {
      const a = findAddon(id)!;
      expect(a.unavailable, id).toBe(true);
      expect(isSelectable(a), id).toBe(false);
      // Listed with a reason rather than hidden: someone who wants it should
      // be able to see it is coming and say so.
      expect(unavailableReason(a), id).toBeTruthy();
      expect(a.tiers.some((t) => t.priceCents !== null), `${id} still shows a price`).toBe(true);
    }
  });

  it("everything still bookable has a price on every tier", () => {
    for (const a of ADDONS.filter((x) => isSelectable(x))) {
      for (const t of a.tiers) {
        expect(t.priceCents, `${a.id}/${t.id}`).toBeGreaterThan(0);
      }
    }
  });
});

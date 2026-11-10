import { describe, expect, it } from "vitest";
import { recommendAddons } from "./recommend.js";

const all = {
  interior: ["pet-hair", "stain", "ozone", "steam", "seat-removal"],
  exterior: ["tire-rim-shine", "engine-bay", "headlight", "paint-decon", "clay-bar"],
};

describe("recommendAddons", () => {
  it("uses the hand-picked order, three for one side of the car", () => {
    expect(recommendAddons({ candidates: all, sides: ["interior"] })).toEqual(["pet-hair", "stain", "ozone"]);
  });

  it("gives two a side when the booking is both", () => {
    expect(recommendAddons({ candidates: all, sides: ["interior", "exterior"] }))
      .toEqual(["pet-hair", "stain", "tire-rim-shine", "engine-bay"]);
  });

  it("skips what the package already covers, and fills from further down", () => {
    // Full Exterior includes tire shine and the engine bay.
    const fullExterior = { interior: [], exterior: ["headlight", "paint-decon", "clay-bar"] };
    expect(recommendAddons({ candidates: fullExterior, sides: ["exterior"] })).toEqual(["headlight", "paint-decon"]);
  });

  it("lets analytics scores outrank the hand-picked order", () => {
    const signals = { score: { "seat-removal": 0.4, ozone: 0.9 } };
    expect(recommendAddons({ candidates: all, sides: ["interior"], signals }))
      .toEqual(["ozone", "seat-removal", "pet-hair"]);
  });

  it("never recommends something the vehicle cannot take", () => {
    const signals = { score: { "paint-correction": 1 } };
    expect(recommendAddons({ candidates: all, sides: ["exterior"], signals })).not.toContain("paint-correction");
  });
});

/** Book link words come from config/booking-page.json bookLinkParams; values from the catalog. */
import { describe, expect, it } from "vitest";
import { BOOK_INTENTS, BOOK_LINK_PARAMS, arrivalQuery, parseArrival } from "./bookLinks.js";

describe("Book link parameters", () => {
  it("round-trip every kind through the address", () => {
    for (const [kind, id] of [["package", "full-interior"], ["interest", "showroom-exterior"], ["intent", "exterior"], ["browse", "1"]] as const) {
      const q = arrivalQuery(kind, id);
      expect(q).toBe(`?${BOOK_LINK_PARAMS[kind]}=${id}`);
      expect(parseArrival(q)).toEqual({ kind, id });
    }
  });
  it("only accept what the catalog has", () => {
    expect(BOOK_INTENTS).toEqual(expect.arrayContaining(["interior", "exterior"]));
    expect(arrivalQuery("intent", "boats")).toBe("");
    expect(arrivalQuery("package", "no-such-package")).toBe("");
    expect(parseArrival(`?${BOOK_LINK_PARAMS.package}=no-such-package`)).toBeNull();
    expect(parseArrival("?utm_source=gbp")).toBeNull();
  });
});

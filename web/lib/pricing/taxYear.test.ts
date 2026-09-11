/**
 * The alarm for stale sales tax rates.
 *
 * The rate table carries the year it was verified. Nothing else reads that
 * year: there is no admin panel yet to show a warning in. So this test IS
 * the warning. On 1 January of the year after `ratesStaleAfter` it starts
 * failing, the build goes red, and somebody has to either verify the rates
 * for the new year and bump the field, or knowingly charge last year's
 * numbers. Silent was the alternative, and silent is how a business ends up
 * remitting the wrong amount for a year.
 */
import { describe, expect, it } from "vitest";
import { SEED_TAX_TABLE } from "./tax.js";

describe("sales tax rates are current", () => {
  it(`rates were verified for ${SEED_TAX_TABLE.ratesStaleAfter} and it is not later than that`, () => {
    const year = new Date().getFullYear();
    expect(
      year,
      `It is ${year} and the tax table was last verified for ${SEED_TAX_TABLE.ratesStaleAfter}. ` +
        "Check each county's combined rate at tax.ohio.gov (and KY and IN), update lib/pricing/tax.ts, " +
        "then set ratesStaleAfter and every verifiedYear to the current year.",
    ).toBeLessThanOrEqual(SEED_TAX_TABLE.ratesStaleAfter);
  });

  it("every row was verified in the same year the table claims", () => {
    for (const r of SEED_TAX_TABLE.rates) {
      expect(r.verifiedYear, `${r.county}, ${r.state}`).toBe(SEED_TAX_TABLE.ratesStaleAfter);
    }
  });
});

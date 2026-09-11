import { describe, expect, it } from "vitest";
import snapshot from "../../../data/reviews.json" with { type: "json" };

/**
 * The reviews snapshot is maintained by hand between Google pulls, so these
 * guard the two things that break when it is edited in a hurry: a date that
 * does not parse, and a headline count that stops matching the page.
 */
describe("reviews snapshot", () => {
  const reviews = snapshot.reviews as Array<{
    author: string;
    rating: number;
    date: string;
    text: string;
  }>;

  it("counts what it claims to count", () => {
    expect(reviews.length).toBe(snapshot.count);
  });

  it("stores an absolute date on every review", () => {
    // Absolute, never "2 months ago". The phrase is computed at page load, so
    // a snapshot taken today still reads correctly a year from now.
    for (const r of reviews) {
      expect(r.date, r.author).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(r.date)), r.author).toBe(false);
    }
  });

  it("has no review dated after it was taken", () => {
    const taken = Date.parse(snapshot.fetchedOn);
    for (const r of reviews) {
      expect(Date.parse(r.date), r.author).toBeLessThanOrEqual(taken);
    }
  });

  it("has a headline rating consistent with the ratings it lists", () => {
    const mean = reviews.reduce((t, r) => t + r.rating, 0) / reviews.length;
    // Google rounds to one decimal, so allow that much drift and no more.
    expect(Math.abs(mean - snapshot.rating)).toBeLessThan(0.05);
  });

  it("rates every review between 1 and 5", () => {
    for (const r of reviews) {
      expect(r.rating, r.author).toBeGreaterThanOrEqual(1);
      expect(r.rating, r.author).toBeLessThanOrEqual(5);
    }
  });
});

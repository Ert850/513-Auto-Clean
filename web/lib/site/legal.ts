/**
 * When the legal pages last changed, by hand.
 *
 * These used to be the build date, which meant every deploy announced a new
 * version of the terms nobody had written, and section 14 ("the version that
 * applies is the one published when you booked") pointed at nothing.
 *
 * Bump the date when the WORDING changes. legal.test.ts keeps a hash of each
 * rendered page in legal.lock.json and fails if the words moved but the date
 * did not, so this cannot be forgotten. Run `npm run lock:legal` after a
 * deliberate change to record the new hash.
 *
 * The terms version is also what the funnel sends with a booking, so a card
 * network asking "what did they agree to" gets a date that points at exactly
 * one document.
 */
export const LEGAL = {
  /*
   * The date each document last CHANGED, not the date it was last built.
   *
   * These move independently and only when the wording actually differs,
   * because the terms date is what a consent record points at: bumping it
   * for an unchanged document sends somebody looking for a version that
   * says exactly what the old one said. `legal.test.ts` compares the built
   * page against legal.lock.json and fails the build if the words moved and
   * the date did not.
   *
   * Both are 2026-09-14 because Stripe and Resend came back on together: the
   * terms describe taking a card again, and the privacy policy names two
   * more processors.
   */
  termsEffective: "2026-09-14",
  privacyEffective: "2026-09-14",
} as const;

export function longDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

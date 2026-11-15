/**
 * The before/after hero of the city and service pages: one gallery pair,
 * side by side, each photo labelled, captioned with the gallery's own words.
 *
 * Shared so both page types show a pair (Emmett, November 15: the Delhi page
 * showed an "after" with no "before", captioned with a place nobody had
 * checked). A caption never claims where a job was: that waits for Elijah's
 * local jobs (localJobs).
 */
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The two photos of a pair, each labelled. `hero` loads the first one early; the rest load lazily. */
export function pairPics(pair, hero = false) {
  const pic = (side, alt) =>
    `<span class="svp-split-pic"><img src="images/ba-${pair.slug}-${side}-760.webp" alt="${esc(alt)}" width="380" height="507"${hero ? (side === "before" ? ' fetchpriority="high"' : "") : ' loading="lazy"'} decoding="async" /><b class="svp-split-tag">${side === "before" ? "Before" : "After"}</b></span>`;
  return pic("before", pair.altBefore) + pic("after", pair.altAfter);
}

export function splitHero(pair) {
  return `      <figure class="loc-hero-pic svp-split"><span class="svp-split-pics">${pairPics(pair, true)}</span><figcaption>${esc(pair.caption)}</figcaption></figure>`;
}

/**
 * Before/after photos of the city and service pages.
 *
 * The hero is a carousel of gallery pairs (Emmett, November 15: "you cannot
 * properly show the value of a service without the before and after"; his
 * pick, option A of docs/mockups/eNov15-carousel-*). It is the home page's
 * Results carousel, one card in view: the cards are written here, into the
 * page, so the photos and their alt text are in the HTML and the first photo
 * can be the page's largest paint (docs/SEO-COMPLIANCE.md, images and Core Web
 * Vitals). js/gallery.js finds them already there and only adds the wipe and
 * the controls. The card markup is js/gallery.js card(); change both together
 * (web/lib/site/locations.test.ts compares them).
 *
 * A caption never claims where a job was: that waits for Elijah's local jobs
 * (localJobs).
 */
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The two photos of a pair side by side, each labelled, loaded lazily (local job cards). */
export function pairPics(pair) {
  const pic = (side, alt) =>
    `<span class="svp-split-pic"><img src="images/ba-${pair.slug}-${side}-760.webp" alt="${esc(alt)}" width="380" height="507" loading="lazy" decoding="async" /><b class="svp-split-tag">${side === "before" ? "Before" : "After"}</b></span>`;
  return pic("before", pair.altBefore) + pic("after", pair.altAfter);
}

/** How wide the hero card is painted: the hero's right column from 1000px (styles.css .loc-hero-grid), else the page. */
const HERO_SIZES = "(min-width: 1000px) 520px, 92vw";

const CHEV =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M8 7l-5 5 5 5M16 7l5 5-5 5"/></svg>';

function photo(pair, side, alt, first) {
  const widths = pair.widths?.length ? pair.widths : [420, 760];
  const srcset = widths.map((w) => `images/ba-${pair.slug}-${side}-${w}.webp ${w}w`).join(", ");
  return `<picture><source type="image/webp" sizes="${HERO_SIZES}" srcset="${srcset}" />` +
    `<img class="ba-img" src="images/ba-${pair.slug}-${side}-760.jpg" alt="${esc(alt)}" width="1400" height="1050" decoding="async"` +
    // The first card is the hero, in view on arrival: never lazy. The rest
    // are switched to eager by js/gallery.js one step before they show.
    (first ? ' fetchpriority="high"' : ' loading="lazy"') + " /></picture>";
}

function card(pair, i, n) {
  const first = i === 0;
  return `<figure class="ba-slider" role="group" aria-roledescription="slide" aria-label="${i + 1} of ${n}">` +
    '<div class="ba-stage" style="--pos:50%">' +
      photo(pair, "after", pair.altAfter, first) +
      `<div class="ba-before-layer">${photo(pair, "before", pair.altBefore, first)}</div>` +
      '<span class="ba-tag b">Before</span><span class="ba-tag a">After</span>' +
      `<div class="ba-divider"><div class="ba-knob">${CHEV}</div></div>` +
      `<input class="ba-range" type="range" min="0" max="100" value="50" aria-label="Compare before and after: ${esc(pair.caption)}" />` +
    "</div>" +
    `<figcaption>${esc(pair.caption)}</figcaption>` +
    "</figure>";
}

/** The hero carousel: one card per gallery pair, in the order given. */
export function carouselHero(pairs) {
  return `      <div class="loc-hero-pic loc-hero-ba">
        <div class="ba-carousel" id="baCarousel" role="region" aria-roledescription="carousel" aria-label="Before and after photos">
          <div class="ba-viewport"><div class="ba-track" id="baGrid" aria-live="off" aria-atomic="false">${pairs.map((p, i) => card(p, i, pairs.length)).join("")}</div></div>
        </div>
      </div>`;
}

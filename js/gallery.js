/* ============================================================
   Before and after gallery, rendered from data/gallery.json.

   Adding a pair is a data change: drop the two photos in images/ following
   ba-<slug>-before.jpg and ba-<slug>-after.jpg, then add one entry to that
   file. No markup to touch.
   ============================================================ */
(function () {
  'use strict';

  var grid = document.getElementById('baGrid');
  if (!grid) return;

  var CHEV =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M8 7l-5 5 5 5M16 7l5 5-5 5"/></svg>';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /*
   * ONE PHOTO, AT THE SIZE THE CARD IS ACTUALLY PAINTED.
   *
   * This used to hand every visitor the full export: twelve photos of about
   * a quarter of a megabyte each, all fetched at once, for cards that are
   * never wider than about 560 points. Three megabytes on a phone, competing
   * with the hero image for the connection, to fill a section most people
   * scroll past.
   *
   * The card is full width on a phone and half of a 1200 container above
   * 820px, which is what `sizes` says. The browser picks a width from that
   * and its own screen density; we only have to supply honest candidates.
   */
  var SIZES = '(min-width: 820px) 46vw, 92vw';

  function srcset(slug, side, widths, ext) {
    return widths.map(function (w) {
      return 'images/ba-' + slug + '-' + side + '-' + w + '.' + ext + ' ' + w + 'w';
    }).join(', ');
  }

  function photo(pair, slug, side, alt, eager) {
    // Widths are listed per pair in gallery.json, because they depend on the
    // photo: the portrait console shot is only 1050 wide, so claiming a 1120
    // candidate would have the browser choose a file that does not exist.
    var widths = (pair.widths && pair.widths.length) ? pair.widths : [420, 760];
    return '<picture>' +
      '<source type="image/webp" sizes="' + SIZES + '" srcset="' + srcset(slug, side, widths, 'webp') + '" />' +
      '<img class="ba-img" src="images/ba-' + slug + '-' + side + '-760.jpg" alt="' + alt + '"' +
        ' width="1400" height="1050" decoding="async"' +
        // The first card is on screen, or nearly, the moment the gallery
        // renders. Everything below it waits until somebody scrolls that
        // far, which for most visitors is never.
        (eager ? ' fetchpriority="low"' : ' loading="lazy"') +
      ' /></picture>';
  }

  function card(pair, i) {
    var slug = esc(pair.slug);
    var delay = i % 3 ? ' data-d="' + (i % 3) + '"' : '';
    var eager = i === 0;
    return '<figure class="ba-slider reveal"' + delay + '>' +
      '<div class="ba-stage" style="--pos:50%">' +
        photo(pair, slug, 'after', esc(pair.altAfter), eager) +
        '<div class="ba-before-layer">' + photo(pair, slug, 'before', esc(pair.altBefore), eager) + '</div>' +
        '<span class="ba-tag b">Before</span><span class="ba-tag a">After</span>' +
        '<div class="ba-divider"><div class="ba-knob">' + CHEV + '</div></div>' +
        '<input class="ba-range" type="range" min="0" max="100" value="50" aria-label="Compare before and after: ' + esc(pair.caption) + '" />' +
      '</div>' +
      '<figcaption>' + esc(pair.caption) + '</figcaption>' +
      '</figure>';
  }

  fetch('data/gallery.json', { cache: 'no-cache' })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      var pairs = (data && data.pairs) || [];
      if (!pairs.length) { grid.remove(); return; }
      grid.innerHTML = pairs.map(card).join('');
      // script.js binds the drag behaviour on load, so re-run it for the
      // sliders that did not exist at that point.
      if (window.ACSliders && window.ACSliders.bind) window.ACSliders.bind();
      if (window.ACReveal && window.ACReveal.observe) window.ACReveal.observe();
    })
    .catch(function () {
      // A missing manifest should not leave an empty hole in the page.
      grid.remove();
    });
})();

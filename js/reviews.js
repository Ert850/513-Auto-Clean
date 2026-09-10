/* ============================================================
   Google reviews: the top ticker and the reviews grid.

   Two sources, in order of preference:
     1. /api/reviews, which calls the Places API server side. Live, but needs
        a key and a Place ID that are not configured yet.
     2. data/reviews.json, a hand-taken snapshot with ABSOLUTE dates.

   Absolute dates are the point of the snapshot. Copying Google's "2 months
   ago" would be wrong within weeks; storing 2026-07-10 and computing the
   phrase at page load stays right forever.

   Both sources feed one render, so the page looks identical either way and
   switching to the live feed later changes nothing visible except freshness.
   ============================================================ */
(function () {
  'use strict';

  var MAPS_URL = 'https://maps.app.goo.gl/PAAdpX7owQmc1cAz9';

  var mount = document.getElementById('reviews-widget');
  var fallback = document.getElementById('revFallback');

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function stars(n) {
    var full = Math.round(n || 0);
    return '<span class="rv-stars" aria-label="' + full + ' out of 5">' +
      [0, 1, 2, 3, 4].map(function (_, i) {
        return '<i class="' + (i < full ? 'on' : '') + '">&#9733;</i>';
      }).join('') + '</span>';
  }

  /* ---------- dates ----------
     Google's own wording, so a snapshot and the live feed read the same. */
  function relativeFrom(iso) {
    var then = new Date(iso + (iso.length === 10 ? 'T12:00:00' : ''));
    if (isNaN(then)) return '';
    var days = Math.floor((Date.now() - then.getTime()) / 86400000);
    if (days < 1) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 7) return days + ' days ago';
    if (days < 14) return 'a week ago';
    if (days < 30) return Math.floor(days / 7) + ' weeks ago';
    var months = Math.floor(days / 30.44);
    if (months <= 1) return 'a month ago';
    if (months < 12) return months + ' months ago';
    var years = Math.floor(months / 12);
    return years === 1 ? 'a year ago' : years + ' years ago';
  }

  function absoluteFrom(iso) {
    var d = new Date(iso + (iso.length === 10 ? 'T12:00:00' : ''));
    return isNaN(d) ? '' : d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  /* ---------- loading ---------- */

  function normalise(r) {
    // The API returns epoch millis in `time`; the snapshot returns a date.
    var iso = r.date || (r.time ? new Date(r.time).toISOString().slice(0, 10) : '');
    return {
      author: r.author || r.authorName || 'Customer',
      rating: r.rating || 5,
      text: (r.text || '').trim(),
      truncated: Boolean(r.truncated),
      photo: r.photo || '',
      iso: iso,
      relative: iso ? relativeFrom(iso) : (r.relative || ''),
      absolute: iso ? absoluteFrom(iso) : '',
      // Short or awkward entries still count toward the total but are not
      // worth a card. The snapshot marks them; the API cannot, so it keeps
      // whatever it sends.
      feature: r.feature !== false
    };
  }

  function fromApi(d) {
    return {
      source: 'api',
      rating: d.rating || 5,
      total: d.total || (d.reviews || []).length,
      mapsUri: d.mapsUri || MAPS_URL,
      reviews: (d.reviews || []).map(normalise)
    };
  }

  function fromSnapshot(d) {
    return {
      source: 'snapshot',
      rating: d.rating || 5,
      total: d.count || (d.reviews || []).length,
      mapsUri: d.source || MAPS_URL,
      reviews: (d.reviews || []).map(normalise)
    };
  }

  function load() {
    return fetch('/api/reviews?minRating=5', { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error(String(r.status))); })
      .then(function (d) {
        if (!d.reviews || !d.reviews.length) throw new Error('empty');
        return fromApi(d);
      })
      .catch(function () {
        return fetch('data/reviews.json', { cache: 'no-cache' })
          .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error(String(r.status))); })
          .then(fromSnapshot);
      });
  }

  /* ---------- the grid ---------- */

  function trim(text, max) {
    if (text.length <= max) return { short: text, long: null };
    var cut = text.slice(0, max);
    var at = cut.lastIndexOf(' ');
    return { short: cut.slice(0, at > 0 ? at : max) + '…', long: text };
  }

  function card(r) {
    var t = trim(r.text, 240);
    return '<figure class="rv-card">' +
      '<div class="rv-top">' +
        (r.photo
          ? '<img class="rv-av" src="' + esc(r.photo) + '" alt="" loading="lazy" width="36" height="36" />'
          : '<span class="rv-av rv-av-x">' + esc((r.author || '?').charAt(0)) + '</span>') +
        '<div><b>' + esc(r.author) + '</b>' + stars(r.rating) + '</div>' +
      '</div>' +
      '<blockquote>' + esc(t.short) +
        (r.truncated && !t.long ? '…' : '') +
        (t.long ? '<button type="button" class="rv-more" data-full="' + esc(t.long) + '">Read more</button>' : '') +
      '</blockquote>' +
      '<figcaption><time datetime="' + esc(r.iso) + '">' + esc(r.relative) + '</time>' +
        (r.truncated ? '<a href="' + esc(MAPS_URL) + '" target="_blank" rel="noopener">Read in full</a>' : '') +
      '</figcaption>' +
      '</figure>';
  }

  function renderGrid(d) {
    if (!mount) return;
    var shown = d.reviews.filter(function (r) { return r.feature && r.text; }).slice(0, 6);
    if (!shown.length) { if (fallback) fallback.hidden = false; return; }

    var head = '<div class="rv-head">' +
      '<svg class="g-logo" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22 12c0-.6-.1-1.2-.2-1.8H12v3.6h5.6a4.8 4.8 0 0 1-2 3.1v2.6h3.2A9.6 9.6 0 0 0 22 12z"/><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.6c-.9.6-2 .9-3.4.9-2.6 0-4.8-1.7-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z"/><path fill="#FBBC05" d="M6.4 13.8a6 6 0 0 1 0-3.6V7.6H3.1a10 10 0 0 0 0 8.8z"/><path fill="#EA4335" d="M12 6.4c1.5 0 2.8.5 3.8 1.5l2.8-2.8A10 10 0 0 0 3.1 7.6l3.3 2.6C7.2 8 9.4 6.4 12 6.4z"/></svg>' +
      '<div class="rv-score"><b>' + Number(d.rating).toFixed(1) + '</b>' + stars(d.rating) +
      '<span>' + d.total + ' Google review' + (d.total === 1 ? '' : 's') + '</span></div>' +
      '</div>';

    // No "showing 5 star reviews" line. The headline number is whatever
    // Google actually says, so if a four star ever lands the average moves
    // to 4.8 and the page reports 4.8 without anyone editing anything.
    var note = '<p class="rv-note">' +
      '<a href="' + esc(MAPS_URL) + '" target="_blank" rel="noopener">Read every review on Google</a></p>';

    mount.innerHTML = head + '<div class="rv-grid">' + shown.map(card).join('') + '</div>' + note;
    syncSchema(d.rating, d.total);
  }

  /* ---------- the top ticker ----------
     One review at a time, newest first, looping back to the newest once it
     reaches the oldest. Reads as a running feed of proof rather than a
     static testimonial block. */

  function renderTicker(d) {
    var wrap = document.getElementById('rvTicker');
    var stage = document.getElementById('rvTickStage');
    var count = document.getElementById('rvCount');
    var prev = document.getElementById('rvPrev');
    var next = document.getElementById('rvNext');
    if (!wrap || !stage) return;

    var items = d.reviews.filter(function (r) { return r.rating >= 5 && r.text && r.feature; });
    if (!items.length) return;

    var i = 0, timer = null, HOLD = 9000;

    function firstName(full) {
      return String(full || '').trim().split(/\s+/)[0] || 'Customer';
    }

    function paint(dir) {
      var r = items[i];
      if (!r) return;
      stage.innerHTML =
        '<article class="rv-tick' + (dir ? ' in-' + dir : '') + '">' +
          '<header><b>' + esc(firstName(r.author)) + '</b>' +
          '<span class="rv-tick-stars">&#9733;&#9733;&#9733;&#9733;&#9733; 5 Stars</span>' +
          '<time datetime="' + esc(r.iso) + '" title="' + esc(r.absolute) + '">' + esc(r.relative) + '</time></header>' +
          '<p>' + esc(r.text) + (r.truncated ? '…' : '') + '</p>' +
        '</article>';
      if (count) count.textContent = (i + 1) + ' / ' + items.length;
    }

    function restart() {
      clearInterval(timer);
      timer = setInterval(function () { step(1); }, HOLD);
    }

    function step(n) {
      // Wraps both ways, so the oldest rolls straight back to the newest.
      i = (i + n + items.length) % items.length;
      paint(n > 0 ? 'right' : 'left');
      restart();
    }

    wrap.hidden = false;
    paint();
    restart();

    if (prev) prev.addEventListener('click', function () { step(-1); });
    if (next) next.addEventListener('click', function () { step(1); });

    // Do not animate away from a review someone is reading.
    wrap.addEventListener('mouseenter', function () { clearInterval(timer); });
    wrap.addEventListener('mouseleave', restart);
    wrap.addEventListener('focusin', function () { clearInterval(timer); });
  }

  /**
   * Replace the hardcoded aggregateRating with what the source actually
   * says. A stale review count in structured data is worse than none.
   */
  function syncSchema(rating, total) {
    var tags = document.querySelectorAll('script[type="application/ld+json"]');
    for (var i = 0; i < tags.length; i++) {
      try {
        var d = JSON.parse(tags[i].textContent);
        if (d['@type'] !== 'AutoDetailing') continue;
        d.aggregateRating = {
          '@type': 'AggregateRating',
          ratingValue: String(rating),
          reviewCount: String(total)
        };
        tags[i].textContent = JSON.stringify(d, null, 2);
      } catch (err) { /* malformed block, leave it alone */ }
    }
  }

  if (mount) {
    mount.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('.rv-more') : null;
      if (!b) return;
      b.closest('blockquote').textContent = b.dataset.full;
    });
  }

  load()
    .then(function (d) {
      renderGrid(d);
      renderTicker(d);
    })
    .catch(function () {
      // Both sources gone. Leave the static fallback and the hidden ticker
      // exactly as they are: silence beats an error message to a customer.
      if (fallback) fallback.hidden = false;
    });
})();

/* ============================================================
   Google reviews: the top ticker and the reviews grid.

   Two sources, MERGED, because each is better at something:
     1. /api/reviews, which calls the Places API server side. Current, and
        carries the rating and count straight from Google. Returns at most
        five reviews, however many you have.
     2. data/reviews.json, a hand-taken snapshot of all 32, with ABSOLUTE
        dates.

   Preferring the live feed, which is what this used to do, would have cut
   the page from 32 reviews to 5 the day the Place ID was configured.

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
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
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
      rating: typeof d.rating === 'number' && d.rating > 0 ? d.rating : null,
      total: d.total || (d.reviews || []).length,
      mapsUri: d.mapsUri || MAPS_URL,
      reviews: (d.reviews || []).map(normalise)
    };
  }

  function fromSnapshot(d) {
    return {
      source: 'snapshot',
      rating: typeof d.rating === 'number' && d.rating > 0 ? d.rating : null,
      total: d.count || (d.reviews || []).length,
      mapsUri: d.source || MAPS_URL,
      reviews: (d.reviews || []).map(normalise)
    };
  }

  /**
   * Same review from two sources? Author plus the opening of the text.
   *
   * Not the date: the snapshot stores a day and the API an instant, and not
   * the full text either, because the API truncates long ones.
   */
  function fingerprint(r) {
    return (r.author || '').trim().toLowerCase() + '|' +
      (r.text || '').replace(/\s+/g, ' ').trim().slice(0, 40).toLowerCase();
  }

  /**
   * BOTH sources, merged, not one or the other.
   *
   * Google's Place Details returns at most FIVE reviews, however many you
   * have. The snapshot holds 32. So preferring the live feed, which is what
   * this used to do, would have quietly cut the wall of reviews down to five
   * the day the Place ID landed: a worse page, bought with a billed API call.
   *
   * What the live feed is genuinely better at is the rating and the count,
   * which must never drift from Google, and being current. So it supplies
   * those and its own reviews go first; the snapshot fills in behind it,
   * minus anything already shown.
   */
  function merge(api, snap) {
    if (!api) return snap;
    if (!snap) return api;

    var seen = {};
    var out = [];
    api.reviews.concat(snap.reviews).forEach(function (r) {
      var k = fingerprint(r);
      if (seen[k]) return;
      seen[k] = true;
      out.push(r);
    });

    return {
      source: 'api+snapshot',
      // Google's own figures win: they are the ones a customer can check.
      rating: api.rating != null ? api.rating : snap.rating,
      total: api.total || snap.total,
      mapsUri: api.mapsUri || snap.mapsUri,
      reviews: out
    };
  }

  function load() {
    var live = fetch('/api/reviews?minRating=5', { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error(String(r.status))); })
      .then(function (d) {
        if (!d.reviews || !d.reviews.length) throw new Error('empty');
        return fromApi(d);
      })
      .catch(function () { return null; });

    var stored = fetch('data/reviews.json', { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error(String(r.status))); })
      .then(fromSnapshot)
      .catch(function () { return null; });

    return Promise.all([live, stored]).then(function (both) {
      var merged = merge(both[0], both[1]);
      if (!merged) throw new Error('no reviews from either source');
      return merged;
    });
  }

  /* ---------- the grid ---------- */

  /** Roughly what fits in five clamped lines. Only decides the button. */
  var CLAMP_CHARS = 190;

  function card(r) {
    var long = r.text.length > CLAMP_CHARS;
    return '<figure class="rv-card">' +
      '<div class="rv-top">' +
        (r.photo
          ? '<img class="rv-av" src="' + esc(r.photo) + '" alt="" loading="lazy" width="36" height="36" />'
          : '<span class="rv-av rv-av-x">' + esc((r.author || '?').charAt(0)) + '</span>') +
        '<div><b>' + esc(r.author) + '</b>' + stars(r.rating) + '</div>' +
      '</div>' +
      '<blockquote>' + esc(r.text) + (r.truncated ? '…' : '') + '</blockquote>' +
      (long || r.truncated
        ? '<button type="button" class="rv-more">Read more</button>'
        : '') +
      '<figcaption><time datetime="' + esc(r.iso) + '">' + esc(r.relative) + '</time>' +
        (r.truncated ? '<a href="' + esc(MAPS_URL) + '" target="_blank" rel="noopener">Read in full</a>' : '') +
      '</figcaption>' +
      '</figure>';
  }

  var PER_PAGE = 6;

  /**
   * Every review with something written in it, newest first, six to a page.
   *
   * `feature` still decides what the ticker rotates and which page you land
   * on first, but nothing is hidden here: someone who wants to read all
   * thirty of them can page through all thirty.
   */
  function renderGrid(d) {
    if (!mount) return;
    var all = d.reviews.filter(function (r) { return r.text; });
    if (!all.length) { if (fallback) fallback.hidden = false; return; }

    var pages = Math.ceil(all.length / PER_PAGE);
    var page = 0;

    var head = '<div class="rv-head">' +
      '<svg class="g-logo" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22 12c0-.6-.1-1.2-.2-1.8H12v3.6h5.6a4.8 4.8 0 0 1-2 3.1v2.6h3.2A9.6 9.6 0 0 0 22 12z"/><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.6c-.9.6-2 .9-3.4.9-2.6 0-4.8-1.7-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z"/><path fill="#FBBC05" d="M6.4 13.8a6 6 0 0 1 0-3.6V7.6H3.1a10 10 0 0 0 0 8.8z"/><path fill="#EA4335" d="M12 6.4c1.5 0 2.8.5 3.8 1.5l2.8-2.8A10 10 0 0 0 3.1 7.6l3.3 2.6C7.2 8 9.4 6.4 12 6.4z"/></svg>' +
      // No rating means no number, not a made-up five.
      (d.rating ? '<div class="rv-score"><b>' + Number(d.rating).toFixed(1) + '</b>' + stars(d.rating) : '<div class="rv-score">') +
      '<span>' + d.total + ' Google review' + (d.total === 1 ? '' : 's') + '</span></div>' +
      '</div>';

    // No "showing 5 star reviews" line. The headline number is whatever
    // Google actually says, so if a four star ever lands the average moves
    // to 4.8 and the page reports 4.8 without anyone editing anything.
    var note = '<p class="rv-note">' +
      '<a href="' + esc(MAPS_URL) + '" target="_blank" rel="noopener">Read every review on Google</a></p>';

    var nav = pages > 1
      ? '<button type="button" class="rv-arrow prev" data-rv="-1" aria-label="Previous reviews" aria-controls="rvGrid">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M15 5l-7 7 7 7"/></svg>' +
        '</button>' +
        '<button type="button" class="rv-arrow next" data-rv="1" aria-label="More reviews" aria-controls="rvGrid">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M9 5l7 7-7 7"/></svg>' +
        '</button>'
      : '';

    mount.innerHTML = head +
      '<div class="rv-stage">' + nav +
        '<div class="rv-grid" id="rvGrid" aria-live="polite"></div>' +
      '</div>' +
      (pages > 1 ? '<p class="rv-page" id="rvPage"></p>' : '') +
      note;

    var grid = document.getElementById('rvGrid');
    var counter = document.getElementById('rvPage');

    function paint() {
      var slice = all.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE);
      grid.innerHTML = slice.map(card).join('');
      if (counter) counter.textContent = (page + 1) + ' of ' + pages;
    }

    if (pages > 1) {
      mount.addEventListener('click', function (e) {
        var b = e.target.closest ? e.target.closest('.rv-arrow') : null;
        if (!b) return;
        // Wraps both ways, so the last page rolls straight back to the first
        // rather than dead-ending on a disabled button.
        page = (page + Number(b.dataset.rv) + pages) % pages;
        paint();
      });
    }

    paint();
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
      // Unclamp in place. The card keeps its height and the text scrolls, so
      // opening one review never moves the five around it.
      var quote = b.parentNode.querySelector('blockquote');
      var open = quote.classList.toggle('open');
      b.textContent = open ? 'Show less' : 'Read more';
    });
  }

  /**
   * The headline figure everywhere it appears outside the reviews grid.
   *
   * The hero badge and the block at the foot of the section both carry a
   * rating and a count. The build stamps them from data/reviews.json so the
   * page reads correctly before any of this runs and for anyone without
   * JavaScript; this rewrites them from whatever Google last said, so the
   * day the 33rd review lands the number moves on its own.
   *
   * Deliberately not inside renderGrid: that returns early when there is
   * nothing worth drawing, and the count is still true on a day when no
   * review has text.
   */
  function syncBadges(rating, total) {
    var n = Number(total);
    var r = Number(rating);
    if (!Number.isFinite(n) || n <= 0 || !Number.isFinite(r) || r <= 0) return;
    var r1 = r.toFixed(1);
    var word = n === 1 ? ' review' : ' reviews';

    var hero = document.querySelector('#google-badge .g-text');
    if (hero) hero.textContent = 'Rated ' + r1 + ' from ' + n + word + ' on Google & Yelp';

    var num = document.querySelector('#revFallback .rf-score .num');
    if (num) num.textContent = r1;

    var foot = document.querySelector('#revFallback .rf-text');
    if (foot) foot.innerHTML = '<b>' + n + word + '</b> on Google';
  }

  load()
    .then(function (d) {
      syncBadges(d.rating, d.total);
      renderGrid(d);
      renderTicker(d);
    })
    .catch(function () {
      // Both sources gone. Leave the static fallback and the hidden ticker
      // exactly as they are: silence beats an error message to a customer.
      if (fallback) fallback.hidden = false;
    });
})();

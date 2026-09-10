/* ============================================================
   Live Google reviews.

   Fetches /api/reviews, which calls the Places API server side. If that is
   not configured or fails, the static fallback already in the page stays
   exactly where it is, so the section is never empty and never shows an
   error to a customer.
   ============================================================ */
(function () {
  'use strict';

  var mount = document.getElementById('reviews-widget');
  var fallback = document.getElementById('revFallback');
  if (!mount) return;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function stars(n) {
    var full = Math.round(n || 0);
    return '<span class="rv-stars" aria-label="' + full + ' out of 5">' +
      new Array(5).fill(0).map(function (_, i) {
        return '<i class="' + (i < full ? 'on' : '') + '">★</i>';
      }).join('') + '</span>';
  }

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
        (t.long ? '<button type="button" class="rv-more" data-full="' + esc(t.long) + '">Read more</button>' : '') +
      '</blockquote>' +
      '<figcaption>' + esc(r.relative) + '</figcaption>' +
      '</figure>';
  }

  fetch('/api/reviews?minRating=5', { cache: 'no-cache' })
    .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error(String(r.status))); })
    .then(function (d) {
      if (!d.reviews || !d.reviews.length) return;

      var head = '<div class="rv-head">' +
        '<svg class="g-logo" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22 12c0-.6-.1-1.2-.2-1.8H12v3.6h5.6a4.8 4.8 0 0 1-2 3.1v2.6h3.2A9.6 9.6 0 0 0 22 12z"/><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.6c-.9.6-2 .9-3.4.9-2.6 0-4.8-1.7-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z"/><path fill="#FBBC05" d="M6.4 13.8a6 6 0 0 1 0-3.6V7.6H3.1a10 10 0 0 0 0 8.8z"/><path fill="#EA4335" d="M12 6.4c1.5 0 2.8.5 3.8 1.5l2.8-2.8A10 10 0 0 0 3.1 7.6l3.3 2.6C7.2 8 9.4 6.4 12 6.4z"/></svg>' +
        '<div class="rv-score"><b>' + (d.rating ? d.rating.toFixed(1) : '5.0') + '</b>' + stars(d.rating || 5) +
        '<span>' + (d.total ? d.total + ' Google review' + (d.total === 1 ? '' : 's') : 'on Google') + '</span></div>' +
        '</div>';

      var note = d.filteredTo
        ? '<p class="rv-note">Showing ' + d.filteredTo + ' star reviews. ' +
          '<a href="' + esc(d.mapsUri || 'https://maps.app.goo.gl/PAAdpX7owQmc1cAz9') +
          '" target="_blank" rel="noopener">Read every review on Google</a></p>'
        : '';

      mount.innerHTML = head +
        '<div class="rv-grid">' + d.reviews.slice(0, 6).map(card).join('') + '</div>' + note;

      // Keep the JSON-LD rating honest by reporting what Google actually says.
      if (d.rating && d.total) syncSchema(d.rating, d.total);
    })
    .catch(function () {
      // Leave the fallback in place. Silence is the right behaviour here.
      if (fallback) fallback.hidden = false;
    });

  /* ---------------- top ticker ----------------
     One review at a time, newest first, looping back to the newest once it
     reaches the oldest. Reads as a running feed of proof that grows rather
     than a static testimonial block. */
  (function ticker() {
    var wrap = document.getElementById('rvTicker');
    var stage = document.getElementById('rvTickStage');
    var count = document.getElementById('rvCount');
    var prev = document.getElementById('rvPrev');
    var next = document.getElementById('rvNext');
    if (!wrap || !stage) return;

    var items = [];
    var i = 0;
    var timer = null;
    var HOLD = 9000;

    function firstName(full) {
      return String(full || '').trim().split(/\s+/)[0] || 'Customer';
    }

    function dateOf(r) {
      if (r.time) {
        var d = new Date(r.time);
        if (!isNaN(d)) return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      }
      return r.relative || '';
    }

    function paint(dir) {
      var r = items[i];
      if (!r) return;
      stage.innerHTML =
        '<article class="rv-tick' + (dir ? ' in-' + dir : '') + '">' +
          '<header><b>' + esc(firstName(r.author)) + '</b>' +
          '<span class="rv-tick-stars">&#9733;&#9733;&#9733;&#9733;&#9733; 5 Stars</span>' +
          '<time>' + esc(dateOf(r)) + '</time></header>' +
          '<p>' + esc(r.text) + '</p>' +
        '</article>';
      if (count) count.textContent = (i + 1) + ' / ' + items.length;
    }

    function step(n) {
      // Wrap in both directions, so the oldest rolls straight back to newest.
      i = (i + n + items.length) % items.length;
      paint(n > 0 ? 'right' : 'left');
      restart();
    }

    function restart() {
      clearInterval(timer);
      timer = setInterval(function () { step(1); }, HOLD);
    }

    fetch('/api/reviews?minRating=5', { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error(String(r.status))); })
      .then(function (d) {
        items = (d.reviews || []).filter(function (r) { return r.rating >= 5 && r.text; });
        if (!items.length) return;
        wrap.hidden = false;
        paint();
        restart();
      })
      .catch(function () { /* stays hidden, no empty bar */ });

    if (prev) prev.addEventListener('click', function () { step(-1); });
    if (next) next.addEventListener('click', function () { step(1); });

    // Do not animate away from a review someone is reading.
    wrap.addEventListener('mouseenter', function () { clearInterval(timer); });
    wrap.addEventListener('mouseleave', restart);
    wrap.addEventListener('focusin', function () { clearInterval(timer); });
  })();

  mount.addEventListener('click', function (e) {
    var b = e.target.closest('.rv-more');
    if (!b) return;
    b.closest('blockquote').textContent = b.dataset.full;
  });

  /**
   * Replace the hardcoded aggregateRating with the live figure. A stale
   * review count in structured data is something Google penalises, so it is
   * better to publish what is true right now.
   */
  function syncSchema(rating, total) {
    document.querySelectorAll('script[type="application/ld+json"]').forEach(function (tag) {
      try {
        var d = JSON.parse(tag.textContent);
        if (d['@type'] !== 'AutoDetailing') return;
        d.aggregateRating = {
          '@type': 'AggregateRating',
          ratingValue: String(rating),
          reviewCount: String(total)
        };
        tag.textContent = JSON.stringify(d, null, 2);
      } catch (err) { /* malformed block, leave it alone */ }
    });
  }
})();

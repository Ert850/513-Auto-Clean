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
  // The carousel around the track: removed with it if there is nothing to show.
  var root = document.getElementById('baCarousel') || grid;

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
   * The card is full width on a phone, half the container from 820px and a
   * third of it (at most about 330 points, the container stops at 1180)
   * from 1100px, which is what `sizes` says. Those are the carousel's
   * --ba-per breakpoints in styles.css. The browser picks a width from that
   * and its own screen density; we only have to supply honest candidates.
   */
  var SIZES = '(min-width: 1100px) 340px, (min-width: 820px) 46vw, 92vw';

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

  function card(pair, i, all) {
    var slug = esc(pair.slug);
    var eager = i === 0;
    // A slide in the carousel (WAI-ARIA APG): a group named by its position.
    // No .reveal on the card any more: a card parked off to the side of the
    // track never intersects the viewport, so it would still be invisible
    // when it slid in. The carousel as a whole fades up instead.
    return '<figure class="ba-slider" role="group" aria-roledescription="slide" aria-label="' +
      (i + 1) + ' of ' + all.length + '">' +
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

  /*
   * THE CAROUSEL.
   *
   * One comparison per view on a phone, two from 820px up (where the cards
   * used to sit two to a row), three from 1100px, where a third of the
   * container is still about as wide as a phone's card. styles.css owns
   * those breakpoints (--ba-per); this reads them. On its own it shows each newly visible card's
   * whole before, then wipes across to the whole after, then moves along one
   * card. The conventions are the WAI-ARIA carousel pattern and Bootstrap's:
   * a pause button (WCAG 2.2.2), previous and next, one indicator per stop,
   * stop while the pointer is over the photos or keyboard focus is in them,
   * stop while the tab is hidden, never start under reduced motion.
   *
   * Taking over: touching anything in it (dragging a handle, a chevron, an
   * indicator) holds it. It picks up again after IDLE_MS without any touch,
   * or when it has been scrolled out of view and back. Pause is different:
   * that is the visitor saying no, so only their Play starts it again.
   *
   * Timings, per comparison: about 1.2s to slide the handle across to the
   * right edge (the whole before), 1.6s to look at it, 2.8s to wipe across
   * to the whole after, 2.4s to look at that, 1s back to the middle. About
   * 9 seconds a card, roughly double Bootstrap's 5 second slide, because
   * each card is two pictures and a movement between them.
   */
  var LEAD_MS = 2400;      // per full width, middle -> right edge = 1.2s
  var BEFORE_HOLD = 1600;
  var REVEAL_MS = 2800;    // the full wipe from before to after
  var AFTER_HOLD = 2400;
  var BACK_MS = 2000;      // per full width, left edge -> middle = 1s
  var SLIDE_MS = 700;      // the track's own transition is .6s
  var IDLE_MS = 12000;

  function carousel(slides) {
    var n = slides.length;
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    var viewport = root.querySelector('.ba-viewport') || grid;

    var per = readPer();
    var start = 0;            // the first card in view
    var playing = !reduce.matches;   // the visitor's own Pause / Play
    var onScreen = false, hover = false, keyFocus = false, held = false;
    var idleTimer = null, running = false, run = 0;

    function readPer() { return parseInt(getComputedStyle(grid).getPropertyValue('--ba-per'), 10) || 1; }
    function perView() { return Math.min(n, per); }
    function stops() { return n - perView() + 1; }
    function visible() {
      var out = [];
      for (var i = start; i < start + perView(); i++) out.push(i);
      return out;
    }

    /* ---------- controls ---------- */
    var ICON_PAUSE = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>';
    var ICON_PLAY = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>';
    var ICON_PREV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
    var ICON_NEXT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';

    var bar = document.createElement('div');
    bar.className = 'ba-controls';
    // The rotation control comes first in the tab order (APG).
    bar.innerHTML =
      '<button type="button" class="ba-ctl ba-play"></button>' +
      '<button type="button" class="ba-ctl" data-step="-1" aria-controls="baGrid" aria-label="Previous photos">' + ICON_PREV + '</button>' +
      '<div class="ba-dots" role="group" aria-label="Choose photos"></div>' +
      '<button type="button" class="ba-ctl" data-step="1" aria-controls="baGrid" aria-label="Next photos">' + ICON_NEXT + '</button>';
    root.appendChild(bar);
    var playBtn = bar.querySelector('.ba-play');
    var dotsBox = bar.querySelector('.ba-dots');

    function dots() {
      var html = '';
      for (var i = 0; i < stops(); i++) {
        var p = perView();
        var label = p === 1 ? String(i + 1) : p === 2 ? (i + 1) + ' and ' + (i + 2) : (i + 1) + ' to ' + (i + p);
        html += '<button type="button" class="ba-dot" data-to="' + i + '" aria-controls="baGrid" aria-label="Show photos ' + label + ' of ' + n + '"></button>';
      }
      dotsBox.innerHTML = html;
      // Nothing to move between: only the pause button stays (the handles
      // still sweep, and moving content always needs a way to stop it).
      bar.classList.toggle('single', stops() < 2);
    }

    function paintPlay() {
      // Same button, new label and icon, so focus stays on it (WAI tutorial).
      playBtn.innerHTML = playing ? ICON_PAUSE : ICON_PLAY;
      playBtn.setAttribute('aria-label', playing ? 'Pause the before and after slideshow' : 'Play the before and after slideshow');
    }

    /* ---------- moving the track ---------- */
    function place(snap) {
      if (snap) grid.style.transition = 'none';
      grid.style.transform = 'translateX(' + (-slides[start].offsetLeft) + 'px)';
      if (snap) { void grid.offsetWidth; grid.style.transition = ''; }
      var shown = visible();
      slides.forEach(function (s, i) {
        var on = shown.indexOf(i) >= 0;
        // Cards off to the side are out of the tab order and the reading order.
        s.toggleAttribute('inert', !on);
        if (on) s.removeAttribute('aria-hidden'); else s.setAttribute('aria-hidden', 'true');
      });
      [].forEach.call(dotsBox.children, function (d, i) {
        if (i === start) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current');
      });
    }

    function go(to) {
      var k = stops();
      start = ((to % k) + k) % k;
      place(false);
      // The card after the ones in view starts loading now, so it is not a
      // grey box when it slides in. Only ever one card ahead: the rest stay
      // lazy until they are about to be shown.
      for (var i = start; i <= Math.min(n - 1, start + perView()); i++) wake(slides[i]);
    }

    function wake(slide) {
      slide.querySelectorAll('img[loading="lazy"]').forEach(function (img) { img.loading = 'eager'; });
    }

    function ready(slide) {
      wake(slide);
      return Promise.all([].map.call(slide.querySelectorAll('img'), function (img) {
        if (img.complete) return null;
        return new Promise(function (done) {
          img.addEventListener('load', done, { once: true });
          img.addEventListener('error', done, { once: true });
          setTimeout(done, 4000);
        });
      }));
    }

    /* ---------- the handle ---------- */
    function getPos(slide) { return parseFloat(slide.querySelector('.ba-range').value); }
    function setPos(slide, v) {
      slide.querySelector('.ba-range').value = v;
      slide.querySelector('.ba-stage').style.setProperty('--pos', v + '%');
    }
    function ease(t) { return t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

    // Each segment is a move ({to, perFull}) or a pause ({ms}). Stops the
    // moment `run` changes, leaving the handle wherever it got to.
    function animate(gen, slide, segs) {
      return new Promise(function (done) {
        var k = 0;
        (function next() {
          if (gen !== run || k >= segs.length) return done();
          var seg = segs[k++];
          if (seg.ms) return setTimeout(next, seg.ms);
          var from = getPos(slide);
          var ms = Math.max(200, seg.perFull * Math.abs(seg.to - from) / 100);
          var t0 = null;
          requestAnimationFrame(function frame(t) {
            if (gen !== run) return done();
            if (t0 === null) t0 = t;
            var p = Math.min(1, (t - t0) / ms);
            setPos(slide, from + (seg.to - from) * ease(p));
            if (p < 1) requestAnimationFrame(frame); else next();
          });
        })();
      });
    }

    function sweep(gen, slide) {
      return ready(slide).then(function () {
        return animate(gen, slide, [
          { to: 100, perFull: LEAD_MS },   // the whole before
          { ms: BEFORE_HOLD },
          { to: 0, perFull: REVEAL_MS },   // wipe across to the whole after
          { ms: AFTER_HOLD },
          { to: 50, perFull: BACK_MS }     // back where a visitor expects it
        ]);
      });
    }

    // Sweep the queued cards one after another, then move along one card and
    // sweep whichever card that brought into view.
    function loop(gen, queue) {
      if (gen !== run) return;
      if (queue.length) {
        sweep(gen, slides[queue[0]]).then(function () {
          setTimeout(function () { loop(gen, queue.slice(1)); }, 400);
        });
        return;
      }
      var was = visible();
      if (stops() > 1) go(start + 1);
      var fresh = visible().filter(function (i) { return was.indexOf(i) < 0; });
      setTimeout(function () { loop(gen, fresh.length ? fresh : visible()); }, SLIDE_MS);
    }

    /* ---------- when it runs ---------- */
    function update() {
      var should = playing && onScreen && !document.hidden && !hover && !keyFocus && !held;
      if (should && !running) {
        running = true;
        loop(++run, visible());
      } else if (!should && running) {
        running = false;
        run++;
      }
      // Announce changes only when the visitor is the one making them (APG).
      grid.setAttribute('aria-live', running ? 'off' : 'polite');
    }

    // Any touch of the carousel: hold it, and pick up again after a quiet spell.
    function interact() {
      held = true;
      clearTimeout(idleTimer);
      idleTimer = setTimeout(function () { held = false; update(); }, IDLE_MS);
      update();
    }

    viewport.addEventListener('pointerdown', interact);
    viewport.addEventListener('input', interact);
    viewport.addEventListener('keydown', interact);
    // Hover: only a pointer that really moves over the photos. Chrome also
    // fires pointer events when the page scrolls under a resting cursor,
    // which would stop the carousel for anyone who scrolls with the mouse
    // parked mid-screen. Those carry no movement.
    viewport.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse' || hover || !(e.movementX || e.movementY)) return;
      hover = true;
      update();
    });
    viewport.addEventListener('pointerleave', function () {
      if (!hover) return;
      hover = false;
      interact();
    });
    // Keyboard focus on a handle holds it while it is there. A mouse click
    // does not count: the pointerdown already held it, and :focus-visible
    // is false for a click.
    viewport.addEventListener('focusin', function (e) {
      var kb = false;
      try { kb = e.target.matches(':focus-visible'); } catch (_) { kb = true; }
      if (kb) { keyFocus = true; update(); }
    });
    viewport.addEventListener('focusout', function (e) {
      if (!keyFocus || viewport.contains(e.relatedTarget)) return;
      keyFocus = false;
      interact();
    });

    bar.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('button');
      if (!b) return;
      if (b === playBtn) {
        playing = !playing;
        held = false;
        clearTimeout(idleTimer);
        paintPlay();
        update();
        return;
      }
      var to = b.hasAttribute('data-to') ? +b.getAttribute('data-to') : start + (+b.getAttribute('data-step'));
      interact();
      go(to);
    });
    // Arrow keys on the controls step through, as on Bootstrap's carousel.
    // On a handle they already move the handle, which is what that means there.
    bar.addEventListener('keydown', function (e) {
      var to = { ArrowLeft: start - 1, ArrowRight: start + 1, Home: 0, End: stops() - 1 }[e.key];
      if (to === undefined) return;
      e.preventDefault();
      interact();
      go(to);
    });

    // Out of sight: stop, and forget any hold, so coming back starts it again.
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        var e = entries[entries.length - 1];
        var now = e.isIntersecting && e.intersectionRatio >= 0.35;
        if (now === onScreen) return;
        onScreen = now;
        if (!now) { held = false; hover = false; clearTimeout(idleTimer); }
        update();
      }, { threshold: [0, 0.35, 0.6] }).observe(viewport);
    } else {
      onScreen = true;
    }
    document.addEventListener('visibilitychange', update);
    var onReduce = function () {
      if (reduce.matches) { playing = false; paintPlay(); update(); }
    };
    if (reduce.addEventListener) reduce.addEventListener('change', onReduce);
    // Resizing past a breakpoint changes how many cards fit, so the stops and
    // the indicators change with it.
    window.addEventListener('resize', function () {
      var p = readPer();
      if (p !== per) { per = p; dots(); start = Math.min(start, stops() - 1); }
      place(true);
    });

    dots();
    paintPlay();
    place(true);
    update();
  }

  fetch('data/gallery.json', { cache: 'no-cache' })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      var pairs = (data && data.pairs) || [];
      if (!pairs.length) { root.remove(); return; }
      grid.innerHTML = pairs.map(card).join('');
      // script.js binds the drag behaviour on load, so re-run it for the
      // sliders that did not exist at that point.
      if (window.ACSliders && window.ACSliders.bind) window.ACSliders.bind();
      if (root !== grid) carousel([].slice.call(grid.children));
      if (window.ACReveal && window.ACReveal.observe) window.ACReveal.observe();
    })
    .catch(function () {
      // A missing manifest should not leave an empty hole in the page.
      root.remove();
    });
})();

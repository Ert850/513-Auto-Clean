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
   * One comparison per view on a phone, two from 820px up, three from
   * 1100px, where a third of the container is still about as wide as a
   * phone's card. styles.css owns those breakpoints (--ba-per); this reads
   * them.
   *
   * Each card that comes into view wipes once, on its own clock (the
   * owner's round 3): 3 s at rest in the middle (time to reach for the
   * handle), to the right edge (the whole before), then slowly across to
   * the left edge (the whole after), where it waits. New cards start 2.5 s
   * apart, so they never move in lockstep.
   *
   * The last move is shared (round 4): once every wiping card has shown its
   * whole after for at least 2.5 s, they all glide back to the middle
   * together, and the track starts moving on as they arrive, by one card
   * (two when three are in view). So the handles come home with the shift,
   * and no card waits in the middle for the slowest one. A card still in
   * view after the shift has had its wipe and rests in the middle until it
   * leaves; only the new arrivals wipe.
   *
   * It loops without an end, like Swiper's loop mode or Embla's: past the
   * last comparison it carries on forward into the first, instead of racing
   * back across them all. That is done by moving the cards that have slid
   * out at one end of the track to the other end, then resetting the track
   * without a transition, so the same cards stay exactly where they were.
   * No copies of the cards, so no duplicate photos or handles.
   *
   * Conventions (WAI-ARIA carousel pattern, Bootstrap, WCAG 2.2.2): a pause
   * button, previous and next, one dot per comparison, arrow keys on the
   * controls, region and slide roles, aria-live off only while it moves, no
   * motion under reduced motion, nothing while the tab is hidden.
   *
   * The play button is the state. Clicking or dragging a photo, a chevron,
   * a dot, or keyboard focus on a handle pauses it and the button shows
   * Play. Paused that way, it plays again by itself after IDLE_MS without a
   * touch, or once it has been scrolled out of view and back, and the
   * button flips back to Pause. Pressing Pause is the visitor saying no:
   * only their Play starts it again. Hovering does nothing.
   *
   * The motion is one requestAnimationFrame loop reading fixed timelines,
   * with no timers between phases and no waiting for photos mid-wipe (the
   * next cards' photos are fetched a whole step ahead). Each frame writes
   * one CSS variable per card, and the stylesheet turns it into transforms
   * and opacity, which the compositor moves without layout or repaint.
   */
  var WIPE = [             // one card: [ms, where the handle goes]; no target = hold
    [3000],                // rest in the middle: time to grab the handle
    [1800, 100],           // to the right edge: the whole before
    [2000],
    [4000, 0],             // wipe across, a quarter of the photo a second: the whole after
    [2500]                 // at least this long on the after, then it waits for the others
  ];
  var WIPE_MS = WIPE.reduce(function (t, w) { return t + w[0]; }, 0);    // 13.3 s
  var RETURN_MS = 1500;    // all together, back to the middle
  var STAGGER_MS = 2500;   // new cards start this far apart
  var SLIDE_MS = 900;      // .ba-track's transition
  // The track starts moving this long before the handles reach the middle,
  // so the return and the glide read as one motion.
  var OVERLAP_MS = 400;
  var SETTLE_MS = 450;     // a paused card's handle gliding home
  var PHOTO_WAIT_MS = 1500;
  var IDLE_MS = 12000;

  // Ease in and out (cubic): starts and ends at rest, no visible kink.
  function ease(t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  function carousel(slides) {
    var n = slides.length;
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    var viewport = root.querySelector('.ba-viewport') || grid;

    var per = readPer();
    var playing = !reduce.matches;   // what the button shows, and the truth
    var byTouch = false;             // paused by a touch, so it may resume itself
    var onScreen = false, keyFocus = false, dragging = false;
    var idleTimer = null;
    var running = false;
    var homing = null;               // the shared return to the middle
    var settles = [];                // handles gliding back to the middle
    var raf = 0;
    var pendingMove = null, moveTimer = null;

    slides.forEach(function (s, i) {
      s._i = i;
      s._stage = s.querySelector('.ba-stage');
      s._range = s.querySelector('.ba-range');
      paint(s, 50, true);
    });

    function readPer() { return parseInt(getComputedStyle(grid).getPropertyValue('--ba-per'), 10) || 1; }
    function perView() { return Math.min(n, per); }
    function loops() { return n > perView(); }
    function order() { return [].slice.call(grid.children); }
    function shown() { return order().slice(0, perView()); }
    function first() { return grid.firstElementChild._i; }

    /* ---------- the handle ---------- */
    // Per frame: CSS variables only. No layout reads, no input value.
    function paint(s, v, force) {
      if (v === s._pos && !force) return;
      s._pos = v;
      s._stage.style.setProperty('--pos', v + '%');
      s._stage.style.setProperty('--p', v);
    }
    // When it comes to rest: the range input catches up, for the keyboard
    // and for script.js's drag code, which starts from its value.
    function commit(s) { s._range.value = s._pos; }
    // A card the visitor moved by hand is where script.js put it.
    function posOf(s) { return s._user ? parseFloat(s._range.value) : s._pos; }

    /* ---------- controls ---------- */
    var ICON_PAUSE = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>';
    var ICON_PLAY = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>';
    var ICON_PREV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
    var ICON_NEXT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';

    var bar = document.createElement('div');
    bar.className = 'ba-controls';
    // The rotation control comes first in the tab order (APG).
    bar.innerHTML =
      '<div class="ba-nav">' +
        '<button type="button" class="ba-ctl ba-play"></button>' +
        '<button type="button" class="ba-ctl" data-step="-1" aria-controls="baGrid" aria-label="Previous photo">' + ICON_PREV + '</button>' +
        '<div class="ba-dots" role="group" aria-label="Choose a photo"></div>' +
        '<button type="button" class="ba-ctl" data-step="1" aria-controls="baGrid" aria-label="Next photo">' + ICON_NEXT + '</button>' +
      '</div>';
    root.appendChild(bar);
    // The Instagram link joins the control row, so it is not left on its own
    // under the controls. It stays in the page's markup for when there are
    // no photos to show.
    var foot = document.querySelector('#gallery .gal-foot');
    var insta = foot && foot.querySelector('a');
    if (insta) { bar.appendChild(insta); foot.remove(); }
    var playBtn = bar.querySelector('.ba-play');
    var dotsBox = bar.querySelector('.ba-dots');
    var painted = null;

    var html = '';
    for (var i = 0; i < n; i++) {
      html += '<button type="button" class="ba-dot" data-to="' + i + '" aria-controls="baGrid" aria-label="Show photo ' + (i + 1) + ' of ' + n + '"></button>';
    }
    dotsBox.innerHTML = html;

    function paintPlay() {
      if (painted === playing) return;
      painted = playing;
      // Same button, new label and icon, so focus stays on it (WAI tutorial).
      playBtn.innerHTML = playing ? ICON_PAUSE : ICON_PLAY;
      playBtn.setAttribute('aria-label', playing ? 'Pause the before and after slideshow' : 'Play the before and after slideshow');
    }

    function mark(list) {
      slides.forEach(function (s) {
        var on = list.indexOf(s) >= 0;
        // Cards out of view are out of the tab order and the reading order.
        s.toggleAttribute('inert', !on);
        if (on) s.removeAttribute('aria-hidden'); else s.setAttribute('aria-hidden', 'true');
      });
    }
    function markDots(i) {
      [].forEach.call(dotsBox.children, function (d, k) {
        if (k === i) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current');
      });
    }
    function wake(list) {
      list.forEach(function (s) {
        s.querySelectorAll('img[loading="lazy"]').forEach(function (img) { img.loading = 'eager'; });
      });
    }
    function loaded(list) {
      return list.every(function (s) {
        return [].every.call(s.querySelectorAll('img'), function (img) { return img.complete; });
      });
    }
    // The cards in view, the page after them, and the one before (for Previous).
    function wakeAround() {
      var o = order(), p = perView();
      wake(o.slice(0, 2 * p).concat(o.slice(-1)));
    }

    /* ---------- moving the track ---------- */
    function snap(x) {
      grid.style.transition = 'none';
      grid.style.transform = x ? 'translateX(' + x + 'px)' : '';
      void grid.offsetWidth;
      grid.style.transition = '';
    }
    function finishMove() {
      clearTimeout(moveTimer);
      if (pendingMove) { var f = pendingMove; pendingMove = null; f(); restHidden(); }
    }
    // Cards that have slid out of view stop their wipe and wait in the
    // middle, out of sight, for their next turn.
    function restHidden() {
      var on = shown();
      slides.forEach(function (s) {
        if (on.indexOf(s) >= 0) return;
        s._t0 = null; s._wait = null; s._user = false; s._done = false;
        settles = settles.filter(function (st) { return st.s !== s; });
        s.classList.remove('auto');
        if (s._pos !== 50) { paint(s, 50); commit(s); }
      });
    }
    grid.addEventListener('transitionend', function (e) {
      if (e.target === grid && e.propertyName === 'transform') finishMove();
    });

    // Move d cards forward (d > 0) or back. Forward slides the track along,
    // then puts the cards that left at the far end. Back first brings cards
    // from the far end to the front, offset so nothing moves, then slides.
    function move(d) {
      finishMove();
      if (!d || !loops()) return;
      var p = perView(), o = order(), k = Math.abs(d);
      if (k + p > n) {
        // Too far to slide without running out of cards: jump instead.
        for (var j = 0; j < (d > 0 ? k : n - k); j++) grid.appendChild(grid.firstElementChild);
        snap(0);
        restHidden();
      } else if (d > 0) {
        mark(o.slice(k, k + p));
        grid.style.transform = 'translateX(' + (-o[k].offsetLeft) + 'px)';
        pendingMove = function () {
          for (var j = 0; j < k; j++) grid.appendChild(grid.firstElementChild);
          snap(0);
        };
        moveTimer = setTimeout(finishMove, SLIDE_MS + 150);
      } else {
        for (var m = 0; m < k; m++) grid.insertBefore(grid.lastElementChild, grid.firstElementChild);
        snap(-order()[k].offsetLeft);
        grid.style.transform = '';
        pendingMove = function () {};
        moveTimer = setTimeout(finishMove, SLIDE_MS + 150);
      }
      mark(shownAfter(d));
      markDots((first() + (k + p > n || d < 0 ? 0 : k)) % n);
      wakeAround();
    }
    // What will be in view once a move lands (the DOM has not rotated yet
    // for a forward slide).
    function shownAfter(d) {
      var o = order(), p = perView();
      return d > 0 && pendingMove ? o.slice(d, d + p) : o.slice(0, p);
    }
    // Shortest way round to put comparison i first in view.
    function goTo(i) {
      var f = ((i - first()) % n + n) % n;
      move(f <= n - f ? f : f - n);
    }

    /* ---------- the wipes and the advance ---------- */
    function kick() { if (!raf) raf = requestAnimationFrame(tick); }
    function tick(now) {
      raf = 0;
      if (running) run(now);
      settles = settles.filter(function (st) { return settle(st, now); });
      if (running || settles.length) kick();
    }

    function stepSize() { return Math.min(perView() > 2 ? 2 : 1, n - perView()); }

    function run(now) {
      // The shared return, and the shift that starts as it lands.
      if (homing) {
        var h = homing, t = Math.min(1, (now - h.t0) / RETURN_MS);
        h.cards.forEach(function (c, j) { paint(c, h.from[j] + (50 - h.from[j]) * ease(t)); });
        if (!h.moved && now - h.t0 >= RETURN_MS - OVERLAP_MS) {
          h.moved = true;
          if (loops()) move(stepSize());
        }
        if (t < 1) return;
        h.cards.forEach(function (c) { commit(c); c.classList.remove('auto'); c._t0 = null; c._done = true; });
        homing = null;
        // Nowhere to move on to: the same cards go round again.
        if (!loops()) shown().forEach(function (c) { c._done = false; });
        return;
      }
      // Nothing new starts while the track glides.
      if (pendingMove) return;
      // Start the clock of each card that has come into view and not yet
      // had its wipe, a stagger apart. The only wait for photos is here,
      // with the handle at rest.
      var lag = 0;
      shown().forEach(function (c) {
        if (c._t0 != null || c._done) return;
        if (!loaded([c])) {
          if (c._wait == null) c._wait = now;
          if (now - c._wait < PHOTO_WAIT_MS) return;
        }
        c._wait = null;
        c._t0 = now + lag;
        lag += STAGGER_MS;
        c._from = posOf(c);
        c._user = false;
        c.classList.add('auto');
        settles = settles.filter(function (st) { return st.s !== c; });
      });
      var wiping = slides.filter(function (c) { return c._t0 != null; });
      wiping.forEach(function (c) { wipe(c, now); });
      // Everyone has shown the after long enough: home together.
      if (wiping.length && wiping.every(function (c) { return now - c._t0 >= WIPE_MS; })) {
        homing = { t0: now, cards: wiping, from: wiping.map(function (c) { return c._pos; }), moved: false };
      }
    }

    function wipe(c, now) {
      var e = now - c._t0;
      if (e < 0) return;              // waiting its turn
      var from = c._from, k = 0;
      while (k < WIPE.length && e >= WIPE[k][0]) {
        if (WIPE[k][1] !== undefined) from = WIPE[k][1];
        e -= WIPE[k][0];
        k++;
      }
      if (k === WIPE.length) return paint(c, from);   // on the after, waiting for the others
      var to = WIPE[k][1];
      paint(c, to === undefined ? from : from + (to - from) * ease(e / WIPE[k][0]));
    }

    // Stopped mid-wipe: the handles the carousel moved glide back to the
    // middle, so no card is left showing a half-hidden handle at an edge.
    // A handle the visitor moved stays where they put it.
    function settle(st, now) {
      var s = st.s;
      if (s._user) { s.classList.remove('auto'); return false; }
      if (st.t0 === null) { st.t0 = now; st.from = s._pos; }
      var t = Math.min(1, (now - st.t0) / SETTLE_MS);
      paint(s, st.from + (50 - st.from) * ease(t));
      if (t < 1) return true;
      commit(s);
      s.classList.remove('auto');
      return false;
    }

    function halt() {
      running = false;
      // A return under way finishes as a settle; on resume every card in
      // view gets a fresh wipe.
      homing = null;
      slides.forEach(function (s) {
        s._done = false;
        if (s._t0 == null) return;
        s._t0 = null;
        s._wait = null;
        if (s._user) { s.classList.remove('auto'); return; }
        if (s._pos !== 50) settles.push({ s: s, t0: null });
        else { commit(s); s.classList.remove('auto'); }
      });
      kick();
    }

    /* ---------- when it runs ---------- */
    function update() {
      var run = playing && onScreen && !document.hidden;
      if (run && !running) { running = true; kick(); }
      else if (!run && running) halt();
      // Announce changes only when the visitor is the one making them (APG).
      grid.setAttribute('aria-live', run ? 'off' : 'polite');
      paintPlay();
    }

    function resumeLater() {
      clearTimeout(idleTimer);
      if (!byTouch) return;
      idleTimer = setTimeout(function () {
        if (keyFocus || dragging) return resumeLater();
        byTouch = false;
        playing = true;
        update();
      }, IDLE_MS);
    }

    // A touch: pause, and say so on the button. If the visitor had already
    // pressed Pause, it stays their pause: no automatic restart.
    function touch(card) {
      if (card) { card._user = true; card.classList.remove('auto'); }
      if (playing) { playing = false; byTouch = true; }
      resumeLater();
      update();
    }

    function cardOf(e) { return e.target.closest && e.target.closest('.ba-slider'); }
    viewport.addEventListener('pointerdown', function (e) { dragging = true; touch(cardOf(e)); });
    window.addEventListener('pointerup', function () { if (dragging) { dragging = false; resumeLater(); } });
    window.addEventListener('pointercancel', function () { if (dragging) { dragging = false; resumeLater(); } });
    viewport.addEventListener('keydown', function (e) { if (e.key !== 'Tab') touch(cardOf(e)); });
    // Keyboard focus on a handle pauses it while it is there. A click does
    // not count: the pointerdown already paused it, and :focus-visible is
    // false for a click.
    viewport.addEventListener('focusin', function (e) {
      var kb = false;
      try { kb = e.target.matches(':focus-visible'); } catch (_) { kb = true; }
      if (kb) { keyFocus = true; touch(null); }
    });
    viewport.addEventListener('focusout', function (e) {
      if (!keyFocus || viewport.contains(e.relatedTarget)) return;
      keyFocus = false;
      resumeLater();
    });

    bar.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('button');
      if (!b) return;
      if (b === playBtn) {
        // Play means play now, whatever paused it.
        playing = !playing;
        byTouch = false;
        clearTimeout(idleTimer);
        update();
        return;
      }
      touch(null);
      if (b.hasAttribute('data-to')) goTo(+b.getAttribute('data-to'));
      else move(+b.getAttribute('data-step'));
    });
    // Arrow keys on the controls step through, as on Bootstrap's carousel.
    // On a handle they already move the handle, which is what that means there.
    bar.addEventListener('keydown', function (e) {
      var to = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
      if (to !== undefined) { e.preventDefault(); touch(null); move(to); return; }
      if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); touch(null); goTo(e.key === 'Home' ? 0 : n - 1); }
    });

    // Out of sight: stop. If a touch paused it, coming back plays it again,
    // and the button says so straight away.
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        var en = entries[entries.length - 1];
        var now = en.isIntersecting && en.intersectionRatio >= 0.35;
        if (now === onScreen) return;
        onScreen = now;
        if (!now && byTouch && !keyFocus) { byTouch = false; playing = true; clearTimeout(idleTimer); }
        update();
      }, { threshold: [0, 0.35, 0.6] }).observe(viewport);
    } else {
      onScreen = true;
    }
    document.addEventListener('visibilitychange', update);
    var onReduce = function () {
      if (reduce.matches) { playing = false; byTouch = false; update(); }
    };
    if (reduce.addEventListener) reduce.addEventListener('change', onReduce);
    // Resizing past a breakpoint changes how many cards fit.
    window.addEventListener('resize', function () {
      var p = readPer();
      if (p === per) return;
      finishMove();
      per = p;
      bar.classList.toggle('single', !loops());
      mark(shown());
    });

    bar.classList.toggle('single', !loops());
    mark(shown());
    markDots(0);
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

/* ============================================================
   513 Auto Clean, interactions
   ============================================================ */
(function () {
  'use strict';

  /* ---------- Year ---------- */
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- Header shadow on scroll + mobile bar ---------- */
  var header = document.getElementById('header');
  var mobileBar = document.getElementById('mobileBar');
  function onScroll() {
    var y = window.scrollY || window.pageYOffset;
    if (header) header.classList.toggle('scrolled', y > 8);
    // show sticky mobile call bar after leaving the hero
    if (mobileBar) mobileBar.classList.toggle('show', y > 520);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* Jumps to a section stop exactly under the sticky header. styles.css says
     90px, but the header is 73px tall, so every jump stopped short and showed
     a strip of the section above. Measured instead of guessed, and again on
     resize, since the header's height is whatever its contents make it. */
  function fitScrollPadding() {
    if (header) document.documentElement.style.scrollPaddingTop = header.offsetHeight + 'px';
  }
  fitScrollPadding();
  window.addEventListener('resize', fitScrollPadding);

  /**
   * Opening a "How it works" or an FAQ answer should show the answer.
   *
   * Same rule as the booking funnel: move the page only when the thing that
   * just opened is not already readable. Capture phase, because `toggle`
   * does not bubble.
   */
  document.addEventListener('toggle', function (e) {
    var d = e.target;
    if (!d || d.tagName !== 'DETAILS' || !d.open) return;
    var box = d.getBoundingClientRect();
    var h = window.innerHeight || document.documentElement.clientHeight;
    // A header floats over the top of the page, so "visible" starts below it.
    var headerH = 72;
    if (box.bottom <= h && box.top >= headerH) return;
    var summary = d.querySelector('summary') || d;
    summary.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, true);

  /* ---------- Mobile menu ---------- */
  var navToggle = document.getElementById('navToggle');
  var mobileMenu = document.getElementById('mobileMenu');
  var scrim = document.getElementById('scrim');
  var mmClose = document.getElementById('mmClose');

  function openMenu() {
    mobileMenu.classList.add('open');
    scrim.classList.add('open');
    navToggle.classList.add('open');
    navToggle.setAttribute('aria-expanded', 'true');
    mobileMenu.setAttribute('aria-hidden', 'false');
    // `inert` is what actually takes the drawer out of the tab order.
    // aria-hidden only hides it from a screen reader, so a keyboard user was
    // tabbing through ten invisible links parked off the right of the screen
    // with no way to tell where the focus ring had gone.
    mobileMenu.removeAttribute('inert');
    document.body.style.overflow = 'hidden';
  }
  function closeMenu() {
    mobileMenu.classList.remove('open');
    scrim.classList.remove('open');
    navToggle.classList.remove('open');
    navToggle.setAttribute('aria-expanded', 'false');
    mobileMenu.setAttribute('aria-hidden', 'true');
    mobileMenu.setAttribute('inert', '');
    document.body.style.overflow = '';
  }
  if (navToggle) navToggle.addEventListener('click', function () {
    mobileMenu.classList.contains('open') ? closeMenu() : openMenu();
  });
  if (mmClose) mmClose.addEventListener('click', closeMenu);
  if (scrim) scrim.addEventListener('click', closeMenu);
  document.querySelectorAll('.mobile-menu a').forEach(function (a) {
    a.addEventListener('click', closeMenu);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && mobileMenu.classList.contains('open')) closeMenu();
  });

  /* ---------- Priority+ top nav (owner, November 12) ----------
     From 1040 to 1089 px the header was wider than the window and Book Now
     ran off the right edge. Now, when the links do not fit, Contact Us shows
     its icon only, then links move from the end, in the same order, into
     More. When fewer than three links would be left, the menu button and the
     bottom bar take over, as on phones (html.nav-burger). */
  var navEl = document.querySelector('.header .nav');
  var navLinks = navEl && navEl.querySelector('.nav-links');
  var navMore = document.getElementById('navMore');
  var navMoreBtn = document.getElementById('navMoreBtn');
  var navMoreMenu = document.getElementById('navMoreMenu');
  if (navLinks && navMore && navMoreBtn && navMoreMenu) {
    var ppLinks = Array.prototype.slice.call(navLinks.children);
    var ppShut = function (refocus) {
      navMoreMenu.hidden = true;
      navMoreBtn.setAttribute('aria-expanded', 'false');
      if (refocus) navMoreBtn.focus();
    };
    var ppOver = function () { return navLinks.scrollWidth > navLinks.clientWidth + 1; };
    // Results, Services and Meet the Team are the least the bar shows; with
    // fewer, it switches to the menu button (owner, November 12: two links
    // and More looked odd).
    var PP_MIN = 3;
    var html = document.documentElement;
    var ppFit = function () {
      ppShut(false);
      html.classList.remove('nav-burger');
      navEl.classList.remove('pp-tight');
      navMore.hidden = true;
      ppLinks.forEach(function (a) { a.classList.remove('pp-off'); });
      navMoreMenu.innerHTML = '';
      if (!navLinks.offsetParent) return; // phones: the menu button has them
      if (!ppOver()) return;
      navEl.classList.add('pp-tight');
      var n = ppLinks.length;
      while (ppOver() && n > 1) {
        n--;
        ppLinks[n].classList.add('pp-off');
        navMore.hidden = false;
      }
      if (n < PP_MIN) {
        ppLinks.forEach(function (a) { a.classList.remove('pp-off'); });
        navMore.hidden = true;
        navEl.classList.remove('pp-tight');
        html.classList.add('nav-burger');
        return;
      }
      ppLinks.slice(n).forEach(function (a) {
        var c = document.createElement('a');
        c.href = a.getAttribute('href');
        c.textContent = a.textContent;
        navMoreMenu.appendChild(c);
      });
    };
    ppFit();
    if (window.ResizeObserver) new ResizeObserver(function () { ppFit(); }).observe(navEl);
    else window.addEventListener('resize', ppFit);
    // The web fonts change the links' widths after first paint.
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(ppFit);
    navMoreBtn.addEventListener('click', function () {
      var open = navMoreMenu.hidden;
      navMoreMenu.hidden = !open;
      navMoreBtn.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('click', function (e) {
      if (!navMoreMenu.hidden && !navMore.contains(e.target)) ppShut(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !navMoreMenu.hidden) ppShut(true);
    });
    navMore.addEventListener('focusout', function (e) {
      if (!navMore.contains(e.relatedTarget)) ppShut(false);
    });
  }

  /* ---------- Land where the link said, even while the page is still filling ----------
     A jump to a section is aimed at where that section is AT THAT MOMENT. The
     gallery (built from data/gallery.json), the review ticker (shown once
     reviews load) and the web fonts (display=swap) all change height after the
     first paint, so a tap on Services early on landed up to ~1300px short, and
     about.html#reviews drifted when the fonts swapped in above it.

     So for a moment after any jump to an id on this page, the target is held:
     whenever the page changes size, it is scrolled back to the target, until
     things settle or the visitor scrolls themselves. */
  var pinStop = null;
  function pinTo(id, behavior) {
    var target = id && document.getElementById(id);
    if (!target || !('ResizeObserver' in window)) return;
    if (pinStop) pinStop();
    // 'auto' follows the stylesheet (smooth); 'instant' jumps.
    var ro = new ResizeObserver(function () { target.scrollIntoView({ block: 'start', behavior: behavior || 'auto' }); });
    var timer = setTimeout(stop, 2500);
    function stop() {
      ro.disconnect();
      clearTimeout(timer);
      ['wheel', 'touchmove', 'keydown', 'pointerdown'].forEach(function (ev) { window.removeEventListener(ev, stop); });
      pinStop = null;
    }
    ['wheel', 'touchmove', 'keydown', 'pointerdown'].forEach(function (ev) { window.addEventListener(ev, stop, { passive: true }); });
    pinStop = stop;
    ro.observe(document.body);
  }
  // Smooth scrolling is done here, for clicks within the page, and NOT by
  // `scroll-behavior: smooth` in the stylesheet: that also animated arriving
  // from another page, so about.html -> index.html#inquiry opened at the top
  // and slid 4700px down. Arrivals now land in place; clicks still glide.
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href*="#"]');
    if (!a || e.defaultPrevented || a.pathname !== location.pathname || a.hash.length < 2) return;
    var id = decodeURIComponent(a.hash.slice(1));
    var target = document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    if (location.hash !== a.hash) history.pushState(null, '', a.hash);
    var how = reduceMotion ? 'instant' : 'smooth';
    target.scrollIntoView({ block: 'start', behavior: how });
    pinTo(id, how);
  });
  // Arriving from another page, e.g. about.html#reviews from the menu. This
  // JUMPS: with smooth scrolling on, the page otherwise opened at the top and
  // then visibly slid thousands of pixels down to the section, which read as
  // the page repositioning itself. Held again once everything has loaded
  // (images, fonts), unless the visitor has already started moving around.
  // Links to sections of the old one-page home page (the Google Business
  // Profile, old ads, bookmarks) now go to the page each section became,
  // instead of the top of the home page. #schedule was the booking section.
  var MOVED = { about: 'about.html', team: 'about.html', reviews: 'about.html#reviews',
    areas: 'service-area.html', travel: 'service-area.html', faq: 'faq.html', inquiry: 'contact.html' };
  var oldId = location.hash.slice(1);
  var onHome = /(^\/$|\/index\.html$)/.test(location.pathname);
  if (onHome && oldId && !document.getElementById(oldId) && (MOVED[oldId] || oldId === 'schedule')) {
    if (oldId === 'schedule') {
      history.replaceState(null, '', location.pathname + location.search + '#book');
      if (window.ACFunnel) window.ACFunnel.open();
    } else {
      var to = MOVED[oldId].split('#');
      location.replace(to[0] + location.search + (to[1] ? '#' + to[1] : ''));
    }
  } else if (location.hash.length > 1) {
    var touched = false;
    ['wheel', 'touchmove', 'keydown', 'pointerdown'].forEach(function (ev) {
      window.addEventListener(ev, function () { touched = true; }, { passive: true, once: true });
    });
    var arrive = function () { if (!touched) pinTo(decodeURIComponent(location.hash.slice(1)), 'instant'); };
    arrive();
    window.addEventListener('load', arrive, { once: true });
  }

  /* ---------- Copy a discount code (print landing pages, [data-copy-code]) ---------- */
  // Its own attribute: the phone-number buttons use data-copy with their own
  // handler below, and a shared one relabelled them "Copy code" (November 11).
  // "Copy code" becomes "Copied" with a tick for two seconds. Where the
  // clipboard is unavailable (an old browser, or no permission), the code
  // itself is selected so a long press or Cmd+C copies it.
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-copy-code]');
    if (!b) return;
    var code = b.getAttribute('data-copy-code');
    var label = b.querySelector('span');
    var finish = function (ok) {
      if (!ok) {
        var shown = b.parentNode && b.parentNode.querySelector('b');
        if (shown && window.getSelection) {
          var r = document.createRange(); r.selectNodeContents(shown);
          var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
        }
      }
      b.classList.toggle('copied', ok);
      if (label) label.textContent = ok ? 'Copied' : 'Selected, copy it';
      clearTimeout(b.acCopyT);
      b.acCopyT = setTimeout(function () { b.classList.remove('copied'); if (label) label.textContent = 'Copy code'; }, 2000);
    };
    var fallback = function () {
      var t = document.createElement('textarea');
      t.value = code; t.setAttribute('readonly', '');
      t.style.position = 'fixed'; t.style.opacity = '0';
      document.body.appendChild(t); t.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (x) { ok = false; }
      document.body.removeChild(t);
      finish(ok);
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(code).then(function () { finish(true); }, fallback);
    } else fallback();
    if (window.AC_TRACK) window.AC_TRACK('promo_copy', { code: code });
  });

  /* ---------- Service tabs ---------- */
  var tabs = document.querySelectorAll('.svc-tab');
  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      var panel = tab.getAttribute('data-panel');
      tabs.forEach(function (t) {
        var on = t === tab;
        t.classList.toggle('active', on);
        t.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      document.querySelectorAll('.svc-panel').forEach(function (p) {
        p.classList.toggle('active', p.id === 'panel-' + panel);
      });
    });
  });

  /* ---------- Services page: the full checklists when they fit ----------
     services.html folds each package list after three items ("N more
     included", web/scripts/render-site.mjs) so the cards, their Book buttons
     and the offers banner fit a laptop screen. On a screen tall enough for
     the full lists they open and the toggle goes (.svc-full in styles.css),
     so every inclusion shows as one list: the owner wants the lists growing
     package to package on show wherever there is room. The height is where
     the full Interior cards and the banner still fit (measured, see
     docs/SESSION-CHANGES-fold.md). 940, not 900, since the eyebrow came back
     (owner, November 10): at 900 the banner ended at 926 (final validation,
     November 11). */
  var foldMq = window.matchMedia('(min-width: 1000px) and (min-height: 940px)');
  function syncFold() {
    var full = foldMq.matches;
    document.documentElement.classList.toggle('svc-full', full);
    document.querySelectorAll('.svc-more').forEach(function (d) { d.open = full; });
  }
  if (document.querySelector('.svc-more')) {
    syncFold();
    if (foldMq.addEventListener) foldMq.addEventListener('change', syncFold);
    else if (foldMq.addListener) foldMq.addListener(syncFold);
  }

  /* ---------- Before / after sliders ----------
     Exposed so js/gallery.js can bind the ones it injects from the manifest,
     which do not exist when this runs. */
  function bindSliders() {
  document.querySelectorAll('.ba-slider:not([data-bound])').forEach(function (slider) {
    slider.setAttribute('data-bound', '1');
    var stage = slider.querySelector('.ba-stage');
    var range = slider.querySelector('.ba-range');
    if (!stage || !range) return;
    function setPos(v) {
      v = Math.max(0, Math.min(100, v));
      stage.style.setProperty('--pos', v + '%');
    }
    range.addEventListener('input', function () { setPos(parseFloat(range.value)); });
    // allow grabbing/dragging anywhere on the image (pointer)
    function fromEvent(e) {
      var rect = stage.getBoundingClientRect();
      var x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
      var pct = (x / rect.width) * 100;
      range.value = pct;
      setPos(pct);
    }
    var dragging = false;
    stage.addEventListener('pointerdown', function (e) { dragging = true; fromEvent(e); });
    window.addEventListener('pointermove', function (e) { if (dragging) fromEvent(e); });
    window.addEventListener('pointerup', function () { dragging = false; });
    setPos(parseFloat(range.value));
  });
  }
  bindSliders();
  window.ACSliders = { bind: bindSliders };

  /* ---------- Scroll reveal ----------
     Elements fade up when scrolling at a normal pace. When the page is being
     scrubbed quickly, we snap them in with no fade or stagger (see the
     .scrolling-fast rule in styles.css) so the page stays readable in real
     time at any scroll speed. Anything still below the viewport keeps its
     animation for the next slow scroll. */
  var reveals = document.querySelectorAll('.reveal');
  var docEl = document.documentElement;
  var io = null;

  function markIn(el) {
    el.classList.add('in');
    if (io) io.unobserve(el);
  }

  if ('IntersectionObserver' in window) {
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) markIn(en.target);
      });
    }, {
      threshold: 0,
      // Trigger well before the element reaches the viewport so ordinary
      // scrolling never shows an unrevealed element.
      rootMargin: '400px 0px 400px 0px'
    });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('in'); });
  }

  /* Re-scan for injected content, e.g. the gallery built from the manifest. */
  window.ACReveal = {
    observe: function () {
      var fresh = document.querySelectorAll('.reveal:not(.in)');
      reveals = document.querySelectorAll('.reveal');
      if (io) fresh.forEach(function (el) { io.observe(el); });
      else fresh.forEach(function (el) { el.classList.add('in'); });
    }
  };

  /* Scroll-velocity watch. IntersectionObserver callbacks are async and can
     fall behind a hard flick, so while scrolling fast we also sweep
     synchronously once per animation frame. */
  var FAST_PX_PER_MS = 1.6;   // ~1.6px/ms, a deliberate fast flick, not a normal drag
  var SWEEP_BAND = 600;       // px above/below the viewport to force-reveal
  var vLastY = window.scrollY || window.pageYOffset;
  var vLastT = Date.now();
  var fastTimer = null;
  var sweepQueued = false;

  function sweep() {
    sweepQueued = false;
    if (!io) return;
    var vh = window.innerHeight;
    for (var i = 0; i < reveals.length; i++) {
      var el = reveals[i];
      if (el.classList.contains('in')) continue;
      var r = el.getBoundingClientRect();
      if (r.top < vh + SWEEP_BAND && r.bottom > -SWEEP_BAND) markIn(el);
    }
  }

  function onVelocityScroll() {
    var now = Date.now();
    var y = window.scrollY || window.pageYOffset;
    var dt = now - vLastT;
    if (dt > 0 && Math.abs(y - vLastY) / dt > FAST_PX_PER_MS) {
      docEl.classList.add('scrolling-fast');
      if (!sweepQueued) { sweepQueued = true; requestAnimationFrame(sweep); }
      clearTimeout(fastTimer);
      // Restore the animation shortly after the flick settles.
      fastTimer = setTimeout(function () { docEl.classList.remove('scrolling-fast'); }, 180);
    }
    vLastY = y;
    vLastT = now;
  }
  window.addEventListener('scroll', onVelocityScroll, { passive: true });

  /* ---------- Web3Forms handler ----------
     Shared by both forms on the page: the booking request (#quoteForm) and the
     question form (#inquiryForm). Each finds its own card and status region, so
     a message never lands in the wrong form. */
  var SUCCESS = {
    quoteForm: "Got it, thanks! I'll get back to you shortly with pricing and a time. Need it sooner? Call or text (513) 279-2915.",
    inquiryForm: "Thanks, your question is in. I'll get back to you shortly, usually the same day."
  };

  document.querySelectorAll('form.js-w3form').forEach(function (form) {
    var card = form.closest('.form-card');
    var msg = form.querySelector('.form-msg');
    if (!msg) return;

    function showMsg(type, text) {
      msg.className = 'form-msg ' + type;
      msg.textContent = text;
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var name = form.name.value.trim();
      var phone = form.phone.value.trim();
      if (!name || !phone) {
        showMsg('err', 'Please add your name and phone so we can reach you.');
        (name ? form.phone : form.name).focus();
        return;
      }
      // The question form needs an actual question.
      if (form.id === 'inquiryForm' && !form.message.value.trim()) {
        showMsg('err', 'Let us know what your question is and we\'ll answer it.');
        form.message.focus();
        return;
      }

      if (card) card.classList.add('is-sending');
      showMsg('ok', 'Sending…');

      var fd = new FormData(form);
      // Tick boxes marked data-yesno are sent as "yes" or "no" under their
      // name, so the email says "SMS consent: no" instead of leaving it out.
      form.querySelectorAll('[data-yesno]').forEach(function (b) { fd.set(b.name, b.checked ? 'yes' : 'no'); });
      var src = window.AC_SOURCE ? window.AC_SOURCE() : '';
      if (src) fd.append('source', src);

      fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        body: fd,
        headers: { 'Accept': 'application/json' }
      })
        .then(function (res) { return res.json().then(function (j) { return { ok: res.ok, j: j }; }); })
        .then(function (r) {
          if (card) card.classList.remove('is-sending');
          if (r.ok && r.j.success) {
            form.reset();
            showMsg('ok', form.getAttribute('data-success') || SUCCESS[form.id] || SUCCESS.inquiryForm);
            if (window.AC_TRACK) window.AC_TRACK('question_sent', { form: form.id });
          } else {
            showMsg('err', 'Something went wrong sending that. Please call or text (513) 279-2915 and we\'ll sort it out.');
          }
        })
        .catch(function () {
          if (card) card.classList.remove('is-sending');
          showMsg('err', 'Network hiccup. Please call or text (513) 279-2915 and we\'ll sort it out.');
        });
    });
  });

  /* A question started in the booking form on another page (js/funnel.js
     handOffQuestion). Filled in once, then deleted, and only where the form is. */
  (function () {
    var form = document.getElementById('inquiryForm');
    if (!form) return;
    var raw = null;
    try { raw = sessionStorage.getItem('ac-question'); sessionStorage.removeItem('ac-question'); } catch (e) { return; }
    if (!raw) return;
    var d; try { d = JSON.parse(raw); } catch (e) { return; }
    Object.keys(d.fields || {}).forEach(function (id) {
      var f = document.getElementById(id);
      if (f && d.fields[id] && !f.value) f.value = d.fields[id];
    });
    var m = document.getElementById('q-message');
    if (m && d.msg) {
      m.value = d.msg;
      setTimeout(function () {
        try { m.focus({ preventScroll: true }); m.setSelectionRange(d.msg.length, d.msg.length); } catch (e) { /* older browsers */ }
      }, 300);
    }
  })();

  /* ---------- Copy phone number ---------- */
  document.querySelectorAll('.phone-copy').forEach(function (btn) {
    var label = btn.querySelector('.copy-label');
    var original = label ? label.textContent : '';
    var revert;

    btn.addEventListener('click', function () {
      var text = btn.getAttribute('data-copy') || '';

      function done(ok) {
        btn.classList.toggle('copied', ok);
        if (label) label.textContent = ok ? 'Copied' : 'Press Ctrl+C';
        clearTimeout(revert);
        revert = setTimeout(function () {
          btn.classList.remove('copied');
          if (label) label.textContent = original;
        }, 2000);
      }

      // Clipboard API needs a secure context; fall back to a hidden textarea.
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
        return;
      }
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:absolute;left:-9999px';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
      document.body.removeChild(ta);
      done(ok);
    });
  });
})();

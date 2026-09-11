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
  var lastY = 0;
  function onScroll() {
    var y = window.scrollY || window.pageYOffset;
    if (header) header.classList.toggle('scrolled', y > 8);
    // show sticky mobile call bar after leaving the hero
    if (mobileBar) mobileBar.classList.toggle('show', y > 520);
    lastY = y;
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

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
    document.body.style.overflow = 'hidden';
  }
  function closeMenu() {
    mobileMenu.classList.remove('open');
    scrim.classList.remove('open');
    navToggle.classList.remove('open');
    navToggle.setAttribute('aria-expanded', 'false');
    mobileMenu.setAttribute('aria-hidden', 'true');
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

  /* ---------- Availability calendar (commented out, schedule section removed) ---------- */
  /*
  (function () {
    var el = document.getElementById('schedule-cal');
    if (!el) return;

    var CAL_ID = '75726fed82aa92a27201386beda7b3a15f550a3a5691e5e6cfc51382f0f0b9cf@group.calendar.google.com';
    var API_KEY = 'YOUR_GOOGLE_API_KEY';

    function showEmbed() {
      el.innerHTML = '<iframe title="513 Auto Clean availability" ' +
        'src="https://calendar.google.com/calendar/u/1/newembed?src=75726fed82aa92a27201386beda7b3a15f550a3a5691e5e6cfc51382f0f0b9cf@group.calendar.google.com&ctz=America/New_York&csspa=1&mode=WEEK" ' +
        'style="border:0;width:100%;height:600px" frameborder="0" scrolling="no"></iframe>';
    }

    if (!API_KEY || API_KEY === 'YOUR_GOOGLE_API_KEY' || typeof FullCalendar === 'undefined') {
      showEmbed();
      return;
    }

    try {
      var cal = new FullCalendar.Calendar(el, {
        initialView: 'timeGridWeek',
        headerToolbar: { left: 'prev,next today', center: 'title', right: '' },
        slotMinTime: '07:00:00',
        slotMaxTime: '22:00:00',
        allDaySlot: false,
        height: 'auto',
        expandRows: true,
        nowIndicator: true,
        businessHours: { daysOfWeek: [0, 1, 2, 3, 4, 5, 6], startTime: '07:00', endTime: '22:00' },
        googleCalendarApiKey: API_KEY,
        events: { googleCalendarId: CAL_ID },
        eventColor: '#e01a1a',
        eventDisplay: 'block',
        displayEventTime: false,
        eventContent: function () { return { html: '<div class="fc-unavail">Unavailable</div>' }; },
        eventClick: function (info) { info.jsEvent.preventDefault(); }
      });
      cal.render();
    } catch (e) {
      showEmbed();
    }
  })();
  */

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

      fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        body: new FormData(form),
        headers: { 'Accept': 'application/json' }
      })
        .then(function (res) { return res.json().then(function (j) { return { ok: res.ok, j: j }; }); })
        .then(function (r) {
          if (card) card.classList.remove('is-sending');
          if (r.ok && r.j.success) {
            form.reset();
            showMsg('ok', SUCCESS[form.id] || SUCCESS.inquiryForm);
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

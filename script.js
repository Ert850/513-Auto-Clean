/* ============================================================
   513 Auto Clean — interactions
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

  /* ---------- Prefill form when a package "Book" button is clicked ---------- */
  var serviceSelect = document.getElementById('service');
  document.querySelectorAll('.svc-card .btn[href="#quote"]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var card = btn.closest('.svc-card');
      if (!card || !serviceSelect) return;
      var name = card.querySelector('h3') ? card.querySelector('h3').textContent.trim() : '';
      // match an option that starts with the package name
      Array.prototype.forEach.call(serviceSelect.options, function (opt) {
        if (opt.text.indexOf(name) === 0) serviceSelect.value = opt.value || opt.text;
      });
    });
  });

  /* ---------- Before / after sliders ---------- */
  document.querySelectorAll('.ba-slider').forEach(function (slider) {
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

  /* ---------- Availability calendar (commented out — schedule section removed) ---------- */
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

  /* ---------- Scroll reveal ---------- */
  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add('in');
          io.unobserve(en.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('in'); });
  }

  /* ---------- Quote form (Web3Forms) ---------- */
  var form = document.getElementById('quoteForm');
  var formCard = document.getElementById('formCard');
  var formMsg = document.getElementById('formMsg');

  function showMsg(type, text) {
    formMsg.className = 'form-msg ' + type;
    formMsg.textContent = text;
  }

  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();

      // basic validation
      var name = form.name.value.trim();
      var phone = form.phone.value.trim();
      if (!name || !phone) {
        showMsg('err', 'Please add your name and phone so I can reach you.');
        return;
      }

      var accessKey = form.access_key.value;
      // If the Web3Forms key hasn't been set yet, fall back to a pre-filled text/email
      if (!accessKey || accessKey === 'YOUR_WEB3FORMS_ACCESS_KEY') {
        var body = 'Name: ' + name +
          '%0APhone: ' + phone +
          '%0AEmail: ' + form.email.value.trim() +
          '%0AVehicle: ' + form.vehicle.value.trim() +
          '%0ACity/ZIP: ' + form.zip.value.trim() +
          '%0AService: ' + form.service.value +
          '%0ADetails: ' + form.message.value.trim();
        window.location.href = 'sms:+15132792915?&body=' +
          encodeURIComponent('Quote request — ' + name + ', ' + phone + '. ' + form.service.value + '. ' + form.vehicle.value);
        showMsg('ok', "Opening your messaging app… or just call/text me at (513) 279-2915!");
        return;
      }

      // Submit to Web3Forms via fetch
      formCard.classList.add('is-sending');
      showMsg('ok', 'Sending…');
      var data = new FormData(form);

      fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        body: data,
        headers: { 'Accept': 'application/json' }
      })
        .then(function (res) { return res.json().then(function (j) { return { ok: res.ok, j: j }; }); })
        .then(function (r) {
          formCard.classList.remove('is-sending');
          if (r.ok && r.j.success) {
            form.reset();
            showMsg('ok', "Got it — thanks! I'll get back to you shortly with pricing and a time. Need it sooner? Call or text (513) 279-2915.");
          } else {
            showMsg('err', 'Something went wrong sending that. Please call or text me at (513) 279-2915 and I\'ll get you booked.');
          }
        })
        .catch(function () {
          formCard.classList.remove('is-sending');
          showMsg('err', 'Network hiccup. Please call or text me at (513) 279-2915 and I\'ll get you booked.');
        });
    });
  }
})();

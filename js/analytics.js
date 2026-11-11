/**
 * Google Analytics 4 and Microsoft Clarity, behind a consent banner.
 *
 * NOTHING LOADS UNTIL SOMEONE PRESSES ACCEPT. The privacy policy promised
 * exactly that before any analytics existed, and the banner is how the
 * promise is kept. Decline, or ignore the banner, and neither script is ever
 * requested. The choice is remembered in localStorage so the banner does not
 * come back on every page, and the "Analytics choices" link in the footer
 * reopens it.
 *
 * NO IDS, NO BANNER. Both ids come from js/config.js. While they are empty
 * there is nothing to consent to, so nothing shows and AC_TRACK is a no-op.
 *
 * NOT FOR ADVERTISING. The banner says so, and the settings below are what
 * make it true: ad storage, ad user data and ad personalization are denied
 * in Google's consent mode, Google Signals is off, and Clarity is told ads
 * storage is denied too. Linking Google Ads later means changing the banner
 * and the policy first.
 *
 * THE ARRIVAL SOURCE IS SEPARATE FROM CONSENT. Which link brought someone
 * here (a magazine QR code's utm_source, say) is kept in sessionStorage for
 * this tab only and sent with a booking, so a magazine's bookings can be
 * counted even when the visitor declined analytics. It identifies nobody,
 * goes to no third party, and the privacy policy says it happens.
 */
(function () {
  var c = window.AC_CONFIG || {};
  var GA = c.ga4MeasurementId || '';
  var CL = c.clarityProjectId || '';
  var CHOICE_KEY = 'ac-analytics';
  var SOURCE_KEY = 'ac-source';
  var loaded = false;

  /* ---------- Where this visit came from ---------- */

  function readSource() {
    var p = new URLSearchParams(location.search);
    var s = p.get('utm_source');
    if (!s) return null;
    return [s, p.get('utm_medium'), p.get('utm_campaign')]
      .filter(Boolean).join(' / ').replace(/[^\w ./-]/g, '').slice(0, 120);
  }
  try {
    var arrived = readSource();
    // First touch wins within a tab: a magazine visitor who then clicks
    // around should still count for the magazine.
    if (arrived && !sessionStorage.getItem(SOURCE_KEY)) sessionStorage.setItem(SOURCE_KEY, arrived);
  } catch (e) { /* storage blocked: the booking just goes without a source */ }

  /** "golf / print / qr", or "" when the visit did not arrive through a tagged link. */
  window.AC_SOURCE = function () {
    try { return sessionStorage.getItem(SOURCE_KEY) || ''; } catch (e) { return ''; }
  };

  /* ---------- A/B tests (config/experiments.json, docs/AB-TESTING.md) ---------- */

  /*
   * A visitor in a running test is given one version at random on first view
   * and keeps it (localStorage), so they see the same page every visit. That
   * choice identifies nobody, goes to no third party by itself, and the
   * privacy policy says it happens. It is made before any consent choice,
   * because the page has to show something; analytics only hears about it
   * after Accept. Which version a booking saw also goes in the booking email,
   * so tests can be counted without analytics.
   */
  var EXP_KEY = 'ac-exp';
  var TESTS = window.AC_EXPERIMENTS || [];
  var given = {};    // id -> version, for tests this visitor is in, this page
  var pending = [];  // exposures waiting for analytics to load

  function storedTests() {
    try { return JSON.parse(localStorage.getItem(EXP_KEY) || '{}') || {}; } catch (e) { return {}; }
  }

  function draw(versions) {
    var total = 0, i;
    for (i = 0; i < versions.length; i++) total += versions[i][1];
    var r = Math.random() * total;
    for (i = 0; i < versions.length; i++) { r -= versions[i][1]; if (r < 0) return versions[i][0]; }
    return versions[versions.length - 1][0];
  }

  /** The version of a test this visitor sees: the control (first) when they are not in it. */
  window.AC_EXP = function (id) {
    var t = null, i;
    for (i = 0; i < TESTS.length; i++) if (TESTS[i].id === id) t = TESTS[i];
    if (!t) return '';
    var control = t.versions[0][0];
    if (t.status === 'ended') return t.winner;
    if (t.status !== 'running') return control;
    if (given[id]) return given[id];
    var all = storedTests();
    var v = all[id];
    var known = t.versions.some(function (x) { return x[0] === v; });
    if (!known) {
      // Only visitors who arrived the right way join. Once in, they stay in,
      // even on a later visit that came in some other way.
      var src = window.AC_SOURCE().split('/')[0].trim().toLowerCase();
      if (t.sources && t.sources.indexOf(src) < 0) return control;
      v = draw(t.versions);
      all[id] = v;
      try { localStorage.setItem(EXP_KEY, JSON.stringify(all)); } catch (e) { /* this page only */ }
    }
    given[id] = v;
    pending.push([id, v]);
    flushTests();
    return v;
  };

  /** "golf-code: code", for the booking email. Empty when in no test. */
  window.AC_EXPS = function () {
    return Object.keys(given).map(function (id) { return id + ': ' + given[id]; }).join(', ');
  };

  function variantString() {
    return Object.keys(given).map(function (id) { return 'ac-' + id + '-' + given[id]; }).join(',').slice(0, 100);
  }

  /* GA4's own pattern for outside testing tools, and a Clarity tag to filter recordings. */
  function flushTests() {
    if (!loaded) return;
    while (pending.length) {
      var p = pending.shift();
      try {
        if (window.gtag) window.gtag('event', 'experience_impression', { exp_variant_string: 'ac-' + p[0] + '-' + p[1] });
        if (window.clarity) window.clarity('set', 'exp_' + p[0], p[1]);
      } catch (e) { /* measurement must never break the page */ }
    }
  }

  /* Elements for one version only: data-exp="golf-code:code". Hidden by CSS until chosen. */
  function showTestElements() {
    document.querySelectorAll('[data-exp]').forEach(function (el) {
      var parts = el.getAttribute('data-exp').split(':');
      if (window.AC_EXP(parts[0]) === parts[1]) el.classList.add('exp-on');
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', showTestElements);
  else showTestElements();

  /** Record an event. Does nothing unless analytics is loaded. */
  window.AC_TRACK = function (name, params) {
    if (!loaded) return;
    try {
      var p = params || {};
      var tests = variantString();
      if (tests && !p.exp_variant_string) p.exp_variant_string = tests;
      if (window.gtag) window.gtag('event', name, p);
      if (window.clarity) window.clarity('event', name);
    } catch (e) { /* measurement must never break the page */ }
  };

  if (!GA && !CL) return;

  /* ---------- Loading, only after Accept ---------- */

  function script(src) {
    var s = document.createElement('script');
    s.async = true;
    s.src = src;
    document.head.appendChild(s);
  }

  function load() {
    if (loaded) return;
    loaded = true;
    if (GA) {
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag('consent', 'default', {
        analytics_storage: 'granted',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied'
      });
      window.gtag('js', new Date());
      window.gtag('config', GA, {
        allow_google_signals: false,
        allow_ad_personalization_signals: false
      });
      script('https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA));
    }
    if (CL) {
      window.clarity = window.clarity || function () { (window.clarity.q = window.clarity.q || []).push(arguments); };
      window.clarity('consentv2', { ad_Storage: 'denied', analytics_Storage: 'granted' });
      script('https://www.clarity.ms/tag/' + encodeURIComponent(CL));
    }
    flushTests();
  }

  function getChoice() {
    try { return localStorage.getItem(CHOICE_KEY); } catch (e) { return null; }
  }

  function setChoice(v) {
    try { localStorage.setItem(CHOICE_KEY, v); } catch (e) { /* asked again next visit */ }
  }

  /* ---------- The banner ---------- */

  var banner = null;

  function hideBanner() {
    if (banner) banner.hidden = true;
  }

  function showBanner() {
    if (!banner) {
      banner = document.createElement('div');
      banner.className = 'consent';
      banner.setAttribute('role', 'region');
      banner.setAttribute('aria-label', 'Analytics choices');
      banner.innerHTML =
        '<p>We use cookies and analytics (Google Analytics and Microsoft Clarity) only to see how ' +
        'the 513 Auto Clean website is working, like which pages help and where booking gets ' +
        'confusing. They are never used for advertising. <a href="privacy.html#cookies">Privacy policy</a></p>' +
        '<div class="consent-btns">' +
        '<button type="button" class="btn btn-ghost" data-consent="denied">Decline</button>' +
        '<button type="button" class="btn btn-primary" data-consent="granted">Accept</button>' +
        '</div>';
      banner.addEventListener('click', function (e) {
        var b = e.target.closest('[data-consent]');
        if (!b) return;
        var v = b.getAttribute('data-consent');
        var was = getChoice();
        setChoice(v);
        hideBanner();
        if (v === 'granted') load();
        // Scripts already running cannot be unloaded. A reload is the honest
        // way to stop them after someone changes their mind.
        else if (was === 'granted' && loaded) location.reload();
      });
      document.body.appendChild(banner);
    }
    banner.hidden = false;
  }

  function start() {
    // The footer link and its leading separator are one hidden <span>, so
    // without analytics ids the footer shows no stray "· ·".
    document.querySelectorAll('[data-analytics-choices]').forEach(function (b) {
      b.hidden = false;
      b.addEventListener('click', showBanner);
    });

    // Calls, texts and emails happen off the site, so they are counted on the way out.
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href^="tel:"], a[href^="sms:"], a[href^="mailto:"]');
      if (a) window.AC_TRACK('contact_click', { method: a.getAttribute('href').split(':')[0] });
    });

    var choice = getChoice();
    if (choice === 'granted') load();
    else if (choice !== 'denied') showBanner();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();

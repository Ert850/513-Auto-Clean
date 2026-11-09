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

  /** Record an event. Does nothing unless analytics is loaded. */
  window.AC_TRACK = function (name, params) {
    if (!loaded) return;
    try {
      if (window.gtag) window.gtag('event', name, params || {});
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

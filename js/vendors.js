/**
 * Third party SDKs, loaded only once their key exists.
 *
 * An unconfigured site makes no third party requests beyond fonts, map tiles
 * and the map library, so the privacy policy stays true and the cookie story
 * stays simple.
 *
 * STRIPE AND PAYPAL ARE NOT LOADED FROM HERE. They used to be, the moment a
 * key existed, on every visit to the home page. Stripe.js is several hundred
 * kilobytes plus the iframes it opens, and a phone on a mobile connection
 * downloaded all of it in competition with the hero image for a payment
 * form nobody had asked for yet. js/funnel.js loads each on demand, from the
 * screen that needs it, and only when the matching capability is on.
 */
(function () {
  var c = window.AC_CONFIG || {};
  function load(src) {
    var s = document.createElement('script');
    s.src = src;
    s.async = true;
    document.head.appendChild(s);
  }
  if (c.turnstileSiteKey) load('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit');
})();

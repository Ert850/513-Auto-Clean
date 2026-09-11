/**
 * Third party SDKs, loaded only once their key exists.
 *
 * An unconfigured site makes no third party requests beyond fonts, map tiles
 * and the map library, so the privacy policy stays true and the cookie story
 * stays simple. Stripe and PayPal both set cookies the moment they load.
 */
(function () {
  var c = window.AC_CONFIG || {};
  function load(src) {
    var s = document.createElement('script');
    s.src = src;
    s.async = true;
    document.head.appendChild(s);
  }
  if (c.stripePublishableKey) load('https://js.stripe.com/v3/');
  if (c.paypalClientId) {
    load('https://www.paypal.com/sdk/js?client-id=' + encodeURIComponent(c.paypalClientId) +
      '&currency=USD&components=buttons&enable-funding=venmo,paylater');
  }
  if (c.turnstileSiteKey) load('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit');
})();

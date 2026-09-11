/**
 * Public configuration for the booking funnel.
 *
 * Every value here is DESIGNED to be public: a browser API key restricted by
 * HTTP referrer, a Stripe publishable key, a PayPal client id, a Turnstile
 * site key. A secret key must never appear in this file or anywhere else a
 * browser can read. Leave a value empty and the feature it powers degrades
 * honestly: standard time slots, a static review snapshot, no payment SDK.
 */
window.AC_CONFIG = {
    googleCalendarId: '75726fed82aa92a27201386beda7b3a15f550a3a5691e5e6cfc51382f0f0b9cf@group.calendar.google.com',
    googleApiKey: '',
    stripePublishableKey: '',
    paypalClientId: '',
    // Cloudflare Turnstile site key. Empty means no bot check, which is
    // fine until the first bot.
    turnstileSiteKey: ''
};

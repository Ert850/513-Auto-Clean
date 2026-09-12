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

    /*
     * TWO Google keys, not one, because they cost different amounts.
     *
     * The Calendar API is a Workspace API. It needs a Google Cloud project
     * and nothing else: no billing account, no card, no free trial that
     * expires. This is the key that turns the scheduler from standard hours
     * into your real openings, and it is free forever at this volume.
     *
     * Places is Maps Platform, which requires a billing account with a card
     * on file even though the free monthly allowance is far more than this
     * site will ever use. Leave it empty and people type their address,
     * which is what they do today and works.
     *
     * They used to be one value, so switching on the free thing meant
     * attaching a card for the billed one.
     */
    googleCalendarApiKey: '',
    googlePlacesApiKey: '',

    // Old single-key name. Still read as a fallback for both, so an existing
    // key keeps working, but prefer the two above.
    googleApiKey: '',
    // Stripe publishable key. Designed to be public; the SECRET key
    // (sk_...) must never appear here or anywhere a browser can read.
    //
    //   ''            no card field at all
    //   'pk_test_...' card field works, test cards only, nothing is charged,
    //                 and the page says so in a banner
    //   'pk_live_...' real cards, and the pay-now option appears once
    //                 cardOnFile is also switched on in capabilities.ts
    stripePublishableKey: 'pk_live_51TEDiSC1NhJh7XkAOAiwQJqgky8ClFzwhjvpVbR8O7xmQyzI2LJHH9oojIWaZl7L4IOuTWtyhi7QDXZIsJ5eBrSg00sykxIEJA',
    paypalClientId: '',
    // Cloudflare Turnstile site key. Empty means no bot check, which is
    // fine until the first bot.
    turnstileSiteKey: ''
};

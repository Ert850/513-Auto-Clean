/**
 * Public configuration for the booking funnel. THIS IS A TEMPLATE.
 *
 * The build writes js/config.js from this file, filling every {{NAME}} from
 * the matching environment variable. js/config.js is generated and gitignored,
 * so no key is ever committed, which is what the whole arrangement is for:
 * one place to manage keys, per deploy context, and nothing to leak.
 *
 *   npm run build        writes js/config.js
 *   an unset variable    becomes an empty string
 *
 * Every value here is DESIGNED to be public: a browser API key restricted by
 * HTTP referrer, a Stripe publishable key, a PayPal client id, a Turnstile
 * site key. A secret key must never appear here or anywhere a browser can
 * read. Leave one empty and the feature it powers degrades honestly:
 * standard time slots, a stored review snapshot, no payment SDK.
 */
window.AC_CONFIG = {
    // Not a key. Safe in the repo, and overridable per deploy anyway.
    googleCalendarId: '{{GOOGLE_CALENDAR_ID}}',

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
     */
    googleCalendarApiKey: '{{GOOGLE_CALENDAR_API_KEY}}',
    googlePlacesApiKey: '{{GOOGLE_PLACES_API_KEY}}',

    // Old single-key name, still read as a fallback for both.
    googleApiKey: '{{GOOGLE_API_KEY}}',

    /*
     * Stripe publishable key. The SECRET key (sk_...) must never appear here.
     *
     *   ''            no card field at all, and the confirm screen says so
     *   'pk_test_...' card field works, test cards only, nothing is charged,
     *                 and the page says as much in a banner
     *   'pk_live_...' real cards, and the pay-now option appears once
     *                 cardOnFile is also switched on in capabilities.ts
     *
     * Because this now comes from the environment, Deploy Previews can carry
     * a pk_test_ key while production carries pk_live_. They must match the
     * mode of STRIPE_SECRET_KEY in the same context: a live publishable key
     * with a test secret is refused by Stripe, not half-working.
     */
    stripePublishableKey: '{{STRIPE_PUBLISHABLE_KEY}}',

    // Public half of the PayPal credentials. The same variable the
    // paypal-order function reads for its own client id.
    paypalClientId: '{{PAYPAL_CLIENT_ID}}',

    // Cloudflare Turnstile site key. Empty means no bot check, which is
    // fine until the first bot.
    turnstileSiteKey: '{{TURNSTILE_SITE_KEY}}'
};

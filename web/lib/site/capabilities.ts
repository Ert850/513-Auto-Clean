/**
 * What the site can actually do right now.
 *
 * ONE SWITCH PER FEATURE, and the customer-facing pages are generated from
 * it. This exists because the terms drifted ahead of the build once already:
 * they described a self-service booking link that had not been written, which
 * is a bad thing to put in a document someone is asked to agree to.
 *
 * HOW TO USE IT. When a feature goes live, flip `live` to true here and run
 * `npm run build`. The terms page rewrites itself to match. Nothing else to
 * remember, and `terms.test.ts` fails the build if the page and this file
 * ever disagree.
 *
 * The `promise` strings are the two halves of every sentence whose truth
 * depends on the feature. They sit here rather than in the HTML so that the
 * claim and the switch controlling it cannot end up in different files.
 */

export interface Capability {
  id: string;
  /** What it is, for whoever is reading this file in six months. */
  what: string;
  live: boolean;
  /** What unblocks it. Kept in step with docs/LAUNCH-CHECKLIST.md. */
  blockedBy?: string;
}

export const CAPABILITIES: Capability[] = [
  {
    id: "cardOnFile",
    what: "Taking a card at booking and charging it when the work is done",
    /*
     * OFF. There is no way to take a card at all right now.
     *
     * Stripe was the only thing that could hold one, and the pay path it
     * gave us did not complete reliably, so it is muted. A booking screen
     * that asks for a card it cannot store, against an authorization it
     * cannot act on, is worse than one that never mentions a card: it is a
     * promise made to a customer that the site cannot keep.
     *
     * A late cancellation is still charged. The cancellation policy has not
     * moved and neither has the amount. What changed is the collection: we
     * bill for it and settle it with the customer, rather than putting it
     * through a card we are holding. The same fee is carried onto the new
     * date when somebody reschedules, which is where most of it lands.
     *
     * Everything moves with this switch: the card field, the authorization
     * checkbox, Stripe named in the privacy policy's processor list, and the
     * sentences in the terms about taking a card.
     */
    live: false,
    blockedBy: "No way to store a card while Stripe is muted",
  },
  {
    /*
     * SEPARATE FROM cardOnFile ON PURPOSE.
     *
     * Taking a card to hold against a late cancellation and taking the whole
     * price up front are different promises, they fail differently, and one
     * of them was failing. On mobile the Payment Element sometimes never
     * mounted, and the funnel recorded the booking as PAID IN FULL anyway:
     * Elijah would have arrived at a job expecting nothing and the customer
     * would have expected to owe nothing. On desktop some payment methods in
     * the element did not complete.
     *
     * So prepay is off and the card on file stays. Nothing is charged before
     * the work is done; the whole price is paid on site afterwards.
     *
     * Turning this back on: the guard in submit() refuses to record a
     * pay-in-full booking with no confirmed payment, so the failure mode that
     * caused this cannot silently return. Test the mobile mount first.
     */
    id: "payInFull",
    what: "Paying the whole detail online at booking, for 5% off",
    live: false,
    blockedBy: "The Stripe pay-now path does not complete reliably on mobile",
  },
  {
    id: "digitalWallets",
    what: "Apple Pay, Google Pay, PayPal and Venmo at checkout",
    live: false,
    blockedBy: "Stripe and PayPal accounts",
  },
  {
    id: "liveCalendar",
    what: "Reading real availability, so a chosen time is genuinely open",
    // Live with the key in js/config.js. Moves WITH it: the browser now
    // fetches the availability calendar directly, so Google Calendar has to
    // appear in the privacy policy's list of who sees what, and the funnel
    // stops calling its own time slots standard guesses.
    live: true,
    blockedBy: "Google Calendar API key and a public availability calendar",
  },
  {
    id: "measuredTravel",
    what: "Measuring the real drive at the appointment time, traffic included",
    // Live and verified against production: /api/travel answered
    // source "routes", 10 minutes, 5 miles. The customer's address now
    // leaves our server for Google's, which is precisely the kind of thing
    // the privacy policy exists to state, so this moves with the key.
    live: true,
    blockedBy: "Google Routes API key and SHOP_ORIGIN_ADDRESS",
  },
  {
    // Split from a single "automatedMessages" switch, because the two halves
    // are not remotely the same job. Resend is a signup and one DNS record.
    // A2P 10DLC registration is days to weeks of carrier review, and until it
    // clears, business texts are SILENTLY FILTERED: they look sent and never
    // arrive. Tying email to that would hold back a working feature for
    // weeks for no reason.
    id: "automatedEmail",
    what: "Automatic confirmation and reminder emails",
    /*
     * Live, and verified: POST /api/send-confirmation returned
     * {sent:true, owner:true} from production, and the domain is verified so
     * bookings@513autoclean.com is the sender. Resend now handles customer
     * data, so the privacy policy has to name it, and the terms stop saying
     * a booking is confirmed by hand.
     */
    live: true,
    blockedBy: "Resend account and one DNS record",
  },
  {
    id: "automatedTexts",
    what: "Automatic confirmation, reminder and on-the-way texts",
    live: false,
    blockedBy: "Twilio A2P 10DLC registration, which takes days to weeks",
  },
  {
    id: "bookingLink",
    what: "A customer link for moving a time or changing services without calling",
    live: false,
    blockedBy: "Neon Postgres, so there is a stored booking to point at",
  },
  {
    id: "placesAutocomplete",
    what: "Address suggestions as the customer types, from Google Places",
    // Live with googlePlacesApiKey. What the customer types into the address
    // box now goes to Google as they type it, which is exactly the sort of
    // thing a privacy policy exists to say out loud.
    live: true,
    blockedBy: "Google browser key in js/config.js",
  },
  {
    id: "botCheck",
    what: "Cloudflare Turnstile in front of the payment step",
    live: false,
    blockedBy: "TURNSTILE_SECRET_KEY in Netlify and turnstileSiteKey in js/config.js",
  },
];

/**
 * Everyone who touches a customer's data, and the switch that decides
 * whether they do yet.
 *
 * The privacy policy's "who we share it with" list is generated from this,
 * so a processor appears on the page the day its switch flips and not a day
 * before. The policy used to describe a static quote form with two third
 * parties while the site had grown six more; nobody had thought to go back
 * and edit prose.
 */
export interface Processor {
  name: string;
  /** What they do with the data, in the customer's terms. Starts lower case. */
  does: string;
  /** Absent means always on. */
  capability?: string;
}

export const PROCESSORS: Processor[] = [
  { name: "Netlify", does: "hosts the website and runs the code behind the booking form. Keeps standard server logs, including IP addresses." },
  { name: "Web3Forms", does: "delivers your question or booking request to our email inbox." },
  { name: "Google (Gmail and Fonts)", does: "is where our email lives, so anything you send us is stored there, and serves the typefaces on this site, which means Google receives your IP address when a page loads." },
  { name: "OpenStreetMap", does: "provides the service area map tiles and looks up places you type into the map search. Your IP address and that search text go to OpenStreetMap." },
  { name: "cdnjs (Cloudflare)", does: "serves the map library, so Cloudflare receives your IP address when the map loads." },
  { name: "Google Places", does: "suggests addresses as you type in the booking form. What you type in that box goes to Google.", capability: "placesAutocomplete" },
  { name: "Google Maps (Routes)", does: "measures the drive to your address so we can price travel. This happens from our server, with your address, not from your browser.", capability: "measuredTravel" },
  { name: "Google Calendar", does: "holds our availability. Your browser reads our open times from it.", capability: "liveCalendar" },
  { name: "Stripe", does: "takes card payments and keeps your card on file. Card details go straight to Stripe over an encrypted connection; we never see or store the card number.", capability: "cardOnFile" },
  { name: "PayPal", does: "takes PayPal and Venmo payments.", capability: "digitalWallets" },
  { name: "Twilio", does: "sends our appointment text messages.", capability: "automatedTexts" },
  { name: "Resend", does: "sends our confirmation and reminder emails.", capability: "automatedEmail" },
  { name: "Neon", does: "stores bookings in our database so your booking link works.", capability: "bookingLink" },
  { name: "Cloudflare Turnstile", does: "checks that a booking is being made by a person, before payment. It may set a cookie to do so.", capability: "botCheck" },
];

export function liveProcessors(): Processor[] {
  return PROCESSORS.filter((p) => !p.capability || isLive(p.capability));
}

export function dormantProcessors(): Processor[] {
  return PROCESSORS.filter((p) => p.capability && !isLive(p.capability));
}

export function isLive(id: string): boolean {
  return CAPABILITIES.find((c) => c.id === id)?.live ?? false;
}

export function pending(): Capability[] {
  return CAPABILITIES.filter((c) => !c.live);
}

/**
 * Sentences whose truth depends on a capability.
 *
 * Written as a pair so the "not yet" version is a deliberate piece of copy
 * rather than an absence. A page that simply omits a sentence when a feature
 * is off tends to read as though something is missing; a page that says what
 * happens instead reads as though someone thought about it.
 */
export interface GatedCopy {
  id: string;
  capability: string;
  live: string;
  notYet: string;
}

/**
 * What we can take standing in a driveway.
 *
 * One list, read by the terms and by the booking funnel, because a customer
 * told two different things about how they may pay is the kind of small
 * contradiction that makes someone wonder what else is wrong.
 */
export const IN_PERSON = "cash, check, card, tap to pay, Venmo, Apple Pay, Cash App or Zelle";

export const GATED_COPY: GatedCopy[] = [
  {
    id: "howToChange",
    capability: "bookingLink",
    live:
      "Easiest way is your <strong>booking link</strong>, which is in the confirmation we sent when you booked. " +
      "Open it and you can move the time, change what is included, or cancel, and it shows you what each one " +
      "costs before you commit. Otherwise call or text " +
      '<a href="tel:+15132792915">(513) 279-2915</a>.',
    notYet:
      'Call or text <a href="tel:+15132792915">(513) 279-2915</a>, or reply to the confirmation we sent you. ' +
      "A text is fine and you do not need a reason.",
  },
  {
    id: "changeSelfService",
    capability: "bookingLink",
    live: "Your booking link works this out and shows you the number before you confirm anything.",
    notYet: "Ask us and we will work out the number for you before you agree to anything.",
  },
  /*
   * The five sentences in the terms that describe taking a card.
   *
   * They were hand written, ungated, and true only while a card was actually
   * being taken. Muting payment made every one of them a false statement in a
   * document a customer agrees to, which is a worse problem than the feature
   * being off. Now they move with the switch, like everything else.
   */
  {
    id: "whoCanBook",
    capability: "cardOnFile",
    live:
      "By booking, you confirm that you are at least 18, that you are the owner of the vehicle or " +
      "have the owner's permission to have it detailed, and that the card you give us is yours to use.",
    notYet:
      "By booking, you confirm that you are at least 18, and that you are the owner of the vehicle " +
      "or have the owner's permission to have it detailed.",
  },
  {
    id: "cardAtBooking",
    capability: "cardOnFile",
    // No mention of paying in full: that is the payInFull switch's sentence,
    // in section 4, and it is off. This one is only about the card.
    live:
      "We ask for a card when you book. <strong>Nothing is charged then.</strong> It is there so " +
      "that a last-minute cancellation is not free for the person making it. See " +
      '<a href="#cancellation">cancellation</a>.',
    notYet:
      "Nothing is charged when you book. You pay in full once the detail is finished. See " +
      '<a href="#cancellation">cancellation</a> for what happens if you cancel late.',
  },
  {
    /*
     * The two paragraphs about paying up front. They were hand-written into
     * terms.html and so they kept saying a discount was available for
     * something the site had stopped offering. Anything whose truth depends
     * on a switch belongs here, where the switch is.
     */
    id: "prepay",
    capability: "payInFull",
    live:
      "<p>You can pay in full up front instead, which gets you a discount. That is always your " +
      "choice and we will never ask for it.</p>\n" +
      "    <p>If your booking is a request rather than a confirmed time, we do not offer pay in " +
      "full at all. We are not going to sit on your money for a time nobody has agreed to yet.</p>",
    notYet:
      "<p>There is no way to pay up front at the moment, for a confirmed booking or a request. " +
      "Whatever you book, the money changes hands once the work is done.</p>",
  },
  {
    id: "authorization",
    capability: "cardOnFile",
    live:
      "<p>When you book you give us a card and tick a box. That box authorizes <strong>one</strong> " +
      "thing: if you cancel or move the booking late, we may charge the fee in section 5 to that " +
      "card. <strong>It is not permission to charge you for the detail itself.</strong> We record " +
      "the wording you agreed to and the version of these terms alongside your booking.</p>\n" +
      `    <p>The detail itself you pay for however you prefer: on the day by ${IN_PERSON}, or by ` +
      "asking us to put it on the card we already hold.</p>",
    notYet:
      "<p>We do not take card details when you book, and nothing is charged before the work is " +
      "done. We record the version of these terms you agreed to alongside your booking.</p>",
  },
  {
    id: "whyACard",
    capability: "cardOnFile",
    live:
      "It is also why we take card details when you book. We are not charging you up front. We " +
      "just need a late change to cost the person making it something, rather than costing " +
      "everyone else the slot.",
    // Deliberately NOT a shortened copy of the live sentence. The guard in
    // terms.test.ts checks the page does not still carry the other half, and
    // it cannot tell them apart if one is a substring of the other.
    notYet:
      "Nothing is taken up front. We just need a late change to cost the person making it " +
      "something, rather than costing everyone else the slot.",
  },
  {
    id: "refunds",
    capability: "cardOnFile",
    live:
      "Refunds go back to the card you paid with, the same day. Your bank usually takes 5 to 10 " +
      "working days to show it. We do not keep a processing fee out of it.",
    notYet:
      "There is nothing to refund, because nothing is taken before the work is done. If you have " +
      "paid us and something needs putting right, we sort it out the same day by whichever method " +
      "you paid.",
  },
  {
    id: "paymentMethods",
    /*
     * Gated on PREPAY, not on the card on file.
     *
     * The card and the payment are different sentences. Whether a card is
     * held is section 6's business; this sentence is only about when money
     * moves, and while prepay is off the answer is always "after the work".
     * That reads correctly whether or not a card is being taken.
     */
    capability: "payInFull",
    live:
      `On the day you can pay by ${IN_PERSON}. You can also pay in full online when you book, ` +
      "or ask us to put it on the card we already have on file.",
    notYet:
      `On the day you can pay by ${IN_PERSON}. Nothing is charged when you book. Ask us for ` +
      "anything not on that list and we will almost certainly be able to take it.",
  },
  {
    id: "travelBasis",
    capability: "measuredTravel",
    live:
      "After that we charge for the real drive out to you, measured at the time you picked with the " +
      "traffic of that hour, rather than a flat call-out fee.",
    notYet:
      "After that we charge for the drive out to you rather than a flat call-out fee, worked out from " +
      "your address and the time you picked.",
  },
  {
    id: "confirmation",
    capability: "automatedEmail",
    live:
      "When you book online you pick the time that suits you and an email confirming it arrives straight away.",
    notYet:
      "When you book online you pick the time that suits you. We confirm it by hand, usually within a few " +
      "hours, by text or email, so a booking is not final until you hear from us.",
  },
  {
    id: "messages",
    capability: "automatedTexts",
    live:
      "We ask when you book whether we can text you about your detail. If you say yes we will confirm the " +
      "booking, remind you beforehand and let you know when we are on the way.",
    notYet:
      "We ask when you book whether we can text you about your detail. If you say yes, those texts are sent " +
      "by hand: to confirm, to check anything we need to know, and with an ETA before we set off. There is " +
      "no automated messaging behind it yet, so you are texting a person.",
  },
];

export function copyFor(id: string): string {
  const row = GATED_COPY.find((c) => c.id === id);
  if (!row) throw new Error(`No gated copy for "${id}"`);
  return isLive(row.capability) ? row.live : row.notYet;
}

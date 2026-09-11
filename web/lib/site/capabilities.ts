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
    live: false,
    blockedBy: "Stripe keys",
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
    live: false,
    blockedBy: "Google Calendar API key and a public availability calendar",
  },
  {
    id: "measuredTravel",
    what: "Measuring the real drive at the appointment time, traffic included",
    live: false,
    blockedBy: "Google Routes API key and SHOP_ORIGIN_ADDRESS",
  },
  {
    id: "automatedMessages",
    what: "Automatic confirmations, reminders and an on-the-way text",
    live: false,
    blockedBy: "Twilio A2P 10DLC registration and Resend",
  },
  {
    id: "bookingLink",
    what: "A customer link for moving a time or changing services without calling",
    live: false,
    blockedBy: "Neon Postgres, so there is a stored booking to point at",
  },
];

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
  {
    id: "paymentMethods",
    capability: "digitalWallets",
    live: "We take cards, Apple Pay, Google Pay, PayPal, Venmo and cash.",
    notYet: "If you would rather settle another way, ask us and we will sort it out.",
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
    capability: "automatedMessages",
    live:
      "When you book online you pick the time that suits you and we confirm it straight away by text and email.",
    notYet:
      "When you book online you pick the time that suits you and we confirm it, usually within a few hours, " +
      "by text or email.",
  },
  {
    id: "messages",
    capability: "automatedMessages",
    live:
      "We ask when you book whether we can text you about your detail. If you say yes we will confirm the " +
      "booking, remind you beforehand and let you know when we are on the way.",
    notYet:
      "We ask when you book whether we can text you about your detail. If you say yes we will use it to " +
      "confirm the booking, remind you beforehand and let you know when we are on the way.",
  },
];

export function copyFor(id: string): string {
  const row = GATED_COPY.find((c) => c.id === id);
  if (!row) throw new Error(`No gated copy for "${id}"`);
  return isLive(row.capability) ? row.live : row.notYet;
}

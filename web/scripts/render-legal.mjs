/**
 * Generates the parts of terms.html and privacy.html that can go out of date.
 *
 * Every number in the cancellation policy lives in lib/pricing/rules.ts.
 * Every sentence whose truth depends on a feature lives in
 * lib/site/capabilities.ts, and so does the list of everyone who touches a
 * customer's data. This splices them into both pages between marker
 * comments, the same way the services grid works.
 *
 * WHY: the terms drifted ahead of the build once, describing a self-service
 * booking link that did not exist. The privacy policy drifted the other way,
 * still describing a static quote form after the site had grown a booking
 * flow, a map and a payment step. "Remember to update the legal pages" is
 * not a mechanism. This is.
 *
 * Change a rule or flip a capability, run `npm run build`, and both pages
 * rewrite themselves. terms.test.ts and privacy.test.ts fail if a page and
 * the switches ever disagree, and legal.test.ts fails if the wording moved
 * without its version date moving with it.
 *
 * Run by `npm run build`.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CAPABILITIES,
  DEFAULT_RULES,
  DRAFT_KEEP_DAYS,
  LEGAL,
  cancellationLadder,
  copyFor,
  isLive,
  liveProcessors,
  longDate,
} from "../../netlify/functions/_pricing.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const TERMS = path.join(root, "terms.html");
const PRIVACY = path.join(root, "privacy.html");

const R = DEFAULT_RULES;
const esc = (s) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const pct = (bp) => `${bp / 100}%`;

/* ======================================================================
   TERMS
   ====================================================================== */

function ladderTable() {
  const rows = cancellationLadder(R)
    .map(
      (row) => `        <tr>
          <td>${esc(row.when)}</td>
          <td>${esc(row.cancel)}</td>
          <td><strong>${esc(row.reschedule)}</strong></td>
        </tr>`,
    )
    .join("\n");

  return `<table class="policy">
      <thead>
        <tr><th>Notice given</th><th>If you cancel</th><th>If you reschedule</th></tr>
      </thead>
      <tbody>
${rows}
      </tbody>
    </table>`;
}

function changeRules() {
  const rate = pct(R.shortNoticeChangeBp);
  const window = R.refundFullWindowHours;

  return `<p>Just tell us what you want changed. Adding or dropping services is free any time up to <strong>${window} hours</strong> before your slot. Inside ${window} hours it depends on whether the change needs time that was not already yours.</p>
    <ul>
      <li><strong>Keep your slot and add to it.</strong> Say you booked 10am to 2pm and now want the outside done too, so it runs 8am to 2pm. The four hours you had were always yours. Only the new 8am to 10am was time somebody else could have taken, so the ${rate} short notice rate applies to <strong>the added work only</strong>, not to your whole booking.</li>
      <li><strong>Move onto different time.</strong> Say that same 10am to 2pm becomes 8am to 12pm. You have handed back 12pm to 2pm, which we cannot fill at this notice, and taken 8am to 10am, which we could have sold. That is a new booking rather than a bigger one, so the ${rate} applies to <strong>the whole thing</strong>.</li>
      <li><strong>Drop services or finish earlier.</strong> Always free. Handing time back helps us.</li>
    </ul>
    <p>The short version: keep every minute you already have and you only ever pay the rate on what you add. ${copyFor("changeSelfService")}</p>`;
}

function lateMove() {
  const fee = pct(R.lateRescheduleFeeBp);
  const twice = pct(R.lateRescheduleFeeBp * 2);
  return `<p>You can still do it, and your money still follows you. There is one extra charge: <strong>a flat ${fee} late move fee, charged each time you move a booking at that notice.</strong> It stays ${fee} every time. Moving twice means two separate ${fee} charges, not ${fee} and then ${twice}.</p>`;
}

function credit() {
  const days = R.rescheduleCreditDays;
  return `<p>Credit from a reschedule is good for <strong>${days} days</strong> from the appointment you moved, and comes straight off the price of the new booking. If the new detail costs more, you pay the difference. If it costs less, we hold the rest for you for the remainder of the ${days} days.</p>`;
}

/* ======================================================================
   PRIVACY
   ====================================================================== */

function collectList() {
  const items = [
    "Your name and phone number",
    "Your email address, if you give it",
    "Your vehicle, its size, and anything you tell us about its condition",
    "The address where the work will be done",
    "The services you picked, the time you picked, and any notes",
    "Your answers to the three questions we ask when you book: whether you accept the terms, whether we may text you, and whether we may film the detail",
    "Where you heard about us, if you choose to tell us",
    "Anything you tell us right after booking, if you choose to: whether there is an outdoor tap or outlet, where to park, the vehicle, and notes for the detailer",
  ];
  if (isLive("checkoutFollowUp")) {
    items.push(
      "If you reach checkout and leave without booking: the name, phone number and email you typed there, the city and ZIP, the services and time you had picked, and how you found us",
    );
  }
  if (isLive("cardOnFile")) {
    items.push(
      "Your card details, which go straight to Stripe over an encrypted connection. We never see or store the card number. Stripe gives us a token that lets us charge the card only as the terms describe, and a record of the authorization you gave when you booked.",
    );
  }
  return `<ul>
${items.map((i) => `      <li>${i}</li>`).join("\n")}
    </ul>
    <p>To send us a question, only your name and phone number are required. A booking needs the address as well, because that is where we turn up and what travel is priced from.</p>`;
}

function automaticPara() {
  const parts = [
    // "No analytics software" stops being true the moment Real User
    // Monitoring is switched on, so the sentence is written twice and the
    // switch picks. What is measured is the page, not the person.
    isLive("siteAnalytics")
      ? "Our website runs no advertising pixels. If you accept analytics in the banner, Google Analytics and Microsoft Clarity load and show us how the site is used: which pages are visited, how people found us, where they click, and where they leave. We use that only to see how the website is working, never for advertising, and neither loads unless you accept. Our host, Netlify, does measure how fast our own pages load too: a small script times the page as it appears and sends those timings back to Netlify, where they are pooled with everyone else's. It sets no cookie and carries nothing that identifies you. Like nearly all websites, our web host also records standard server logs, including IP addresses and browser type, for security and reliability. The typefaces load from Google Fonts, which means Google receives your IP address when a page loads."
      : isLive("performanceMonitoring")
      ? "Our website runs no advertising pixels and no session-tracking tools, and nothing on it follows you to other websites. Our host, Netlify, does measure how fast our own pages load: a small script times the page as it appears and sends those timings back to Netlify, where they are pooled with everyone else's. It sets no cookie and carries nothing that identifies you, and we use it to find the pages that are slow. Like nearly all websites, our web host also records standard server logs, including IP addresses and browser type, for security and reliability. The typefaces load from Google Fonts, which means Google receives your IP address when a page loads."
      : "Our website runs no analytics software, advertising pixels, or session-tracking tools. Like nearly all websites, our web host records standard server logs, including IP addresses and browser type, for security and reliability. The typefaces load from Google Fonts, which means Google receives your IP address when a page loads.",
    "The service area map is drawn with OpenStreetMap tiles and a map library served by cdnjs, so both receive your IP address when the map loads. If you type a place into the map search, that text goes to OpenStreetMap to find it on the map.",
  ];
  if (isLive("placesAutocomplete")) {
    parts.push("Address suggestions in the booking form come from Google Places, so what you type into that box goes to Google as you type.");
  }
  if (isLive("liveCalendar")) {
    parts.push("Our open times come from Google Calendar, which your browser reads directly, so Google sees that request.");
  }
  if (isLive("botCheck")) {
    parts.push("Before payment, Cloudflare Turnstile checks that a person is booking. It may set a cookie to do that.");
  }
  if (isLive("weatherCheck")) {
    parts.push("Some of our work depends on the weather, so before offering times and offers for it, your browser asks the National Weather Service, a United States government service, for the forecast at the approximate location of the detail. That location comes from your address or ZIP code and is rounded to within about a kilometre. It does not include your name, contact details or street address, but like any website the service receives your IP address.");
  }
  return parts.map((p) => `<p>${p}</p>`).join("\n    ");
}

function useList() {
  const items = [
    "Answer your question and give you a price",
    "Schedule your detail and confirm the time and place",
    "Contact you about your appointment, including if we are running late or need to move it",
  ];
  items.push(
    isLive("cardOnFile")
      ? "Take payment, and keep a card on file so we can settle up when the work is done and apply the cancellation terms you agreed to"
      : "Settle up when the work is done",
  );
  if (isLive("checkoutFollowUp")) {
    items.push("Follow up once about a booking you started and did not finish, if you gave us your contact details at checkout");
  }
  items.push("Follow up after service to make sure you are happy with the work");
  items.push("Keep the business and tax records the law requires");
  return `<ul>
${items.map((i) => `      <li>${i}</li>`).join("\n")}
    </ul>`;
}

function shareList() {
  const rows = liveProcessors()
    .map((p) => `      <li><strong>${esc(p.name)}</strong>, ${esc(p.does)}</li>`)
    .join("\n");
  return `<ul>
${rows}
    </ul>`;
}

function cookiesParas() {
  const parts = [
    isLive("siteAnalytics")
      ? "This website runs no advertising trackers. The first time you visit, a banner asks whether you accept analytics. Press Accept and Google Analytics and Microsoft Clarity load and set their own cookies, as described in section 2. Press Decline, or ignore the banner, and neither loads and no analytics cookie is set. We remember your choice in your browser so we do not ask on every page, and you can change it at any time from the Analytics choices link at the bottom of the home page."
      : isLive("performanceMonitoring")
      ? "This website sets no cookies of its own and runs no advertising trackers. The one thing we measure is how quickly our pages load, described in section 2, and it needs no cookie to do it."
      : "This website sets no cookies of its own and runs no analytics or advertising trackers.",
    ...(isLive("siteAnalytics")
      ? ["If you arrive through a link we tagged, such as the QR code in a magazine ad, your browser remembers which link it was until you close the tab, and it is sent with a booking or question so we know how you found us. That works whether or not you accept analytics, identifies nobody, and goes to no one else."]
      : []),
    "Now and then we try two versions of a page to see which one helps people more. If you are shown one, your browser remembers which version you saw, so it stays the same when you come back, and that is sent with a booking so we can count which version led to it. It identifies nobody and goes to no one else" + (isLive("siteAnalytics") ? ", except that Google Analytics and Microsoft Clarity are told which version you saw if you accept analytics." : "."),
    "Apart from those, there is one more thing we can keep in your browser, and only if you ask for it. If you start a booking and leave before finishing, we offer to keep your answers so they are still there next time. Say yes and they are stored in your own browser for " + DRAFT_KEEP_DAYS + " days, so that the next time you tap Book Now you carry on where you stopped. " + (isLive("checkoutFollowUp")
      ? "That saved copy stays on your device, and you can throw it away from the same screen that offered to keep it. Say no, or say nothing, and there is nothing to throw away. This is separate from checkout: if you type your contact details there and leave without booking, we receive them and what you had picked, so we can follow up once, as described above."
      : "That information stays on your device, never reaches us until you actually book, and you can throw it away from the same screen that offered to keep it. Say no, or say nothing, and there is nothing to throw away."),
    "If you are part way through booking and choose to ask us a question instead, what you had entered is carried to the question form in your browser for that one step, then deleted.",
  ];
  const setters = [];
  if (isLive("cardOnFile")) setters.push("Stripe's payment form");
  if (isLive("digitalWallets")) setters.push("PayPal's buttons");
  if (isLive("botCheck")) setters.push("Cloudflare's Turnstile check");
  if (setters.length) {
    const list = setters.length === 1 ? setters[0] : setters.slice(0, -1).join(", ") + " and " + setters[setters.length - 1];
    parts.push(
      `When you reach the payment step, ${list} may set cookies of their own for fraud prevention and to make the form work. They load only on that step, not when you are reading the site.`,
    );
  }
  // Promising to ask before adding analytics, on a page that already has
  // page-speed measurement running, is the kind of sentence that makes a
  // reader stop believing the rest of the document.
  if (!isLive("siteAnalytics")) parts.push(
    isLive("performanceMonitoring")
      ? "If we ever add analytics that identify you or follow you between websites, we will update this policy and ask for your consent before any of it loads."
      : "If we ever add analytics, we will update this policy and ask for your consent before any non-essential tracking is loaded.",
  );
  return parts.map((p) => `<p>${p}</p>`).join("\n    ");
}

function retainPara() {
  const base =
    "We keep questions, booking requests and customer records for as long as needed to serve you and to keep reasonable business and tax records, generally up to seven years for records tied to a completed, paid job. If you asked for a quote but never booked, you can ask us to delete your information at any time and we will.";
  const stored = isLive("bookingLink")
    ? " Bookings are stored in our database, hosted by Neon" +
      (isLive("cardOnFile") ? ", and the payment itself in the records of the payment processor." : ".")
    : " Bookings arrive in our email inbox" +
      (isLive("cardOnFile") ? ", and the payment itself sits in the records of the payment processor." : ".");
  return `<p>${base}${stored}</p>`;
}

function changesPara() {
  return `<p>If we change how we handle your information, we will update this page and change the version date at the top. The date of the terms you accepted is recorded with your booking. Significant changes will be made clear on the website.</p>`;
}

/* ======================================================================
   splice
   ====================================================================== */

function splice(html, prefix, name, body, { inline = false } = {}) {
  const start = `<!-- ${prefix}:${name}:START -->`;
  const end = `<!-- ${prefix}:${name}:END -->`;
  const i = html.indexOf(start);
  const j = html.indexOf(end);
  if (i < 0 || j < 0) throw new Error(`Markers for ${prefix}:${name} not found`);
  return html.slice(0, i + start.length) + (inline ? body : `\n    ${body}\n    `) + html.slice(j);
}

const inline = { inline: true };

/* ---- terms ---- */
{
  let html = fs.readFileSync(TERMS, "utf8");
  const s = (name, body, o) => (html = splice(html, "TERMS", name, body, o));
  s("EFFECTIVE", `Effective ${longDate(LEGAL.termsEffective)} &middot; Version ${LEGAL.termsEffective}`, inline);
  s("CONFIRMATION", copyFor("confirmation"), inline);
  s("TRAVEL_BASIS", copyFor("travelBasis"), inline);
  s("PAYMENT_METHODS", copyFor("paymentMethods"), inline);
  s("WHO_CAN_BOOK", copyFor("whoCanBook"), inline);
  s("CARD_AT_BOOKING", copyFor("cardAtBooking"), inline);
  s("PREPAY", copyFor("prepay"));
  s("AUTHORIZATION", copyFor("authorization"));
  s("WHY_A_CARD", copyFor("whyACard"), inline);
  s("REFUNDS", copyFor("refunds"), inline);
  s("MESSAGES", copyFor("messages"), inline);
  s("LADDER", ladderTable());
  s("CHANGES", changeRules());
  s("LATE_MOVE", lateMove(), inline);
  s("CREDIT", credit(), inline);
  s("HOWTOCHANGE", `<p>${copyFor("howToChange")}</p>
    <p>If you want to move it rather than cancel, say so, because moving is nearly always cheaper for you. Tell us roughly when suits and we will find you something.</p>`);
  fs.writeFileSync(TERMS, html);
}

/* ---- privacy ---- */
{
  let html = fs.readFileSync(PRIVACY, "utf8");
  const s = (name, body, o) => (html = splice(html, "PRIVACY", name, body, o));
  s("EFFECTIVE", `Effective ${longDate(LEGAL.privacyEffective)} &middot; Version ${LEGAL.privacyEffective}`, inline);
  s("COLLECT", collectList());
  s("AUTO", automaticPara());
  s("USE", useList());
  s("SHARE", shareList());
  s("COOKIES", cookiesParas());
  s("RETAIN", retainPara());
  s("CHANGES", changesPara());
  fs.writeFileSync(PRIVACY, html);
}

const live = CAPABILITIES.filter((c) => c.live).length;
console.log(
  `rendered terms.html and privacy.html: ${live}/${CAPABILITIES.length} capabilities live, ` +
    `${liveProcessors().length} processors named, ` +
    `cancellation at ${R.refundFullWindowHours}h/${R.refundMidWindowHours}h, late move ${pct(R.lateRescheduleFeeBp)}, ` +
    `terms v${LEGAL.termsEffective}, privacy v${LEGAL.privacyEffective}`,
);

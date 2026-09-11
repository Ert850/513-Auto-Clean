/**
 * Generates the parts of terms.html that can go out of date.
 *
 * Every number in the cancellation policy lives in lib/pricing/rules.ts, and
 * every sentence whose truth depends on a feature lives in
 * lib/site/capabilities.ts. This splices them into the page between marker
 * comments, the same way the services grid works.
 *
 * WHY: the terms drifted ahead of the build once, describing a self-service
 * booking link that did not exist. That is a bad thing to put in a document
 * someone is asked to agree to, and "remember to update the terms" is not a
 * mechanism. This is.
 *
 * Change a rule or flip a capability, run `npm run build`, and the page
 * rewrites itself. terms.test.ts fails if the two ever disagree.
 *
 * Run by `npm run build`.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CAPABILITIES,
  DEFAULT_RULES,
  cancellationLadder,
  copyFor,
} from "../../netlify/functions/_pricing.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const TERMS = path.join(root, "terms.html");

const R = DEFAULT_RULES;
const esc = (s) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const pct = (bp) => `${bp / 100}%`;

/* ---------------- the cancellation ladder ---------------- */

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

/* ---------------- the change rules ---------------- */

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

/* ---------------- splice ---------------- */

function splice(html, name, body, { inline = false } = {}) {
  const start = `<!-- TERMS:${name}:START -->`;
  const end = `<!-- TERMS:${name}:END -->`;
  const i = html.indexOf(start);
  const j = html.indexOf(end);
  if (i < 0 || j < 0) throw new Error(`Markers for ${name} not found in terms.html`);
  return html.slice(0, i + start.length) + (inline ? body : `\n    ${body}\n    `) + html.slice(j);
}

const today = new Date().toLocaleDateString("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
});

let html = fs.readFileSync(TERMS, "utf8");

const inline = { inline: true };
html = splice(html, "EFFECTIVE", `Effective ${today} &middot; Last updated ${today}`, inline);
html = splice(html, "CONFIRMATION", copyFor("confirmation"), inline);
html = splice(html, "TRAVEL_BASIS", copyFor("travelBasis"), inline);
html = splice(html, "PAYMENT_METHODS", copyFor("paymentMethods"), inline);
html = splice(html, "MESSAGES", copyFor("messages"), inline);
html = splice(html, "LADDER", ladderTable());
html = splice(html, "CHANGES", changeRules());
html = splice(html, "LATE_MOVE", lateMove(), inline);
html = splice(html, "CREDIT", credit(), inline);
html = splice(html, "HOWTOCHANGE", `<p>${copyFor("howToChange")}</p>
    <p>If you want to move it rather than cancel, say so, because moving is nearly always cheaper for you. Tell us roughly when suits and we will find you something.</p>`);

fs.writeFileSync(TERMS, html);

const live = CAPABILITIES.filter((c) => c.live).length;
console.log(
  `rendered terms.html: ${live}/${CAPABILITIES.length} capabilities live, ` +
    `cancellation at ${R.refundFullWindowHours}h/${R.refundMidWindowHours}h, ` +
    `late move ${pct(R.lateRescheduleFeeBp)}, credit ${R.rescheduleCreditDays} days`,
);

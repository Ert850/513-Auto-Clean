/**
 * The gift card emails: to the buyer, to the person it's for, and to Elijah.
 * Same shell, escaping and sender as the booking emails (send-confirmation.mjs).
 * No em-dashes, and every amount from the card itself.
 */
import { SHELL, esc } from "./send-confirmation.mjs";
import { dollars } from "./_giftcards.mjs";

/** How a card is used today, until the booking form has its own gift card box. */
const HOW_TO_USE =
  `To use it, book online at <a href="https://513autoclean.com" style="color:#c41414;font-weight:700">513autoclean.com</a> ` +
  `and type the code in "Anything else we should know?", or tell us when we confirm. ` +
  `It never expires, works on any detail, add-on or travel, and whatever is left stays on the card. ` +
  `There's no sales tax on the card; tax is added to the detail when it's used.`;

const longDay = (iso) => new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });

/** The card as a block that survives every mail app: a table, inline styles, no images needed. */
export function cardBlock(card, code, link) {
  const to = card.toName ? `<div style="font-size:13px;color:#a7b0bd;margin-top:14px">For ${esc(card.toName)}${card.fromName ? `, from ${esc(card.fromName)}` : ""}</div>` : "";
  const msg = card.message ? `<div style="font-size:15px;color:#eef1f4;margin-top:8px;font-style:italic">&ldquo;${esc(card.message)}&rdquo;</div>` : "";
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:separate;margin:4px 0 18px">
<tr><td style="background:#0b0e13;border-radius:14px;padding:20px 22px;border-bottom:5px solid #c41414;color:#fff">
<div style="font-size:13px;font-weight:800;letter-spacing:.02em">513 Auto Clean</div>
<div style="font-size:44px;font-weight:800;line-height:1.05;margin-top:10px">${dollars(card.valueCents)}</div>
<div style="font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#a7b0bd">Gift card</div>
<div style="margin-top:16px;font:700 20px/1.2 Menlo,Consolas,monospace;letter-spacing:.06em">${esc(code)}</div>
${to}${msg}
</td></tr></table>
<p style="margin:0 0 14px"><a href="${esc(link)}" style="display:inline-block;background:#c41414;color:#fff;font-weight:700;text-decoration:none;padding:12px 20px;border-radius:999px">View, print or share the card</a></p>`;
}

export function buyerEmail({ card, code, link, payCents, toEmail }) {
  const when = card.sendOn
    ? `We'll email it to ${esc(card.toName || toEmail)} on ${longDay(card.sendOn)}. You can also forward this email or print the card.`
    : toEmail
      ? `We've also emailed it to ${esc(card.toName || toEmail)}.`
      : `Forward this email, or print the card to give it in person.`;
  const paid = payCents < card.valueCents ? ` You paid ${dollars(payCents)} (${card.percentOff}% off).` : ` You paid ${dollars(payCents)}.`;
  return {
    subject: `Your ${dollars(card.valueCents)} 513 Auto Clean gift card`,
    html: SHELL(
      "Your gift card is ready",
      `${cardBlock(card, code, link)}<p style="margin:0 0 12px">${when}${paid}</p><p style="margin:0 0 12px;color:#5a6069">${HOW_TO_USE}</p>`,
      `${dollars(card.valueCents)} gift card, code ${code}`,
    ),
  };
}

export function recipientEmail({ card, code, link }) {
  // Never "Someone sent you...": with no name it reads like phishing (validation pass 1).
  const v = dollars(card.valueCents);
  const subject = card.fromName ? `${card.fromName} sent you a ${v} gift card from 513 Auto Clean` : `You've received a ${v} gift card from 513 Auto Clean`;
  const lead = card.fromName ? `${esc(card.fromName)} sent you a 513 Auto Clean gift card` : "You've received a 513 Auto Clean gift card";
  return {
    subject,
    html: SHELL(
      "You've got a gift card",
      `<p style="margin:0 0 14px">${lead} for a mobile detail: we come to you.</p>${cardBlock(card, code, link)}<p style="margin:0 0 12px;color:#5a6069">${HOW_TO_USE}</p>`,
      `${v} gift card${card.fromName ? ` from ${card.fromName}` : ""}`,
    ),
  };
}

export function ownerEmail({ card, code, payCents, buyer, toEmail, problem }) {
  const rows = [
    ["Card", `${dollars(card.valueCents)}, code ending ${code.slice(-4)}`],
    ["Paid", `${dollars(payCents)}${card.percentOff ? ` (${card.percentOff}% off)` : ""}`],
    ["Buyer", buyer || "(no email)"],
    ["For", [card.toName, toEmail].filter(Boolean).join(", ") || "(the buyer)"],
    ["Send to them", card.sendOn ? longDay(card.sendOn) : toEmail ? "now" : "(not sent: the buyer gives it)"],
  ].map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#5a6069">${k}</td><td style="padding:4px 0">${esc(v)}</td></tr>`).join("");
  const warn = problem ? `<p style="margin:0 0 12px;color:#b41212;font-weight:700">${esc(problem)}</p>` : "";
  return {
    subject: `${problem ? "CHECK: " : ""}Gift card sold: ${dollars(card.valueCents)} for ${dollars(payCents)}`,
    html: SHELL("Gift card sold", `${warn}<table role="presentation" style="border-collapse:collapse;font-size:15px">${rows}</table><p style="margin:14px 0 0;color:#5a6069">Look it up or mark it used at /gift-admin. It's also on the payment in Stripe.</p>`),
  };
}

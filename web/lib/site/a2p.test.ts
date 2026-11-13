/**
 * The texting approval (A2P) changes, November 12, 2026 (docs/OVERNIGHT-A2P-PLAN.md).
 *
 * T1  one phone number: BUSINESS_PHONE in Netlify, else config/business.json
 * T2  the Contact form's "Request a quote" mode, switchable back with one word
 * T3  the booking form's texts box, in the same words as the Contact form's
 * T4  the hours, from config/business.json
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
// @ts-expect-error: plain ESM build script, no types
import { root } from "../../scripts/chrome.mjs";
// @ts-expect-error: plain ESM build script, no types
import { stampPhone, phoneHashSalt } from "../../scripts/phone-stamp.mjs";
// @ts-expect-error: plain ESM build script, no types
import { contactCard, contactHead, loadContactForm } from "../../scripts/contact-form.mjs";
import { HOURS, REPO_PHONE, businessPhone, hoursText, parsePhone, phoneTrace, swapPhone } from "./business.js";

const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");
const NEW = "5555550100";

describe("T1: the phone number", () => {
  it("reads 10 US digits in any format, and says why a bad one is bad", () => {
    for (const s of ["(555) 555-0100", "555-555-0100", "555.555.0100", "5555550100", "+15555550100", "+1-555-555-0100", "1 555 555 0100"]) {
      expect(parsePhone(s), s).toEqual({ phone: { digits: NEW, display: "(555) 555-0100", e164: "+15555550100" } });
    }
    expect(parsePhone("555-0100")).toEqual({ error: expect.stringMatching(/not 10 US digits/) });
    expect(parsePhone("call 5555550100")).toEqual({ error: expect.stringMatching(/characters/) });
    expect(parsePhone("(055) 555-0100")).toEqual({ error: expect.stringMatching(/area code/) });
    expect(() => businessPhone("12345")).toThrow(/BUSINESS_PHONE: the phone number "12345" is not 10 US digits/);
  });

  it("unset or blank means today's number", () => {
    expect(businessPhone(undefined)).toEqual(REPO_PHONE);
    expect(businessPhone("  ")).toEqual(REPO_PHONE);
    expect(REPO_PHONE.display).toBe("(513) 279-2915");
  });

  it("swaps every format the site writes, in the same format", () => {
    const to = businessPhone(NEW);
    const pairs: [string, string][] = [
      ["(513) 279-2915", "(555) 555-0100"],
      ["(513)&nbsp;279-2915", "(555)&nbsp;555-0100"],
      ["513-279-2915", "555-555-0100"],
      ["513.279.2915", "555.555.0100"],
      ["5132792915", "5555550100"],
      ['href="tel:+15132792915"', 'href="tel:+15555550100"'],
      ["+1-513-279-2915", "+1-555-555-0100"],
    ];
    for (const [from, want] of pairs) {
      expect(swapPhone(from, REPO_PHONE, to)).toBe(want);
      expect(phoneTrace(from, REPO_PHONE), from).not.toBeNull();
      expect(phoneTrace(want, REPO_PHONE), want).toBeNull();
    }
    // Digits that only contain the number are left alone.
    expect(swapPhone("75132792915", REPO_PHONE, to)).toBe("75132792915");
  });

  function sampleDist() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "a2p-dist-"));
    for (const f of ["index.html", "contact.html", "terms.html", "privacy.html", "lp-golf.html", "js/funnel.js", "script.js", "js/pricing.bundle.js"]) {
      fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
      fs.copyFileSync(path.join(root, f), path.join(dir, f));
    }
    return dir;
  }

  it("with BUSINESS_PHONE set, leaves no trace of today's number in the published files", () => {
    const dir = sampleDist();
    const { changed } = stampPhone(dir, NEW);
    expect(changed.length).toBe(8);
    for (const f of changed) {
      const text = fs.readFileSync(path.join(dir, f), "utf8");
      expect(phoneTrace(text, REPO_PHONE), f).toBeNull();
      expect(text, f).toContain("555");
    }
    expect(phoneHashSalt(NEW), "the ?v= hashes change with the number").not.toBe("");
  });

  it("unset, changes nothing at all", () => {
    const dir = sampleDist();
    const before = fs.readFileSync(path.join(dir, "index.html"), "utf8");
    expect(stampPhone(dir, undefined).changed).toEqual([]);
    expect(stampPhone(dir, "").changed).toEqual([]);
    expect(fs.readFileSync(path.join(dir, "index.html"), "utf8")).toBe(before);
    expect(phoneHashSalt(undefined)).toBe("");
  });

  it("a bad value stops the build with the reason", () => {
    expect(() => stampPhone(sampleDist(), "513-279-291")).toThrow(/BUSINESS_PHONE.*not 10 US digits/);
  });

  it("the booking emails use the same number, not a typed one", () => {
    const src = read("netlify/functions/send-confirmation.mjs");
    expect(phoneTrace(src, REPO_PHONE)).toBeNull();
    expect(src).toContain("return businessPhone();");
    // A bad BUSINESS_PHONE in the Functions scope falls back instead of stopping the function loading.
    expect(src).toContain('return businessPhone("");');
  });
});

describe("T2: the Contact form", () => {
  const cfg = loadContactForm();
  const as = (mode: string) => ({ ...cfg, mode });

  it("question mode is the form exactly as it was on November 12", () => {
    expect(contactHead(as("question"))).toBe(read("web/lib/site/fixtures/contact-question-head.html"));
    expect(contactCard(as("question"))).toBe(read("web/lib/site/fixtures/contact-question-card.html"));
  });

  it("contact.html carries the mode the config names", () => {
    const html = read("contact.html");
    expect(html).toContain(`<!-- CONTACT:HEAD:START -->\n${contactHead(cfg)}<!-- CONTACT:HEAD:END -->`);
    expect(html).toContain(`<!-- CONTACT:CARD:START -->\n${contactCard(cfg)}<!-- CONTACT:CARD:END -->`);
  });

  it("quote mode: the fields in the mockup's order, both boxes optional and unticked, in Imperion's exact words", () => {
    const card = contactCard(as("quote"));
    const order = ["q-name", "q-phone", "q-email", "q-vehicle", "q-zip", "preferred_contact", "q-message", "q-condition", "SMS consent", "Marketing"];
    const at = order.map((k) => card.indexOf(k));
    expect(at.every((i) => i > 0), "every field is there").toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(card).toContain(
      "I consent to receive SMS notifications, alerts &amp; occasional marketing communication from 513 Auto Clean. " +
        "Message frequency varies. Message &amp; data rates may apply. Text HELP to (513) 279-2915 for assistance. " +
        "You can reply STOP to unsubscribe at any time.",
    );
    expect(card).toContain("I want to receive news, feature updates, discounts &amp; offers from 513 Auto Clean.");
    expect(card).toContain(
      'By continuing you agree to our <a href="terms.html">Terms &amp; Conditions</a> and <a href="privacy.html">Privacy Policy</a>.',
    );
    for (const box of card.match(/<input type="checkbox" name="(?:SMS consent|Marketing)"[^>]*>/g) ?? []) {
      expect(box).not.toMatch(/checked|required/);
      expect(box, "sent as yes or no by script.js").toContain("data-yesno");
    }
    expect(card).toContain('value="QUOTE REQUEST from 513autoclean.com"');
    expect(card).toMatch(/<button type="submit"[^>]*>\s*Request Quote/);
    expect(card).toContain("No spam, ever. We only use your info to send your quote.");
    expect(contactHead(as("quote"))).toContain("<h2>Request a quote</h2>");
  });

  it("script.js sends each box as yes or no, so the email says which", () => {
    const src = read("script.js");
    expect(src).toContain("fd.set(b.name, b.checked ? 'yes' : 'no')");
  });

  it("a mode the file does not know fails the build", () => {
    const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "a2p-cf-")), "c.json");
    fs.writeFileSync(tmp, JSON.stringify({ ...cfg, mode: "quotes" }));
    expect(() => loadContactForm(tmp)).toThrow(/must be "question" or "quote"/);
  });
});

describe("T3: the booking form's texts box", () => {
  const src = read("js/funnel.js");

  it("says exactly what the Contact form's box says", () => {
    const m = /var SMS_CONSENT = ((?:'[^']*'\s*\+?\s*)+);/.exec(src);
    expect(m, "SMS_CONSENT in funnel.js").not.toBeNull();
    const text = [...m![1]!.matchAll(/'([^']*)'/g)].map((x) => x[1]).join("");
    const want = loadContactForm().modes.quote.smsBox.replace("{phone}", REPO_PHONE.display);
    expect(text).toBe(want);
  });

  it("sits in Your details, optional and unticked unless they ticked it, with the terms line", () => {
    const details = src.slice(src.indexOf("function rDetails()"), src.indexOf("function rAgree()"));
    expect(details).toContain("consentBox('sms', 'bkSms', SMS_CONSENT, '')");
    expect(details).toContain("By continuing you agree to our ");
    const agree = src.slice(src.indexOf("function rAgree()"), src.indexOf("function lDetails()"));
    expect(agree, "and only there").not.toContain("consentBox('sms'");
  });

  it("the booking email says SMS consent: yes or no", () => {
    expect(src).toContain("'\\n  SMS consent: ' + (state.consent.sms ? 'yes' : 'no')");
  });
});

describe("T4: the hours", () => {
  it("come from config/business.json", () => {
    expect(HOURS).toEqual({ opens: "06:00", closes: "24:00" });
    expect(hoursText()).toBe("6 AM to midnight");
    expect(hoursText({ opens: "07:30", closes: "22:00" })).toBe("7:30 AM to 10 PM");
  });

  it("no page says the old hours, and the hidden business data agrees", () => {
    for (const f of ["index.html", "contact.html", "services.html", "about.html", "faq.html", "service-area.html", "lp-golf.html", "lp-prestige.html"]) {
      const html = read(f);
      expect(html, f).not.toMatch(/7 AM to 10 PM/);
      expect(html, f).toContain(`7 days/week · ${hoursText()}`);
    }
    expect(read("index.html")).toContain(`"opens": "${HOURS.opens}", "closes": "${HOURS.closes}"`);
    expect(read("index.html")).toContain(`Available 7 days a week, ${hoursText()}`);
  });
});

describe("T7: the booking page at /book", () => {
  it("is a 200 rewrite to booking.html, kept out of search and the sitemap; /book.html is left alone", () => {
    const toml = read("netlify.toml");
    expect(toml).toMatch(/from = "\/book"\n\s*to = "\/booking\.html"\n\s*status = 200/);
    expect(toml).toMatch(/from = "\/book\.html"\n\s*to = "\/#book"\n\s*status = 301/);
    expect(read("booking.html")).toContain('<meta name="robots" content="noindex" />');
    expect(read("sitemap.xml")).not.toContain("booking");
  });

  it("is registered like every page", () => {
    for (const f of ["web/scripts/chrome.mjs", "web/scripts/build-dist.mjs", "web/scripts/stamp-assets.mjs"]) {
      expect(read(f), f).toContain('"booking.html"');
    }
  });

  it("shows the booking form's own first step, never a copy of its markup", () => {
    const html = read("booking.html");
    expect(html).toContain("data-bk-sizestep");
    expect(html, "no size cards typed into the page").not.toContain("data-size=");
    expect(read("js/funnel.js")).toContain("c.innerHTML = rSize();");
  });

  it("carries the Cincinnati pill in its top bar only (owner's pick, November 13)", () => {
    expect(read("booking.html")).toContain('class="loc-pill tb-loc"');
    expect(read("index.html")).not.toContain("tb-loc");
  });
});

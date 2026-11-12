/**
 * The Contact page's form, from config/contact-form.json (A2P plan T2).
 *
 * "Request a quote" with two optional tick boxes is needed only until the new
 * number's texting approval (A2P), so both wordings live in the config file
 * and one word, "mode", picks which is built. "question" is the form exactly
 * as it was on November 12 (contact-form.test.ts compares it with a saved
 * copy), so switching back is that one word and a deploy.
 *
 * Written between CONTACT:HEAD and CONTACT:CARD markers in contact.html by
 * render-site.mjs.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { REPO_PHONE } from "../../netlify/functions/_pricing.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const MODES = ["question", "quote"];
const NEEDS = ["heading", "intro", "cardTitle", "cardSub", "subject", "button", "fineprint"];
const QUOTE_NEEDS = ["success", "smsBox", "marketingBox", "termsLine"];

/** config/contact-form.json, checked: a mistake fails the build. */
export function loadContactForm(file = path.join(root, "config/contact-form.json")) {
  const cfg = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!MODES.includes(cfg.mode)) {
    throw new Error(`config/contact-form.json: mode is "${cfg.mode}", it must be "question" or "quote"`);
  }
  for (const m of MODES) {
    const w = cfg.modes?.[m];
    for (const k of [...NEEDS, ...(m === "quote" ? QUOTE_NEEDS : [])]) {
      if (typeof w?.[k] !== "string" || !w[k].trim()) {
        throw new Error(`config/contact-form.json: modes.${m}.${k} is missing`);
      }
    }
  }
  return cfg;
}

const fill = (s) => s.replace(/\{phone\}/g, REPO_PHONE.display);

/* The blocks of the form, as written on November 12. */

const QUESTION_PAIR = (w) => `
          <!-- Wide screens: the two free-text boxes side by side, then two rows of
               three. Same fields and order of importance, about half the height. -->
          <div class="field-row pair-wide">
            <div class="field">
              <label for="q-message">What&rsquo;s your question? <span class="req">*</span></label>
              <textarea id="q-message" name="message" rows="4" required
                placeholder="e.g. My back seats have old coffee stains and my dog sheds badly. Is a Full Interior enough, or do I need add-ons?"></textarea>
            </div>
            <div class="field">
              <label for="q-condition">Your vehicle&rsquo;s condition</label>
              <textarea id="q-condition" name="condition" rows="2"
                placeholder="Pet hair, spills, smoke, kids, work truck, sat outside all winter&hellip;"></textarea>
            </div>
          </div>
`;

const CONTACT_ROW = `
          <div class="field-row three">
            <div class="field">
              <label for="q-name">Name <span class="req">*</span></label>
              <input type="text" id="q-name" name="name" placeholder="Your name" required autocomplete="name" />
            </div>
            <div class="field">
              <label for="q-phone">Phone <span class="req">*</span></label>
              <input type="tel" id="q-phone" name="phone" placeholder="(513) 555-0123" required autocomplete="tel" inputmode="tel" />
            </div>
            <div class="field">
              <label for="q-email">Email</label>
              <input type="email" id="q-email" name="email" placeholder="you@email.com" autocomplete="email" inputmode="email" />
            </div>
          </div>
`;

const VEHICLE_ROW = `
          <div class="field-row three">
            <div class="field">
              <label for="q-vehicle">Vehicle</label>
              <input type="text" id="q-vehicle" name="vehicle" placeholder="e.g. 2018 Honda CR-V" />
            </div>
            <div class="field">
              <label for="q-zip">Your city / ZIP</label>
              <input type="text" id="q-zip" name="zip" placeholder="e.g. Clifton / 45220" autocomplete="postal-code" />
            </div>
            <fieldset class="field contact-pref">
              <legend>Best way to reach you</legend>
              <div class="pref-opts">
                <label class="pref"><input type="radio" name="preferred_contact" value="Text" checked /> <span>Text</span></label>
                <label class="pref"><input type="radio" name="preferred_contact" value="Call" /> <span>Call</span></label>
                <label class="pref"><input type="radio" name="preferred_contact" value="Email" /> <span>Email</span></label>
              </div>
            </fieldset>
          </div>
`;

/*
 * The two tick boxes (Imperion's wording, IMPERION-RECOMMENDATIONS.md A3):
 * optional and unticked, as carriers require. script.js sends each as
 * "yes" or "no" under its name, so the email always says which.
 * Class names avoid "consent": cookie-banner filter lists hide such names.
 */
const TICKS = (w) => `
          <div class="inq-ticks">
            <label class="inq-tick"><input type="checkbox" name="SMS consent" value="yes" data-yesno /> <span>${fill(w.smsBox)}</span></label>
            <label class="inq-tick"><input type="checkbox" name="Marketing" value="yes" data-yesno /> <span>${fill(w.marketingBox)}</span></label>
            <p class="inq-terms">${fill(w.termsLine)}</p>
          </div>
`;

/** The heading beside the form. */
export function contactHead(cfg) {
  const w = cfg.modes[cfg.mode];
  return `          <span class="eyebrow">Contact Us</span>
          <h2>${w.heading}</h2>
          <p>${fill(w.intro)}</p>
`;
}

/** The form card's contents. */
export function contactCard(cfg) {
  const quote = cfg.mode === "quote";
  const w = cfg.modes[cfg.mode];
  const fields = quote ? CONTACT_ROW + VEHICLE_ROW + QUESTION_PAIR(w) + TICKS(w) : QUESTION_PAIR(w) + CONTACT_ROW + VEHICLE_ROW;
  return `        <h3>${w.cardTitle}</h3>
        <p class="fc-sub">${fill(w.cardSub)}</p>
        <form id="inquiryForm" class="js-w3form${quote ? " inq-quote" : ""}" action="https://api.web3forms.com/submit" method="POST" novalidate${quote ? ` data-success="${w.success.replace(/"/g, "&quot;")}"` : ""}>
          <input type="hidden" name="access_key" value="8a502fe3-2a53-4904-98e9-b18dabb1f579" />
          <input type="hidden" name="subject" value="${w.subject}" />
          <input type="hidden" name="from_name" value="513 Auto Clean Website" />
          <input type="checkbox" name="botcheck" style="display:none" tabindex="-1" autocomplete="off" />
${fields}
          <div class="form-foot">
            <button type="submit" class="btn btn-primary btn-lg btn-block">
              ${w.button}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/></svg>
            </button>
            <p class="fineprint">${fill(w.fineprint)}</p>
          </div>
          <div class="form-msg" role="status" aria-live="polite"></div>
        </form>
`;
}

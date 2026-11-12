#!/usr/bin/env node
/**
 * The price list for the Google Business Profile (and anyone else who needs
 * prices), generated from the same catalog the website is built from, so it
 * can never disagree with the site. Re-run after any price change:
 *
 *   node web/scripts/price-list.mjs     (after npm run build)
 *
 * Writes docs/PRICE-LIST.md. Prices are the site's, before sales tax and
 * travel. Wording follows CLAUDE.md: no removal promises, no em-dashes.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const m = await import(path.join(root, "netlify/functions/_pricing.mjs"));
const R = m.DEFAULT_RULES;
const usd = (c) => "$" + (c / 100).toLocaleString("en-US", { maximumFractionDigits: 0 });
const hrs = (min) => (min % 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min / 60} h`).replace(/^0 h /, "");
const today = new Date().toLocaleDateString("en-US", { timeZone: "America/New_York", month: "long", day: "numeric", year: "numeric" });

const pkg = (id) => m.findPackage(id);
const addon = (id) => m.ADDONS.find((a) => a.id === id);
const bookable = (a) => a && !m.unavailableReason(a);
const tierFrom = (a) => usd(Math.min(...a.tiers.map((t) => t.priceCents)));
const sizes = [["Small", "sedan, coupe, hatchback", 0], ["Medium", "SUV, truck, crossover", 1000], ["Large", "3 row SUV, 7+ passenger van", 2500]];
// Cross-check the size table against the catalog's own.
const SEED_SIZES = { small: 0, medium: 1000, large: 2500 };
for (const [label, , c] of sizes) if (SEED_SIZES[label.toLowerCase()] !== c) throw new Error("size table out of date");

const lines = [];
const out = (s = "") => lines.push(s);

out(`# 513 Auto Clean: price list`);
out();
out(`Generated from the website's own catalog on ${today} (\`web/scripts/price-list.mjs\`). These are the prices 513autoclean.com shows and charges. Quote only these.`);
out();
out(`- **Prices are per vehicle, before Ohio or Kentucky sales tax and before travel.**`);
out(`- **Vehicle size:** ${sizes.map(([l, ex, c]) => `${l} (${ex}) ${c ? "+" + usd(c) : "no extra"}`).join("; ")}.`);
out(`- **Travel:** the first ${R.mileage.freeMinutes} minutes of drive time are free; after that the site works out the fee from the address before booking.`);
out(`- **More than one vehicle:** ${R.additionalVehicleDiscountBp / 100}% off each extra vehicle. **Interior and exterior together:** ${usd(R.comboDiscountCents)} off per vehicle.`);
out(`- **Add-ons are booked with a package.** A single job on its own (one stain, a spill, odor) is quoted by text or call: see "Spot and restoration jobs".`);
out(`- **Nothing is charged up front;** customers pay when the detail is finished.`);
out();

out(`## Interior packages`);
out();
out(`| Package | Price (small vehicle) | Time on site | Note |`);
out(`|---|---|---|---|`);
for (const p of m.packagesFor("interior")) {
  if (p.unavailable) continue;
  out(`| ${p.name} | ${usd(p.priceCents)} | about ${hrs(p.durationMin)} | ${p.requiresPriorDetail ? "Returning customers only, not shown on the website: leave it off Google" : ""} |`);
}
out();

out(`## Exterior packages`);
out();
out(`| Package | Price (small vehicle) | Time on site | Note |`);
out(`|---|---|---|---|`);
for (const p of m.packagesFor("exterior")) {
  if (p.unavailable || p.requiresCorrectionTier) continue;
  out(`| ${p.name} | ${usd(p.priceCents)} | about ${hrs(p.durationMin)} | |`);
}
out();

out(`## Add-ons (with any package)`);
out();
out(`| Add-on | Price | Time |`);
out(`|---|---|---|`);
for (const a of m.ADDONS.filter(bookable)) {
  for (const t of a.tiers) {
    const label = a.tiers.length > 1 ? `${a.name}: ${t.label}` : a.name;
    out(`| ${label} | ${usd(t.priceCents)} | about ${hrs(t.durationMin ?? 60)} |`);
  }
}
out(`| Extra hands-on time beyond the listed work | ${usd(R.addonRateCents)} an hour | |`);
out();

out(`## Spot and restoration jobs`);
out();
out(`One-off jobs (a single stain, a spill, vomit, pet urine, a smell that won't go) start at **$100**, and some need a photo or a call first. Text a photo to (513) 279-2915. (The $100 minimum is from the team brief, 7.1; the website doesn't book these on their own yet.)`);
out(`With any interior package they are booked online as add-ons:`);
out();
const spot = [
  ["Vomit, food or drink spills", "stain", "Stain treatment, deep"],
  ["Pet urine or accidents", "stain", "Stain treatment, deep, plus Ozone Odor Reset for the smell"],
  ["Single stains on seats or carpet", "stain", "Stain treatment, surface or deep"],
  ["Smoke, mildew or lingering odors", "ozone", "Ozone Odor Reset"],
  ["Pet hair", "pet-hair", "Pet Hair Removal"],
  ["Germs and allergens (sanitizing)", "steam", "Full Vehicle Steam Treatment"],
  ["Under the front seats", "seat-removal", "Seat Removal"],
];
out(`| Problem | Treated with | Add-on price |`);
out(`|---|---|---|`);
for (const [prob, id, how] of spot) {
  const a = addon(id);
  if (!bookable(a)) continue;
  const price = id === "stain" && prob.startsWith("Pet urine")
    ? `${usd(a.tiers.find((t) => /deep/i.test(t.label)).priceCents)} + ${usd(addon("ozone").tiers[0].priceCents)}`
    : a.tiers.length > 1 && /deep/.test(how) && !/surface/.test(how)
      ? usd(a.tiers.find((t) => /deep/i.test(t.label)).priceCents)
      : a.tiers.length > 1 ? `${tierFrom(a)} to ${usd(Math.max(...a.tiers.map((t) => t.priceCents)))}` : usd(a.tiers[0].priceCents);
  out(`| ${prob} | ${how} | ${price} |`);
}
out();
out(`Say "treat", "lift" or "reduce", never "remove" or "eliminate": results depend on the fabric and how long the stain has set.`);
out();

// The names Google Business Profile shows today (Imperion's list, November 12), mapped to ours.
out(`## For the Google Business Profile service list`);
out();
out(`Each Google service name with the matching service on the site and the price to show. "From" prices are for a small vehicle.`);
out();
const ext = (id) => usd(pkg(id).priceCents);
const gbp = [
  ["Auto detailing", `Basic Interior, Full Interior, exterior packages`, `from ${usd(Math.min(...m.packagesFor("interior").filter((p) => !p.requiresPriorDetail && !p.unavailable).map((p) => p.priceCents)))}`],
  ["Car waxing", "Ceramic Wax Sealant: included in Full Exterior, or an add-on", `${usd(addon("ceramic-sealant").tiers[0].priceCents)} add-on; in Full Exterior ${ext("full-exterior")}`],
  ["Clay bar treatment", "Clay Bar or Clay Towel: included in Full Exterior, or an add-on", `${usd(addon("clay-bar").tiers[0].priceCents)} add-on`],
  ["Engine detailing", "Engine Bay Detail: included in Full Exterior, or an add-on", `${usd(addon("engine-bay").tiers[0].priceCents)} add-on`],
  ["Full body wash", "Express Exterior / Basic Exterior", `from ${ext("express-exterior")}`],
  ["Headlight polishing", "Headlight Restoration (add-on)", usd(addon("headlight").tiers[0].priceCents)],
  ["Seat shampooing", "Full Interior (shampoo scrub of the upholstery); single stains: Stain Treatment", `from ${ext("full-interior")}; stains from ${tierFrom(addon("stain"))}`],
  ["Steam cleaning", "Full Vehicle Steam Treatment (add-on to an interior package)", usd(addon("steam").tiers[0].priceCents)],
  ["Vehicle interior vacuuming", "Basic Interior", `from ${ext("basic-interior")}`],
  ["Wheel washing", "Hubcaps scrubbed in Express Exterior; wheels, tires and wells in Basic and Full Exterior; Tire and Rim Shine add-on", `from ${ext("express-exterior")}; shine ${usd(addon("tire-rim-shine").tiers[0].priceCents)}`],
];
out(`| Google service | On the site | Price to show |`);
out(`|---|---|---|`);
for (const [g, ours, price] of gbp) out(`| ${g} | ${ours} | ${price} |`);
out();
out(`**Worth adding to Google:** Pet Hair Removal (${usd(addon("pet-hair").tiers[0].priceCents)}), Stain Treatment (${tierFrom(addon("stain"))} to ${usd(Math.max(...addon("stain").tiers.map((t) => t.priceCents)))}), Ozone Odor Reset (${usd(addon("ozone").tiers[0].priceCents)}), Paint Decontamination (${usd(addon("paint-decon").tiers[0].priceCents)}), Hard Water Spot Removal (${usd(addon("hard-water").tiers[0].priceCents)}).`);
out();

out(`## Not offered yet (don't list on Google)`);
out();
for (const a of m.ADDONS.filter((x) => !bookable(x))) out(`- ${a.name}: ${m.unavailableReason(a)}`);
for (const p of m.packagesFor("exterior").filter((p) => p.requiresCorrectionTier)) out(`- ${p.name}: opens with paint correction.`);
out();

fs.writeFileSync(path.join(root, "docs/PRICE-LIST.md"), lines.join("\n"));
console.log("wrote docs/PRICE-LIST.md");

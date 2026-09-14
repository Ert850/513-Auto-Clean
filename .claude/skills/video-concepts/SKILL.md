---
name: video-concepts
description: Build a recording-session PDF of 100 to 200 video concepts for 513 Auto Clean. Each concept is the question a videographer asks off camera plus the facts Elijah should know while answering, camera notes only where they depart from the defaults, and how the clip gets cut. Use for a new session (exterior, correction, seasonal, a Q&A day), or to rebuild one after the catalog or prices change.
---

# Video concepts: a recording session, as a PDF

Everything lives in `content/`, which is gitignored and never published.

    content/research/    niche research and sources (refresh with /niche-research)
    content/sessions/    one folder per session: session.mjs -> .html -> .pdf
    content/build/       render.mjs, the renderer

## What a concept is

One card. The videographer reads the `q` aloud; Elijah answers it like a
customer is standing there. The card never contains the answer. It contains
what he should KNOW while giving one, so the numbers and mechanisms are right
and the opinion stays his.

```js
{
  kind: "story" | "howto" | "format" | undefined,   // colours the card; undefined = question
  q: "When is a car dirty enough to need a detail?",  // the videographer's line, verbatim
  angle: "Give a test the viewer can do right now...", // rough shape of a good answer
  facts: ["Full detail every 4 to 6 months...", ...], // 2 to 5 bullets, sourced, real numbers
  perf: "Top search intent question in the niche.",   // why this performs, optional
  shot: "Nano B on the tank, same frame each pass.",  // ONLY if it departs from the defaults
  edit: "Two-frame cut, 0.5s hold each.",             // ONLY if it departs from the defaults
  ref: "https://...",                                 // a clip that shows the format, optional
}
```

`kind: "howto"` renders the Q as SHOW: hands are working, he talks about what
the hands are doing. `kind: "format"` is pure b-roll, no talking.

## Building a session

1. **Read `content/research/` first.** If it is older than a couple of
   months or the session is a new niche, run `/niche-research` before
   writing a card. Every fact on a card should be traceable to it or to the
   catalog.
2. **Read the catalog** so service names, prices, durations and the line
   items are exact. Never guess a price:
   ```
   node -e "const P=require('./netlify/functions/_pricing.mjs'); ..."
   ```
   `P.SEED_CATALOG.packages`, `P.ADDONS`, `P.CORRECTION_TIERS`,
   `P.COATING_TERMS`, `P.DEFAULT_RULES`. The interior and exterior sessions
   each print the relevant slice at the top of their `session.mjs`.
3. **Copy the structure of `sessions/01-interior/`.** `session.mjs` holds
   `meta` (front matter, camera defaults, edit defaults) and `sections`.
   Large sessions split concepts into `part-*.mjs` files.
4. **Section order is the shooting order:** story or warm-up first while the
   energy is high, seated questions next, hands-on how-it's-done on the dirty
   car, myths, business, and the format b-roll bank last. Say so in
   `meta.howToRun`.
5. **How-it's-done cards follow the service list line for line**, in the
   real order of work, so each clip can sit beside its listing on the site
   and double as a training tidbit.
6. **Aim for 120 to 160 cards.** More than a day holds, on purpose; the
   videographer skips what lands flat.
7. Build and look at it:
   ```
   node content/build/render.mjs sessions/<folder>
   ```
   Chrome prints the PDF. `--html-only` skips it. Screenshot the HTML with
   headless Chrome to check the layout if anything in the template changed.

## The rules the cards obey

- **No em-dashes.** Anywhere. Commas and full stops.
- **Say the real number.** Prices, hours, percentages come from the catalog.
- **Facts are not answers.** If a card reads like a script, rewrite it as
  what to know.
- **Story cards carry no facts.** The facts are his. They carry the angle
  and why the format performs.
- **Camera and edit defaults are printed once, in `meta`.** A card carries
  `shot` or `edit` only when it needs something different. If most cards
  need the same override, it is a default, move it.
- **Prefer specific over clever.** "Can you get the milk smell out" beats
  "odor solutions".
- **Kind to customers.** The strangest thing found in a car is a story about
  an object, never a person.

## The gear these are written for

Ronin RS4 Pro with the Nikon ZR mounted vertical (R3D NE, DCI 4K 30p, 180
degree shutter, Log3G10, dual base ISO 800/6400), two DJI Osmo Nanos as a
static wide and a macro B cam, iPhone 15 Pro on a gimbal for raw same-day
social, DJI Neo 2 for one arrival and one top-down per location, DJI Mic 3 on
Elijah for everything, a boom for seated wides. The defaults in
`sessions/01-interior/session.mjs` are the reference; copy them rather than
rewriting them.

## Handing it over

The PDF in the session folder is the deliverable. Send it with SendUserFile
so it reaches the videographer's phone. Mention the concept count, the
estimated hours, and which two vehicles the day needs.

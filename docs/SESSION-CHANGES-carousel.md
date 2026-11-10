# Session changes: Results ("Our Work") carousel

Branch: `claude/results-carousel-347a0d`. Not pushed.
Files: `index.html` (`#gallery` only), `js/gallery.js`, `styles.css` (gallery block, plus one gallery-only line in the 820px block and a new 1100px rule after it). `script.js` is unchanged: the carousel drives the existing slider markup.

## Setup for testing

```bash
export PATH=/opt/homebrew/opt/node@22/bin:$PATH && npm run build
python3 -m http.server 8792 --directory dist
```

Open http://localhost:8792/index.html with the cache disabled (DevTools, Network, "Disable cache"), at 1440, 820, 375 and 320 wide, and scroll to Results.

## What the industry standards say, and what was followed

Sources: the [WAI-ARIA APG carousel pattern](https://www.w3.org/WAI/ARIA/apg/patterns/carousel/), the [W3C WAI carousel tutorial on animations](https://www.w3.org/WAI/tutorials/carousels/animations/), [Bootstrap 5.3 carousel](https://getbootstrap.com/docs/5.3/components/carousel/), WCAG 2.2 SC 2.2.2 (Pause, Stop, Hide), and common before/after slider components (CodyHouse, react-compare-slider, img-comparison-slider).

| Convention | Source | What we did |
|---|---|---|
| A visible control that stops and restarts automatic motion; same button, label changes with state, no `aria-pressed` | WCAG 2.2.2, APG, WAI tutorial | Pause/Play button. Its `aria-label` and icon change; the button is never replaced, so focus stays on it. |
| Rotation control first in the carousel's tab order | APG | Pause comes first in the control row. The handles come before it in the tab order, but keyboard focus on a handle already stops the motion. |
| Container `role="region"`, `aria-roledescription="carousel"`, a name without the word "carousel" | APG | `#baCarousel`, named "Before and after photos". |
| Slides: `role="group"`, `aria-roledescription="slide"`, labelled by position ("3 of 6") | APG | Each `figure.ba-slider`. |
| Slides wrapper `aria-live="off"` while rotating, `"polite"` otherwise | APG | `#baGrid` switches as the carousel starts and stops. |
| Previous and next as native buttons; they do not move focus | APG, Bootstrap | Chevron buttons below the photos, "Previous photos" / "Next photos". |
| Indicators: one button per stop, current one marked | Bootstrap (`aria-current="true"`), APG grouped picker | Dots in a `role="group"` labelled "Choose photos"; the current one has `aria-current="true"`. |
| Stop on hover, stop on keyboard focus | APG, WAI tutorial, Bootstrap `pause: "hover"` | Both, scoped to the photos (not the control row, so pressing Play while the mouse is on it still plays). |
| Restart only on explicit request | APG | Followed for **Pause**: only Play restarts it. For everything else the owner asked for a restart after idle or after scrolling away and back, which matches Bootstrap and the WAI tutorial (resume on mouse leave or focus leave). |
| Stop while the page is hidden | Bootstrap (Page Visibility API) | `visibilitychange`. |
| Wrap from last to first | Bootstrap `wrap: true` | Next on the last stop goes to the first. |
| Arrow keys step the carousel | Bootstrap `keyboard: true` | Left/Right/Home/End on the control row. On a handle the arrows move the handle, as on every comparison slider. |
| Reduced motion: no automatic motion | WCAG 2.3.3, Bootstrap | Starts paused with the Play icon, and the track's transition is off (the global reduced-motion rule). Play still works if the visitor asks for it. |
| Comparison slider: a native range input (role slider), keyboard arrows move it, drag anywhere on the photo | before/after components | Unchanged from before: `.ba-range` over the photo. |
| Hide off-screen slides from assistive tech | WAI tutorial | Cards out of view are `inert` and `aria-hidden`, so their handles are not in the tab order either. |

Swiping the carousel on a phone is **not** supported: a sideways drag on the photo is the before/after handle, which is what the photo is for. The chevrons and dots move the carousel instead.

## Timings (constants at the top of the carousel in `js/gallery.js`)

| Step | Time | Why |
|---|---|---|
| Handle from the middle to the right edge (whole **before**) | 1.2 s | Slow enough to follow, fast enough not to feel like waiting. |
| Look at the before | 1.6 s | Enough to take in the state of the car, which is a glance, not reading. |
| Wipe across to the left edge (whole **after**) | 2.8 s | The reveal is the point. At about a third of the photo per second the eye can follow the line and compare each part as it changes. |
| Look at the after | 2.4 s | The longest hold: it is the result we want remembered. |
| Back to the middle | 1.0 s | Leaves the card the way a visitor expects to find it. |
| Pause, then the slide to the next card | 0.4 s + 0.7 s | The track's own transition is 0.6 s. |
| **Per comparison** | **about 9 s** | Common carousel guidance is 5 to 10 s a slide (Bootstrap's default is 5 s). A comparison is two pictures and a movement, so it sits near the top of that range. |
| A full cycle of the 6 pairs | about 56 s | |
| Restart after the visitor stops touching it | 12 s | Long enough to study a photo they stopped on, short enough that it is moving again by the time they look back. |

The handle moves from the middle to the right first (whole before), then wipes leftwards to show the whole after. Before then after is the story the customer should see. Because Before is on the left in our layout, the reveal travels right to left.

## Changes

| # | Change | Where | How to test |
|---|---|---|---|
| 1 | Removed the subheading "Real details from around Cincinnati. Drag the slider on any photo..." | `index.html` `#gallery .section-head` | The section starts with "Our Work" and the heading only. |
| 2 | The grid of cards is now a carousel track: one card in view on phones, two from 820 px, three from 1100 px. It moves by one card. A third of the container is 310 to 330 px, about the size of a phone's card. | `index.html` `#baCarousel` / `.ba-viewport` / `#baGrid.ba-track`; `styles.css` `.ba-viewport`, `.ba-track` (`--ba-per`, `--ba-gap`), 820 px block, new 1100 px rule; `js/gallery.js` `carousel()` | At 1440: 3 cards, 4 dots. At 820: 2 cards, 5 dots. At 375 and 320: 1 card, 6 dots. Resize across 820 and 1100: the dots and cards follow. |
| 3 | Automatic sweep and advance. Each card that comes into view sweeps in turn, then the track moves one card along and the newly arrived card sweeps. On the first view all visible cards sweep, left to right. | `js/gallery.js` `loop()`, `sweep()`, `animate()` | Scroll to Results and leave it: the first card shows its whole before, wipes to the whole after, returns to the middle; then the next one does. |
| 4 | Pause/Play, previous/next, dots, arrow keys. | `js/gallery.js` (controls built with the cards); `styles.css` `.ba-controls`, `.ba-ctl`, `.ba-dots`, `.ba-dot` | Click each. Pause: nothing moves for as long as you wait, even after scrolling away and back. Play: it starts again at once. Tab to the next chevron, then press Right, Left, Home, End. |
| 5 | Taking over: pressing a chevron, a dot or the photo (dragging the handle), typing on a handle, a mouse moving over the photos, or keyboard focus on a handle stops the motion. The handle stays where it is. It starts again 12 s after the last touch (and after the mouse leaves the photos or focus leaves the handles), or when the carousel has been scrolled out of view and back. | `js/gallery.js` `interact()`, `update()`, IntersectionObserver | Drag a handle, keep the mouse there: nothing moves. Move the mouse away: it picks up 12 s later. Or scroll to the top and back: it picks up at once. |
| 6 | Paused while the tab is hidden, and while the carousel is less than 35% on screen. Nothing animates off screen. | `js/gallery.js` | Switch tabs mid-sweep: the handle stops; it continues when you come back. |
| 7 | Reduced motion: starts paused (Play icon), no auto sweep or advance, no track slide. | `js/gallery.js` `playing = !reduce.matches`; global reduced-motion rule | DevTools, Rendering, "prefers-reduced-motion: reduce", reload. |
| 8 | Images: still lazy. The first card is eager as before (`i === 0`). The carousel switches a card's images to eager only when it is about to show it (the cards in view plus one ahead), and waits up to 4 s for a card's photos before sweeping it. `sizes` now says 340px from 1100 px. | `js/gallery.js` `photo()`, `SIZES`, `wake()`, `ready()` | Network panel, throttled: at load only the first card's photos (and on wide screens the other visible cards') are fetched. |
| 9 | The cards lost their own `.reveal` fade; the carousel as a whole fades up instead. | `js/gallery.js` `card()`; `index.html` `#baCarousel.reveal` | The section fades in once, as one block. |

## Root causes (things that would have gone wrong)

- **Per-card `.reveal` in a carousel.** `.reveal` stays invisible until IntersectionObserver sees the element in the viewport. A card parked off to the side of a clipped track never intersects, so it would have slid in invisible and then faded up late. The fade belongs on the carousel, not on its cards.
- **Hover from a parked cursor.** Chrome fires pointer events when the page scrolls under a cursor that is not moving. A plain `mouseenter` pause would stop the carousel for anyone who scrolls with the mouse in the middle of the screen, so it would almost never play on desktop. Hover only counts with real movement (`movementX`/`movementY`).
- **Focus from a click.** Clicking a chevron leaves focus on it. If focus inside the carousel paused it until focus left, one click would stop it for good. Focus only holds it when it is keyboard focus (`:focus-visible`) on a handle; clicks hold it through the idle timer instead.
- **Lazy images in a sideways track.** A card that is off to the side is not near the viewport, so `loading="lazy"` would not fetch it until it was already sliding in: a grey card. The carousel sets the next card's images to eager just before it is needed, and waits for the photos before sweeping.
- **Clipping the track without clipping the shadows.** `overflow: hidden` on the track's viewport would cut off the cards' drop shadows at the bottom. `overflow-x: clip; overflow-y: visible` clips sideways only (with `overflow: hidden` first for browsers without `clip`). A track moved by `transform` inside a clip can never scroll the page sideways.

## Verified

- `npm run build`: OK. `cd web && TZ=America/New_York npx vitest run`: 409 of 409 pass, including the gallery lazy-loading checks (`loading="lazy"`, `i === 0`).
- Headless Chrome over CDP, `dist/` on :8792, cache disabled, real mouse and key events, at 1440, 820, 375 and 320 px:
  - `scrollWidth === innerWidth`, `visualViewport.offsetTop` 0, at every width, before and after the track has moved.
  - A nav click on Results (header link, or the phone menu) lands with `#gallery` at 73 px, exactly under the 73 px header.
  - Auto: the first card goes to 100 (whole before), holds, wipes to 0 (whole after), holds, returns to 50, then the next visible card does the same. Then the track moves one card along and only the new card sweeps. About 9 s per card, as designed.
  - Chevrons, dot 4, arrow keys and Home: the track moves, `aria-current` follows, `aria-live` becomes `polite`, nothing moves for 12 s, then the sweep starts again with `aria-live="off"`.
  - Pause: Play label, nothing moves after 14 s, or after scrolling away and back. Play: it starts at once.
  - Drag: the handle follows the mouse, the sweep stops; with the mouse still on the photo nothing moves for 14 s; after scrolling away and back it sweeps again from where the handle was left.
  - Tab hidden: stops; visible again: continues.
  - Reduced motion: Play label, no movement in 4 s.
  - Scrolling the page under a parked cursor did not pause it. Headless Chrome may not send the hover events a desktop Chrome does on scroll, so this one is worth a look by hand: park the mouse mid-screen and scroll to Results with the wheel. It should keep playing.
- Screenshots at each width: the controls fit on one row at 320 px (276 of 280 px), and the cards keep their existing look.

The build rewrites `?v=` stamps in every page because `styles.css` changed. They are kept in this commit, so no page loads a stale stylesheet. On merge conflicts in stamps, take either side and rebuild.

## For the owner

- **Cards in view:** 1 on phones, 2 from 820 px, 3 from 1100 px. Three is the most that fit while each card stays as wide as a phone's.
- **Timings:** about 9 s per comparison, 12 s idle before it restarts. All in one place at the top of the carousel code if they should be faster or slower.
- **Sweep direction:** whole before first, then the wipe to the whole after (right to left, because Before is on the left). If you meant a literal left-to-right sweep, it would end on the before photo.
- **On phones:** Nielsen Norman Group advises against auto-advancing carousels on phones, because people scroll past before they read them. It is on, as requested, and it only runs while the carousel is on screen.
- **No swipe to change cards on phones**, because a sideways drag on the photo moves the before/after handle. Chevrons and dots change cards.
- **"Drag the slider" hint removed** with the subheading. The handle's arrows and the automatic sweep show what the photo does.

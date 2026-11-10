# Session changes: Results ("Our Work") carousel

Branch: `claude/results-carousel-347a0d`. Not pushed.
Files: `index.html` (`#gallery` only), `js/gallery.js`, `styles.css` (gallery block, plus one gallery-only line in the 820px block and a 1100px rule after it). `script.js` is unchanged: the carousel drives the existing slider markup.

**Round 2 (the owner's review of c2fa121, and the user's request for an endless loop) is first. Round 1 follows; where round 2 changed something, round 1 says "superseded".**

# Round 2

Merged `eNov6` first (text-wrap rules, `contact.html`, new lessons).

## Changes

| # | Owner's request | Change | Where | How to test |
|---|---|---|---|---|
| R1 | Hover alone must not stop it | The hover pause is gone. Clicking or dragging a photo, a chevron, a dot, typing on a handle, or keyboard focus on a handle still take over. | `js/gallery.js` listeners under "when it runs" | Move the mouse around over the photos: it keeps going. Click a photo: it stops. |
| R2 | The button shows an automatic pause | The play button is the state (`playing`). A touch sets it to paused, so it shows Play at once. Paused by a touch (`byTouch`), it plays again by itself 12 s after the last touch, or when the carousel has been scrolled out of view and back, and the button flips back to Pause, already while it is out of view. **Play always plays now**, whatever paused it. Pressing Pause yourself is never undone automatically. | `js/gallery.js` `touch()`, `resumeLater()`, `update()`, IntersectionObserver | Click a photo: Play icon. Wait 12 s: Pause icon and it moves. Click a chevron, then press Play: it moves at once. Press Pause, wait, scroll away and back: still paused. |
| R3 | All visible cards sweep together | Every card in view runs the same sweep at the same time, then the track moves on by a whole view (3 cards at 1440, 2 at 820, 1 on a phone), so no card is swept twice in a row. Chevrons still move one card at a time. | `js/gallery.js` `sweep()` | At 1440 the three handles move as one; then three new cards slide in. |
| R4 | Smoother motion | One `requestAnimationFrame` loop reads a fixed timeline: no timers between phases, no waiting for photos in the middle of a run. Ease in-out **cubic**. The handle, the before photo's edge and the divider move by `transform`; tags and the handle fade by `opacity`. Per frame only a CSS variable is written. The range input catches up when a handle comes to rest. | `js/gallery.js` `SWEEP`, `tick()`, `sweep()`, `paint()`; `styles.css` `.ba-before-layer`, `.ba-divider` | See "Frame times" below. |
| R5 | Orphaned Instagram button | Now a small text link (Instagram icon, "See more on Instagram") in the carousel's control row: at the right end of the row from 820 px, centred under the controls on a phone. The link stays in the page's markup for when there are no photos; `js/gallery.js` moves it into the row. Not red: red on this site is the Book button, and a second red button would compete with it. | `index.html` `.gal-foot`; `styles.css` `.ba-controls`, `.ba-nav`, `.ba-insta` | At 1440 the link's right edge lines up with the right card (1246 px). At 375 it sits 43 px under the controls. |
| R6 | Trim the vertical whitespace | The gallery's own padding is `clamp(32px, 4vw, 56px)` (was the shared 40 to 72 px), and the Instagram row is gone. | `styles.css` `.gallery` | See the measurements below. |
| R7 | A handle left at the edge | While the carousel moves a handle (`.auto`), the label for the side that is not showing fades out, and the handle fades out within 8% of either edge. At "whole after" you see the after photo and the After label, nothing else. When the motion stops, every handle the carousel moved glides back to the middle (0.45 s); a handle you moved stays where you put it. | `styles.css` `.ba-slider.auto ...`; `js/gallery.js` `halt()`, `settle()` | Pause it during the wipe: handles glide back to the middle. Drag one: that one stays. |
| L | (user) Loop without an end, like the usual infinite carousels | Past the last comparison it carries on forward into the first, and Previous on the first carries on back to the last, instead of racing back across all of them. The cards that slid out at one end are moved to the other end of the track while out of view, then the track resets without a transition, so nothing on screen moves. No copies of the cards. Dots are now one per comparison (6), and a dot takes the shortest way round. | `js/gallery.js` `move()`, `goTo()` | Click dot 6, then Next: card 1 slides in from the right. Previous: card 6 comes back from the left. |

## Loop: what the libraries do

- **Swiper (v9 on)**: loop mode moves the existing slides from one end to the other instead of cloning them, and needs at least twice as many slides as are in view ([migration guide v9](https://swiperjs.com/migration-guide-v9)).
- **Embla**: loops by repositioning slides with transforms, no clones, turns looping off when there are not enough slides, and seeks the closest way to a target.
- **Slick, older Swiper**: clone slides at both ends. Clones would duplicate every photo and every handle (a second, focusable "Compare before and after" for each), so not that.

We follow Swiper and Embla: rearrange, no clones, shortest way to a dot. With 6 comparisons and 3 in view we have exactly the twice-as-many it needs. If a page is ever left with too few (say 4 photos at 3 in view), a move that cannot slide jumps instead, and with no more photos than fit in view, the arrows and dots hide.

## Timings now

| Step | Time |
|---|---|
| Handle from wherever it is to the right edge (whole before) | 1.2 s |
| Look at the before | 1.6 s |
| Wipe to the left edge (whole after) | 2.8 s |
| Look at the after | 2.4 s |
| Back to the middle, short rest | 1.0 s + 0.3 s |
| Slide to the next view | 0.6 s |
| **Per view** | **about 9.9 s**: every card in view at once |
| Full cycle of 6 | about 20 s at 1440 (2 views), 30 s at 820 (3), 59 s on a phone (6) |
| Restart after the last touch | 12 s |

## Root causes

**The jitter and the strange pauses** came from four things:

1. **The hover pause.** Any mouse movement over the photos stopped the sweep mid-motion, and leaving them started a 12 s hold. For a mouse user, the carousel kept freezing and restarting for no visible reason.
2. **Gaps between phases.** Each move and hold was its own `setTimeout` or promise, with a 0.4 s timer between cards and another for the slide. Timers do not fire on frame boundaries, so each phase started on whichever frame came next, a little late and unevenly. On wide screens the cards also swept one after another, so two of the three sat still for about 18 s.
3. **Waiting for photos mid-run.** Before each card's sweep, the code waited up to 4 s for its photos. The card had already slid in, so it sat still, then started. Now the next view's photos are asked for a whole sweep ahead (about 10 s), and the only wait (1.5 s at most) is at the start of a view, with every handle at rest.
4. **Layout and repaint every frame.** The divider moved by `left` (layout), the before photo was cut by `clip-path` (repaint of the photo), and the range input's value was written every frame (layout of the input). Now it is all `transform` and `opacity`, which the compositor moves without layout or repaint.

**The handle at the far left edge (R7):** at "whole after" the handle sat at 0% for 2.4 s. The stage clips it, so only half the knob (one chevron) showed, and the Before label sat on top of the after photo. Interrupting the sweep also left handles wherever they were (a card at 3% in the round 1 test).

**The whitespace (R6)**, measured from the section's top edge to the bottom of its content:

| Width | Before: section height | After | Top: edge to "Our Work" before / after | Bottom: last item to edge before / after |
|---|---|---|---|---|
| 1920 | 714 | 576 | 80 / 64 | 72 / 56 |
| 1440 | 714 | 576 | 80 / 64 | 72 / 56 |
| 1280 | 698 | 567 | 72 / 59 | 64 / 51 |
| 820 | 646 | 524 | 49 / 40 | 41 / 33 |
| 375 | 624 | 546 | 47 / 39 | 40 / 32 |

The causes, in order of size:
- The Instagram button had a row of its own: 40 px of margin plus a 62 px button (102 px).
- The shared section padding (72 px at 1440) is followed by the Services band's own 72 px top padding. The two bands are white and near-white (`--paper-2` and `--paper`), so it reads as one gap of about 150 px. That gap is now 128 px.
- Above "Our Work", the 72 px padding plus 8 px of line leading. The eyebrow is an inline-flex box in a line of body line-height, which adds 8 px above every section's eyebrow; that is site-wide and unchanged.
- Removing the subheading did not add space; it only left the head short, so the padding around it is more noticeable.
- The `text-wrap` rules change nothing here: the heading is one line at every width from 375 up.

## Frame times

Headless Chrome, CPU throttled 4× (about a mid-range phone), 12 s of the automatic sweep:

| | Frames | p50 | p95 | p99 | Longest | Over 20 ms |
|---|---|---|---|---|---|---|
| Before, 1440 | 710 | 16.7 | 16.7 | 16.8 | **200 ms** | 1 |
| Before, 375 | 715 | 16.7 | 16.8 | 16.8 | **133 ms** | 1 |
| After, 1440 | 721 | 16.7 | 16.7 | 16.8 | 16.8 ms | 0 |
| After, 375 | 721 | 16.7 | 16.7 | 16.8 | 16.8 ms | 0 |

Headless rendering uses software paint, so it under-states paint costs on a real phone, which is where moving off layout and repaint helps most.

## Verified (round 2)

- `npm run build` OK; `cd web && TZ=America/New_York npx vitest run`: 409 of 409.
- Headless Chrome over CDP, cache disabled, real mouse and key events, at 1920, 1440, 1280, 820, 375 and 320:
  - `scrollWidth === innerWidth` and `visualViewport.offsetTop` 0 at every width;
  - the nav click on Results lands `#gallery` at 73 px, under the 73 px header;
  - moving the mouse over the photos: still Pause, still moving;
  - all visible cards hold the same position through the sweep (100, 0, 50 together), then the next view slides in, forward, and after the last view the first comes round again, still forward;
  - at 1440 and 375:
    - a click on a photo shows Play and the other cards glide to 50;
    - 12 s later it shows Pause and sweeps;
    - after a drag the card stays at 15% and the button shows Play; scrolled out of view the button already shows Pause, and back in view all handles converge on the right edge together;
    - Next from 6 slides card 1 in from the right, and Previous from 1 brings card 6 in from the left; the largest jump between two frames is 28 px, the slide itself, with no jump when the cards are rearranged;
    - Right arrow and End on the controls move it;
    - Play after a touch pause plays at once; Pause stays through 13 s and through scrolling away and back;
    - a hidden tab stops it and showing the tab continues it;
    - under reduced motion it shows Play and nothing moves.
- Screenshots: at whole before and whole after, no stray handle and only the matching label (1440, 375). Controls fit at 320 (276 of 280 px).

## For the owner (round 2)

- **Auto-advance moves a whole view.** At 1440 that's three new photos every 10 s. The chevrons still step one photo at a time.
- **Instagram is a text link, not a red button.** Red is the Book button's colour, and a second red button in the middle of the page would compete with it. Easy to swap for `btn btn-primary` if you would rather.
- **Section padding is tighter for this section only** (56 px at 1440). The Services band below still has 72 px above its heading. The extra 8 px above every eyebrow is site-wide and was left alone.

# Round 1

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
| Stop on hover, stop on keyboard focus | APG, WAI tutorial, Bootstrap `pause: "hover"` | Superseded in round 2: the owner found the hover pause non-intuitive, so only keyboard focus on a handle, clicks and drags stop it. |
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
| 3 | (Superseded in round 2: all visible cards now sweep together.) Automatic sweep and advance. Each card that comes into view sweeps in turn, then the track moves one card along and the newly arrived card sweeps. On the first view all visible cards sweep, left to right. | `js/gallery.js` `loop()`, `sweep()`, `animate()` | Scroll to Results and leave it: the first card shows its whole before, wipes to the whole after, returns to the middle; then the next one does. |
| 4 | Pause/Play, previous/next, dots, arrow keys. | `js/gallery.js` (controls built with the cards); `styles.css` `.ba-controls`, `.ba-ctl`, `.ba-dots`, `.ba-dot` | Click each. Pause: nothing moves for as long as you wait, even after scrolling away and back. Play: it starts again at once. Tab to the next chevron, then press Right, Left, Home, End. |
| 5 | (Superseded in round 2: no hover pause; the button shows Play when a touch pauses it.) Taking over: pressing a chevron, a dot or the photo (dragging the handle), typing on a handle, a mouse moving over the photos, or keyboard focus on a handle stops the motion. The handle stays where it is. It starts again 12 s after the last touch (and after the mouse leaves the photos or focus leaves the handles), or when the carousel has been scrolled out of view and back. | `js/gallery.js` `interact()`, `update()`, IntersectionObserver | Drag a handle, keep the mouse there: nothing moves. Move the mouse away: it picks up 12 s later. Or scroll to the top and back: it picks up at once. |
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

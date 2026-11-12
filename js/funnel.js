/* ============================================================
   513 Auto Clean, booking funnel

   Pricing comes from window.ACPricing (js/pricing.bundle.js), the same
   TypeScript engine the unit tests cover. Nothing here recomputes money.

   Mounts either as a modal over the page (index.html) or full width
   (book.html). Same code, same markup, one difference in chrome.
   ============================================================ */
(function () {
  'use strict';

  var P = window.ACPricing;
  if (!P) return;

  var CFG = window.AC_CONFIG || {};
  var RULES = P.RULES;
  var $ = P.formatCents;

  var WEB3FORMS_KEY = '8a502fe3-2a53-4904-98e9-b18dabb1f579';

  /** Everything we can take standing in a driveway. From capabilities.ts. */
  var IN_PERSON = P.IN_PERSON;
  var DAY = 86400000;

  /* ================= state ================= */

  function newVehicle() {
    return {
      size: null, intent: null, packageIds: [], addons: [], label: '',
      correctionTier: null, coatingTerm: '3yr', noGarage: false
    };
  }

  var state = null;

  function reset() {
    state = {
      step: 0,
      vehicles: [newVehicle()],
      active: 0,
      address: { line1: '', city: '', region: 'OH', zip: '' },
      noGoodLocation: false,
      // A garage or covered spot to work in (optional tick box on Where):
      // lifts the rain and sun weather limits, never the cold.
      covered: false,
      locationNote: '',
      priority: false,
      slot: null,
      // The time step: our recommended times first; showAll is the whole
      // week calendar behind "See additional times". weekStart is the Sunday
      // on screen, weekDay the day open on a phone.
      showAll: false,
      weekStart: 0,
      weekDay: -1,
      // The early and late starts, opened from their folds.
      wkEarly: false,
      wkLate: false,
      weekTouched: false,
      // Who the chosen time is booked with: a DETAILERS id, or 'owner'.
      detailer: 'owner',
      contact: { name: '', phone: '', email: '' },
      consent: { terms: null, sms: null, media: null },
      payInFull: false,
      // The card-on-file authorization, ticked in words the customer read.
      // The server refuses to save a card without it.
      mandate: false,
      turnstileToken: null,
      // As typed. The engine decides what it is worth, here and again on the
      // server, so this is never a discount amount.
      // Measured drive time, once the address is complete enough to route
      // from. Until then the ZIP band estimate stands in.
      travel: blankTravel(),
      // When no slot can be offered, the customer says roughly when suits
      // and this becomes a request rather than a confirmed booking.
      // Services someone wants but cannot book yet. Rides along with
      // whatever they DO book, so Elijah learns the demand for the things he
      // has not launched instead of guessing at it.
      interest: [],
      prefer: { parts: [], days: [] },
      // "Where did you hear about us?", optional, on the checkout.
      heard: '',
      // The checkout's sections: which is open, and which are done.
      ckOpen: '',
      ckDone: {},
      // What we need to know before loading the van. Asked on the last step
      // rather than promised as "a few quick questions" in a list of things
      // that will happen later, which is how it used to read and meant
      // turning up to find a locked gate and no outdoor tap.
      access: { water: null, power: null, parking: '' },
      // Set when the funnel was opened from a shared quote link.
      quotedSlot: null,
      promoCode: '',
      // True while the "are you sure" panel is up.
      leaving: false,
      // True when this session was restored from a saved draft, so the page
      // can say so rather than silently remembering a stranger's answers.
      resumed: false,
      notes: '',
      // "Help me decide". No package, no price, no time: a request for a
      // recommendation that travels down the same funnel as everything else,
      // because sending somebody to a separate contact form loses most of
      // them. It skips the three steps that only make sense once you know
      // what you want.
      advice: false,
      /*
       * Which way they are choosing a time: 'slots' is the calendar, 'ask'
       * is telling us the days that could work and letting us come back.
       *
       * A mode, not a hidden panel, because the two are different answers to
       * the same question and only one of them can be true. Picking a day in
       * 'ask' clears any slot, which is what makes the answer unambiguous.
       */
      timeMode: 'slots',
      // Set when the payment form could not load, whatever the reason. The
      // card section removes itself and stops being a requirement.
      cardUnavailable: false,
      // The slot we last confirmed with the calendar. Cleared whenever the
      // chosen time changes, so a new choice is checked afresh.
      checkedSlot: null,
      // How long the job was when the time was picked, and why a time had to
      // be dropped (slotStillFits). Shown at the top of Time.
      slotDur: 0,
      whenNote: '',
      // Review rows opened by the customer (revRow).
      revOpen: {},
      sending: false,
      done: false,
      browse: false,
      browseQ: '',
      browseMax: null,
      browseFilters: {},
      browseSort: 'price',
      // On by default, and on top of whichever sort is chosen (owner,
      // November 10): packages, then add-ons, each in that order.
      browsePkgFirst: true,
      separateTimes: false,
      payMethod: 'card',
      payState: null
    };
  }
  reset();

  /* ================= steps ================= */
  /* `auto` means a single click both records the answer and moves on, so the
     common path never needs the Continue button. */

  var STEPS = [
    { id: 'size',     tab: 'Vehicle',  title: 'How big is your vehicle?',  auto: true,  render: rSize,    valid: vSize,    sum: sSize },
    { id: 'intent',   tab: 'Service',  title: 'What does it need?',        auto: true,  render: rIntent,  valid: vIntent,  sum: sIntent },
    { id: 'package',  tab: 'Package',  title: 'Choose your package',       auto: true,  render: rPackage, valid: vPackage, sum: sPackage, skip: advising },
    { id: 'addons',   tab: 'Extras',   title: 'Anything extra?',           auto: false, render: rAddons,  valid: vAddons,  sum: sAddons,  skip: advising },
    // No Vehicles step: adding a second vehicle is one line on Extras.
    // WHERE BEFORE TIME (owner, November 10): the times offered depend on the
    // drive there and the weather at that address, so the address comes first.
    // The fee is measured again for the time picked, because traffic matters.
    { id: 'location', tab: 'Where',    title: 'Where are we detailing?',   auto: false, render: rLoc,     valid: vLoc },
    // Not auto as a step: the calendar view needs Continue. Our recommended
    // times (and the chips in the summary) do move on when tapped.
    { id: 'time',     tab: 'Time',     title: 'Pick your time',            auto: false, render: rTime,    valid: vTime },
    { id: 'contact',  tab: 'Accept',   title: 'Your details, and what you agree to', auto: false, render: rDetails, valid: vContact },
    { id: 'pay',      tab: 'Checkout', title: 'Checkout',                  auto: false, render: rPay,     valid: vPay,
      sub: 'A few details and you are booked. Nothing is charged today.' }
  ];

  /*
   * TWO PAGES (owner, November 10, round 15).
   *
   * Vehicle, Service, Package and Extras are one page that grows as it is
   * answered: each answered question folds to a one-line summary and the next
   * slides up under it. Where, Time, Accept and Confirm are one checkout page,
   * laid out like a product checkout: your details first (so an unfinished
   * booking can be followed up), then where, when, the yeses, and the total.
   *
   * The steps themselves are unchanged underneath: the same renders, the same
   * validators, the same order. A checkout step is always shown as the
   * checkout page, which lives at the last index (state.step === LAST).
   */
  var CHECKOUT_IDS = ['location', 'time', 'contact', 'pay'];
  var LAST = STEPS.length - 1;
  function indexOfStep(id) { for (var i = 0; i < STEPS.length; i++) if (STEPS[i].id === id) return i; return -1; }
  var LOC_I = indexOfStep('location');
  function inCheckout(i) { return i >= 0 && i < STEPS.length && CHECKOUT_IDS.indexOf(STEPS[i].id) > -1; }
  function onCheckout() { return inCheckout(state.step); }

  /** True while the customer has asked us to pick the package for them. */
  function advising() { return state.advice; }

  /* Short summaries under each tab, so someone can see at a glance what they
     already answered and jump straight back to it. */
  function sSize() { var z = veh().size ? P.vehicleSize(veh().size) : null; return z ? z.label : ''; }
  function sIntent() {
    if (state.advice) return 'Help me decide';
    var i = veh().intent;
    return i === 'both' ? 'Inside and out' : i ? i.charAt(0).toUpperCase() + i.slice(1) : '';
  }
  function sPackage() {
    var names = veh().packageIds.map(function (id) { return (P.findPackage(id) || {}).name; }).filter(Boolean);
    return names.join(' + ');
  }
  function sAddons() {
    var n = state.vehicles.reduce(function (t, v) { return t + v.addons.length; }, 0);
    return n ? n + ' added' : 'None';
  }
  function sPay() { return $(q().totalCents); }

  /** "50%", "10%". Basis points are for the engine, not for a customer. */
  function pctOf(bp) { return (bp / 100) + '%'; }

  function step() { return STEPS[state.step]; }
  function veh() { return state.vehicles[state.active]; }

  /* ================= cart ================= */

  function addonRef(a) {
    var def = P.findAddon(a.addonId);
    if (!def) return null;
    var tier = def.tiers.filter(function (t) { return t.id === a.tierId; })[0];
    if (!tier || tier.priceCents === null) return null;
    return {
      id: def.id, name: def.name, tierId: tier.id, tierLabel: tier.label,
      priceCents: tier.priceCents, durationMin: tier.durationMin
    };
  }

  /** The chosen correction tier, priced from the catalog. */
  function correctionRef(v) {
    if (!v.correctionTier) return undefined;
    var tier = P.findCorrectionTier(v.correctionTier);
    var term = P.findCoatingTerm(v.coatingTerm) || P.COATING_TERMS[0];
    if (!tier) return undefined;
    var ref = {
      tierId: tier.id, tierLabel: tier.label,
      addCents: tier.addCents, addMin: tier.addMin,
      coatingId: term.id, coatingLabel: term.label, coatingAddCents: term.addCents
    };
    if (v.noGarage) ref.canopyCents = P.CORRECTION_RULES.canopyCents;
    return ref;
  }

  /** True when any vehicle in the booking needs correction scheduling rules. */
  function hasCorrection() {
    return state.vehicles.some(function (v) { return Boolean(v.correctionTier); });
  }

  function cart() {
    return {
      vehicles: state.vehicles.map(function (v) {
        var size = v.size ? P.vehicleSize(v.size) : null;
        return {
          label: v.label || 'Vehicle',
          sizeUpchargeCents: size ? size.upchargeCents : 0,
          sizeExtraMin: size ? size.extraMin : 0,
          sizeLabel: size ? size.label : '',
          packages: v.packageIds.map(function (id) {
            var p = P.findPackage(id);
            return {
              id: p.id, name: p.name, category: p.category,
              priceCents: p.priceCents, durationMin: p.durationMin
            };
          }),
          addons: v.addons.map(addonRef).filter(Boolean),
          correction: correctionRef(v)
        };
      }),
      // Priced from the ZIP band via the SAME estimator the payment function
      // uses, so what is shown is what gets charged. A real address lookup
      // replaces this at confirmation.
      // Measured beats estimated. The server measures the same address again
      // before charging, so what is shown here is what gets billed.
      oneWayMinutes: state.travel.source === 'routes'
        ? state.travel.minutes
        : (state.address.zip ? P.estimateOneWayMinutes(state.address.zip) : null),
      surchargeContext: surchargeCtx(),
      zip: state.address.zip || null,
      payInFull: state.payInFull,
      promoCode: state.promoCode || null,
      visits: state.separateTimes ? state.vehicles.length : 1
    };
  }

  function surchargeCtx() {
    if (state.slot) {
      // Derived from the slot, never from the checkbox. The checkbox only
      // reveals nearer dates; whether a date is inside the lead window is a
      // fact about the calendar, and the server works it out the same way.
      return {
        startMinutesLocal: P.localMinutesOfDay(state.slot),
        priorityBooking: P.slotNeedsPriority(state.slot, Date.now(), rushWin()),
        timeOfDayWaived: timeFeeWaived(state.slot, state.detailer),
        blockFeeBp: blockFee(state.slot, state.detailer)
      };
    }
    if (state.priority) {
      // No slot yet but they have asked to see the rush days: show the
      // surcharge they are about to pick, so the number does not jump later.
      return { startMinutesLocal: P.minutesOfDay(12), priorityBooking: true };
    }
    return null;
  }

  function q() { return P.quote(cart(), RULES); }

  /** Showroom is priced from a floor, so its card has to say so. */
  /* ---------------- prices under a promo code ---------------- */

  /**
   * The live percentage off, or null.
   *
   * ONLY percentage codes strike prices through. A flat "$20 off" cannot be
   * shown against each line, because a quarter of it is not a quarter off
   * every package: the numbers on screen would stop adding up to the number
   * in the footer. Flat codes show their saving once, on the total.
   *
   * Cached per render because it is read once per package, add-on and tier,
   * and recomputing the promo lookup a few dozen times a paint is waste.
   */
  var _rate;

  function clearPromoRate() { _rate = undefined; }

  function promoRate() {
    if (_rate !== undefined) return _rate;
    _rate = null;
    if (state.promoCode) {
      var hit = P.findPromo(state.promoCode, { serviceCents: q().serviceSubtotalCents });
      if (hit.promo && hit.promo.percentBp) _rate = hit.promo.percentBp;
    }
    return _rate;
  }

  /**
   * A service price, struck through when a code is taking a slice off it.
   *
   * `$215` on its own, or `$215 $161.25` with the first one crossed out. The
   * point of the strike is that the discount is visible at the moment someone
   * is choosing, not discovered at checkout, which is where it does the least
   * good for them and for us.
   */
  function svc(cents, suffix) {
    var bp = promoRate();
    var tail = suffix || '';
    if (!bp || !cents || cents <= 0) return $(cents) + tail;
    var off = Math.round((cents * bp) / 10000);
    return '<s>' + $(cents) + tail + '</s> <span class="bk-cut">' + $(cents - off) + tail + '</span>';
  }

  /** The same, for a figure written as an addition: "+$50". */
  function svcPlus(cents) {
    var bp = promoRate();
    if (!bp || !cents || cents <= 0) return '+' + $(cents);
    var off = Math.round((cents * bp) / 10000);
    return '<s>+' + $(cents) + '</s> <span class="bk-cut">+' + $(cents - off) + '</span>';
  }

  function pkgPrice(p) { return svc(p.priceCents, p.pricePlus ? '+' : ''); }

  function pkgDuration(p) {
    return p.durationMaxMin
      ? fmtDur(p.durationMin) + ' to ' + fmtDur(p.durationMaxMin)
      : fmtDur(p.durationMin);
  }

  /**
   * Everything browsable, packages and add-ons together, flattened to one
   * shape so search and filters do not need two code paths.
   */
  function browseItems() {
    var out = [];
    P.packagesFor('interior').concat(P.packagesFor('exterior')).forEach(function (p) {
      if (p.requiresPriorDetail) return;
      out.push({
        kind: 'package', id: p.id, name: p.name, category: p.category,
        priceCents: p.priceCents, pricePlus: Boolean(p.pricePlus),
        durationMin: p.durationMin, tagline: p.tagline, featured: p.featured,
        note: p.note || '',
        detail: p.supersetOf
          ? 'Everything in ' + (P.findPackage(p.supersetOf) || {}).name + ', plus ' +
            P.componentsOf(p, P.CATALOG).map(function (c) { return c.name; })
              .slice(P.componentsOf(P.findPackage(p.supersetOf), P.CATALOG).length).join(', ')
          : P.componentsOf(p, P.CATALOG).map(function (c) { return c.name; }).join(', '),
        search: p.name + ' ' + p.tagline + ' ' + p.category + ' ' +
          P.componentsOf(p, P.CATALOG).map(function (c) { return c.name; }).join(' ')
      });
    });
    P.ADDONS.forEach(function (a) {
      var why = P.unavailableReason(a);
      if (why) {
        // Listed so the capability is visible, but not pickable. The price
        // still shows: the answer to "is this even in my range" should not
        // require sending a message.
        var pr0 = a.tiers.filter(function (t) { return t.priceCents !== null; });
        out.push({
          kind: 'addon', id: a.id, tierId: a.tiers[0].id, name: a.name,
          category: a.scope,
          priceCents: pr0.length ? pr0[0].priceCents : null,
          pricePlus: pr0.length > 1,
          durationMin: 0, tagline: a.description, featured: false,
          unavailable: why, detail: '',
          search: a.name + ' ' + a.description + ' ' + a.scope
        });
        return;
      }
      a.tiers.forEach(function (t) {
        if (t.priceCents === null) return;
        out.push({
          kind: 'addon', id: a.id, tierId: t.id,
          name: a.tiers.length > 1 ? a.name + ': ' + t.label : a.name,
          category: a.scope, priceCents: t.priceCents, pricePlus: false,
          durationMin: t.durationMin, tagline: a.description, featured: false,
          note: a.note || '', detail: t.description || '',
          search: a.name + ' ' + t.label + ' ' + a.description + ' ' + (t.description || '') + ' ' + a.scope
        });
      });
    });
    return out;
  }

  function totalDurationMin() { return q().serviceDurationMin; }

  /*
   * HOW LONG TO HOLD, which is not the same as how long the job is.
   *
   * On the "help me decide" path there is no package, so there is no
   * duration, so the slot finder has nothing to fit and would offer every
   * hour of every day. It holds a Full Interior's four hours instead: the
   * longest of the ordinary jobs, because holding too much costs us a slot
   * we might have sold and holding too little costs the NEXT customer their
   * appointment.
   *
   * P.ADVICE_HOLD_MIN is the same number the confirmation function ends the
   * calendar event with, so the block on the calendar is the block the
   * customer was offered.
   */
  function holdMinutes() { return totalDurationMin() || P.ADVICE_HOLD_MIN; }

  /* ================= dom ================= */

  var root = null, host = null;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function el(id) { return root.querySelector('#' + id); }

  /**
   * How far a customer is allowed to jump. Everything up to the furthest
   * step they have legitimately completed, so going back to change an answer
   * is one tap and going forward past an unanswered step is not possible.
   */
  function furthestValid() {
    for (var i = 0; i < STEPS.length; i++) {
      if (STEPS[i].valid()) return i;
    }
    return STEPS.length - 1;
  }

  /*
   * The top bar in two groups, the way a shop does it (owner, November 10:
   * "connect each step to things they already know"): YOUR DETAIL (Vehicle,
   * Service, Package, Extras) and CHECKOUT (Contact, Address, Time, Review).
   */
  function renderNav() {
    var reach = Math.max(state.step, furthestValid());
    var seg = function (attrs, label, sum, here, done, open) {
      return '<button type="button" class="bk-seg' + (here ? ' now' : '') + (done ? ' done' : '') + (open ? '' : ' locked') +
        '" ' + attrs + (open ? '' : ' disabled') + (here ? ' aria-current="step"' : '') + '>' +
        '<span class="bk-seg-t">' + esc(label) + '</span>' +
        (sum ? '<span class="bk-seg-s">' + esc(sum) + '</span>' : '') + '</button>';
    };
    var build = onCheckout()
      // At checkout the detail is one chip: what they are buying, and Edit
      // (owner, November 11: a top bar that takes less room at checkout).
      ? seg('data-step="' + lastBuildStep() + '"', detailChip(), (veh().size ? P.vehicleSize(veh().size).label + ' · ' : '') + 'Edit', false, true, true)
      : STEPS.map(function (st, i) {
          // A step that does not apply gets no tab.
          if (skipped(i) || inCheckout(i)) return '';
          return seg('data-step="' + i + '"', st.tab, st.sum ? st.sum() : '', i === state.step, i < reach && !st.valid(), i <= reach);
        }).join('');
    var openId = onCheckout() ? ckOpenId() : '';
    var ck = CK_TABS.map(function (t) {
      var first = t.secs[0];
      var target = t.tab === 'Review' && state.ckDone.agree ? 'review' : first;
      var canOpen = reach >= LOC_I && ckCanOpen(target);
      var done = Boolean(state.ckDone[first]);
      var c0 = CK[ckIndex(first)];
      // Nothing priced (Help me decide) shows no "$0".
      var sum = t.tab === 'Review' ? (q().totalCents > 0 ? sPay() : '') : done ? (c0.tabSum ? c0.tabSum() : c0.sum()) : '';
      return seg('data-cksec="' + target + '"', t.tab, sum, t.secs.indexOf(openId) > -1, done, canOpen);
    }).join('');
    // Back and close live in the header, and in the bar itself at checkout,
    // where the title row is gone and "Checkout" is the bar's own heading.
    // Put back first, so replacing the bar never takes them with it.
    var head = root.querySelector('.bk-head');
    var backBtn = el('bkBack'), closeBtn = el('bkClose');
    if (head && backBtn.parentNode !== head) head.insertBefore(backBtn, head.firstChild);
    if (head && closeBtn.parentNode !== head) head.appendChild(closeBtn);
    el('bkNav').innerHTML =
      '<div class="bk-navgrp"><span class="bk-navgrp-l">Your detail</span><div class="bk-navgrp-t">' + build + '</div></div>' +
      '<div class="bk-navgrp bk-navgrp-ck"><span class="bk-navgrp-l">Checkout</span><div class="bk-navgrp-t">' + ck + '</div></div>';
    root.querySelector('.bk-modal').classList.toggle('ck', onCheckout());
    root.querySelector('.bk-modal').classList.remove('is-done');
    if (onCheckout()) {
      el('bkNav').insertBefore(backBtn, el('bkNav').firstChild);
      el('bkNav').appendChild(closeBtn);
    }
    // Keep the active segment in view on a narrow screen.
    var now = el('bkNav').querySelector('.now');
    if (now && now.scrollIntoView) now.scrollIntoView({ block: 'nearest', inline: 'center' });
  }

  var BUILD_IDS = ['size', 'intent', 'package', 'addons'];

  /** The last first-page step that applies: where "Edit" from checkout lands. */
  function lastBuildStep() {
    var i = LOC_I - 1;
    while (i > 0 && skipped(i)) i--;
    return i;
  }
  /** "Basic Interior", "Full Interior + Basic Exterior", or "Help me decide". */
  /**
   * Render, then put keyboard focus back where it was: a re-render replaces
   * the button that had it, and focus fell to the page (final validation,
   * November 11: after Apply on a promo code, and after adding an extra).
   */
  function renderKeepFocus(sel, fallback) {
    render();
    var active = document.activeElement;
    if (active && active !== document.body && root.contains(active)) return;
    var e = root.querySelector(sel) || (fallback ? root.querySelector(fallback) : null);
    if (e && e.focus) e.focus({ preventScroll: true });
  }

  function detailChip() {
    if (state.advice) return 'Help me decide';
    // The first vehicle's detail, then "+1 vehicle" (final validation,
    // November 11: veh() is the active vehicle, so it showed the second one's).
    var names = state.vehicles[0].packageIds.map(function (id) { return (P.findPackage(id) || {}).name; }).filter(Boolean);
    var more = state.vehicles.length > 1 ? ' +' + (state.vehicles.length - 1) + ' vehicle' + (state.vehicles.length > 2 ? 's' : '') : '';
    return (names.join(' + ') || 'Your detail') + more;
  }

  function reducedMotion() {
    return Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  /**
   * The first page: each answered question as a one-line summary (tap to
   * change it), then the current question in full. `grew` slides it in.
   */
  /** The answer's picture, between the step's name and the answer (owner, November 11). */
  function doneIcon(id) {
    var v = veh();
    // The package's own picture says its level, so it no longer repeats
    // the Service row's (owner's pick B2, November 12).
    if (id === 'package' && !state.advice) {
      var lv = function (cat) { var p = v.packageIds.map(P.findPackage).filter(function (x) { return x && x.category === cat; })[0]; return p ? pkgLevel(p) : 0; };
      var inner = v.intent === 'both' ? levelPicBoth(lv('interior'), lv('exterior'))
        : v.intent === 'interior' || v.intent === 'exterior' ? levelPic(v.intent, lv(v.intent)) : '';
      if (inner) return '<i class="bk-donerow-ic">' + picSvg(inner) + '</i>';
    }
    var key = id === 'size' ? v.size
      : id === 'intent' || id === 'package' ? (state.advice ? 'ask' : v.intent)
      : id === 'addons' ? 'extras' : '';
    return key && PIC[key] ? '<i class="bk-donerow-ic">' + pic(key) + '</i>' : '';
  }

  function rBuild(grew) {
    var html = '';
    for (var i = 0; i < state.step; i++) {
      if (inCheckout(i) || skipped(i)) continue;
      var st = STEPS[i];
      html += '<button type="button" class="bk-donerow" data-step="' + i + '">' +
        '<span>' + esc(st.tab) + '</span>' + doneIcon(st.id) + '<b>' + esc(st.sum ? st.sum() : '') + '</b><em>Change</em></button>';
    }
    var s = step();
    return html + '<section class="bk-sec' + (grew ? ' bk-sec-in' : '') + '" data-sec="' + s.id + '">' +
      '<h3 class="bk-sec-h">' + esc(s.title) + '</h3>' + s.render() + '</section>';
  }

  /*
   * THE CHECKOUT AS FOLDING SECTIONS (owner, November 10, round 16: "mimic
   * the vehicle, service, package page"). Like a shop's checkout: Contact,
   * Address, Time, then the yeses and the review. One section is open at a
   * time, with its own Continue; a finished one folds to a line that opens
   * it again. Nothing to scroll for.
   */
  var CK = [
    { id: 'details', title: 'Your details', render: function () { return rDetails(); }, valid: function () { return vDetails(); }, all: lDetails,
      // The phone number never splits across the two summary lines.
      sum: function () { var c = state.contact; return [c.name, prettyPhone(c.phone).replace(/ /g, '\u00a0').replace(/-/g, '-\u2060'), c.email].filter(Boolean).join(' · '); },
      tabSum: function () { return state.contact.name.split(' ')[0]; } },
    { id: 'where', title: 'Where are we detailing?', render: function () { return rLoc(); }, valid: function () { return vLoc(); }, all: lLoc,
      sum: function () { var a = state.address; return [a.line1, a.city].filter(Boolean).join(', ') + (state.covered ? ' · covered spot' : ''); },
      tabSum: function () { return state.address.city || state.address.zip; } },
    { id: 'when', title: 'Pick your time', render: function () { return rTime(); }, valid: function () { return vTime(); },
      sum: function () {
        // With the hour we arrive in (owner, November 10: a 1 hour arrival
        // window, aimed at its start).
        // One format everywhere (checkout review, November 10): "10am to
        // 12pm" beside "arrive 10 to 11am" read as two different promises.
        if (state.slot) return whenLine(state.slot);
        return isInquiry() ? preferenceSummary() : '';
      },
      tabSum: function () { return state.slot ? tzDay(state.slot, { month: 'short', day: 'numeric' }) + ', ' + tzTime(state.slot) : isInquiry() ? 'Requested' : ''; } },
    { id: 'agree', title: 'Almost done', render: function () { return rAgree(); }, valid: function () { return vAgree(); }, all: lAgree,
      sum: function () {
        return 'Terms accepted · Recording: ' + (state.consent.media ? 'yes' : 'no') + (state.consent.sms ? ' · Texts on' : '');
      } },
    { id: 'review', title: 'Review and book', render: function () { return rPay(); }, valid: function () { return vPay(); }, sum: function () { return ''; } }
  ];
  /* The top bar's checkout tabs, in a shop's words (owner, November 10). */
  var CK_TABS = [
    { tab: 'Contact', secs: ['details'] },
    { tab: 'Address', secs: ['where'] },
    { tab: 'Time', secs: ['when'] },
    { tab: 'Review', secs: ['agree', 'review'] }
  ];
  var ckGrew = false;

  function ckIndex(id) { for (var i = 0; i < CK.length; i++) if (CK[i].id === id) return i; return -1; }
  /** A section can open once every section before it is done (or it is done). */
  function ckCanOpen(id) {
    var i = ckIndex(id);
    if (i < 0) return false;
    if (state.ckDone[id]) return true;
    for (var j = 0; j < i; j++) if (!state.ckDone[CK[j].id]) return false;
    return true;
  }
  /** The first section not done yet; the review once everything is. */
  function ckNextOpen() {
    for (var i = 0; i < CK.length - 1; i++) if (!state.ckDone[CK[i].id]) return CK[i].id;
    return 'review';
  }
  function ckOpenId() {
    if (!state.ckOpen || !ckCanOpen(state.ckOpen)) state.ckOpen = ckNextOpen();
    return state.ckOpen;
  }
  /**
   * Arriving with answers already in (a quote link, a resumed booking, back
   * from the first page): every section that is already complete folds, so
   * the open one is the first thing left to do.
   */
  function ckPrefill() {
    for (var i = 0; i < CK.length - 1; i++) {
      var c = CK[i];
      if (state.ckDone[c.id]) continue;
      if (c.valid()) break;
      state.ckDone[c.id] = true;
    }
    state.ckOpen = ckNextOpen();
  }
  function ckOpenSection(id) {
    if (!ckCanOpen(id)) return;
    // Leaving a section that was done but has since been changed into
    // something that does not work: say so here, rather than folding it to
    // a line like "Test Person · 555" and finding out at Confirm.
    var here = onCheckout() && state.ckOpen;
    if (here && here !== id && state.ckDone[here]) {
      var c0 = CK[ckIndex(here)];
      var bad = c0 && c0.all ? c0.all() : [];
      if (bad.length) { state.ckDone[here] = false; return showProblems(bad, here); }
    }
    state.step = LAST;
    state.ckOpen = id;
    ckGrew = true;
    track('checkout_open', { section: id });
    render();
  }
  /**
   * Whether the bar's Continue has nothing to do: Time with neither a time
   * nor a request yet. Every checkout section continues from the bar, the
   * same place as the build steps and Confirm (owner, November 12: an inline
   * Continue under a long section sat below the fold on laptops).
   */
  function ckNextIdle() {
    return ckOpenId() === 'when' && !state.slot && !isInquiry();
  }
  /**
   * A second, smaller Continue at the end of the open section (Emmett,
   * November 12), beside the bar's, for less mouse travel. One rule for every
   * section: shown only where the section comes to rest with the button at
   * least CKCONT_GAP above the bar. Then it is on screen (Round 20 removed the
   * old one because it sat below a laptop's fold) and it saves a reach (just
   * above the bar, the bar's own Continue is as close). It sits after the
   * section's last box, so on a phone, where the boxes stack, it comes after
   * all of them rather than between two.
   *
   * Decided when a section opens and again on a resize, never on scroll or
   * while typing: a button appearing mid-task would move the rows under it.
   * A resize needs CKCONT_HYST more to flip, so a window dragged near the
   * line does not flicker.
   *
   * Inside that spot (Emmett's option A, November 12): until the section's
   * required answers are in, a quiet line says what is still missing ("Add
   * your phone to continue"), from the section's own checks, the same ones
   * Continue runs; once they pass, the line becomes the button. The two share
   * one height, so nothing below moves. The swap happens when a box is left
   * or typing pauses (CKGO_PAUSE), never on every keystroke.
   */
  var CKCONT_GAP = 160, CKCONT_HYST = 24;
  var ckCont = { id: null, show: false };
  function slideShift(node) {
    try {
      var tf = getComputedStyle(node).transform;
      if (tf && tf !== 'none' && window.DOMMatrix) return new DOMMatrix(tf).m42;
    } catch (e) { /* no transform */ }
    return 0;
  }
  /**
   * Room left between the button and the bar once the form has scrolled
   * where render() will put it: `rest` is that scrollTop, or null for a
   * section that just opened under others (ckScroll() brings it up).
   */
  function ckContRoom(b, rest) {
    var sc = el('bkScroll'), sec = b.closest('.bk-ck'), wasHidden = b.hidden;
    b.hidden = false;
    var top = sc.getBoundingClientRect().top, shift = slideShift(sec);
    var at = function (y) { return sc.scrollTop + y - shift - top; };
    var btnBottom = at(b.getBoundingClientRect().bottom);
    if (rest === null) {
      // As ckScroll(): the top if the whole section fits, else the row
      // above it (or the section itself) up to the top.
      rest = 0;
      if (at(sec.getBoundingClientRect().bottom) > sc.clientHeight - 8) {
        var prev = sec.previousElementSibling;
        var anchor = prev && prev.classList && prev.classList.contains('bk-donerow') ? prev : sec;
        rest = at(anchor.getBoundingClientRect().top) + (anchor === sec ? 0 : shift) - 8;
      }
    }
    b.hidden = wasHidden;
    return sc.clientHeight - (btnBottom - rest);
  }
  function fitCkCont(resized, rest) {
    var b = el('bkBody') && el('bkBody').querySelector('.bk-ckgo');
    var sc = el('bkScroll');
    var sec = b && b.closest && b.closest('.bk-ck');
    if (!b || !b.getBoundingClientRect || !sec || !sec.getBoundingClientRect ||
        !sc || !sc.getBoundingClientRect) return;
    var id = b.querySelector('[data-ckcont]').dataset.ckcont;
    if (resized || ckCont.id !== id) {
      var need = !resized ? CKCONT_GAP : ckCont.show ? CKCONT_GAP - CKCONT_HYST : CKCONT_GAP + CKCONT_HYST;
      ckCont = { id: id, show: ckContRoom(b, rest === undefined ? sc.scrollTop : rest) >= need };
    }
    b.hidden = !ckCont.show;
    ckGoState(false);
  }

  /**
   * What the open section still needs, said as one short line, or '' when
   * it is ready. Read from the section's own list (lDetails, lLoc, lAgree),
   * so it can never disagree with what Continue would say.
   */
  var CK_SAY = {
    '#bkName': function (v) { return v.length > 80 ? ['shorten', 'your name'] : ['add', 'your name']; },
    '#bkPhone': function (v) { return v ? ['add', 'a full phone number'] : ['add', 'your phone']; },
    '#bkEmail': function () { return ['fix', 'your email']; },
    '#bkL1': function () { return ['add', 'your street']; },
    '#bkCity': function () { return ['add', 'your city']; },
    '#bkZip': function () { return ['add', 'your ZIP']; },
    '#bkTerms': function () { return ['tick', 'the terms box']; },
    '[data-media]': function () { return ['answer', 'the recording question']; }
  };
  function andList(xs) {
    return xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1];
  }
  function ckMissing(id) {
    if (id === 'when') return ckNextIdle() ? 'Pick a time to continue' : '';
    var c = CK[ckIndex(id)];
    if (!c) return '';
    var list = c.all ? c.all() : [asProblem(c.valid(), LAST)].filter(Boolean);
    if (!list.length) return '';
    var groups = [];
    list.forEach(function (p) {
      var f = p.focus && root.querySelector(p.focus);
      var say = CK_SAY[p.focus] ? CK_SAY[p.focus](f && f.value ? f.value.trim() : '') : ['answer', 'the questions above'];
      var g = groups.length && groups[groups.length - 1].verb === say[0] ? groups[groups.length - 1] : null;
      if (g) g.what.push(say[1].replace(/^your /, ''));
      else groups.push({ verb: say[0], what: [say[1]] });
    });
    var said = andList(groups.map(function (g) { return g.verb + ' ' + andList(g.what); }));
    return said.charAt(0).toUpperCase() + said.slice(1) + ' to continue';
  }
  /** Show the line or the button in the spot; `swap` fades in whichever just changed. */
  function ckGoState(swap) {
    var go = el('bkBody') && el('bkBody').querySelector('.bk-ckgo');
    if (!go || go.hidden) return;
    var hint = go.querySelector('.bk-ckhint'), btn = go.querySelector('.bk-ckcont');
    var span = hint && hint.querySelector('span');
    if (!btn || !span || !btn.dataset || !btn.dataset.ckcont) return;
    var text = ckMissing(btn.dataset.ckcont);
    if (span.textContent !== text && text) span.textContent = text;
    var ready = !text;
    // Visibility, not hidden: both keep their place, so the spot never
    // changes height, and the invisible one can be neither clicked nor focused.
    if (btn.classList.contains('bk-off') === !ready) return;
    btn.classList.toggle('bk-off', !ready);
    hint.classList.toggle('bk-off', ready);
    if (swap) {
      var now = ready ? btn : hint;
      now.classList.remove('bk-swap');
      void now.offsetWidth;
      now.classList.add('bk-swap');
    }
  }
  var CKGO_PAUSE = 600, ckGoTimer = null;

  /** Continue in a section: check it, fold it, and open the next one. */
  function ckAdvance(id) {
    var c = CK[ckIndex(id)];
    if (c.all) {
      var list = c.all();
      if (list.length) return showProblems(list, id);
    } else {
      var prob = asProblem(c.valid(), LAST);
      if (prob) { prob.sec = id; return showProblem(prob); }
    }
    state.ckDone[id] = true;
    track('checkout_section', { section: id });
    state.ckOpen = ckNextOpen();
    ckGrew = true;
    render();
  }

  function rCheckout(grew) {
    var open = ckOpenId();
    var html = '';
    CK.forEach(function (c) {
      if (c.id === open) {
        var note = c.id === 'when' && state.whenNote ? '<p class="bk-err bk-secnote" role="alert">' + esc(state.whenNote) + '</p>' : '';
        html += '<section class="bk-sec bk-ck' + (grew ? ' bk-sec-in' : '') + '" data-sec="' + c.id + '">' +
                    // "* Required" on the heading's line, not a line of its own above
          // the folded rows (owner, November 12: the travel fee sat below a
          // laptop's fold).
          '<p class="bk-reqnote"><span class="bk-req" aria-hidden="true">*</span> Required</p>' +
          '<h3 class="bk-sec-h" tabindex="-1">' + esc(c.title) + '</h3>' + note + c.render() +
          (c.id === 'review' ? '' : '<div class="bk-ckgo" hidden>' +
            '<p class="bk-ckhint">' + INFO_IC + '<span></span></p>' +
            '<button type="button" class="bk-ckcont bk-off" data-ckcont="' + c.id + '">Continue' + CHEV_R + '</button></div>') +
          '</section>';
      } else if (state.ckDone[c.id]) {
        html += '<button type="button" class="bk-donerow" data-cksec="' + c.id + '">' +
          '<span>' + esc(ckTabOf(c.id)) + '</span><b>' + esc(c.sum()) + '</b><em>Change</em></button>';
      }
    });
    return html;
  }
  /**
   * A chosen time that no longer fits: one already past (an old draft), or
   * one picked for a shorter job (an extra or a second vehicle added since).
   * Both used to stay folded as done until Confirm said, wrongly, that
   * someone else had booked it (checkout review, November 10).
   */
  var slotCheckFor = null;
  function dropSlot(note) {
    state.slot = null;
    state.checkedSlot = null;
    state.slotDur = 0;
    state.ckDone.when = false;
    state.ckOpen = 'when';
    state.whenNote = note;
    ckGrew = true;
  }
  function slotStillFits() {
    if (!state.slot) return;
    if (state.slot < Date.now()) return dropSlot('The time you picked has passed. Pick a new one below.');
    // The job now needs work the person given this time does not do (Kris,
    // interior only, given a time before exterior was added). Kept, the
    // server would book it on the owner's calendar without checking he is
    // free (audit, November 12), so the time is chosen again from whoever can.
    var given = crew().filter(function (d) { return d.id === state.detailer; })[0];
    if (given && !P.canDo(given, jobNeeds())) {
      return dropSlot('Your detail has changed, so the time you picked needs choosing again. These times fit.');
    }
    var dur = holdMinutes();
    if (!state.slotDur) { state.slotDur = dur; return; }
    var key = state.slot + ':' + dur;
    if (state.slotDur === dur || slotCheckFor === key) return;
    slotCheckFor = key;
    verifySlot().then(function (free) {
      if (slotCheckFor !== key) return;
      slotCheckFor = null;
      if (!state.slot || state.slot + ':' + holdMinutes() !== key) return;
      if (free) { state.slotDur = dur; state.checkedSlot = state.slot; return; }
      dropSlot('Your detail now takes about ' + fmtDur(dur) + ', so the time you picked no longer fits. These times do.');
      render();
    });
  }

  /** "Fri, Nov 13 · arrive 10 to 11am · about 2 hrs" */
  function whenLine(ms) {
    return tzDay(ms, { weekday: 'short', month: 'short', day: 'numeric' }) + ' · arrive ' + arrivalWindow(ms) +
      // "about 4 hrs detailing": what the hours are (owner, November 11).
      (holdMinutes() ? ' · about ' + fmtDur(holdMinutes()) + ' detailing' : '');
  }

  /** "10 to 11am": the hour we arrive in, from the start time. */
  function arrivalWindow(ms) {
    var m = localMin(ms);
    return endLabel(m).replace(/(am|pm)$/, endLabel(m).slice(-2) === endLabel(m + 60).slice(-2) ? '' : '$1') + ' to ' + endLabel(m + 60);
  }

  /** "(513) 555-0123" from whatever was typed, or what was typed when it is not ten digits. */
  function prettyPhone(raw) {
    var d = String(raw || '').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
    return d.length === 10 ? '(' + d.slice(0, 3) + ') ' + d.slice(3, 6) + '-' + d.slice(6) : String(raw || '');
  }

  function ckTabOf(id) {
    for (var i = 0; i < CK_TABS.length; i++) if (CK_TABS[i].secs.indexOf(id) > -1) return id === 'agree' ? 'Agree' : CK_TABS[i].tab;
    return '';
  }

  /** Which step the last paint drew, and where the reader was in it. */
  var lastRenderedStep = null;
  var keptScroll = 0;

  /** The "More below" cue: shown while more than a little is below the fold. */
  function updateCue() {
    markAllLeads();
    var sc = el('bkScroll'), cue = el('bkCue');
    if (!sc || !cue) return;
    cue.hidden = !(sc.scrollHeight - sc.clientHeight - sc.scrollTop > 48);
    // Above a bar pinned to the bottom of the window, but only while it is
    // actually stuck there: lifted over a bar sitting mid-page, its fade
    // washed the bar out (round 15).
    var pin = el('bkBody') && el('bkBody').querySelector('.bk-pinbar');
    var stuck = pin && pin.getBoundingClientRect && Math.abs(pin.getBoundingClientRect().bottom - sc.getBoundingClientRect().bottom) < 3;
    cue.style.transform = stuck ? 'translateY(-' + pin.offsetHeight + 'px)' : '';
  }

  function render() {
    if (state.done) return;
    clearPromoRate();
    // A checkout step is always drawn as the checkout page (a resumed draft
    // or an old quote link can land on Where or Time).
    if (onCheckout() && state.step !== LAST) state.step = LAST;
    // Fold what is done first, so a time that no longer fits reopens Time
    // with Contact and Address still folded above it.
    if (onCheckout() && !state.ckOpen) ckPrefill();
    if (onCheckout()) slotStillFits();
    var s = step();
    var scroller = el('bkScroll');
    keptScroll = scroller ? scroller.scrollTop : 0;
    // Progress along THIS customer's path: Help me decide skips three steps,
    // and dividing by all of them made the bar jump from 22% to 67%.
    var path = STEPS.filter(function (st, i) { return !skipped(i); });
    var pct = Math.round(((path.indexOf(s) + 1) / path.length) * 100);

    el('bkBar').style.width = pct + '%';
    el('bkProgress').setAttribute('aria-valuenow', String(pct));
    el('bkTitle').textContent = onCheckout() ? s.title : 'Build your detail';
    if (!onCheckout()) s = Object.assign({}, s, { sub: 'A few taps. Your price updates as you go.' });
    var sub = el('bkTitleSub');
    if (sub) { sub.textContent = s.sub || ''; sub.hidden = !s.sub; }
    renderNav();
    // Entering checkout reads the calendar fresh; re-rendering it does not.
    if (onCheckout() && lastRenderedStep !== s.id) lastSlotsKey = '';
    var grew = onCheckout()
      ? (lastRenderedStep === s.id && ckGrew)
      : lastRenderedStep !== s.id && BUILD_IDS.indexOf(lastRenderedStep) > -1;
    ckGrew = false;
    repaintAfterRender = false;
    el('bkBody').innerHTML = onCheckout() ? rCheckout(grew) : rBuild(grew);
    if (repaintAfterRender) { repaintAfterRender = false; repaintSlots(); }
    // Where the form will rest: a section that just opened is brought up by
    // ckScroll() (null), a new step starts at the top, a redraw keeps its place.
    if (onCheckout()) fitCkCont(false, grew ? null : lastRenderedStep === s.id ? keptScroll : 0);
    else ckCont.id = null;

    var back = el('bkBack');
    back.hidden = state.step === 0;

    var next = el('bkNext');
    next.hidden = s.auto || (onCheckout() && ckNextIdle());
    next.querySelector('span').textContent =
      onCheckout() && ckOpenId() !== 'review' ? 'Continue'
        : s.id === 'pay'
        ? (isInquiry() ? 'Send request' : state.payInFull ? 'Pay and confirm' : 'Confirm booking')
        : s.id === 'addons' ? 'Continue to checkout'
        : 'Continue';

    if (state.resumed) {
      // Once, on the step they come back to. Repeating it on every step
      // afterwards would be nagging about something they already know.
      state.resumed = false;
      // Not `back`: that name already holds the back button in this scope.
      var note = document.createElement('p');
      note.className = 'bk-resumed';
      note.innerHTML = 'Picked up where you left off. ' +
        '<button type="button" id="bkFresh">Start fresh instead</button>';
      el('bkBody').insertBefore(note, el('bkBody').firstChild);
    }

    renderTotal();
    updatePick();
    syncPressed();
    var focusable = el('bkBody').querySelector('[data-focus]');
    if (focusable) focusable.focus();
    else if (grew && onCheckout()) {
      // A section opened with no first field to put the cursor in (Time,
      // Almost done, Review): its heading, so focus never drops out of the
      // form to <body> (checkout review, November 10).
      var head = el('bkBody').querySelector('.bk-ck > .bk-sec-h');
      if (head) { try { head.focus({ preventScroll: true }); } catch (e) { head.focus(); } }
    }
    // Only jump to the top when the STEP changed. Re-rendering in place,
     // which is what expanding a time band or picking a slot does, used to
     // throw the reader back to the top of a long list of days every time
     // they touched one.
     var sameStep = lastRenderedStep === s.id;
     lastRenderedStep = s.id;
     if (grew) {
       // The next question slid in under the answered ones: bring it up.
       el('bkScroll').scrollTop = keptScroll;
       var fresh = el('bkBody').querySelector('.bk-sec-in');
       if (fresh && onCheckout()) ckScroll(fresh);
       else if (fresh) scrollToEl(fresh, 12);
     } else if (sameStep) {
       el('bkScroll').scrollTop = keptScroll;
     } else {
       el('bkBody').scrollTop = 0;
       el('bkScroll').scrollTop = 0;
     }
    updateCue();
  }

  function renderTotal() {
    clearPromoRate();
    var quote = q();
    var box = el('bkTotal');
    if (!quote.lines.length) { box.hidden = true; return; }
    box.hidden = false;
    box.querySelector('.bk-total-amt').textContent = $(quote.totalCents);
    var dur = quote.serviceDurationMin;
    var sub = box.querySelector('.bk-total-sub');

    if (quote.promoDiscountCents > 0) {
      // Re-priced without the code rather than adding the discount back by
      // hand, so the struck figure includes the tax that came off with it and
      // the two numbers on screen really do subtract to the saving beside
      // them.
      var plain = cart();
      plain.promoCode = null;
      var before = P.quote(plain, RULES);
      // The saving itself is said once, in the price table's "You saved"
      // (validation, November 11: this bar said $13.47 with the tax, the
      // table $12.50 without, on one screen).
      sub.innerHTML = '<s>' + $(before.totalCents) + '</s> ' + esc(quote.promoCode) + ' applied';
    } else if (quote.multiVehicleDiscountCents > 0) {
      // Lead with the saving, not the duration: this is the moment the second
      // vehicle has to look like a good idea.
      // The amount is said once, in the price table's "You saved", as with a
      // promo code (final validation, November 11: $75 there, $64.68 here).
      sub.innerHTML = '<s>' + $(quote.grossBeforeMultiCents) + '</s> multi-vehicle saving applied';
    } else {
      sub.textContent = dur ? 'about ' + fmtDur(dur) + ' on site' : '';
    }
  }

  function fmtDur(min) {
    if (!min) return '';
    var h = Math.floor(min / 60), m = min % 60;
    return (h ? h + ' hr' + (h > 1 ? 's' : '') : '') + (m ? (h ? ' ' : '') + m + ' min' : '');
  }

  /** A brief word after the funnel has already closed. */
  function toast(msg) {
    var old = document.getElementById('bkToast');
    if (old) old.remove();
    var t = document.createElement('div');
    t.id = 'bkToast';
    t.className = 'bk-toast';
    t.setAttribute('role', 'status');
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.classList.add('out'); }, 4200);
    setTimeout(function () { if (t.parentNode) t.remove(); }, 4800);
  }

  /**
   * Say what is wrong, next to the thing that is wrong.
   *
   * `near` is the control at fault. The message is planted beside it rather
   * than at the foot of the step, because a message at the bottom of a long
   * form is a message about nothing in particular: the reader has to go
   * hunting for the field it means.
   */
  /**
   * Everything on this screen that still wants an answer, in reading order.
   *
   * One list, so every control behaves the same way when it is satisfied:
   * move to the next thing that is not, and when there is nothing left, point
   * at Continue. Before this, each control invented its own idea of what to
   * do next, which is why answering a consent eased you down the page but
   * ticking the card box threw you back to the top.
   *
   * `querySelectorAll` with a comma-separated list returns DOCUMENT order
   * regardless of the order of the selectors, which is exactly the order a
   * person reads them in.
   */
  function answerables() {
    var body = el('bkBody');
    if (!body) return [];
    return Array.prototype.slice.call(body.querySelectorAll(
      'input[type="text"],input[type="tel"],input[type="email"],.bk-acc,#bkMandate,#bkTerms'
    )).filter(function (n) {
      // An optional box is never a DESTINATION. Marking it answered was not
      // enough: the walker still counted it as a position in the list, so
      // anything below it could still be dragged up to an empty promo box.
      // Dropping it from the list entirely is the only version that holds.
      return !(n.hasAttribute && n.hasAttribute('data-optional'));
    });
  }

  function isAnswered(node) {
    if (node.classList && node.classList.contains('bk-acc')) return node.classList.contains('answered');
    if (node.id === 'bkMandate' || node.id === 'bkTerms') return node.checked;
    // An optional field is never the reason to stop.
    if (node.hasAttribute && node.hasAttribute('data-optional')) return true;
    return String(node.value || '').trim() !== '';
  }

  /**
   * Is this box comfortably on screen already?
   *
   * Measured against the modal body, which is the thing that scrolls, with a
   * margin at each end so a field half under the sticky footer still counts
   * as needing a scroll.
   */
  function inView(box) {
    var body = el('bkBody');
    if (!body || !box || !box.getBoundingClientRect) return false;
    var b = box.getBoundingClientRect();
    var v = body.getBoundingClientRect();
    var pad = 24;
    return b.top >= v.top + pad && b.bottom <= v.bottom - pad;
  }

  /** Put the cursor where it belongs, without hauling the page about. */
  function reach(node) {
    if (!node) return;

    var isGroup = node.classList &&
      node.classList.contains('bk-acc');
    var box = isGroup ? node : (node.closest && node.closest('.bk-field,.bk-check')) || node;

    /*
     * LEAVING A TEXT BOX FOR A SET OF BUTTONS MEANS CLOSING THE KEYBOARD.
     *
     * On a phone the keyboard owns half the screen. Scrolling a yes/no
     * question into view underneath it put the question where the reader
     * could see it and the buttons where they could not, which is what
     * "it jumps halfway down the page" actually was: the page had moved
     * correctly and then been covered up.
     *
     * Blurring first lets the viewport grow back before anything scrolls.
     */
    var active = document.activeElement;
    if (isGroup && active && active.tagName === 'INPUT' && active.blur) active.blur();

    /*
     * A FIELD ALREADY ON SCREEN DOES NOT MOVE THE PAGE AT ALL.
     *
     * 'nearest' is documented as scrolling the least it can, and browsers
     * still shift the page for a box that was only just inside the edge.
     * Autofilling a name and watching the screen slide is the whole
     * complaint, and the fix is not a smaller scroll: it is none.
     *
     * A consent group is different. It has to be read and answered, so it
     * is centred whether or not it was technically visible.
     */
    if (isGroup || !inView(box)) {
      box.scrollIntoView({ behavior: 'smooth', block: isGroup ? 'center' : 'nearest' });
    }

    var target = node.tagName === 'INPUT' ? node : node.querySelector('button,input,select,textarea');
    if (target && target.focus) {
      try { target.focus({ preventScroll: true }); } catch (e) { target.focus(); }
      if (target.select && target.tagName === 'INPUT' && target.type !== 'checkbox') target.select();
    }
  }

  /*
   * MOVE ON WHEN A BOX IS FILLED, however it got filled.
   *
   * Everything used to hang off Enter, and on a phone Enter is often never
   * pressed: the reader taps an autofill suggestion and the browser fills
   * name, phone and email at once without a single keystroke. Nothing moved,
   * so the terms question below stayed out of sight and the step looked
   * finished when it was not.
   *
   * `change` is the right event, not `input`. Input fires per keystroke and
   * would yank the page away mid-word. Change fires when a field is done
   * with: on blur after editing, and on autofill in every browser that
   * matters.
   *
   * Debounced, because autofill fires change three times in a few
   * milliseconds and only the last one knows what is still missing.
   */
  var advanceTimer = null;
  function advanceWhenFilled(node) {
    if (!node || node.tagName !== 'INPUT') return;
    var type = String(node.type || 'text').toLowerCase();
    if (type === 'checkbox' || type === 'radio') return;
    if (!String(node.value || '').trim()) return;

    clearTimeout(advanceTimer);
    advanceTimer = setTimeout(function () {
      /*
       * WALK ON FROM WHERE THEY ACTUALLY ARE, not from the box that fired.
       *
       * Autofill fills name, phone and email in one go and fires change on
       * each. The last timer to survive belongs to whichever fired last, and
       * the cursor is usually sitting somewhere else by then. Bailing out in
       * that case meant nothing moved at all, which is why the terms question
       * only sometimes came into view.
       *
       * The one case worth leaving alone is a box they moved to themselves
       * and have not filled yet. That is a deliberate choice, not a stall.
       */
      var a = document.activeElement;
      var body = el('bkBody');
      if (a && a !== node && a.tagName === 'INPUT' && body && body.contains(a)) {
        if (!String(a.value || '').trim()) return;
        focusNext(a);
        return;
      }
      focusNext(node);
    }, 160);
  }

  /** Continue is the only thing left. Say so without moving anything else. */
  /**
   * Show the end of the step: whatever optional boxes are left, and the
   * button. Scrolls the body itself rather than an element, because the last
   * thing on the page is the button in the sticky footer, and scrolling TO
   * that stops short of the boxes above it.
   */
  function showTail() {
    var body = el('bkBody');
    if (body && body.scrollHeight > body.clientHeight) {
      body.scrollTo({ top: body.scrollHeight, behavior: 'smooth' });
    }
    pointAtContinue();
  }

  function pointAtContinue() {
    var next = el('bkNext');
    if (!next || next.hidden) return;
    next.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    next.classList.add('bk-ready');
    setTimeout(function () { next.classList.remove('bk-ready'); }, 2400);
  }

  /**
   * Move on from `from`: to the next unanswered control, or to Continue.
   */
  /**
   * Move on from `from`, FORWARD only. Returns true if it moved.
   *
   * It used to fall back to scanning backwards for anything still blank,
   * which sounded helpful and was not: the promo box sits near the top of
   * the confirm screen and is empty for almost everybody, so answering
   * anything below it hauled the page back up to ask for a discount code
   * nobody has. Optional fields are skipped for the same reason.
   */
  function focusNext(from) {
    var list = answerables();
    var i = -1;
    for (var n = 0; n < list.length; n++) {
      if (list[n] === from || (list[n].contains && list[n].contains(from))) { i = n; break; }
    }
    // `from` is not always ON the list: the email box and the promo box are
    // optional, so they were filtered out of it, and finishing one still has
    // to mean "what is next". Ask the document where it sits rather than
    // starting the scan at zero, which would send them back to the top.
    if (i === -1 && from && from.compareDocumentPosition) {
      i = list.length - 1;
      for (var m = 0; m < list.length; m++) {
        // 4 is DOCUMENT_POSITION_FOLLOWING: list[m] comes after `from`.
        if (from.compareDocumentPosition(list[m]) & 4) { i = m - 1; break; }
      }
    }
    // Forward first: the usual case is working down the screen.
    for (var j = i + 1; j < list.length; j++) {
      if (!isAnswered(list[j])) { reach(list[j]); return true; }
    }
    // Then back, for anything genuinely still missing. Somebody who answered
    // out of order should be shown the gap rather than left to hunt for it.
    // isAnswered() treats anything marked data-optional as done, which is
    // what stops this dragging the page up to an empty promo box.
    for (var k = 0; k < i && k < list.length; k++) {
      if (!isAnswered(list[k])) { reach(list[k]); return true; }
    }
    pointAtContinue();
    return false;
  }

  function flash(msg, near) {
    var body = el('bkBody');
    var old = body.querySelector('.bk-err');
    if (old) old.remove();

    var p = document.createElement('p');
    p.className = 'bk-err';
    p.setAttribute('role', 'alert');
    p.textContent = msg;

    // The whole question, never one of its buttons: a message inserted next to
    // the filming Yes button became a squeezed column inside the button row
    // (owner's screenshot, November 10). .bk-acc is the yes or no question.
    var box = placeMsg(p, near, body);

    // 'nearest', not 'center'. Centring drags a field that was already on
    // screen into the middle of it, which reads as the page lurching.
    (box || p).scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  /**
   * A validation failure, and the control that caused it.
   *
   * Validators used to return a bare sentence, which told someone WHAT was
   * missing but not WHERE. On a step with three text fields and three yes or
   * no questions, "Please answer yes or no on filming" meant scrolling back
   * up to find which of the three was blank.
   */
  /**
   * A validation failure, and the control that caused it.
   *
   * NOT called `fail`. There is already a fail() further down that takes a
   * DOM node and writes a send error into it, and a second declaration of the
   * same name in the same scope silently replaces the first: every validator
   * ended up calling the DOM one with a string, which threw on the first
   * render and left the funnel a blank box.
   */
  function needs(msg, focus) {
    return { msg: msg, focus: focus || null };
  }

  /** Validators may return a plain string or a needs(). Normalise both. */
  function asProblem(r, stepIndex) {
    if (!r) return null;
    return typeof r === 'string'
      ? { step: stepIndex, msg: r, focus: null }
      : { step: stepIndex, msg: r.msg, focus: r.focus };
  }

  /**
   * The first thing standing between here and Continue.
   *
   * Looks at every step up to and including this one, not just this one. If
   * someone jumped back, changed a package and jumped forward again, the gap
   * they opened is behind them, and sending them on would only fail later at
   * the payment step where it is far more annoying.
   */
  function firstProblem() {
    if (onCheckout()) {
      for (var b = 0; b < LOC_I; b++) {
        var early = asProblem(STEPS[b].valid(), b);
        if (early) return early;
      }
      // The checkout reads top to bottom, so it is checked top to bottom.
      for (var c = 0; c < CK.length; c++) {
        var found0 = asProblem(CK[c].valid(), LAST);
        if (found0) { found0.sec = CK[c].id; return found0; }
      }
      return null;
    }
    for (var i = 0; i <= state.step; i++) {
      var found = asProblem(STEPS[i].valid(), i);
      if (found) return found;
    }
    return null;
  }

  /** Take them to it, point at it, and put the cursor in it. */
  function showProblem(prob) {
    // On the checkout, every problem in that section at once.
    var sc0 = prob.sec && CK[ckIndex(prob.sec)];
    if (sc0 && sc0.all && onCheckout()) {
      var list0 = sc0.all();
      if (list0.length) return showProblems(list0, prob.sec);
    }
    // On the checkout, open the section the problem is in.
    if (prob.sec && onCheckout() && state.ckOpen !== prob.sec) {
      state.ckOpen = prob.sec;
      ckGrew = true;
      render();
    }
    if (prob.step !== state.step && !(inCheckout(prob.step) && onCheckout())) {
      state.step = prob.step;
      render();
    }
    var node = prob.focus ? el('bkBody').querySelector(prob.focus) : null;
    flash(prob.msg, node);
    if (node) {
      markInvalid(node, prob.focus, el('bkBody').querySelector('.bk-err'));
      // preventScroll, because flash has already scrolled to the right place
      // and a second scroll from the focus call fights it.
      try { node.focus({ preventScroll: true }); } catch (e) { node.focus(); }
    }
  }

  /**
   * The outline and the message stay until that field is put right
   * (clearFixedErrors), not for three seconds: the outline used to vanish
   * while the message stayed.
   */
  function markInvalid(node, sel, msgEl) {
    var box = outlineOf(node);
    box.classList.add('bk-invalid');
    if (node.setAttribute) node.setAttribute('aria-invalid', 'true');
    if (msgEl) {
      msgEl.setAttribute('data-for', sel);
      if (!msgEl.id) msgEl.id = 'bkErr' + (++errSeq);
      if (node.setAttribute) node.setAttribute('aria-describedby', msgEl.id);
    }
  }
  var errSeq = 0;

  /**
   * What gets the red outline: a text box itself, or the whole question for
   * a tick box or yes/no. Outlining a field's whole column took in its label
   * and, in an aligned row, the empty space beside a neighbour's message.
   */
  function outlineOf(node) {
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(node.tagName || '') && node.closest && node.closest('.bk-field')) return node;
    return (node.closest && node.closest('.bk-check,.bk-acc')) || node;
  }

  /** Every problem in a checkout section, each under its own field. */
  function showProblems(list, sec) {
    if (state.ckOpen !== sec || state.step !== LAST) {
      state.step = LAST;
      state.ckOpen = sec;
      ckGrew = true;
      render();
    }
    var body = el('bkBody');
    Array.prototype.forEach.call(body.querySelectorAll('.bk-err[data-for]'), function (e) { e.remove(); });
    var first = null;
    list.forEach(function (prob) {
      var node = prob.focus ? body.querySelector(prob.focus) : null;
      var p = document.createElement('p');
      p.className = 'bk-err';
      p.textContent = prob.msg;
      placeMsg(p, node, body);
      if (node) markInvalid(node, prob.focus, p);
      if (!first) first = { node: node, p: p };
    });
    if (!first) return;
    // One announcement for the lot, not one per message.
    first.p.setAttribute('role', 'alert');
    (first.node ? (first.node.closest('.bk-field,.bk-check,.bk-acc') || first.node) : first.p)
      .scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
    if (first.node) { try { first.node.focus({ preventScroll: true }); } catch (e) { first.node.focus(); } }
  }

  /*
   * WHERE A MESSAGE GOES (owner's screenshot, November 11: the Phone error
   * lifted Phone's label and box above Name and Email).
   *
   * Root cause, one for several bugs: a message was placed next to the
   * control at fault, and that control often sits in a ROW of side-by-side
   * items: the Name, Phone, Email fields (aligned on their bottoms), the
   * three vehicle and service pictures, the request days, the week grid.
   * Inside the row the message either became a squeezed column or made its
   * item taller and threw the row out of line.
   *
   * So: a text field's message goes inside its field only where the row
   * gives every field a label, box and message track (CSS subgrid, the
   * .bk-row2 and .bk-row3 rules in book.css), or where the field stands
   * alone. Anything else climbs out of every side-by-side row and goes
   * under the whole row.
   */
  var SUBGRID = Boolean(window.CSS && CSS.supports && CSS.supports('grid-template-rows', 'subgrid'));
  function isRow(el) {
    if (!el || el.nodeType !== 1 || !window.getComputedStyle) return false;
    var cs = getComputedStyle(el);
    if (/flex/.test(cs.display)) return /^row/.test(cs.flexDirection) && el.children.length > 1;
    if (/grid/.test(cs.display)) return String(cs.gridTemplateColumns || '').trim().split(/\s+/).length > 1;
    return false;
  }
  function placeMsg(p, near, body) {
    var box = near && (near.closest('.bk-field,.bk-check,.bk-acc') || near);
    if (!box || !box.parentNode) { body.appendChild(p); return null; }
    var parent = box.parentNode;
    if (box.classList && box.classList.contains('bk-field') &&
        (!isRow(parent) || (SUBGRID && /\bbk-row[23]\b/.test(parent.className || '')))) {
      box.appendChild(p);
      return box;
    }
    var at = box;
    while (at.parentNode && at.parentNode !== body && isRow(at.parentNode)) at = at.parentNode;
    at.parentNode.insertBefore(p, at.nextSibling);
    return box;
  }

  /** On/off buttons say which they are, not just by colour (checkout review, November 10). */
  var PRESSABLE = '.bk-acc-b,.bk-pref-day,.bk-pref-part,.bk-flex-day';
  function syncPressed() {
    var body = el('bkBody');
    if (!body || !body.querySelectorAll) return;
    Array.prototype.forEach.call(body.querySelectorAll(PRESSABLE), function (b) {
      b.setAttribute('aria-pressed', b.classList.contains('on') ? 'true' : 'false');
    });
  }

  /** Take away each message whose field is now right. */
  function clearFixedErrors() {
    var body = el('bkBody');
    if (!body || !onCheckout()) return;
    var msgs = body.querySelectorAll('.bk-err[data-for]');
    if (!msgs.length) return;
    var sec = CK[ckIndex(state.ckOpen)];
    var still = (sec && sec.all ? sec.all() : []).map(function (x) { return x.msg + '|' + x.focus; });
    Array.prototype.forEach.call(msgs, function (m) {
      var sel = m.getAttribute('data-for');
      if (still.indexOf(m.textContent + '|' + sel) > -1) return;
      var node = body.querySelector(sel);
      if (node) {
        var box = outlineOf(node);
        box.classList.remove('bk-invalid');
        node.removeAttribute('aria-invalid');
        node.removeAttribute('aria-describedby');
      }
      m.remove();
    });
  }

  function go(n) {
    var target = Math.max(0, Math.min(STEPS.length - 1, n));
    if (inCheckout(target)) { target = LAST; ckPrefill(); }
    state.step = target;
    render();
    track('booking_step', { step: STEPS[target].id });
  }

  /** js/analytics.js, which does nothing without consent. Never in the way. */
  function track(name, params) {
    if (window.AC_TRACK) window.AC_TRACK(name, params);
  }
  function source() { return window.AC_SOURCE ? window.AC_SOURCE() : ''; }
  /** Which A/B test versions this visitor saw, "golf-code: code" (config/experiments.json). */
  function experiments() { return window.AC_EXPS ? window.AC_EXPS() : ''; }

  /**
   * Is the chosen time STILL free?
   *
   * Availability is read when the step opens, and then somebody thinks about
   * it, talks to their partner, goes to make a coffee. Minutes later they
   * press Continue against a picture of the calendar that has since moved.
   * Two customers looking at the same screen at the same time is exactly how
   * one slot gets sold twice, and it costs an apology and a rescheduled day.
   *
   * So the calendar is asked again, right then, for the day in question.
   *
   * Our own failure never blocks a booking: a calendar that is slow or down
   * resolves true and lets them through. The cost of a rare double booking is
   * a phone call; the cost of refusing a real customer because Google was
   * briefly unreachable is the whole job.
   */
  function verifySlot() {
    var slot = state.slot;
    if (!slot) return Promise.resolve(true);

    // The calendars of whoever the time was given to: Kris's, or Elijah's
    // with his personal calendar on top.
    var who = crew().filter(function (d) { return d.id === state.detailer; })[0] ||
      crew().filter(function (d) { return d.owner; })[0];
    var cfg = calendarCfgFor(who);
    // Nothing authoritative to check against, so nothing to contradict.
    if (!P.calendarConfigured(cfg)) return Promise.resolve(true);

    var dur = holdMinutes();
    var dayStart = new Date(slot);
    dayStart.setHours(0, 0, 0, 0);
    var from = dayStart.getTime() - DAY;
    var to = dayStart.getTime() + 2 * DAY;
    var myDrive = driveFor(who.id);
    var buffer = P.travelBufferMin(myDrive);

    var personal = who.owner ? personalBusy() : Promise.resolve([]);

    return Promise.all([P.loadWindow(cfg, from, to), personal])
      .then(function (both) {
        var win = both[0];
        var late = new Map();
        var slots = P.computeSlots({
          lateBy: late,
          openBlocks: win.open,
          busy: (win.busy || []).concat(both[1]),
          serviceDurationMin: dur,
          travelBeforeMin: buffer,
          travelAfterMin: buffer,
          granularityMin: 30,
          notBefore: from,
          notAfter: to,
          hasExterior: hasExterior(),
          ignoreReturnAfterMin: P.IGNORE_RETURN_AFTER_MIN,
          ignoreOutboundBeforeMin:
            myDrive <= 60 ? P.IGNORE_OUTBOUND_BEFORE_MIN : undefined,
          arrivalWindowMin: who.arrivalWindowMin
        });
        // To the minute, not the millisecond: the grid is rebuilt from a
        // different `now` and need not land on the same instant.
        var hit = slots.filter(function (ms) { return Math.abs(ms - slot) < 60000; })[0];
        // The planned arrival from the calendar as it is now, for the event's end.
        if (hit !== undefined && state.slot === slot) state.slotLateMin = late.get(hit) || 0;
        return hit !== undefined;
      })
      .catch(function () { return true; });
  }

  /** Continue on the time step: check, then move, or say what happened. */
  function checkThenAdvance() {
    var next = el('bkNext');
    var label = next.querySelector('span');
    var was = label.textContent;
    next.disabled = true;
    label.textContent = 'Checking that time';

    verifySlot().then(function (free) {
      next.disabled = false;
      label.textContent = was;
      if (free) {
        state.checkedSlot = state.slot;
        return advance();
      }
      // Gone. Reload the step so they are choosing from what is actually
      // there, and say so plainly rather than letting them find out later.
      if (onCheckout()) {
        // In the Time section itself: at the foot of the form, under the
        // week grid, nobody saw it (checkout review, November 10).
        dropSlot('Someone booked that time while you were deciding. These are the times still open.');
        return render();
      }
      state.slot = null;
      state.checkedSlot = null;
      render();
      flash('Someone booked that time while you were deciding. These are the times still open.');
    });
  }

  function advance() {
    // On the checkout, Continue finishes the open section; Review books.
    if (onCheckout() && ckOpenId() !== 'review') return ckAdvance(ckOpenId());
    var prob = firstProblem();
    if (prob) { showProblem(prob); return; }

    // Leaving the time step with a time on it: confirm it is still there.
    // Checked once per chosen slot, so going back and forth does not ask
    // Google the same question repeatedly.
    // Booking from the checkout with a time on it: confirm it is still free.
    if (onCheckout() && state.slot && state.checkedSlot !== state.slot) {
      return checkThenAdvance();
    }

    if (state.step === STEPS.length - 1) { submit(); return; }

    // Skip past anything already answered, which is what happens when someone
    // picked a package from View Services and only needed the size question,
    // and past anything that does not apply to the path they are on.
    var i = state.step + 1;
    while (i < STEPS.length - 1 && (skipped(i) || (!STEPS[i].valid() && STEPS[i].auto))) i++;
    if (inCheckout(i)) i = LAST;
    go(i);
  }

  /** A step that does not apply at all, rather than one already answered. */
  function skipped(i) { return !!(STEPS[i].skip && STEPS[i].skip()); }

  /** Back, past anything the forward walk skipped on the way here. */
  function goBack() {
    var ci = onCheckout() ? ckIndex(ckOpenId()) : -1;
    if (ci > 0) {
      state.ckOpen = CK[ci - 1].id;
      ckGrew = true;
      return render();
    }
    var i = (onCheckout() ? LOC_I : state.step) - 1;
    while (i > 0 && skipped(i)) i--;
    go(i);
  }

  /* Pictograms for the first page (owner, November 10: "less words, more
     visuals"). Line drawings in the add-on icons' style. */
  var PIC = {
    // One car shape for the family: a car, then a taller SUV, then a van.
    small: '<path d="M19 17h2a1 1 0 0 0 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4a1 1 0 0 0 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/><path d="M9 17h6"/>',
    medium: '<path d="M19 17h2a1 1 0 0 0 1-1v-3.4a2 2 0 0 0-.9-1.7L18 9l-1.6-3.2A1.5 1.5 0 0 0 15 5H5.5A1.5 1.5 0 0 0 4 6.3L3 9.5l-.6.5a1 1 0 0 0-.4.8V16a1 1 0 0 0 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/><path d="M9 17h6M2.6 10h16.8M11 5v5"/>',
    large: '<path d="M19 17h2a1 1 0 0 0 1-1v-3.6a2 2 0 0 0-.5-1.3l-3.4-3.8A3 3 0 0 0 15.9 6H4a2 2 0 0 0-2 2v8a1 1 0 0 0 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/><path d="M9 17h6M2 11h18.5M8 6v5M13.5 6v5"/>',
    interior: '<path d="M8.3 3h4.4a1.5 1.5 0 0 1 1.5 1.7l-.7 7.3H8.9L7 4.9A1.5 1.5 0 0 1 8.3 3z"/><path d="M8.9 12h7.6a2 2 0 0 1 2 2v2.8H7.9L8.9 12z"/><path d="M9.4 16.8v4M16.5 16.8v4"/>',
    // The same car, with a shine over it.
    exterior: '<g transform="translate(0 2.5)"><path d="M19 17h2a1 1 0 0 0 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4a1 1 0 0 0 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/><path d="M9 17h6"/></g><path d="M11.5 1.8v3M10 3.3h3M17 2.6v2M16 3.6h2M6 3v1.6M5.2 3.8h1.6"/>',
    // A seat and a car side by side: inside and out.
    both: '<g transform="translate(-1.2 4.2) scale(.62)"><path d="M8.3 3h4.4a1.5 1.5 0 0 1 1.5 1.7l-.7 7.3H8.9L7 4.9A1.5 1.5 0 0 1 8.3 3z"/><path d="M8.9 12h7.6a2 2 0 0 1 2 2v2.8H7.9L8.9 12z"/><path d="M9.4 16.8v4M16.5 16.8v4"/></g><g transform="translate(9 6.4) scale(.62)"><path d="M19 17h2a1 1 0 0 0 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4a1 1 0 0 0 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/><path d="M9 17h6"/></g><path d="M11.2 7.5v3.8M9.3 9.4h3.8"/>',
    // Extras: a small sparkle, in the same line style.
    extras: '<path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9z"/><path d="M18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>',
    ask: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.6"/><path d="M12 17h.01"/>'
  };
  function pic(id) { return picSvg(PIC[id]); }
  function picSvg(inner) {
    return '<svg class="bk-pic-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + inner + '</svg>';
  }

  /*
   * A package's level of service, 1 to 4 (owner's pick B2, November 12):
   * its place in its side's catalog order (Maintenance or Express, Basic,
   * Full, Showroom Ready). Drawn as four segments, `n` filled.
   */
  function pkgLevel(p) {
    var list = P.packagesFor(p.category);
    for (var i = 0; i < list.length; i++) if (list[i].id === p.id) return Math.min(4, i + 1);
    return 0;
  }
  function levelSegs(x0, step, w, n) {
    var out = '';
    for (var i = 0; i < 4; i++) {
      out += '<rect x="' + (x0 + i * step).toFixed(2) + '" y="20.4" width="' + w + '" height="2.6" rx=".8" stroke="none" fill="currentColor"' + (i < n ? '' : ' opacity=".2"') + '/>';
    }
    return out;
  }
  /** The Package row: the service's picture over its level. */
  function levelPic(side, n) {
    return '<g transform="translate(2.4 -.9) scale(.8)">' + PIC[side] + '</g>' + levelSegs(2.6, 4.85, 4.1, n);
  }
  /**
   * Inside and out: seat over the interior level, car over the exterior
   * level, the shine on top and a faint line between (owner, November 12).
   * Strokes need no thickening when scaled: .bk-pic-ic draws every line at
   * a fixed width (vector-effect: non-scaling-stroke).
   */
  var SEAT_PATH = '<path d="M8.3 3h4.4a1.5 1.5 0 0 1 1.5 1.7l-.7 7.3H8.9L7 4.9A1.5 1.5 0 0 1 8.3 3z"/><path d="M8.9 12h7.6a2 2 0 0 1 2 2v2.8H7.9L8.9 12z"/><path d="M9.4 16.8v4M16.5 16.8v4"/>';
  var CAR_PATH = '<path d="M19 17h2a1 1 0 0 0 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4a1 1 0 0 0 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/><path d="M9 17h6"/>';
  function levelPicBoth(ni, ne) {
    return '<path d="M12 .9v2.8M10.6 2.3h2.8M8.4 1.7v1.6M7.6 2.5h1.6M15.6 1.7v1.6M14.8 2.5h1.6" stroke-width="1.3"/>' +
      '<path d="M12 6.4V23" stroke-width="1" stroke-dasharray="1.5 1.7" opacity=".45"/>' +
      '<g transform="translate(-.9 5.6) scale(.56)">' + SEAT_PATH + '</g>' +
      '<g transform="translate(13 7.6) scale(.47)">' + CAR_PATH + '</g>' +
      levelSegs(.6, 2.65, 2.2, ni) + levelSegs(13.25, 2.65, 2.2, ne);
  }
  /** On a package card, after its name: the four segments and their words for screen readers. */
  function levelMeter(p) {
    var n = pkgLevel(p);
    if (!n) return '';
    var segs = '';
    for (var i = 0; i < 4; i++) segs += '<i' + (i < n ? ' class="on"' : '') + '></i>';
    return '<span class="bk-lvl" role="img" aria-label="Level ' + n + ' of 4">' + segs + '</span>';
  }

  /* ================= step 1: size ================= */

  function rSize() {
    var v = veh();
    // A row of three picture cards, small to large (owner, November 10), each
    // with what it costs on top as its own clear mark.
    return '<div class="bk-pics">' +
      P.VEHICLE_SIZES.map(function (s) {
        return '<button type="button" class="bk-pic' + (v.size === s.id ? ' on' : '') + '" data-size="' + s.id + '">' +
          pic(s.id) + '<b>' + esc(s.label) + '</b>' +
          '<span>' + esc(s.examples) + '</span>' +
          '<i class="bk-pic-price' + (s.upchargeCents ? '' : ' none') + '">' + (s.upchargeCents ? '+' + $(s.upchargeCents) : 'No extra cost') + '</i>' +
          '</button>';
      }).join('') + '</div>';
  }
  function vSize() { return veh().size ? null : needs('Pick a vehicle size to continue.', '[data-size]'); }

  /* ================= step 2: intent ================= */

  function rIntent() {
    var v = veh();
    // Left to right: Interior, Both, Exterior (owner, November 10).
    var opts = [
      ['interior', 'Interior', 'Seats, carpets, glass'],
      ['both', 'Both', 'Inside and out. Save ' + $(RULES.comboDiscountCents)],
      ['exterior', 'Exterior', 'Wash, wheels, paint']
    ];
    if (state.browse) return rBrowse();

    // Exterior paused by the cold (owner, November 11): said before they
    // choose, with the likely day back. Still selectable, to book that day.
    // The forecast loads in the background; when it lands, draw again once.
    var pause = exteriorPause();
    if (pause === undefined) {
      loadWeather().then(function () { if (exteriorPause() && step().id === 'intent') render(); });
    }
    var back = pause && pause.nextDayMs ? shortDay(pause.nextDayMs) : '';
    var coldNote = pause
      ? '<p class="bk-warn bk-cold" role="status"><b>Exterior details pause below ' + P.WEATHER_RULES.exterior.minTempF +
        '&deg;F</b>, so water can&rsquo;t freeze on your car. ' +
        (back ? 'Next likely: <b>' + back + '</b>, weather permitting.' : 'They are back when it warms up.') + '</p>'
      : '';

    return coldNote + '<div class="bk-pics">' +
      opts.map(function (o) {
        var cold = pause && o[0] !== 'interior';
        return '<button type="button" class="bk-pic' +
          (!state.advice && v.intent === o[0] ? ' on' : '') + '" data-intent="' + o[0] + '">' +
          pic(o[0]) + '<b>' + o[1] + '</b><span>' + o[2] + '</span>' +
          (cold ? '<i class="bk-pic-price bk-pic-cold">' + (back ? 'From ' + back.replace(/^\w+, /, '') : 'Paused for cold') + '</i>' : '') +
          '</button>';
      }).join('') + '</div>' +
      // Nobody should have to already know what they want in order to ask.
      // This turns the booking into a request: no package, no price, no time
      // to commit to, and we come back with what we would recommend.
      '<button type="button" class="bk-askrow' + (state.advice ? ' on' : '') + '" data-intent="advice">' +
        pic('ask') + '<span><b>Not sure? Help me decide</b><i>We look at your vehicle and recommend one</i></span>' +
        '<svg class="bk-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M9 6l6 6-6 6"/></svg>' +
      '</button>' +
      '<button type="button" class="bk-browsebar" id="bkBrowse">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>' +
        '<span><b>Browse through all options</b><i>Every package and price, side by side</i></span>' +
        '<svg class="bk-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M9 6l6 6-6 6"/></svg>' +
      '</button>';
  }

  /* ---- browse everything, with search and a price cap ---- */

  /** Does an item satisfy a named filter? */
  function matchesFilter(item, key) {
    if (key === 'interior') return item.kind === 'package' && item.category === 'interior';
    if (key === 'exterior') return item.kind === 'package' && item.category === 'exterior';
    if (key === 'package') return item.kind === 'package';
    if (key === 'addon') return item.kind === 'addon';
    return false;
  }

  /**
   * Includes win, then excludes trim what is left. With nothing selected,
   * everything shows.
   */
  function applyFilters(list) {
    var f = state.browseFilters;
    var ins = Object.keys(f).filter(function (k) { return f[k] === 'in'; });
    var outs = Object.keys(f).filter(function (k) { return f[k] === 'out'; });

    var kept = ins.length
      ? list.filter(function (i) { return ins.some(function (k) { return matchesFilter(i, k); }); })
      : list;

    return outs.length
      ? kept.filter(function (i) { return !outs.some(function (k) { return matchesFilter(i, k); }); })
      : kept;
  }

  /**
   * Tap cycles include, exclude, off.
   *
   * The exclude step is refused when it would empty the list, because a
   * filter bar that can hide everything just looks broken.
   */
  function cycleFilter(key) {
    if (key === '__clear') { state.browseFilters = {}; return; }

    var cur = state.browseFilters[key];
    var next = cur === 'in' ? 'out' : cur === 'out' ? null : 'in';

    var trial = Object.assign({}, state.browseFilters);
    if (next) trial[key] = next; else delete trial[key];

    var was = state.browseFilters;
    state.browseFilters = trial;
    if (!applyFilters(browseItems()).length) {
      // That combination shows nothing, so skip past it rather than
      // presenting an empty screen.
      state.browseFilters = was;
      var skip = cur === 'in' ? null : 'in';
      var t2 = Object.assign({}, was);
      if (skip) t2[key] = skip; else delete t2[key];
      state.browseFilters = t2;
      if (!applyFilters(browseItems()).length) state.browseFilters = was;
    }
  }

  function rBrowse() {
    var list = browseItems();
    var qs = state.browseQ.trim().toLowerCase();

    if (qs) {
      list = list.filter(function (i) { return i.search.toLowerCase().indexOf(qs) > -1; });
    }
    list = applyFilters(list);

    if (state.browseMax !== null) {
      list = list.filter(function (i) { return i.priceCents !== null && i.priceCents <= state.browseMax; });
    }
    // Unpriced entries sort last whichever way the list is ordered, so the
    // things that can actually be booked stay at the top.
    var pOf = function (i) { return i.priceCents === null ? Infinity : i.priceCents; };
    list = list.slice().sort(function (a, b) {
      if (a.unavailable !== b.unavailable) return a.unavailable ? 1 : -1;
      if (state.browsePkgFirst && (a.kind === 'package') !== (b.kind === 'package')) return a.kind === 'package' ? -1 : 1;
      if (state.browseSort === 'popular') {
        var d = P.popularityOf(b.id) - P.popularityOf(a.id);
        // Ties break on price so the order is stable rather than arbitrary,
        // which matters while the ranking is still a hand written seed.
        return d !== 0 ? d : pOf(a) - pOf(b);
      }
      if (state.browseSort === 'price') return pOf(a) - pOf(b);
      if (state.browseSort === 'priceDesc') return pOf(b) - pOf(a);
      return a.durationMin - b.durationMin;
    });

    var kinds = [
      ['interior', 'Interior'], ['exterior', 'Exterior'],
      ['package', 'Packages'], ['addon', 'Add-ons']
    ];
    var caps = [5000, 12500, 21500, 39500];
    var html = '<div class="bk-browsehead">' +
      // Pinned at the top with the search (owner, November 10: at the foot of
      // a long list it was easy to get stuck in here).
      '<button type="button" class="bk-browseback" id="bkBrowseBack">' + CHEV_L + 'Back to the quick picker</button>' +
      '<div class="bk-search">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>' +
        '<input type="search" id="bkQ" data-browseq value="' + esc(state.browseQ) + '" placeholder="Search: leather, ceramic, pet hair, wash..." data-focus />' +
        (state.browseQ ? '<button type="button" class="bk-qclear" id="bkQClear" aria-label="Clear search">&times;</button>' : '') +
      '</div>' +
      '<div class="bk-filters">' +
        kinds.map(function (k) {
          var st = state.browseFilters[k[0]];
          return '<button type="button" class="bk-chip' +
            (st === 'in' ? ' on' : st === 'out' ? ' out' : '') +
            '" data-kind="' + k[0] + '" aria-pressed="' + (st === 'in') + '">' +
            (st === 'out' ? '<s>' + k[1] + '</s>' : k[1]) + '</button>';
        }).join('') +
        (Object.keys(state.browseFilters).length
          ? '<button type="button" class="bk-chip clear" data-kind="__clear">Clear</button>'
          : '') +
      '</div>' +
      '<div class="bk-filters">' +
        '<span class="bk-filtlab">Under</span>' +
        caps.map(function (c) {
          return '<button type="button" class="bk-chip' + (state.browseMax === c ? ' on' : '') + '" data-max="' + c + '">' + $(c) + '</button>';
        }).join('') +
        '<button type="button" class="bk-chip' + (state.browseMax === null ? ' on' : '') + '" data-max="all">Any</button>' +
      '</div>' +
      '<div class="bk-filters">' +
        '<span class="bk-filtlab">Sort</span>' +
        // A switch of its own, so it can be on with any one of the others.
        '<button type="button" class="bk-chip' + (state.browsePkgFirst ? ' on' : '') + '" data-pkgfirst aria-pressed="' + state.browsePkgFirst + '">Packages first</button>' +
        '<button type="button" class="bk-chip' + (state.browseSort === 'popular' ? ' on' : '') + '" data-sort="popular">Most popular</button>' +
        '<button type="button" class="bk-chip' + (state.browseSort === 'price' ? ' on' : '') + '" data-sort="price">Price, low first</button>' +
        '<button type="button" class="bk-chip' + (state.browseSort === 'priceDesc' ? ' on' : '') + '" data-sort="priceDesc">Price, high first</button>' +
        '<button type="button" class="bk-chip' + (state.browseSort === 'time' ? ' on' : '') + '" data-sort="time">Quickest</button>' +
      '</div>' +
    '</div>';

    if (!list.length) {
      html += '<p class="bk-empty">Nothing matches that. <button type="button" class="bk-morelink" id="bkReset">Clear filters</button></p>';
    } else {
      html += '<p class="bk-count">' + list.length + ' option' + (list.length > 1 ? 's' : '') + '</p><div class="bk-pkgs">';
      list.forEach(function (i) {
        var dur = i.durationMin ? fmtDur(i.durationMin) : '';
        html += '<button type="button" class="bk-pkg' + (i.unavailable ? ' off' : '') + '"' +
          (i.unavailable ? ' disabled' : ' data-browsepick="' + esc(i.id) + '"') +
          (i.kind === 'addon' && !i.unavailable ? ' data-browsekind="addon" data-browsetier="' + esc(i.tierId) + '"' : '') + '>' +
          '<span class="bk-pkg-l">' +
            '<b>' + esc(i.name) + '</b>' +
            '<i class="bk-cat">' + (i.category === 'interior' ? 'Interior' : 'Exterior') +
              (i.kind === 'addon' ? ' add-on' : '') + '</i>' +
            (i.featured ? '<i class="bk-flag">Most popular</i>' : '') +
            '<span class="bk-pkg-tag">' + esc(i.tagline) + '</span>' +
            (i.detail ? '<span class="bk-pkg-feat">' + esc(i.detail) + '</span>' : '') +
          '</span>' +
          '<span class="bk-pkg-r">' +
          (i.unavailable
            // Its own class: .bk-pkg-r i is nowrap, which is right for
            // "2 hrs" and catastrophic for a sentence. A whole paragraph set
            // to nowrap made every row wider than a phone, so the list
            // scrolled sideways and the filters above it did not.
            ? '<b class="bk-soon">Soon</b><i class="bk-soonwhy">' + esc(i.unavailable) + '</i>'
            : '<b>' + svc(i.priceCents, i.pricePlus ? '+' : '') + '</b>' + (dur ? '<i>' + dur + '</i>' : '')) +
          '</span>' +
          '</button>' +
          (i.note
            ? '<details class="bk-how bk-how-pkg"><summary>How it works</summary><p>' + esc(i.note) + '</p></details>'
            : '');
      });
      html += '</div>';
    }

    return html;
  }
  function vIntent() {
    if (state.advice) return null;
    return veh().intent ? null : needs('Pick interior, exterior, or both.', '[data-intent]');
  }

  /* ================= step 3: package ================= */

  function rPackage() {
    var v = veh();
    var cats = v.intent === 'both' ? ['interior', 'exterior'] : [v.intent];
    // Prices first appear on this screen, so the code goes here rather than
    // waiting for checkout. Somebody holding a code should watch it come off
    // while they choose, not find out afterwards that they could have.
    // Folded to one line until it is wanted (owner, November 10: less on the
    // page); open whenever a code is already in.
    var html = '<details class="bk-promo-fold"' + (state.promoCode ? ' open' : '') + '><summary>Have a promo code?</summary>' +
      promoBox(q(), true, true) + '</details>';

    cats.forEach(function (cat) {
      if (v.intent === 'both') {
        html += '<h3 class="bk-grp" data-grp="' + cat + '">' + (cat === 'interior' ? 'Interior' : 'Exterior') + '</h3>';
      }
      html += '<div class="bk-pkgs">';
      P.packagesFor(cat).forEach(function (p) {
        // Maintenance is returning-customer pricing, so it is not offered to
        // someone booking for the first time through the public funnel.
        if (p.requiresPriorDetail) return;

        var on = v.packageIds.indexOf(p.id) > -1;
        var comps = P.componentsOf(p, P.CATALOG).map(function (c) { return esc(c.name); });
        var dur = pkgDuration(p);

        // Not bookable yet, but still worth showing: hiding a service hides
        // the demand for it. Ticking this does not select the package, so
        // someone can register interest AND book what they came for.
        if (p.comingSoon) {
          var want = state.interest.indexOf(p.id) > -1;
          html += '<button type="button" class="bk-pkg soon' + (want ? ' want' : '') +
            '" data-interest="' + p.id + '">' +
            '<span class="bk-pkg-l">' +
              '<b>' + esc(p.name) + levelMeter(p) + '<i class="bk-flag soon">Coming soon</i></b>' +
              '<span class="bk-pkg-tag">' + esc(p.tagline) + '</span>' +
              '<span class="bk-pkg-feat">' + esc(p.comingSoonNote || 'Not bookable yet.') + '</span>' +
            '</span>' +
            '<span class="bk-pkg-r"><b>' + pkgPrice(p) + '</b>' +
              '<i class="bk-want">' + (want ? 'Interested' : 'Tell me when') + '</i></span>' +
            '</button>';
          // Interest ON ITS OWN (bug, November 11): "Register interest" landed
          // here with this ticked, but nothing could be sent without booking
          // a package too. Offered while nothing bookable is chosen.
          if (want && !v.packageIds.length) {
            html += '<div class="bk-soon-only">' +
              '<span>Only want this one? Leave your details and we will tell you first when it opens.</span>' +
              '<button type="button" class="btn btn-ink" data-interest-only="' + p.id + '">Tell me when it opens</button>' +
              '</div>';
          }
          return;
        }

        // One line each (owner, November 10): the name, the one-line promise,
        // the price. What is included and how it goes are under "How it
        // works", inside the card. The card books; the toggle sits above it.
        // Option A (owner, November 11): what is in, what is not, and one
        // line on what to do about it.
        var base = p.supersetOf ? P.findPackage(p.supersetOf) : null;
        var ins = base ? comps.slice(P.componentsOf(base, P.CATALOG).length) : comps;
        var how = '<div class="bk-how-box">' +
          '<span class="bk-how-sub">' + (base ? 'Everything in ' + esc(base.name) + ', plus' : 'Includes') + '</span>' +
          '<ul class="bk-incl yes">' + ins.map(function (c) { return '<li>' + TICK + '<span>' + c + '</span></li>'; }).join('') + '</ul>' +
          (p.notIncluded && p.notIncluded.length
            ? '<span class="bk-how-sub">Not included</span><ul class="bk-incl no">' +
              p.notIncluded.map(function (c) { return '<li>' + CROSS + '<span>' + esc(c) + '</span></li>'; }).join('') + '</ul>'
            : '') +
          (p.tip ? '<span class="bk-how-tip">' + tipHtml(p.tip) + '</span>' : '') +
          '</div>';
        html += '<div class="bk-pkgcard' + (on ? ' on' : '') + '">' +
          '<button type="button" class="bk-pkg" data-pkg="' + p.id + '" data-cat="' + cat + '">' +
            '<span class="bk-pkg-l">' +
              '<b>' + esc(p.name) + levelMeter(p) + '</b>' +
              (p.featured ? '<i class="bk-flag">Most popular</i>' : '') +
              '<span class="bk-pkg-tag">' + esc(p.tagline) + '</span>' +
            '</span>' +
            '<span class="bk-pkg-r"><b>' + pkgPrice(p) + '</b><i>' + dur + '</i></span>' +
          '</button>' +
          '<details class="bk-how bk-how-pkg"><summary>How it works</summary>' +
            '<div class="bk-how-body">' + how + '</div>' +
          '</details>' +
        '</div>';
      });
      html += '</div>';
    });

    if (v.intent === 'both') {
      html += '<p class="bk-note">Pick one from each list. Booking both takes <b>' +
        $(RULES.comboDiscountCents) + ' off</b> automatically.</p>';
    }

    if (needsCorrection(v)) html += rCorrection(v);
    return html;
  }

  /** "Pet hair or stains? Add ..." with the question in bold. */
  function tipHtml(t) {
    var i = t.indexOf('?');
    return i > -1 ? '<b>' + esc(t.slice(0, i + 1)) + '</b>' + esc(t.slice(i + 1)) : esc(t);
  }
  var CROSS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  function needsCorrection(v) {
    return v.packageIds.some(function (id) {
      var p = P.findPackage(id);
      return p && p.requiresCorrectionTier;
    });
  }

  /**
   * Showroom Ready Exterior is Full Exterior plus one of these, so the choice
   * is required rather than optional and appears inline the moment the
   * package is picked.
   */
  function rCorrection(v) {
    var R2 = P.CORRECTION_RULES;
    var X = P.COATING_EXPLAINER;
    var html = '<div class="bk-correction">' +
      '<details class="bk-explain" open><summary>' + esc(X.heading) + '</summary>' +
        '<p>' + esc(X.body) + '</p>' +
        '<p class="bk-explain-h">What it does</p><ul class="yes">' +
        X.does.map(function (d) { return '<li>' + esc(d) + '</li>'; }).join('') + '</ul>' +
        '<p class="bk-explain-h">What it does not do</p><ul class="no">' +
        X.doesNot.map(function (d) { return '<li>' + esc(d) + '</li>'; }).join('') + '</ul>' +
        '<p class="bk-explain-h">How long it takes</p><ul class="time">' +
        X.timing.map(function (d) { return '<li>' + esc(d) + '</li>'; }).join('') + '</ul>' +
        '<p>' + esc(X.timingNote) + '</p>' +
        '<p class="bk-explain-why">' + esc(X.why) + '</p>' +
      '</details>' +
      '<h3 class="bk-grp">Choose your correction level</h3>' +
      '<p class="bk-coverage">' + esc(P.COATING_COVERAGE) + '</p>';

    html += P.CORRECTION_TIERS.map(function (t) {
      var on = v.correctionTier === t.id;
      return '<button type="button" class="bk-pkg' + (on ? ' on' : '') + '" data-corr="' + t.id + '">' +
        '<span class="bk-pkg-l"><b>' + esc(t.label) + (t.asterisk ? '<sup>*</sup>' : '') + '</b>' +
        '<span class="bk-pkg-tag">' + esc(t.result) + '</span>' +
        '<span class="bk-pkg-feat">' + esc(t.detail) + '</span></span>' +
        '<span class="bk-pkg-r"><b>' + svcPlus(t.addCents) + '</b><i>' + fmtDur(t.addMin) + '</i></span>' +
        '</button>';
    }).join('');

    if (v.correctionTier) {
      html += '<h3 class="bk-grp">Coating length</h3><div class="bk-tiers multi">' +
        P.COATING_TERMS.map(function (c) {
          return '<button type="button" class="bk-tier' + (v.coatingTerm === c.id ? ' on' : '') +
            '" data-coating="' + c.id + '">' +
            '<span class="bk-tier-l">' + esc(c.label) + (c.asterisk ? '*' : '') + '</span>' +
            '<span class="bk-tier-p">' + (c.addCents ? svcPlus(c.addCents) : 'included') + '</span>' +
            '</button>';
        }).join('') + '</div>';

      html += '<div class="bk-garage"><p class="bk-garage-q">Do you have a garage we can work in?</p>' +
        '<p class="bk-consent-h">' + esc(R2.canopyNote) + '</p>' +
        '<div class="bk-yn">' +
        '<button type="button" class="bk-yn-b' + (!v.noGarage ? ' yes' : '') + '" data-garage="0">Yes, I have a garage</button>' +
        '<button type="button" class="bk-yn-b' + (v.noGarage ? ' no' : '') + '" data-garage="1">No, bring a canopy (+' +
          $(R2.canopyCents) + ')</button>' +
        '</div></div>';

      html += '<p class="bk-ast">*' + esc(R2.asteriskNote) + '</p>';
      html += '<p class="bk-warn" style="margin-top:1rem">Correction work runs across several days and books at least ' +
        R2.minLeadDays + ' days out, starting on a weekend morning. You are booking the first day here, and we will agree the rest with you directly.</p>';
    }

    return html + '</div>';
  }

  function vPackage() {
    var v = veh();
    // Nothing to validate: this step is not in their path at all.
    if (state.advice) return null;
    if (!v.packageIds.length) return needs('Choose a package to continue.', '[data-pkg]');
    if (needsCorrection(v) && !v.correctionTier) return needs('Pick a correction level to continue.', '[data-corr]');
    if (v.intent === 'both') {
      var cats = v.packageIds.map(function (id) { return P.findPackage(id).category; });
      if (cats.indexOf('interior') < 0) return needs('Pick an interior package too.', '[data-pkg]');
      if (cats.indexOf('exterior') < 0) return needs('Pick an exterior package too.', '[data-pkg]');
    }
    return null;
  }

  /* ================= step 4: add-ons ================= */

  /**
   * "Recommended for your package": the ranking lives in
   * web/lib/catalog/recommend.ts, so it can learn from analytics later
   * without this file changing. This only works out what the vehicle can
   * actually take, side by side, and turns ids back into add-ons.
   */
  function recommendedFor(v) {
    var ctx = { packageIds: v.packageIds, addonTiers: v.addons.map(function (a) { return { addonId: a.addonId, tierId: a.tierId }; }) };
    var sides = v.intent === 'both' ? ['interior', 'exterior'] : [v.intent];
    var candidates = {};
    sides.forEach(function (side) {
      candidates[side] = P.addonsFor(side).filter(function (a) {
        return P.isSelectable(a) && !P.addonBlockedReason(a, ctx);
      }).map(function (a) { return a.id; });
    });
    // `signals` stays empty until analytics can say what gets booked with what.
    return P.recommendAddons({ candidates: candidates, sides: sides }).map(P.findAddon).filter(Boolean);
  }

  /**
   * ", like pet hair removal or stain treatment": the top recommended extras
   * (recommend.ts, which analytics will tune), one per side when both are
   * booked, so the line always names extras this detail can take.
   */
  function extrasLike(recs, sides, count) {
    var names = [];
    var onSide = function (side) { var ids = P.addonsFor(side).map(function (a) { return a.id; }); return recs.filter(function (a) { return ids.indexOf(a.id) > -1; }); };
    if (sides.length > 1) sides.forEach(function (side) { var r = onSide(side)[0]; if (r) names.push(r.name); });
    else names = recs.slice(0, 2).map(function (a) { return a.name; });
    if (!names.length) return '';
    names = names.map(function (n) { return n.toLowerCase(); });
    // Every one named: say which, not "like".
    return count <= names.length ? ': ' + esc(names.join(' and ')) : ', like ' + esc(names.join(' or '));
  }

  /** One add-on card, as the Extras step has always drawn it. */
  function addonCard(v, a, ctx) {
    var html = '';
    var unavailable = P.unavailableReason(a);
    var blocked = unavailable ? null : P.addonBlockedReason(a, ctx);
    var chosen = v.addons.filter(function (x) { return x.addonId === a.id; })[0];
    var multi = a.tiers.length > 1;

    html += '<div class="bk-addon' + (chosen ? ' on' : '') +
      (blocked || unavailable ? ' off' : '') + '">' +
      '<div class="bk-addon-h"><span class="bk-addon-ic">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
      P.addonIcon(a.icon) + '</svg></span>' +
      '<b>' + esc(a.name) +
      (unavailable ? '<sup class="bk-star">*</sup>' : '') + '</b>' +
      (chosen ? '<button type="button" class="bk-clear" data-clear="' + a.id + '">Remove</button>' : '') +
      '</div>' +
      // "How it works" beside the description rather than under it (owner,
      // November 10): one less row on every card.
      // The toggle stays put beside the description; its panel opens
      // underneath, full width, so nothing jumps.
      '<div class="bk-addon-row"><p class="bk-addon-d">' + esc(a.description) + '</p>' +
      (a.note
        ? '<button type="button" class="bk-howbtn" aria-expanded="false" data-howfor="bkHow-' + esc(a.id) + '">How it works</button>'
        : '') + '</div>' +
      (a.note ? '<div class="bk-how-panel" id="bkHow-' + esc(a.id) + '" hidden><p>' + esc(a.note) + '</p></div>' : '');

    var wants = state.interest.indexOf(a.id) > -1;

    if (unavailable) {
      // Same reasoning as the browse list: show what it costs, then say
      // why it cannot be booked today.
      var shown = a.tiers.filter(function (t) { return t.priceCents !== null; });
      if (shown.length) {
        html += '<div class="bk-tiers' + (shown.length > 1 ? ' multi' : '') + '">' +
          shown.map(function (t) {
            return '<span class="bk-tier is-off">' +
              '<span class="bk-tier-l">' + esc(t.label) + '</span>' +
              '<span class="bk-tier-p">' + $(t.priceCents) + '</span></span>';
          }).join('') + '</div>';
      }
      html += '<p class="bk-addon-block">*' + esc(unavailable) + '</p>' +
        '<button type="button" class="bk-wantbtn' + (wants ? ' on' : '') +
        '" data-interest="' + a.id + '">' +
        (wants ? 'You are on the list' : 'Tell me when this opens') + '</button>';
    } else if (blocked) {
      html += '<p class="bk-addon-block">' + esc(blocked) + '</p>';
    } else {
      html += '<div class="bk-tiers' + (multi ? ' multi' : '') + '">';
      a.tiers.forEach(function (t) {
        if (t.priceCents === null) return;
        var sel = chosen && chosen.tierId === t.id;
        html += '<button type="button" class="bk-tier' + (sel ? ' on' : '') + '" data-addon="' + a.id + '" data-tier="' + t.id + '">' +
          '<span class="bk-tier-l">' + esc(t.label) +
          (t.description ? '<i>' + esc(t.description) + '</i>' : '') + '</span>' +
          '<span class="bk-tier-p">' + svc(t.priceCents, t.asterisk ? '*' : '') + '</span>' +
          '</button>';
      });
      html += '</div>';
      var ast = a.tiers.filter(function (t) { return t.asterisk; })[0];
      if (ast) html += '<p class="bk-ast">*' + esc(ast.asterisk) + '</p>';
    }
    html += '</div>';
    return html;
  }

  function rAddons() {
    var v = veh();
    var sides = v.intent === 'both' ? ['interior', 'exterior'] : [v.intent];
    var ctx = { packageIds: v.packageIds, addonTiers: v.addons.map(function (a) { return { addonId: a.addonId, tierId: a.tierId }; }) };
    var recs = recommendedFor(v);
    var recIds = recs.map(function (a) { return a.id; });
    var pkg = v.packageIds.map(function (id) { return (P.findPackage(id) || {}).name; }).filter(Boolean).join(' and ');

    // The second vehicle first, as one slim line: worth seeing before anyone
    // scrolls, and quiet enough not to compete with the extras or Continue.
    // No examples here: a fixed list named pet hair on exterior jobs, and
    // wheels on packages that already include them (owner, November 12).
    // The line under "View additional options" names real ones.
    var html = '<p class="bk-sub">Optional. Extras are for specific needs. Skip this if your car does not need them.</p>' + moreVehicles();

    // Hidden until asked for (owner, November 10: do not flood the page).
    // Open by itself once something is added, so a choice is never hidden.
    var chosenAny = state.vehicles.some(function (x) { return x.addons.length; });
    if (!state.showExtras && !chosenAny) {
      // Only extras this detail can still take: not "coming soon", not
      // already in the package (owner, November 12).
      var count = sides.reduce(function (n, side) {
        return n + P.addonsFor(side).filter(function (a) { return P.isSelectable(a) && !P.addonBlockedReason(a, ctx); }).length;
      }, 0);
      return html + '<button type="button" class="bk-extras-open" id="bkShowExtras">' +
        '<span><b>View additional options for your detail</b><i>' +
          (count ? count + (count === 1 ? ' extra' : ' extras') + extrasLike(recs, sides, count) : 'Nothing more to add to this package') + '</i></span>' +
        '<svg class="bk-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M6 9l6 6 6-6"/></svg>' +
      '</button>';
    }

    if (recs.length) {
      html += '<h3 class="bk-grp">Recommended for your ' + esc(pkg || 'detail') + '</h3><div class="bk-addrecs">';
      recs.forEach(function (a) { html += addonCard(v, a, ctx); });
      html += '</div>';
    }

    // Everything else, listed in full under the same kind of heading: keep
    // scrolling and it is all there, nothing folded away.
    sides.forEach(function (side) {
      var list = P.addonsFor(side).filter(function (a) { return recIds.indexOf(a.id) < 0; });
      if (!list.length) return;
      var label = sides.length > 1 ? 'More ' + side + ' extras' : recs.length ? 'More extras' : 'Extras';
      html += '<h3 class="bk-grp">' + label + '</h3>';
      list.forEach(function (a) { html += addonCard(v, a, ctx); });
    });
    return html;
  }

  /**
   * A second vehicle, as one slim line at the top of Extras (it used to be a
   * whole screen, then a line at the very bottom). Shows the real saving, and
   * lists the vehicles once there is more than one.
   */
  function moreVehicles() {
    var pct = RULES.additionalVehicleDiscountBp / 100;
    var now = q();
    if (state.vehicles.length > 1) {
      return '<div class="bk-morevehs many">' +
        '<p class="bk-morevehs-l"><b>' + pct + '% off everything, saving ' + $(now.grossBeforeMultiCents - now.totalCents) +
        '.</b> The discount came off your first vehicle too.</p>' +
        '<div class="bk-vehs">' + state.vehicles.map(function (v, i) {
          var names = v.packageIds.map(function (id) { return (P.findPackage(id) || {}).name; }).filter(Boolean);
          var size = v.size ? P.vehicleSize(v.size) : null;
          return '<div class="bk-veh">' +
            '<div><b>Vehicle ' + (i + 1) + (size ? ', ' + esc(size.label) : '') + '</b>' +
            '<span>' + esc(names.join(' + ') || 'nothing selected') + '</span></div>' +
            '<button type="button" class="bk-clear" data-delveh="' + i + '">Remove</button>' +
            '</div>';
        }).join('') + '</div>' +
        '<button type="button" class="bk-addveh" id="bkAddVeh">Add another vehicle</button></div>';
    }
    var withTwo = P.quote(
      Object.assign({}, cart(), { vehicles: cart().vehicles.concat(cart().vehicles) }),
      RULES
    );
    return '<div class="bk-morevehs">' +
      '<p class="bk-morevehs-l"><b>Another vehicle at this address?</b> Take ' + pct + '% off both, ' +
      $(withTwo.grossBeforeMultiCents - withTwo.totalCents) + ' on one like this. We only drive out once.</p>' +
      '<button type="button" class="bk-addveh" id="bkAddVeh">Add a vehicle</button></div>';
  }
  function vAddons() { return null; }

  /* ================= step 5: location ================= */

  var STATES = ['OH', 'KY', 'IN'];

  function rLoc() {
    var a = state.address;
    return '<p class="bk-sub">We come to you. Travel is worked out from your address, and the first ' + P.RULES.mileage.freeMinutes + ' minutes of drive time are free.</p>' +
      '<div class="bk-field"><label for="bkL1">Street address <span class="bk-req" aria-hidden="true">*</span></label>' +
      '<input type="text" id="bkL1" data-addr="line1" value="' + esc(a.line1) + '" placeholder="Start typing your address" autocomplete="address-line1" aria-required="true" data-focus />' +
      '<div class="bk-ac" id="bkAc" hidden></div></div>' +
      '<div class="bk-row3">' +
        '<div class="bk-field"><label for="bkCity">City <span class="bk-req" aria-hidden="true">*</span></label>' +
        '<input type="text" id="bkCity" data-addr="city" value="' + esc(a.city) + '" autocomplete="address-level2" aria-required="true" /></div>' +
        '<div class="bk-field"><label for="bkState">State</label>' +
        '<select id="bkState" data-addr="region">' +
        STATES.map(function (s) {
          return '<option value="' + s + '"' + (a.region === s ? ' selected' : '') + '>' + s + '</option>';
        }).join('') + '</select></div>' +
        '<div class="bk-field"><label for="bkZip">ZIP <span class="bk-req" aria-hidden="true">*</span></label>' +
        '<input type="text" id="bkZip" data-addr="zip" value="' + esc(a.zip) + '" inputmode="numeric" maxlength="5" autocomplete="postal-code" aria-required="true" /></div>' +
      '</div>' +
      '<label class="bk-check"><input type="checkbox" id="bkCovered"' + (state.covered ? ' checked' : '') + ' />' +
      '<span><b>There is a garage or covered spot we can work in</b> <em class="bk-opt">Optional</em>' +
      '<i>It means we can work in the rain and on very hot, sunny days.</i></span></label>' +
      '<label class="bk-check"><input type="checkbox" id="bkNoLoc"' + (state.noGoodLocation ? ' checked' : '') + ' />' +
      '<span>I do not have a good location for a detail near me <em class="bk-opt">Optional</em></span></label>' +
      (state.noGoodLocation
        ? '<div class="bk-panel"><p>No problem, this is usually easy to solve. Local spots like retail parking lots often work well, especially for interior details. Tell us roughly where you are and we will sort somewhere out with you. If we cannot find somewhere near you, we can work out a location closer to us as well.</p>' +
          '<textarea data-note="loc" rows="3" maxlength="300" placeholder="e.g. I live in an apartment with no driveway, but there is a big lot behind the Kroger on Ludlow">' + esc(state.locationNote) + '</textarea></div>'
        : '') +
      travelLine();
  }

  /** Live travel figure, shown as soon as the ZIP is complete. */
  /**
   * An unmeasured travel state.
   *
   * One definition, because this literal used to be written out in three
   * places, which is exactly how a new field gets added to two of them.
   */
  function blankTravel() {
    return {
      minutes: null,   // averaged, the figure the fee is built on
      miles: null,     // one way, as driven, not as the crow flies
      out: null,       // the drive there, leaving in time to arrive
      back: null,      // the drive home, leaving when the job ends
      heavy: false,    // measurably worse than this area's normal
      typical: null,   // what this area usually costs, for comparison
      source: 'none',  // none | routes | estimate | toofar
      pending: false,
      tooFar: false,
      forKey: ''
    };
  }

  /** The address as one line, and the key we cache the measurement against. */
  function addressLine() {
    var a = state.address;
    return [a.line1, a.city, a.region, a.zip]
      .map(function (x) { return String(x || '').trim(); })
      .filter(Boolean)
      .join(', ');
  }

  function addressComplete() {
    var a = state.address;
    return Boolean(a.line1.trim() && a.city.trim() && /^\d{5}$/.test(a.zip.trim()));
  }

  /**
   * Measure the real drive to the typed address.
   *
   * Debounced, and keyed on the address itself so re-rendering or tabbing
   * around does not re-measure. A failure leaves the ZIP band estimate in
   * place rather than blocking the booking: the customer still gets a number,
   * and it is still the number the server will charge, because the server
   * falls back the same way.
   */
  var travelTimer = null;

  /*
   * EACH DETAILER DRIVES FROM THEIR OWN HOME (owner, November 11). The
   * server measures from the address in DETAILER_HOMES, a server-only
   * setting, so no home address ever reaches the page. `travelBy` holds each
   * detailer's drive to this address, measured once per address with no
   * time, and sets how much drive time their offered times allow for.
   * state.travel stays the drive of whoever has the chosen time: the fee is
   * built on that one.
   */
  var travelBy = {};
  var travelByKey = '';
  function driveFor(id) {
    var m = travelBy[id || 'owner'];
    return typeof m === 'number' ? m : travelAllowanceMin();
  }
  function measureEachDetailer() {
    var line = addressLine();
    if (travelByKey === line.toUpperCase()) return;
    travelByKey = line.toUpperCase();
    travelBy = {};
    crew().forEach(function (d) {
      fetch('/api/travel?address=' + encodeURIComponent(line) + '&service=' + encodeURIComponent(holdMinutes()) +
            '&zip=' + encodeURIComponent(state.address.zip || '') + (d.owner ? '' : '&detailer=' + encodeURIComponent(d.id)), { cache: 'default' })
        .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error(String(r.status))); })
        .then(function (j) {
          if (travelByKey !== line.toUpperCase()) return;
          if (j && j.reachable !== false && !j.tooFar && typeof j.minutes === 'number') {
            travelBy[d.id] = j.minutes;
            scheduleSlotsRefresh();
          }
        })
        .catch(function () { /* the shared estimate stands */ });
    });
  }

  function measureTravel() {
    clearTimeout(travelTimer);
    if (!addressComplete()) {
      if (state.travel.source !== 'none') {
        state.travel = blankTravel();
      }
      return;
    }
    if (crew().length > 1) measureEachDetailer();

    // The slot is part of the key: the same address at 8am and at 5pm is a
    // different drive, and that is the whole point of measuring it. So is
    // who drives it.
    var who = state.detailer && state.detailer !== 'owner' ? state.detailer : '';
    var key = addressLine().toUpperCase() + '@' + (state.slot || 0) + '+' + holdMinutes() + '#' + who;
    if (state.travel.forKey === key && !state.travel.pending) return;

    state.travel.pending = true;
    state.travel.forKey = key;
    repaintTravel();

    travelTimer = setTimeout(function () {
      fetch('/api/travel?address=' + encodeURIComponent(addressLine()) +
            (state.slot ? '&at=' + encodeURIComponent(state.slot) : '') +
            '&service=' + encodeURIComponent(holdMinutes()) +
            '&zip=' + encodeURIComponent(state.address.zip || '') +
            (who ? '&detailer=' + encodeURIComponent(who) : ''), { cache: 'default' })
        .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error(String(r.status))); })
        .then(function (d) {
          if (state.travel.forKey !== key) return; // they kept typing
          var t = blankTravel();
          t.forKey = key;
          if (d.reachable === false || d.tooFar) {
            t.minutes = d.minutes || null;
            t.source = 'toofar';
            t.tooFar = true;
          } else {
            t.minutes = d.minutes;
            t.miles = typeof d.miles === 'number' ? d.miles : null;
            t.out = d.outboundMin != null ? d.outboundMin : d.minutes;
            t.back = d.returnMin != null ? d.returnMin : d.minutes;
            t.heavy = Boolean(d.heavyTraffic);
            t.typical = d.typicalMin != null ? d.typicalMin : null;
            t.source = 'routes';
          }
          state.travel = t;
          repaintTravel();
          renderTotal();
        })
        .catch(function () {
          if (state.travel.forKey !== key) return;
          // No key configured, or the API is having a moment. The estimate
          // stands and says so.
          var fallback = blankTravel();
          fallback.source = 'estimate';
          fallback.forKey = key;
          state.travel = fallback;
          repaintTravel();
          renderTotal();
        });
    }, 500);
  }

  function repaintTravel() {
    if (!root) return;
    var box = root.querySelector('.bk-travel-slot');
    if (box) box.outerHTML = travelLine();
    revealTravel();
  }

  /**
   * Once the fee is measured, scroll just far enough to show it, keeping
   * the field being typed in on screen (owner, November 12: on a laptop the
   * fee arrived below the fold and nothing said so).
   */
  function revealTravel() {
    var box = root.querySelector('div.bk-travel-slot:not(.pending)'), sc = el('bkScroll');
    if (!box || !sc || !box.getBoundingClientRect) return;
    var top = sc.getBoundingClientRect().top;
    var over = box.getBoundingClientRect().bottom + 12 - sc.getBoundingClientRect().bottom;
    var a = document.activeElement;
    if (a && a !== sc && sc.contains(a)) over = Math.min(over, a.getBoundingClientRect().top - top - 8);
    if (over <= 0) return;
    if (sc.scrollBy) sc.scrollBy({ top: over, behavior: reducedMotion() ? 'auto' : 'smooth' });
    else sc.scrollTop += over;
  }

  /**
   * The drive, as a person would say it: distance and time.
   *
   * Miles round UP to the whole mile, always. 14.1 is "15 miles". Rounding a
   * distance down flatters the quote and invites the reply "that is not what
   * my satnav said", which is a conversation worth a few tenths of a mile to
   * avoid. Minutes are already whole and are the honest average of the two
   * legs, so they are left alone.
   */
  function driveSummary(t, mins) {
    var parts = [];
    if (typeof t.miles === 'number' && t.miles > 0) {
      var mi = Math.ceil(t.miles);
      parts.push(mi + ' mile' + (mi === 1 ? '' : 's'));
    }
    if (mins) parts.push(mins + ' minute' + (mins === 1 ? '' : 's'));
    return parts.join(', ');
  }

  function travelLine() {
    var hit = state.address.zip ? P.lookupZip(state.address.zip) : null;
    var t = state.travel;
    var measured = t.source === 'routes' && t.minutes !== null;

    /*
     * A MEASURED DRIVE OUTRANKS THE ZIP TABLE.
     *
     * This used to start by looking the ZIP up in our own table and give up
     * if it was not there, so an address in 40324 got "add your ZIP and the
     * travel fee appears here" while the Routes API had already measured the
     * drive and the fee was sitting in the total. The customer was charged
     * for something the screen refused to admit existed. The table is a
     * fallback for before the measurement lands, never a gate in front of it.
     */
    if (!measured && !t.pending && !t.tooFar && !hit) {
      return '<p class="bk-hint bk-travel-slot">Add your ZIP and the travel fee appears here.</p>';
    }

    if (t.pending) {
      return '<div class="bk-travel pending bk-travel-slot"><b>Measuring the drive</b>' +
        '<span>Working out the exact time from your address.</span></div>';
    }

    if (t.tooFar) {
      return '<div class="bk-travel far bk-travel-slot"><b>Too far for a mobile detail</b>' +
        '<span>That is about ' + Math.round((t.minutes || 0) / 60) + ' hours of driving each way. ' +
        'Give us a call and we will see what we can suggest.</span></div>';
    }

    var mins = measured ? t.minutes : P.estimateOneWayMinutes(state.address.zip);
    var fee = P.mileageFeeCents(mins, RULES.mileage);

    if (fee === 0) {
      return '<div class="bk-travel free bk-travel-slot"><b>No travel fee</b>' +
        '<span>' + esc(measured || !hit ? 'Your address is' : hit.area + ' is') +
        ' inside our free radius' +
        (measured && driveSummary(t, mins) ? ', ' + driveSummary(t, mins) + ' each way' : '') +
        '.</span></div>';
    }

    if (measured) {
      // Measured, so it says so and stops hedging. This is the number that
      // gets charged: the server measures the same round trip before billing.
      //
      // Both legs are named when they differ, because the average is the
      // honest figure and showing only it looks like a rounded guess.

      // A fee above normal for the area deserves a reason. Without one, a
      // customer comparing notes with a neighbour assumes the worse
      // explanation, and they are told how to lower it.
      var why = t.heavy
        ? '<i class="bk-travel-why">Higher than usual for your area, because of the traffic ' +
          'at the time you picked. An earlier or later slot would bring it down.</i>'
        : '';

      return '<div class="bk-travel exact bk-travel-slot"><b>' + $(fee) + ' travel</b>' +
        '<span>' + driveSummary(t, mins) + ' each way from us, measured from your address' +
        (state.slot ? ' for the time you picked' : '') + '. It was just added to your total.' +
        '</span>' + why + '</div>';
    }

    return '<div class="bk-travel bk-travel-slot"><b>' + $(fee) + ' travel</b>' +
      '<span>' + esc(hit ? hit.area : 'Your ZIP') + ', about ' + mins + ' minutes each way, ' +
      'already in your total. We confirm it from your exact address before charging ' +
      'anything.</span></div>';
  }

  function lLoc() {
    var a = state.address, out = [];
    if (!a.line1.trim()) out.push(needs('We need a street address.', '#bkL1'));
    if (!a.city.trim()) out.push(needs('We need a city.', '#bkCity'));
    if (!/^\d{5}$/.test(a.zip.trim())) out.push(needs('We need a 5 digit ZIP so we can work out tax and travel.', '#bkZip'));
    return out;
  }
  function vLoc() { return lLoc()[0] || null; }

  /* ================= step 7: time ================= */

  function rTime() {
    if (state.timeMode === 'ask') return rTimeAsk();

    /*
     * THE SAME PICKER, WHATEVER THEY KNOW ABOUT THE PACKAGE.
     *
     * This step used to hand the "help me decide" path a different screen: no
     * calendar, no real times, just "tell us roughly when suits". That is the
     * weakest thing a booking form can do to somebody who is ready to buy and
     * only unsure what to buy. They came to be advised, not to start an email
     * thread, and a request with no time on it is the one most likely to go
     * cold while they look at somebody else's website.
     *
     * So they get the real calendar. The hours are held, the appointment is
     * real, and the only thing still open is which package it turns out to
     * be, which is exactly the question they asked us.
     */
    var html = state.advice
      // A short-notice time is still a request (final validation, November 11).
      ? '<p class="bk-sub">Pick a time and we hold it for you (a time within the next day is a request until a detailer accepts it). We will work out the right package with you ' +
        'before we start, so nothing is priced yet.</p>' +
        '<p class="bk-note">We are holding <b>' + Math.round(P.ADVICE_HOLD_MIN / 60) + ' hours</b>, ' +
        'which covers our longest single-vehicle detail. If the package we recommend needs less, we ' +
        'finish earlier and you pay less. If it needs more, we will say so before the day.</p>'
      : '';

    // The way out comes before any list. For most people it is the link
    // beside "See additional times"; somebody who already said they are not
    // sure what to book gets the fuller offer up front.
    if (state.advice) html += timeSwitch();

    if (state.vehicles.length > 1) {
      html += '<label class="bk-check bk-split' + (state.separateTimes ? ' on' : '') + '">' +
        '<input type="checkbox" id="bkSplit"' + (state.separateTimes ? ' checked' : '') + ' />' +
        '<span><b>My vehicles need separate times</b>' +
        '<i>Only if they cannot be done in one visit. It means driving out twice, so travel is charged ' +
        'twice and you would pay ' + $(P.mileageFeeCents(
          state.address.zip ? P.estimateOneWayMinutes(state.address.zip) || 0 : 0, RULES.mileage
        )) + ' extra. Same day back to back is usually easier for everyone, and keeps the ' +
        (RULES.additionalVehicleDiscountBp / 100) + '% either way.</i></span></label>';
    }

    // No "I need it soon" box: the rush days are marked on the
    // calendar itself, and the fee follows the time that is picked.
    if (hasCorrection()) {
      var lead = new Date(startOfToday().getTime() + P.CORRECTION_RULES.minLeadDays * DAY);
      html += '<p class="bk-note">Correction work starts on a weekend morning from <b>' +
        lead.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) +
        '</b>, and runs across consecutive days.</p>';
    }
    // No "standard prices start from" note: the calendar marks the rush days itself.

    // A fresh calendar read on entering checkout and whenever what the times
    // depend on changes (the job, the address, cover). Any other repaint of
    // the checkout (a tick box, a payment choice) redraws from what it has.
    var key = slotsKey();
    if (key === lastSlotsKey && lastPaint) {
      // Painted by render() straight after the page is in, before the scroll
      // is restored, so the page never collapses and jumps.
      html += '<div class="bk-slots" id="bkSlots"></div>';
      repaintAfterRender = true;
      return html;
    }
    lastSlotsKey = key;
    weekCache = {};
    autoSkips = 0;
    lastCalc = null;
    html += '<div class="bk-slots" id="bkSlots"><p class="bk-loading">Checking the calendar...</p></div>';
    setTimeout(loadSlots, 0);
    return html;
  }

  /**
   * The "tell us when suits" view of this step.
   *
   * The same picker the funnel has always fallen back to when the calendar
   * has nothing, reached deliberately now instead of only by accident.
   */
  /** What the offered times depend on; a change means a fresh calendar read. */
  var lastSlotsKey = '';
  var repaintAfterRender = false;
  function slotsKey() {
    var a = state.address;
    return [holdMinutes(), a.line1, a.city, a.zip, state.covered, jobNeeds().join(','), state.separateTimes, state.advice, state.timeMode,
      JSON.stringify(travelBy)].join('|');
  }

  /** An address finished on the checkout: refresh the times once it settles. */
  var slotsTimer = null;
  function scheduleSlotsRefresh() {
    clearTimeout(slotsTimer);
    slotsTimer = setTimeout(function () {
      if (!onCheckout() || !addressComplete() || slotsKey() === lastSlotsKey) return;
      lastSlotsKey = slotsKey();
      weekCache = {};
      lastCalc = null;
      loadSlots();
    }, 900);
  }

  function rTimeAsk() {
    return timeSwitch() + preferPicker();
  }

  /* ================= shareable quotes ================= */

  /**
   * The current booking as a payload small enough to live in a URL.
   *
   * Ids and a slot only. No prices: everything is recomputed from the catalog
   * when the link opens and again on the server before anything is charged,
   * so a link edited by hand cannot buy a cheap detail.
   */
  function quotePayload() {
    var a = state.address;
    var c = state.contact;

    var payload = {
      v: 1,
      ts: Math.floor(Date.now() / 1000),
      vs: state.vehicles.map(function (v) {
        var out = {};
        if (v.size) out.z = v.size;
        if (v.intent) out.i = v.intent;
        if (v.packageIds.length) out.p = v.packageIds.slice();
        if (v.addons.length) {
          out.a = v.addons.map(function (x) { return [x.addonId, x.tierId]; });
        }
        if (v.label) out.l = v.label;
        if (v.correctionTier) out.c = v.correctionTier;
        if (v.coatingTerm) out.t = v.coatingTerm;
        if (v.noGarage) out.g = 1;
        return out;
      })
    };

    if (a.line1 || a.city || a.zip) payload.ad = [a.line1 || '', a.city || '', a.region || 'OH', a.zip || ''];
    if (c.name || c.phone || c.email) payload.ct = [c.name || '', c.phone || '', c.email || ''];
    if (state.slot) payload.sl = state.slot;
    if (state.promoCode) payload.pc = state.promoCode;
    if (state.interest.length) payload.in = state.interest.slice();
    if (state.notes) payload.nt = state.notes;

    return payload;
  }

  /**
   * Put a decoded quote back into state.
   *
   * The SLOT is treated as a request rather than a reservation, because it
   * never was one: nothing is held until someone pays. It is kept here and
   * checked against live availability when the times load, so a slot that
   * went to somebody else in the meantime drops out rather than being sold
   * twice.
   */
  function applyQuote(payload) {
    var vs = payload.vs || [];
    state.vehicles = vs.map(function (raw, i) {
      var v = newVehicle();
      if (raw.z) v.size = raw.z;
      if (raw.i) v.intent = raw.i;
      if (raw.p) v.packageIds = raw.p.filter(function (id) { return P.findPackage(id); });
      if (raw.a) {
        v.addons = raw.a
          .filter(function (pair) { return P.findAddon(pair[0]); })
          .map(function (pair) { return { addonId: pair[0], tierId: pair[1] }; });
      }
      if (raw.l) v.label = raw.l;
      if (raw.c) v.correctionTier = raw.c;
      if (raw.t) v.coatingTerm = raw.t;
      if (raw.g) v.noGarage = true;
      return v;
    });
    if (!state.vehicles.length) state.vehicles = [newVehicle()];

    if (payload.ad) {
      state.address.line1 = payload.ad[0] || '';
      state.address.city = payload.ad[1] || '';
      state.address.region = payload.ad[2] || 'OH';
      state.address.zip = payload.ad[3] || '';
    }
    if (payload.ct) {
      state.contact.name = payload.ct[0] || '';
      state.contact.phone = payload.ct[1] || '';
      state.contact.email = payload.ct[2] || '';
    }
    if (payload.sl) { state.slot = payload.sl; state.quotedSlot = payload.sl; }
    if (payload.pc) state.promoCode = payload.pc;
    if (payload.in) state.interest = payload.in.slice();
    if (payload.nt) state.notes = payload.nt;
  }

  /** Copy the link, with a spoken confirmation rather than a silent success. */
  function copyQuoteLink(btn) {
    var url = P.quoteUrl(quotePayload(), location.origin + location.pathname);
    var say = function (msg) {
      btn.textContent = msg;
      setTimeout(function () { btn.textContent = 'Copy quote link'; }, 2600);
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(
        function () { say('Copied, good for ' + P.QUOTE_TTL_HOURS + ' hours'); },
        function () { fallbackCopy(url, say); }
      );
    } else {
      fallbackCopy(url, say);
    }
  }

  function fallbackCopy(url, say) {
    // Clipboard API needs a secure context and a permission. A textarea does
    // not, and this has to work on whatever phone Elijah is holding.
    var box = document.createElement('textarea');
    box.value = url;
    box.setAttribute('readonly', '');
    box.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
    document.body.appendChild(box);
    box.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(box);
    say(ok ? 'Copied, good for ' + P.QUOTE_TTL_HOURS + ' hours' : 'Press and hold to copy');
    if (!ok) window.prompt('Copy this link', url);
  }

  /** Readable names for whatever they ticked, packages and add-ons alike. */
  function interestNames() {
    return state.interest.map(function (id) {
      var pkg = P.findPackage(id);
      if (pkg) return pkg.name;
      var add = P.findAddon(id);
      return add ? add.name : id;
    });
  }

  /** "Tuesday or Wednesday, mornings" in the customer's own terms. */
  function preferenceSummary() {
    var days = state.prefer.days.map(function (k) {
      var b = k.split('-');
      return new Date(Number(b[0]), Number(b[1]) - 1, Number(b[2]))
        .toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    });
    var parts = state.prefer.parts.map(function (id) {
      var w = DAY_PARTS.filter(function (x) { return x.id === id; })[0];
      return w ? w.label.toLowerCase() : id;
    });

    var out = [];
    if (state.prefer.flex) return 'You asked for any start time on ' + list(days) + '.';
    if (days.length) out.push('You asked for ' + list(days) + '.');
    if (parts.length) out.push((days.length ? 'Ideally ' : 'You asked for ') + list(parts) + '.');
    return out.join(' ');
  }

  function list(items) {
    if (items.length <= 1) return items[0] || '';
    return items.slice(0, -1).join(', ') + ' or ' + items[items.length - 1];
  }

  function toggle(list_, value) {
    var i = list_.indexOf(value);
    if (i > -1) list_.splice(i, 1);
    else list_.push(value);
  }

  function startOfToday() {
    var d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  /*
   * WEEK BY WEEK, FOR EVERY DETAILER.
   *
   * Each load reads two weeks for every detailer on the crew (DETAILERS in
   * the config; just Elijah until somebody is added) and keeps what it read,
   * so the next chevron and going back are instant. A reply for a week the
   * customer has already left is kept and never painted over the one they
   * are looking at. The forecast for the customer's own address is read
   * alongside, because the address now comes before the time.
   *
   * Jobs longer than a day are still a list of runs of days, Elijah only: a
   * three day job does not fit an hour grid, and nobody else does them.
   */
  var weekCache = {};
  var autoSkips = 0;
  var TZ = 'America/New_York';
  /** Which layout the calendar was last drawn in: true for the phone list. */
  var paintedNarrow = null;
  /**
   * Phones get the day list (option B), everything from a tablet up the day
   * timeline (option C), owner's picks, November 11. Decided by the window,
   * not the form: the form is 680 px at most on any big screen, so its width
   * cannot tell a big phone from a laptop. 768 is a tablet held upright.
   */
  var PHONE_MAX = 767.98;
  function phoneView() {
    return Boolean(window.matchMedia && window.matchMedia('(max-width: ' + PHONE_MAX + 'px)').matches);
  }
  /** A tap on the day timeline is showing its block before the form moves on. */
  var tlPicking = false;
  /** "See additional times" was just pressed: the calendar comes to the top once painted. */
  var wkScrollUp = false;
  /** The last slot calculation: starts, who takes each, busy time, weather. */
  var lastCalc = null;

  /** Owner, November 10: a booking can start an hour from now, not sooner. */
  var MIN_NOTICE_MIN = 60;
  /** Inside this, a booking is a request until a detailer accepts it. */
  var SHORT_NOTICE_HOURS = 24;

  function shortNotice(ms) {
    return Boolean(ms) && ms - Date.now() < SHORT_NOTICE_HOURS * 3600000;
  }

  /** The assigned detailer's id for the server, or '' for the owner. */
  function detailerParam() {
    return state.detailer && state.detailer !== 'owner' ? state.detailer : '';
  }

  /** The assigned detailer's name, or '' for the owner. */
  function detailerName() {
    if (!state.detailer || state.detailer === 'owner') return '';
    var d = crew().filter(function (x) { return x.id === state.detailer; })[0];
    return d ? d.name : '';
  }

  function lastBookableMs() { return startOfToday().getTime() + MAX_BOOK_DAYS * DAY; }

  /**
   * The crew in booking order. Just the owner unless DETAILERS lists others.
   * A bad entry is dropped, never fatal, and says why in the console once, so
   * a typo in Netlify shows up the first time anyone opens the time step.
   */
  var crewWarned = false;
  function crew() {
    var parsed = P.parseDetailers(CFG.detailers || '');
    if (parsed.problems.length && !crewWarned && window.console) {
      crewWarned = true;
      console.warn('[513] DETAILERS setting:', parsed.problems.join('; '));
    }
    return parsed.crew;
  }

  /**
   * The skills the job needs, for who can take it: a list of words matched
   * against each detailer's `does` (DETAILERS). Help me decide could turn out
   * to be anything, so it needs someone who does everything we sell.
   */
  function jobNeeds() {
    if (state.advice) return ['interior', 'exterior', 'correction', 'coating'];
    var needs = [];
    var interior = state.vehicles.some(function (v) {
      return v.packageIds.some(function (id) { var p = P.findPackage(id); return p && p.category === 'interior'; }) ||
        v.addons.some(function (a) { var d = P.findAddon(a.addonId); return d && d.scope === 'interior'; });
    });
    if (interior) needs.push('interior');
    if (hasExterior()) needs.push('exterior');
    if (hasCorrection() || hasAddonIn(CORRECTION_ADDONS)) needs.push('correction');
    if (hasAddonIn(COATING_ADDONS)) needs.push('coating');
    return needs;
  }

  /**
   * The calendars to read for a detailer. Jobs calendars are read busy-only
   * (start and end, nothing else): a detailer's bookings calendar always,
   * and Elijah's own once GOOGLE_BUSY_ONLY_CALENDAR_IDS lists it.
   */
  function calendarCfgFor(d) {
    return d.owner
      ? {
          calendarId: CFG.googleCalendarId,
          extraCalendarIds: CFG.googleExtraCalendarIds || [],
          busyOnlyIds: String(CFG.googleBusyOnlyCalendarIds || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean),
          apiKey: calendarKey()
        }
      : { calendarId: d.availabilityCalendarId, busyOnlyIds: [d.bookingsCalendarId], apiKey: calendarKey() };
  }

  /**
   * Elijah's personal calendar, as extra busy time on HIS slots only. Its
   * failing must never block a booking, so it resolves to an empty list.
   */
  function personalBusy() {
    return fetch('/api/personal-busy', { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : { busy: [] }; })
      .then(function (d) { return (d && d.busy) || []; })
      .catch(function () { return []; });
  }

  /** Standard hours for Elijah alone: the fallback when calendars cannot be read. */
  function fallbackCrew(from, to) {
    var owner = crew().filter(function (d) { return d.owner; })[0];
    return { mode: 'unconfigured', members: [{ d: owner, win: P.unconfiguredWindow(from, to) }] };
  }

  /**
   * Every detailer's window. The owner's failing rejects (and the caller falls
   * back to standard hours); anyone else's failing just leaves them out.
   */
  function loadCrew(from, to) {
    var people = crew();
    var mine = null;
    return Promise.all(people.map(function (d) {
      var cfg = calendarCfgFor(d);
      if (!P.calendarConfigured(cfg)) {
        return Promise.resolve(d.owner ? P.unconfiguredWindow(from, to) : null);
      }
      if (!d.owner) return P.loadWindow(cfg, from, to).catch(function () { return null; });
      mine = mine || personalBusy();
      return Promise.all([P.loadWindow(cfg, from, to), mine]).then(function (both) {
        var win = both[0];
        var extra = both[1].filter(function (b) { return b.end > from && b.start < to; });
        // `mode` has to survive the merge: the note about standard hours and
        // the quote-link check both read it.
        // Everything else rides along unchanged (the OPEN blocks' fees too:
        // listing the fields by hand dropped them).
        return Object.assign({}, win, { busy: (win.busy || []).concat(extra) });
      });
    })).then(function (wins) {
      var members = people.map(function (d, i) { return { d: d, win: wins[i] }; })
        .filter(function (m) { return m.win; });
      var owner = members.filter(function (m) { return m.d.owner; })[0];
      return { mode: owner ? owner.win.mode : 'unconfigured', members: members };
    });
  }

  /* ---- the weather where the detail is ---- */

  /*
   * Which weather rules a job is under (web/lib/availability/weather.ts has
   * the numbers). Polishing and paint correction are "correction"; ceramic
   * coating is checked on its own and never blocks a booking (owner,
   * November 10: correction books anyway, the coating moves to a warmer day).
   */
  var CORRECTION_ADDONS = ['paint-correction', 'paint-polish'];
  var COATING_ADDONS = ['ceramic-coating'];

  function hasAddonIn(ids) {
    return state.vehicles.some(function (v) {
      return v.addons.some(function (a) { return ids.indexOf(a.addonId) > -1; });
    });
  }

  /** Every rule the job must meet to be offered. Help me decide counts as interior. */
  function weatherKinds() {
    var kinds = [];
    if (state.advice || jobNeeds().indexOf('interior') > -1) kinds.push('interior');
    if (!state.advice && hasExterior()) kinds.push('exterior');
    if (hasCorrection() || hasAddonIn(CORRECTION_ADDONS)) kinds.push('correction');
    return kinds;
  }

  /** The first rule this start breaks, or null when the job can go ahead. */
  function weatherProblem(startMs, minutes, forecast) {
    var kinds = weatherKinds();
    for (var i = 0; i < kinds.length; i++) {
      var v = P.weatherVerdict({ startMs: startMs, durationMin: minutes, kind: kinds[i], forecast: forecast, covered: state.covered });
      if (!v.ok) return { kind: kinds[i], reason: v.reason };
    }
    return null;
  }

  /** True when the job has a coating that this start's weather does not allow. */
  function coatingMoves(startMs, minutes) {
    if (!hasAddonIn(COATING_ADDONS)) return false;
    var forecast = lastCalc && lastCalc.forecast;
    return !P.weatherVerdict({ startMs: startMs, durationMin: minutes, kind: 'coating', forecast: forecast || null, covered: state.covered }).ok;
  }

  /** The detail's location: the address pick, else the ZIP's centre, else Cincinnati. */
  function weatherPoint() {
    var a = state.address;
    if (typeof a.lat === 'number' && typeof a.lng === 'number') return { lat: a.lat, lon: a.lng };
    var z = a.zip ? P.zipGeo(a.zip) : null;
    return z ? { lat: z.lat, lon: z.lon } : { lat: 39.1031, lon: -84.512 };
  }

  var weatherCache = {};

  /**
   * The National Weather Service forecast for that point: two plain JSON GETs
   * to api.weather.gov (the point's grid square, then its forecast), no key,
   * free for any use. Cached for half an hour per location. Anything going
   * wrong resolves to null, and the season rule takes over.
   */
  function loadWeather() {
    var pt = weatherPoint();
    var key = pt.lat.toFixed(2) + ',' + pt.lon.toFixed(2);
    var hit = weatherCache[key];
    if (hit && Date.now() - hit.at < 30 * 60000) return hit.promise;
    var json = function (url) {
      return fetch(url).then(function (r) { return r.ok ? r.json() : Promise.reject(new Error(String(r.status))); });
    };
    var p = Promise.race([
      json('https://api.weather.gov/points/' + key)
        .then(function (d) { return json(d.properties.forecastGridData); })
        .then(P.parseGridpoint),
      new Promise(function (r) { setTimeout(function () { r(null); }, 6000); })
    ]).catch(function () { return null; });
    var entry = { at: Date.now(), promise: p, done: false, value: null };
    p.then(function (f) { entry.done = true; entry.value = f; });
    weatherCache[key] = entry;
    return p;
  }

  /**
   * Is exterior work paused by the cold for the next two weeks (owner,
   * November 11)? Judged for the shortest exterior package, on the cold
   * alone, from the forecast for the customer's area where it is known
   * (downtown before an address). Undefined until the forecast is in; then
   * null, or { nextDayMs } for "Next likely: Tue, Feb 24".
   */
  function exteriorPause() {
    var pt = weatherPoint();
    var hit = weatherCache[pt.lat.toFixed(2) + ',' + pt.lon.toFixed(2)];
    if (!hit || !hit.done) return undefined;
    var shortest = Math.min.apply(null, P.packagesFor('exterior').map(function (p) { return p.durationMin; }));
    return P.coldPause({ kind: 'exterior', durationMin: shortest, forecast: hit.value, nowMs: Date.now(), horizonDays: 14 });
  }

  /** "Tue, Feb 24" in Cincinnati. */
  function shortDay(ms) {
    return new Date(ms).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: TZ });
  }

  function loadSlots() {
    var box = root.querySelector('#bkSlots');
    if (!box) return;

    var corr = hasCorrection();
    var CR = P.CORRECTION_RULES;
    var now = Date.now();
    var soonest = now + MIN_NOTICE_MIN * 60000;
    var lead = corr && CR.minLeadDays > 0 ? startOfToday().getTime() + CR.minLeadDays * DAY : 0;

    // The WHOLE job, however long. Anything past a day gets planned across
    // consecutive days rather than truncated to its first morning.
    var dur = holdMinutes();
    var drive = travelAllowanceMin();

    var from, to, paintFrom, paintTo, ws = 0;
    if (!P.fitsOneDay(dur, P.LONGEST_DAY, drive, drive)) {
      from = paintFrom = Math.max(soonest, lead);
      to = paintTo = Math.min(from + (corr ? 70 : 42) * DAY, lastBookableMs());
    } else {
      // Our recommended times look across the next two weeks; the calendar
      // shows one week at a time.
      if (!state.showAll || !state.weekStart) {
        state.weekStart = P.weekStartOf(state.showAll && state.slot && state.slot > now ? state.slot : Math.max(soonest, lead));
      }
      ws = state.weekStart;
      from = Math.max(soonest, lead, ws);
      to = Math.min(P.addWeeks(ws, 2), lastBookableMs());
      paintFrom = from;
      paintTo = state.showAll ? Math.min(P.addWeeks(ws, 1), lastBookableMs()) : to;
      // Keep the week that is showing while the next one loads, dimmed,
      // rather than collapsing the screen to a one line spinner.
      var showing = box.querySelector('.bk-wk');
      if (showing && !weekCache[ws]) showing.classList.add('busy');
    }

    var hit = ws && weekCache[ws] && weekCache[ws].to >= paintTo ? weekCache[ws] : null;
    var people = hit ? Promise.resolve(hit.crew) : loadCrew(from, to);
    // Interior work only cares about a downpour, and only without cover.
    // Nothing is fetched while weatherCheck is off: the privacy policy names
    // the National Weather Service only while it is on.
    var needWeather = P.isLive('weatherCheck') && !(state.covered && weatherKinds().join() === 'interior');
    var weather = needWeather ? loadWeather() : Promise.resolve(null);

    // Still ours to paint? Not if they have moved to another week since.
    var current = function () { return !ws || state.weekStart === ws; };

    // NOTHING may leave the spinner spinning. Whatever happens, times paint
    // within 8 seconds, from standard hours if the calendar never answers.
    var settled = false;
    var giveUp = setTimeout(function () {
      if (settled) return;
      settled = true;
      if (current()) paintSlots(box, fallbackCrew(from, to), paintFrom, paintTo, dur, 'timeout', null);
    }, 8000);

    Promise.all([people, weather])
      .then(function (both) {
        var team = both[0];
        if (ws && !hit) {
          weekCache[ws] = { crew: team, to: to };
          weekCache[P.addWeeks(ws, 1)] = { crew: team, to: to };
        }
        if (settled) return;
        settled = true;
        clearTimeout(giveUp);
        if (current()) paintSlots(box, team, paintFrom, paintTo, dur, null, both[1]);
      })
      .catch(function (err) {
        if (settled) return;
        settled = true;
        clearTimeout(giveUp);
        // A calendar outage must not block a booking: fall back to business
        // hours and say plainly that the time still needs confirming.
        if (current()) paintSlots(box, fallbackCrew(from, to), paintFrom, paintTo, dur, String(err && err.message || err), null);
      });
  }

  /**
   * The last day list we painted, so opening a band can redraw it without
   * asking the calendar again.
   */
  var lastPaint = null;

  function repaintSlots() {
    var box = root.querySelector('#bkSlots');
    if (!box || !lastPaint) return loadSlots();
    var scroller = el('bkScroll');
    var at = scroller ? scroller.scrollTop : 0;
    paintSlots(box, lastPaint.team, lastPaint.from, lastPaint.to, lastPaint.dur, lastPaint.errMsg, lastPaint.forecast);
    if (scroller) scroller.scrollTop = at;
  }

  function paintSlots(box, team, from, to, dur, errMsg, forecast) {
    lastPaint = { team: team, from: from, to: to, dur: dur, errMsg: errMsg, forecast: forecast };
    try {
      paintSlotsInner(box, team, from, to, dur, errMsg, forecast);
    } catch (err) {
      // Last line of defence. A customer sees a way forward rather than a
      // spinner, and the console carries the real reason.
      if (window.console) console.error('[513] slot painting failed', err);
      // NOT "we could not load times". A customer does not care whose
      // fault it is, and a booking form that announces its own failure is a
      // booking form people close. Ask the question we would have asked
      // anyway, in the same words we use everywhere else.
      box.innerHTML = inquiryPanel('Tell us when suits and we will confirm a time.');
    }
  }

  /**
   * The travel allowance used for scheduling.
   *
   * A measured drive when we have one, otherwise a deliberately generous flat
   * 30 minutes: a slot we offer has to be one we can keep.
   */
  function travelAllowanceMin() {
    return state.travel.source === 'routes' && state.travel.minutes !== null
      ? state.travel.minutes
      : 30;
  }

  /**
   * Jobs too long for one day.
   *
   * A 20 hour detail is not a 20 hour calendar event and it is not a 16 hour
   * day followed by a 4 hour one either. It is planned into even consecutive
   * days, and only offered on runs of days that are completely free, because
   * starting a two day job beside a booked second day is worse than not
   * offering it.
   */
  function paintMultiDay(box, win, from, to, dur, plan, weatherOk) {
    // Correction work has its own weekend-morning rules. This used to read a
    // `corr` from loadSlots, which is a DIFFERENT FUNCTION: the reference
    // resolved to nothing and threw on every paint.
    var corr = hasCorrection();
    var found = P.findMultiDayStarts({
      plan: plan,
      openBlocks: win.open,
      busy: win.busy || [],
      notBefore: from,
      notAfter: to,
      allowedWeekdays: corr ? [0, 6] : undefined,
      limit: 8
    }).filter(function (opt) {
      // Every day of it has to be workable: a coating cannot stop for rain.
      return opt.days.every(function (d) { return weatherOk(d.startMs, (d.endMs - d.startMs) / 60000); });
    });

    var head = '<div class="bk-multiday">' +
      '<b>This one runs across ' + plan.totalDays + ' days</b>' +
      '<span>' + esc(P.describePlan(plan)) + ' We come back each morning and ' +
      'the vehicle stays with you overnight.</span></div>';

    if (!found.length) {
      box.innerHTML = head +
        inquiryPanel('We do not have ' + plan.totalDays + ' clear days in a row in that range.');
      return;
    }

    var html = head + '<div class="bk-days">';

    found.forEach(function (opt) {
      var first = new Date(opt.startMs);
      var last = new Date(opt.days[opt.days.length - 1].endMs);
      var sel = state.slot === opt.startMs;

      html += '<button type="button" class="bk-day' + (sel ? ' on' : '') +
        '" data-slot="' + opt.startMs + '">' +
        '<b>' + first.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: TZ }) +
        ' to ' + last.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: TZ }) + '</b>' +
        '<span>' + opt.days.map(function (d, i) {
          return 'Day ' + (i + 1) + ': ' +
            new Date(d.startMs).toLocaleTimeString('en-US', { hour: 'numeric', timeZone: TZ }) + ' to ' +
            new Date(d.endMs).toLocaleTimeString('en-US', { hour: 'numeric', timeZone: TZ });
        }).join(' &middot; ') + '</span>' +
        '</button>';
    });

    box.innerHTML = html + '</div>';
  }

  /**
   * True when the customer is asking for a time rather than taking one.
   *
   * Everything downstream keys off this: the price is a quote, the button
   * says request, and paying in full is off the table.
   */
  /*
   * A REQUEST IS ABOUT THE TIME, not about the price.
   *
   * This used to return true for anybody who pressed "help me decide", which
   * collapsed two different things into one. Not knowing which package you
   * want does not mean you cannot be given a time: the van still has to drive
   * out, the hours still have to be held, and a real appointment is worth
   * immeasurably more to both sides than a promise to email back. What is
   * unknown on that path is the PRICE, and that is what advising() says.
   *
   * So this now means exactly what its name says: no time has been agreed.
   */
  function isInquiry() {
    return !state.slot && (state.prefer.parts.length > 0 || state.prefer.days.length > 0);
  }

  /**
   * The time-of-day choices on the inquiry path.
   *
   * THE SAME FOUR BANDS the slot picker offers, read from one definition, so
   * asking for "early morning" here means the hours it means everywhere else.
   * These used to be three hand-written options (8am to 12pm, 12pm to 4pm,
   * 4pm to 8pm) that matched neither the bands nor the surcharge boundaries,
   * so somebody could ask for an "afternoon" that started at noon and be
   * offered a midday slot, or ask for an "evening" and be surprised by a
   * premium they were never shown.
   */
  var DAY_PARTS = P.TIME_BANDS;

  /* One copy of each, because the click handler repaints this line in place
     and the two versions must not drift apart. */
  var PREF_OK = 'Good. Carry on and we will confirm a time with you.';
  var PREF_ASK = 'Pick at least one day or time of day and we will come back with a time.';

  /**
   * What to do when we cannot offer a single time.
   *
   * The worst possible answer here is a dead end. Someone has picked a
   * package, given an address and reached the last step: sending them away to
   * a contact form loses most of them. So they tell us roughly when suits and
   * carry on through the same flow, and we come back with a time.
   *
   * They CANNOT pay in full on this path. We would be holding money against a
   * time nobody has agreed to, and the first thing that happens when the
   * times do not work is a refund.
   */
  function inquiryPanel(why) {
    return '<div class="bk-noslots">' +
        '<b>' + esc(why) + '</b>' +
        '<span>Tell us roughly when suits and we will come back with a time, ' +
        'usually within a few hours. Nothing is charged until you have agreed to it.</span>' +
      '</div>' + preferPicker();
  }

  /**
   * Which days and which part of the day, on its own.
   *
   * Split out of inquiryPanel because the slot list needs it too. The list
   * used to end with "if none of it works, tell us when suits below" and
   * then nothing below, which is a dead end dressed up as an instruction.
   */
  function preferPicker() {
    var today = startOfToday();

    var days = '';
    for (var i = 1; i <= 10; i++) {
      var d = new Date(today.getTime() + i * DAY);
      var key = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
      var on = state.prefer.days.indexOf(key) > -1;
      days += '<button type="button" class="bk-pref-day' + (on ? ' on' : '') +
        '" data-prefday="' + key + '">' +
        '<b>' + d.toLocaleDateString('en-US', { weekday: 'short' }) + '</b>' +
        '<span>' + d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + '</span>' +
        '</button>';
    }

    var parts = DAY_PARTS.map(function (w) {
      var on = state.prefer.parts.indexOf(w.id) > -1;
      return '<button type="button" class="bk-pref-part' + (on ? ' on' : '') +
        (w.premium ? ' premium' : '') +
        '" data-prefpart="' + esc(w.id) + '">' +
        '<b>' + esc(w.label) + '</b><span>' + esc(w.range) + '</span>' +
        // The surcharge is named on the band they are asking for, not sprung
        // on them when we come back with a time.
        // "Usually": the fee comes from each detailer's hours (fee standard B),
        // and some evening starts are standard price (final validation,
        // November 11: Kris's 6 to 7:30pm interior starts).
        (w.premium ? '<em>usually +' + RULES.surcharge.timeOfDayBp / 100 + '% ' + (w.fromMin < 12 * 60 ? 'early start fee' : 'late start fee') + '</em>' : '') +
        '</button>';
    }).join('');

    return '<div class="bk-pref">' +
        '<h4>Which days could work?</h4>' +
        '<div class="bk-pref-days">' + days + '</div>' +
        '<h4>What time could we start?</h4>' +
        '<div class="bk-pref-parts">' + parts + '</div>' +
        (isInquiry()
          ? '<p class="bk-pref-ok">' + PREF_OK + '</p>'
          : '<p class="bk-pref-hint">' + PREF_ASK + '</p>') +
      '</div>' +
      '<p class="bk-pref-call">Rather just talk to us? Text or call ' +
        '<a href="sms:+15132792915">(513) 279-2915</a>.</p>';
  }

  function paintSlotsInner(box, team, from, to, dur, errMsg, forecast) {
    var drive = travelAllowanceMin();
    var corr = hasCorrection();
    var owner = team.members.filter(function (m) { return m.d.owner; })[0] || team.members[0];
    var weatherOk = function (startMs, minutes) { return !weatherProblem(startMs, minutes, forecast); };

    // Past a day's work this stops being a slot search and becomes a plan.
    if (!P.fitsOneDay(dur, P.LONGEST_DAY, drive, drive)) {
      var plan = P.planDays({
        serviceMinutes: dur,
        travelBeforeMin: drive,
        travelAfterMin: drive,
        preferredStartsMin: corr ? P.CORRECTION_RULES.allowedStartsMin : P.LONG_JOB_STARTS
      });
      if (!plan.ok) {
        box.innerHTML = '<p class="bk-empty">' + esc(plan.reason) +
          ' <a href="contact.html">Send us a message</a> and we will sort it out.</p>';
        return;
      }
      lastCalc = { who: new Map(), forecast: forecast, weatherReasons: {} };
      return paintMultiDay(box, owner.win, from, to, dur, plan, weatherOk);
    }

    // An hour of clearance either side, which absorbs a drive of up to 45
    // minutes. Refusing a booking because the drive home clips the buffer is
    // the scheduler making Elijah's call for him, and he would rather have
    // the job and move a little faster.
    var buffer = P.travelBufferMin(drive);
    var needs = jobNeeds();

    // Planned late arrivals per detailer (P.computeSlots lateBy), for the event's end.
    var lateBy = {};
    var startsFor = function (win, id) {
      // Each detailer's own drive here, from their home.
      var myDrive = id ? driveFor(id) : drive;
      var myBuffer = P.travelBufferMin(myDrive);
      var me = crew().filter(function (d) { return d.id === id; })[0];
      var req = {
        // "6pm" means arriving 6 to 7pm, so the drive may use that hour
        // (owner, November 11; DETAILERS arrivalWindow, 60 by default).
        arrivalWindowMin: me ? me.arrivalWindowMin : P.ARRIVAL_WINDOW_MIN,
        openBlocks: win.open,
        busy: win.busy,
        serviceDurationMin: dur,
        travelBeforeMin: myBuffer,
        travelAfterMin: myBuffer,
        granularityMin: 30,
        notBefore: from,
        notAfter: to,
        hasExterior: hasExterior(),
        // A 6pm or later job is the last of the day, so the drive home does
        // not need to fit inside the calendar.
        ignoreReturnAfterMin: P.IGNORE_RETURN_AFTER_MIN,
        // And the first job of the day is reached by leaving home earlier,
        // for a drive short enough to absorb before the day starts.
        ignoreOutboundBeforeMin: myDrive <= 60 ? P.IGNORE_OUTBOUND_BEFORE_MIN : undefined,
        lateBy: (lateBy[id || 'owner'] = new Map())
      };
      if (corr) {
        req.preferredStartsMin = { weekday: P.CORRECTION_RULES.allowedStartsMin, weekend: P.CORRECTION_RULES.allowedStartsMin };
        req.allowedWeekdays = [0, 6];
      }
      return P.computeSlots(req);
    };

    // Each detailer who can do the whole job, in booking order (Kris before
    // Elijah). They may overlap, so each is checked on their own calendars,
    // then every start goes to the first one free for it.
    var able = team.members.filter(function (m) { return P.canDo(m.d, needs); });
    if (!able.length) able = [owner];
    // Who goes first comes from "Priority: N" in each availability calendar's
    // description (docs/CALENDAR-SETUP.md); unset keeps the DETAILERS order.
    var rankOf = function (m) { return m.win && typeof m.win.priority === 'number' ? m.win.priority : 999; };
    able = able.slice().sort(function (a, b) { return rankOf(a) - rankOf(b); });
    // Why times were dropped, as 'kind:reason', for the note under the legend.
    var reasons = {};
    var free = able.map(function (m) {
      var starts = startsFor(m.win, m.d.id).filter(function (ms) {
        var p = weatherProblem(ms, dur, forecast);
        if (p) reasons[p.kind + ':' + p.reason] = true;
        return !p;
      });
      return { id: m.d.id, starts: starts };
    });
    var assigned = P.assignStarts(free);
    var slots = assigned.starts;

    lastCalc = {
      slots: slots,
      who: assigned.who,
      buffer: buffer,
      busy: able.reduce(function (all, m) { return all.concat(m.win.busy || []); }, []),
      preferred: able.length > 1 ? new Set(free[0].starts) : null,
      // Each detailer's free starts and BEST times, in priority order, for
      // "Our recommended times" (recommendBestDays).
      members: able.map(function (m, i) {
        return { id: m.d.id, starts: free[i].starts, best: m.win.best && m.win.best.length ? m.win.best : null, busy: m.win.busy || [], fees: m.win.fees || null };
      }),
      mode: team.mode,
      forecast: forecast,
      weatherReasons: reasons,
      late: lateBy
    };

    // A quoted time was never reserved, so it has to earn its place in the
    // live list. But "gone" is something we have to KNOW, not assume: only a
    // REAL calendar may take a time away, and the match is to the minute.
    if (state.quotedSlot && team.mode !== 'unconfigured') {
      var stillFree = slots.some(function (ms) {
        return Math.abs(ms - state.quotedSlot) < 60000;
      });
      if (!stillFree && state.slot === state.quotedSlot) {
        // Taken since the quote was shared: drop it and say why, as for a
        // kept draft whose time has passed. This called renderQuoteBanner(),
        // which never existed, so the call threw and the picker showed no
        // times at all, only the request form (cleanup review, November 11).
        state.slot = null;
        state.checkedSlot = null;
        state.whenNote = 'The time in your quote has been booked since. Pick another below.';
        var whenSec = root && root.querySelector('[data-sec="when"]');
        if (whenSec && !whenSec.querySelector('.bk-secnote')) {
          var h3 = whenSec.querySelector('.bk-sec-h');
          if (h3) h3.insertAdjacentHTML('afterend', '<p class="bk-err bk-secnote" role="alert">' + esc(state.whenNote) + '</p>');
        }
      }
    }

    if (errMsg && window.console) console.warn('[513] calendar:', errMsg);
    if (state.showAll) paintWeek(box, lastCalc, dur);
    else paintRecs(box, lastCalc, dur);
  }

  /* ---- the time step: our recommended times, then the whole week ---- */

  var CHEV_L = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>';
  var CHEV_R = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>';
  /** A small (i) for the in-section Continue's "what's still missing" line. */
  var INFO_IC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>';
  var TICK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>';
  var STAR = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2 6.4 20.2l1.1-6.3L2.9 9.5l6.3-.9z"/></svg>';
  // The two middle choices on the leave dialog: save for later, and ask.
  var LEAVE_SAVE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4z"/></svg>';
  var LEAVE_ASK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg>';

  /** "EST" in winter, "EDT" in summer: the abbreviation for that date in Cincinnati. */
  function zoneName(ms) {
    try {
      var part = new Intl.DateTimeFormat('en-US', { timeZone: TZ, timeZoneName: 'short' })
        .formatToParts(new Date(ms)).filter(function (x) { return x.type === 'timeZoneName'; })[0];
      return part ? part.value : 'ET';
    } catch (e) { return 'ET'; }
  }

  /** Times and days in Cincinnati time, whatever the visitor's clock says. */
  function tzTime(ms) {
    return new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: TZ })
      .replace(':00', '').replace(' AM', 'am').replace(' PM', 'pm');
  }
  function tzDay(ms, opts) {
    return new Date(ms).toLocaleDateString('en-US', Object.assign({ timeZone: TZ }, opts));
  }

  /** "10am to 12pm": the start and the estimated finish, everywhere a time is offered. */
  function spanLabel(ms, dur) {
    return tzTime(ms) + ' to ' + endLabel(localMin(ms) + dur);
  }

  /**
   * Does whoever would take this start work early or late hours anyway, so
   * no time-of-day fee (DETAILERS `noFeeStarts`, Kris at 6 to 7pm)? The
   * server makes the same call from its own copy of the setting.
   */
  function timeFeeWaived(ms, detailerId) {
    var id = detailerId || (lastCalc && lastCalc.who && lastCalc.who.get(ms));
    if (!id || id === 'owner') return false;
    var d = crew().filter(function (x) { return x.id === id; })[0];
    return Boolean(d && P.waivesFeeAt(d, ms));
  }

  /**
   * The fee the detailer's own calendar sets for this start: the OPEN block
   * it starts in, "OPEN" standard, "OPEN +20%" twenty percent (owner,
   * November 10, fee standard B). Null when their calendar has no OPEN
   * blocks: then the clock rule.
   */
  function blockFee(ms, detailerId) {
    if (!lastCalc || !lastCalc.members) return null;
    var id = detailerId || (lastCalc.who && lastCalc.who.get(ms)) || 'owner';
    var m = lastCalc.members.filter(function (x) { return x.id === id; })[0];
    return m && m.fees ? P.blockFeeAt({ fees: m.fees }, ms) : null;
  }

  /** Both surcharges for a start, as basis points, judged on the start itself. */
  function surchargeBp(ms) {
    return P.computeSurcharge(
      { startMinutesLocal: P.localMinutesOfDay(ms), priorityBooking: needsPriority(ms), timeOfDayWaived: timeFeeWaived(ms), blockFeeBp: blockFee(ms) },
      RULES.surcharge
    ).appliedBp;
  }

  /** An early or late fee applies to this start, for whoever would take it. */
  function timeFeeApplies(ms) {
    var f = blockFee(ms);
    if (f !== null) return f > 0;
    var band = P.bandOf(localMin(ms));
    return Boolean(band && band.premium && !timeFeeWaived(ms));
  }

  /** The early or late fee shown for the chosen time, for the server's fallback. */
  function shownTimeFeeBp() {
    var c = state.slot ? surchargeCtx() : null;
    return c ? P.computeSurcharge(c, RULES.surcharge).timeOfDayBp : null;
  }

  /** "+$36", or "+20%" on the Help me decide path, where nothing is priced yet. */
  function feeText(ms) {
    var bp = surchargeBp(ms);
    if (!bp) return '';
    var d = deltaFor(ms);
    return '+' + (d > 0 ? $(d) : bp / 100 + '%');
  }

  /** "rush fee", "early start fee", "rush and late start fee". */
  function feeWhy(ms) {
    var parts = [];
    if (needsPriority(ms)) parts.push('rush');
    var m = localMin(ms);
    if (timeFeeApplies(ms)) parts.push(m < 12 * 60 ? 'early start' : 'late start');
    return parts.join(' and ') + ' fee';
  }

  /**
   * One place that sets the chosen time, and who will do it.
   *
   * `via` says how it was picked (recommended, calendar, summary chip). It
   * goes to analytics with the fee and the notice, so the recommendation
   * rules can be tuned on what people actually choose (does nothing until
   * analytics is switched on and accepted).
   */
  function selectSlot(ms, via, extra) {
    if (state.slot !== ms) state.checkedSlot = null;
    state.slot = ms;
    state.slotDur = holdMinutes();
    state.whenNote = '';
    // A real time replaces a flexible-day request.
    if (state.prefer.flex) state.prefer = { parts: [], days: [] };
    state.detailer = (lastCalc && lastCalc.who && lastCalc.who.get(ms)) || 'owner';
    // The rush fee follows the time, so there is no box to tick for it.
    if (!hasCorrection()) state.priority = needsPriority(ms);
    // Minutes into the arrival window this start was planned to arrive, so
    // the booking blocks until the job really ends (computeSlots lateBy).
    var lateMap = lastCalc && lastCalc.late && lastCalc.late[state.detailer];
    state.slotLateMin = (lateMap && lateMap.get(ms)) || 0;
    // The address came first, so the drive can be measured for this time
    // (traffic matters) while they carry on.
    if (addressComplete()) measureTravel();
    if (via) {
      track('time_pick', {
        via: via,
        fee_pct: surchargeBp(ms) / 100,
        days_ahead: Math.round((ms - Date.now()) / DAY),
        start_hour: Math.floor(localMin(ms) / 60),
        start_min: localMin(ms) % 60,
        detailer: state.detailer,
        rank: extra && extra.rank || 0,
        reason: extra && extra.reason || '',
        rules: P.TIME_RECOMMENDATION_RULES.version
      });
    }
  }

  function sameMinute(a, b) { return Math.abs(a - b) < 60000; }

  /**
   * Why some times are missing, when the forecast for their address is the
   * reason: one short sentence per reason, in the order they matter.
   */
  var WORK_NAMES = { interior: 'interior work', exterior: 'exterior work', correction: 'paint correction and polishing' };

  function weatherNote(calc) {
    var keys = Object.keys(calc.weatherReasons || {});
    if (!keys.length) return '';
    var parts = [];
    keys.forEach(function (k) {
      var kind = k.split(':')[0], reason = k.split(':')[1], r = P.WEATHER_RULES[kind];
      if (reason === 'cold') parts.push('below ' + r.minTempF + '&deg;F, too cold for ' + WORK_NAMES[kind]);
      if (reason === 'rain') parts.push(kind === 'interior' ? 'a downpour is forecast' : 'rain is forecast');
      if (reason === 'heat') parts.push('over ' + r.maxSunTempF + '&deg;F in direct sun');
    });
    var season = keys.filter(function (k) { return /:season$/.test(k); }).map(function (k) { return k.split(':')[0]; });
    var html = parts.length ? 'Some times are not offered because of the forecast for your address: ' + parts.join('; ') + '.' : '';
    if (season.length) {
      html += (html ? ' ' : '') + '<b>' + (season.indexOf('exterior') > -1 ? 'Exterior details are back in spring' : 'Paint correction is back in spring') +
        '.</b> Until then we book them as far ahead as the forecast reaches, about a week, whenever it is warm and dry enough.';
    }
    if (keys.indexOf('exterior:typical') > -1) {
      html += (html ? ' ' : '') + '<b>Exterior details pause below ' + P.WEATHER_RULES.exterior.minTempF + '&deg;F.</b> ' +
        'Past the 7-day forecast, exterior times follow typical Cincinnati temperatures, so they may move if it turns colder.';
    }
    if (!state.covered && keys.some(function (k) { return /:(rain|heat)$/.test(k); })) {
      html += ' A garage or covered spot lifts the rain and sun limits: tick it on the address step.';
    }
    return '<p class="bk-wk-weather">' + html + '</p>';
  }

  /**
   * One line under "Our recommended times" when the weather removed days
   * (owner, November 11: with only two cold-weather exterior days, both in
   * the rush window, "In 3 days" and "Weekend" could not appear, and the
   * reason sat at the foot of the page). The full note stays below.
   */
  function weatherLine(calc) {
    var keys = Object.keys(calc.weatherReasons || {});
    if (!keys.length) return '';
    var kinds = [];
    keys.forEach(function (k) { var kind = k.split(':')[0]; if (kinds.indexOf(kind) < 0) kinds.push(kind); });
    var what = kinds.map(function (k) { return k === 'correction' ? 'paint correction' : k; }).join(' and ');
    var cold = keys.some(function (k) { return /:(cold|season|typical)$/.test(k); });
    // A closed season stops at the forecast's end; typical cold (exterior,
    // November 11) only removes the hours that are usually too cold.
    var season = keys.some(function (k) { return /:season$/.test(k); });
    return '<p class="bk-recs-weather"><b>' + (cold ? 'Cold weather' : 'The forecast') + '</b> ' +
      (season ? 'limits ' + esc(what) + ' times to about the next week.' : 'removes some ' + esc(what) + ' times.') + '</p>';
  }

  /** "Coating moves to a warmer day", when this start suits all but the coating. */
  function coatingNote(ms, dur) {
    return coatingMoves(ms, dur)
      ? '<span class="bk-wk-short">The ceramic coating needs ' + P.WEATHER_RULES.coating.minTempF + '&deg;F and dry weather. ' +
        'On this date we do the rest and book the coating for a warmer day.</span>'
      : '';
  }

  function unconfiguredNote(calc) {
    // A note, not a warning: these ARE our hours.
    return calc.mode === 'unconfigured'
      ? '<p class="bk-note">These are our <b>standard start times</b>. Pick whichever suits and we will ' +
        'confirm it, usually within a few hours. If a time ever needs moving we will text you first.</p>'
      : '';
  }

  /**
   * Why each day is offered, in the customer's words (reasons in week.ts).
   * The first day past the rush window says how far away it is, not what it
   * costs (owner, November 10: "3 days away", not a price).
   */
  function pickWhy(pk) {
    if (pk.reason === 'soonest') return 'Soonest';
    if (pk.reason === 'weekend') return 'Weekend';
    if (pk.reason === 'afterRush') return pk.daysAway === 1 ? 'Tomorrow' : 'In ' + pk.daysAway + ' days';
    return 'Also open';
  }

  /** "2026-11-13" for the Cincinnati day of a time, in the key format preferPicker uses. */
  function cinciKey(ms) {
    var p = tzDay(ms, { year: 'numeric', month: 'numeric', day: 'numeric' }).split('/');
    return p[2] + '-' + Number(p[0]) + '-' + Number(p[1]);
  }

  /** The day's open starts, from what the time step last read. */
  function startsOnDay(ms) {
    if (!lastCalc || !lastCalc.slots) return [];
    var key = cinciKey(ms);
    return lastCalc.slots.filter(function (s) { return cinciKey(s) === key; })
      .sort(function (x, y) { return x - y; });
  }

  /**
   * Every detailer's free BEST times (from their calendars), or null when no
   * one has set any: then the day-packing suggestions stand in, everywhere.
   */
  function bestStarts(calc) {
    var members = (calc && calc.members) || [];
    if (!members.some(function (m) { return m.best; })) return null;
    var out = [];
    var add = function (ms) { if (out.indexOf(ms) < 0) out.push(ms); };
    members.forEach(function (m) {
      if (!m.best) {
        // No BEST events: their day suggestions, as recommendBestDays uses
        // for them. Dropping them made the steer and the stars disagree with
        // the recommended times (engine check, November 10).
        var byDay = {};
        m.starts.forEach(function (ms) { (byDay[cinciKey(ms)] = byDay[cinciKey(ms)] || []).push(ms); });
        Object.keys(byDay).forEach(function (k) {
          P.daySuggestions({ starts: byDay[k], busy: m.busy || [], travelGapMin: calc.buffer, isPremium: timeFeeApplies, timeZone: TZ }).forEach(add);
        });
        return;
      }
      var free = new Set(m.starts);
      m.best.forEach(function (ms) { if (free.has(ms)) add(ms); });
    });
    return out.sort(function (a, b) { return a - b; });
  }

  /** The day's starred starts, exactly as the recommendations choose them. */
  function suggestionsOnDay(ms) {
    var best = bestStarts(lastCalc);
    if (best) {
      var key = cinciKey(ms);
      return best.filter(function (b) { return cinciKey(b) === key; });
    }
    return P.daySuggestions({
      starts: startsOnDay(ms), busy: lastCalc ? lastCalc.busy : [], travelGapMin: lastCalc ? lastCalc.buffer : 30,
      isPremium: timeFeeApplies, timeZone: TZ
    });
  }

  /**
   * OUR RECOMMENDED TIMES (owner, November 10, option C): a few one-tap
   * picks, each on its own day and labelled with why it is offered, so a
   * jump from a rush Tuesday to Friday explains itself ("Soonest", then
   * "First at the standard price"). The day is the headline. "More times on
   * Friday" opens that day's other starts, and "Flexible on the time?" sends
   * a request for a day, the way "Tell us when does" always has.
   *
   * The rules live in TIME_RECOMMENDATION_RULES (week.ts): which reasons, how
   * many, at most one with a fee, a version for analytics, and a score hook.
   * Picks past `shown` appear only when the screen has room for them.
   */
  function paintRecs(box, calc, dur) {
    var R = P.TIME_RECOMMENDATION_RULES;
    var picks = P.recommendBestDays({
      members: calc.members || [], travelGapMin: calc.buffer, timeZone: TZ, nowMs: Date.now(),
      isRush: needsPriority, isPremium: timeFeeApplies
    });

    var html = unconfiguredNote(calc) + '<div class="bk-recs">' +
      '<h4 class="bk-recs-h">Our recommended times</h4>';
    if (!picks.length) {
      html += '<p class="bk-wk-none">Nothing open in the next two weeks for this detail. ' +
        'See additional times for later dates, or tell us when suits.</p>';
    } else {
      html += '<p class="bk-recs-sub">Tap a time to pick it. We arrive within its first hour' +
        (dur ? ', and the detail takes about ' + esc(fmtDur(dur)) : '') + '.</p>' + weatherLine(calc);
    }
    picks.forEach(function (pk, i) {
      var ms = pk.ms;
      var fee = feeText(ms);
      var attrs = ' data-rank="' + (i + 1) + '" data-reason="' + pk.reason + '"';
      // Quiet (owner, November 10: the rush fee up front read as marketing):
      // a fee is one plain line, and the standard price says nothing.
      var tags = (fee ? '<span class="bk-pick-note fee">' + esc(fee + ' ' + feeWhy(ms)) + '</span>' : '') +
        (shortNotice(ms) ? '<span class="bk-pick-note">Short notice: confirmed once a detailer accepts</span>' : '') +
        (coatingMoves(ms, dur) ? '<span class="bk-pick-note">The coating moves to a warmer day</span>' : '');
      html += '<div class="bk-pickday' + (i >= R.shown ? ' extra' : '') + '" data-pickday="' + pk.dayStart + '">' +
        '<div class="bk-pick-card' + (state.slot && sameMinute(state.slot, ms) ? ' on' : '') + '">' +
          '<button type="button" class="bk-pick-go" data-slot="' + ms + '" data-go="1" data-via="recommended"' + attrs + '>' +
            '<span class="bk-pick-why">' + esc(pickWhy(pk)) + '</span>' +
            '<span class="bk-pick-line"><b>' + esc(tzDay(ms, { weekday: 'long', month: 'short', day: 'numeric' })) + '</b>' +
            '<span>' + esc(spanLabel(ms, dur)) + '</span></span>' +
            '<span class="bk-rec-go">' + CHEV_R + '</span>' +
          '</button>' +
          '<div class="bk-pick-foot">' + tags +
            '<button type="button" class="bk-pick-more" data-more="' + ms + '" data-moretimes="' + pk.more.join(',') + '"' + attrs + ' aria-expanded="false">' +
              'More times on ' + esc(tzDay(ms, { weekday: 'long' })) + '</button>' +
          '</div>' +
        '</div>' +
        '<div class="bk-recday-opts"><div class="bk-recday-in bk-more-in"></div></div>' +
      '</div>';
    });
    html += flexCard(calc) + weatherNote(calc) +
      // Pinned to the bottom of the window (owner, November 10): the ways on
      // are always on screen, and the picks above it end cut off when there
      // is more, so the "More below" cue still has something to point at.
      '<div class="bk-recs-foot bk-pinbar">' +
        '<button type="button" class="bk-recs-all" id="bkShowAll">See additional times</button>' +
        '<button type="button" class="bk-askwhen-link" id="bkAskMode2"><span class="bk-long">None of these work? Tell us when does</span><span class="bk-short">Tell us when suits</span></button>' +
      '</div></div>';
    box.innerHTML = html;
    fitPicks(box);
    updateCue();
    renderNav();
    renderTotal();
    updatePick();
    trackRecsShown(box);
  }

  /**
   * More picks when the screen has room (owner, November 10): an extra pick
   * stays while the card itself ends inside the first screen. "Everything
   * fits" never happened (the flexible card and the links fill the rest), so
   * those may now start below the fold, cut off, which is the cue to scroll.
   * The pinned bar and a peek of the next card come off the room first.
   */
  function fitPicks(box) {
    var sc = el('bkScroll');
    if (!sc) return;
    // On the checkout the times sit mid-page, so "room on the first screen"
    // does not apply: the usual three.
    if (onCheckout()) {
      box.querySelectorAll('.bk-pickday.extra').forEach(function (d) { d.hidden = true; });
      return;
    }
    var top = sc.getBoundingClientRect().top;
    var pin = box.querySelector('.bk-pinbar');
    // The pinned bar covers the foot of the window, and the next card should
    // still show its top above it (PEEK), so the screen ends cut off.
    var PEEK = 44;
    var limit = sc.clientHeight - (pin ? pin.offsetHeight : 0) - PEEK;
    var full = false;
    box.querySelectorAll('.bk-pickday.extra').forEach(function (d) {
      if (!full && d.getBoundingClientRect().bottom - top > limit) full = true;
      d.hidden = full;
    });
  }

  /**
   * What was offered, once per distinct set, so the rules can be judged on
   * which picks get booked (time_pick carries the same rank and reason).
   * Compact: "soonest:20:0:13" is reason, fee %, days ahead, start hour.
   */
  var lastRecsShown = '';
  function trackRecsShown(box) {
    var shown = [].slice.call(box.querySelectorAll('.bk-pickday:not([hidden]) .bk-pick-go')).map(function (b) {
      var ms = Number(b.dataset.slot);
      return b.dataset.reason + ':' + surchargeBp(ms) / 100 + ':' + Math.round((ms - Date.now()) / DAY) + ':' + Math.floor(localMin(ms) / 60);
    }).join('|');
    if (!shown || shown === lastRecsShown) return;
    lastRecsShown = shown;
    track('time_recs_shown', {
      rules: P.TIME_RECOMMENDATION_RULES.version,
      count: shown.split('|').length,
      picks: shown,
      flexible: Boolean(box.querySelector('[data-flexwrap]'))
    });
  }

  /** Open one panel under a pick (or the flexible card), closing the others. */
  function togglePanel(wrap, btn) {
    var open = !wrap.classList.contains('open');
    root.querySelectorAll('.bk-pickday.open').forEach(function (d) {
      d.classList.remove('open');
      var b = d.querySelector('[aria-expanded]');
      if (b) b.setAttribute('aria-expanded', 'false');
      d.querySelectorAll('.bk-recday-in button, .bk-recday-in select').forEach(function (x) { x.tabIndex = -1; });
    });
    if (!open) return false;
    wrap.classList.add('open');
    btn.setAttribute('aria-expanded', 'true');
    var opts = wrap.querySelectorAll('.bk-recday-in button, .bk-recday-in select');
    opts.forEach(function (x) { x.tabIndex = 0; });
    // Focus lands on a suggested time, not on whatever is first (often an
    // early start with a fee), so the ring does not look like a choice.
    var first = wrap.querySelector('.bk-recday-in .sug') || wrap.querySelector('.bk-recday-in button') || opts[0];
    if (first) setTimeout(function () { first.focus({ preventScroll: true }); }, 0);
    return true;
  }

  /** "More times on Friday": that day's starts, one per hour, one tap each. */
  function openMoreTimes(btn) {
    var wrap = btn.closest('.bk-pickday');
    var inner = wrap.querySelector('.bk-more-in');
    if (!inner.innerHTML) {
      var dur = holdMinutes();
      var lead = Number(btn.dataset.more);
      var best = String(btn.dataset.moretimes || '').split(',').map(Number).filter(Boolean);
      var chip = function (ms) {
        var fee = feeText(ms);
        return '<button type="button" class="bk-more-t" data-slot="' + ms +
          '" data-go="1" data-via="recommended_more" data-rank="' + btn.dataset.rank + '" data-reason="' + btn.dataset.reason + '" tabindex="-1">' +
          '<b>' + esc(spanLabel(ms, dur)) + '</b>' +
          (fee ? '<span><em class="fee">' + esc(fee + ' ' + feeWhy(ms)) + '</em></span>' : '') + '</button>';
      };
      // Only the other best times that day (owner, November 10: never every
      // half hour), then any other start through one quiet dropdown.
      var others = startsOnDay(lead).filter(function (ms) {
        return !sameMinute(ms, lead) && !best.some(function (b2) { return sameMinute(ms, b2); });
      });
      inner.innerHTML = best.map(chip).join('') +
        (others.length
          ? '<label class="bk-more-other"><span>Need a different start?</span>' +
            '<select data-otherstart data-rank="' + btn.dataset.rank + '" data-reason="' + btn.dataset.reason + '" tabindex="-1">' +
            '<option value="">Choose a time</option>' +
            others.map(function (ms) {
              var fee = feeText(ms);
              return '<option value="' + ms + '">' + esc(spanLabel(ms, dur) + (fee ? ' (' + fee + ')' : '')) + '</option>';
            }).join('') + '</select></label>'
          : '');
    }
    if (togglePanel(wrap, btn)) {
      track('time_more_open', { rank: Number(btn.dataset.rank), reason: btn.dataset.reason, rules: P.TIME_RECOMMENDATION_RULES.version });
    }
  }

  /**
   * "Flexible on the time?" (owner, November 10, no discount): pick a day and
   * we text the start time by the evening before. It is the same request as
   * "Tell us when does" (state.prefer, isInquiry), for that one day at any
   * time, so it is priced, sent and confirmed the way requests always are.
   * Only days with a standard-price start, so nothing on it carries a fee.
   */
  function flexCard(calc) {
    var seen = {};
    var days = [];
    calc.slots.slice().sort(function (x, y) { return x - y; }).forEach(function (ms) {
      var k = cinciKey(ms);
      if (seen[k] || surchargeBp(ms) > 0) return;
      seen[k] = true;
      days.push(ms);
    });
    days = days.slice(0, 7);
    if (!days.length) return '';
    // The day already chosen shows as chosen, with the panel open, when Time
    // is opened again (checkout review, November 10).
    var chosen = state.prefer.flex && state.prefer.days[0];
    var isOpen = Boolean(chosen) && days.some(function (ms) { return cinciKey(ms) === chosen; });
    return '<div class="bk-pickday bk-flex' + (isOpen ? ' open' : '') + '" data-flexwrap>' +
      '<div class="bk-flex-card">' +
        '<div class="bk-flex-t"><b>Flexible on the time?</b>' +
        '<span>Pick a day and we text you the start time by the evening before. Nothing is charged until you agree to it.</span></div>' +
        '<button type="button" class="bk-flex-b" id="bkFlexOpen" aria-expanded="' + isOpen + '">Choose a day</button>' +
      '</div>' +
      '<div class="bk-recday-opts"><div class="bk-recday-in bk-flex-in">' +
        days.map(function (ms) {
          var on = isOpen && cinciKey(ms) === chosen;
          return '<button type="button" class="bk-flex-day' + (on ? ' on' : '') + '" data-flexday="' + ms + '" tabindex="' + (isOpen ? 0 : -1) + '">' +
            '<b>' + esc(tzDay(ms, { weekday: 'short' })) + '</b><span>' + esc(tzDay(ms, { month: 'short', day: 'numeric' })) + '</span></button>';
        }).join('') +
      '</div></div></div>';
  }

  /** The time step's index, for "Change" in the bottom bar. */
  function timeStepIndex() {
    for (var i = 0; i < STEPS.length; i++) if (STEPS[i].id === 'time') return i;
    return -1;
  }

  /**
   * The suggested start to offer instead of the chosen one: the nearest
   * starred start that same day AT THE SAME PRICE. Owner, November 10: "not
   * at the cost of a timing fee upsell", which means never steering someone
   * off a time they are paying an early or late fee for (round 9 read it as
   * "never add a fee" and offered 10am, rush only, for a 6am rush + early
   * pick: a downsell). Suggested starts are never early or late, so a fee
   * pick gets no suggestion. None once they have taken a suggestion, or when
   * the time they picked is already one.
   */
  function steerFor(ms) {
    if (state.steerUsed || !ms) return null;
    var sug = suggestionsOnDay(ms);
    if (!sug.length || sug.some(function (s) { return sameMinute(s, ms); })) return null;
    var bp = surchargeBp(ms);
    var best = null;
    sug.forEach(function (s) {
      if (surchargeBp(s) !== bp) return;
      if (best === null || Math.abs(s - ms) < Math.abs(best - ms)) best = s;
    });
    return best;
  }

  /**
   * The chosen time, in the middle of the bottom bar, from the time step to
   * the last step (owner, November 10). One row, as tall as Continue. On the
   * steps after Time it carries "Change", and the suggested time sits beside
   * it until it is taken. Gone once the booking is sent.
   */
  var steerShown = '';
  function updatePick() {
    var ms = state.slot;
    var ti = timeStepIndex();
    if (state.done || !ms || isInquiry() || state.timeMode === 'ask' || state.step < ti) return setPick('');
    // On the checkout the folded Time row already shows the time with its
    // Change, so the bottom bar only carries a suggestion, if there is one
    // (checkout review, November 10: the time was on screen four times).
    if (onCheckout() && state.ckDone.when && !steerFor(ms)) return setPick('');
    var fee = feeText(ms);
    // No "Change" while Time is open: the times are already on screen.
    var later = state.step > ti && !(onCheckout() && ckOpenId() === 'when');
    // Compact, so the line fits beside a suggestion: "+$37.50 rush + early".
    // The full wording, short notice included, is on the steps themselves.
    // The fee's one name (owner's approval, November 10), in dollars.
    var price = fee ? fee + ' ' + feeWhy(ms) : 'Standard price';
    var to = steerFor(ms);
    // Labelled as the chosen time (owner, November 10: it has to read as
    // "this is your time", not as one more option).
    setPick(
      '<span class="bk-pick-txt"><i class="bk-pick-eye">' + TICK + 'Your time</i>' +
        '<b>' + esc(tzDay(ms, { weekday: 'short', month: 'short', day: 'numeric' }) + ', ' + spanLabel(ms, holdMinutes())) + '</b>' +
        '<span><span class="bk-pick-price' + (fee ? ' fee' : '') + '">' + esc(price) + '</span>' +
        (later ? '<button type="button" class="bk-pick-change" id="bkPickChange">Change</button>' : '') + '</span></span>' +
      (to
        ? '<button type="button" class="bk-steer" data-steer="' + to + '">' + STAR +
            'Change to suggested? <b>' + esc(spanLabel(to, holdMinutes())) + '</b></button>'
        : '')
    );
    markSteering(Boolean(to));
    if (to && steerShown !== ms + '>' + to) {
      steerShown = ms + '>' + to;
      track('time_steer_shown', { step: step().id, shift_min: Math.round((to - ms) / 60000), rules: P.TIME_RECOMMENDATION_RULES.version });
    }
  }


  function paintWeek(box, calc, dur) {
    var now = Date.now();
    var ws = state.weekStart;
    var nextWs = P.addWeeks(ws, 1);
    var canNext = nextWs < lastBookableMs();
    var canPrev = ws > P.weekStartOf(now);
    var week = P.buildWeek({
      slots: calc.slots, weekStart: ws, busy: calc.busy, travelGapMin: calc.buffer,
      nowMs: now, needsPriority: needsPriority, timeZone: TZ,
      // Down to the last hour an offered job is still running in, no further.
      lastRowMin: P.lastRowForSlots(calc.slots, dur),
      // Stars on the calendars' best times, when they set any.
      suggested: bestStarts(calc) || undefined
    });

    // Landing on an empty week shows the next one with something in it,
    // until the customer starts moving weeks themselves.
    if (!week.openCount && !state.weekTouched && canNext && autoSkips < 4) {
      autoSkips++;
      state.weekStart = nextWs;
      return loadSlots();
    }

    var slotHere = state.slot && state.slot >= ws && state.slot < nextWs &&
      calc.slots.some(function (ms) { return sameMinute(ms, state.slot); });

    var first = week.days[0], last = week.days[6];
    var title = tzDay(first.dayStart + DAY / 2, { month: 'short', day: 'numeric' }) + ' to ' +
      (first.mo === last.mo ? last.d : tzDay(last.dayStart + DAY / 2, { month: 'short', day: 'numeric' }));
    var narrow = phoneView();
    paintedNarrow = narrow;

    var html = '<div class="bk-wk' + (narrow ? ' narrow' : '') + '">' + unconfiguredNote(calc) +
      '<button type="button" class="bk-wk-more bk-wk-recs" id="bkShowRecs">' + CHEV_L + 'Back to recommended times</button>';

    // The time zone under the dates it applies to (was a paragraph under the
    // grid, November 10).
    html += '<div class="bk-wk-h"><div class="bk-wk-ttl"><h4 id="bkWkTitle">' + esc(title) + '</h4>' +
      '<span class="bk-wk-tz">Hours are in Cincinnati Time Zone (' + zoneName(first.dayStart + DAY / 2) + ')' +
      (canNext ? '' : '. We take bookings up to a year ahead') + '</span></div><div class="bk-wk-nav">' +
      (canPrev ? '<button type="button" class="bk-wk-today" id="bkWkToday">This week</button>' : '') +
      '<button type="button" class="bk-wk-arrow" id="bkWkPrev" aria-label="Previous week"' + (canPrev ? '' : ' disabled') + '>' + CHEV_L + '</button>' +
      '<button type="button" class="bk-wk-arrow" id="bkWkNext" aria-label="Next week"' + (canNext ? '' : ' disabled') + '>' + CHEV_R + '</button>' +
      '</div></div>';

    // One short key (owner, November 11: no ticks, no green boxes; a time
    // says its own price). What makes a fee is one tap away, not a paragraph.
    // The fee hours come from each calendar's OPEN blocks now, so the note
    // names the kinds of time, not fixed hours.
    html += '<div class="bk-wk-legend">' +
      '<span><i class="bk-wk-key sug">' + STAR + '</i>Suggested</span>' +
      (narrow ? '' : '<span><i class="bk-wk-key no"></i>Not available</span>') +
      '<button type="button" class="bk-wk-feeq" id="bkFeeWhy" aria-expanded="false" aria-controls="bkFeeRules">When is there a fee?</button>' +
      '<p class="bk-wk-rules" id="bkFeeRules" hidden>Some times cost a little more: ' + rushWords() +
        '. When a time costs more, it says so in gold.</p>' +
      '</div>' + weatherNote(calc);

    if (!week.openCount) {
      html += '<div class="bk-wk-empty"><b>Nothing open this week for this detail.</b>' +
        (canNext ? '<button type="button" class="bk-wk-more" id="bkWkNext2">See the next week</button>' : '') +
        '</div>';
    }

    // The chosen time, start to finish, sits in the bottom bar; the coating
    // note is too long for it and stays here.
    updatePick();
    if (slotHere) {
      html += coatingNote(state.slot, dur) ? '<p class="bk-wk-sum other">' + coatingNote(state.slot, dur) + '</p>' : '';
    } else if (state.slot) {
      html += '<p class="bk-wk-sum other">You picked <b>' +
        esc(tzDay(state.slot, { weekday: 'long', month: 'long', day: 'numeric' }) + ', ' + spanLabel(state.slot, dur)) +
        '</b>. <button type="button" class="bk-wk-more" id="bkWkBack">Show that week</button></p>';
    }

    // A strip of the seven days, then the open day: a timeline on wide
    // screens (option C), a list on phones (option B). Owner's picks,
    // November 11. Both open on the regular hours, with the early and late
    // ones a tap away.
    var sel = pickDay(week);
    html += dayStrip(week, sel) + (narrow ? dayList(week.days[sel], dur) : dayTimeline(week.days[sel], week.rows, dur));

    // Go to a date, and the way out, in one bar pinned to the bottom of the
    // window, like the one under our recommended times.
    html += '<div class="bk-wk-gobar bk-pinbar"><label class="bk-wk-go"><span class="bk-long">Go to a date</span><span class="bk-short">Go to</span> ' +
      '<input type="date" data-weekjump min="' + dateInputValue(now) + '" max="' + dateInputValue(lastBookableMs()) + '" /></label>' +
      '<button type="button" class="bk-askwhen-link" id="bkAskMode2"><span class="bk-long">None of these work? Tell us when does</span><span class="bk-short">Tell us when suits</span></button>' + '</div>';

    box.innerHTML = html + '</div>';
    if (narrow) pinWeek();
    if (wkScrollUp) {
      wkScrollUp = false;
      var wkTop = box.querySelector('.bk-wk'), scr = el('bkScroll');
      if (wkTop && scr && wkTop.getBoundingClientRect) scr.scrollTop += wkTop.getBoundingClientRect().top - scr.getBoundingClientRect().top - 8;
    }
    updateCue();
    renderNav();
    renderTotal();
  }

  /** A start, read out in full by a screen reader. */
  function startLabel(day, ms, dur, suggested) {
    var name = tzDay(day.dayStart + DAY / 2, { weekday: 'long', month: 'long', day: 'numeric' });
    return name + ', ' + spanLabel(ms, dur) + ', ' + priceWords(ms).toLowerCase() + (suggested ? ', suggested' : '');
  }

  /** "Standard price" or "+$25 rush fee": the price in words, said once per stretch. */
  function priceWords(ms) {
    var fee = feeText(ms);
    return fee ? fee + ' ' + feeWhy(ms) : 'Standard price';
  }

  /** The price as a row shows it: in words at the start of a stretch, else "+$25" or nothing. */
  function priceTag(ms, words) {
    var fee = feeText(ms);
    var text = words ? priceWords(ms) : fee;
    return '<span class="bk-px' + (fee ? ' fee' : ' std') + '">' + esc(text) + '</span>';
  }

  function cellHas(cell, ms) {
    return Boolean(ms) && cell.starts.some(function (s) { return sameMinute(s, ms); });
  }

  /** Every start of a day, in order, and whether it is one of our suggestions. */
  function dayStarts(day) {
    var out = [];
    day.cells.forEach(function (c) {
      c.starts.forEach(function (ms) { out.push({ ms: ms, sug: c.suggested && sameMinute(c.pick, ms) }); });
    });
    return out;
  }

  var CHEV_UP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>';
  var CHEV_DN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';

  /** The regular hours a day opens on (owner, November 10): starts from 10am to before 6pm. */
  var REG_FROM = 10 * 60, REG_TO = 18 * 60;

  /**
   * Whether the early and late starts are shown. Folded behind "Earlier
   * times" and "Later times" until asked for, unless the chosen time is
   * there, or the day has nothing in the regular hours to open on.
   */
  function foldsOpen(starts) {
    var reg = starts.some(function (s) { var m = localMin(s.ms); return m >= REG_FROM && m < REG_TO; });
    var mine = state.slot && starts.some(function (s) { return sameMinute(s.ms, state.slot); });
    var at = mine ? localMin(state.slot) : -1;
    return {
      early: state.wkEarly || !reg || (mine && at < REG_FROM),
      late: state.wkLate || !reg || (mine && at >= REG_TO),
    };
  }

  /** "Earlier times, 6am to 9:30am": opens the folded starts. */
  function foldButton(side, list) {
    var a = tzTime(list[0].ms), b = tzTime(list[list.length - 1].ms);
    return '<button type="button" class="bk-wk-fold" data-wkfold="' + side + '">' + (side === 'early' ? CHEV_UP : CHEV_DN) +
      (side === 'early' ? 'Earlier times, ' : 'Later times, ') + (list.length > 1 ? a + ' to ' + b : a) + '</button>';
  }

  /** The day open in the strip: the one picked, else the chosen time's, else the first with times. */
  function pickDay(week) {
    var sel = state.weekDay;
    if (sel >= 0 && sel <= 6) return sel;
    sel = -1;
    week.days.forEach(function (day, i) {
      if (sel < 0 && day.cells.some(function (c) { return cellHas(c, state.slot); })) sel = i;
    });
    if (sel < 0) week.days.forEach(function (day, i) {
      if (sel < 0 && day.cells.some(function (c) { return c.pick !== null; })) sel = i;
    });
    if (sel < 0) week.days.forEach(function (day, i) { if (sel < 0 && !day.past) sel = i; });
    return sel < 0 ? 0 : sel;
  }

  /**
   * Seven days. The bar under each date fills to how much of that day is
   * still open (owner, November 11): green when it has standard-price times,
   * gold when every time left has a fee, hatched when nothing is open.
   */
  function dayStrip(week, sel) {
    var html = '<div class="bk-wk-strip" role="tablist" aria-labelledby="bkWkTitle">';
    week.days.forEach(function (day, i) {
      var starts = dayStarts(day);
      var std = starts.some(function (s) { return !surchargeBp(s.ms); });
      // Against what a free day could offer this job (owner, November 11).
      var fill = Math.max(12, Math.round(P.dayOpenShare(day, holdMinutes(), hasExterior()) * 100));
      var name = tzDay(day.dayStart + DAY / 2, { weekday: 'long', month: 'long', day: 'numeric' });
      html += '<button type="button" class="bk-wk-day' + (i === sel ? ' on' : '') + (day.past ? ' past' : '') +
        '" role="tab" aria-selected="' + (i === sel) + '" data-wkday="' + i + '" aria-label="' +
        esc(name + ', ' + (starts.length ? starts.length + (starts.length === 1 ? ' time' : ' times') + ' open' : 'nothing open')) + '">' +
        '<b>' + tzDay(day.dayStart + DAY / 2, { weekday: 'short' }) + '</b><span>' + day.d + '</span>' +
        '<i class="bk-wk-bar' + (starts.length ? '' : ' no') + '" aria-hidden="true">' +
          (starts.length ? '<i class="' + (std ? 'ok' : 'fee') + '" style="width:' + fill + '%"></i>' : '') + '</i>' +
        (day.rush ? '<em>Rush</em>' : '') +
        '</button>';
    });
    return html + '</div>';
  }

  /**
   * Phones: the open day's times under part-of-day headings, each heading
   * pinned while its times are on screen (owner, November 11). A price the
   * whole part of the day shares is said once, in its heading; otherwise once
   * at the start of each stretch.
   */
  function dayList(day, dur) {
    var cells = day.cells.filter(function (c) { return c.pick !== null; });
    if (!cells.length) {
      return '<p class="bk-wk-none">Nothing open on ' +
        esc(tzDay(day.dayStart + DAY / 2, { weekday: 'long' })) + '. Try another day.</p>';
    }
    var folds = foldsOpen(dayStarts(day));
    var early = cells.filter(function (c) { return c.hourMin < REG_FROM; });
    var late = cells.filter(function (c) { return c.hourMin >= REG_TO; });
    var startsOf = function (list) {
      var out = [];
      list.forEach(function (c) { c.starts.forEach(function (ms) { out.push({ ms: ms }); }); });
      return out;
    };

    var shown = cells.filter(function (c) {
      return (c.hourMin >= REG_FROM || folds.early) && (c.hourMin < REG_TO || folds.late);
    });
    var groups = [];
    shown.forEach(function (c) {
      var band = P.bandOf(c.hourMin);
      var id = band ? band.id : '';
      if (!groups.length || groups[groups.length - 1].id !== id) groups.push({ id: id, label: band ? band.label : '', cells: [] });
      groups[groups.length - 1].cells.push(c);
    });

    var html = '<div class="bk-wk-list">' + (early.length && !folds.early ? foldButton('early', startsOf(early)) : '');
    groups.forEach(function (g) {
      var rows = g.cells.map(function (c) {
        var on = cellHas(c, state.slot);
        return { cell: c, on: on, ms: on ? state.slot : c.pick };
      });
      var keys = rows.map(function (r) { return priceWords(r.ms); });
      var same = keys.every(function (k) { return k === keys[0]; });
      var first = P.stretchStarts(keys);
      // A div, not a section: the site's section padding would open gaps.
      html += '<div class="bk-wk-sec" role="group" aria-label="' + esc(g.label) + '"><h5 class="bk-wk-band">' + esc(g.label) +
        (same ? priceTag(rows[0].ms, true) : '') + '</h5>';
      rows.forEach(function (r, i) {
        var c = r.cell;
        var sug = c.suggested && sameMinute(r.ms, c.pick);
        // The other start in this hour (half past, or on the hour), one tap too.
        var alts = c.starts.filter(function (x) { return !sameMinute(x, r.ms); });
        // One price for the whole part of the day: said once, on its heading.
        // Otherwise each row carries both forms and the highest one you can
        // see of each stretch says it in words (markAllLeads).
        html += '<div class="bk-wk-row"><button type="button" class="bk-wk-item' + (r.on ? ' on' : '') + (!same && first[i] ? ' lead' : '') +
          '" data-slot="' + r.ms + '"' + (same ? '' : ' data-pw="' + esc(keys[i]) + '"') +
          ' aria-pressed="' + r.on + '" aria-label="' + esc(startLabel(day, r.ms, dur, sug)) + '">' +
          '<b>' + esc(spanLabel(r.ms, dur)) + '</b>' + (same ? priceTag(r.ms, false) : rowPrice(r.ms)) +
          (sug ? '<em>' + STAR + 'Suggested</em>' : '') +
          '</button>' +
          alts.map(function (x) {
            return '<button type="button" class="bk-wk-alt" data-slot="' + x + '" aria-label="' +
              esc('Start at ' + spanLabel(x, dur) + ', ' + priceWords(x).toLowerCase()) + '">' +
              '<i>or</i>' + esc(tzTime(x)) + '</button>';
          }).join('') + '</div>';
      });
      html += '</div>';
    });
    return html + (late.length && !folds.late ? foldButton('late', startsOf(late)) : '') + '</div>';
  }

  /** Each half-hour row of the day timeline is this tall, plus the gap under it (book.css .bk-tl). */
  var TL_ROW = 30, TL_GAP = 2;

  /**
   * Laptops, desktops and tablets: one day as a timeline, every half hour
   * its own row (owner's pick, option C, November 11). Pointing at a start,
   * or tapping it, draws the whole job over the rows it covers, start to
   * estimated finish, with its price once.
   */
  function dayTimeline(day, rows, dur) {
    var html = '<h5 class="bk-tl-day">' + esc(tzDay(day.dayStart + DAY / 2, { weekday: 'long', month: 'long', day: 'numeric' })) + '</h5>';
    var starts = dayStarts(day);
    if (!starts.length) {
      return html + '<p class="bk-wk-none">Nothing open on ' +
        esc(tzDay(day.dayStart + DAY / 2, { weekday: 'long' })) + '. Try another day.</p>';
    }
    var folds = foldsOpen(starts);
    var byMin = {};
    starts.forEach(function (s) { byMin[localMin(s.ms)] = s; });

    // Rows from the first time shown to the end of the last job that can
    // start in them: a grey row only between two times, or under a job's
    // tail (owner, November 11: no dead rows).
    var range = P.timelineRange(starts.map(function (s) { return localMin(s.ms); }), dur, folds,
      { from: REG_FROM, to: REG_TO }, rows[rows.length - 1] + 60);
    if (!range) range = { from: localMin(starts[0].ms), last: localMin(starts[0].ms), to: localMin(starts[0].ms) + 30 };
    var shown = [];
    for (var m = range.from; m < range.to; m += 30) shown.push(m);
    var hidEarly = folds.early ? [] : starts.filter(function (s) { return localMin(s.ms) < REG_FROM; });
    var hidLate = folds.late ? [] : starts.filter(function (s) { return localMin(s.ms) >= REG_TO; });
    // Rows after the last start shown are only the tail of its job.
    byMin = {};
    starts.forEach(function (s) { var x = localMin(s.ms); if (x >= range.from && x <= range.last) byMin[x] = s; });

    var mine = -1;
    shown.forEach(function (x, i) { if (byMin[x] && sameMinute(byMin[x].ms, state.slot)) mine = i; });
    var cover = mine > -1 ? Math.ceil(dur / 30) : 0;
    // The price in words goes on the first row of each stretch that can be
    // SEEN: rows under the chosen job count as hidden, so the row after it
    // says "+$25 rush fee", not just "+$25" (owner, November 11).
    var first = P.stretchStarts(shown.map(function (x, i) {
      return byMin[x] && !(mine > -1 && i >= mine && i < mine + cover) ? priceWords(byMin[x].ms) : null;
    }));

    html += hidEarly.length ? foldButton('early', hidEarly) : '';
    var dayName = tzDay(day.dayStart + DAY / 2, { weekday: 'long', month: 'long', day: 'numeric' });
    html += '<div class="bk-tl" data-dur="' + dur + '" data-day="' + esc(dayName) + '" data-rows="' + shown.length +
      '" style="grid-template-rows:repeat(' + shown.length + ', ' + TL_ROW + 'px)">';
    shown.forEach(function (x, i) {
      var s = byMin[x];
      var under = mine > -1 && i >= mine && i < mine + cover ? ' under' : '';
      var tail = x > range.last;
      html += '<span class="bk-tl-t' + (x % 60 ? ' half' : '') + (tail ? ' tail' : '') + '" style="grid-row:' + (i + 1) + '">' + endLabel(x) + '</span>';
      if (tail) {
        html += '<span class="bk-tl-s tail' + under + '" style="grid-row:' + (i + 1) + '" data-row="' + i + '" aria-hidden="true"></span>';
        return;
      }
      if (!s) {
        html += '<span class="bk-tl-s no' + under + '" style="grid-row:' + (i + 1) + '" data-row="' + i + '" aria-hidden="true"></span>';
        return;
      }
      var on = i === mine;
      html += '<button type="button" class="bk-tl-s ' + (feeText(s.ms) ? 'fee' : 'std') + under +
        (first[i] ? ' lead' : '') + '" style="grid-row:' + (i + 1) + '" data-slot="' + s.ms + '" data-row="' + i + '"' + (s.sug ? ' data-sug="1"' : '') +
        ' data-pw="' + esc(priceWords(s.ms)) + '" aria-pressed="' + on + '" aria-label="' + esc(startLabel(day, s.ms, dur, s.sug)) + '">' +
        rowPrice(s.ms) + (s.sug ? '<em class="bk-tl-star">' + STAR + 'Suggested</em>' : '') + '</button>';
    });
    // The chosen job, start to finish, and one for pointing at a start.
    if (mine > -1) html += tlBlock(byMin[shown[mine]].ms, mine, shown.length, dur, 'mine');
    html += '<div class="bk-tl-span preview" id="bkTlPreview" aria-hidden="true" hidden></div>';
    // The side card (owner's pick C, November 11): the chosen time, else the
    // suggested start, else the first; pointing at a start shows that one.
    var cardRow = mine;
    if (cardRow < 0) shown.forEach(function (x, i) { if (cardRow < 0 && byMin[x] && byMin[x].sug) cardRow = i; });
    if (cardRow < 0) shown.forEach(function (x, i) { if (cardRow < 0 && byMin[x]) cardRow = i; });
    if (cardRow > -1) {
      html += '<aside class="bk-tl-card" id="bkTlCard" data-ms="' + byMin[shown[cardRow]].ms + '" style="grid-row:1 / span ' + shown.length + '" aria-live="polite">' +
        tlCard(byMin[shown[cardRow]].ms, cardRow, dur, dayName, byMin[shown[cardRow]].sug, cardRow === mine) + '</aside>';
    }
    html += '</div>';
    return html + (hidLate.length ? foldButton('late', hidLate) : '');
  }

  /**
   * The job's block: it spans the rows the job touches, and its box is as
   * tall as the job to the minute. The price is said once, in the middle.
   * No "Suggested" tag: a suggestion is marked on its own row only, so a
   * chosen job never reads as the suggestion (owner, November 11).
   */
  function tlBlock(ms, row, rows, dur, cls) {
    var span = Math.max(1, Math.min(rows - row, Math.ceil(dur / 30)));
    return '<div class="bk-tl-span' + (cls ? ' ' + cls : '') + '" aria-hidden="true" style="grid-row:' + (row + 1) + ' / span ' + span + '">' +
      tlBlockInner(ms, dur) + '</div>';
  }
  function tlBlockInner(ms, dur) {
    var h = Math.round(dur / 30 * (TL_ROW + TL_GAP) - TL_GAP);
    // The price is on the side card, so the block says the time and the length.
    return '<i style="height:' + h + 'px"><b>' + esc(spanLabel(ms, dur)) + '</b>' +
      '<span class="bk-tl-len">About ' + esc(fmtDur(dur)) + ' detailing</span></i>';
  }

  /** "Arriving between 6 and 7am" (owner, November 11). */
  function arrivingBetween(ms) {
    return 'Arriving between ' + arrivalWindow(ms).replace(' to ', ' and ');
  }

  /**
   * The side card: the day, the time, its price in words, when we arrive and
   * for how long. Its button is the same start as its row (data-slot and
   * data-row), so it picks the time the way a tap on the row does.
   */
  function tlCard(ms, row, dur, dayName, sug, chosen) {
    return '<h6>' + esc(dayName) + '</h6>' +
      (sug ? '<em class="bk-tl-star">' + STAR + 'Suggested</em>' : '') +
      '<b>' + esc(spanLabel(ms, dur)) + '</b>' + priceTag(ms, true) +
      '<p>' + esc(arrivingBetween(ms)) + '</p>' +
      '<p>About ' + esc(fmtDur(dur)) + ' detailing</p>' +
      (chosen ? '<p class="bk-tl-card-mine">' + TICK + 'Your time</p>' : '') +
      // Chosen or not, the button moves on with this time (owner, November
      // 12: a tap on a row only selects it).
      '<button type="button" class="bk-tl-card-go" data-slot="' + ms + '" data-row="' + row + '"' + (sug ? ' data-sug="1"' : '') +
        ' data-via="timeline_card">' + (chosen ? 'Continue with this time' : 'Choose this time') + '</button>';
  }
  /** A short fade as text changes in place (none when motion is reduced). */
  function fadeIn(node, from, ms) {
    if (node && node.animate && !reducedMotion()) node.animate([{ opacity: from || 0.25 }, { opacity: 1 }], { duration: ms || 150, easing: 'ease-out' });
  }
  /**
   * Words wait until the pointer settles on a start (owner, November 12:
   * sweeping down the rows rewrote the card, the block's time and the fee
   * words on every row, a flicker of fades). The block glides with the
   * pointer at once, its words dimmed (.moving); once the pointer rests,
   * the block's time, the fee words on the rows and the card change
   * together, fading in. A tap changes them straight away.
   */
  var tlSettleTimer = null;
  var TL_SETTLE = 160;
  function settleTl(tl, t, now) {
    clearTimeout(tlSettleTimer);
    var run = function () {
      if (tl.isConnected === false) return;
      var pv = tl.querySelector('#bkTlPreview');
      if (pv && pv.classList.contains('moving')) {
        if (pv.dataset.ms) pv.innerHTML = tlBlockInner(Number(pv.dataset.ms), Number(tl.dataset.dur));
        void pv.offsetWidth; // the new words start dimmed, then fade up
        pv.classList.remove('moving');
      }
      markAllLeads();
      // The card follows the start being pointed at, but not its own button.
      if (!(t && t.closest('#bkTlCard'))) renderTlCard(tl, t);
    };
    if (now) return run();
    tlSettleTimer = setTimeout(run, TL_SETTLE);
  }
  function renderTlCard(tl, t) {
    var card = tl && tl.querySelector('#bkTlCard');
    if (!card) return;
    var src = t || tl.querySelector('.bk-tl-s[aria-pressed="true"]') || tl.querySelector('.bk-tl-s[data-sug]') || tl.querySelector('.bk-tl-s[data-slot]');
    if (!src) return;
    // Rewritten only when the time it shows changes, with a short fade.
    if (card.dataset.ms === src.dataset.slot) return;
    card.dataset.ms = src.dataset.slot;
    fadeIn(card, 0.55, 220);
    card.innerHTML = tlCard(Number(src.dataset.slot), Number(src.dataset.row), Number(tl.dataset.dur), tl.dataset.day,
      Boolean(src.dataset.sug), src.getAttribute('aria-pressed') === 'true');
  }

  /** A timeline row's price, both ways: in words when the row leads its stretch (.lead), else "+$25" or nothing. */
  function rowPrice(ms) {
    var fee = feeText(ms);
    return '<span class="bk-px' + (fee ? ' fee' : ' std') + '"><span class="pw-l">' + esc(priceWords(ms)) +
      '</span><span class="pw-s">' + esc(fee) + '</span></span>';
  }

  /**
   * Which rows say their price in words: the highest row you can see of each
   * same-price stretch (owner, November 11: "the highest visible row in
   * general"). A row is out of sight when it is scrolled above the top of
   * the window, or under what is pinned there (the phone's part-of-day
   * heading), or under a block (the chosen job, unless something else is
   * being pointed at, which hides it; the block being pointed at).
   */
  function markLeads(group, rowSel, viewTop) {
    var pointing = group.classList.contains('pointing');
    var prev = null;
    group.querySelectorAll(rowSel).forEach(function (c) {
      var hidden = c.classList.contains('pv') || (!pointing && c.classList.contains('under')) ||
        c.getBoundingClientRect().top < viewTop - 1;
      var key = hidden || !c.dataset.pw ? null : c.dataset.pw;
      c.classList.toggle('lead', key !== null && key !== prev);
      prev = key;
    });
  }
  /** Run on every scroll, resize and repaint (from updateCue). */
  function markAllLeads() {
    var sc = el('bkScroll');
    if (!root || !sc || !sc.getBoundingClientRect) return;
    var top = sc.getBoundingClientRect().top;
    root.querySelectorAll('.bk-tl').forEach(function (tl) { markLeads(tl, '.bk-tl-s', top); });
    root.querySelectorAll('.bk-wk-sec').forEach(function (sec) {
      var band = sec.querySelector('.bk-wk-band');
      markLeads(sec, '.bk-wk-item', Math.max(top, band ? band.getBoundingClientRect().bottom : top));
    });
  }

  /** Pointing at (or tapping) a start draws the block it would book. */
  function previewTl(t, solid) {
    var tl = t && t.closest && t.closest('.bk-tl');
    var pv = tl && tl.querySelector('#bkTlPreview');
    if (!pv) return;
    var row = Number(t.dataset.row), rows = Number(tl.dataset.rows), dur = Number(tl.dataset.dur);
    var span = Math.max(1, Math.min(rows - row, Math.ceil(dur / 30)));
    // Only the rows' marks are cleared here, not the block: hiding it on the
    // way to its next place stopped it gliding there.
    tl.querySelectorAll('.pv').forEach(function (c) { c.classList.remove('pv'); });
    tl.querySelectorAll('.bk-tl-s').forEach(function (c) {
      var r = Number(c.dataset.row);
      if (r >= row && r < row + span) c.classList.add('pv');
    });
    // Placed from the top row and moved down by transform, so moving between
    // starts glides (owner, November 11: "smoothen the jumpiness") instead
    // of jumping between grid rows. book.css .bk-tl-span.preview.
    var moved = pv.dataset.ms !== t.dataset.slot;
    pv.style.gridRow = '1 / span ' + span;
    pv.style.transform = 'translateY(' + row * (TL_ROW + TL_GAP) + 'px)';
    if (moved) {
      pv.dataset.ms = t.dataset.slot;
      // Appearing: its words now. Moving on: dimmed until it settles.
      if (pv.hidden || !pv.firstChild) { pv.innerHTML = tlBlockInner(Number(t.dataset.slot), dur); fadeIn(pv.firstChild, 0.55, 220); }
      else pv.classList.add('moving');
    }
    pv.classList.toggle('solid', Boolean(solid));
    pv.hidden = false;
    // One block at a time: pointing at another start hides the chosen job
    // instead of drawing over it (owner's screenshot, November 11: the two
    // overlapped, and the chosen job's top read as a big "Suggested" box).
    tl.classList.toggle('pointing', t.getAttribute('aria-pressed') !== 'true');
    settleTl(tl, t, solid);
  }
  function clearTlPreview(tl) {
    tl.querySelectorAll('.pv').forEach(function (c) { c.classList.remove('pv'); });
    var pv = tl.querySelector('#bkTlPreview');
    if (pv) { pv.hidden = true; pv.classList.remove('moving'); delete pv.dataset.ms; }
    tl.classList.remove('pointing');
    settleTl(tl, null, false);
  }

  /**
   * Phones: the week bar, the day strip and each part-of-day heading stay
   * pinned while the times scroll (owner, November 11). The heading's pin
   * sits under the other two, so their heights are measured, not guessed.
   */
  var pinWatch = null;
  var PIN_ROOM_MIN = 150;
  function pinWeek() {
    var wk = root.querySelector('.bk-wk.narrow');
    var h = wk && wk.querySelector('.bk-wk-h');
    var st = wk && wk.querySelector('.bk-wk-strip');
    if (!h || !st || !h.getBoundingClientRect) return;
    var set = function () {
      var hh = Math.round(h.getBoundingClientRect().height), sh = Math.round(st.getBoundingClientRect().height);
      wk.style.setProperty('--wk-h', hh + 'px');
      wk.style.setProperty('--wk-strip', sh + 'px');
      // A short window (a phone on its side): the week bar, the day strip and
      // a part-of-day heading pinned together left 18 to 53 px for the times,
      // less than one row (owner, November 11). Below room for about two and
      // a half rows, the week bar and the strip scroll away; the small
      // heading stays pinned.
      var sc = el('bkScroll'), band = wk.querySelector('.bk-wk-band');
      var room = sc ? sc.clientHeight - hh - sh - (band ? band.getBoundingClientRect().height : 0) : Infinity;
      wk.classList.toggle('nopin', room < PIN_ROOM_MIN);
    };
    set();
    // Measured again whenever either bar changes size: at 320 px the time
    // zone line wraps only once the web font arrives, and the strip pinned
    // under a bar that had since grown, with the list showing through.
    if (pinWatch) pinWatch.disconnect();
    if (window.ResizeObserver) {
      pinWatch = new ResizeObserver(set);
      pinWatch.observe(h);
      pinWatch.observe(st);
      // ...and when the window, so the scrolling area, changes height.
      if (el('bkScroll')) pinWatch.observe(el('bkScroll'));
    }
  }

  /** Room under the box for the "Change to suggested?" tab, while it shows. */
  function markSteering(on) {
    var box = el('bkPick');
    if (!box || !box.classList) return;
    box.classList.toggle('has-steer', on);
    if (box.parentNode && box.parentNode.classList) box.parentNode.classList.toggle('steering', on);
  }

  /**
   * A time picked on the checkout: marked, shown in the bottom bar, and the
   * page moves on to the next section. Booking still waits for Confirm,
   * which checks the time is still free (advance).
   */
  function timeChosen() {
    // Time is done: it folds to its line and the next section opens. The
    // times are redrawn from memory, not re-read, when Time opens again.
    state.ckDone.when = true;
    state.whenNote = '';
    state.ckOpen = ckNextOpen();
    ckGrew = true;
    render();
  }

  /**
   * After Continue on the checkout (checkout review, November 10: rows were
   * left half under the header). The whole page from the top when it fits;
   * otherwise the folded row just above the open section, in full.
   */
  function ckScroll(sec) {
    var sc = el('bkScroll');
    if (!sc || !sec.getBoundingClientRect) return;
    var shift = 0;
    try { var tf = getComputedStyle(sec).transform; if (tf && tf !== 'none' && window.DOMMatrix) shift = new DOMMatrix(tf).m42; } catch (e) { shift = 0; }
    var bottom = sc.scrollTop + sec.getBoundingClientRect().bottom - shift - sc.getBoundingClientRect().top;
    if (bottom <= sc.clientHeight - 8) {
      try { sc.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' }); } catch (e) { sc.scrollTop = 0; }
      return;
    }
    var prev = sec.previousElementSibling;
    scrollToEl(prev && prev.classList && prev.classList.contains('bk-donerow') ? prev : sec, 8);
  }

  /**
   * Bring an element to the top of the booking form's scroll area. Measured
   * against the scroll area itself: offsetTop counts from the modal, so it
   * overshot by the height of the header (132px, November 10).
   */
  function scrollToEl(node, gap) {
    var sc = el('bkScroll');
    if (!sc || !node || !node.getBoundingClientRect || !sc.getBoundingClientRect) return;
    // Less any slide-in still under way: it starts the section 22px low, and
    // measuring then overshot the title by 10px (round 16).
    var shift = 0;
    try { var tf = getComputedStyle(node).transform; if (tf && tf !== 'none' && window.DOMMatrix) shift = new DOMMatrix(tf).m42; } catch (e) { shift = 0; }
    var top = sc.scrollTop + node.getBoundingClientRect().top - shift - sc.getBoundingClientRect().top - (gap || 0);
    try { sc.scrollTo({ top: top, behavior: reducedMotion() ? 'auto' : 'smooth' }); } catch (e) { sc.scrollTop = top; }
  }

  /** The bottom bar's middle (updatePick decides what goes in it). */
  function setPick(html) {
    var box = el('bkPick');
    if (!box) return;
    if (!html) markSteering(false);
    box.innerHTML = html || '';
    box.hidden = !html;
  }

  function localMin(ms) { return P.localMinutesOfDay(ms); }

  /**
   * How far ahead anyone can book: the live site's year (November 11: "keep
   * booking ahead cap equivalent to live site"; it was three months from the
   * November 10 answers). Owner question 17 in docs/OWNER-QUESTIONS-MAGAZINES.md.
   */
  var MAX_BOOK_DAYS = 365;

  /** "2026-03-14" as local midnight. Built by parts: Date.parse treats a bare
   *  date string as UTC, which lands on the previous evening in Cincinnati. */
  function dayStartFromInput(value) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
    if (!m) return 0;
    var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return isNaN(d.getTime()) ? 0 : d.getTime();
  }

  function dateInputValue(ms) {
    var d = new Date(ms);
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  /**
   * "Help me choose a time", at the top of the time step, for everybody.
   *
   * The calendar is the right default: a real time beats a conversation
   * about times for almost everyone. But a list of days is the wrong shape
   * of question for some people, and until now the only way out of it was a
   * collapsed line at the foot of a list that could be twenty days long.
   * Somebody who cannot see a time that works does not scroll to the bottom
   * looking for an escape hatch, they close the tab.
   *
   * Nothing chosen here is a booking. It is the time they would LIKE, and
   * the copy says so in both directions, because a request that the reader
   * believes is confirmed is the single worst outcome on this screen.
   */
  function timeSwitch() {
    if (state.timeMode === 'ask') {
      return '<div class="bk-timeswitch on">' +
        '<div class="bk-timeswitch-t">' +
          '<b>Tell us when could work</b>' +
          '<span>Pick the days and the part of the day that suit you. ' +
          '<strong>This is not a booking</strong>: it is the time you would like, and we come back ' +
          'to agree one with you, usually within a few hours.</span>' +
        '</div>' +
        (state.slot
          ? '<p class="bk-timeswitch-warn">You have <b>' +
            esc(new Date(state.slot).toLocaleString('en-US', { timeZone: TZ, weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })) +
            '</b> picked. Choosing a day below swaps that confirmed time for a request.</p>'
          : '') +
        '<button type="button" class="bk-timeswitch-b" id="bkSlotMode">Show me real times instead</button>' +
        '</div>';
    }

    // More suggestive for somebody who has already told us they are not sure.
    // They said they cannot choose a package; not being able to choose an
    // hour either is the likeliest next thing.
    var advice = state.advice;
    return '<div class="bk-timeswitch' + (advice ? ' nudge' : '') + '">' +
      '<div class="bk-timeswitch-t">' +
        '<b>' + (advice ? 'Not sure when, either?' : 'Would you rather we found a time?') + '</b>' +
        '<span>' + (advice
          ? 'You can tell us the days that could work instead of picking an hour from the calendar, ' +
            'and we will come back with a time that fits.'
          : 'Tell us roughly when suits and we will come back with a time, usually within a few hours. ' +
            'Nothing is charged either way.') + '</span>' +
      '</div>' +
      '<button type="button" class="bk-timeswitch-b" id="bkAskMode">Help me choose a time</button>' +
      '</div>';
  }

  /** A finish time from minutes past midnight, rolling past midnight safely. */
  function endLabel(minutesOfDay) {
    var h = Math.floor(minutesOfDay / 60) % 24;
    var m = Math.round(minutesOfDay % 60);
    var h12 = h % 12 === 0 ? 12 : h % 12;
    return h12 + (m ? ':' + String(m).padStart(2, '0') : '') + (h < 12 ? 'am' : 'pm');
  }

  /** Any exterior work in the cart, which is bound by daylight. */
  function hasExterior() {
    return state.vehicles.some(function (v) {
      return v.packageIds.some(function (id) {
        var p = P.findPackage(id);
        return p && p.category === 'exterior';
      }) || v.addons.some(function (a) {
        var def = P.findAddon(a.addonId);
        return def && def.scope === 'exterior';
      });
    });
  }

  /** Does this start fall inside the lead window, whatever the box says? */
  function needsPriority(ms) {
    return P.slotNeedsPriority(ms, Date.now(), rushWin());
  }

  /**
   * How many days carry the rush fee for this booking, from
   * config/rush-fee.json (owner, November 11): it depends on the packages and
   * on where the visit came from. The server works it out the same way from
   * the same file. Asked once per slot while a week is drawn, so it is kept
   * until the cart, the source or the minute changes.
   */
  var rushKey = '', rushVal = null;
  function rushWin() {
    var ids = [];
    state.vehicles.forEach(function (v) { ids = ids.concat(v.packageIds || []); });
    var key = source() + '|' + ids.join(',') + '|' + Math.floor(Date.now() / 60000);
    if (key !== rushKey) { rushKey = key; rushVal = P.rushWindow({ source: source(), packageIds: ids }, Date.now()); }
    return rushVal;
  }

  /** "early or late starts, and times in the next 2 days", or without the rush when it is off. */
  function rushWords() {
    var n = rushWin().minLeadDays;
    return 'early or late starts' + (n === 1 ? ', and times today' : n > 1 ? ', and times in the next ' + n + ' days' : '');
  }

  /**
   * What a given start costs on top, in money.
   *
   * Both surcharges, judged on the slot itself rather than on the state of a
   * checkbox, so the figure beside a time is the figure that time is charged
   * at. They are capped together, so a 7am slot tomorrow is +30%, not +40%.
   */
  function deltaFor(ms) {
    return Math.round((q().serviceSubtotalCents * surchargeBp(ms)) / 10000);
  }

  function vTime() {
    if (state.slot) return null;
    if (isInquiry()) return null;
    return state.timeMode === 'ask'
      ? needs('Pick at least one day or time of day that could work.', '[data-prefday],[data-prefpart]')
      : needs('Pick a time, or tell us when suits.', '[data-slot],[data-prefday],[data-prefpart]');
  }

  /* ================= step 8: contact ================= */

  /**
   * A consent as one tick box, not a forced Yes or No.
   *
   * The terms are the only one a booking needs, so they are the only one
   * required. Texts are an unticked opt-in: carrier rules want consent that
   * is never a condition of booking. Filming is asked after the booking is
   * sent (owner, November 10), on the Done screen.
   */
  function consentBox(name, id, label, help) {
    var on = state.consent[name] === true;
    return '<label class="bk-check bk-consentbox' + (on ? ' on' : '') + '">' +
      '<input type="checkbox" id="' + id + '" data-consentbox="' + name + '"' + (on ? ' checked' : '') +
      (name === 'terms' ? '' : ' data-optional') + ' />' +
      '<span>' + label + '<i>' + help + '</i></span></label>';
  }


  /** The whole contact step, as it always was: details, then the yeses. */
  function vContact() { return vDetails() || vAgree(); }

  /**
   * Your details, at the top of the checkout. A real form with named fields,
   * so a browser or password manager offers to fill the lot in one tap.
   */
  function rDetails() {
    var c = state.contact;
    return '<form class="bk-form" id="bkContactForm" autocomplete="on" novalidate>' +
      '<div class="bk-row2 bk-contact-row">' +
      '<div class="bk-field"><label for="bkName">Name <span class="bk-req" aria-hidden="true">*</span></label>' +
      '<input type="text" id="bkName" name="name" data-c="name" value="' + esc(c.name) + '" autocomplete="name" maxlength="80" aria-required="true" data-focus /></div>' +
      '<div class="bk-field"><label for="bkPhone">Phone <span class="bk-req" aria-hidden="true">*</span></label>' +
      '<input type="tel" id="bkPhone" name="tel" data-c="phone" value="' + esc(c.phone) + '" inputmode="tel" autocomplete="tel" maxlength="20" aria-required="true" /></div>' +
      '<div class="bk-field"><label for="bkEmail">Email <i>(optional)</i></label>' +
      '<input type="email" id="bkEmail" name="email" data-c="email" value="' + esc(c.email) + '" inputmode="email" autocomplete="email" maxlength="120" data-optional /></div>' +
      '</div></form>';
  }

  /** Where they heard about us: one optional choice, for the owner's ROI. */
  var HEARD_OPTIONS = ['Google search', 'Google Maps', 'Instagram', 'Facebook', 'TikTok', 'A friend or family member',
    'Saw us working nearby', 'A magazine', 'Nextdoor', 'Other'];

  /**
   * The few yeses before booking (owner, November 10): as short as they can
   * be while still saying what is agreed to. The cancellation terms keep
   * their two numbers here, because that is what someone agrees to; the
   * full terms are one tap away.
   */
  function rAgree() {
    var heard = '<div class="bk-field bk-heard"><label for="bkHeard">Where did you hear about us? <i>(optional)</i></label>' +
      '<select id="bkHeard" data-heard>' +
      '<option value="">Choose one</option>' +
      HEARD_OPTIONS.map(function (o) { return '<option' + (state.heard === o ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') +
      '</select></div>';
    return consentBox('terms', 'bkTerms',
        '<b>I agree to the terms and privacy policy</b> <span class="bk-req" aria-hidden="true">*</span>',
        pctOf(RULES.cancelMidWindowBp) + ' cancellation fee inside ' + RULES.refundFullWindowHours + ' hours, ' +
        pctOf(RULES.cancelLateWindowBp) + ' inside ' + RULES.refundMidWindowHours + ' hours. ' +
        '<a class="bk-readmore inline" href="terms.html#cancellation" target="_blank" rel="noopener">Terms</a> &middot; ' +
        '<a class="bk-readmore inline" href="privacy.html" target="_blank" rel="noopener">Privacy</a>') +
      mediaQuestion() +
      consentBox('sms', 'bkSms',
        '<b>Text me about this booking</b> <em class="bk-opt">Optional</em>',
        // What we actually send today: texts about this booking, by hand (no
        // automatic reminders yet), session audit, November 11.
        'Texts about this booking, such as when we are on the way. Usually 2 to 5 messages per booking. Msg and data rates may apply. Reply STOP to opt out, HELP for help.') +
      heard;
  }

  /** Name, phone and email: the top of the checkout. */
  /*
   * Each checkout section lists EVERY problem it has, so Continue can show
   * them all at once, each under its own field (checkout review, November
   * 10: one at a time meant a second Continue just to learn the next one).
   * The v* functions keep returning the first, for everything else.
   */
  function lDetails() {
    var out = [];
    var name = state.contact.name.trim();
    if (!name) out.push(needs('We need your name.', '#bkName'));
    else if (name.length > 80) out.push(needs('That name is too long for our form.', '#bkName'));
    // The same shape the server insists on, checked here so the message
    // arrives while the field still has focus rather than after a round trip.
    var digits = state.contact.phone.replace(/\D/g, '');
    if (digits.length === 11 && digits.charAt(0) === '1') digits = digits.slice(1);
    if (!state.contact.phone.trim()) out.push(needs('We need a phone number to confirm your booking.', '#bkPhone'));
    else if (digits.length !== 10 || /^[01]/.test(digits)) {
      out.push(needs('That does not look like a US phone number. Ten digits, area code first.', '#bkPhone'));
    }
    if (state.contact.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(state.contact.email.trim())) {
      out.push(needs('That email address does not look right.', '#bkEmail'));
    }
    return out;
  }
  function vDetails() { return lDetails()[0] || null; }

  /** The terms and the recording question, lower on the checkout. */
  function lAgree() {
    var out = [];
    if (state.consent.terms !== true) out.push(needs('Please tick the box to accept the terms.', '#bkTerms'));
    if (state.consent.media === null) out.push(needs('Please answer yes or no on recording.', '[data-media]'));
    return out;
  }
  function vAgree() { return lAgree()[0] || null; }

  /* ================= step 9: confirm ================= */

  /**
   * Three states, not two.
   *
   * "Not sure" is the honest answer for most people about their own outdoor
   * tap, and forcing a yes or a no turns a useful answer into a guess. We
   * bring our own water and power anyway; knowing in advance is the
   * difference between topping up a tank the night before and finding out in
   * a driveway.
   */
  function askAccess(name, label, help) {
    var v = state.access[name];
    var opt = function (val, text) {
      return '<button type="button" class="bk-acc-b' + (v === val ? ' on' : '') +
        '" data-access="' + name + '" data-accval="' + val + '">' + text + '</button>';
    };
    return '<div class="bk-acc' + (v === null ? '' : ' answered') + '" data-optional>' +
      '<p class="bk-acc-q">' + label + '</p>' +
      (help ? '<p class="bk-acc-h">' + help + '</p>' : '') +
      '<div class="bk-acc-opts" role="group" aria-label="' + esc(label) + '">' + opt('yes', 'Yes') + opt('no', 'No') + opt('unsure', 'Not sure') + '</div>' +
      '</div>';
  }

  /**
   * Add-ons, on the screen where somebody is looking at the total.
   *
   * The extras step is five screens back by the time anyone sees a price they
   * want to change, and the only way to alter it was to walk back through the
   * funnel. This is the same list, as a dropdown, next to the number it
   * moves.
   *
   * When nothing has been added it is a dark panel rather than another
   * outlined box, because at that point it is the one thing on the screen
   * worth noticing.
   */
  function extraOptions(v) {
    var ctx = { packageIds: v.packageIds, addonTiers: v.addons.map(function (a) { return { addonId: a.addonId, tierId: a.tierId }; }) };
    var scopes = v.intent === 'both' ? ['interior', 'exterior'] : [v.intent];
    var out = [];

    scopes.forEach(function (scope) {
      P.addonsFor(scope).forEach(function (a) {
        // Same gates as the extras step: nothing coming soon, nothing whose
        // requirement is unmet, nothing already on this vehicle.
        if (!P.isSelectable(a)) return;
        if (P.addonBlockedReason(a, ctx)) return;
        if (v.addons.some(function (x) { return x.addonId === a.id; })) return;

        a.tiers.forEach(function (t) {
          if (t.priceCents === null) return;
          out.push({
            value: a.id + '|' + t.id,
            label: a.name + (a.tiers.length > 1 ? ', ' + t.label : '') +
              '  +' + $(t.priceCents) + (t.asterisk ? '*' : ''),
          });
        });
      });
    });
    return out;
  }

  function extrasForVehicle(v, index, showLabel) {
    var chosen = v.addons.map(function (a) {
      var def = P.findAddon(a.addonId);
      if (!def) return '';
      var tier = def.tiers.filter(function (t) { return t.id === a.tierId; })[0];
      return '<li><span>' + esc(def.name) +
        (def.tiers.length > 1 && tier ? ', ' + esc(tier.label) : '') + '</span>' +
        '<b>' + (tier ? svc(tier.priceCents) : '') + '</b>' +
        '<button type="button" class="bk-extra-x" data-extrarm="' + index + '|' + esc(a.addonId) + '">Remove</button>' +
        // On what they have ALREADY chosen, and collapsed. Somebody deciding
        // needs the list short; somebody who has decided sometimes wants to
        // know what they bought. A plus sign costs one line and asks nothing.
        (def.note
          ? '<details class="bk-how"><summary>How it works</summary><p>' + esc(def.note) + '</p></details>'
          : '') +
        '</li>';
    }).filter(Boolean).join('');

    /*
     * One line, not a catalogue.
     *
     * A wall of cards here was the wrong answer to the right problem. The
     * extras STEP already describes every add-on in full; this is the last
     * screen, where somebody is trying to finish, and a page of options is
     * decision fatigue at exactly the wrong moment. The dropdown is back, and
     * what they CHOOSE gets its "How it works" beside it.
     */
    var opts = extraOptions(v);
    var picker = opts.length
      ? '<label class="bk-extra-add"><span>Add something</span>' +
          '<select data-extraadd="' + index + '">' +
            '<option value="">Choose an extra...</option>' +
            opts.map(function (o) {
              return '<option value="' + esc(o.value) + '">' + esc(o.label) + '</option>';
            }).join('') +
          '</select></label>'
      : '<p class="bk-hint">Everything we can add to this one is already on it.</p>';

    return (showLabel ? '<h5 class="bk-extra-veh">' + esc(vehicleName(v, index)) + '</h5>' : '') +
      (chosen ? '<ul class="bk-extra-list">' + chosen + '</ul>' : '') +
      picker;
  }

  /**
   * A package name that says which half of the car it is.
   *
   * "Showroom Ready" and "Maintenance" are both interior packages whose names
   * do not mention it, so a receipt listing one of them leaves the reader
   * guessing. Names that already carry the word are left alone: "Full
   * Interior (interior)" helps nobody.
   */
  function packageName(p) {
    if (!p) return '';
    return /interior|exterior/i.test(p.name) ? p.name : p.name + ' (' + p.category + ')';
  }

  function vehicleName(v, index) {
    if (v.label) return v.label;
    var size = v.size ? P.vehicleSize(v.size) : null;
    return 'Vehicle ' + (index + 1) + (size ? ', ' + size.label : '');
  }

  function extrasBlock() {
    var none = state.vehicles.every(function (v) { return !v.addons.length; });
    var many = state.vehicles.length > 1;

    return '<div class="bk-extras' + (none ? ' empty' : '') + '">' +
      '<h4>' + (none ? 'Want to add anything?' : 'Your extras') + '</h4>' +
      '<p class="bk-extra-sub">' +
        (none
          ? 'You have not added any extras. If something below would help, add it here and the total updates.'
          : 'Add or drop anything here and the total updates straight away.') +
      '</p>' +
      state.vehicles.map(function (v, i) { return extrasForVehicle(v, i, many); }).join('') +
      '</div>';
  }

  /**
   * One row on the review that opens in place (owner, November 11, option
   * D). Stays open across re-renders once opened, so adding an extra or
   * applying a code does not snap it shut.
   */
  function revRow(id, label, cta, inner) {
    var open = Boolean(state.revOpen && state.revOpen[id]);
    return '<details class="bk-revrow" data-revrow="' + id + '"' + (open ? ' open' : '') + '>' +
      '<summary><span>' + esc(label) + '</span><em>' + esc(cta) + '</em></summary>' +
      '<div class="bk-revrow-in">' + inner + '</div></details>';
  }

  /** The one free-text box on the Confirm screen. */
  function notesBlock() {
    // Make and model, per vehicle. It used to sit on the Vehicles screen,
    // which is now one line on Extras.
    var labels = state.vehicles.map(function (v, i) {
      var id = 'bkLabel' + i;
      return '<div class="bk-field bk-notes"><label for="' + id + '">' +
        (state.vehicles.length > 1 ? 'Vehicle ' + (i + 1) + ': what' : 'What') +
        ' are we detailing? <i>(optional)</i></label>' +
        '<input type="text" id="' + id + '" data-label="' + i + '" value="' + esc(v.label) +
        '" placeholder="e.g. 2018 Honda CR-V" maxlength="80" data-optional /></div>';
    }).join('');
    return labels + '<div class="bk-field bk-notes"><label for="bkNotes">Anything else we should know? <i>(optional)</i></label>' +
      '<textarea id="bkNotes" data-note="general" rows="3" maxlength="500" ' +
      'placeholder="Pet hair, spills, smoke, a child seat to work around, anything we should expect">' +
      esc(state.notes) + '</textarea></div>';
  }

  /** Filming and photos: a required Yes or No on the details step. */
  function mediaQuestion() {
    var m = state.consent.media;
    var opt = function (val, text) {
      var on = (val === 'yes' && m === true) || (val === 'no' && m === false);
      return '<button type="button" class="bk-acc-b' + (on ? ' on' : '') + '" data-media="' + val + '">' + text + '</button>';
    };
    return '<div class="bk-acc bk-media' + (m === null ? '' : ' answered') + '">' +
      '<div class="bk-media-t"><p class="bk-acc-q">Can we record during the detail? <span class="bk-req" aria-hidden="true">*</span></p>' +
      // The same promise as the terms (section 10), word for word on what is blurred.
      '<p class="bk-acc-h">For short clips on our social media. We always blur children, license plates, house numbers and anything private. ' +
      '<a href="https://www.instagram.com/513autoclean/" target="_blank" rel="noopener">See what we post</a></p></div>' +
      '<div class="bk-acc-opts" role="group" aria-label="Can we record during the detail?">' +
        opt('yes', 'Yes') + opt('no', 'No') + '</div>' +
      '</div>';
  }


  /*
   * "HELP US GET READY", AFTER BOOKING (owner, November 11, option D).
   *
   * The setup questions change neither the price nor the time, so they come
   * once the booking is in: the review stays one screen, and people answer
   * most readily right after committing. The same pattern ran here once
   * before (round 1). The answers go to the owner as a short follow-up
   * email, by the button or quietly when the Done screen closes with
   * anything answered.
   */
  var prepSent = false;

  function prepBlock() {
    prepSent = false;
    return '<div class="bk-prep" id="bkPrep">' +
      '<h4>Help us get ready</h4>' +
      '<p class="bk-prep-sub">Optional, about a minute. No answer changes your price.</p>' +
      askAccess('water', 'Is there an outdoor tap we could use?', '') +
      askAccess('power', 'Is there an outdoor outlet we could use?', '') +
      '<div class="bk-field"><label for="bkParking">Where should we park, and how do we reach the vehicle? <i>(optional)</i></label>' +
      '<textarea id="bkParking" data-note="parking" rows="2" maxlength="300" data-optional ' +
      'placeholder="e.g. driveway on the left, gate code 4821, car is usually out front">' +
      esc(state.access.parking) + '</textarea></div>' +
      notesBlock() +
      // A request has no detailer yet, so it goes to us (validation, November 11).
      '<button type="button" class="bk-prep-send" id="bkPrepSend">' + (state.slot && !isInquiry() ? 'Send to your detailer' : 'Send to us') + '</button>' +
      '<p class="bk-msg" id="bkPrepMsg" role="status" aria-live="polite"></p>' +
      '</div>';
  }

  /** Water, power and parking as email lines, only those answered. */
  function accessText() {
    var word = function (v) { return v === 'unsure' ? 'not sure' : v; };
    return [
      state.access.water ? '  Water: ' + word(state.access.water) : '',
      state.access.power ? '  Power: ' + word(state.access.power) : '',
      String(state.access.parking || '').trim() ? '  Parking: ' + state.access.parking : ''
    ].filter(Boolean).join('\n');
  }

  var prepBase = '';
  function prepState() {
    return JSON.stringify([state.access.water || '', state.access.power || '', String(state.access.parking || '').trim(),
      String(state.notes || '').trim(), state.vehicles.map(function (v) { return String(v.label || '').trim(); })]);
  }

  /** Something answered or changed on the Done screen itself. */
  function prepAnswered() {
    return prepState() !== prepBase && Boolean(accessText() || String(state.notes || '').trim() ||
      state.vehicles.some(function (v) { return String(v.label || '').trim(); }));
  }

  /** The follow-up email. `quiet` when sent on close, where nobody is watching. */
  function sendPrep(quiet) {
    if (!quiet && !prepSent && state.done && !prepAnswered()) {
      // Pressed with nothing new to send: say so rather than do nothing
      // (final validation, November 11).
      var m0 = root.querySelector('#bkPrepMsg');
      if (m0) { m0.className = 'bk-msg'; m0.textContent = 'Answer any of the questions above, then send.'; }
      return;
    }
    if (prepSent || !state.done || state.advice || !prepAnswered()) return;
    prepSent = true;
    var msg = root.querySelector('#bkPrepMsg');
    var btn = root.querySelector('#bkPrepSend');
    if (btn) btn.disabled = true;
    // The same answers onto the booking's own calendar event, where the
    // detailer reads the job (November 11). Only a booked time has an event;
    // it never fails the email, and a send again replaces, never repeats.
    var onCalendar = state.slot && !isInquiry()
      ? fetch('/api/booking-followup', {
          method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            key: bookingKey(), phone: state.contact.phone, slot: state.slot, detailer: detailerParam(),
            access: state.access, notes: state.notes,
            labels: state.vehicles.map(function (v) { return v.label || ''; })
          })
        }).then(function (r) { return r.ok ? r.json() : {}; }).then(function (j) { return Boolean(j && j.saved); })
          .catch(function () { return false; })
      : Promise.resolve(false);
    var fd = new FormData();
    fd.append('access_key', WEB3FORMS_KEY);
    fd.append('subject', 'BOOKING FOLLOW-UP, ' + (detailerName() ? detailerName() + ', ' : '') + state.contact.name +
      (state.slot ? ', ' + new Date(state.slot).toLocaleString('en-US', { timeZone: TZ }) : ''));
    fd.append('from_name', '513 Auto Clean Booking');
    fd.append('name', state.contact.name);
    fd.append('phone', state.contact.phone);
    if (state.contact.email) fd.append('email', state.contact.email);
    fd.append('message',
      'Answers given right after booking ("Help us get ready").\n\n' +
      'WHO\n  ' + state.contact.name + '\n  ' + state.contact.phone + '\n\n' +
      (accessText() ? 'ACCESS\n' + accessText() + '\n\n' : '') +
      state.vehicles.map(function (v, i) { return String(v.label || '').trim() ? 'VEHICLE' + (state.vehicles.length > 1 ? ' ' + (i + 1) : '') + '\n  ' + v.label + '\n\n' : ''; }).join('') +
      (String(state.notes || '').trim() ? 'NOTES\n  ' + state.notes + '\n' : ''));
    // keepalive: a quiet send on close often races a page change ("Something
    // needs changing" navigates away at once, and so does closing the tab).
    fetch('https://api.web3forms.com/submit', { method: 'POST', body: fd, keepalive: true, headers: { Accept: 'application/json' } })
      .then(function (r) { return r.json().then(function (j) { return r.ok && j.success; }); })
      .then(function (ok) {
        if (!ok) throw new Error('not sent');
        track('booking_followup', { water: Boolean(state.access.water), power: Boolean(state.access.power) });
        if (quiet) return;
        return onCalendar.then(function (saved) {
          var box = root.querySelector('#bkPrep');
          // True to what happened: on the job itself when the calendar took it,
          // otherwise an email to us (session audit, November 11).
          if (box) box.innerHTML = saved
            ? '<h4>Thanks, it is on your booking</h4><p class="bk-prep-sub">Your detailer sees it with the job.</p>'
            : '<h4>Thanks, we have it</h4><p class="bk-prep-sub">We will use it to get ready for your detail.</p>';
        });
      })
      .catch(function () {
        prepSent = false;
        if (btn) btn.disabled = false;
        if (!quiet && msg) {
          msg.className = 'bk-msg err';
          msg.textContent = 'That did not send. Try again, or just tell us on the day.';
        }
      });
  }

  /* ---- what actually happens next, as of today ---- */

  /**
   * The steps after Confirm, generated from what is switched on.
   *
   * This used to promise automatic reminders two days before and on the
   * morning, and an on-the-way text, none of which exist: Elijah texts an
   * ETA himself before he sets off. Promising software you have not built is
   * the fastest way to look unreliable while doing everything right.
   */
  function nextSteps() {
    // "By email" only when they gave an address (validation, November 11).
    var email = P.isLive('automatedEmail') && Boolean(String(state.contact.email || '').trim());
    var texts = P.isLive('automatedTexts');
    var calendar = P.isLive('liveCalendar');
    var requested = isInquiry();
    var out = [];

    // A request and a booking are two different things and were being told
    // the same story. One has a time on the calendar; the other is waiting
    // for us to offer one.
    if (state.advice && state.slot) {
      out.push('<li><b>Your time is held.</b> ' +
        (calendar ? 'It came off our live calendar as you picked it, so it is yours.' : 'We will confirm it shortly.') +
        ' We are holding ' + Math.round(P.ADVICE_HOLD_MIN / 60) + ' hours for it.</li>');
      out.push('<li><b>We work out the package with you.</b> Either beforehand, from what you have told ' +
        'us, or on the day when we can see the vehicle. You hear the price before we start.</li>');
      out.push('<li><b>You decide, and you can still say no.</b> If nothing we suggest is worth it to ' +
        'you, we leave and there is nothing to pay.</li>');
    } else if (state.advice) {
      out.push('<li><b>We come back with a recommendation.</b> Usually within a few hours: the package ' +
        'we would suggest, what it costs, and a time from the days you picked.</li>');
      out.push('<li><b>You decide.</b> Nothing is booked and nothing is charged until you say yes to it.</li>');
    } else if (requested && state.prefer.flex) {
      out.push('<li><b>We confirm the day.</b> Usually within a few hours, ' +
        (email ? 'by email' : 'by text or phone, whichever you said') +
        ', then the start time by the evening before. Nothing is charged until you say yes to it.</li>');
    } else if (requested) {
      out.push('<li><b>We come back with a time.</b> Usually within a few hours, ' +
        (email ? 'by email' : 'by text or email, whichever you said') +
        '. Nothing is booked and nothing is charged until you say yes to it.</li>');
      out.push('<li><b>Say yes and it is yours.</b> That is the point the time is held and these terms start.</li>');
    } else if (state.slot && shortNotice(state.slot)) {
      // Short notice is a request until a detailer accepts it (owner,
      // November 10), and the screen and the email say so too (session
      // audit, November 11: the email used to say "confirmed").
      out.push('<li><b>It is a request until a detailer accepts it.</b> It is short notice, so we reply as ' +
        'fast as we can, ' + (email ? 'by email' : 'by phone') + '. Nothing is charged either way.</li>');
    } else if (calendar) {
      // The calendar is live, so the slot really was taken when they picked
      // it. Saying somebody will confirm it by hand would be wrong.
      out.push('<li><b>Your time is booked.</b> It came off our live calendar as you picked it, so it is yours.' +
        (email ? ' A confirmation is in your inbox now.' : '') + '</li>');
      // Inside a day, the calendar is still right but nobody may have read a
      // phone between this booking and the van needing to leave. Saying so is
      // better than a booking that quietly needs chasing.
      if (state.slot && state.slot - Date.now() < 86400000) {
        out.push('<li><b>Because it is within the next day</b>, we will send a quick message to ' +
          'double check we can make it. If anything has to move we call you.</li>');
      }
    } else {
      out.push('<li><b>We confirm it, usually within a few hours.</b> By text or email, whichever you said. ' +
        'Until you hear back, treat the time as requested rather than locked in.</li>');
    }

    // Only texts to people who said yes to texts (terms, section 11).
    out.push(state.consent.sms !== true
      ? '<li><b>A call before we set off</b>, if anything changes. You said no to texts, so we email or call.</li>'
      : texts
        ? '<li><b>A reminder before the day</b>, and a text when we are on the way.</li>'
        : '<li><b>A text before we set off</b>, with an ETA. We send that one by hand, so if you need to ' +
          'move anything, replying to it reaches a person.</li>');

    if (state.advice && state.slot) {
      out.push('<li><b>Pay when it is done</b>, by ' + IN_PERSON + ', for whatever we agreed to do. ' +
        'Nothing is taken beforehand.</li>');
    } else if (!state.advice) {
      out.push('<li><b>Pay when it is done.</b> ' +
        (state.payInFull
          ? 'Already paid, so there is nothing to do.'
          : state.mandate
            ? 'By ' + IN_PERSON + ', or ask us to put it on the card on file. The card is only ' +
              'authorized for a late cancellation.'
            : 'By ' + IN_PERSON + '. Nothing is taken beforehand.') + '</li>');
    }

    return '<ol>' + out.join('') + '</ol>';
  }

  /* ================= step 9: pay ================= */

  /**
   * Promo code entry, on the last screen, visible.
   *
   * It used to be collapsed behind a "Have a promo code?" link, on the theory
   * that an open discount field sends people off to hunt for one. That theory
   * cost more than it saved: someone holding a code Elijah texted them could
   * not find anywhere to type it, which is a worse outcome than a few people
   * searching the internet for a code that does not exist.
   */
  function promoBox(quote, early, folded) {
    var applied = quote.promoCode && quote.promoDiscountCents > 0;

    if (applied) {
      return '<div class="bk-promo on' + (early ? ' early' : '') + '">' +
        '<span class="bk-promo-tag">' + esc(quote.promoCode) + '</span>' +
        // The saving is said once, under the total, tax included (checkout
        // review, November 10: two different figures on one screen).
        '<span class="bk-promo-msg">' + esc(promoBlurb(quote.promoCode)) + '</span>' +
        '<button type="button" class="bk-promo-clear" id="bkPromoClear">Remove</button>' +
        '</div>';
    }

    // On the package screen, before anything is chosen, an empty discount box
    // at the top of the page is noise. It appears once there is a price for
    // it to act on.
    // Behind "Have a promo code?" it is asked for, so it always shows: an
    // empty fold read as a broken button (owner, November 11).
    if (early && !folded && !quote.lines.length && !state.promoCode) return '';

    var typed = state.promoCode || '';
    var bad = typed && quote.promoRejected ? P.promoMessage(quote.promoRejected) : '';

    return '<div class="bk-promo' + (early ? ' early' : '') + '">' +
      '<label for="bkPromo">Promo code <i>(if you have one)</i></label>' +
      '<div class="bk-promo-row">' +
        '<input type="text" id="bkPromo" data-promo data-optional value="' + esc(typed) +
          '" placeholder="Enter a code" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="32" />' +
        '<button type="button" class="bk-promo-go" id="bkPromoApply">Apply</button>' +
      '</div>' +
      (bad ? '<p class="bk-promo-err">' + esc(bad) + '</p>' : '') +
      '</div>';
  }

  function promoBlurb(code) {
    var hit = P.findPromo(code);
    return (hit.promo && hit.promo.blurb) || 'Discount applied.';
  }

  /**
   * Can this booking actually be paid for now?
   *
   * Two reasons it cannot, and both have to hold it shut.
   *
   * A REQUEST has no agreed time, and taking money for one is how you end up
   * issuing refunds the same week.
   *
   * NO PAYMENT PROCESSOR means the button leads to a form that cannot take a
   * card. Offering 5% off for doing something the site cannot do yet is a
   * discount on a promise, and the total quietly changed to match it. When
   * the Stripe keys land this turns on by itself, for every path including a
   * shared quote link, because they all read this one function.
   */
  /**
   * Off, test, or live, read straight off the key.
   *
   * Stripe prefixes tell you which one you are in, so the site does not need
   * a second switch that somebody has to remember to flip in step with the
   * key. A test key makes the card field real and working, with test cards,
   * and no money moves.
   */
  /*
   * The two Google keys, each falling back to the old single one.
   *
   * Kept apart because only one of them costs anything: Calendar is free and
   * needs no billing account, Places is Maps Platform and needs a card. One
   * shared value meant switching on the free feature required signing up for
   * the billed one.
   */
  function calendarKey() { return CFG.googleCalendarApiKey || CFG.googleApiKey || ''; }
  function placesKey() { return CFG.googlePlacesApiKey || CFG.googleApiKey || ''; }

  function stripeMode() {
    var k = String(CFG.stripePublishableKey || '');
    if (k.indexOf('pk_live_') === 0) return 'live';
    if (k.indexOf('pk_test_') === 0) return 'test';
    return 'off';
  }

  function canPayNow() {
    // A LIVE key, not a test one: offering 5% off for paying now, when now
    // means a test card that moves nothing, is an invoice nobody has paid.
    // The capability switches have to agree, because they are what the terms
    // page was generated from and the two must not say different things.
    //
    // payInFull is its own switch and is currently off: the pay-now path did
    // not complete reliably on mobile, and a booking that says it is paid and
    // is not is worse than one that plainly is not.
    // And not while the price is still a question: 5% off an unknown number
    // is not an offer, it is a puzzle.
    return !isInquiry() && !state.advice && stripeMode() === 'live' &&
      P.isLive('cardOnFile') && P.isLive('payInFull');
  }

  function rPay() {
    var ask = isInquiry();

    // Forced off rather than merely hidden, so it cannot survive from an
    // earlier pass through this step or out of a saved draft.
    if (!canPayNow()) state.payInFull = false;

    var quote = q();
    var now = state.payInFull;

    // Each option priced on its own terms. `quote` reflects whichever is
    // SELECTED, so reading both figures off it made "Pay after the detail"
    // display the discounted total the moment somebody chose to pay now.
    var laterCart = cart(); laterCart.payInFull = false;
    var nowCart = cart(); nowCart.payInFull = true;
    var laterTotal = P.quote(laterCart, RULES).totalCents;
    var nowTotal = P.quote(nowCart, RULES).totalCents;

    var html = '';

    if (state.advice) {
      html += '<div class="bk-asknote">' +
        '<b>' + (state.slot ? 'Your time is held. The package is the open question.' : 'This is a request for a recommendation') + '</b>' +
        '<span>' +
        (state.slot
          ? 'We are holding ' + Math.round(P.ADVICE_HOLD_MIN / 60) + ' hours on ' +
            esc(new Date(state.slot).toLocaleString('en-US', { timeZone: TZ, weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })) +
            '. Before we start we will look at the vehicle with you, recommend the package, and tell you ' +
            'what it costs. You can say no to it and we will do less, or nothing at all, at no charge. '
          : esc(preferenceSummary()) + ' We will read what you have told us, come back with the package we ' +
            'would suggest and what it costs, and you decide from there. ') +
        '<strong>Nothing is charged today.</strong>' +
        '</span></div>';
    } else if (ask) {
      html += '<div class="bk-asknote">' +
        '<b>This is a request, not a confirmed time</b>' +
        '<span>' + esc(preferenceSummary()) + (state.prefer.flex
          ? ' We confirm the day, usually within a few hours, and let you know the start time by the evening before. '
          : ' We will come back with a time that works, usually within a few hours. ') +
        '<strong>Nothing is charged until you have agreed to it.</strong>' +
        '</span></div>';
    }

    // Nothing is priced on the advice path, so an empty receipt would be the
    // first thing they saw on the last screen.
    if (!state.advice) html += '<div class="bk-review">' + lineTable(quote) + '</div>';

    if (state.interest.length) {
      html += '<div class="bk-interest">' +
        '<b>We will let you know when these open</b>' +
        '<span>' + esc(interestNames().join(', ')) +
        '. Nothing to pay for these, and they are not part of today\'s total.</span>' +
        '</div>';
    }

    // Option D (owner, November 11): the review is the price, the time and
    // Confirm. A code and extras are one row each that opens in place; the
    // setup questions come after booking, on the Done screen (prepBlock).
    if (!state.advice) html += revRow('promo', quote.promoCode ? 'Promo code: ' + quote.promoCode : 'Have a promo code?', '', promoBox(quote, true, true));

    if (state.advice) {
      // Nothing priced, so there is nothing to choose between.
    } else if (!canPayNow()) {
      // Nothing to choose: "Nothing to pay today" below says it once.
    } else {
      html += '<div class="bk-payopts">' +
        '<button type="button" class="bk-pay' + (!now ? ' on' : '') + '" data-pay="later">' +
          '<b>Pay after the detail</b>' +
          '<span>Pay when the work is finished, by ' + IN_PERSON + ', or ask us to put it on the card on file. ' +
            'The card is only authorized for a late cancellation.</span>' +
          '<i>' + $(laterTotal) + '</i>' +
        '</button>' +
        '<button type="button" class="bk-pay' + (now ? ' on' : '') + '" data-pay="now">' +
          '<b>Pay now and save ' + RULES.payInFullDiscountBp / 100 + '%</b>' +
          '<span>Settle the whole thing today.</span>' +
          '<i>' + $(nowTotal) + '</i>' +
        '</button>' +
        '</div>';
    }

    if (state.advice) {
      html += '<div class="bk-accbox">' +
        '<h4>Tell us about the vehicle</h4>' +
        '<p class="bk-hint">This is what the recommendation is based on, so the more you say the closer ' +
        'the quote will be. Photos help too, and you can text those to us afterwards.</p>' +
        '<div class="bk-field"><label for="bkNotes">What condition is it in, and what bothers you most?</label>' +
        '<textarea id="bkNotes" data-note="general" rows="4" maxlength="500" ' +
        'placeholder="e.g. two dogs, the carpets are the worst of it, and it has not been washed since spring">' +
        esc(state.notes) + '</textarea></div>' +
        '</div>';
    } else {
      var added = state.vehicles.reduce(function (n, v) { return n + v.addons.length; }, 0);
      html += revRow('extras', added ? 'Your extras: ' + added + ' added' : 'Add an extra', added ? 'Change' : 'See all', extrasBlock());
    }

    /*
     * NOTHING TO PAY WITH, SO NOTHING TO FILL IN.
     *
     * Until Stripe is wired in, this screen asked the customer to tick a
     * card authorization so that a payment form could load and tell them
     * online payment was not switched on. That is a working booking flow
     * impersonating a broken one, and it is the likeliest reason somebody
     * reached the last screen and did not send. The card step is simply not
     * here until there is a card to take, and the screen says what actually
     * happens instead.
     */
    /*
     * ONE TEST FOR "DO WE ASK FOR A CARD AT ALL".
     *
     * The capability is the mute switch. Stripe is refusing the secret key,
     * so cardOnFile is off, and a booking screen that asks for a card and
     * then cannot take one is worse than one that never mentions a card. Off
     * means off everywhere: no field, no authorization box, no pay-in-full,
     * and the terms stop describing a card being taken.
     */
    var wantCard = !state.advice && stripeMode() !== 'off' && P.isLive('cardOnFile');

    if (!wantCard) {
      html += '<div class="bk-cardbox">' +
        '<h4>Nothing to pay today</h4>' +
        '<p class="bk-hint">' +
          (state.advice
            ? 'There is nothing to pay for a recommendation. When we come back with a package and a ' +
              'price, you decide whether to book it.'
            // Whether anybody confirms this by hand depends on the calendar.
            // With it live, the time was taken when they picked it, and
            // promising a confirmation nobody is going to send leaves them
            // waiting on an email that is never coming.
            : 'You pay once the detail is finished. Nothing is taken beforehand. ' +
              (state.slot && !isInquiry() && shortNotice(state.slot)
                // Owner, November 10: an hour's notice is fine, as long as
                // nobody thinks a short-notice time is settled before we say so.
                ? 'This is short notice, so it is a request until a detailer accepts it. ' +
                  'We reply as fast as we can, and nothing is charged either way.'
                : P.isLive('liveCalendar') && state.slot && !isInquiry()
                ? 'Send it and the time is yours.'
                : isInquiry()
                // A request is not a booking (validation, November 11).
                ? (state.prefer.flex ? 'Send your request and we will confirm the day, usually within a few hours.'
                  : 'Send your request and we will come back with a time, usually within a few hours.')
                : 'Send your booking and we will confirm it, usually within a few hours.') +
              ' After you book, a few quick questions help us get ready.') +
        '</p></div>';
    } else {
      html += '<div class="bk-cardbox">' +
        '<h4>' + (now ? 'How would you like to pay?' : 'Card on file') + '</h4>' +
        '<p class="bk-hint">' +
          (now
            // NOT a list of wallets. Apple Pay only appears if the domain is
            // registered with Stripe AND the visitor is in Safari on an Apple
            // device with a card in Wallet, so naming it on a desktop that
            // will never show it is a promise the page cannot keep. Stripe
            // renders whatever the device and the account actually support,
            // so the copy names Stripe and lets the form speak for itself.
            ? 'Handled by Stripe. Card, Link, and whichever wallets your device offers.'
            : 'Nothing is charged now, and nothing will be unless you cancel or move the booking late. ' +
              'On the day, pay however suits: ' + IN_PERSON + '.') +
        '</p>';

      /*
       * ONE METHOD, NO CHOOSER.
       *
       * The row offered "Card, Apple Pay, bank" against "PayPal or Venmo".
       * There is no PayPal client id, so that second button led to a panel
       * saying PayPal is not available here yet: a choice between something
       * that works and something that apologises. The row appears again on
       * its own the day a PayPal id lands in the config.
       */
      if (now && CFG.paypalClientId) {
        html += '<div class="bk-methods">' +
          '<button type="button" class="bk-method' + (state.payMethod === 'card' ? ' on' : '') + '" data-paymethod="card">' +
            'Card or wallet</button>' +
          '<button type="button" class="bk-method' + (state.payMethod === 'paypal' ? ' on' : '') + '" data-paymethod="paypal">' +
            'PayPal or Venmo</button>' +
          '</div>';
      } else if (now) {
        // Nothing to choose between, so the state cannot sit on a method that
        // is not on the screen.
        state.payMethod = 'card';
      }

      // Card networks require the customer to agree, in words they can read,
      // before a card is stored for later charges. This is that sentence. It is
      // recorded against the booking, and the server refuses to save a card
      // without it.
      var viaPaypal = now && state.payMethod === 'paypal';
      if (!viaPaypal) {
        // The narrow thing the card is actually for. Claiming permission to
        // charge the whole detail, when the customer may well hand over cash in
        // the driveway, is both wrong and the sort of overreach that gets a
        // chargeback decided against you.
        html += '<label class="bk-check bk-mandate' + (state.mandate ? ' on' : '') + '">' +
          '<input type="checkbox" id="bkMandate"' + (state.mandate ? ' checked' : '') + ' />' +
          '<span>I authorize 513 Auto Clean to keep this card on file and to charge it <b>if I cancel or ' +
          'move this booking late</b>, for the fee set out in the terms I accepted. ' +
          (now
            ? 'The detail itself I am paying for now.'
            : 'It is not permission to charge me for the detail, which I can pay for however I like on the day.') +
          '</span></label>';
      }

      if (CFG.turnstileSiteKey) {
        html += '<div id="bkTurnstile" class="bk-turnstile"></div>';
      }

      html += '<div id="bkPayMount" class="bk-stripe">' +
        (state.mandate || viaPaypal
          ? '<p class="bk-loading">Loading payment options...</p>'
          : '<p class="bk-hint">Tick the authorization above to load the secure payment form.</p>') +
        '</div>' +
        '</div>';
    }

    if (!state.advice) {
      // Whether travel is still to come depends on whether it has been
      // priced. Saying it is "added when we confirm" directly under a table
      // that has already added it is how somebody starts wondering what else
      // is going to turn up.
      html += '<p class="bk-fine">' +
        (quote.travelIsEstimate
          ? 'Travel is worked out from your address and added when we confirm. '
          : 'Travel is the measured drive from us to you at the time you picked, and it is in the total above. ') +
        'Sales tax' + (quote.taxIsEstimate ? ' is added once we have your ZIP' : ' at ' + (quote.taxRateBp / 100).toFixed(2) + '% is included') + '.</p>';
    }

    html += '<div class="bk-msg" id="bkMsg" role="status" aria-live="polite"></div>';

    if (wantCard) setTimeout(mountPayment, 0);
    return html;
  }

  function vPay() {
    if (state.payState === 'paid') return null;
    // Nothing to authorize: either there is nothing priced yet, or there is
    // no processor to hold a card. Insisting on a tick for a box that is not
    // on the screen is a dead end with no way past it.
    if (state.advice || stripeMode() === 'off' || state.cardUnavailable) return null;
    if (!P.isLive('cardOnFile')) return null;
    if (!state.mandate && !(state.payInFull && state.payMethod === 'paypal')) {
      return needs('Please tick the card authorization to continue.', '#bkMandate');
    }
    if (state.payMethod === 'paypal' && state.payInFull) {
      return 'Use the PayPal button above to finish paying.';
    }
    if (!root._stripe) {
      // No processor configured. The booking still goes through and a payment
      // link follows, which is better than blocking the customer entirely.
      return null;
    }
    return null;
  }

  /* ---- the wire cart: ids only, never prices ---- */
  /**
   * What the customer agreed to, sent with every payment request and kept
   * against the booking. The terms version is the date the wording last
   * changed, so it points at exactly one document.
   */
  function consentPayload() {
    return {
      termsVersion: P.LEGAL.termsEffective,
      sms: state.consent.sms === true,
      media: state.consent.media === true,
      mandateAccepted: state.mandate === true
    };
  }

  function wireCart() {
    return {
      vehicles: state.vehicles.map(function (v) {
        return {
          label: v.label || '',
          sizeId: v.size,
          packageIds: v.packageIds,
          addons: v.addons.map(function (a) { return { addonId: a.addonId, tierId: a.tierId }; })
        };
      }),
      zip: state.address.zip || null,
      // The address, not a number of minutes. A browser that could name its
      // own drive time could name zero.
      address: {
        line1: state.address.line1 || '',
        city: state.address.city || '',
        region: state.address.region || '',
        zip: state.address.zip || ''
      },
      slot: state.slot,
      // Planned minutes into the arrival window (selectSlot, verifySlot): the
      // calendar event runs to that arrival plus the work.
      arrivalLateMin: state.slot && state.slotLateMin ? state.slotLateMin : 0,
      priority: state.priority,
      promoCode: state.promoCode || null,
      // Only for the rush fee rules (config/rush-fee.json), which the server
      // applies again itself: "golf" from "golf / print / qr".
      source: source().split('/')[0].trim().toLowerCase() || null,
      /*
       * THREE KINDS, because there are three situations.
       *
       * booking  a time and a price, both settled.
       * advice   a real time, no price yet. The server allows this one cart
       *          to be empty, holds the slot, and never takes money for it.
       * inquiry  no time at all, only the days that could work.
       */
      kind: state.advice ? 'advice' : isInquiry() ? 'inquiry' : 'booking',
      access: state.access,
      // Free text. The pricing gate drops all of it, correctly, because none
      // of it can change a price. send-confirmation reads it from the raw
      // payload for the calendar event and the email.
      notes: state.notes || '',
      locationNote: state.noGoodLocation ? (state.locationNote || '') : '',
      interest: state.interest.slice(),
      prefer: isInquiry() ? state.prefer : null,
      payInFull: (isInquiry() || state.advice) ? false : state.payInFull
    };
  }

  function mountPayment() {
    var mount = root.querySelector('#bkPayMount');
    if (!mount) return;

    var ts = root.querySelector('#bkTurnstile');
    if (ts && window.turnstile && !ts.dataset.rendered) {
      ts.dataset.rendered = '1';
      window.turnstile.render(ts, {
        sitekey: CFG.turnstileSiteKey,
        callback: function (token) { state.turnstileToken = token; },
        'expired-callback': function () { state.turnstileToken = null; }
      });
    }

    if (state.payInFull && state.payMethod === 'paypal') return mountPayPal(mount);
    // The card form does not load until the card-on-file authorization is
    // ticked. PayPal keeps nothing on file, so it needs no such line.
    if (!state.mandate) {
      mount.innerHTML = '<p class="bk-hint">Tick the authorization above to load the secure payment form.</p>';
      root._stripe = null;
      return;
    }
    // Already mounted: leave it alone rather than rebuilding a live card
    // field underneath somebody's fingers.
    if (root._stripe) return;
    return mountStripe(mount);
  }

  /**
   * Stripe Payment Element. Covers card, Apple Pay, Google Pay, Link, bank
   * transfer and Cash App from one component, and which of those appear is a
   * dashboard toggle rather than a code change.
   */
  /**
   * Load a third party script once, on demand.
   *
   * NOTHING EVER LOADED STRIPE. The code checked `window.Stripe`, found it
   * undefined because no script tag anywhere on the site fetched it, and fell
   * through to "no card needed today" no matter which keys were set. A live
   * publishable key, a live secret key, the capability switched on, and a
   * booking flow that quietly could not take a card.
   *
   * On demand rather than in the head, deliberately: somebody who reads the
   * homepage and leaves never hands Stripe a page view.
   */
  var _scripts = {};
  function loadScript(src) {
    if (_scripts[src]) return _scripts[src];
    _scripts[src] = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = function () { resolve(); };
      s.onerror = function () {
        // Cleared, so a later attempt can retry rather than inheriting a
        // promise that will never settle.
        _scripts[src] = null;
        // Wording matters even here: a blunt source scan in the smoke test
        // fails the build on the vocabulary of failure, because a customer
        // must never be told the site is broken. This string is internal and
        // is caught, but the guard is deliberately not clever enough to know
        // that, and arguing with it is not worth a rename.
        reject(new Error('script blocked: ' + src));
      };
      document.head.appendChild(s);
    });
    return _scripts[src];
  }

  /**
   * The card form cannot load, so the whole card section goes.
   *
   * It used to replace only the mount, which left a heading saying "Card on
   * file", a paragraph explaining what the card would be used for, and a
   * checkbox authorizing it, sitting directly above a line saying no card is
   * needed. A screen that contradicts itself in three sentences, and the
   * checkbox above was still required to continue, so it contradicted itself
   * in a way you could not get past.
   *
   * `cardUnavailable` is what tells vPay to stop asking for a tick that is no
   * longer on the screen.
   */
  function noCardMessage(mount) {
    state.cardUnavailable = true;

    /*
     * AND IT IS NO LONGER PAID IN FULL, because nothing was collected.
     *
     * Choosing "pay now and save 5%" set payInFull, which took 5% off the
     * total, wrote "PAID IN FULL" onto the confirmation and told Elijah the
     * money was in. Then the payment form failed to load and nobody was ever
     * asked for a card. A booking that says it is paid and is not is worse
     * than one that plainly is not: he turns up expecting nothing, the
     * customer expects to owe nothing, and one of them is wrong on a
     * driveway.
     *
     * So the option comes off, the total goes back up, and the screen says
     * what will actually happen.
     */
    if (state.payInFull) {
      state.payInFull = false;
      renderTotal();
    }
    var html = '<h4>Nothing to pay today</h4>' +
      '<p class="bk-hint">You pay in full once the detail is finished, by ' + IN_PERSON + '. ' +
      'Nothing is taken beforehand.</p>';
    var box = mount.closest ? mount.closest('.bk-cardbox') : null;
    if (box) box.innerHTML = html;
    else mount.innerHTML = html;
  }

  function mountStripe(mount) {
    // A fresh attempt, so a problem that has since been fixed is not
    // remembered for the life of the page.
    state.cardUnavailable = false;
    if (!CFG.stripePublishableKey) return noCardMessage(mount);

    if (!window.Stripe) {
      mount.innerHTML = '<p class="bk-loading">Loading payment options...</p>';
      return loadScript('https://js.stripe.com/v3/')
        .then(function () {
          // Guard against a script that loads and defines nothing, which
          // would otherwise recurse until the stack gave out.
          if (window.Stripe) return mountStripe(mount);
          noCardMessage(mount);
        })
        .catch(function () { noCardMessage(mount); });
    }

    // Say so, loudly, in test mode. A card field that looks exactly like the
    // real one and quietly does nothing is how somebody ends up believing a
    // booking was paid for.
    var testBanner = stripeMode() === 'test'
      ? '<p class="bk-warn"><b>Test mode.</b> No card is charged and no card is stored. ' +
        'Use 4242 4242 4242 4242, any future date, any CVC. Real cards will be declined.</p>'
      : '';

    fetch('/api/create-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cart: wireCart(),
        contact: state.contact,
        consent: consentPayload(),
        turnstileToken: state.turnstileToken,
        mode: state.payInFull ? 'pay_now' : 'card_only',
        idempotencyKey: bookingKey(),
        // So the charge carries the same fee-free hours as the booking.
        detailer: detailerParam(),
        // The early or late fee shown, used by the server only if it cannot read the calendar.
        timeFeeBp: shownTimeFeeBp()
      })
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (r) {
        if (!r.ok || !r.j.clientSecret) {
          // Both branches say the same thing, because from the customer's
          // side they ARE the same thing: there is nothing to type here, and
          // the booking is unaffected. Naming the failure only invites them
          // to wonder what else is broken.
          mount.innerHTML = '<p class="bk-hint">No card needed today. ' +
            'Your booking goes through as normal, and if anything is due up front we will send you a ' +
            'secure link for it.</p>';
          return;
        }
        // The server priced this, not the browser. If they disagree, trust the
        // server and show its number.
        if (typeof r.j.totalCents === 'number' && r.j.totalCents !== q().totalCents) {
          state.serverTotalCents = r.j.totalCents;
        }
        var stripe = window.Stripe(CFG.stripePublishableKey);
        var elements = stripe.elements({
          clientSecret: r.j.clientSecret,
          appearance: { theme: 'flat', variables: { colorPrimary: '#e01a1a', borderRadius: '10px' } }
        });
        mount.innerHTML = testBanner + '<div id="bkStripeEl"></div>';
        elements.create('payment', { layout: 'tabs' }).mount(mount.querySelector('#bkStripeEl'));
        root._stripe = { stripe: stripe, elements: elements, kind: r.j.kind };
      })
      .catch(function () {
        mount.innerHTML = '<p class="bk-hint">No card needed today. ' +
          'Your booking goes through as normal, and if anything is due up front we will send you a ' +
          'secure link for it.</p>';
      });
  }

  var PAYPAL_OFF = '<p class="bk-hint">PayPal is not available here yet. ' +
    'Choose card instead, or carry on and we will send you a PayPal link.</p>';

  /** PayPal and Venmo. Stripe does not carry Venmo, so PayPal's SDK does. */
  function mountPayPal(mount) {
    if (!CFG.paypalClientId) {
      mount.innerHTML = PAYPAL_OFF;
      return;
    }

    // Same missing loader as Stripe had. Venmo is the whole reason PayPal is
    // here, so it is asked for explicitly.
    if (!window.paypal) {
      mount.innerHTML = '<p class="bk-loading">Loading payment options...</p>';
      return loadScript(
        'https://www.paypal.com/sdk/js?client-id=' + encodeURIComponent(CFG.paypalClientId) +
        '&currency=USD&enable-funding=venmo&components=buttons',
      )
        .then(function () {
          if (window.paypal) return mountPayPal(mount);
          mount.innerHTML = PAYPAL_OFF;
        })
        .catch(function () {
          mount.innerHTML = PAYPAL_OFF;
        });
    }
    mount.innerHTML = '<div id="bkPaypalBtns"></div>';
    try {
      window.paypal.Buttons({
        style: { layout: 'vertical', shape: 'rect', label: 'pay' },
        createOrder: function () {
          return fetch('/api/paypal-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'create',
              cart: wireCart(),
              contact: state.contact,
              consent: consentPayload(),
              turnstileToken: state.turnstileToken,
              detailer: detailerParam(),
              // The early or late fee shown, used by the server only if it cannot read the calendar.
              timeFeeBp: shownTimeFeeBp()
            })
          }).then(function (r) { return r.json(); }).then(function (j) {
            if (!j.id) throw new Error(j.message || 'PayPal could not start');
            return j.id;
          });
        },
        onApprove: function (data) {
          return fetch('/api/paypal-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'capture', orderId: data.orderID })
          }).then(function (r) { return r.json(); }).then(function (j) {
            if (j.status === 'COMPLETED') {
              state.payState = 'paid';
              submit();
            } else {
              flash('PayPal did not complete that payment. Try again or choose card.');
            }
          });
        },
        onError: function () {
          flash('PayPal ran into a problem. Try again or choose card.');
        }
      }).render('#bkPaypalBtns');
    } catch (e) {
      mount.innerHTML = PAYPAL_OFF;
    }
  }

  /** Stable per-attempt key, so a double tap cannot create two charges. */
  var _key = null;
  function bookingKey() {
    if (!_key) _key = 'bk_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    return _key;
  }

  /* ================= summary table ================= */

  /**
   * What every discount on this booking is worth, together.
   *
   * Summed from the lines the customer is already looking at, so the figure
   * at the bottom is the arithmetic of the rows above it rather than a
   * second calculation that might disagree with them.
   *
   * The percentage is against the SERVICE list price, not the grand total.
   * Travel is never discounted, so including it would quietly shrink the
   * number: a 25% discount would read as 19% because of a drive.
   */
  function savings(quote) {
    var off = 0, list = 0;
    quote.lines.forEach(function (l) {
      if (l.kind === 'travel' || l.kind === 'tax' || l.kind === 'surcharge') return;
      if (l.amountCents < 0) off -= l.amountCents;
      else list += l.amountCents;
    });
    return { cents: off, pct: list > 0 ? Math.round((off / list) * 100) : 0 };
  }

  function lineTable(quote) {
    // Travel is drawn on its own below, with the distance and the drive time
    // behind it. Leaving the quote's own bare "Travel" line in as well
    // printed the same fee twice.
    // Row classes are "ln-" + the line's kind. A bare "addon" picked up the
    // site's add-on card (styles.css .addon: border, padding, a hover lift),
    // so every extra drew as a big box that did nothing on hover (owner's
    // screenshot, November 11).
    var lines = quote.lines.filter(function (l) { return l.kind !== 'travel'; });
    var vehNote = function (l) {
      return l.vehicleIndex !== null && state.vehicles.length > 1 ? ' <i>(vehicle ' + (l.vehicleIndex + 1) + ')</i>' : '';
    };
    var rows = lines.map(function (l, i) {
      if (l.kind === 'addon') {
        // A vehicle's extras: one bold "Extras:" line with no price, then
        // each extra indented, its price in the price column (owner, November 11).
        var prev = lines[i - 1];
        var head = !prev || prev.kind !== 'addon' || prev.vehicleIndex !== l.vehicleIndex
          ? '<tr class="ln-extras-h"><td>Extras' + vehNote(l) + ':</td><td></td></tr>' : '';
        var cut = l.label.indexOf(': ');
        var name = cut > -1 ? l.label.slice(0, cut) : l.label;
        var tier = cut > -1 ? l.label.slice(cut + 2) : '';
        // "Pet Hair Removal: Pet hair removal" says the name twice.
        if (tier.toLowerCase() === name.toLowerCase()) tier = '';
        return head + '<tr class="ln-addon"><td>' + esc(name) + (tier ? ' <i>' + esc(tier) + '</i>' : '') +
          '</td><td>' + $(l.amountCents) + '</td></tr>';
      }
      return '<tr class="ln-' + l.kind + (l.amountCents < 0 ? ' neg' : '') + '">' +
        '<td>' + esc(l.label) + vehNote(l) + '</td><td>' + $(l.amountCents) + '</td></tr>';
    }).join('');

    /*
     * Travel, with the drive behind it.
     *
     * "added at confirmation" beside a blank is the line a customer squints
     * at. Once the drive has been measured there is a real distance and a
     * real time to show, and showing them is what makes the fee look like
     * arithmetic rather than a number we picked.
     */
    var tr = state.travel;
    var trMins = tr.source === 'routes' && tr.minutes !== null ? tr.minutes : null;
    var trSummary = trMins !== null ? driveSummary(tr, trMins) : '';

    /*
     * THE MONEY COMES FROM THE QUOTE, not from a second sum done here.
     *
     * Rebuilding the fee from state.travel meant the row could disagree with
     * the total it sits above: a quote priced off the ZIP estimate showed
     * "added at confirmation" beside a blank while the total already had the
     * fee in it, which is the one thing a receipt must never do.
     */
    var travel = quote.travelIsEstimate
      ? '<tr class="pending"><td>Travel <i>from your address</i></td>' +
        '<td>added at confirmation</td></tr>'
      : '<tr><td>Travel <i>' +
        esc(trSummary ? trSummary + ' each way, measured' : 'estimated from your ZIP') +
        '</i></td><td>' + $(quote.travelCents) + '</td></tr>';
    var tax = quote.taxIsEstimate ? '<tr class="pending"><td>Sales tax</td><td>added at confirmation</td></tr>' : '';
    var when = state.slot
      // The arrival line on a row of its own, across both columns: inside the
      // price column it squeezed the labels ("Basic / Interior").
      ? '<tr class="when"><td>Your time</td><td>' +
        esc(tzDay(state.slot, { weekday: 'short', month: 'short', day: 'numeric' })) + '</td></tr>' +
        '<tr class="when-sub"><td colspan="2"><i class="bk-arrive">Arrive ' + esc(arrivalWindow(state.slot)) +
        ' · about ' + esc(fmtDur(holdMinutes())) + ' detailing</i></td></tr>'
      : '';

    // Every discount, against what the same booking would cost with none of
    // them: the extra-vehicle rate, the interior-and-exterior combo, a promo
    // code, and paying in full. Priced by re-quoting rather than by adding
    // four figures together, so it is right whatever combination applies and
    // stays right when a fifth is added.
    var won = savings(quote);
    var saved = won.cents > 0
      ? '<tr class="saved"><td>You saved</td><td>' + $(won.cents) +
        (won.pct >= 1 ? ' <i>(' + won.pct + '% off)</i>' : '') + '</td></tr>'
      : '';
    return '<table class="bk-lines">' + rows + travel + tax +
      '<tr class="tot"><td>Total</td><td>' + $(quote.totalCents) + '</td></tr>' + saved + when + '</table>';
  }

  /* ================= interactions ================= */

  function onClick(e) {
    var t = e.target.closest(
      '[data-size],[data-intent],[data-pkg],[data-addon],[data-clear],[data-slot],' +
      '[data-pay],[data-delveh],[data-browsepick],[data-max],[data-sort],[data-pkgfirst],' +
      '[data-kind],[data-paymethod],[data-corr],[data-coating],[data-garage],[data-step],' +
      '[data-prefday],[data-prefpart],[data-interest],[data-interest-only],[data-wkday],[data-more],[data-steer],[data-flexday],[data-wkfold],[data-ckcont],[data-cksec],[data-access],[data-extrarm],' +
      '#bkWkPrev,#bkWkNext,#bkWkNext2,#bkWkToday,#bkWkBack,#bkShowAll,#bkShowRecs,#bkFeeWhy,' +
      '#bkAddVeh,#bkNext,#bkBack,#bkClose,#bkScrim,#bkBrowse,#bkBrowseBack,' +
      '#bkAskMode,#bkAskMode2,#bkSlotMode,#bkFlexOpen,#bkPickChange,#bkShowExtras,' +
      '#bkLeaveStay,#bkLeaveKeep,#bkLeaveAsk,#bkLeaveDrop,#bkFresh,' +
      '#bkDoneClose,#bkDoneAsk,#bkDoneCopy,#bkDoneAgain,#bkPrepSend,[data-media],' +
      '#bkPromoApply,#bkPromoClear,' +
      '#bkQClear,#bkReset'
    );
    if (!t) return;
    var v = veh();


    if (t.id === 'bkPromoClear') { state.promoCode = ''; return render(); }
    if (t.id === 'bkPromoApply') {
      var pbox = el('bkPromo');
      // Normalised on the way in, so "  likenew " and "LIKENEW" are one code.
      state.promoCode = pbox ? P.normalisePromo(pbox.value) : '';
      return renderKeepFocus('#bkPromoClear', '#bkPromo');
    }
    if (t.id === 'bkBrowse') { state.browse = true; return render(); }
    if (t.id === 'bkBrowseBack') { state.browse = false; return render(); }
    if (t.id === 'bkQClear') { state.browseQ = ''; return render(); }
    if (t.id === 'bkReset') { state.browseQ = ''; state.browseMax = null; return render(); }
    if (t.dataset.max !== undefined) {
      state.browseMax = t.dataset.max === 'all' ? null : Number(t.dataset.max);
      return render();
    }
    if (t.dataset.sort) { state.browseSort = t.dataset.sort; return render(); }
    if (t.dataset.pkgfirst !== undefined) {
      state.browsePkgFirst = !state.browsePkgFirst;
      track('browse_pkgfirst', { on: state.browsePkgFirst });
      return render();
    }
    if (t.dataset.kind) { cycleFilter(t.dataset.kind); return render(); }
    if (t.dataset.paymethod) {
      /*
       * In place, never a render.
       *
       * A full render rebuilds the confirm screen from the top, and the
       * optional add-ons panel sits above the payment section. Choosing how
       * to pay threw the reader back up to a box they had already decided to
       * skip. Nothing about picking card or PayPal changes a price, so
       * nothing above it needs redrawing.
       */
      state.payMethod = t.dataset.paymethod;
      root.querySelectorAll('[data-paymethod]').forEach(function (b) {
        b.classList.toggle('on', b === t);
      });
      // The mandate applies to a saved card and not to PayPal, so the box it
      // lives in is rebuilt by mountPayment rather than left contradicting
      // the choice just made.
      root._stripe = null;
      mountPayment();
      return;
    }
    if (t.dataset.corr) {
      v.correctionTier = v.correctionTier === t.dataset.corr ? null : t.dataset.corr;
      state.slot = null; // scheduling rules change with it
      return render();
    }
    if (t.dataset.coating) { v.coatingTerm = t.dataset.coating; return render(); }
    if (t.dataset.garage !== undefined) { v.noGarage = t.dataset.garage === '1'; return render(); }

    // Picking from browse sets intent AND package in one go, then drops the
    // customer straight into add-ons rather than replaying the two screens
    // they just skipped.
    if (t.dataset.browsepick) {
      if (t.dataset.browsekind === 'addon') {
        // An add-on needs a package under it, so route to the picker for that
        // category with the add-on already selected.
        var def = P.findAddon(t.dataset.browsepick);
        state.advice = false;
        v.intent = def.scope;
        v.addons = [{ addonId: def.id, tierId: t.dataset.browsetier }];
        state.browse = false;
        return go(v.size ? 2 : 0);
      }
      var picked = P.findPackage(t.dataset.browsepick);
      // Picking one from the catalogue IS deciding, so the request goes back
      // to being a booking.
      state.advice = false;
      v.intent = picked.category;
      v.packageIds = [picked.id];
      v.addons = [];
      state.browse = false;
      // Someone who came in through View Services skipped the size question,
      // so ask it now rather than pricing the job without it.
      return go(v.size ? 3 : 0);
    }

    if (t.dataset.size) { v.size = t.dataset.size; return advance(); }
    if (t.dataset.intent) {
      if (t.dataset.intent === 'advice') {
        state.advice = true;
        v.intent = null;
        v.packageIds = [];
        v.addons = [];
        return advance();
      }
      state.advice = false;
      if (v.intent !== t.dataset.intent) { v.intent = t.dataset.intent; v.packageIds = []; v.addons = []; }
      return advance();
    }

    if (t.dataset.pkg) {
      var cat = t.dataset.cat;
      var was = v.packageIds.indexOf(t.dataset.pkg) > -1;
      v.packageIds = v.packageIds.filter(function (id) { return P.findPackage(id).category !== cat; });
      if (!was) v.packageIds.push(t.dataset.pkg);
      // Dropping a package can invalidate an add-on that depended on it.
      pruneAddons(v);
      // Showroom Ready needs a correction level, and "Both" needs one package
      // from each list, so only auto-advance once the step is actually done.
      if (!vPackage()) return advance();
      render();
      // "Both": an interior picked and no exterior yet, so bring the exterior
      // list up (owner, November 11).
      var hasExt = v.packageIds.some(function (id) { return P.findPackage(id).category === 'exterior'; });
      if (v.intent === 'both' && cat === 'interior' && !was && !hasExt) {
        var ext = el('bkBody').querySelector('[data-grp="exterior"]');
        if (ext) scrollToEl(ext, 12);
      }
      return;
    }

    if (t.dataset.addon) {
      var id = t.dataset.addon, tier = t.dataset.tier;
      var cur = v.addons.filter(function (a) { return a.addonId === id; })[0];
      v.addons = v.addons.filter(function (a) { return a.addonId !== id; });
      // Tiers are mutually exclusive: tapping the selected one clears it.
      if (!cur || cur.tierId !== tier) {
        v.addons.push({ addonId: id, tierId: tier });
        // Which add-ons are taken, and whether we recommended them: the data
        // the recommendation ranking (recommend.ts) is meant to learn from.
        track('addon_add', { addon: id, tier: tier, recommended: Boolean(t.closest('.bk-addrecs')), via: 'extras' });
      }
      pruneAddons(v);
      return renderKeepFocus('[data-addon="' + id + '"][data-tier="' + tier + '"]');
    }
    if (t.dataset.extrarm) {
      // "1|pet-hair": the vehicle index matters here, because the confirm
      // screen shows every vehicle at once rather than the active one.
      var rm = t.dataset.extrarm.split('|');
      var rmVeh = state.vehicles[Number(rm[0])];
      if (rmVeh) {
        rmVeh.addons = rmVeh.addons.filter(function (a) { return a.addonId !== rm[1]; });
        pruneAddons(rmVeh);
      }
      return render();
    }

    if (t.dataset.clear) {
      v.addons = v.addons.filter(function (a) { return a.addonId !== t.dataset.clear; });
      pruneAddons(v);
      return render();
    }

    if (t.dataset.steer) {
      var steerFrom = state.slot, steerTo = Number(t.dataset.steer);
      state.steerUsed = true;
      selectSlot(steerTo, 'steer', { reason: 'steer' });
      track('time_steer_used', { step: step().id, shift_min: Math.round((steerTo - steerFrom) / 60000) });
      renderTotal();
      // Check the new time is still free, here, and stay put.
      setPick('<span class="bk-pick-txt"><b>Checking that time</b></span>');
      return verifySlot().then(function (free) {
        if (!free) selectSlot(steerFrom);
        state.checkedSlot = state.slot;
        render();
        flash(free
          ? 'Moved to ' + tzDay(state.slot, { weekday: 'long' }) + ', arriving ' + arrivalWindow(state.slot) + '.'
          : 'That time was just taken, so you keep ' + tzTime(state.slot) + '.');
        // Good news is not an error: ink on grey, not red (checkout review, November 10).
        var said = free && el('bkBody').querySelector('.bk-err');
        if (said) said.classList.add('bk-okmsg');
      });
    }
    if (t.id === 'bkPickChange') {
      track('time_change', { step: step().id });
      return ckOpenSection('when');
    }
    if (t.dataset.more) return openMoreTimes(t);
    if (t.id === 'bkFlexOpen') {
      if (togglePanel(t.closest('.bk-pickday'), t)) track('time_flex_open', { rules: P.TIME_RECOMMENDATION_RULES.version });
      return;
    }
    if (t.dataset.flexday) {
      var flexMs = Number(t.dataset.flexday);
      state.slot = null;
      state.checkedSlot = null;
      state.prefer = { parts: [], days: [cinciKey(flexMs)], flex: true };
      track('time_flex_pick', { days_ahead: Math.round((flexMs - Date.now()) / DAY), rules: P.TIME_RECOMMENDATION_RULES.version });
      return timeChosen();
    }
    if (t.dataset.slot) {
      if (tlPicking) return;
      selectSlot(Number(t.dataset.slot), t.dataset.via || 'calendar',
        t.dataset.rank ? { rank: Number(t.dataset.rank), reason: t.dataset.reason } : null);
      renderTotal();
      // Every time on the time step is one tap (owner, November 10): our
      // recommended times, the chips in the bottom bar, and a start picked on
      // the week (its hover block already showed the whole detail, start to
      // finish). The time is chosen and checked, and the next step opens.
      // Coming back shows it as the block and in the bottom bar.
      // The day timeline is the exception (owner, November 12): a tap on a
      // row only selects it, so its card can be read and times compared (a
      // touch screen has no pointing, so the tap was the only way to see a
      // card, and it left the calendar). The card's button, or Continue in
      // the bar, moves on.
      if (t.closest('.bk-tl') && !t.closest('#bkTlCard')) {
        var keep = t.dataset.slot;
        repaintSlots();
        updatePick();
        if (onCheckout()) { el('bkNext').hidden = ckNextIdle(); fitCkCont(false); }
        var again = root.querySelector('.bk-tl .bk-tl-s[data-slot="' + keep + '"]');
        if (again && again.focus) again.focus({ preventScroll: true });
        updateCue();
        return;
      }
      // The card's button: the whole job shows as a solid block for a
      // moment first, then the form moves on (November 11).
      if (t.closest('.bk-tl')) {
        tlPicking = true;
        previewTl(t, true);
        setTimeout(function () { tlPicking = false; timeChosen(); }, reducedMotion() ? 0 : 450);
        return;
      }
      if (t.dataset.go || t.closest('.bk-wk')) return timeChosen();
      // The multi-day list: mark the choice in place.
      root.querySelectorAll('[data-slot]').forEach(function (b) {
        b.classList.toggle('on', b === t);
      });
      return;
    }
    if (t.id === 'bkWkPrev' || t.id === 'bkWkNext' || t.id === 'bkWkNext2' ||
        t.id === 'bkWkToday' || t.id === 'bkWkBack') {
      state.weekTouched = true;
      state.weekDay = -1;
      // Another week starts with Earlier and Later times folded, as a new
      // view does (owner, November 11).
      state.wkEarly = state.wkLate = false;
      state.weekStart = t.id === 'bkWkToday' ? P.weekStartOf(Date.now())
        : t.id === 'bkWkBack' ? P.weekStartOf(state.slot)
        : P.addWeeks(state.weekStart, t.id === 'bkWkPrev' ? -1 : 1);
      return loadSlots();
    }
    if (t.id === 'bkShowAll' || t.id === 'bkShowRecs') {
      if (t.id === 'bkShowAll') track('time_view_all', {});
      state.showAll = t.id === 'bkShowAll';
      state.weekDay = -1;
      state.wkEarly = state.wkLate = false;
      // Opening the calendar brings it to the top of the window (Contact and
      // Address above it scroll away); going back leaves the page alone.
      wkScrollUp = t.id === 'bkShowAll';
      state.weekTouched = false;
      autoSkips = 0;
      // The calendar opens on the week of the time already chosen, if any.
      state.weekStart = state.showAll && state.slot ? P.weekStartOf(state.slot) : 0;
      return loadSlots();
    }
    if (t.dataset.wkday !== undefined) {
      state.weekDay = Number(t.dataset.wkday);
      // Another day starts with Earlier and Later times folded (owner, November 11).
      state.wkEarly = state.wkLate = false;
      return repaintSlots();
    }

    if (t.dataset.access) {
      state.access[t.dataset.access] = t.dataset.accval;
      // In place, so the page does not jump back to the top of a long step.
      var accGroup = t.closest('.bk-acc');
      accGroup.classList.add('answered');
      accGroup.querySelectorAll('[data-access]').forEach(function (b) {
        b.classList.toggle('on', b === t);
      });
      /*
       * THE LAST SETUP QUESTION ENDS AT THE BOTTOM OF THE PAGE.
       *
       * Underneath these two questions sit the parking box, the anything-else
       * box and the confirm button, and all three are optional, so the walker
       * had nothing to move to and left the reader parked mid-screen looking
       * at a question they had just answered. Showing them the end of the
       * page is the answer: the optional boxes if they want them, and the
       * button if they do not.
       */
      // On the Done screen, stay put: nothing below needs walking to.
      if (state.done) return;
      if (!focusNext(accGroup)) showTail();
      return;
    }

    if (t.dataset.interestOnly) return interestOnly();
    if (t.dataset.interest) {
      toggle(state.interest, t.dataset.interest);
      return render();
    }
    if (t.dataset.prefday !== undefined || t.dataset.prefpart !== undefined) {
      var isDay = t.dataset.prefday !== undefined;
      toggle(isDay ? state.prefer.days : state.prefer.parts,
             isDay ? t.dataset.prefday : t.dataset.prefpart);
      // Chosen by hand, so no longer the one flexible day.
      state.prefer.flex = false;
      // A preference and a fixed slot are different answers to one question.
      state.slot = null;

      // In place. These sit at the foot of a long list of days, inside a
      // panel that a render() would have closed on the way to throwing the
      // reader back to the top of it.
      t.classList.toggle('on');
      root.querySelectorAll('[data-slot]').forEach(function (b) { b.classList.remove('on'); });
      root.querySelectorAll('.bk-pref-hint,.bk-pref-ok').forEach(function (p) {
        var ok = isInquiry();
        p.className = ok ? 'bk-pref-ok' : 'bk-pref-hint';
        p.textContent = ok ? PREF_OK : PREF_ASK;
      });
      // Continue shows only for a time or a request, and this updates in
      // place, so show or hide it here (final validation, November 11:
      // "Carry on" with nothing to carry on with).
      if (onCheckout()) { el('bkNext').hidden = ckNextIdle(); fitCkCont(false); }
      renderTotal();
      return;
    }
    if (t.dataset.ckcont) return ckAdvance(t.dataset.ckcont);
    if (t.dataset.cksec) return ckOpenSection(t.dataset.cksec);
    if (t.dataset.wkfold) {
      if (t.dataset.wkfold === 'early') state.wkEarly = true;
      else state.wkLate = true;
      return repaintSlots();
    }
    if (t.id === 'bkFeeWhy') {
      // In place: a redraw would move the page under the reader.
      var rules = el('bkFeeRules');
      if (rules) rules.hidden = !rules.hidden;
      t.setAttribute('aria-expanded', String(Boolean(rules && !rules.hidden)));
      return;
    }
    if (t.id === 'bkShowExtras') {
      state.showExtras = true;
      track('extras_open', {});
      return render();
    }
    if (t.id === 'bkAskMode' || t.id === 'bkAskMode2') {
      state.timeMode = 'ask';
      return render();
    }
    if (t.id === 'bkSlotMode') {
      state.timeMode = 'slots';
      // Their preferences stay recorded. If they pick a real time the slot
      // wins, because isInquiry() reads the slot first, and if they do not
      // then the request is still complete.
      return render();
    }

    if (t.dataset.pay) { state.payInFull = t.dataset.pay === 'now'; return render(); }

    if (t.id === 'bkAddVeh') {
      state.vehicles.push(newVehicle());
      state.active = state.vehicles.length - 1;
      return go(0);
    }
    if (t.dataset.delveh) {
      state.vehicles.splice(Number(t.dataset.delveh), 1);
      state.active = Math.min(state.active, state.vehicles.length - 1);
      return render();
    }

    if (t.dataset.step !== undefined) {
      var want = Number(t.dataset.step);
      var reachNow = Math.max(state.step, furthestValid());
      if (inCheckout(want) ? reachNow >= LOC_I : want <= reachNow) return go(want);
      return;
    }
    if (t.id === 'bkNext') return advance();
    if (t.id === 'bkBack') return goBack();
    if (t.id === 'bkClose' || t.id === 'bkScrim') return requestClose();
    if (t.id === 'bkLeaveStay') { state.leaving = false; return renderLeave(); }
    if (t.id === 'bkLeaveKeep') {
      var kept = saveDraft();
      close();
      return toast(kept
        ? 'Saved. Tap Book Now whenever you are ready and it will be here.'
        : 'This browser will not let us save it, sorry. Text us and we will hold it for you.');
    }
    if (t.id === 'bkLeaveAsk') return askAboutIt();
    if (t.dataset.media) {
      state.consent.media = t.dataset.media === 'yes';
      var mediaGroup = t.closest('.bk-acc');
      mediaGroup.classList.add('answered');
      mediaGroup.querySelectorAll('[data-media]').forEach(function (b) { b.classList.toggle('on', b === t); });
      focusNext(mediaGroup);
      return;
    }
    if (t.id === 'bkPrepSend') return sendPrep(false);
    if (t.id === 'bkDoneAsk') return amendBooking();
    if (t.id === 'bkDoneCopy') return copyQuoteLink(t);
    if (t.id === 'bkDoneAgain') {
      // Same person, same address, same day if they picked one. Only the
      // vehicle changes, so everything else stays put.
      var keep = { address: state.address, contact: state.contact, access: state.access };
      // This booking's answers go before the next one starts, and the next
      // booking gets its own key, so its emails never merge with this one.
      sendPrep(true);
      reset();
      _key = null;
      state.address = keep.address;
      state.contact = keep.contact;
      state.access = keep.access;
      state.step = 0;
      return render();
    }
    // Cancelling is a clear no: no follow-up for this booking.
    if (t.id === 'bkLeaveDrop') { clearDraft(); state.noFollowUp = true; return close(); }
    if (t.id === 'bkFresh') { clearDraft(); reset(); return render(); }
  }

  /** Drop add-ons whose requirement no longer holds after a package change. */
  function pruneAddons(v) {
    var ctx = { packageIds: v.packageIds, addonTiers: v.addons.map(function (a) { return { addonId: a.addonId, tierId: a.tierId }; }) };
    v.addons = v.addons.filter(function (a) {
      var def = P.findAddon(a.addonId);
      if (!def) return false;
      var others = { packageIds: ctx.packageIds, addonTiers: ctx.addonTiers.filter(function (x) { return x.addonId !== a.addonId; }) };
      return !P.addonBlockedReason(def, others);
    });
  }

  function onChange(e) {
    var t = e.target;
    if (t.id === 'bkNoLoc') { state.noGoodLocation = t.checked; return render(); }
    // In place: nothing on this screen changes, only the times offered next.
    if (t.id === 'bkCovered') { state.covered = t.checked; state.checkedSlot = null; return; }
    if (t.id === 'bkSplit') {
      state.separateTimes = t.checked;
      state.slot = null;
      return render();
    }
    if (t.dataset.extraadd !== undefined) {
      var addVeh = state.vehicles[Number(t.dataset.extraadd)];
      var picked = String(t.value || '').split('|');
      if (addVeh && picked.length === 2 && picked[0]) {
        addVeh.addons = addVeh.addons.filter(function (a) { return a.addonId !== picked[0]; });
        addVeh.addons.push({ addonId: picked[0], tierId: picked[1] });
        pruneAddons(addVeh);
        track('addon_add', { addon: picked[0], tier: picked[1], recommended: false, via: 'confirm' });
      }
      return render();
    }

    if (t.dataset.consentbox) {
      // In place: a render would refocus the name field and jump to the top.
      state.consent[t.dataset.consentbox] = t.checked;
      t.closest('.bk-check').classList.toggle('on', t.checked);
      if (t.checked && t.dataset.consentbox === 'terms') focusNext(t);
      return;
    }
    if (t.id === 'bkMandate') {
      state.mandate = t.checked;
      // In place, never a re-render. A full render on the confirm step tears
      // down the Stripe element and builds it again, which is slow, loses
      // anything typed into it, and used to throw the reader back to the top
      // of the longest screen in the funnel. It is also the LAST box, so
      // there is nowhere to jump to: point at Continue and stop.
      var label = t.closest('.bk-mandate');
      if (label) label.classList.toggle('on', t.checked);
      mountPayment();
      renderTotal();
      focusNext(t);
      return;
    }
    if (t.dataset.addr === 'region') { state.address.region = t.value; return renderTotal(); }

    // A text box finished, by typing or by autofill. Move to whatever is
    // still needed. Everything above has already returned.
    advanceWhenFilled(t);
  }

  function onInput(e) {
    var t = e.target;
    if (t.dataset.addr) {
      state.address[t.dataset.addr] = t.value;
      // Typed by hand, so the pick's coordinates no longer describe it; the
      // ZIP's centre stands in for the forecast. A chosen time is re-checked.
      delete state.address.lat;
      delete state.address.lng;
      state.checkedSlot = null;
      if (t.dataset.addr === 'zip') {
        // Repaint only the travel figure, so the field keeps focus mid-typing.
        var box = el('bkBody').querySelector('.bk-travel-slot');
        if (box) box.outerHTML = travelLine();
        renderTotal();
      }
      if (t.dataset.addr === 'line1') maybeAutocomplete(t.value);
      // Any address field can complete the address, so any of them can start
      // the measurement, and on the checkout a fresh read of the times.
      measureTravel();
      if (onCheckout()) scheduleSlotsRefresh();
      return;
    }
    if (t.dataset.promo !== undefined) {
      // Held raw while typing so the field keeps focus and the caret. It is
      // normalised and re-rendered on Apply or Enter, not on every keystroke.
      state.promoCode = t.value;
      return;
    }
    if (t.dataset.c) { state.contact[t.dataset.c] = t.value; return; }
    if (t.dataset.label !== undefined) { state.vehicles[Number(t.dataset.label)].label = t.value; return; }
    if (t.dataset.weekjump !== undefined) {
      var jumped = dayStartFromInput(t.value);
      if (!jumped) return;
      state.weekTouched = true;
      state.weekDay = -1;
      state.wkEarly = state.wkLate = false;
      state.weekStart = P.weekStartOf(jumped + DAY / 2);
      return loadSlots();
    }
    if (t.dataset.otherstart !== undefined) {
      if (!t.value) return;
      selectSlot(Number(t.value), 'recommended_other', { rank: Number(t.dataset.rank), reason: t.dataset.reason });
      return timeChosen();
    }
    if (t.dataset.heard !== undefined) {
      state.heard = t.value;
      if (t.value) track('heard_about', { answer: t.value });
      return;
    }
    if (t.dataset.note === 'loc') { state.locationNote = t.value; return; }
    if (t.dataset.note === 'parking') { state.access.parking = t.value; return; }
    if (t.dataset.note === 'general') { state.notes = t.value; return; }
    if (t.hasAttribute('data-browseq')) {
      state.browseQ = t.value;
      // Repaint only the results, so the field never loses focus mid-typing.
      var body = el('bkBody');
      var scroll = body.scrollTop;
      body.innerHTML = STEPS[state.step].render();
      var input = body.querySelector('[data-browseq]');
      if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
      body.scrollTop = scroll;
      return;
    }
  }

  /* ---- address autocomplete (Google Places, only if a key is present) ---- */

  var acToken = null, acTimer = null;

  function maybeAutocomplete(text) {
    var box = root.querySelector('#bkAc');
    if (!box) return;
    var key = placesKey();
    if (!key || text.length < 4) { box.hidden = true; return; }

    clearTimeout(acTimer);
    acTimer = setTimeout(function () {
      if (!acToken) acToken = String(Date.now()) + Math.random().toString(36).slice(2);
      fetch('https://places.googleapis.com/v1/places:autocomplete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': key,
          'X-Goog-FieldMask': 'suggestions.placePrediction.text,suggestions.placePrediction.placeId'
        },
        body: JSON.stringify({
          input: text,
          sessionToken: acToken,
          includedRegionCodes: ['us'],
          locationBias: { circle: { center: { latitude: 39.1031, longitude: -84.512 }, radius: 80000 } }
        })
      })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          var list = (j.suggestions || []).slice(0, 5);
          if (!list.length) { box.hidden = true; return; }
          box.hidden = false;
          box.innerHTML = list.map(function (s) {
            var p = s.placePrediction;
            return '<button type="button" class="bk-ac-i" data-place="' + esc(p.placeId) + '">' +
              esc(p.text && p.text.text || '') + '</button>';
          }).join('');
        })
        .catch(function () { box.hidden = true; });
    }, 250);
  }

  /**
   * Fill street, city, state and ZIP from the suggestion they picked.
   *
   * It used to write the whole formatted line into Street and send focus to
   * City, so the customer typed again the city and ZIP the suggestion already
   * had. One Place Details call, in the same session as the autocomplete
   * (billed as one session), gives the parts. If it fails, the old behaviour
   * stands: the line goes into Street and they finish the rest.
   */
  function fillFromPlace(placeId, text) {
    var setField = function (name, value) {
      state.address[name] = value;
      var f = root.querySelector('[data-addr="' + name + '"]');
      if (f) f.value = value;
    };
    var fallback = function () {
      setField('line1', text);
      var city = root.querySelector('[data-addr="city"]');
      if (city) city.focus();
      measureTravel();
    };
    fetch('https://places.googleapis.com/v1/places/' + encodeURIComponent(placeId) +
      (acToken ? '?sessionToken=' + encodeURIComponent(acToken) : ''), {
      headers: { 'X-Goog-Api-Key': placesKey(), 'X-Goog-FieldMask': 'addressComponents,location' }
    })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error(String(r.status))); })
      .then(function (d) {
        acToken = null; // the session ends with the details call
        var part = function (type, short) {
          var c = (d.addressComponents || []).filter(function (x) { return (x.types || []).indexOf(type) > -1; })[0];
          return c ? (short ? c.shortText : c.longText) || '' : '';
        };
        var street = [part('street_number'), part('route', true)].filter(Boolean).join(' ');
        var city = part('locality') || part('sublocality') || part('postal_town') || part('administrative_area_level_3');
        var region = part('administrative_area_level_1', true);
        var zip = part('postal_code');
        if (!street || !zip) return fallback();
        setField('line1', street);
        if (city) setField('city', city);
        if (STATES.indexOf(region) > -1) setField('region', region);
        setField('zip', zip);
        // Where the detail is, for that address's own weather forecast.
        if (d.location && typeof d.location.latitude === 'number') {
          state.address.lat = d.location.latitude;
          state.address.lng = d.location.longitude;
        }
        var box = el('bkBody').querySelector('.bk-travel-slot');
        if (box) box.outerHTML = travelLine();
        measureTravel();
        renderTotal();
        // Everything is filled, so the next thing is Continue.
        var line1 = root.querySelector('[data-addr="line1"]');
        if (line1) focusNext(line1);
      })
      .catch(fallback);
  }

  /* ================= submit ================= */

  function submit() {
    if (state.sending) return;
    var msg = root.querySelector('#bkMsg');
    state.sending = true;
    state.sendingSince = Date.now();
    if (msg) { msg.className = 'bk-msg ok'; msg.textContent = 'Confirming...'; }
    el('bkNext').disabled = true;

    /*
     * NEVER RECORD A PAYMENT THAT DID NOT HAPPEN.
     *
     * This ran the Stripe confirmation only `if (root._stripe)`, and fell
     * through to record() when it was null. On mobile the Payment Element
     * sometimes never mounted, so root._stripe was null, so a pay-in-full
     * booking went into the inbox and onto the calendar marked PAID with no
     * money taken and nobody any the wiser until the driveway.
     *
     * Prepay is switched off for now, but this guard is what makes turning it
     * back on safe, so it goes in regardless of the switch.
     */
    if (state.payInFull && state.payState !== 'paid' && !root._stripe) {
      state.sending = false;
      el('bkNext').disabled = false;
      state.payInFull = false;
      renderTotal();
      if (msg) {
        msg.className = 'bk-msg err';
        msg.textContent = 'The payment form did not load, so nothing was charged. ' +
          'Your booking is set to pay on the day instead. Press confirm again to send it.';
      }
      return;
    }

    // Take the payment or save the card first. Recording a booking we could
    // not collect for is worse than failing here with the funnel still open.
    if (root._stripe && state.payState !== 'paid') {
      var sp = root._stripe;
      sp.elements.submit()
        .then(function (r) {
          if (r.error) throw r.error;
          var fn = sp.kind === 'setup' ? sp.stripe.confirmSetup : sp.stripe.confirmPayment;
          return fn.call(sp.stripe, {
            elements: sp.elements,
            redirect: 'if_required',
            confirmParams: { return_url: location.origin + '/index.html#book' }
          });
        })
        .then(function (r) {
          if (r && r.error) throw r.error;
          state.payState = 'paid';
          record();
        })
        .catch(function (err) {
          state.sending = false;
          el('bkNext').disabled = false;
          if (msg) {
            msg.className = 'bk-msg err';
            msg.textContent = (err && err.message) ||
              'That payment did not go through. Check the details and try again.';
          }
        });
      return;
    }
    record();
  }

  /**
   * The confirmation email, to the customer and to Elijah.
   *
   * Fire and forget, deliberately. Web3Forms below is the path that must not
   * fail, and until today it was the ONLY email in the system: the customer
   * filled in nine screens and got nothing. An email problem is never the
   * customer's problem, so nothing here can reject, delay or be waited on.
   *
   * Ids only. The server reprices the whole thing, so the receipt that lands
   * in an inbox is its arithmetic rather than the browser's.
   */
  function sendConfirmation() {
    try {
      fetch('/api/send-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cart: wireCart(),
          contact: state.contact,
          consent: consentPayload(),
          turnstileToken: state.turnstileToken,
          mode: state.payInFull ? 'pay_now' : 'card_only',
          // So a retry writes one calendar event rather than two.
          idempotencyKey: bookingKey(),
          // Which tagged link brought them here, e.g. a magazine QR code.
          source: source(),
          // Which A/B test versions they saw, so bookings count per version.
          experiments: experiments(),
          // Their own answer to "Where did you hear about us?".
          heard: state.heard,
          // Who the time was given to. The server only honours a name in its
          // own DETAILERS setting; anything else books the default calendar.
          detailer: detailerParam(),
          // The early or late fee shown, used by the server only if it cannot read the calendar.
          timeFeeBp: shownTimeFeeBp()
        })
      }).catch(function () {});
    } catch (e) { /* an email must never cost us a booking */ }
  }

  function record() {
    var quote = q();
    var msg = root.querySelector('#bkMsg');

    sendConfirmation();

    var body = buildSummary(quote);
    var fd = new FormData();
    fd.append('access_key', WEB3FORMS_KEY);
    fd.append('subject', state.advice
      ? 'HELP ME DECIDE, ' + state.contact.name + ', ' +
        (state.slot ? new Date(state.slot).toLocaleString('en-US', { timeZone: TZ }) : (state.address.zip || 'no zip'))
      : (isInquiry() ? 'REQUEST, ' : shortNotice(state.slot) ? 'SHORT NOTICE REQUEST, ' : 'BOOKING, ') +
        (detailerName() ? detailerName() + ', ' : '') + state.contact.name + ', ' + $(quote.totalCents) +
        (state.slot ? ', ' + new Date(state.slot).toLocaleString('en-US', { timeZone: TZ }) : ''));
    fd.append('from_name', '513 Auto Clean Booking');
    fd.append('name', state.contact.name);
    fd.append('phone', state.contact.phone);
    if (state.contact.email) fd.append('email', state.contact.email);
    fd.append('message', body);

    fetch('https://api.web3forms.com/submit', {
      method: 'POST', body: fd, headers: { Accept: 'application/json' }
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (r) {
        state.sending = false;
        el('bkNext').disabled = false;
        if (r.ok && r.j.success) done(quote);
        else showSendError(msg);
      })
      .catch(function () { state.sending = false; el('bkNext').disabled = false; showSendError(msg); });
  }

  /** Writes the send failure into the status line. Takes the NODE, not text. */
  function showSendError(node) {
    if (!node) return;
    node.className = 'bk-msg err';
    node.textContent = 'Something went wrong sending that. Please call or text (513) 279-2915 and we will get you booked.';
  }

  function buildSummary(quote) {
    var a = state.address;
    return (state.advice
      ? 'HELP ME DECIDE, no package chosen. ' +
        (state.slot
          ? 'TIME IS HELD, ' + Math.round(P.ADVICE_HOLD_MIN / 60) + ' hours blocked. Work out the package with them.'
          : 'No time chosen.') + '\n\n'
      : 'BOOKING\n\n') +
      'WHO\n  ' + state.contact.name + '\n  ' + state.contact.phone +
      (state.contact.email ? '\n  ' + state.contact.email : '') + '\n\n' +
      (detailerName() ? 'DETAILER\n  ' + detailerName() + '\n\n' : '') +
      'WHEN\n  ' + (state.slot ? new Date(state.slot).toLocaleString('en-US', { timeZone: TZ }) : 'not selected') +
      (state.slot && shortNotice(state.slot) ? '\n  SHORT NOTICE: not confirmed until a detailer accepts. Reply to them.' : '') +
      (state.slot && coatingMoves(state.slot, holdMinutes()) ? '\n  COATING: too cold or wet on this date. Do the rest, book the coating for a warmer day.' : '') +
      (state.slot && needsPriority(state.slot) ? '\n  RUSH, within ' + rushWin().minLeadDays + (rushWin().minLeadDays === 1 ? ' day' : ' days') : '') +
      // The days a request asks for (validation, November 11: the email said
      // only "not selected", so nobody could reply with a time).
      (!state.slot && preferenceSummary() ? '\n  ' + preferenceSummary().replace(/^You asked for /, 'ASKED FOR: ') : '') +
      (!state.slot && state.prefer.flex ? '\n  FLEXIBLE DAY: any start that day. Text them the start time by the evening before.' : '') + '\n\n' +
      'WHERE\n  ' + [a.line1, a.city, a.region, a.zip].filter(Boolean).join(', ') +
      (state.covered ? '\n  Garage or covered spot: YES' : '') +
      (state.noGoodLocation ? '\n  ** NEEDS A LOCATION SORTED **\n  ' + (state.locationNote || '(no note)') : '') + '\n\n' +
      'VEHICLES\n' + state.vehicles.map(function (v, i) {
        var size = v.size ? P.vehicleSize(v.size) : null;
        return '  ' + (i + 1) + '. ' + [v.label, size ? '[' + size.label + ']' : ''].filter(Boolean).join(' ') +
          '\n     ' + v.packageIds.map(function (id) { return (P.findPackage(id) || {}).name; }).join(' + ') +
          (v.addons.length ? '\n     Add-ons: ' + v.addons.map(function (x) {
            var d = P.findAddon(x.addonId);
            var tr = d && d.tiers.filter(function (t) { return t.id === x.tierId; })[0];
            return d.name + (tr && d.tiers.length > 1 ? ' (' + tr.label + ')' : '');
          }).join(', ') : '');
      }).join('\n') + '\n\n' +
      (state.advice ? 'PRICING\n  None yet: no package chosen. Agree the package and price with them first.\n\n' :
      'PRICING\n' + quote.lines.map(function (l) {
        return '  ' + l.label + ': ' + $(l.amountCents);
      }).join('\n') +
      '\n  TOTAL: ' + $(quote.totalCents) +
      '\n  Paying: ' + (state.payInFull
        ? 'in full now'
        : state.mandate
          ? 'on the day; card on file is cancellation cover only'
          : 'in full when the detail is finished; no card taken') +
      // What the total really holds (validation, November 11: this line said
      // "added at confirmation" even when the measured drive was in the total).
      '\n  Travel: ' + (quote.travelIsEstimate ? 'added once the drive is measured' : $(quote.travelCents) + ', in the total') +
      (quote.serviceDurationMin ? '\n  On site: ' + fmtDur(quote.serviceDurationMin) : '') + '\n\n') +
      // The setup questions come after booking now, as a separate follow-up
      // email, so this booking has them only if they were given earlier.
      (accessText() ? 'ACCESS\n' + accessText() + '\n\n' : 'ACCESS\n  Asked after booking. Any answers come as a BOOKING FOLLOW-UP email.\n\n') +
      'CONSENT\n  Terms: yes, version ' + P.LEGAL.termsEffective +
      '\n  Card authorization: ' + (state.mandate ? 'YES' : 'no') +
      '\n  SMS: ' + (state.consent.sms ? 'YES' : 'no') +
      '\n  Filming: ' + (state.consent.media ? 'YES' : 'no') + '\n\n' +
      (state.notes ? 'NOTES\n  ' + state.notes + '\n' : '') +
      (source() ? '\nSOURCE\n  ' + source() + '\n' : '') +
      (experiments() ? '\nA/B TESTS\n  ' + experiments() + '\n' : '') +
      (state.heard ? '\nHEARD ABOUT US\n  ' + state.heard + '\n' : '');
  }

  /**
   * Everything they just sent, in a table they can read back.
   *
   * A confirmation that only says "thanks" asks the customer to trust that
   * the right thing arrived. This is the receipt: every answer, in the order
   * they gave it, so a mistake is spotted in the ten seconds when it is still
   * easy to fix rather than on the doorstep.
   */
  function receiptRows(quote) {
    var rows = [];
    var add = function (k, v) { if (v) rows.push([k, v]); };

    state.vehicles.forEach(function (v, i) {
      var size = v.size ? P.vehicleSize(v.size) : null;
      var names = v.packageIds.map(function (id) { return packageName(P.findPackage(id)); }).filter(Boolean);
      var label = state.vehicles.length > 1 ? 'Vehicle ' + (i + 1) : 'Vehicle';
      add(label, [v.label, size && size.label, names.join(' + ')].filter(Boolean).join(', '));
      if (v.addons.length) {
        add('Add-ons', v.addons.map(function (a) {
          var d = P.findAddon(a.addonId);
          return d ? d.name : a.addonId;
        }).join(', '));
      }
    });

    add('When', state.slot
      ? new Date(state.slot).toLocaleString('en-US', { timeZone: TZ,
          weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit'
        })
      : (isInquiry() ? preferenceSummary() || 'Times requested' : ''));
    add('Where', [state.address.line1, state.address.city, state.address.region, state.address.zip]
      .filter(Boolean).join(', '));
    add('You', [state.contact.name, state.contact.phone, state.contact.email].filter(Boolean).join(' · '));
    add('Water', state.access.water);
    add('Power', state.access.power);
    add('Parking', state.access.parking);
    add('Notes', state.notes);
    if (quote.promoCode && quote.promoDiscountCents > 0) {
      add('Promo', quote.promoCode + ', ' + $(quote.promoDiscountCents) + ' off');
    }
    add('Paying', state.payInFull ? 'In full, now' : 'On the day');

    // Three figures that add up, rather than one that needs explaining.
    // "Total, before travel" was a single number doing two jobs and reading
    // as neither.
    add('Before travel', $(quote.serviceSubtotalCents + quote.surchargeCents));
    add('Travel', quote.travelIsEstimate ? 'Added once we have measured the drive' : $(quote.travelCents));
    if (quote.payInFullDiscountCents > 0) add('Paid in full, saving', '-' + $(quote.payInFullDiscountCents));
    add('Sales tax', quote.taxIsEstimate ? 'Added with the travel' : $(quote.taxCents));
    add('Total', $(quote.totalCents) + (quote.travelIsEstimate ? ', so far' : ''));

    return '<dl class="bk-receipt">' + rows.map(function (r) {
      return '<dt>' + esc(r[0]) + '</dt><dd>' + esc(String(r[1])) + '</dd>';
    }).join('') + '</dl>';
  }

  /** " before travel" while the drive is unmeasured, ", travel included" once it is in the total. */
  function travelWord(quote) {
    return quote.travelIsEstimate ? ' before travel' : quote.travelCents > 0 ? ', travel included' : '';
  }

  function done(quote) {
    state.done = true;
    clearDraft();
    track(isInquiry() ? 'booking_request' : 'booking_complete', {
      value: Math.round(quote.totalCents) / 100,
      currency: 'USD',
      source: source() || '(none)'
    });
    // Start at the top. Everything else in the funnel keeps its place on
    // purpose, but this is a different screen with a different job, and
    // landing halfway down a receipt is not reading it.
    lastRenderedStep = null;
    el('bkBar').style.width = '100%';
    var asked = isInquiry() || (state.slot && shortNotice(state.slot));
    el('bkTitle').textContent = asked ? 'Request sent' : 'You are booked in';
    el('bkNext').hidden = true;
    el('bkBack').hidden = true;
    el('bkTotal').hidden = true;
    setPick('');

    // The step tabs are still on screen from the last render and every one of
    // them is dead: go() calls render(), and render() returns early once
    // state.done is set. A row of buttons that look clickable and do nothing
    // is worse than no buttons, so they become a finished-state line.
    // At checkout Back and the close button live in this bar: put them back in
    // the header first, or replacing the bar deletes them (validation,
    // November 11: no close button on Done, and the next open() crashed).
    var head = root.querySelector('.bk-head');
    if (head) { head.insertBefore(el('bkBack'), head.firstChild); head.appendChild(el('bkClose')); }
    root.querySelector('.bk-modal').classList.remove('ck');
    // Nothing is left in the footer on Done (an empty strip on phones).
    root.querySelector('.bk-modal').classList.add('is-done');
    el('bkNav').innerHTML = '<span class="bk-nav-done">' +
      (isInquiry() ? 'Request sent' : 'Booked') + ' &middot; ' +
      esc(new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })) +
      '</span>';

    el('bkBody').innerHTML =
      '<div class="bk-done"><div class="bk-done-ic">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6L9 17l-5-5"/></svg></div>' +
      '<h3>Thanks, ' + esc(state.contact.name.split(' ')[0]) + '.</h3>' +
      '<p>' + (state.advice && !state.slot
        // Help me decide with no time (validation, November 11: it read as a
        // plain time request, with no word of the recommendation).
        ? 'We have your request for a recommendation. We will read what you told us and come back with the package ' +
          'we would suggest, what it costs and a time from the days you picked, usually within a few hours.'
        : isInquiry()
        ? (state.prefer.flex
          ? 'We have your request for ' + esc(preferenceSummary().replace('You asked for any start time on ', '').replace(/\.$/, '')) +
            '. We confirm the day, usually within a few hours, and let you know the start time by the evening before.'
          : 'We have your request and the times that suit you. 513 Auto Clean will come back with a time to confirm.')
        : state.advice
          ? 'Your time is held' + (state.slot ? ' for <b>' +
              new Date(state.slot).toLocaleString('en-US', { timeZone: TZ, weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }) +
              '</b>' : '') + '. There is no total yet, because we have not recommended anything yet. ' +
            'We will do that with you before we start, and nothing is charged until you have agreed to it.'
          : shortNotice(state.slot)
          ? 'We have your short-notice request for <b>' +
              new Date(state.slot).toLocaleString('en-US', { timeZone: TZ, weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }) +
              '</b>. It is not confirmed until we reply, which depends on whether a detailer can take it. ' +
              'We will be in touch as fast as we can. Your total is <b>' + $(quote.totalCents) + '</b>' + travelWord(quote) + '.'
          : 'We have your booking' + (state.slot ? ' for <b>' +
              new Date(state.slot).toLocaleString('en-US', { timeZone: TZ, weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }) +
              '</b>' : '') + '. Your total is <b>' + $(quote.totalCents) + '</b>' + travelWord(quote) + '.') +
      '</p>' +

      (state.advice ? '' : prepBlock()) +

      '<h4 class="bk-done-h">What you sent us</h4>' +
      receiptRows(quote) +

      '<button type="button" class="bk-next-steps" id="bkSteps">What happens next</button>' +
      '<div class="bk-steps" id="bkStepsBody" hidden>' + nextSteps() + '</div>' +

      '<div class="bk-done-acts">' +
        '<button type="button" class="bk-done-fix" id="bkDoneAsk">Something needs changing</button>' +
        '<button type="button" class="bk-done-copy" id="bkDoneCopy">Copy my booking link</button>' +
        '<button type="button" class="bk-done-again" id="bkDoneAgain">Book another vehicle</button>' +
      '</div>' +
      // A booked time is settled; only a request waits on us (validation,
      // November 11: this line contradicted "You are booked in").
      '<p class="bk-done-call">Or call or text <a href="tel:+15132792915">(513) 279-2915</a>' +
      (asked || state.advice || !P.isLive('liveCalendar') ? '. Nothing is settled until you hear back from us.</p>' : ' if anything needs changing.</p>') +

      '<button type="button" class="bk-doneclose" id="bkDoneClose">Close</button>' +
      '</div>';

    // What the setup answers were when Done opened. Only a change made here
    // is a follow-up: anything given earlier is already in the booking email
    // (validation, November 11: a resumed draft's notes were sent twice).
    prepBase = prepState();
    el('bkBody').scrollTop = 0;
    el('bkScroll').scrollTop = 0;
  }

  /**
   * Send a correction after the booking has gone.
   *
   * There is no customer booking link yet, so "go back and change it" cannot
   * mean editing a stored record: the booking is an email that has already
   * left. What it CAN mean is a follow-up that carries the whole thing, so
   * Elijah reads the change next to what it changes rather than hunting for
   * the original.
   */
  function amendBooking() {
    var lines = draftSummary();
    var url = P.quoteUrl(quotePayload(), location.origin + location.pathname);
    var msg =
      'I just booked and something needs changing.\n\n' +
      (lines.length ? 'What I booked:\n' + lines.map(function (l) { return '  ' + l; }).join('\n') + '\n\n' : '') +
      'My booking: ' + url + '\n\nWhat needs changing: ';

    close();

    var form = document.getElementById('inquiryForm');
    if (!form) {
      return handOffQuestion({ 'q-name': state.contact.name, 'q-phone': state.contact.phone,
        'q-email': state.contact.email, 'q-zip': state.address.zip }, msg);
    }

    var set = function (id, val) { var f = document.getElementById(id); if (f && val) f.value = val; };
    set('q-name', state.contact.name);
    set('q-phone', state.contact.phone);
    set('q-email', state.contact.email);
    set('q-zip', state.address.zip);

    var message = document.getElementById('q-message');
    if (message) {
      message.value = msg;
      try { message.setSelectionRange(msg.length, msg.length); } catch (e) { /* older browsers */ }
    }
    (document.getElementById('inquiry') || form).scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(function () { if (message) message.focus(); }, 420);
  }

  /* ================= mount ================= */

  var SHELL =
    '<div class="bk-scrim" id="bkScrim"></div>' +
    '<div class="bk-leave" id="bkLeave" hidden></div>' +
    '<div class="bk-modal" role="dialog" aria-modal="true" aria-labelledby="bkTitle">' +
      '<div class="bk-progress" id="bkProgress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">' +
        '<div class="bk-bar" id="bkBar"></div>' +
      '</div>' +
      '<nav class="bk-nav" id="bkNav" aria-label="Booking steps"></nav>' +
      '<header class="bk-head">' +
        '<button type="button" class="bk-back" id="bkBack" hidden aria-label="Back">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M19 12H5M11 18l-6-6 6-6"/></svg>' +
        '</button>' +
        '<div class="bk-titles"><h2 id="bkTitle"></h2><p class="bk-titlesub" id="bkTitleSub" hidden></p></div>' +
        '<button type="button" class="bk-close" id="bkClose" aria-label="Close booking">&times;</button>' +
      '</header>' +
      '<div class="bk-scroll" id="bkScroll">' +
        '<div class="bk-quotenote" id="bkQuoteNote" hidden></div>' +
        '<div class="bk-body" id="bkBody"></div>' +
      '</div>' +
      // Shown while there is more below the fold, so a screen that happens to
      // end on a clean edge does not read as the end of the step.
      '<div class="bk-cue" id="bkCue" hidden><button type="button" id="bkCueBtn">More below' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>' +
      '</button></div>' +
      '<footer class="bk-foot">' +
        '<div class="bk-total" id="bkTotal" hidden>' +
          '<span class="bk-total-amt"></span><span class="bk-total-sub"></span>' +
        '</div>' +
        '<div class="bk-pick" id="bkPick" aria-live="polite" hidden></div>' +
        '<button type="button" class="bk-nextbtn" id="bkNext"><span>Continue</span>' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>' +
        '</button>' +
      '</footer>' +
    '</div>';

  var lastFocus = null;

  /* ---------------- a quote someone left behind ---------------- */

  /**
   * Saving a half-finished booking, at the customer's request only.
   *
   * Nothing is written here unless somebody clicks "Keep my quote" on the way
   * out. That matters: this holds a name, a phone number and a home address,
   * and the right default for that is to forget it. It stays in this browser,
   * never reaches a server, and expires on its own.
   *
   * localStorage rather than a cookie, because a cookie would be sent with
   * every request to the site, and there is no reason for any of this to
   * leave the device.
   */
  // v2: the steps changed (no Vehicles step), so an older draft's step
  // number would land on the wrong screen.
  var DRAFT_KEY = 'ac-booking-draft-v2';
  var DRAFT_DAYS = P.DRAFT_KEEP_DAYS;

  /** Answers only. Never the payment state, the card, or the bot token. */
  var DRAFT_FIELDS = [
    'step', 'vehicles', 'active', 'address', 'noGoodLocation', 'covered', 'locationNote',
    'priority', 'slot', 'detailer', 'contact', 'consent', 'interest',
    'prefer', 'promoCode', 'notes', 'separateTimes', 'payInFull', 'access', 'heard',
    'advice', 'timeMode'
  ];

  function saveDraft() {
    try {
      var keep = {};
      DRAFT_FIELDS.forEach(function (k) { keep[k] = state[k]; });
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ v: 1, at: Date.now(), state: keep }));
      return true;
    } catch (e) {
      // Private windows and blocked site data both throw here. A quote that
      // cannot be saved is not a broken booking, so say nothing and move on.
      return false;
    }
  }

  function loadDraft() {
    try {
      var raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return null;
      var d = JSON.parse(raw);
      if (!d || d.v !== 1 || !d.state) return null;
      if (Date.now() - (d.at || 0) > DRAFT_DAYS * 86400000) { clearDraft(); return null; }
      return d.state;
    } catch (e) {
      return null;
    }
  }

  function clearDraft() {
    try { localStorage.removeItem(DRAFT_KEY); } catch (e) { /* nothing to do */ }
  }

  /**
   * Is there enough here to be worth asking about?
   *
   * Someone who opened the funnel and closed it again has lost nothing, and
   * a confirmation dialog on the way out of an empty form is just a door
   * that sticks.
   */
  function worthKeeping() {
    if (state.done || state.sending) return false;
    var v = state.vehicles[0];
    return Boolean(
      (v && (v.size || v.packageIds.length || v.addons.length)) ||
      state.vehicles.length > 1 ||
      state.slot ||
      state.address.line1 || state.address.zip ||
      state.contact.name || state.contact.phone
    );
  }

  /** A plain description of where they got to, for the panel and the email. */
  function draftSummary() {
    var bits = [];
    state.vehicles.forEach(function (v) {
      var names = v.packageIds.map(function (id) { return (P.findPackage(id) || {}).name; }).filter(Boolean);
      var size = v.size ? P.vehicleSize(v.size) : null;
      var line = [size ? size.label : '', names.join(' + ')].filter(Boolean).join(', ');
      if (v.addons.length) line += ' plus ' + v.addons.length + ' add-on' + (v.addons.length === 1 ? '' : 's');
      if (line) bits.push(line);
    });
    if (state.slot) {
      bits.push(new Date(state.slot).toLocaleString('en-US', { timeZone: TZ,
        weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
      }));
    }
    if (state.address.city || state.address.zip) {
      bits.push([state.address.city, state.address.zip].filter(Boolean).join(' '));
    }
    return bits;
  }

  /**
   * While the funnel is open the rest of the page is inert: a screen reader
   * cannot wander into it and Tab cannot leave the dialog. `inert` is the
   * platform's own way to say that; the keydown trap below covers browsers
   * that do not have it.
   */
  function setPageInert(on) {
    var kids = document.body.children;
    for (var i = 0; i < kids.length; i++) {
      var k = kids[i];
      if (k === host || k.tagName === 'SCRIPT') continue;
      if (on) {
        k.setAttribute('inert', '');
        k.setAttribute('aria-hidden', 'true');
      } else {
        k.removeAttribute('inert');
        k.removeAttribute('aria-hidden');
      }
    }
  }

  var FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

  function trapTab(e) {
    if (e.key !== 'Tab' || !host || host.hidden) return;
    // While the leaving panel is up it owns the focus, not the form behind it.
    var scope = state.leaving ? (el('bkLeave') || host) : host;
    var items = Array.prototype.filter.call(scope.querySelectorAll(FOCUSABLE), function (n) {
      return n.offsetParent !== null;
    });
    if (!items.length) return;
    var first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function open() {
    if (!host) return;
    reset();
    track('booking_open');

    // Pick up exactly where they left off, including the step they were on,
    // because that is what they asked for when they kept it.
    var draft = loadDraft();
    if (draft) {
      try {
        Object.keys(draft).forEach(function (k) {
          if (draft[k] !== undefined) state[k] = draft[k];
        });
        state.resumed = true;
        state.step = Math.max(0, Math.min(STEPS.length - 1, Number(state.step) || 0));
        // A draft written by an older build could be shaped differently.
        // Prove it before trusting it, rather than rendering a broken form.
        if (!Array.isArray(state.vehicles) || !state.vehicles.length || !state.vehicles[0]) {
          throw new Error('draft shape');
        }
        state.vehicles.forEach(function (v) {
          if (!Array.isArray(v.packageIds) || !Array.isArray(v.addons)) throw new Error('draft shape');
        });
      } catch (e) {
        clearDraft();
        reset();
      }
    }

    host.hidden = false;
    document.body.classList.add('bk-open');
    lastFocus = document.activeElement;
    setPageInert(true);
    document.addEventListener('keydown', trapTab);
    render();
    el('bkClose').focus();
  }

  /**
   * The way out.
   *
   * A tap on the backdrop is as easy to do by accident as on purpose, and
   * losing eight answered questions to a misplaced thumb is the sort of thing
   * people do not come back from. So a close with real work behind it asks
   * first, and offers to keep it.
   */
  function requestClose() {
    if (!worthKeeping()) return close();
    state.leaving = true;
    renderLeave();
  }

  function renderLeave() {
    var box = el('bkLeave');
    if (!box) return close();

    if (!state.leaving) {
      box.hidden = true;
      box.innerHTML = '';
      return;
    }

    var lines = draftSummary();
    box.hidden = false;
    box.innerHTML =
      '<div class="bk-leave-card" role="dialog" aria-modal="true" aria-labelledby="bkLeaveT">' +
        '<h3 id="bkLeaveT">Abandon your detail quote?</h3>' +
        (lines.length
          ? '<ul class="bk-leave-sum">' +
              lines.map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') +
            '</ul>'
          : '') +
        '<div class="bk-leave-acts">' +
          '<button type="button" class="bk-leave-go" id="bkLeaveStay">' + CHEV_L + 'Back to my booking</button>' +
          '<div class="bk-leave-pair">' +
            '<button type="button" id="bkLeaveKeep">' + LEAVE_SAVE + 'Keep it for next time</button>' +
            '<button type="button" id="bkLeaveAsk">' + LEAVE_ASK + 'I have a question</button>' +
          '</div>' +
          '<button type="button" class="bk-leave-drop" id="bkLeaveDrop">Cancel my booking</button>' +
        '</div>' +
        '<p class="bk-leave-note">Keeping it stores your answers in this browser only, for ' +
          DRAFT_DAYS + ' days.' + (P.isLive('checkoutFollowUp') && onCheckout() && canFollowUp()
            ? ' The contact details you gave at checkout reach us, so we can follow up once about this booking.'
            : ' They never reach us until you book.') + '</p>' +
      '</div>';

    var first = box.querySelector('#bkLeaveStay');
    if (first) first.focus();
  }

  /**
   * Hand the whole half-finished quote to the question form.
   *
   * Someone who stops to ask a question has usually hit something the funnel
   * did not answer, and making them retype what they already picked is how
   * that turns into no message at all. The summary and a link that reopens
   * this exact quote both go into the message, so the reply can be specific.
   */
  function askAboutIt() {
    var url = P.quoteUrl(quotePayload(), location.origin + location.pathname);
    var lines = draftSummary();
    var msg =
      'I was booking and had a question.\n\n' +
      (lines.length ? 'What I had picked:\n' + lines.map(function (l) { return '  ' + l; }).join('\n') + '\n\n' : '') +
      'My quote: ' + url + '\n\nMy question: ';

    saveDraft();
    close();
    toQuestionForm(msg);
  }

  /**
   * Register interest without booking (bug, November 11): a message to the
   * question form saying which coming-soon service, with their vehicle, so
   * the owner hears about it. Booking something else still carries the
   * interest with the booking (the Review's "We will let you know" box).
   */
  function interestOnly() {
    var v0 = state.vehicles[0];
    var size = v0 && P.VEHICLE_SIZES.filter(function (s) { return s.id === v0.size; })[0];
    var msg = 'Please tell me when ' + interestNames().join(' and ') + ' opens. I would like to be one of the first.\n\n' +
      (size ? 'My vehicle: ' + size.label + ' (' + size.examples + ')\n\n' : '') +
      'Anything else: ';
    close();
    toQuestionForm(msg);
  }

  /** Into the question form: on this page if it is here, else via contact.html. */
  function toQuestionForm(msg) {
    var form = document.getElementById('inquiryForm');
    if (!form) {
      var v0 = state.vehicles[0];
      return handOffQuestion({ 'q-name': state.contact.name, 'q-phone': state.contact.phone,
        'q-email': state.contact.email, 'q-zip': state.address.zip, 'q-vehicle': v0 && v0.label }, msg);
    }

    var set = function (id, val) {
      var f = document.getElementById(id);
      if (f && val && !f.value) f.value = val;
    };
    set('q-name', state.contact.name);
    set('q-phone', state.contact.phone);
    set('q-email', state.contact.email);
    set('q-zip', state.address.zip);
    var v = state.vehicles[0];
    set('q-vehicle', v && v.label);

    var message = document.getElementById('q-message');
    if (message) {
      message.value = msg;
      // The cursor lands after "My question: ", so they can just type.
      try { message.setSelectionRange(msg.length, msg.length); } catch (e) { /* older browsers */ }
    }

    var target = document.getElementById('inquiry') || form;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(function () { if (message) message.focus(); }, 420);
  }

  /**
   * The question form lives on contact.html. From a page without it (the home
   * page, services.html), carry what they entered across for ONE page load,
   * read once and deleted by script.js, instead of the old fallback: an sms:
   * link, which on a desktop does nothing at all. The privacy policy says so.
   */
  function handOffQuestion(fields, msg) {
    try { sessionStorage.setItem('ac-question', JSON.stringify({ fields: fields, msg: msg })); } catch (e) { /* the form opens empty */ }
    location.href = 'contact.html';
  }

  /**
   * A checkout left unfinished (owner, November 10, round 15): once someone
   * has typed their name and a phone number or email at the top of the
   * checkout and leaves without booking, what they had picked goes to the
   * owner for one follow-up (netlify/functions/cart-capture.mjs). Only while
   * the privacy policy says so (checkoutFollowUp), and once per contact and
   * cart, however they leave.
   */
  /** A name, and a phone or email we could actually reach. */
  function canFollowUp() {
    var c = state.contact;
    var digits = String(c.phone || '').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
    var email = String(c.email || '').trim();
    return Boolean(String(c.name || '').trim()) && (/^[2-9]\d{9}$/.test(digits) || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email));
  }

  function captureUnfinished(reason) {
    try {
      // While Confirm is still sending, this is a booking, not an abandoned one.
      if (!P.isLive('checkoutFollowUp') || state.done || state.sending || state.noFollowUp || !onCheckout()) return;
      var c = state.contact;
      var digits = String(c.phone || '').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
      var email = String(c.email || '').trim();
      if (!canFollowUp()) return;
      var lines = draftSummary();
      var key = [c.name, digits, email, lines.join('|')].join('#');
      try { if (sessionStorage.getItem('ac-captured') === key) return; sessionStorage.setItem('ac-captured', key); } catch (e) { /* private mode: send anyway */ }
      var body = JSON.stringify({
        contact: { name: c.name, phone: c.phone, email: c.email },
        summary: lines.join('\n'), reason: reason, source: source(), heard: state.heard
      });
      var sent = navigator.sendBeacon && navigator.sendBeacon('/api/cart-capture', new Blob([body], { type: 'application/json' }));
      if (!sent) fetch('/api/cart-capture', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true }).catch(function () {});
      track('checkout_left', { reason: reason });
    } catch (e) { /* a follow-up must never get in the way of leaving */ }
  }

  /** Open or close a How it works: a <details> (packages) or a toggle and its panel (extras). */
  function toggleHow(det, btn) {
    var body = det ? det.querySelector('.bk-how-body') : root.querySelector('#' + btn.dataset.howfor);
    if (!body) return;
    var isOpen = det ? det.open : !body.hidden;
    var set = function (open) {
      if (det) det.open = open; else { body.hidden = !open; btn.setAttribute('aria-expanded', String(open)); }
    };
    if (reducedMotion() || !body.animate) return set(!isOpen);
    if (!isOpen) {
      set(true);
      var h = body.scrollHeight;
      body.animate([{ height: '0px', opacity: 0 }, { height: h + 'px', opacity: 1 }], { duration: 220, easing: 'cubic-bezier(.2,.7,.2,1)' });
    } else {
      var h2 = body.scrollHeight;
      var anim = body.animate([{ height: h2 + 'px', opacity: 1 }, { height: '0px', opacity: 0 }], { duration: 170, easing: 'ease-in' });
      anim.onfinish = function () { set(false); };
    }
  }

  function close() {
    if (!host) return;
    // Closing mid-send hid the Done screen that came back a moment later
    // (validation, November 11). Wait for it, but never trap anyone: after 20
    // seconds close works whatever the network is doing.
    if (state.sending && Date.now() - (state.sendingSince || 0) < 20000) return;
    if (!host.hidden) captureUnfinished('closed');
    // Answers given after booking still reach us if the screen just closes.
    if (state.done) sendPrep(true);
    state.leaving = false;
    renderLeave();
    host.hidden = true;
    document.body.classList.remove('bk-open');
    setPageInert(false);
    document.removeEventListener('keydown', trapTab);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function mount() {
    host = document.getElementById('bookFunnel');
    if (!host) return;
    // How it works opens and closes with a short height animation, from the
    // toggle the customer pressed (owner, November 10).
    host.addEventListener('click', function (e) {
      var sum = e.target.closest && e.target.closest('.bk-how > summary');
      var btn = !sum && e.target.closest && e.target.closest('.bk-howbtn');
      if (sum && sum.parentNode && sum.parentNode.querySelector && sum.parentNode.querySelector('.bk-how-body')) {
        e.preventDefault(); toggleHow(sum.parentNode, null);
      } else if (btn && btn.dataset && btn.dataset.howfor) { e.preventDefault(); toggleHow(null, btn); }
    });
    // A review row remembers it was opened (revRow).
    host.addEventListener('click', function (e) {
      var sum = e.target.closest && e.target.closest('[data-revrow] > summary');
      if (!sum) return;
      var d = sum.parentNode;
      state.revOpen = state.revOpen || {};
      state.revOpen[d.getAttribute('data-revrow')] = !d.open;
    });
    // Leaving the page from the checkout counts as leaving it unfinished.
    window.addEventListener('pagehide', function () {
      if (!host || host.hidden) return;
      captureUnfinished('left_page');
      // Answers typed on Done and never sent still reach us when the tab closes.
      if (state.done) sendPrep(true);
    });
    host.innerHTML = SHELL;
    root = host;

    host.addEventListener('click', function (e) {
      if (e.target.closest('#bkSteps')) {
        var b = root.querySelector('#bkStepsBody');
        b.hidden = !b.hidden;
        return;
      }
      if (e.target.closest('#bkDoneClose')) return close();
      if (e.target.closest('#bkCueBtn')) {
        var sc = el('bkScroll');
        return sc.scrollBy({ top: Math.round(sc.clientHeight * 0.7), behavior: 'smooth' });
      }
      var place = e.target.closest('[data-place]');
      if (place) {
        root.querySelector('#bkAc').hidden = true;
        fillFromPlace(place.dataset.place, place.textContent);
        return;
      }
      onClick(e);
    });
    // The contact step is a real <form> so autofill will offer the whole
    // card at once. It must never actually submit: Enter is already handled
    // above, and this catches everything else, including the Go key on a
    // phone keyboard.
    host.addEventListener('submit', function (e) {
      e.preventDefault();
      // Go on a phone keyboard submits the form. It has to mean what Enter
      // means: the next box if there is one, the next page if there is not.
      // Calling advance() straight off meant typing a name and pressing Go
      // produced "We need a phone number" in red, which reads as the form
      // arguing with somebody who was already doing the right thing.
      var here = document.activeElement;
      var inBody = el('bkBody');
      if (here && inBody && inBody.contains(here) && focusNext(here)) return;
      advance();
    });

    host.addEventListener('change', onChange);
    // After the handlers have updated the state.
    ['input', 'change', 'click'].forEach(function (type) {
      host.addEventListener(type, function () { setTimeout(function () { clearFixedErrors(); syncPressed(); }, 0); });
    });

    // Keep the "More below" cue honest as the page scrolls, grows (a panel
    // opening, times arriving) or the window changes size.
    el('bkScroll').addEventListener('scroll', updateCue, { passive: true });
    window.addEventListener('resize', updateCue);
    window.addEventListener('resize', function () { if (onCheckout()) fitCkCont(true); });
    if (window.ResizeObserver) new ResizeObserver(updateCue).observe(el('bkBody'));

    // Pointing at a start on the day timeline draws the whole job it would book.
    host.addEventListener('mouseover', function (e) {
      var t = e.target.closest && e.target.closest('.bk-tl [data-slot]');
      if (t && !tlPicking) previewTl(t);
    });
    host.addEventListener('mouseout', function (e) {
      var tl = e.target.closest && e.target.closest('.bk-tl');
      if (!tl || tlPicking || (e.relatedTarget && tl.contains(e.relatedTarget))) return;
      clearTlPreview(tl);
    });

    // Phone and ZIP are checked as they are left, with the same rules Continue
    // applies, so a typo is pointed out while the field is still in front of
    // them rather than after a round trip. Empty fields are left alone here;
    // Continue still asks for them.
    host.addEventListener('focusout', function (e) {
      var t = e.target;
      if (!t || !t.value || !t.value.trim()) return;
      if (t.id === 'bkPhone') {
        var digits = t.value.replace(/\D/g, '');
        if (digits.length === 11 && digits.charAt(0) === '1') digits = digits.slice(1);
        if (digits.length !== 10 || /^[01]/.test(digits)) {
          flash('That does not look like a US phone number. Ten digits, area code first.', t);
        }
      } else if (t.id === 'bkZip' && !/^\d{5}$/.test(t.value.trim())) {
        flash('A ZIP is 5 digits.', t);
      }
    });

    // The weekly calendar is a grid on wide screens and a day strip on
    // phones. Turning a tablet or resizing a window across that line redraws
    // it from what is already loaded.
    window.addEventListener('resize', function () {
      if (!host.hidden && paintedNarrow) pinWeek();
      if (host.hidden || state.done || !onCheckout() || !lastPaint || paintedNarrow === null) return;
      if (phoneView() !== paintedNarrow) repaintSlots();
    });
    host.addEventListener('input', onInput);
    // The in-section Continue's line and button (ckGoState): when a box is
    // left, a tick or a tap lands, or typing pauses. Never per keystroke.
    host.addEventListener('input', function () {
      clearTimeout(ckGoTimer);
      ckGoTimer = setTimeout(function () { if (onCheckout()) ckGoState(true); }, CKGO_PAUSE);
    });
    ['focusout', 'change', 'click'].forEach(function (type) {
      host.addEventListener(type, function () {
        setTimeout(function () { if (onCheckout()) ckGoState(true); }, 0);
      });
    });

    /**
      * Enter means "done with this, what is next".
      *
      * The funnel is not a <form>, so Enter did nothing at all: someone
      * filling in three address fields had to reach for the mouse between
      * each one and again to continue. Now it walks to the next field in the
      * step and, from the last one, does what Continue does.
      *
      * A textarea is left alone, because there Enter means a new line, and a
      * button is left alone, because the browser already clicks it.
      */
    host.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' || e.shiftKey) return;
      var t = e.target;
      if (!t || t.tagName === 'TEXTAREA' || t.tagName === 'BUTTON' || t.tagName === 'A') return;

      // The promo box applies the code rather than moving on. Someone who
      // just typed a code wants to see it land, not skip past it.
      if (t.dataset && t.dataset.promo !== undefined) {
        e.preventDefault();
        state.promoCode = P.normalisePromo(t.value);
        return render();
      }

      if (t.tagName !== 'INPUT' || t.type === 'checkbox' || t.type === 'radio') return;
      e.preventDefault();

      // Next box if there is one, next page if there is not. Checking
      // step().valid() FIRST was backwards: a half-filled step is exactly
      // when somebody wants the next field, and instead they got a
      // validation error scrolled to the middle of the screen.
      if (focusNext(t)) return;
      // On the checkout, the last box of a section continues that section.
      if (onCheckout() && ckOpenId() !== 'review') return ckAdvance(ckOpenId());
      advance();
    });

    /**
      * Opening a panel should reveal the panel.
      *
      * Only scrolls when it has to. A "How it works" near the top of the
      * screen opens into space the reader can already see, and yanking the
      * page for it would be worse than doing nothing. One that opens below
      * the fold gets moved up just far enough to read.
      */
    host.addEventListener('toggle', function (e) {
      var d = e.target;
      if (!d || d.tagName !== 'DETAILS' || !d.open) return;
      var scroller = el('bkScroll');
      if (!scroller) return;
      var box = d.getBoundingClientRect();
      var view = scroller.getBoundingClientRect();
      // Already fully visible: leave the page exactly where it is.
      if (box.bottom <= view.bottom && box.top >= view.top) return;
      var summary = d.querySelector('summary') || d;
      summary.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, true);

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' || host.hidden) return;
      // Escape backs out of the leaving panel before it backs out of the
      // booking, so the key that means "undo" never destroys anything.
      if (state.leaving) { state.leaving = false; return renderLeave(); }
      requestClose();
    });

    // Any Book Now link opens the funnel in place rather than navigating.
    document.querySelectorAll('a[href="book.html"], a[href="./book.html"], [data-book-browse], [data-book-interest]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        open();

        // "View Services" lands on the full catalogue rather than step one.
        if (a.hasAttribute('data-book-browse')) {
          state.step = 1;
          state.browse = true;
          return render();
        }

        // "Book Basic Exterior" and friends: treat it exactly as if they had
        // picked that package inside the funnel, so the next thing asked is
        // the size question rather than a category they already chose.
        // "Register interest" from the services grid: open the funnel with
        // that box already ticked, so they land on the picker able to carry
        // on and book something they CAN have.
        var wanted = a.getAttribute('data-book-interest');
        if (wanted) {
          if (state.interest.indexOf(wanted) < 0) state.interest.push(wanted);
          var wv = veh();
          var wp = P.findPackage(wanted);
          if (wp) wv.intent = wp.category;
          return go(wv.size ? 2 : 0);
        }

        var id = a.getAttribute('data-book-package');
        var picked = id ? P.findPackage(id) : null;
        if (picked) {
          var v = veh();
          v.intent = picked.category;
          v.packageIds = [picked.id];
          v.addons = [];
          return go(0);
        }
      });
    });

    // A shared quote link. Fragment, not query, so a customer's name and
    // address never reach a server log on the way in.
    var frag = /[#&]q=([A-Za-z0-9_-]+)/.exec(location.hash || '');
    if (frag) {
      var decoded = P.decodeQuote(frag[1]);
      open();
      if (decoded.ok) {
        applyQuote(decoded.payload);
        // Straight to the confirm step: they were sent a finished quote, not
        // an invitation to fill in a form.
        state.step = STEPS.length - 1;
        render();
      } else {
        el('bkBody').innerHTML = '<div class="bk-noslots"><b>This link has expired</b><span>' +
          esc(decoded.reason || 'Ask us to send a fresh one.') +
          '</span></div><p class="bk-pref-call">Text or call ' +
          '<a href="sms:+15132792915">(513) 279-2915</a> and we will send another.</p>';
      }
      return;
    }

    if (location.hash === '#book') open();
  }

  window.ACFunnel = { open: open, close: close };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();

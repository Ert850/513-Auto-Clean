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
      locationNote: '',
      priority: false,
      preferredWindows: [],
      slot: null,
      daysShown: 3,
      contact: { name: '', phone: '', email: '' },
      consent: { terms: null, sms: null, media: null },
      payInFull: false,
      notes: '',
      sending: false,
      done: false,
      browse: false,
      browseQ: '',
      browseMax: null,
      browseFilters: {},
      browseSort: 'price',
      openBucket: null,
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
    { id: 'package',  tab: 'Package',  title: 'Choose your package',       auto: true,  render: rPackage, valid: vPackage, sum: sPackage },
    { id: 'addons',   tab: 'Extras',   title: 'Anything extra?',           auto: false, render: rAddons,  valid: vAddons,  sum: sAddons },
    { id: 'location', tab: 'Where',    title: 'Where are we detailing?',   auto: false, render: rLoc,     valid: vLoc,     sum: sLoc },
    { id: 'more',     tab: 'Vehicles', title: 'Add another vehicle?',      auto: false, render: rMore,    valid: ok,       sum: sMore },
    { id: 'time',     tab: 'Time',     title: 'Pick your time',            auto: true,  render: rTime,    valid: vTime,    sum: sTime },
    { id: 'contact',  tab: 'You',      title: 'How do we reach you?',      auto: false, render: rContact, valid: vContact, sum: sContact },
    { id: 'pay',      tab: 'Confirm',  title: 'Confirm your booking',      auto: false, render: rPay,     valid: vPay,     sum: sPay }
  ];

  /* Short summaries under each tab, so someone can see at a glance what they
     already answered and jump straight back to it. */
  function sSize() { var z = veh().size ? P.vehicleSize(veh().size) : null; return z ? z.label : ''; }
  function sIntent() { var i = veh().intent; return i === 'both' ? 'Inside and out' : i ? i.charAt(0).toUpperCase() + i.slice(1) : ''; }
  function sPackage() {
    var names = veh().packageIds.map(function (id) { return (P.findPackage(id) || {}).name; }).filter(Boolean);
    return names.join(' + ');
  }
  function sAddons() {
    var n = state.vehicles.reduce(function (t, v) { return t + v.addons.length; }, 0);
    return n ? n + ' added' : 'None';
  }
  function sLoc() { return state.address.city || state.address.zip || ''; }
  function sMore() { var n = state.vehicles.length; return n > 1 ? n + ' vehicles' : '1 vehicle'; }
  function sTime() {
    return state.slot
      ? new Date(state.slot).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ', ' +
        new Date(state.slot).toLocaleTimeString('en-US', { hour: 'numeric' })
      : '';
  }
  function sContact() { return state.contact.name ? state.contact.name.split(' ')[0] : ''; }
  function sPay() { return $(q().totalCents); }

  function ok() { return null; }
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
      oneWayMinutes: state.address.zip ? P.estimateOneWayMinutes(state.address.zip) : null,
      surchargeContext: surchargeCtx(),
      zip: state.address.zip || null,
      payInFull: state.payInFull,
      visits: state.separateTimes ? state.vehicles.length : 1
    };
  }

  function surchargeCtx() {
    if (state.slot) {
      return {
        startMinutesLocal: P.localMinutesOfDay(state.slot),
        priorityBooking: state.priority
      };
    }
    if (state.priority) {
      return { startMinutesLocal: P.minutesOfDay(12), priorityBooking: true };
    }
    return null;
  }

  function q() { return P.quote(cart(), RULES); }

  /** Showroom is priced from a floor, so its card has to say so. */
  function pkgPrice(p) { return $(p.priceCents) + (p.pricePlus ? '+' : ''); }

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

  function renderNav() {
    var reach = Math.max(state.step, furthestValid());
    el('bkNav').innerHTML = STEPS.map(function (st, i) {
      var done = i < reach && !st.valid();
      var here = i === state.step;
      var open = i <= reach;
      var sum = st.sum ? st.sum() : '';
      return '<button type="button" class="bk-seg' +
        (here ? ' now' : '') + (done ? ' done' : '') + (open ? '' : ' locked') +
        '" data-step="' + i + '"' + (open ? '' : ' disabled') +
        (here ? ' aria-current="step"' : '') + '>' +
        '<span class="bk-seg-t">' + esc(st.tab) + '</span>' +
        (sum ? '<span class="bk-seg-s">' + esc(sum) + '</span>' : '') +
        '</button>';
    }).join('');
    // Keep the active segment in view on a narrow screen.
    var now = el('bkNav').querySelector('.now');
    if (now && now.scrollIntoView) now.scrollIntoView({ block: 'nearest', inline: 'center' });
  }

  function render() {
    if (state.done) return;
    var s = step();
    var pct = Math.round(((state.step + 1) / STEPS.length) * 100);

    el('bkBar').style.width = pct + '%';
    el('bkProgress').setAttribute('aria-valuenow', String(pct));
    el('bkTitle').textContent = s.title;
    renderNav();
    el('bkBody').innerHTML = s.render();

    var back = el('bkBack');
    back.hidden = state.step === 0;

    var next = el('bkNext');
    next.hidden = s.auto;
    next.querySelector('span').textContent =
      s.id === 'pay' ? (state.payInFull ? 'Pay and confirm' : 'Confirm booking') : 'Continue';

    renderTotal();
    var focusable = el('bkBody').querySelector('[data-focus]');
    if (focusable) focusable.focus();
    el('bkBody').scrollTop = 0;
    el('bkScroll').scrollTop = 0;
  }

  function renderTotal() {
    var quote = q();
    var box = el('bkTotal');
    if (!quote.lines.length) { box.hidden = true; return; }
    box.hidden = false;
    box.querySelector('.bk-total-amt').textContent = $(quote.totalCents);
    var dur = quote.serviceDurationMin;
    var sub = box.querySelector('.bk-total-sub');
    if (quote.multiVehicleDiscountCents > 0) {
      // Lead with the saving, not the duration: this is the moment the second
      // vehicle has to look like a good idea.
      // Quote the visible gap, not the pre-tax discount, so the two numbers
      // on screen actually subtract to the figure beside them.
      sub.innerHTML = '<s>' + $(quote.grossBeforeMultiCents) + '</s> saving ' +
        $(quote.grossBeforeMultiCents - quote.totalCents);
    } else {
      sub.textContent = dur ? 'about ' + fmtDur(dur) + ' on site' : '';
    }
  }

  function fmtDur(min) {
    if (!min) return '';
    var h = Math.floor(min / 60), m = min % 60;
    return (h ? h + ' hr' + (h > 1 ? 's' : '') : '') + (m ? (h ? ' ' : '') + m + ' min' : '');
  }

  function flash(msg) {
    var old = el('bkBody').querySelector('.bk-err');
    if (old) old.remove();
    var p = document.createElement('p');
    p.className = 'bk-err';
    p.setAttribute('role', 'alert');
    p.textContent = msg;
    el('bkBody').appendChild(p);
    p.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function go(n) {
    var target = Math.max(0, Math.min(STEPS.length - 1, n));
    state.step = target;
    render();
  }

  function advance() {
    var err = step().valid();
    if (err) { flash(err); return; }
    if (state.step === STEPS.length - 1) { submit(); return; }

    // Skip past anything already answered, which is what happens when someone
    // picked a package from View Services and only needed the size question.
    var i = state.step + 1;
    while (i < STEPS.length - 1 && !STEPS[i].valid() && STEPS[i].auto) i++;
    go(i);
  }

  /* ================= step 1: size ================= */

  function rSize() {
    var v = veh();
    return '<p class="bk-sub">Bigger vehicles take longer, so the price moves a little.</p>' +
      '<div class="bk-cards">' +
      P.VEHICLE_SIZES.map(function (s) {
        return '<button type="button" class="bk-card' + (v.size === s.id ? ' on' : '') + '" data-size="' + s.id + '">' +
          '<b>' + esc(s.label) + '</b>' +
          '<span>' + esc(s.examples) + '</span>' +
          '<i>' + (s.upchargeCents ? '+' + $(s.upchargeCents) : 'No extra charge') + '</i>' +
          '</button>';
      }).join('') + '</div>';
  }
  function vSize() { return veh().size ? null : 'Pick a vehicle size to continue.'; }

  /* ================= step 2: intent ================= */

  function rIntent() {
    var v = veh();
    var opts = [
      ['interior', 'Interior', 'Seats, carpets, glass, trim'],
      ['exterior', 'Exterior', 'Wash, wheels, paint, protection'],
      ['both', 'Both', 'Inside and out, and you save ' + $(RULES.comboDiscountCents)]
    ];
    if (state.browse) return rBrowse();

    return '<p class="bk-sub">We will only show packages that fit.</p><div class="bk-cards">' +
      opts.map(function (o) {
        return '<button type="button" class="bk-card' + (v.intent === o[0] ? ' on' : '') + '" data-intent="' + o[0] + '">' +
          '<b>' + o[1] + '</b><span>' + o[2] + '</span></button>';
      }).join('') + '</div>' +
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
            ? '<b class="bk-soon">Soon</b><i>' + esc(i.unavailable) + '</i>'
            : '<b>' + $(i.priceCents) + (i.pricePlus ? '+' : '') + '</b>' + (dur ? '<i>' + dur + '</i>' : '')) +
          '</span>' +
          '</button>' +
          (i.note
            ? '<details class="bk-how bk-how-pkg"><summary>How it works</summary><p>' + esc(i.note) + '</p></details>'
            : '');
      });
      html += '</div>';
    }

    html += '<button type="button" class="bk-morelink" id="bkBrowseBack">Back to the quick picker</button>';
    return html;
  }
  function vIntent() { return veh().intent ? null : 'Pick interior, exterior, or both.'; }

  /* ================= step 3: package ================= */

  function rPackage() {
    var v = veh();
    var cats = v.intent === 'both' ? ['interior', 'exterior'] : [v.intent];
    var html = '';

    cats.forEach(function (cat) {
      if (v.intent === 'both') {
        html += '<h3 class="bk-grp">' + (cat === 'interior' ? 'Interior' : 'Exterior') + '</h3>';
      }
      html += '<div class="bk-pkgs">';
      P.packagesFor(cat).forEach(function (p) {
        // Maintenance is returning-customer pricing, so it is not offered to
        // someone booking for the first time through the public funnel.
        if (p.requiresPriorDetail) return;

        var on = v.packageIds.indexOf(p.id) > -1;
        var comps = P.componentsOf(p, P.CATALOG).map(function (c) { return esc(c.name); });
        var dur = pkgDuration(p);

        html += '<button type="button" class="bk-pkg' + (on ? ' on' : '') + '" data-pkg="' + p.id + '" data-cat="' + cat + '">' +
          '<span class="bk-pkg-l">' +
            '<b>' + esc(p.name) + '</b>' +
            (p.featured ? '<i class="bk-flag">Most popular</i>' : '') +
            '<span class="bk-pkg-tag">' + esc(p.tagline) + '</span>' +
            '<span class="bk-pkg-feat">' +
              (p.supersetOf
                ? '<em>Everything in ' + esc((P.findPackage(p.supersetOf) || {}).name || '') + '</em>, plus ' +
                  comps.slice(P.componentsOf(P.findPackage(p.supersetOf), P.CATALOG).length).join(', ')
                : comps.join(', ')) +
            '</span>' +
          '</span>' +
          '<span class="bk-pkg-r"><b>' + pkgPrice(p) + '</b><i>' + dur + '</i></span>' +
          '</button>' +
          // Outside the button, so opening it does not also select the package.
          (p.note
            ? '<details class="bk-how bk-how-pkg"><summary>How it works</summary><p>' + esc(p.note) + '</p></details>'
            : '');
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
        '<span class="bk-pkg-r"><b>+' + $(t.addCents) + '</b><i>' + fmtDur(t.addMin) + '</i></span>' +
        '</button>';
    }).join('');

    if (v.correctionTier) {
      html += '<h3 class="bk-grp">Coating length</h3><div class="bk-tiers multi">' +
        P.COATING_TERMS.map(function (c) {
          return '<button type="button" class="bk-tier' + (v.coatingTerm === c.id ? ' on' : '') +
            '" data-coating="' + c.id + '">' +
            '<span class="bk-tier-l">' + esc(c.label) + (c.asterisk ? '*' : '') + '</span>' +
            '<span class="bk-tier-p">' + (c.addCents ? '+' + $(c.addCents) : 'included') + '</span>' +
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
    if (!v.packageIds.length) return 'Choose a package to continue.';
    if (needsCorrection(v) && !v.correctionTier) return 'Pick a correction level to continue.';
    if (v.intent === 'both') {
      var cats = v.packageIds.map(function (id) { return P.findPackage(id).category; });
      if (cats.indexOf('interior') < 0) return 'Pick an interior package too.';
      if (cats.indexOf('exterior') < 0) return 'Pick an exterior package too.';
    }
    return null;
  }

  /* ================= step 4: add-ons ================= */

  function rAddons() {
    var v = veh();
    var scopes = v.intent === 'both' ? ['interior', 'exterior'] : [v.intent];
    var ctx = { packageIds: v.packageIds, addonTiers: v.addons.map(function (a) { return { addonId: a.addonId, tierId: a.tierId }; }) };
    var html = '<p class="bk-sub">Optional. Skip any you do not need.</p>';

    scopes.forEach(function (scope) {
      // Everything is LISTED, including what cannot be booked yet: hiding a
      // service also hides the fact that we offer it.
      var list = P.addonsFor(scope);
      if (!list.length) return;
      if (scopes.length > 1) html += '<h3 class="bk-grp">' + (scope === 'interior' ? 'Interior' : 'Exterior') + '</h3>';

      list.forEach(function (a) {
        var unavailable = P.unavailableReason(a);
        var blocked = unavailable ? null : P.addonBlockedReason(a, ctx);
        var chosen = v.addons.filter(function (x) { return x.addonId === a.id; })[0];
        var multi = a.tiers.length > 1;

        html += '<div class="bk-addon' + (chosen ? ' on' : '') +
          (blocked || unavailable ? ' off' : '') + '">' +
          '<div class="bk-addon-h"><b>' + esc(a.name) +
          (unavailable ? '<sup class="bk-star">*</sup>' : '') + '</b>' +
          (chosen ? '<button type="button" class="bk-clear" data-clear="' + a.id + '">Remove</button>' : '') +
          '</div>' +
          '<p class="bk-addon-d">' + esc(a.description) + '</p>' +
          (a.note
            ? '<details class="bk-how"><summary>How it works</summary><p>' + esc(a.note) + '</p></details>'
            : '');

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
          html += '<p class="bk-addon-block">*' + esc(unavailable) + '</p>';
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
              '<span class="bk-tier-p">' + $(t.priceCents) + (t.asterisk ? '*' : '') + '</span>' +
              '</button>';
          });
          html += '</div>';
          var ast = a.tiers.filter(function (t) { return t.asterisk; })[0];
          if (ast) html += '<p class="bk-ast">*' + esc(ast.asterisk) + '</p>';
        }
        html += '</div>';
      });
    });
    return html;
  }
  function vAddons() { return null; }

  /* ================= step 5: location ================= */

  var STATES = ['OH', 'KY', 'IN'];

  function rLoc() {
    var a = state.address;
    return '<p class="bk-sub">We come to you. Travel is worked out from your address, and the first 10 minutes of drive time are free.</p>' +
      '<div class="bk-field"><label for="bkL1">Street address</label>' +
      '<input type="text" id="bkL1" data-addr="line1" value="' + esc(a.line1) + '" placeholder="Start typing your address" autocomplete="address-line1" data-focus />' +
      '<div class="bk-ac" id="bkAc" hidden></div></div>' +
      '<div class="bk-row3">' +
        '<div class="bk-field"><label for="bkCity">City</label>' +
        '<input type="text" id="bkCity" data-addr="city" value="' + esc(a.city) + '" autocomplete="address-level2" /></div>' +
        '<div class="bk-field"><label for="bkState">State</label>' +
        '<select id="bkState" data-addr="region">' +
        STATES.map(function (s) {
          return '<option value="' + s + '"' + (a.region === s ? ' selected' : '') + '>' + s + '</option>';
        }).join('') + '</select></div>' +
        '<div class="bk-field"><label for="bkZip">ZIP</label>' +
        '<input type="text" id="bkZip" data-addr="zip" value="' + esc(a.zip) + '" inputmode="numeric" maxlength="5" autocomplete="postal-code" /></div>' +
      '</div>' +
      '<label class="bk-check"><input type="checkbox" id="bkNoLoc"' + (state.noGoodLocation ? ' checked' : '') + ' />' +
      '<span>I do not have a good location for a detail near me</span></label>' +
      (state.noGoodLocation
        ? '<div class="bk-panel"><p>No problem, this is usually easy to solve. Local spots like retail parking lots often work well, especially for interior details. Tell us roughly where you are and we will sort somewhere out with you. If we cannot find somewhere near you, we can work out a location closer to us as well.</p>' +
          '<textarea data-note="loc" rows="3" placeholder="e.g. I live in an apartment with no driveway, but there is a big lot behind the Kroger on Ludlow">' + esc(state.locationNote) + '</textarea></div>'
        : '') +
      travelLine();
  }

  /** Live travel figure, shown as soon as the ZIP is complete. */
  function travelLine() {
    var hit = state.address.zip ? P.lookupZip(state.address.zip) : null;
    if (!hit) {
      return '<p class="bk-hint bk-travel-slot">Add your ZIP and the travel fee appears here. ' +
        'The first 10 minutes of drive time are free.</p>';
    }
    var mins = P.estimateOneWayMinutes(state.address.zip);
    var fee = P.mileageFeeCents(mins, RULES.mileage);
    if (fee === 0) {
      return '<div class="bk-travel free bk-travel-slot"><b>No travel fee</b>' +
        '<span>' + esc(hit.area) + ' is inside our free radius.</span></div>';
    }
    return '<div class="bk-travel bk-travel-slot"><b>' + $(fee) + ' travel</b>' +
      '<span>' + esc(hit.area) + ', about ' + mins + ' minutes each way, already in your total. ' +
      'We confirm it from your exact address and it can move a little either way.</span></div>';
  }

  function vLoc() {
    var a = state.address;
    if (!a.line1.trim()) return 'We need a street address.';
    if (!a.city.trim()) return 'We need a city.';
    if (!/^\d{5}$/.test(a.zip.trim())) return 'We need a 5 digit ZIP so we can work out tax and travel.';
    return null;
  }

  /* ================= step 6: second vehicle upsell ================= */

  function rMore() {
    var pct = RULES.additionalVehicleDiscountBp / 100;
    var list = state.vehicles.map(function (v, i) {
      var names = v.packageIds.map(function (id) { return (P.findPackage(id) || {}).name; }).filter(Boolean);
      var size = v.size ? P.vehicleSize(v.size) : null;
      return '<div class="bk-veh">' +
        '<div><b>Vehicle ' + (i + 1) + (size ? ', ' + esc(size.label) : '') + '</b>' +
        '<span>' + esc(names.join(' + ') || 'nothing selected') + '</span></div>' +
        (state.vehicles.length > 1
          ? '<button type="button" class="bk-clear" data-delveh="' + i + '">Remove</button>'
          : '') +
        '</div>';
    }).join('');

    var now = q();
    var head;
    if (state.vehicles.length > 1) {
      head = '<div class="bk-upsell saving"><b>' + pct + '% off everything, saving ' +
        $(now.grossBeforeMultiCents - now.totalCents) + '</b>' +
        '<span>The discount came off your first vehicle too, not just the second.</span></div>';
    } else {
      // Show the actual number they would save, not just the percentage.
      var withTwo = P.quote(
        Object.assign({}, cart(), { vehicles: cart().vehicles.concat(cart().vehicles) }),
        RULES
      );
      head = '<div class="bk-upsell"><b>Add a second vehicle and take ' + pct + '% off both</b>' +
        '<span>The discount applies to what you have already picked, not just the new one. ' +
        'On a second vehicle like this one that is ' +
        $(withTwo.grossBeforeMultiCents - withTwo.totalCents) +
        ' off, and we only drive out once.</span></div>';
    }
    return head +
      '<div class="bk-vehs">' + list + '</div>' +
      '<button type="button" class="bk-addveh" id="bkAddVeh">Add another vehicle</button>' +
      '<div class="bk-field" style="margin-top:1.2rem"><label for="bkLabel">What are we detailing? <i>(optional)</i></label>' +
      '<input type="text" id="bkLabel" data-label="' + state.active + '" value="' + esc(veh().label) + '" placeholder="e.g. 2018 Honda CR-V" /></div>';
  }

  /* ================= step 7: time ================= */

  function rTime() {
    var earliest = P.earliestBookableDate(startOfToday(), RULES.window);
    var html = '<p class="bk-sub">Pick a time that works. Nothing is charged until the next step.</p>';

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

    html += hasCorrection() ? '' :
      '<label class="bk-check bk-prio' + (state.priority ? ' on' : '') + '">' +
      '<input type="checkbox" id="bkPrio"' + (state.priority ? ' checked' : '') + ' />' +
      '<span><b>I need it within the next 3 days</b>' +
      '<i>Opens our soonest slots.</i></span></label>';

    if (hasCorrection()) {
      var lead = new Date(startOfToday().getTime() + P.CORRECTION_RULES.minLeadDays * DAY);
      html += '<p class="bk-note">Correction work starts on a weekend morning from <b>' +
        lead.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) +
        '</b>. This reserves the first day.</p>';
    } else if (!state.priority) {
      html += '<p class="bk-note">Standard bookings start from <b>' +
        earliest.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) + '</b>.</p>';
    }

    html += '<div class="bk-slots" id="bkSlots"><p class="bk-loading">Checking the calendar...</p></div>';
    setTimeout(loadSlots, 0);
    return html;
  }

  function startOfToday() {
    var d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function loadSlots() {
    var box = root.querySelector('#bkSlots');
    if (!box) return;

    var corr = hasCorrection();
    var CR = P.CORRECTION_RULES;

    var from = state.priority
      ? Date.now()
      : P.earliestBookableDate(startOfToday(), RULES.window).getTime();
    if (corr && CR.minLeadDays > 0) {
      var lead = startOfToday().getTime() + CR.minLeadDays * DAY;
      if (lead > from) from = lead;
    }
    var to = from + (corr ? 70 : 28) * DAY;

    // Correction runs across days, so only the first is reserved. Booking the
    // full 30 hours as one block would swallow a fortnight of availability.
    var dur = corr ? CR.firstDayMin : totalDurationMin();

    var cfg = { calendarId: CFG.googleCalendarId, apiKey: CFG.googleApiKey };
    var load = P.calendarConfigured(cfg)
      ? P.loadWindow(cfg, from, to)
      : Promise.resolve(P.unconfiguredWindow(from, to));

    load.then(function (win) { paintSlots(box, win, from, to, dur); })
      .catch(function (err) {
        // A calendar outage must not block a booking: fall back to business
        // hours and say plainly that the time still needs confirming.
        paintSlots(box, P.unconfiguredWindow(from, to), from, to, dur, String(err && err.message || err));
      });
  }

  function paintSlots(box, win, from, to, dur, errMsg) {
    // Flat 30 minute travel allowance until a Maps key gives us real drive
    // time. Deliberately generous so a slot we offer is one we can keep.
    var req = {
      openBlocks: win.open,
      busy: win.busy,
      serviceDurationMin: dur,
      travelBeforeMin: 30,
      travelAfterMin: 30,
      granularityMin: 30,
      notBefore: from,
      notAfter: to,
      // A 6pm or later job is the last of the day, so the drive home does not
      // need to fit inside the calendar and should not shorten what is offered.
      ignoreReturnAfterMin: P.IGNORE_RETURN_AFTER_MIN
    };
    if (corr) {
      req.preferredStartsMin = { weekday: CR.allowedStartsMin, weekend: CR.allowedStartsMin };
      req.allowedWeekdays = [0, 6];
    }
    // Only the six canonical times, ever. Extending the search means more
    // DAYS at these same times, never filling in the gaps between them.
    var slots = P.computeSlots(
      corr ? req : Object.assign({}, req, { preferredStartsMin: P.PREFERRED_STARTS })
    );

    var primary = slots;

    if (!primary.length) {
      box.innerHTML = '<p class="bk-empty">Nothing open in that range for a ' + fmtDur(dur) +
        ' job. Try another time of day, or <a href="index.html#inquiry">send us a question</a> and we will find something.</p>';
      return;
    }

    var html = '';
    if (win.mode === 'unconfigured') {
      // TEMPORARY. Delete this branch once the calendar key is live: with a
      // real feed these are genuine openings and need no caveat.
      html += '<p class="bk-warn">We could not reach our calendar just now, so these are our standard times. ' +
        'Pick whichever suits and we will confirm it, usually within a few hours. ' +
        'Occasionally a time needs adjusting, and we will text you if so.</p>';
    }

    var byDay = {};
    primary.forEach(function (ms) {
      var k = new Date(ms).toDateString();
      (byDay[k] = byDay[k] || []).push(ms);
    });

    var days = Object.keys(byDay);
    var shown = state.daysShown || 3;

    html += '<div class="bk-days">';
    days.slice(0, shown).forEach(function (k, di) {
      var d = new Date(k);
      var all = byDay[k];
      // Standard-price times lead. The premium ones sit inside an Earlier and
      // a Later bucket, so the default view is the two times most people want
      // without hiding the others.
      var early = all.filter(function (ms) { return P.localMinutesOfDay(ms) < 10 * 60; });
      var mid = all.filter(function (ms) {
        var m = P.localMinutesOfDay(ms);
        return m >= 10 * 60 && m < 18 * 60;
      });
      var late = all.filter(function (ms) { return P.localMinutesOfDay(ms) >= 18 * 60; });

      html += '<div class="bk-day"><h4>' +
        d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) + '</h4>';

      if (early.length) html += bucket('early-' + di, 'Earlier', early);
      if (mid.length) html += '<div class="bk-times">' + mid.map(slotButton).join('') + '</div>';
      if (late.length) html += bucket('late-' + di, 'Later', late);
      if (!mid.length && !early.length && !late.length) html += '<p class="bk-empty">Nothing open.</p>';
      html += '</div>';
    });
    html += '</div>';

    if (days.length > shown) {
      html += '<button type="button" class="bk-morelink" id="bkMoreDays">Show more options</button>';
    }
    box.innerHTML = html;
  }

  /**
   * One slot. Shows the price effect on the slot itself rather than
   * explaining the rules anywhere: a customer only needs to know what THIS
   * choice costs. Sooner slots are never framed as a penalty, they just
   * carry a number like any other option.
   */
  function slotButton(ms) {
    var t = new Date(ms);
    var label = t.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    var end = new Date(ms + 60 * 60000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

    var bp = P.computeSurcharge(
      { startMinutesLocal: P.localMinutesOfDay(ms), priorityBooking: state.priority },
      RULES.surcharge
    ).appliedBp;

    // The actual dollar difference, not a percentage to work out.
    var delta = deltaFor(ms);
    var tone = bp === 0 ? 'std' : (bp >= 3000 ? 'hi' : 'mid');

    return '<button type="button" class="bk-time ' + tone + (state.slot === ms ? ' on' : '') +
      '" data-slot="' + ms + '">' +
      '<span class="bk-t">' + label + '</span>' +
      (delta > 0 ? '<em>+' + $(delta) + '</em>' : '<em class="inc">included</em>') +
      '<i>arrive ' + label + ' to ' + end + '</i></button>';
  }

  /**
   * Earlier and Later collapse into one tappable row showing the cheapest
   * price change inside them, so the premium is visible before expanding and
   * the row never reads as a warning.
   */
  function bucket(key, label, list) {
    var open = state.openBucket === key || list.indexOf(state.slot) > -1;
    var cheapest = Math.min.apply(null, list.map(deltaFor));
    return '<div class="bk-bucket' + (open ? ' open' : '') + '">' +
      '<button type="button" class="bk-bucket-h" data-bucket="' + key + '">' +
        '<span>' + label + '</span>' +
        '<em>' + (cheapest > 0 ? 'from +' + $(cheapest) : 'included') + '</em>' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M6 9l6 6 6-6"/></svg>' +
      '</button>' +
      (open ? '<div class="bk-times">' + list.map(slotButton).join('') + '</div>' : '') +
      '</div>';
  }

  /** Dollar difference this start time makes to the service subtotal. */
  function deltaFor(ms) {
    var bp = P.computeSurcharge(
      { startMinutesLocal: P.localMinutesOfDay(ms), priorityBooking: state.priority },
      RULES.surcharge
    ).appliedBp;
    return Math.round((q().serviceSubtotalCents * bp) / 10000);
  }

  function vTime() { return state.slot ? null : 'Pick a time to continue.'; }

  /* ================= step 8: contact ================= */

  function yesNo(name, label, help, link) {
    var v = state.consent[name];
    return '<div class="bk-consent' + (v === null ? '' : ' answered') + '">' +
      '<p class="bk-consent-q">' + label + (link || '') + '</p>' +
      (help ? '<p class="bk-consent-h">' + help + '</p>' : '') +
      '<div class="bk-yn">' +
      '<button type="button" class="bk-yn-b' + (v === true ? ' yes' : '') + '" data-consent="' + name + '" data-val="1">Yes</button>' +
      '<button type="button" class="bk-yn-b' + (v === false ? ' no' : '') + '" data-consent="' + name + '" data-val="0">No</button>' +
      '</div></div>';
  }

  function rContact() {
    var c = state.contact;
    return '<div class="bk-row2">' +
      '<div class="bk-field"><label for="bkName">Name</label>' +
      '<input type="text" id="bkName" data-c="name" value="' + esc(c.name) + '" autocomplete="name" data-focus /></div>' +
      '<div class="bk-field"><label for="bkPhone">Phone</label>' +
      '<input type="tel" id="bkPhone" data-c="phone" value="' + esc(c.phone) + '" inputmode="tel" autocomplete="tel" /></div>' +
      '</div>' +
      '<div class="bk-field"><label for="bkEmail">Email</label>' +
      '<input type="email" id="bkEmail" data-c="email" value="' + esc(c.email) + '" inputmode="email" autocomplete="email" /></div>' +

      yesNo('terms',
        'Do you accept our terms and privacy policy?',
        'Includes our cancellation policy, and that the price may be adjusted on arrival if the vehicle is in a different condition than the package covers.',
        ' <a href="privacy.html" target="_blank" rel="noopener">Read them</a>') +

      yesNo('sms',
        'Can we text you about this booking?',
        'Confirmations, reminders, and a heads up when we are on the way. Msg and data rates may apply, reply STOP to opt out. You can say no and we will email or call instead.') +

      yesNo('media',
        'Can we film and photograph the detail?',
        'We record the whole detail, edit it into short clips, and use it for social media and marketing. It is how we reach more customers like you and keep our prices competitive. We always blur children, license plates, and any private information. ' +
        '<a href="https://www.instagram.com/513autoclean/" target="_blank" rel="noopener">See the kind of thing we post</a>') +

      '<div class="bk-field"><label for="bkNotes">Describe the vehicle&rsquo;s condition, parking situation, etc. <i>(optional)</i></label>' +
      '<textarea id="bkNotes" data-note="general" rows="3" placeholder="Pet hair, spills, a tight parking spot, anything we should expect">' + esc(state.notes) + '</textarea>' +
      '<p class="bk-hint">We will ask about water and power access once your time is confirmed.</p></div>';
  }

  function vContact() {
    if (!state.contact.name.trim()) return 'We need your name.';
    if (!state.contact.phone.trim()) return 'We need a phone number to confirm your booking.';
    if (state.consent.terms === null) return 'Please answer yes or no on the terms.';
    if (state.consent.terms === false) return 'We cannot take a booking without accepting the terms. You can still send us a question instead.';
    if (state.consent.sms === null) return 'Please answer yes or no on text messages.';
    if (state.consent.media === null) return 'Please answer yes or no on filming.';
    return null;
  }

  /* ================= step 9: pay ================= */

  function rPay() {
    var quote = q();
    var now = state.payInFull;

    var html = '<div class="bk-review">' + lineTable(quote) + '</div>';

    html += '<div class="bk-payopts">' +
      '<button type="button" class="bk-pay' + (!now ? ' on' : '') + '" data-pay="later">' +
        '<b>Pay after the detail</b>' +
        '<span>Settle up once the work is finished. We may still need a card on file in case of cancellations or payment issues.</span>' +
        '<i>' + $(quote.totalCents) + '</i>' +
      '</button>' +
      '<button type="button" class="bk-pay' + (now ? ' on' : '') + '" data-pay="now">' +
        '<b>Pay now and save ' + RULES.payInFullDiscountBp / 100 + '%</b>' +
        '<span>Settle the whole thing today.</span>' +
        '<i>' + $(now ? quote.totalCents : quote.totalCents - quote.payInFullSavingsCents) + '</i>' +
      '</button>' +
      '</div>';

    html += '<div class="bk-cardbox">' +
      '<h4>' + (now ? 'How would you like to pay?' : 'Card on file') + '</h4>' +
      '<p class="bk-hint">' +
        (now
          ? 'Card, Apple Pay, Google Pay, bank transfer, PayPal or Venmo.'
          : 'Nothing is charged now. Your card holds the time slot and covers a late cancellation.') +
      '</p>';

    if (now) {
      html += '<div class="bk-methods">' +
        '<button type="button" class="bk-method' + (state.payMethod === 'card' ? ' on' : '') + '" data-paymethod="card">' +
          'Card, Apple Pay, bank</button>' +
        '<button type="button" class="bk-method' + (state.payMethod === 'paypal' ? ' on' : '') + '" data-paymethod="paypal">' +
          'PayPal or Venmo</button>' +
        '</div>';
    }

    html += '<div id="bkPayMount" class="bk-stripe"><p class="bk-loading">Loading payment options...</p></div>' +
      '</div>';

    html += '<p class="bk-fine">Travel is worked out from your address and added when we confirm. ' +
      'Sales tax' + (quote.taxIsEstimate ? ' is added once we have your ZIP' : ' at ' + (quote.taxRateBp / 100).toFixed(2) + '% is included') + '.</p>';

    html += '<div class="bk-msg" id="bkMsg" role="status" aria-live="polite"></div>';

    setTimeout(mountPayment, 0);
    return html;
  }

  function vPay() {
    if (state.payState === 'paid') return null;
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
      slot: state.slot,
      priority: state.priority,
      payInFull: state.payInFull
    };
  }

  function mountPayment() {
    var mount = root.querySelector('#bkPayMount');
    if (!mount) return;

    if (state.payInFull && state.payMethod === 'paypal') return mountPayPal(mount);
    return mountStripe(mount);
  }

  /**
   * Stripe Payment Element. Covers card, Apple Pay, Google Pay, Link, bank
   * transfer and Cash App from one component, and which of those appear is a
   * dashboard toggle rather than a code change.
   */
  function mountStripe(mount) {
    if (!CFG.stripePublishableKey || !window.Stripe) {
      mount.innerHTML = '<p class="bk-warn">Online payment is not switched on yet. ' +
        'Your booking still goes through and we will send a secure payment link to confirm it.</p>';
      return;
    }

    fetch('/api/create-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cart: wireCart(),
        contact: state.contact,
        mode: state.payInFull ? 'pay_now' : 'card_only',
        idempotencyKey: bookingKey()
      })
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (r) {
        if (!r.ok || !r.j.clientSecret) {
          mount.innerHTML = '<p class="bk-warn">' +
            (r.j && r.j.error === 'unconfigured'
              ? 'Online payment is not switched on yet. Your booking still goes through and we will send a secure payment link to confirm it.'
              : 'We could not load the payment form. Your booking still goes through and we will send a secure payment link.') +
            '</p>';
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
        mount.innerHTML = '';
        elements.create('payment', { layout: 'tabs' }).mount(mount);
        root._stripe = { stripe: stripe, elements: elements, kind: r.j.kind };
      })
      .catch(function () {
        mount.innerHTML = '<p class="bk-warn">We could not reach the payment service. ' +
          'Your booking still goes through and we will send a secure payment link.</p>';
      });
  }

  /** PayPal and Venmo. Stripe does not carry Venmo, so PayPal's SDK does. */
  function mountPayPal(mount) {
    if (!CFG.paypalClientId || !window.paypal) {
      mount.innerHTML = '<p class="bk-warn">PayPal is not switched on yet. ' +
        'Choose card instead, or we will send you a payment link.</p>';
      return;
    }
    mount.innerHTML = '<div id="bkPaypalBtns"></div>';
    try {
      window.paypal.Buttons({
        style: { layout: 'vertical', shape: 'rect', label: 'pay' },
        createOrder: function () {
          return fetch('/api/paypal-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'create', cart: wireCart(), contact: state.contact })
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
      mount.innerHTML = '<p class="bk-warn">PayPal could not load. Choose card instead.</p>';
    }
  }

  /** Stable per-attempt key, so a double tap cannot create two charges. */
  var _key = null;
  function bookingKey() {
    if (!_key) _key = 'bk_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    return _key;
  }

  /* ================= summary table ================= */

  function lineTable(quote) {
    var rows = quote.lines.map(function (l) {
      return '<tr class="' + l.kind + (l.amountCents < 0 ? ' neg' : '') + '">' +
        '<td>' + esc(l.label) +
        (l.vehicleIndex !== null && state.vehicles.length > 1 ? ' <i>(vehicle ' + (l.vehicleIndex + 1) + ')</i>' : '') +
        '</td><td>' + $(l.amountCents) + '</td></tr>';
    }).join('');

    var travel = '<tr class="pending"><td>Travel <i>from your address</i></td><td>added at confirmation</td></tr>';
    var tax = quote.taxIsEstimate ? '<tr class="pending"><td>Sales tax</td><td>added at confirmation</td></tr>' : '';
    var when = state.slot
      ? '<tr class="when"><td>Your time</td><td>' +
        new Date(state.slot).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) +
        '</td></tr>'
      : '';

    var saved = quote.multiVehicleDiscountCents > 0
      ? '<tr class="saved"><td>You saved</td><td>' +
        $(quote.grossBeforeMultiCents - quote.totalCents) + '</td></tr>'
      : '';
    return '<table class="bk-lines">' + rows + travel + tax +
      '<tr class="tot"><td>Total</td><td>' + $(quote.totalCents) + '</td></tr>' + saved + when + '</table>';
  }

  /* ================= interactions ================= */

  function onClick(e) {
    var t = e.target.closest(
      '[data-size],[data-intent],[data-pkg],[data-addon],[data-clear],[data-win],[data-slot],' +
      '[data-consent],[data-pay],[data-delveh],[data-browsepick],[data-max],[data-sort],' +
      '[data-kind],[data-bucket],[data-paymethod],[data-corr],[data-coating],[data-garage],[data-step],' +
      '#bkAddVeh,#bkMoreDays,#bkNext,#bkBack,#bkClose,#bkScrim,#bkBrowse,#bkBrowseBack,' +
      '#bkQClear,#bkReset,#bkOther'
    );
    if (!t) return;
    var v = veh();

    if (t.id === 'bkBrowse') { state.browse = true; return render(); }
    if (t.id === 'bkBrowseBack') { state.browse = false; return render(); }
    if (t.id === 'bkQClear') { state.browseQ = ''; return render(); }
    if (t.id === 'bkReset') { state.browseQ = ''; state.browseMax = null; return render(); }
    if (t.dataset.max !== undefined) {
      state.browseMax = t.dataset.max === 'all' ? null : Number(t.dataset.max);
      return render();
    }
    if (t.dataset.sort) { state.browseSort = t.dataset.sort; return render(); }
    if (t.dataset.kind) { cycleFilter(t.dataset.kind); return render(); }
    if (t.dataset.bucket) {
      state.openBucket = state.openBucket === t.dataset.bucket ? null : t.dataset.bucket;
      return loadSlots();
    }
    if (t.dataset.paymethod) { state.payMethod = t.dataset.paymethod; return render(); }
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
        v.intent = def.scope;
        v.addons = [{ addonId: def.id, tierId: t.dataset.browsetier }];
        state.browse = false;
        return go(v.size ? 2 : 0);
      }
      var picked = P.findPackage(t.dataset.browsepick);
      v.intent = picked.category;
      v.packageIds = [picked.id];
      v.addons = [];
      state.browse = false;
      // Someone who came in through View Services skipped the size question,
      // so ask it now rather than pricing the job without it.
      return go(v.size ? 3 : 0);
    }

    if (t.id === 'bkOther') {
      root.querySelectorAll('.bk-otherslots').forEach(function (d) { d.hidden = false; });
      t.remove();
      return;
    }

    if (t.dataset.size) { v.size = t.dataset.size; return advance(); }
    if (t.dataset.intent) {
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
      return render();
    }

    if (t.dataset.addon) {
      var id = t.dataset.addon, tier = t.dataset.tier;
      var cur = v.addons.filter(function (a) { return a.addonId === id; })[0];
      v.addons = v.addons.filter(function (a) { return a.addonId !== id; });
      // Tiers are mutually exclusive: tapping the selected one clears it.
      if (!cur || cur.tierId !== tier) v.addons.push({ addonId: id, tierId: tier });
      pruneAddons(v);
      return render();
    }
    if (t.dataset.clear) {
      v.addons = v.addons.filter(function (a) { return a.addonId !== t.dataset.clear; });
      pruneAddons(v);
      return render();
    }

    if (t.dataset.win) {
      var w = t.dataset.win, i = state.preferredWindows.indexOf(w);
      if (i > -1) state.preferredWindows.splice(i, 1); else state.preferredWindows.push(w);
      state.slot = null;
      return render();
    }
    if (t.dataset.slot) { state.slot = Number(t.dataset.slot); return advance(); }
    if (t.id === 'bkMoreDays') {
      // More DAYS at the same six times, never more times within a day.
      state.daysShown = (state.daysShown || 3) + 4;
      return loadSlots();
    }

    if (t.dataset.consent) {
      state.consent[t.dataset.consent] = t.dataset.val === '1';
      // Update in place. A full re-render would refocus the name field and
      // yank the page back to the top, which felt like a glitch.
      var group = t.closest('.bk-consent');
      group.querySelectorAll('[data-consent]').forEach(function (b) {
        var yes = b.dataset.val === '1';
        b.classList.toggle('yes', yes && t.dataset.val === '1');
        b.classList.toggle('no', !yes && t.dataset.val === '0');
      });
      group.classList.add('answered');
      // Then ease down to whatever still needs an answer.
      var next = null;
      root.querySelectorAll('.bk-consent').forEach(function (g) {
        if (!next && !g.classList.contains('answered')) next = g;
      });
      var target = next || el('bkNext');
      if (target) target.scrollIntoView({ behavior: 'smooth', block: next ? 'center' : 'nearest' });
      renderTotal();
      return;
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
      if (want <= Math.max(state.step, furthestValid())) return go(want);
      return;
    }
    if (t.id === 'bkNext') return advance();
    if (t.id === 'bkBack') return go(state.step - 1);
    if (t.id === 'bkClose' || t.id === 'bkScrim') return close();
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
    if (t.id === 'bkSplit') {
      state.separateTimes = t.checked;
      state.slot = null;
      return render();
    }
    if (t.id === 'bkPrio') {
      state.priority = t.checked;
      state.slot = null;
      state.daysShown = 3;
      return render();
    }
    if (t.dataset.addr === 'region') { state.address.region = t.value; return renderTotal(); }
  }

  function onInput(e) {
    var t = e.target;
    if (t.dataset.addr) {
      state.address[t.dataset.addr] = t.value;
      if (t.dataset.addr === 'zip') {
        // Repaint only the travel figure, so the field keeps focus mid-typing.
        var box = el('bkBody').querySelector('.bk-travel-slot');
        if (box) box.outerHTML = travelLine();
        renderTotal();
      }
      if (t.dataset.addr === 'line1') maybeAutocomplete(t.value);
      return;
    }
    if (t.dataset.c) { state.contact[t.dataset.c] = t.value; return; }
    if (t.dataset.label !== undefined) { state.vehicles[Number(t.dataset.label)].label = t.value; return; }
    if (t.dataset.note === 'loc') { state.locationNote = t.value; return; }
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
    if (!CFG.googleApiKey || text.length < 4) { box.hidden = true; return; }

    clearTimeout(acTimer);
    acTimer = setTimeout(function () {
      if (!acToken) acToken = String(Date.now()) + Math.random().toString(36).slice(2);
      fetch('https://places.googleapis.com/v1/places:autocomplete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': CFG.googleApiKey,
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

  /* ================= submit ================= */

  function submit() {
    if (state.sending) return;
    var msg = root.querySelector('#bkMsg');
    state.sending = true;
    if (msg) { msg.className = 'bk-msg ok'; msg.textContent = 'Confirming...'; }
    el('bkNext').disabled = true;

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

  function record() {
    var quote = q();
    var msg = root.querySelector('#bkMsg');

    var body = buildSummary(quote);
    var fd = new FormData();
    fd.append('access_key', WEB3FORMS_KEY);
    fd.append('subject', 'BOOKING, ' + state.contact.name + ', ' + $(quote.totalCents) +
      (state.slot ? ', ' + new Date(state.slot).toLocaleString('en-US') : ''));
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
        else fail(msg);
      })
      .catch(function () { state.sending = false; el('bkNext').disabled = false; fail(msg); });
  }

  function fail(msg) {
    if (!msg) return;
    msg.className = 'bk-msg err';
    msg.textContent = 'Something went wrong sending that. Please call or text (513) 279-2915 and we will get you booked.';
  }

  function buildSummary(quote) {
    var a = state.address;
    return 'BOOKING\n\n' +
      'WHO\n  ' + state.contact.name + '\n  ' + state.contact.phone +
      (state.contact.email ? '\n  ' + state.contact.email : '') + '\n\n' +
      'WHEN\n  ' + (state.slot ? new Date(state.slot).toLocaleString('en-US') : 'not selected') +
      (state.priority ? '\n  PRIORITY, within 3 days' : '') +
      (state.preferredWindows.length ? '\n  Prefers: ' + state.preferredWindows.join(', ') : '') + '\n\n' +
      'WHERE\n  ' + [a.line1, a.city, a.region, a.zip].filter(Boolean).join(', ') +
      (state.noGoodLocation ? '\n  ** NEEDS A LOCATION SORTED **\n  ' + (state.locationNote || '(no note)') : '') + '\n\n' +
      'VEHICLES\n' + state.vehicles.map(function (v, i) {
        var size = v.size ? P.vehicleSize(v.size) : null;
        return '  ' + (i + 1) + '. ' + (v.label || '(not named)') + (size ? ' [' + size.label + ']' : '') +
          '\n     ' + v.packageIds.map(function (id) { return (P.findPackage(id) || {}).name; }).join(' + ') +
          (v.addons.length ? '\n     Add-ons: ' + v.addons.map(function (x) {
            var d = P.findAddon(x.addonId);
            var tr = d && d.tiers.filter(function (t) { return t.id === x.tierId; })[0];
            return d.name + (tr && d.tiers.length > 1 ? ' (' + tr.label + ')' : '');
          }).join(', ') : '');
      }).join('\n') + '\n\n' +
      'PRICING\n' + quote.lines.map(function (l) {
        return '  ' + l.label + ': ' + $(l.amountCents);
      }).join('\n') +
      '\n  TOTAL: ' + $(quote.totalCents) +
      '\n  Paying: ' + (state.payInFull ? 'in full now' : 'after service, card on file') +
      '\n  Travel: added at confirmation' +
      '\n  On site: ' + fmtDur(quote.serviceDurationMin) + '\n\n' +
      'CONSENT\n  Terms: yes\n  SMS: ' + (state.consent.sms ? 'YES' : 'no') +
      '\n  Filming: ' + (state.consent.media ? 'YES' : 'no') + '\n\n' +
      (state.notes ? 'NOTES\n  ' + state.notes + '\n' : '');
  }

  function done(quote) {
    state.done = true;
    el('bkBar').style.width = '100%';
    el('bkTitle').textContent = 'You are booked in';
    el('bkNext').hidden = true;
    el('bkBack').hidden = true;
    el('bkTotal').hidden = true;

    el('bkBody').innerHTML =
      '<div class="bk-done"><div class="bk-done-ic">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6L9 17l-5-5"/></svg></div>' +
      '<h3>Thanks, ' + esc(state.contact.name.split(' ')[0]) + '.</h3>' +
      '<p>We have your booking' + (state.slot ? ' for <b>' +
        new Date(state.slot).toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }) +
        '</b>' : '') + '. Your total is <b>' + $(quote.totalCents) + '</b> before travel.</p>' +
      '<button type="button" class="bk-next-steps" id="bkSteps">Learn more about next steps</button>' +
      '<div class="bk-steps" id="bkStepsBody" hidden>' +
        '<ol>' +
        '<li><b>We confirm within a few hours.</b> We check the drive from our base, add the travel fee, and text you the final number.</li>' +
        '<li><b>You get a reminder.</b> Two days before, and again the morning of.</li>' +
        '<li><b>A few quick questions.</b> Water access, power access, and where to park. Takes a minute and means we arrive ready.</li>' +
        '<li><b>On the day.</b> We text when we are on the way. You do not need to be there, as long as we can reach the vehicle.</li>' +
        '<li><b>After.</b> ' + (state.payInFull ? 'Already paid, nothing more to do.' : 'We charge the card on file once the work is done.') +
        ' We will ask how it went before asking for a review.</li>' +
        '</ol>' +
        '<p>Need to change anything? Call or text <a href="tel:+15132792915">(513) 279-2915</a>.</p>' +
      '</div>' +
      '<button type="button" class="bk-doneclose" id="bkDoneClose">Close</button>' +
      '</div>';
  }

  /* ================= mount ================= */

  var SHELL =
    '<div class="bk-scrim" id="bkScrim"></div>' +
    '<div class="bk-modal" role="dialog" aria-modal="true" aria-labelledby="bkTitle">' +
      '<div class="bk-progress" id="bkProgress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">' +
        '<div class="bk-bar" id="bkBar"></div>' +
      '</div>' +
      '<nav class="bk-nav" id="bkNav" aria-label="Booking steps"></nav>' +
      '<header class="bk-head">' +
        '<button type="button" class="bk-back" id="bkBack" hidden aria-label="Back">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M19 12H5M11 18l-6-6 6-6"/></svg>' +
        '</button>' +
        '<h2 id="bkTitle"></h2>' +
        '<button type="button" class="bk-close" id="bkClose" aria-label="Close booking">&times;</button>' +
      '</header>' +
      '<div class="bk-scroll" id="bkScroll"><div class="bk-body" id="bkBody"></div></div>' +
      '<footer class="bk-foot">' +
        '<div class="bk-total" id="bkTotal" hidden>' +
          '<span class="bk-total-amt"></span><span class="bk-total-sub"></span>' +
        '</div>' +
        '<button type="button" class="bk-nextbtn" id="bkNext"><span>Continue</span>' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>' +
        '</button>' +
      '</footer>' +
    '</div>';

  var lastFocus = null;

  function open() {
    if (!host) return;
    reset();
    host.hidden = false;
    document.body.classList.add('bk-open');
    lastFocus = document.activeElement;
    render();
    el('bkClose').focus();
  }

  function close() {
    if (!host) return;
    host.hidden = true;
    document.body.classList.remove('bk-open');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function mount() {
    host = document.getElementById('bookFunnel');
    if (!host) return;
    host.innerHTML = SHELL;
    root = host;

    host.addEventListener('click', function (e) {
      if (e.target.closest('#bkSteps')) {
        var b = root.querySelector('#bkStepsBody');
        b.hidden = !b.hidden;
        return;
      }
      if (e.target.closest('#bkDoneClose')) return close();
      var place = e.target.closest('[data-place]');
      if (place) {
        // Places gives back a formatted line; the customer completes the rest.
        var input = root.querySelector('[data-addr="line1"]');
        if (input) { input.value = place.textContent; state.address.line1 = place.textContent; }
        root.querySelector('#bkAc').hidden = true;
        var city = root.querySelector('[data-addr="city"]');
        if (city) city.focus();
        return;
      }
      onClick(e);
    });
    host.addEventListener('change', onChange);
    host.addEventListener('input', onInput);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !host.hidden) close();
    });

    // Any Book Now link opens the funnel in place rather than navigating.
    document.querySelectorAll('a[href="book.html"], a[href="./book.html"], [data-book], [data-book-browse]').forEach(function (a) {
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

    if (host.dataset.autoOpen === 'true' || location.hash === '#book') open();
  }

  window.ACFunnel = { open: open, close: close };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();

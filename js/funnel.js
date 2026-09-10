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
    return { size: null, intent: null, packageIds: [], addons: [], label: '' };
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
      slotCache: null,
      contact: { name: '', phone: '', email: '' },
      consent: { terms: null, sms: null, media: null },
      payInFull: false,
      notes: '',
      sending: false,
      done: false
    };
  }
  reset();

  /* ================= steps ================= */
  /* `auto` means a single click both records the answer and moves on, so the
     common path never needs the Continue button. */

  var STEPS = [
    { id: 'size',     title: 'How big is your vehicle?',      auto: true,  render: rSize,    valid: vSize },
    { id: 'intent',   title: 'What does it need?',            auto: true,  render: rIntent,  valid: vIntent },
    { id: 'package',  title: 'Choose your package',           auto: true,  render: rPackage, valid: vPackage },
    { id: 'addons',   title: 'Anything extra?',               auto: false, render: rAddons,  valid: vAddons },
    { id: 'location', title: 'Where are we detailing?',       auto: false, render: rLoc,     valid: vLoc },
    { id: 'more',     title: 'Add another vehicle?',          auto: false, render: rMore,    valid: ok },
    { id: 'time',     title: 'Pick your time',                auto: true,  render: rTime,    valid: vTime },
    { id: 'contact',  title: 'How do we reach you?',          auto: false, render: rContact, valid: vContact },
    { id: 'pay',      title: 'Confirm your booking',          auto: false, render: rPay,     valid: vPay }
  ];

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
          addons: v.addons.map(addonRef).filter(Boolean)
        };
      }),
      // Travel needs a Maps key and a chosen time. Until then it reads as
      // pending rather than being guessed at.
      oneWayMinutes: null,
      surchargeContext: surchargeCtx(),
      zip: state.address.zip || null,
      payInFull: state.payInFull
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

  function totalDurationMin() { return q().serviceDurationMin; }

  /* ================= dom ================= */

  var root = null, host = null;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function el(id) { return root.querySelector('#' + id); }

  function render() {
    if (state.done) return;
    var s = step();
    var pct = Math.round(((state.step + 1) / STEPS.length) * 100);

    el('bkBar').style.width = pct + '%';
    el('bkProgress').setAttribute('aria-valuenow', String(pct));
    el('bkTitle').textContent = s.title;
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
    box.querySelector('.bk-total-sub').textContent =
      dur ? 'about ' + fmtDur(dur) + ' on site' : '';
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
    go(state.step + 1);
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
    return '<p class="bk-sub">We will only show packages that fit.</p><div class="bk-cards">' +
      opts.map(function (o) {
        return '<button type="button" class="bk-card' + (v.intent === o[0] ? ' on' : '') + '" data-intent="' + o[0] + '">' +
          '<b>' + o[1] + '</b><span>' + o[2] + '</span></button>';
      }).join('') + '</div>';
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
        var dur = p.durationMaxMin
          ? fmtDur(p.durationMin) + ' to ' + fmtDur(p.durationMaxMin)
          : fmtDur(p.durationMin);

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
          '<span class="bk-pkg-r"><b>' + $(p.priceCents) + '</b><i>' + dur + '</i></span>' +
          '</button>';
      });
      html += '</div>';
    });

    if (v.intent === 'both') {
      html += '<p class="bk-note">Pick one from each list. Booking both takes <b>' +
        $(RULES.comboDiscountCents) + ' off</b> automatically.</p>';
    }
    return html;
  }

  function vPackage() {
    var v = veh();
    if (!v.packageIds.length) return 'Choose a package to continue.';
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
      var list = P.addonsFor(scope).filter(function (a) { return !P.isUnpriced(a); });
      if (!list.length) return;
      if (scopes.length > 1) html += '<h3 class="bk-grp">' + (scope === 'interior' ? 'Interior' : 'Exterior') + '</h3>';

      list.forEach(function (a) {
        var blocked = P.addonBlockedReason(a, ctx);
        var chosen = v.addons.filter(function (x) { return x.addonId === a.id; })[0];
        var multi = a.tiers.length > 1;

        html += '<div class="bk-addon' + (chosen ? ' on' : '') + (blocked ? ' off' : '') + '">' +
          '<div class="bk-addon-h"><b>' + esc(a.name) + '</b>' +
          (chosen ? '<button type="button" class="bk-clear" data-clear="' + a.id + '">Remove</button>' : '') +
          '</div>' +
          '<p class="bk-addon-d">' + esc(a.description) + '</p>';

        if (blocked) {
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
        : '');
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

    return '<div class="bk-upsell"><b>Get ' + pct + '% off when you book 2 or more vehicles</b>' +
      '<span>Same visit, same time slot. We only charge travel once.</span></div>' +
      '<div class="bk-vehs">' + list + '</div>' +
      '<button type="button" class="bk-addveh" id="bkAddVeh">Add another vehicle</button>' +
      '<div class="bk-field" style="margin-top:1.2rem"><label for="bkLabel">What are we detailing? <i>(optional)</i></label>' +
      '<input type="text" id="bkLabel" data-label="' + state.active + '" value="' + esc(veh().label) + '" placeholder="e.g. 2018 Honda CR-V" /></div>';
  }

  /* ================= step 7: time ================= */

  function rTime() {
    var earliest = P.earliestBookableDate(startOfToday(), RULES.window);
    var html = '<p class="bk-sub">Pick a time that works. Nothing is charged until the next step.</p>';

    html += '<div class="bk-windows">' +
      P.TIME_WINDOWS.map(function (w) {
        var on = state.preferredWindows.indexOf(w.id) > -1;
        return '<button type="button" class="bk-win' + (on ? ' on' : '') + '" data-win="' + w.id + '">' +
          esc(w.label) + (w.premium ? ' <i>+' + RULES.surcharge.timeOfDayBp / 100 + '%</i>' : '') + '</button>';
      }).join('') + '</div>';

    html += '<label class="bk-check bk-prio' + (state.priority ? ' on' : '') + '">' +
      '<input type="checkbox" id="bkPrio"' + (state.priority ? ' checked' : '') + ' />' +
      '<span><b>I need it within the next 3 days</b>' +
      '<i>Opens our soonest slots. Adds ' + RULES.surcharge.priorityBp / 100 + '% to the service total, and never stacks with the early or late charge.</i></span></label>';

    if (!state.priority) {
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

    var from = state.priority ? Date.now() : P.earliestBookableDate(startOfToday(), RULES.window).getTime();
    var to = from + 28 * DAY;
    var dur = totalDurationMin();

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
    var slots = P.computeSlots({
      openBlocks: win.open,
      busy: win.busy,
      serviceDurationMin: dur,
      travelBeforeMin: 30,
      travelAfterMin: 30,
      granularityMin: 30,
      notBefore: from,
      notAfter: to
    });

    var split = state.preferredWindows.length
      ? P.matchWindows(slots, state.preferredWindows)
      : { inPreferred: slots, outsidePreferred: [] };

    var primary = split.inPreferred;
    var fellBack = false;
    if (!primary.length && split.outsidePreferred.length) {
      primary = split.outsidePreferred;
      fellBack = true;
    }

    if (!primary.length) {
      box.innerHTML = '<p class="bk-empty">Nothing open in that range for a ' + fmtDur(dur) +
        ' job. Try another time of day, or <a href="index.html#inquiry">send us a question</a> and we will find something.</p>';
      return;
    }

    var html = '';
    if (win.mode === 'unconfigured') {
      html += '<p class="bk-warn">These are our usual hours. We will confirm the exact time with you' +
        (errMsg ? ' (calendar unavailable right now)' : '') + '.</p>';
    } else if (fellBack) {
      html += '<p class="bk-warn">Nothing in the times you picked, so here is what else is open.</p>';
    }

    var byDay = {};
    primary.slice(0, 60).forEach(function (ms) {
      var k = new Date(ms).toDateString();
      (byDay[k] = byDay[k] || []).push(ms);
    });

    html += '<div class="bk-days">';
    Object.keys(byDay).slice(0, 10).forEach(function (k, di) {
      var d = new Date(k);
      html += '<div class="bk-day' + (di > 2 ? ' more' : '') + '"><h4>' +
        d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) + '</h4><div class="bk-times">' +
        byDay[k].slice(0, 8).map(function (ms) {
          var t = new Date(ms);
          var label = t.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
          var end = new Date(ms + 60 * 60000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
          return '<button type="button" class="bk-time' + (state.slot === ms ? ' on' : '') + '" data-slot="' + ms + '">' +
            label + '<i>arrive ' + label + ' to ' + end + '</i></button>';
        }).join('') + '</div></div>';
    });
    html += '</div>';

    if (Object.keys(byDay).length > 3) {
      html += '<button type="button" class="bk-morelink" id="bkMoreDays">Show more dates</button>';
    }
    box.innerHTML = html;
  }

  function vTime() { return state.slot ? null : 'Pick a time to continue.'; }

  /* ================= step 8: contact ================= */

  function yesNo(name, label, help, link) {
    var v = state.consent[name];
    return '<div class="bk-consent">' +
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
    var stripeReady = Boolean(CFG.stripePublishableKey);

    var html = '<div class="bk-review">' + lineTable(quote) + '</div>';

    html += '<div class="bk-payopts">' +
      '<button type="button" class="bk-pay' + (!state.payInFull ? ' on' : '') + '" data-pay="later">' +
        '<b>Pay after the detail</b>' +
        '<span>Card on file now, charged when the work is done.</span>' +
        '<i>' + $(quote.totalCents) + '</i>' +
      '</button>' +
      '<button type="button" class="bk-pay' + (state.payInFull ? ' on' : '') + '" data-pay="now">' +
        '<b>Pay now and save ' + RULES.payInFullDiscountBp / 100 + '%</b>' +
        '<span>Settle the whole thing today.</span>' +
        '<i>' + $(state.payInFull ? quote.totalCents : quote.totalCents - quote.payInFullSavingsCents) + '</i>' +
      '</button>' +
      '</div>';

    html += '<div class="bk-cardbox">' +
      '<h4>Card details</h4>' +
      '<p class="bk-hint">Your card confirms the time slot. ' +
      (state.payInFull ? 'You are paying in full today.' : 'Nothing is charged until the detail is finished.') +
      '</p>' +
      (stripeReady
        ? '<div id="bkStripe" class="bk-stripe"></div>'
        : '<p class="bk-warn">Card payments are not switched on yet, so we will confirm your time and send a secure payment link instead. Everything else about your booking goes through now.</p>') +
      '</div>';

    html += '<p class="bk-fine">Travel is worked out from your address and added when we confirm. ' +
      'Sales tax' + (quote.taxIsEstimate ? ' is added once we have your ZIP' : ' at ' + (quote.taxRateBp / 100).toFixed(2) + '% is included') + '.</p>';

    html += '<div class="bk-msg" id="bkMsg" role="status" aria-live="polite"></div>';

    if (stripeReady) setTimeout(mountStripe, 0);
    return html;
  }

  function vPay() { return null; }

  function mountStripe() {
    var mount = root.querySelector('#bkStripe');
    if (!mount || !window.Stripe) return;
    try {
      var stripe = window.Stripe(CFG.stripePublishableKey);
      var elements = stripe.elements({
        mode: 'setup',
        currency: 'usd',
        paymentMethodCreation: 'manual'
      });
      elements.create('payment').mount(mount);
      root._stripe = { stripe: stripe, elements: elements };
    } catch (e) {
      mount.innerHTML = '<p class="bk-warn">Could not load the card form. We will send you a secure payment link instead.</p>';
    }
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

    return '<table class="bk-lines">' + rows + travel + tax +
      '<tr class="tot"><td>Total</td><td>' + $(quote.totalCents) + '</td></tr>' + when + '</table>';
  }

  /* ================= interactions ================= */

  function onClick(e) {
    var t = e.target.closest(
      '[data-size],[data-intent],[data-pkg],[data-addon],[data-clear],[data-win],[data-slot],' +
      '[data-consent],[data-pay],[data-delveh],#bkAddVeh,#bkMoreDays,#bkNext,#bkBack,#bkClose,#bkScrim'
    );
    if (!t) return;
    var v = veh();

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
      // "Both" needs one from each list, so only auto-advance once it is valid.
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
      root.querySelectorAll('.bk-day.more').forEach(function (d) { d.classList.remove('more'); });
      t.remove();
      return;
    }

    if (t.dataset.consent) {
      state.consent[t.dataset.consent] = t.dataset.val === '1';
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
    if (t.id === 'bkPrio') { state.priority = t.checked; state.slot = null; return render(); }
    if (t.dataset.addr === 'region') { state.address.region = t.value; return renderTotal(); }
  }

  function onInput(e) {
    var t = e.target;
    if (t.dataset.addr) {
      state.address[t.dataset.addr] = t.value;
      if (t.dataset.addr === 'zip' && /^\d{5}$/.test(t.value)) renderTotal();
      if (t.dataset.addr === 'line1') maybeAutocomplete(t.value);
      return;
    }
    if (t.dataset.c) { state.contact[t.dataset.c] = t.value; return; }
    if (t.dataset.label !== undefined) { state.vehicles[Number(t.dataset.label)].label = t.value; return; }
    if (t.dataset.note === 'loc') { state.locationNote = t.value; return; }
    if (t.dataset.note === 'general') { state.notes = t.value; return; }
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
    var quote = q();
    var msg = root.querySelector('#bkMsg');
    state.sending = true;
    if (msg) { msg.className = 'bk-msg ok'; msg.textContent = 'Confirming...'; }
    el('bkNext').disabled = true;

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
    document.querySelectorAll('a[href="book.html"], a[href="./book.html"], [data-book]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        open();
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

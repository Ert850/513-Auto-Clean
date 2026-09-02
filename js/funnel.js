/* ============================================================
   513 Auto Clean, booking funnel
   Pricing comes from window.ACPricing (js/pricing.bundle.js), which is the
   same TypeScript engine covered by the unit tests. Nothing here recomputes
   money on its own.
   ============================================================ */
(function () {
  'use strict';

  var P = window.ACPricing;
  if (!P) return;

  var RULES = P.RULES;
  var CATALOG = P.CATALOG;
  var $ = P.formatCents;

  var WEB3FORMS_KEY = '8a502fe3-2a53-4904-98e9-b18dabb1f579';

  /* ---------------- state ---------------- */
  var state = {
    step: 0,
    vehicles: [newVehicle()],
    active: 0, // vehicle currently being configured
    address: { line1: '', city: '', zip: '' },
    noGoodLocation: false,
    locationNote: '',
    priority: false,
    preferredDays: [],
    preferredWindow: '',
    contact: { name: '', phone: '', email: '' },
    consent: { terms: false, sms: false, media: false },
    notes: ''
  };

  function newVehicle() {
    return { label: '', intent: null, packageIds: [], addons: [], showroom: false };
  }

  /* ---------------- steps ---------------- */
  var STEPS = [
    { id: 'intent',  title: 'What does your vehicle need?', render: renderIntent,  valid: vIntent },
    { id: 'package', title: 'Choose your package',         render: renderPackage, valid: vPackage },
    { id: 'addons',  title: 'Any add-ons?',                render: renderAddons,  valid: always },
    { id: 'vehicles', title: 'Your vehicles',               render: renderVehicles, valid: vVehicles },
    { id: 'location', title: 'Where are we detailing?',     render: renderLocation, valid: vLocation },
    { id: 'timing',  title: 'When works for you?',         render: renderTiming,  valid: vTiming },
    { id: 'contact', title: 'How do we reach you?',        render: renderContact, valid: vContact },
    { id: 'review',  title: 'Review your booking',         render: renderReview,  valid: always }
  ];

  function always() { return null; }

  /* ---------------- quote ---------------- */
  function cart() {
    return {
      vehicles: state.vehicles.map(function (v) {
        return {
          label: v.label || 'Vehicle',
          packages: v.packageIds.map(function (id) {
            var p = findPkg(id);
            return { id: p.id, name: p.name, category: p.category, priceCents: p.priceCents, durationMin: p.durationMin };
          }),
          addons: v.addons.map(function (a) { return { id: a.id, name: a.name, hours: a.hours }; })
        };
      }),
      // No Maps key wired up yet, so travel is quoted on confirmation rather
      // than guessed at. Passing null makes the engine flag travelIsEstimate.
      oneWayMinutes: null,
      surchargeContext: state.priority
        ? { startMinutesLocal: P.minutesOfDay(12), priorityBooking: true }
        : null
    };
  }

  function currentQuote() { return P.quote(cart(), RULES); }

  function findPkg(id) {
    return CATALOG.packages.filter(function (p) { return p.id === id; })[0];
  }

  function hasShowroom() {
    return state.vehicles.some(function (v) { return v.showroom; });
  }

  /* ---------------- rendering ---------------- */
  var stepEl = document.getElementById('step');
  var backBtn = document.getElementById('backBtn');
  var nextBtn = document.getElementById('nextBtn');
  var nextLabel = document.getElementById('nextLabel');
  var progress = document.getElementById('progress');
  var progressBar = document.getElementById('progressBar');

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function render() {
    var step = STEPS[state.step];
    stepEl.innerHTML =
      '<p class="step-count">Step ' + (state.step + 1) + ' of ' + STEPS.length + '</p>' +
      '<h1 class="step-title">' + esc(step.title) + '</h1>' +
      step.render();

    backBtn.hidden = state.step === 0;
    nextLabel.textContent = state.step === STEPS.length - 1 ? 'Send booking request' : 'Continue';

    var pct = Math.round((state.step / (STEPS.length - 1)) * 100);
    progressBar.style.width = pct + '%';
    progress.setAttribute('aria-valuenow', String(pct));

    renderSummary();
    stepEl.querySelectorAll('[autofocus]').forEach(function (el) { el.focus(); });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ---- step 1: intent ---- */
  function renderIntent() {
    var v = state.vehicles[state.active];
    var opts = [
      ['interior', 'Interior', 'Seats, carpets, glass, trim'],
      ['exterior', 'Exterior', 'Wash, wheels, paint, protection'],
      ['both', 'Both', 'The full treatment, inside and out']
    ];
    return '<p class="step-sub">We&rsquo;ll only show you packages that fit.</p><div class="pick-grid">' +
      opts.map(function (o) {
        return '<button type="button" class="pick' + (v.intent === o[0] ? ' on' : '') + '" data-intent="' + o[0] + '">' +
          '<b>' + o[1] + '</b><span>' + o[2] + '</span></button>';
      }).join('') + '</div>';
  }
  function vIntent() {
    return state.vehicles[state.active].intent ? null : 'Pick interior, exterior, or both to continue.';
  }

  /* ---- step 2: package ---- */
  function renderPackage() {
    var v = state.vehicles[state.active];
    var cats = v.intent === 'both' ? ['interior', 'exterior'] : [v.intent];
    var html = '<p class="step-sub">Prices are for most cars. Larger or heavily soiled vehicles may vary, and we&rsquo;ll always confirm before we start.</p>';

    cats.forEach(function (cat) {
      if (v.intent === 'both') html += '<h2 class="grp">' + (cat === 'interior' ? 'Interior' : 'Exterior') + '</h2>';
      html += '<div class="pkg-list">';
      CATALOG.packages.filter(function (p) { return p.category === cat; }).forEach(function (p) {
        var on = v.packageIds.indexOf(p.id) > -1;
        html += '<button type="button" class="pkg' + (on ? ' on' : '') + '" data-pkg="' + p.id + '" data-cat="' + cat + '">' +
          '<span class="pkg-main"><b>' + esc(p.name) + '</b>' +
          (p.featured ? '<i class="pkg-tag">Most popular</i>' : '') +
          '<span class="pkg-tag-line">' + esc(p.tagline) + '</span>' +
          '<span class="pkg-feat">' + P.componentsOf(p, CATALOG).map(function (c) { return esc(c.name); }).join(' &middot; ') + '</span>' +
          '</span>' +
          '<span class="pkg-price"><b>' + $(p.priceCents) + '</b><i>' + fmtDur(p.durationMin) + '</i></span>' +
          '</button>';
      });
      html += '</div>';
    });

    // Showroom Ready, a quote request, not an instant booking.
    html += '<button type="button" class="showroom' + (v.showroom ? ' on' : '') + '" data-showroom="1">' +
      '<b>' + esc(P.SHOWROOM_READY.name) + ' <sup>*</sup></b>' +
      '<span>' + esc(P.SHOWROOM_READY.tagline) + '</span>' +
      '<i>Weekends only &middot; 10:00 AM start &middot; needs a full day &middot; priced after inspection</i>' +
      '</button>';

    if (v.intent === 'both') {
      html += '<p class="hint">Booking interior <em>and</em> exterior on the same vehicle takes <b>' +
        $(RULES.comboDiscountCents) + ' off</b> automatically.</p>';
    }
    return html;
  }
  function vPackage() {
    var v = state.vehicles[state.active];
    if (v.showroom) return null;
    if (!v.packageIds.length) return 'Choose a package to continue.';
    if (v.intent === 'both') {
      var cats = v.packageIds.map(function (id) { return findPkg(id).category; });
      if (cats.indexOf('interior') < 0 || cats.indexOf('exterior') < 0)
        return 'You picked "Both", choose an interior package and an exterior package.';
    }
    return null;
  }

  /* ---- step 3: add-ons ---- */
  function renderAddons() {
    var v = state.vehicles[state.active];
    var rate = RULES.addonRateCents;
    var html = '<p class="step-sub">Billed at <b>' + $(rate) + '/hour</b> with a one-hour minimum. Most take about an hour, we&rsquo;ll confirm on site before doing extra.</p><div class="addon-list">';
    P.ADDONS.forEach(function (a) {
      var picked = v.addons.filter(function (x) { return x.id === a.id; })[0];
      html += '<div class="addon-row' + (picked ? ' on' : '') + '">' +
        '<label class="addon-main"><input type="checkbox" data-addon="' + a.id + '"' + (picked ? ' checked' : '') + ' />' +
        '<span><b>' + esc(a.name) + '</b><i>' + esc(a.subtitle) + '</i></span></label>' +
        (picked
          ? '<span class="hrs"><button type="button" class="hrs-btn" data-hrs="' + a.id + '" data-d="-1" aria-label="Fewer hours">&minus;</button>' +
            '<b>' + picked.hours + ' hr' + (picked.hours > 1 ? 's' : '') + '</b>' +
            '<button type="button" class="hrs-btn" data-hrs="' + a.id + '" data-d="1" aria-label="More hours">+</button>' +
            '<i>' + $(picked.hours * rate) + '</i></span>'
          : '<span class="hrs muted">' + $(rate) + '</span>') +
        '</div>';
    });
    return html + '</div>';
  }

  /* ---- step 4: vehicles ---- */
  function renderVehicles() {
    var html = '<p class="step-sub">Adding another vehicle takes <b>' +
      (RULES.additionalVehicleDiscountBp / 100) + '% off</b> each one after the first. We only charge travel once for the visit.</p><div class="veh-list">';
    state.vehicles.forEach(function (v, i) {
      var names = v.showroom ? [P.SHOWROOM_READY.name] : v.packageIds.map(function (id) { return findPkg(id).name; });
      html += '<div class="veh">' +
        '<div class="veh-top"><b>Vehicle ' + (i + 1) + '</b>' +
        (state.vehicles.length > 1 ? '<button type="button" class="veh-del" data-del="' + i + '">Remove</button>' : '') +
        '</div>' +
        '<input type="text" class="veh-label" data-label="' + i + '" value="' + esc(v.label) + '" placeholder="e.g. 2018 Honda CR-V" aria-label="Vehicle ' + (i + 1) + ' make and model" />' +
        '<p class="veh-svc">' + esc(names.join(' + ') || 'No package chosen') +
        (v.addons.length ? ' &middot; ' + v.addons.map(function (a) { return esc(a.name); }).join(', ') : '') + '</p>' +
        '<button type="button" class="veh-edit" data-edit="' + i + '">Change</button>' +
        '</div>';
    });
    html += '</div><button type="button" class="add-veh" id="addVeh">+ Add another vehicle</button>';
    return html;
  }
  function vVehicles() {
    var bad = state.vehicles.some(function (v) { return !v.showroom && !v.packageIds.length; });
    return bad ? 'Every vehicle needs a package. Tap Change to finish one.' : null;
  }

  /* ---- step 5: location ---- */
  function renderLocation() {
    var a = state.address;
    return '<p class="step-sub">We come to you. Travel is quoted from your address, the first 10 minutes of drive time are free.</p>' +
      '<div class="field"><label for="l1">Street address <span class="req">*</span></label>' +
      '<input type="text" id="l1" data-addr="line1" value="' + esc(a.line1) + '" placeholder="505 Example St" autocomplete="address-line1" autofocus /></div>' +
      '<div class="field-row">' +
      '<div class="field"><label for="lc">City <span class="req">*</span></label>' +
      '<input type="text" id="lc" data-addr="city" value="' + esc(a.city) + '" placeholder="Cincinnati" autocomplete="address-level2" /></div>' +
      '<div class="field"><label for="lz">ZIP <span class="req">*</span></label>' +
      '<input type="text" id="lz" data-addr="zip" value="' + esc(a.zip) + '" placeholder="45220" inputmode="numeric" autocomplete="postal-code" /></div>' +
      '</div>' +
      '<label class="chk"><input type="checkbox" id="noLoc"' + (state.noGoodLocation ? ' checked' : '') + ' />' +
      '<span>I don&rsquo;t have a good location for a detail near me</span></label>' +
      (state.noGoodLocation
        ? '<div class="chk-panel"><p>No problem, this is usually easy to solve. Local spots like retail parking lots often work well, especially for interior details. Tell us roughly where you are and we&rsquo;ll sort somewhere out with you.</p>' +
          '<textarea data-note="loc" rows="3" placeholder="e.g. I live in an apartment with no driveway, but there is a big lot behind the Kroger on Ludlow">' + esc(state.locationNote) + '</textarea></div>'
        : '') +
      '<p class="hint">Your exact travel fee is confirmed with your booking, we calculate it from real drive time, not a flat rate.</p>';
  }
  function vLocation() {
    var a = state.address;
    if (!a.line1.trim() || !a.city.trim() || !a.zip.trim()) return 'We need your address to work out travel and timing.';
    return null;
  }

  /* ---- step 6: timing ---- */
  function renderTiming() {
    var days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    var windows = [
      ['morning', 'Morning', 'Start 10 AM – 12 PM'],
      ['afternoon', 'Afternoon', 'Start 12 – 4 PM'],
      ['evening', 'Evening', 'Start 4 – 6 PM'],
      ['early-late', 'Early or late', 'Before 10 AM or after 6 PM &middot; +' + (RULES.surcharge.timeOfDayBp / 100) + '%']
    ];
    var earliest = P.earliestBookableDate(startOfToday(), RULES.window);
    return '<p class="step-sub">Pick what suits and we&rsquo;ll confirm an exact time. Jobs are scheduled from <b>' +
      earliest.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) + '</b> onward.</p>' +
      '<h2 class="grp">Days that work</h2><div class="chip-row">' +
      days.map(function (d) {
        return '<button type="button" class="chip' + (state.preferredDays.indexOf(d) > -1 ? ' on' : '') + '" data-day="' + d + '">' + d + '</button>';
      }).join('') + '</div>' +
      '<h2 class="grp">Time of day</h2><div class="pick-grid tight">' +
      windows.map(function (w) {
        return '<button type="button" class="pick' + (state.preferredWindow === w[0] ? ' on' : '') + '" data-window="' + w[0] + '">' +
          '<b>' + w[1] + '</b><span>' + w[2] + '</span></button>';
      }).join('') + '</div>' +
      '<label class="chk priority' + (state.priority ? ' on' : '') + '"><input type="checkbox" id="prio"' + (state.priority ? ' checked' : '') + ' />' +
      '<span><b>Book within the next 3 days</b><i>Opens up our soonest slots. Adds ' +
      (RULES.surcharge.priorityBp / 100) + '% to the service total.</i></span></label>' +
      (state.priority && state.preferredWindow === 'early-late'
        ? '<p class="hint">Heads up: early/late plus priority is capped at <b>+' + (RULES.surcharge.maxTotalBp / 100) + '%</b> total, not ' +
          ((RULES.surcharge.timeOfDayBp + RULES.surcharge.priorityBp) / 100) + '%.</p>'
        : '');
  }
  function vTiming() {
    if (!state.preferredDays.length) return 'Pick at least one day that works for you.';
    if (!state.preferredWindow) return 'Pick a rough time of day.';
    return null;
  }

  /* ---- step 7: contact ---- */
  function renderContact() {
    var c = state.contact;
    return '<p class="step-sub">We&rsquo;ll confirm your exact time and final price. No spam, ever.</p>' +
      '<div class="field-row">' +
      '<div class="field"><label for="cn">Name <span class="req">*</span></label>' +
      '<input type="text" id="cn" data-c="name" value="' + esc(c.name) + '" autocomplete="name" autofocus /></div>' +
      '<div class="field"><label for="cp">Phone <span class="req">*</span></label>' +
      '<input type="tel" id="cp" data-c="phone" value="' + esc(c.phone) + '" inputmode="tel" autocomplete="tel" /></div>' +
      '</div>' +
      '<div class="field"><label for="ce">Email</label>' +
      '<input type="email" id="ce" data-c="email" value="' + esc(c.email) + '" inputmode="email" autocomplete="email" /></div>' +
      '<div class="field"><label for="cnote">Anything else we should know?</label>' +
      '<textarea id="cnote" data-note="general" rows="3" placeholder="Pet hair, spills, smoke, a tight parking spot&hellip;">' + esc(state.notes) + '</textarea></div>' +
      '<div class="consents">' +
      '<label class="chk sm"><input type="checkbox" id="cTerms"' + (state.consent.terms ? ' checked' : '') + ' />' +
      '<span>I agree to the <a href="privacy.html" target="_blank" rel="noopener">Privacy Policy</a>. I understand a 50% deposit secures the slot, that cancelling within 72 hours forfeits part of it, and that the price may be adjusted on arrival if the vehicle&rsquo;s condition doesn&rsquo;t match the package selected. <span class="req">*</span></span></label>' +
      '<label class="chk sm"><input type="checkbox" id="cSms"' + (state.consent.sms ? ' checked' : '') + ' />' +
      '<span>Text me about my booking. Msg &amp; data rates may apply. Reply STOP to opt out. <span class="req">*</span></span></label>' +
      '<label class="chk sm"><input type="checkbox" id="cMedia"' + (state.consent.media ? ' checked' : '') + ' />' +
      '<span>You may photograph or film my vehicle for social media. We always blur children and any private information such as plates and documents. <i>Optional, leave unticked if you&rsquo;d rather we didn&rsquo;t.</i></span></label>' +
      '</div>';
  }
  function vContact() {
    if (!state.contact.name.trim()) return 'We need your name.';
    if (!state.contact.phone.trim()) return 'We need a phone number to confirm your booking.';
    if (!state.consent.terms) return 'Please accept the booking terms to continue.';
    if (!state.consent.sms) return 'We need permission to text you about your booking.';
    return null;
  }

  /* ---- step 8: review ---- */
  function renderReview() {
    var q = currentQuote();
    return '<p class="step-sub">One last look. Nothing is charged now, we&rsquo;ll confirm your time and send a secure payment link.</p>' +
      '<div class="review">' + lineTable(q, true) + '</div>' +
      '<div class="review-block"><b>Where</b><p>' +
      esc([state.address.line1, state.address.city, state.address.zip].filter(Boolean).join(', ')) +
      (state.noGoodLocation ? '<br /><i>Needs a location sorted: ' + esc(state.locationNote || 'no note given') + '</i>' : '') +
      '</p></div>' +
      '<div class="review-block"><b>When</b><p>' + esc(state.preferredDays.join(', ')) + ' &middot; ' + esc(state.preferredWindow) +
      (state.priority ? '<br /><i>Priority booking, within 3 days</i>' : '') + '</p></div>' +
      '<div class="review-block"><b>You</b><p>' + esc(state.contact.name) + ' &middot; ' + esc(state.contact.phone) +
      (state.contact.email ? ' &middot; ' + esc(state.contact.email) : '') + '</p></div>' +
      (hasShowroom() ? '<p class="hint warn">Showroom Ready is priced after we see the vehicle, so the total above excludes it. We&rsquo;ll come back with a quote.</p>' : '') +
      '<div class="form-msg" id="sendMsg" role="status" aria-live="polite"></div>';
  }

  /* ---------------- summary ---------------- */
  function lineTable(q, full) {
    var rows = q.lines.map(function (l) {
      var cls = l.amountCents < 0 ? ' neg' : '';
      return '<tr class="' + l.kind + cls + '"><td>' + esc(l.label) +
        (l.vehicleIndex !== null && state.vehicles.length > 1 ? ' <i>(vehicle ' + (l.vehicleIndex + 1) + ')</i>' : '') +
        '</td><td>' + $(l.amountCents) + '</td></tr>';
    }).join('');

    var travel = '<tr class="travel pending"><td>Travel<i>, from your address</i></td><td>Quoted on confirmation</td></tr>';
    var total = '<tr class="tot"><td>Service total</td><td>' + $(q.totalCents) + '</td></tr>';
    var dep = full
      ? '<tr class="dep"><td>Deposit to book (50%)</td><td>' + $(q.depositCents) + '</td></tr>' +
        '<tr class="bal"><td>Balance after service</td><td>' + $(q.balanceCents) + '</td></tr>'
      : '';
    var hrs = q.serviceDurationMin ? '<tr class="dur"><td>Estimated time on site</td><td>' + fmtDur(q.serviceDurationMin) + '</td></tr>' : '';

    return '<table class="lines">' + rows + travel + total + dep + hrs + '</table>';
  }

  function renderSummary() {
    var q = currentQuote();
    var html = q.lines.length
      ? lineTable(q, state.step >= 3)
      : '<p class="sum-empty">Pick a package and your price appears here.</p>';
    document.getElementById('summaryBody').innerHTML = html;
    document.getElementById('bbTotal').textContent = $(q.totalCents);
    document.getElementById('bbDetail').innerHTML = html;
  }

  function fmtDur(min) {
    if (!min) return '';
    var h = Math.floor(min / 60), m = min % 60;
    return (h ? h + ' hr' + (h > 1 ? 's' : '') : '') + (m ? (h ? ' ' : '') + m + ' min' : '');
  }

  function startOfToday() {
    var d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  /* ---------------- interaction ---------------- */
  stepEl.addEventListener('click', function (e) {
    var t = e.target.closest('[data-intent],[data-pkg],[data-showroom],[data-hrs],[data-del],[data-edit],[data-day],[data-window],#addVeh');
    if (!t) return;
    var v = state.vehicles[state.active];

    if (t.dataset.intent) {
      v.intent = t.dataset.intent;
      v.packageIds = [];
      v.showroom = false;
    } else if (t.dataset.pkg) {
      v.showroom = false;
      var cat = t.dataset.cat;
      // one package per category, so picking a second interior replaces the first
      v.packageIds = v.packageIds.filter(function (id) { return findPkg(id).category !== cat; });
      if (t.classList.contains('on') === false) v.packageIds.push(t.dataset.pkg);
    } else if (t.dataset.showroom) {
      v.showroom = !v.showroom;
      if (v.showroom) v.packageIds = [];
    } else if (t.dataset.hrs) {
      var a = v.addons.filter(function (x) { return x.id === t.dataset.hrs; })[0];
      if (a) a.hours = Math.max(RULES.addonMinHours, a.hours + Number(t.dataset.d));
    } else if (t.dataset.del) {
      state.vehicles.splice(Number(t.dataset.del), 1);
      state.active = Math.min(state.active, state.vehicles.length - 1);
    } else if (t.dataset.edit) {
      state.active = Number(t.dataset.edit);
      state.step = 0;
    } else if (t.id === 'addVeh') {
      state.vehicles.push(newVehicle());
      state.active = state.vehicles.length - 1;
      state.step = 0;
    } else if (t.dataset.day) {
      var i = state.preferredDays.indexOf(t.dataset.day);
      if (i > -1) state.preferredDays.splice(i, 1); else state.preferredDays.push(t.dataset.day);
    } else if (t.dataset.window) {
      state.preferredWindow = t.dataset.window;
    }
    render();
  });

  stepEl.addEventListener('change', function (e) {
    var t = e.target;
    var v = state.vehicles[state.active];

    if (t.dataset.addon) {
      if (t.checked) {
        var meta = P.ADDONS.filter(function (a) { return a.id === t.dataset.addon; })[0];
        v.addons.push({ id: meta.id, name: meta.name, hours: RULES.addonMinHours });
      } else {
        v.addons = v.addons.filter(function (a) { return a.id !== t.dataset.addon; });
      }
      render();
    } else if (t.id === 'noLoc') {
      state.noGoodLocation = t.checked;
      render();
    } else if (t.id === 'prio') {
      state.priority = t.checked;
      render();
    } else if (t.id === 'cTerms') { state.consent.terms = t.checked; }
    else if (t.id === 'cSms') { state.consent.sms = t.checked; }
    else if (t.id === 'cMedia') { state.consent.media = t.checked; }
  });

  stepEl.addEventListener('input', function (e) {
    var t = e.target, v = state.vehicles[state.active];
    if (t.dataset.addr) state.address[t.dataset.addr] = t.value;
    else if (t.dataset.c) state.contact[t.dataset.c] = t.value;
    else if (t.dataset.label !== undefined) state.vehicles[Number(t.dataset.label)].label = t.value;
    else if (t.dataset.note === 'loc') state.locationNote = t.value;
    else if (t.dataset.note === 'general') state.notes = t.value;
  });

  backBtn.addEventListener('click', function () {
    if (state.step > 0) { state.step--; render(); }
  });

  nextBtn.addEventListener('click', function () {
    var err = STEPS[state.step].valid();
    if (err) { flash(err); return; }
    if (state.step === STEPS.length - 1) { submit(); return; }
    state.step++;
    render();
  });

  function flash(msg) {
    var el = document.createElement('p');
    el.className = 'step-err';
    el.setAttribute('role', 'alert');
    el.textContent = msg;
    var old = stepEl.querySelector('.step-err');
    if (old) old.remove();
    stepEl.appendChild(el);
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  /* ---------------- submit ---------------- */
  function submit() {
    var q = currentQuote();
    var msg = document.getElementById('sendMsg');
    msg.className = 'form-msg ok';
    msg.textContent = 'Sending…';
    nextBtn.disabled = true;

    var lines = q.lines.map(function (l) {
      return '  ' + l.label + (l.vehicleIndex !== null ? ' [vehicle ' + (l.vehicleIndex + 1) + ']' : '') + ': ' + $(l.amountCents);
    }).join('\n');

    var body =
      'BOOKING REQUEST\n\n' +
      'WHO\n  ' + state.contact.name + '\n  ' + state.contact.phone +
      (state.contact.email ? '\n  ' + state.contact.email : '') + '\n\n' +
      'WHERE\n  ' + [state.address.line1, state.address.city, state.address.zip].filter(Boolean).join(', ') + '\n' +
      (state.noGoodLocation ? '  ** NEEDS A LOCATION SORTED **\n  ' + (state.locationNote || '(no note)') + '\n' : '') + '\n' +
      'VEHICLES\n' + state.vehicles.map(function (v, i) {
        var names = v.showroom ? [P.SHOWROOM_READY.name + ' (custom quote)'] : v.packageIds.map(function (id) { return findPkg(id).name; });
        return '  ' + (i + 1) + '. ' + (v.label || '(not given)') + '\n     ' + names.join(' + ') +
          (v.addons.length ? '\n     Add-ons: ' + v.addons.map(function (a) { return a.name + ' (' + a.hours + 'hr)'; }).join(', ') : '');
      }).join('\n') + '\n\n' +
      'WHEN\n  Days: ' + state.preferredDays.join(', ') + '\n  Window: ' + state.preferredWindow +
      (state.priority ? '\n  ** PRIORITY, wants within 3 days (+' + (RULES.surcharge.priorityBp / 100) + '%) **' : '') + '\n\n' +
      'PRICING\n' + lines + '\n' +
      '  Travel: quoted on confirmation\n' +
      '  SERVICE TOTAL: ' + $(q.totalCents) + '\n' +
      '  Deposit (50%): ' + $(q.depositCents) + '\n' +
      '  Balance: ' + $(q.balanceCents) + '\n' +
      '  Est. time on site: ' + fmtDur(q.serviceDurationMin) + '\n' +
      '  Pay-after eligible: ' + (q.payAfterEligible ? 'yes' : 'no') + '\n\n' +
      'CONSENT\n  Terms: yes\n  SMS: yes\n  Media release: ' + (state.consent.media ? 'YES' : 'no') + '\n\n' +
      (state.notes ? 'NOTES\n  ' + state.notes + '\n' : '');

    var fd = new FormData();
    fd.append('access_key', WEB3FORMS_KEY);
    fd.append('subject', 'BOOKING REQUEST, ' + state.contact.name + ', ' + $(q.totalCents));
    fd.append('from_name', '513 Auto Clean Booking Funnel');
    fd.append('name', state.contact.name);
    fd.append('phone', state.contact.phone);
    if (state.contact.email) fd.append('email', state.contact.email);
    fd.append('message', body);

    fetch('https://api.web3forms.com/submit', {
      method: 'POST', body: fd, headers: { Accept: 'application/json' }
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (r) {
        nextBtn.disabled = false;
        if (r.ok && r.j.success) done(q);
        else { msg.className = 'form-msg err'; msg.textContent = 'Something went wrong sending that. Please call or text (513) 279-2915 and we\'ll get you booked.'; }
      })
      .catch(function () {
        nextBtn.disabled = false;
        msg.className = 'form-msg err';
        msg.textContent = 'Network hiccup. Please call or text (513) 279-2915 and we\'ll get you booked.';
      });
  }

  function done(q) {
    document.querySelector('.step-nav').hidden = true;
    document.getElementById('bookBar').hidden = true;
    progressBar.style.width = '100%';
    stepEl.innerHTML =
      '<div class="done"><div class="done-ic">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6L9 17l-5-5"/></svg></div>' +
      '<h1>Request sent, ' + esc(state.contact.name.split(' ')[0]) + '.</h1>' +
      '<p>We&rsquo;ve got your details and we&rsquo;ll confirm your exact time and final price shortly, usually the same day. Your travel fee gets calculated from real drive time and included then.</p>' +
      '<p class="done-tot">Service total <b>' + $(q.totalCents) + '</b> &middot; deposit <b>' + $(q.depositCents) + '</b></p>' +
      '<p class="done-sm">Need it sooner? Call or text <a href="tel:+15132792915">(513) 279-2915</a>.</p>' +
      '<a class="btn btn-ghost" href="index.html">Back to the site</a></div>';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* mobile summary toggle */
  var bbToggle = document.getElementById('bbToggle');
  var bbDetail = document.getElementById('bbDetail');
  bbToggle.addEventListener('click', function () {
    var open = bbDetail.hidden;
    bbDetail.hidden = !open;
    bbToggle.setAttribute('aria-expanded', String(open));
    document.getElementById('bookBar').classList.toggle('open', open);
  });

  render();
})();

/*
 * The gift card page (gift-cards.html): the calculator, the sale's dates, and
 * buying.
 *
 * The build writes the page from config/gift-cards.json (web/scripts/
 * gift-cards.mjs). Prices here come from the pricing bundle (coverTable,
 * saleOn, GIFT_CARDS): the same module and the same setting the build and the
 * checkout use. Outside the sale's dates the page switches itself to full
 * prices by saleOn(), the test gift-checkout.mjs charges by, so what the page
 * shows is what Stripe charges.
 *
 * Buying: the picked value and the gift details go to /api/gift-checkout,
 * which sets the price itself and answers with Stripe's page. Never a price
 * from here.
 */
(function () {
  'use strict';
  var P = window.ACPricing;
  var calc = document.querySelector('.gc-calc');
  if (!calc || !P || !P.coverage || !P.GIFT_CARDS) return;

  var cfg = P.GIFT_CARDS;
  var sale = P.saleOn(cfg, Date.now());
  var pct = cfg.sale.percentOff;
  var input = calc.querySelector('#gcAmt');
  var err = calc.querySelector('.gc-err');
  var out = calc.querySelector('.gc-out');
  var price = calc.querySelector('.gc-calc-price');
  var customBuy = calc.querySelector('[data-gc-buy="custom"]');
  var min = Number(calc.getAttribute('data-gc-min'));
  var max = Number(calc.getAttribute('data-gc-max'));
  var rows = P.coverTable();

  function dollars(cents) {
    return '$' + (cents % 100 ? (cents / 100).toFixed(2) : String(cents / 100));
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }
  function pay(cents) {
    return sale ? Math.round(cents * (100 - pct) / 100) : cents;
  }
  function size() {
    var on = calc.querySelector('input[name="gcSize"]:checked');
    return on ? on.value : 'small';
  }

  // Same markup as gift-cards.mjs priceRow and coverList.
  function priceHtml(cents) {
    var p = pay(cents);
    var lead = '<span class="gc-pay">You pay</span> <strong>' + dollars(p) + '</strong>';
    if (p === cents) return lead;
    return lead + ' <s><span class="sr-only">instead of </span>' + dollars(cents) +
      '</s> <span class="gc-save">Save ' + dollars(cents - p) + '</span>';
  }
  function listHtml(cents) {
    var c = P.coverage(cents, size(), rows);
    var items = c.covered.map(function (r) { return '<li><b>' + esc(r.name) + '</b><em>' + dollars(r.cents) + '</em></li>'; }).join('');
    if (!c.covered.length) items = '<li class="gc-none">Not a full detail yet: it goes toward one, or an add-on</li>';
    var more = c.next ? '<p class="gc-next">' + dollars(c.next.shortCents) + ' more covers ' +
      (/^[AEIOU]/i.test(c.next.name) ? 'an ' : 'a ') + esc(c.next.name) + '</p>' : '';
    return '<ul class="gc-list">' + items + '</ul>' + more;
  }

  /* ---------------- outside the sale's dates: full prices ---------------- */

  if (cfg.mode === 'sale' && !sale) {
    document.querySelectorAll('.gc-off, .gc-sale-only').forEach(function (e) { e.hidden = true; });
    document.querySelectorAll('.gc-tier[data-gc-value]').forEach(function (t) {
      var cents = Number(t.getAttribute('data-gc-value')) * 100;
      var row = t.querySelector('.gc-price');
      if (row) row.innerHTML = priceHtml(cents);
      var b = t.querySelector('[data-gc-buy]');
      if (b) b.textContent = 'Buy for ' + dollars(cents);
    });
  }

  /* ---------------- the calculator ---------------- */

  function amount() {
    var v = Number(input.value);
    return Number.isInteger(v) && v >= min && v <= max ? v : null;
  }
  function update() {
    var v = amount();
    err.hidden = v !== null;
    input.setAttribute('aria-invalid', v === null ? 'true' : 'false');
    // The last good answer stays in place but faded, so the box keeps its
    // height and nothing reads as the price of an amount we can't sell.
    calc.classList.toggle('gc-bad', v === null);
    if (customBuy) customBuy.setAttribute('aria-disabled', v === null ? 'true' : 'false');
    if (v === null) return;
    var cents = v * 100;
    price.innerHTML = priceHtml(cents);
    out.innerHTML = listHtml(cents);
    if (customBuy) customBuy.textContent = 'Buy a ' + dollars(cents) + ' card for ' + dollars(pay(cents));
  }
  input.addEventListener('input', update);
  calc.addEventListener('change', function (e) { if (e.target.name === 'gcSize') update(); });
  if (cfg.mode === 'sale' && !sale) update();

  /* ---------------- buying ---------------- */

  var dlg = document.getElementById('gcBuy');
  var form = document.getElementById('gcBuyForm');
  if (!dlg || !form || typeof dlg.showModal !== 'function') return;
  var $ = function (id) { return document.getElementById(id); };
  var picked = null;
  var requestKey = null;
  var busy = false;

  function today(offsetDays) {
    var d = new Date(Date.now() + (offsetDays || 0) * 86400000);
    var p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
    var get = function (t) { return p.find(function (x) { return x.type === t; }).value; };
    return get('year') + '-' + get('month') + '-' + get('day');
  }
  function key() {
    var a = new Uint8Array(12);
    crypto.getRandomValues(a);
    return 'gc_' + Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }
  function showErr(text) {
    var e = $('gcBuyErr');
    e.textContent = text || '';
    e.hidden = !text;
  }
  function syncWhen() {
    var hasEmail = $('gcToEmail').value.trim() !== '';
    $('gcWhen').hidden = !hasEmail;
    var onDate = hasEmail && form.querySelector('input[name="gcWhen"]:checked').value === 'date';
    $('gcSendOn').hidden = !onDate;
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-gc-buy]');
    if (b && !b.disabled && b.getAttribute('aria-disabled') !== 'true') {
      var v = b.getAttribute('data-gc-buy') === 'custom' ? amount() : Number(b.getAttribute('data-gc-buy'));
      if (!v) return;
      picked = v;
      requestKey = key();
      var cents = v * 100;
      $('gcBuyH').textContent = dollars(cents) + ' gift card';
      $('gcBuySum').textContent = 'You pay ' + dollars(pay(cents)) + (pay(cents) < cents ? ' (' + pct + '% off). ' : '. ') + 'Never expires, no fees.';
      var d = $('gcSendOn');
      d.min = today(0); d.max = today(60);
      if (!d.value) d.value = today(1);
      showErr('');
      syncWhen();
      dlg.showModal();
      return;
    }
    if (e.target.closest && e.target.closest('[data-gc-close]')) dlg.close();
  });
  form.addEventListener('input', syncWhen);
  form.addEventListener('change', syncWhen);

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (busy || !picked) return;
    var email = $('gcToEmail').value.trim();
    var onDate = email && form.querySelector('input[name="gcWhen"]:checked').value === 'date';
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { showErr('Check their email address, or leave it empty to give the card yourself.'); return; }
    var sendOn = onDate ? $('gcSendOn').value : '';
    if (onDate && (!sendOn || sendOn < today(0) || sendOn > today(60))) { showErr('Pick a day between today and two months from now.'); return; }
    busy = true;
    $('gcBuyGo').textContent = 'Opening the payment page…';
    showErr('');
    fetch('/api/gift-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        value: picked,
        to: { name: $('gcToName').value, email: email },
        from: { name: $('gcFromName').value },
        message: $('gcMessage').value,
        sendOn: sendOn,
        requestKey: requestKey,
      }),
    })
      .then(function (r) { return r.json().catch(function () { return {}; }); })
      .then(function (j) {
        if (j.url) { location.href = j.url; return; }
        var words = {
          bad_email: 'Check their email address, or leave it empty to give the card yourself.',
          bad_date: 'Pick a day between today and two months from now.',
          date_needs_email: 'To send it on a date, add their email.',
          bad_details: 'A name or the message is too long.',
          bad_amount: 'Pick an amount from the cards, or one in the calculator.',
          slow_down: 'Too many tries. Please wait a minute.',
        };
        throw new Error(words[j.error] || j.message || 'The payment page didn’t open. Nothing was charged. Please try again.');
      })
      .catch(function (x) {
        showErr(x && x.message && !/fetch|network/i.test(x.message) ? x.message : 'No connection. Nothing was charged. Please try again.');
      })
      .then(function () { busy = false; $('gcBuyGo').textContent = 'Continue to payment'; });
  });
})();

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
  if (!calc || !P || !P.coverage || !P.GIFT_CARDS || !P.dollarsToCents) return;

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

  // Same markup and words as gift-cards.mjs priceRow, buyLabel and coverList.
  function priceHtml(cents) {
    var p = pay(cents);
    if (p === cents) return '<strong>' + dollars(p) + '</strong>';
    return '<span class="gc-pay">You pay</span> <strong>' + dollars(p) + '</strong> <s><span class="sr-only">instead of </span>' + dollars(cents) +
      '</s> <span class="gc-save">Save ' + dollars(cents - p) + '</span>';
  }
  function buyLabel(cents, custom) {
    var p = pay(cents);
    if (custom) return p < cents ? 'Buy a ' + dollars(cents) + ' card for ' + dollars(p) : 'Buy a ' + dollars(cents) + ' card';
    return 'Buy for ' + dollars(p);
  }
  function listHtml(cents) {
    var c = P.coverage(cents, size(), rows);
    var items = c.covered.map(function (r) { return '<li><b>' + esc(r.name) + '</b><em>' + dollars(r.cents) + '</em></li>'; }).join('');
    if (!c.covered.length) items = '<li class="gc-none">Not a full detail yet: it goes toward one, or an add-on</li>';
    var more = c.next ? '<p class="gc-next">' + dollars(c.next.shortCents) + ' more covers ' +
      (/^[AEIOU]/i.test(c.next.name) ? 'an ' : 'a ') + esc(c.next.name) + '</p>' : '';
    return '<ul class="gc-list">' + items + '</ul>' + more;
  }

  /* ---------------- the sale, as of today ----------------
     The build wrote the page for the day it was built (data-gc-built-sale).
     If the sale has started or ended since, put today's prices on it: the
     ones the checkout will charge. */

  var built = calc.getAttribute('data-gc-built-sale') === '1';
  var soon = cfg.mode === 'sale' && !sale && P.cincinnatiDay(Date.now()) < cfg.sale.starts;
  document.querySelectorAll('.gc-off, .gc-sale-only').forEach(function (e) { e.hidden = !sale; });
  document.querySelectorAll('.gc-sale-soon').forEach(function (e) { e.hidden = !soon; });
  document.querySelectorAll('.gc-holiday').forEach(function (e) { e.hidden = !sale && !soon; });
  var ended = P.saleEndedNext ? P.saleEndedNext(cfg, Date.now()) : false;
  document.querySelectorAll('.gc-sale-ended').forEach(function (e) { e.hidden = !ended; });
  if (sale !== built) {
    document.querySelectorAll('.gc-tier[data-gc-value]').forEach(function (t) {
      var cents = Number(t.getAttribute('data-gc-value')) * 100;
      var row = t.querySelector('.gc-price');
      if (row) row.innerHTML = priceHtml(cents);
      var b = t.querySelector('[data-gc-buy]');
      if (b) b.textContent = buyLabel(cents, false);
    });
  }

  /* ---------------- the calculator ---------------- */

  // Any amount to the cent ($119.13, Elijah November 23), as cents; null outside the limits.
  function amountCents() {
    var c = input.value.trim() === '' ? null : P.dollarsToCents(Number(input.value));
    return c !== null && c >= min * 100 && c <= max * 100 ? c : null;
  }
  function update() {
    var cents = amountCents();
    err.hidden = cents !== null;
    input.setAttribute('aria-invalid', cents === null ? 'true' : 'false');
    // The last good answer stays in place but faded, so the box keeps its
    // height and nothing reads as the price of an amount we can't sell.
    calc.classList.toggle('gc-bad', cents === null);
    if (customBuy) customBuy.setAttribute('aria-disabled', cents === null ? 'true' : 'false');
    if (cents === null) return;
    price.innerHTML = priceHtml(cents);
    out.innerHTML = listHtml(cents);
    if (customBuy) customBuy.textContent = buyLabel(cents, true);
    announce(cents);
  }
  // One short sentence for screen readers once typing pauses, not the whole list per keystroke.
  var say = document.getElementById('gcSay');
  var sayTimer = null;
  function announce(cents) {
    if (!say) return;
    clearTimeout(sayTimer);
    sayTimer = setTimeout(function () {
      var c = P.coverage(cents, size(), rows);
      say.textContent = dollars(cents) + ' card, you pay ' + dollars(pay(cents)) + '. ' +
        (c.covered.length ? 'Covers ' + c.covered.map(function (r) { return r.name; }).join(', ') + '.' : 'Not a full detail yet.');
    }, 700);
  }
  input.addEventListener('input', update);
  calc.addEventListener('change', function (e) { if (e.target.name === 'gcSize') update(); });
  if (sale !== built) update();

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
    if (text && e.scrollIntoView) e.scrollIntoView({ block: 'nearest' });
  }
  // The sale is decided by the clock, and midnight can pass while the page is
  // open: if it has turned since the page loaded, show today's prices first
  // (validation pass 3).
  function saleTurned() {
    if (P.saleOn(cfg, Date.now()) === sale) return false;
    location.reload();
    return true;
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
      var cents = b.getAttribute('data-gc-buy') === 'custom' ? amountCents() : Number(b.getAttribute('data-gc-buy')) * 100;
      if (!cents || saleTurned()) return;
      // Sent as dollars to the cent; the checkout prices it again itself.
      picked = cents / 100;
      requestKey = key();
      $('gcBuyH').textContent = dollars(cents) + ' gift card';
      $('gcBuySum').textContent = 'You pay ' + dollars(pay(cents)) + (pay(cents) < cents ? ' (' + pct + '% off). ' : '. ') + 'Good for ' + cfg.expiryYears + ' years, no fees.';
      var d = $('gcSendOn');
      d.min = today(0); d.max = today(cfg.scheduleDays);
      if (!d.value) d.value = today(1);
      var refund = $('gcRefund');
      if (refund) refund.textContent = cfg.refundDays > 0 ? ' Unused cards can be refunded within ' + cfg.refundDays + ' days.' : '';
      showErr('');
      syncWhen();
      dlg.showModal();
      return;
    }
    if (e.target.closest && e.target.closest('[data-gc-close]')) dlg.close();
  });
  // Back from Stripe's page restores this one as it was: a fresh request then.
  window.addEventListener('pageshow', function (e) { if (e.persisted) { requestKey = key(); busy = false; } });
  form.addEventListener('input', syncWhen);
  form.addEventListener('change', syncWhen);

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (busy || !picked || saleTurned()) return;
    var email = $('gcToEmail').value.trim();
    var onDate = email && form.querySelector('input[name="gcWhen"]:checked').value === 'date';
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { showErr('Check their email address, or leave it empty to give the card yourself.'); return; }
    var sendOn = onDate ? $('gcSendOn').value : '';
    if (onDate && (!sendOn || sendOn < today(0) || sendOn > today(cfg.scheduleDays))) { showErr('Pick a day between today and ' + cfg.scheduleDays + ' days from now.'); return; }
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
        // Closed while it was opening: they changed their mind, so stay here.
        if (j.url) { if (dlg.open) location.href = j.url; return; }
        var words = {
          bad_email: 'Check their email address, or leave it empty to give the card yourself.',
          bad_date: 'Pick a day between today and ' + cfg.scheduleDays + ' days from now.',
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

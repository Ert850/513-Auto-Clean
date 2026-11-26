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
 * Buying is one click: the picked value goes to /api/gift-checkout, which
 * sets the price itself and answers with Stripe's page, opened in this tab.
 * Never a price from here. Who the card is for is asked after paying, on the
 * card's own page (gift-certificate.html, js/giftcert.js).
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

  // Same markup and words as gift-cards.mjs calcPriceRow: no struck value, it's in the box above.
  function calcPriceHtml(cents) {
    var p = pay(cents);
    return '<span class="gc-pay">You pay</span> <strong>' + dollars(p) + '</strong>' + (p < cents ? ' <span class="gc-save">Save ' + dollars(cents - p) + '</span>' : '');
  }
  // Same markup and words as gift-cards.mjs buyLabel, buyLine, tierName, coverList and pickRow.
  function buyLabel(cents, custom) {
    var p = pay(cents);
    if (custom) return p < cents ? 'Buy a ' + dollars(cents) + ' card for ' + dollars(p) : 'Buy a ' + dollars(cents) + ' card';
    return p < cents ? 'Buy a ' + dollars(cents) + ' gift card for ' + dollars(p) : 'Buy a ' + dollars(cents) + ' gift card';
  }
  function buyLine(cents) {
    var p = pay(cents);
    return '<span class="gc-buy-line" aria-hidden="true"><span class="gc-buy-for">Buy for</span> ' +
      (p < cents ? '<s class="gc-buy-was">' + dollars(cents) + '</s> ' : '') + '<span class="gc-buy-now">' + dollars(p) + '</span></span>';
  }
  function tierName(cents) {
    var p = pay(cents);
    return p < cents ? dollars(cents) + ' gift card, you pay ' + dollars(p) : dollars(cents) + ' gift card';
  }
  function pickRow(target, inner, what, cents) {
    if (target < min * 100 || target > max * 100) return '<span class="gc-row">' + inner + '</span>';
    return '<button type="button" class="gc-row gc-pick" data-gc-set="' + (target / 100).toFixed(2) + '"' + (target === cents ? ' aria-current="true"' : '') +
      ' aria-label="Make it a ' + dollars(target) + ' card, ' + esc(what) + '">' + inner + '</button>';
  }
  function listHtml(cents) {
    var c = P.coverage(cents, size(), rows);
    var art = function (n) { return /^[AEIOU]/i.test(n) ? 'an ' : 'a '; };
    var items = c.covered.map(function (r) { return '<li>' + pickRow(r.cents, '<b>' + esc(r.name) + '</b><em>' + dollars(r.cents) + '</em>', art(r.name) + r.name, cents) + '</li>'; }).join('');
    if (!c.covered.length) items = '<li class="gc-none">Not a full detail yet: it goes toward one, or an add-on</li>';
    var more = c.next ? '<p class="gc-next">' + pickRow(cents + c.next.shortCents, dollars(c.next.shortCents) + ' more covers ' + art(c.next.name) + esc(c.next.name), art(c.next.name) + c.next.name, cents) + '</p>' : '';
    return '<ul class="gc-list">' + items + '</ul>' + more;
  }

  /* ---------------- the sale, as of today ----------------
     The build wrote the page for the day it was built (data-gc-built-sale).
     If the sale has started or ended since, put today's prices on it: the
     ones the checkout will charge. */

  var built = calc.getAttribute('data-gc-built-sale') === '1';
  var soon = cfg.mode === 'sale' && !sale && P.cincinnatiDay(Date.now()) < cfg.sale.starts;
  document.querySelectorAll('.gc-sale-only').forEach(function (e) { e.hidden = !sale; });
  document.querySelectorAll('.gc-sale-soon').forEach(function (e) { e.hidden = !soon; });
  document.querySelectorAll('.gc-holiday').forEach(function (e) { e.hidden = !sale && !soon; });
  var ended = P.saleEndedNext ? P.saleEndedNext(cfg, Date.now()) : false;
  document.querySelectorAll('.gc-sale-ended').forEach(function (e) { e.hidden = !ended; });
  if (sale !== built) {
    document.querySelectorAll('.gc-tier[data-gc-value]').forEach(function (t) {
      var cents = Number(t.getAttribute('data-gc-value')) * 100;
      var h = t.querySelector('h2');
      if (h) h.textContent = tierName(cents);
      var b = t.querySelector('[data-gc-buy]');
      if (b) { b.innerHTML = buyLine(cents); b.setAttribute('aria-label', buyLabel(cents, false)); }
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
    price.innerHTML = calcPriceHtml(cents);
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
  // A covered row (or the "more covers" line) makes the card that amount; focus
  // stays on the same row once the list is redrawn, or goes to the box.
  out.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-gc-set]');
    if (!b) return;
    var v = b.getAttribute('data-gc-set');
    input.value = v;
    update();
    var same = out.querySelector('[data-gc-set="' + v + '"]');
    (same || input).focus();
  });
  calc.addEventListener('change', function (e) { if (e.target.name === 'gcSize') update(); });
  if (sale !== built) update();

  /* ---------------- buying ----------------
     One click, straight to Stripe in this tab. The clicked button says it's
     opening, and anything that goes wrong is said on one line beside it. */

  var requestKey = null;
  var busy = null;
  var saved = null;
  var errLine = document.createElement('p');
  errLine.className = 'gc-buy-err';
  errLine.setAttribute('role', 'alert');
  errLine.hidden = true;

  function key() {
    var a = new Uint8Array(12);
    crypto.getRandomValues(a);
    return 'gc_' + Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }
  function showErr(b, text) {
    if (text && b) b.parentNode.insertBefore(errLine, b.nextSibling);
    errLine.textContent = text || '';
    errLine.hidden = !text;
  }
  // The button's own words and label come back as they were.
  function setBusy(b) {
    saved = { html: b.innerHTML, label: b.getAttribute('aria-label') };
    busy = b;
    b.textContent = 'Opening the payment page…';
    b.removeAttribute('aria-label');
    b.setAttribute('aria-busy', 'true');
  }
  function unbusy() {
    var b = busy;
    if (!b) return;
    busy = null;
    b.innerHTML = saved.html;
    if (saved.label) b.setAttribute('aria-label', saved.label);
    b.removeAttribute('aria-busy');
    // Typed into while it was opening: say today's amount.
    if (b === customBuy) update();
  }
  // The sale is decided by the clock, and midnight can pass while the page is
  // open: if it has turned since the page loaded, show today's prices first
  // (validation pass 3).
  function saleTurned() {
    if (P.saleOn(cfg, Date.now()) === sale) return false;
    location.reload();
    return true;
  }
  var words = {
    bad_amount: 'Pick an amount from the cards, or one in the calculator.',
    slow_down: 'Too many tries. Please wait a minute.',
  };

  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-gc-buy]');
    if (!b || b.disabled || b.getAttribute('aria-disabled') === 'true') return;
    // One at a time: a double tap opens one payment page.
    if (busy) return;
    var cents = b.getAttribute('data-gc-buy') === 'custom' ? amountCents() : Number(b.getAttribute('data-gc-buy')) * 100;
    if (!cents || saleTurned()) return;
    requestKey = key();
    showErr(null, '');
    setBusy(b);
    fetch('/api/gift-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Sent as dollars to the cent; the checkout prices it again itself.
      body: JSON.stringify({ value: cents / 100, requestKey: requestKey }),
    })
      .then(function (r) { return r.json().catch(function () { return {}; }); })
      .then(function (j) {
        // Leaving for Stripe: the button keeps saying so until the page goes.
        if (j.url) {
          try { location.assign(j.url); return; } catch (e) { /* a refused address: said below, and the button comes back */ }
        }
        var x = new Error(words[j.error] || j.message || 'The payment page didn’t open. Nothing was charged. Please try again.');
        x.ours = true;
        throw x;
      })
      .catch(function (x) {
        unbusy();
        showErr(b, x && x.ours ? x.message : 'No connection. Nothing was charged. Please try again.');
      });
  });
  // Back from Stripe's page restores this one as it was: the button usable again, a fresh request.
  window.addEventListener('pageshow', function (e) { if (e.persisted) { requestKey = key(); unbusy(); } });
})();

/*
 * The gift card page's calculator (gift-cards.html). The build writes its first
 * state (web/scripts/gift-cards.mjs coverList); this keeps it up to date as the
 * amount or the vehicle changes. The prices come from the pricing bundle's
 * coverTable(), the same module the build used, so the two never disagree.
 *
 * The buy buttons are disabled until the checkout exists
 * (config/gift-cards.json checkout.enabled).
 */
(function () {
  'use strict';
  var calc = document.querySelector('.gc-calc');
  var P = window.ACPricing;
  if (!calc || !P || !P.coverage) return;

  var input = calc.querySelector('#gcAmt');
  var err = calc.querySelector('.gc-err');
  var out = calc.querySelector('.gc-out');
  var price = calc.querySelector('.gc-calc-price');
  var buy = calc.querySelector('[data-gc-buy="custom"]');
  var sale = calc.getAttribute('data-gc-mode') === 'sale';
  var pct = Number(calc.getAttribute('data-gc-pct'));
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
    if (p === cents) return '<strong>' + dollars(p) + '</strong>';
    return '<strong>' + dollars(p) + '</strong> <s><span class="sr-only">instead of </span>' + dollars(cents) +
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

  function update() {
    var v = Number(input.value);
    var ok = Number.isInteger(v) && v >= min && v <= max;
    err.hidden = ok;
    input.setAttribute('aria-invalid', ok ? 'false' : 'true');
    // The last good answer stays in place but faded, so the box keeps its
    // height and nothing reads as the price of an amount we can't sell.
    calc.classList.toggle('gc-bad', !ok);
    if (!ok) {
      if (buy) buy.setAttribute('aria-disabled', 'true');
      return;
    }
    if (buy) buy.removeAttribute('aria-disabled');
    var cents = v * 100;
    price.innerHTML = priceHtml(cents);
    out.innerHTML = listHtml(cents);
    if (buy) buy.textContent = 'Buy a ' + dollars(cents) + ' card for ' + dollars(pay(cents));
  }

  input.addEventListener('input', update);
  calc.addEventListener('change', function (e) { if (e.target.name === 'gcSize') update(); });
})();

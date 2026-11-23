/*
 * Elijah's gift card tool (gift-admin.html, netlify/functions/gift-admin.mjs).
 * Every change asks to be tapped twice, and carries its own request id, so a
 * double tap or a retry takes an amount off once.
 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  // The key is never stored by the page: any script on the site could read
  // browser storage (validation pass 1). The phone's password manager can fill it.
  var keyIn = $('gcaKey'), codeIn = $('gcaCode'), msg = $('gcaMsg');
  var current = null;
  var armed = null;
  try { localStorage.removeItem('ac-gift-admin-key'); } catch (e) { /* private mode */ }

  function dollars(c) { return '$' + (c % 100 ? (c / 100).toFixed(2) : String(c / 100)); }
  function rid() {
    var a = new Uint8Array(12);
    crypto.getRandomValues(a);
    return Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }
  var WORDS = {
    wrong_key: 'That key isn’t right.',
    not_found: 'No card with that code. A card bought in the last minute can take a minute to show up.',
    bad_code: 'That doesn’t look like a card code: 513 and twelve letters or numbers.',
    too_much: 'That’s more than is left on the card.',
    not_active: 'This card is used, cancelled or on hold.',
    no_address: 'There’s no email address for that.',
    email_failed: 'The email didn’t send. Try again in a minute.',
    slow_down: 'Too many tries. Wait a minute.',
    unconfigured: 'Gift cards aren’t set up on the site yet.',
  };

  function call(body) {
    msg.textContent = 'Working…';
    body.key = keyIn.value;
    body.code = codeIn.value;
    return fetch('/api/gift-admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return {}; }); })
      .then(function (j) {
        if (j.card) show(j.card);
        // After a failure the next tap is a new request, not a replay of the failed one.
        if (j.error) disarm();
        msg.textContent = j.error ? (WORDS[j.error] || 'That didn’t work (' + j.error + ').') : j.repeated ? 'Already done: nothing was changed twice.' : '';
        return j;
      })
      .catch(function () { msg.textContent = 'No connection. Try again.'; return {}; });
  }

  function show(c) {
    current = c;
    $('gcaCard').hidden = false;
    $('gcaTitle').textContent = dollars(c.valueCents) + ' card, ending ' + c.last4;
    var facts = [
      ['Left on it', dollars(c.balanceCents)],
      ['Status', { active: 'Active', used: 'Used in full', void: 'Cancelled', disputed: 'On hold: payment disputed' }[c.status] || c.status],
      ['For', [c.toName, c.toEmail].filter(Boolean).join(', ') || '(the buyer)'],
      ['From', c.fromName || ''],
      ['Bought', c.issued || ''],
      ['Paid', c.percentOff ? c.percentOff + '% off' : 'full price'],
    ];
    var dl = $('gcaFacts');
    dl.textContent = '';
    facts.forEach(function (f) {
      var dt = document.createElement('dt'); dt.textContent = f[0];
      var dd = document.createElement('dd'); dd.textContent = f[1];
      dl.appendChild(dt); dl.appendChild(dd);
    });
    var ul = $('gcaLog');
    ul.textContent = '';
    (c.log || '').split('; ').filter(Boolean).reverse().forEach(function (line) {
      var li = document.createElement('li'); li.textContent = line; ul.appendChild(li);
    });
    $('gcaRedeem').hidden = c.status !== 'active';
    disarm();
  }

  function disarm() {
    armed = null;
    $('gcaRedeemBtn').textContent = 'Take it off the card';
    document.querySelectorAll('[data-gca]').forEach(function (b) { b.textContent = b.getAttribute('data-label') || b.textContent; });
  }
  document.querySelectorAll('[data-gca]').forEach(function (b) { b.setAttribute('data-label', b.textContent); });

  $('gcaFind').addEventListener('submit', function (e) {
    e.preventDefault();
    call({ action: 'lookup' });
  });

  $('gcaRedeem').addEventListener('submit', function (e) {
    e.preventDefault();
    var cents = Math.round(Number($('gcaAmt').value) * 100);
    if (!(cents > 0)) { msg.textContent = 'Enter the amount to take off.'; return; }
    var id = 'redeem:' + cents;
    if (!armed || armed.what !== id) {
      armed = { what: id, rid: rid() };
      $('gcaRedeemBtn').textContent = 'Tap again to take ' + dollars(cents) + ' off';
      return;
    }
    call({ action: 'redeem', amountCents: cents, note: $('gcaNote').value, requestId: armed.rid })
      // A refusal (409) still sends the card back: only no error means it was taken off (validation pass 2).
      .then(function (j) { if (j.card && !j.error) { $('gcaAmt').value = ''; $('gcaNote').value = ''; msg.textContent = dollars(cents) + ' taken off. ' + dollars(j.card.balanceCents) + ' left.'; } });
  });

  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-gca]');
    if (!b || !current) return;
    var what = b.getAttribute('data-gca');
    if (!armed || armed.what !== what) {
      disarm();
      armed = { what: what, rid: rid() };
      b.textContent = 'Tap again to confirm';
      return;
    }
    var body = what === 'void' ? { action: 'void' } : { action: 'resend', to: what === 'resend-recipient' ? 'recipient' : 'buyer' };
    body.requestId = armed.rid;
    call(body).then(function (j) { if (j.card && !j.error) msg.textContent = what === 'void' ? 'Card cancelled.' : 'Sent.'; });
  });
})();

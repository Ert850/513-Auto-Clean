/*
 * One gift card (gift-certificate.html). The card's session id arrives after
 * the # (#s=<session>, from Stripe's return or a card email), is kept for this
 * tab and taken out of the address bar at once, so analytics and recordings
 * never see it: the session is what opens the card.
 *
 * Every word from the card goes in as text, never as HTML.
 *
 * "Send it to someone": buying is one click, so who the card is for is asked
 * here, after paying. Shown only while the server says it can still be sent
 * (canSend: once, to one person, within the setting's hours), and sent to
 * /api/gift-send, which checks all of that again.
 */
(function () {
  'use strict';
  var box = document.getElementById('gcCert');
  if (!box) return;
  var actions = document.getElementById('gcCertActions');
  var how = document.getElementById('gcCertHow');
  var thanks = document.getElementById('gcThanks');
  var KEY = 'ac-gift-session';
  var SESSION = /^cs_(test|live)_[A-Za-z0-9]{10,200}$/;
  var isNew = false;

  function store(get, val) {
    try { return get ? sessionStorage.getItem(KEY) : sessionStorage.setItem(KEY, val); } catch (e) { return null; }
  }
  var params = new URLSearchParams(location.hash.slice(1) || location.search.slice(1));
  var s = params.get('s');
  if (s && SESSION.test(s)) {
    store(false, s);
    // Shown once the card has loaded, not while the payment may still be going through.
    isNew = params.get('new') === '1';
    try { history.replaceState(null, '', location.pathname); } catch (e) { /* the address keeps it; harmless */ }
  } else {
    s = store(true);
  }

  function dollars(cents) {
    return '$' + (cents % 100 ? (cents / 100).toFixed(2) : String(cents / 100));
  }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function say(msg) {
    box.textContent = '';
    box.appendChild(el('p', 'gc-cert-msg', msg));
  }
  function longDay(iso) {
    return new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
  }
  function longDate(iso) {
    return new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  }

  /* The QR code Elijah scans when the card pays for a detail: his phone's
     camera opens /gift-admin with this card's code filled in (after the #, so
     it never reaches a server). Someone else scanning it lands on a page that
     needs his key. Drawn only for a card that can still be used. */
  function qrBlock(code) {
    if (typeof window.qrcode !== 'function') return null;
    var qr = window.qrcode(0, 'M');
    qr.addData(location.origin + '/gift-admin#c=' + code);
    qr.make();
    var wrap = el('div', 'gc-cert-qr');
    var pic = el('div', 'gc-cert-qr-img');
    pic.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 16, scalable: true, alt: 'QR code for this gift card' });
    wrap.appendChild(pic);
    var words = el('div', 'gc-cert-qr-text');
    words.appendChild(el('b', '', 'Show this when you pay'));
    words.appendChild(el('span', '', 'We scan it and take the card off your total, after tax.'));
    wrap.appendChild(words);
    return wrap;
  }

  var shown = null;
  var shownFace = null;
  // "For Sam, from Alex" and the message on the card's face: drawn again after a send, without a reload.
  function drawTo(c, face) {
    face.querySelectorAll('.gc-face-to, .gc-face-msg').forEach(function (e) { e.remove(); });
    if (c.toName || c.fromName) {
      face.appendChild(el('span', 'gc-face-to', (c.toName ? 'For ' + c.toName : '') + (c.toName && c.fromName ? ', from ' : c.fromName ? 'From ' : '') + (c.fromName || '')));
    }
    if (c.message) face.appendChild(el('span', 'gc-face-msg', '“' + c.message + '”'));
  }

  function draw(c) {
    box.textContent = '';
    var face = el('div', 'gc-face gc-face-big');
    shown = c;
    shownFace = face;
    var brand = el('span', 'gc-face-brand');
    var mark = el('img', 'gc-face-mark');
    mark.src = 'images/logo-mark.png'; mark.alt = ''; mark.width = 20; mark.height = 26;
    brand.appendChild(mark);
    brand.appendChild(document.createTextNode('513 Auto Clean'));
    face.appendChild(brand);
    face.appendChild(el('span', 'gc-face-value', dollars(c.valueCents)));
    face.appendChild(el('span', 'gc-face-label', 'Gift card'));
    face.appendChild(el('span', 'gc-face-code', c.code));
    if (c.expires) face.appendChild(el('span', 'gc-face-exp', 'Good through ' + longDate(c.expires)));
    drawTo(c, face);
    box.appendChild(face);

    var state = null;
    if (c.expired) state = 'This card expired on ' + longDate(c.expires) + '.';
    else if (c.status === 'void') state = 'This card has been cancelled.';
    else if (c.status === 'disputed') state = 'This card is on hold. Please contact us.';
    else if (c.status === 'used' || c.balanceCents === 0) state = 'This card has been used in full.';
    else if (c.balanceCents < c.valueCents) state = dollars(c.balanceCents) + ' left on this card.';
    if (state) box.appendChild(el('p', 'gc-cert-state', state));
    var usable = !c.expired && c.status === 'active' && c.balanceCents > 0;
    var qr = usable ? qrBlock(c.code) : null;
    if (qr) box.appendChild(qr);
    if (c.sendOn) box.appendChild(el('p', 'gc-cert-note', 'We’ll email it to ' + (c.toName || 'them') + ' on ' + longDay(c.sendOn) + '.'));
    actions.hidden = false;
    how.hidden = false;
    if (c.canSend) openSend();
    if (isNew && thanks) thanks.hidden = false;
  }

  /* ---------------- send it to someone ---------------- */

  var send = document.getElementById('gcSend');
  var form = document.getElementById('gcSendForm');
  var $ = function (id) { return document.getElementById(id); };
  var requestKey = null;
  var sending = false;
  var P = window.ACPricing;
  // How far ahead a day can be picked: the setting, through the pricing bundle (the server checks it too).
  var aheadDays = P && P.GIFT_CARDS ? P.GIFT_CARDS.scheduleDays : 0;

  function today(offsetDays) {
    var d = new Date(Date.now() + (offsetDays || 0) * 86400000);
    var p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
    var get = function (t) { return p.find(function (x) { return x.type === t; }).value; };
    return get('year') + '-' + get('month') + '-' + get('day');
  }
  function key() {
    var a = new Uint8Array(12);
    crypto.getRandomValues(a);
    return 'gs_' + Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }
  function sendErr(text) {
    var e = $('gcSendErr');
    e.textContent = text || '';
    e.hidden = !text;
  }
  function onDate() {
    return form.querySelector('input[name="gcWhen"]:checked').value === 'date';
  }
  function syncWhen() { $('gcSendOn').hidden = !onDate(); }
  function dayWords() {
    return aheadDays ? 'Pick a day between today and ' + aheadDays + ' days from now.' : 'Pick a day from today on.';
  }

  function openSend() {
    if (!send || !form) return;
    var d = $('gcSendOn');
    d.min = today(0);
    if (aheadDays) d.max = today(aheadDays);
    if (!d.value) d.value = today(1);
    requestKey = key();
    syncWhen();
    send.hidden = false;
    var link = $('gcThanksSend');
    if (link) link.hidden = false;
    // One red button on the screen: Print steps back while the form's Email the card is there.
    var print = $('gcPrint');
    if (print) print.className = print.className.replace('btn-primary', 'btn-ghost');
  }

  // Replaces the form once it's done: who it went to, and when, with a way to
  // fix a typo (Contact us: Elijah resends from /gift-admin). The card's face
  // says who it's for at once, and Print is the red button again.
  function sent(j) {
    var to = j.to || $('gcToEmail').value.trim();
    var words = j.sendOn ? 'We’ll email it to ' + to + ' on ' + longDay(j.sendOn) + '.'
      : j.retrying ? 'It’s on its way to ' + to + '. If it can’t go right now, we try again each hour' + (j.hours ? ' from ' + j.hours + ', Cincinnati time' : '') + '.'
      : 'Sent to ' + to + '.';
    if (shown && shownFace) {
      shown.toName = $('gcToName').value.trim();
      shown.fromName = $('gcFromName').value.trim();
      shown.message = $('gcMessage').value.trim();
      drawTo(shown, shownFace);
    }
    $('gcSendSub').remove();
    var done = el('p', 'gc-send-done', words + ' ');
    var fix = el('span', 'gc-send-fix', 'Wrong address? ');
    var a = el('a', '', 'Contact us');
    a.href = 'contact.html';
    fix.appendChild(a);
    fix.appendChild(document.createTextNode('.'));
    done.appendChild(fix);
    form.replaceWith(done);
    var link = $('gcThanksSend');
    if (link) link.hidden = true;
    var print = $('gcPrint');
    if (print) print.className = print.className.replace('btn-ghost', 'btn-primary');
  }

  if (form) {
    form.addEventListener('change', syncWhen);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (sending || !s) return;
      var email = $('gcToEmail').value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { sendErr(email ? 'Check their email address.' : 'Add their email address.'); $('gcToEmail').focus(); return; }
      var sendOn = onDate() ? $('gcSendOn').value : '';
      if (onDate() && (!sendOn || sendOn < today(0) || (aheadDays && sendOn > today(aheadDays)))) { sendErr(dayWords()); $('gcSendOn').focus(); return; }
      sending = true;
      sendErr('');
      var go = $('gcSendGo');
      go.textContent = 'Sending…';
      go.setAttribute('aria-busy', 'true');
      attempt(email, sendOn, go, 0);
    });
  }

  // "busy": the same request is still being written on the server (a double
  // tap). Asked again in a moment with the same key, which answers with what
  // that first one did, never a second email.
  function attempt(email, sendOn, go, n) {
    fetch('/api/gift-send', {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      // In the body, never the address: the session opens the card.
      body: JSON.stringify({
        s: s,
        to: { name: $('gcToName').value, email: email },
        from: { name: $('gcFromName').value },
        message: $('gcMessage').value,
        sendOn: sendOn,
        requestKey: requestKey,
      }),
    })
      .then(function (r) { return r.json().catch(function () { return {}; }); })
      .then(function (j) {
        if (j.ok) { sent(j); return; }
        if (j.error === 'busy' && n < 5) { setTimeout(function () { attempt(email, sendOn, go, n + 1); }, 1500); return 'again'; }
        var words = {
          bad_email: 'Check their email address.',
          need_email: 'Add their email address.',
          bad_date: dayWords(),
          date_needs_email: 'Add their email address.',
          bad_details: 'A name or the message is too long.',
          already_sent: 'This card has already been sent. Print it or share the link instead.',
          too_late: 'This card can’t be emailed from here any more. Print it or share the link instead.',
          expired: 'This card has expired.',
          not_active: 'This card can’t be sent. Please contact us.',
          not_paid: 'Your payment is still going through. Please try again in a minute.',
          slow_down: 'Too many tries. Please wait a minute.',
        };
        // Trying again sends the same request: it can't make a second email.
        var x = new Error(words[j.error] || 'We couldn’t confirm it just now. Please try again.');
        x.ours = true;
        throw x;
      })
      .catch(function (x) {
        sendErr(x && x.ours ? x.message : 'No connection. Please try again.');
      })
      .then(function (again) {
        if (again === 'again') return;
        sending = false;
        if (document.body.contains(go)) { go.textContent = 'Email the card'; go.removeAttribute('aria-busy'); }
      });
  }

  var tries = 0;
  function load() {
    if (!s) { say('We couldn’t find a gift card here. Open the link in your gift card email, or contact us and we’ll resend it.'); return; }
    // In the body, never the address: the session opens the card.
    fetch('/api/gift-card', { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ s: s }) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { status: r.status, j: j }; }); })
      .then(function (r) {
        if (r.status === 200) return draw(r.j);
        if (r.status === 202 && tries++ < 20) {
          say('Your payment is still going through. This page will update by itself.');
          return setTimeout(load, 3000);
        }
        if (r.status === 404) return say('We couldn’t find that gift card. Open the link in your gift card email, or contact us and we’ll resend it.');
        say('We couldn’t load the card just now. Please refresh in a minute; it’s also in your email.');
      })
      .catch(function () { say('We couldn’t load the card just now. Please refresh in a minute; it’s also in your email.'); });
  }
  load();
  // Another card's link opened in this tab changes only the part after the #: load that card.
  window.addEventListener('hashchange', function () { if (/[#&]s=cs_/.test(location.hash)) location.reload(); });

  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-gc-print],[data-gc-share]');
    if (!t) return;
    if (t.hasAttribute('data-gc-print')) { window.print(); return; }
    var url = location.origin + location.pathname + '#s=' + encodeURIComponent(s);
    if (navigator.share) {
      navigator.share({ title: '513 Auto Clean gift card', url: url }).catch(function () {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(function () { t.textContent = 'Link copied'; }, function () {});
    }
  });
})();

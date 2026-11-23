/*
 * One gift card (gift-certificate.html). The card's session id arrives after
 * the # (#s=<session>, from Stripe's return or a card email), is kept for this
 * tab and taken out of the address bar at once, so analytics and recordings
 * never see it: the session is what opens the card.
 *
 * Every word from the card goes in as text, never as HTML.
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

  function draw(c) {
    box.textContent = '';
    var face = el('div', 'gc-face gc-face-big');
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
    if (c.toName || c.fromName) {
      face.appendChild(el('span', 'gc-face-to', (c.toName ? 'For ' + c.toName : '') + (c.toName && c.fromName ? ', from ' : c.fromName ? 'From ' : '') + (c.fromName || '')));
    }
    if (c.message) face.appendChild(el('span', 'gc-face-msg', '“' + c.message + '”'));
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
    if (isNew && thanks) thanks.hidden = false;
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

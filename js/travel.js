/* ============================================================
   Front page travel estimator.
   Uses the same mileage ladder as the booking funnel and the payment
   functions, so the number quoted here cannot drift from the one charged.
   ============================================================ */
(function () {
  'use strict';

  var P = window.ACPricing;
  var input = document.getElementById('zipEst');
  var go = document.getElementById('zipGo');
  var out = document.getElementById('zipOut');
  if (!P || !input || !go || !out) return;

  var $ = P.formatCents;

  function estimate() {
    var hit = P.lookupZip(input.value);
    if (!hit) {
      out.className = 'travel-out err';
      out.textContent = 'That does not look like a ZIP we cover. Try another, or ask us and we will check.';
      return;
    }

    var lo = P.mileageFeeCents(hit.minMin, P.RULES.mileage);
    var hi = P.mileageFeeCents(hit.maxMin, P.RULES.mileage);

    out.className = 'travel-out ok';

    if (hi === 0) {
      out.innerHTML = '<b>No travel fee</b><span>' + esc(hit.area) +
        ' is inside our free radius, about ' + hit.minMin + ' to ' + hit.maxMin + ' minutes out.</span>';
      return;
    }

    var range = lo === hi ? $(hi) : $(lo) + ' to ' + $(hi);
    out.innerHTML =
      '<b>' + range + '</b>' +
      '<span>' + esc(hit.area) + ', roughly ' + hit.minMin + ' to ' + hit.maxMin + ' minutes from us. ' +
      (lo === 0 ? 'Closer parts of this ZIP fall inside the free radius. ' : '') +
      'Your exact fee comes from your address when you book.</span>' +
      (hit.found ? '' : '<span class="travel-approx">We do not have this ZIP mapped precisely yet, so this is a wider guess than usual.</span>');
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  go.addEventListener('click', estimate);
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); estimate(); }
  });
  input.addEventListener('input', function () {
    // Estimate as soon as a full ZIP is typed; no reason to make them tap.
    if (/^\d{5}$/.test(input.value.trim())) estimate();
    else out.textContent = '';
  });
})();

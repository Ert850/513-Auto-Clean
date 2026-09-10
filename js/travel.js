/* ============================================================
   Front page travel map.

   Shows the whole service area priced at a glance, rather than making
   someone type a ZIP to find out one number. Uses the same mileage ladder
   as the booking funnel and the payment functions, so nothing shown here
   can drift from what actually gets charged.

   The map is drawn from approximate ZIP centre points and is a schematic,
   not a street map. It is built in JS and revealed only on success, so a
   browser that cannot draw it is left with the ZIP lookup underneath
   rather than an empty box.
   ============================================================ */
(function () {
  'use strict';

  var P = window.ACPricing;
  var input = document.getElementById('zipEst');
  var go = document.getElementById('zipGo');
  var out = document.getElementById('zipOut');
  if (!P || !input || !go || !out) return;

  var $ = P.formatCents;
  var BASE_ZIP = '45220';

  /* ---------- fee bands ---------- */

  // Ordered low to high. `max` is the top fee in cents that lands in the band.
  //
  // Thresholds are set so every band actually holds ZIPs. Wider bands would
  // paint most of the map one colour, which is the same as not colouring it.
  // Labels say "about" because a band is keyed on the middle of a ZIP while
  // the readout gives that ZIP's full range.
  var BANDS = [
    { id: 0, max: 0, label: 'No travel fee' },
    { id: 1, max: 1000, label: 'About $5 to $10' },
    { id: 2, max: 2000, label: 'About $15 to $20' },
    { id: 3, max: 3500, label: 'About $25 to $35' },
    { id: 4, max: Infinity, label: 'About $45 and up' }
  ];

  function feeCents(min) {
    return P.mileageFeeCents(min, P.RULES.mileage);
  }

  function bandOf(cents) {
    for (var i = 0; i < BANDS.length; i++) {
      if (cents <= BANDS[i].max) return BANDS[i].id;
    }
    return BANDS.length - 1;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* ---------- readout, shared by the map and the ZIP box ---------- */

  function describe(zip) {
    var hit = P.lookupZip(zip);
    if (!hit) return null;
    var lo = feeCents(hit.minMin);
    var hi = feeCents(hit.maxMin);
    return {
      zip: zip,
      area: hit.area,
      found: hit.found,
      minMin: hit.minMin,
      maxMin: hit.maxMin,
      loCents: lo,
      hiCents: hi,
      range: hi === 0 ? 'No travel fee' : lo === hi ? $(hi) : $(lo) + ' to ' + $(hi)
    };
  }

  function showReadout(zip) {
    var d = describe(zip);
    if (!d) {
      out.className = 'travel-out err';
      out.textContent = 'That does not look like a ZIP we cover. Try another, or ask us and we will check.';
      return;
    }

    out.className = 'travel-out ok';

    if (d.hiCents === 0) {
      out.innerHTML = '<b>No travel fee</b><span>' + esc(d.area) + ' (' + esc(d.zip) + ') is inside our free radius, about ' +
        d.minMin + ' to ' + d.maxMin + ' minutes out.</span>';
      return;
    }

    out.innerHTML =
      '<b>' + esc(d.range) + '</b>' +
      '<span>' + esc(d.area) + ' (' + esc(d.zip) + '), roughly ' + d.minMin + ' to ' + d.maxMin + ' minutes from us. ' +
      (d.loCents === 0 ? 'Closer parts of this ZIP fall inside the free radius. ' : '') +
      'Your exact fee comes from your address when you book.</span>' +
      (d.found ? '' : '<span class="travel-approx">We do not have this ZIP mapped precisely yet, so this is a wider guess than usual.</span>');
  }

  /* ---------- the map ---------- */

  var host = document.getElementById('zipMap');
  var canvas = document.getElementById('zipMapSvg');
  var legend = document.getElementById('zipLegend');
  var selected = '';

  // Areas printed on the map so it reads as a map rather than a scatter of
  // dots. Chosen for spread, not importance, so the labels do not collide.
  var ANCHORS = {
    '45202': 'Downtown',
    '45242': 'Blue Ash',
    '45069': 'West Chester',
    '45011': 'Hamilton',
    '45044': 'Middletown',
    '45040': 'Mason',
    '45140': 'Loveland',
    '45230': 'Anderson',
    '45238': 'Delhi',
    '45030': 'Harrison',
    '47025': 'Lawrenceburg',
    '41042': 'Florence',
    '41071': 'Newport'
  };

  function buildMap() {
    if (!host || !canvas || !P.ZIP_GEO || !P.ZIP_GEO.length) return false;

    var W = 1000, PAD = 46;

    // Equirectangular, which is fine over sixty miles: longitude degrees are
    // squeezed by the cosine of the latitude so the shape does not stretch.
    var k = Math.cos((39.15 * Math.PI) / 180);

    var pts = [];
    var i, g, d;
    for (i = 0; i < P.ZIP_GEO.length; i++) {
      g = P.ZIP_GEO[i];
      d = describe(g.zip);
      if (!d) continue;
      pts.push({
        zip: g.zip, area: d.area, range: d.range,
        minMin: d.minMin, maxMin: d.maxMin,
        band: bandOf(feeCents(Math.round((d.minMin + d.maxMin) / 2))),
        mid: Math.round((d.minMin + d.maxMin) / 2),
        px: g.lon * k, py: -g.lat
      });
    }
    if (pts.length < 10) return false;

    var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    pts.forEach(function (p) {
      if (p.px < minX) minX = p.px;
      if (p.px > maxX) maxX = p.px;
      if (p.py < minY) minY = p.py;
      if (p.py > maxY) maxY = p.py;
    });

    var scale = (W - PAD * 2) / (maxX - minX);
    var H = Math.round((maxY - minY) * scale + PAD * 2);

    pts.forEach(function (p) {
      p.x = PAD + (p.px - minX) * scale;
      p.y = PAD + (p.py - minY) * scale;
    });

    var base = pts.filter(function (p) { return p.zip === BASE_ZIP; })[0] || pts[0];

    // Faint drive-time rings, sized from the ZIPs that actually sit at each
    // drive time rather than from a guess about miles per minute.
    var rings = [15, 30, 45].map(function (target) {
      var near = pts.filter(function (p) { return Math.abs(p.mid - target) <= 4; });
      if (near.length < 2) return null;
      var sum = near.reduce(function (t, p) {
        return t + Math.sqrt(Math.pow(p.x - base.x, 2) + Math.pow(p.y - base.y, 2));
      }, 0);
      return { r: sum / near.length, label: target + ' min' };
    }).filter(Boolean);

    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" ' +
      'aria-label="Map of the Cincinnati area showing the travel fee for each ZIP code. The same figures are available by entering a ZIP below." ' +
      'preserveAspectRatio="xMidYMid meet">';

    rings.forEach(function (r) {
      svg += '<circle class="tmap-ring" cx="' + base.x.toFixed(1) + '" cy="' + base.y.toFixed(1) +
        '" r="' + r.r.toFixed(1) + '"/>' +
        '<text class="tmap-ringlab" x="' + base.x.toFixed(1) + '" y="' + (base.y - r.r + 13).toFixed(1) +
        '">' + r.label + '</text>';
    });

    // Dots low to high so the expensive edges never hide the free centre.
    pts.slice().sort(function (a, b) { return b.band - a.band; }).forEach(function (p) {
      svg += '<circle class="tmap-dot tz-' + p.band + '" data-zip="' + p.zip + '" ' +
        'cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="8">' +
        '<title>' + esc(p.area) + ' ' + p.zip + ': ' + esc(p.range) + '</title></circle>';
    });

    Object.keys(ANCHORS).forEach(function (zip) {
      var p = pts.filter(function (q) { return q.zip === zip; })[0];
      if (!p) return;
      var left = p.x < base.x;
      svg += '<text class="tmap-lab" text-anchor="' + (left ? 'end' : 'start') + '" ' +
        'x="' + (p.x + (left ? -13 : 13)).toFixed(1) + '" y="' + (p.y + 4).toFixed(1) + '">' +
        esc(ANCHORS[zip]) + '</text>';
    });

    svg += '<g class="tmap-base"><circle class="tmap-basering" cx="' + base.x.toFixed(1) +
      '" cy="' + base.y.toFixed(1) + '" r="15"/>' +
      '<circle class="tmap-basedot" cx="' + base.x.toFixed(1) + '" cy="' + base.y.toFixed(1) + '" r="6"/>' +
      '<text class="tmap-baselab" x="' + base.x.toFixed(1) + '" y="' + (base.y + 32).toFixed(1) +
      '" text-anchor="middle">We start here</text></g>';

    svg += '</svg>';
    canvas.innerHTML = svg;

    if (legend) {
      legend.innerHTML = BANDS.map(function (b) {
        return '<span class="tmap-key"><i class="tz-' + b.id + '"></i>' + esc(b.label) + '</span>';
      }).join('');
    }

    host.hidden = false;
    return true;
  }

  function markSelected(zip) {
    if (!canvas) return;
    var dots = canvas.querySelectorAll('.tmap-dot');
    for (var i = 0; i < dots.length; i++) {
      dots[i].classList.toggle('on', dots[i].getAttribute('data-zip') === zip);
    }
  }

  /* ---------- wiring ---------- */

  function pick(zip) {
    selected = zip;
    markSelected(zip);
    showReadout(zip);
    if (input.value.trim() !== zip) input.value = zip;
  }

  if (buildMap()) {
    canvas.addEventListener('click', function (e) {
      var dot = e.target.closest ? e.target.closest('.tmap-dot') : null;
      if (dot) pick(dot.getAttribute('data-zip'));
    });
    // Hovering previews without committing, so running the mouse across the
    // map reads out prices as you go and leaving it puts back your own ZIP.
    canvas.addEventListener('mouseover', function (e) {
      var dot = e.target.closest ? e.target.closest('.tmap-dot') : null;
      if (dot) showReadout(dot.getAttribute('data-zip'));
    });
    canvas.addEventListener('mouseleave', function () {
      if (selected) showReadout(selected);
    });
  }

  function fromInput() {
    var zip = input.value.trim().slice(0, 5);
    if (!/^\d{5}$/.test(zip)) {
      out.className = 'travel-out err';
      out.textContent = 'Enter a five digit ZIP code.';
      return;
    }
    pick(zip);
  }

  go.addEventListener('click', fromInput);
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); fromInput(); }
  });
  input.addEventListener('input', function () {
    // Estimate as soon as a full ZIP is typed; no reason to make them tap.
    if (/^\d{5}$/.test(input.value.trim())) fromInput();
    else { out.textContent = ''; out.className = 'travel-out'; selected = ''; markSelected(''); }
  });
})();

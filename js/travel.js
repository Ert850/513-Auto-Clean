/* ============================================================
   Service area map and travel fee estimator.

   A real slippy map (Leaflet over OpenStreetMap tiles) with every ZIP we
   quote marked and coloured by fee band. Click a marker, search a ZIP, a
   town, or a street address, and the fee appears.

   Every figure comes from the SAME mileage ladder as the booking funnel and
   the payment functions, so nothing shown here can drift from what actually
   gets charged.

   Degrades in two steps:
     1. Leaflet missing or blocked -> a schematic SVG map, drawn from the same
        data, so the section still works offline or behind a strict network.
     2. No JavaScript at all -> the town lists below the map, which are plain
        HTML and are what search engines read anyway.
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
  // Clifton, not the house. Close enough to draw from, far enough to publish.
  var BASE_LATLON = [39.135, -84.517];

  /* ---------------- fee bands ---------------- */

  // Thresholds are set so every band actually holds ZIPs. Wider bands would
  // paint most of the map one colour, which is the same as not colouring it.
  var BANDS = [
    { id: 0, max: 0, label: 'No travel fee', color: '#2f9e5e' },
    { id: 1, max: 1000, label: 'About $5 to $10', color: '#7cb342' },
    { id: 2, max: 2000, label: 'About $15 to $20', color: '#f0a93f' },
    { id: 3, max: 3500, label: 'About $25 to $35', color: '#ec6d2a' },
    { id: 4, max: Infinity, label: 'About $45 and up', color: '#c62828' }
  ];

  function feeCents(min) { return P.mileageFeeCents(min, P.RULES.mileage); }

  function bandOf(cents) {
    for (var i = 0; i < BANDS.length; i++) if (cents <= BANDS[i].max) return BANDS[i];
    return BANDS[BANDS.length - 1];
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* ---------------- the data, joined once ---------------- */

  var POINTS = (function () {
    var list = [];
    (P.ZIP_GEO || []).forEach(function (g) {
      var hit = P.lookupZip(g.zip);
      if (!hit) return;
      var mid = Math.round((hit.minMin + hit.maxMin) / 2);
      var lo = feeCents(hit.minMin), hi = feeCents(hit.maxMin);
      list.push({
        zip: g.zip, area: hit.area, lat: g.lat, lon: g.lon,
        minMin: hit.minMin, maxMin: hit.maxMin, mid: mid,
        loCents: lo, hiCents: hi,
        band: bandOf(feeCents(mid)),
        range: hi === 0 ? 'No travel fee' : lo === hi ? $(hi) : $(lo) + ' to ' + $(hi)
      });
    });
    return list;
  })();

  var BY_ZIP = {};
  POINTS.forEach(function (p) { BY_ZIP[p.zip] = p; });

  /* ---------------- readout ---------------- */

  var selected = '';

  function describe(zip) {
    if (BY_ZIP[zip]) return BY_ZIP[zip];
    // A ZIP we have not mapped individually still resolves through the
    // three digit prefix bands.
    var hit = P.lookupZip(zip);
    if (!hit) return null;
    var lo = feeCents(hit.minMin), hi = feeCents(hit.maxMin);
    return {
      zip: zip, area: hit.area, approx: !hit.found,
      minMin: hit.minMin, maxMin: hit.maxMin, loCents: lo, hiCents: hi,
      range: hi === 0 ? 'No travel fee' : lo === hi ? $(hi) : $(lo) + ' to ' + $(hi)
    };
  }

  function showFee(d, label) {
    if (!d) {
      out.className = 'travel-out err';
      out.textContent = 'We do not have that one mapped. Ask us and we will check it for you.';
      return;
    }
    out.className = 'travel-out ok';
    var where = esc(label || (d.area + ' (' + d.zip + ')'));
    out.innerHTML =
      '<b>' + esc(d.range) + '</b>' +
      '<span>' + where + ', roughly ' + d.minMin + ' to ' + d.maxMin + ' minutes from us. ' +
      (d.hiCents === 0
        ? 'That is inside our free radius.'
        : (d.loCents === 0 ? 'Closer parts of this area fall inside the free radius. ' : '') +
          'Your exact fee comes from your address when you book.') +
      '</span>' +
      (d.approx ? '<span class="travel-approx">We have not mapped this ZIP precisely yet, so this is a wider guess than usual.</span>' : '');
  }

  function clearOut() {
    out.className = 'travel-out';
    out.textContent = '';
    selected = '';
  }

  /* ---------------- legend ---------------- */

  (function legend() {
    var el = document.getElementById('zipLegend');
    if (!el) return;
    el.innerHTML = BANDS.map(function (b) {
      return '<span class="tmap-key"><i style="background:' + b.color + '"></i>' + esc(b.label) + '</span>';
    }).join('');
  })();

  /* ---------------- the real map ---------------- */

  var map = null, markers = {}, pin = null;
  var pinBtn = document.getElementById('pinDrop');
  var pinHint = document.getElementById('pinHint');

  function initLeaflet() {
    var host = document.getElementById('areaMap');
    if (!host || !window.L) return false;

    map = L.map(host, {
      center: [39.14, -84.5],
      zoom: 9,
      scrollWheelZoom: false, // grabbing the page scroll is hostile on mobile
      zoomControl: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);

    // Two fingers to pan on touch, so scrolling past the map still works.
    if (map.tap) map.tap.disable();
    map.dragging.enable();

    POINTS.forEach(function (p) {
      var m = L.circleMarker([p.lat, p.lon], {
        radius: 8,
        color: '#ffffff',
        weight: 2,
        fillColor: p.band.color,
        fillOpacity: 0.92
      }).addTo(map);

      m.bindTooltip(p.area + ': ' + p.range, { direction: 'top' });
      m.bindPopup(
        '<b>' + esc(p.area) + '</b><br>' + esc(p.zip) +
        '<br><span class="lp-fee">' + esc(p.range) + '</span>' +
        '<br><span class="lp-min">' + p.minMin + ' to ' + p.maxMin + ' min from us</span>'
      );
      m.on('click', function () { pick(p.zip, { pan: false }); });
      markers[p.zip] = m;
    });

    // Where we start from. Marked so the whole map has an origin, without
    // publishing the actual address.
    L.circleMarker(BASE_LATLON, {
      radius: 9, color: '#0b0e13', weight: 3, fillColor: '#ffffff', fillOpacity: 1
    }).addTo(map).bindTooltip('We start here', { permanent: false, direction: 'top' });

    L.circle(BASE_LATLON, {
      radius: 8000, color: '#2f9e5e', weight: 1.5, dashArray: '5 7', fill: false
    }).addTo(map).bindTooltip('Roughly the free travel radius');

    map.fitBounds(POINTS.map(function (p) { return [p.lat, p.lon]; }), { padding: [24, 24] });

    // Right click drops the pin where you clicked. Long press does the same
    // on touch, which is what Leaflet fires contextmenu for there.
    map.on('contextmenu', function (e) {
      placePin(e.latlng.lat, e.latlng.lng);
    });

    if (pinBtn) {
      pinBtn.hidden = false;
      pinBtn.addEventListener('click', function () {
        var c = map.getCenter();
        placePin(c.lat, c.lng);
        map.panTo(c);
      });
    }
    if (pinHint) {
      pinHint.textContent = 'Or right click anywhere on the map to drop the pin there.';
    }
    return true;
  }

  function highlight(zip) {
    Object.keys(markers).forEach(function (z) {
      markers[z].setStyle({ weight: z === zip ? 4 : 2, color: z === zip ? '#0b0e13' : '#ffffff' });
      markers[z].setRadius(z === zip ? 11 : 8);
    });
  }

  /**
   * The pin.
   *
   * Most people are not going to type a ZIP; they are going to want to point
   * at their street. Drag it, or right click anywhere on the map, and the fee
   * updates from where it lands.
   *
   * A divIcon rather than Leaflet's default marker: the default pulls PNGs
   * from a path derived from wherever the stylesheet loaded, which is exactly
   * the kind of thing that silently 404s behind a CDN.
   */
  function pinIcon() {
    return L.divIcon({
      className: 'ac-pin',
      html: '<span class="ac-pin-body"></span>',
      iconSize: [26, 34],
      iconAnchor: [13, 33],
      popupAnchor: [0, -30]
    });
  }

  function pinLabel(d) {
    return 'Your pin, nearest ' + d.area;
  }

  function priceAtPin() {
    if (!pin) return;
    var ll = pin.getLatLng();
    var d = bandFromLatLon(ll.lat, ll.lng);
    selected = '';
    highlight('');
    showFee(d, pinLabel(d));
    pin.setPopupContent(
      '<b>Your pin</b><br><span class="lp-fee">' + esc(d.range) + '</span>' +
      '<br><span class="lp-min">' + d.minMin + ' to ' + d.maxMin + ' min from us, estimated</span>'
    );
    if (pinHint) pinHint.textContent = 'Drag the pin to move it. Right click the map to send it somewhere else.';
  }

  function placePin(lat, lon, opts) {
    if (!map) return;
    if (!pin) {
      pin = L.marker([lat, lon], { draggable: true, autoPan: true, icon: pinIcon() })
        .addTo(map)
        .bindPopup('');
      pin.on('dragend', priceAtPin);
      pin.on('drag', function () {
        // Live while dragging, so the number moves under your thumb.
        var ll = pin.getLatLng();
        var d = bandFromLatLon(ll.lat, ll.lng);
        showFee(d, pinLabel(d));
      });
    } else {
      pin.setLatLng([lat, lon]);
    }
    priceAtPin();
    if (!opts || opts.open !== false) pin.openPopup();
    if (pinBtn) pinBtn.textContent = 'Move the pin to the middle';
  }

  function clearPin() {
    if (pin && map) map.removeLayer(pin);
    pin = null;
    if (pinBtn) pinBtn.textContent = 'Drop a pin on the map';
    if (pinHint) pinHint.textContent = '';
  }

  function dropPin(lat, lon, label) {
    placePin(lat, lon, { open: false });
    if (!pin) return;
    pin.setPopupContent(esc(label));
    pin.openPopup();
    map.setView([lat, lon], 12);
  }

  /* ---------------- schematic fallback ----------------
     Same data, no tiles. Only used when Leaflet does not load. */

  function buildSchematic() {
    var canvas = document.getElementById('zipMapSvg');
    if (!canvas || POINTS.length < 10) return false;

    var W = 1000, PAD = 46;
    var k = Math.cos((39.15 * Math.PI) / 180);
    var pts = POINTS.map(function (p) {
      return { ref: p, px: p.lon * k, py: -p.lat };
    });

    var minX = Math.min.apply(null, pts.map(function (p) { return p.px; }));
    var maxX = Math.max.apply(null, pts.map(function (p) { return p.px; }));
    var minY = Math.min.apply(null, pts.map(function (p) { return p.py; }));
    var maxY = Math.max.apply(null, pts.map(function (p) { return p.py; }));
    var scale = (W - PAD * 2) / (maxX - minX);
    var H = Math.round((maxY - minY) * scale + PAD * 2);

    pts.forEach(function (p) {
      p.x = PAD + (p.px - minX) * scale;
      p.y = PAD + (p.py - minY) * scale;
    });

    var base = pts.filter(function (p) { return p.ref.zip === BASE_ZIP; })[0] || pts[0];

    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" ' +
      'aria-label="Schematic map of the service area, coloured by travel fee. The same figures are in the search box." ' +
      'preserveAspectRatio="xMidYMid meet">';

    [15, 30, 45].forEach(function (target) {
      var near = pts.filter(function (p) { return Math.abs(p.ref.mid - target) <= 4; });
      if (near.length < 2) return;
      var r = near.reduce(function (t, p) {
        return t + Math.sqrt(Math.pow(p.x - base.x, 2) + Math.pow(p.y - base.y, 2));
      }, 0) / near.length;
      svg += '<circle class="tmap-ring" cx="' + base.x.toFixed(1) + '" cy="' + base.y.toFixed(1) +
        '" r="' + r.toFixed(1) + '"/>' +
        '<text class="tmap-ringlab" x="' + base.x.toFixed(1) + '" y="' + (base.y - r + 13).toFixed(1) +
        '">' + target + ' min</text>';
    });

    pts.slice().sort(function (a, b) { return b.ref.band.id - a.ref.band.id; }).forEach(function (p) {
      svg += '<circle class="tmap-dot" data-zip="' + p.ref.zip + '" fill="' + p.ref.band.color + '" ' +
        'cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="8">' +
        '<title>' + esc(p.ref.area) + ' ' + p.ref.zip + ': ' + esc(p.ref.range) + '</title></circle>';
    });

    svg += '<circle class="tmap-basering" cx="' + base.x.toFixed(1) + '" cy="' + base.y.toFixed(1) + '" r="15"/>' +
      '<circle class="tmap-basedot" cx="' + base.x.toFixed(1) + '" cy="' + base.y.toFixed(1) + '" r="6"/>' +
      '<text class="tmap-baselab" x="' + base.x.toFixed(1) + '" y="' + (base.y + 32).toFixed(1) +
      '" text-anchor="middle">We start here</text></svg>';

    canvas.innerHTML = svg;
    canvas.hidden = false;
    canvas.addEventListener('click', function (e) {
      var dot = e.target.closest ? e.target.closest('.tmap-dot') : null;
      if (dot) pick(dot.getAttribute('data-zip'));
    });
    canvas.addEventListener('mouseover', function (e) {
      var dot = e.target.closest ? e.target.closest('.tmap-dot') : null;
      if (dot) showFee(describe(dot.getAttribute('data-zip')));
    });
    canvas.addEventListener('mouseleave', function () {
      if (selected) showFee(describe(selected));
    });
    return true;
  }

  /* ---------------- search ---------------- */

  var suggest = document.getElementById('zipSuggest');

  function pick(zip, opts) {
    var d = describe(zip);
    if (!d) { showFee(null); return; }
    selected = zip;
    highlight(zip);
    showFee(d);
    hideSuggest();
    if (input.value.trim() !== zip) input.value = zip;
    if (map && markers[zip] && (!opts || opts.pan !== false)) {
      map.setView(markers[zip].getLatLng(), 12);
      markers[zip].openPopup();
    }
    clearPin();
  }

  function hideSuggest() {
    if (!suggest) return;
    suggest.hidden = true;
    suggest.innerHTML = '';
  }

  function localMatches(q) {
    var needle = q.toLowerCase();
    return POINTS.filter(function (p) {
      return p.area.toLowerCase().indexOf(needle) > -1 || p.zip.indexOf(needle) === 0;
    }).slice(0, 6);
  }

  function renderSuggest(rows, footer) {
    if (!suggest) return;
    if (!rows.length && !footer) return hideSuggest();
    suggest.innerHTML = rows.map(function (p) {
      return '<button type="button" class="at-sg" data-zip="' + p.zip + '">' +
        '<span class="sg-dot" style="background:' + p.band.color + '"></span>' +
        '<span class="sg-name">' + esc(p.area) + '<i>' + esc(p.zip) + '</i></span>' +
        '<span class="sg-fee">' + esc(p.range) + '</span></button>';
    }).join('') + (footer || '');
    suggest.hidden = false;
  }

  /* Address lookup, only when the local town and ZIP list comes up empty.
     Nominatim is free and rate limited, so it is a last resort rather than a
     keystroke handler, and a failure just leaves the local search in place. */
  var geoTimer = null;

  function geocode(q) {
    var url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us' +
      '&viewbox=-85.6,39.9,-83.9,38.6&bounded=1&q=' + encodeURIComponent(q);
    return fetch(url, { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error(String(r.status))); })
      .then(function (rows) {
        if (!rows || !rows.length) return null;
        return { lat: Number(rows[0].lat), lon: Number(rows[0].lon), label: rows[0].display_name };
      });
  }

  /**
   * Turn a coordinate into a drive-time band without calling a routing API.
   *
   * Takes the three nearest mapped ZIPs and blends their bands by inverse
   * distance. Cruder than a real route, and clearly labelled as such, but it
   * is built from the same measured drive times as everything else rather
   * than from a miles-per-minute guess.
   */
  function bandFromLatLon(lat, lon) {
    var scored = POINTS.map(function (p) {
      var dx = (p.lon - lon) * Math.cos((39.15 * Math.PI) / 180);
      var dy = p.lat - lat;
      return { p: p, d: Math.sqrt(dx * dx + dy * dy) };
    }).sort(function (a, b) { return a.d - b.d; }).slice(0, 3);

    var wsum = 0, lo = 0, hi = 0;
    scored.forEach(function (s) {
      var w = 1 / Math.max(s.d, 0.004);
      wsum += w;
      lo += s.p.minMin * w;
      hi += s.p.maxMin * w;
    });
    var minMin = Math.round(lo / wsum), maxMin = Math.round(hi / wsum);
    var loC = feeCents(minMin), hiC = feeCents(maxMin);
    return {
      zip: scored[0].p.zip, area: scored[0].p.area, approx: true,
      minMin: minMin, maxMin: maxMin, loCents: loC, hiCents: hiC,
      range: hiC === 0 ? 'No travel fee' : loC === hiC ? $(hiC) : $(loC) + ' to ' + $(hiC)
    };
  }

  function search(commit) {
    var q = input.value.trim();
    if (!q) { hideSuggest(); clearOut(); return; }

    if (/^\d{5}$/.test(q)) { pick(q); return; }

    var rows = localMatches(q);
    if (rows.length) {
      if (commit) { pick(rows[0].zip); return; }
      renderSuggest(rows);
      return;
    }

    // Nothing local. If it reads like a street address, geocode it.
    if (!commit || q.length < 5) { hideSuggest(); return; }

    renderSuggest([], '<p class="at-sg-note">Looking that up...</p>');
    geocode(q)
      .then(function (hit) {
        hideSuggest();
        if (!hit) { showFee(null); return; }
        var d = bandFromLatLon(hit.lat, hit.lon);
        var short = hit.label.split(',').slice(0, 3).join(',');
        showFee(d, short);
        dropPin(hit.lat, hit.lon, short);
      })
      .catch(function () {
        hideSuggest();
        out.className = 'travel-out err';
        out.textContent = 'Address lookup is not responding. Try your ZIP code instead, or start a booking for an exact figure.';
      });
  }

  /* ---------------- wiring ---------------- */

  if (!initLeaflet()) buildSchematic();

  go.addEventListener('click', function () { search(true); });

  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); search(true); }
    if (e.key === 'Escape') hideSuggest();
  });

  input.addEventListener('input', function () {
    clearTimeout(geoTimer);
    var q = input.value.trim();
    if (/^\d{5}$/.test(q)) { pick(q); return; }
    if (q.length < 2) { hideSuggest(); clearOut(); return; }
    geoTimer = setTimeout(function () { search(false); }, 180);
  });

  if (suggest) {
    suggest.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('.at-sg') : null;
      if (b) pick(b.getAttribute('data-zip'));
    });
  }

  document.addEventListener('click', function (e) {
    if (suggest && !suggest.contains(e.target) && e.target !== input) hideSuggest();
  });

  // Leaflet is deferred, so it may land after this file runs.
  if (!map) {
    window.addEventListener('load', function () {
      if (!map && window.L && initLeaflet()) {
        var fb = document.getElementById('zipMapSvg');
        if (fb) fb.hidden = true;
        if (selected) pick(selected);
      }
    });
  }
})();

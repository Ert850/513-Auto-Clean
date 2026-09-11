/* ============================================================
   Service area map and travel fee estimator.

   A real slippy map (Leaflet over OpenStreetMap tiles) with every ZIP we
   quote marked and coloured by fee band. Search a ZIP, a town, or a full
   street address, or drop a pin anywhere at all, and the fee appears.

   EVERY FIGURE HERE IS A RANGE, deliberately. Nobody browsing has picked a
   time yet, and the same address costs a little more at five in the evening
   than at eight in the morning, so a single number would be a false promise.
   Inside the mapped area the range comes from a blend of the three nearest
   ZIP bands; outside it, from great circle distance with a road factor.

   The EXACT figure is measured in the booking funnel, where a slot has been
   chosen and the Routes API can price that hour's traffic. Both run the same
   mileage ladder, so the range shown here always contains the figure charged
   there.

   Degrades in two steps:
     1. Leaflet missing or blocked -> a schematic SVG map from the same data.
     2. No JavaScript -> the town lists below, which are what search engines
        read anyway.
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
  var MAX_MIN = P.MAX_ONE_WAY_MINUTES || 720;

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
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function rangeText(lo, hi) {
    if (hi === 0) return 'No travel fee';
    return lo === hi ? $(hi) : $(lo) + ' to ' + $(hi);
  }

  function hours(min) {
    var h = min / 60;
    return h < 10 ? h.toFixed(1) : String(Math.round(h));
  }

  /* ---------------- the data, joined once ---------------- */

  var POINTS = (function () {
    var list = [];
    (P.ZIP_GEO || []).forEach(function (g) {
      var hit = P.lookupZip(g.zip);
      if (!hit) return;
      var lo = feeCents(hit.minMin), hi = feeCents(hit.maxMin);
      list.push({
        zip: g.zip, area: hit.area, lat: g.lat, lon: g.lon,
        minMin: hit.minMin, maxMin: hit.maxMin,
        mid: Math.round((hit.minMin + hit.maxMin) / 2),
        loCents: lo, hiCents: hi,
        band: bandOf(feeCents(Math.round((hit.minMin + hit.maxMin) / 2))),
        range: rangeText(lo, hi)
      });
    });
    return list;
  })();

  var BY_ZIP = {};
  POINTS.forEach(function (p) { BY_ZIP[p.zip] = p; });

  /* ---------------- estimating anywhere ---------------- */

  var COS_LAT = Math.cos((39.15 * Math.PI) / 180);

  /** Rough degrees, longitude squeezed. Only ever compared, never published. */
  function degreesFrom(lat, lon, p) {
    var dx = (p.lon - lon) * COS_LAT;
    var dy = p.lat - lat;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function crowMiles(lat, lon) {
    var R = 3958.8;
    var dLat = ((lat - BASE_LATLON[0]) * Math.PI) / 180;
    var dLon = ((lon - BASE_LATLON[1]) * Math.PI) / 180;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((BASE_LATLON[0] * Math.PI) / 180) * Math.cos((lat * Math.PI) / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  /** Inside this many degrees of a mapped ZIP, the measured bands win. */
  var NEAR_DEG = 0.35;

  /**
   * Estimate a drive to any point on earth, with no network call.
   *
   * Near home that is an inverse distance blend of the three closest mapped
   * ZIPs, which is built from real drive times rather than a miles per minute
   * guess. Far from home there is nothing to blend, so it falls back to great
   * circle distance with a road winding factor. Crude, and labelled as such,
   * but it is enough to answer "is this even possible".
   */
  function estimateAt(lat, lon) {
    var scored = POINTS.map(function (p) {
      return { p: p, d: degreesFrom(lat, lon, p) };
    }).sort(function (a, b) { return a.d - b.d; });

    var nearest = scored[0];

    if (nearest && nearest.d <= NEAR_DEG) {
      var top = scored.slice(0, 3);
      var wsum = 0, lo = 0, hi = 0;
      top.forEach(function (s) {
        var w = 1 / Math.max(s.d, 0.004);
        wsum += w;
        lo += s.p.minMin * w;
        hi += s.p.maxMin * w;
      });
      return finish(Math.round(lo / wsum), Math.round(hi / wsum), nearest.p.area, false);
    }

    // Roads are not straight, so a crow flight gets a winding factor, and
    // anything this far out is interstate rather than city streets, so the
    // average speed is an open road one. Calibrated against real drives:
    // Chicago lands near 4.7 hours and New York near 10.6, which is about
    // right, and that matters because the 12 hour cut off is decided here.
    var miles = crowMiles(lat, lon);
    var mid = (miles * 1.15) / 62 * 60;
    return finish(Math.round(mid * 0.9), Math.round(mid * 1.15),
      nearest ? nearest.p.area : 'us', true);
  }

  function finish(minMin, maxMin, area, coarse) {
    var mid = Math.round((minMin + maxMin) / 2);
    var lo = feeCents(minMin), hi = feeCents(maxMin);
    return {
      minMin: minMin, maxMin: maxMin, area: area,
      loCents: lo, hiCents: hi, range: rangeText(lo, hi),
      approx: true, coarse: coarse,
      tooFar: mid > MAX_MIN
    };
  }

  function describe(zip) {
    if (BY_ZIP[zip]) return BY_ZIP[zip];
    // A ZIP we have not mapped individually still resolves through the three
    // digit prefix bands.
    var hit = P.lookupZip(zip);
    if (!hit) return null;
    var lo = feeCents(hit.minMin), hi = feeCents(hit.maxMin);
    return {
      zip: zip, area: hit.area, approx: !hit.found,
      minMin: hit.minMin, maxMin: hit.maxMin, loCents: lo, hiCents: hi,
      range: rangeText(lo, hi)
    };
  }

  /* ---------------- readout ---------------- */

  var selected = '';

  function showTooFar(d, label) {
    out.className = 'travel-out err';
    out.innerHTML =
      '<b>Too far for a mobile detail</b>' +
      '<span>' + (label ? esc(label) + ' is ' : 'That is ') + 'roughly ' +
      hours(Math.round((d.minMin + d.maxMin) / 2)) + ' hours of driving each way, well past the ' +
      (MAX_MIN / 60) + ' hours we can cover. Consider booking a detail closer to you. ' +
      'If you can get the vehicle nearer to Cincinnati, we will happily come to it there.</span>';
  }

  function showFee(d, label) {
    if (!d) {
      out.className = 'travel-out err';
      out.textContent = 'We do not have that one mapped. Ask us and we will check it for you.';
      return;
    }
    if (d.tooFar) return showTooFar(d, label);

    out.className = 'travel-out ok';
    var where = esc(label || (d.area + ' (' + d.zip + ')'));

    var time = 'roughly ' + d.minMin + ' to ' + d.maxMin + ' minutes from us';

    out.innerHTML =
      '<b>' + esc(d.range) + '</b>' +
      '<span>' + where + ', ' + time + '. ' +
      (d.hiCents === 0
        ? 'That is inside our free radius.'
        : (d.loCents === 0 ? 'Closer parts of this area fall inside the free radius. ' : '') +
          'Your exact fee is measured from your address when you book.') +
      '</span>' +
      (d.coarse
        ? '<span class="travel-approx">Well outside our usual area, so this is a distance estimate rather than a real route.</span>'
        : '<span class="travel-approx">A range, because the same address costs a little more in traffic. Start a booking and we measure the exact drive for the time you pick.</span>');
  }

  function clearOut() {
    out.className = 'travel-out';
    out.textContent = '';
    selected = '';
  }

  /* ---------------- quoting a point ----------------
     Always the local estimate, always a range. See the note in showFee:
     an exact figure needs a departure time, and the front page has none.
     The funnel measures it once a slot is chosen. */

  function quoteAt(lat, lon, label, onDone) {
    var d = estimateAt(lat, lon);
    showFee(d, label);
    if (onDone) onDone(d);
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
  var zoomHint = document.getElementById('mapZoomHint');

  function initLeaflet() {
    var host = document.getElementById('areaMap');
    if (!host || !window.L) return false;

    map = L.map(host, {
      center: [39.14, -84.5],
      zoom: 9,
      // Off at the start. A map that eats the page scroll the moment your
      // cursor crosses it is the most hated widget on the internet. Clicking
      // the map arms it.
      scrollWheelZoom: false,
      // ON, always. Dragging is only ever suspended for the duration of a
      // ONE finger touch, below, so a mouse can always drag.
      //
      // This used to be `!isTouch`, which broke every touchscreen laptop:
      // they report maxTouchPoints > 0 whether or not anyone is touching the
      // screen, so a plain mouse user got a map that could not be dragged,
      // zoomed, or right clicked. Never branch on what a device might be
      // capable of. Branch on the event that actually happened.
      dragging: true,
      touchZoom: true,
      zoomControl: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);

    if (map.tap) map.tap.disable();

    /* ---- zoom, once you have actually chosen the map ---- */

    function armWheel() {
      if (map.scrollWheelZoom.enabled()) return;
      map.scrollWheelZoom.enable();
      host.classList.add('zoom-on');
      if (zoomHint) zoomHint.textContent = 'Scroll to zoom. Move off the map to scroll the page again.';
    }

    function disarmWheel() {
      map.scrollWheelZoom.disable();
      host.classList.remove('zoom-on');
      if (zoomHint) zoomHint.textContent = idleZoomHint();
    }

    function idleZoomHint() {
      // One line covering both, since the same laptop can be either.
      return 'Click the map then scroll to zoom, and drag to move it. ' +
        'On a phone use two fingers to pan and pinch to zoom. ' +
        'Right click, or long press, to drop a pin anywhere.';
    }

    // Mouse: click to arm the wheel, leave to disarm. Wired unconditionally,
    // because a touchscreen laptop is still a mouse.
    host.addEventListener('click', armWheel);
    host.addEventListener('mouseleave', disarmWheel);
    host.addEventListener('focusin', armWheel);

    // Touch: one finger scrolls the PAGE, so dragging is suspended for the
    // length of that gesture and restored the moment the finger lifts. Two
    // fingers pan the map. Pinch zoom is never disabled.
    host.addEventListener('touchstart', function (e) {
      if (e.touches.length > 1) map.dragging.enable();
      else map.dragging.disable();
    }, { passive: true });

    host.addEventListener('touchend', function (e) {
      // Back on for the mouse the instant the touch is over.
      if (!e.touches || e.touches.length === 0) map.dragging.enable();
    }, { passive: true });

    host.addEventListener('touchcancel', function () { map.dragging.enable(); }, { passive: true });

    if (zoomHint) zoomHint.textContent = idleZoomHint();

    /* ---- the ZIP markers ---- */

    POINTS.forEach(function (p) {
      var m = L.circleMarker([p.lat, p.lon], {
        radius: 8, color: '#ffffff', weight: 2,
        fillColor: p.band.color, fillOpacity: 0.92
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

    // Where we start from. Marked so the map has an origin, without
    // publishing the actual address.
    L.circleMarker(BASE_LATLON, {
      radius: 9, color: '#0b0e13', weight: 3, fillColor: '#ffffff', fillOpacity: 1
    }).addTo(map).bindTooltip('We start here', { direction: 'top' });

    L.circle(BASE_LATLON, {
      radius: 8000, color: '#2f9e5e', weight: 1.5, dashArray: '5 7', fill: false
    }).addTo(map).bindTooltip('Roughly the free travel radius');

    map.fitBounds(POINTS.map(function (p) { return [p.lat, p.lon]; }), { padding: [24, 24] });

    // Right click drops the pin where you clicked. Long press does the same
    // on touch, which is what Leaflet fires contextmenu for there.
    map.on('contextmenu', function (e) { placePin(e.latlng.lat, e.latlng.lng); });

    if (pinBtn) {
      pinBtn.hidden = false;
      pinBtn.addEventListener('click', function () {
        var c = map.getCenter();
        placePin(c.lat, c.lng);
        map.panTo(c);
      });
    }
    if (pinHint) pinHint.textContent = 'Or right click anywhere on the map to drop the pin there.';

    return true;
  }

  function highlight(zip) {
    Object.keys(markers).forEach(function (z) {
      markers[z].setStyle({ weight: z === zip ? 4 : 2, color: z === zip ? '#0b0e13' : '#ffffff' });
      markers[z].setRadius(z === zip ? 11 : 8);
    });
  }

  /* ---------------- the pin ----------------
     Most people are not going to type a ZIP; they are going to want to point
     at their street. Drag it, or right click anywhere on the map, and the fee
     follows it. A divIcon rather than Leaflet's default marker, because the
     default pulls PNGs from a path derived from wherever the stylesheet
     loaded, which is exactly the kind of thing that silently 404s. */

  function pinIcon() {
    return L.divIcon({
      className: 'ac-pin',
      html: '<span class="ac-pin-body"></span>',
      iconSize: [26, 34],
      iconAnchor: [13, 33],
      popupAnchor: [0, -30]
    });
  }

  function pinPopup(d, label) {
    if (d.tooFar) {
      return '<b>Too far to drive</b><br><span class="lp-min">About ' +
        hours(Math.round((d.minMin + d.maxMin) / 2)) + ' hours each way</span>';
    }
    return '<b>' + esc(label || 'Your pin') + '</b>' +
      '<br><span class="lp-fee">' + esc(d.range) + '</span>' +
      '<br><span class="lp-min">' +
      d.minMin + ' to ' + d.maxMin + ' min, estimated' +
      '</span>';
  }

  function pinLabel(d) {
    return d.coarse ? 'Your pin' : 'Your pin, nearest ' + d.area;
  }

  function pricePin(opts) {
    if (!pin) return;
    var ll = pin.getLatLng();
    selected = '';
    highlight('');
    quoteAt(ll.lat, ll.lng, pinLabel(estimateAt(ll.lat, ll.lng)), function (d) {
      if (pin) pin.setPopupContent(pinPopup(d, pinLabel(d)));
    });
    if (opts && opts.open && pin) pin.openPopup();
    if (pinHint) pinHint.textContent = 'Drag the pin to move it. Right click the map to send it elsewhere.';
  }

  function placePin(lat, lon, opts) {
    if (!map) return;
    if (!pin) {
      pin = L.marker([lat, lon], { draggable: true, autoPan: true, icon: pinIcon() })
        .addTo(map)
        .bindPopup('');
      pin.on('dragend', function () { pricePin({ open: true }); });
      pin.on('drag', function () {
        // Instant feedback while dragging; no network call until it lands.
        var ll = pin.getLatLng();
        var d = estimateAt(ll.lat, ll.lng);
        showFee(d, pinLabel(d));
      });
    } else {
      pin.setLatLng([lat, lon]);
    }
    pricePin({ open: !opts || opts.open !== false });
    if (pinBtn) pinBtn.textContent = 'Move the pin to the middle';
  }

  function clearPin() {
    if (pin && map) map.removeLayer(pin);
    pin = null;
    if (pinBtn) pinBtn.textContent = 'Drop a pin on the map';
    if (pinHint) pinHint.textContent = map ? 'Or right click anywhere on the map to drop the pin there.' : '';
  }

  /* ---------------- schematic fallback ----------------
     Same data, no tiles. Only used when Leaflet does not load. */

  function buildSchematic() {
    var canvas = document.getElementById('zipMapSvg');
    if (!canvas || POINTS.length < 10) return false;

    var W = 1000, PAD = 46;
    var pts = POINTS.map(function (p) { return { ref: p, px: p.lon * COS_LAT, py: -p.lat }; });

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

  /**
   * Address lookup.
   *
   * Biased toward the Cincinnati box so a bare street name lands locally, but
   * NOT bounded to it, so a full address anywhere still resolves and the
   * twelve hour rule gets a chance to answer honestly rather than the search
   * simply failing.
   */
  function geocode(q) {
    var url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=0' +
      '&viewbox=-85.6,39.9,-83.9,38.6&q=' + encodeURIComponent(q);
    return fetch(url, { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error(String(r.status))); })
      .then(function (rows) {
        if (!rows || !rows.length) return null;
        return { lat: Number(rows[0].lat), lon: Number(rows[0].lon), label: rows[0].display_name };
      });
  }

  var geoTimer = null;

  function search(commit) {
    var q = input.value.trim();
    if (!q) { hideSuggest(); clearOut(); return; }

    if (/^\d{5}$/.test(q)) { pick(q); return; }

    var rows = localMatches(q);
    // A query with a house number in it is an address, not a town, so the
    // town list should not intercept it.
    var looksLikeAddress = /\d/.test(q) && /[a-z]/i.test(q);

    if (rows.length && !looksLikeAddress) {
      if (commit) { pick(rows[0].zip); return; }
      renderSuggest(rows);
      return;
    }

    if (!commit || q.length < 4) {
      if (rows.length) renderSuggest(rows);
      else hideSuggest();
      return;
    }

    renderSuggest([], '<p class="at-sg-note">Looking that up...</p>');
    geocode(q)
      .then(function (hit) {
        hideSuggest();
        if (!hit) { showFee(null); return; }
        var short = hit.label.split(',').slice(0, 3).join(',').trim();
        clearPin();
        if (map) {
          placePin(hit.lat, hit.lon, { open: false });
          map.setView([hit.lat, hit.lon], 13);
        }
        quoteAt(hit.lat, hit.lon, short, function (d) {
          if (pin) { pin.setPopupContent(pinPopup(d, short)); pin.openPopup(); }
        });
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

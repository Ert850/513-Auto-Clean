/**
 * The area map on a city page (config/locations/<slug>.json "map"): the
 * area we serve as a soft circle, and a dot per ZIP. Leaflet is fetched
 * only when the map comes near the screen, pinned to the same version and
 * integrity hashes as the Range & Travel map (js/travel.js), so a visitor who
 * never scrolls that far never pays for it. Until then (or without it) the
 * neighbourhood and ZIP lists beside it say the same thing in words.
 */
(function () {
  'use strict';
  var host = document.querySelector('[data-loc-map]');
  if (!host) return;
  var cfg;
  try { cfg = JSON.parse(host.getAttribute('data-loc-map')); } catch (e) { return; }
  var CSS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
  var JS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';

  function draw() {
    if (!window.L || host.getAttribute('data-ready')) return;
    host.setAttribute('data-ready', '1');
    var map = L.map(host, { scrollWheelZoom: false, zoomSnap: 0.25, attributionControl: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 16, attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    // Set the view first: a circle can't measure its bounds on a map that has none.
    var meters = cfg.radiusMiles * 1609.34;
    map.fitBounds(L.latLng(cfg.center[0], cfg.center[1]).toBounds(meters * 2), { padding: [12, 12] });
    L.circle(cfg.center, {
      radius: meters, color: '#c41414', weight: 2, fillColor: '#c41414', fillOpacity: 0.08
    }).addTo(map);
    (cfg.zips || []).forEach(function (z) {
      L.circleMarker([z.lat, z.lon], { radius: 7, color: '#ffffff', weight: 2, fillColor: '#c41414', fillOpacity: 1 })
        .bindTooltip(z.zip).addTo(map);
    });
  }

  function load() {
    if (window.L) return draw();
    var css = document.createElement('link');
    css.rel = 'stylesheet'; css.href = CSS;
    css.integrity = 'sha384-c6Rcwz4e4CITMbu/NBmnNS8yN2sC3cUElMEMfP3vqqKFp7GOYaaBBCqmaWBjmkjb';
    css.crossOrigin = 'anonymous'; css.referrerPolicy = 'no-referrer';
    document.head.appendChild(css);
    var js = document.createElement('script');
    js.src = JS;
    js.integrity = 'sha384-NElt3Op+9NBMCYaef5HxeJmU4Xeard/Lku8ek6hoPTvYkQPh3zLIrJP7KiRocsxO';
    js.crossOrigin = 'anonymous'; js.referrerPolicy = 'no-referrer'; js.async = true;
    js.onload = draw;
    document.head.appendChild(js);
  }

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      if (es.some(function (e) { return e.isIntersecting; })) { io.disconnect(); load(); }
    }, { rootMargin: '600px 0px' });
    io.observe(host);
  } else {
    load();
  }
})();

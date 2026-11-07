// Aboud Store — offline support
var CACHE = "aboud-store-v29";
var CORE = [
  "./", "./index.html", "./manifest.json", "./icon-180.png", "./icon-192.png", "./icon-512.png",
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js",
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore-compat.js"
];
self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(CORE.map(function (u) {
      return fetch(u, { cache: "reload" }).then(function (r) { if (r.ok) return c.put(u, r); }).catch(function () {});
    }));
  }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf("aboud-store-") === 0 && k !== CACHE; })
      .map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  var u = new URL(e.request.url);
  var mine = u.origin === self.location.origin;
  var lib = u.host === "www.gstatic.com" && u.pathname.indexOf("/firebasejs/") === 0;
  var font = u.host === "fonts.googleapis.com" || u.host === "fonts.gstatic.com";
  if (!mine && !lib && !font) return; // Firestore/Auth traffic goes straight to the network
  if (mine) {
    // app files: newest from the network, cached copy when offline
    // app files: newest from the network; no internet or a weak signal (over 3s) -> the copy saved on the device
    var cached = function () { return caches.match(e.request).then(function (m) { return m || caches.match("./index.html"); }); };
    var net = fetch(e.request, { cache: "no-cache" }).then(function (r) {
      if (r.ok) { var c = r.clone(); caches.open(CACHE).then(function (x) { x.put(e.request, c); }); }
      return r;
    });
    e.respondWith(new Promise(function (ok) {
      var done = false, fin = function (r) { if (!done && r) { done = true; ok(r); } };
      var t = setTimeout(function () { cached().then(fin); }, 3000);
      net.then(function (r) { clearTimeout(t); fin(r); }).catch(function () { clearTimeout(t); cached().then(function (m) { fin(m || Response.error()); }); });
    }));
  } else {
    // libraries and fonts never change at a pinned URL: cache first
    e.respondWith(caches.match(e.request).then(function (m) {
      return m || fetch(e.request).then(function (r) {
        var c = r.clone(); caches.open(CACHE).then(function (x) { x.put(e.request, c); }); return r;
      });
    }));
  }
});

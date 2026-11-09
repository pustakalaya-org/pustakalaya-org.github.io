/* Pustakālaya: web edition. Service worker (offline reading).
 *
 * Written into the site root by tools/site_hooks.py after every `mkdocs build`; the version below is a hash
 * of the built site, so each deploy installs a new worker and replaces the old caches.
 *
 *   pages (.html)                      the copy cached since this deploy first (the caches are per deploy, so it
 *                                      is current); otherwise network first, cached copy when offline or slow
 *   search index                       cache first (per deploy); fetched only when the reader first searches.
 *                                      A page of a book gets that book's index (<book>/search.json), the
 *                                      shelf and the other pages the titles of the whole library
 *   images, styles, scripts, fonts     cache first
 *   Google Fonts, MathJax (CDN)        kept after first use, so fonts and mathematics work offline
 *   volumes kept for offline reading   the "bjp-offline" cache, filled by assets/app.js; kept across deploys
 *   videos (.mp4, .webm, ...)          from the kept volume when there is one (answering range requests, which players make),
 *                                      otherwise straight from the network
 */
"use strict";

var VERSION = "bd8a9b8a6b79";
var SHELL = ["index.html", "about.html", "install.html", "offline.html", "sitemap.xml", "manifest.webmanifest", "library.json", "assets/app.css", "assets/app.js", "assets/extra.css", "assets/icons/apple-touch-icon.png", "assets/icons/favicon-32.png", "assets/icons/favicon.svg", "assets/icons/icon-192.png", "assets/icons/icon-512.png", "assets/icons/logo.svg", "assets/icons/maskable-512.png", "assets/images/favicon.png", "assets/javascripts/bundle.d7400e89.min.js", "assets/javascripts/workers/search.2c215733.min.js", "assets/mathjax.js", "assets/reader.css", "assets/reader.js", "assets/stylesheets/main.ec1eaa64.min.css", "assets/stylesheets/palette.ab4e12ef.min.css", "assets/theme.css", "assets/viz-kit.js", "assets/viz.css", "assets/viz.js"];
var BOOKS = [];                           // the books' folders, longest first

var SCOPE = self.registration.scope;               // the site root, ending in "/"
var SCOPE_PATH = new URL(SCOPE).pathname;
var PRE = "bjp-";
var SHELL_CACHE = PRE + "shell-" + VERSION;
var PAGES_CACHE = PRE + "pages-" + VERSION;
var STATIC_CACHE = PRE + "static-" + VERSION;
var EXT_CACHE = PRE + "ext";                         // fonts and MathJax: versioned URLs, kept across deploys
var KEEP_CACHE = PRE + "offline";                    // volumes kept for offline reading
var MAX_PAGES = 160, MAX_STATIC = 400, MAX_EXT = 160;
var SLOW_MS = 3500;                                  // after this, a cached page is shown while the network catches up
var STATIC_RE = /\.(css|js|mjs|json|png|jpe?g|gif|webp|avif|svg|ico|woff2?|ttf|otf|webmanifest|xml|txt)$/i;
var MATHJAX = "https://cdn.jsdelivr.net/npm/mathjax@";

/* ------------------------------------------------------------------ install and activate */
self.addEventListener("install", function (event) {
  event.waitUntil(caches.open(SHELL_CACHE).then(function (cache) {
    return Promise.all(SHELL.map(function (p) {
      var url = SCOPE + p;
      return fetch(new Request(url, { cache: "reload", credentials: "same-origin" })).then(function (res) {
        if (!res.ok) throw new Error("precache " + p + ": " + res.status);
        return cache.put(url, res);
      });
    }));
  }));
});

self.addEventListener("activate", function (event) {
  event.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) {
      return k.indexOf(PRE) === 0 && k !== KEEP_CACHE && k !== EXT_CACHE && k.slice(-VERSION.length - 1) !== "-" + VERSION;
    }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("message", function (event) {
  var d = event.data || {};
  if (d.type === "skip-waiting") self.skipWaiting();
  else if (d.type === "version" && event.source) event.source.postMessage({ type: "version", version: VERSION });
});

/* ------------------------------------------------------------------ helpers */
function matchIn(req, names, opts) {
  var i = 0;
  function next() {
    if (i >= names.length) return Promise.resolve(undefined);
    var name = names[i++];
    return caches.open(name).then(function (c) { return c.match(req, opts); }).then(function (r) { return r || next(); });
  }
  return next();
}

function trim(name, max) {
  return caches.open(name).then(function (c) {
    return c.keys().then(function (keys) {
      var extra = keys.length - max, ps = [];
      for (var i = 0; i < extra; i++) ps.push(c.delete(keys[i]));
      return Promise.all(ps);
    });
  });
}

function usable(res) { return res && (res.ok || res.type === "opaque"); }

/* the address under which a page is cached: no query, "…/" stored as "…/index.html" */
function pageKey(url) {
  var p = url.pathname;
  if (p.charAt(p.length - 1) === "/") p += "index.html";
  return url.origin + p;
}

function isPage(rel) {
  return rel === "" || /\/$/.test(rel) || /\.html$/i.test(rel);
}

/* ------------------------------------------------------------------ strategies */
function pageResponse(event, req, url) {
  var key = pageKey(url);
  return caches.open(PAGES_CACHE).then(function (c) { return c.match(key, { ignoreSearch: true }); }).then(function (hit) {
    return hit || pageFromNetwork(event, req, url, key);
  }, function () { return pageFromNetwork(event, req, url, key); });
}

function pageFromNetwork(event, req, url, key) {
  var cached = function () { return matchIn(key, [PAGES_CACHE, KEEP_CACHE, SHELL_CACHE], { ignoreSearch: true }); };
  var net = fetch(req);
  // the copy is stored in the background (the event is kept alive until it is written)
  event.waitUntil(net.then(function (res) {
    if (!(res && res.ok && res.type === "basic" && !res.redirected)) return null;
    var a = res.clone(), b = res.clone();
    return Promise.all([
      caches.open(PAGES_CACHE).then(function (c) { return c.put(key, a); }).then(function () { return trim(PAGES_CACHE, MAX_PAGES); }),
      // a page of a kept volume is refreshed in place
      caches.open(KEEP_CACHE).then(function (c) { return c.match(key).then(function (old) { return old ? c.put(key, b) : null; }); })
    ]);
  }).catch(function () { /* offline or storage full */ }));
  return new Promise(function (resolve) {
    var done = false;
    function finish(r) { if (!done) { done = true; resolve(r); } }
    var timer = setTimeout(function () {
      cached().then(function (r) { if (r) finish(r); });
    }, SLOW_MS);
    net.then(function (res) { clearTimeout(timer); finish(res); }, function () {
      clearTimeout(timer);
      cached().then(function (r) { finish(r || fallback(req, url)); });
    });
  });
}

/* not cached and no network: a full page load goes to the offline page; a page fetched by script fails,
   so that the theme falls back to a full page load (which then lands on the offline page) */
function fallback(req, url) {
  if (req.mode === "navigate") {
    var rel = url.pathname.indexOf(SCOPE_PATH) === 0 ? url.pathname.slice(SCOPE_PATH.length) : "";
    return Response.redirect(SCOPE + "offline.html" + (rel ? "?from=" + encodeURIComponent(rel) : ""), 302);
  }
  return Response.error();
}

function cacheFirst(event, req, store, max) {
  return matchIn(req, [SHELL_CACHE, STATIC_CACHE, KEEP_CACHE, EXT_CACHE]).then(function (hit) {
    if (hit) return hit;
    return fetch(req).then(function (res) {
      if (usable(res)) {
        var copy = res.clone();
        event.waitUntil(caches.open(store).then(function (c) { return c.put(req, copy); })
          .then(function () { return trim(store, max); }).catch(function () { /* ignore */ }));
      }
      return res;
    });
  });
}

function networkFirst(event, req, store) {
  return fetch(req).then(function (res) {
    if (res && res.ok) {
      var copy = res.clone();
      event.waitUntil(caches.open(store).then(function (c) { return c.put(req, copy); }).catch(function () { /* ignore */ }));
    }
    return res;
  }, function () {
    return matchIn(req, [store, SHELL_CACHE, STATIC_CACHE], { ignoreSearch: true }).then(function (r) { return r || Response.error(); });
  });
}

function staleWhileRevalidate(event, req, store) {
  var net = fetch(req);
  event.waitUntil(net.then(function (res) {
    if (!usable(res)) return null;
    return caches.open(store).then(function (c) { return c.put(req, res.clone()); });
  }).catch(function () { /* offline: a cached copy is used */ }));
  return caches.open(store).then(function (c) { return c.match(req); }).then(function (hit) {
    return hit || net.then(function (res) { return res.clone(); }, function () { return Response.error(); });
  });
}

/* the search index for the page that asks for it: its book's, or the titles of the library */
function searchIndex(event, req) {
  var page = "";
  try {
    var ref = new URL(req.referrer);
    if (ref.origin === self.location.origin && ref.pathname.indexOf(SCOPE_PATH) === 0) page = ref.pathname.slice(SCOPE_PATH.length);
  } catch (e) { page = ""; }
  var book = null;
  for (var i = 0; i < BOOKS.length; i++) {
    if (page.indexOf(BOOKS[i] + "/") === 0) { book = BOOKS[i]; break; }
  }
  var url = SCOPE + (book ? book + "/search.json" : "search/titles.json");
  return cacheFirst(event, new Request(url, { credentials: "same-origin" }), STATIC_CACHE, MAX_STATIC);
}

/* a video of a kept volume: players ask for byte ranges, which a cached whole file must answer with 206 */
var MEDIA_RE = /\.(mp4|m4v|webm|ogv)$/i;
function mediaResponse(event, req) {
  var range = req.headers.get("range");
  return matchIn(req.url, [KEEP_CACHE, STATIC_CACHE], { ignoreSearch: true }).then(function (hit) {
    if (!hit) return fetch(req);
    if (!range) return hit;
    return hit.arrayBuffer().then(function (buf) {
      var m = /bytes=(\d*)-(\d*)/.exec(range), size = buf.byteLength;
      var start = m && m[1] !== "" ? parseInt(m[1], 10) : 0;
      var end = m && m[2] !== "" ? Math.min(parseInt(m[2], 10), size - 1) : size - 1;
      if (m && m[1] === "" && m[2] !== "") { start = Math.max(0, size - parseInt(m[2], 10)); end = size - 1; }
      if (start >= size || start > end) return new Response(null, { status: 416, headers: { "Content-Range": "bytes */" + size } });
      return new Response(buf.slice(start, end + 1), { status: 206, statusText: "Partial Content", headers: {
        "Content-Type": hit.headers.get("Content-Type") || "video/mp4",
        "Content-Range": "bytes " + start + "-" + end + "/" + size,
        "Content-Length": String(end - start + 1)
      } });
    });
  }, function () { return fetch(req); });
}

/* ------------------------------------------------------------------ routing */
self.addEventListener("fetch", function (event) {
  var req = event.request;
  if (req.method !== "GET") return;
  // "Keep for offline reading" (assets/app.js) stores its own copies: pass its requests straight through
  if (req.headers.get("X-BJP-Keep")) return;
  var url = new URL(req.url);
  if (url.origin === self.location.origin) {
    if (url.pathname.indexOf(SCOPE_PATH) !== 0) return;
    var rel = url.pathname.slice(SCOPE_PATH.length);
    if (rel === "sw.js" || rel.indexOf("livereload") === 0) return;
    if (isPage(rel)) { event.respondWith(pageResponse(event, req, url)); return; }
    if (rel === "search/search_index.json") { event.respondWith(searchIndex(event, req)); return; }
    if (rel.indexOf("search/") === 0) { event.respondWith(cacheFirst(event, req, STATIC_CACHE, MAX_STATIC)); return; }
    if (rel === "library.json" || rel === "sitemap.xml" || rel === "manifest.webmanifest") {
      event.respondWith(networkFirst(event, req, STATIC_CACHE));
      return;
    }
    if (MEDIA_RE.test(rel)) { event.respondWith(mediaResponse(event, req)); return; }
    if (STATIC_RE.test(rel)) event.respondWith(cacheFirst(event, req, STATIC_CACHE, MAX_STATIC));
    return;
  }
  if (url.hostname === "fonts.googleapis.com") event.respondWith(staleWhileRevalidate(event, req, EXT_CACHE));
  else if (url.hostname === "fonts.gstatic.com" || req.url.indexOf(MATHJAX) === 0) event.respondWith(cacheFirst(event, req, EXT_CACHE, MAX_EXT));
});

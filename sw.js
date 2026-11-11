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
 *   linked books (assets/remote.js)    the text of a chapter from the source's API: network first; the copy kept for
 *                                      offline reading ("pk-remote-kept", kept across deploys) or read lately when
 *                                      offline or slow. Their pictures: the kept copy first, otherwise the network
 */
"use strict";

var VERSION = "d94dd40db317";
var SHELL = ["index.html", "books.html", "about.html", "install.html", "publish.html", "offline.html", "sitemap.xml", "manifest.webmanifest", "library.json", "lists/arts-language-literature.html", "lists/philosophy-contemplative.html", "lists/sciences-of-india.html", "lists/society-polity-economy.html", "lists/start-here.html", "lists/women-writers.html", "subjects/agriculture.html", "subjects/algebra-geometry.html", "subjects/anthropology.html", "subjects/architecture.html", "subjects/arts.html", "subjects/astronomy.html", "subjects/biography.html", "subjects/chemistry.html", "subjects/childrens-books.html", "subjects/crafts.html", "subjects/earth-environment.html", "subjects/economics.html", "subjects/education.html", "subjects/engineering.html", "subjects/epics.html", "subjects/geography.html", "subjects/history-of-education.html", "subjects/history-of-science.html", "subjects/history.html", "subjects/iks-arts.html", "subjects/iks-ayurveda.html", "subjects/iks-darsana.html", "subjects/iks-ganita.html", "subjects/iks-itihasa.html", "subjects/iks-kavya.html", "subjects/iks-mind.html", "subjects/iks-polity.html", "subjects/iks-sabda.html", "subjects/iks-science.html", "subjects/iks-traditions.html", "subjects/iks-veda.html", "subjects/iks-yoga.html", "subjects/iks.html", "subjects/index.html", "subjects/indian-history.html", "subjects/indian-languages.html", "subjects/language-literature.html", "subjects/languages.html", "subjects/law-polity.html", "subjects/literature.html", "subjects/mathematics.html", "subjects/medicine.html", "subjects/metallurgy.html", "subjects/military-history.html", "subjects/music-performance.html", "subjects/philosophy-religion.html", "subjects/philosophy.html", "subjects/poetry.html", "subjects/psychology.html", "subjects/religion.html", "subjects/sacred-texts.html", "subjects/sanskrit.html", "subjects/science.html", "subjects/social-sciences.html", "subjects/society-culture.html", "subjects/trade.html", "subjects/traditional-medicine.html", "subjects/visual-arts.html", "subjects/yoga.html", "assets/app.css", "assets/app.js", "assets/extra.css", "assets/icons/apple-touch-icon.png", "assets/icons/favicon-32.png", "assets/icons/favicon.svg", "assets/icons/icon-192.png", "assets/icons/icon-512.png", "assets/icons/logo.svg", "assets/icons/maskable-512.png", "assets/images/favicon.png", "assets/javascripts/bundle.d7400e89.min.js", "assets/javascripts/workers/search.2c215733.min.js", "assets/library-data.js", "assets/mathjax.js", "assets/quiz.css", "assets/quiz.js", "assets/reader.css", "assets/reader.js", "assets/remote.css", "assets/remote.js", "assets/scans.css", "assets/scans.js", "assets/slides-deck.js", "assets/slides.css", "assets/slides.js", "assets/speak.css", "assets/speak.js", "assets/stylesheets/main.ec1eaa64.min.css", "assets/stylesheets/palette.ab4e12ef.min.css", "assets/theme.css", "assets/vendor/fonts/noto-serif-devanagari-400.woff2", "assets/vendor/fonts/noto-serif-devanagari-700.woff2", "assets/vendor/fonts/noto-serif-devanagari.OFL.txt", "assets/viz-kit.js", "assets/viz.css", "assets/viz.js"];
var BOOKS = ["classics-in-translation/my-reminiscences-tagore", "classics-in-translation/vikram-and-the-vampire", "classics-in-translation/yoga_sutras_johnston", "classics-in-translation/jataka_birth_stories", "classics-in-translation/mahabharata_ganguli", "bhakti-regional/sikh-religion-macauliffe-1", "classics-in-translation/dhammapada_muller", "classics-in-translation/shakuntala_ryder", "classics-in-translation/hindu_literature", "classics-in-translation/gitanjali-tagore", "rare-books/satapatha-brahmana-eggeling-5", "tales-folklore/katha-sarit-sagara-tawney", "tales-folklore/ancient-ballads-toru-dutt", "tales-folklore/indian-fairy-tales-jacobs", "bhakti-regional/ramayana-tulsidas-growse", "rare-books/ranade-upanisadic-philosophy", "rare-books/indian-architecture-manasara", "classics-in-translation/song_celestial", "classics-in-translation/ramayana_dutt", "rare-books/atharvaveda-whitney-lanman", "rare-books/pancavimsa-brahmana-caland", "rare-books/sankhya-philosophy-banerji", "tales-folklore/myths-hindus-buddhists", "rare-books/baudhayana-srauta-sutra-2", "rare-books/samanya-vedanta-upanisads", "rare-books/surya-siddhanta-wilkinson", "tales-folklore/cradle-tales-nivedita", "rare-books/hymns-rigveda-griffith-1", "rare-books/aitareya-brahmana-haug-2", "rare-books/aitareya-brahmana-haug-1", "rare-books/isha-upanishad-aurobindo", "rare-books/sushruta-samhita-jadavji", "rare-books/architecture-of-manasara", "tales-folklore/folk-tales-of-bengal", "rare-books/sushruta-bhishagratna-1", "rare-books/mahabharata-romesh-dutt", "rare-books/arthasastra-shamasastry", "rare-books/vedic-chronology-tilak", "rare-books/positive-sciences-seal", "tales-folklore/panchatantra-ryder", "rare-books/arthasamgraha-thibaut", "rare-books/hindu-chemistry-ray-1", "rare-books/hindu-chemistry-ray-2", "rare-books/gaina-sutras-jacobi-1", "rare-books/psalms-of-the-sisters", "rare-books/raja-yoga-vivekananda", "bhakti-regional/tiruvacagam-pope", "bhakti-regional/verses-of-vemana", "rare-books/ganita-sara-sangraha", "rare-books/sanskrit-drama-keith", "rare-books/arthasastra-ganapati", "rare-books/ideals-of-indian-art", "rare-books/upanisads-sankara-4", "rare-books/upanishads-muller-1", "rare-books/brihadaranyaka-roer", "rare-books/kesava-temple-belur", "rare-books/six-principal-ragas", "rare-books/laws-of-manu-buhler", "tales-folklore/old-deccan-days", "bhakti-regional/songs-of-kabir", "classics/abhijnana-sakuntalam", "rare-books/yoga-sara-sangraha", "rare-books/brihat-samhita-2-2", "rare-books/gita-rahasya-tilak", "rare-books/algebra-colebrooke", "rare-books/music-of-hindostan", "rare-books/aryabhatiya-clark", "classics/adhyatma-ramayanam", "classics/jayasi-granthavali", "classics/bird-of-time-naidu", "rare-books/sukraniti-sarkar", "rare-books/rigveda-wilson-4", "rare-books/rigveda-sayana-5", "rare-books/pancasiddhantika", "rare-books/ashtadhyayi-vasu", "rare-books/nighantu-nirukta", "bhakti-regional/kural-aiyar", "rare-books/sangita-darpana", "classics/rigveda-griffith", "classics/gitanjali-bangla", "classics/little-clay-cart", "rare-books/ayurvedasutram", "rare-books/dance-of-siva", "classics/sadhana-tagore", "classics/bhagavad-gita", "vol18_rajaniti_dharma", "vol19_vanijya_samudra", "classics/gita-govinda", "vol09_sangita_natya", "classics/raghuvamsa", "classics/tirukkural", "classics/anandamath", "classics/jnanesvari", "classics/sevasadan", "classics/meghaduta", "classics/amarakosa", "vol04_buddha_jina", "vol22_manas_siksa", "vol17_silpa_karu", "vol15_krsi_jiva", "vol23_jana_jati", "vol24_samanvaya", "vol02_upanisad", "vol13_ayurveda", "vol14_rasayana", "vol03_darsana", "vol07_itihasa", "vol12_jyotisa", "vol21_bhugola", "vol06_tantra", "vol11_ganita", "vol20_yuddha", "vol08_kavya", "vol10_sabda", "vol16_vastu", "vol01_veda", "vol05_yoga"];                           // the books' folders, longest first
var OTHER_SHELVES = [];                 // the folders of the library's other shelves inside this scope (their own workers)

var SCOPE = self.registration.scope;               // the site root, ending in "/"
var SCOPE_PATH = new URL(SCOPE).pathname;
var PRE = "bjp-";
// a site in a subfolder of its host (https://host/reserve/) names its own caches, so that two sites of one host
// never delete each other's caches when a new edition activates
var TAG = SCOPE_PATH === "/" ? "" : SCOPE_PATH.replace(/^\/+|\/+$/g, "").replace(/[^a-z0-9]+/gi, "-") + "-";
var SHELL_CACHE = PRE + TAG + "shell-" + VERSION;
var PAGES_CACHE = PRE + TAG + "pages-" + VERSION;
var STATIC_CACHE = PRE + TAG + "static-" + VERSION;
var OWN_CACHE = new RegExp("^" + PRE + TAG + "(?:shell|pages|static)-");
var EXT_CACHE = PRE + "ext";                         // fonts and MathJax: versioned URLs, kept across deploys
var KEEP_CACHE = PRE + "offline";                    // volumes kept for offline reading
var MAX_PAGES = 160, MAX_STATIC = 400, MAX_EXT = 160;
var SLOW_MS = 3500;                                  // after this, a cached page is shown while the network catches up
var STATIC_RE = /\.(css|js|mjs|json|png|jpe?g|gif|webp|avif|svg|ico|woff2?|ttf|otf|webmanifest|xml|txt)$/i;
var MATHJAX = "https://cdn.jsdelivr.net/npm/mathjax@";
var REMOTE_KEPT = "pk-remote-kept";                  // linked books kept for offline reading (written by assets/remote.js)
var REMOTE_CACHE = "pk-remote-recent", MAX_REMOTE = 80;   // the chapters of linked books read lately
var REMOTE_API = /^https:\/\/(?:[a-z-]+\.(?:wikibooks|wikisource)\.org\/w\/api\.php\?|raw\.githubusercontent\.com\/standardebooks\/[^?#]+\.xhtml$)/;
var REMOTE_IMG = /^https:\/\/(?:(?:upload|thumb)\.wikimedia\.org\/|raw\.githubusercontent\.com\/standardebooks\/[^?#]+\.(?:png|jpe?g|gif|svg|webp)$)/;

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
      return OWN_CACHE.test(k) && k.slice(-VERSION.length - 1) !== "-" + VERSION;
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

/* the text of a chapter of a linked book: from the source when it answers in time, else the copy on this device */
function remoteText(event, req) {
  var cached = function () { return matchIn(req.url, [REMOTE_KEPT, REMOTE_CACHE], { ignoreVary: true }); };
  var net = fetch(req);
  event.waitUntil(net.then(function (res) {
    if (!(res && res.ok && res.type !== "opaque")) return null;
    var copy = res.clone();
    return caches.open(REMOTE_CACHE).then(function (c) { return c.put(req.url, copy); }).then(function () { return trim(REMOTE_CACHE, MAX_REMOTE); });
  }).catch(function () { /* offline or storage full */ }));
  return new Promise(function (resolve) {
    var done = false;
    function finish(r) { if (!done) { done = true; resolve(r); } }
    var timer = setTimeout(function () { cached().then(function (r) { if (r) finish(r); }); }, SLOW_MS);
    net.then(function (res) { clearTimeout(timer); finish(res); }, function () {
      clearTimeout(timer);
      cached().then(function (r) { finish(r || Response.error()); });
    });
  });
}

function remoteImage(event, req) {
  return matchIn(req.url, [REMOTE_KEPT], { ignoreVary: true }).then(function (hit) { return hit || fetch(req); }, function () { return fetch(req); });
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
    for (var s = 0; s < OTHER_SHELVES.length; s++) if (url.pathname.indexOf(OTHER_SHELVES[s]) === 0) return;
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
  if (REMOTE_API.test(req.url)) { event.respondWith(remoteText(event, req)); return; }
  if (REMOTE_IMG.test(req.url)) { event.respondWith(remoteImage(event, req)); return; }
  if (url.hostname === "fonts.googleapis.com") event.respondWith(staleWhileRevalidate(event, req, EXT_CACHE));
  else if (url.hostname === "fonts.gstatic.com" || req.url.indexOf(MATHJAX) === 0) event.respondWith(cacheFirst(event, req, EXT_CACHE, MAX_EXT));
});

/* Pustakālaya: web edition. The reading app: library, offline books, updates.
 *
 *  - the shelf on the home page: a tap on a cover opens the book in the reader (reader.js) at the place last
 *    read, or at its start; each cover shows how far through the book the reader is; "Continue reading" lists the
 *    books opened last; a row of collection buttons and a title search filter the covers. The records come from
 *    localStorage ("bjp.books", kept by the reader);
 *  - "Keep for offline reading" on the home page and on each volume's first page: every page and image of
 *    the volume (listed in library.json, written at build time by tools/site_hooks.py) is stored in the
 *    "bjp-offline" cache, which the service worker (sw.js) reads when there is no connection;
 *  - a notice when a new edition of the site has been installed in the background ("Updated - reload");
 *  - a Back button in the header when the site runs as an installed app (which has no browser toolbar).
 *
 * Without localStorage, the Cache API or service workers the parts that need them are simply not shown.
 */
(function () {
  "use strict";
  if (window.__bjpApp) return;
  window.__bjpApp = true;

  var ROOT = (function () {
    var s = document.currentScript && document.currentScript.src;
    if (!s) { var e = document.querySelector('script[src*="assets/app.js"]'); s = e && e.src; }
    try { return new URL("../", s || location.href).href; } catch (x) { return location.origin + "/"; }
  })();
  var ROOT_PATH = new URL(ROOT).pathname;
  var KEY_LAST = "bjp.reader.last", KEY_POS = "bjp.reader.pos", KEY_OPEN = "bjp.reader.open",
      KEY_GOTO = "bjp.reader.goto", KEY_SEEN = "bjp.lib.seen", KEY_SUP = "bjp.reader.suppress",
      KEY_BOOKS = "bjp.books", KEY_COVER = "bjp.reader.cover";
  var KEEP = "bjp-offline", EXT = "bjp-ext", META = ROOT + "offline-meta/";
  var CAN_KEEP = !!(window.caches && window.fetch && "serviceWorker" in navigator && window.isSecureContext);
  var STANDALONE = !!((window.matchMedia && (matchMedia("(display-mode: standalone)").matches ||
      matchMedia("(display-mode: fullscreen)").matches)) || navigator.standalone === true);
  var ICON = {
    keep: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4z"/></svg>',
    kept: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4z"/><path d="M9 9.5l2.2 2.2L15.5 7.5"/></svg>',
    book: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 7c-1.6-1.3-3.9-2-8-2v13c4.1 0 6.4.7 8 2 1.6-1.3 3.9-2 8-2V5c-4.1 0-6.4.7-8 2zM12 7v13"/></svg>',
    back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>'
  };

  /* ---------------------------------------------------------------- helpers */
  function noop() {}
  function store(kind) { try { return window[kind]; } catch (e) { return null; } }
  function sget(kind, k) { try { var s = store(kind); return s ? s.getItem(k) : null; } catch (e) { return null; } }
  function sset(kind, k, v) { try { var s = store(kind); if (s) s.setItem(k, v); } catch (e) { /* unavailable */ } }
  function sdel(kind, k) { try { var s = store(kind); if (s) s.removeItem(k); } catch (e) { /* unavailable */ } }
  function jget(k, d) { try { var v = sget("localStorage", k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function jset(k, v) { try { sset("localStorage", k, JSON.stringify(v)); } catch (e) { /* unavailable */ } }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function mb(bytes) {
    var m = bytes / 1e6;
    return m < 0.1 ? "under 0.1 MB" : (m < 10 ? m.toFixed(1) : String(Math.round(m))) + " MB";
  }
  function plural(n, one, many) { return n + " " + (n === 1 ? one : many); }
  function ago(t) {
    var s = (Date.now() - t) / 1000;
    if (s < 90) return "just now";
    if (s < 3600) return plural(Math.round(s / 60), "minute", "minutes") + " ago";
    if (s < 86400) return plural(Math.round(s / 3600), "hour", "hours") + " ago";
    if (s < 2 * 86400) return "yesterday";
    if (s < 14 * 86400) return Math.round(s / 86400) + " days ago";
    return "on " + dateText(t);
  }
  function dateText(t) {
    try { return new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }); }
    catch (e) { return new Date(t).toDateString(); }
  }
  /* The books' folders come from library.yml, through a JSON list in the page head (id, path relative to the
     site root). "/…/vol16_vastu/chapter03_x.html" -> ["vol16_vastu", "chapter03_x"]; null outside the books. */
  var BOOKS = (function () {
    try { var e = document.getElementById("bjp-books"); return e ? JSON.parse(e.textContent) : null; } catch (x) { return null; }
  })();
  var BOOK_ROOT = (function () {
    var s = document.currentScript && document.currentScript.src;
    if (!s) { var e = document.querySelector('script[src*="assets/app.js"]'); s = e && e.src; }
    try { return new URL("../", s || location.href).pathname; } catch (x) { return "/"; }
  })();
  function volOf(path) {
    path = path || "";
    if (BOOKS && BOOKS.length) {
      if (path.indexOf(BOOK_ROOT) !== 0) return null;
      var rel = path.slice(BOOK_ROOT.length), best = null;
      for (var i = 0; i < BOOKS.length; i++) {
        var pre = BOOKS[i].path + "/";
        if (rel.indexOf(pre) === 0 && (!best || pre.length > best.path.length + 1)) best = BOOKS[i];
      }
      if (!best) return null;
      var rest = rel.slice(best.path.length + 1);
      if (rest === "") return [best.id, "index"];
      return /^[^\/]+\.html$/.test(rest) ? [best.id, rest.replace(/\.html$/, "")] : null;
    }
    var m = /\/(vol\d\d_[^\/]+)\/([^\/]*?)(?:\.html)?$/.exec(path);
    return m ? [m[1], m[2] || "index"] : null;
  }
  function isHome() {
    var p = location.pathname;
    return p === ROOT_PATH || p === ROOT_PATH + "index.html";
  }
  function online() { return navigator.onLine !== false; }

  /* ---------------------------------------------------------------- data: library.json and kept volumes */
  var st = { lib: null, meta: {}, jobs: {}, errors: {}, ready: null };
  var libP = null;
  function library() {
    if (!libP) {
      libP = fetch(ROOT + "library.json", { credentials: "same-origin" }).then(function (r) {
        if (!r.ok) throw new Error("library " + r.status);
        return r.json();
      }).then(function (lib) { st.lib = lib; return lib; }).catch(function () { libP = null; return null; });
    }
    return libP;
  }
  function findVol(vid) {
    var vs = st.lib && st.lib.books || [];
    for (var i = 0; i < vs.length; i++) if (vs[i].id === vid) return vs[i];
    return null;
  }
  function openKeep() { return caches.open(KEEP); }
  function loadMeta() {
    if (!CAN_KEEP) return Promise.resolve({});
    return openKeep().then(function (c) {
      return c.keys().then(function (keys) {
        return Promise.all(keys.filter(function (k) { return k.url.indexOf(META) === 0; }).map(function (k) {
          return c.match(k).then(function (r) { return r ? r.json() : null; }).catch(function () { return null; });
        }));
      });
    }).then(function (list) {
      var out = {};
      list.forEach(function (m) { if (m && m.vid) out[m.vid] = m; });
      st.meta = out;
      return out;
    }).catch(function () { return {}; });
  }
  function ready() {
    if (!st.ready) st.ready = Promise.all([library(), loadMeta()]);
    return st.ready;
  }
  function requestPersist() {
    try {
      if (navigator.storage && navigator.storage.persist) {
        navigator.storage.persisted().then(function (p) { return p || navigator.storage.persist(); }).catch(noop);
      }
    } catch (e) { /* not supported */ }
  }
  function estimate() {
    try {
      if (navigator.storage && navigator.storage.estimate) return navigator.storage.estimate().catch(function () { return null; });
    } catch (e) { /* not supported */ }
    return Promise.resolve(null);
  }

  /* ---------------------------------------------------------------- keeping and removing a volume */
  function fetchForKeep(url, tries) {
    // the header tells the service worker to pass the request through (the copy goes into the volume cache only)
    return fetch(url, { credentials: "same-origin", cache: "no-cache", headers: { "X-BJP-Keep": "1" } }).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r;
    }).catch(function (e) {
      if (tries > 0 && online()) return new Promise(function (res) { setTimeout(res, 600); }).then(function () { return fetchForKeep(url, tries - 1); });
      throw e;
    });
  }

  function keep(vid, quiet) {
    if (!CAN_KEEP) return Promise.resolve();
    if (st.jobs[vid]) return st.jobs[vid].promise;
    var job = { done: 0, total: 0, failed: 0, cancel: false, quiet: !!quiet };
    st.jobs[vid] = job;
    delete st.errors[vid];
    if (!quiet) requestPersist();
    emit(vid);
    job.promise = library().then(function (lib) {
      var v = findVol(vid);
      if (!lib || !v) throw new Error("no list");
      var urls = v.pages.concat(v.files).map(function (u) { return ROOT + u; });
      var ext = v.math ? lib.mathjax || [] : [];
      job.total = urls.length + ext.length;
      emit(vid);
      return openKeep().then(function (cache) {
        var i = 0;
        function worker() {
          if (job.cancel || i >= urls.length) return Promise.resolve();
          var u = urls[i++];
          return fetchForKeep(u, 1).then(function (r) { return cache.put(u, r); })
            .catch(function () { job.failed++; })
            .then(function () { job.done++; emit(vid); return worker(); });
        }
        var ws = [];
        for (var k = 0; k < 4; k++) ws.push(worker());
        return Promise.all(ws).then(function () {
          if (job.cancel || !ext.length) return null;
          // MathJax and its fonts, for the mathematics of this volume (kept with the other external files)
          return caches.open(EXT).then(function (ec) {
            return Promise.all(ext.map(function (u) {
              return ec.match(u).then(function (hit) { return hit || ec.add(u); }).catch(noop)
                .then(function () { job.done++; emit(vid); });
            }));
          });
        }).then(function () {
          if (job.cancel) {
            return Promise.all([cache.delete(META + vid), removeFrom(cache, vid, null)]).then(function () { delete st.meta[vid]; libStatus(); });
          }
          if (job.failed) throw new Error("incomplete");
          var m = { vid: vid, hash: v.hash, bytes: v.bytes, count: urls.length, t: Date.now(), version: lib.version };
          return cache.put(META + vid, new Response(JSON.stringify(m), { headers: { "Content-Type": "application/json" } }))
            .then(function () { st.meta[vid] = m; return removeFrom(cache, vid, urls); });
        });
      });
    }).then(function () {
      delete st.jobs[vid];
      emit(vid);
      libStatus();
    }, function () {
      delete st.jobs[vid];
      if (!job.cancel) st.errors[vid] = job.failed ? plural(job.failed, "file", "files") + " could not be stored." : "The list of pages could not be loaded.";
      emit(vid);
    });
    return job.promise;
  }

  /* delete the volume's entries from the cache; with keepList, only those no longer in the volume */
  function removeFrom(cache, vid, keepList) {
    var v = findVol(vid);
    var prefix = ROOT + (v ? v.path : vid) + "/";
    return cache.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) {
        return k.url.indexOf(prefix) === 0 && (!keepList || keepList.indexOf(k.url) < 0);
      }).map(function (k) { return cache.delete(k); }));
    });
  }

  function remove(vid) {
    if (!CAN_KEEP) return Promise.resolve();
    var job = st.jobs[vid];
    if (job) { job.cancel = true; return job.promise; }
    return openKeep().then(function (c) {
      return Promise.all([c.delete(META + vid), removeFrom(c, vid, null)]);
    }).then(function () {
      delete st.meta[vid];
      delete st.errors[vid];
      emit(vid);
      libStatus();
    }).catch(noop);
  }

  /* kept volumes are brought up to date after a new edition has been published */
  function refreshKept() {
    if (!CAN_KEEP || !online() || refreshKept.done) return;
    refreshKept.done = true;
    ready().then(function () {
      Object.keys(st.meta).forEach(function (vid) {
        var v = findVol(vid);
        if (v && st.meta[vid].hash !== v.hash) keep(vid, true);
      });
    });
  }

  /* ---------------------------------------------------------------- rendering the offline controls */
  function state(vid) {
    var job = st.jobs[vid], m = st.meta[vid];
    if (job && !(job.quiet && m)) return "busy";
    if (m) return "kept";
    if (st.errors[vid]) return "error";
    return "idle";
  }
  function pct(job) { return job && job.total ? Math.round(job.done / job.total * 100) : 0; }
  function volSummary(v) {
    if (!v) return "";
    var imgs = v.files.length;
    return plural(v.pages.length, "page", "pages") + (imgs ? " and " + plural(imgs, "figure or photograph", "figures and photographs") : "") +
      ", about " + mb(v.bytes);
  }

  function emit(vid) {
    var i, list = document.querySelectorAll('.bjp-offline[data-vol="' + vid + '"]');
    for (i = 0; i < list.length; i++) renderBox(list[i], vid);
    list = document.querySelectorAll('.vol-item[data-vol="' + vid + '"]');
    for (i = 0; i < list.length; i++) renderCardFooter(list[i], vid);
  }
  function emitAll() {
    var seen = {}, i, list = document.querySelectorAll(".bjp-offline[data-vol], .vol-item[data-vol]");
    for (i = 0; i < list.length; i++) {
      var vid = list[i].getAttribute("data-vol");
      if (!seen[vid]) { seen[vid] = 1; emit(vid); }
    }
  }

  /* the panel on a volume's first page */
  function renderBox(box, vid) {
    if (!CAN_KEEP) return;
    if (!box.__bjp) {
      box.__bjp = true;
      box.innerHTML =
        '<div class="bo-main"><span class="bo-icon"></span>' +
        '<div class="bo-text"><span class="bo-title"></span><span class="bo-sub" role="status" aria-live="polite"></span></div>' +
        '<div class="bo-actions"><button type="button" class="bo-btn"></button></div></div>' +
        '<div class="bo-bar" hidden><i></i></div>';
      box.querySelector(".bo-btn").addEventListener("click", function () { act(vid); });
    }
    var s = state(vid), v = findVol(vid), m = st.meta[vid], job = st.jobs[vid];
    var title, sub, btn, btnCls = "bo-btn", icon = ICON.keep, disabled = false;
    if (s === "busy") {
      title = "Keeping this book for offline reading…";
      sub = job.total ? job.done + " of " + job.total + " files (" + pct(job) + "%)" : "Preparing…";
      btn = "Cancel";
      btnCls += " bo-quiet";
    } else if (s === "kept") {
      title = "Available offline";
      icon = ICON.kept;
      sub = "Kept on this device " + ago(m.t).replace(/^on /, "on ") + " · about " + mb(m.bytes) +
        (job ? " · updating to the new edition…" : "");
      btn = "Remove from this device";
      btnCls += " bo-quiet";
    } else if (s === "error") {
      title = "Not everything could be kept";
      sub = st.errors[vid] + " Check the connection and try again.";
      btn = "Try again";
    } else {
      title = "Read this book without a connection";
      sub = v ? volSummary(v) + "." : "Every chapter, the front and back matter and the figures.";
      btn = "Keep for offline reading";
      if (!online()) { disabled = true; sub = "Connect to the internet to keep this book."; }
    }
    box.className = "bjp-offline is-" + s;
    box.querySelector(".bo-icon").innerHTML = icon;
    box.querySelector(".bo-title").textContent = title;
    box.querySelector(".bo-sub").textContent = sub;
    var b = box.querySelector(".bo-btn");
    b.textContent = btn;
    b.className = btnCls;
    b.disabled = disabled;
    var bar = box.querySelector(".bo-bar");
    bar.hidden = s !== "busy";
    bar.firstChild.style.width = pct(job) + "%";
  }

  /* the footer of a volume card on the home page */
  function renderCardFooter(item, vid) {
    var unavailable = !online() && !st.meta[vid];
    item.classList.toggle("is-unavailable", unavailable && CAN_KEEP);
    if (!CAN_KEEP) return;
    var f = item.querySelector(".vol-off");
    if (!f) {
      f = el("div", "vol-off",
        '<span class="vo-state" role="status" aria-live="polite"></span><button type="button" class="vo-btn"></button><span class="vo-bar" hidden><i></i></span>');
      item.appendChild(f);
      item.classList.add("has-off");
      f.querySelector(".vo-btn").addEventListener("click", function () { act(vid); });
    }
    var s = state(vid), v = findVol(vid), m = st.meta[vid], job = st.jobs[vid];
    var name = item.querySelector(".vol-title");
    var vname = name ? name.textContent : "this book";
    var text, btn, label;
    if (s === "busy") { text = "Keeping… " + pct(job) + "%"; btn = "Cancel"; label = "Stop keeping " + vname; }
    else if (s === "kept") { text = ICON.kept + "<span>Available offline" + (job ? " (updating)" : "") + "</span>"; btn = "Remove"; label = "Remove " + vname + " from this device"; }
    else if (s === "error") { text = "Not fully kept"; btn = "Try again"; label = "Try again to keep " + vname + " for offline reading"; }
    else { text = v ? "about " + mb(v.bytes) : ""; btn = "Keep for offline reading"; label = "Keep " + vname + " for offline reading"; }
    if (s === "kept") f.querySelector(".vo-state").innerHTML = text;
    else f.querySelector(".vo-state").textContent = text;
    var b = f.querySelector(".vo-btn");
    b.textContent = btn;
    b.setAttribute("aria-label", label);
    b.disabled = s === "idle" && !online();
    f.className = "vol-off is-" + s;
    var bar = f.querySelector(".vo-bar");
    bar.hidden = s !== "busy";
    bar.firstChild.style.width = pct(job) + "%";
  }

  function act(vid) {
    var s = state(vid);
    if (s === "busy" || s === "kept") remove(vid);
    else keep(vid, false);
  }

  /* ---------------------------------------------------------------- the shelf: progress, continue reading, opening a book */
  /* "bjp.books" holds one record per book that has been read: {path, title, f, pct, mode, t}: the page last
     read, its title, how far through that page (f), how far through the whole book (pct, in percent: an estimate
     from the length of each chapter in <book>/contents.json, written by reader.js), and when. */
  function booksRec() { var b = jget(KEY_BOOKS, {}); return b && typeof b === "object" ? b : {}; }
  function migrate() {
    // a book read before the records above existed: the last chapter read (bjp.reader.last) becomes its record
    var all = booksRec(), last = jget(KEY_LAST, null);
    if (last && last.path && last.vol && !all[last.vol]) {
      all[last.vol] = { path: last.path, title: last.title, f: last.f, mode: last.mode, t: last.t };
      jset(KEY_BOOKS, all);
    }
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function norm(s) { return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim(); }
  function reducedMotion() { return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches; }

  function seenPages(vid) {
    var out = {}, all = jget(KEY_SEEN, {}) || {}, rec = all[vid], k;
    if (rec && Array.isArray(rec.p)) rec.p.forEach(function (p) { out[p] = 1; });
    var pos = jget(KEY_POS, {}) || {};
    for (k in pos) {
      var v = volOf(k);
      if (v && v[0] === vid && v[1] !== "index") out[v[1]] = 1;
    }
    return Object.keys(out).length;
  }

  /* each cover: a thin progress bar and the percentage once the book has been read */
  function markStarted() {
    var all = booksRec(), items = document.querySelectorAll(".vol-item[data-vol]");
    for (var i = 0; i < items.length; i++) {
      var it = items[i], vid = it.getAttribute("data-vol"), rec = all[vid];
      var pct = rec && typeof rec.pct === "number" ? clamp(rec.pct, 0, 100) : null;
      var started = !!(rec && rec.path) || seenPages(vid) > 0;
      var card = it.querySelector(".vol-card"), row = it.querySelector(".vol-prog");
      it.classList.toggle("is-started", started);
      var old = it.querySelector(".vol-started");
      if (old) old.parentNode.removeChild(old);
      if (!started || !card) { if (row) row.parentNode.removeChild(row); continue; }
      if (!row) {
        row = el("span", "vol-prog");
        var cv = card.querySelector(".book-cover");
        if (cv) cv.insertAdjacentElement("afterend", row); else card.appendChild(row);
      }
      if (pct === null) { row.innerHTML = '<span class="vp-text">Started</span>'; continue; }
      var shown = pct >= 100 ? 100 : Math.max(0, Math.min(99, Math.round(pct)));
      row.innerHTML = '<span class="vp-bar" role="progressbar" aria-label="Progress in this book" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' +
        shown + '"><i style="width:' + shown + '%"></i></span><span class="vp-pct">' + shown + '%<span class="bjp-sr"> read</span></span>';
    }
  }

  /* where a tap on a cover (or on a "Continue reading" card) takes the reader: the page last read, else the start */
  function resumeTarget(vid) {
    var v = findVol(vid), rec = booksRec()[vid];
    if (rec && rec.path && rec.path.indexOf(ROOT_PATH) === 0 && (!v || v.pages.indexOf(rec.path.slice(ROOT_PATH.length)) >= 0)) {
      return { url: location.origin + rec.path, rec: rec };
    }
    if (v) return { url: location.origin + ROOT_PATH + v.path + "/" + (v.start || "index.html"), rec: null };
    return null;
  }
  function coverLook(item) {
    var card = item && item.querySelector(".vol-card");
    if (!card) return null;
    var cs = getComputedStyle(card), t = item.querySelector(".vol-title"), s = item.querySelector(".vol-sub");
    return { bg: cs.getPropertyValue("--cv-bg").trim(), fg: cs.getPropertyValue("--cv-fg").trim(), accent: cs.getPropertyValue("--cv-accent").trim(),
      title: t ? t.textContent : "", sub: s ? s.textContent : "", lang: t && t.getAttribute("lang") || "" };
  }
  function openBook(vid, item) {
    var look = coverLook(item || document.querySelector('.vol-item[data-vol="' + vid + '"]'));
    return library().then(function () {
      var t = resumeTarget(vid);
      if (!t) return false;
      sdel("sessionStorage", KEY_SUP);
      sset("sessionStorage", KEY_OPEN, "1");
      if (t.rec && t.rec.mode === "scroll" && typeof t.rec.f === "number") sset("sessionStorage", KEY_GOTO, JSON.stringify({ path: t.rec.path, f: t.rec.f }));
      else sdel("sessionStorage", KEY_GOTO);
      if (look) sset("sessionStorage", KEY_COVER, JSON.stringify(look)); else sdel("sessionStorage", KEY_COVER);
      curtainThen(t.url, look);
      return true;
    });
  }
  /* a brief, quiet opening: the cover's colour fills the screen while the reader loads (reader.js lifts it) */
  function curtainThen(url, look) {
    if (reducedMotion() || !look || !look.bg || !document.body) { location.assign(url); return; }
    var c = el("div", "bjp-curtain");
    c.setAttribute("aria-hidden", "true");
    c.style.background = look.bg;
    c.style.color = look.fg || "#fff";
    c.innerHTML = '<span class="bjp-cu-title"' + (look.lang ? ' lang="' + esc(look.lang) + '"' : "") + ">" + esc(look.title) + "</span>";
    document.body.appendChild(c);
    void c.offsetWidth;
    c.classList.add("on");
    setTimeout(function () { location.assign(url); }, 230);
    setTimeout(function () { if (c.parentNode) c.parentNode.removeChild(c); }, 6000);
  }
  window.addEventListener("pageshow", function (e) {
    if (!e.persisted) return;
    var cs = document.querySelectorAll(".bjp-curtain");
    for (var i = 0; i < cs.length; i++) cs[i].parentNode.removeChild(cs[i]);
  });
  function onShelfClick(e) {
    if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest ? e.target.closest("a.vol-card, a.bc-item") : null;
    if (!a) return;
    var item = a.closest("[data-vol]");
    var vid = item && item.getAttribute("data-vol");
    if (!vid) return;
    e.preventDefault();
    e.stopPropagation();
    var shelfItem = document.querySelector('.vol-item[data-vol="' + vid + '"]');
    if (shelfItem) shelfItem.classList.add("is-opening");
    openBook(vid, shelfItem).then(function (ok) { if (!ok) location.assign(a.href); }, function () { location.assign(a.href); });
  }
  document.addEventListener("click", onShelfClick, true);

  /* "Continue reading": the books opened last, most recent first */
  function renderContinue() {
    var box = document.querySelector(".bjp-continue");
    if (!box) return;
    var all = booksRec(), list = [];
    Object.keys(all).forEach(function (vid) {
      var r = all[vid], item = document.querySelector('.vol-item[data-vol="' + vid + '"]');
      if (!r || !r.path || !r.t || !item) return;
      var v = findVol(vid);
      if (st.lib && v && r.path.indexOf(ROOT_PATH) === 0 && v.pages.indexOf(r.path.slice(ROOT_PATH.length)) < 0) return;
      list.push({ vid: vid, r: r, item: item });
    });
    list.sort(function (a, b) { return b.r.t - a.r.t; });
    list = list.slice(0, 8);
    if (!list.length) { box.hidden = true; box.innerHTML = ""; return; }
    var html = '<h2 class="bc-head" id="bc-head">Continue reading</h2><ul class="bc-list" aria-labelledby="bc-head">';
    list.forEach(function (x) {
      var cover = x.item.querySelector(".book-cover"), card = x.item.querySelector(".vol-card"), title = x.item.querySelector(".vol-title");
      var lang = title && title.getAttribute("lang");
      var pct = typeof x.r.pct === "number" ? (x.r.pct >= 100 ? 100 : Math.max(0, Math.min(99, Math.round(x.r.pct)))) : null;
      var unavailable = !online() && CAN_KEEP && !st.meta[x.vid];
      html += '<li><a class="bc-item" data-vol="' + esc(x.vid) + '" href="' + esc(location.origin + x.r.path) + '" style="' + esc(card ? card.getAttribute("style") || "" : "") + '">' +
        '<span class="bc-cover" aria-hidden="true">' + (cover ? cover.outerHTML : "") + '</span>' +
        '<span class="bc-info"><span class="bc-title"' + (lang ? ' lang="' + esc(lang) + '"' : "") + ">" + esc(title ? title.textContent : "") + "</span>" +
        '<span class="bc-ch">' + esc(x.r.title || "") + "</span>" +
        (pct === null ? "" : '<span class="bc-bar" role="progressbar" aria-label="Progress in this book" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '"><i style="width:' + pct + '%"></i></span>') +
        '<span class="bc-meta">' + (pct === null ? "" : pct + "% · ") + esc(ago(x.r.t)) + (unavailable ? " · not kept for offline reading" : "") + "</span></span>" +
        '<span class="bc-go">' + ICON.book + '<span>Resume</span></span></a></li>';
    });
    box.innerHTML = html + "</ul>";
    box.hidden = false;
  }

  /* the filter row (collections) and the title search above the shelves */
  function wireShelf() {
    var tools = document.querySelector(".bjp-shelf-tools");
    if (!tools || tools.__bjp) return;
    tools.__bjp = true;
    tools.hidden = false;
    var input = tools.querySelector("input"), chips = tools.querySelectorAll(".bjp-chip");
    var none = document.querySelector(".bjp-none");
    var coll = "", q = "";
    function apply() {
      var secs = document.querySelectorAll(".bjp-coll"), total = 0, i, k;
      for (i = 0; i < secs.length; i++) {
        var sec = secs[i], show = !coll || sec.getAttribute("data-collection") === coll, n = 0;
        var items = sec.querySelectorAll(".vol-item");
        for (k = 0; k < items.length; k++) {
          var t = items[k].querySelector(".vol-title"), s = items[k].querySelector(".vol-sub");
          var hit = !q || norm((t ? t.textContent : "") + " " + (s ? s.textContent : "")).indexOf(q) >= 0;
          items[k].hidden = !hit;
          if (hit) n++;
        }
        sec.hidden = !show || n === 0;
        sec.classList.toggle("is-filtering", !!q);
        if (show) total += n;
      }
      if (none) none.hidden = total > 0;
    }
    for (var c = 0; c < chips.length; c++) {
      chips[c].addEventListener("click", function () {
        coll = this.getAttribute("data-coll") || "";
        for (var j = 0; j < chips.length; j++) chips[j].setAttribute("aria-pressed", String(chips[j] === this));
        apply();
      });
    }
    input.addEventListener("input", function () { q = norm(input.value); apply(); });
    input.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && input.value) { input.value = ""; q = ""; apply(); }
    });
  }

  function libStatus() {
    var box = document.querySelector(".bjp-lib-status");
    if (!box || !CAN_KEEP) return;
    var kept = Object.keys(st.meta);
    if (!kept.length) { box.hidden = true; return; }
    var bytes = kept.reduce(function (a, k) { return a + (st.meta[k].bytes || 0); }, 0);
    box.textContent = plural(kept.length, "book is", "books are").replace(/^1 book is/, "One book is") +
      " kept on this device for offline reading (about " + mb(bytes) + ").";
    box.hidden = false;
    estimate().then(function (e) {
      if (e && e.usage && box.isConnected) box.textContent += " Storage used by this site in the browser: about " + mb(e.usage) + ".";
    });
  }

  /* ---------------------------------------------------------------- the offline page */
  function renderOfflinePage() {
    var box = document.querySelector(".bjp-offline-list");
    if (!box) return;
    var from = null;
    try { from = new URL(location.href).searchParams.get("from"); } catch (e) { from = null; }
    var retry = document.querySelector(".bjp-retry a");
    if (retry && from && !/^[a-z]+:|^\/\//i.test(from)) retry.setAttribute("href", ROOT + from.replace(/^\/+/, ""));
    var kept = Object.keys(st.meta).sort();
    if (!CAN_KEEP) { box.innerHTML = ""; return; }
    if (!kept.length) { box.innerHTML = "<p>No book is kept on this device yet.</p>"; return; }
    box.innerHTML = "<p><strong>Kept on this device:</strong></p><ul>" + kept.map(function (vid) {
      var v = findVol(vid);
      return '<li><a href="' + esc(ROOT + (v ? v.path : vid) + "/index.html") + '">' + esc(v ? (v.label ? v.label + ": " : "") + v.title : vid) + "</a></li>";
    }).join("") + "</ul>";
  }

  /* ---------------------------------------------------------------- installed app: back button, offline mark */
  function setupChrome() {
    var root = document.documentElement;
    root.classList.toggle("bjp-standalone", STANDALONE);
    root.classList.toggle("bjp-is-offline", !online());
    var hdr = document.querySelector(".md-header__inner");
    if (!hdr) return;
    if (STANDALONE && !hdr.querySelector(".bjp-backbtn")) {
      var b = el("button", "md-header__button bjp-backbtn", ICON.back);
      b.type = "button";
      b.setAttribute("aria-label", "Back");
      b.title = "Back";
      b.addEventListener("click", function () {
        var here = location.href;
        history.back();
        setTimeout(function () { if (location.href === here) location.href = ROOT + "index.html"; }, 450);
      });
      var title = hdr.querySelector(".md-header__title");
      hdr.insertBefore(b, title || hdr.firstChild);
    }
    var bb = hdr.querySelector(".bjp-backbtn");
    if (bb) bb.hidden = isHome();
    if (!hdr.querySelector(".bjp-netmark")) {
      var m = el("span", "bjp-netmark", "Offline");
      m.setAttribute("role", "status");
      var t2 = hdr.querySelector(".md-header__title");
      if (t2) t2.insertAdjacentElement("afterend", m); else hdr.appendChild(m);
    }
  }

  /* ---------------------------------------------------------------- updates: "Updated - reload" */
  var wantReload = false;
  function showUpdate(reg) {
    if (document.querySelector(".bjp-toast")) return;
    var t = el("div", "bjp-toast",
      '<span class="bt-text">Updated — a new edition is ready.</span>' +
      '<button type="button" class="bt-reload">Reload</button>' +
      '<button type="button" class="bt-close" aria-label="Dismiss">' + ICON.close + "</button>");
    t.setAttribute("role", "status");
    document.body.appendChild(t);
    t.querySelector(".bt-reload").addEventListener("click", function () {
      wantReload = true;
      if (reg && reg.waiting) reg.waiting.postMessage({ type: "skip-waiting" });
      else location.reload();
      setTimeout(function () { location.reload(); }, 3000);
    });
    t.querySelector(".bt-close").addEventListener("click", function () { t.parentNode.removeChild(t); });
  }
  function watchUpdates() {
    if (!("serviceWorker" in navigator)) return;
    var sw = navigator.serviceWorker, reloading = false, lastCheck = Date.now();
    sw.addEventListener("controllerchange", function () {
      if (wantReload && !reloading) { reloading = true; location.reload(); }
    });
    sw.ready.then(function (reg) {
      function track(w) {
        if (!w) return;
        w.addEventListener("statechange", function () { if (w.state === "installed" && sw.controller) showUpdate(reg); });
      }
      if (reg.waiting && sw.controller) showUpdate(reg);
      track(reg.installing);
      reg.addEventListener("updatefound", function () { track(reg.installing); });
      // an installed app can stay open for days: look for a new edition when it comes back to the front
      document.addEventListener("visibilitychange", function () {
        if (!document.hidden && Date.now() - lastCheck > 30 * 60 * 1000) { lastCheck = Date.now(); reg.update().catch(noop); }
      });
    }).catch(noop);
  }

  /* ---------------------------------------------------------------- a book's contents: expand / collapse all */
  function wireContents() {
    var boxes = document.querySelectorAll("nav.vol-contents");
    for (var i = 0; i < boxes.length; i++) {
      var box = boxes[i];
      if (box.__bjp || !box.querySelector("details")) continue;
      box.__bjp = true;
      var tools = el("div", "vc-tools",
        '<button type="button" data-open="1">Expand all sections</button><button type="button" data-open="0">Collapse all</button>');
      tools.setAttribute("role", "group");
      tools.setAttribute("aria-label", "Contents");
      tools.addEventListener("click", function (e) {
        var b = e.target.closest("button");
        if (!b) return;
        var ds = this.parentNode.querySelectorAll("details");
        for (var k = 0; k < ds.length; k++) ds[k].open = b.getAttribute("data-open") === "1";
      });
      box.insertBefore(tools, box.firstChild);
    }
  }

  /* ---------------------------------------------------------------- start */
  function onPage() {
    setupChrome();
    wireContents();
    migrate();
    wireShelf();
    markStarted();
    renderContinue();
    emitAll();
    ready().then(function () {
      markStarted();
      renderContinue();
      emitAll();
      libStatus();
      renderOfflinePage();
    });
  }
  function onNet() {
    document.documentElement.classList.toggle("bjp-is-offline", !online());
    emitAll();
    renderContinue();
    if (online()) refreshKept();
  }

  /* the search covers the book of the page that was loaded in full (the service worker answers the theme's request
     for the index with that book's index; on the shelf, the titles of the library). A link to another book, or
     between a book and the shelf, therefore loads the page in full, so that the search follows the reader */
  var SEARCH_SCOPE = (function () { var v = volOf(location.pathname); return v ? v[0] : ""; })();
  function searchPlaceholder() {
    if (!(navigator.serviceWorker && navigator.serviceWorker.controller)) return;
    var q = document.querySelector(".md-search__input");
    if (q) q.setAttribute("placeholder", SEARCH_SCOPE ? "Search this book" : "Search titles");
  }
  document.addEventListener("click", function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target && e.target.closest && e.target.closest("a[href]");
    if (!a || (a.target && a.target !== "_self")) return;
    var u;
    try { u = new URL(a.getAttribute("href"), location.href); } catch (x) { return; }
    if (u.origin !== location.origin || u.pathname.indexOf(BOOK_ROOT) !== 0 || u.pathname === location.pathname) return;
    var v = volOf(u.pathname);
    if ((v ? v[0] : "") === SEARCH_SCOPE) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    location.href = u.href;
  }, true);
  searchPlaceholder();
  if (window.document$ && window.document$.subscribe) window.document$.subscribe(searchPlaceholder);

  window.addEventListener("online", onNet);
  window.addEventListener("offline", onNet);
  window.bjpApp = { keep: keep, remove: remove, state: st, root: ROOT };
  watchUpdates();
  if (window.document$ && window.document$.subscribe) window.document$.subscribe(onPage);
  else if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", onPage);
  else onPage();
  setTimeout(refreshKept, 4000);
})();

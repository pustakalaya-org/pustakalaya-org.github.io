/* Pustakālaya: web edition. Reading mode ("Read").
 *
 * A full-screen, paginated reader for the chapter pages. The text of the page is cut into pages with CSS
 * multi-column layout (one column = one page, the flow is moved sideways with a transform). Page turning is
 * by tap/click on the screen thirds, swipe, wheel and keys. At the end of a chapter the next turn loads the
 * next chapter into the same reader. Settings and the reading position are kept in localStorage.
 *
 * For the library on the home page (assets/app.js) it also records, for each book, the page last read and how
 * far through the whole book that is ("bjp.books": path, title, how far through the page, percent of the book,
 * time; from the reader or from scrolling a chapter page), the last page read of all ("bjp.reader.last") and
 * the pages of each volume that have been opened ("bjp.lib.seen"). The percentage is an estimate: the share of
 * the text of the chapters before the place, from the lengths in <book>/contents.json. A tap on a cover opens
 * the reader on its own (app.js sets "bjp.reader.open" and the cover's colours, "bjp.reader.cover", for the
 * quiet opening). Everything works without localStorage.
 */
(function () {
  "use strict";
  if (window.__bjpReader) return;
  window.__bjpReader = true;

  /* ---------------------------------------------------------------- constants and helpers */
  var KEY_SET = "bjp.reader.settings", KEY_POS = "bjp.reader.pos", KEY_AUTO = "bjp.reader.auto",
      KEY_OPEN = "bjp.reader.open", KEY_SUP = "bjp.reader.suppress", KEY_LAST = "bjp.reader.last",
      KEY_GOTO = "bjp.reader.goto", KEY_SEEN = "bjp.lib.seen", KEY_TAB = "bjp.reader.toctab",
      KEY_BOOKS = "bjp.books", KEY_COVER = "bjp.reader.cover";
  var THEME_BG = { white: "#ffffff", sepia: "#f4ecd8", dark: "#131313" };
  var SIZES = [14.5, 16, 17.5, 19, 21, 23.5, 26.5];
  var LEADS = [1.45, 1.65, 1.9];
  var MARGINS = [0.025, 0.07, 0.13];
  var ANCH_SEL = "p,li,h1,h2,h3,h4,h5,h6,figure,.tbl,.tbl-caption,dt,dd,.admonition-title,pre,blockquote,tr,hr";
  var ICON = {
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    toc: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/></svg>',
    fs: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
    fsExit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>',
    book: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 7c-1.6-1.3-3.9-2-8-2v13c4.1 0 6.4.7 8 2 1.6-1.3 3.9-2 8-2V5c-4.1 0-6.4.7-8 2zM12 7v13"/></svg>',
    back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 7L4 12l5 5M4 12h11a5 5 0 015 5v1"/></svg>',
    lib: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V5h4v15M8 20V9h4v11M14 20L12.6 6l3.8-.8 3 14.2M3 20h18"/></svg>',
    chev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
    info: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.6v.2"/></svg>'
  };

  function store(kind) { try { return window[kind]; } catch (e) { return null; } }
  function sget(kind, k) { try { var s = store(kind); return s ? s.getItem(k) : null; } catch (e) { return null; } }
  function sset(kind, k, v) { try { var s = store(kind); if (s) s.setItem(k, v); } catch (e) { /* storage unavailable */ } }
  function sdel(kind, k) { try { var s = store(kind); if (s) s.removeItem(k); } catch (e) { /* ignore */ } }
  function jget(k, d) { try { var v = sget("localStorage", k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function jset(k, v) { try { sset("localStorage", k, JSON.stringify(v)); } catch (e) { /* ignore */ } }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function debounce(fn, ms) { var t; return function () { var a = arguments, c = this; clearTimeout(t); t = setTimeout(function () { fn.apply(c, a); }, ms); }; }
  function raceTimeout(p, ms) {
    return new Promise(function (res) { var t = setTimeout(res, ms); Promise.resolve(p).then(function () { clearTimeout(t); res(); }, function () { clearTimeout(t); res(); }); });
  }
  function byId(root, id) { return root.querySelector('[id="' + String(id).replace(/(["\\])/g, "\\$1") + '"]'); }
  function reducedMotion() { return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches; }
  /* for searching titles: lower case, without the accents of Latin letters (Darśana = darsana) */
  function normq(s) { return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim(); }
  /* the site name, from the page title ("Chapter - Site"), so the reader can set titles of its own */
  var SITE_NAME = (function () {
    var m = document.querySelector('meta[name="application-name"]'), t = document.title || "", i = t.lastIndexOf(" - ");
    return i >= 0 ? t.slice(i + 3) : (t || (m && m.content) || "");
  })();
  function stripSite(t) {
    t = t || "";
    return SITE_NAME && t.slice(-(SITE_NAME.length + 3)) === " - " + SITE_NAME ? t.slice(0, -(SITE_NAME.length + 3)) : t;
  }
  function isVolPath(p) { return !!volOf(p); }
  function isVolPage() { return isVolPath(location.pathname) && !!document.querySelector("article.md-content__inner"); }
  function pagePath(u) { var x = new URL(u, location.href); return x.pathname; }
  function pageUrl(u) { var x = new URL(u, location.href); return x.origin + x.pathname + x.search; }
  /* The books' folders come from library.yml, through a JSON list in the page head (id, path relative to the
     site root). "/…/vol16_vastu/chapter03_x.html" -> ["vol16_vastu", "chapter03_x"]; null outside the books. */
  var BOOKS = (function () {
    try { var e = document.getElementById("bjp-books"); return e ? JSON.parse(e.textContent) : null; } catch (x) { return null; }
  })();
  var BOOK_ROOT = (function () {
    var s = document.currentScript && document.currentScript.src;
    if (!s) { var e = document.querySelector('script[src*="assets/reader.js"]'); s = e && e.src; }
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

  /* ---------------------------------------------------------------- library records (home page) */
  function markSeen(path) {
    var v = volOf(path);
    if (!v || v[1] === "index") return;
    var all = jget(KEY_SEEN, {}) || {};
    var rec = all[v[0]] && typeof all[v[0]] === "object" ? all[v[0]] : { p: [] };
    if (!Array.isArray(rec.p)) rec.p = [];
    if (rec.p.indexOf(v[1]) < 0) rec.p.push(v[1]);
    rec.t = Date.now();
    all[v[0]] = rec;
    jset(KEY_SEEN, all);
  }
  function saveLast(path, title, f, mode) {
    var v = volOf(path);
    if (!v || !title) return;
    jset(KEY_LAST, { path: path, title: title, vol: v[0], f: Math.round(clamp(f, 0, 1) * 1000) / 1000, mode: mode, t: Date.now() });
  }
  /* the record of a book: where the reader stopped, and how far through the whole book that is */
  function saveBook(path, title, f, mode, pct) {
    var v = volOf(path);
    if (!v || !title) return;
    var all = jget(KEY_BOOKS, {}) || {};
    var rec = all[v[0]] && typeof all[v[0]] === "object" ? all[v[0]] : {};
    rec.path = path;
    rec.title = title;
    rec.f = Math.round(clamp(f, 0, 1) * 1000) / 1000;
    rec.mode = mode;
    if (typeof pct === "number") rec.pct = Math.round(clamp(pct, 0, 100) * 10) / 10;
    rec.t = Date.now();
    all[v[0]] = rec;
    jset(KEY_BOOKS, all);
  }
  /* Percent of the book at a place: each page of the book weighs what its text weighs (contents.json "w") */
  function bookModel(c) {
    if (c.__m) return c.__m;
    var units = {}, order = [], acc = 0;
    (c.groups || []).forEach(function (g) {
      g.items.forEach(function (it) {
        if (!units[it.f]) { units[it.f] = { w: Math.max(1, +it.w || 1), before: 0 }; order.push(it.f); }
      });
    });
    order.forEach(function (f) { units[f].before = acc; acc += units[f].w; });
    c.__m = { units: units, total: acc, last: order[order.length - 1] };
    return c.__m;
  }
  function fileOfPath(path) {
    var f = (path || "").slice((path || "").lastIndexOf("/") + 1);
    return f === "" ? "index.html" : f;
  }
  function pctAt(m, path, frac) {
    var u = m && m.units[fileOfPath(path)];
    if (!u || !m.total) return null;
    return clamp((u.before + clamp(frac, 0, 1) * u.w) / m.total * 100, 0, 100);
  }
  function articleTitle() {
    var h = document.querySelector("article.md-content__inner h1");
    return h ? h.textContent.replace(/¶/g, "").trim() : stripSite(document.title);
  }
  /* reading a chapter page without the reader: the place is the scrolled fraction of the page, recorded
     only after the reader has scrolled it (not when a page merely opens or the browser restores a position) */
  var userInputAt = 0;
  function onUserInput() { userInputAt = Date.now(); }
  var onScrollSave = debounce(function () {
    if (S.open || Date.now() - userInputAt > 2500 || !isVolPage()) return;
    var v = volOf(location.pathname);
    if (!v || v[1] === "index") return;
    var max = document.documentElement.scrollHeight - window.innerHeight;
    if (max <= 0 || window.scrollY < 300) return;
    var f = window.scrollY / max, title = articleTitle(), path = location.pathname;
    saveLast(path, title, f, "scroll");
    saveBook(path, title, f, "scroll");
    bookContents().then(function (c) {
      var pct = pctAt(bookModel(c), path, f);
      if (pct !== null) saveBook(path, title, f, "scroll", pct);
    }, function () { /* the contents are not available: the percentage stays as it was */ });
  }, 700);
  function watchScroll() {
    if (watchScroll.done) return;
    watchScroll.done = true;
    ["wheel", "touchmove", "keydown", "pointerdown"].forEach(function (t) { window.addEventListener(t, onUserInput, { passive: true, capture: true }); });
    window.addEventListener("scroll", onScrollSave, { passive: true });
  }

  /* ---------------------------------------------------------------- state */
  var S = {
    open: false, built: false, root: null, loading: false,
    url: "", path: "", origUrl: "", rec: null,
    n: 0, page: 0, pw: 0, ph: 0, gap: 32, stride: 0, spread: false, anchors: [],
    backStack: [], pushed: false, expectPop: false, afterPop: null,
    hideT: 0, overBar: false, p: null, lastDims: "", wheelAt: 0, hinted: false, prevFocus: null, inerted: [],
    model: null, modelBook: "", lang: "en", curtain: false
  };
  var cache = {};
  var settings = loadSettings();
  var $ = {}; // element handles

  function loadSettings() {
    var s = jget(KEY_SET, {}) || {};
    return {
      size: typeof s.size === "number" ? clamp(Math.round(s.size), 0, SIZES.length - 1) : null,
      spacing: typeof s.spacing === "number" ? clamp(Math.round(s.spacing), 0, 2) : 1,
      margin: typeof s.margin === "number" ? clamp(Math.round(s.margin), 0, 2) : 1,
      // Justified text by default, except on narrow phone screens where it leaves wide word gaps.
      justify: typeof s.justify === "boolean" ? s.justify : Math.min(window.innerWidth, window.screen ? window.screen.width : 9999) >= 600,
      theme: s.theme === "sepia" || s.theme === "dark" ? s.theme : "white"
    };
  }
  function saveSettings() { jset(KEY_SET, settings); }
  function sizeIndex() {
    if (settings.size !== null) return settings.size;
    return Math.min(window.innerWidth, window.innerHeight) < 600 ? 2 : 3;
  }

  /* ---------------------------------------------------------------- entry points */
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html) e.innerHTML = html;
    return e;
  }

  function ensureEntry() {
    var on = isVolPage();
    document.documentElement.classList.toggle("rd-has-reader", on);
    if (!on) return;
    if (!document.querySelector(".rd-hbtn")) {
      var b = el("button", "rd-hbtn", ICON.book + "<span>Read</span>");
      b.type = "button";
      b.setAttribute("aria-label", "Read: open the reading mode");
      b.title = "Read (reading mode)";
      b.addEventListener("click", function () { open(); });
      var hdr = document.querySelector(".md-header__inner");
      var title = hdr && (hdr.querySelector(".bjp-libbtn") || hdr.querySelector(".md-header__title"));
      if (title) title.insertAdjacentElement("afterend", b);
      else if (hdr) hdr.appendChild(b);
    }
    if (!document.querySelector(".rd-fab")) {
      var f = el("button", "rd-fab", ICON.book + "<span>Read</span>");
      f.type = "button";
      f.setAttribute("aria-label", "Read: open the reading mode");
      f.addEventListener("click", function () { open(); });
      document.body.appendChild(f);
    }
  }

  function wireHome() {
    var cb = document.getElementById("rd-auto-toggle");
    if (!cb || cb.__bjp) return;
    cb.__bjp = true;
    cb.checked = sget("localStorage", KEY_AUTO) === "1";
    cb.addEventListener("change", function () {
      if (cb.checked) sset("localStorage", KEY_AUTO, "1"); else sdel("localStorage", KEY_AUTO);
    });
  }

  function init() {
    wireHome();
    ensureEntry();
    watchScroll();
    if (!S.open && isVolPage()) markSeen(location.pathname);
    if (!(sget("sessionStorage", KEY_OPEN) === "1" && isVolPage())) endBoot();
    if (S.open || !isVolPage()) return;
    if (sget("sessionStorage", KEY_SUP) === "1") { sdel("sessionStorage", KEY_SUP); return; }
    if (sget("sessionStorage", KEY_OPEN) === "1" || sget("localStorage", KEY_AUTO) === "1") open({ auto: true });
  }

  /* A book opened from its cover: the page is kept blank in the cover's colour until the reader is up (the class is
     set by a script in the page head; this lifts it). */
  function endBoot() {
    document.documentElement.classList.remove("bjp-booting");
    document.documentElement.style.background = "";
  }

  /* ---------------------------------------------------------------- building the reader */
  function build() {
    if (S.built) return;
    S.built = true;
    var root = el("div", "bjp-reader");
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", "Reading mode");
    root.setAttribute("lang", "en");
    root.hidden = true;
    root.innerHTML =
      '<div class="rd-stage"><div class="rd-view"><div class="rd-flow md-typeset" lang="en" tabindex="-1" aria-label="Chapter text"></div></div></div>' +
      '<div class="rd-top rd-bar">' +
        '<button type="button" class="rd-btn rd-close" aria-label="Close the reader (Esc)" title="Close (Esc)">' + ICON.close + '</button>' +
        '<div class="rd-title"></div>' +
        '<a class="rd-btn rd-libbtn" href="' + libraryUrl() + '" aria-label="Library: leave the reader and show all books" title="Library: all books">' + ICON.lib + '<span>Library</span></a>' +
        '<button type="button" class="rd-btn rd-tocbtn" aria-label="Contents: this chapter and the whole book" aria-haspopup="true" aria-expanded="false" title="Contents">' + ICON.toc + '</button>' +
        '<button type="button" class="rd-btn rd-setbtn" aria-label="Reading settings" aria-haspopup="true" aria-expanded="false" title="Settings"><span class="rd-aa" aria-hidden="true">A<small>a</small></span></button>' +
        '<button type="button" class="rd-btn rd-fsbtn" aria-label="Full screen" title="Full screen" hidden>' + ICON.fs + '</button>' +
      '</div>' +
      '<div class="rd-foot rd-bar"><div class="rd-fline"><span class="rd-ftitle"></span>' +
        '<span class="rd-pageno" role="status" aria-live="polite"></span><span class="rd-fpct"></span></div>' +
        '<div class="rd-progress" role="progressbar" aria-label="Progress in the book" aria-valuemin="0" aria-valuemax="100"><i></i></div></div>' +
      '<button type="button" class="rd-back" hidden>' + ICON.back + '<span>Back</span></button>' +
      '<div class="rd-panel rd-settings" role="group" aria-label="Reading settings" hidden>' +
        '<h2>Reading settings</h2>' +
        '<div class="rd-row"><span class="rd-lab" id="rd-l-size">Text size</span><div class="rd-size" role="group" aria-labelledby="rd-l-size">' +
          '<button type="button" data-act="smaller" aria-label="Smaller text"><span style="font-size:14px">A</span></button>' +
          '<div class="rd-dots" aria-hidden="true"></div>' +
          '<button type="button" data-act="larger" aria-label="Larger text"><span style="font-size:21px">A</span></button></div></div>' +
        seg("spacing", "Spacing", [["0", "Compact"], ["1", "Normal"], ["2", "Relaxed"]]) +
        seg("margin", "Margins", [["0", "Narrow"], ["1", "Medium"], ["2", "Wide"]]) +
        seg("justify", "Text", [["1", "Justified"], ["0", "Left"]]) +
        seg("theme", "Page", [["white", "Aa"], ["sepia", "Aa"], ["dark", "Aa"]], true) +
      '</div>' +
      '<div class="rd-panel rd-toc" role="group" aria-label="Contents" hidden>' +
        '<div class="rd-goto"><label class="rd-sr" for="rd-goto-in">Go to a chapter or section</label>' +
          '<input id="rd-goto-in" class="rd-goto-in" type="search" placeholder="Go to a chapter or section" autocomplete="off" spellcheck="false" enterkeyhint="go" aria-controls="rd-goto-res"></div>' +
        '<div class="rd-tabs" role="tablist" aria-label="Contents">' +
          '<button type="button" role="tab" id="rd-tab-ch" class="rd-tab" data-tab="ch" aria-controls="rd-tp-ch" aria-selected="true">This chapter</button>' +
          '<button type="button" role="tab" id="rd-tab-bk" class="rd-tab" data-tab="bk" aria-controls="rd-tp-bk" aria-selected="false" tabindex="-1">Whole book</button>' +
        '</div>' +
        '<div class="rd-tabpanels">' +
          '<div role="tabpanel" id="rd-tp-ch" class="rd-tp" aria-labelledby="rd-tab-ch"><ul class="rd-toc-list"></ul></div>' +
          '<div role="tabpanel" id="rd-tp-bk" class="rd-tp" aria-labelledby="rd-tab-bk" hidden><div class="rd-book-list" aria-live="polite"></div></div>' +
        '</div>' +
        '<div id="rd-goto-res" class="rd-goto-res" role="region" aria-label="Chapters and sections that match" aria-live="polite" hidden></div>' +
        '<div class="rd-panel-foot"><a class="rd-about" href="#" aria-label="About this book: its page with the full contents and offline reading">' + ICON.info + '<span>About this book</span></a></div>' +
      '</div>' +
      '<div class="rd-pop md-typeset" role="note" hidden></div>' +
      '<div class="rd-loading" role="status"><span>Loading</span></div>' +
      '<div class="rd-curtain" aria-hidden="true" hidden><span></span></div>';
    document.body.appendChild(root);
    S.root = root;
    $.stage = root.querySelector(".rd-stage");
    $.view = root.querySelector(".rd-view");
    $.flow = root.querySelector(".rd-flow");
    $.top = root.querySelector(".rd-top");
    $.title = root.querySelector(".rd-title");
    $.pageno = root.querySelector(".rd-pageno");
    $.prog = root.querySelector(".rd-progress i");
    $.back = root.querySelector(".rd-back");
    $.set = root.querySelector(".rd-settings");
    $.toc = root.querySelector(".rd-toc");
    $.tocList = root.querySelector(".rd-toc-list");
    $.bookList = root.querySelector(".rd-book-list");
    $.lib = root.querySelector(".rd-libbtn");
    $.ftitle = root.querySelector(".rd-ftitle");
    $.fpct = root.querySelector(".rd-fpct");
    $.progBar = root.querySelector(".rd-progress");
    $.about = root.querySelector(".rd-about");
    $.goIn = root.querySelector(".rd-goto-in");
    $.goRes = root.querySelector(".rd-goto-res");
    $.curtain = root.querySelector(".rd-curtain");
    $.pop = root.querySelector(".rd-pop");
    $.loading = root.querySelector(".rd-loading");
    $.fs = root.querySelector(".rd-fsbtn");
    $.dots = root.querySelector(".rd-dots");
    $.dots.innerHTML = SIZES.map(function () { return "<i></i>"; }).join("");

    root.querySelector(".rd-close").addEventListener("click", function () { close(); });
    root.querySelector(".rd-tocbtn").addEventListener("click", function () { togglePanel("toc"); });
    root.querySelector(".rd-setbtn").addEventListener("click", function () { togglePanel("set"); });
    $.fs.addEventListener("click", toggleFullscreen);
    $.back.addEventListener("click", goBack);
    $.set.addEventListener("click", onSettingsClick);
    $.tocList.addEventListener("click", onTocClick);
    $.bookList.addEventListener("click", onBookClick);
    $.toc.querySelector(".rd-tabs").addEventListener("click", function (e) {
      var t = e.target.closest("button[data-tab]");
      if (t) showTab(t.getAttribute("data-tab"), true);
    });
    $.lib.addEventListener("click", onLibraryClick);
    $.about.addEventListener("click", onAboutClick);
    $.goIn.addEventListener("input", onGotoInput);
    $.goIn.addEventListener("keydown", onGotoKey);
    $.goRes.addEventListener("keydown", onGotoKey);
    $.goRes.addEventListener("click", onGotoClick);
    $.flow.addEventListener("click", onLinkClick);
    $.pop.addEventListener("click", onLinkClick);
    $.top.addEventListener("pointerenter", function () { S.overBar = true; });
    $.top.addEventListener("pointerleave", function () { S.overBar = false; armHide(); });
    $.top.addEventListener("focusin", function () { showChrome(true); });
    $.top.addEventListener("focusout", function () { armHide(); });
    // pages
    var st = $.stage;
    st.addEventListener("pointerdown", onPointerDown);
    st.addEventListener("pointermove", onPointerMove);
    st.addEventListener("pointerup", onPointerUp);
    st.addEventListener("pointercancel", onPointerCancel);
    st.addEventListener("wheel", onWheel, { passive: false });
    // a focused link on another page must not scroll the clipped view
    $.view.addEventListener("scroll", function () { $.view.scrollLeft = 0; $.view.scrollTop = 0; });
    $.flow.addEventListener("focusin", function (e) {
      var t = e.target;
      if (t && t !== $.flow && S.stride) {
        var p = pageOfEl(t);
        if (p !== null && !isOnPage(p)) goto(p, false);
      }
    });
    $.flow.addEventListener("load", debounce(function () { if (S.open && !S.loading) relayout(); }, 120), true);
    window.addEventListener("resize", debounce(function () { if (S.open) relayout(true); }, 150));
    window.addEventListener("orientationchange", debounce(function () { if (S.open) relayout(true); }, 250));
    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("webkitfullscreenchange", onFsChange);
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("selectionchange", function () { /* selection never moves the view */ });
    window.addEventListener("popstate", onPopState, true);
    window.addEventListener("pagehide", function () { if (S.open) savePos(); });
    document.addEventListener("visibilitychange", function () { if (document.hidden && S.open) savePos(); });
    if (document.fonts && document.fonts.addEventListener) {
      document.fonts.addEventListener("loadingdone", debounce(function () { if (S.open && !S.loading) relayout(true); }, 150));
    }
    // an app on the iPad home screen is already full screen (and WebKit's own full-screen view would cover the reader's controls)
    var fsOk = !!((root.requestFullscreen || root.webkitRequestFullscreen) && (document.fullscreenEnabled || document.webkitFullscreenEnabled)) &&
      navigator.standalone !== true;
    $.fs.hidden = !fsOk;
    applySettingsUI();
  }

  function seg(key, label, opts, swatch) {
    var id = "rd-l-" + key;
    var b = opts.map(function (o) {
      return '<button type="button" role="radio" aria-checked="false" data-k="' + key + '" data-v="' + o[0] + '"' +
        (swatch ? ' class="rd-sw" aria-label="' + o[0].charAt(0).toUpperCase() + o[0].slice(1) + ' page"' : "") + ">" + o[1] + "</button>";
    }).join("");
    return '<div class="rd-row"><span class="rd-lab" id="' + id + '">' + label + '</span><div class="rd-seg" role="radiogroup" aria-labelledby="' + id + '">' + b + "</div></div>";
  }

  /* ---------------------------------------------------------------- opening and closing */
  function navLink(doc, which, base) {
    var a = doc.querySelector(".md-footer__link--" + which);
    var h = a && a.getAttribute("href");
    if (!h) return null;
    try {
      // the navigation of the site runs on into the next book at the end of one: the reader stays in the book
      var u = new URL(h, base), a = volOf(u.pathname), b = volOf(pagePath(base));
      return a && b && a[0] === b[0] ? u.origin + u.pathname + u.search : null;
    } catch (e) { return null; }
  }

  function fixUrls(root, base) {
    var i, e, list = root.querySelectorAll("[href]");
    for (i = 0; i < list.length; i++) {
      e = list[i];
      var h = e.getAttribute("href");
      if (!h || h.charAt(0) === "#") continue;
      try { e.setAttribute("href", new URL(h, base).href); } catch (x) { /* leave */ }
    }
    list = root.querySelectorAll("[src]");
    for (i = 0; i < list.length; i++) {
      e = list[i];
      try { e.setAttribute("src", new URL(e.getAttribute("src"), base).href); } catch (x) { /* leave */ }
    }
  }

  function recFromDocument(doc, url, live) {
    var art = doc.querySelector("article.md-content__inner");
    if (!art) return null;
    var c = live ? art.cloneNode(true) : art;
    fixUrls(c, url);
    return {
      url: pageUrl(url),
      html: c.innerHTML,
      title: stripSite(doc.title),
      prev: navLink(doc, "prev", url),
      next: navLink(doc, "next", url)
    };
  }

  function fetchPage(url) {
    url = pageUrl(url);
    if (cache[url]) return Promise.resolve(cache[url]);
    return fetch(url, { credentials: "same-origin" }).then(function (r) {
      if (!r.ok) throw new Error("http " + r.status);
      return r.text();
    }).then(function (t) {
      var d = new DOMParser().parseFromString(t, "text/html");
      var rec = recFromDocument(d, url, false);
      if (!rec) throw new Error("no article");
      cache[url] = rec;
      return rec;
    });
  }

  function open(opts) {
    opts = opts || {};
    if (S.open || !isVolPage()) return;
    build();
    var rec = recFromDocument(document, location.href, true);
    if (!rec) return;
    S.open = true;
    S.origUrl = pageUrl(location.href);
    S.backStack = [];
    S.prevFocus = document.activeElement;
    document.documentElement.classList.add("bjp-reading");
    inertOthers(true);
    S.root.hidden = false;
    $.loading.hidden = false;
    sset("sessionStorage", KEY_OPEN, "1");
    // one history entry, so that the back button of a phone closes the reader
    try {
      if (history.state && history.state.bjpReader) { S.pushed = false; }
      else { history.pushState({ bjpReader: 1 }, "", location.href); S.pushed = true; }
    } catch (e) { S.pushed = false; }
    var hash = location.hash && location.hash.length > 1 ? location.hash : "";
    var where = hash ? { hash: hash } : "saved";
    var go = null;
    try { go = JSON.parse(sget("sessionStorage", KEY_GOTO) || "null"); } catch (e) { go = null; }
    sdel("sessionStorage", KEY_GOTO);
    if (!hash && go && go.path === pagePath(location.href) && typeof go.f === "number") where = { anchor: { i: null, n: 0, f: go.f } };
    setThemeColor(true);
    showCurtain();
    endBoot();
    mount(rec, where, false).then(function () {
      finishOpen();
    });
  }

  /* the opening from a cover: the cover's colour and title fill the screen, then give way to the page */
  function showCurtain() {
    var cov = null;
    try { cov = JSON.parse(sget("sessionStorage", KEY_COVER) || "null"); } catch (e) { cov = null; }
    sdel("sessionStorage", KEY_COVER);
    S.curtain = false;
    if (!cov || !cov.bg || reducedMotion()) { $.curtain.hidden = true; return; }
    $.curtain.className = "rd-curtain";
    $.curtain.style.background = cov.bg;
    $.curtain.style.color = cov.fg || "#fff";
    var t = $.curtain.querySelector("span");
    t.textContent = cov.title || "";
    if (cov.lang) t.setAttribute("lang", cov.lang); else t.removeAttribute("lang");
    $.curtain.hidden = false;
    S.curtain = true;
    S.curtainAt = Date.now();
  }
  function liftCurtain() {
    if (!S.curtain) return;
    S.curtain = false;
    var c = $.curtain, wait = Math.max(0, 380 - (Date.now() - (S.curtainAt || 0)));
    setTimeout(function () {
      c.classList.add("lift");
      setTimeout(function () { c.hidden = true; c.className = "rd-curtain"; }, 520);
    }, wait);
  }

  function finishOpen() {
    $.loading.hidden = true;
    liftCurtain();
    $.stage.classList.remove("rd-fade");
    try { $.flow.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    prefetch();
  }

  function close(opts) {
    opts = opts || {};
    if (!S.open) return;
    savePos();
    S.open = false;
    clearTimeout(S.hideT);
    closePanels();
    closePop();
    S.root.classList.remove("rd-chrome-on");
    S.root.hidden = true;
    document.documentElement.classList.remove("bjp-reading");
    setThemeColor(false);
    inertOthers(false);
    sdel("sessionStorage", KEY_OPEN);
    if (fsElement()) { try { (document.exitFullscreen || document.webkitExitFullscreen).call(document); } catch (e) { /* ignore */ } }
    var changed = S.url !== S.origUrl;
    if (S.prevFocus && S.prevFocus.focus && !changed) { try { S.prevFocus.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
    if (opts.fromPop) {
      S.pushed = false;
      if (changed) { sset("sessionStorage", KEY_SUP, "1"); location.replace(S.url); }
      return;
    }
    if (S.pushed) {
      S.pushed = false;
      S.expectPop = true;
      S.afterPop = changed ? S.url : null;
      try { history.back(); } catch (e) { S.expectPop = false; }
    } else if (changed) {
      sset("sessionStorage", KEY_SUP, "1");
      location.replace(S.url);
    }
  }

  function onPopState(e) {
    if (S.expectPop) {
      S.expectPop = false;
      e.stopImmediatePropagation();
      if (S.afterPop) { var u = S.afterPop; S.afterPop = null; sset("sessionStorage", KEY_SUP, "1"); location.replace(u); }
      return;
    }
    if (S.open) { e.stopImmediatePropagation(); close({ fromPop: true }); return; }
    if (e.state && e.state.bjpReader) e.stopImmediatePropagation();
  }

  function inertOthers(on) {
    var i, c;
    if (on) {
      S.inerted = [];
      for (i = 0; i < document.body.children.length; i++) {
        c = document.body.children[i];
        if (c === S.root || c.tagName === "SCRIPT" || c.inert) continue;
        c.inert = true;
        c.setAttribute("aria-hidden", "true");
        S.inerted.push(c);
      }
    } else {
      S.inerted.forEach(function (x) { x.inert = false; x.removeAttribute("aria-hidden"); });
      S.inerted = [];
    }
  }

  /* ---------------------------------------------------------------- chapter content */
  function prepareFlow() {
    var flow = $.flow, i, list;
    // a book's first page: the reader has its own contents (the list button), the page's list of chapters is left out
    list = flow.querySelectorAll("nav.vol-contents, .vc-tools, .bjp-offline, h2#contents");
    for (i = 0; i < list.length; i++) list[i].parentNode.removeChild(list[i]);
    list = flow.querySelectorAll(".headerlink, script, style");
    for (i = 0; i < list.length; i++) list[i].parentNode.removeChild(list[i]);
    // images in pages that are not on screen must still load, or the page breaks would move later
    list = flow.querySelectorAll("img");
    for (i = 0; i < list.length; i++) { list[i].setAttribute("loading", "eager"); list[i].removeAttribute("fetchpriority"); }
    list = flow.querySelectorAll("a[href]");
    for (i = 0; i < list.length; i++) {
      var a = list[i], h = a.getAttribute("href");
      if (h.charAt(0) === "#") continue;
      try {
        if (new URL(h, location.href).origin !== location.origin) { a.setAttribute("rel", "noopener noreferrer"); a.setAttribute("target", "_blank"); }
      } catch (e) { /* ignore */ }
    }
  }

  function imagesReady(root) {
    var ps = [], imgs = root.querySelectorAll("img");
    for (var i = 0; i < imgs.length; i++) {
      (function (im) {
        if (im.complete && im.naturalWidth > 0) return;
        ps.push(new Promise(function (res) { im.addEventListener("load", res, { once: true }); im.addEventListener("error", res, { once: true }); }));
      })(imgs[i]);
    }
    return Promise.all(ps);
  }

  function needsMath() {
    return window.bjpMath ? window.bjpMath.pending([$.flow]).length > 0 : $.flow.querySelector(".arithmatex, .math") !== null;
  }

  /* Put a fetched chapter into the flow, wait until it is fully typeset, paginate and place the position. */
  function mount(rec, where, fade) {
    S.loading = true;
    S.rec = rec;
    S.url = rec.url;
    S.path = pagePath(rec.url);
    var bk = bookOfPath(S.path);
    setLang(bk && bk.lang || "en");
    if (bk) $.about.setAttribute("href", location.origin + BOOK_ROOT + bk.path + "/index.html");
    if (!bk || S.modelBook !== bk.id) { S.model = null; S.modelBook = bk ? bk.id : ""; }
    $.flow.classList.add("rd-hidden");
    $.flow.style.transform = "none";
    $.flow.innerHTML = rec.html;
    prepareFlow();
    S.anchors = [];
    S.n = 0;
    var h1 = $.flow.querySelector("h1");
    var title = h1 ? h1.textContent.replace(/¶/g, "").trim() : rec.title;
    S.title = title;
    $.title.textContent = title;
    $.ftitle.textContent = title;
    $.ftitle.title = title;
    if (rec.title) document.title = rec.title + (SITE_NAME ? " - " + SITE_NAME : "");
    try { history.replaceState(history.state, "", rec.url + (where && where.hash ? where.hash : "")); } catch (e) { /* ignore */ }
    buildToc();
    updateBackChip();
    markSeen(S.path);
    loadModel();
    return waitReady().then(function () {
      applySettingsUI();
      measureAndPaginate(null);
      applyWhere(where);
      $.flow.classList.remove("rd-hidden");
      S.loading = false;
      if (fade) { $.stage.classList.remove("rd-fade"); }
    });
  }

  /* the book's language (library.yml) for the text: hyphenation, the choice of font, screen readers */
  function setLang(lang) {
    S.lang = lang || "en";
    S.root.setAttribute("lang", S.lang);
    $.flow.setAttribute("lang", S.lang);
  }
  /* the lengths of the book's chapters, for the percentage; the page footer is complete when they have arrived */
  function loadModel() {
    var id = S.modelBook;
    if (!id || S.model) return;
    bookContents().then(function (c) {
      if (c.id !== S.modelBook) return;
      S.model = bookModel(c);
      if (S.open && S.n) { updatePageUI(); scheduleSave(); }
    }, function () { /* without the contents the footer shows the chapter only */ });
  }

  function waitReady() {
    var chain = Promise.resolve();
    if (needsMath() && window.bjpMath) chain = chain.then(function () { return raceTimeout(window.bjpMath.typeset([$.flow]), 12000); });
    chain = chain.then(function () { return document.fonts && document.fonts.ready ? raceTimeout(document.fonts.ready, 5000) : null; });
    chain = chain.then(function () { return raceTimeout(imagesReady($.flow), 12000); });
    return chain;
  }

  function prefetch() {
    setTimeout(function () {
      if (!S.open || !S.rec) return;
      if (S.rec.next) fetchPage(S.rec.next).catch(function () {});
      if (S.rec.prev) fetchPage(S.rec.prev).catch(function () {});
      bookContents().catch(function () {});
    }, 900);
  }

  function loadChapter(url, where) {
    if (S.loading) return Promise.resolve();
    S.loading = true;
    savePos();
    closePanels();
    closePop();
    $.stage.classList.add("rd-fade");
    var wait = new Promise(function (r) { setTimeout(r, reducedMotion() ? 0 : 150); });
    return Promise.all([fetchPage(url), wait]).then(function (r) {
      S.loading = false;
      return mount(r[0], where, true);
    }).then(function () {
      prefetch();
    }).catch(function () {
      S.loading = false;
      $.stage.classList.remove("rd-fade");
      $.flow.classList.remove("rd-hidden");
      $.pageno.textContent = navigator.onLine === false ? "This page is not available offline." : "Could not load the next page. Check the connection.";
      setTimeout(updatePageUI, 2500);
    });
  }

  /* ---------------------------------------------------------------- pagination */
  function px(v) { return parseFloat(v) || 0; }

  function measureAndPaginate(keep) {
    var flow = $.flow, root = S.root, i, list;
    var fontPx = SIZES[sizeIndex()];
    var vw = window.innerWidth, vh = window.innerHeight;
    var phone = Math.min(vw, vh) < 600;
    root.style.setProperty("--rd-mx", Math.max(phone ? 16 : 20, Math.round(vw * MARGINS[settings.margin])) + "px");
    // The top margin clears the 52px toolbar, so the first line is never hidden under it.
    root.style.setProperty("--rd-mt", (phone ? 62 : 68) + "px");
    root.style.setProperty("--rd-mb", (phone ? 60 : 52) + "px");
    var cs = getComputedStyle($.stage);
    var availW = Math.floor($.stage.clientWidth - px(cs.paddingLeft) - px(cs.paddingRight));
    var availH = Math.floor($.stage.clientHeight - px(cs.paddingTop) - px(cs.paddingBottom));
    S.spread = vw >= 1100 && vw > vh;
    var gap = S.spread ? clamp(Math.round(fontPx * 2.6), 40, 88) : 32;
    var maxMeasure = Math.round(fontPx * 36);
    var pw = S.spread ? Math.min(Math.floor((availW - gap) / 2), maxMeasure) : Math.min(availW, maxMeasure);
    pw = Math.max(pw, 120);
    var viewW = S.spread ? 2 * pw + gap : pw;
    var ph = Math.max(availH, 120);
    S.pw = pw; S.ph = ph; S.gap = gap; S.stride = pw + gap;
    root.style.setProperty("--rd-vw", viewW + "px");
    $.view.style.width = viewW + "px";
    $.view.style.height = ph + "px";
    flow.style.width = viewW + "px";
    flow.style.height = ph + "px";
    flow.style.columnWidth = pw + "px";
    flow.style.columnGap = gap + "px";
    flow.style.setProperty("--rd-h", ph + "px");
    flow.style.fontSize = fontPx + "px";
    // Devanagari carries its marks above and below the line: it needs a little more leading
    flow.style.lineHeight = String(LEADS[settings.spacing] + (/^hi\b/.test(S.lang) ? 0.14 : 0));
    flow.classList.toggle("rd-just", settings.justify);
    flow.classList.toggle("rd-left", !settings.justify);
    // tables taller than a page may break across pages; the others scroll inside the table
    list = flow.querySelectorAll(".tbl");
    for (i = 0; i < list.length; i++) {
      list[i].classList.remove("rd-tbl-flow", "rd-tbl-tight");
      var t0 = list[i].querySelector("table");
      if (t0) t0.style.zoom = "";
    }
    for (i = 0; i < list.length; i++) {
      var tb = list[i].querySelector("table");
      if (tb && tb.offsetHeight > ph * 0.8) list[i].classList.add("rd-tbl-flow");
    }
    // a table that runs over several pages cannot scroll sideways: scale it down to the page width instead
    for (i = 0; i < list.length; i++) {
      var ft = list[i].querySelector("table");
      if (!ft || !list[i].classList.contains("rd-tbl-flow")) continue;
      var cw = list[i].clientWidth;
      if (ft.scrollWidth <= cw + 1) continue;
      list[i].classList.add("rd-tbl-tight");
      if (ft.scrollWidth > cw + 1) ft.style.zoom = Math.max(0.5, (cw - 1) / ft.scrollWidth).toFixed(3);
    }
    list = flow.querySelectorAll(".tbl-scroll, mjx-container[display='true']");
    for (i = 0; i < list.length; i++) {
      var s = list[i];
      var inFlow = s.closest && s.closest(".rd-tbl-flow");
      s.classList.toggle("rd-xscroll", !inFlow && s.scrollWidth > s.clientWidth + 1);
    }
    // inline formulas cannot break across lines: one wider than what is left of its column scrolls sideways
    list = flow.querySelectorAll("mjx-container:not([display='true'])");
    for (i = 0; i < list.length; i++) list[i].classList.remove("rd-xscroll");
    var flowLeft = flow.getBoundingClientRect().left;
    for (i = 0; i < list.length; i++) {
      var r = list[i].getBoundingClientRect();
      if (r.width < 40 || list[i].parentElement.closest(".rd-xscroll, .rd-tbl-flow")) continue;
      var colRight = flowLeft + Math.floor((r.left - flowLeft + 1) / S.stride) * S.stride + pw;
      if (r.right > colRight + 1) list[i].classList.add("rd-xscroll");
    }
    // number of pages
    S.anchors = flow.querySelectorAll(ANCH_SEL);
    var fr = flow.getBoundingClientRect();
    var n = Math.max(1, Math.round((flow.scrollWidth + gap) / S.stride));
    var last = flow.lastElementChild;
    if (last) {
      var rects = last.getClientRects();
      if (rects.length) {
        var right = rects[rects.length - 1].right - fr.left;
        var nLast = Math.floor((right - 1) / S.stride) + 1;
        if (nLast >= 1 && nLast <= n) n = nLast;
      }
    }
    S.n = n;
    S.lastDims = [vw, vh, pw, ph, S.spread, fontPx, settings.spacing, settings.margin, settings.justify, S.lang].join("/");
  }

  function relayout(onlyIfChanged) {
    if (!S.open || S.loading || !S.n) return;
    var vw = window.innerWidth, vh = window.innerHeight;
    var keep = captureAnchor();
    var before = S.lastDims;
    measureAndPaginate(keep);
    if (onlyIfChanged && before === S.lastDims && S.lastN === S.n) { /* unchanged */ }
    S.lastN = S.n;
    restoreAnchor(keep);
  }

  function pageOfEl(e) {
    var rects = e.getClientRects();
    if (!rects.length) return null;
    var fr = $.flow.getBoundingClientRect();
    var x = rects[0].left - fr.left;
    return clamp(Math.floor((x + 2) / S.stride), 0, S.n - 1);
  }
  function isOnPage(p) { return p >= S.page && p < S.page + (S.spread ? 2 : 1); }

  function captureAnchor() {
    if (!S.n || !S.anchors.length) return { i: null, n: 0, f: 0 };
    var fr = $.flow.getBoundingClientRect();
    var start = S.page * S.stride, end = start + S.stride * (S.spread ? 2 : 1);
    var idx = -1, i, r;
    for (i = 0; i < S.anchors.length; i++) {
      r = S.anchors[i].getClientRects();
      if (!r.length) continue;
      if (r[0].left - fr.left >= start - 2) { idx = i; break; }
    }
    if (idx >= 0) {
      r = S.anchors[idx].getClientRects();
      if (r[0].left - fr.left >= end - 2 && idx > 0) idx--;
    } else idx = S.anchors.length - 1;
    return { i: idx, n: S.anchors.length, f: S.n > 1 ? S.page / S.n : 0 };
  }

  function restoreAnchor(a) {
    var p = 0;
    if (a && a.i !== null && a.n === S.anchors.length && S.anchors[a.i]) {
      var q = pageOfEl(S.anchors[a.i]);
      p = q === null ? Math.round(a.f * S.n) : q;
    } else if (a) p = Math.round((a.f || 0) * S.n);
    goto(p, false, true);
  }

  function applyWhere(where) {
    if (where === "end") { goto(S.n - 1, false, true); return; }
    if (where && typeof where === "object" && where.hash) {
      var t = byId($.flow, decodeURIComponent(where.hash.slice(1)));
      if (t) { var p = pageOfEl(t); goto(p === null ? 0 : p, false, true); return; }
    }
    // (a string such as "saved" has a legacy .anchor() method: only an object carries a place)
    if (where && typeof where === "object" && where.anchor) { restoreAnchor(where.anchor); return; }
    if (where === "saved") {
      var all = jget(KEY_POS, {}) || {};
      var rec = all[S.path];
      if (rec && typeof rec.f === "number") { restoreAnchor({ i: rec.i, n: rec.n, f: rec.f }); return; }
    }
    goto(0, false, true);
  }

  function goto(p, anim, quiet) {
    p = clamp(Math.round(p), 0, Math.max(0, S.n - 1));
    if (S.spread) p -= p % 2;
    var moved = p !== S.page;
    S.page = p;
    var f = $.flow;
    f.classList.toggle("rd-anim", !!anim && !reducedMotion());
    f.style.transform = "translate3d(" + (-p * S.stride) + "px,0,0)";
    updatePageUI();
    if (moved) { closePop(); scheduleSave(); }
    else if (!quiet) scheduleSave();
  }

  /* how far through the whole book the end of the page on screen is, in percent; null until the contents are known */
  function bookPct() {
    if (!S.model || !S.n) return null;
    var last = S.spread ? Math.min(S.page + 2, S.n) : S.page + 1;
    return pctAt(S.model, S.path, last / S.n);
  }
  function shownPct(p) {
    var atEnd = S.model && fileOfPath(S.path) === S.model.last && S.page + (S.spread ? 2 : 1) >= S.n;
    return atEnd ? 100 : Math.max(0, Math.min(99, Math.round(p)));
  }

  function updatePageUI() {
    if (!S.n) return;
    var p = S.page, shown = p + 1, txt;
    if (S.spread && p + 2 <= S.n) txt = "Pages " + (p + 1) + "\u2013" + (p + 2) + " of " + S.n;
    else txt = "Page " + shown + " of " + S.n;
    $.pageno.textContent = txt;
    var last = S.spread ? Math.min(p + 2, S.n) : p + 1;
    var pct = bookPct();
    if (pct === null) {
      $.fpct.textContent = "";
      $.prog.style.width = (last / S.n * 100).toFixed(2) + "%";
      $.progBar.removeAttribute("aria-valuenow");
    } else {
      var sp = shownPct(pct);
      $.fpct.textContent = sp + "% of the book";
      $.prog.style.width = pct.toFixed(2) + "%";
      $.progBar.setAttribute("aria-valuenow", String(sp));
    }
  }

  function turn(dir) {
    if (S.loading || !S.n) return;
    var step = S.spread ? 2 : 1;
    if (dir > 0) {
      if (S.page + step < S.n) goto(S.page + step, true);
      else if (S.rec && S.rec.next) loadChapter(S.rec.next, "start");
      else nudge(-1);
    } else {
      if (S.page - step >= 0) goto(S.page - step, true);
      else if (S.rec && S.rec.prev) loadChapter(S.rec.prev, "end");
      else nudge(1);
    }
    if (!S.panel) hideChrome();
  }

  function nudge(sign) {
    if (reducedMotion()) return;
    var f = $.flow, base = -S.page * S.stride;
    f.classList.add("rd-anim");
    f.style.transform = "translate3d(" + (base + sign * 14) + "px,0,0)";
    setTimeout(function () { f.style.transform = "translate3d(" + base + "px,0,0)"; }, 130);
  }

  function goToEl(e, anim) {
    var p = pageOfEl(e);
    if (p !== null) goto(p, anim);
  }

  /* ---------------------------------------------------------------- saved position */
  var scheduleSave = debounce(function () { savePos(); }, 500);
  function savePos() {
    if (!S.open || !S.n || S.loading) return;
    var a = captureAnchor();
    var all = jget(KEY_POS, {}) || {};
    all[S.path] = { i: a.i, n: a.n, f: a.f, t: Date.now() };
    var frac = Math.min(S.page + (S.spread ? 2 : 1), S.n) / S.n;
    saveLast(S.path, S.title, frac, "reader");
    saveBook(S.path, S.title, frac, "reader", bookPct());
    var keys = Object.keys(all);
    if (keys.length > 300) {
      keys.sort(function (x, y) { return (all[x].t || 0) - (all[y].t || 0); });
      for (var i = 0; i < keys.length - 300; i++) delete all[keys[i]];
    }
    jset(KEY_POS, all);
  }

  /* ---------------------------------------------------------------- links, footnotes, return chip */
  function pushBack() {
    S.backStack.push({ url: S.url, anchor: captureAnchor() });
    if (S.backStack.length > 30) S.backStack.shift();
    updateBackChip();
  }
  function updateBackChip() { if ($.back) $.back.hidden = S.backStack.length === 0; }
  function goBack() {
    var b = S.backStack.pop();
    updateBackChip();
    if (!b) return;
    closePop();
    if (b.url === S.url) restoreAnchor(b.anchor);
    else loadChapter(b.url, { anchor: b.anchor });
  }

  function jumpHash(hash) {
    var id;
    try { id = decodeURIComponent(hash.replace(/^#/, "")); } catch (e) { id = hash.replace(/^#/, ""); }
    var t = byId($.flow, id);
    if (!t) return false;
    goToEl(t, true);
    return true;
  }

  function onLinkClick(e) {
    var a = e.target.closest ? e.target.closest("a") : null;
    if (!a || e.defaultPrevented) return;
    var href = a.getAttribute("href");
    if (!href) return;
    if (e.button && e.button !== 0) return;
    if (a.classList.contains("footnote-ref")) { e.preventDefault(); showFootnote(a); return; }
    if (href.charAt(0) === "#") {
      e.preventDefault();
      if (e.currentTarget === $.pop) closePop();
      var cur = captureAnchor();
      if (jumpHash(href)) { S.backStack.push({ url: S.url, anchor: cur }); updateBackChip(); }
      return;
    }
    var u;
    try { u = new URL(a.href); } catch (x) { return; }
    if (u.origin !== location.origin) return; // external links open in a new tab (target=_blank)
    e.preventDefault();
    if (e.currentTarget === $.pop) closePop();
    if (isVolPath(u.pathname)) {
      pushBack();
      if (u.pathname === S.path) {
        if (!(u.hash && jumpHash(u.hash))) goto(0, true);
      } else loadChapter(u.origin + u.pathname + u.search, u.hash ? { hash: u.hash } : "start");
    } else {
      // a page outside the volumes: leave the reader and go there
      var target = u.href;
      sdel("sessionStorage", KEY_OPEN);
      S.pushed = false;
      close({ fromPop: true });
      location.href = target;
    }
  }

  function showFootnote(a) {
    var id = decodeURIComponent((a.getAttribute("href") || "").replace(/^#/, ""));
    var li = byId($.flow, id);
    if (!li) { jumpHash(a.getAttribute("href")); return; }
    closePanels();
    $.pop.innerHTML = li.innerHTML;
    var bl = $.pop.querySelectorAll(".footnote-backref");
    for (var i = 0; i < bl.length; i++) bl[i].parentNode.removeChild(bl[i]);
    $.pop.hidden = false;
    var rr = a.getClientRects()[0] || a.getBoundingClientRect();
    var W = S.root.clientWidth, H = S.root.clientHeight;
    var pw = $.pop.offsetWidth, ph = $.pop.offsetHeight;
    var x = clamp(rr.left + rr.width / 2 - pw / 2, 10, W - pw - 10);
    var y = rr.bottom + 10;
    if (y + ph > H - 40) y = Math.max(60, rr.top - ph - 10);
    $.pop.style.left = x + "px";
    $.pop.style.top = y + "px";
    $.pop.scrollTop = 0;
  }
  function closePop() { if ($.pop && !$.pop.hidden) { $.pop.hidden = true; $.pop.innerHTML = ""; } }

  /* ---------------------------------------------------------------- chrome, panels, settings */
  function armHide() {
    clearTimeout(S.hideT);
    S.hideT = setTimeout(hideChrome, 3200);
  }
  function showChrome(sticky) {
    S.root.classList.add("rd-chrome-on");
    clearTimeout(S.hideT);
    if (!sticky) armHide();
  }
  function hideChrome() {
    if (!S.root) return;
    if (S.panel || S.overBar || $.top.contains(document.activeElement)) { armHide(); return; }
    S.root.classList.remove("rd-chrome-on");
  }
  function toggleChrome() {
    if (S.root.classList.contains("rd-chrome-on") && !S.panel) { clearTimeout(S.hideT); S.root.classList.remove("rd-chrome-on"); }
    else showChrome(false);
  }

  function togglePanel(which) {
    var panel = which === "toc" ? $.toc : $.set;
    var other = which === "toc" ? $.set : $.toc;
    var willOpen = panel.hidden;
    if (!willOpen) resetGoto();
    closePop();
    other.hidden = true;
    panel.hidden = !willOpen;
    S.root.querySelector(".rd-tocbtn").setAttribute("aria-expanded", String(which === "toc" && willOpen));
    S.root.querySelector(".rd-setbtn").setAttribute("aria-expanded", String(which !== "toc" && willOpen));
    S.panel = willOpen ? which : null;
    if (willOpen) {
      showChrome(true);
      if (which === "toc") showTab(S.tab || (sget("localStorage", KEY_TAB) === "bk" ? "bk" : "ch"), false);
      var f = panel.querySelector("button[aria-checked='true'], .rd-tab[aria-selected='true'], button");
      if (f) { try { f.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
    } else {
      armHide();
      try { $.flow.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    }
  }
  function resetGoto() {
    if (!$.goIn || !$.goIn.value) return;
    $.goIn.value = "";
    $.toc.classList.remove("is-goto");
    $.goRes.hidden = true;
    $.goRes.innerHTML = "";
  }
  function closePanels() {
    if (!S.root) return;
    resetGoto();
    $.set.hidden = true; $.toc.hidden = true;
    S.panel = null;
    S.root.querySelector(".rd-tocbtn").setAttribute("aria-expanded", "false");
    S.root.querySelector(".rd-setbtn").setAttribute("aria-expanded", "false");
  }

  /* while the reader is open, the browser bar (or the installed app's title bar) takes the page colour */
  function setThemeColor(on) {
    var meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    if (on) {
      if (S.themeWas == null) S.themeWas = meta.getAttribute("content") || "#ffffff";
      meta.setAttribute("content", THEME_BG[settings.theme] || "#ffffff");
    } else if (S.themeWas != null) {
      meta.setAttribute("content", S.themeWas);
      S.themeWas = null;
    }
  }

  function applySettingsUI() {
    if (!S.root) return;
    S.root.setAttribute("data-theme", settings.theme);
    if (S.open) setThemeColor(true);
    var si = sizeIndex();
    var dots = $.dots.children;
    for (var i = 0; i < dots.length; i++) dots[i].className = i <= si ? "on" : "";
    S.root.querySelector('[data-act="smaller"]').disabled = si <= 0;
    S.root.querySelector('[data-act="larger"]').disabled = si >= SIZES.length - 1;
    var bs = $.set.querySelectorAll("[data-k]");
    for (var j = 0; j < bs.length; j++) {
      var k = bs[j].getAttribute("data-k"), v = bs[j].getAttribute("data-v"), cur;
      if (k === "justify") cur = settings.justify ? "1" : "0";
      else cur = String(settings[k]);
      bs[j].setAttribute("aria-checked", String(cur === v));
      bs[j].tabIndex = cur === v ? 0 : -1;
    }
  }

  function onSettingsClick(e) {
    var b = e.target.closest("button");
    if (!b) return;
    var act = b.getAttribute("data-act"), relayoutNeeded = true;
    if (act) {
      var si = sizeIndex();
      settings.size = clamp(si + (act === "larger" ? 1 : -1), 0, SIZES.length - 1);
    } else if (b.getAttribute("data-k")) {
      var k = b.getAttribute("data-k"), v = b.getAttribute("data-v");
      if (k === "theme") { settings.theme = v; relayoutNeeded = false; }
      else if (k === "justify") settings.justify = v === "1";
      else settings[k] = parseInt(v, 10);
    } else return;
    saveSettings();
    applySettingsUI();
    if (relayoutNeeded) relayout();
  }

  /* radio groups: arrow keys move inside the group */
  function groupArrow(e) {
    var b = document.activeElement;
    if (!b || !b.closest || !b.closest(".rd-seg, .rd-tabs")) return false;
    var dir = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!dir) return false;
    var sibs = [].slice.call(b.parentNode.querySelectorAll("button"));
    var nx = sibs[(sibs.indexOf(b) + dir + sibs.length) % sibs.length];
    nx.focus(); nx.click();
    return true;
  }

  function buildToc() {
    var hs = $.flow.querySelectorAll("h1, h2, h3"), out = "", i;
    S.tocEls = [];
    for (i = 0; i < hs.length; i++) {
      var h = hs[i];
      var t = h.textContent.replace(/¶/g, "").trim();
      if (!t) continue;
      if (h.tagName !== "H1" && !h.id) continue;
      S.tocEls.push(h);
      out += '<li class="' + (h.tagName === "H3" ? "l3" : "l2") + '"><button type="button" data-i="' + (S.tocEls.length - 1) + '">' +
        (h.tagName === "H1" ? "Start of chapter" : escapeHtml(t)) + "</button></li>";
    }
    $.tocList.innerHTML = out;
  }
  function escapeHtml(s) { return s.replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function onTocClick(e) {
    var b = e.target.closest("button");
    if (!b) return;
    var h = S.tocEls[parseInt(b.getAttribute("data-i"), 10)];
    togglePanel("toc");
    if (h) goToEl(h, false);
  }
  function tocCurrentIndex() {
    var cur = 0;
    for (var i = 0; i < S.tocEls.length; i++) {
      var p = pageOfEl(S.tocEls[i]);
      if (p !== null && p <= S.page + (S.spread ? 1 : 0)) cur = i;
    }
    return cur;
  }
  function markTocCurrent() {
    var items = $.tocList.children, cur = tocCurrentIndex(), i;
    for (i = 0; i < items.length; i++) items[i].classList.toggle("on", i === cur);
  }

  /* ---------------------------------------------------------------- contents: the whole book */
  /* Each book has <book>/contents.json, written at build time from the headings MkDocs found (tools/site_hooks.py):
     {groups: [{name, items: [{f: file, id?, t: title, s: [{id, n, t, l}]}]}]}, addresses relative to the book's
     folder. It is one of the book's offline files, and it is fetched (and so cached) when the reader opens. */
  var bookCache = {};
  function bookOfPath(path) {
    var v = volOf(path);
    if (!v) return null;
    for (var i = 0; BOOKS && i < BOOKS.length; i++) if (BOOKS[i].id === v[0]) return BOOKS[i];
    return { id: v[0], path: v[0] };
  }
  function bookContents() {
    var b = bookOfPath(S.path || location.pathname);
    if (!b) return Promise.reject(new Error("no book"));
    if (bookCache[b.id]) return bookCache[b.id];
    var base = location.origin + BOOK_ROOT + b.path + "/";
    var p = fetch(base + "contents.json", { credentials: "same-origin" }).then(function (r) {
      if (!r.ok) throw new Error("http " + r.status);
      return r.json();
    }).then(function (c) { c.base = base; c.id = b.id; return c; });
    bookCache[b.id] = p;
    p.catch(function () { if (bookCache[b.id] === p) delete bookCache[b.id]; });
    return p;
  }

  /* ---- "Go to": every chapter and section of the book in one list, found by typing a part of the title or number */
  function goIndex(c) {
    if (c.__go) return c.__go;
    var out = [];
    (c.groups || []).forEach(function (g) {
      g.items.forEach(function (it) {
        out.push({ f: it.f, id: it.id || "", t: it.t, n: "", ch: "", k: normq(it.t), kt: normq(it.t), kind: "ch" });
        (it.s || []).forEach(function (x) {
          out.push({ f: it.f, id: x.id, t: x.t, n: x.n || "", ch: it.t, k: normq((x.n || "") + " " + x.t + " " + it.t), kt: normq(x.t), nn: normq(x.n || ""), kind: x.l === 3 ? "l3" : "l2" });
        });
      });
    });
    c.__go = out;
    return out;
  }
  function onGotoInput() {
    var q = normq($.goIn.value);
    $.toc.classList.toggle("is-goto", q !== "");
    $.goRes.hidden = q === "";
    if (!q) { $.goRes.innerHTML = ""; return; }
    $.goRes.innerHTML = '<p class="rd-note">Looking…</p>';
    bookContents().then(function (c) {
      if (normq($.goIn.value) !== q) return;
      var words = q.split(" "), hits = [], idx = goIndex(c), i;
      // a number ("3", "3.2", "b.1"): the chapter of that number and the sections numbered from it
      var numeric = /^[a-z]?\.?\d+(\.\d+)*$/.test(q);
      var numRe = numeric ? new RegExp("^([a-z]+ )?" + q.replace(/\./g, "\\.") + "([^0-9.]|$)") : null;
      for (i = 0; i < idx.length && hits.length < 60; i++) {
        var ok = true, e = idx[i];
        if (numeric) ok = e.n ? (e.nn === q || e.nn.indexOf(q + ".") === 0) : numRe.test(e.kt);
        else for (var w = 0; w < words.length; w++) if (e.k.indexOf(words[w]) < 0) { ok = false; break; }
        if (ok) hits.push(i);
      }
      S.goHits = hits.map(function (h) { return idx[h]; });
      S.goBase = c.base;
      if (!hits.length) { $.goRes.innerHTML = '<p class="rd-note">Nothing in this book matches \u201c' + escapeHtml($.goIn.value.trim()) + '\u201d.</p>'; return; }
      var out = '<ul class="rd-go-list">';
      S.goHits.forEach(function (e, n) {
        out += '<li class="' + (e.kind === "ch" ? "ch" : e.kind) + '"><button type="button" class="rd-go" data-i="' + n + '">' +
          (e.n ? '<span class="bk-n">' + escapeHtml(e.n) + "</span> " : "") + escapeHtml(e.t) +
          (e.ch ? '<small>' + escapeHtml(e.ch) + "</small>" : "") + "</button></li>";
      });
      $.goRes.innerHTML = out + "</ul>";
    }, function () {
      if (normq($.goIn.value) !== q) return;
      $.goRes.innerHTML = '<p class="rd-note">' + (navigator.onLine === false
        ? "The contents of the whole book are not available offline. Keep this book for offline reading on the library page, or open this panel once while online."
        : "The contents of the whole book could not be loaded. Check the connection and try again.") + "</p>";
    });
  }
  function onGotoKey(e) {
    var k = e.key;
    if (k === "Enter" && e.target === $.goIn) {
      var first = $.goRes.querySelector(".rd-go");
      if (first) { e.preventDefault(); first.click(); }
    } else if (k === "ArrowDown" || k === "ArrowUp") {
      var btns = [].slice.call($.goRes.querySelectorAll(".rd-go"));
      if (!btns.length) return;
      var at = btns.indexOf(document.activeElement), to;
      if (k === "ArrowDown") to = at < 0 ? btns[0] : btns[Math.min(btns.length - 1, at + 1)];
      else to = at <= 0 ? null : btns[at - 1];
      e.preventDefault();
      (to || $.goIn).focus();
    } else if (k === "Escape" && $.goIn.value) {
      e.preventDefault();
      e.stopPropagation();
      $.goIn.value = "";
      onGotoInput();
      $.goIn.focus();
    }
  }
  function onGotoClick(e) {
    var b = e.target.closest("button.rd-go");
    if (!b) return;
    var h = S.goHits && S.goHits[parseInt(b.getAttribute("data-i"), 10)];
    if (!h) return;
    $.goIn.value = "";
    onGotoInput();
    togglePanel("toc");
    var u = new URL(S.goBase + h.f);
    if (u.pathname === S.path) {
      if (!(h.id && jumpHash("#" + h.id))) goto(0, true);
    } else {
      pushBack();
      loadChapter(u.origin + u.pathname, h.id ? { hash: "#" + h.id } : "start");
    }
  }

  function showTab(which, focus) {
    var bk = which === "bk";
    S.tab = bk ? "bk" : "ch";
    sset("localStorage", KEY_TAB, S.tab);
    var tabs = $.toc.querySelectorAll(".rd-tab");
    for (var i = 0; i < tabs.length; i++) {
      var on = tabs[i].getAttribute("data-tab") === S.tab;
      tabs[i].setAttribute("aria-selected", String(on));
      tabs[i].tabIndex = on ? 0 : -1;
    }
    $.toc.querySelector("#rd-tp-ch").hidden = bk;
    $.toc.querySelector("#rd-tp-bk").hidden = !bk;
    if (!bk) { markTocCurrent(); return; }
    var want = bookOfPath(S.path);
    if ($.bookList.getAttribute("data-book") !== (want ? want.id : "")) {
      $.bookList.setAttribute("data-book", want ? want.id : "");
      $.bookList.removeAttribute("data-rendered");
      $.bookList.innerHTML = '<p class="rd-note">Loading the contents…</p>';
    }
    bookContents().then(function (c) {
      if (S.tab !== "bk") return;
      if ($.bookList.getAttribute("data-rendered") !== c.id) renderBook(c);
      markBookCurrent(true);
    }, function () {
      if (S.tab !== "bk") return;
      $.bookList.removeAttribute("data-rendered");
      $.bookList.innerHTML = '<p class="rd-note">' + (navigator.onLine === false
        ? "The contents of the whole book are not available offline. Keep this book for offline reading on the library page, or open this panel once while online."
        : "The contents of the whole book could not be loaded. Check the connection and try again.") + "</p>";
    });
  }

  function renderBook(c) {
    var out = "";
    c.groups.forEach(function (g) {
      out += '<p class="bk-grp">' + escapeHtml(g.name) + '</p><ul class="bk-list">';
      g.items.forEach(function (it) {
        var href = c.base + it.f + (it.id ? "#" + it.id : "");
        var sec = it.s || [];
        out += '<li class="bk-ch" data-f="' + escapeHtml(it.f) + '"' + (it.id ? ' data-self="1"' : "") + '><div class="bk-row">';
        if (sec.length) {
          out += '<button type="button" class="bk-exp" aria-expanded="false" aria-label="Sections of ' + escapeHtml(it.t) + '">' + ICON.chev + "</button>";
        } else out += '<span class="bk-exp bk-none" aria-hidden="true"></span>';
        out += '<a class="bk-link" href="' + escapeHtml(href) + '">' + escapeHtml(it.t) + "</a></div>";
        if (sec.length) {
          out += '<ul class="bk-secs" hidden>';
          sec.forEach(function (s) {
            out += '<li class="' + (s.l === 3 ? "l3" : "l2") + '"><a href="' + escapeHtml(c.base + it.f + "#" + s.id) + '" data-id="' + escapeHtml(s.id) + '">' +
              (s.n ? '<span class="bk-n">' + escapeHtml(s.n) + "</span> " : "") + escapeHtml(s.t) + "</a></li>";
          });
          out += "</ul>";
        }
        out += "</li>";
      });
      out += "</ul>";
    });
    $.bookList.innerHTML = out;
    $.bookList.setAttribute("data-rendered", c.id);
  }

  /* the chapter being read is marked and opened, and so is the section nearest to the page on screen */
  function markBookCurrent(scroll) {
    var rows = $.bookList.querySelectorAll(".bk-ch"), i, cur = null;
    var here = S.path ? S.path.slice(S.path.lastIndexOf("/") + 1) : "";
    if (here === "") here = "index.html";
    for (i = 0; i < rows.length; i++) {
      var on = !cur && rows[i].getAttribute("data-f") === here && !rows[i].hasAttribute("data-self");
      if (on) cur = rows[i];
      rows[i].classList.toggle("on", on);
      var link = rows[i].querySelector(".bk-link");
      if (on) link.setAttribute("aria-current", "page"); else link.removeAttribute("aria-current");
    }
    var old = $.bookList.querySelectorAll(".bk-secs a.on");
    for (i = 0; i < old.length; i++) { old[i].classList.remove("on"); old[i].removeAttribute("aria-current"); }
    if (!cur) return;
    setExpanded(cur, true);
    var h = S.tocEls && S.tocEls.length ? S.tocEls[tocCurrentIndex()] : null;
    if (h && h.id) {
      var cand = cur.querySelectorAll(".bk-secs a");
      for (i = 0; i < cand.length; i++) {
        if (cand[i].getAttribute("data-id") === h.id) { cand[i].classList.add("on"); cand[i].setAttribute("aria-current", "location"); break; }
      }
    }
    if (scroll) {
      var box = $.toc.querySelector(".rd-tabpanels"), t = cur.querySelector(".bk-secs a.on") || cur;
      var br = box.getBoundingClientRect(), tr = t.getBoundingClientRect();
      box.scrollTop += tr.top - br.top - Math.round(br.height / 3);
    }
  }
  function setExpanded(li, on) {
    var b = li.querySelector(".bk-exp"), ul = li.querySelector(".bk-secs");
    if (!ul) return;
    ul.hidden = !on;
    li.classList.toggle("open", on);
    if (b && b.tagName === "BUTTON") b.setAttribute("aria-expanded", String(on));
  }
  function onBookClick(e) {
    var x = e.target.closest("button.bk-exp");
    if (x) { setExpanded(x.closest(".bk-ch"), x.getAttribute("aria-expanded") !== "true"); return; }
    var a = e.target.closest("a");
    if (!a || (e.button && e.button !== 0) || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    var u;
    try { u = new URL(a.href); } catch (err) { return; }
    togglePanel("toc");
    if (u.pathname === S.path) {
      if (!(u.hash && jumpHash(u.hash))) goto(0, true);
    } else {
      pushBack();
      loadChapter(u.origin + u.pathname + u.search, u.hash ? { hash: u.hash } : "start");
    }
  }

  /* the Library button: leave the reader (it stays closed) and open the home page, where all the books are */
  function libraryUrl() { return location.origin + BOOK_ROOT + "index.html"; }
  function onLibraryClick(e) {
    if ((e.button && e.button !== 0) || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    leaveTo(libraryUrl(), false);
  }
  /* "About this book": the book's first page (full contents, offline keeping), which opens as a page and not in the reader */
  function onAboutClick(e) {
    if ((e.button && e.button !== 0) || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    leaveTo($.about.href, true);
  }
  function leaveTo(url, noReader) {
    savePos();
    sdel("sessionStorage", KEY_OPEN);
    S.pushed = false;
    close({ fromPop: true });
    if (noReader) sset("sessionStorage", KEY_SUP, "1"); else sdel("sessionStorage", KEY_SUP);
    location.href = url;
  }

  /* ---------------------------------------------------------------- full screen */
  function fsElement() { return document.fullscreenElement || document.webkitFullscreenElement || null; }
  function toggleFullscreen() {
    try {
      if (fsElement()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      else (S.root.requestFullscreen || S.root.webkitRequestFullscreen).call(S.root);
    } catch (e) { /* ignore */ }
  }
  function onFsChange() {
    var on = !!fsElement();
    $.fs.innerHTML = on ? ICON.fsExit : ICON.fs;
    $.fs.setAttribute("aria-label", on ? "Leave full screen" : "Full screen");
    $.fs.title = on ? "Leave full screen" : "Full screen";
    if (S.open) setTimeout(function () { relayout(); }, 120);
  }

  /* ---------------------------------------------------------------- input: pointer, wheel, keyboard */
  var INTERACTIVE = "a,button,summary,input,select,textarea,.rd-panel,.rd-pop,.rd-top,.rd-back,[role=button]";

  function onPointerDown(e) {
    if (!S.open || S.loading) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    S.p = { id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp, mouse: e.pointerType === "mouse", drag: false, moved: false, target: e.target, dx: 0 };
  }
  function edgeResist(dx) {
    var vw = $.view.clientWidth || 300;
    var noPrev = S.page === 0, noNext = S.page + (S.spread ? 2 : 1) >= S.n;
    if (dx > 0 && noPrev) dx *= S.rec && S.rec.prev ? 0.5 : 0.22;
    else if (dx < 0 && noNext) dx *= S.rec && S.rec.next ? 0.5 : 0.22;
    return clamp(dx, -vw, vw);
  }
  function onPointerMove(e) {
    var p = S.p;
    if (e.pointerType === "mouse" && !p) {
      // mouse movement shows the bar; the cursor hints at the page-turning zones
      var f = e.clientX / S.root.clientWidth;
      $.stage.classList.toggle("rd-cur-prev", f < 1 / 3);
      $.stage.classList.toggle("rd-cur-next", f > 2 / 3);
      if (!S.lastMouse || Math.abs(e.clientX - S.lastMouse[0]) + Math.abs(e.clientY - S.lastMouse[1]) > 3) { S.lastMouse = [e.clientX, e.clientY]; showChrome(false); }
      return;
    }
    if (!p || p.id !== e.pointerId) return;
    var dx = e.clientX - p.x, dy = e.clientY - p.y;
    if (p.mouse) { if (Math.hypot(dx, dy) > 5) p.moved = true; return; }
    if (!p.drag) {
      if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.3) {
        p.drag = true;
        try { $.stage.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ }
        $.flow.classList.remove("rd-anim");
        closePop();
      } else if (Math.abs(dy) > 12 || Math.abs(dx) > 12) p.moved = true;
    }
    if (p.drag) {
      p.dx = dx;
      $.flow.style.transform = "translate3d(" + (-S.page * S.stride + edgeResist(dx)) + "px,0,0)";
    }
  }
  function onPointerUp(e) {
    var p = S.p;
    if (!p || p.id !== e.pointerId) return;
    S.p = null;
    var dx = e.clientX - p.x, dt = Math.max(1, e.timeStamp - p.t);
    if (p.drag) {
      try { $.stage.releasePointerCapture(e.pointerId); } catch (x) { /* ignore */ }
      var thr = Math.max(40, ($.view.clientWidth || 300) * 0.14);
      var v = Math.abs(dx) / dt;
      if (Math.abs(dx) > thr || (v > 0.45 && Math.abs(dx) > 24)) {
        var dir = dx < 0 ? 1 : -1;
        var step = S.spread ? 2 : 1;
        var hasPage = dir > 0 ? S.page + step < S.n : S.page - step >= 0;
        var hasChapter = dir > 0 ? S.rec && S.rec.next : S.rec && S.rec.prev;
        if (hasPage || hasChapter) { turn(dir); return; }
      }
      goto(S.page, true, true);
      return;
    }
    if (p.moved) return;
    if (p.mouse) {
      var sel = window.getSelection && window.getSelection();
      if (sel && String(sel).length > 0) return;
    }
    if (dt > 700 && !p.mouse) return; // a long press is not a tap
    tap(e.clientX, p.target);
  }
  function onPointerCancel(e) {
    var p = S.p;
    if (!p || p.id !== e.pointerId) return;
    S.p = null;
    if (p.drag) goto(S.page, true, true);
  }
  function tap(x, target) {
    if (target && target.closest && target.closest(INTERACTIVE)) return;
    if ($.pop && !$.pop.hidden) { closePop(); return; }
    if (S.panel) { closePanels(); armHide(); return; }
    var f = x / S.root.clientWidth;
    if (f < 1 / 3) turn(-1);
    else if (f > 2 / 3) turn(1);
    else toggleChrome();
  }
  function onWheel(e) {
    if (!S.open || S.loading) return;
    if (e.target.closest && e.target.closest(".rd-panel,.rd-pop")) return;
    if (e.ctrlKey) return; // pinch zoom
    var t = e.target.closest && e.target.closest(".rd-xscroll");
    var d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (t && Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    e.preventDefault();
    var now = e.timeStamp;
    if (Math.abs(d) < 12 || now - S.wheelAt < 480) { if (Math.abs(d) >= 12) S.wheelAt = now; return; }
    S.wheelAt = now;
    turn(d > 0 ? 1 : -1);
  }

  function onKey(e) {
    if (!S.open) return;
    var k = e.key;
    if (k === "Escape" || k === "Esc") {
      if (fsElement()) return; // the browser leaves full screen first
      e.preventDefault();
      if ($.pop && !$.pop.hidden) closePop();
      else if (S.panel === "toc" && $.goIn && $.goIn.value) { resetGoto(); try { $.goIn.focus(); } catch (x) { /* ignore */ } }
      else if (S.panel) { togglePanel(S.panel); }
      else close();
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (S.panel) {
      if (groupArrow(e)) e.preventDefault();
      return;
    }
    var tag = document.activeElement && document.activeElement.tagName;
    var onButton = tag === "BUTTON" || tag === "A" || tag === "INPUT" || tag === "SELECT";
    var dir = 0;
    if (k === "ArrowRight" || k === "PageDown") dir = 1;
    else if (k === "ArrowLeft" || k === "PageUp") dir = -1;
    else if ((k === " " || k === "Spacebar") && !onButton) dir = e.shiftKey ? -1 : 1;
    else if (k === "Home" && !onButton) { e.preventDefault(); goto(0, true); return; }
    else if (k === "End" && !onButton) { e.preventDefault(); goto(S.n - 1, true); return; }
    if (dir) {
      if ((k === " " || k === "Spacebar") && onButton) return;
      e.preventDefault();
      turn(dir);
    }
  }

  /* ---------------------------------------------------------------- start */
  window.bjpReader = { open: open, close: close, goto: function (p) { goto(p, false); }, state: S };
  if (window.document$ && window.document$.subscribe) window.document$.subscribe(init);
  else if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();

/*!
 * Luminstall: Seitenlogik (ohne externe Abhängigkeiten)
 */
(function () {
  'use strict';

  var doc = document.documentElement;
  doc.classList.remove('no-js');

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  // Speicherzugriff kann in privaten Fenstern fehlschlagen
  function store(key, value) {
    try {
      if (value === undefined) return window.localStorage.getItem(key);
      if (value === null) window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, value);
    } catch (e) { return null; }
  }

  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

  function animate(duration, step, done) {
    if (reduceMotion) { step(1); if (done) done(); return; }
    var start = null;
    function frame(ts) {
      if (start === null) start = ts;
      var p = Math.min((ts - start) / duration, 1);
      step(easeOut(p));
      if (p < 1) window.requestAnimationFrame(frame);
      else if (done) done();
    }
    window.requestAnimationFrame(frame);
  }

  /* ---------- Header ---------- */
  var header = $('.site-header');
  if (header && !header.classList.contains('solid')) {
    var onScroll = function () { header.classList.toggle('scrolled', window.scrollY > 40); };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ---------- Mobile Navigation ---------- */
  var toggle = $('.nav-toggle');
  if (toggle) {
    // Alles ausserhalb des Menüs ist bei offenem Menü nicht erreichbar
    var outside = $$('main, footer, .cookie-notice');
    var setOpen = function (open) {
      document.body.classList.toggle('nav-open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', open ? 'Menü schliessen' : 'Menü öffnen');
      outside.forEach(function (el) { el.inert = open; });
      if (open) { var first = $('.nav-links a'); if (first) first.focus({ preventScroll: true }); }
    };
    // Fokus bleibt im offenen Menü (Tab / Shift+Tab)
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab' || !document.body.classList.contains('nav-open')) return;
      var items = [toggle].concat($$('.nav-links a'));
      var i = items.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); items[items.length - 1].focus(); }
      else if (!e.shiftKey && i === items.length - 1) { e.preventDefault(); items[0].focus(); }
    });
    // Beim Wechsel auf Desktop-Breite Menü schliessen
    window.addEventListener('resize', function () {
      if (window.innerWidth > 960 && document.body.classList.contains('nav-open')) setOpen(false);
    });
    toggle.addEventListener('click', function () {
      setOpen(!document.body.classList.contains('nav-open'));
    });
    $$('.nav-links a').forEach(function (a) {
      a.addEventListener('click', function () { setOpen(false); });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && document.body.classList.contains('nav-open')) { setOpen(false); toggle.focus(); }
    });
  }

  /* ---------- Aktiver Menüpunkt ---------- */
  var navLinks = $$('.nav-links a[href^="#"]:not(.btn)');
  if ('IntersectionObserver' in window && navLinks.length) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        navLinks.forEach(function (a) {
          var on = a.getAttribute('href') === '#' + entry.target.id;
          a.classList.toggle('active', on);
          if (on) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    navLinks.forEach(function (a) {
      var target = document.getElementById(a.getAttribute('href').slice(1));
      if (target) spy.observe(target);
    });
  }

  /* ---------- Regleranzeige im Hero: kühlt von Raumtemperatur herunter ---------- */
  var temp = $('[data-temp-from]');
  if (temp) {
    var from = parseFloat(temp.getAttribute('data-temp-from'));
    var to = parseFloat(temp.getAttribute('data-temp-to'));
    var show = function (v) { temp.textContent = (Math.round(v * 10) / 10).toFixed(1); };
    show(from);
    window.setTimeout(function () {
      animate(3200, function (p) { show(from + (to - from) * p); }, function () {
        if (reduceMotion) return;
        // Leichtes Schwanken wie bei einem echten Fühler
        window.setInterval(function () {
          var r = Math.random();
          show(r < 0.2 ? to - 0.1 : r > 0.8 ? to + 0.1 : to);
        }, 2600);
      });
    }, reduceMotion ? 0 : 500);
  }

  /* ---------- Zähler in den Anzeigen ---------- */
  function countUp(el) {
    var raw = el.getAttribute('data-count');
    var target = parseFloat(raw);
    var decimals = (raw.split('.')[1] || '').length;
    animate(1600, function (p) { el.textContent = (target * p).toFixed(decimals); });
  }

  /* ---------- Einblenden beim Scrollen ---------- */
  var reveals = $$('.reveal');
  var counters = $$('[data-count]');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        if (el.hasAttribute('data-count')) countUp(el);
        else el.classList.add('in');
        io.unobserve(el);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    reveals.forEach(function (el) { io.observe(el); });
    counters.forEach(function (el) { el.textContent = '0'; io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('in'); });
  }

  /* ---------- Kreislauf: Leitung füllt sich, Manometer schlagen aus ---------- */
  var cycle = $('.cycle');
  if (cycle) {
    var steps = $$('.cycle-step', cycle);
    var ticking = false;
    var update = function () {
      ticking = false;
      var vh = window.innerHeight;
      var line = vh * 0.62;
      var rect = cycle.getBoundingClientRect();
      var p = (line - rect.top) / rect.height;
      cycle.style.setProperty('--p', Math.max(0, Math.min(1, p)).toFixed(4));
      steps.forEach(function (step) {
        var node = $('.cycle-node', step).getBoundingClientRect();
        step.classList.toggle('on', node.top + node.height / 2 < line);
      });
    };
    var request = function () { if (!ticking) { ticking = true; window.requestAnimationFrame(update); } };
    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', request);
    update();
  }

  /* ---------- Bildansicht (Projekte) ---------- */
  var box = $('#lightbox');
  var shots = $$('.shot');
  if (box && shots.length) {
    var lbImg = $('.lb-stage img', box);
    var lbCap = $('.lb-cap', box);
    var lbCount = $('.lb-count', box);
    var current = 0;
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };
    var showShot = function (i) {
      current = (i + shots.length) % shots.length;
      var shot = shots[current];
      var img = $('img', shot);
      lbImg.src = shot.getAttribute('data-full');
      lbImg.alt = img.alt;
      lbCap.textContent = $('.shot-cap span', shot).textContent;
      lbCount.textContent = pad(current + 1) + ' / ' + pad(shots.length);
    };
    shots.forEach(function (shot, i) {
      shot.addEventListener('click', function () {
        if (typeof box.showModal !== 'function') { window.open(shot.getAttribute('data-full'), '_blank'); return; }
        showShot(i);
        box.showModal();
      });
    });
    $('.lb-close', box).addEventListener('click', function () { box.close(); });
    $('.lb-prev', box).addEventListener('click', function () { showShot(current - 1); });
    $('.lb-next', box).addEventListener('click', function () { showShot(current + 1); });
    box.addEventListener('click', function (e) {
      if (e.target === box || e.target.classList.contains('lb-stage')) box.close();
    });
    box.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') showShot(current - 1);
      if (e.key === 'ArrowRight') showShot(current + 1);
    });
    var touchX = null;
    box.addEventListener('touchstart', function (e) { touchX = e.touches[0].clientX; }, { passive: true });
    box.addEventListener('touchend', function (e) {
      if (touchX === null) return;
      var dx = e.changedTouches[0].clientX - touchX;
      if (Math.abs(dx) > 50) showShot(current + (dx < 0 ? 1 : -1));
      touchX = null;
    });
  }

  /* ---------- Anfrage: öffnet das E-Mail-Programm, nichts wird übertragen ---------- */
  var form = $('#inquiry');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var val = function (name) { var f = form.elements[name]; return f ? String(f.value || '').trim() : ''; };
      var topic = val('anliegen') || 'Anfrage';
      var name = val('name');
      var lines = ['Anliegen: ' + topic, 'Name / Firma: ' + name];
      if (val('telefon')) lines.push('Telefon: ' + val('telefon'));
      lines.push('', val('nachricht'));
      var href = 'mailto:info@luminstall.ch'
        + '?subject=' + encodeURIComponent(topic + ': ' + name)
        + '&body=' + encodeURIComponent(lines.join('\n'));
      window.location.href = href;
    });
  }

  /* ---------- Cookie-Hinweis (rein informativ – es werden keine Cookies gesetzt) ---------- */
  var NOTICE_KEY = 'luminstall-cookie-notice';
  var notice = document.getElementById('cookie-notice');
  if (notice) {
    if (store(NOTICE_KEY) !== 'ok') notice.classList.add('show');
    $('[data-accept]', notice).addEventListener('click', function () {
      store(NOTICE_KEY, 'ok');
      notice.classList.remove('show');
    });
  }
  $$('[data-cookie-settings]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      store(NOTICE_KEY, null);
      if (notice) notice.classList.add('show');
    });
  });

  /* ---------- Jahr im Footer ---------- */
  $$('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });
})();

/* ═══════════════════════════════════════════════════════════════════════
   LoveBot — Befehle-Seite: statische Design-Vorschau bauen
   Führt die echte Render-Pipeline von cmd.js aus (DOM-Stub + echte Daten)
   und schreibt eine komplett eigenständige HTML-Datei mit inline CSS —
   öffnet sich überall ohne Server (z. B. direkt im Datei-Viewer).
   ═══════════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';

const src = fs.readFileSync('public/js/cmd.js', 'utf8');

/* ── Minimal-DOM (wie cmdpage-selftest) ────────────────────────────── */
const els = {};
function el(id) {
  if (!els[id]) els[id] = {
    id, innerHTML: '', textContent: '', style: {}, value: '',
    classList: { toggle() {}, add() {}, remove() {} },
    addEventListener() {}, focus() {},
    querySelectorAll: () => []
  };
  return els[id];
}
globalThis.document = {
  getElementById: el,
  querySelector: () => el('_q'),
  querySelectorAll: () => [],
  addEventListener() {},
  createElement: () => el('_c' + Math.random())
};
globalThis.window = {};
globalThis.makeHearts = () => {};
globalThis.toast = () => {};
globalThis.copyText = () => Promise.resolve();
globalThis.esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const raw = fs.readFileSync('public/js/commands-data.js', 'utf8');
globalThis.window.LOVEBOT_COMMANDS = JSON.parse(raw.slice(raw.indexOf('=') + 1).replace(/;\s*$/, ''));
(0, eval)(src);
await new Promise((r) => setTimeout(r, 300));

/* ── Styles inline einbetten ────────────────────────────────────────── */
const styleCss = fs.readFileSync('public/css/style.css', 'utf8');
const glassCss = fs.readFileSync('public/css/liquid-glass.css', 'utf8');

/* Navbar-Footer-Bausteine der echten Seite übernehmen, Links entschärfen */
const navHtml = `<header class="topnav">
  <a class="brand" href="#"><span class="h">💜</span><b>LOVEBOT</b></a>
  <button class="nav-burger" onclick="this.nextElementSibling.classList.toggle('open')" aria-label="Menü">☰</button>
  <nav class="nav-links">
    <a href="#">Start</a><a href="#">Features</a><a class="active" href="#">Befehle</a>
    <a href="#">Status</a><a href="#">Statistiken</a><a href="#">Bestenliste</a>
    <a href="#">Sessions</a><a href="#">Level</a><a href="#">FAQ</a>
  </nav>
  <a href="#" class="cta">Einloggen →</a>
</header>`;

const html = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Befehle · Design-Vorschau — LoveBot</title>
<style>${styleCss}</style>
<style>${glassCss}</style>
<style>
/* Nur für die statische Vorschau: Seitensprung via Tabs */
.cmdbox { scroll-margin-top: 90px; }
.vp-note { max-width:1220px; margin: 14px auto 0; padding: 0 max(5vw,20px); }
.vp-note span { display:inline-block; font-size:11px; font-weight:800; letter-spacing:.18em; text-transform:uppercase;
  color:rgba(255,255,255,.5); background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.12);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.14); border-radius:999px; padding:6px 14px; }
footer { margin-top: 60px; }
</style>
</head>
<body>
<div class="aurora"></div>
<div class="grid-overlay"></div>
<div class="hearts" id="hearts"></div>
${navHtml}
<div class="wrap-page">
  <section class="hero" style="padding-bottom:8px">
    <span class="badge">📜 Kein Login nötig · live aus dem Bot</span>
    <h1>Alle <span class="grad">Befehle</span></h1>
    <p class="sub">Jeder Befehl aus LoveBot — mit <b>Beispiel</b> und <b>Erklärung</b>, nach Kategorie sortiert. Präfix ist <b>$</b>. Klick auf eine Karte kopiert das Beispiel. 💜</p>
    <div class="cmdsearch-wrap">
      <span class="search-ico">🔎</span>
      <input type="search" placeholder="Befehl suchen … (auf der echten Seite live)">
      <span class="kbd">/</span>
    </div>
    <p class="hint">${els['cmdCount'] ? els['cmdCount'].textContent : ''}</p>
  </section>
  <div class="vp-note"><span>📸 Statische Design-Vorschau — die echte Seite hat zusätzlich Live-Suche &amp; Kopier-Feedback</span></div>
  <div class="catbar-sticky">
    <div class="catbar">${els['catbar'] ? els['catbar'].innerHTML : ''}</div>
  </div>
  <section id="cmdPage" style="padding-top:16px">
    <div class="cmdgrid">${els['cmdFullGrid'] ? els['cmdFullGrid'].innerHTML : ''}</div>
  </section>
</div>
<script>
/* Herz-Animation (wie common.js makeHearts) — rein optisch für die Vorschau */
(function () {
  var holder = document.getElementById('hearts');
  if (!holder) return;
  var emojis = ['💜','🌹','💍','❤️','✨','💙'];
  for (var i = 0; i < 12; i++) {
    var s = document.createElement('span');
    s.textContent = emojis[i % emojis.length];
    s.style.left = (Math.random() * 100) + '%';
    s.style.animationDuration = (8 + Math.random() * 10) + 's';
    s.style.animationDelay = (Math.random() * 9) + 's';
    s.style.fontSize = (13 + Math.random() * 18) + 'px';
    holder.appendChild(s);
  }
  /* Tabs springen in der Vorschau zu den Abschnitten */
  document.querySelectorAll('.cat-tab').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.cat-tab').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      var title = (btn.textContent || '').trim().replace(/ \\d+$/, '').replace(/^✨ alle /i, '');
      var boxes = document.querySelectorAll('.cmdbox h3 .t');
      for (var i = 0; i < boxes.length; i++) {
        if (boxes[i].textContent.trim().toLowerCase() === title.toLowerCase()) {
          boxes[i].closest('.cmdbox').scrollIntoView({ behavior: 'smooth', block: 'start' });
          return;
        }
      }
      document.getElementById('cmdPage').scrollIntoView({ behavior: 'smooth' });
    });
  });
})();
</script>
</body>
</html>`;

fs.mkdirSync('/home/user/preview', { recursive: true });
fs.writeFileSync('/home/user/preview/befehle-vorschau.html', html);
console.log('✔ Vorschau geschrieben: preview/befehle-vorschau.html ·', (html.length / 1024).toFixed(0), 'KB ·',
  (html.match(/class="cmdrow /g) || []).length, 'Karten');

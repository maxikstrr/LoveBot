/* ═══════════════════════════════════════════════════════════════════════
   💎 L O V E B O T   G L A S S   C A R D S   (glassCard.js)
   ─────────────────────────────────────────────────────────────────────
   Rendert die Reports von $ping und $sys als hochwertige „Liquid Glass“-
   Karten (PNG) für WhatsApp — exakt im Design der Referenz (public/test.html):

     · mehrschichtiges Glas: Außenkante · Innenkante · Gegenkante
     · elliptische Glanzlichter oben-links & unten-rechts
     · Rim-Light (Lichtlinie) am oberen Rand
     · Akzent-Balken je Kategorie (Violett · Cyan · Bernstein · Rose)
     · Gradient-Text (weiß → lavendel → cyan)
     · Aurora-Hintergrund (weiche Farbblasen hinter dem Glas)

   Technisch: Die Karte wird als SVG gebaut (nur Gradients/Formen — keine
   Filter, damit jedes librsvg/libvips sie identisch rastert) und mit dem
   bereits im Projekt vorhandenen `sharp` (aus @neelegirly/downloader)
   in ein PNG umgewandelt.

   Robustheit: Ist `sharp` auf dem System nicht ladbar (z. B. fehlende
   Plattform-Binaries), liefern alle Renderer null zurück — die Commands
   fallen dann automatisch auf ihren bewährten Text-Report zurück.
   NIE wird eine Messung weggelassen: Die Karte ist eine ZUSÄTZliche
   hochwertige Darstellung derselben echten Werte.
   ═══════════════════════════════════════════════════════════════════════ */

/* ── sharp lazy laden (plattformabhängig, mit Fallback) ─────────────── */
let sharpModule = null;
let sharpFailed = false;

async function getSharp() {
  if (sharpModule) return sharpModule;
  if (sharpFailed) return null;
  try {
    const mod = await import('sharp');
    sharpModule = mod.default || mod;
    /* Mini-Smoke-Test: 1×1-px-SVG rastern — schlägt fehl, wenn die
       nativen Binaries zur Plattform fehlen (z. B. Linux ohne
       @img/sharp-linux-x64). Dann bleibt nur der Text-Fallback. */
    await sharpModule(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>')).png().toBuffer();
    return sharpModule;
  } catch (e) {
    sharpFailed = true;
    console.log(`[glassCard] sharp nicht verfügbar (${e?.message || e}) — Karten-Bilder werden übersprungen, Text-Reports bleiben aktiv.`);
    return null;
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   DESIGN-TOKENS — identisch zur Web-Referenz (public/test.html + css)
   ═══════════════════════════════════════════════════════════════════════ */

const W = 900;                 /* Kartenbreite (fix)                      */
const M = 34;                  /* Außenabstand                             */
const CW = W - M * 2;          /* Inhaltsbreite                            */
const R_CARD = 26;             /* Eckenradius Hauptkarte                   */
const R_ROW = 18;              /* Eckenradius Zeilen                       */

/* Kategorie-Palette (wie PALETTE in test.html) */
const CAT = {
  violet: { dot: '#a78bfa', label: ['#c4b5fd', '#818cf8'], acc: ['#a78bfa', '#6366f1'], cmd: ['#e9d5ff', '#a78bfa'] },
  cyan:   { dot: '#22d3ee', label: ['#67e8f9', '#38bdf8'], acc: ['#22d3ee', '#0ea5e9'], cmd: ['#a5f3fc', '#22d3ee'] },
  amber:  { dot: '#fbbf24', label: ['#fcd34d', '#fbbf24'], acc: ['#fbbf24', '#f59e0b'], cmd: ['#fde68a', '#fbbf24'] },
  rose:   { dot: '#fb7185', label: ['#fda4af', '#fb7185'], acc: ['#fb7185', '#e11d48'], cmd: ['#fecdd3', '#fb7185'] }
};

/* Status-Farben (Rating-Dots statt Emoji — rendert überall sauber) */
const STATUS_COLOR = {
  excellent: '#34d399',
  good: '#34d399',
  fair: '#fbbf24',
  slow: '#fb923c',
  critical: '#fb7185',
  ok: '#34d399',
  warn: '#fbbf24',
  err: '#fb7185',
  off: '#94a3b8',
  info: '#67e8f9'
};

const FONT = "'Segoe UI','DejaVu Sans','Helvetica Neue',Arial,sans-serif";
const MONO = "'SF Mono','JetBrains Mono','Cascadia Code',Consolas,'DejaVu Sans Mono','Courier New',monospace";

/* ── XML-/SVG-Helfer ─────────────────────────────────────────────────── */
function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
const n2 = (v, d = 0) => (v == null || !isFinite(Number(v)) ? null : Number(Number(v).toFixed(d)));

/* ── Gradient-Definitionen (zentral, ids eindeutig je Karte) ─────────── */
function defsFor(uid) {
  return `
  <defs>
    <!-- Hintergrund: dunkle Basis + Aurora-Blobs (weich, ohne Filter) -->
    <linearGradient id="${uid}bgbase" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0b0614"/><stop offset=".55" stop-color="#0e0819"/><stop offset="1" stop-color="#130a24"/>
    </linearGradient>
    <radialGradient id="${uid}aur1" cx=".5" cy=".5" r=".5">
      <stop offset="0" stop-color="#a78bfa" stop-opacity=".26"/><stop offset="1" stop-color="#a78bfa" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="${uid}aur2" cx=".5" cy=".5" r=".5">
      <stop offset="0" stop-color="#f472b6" stop-opacity=".17"/><stop offset="1" stop-color="#f472b6" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="${uid}aur3" cx=".5" cy=".5" r=".5">
      <stop offset="0" stop-color="#22d3ee" stop-opacity=".14"/><stop offset="1" stop-color="#22d3ee" stop-opacity="0"/>
    </radialGradient>

    <!-- Titel-Gradient: weiß → lavendel → cyan (Referenz .hdr__title) -->
    <linearGradient id="${uid}title" x1="0" y1="0" x2="1" y2=".25">
      <stop offset=".2" stop-color="#ffffff"/><stop offset=".55" stop-color="#b6c2ff"/><stop offset="1" stop-color="#67e8f9"/>
    </linearGradient>
    <!-- Brand-Zeile: violett → cyan (Referenz .hdr__brand) -->
    <linearGradient id="${uid}brand" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#c4b5fd"/><stop offset="1" stop-color="#67e8f9"/>
    </linearGradient>

    <!-- Glas-Füllung einer Zeile (Referenz .row background) -->
    <linearGradient id="${uid}glassV" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity=".045"/>
      <stop offset=".45" stop-color="#ffffff" stop-opacity=".010"/>
      <stop offset="1" stop-color="#000000" stop-opacity=".055"/>
    </linearGradient>

    <!-- Rim-Light: transparent → hell → transparent -->
    <linearGradient id="${uid}rim" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0"/>
      <stop offset=".5" stop-color="#ffffff" stop-opacity=".62"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>

    <!-- Glanzlicht oben-links (elliptisch, nach unten auslaufend) -->
    <linearGradient id="${uid}hltl" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity=".50"/>
      <stop offset=".55" stop-color="#ffffff" stop-opacity=".14"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
    <!-- Glanzlicht unten-rechts -->
    <linearGradient id="${uid}hlbr" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0" stop-color="#ffffff" stop-opacity=".24"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>

    <!-- Health-/Status-Balken (violett → pink → cyan) -->
    <linearGradient id="${uid}health" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#a78bfa"/><stop offset=".55" stop-color="#f472b6"/><stop offset="1" stop-color="#67e8f9"/>
    </linearGradient>

    <!-- Kategorie-Gradients (Label/Akzent/Wert) -->
    ${Object.entries(CAT).map(([k, c]) => `
    <linearGradient id="${uid}lab-${k}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${c.label[0]}"/><stop offset="1" stop-color="${c.label[1]}"/>
    </linearGradient>
    <linearGradient id="${uid}acc-${k}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${c.acc[0]}"/><stop offset="1" stop-color="${c.acc[1]}"/>
    </linearGradient>
    <linearGradient id="${uid}val-${k}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${c.cmd[0]}"/><stop offset="1" stop-color="${c.cmd[1]}"/>
    </linearGradient>`).join('')}

    <!-- Herz-Logo (Brand-Marke oben, als Pfad statt Emoji) -->
    <linearGradient id="${uid}heart" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#c4b5fd"/><stop offset="1" stop-color="#f472b6"/>
    </linearGradient>
    <radialGradient id="${uid}glow" cx=".5" cy=".5" r=".5">
      <stop offset="0" stop-color="#a78bfa" stop-opacity=".55"/><stop offset="1" stop-color="#a78bfa" stop-opacity="0"/>
    </radialGradient>
  </defs>`;
}

/* ── Mehrschichtiges Glas-Panel (Kern der Referenz) ────────────────────
   Liefert alle Layer eines Panels (Hauptkarte oder Zeile) als SVG-String:
   Füllung · Außenkante · Innenkante · Gegenkante · Glanzlichter · Rim.  */
function glassPanel(x, y, w, h, r, uid, opts = {}) {
  const soft = opts.soft ? 0.6 : 1;   /* soft = dezentere Kanten (Zeilen) */
  const hi = (v) => Number(v * soft).toFixed(3);
  return `
  <!-- Glas-Füllung -->
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="url(#${uid}glassV)"/>
  <!-- seitlicher Schimmer oben (radialer „Sheen“ wie in der Referenz) -->
  <path d="M ${x} ${y + h} L ${x} ${y + r * 0.2} Q ${x + w * 0.5} ${y - h * 0.34} ${x + w} ${y + r * 0.2} L ${x + w} ${y + h} Z" fill="#ffffff" opacity=".028" clip-path="none"/>
  <!-- Außenkante -->
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="none" stroke="#ffffff" stroke-opacity="${hi(0.30)}" stroke-width="1"/>
  <!-- Innenkante (inset ~3) -->
  <rect x="${x + 3}" y="${y + 3}" width="${w - 6}" height="${h - 6}" rx="${Math.max(2, r - 3)}" fill="none" stroke="#ffffff" stroke-opacity="${hi(0.07)}" stroke-width="1"/>
  <!-- Gegenkante (dunkel, inset ~1) -->
  <rect x="${x + 1}" y="${y + 1}" width="${w - 2}" height="${h - 2}" rx="${Math.max(2, r - 1)}" fill="none" stroke="#000000" stroke-opacity="${hi(0.22)}" stroke-width="1"/>
  <!-- Glanzlicht oben-links -->
  <ellipse cx="${x + w * 0.34}" cy="${y + 2}" rx="${w * 0.30}" ry="${Math.min(11, h * 0.16)}" fill="url(#${uid}hltl)"/>
  <!-- Glanzlicht unten-rechts -->
  <ellipse cx="${x + w * 0.78}" cy="${y + h - 2}" rx="${w * 0.20}" ry="${Math.min(8, h * 0.10)}" fill="url(#${uid}hlbr)"/>
  <!-- Rim-Light -->
  <rect x="${x + w * 0.14}" y="${y + 1.5}" width="${w * 0.46}" height="1.6" rx="1" fill="url(#${uid}rim)"/>`;
}

/* ── Text-Bausteine ──────────────────────────────────────────────────── */
function text(x, y, str, o = {}) {
  const attrs = [
    `x="${x}"`, `y="${y}"`,
    `font-family="${o.mono ? MONO : FONT}"`,
    o.size ? `font-size="${o.size}"` : '',
    o.weight ? `font-weight="${o.weight}"` : '',
    o.ls ? `letter-spacing="${o.ls}"` : '',
    o.opacity != null ? `opacity="${o.opacity}"` : '',
    o.fill ? `fill="${o.fill}"` : '',
    o.anchor ? `text-anchor="${o.anchor}"` : ''
  ].filter(Boolean).join(' ');
  return `<text ${attrs}>${esc(str)}</text>`;
}

/* Status-Dot mit weichem Halo (ersetzt 🟢🟡🟠🔴 — rendert überall) */
function statusDot(cx, cy, status) {
  const col = STATUS_COLOR[status] || STATUS_COLOR.off;
  return `<circle cx="${cx}" cy="${cy}" r="10" fill="${col}" opacity=".16"/><circle cx="${cx}" cy="${cy}" r="4.6" fill="${col}"/>`;
}

/* ── Zeile im Karten-Layout (wie .row der Referenz) ──────────────────── */
function cardRow(stack, row, uid) {
  const y = stack.y;
  const h = row.h || 56;
  const cat = row.cat || 'cyan';
  const dotX = W - M - 30;                 /* Status-Dot rechts vor Wert */
  const valAnchor = 'end';
  let body = glassPanel(M, y, CW, h, R_ROW, uid, { soft: true });
  /* Akzent-Balken links (3px, Kategorie-Farbe) */
  body += `<rect x="${M + 13}" y="${y + 12}" width="3.5" height="${h - 24}" rx="2" fill="url(#${uid}acc-${cat})"/>`;
  /* Label (mono, links) */
  body += text(M + 30, y + h / 2 + 5.5, row.label, { mono: true, size: 16.5, weight: 700, fill: `url(#${uid}val-${cat})`, ls: '.3' });
  /* Wert (rechts) + optionaler Status-Dot */
  if (row.status) body += statusDot(dotX, y + h / 2, row.status);
  if (row.value != null && row.value !== '') {
    body += text(dotX - 24, y + h / 2 + 5, String(row.value), { size: 14.5, fill: '#ffffff', opacity: .68, anchor: valAnchor, mono: !!row.monoValue });
  }
  stack.y += h + 10;
  return body;
}

/* ── Abschnitts-Header (wie .sec__hdr der Referenz) ──────────────────── */
function sectionHeader(stack, sec, uid) {
  const y = stack.y;
  const cat = CAT[sec.cat] ? sec.cat : 'cyan';
  let out = '';
  /* leuchtender Dot + Halo */
  out += `<circle cx="${M + 8}" cy="${y + 7}" r="15" fill="${CAT[cat].dot}" opacity=".14"/>`;
  out += `<circle cx="${M + 8}" cy="${y + 7}" r="6.5" fill="${CAT[cat].dot}"/>`;
  /* Label mit Kategorie-Gradient */
  out += text(M + 26, y + 12, String(sec.label).toUpperCase(), { size: 16, weight: 700, ls: '3', fill: `url(#${uid}lab-${cat})` });
  /* Zähler-Pille rechts */
  if (sec.count != null) {
    const pw = 62;
    out += `<rect x="${W - M - pw}" y="${y - 7}" width="${pw}" height="26" rx="13" fill="#ffffff" fill-opacity=".03" stroke="#ffffff" stroke-opacity=".09"/>`;
    out += text(W - M - pw / 2, y + 10, String(sec.count), { size: 12.5, weight: 600, ls: '1', fill: '#ffffff', opacity: '.30', anchor: 'middle' });
  }
  stack.y += 34;
  return out;
}

function section(stack, sec, uid) {
  let out = sectionHeader(stack, sec, uid);
  for (const row of sec.rows) out += cardRow(stack, row, uid);
  stack.y += 16; /* Abstand zwischen Abschnitten */
  return out;
}

/* ── Kopfbereich aller Karten ────────────────────────────────────────── */
function cardHeader(stack, head, uid) {
  let out = '';
  /* Herz-Marke mit Glow */
  out += `<circle cx="${M + 26}" cy="${M + 30}" r="34" fill="url(#${uid}glow)"/>`;
  out += `<path d="M ${M + 26} ${M + 44} C ${M + 2} ${M + 24}, ${M + 12} ${M + 4}, ${M + 26} ${M + 18} C ${M + 40} ${M + 4}, ${M + 50} ${M + 24}, ${M + 26} ${M + 44} Z" fill="url(#${uid}heart)"/>`;
  /* Brand-Zeile */
  out += text(M + 74, M + 24, 'LOVEBOT', { size: 13.5, weight: 600, ls: '6', fill: `url(#${uid}brand)` });
  out += text(M + 74 + 118, M + 24, '·  LIVE-REPORT', { size: 13.5, weight: 600, ls: '6', fill: '#ffffff', opacity: '.28' });
  /* Titel */
  out += text(M + 74, M + 66, head.title, { size: 43, weight: 800, ls: '-1', fill: `url(#${uid}title)` });
  /* Meta-Zeile */
  if (head.meta) out += text(M + 76, M + 96, String(head.meta).toUpperCase(), { size: 12.5, weight: 500, ls: '2.5', fill: '#ffffff', opacity: '.30' });
  stack.y = M + 128;
  return out;
}

/* ── Health-/Score-Balken ────────────────────────────────────────────── */
function healthBlock(stack, health, uid) {
  const y = stack.y;
  const h = 92;
  let out = glassPanel(M, y, CW, h, 22, uid, {});
  /* Label links */
  out += text(M + 24, y + 34, 'LOVEBOT HEALTH', { size: 15, weight: 700, ls: '3', fill: `url(#${uid}lab-rose)` });
  /* Score groß rechts */
  out += text(W - M - 24, y + 40, `${health.score}%`, { size: 34, weight: 800, fill: `url(#${uid}title)`, anchor: 'end' });
  /* Balken-Schiene (Glas) + Füllung */
  const bx = M + 24, bw = CW - 48, by = y + 56, bh = 16;
  out += `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="8" fill="#000000" fill-opacity=".30" stroke="#ffffff" stroke-opacity=".10"/>`;
  const fw = Math.max(bh, Math.round((bw) * Math.max(0, Math.min(100, health.score)) / 100));
  out += `<rect x="${bx}" y="${by}" width="${fw}" height="${bh}" rx="8" fill="url(#${uid}health)"/>`;
  out += `<rect x="${bx + 2}" y="${by + 2}" width="${Math.max(4, fw - 4)}" height="3" rx="1.5" fill="#ffffff" opacity=".28"/>`;
  /* Rating + Komponenten-Zeile */
  out += text(bx, y + h - 14, String(health.label).toUpperCase(), { size: 12.5, weight: 700, ls: '2.5', fill: '#ffffff', opacity: '.55' });
  if (health.components) {
    out += text(W - M - 24, y + h - 14, health.components, { size: 12, weight: 500, fill: '#ffffff', opacity: '.38', anchor: 'end' });
  }
  stack.y += h + 20;
  return out;
}

/* ── Fußzeile ────────────────────────────────────────────────────────── */
function footer(stack, lines) {
  let out = '';
  for (const ln of lines) {
    out += text(W / 2, stack.y, String(ln).toUpperCase(), { size: 11.5, weight: 600, ls: '3', fill: '#ffffff', opacity: '.18', anchor: 'middle' });
    stack.y += 20;
  }
  stack.y += 8;
  return out;
}

/* ── Komplette Karte zusammenbauen ───────────────────────────────────── */
function buildCardSvg({ uid, head, blocks = [], foot = [] }) {
  const stack = { y: 0 };
  /* 1. Durchlauf: Höhe messen */
  const measure = { y: 0 };
  cardHeader(measure, head, uid);
  for (const b of blocks) {
    if (b.kind === 'health') { measure.y += 92 + 20; }
    else { sectionHeader(measure, b, uid); measure.y += (b.rows.length * 66) + 16; }
  }
  measure.y += foot.length * 20 + 8;
  const H = Math.round(measure.y + M);

  /* 2. Durchlauf: zeichnen */
  const stack2 = { y: 0 };
  let out = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`;
  out += defsFor(uid);
  /* Hintergrund */
  out += `<rect width="${W}" height="${H}" fill="url(#${uid}bgbase)"/>`;
  out += `<ellipse cx="${W * 0.82}" cy="${H * 0.06}" rx="${W * 0.55}" ry="${H * 0.22}" fill="url(#${uid}aur1)"/>`;
  out += `<ellipse cx="${W * 0.10}" cy="${H * 0.38}" rx="${W * 0.48}" ry="${H * 0.26}" fill="url(#${uid}aur2)"/>`;
  out += `<ellipse cx="${W * 0.55}" cy="${H * 0.94}" rx="${W * 0.55}" ry="${H * 0.20}" fill="url(#${uid}aur3)"/>`;

  /* Haupt-Glaskarte (etwas größer als der Inhalt, damit der Rand atmet) */
  out += glassPanel(10, 10, W - 20, H - 20, R_CARD, uid, {});

  out += cardHeader(stack2, head, uid);
  for (const b of blocks) {
    if (b.kind === 'health') out += healthBlock(stack2, b, uid);
    else out += section(stack2, b, uid);
  }
  out += footer(stack2, foot);
  out += '</svg>';
  return out;
}

/* ═══════════════════════════════════════════════════════════════════════
   RASTERISIERUNG — SVG → PNG (sharp), mit adaptiver Größe
   ═══════════════════════════════════════════════════════════════════════ */
export async function renderSvgPng(svgString, { scale = 2, maxBytes = 1_600_000 } = {}) {
  const sharp = await getSharp();
  if (!sharp) return null;
  try {
    let buf = await sharp(Buffer.from(svgString), { density: Math.round(72 * scale) }).png({ compressionLevel: 9 }).toBuffer();
    /* Zu groß für einen flotten WhatsApp-Versand → eine Stufe kleiner rastern */
    if (buf.length > maxBytes && scale > 1.2) {
      buf = await sharp(Buffer.from(svgString), { density: Math.round(72 * (scale - 0.6)) }).png({ compressionLevel: 9 }).toBuffer();
    }
    return buf;
  } catch (e) {
    console.log(`[glassCard] SVG-Rasterung fehlgeschlagen: ${e?.message || e}`);
    return null;
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   $SYS — System-Status-Karte aus dem echten buildSystemReport-Report
   ═══════════════════════════════════════════════════════════════════════ */
export function buildSysCardSvg(report, { dateLabel = '' } = {}) {
  const s = report?.system || {};
  const m = report?.memory || {};
  const stats = report?.stats || {};
  const p = report?.process || {};
  const heap = s ? `${fmtKB(s.heapMb)}` : fmtB(m.heapUsed);
  const rss = s ? `${fmtKB(s.ramMb)}` : fmtB(m.rss);
  const cpu = s?.cpu != null ? `${Number(s.cpu).toFixed(1)} %` : '—';
  const up = s?.uptimeSec != null ? fmtDur(s.uptimeSec * 1000) : '—';
  const sysOk = !!s;

  const blocks = [
    { label: 'System', cat: 'violet', rows: [
      { label: 'OS', value: s?.platform || p.platform || '—', monoValue: true },
      { label: 'NODE.JS', value: s?.node || p.node || '—', monoValue: true },
      { label: 'ARCH', value: s?.arch || p.arch || '—', monoValue: true },
      { label: 'PID', value: p.pid ?? '—', monoValue: true },
      { label: 'HOSTNAME', value: p.hostname || '—', monoValue: true }
    ] },
    { label: 'Resources', cat: 'amber', rows: [
      { label: 'CPU', value: cpu, status: loadStatus(s?.cpu), monoValue: true },
      { label: 'RSS', value: rss, monoValue: true },
      { label: 'HEAP USED', value: heap, monoValue: true },
      { label: 'EXTERNAL', value: fmtB(m.external), monoValue: true },
      { label: 'UPTIME', value: up, monoValue: true }
    ] },
    { label: 'Love Bot', cat: 'rose', rows: [
      { label: 'USERS', value: int(stats.totalUsers), monoValue: true },
      { label: 'REGISTERED', value: int(stats.registeredUsers), monoValue: true },
      { label: 'GROUPS', value: int(stats.totalGroups), monoValue: true },
      { label: 'ACTIVE GROUPS', value: int(stats.activeGroups), monoValue: true },
      { label: 'BANS', value: int(stats.totalBans), monoValue: true }
    ] },
    { label: 'Connections', cat: 'cyan', rows: [
      { label: 'WHATSAPP', value: String(report?.wsLabel || '—'), status: wsStatusKey(report) },
      { label: 'DATABASE', value: report?.dbLoaded ? 'LOADED' : 'UNAVAILABLE', status: report?.dbLoaded ? 'ok' : 'err' }
    ] }
  ];

  return buildCardSvg({
    uid: 'sys',
    head: {
      title: 'SYSTEM STATUS',
      meta: `${report?.sessionName || 'LoveBot'}${dateLabel ? '  ·  ' + dateLabel : ''}  ·  ${report?.dbLoaded && sysOk ? 'all systems operational' : 'degraded — partial data'}`
    },
    blocks,
    foot: ['LoveBot by Maxichen', 'maxichen.gamebot.me']
  });
}

export async function renderSysCard(report, opts) {
  const svg = buildSysCardSvg(report, opts);
  const png = await renderSvgPng(svg);
  return png ? { png, svg } : null;
}

/* ═══════════════════════════════════════════════════════════════════════
   $PING — Ping-Report-Karte aus den echten Messwerten des Commands
   data = { modeLabel, dateLabel, bot, siteResults, conn, icmpResults,
            speed, sys, health, issues, db }
   ═══════════════════════════════════════════════════════════════════════ */
export function buildPingCardSvg(data) {
  const { bot, siteResults, conn, icmpResults, speed, sys, health, issues, db, modeLabel, dateLabel } = data;
  const blocks = [];

  /* HEALTH zuerst — der Blickfang der Karte */
  blocks.push({
    kind: 'health',
    score: health?.score ?? 0,
    label: health?.rating?.label || '—',
    components: (health?.components || [])
      .filter((c) => c.score != null)
      .map((c) => `${c.label} ${c.score}`)
      .join(' · ')
  });

  /* 🤖 BOT */
  const botRows = [];
  botRows.push({ label: 'VERBINDUNG', value: bot?.wsState?.label || '—', status: bot?.wsState?.open ? 'ok' : 'err' });
  if (bot?.wsStats) botRows.push({ label: 'WS-PING', value: `${Math.round(bot.wsStats.last)} ms · Ø ${Math.round(bot.wsStats.avg)}`, status: rateKey(rateLow(bot.wsStats.avg, [120, 250, 500, 1000])), monoValue: true });
  if (bot?.iqStats) botRows.push({ label: 'IQ-PING', value: `${Math.round(bot.iqStats.last)} ms · Ø ${Math.round(bot.iqStats.avg)}`, status: rateKey(rateLow(bot.iqStats.avg, [120, 250, 500, 1000])), monoValue: true });
  if (bot?.echo?.ok) botRows.push({ label: 'SENDE-RTT', value: `${Math.round(bot.echo.echoMs)} ms`, status: rateKey(rateLow(bot.echo.echoMs, [120, 250, 500, 1000])), monoValue: true });
  blocks.push({ label: 'Bot', cat: 'violet', rows: botRows });

  /* 🌐 WEBSITES — Shape aus probeSite(): { host, probes, okProbes, icmp, dns } */
  const siteRows = [];
  for (const res of siteResults || []) {
    const site = String(res?.host || '—').toUpperCase();
    const oks = res?.okProbes || [];
    if (oks.length) {
      const avgs = oks.map((p) => p.totalMs).filter((v) => typeof v === 'number' && isFinite(v));
      const lastP = oks[oks.length - 1];
      const avg = avgs.length ? avgs.reduce((a, b) => a + b, 0) / avgs.length : null;
      siteRows.push({
        label: site,
        value: `${avg != null ? Math.round(avg) : '?'} ms · ${lastP.status || ''} · ${oks.length}/${(res.probes || []).length} OK`.replace(/ · $/, ''),
        status: rateKey(rateLow(avg, [400, 900, 1800, 3500])),
        monoValue: true
      });
    } else {
      siteRows.push({ label: site, value: 'offline / nicht messbar', status: 'err' });
    }
  }
  if (siteRows.length) blocks.push({ label: 'Websites', cat: 'cyan', rows: siteRows });

  /* 🔗 CONNECTION */
  const cRows = [];
  const { dnsRes, tcpRes, httpRes } = conn || {};
  if (dnsRes?.ok) cRows.push({ label: 'DNS', value: `${dnsRes.ms.toFixed(1)} ms`, status: rateKey(rateLow(dnsRes.ms, [40, 100, 250, 600])), monoValue: true });
  else cRows.push({ label: 'DNS', value: 'nicht messbar', status: 'err' });
  if (tcpRes?.ok) cRows.push({ label: 'TCP', value: `${tcpRes.ms.toFixed(1)} ms`, status: rateKey(rateLow(tcpRes.ms, [60, 150, 350, 800])), monoValue: true });
  else cRows.push({ label: 'TCP', value: 'nicht messbar', status: 'err' });
  if (httpRes?.ok) {
    const tlsMs = httpRes.tlsMs != null && httpRes.tcpMs != null ? httpRes.tlsMs - httpRes.tcpMs : null;
    if (tlsMs != null) cRows.push({ label: 'TLS', value: `${tlsMs.toFixed(1)} ms`, status: rateKey(rateLow(tlsMs, [100, 250, 500, 1200])), monoValue: true });
    cRows.push({ label: 'TTFB', value: `${Math.round(httpRes.ttfbMs)} ms`, status: rateKey(rateLow(httpRes.ttfbMs, [200, 500, 1000, 2000])), monoValue: true });
    cRows.push({ label: 'GESAMT', value: `${Math.round(httpRes.totalMs)} ms · HTTP ${httpRes.httpVersion || '—'}`, status: rateKey(rateLow(httpRes.totalMs, [400, 900, 1800, 3500])), monoValue: true });
  } else {
    cRows.push({ label: 'HTTP', value: 'nicht messbar', status: 'err' });
  }
  blocks.push({ label: 'Connection', cat: 'amber', rows: cRows });

  /* 📡 NETWORK (ICMP + Edge) */
  const nRows = [];
  const oks = (icmpResults || []).filter((r) => r.ok);
  if (oks.length) {
    const avg = oks.reduce((a, r) => a + r.avg, 0) / oks.length;
    const loss = oks.reduce((a, r) => a + (r.lossPct || 0), 0) / oks.length;
    nRows.push({ label: 'ICMP Ø', value: `${avg.toFixed(0)} ms · ${oks.length} Ziele`, status: rateKey(rateLow(avg, [30, 80, 160, 350])), monoValue: true });
    nRows.push({ label: 'VERLUST', value: `${loss.toFixed(1)} %`, status: loss <= 0 ? 'ok' : loss <= 10 ? 'fair' : loss <= 25 ? 'slow' : 'critical', monoValue: true });
  }
  const edge = conn?.edge;
  if (edge?.ok) nRows.push({ label: 'ÖFFENTLICHE IP', value: `${edge.ip || '—'}${edge.loc ? ' · ' + edge.loc : ''}`, status: 'info', monoValue: true });
  else nRows.push({ label: 'ÖFFENTLICHE IP', value: 'nicht ermittelbar', status: 'warn' });
  if (sys?.localIps?.[0]) nRows.push({ label: 'LOKALE IP', value: `${sys.localIps[0].address} · ${sys.localIps[0].iface}`, monoValue: true });
  blocks.push({ label: 'Network', cat: 'rose', rows: nRows });

  /* ⚡ SPEED */
  if (speed) {
    const sRows = [];
    sRows.push(speed.down
      ? { label: 'DOWNLOAD', value: `${speed.down.mbps.toFixed(2)} Mbit/s`, status: rateKey(rateHigh(speed.down.mbps, [2, 8, 20, 50])), monoValue: true }
      : { label: 'DOWNLOAD', value: 'nicht messbar', status: 'err' });
    sRows.push(speed.up
      ? { label: 'UPLOAD', value: `${speed.up.mbps.toFixed(2)} Mbit/s`, status: rateKey(rateHigh(speed.up.mbps, [1, 4, 10, 20])), monoValue: true }
      : { label: 'UPLOAD', value: 'nicht messbar', status: 'err' });
    blocks.push({ label: 'Speed', cat: 'cyan', rows: sRows });
  }

  /* 🖥 SYSTEM */
  const sysRows = [];
  if (sys) {
    sysRows.push({ label: 'UPTIME', value: fmtDur(sys.uptimeMs), monoValue: true });
    const heapPct = sys.heapLimitBytes ? (sys.heapUsedBytes / sys.heapLimitBytes) * 100 : null;
    sysRows.push({ label: 'RAM', value: `${fmtB(sys.rssBytes)} · Heap ${heapPct != null ? heapPct.toFixed(0) + '%' : '—'}`, status: heapPct != null ? rateKey(rateLow(heapPct, [50, 70, 85, 95])) : null, monoValue: true });
    const perCore = sys.cpuCount ? sys.load1 / sys.cpuCount : null;
    sysRows.push({ label: 'CPU', value: `Load ${sys.load1} · ${sys.cpuCount} Kerne`, status: perCore != null ? rateKey(rateLow(perCore, [0.5, 1.0, 2.0, 4.0])) : null, monoValue: true });
    sysRows.push({ label: 'NODE', value: `${sys.nodeVersion} · ${sys.platform} ${sys.arch}`, monoValue: true });
  } else {
    sysRows.push({ label: 'SYSTEMWERTE', value: 'nicht messbar', status: 'err' });
  }
  if (db) sysRows.push({ label: 'DATENBANK', value: db, monoValue: true });
  blocks.push({ label: 'System', cat: 'violet', rows: sysRows });

  /* ⚠️ ISSUES */
  const list = Array.isArray(issues) ? issues : [];
  const sevKey = (sev) => sev === '🔴' ? 'critical' : sev === '🟠' ? 'slow' : sev === '🟡' ? 'fair' : 'info';
  const issueRows = list.length
    ? list.slice(0, 6).map((it) => ({ label: plain(String(it.text || it)).slice(0, 44), value: '', status: sevKey(it.sev) }))
    : [{ label: 'Keine Probleme erkannt', value: '', status: 'ok' }];
  blocks.push({ label: `Issues${list.length ? ' (' + list.length + ')' : ''}`, cat: 'amber', rows: issueRows });

  return buildCardSvg({
    uid: 'ping',
    head: {
      title: 'PING-REPORT',
      meta: `${dateLabel || ''}  ·  ${plain(String(modeLabel || 'standard')).toUpperCase()}`
    },
    blocks,
    foot: [`tip: $ping full · $ping nospeed · $ping <url>`, 'lovebot by maxichen · live gemessen']
  });
}

export async function renderPingCard(data) {
  const svg = buildPingCardSvg(data);
  const png = await renderSvgPng(svg);
  return png ? { png, svg } : null;
}

/* ═══════════════════════════════════════════════════════════════════════
   $PING <URL> — Website-Ping-Karte (wie websitePing() in pingcmd.js):
   data = { host, url, okProbes, probes, icmp, dns }
   ═══════════════════════════════════════════════════════════════════════ */
export function buildWebsiteCardSvg(data, { dateLabel = '' } = {}) {
  const { host, url, okProbes = [], probes = [], icmp, dns } = data;
  const blocks = [];
  const statOf = (fn) => {
    const vals = okProbes.map(fn).filter((v) => typeof v === 'number' && isFinite(v));
    if (!vals.length) return null;
    const min = Math.min(...vals), max = Math.max(...vals);
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    return { min, max, avg, last: vals[vals.length - 1] };
  };

  if (!okProbes.length) {
    /* OFFLINE-Fall: klar erkennbare Karte */
    blocks.push({ label: 'Website', cat: 'rose', rows: [
      { label: 'URL', value: String(url || host || '—').replace(/^https?:\/\//, '').slice(0, 40), monoValue: true },
      { label: 'STATUS', value: `OFFLINE · 0/${probes.length} OK`, status: 'err' },
      { label: 'GRUND', value: String(probes?.[0]?.error || 'unbekannter Fehler').slice(0, 42), status: 'err' },
      ...(dns?.ok ? [{ label: 'DNS', value: `${dns.address || '—'}`, monoValue: true }] : []),
      ...(icmp?.ok ? [{ label: 'ICMP', value: `${icmp.avg.toFixed(1)} ms`, monoValue: true }] : [])
    ] });
  } else {
    const total = statOf((p) => p.totalMs);
    const verdictR = rateLow(total?.avg, [400, 900, 1800, 3500]);
    const last = okProbes[okProbes.length - 1];
    const siteRows = [
      { label: 'URL', value: String(url || host).replace(/^https?:\/\//, '').slice(0, 40), monoValue: true },
      { label: 'IP', value: `${last.address || (dns?.ok ? dns.address : '—')}${dns?.ok && dns.ms != null ? ' · DNS ' + dns.ms.toFixed(0) + ' ms' : ''}`, monoValue: true },
      { label: 'VERDICT', value: `${verdictR ? verdictR.toUpperCase() : '—'} · Ø ${total ? Math.round(total.avg) : '?'} ms · ${okProbes.length}/${probes.length} OK`, status: rateKey(verdictR), monoValue: true }
    ];
    blocks.push({ label: 'Website', cat: 'cyan', rows: siteRows });

    /* ZEITEN (letzte · Ø · min–max) */
    const timeRows = [
      ['DNS', (p) => p.dnsMs, [40, 100, 250, 600]],
      ['TCP', (p) => p.tcpMs, [60, 150, 350, 800]],
      ['TLS', (p) => (p.tlsMs != null && p.tcpMs != null ? p.tlsMs - p.tcpMs : null), [100, 250, 500, 1200]],
      ['TTFB', (p) => p.ttfbMs, [200, 500, 1000, 2000]],
      ['GESAMT', (p) => p.totalMs, [400, 900, 1800, 3500]]
    ].map(([name, fn, th]) => {
      const st = statOf(fn);
      return st
        ? { label: name, value: `${Math.round(st.last)} ms · Ø ${Math.round(st.avg)} · ${Math.round(st.min)}–${Math.round(st.max)}`, status: rateKey(rateLow(st.avg, th)), monoValue: true }
        : { label: name, value: 'nicht messbar', status: 'off' };
    });
    blocks.push({ label: 'Zeiten', cat: 'violet', rows: timeRows });

    /* ANTWORT-Details */
    blocks.push({ label: 'Antwort', cat: 'amber', rows: [
      { label: 'STATUS', value: `${last.status || '—'} ${last.statusText || ''}`.trim(), status: (last.status >= 200 && last.status < 400) ? 'ok' : 'warn', monoValue: true },
      { label: 'HTTP', value: String(last.httpVersion || '—'), monoValue: true },
      { label: 'SERVER', value: String(last.server || '—').slice(0, 34), monoValue: true },
      { label: 'TYP', value: String(last.contentType || '—').split(';')[0].slice(0, 30), monoValue: true },
      { label: 'GRÖSSE', value: fmtB(last.bytes), monoValue: true }
    ] });

    /* ICMP */
    if (icmp?.ok) {
      blocks.push({ label: 'ICMP', cat: 'rose', rows: [
        { label: String(host || 'host').toUpperCase().slice(0, 24), value: `${icmp.avg.toFixed(1)} ms · min ${icmp.min} / max ${icmp.max} · ${icmp.lossPct}% Verlust`, status: icmp.lossPct > 0 ? 'slow' : 'ok', monoValue: true }
      ] });
    }
  }

  return buildCardSvg({
    uid: 'web',
    head: { title: 'WEBSITE-PING', meta: `${String(host || '').toUpperCase()}${dateLabel ? '  ·  ' + dateLabel : ''}` },
    blocks,
    foot: ['lovebot by maxichen · live gemessen']
  });
}

export async function renderWebsiteCard(data, opts) {
  const svg = buildWebsiteCardSvg(data, opts);
  const png = await renderSvgPng(svg);
  return png ? { png, svg } : null;
}

/* ═══════════════════════════════════════════════════════════════════════
   Lokale Formatter (bewusst unabhängig von pingcmd.js, damit dieses
   Modul auch standalone/testbar bleibt)
   ═══════════════════════════════════════════════════════════════════════ */
function fmtB(bytes) {
  const v = Number(bytes);
  if (!isFinite(v) || v < 0) return '—';
  if (v < 1024) return `${Math.round(v)} B`;
  const u = ['KB', 'MB', 'GB', 'TB'];
  let a = v, i = -1;
  do { a /= 1024; i++; } while (a >= 1024 && i < u.length - 1);
  return `${a.toFixed(a >= 100 ? 0 : a >= 10 ? 1 : 2)} ${u[i]}`;
}
function fmtKB(mb) { return fmtB(Number(mb) * 1024 * 1024); }
function fmtDur(ms) {
  const s = Math.max(0, Math.floor(Number(ms) / 1000));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${s % 60}s`;
  return `${s}s`;
}
function int(v) { return (v == null || !isFinite(Number(v))) ? '—' : String(v); }
function plain(s) { return s.replace(/[*_]+/g, ''); }
function rateLow(v, [e, g, f, sl]) {
  if (v == null || !isFinite(v)) return null;
  if (v <= e) return 'excellent';
  if (v <= g) return 'good';
  if (v <= f) return 'fair';
  if (v <= sl) return 'slow';
  return 'critical';
}
function rateHigh(v, [c, sl, f, g]) {
  if (v == null || !isFinite(v)) return null;
  if (v < c) return 'critical';
  if (v < sl) return 'slow';
  if (v < f) return 'fair';
  if (v < g) return 'good';
  return 'excellent';
}
function rateKey(k) { return k || 'off'; }
function wsStatusKey(report) {
  const label = String(report?.wsLabel || '').toUpperCase();
  if (label === 'CONNECTED') return 'ok';
  if (label === 'CONNECTING') return 'warn';
  return 'err';
}
function loadStatus(cpu) {
  if (cpu == null || !isFinite(Number(cpu))) return null;
  const v = Number(cpu);
  if (v <= 50) return 'ok';
  if (v <= 80) return 'fair';
  if (v <= 95) return 'slow';
  return 'critical';
}

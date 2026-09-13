/* ═══════════════════════════════════════════════════════════════════════
   LoveBot — glassCard Selbsttest
   Rendert eine $ping- und eine $sys-Beispielkarte mit realistischen
   Mock-Daten (exakt den Shapes aus netping.js / systemReport.js folgend)
   und prüft Pixel sowie Dateigröße. Keine Netzwerkzugriffe.
   ═══════════════════════════════════════════════════════════════════════ */
import { buildPingCardSvg, buildSysCardSvg, renderSvgPng } from '../glassCard.js';
import fs from 'node:fs';

/* ── Mock: gleiche Shapes wie netping.js/pingcmd.js ─────────────────── */
const bot = {
  wsState: { readyState: 1, label: 'OPEN', open: true, detail: 'readyState 1' },
  wsSamples: [{ ok: true, ms: 118 }, { ok: true, ms: 132 }, { ok: true, ms: 127 }],
  wsOk: [{ ok: true, ms: 118 }, { ok: true, ms: 132 }, { ok: true, ms: 127 }],
  wsStats: { n: 3, min: 118, max: 132, avg: 125.7, jitter: 8, last: 127 },
  iqSamples: [{ ok: true, ms: 141 }, { ok: true, ms: 149 }, { ok: true, ms: 152 }],
  iqOk: [{ ok: true, ms: 141 }, { ok: true, ms: 149 }, { ok: true, ms: 152 }],
  iqStats: { n: 3, min: 141, max: 152, avg: 147.3, jitter: 6.5, last: 152 },
  echo: { ok: true, echoMs: 214, sendMs: 96 }
};
const siteResults = [
  { host: 'maxichen.de', url: 'https://maxichen.de', probes: [{ ok: true, totalMs: 412, status: 200 }, { ok: true, totalMs: 389, status: 200 }, { ok: true, totalMs: 401, status: 200 }], okProbes: [{ ok: true, totalMs: 412, status: 200 }, { ok: true, totalMs: 389, status: 200 }, { ok: true, totalMs: 401, status: 200 }], icmp: { ok: true, avg: 12.3 }, dns: { ok: true, ms: 18, address: '1.2.3.4' } },
  { host: 'maxichen.gamebot.me', url: 'https://maxichen.gamebot.me', probes: [{ ok: true, totalMs: 655, status: 200 }, { ok: false, error: 'timeout' }, { ok: true, totalMs: 702, status: 200 }], okProbes: [{ ok: true, totalMs: 655, status: 200 }, { ok: true, totalMs: 702, status: 200 }], icmp: { ok: true, avg: 14.1 }, dns: { ok: true, ms: 22, address: '5.6.7.8' } }
];
const conn = {
  dnsRes: { ok: true, ms: 14.2, address: '104.16.132.229' },
  tcpRes: { ok: true, ms: 22.8, host: 'cloudflare.com', port: 443 },
  httpRes: { ok: true, ttfbMs: 88, totalMs: 143, tcpMs: 21, tlsMs: 61, status: 200, httpVersion: '2' },
  edge: { ok: true, ip: '84.123.45.67', loc: 'Cologne', colo: 'DUS', tls: 'TLSv1.3', http: 'HTTP/2' }
};
const icmpResults = [
  { ok: true, host: '1.1.1.1', avg: 11.2, min: 10, max: 14, lossPct: 0 },
  { ok: true, host: '8.8.8.8', avg: 13.8, min: 12, max: 18, lossPct: 0 },
  { ok: true, host: 'web.whatsapp.net', avg: 28.4, min: 24, max: 35, lossPct: 0 }
];
const speed = { down: { mbps: 187.42, bytes: 3145728, ms: 134 }, up: { mbps: 38.11, bytes: 1048576, ms: 220 } };
const sys = {
  uptimeMs: 432 * 60 * 1000, rssBytes: 218 * 1024 * 1024, heapUsedBytes: 96 * 1024 * 1024,
  heapTotalBytes: 122 * 1024 * 1024, heapLimitBytes: 4295 * 1024 * 1024, load1: 0.82,
  cpuCount: 8, nodeVersion: 'v24.4.1', platform: 'win32', arch: 'x64',
  localIps: [{ iface: 'Ethernet', address: '192.168.0.42' }]
};
const health = {
  score: 86, rating: { key: 'good', emoji: '🟢', label: 'Good', score: 85 },
  components: [
    { id: 'bot', label: 'Bot', weight: 25, score: 88 },
    { id: 'websites', label: 'Websites', weight: 25, score: 84 },
    { id: 'network', label: 'Netzwerk', weight: 15, score: 97 },
    { id: 'connection', label: 'Verbindung', weight: 10, score: 92 },
    { id: 'speed', label: 'Speed', weight: 10, score: 100 },
    { id: 'system', label: 'System', weight: 15, score: 58 }
  ]
};
const issues = [
  { sev: '🟠', text: '*maxichen.gamebot.me* — 1/3 Versuche fehlgeschlagen _(timeout)_' },
  { sev: '🟡', text: 'RAM-Auslastung hoch _(22% Heap)_' }
];
const db = 'DB › 143 Nutzer · 23 Gruppen · 0 Bans';

const pingSvg = buildPingCardSvg({
  modeLabel: 'Standard _(mit Speedtest)_', dateLabel: '12.09.2026 · 14:03',
  bot, siteResults, conn, icmpResults, speed, sys, health, issues, db
});

const sysReport = {
  status: '🟢 ALL SYSTEMS OPERATIONAL', sessionName: 'LoveBot',
  wsEmoji: '🟢', wsLabel: 'CONNECTED',
  system: { platform: 'win32', node: 'v24.4.1', arch: 'x64', cpu: 12.4, heapMb: 96.2, ramMb: 218.5, uptimeSec: 432 * 60 },
  memory: { heapUsed: 96 * 1024 * 1024, rss: 218 * 1024 * 1024, external: 2.4 * 1024 * 1024 },
  stats: { totalUsers: 143, registeredUsers: 121, totalGroups: 23, activeGroups: 18, totalBans: 0 },
  dbLoaded: true,
  process: { pid: 1234, hostname: 'LOVEBOT-SRV', execPath: 'node', node: 'v24.4.1', platform: 'win32', arch: 'x64' }
};
const sysSvg = buildSysCardSvg(sysReport, { dateLabel: '14:03' });

const { buildWebsiteCardSvg } = await import('../glassCard.js');
const webSvg = buildWebsiteCardSvg({ host: 'maxichen.de', url: 'https://maxichen.de',
  okProbes: [{ totalMs: 412, dnsMs: 18, tcpMs: 21, tlsMs: 61, ttfbMs: 88, status: 200, statusText: 'OK', httpVersion: '2', server: 'cloudflare', contentType: 'text/html; charset=utf-8', bytes: 45123, address: '104.16.132.229' }],
  probes: [{ ok: true }], icmp: { ok: true, avg: 12.3, min: 10, max: 15, lossPct: 0 }, dns: { ok: true, ms: 18, address: '104.16.132.229' } });

fs.writeFileSync('/tmp/ping-card.svg', pingSvg);
fs.writeFileSync('/tmp/sys-card.svg', sysSvg);
fs.writeFileSync('/tmp/web-card.svg', webSvg);

const pingPng = await renderSvgPng(pingSvg);
const sysPng = await renderSvgPng(sysSvg);
const webPng = await renderSvgPng(webSvg);
if (!pingPng || !sysPng || !webPng) { console.log('FAIL: PNG-Rendering fehlgeschlagen'); process.exit(1); }
fs.writeFileSync('/tmp/ping-card.png', pingPng);
fs.writeFileSync('/tmp/sys-card.png', sysPng);
fs.writeFileSync('/tmp/web-card.png', webPng);

/* ── Pixel-Verifikation mit sharp ───────────────────────────────────── */
const sharp = (await import('sharp')).default;
async function verify(file, checks) {
  const meta = await sharp(file).metadata();
  const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
  const px = (x, y) => { const i = (Math.round(y) * info.width + Math.round(x)) * info.channels; return [data[i], data[i + 1], data[i + 2], data[i + 3]]; };
  const count = (x0, y0, x1, y1, min) => { let n = 0; for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) { const i = (y * info.width + x) * info.channels; const b = 0.3 * data[i] + 0.6 * data[i + 1] + 0.1 * data[i + 2]; if (b > min) n++; } return n; };
  console.log(`\n${file}: ${meta.width}x${meta.height} · ${(fs.statSync(file).size / 1024).toFixed(0)} KB`);
  let fails = 0;
  for (const [name, fn] of checks) {
    const ok = !!fn({ px, count, meta, info });
    if (!ok) fails++;
    console.log(`  ${name} → ${ok ? 'OK' : 'FAIL'}`);
  }
  return fails;
}
/* Health-Panel beginnt bei SVG y=162 (M+128) · Balken bei y=218..234 ·
   Balken beginnt bei x=58 → Pixelkoordinaten = SVG × 2 (Scale 2).     */
const failsPing = await verify('/tmp/ping-card.png', [
  ['Vollflächiger dunkler Hintergrund', ({ px }) => px(200, 40)[3] === 255 && px(200, 40)[0] < 90],
  ['Titel „PING-REPORT“ gerendert', ({ count }) => count(150, 160, 1700, 230, 170) > 200],
  ['Herz-Marke gerendert (violett/pink)', ({ px }) => Math.abs(px(120, 128)[0] - 221) < 60],
  ['Health-Balken gefüllt (Gradient-Anfang violett)', ({ px }) => px(140, 450)[2] > 200 && px(140, 450)[0] > 120],
  ['Score-Text gerendert', ({ count }) => count(1200, 340, 1780, 430, 150) > 200],
  ['Section-Header + Zeilen gerendert', ({ count }) => count(60, 560, 1740, 950, 100) > 1000]
]);
const failsSys = await verify('/tmp/sys-card.png', [
  ['Titel „SYSTEM STATUS“ gerendert', ({ count }) => count(150, 160, 1700, 230, 170) > 200],
  ['Abschnitte + Zeilen gerendert', ({ count }) => count(60, 400, 1740, 1400, 100) > 800],
  ['Datei plausibel groß', ({ meta }) => meta.width === 1800 && meta.height > 2000]
]);
const failsWeb = await verify('/tmp/web-card.png', [
  ['Titel „WEBSITE-PING“ gerendert', ({ count }) => count(150, 160, 1700, 230, 170) > 200],
  ['Host in Meta-Zeile', ({ count }) => count(150, 250, 1700, 290, 55) > 100],
  ['Zeilen gerendert', ({ count }) => count(60, 320, 1740, 1600, 100) > 800]
]);
const fails = failsPing + failsSys + failsWeb;
if (fails) { console.log(`\n✘ ${fails} Checks fehlgeschlagen.`); process.exit(1); }
console.log('\n✔ glassCard-Selbsttest erfolgreich — Karten liegen in /tmp/');

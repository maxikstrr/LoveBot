/* ═══════════════════════════════════════════════════════════════════════
   🏓 L O V E B O T   P I N G   (pingcmd.js)
   ─────────────────────────────────────────────────────────────────────
   $ping           → kompletter Live-Report:
                     · Bot-Ping (WebSocket / IQ / Sende-Roundtrip)
                     · WEBSITE-PING auf maxichen.de & maxichen.gamebot.me
                     · Netzwerk-Ping (ICMP)
                     · Verbindungsaufbau (DNS · TCP · TLS · TTFB)
                     · Edge-Infos (echte öffentliche IP)
                     · Speed (klein, Standard) und Systemwerte
                     · Health-Score + erkannte Probleme
   $ping <url>     → Webseiten-Ping für eine beliebige Adresse
   $ping full      → zusätzlich großer Speedtest (24 MB down / 8 MB up)
   $ping nospeed   → ohne Speedtest (nur Latenz/Websites/Netzwerk)

   Prinzip: ALLE Werte sind gemessen (netping.js). Was nicht messbar ist,
   wird als „nicht messbar“ + Grund angezeigt — nie geraten.

   Jede Messung läuft isoliert: Schlägt EIN Wert fehl (z. B. Website B
   mit Timeout), kommt trotzdem ein vollständiger Report — der Fehler
   steht dann als 🔴-Zeile + Eintrag unter ⚠️ ISSUES im Bericht.

   Bewertung: Jede Kennzahl bekommt eine aus dem MESSWERT abgeleitete
   Bewertung (🟢 Excellent/Good · 🟡 Fair · 🟠 Slow · 🔴 Critical).
   Daraus wird ein gewichteter ❤️ Health-Score (0–100 %) berechnet.
   ═══════════════════════════════════════════════════════════════════════ */

import { generateWAMessageFromContent, proto } from '@whiskeysockets/baileys';
import { reactions, sendReaction } from './waApi.js';
import { readDb, systemStats, formatDuration } from './features.js';
import c from './colorApi.js';
import {
  icmpPing, tcpPing, dnsPing, httpProbe, wsPing, iqPing, sendEchoPing,
  speedTest, edgeTrace, sysSnapshot, statsOf, sample
} from './netping.js';

/* Die Websites, die bei $ping (ohne Argument) immer mitgepingt werden. */
const DEFAULT_SITES = ['maxichen.de', 'maxichen.gamebot.me'];

/* ICMP-Ziele für den Netzwerk-Check (öffentliche Resolver + WhatsApp-Web). */
const ICMP_TARGETS = ['1.1.1.1', '8.8.8.8', 'web.whatsapp.net'];

/* Referenz-Host für den Verbindungsaufbau (DNS · TCP · TLS · TTFB). */
const CONN_REF_HOST = 'cloudflare.com';
const CONN_REF_URL = 'https://cloudflare.com/cdn-cgi/trace';

/* ═══════════════════════════════════════════════════════════════════════
   STATUSBEWERTUNG — jede Bewertung entsteht aus dem echten Messwert.
   Schwellen sind bewusst dokumentiert, damit sie nachvollziehbar bleiben.
   ═══════════════════════════════════════════════════════════════════════ */

export const RATINGS = {
  excellent: { key: 'excellent', emoji: '🟢', label: 'Excellent', score: 100 },
  good:      { key: 'good',      emoji: '🟢', label: 'Good',      score: 85 },
  fair:      { key: 'fair',      emoji: '🟡', label: 'Fair',      score: 65 },
  slow:      { key: 'slow',      emoji: '🟠', label: 'Slow',      score: 40 },
  critical:  { key: 'critical',  emoji: '🔴', label: 'Critical',  score: 15 }
};

/* Schwellen „kleiner = besser“: [excellentMax, goodMax, fairMax, slowMax].
   Alles darüber = Critical. Einheit ms, außer anders angegeben. */
const TH = {
  bot:         [120, 250, 500, 1000],  // WS-/IQ-Ping, Sende-RTT (WA-Roundtrips)
  siteTotal:   [400, 900, 1800, 3500], // Gesamt-Requestzeit einer Website
  ttfb:        [200, 500, 1000, 2000], // Zeit bis zum ersten Byte
  dns:         [40, 100, 250, 600],    // DNS-Auflösung
  tcp:         [60, 150, 350, 800],    // TCP-Connect (Handshake)
  tls:         [100, 250, 500, 1200],  // reiner TLS-Handshake
  icmp:        [30, 80, 160, 350],     // ICMP Ø-Latenz
  ramPct:      [50, 70, 85, 95],       // Heap-Auslastung in %
  loadPerCore: [0.5, 1.0, 2.0, 4.0]    // Load average pro CPU-Kern
};

/* Schwellen „größer = besser“ (Mbit/s): [criticalUnter, slowUnter, fairUnter, goodUnter] */
const TH_SPEED_DOWN = [2, 8, 20, 50];
const TH_SPEED_UP = [1, 4, 10, 20];

export function rateLowIsGood(value, table) {
  if (value == null || !isFinite(value)) return null;
  const [e, g, f, s] = table;
  if (value <= e) return RATINGS.excellent;
  if (value <= g) return RATINGS.good;
  if (value <= f) return RATINGS.fair;
  if (value <= s) return RATINGS.slow;
  return RATINGS.critical;
}

export function rateHighIsGood(value, [critBelow, slowBelow, fairBelow, goodBelow]) {
  if (value == null || !isFinite(value)) return null;
  if (value < critBelow) return RATINGS.critical;
  if (value < slowBelow) return RATINGS.slow;
  if (value < fairBelow) return RATINGS.fair;
  if (value < goodBelow) return RATINGS.good;
  return RATINGS.excellent;
}

/* Paketverlust in %: Jeder Verlust über 0 ist auffällig, über 25 % kritisch. */
export function rateLoss(pct) {
  if (pct == null || !isFinite(pct)) return null;
  if (pct <= 0) return RATINGS.excellent;
  if (pct <= 10) return RATINGS.fair;
  if (pct <= 25) return RATINGS.slow;
  return RATINGS.critical;
}

/* Schlechtere von zwei Bewertungen (für kombinierte Kennzahlen). */
function worse(a, b) {
  if (!a) return b;
  if (!b) return a;
  return a.score <= b.score ? a : b;
}

const dot = (rating) => (rating ? rating.emoji : '⚪');

/* ═══════════════════════════════════════════════════════════════════════
   HEALTH SCORE — gewichteter Mittelwert echter Teil-Scores (0–100).
   Komponenten: Bot 25 · Websites 25 · Netzwerk 15 · Verbindung 10 ·
   Speed 10 · System 15. Score null = bewusst übersprungen (z. B. Speed
   bei „nospeed“) → Gewicht wird auf die restlichen verteilt.
   ═══════════════════════════════════════════════════════════════════════ */

export const HEALTH_WEIGHTS = { bot: 25, websites: 25, network: 15, connection: 10, speed: 10, system: 15 };

export function computeHealth(components) {
  const used = (components || []).filter((cm) => cm && cm.score != null && isFinite(cm.score));
  const totalW = used.reduce((a, cm) => a + (cm.weight || 0), 0);
  if (!totalW) return { score: 0, rating: RATINGS.critical, components: components || [] };
  const score = Math.max(0, Math.min(100,
    Math.round(used.reduce((a, cm) => a + cm.weight * cm.score, 0) / totalW)));
  const rating = score >= 90 ? RATINGS.excellent
    : score >= 75 ? RATINGS.good
      : score >= 55 ? RATINGS.fair
        : score >= 35 ? RATINGS.slow
          : RATINGS.critical;
  return { score, rating, components: components || [] };
}

export function healthBar(score, len = 20) {
  const s = Math.max(0, Math.min(100, Number(score) || 0));
  const filled = Math.round((s / 100) * len);
  return '█'.repeat(filled) + '░'.repeat(Math.max(0, len - filled));
}

/* ---------- Formatter ------------------------------------------------ */

const fmtMs = (v) => (v == null ? null : `${Math.round(v)} ms`);
const fmtMsFine = (v) => (v == null ? null : `${(Math.round(v * 10) / 10).toFixed(1)} ms`);
const fmtMbps = (mbps) => (mbps >= 1000 ? `${(mbps / 1000).toFixed(2)} Gbit/s` : `${mbps.toFixed(2)} Mbit/s`);
function fmtBytes(bytes) {
  if (bytes == null || !isFinite(bytes)) return '—';
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}
function fmtRange(st) {
  if (!st) return null;
  return `Ø ${Math.round(st.avg)} · ${Math.round(st.min)}–${Math.round(st.max)} · Jitter ${Math.round(st.jitter)}`;
}

/* ---------- Nachricht senden / bearbeiten ---------------------------- */

async function editText(sock, jid, key, text) {
  const edited = generateWAMessageFromContent(jid, proto.Message.fromObject({ conversation: text }), {});
  const wrapper = generateWAMessageFromContent(jid, proto.Message.fromObject({
    protocolMessage: { key, type: 14, editedMessage: edited.message }
  }), {});
  return sock.relayMessage(jid, wrapper.message, { messageId: wrapper.key.id });
}

async function put(sock, from, msg, key, text) {
  if (key) {
    try { await editText(sock, from, key, text); return key; } catch (e) {}
  }
  try {
    const s = await sock.sendMessage(from, { text }, { quoted: msg });
    return s?.key || null;
  } catch (e) {
    return null;
  }
}

/* ---------- Modus erkennen ------------------------------------------- */

const FLAGS = new Set(['full', 'speed', 'nospeed', 'kurz', 'schnell', 'web', 'site']);

function looksLikeHost(token = '') {
  const t = String(token).trim();
  if (/^https?:\/\//i.test(t)) return true;
  /* Host, optional mit Port/Pfad/Query (github.com/maxikstrr/LoveBot) */
  if (/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}(?:[:/?#].*)?$/i.test(t)) return true;
  /* localhost / IP-Adressen */
  if (/^localhost(?:[:]\d+)?(?:[\/?#].*)?$/i.test(t)) return true;
  return /^\d{1,3}(?:\.\d{1,3}){3}(?:[:]\d+)?(?:[\/?#].*)?$/.test(t);
}

function normalizeUrl(token = '') {
  const t = String(token).trim();
  if (/^https?:\/\//i.test(t)) return t;
  return 'https://' + t.replace(/^\/+/, '');
}

/* ═══════════════════════════════════════════════════════════════════════
   FEHLER-ISOLATION — keine Einzelmessung darf den Report abbrechen.
   safeBlock fängt alles ab und liefert einen ehrlichen Fallback.
   ═══════════════════════════════════════════════════════════════════════ */

async function safeBlock(fn, fallback) {
  try {
    return await fn();
  } catch (e) {
    const err = String(e?.message || e || 'unbekannter Fehler').slice(0, 80);
    return typeof fallback === 'function' ? fallback(err) : fallback;
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   WEBSITE-MESSUNG (eine Adresse → alles was man wissen will)
   ═══════════════════════════════════════════════════════════════════════ */

async function probeSite(rawHost) {
  const url = normalizeUrl(rawHost);
  let host = '';
  try { host = new URL(url).hostname; } catch (e) { host = String(rawHost); }
  const [probes, icmp, dns] = await Promise.all([
    safeBlock(() => sample(() => httpProbe(url, { timeoutMs: 12000 }), 3, 200), []),
    safeBlock(() => icmpPing(host, { count: 3, timeoutMs: 9000 }),
      { ok: false, host, error: 'Messung abgebrochen' }),
    safeBlock(() => dnsPing(host, 6000),
      { ok: false, hostname: host, error: 'Messung abgebrochen' })
  ]);
  const okProbes = (probes || []).filter((p) => p && p.ok);
  return { host, url, probes: probes || [], okProbes, icmp, dns };
}

/* Webseiten-Ping als eigenständiger Befehl:  $ping <url>  */
async function websitePing(sock, from, msg, rawUrl) {
  const url = normalizeUrl(rawUrl);
  let host = '';
  try { host = new URL(url).hostname; } catch (e) { host = String(rawUrl); }

  let key = null;
  try {
    const s = await sock.sendMessage(from, { text: `> 🌍 *WEBSITE-PING* — messe ${host} …` }, { quoted: msg });
    key = s?.key || null;
  } catch (e) {}

  const { probes, okProbes, icmp, dns } = await probeSite(host);

  if (!okProbes.length) {
    const err = probes?.[0]?.error || 'unbekannter Fehler';
    await put(sock, from, msg, key,
      `> 🔴 *WEBSITE OFFLINE*\n\n` +
      `• *URL:* ${url}\n` +
      `• *Status:* 🔴 OFFLINE _(0/3 Versuche ok)_\n` +
      `• *Grund:* ${err}\n` +
      (dns.ok ? `• *DNS:* ${dns.address} (${fmtMsFine(dns.ms)})\n` : `• *DNS:* ${dns.error}\n`) +
      (icmp.ok ? `• *ICMP:* ${fmtMsFine(icmp.avg)}\n` : `• *ICMP:* ${icmp.error}\n`) +
      `\n💡 _Stimmt die Adresse? Manche Server blockieren Bots._`);
    console.log(c.bold + c.brightRed + `[ping] Website-Ping ${host}: OFFLINE (${err}).` + c.reset);
    return;
  }

  const L = [];
  const totalStats = statsOf(okProbes.map((p) => p.totalMs));
  const verdict = rateLowIsGood(totalStats?.avg, TH.siteTotal);
  const okFrac = `${okProbes.length}/${probes.length}`;
  L.push(`🌍 *WEBSITE-PING* — ${host}`);
  L.push(`• *URL* › ${url}`);
  L.push(`• *IP* › ${okProbes[okProbes.length - 1].address || 'unbekannt'}${dns.ok && dns.ms != null ? `  _(DNS ${fmtMsFine(dns.ms)})_` : ''}`);
  L.push(`• *Verdict* › ${dot(verdict)} ${verdict ? verdict.label : '—'} _(Ø ${totalStats ? Math.round(totalStats.avg) : '?'} ms · ${okFrac} OK)_`);
  L.push('');
  L.push('⏱️ *ZEITEN*  _(letzte Messung · Ø · min–max aus 3 Läufen)_');
  const rows = [
    ['DNS', (p) => p.dnsMs, TH.dns],
    ['TCP', (p) => p.tcpMs, TH.tcp],
    ['TLS', (p) => (p.tlsMs != null && p.tcpMs != null ? p.tlsMs - p.tcpMs : null), TH.tls],
    ['TTFB', (p) => p.ttfbMs, TH.ttfb],
    ['Gesamt', (p) => p.totalMs, TH.siteTotal]
  ];
  for (const [name, keyOf, table] of rows) {
    const st = statsOf(okProbes.map(keyOf));
    const r = st ? rateLowIsGood(st.avg, table) : null;
    L.push(st
      ? `   ${dot(r)} ${name.padEnd(7)} › ${fmtMs(st.last).padEnd(8)}  _(Ø ${Math.round(st.avg)} ms · ${Math.round(st.min)}–${Math.round(st.max)})_`
      : `   ⚪ ${name.padEnd(7)} › nicht messbar`);
  }
  L.push('');
  const last = okProbes[okProbes.length - 1];
  L.push('📄 *ANTWORT*');
  L.push(`   Status  › ${last.status} ${last.statusText || ''}`);
  L.push(`   HTTP    › ${last.httpVersion || '—'}`);
  L.push(`   Server  › ${last.server || '—'}`);
  L.push(`   Typ     › ${(last.contentType || '—').split(';')[0]}`);
  L.push(`   Größe   › ${fmtBytes(last.bytes)}`);
  if (last.location) L.push(`   Redirect › ${last.location}`);
  L.push('');
  L.push('🏓 *ICMP*');
  if (icmp.ok) {
    const rAvg = rateLowIsGood(icmp.avg, TH.icmp);
    const rLoss = rateLoss(icmp.lossPct);
    L.push(`   ${dot(worse(rAvg, rLoss))} ${host.length > 12 ? host.slice(0, 12) + '…' : host.padEnd(7)} › ${fmtMsFine(icmp.avg)}  _(min ${icmp.min} / max ${icmp.max} · ${icmp.lossPct}% Verlust)_`);
  } else {
    L.push(`   🔴 ICMP › nicht messbar _(${icmp.error})_`);
  }
  L.push('');
  L.push(`💡 _Alles echt gemessen · ${new Date().toLocaleTimeString('de-DE')}_`);

  await put(sock, from, msg, key, L.join('\n'));
  console.log(c.bold + c.brightGreen + `[ping] Website-Ping ${host}: TTFB ${statsOf(okProbes.map((p) => p.ttfbMs)) ? Math.round(statsOf(okProbes.map((p) => p.ttfbMs)).avg) : '?'} ms.` + c.reset);
}

/* ═══════════════════════════════════════════════════════════════════════
   MESSBLÖCKE — jeder Block ist isoliert; keiner wirft je.
   ═══════════════════════════════════════════════════════════════════════ */

function wsStateInfo(sock) {
  const ws = sock?.ws;
  if (!ws) return { readyState: null, label: 'unbekannt', open: false, detail: 'kein WebSocket-Handle' };
  const rs = ws.readyState;
  const names = { 0: 'CONNECTING', 1: 'OPEN', 2: 'CLOSING', 3: 'CLOSED' };
  const label = names[rs] != null ? names[rs] : `readyState ${rs}`;
  return { readyState: rs, label, open: rs === 1, detail: `readyState ${rs}` };
}

async function measureBot(sock) {
  const [wsSamples, iqSamples, echo] = await Promise.all([
    safeBlock(() => sample(() => wsPing(sock, 4000), 3, 120), []),
    safeBlock(() => sample(() => iqPing(sock, 6000), 3, 120), []),
    safeBlock(() => sendEchoPing(sock, { timeoutMs: 8000 }),
      { ok: false, error: 'Messung abgebrochen' })
  ]);
  const wsOk = (wsSamples || []).filter((s) => s && s.ok);
  const iqOk = (iqSamples || []).filter((s) => s && s.ok);
  return {
    wsState: wsStateInfo(sock),
    wsSamples: wsSamples || [],
    wsOk,
    wsStats: statsOf(wsOk.map((s) => s.ms)),
    iqSamples: iqSamples || [],
    iqOk,
    iqStats: statsOf(iqOk.map((s) => s.ms)),
    echo: echo || { ok: false, error: 'Messung abgebrochen' }
  };
}

async function measureIcmp() {
  return Promise.all(ICMP_TARGETS.map((h) =>
    safeBlock(() => icmpPing(h, { count: 3, timeoutMs: 9000 }),
      { ok: false, host: h, error: 'Messung abgebrochen' })));
}

async function measureSites() {
  return Promise.all(DEFAULT_SITES.map((h) =>
    safeBlock(() => probeSite(h),
      { host: h, url: normalizeUrl(h), probes: [], okProbes: [], icmp: { ok: false, error: 'Messung abgebrochen' }, dns: { ok: false, error: 'Messung abgebrochen' } })));
}

async function measureConnection() {
  const [dnsRes, tcpRes, httpRes, edge] = await Promise.all([
    safeBlock(() => dnsPing(CONN_REF_HOST),
      { ok: false, hostname: CONN_REF_HOST, error: 'Messung abgebrochen' }),
    safeBlock(() => tcpPing(CONN_REF_HOST, 443, 5000),
      { ok: false, host: CONN_REF_HOST, port: 443, error: 'Messung abgebrochen' }),
    safeBlock(() => httpProbe(CONN_REF_URL, { timeoutMs: 12000 }),
      { ok: false, url: CONN_REF_URL, error: 'Messung abgebrochen' }),
    safeBlock(() => edgeTrace(),
      { ok: false, error: 'Messung abgebrochen' })
  ]);
  return { dnsRes, tcpRes, httpRes, edge };
}

/* ═══════════════════════════════════════════════════════════════════════
   REPORT-BAUKASTEN
   ═══════════════════════════════════════════════════════════════════════ */

/* Eine überwachte Website → Zeilen + Teil-Score (Verfügbarkeit × Tempo).
   okCount/3 fließt ein: 2/3 mit „Excellent“-Tempo gibt trotzdem Abzug. */
function siteBlock(res, issues) {
  const out = [];
  const okCount = res.okProbes.length;
  const total = res.probes.length || 3;

  if (!okCount) {
    const err = res.probes?.[0]?.error || 'unbekannter Fehler';
    out.push(`   🔴 *${res.host}* › OFFLINE _(0/${total} OK)_`);
    out.push(`   • Grund › ${err}`);
    if (res.dns.ok) out.push(`   • DNS › ${res.dns.address} (${fmtMsFine(res.dns.ms)})`);
    else out.push(`   • DNS › nicht messbar _(${res.dns.error})_`);
    if (res.icmp.ok) out.push(`   • ICMP › ${fmtMsFine(res.icmp.avg)}`);
    else out.push(`   • ICMP › nicht messbar _(${res.icmp.error})_`);
    issues.push({ sev: '🔴', text: `*${res.host}* — OFFLINE _(${err})_` });
    return { lines: out, score: 0 };
  }

  const last = res.okProbes[res.okProbes.length - 1];
  const st = (keyOf) => statsOf(res.okProbes.map(keyOf));
  const dnsS = st((p) => p.dnsMs);
  const tcpS = st((p) => p.tcpMs);
  const tlsS = st((p) => (p.tlsMs != null && p.tcpMs != null ? p.tlsMs - p.tcpMs : null));
  const ttfbS = st((p) => p.ttfbMs);
  const totS = st((p) => p.totalMs);

  const rTot = totS ? rateLowIsGood(totS.avg, TH.siteTotal) : null;
  const headDot = okCount < total ? '🟡' : dot(rTot);
  const headState = okCount < total ? `INSTABIL _(${okCount}/${total} OK)_` : `ONLINE _(${okCount}/${total} OK)_`;
  out.push(`   ${headDot} *${res.host}* › ${headState}`);
  out.push(`   • Status › ${last.status} ${(last.statusText || '').slice(0, 18)} · ${last.httpVersion || 'HTTP'} · ${last.server || '—'}`);

  const dnsR = dnsS ? rateLowIsGood(dnsS.avg, TH.dns) : null;
  const tcpR = tcpS ? rateLowIsGood(tcpS.avg, TH.tcp) : null;
  const tlsR = tlsS ? rateLowIsGood(tlsS.avg, TH.tls) : null;
  const ttfbR = ttfbS ? rateLowIsGood(ttfbS.avg, TH.ttfb) : null;
  out.push(`   • ${dot(dnsR)} DNS ${dnsS ? fmtMsFine(dnsS.avg) : '—'} · ${dot(tcpR)} TCP ${tcpS ? fmtMsFine(tcpS.avg) : '—'} · ${dot(tlsR)} TLS ${tlsS ? fmtMsFine(tlsS.avg) : '—'} · ${dot(ttfbR)} TTFB ${ttfbS ? fmtMs(ttfbS.avg) : '—'}  _(Ø)_`);
  out.push(`   • ${dot(rTot)} Gesamt ${totS ? fmtMs(totS.avg) : '—'} _(Ø aus ${total} Läufen)_`);

  if (res.icmp.ok) {
    const rAvg = rateLowIsGood(res.icmp.avg, TH.icmp);
    const rLoss = rateLoss(res.icmp.lossPct);
    out.push(`   • ${dot(worse(rAvg, rLoss))} ICMP ${fmtMsFine(res.icmp.avg)} _(min ${res.icmp.min} / max ${res.icmp.max} · ${res.icmp.lossPct}% Verlust)_`);
    if ((res.icmp.lossPct || 0) > 0) {
      issues.push({ sev: (res.icmp.lossPct || 0) > 25 ? '🔴' : '🟠', text: `*${res.host}* — ${res.icmp.lossPct}% ICMP-Verlust` });
    }
  } else {
    out.push(`   • 🔴 ICMP › nicht messbar _(${res.icmp.error})_`);
    issues.push({ sev: '🟠', text: `*${res.host}* — ICMP nicht messbar _(${res.icmp.error})_` });
  }

  /* Teil-Score: Tempo-Bewertung × Verfügbarkeitsanteil */
  const tempoScore = rTot ? rTot.score : 0;
  const score = Math.round(tempoScore * (okCount / total));
  if (okCount < total) {
    issues.push({ sev: '🟠', text: `*${res.host}* — instabil _(${okCount}/${total} Versuche ok)_` });
  } else if (rTot && rTot.score <= RATINGS.slow.score) {
    issues.push({ sev: rTot === RATINGS.critical ? '🔴' : '🟠', text: `*${res.host}* — langsam _(${rTot.label}, Ø ${Math.round(totS.avg)} ms)_` });
  }
  return { lines: out, score };
}

function avgScores(list) {
  const arr = (list || []).filter((v) => v != null && isFinite(v));
  if (!arr.length) return 0;
  return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
}

/* ═══════════════════════════════════════════════════════════════════════
   HAUPT-PING
   ═══════════════════════════════════════════════════════════════════════ */

export async function handlePingCommand({ sock, msg, from, args = [], pref = '$' }) {
  const flags = args.map((a) => String(a).toLowerCase());
  const target = args.find((a) => !FLAGS.has(String(a).toLowerCase()) && looksLikeHost(a));
  if (target) return websitePing(sock, from, msg, target);

  const wantFull = flags.includes('full') || flags.includes('speed');
  const wantNoSpeed = flags.includes('nospeed') || flags.includes('kurz') || flags.includes('schnell');
  const modeLabel = wantFull ? 'FULL _(großer Speedtest)_' : wantNoSpeed ? 'nospeed _(ohne Speedtest)_' : 'Standard _(mit Speedtest)_';

  await sendReaction(sock, from, '🏓', msg.key);

  /* Nachrichten-Laufzeit JETZT messen (Server-Zeit → Bot), bevor die
     Messungen selbst Zeit kosten — sonst wäre der Wert verfälscht. */
  let msgAge = null;
  try {
    const ts = Number(msg.messageTimestamp || 0);
    if (ts > 0) msgAge = Math.max(0, Math.round(Date.now() - ts * 1000));
  } catch (e) {}

  let key = null;
  try {
    const s = await sock.sendMessage(from, {
      text: `> 🏓 *PING-REPORT* ⏳ _messe ${DEFAULT_SITES.length} Websites, Netzwerk & Bot …_`
    }, { quoted: msg });
    key = s?.key || null;
  } catch (e) {}

  const issues = [];

  /* ── Alle Messblöcke laufen PARALLEL und isoliert ──────────────────
     Jeder Block fängt eigene Fehler ab — kein Block kann die anderen
     abbrechen. Nur der Speedtest läuft danach separat, damit er die
     Latenz-Messungen nicht durch Last verfälscht. */
  const [bot, icmpResults, siteResults, conn] = await Promise.all([
    measureBot(sock),
    measureIcmp(),
    measureSites(),
    measureConnection()
  ]);

  /* ── Speed (nur wenn gewünscht) ────────────────────────────────── */
  let speed = null;
  if (!wantNoSpeed) {
    speed = await safeBlock(() => wantFull
      ? speedTest({ downBytes: 8 * 1024 * 1024, upBytes: 4 * 1024 * 1024, maxDownBytes: 32 * 1024 * 1024, maxUpBytes: 16 * 1024 * 1024, timeoutMs: 45000 })
      : speedTest({ downBytes: 3 * 1024 * 1024, upBytes: 1024 * 1024, timeoutMs: 20000 }),
    { down: null, up: null, downError: 'Messung abgebrochen', upError: 'Messung abgebrochen' });
  }

  /* ── System & Datenbank ────────────────────────────────────────── */
  const sys = await safeBlock(() => sysSnapshot(), null);
  let dbLine = '';
  try {
    const st = systemStats(readDb(), sys ? sys.uptimeMs : 0);
    dbLine = `   • DB › ${st.totalUsers} Nutzer · ${st.totalGroups} Gruppen · ${st.totalBans} Bans`;
  } catch (e) {
    dbLine = '   • DB › nicht lesbar';
  }

  /* ── Report bauen ──────────────────────────────────────────────── */
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const dateStr = `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()}`;
  const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  const section = (emoji, title, hint = '') => {
    L.push(hint ? `${emoji} *${title}*  _(${hint})_` : `${emoji} *${title}*`);
  };
  const L = [];
  L.push(`🏓 *PING-REPORT*  ·  *LOVE BOT* 💜`);
  L.push(`📅 ${dateStr} · ${timeStr} Uhr · Modus › ${modeLabel}`);
  L.push('');

  /* ── 🤖 BOT ────────────────────────────────────────────────────── */
  section('🤖', 'BOT');
  L.push(bot.wsState.open
    ? `   🟢 Verbindung › ${bot.wsState.label} _(WhatsApp-WebSocket · ${bot.wsState.detail})_`
    : `   🔴 Verbindung › ${bot.wsState.label} _(${bot.wsState.detail})_`);
  if (!bot.wsState.open) issues.push({ sev: '🔴', text: `WhatsApp-WebSocket nicht offen _(${bot.wsState.label} · ${bot.wsState.detail})_` });

  const wsR = bot.wsStats ? rateLowIsGood(bot.wsStats.avg, TH.bot) : null;
  if (bot.wsStats) {
    L.push(`   ${dot(wsR)} WS-Ping › ${fmtMs(bot.wsStats.last)}  _(${fmtRange(bot.wsStats)} ms · ${bot.wsOk.length}/${bot.wsSamples.length} OK)_`);
  } else {
    L.push(`   🔴 WS-Ping › nicht messbar _(${bot.wsSamples[0]?.error || '—'})_`);
    issues.push({ sev: '🔴', text: `WS-Ping nicht messbar _(${bot.wsSamples[0]?.error || '—'})_` });
  }

  const iqR = bot.iqStats ? rateLowIsGood(bot.iqStats.avg, TH.bot) : null;
  if (bot.iqStats) {
    L.push(`   ${dot(iqR)} IQ-Ping › ${fmtMs(bot.iqStats.last)}  _(${fmtRange(bot.iqStats)} ms · ${bot.iqOk.length}/${bot.iqSamples.length} OK)_`);
  } else {
    L.push(`   🔴 IQ-Ping › nicht messbar _(${bot.iqSamples[0]?.error || '—'})_`);
    issues.push({ sev: '🔴', text: `IQ-Ping nicht messbar _(${bot.iqSamples[0]?.error || '—'})_` });
  }

  const echoR = bot.echo.ok ? rateLowIsGood(bot.echo.echoMs, TH.bot) : null;
  if (bot.echo.ok) {
    L.push(`   ${dot(echoR)} Sende-RTT › ${fmtMs(bot.echo.echoMs)}  _(Server-Echo · Senden ${fmtMs(bot.echo.sendMs)})_`);
  } else {
    L.push(`   🔴 Sende-RTT › nicht messbar _(${bot.echo.error || '—'})_`);
    issues.push({ sev: '🔴', text: `Sende-RTT nicht messbar _(${bot.echo.error || '—'})_` });
  }
  if (msgAge != null) L.push(`   • Nachricht→Bot › ${fmtMs(msgAge)}  _(Server-Zeitstempel · Info)_`);

  /* Bot-Teilscore: Ø aus WS/IQ/Echo (Fehlschlag = 0, Teil-OK = anteilig) */
  const wsScore = bot.wsStats ? Math.round(wsR.score * (bot.wsOk.length / Math.max(1, bot.wsSamples.length))) : 0;
  const iqScore = bot.iqStats ? Math.round(iqR.score * (bot.iqOk.length / Math.max(1, bot.iqSamples.length))) : 0;
  const echoScore = bot.echo.ok ? echoR.score : 0;
  const botScore = avgScores([wsScore, iqScore, echoScore]);
  for (const [label, rating, val] of [['WS-Ping', wsR, bot.wsStats?.avg], ['IQ-Ping', iqR, bot.iqStats?.avg], ['Sende-RTT', echoR, bot.echo.echoMs]]) {
    if (rating && rating.score <= RATINGS.slow.score) {
      issues.push({ sev: rating === RATINGS.critical ? '🔴' : '🟠', text: `${label} ${rating.label.toLowerCase()} _(Ø ${Math.round(val)} ms)_` });
    }
  }
  L.push('');

  /* ── 🌐 WEBSITES ───────────────────────────────────────────────── */
  section('🌐', 'WEBSITES', DEFAULT_SITES.join(' + '));
  const siteScores = [];
  for (const res of siteResults) {
    const b = siteBlock(res, issues);
    L.push(...b.lines);
    siteScores.push(b.score);
  }
  const websitesScore = avgScores(siteScores);
  L.push('');

  /* ── 🔗 CONNECTION ─────────────────────────────────────────────── */
  section('🔗', 'CONNECTION', `Referenz: ${CONN_REF_HOST}`);
  const { dnsRes, tcpRes, httpRes } = conn;
  const dnsR = dnsRes.ok ? rateLowIsGood(dnsRes.ms, TH.dns) : null;
  L.push(dnsRes.ok
    ? `   ${dot(dnsR)} DNS › ${fmtMsFine(dnsRes.ms)} _(${dnsRes.address || '—'})_`
    : `   🔴 DNS › nicht messbar _(${dnsRes.error})_`);
  if (!dnsRes.ok) issues.push({ sev: '🔴', text: `DNS (${CONN_REF_HOST}) fehlgeschlagen _(${dnsRes.error})_` });

  const tcpStandaloneR = tcpRes.ok ? rateLowIsGood(tcpRes.ms, TH.tcp) : null;
  L.push(tcpRes.ok
    ? `   ${dot(tcpStandaloneR)} TCP › ${fmtMsFine(tcpRes.ms)} _(${CONN_REF_HOST}:443 · Connect)_`
    : `   🔴 TCP › nicht messbar _(${tcpRes.error})_`);
  if (!tcpRes.ok) issues.push({ sev: '🔴', text: `TCP-Connect (${CONN_REF_HOST}:443) fehlgeschlagen _(${tcpRes.error})_` });

  const tlsHandshake = httpRes.ok && httpRes.tlsMs != null && httpRes.tcpMs != null ? httpRes.tlsMs - httpRes.tcpMs : null;
  const tlsR = tlsHandshake != null ? rateLowIsGood(tlsHandshake, TH.tls) : null;
  const ttfbR = httpRes.ok ? rateLowIsGood(httpRes.ttfbMs, TH.ttfb) : null;
  const connTotR = httpRes.ok ? rateLowIsGood(httpRes.totalMs, TH.siteTotal) : null;
  if (httpRes.ok) {
    L.push(`   ${dot(tlsR)} TLS › ${tlsHandshake != null ? fmtMsFine(tlsHandshake) : '—'} _(reiner Handshake)_`);
    L.push(`   ${dot(ttfbR)} TTFB › ${fmtMs(httpRes.ttfbMs)}`);
    L.push(`   ${dot(connTotR)} Gesamt › ${fmtMs(httpRes.totalMs)} _(${httpRes.status} · HTTP ${httpRes.httpVersion || '—'})_`);
  } else {
    L.push(`   🔴 HTTP › nicht messbar _(${httpRes.error})_`);
    issues.push({ sev: '🔴', text: `HTTP-Referenz (${CONN_REF_HOST}) fehlgeschlagen _(${httpRes.error})_` });
  }
  const connectionScore = avgScores([
    dnsRes.ok ? dnsR.score : 0,
    tcpRes.ok ? tcpStandaloneR.score : 0,
    tlsHandshake != null ? tlsR.score : 0,
    httpRes.ok ? ttfbR.score : 0
  ]);
  L.push('');

  /* ── 📡 NETWORK ────────────────────────────────────────────────── */
  section('📡', 'NETWORK');
  const icmpScores = [];
  for (const r of icmpResults) {
    if (r.ok) {
      const rAvg = rateLowIsGood(r.avg, TH.icmp);
      const rLoss = rateLoss(r.lossPct);
      const combined = worse(rAvg, rLoss);
      L.push(`   ${dot(combined)} ${r.host.padEnd(15)} › ${fmtMsFine(r.avg).padEnd(9)}  _(min ${r.min} / max ${r.max} · ${r.lossPct}% Verlust)_`);
      icmpScores.push(combined ? combined.score : 0);
      if ((r.lossPct || 0) > 0) {
        issues.push({ sev: (r.lossPct || 0) > 25 ? '🔴' : '🟠', text: `*${r.host}* — ${r.lossPct}% Paketverlust` });
      } else if (combined && combined.score <= RATINGS.slow.score) {
        issues.push({ sev: combined === RATINGS.critical ? '🔴' : '🟠', text: `*${r.host}* — langsam _(${combined.label}, Ø ${r.avg} ms)_` });
      }
    } else {
      L.push(`   🔴 ${r.host.padEnd(15)} › nicht messbar _(${r.error})_`);
      icmpScores.push(0);
      issues.push({ sev: '🔴', text: `*${r.host}* — ICMP nicht messbar _(${r.error})_` });
    }
  }
  const networkScore = avgScores(icmpScores);

  /* Server-Netz: echte öffentliche + lokale IP */
  const edge = conn.edge;
  if (edge.ok) {
    L.push(`   🟢 Öffentliche IP › ${edge.ip || '—'}  ${edge.loc ? `(${edge.loc}${edge.colo ? ` · ${edge.colo}` : ''})` : ''}`);
    if (edge.tls || edge.http) L.push(`   • Protokoll › ${edge.tls || '—'} · ${edge.http || '—'}`);
  } else {
    L.push(`   🔴 Öffentliche IP › nicht messbar _(${edge.error})_`);
    issues.push({ sev: '🟠', text: `Öffentliche IP nicht ermittelbar _(${edge.error})_` });
  }
  const localIp = sys?.localIps?.[0];
  L.push(localIp ? `   • Lokale IP › ${localIp.address}  _(${localIp.iface})_` : '   • Lokale IP › nicht ermittelbar');

  /* Speed (gemessen — oder bewusst übersprungen) */
  let speedScore = null;
  if (speed) {
    L.push(`   ⚡ *SPEED* _(gemessen · speed.cloudflare.com)_`);
    const downR = speed.down ? rateHighIsGood(speed.down.mbps, TH_SPEED_DOWN) : null;
    const upR = speed.up ? rateHighIsGood(speed.up.mbps, TH_SPEED_UP) : null;
    L.push(speed.down
      ? `   ${dot(downR)} ↓ Download › ${fmtMbps(speed.down.mbps)}  _(${fmtBytes(speed.down.bytes)} in ${(speed.down.ms / 1000).toFixed(2)}s)_`
      : `   🔴 ↓ Download › nicht messbar _(${speed.downError || '—'})_`);
    L.push(speed.up
      ? `   ${dot(upR)} ↑ Upload › ${fmtMbps(speed.up.mbps)}  _(${fmtBytes(speed.up.bytes)} in ${(speed.up.ms / 1000).toFixed(2)}s)_`
      : `   🔴 ↑ Upload › nicht messbar _(${speed.upError || '—'})_`);
    if (!speed.down) issues.push({ sev: '🔴', text: `Speedtest-Download fehlgeschlagen _(${speed.downError || '—'})_` });
    if (!speed.up) issues.push({ sev: '🔴', text: `Speedtest-Upload fehlgeschlagen _(${speed.upError || '—'})_` });
    speedScore = Math.round((downR ? downR.score : 0) * 0.6 + (upR ? upR.score : 0) * 0.4);
  } else {
    L.push(`   • Speed › übersprungen _($ping ohne „nospeed“ misst ihn mit)_`);
  }
  L.push('');

  /* ── 🖥 SYSTEM ─────────────────────────────────────────────────── */
  section('🖥', 'SYSTEM');
  let ramScore = null;
  let cpuScore = null;
  if (sys) {
    L.push(`   • Uptime › ${formatDuration(sys.uptimeMs)}`);
    const heapPct = sys.heapLimitBytes ? (sys.heapUsedBytes / sys.heapLimitBytes) * 100 : null;
    const ramR = heapPct != null ? rateLowIsGood(heapPct, TH.ramPct) : null;
    ramScore = ramR ? ramR.score : null;
    L.push(`   ${dot(ramR)} RAM › ${fmtBytes(sys.rssBytes)}  _(Heap ${fmtBytes(sys.heapUsedBytes)} / ${fmtBytes(sys.heapLimitBytes)}${heapPct != null ? ` · ${heapPct.toFixed(0)}%` : ''})_`);
    const perCore = sys.cpuCount ? sys.load1 / sys.cpuCount : null;
    const cpuR = perCore != null ? rateLowIsGood(perCore, TH.loadPerCore) : null;
    cpuScore = cpuR ? cpuR.score : null;
    L.push(`   ${dot(cpuR)} CPU › Load ${sys.load1}  _(${sys.cpuCount} Kerne${perCore != null ? ` · ${perCore.toFixed(2)}/Kern` : ''})_`);
    L.push(`   • Node › ${sys.nodeVersion} · ${sys.platform} ${sys.arch}`);
    if (ramR && ramR.score <= RATINGS.slow.score) {
      issues.push({ sev: ramR === RATINGS.critical ? '🔴' : '🟠', text: `RAM-Auslastung hoch _(${heapPct.toFixed(0)}% Heap)_` });
    }
    if (cpuR && cpuR.score <= RATINGS.slow.score) {
      issues.push({ sev: cpuR === RATINGS.critical ? '🔴' : '🟠', text: `CPU-Last hoch _(Load ${sys.load1} bei ${sys.cpuCount} Kernen)_` });
    }
  } else {
    L.push('   🔴 Systemwerte › nicht messbar');
    issues.push({ sev: '🔴', text: 'Systemwerte nicht messbar' });
  }
  L.push(dbLine);
  const sysParts = [ramScore, cpuScore].filter((v) => v != null);
  const systemScore = sysParts.length ? avgScores(sysParts) : null;
  L.push('');

  /* ── 📊 HEALTH ─────────────────────────────────────────────────── */
  const health = computeHealth([
    { id: 'bot', label: 'Bot', weight: HEALTH_WEIGHTS.bot, score: botScore },
    { id: 'websites', label: 'Websites', weight: HEALTH_WEIGHTS.websites, score: websitesScore },
    { id: 'network', label: 'Netzwerk', weight: HEALTH_WEIGHTS.network, score: networkScore },
    { id: 'connection', label: 'Verbindung', weight: HEALTH_WEIGHTS.connection, score: connectionScore },
    { id: 'speed', label: 'Speed', weight: HEALTH_WEIGHTS.speed, score: speedScore },
    { id: 'system', label: 'System', weight: HEALTH_WEIGHTS.system, score: systemScore }
  ]);
  section('📊', 'HEALTH');
  L.push(`   ❤️ *LoveBot Health*`);
  L.push(`   ${healthBar(health.score)} ${health.score}%`);
  L.push(`   ${health.rating.emoji} *${health.rating.label}*`);
  const compLine = health.components
    .filter((cm) => cm.score != null)
    .map((cm) => `${cm.label} ${cm.score}`)
    .join(' · ');
  L.push(`   • ${compLine}${speedScore == null ? '  _(Speed übersprungen)_' : ''}`);
  L.push('');

  /* ── ⚠️ ISSUES ─────────────────────────────────────────────────── */
  section('⚠️', 'ISSUES');
  if (!issues.length) {
    L.push('   ✨ Keine Probleme erkannt — alles läuft rund.');
  } else {
    const order = { '🔴': 0, '🟠': 1, '🟡': 2 };
    const sorted = [...issues].sort((a, b) => (order[a.sev] ?? 9) - (order[b.sev] ?? 9));
    const shown = sorted.slice(0, 10);
    for (const it of shown) L.push(`   ${it.sev} ${it.text}`);
    if (sorted.length > shown.length) L.push(`   • … +${sorted.length - shown.length} weitere`);
  }
  L.push('');
  L.push(`💡 _Tipp: ${pref}ping full = großer Speedtest · ${pref}ping <url> = eine Website prüfen · ${pref}ping nospeed = ohne Speedtest_`);
  L.push(`💡 _Alles live gemessen — ${pref}ping prüft ${DEFAULT_SITES.join(' & ')} immer mit._`);

  await put(sock, from, msg, key, L.join('\n'));

  /* Abschluss-Reaction passend zum Gesundheitszustand (bestehende Emojis) */
  try {
    const finalEmoji = health.score >= 75
      ? reactions.completion.reactions.withoutAnyProblems
      : health.score >= 55
        ? reactions.completion.reactions.partial
        : reactions.errors.reactions.warning;
    await sendReaction(sock, from, finalEmoji, msg.key);
  } catch (e) {}
  console.log(c.bold + c.brightGreen +
    `[ping] Report gesendet (WS ${bot.wsStats ? Math.round(bot.wsStats.avg) : '—'} ms · IQ ${bot.iqStats ? Math.round(bot.iqStats.avg) : '—'} ms · RTT ${bot.echo.ok ? Math.round(bot.echo.echoMs) : '—'} ms · Health ${health.score}% ${health.rating.label} · ${issues.length} Issues).` +
    c.reset);
}

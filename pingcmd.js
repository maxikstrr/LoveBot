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
   $ping <url>     → Webseiten-Ping für eine beliebige Adresse
   $ping full      → zusätzlich großer Speedtest (24 MB down / 8 MB up)
   $ping nospeed   → ohne Speedtest (nur Latenz/Websites/Netzwerk)

   Prinzip: ALLE Werte sind gemessen (netping.js). Was nicht messbar ist,
   wird als „nicht messbar“ + Grund angezeigt — nie geraten.
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

/* ---------- Formatter ------------------------------------------------ */

const fmtMs = (v) => (v == null ? null : `${Math.round(v)} ms`);
const fmtMsFine = (v) => (v == null ? null : `${(Math.round(v * 10) / 10).toFixed(1)} ms`);
const fmtMbps = (mbps) => (mbps >= 1000 ? `${(mbps / 1000).toFixed(2)} Gbit/s` : `${mbps.toFixed(2)} Mbit/s`);
function fmtBytes(bytes) {
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
   WEBSITE-MESSUNG (eine Adresse → alles was man wissen will)
   ═══════════════════════════════════════════════════════════════════════ */

async function probeSite(rawHost) {
  const url = normalizeUrl(rawHost);
  let host = '';
  try { host = new URL(url).hostname; } catch (e) { host = String(rawHost); }
  const [probes, icmp, dns] = await Promise.all([
    sample(() => httpProbe(url, { timeoutMs: 12000 }), 3, 200),
    icmpPing(host, { count: 3, timeoutMs: 9000 }),
    dnsPing(host, 6000)
  ]);
  const okProbes = probes.filter((p) => p.ok);
  return { host, url, probes, okProbes, icmp, dns };
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
      `> ❌ *WEBSITE-PING FEHLGESCHLAGEN*\n\n` +
      `• *URL:* ${url}\n` +
      `• *Grund:* ${err}\n` +
      (dns.ok ? `• *DNS:* ${dns.address} (${fmtMsFine(dns.ms)})\n` : `• *DNS:* ${dns.error}\n`) +
      (icmp.ok ? `• *ICMP:* ${fmtMsFine(icmp.avg)}\n` : `• *ICMP:* ${icmp.error}\n`) +
      `\n💡 _Stimmt die Adresse? Manche Server blockieren Bots._`);
    return;
  }

  const L = [];
  L.push(`🌍 *WEBSITE-PING* — ${host}`);
  L.push(`• *URL* › ${url}`);
  L.push(`• *IP* › ${okProbes[okProbes.length - 1].address || 'unbekannt'}${dns.ok && dns.ms != null ? `  _(DNS ${fmtMsFine(dns.ms)})_` : ''}`);
  L.push('');
  L.push('⏱️ *ZEITEN*  _(letzte Messung · Ø · min–max aus 3 Läufen)_');
  for (const [name, keyOf] of [
    ['DNS', (p) => p.dnsMs],
    ['TCP', (p) => p.tcpMs],
    ['TLS', (p) => (p.tlsMs != null && p.tcpMs != null ? p.tlsMs - p.tcpMs : null)],
    ['TTFB', (p) => p.ttfbMs],
    ['Gesamt', (p) => p.totalMs]
  ]) {
    const st = statsOf(okProbes.map(keyOf));
    L.push(st
      ? `   ${name.padEnd(7)} › ${fmtMs(st.last).padEnd(8)}  _(Ø ${Math.round(st.avg)} ms · ${Math.round(st.min)}–${Math.round(st.max)})_`
      : `   ${name.padEnd(7)} › nicht messbar`);
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
  L.push(icmp.ok
    ? `   ${host.padEnd(7)} › ${fmtMsFine(icmp.avg)}  _(min ${icmp.min} / max ${icmp.max} · ${icmp.lossPct}% Verlust)_`
    : `   ${host.padEnd(7)} › nicht messbar _(${icmp.error})_`);
  L.push('');
  L.push(`💡 _Alles echt gemessen · ${new Date().toLocaleTimeString('de-DE')}_`);

  await put(sock, from, msg, key, L.join('\n'));
  console.log(c.bold + c.brightGreen + `[ping] Website-Ping ${host}: TTFB ${statsOf(okProbes.map((p) => p.ttfbMs)) ? Math.round(statsOf(okProbes.map((p) => p.ttfbMs)).avg) : '?'} ms.` + c.reset);
}

/* ═══════════════════════════════════════════════════════════════════════
   HÜBSCHER REPORT-BAUKASTEN
   ═══════════════════════════════════════════════════════════════════════ */

function siteBlock(res) {
  const out = [];
  const ok = res.okProbes.length > 0;
  out.push(ok ? `▫️ *${res.host}* ✅` : `▫️ *${res.host}* ❌`);

  if (!ok) {
    const err = res.probes?.[0]?.error || 'unbekannter Fehler';
    out.push(`   • Grund   › ${err}`);
    if (res.dns.ok) out.push(`   • DNS     › ${res.dns.address} (${fmtMsFine(res.dns.ms)})`);
    else out.push(`   • DNS     › nicht messbar _(${res.dns.error})_`);
    if (res.icmp.ok) out.push(`   • ICMP    › ${fmtMsFine(res.icmp.avg)}`);
    else out.push(`   • ICMP    › nicht messbar _(${res.icmp.error})_`);
    return out;
  }

  const last = res.okProbes[res.okProbes.length - 1];
  const st = (keyOf) => statsOf(res.okProbes.map(keyOf));
  const dnsS = st((p) => p.dnsMs);
  const tcpS = st((p) => p.tcpMs);
  const tlsS = st((p) => (p.tlsMs != null && p.tcpMs != null ? p.tlsMs - p.tcpMs : null));
  const ttfbS = st((p) => p.ttfbMs);
  const totS = st((p) => p.totalMs);

  out.push(`   • Status › ${last.status} ${(last.statusText || '').slice(0, 18)} · ${last.httpVersion || 'HTTP'} · ${last.server || '—'}`);
  out.push(`   • DNS ${dnsS ? fmtMsFine(dnsS.avg) : '—'} · TCP ${tcpS ? fmtMsFine(tcpS.avg) : '—'} · TLS ${tlsS ? fmtMsFine(tlsS.avg) : '—'}  _(Ø)_`);
  out.push(`   • TTFB ${ttfbS ? fmtMs(ttfbS.avg) : '—'} · Gesamt ${totS ? fmtMs(totS.avg) : '—'}  _(3 Läufe)_`);
  out.push(`   • ICMP ${res.icmp.ok ? `${fmtMsFine(res.icmp.avg)} (min ${res.icmp.min} / max ${res.icmp.max} · ${res.icmp.lossPct}% Verlust)` : `nicht messbar _(${res.icmp.error})_`}`);
  return out;
}

/* ═══════════════════════════════════════════════════════════════════════
   HAUPT-PING
   ═══════════════════════════════════════════════════════════════════════ */

const ICMP_TARGETS = ['1.1.1.1', '8.8.8.8', 'web.whatsapp.net'];

export async function handlePingCommand({ sock, msg, from, args = [], pref = '$' }) {
  const flags = args.map((a) => String(a).toLowerCase());
  const target = args.find((a) => !FLAGS.has(String(a).toLowerCase()) && looksLikeHost(a));
  if (target) return websitePing(sock, from, msg, target);

  const wantFull = flags.includes('full') || flags.includes('speed');
  const wantNoSpeed = flags.includes('nospeed') || flags.includes('kurz') || flags.includes('schnell');

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

  /* ── Bot ↔ WhatsApp (WebSocket / IQ / Sende-Roundtrip) ─────────── */
  const wsSamples = await sample(() => wsPing(sock, 4000), 3, 120);
  const wsOk = wsSamples.filter((s) => s.ok);
  const wsStats = statsOf(wsOk.map((s) => s.ms));

  const iqSamples = await sample(() => iqPing(sock, 6000), 3, 120);
  const iqOk = iqSamples.filter((s) => s.ok);
  const iqStats = statsOf(iqOk.map((s) => s.ms));

  const echo = await sendEchoPing(sock, { timeoutMs: 8000 });

  /* ── Netzwerk: ICMP (parallel) ─────────────────────────────────── */
  const icmpResults = await Promise.all(ICMP_TARGETS.map((h) => icmpPing(h, { count: 3, timeoutMs: 9000 })));

  /* ── WEBSITES: maxichen.de + maxichen.gamebot.me (parallel) ────── */
  const siteResults = await Promise.all(DEFAULT_SITES.map((h) => probeSite(h)));

  /* ── Verbindung: DNS · TCP · TLS · TTFB gegen cloudflare.com ───── */
  const probeHost = 'cloudflare.com';
  const [dnsRes, tcpRes, httpRes, edge] = await Promise.all([
    dnsPing(probeHost),
    tcpPing(probeHost, 443, 5000),
    httpProbe('https://cloudflare.com/cdn-cgi/trace', { timeoutMs: 12000 }),
    edgeTrace()
  ]);

  /* ── Speed (nur wenn gewünscht) ────────────────────────────────── */
  let speed = null;
  if (!wantNoSpeed) {
    speed = wantFull
      ? await speedTest({ downBytes: 8 * 1024 * 1024, upBytes: 4 * 1024 * 1024, maxDownBytes: 32 * 1024 * 1024, maxUpBytes: 16 * 1024 * 1024, timeoutMs: 45000 })
      : await speedTest({ downBytes: 3 * 1024 * 1024, upBytes: 1024 * 1024, timeoutMs: 20000 });
  }

  /* ── System & Datenbank ────────────────────────────────────────── */
  const sys = sysSnapshot();
  let dbLine = '';
  try {
    const st = systemStats(readDb(), sys.uptimeMs);
    dbLine = `• DB: ${st.totalUsers} Nutzer · ${st.totalGroups} Gruppen · ${st.totalBans} Bans`;
  } catch (e) {
    dbLine = '• DB: nicht lesbar';
  }

  /* ── Report bauen (schöner Aufbau) ─────────────────────────────── */
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const dateStr = `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()}`;
  const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  let sec = 0;
  const section = (emoji, title, hint = '') => {
    sec++;
    L.push(hint ? `*${sec} · ${title}* ${emoji}  _(${hint})_` : `*${sec} · ${title}* ${emoji}`);
  };
  const L = [];
  L.push(`🏓 *PING-REPORT*  ·  *LOVE BOT* 💜`);
  L.push(`📅 ${dateStr} · ${timeStr} Uhr`);
  L.push('');

  section('🤖', 'BOT ↔ WHATSAPP');
  L.push(wsStats
    ? `   • WS-Ping    › ${fmtMs(wsStats.last)}  _(${fmtRange(wsStats)} ms · ${wsOk.length}/${wsSamples.length} OK)_`
    : `   • WS-Ping    › nicht messbar _(${wsSamples[0]?.error || '—'})_`);
  L.push(iqStats
    ? `   • IQ-Ping    › ${fmtMs(iqStats.last)}  _(${fmtRange(iqStats)} ms · ${iqOk.length}/${iqSamples.length} OK)_`
    : `   • IQ-Ping    › nicht messbar _(${iqSamples[0]?.error || '—'})_`);
  L.push(echo.ok
    ? `   • Sende-RTT  › ${fmtMs(echo.echoMs)}  _(Server-Echo · Senden ${fmtMs(echo.sendMs)})_`
    : `   • Sende-RTT  › nicht messbar _(${echo.error || '—'})_`);
  if (msgAge != null) L.push(`   • Nachricht→Bot › ${fmtMs(msgAge)}  _(Server-Zeitstempel)_`);
  L.push('');

  /* 2 · Websites */
  section('🌍', 'WEBSITES', DEFAULT_SITES.join(' + '));
  for (const res of siteResults) {
    L.push(...siteBlock(res));
  }
  L.push('');

  /* 3 · Netzwerk (ICMP) */
  section('🌐', 'NETZWERK');
  for (const r of icmpResults) {
    L.push(r.ok
      ? `   • ${r.host.padEnd(15)} › ${fmtMsFine(r.avg).padEnd(9)}  _(min ${r.min} / max ${r.max} · ${r.lossPct}% Verlust)_`
      : `   • ${r.host.padEnd(15)} › nicht messbar _(${r.error})_`);
  }
  L.push('');

  /* 4 · Verbindung (Referenz) */
  section('🔌', 'VERBINDUNG', probeHost);
  if (httpRes.ok) {
    const tlsHandshake = httpRes.tlsMs != null && httpRes.tcpMs != null ? httpRes.tlsMs - httpRes.tcpMs : null;
    const tlsLine = tlsHandshake != null ? fmtMsFine(tlsHandshake) : '—';
    L.push(`   • DNS ${dnsRes.ok ? fmtMsFine(dnsRes.ms) : '—'} · TCP ${fmtMsFine(httpRes.tcpMs)} · TLS ${tlsLine} · TTFB ${fmtMs(httpRes.ttfbMs)}`);
    L.push(`   • Gesamt ${fmtMs(httpRes.totalMs)} · ${httpRes.status} · HTTP ${httpRes.httpVersion}`);
  } else {
    L.push(`   • HTTP nicht messbar _(${httpRes.error})_`);
    L.push(dnsRes.ok
      ? `   • DNS ${fmtMsFine(dnsRes.ms)} _(${dnsRes.address})_`
      : `   • DNS nicht messbar _(${dnsRes.error})_`);
  }
  L.push('');

  /* 5 · Edge / Server-Netz */
  section('🛰️', 'SERVER-NETZ');
  L.push(edge.ok
    ? `   • Öffentliche IP › ${edge.ip || '—'}  ${edge.loc ? `(${edge.loc}${edge.colo ? ` · ${edge.colo}` : ''})` : ''}`
    : `   • Öffentliche IP › nicht messbar _(${edge.error})_`);
  if (edge.ok && (edge.tls || edge.http)) L.push(`   • Protokoll › ${edge.tls || '—'} · ${edge.http || '—'}`);
  const localIp = sys.localIps[0];
  L.push(localIp ? `   • Lokale IP › ${localIp.address}  _(${localIp.iface})_` : '   • Lokale IP › nicht ermittelbar');
  L.push('');

  /* 6 · Speed */
  if (speed) {
    section('⚡', 'SPEED', 'gemessen, speed.cloudflare.com');
    L.push(speed.down
      ? `   • ↓ Download › ${fmtMbps(speed.down.mbps)}  _(${fmtBytes(speed.down.bytes)} in ${(speed.down.ms / 1000).toFixed(2)}s)_`
      : `   • ↓ Download › nicht messbar _(${speed.downError || '—'})_`);
    L.push(speed.up
      ? `   • ↑ Upload   › ${fmtMbps(speed.up.mbps)}  _(${fmtBytes(speed.up.bytes)} in ${(speed.up.ms / 1000).toFixed(2)}s)_`
      : `   • ↑ Upload   › nicht messbar _(${speed.upError || '—'})_`);
    L.push('');
  }

  /* 7 · System */
  section('💻', 'SYSTEM');
  L.push(`   • Uptime › ${formatDuration(sys.uptimeMs)}`);
  L.push(`   • RAM    › ${fmtBytes(sys.rssBytes)}  _(Heap ${fmtBytes(sys.heapUsedBytes)} / ${fmtBytes(sys.heapTotalBytes)})_`);
  L.push(`   • CPU    › Load ${sys.load1}  _(${sys.cpuCount} Kerne)_`);
  L.push(`   • Node   › ${sys.nodeVersion} · ${sys.platform} ${sys.arch}`);
  L.push(dbLine);
  L.push('');
  L.push(`💡 _Tipp: ${pref}ping full = großer Speedtest · ${pref}ping <url> = eine Website prüfen · ${pref}ping nospeed = ohne Speedtest_`);
  L.push(`💡 _Alles live gemessen — ${pref}ping prüft ${DEFAULT_SITES.join(' & ')} immer mit._`);

  await put(sock, from, msg, key, L.join('\n'));
  await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
  console.log(c.bold + c.brightGreen +
    `[ping] Report gesendet (WS ${wsStats ? Math.round(wsStats.avg) : '—'} ms · IQ ${iqStats ? Math.round(iqStats.avg) : '—'} ms · RTT ${echo.ok ? Math.round(echo.echoMs) : '—'} ms).` +
    c.reset);
}

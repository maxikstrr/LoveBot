/* ═══════════════════════════════════════════════════════════════════════
   🌐 L O V E B O T   N E T Z W E R K - M E S S U N G E N   (netping.js)
   ─────────────────────────────────────────────────────────────────────
   ALLES in dieser Datei ist ECHT gemessen — keine Zufallswerte, keine
   geschätzten Platzhalter, keine „≈“-Werte.

   Grundregel: Wenn etwas nicht messbar ist (ICMP blockiert, WS ohne
   ping(), Cloudflare nicht erreichbar …), kommt { ok:false, error:'…' }
   zurück. Die Anzeige schreibt dann „nicht messbar“ — und NICHTS anderes.

   Enthalten:
     · icmpPing()      — echter ICMP-Ping über das System-ping (Loss/min/avg/max)
     · tcpPing()       — TCP-Connect-Zeit (3-Way-Handshake)
     · dnsPing()       — DNS-Auflösungszeit
     · httpProbe()     — DNS · TCP · TLS · TTFB · Gesamt · Status · HTTP-Version
     · wsPing()        — WebSocket Ping/Pong gegen den WhatsApp-Socket
     · iqPing()        — WhatsApp-IQ-Ping (wie der Baileys-Keepalive)
     · sendEchoPing()  — Bot → WhatsApp-Server → Bot (echter Roundtrip)
     · speedTest()     — Down-/Upload gegen speed.cloudflare.com (gemessen)
     · edgeTrace()     — öffentliche IP, Cloudflare-Colo, Land, TLS/HTTP
     · sysSnapshot()   — Uptime, RAM, Heap, Load, Node, Plattform (echt)
   ═══════════════════════════════════════════════════════════════════════ */

import net from 'node:net';
import dns from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import os from 'node:os';
import v8 from 'node:v8';
import { performance } from 'node:perf_hooks';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/* WhatsApp-eigener Server-JID für den IQ-Ping (Baileys-Konstante) */
const S_WHATSAPP_NET = 's.whatsapp.net';

/* ─────────────────────────────────────────────────────────────────────
   Hilfsfunktionen
   ───────────────────────────────────────────────────────────────────── */

const now = () => performance.now();
const r2 = (n) => Math.round(Number(n) * 100) / 100;

function withTimeout(promise, ms, label = 'Timeout') {
  let t = null;
  return Promise.race([
    Promise.resolve(promise).then((v) => { if (t) clearTimeout(t); return v; },
      (e) => { if (t) clearTimeout(t); throw e; }),
    new Promise((_, reject) => { t = setTimeout(() => reject(new Error(label)), ms); })
  ]);
}

export function statsOf(values) {
  const arr = values.filter((v) => typeof v === 'number' && isFinite(v));
  if (!arr.length) return null;
  const min = Math.min(...arr);
  const max = Math.max(...arr);
  const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
  const jitter = arr.length > 1
    ? arr.slice(1).reduce((a, v, i) => a + Math.abs(v - arr[i]), 0) / (arr.length - 1)
    : 0;
  return { n: arr.length, min: r2(min), max: r2(max), avg: r2(avg), jitter: r2(jitter), last: r2(arr[arr.length - 1]) };
}

/* Mehrere Messungen hintereinander (mit kleinem Abstand) */
export async function sample(fn, times = 3, gapMs = 120) {
  const out = [];
  for (let i = 0; i < times; i++) {
    out.push(await fn(i));
    if (i < times - 1) await new Promise((r) => setTimeout(r, gapMs));
  }
  return out;
}

/* ─────────────────────────────────────────────────────────────────────
   1) ICMP — echter Ping über das Betriebssystem
   ───────────────────────────────────────────────────────────────────── */

function parseIcmp(text, host) {
  const t = String(text || '');
  let sent = null, received = null, lossPct = null, min = null, avg = null, max = null, mdev = null;

  /* Linux/macOS: „3 packets transmitted, 3 received, 0% packet loss, time 2003ms“ */
  let m = t.match(/(\d+)\s+packets transmitted,\s*(\d+)(?:\s+packets)?\s+received,?\s*(?:\+[\d.]+\s+errors,?)?\s*(?:([\d.]+)%\s+packet loss)?/);
  if (m) {
    sent = Number(m[1]); received = Number(m[2]);
    lossPct = m[3] != null ? Number(m[3]) : (sent ? ((sent - received) / sent) * 100 : null);
  } else {
    /* Windows: „Packets: Sent = 3, Received = 3, Lost = 0 (0% loss)“ */
    m = t.match(/Packets:\s*Sent\s*=\s*(\d+),\s*Received\s*=\s*(\d+),\s*Lost\s*=\s*(\d+)/i);
    if (m) {
      sent = Number(m[1]); received = Number(m[2]);
      lossPct = sent ? (Number(m[3]) / sent) * 100 : null;
    }
  }

  /* Linux: „rtt min/avg/max/mdev = 12.345/13.001/13.7/0.5 ms“ */
  m = t.match(/min\/avg\/max\/(?:mdev|stddev)\s*=\s*([\d.]+)\/([\d.]+)\/([\d.]+)\/([\d.]+)/);
  if (m) { min = Number(m[1]); avg = Number(m[2]); max = Number(m[3]); mdev = Number(m[4]); }
  else {
    /* macOS: „round-trip min/avg/max/stddev = 12.1/13.0/14.0/0.6 ms“ */
    m = t.match(/min\/avg\/max\/stddev\s*=\s*([\d.]+)\/([\d.]+)\/([\d.]+)\/([\d.]+)/);
    if (m) { min = Number(m[1]); avg = Number(m[2]); max = Number(m[3]); mdev = Number(m[4]); }
    else {
      /* Windows: „Minimum = 12ms, Maximum = 14ms, Average = 13ms“ */
      m = t.match(/Minimum\s*=\s*(\d+)ms,\s*Maximum\s*=\s*(\d+)ms,\s*Average\s*=\s*(\d+)ms/i);
      if (m) { min = Number(m[1]); max = Number(m[2]); avg = Number(m[3]); }
    }
  }

  /* Fallback: einzelne „time=12.3 ms“ Zeilen auswerten */
  if (avg == null) {
    const times = [...t.matchAll(/(?:time|time<|zeit)[=<]\s*([\d.]+)\s*ms/gi)].map((x) => Number(x[1])).filter((n) => isFinite(n));
    if (times.length) {
      min = Math.min(...times); max = Math.max(...times);
      avg = times.reduce((a, b) => a + b, 0) / times.length;
      if (received == null) received = times.length;
    }
  }

  if (avg == null) return { ok: false, host, error: 'keine Antwort (ICMP blockiert?)' };
  return { ok: true, host, sent, received, lossPct: lossPct == null ? null : r2(lossPct), min: r2(min), avg: r2(avg), max: r2(max), mdev: mdev == null ? null : r2(mdev) };
}

export async function icmpPing(host, { count = 3, timeoutMs = 9000 } = {}) {
  const plat = process.platform;
  const args = plat === 'win32'
    ? ['-n', String(count), '-w', '2000', host]
    : plat === 'darwin'
      ? ['-c', String(count), '-W', '5000', host]   /* macOS: Millisekunden */
      : ['-c', String(count), '-W', '5', host];     /* Linux: Sekunden      */
  try {
    const { stdout } = await execFileAsync('ping', args, { timeout: timeoutMs, windowsHide: true });
    return parseIcmp(stdout, host);
  } catch (e) {
    /* ping endet bei Paketverlust mit Exit-Code > 0 — Output trotzdem verwerten */
    const out = String(e?.stdout || '');
    if (out) {
      const p = parseIcmp(out, host);
      if (p.ok) return p;
    }
    /* Fehlerursache ehrlich benennen statt sie zu verschweigen */
    const errText = String(e?.stderr || '') || String(e?.stdout || '') || String(e?.message || e);
    const first = errText.split('\n').map((l) => l.trim()).filter(Boolean)[0] || String(e?.message || e);
    if (/operation not permitted|cap_net_raw|permission denied|socket:/i.test(errText)) {
      return { ok: false, host, error: 'keine ICMP-Rechte (cap_net_raw / Admin nötig)' };
    }
    if (/ENOENT|not found/i.test(errText)) {
      return { ok: false, host, error: 'ping-Befehl nicht gefunden' };
    }
    if (/unknown host|Name or service not known|could not find host/i.test(errText)) {
      return { ok: false, host, error: 'Host nicht auflösbar' };
    }
    return { ok: false, host, error: first.slice(0, 80) };
  }
}

/* ─────────────────────────────────────────────────────────────────────
   2) TCP-Connect (3-Way-Handshake)
   ───────────────────────────────────────────────────────────────────── */

export function tcpPing(host, port = 443, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const t0 = now();
    let done = false;
    const sock = net.connect({ host, port, family: 0 });
    const finish = (res) => {
      if (done) return;
      done = true;
      clearTimeout(to);
      try { sock.destroy(); } catch (e) {}
      resolve(res);
    };
    const to = setTimeout(() => finish({ ok: false, host, port, error: 'Timeout' }), timeoutMs);
    sock.once('connect', () => finish({ ok: true, host, port, ms: r2(now() - t0) }));
    sock.once('error', (e) => finish({ ok: false, host, port, error: String(e?.code || e?.message || e) }));
  });
}

/* ─────────────────────────────────────────────────────────────────────
   3) DNS-Auflösung
   ───────────────────────────────────────────────────────────────────── */

export async function dnsPing(hostname, timeoutMs = 5000) {
  const t0 = now();
  try {
    const res = await withTimeout(dns.promises.lookup(hostname, { all: false }), timeoutMs, 'DNS Timeout');
    return { ok: true, hostname, ms: r2(now() - t0), address: res?.address, family: res?.family };
  } catch (e) {
    return { ok: false, hostname, error: String(e?.message || e) };
  }
}

/* ─────────────────────────────────────────────────────────────────────
   4) HTTP-Probe — DNS · TCP · TLS · TTFB · Gesamt · Status · Version
   ───────────────────────────────────────────────────────────────────── */

export function httpProbe(urlStr, { method = 'GET', timeoutMs = 12000, maxBytes = 3 * 1024 * 1024, headers = {} } = {}) {
  return new Promise((resolve) => {
    let u;
    try { u = new URL(urlStr); } catch (e) { return resolve({ ok: false, url: urlStr, error: 'ungültige URL' }); }
    const isTls = u.protocol === 'https:';
    const mod = isTls ? https : http;
    const port = Number(u.port) || (isTls ? 443 : 80);

    const t0 = now();
    let dnsMs = null, tcpMs = null, tlsMs = null, ttfbMs = null, address = null;
    let settled = false;

    const done = (res) => { if (settled) return; settled = true; clearTimeout(to); resolve(res); };
    const to = setTimeout(() => { try { req.destroy(); } catch (e) {} done({ ok: false, url: urlStr, error: 'Timeout' }); }, timeoutMs);

    const req = mod.request({
      protocol: u.protocol,
      hostname: u.hostname,
      port,
      path: (u.pathname || '/') + (u.search || ''),
      method,
      headers: { 'user-agent': 'LoveBot/1.0 (+ping)', accept: '*/*', ...headers },
      agent: new mod.Agent({ keepAlive: false }),
      /* DNS-Zeit separat messen */
      lookup(hostname, options, callback) {
        const s = now();
        dns.lookup(hostname, options, (err, addr, family) => {
          dnsMs = r2(now() - s);
          if (!err) address = Array.isArray(addr) ? (addr[0]?.address || null) : addr;
          callback(err, addr, family);
        });
      }
    }, (res) => {
      ttfbMs = r2(now() - t0);
      const chunks = [];
      let size = 0;
      res.on('data', (c) => {
        size += c.length;
        if (size <= maxBytes) chunks.push(c);
      });
      res.on('end', () => done({
        ok: true,
        url: urlStr,
        host: u.hostname,
        address,
        status: res.statusCode,
        statusText: res.statusMessage || '',
        httpVersion: res.httpVersion || '',
        dnsMs, tcpMs, tlsMs, ttfbMs,
        totalMs: r2(now() - t0),
        bytes: size,
        server: res.headers?.server || '',
        contentType: res.headers?.['content-type'] || '',
        location: res.headers?.location || ''
      }));
      res.on('error', (e) => done({ ok: false, url: urlStr, error: String(e?.message || e) }));
      /* Bei HEAD/Redirect nicht ewig auf den Body warten */
      if (method === 'HEAD') { try { res.resume(); } catch (e) {} }
    });

    req.on('socket', (socket) => {
      if (socket.connecting) {
        socket.once('connect', () => { tcpMs = r2(now() - t0); });
        if (isTls) socket.once('secureConnect', () => { tlsMs = r2(now() - t0); });
      } else {
        tcpMs = r2(now() - t0);
        if (isTls && socket.authorized !== undefined) tlsMs = tcpMs;
      }
    });
    req.on('error', (e) => done({ ok: false, url: urlStr, error: String(e?.code || e?.message || e) }));
    req.setTimeout(timeoutMs, () => { try { req.destroy(new Error('Timeout')); } catch (e) {} });
    try { req.end(); } catch (e) { done({ ok: false, url: urlStr, error: String(e?.message || e) }); }
  });
}

/* ─────────────────────────────────────────────────────────────────────
   5) WebSocket-Ping gegen den WhatsApp-Socket (Ping/Pong-Frames)
   ───────────────────────────────────────────────────────────────────── */

export function wsPing(sock, timeoutMs = 5000) {
  const ws = sock?.ws;
  if (!ws) return Promise.resolve({ ok: false, error: 'kein WebSocket-Handle' });
  if (typeof ws.ping !== 'function') return Promise.resolve({ ok: false, error: 'WS ohne ping()' });
  if (ws.readyState !== 1) return Promise.resolve({ ok: false, error: 'WS nicht offen (readyState ' + ws.readyState + ')' });

  return new Promise((resolve) => {
    const t0 = now();
    let settled = false;
    const cleanup = () => { try { ws.removeListener('pong', onPong); } catch (e) {} };
    const finish = (res) => { if (settled) return; settled = true; clearTimeout(to); cleanup(); resolve(res); };
    const to = setTimeout(() => finish({ ok: false, error: 'Timeout (kein Pong)' }), timeoutMs);
    function onPong() { finish({ ok: true, ms: r2(now() - t0) }); }
    try {
      ws.on('pong', onPong);
      ws.ping();
    } catch (e) {
      finish({ ok: false, error: String(e?.message || e) });
    }
  });
}

/* ─────────────────────────────────────────────────────────────────────
   6) WhatsApp-IQ-Ping (genau der Keepalive, den Baileys selbst schickt)
   ───────────────────────────────────────────────────────────────────── */

export async function iqPing(sock, timeoutMs = 8000) {
  if (!sock || typeof sock.query !== 'function') return { ok: false, error: 'sock.query nicht verfügbar' };
  const iq = {
    tag: 'iq',
    attrs: { to: S_WHATSAPP_NET, type: 'get', xmlns: 'w:p' },
    content: [{ tag: 'ping', attrs: {} }]
  };
  const t0 = now();
  try {
    await withTimeout(sock.query(iq), timeoutMs, 'IQ Timeout');
    return { ok: true, ms: r2(now() - t0) };
  } catch (e) {
    return { ok: false, error: String(e?.message || e).slice(0, 80) };
  }
}

/* ─────────────────────────────────────────────────────────────────────
   7) Sende-Roundtrip: Bot → WhatsApp-Server → Bot (Echo der eigenen
      Nachricht). Die Testnachricht geht an den EIGENEN Chat und wird
      danach gelöscht — kein Spam im Gruppenchat.
   ───────────────────────────────────────────────────────────────────── */

export async function sendEchoPing(sock, { timeoutMs = 10000 } = {}) {
  if (!sock || typeof sock.sendMessage !== 'function') return { ok: false, error: 'sock.sendMessage fehlt' };
  const selfJid = sock.user?.id || sock.authState?.creds?.me?.id || '';
  if (!selfJid) return { ok: false, error: 'eigene JID unbekannt' };

  const t0 = now();
  let sent;
  try {
    sent = await sock.sendMessage(selfJid, { text: '🏓' });
  } catch (e) {
    return { ok: false, error: 'Senden fehlgeschlagen: ' + String(e?.message || e).slice(0, 60) };
  }
  const sendMs = r2(now() - t0);
  const key = sent?.key || null;

  const echoMs = await new Promise((resolve) => {
    if (!key?.id || typeof sock.ev?.on !== 'function') return resolve(null);
    let settled = false;
    const off = () => { clearTimeout(to); try { sock.ev.off('messages.upsert', handler); } catch (e) { try { sock.ev.removeListener('messages.upsert', handler); } catch (e2) {} } };
    const to = setTimeout(() => { if (settled) return; settled = true; off(); resolve(null); }, timeoutMs);
    function handler({ messages = [] }) {
      for (const m of messages) {
        if (m?.key?.id === key.id) { if (settled) return; settled = true; off(); resolve(r2(now() - t0)); return; }
      }
    }
    try { sock.ev.on('messages.upsert', handler); } catch (e) { clearTimeout(to); resolve(null); }
  });

  /* Testnachricht aufräumen */
  try { if (key) await sock.sendMessage(selfJid, { delete: key }); } catch (e) {}

  return {
    ok: echoMs != null,
    sendMs,
    echoMs,
    error: echoMs == null ? 'Echo nicht empfangen' : null
  };
}

/* ─────────────────────────────────────────────────────────────────────
   8) Speedtest gegen speed.cloudflare.com (echt herunter-/hochgeladen)
   ───────────────────────────────────────────────────────────────────── */

async function downloadSample(bytes, timeoutMs) {
  const res = await fetch(`https://speed.cloudflare.com/__down?bytes=${bytes}`, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok || !res.body) throw new Error('HTTP ' + res.status);
  const started = Date.now();
  const reader = res.body.getReader();
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value ? value.byteLength : 0;
    if (received >= bytes) { try { await reader.cancel(); } catch (e) {} break; }
  }
  const ms = Math.max(1, Date.now() - started);
  return { bytes: received, ms, mbps: r2((received * 8) / (ms / 1000) / 1e6) };
}

async function uploadSample(bytes, timeoutMs) {
  const body = Buffer.alloc(bytes, 97);
  const started = Date.now();
  const res = await fetch('https://speed.cloudflare.com/__up', {
    method: 'POST', body, signal: AbortSignal.timeout(timeoutMs)
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const ms = Math.max(1, Date.now() - started);
  return { bytes, ms, mbps: r2((bytes * 8) / (ms / 1000) / 1e6) };
}

/* Echte Messung — mit Nachfassen, wenn der Test zu schnell war:
   Läuft ein Sample unter ~400 ms, ist das Ergebnis stark von der
   Anlaufzeit (TCP/TLS) verfälscht → dann mit 4× Datenvolumen neu. */
export async function speedTest({
  downBytes = 3 * 1024 * 1024,
  upBytes = 1024 * 1024,
  timeoutMs = 25000,
  maxDownBytes = 12 * 1024 * 1024,
  maxUpBytes = 8 * 1024 * 1024,
  minMs = 350,
  factor = 3
} = {}) {
  const out = { down: null, up: null, downRuns: 0, upRuns: 0 };

  /* Download: solange vergrößern, bis die Messung lang genug dauerte
     (kurze Messungen sind von TCP-Slow-Start verfälscht). */
  let size = downBytes;
  for (let i = 0; i < 4; i++) {
    try {
      const s = await downloadSample(size, timeoutMs);
      out.down = s;
      out.downRuns++;
      if (s.ms >= minMs || size >= maxDownBytes) break;
      size = Math.min(maxDownBytes, size * factor);
    } catch (e) {
      /* Größere Anfrage abgelehnt (z. B. HTTP 403) → letzter gültiger Wert bleibt */
      out.downError = String(e?.message || e).slice(0, 60);
      break;
    }
  }

  let usize = upBytes;
  for (let i = 0; i < 4; i++) {
    try {
      const s = await uploadSample(usize, timeoutMs);
      out.up = s;
      out.upRuns++;
      if (s.ms >= minMs || usize >= maxUpBytes) break;
      usize = Math.min(maxUpBytes, usize * factor);
    } catch (e) {
      out.upError = String(e?.message || e).slice(0, 60);
      break;
    }
  }

  out.ok = !!(out.down || out.up);
  return out;
}

/* ─────────────────────────────────────────────────────────────────────
   9) Edge-Trace — echte öffentliche IP, Cloudflare-Colo, Land, TLS/HTTP
   ───────────────────────────────────────────────────────────────────── */

export async function edgeTrace(timeoutMs = 8000) {
  try {
    const res = await fetch('https://cloudflare.com/cdn-cgi/trace', { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const text = await res.text();
    const data = {};
    for (const line of text.split('\n')) {
      const idx = line.indexOf('=');
      if (idx > 0) data[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    }
    return { ok: true, ip: data.ip || null, colo: data.colo || null, loc: data.loc || null, tls: data.tls || null, http: data.http || null, warp: data.warp || null };
  } catch (e) {
    return { ok: false, error: String(e?.message || e).slice(0, 60) };
  }
}

/* ─────────────────────────────────────────────────────────────────────
   10) System-Snapshot (echte Prozess-/OS-Werte)
   ───────────────────────────────────────────────────────────────────── */

export function sysSnapshot() {
  const mem = process.memoryUsage();
  const heap = v8.getHeapStatistics();
  const load = os.loadavg ? os.loadavg() : [0, 0, 0];
  const cpus = os.cpus() || [];
  const nets = os.networkInterfaces();
  const localIps = [];
  for (const [name, list] of Object.entries(nets || {})) {
    for (const n of list || []) {
      if (n && n.family === 'IPv4' && !n.internal) localIps.push({ iface: name, address: n.address });
    }
  }
  return {
    uptimeMs: Math.round(process.uptime() * 1000),
    rssBytes: mem.rss,
    heapUsedBytes: mem.heapUsed,
    heapTotalBytes: heap.total_heap_size,
    heapLimitBytes: heap.heap_size_limit,
    load1: r2(load[0] || 0),
    cpuCount: cpus.length,
    cpuModel: cpus[0]?.model ? String(cpus[0].model).trim() : '',
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    osRelease: os.release(),
    localIps
  };
}

/* ═══════════════════════════════════════════════════════════════════
   💜 LoveBot — RUNTIME HEALTH (health.js)

   REAL DATA ONLY: Jede Zahl hier ist gemessen oder aus echten Dateien/Stores
   abgeleitet. Was nicht messbar ist → null (Frontend zeigt „–“).
   Keine Schätzungen, kein Math.random, keine Demo-Werte.

   Quellen:
   · System  → process + node:os (CPU per Sampling, ~120 ms, Windows-fähig)
   · DB      → Database/*.json (fs.stat + gezählte Keys)
   · Version → package.json (einzige Stelle)
   Nutzt server.js für /api/health + /api/system; testbar ohne Server.
   ═══════════════════════════════════════════════════════════════════ */
import fs from 'fs';
import os from 'os';
import path from 'path';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function cpuSnapshot() {
  try {
    const cpus = os.cpus() || [];
    if (!cpus.length) return null;
    let idle = 0, total = 0;
    for (const c of cpus) {
      const t = c.times || {};
      idle += Number(t.idle) || 0;
      total += (Number(t.user) || 0) + (Number(t.nice) || 0) + (Number(t.sys) || 0) + (Number(t.irq) || 0) + (Number(t.idle) || 0);
    }
    return { idle, total, cores: cpus.length };
  } catch (e) { return null; }
}

/* Echte CPU-Auslastung in % (Windows-fähig — loadavg ist dort immer 0). */
export async function sampleCpuPct(sampleMs = 120) {
  try {
    const a = cpuSnapshot();
    if (!a) return null;
    await sleep(Math.max(50, Math.min(1000, sampleMs)));
    const b = cpuSnapshot();
    if (!b) return null;
    const dIdle = b.idle - a.idle;
    const dTotal = b.total - a.total;
    if (dTotal <= 0) return null;
    return Number((Math.max(0, Math.min(100, (1 - dIdle / dTotal) * 100))).toFixed(1));
  } catch (e) { return null; }
}

export async function collectSystem() {
  const mem = process.memoryUsage();
  let totalMb = null;
  try { totalMb = Math.round(os.totalmem() / 1048576); } catch (e) {}
  return {
    node: process.version || null,
    platform: process.platform || null,
    arch: process.arch || null,
    uptimeSec: Math.max(0, Math.round(process.uptime())),
    pid: process.pid || null,
    cores: (os.cpus() || []).length || null,
    ramMb: Number((mem.rss / 1048576).toFixed(1)),
    ramTotalMb: totalMb,
    heapMb: Number((mem.heapUsed / 1048576).toFixed(1)),
    heapTotalMb: Number((mem.heapTotal / 1048576).toFixed(1)),
    cpu: await sampleCpuPct(),
    source: 'process+os'
  };
}

/* Zählt echte Keys aus dem geladenen DB-Objekt (kein File-IO hier). */
export function collectDbCounts(db = {}) {
  const users = db && typeof db.users === 'object' ? Object.keys(db.users).length : null;
  const groups = db && typeof db.groups === 'object' ? Object.keys(db.groups).length : null;
  return { users, groups, source: 'Database/Database.json' };
}

/* Datei-Info oder null (nie erfinden). */
export function statStore(relPath) {
  try {
    const st = fs.statSync(path.join('Database', relPath));
    return { name: relPath, sizeKb: Math.max(1, Math.round(st.size / 1024)), mtime: st.mtime.toISOString() };
  } catch (e) { return null; }
}

/* Paket-Version — einzige Quelle (kein Hardcode an 5 Stellen). */
export function readPackageVersion() {
  try {
    const pkg = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
    return (pkg && pkg.version) ? String(pkg.version) : null;
  } catch (e) { return null; }
}

/* Zahlen-Helfer fürs Frontend-Format (de-DE), null-sicher. */
export function fmtInt(n) {
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return null;
  return Number(n).toLocaleString('de-DE');
}

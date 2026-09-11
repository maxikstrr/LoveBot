/* ═══════════════════════════════════════════════════════════════════════
   💜  L O V E B O T   L O V E C O R E   E N G I N E  (loveengine.js)
   ─────────────────────────────────────────────────────────────────────
   Das zentrale Nervensystem (Fundament der Plattform-Architektur):

   1. EVENTBUS
      • In-memory Ring-Buffer (500 Events) für Live-Feeds (SSE /api/live)
      • Persistenz: Database/events.jsonl (max. 5.000 Zeilen, dann Rotation)
      • Fire-and-forget: emit() darf NIEMALS werfen oder blockieren —
        kein Event-Problem darf Bot/Server brechen.

      Event-Typen (stabile IDs — API & Website hängen daran):
        XP_GRANTED · LEVEL_UP · PRESTIGE_UP · COINS_EARNED
        GAME_WIN · GAME_LOSS · ACHIEVEMENT_UNLOCKED
        XP_ADJUSTED (Owner) · USER_BANNED · LOGIN_FAILED
        MILESTONE_REACHED · GOAL_COMPLETED · BADGE_UNLOCKED ·
        TITLE_EARNED · STREAK_MILESTONE · RANK_CHANGED (Progression 4.0/5.0)
        MAINTENANCE_ON · MAINTENANCE_OFF · SESSION_EVENT

   2. XP-STATS (für Owner-Center & Live-Dashboard)
      • Aggregation aus Event-Fenster + Profil-Scan (Lifetime, Quellen)

   3. LEVEL-TABELLE (für Owner: Kurve einsehen, nicht hartcodiert)
      • Bausteine aus levelsystem.js (gleiche Formel = gleiche Wahrheit)
   ══════════════════════════════════════════════════════════════════════ */

import fs from 'node:fs';
import path from 'node:path';
import { neededXp, rankFor, PROGRESSION } from './levelsystem.js';

const EVENTS_FILE = path.join('Database', 'events.jsonl');
const RING_SIZE = 500;
const FILE_MAX_LINES = 5000;

const ring = []; /* neueste Events (in-memory) */

/* ─────────────────────────────────────────────────────────────────────
   Persistenz (robust, nie werfend)
   ───────────────────────────────────────────────────────────────────── */

function persist(evt) {
  try {
    const line = JSON.stringify(evt);
    let content = '';
    try { content = fs.readFileSync(EVENTS_FILE, 'utf8'); } catch (e) { /* neu */ }
    const trimmed = content.trim();
    let next;
    if (trimmed) {
      const lines = trimmed.split('\n');
      if (lines.length >= FILE_MAX_LINES) lines.splice(0, lines.length - FILE_MAX_LINES + 1);
      next = lines.join('\n') + '\n' + line;
    } else {
      next = line;
    }
    fs.mkdirSync(path.dirname(EVENTS_FILE), { recursive: true });
    fs.writeFileSync(EVENTS_FILE, next, 'utf8');
  } catch (e) { /* Events dürfen nie blockieren */ }
}

/** Lädt die letzten N Events aus der Datei (Startup-Warmup des Ring-Buffers). */
export function loadRecentFromFile(n = RING_SIZE) {
  try {
    const lines = fs.readFileSync(EVENTS_FILE, 'utf8').trim().split('\n').filter(Boolean);
    const out = lines.slice(-n).map((l) => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean);
    if (ring.length === 0) ring.push(...out);
    return out.length;
  } catch (e) { return 0; }
}

/* ─────────────────────────────────────────────────────────────────────
   EventBus
   ───────────────────────────────────────────────────────────────────── */

/**
 * Sendet ein Event. NIEMALS werfend — alle Aufrufer können es blind callen.
 * @param {string} type   z. B. 'LEVEL_UP'
 * @param {object} payload { bid, name, level, xp, reason, ... } (frei, wird abgesichert)
 */
export function emit(type, payload = {}) {
  try {
    const evt = {
      ts: Date.now(),
      type: String(type || 'UNKNOWN').slice(0, 40),
      data: {}
    };
    const allowed = ['bid', 'name', 'level', 'prestige', 'xp', 'granted', 'source', 'reason', 'delta', 'game', 'item', 'session', 'kind', 'target', 'streak', 'pos', 'total', 'prev', 'achievement', 'badge', 'title', 'amount']; /* + Progression 4.0/5.0 */
    for (const k of allowed) {
      const v = payload[k];
      if (v !== undefined && v !== null) {
        evt.data[k] = typeof v === 'string' ? v.slice(0, 120) : v;
      }
    }
    ring.push(evt);
    if (ring.length > RING_SIZE) ring.splice(0, ring.length - RING_SIZE);
    persist(evt);
    return evt;
  } catch (e) {
    return null;
  }
}

/** Die letzten N Events (neueste zuletzt). */
export function recent(n = 25) {
  const nC = Math.max(1, Math.min(200, Number(n) || 25));
  return ring.slice(-nC).reverse().map((e) => ({ ts: e.ts, type: e.type, data: e.data }));
}

/* ─────────────────────────────────────────────────────────────────────
   XP-Stats (Owner-Center)
   ───────────────────────────────────────────────────────────────────── */

const DAY_MS = 86_400_000;

function countEventSince(type, sinceMs) {
  return ring.reduce((a, e) => (e.type === type && e.ts >= sinceMs ? a + 1 : a), 0);
}

function sumGrantedSince(sinceMs) {
  return ring.reduce((a, e) => (e.type === 'XP_GRANTED' && e.ts >= sinceMs ? a + (Number(e.data.granted) || 0) : a), 0);
}

/**
 * XP-Statistik: Lifetime aus Profil-Scan, 24h/Today aus Event-Fenster.
 * @param {Array<{bid:string,name:string,level:number,prestige:number,xp:number,totalXp?:number,xpSources?:object}>} profiles
 */
export function xpStats(profiles = []) {
  const sinceDay = Date.now() - DAY_MS;
  const sources = {};
  let totalXp = 0;
  for (const p of profiles) {
    totalXp += Number(p.totalXp || p.xp || 0);
    for (const [k, v] of Object.entries(p.xpSources || {})) sources[k] = (sources[k] || 0) + (Number(v) || 0);
  }
  const capped = ring.filter((e) => e.type === 'XP_GRANTED' && e.data.capped === true && e.ts >= sinceDay).length;
  return {
    totalXp,
    today: sumGrantedSince(sinceDay),
    levelUps24h: countEventSince('LEVEL_UP', sinceDay),
    prestigeUps24h: countEventSince('PRESTIGE_UP', sinceDay),
    games24h: countEventSince('GAME_WIN', sinceDay),
    achievements24h: countEventSince('ACHIEVEMENT_UNLOCKED', sinceDay),
    suspiciousXp: capped, /* Nutzer, die das Anti-Spam-Cap in 24h erreicht haben */
    sources,
    generatedAt: new Date().toISOString()
  };
}

/* ─────────────────────────────────────────────────────────────────────
   Level-Tabelle (Owner: Kurve + Ränge)
   ───────────────────────────────────────────────────────────────────── */

/**
 * Tabelle der ersten `count` Level (Zyklus 0): nötig, kumuliert, Rang.
 * Für große Zahlen wird die Zahl gekürzt dargestellt (API-Consumer formatiert).
 */
export function levelTable(count = 100, prestige = 0) {
  const rows = [];
  let cumulative = 0;
  const n = Math.max(1, Math.min(744, Number(count) || 100));
  for (let l = 0; l < n; l++) {
    const need = neededXp(l, prestige);
    cumulative += need;
    const rank = rankFor(prestige, l);
    rows.push({
      level: l,
      needed: need > 1e15 ? need.toExponential(3) : need.toLocaleString('de-DE'),
      cumulative: cumulative > 1e15 ? cumulative.toExponential(3) : cumulative.toLocaleString('de-DE'),
      rank: rank.full
    });
  }
  return {
    rows,
    meta: { maxLevel: PROGRESSION.maxLevel, baseNeededXp: PROGRESSION.baseNeededXp, growth: '×1.00743/Level', prestige }
  };
}

/* Warmup beim Import: bestehende Events in den Ring laden (einmalig). */
loadRecentFromFile(RING_SIZE);

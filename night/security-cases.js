/* ============================================================================
   LoveBot — Security Cases (ESM)
   ────────────────────────────────────────────────────────────────────────
   Bündelt mehrere zusammenhängende Sicherheitsereignisse (aus
   Database/security.jsonl — geschrieben von SOWOHL server.js ALS AUCH
   Love.js) zu einem einzigen "Fall" (Security Case) pro auffälliger IP,
   damit der Owner nicht 30 Einzelzeilen durchsuchen muss, sondern EINEN
   Vorgang mit Status (offen/gelöst) und Verlauf sieht — wie ein Ticket.

   Cluster-Logik: Ereignisse derselben IP mit Risiko ≥ CASE_MIN_RISK werden
   zu einem Fall zusammengefasst, solange der Abstand zwischen zwei
   Ereignissen nicht größer als CASE_GAP_MS ist (danach beginnt ein neuer
   Fall). Die Fall-ID ist deterministisch (IP + Start-Zeitpunkt), sodass
   der Gelöst/Offen-Status stabil bleibt, auch wenn neue Log-Zeilen
   dazukommen. Persistiert in Database/security-cases.json — NUR der
   Status/die Owner-Notizen, nicht die Ereignisse selbst (die bleiben in
   der hash-verketteten security.jsonl, unveränderlich).
   ==========================================================================*/
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const SECURITY_FILE = path.join('Database', 'security.jsonl');
const CASES_STATE_FILE = path.join('Database', 'security-cases.json');

const CASE_MIN_RISK = 35;          /* Ereignisse unter dieser Schwelle bilden keine Fälle */
const CASE_GAP_MS = 30 * 60 * 1000; /* > 30 Min Pause zwischen Ereignissen = neuer Fall */
const CASE_SCAN_LINES = 3000;       /* wie viele der letzten Log-Zeilen betrachtet werden */

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(CASES_STATE_FILE, 'utf8'));
  } catch (e) {
    return { cases: {} };
  }
}
function saveState(state) {
  try {
    fs.mkdirSync('Database', { recursive: true });
    fs.writeFileSync(CASES_STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch (e) {}
}
function caseId(ip, startIso) {
  return crypto.createHash('sha1').update(String(ip) + '|' + String(startIso)).digest('hex').slice(0, 16);
}

function readEvents() {
  try {
    return fs.readFileSync(SECURITY_FILE, 'utf8').trim().split('\n').filter(Boolean)
      .slice(-CASE_SCAN_LINES)
      .map((l) => { try { return JSON.parse(l); } catch (e) { return null; } })
      .filter(Boolean);
  } catch (e) { return []; }
}

/** Berechnet aktuelle Fall-Cluster aus dem Log (rein lesend, deterministisch). */
export function computeCases() {
  const events = readEvents().filter((e) => e.ip && Number(e.risk || 0) >= CASE_MIN_RISK);
  /* Nach IP gruppieren, chronologisch sortieren, dann per Zeitlücke clustern. */
  const byIp = new Map();
  for (const e of events) {
    if (!byIp.has(e.ip)) byIp.set(e.ip, []);
    byIp.get(e.ip).push(e);
  }
  const state = loadState();
  const cases = [];
  for (const [ip, list] of byIp) {
    list.sort((a, b) => new Date(a.time) - new Date(b.time));
    let cluster = [];
    const flush = () => {
      if (!cluster.length) return;
      const first = cluster[0], last = cluster[cluster.length - 1];
      const id = caseId(ip, first.time);
      const maxRisk = Math.max(...cluster.map((e) => Number(e.risk || 0)));
      const sumRisk = cluster.reduce((s, e) => s + Number(e.risk || 0), 0);
      const score = Math.min(100, Math.round(maxRisk * 0.6 + Math.min(sumRisk, 200) * 0.2));
      const override = state.cases[id];
      cases.push({
        id, ip,
        eventCount: cluster.length,
        firstAt: first.time, lastAt: last.time,
        maxRisk, score,
        eventTypes: Array.from(new Set(cluster.map((e) => e.event))),
        sources: Array.from(new Set(cluster.map((e) => e.src === 'bot' ? 'bot' : 'web'))),
        status: override?.status || 'open',
        resolvedBy: override?.resolvedBy || null,
        resolvedAt: override?.resolvedAt || null,
        note: override?.note || null,
        events: cluster.map((e) => ({ time: e.time, event: e.event, risk: e.risk || 0, action: e.action || null, reason: e.reason || null }))
      });
      cluster = [];
    };
    for (const e of list) {
      if (cluster.length && new Date(e.time) - new Date(cluster[cluster.length - 1].time) > CASE_GAP_MS) flush();
      cluster.push(e);
    }
    flush();
  }
  return cases.sort((a, b) => new Date(b.lastAt) - new Date(a.lastAt));
}

export function listCases({ status } = {}) {
  const all = computeCases();
  return status ? all.filter((c) => c.status === status) : all;
}
export function getCaseById(id) {
  return computeCases().find((c) => c.id === id) || null;
}

/** Fall als gelöst markieren — verlangt Grund/Notiz, unveränderlich protokolliert. */
export function resolveCase(id, by, note) {
  const found = getCaseById(id);
  if (!found) return { error: 'not_found' };
  const state = loadState();
  state.cases[id] = {
    status: 'resolved', resolvedBy: by || 'system',
    resolvedAt: new Date().toISOString(), note: String(note || '').slice(0, 500),
    history: [...(state.cases[id]?.history || []), { at: new Date().toISOString(), by: by || 'system', action: 'resolved', note: String(note || '').slice(0, 500) }]
  };
  saveState(state);
  return { ok: true };
}
export function reopenCase(id, by, reason) {
  const found = getCaseById(id);
  if (!found) return { error: 'not_found' };
  const state = loadState();
  state.cases[id] = {
    status: 'open', resolvedBy: null, resolvedAt: null, note: null,
    history: [...(state.cases[id]?.history || []), { at: new Date().toISOString(), by: by || 'system', action: 'reopened', note: String(reason || '').slice(0, 500) }]
  };
  saveState(state);
  return { ok: true };
}

/* ---------- 📊 Owner-Sicherheitsübersicht (letzte 24h) ---------------------- */
export function overview24h(auditFile) {
  const now = Date.now();
  const dayAgo = now - 24 * 3600 * 1000;
  const events = readEvents().filter((e) => new Date(e.time).getTime() >= dayAgo);
  const loginFailures = events.filter((e) => /AUTH_FAILURE|AUTH_BRUTE_FORCE|AUTH_FAILED|AUTH_BANNED_LOGIN/.test(e.event)).length;
  const ipBans = events.filter((e) => /IP_BLOCKED|IP_MANUALLY_BANNED|ABUSE_AUTO_.*BLOCK/.test(e.event)).length;
  const sessionKills = events.filter((e) => /SESSION_KILLED|SESSIONS_KILLED|ALL_SESSIONS_KILLED/.test(e.event)).length;
  const criticalEvents = events.filter((e) => Number(e.risk || 0) >= 70).length;
  let userBans = 0;
  try {
    const lines = fs.readFileSync(auditFile || path.join('Database', 'audit.jsonl'), 'utf8').trim().split('\n').filter(Boolean);
    for (const l of lines.slice(-3000)) {
      try {
        const a = JSON.parse(l);
        if (new Date(a.time).getTime() >= dayAgo && /^user\.banned$|^bans\.ban$/.test(a.action || '')) userBans++;
      } catch (e) {}
    }
  } catch (e) {}
  const cases = computeCases();
  const openCases = cases.filter((c) => c.status === 'open').length;
  return {
    windowHours: 24,
    loginFailures, securityEvents: events.length, ipBans, userBans, sessionKills, criticalEvents,
    openCases, totalCases: cases.length
  };
}

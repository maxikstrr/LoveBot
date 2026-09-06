/* ═══════════════════════════════════════════════════════════════════════
   📡  L O V E B O T   S E S S I O N   M A N A G E R  ·  v1
   ───────────────────────────────────────────────────────────────────────
   Zentrale Registry & Steuerung für WhatsApp-Sessions.

   Lebenszyklus:  WAITING_FOR_AUTH → CONNECTING → CONNECTED
                  ↘ QR_REQUIRED ↗        ↘ DISCONNECTED → (auto-reconnect)
                                          ↘ STOPPED / DELETED

   Speicher:      Database/sessions.json   (Registry + Aktivitäts-Feed)

   Integration:
   • Love.js trägt die laufende Verbindung als Live-Session „main“ ein
     (Hooks: connection open/close/qr, messages, commands).
   • server.js liest über sessionsView() für /api/sessions (maskiert).
   • sessioncmds.js stellt die $session*-Befehle (Owner-only).

   Multi-Session (Spawn) ist vorbereitet, aber standardmäßig DEAKTIVIERT:
   sessions.json → spawn.enabled: true  +  LOVEBOT_SESSION_DIR/ID je Instanz.
   ═══════════════════════════════════════════════════════════════════ */

import fs from 'node:fs';
import path from 'node:path';
import { spawn as cpSpawn } from 'node:child_process';

const DB_DIR = path.join('Database');
const STORE_PATH = path.join(DB_DIR, 'sessions.json');
const MAX_ACTIVITY = 200;

/* ---------- Store ------------------------------------------------------ */
function emptyStore() {
  return {
    config: { spawn: { enabled: false, command: 'node', args: ['Love.js'] } },
    sessions: {},
    activity: [],
    locks: {},
    audit: []
  };
}

function loadStore() {
  try {
    const s = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
    s.config ||= { spawn: { enabled: false, command: 'node', args: ['Love.js'] } };
    s.config.spawn ||= { enabled: false, command: 'node', args: ['Love.js'] };
    s.sessions ||= {};
    s.activity ||= [];
    s.locks ||= {};
    s.audit ||= [];
    return s;
  } catch (e) {
    return emptyStore();
  }
}

function saveStore(store) {
  try {
    fs.mkdirSync(DB_DIR, { recursive: true });
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
  } catch (e) {
    console.error('[sessions] Speicherfehler:', e?.message || e);
  }
}

/* ---------- Helfer ----------------------------------------------------- */
export const SESSION_STATUSES = ['WAITING_FOR_AUTH', 'CONNECTING', 'QR_REQUIRED', 'CONNECTED', 'DISCONNECTED', 'PAUSED', 'STOPPED', 'ERROR'];

/* Lifecycle-Anzeige (angelehnt an gängige Managed-Session-Stati) */
const LIFECYCLE_MAP = {
  WAITING_FOR_AUTH: 'new', CONNECTING: 'connecting', QR_REQUIRED: 'connecting',
  CONNECTED: 'running', DISCONNECTED: 'disconnected', PAUSED: 'paused',
  STOPPED: 'stopped', ERROR: 'error'
};

function slugId(name) {
  const base = String(name || 'session').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 20) || 'session';
  return base;
}

function maskPhone(p) {
  const s = String(p || '');
  if (!s) return '—';
  if (s.length <= 5) return s;
  return s.slice(0, 4) + '•••' + s.slice(-3);
}

function uptimeFrom(s) {
  if (!s.connectedAt || s.status !== 'CONNECTED') return null;
  return Math.max(0, Math.floor((Date.now() - s.connectedAt) / 1000));
}

function fmtUptime(sec) {
  if (sec == null) return '—';
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return d + 'd ' + h + 'h';
  if (h > 0) return h + 'h ' + m + 'm';
  return m + 'm';
}

/* Health: aus Status + Fehlerzahl + lastSeen ableiten */
function healthOf(s) {
  if (s.status === 'CONNECTED') {
    if ((s.errors || 0) > 20) return { code: 'DEGRADED', emoji: '🟡', label: 'Instabil' };
    return { code: 'HEALTHY', emoji: '🟢', label: 'Läuft perfekt' };
  }
  if (s.status === 'QR_REQUIRED' || s.status === 'WAITING_FOR_AUTH' || s.status === 'CONNECTING') {
    return { code: 'AUTH_REQUIRED', emoji: '🟣', label: 'Authentifizierung nötig' };
  }
  if (s.status === 'PAUSED') return { code: 'PAUSED', emoji: '⏸️', label: 'Pausiert' };
  if (s.status === 'STOPPED') return { code: 'STOPPED', emoji: '⚫', label: 'Gestoppt' };
  if (s.status === 'ERROR') return { code: 'OFFLINE', emoji: '🔴', label: 'Fehler' };
  return { code: 'OFFLINE', emoji: '🔴', label: 'Offline' };
}

/* ---------- Aktivitäts-Feed -------------------------------------------- */
function addActivity(store, type, text, extra = {}) {
  store.activity.push({ ts: Date.now(), type, text, ...extra });
  /* extra kann { sid } enthalten → filterbar pro Session */
  if (store.activity.length > MAX_ACTIVITY) store.activity = store.activity.slice(-MAX_ACTIVITY);
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  Registry-API (vom Bot & von Befehlen genutzt)                      */
/* ═══════════════════════════════════════════════════════════════════ */

function ensureSession(store, id, meta = {}) {
  const s = store.sessions[id] ||= {
    id,
    name: meta.name || id,
    status: 'WAITING_FOR_AUTH',
    source: meta.source || 'live',          /* live = dieser Prozess, external = andere Instanz, spawned = Kind-Prozess */
    createdAt: Date.now(),
    connectedAt: null,
    lastSeen: null,
    jid: '',
    lid: '',
    phone: '',
    messages: 0,
    commands: 0,
    groups: 0,
    reconnects: 0,
    errors: 0,
    memoryMb: 0,
    isDefault: false,
    pid: null,
    desiredState: 'running',
    autoStart: id === 'main',
    tags: [],
    env: 'production'
  };
  /* Nur explizit übergebene Felder überschreiben (Name bleibt sonst!) */
  if (meta.name) s.name = meta.name;
  if (meta.source) s.source = meta.source;
  return s;
}

/* Neue Session in der Registry anlegen (Owner-Befehl $newsession) */
export function createSession(name, opts = {}) {
  const store = loadStore();
  let id = slugId(name);
  if (store.sessions[id]) {
    let n = 2;
    while (store.sessions[id + '_' + n]) n++;
    id = id + '_' + n;
  }
  const s = ensureSession(store, id, { name: String(name || id).slice(0, 32), source: opts.source || 'external' });
  s.status = 'WAITING_FOR_AUTH';
  if (!Object.values(store.sessions).some((x) => x.isDefault)) s.isDefault = store.sessions.main ? false : false;
  addActivity(store, 'session', '🆕 Session „' + s.name + '“ angelegt (' + id + ', ' + s.source + ')');
  auditEntry(store, id, opts.actor || 'owner', 'CREATED');
  saveStore(store);

  /* Optional: echten zweiten Bot-Prozess starten (standardmäßig aus) */
  let spawned = false;
  if (opts.spawn && store.config.spawn.enabled) {
    spawned = spawnSession(id);
  }
  return { id, name: s.name, spawned };
}

/* Kind-Prozess starten — nur aktiv, wenn config.spawn.enabled */
export function spawnSession(id) {
  const store = loadStore();
  const cfg = store.config.spawn;
  if (!cfg.enabled) return false;
  const s = store.sessions[id];
  if (!s) return false;
  try {
    const child = cpSpawn(cfg.command, cfg.args, {
      cwd: process.cwd(),
      env: { ...process.env, LOVEBOT_SESSION_ID: id, LOVEBOT_SESSION_DIR: 'Sessions/' + id },
      detached: true,
      stdio: 'ignore'
    });
    child.unref();
    s.pid = child.pid;
    s.source = 'spawned';
    s.status = 'CONNECTING';
    addActivity(store, 'session', '🚀 Session ' + id + ' gestartet (PID ' + child.pid + ')');
    saveStore(store);
    return true;
  } catch (e) {
    addActivity(store, 'error', '❌ Spawn von ' + id + ' fehlgeschlagen: ' + (e?.message || e));
    saveStore(store);
    return false;
  }
}

/* Laufende Verbindung melden (Hook aus Love.js) */
export function setLive({ id = 'main', jid = '', lid = '', name = '', groups = 0 } = {}) {
  const store = loadStore();
  const s = ensureSession(store, id, { source: id === 'main' ? 'live' : 'external' });
  if (!s.name || s.name === s.id) s.name = name || (id === 'main' ? 'MainBot' : id);
  const wasConnected = s.status === 'CONNECTED';
  s.status = 'CONNECTED';
  s.connectedAt = s.connectedAt && wasConnected ? s.connectedAt : Date.now();
  s.lastSeen = Date.now();
  s.jid = jid || s.jid;
  s.lid = lid || s.lid;
  s.phone = (jid || s.jid).replace(/@.*/, '');
  if (name) s.name = name;
  if (groups) s.groups = groups;
  s.memoryMb = Number((process.memoryUsage().rss / 1024 / 1024).toFixed(1));
  if (!wasConnected) {
    s.isDefault = s.isDefault || id === 'main';
    addActivity(store, 'session', '🟢 Session „' + s.name + '“ verbunden (' + maskPhone(s.phone) + ')', { sid: id });
  }
  saveStore(store);
  return s;
}

export function setStatus(id, status, note = '') {
  const store = loadStore();
  const s = store.sessions[id];
  if (!s) return null;
  if (!SESSION_STATUSES.includes(status)) return null;
  const prev = s.status;
  const now = Date.now();
  /* Verbundene Zeit akkumulieren → Grundlage für Uptime-% */
  if (prev === 'CONNECTED' && status !== 'CONNECTED' && s.connectedAt) {
    s.connectedMs = (s.connectedMs || 0) + Math.max(0, now - s.connectedAt);
  }
  s.status = status;
  s.lastSeen = now;
  if (status === 'CONNECTED' && prev !== 'CONNECTED') s.connectedAt = now;
  if (status === 'DISCONNECTED') { s.reconnects++; s.connectedAt = null; }
  if (status === 'STOPPED') s.connectedAt = null;
  const icons = { CONNECTED: '🟢', DISCONNECTED: '🔴', QR_REQUIRED: '🟡', CONNECTING: '🕸️', STOPPED: '⚫', ERROR: '💥', WAITING_FOR_AUTH: '🟣' };
  addActivity(store, 'session', (icons[status] || 'ℹ️') + ' Session „' + s.name + '“ → ' + status + (note ? ' _( ' + note + ' )_' : ''), { sid: id });
  saveStore(store);
  return s;
}

export function trackMessage(id = 'main', count = 1) {
  const store = loadStore();
  const s = store.sessions[id];
  if (!s) return;
  s.messages += count;
  s.lastSeen = Date.now();
  saveStore(store); /* Datei ist klein — immer sichern, sonst gehen Zähler verloren */
}

export function trackCommand(id = 'main', command = '') {
  const store = loadStore();
  const s = store.sessions[id];
  if (!s) return;
  s.commands++;
  s.lastSeen = Date.now();
  saveStore(store);
}

export function trackError(id = 'main', note = '') {
  const store = loadStore();
  const s = store.sessions[id];
  if (!s) return;
  s.errors++;
  addActivity(store, 'error', '🐞 Fehler in „' + s.name + '“' + (note ? ': ' + note : ''), { sid: id });
  saveStore(store);
}

export function setGroups(id, groups) {
  const store = loadStore();
  const s = store.sessions[id];
  if (!s) return;
  s.groups = Number(groups) || 0;
  saveStore(store);
}

export function renameSession(id, name) {
  const store = loadStore();
  const s = store.sessions[id];
  if (!s) return null;
  const old = s.name;
  s.name = String(name || old).slice(0, 32);
  addActivity(store, 'session', '✏️ Session ' + id + ' umbenannt: „' + old + '“ → „' + s.name + '“');
  saveStore(store);
  return s;
}

export function setDefault(id) {
  const store = loadStore();
  if (!store.sessions[id]) return false;
  for (const s of Object.values(store.sessions)) s.isDefault = s.id === id;
  addActivity(store, 'session', '⭐ Standard-Session: ' + id);
  saveStore(store);
  return true;
}

/* Session aus Registry entfernen — Credentials werden NIE automatisch gelöscht */
export function deleteSession(id, opts = {}) {
  const store = loadStore();
  const s = store.sessions[id];
  if (!s) return { ok: false, reason: 'not_found' };
  if (id === 'main') return { ok: false, reason: 'main_protected' };
  delete store.sessions[id];
  delete store.locks[id];
  addActivity(store, 'session', '🗑️ Session „' + s.name + '“ (' + id + ') aus der Registry entfernt. Credentials bleiben unberührt.');
  auditEntry(store, id, opts.actor || 'owner', 'DELETED');
  saveStore(store);
  return { ok: true };
}

/* Kind-Prozess stoppen (nur gespawnte Sessions) */
export function stopSpawned(id) {
  const store = loadStore();
  const s = store.sessions[id];
  if (!s || s.source !== 'spawned' || !s.pid) return { ok: false, reason: 'not_spawned' };
  try {
    process.kill(s.pid, 'SIGTERM');
    s.status = 'STOPPED';
    s.pid = null;
    addActivity(store, 'session', '🛑 Gespawnte Session ' + id + ' gestoppt (SIGTERM).');
    saveStore(store);
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e?.code === 'ESRCH' ? 'not_running' : 'error' };
  }
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  Views (für Befehle & Website — Nummern immer maskiert!)            */
/* ═══════════════════════════════════════════════════════════════════ */

export function listSessions() {
  const store = loadStore();
  return Object.values(store.sessions)
    .sort((a, b) => (b.isDefault - a.isDefault) || a.id.localeCompare(b.id))
    .map((s) => publicView(s));
}

function uptimePctOf(s) {
  const total = Date.now() - (s.createdAt || Date.now());
  if (total <= 0) return null;
  const connected = (s.connectedMs || 0) + (s.status === 'CONNECTED' && s.connectedAt ? (Date.now() - s.connectedAt) : 0);
  return Math.max(0, Math.min(100, Number(((connected / total) * 100).toFixed(2))));
}

function publicView(s) {
  const up = uptimeFrom(s);
  return {
    id: s.id,
    name: s.name,
    status: s.status,
    health: healthOf(s),
    maintenance: !!s.maintenance,
    profile: s.profile || null,
    desiredState: s.desiredState || 'running',
    autoStart: !!s.autoStart,
    tags: s.tags || [],
    env: s.env || 'production',
    lifecycle: LIFECYCLE_MAP[s.status] || 'unknown',
    uptimePct: uptimePctOf(s),
    downSec: (() => {
      const total = Math.floor((Date.now() - (s.createdAt || Date.now())) / 1000);
      const conn = Math.floor(((s.connectedMs || 0) + (s.status === 'CONNECTED' && s.connectedAt ? (Date.now() - s.connectedAt) : 0)) / 1000);
      return Math.max(0, total - conn);
    })(),
    source: s.source,
    isDefault: !!s.isDefault,
    phone: maskPhone(s.phone),
    uptimeSec: up,
    uptime: fmtUptime(up),
    messages: s.messages || 0,
    commands: s.commands || 0,
    groups: s.groups || 0,
    reconnects: s.reconnects || 0,
    errors: s.errors || 0,
    memoryMb: s.memoryMb || 0,
    lastSeen: s.lastSeen ? new Date(s.lastSeen).toISOString() : null,
    createdAt: new Date(s.createdAt).toISOString()
  };
}

export function getSession(id) {
  const store = loadStore();
  return store.sessions[id] ? publicView(store.sessions[id]) : null;
}

export function recentActivity(limit = 30) {
  const store = loadStore();
  return store.activity.slice(-limit).reverse().map((a) => ({ ...a, time: new Date(a.ts).toISOString() }));
}

export function spawnConfigured() {
  return loadStore().config.spawn.enabled === true;
}

/* ---------- Migration: vorhandene Heartbeat-Daten übernehmen ---------- */
export function adoptHeartbeat(hb) {
  if (!hb || !hb.online) return;
  const store = loadStore();
  const s = ensureSession(store, 'main', { name: 'MainBot', source: 'live' });
  if (s.status !== 'CONNECTED') {
    s.status = 'CONNECTED';
    s.connectedAt = s.connectedAt || Date.now();
  }
  s.jid = hb.jid || s.jid;
  s.lid = hb.lid || s.lid;
  s.phone = (hb.jid || s.jid || '').replace(/@.*/, '');
  s.memoryMb = hb.ramMb || s.memoryMb;
  s.lastSeen = Date.now();
  s.isDefault = true;
  if (s.messages === 0 && !store.activity.some((a) => a.text?.includes(s.name) && a.text?.includes('übernommen'))) {
    addActivity(store, 'session', '📡 Session „' + s.name + '“ aus Heartbeat übernommen (Boot-Migration)');
  }
  saveStore(store);
}


/* ═══════════════════════════════════════════════════════════════════ */
/*  SESSION 3.0 — Profiles · Clone · Maintenance · Events · Adoption  */
/* ═══════════════════════════════════════════════════════════════════ */

/* Session-Profil: prefix, language, theme, mode + Feature-Overrides
   (features: 'inherit' = von GLOBAL geerbt, true/false = Override) */
const PROFILE_DEFAULTS = {
  prefix: '$',
  language: 'de',
  theme: 'romantic',
  mode: 'public',
  features: { love: 'inherit', economy: 'inherit', pets: 'inherit', games: 'inherit', ai: 'inherit', moderation: 'inherit' }
};

export function getSessionProfileRaw(id) {
  const store = loadStore();
  const s = store.sessions[id];
  if (!s) return null;
  if (!s.profile) s.profile = { ...PROFILE_DEFAULTS, features: { ...PROFILE_DEFAULTS.features } };
  return s.profile;
}

export function setSessionProfileField(id, key, value) {
  const store = loadStore();
  const s = store.sessions[id];
  if (!s) return null;
  if (!s.profile) s.profile = { ...PROFILE_DEFAULTS, features: { ...PROFILE_DEFAULTS.features } };
  if (key === 'features') return null; /* nur über setSessionFeature */
  if (!['prefix', 'language', 'theme', 'mode'].includes(key)) return null;
  if (key === 'prefix') value = String(value || '$').slice(0, 3);
  else value = String(value || '').slice(0, 16);
  s.profile[key] = value;
  addActivity(store, 'session', '⚙️ Profil ' + id + ': ' + key + ' = ' + value, { sid: id });
  saveStore(store);
  return s.profile;
}

export function setSessionFeature(id, feature, value) {
  const store = loadStore();
  const s = store.sessions[id];
  if (!s) return null;
  if (!s.profile) s.profile = { ...PROFILE_DEFAULTS, features: { ...PROFILE_DEFAULTS.features } };
  if (!PROFILE_DEFAULTS.features.hasOwnProperty(feature)) return null;
  if (!['inherit', 'on', 'off'].includes(value)) return null;
  s.profile.features[feature] = value;
  addActivity(store, 'session', '🧩 Feature ' + id + ': ' + feature + ' → ' + value, { sid: id });
  saveStore(store);
  return s.profile;
}

/* Clone: Profil & Konfiguration kopieren — NIE Credentials, NIE Zähler */
export function cloneSession(sourceId, newName) {
  const store = loadStore();
  const src = store.sessions[sourceId];
  if (!src) return { ok: false, reason: 'not_found' };
  const created = createSession(newName, { source: 'external' });
  const store2 = loadStore();
  const dst = store2.sessions[created.id];
  if (!dst) return { ok: false, reason: 'error' };
  dst.profile = src.profile
    ? JSON.parse(JSON.stringify(src.profile))
    : { ...PROFILE_DEFAULTS, features: { ...PROFILE_DEFAULTS.features } };
  addActivity(store2, 'session', '🧬 Session „' + src.name + '“ → „' + dst.name + '“ geklont (nur Profil, keine Credentials)', { sid: created.id });
  saveStore(store2);
  return { ok: true, id: created.id, name: dst.name };
}

/* Wartungsmodus pro Session */
export function setMaintenance(id, on) {
  const store = loadStore();
  const s = store.sessions[id];
  if (!s) return null;
  s.maintenance = on === true;
  addActivity(store, 'session', (on ? '🛠️ Wartungsmodus AN: ' : '🛠️ Wartungsmodus AUS: ') + '„' + s.name + '“', { sid: id });
  saveStore(store);
  return s;
}

/* Aktivität einer Session (gefiltert) */
export function sessionActivity(id, limit = 15, type = null) {
  const store = loadStore();
  return store.activity
    .filter((a) => a.sid === id && (!type || a.type === type))
    .slice(-limit).reverse()
    .map((a) => ({ ...a, time: new Date(a.ts).toISOString() }));
}

/* Alle Heartbeat-Dateien adoptieren (main + heartbeat-<id>.json) —
   für Instanzen auf anderen Hosts, die nicht in dieselbe Registry schreiben */
export function adoptAllHeartbeats() {
  let adopted = 0;
  try {
    const files = fs.readdirSync(DB_DIR).filter((f) => /^heartbeat(-.+)?\.json$/.test(f));
    for (const f of files) {
      try {
        const id = f === 'heartbeat.json' ? 'main' : f.replace(/^heartbeat-/, '').replace(/\.json$/, '');
        const hb = JSON.parse(fs.readFileSync(path.join(DB_DIR, f), 'utf8'));
        if (hb && hb.online) { adoptHeartbeatFor(id, hb); adopted++; }
      } catch (e) {}
    }
  } catch (e) {}
  return adopted;
}

function adoptHeartbeatFor(id, hb) {
  const store = loadStore();
  const s = ensureSession(store, id, { source: id === 'main' ? 'live' : 'external' });
  if (s.status !== 'CONNECTED') { s.status = 'CONNECTED'; s.connectedAt = s.connectedAt || Date.now(); }
  s.jid = hb.jid || s.jid;
  s.lid = hb.lid || s.lid;
  s.phone = (hb.jid || s.jid || '').replace(/@.*/, '');
  s.memoryMb = hb.ramMb || s.memoryMb;
  s.lastSeen = Date.now();
  if (id === 'main') s.isDefault = s.isDefault || true;
  saveStore(store);
}


/* ═══════════════════════════════════════════════════════════════════ */
/*  SESSION 4.0 — desiredState · Pause/Resume · Locks · Audit ·       */
/*  Fleet · Warm Restart · Phantom-Detection                          */
/* ═══════════════════════════════════════════════════════════════════ */

const LOCK_TTL_MS = 60000;

/* Operation-Lock: verhindert parallele Lifecycle-Aktionen pro Session */
export function acquireLock(id, op, by) {
  const store = loadStore();
  const now = Date.now();
  const cur = store.locks[id];
  if (cur && now - cur.at < LOCK_TTL_MS) {
    return { ok: false, held: cur };
  }
  store.locks[id] = { op, by: by || 'system', at: now };
  saveStore(store);
  return { ok: true };
}

export function releaseLock(id) {
  const store = loadStore();
  delete store.locks[id];
  saveStore(store);
}

export function getLock(id) {
  return loadStore().locks[id] || null;
}

/* Audit-Trail: jede administrative Aktion pro Session */
function auditEntry(store, sid, actor, action, detail = '') {
  store.audit.push({ ts: Date.now(), sid, actor: actor || 'system', action, detail });
  if (store.audit.length > 500) store.audit = store.audit.slice(-500);
}

export function recentAudit(limit = 50, sid = null) {
  const store = loadStore();
  return store.audit
    .filter((a) => !sid || a.sid === sid)
    .slice(-limit).reverse()
    .map((a) => ({ ...a, time: new Date(a.ts).toISOString() }));
}

/* Pause: vorübergehend deaktiviert — Credentials bleiben, desiredState 'paused' */
export function pauseSession(id, actor = 'system') {
  const store = loadStore();
  const s = store.sessions[id];
  if (!s) return { ok: false, reason: 'not_found' };
  if (id === 'main') return { ok: false, reason: 'main_protected' };
  if (s.status === 'PAUSED') return { ok: false, reason: 'already_paused' };
  s.desiredState = 'paused';
  s.status = 'PAUSED';
  s.connectedAt = null;
  auditEntry(store, id, actor, 'PAUSED');
  addActivity(store, 'session', '⏸️ Session „' + s.name + '“ pausiert (Credentials bleiben)', { sid: id });
  saveStore(store);
  return { ok: true };
}

/* Resume: aus Pause/Stop zurück in 'running' (Wunsch-Zustand) */
export function resumeSession(id, actor = 'system') {
  const store = loadStore();
  const s = store.sessions[id];
  if (!s) return { ok: false, reason: 'not_found' };
  s.desiredState = 'running';
  if (s.status === 'PAUSED' || s.status === 'STOPPED') s.status = 'WAITING_FOR_AUTH';
  auditEntry(store, id, actor, 'RESUMED');
  addActivity(store, 'session', '▶️ Session „' + s.name + '“ reaktiviert (desiredState: running)', { sid: id });
  saveStore(store);
  /* falls Auto-Spawn aktiv: sofort versuchen zu starten */
  if (store.config.spawn.enabled && s.source === 'spawned') {
    spawnSession(id);
  }
  return { ok: true };
}

/* Stop (bewusst aus): wie kill, aber mit desiredState 'stopped' + Audit */
export function stopSession(id, actor = 'system') {
  const store = loadStore();
  const s = store.sessions[id];
  if (!s) return { ok: false, reason: 'not_found' };
  if (id === 'main') return { ok: false, reason: 'main_protected' };
  s.desiredState = 'stopped';
  auditEntry(store, id, actor, 'STOPPED');
  saveStore(store);
  if (s.source === 'spawned' && s.pid) {
    saveStore(store);
    return stopSpawned(id);
  }
  s.status = 'STOPPED';
  addActivity(store, 'session', '⚫ Session „' + s.name + '“ gestoppt (bewusst, kein Auto-Start)', { sid: id });
  saveStore(store);
  return { ok: true };
}

export function setAutoStart(id, on) {
  const store = loadStore();
  const s = store.sessions[id];
  if (!s) return null;
  s.autoStart = on === true;
  auditEntry(store, id, 'owner', 'AUTOSTART', on ? 'on' : 'off');
  saveStore(store);
  return s;
}

export function setTags(id, tags) {
  const store = loadStore();
  const s = store.sessions[id];
  if (!s) return null;
  s.tags = String(tags || '').split(/[\s,]+/).map((t) => t.toLowerCase().replace(/[^a-z0-9_-]/g, '')).filter(Boolean).slice(0, 6);
  saveStore(store);
  return s;
}

export function setEnv(id, env) {
  const store = loadStore();
  const s = store.sessions[id];
  if (!s) return null;
  if (!['production', 'testing', 'development'].includes(env)) return null;
  s.env = env;
  auditEntry(store, id, 'owner', 'ENV', env);
  saveStore(store);
  return s;
}

/* Warm Restart: welche Sessions sollten beim Boot wieder laufen? */
export function bootPlan() {
  const store = loadStore();
  return Object.values(store.sessions)
    .filter((s) => s.desiredState === 'running' && s.autoStart !== false)
    .map((s) => ({ id: s.id, name: s.name, status: s.status, source: s.source }));
}

/* Fleet-Statistik: Managed vs Running getrennt (wie getAllManaged vs getAll) */
export function fleetStats() {
  const list = listSessions();
  const by = {};
  for (const s of list) by[s.status] = (by[s.status] || 0) + 1;
  const ups = list.map((s) => s.uptimePct).filter((x) => x != null);
  return {
    managed: list.length,
    running: by.CONNECTED || 0,
    paused: by.PAUSED || 0,
    authRequired: (by.WAITING_FOR_AUTH || 0) + (by.QR_REQUIRED || 0) + (by.CONNECTING || 0),
    stopped: by.STOPPED || 0,
    error: (by.ERROR || 0) + (by.DISCONNECTED || 0),
    avgUptimePct: ups.length ? Number((ups.reduce((a, b) => a + b, 0) / ups.length).toFixed(2)) : null
  };
}

/* Nur fehlgeschlagene Sessions neu starten (mit desiredState running) */
export function restartFailed(actor = 'system') {
  const store = loadStore();
  const targets = Object.values(store.sessions).filter((s) =>
    s.desiredState === 'running' && ['ERROR', 'DISCONNECTED'].includes(s.status)
  );
  const results = [];
  for (const t of targets) {
    auditEntry(store, t.id, actor, 'RESTART_FAILED_TRIGGERED');
    if (t.source === 'spawned' && store.config.spawn.enabled) {
      stopSpawned(t.id);
      const ok = spawnSession(t.id);
      results.push({ id: t.id, restarted: ok });
    } else {
      results.push({ id: t.id, restarted: false, note: 'nicht gespawnt — Neustart auf ihrem Host' });
    }
  }
  saveStore(store);
  return results;
}

/* Phantom-Detection: Session-Ordner ohne Registry-Eintrag finden (nur lesen!) */
export function detectOrphanSessionDirs(baseDir = 'Sessions') {
  const store = loadStore();
  const known = new Set(Object.keys(store.sessions));
  const orphans = [];
  try {
    for (const entry of fs.readdirSync(baseDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const id = entry.name;
      if (known.has(id)) continue;
      /* zählt nur, wenn Credentials drin liegen */
      try { if (fs.existsSync(path.join(baseDir, id, 'creds.json'))) orphans.push(id); } catch (e) {}
    }
  } catch (e) {}
  return orphans;
}

/* 🚨 Emergency: alle gespawnten Sessions stoppen (main & externe bleiben) */
export function stopAllSpawned(actor = 'owner') {
  const store = loadStore();
  const targets = Object.values(store.sessions).filter((s) => s.source === 'spawned');
  const results = [];
  for (const t of targets) {
    const r = stopSpawned(t.id);
    results.push({ id: t.id, ok: r.ok });
  }
  auditEntry(store, '*', actor, 'EMERGENCY_STOP_ALL', targets.length + ' gespawnte Sessions');
  addActivity(store, 'session', '🚨 EMERGENCY: Alle gespawnten Sessions gestoppt (' + targets.length + ')', {});
  saveStore(store);
  return results;
}

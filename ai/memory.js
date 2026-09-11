/* ═══════════════════════════════════════════════════════════════════
   💜 LoveBot 7.0 — AI MEMORY (ai/memory.js)

   Echte Memory-Schicht in Database/ai.json, strikt getrennt:
   · conversations: dm:<bid> / group:<gid>:<bid> (je 20 Nachrichten, rotierend)
   · facts: explizit per $aimemory remember gespeicherte Fakten (je 20)
   · prefs: chatMode, lang (mehr nicht — keine sensiblen Daten)
   · stats: Tages-/Total-Zähler + pro User (für $me, Limits, Analytics)

   Kein ungefragtes Speichern: Langzeit-Fakten nur via `remember`.
   Löschen: $aimemory forget/clear + Unregister-Purge (purgeAiUser).
   ═══════════════════════════════════════════════════════════════════ */
import fs from 'fs';
import path from 'path';

const AI_FILE = () => path.join('Database', 'ai.json');
const MAX_CONV = 20;
const MAX_FACTS = 20;
const MAX_USERS_STATS = 500;

function dayKey(ts = Date.now()) { return new Date(ts).toISOString().slice(0, 10); }

export function defaultAiConfig() {
  return {
    provider: 'local',
    model: process.env.AI_MODEL || 'llama3.1:8b',
    baseUrl: process.env.AI_BASE_URL || 'http://127.0.0.1:11434',
    timeoutMs: Number(process.env.AI_TIMEOUT) || 60000,
    maxTokens: Number(process.env.AI_MAX_TOKENS) || 512,
    temperature: Number(process.env.AI_TEMPERATURE) || 0.7,
    contextChars: Number(process.env.AI_CONTEXT_SIZE) || 6000,
    perMin: 6, perHour: 60, perDay: 200,
    maxReplies: 1
  };
}

export function loadAiStore() {
  let st = null;
  try { st = JSON.parse(fs.readFileSync(AI_FILE(), 'utf8')); } catch (e) {}
  if (!st || typeof st !== 'object') {
    st = { version: 1, config: {}, conversations: {}, facts: {}, prefs: {}, stats: {} };
  }
  st.config = { ...defaultAiConfig(), ...(st.config || {}) };
  /* Env gewinnt, wenn gesetzt (Doku-Regel) */
  if (process.env.AI_MODEL) st.config.model = process.env.AI_MODEL;
  if (process.env.AI_BASE_URL) st.config.baseUrl = process.env.AI_BASE_URL;
  if (process.env.AI_TIMEOUT) st.config.timeoutMs = Number(process.env.AI_TIMEOUT);
  if (process.env.AI_MAX_TOKENS) st.config.maxTokens = Number(process.env.AI_MAX_TOKENS);
  if (process.env.AI_TEMPERATURE) st.config.temperature = Number(process.env.AI_TEMPERATURE);
  if (process.env.AI_CONTEXT_SIZE) st.config.contextChars = Number(process.env.AI_CONTEXT_SIZE);
  st.conversations = st.conversations || {};
  st.facts = st.facts || {};
  st.prefs = st.prefs || {};
  st.stats = st.stats || {};
  if (!st.stats.day || st.stats.day.k !== dayKey()) st.stats.day = { k: dayKey(), req: 0, err: 0, latSum: 0 };
  if (!st.stats.total) st.stats.total = { req: 0, err: 0 };
  if (!st.stats.byUser) st.stats.byUser = {};
  return st;
}

export function saveAiStore(st) {
  /* Atomar: erst tmp, dann rename — nie halb geschriebene ai.json (7.0.2). */
  try {
    fs.mkdirSync('Database', { recursive: true });
    const tmp = AI_FILE() + '.tmp-' + process.pid;
    fs.writeFileSync(tmp, JSON.stringify(st), 'utf8');
    fs.renameSync(tmp, AI_FILE());
    return true;
  } catch (e) {
    try { fs.unlinkSync(AI_FILE() + '.tmp-' + process.pid); } catch (e2) {}
    return false;
  }
}

export function aiConfig() {
  return loadAiStore().config;
}

export function setAiConfig(patch = {}, actor = '') {
  const st = loadAiStore();
  const allow = ['provider', 'model', 'baseUrl', 'timeoutMs', 'maxTokens', 'temperature', 'contextChars', 'perMin', 'perHour', 'perDay'];
  for (const k of allow) {
    if (patch[k] === undefined) continue;
    /* 7.0.2: nur 'local' als Provider — 'mock' nie in Produktion speicherbar. */
    if (k === 'provider') {
      if (String(patch[k]).toLowerCase() === 'local') st.config[k] = 'local';
      continue;
    }
    if (['model', 'baseUrl'].includes(k)) st.config[k] = String(patch[k]).slice(0, 200);
    else if (Number.isFinite(Number(patch[k]))) st.config[k] = Number(patch[k]);
  }
  st.config.updatedAt = new Date().toISOString();
  st.config.updatedBy = String(actor).slice(0, 60);
  saveAiStore(st);
  return st.config;
}

/* ── Scopes ───────────────────────────────────────────────────────── */
export function dmScope(bid) { return 'dm:' + bid; }
export function groupScope(gid, bid) { return 'group:' + gid + ':' + bid; }
export function scopeOf({ gid = '', bid = '' }) {
  return gid ? groupScope(gid, bid) : dmScope(bid);
}

/* ── Conversations ────────────────────────────────────────────────── */
export function getConversation(scope) {
  const st = loadAiStore();
  return Array.isArray(st.conversations[scope]) ? st.conversations[scope] : [];
}

export function pushConversation(scope, role, text) {
  const st = loadAiStore();
  const arr = Array.isArray(st.conversations[scope]) ? st.conversations[scope] : [];
  arr.push({ role, text: String(text).slice(0, 2000), ts: Date.now() });
  while (arr.length > MAX_CONV) arr.shift();
  st.conversations[scope] = arr;
  saveAiStore(st);
  return arr.length;
}

export function clearConversation(scope) {
  const st = loadAiStore();
  delete st.conversations[scope];
  saveAiStore(st);
  return true;
}

/* Letzte n Austausche (User+AI-Paare) vergessen */
export function forgetLast(scope, n = 1) {
  const st = loadAiStore();
  const arr = Array.isArray(st.conversations[scope]) ? st.conversations[scope] : [];
  let drop = Math.max(1, Math.min(10, n)) * 2;
  while (drop > 0 && arr.length) { arr.pop(); drop--; }
  if (!arr.length) delete st.conversations[scope];
  else st.conversations[scope] = arr;
  saveAiStore(st);
  return arr.length;
}

/* ── Fakten (nur explizit) ────────────────────────────────────────── */
export function getFacts(bid) {
  const st = loadAiStore();
  return Array.isArray(st.facts[bid]) ? st.facts[bid] : [];
}

export function rememberFact(bid, text) {
  const t = String(text || '').trim().slice(0, 300);
  if (!t) return { ok: false, reason: 'empty' };
  const st = loadAiStore();
  const arr = Array.isArray(st.facts[bid]) ? st.facts[bid] : [];
  if (arr.some((f) => f.text === t)) return { ok: false, reason: 'duplicate' };
  arr.push({ text: t, ts: Date.now() });
  while (arr.length > MAX_FACTS) arr.shift();
  st.facts[bid] = arr;
  saveAiStore(st);
  return { ok: true, count: arr.length };
}

export function forgetFacts(bid) {
  const st = loadAiStore();
  delete st.facts[bid];
  saveAiStore(st);
  return true;
}

/* ── Prefs ────────────────────────────────────────────────────────── */
export function defaultAiPrefs() {
  return { chatMode: false, lang: 'de' };
}

export function getAiPrefs(bid) {
  const st = loadAiStore();
  return { ...defaultAiPrefs(), ...(st.prefs[bid] || {}) };
}

export function setAiPrefs(bid, patch = {}) {
  const st = loadAiStore();
  const cur = { ...defaultAiPrefs(), ...(st.prefs[bid] || {}) };
  if (patch.chatMode !== undefined) cur.chatMode = !!patch.chatMode;
  if (patch.lang === 'de' || patch.lang === 'en') cur.lang = patch.lang;
  st.prefs[bid] = cur;
  saveAiStore(st);
  return cur;
}

/* ── Stats ────────────────────────────────────────────────────────── */
export function statAiRequest(bid, latencyMs = 0, failed = false) {
  const st = loadAiStore();
  const dk = dayKey();
  if (!st.stats.day || st.stats.day.k !== dk) st.stats.day = { k: dk, req: 0, err: 0, latSum: 0 };
  st.stats.day.req++;
  st.stats.total.req++;
  const u = st.stats.byUser[bid] || { req: 0, day: '', dayReq: 0, err: 0, dayErr: 0, last: 0 };
  if (failed) {
    /* 7.0.2: Fehlversuche zählen NICHT als Nutzung (kein Quota-Verbrauch),
       landen aber in separaten Fehlerzählern (global + pro User). */
    st.stats.day.err++;
    st.stats.total.err++;
    u.err = (u.err || 0) + 1;
    if (u.day !== dk) { u.day = dk; u.dayReq = 0; u.dayErr = 0; }
    u.dayErr = (u.dayErr || 0) + 1;
  } else {
    st.stats.day.latSum += Math.max(0, latencyMs);
    u.req++;
    if (u.day !== dk) { u.day = dk; u.dayReq = 0; u.dayErr = 0; }
    u.dayReq++;
  }
  u.last = Date.now();
  st.stats.byUser[bid] = u;
  const keys = Object.keys(st.stats.byUser);
  if (keys.length > MAX_USERS_STATS) {
    keys.sort((a, b) => (st.stats.byUser[a].last || 0) - (st.stats.byUser[b].last || 0));
    for (const k of keys.slice(0, keys.length - MAX_USERS_STATS)) delete st.stats.byUser[k];
  }
  saveAiStore(st);
  return true;
}

export function getAiUsage(bid) {
  const st = loadAiStore();
  const u = st.stats.byUser[bid] || { req: 0, day: '', dayReq: 0, err: 0, dayErr: 0 };
  const sameDay = u.day === dayKey();
  return {
    today: sameDay ? (u.dayReq || 0) : 0,
    total: u.req || 0,
    errorsToday: sameDay ? (u.dayErr || 0) : 0,
    errorsTotal: u.err || 0
  };
}

export function aiAnalytics() {
  const st = loadAiStore();
  const d = st.stats.day || { req: 0, err: 0, latSum: 0 };
  return {
    today: d.req || 0, errorsToday: d.err || 0,
    avgLatencyMs: d.req ? Math.round((d.latSum || 0) / d.req) : 0,
    total: st.stats.total?.req || 0, errorsTotal: st.stats.total?.err || 0,
    activeUsers: Object.keys(st.stats.byUser || {}).length,
    model: st.config.model, provider: st.config.provider
  };
}

/* ── Löschung ─────────────────────────────────────────────────────── */
export function clearAiUser(bid, { keepPrefs = true } = {}) {
  if (!bid) return false;
  const st = loadAiStore();
  for (const scope of Object.keys(st.conversations)) {
    if (scope === dmScope(bid) || scope.endsWith(':' + bid)) delete st.conversations[scope];
  }
  delete st.facts[bid];
  if (!keepPrefs) delete st.prefs[bid];
  saveAiStore(st);
  return true;
}

/* Unregister: alles Personenbezogene weg (Prefs + Fakten + Convs + User-Stats) */
export function purgeAiUser(bid) {
  if (!bid) return false;
  clearAiUser(bid, { keepPrefs: false });
  const st = loadAiStore();
  if (st.stats.byUser) delete st.stats.byUser[bid];
  saveAiStore(st);
  return true;
}

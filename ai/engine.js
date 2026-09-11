/* ═══════════════════════════════════════════════════════════════════
   💜 LoveBot 7.0 — AI ENGINE (ai/engine.js)

   Zentrale Chat-Orchestrierung:
   Limits → Provider-Health (30 s Cache) → Modell-Check → Memory → ReAct.
   Jobs sind pro User abbrechbar ($aistop). Provider injizierbar (Tests).
   Bei unerreichbarem Provider: sauberes { unavailable } mit klassifiziertem
   Grund (ECONNREFUSED statt „fetch failed“) — kein Fake, kein Absturz.
   7.0.2: diagnoseAi() (für $ai diagnose), Last-Diag (für $ai debug),
   Health-Cache-Invalidierung bei Fehlern, Pipeline-Logging (ohne Inhalte).
   ═══════════════════════════════════════════════════════════════════ */
import { aiConfig, getConversation, pushConversation, getFacts, getAiPrefs, statAiRequest, scopeOf, loadAiStore } from './memory.js';
import { aiLimitCheck, aiLimitConsume } from './limits.js';
import { buildSystemPrompt, runReact } from './context.js';
import { createProvider, classifyNetError } from './providers.js';
import { runTool } from './tools.js';

let provider = null;
let healthCache = { at: 0, res: null };
let lastDiag = { at: 0, ok: false, code: 'never', ms: 0, model: '', endpoint: '' };
const jobs = new Map(); /* bid -> AbortController */

export function setProvider(p) { provider = p; return provider; }
export function getProvider() {
  if (!provider) provider = createProvider('local', aiConfig());
  return provider;
}
export function refreshProvider() {
  const cfg = aiConfig();
  /* Mock bleibt nur erhalten, wenn explizit injiziert (Tests) — nie aus Config. */
  if (!provider || provider.name !== 'mock') provider = createProvider('local', cfg);
  return provider;
}

export async function aiHealth(force = false) {
  const now = Date.now();
  if (!force && healthCache.res && now - healthCache.at < 30000) return healthCache.res;
  let res;
  try {
    res = await getProvider().health();
  } catch (e) {
    res = { ok: false, ms: 0, error: String(e?.message || e).slice(0, 120) };
  }
  healthCache = { at: now, res };
  return res;
}

export function invalidateAiHealth() {
  healthCache = { at: 0, res: null };
}

export function getLastAiDiag() { return { ...lastDiag }; }

function markLast(ok, { code = '', ms = 0, model = '', endpoint = '' } = {}) {
  lastDiag = { at: Date.now(), ok: !!ok, code: String(code || (ok ? 'ok' : 'UNKNOWN')), ms, model, endpoint };
}

function aiLog(...args) {
  try {
    if (process.env.LOVEAI_DEBUG === '1') console.log('[AI]', ...args);
  } catch (e) {}
}

export function startJob(bid) {
  const ctrl = new AbortController();
  jobs.set(bid, ctrl);
  return ctrl;
}
export function endJob(bid) { jobs.delete(bid); }
export function stopJob(bid) {
  const c = jobs.get(bid);
  if (!c) return false;
  try { c.abort(); } catch (e) {}
  jobs.delete(bid);
  return true;
}
export function hasJob(bid) { return jobs.has(bid); }

function diagOf(h, cfg) {
  return {
    code: (h && (h.code || h.error)) || 'UNKNOWN',
    kind: (h && h.kind) || '',
    endpoint: (h && h.endpoint) || '',
    hint: (h && h.hint) || '',
    model: cfg.model || '',
    provider: cfg.provider || 'local'
  };
}

export async function aiChat({ bid = '', gid = '', text = '', profile = null, rank = null, group = null, groupMeta = null, counts = null, externalSignal = null } = {}) {
  const cfg = aiConfig();
  const clean = String(text || '').trim().slice(0, 2000);
  if (!clean) return { ok: false, reason: 'empty' };
  if (!bid) return { ok: false, reason: 'no-user' };

  /* 1) Limits */
  const lim = aiLimitCheck(bid);
  if (!lim.ok) return { ok: false, reason: 'limited', detail: lim.reason, retryMs: lim.retryMs || 0, limit: lim.limit };

  /* 2) Health */
  let h;
  try { h = await aiHealth(); } catch (e) { h = { ok: false, error: String(e?.message || e) }; }
  if (!h || !h.ok) {
    try { statAiRequest(bid, 0, true); } catch (e) {}
    invalidateAiHealth();
    const d = diagOf(h, cfg);
    markLast(false, { code: d.code, ms: (h && h.ms) || 0, model: cfg.model, endpoint: d.endpoint });
    try { console.log('[AI] offline:', d.code, '@' + (d.endpoint || '?')); } catch (e) {}
    return { ok: false, reason: 'unavailable', detail: (h && h.error) || 'provider-unreachable', provider: cfg.provider, model: cfg.model, diag: d };
  }

  /* 2b) Modell installiert? (ready===false nur bei echtem Local-Check) */
  if (h.ready === false) {
    try { statAiRequest(bid, 0, true); } catch (e) {}
    const d = { ...diagOf(h, cfg), code: 'model-not-found', kind: 'model', hint: 'Modell nicht installiert: ' + (cfg.model || '') };
    markLast(false, { code: 'model-not-found', ms: h.ms || 0, model: cfg.model, endpoint: d.endpoint });
    try { console.log('[AI] model-missing:', cfg.model, '@' + (d.endpoint || '?')); } catch (e) {}
    return { ok: false, reason: 'model_missing', detail: 'model-not-found: ' + (cfg.model || ''), provider: cfg.provider, model: cfg.model, diag: d };
  }

  /* 3) Memory laden */
  const scope = scopeOf({ gid, bid });
  let history = [], facts = [], prefs = {};
  try { history = getConversation(scope); } catch (e) {}
  try { facts = getFacts(bid); } catch (e) {}
  try { prefs = getAiPrefs(bid); } catch (e) {}

  /* 4) Job + ReAct */
  const ctrl = startJob(bid);
  if (externalSignal) {
    if (externalSignal.aborted) ctrl.abort();
    else externalSignal.addEventListener('abort', () => { try { ctrl.abort(); } catch (e) {} }, { once: true });
  }
  const t0 = Date.now();
  try {
    const system = buildSystemPrompt({ lang: prefs.lang || 'de', groupName: groupMeta?.subject || group?.subject || '' });
    const toolCtx = {
      bid, profile, rank, group, groupMeta, counts,
      uptimeMs: Math.floor(process.version ? process.uptime() * 1000 : 0),
      ai: { provider: cfg.provider, model: cfg.model }
    };
    const res = await runReact(getProvider(), {
      system, history, facts, userText: clean, toolCtx, cfg, signal: ctrl.signal
    });
    try {
      pushConversation(scope, 'user', clean);
      pushConversation(scope, 'ai', res.text);
    } catch (e) {}
    try { aiLimitConsume(bid); } catch (e) {}
    try { statAiRequest(bid, Date.now() - t0, false); } catch (e) {}
    markLast(true, { code: 'ok', ms: Date.now() - t0, model: cfg.model, endpoint: (h && h.endpoint) || '' });
    aiLog('chat ok:', Date.now() - t0, 'ms, tools:', (res.toolsUsed || []).join(',') || '–');
    return { ok: true, text: res.text, ms: Date.now() - t0, toolsUsed: res.toolsUsed || [], model: cfg.model };
  } catch (e) {
    const ms = Date.now() - t0;
    const msg = String(e?.message || e);
    if (msg.includes('abort') || e?.aiCode === 'aborted') return { ok: false, reason: 'aborted' };
    const cls = e?.aiCode
      ? { code: e.aiCode, kind: e.aiKind || '', hint: e.aiHint || '', retryable: false }
      : classifyNetError(e, cfg.baseUrl);
    try { statAiRequest(bid, ms, true); } catch (e2) {}
    invalidateAiHealth();
    const d = { code: cls.code, kind: cls.kind || '', endpoint: (h && h.endpoint) || '', hint: cls.hint || '', model: cfg.model || '', provider: cfg.provider || 'local' };
    markLast(false, { code: cls.code, ms, model: cfg.model, endpoint: d.endpoint });
    try { console.log('[AI] fail:', cls.code, ms + 'ms', '@' + (d.endpoint || '?')); } catch (e2) {}
    aiLog('chat fail detail:', msg.slice(0, 200));
    if (cls.code === 'model-not-found') {
      return { ok: false, reason: 'model_missing', detail: 'model-not-found: ' + (cfg.model || ''), provider: cfg.provider, model: cfg.model, diag: d };
    }
    if (cls.code === 'timeout') {
      return { ok: false, reason: 'timeout', detail: 'timeout', provider: cfg.provider, model: cfg.model, diag: d };
    }
    return { ok: false, reason: 'unavailable', detail: cls.code, provider: cfg.provider, model: cfg.model, diag: d };
  } finally {
    endJob(bid);
  }
}

/* ── Voll-Diagnose für $ai diagnose (wirft nie, frisst keine Limits) ── */
export async function diagnoseAi() {
  const t0 = Date.now();
  const steps = [];
  const step = (key, label, ok, detail = '') => steps.push({ key, label, ok: !!ok, detail: String(detail || '').slice(0, 200) });
  let cfg = {};
  try { cfg = aiConfig(); } catch (e) {}
  const ep = cfg.baseUrl || '';

  /* 1) Config */
  if (cfg.baseUrl && cfg.model) step('config', 'Konfiguration', true, cfg.provider + ' · ' + cfg.model);
  else step('config', 'Konfiguration', false, 'baseUrl/Modell fehlt');

  /* 2) Provider-Objekt */
  let prov = null;
  try { prov = getProvider(); } catch (e) {}
  step('provider', 'Provider', !!prov, prov ? (prov.name + ' · ' + (prov.model || '')) : 'kein Provider');

  /* 3) Backend (frischer Healthcheck, kein Cache) */
  let h = null;
  try { h = await aiHealth(true); } catch (e) { h = { ok: false, error: String(e?.message || e) }; }
  if (h && h.ok) step('backend', 'Backend', true, (h.endpoint || ep) + ' · ' + (h.ms ?? 0) + ' ms');
  else step('backend', 'Backend', false, ((h && (h.code || h.error)) || 'unreachable') + (h && h.hint ? ' — ' + h.hint : ''));

  /* 4) Modelle */
  const mc = (h && typeof h.modelCount === 'number') ? h.modelCount : -1;
  if (!h || !h.ok) step('models', 'Modelle', false, 'Backend offline');
  else if (mc > 0) step('models', 'Modelle', true, mc + ' installiert');
  else if (mc === 0) step('models', 'Modelle', false, 'kein Modell installiert');
  else step('models', 'Modelle', true, 'unbekannt');

  /* 5) Konfiguriertes Modell */
  if (!h || !h.ok) step('model', 'Konfiguriertes Modell', false, 'Backend offline');
  else if (h.modelFound !== false) step('model', 'Konfiguriertes Modell', true, cfg.model || '');
  else step('model', 'Konfiguriertes Modell', false, (cfg.model || '') + ' fehlt');

  /* 6) Generierung (Mini-Probe, ohne Memory/Limits/Stats) */
  if (!h || !h.ok || h.modelFound === false || !prov) {
    step('generation', 'Generierung', false, 'übersprungen (Backend/Modell fehlt)');
  } else {
    try {
      const g = await prov.generate('Antworte nur mit: OK', { maxTokens: 8, temperature: 0, timeoutMs: 45000 });
      if (g && g.text && g.text.trim()) step('generation', 'Generierung', true, (g.ms ?? 0) + ' ms');
      else step('generation', 'Generierung', false, 'leere Antwort');
    } catch (e) {
      step('generation', 'Generierung', false, String(e?.aiCode || e?.message || e).slice(0, 120));
    }
  }

  /* 7) Memory */
  try {
    const st = loadAiStore();
    const nc = Object.keys(st.conversations || {}).length;
    const nf = Object.keys(st.facts || {}).length;
    step('memory', 'Memory', true, nc + ' Chats · ' + nf + ' Faktensets');
  } catch (e) {
    step('memory', 'Memory', false, 'ai.json nicht lesbar');
  }

  /* 8) Tools */
  try {
    const tr = runTool('getBotStatus', {}, {});
    step('tools', 'Tools', !!tr.ok, tr.ok ? 'read-only OK' : ('Fehler: ' + (tr.error || '')));
  } catch (e) {
    step('tools', 'Tools', false, 'Tool-Layer Fehler');
  }

  const ready = steps.every((s) => s.ok);
  return { steps, ready, overall: ready ? 'READY' : 'NOT READY', ms: Date.now() - t0, endpoint: ep, model: cfg.model || '', provider: cfg.provider || 'local' };
}

/* Für Tests: Caches zurücksetzen */
export function _resetAiEngine() {
  healthCache = { at: 0, res: null };
  lastDiag = { at: 0, ok: false, code: 'never', ms: 0, model: '', endpoint: '' };
  jobs.clear();
}

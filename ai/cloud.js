/* ═══════════════════════════════════════════════════════════════════
   ☁️ LoveBot 7.1 — CLOUD-KI (ai/cloud.js)

   ECHTE KI wie ChatGPT/Meta AI — über kostenlose Cloud-LLMs mit
   OpenAI-kompatibler API. Der Provider steckt in der Chain:
        Ollama 🦙 → Cloud-KI ☁️ → LoveAI Core 💜

   Kostenlose Anbieter (alle gratis, ohne Kreditkarte):
     · Groq        console.groq.com        → Llama 3.3 70B, sehr schnell
     · Google      aistudio.google.com     → Gemini Flash
     · OpenRouter  openrouter.ai           → kostenlose Modelle (:free)
     · Mistral     console.mistral.ai      → Mistral Small
     · Cerebras    cloud.cerebras.ai       → Llama, blitzschnell
     · Pollinations (ohne Key, best effort)
     · Custom      jeder OpenAI-kompatible Server (z. B. LM Studio)

   Setup: $aiconfig key <API-KEY>  — Anbieter wird am Key erkannt
   (gsk_→Groq · AIza→Gemini · sk-or-→OpenRouter · csk-→Cerebras).
   ═══════════════════════════════════════════════════════════════════ */

import { parsePrompt } from './core.js';
import { classifyNetError, classifyHttpStatus } from './providers.js';

/* ── Presets: Anbieter-Empfehlungen ────────────────────────────────── */
export const CLOUD_PRESETS = {
  groq: {
    label: 'Groq', signup: 'console.groq.com',
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    model: 'llama-3.3-70b-versatile'
  },
  gemini: {
    label: 'Google Gemini', signup: 'aistudio.google.com',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    model: 'gemini-2.5-flash'
  },
  openrouter: {
    label: 'OpenRouter', signup: 'openrouter.ai',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    model: 'meta-llama/llama-3.3-70b-instruct:free'
  },
  mistral: {
    label: 'Mistral AI', signup: 'console.mistral.ai',
    endpoint: 'https://api.mistral.ai/v1/chat/completions',
    model: 'mistral-small-latest'
  },
  cerebras: {
    label: 'Cerebras', signup: 'cloud.cerebras.ai',
    endpoint: 'https://api.cerebras.ai/v1/chat/completions',
    model: 'llama-3.3-70b'
  },
  pollinations: {
    label: 'Pollinations (ohne Key)', signup: 'text.pollinations.ai',
    endpoint: 'https://text.pollinations.ai',
    model: 'openai-fast', noKey: true
  },
  custom: {
    label: 'Eigener Server', signup: '',
    endpoint: '', model: ''
  }
};

/* Key-Präfix → Anbieter (für „$aiconfig key …“ Auto-Erkennung) */
export function detectCloudProvider(key = '') {
  const k = String(key || '').trim();
  if (/^gsk_[A-Za-z0-9]{20,}/.test(k)) return 'groq';
  if (/^AIza[A-Za-z0-9_-]{30,}/.test(k)) return 'gemini';
  if (/^sk-or-v1-[A-Za-z0-9]{20,}/.test(k)) return 'openrouter';
  if (/^csk-[A-Za-z0-9]{20,}/.test(k)) return 'cerebras';
  if (/^[A-Za-z0-9]{32}$/.test(k)) return 'mistral';
  return '';
}

function cloudErr(code, kind, hint, extra = {}) {
  const e = new Error(code);
  e.aiCode = code;
  e.aiKind = kind;
  e.aiHint = hint;
  Object.assign(e, extra);
  return e;
}

/* Prompt → OpenAI-Messages (System · Fakten · Verlauf · User · Tools) */
function promptToMessages(prompt) {
  const p = String(prompt || '');
  const pr = parsePrompt(p);
  /* System = erster \n\n-Block (buildPrompt setzt den Systemtext an den Anfang) */
  const system = p.split('\n\n')[0] || '';
  const msgs = [{ role: 'system', content: system }];
  /* Verlauf: „User: …“ / „LoveAI: …“ Zeilen aus dem Verlauf-Block */
  const vm = p.match(/Verlauf:\n([\s\S]*?)(?=\n\n[A-Z]|\n\nUser:|$)/);
  if (vm) {
    for (const ln of vm[1].split('\n')) {
      const m = ln.match(/^(User|LoveAI): (.*)$/);
      if (m && m[2].trim()) msgs.push({ role: m[1] === 'LoveAI' ? 'assistant' : 'user', content: m[2] });
    }
  }
  /* User-Nachricht + (ReAct-Runde 2) Tool-Ergebnisse */
  let content = pr.user || '';
  if (pr.toolResults && pr.toolResults.length) {
    content += '\n\n' + pr.toolResults.map((t) => `TOOL-RESULT ${t.name}: ${JSON.stringify(t.data)}`).join('\n') +
      '\n\n(Antworte jetzt final dem User mit den echten Tool-Daten.)';
  }
  msgs.push({ role: 'user', content: content || 'Hallo' });
  return msgs;
}

/* ── CloudProvider ────────────────────────────────────────────────── */
export class CloudProvider {
  constructor(cfg = {}) {
    this.name = 'cloud';
    this.cfg = cfg;
    this.timeoutMs = Number(cfg.timeoutMs) || 60000;
    this.maxTokens = Number(cfg.maxTokens) || 900;
    this.temperature = cfg.temperature ?? 0.7;
    this._hCache = { at: 0, res: null };
  }

  /* Aktive Konfiguration auflösen (Preset + eigene Werte) */
  _resolve() {
    const c = this.cfg || {};
    const key = String(c.cloudKey || '').trim();
    let prov = String(c.cloudProvider || 'auto').toLowerCase();
    if (prov === 'auto' || !CLOUD_PRESETS[prov]) {
      prov = key ? (detectCloudProvider(key) || 'groq') : 'pollinations';
    }
    const preset = CLOUD_PRESETS[prov] || CLOUD_PRESETS.pollinations;
    return {
      provider: prov,
      label: preset.label,
      endpoint: String(c.cloudEndpoint || preset.endpoint || '').trim(),
      model: String(c.cloudModel || preset.model || '').trim(),
      key,
      on: c.cloudOn !== false,
      noKey: !!preset.noKey,
      configured: !!String(c.cloudEndpoint || preset.endpoint || '').trim() && (preset.noKey || !!key)
    };
  }

  async chat(messages, opts = {}) {
    const r = this._resolve();
    if (!r.on) throw cloudErr('cloud-off', 'config', 'Cloud-KI ist deaktiviert ($aiconfig cloud on).');
    if (!r.configured) throw cloudErr('cloud-not-configured', 'config', 'Kein API-Key gesetzt ($aiconfig key <KEY>).');
    const t0 = Date.now();
    const timeoutMs = opts.timeoutMs || this.timeoutMs;

    /* Pollinations (ohne Key): GET-Endpoint, Prompt als Pfad */
    if (r.provider === 'pollinations' && !r.key) {
      const flat = messages.map((m) => (m.role === 'system' ? 'Anweisungen: ' : (m.role === 'assistant' ? 'LoveAI: ' : 'User: ')) + m.content).join('\n\n');
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        const res = await fetch(r.endpoint + '/' + encodeURIComponent(flat.slice(0, 3500)), {
          signal: ctrl.signal, headers: { 'User-Agent': 'LoveBot/7.1' }
        });
        if (!res.ok) throw cloudErr(classifyHttpStatus(res.status).code, classifyHttpStatus(res.status).kind, classifyHttpStatus(res.status).hint, { httpStatus: res.status });
        let text = (await res.text()).trim();
        if (/api key used for this request has reached its budget/i.test(text)) {
          throw cloudErr('rate-limited', 'ratelimit', 'Gratis-Kontingent von Pollinations ist aufgebraucht.');
        }
        if (!text) throw cloudErr('empty-response', 'protocol', 'Cloud-KI lieferte eine leere Antwort.');
        return { text, ms: Date.now() - t0, model: r.model || 'pollinations', engine: 'cloud', provider: r.provider };
      } catch (e) {
        if (e && e.aiCode) throw e;
        if (ctrl.signal.aborted) throw cloudErr('timeout', 'timeout', 'Cloud-KI antwortet nicht (Timeout).');
        const cls = classifyNetError(e, r.endpoint);
        throw cloudErr(cls.code, cls.kind, cls.hint, { aiHost: cls.host, aiPort: cls.port });
      } finally { clearTimeout(t); }
    }

    /* Alle OpenAI-kompatiblen Anbieter: POST /chat/completions */
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const body = {
        model: opts.model || r.model,
        messages,
        temperature: opts.temperature ?? this.temperature,
        max_tokens: opts.maxTokens || this.maxTokens
      };
      const headers = { 'Content-Type': 'application/json' };
      if (r.key) headers.Authorization = 'Bearer ' + r.key;
      const res = await fetch(r.endpoint, { method: 'POST', headers, body: JSON.stringify(body), signal: ctrl.signal });
      if (!res.ok) {
        let derr = '';
        try { const j = await res.json(); derr = j?.error?.message || j?.error || ''; } catch (e) {}
        const cls = classifyHttpStatus(res.status, derr);
        throw cloudErr(cls.code, cls.kind, cls.hint || String(derr).slice(0, 160), { httpStatus: res.status });
      }
      let data;
      try { data = await res.json(); } catch (e) { throw cloudErr('INVALID_JSON', 'protocol', 'Cloud-KI lieferte kein gültiges JSON.'); }
      const text = String(data?.choices?.[0]?.message?.content || '').trim();
      if (!text) throw cloudErr('empty-response', 'protocol', 'Cloud-KI lieferte eine leere Antwort.');
      return { text, ms: Date.now() - t0, model: data.model || r.model, engine: 'cloud', provider: r.provider };
    } catch (e) {
      if (e && e.aiCode) throw e;
      if (ctrl.signal.aborted) throw cloudErr('timeout', 'timeout', 'Cloud-KI antwortet nicht (Timeout).');
      const cls = classifyNetError(e, r.endpoint);
      throw cloudErr(cls.code, cls.kind, cls.hint, { aiHost: cls.host, aiPort: cls.port });
    } finally { clearTimeout(t); }
  }

  /* Standard-Einstieg: kompletter buildPrompt → Messages → Cloud-KI */
  async generate(prompt, opts = {}) {
    const msgs = promptToMessages(prompt);
    return this.chat(msgs, opts);
  }

  /* Streaming (Interface-Kompatibilität: ein Chunk reicht) */
  async stream(prompt, opts = {}, onChunk = null, signal = null) {
    const r = await this.generate(prompt, { ...opts, signal });
    if (onChunk) { try { onChunk(r.text); } catch (e) {} }
    return r;
  }

  /* Health: Mini-Testanfrage (60-s-Cache) */
  async health() {
    const now = Date.now();
    if (this._hCache.res && now - this._hCache.at < 60000) return this._hCache.res;
    const r = this._resolve();
    let res;
    if (!r.on) {
      res = { ok: false, code: 'cloud-off', hint: 'Cloud-KI deaktiviert' };
    } else if (!r.configured) {
      res = { ok: false, code: 'cloud-not-configured', hint: 'Kein API-Key' };
    } else {
      try {
        const g = await this.chat([{ role: 'user', content: 'Antworte nur mit: OK' }], { maxTokens: 16, temperature: 0, timeoutMs: 25000 });
        res = {
          ok: true, ready: true, ms: g.ms, engine: 'cloud', engineLabel: 'Cloud-KI ☁️',
          cloud: r.provider, cloudLabel: r.label, model: g.model, endpoint: r.endpoint, modelCount: 1, modelFound: true
        };
      } catch (e) {
        res = {
          ok: false, ms: 0, engine: 'cloud', code: e?.aiCode || 'unreachable',
          hint: e?.aiHint || '', cloud: r.provider, cloudLabel: r.label, model: r.model, endpoint: r.endpoint
        };
      }
    }
    this._hCache = { at: now, res };
    return res;
  }

  async models() {
    const r = this._resolve();
    return [{ name: r.model || 'cloud', provider: r.provider }];
  }
}

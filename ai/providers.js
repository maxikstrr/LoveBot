/* ═══════════════════════════════════════════════════════════════════
   💜 LoveBot 7.0 — AI PROVIDERS (ai/providers.js)

   Provider-Abstraction: JEDER Provider implementiert
   · generate(prompt, opts) → { text, ms, model? }
   · stream(prompt, opts, onChunk, signal) → { text, ms }
   · chat(messages, opts) → { text, ms }
   · health() → { ok, ms, error?, code?, endpoint?, models?, modelFound?, ready? }
   · models() → [{ name, size? }]

   · LocalProvider: Ollama (/api/generate, /api/chat, /api/tags) — kostenlos,
     lokal, konfigurierbar (Modell, URL, Timeout, Streaming).
     7.0.2: klassifizierte Fehler (ECONNREFUSED statt „fetch failed“),
     max. 1 Retry nur bei transienten Fehlern, Modell-Check in health(),
     leere Antworten = Fehler (kein Fake-Erfolg).
   · MockProvider: deterministisch, NUR für Tests (createProvider verweigert
     'mock' ohne LOVEAI_ALLOW_MOCK=1 — nie versehentlich in Produktion).
   ═══════════════════════════════════════════════════════════════════ */

/* ── Fehler-Klassifizierung (statt „fetch failed“) ─────────────────── */
export function shortEndpoint(baseUrl = '') {
  try {
    const u = new URL(String(baseUrl));
    return u.hostname + (u.port ? ':' + u.port : '');
  } catch (e) { return String(baseUrl || '–'); }
}

export function classifyNetError(e, baseUrl = '') {
  const msg = String(e?.message || e || '');
  if (e?.name === 'AbortError' || msg === 'aborted' || /abort/i.test(msg)) {
    return { code: 'aborted', kind: 'abort', retryable: false, host: '', port: '', hint: 'Anfrage abgebrochen.' };
  }
  const cause = (e && e.cause && typeof e.cause === 'object') ? e.cause : {};
  const code = String(cause.code || e?.code || '');
  const msgAll = msg + ' ' + String(cause.message || '');
  /* Undici-Codes (Node-fetch): Socket/Timeouts sind transient → 1 Retry. */
  const und = {
    UND_ERR_SOCKET: ['reset', 'Backend hat die Verbindung abgebrochen.', true],
    UND_ERR_CONNECT_TIMEOUT: ['timeout', 'Verbindungstimeout.', true],
    UND_ERR_HEADERS_TIMEOUT: ['timeout', 'Backend antwortet nicht (Header-Timeout).', true],
    UND_ERR_BODY_TIMEOUT: ['timeout', 'Backend antwortet nicht (Body-Timeout).', true]
  };
  if (und[code]) {
    const [kind, hint, retryable] = und[code];
    return { code, kind, host: '', port: '', retryable, hint };
  }
  const host = String(cause.address || '');
  const port = cause.port !== undefined && cause.port !== null ? String(cause.port) : '';
  const map = {
    ECONNREFUSED: ['refused', 'Backend läuft nicht oder Port geschlossen.', false],
    ENOTFOUND: ['dns', 'Host nicht gefunden.', false],
    EAI_AGAIN: ['dns', 'DNS-Auflösung fehlgeschlagen.', true],
    ETIMEDOUT: ['timeout', 'Verbindungstimeout.', true],
    ECONNRESET: ['reset', 'Verbindung zurückgesetzt.', true],
    EPIPE: ['reset', 'Verbindung abgebrochen (EPIPE).', true],
    EHOSTUNREACH: ['unreachable', 'Host nicht erreichbar.', false],
    ENETUNREACH: ['unreachable', 'Netzwerk nicht erreichbar.', false]
  };
  if (map[code]) {
    const [kind, hint, retryable] = map[code];
    return { code, kind, host, port, retryable, hint };
  }
  if (/socket hang up|other side closed/i.test(msgAll)) {
    return { code: 'SOCKET_HANGUP', kind: 'reset', host, port, retryable: true, hint: 'Backend hat die Verbindung abgebrochen.' };
  }
  if (/invalid json|unexpected token|not valid json/i.test(msg)) {
    return { code: 'INVALID_JSON', kind: 'protocol', host, port, retryable: false, hint: 'Backend lieferte kein gültiges JSON.' };
  }
  if (/fetch failed/i.test(msg)) {
    return { code: 'FETCH_FAILED', kind: 'network', host, port, retryable: false, hint: 'Netzwerkfehler zum Backend.' };
  }
  return { code: code || 'UNKNOWN', kind: 'unknown', host, port, retryable: false, hint: 'Unbekannter Netzwerkfehler.' };
}

export function classifyHttpStatus(status, ollamaError = '') {
  const s = Number(status);
  const oe = String(ollamaError || '').slice(0, 160);
  if (s === 404) return { code: 'model-not-found', kind: 'model', retryable: false, hint: oe || 'Modell nicht gefunden (404).' };
  if (s === 401 || s === 403) return { code: 'denied', kind: 'auth', retryable: false, hint: 'Zugriff verweigert (' + s + ').' };
  if (s === 408 || s === 504) return { code: 'timeout', kind: 'timeout', retryable: true, hint: 'Backend-Timeout (' + s + ').' };
  if (s === 429) return { code: 'rate-limited', kind: 'ratelimit', retryable: true, hint: 'Backend überlastet (429).' };
  if (s === 502 || s === 503) return { code: 'backend-error', kind: 'backend', retryable: true, hint: 'Backend-Fehler (' + s + ').' };
  if (s >= 500) return { code: 'backend-error', kind: 'backend', retryable: false, hint: 'Backend-Fehler (' + s + ').' };
  if (s >= 400) return { code: 'http-' + s, kind: 'http', retryable: false, hint: 'HTTP-Fehler ' + s + '.' };
  return { code: 'http-' + s, kind: 'http', retryable: false, hint: 'HTTP ' + s + '.' };
}

function aiError(code, kind, hint, extra = {}) {
  const e = new Error(code);
  e.aiCode = code;
  e.aiKind = kind;
  e.aiHint = hint;
  Object.assign(e, extra);
  return e;
}

/* Passt das konfigurierte Modell zu einem installierten?
   Exakt ODER Ollama-Auflösung (ohne Tag → :latest, Basisname gleich). */
export function modelMatches(configured = '', installed = '') {
  const c = String(configured || '').trim().toLowerCase();
  const i = String(installed || '').trim().toLowerCase();
  if (!c || !i) return false;
  if (c === i) return true;
  const cb = c.includes(':') ? c : c + ':latest';
  if (cb === i) return true;
  return c.split(':')[0] === i.split(':')[0] && (c.split(':')[1] || 'latest') === (i.split(':')[1] || 'latest');
}

/* ── Ollama (lokal) ───────────────────────────────────────────────── */
export class LocalProvider {
  constructor(cfg = {}) {
    this.name = 'local';
    this.baseUrl = String(cfg.baseUrl || 'http://127.0.0.1:11434').replace(/\/$/, '');
    this.model = String(cfg.model || 'llama3.1:8b');
    this.timeoutMs = Number(cfg.timeoutMs) || 60000;
    this.maxTokens = Number(cfg.maxTokens) || 512;
    this.temperature = cfg.temperature ?? 0.7;
  }

  /* Max. 1 Retry (300 ms), nur bei transienten Fehlern. */
  async _post(path, body, { timeoutMs = 0, signal = null, retry = true } = {}) {
    let lastErr = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      if (signal?.aborted) throw aiError('aborted', 'abort', 'Anfrage abgebrochen.');
      const ctrl = new AbortController();
      let timedOut = false;
      const t = setTimeout(() => { timedOut = true; ctrl.abort(); }, timeoutMs || this.timeoutMs);
      const onExt = () => { try { ctrl.abort(); } catch (e) {} };
      if (signal) {
        if (signal.aborted) { clearTimeout(t); throw aiError('aborted', 'abort', 'Anfrage abgebrochen.'); }
        signal.addEventListener('abort', onExt, { once: true });
      }
      try {
        const res = await fetch(this.baseUrl + path, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: ctrl.signal
        });
        if (!res.ok) {
          let oerr = '';
          try {
            const txt = await res.text();
            try { oerr = JSON.parse(txt).error || ''; } catch (e) { oerr = txt.slice(0, 160); }
          } catch (e) {}
          const cls = classifyHttpStatus(res.status, oerr);
          const err = aiError(cls.code, cls.kind, cls.hint, { httpStatus: res.status });
          if (retry && attempt === 0 && cls.retryable && !signal?.aborted) {
            lastErr = err;
            await new Promise((r) => setTimeout(r, 300));
            continue;
          }
          throw err;
        }
        return res;
      } catch (e) {
        if (e && e.aiCode) throw e;
        if (timedOut && !signal?.aborted) {
          throw aiError('timeout', 'timeout', 'Backend antwortet nicht (Timeout).');
        }
        if (ctrl.signal.aborted && signal?.aborted) {
          throw aiError('aborted', 'abort', 'Anfrage abgebrochen.');
        }
        const cls = classifyNetError(e, this.baseUrl);
        const err = aiError(cls.code, cls.kind, cls.hint, { aiHost: cls.host, aiPort: cls.port });
        if (retry && attempt === 0 && cls.retryable && !signal?.aborted) {
          lastErr = err;
          await new Promise((r) => setTimeout(r, 300));
          continue;
        }
        throw err;
      } finally {
        clearTimeout(t);
        if (signal) { try { signal.removeEventListener('abort', onExt); } catch (e) {} }
      }
    }
    throw lastErr || aiError('UNKNOWN', 'unknown', 'Unbekannter Fehler.');
  }

  _needText(text) {
    const t = String(text || '');
    if (!t.trim()) throw aiError('empty-response', 'protocol', 'Backend lieferte eine leere Antwort.');
    return t;
  }

  async generate(prompt, opts = {}) {
    const t0 = Date.now();
    const res = await this._post('/api/generate', {
      model: opts.model || this.model,
      prompt: String(prompt || ''),
      stream: false,
      options: { temperature: opts.temperature ?? this.temperature, num_predict: opts.maxTokens || this.maxTokens }
    }, opts);
    let data;
    try {
      data = await res.json();
    } catch (e) {
      throw aiError('INVALID_JSON', 'protocol', 'Backend lieferte kein gültiges JSON.');
    }
    const text = this._needText(data.response);
    return { text, ms: Date.now() - t0, model: data.model || this.model };
  }

  /* Streaming: NDJSON-Chunks; sammelt intern, ruft onChunk pro Teil. */
  async stream(prompt, opts = {}, onChunk = null, signal = null) {
    const t0 = Date.now();
    const res = await this._post('/api/generate', {
      model: opts.model || this.model,
      prompt: String(prompt || ''),
      stream: true,
      options: { temperature: opts.temperature ?? this.temperature, num_predict: opts.maxTokens || this.maxTokens }
    }, { ...opts, signal });
    let text = '';
    let buf = '';
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    for (;;) {
      if (signal?.aborted) { try { reader.cancel(); } catch (e) {} throw aiError('aborted', 'abort', 'Anfrage abgebrochen.'); }
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const ln of lines) {
        if (!ln.trim()) continue;
        try {
          const obj = JSON.parse(ln);
          if (obj.response) {
            text += obj.response;
            if (onChunk) { try { onChunk(obj.response, text); } catch (e) {} }
          }
          if (obj.done) break;
        } catch (e) {}
      }
    }
    this._needText(text);
    return { text, ms: Date.now() - t0, model: this.model };
  }

  async chat(messages, opts = {}) {
    const t0 = Date.now();
    const res = await this._post('/api/chat', {
      model: opts.model || this.model,
      stream: false,
      messages: (messages || []).map((m) => ({ role: m.role === 'ai' ? 'assistant' : m.role, content: String(m.text ?? m.content ?? '') })),
      options: { temperature: opts.temperature ?? this.temperature, num_predict: opts.maxTokens || this.maxTokens }
    }, opts);
    let data;
    try {
      data = await res.json();
    } catch (e) {
      throw aiError('INVALID_JSON', 'protocol', 'Backend lieferte kein gültiges JSON.');
    }
    const text = this._needText(data.message?.content);
    return { text, ms: Date.now() - t0, model: data.model || this.model };
  }

  /* ok = Backend erreichbar + gültige Antwort.
     ready = ok UND konfiguriertes Modell installiert (erst dann ist AI nutzbar). */
  async health() {
    const t0 = Date.now();
    const endpoint = shortEndpoint(this.baseUrl);
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), Math.min(8000, this.timeoutMs));
      try {
        const res = await fetch(this.baseUrl + '/api/tags', { signal: ctrl.signal });
        if (!res.ok) {
          /* 404 bei /api/tags = falsche baseUrl (nicht „Modell fehlt“). */
          const cls = res.status === 404
            ? { code: 'bad-endpoint', kind: 'endpoint', hint: 'Falscher Endpoint (404 bei /api/tags) — baseUrl prüfen.' }
            : classifyHttpStatus(res.status, '');
          return { ok: false, ms: Date.now() - t0, error: cls.code, code: cls.code, kind: cls.kind, endpoint, hint: cls.hint, models: [], modelCount: 0, model: this.model, modelFound: false, ready: false };
        }
        let data;
        try {
          data = await res.json();
        } catch (e) {
          return { ok: false, ms: Date.now() - t0, error: 'INVALID_JSON', code: 'INVALID_JSON', kind: 'protocol', endpoint, hint: 'Backend lieferte kein gültiges JSON.', models: [], modelCount: 0, model: this.model, modelFound: false, ready: false };
        }
        const models = (data.models || []).map((m) => m.name).filter(Boolean);
        const found = models.some((n) => modelMatches(this.model, n));
        return {
          ok: true, ms: Date.now() - t0, error: '', code: null, endpoint,
          models, modelCount: models.length, model: this.model, modelFound: found, ready: found,
          hint: found ? '' : 'Modell nicht installiert: ' + this.model
        };
      } finally {
        clearTimeout(t);
      }
    } catch (e) {
      const cls = classifyNetError(e, this.baseUrl);
      return { ok: false, ms: Date.now() - t0, error: cls.code, code: cls.code, kind: cls.kind, host: cls.host, port: cls.port, endpoint, hint: cls.hint, models: [], modelCount: 0, model: this.model, modelFound: false, ready: false };
    }
  }

  async models() {
    try {
      const res = await fetch(this.baseUrl + '/api/tags', { signal: AbortSignal.timeout(8000) });
      if (!res.ok) return [];
      const data = await res.json();
      return (data.models || []).map((m) => ({ name: m.name, size: m.size || 0 }));
    } catch (e) { return []; }
  }
}

/* ── Mock (deterministisch, NUR für Tests) ────────────────────────── */
export class MockProvider {
  constructor(script = []) {
    this.name = 'mock';
    this.model = 'mock-7.0';
    this.timeoutMs = 5000;
    this._script = Array.isArray(script) ? [...script] : [];
    this.calls = [];
  }
  queue(text) { this._script.push(text); return this; }
  _next(prompt) {
    this.calls.push(String(prompt).slice(0, 200));
    if (this._script.length) return this._script.shift();
    return 'Mock-Antwort auf: ' + String(prompt).slice(-80);
  }
  async generate(prompt, _opts = {}) {
    const t0 = Date.now();
    await new Promise((r) => setTimeout(r, 5));
    if (_opts.signal?.aborted) throw new Error('aborted');
    return { text: this._next(prompt), ms: Date.now() - t0, model: this.model };
  }
  async stream(prompt, opts = {}, onChunk = null, signal = null) {
    const t0 = Date.now();
    const full = this._next(prompt);
    const parts = full.match(/.{1,20}/gs) || [full];
    let text = '';
    for (const p of parts) {
      if (signal?.aborted || opts.signal?.aborted) throw new Error('aborted');
      await new Promise((r) => setTimeout(r, 1));
      text += p;
      if (onChunk) { try { onChunk(p, text); } catch (e) {} }
    }
    return { text, ms: Date.now() - t0, model: this.model };
  }
  async chat(messages, opts = {}) {
    const last = (messages || []).filter((m) => m.role === 'user').pop();
    return this.generate(last ? (last.text ?? last.content ?? '') : '', opts);
  }
  async health() {
    return { ok: true, ms: 1, mock: true, error: '', code: null, endpoint: 'mock', models: ['mock-7.0'], modelCount: 1, model: this.model, modelFound: true, ready: true };
  }
  async models() { return [{ name: 'mock-7.0', size: 0 }]; }
}

export function createProvider(kind = 'local', cfg = {}, script = []) {
  /* Mock nur mit explizitem Test-Flag — nie versehentlich in Produktion. */
  if (kind === 'mock' && process.env.LOVEAI_ALLOW_MOCK === '1') return new MockProvider(script);
  return new LocalProvider(cfg);
}

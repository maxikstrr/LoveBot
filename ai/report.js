/* ═══════════════════════════════════════════════════════════════════
   💜 LoveBot 7.0.2 — AI REPORT (ai/report.js)

   Reine Text-Builder für $aistatus / $ai diagnose / $ai debug / AI-Fehler.
   Absichtlich ohne WhatsApp-Abhängigkeit: direkt unit-testbar, Love.js
   schickt nur noch das Ergebnis. Keine Secrets, keine Stacktraces an User.
   ═══════════════════════════════════════════════════════════════════ */
import { shortEndpoint } from './providers.js';

export function aiEndpoint(cfg = {}, h = null) {
  return (h && h.endpoint) || shortEndpoint(cfg.baseUrl || '');
}

/* ── $aistatus ────────────────────────────────────────────────────── */
export function buildAiStatusText({ cfg = {}, h = {}, an = {}, pref = '$' } = {}) {
  const online = !!h.ok;
  const ep = aiEndpoint(cfg, h);
  const lat = online ? (h.ms ?? 0) + ' ms' : '–';
  const conn = online ? '✅ OK' : ('❌ Fehlgeschlagen (' + (h.code || h.error || 'unbekannt') + ')');
  const mc = typeof h.modelCount === 'number' ? h.modelCount : -1;
  const modelsLn = !online ? '–' : (mc >= 0 ? '*' + mc + ' installiert*' : '*?*');
  const modelMark = !online ? '' : (h.modelFound === false ? ' ⚠️ *nicht installiert*' : ' ✅');
  const errLn = (!online && h.hint) ? h.hint + '\n' : '';
  return `> 🤖 *LOVEAI STATUS*

Provider: *${cfg.provider === 'mock' ? 'Mock (Test)' : 'Local'}*
Endpoint: *${ep}*
Status: ${online ? '🟢 ONLINE' : '🔴 OFFLINE'}
Verbindung: ${conn}
Modelle: ${modelsLn}
Modell: *${cfg.model || '–'}*${modelMark}
Latenz: ${lat}
Anfragen heute: ${an.today || 0} (${an.errorsToday || 0} Fehler)

${errLn}${online ? (h.modelFound === false ? `Modell fehlt — prüfe *${pref}ai diagnose*.` : `Sag einfach: *${pref}ai …* 💜`) : `Backend starten, dann *${pref}ai diagnose*.`}`;
}

/* ── $ai diagnose ─────────────────────────────────────────────────── */
export function buildAiDiagnoseText(diag = {}, pref = '$') {
  const steps = Array.isArray(diag.steps) ? diag.steps : [];
  const lines = steps.map((s) => `${s.ok ? '✅' : '❌'} ${s.label}${s.detail ? ` — ${s.detail}` : ''}`);
  const firstBad = steps.find((s) => !s.ok);
  const hint = diag.ready
    ? 'Alles bereit — frag einfach drauflos. 💜'
    : (firstBad
      ? `Problem bei: *${firstBad.label}* (${firstBad.detail || '?'}) — Details: *${pref}aistatus*.`
      : 'Unbekannter Zustand — prüfe das Backend.');
  return `> 🤖 *LOVEAI DIAGNOSE*

${lines.join('\n')}

Gesamt: ${diag.ready ? '🟢 *READY*' : '🔴 *NOT READY*'} (${diag.ms ?? 0} ms)

${hint}`;
}

/* ── $ai debug (Owner) ────────────────────────────────────────────── */
export function buildAiDebugText({ cfg = {}, h = {}, last = {}, an = {}, pref = '$' } = {}) {
  const ep = aiEndpoint(cfg, h);
  const lastLn = !last.at
    ? '– (noch keine Anfrage)'
    : `${last.ok ? '✅ OK' : '❌ ' + (last.code || '?')} · ${last.ms ?? 0} ms · ${last.model || ''}`;
  return `> 🤖 *LOVEAI DEBUG* (Owner)

Provider: *${cfg.provider || 'local'}*
Endpoint: *${ep}*
Modell: *${cfg.model || '–'}*
Backend: ${h.ok ? '🟢 erreichbar' : '🔴 ' + (h.code || h.error || 'offline')} (${h.ms ?? 0} ms)
Modelle: ${typeof h.modelCount === 'number' ? h.modelCount : '?'} · konfiguriert: ${h.modelFound === false ? '❌ fehlt' : '✅ da'}
Letzter Call: ${lastLn}
Heute: ${an.today || 0} Anfragen · ${an.errorsToday || 0} Fehler · Ø ${an.avgLatencyMs || 0} ms
Limits: ${cfg.perMin || 6}/min · ${cfg.perHour || 60}/h · ${cfg.perDay || 200}/Tag

Trace-Logs: LOVEAI_DEBUG=1 · Details: *${pref}ai diagnose*`;
}

/* ── AI-Fehlermeldung für $ai/$ask ────────────────────────────────── */
export function buildAiErrorText(res = {}, cfg = {}, pref = '$') {
  const ep = aiEndpoint(cfg, res.diag);
  const code = res.diag?.code || res.detail || 'unbekannt';
  const hint = res.diag?.hint || '';
  if (res.reason === 'model_missing') {
    return `> 🤖 *LoveAI*

🟡 Backend erreichbar — 🔴 *Modell nicht verfügbar*

Modell: *${cfg.model || res.model || '–'}*
Endpoint: ${ep}

Bitte installiere/wähle ein lokales Modell, dann *${pref}ai diagnose*.`;
  }
  if (res.reason === 'timeout') {
    return `> 🤖 *LoveAI*

🔴 *Backend antwortet nicht (Timeout)*

Endpoint: ${ep}
Modell: *${cfg.model || res.model || '–'}*

Später erneut versuchen oder *${pref}ai diagnose*. Der Rest des Bots läuft normal weiter. 💜`;
  }
  return `> 🤖 *LoveAI*

🔴 *Backend offline* — der lokale AI-Dienst ist gerade nicht erreichbar.

Provider: Local
Endpoint: ${ep}
Fehler: *${code}*${hint ? `\n${hint}` : ''}

Prüfe *${pref}aistatus*. Der Rest des Bots läuft normal weiter. 💜`;
}

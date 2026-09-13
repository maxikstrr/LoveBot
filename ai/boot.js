/* ═══════════════════════════════════════════════════════════════════
   💜 LoveAI BOOT (ai/boot.js) — AI startet MIT dem Web/Bot

   bootAi() wird beim Start von server.js (Web) UND Love.js (Bot)
   aufgerufen und sorgt dafür, dass LoveAI IMMER verfügbar ist:

     1. Versucht, Ollama automatisch zu starten (falls installiert:
        „ollama serve" im Hintergrund). Nicht installiert → egal.
     2. Macht einen frischen Healthcheck über die Provider-Chain:
        Ollama bereit → Ollama 🦙 · sonst LoveAI Core 💜 (eingebaut).
     3. Ergebnis steht für Banner/Status bereit (aiBootStatus()).

   Die Engine selbst fällt zusätzlich LAUFEND automatisch um: Der
   ChainProvider prüft Ollama mit 30-s-Cache — startet Ollama später,
   wird es ohne Neustart wieder aktiv.
   ═══════════════════════════════════════════════════════════════════ */
import { spawn } from 'node:child_process';
import { aiHealth, invalidateAiHealth } from './engine.js';

let state = { booted: false, engine: '', engineLabel: '', ollamaInstalled: null, ollamaStarted: false, detail: '', at: 0 };

export function aiBootStatus() { return { ...state }; }

/* Ollama-Prozess im Hintergrund starten (detached, Ausgaben verworfen).
   Läuft bereits → Prozess beendet sich mit „address already in use",
   was harmlos ist. Nicht installiert → ENOENT, equally harmlos.      */
function tryStartOllama() {
  return new Promise((resolve) => {
    let settled = false;
    const done = (ok) => { if (!settled) { settled = true; resolve(ok); } };
    try {
      const child = spawn('ollama', ['serve'], {
        detached: true,
        stdio: 'ignore',
        shell: process.platform === 'win32' /* Windows: ollama.exe über PATH */
      });
      child.on('error', () => done(false));       /* ENOENT → nicht installiert */
      child.on('spawn', () => {
        try { child.unref(); } catch (e) {}
        done(true);
      });
      /* Falls weder error noch spawn-Typisches feuert: nach 1,5 s weiter */
      setTimeout(() => done(true), 1500);
    } catch (e) { done(false); }
  });
}

export async function bootAi({ startOllama = true, waitMs = 1200 } = {}) {
  const at = Date.now();

  /* 1) Ollama (falls installiert) im Hintergrund starten */
  let ollamaStarted = false;
  if (startOllama) ollamaStarted = await tryStartOllama();
  if (ollamaStarted && waitMs) await new Promise((r) => setTimeout(r, waitMs));

  /* 2) Frischer Healthcheck über die Chain (Ollama → Cloud → Core) */
  invalidateAiHealth();
  let h = null;
  try { h = await aiHealth(true); } catch (e) { h = null; }

  const engine = h?.engine || (h?.ok ? 'ollama' : 'core');
  const cloudTxt = h?.cloudOn ? ` · Cloud-KI ☁️ (${h.cloudProvider || '?'}${h.cloudModel ? ' · ' + h.cloudModel : ''}) bereit` : '';
  state = {
    booted: true,
    engine,
    engineLabel: h?.engineLabel || (engine === 'ollama' ? 'Ollama 🦙' : 'LoveAI Core 💜'),
    ollamaInstalled: ollamaStarted,
    ollamaStarted,
    cloudOn: !!h?.cloudOn,
    cloudProvider: h?.cloudProvider || '',
    detail: engine === 'ollama'
      ? `Ollama aktiv · ${(h && h.model) || ''} · ${h?.ms ?? 0} ms${cloudTxt}`
      : engine === 'cloud'
        ? `Cloud-KI aktiv · ${(h && h.cloudLabel) || ''} · ${(h && h.model) || ''} · ${h?.ms ?? 0} ms`
        : `LoveAI Core aktiv (eingebaut, immer verfügbar)${ollamaStarted ? ' — Ollama startet, wird automatisch übernommen' : ' — Ollama nicht erreichbar'}${cloudTxt}`,
    at
  };
  return { ...state };
}

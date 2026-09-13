/* ═══════════════════════════════════════════════════════════════════
   💜 LoveBot 7.0 — AI CONTEXT (ai/context.js)

   · System-Prompt (LoveAI-Identität, Tool-Protokoll, Anti-Halluzination)
   · Kontext-Builder (History + Fakten + Limits, neueste zuerst gekürzt)
   · ReAct-Schleife: TOOL:name({...}) → runTool → max 3 Runden
   · Output-Sanitize: TOOL-Zeilen raus, Secrets-Muster rotiert, Länge cap
   ═══════════════════════════════════════════════════════════════════ */
import { toolSpec, runTool } from './tools.js';
import { buildBotKnowledge } from './knowledge.js';

export const MAX_REACT_ROUNDS = 3;

export function buildSystemPrompt({ lang = 'de', groupName = '' } = {}) {
  const tools = toolSpec().map((t) => `- ${t.name}: ${t.desc}`).join('\n');
  const date = new Date().toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const knowledge = buildBotKnowledge();
  if (lang === 'en') {
    return 'You are LoveKI 💜, the real AI of LoveBot 7.1 — a fully integrated bot copilot (like GitHub Copilot knows a repo): ' +
      'You know the ENTIRE bot — commands, website (40 pages), features, systems — and explain anything about it. ' +
      'You also answer ANY general question (knowledge, school, math, coding, creative writing, ideas) helpfully and accurately. ' +
      'Keep answers compact for WhatsApp (max ~900 chars), friendly, few emojis, *asterisks* for bold. ' +
      `Today is ${date}. ` +
      'STRICT RULES: You are READ-ONLY — you can NEVER change anything (no settings, no data, no commands that modify). ' +
      'For user- and bot-data ALWAYS use tools — NEVER invent data or commands. ' +
      'To use a tool, output lines like:\n' +
      'TOOL:name({"arg":"value"})\nAvailable tools (all read-only):\n' + tools +
      '\nAfter TOOL lines you receive results and answer finally. Never output passwords/tokens/keys.' +
      (groupName ? `\nCurrent group: ${groupName}.` : '') +
      '\n\n' + knowledge;
  }
  return 'Du bist LoveKI 💜, die echte KI von LoveBot 7.1 — ein komplett verknüpfter Bot-Copilot (wie GitHub Copilot ein Repository kennt): ' +
    'Du kennst den GESAMTEN Bot — Befehle, Website (40 Seiten), Features, Systeme — und kannst alles daran erklären. ' +
    'Zusätzlich beantwortest du JEDE allgemeine Frage (Wissen, Schule, Mathe, Programmieren, kreatives Schreiben, Ideen) hilfreich und korrekt. ' +
    'Antworte kompakt für WhatsApp (max ~900 Zeichen), freundlich, mit wenigen Emojis, *Sternchen* für fett. ' +
    `Heute ist ${date}. ` +
    'STRENGE REGEL: Du bist NUR LESEND — du darfst NIEMALS etwas ändern (keine Einstellungen, keine Daten, keine verändernden Befehle). ' +
    'Für ALLE User- und Bot-Daten nutze IMMER Tools — erfinde NIEMALS Daten oder Befehle. ' +
    'Für ein Tool schreibe Zeilen wie:\n' +
    'TOOL:name({"arg":"wert"})\nVerfügbare Tools (alle nur lesend):\n' + tools +
    '\nNach TOOL-Zeilen erhältst du Ergebnisse und antwortest final. Niemals Passwörter/Tokens/Keys ausgeben.' +
    (groupName ? `\nAktuelle Gruppe: ${groupName}.` : '') +
    '\n\n' + knowledge;
}

/* Verlauf + Fakten + Nachricht zu EINEM Prompt (generate) zusammenbauen */
export function buildPrompt({ system = '', history = [], facts = [], userText = '', contextChars = 6000 } = {}) {
  const parts = [system];
  if (facts.length) {
    parts.push('Bekannte Fakten über den User:\n' + facts.map((f) => '- ' + f.text).join('\n'));
  }
  /* Neueste History zuerst, Budget einhalten */
  let budget = Math.max(1000, contextChars - system.length - String(userText).length - 500);
  const lines = [];
  for (let i = history.length - 1; i >= 0; i--) {
    const h = history[i];
    const ln = (h.role === 'ai' ? 'LoveAI: ' : 'User: ') + h.text;
    if (ln.length > budget) break;
    budget -= ln.length;
    lines.unshift(ln);
  }
  if (lines.length) parts.push('Verlauf:\n' + lines.join('\n'));
  parts.push('User: ' + userText + '\nLoveAI:');
  return parts.join('\n\n');
}

export function parseToolCalls(text) {
  const out = [];
  const re = /TOOL:([a-zA-Z]+)\(\s*(\{.*?\})\s*\)/gs;
  let m;
  while ((m = re.exec(String(text || ''))) !== null && out.length < 5) {
    let args = {};
    try { args = JSON.parse(m[2]); } catch (e) { args = {}; }
    out.push({ name: m[1], args });
  }
  return out;
}

const SECRET_RE = /(password|passwd|token|secret|api[_-]?key|session)\s*[:=]\s*\S+/gi;

export function sanitizeOutput(text, maxChars = 1500) {
  let t = String(text || '');
  t = t.replace(/^.*TOOL:[a-zA-Z]+\(\{.*?\}\).*$/gm, '').trim();
  t = t.replace(SECRET_RE, '$1: [redacted]');
  t = t.replace(/\n{3,}/g, '\n\n').trim();
  if (t.length > maxChars) t = t.slice(0, maxChars - 1) + '…';
  return t || '…';
}

/* ReAct: generieren → Tools → maximal 3 Runden → finale Antwort */
export async function runReact(provider, { system = '', history = [], facts = [], userText = '', toolCtx = {}, cfg = {}, signal = null } = {}) {
  const t0 = Date.now();
  const toolsUsed = [];
  let prompt = buildPrompt({ system, history, facts, userText, contextChars: cfg.contextChars || 6000 });
  let lastText = '';
  let engine = '';
  for (let round = 0; round < MAX_REACT_ROUNDS; round++) {
    if (signal?.aborted) throw new Error('aborted');
    const res = await provider.generate(prompt, { signal, maxTokens: cfg.maxTokens, temperature: cfg.temperature, model: cfg.model });
    lastText = res.text || '';
    engine = res.engine || engine;
    const calls = parseToolCalls(lastText);
    if (!calls.length) break;
    const results = [];
    for (const c of calls) {
      const r = runTool(c.name, c.args, toolCtx);
      toolsUsed.push(c.name);
      results.push(`TOOL-RESULT ${c.name}: ${JSON.stringify(r.ok ? r.data : { error: r.error }).slice(0, 800)}`);
    }
    prompt = prompt + '\n\n' + lastText + '\n\n' + results.join('\n') + '\n\nAntworte jetzt final auf die User-Nachricht (kurz, ohne TOOL-Zeilen):';
  }
  return { text: sanitizeOutput(lastText), ms: Date.now() - t0, toolsUsed, engine };
}

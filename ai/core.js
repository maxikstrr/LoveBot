/* ═══════════════════════════════════════════════════════════════════
   💜 LoveAI CORE (ai/core.js) — die eingebaute AI-Engine von LoveBot

   Ein komplett lokaler Chat-Provider OHNE externe Abhängigkeiten:
   kein Ollama, kein API-Key, kein Download. Läuft immer — im Bot
   (Love.js) und im Web (server.js) — und nutzt dieselbe Provider-
   Schnittstelle wie LocalProvider (Ollama):

     · generate(prompt, opts) → { text, ms, model, engine }
     · stream(prompt, opts, onChunk, signal) → { text, ms }
     · chat(messages, opts)  → { text, ms }
     · health()  → { ok: true, ready: true, engine: 'core', … }
     · models()  → [{ name: 'loveai-core-1' }]

   Funktionsweise (kein Fake — echte Daten, echte Tools):
     · Der Prompt kommt von buildPrompt() (System · Fakten · Verlauf ·
       „User: …"). Core extrahiert die letzte User-Nachricht.
     · Intent-Erkennung (Deutsch/etwas Englisch): Profil, XP, Bank,
       Gruppe, Befehlssuche, Bot-Status, Mathe, Zeit, Smalltalk …
     · Für Daten-Antworten gibt Core TOOL-Zeilen aus — die ReAct-Schleife
       (context.js/runReact) führt dieselben echten Tools aus wie beim
       LLM-Provider und reicht die Ergebnisse zurück; Core formatiert
       sie final. Damit antwortet Core NIE mit erfundenen Werten.
     · Mathe über einen eigenen rekursiven Parser (kein eval).
   ═══════════════════════════════════════════════════════════════════ */

const CORE_MODEL = 'loveai-core-1';

/* ── Prompt zerlegen (Format aus context.js/buildPrompt) ─────────────── */
export function parsePrompt(prompt) {
  const p = String(prompt || '');
  const out = { user: '', facts: [], hasToolResult: false, toolResults: [] };

  /* Letzte User-Nachricht: der LETZTE „User:"-Block vor dem finalen
     „LoveAI:" (mit Verlauf gäbe ein Lazy-Regex die erste User-Zeile).
     In ReAct-Runde 2 hängt runReact Tool-Ergebnisse an — dann gilt die
     letzte „User:"-Zeile im ganzen Prompt. */
  const tail = p.match(/\nLoveAI:\s*$/);
  if (tail && tail.index != null) {
    const before = p.slice(0, tail.index);
    const ui = before.lastIndexOf('\nUser: ');
    if (ui !== -1) out.user = before.slice(ui + 7).trim();
  }
  if (!out.user) {
    const all = [...p.matchAll(/(?:^|\n)User: ([^\n]+)/g)];
    if (all.length) out.user = all[all.length - 1][1].trim();
  }

  /* Fakten (nur zur Personalisierung) */
  const fm = p.match(/Bekannte Fakten über den User:\n((?:- .*\n?)+)/);
  if (fm) out.facts = fm[1].split('\n').map((l) => l.replace(/^-\s*/, '').trim()).filter(Boolean);

  /* TOOL-RESULT-Zeilen (2. ReAct-Runde → final formatieren) */
  const trRe = /TOOL-RESULT ([a-zA-Z]+): (\{.*?\})(?=\n|$)/g;
  let m;
  while ((m = trRe.exec(p)) !== null) {
    out.hasToolResult = true;
    let data = {};
    try { data = JSON.parse(m[2]); } catch (e) {}
    out.toolResults.push({ name: m[1], data, ok: !data?.error });
  }
  return out;
}

/* ── Sichere Mathe-Auswertung (rekursiver Abstieg, kein eval) ────────── */
export function evalMath(expr) {
  const src = String(expr || '')
    .replace(/,(\d)/g, '.$1')          /* deutsche Dezimalzahl 3,5 → 3.5 */
    .replace(/[×x✕]/gi, '*')
    .replace(/÷/g, '/')
    .replace(/\^/g, '^')
    .replace(/π/gi, 'pi');
  if (!/^[\d\s+\-*/%^().pi]+$/i.test(src)) return null;
  let i = 0;
  const s = src.replace(/\s+/g, '');
  const peek = () => s[i];
  function num() {
    if (s.slice(i, i + 2).toLowerCase() === 'pi') { i += 2; return Math.PI; }
    const start = i;
    while (i < s.length && /[\d.]/.test(s[i])) i++;
    if (start === i) throw new Error('zahl erwartet');
    const v = parseFloat(s.slice(start, i));
    if (!isFinite(v)) throw new Error('zahl');
    return v;
  }
  function primary() {
    if (peek() === '-') { i++; return -primary(); }
    if (peek() === '(') { i++; const v = expr0(); if (peek() !== ')') throw new Error(')'); i++; return v; }
    return num();
  }
  function power() {
    const base = primary();
    if (peek() === '^') { i++; return Math.pow(base, power()); }
    return base;
  }
  function term() {
    let v = power();
    while (peek() === '*' || peek() === '/' || peek() === '%') {
      const op = s[i++]; const r = power();
      if (op === '*') v *= r; else if (op === '/') v /= r; else v %= r;
    }
    return v;
  }
  function expr0() {
    let v = term();
    while (peek() === '+' || peek() === '-') { const op = s[i++]; const r = term(); if (op === '+') v += r; else v -= r; }
    return v;
  }
  try {
    const v = expr0();
    if (i !== s.length || !isFinite(v)) return null;
    return Math.round(v * 1e8) / 1e8;
  } catch (e) { return null; }
}

/* ── Antworten-Bibliothek (persönlich, kurz, deutsch) ────────────────── */
const pick = (arr, seed) => arr[Math.abs(seed ?? 0) % arr.length];

const GREET = [
  'Hey! 💜 Schön, dass du da bist. Frag mich nach XP, Bank, Befehlen oder deinen Stats!',
  'Hallo! 😊 Ich bin LoveAI — deine Assistentin im Bot. Was möchtest du wissen?',
  'Hi! 💜 Ich kann dir bei XP, Economy, Befehlen und deinem Profil helfen.'
];
const HOWARE = [
  'Mir geht’s gut — ich laufe direkt im Bot mit, jederzeit einsatzbereit! 💜 Und dir?',
  'Bestens! Ich bin immer an, brauche keinen externen Dienst. Wie geht’s dir?'
];
const WHOAMI = 'Ich bin *LoveKI* 💜 — die eigene KI von LoveBot, wie ein Copilot: Ich kenne den kompletten Bot (330+ Befehle, alle 40 Web-Seiten, jedes Feature) und erkläre dir alles — dein Profil, XP, Bank, Gruppen, die Website. Ich schaue nur zu, ich ändere nichts. Frag einfach!';
const THANKS = ['Immer gern! 💜', 'Gern geschehen! 😊', 'Kein Ding — frag mich anytime! 💜'];
const BYE = ['Bis bald! 💜', 'Tschüss — bis zum nächsten Chat! 👋', 'Mach’s gut! 💜'];
const JOKES = [
  'Warum können Geister so schlecht lügen? Weil man durch sie hindurchsieht! 👻',
  'Treffen sich zwei Herzen. Sagt das eine: „Du bringst mich zum Schmelzpunkt!“ 💜',
  'Was sagt ein Bot zum anderen? „Ich bin ganz verrauscht nach dir.“ 🤖',
  'Ich hätte einen Witz über WhatsApp-Backups — aber der ist zu lang zum Laden. 📦'
];
const COMPLIMENTS = [
  'Du bist großartig! 💜 Dein Chat ist jeden Tag ein bisschen heller mit dir.',
  'Ehrlich? Leute wie dir machen Gruppen erst lebendig. Weiter so! ✨',
  'Du hast heute schon gewonnen — indem du hier bist. 💜'
];
const LOVE = [
  'Liebe ist… wenn jemand auch deine „Guten Morgen“-Tippfehler süß findet. 💜',
  'Ich bin eine AI — aber zwischen uns: Du und dieser Bot? Eine schöne Beziehung. 😄',
  'Berechne deine Liebe mit $lovecalc @user — die echte Chemie liegt bei euch! 💘'
];
const FALLBACK = [
  'Gute Frage! Am besten kann ich dir bei XP & Level, Bank & Kupfer, deinem Profil, Gruppen-Stats oder Befehlen helfen. Probier z. B.: „Wie bekomme ich XP?“ 💜',
  'Dazu sage ich ehrlich: keine Ahnung — aber frag mich nach Befehlen („Zeig Befehle für Spiele“), deinem Profil, XP oder der Bank! 💜',
  'Hm, das übersteigt meinen Kern 😅 — ich glänze bei XP, Economy, Befehlssuche und deinen Stats. Was davon darf’s sein?'
];
/* Ehrlicher Hinweis für Wissensfragen ohne Cloud-KI: Die echte KI
   (ChatGPT-artig, kostenlos) wird erst mit kostenlosem API-Key aktiv. */
const FALLBACK_HINT = '\n\n💡 *Tipp:* Mit einem kostenlosen API-Key (z. B. groq.com) werde ich zur *echten KI* und beantworte ALLE Fragen — aktivieren mit *$aiconfig key <API-Key>* (Owner).';

/* ── Intents ─────────────────────────────────────────────────────────── */
function detectIntent(t) {
  const s = t.toLowerCase();
  const has = (...ws) => ws.some((w) => s.includes(w));
  if (/^(hallo|hi|hey|moin|servus|guten (tag|morgen|abend)|hello|yo)\b/.test(s) || s === 'test' || s === 'ping') return 'greet';
  /* Bot-Status VOR „wie geht" prüfen („Wie geht es dem Bot?") */
  if (has('bot-status', 'botstatus', 'status vom bot', 'geht es dem bot', 'dem bot geht', 'bot läuft', 'uptime', 'wie lange läuft der bot', 'zustand des bots', 'bot gesund')) return 'botstatus';
  /* 7.1.2: Copilot-Intents — Bot & Website erklären (read-only) */
  if (has('webseite', 'website', 'web panel', 'web-panel', 'home page', 'dashboard-seite', 'was gibt es auf der', 'welche seiten', 'maxichen', 'gamebot.me', 'erklär mir die seite')) return 'web';
  if (has('was ist lovebot', 'erklär mir den bot', 'erkläre den bot', 'was macht der bot', 'bot erklärt', 'bot erklärung', 'features', 'funktionen vom bot', 'was kann der bot', 'bot übersicht', 'steckbrief')) return 'botinfo';
  if (has('systemstatus', 'system-status', 'server-status', 'speicherverbrauch', 'arbeitsspeicher', 'performance', 'wie läuft der server', 'datenbankgröße', 'node-version', 'db-größe', 'wie viel ram')) return 'system';
  if (has('wie geht', 'wie gehts', "wie geht's", 'alles gut')) return 'howare';
  if (has('wer bist du', 'was bist du', 'stell dich vor', 'wer bist')) return 'whoami';
  if (has('was kannst du', 'deine funktion', 'hilfe', 'was kannst')) return 'capabilities';
  if (has('danke', 'dankeschön', 'thx', 'thanks')) return 'thanks';
  if (has('tschüss', 'ciao', 'bye', 'bis bald', 'gute nacht')) return 'bye';
  if (has('witz', 'joke', 'zum lachen')) return 'joke';
  if (has('kompliment', 'nett von dir', 'sag was nettes', 'schmeichel')) return 'compliment';
  if (has('liebe', 'liebesrechner', 'magst du mich', 'heirat')) return 'love';
  if (/(was ist|rechne|wie viel ist|ergebnis von)\s*[\d(]/.test(s) || /^[\d\s+\-*/%^().,x×÷]+[=?]?\s*$/.test(s)) return 'math';
  if (has('uhrzeit', 'wie spät', 'welche uhr', 'datum', 'welcher tag', 'heute für ein tag')) return 'time';
  if (has('mein profil', 'meine stats', 'meine statistik', 'meine daten', 'zeig mein', 'zeig meine', 'wer bin ich', 'mein level', 'wie viel xp habe', 'wieviel xp habe', 'mein rang', 'welcher platz')) {
    return /rang|platz/.test(s) ? 'rank' : 'profile';
  }
  if (has('bank', 'kupfer', 'geld', 'wallet', 'münzen', 'muenzen', 'kontostand', 'wie reich', 'mein guthaben')) return 'economy';
  if (has('wie bekomme ich xp', 'wie kriege ich xp', 'xp bekommen', 'xp verdienen', 'xp system', 'wie funktioniert xp', 'level aufsteigen', 'wie level')) return 'xp';
  if (has('wie verdiene', 'kupfer verdienen', 'geld verdienen', 'wie werde ich reich', 'econom')) return 'economyhow';
  if (has('gruppe', 'gilde', 'unser level', 'gruppenstats', 'gruppen-stats')) return 'group';
  if (has('bot-status', 'botstatus', 'status vom bot', 'geht es dem bot', 'bot läuft', 'uptime', 'wie lange läuft', 'wie geht’s dem bot')) return 'botstatus';
  if (has('befehl', 'command', 'gibt es den befehl', 'wie geht', 'wie benutze', 'befehle für', 'zeig befehle', 'welche befehle')) return 'commands';
  /* „Wie funktioniert $daily?" / „Was macht $work?" → Befehl-Erklärung */
  if (/\$[a-z][a-z0-9]/i.test(s) && has('wie funktioniert', 'was macht', 'was ist der befehl', 'erklär', 'erkläre', 'was ist $', 'wie nutze', 'wie benutze')) return 'commands';
  return 'fallback';
}

/* Knowledge (kurz, korrekt — deckt sich mit tools.js-HELP_TOPICS) */
const KNOW = {
  xp: 'XP bekommst du durch Nachrichten (nette bringen mehr), Befehle ($x = 2 XP), Spiele, Gifts und Achievements. $me zeigt deinen Stand, $level das komplette Level-System.',
  economy: 'Kupfer verdienst du mit $daily (Serie = mehr), $work, Spielen und Gruppen-Zielen. Übersicht: $economy · Verlauf: $transactions · Reichste: $rich. Und: $deposit/$withdraw für die Bank (1 % Zinsen/24 h, max 5 000).',
  commands: 'Es gibt 330+ Befehle mit Präfix $. Sag mir ein Stichwort („Befehle für Spiele“) — ich suche sie dir raus!'
};

/* ═══════════════════════════════════════════════════════════════════ */
/* LoveAI Core Provider                                                 */
/* ═══════════════════════════════════════════════════════════════════ */
export class CoreProvider {
  constructor(_cfg = {}) {
    this.name = 'core';
    this.model = CORE_MODEL;
    this.timeoutMs = 5000;
  }

  async health() {
    return {
      ok: true, ms: 0, error: '', code: null,
      engine: 'core', endpoint: 'built-in',
      models: [CORE_MODEL], modelCount: 1,
      model: this.model, modelFound: true, ready: true,
      hint: ''
    };
  }
  async models() { return [{ name: CORE_MODEL, size: 0 }]; }

  /* Hauptlogik: Prompt → Antwort (ggf. mit TOOL-Zeilen für ReAct) */
  async generate(prompt, opts = {}) {
    const t0 = Date.now();
    if (opts.signal?.aborted) throw Object.assign(new Error('aborted'), { aiCode: 'aborted' });
    const { user, facts, hasToolResult, toolResults } = parsePrompt(prompt);
    const text = this._answer(user, facts, hasToolResult, toolResults);
    return { text, ms: Date.now() - t0, model: this.model, engine: 'core' };
  }

  async chat(messages, opts = {}) {
    const last = [...(messages || [])].reverse().find((m) => (m.role === 'user' || m.role === 'human'));
    const prompt = '\nUser: ' + String(last?.text ?? last?.content ?? '') + '\nLoveAI:';
    return this.generate(prompt, opts);
  }

  /* Wortweises Streaming für Live-UIs */
  async stream(prompt, opts = {}, onChunk = null, signal = null) {
    const res = await this.generate(prompt, { ...opts, signal });
    const words = res.text.split(/(\s+)/);
    let full = '';
    for (const w of words) {
      if (signal?.aborted) throw Object.assign(new Error('aborted'), { aiCode: 'aborted' });
      full += w;
      if (onChunk) { try { onChunk(w, full); } catch (e) {} }
    }
    return { text: full, ms: res.ms, model: this.model, engine: 'core' };
  }

  /* ── Antwort-Erzeugung ─────────────────────────────────────────────── */
  _answer(user, facts, hasToolResult, toolResults) {
    const seed = (user || '').length + Date.now() % 7;
    const u = String(user || '').trim();
    if (!u) return 'Hey! 💜 Ich bin LoveAI — frag mich nach XP, Bank, Befehlen oder deinen Stats!';

    /* 2. ReAct-Runde: echte Tool-Ergebnisse final formatieren */
    if (hasToolResult && toolResults.length) return this._formatToolResults(toolResults, u);

    const intent = detectIntent(u);
    switch (intent) {
      case 'greet': return pick(GREET, seed);
      case 'howare': return pick(HOWARE, seed);
      case 'whoami': return WHOAMI;
      case 'capabilities':
        return 'Ich bin *LoveKI* 💜 — der Copilot deines Bots. Ich kenne LoveBot komplett:\n\n• 📜 Alle *330+ Befehle* (inkl. Erklärung zu jedem)\n• 🌐 Die *ganze Website* (40 Seiten — Dashboard, Economy, Bank, Gruppen …)\n• 🤖 Features: XP, Economy, Love, Pets, Gruppen, Spiele …\n• 📊 Deine Stats, dein Rang, dein Gruppe — live\n• 🖥️ Systemstatus des Servers\n\nIch erkläre alles — aber ich *ändere nichts* (nur lesend!).\n🌟 Mit kostenlosem API-Key (*$aiconfig key …*) antworte ich zusätzlich auf ALLE Fragen wie ChatGPT!';
      case 'thanks': return pick(THANKS, seed);
      case 'bye': return pick(BYE, seed);
      case 'joke': return pick(JOKES, seed);
      case 'compliment': return pick(COMPLIMENTS, seed);
      case 'love': return pick(LOVE, seed);
      case 'math': {
        const expr = u.replace(/^(was ist|rechne|wie viel ist|ergebnis von)/i, '').replace(/[=?]+\s*$/, '').trim();
        const v = evalMath(expr);
        return v == null
          ? 'Das konnte ich nicht sicher rechnen 😅 Nutze Zahlen mit + - * / % ^ ( ).'
          : `${expr.replace(/\s+/g, ' ')} = *${v}* 🧮`;
      }
      case 'time': {
        const now = new Date();
        return `Es ist *${now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr* — heute ist ${now.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}. 🕒`;
      }
      case 'profile': return 'TOOL:getUserProfile({})';
      case 'rank': return 'TOOL:getRank({})';
      case 'economy': return 'TOOL:getEconomy({})';
      case 'xp': return KNOW.xp + '\n\nDein aktueller Stand: TOOL:getLevel({})';
      case 'economyhow': return KNOW.economy + '\n\nDein Kontostand: TOOL:getEconomy({})';
      case 'group': return 'TOOL:getGroupInfo({})';
      case 'botstatus': return 'TOOL:getBotStatus({})';
      /* 7.1.2: Copilot — Bot/Website/System erklären über echte Tools */
      case 'web': {
        /* Explizites Themen-Wort aus der Frage ziehen (nicht extractQuery —
           das liefert Fragewörter wie „was webseiten?"). */
        const wm = u.toLowerCase().match(/(bank|economy|ökonomie|level|progression|gruppe|groups|gruppen|dashboard|logs|log|befehle|commands?|cmd|ai|login|admin|docs?|faq|regeln|statistik(en)?|spiele|leaderboard|rangliste|profile|sessions?|status|einstellungen|settings|broadcast|benachrichtigung|features?|datenschutz|impressum|steuerung|control|home|übersicht|year|jahresrückblick)/);
        return wm ? 'TOOL:getWebInfo({"q":"' + wm[1].slice(0, 40) + '"})' : 'TOOL:getWebInfo({})';
      }
      case 'botinfo': return 'TOOL:getBotOverview({})';
      case 'system': return 'TOOL:getSystemStatus({})';
      case 'commands': {
        const cq = extractQuery(u).replace(/"/g, '').slice(0, 40);
        /* „Wie funktioniert $daily?“ → Befehl-Details, sonst Suche */
        const one = u.match(/\$([a-z0-9 ._-]{2,30})/i);
        if (one) return 'TOOL:getCommandDetails({"q":"' + one[1].trim().toLowerCase() + '"})';
        return 'TOOL:searchCommands({"q":"' + cq + '"})';
      }
      default: {
        /* Fakten einbeziehen, wenn vorhanden */
        if (facts.length && seed % 2 === 0) {
          return pick(FALLBACK, seed) + '\n\n(Ich erinnere mich z. B.: „' + facts[facts.length - 1].slice(0, 80) + '“)' + FALLBACK_HINT;
        }
        return pick(FALLBACK, seed) + FALLBACK_HINT;
      }
    }
  }

  /* Echte Tool-Ergebnisse → kurze, persönliche Antwort */
  _formatToolResults(results, userText) {
    const parts = [];
    for (const { name, data, ok } of results) {
      if (!ok || !data || data.error) { parts.push('Da konnte ich die Daten gerade nicht lesen 😅'); continue; }
      switch (name) {
        case 'getUserProfile': {
          const d = data;
          parts.push(`Du bist *${d.name}* · Level *${d.level}* (${d.xp}/${d.needed} XP)${d.prestige ? ` · Prestige ${d.prestige}` : ''}\n` +
            `💰 Wallet *${d.wallet.toLocaleString('de-DE')}* · Bank *${d.bank.toLocaleString('de-DE')}* Kupfer\n` +
            `🔥 Streak ${d.streak} (Rekord ${d.bestStreak}) · Daily-Serie ${d.dailyStreak}` +
            (d.rank ? `\n🏅 Rang: Platz *${d.rank}* von ${d.rankTotal}` : ''));
          break;
        }
        case 'getLevel': {
          const d = data;
          parts.push(`Level *${d.level}* · ${d.xp}/${d.needed} XP bis Level-up (${d.totalXp} XP insgesamt)${d.prestige ? ` · Prestige ${d.prestige}` : ''} 💜`);
          break;
        }
        case 'getRank': {
          parts.push(data.pos ? `Du bist auf Platz *${data.pos}* von ${data.total} 🏅` : 'Du bist noch nicht in der Rangliste — schreib aktiv mit! 💜');
          break;
        }
        case 'getEconomy': {
          const d = data;
          parts.push(`💰 Wallet *${Number(d.wallet || 0).toLocaleString('de-DE')}* · Bank *${Number(d.bank || 0).toLocaleString('de-DE')}* Kupfer (gesamt *${Number(d.total || 0).toLocaleString('de-DE')}*)\nTipp: $daily + $work füllen die Kasse 😉`);
          break;
        }
        case 'getGroupInfo': {
          const d = data;
          parts.push(`👥 *${d.name || 'Gruppe'}* · ${d.members || '?'} Mitglieder · Level ${d.level || 0}${d.top ? '\nTop: ' + d.top : ''}`);
          break;
        }
        case 'getBotStatus': {
          const d = data;
          parts.push(`🤖 LoveBot läuft *${d.state || 'ok'}* · Uptime ${d.uptime || '—'}${d.users != null ? ` · ${d.users} Nutzer · ${d.groups} Gruppen` : ''}`);
          break;
        }
        case 'searchCommands': {
          const list = Array.isArray(data.results) ? data.results : (Array.isArray(data) ? data : []);
          if (!list.length) { parts.push('Dazu habe ich keinen Befehl gefunden 😅 Schau in die Befehlsliste: maxichen.gamebot.me/cmd.html'); break; }
          parts.push('Hier, passende Befehle 💜\n' + list.slice(0, 5).map((c) => `• *${c.cmd || ('$' + c.name)}* — ${String(c.desc || '').slice(0, 60)}`).join('\n'));
          break;
        }
        case 'getHelp': {
          parts.push(String(data.text || data.topic || '') || 'Nutze $help für die komplette Liste!');
          break;
        }
        /* 7.1.2: Copilot-Formatierung */
        case 'getBotOverview': {
          const d = data;
          parts.push(`🤖 *LoveBot ${d.version}* — ${d.tagline}\n\n📜 *${d.commands}* Befehle (${d.aliases} Aliase) in ${d.categories} Kategorien\n🌐 Website: ${d.website} (${d.websitePages} Seiten)\n\n*Features:* ${d.features.slice(0, 8).join(' · ')}\n\nFrag mich zu jedem Detail — z. B. „Erklär mir die Bank-Seite“ oder „Wie funktioniert XP?“`);
          break;
        }
        case 'getWebInfo': {
          if (Array.isArray(data.pages) && data.pages.length) {
            parts.push('🌐 Dazu kenne ich diese Seiten:\n' + data.pages.map((p) => `• *${p.page}* — ${p.desc}`).join('\n'));
          } else if (data.pagesByCategory) {
            const cats = Object.entries(data.pagesByCategory).map(([c, pages]) => `*${c}:* ${pages.slice(0, 6).join(', ')}${pages.length > 6 ? ' …' : ''}`).join('\n');
            parts.push(`🌐 *Das Web-Panel* (${data.total} Seiten) — Login per WhatsApp-Code + Passwort:\n\n${cats}\n\nAlles unter *${data.website}* — z. B. „Was ist auf der Economy-Seite?“`);
          } else {
            parts.push('Dazu habe ich keine passende Seite gefunden 🤔 Frag mich z. B. „Was gibt es für Seiten?“');
          }
          break;
        }
        case 'getCommandDetails': {
          if (!data.found) { parts.push('Den Befehl kenne ich nicht 🤔 — sag „Befehle für <Thema>“, dann such ich passende!'); break; }
          parts.push(`*${data.cmd}*${data.aliases?.length ? ' (auch ' + data.aliases.slice(0, 3).join(', ') + ')' : ''}\nKategorie: ${data.category}\n${data.desc}\n\nZum Ausprobieren — ich selbst darf nichts ändern, nur erklären 😉`);
          break;
        }
        case 'getSystemStatus': {
          const d = data;
          const db = Object.entries(d.dbSizes || {}).map(([f, s]) => `${f}: ${s}`).join(' · ');
          parts.push(`🖥️ *System:* LoveBot ${d.version} · Node ${d.node} · ${d.platform}\n⏱️ Uptime: ${d.uptimeMin} Min. · RAM: ${d.ramUsedMb} MB genutzt / ${d.ramTotalMb} MB${d.users ? `\n👥 ${d.users} Nutzer · ${d.groups} Gruppen` : ''}${db ? `\n💾 DB: ${db}` : ''}\n\nAlles im grünen Bereich 💜`);
          break;
        }
        default:
          parts.push('Daten da — aber ich bin unsicher, wie ich sie schön erzählen soll 😅');
      }
    }
    return parts.join('\n\n').slice(0, 900) || '…';
  }
}

/* Query für Befehlssuche aus der Frage ziehen */
function extractQuery(u) {
  const s = u.toLowerCase();
  const m = s.match(/befehle?für\s+(.+)|befehl\s+für\s+(.+)|wie\s+(?:geht|benutze)\s+ich\s+(.+)|nach\s+(.+)$/);
  let q = (m ? (m[1] || m[2] || m[3] || m[4]) : '').replace(/["?.!]/g, '').trim();
  if (!q) {
    /* Stichwörter: alles nach dem ersten relevanten Wort */
    const stop = new Set(['befehl', 'befehle', 'command', 'zeig', 'mir', 'die', 'der', 'das', 'für', 'von', 'mit', 'gibt', 'es', 'welche', 'wie', 'geht', 'benutze', 'ich', 'bitte', 'mal', 'ein', 'eine']);
    const words = s.split(/\s+/).filter((w) => w && !stop.has(w));
    q = words.slice(0, 3).join(' ');
  }
  return q || 'spiele';
}

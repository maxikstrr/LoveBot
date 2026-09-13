/* ═══════════════════════════════════════════════════════════════════
   🧠 LoveBot 7.1 — BOT-WISSEN / COPILOT-GEDÄCHTNIS (ai/knowledge.js)

   LoveKI ist der Copilot des Bots: Sie kennt LoveBot wie GitHub
   Copilot ein Repository kennt — Befehle, Website, Features, System.

   · WEB_PAGES    — alle Web-Panel-Seiten mit Zweck
   · BOT_FEATURES — Feature-Bereiche des Bots (für Erklärungen)
   · ARCHITECTURE — Systemmodule (für Technik-Fragen)
   · buildBotKnowledge() — Wissens-Block für den System-Prompt
   · findPages()  — Seitensuche (für getWebInfo & Core-Intents)
   · botOverview()/registryFacts() — Bot-Steckbrief

   ALLES READ-ONLY: Dieses Modul liest nur, es ändert niemals etwas.
   ═══════════════════════════════════════════════════════════════════ */
import fs from 'fs';

/* ── Website-Seiten (public/*.html) mit Zweck ─────────────────────── */
export const WEB_PAGES = {
  'index': { title: 'Start', cat: 'Einstieg', desc: 'Landingpage mit Login-Aufruf und Bot-Vorstellung.' },
  'login': { title: 'Login', cat: 'Einstieg', desc: 'Anmeldung per WhatsApp-Code (2FA) und Passwort.' },
  'session': { title: 'Session', cat: 'Einstieg', desc: 'Aktive Sitzung: Status, Ablauf, Abmelden.' },
  'account': { title: 'Mein Account', cat: 'Einstieg', desc: 'Persönlicher Zugang: Passwort, Einstellungen.' },
  'app': { title: 'App', cat: 'Einstieg', desc: 'Die Haupt-App-Ansicht nach dem Login.' },
  'home': { title: 'Home', cat: 'Einstieg', desc: 'Startseite des Bereichs mit Schnellzugriffen.' },
  'dashboard': { title: 'Dashboard', cat: 'Zentrale', desc: 'Zentrale Übersicht: Status, Kennzahlen, Schnellaktionen.' },
  'status': { title: 'Status', cat: 'Zentrale', desc: 'Live-Status von Bot, Server und LoveAI-Engine.' },
  'statistics': { title: 'Statistiken', cat: 'Zentrale', desc: 'Nutzungs- und Spielstatistiken des Bots.' },
  'year': { title: 'Jahresrückblick', cat: 'Zentrale', desc: 'Dein Bot-Jahr: Highlights und Erfolge.' },
  'level': { title: 'Level & XP', cat: 'Spiel-Systeme', desc: 'Level-System, XP-Verlauf, Prestige-Fortschritt.' },
  'progression': { title: 'Progression', cat: 'Spiel-Systeme', desc: 'Detaillierte Fortschrittsanzeige: Level, Streaks, Meilensteine.' },
  'economy': { title: 'Economy', cat: 'Spiel-Systeme', desc: 'Kupfer-Wirtschaft: Wallet, Bank, Einkommen, Ausgaben.' },
  'bank': { title: 'Bank', cat: 'Spiel-Systeme', desc: 'Bankkonto: Ein-/Auszahlungen, Zinsen, Kapazität.' },
  'leaderboard': { title: 'Leaderboard', cat: 'Spiel-Systeme', desc: 'Ranglisten: Reichste, höchste Level, aktivste Spieler.' },
  'spiele': { title: 'Spiele', cat: 'Spiel-Systeme', desc: 'Minispiele des Bots mit Anleitung und Highscores.' },
  'group': { title: 'Gruppe', cat: 'Gruppen', desc: 'Ansicht einer Gruppe: Level, XP, Ziele, Mitglieder.' },
  'groups': { title: 'Gruppen', cat: 'Gruppen', desc: 'Alle Gruppen des Bots mit Statistiken und Einstellungen.' },
  'ai': { title: 'LoveAI', cat: 'KI', desc: 'Der LoveKI-Chat: Fragen an die Bot-KI, Status der Engine, Memory.' },
  'tickets': { title: 'Ticket-Center', cat: 'Team', desc: 'Team-Dashboard für Support-Tickets: lesen, beantworten (DM an Nutzer), schließen. Supporter/Stellv. Inhaber:in/Inhaber.' },
  'commands': { title: 'Befehle', cat: 'Befehle', desc: 'Befehlsübersicht des Bots nach Kategorien.' },
  'cmd': { title: 'Befehle-Suche', cat: 'Befehle', desc: 'Moderne Befehle-Seite: suchen, filtern, 332 Befehle, 242 Aliase.' },
  'features': { title: 'Features', cat: 'Info', desc: 'Alle Bot-Funktionen im Überblick erklärt.' },
  'docs': { title: 'Dokumentation', cat: 'Info', desc: 'Technische Doku: Architektur, Module, Setup.' },
  'faq': { title: 'FAQ', cat: 'Info', desc: 'Häufige Fragen zum Bot — mit Antworten.' },
  'regeln': { title: 'Regeln', cat: 'Info', desc: 'Bot- und Serverregeln, die alle Nutzer akzeptieren.' },
  'datenschutz': { title: 'Datenschutz', cat: 'Rechtliches', desc: 'Datenschutzerklärung: welche Daten wo gespeichert werden.' },
  'impressum': { title: 'Impressum', cat: 'Rechtliches', desc: 'Impressum und Anbieterkennzeichnung.' },
  'control': { title: 'Steuerung', cat: 'Owner-Zentrale', desc: 'Bot steuern: Start/Stopp, Modul-Schalter, Wartungsmodus.' },
  'settings': { title: 'Einstellungen', cat: 'Owner-Zentrale', desc: 'Globale Bot-Einstellungen (Owner).' },
  'admin': { title: 'Admin', cat: 'Owner-Zentrale', desc: 'Admin-Center: Nutzer, Rechte, Panel-Accounts.' },
  'owners': { title: 'Owners', cat: 'Owner-Zentrale', desc: 'Owner-Verwaltung des Bots.' },
  'logs': { title: 'Logs', cat: 'Owner-Zentrale', desc: 'Server- und Audit-Logs zur Nachvollziehbarkeit.' },
  'reports': { title: 'Reports', cat: 'Owner-Zentrale', desc: 'Gemeldete Nutzer/Vorfälle und ihre Bearbeitung.' },
  'bans': { title: 'Bans', cat: 'Owner-Zentrale', desc: 'Gesperrte Nutzer mit Grund und Dauer.' },
  'badwords': { title: 'Badwords', cat: 'Owner-Zentrale', desc: 'Wortfilter: verbotene Wörter verwalten.' },
  'broadcast': { title: 'Broadcast', cat: 'Owner-Zentrale', desc: 'Rundrund-Nachrichten an alle Nutzer/Gruppen senden.' },
  'notifications': { title: 'Benachrichtigungen', cat: 'Owner-Zentrale', desc: 'Push-Nachrichten und Ankündigungen verwalten.' },
  'profiles': { title: 'Profile', cat: 'Owner-Zentrale', desc: 'Alle Bot-Profile mit Daten und Verlauf.' },
  'sessions': { title: 'Sessions', cat: 'Owner-Zentrale', desc: 'Aktive WhatsApp-/Web-Sitzungen im Blick.' },
  'test': { title: 'Test', cat: 'Owner-Zentrale', desc: 'Interne Testseite (nur Owner).' }
};

/* ── Feature-Bereiche (für „Was kann der Bot?“-Erklärungen) ───────── */
export const BOT_FEATURES = [
  { id: 'xp', name: 'XP & Level', desc: 'XP durch Nachrichten, Befehle und Spiele. Level-Aufstiege, Prestige-System, Streaks.' },
  { id: 'economy', name: 'Economy', desc: 'Kupfer-Währung: Wallet & Bank, Daily-Bonus mit Serien, $work, Zinsen (1 %/24 h), Kapazitäts-Upgrade.' },
  { id: 'love', name: 'Love-System', desc: 'Marry/Beziehungen, Lovematch ($lovecalc), Geschenke, Clans — das Herz des Bots. 💜' },
  { id: 'pets', name: 'Pets', desc: 'Haustiere füttern ($pet feed), spielen, schlafen — mit Levels und Boni.' },
  { id: 'games', name: 'Spiele', desc: 'Minispiele (u. a. Games-Kategorie) mit Einsätzen und Highscores.' },
  { id: 'groups', name: 'Gruppen-System', desc: 'Gruppen-Level/XP, Ziele ($ggoal), Events, Anti-Admin, Top-Listen, Admin-Center ($am).' },
  { id: 'progression', name: 'Progression', desc: 'Prestige, Streaks, Meilensteine (7/30/100/365), Achievements, Jahresrückblick.' },
  { id: 'ai', name: 'LoveKI (AI)', desc: 'Die eigene Bot-KI: $ai im Chat + Web-Chat. Kennt Bot & Website, nur lesend, antwortet immer (3-Stufen-Kette).' },
  { id: 'moderation', name: 'Moderation', desc: 'Badword-Filter, Bans, Reports, Anti-Spam, Rate-Limits.' },
  { id: 'team', name: 'Team & Ränge', desc: 'Ränge: Inhaber (Owner, alles) · Stellv. Inhaber:in (deputy — viel, aber KEINE Ränge vergeben) · Admin · Supporter (NUR Tickets). Ränge vergibt nur der Owner mit $setteam.' },
  { id: 'mute', name: 'Mute-System', desc: 'Owner-only: $mute @user [zeit] stummt User (Nachrichten werden gelöscht), ohne Zeit permanent bis $unmute @user. $mutelist zeigt alle.' },
  { id: 'tickets', name: 'Ticket-System', desc: '$ticket <Anliegen> erstellt ein Ticket (landet in der Dev-Gruppe), Team antwortet/schließt ($ticket answer/close <id>, $tickets, Web: tickets.html).' },
  { id: 'web', name: 'Web-Panel', desc: '40 Seiten: Login per WhatsApp-Code (2FA) + Passwort, Dashboard, Economy, Gruppen, Logs, Steuerung.' },
  { id: 'comms', name: 'Kommunikation', desc: 'Broadcast an alle, Benachrichtigungen, Auto-Antworten.' },
  { id: 'tools', name: 'Alltags-Tools', desc: '$wetter, $übersetze, $qr, $währung, $kurz (Link-Kürzer), $passwort — echte freie APIs.' }
];

/* ── Architektur (für Technik-Fragen) ─────────────────────────────── */
export const ARCHITECTURE = [
  'Love.js — WhatsApp-Bot-Herz (Baileys): Befehle, Spiele, Love, Pets, Gruppen',
  'server.js — Web-Panel-Server (Port 7777): Login (2FA), 40 Seiten, /api/*',
  'ai/ — LoveKI: engine (Kette), providers (Ollama/Cloud/Core), tools (nur lesend), memory, boot',
  'registry/commands.json — alle 332 Befehle + 242 Aliase in 17 Kategorien',
  'Database/ — JSON-Datenbanken (users, ai.json, access.jsonl, sessions)',
  'night/terminal — hübsche Boot-Banner & Logs',
  'public/ — Web-Panel (HTML/CSS/JS, ein Design-System)'
];

/* ── Registry-Fakten (live gelesen) ───────────────────────────────── */
export function registryFacts() {
  try {
    const reg = JSON.parse(fs.readFileSync('registry/commands.json', 'utf8'));
    const cats = (reg.categories || []).map((c) => ({ id: c.id, count: (c.cmds || []).length }));
    const total = cats.reduce((s, c) => s + c.count, 0);
    const aliases = (reg.categories || []).reduce((s, c) => s + (c.cmds || []).reduce((x, cm) => x + (cm.aliases || []).length, 0), 0);
    return { total, aliases, cats: cats.length, categories: cats };
  } catch (e) {
    return { total: 332, aliases: 242, cats: 17, categories: [] };
  }
}

export function botOverview() {
  const reg = registryFacts();
  return {
    name: 'LoveBot',
    version: '7.1',
    tagline: 'WhatsApp-Bot mit XP, Economy, Love-System, Pets, Gruppen & eigener KI (LoveKI)',
    commands: reg.total, aliases: reg.aliases, categories: reg.cats,
    websitePages: Object.keys(WEB_PAGES).length,
    website: 'maxichen.gamebot.me (Web-Panel, Login per WhatsApp-Code + Passwort)',
    features: BOT_FEATURES.map((f) => f.name),
    readOnly: true
  };
}

/* ── Seitensuche ──────────────────────────────────────────────────── */
export function findPages(q = '') {
  const s = String(q || '').toLowerCase().trim();
  if (!s) return [];
  const out = [];
  for (const [file, p] of Object.entries(WEB_PAGES)) {
    if (file.includes(s) || p.title.toLowerCase().includes(s) || p.desc.toLowerCase().includes(s) || p.cat.toLowerCase().includes(s)) {
      out.push({ page: file + '.html', ...p });
    }
  }
  return out;
}

/* Seiten nach Kategorie gruppiert (kompakt) */
export function pagesByCategory() {
  const cats = {};
  for (const [file, p] of Object.entries(WEB_PAGES)) {
    (cats[p.cat] = cats[p.cat] || []).push(file);
  }
  return cats;
}

/* ── Wissens-Block für den System-Prompt (Copilot-Kontext) ────────── */
export function buildBotKnowledge({ maxChars = 1600 } = {}) {
  const reg = registryFacts();
  const topCats = (reg.categories || [])
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)
    .map((c) => c.id + ' (' + c.count + ')')
    .join(', ');
  const txt =
    '### Dein Bot-Wissen (Du bist der Copilot von LoveBot 7.1):\n' +
    `- LoveBot = WhatsApp-Bot (${reg.total} Befehle, ${reg.aliases} Aliase, ${reg.cats} Kategorien; Top: ${topCats}).\n` +
    '- Website: maxichen.gamebot.me — 40 Seiten im Web-Panel. Login: WhatsApp-Code (2FA) + Passwort. Wichtige Seiten: dashboard (Übersicht), economy/bank (Kupfer), level/progression (XP), cmd (Befehlssuche), groups, ai (dieser Chat), logs/control (Owner).\n' +
    '- Features: XP & Level & Prestige, Economy (Daily, $work, Bank-Zinsen 1 %/24 h), Love-System (Marry, Lovematch, Geschenke), Pets, Spiele, Gruppen-Level & Ziele, Achievements, Moderation, Broadcast, Alltags-Tools, Team-Ränge & Ticket-Support ($ticket).\n' +
    '- Für Details nutze IMMER die Tools: getBotOverview, getWebInfo, getCommandDetails, getSystemStatus, searchCommands, getHelp.\n' +
    '- Du darfst NICHTS ändern: keine Tools verändern Daten, du gibst keine Befehle aus, die etwas verändern.';
  return txt.slice(0, maxChars);
}

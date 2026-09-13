/* ═══════════════════════════════════════════════════════════════════
   💜 LoveBot 7.0 — AI TOOLS (ai/tools.js)

   Tool-Layer für LoveAI. Grundsatz:
   · NUR Lese-Tools. Keine Schreib-Tools in 7.0.
   · Jedes Tool bekommt einen minimalen ctx (eigene Daten des Anrufers,
     aktuelle Gruppe, Registry-Auszug) — niemals Secrets, Sessions, IPs.
   · runTool() erzwingt Allowlist + Write-Gate (AI_ALLOW_WRITE, default aus).

   7.1.2: Copilot-Tools — die KI kennt den Bot komplett (erklären ja,
   ändern NEIN): getBotOverview, getWebInfo, getCommandDetails,
   getSystemStatus. Alle write:false — reine Lesefunktionen.

   ctx-Form: { bid, profile, rank, group, groupMeta, counts }
   ═══════════════════════════════════════════════════════════════════ */
import fs from 'fs';
import os from 'os';
import { findPages, pagesByCategory, botOverview, WEB_PAGES } from './knowledge.js';

let regCache = null;
function registry() {
  if (regCache) return regCache;
  try {
    regCache = JSON.parse(fs.readFileSync('registry/commands.json', 'utf8'));
  } catch (e) { regCache = { categories: [] }; }
  return regCache;
}

function allCommands() {
  const out = [];
  for (const c of (registry().categories || [])) {
    for (const x of (c.cmds || [])) out.push({ name: x.name, aliases: x.aliases || [], desc: x.desc || '', cat: c.id });
  }
  return out;
}

function ownSummary(ctx) {
  const p = ctx?.profile || {};
  const prog = p.progression || {};
  const wallet = Math.max(0, Math.floor(Number(p.wallet?.copper) || 0));
  const bank = Math.max(0, Math.floor(Number(p.bank?.copper) || 0));
  return {
    name: p.registration?.name || '–',
    level: prog.level || 0, xp: prog.xp || 0, needed: prog.neededXpForLvOrPrestigeUp || 0,
    totalXp: prog.totalXp || 0, prestige: prog.prestige || 0,
    streak: prog.streak || 0, bestStreak: prog.bestStreak || 0,
    wallet, bank, total: wallet + bank,
    dailyStreak: p.economy?.daily?.streak || 0,
    rank: ctx?.rank?.pos || null, rankTotal: ctx?.rank?.total || 0
  };
}

const HELP_TOPICS = {
  bank: 'Bank: $bank zeigt Guthaben, Kapazität und Zinsen. $deposit <n|all> zahlt ein, $withdraw <n|all> hebt ab, $bank claim holt Zinsen (1 %/24h, max 5.000).',
  xp: 'XP bekommst du durch Nachrichten (nette bringen mehr), Befehle ($x für 2 XP), Spiele, Gifts und Achievements. $me zeigt deinen Stand, $level das Level-System.',
  daily: '$daily holt deine täglichen Kupfer (Serie erhöht den Betrag, Rekord bringt +500 Bonus). Meilensteine: 7/30/100/365 Tage.',
  ai: 'Ich bin LoveAI 💜 — frag mich z. B. nach XP, Bank oder Befehlen. $aiclear löscht diesen Chat-Kontext, $aimemory zeigt dein gespeichertes AI-Gedächtnis.',
  group: 'Gruppen haben eigenes Level/XP ($gxp, $glevel), Top-Listen ($gtop), Ziele ($ggoal), Events ($gevent) und ein Admin-Center ($am).',
  register: 'Registrieren: $register Name[.Alter.Status.Stadt] — danach $me, $daily und $ai ausprobieren!',
  economy: 'Kupfer verdienen: $daily, $work, Spiele, Goals. Übersicht: $economy, Verlauf: $transactions, Reichste: $rich.'
};

const TOOLS = {
  getUserProfile: {
    desc: 'Eigenes Profil: Name, Level, XP, Prestige, Streak, Wallet/Bank, Daily, Rang.',
    write: false,
    run: (_a, ctx) => ownSummary(ctx)
  },
  getLevel: {
    desc: 'Eigenes Level-Detail: Level, XP-Stand, Rest-XP, Total, Prestige.',
    write: false,
    run: (_a, ctx) => {
      const s = ownSummary(ctx);
      return { level: s.level, xp: s.xp, needed: s.needed, totalXp: s.totalXp, prestige: s.prestige };
    }
  },
  getRank: {
    desc: 'Eigener globaler Rang.',
    write: false,
    run: (_a, ctx) => ({ pos: ctx?.rank?.pos || null, total: ctx?.rank?.total || 0 })
  },
  getGroupInfo: {
    desc: 'Aktuelle Gruppe: Name, Mitglieder, Level, XP, Ziele, Kasse, Top-3.',
    write: false,
    run: (_a, ctx) => {
      const g = ctx?.group || {};
      const m = ctx?.groupMeta || {};
      return {
        name: m.subject || g.subject || '–',
        members: m.count ?? g.memberCount ?? 0,
        level: g.xp?.level || 0, xp: g.xp?.total || 0,
        msgs: g.xp?.msgs || 0, streak: g.xp?.streak?.c || 0,
        treasury: g.gtreasury?.balance || 0,
        goals: { daily: g.goals?.daily || null, weekly: g.goals?.weekly || null }
      };
    }
  },
  getEconomy: {
    desc: 'Eigene Economy: Wallet, Bank, Kapazität, Perioden, Daily, Zinsen.',
    write: false,
    run: (_a, ctx) => {
      const s = ownSummary(ctx);
      const e = ctx?.profile?.economy || {};
      return { wallet: s.wallet, bank: s.bank, total: s.total, periods: e.periods || {}, daily: e.daily || {}, interestAt: e.interest?.lastAt || 0 };
    }
  },
  getHelp: {
    desc: 'Hilfe-Thema: bank, xp, daily, ai, group, register, economy.',
    write: false,
    run: (a) => {
      const t = String(a?.topic || a?.q || '').toLowerCase().trim();
      if (HELP_TOPICS[t]) return { topic: t, text: HELP_TOPICS[t] };
      return { topic: t, text: '', hint: 'Unbekanntes Thema — nutze searchCommands für Befehle.' };
    }
  },
  getBotStatus: {
    desc: 'Bot-Status: Version, Uptime, Nutzer-/Gruppen-Zahl, AI-Provider/Modell.',
    write: false,
    run: (_a, ctx) => ({
      version: '7.0', uptimeMin: Math.floor(((ctx?.uptimeMs ?? 0)) / 60000),
      users: ctx?.counts?.users ?? 0, groups: ctx?.counts?.groups ?? 0,
      aiProvider: ctx?.ai?.provider || 'local', aiModel: ctx?.ai?.model || ''
    })
  },
  searchCommands: {
    desc: 'Sucht echte Bot-Befehle in der Registry (Name/Alias/Beschreibung).',
    write: false,
    run: (a) => {
      const q = String(a?.q || a?.query || '').toLowerCase().trim();
      if (!q) return { results: [] };
      const hits = [];
      for (const c of allCommands()) {
        if (c.name.includes(q) || c.desc.toLowerCase().includes(q) || c.aliases.some((x) => x.includes(q))) {
          hits.push({ cmd: '$' + c.name, desc: c.desc });
          if (hits.length >= 5) break;
        }
      }
      return { results: hits };
    }
  },

  /* ── 7.1.2: COPILOT-TOOLS (alles read-only) ─────────────────────── */

  getBotOverview: {
    desc: 'Bot-Steckbrief: Version, Befehle/Kategorien, Features, Website-Infos.',
    write: false,
    run: () => botOverview()
  },
  getWebInfo: {
    desc: 'Website/Web-Panel erklären: alle Seiten (leeres q) oder Seitensuche (q).',
    write: false,
    run: (a) => {
      const q = String(a?.q || a?.page || '').toLowerCase().trim();
      if (!q) {
        return { website: 'maxichen.gamebot.me', login: 'WhatsApp-Code (2FA) + Passwort', total: Object.keys(WEB_PAGES).length, pagesByCategory: pagesByCategory() };
      }
      const pages = findPages(q).slice(0, 5);
      return { query: q, pages: pages.length ? pages : [], hint: pages.length ? '' : 'Keine Seite gefunden — frage ohne q für alle Seiten.' };
    }
  },
  getCommandDetails: {
    desc: 'Details zu EINEM Befehl: Name, Aliase, Kategorie, Beschreibung (q = Name).',
    write: false,
    run: (a) => {
      const q = String(a?.q || a?.cmd || a?.name || '').toLowerCase().replace(/^\$+/, '').trim();
      if (!q) return { hint: 'Bitte Befehlsname angeben, z. B. getCommandDetails({"q":"daily"}).' };
      const all = allCommands();
      let exact = all.find((c) => c.name === q) || all.find((c) => c.aliases.includes(q));
      if (!exact) exact = all.find((c) => c.name.includes(q) || c.aliases.some((x) => x.includes(q)));
      if (!exact) return { query: q, found: false, hint: 'Nicht gefunden — nutze searchCommands für die Suche.' };
      return { found: true, cmd: '$' + exact.name, aliases: exact.aliases.map((x) => '$' + x), category: exact.cat, desc: exact.desc };
    }
  },
  getSystemStatus: {
    desc: 'Live-System: Uptime, RAM, Node, Platform, DB-Dateigrößen, Registry-Zahlen.',
    write: false,
    run: (_a, ctx) => {
      const dbs = {};
      try {
        for (const f of ['Database.json', 'ai.json', 'sessions.json']) {
          try { dbs[f] = Math.round(fs.statSync('Database/' + f).size / 1024) + ' KB'; } catch (e) {}
        }
      } catch (e) {}
      const mu = process.memoryUsage();
      return {
        version: '7.1', node: process.version, platform: os.platform(),
        uptimeMin: Math.floor(((ctx?.uptimeMs ?? 0)) / 60000),
        ramUsedMb: Math.round(mu.rss / 1048576), ramFreeMb: Math.round(os.freemem() / 1048576),
        ramTotalMb: Math.round(os.totalmem() / 1048576),
        users: ctx?.counts?.users ?? 0, groups: ctx?.counts?.groups ?? 0,
        dbSizes: dbs
      };
    }
  }
};

export function toolNames() {
  return Object.keys(TOOLS);
}

export function toolSpec() {
  return Object.entries(TOOLS).map(([name, t]) => ({ name, desc: t.desc }));
}

/* Erlaubnis-Gate: nur registrierte Lese-Tools; Write immer blockiert (7.0). */
export function runTool(name, args = {}, ctx = {}) {
  const t = TOOLS[name];
  if (!t) return { ok: false, error: 'unknown-tool' };
  if (t.write && process.env.AI_ALLOW_WRITE !== 'true') {
    return { ok: false, error: 'write-blocked' };
  }
  try {
    const data = t.run(args || {}, ctx || {});
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: 'tool-error' };
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   💜  L O V E B O T   L E V E L   S Y S T E M   v5.0  (levelsystem.js)
   ─────────────────────────────────────────────────────────────────────
   Das komplette Fortschrittssystem des Bots: XP, Levels, Ränge,
   Prestige, Belohnungen, Anti-Spam-Fenster & nette-Nachrichten-Erkennung.

   • Gleiche Progressions-Kurve wie die offizielle SQL-Tabelle
     (neededXpForLvOrPrestigeUp.sql): Basis 743 XP, je Level ×1.00743,
     744 Level pro Prestige-Zyklus (Level 0–743), max. 743 Prestiges.
   • Schreibzugriff ausschließlich auf den übergebenen Profil-Objekt —
     das Modul selbst speichert NICHT (Love.js / loveplus.js entscheiden,
     wann saveUserProfile() läuft). So bleibt es testbar & losgekoppelt.
   • DSGVO: XP wird erst vergeben, wenn das Profil registriert ist UND
     die DSGVO-Zustimmung vorliegt (Prüfung in der Anbindung, Helper
     `xpEligible()` hier).

   XP-QUELLEN (Alle Werte sind hier die einzige Wahrheit):
   ┌──────────────────────────────┬──────────────────────────────────┐
   │ Quelle                       │ XP                               │
   ├──────────────────────────────┼──────────────────────────────────┤
   │ Nachricht (1:1-Chat)         │ +5                               │
   │ Nachricht (Gruppe)           │ +3                               │
   │ nette Nachricht (1–2 Treffer)│ Basis ×2                         │
   │ Liebesnachricht (3+ Treffer) │ Basis ×3                         │
   │ Kompliment-Muster "du bist…" │ zusätzlich +5                    │
   │ Jeder Befehl                 │ +2                               │
   │ Liebes-Aktion ($kiss, …)     │ +5                               │
   │ $daily                       │ +50                              │
   │ $dailylove                   │ +25 (aus lovecore)               │
   │ $work                        │ +10                              │
   │ Spiel-Sieg (Galgen/Rätsel/…) │ +15                              │
   │ Spiel-Niederlage             │ +2                               │
   ├──────────────────────────────┼──────────────────────────────────┤
   │ Obergrenze Nachrichten/Std.  │ 300 XP                           │
   │ Obergrenze Befehle/Std.      │ 150 XP                           │
   │ Erste Aktion des Tages       │ +10 (organische Quellen)         │
   │ Streak-Boni (7/30/100 Tage)  │ +50 / +200 / +1000               │
   │ Streak-Multiplikator         │ +5/10/25 % (Cap +25 %)            │
   │ XP-Verlauf / Daily-Summen    │ 40 Einträge / 35 Tage            │
   │ Tages-/Wochenziele           │ XP/Msg/Cmd/Spiele → Kupfer (5.0)   │
   │ Rekorde / Tages-Aktivität    │ persistent / 35 Tage               │
   │ Level-Up-Belohnung           │ regelbar (Def: 20+5·Lv, max 400) │
   │ Prestige-Up-Belohnung        │ regelbar (Def: 10.000 Kupfer)    │
   │ Claim-Truhen (5.0)             │ Lv 25/75/150/200/250 + Prestige   │
   │ Titel (5.0)                    │ 9 Level-Titel + Spezial-Titel    │
   │ Badges (5.0)                   │ 39 in 6 Bereichen, mit Stufen    │
   └──────────────────────────────┴──────────────────────────────────┘
   ══════════════════════════════════════════════════════════════════ */

import { emit as engineEmit } from './loveengine.js';
import { notify as notifyUser } from './notifications.js';

/* ─────────────────────────────────────────────────────────────────────
   PROGRESSION 2.0 — XP-REGEL-ENGINE (konfigurierbar)
   Alle XP-Werte, Multiplikatoren und Anti-Farm-Parameter liegen in
   Database/xp-rules.json und können im Owner-Center (⭐ XP & Level →
   Regeln) geändert werden — Versionierung + Step-up + Audit.
   Datenschutz: Es wird KEIN Nachrichtentext gespeichert — nur
   Kurz-Hashes, Typ, Betrag, Zeitstempel (DSGVO Art. 5 Datenminimierung).
   ───────────────────────────────────────────────────────────────────── */
import fs from 'node:fs';
import path from 'node:path';
const XP_RULES_FILE = path.join('Database', 'xp-rules.json');

export const XP_RULES_DEFAULTS = {
  multipliers: { weekend: 1.25, event: 1.0, eventActive: false, eventName: '', eventEndsAt: null, prestigePerLevel: 0.05, prestigeCap: 0.5, streak: { enabled: true, d3: 0.05, d7: 0.10, d30: 0.25, cap: 0.25 }, totalCap: 3.0, ownerBonus: { enabled: true, bonus: 0.10 } },
  categories: {
    message:    { enabled: true, oneToOne: 5, group: 3, kindMult: 2, loveMult: 3, complimentBonus: 5 },
    command:    { enabled: true, base: 2, loveAction: 5 },
    compliment: { enabled: true, sender: 8, recipient: 5, cooldownSec: 300, dailyCap: 30 },
    game:       { enabled: true, win: 15, loss: 2 },
    daily:      { enabled: true, daily: 50, dailylove: 25, work: 10 },
    media:      { enabled: true, firstDownload: 15, firstProvider: 10, dailyCap: 3 }
  },
  antiFarm: {
    msgCapPerHour: 300, cmdCapPerHour: 150,
    msgCooldownSec: 60, /* ⏳ Nachrichten-XP nur alle X Sekunden (Anti-Spam, blockiert den Chat NICHT) */
    duplicateWindowSec: 45, duplicateMaxPerDay: 5,
    mutualFarmMaxPerHour: 6,
    suspiciousXpPerDay: 1500
  },
  bonuses: {
    enabled: true,
    firstActionDaily: 10, /* ⭐ Erste XP-Aktion des Tages (nur organische Quellen) */
    streak7: 50, streak30: 200, streak100: 1000 /* 🔥 Streak-Meilenstein-Boni */
  },
  goals: {
    enabled: true,
    dailyXp: 50, weeklyXp: 500,          /* 🎯 Tages-/Wochenziel (XP aus xpDaily) */
    dailyCopper: 50, weeklyCopper: 250,  /* Kupfer-Belohnung — KEINE XP-Inflation */
    dailyMessages: 25, dailyCommands: 10, /* 💬⌨️ Tagesziele aus statsDaily (5.0) */
    weeklyMessages: 150, weeklyGames: 5,  /* 💬🎮 Wochenziele aus statsDaily (5.0) */
    monthlyXp: 2000, monthlyCopper: 1000, monthlyXpBonus: 100 /* 📅 Monatsziel (6.0): Kupfer + einmaliger XP-Bonus, gedeckelt */
  },
  xpRewards: { achievement: 5, giftGiven: 3, giftReceived: 0 }, /* 🎁 soziale XP-Quellen (6.0, klein + gedeckelt) */
  economy: {
    coinCap: 999999999999,            /* 🪙 Sicherheits-Obergrenze pro Vault (Overflow-Schutz) */
    transferMin: 1, transferMax: 10000, transferDailyCap: 50000, /* 💸 Transfer-Limits */
    bankBase: 100000, bankPerLevel: 100, bankPerPrestige: 5000, bankPerAchievement: 50, /* 🏦 Kapazität */
    interestPct: 1.0, interestCap: 5000, interestCooldownH: 24, /* 📈 Tageszins auf Bankguthaben */
    starterCopper: 500, starterXp: 25,  /* 🎁 einmalige Start-Boni bei $register */
    dailyBase: 200, dailyStreakPct: 5, dailyStreakCapPct: 100, dailyBestBonus: 500, /* 📅 Daily-Regeln */
    dailyMilestones: { d7: 1000, d30: 5000, d100: 20000, d365: 100000 }, /* 🏆 Streak-Meilensteine */
    weeklyBase: 1000, monthlyBase: 5000, yearlyBase: 50000 /* 🗓️ Wochen-/Monats-/Jahres-Bonus bei Streak */
  },
  rewards: {
    levelCopperBase: 20, levelCopperPerLevel: 5, levelCopperCap: 400, /* 🎁 Level-Up-Kupfer (5.0 regelbar) */
    prestigeCopper: 10000,                /* 👑 Prestige-Up-Kupfer (5.0 regelbar) */
    goalMinorCopper: 25,                  /* 🎯 Kupfer für Nachrichten-/Befehls-/Spiele-Ziele */
    chests: { lv25: 500, lv75: 1500, lv150: 3000, lv200: 5000, lv250: 7500, prestige: 2500 } /* 🎁 Claim-Truhen, einmalig */
  }
};

function loadXpRules() {
  let r = null;
  try { r = JSON.parse(fs.readFileSync(XP_RULES_FILE, 'utf8')); } catch (e) {}
  const merge = (a, b) => {
    if (a && typeof a === 'object' && !Array.isArray(a) && b && typeof b === 'object' && !Array.isArray(b)) {
      const out = { ...a };
      for (const k of Object.keys(b)) out[k] = merge(a[k], b[k]);
      return out;
    }
    return b === undefined ? a : b;
  };
  const merged = merge(XP_RULES_DEFAULTS, r || {});
  return {
    version: Number(r?.version) || 1,
    updatedAt: r?.updatedAt || null,
    updatedBy: r?.updatedBy || 'defaults',
    ...merged
  };
}
let XP_RULES = null;
export function xpRules() {
  if (!XP_RULES) {
    try {
      XP_RULES = loadXpRules();
      try {
        if (!fs.existsSync(XP_RULES_FILE)) fs.writeFileSync(XP_RULES_FILE, JSON.stringify(XP_RULES, null, 2), 'utf8');
      } catch (e) {}
    } catch (e) {
      XP_RULES = { version: 1, updatedAt: null, updatedBy: 'defaults', ...XP_RULES_DEFAULTS };
    }
  }
  return XP_RULES;
}
/** Speichert geänderte Regeln (Owner-Center) — Versionierung + Audit im Server-Endpoint. */
export function saveXpRules(rules, actor) {
  const next = {
    version: (Number(XP_RULES?.version) || 0) + 1,
    updatedAt: new Date().toISOString(),
    updatedBy: String(actor || '?'),
    multipliers: rules.multipliers || XP_RULES.multipliers,
    categories: rules.categories || XP_RULES.categories,
    antiFarm: rules.antiFarm || XP_RULES.antiFarm,
    bonuses: rules.bonuses || XP_RULES.bonuses,
    goals: rules.goals || XP_RULES.goals,
    rewards: rules.rewards || XP_RULES.rewards,
    xpRewards: rules.xpRewards || XP_RULES.xpRewards,
    economy: rules.economy || XP_RULES.economy
  };
  XP_RULES = next;
  try { fs.writeFileSync(XP_RULES_FILE, JSON.stringify(XP_RULES, null, 2), 'utf8'); } catch (e) {}
  return XP_RULES;
}

/* Anti-Farm-Zustand (nur In-Memory — keine Texte, keine Langzeit-Profile) */
const mutualFarmMap = new Map();   /* sortiertes Paar "a|b" → [ts …] (letzte Stunde) */
const complimentCd = new Map();    /* "a>b" → letzter Zeitstempel */

function djb2(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16);
}
function normText(text) {
  return String(text || '').toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 80);
}
function touchMutual(a, b, now, max) {
  if (!a || !b || a === b) return false;
  const key = [a, b].sort().join('|');
  const cutoff = now - 3600_000;
  const arr = (mutualFarmMap.get(key) || []).filter((t) => t >= cutoff);
  arr.push(now);
  mutualFarmMap.set(key, arr);
  if (mutualFarmMap.size > 2000) for (const [k, v] of mutualFarmMap) if (v.every((t) => t < cutoff)) mutualFarmMap.delete(k);
  return arr.length > max;
}
function checkCooldown(a, b, sec, now) {
  const key = a + '>' + b;
  const last = complimentCd.get(key) || 0;
  if (now - last < sec * 1000) return true;
  complimentCd.set(key, now);
  if (complimentCd.size > 5000) for (const [k, t] of complimentCd) if (now - t > 3600_000) complimentCd.delete(k);
  return false;
}


const PROGRESSION = Object.freeze({
  maxLevel: 743,
  maxPrestige: 743,
  baseNeededXp: 743,
  growthNumerator: 100743,
  growthDenominator: 100000
});

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
export const MSG_CAP_PER_HOUR = 300;
export const CMD_CAP_PER_HOUR = 150;
export const XP = Object.freeze({
  msg1to1: 5,
  msgGroup: 3,
  command: 2,
  loveAction: 5,
  daily: 50,
  dailylove: 25,
  work: 10,
  gameWin: 15,
  gameLoss: 2,
  complimentBonus: 5
});

/* ─────────────────────────────────────────────────────────────────────
   Progressions-Kurve (BigInt, identisch zur SQL-Referenz)
   ───────────────────────────────────────────────────────────────────── */

const CURVE_CACHE = [BigInt(PROGRESSION.baseNeededXp)];

function curveIndex(level, prestige) {
  const rawLevel = Math.max(0, Math.floor(Number(level) || 0));
  const rawPrestige = Math.max(0, Math.floor(Number(prestige) || 0));
  const clampedLevel = rawLevel > PROGRESSION.maxLevel ? PROGRESSION.maxLevel : rawLevel;
  const clampedPrestige = rawPrestige > PROGRESSION.maxPrestige ? PROGRESSION.maxPrestige : rawPrestige;
  return clampedPrestige * (PROGRESSION.maxLevel + 1) + clampedLevel;
}

function toSafeNumber(bigValue) {
  const maxSafe = BigInt(Number.MAX_SAFE_INTEGER);
  return bigValue > maxSafe ? Number.MAX_SAFE_INTEGER : Number(bigValue);
}

/** XP, die vom Level `level` (im Prestige `prestige`) zum nächsten Level/Prestige-Up nötig sind. */
export function neededXp(level, prestige) {
  const idx = curveIndex(level, prestige);
  while (CURVE_CACHE.length <= idx) {
    const prev = CURVE_CACHE[CURVE_CACHE.length - 1];
    const next = (prev * BigInt(PROGRESSION.growthNumerator)
      + (BigInt(PROGRESSION.growthDenominator) - 1n))
      / BigInt(PROGRESSION.growthDenominator);
    CURVE_CACHE.push(next);
  }
  return toSafeNumber(CURVE_CACHE[idx]);
}

/* ─────────────────────────────────────────────────────────────────────
   Ränge & Prestige-Titel
   ───────────────────────────────────────────────────────────────────── */

const LEVEL_RANKS = [
  [0, '🐣', 'Neuling'],
  [5, '🌱', 'Einsteiger'],
  [10, '🌸', 'Herzling'],
  [25, '🌷', 'Flirter'],
  [50, '💕', 'Romantiker'],
  [75, '💌', 'Liebespoet(in)'],
  [100, '🌹', 'Rose des Herzens'],
  [150, '❤️', 'Herzensbrecher(in)'],
  [200, '🔥', 'Flammenherz'],
  [300, '⚡', 'Liebesblitz'],
  [400, '🌟', 'Liebesstern'],
  [500, '👑', 'Herzfürst(in)'],
  [600, '🎩', 'Love-Magnat'],
  [700, '💎', 'Legende des Herzens'],
  [743, '💖', 'Mythisch']
];

const PRESTIGE_TITLES = [
  [1, '🕊️', 'Herzengel'],
  [2, '🌹', 'Rosenritter(in)'],
  [3, '💜', 'Liebe-As'],
  [4, '🌙', 'Stern der Liebe'],
  [5, '🌌', 'Love-Mythos']
];
const PRESTIGE_MAX_TITLE = ['✨', 'Unsterbliches Herz'];

/* ─────────────────────────────────────────────────────────────────────
   LEVEL-TITEL (Progression 3.0) — automatisch verdient, Anzeige im
   Profil & in Ranglisten. Getrennt vom frei wählbaren $title (identity).
   ───────────────────────────────────────────────────────────────────── */
export const TITLES = [
  { min: 0,   emoji: '🌱', name: 'Newcomer' },
  { min: 5,   emoji: '💜', name: 'Regular' },
  { min: 10,  emoji: '⭐', name: 'Active' },
  { min: 20,  emoji: '🔥', name: 'Veteran' },
  { min: 50,  emoji: '👑', name: 'Elite' },
  { min: 100, emoji: '💎', name: 'Legendary' },
  { min: 200, emoji: '🌌', name: 'Mythic' },
  { min: 400, emoji: '✨', name: 'Immortal' },
  { min: 600, emoji: '🪐', name: 'Eternal' }
];

/** Nächster Titel nach `level` (oder null am Ende). */
export function nextTitleFor(level = 0) {
  const l = Math.max(0, Math.floor(Number(level) || 0));
  return TITLES.find((t) => t.min > l) || null;
}

/** Aktiver Titel des Profils (User-Wahl oder höchster verdienter). */
export function activeTitleFor(profile) {
  const p = profile?.progression;
  if (p?.activeTitle && typeof p.activeTitle === 'object') return p.activeTitle;
  if (p?.title && typeof p.title === 'object') return p.title;
  return titleFor(p?.level || 0);
}

/* ─────────────────────────────────────────────────────────────────────
   SPEZIAL-TITEL (Progression 5.0) — Verdienstquellen jenseits von Level:
   Prestige, Achievement-Sammlung, Streak. `test(p, achCount)` entscheidet
   live über echte Profildaten; vergeben wird nichts Vorläufiges.
   ───────────────────────────────────────────────────────────────────── */
export const SPECIAL_TITLES = [
  { emoji: '🕊️', name: 'Herzengel',     source: 'prestige', need: 'Prestige 1',    test: (p) => (p.prestige || 0) >= 1 },
  { emoji: '💜', name: 'Liebes-As',     source: 'prestige', need: 'Prestige 3',    test: (p) => (p.prestige || 0) >= 3 },
  { emoji: '🌌', name: 'Love-Mythos',   source: 'prestige', need: 'Prestige 5',    test: (p) => (p.prestige || 0) >= 5 },
  { emoji: '🏅', name: 'Trophäenjäger', source: 'collection', need: '25 Achievements', test: (p, a) => (a || 0) >= 25 },
  { emoji: '🏆', name: 'Legendenjäger', source: 'collection', need: '50 Achievements', test: (p, a) => (a || 0) >= 50 },
  { emoji: '🔥', name: 'Unaufhaltsam',  source: 'streak', need: '30-Tage-Streak',  test: (p) => Math.max(Number(p.streak) || 0, Number(p.streaks?.daily?.c) || 0) >= 30 }
];

/** Alle aktuell VERDIENTEN Titel: Level-Titel + erfüllte Spezial-Titel. */
export function availableTitles(profile, achCount = 0) {
  const p = ensureProgression(profile);
  if (!p) return [];
  const out = TITLES.filter((t) => t.min <= (p.level || 0)).map((t) => ({ min: t.min, emoji: t.emoji, name: t.name, source: 'level' }));
  for (const s of SPECIAL_TITLES) {
    let ok = false;
    try { ok = !!s.test(p, achCount); } catch (e) { ok = false; }
    if (ok) out.push({ min: -1, emoji: s.emoji, name: s.name, source: s.source, need: s.need });
  }
  return out;
}

/** Setzt einen VERDIENTEN Titel als aktiv (Name, case-insensitive). */
export function setActiveTitle(profile, name, { achCount = 0 } = {}) {
  const p = ensureProgression(profile);
  if (!p) return { ok: false, reason: 'no-profile' };
  const want = String(name || '').trim().toLowerCase();
  const earned = availableTitles(profile, achCount);
  const hit = earned.find((t) => t.name.toLowerCase() === want);
  if (!hit) return { ok: false, reason: 'not-earned', earned: earned.map((t) => t.name) };
  p.activeTitle = { min: hit.min, emoji: hit.emoji, name: hit.name, source: hit.source || 'level' };
  if ((hit.source || 'level') === 'level') {
    p.title = { min: hit.min, emoji: hit.emoji, name: hit.name };
    if ((p.titleLevel || 0) < hit.min) p.titleLevel = hit.min;
  }
  return { ok: true, title: { ...p.activeTitle } };
}

/** Höchster verdienter Level-Titel für `level`. */
export function titleFor(level = 0) {
  const l = Math.max(0, Math.floor(Number(level) || 0));
  let cur = TITLES[0];
  for (const t of TITLES) if (l >= t.min) cur = t;
  return { min: cur.min, emoji: cur.emoji, name: cur.name };
}

/** Rang-Titel fürs aktuelle Level (innerhalb des Prestige-Zyklus). */
export function rankFor(prestige = 0, level = 0) {
  const p = Math.max(0, Math.floor(Number(prestige) || 0));
  const l = Math.max(0, Math.min(PROGRESSION.maxLevel, Math.floor(Number(level) || 0)));
  let cur = LEVEL_RANKS[0];
  for (const r of LEVEL_RANKS) if (l >= r[0]) cur = r;
  const pTitle = p >= 6 ? PRESTIGE_MAX_TITLE : (PRESTIGE_TITLES.find((t) => p >= t[0]) || null);
  return {
    min: cur[0],
    emoji: cur[1],
    title: cur[2],
    prestigeTitle: pTitle ? pTitle[1] : null,
    prestigeTitleEmoji: pTitle ? pTitle[0] : null,
    full: pTitle ? `${cur[1]} ${cur[2]} · ${pTitle[0]} ${pTitle[1]} (P${p})` : `${cur[1]} ${cur[2]}`
  };
}

/** Der nächste noch zu erreichende Rang (für "noch X Level bis …"). */
export function nextRankFor(prestige = 0, level = 0) {
  const l = Math.max(0, Math.min(PROGRESSION.maxLevel, Math.floor(Number(level) || 0)));
  const p = Math.max(0, Math.floor(Number(prestige) || 0));
  const nextL = LEVEL_RANKS.find((r) => r[0] > l);
  if (nextL) return { ...rankFor(0, nextL[0]), min: nextL[0], remainingLevels: nextL[0] - l };
  if (p < PROGRESSION.maxPrestige) {
    const pTitle = (p + 1) >= 6 ? PRESTIGE_MAX_TITLE : (PRESTIGE_TITLES.find((t) => p + 1 >= t[0]) || null);
    return {
      min: PROGRESSION.maxLevel + 1,
      emoji: '✨', title: 'Prestige-Up',
      prestigeTitle: pTitle ? pTitle[1] : null,
      remainingLevels: PROGRESSION.maxLevel + 1 - l,
      isPrestige: true
    };
  }
  return null;
}

/* ─────────────────────────────────────────────────────────────────────
   Nette-Nachrichten-Erkennung (de)
   ───────────────────────────────────────────────────────────────────── */

const LOVE_WORDS = [
  'lieb', 'liebe', 'liebst', 'herz', 'herzens', 'verliebt', 'verlieb', 'knuddel',
  'schatz', 'schätzchen', 'süß', 'süss', 'sweet', 'honey', 'babycake', 'schön',
  'schoen', 'wunderschön', 'toll', 'wunderbar', 'traumhaft', 'perfekt', 'mein herz',
  'mein schatz', 'mein liebling', 'ich mag dich', 'ich liebe dich', 'ich vermisse dich',
  'ich denk an dich', 'denk an dich', 'ich freu mich', 'freu mich auf dich', 'gute nacht',
  'guten morgen', 'alles gute', 'immer dich', 'forever', 'zusammen', 'du und ich',
  'mit dir', 'du bist so', 'du bist der', 'du bist die', 'du machst mich', 'du mein',
  'ich hab dich', 'hab dich lieb', 'mein schmetterling', 'meine sunshine'
];

/* HINWEIS: keine leeren Einträge — '' matched per includes() JEDEN Text (+XP-Inflation)! */
const LOVE_EMOJIS = ['❤️', '🥰', '😍', '😘', '💖', '💗', '💓', '💘', '💝', '🌹', '💐', '🧸', '✨', '🫶', '🩷', '😻', '🌸', '💕'];

const COMPLIMENT_RE = /du\s+bist\s+(so\s+|wirklich\s+|mal\s+|derart\s+|einfach\s+)*(schön|schoen|toll|süß|süss|sweet|lustig|kreativ|das beste|wunderschön|mein schatz|meine|der liebe|die liebe)/i;

/**
 * Bewertet einen Nachrichtentext.
 * @returns {{kind:'love'|'kind'|'normal', mult:number, bonus:number, score:number, label:string}}
 */
export function detectKindText(text = '') {
  const t = String(text || '').toLowerCase();
  if (!t.trim()) return { kind: 'normal', mult: 1, bonus: 0, score: 0, label: 'Nachricht' };
  let score = 0;
  for (const w of LOVE_WORDS) if (t.includes(w)) score += 1;
  for (const e of LOVE_EMOJIS) if (e && t.includes(e)) score += 1;
  let bonus = 0;
  if (COMPLIMENT_RE.test(t)) bonus = XP.complimentBonus;
  if (score >= 3) return { kind: 'love', mult: 3, bonus, score, label: 'Liebesnachricht 💜' };
  if (score >= 1) return { kind: 'kind', mult: 2, bonus, score, label: 'nette Nachricht 💕' };
  return { kind: 'normal', mult: 1, bonus: 0, score: 0, label: 'Nachricht' };
}

/* ─────────────────────────────────────────────────────────────────────
   Profil-Progression
   ───────────────────────────────────────────────────────────────────── */

/** Aktivitäts-Zähler für Badges/Achievements/Statistiken (migriert, ohne Überschreiben). */
export function ensureStats(profile) {
  if (!profile) return null;
  const s = profile.stats || {};
  for (const k of ['messages', 'commands', 'games', 'gameWins', 'gameLosses', 'loveActions', 'complimentsGiven', 'dailiesClaimed', 'workClaimed', 'dailyloveClaimed']) {
    s[k] = Math.max(0, Number(s[k]) || 0);
  }
  profile.stats = s;
  return s;
}

/** Stellt sicher, dass `profile.progression` im aktuellen Format existiert (migrated falls nötig). */
export function ensureProgression(profile) {
  if (!profile) return null;
  const p = profile.progression || {};
  p.level = Math.max(0, Math.floor(Number(p.level) || 0));
  p.prestige = Math.max(0, Math.floor(Number(p.prestige) || 0));
  p.xp = Math.max(0, Number(p.xp) || 0);
  if (!Number.isFinite(p.neededXpForLvOrPrestigeUp) || p.neededXpForLvOrPrestigeUp < 743) {
    p.neededXpForLvOrPrestigeUp = neededXp(p.level, p.prestige);
  }
  p.totalXp = Math.max(0, Number(p.totalXp) || 0);
  p.lastMsgXpAt = Math.max(0, Number(p.lastMsgXpAt) || 0); /* ⏳ Nachrichten-XP-Cooldown (Migration: 0 = sofort berechtigt) */
  p.streak = Math.max(0, Number(p.streak) || 0);
  p.xpWindow = Array.isArray(p.xpWindow) ? p.xpWindow : [];
  p.xpSources = p.xpSources || { messages: 0, love: 0, commands: 0, games: 0, dailies: 0, work: 0, compliments: 0, media: 0 };
  /* Progression 2.0: drei getrennte Streaks, XP-Log (ohne Texte), Daily-Zähler,
     Meilenstein-Freischaltungen, Einmal-Flags (Media-XP) */
  p.streaks = p.streaks || { daily: { c: 0, last: '' }, chat: { c: 0, last: '' }, xp: { c: 0, last: '' } };
  for (const k of ['daily', 'chat', 'xp']) {
    p.streaks[k] = p.streaks[k] || { c: 0, last: '' };
    p.streaks[k].c = Math.max(0, Number(p.streaks[k].c) || 0);
  }
  p.xpLog = Array.isArray(p.xpLog) ? p.xpLog : [];
  p.xpDaily = Array.isArray(p.xpDaily) ? p.xpDaily : [];
  /* 📅 Monats-Aggregate (6.0): XP + Aktivität je YYYY-MM, max. 24 Monate */
  p.xpMonthly = (p.xpMonthly && typeof p.xpMonthly === 'object' && !Array.isArray(p.xpMonthly)) ? p.xpMonthly : {};
  pruneMonthlyMap(p.xpMonthly);
  p.statsMonthly = (p.statsMonthly && typeof p.statsMonthly === 'object' && !Array.isArray(p.statsMonthly)) ? p.statsMonthly : {};
  pruneMonthlyMap(p.statsMonthly);
  p.recentMsgs = Array.isArray(p.recentMsgs) ? p.recentMsgs : [];
  p.unlocks = p.unlocks || {};
  /* Progression 3.0: Titel, Badges, Rekord-Streak (Migration ohne Überschreiben) */
  p.title = p.title || null;              /* {min,emoji,name} — höchster verdienter Level-Titel */
  p.titleLevel = Math.max(0, Number(p.titleLevel) || 0);
  p.badges = p.badges || {};              /* Badge-ID → Vergabe-Zeitstempel */
  p.bestStreak = Math.max(0, Number(p.bestStreak) || 0);
  /* Progression 4.0: Rekorde, Tages-Aktivität, Reward-Summen, aktiver Titel */
  p.records = p.records || {};
  for (const k of ['highestLevel', 'highestDailyXp', 'mostXpOneAction']) p.records[k] = Math.max(0, Number(p.records[k]) || 0);
  if (!p.records.highestDailyXp && (p.xpDaily || []).length) {
    p.records.highestDailyXp = Math.max(0, ...p.xpDaily.map((e) => Number(e.a) || 0)); /* echte Historie */
  }
  p.statsDaily = Array.isArray(p.statsDaily) ? p.statsDaily : [];
  p.rewardsClaimed = p.rewardsClaimed || {};
  p.rewardsClaimed.copper = Math.max(0, Number(p.rewardsClaimed.copper) || 0);
  if (!p.activeTitle || typeof p.activeTitle !== 'object') p.activeTitle = null;
  if (!p.activeTitle && p.title && typeof p.title === 'object') p.activeTitle = { ...p.title };
  /* Progression 5.0: Reward-Ledger, Claim-Truhen, Ziel-Streak, Zeit-Aktivität, Rank-Historie */
  p.rewardsLog = Array.isArray(p.rewardsLog) ? p.rewardsLog : [];
  if (p.rewardsLog.length > 30) p.rewardsLog.splice(0, p.rewardsLog.length - 30);
  p.pendingRewards = Array.isArray(p.pendingRewards) ? p.pendingRewards.filter((r) => r && r.id) : [];
  p.goalStreak = p.goalStreak || {};
  p.goalStreak.c = Math.max(0, Number(p.goalStreak.c) || 0);
  p.goalStreak.best = Math.max(Number(p.goalStreak.best) || 0, p.goalStreak.c);
  p.goalStreak.last = typeof p.goalStreak.last === 'string' ? p.goalStreak.last : '';
  if (!Array.isArray(p.hourActivity) || p.hourActivity.length !== 24) {
    const h = Array.isArray(p.hourActivity) ? p.hourActivity : [];
    p.hourActivity = Array.from({ length: 24 }, (_, i) => Math.max(0, Math.floor(Number(h[i]) || 0)));
  }
  if (!Array.isArray(p.weekdayActivity) || p.weekdayActivity.length !== 7) {
    const w = Array.isArray(p.weekdayActivity) ? p.weekdayActivity : [];
    p.weekdayActivity = Array.from({ length: 7 }, (_, i) => Math.max(0, Math.floor(Number(w[i]) || 0)));
  }
  p.rankHistory = Array.isArray(p.rankHistory) ? p.rankHistory.filter((r) => r && r.w) : [];
  if (p.rankHistory.length > 12) p.rankHistory.splice(0, p.rankHistory.length - 12);
  migrateRewardsLog(p); /* 🧾 Ledger aus vorhandenen Unlocks rekonstruieren (einmalig) */
  ensureStats(profile);
  profile.flags = profile.flags || {};
  profile.flags.media = profile.flags.media || { first: null, providers: {}, day: '', count: 0 };
  profile.progression = p;
  return p;
}

/* ─────────────────────────────────────────────────────────────────────
   REWARD-LEDGER (Progression 5.0): jede Kupfer-Gutschrift aus Meilenstein,
   Ziel, Truhe oder Prestige landet begrenzt (30) in `p.rewardsLog`.
   Migration: vorhandene Unlock-Keys werden einmalig importiert (Betrag
   unbekannt → copper null → Anzeige „–“, ehrlich statt erfunden).
   ───────────────────────────────────────────────────────────────────── */
function logReward(p, kind, label, copper, now) {
  if (!p) return;
  p.rewardsLog = Array.isArray(p.rewardsLog) ? p.rewardsLog : [];
  p.rewardsLog.push({ t: now, kind: String(kind || 'misc'), label: String(label || '').slice(0, 60), copper: Math.max(0, Math.floor(Number(copper) || 0)) });
  if (p.rewardsLog.length > 30) p.rewardsLog.splice(0, p.rewardsLog.length - 30);
}

function migrateRewardsLog(p) {
  if (!p || p.rewardsLogMigrated || !p.unlocks) return;
  const rows = [];
  for (const [k, at] of Object.entries(p.unlocks)) {
    if (k.startsWith('goal-d')) rows.push({ t: at || 0, kind: 'dailygoal', label: '🎯 Tagesziel ' + k.slice(6), copper: null });
    else if (k.startsWith('goal-w')) rows.push({ t: at || 0, kind: 'weeklygoal', label: '🏆 Wochenziel ' + k.slice(6), copper: null });
    else if (k.startsWith('goal-m')) rows.push({ t: at || 0, kind: 'monthlygoal', label: '📅 Monatsziel ' + k.slice(6), copper: null });
    else if (k.startsWith('goal-dm')) rows.push({ t: at || 0, kind: 'dailygoal', label: '💬 Nachrichtenziel ' + k.slice(7), copper: null });
    else if (k.startsWith('goal-dc')) rows.push({ t: at || 0, kind: 'dailygoal', label: '⌨️ Befehlsziel ' + k.slice(7), copper: null });
    else if (k.startsWith('goal-wm')) rows.push({ t: at || 0, kind: 'weeklygoal', label: '💬 Wochen-Nachrichten ' + k.slice(7), copper: null });
    else if (k.startsWith('goal-wg')) rows.push({ t: at || 0, kind: 'weeklygoal', label: '🎮 Wochen-Spiele ' + k.slice(7), copper: null });
    else if (/^lv\d+$/.test(k)) rows.push({ t: at || 0, kind: 'milestone', label: '🎁 Meilenstein Lv ' + k.slice(2), copper: null });
  }
  rows.sort((a, b) => (a.t || 0) - (b.t || 0));
  for (const r of rows.slice(-30)) p.rewardsLog.push(r);
  p.rewardsLogMigrated = true;
}

/** Progression-2.0-Helfer: Streak-Tick (einmal pro Kalendertag pro Art). */
function tickStreak(p, kind, now, minXp = 0) {
  const st = p.streaks?.[kind];
  if (!st) return 0;
  const today = dayKey(now);
  if (st.last === today) return st.c;
  const yesterday = dayKey(now - DAY_MS);
  const dayAmount = (p.xpDaily || []).find((e) => e.d === today)?.a || 0;
  const prevAmount = (p.xpDaily || []).find((e) => e.d === yesterday)?.a || 0;
  const continues = st.last === yesterday && (kind !== 'xp' || prevAmount >= minXp);
  st.c = continues ? st.c + 1 : 1;
  st.last = today;
  if (kind === 'xp' && dayAmount < minXp) { st.c = Math.min(st.c, 1); }
  return st.c;
}

/** DSGVO/Registrierung-Check: darf diesem Profil XP gewährt werden? */
export function xpEligible(profile) {
  return !!(
    profile
    && profile.registration
    && profile.registration.registered === true
    && profile.status
    && profile.status.dsgvo
    && profile.status.dsgvo.accepted === true
  );
}

function dayKey(ts = Date.now()) {
  return new Date(ts).toISOString().slice(0, 10);
}

/** ISO-Kalenderwochen-Schlüssel `YYYY-Www` (für Wochenziele, stabil über Jahresgrenzen). */
export function isoWeekKey(ts = Date.now()) {
  const d = new Date(ts);
  const day = (d.getUTCDay() + 6) % 7;
  const thu = new Date(d);
  thu.setUTCDate(d.getUTCDate() - day + 3);
  const firstThu = new Date(Date.UTC(thu.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((thu - firstThu) / DAY_MS - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7);
  return thu.getUTCFullYear() + '-W' + String(week).padStart(2, '0');
}

/** XP-Summe der Kalenderwoche von `now` (aus xpDaily). */
export function weekXpSum(profile, now = Date.now()) {
  const p = profile?.progression || profile || {};
  const wk = isoWeekKey(now);
  return ((p.xpDaily || []).filter((e) => e && e.d && isoWeekKey(new Date(e.d + 'T00:00:00Z').getTime()) === wk)
    .reduce((s, e) => s + (Number(e.a) || 0), 0));
}

/** Monatsschlüssel YYYY-MM (UTC). */
export function monthKey(ts = Date.now()) {
  return new Date(ts).toISOString().slice(0, 7);
}

/** Begrenzt Monats-Maps auf die 24 neuesten Schlüssel (Migration + laufend). */
function pruneMonthlyMap(map) {
  if (!map || typeof map !== 'object') return;
  const keys = Object.keys(map).sort();
  while (keys.length > 24) delete map[keys.shift()];
}

/** XP-Summe des laufenden Monats aus xpMonthly (Fallback: xpDaily filter). */
export function monthXpSum(profile, now = Date.now()) {
  const p = profile?.progression || profile || {};
  const mk = monthKey(now);
  if (p.xpMonthly && typeof p.xpMonthly === 'object' && Number(p.xpMonthly[mk]) >= 0) return Number(p.xpMonthly[mk]) || 0;
  return ((p.xpDaily || []).filter((e) => e && e.d && String(e.d).slice(0, 7) === mk)
    .reduce((sum, e) => sum + (Number(e.a) || 0), 0));
}

/** XP-Summe der letzten 12 Monate (inkl. laufendem) — Basis für $yearly. */
export function yearXpSum(profile, now = Date.now()) {
  const p = profile?.progression || profile || {};
  const mk = monthKey(now);
  let sum = 0;
  for (const [k, v] of Object.entries(p.xpMonthly || {})) {
    if (k <= mk && k >= String(Number(mk.slice(0, 4)) - 1) + mk.slice(4)) sum += Number(v) || 0;
  }
  return sum;
}

/** Monats-Aktivität {m,c,g,w} aus statsMonthly (Fallback: statsDaily filter). */
export function monthStatsSum(profile, now = Date.now()) {
  const p = profile?.progression || profile || {};
  const mk = monthKey(now);
  const hit = p.statsMonthly && typeof p.statsMonthly === 'object' ? p.statsMonthly[mk] : null;
  if (hit && typeof hit === 'object') return { m: Number(hit.m) || 0, c: Number(hit.c) || 0, g: Number(hit.g) || 0, w: Number(hit.w) || 0 };
  const out = { m: 0, c: 0, g: 0, w: 0 };
  for (const e of (p.statsDaily || [])) {
    if (!e || !e.d || String(e.d).slice(0, 7) !== mk) continue;
    out.m += Number(e.m) || 0; out.c += Number(e.c) || 0; out.g += Number(e.g) || 0; out.w += Number(e.w) || 0;
  }
  return out;
}

/** Jahres-Aktivität (letzte 12 Monate) aus statsMonthly. */
export function yearStatsSum(profile, now = Date.now()) {
  const p = profile?.progression || profile || {};
  const mk = monthKey(now);
  const cut = String(Number(mk.slice(0, 4)) - 1) + mk.slice(4);
  const out = { m: 0, c: 0, g: 0, w: 0 };
  for (const [k, v] of Object.entries(p.statsMonthly || {})) {
    if (k > mk || k < cut || !v || typeof v !== 'object') continue;
    out.m += Number(v.m) || 0; out.c += Number(v.c) || 0; out.g += Number(v.g) || 0; out.w += Number(v.w) || 0;
  }
  return out;
}

/** Tages-Aktivitätszähler (bounded, 35 Tage): m=Nachrichten c=Befehle g=Spiele w=Siege. */
function bumpStatsDaily(p, now, field) {
  const d = dayKey(now);
  let e = (p.statsDaily || []).find((x) => x && x.d === d);
  if (!e) { e = { d, m: 0, c: 0, g: 0, w: 0 }; p.statsDaily.push(e); }
  if (field === 'm') e.m += 1;
  else if (field === 'c') e.c += 1;
  else if (field === 'g') e.g += 1;
  else if (field === 'w') { e.g += 1; e.w += 1; }
  if (p.statsDaily.length > 35) p.statsDaily.splice(0, p.statsDaily.length - 35);
  /* 📅 Monats-Spiegel (6.0) für Monats-/Jahres-Reports */
  const mk = monthKey(now);
  p.statsMonthly = (p.statsMonthly && typeof p.statsMonthly === 'object' && !Array.isArray(p.statsMonthly)) ? p.statsMonthly : {};
  const mm = p.statsMonthly[mk] || (p.statsMonthly[mk] = { d: mk, m: 0, c: 0, g: 0, w: 0 });
  if (field === 'm') mm.m += 1;
  else if (field === 'c') mm.c += 1;
  else if (field === 'g') mm.g += 1;
  else if (field === 'w') { mm.g += 1; mm.w += 1; }
  pruneMonthlyMap(p.statsMonthly);
}

/** Zentrale Spiel-Erfassung: Stats + Tages-Zähler (Love.js ruft das aus grantGameXp). */
export function recordGamePlayed(profile, outcome = null, now = Date.now()) {
  const p = ensureProgression(profile);
  if (!p) return null;
  const st = ensureStats(profile);
  st.games += 1;
  if (outcome === 'win') st.gameWins += 1;
  else if (outcome === 'loss') st.gameLosses += 1;
  bumpStatsDaily(p, now, outcome === 'win' ? 'w' : 'g');
  return st;
}

function pruneWindow(p, now) {
  const cutoff = now - HOUR_MS;
  p.xpWindow = (p.xpWindow || []).filter((e) => e && e.t >= cutoff);
  if (p.xpWindow.length > 400) p.xpWindow = p.xpWindow.slice(-400);
}

function windowUsed(p, source) {
  return (p.xpWindow || []).reduce((s, e) => (e.s === source ? s + e.a : s), 0);
}

function levelPct(p) {
  const need = Math.max(1, Number(p.neededXpForLvOrPrestigeUp) || 1);
  const maxed = p.prestige >= PROGRESSION.maxPrestige && p.level >= PROGRESSION.maxLevel;
  const pct = maxed ? 100 : Math.max(0, Math.min(100, Math.round((Number(p.xp) / need) * 100)));
  return pct;
}

function bar(pct, len = 12) {
  const filled = Math.max(0, Math.min(len, Math.round(pct / 100 * len)));
  return '▰'.repeat(filled) + '▱'.repeat(Math.max(0, len - filled));
}

const de = (n) => Number(n || 0).toLocaleString('de-DE');

/* 🪙 Coin-Hook (6.0): die Economy-Engine (economy.js) registriert hier einen
   Logger, damit auch interne Kupfer-Gutschriften (Level/Meilenstein/Ziele)
   im Transaktions-Log + Statistiken landen. Kein Import-Zyklus. */
let coinHook = null;
export function setCoinHook(fn) { coinHook = typeof fn === 'function' ? fn : null; }
function addWallet(profile, copper, source = 'reward') {
  if (!copper) return;
  profile.wallet = profile.wallet || { copper: 0, silver: 0, gold: 0, platin: 0 };
  profile.wallet.copper = Math.max(0, (Number(profile.wallet.copper) || 0) + copper);
  if (coinHook) { try { coinHook({ profile, delta: copper, balance: profile.wallet.copper, source }); } catch (e) {} }
}

/**
 * Vergibt XP und verarbeitet alle Level-/Prestige-Ups.
 * @param {object} profile  komplettes User-Profil (wird verändert)
 * @param {number} amount   XP-Betrag (>= 0)
 * @param {{source?:string, now?:number, capped?:boolean}} opts
 * @returns {{granted:number, copper:number, events:Array, maxed:boolean, capped:boolean, prog:object}}
 */
export function grantXp(profile, amount, { source = 'general', now = Date.now(), _skipGoals = false, _skipBadges = false } = {}) {
  const p = ensureProgression(profile);
  let amt = Math.max(0, Math.floor(Number(amount) || 0));
  const events = [];
  if (!amt) return { granted: 0, copper: 0, events, maxed: false, capped: false, prog: p };

  const wasMaxed = p.prestige >= PROGRESSION.maxPrestige && p.level >= PROGRESSION.maxLevel;
  p.xp = Math.min(Number.MAX_SAFE_INTEGER - 1024, (Number(p.xp) || 0) + amt);
  p.totalXp = Math.min(Number.MAX_SAFE_INTEGER, (Number(p.totalXp) || 0) + amt);
  p.xpSources[source] = (Number(p.xpSources[source]) || 0) + amt;
  p.lastXpAt = now;

  /* Streak: 1 Tag = 1 XP-Vergabe an diesem Kalendertag (Legacy-Feld) */
  const BONUS_SOURCES = new Set(['messages', 'love', 'commands', 'media', 'games', 'compliments']);
  const today = dayKey(now);
  const streakBefore = Number(p.streak) || 0;
  let isNewDay = false;
  if (p.lastActiveDay !== today) {
    p.streak = (p.lastActiveDay === dayKey(now - DAY_MS)) ? streakBefore + 1 : 1;
    p.lastActiveDay = today;
    isNewDay = true;
  }
  const streakGrew = p.streak > streakBefore;
  if (p.streak > p.bestStreak) p.bestStreak = p.streak; /* 🏆 Rekord-Serie */
  /* 🎁 Tages- & Streak-Boni (Progression 3.0, nur organische Quellen —
     Dailies/Admin sind selbst schon Boni und doppeln nicht) */
  const bonusCfg = xpRules().bonuses || {};
  let bonus = 0;
  if (bonusCfg.enabled && BONUS_SOURCES.has(source)) {
    if (isNewDay && Number(bonusCfg.firstActionDaily) > 0) {
      const bAmt = Math.floor(Number(bonusCfg.firstActionDaily));
      bonus += bAmt;
      events.push({ type: 'daybonus', amount: bAmt });
    }
    for (const days of [7, 30, 100]) {
      if (streakBefore < days && p.streak >= days && Number(bonusCfg['streak' + days]) > 0) {
        const bAmt = Math.floor(Number(bonusCfg['streak' + days]));
        bonus += bAmt;
        events.push({ type: 'streakbonus', days, amount: bAmt });
      }
    }
  }
  if (bonus > 0) {
    amt += bonus;
    p.xp = Math.min(Number.MAX_SAFE_INTEGER - 1024, (Number(p.xp) || 0) + bonus);
    p.totalXp = Math.min(Number.MAX_SAFE_INTEGER, (Number(p.totalXp) || 0) + bonus);
    p.xpSources[source] = (Number(p.xpSources[source]) || 0) + bonus;
  }

  /* Progression 2.0: XP-Log (OHNE Text — nur Typ/Betrag/Zeit, max. 40) +
     Daily-Zähler (max. 35 Tage) + drei getrennte Streaks */
  if (source !== 'admin') {
    p.xpLog.push({ s: source, a: amt, t: now });
    if (p.xpLog.length > 40) p.xpLog.splice(0, p.xpLog.length - 40);
    const dKey = dayKey(now);
    const dEntry = (p.xpDaily || []).find((e) => e.d === dKey);
    if (dEntry) dEntry.a += amt; else p.xpDaily.push({ d: dKey, a: amt });
    if (p.xpDaily.length > 35) p.xpDaily.splice(0, p.xpDaily.length - 35);
    /* 📅 Monats-Summe (6.0): Basis für Monatsziel + Monats-/Jahres-Reports */
    const mKey = monthKey(now);
    p.xpMonthly[mKey] = Math.max(0, (Number(p.xpMonthly[mKey]) || 0) + amt);
    pruneMonthlyMap(p.xpMonthly);
    tickStreak(p, 'daily', now);
    tickStreak(p, 'xp', now, 50); /* XP-Streak: min. 50 XP am Tag */
    /* 🕒 Echte Zeit-Aktivität (5.0): nur organische Quellen, nie Admin */
    if (Array.isArray(p.hourActivity) && p.hourActivity.length === 24) {
      const hh = new Date(now).getHours();
      p.hourActivity[hh] = Math.max(0, (Number(p.hourActivity[hh]) || 0) + 1);
    }
    if (Array.isArray(p.weekdayActivity) && p.weekdayActivity.length === 7) {
      const wd = (new Date(now).getDay() + 6) % 7; /* Mo=0 … So=6 */
      p.weekdayActivity[wd] = Math.max(0, (Number(p.weekdayActivity[wd]) || 0) + 1);
    }
  }

  let copper = 0;
  const rwCfg = xpRules().rewards || {}; /* 🎁 regelbar seit 5.0 (Defaults = bisher) */
  const lvBase = Number(rwCfg.levelCopperBase ?? 20) || 0;
  const lvPer = Number(rwCfg.levelCopperPerLevel ?? 5) || 0;
  const lvCap = Math.max(0, Number(rwCfg.levelCopperCap ?? 400) || 0);
  const prestigeCopper = Math.max(0, Math.floor(Number(rwCfg.prestigeCopper ?? 10000) || 0));
  let need = neededXp(p.level, p.prestige);
  while (!wasMaxed && p.xp >= need) {
    p.xp -= need;
    p.level += 1;
    if (p.level > PROGRESSION.maxLevel) {
      /* Prestige-Up: neues Kapitel beginnt bei Level 0 */
      p.prestige = Math.min(PROGRESSION.maxPrestige, p.prestige + 1);
      p.level = 0;
      copper += prestigeCopper;
      events.push({ type: 'prestige', prestige: p.prestige, rank: rankFor(p.prestige, 0), copper: prestigeCopper });
      logReward(p, 'prestige', '👑 Prestige ' + p.prestige, prestigeCopper, now);
      /* 🎁 Prestige-Truhe (5.0, claimbar, einmalig pro Prestige-Stufe) */
      const chestKey = 'chest-p' + p.prestige;
      if (!p.unlocks[chestKey]) {
        p.unlocks[chestKey] = now;
        const chestAmt = chestAmount('prestige');
        p.pendingRewards.push({ id: chestKey, label: '👑 Prestige-' + p.prestige + '-Truhe', copper: chestAmt, at: now });
        events.push({ type: 'chest', id: chestKey, label: '👑 Prestige-' + p.prestige + '-Truhe', copper: chestAmt });
      }
    } else {
      copper += Math.min(lvCap, lvBase + lvPer * p.level);
      events.push({ type: 'levelup', level: p.level, rank: rankFor(p.prestige, p.level) });
    }
    need = neededXp(p.level, p.prestige);
  }
  p.neededXpForLvOrPrestigeUp = need;
  if (p.prestige >= PROGRESSION.maxPrestige && p.level >= PROGRESSION.maxLevel) p.xp = need - 1; /* MAX: volle Leiste */
  addWallet(profile, copper, events.some((e) => e.type === 'prestige') ? 'prestige' : 'levelup');
  p.rewardsClaimed.copper += copper; /* 🎁 lebenslange Reward-Summe */

  /* 🎁 Meilenstein-Freischaltungen (Progression 2.0, mit Kupfer seit 3.0) */
  for (const m of MILESTONES) {
    if (p.level >= m.level && p.prestige === 0 && !p.unlocks['lv' + m.level]) {
      p.unlocks['lv' + m.level] = now;
      const mCoins = Math.max(0, Math.floor(Number(m.coins) || 0));
      if (mCoins > 0) { addWallet(profile, mCoins, 'milestone'); copper += mCoins; }
      logReward(p, 'milestone', '🎁 Meilenstein Lv ' + m.level, mCoins, now);
      events.push({ type: 'milestone', level: m.level, reward: m.label, coins: mCoins });
    }
  }
  /* 🎁 Level-Truhen (5.0, claimbar statt auto): Lv 25/75/150/200/250 */
  for (const cl of CHEST_LEVELS) {
    const ck = 'chest-lv' + cl;
    if (p.level >= cl && p.prestige === 0 && !p.unlocks[ck]) {
      p.unlocks[ck] = now;
      const cAmt = chestAmount('lv' + cl);
      p.pendingRewards.push({ id: ck, label: '🎁 Truhe Level ' + cl, copper: cAmt, at: now });
      events.push({ type: 'chest', id: ck, label: '🎁 Truhe Level ' + cl, copper: cAmt });
    }
  }

  /* 📛 Höchster verdienter Level-Titel (Progression 3.0) */
  const earnedTitle = titleFor(p.level);
  if (!p.title && earnedTitle.min === 0) {
    /* 🌱 Migrations-/Start-Titel: still speichern, kein Event-Spam */
    p.title = { min: 0, emoji: earnedTitle.emoji, name: earnedTitle.name };
  } else if ((p.titleLevel || 0) < earnedTitle.min) {
    p.titleLevel = earnedTitle.min;
    p.title = { min: earnedTitle.min, emoji: earnedTitle.emoji, name: earnedTitle.name };
    p.activeTitle = { ...p.title }; /* neuer Höchsttitel wird aktiv */
    events.push({ type: 'title', min: earnedTitle.min, emoji: earnedTitle.emoji, name: earnedTitle.name });
  }
  if (!p.activeTitle && p.title) p.activeTitle = { ...p.title };

  /* 🎯 Tages-/Wochenziele (4.0 XP-Ziele, 5.0 +Nachrichten/Befehle/Spiele) — Kupfer, keine XP-Inflation */
  const goalCfg = xpRules().goals || {};
  if (goalCfg.enabled && source !== 'admin' && !_skipGoals) {
    const touchGoalStreak = () => {
      const gs = p.goalStreak || (p.goalStreak = { c: 0, best: 0, last: '' });
      if (gs.last === today) return gs.c;
      const yesterday = dayKey(now - DAY_MS);
      gs.c = (gs.last === yesterday) ? gs.c + 1 : 1;
      gs.last = today;
      gs.best = Math.max(Number(gs.best) || 0, gs.c);
      return gs.c;
    };
    const grantGoal = (key, label, rw, evType, extra) => {
      if (p.unlocks[key]) return;
      p.unlocks[key] = now;
      const amt = Math.max(0, Math.floor(Number(rw) || 0));
      if (amt > 0) { addWallet(profile, amt, evType); copper += amt; p.rewardsClaimed.copper += amt; }
      logReward(p, evType, label, amt, now);
      const ev = { type: evType, ...extra, reward: amt };
      if (evType === 'dailygoal') ev.streak = touchGoalStreak();
      events.push(ev);
    };
    const dGoal = Number(goalCfg.dailyXp) || 0;
    const todayEntry = (p.xpDaily || []).find((e) => e.d === today);
    if (dGoal > 0 && todayEntry && todayEntry.a >= dGoal) {
      grantGoal('goal-d' + today, '🎯 Tagesziel ' + today, goalCfg.dailyCopper, 'dailygoal', { goal: 'xp', target: dGoal });
    }
    const wGoal = Number(goalCfg.weeklyXp) || 0;
    if (wGoal > 0 && weekXpSum(p, now) >= wGoal) {
      const wk = isoWeekKey(now);
      grantGoal('goal-w' + wk, '🏆 Wochenziel ' + wk, goalCfg.weeklyCopper, 'weeklygoal', { goal: 'xp', target: wGoal });
    }
    /* 💬⌨️🎮 Zusatz-Ziele aus echten Tageszählern (statsDaily, 5.0) */
    const minor = Math.max(0, Math.floor(Number(rwCfg.goalMinorCopper ?? 25) || 0));
    const todayStats = (p.statsDaily || []).find((e) => e && e.d === today) || {};
    const wkNow = isoWeekKey(now);
    let weekM = 0, weekG = 0;
    for (const e of (p.statsDaily || [])) {
      if (!e || !e.d) continue;
      if (isoWeekKey(new Date(e.d + 'T00:00:00Z').getTime()) === wkNow) { weekM += Number(e.m) || 0; weekG += Number(e.g) || 0; }
    }
    const dMsg = Number(goalCfg.dailyMessages) || 0;
    if (dMsg > 0 && (Number(todayStats.m) || 0) >= dMsg) {
      grantGoal('goal-dm' + today, '💬 Nachrichtenziel ' + today, minor, 'dailygoal', { goal: 'messages', target: dMsg });
    }
    const dCmd = Number(goalCfg.dailyCommands) || 0;
    if (dCmd > 0 && (Number(todayStats.c) || 0) >= dCmd) {
      grantGoal('goal-dc' + today, '⌨️ Befehlsziel ' + today, minor, 'dailygoal', { goal: 'commands', target: dCmd });
    }
    const wMsg = Number(goalCfg.weeklyMessages) || 0;
    if (wMsg > 0 && weekM >= wMsg) {
      grantGoal('goal-wm' + wkNow, '💬 Wochen-Nachrichten ' + wkNow, minor, 'weeklygoal', { goal: 'messages', target: wMsg });
    }
    const wGam = Number(goalCfg.weeklyGames) || 0;
    if (wGam > 0 && weekG >= wGam) {
      grantGoal('goal-wg' + wkNow, '🎮 Wochen-Spiele ' + wkNow, minor, 'weeklygoal', { goal: 'games', target: wGam });
    }
    /* 📅 Monatsziel (6.0): einmalig pro Monat — Kupfer sofort, XP-Bonus via geschachtelter Vergabe (ohne Ziel-Rekursion) */
    const mGoal = Number(goalCfg.monthlyXp) || 0;
    const mKey = monthKey(now);
    if (mGoal > 0 && monthXpSum(p, now) >= mGoal && !p.unlocks['goal-m' + mKey]) {
      grantGoal('goal-m' + mKey, '📅 Monatsziel ' + mKey, goalCfg.monthlyCopper, 'monthlygoal', { goal: 'xp', target: mGoal });
      const mBonus = Math.max(0, Math.floor(Number(goalCfg.monthlyXpBonus) || 0));
      if (mBonus > 0) {
        const bres = grantXp(profile, mBonus, { source: 'monthlybonus', now, _skipGoals: true, _skipBadges });
        copper += bres.copper || 0;
        for (const bev of (bres.events || [])) events.push(bev);
      }
    }
  }

  /* 🏆 Rekorde (Progression 4.0) */
  if (p.level > p.records.highestLevel) p.records.highestLevel = p.level;
  const todayXpNow = (p.xpDaily || []).find((e) => e.d === today)?.a || 0;
  if (todayXpNow > p.records.highestDailyXp) p.records.highestDailyXp = todayXpNow;
  if (amt > p.records.mostXpOneAction) p.records.mostXpOneAction = amt;
  /* 🏅 Badge-Vergabe (Progression 3.0) — _skipBadges: der Award-Loop
     (loveplus, mit korrektem gotCount) übernimmt sie (6.0) */
  if (!_skipBadges) {
    for (const b of awardBadges(profile, now)) {
      events.push({ type: 'badge', id: b.id, emoji: b.emoji, name: b.name, desc: b.desc });
    }
  }

  /* 💜 LoveCore: Events für Live-Feed & Owner-Center (nie werfend) */
  const evtBase = { bid: profile?.identity?.bid || '', name: profile?.registration?.name || '', source };
  engineEmit('XP_GRANTED', { ...evtBase, granted: amt, level: p.level });
  for (const ev of events) {
    if (ev.type === 'levelup') {
      engineEmit('LEVEL_UP', { ...evtBase, level: ev.level, xp: p.xp });
      try { notifyUser(evtBase.bid || '', 'levelup', { title: '⭐ Level ' + ev.level + ' erreicht!', text: 'Neuer Rang: ' + (ev.rank?.full || '') + ' · +' + copper + ' Kupfer', link: '/level.html' }); } catch (e) {}
    }
    if (ev.type === 'prestige') engineEmit('PRESTIGE_UP', { ...evtBase, prestige: ev.prestige, level: 0 });
    if (ev.type === 'milestone') {
      engineEmit('ACHIEVEMENT_UNLOCKED', { ...evtBase, item: 'Meilenstein Lv ' + ev.level + ' — ' + ev.reward });
      engineEmit('MILESTONE_REACHED', { ...evtBase, level: ev.level, item: ev.reward });
      if (Number(ev.coins) > 0) engineEmit('REWARD_GRANTED', { ...evtBase, kind: 'milestone', granted: Number(ev.coins) });
      try { notifyUser(evtBase.bid || '', 'achievement', { title: '🎁 Meilenstein Level ' + ev.level, text: 'Freigeschaltet: ' + ev.reward, link: '/level.html' }); } catch (e) {}
    }
    if (ev.type === 'dailygoal' || ev.type === 'weeklygoal') {
      engineEmit('GOAL_COMPLETED', { ...evtBase, kind: ev.type === 'dailygoal' ? 'daily' : 'weekly', target: ev.target });
      if (Number(ev.reward) > 0) engineEmit('REWARD_GRANTED', { ...evtBase, kind: ev.type, granted: Number(ev.reward) });
      try { notifyUser(evtBase.bid || '', 'daily', { title: (ev.type === 'dailygoal' ? '🎯 Tagesziel erreicht!' : '🏆 Wochenziel erreicht!'), text: '+' + ev.reward + ' Kupfer Belohnung', link: '/level.html' }); } catch (e) {}
    }
    if (ev.type === 'title') engineEmit('TITLE_EARNED', { ...evtBase, item: ev.emoji + ' ' + ev.name });
    if (ev.type === 'badge') {
      engineEmit('BADGE_UNLOCKED', { ...evtBase, item: ev.emoji + ' ' + ev.name });
      try { notifyUser(evtBase.bid || '', 'achievement', { title: '🏅 Neues Badge: ' + ev.name, text: ev.desc || '', link: '/level.html' }); } catch (e) {}
    }
    if (ev.type === 'streakbonus') engineEmit('STREAK_MILESTONE', { ...evtBase, days: ev.days, granted: ev.amount });
  }
  if (copper > 0) engineEmit('COINS_EARNED', { ...evtBase, granted: copper, reason: events.some((e) => e.type === 'prestige') ? 'prestige' : 'levelup' });
  if (streakGrew) engineEmit('STREAK_UPDATED', { ...evtBase, streak: p.streak });
  /* 🔥 XP-Streak-Meilensteine (3/7/14/30/60/100) */
  const xpStreakC = p.streaks?.xp?.c || 0;
  if ([3, 7, 14, 30, 60, 100].includes(xpStreakC)) {
    try { notifyUser(evtBase.bid || '', 'streak', { title: '🔥 ' + xpStreakC + '-Tage-XP-Streak!', text: 'Jeden Tag Fortschritt — weiter so!', link: '/level.html' }); } catch (e) {}
  }

  return { granted: amt, copper, events, maxed: wasMaxed, capped: false, prog: p };
}

/* ─────────────────────────────────────────────────────────────────────
   PROGRESSION 2.0 — MEILENSTEINE & MULTIPLIKATOREN
   ───────────────────────────────────────────────────────────────────── */

/** Meilenstein-Freischaltungen pro Level (Zyklus 0) — Titel/Cosmetics. */
export const MILESTONES = [
  { level: 5,   label: '🌱 Sweetheart', coins: 100 },
  { level: 10,  label: '💜 Profil-Rahmen', coins: 250 },
  { level: 20,  label: '🌹 Romantiker', coins: 500 },
  { level: 25,  label: '🔥 Durchstarter', coins: 750 },
  { level: 30,  label: '💎 Elite-Status', coins: 1000 },
  { level: 50,  label: '👑 Master', coins: 2500 },
  { level: 75,  label: '⚡ Champion', coins: 3750 },
  { level: 100, label: '🌌 Eternal', coins: 5000 },
  { level: 150, label: '💫 Legendenstatus', coins: 7500 },
  { level: 200, label: '🌠 Mythos', coins: 10000 },
  { level: 250, label: '✨ Titan', coins: 15000 }
];

/* ─────────────────────────────────────────────────────────────────────
   BADGES (Progression 3.0) — einmalige, permanente Auszeichnungen für
   Level- & Streak-Meilensteine. Vergabe automatisch in grantXp(),
   gespeichert in progression.badges (ID → Zeitstempel).
   ───────────────────────────────────────────────────────────────────── */
export const BADGE_AREAS = [
  { id: 'level', emoji: '⭐', name: 'Level' },
  { id: 'streak', emoji: '🔥', name: 'Streak' },
  { id: 'chat', emoji: '💬', name: 'Chat' },
  { id: 'games', emoji: '🎮', name: 'Spiele' },
  { id: 'social', emoji: '💜', name: 'Social' },
  { id: 'collection', emoji: '🏅', name: 'Sammlung' }
];

export const BADGES = [
  { id: 'first_steps', emoji: '🌱', name: 'Erste Schritte', desc: 'Level 1 erreicht', area: 'level', metric: 'level', need: 1, series: 'level', tier: 1, tiers: 8, test: (p) => p.level >= 1 },
  { id: 'rising_star', emoji: '⭐', name: 'Aufsteiger', desc: 'Level 10 erreicht', area: 'level', metric: 'level', need: 10, series: 'level', tier: 2, tiers: 8, test: (p) => p.level >= 10 },
  { id: 'veteran',     emoji: '🔥', name: 'Veteran', desc: 'Level 25 erreicht', area: 'level', metric: 'level', need: 25, series: 'level', tier: 3, tiers: 8, test: (p) => p.level >= 25 },
  { id: 'elite',       emoji: '👑', name: 'Elite', desc: 'Level 50 erreicht', area: 'level', metric: 'level', need: 50, series: 'level', tier: 4, tiers: 8, test: (p) => p.level >= 50 },
  { id: 'legend',      emoji: '💎', name: 'Legende', desc: 'Level 100 erreicht', area: 'level', metric: 'level', need: 100, series: 'level', tier: 5, tiers: 8, test: (p) => p.level >= 100 },
  { id: 'mythic',      emoji: '🌌', name: 'Mythisch', desc: 'Level 200 erreicht', area: 'level', metric: 'level', need: 200, series: 'level', tier: 6, tiers: 8, test: (p) => p.level >= 200 },
  { id: 'immortal',    emoji: '✨', name: 'Unsterblich', desc: 'Level 400 erreicht', area: 'level', metric: 'level', need: 400, series: 'level', tier: 7, tiers: 8, test: (p) => p.level >= 400 },
  { id: 'eternal_600', emoji: '🪐', name: 'Ewigkeit', desc: 'Level 600 erreicht', area: 'level', metric: 'level', need: 600, series: 'level', tier: 8, tiers: 8, test: (p) => p.level >= 600 },
  { id: 'streak_7',    emoji: '🔥', name: '7-Tage-Streak', desc: '7 Tage in Folge aktiv', area: 'streak', metric: 'streak', need: 7, series: 'streak', tier: 1, tiers: 6, test: (p) => streakBest(p) >= 7 },
  { id: 'consistent_14', emoji: '☄️', name: 'Konsequent', desc: '14 Tage in Folge aktiv', area: 'streak', metric: 'streak', need: 14, series: 'streak', tier: 2, tiers: 6, test: (p) => streakBest(p) >= 14 },
  { id: 'streak_30',   emoji: '☄️', name: '30-Tage-Streak', desc: '30 Tage in Folge aktiv', area: 'streak', metric: 'streak', need: 30, series: 'streak', tier: 3, tiers: 6, test: (p) => streakBest(p) >= 30 },
  { id: 'streak_60',   emoji: '🌠', name: '60-Tage-Streak', desc: '60 Tage in Folge aktiv', area: 'streak', metric: 'streak', need: 60, series: 'streak', tier: 4, tiers: 6, test: (p) => streakBest(p) >= 60 },
  { id: 'streak_100',  emoji: '💫', name: '100-Tage-Streak', desc: '100 Tage in Folge aktiv', area: 'streak', metric: 'streak', need: 100, series: 'streak', tier: 5, tiers: 6, test: (p) => streakBest(p) >= 100 },
  { id: 'streak_365',  emoji: '🏆', name: 'Jahres-Streak', desc: '365 Tage in Folge aktiv', area: 'streak', metric: 'streak', need: 365, series: 'streak', tier: 6, tiers: 6, test: (p) => streakBest(p) >= 365 },
  { id: 'chatter_100',   emoji: '💬', name: 'Schwatzhaft', desc: '100 Nachrichten geschrieben', area: 'chat', metric: 'messages', need: 100, series: 'chatter', tier: 1, tiers: 5, test: (p, c, s) => (s.messages || 0) >= 100 },
  { id: 'chatter_500',   emoji: '🗨️', name: 'Plaudertasche', desc: '500 Nachrichten geschrieben', area: 'chat', metric: 'messages', need: 500, series: 'chatter', tier: 2, tiers: 5, test: (p, c, s) => (s.messages || 0) >= 500 },
  { id: 'chatter_1000',  emoji: '💬', name: 'Stammtisch', desc: '1.000 Nachrichten geschrieben', area: 'chat', metric: 'messages', need: 1000, series: 'chatter', tier: 3, tiers: 5, test: (p, c, s) => (s.messages || 0) >= 1000 },
  { id: 'chatter_5000',  emoji: '💬', name: 'Vielschreiber', desc: '5.000 Nachrichten geschrieben', area: 'chat', metric: 'messages', need: 5000, series: 'chatter', tier: 4, tiers: 5, test: (p, c, s) => (s.messages || 0) >= 5000 },
  { id: 'chatter_10000', emoji: '💬', name: 'Chat-Legende', desc: '10.000 Nachrichten geschrieben', area: 'chat', metric: 'messages', need: 10000, series: 'chatter', tier: 5, tiers: 5, test: (p, c, s) => (s.messages || 0) >= 10000 },
  { id: 'commander_100',  emoji: '⌨️', name: 'Tastenprofi', desc: '100 Befehle genutzt', area: 'chat', metric: 'commands', need: 100, series: 'commander', tier: 1, tiers: 2, test: (p, c, s) => (s.commands || 0) >= 100 },
  { id: 'commander_1000', emoji: '⚙️', name: 'Power-User', desc: '1.000 Befehle genutzt', area: 'chat', metric: 'commands', need: 1000, series: 'commander', tier: 2, tiers: 2, test: (p, c, s) => (s.commands || 0) >= 1000 },
  { id: 'gamer_10',   emoji: '🎮', name: 'Spieler', desc: '10 Spiele gespielt', area: 'games', metric: 'games', need: 10, series: 'gamer', tier: 1, tiers: 3, test: (p, c, s) => (s.games || 0) >= 10 },
  { id: 'gamer_100',  emoji: '🎮', name: 'Zocker', desc: '100 Spiele gespielt', area: 'games', metric: 'games', need: 100, series: 'gamer', tier: 2, tiers: 3, test: (p, c, s) => (s.games || 0) >= 100 },
  { id: 'gamer_500',  emoji: '👾', name: 'Dauerspieler', desc: '500 Spiele gespielt', area: 'games', metric: 'games', need: 500, series: 'gamer', tier: 3, tiers: 3, test: (p, c, s) => (s.games || 0) >= 500 },
  { id: 'winner_10',  emoji: '🏆', name: 'Gewinner', desc: '10 Spiele gewonnen', area: 'games', metric: 'gameWins', need: 10, series: 'winner', tier: 1, tiers: 3, test: (p, c, s) => (s.gameWins || 0) >= 10 },
  { id: 'winner_50',  emoji: '🏆', name: 'Champion', desc: '50 Spiele gewonnen', area: 'games', metric: 'gameWins', need: 50, series: 'winner', tier: 2, tiers: 3, test: (p, c, s) => (s.gameWins || 0) >= 50 },
  { id: 'winner_200', emoji: '🏆', name: 'Legenden-Champion', desc: '200 Spiele gewonnen', area: 'games', metric: 'gameWins', need: 200, series: 'winner', tier: 3, tiers: 3, test: (p, c, s) => (s.gameWins || 0) >= 200 },
  { id: 'social_50',    emoji: '💜', name: 'Herzensmensch', desc: '50 soziale Aktionen (Komplimente + Love)', area: 'social', metric: 'social', need: 50, series: 'social', tier: 1, tiers: 1, test: (p, c, s) => ((s.complimentsGiven || 0) + (s.loveActions || 0)) >= 50 },
  { id: 'compliment_25',  emoji: '🌹', name: 'Charmeur', desc: '25 Komplimente vergeben', area: 'social', metric: 'complimentsGiven', need: 25, series: 'compliments', tier: 1, tiers: 2, test: (p, c, s) => (s.complimentsGiven || 0) >= 25 },
  { id: 'compliment_250', emoji: '💘', name: 'Herzensbrecher', desc: '250 Komplimente vergeben', area: 'social', metric: 'complimentsGiven', need: 250, series: 'compliments', tier: 2, tiers: 2, test: (p, c, s) => (s.complimentsGiven || 0) >= 250 },
  { id: 'romantic_100', emoji: '🌹', name: 'Romantiker', desc: '100 Love-Aktionen', area: 'social', metric: 'loveActions', need: 100, series: 'love', tier: 1, tiers: 2, test: (p, c, s) => (s.loveActions || 0) >= 100 },
  { id: 'love_500',     emoji: '💞', name: 'Liebesbote', desc: '500 Love-Aktionen', area: 'social', metric: 'loveActions', need: 500, series: 'love', tier: 2, tiers: 2, test: (p, c, s) => (s.loveActions || 0) >= 500 },
  { id: 'collector_10', emoji: '🏅', name: 'Sammler', desc: '10 Achievements', area: 'collection', metric: 'achievements', need: 10, series: 'collector', tier: 1, tiers: 5, test: (p, c) => (c || 0) >= 10 },
  { id: 'collector_25', emoji: '🏅', name: 'Jäger', desc: '25 Achievements', area: 'collection', metric: 'achievements', need: 25, series: 'collector', tier: 2, tiers: 5, test: (p, c) => (c || 0) >= 25 },
  { id: 'collector_50', emoji: '🏆', name: 'Komplettist', desc: '50 Achievements', area: 'collection', metric: 'achievements', need: 50, series: 'collector', tier: 3, tiers: 5, test: (p, c) => (c || 0) >= 50 },
  { id: 'collector_75', emoji: '💎', name: 'Großsammler', desc: '75 Achievements', area: 'collection', metric: 'achievements', need: 75, series: 'collector', tier: 4, tiers: 5, test: (p, c) => (c || 0) >= 75 },
  { id: 'collector_100', emoji: '👑', name: 'Vollender', desc: '100 Achievements', area: 'collection', metric: 'achievements', need: 100, series: 'collector', tier: 5, tiers: 5, test: (p, c) => (c || 0) >= 100 },
  { id: 'daily_7',  emoji: '📅', name: 'Gewohnheitstier', desc: '7 Dailies abgeholt', area: 'collection', metric: 'dailiesClaimed', need: 7, series: 'daily', tier: 1, tiers: 2, test: (p, c, s) => (s.dailiesClaimed || 0) >= 7 },
  { id: 'daily_30', emoji: '📅', name: 'Monats-Abo', desc: '30 Dailies abgeholt', area: 'collection', metric: 'dailiesClaimed', need: 30, series: 'daily', tier: 2, tiers: 2, test: (p, c, s) => (s.dailiesClaimed || 0) >= 30 }
];

/** Badge-Metrikwert aus Profil (achCount kommt aus dem loveplus-Store). */
export function badgeMetric(profile, metric, achCount = 0) {
  const p = profile?.progression || {};
  const s = profile?.stats || {};
  switch (metric) {
    case 'level': return Number(p.level) || 0;
    case 'streak': return Math.max(Number(p.streak) || 0, Number(p.streaks?.daily?.c) || 0);
    case 'messages': return Number(s.messages) || 0;
    case 'games': return Number(s.games) || 0;
    case 'gameWins': return Number(s.gameWins) || 0;
    case 'loveActions': return Number(s.loveActions) || 0;
    case 'social': return (Number(s.complimentsGiven) || 0) + (Number(s.loveActions) || 0);
    case 'commands': return Number(s.commands) || 0;
    case 'complimentsGiven': return Number(s.complimentsGiven) || 0;
    case 'dailiesClaimed': return Number(s.dailiesClaimed) || 0;
    case 'achievements': return Number(achCount) || 0;
    default: return 0;
  }
}

/** Alle Badges mit Fortschritt (für Anzeige + „nächster Badge“). */
export function badgeProgress(profile, achCount = 0) {
  const p = ensureProgression(profile) || {};
  const got = p.badges || {};
  return BADGES.map((b) => {
    const have = badgeMetric(profile, b.metric, achCount);
    return { id: b.id, emoji: b.emoji, name: b.name, desc: b.desc, area: b.area, need: b.need, have, unlocked: !!got[b.id], at: got[b.id] || 0, series: b.series || null, tier: b.tier || null, tiers: b.tiers || null };
  });
}

/** Höchster bekannter Streak-Wert (Legacy + Daily-Streak, robust). */
function streakBest(p) {
  return Math.max(Number(p.streak) || 0, Number(p.streaks?.daily?.c) || 0);
}

/** Prüft alle Badges, vergibt neue (mit Zeitstempel) und gibt sie zurück.
 * `achCount` (loveplus-Store) nur für Sammlungs-Badges — grantXp ruft ohne auf. */
export function awardBadges(profile, now = Date.now(), achCount = 0) {
  const p = ensureProgression(profile);
  if (!p) return [];
  const st = ensureStats(profile) || {};
  const fresh = [];
  for (const b of BADGES) {
    if (p.badges[b.id]) continue;
    let ok = false;
    try { ok = !!b.test(p, achCount, st); } catch (e) { ok = false; }
    if (ok) { p.badges[b.id] = now; fresh.push({ id: b.id, emoji: b.emoji, name: b.name, desc: b.desc, area: b.area }); }
  }
  return fresh;
}

/* ─────────────────────────────────────────────────────────────────────
   CLAIM-TRUHEN (Progression 5.0): Einmal-Belohnungen, die per
   `$reward claim` abgeholt werden müssen. Anlage in grantXp() (nur echt
   erreichte Level/Prestige), Abholung hier — Doppel-Claim unmöglich
   (Unlock-Key + Entnahme aus pendingRewards).
   ───────────────────────────────────────────────────────────────────── */
export const CHEST_LEVELS = [25, 75, 150, 200, 250];
const CHEST_FALLBACK = { lv25: 500, lv75: 1500, lv150: 3000, lv200: 5000, lv250: 7500, prestige: 2500 };
export function chestAmount(key) {
  const cfg = xpRules().rewards?.chests || {};
  const v = Number(cfg[key] ?? CHEST_FALLBACK[key] ?? 0);
  return Math.max(0, Math.floor(v || 0));
}

/** Holt eine wartende Truhe ab (id optional — sonst die älteste). */
export function claimReward(profile, id = '') {
  const p = ensureProgression(profile);
  if (!p) return { ok: false, reason: 'no-profile' };
  const list = p.pendingRewards || [];
  if (!list.length) return { ok: false, reason: 'none-pending' };
  const want = String(id || '').trim().toLowerCase();
  const idx = want
    ? list.findIndex((r) => String(r.id || '').toLowerCase() === want || String(r.label || '').toLowerCase().includes(want))
    : 0;
  if (idx < 0) return { ok: false, reason: 'not-found', pending: list.map((r) => ({ id: r.id, label: r.label, copper: r.copper })) };
  const [it] = list.splice(idx, 1);
  const amt = Math.max(0, Math.floor(Number(it.copper) || 0));
  if (amt > 0) { addWallet(profile, amt, 'chest'); p.rewardsClaimed.copper += amt; }
  const now = Date.now();
  p.unlocks['claimed-' + it.id] = now;
  logReward(p, 'claim', '🎁 ' + (it.label || it.id), amt, now);
  try {
    engineEmit('REWARD_GRANTED', { bid: profile?.identity?.bid || '', name: profile?.registration?.name || '', kind: 'claim', granted: amt });
  } catch (e) {}
  return { ok: true, id: it.id, label: it.label, copper: amt, remaining: list.length };
}

export function rewardsTable(prestige = 0, level = 0) {
  return MILESTONES.map((m) => ({
    level: m.level,
    label: m.label,
    coins: Number(m.coins) || 0,
    unlocked: prestige > 0 ? true : level >= m.level
  }));
}

/**
 * XP-Multiplikator (Progression 2.0):
 * Base × Weekend-Multi × Event-Multi × Prestige-Bonus
 */
export function xpMultiplier(profile, now = Date.now(), opts = {}) {
  return xpMultiplierBreakdown(profile, now, opts).total;
}

/**
 * Multiplikator-Aufschlüsselung (6.0): alle aktiven Anteile einzeln,
 * Gesamt gedeckelt via multipliers.totalCap (Anti-Inflation).
 * @returns {{total:number, raw:number, capped:boolean, cap:number, parts:Array<{id,label,mult,active}>}}
 */
export function xpMultiplierBreakdown(profile, now = Date.now(), { isOwner = false } = {}) {
  const r = xpRules().multipliers || {};
  const parts = [];
  let m = 1;
  const dow = new Date(now).getDay();
  const weekend = (dow === 0 || dow === 6) ? Math.max(1, Number(r.weekend) || 1) : 1;
  parts.push({ id: 'weekend', label: '🌙 Wochenende', mult: weekend, active: weekend > 1 });
  m *= weekend;
  const ev = r.eventActive ? Math.max(1, Number(r.event) || 1) : 1;
  parts.push({ id: 'event', label: '🎪 Event' + (r.eventName ? ' ' + String(r.eventName).slice(0, 24) : ''), mult: ev, active: ev > 1 });
  m *= ev;
  const prestige = Number(profile?.progression?.prestige) || 0;
  const pMult = prestige > 0 ? 1 + Math.min(Number(r.prestigeCap) || 0, prestige * (Number(r.prestigePerLevel) || 0)) : 1;
  parts.push({ id: 'prestige', label: '👑 Prestige ' + prestige, mult: pMult, active: pMult > 1 });
  m *= pMult;
  /* 🔥 Streak-Bonus (Progression 3.0): aktive Serien beschleunigen XP, gedeckelt */
  const sc = r.streak || {};
  let sMult = 1;
  if (sc.enabled) {
    const st = Math.max(Number(profile?.progression?.streak) || 0, Number(profile?.progression?.streaks?.daily?.c) || 0);
    let pct = 0;
    if (st >= 30) pct = Number(sc.d30) || 0;
    else if (st >= 7) pct = Number(sc.d7) || 0;
    else if (st >= 3) pct = Number(sc.d3) || 0;
    if (pct > 0) sMult = 1 + Math.min(Number(sc.cap) || 0, pct);
  }
  parts.push({ id: 'streak', label: '🔥 Streak', mult: sMult, active: sMult > 1 });
  m *= sMult;
  /* 👑 Owner-Bonus (6.0): kleiner Dankeschön-Bonus, nur wenn Call-Site isOwner bestätigt */
  const ob = r.ownerBonus || {};
  const oMult = (ob.enabled && isOwner && Number(ob.bonus) > 0) ? 1 + Number(ob.bonus) : 1;
  parts.push({ id: 'owner', label: '👑 Owner', mult: oMult, active: oMult > 1 });
  m *= oMult;
  const cap = Math.max(1, Number(r.totalCap) || 3);
  const total = Math.min(m, cap);
  return { total, raw: m, capped: m > cap, cap, parts };
}

/** Wendet den Multiplikator auf eine Basis-XP an (gerundet). */
export function applyMultiplier(base, profile, now = Date.now(), opts = {}) {
  return Math.max(0, Math.round(base * xpMultiplier(profile, now, opts)));
}

/**
 * XP für ein Kompliment (Progression 2.0 — Social XP Layer).
 * Sender +8, Empfänger +5 (regelmäßig), mit Cooldown + Anti-Mutual-Farm
 * + Tageslimit. Rückgabe enthält `farmSuspect`, wenn ein Muster erkannt
 * wurde (der Caller kann loggen — hier bleibt es datenschutz-sauber).
 */
export function applyComplimentXp(senderProfile, recipientProfile, { now = Date.now() } = {}) {
  const r = xpRules();
  const cat = r.categories?.compliment || {};
  const af = r.antiFarm || {};
  const out = { senderXp: 0, recipientXp: 0, skipped: null, farmSuspect: false, bond: 0, events: [], senderEvents: [], recipientEvents: [] };
  if (!cat.enabled) return { ...out, skipped: 'disabled' };
  const sBid = senderProfile?.identity?.bid || '';
  const rBid = recipientProfile?.identity?.bid || '';
  if (!sBid || !rBid) return { ...out, skipped: 'no-bid' };
  const self = sBid === rBid;
  /* Cooldown pro Paar (Richtung) */
  if (!self && checkCooldown(sBid, rBid, Number(cat.cooldownSec) || 300, now)) return { ...out, skipped: 'cooldown' };
  /* Mutual-Farm: A→B→A→B … innerhalb einer Stunde */
  const mutualHot = touchMutual(sBid, rBid, now, Number(af.mutualFarmMaxPerHour) || 6);
  /* Tageslimit (kompakt: stats.compliments = {day, count}) */
  const sP = ensureProgression(senderProfile);
  const today = dayKey(now);
  senderProfile.stats = senderProfile.stats || {};
  if (!senderProfile.stats.compliments || senderProfile.stats.compliments.day !== today) {
    senderProfile.stats.compliments = { day: today, count: 0 };
  }
  if (senderProfile.stats.compliments.count >= (Number(cat.dailyCap) || 30)) return { ...out, skipped: 'daily-cap' };

  /* Empfänger-XP */
  if (!self && xpEligible(recipientProfile)) {
    const res = grantXp(recipientProfile, applyMultiplier(Number(cat.recipient) || 5, recipientProfile, now), { source: 'compliments', now });
    out.recipientXp = res.granted;
    out.events.push(...res.events);
    out.recipientEvents.push(...res.events);
    /* Social Bond (loveplus-Counter) */
    recipientProfile.stats = recipientProfile.stats || {};
    recipientProfile.stats.socialBond = (Number(recipientProfile.stats.socialBond) || 0) + 1;
    out.bond = 1;
  }
  /* Sender-XP (auch bei Selbst-Kompliment, halber Wert) */
  if (xpEligible(senderProfile)) {
    const base = self ? Math.ceil((Number(cat.sender) || 8) / 2) : (Number(cat.sender) || 8);
    const res = grantXp(senderProfile, applyMultiplier(base, senderProfile, now), { source: 'compliments', now });
    out.senderXp = res.granted;
    out.events.push(...res.events);
    out.senderEvents.push(...res.events);
    senderProfile.stats.compliments.count += 1;
    if (res.granted > 0) ensureStats(senderProfile).complimentsGiven += 1; /* 📊 */
  }
  out.farmSuspect = mutualHot;
  if (mutualHot) engineEmit('XP_GRANTED', { bid: sBid, source: 'compliment-suspect', granted: 0 });
  return out;
}

/**
 * XP für Media-Nutzung (Progression 2.0 — Download-Farming-Schutz):
 * Erst-Download +15 XP · jeder neue Provider einmalig +10 XP ·
 * max. N Media-XP-Events pro Tag (Regel media.dailyCap).
 */
export function applyMediaXp(profile, { platform = 'generic', now = Date.now() } = {}) {
  const r = xpRules();
  const cat = r.categories?.media || {};
  const out = { granted: 0, reason: null, events: [] };
  if (!cat.enabled) return out;
  const p = ensureProgression(profile);
  const fm = profile.flags?.media || {};
  const day = dayKey(now);
  if (fm.day !== day) { fm.day = day; fm.count = 0; }
  if (fm.count >= (Number(cat.dailyCap) || 3)) return out;
  let amt = 0;
  let reason = null;
  if (!fm.first) { fm.first = now; amt += Number(cat.firstDownload) || 15; reason = 'first-download'; }
  else if (fm.providers && !fm.providers[platform]) {
    fm.providers = fm.providers || {};
    fm.providers[platform] = now;
    if (Object.keys(fm.providers).length <= 8) { amt += Number(cat.firstProvider) || 10; reason = 'new-provider:' + platform; }
  }
  if (amt > 0 && xpEligible(profile)) {
    fm.count += 1;
    const res = grantXp(profile, applyMultiplier(amt, profile, now), { source: 'media', now });
    out.granted = res.granted;
    out.reason = reason;
    out.events = res.events;
    engineEmit('MEDIA_JOB_DONE', { bid: profile?.identity?.bid || '', name: profile?.registration?.name || '', source: reason || 'media' });
  }
  return out;
}

/**
 * XP für eine normale (nicht-Befehl-)Nachricht — inkl. Nette-Erkennung
 * und dem gleitenden Anti-Spam-Fenster (60 Min).
 */
export function applyMessageXp(profile, { text = '', isGroup = false, now = Date.now(), isOwner = false } = {}) {
  const p = ensureProgression(profile);
  if (!xpEligible(profile)) return { granted: 0, kind: 'normal', capped: false, skipped: 'not-eligible' };
  const r = xpRules();
  const cat = r.categories?.message || {};
  const af = r.antiFarm || {};
  if (!cat.enabled) return { granted: 0, kind: 'normal', capped: false, skipped: 'disabled' };
  /* ⏳ XP-COOLDOWN: Nachrichten-XP nur alle `msgCooldownSec` Sekunden.
     Begrenzt NUR die XP-Vergabe — Chatten bleibt unbegrenzt möglich. */
  const cdSec = Math.max(0, Number(af.msgCooldownSec) || 0);
  const lastMsg = Number(p.lastMsgXpAt) || 0;
  if (cdSec > 0 && lastMsg > 0 && now - lastMsg < cdSec * 1000) {
    return { granted: 0, want: 0, kind: 'normal', capped: false, skipped: 'cooldown', retryAfterMs: cdSec * 1000 - (now - lastMsg) };
  }
  pruneWindow(p, now);
  /* 🛡️ Anti-Farm: Duplikat-Erkennung (gleicher Text innerhalb des
     Fensters → 0 XP; wiederholte Duplikate am Tag → 0 XP) — nur
     Kurz-Hash, KEIN Text wird gespeichert. */
  const h = djb2(normText(text));
  const win = (Number(af.duplicateWindowSec) || 45) * 1000;
  p.recentMsgs = (p.recentMsgs || []).filter((e) => e && now - e.t < win);
  const sameInWin = p.recentMsgs.filter((e) => e.h === h).length;
  const today = dayKey(now);
  const sameToday = (p.recentMsgsAllDay || []).filter((e) => e.h === h).length;
  if (p.recentMsgsAllDay && p.recentMsgsAllDay[0] && p.recentMsgsAllDay[0].d !== today) p.recentMsgsAllDay = [];
  p.recentMsgsAllDay = (p.recentMsgsAllDay || []).filter((e) => e.d === today);
  if (sameInWin >= 1) { p.recentMsgs.push({ h, t: now }); p.recentMsgsAllDay.push({ h, d: today }); return { granted: 0, want: 0, kind: 'spam', capped: true, skipped: 'duplicate' }; }
  if (sameToday >= (Number(af.duplicateMaxPerDay) || 5)) { p.recentMsgs.push({ h, t: now }); p.recentMsgsAllDay.push({ h, d: today }); return { granted: 0, want: 0, kind: 'spam', capped: true, skipped: 'duplicate-day' }; }
  p.recentMsgs.push({ h, t: now });
  p.recentMsgsAllDay.push({ h, d: today });
  if (p.recentMsgs.length > 25) p.recentMsgs.splice(0, p.recentMsgs.length - 25);
  if (p.recentMsgsAllDay.length > 50) p.recentMsgsAllDay.splice(0, p.recentMsgsAllDay.length - 50);
  /* Qualitätskategorien (Progression 2.0): normal / nette ×2 / Liebes-×3 + Kompliment-Bonus */
  const kind = detectKindText(text);
  const mult = kind.kind === 'love' ? (Number(cat.loveMult) || 3) : kind.kind === 'kind' ? (Number(cat.kindMult) || 2) : 1;
  const base = isGroup ? (Number(cat.group) || 3) : (Number(cat.oneToOne) || 5);
  let want = applyMultiplier(base * mult + (kind.bonus ? (Number(cat.complimentBonus) || 5) : 0), profile, now, { isOwner });
  const cap = Number(af.msgCapPerHour) || MSG_CAP_PER_HOUR;
  const used = windowUsed(p, 'msg');
  const room = Math.max(0, cap - used);
  const granted = Math.min(want, room);
  if (granted > 0) {
    p.xpWindow.push({ t: now, a: granted, s: 'msg' });
    p.lastMsgXpAt = now;
    tickStreak(p, 'chat', now); /* 💬 Chat-Streak: aktive Beteiligung */
    const res = grantXp(profile, granted, { source: kind.kind === 'love' ? 'love' : 'messages', now });
    ensureStats(profile).messages += 1; /* 📊 Aktivitäts-Zähler */
    bumpStatsDaily(p, now, 'm');
    return { granted: res.granted, want, kind, capped: granted < want, events: res.events, copper: res.copper };
  }
  return { granted: 0, want, kind, capped: true };
}

/** XP für die Nutzung eines Befehls (Liebes-Aktionen zählen doppelt). */
export function applyCommandXp(profile, { loveAction = false, now = Date.now(), isOwner = false } = {}) {
  const p = ensureProgression(profile);
  if (!xpEligible(profile)) return { granted: 0, capped: false, skipped: 'not-eligible' };
  const r = xpRules();
  const cat = r.categories?.command || {};
  const af = r.antiFarm || {};
  if (!cat.enabled) return { granted: 0, capped: false, skipped: 'disabled' };
  pruneWindow(p, now);
  const want = applyMultiplier(loveAction ? (Number(cat.loveAction) || 5) : (Number(cat.base) || 2), profile, now, { isOwner });
  const cap = Number(af.cmdCapPerHour) || CMD_CAP_PER_HOUR;
  const used = windowUsed(p, 'cmd');
  const room = Math.max(0, cap - used);
  const granted = Math.min(want, room);
  if (granted > 0) {
    p.xpWindow.push({ t: now, a: granted, s: 'cmd' });
    const res = grantXp(profile, granted, { source: 'commands', now });
    const cst = ensureStats(profile); /* 📊 Aktivitäts-Zähler */
    cst.commands += 1;
    if (loveAction) cst.loveActions += 1;
    bumpStatsDaily(p, now, 'c');
    return { granted: res.granted, kind: 'command', capped: granted < want, events: res.events, copper: res.copper };
  }
  return { granted: 0, want, kind: 'command', capped: true };
}

/* ─────────────────────────────────────────────────────────────────────
   Anzeigetexte (WhatsApp-Markdown, im LoveBot-Stil)
   ───────────────────────────────────────────────────────────────────── */

/**
 * Ankündigung nach Level-Up (im Chat).
 * @param {string} [opts.mention]  z. B. '@4915…' — wird im Text erwähnt (Call-Site setzt zusätzlich `mentions`)
 * @param {number} [opts.fromLevel] bei Mehrfach-Level-Up: Start-Level für „Level 9 → Level 11“
 */
export function levelUpAnnounce(profile, name, opts = {}) {
  const p = ensureProgression(profile);
  const rank = rankFor(p.prestige, p.level);
  const title = activeTitleFor(profile);
  const pct = levelPct(p);
  const who = opts.mention ? String(opts.mention) : `*${name}*`;
  const lines = [
    '> 🎉 *LEVEL UP!*',
    '',
    `💜 ${who} erreicht *Level ${de(p.level)}*!`
  ];
  const fromLv = Number(opts.fromLevel);
  if (Number.isFinite(fromLv) && fromLv < p.level) {
    lines.push(`🚀 Level ${de(fromLv)} → Level ${de(p.level)} _(${(p.level - fromLv).toLocaleString('de-DE')} Level auf einmal!)_`);
  }
  lines.push(
    `\`${bar(pct)}\` ${pct}% bis Level ${de(p.level + 1)}`,
    `🏅 Rang: ${rank.full}`,
    `📛 Titel: ${title.emoji} *${title.name}*`
  );
  if (Number(opts.copper) > 0) lines.push(`🤎 Belohnung: *+${de(opts.copper)}* Kupfer`);
  lines.push('');
  if (p.prestige > 0) lines.unshift(`✨ Prestige ${de(p.prestige)}`);
  lines.push('🤎 _Weiter aktiv bleiben zahlt sich aus — nette Nachrichten bringen extra XP!_');
  return lines.join('\n');
}

/**
 * Große Prestige-Up-Ankündigung.
 * @param {string} [opts.mention]  z. B. '@4915…' — wird im Text erwähnt (Call-Site setzt zusätzlich `mentions`)
 */
export function prestigeAnnounce(profile, name, opts = {}) {
  const p = ensureProgression(profile);
  const rank = rankFor(p.prestige, 0);
  const who = opts.mention ? String(opts.mention) : `*${name}*`;
  return [
    '═══════════════════════════',
    '✨  P R E S T I G E   U P  ✨',
    '═══════════════════════════',
    '',
    `👑 ${who} startet ein neues Kapitel: *Prestige ${de(p.prestige)}*!`,
    rank.prestigeTitle ? `🏅 Neuer Titel: ${rank.prestigeTitleEmoji} *${rank.prestigeTitle}*` : '',
    `💜 Level ${de(p.level)} · ${de(10000)} Kupfer als Willkommensgeschenk 🤎`,
    '',
    '_Jeder Level-Zyklus (0–743) ist ein Kapitel. Wer Prestige sammelt, bleibt für immer in Erinnerung._ 💜'
  ].filter((l) => l !== '').join('\n');
}

/** Komplettes Level-Profil (für $level). */
export function profileCard(profile, name, pref = '$') {
  const p = ensureProgression(profile);
  const rank = rankFor(p.prestige, p.level);
  const title = activeTitleFor(profile);
  const per = xpPeriods(profile);
  const badgeCount = Object.keys(p.badges || {}).length;
  const next = nextRankFor(p.prestige, p.level);
  const pct = levelPct(p);
  const s = p.xpSources;
  const srcRows = [
    ['💬', 'Nachrichten', s.messages],
    ['💜', 'Liebesnachrichten', s.love],
    ['⚙️', 'Befehle', s.commands],
    ['🎮', 'Spiele', s.games],
    ['📅', 'Dailies', s.dailies],
    ['💼', 'Arbeit', s.work]
  ].filter(([, , v]) => v > 0);
  const maxed = p.prestige >= PROGRESSION.maxPrestige && p.level >= PROGRESSION.maxLevel;
  const lines = [
    '╔════════════════════════════════╗',
    '║   💜  L E V E L   P R O F I L   ║',
    '╚════════════════════════════════╝',
    '',
    `👤 *${name}*`,
    `🏅 Rang: ${rank.full}`,
    `📛 Titel: ${title.emoji} *${title.name}*`,
    '',
    `⭐ Prestige *${de(p.prestige)}* · Level *${de(p.level)}*`,
    maxed
      ? '\`▰▰▰▰▰▰▰▰▰\` 100% — *MAX EREICHT!* 👑'
      : `\`${bar(pct)}\` ${pct}%\n${de(p.xp)} / ${de(p.neededXpForLvOrPrestigeUp)} XP bis Level ${de(p.level + 1)}`,
    `Σ Lifetime: *${de(p.totalXp)}* XP · 🔥 Streak: *${de(p.streak)}* Tag(e)`,
    `📆 Heute *${de(per.today)}* · Woche *${de(per.week)}* · Monat *${de(per.month)}*`,
    `🎖️ Badges: *${badgeCount}* · 🏆 Rekord-Streak: *${de(p.bestStreak)}* Tag(e)`,
    ''
  ];
  if (srcRows.length) {
    lines.push('📊 *XP-QUELLEN*');
    for (const [emoji, label, v] of srcRows) lines.push(`   ${emoji} ${label}: *${de(v)}* XP`);
    lines.push('');
  }
  if (next) {
    lines.push(next.isPrestige
      ? `🎯 Noch *${de(next.remainingLevels)}* Level bis zum nächsten *Prestige-Up* ✨`
      : `🎯 Nächster Rang: ${next.emoji} *${next.title}* (noch ${de(next.remainingLevels)} Level)`);
  }
  const wallet = profile.wallet?.copper;
  if (Number.isFinite(wallet)) lines.push(`🤎 Wallet: *${de(wallet)}* Kupfer`);
  lines.push('', `💡 Nette Nachrichten & Liebes-Wörter bringen bis zu *×3 XP* — probier's mit *${pref}compliment* 😘`);
  return lines.join('\n');
}

/** Kurze Rang-Zeile (für $rank / fremde Profile). */
export function rankLine(profile, name) {
  const p = ensureProgression(profile);
  const rank = rankFor(p.prestige, p.level);
  const pct = levelPct(p);
  return `🏅 *${name}* — ${rank.full}\n⭐ Prestige ${de(p.prestige)} · Level ${de(p.level)} · \`${bar(pct)}\` ${pct}%`;
}

/* ─────────────────────────────────────────────────────────────────────
   PROGRESSION 3.0 — ZEITRÄUME, VERLAUF, RANGPOSITION
   ───────────────────────────────────────────────────────────────────── */

/** XP-Summen heute / letzte 7 / letzte 30 Tage (aus xpDaily, ohne Neuspeicherung). */
export function xpPeriods(profile, now = Date.now()) {
  const p = ensureProgression(profile);
  if (!p) return { today: 0, week: 0, month: 0, lifetime: 0 };
  const out = { today: 0, week: 0, month: 0, lifetime: Number(p.totalXp) || 0 };
  const startToday = new Date(dayKey(now) + 'T00:00:00Z').getTime();
  for (const e of (p.xpDaily || [])) {
    if (!e || !e.d) continue;
    const ageDays = Math.round((startToday - new Date(e.d + 'T00:00:00Z').getTime()) / DAY_MS);
    if (!Number.isFinite(ageDays) || ageDays < 0) continue;
    if (ageDays === 0) out.today += e.a;
    if (ageDays < 7) out.week += e.a;
    if (ageDays < 30) out.month += e.a;
  }
  return out;
}

/** Letzte `n` XP-Ereignisse (Quelle, Betrag, Zeit) — ohne Nachrichtentexte. */
export function recentXp(profile, n = 5) {
  const p = ensureProgression(profile);
  if (!p) return [];
  const SRC_LABEL = { messages: '💬 Nachricht', love: '💜 Liebesnachricht', commands: '⚙️ Befehl', games: '🎮 Spiel', dailies: '📅 Daily', work: '💼 Arbeit', compliments: '🌹 Kompliment', media: '🎬 Media', general: '✨ Sonstiges' };
  return (p.xpLog || []).slice(-Math.max(1, Math.min(40, Number(n) || 5))).reverse().map((e) => ({
    source: e.s, amount: e.a, at: e.t,
    label: SRC_LABEL[e.s] || '✨ ' + String(e.s || '?')
  }));
}

/** Sortierreihenfolge der Rangliste: Prestige → Level → XP → Lifetime-XP. */
export function progressionComparator(a, b) {
  const pa = a?.progression || {};
  const pb = b?.progression || {};
  return ((Number(pb.prestige) || 0) - (Number(pa.prestige) || 0))
    || ((Number(pb.level) || 0) - (Number(pa.level) || 0))
    || ((Number(pb.xp) || 0) - (Number(pa.xp) || 0))
    || ((Number(pb.totalXp) || 0) - (Number(pa.totalXp) || 0));
}

/** Globale Rangposition eines Profils in einer `{bid: profile}`-Mappe.
 * Nur aktive Profile (wie topProgression) — Null-Profile würden die Plätze verzerren. */
export function globalRank(users, bid) {
  const active = (u) => u && u.progression && ((u.progression.level || 0) > 0 || (u.progression.xp || 0) > 0 || (u.progression.totalXp || 0) > 0);
  const entries = Object.entries(users || {}).filter(([, u]) => active(u));
  entries.sort(([, a], [, b]) => progressionComparator(a, b));
  const total = entries.length;
  const pos = entries.findIndex(([k]) => k === bid);
  return { pos: pos >= 0 ? pos + 1 : null, total };
}

/* ─────────────────────────────────────────────────────────────────────
   RANG-MODI & TRENDS (Progression 5.0)
   ───────────────────────────────────────────────────────────────────── */

/** Wochen-Rangposition (Perioden-XP aus xpDaily, absteigend). */
export function weeklyRank(users, bid, now = Date.now()) {
  const rows = Object.entries(users || {})
    .map(([k, u]) => ({ bid: k, week: u && u.progression ? weekXpSum(u, now) : 0, total: Number(u?.progression?.totalXp) || 0 }))
    .filter((r) => r.week > 0);
  rows.sort((a, b) => (b.week - a.week) || (b.total - a.total));
  const pos = rows.findIndex((r) => r.bid === bid);
  return { pos: pos >= 0 ? pos + 1 : null, total: rows.length };
}

/** Monats-Rangposition (letzte 30 Tage aus xpDaily). */
export function monthlyRank(users, bid, now = Date.now()) {
  const rows = Object.entries(users || {})
    .map(([k, u]) => {
      let month = 0;
      try { month = u && u.progression ? xpPeriods(u, now).month : 0; } catch (e) { month = 0; }
      return { bid: k, month, total: Number(u?.progression?.totalXp) || 0 };
    })
    .filter((r) => r.month > 0);
  rows.sort((a, b) => (b.month - a.month) || (b.total - a.total));
  const pos = rows.findIndex((r) => r.bid === bid);
  return { pos: pos >= 0 ? pos + 1 : null, total: rows.length };
}

/** Gruppen-Rang: globaler Vergleich, eingeschränkt auf Mitglieder-BIDs. */
export function groupRank(users, bid, memberBids = []) {
  const set = new Set((memberBids || []).map((b) => String(b)));
  const sub = {};
  for (const [k, u] of Object.entries(users || {})) if (set.has(String(k))) sub[k] = u;
  return globalRank(sub, bid);
}

/** Schreibt einen Wochen-Snapshot (max. 12) und meldet Trend vs. Vorwoche.
 *  Gibt {pos,total,prev,delta} zurück — prev null ohne echten Vorwert. */
export function snapshotRank(profile, pos, total, now = Date.now()) {
  const p = ensureProgression(profile);
  if (!p || !pos) return { pos: pos || null, total: total || 0, prev: null, delta: null };
  const w = isoWeekKey(now);
  p.rankHistory = Array.isArray(p.rankHistory) ? p.rankHistory : [];
  const last = p.rankHistory[p.rankHistory.length - 1];
  let prev = null;
  if (last && last.w === w) {
    last.pos = pos; last.total = total;
    const older = p.rankHistory[p.rankHistory.length - 2];
    prev = older && older.w !== w ? older.pos : null;
  } else {
    if (last) prev = last.pos;
    p.rankHistory.push({ w, pos, total });
    if (p.rankHistory.length > 12) p.rankHistory.splice(0, p.rankHistory.length - 12);
  }
  const delta = (prev && pos) ? prev - pos : null; /* + = verbessert */
  try {
    engineEmit('RANK_CHANGED', { bid: profile?.identity?.bid || '', name: profile?.registration?.name || '', kind: 'weekly', pos, total, prev });
  } catch (e) {}
  return { pos, total, prev, delta };
}

/* ─────────────────────────────────────────────────────────────────────
   Leaderboard
   ───────────────────────────────────────────────────────────────────── */

/**
 * Top-N nach (Prestige, Level, XP) aus einer `{bid: profile}`-Mappe.
 * @returns {Array<{bid:string,name:string,prestige:number,level:number,xp:number,totalXp:number,rank:object,rankFull:string}>}
 */
export function topProgression(users, n = 10) {
  return Object.entries(users || {})
    .filter(([, u]) => u && u.progression && (u.progression.level > 0 || u.progression.xp > 0 || u.progression.totalXp > 0))
    .map(([bid, u]) => {
      const p = ensureProgression(u);
      const rank = rankFor(p.prestige, p.level);
      return {
        bid,
        name: u.registration?.name || u.identity?.username || bid.split('jid')[0] || '?',
        title: p.activeTitle || p.title || titleFor(p.level),
        badges: Object.keys(p.badges || {}).length,
        prestige: p.prestige,
        level: p.level,
        xp: p.xp,
        totalXp: p.totalXp,
        streak: p.streak || 0,
        rank: rank,
        rankFull: rank.full
      };
    })
    .sort((a, b) => (b.prestige - a.prestige) || (b.level - a.level) || (b.xp - a.xp) || (b.totalXp - a.totalXp))
    .slice(0, Math.max(1, Math.min(50, Number(n) || 10)));
}

/* ─────────────────────────────────────────────────────────────────────
   PROGRESSION 5.0 — INTEGRITÄT, ANALYTIK, BALANCING, ADMIN-CORE
   ───────────────────────────────────────────────────────────────────── */

/** Prüft + repariert Progression-Daten (sanft: klemmt, löscht nichts Verdientes).
 *  Gibt {ok, fixed[], warnings[]} zurück — ok=false heißt: es wurde repariert. */
export function validateProgression(profile) {
  const fixed = [], warnings = [];
  const p = profile?.progression;
  if (!p) return { ok: true, fixed, warnings, skipped: 'no-progression' };
  const clampNum = (obj, key, min, max, label) => {
    const v = Number(obj[key]);
    if (!Number.isFinite(v)) { obj[key] = min; fixed.push(label + ': NaN→' + min); }
    else if (v < min) { obj[key] = min; fixed.push(label + ': negativ→' + min); }
    else if (max !== null && v > max) { obj[key] = max; fixed.push(label + ': über Max→' + max); }
  };
  clampNum(p, 'xp', 0, Number.MAX_SAFE_INTEGER - 1024, 'xp');
  clampNum(p, 'totalXp', 0, Number.MAX_SAFE_INTEGER, 'totalXp');
  clampNum(p, 'level', 0, PROGRESSION.maxLevel, 'level');
  clampNum(p, 'prestige', 0, PROGRESSION.maxPrestige, 'prestige');
  clampNum(p, 'streak', 0, 100000, 'streak');
  clampNum(p, 'bestStreak', 0, 100000, 'bestStreak');
  p.level = Math.floor(p.level); p.prestige = Math.floor(p.prestige);
  p.xp = Math.floor(p.xp); p.totalXp = Math.floor(p.totalXp);
  for (const k of ['xpLog', 'xpDaily', 'recentMsgs', 'statsDaily', 'rewardsLog', 'pendingRewards', 'rankHistory']) {
    if (!Array.isArray(p[k])) { p[k] = []; fixed.push(k + ': kein Array→[]'); }
  }
  const caps = { xpLog: 40, xpDaily: 35, statsDaily: 35, rewardsLog: 30, rankHistory: 12 };
  for (const [k, cap] of Object.entries(caps)) {
    if (p[k].length > cap) { p[k].splice(0, p[k].length - cap); fixed.push(k + ': auf ' + cap + ' gekürzt'); }
  }
  if (!Array.isArray(p.hourActivity) || p.hourActivity.length !== 24) { fixed.push('hourActivity: neu initialisiert'); }
  if (!Array.isArray(p.weekdayActivity) || p.weekdayActivity.length !== 7) { fixed.push('weekdayActivity: neu initialisiert'); }
  ensureProgression(profile); /* stellt reparierte Arrays her */
  if (!p.unlocks || typeof p.unlocks !== 'object') { p.unlocks = {}; fixed.push('unlocks: neu initialisiert'); }
  if (!p.badges || typeof p.badges !== 'object') { p.badges = {}; fixed.push('badges: neu initialisiert'); }
  if (!p.rewardsClaimed || typeof p.rewardsClaimed !== 'object') { p.rewardsClaimed = { copper: 0 }; fixed.push('rewardsClaimed: neu initialisiert'); }
  clampNum(p.rewardsClaimed, 'copper', 0, Number.MAX_SAFE_INTEGER, 'rewardsClaimed.copper');
  /* Warnungen (kein Auto-Fix — braucht Owner-Entscheidung) */
  const maxed = p.prestige >= PROGRESSION.maxPrestige && p.level >= PROGRESSION.maxLevel;
  if (!maxed) {
    try {
      const need = neededXp(p.level, p.prestige);
      if (p.xp >= need) warnings.push('xp-overflow: ' + p.xp + ' ≥ Bedarf ' + need + ' (nächste XP-Aktion levelt)');
    } catch (e) {}
  }
  if ((p.totalXp || 0) < (p.xp || 0)) warnings.push('totalXp < xp (Lifetime kleiner als Zyklus-XP)');
  return { ok: fixed.length === 0 && warnings.length === 0, fixed, warnings };
}

/** Aggregierte XP-Analytik über eine `{bid: profile}`-Mappe (Owner/Reports). */
export function xpAnalytics(users, now = Date.now()) {
  const out = { users: 0, active: 0, totalXpGranted: 0, perSource: {}, avgXpPerActive: 0, topSource: null, prestigeCount: 0, maxedCount: 0, weekXp: 0 };
  let best = 0;
  for (const u of Object.values(users || {})) {
    const p = u?.progression;
    if (!p) continue;
    out.users++;
    const tot = Number(p.totalXp) || 0;
    if (tot <= 0 && !(p.level > 0)) continue;
    out.active++;
    out.totalXpGranted += tot;
    if ((Number(p.prestige) || 0) > 0) out.prestigeCount++;
    if ((Number(p.prestige) || 0) >= PROGRESSION.maxPrestige && (Number(p.level) || 0) >= PROGRESSION.maxLevel) out.maxedCount++;
    for (const [s, v] of Object.entries(p.xpSources || {})) {
      out.perSource[s] = (out.perSource[s] || 0) + (Number(v) || 0);
      if (out.perSource[s] > best) { best = out.perSource[s]; out.topSource = s; }
    }
    try { out.weekXp += weekXpSum(u, now); } catch (e) {}
  }
  out.avgXpPerActive = out.active ? Math.round(out.totalXpGranted / out.active) : 0;
  return out;
}

/** XP-Bedarf, um von `from` (exkl. aktuellem Fortschritt) bis `to` zu kommen. */
export function xpToReachLevel(from, to, prestige = 0) {
  const a = Math.max(0, Math.min(PROGRESSION.maxLevel, Math.floor(Number(from) || 0)));
  const b = Math.max(0, Math.min(PROGRESSION.maxLevel, Math.floor(Number(to) || 0)));
  let sum = 0;
  for (let l = a; l < b; l++) { try { sum += neededXp(l, prestige); } catch (e) { break; } }
  return sum;
}

/** Prestige-Fortschritt: Rest-Level, Rest-XP (echt aus der Kurve), nächster Titel. */
export function prestigeProgress(profile) {
  const p = ensureProgression(profile);
  if (!p) return null;
  const maxed = p.prestige >= PROGRESSION.maxPrestige && p.level >= PROGRESSION.maxLevel;
  const levelsToPrestige = Math.max(0, PROGRESSION.maxLevel - p.level);
  const xpNeededTotal = xpToReachLevel(p.level, PROGRESSION.maxLevel, p.prestige);
  const xpRemaining = Math.max(0, xpNeededTotal - (Number(p.xp) || 0));
  const nextP = Math.min(PROGRESSION.maxPrestige, p.prestige + 1);
  const pTitle = nextP >= 6 ? PRESTIGE_MAX_TITLE : (PRESTIGE_TITLES.find((t) => nextP >= t[0]) || null);
  return {
    prestige: p.prestige, level: p.level, maxed,
    nextPrestige: maxed ? null : nextP,
    levelsToPrestige: maxed ? 0 : levelsToPrestige,
    xpRemaining: maxed ? 0 : xpRemaining,
    nextPrestigeTitle: maxed ? null : (pTitle ? pTitle[0] + ' ' + pTitle[1] : '👑 Prestige ' + nextP),
    chestCopper: chestAmount('prestige'),
    prestigeCopper: Math.max(0, Math.floor(Number(xpRules().rewards?.prestigeCopper ?? 10000) || 0))
  };
}

/* Balancing-Szenarien (5.0): deterministische Schätzungen aus den AKTUELLEN
   Regeln — ohne Weekend/Event/Streak-Multiplikatoren, klar als Schätzung gelabelt. */
const BALANCE_SCENARIOS = {
  casual:  { label: '🌱 Gelegenheits-Spieler', messages: 10, commands: 2, dailies: 0, games: 0 },
  active:  { label: '💜 Aktiver User', messages: 30, commands: 8, dailies: 1, games: 2 },
  heavy:   { label: '🔥 Power-User', messages: 80, commands: 20, dailies: 1, games: 6 },
  grinder: { label: '⚡ Grinder (Cap-nah)', messages: 150, commands: 40, dailies: 1, games: 10 }
};
export function balanceScenario(kind = 'active') {
  const sc = BALANCE_SCENARIOS[kind] || BALANCE_SCENARIOS.active;
  const r = xpRules();
  const msg = Number(r.categories?.message?.group) || 0;
  const cmd = Number(r.categories?.command?.base) || 0;
  const dal = Number(r.categories?.daily?.daily) || 0;
  const win = Number(r.categories?.game?.win) || 0;
  const loss = Number(r.categories?.game?.loss) || 0;
  const xpPerDay = sc.messages * msg + sc.commands * cmd + sc.dailies * dal + sc.games * Math.round((win + loss) / 2);
  const daysTo = {};
  for (const lv of [10, 25, 50, 100]) {
    const need = xpToReachLevel(0, lv, 0);
    daysTo['lv' + lv] = xpPerDay > 0 ? Math.max(1, Math.ceil(need / xpPerDay)) : null;
  }
  return { kind, label: sc.label, xpPerDay, daysTo, estimate: true };
}

/* ── Admin-Core (5.0): Chat- UND Web-Adjusts teilen diese Semantik ──
   Positiv → durch die Level-Engine (Level-Ups + Kupfer möglich).
   Negativ → nur XP kürzen, KEIN Level-Down (konservativ, dokumentiert). */
export function adminAdjustXp(profile, delta, { reason = '', actor = '?', now = Date.now() } = {}) {
  const p = ensureProgression(profile);
  if (!p) return { ok: false, reason: 'no-profile' };
  const d = Math.floor(Number(delta) || 0);
  if (!d) return { ok: false, reason: 'no-delta' };
  if (Math.abs(d) > 10000000) return { ok: false, reason: 'delta-too-big' };
  if (String(reason || '').trim().length < 5) return { ok: false, reason: 'reason-too-short' };
  const before = { xp: Number(p.xp) || 0, totalXp: Number(p.totalXp) || 0, level: p.level, prestige: p.prestige };
  let res;
  if (d > 0) {
    res = grantXp(profile, d, { source: 'admin', now });
  } else {
    p.xp = Math.max(0, (Number(p.xp) || 0) + d);
    p.totalXp = Math.max(0, (Number(p.totalXp) || 0) + d);
    res = { granted: d, copper: 0, events: [], maxed: false, capped: false, prog: p };
  }
  p.lastAdminAdjust = { delta: d, at: now, by: String(actor).slice(0, 40), reason: String(reason).slice(0, 200), before };
  try {
    engineEmit('XP_ADJUSTED', { bid: profile?.identity?.bid || '', name: profile?.registration?.name || '', delta: d, reason: String(reason).slice(0, 120) });
  } catch (e) {}
  return { ok: true, delta: d, before, after: { xp: p.xp, totalXp: p.totalXp, level: p.level, prestige: p.prestige }, copper: res.copper || 0, events: res.events || [] };
}

/** Macht das LETZTE Admin-Adjust rückgängig (einmalig, XP-Stand-Restore). */
export function adminRollbackXp(profile, { actor = '?', now = Date.now() } = {}) {
  const p = ensureProgression(profile);
  if (!p) return { ok: false, reason: 'no-profile' };
  const last = p.lastAdminAdjust;
  if (!last || !last.before) return { ok: false, reason: 'nothing-to-rollback' };
  p.xp = Math.max(0, Math.floor(Number(last.before.xp) || 0));
  p.totalXp = Math.max(0, Math.floor(Number(last.before.totalXp) || 0));
  p.level = Math.max(0, Math.min(PROGRESSION.maxLevel, Math.floor(Number(last.before.level) || 0)));
  p.prestige = Math.max(0, Math.min(PROGRESSION.maxPrestige, Math.floor(Number(last.before.prestige) || 0)));
  p.lastAdminAdjust = null;
  try {
    engineEmit('XP_ADJUSTED', { bid: profile?.identity?.bid || '', name: profile?.registration?.name || '', delta: 0, reason: ('rollback:' + String(last.reason || '')).slice(0, 120) });
  } catch (e) {}
  return { ok: true, rolledBack: last.delta, restored: { xp: p.xp, totalXp: p.totalXp, level: p.level, prestige: p.prestige } };
}

export { PROGRESSION, LOVE_EMOJIS, de as formatDe };

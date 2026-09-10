/* ═══════════════════════════════════════════════════════════════════════
   💜  L O V E B O T   L E V E L   S Y S T E M   v1.0  (levelsystem.js)
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
   │ Level-Up-Belohnung           │ 20 + 5·Level Kupfer (max. 400)   │
   │ Prestige-Up-Belohnung        │ 10.000 Kupfer                    │
   └──────────────────────────────┴──────────────────────────────────┘
   ══════════════════════════════════════════════════════════════════ */

import { emit as engineEmit } from './loveengine.js';

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

const LOVE_EMOJIS = ['❤️', '🥰', '😍', '😘', '💖', '💗', '💓', '💘', '💝', '🌹', '', '💐', '🧸', '✨', '🫶', '', '🩷', '😻', '🌸', '💕'];

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
  for (const e of LOVE_EMOJIS) if (t.includes(e)) score += 1;
  let bonus = 0;
  if (COMPLIMENT_RE.test(t)) bonus = XP.complimentBonus;
  if (score >= 3) return { kind: 'love', mult: 3, bonus, score, label: 'Liebesnachricht 💜' };
  if (score >= 1) return { kind: 'kind', mult: 2, bonus, score, label: 'nette Nachricht 💕' };
  return { kind: 'normal', mult: 1, bonus: 0, score: 0, label: 'Nachricht' };
}

/* ─────────────────────────────────────────────────────────────────────
   Profil-Progression
   ───────────────────────────────────────────────────────────────────── */

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
  p.streak = Math.max(0, Number(p.streak) || 0);
  p.xpWindow = Array.isArray(p.xpWindow) ? p.xpWindow : [];
  p.xpSources = p.xpSources || { messages: 0, love: 0, commands: 0, games: 0, dailies: 0, work: 0 };
  profile.progression = p;
  return p;
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

function addWallet(profile, copper) {
  if (!copper) return;
  profile.wallet = profile.wallet || { copper: 0, silver: 0, gold: 0, platin: 0 };
  profile.wallet.copper = Math.max(0, (Number(profile.wallet.copper) || 0) + copper);
}

/**
 * Vergibt XP und verarbeitet alle Level-/Prestige-Ups.
 * @param {object} profile  komplettes User-Profil (wird verändert)
 * @param {number} amount   XP-Betrag (>= 0)
 * @param {{source?:string, now?:number, capped?:boolean}} opts
 * @returns {{granted:number, copper:number, events:Array, maxed:boolean, capped:boolean, prog:object}}
 */
export function grantXp(profile, amount, { source = 'general', now = Date.now() } = {}) {
  const p = ensureProgression(profile);
  const amt = Math.max(0, Math.floor(Number(amount) || 0));
  const events = [];
  if (!amt) return { granted: 0, copper: 0, events, maxed: false, capped: false, prog: p };

  const wasMaxed = p.prestige >= PROGRESSION.maxPrestige && p.level >= PROGRESSION.maxLevel;
  p.xp = Math.min(Number.MAX_SAFE_INTEGER - 1024, (Number(p.xp) || 0) + amt);
  p.totalXp = Math.min(Number.MAX_SAFE_INTEGER, (Number(p.totalXp) || 0) + amt);
  p.xpSources[source] = (Number(p.xpSources[source]) || 0) + amt;
  p.lastXpAt = now;

  /* Streak: 1 Tag = 1 XP-Vergabe an diesem Kalendertag */
  const today = dayKey(now);
  if (p.lastActiveDay !== today) {
    p.streak = (p.lastActiveDay === dayKey(now - DAY_MS)) ? (Number(p.streak) || 0) + 1 : 1;
    p.lastActiveDay = today;
  }

  let copper = 0;
  let need = neededXp(p.level, p.prestige);
  while (!wasMaxed && p.xp >= need) {
    p.xp -= need;
    p.level += 1;
    if (p.level > PROGRESSION.maxLevel) {
      /* Prestige-Up: neues Kapitel beginnt bei Level 0 */
      p.prestige = Math.min(PROGRESSION.maxPrestige, p.prestige + 1);
      p.level = 0;
      copper += 10000;
      events.push({ type: 'prestige', prestige: p.prestige, rank: rankFor(p.prestige, 0) });
    } else {
      copper += Math.min(400, 20 + 5 * p.level);
      events.push({ type: 'levelup', level: p.level, rank: rankFor(p.prestige, p.level) });
    }
    need = neededXp(p.level, p.prestige);
  }
  p.neededXpForLvOrPrestigeUp = need;
  if (p.prestige >= PROGRESSION.maxPrestige && p.level >= PROGRESSION.maxLevel) p.xp = need - 1; /* MAX: volle Leiste */
  addWallet(profile, copper);

  /* 💜 LoveCore: Events für Live-Feed & Owner-Center (nie werfend) */
  const evtBase = { bid: profile?.identity?.bid || '', name: profile?.registration?.name || '', source };
  engineEmit('XP_GRANTED', { ...evtBase, granted: amt, level: p.level });
  for (const ev of events) {
    if (ev.type === 'levelup') engineEmit('LEVEL_UP', { ...evtBase, level: ev.level, xp: p.xp });
    if (ev.type === 'prestige') engineEmit('PRESTIGE_UP', { ...evtBase, prestige: ev.prestige, level: 0 });
  }
  if (copper > 0) engineEmit('COINS_EARNED', { ...evtBase, granted: copper, reason: events.some((e) => e.type === 'prestige') ? 'prestige' : 'levelup' });

  return { granted: amt, copper, events, maxed: wasMaxed, capped: false, prog: p };
}

/**
 * XP für eine normale (nicht-Befehl-)Nachricht — inkl. Nette-Erkennung
 * und dem gleitenden Anti-Spam-Fenster (60 Min).
 */
export function applyMessageXp(profile, { text = '', isGroup = false, now = Date.now() } = {}) {
  const p = ensureProgression(profile);
  if (!xpEligible(profile)) return { granted: 0, kind: 'normal', capped: false, skipped: 'not-eligible' };
  pruneWindow(p, now);
  const kind = detectKindText(text);
  const base = isGroup ? XP.msgGroup : XP.msg1to1;
  let want = base * kind.mult + kind.bonus;
  const used = windowUsed(p, 'msg');
  const room = Math.max(0, MSG_CAP_PER_HOUR - used);
  const granted = Math.min(want, room);
  if (granted > 0) {
    p.xpWindow.push({ t: now, a: granted, s: 'msg' });
    const res = grantXp(profile, granted, { source: kind.kind === 'love' ? 'love' : 'messages', now });
    return { granted, want, kind, capped: granted < want, events: res.events, copper: res.copper };
  }
  return { granted: 0, want, kind, capped: true };
}

/** XP für die Nutzung eines Befehls (Liebes-Aktionen zählen doppelt). */
export function applyCommandXp(profile, { loveAction = false, now = Date.now() } = {}) {
  const p = ensureProgression(profile);
  if (!xpEligible(profile)) return { granted: 0, capped: false, skipped: 'not-eligible' };
  pruneWindow(p, now);
  const want = loveAction ? XP.loveAction : XP.command;
  const used = windowUsed(p, 'cmd');
  const room = Math.max(0, CMD_CAP_PER_HOUR - used);
  const granted = Math.min(want, room);
  if (granted > 0) {
    p.xpWindow.push({ t: now, a: granted, s: 'cmd' });
    const res = grantXp(profile, granted, { source: 'commands', now });
    return { granted, kind: 'command', capped: granted < want, events: res.events, copper: res.copper };
  }
  return { granted: 0, want, kind: 'command', capped: true };
}

/* ─────────────────────────────────────────────────────────────────────
   Anzeigetexte (WhatsApp-Markdown, im LoveBot-Stil)
   ───────────────────────────────────────────────────────────────────── */

/** Ankündigung nach Level-Up / Prestige-Up (im Chat). */
export function levelUpAnnounce(profile, name) {
  const p = ensureProgression(profile);
  const rank = rankFor(p.prestige, p.level);
  const pct = levelPct(p);
  const lines = [
    '> 🎉 *LEVEL UP!*',
    '',
    `💜 *${name}* erreicht *Level ${de(p.level)}*!`,
    `\`${bar(pct)}\` ${pct}% bis Level ${de(p.level + 1)}`,
    `🏅 Rang: ${rank.full}`,
    ''
  ];
  if (p.prestige > 0) lines.unshift(`✨ Prestige ${de(p.prestige)}`);
  lines.push('🤎 _Weiter aktiv bleiben zahlt sich aus — nette Nachrichten bringen extra XP!_');
  return lines.join('\n');
}

/** Große Prestige-Up-Ankündigung. */
export function prestigeAnnounce(profile, name) {
  const p = ensureProgression(profile);
  const rank = rankFor(p.prestige, 0);
  return [
    '═══════════════════════════',
    '✨  P R E S T I G E   U P  ✨',
    '═══════════════════════════',
    '',
    `👑 *${name}* startet ein neues Kapitel: *Prestige ${de(p.prestige)}*!`,
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
    '',
    `⭐ Prestige *${de(p.prestige)}* · Level *${de(p.level)}*`,
    maxed
      ? '\`▰▰▰▰▰▰▰▰▰\` 100% — *MAX EREICHT!* 👑'
      : `\`${bar(pct)}\` ${pct}%\n${de(p.xp)} / ${de(p.neededXpForLvOrPrestigeUp)} XP bis Level ${de(p.level + 1)}`,
    `Σ Lifetime: *${de(p.totalXp)}* XP · 🔥 Streak: *${de(p.streak)}* Tag(e)`,
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

export { PROGRESSION, LOVE_EMOJIS, de as formatDe };

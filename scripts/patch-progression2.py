#!/usr/bin/env python3
# Progression 2.0 — XP-Regel-Engine in levelsystem.js
# Kategorien + Multiplikatoren + Anti-Farm + 3 Streaks + xpLog + Meilensteine
# Alles regelgesteuert über Database/xp-rules.json (konfigurierbar im Owner-Center)
import io

s = io.open('levelsystem.js', encoding='utf-8').read()
n = 0

# ═══ 1) XP-Regel-Store (nach dem loveengine-Import) ═══════════════════
old = "import { emit as engineEmit } from './loveengine.js';"
new = """import { emit as engineEmit } from './loveengine.js';
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
  multipliers: { weekend: 1.25, event: 1.0, eventActive: false, prestigePerLevel: 0.05, prestigeCap: 0.5 },
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
    duplicateWindowSec: 45, duplicateMaxPerDay: 5,
    mutualFarmMaxPerHour: 6,
    suspiciousXpPerDay: 1500
  }
};

function loadXpRules() {
  let r = null;
  try { r = JSON.parse(fs.readFileSync(XP_RULES_FILE, 'utf8')); } catch (e) {}
  const merge = (a, b) => (a && typeof a === 'object' && b && typeof b === 'object')
    ? Object.fromEntries(Object.keys(b).map((k) => [k, merge(a[k], b[k])]))
    : (b === undefined ? a : b);
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
    antiFarm: rules.antiFarm || XP_RULES.antiFarm
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
  return String(text || '').toLowerCase().replace(/\\s+/g, ' ').trim().slice(0, 80);
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
"""
assert old in s
s = s.replace(old, new, 1)
n += 1

# ═══ 2) ensureProgression: neue Felder ═══════════════════════════════
old = """  p.xpSources = p.xpSources || { messages: 0, love: 0, commands: 0, games: 0, dailies: 0, work: 0 };
  profile.progression = p;
  return p;
}"""
new = """  p.xpSources = p.xpSources || { messages: 0, love: 0, commands: 0, games: 0, dailies: 0, work: 0 };
  /* Progression 2.0: drei getrennte Streaks, XP-Log (ohne Texte), Daily-Zähler,
     Meilenstein-Freischaltungen, Einmal-Flags (Media-XP) */
  p.streaks = p.streaks || { daily: { c: 0, last: '' }, chat: { c: 0, last: '' }, xp: { c: 0, last: '' } };
  for (const k of ['daily', 'chat', 'xp']) {
    p.streaks[k] = p.streaks[k] || { c: 0, last: '' };
    p.streaks[k].c = Math.max(0, Number(p.streaks[k].c) || 0);
  }
  p.xpLog = Array.isArray(p.xpLog) ? p.xpLog : [];
  p.xpDaily = Array.isArray(p.xpDaily) ? p.xpDaily : [];
  p.recentMsgs = Array.isArray(p.recentMsgs) ? p.recentMsgs : [];
  p.unlocks = p.unlocks || {};
  profile.flags = profile.flags || {};
  profile.flags.media = profile.flags.media || { first: null, providers: {}, day: '', count: 0 };
  profile.progression = p;
  return p;
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
}"""
assert old in s
s = s.replace(old, new, 1)
n += 1

# ═══ 3) grantXp: xpLog + xpDaily + Streaks + Meilensteine + Notify ════
old = """  p.xpSources[source] = (Number(p.xpSources[source]) || 0) + amt;
  p.lastXpAt = now;

  /* Streak: 1 Tag = 1 XP-Vergabe an diesem Kalendertag */
  const today = dayKey(now);
  if (p.lastActiveDay !== today) {
    p.streak = (p.lastActiveDay === dayKey(now - DAY_MS)) ? (Number(p.streak) || 0) + 1 : 1;
    p.lastActiveDay = today;
  }"""
new = """  p.xpSources[source] = (Number(p.xpSources[source]) || 0) + amt;
  p.lastXpAt = now;

  /* Streak: 1 Tag = 1 XP-Vergabe an diesem Kalendertag (Legacy-Feld) */
  const today = dayKey(now);
  if (p.lastActiveDay !== today) {
    p.streak = (p.lastActiveDay === dayKey(now - DAY_MS)) ? (Number(p.streak) || 0) + 1 : 1;
    p.lastActiveDay = today;
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
    tickStreak(p, 'daily', now);
    tickStreak(p, 'xp', now, 50); /* XP-Streak: min. 50 XP am Tag */
  }"""
assert old in s
s = s.replace(old, new, 1)
n += 1

# Meilensteine + Notify nach den Level-Events
old = """  /* 💜 LoveCore: Events für Live-Feed & Owner-Center (nie werfend) */
  const evtBase = { bid: profile?.identity?.bid || '', name: profile?.registration?.name || '', source };
  engineEmit('XP_GRANTED', { ...evtBase, granted: amt, level: p.level });
  for (const ev of events) {
    if (ev.type === 'levelup') engineEmit('LEVEL_UP', { ...evtBase, level: ev.level, xp: p.xp });
    if (ev.type === 'prestige') engineEmit('PRESTIGE_UP', { ...evtBase, prestige: ev.prestige, level: 0 });
  }
  if (copper > 0) engineEmit('COINS_EARNED', { ...evtBase, granted: copper, reason: events.some((e) => e.type === 'prestige') ? 'prestige' : 'levelup' });

  return { granted: amt, copper, events, maxed: wasMaxed, capped: false, prog: p };
}"""
new = """  /* 🎁 Meilenstein-Freischaltungen (Progression 2.0) */
  for (const m of MILESTONES) {
    if (p.level >= m.level && p.prestige === 0 && !p.unlocks['lv' + m.level]) {
      p.unlocks['lv' + m.level] = now;
      events.push({ type: 'milestone', level: m.level, reward: m.label });
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
      try { notifyUser(evtBase.bid || '', 'achievement', { title: '🎁 Meilenstein Level ' + ev.level, text: 'Freigeschaltet: ' + ev.reward, link: '/level.html' }); } catch (e) {}
    }
  }
  if (copper > 0) engineEmit('COINS_EARNED', { ...evtBase, granted: copper, reason: events.some((e) => e.type === 'prestige') ? 'prestige' : 'levelup' });
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
  { level: 5,   label: '🌱 Sweetheart' },
  { level: 10,  label: '💜 Profil-Rahmen' },
  { level: 20,  label: '🌹 Romantiker' },
  { level: 30,  label: '💎 Elite-Status' },
  { level: 50,  label: '👑 Master' },
  { level: 100, label: '🌌 Eternal' }
];

export function rewardsTable(prestige = 0, level = 0) {
  return MILESTONES.map((m) => ({
    level: m.level,
    label: m.label,
    coins: 20 + 5 * m.level,
    unlocked: prestige > 0 ? true : level >= m.level
  }));
}

/**
 * XP-Multiplikator (Progression 2.0):
 * Base × Weekend-Multi × Event-Multi × Prestige-Bonus
 */
export function xpMultiplier(profile, now = Date.now()) {
  const r = xpRules().multipliers;
  let m = 1;
  const dow = new Date(now).getDay();
  if (dow === 0 || dow === 6) m *= Math.max(1, Number(r.weekend) || 1);
  if (r.eventActive) m *= Math.max(1, Number(r.event) || 1);
  const prestige = Number(profile?.progression?.prestige) || 0;
  if (prestige > 0) m *= 1 + Math.min(Number(r.prestigeCap) || 0, prestige * (Number(r.prestigePerLevel) || 0));
  return m;
}

/** Wendet den Multiplikator auf eine Basis-XP an (gerundet). */
export function applyMultiplier(base, profile, now = Date.now()) {
  return Math.max(0, Math.round(base * xpMultiplier(profile, now)));
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
  const out = { senderXp: 0, recipientXp: 0, skipped: null, farmSuspect: false, bond: 0, events: [] };
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
    senderProfile.stats.compliments.count += 1;
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
}"""
assert old in s
s = s.replace(old, new, 1)
n += 1

# ═══ 4) applyMessageXp: Regeln + Anti-Farm (Duplikate) + Chat-Streak ══
old = """export function applyMessageXp(profile, { text = '', isGroup = false, now = Date.now() } = {}) {
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
}"""
new = """export function applyMessageXp(profile, { text = '', isGroup = false, now = Date.now() } = {}) {
  const p = ensureProgression(profile);
  if (!xpEligible(profile)) return { granted: 0, kind: 'normal', capped: false, skipped: 'not-eligible' };
  const r = xpRules();
  const cat = r.categories?.message || {};
  const af = r.antiFarm || {};
  if (!cat.enabled) return { granted: 0, kind: 'normal', capped: false, skipped: 'disabled' };
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
  let want = applyMultiplier(base * mult + (kind.bonus ? (Number(cat.complimentBonus) || 5) : 0), profile, now);
  const cap = Number(af.msgCapPerHour) || MSG_CAP_PER_HOUR;
  const used = windowUsed(p, 'msg');
  const room = Math.max(0, cap - used);
  const granted = Math.min(want, room);
  if (granted > 0) {
    p.xpWindow.push({ t: now, a: granted, s: 'msg' });
    tickStreak(p, 'chat', now); /* 💬 Chat-Streak: aktive Beteiligung */
    const res = grantXp(profile, granted, { source: kind.kind === 'love' ? 'love' : 'messages', now });
    return { granted, want, kind, capped: granted < want, events: res.events, copper: res.copper };
  }
  return { granted: 0, want, kind, capped: true };
}"""
assert old in s
s = s.replace(old, new, 1)
n += 1

# ═══ 5) applyCommandXp: Regeln + Multiplikator ═══════════════════════
old = """export function applyCommandXp(profile, { loveAction = false, now = Date.now() } = {}) {
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
}"""
new = """export function applyCommandXp(profile, { loveAction = false, now = Date.now() } = {}) {
  const p = ensureProgression(profile);
  if (!xpEligible(profile)) return { granted: 0, capped: false, skipped: 'not-eligible' };
  const r = xpRules();
  const cat = r.categories?.command || {};
  const af = r.antiFarm || {};
  if (!cat.enabled) return { granted: 0, capped: false, skipped: 'disabled' };
  pruneWindow(p, now);
  const want = applyMultiplier(loveAction ? (Number(cat.loveAction) || 5) : (Number(cat.base) || 2), profile, now);
  const cap = Number(af.cmdCapPerHour) || CMD_CAP_PER_HOUR;
  const used = windowUsed(p, 'cmd');
  const room = Math.max(0, cap - used);
  const granted = Math.min(want, room);
  if (granted > 0) {
    p.xpWindow.push({ t: now, a: granted, s: 'cmd' });
    const res = grantXp(profile, granted, { source: 'commands', now });
    return { granted, kind: 'command', capped: granted < want, events: res.events, copper: res.copper };
  }
  return { granted: 0, want, kind: 'command', capped: true };
}"""
assert old in s
s = s.replace(old, new, 1)
n += 1

# ═══ 6) XP-Quellen-Label: 'compliments' + 'media' ergänzen (Doku/Stats) ═
old = "  p.xpSources = p.xpSources || { messages: 0, love: 0, commands: 0, games: 0, dailies: 0, work: 0 };"
new = "  p.xpSources = p.xpSources || { messages: 0, love: 0, commands: 0, games: 0, dailies: 0, work: 0, compliments: 0, media: 0 };"
assert old in s
s = s.replace(old, new, 1)
n += 1

io.open('levelsystem.js', 'w', encoding='utf-8').write(s)
print('levelsystem.js Progression-2.0 Patches:', n)

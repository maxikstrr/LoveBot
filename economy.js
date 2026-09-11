/* ═══════════════════════════════════════════════════════════════════
   💰 LOVE BOT — ECONOMY ENGINE (Progression 6.0)
   Zentrale Buchführung für Kupfer (kanonische Währung).
   • addCoins / removeCoins / transferCoins / getBalance — einzige Schreibwege
   • Transaktions-Log (bounded), Perioden-Zähler, Monats-Historie
   • Wallet + Bank (Kapazität, Zinsen), Daily/Weekly/Monthly/Yearly-Rewards
   • Overflow-/Negativ-/Double-Spend-Schutz, Owner-Tools + Rollback
   Silber/Gold/Platin bleiben Legacy-Anzeige (keine neuen Quellen).
   ═══════════════════════════════════════════════════════════════════ */

import { xpRules, setCoinHook, ensureProgression } from './levelsystem.js';
import { emit as engineEmit } from './loveengine.js';
import { notify as notifyUser } from './notifications.js';

export const MAX_TX = 60;          /* Transaktionen pro Profil (neueste zuerst) */
export const MAX_MONTHS = 24;      /* Monats-Historie */
export const MAX_DAILY_HISTORY = 60;

export function economyRules() {
  return xpRules().economy || {};
}

const ecoNum = (v, fb) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
};

function dayKeyUTC(ts = Date.now()) {
  return new Date(ts).toISOString().slice(0, 10);
}

function monthKeyUTC(ts = Date.now()) {
  return new Date(ts).toISOString().slice(0, 7);
}

function yearKeyUTC(ts = Date.now()) {
  return new Date(ts).toISOString().slice(0, 4);
}

/* ISO-Wochen-Schlüssel (eigene kleine Implementierung — keine levelsystem-Abhängigkeit im Format) */
export function ecoWeekKey(ts = Date.now()) {
  const d = new Date(Date.UTC(new Date(ts).getUTCFullYear(), new Date(ts).getUTCMonth(), new Date(ts).getUTCDate()));
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const first = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((d - first) / 86400000 - 3 + ((first.getUTCDay() + 6) % 7)) / 7);
  return d.getUTCFullYear() + '-W' + String(week).padStart(2, '0');
}

const SOURCE_LABELS = {
  levelup: '⭐ Level-Up', prestige: '👑 Prestige', milestone: '🎁 Meilenstein',
  dailygoal: '🎯 Tagesziel', weeklygoal: '🏆 Wochenziel', monthlygoal: '📅 Monatsziel',
  chest: '🎁 Truhe', daily: '📅 Daily', weekly: '🗓️ Wochen-Bonus', monthly: '🗓️ Monats-Bonus',
  yearly: '🎆 Jahres-Bonus', work: '💼 Arbeit', gamble: '🎰 Gamble', rob: '🥷 Raub',
  shop: '🛍️ Shop', gift: '🎁 Geschenk', transfer: '💸 Transfer', deposit: '🏦 Einzahlung',
  withdraw: '🏦 Auszahlung', interest: '📈 Zinsen', lovebonus: '💜 Love-Bonus',
  reward: '🎁 Belohnung', starter: '🌱 Startbonus', admin: '👑 Owner', migration: '🔄 Migration',
  marry: '💍 Hochzeit', pet: '🐾 Haustier', dailylove: '🌹 Daily-Love', misc: '🪙 Sonstiges'
};
export function sourceLabel(s) {
  return SOURCE_LABELS[String(s || 'misc')] || SOURCE_LABELS.misc;
}

/** Legt profile.economy an bzw. migriert fehlende Felder (nichts wird je zurückgesetzt). */
export function ensureEconomy(profile) {
  if (!profile || typeof profile !== 'object') return null;
  const e = profile.economy || (profile.economy = {});
  if (!Array.isArray(e.tx)) e.tx = [];
  e.stats = e.stats || {};
  for (const k of ['earned', 'spent', 'highBal', 'highWallet', 'highBank']) {
    e.stats[k] = Math.max(0, Math.floor(Number(e.stats[k]) || 0));
  }
  e.periods = e.periods || {};
  for (const k of ['day', 'week', 'month', 'year']) {
    const b = e.periods[k] || (e.periods[k] = {});
    b.k = typeof b.k === 'string' ? b.k : '';
    b.e = Math.max(0, Math.floor(Number(b.e) || 0));
    b.s = Math.max(0, Math.floor(Number(b.s) || 0));
  }
  if (!e.monthly || typeof e.monthly !== 'object' || Array.isArray(e.monthly)) e.monthly = {};
  pruneEcoMonths(e.monthly);
  e.daily = e.daily || {};
  e.daily.last = typeof e.daily.last === 'string' ? e.daily.last : '';
  e.daily.streak = Math.max(0, Math.floor(Number(e.daily.streak) || 0));
  e.daily.best = Math.max(0, Math.floor(Number(e.daily.best) || 0));
  if (!Array.isArray(e.daily.history)) e.daily.history = [];
  for (const k of ['lastWeekReward', 'lastMonthReward', 'lastYearReward']) {
    if (typeof e.daily[k] !== 'string') e.daily[k] = '';
  }
  if (!e.interest || typeof e.interest !== 'object') e.interest = { lastAt: 0 };
  e.interest.lastAt = Math.max(0, Number(e.interest.lastAt) || 0);
  if (!e.transferDaily || typeof e.transferDaily !== 'object') e.transferDaily = { d: '', sum: 0 };
  if (typeof e.transferDaily.d !== 'string') e.transferDaily.d = '';
  e.transferDaily.sum = Math.max(0, Math.floor(Number(e.transferDaily.sum) || 0));
  if (e.lastAdminAdjust !== null && typeof e.lastAdminAdjust !== 'object') e.lastAdminAdjust = null;
  /* Bank-Vault existiert seit jeher im Template — nur Form sichern, nie anfassen */
  if (!profile.bank || typeof profile.bank !== 'object') profile.bank = { active: false, copper: 0 };
  profile.bank.copper = Math.max(0, Math.floor(Number(profile.bank.copper) || 0));
  if (!profile.wallet || typeof profile.wallet !== 'object') profile.wallet = { copper: 0 };
  profile.wallet.copper = Math.max(0, Math.floor(Number(profile.wallet.copper) || 0));
  return e;
}

function pruneEcoMonths(map) {
  if (!map || typeof map !== 'object') return;
  const keys = Object.keys(map).sort();
  while (keys.length > MAX_MONTHS) delete map[keys.shift()];
}

function walletBal(profile) {
  return Math.max(0, Math.floor(Number(profile?.wallet?.copper) || 0));
}

function bankBal(profile) {
  return Math.max(0, Math.floor(Number(profile?.bank?.copper) || 0));
}

/** Rotiert Tages-/Wochen-/Monats-/Jahres-Zähler bei Schlüsselwechsel. */
function rotatePeriods(e, now) {
  const keys = { day: dayKeyUTC(now), week: ecoWeekKey(now), month: monthKeyUTC(now), year: yearKeyUTC(now) };
  for (const [k, key] of Object.entries(keys)) {
    const b = e.periods[k];
    if (b.k !== key) { b.k = key; b.e = 0; b.s = 0; }
  }
}

/** Bucht eine Transaktion ins Log + alle Zähler (interne Buchung, keine Mutation der Vaults). */
function logTx(profile, e, { vault = 'wallet', delta = 0, source = 'misc', reason = '', now = Date.now(), actor = '' } = {}) {
  rotatePeriods(e, now);
  const d = Math.floor(Number(delta) || 0);
  const entry = {
    t: now,
    v: vault === 'bank' ? 'bank' : 'wallet',
    d,
    s: String(source || 'misc').slice(0, 24),
    r: String(reason || '').slice(0, 80)
  };
  if (actor) entry.a = String(actor).slice(0, 40);
  e.tx.unshift(entry);
  if (e.tx.length > MAX_TX) e.tx.length = MAX_TX;
  if (d > 0) {
    e.stats.earned += d;
    e.periods.day.e += d; e.periods.week.e += d; e.periods.month.e += d; e.periods.year.e += d;
    const mk = monthKeyUTC(now);
    const mm = e.monthly[mk] || (e.monthly[mk] = { e: 0, s: 0 });
    mm.e += d;
    pruneEcoMonths(e.monthly);
  } else if (d < 0) {
    const a = -d;
    e.stats.spent += a;
    e.periods.day.s += a; e.periods.week.s += a; e.periods.month.s += a; e.periods.year.s += a;
    const mk = monthKeyUTC(now);
    const mm = e.monthly[mk] || (e.monthly[mk] = { e: 0, s: 0 });
    mm.s += a;
    pruneEcoMonths(e.monthly);
  }
  /* 🏆 Wasserstände */
  const w = walletBal(profile), b = bankBal(profile);
  if (w > e.stats.highWallet) e.stats.highWallet = w;
  if (b > e.stats.highBank) e.stats.highBank = b;
  if (w + b > e.stats.highBal) e.stats.highBal = w + b;
  return entry;
}

function coinCap() {
  return Math.max(1, Math.floor(ecoNum(economyRules().coinCap, 999999999999)));
}

function evtBase(profile, extra = {}) {
  return {
    bid: profile?.identity?.bid || '',
    name: profile?.registration?.name || '',
    ...extra
  };
}

/** Aktueller Kontostand (Wallet + Bank + Gesamt + Kapazität). */
export function getBalance(profile) {
  ensureEconomy(profile);
  const wallet = walletBal(profile);
  const bank = bankBal(profile);
  const achCount = profile ? countAchievements(profile) : 0;
  const capacity = capacityFor(profile, achCount);
  return { wallet, bank, total: wallet + bank, capacity, capacityUsed: bank, capacityFree: Math.max(0, capacity - bank) };
}

/* Zählt vergebene Achievements — plusStore hängt am Profil (Love.js) oder global (Fallback 0). */
function countAchievements(profile) {
  try {
    const u = profile?._plusUser;
    if (u && u.achievements && typeof u.achievements === 'object') return Object.keys(u.achievements).length;
  } catch (e) {}
  return 0;
}

/**
 * Bank-Kapazität aus Regeln + Fortschritt.
 * @param {number} achCount Zahl vergebener Achievements (Call-Site liefert echten Wert)
 */
export function capacityFor(profile, achCount = 0) {
  const r = economyRules();
  const base = Math.max(0, Math.floor(ecoNum(r.bankBase, 100000)));
  const perLv = Math.max(0, Math.floor(ecoNum(r.bankPerLevel, 100)));
  const perPr = Math.max(0, Math.floor(ecoNum(r.bankPerPrestige, 5000)));
  const perAch = Math.max(0, Math.floor(ecoNum(r.bankPerAchievement, 50)));
  const p = ensureProgression ? ensureProgression(profile) : null;
  const lv = Math.max(0, Number(p?.level) || 0);
  const pr = Math.max(0, Number(p?.prestige) || 0);
  return base + lv * perLv + pr * perPr + Math.max(0, Math.floor(Number(achCount) || 0)) * perAch;
}

/**
 * Gutschrift — einziger Weg, Kupfer zu erzeugen (neben internen Engine-Adds via Hook).
 * @returns {{ok:true,balance,total,tx}|{ok:false,reason:'invalid'|'overflow',balance,maxAddable}}
 */
export function addCoins(profile, amount, { vault = 'wallet', source = 'misc', reason = '', now = Date.now(), actor = '' } = {}) {
  const e = ensureEconomy(profile);
  if (!e) return { ok: false, reason: 'no-profile' };
  const amt = Math.floor(Number(amount));
  if (!Number.isFinite(amt) || amt <= 0) return { ok: false, reason: 'invalid', balance: walletBal(profile) };
  const cap = coinCap();
  const v = vault === 'bank' ? 'bank' : 'wallet';
  const cur = v === 'bank' ? bankBal(profile) : walletBal(profile);
  if (cur + amt > cap) {
    return { ok: false, reason: 'overflow', balance: cur, maxAddable: Math.max(0, cap - cur) };
  }
  if (v === 'bank') {
    profile.bank.copper = cur + amt;
    profile.bank.active = true;
  } else {
    profile.wallet.copper = cur + amt;
  }
  const tx = logTx(profile, e, { vault: v, delta: amt, source, reason, now, actor });
  try { engineEmit('COINS_EARNED', evtBase(profile, { amount: amt, vault: v, source })); } catch (err) {}
  return { ok: true, balance: v === 'bank' ? bankBal(profile) : walletBal(profile), total: walletBal(profile) + bankBal(profile), tx };
}

/**
 * Abbuchung mit Guthaben-Prüfung (kein Negativ-Saldo möglich).
 * @returns {{ok:true,balance,total,tx}|{ok:false,reason:'invalid'|'insufficient',balance,needed}}
 */
export function removeCoins(profile, amount, { vault = 'wallet', source = 'misc', reason = '', now = Date.now(), actor = '' } = {}) {
  const e = ensureEconomy(profile);
  if (!e) return { ok: false, reason: 'no-profile' };
  const amt = Math.floor(Number(amount));
  if (!Number.isFinite(amt) || amt <= 0) return { ok: false, reason: 'invalid', balance: walletBal(profile) };
  const v = vault === 'bank' ? 'bank' : 'wallet';
  const cur = v === 'bank' ? bankBal(profile) : walletBal(profile);
  if (cur < amt) return { ok: false, reason: 'insufficient', balance: cur, needed: amt };
  if (v === 'bank') profile.bank.copper = cur - amt;
  else profile.wallet.copper = cur - amt;
  const tx = logTx(profile, e, { vault: v, delta: -amt, source, reason, now, actor });
  try { engineEmit('COINS_SPENT', evtBase(profile, { amount: amt, vault: v, source })); } catch (err) {}
  return { ok: true, balance: v === 'bank' ? bankBal(profile) : walletBal(profile), total: walletBal(profile) + bankBal(profile), tx };
}

/**
 * Transfer zwischen zwei Profilen (atomar auf Datenebene: erst abbuchen, nur bei Erfolg gutschreiben).
 * Lock-Reihenfolge (bid-sortiert) verantwortet die Call-Site (Deadlock-Schutz).
 */
export function transferCoins(fromProfile, toProfile, amount, { reason = '', now = Date.now(), actor = '' } = {}) {
  const ef = ensureEconomy(fromProfile);
  const et = ensureEconomy(toProfile);
  if (!ef || !et) return { ok: false, reason: 'no-profile' };
  if (fromProfile === toProfile) return { ok: false, reason: 'self' };
  const r = economyRules();
  const amt = Math.floor(Number(amount));
  const min = Math.max(1, Math.floor(ecoNum(r.transferMin, 1)));
  const max = Math.max(min, Math.floor(ecoNum(r.transferMax, 10000)));
  const dayCap = Math.max(max, Math.floor(ecoNum(r.transferDailyCap, 50000)));
  if (!Number.isFinite(amt) || amt < min) return { ok: false, reason: 'invalid', min };
  if (amt > max) return { ok: false, reason: 'too-large', max };
  /* Tages-Limit (rotierend) */
  const dk = dayKeyUTC(now);
  if (ef.transferDaily.d !== dk) { ef.transferDaily.d = dk; ef.transferDaily.sum = 0; }
  if (ef.transferDaily.sum + amt > dayCap) {
    return { ok: false, reason: 'daily-cap', cap: dayCap, used: ef.transferDaily.sum };
  }
  const fromBid = fromProfile?.identity?.bid || '';
  const toBid = toProfile?.identity?.bid || '';
  const out = removeCoins(fromProfile, amt, { source: 'transfer', reason: reason || ('→ ' + (toProfile?.registration?.name || toBid || '?')), now, actor });
  if (!out.ok) return out;
  ef.transferDaily.sum += amt;
  const back = addCoins(toProfile, amt, { source: 'transfer', reason: reason || ('← ' + (fromProfile?.registration?.name || fromBid || '?')), now, actor });
  if (!back.ok) {
    /* Sollte nie passieren (Cap) — trotzdem sauber zurückbuchen statt Geld zu vernichten */
    addCoins(fromProfile, amt, { source: 'transfer', reason: 'Rückbuchung (Empfänger-Cap)', now, actor });
    return { ok: false, reason: back.reason || 'target-cap', balance: out.balance };
  }
  try { engineEmit('TRANSFER', evtBase(fromProfile, { amount: amt, to: toBid })); } catch (err) {}
  try {
    notifyUser(toBid || '', 'economy', {
      title: '💸 +' + amt.toLocaleString('de-DE') + ' Kupfer erhalten',
      text: 'Von ' + (fromProfile?.registration?.name || 'jemandem'),
      link: '/account.html'
    });
  } catch (err) {}
  return { ok: true, amount: amt, fromBalance: out.balance, toBalance: back.balance };
}

/**
 * Einzahlung Wallet → Bank (Kapazitäts-Prüfung). amount='all' nimmt min(Wallet, frei).
 */
export function deposit(profile, amount, { now = Date.now(), achCount = 0, actor = '' } = {}) {
  const e = ensureEconomy(profile);
  if (!e) return { ok: false, reason: 'no-profile' };
  const cap = capacityFor(profile, achCount);
  const w = walletBal(profile);
  const b = bankBal(profile);
  const free = Math.max(0, cap - b);
  if (w <= 0) return { ok: false, reason: 'empty-wallet', balance: w };
  if (free <= 0) return { ok: false, reason: 'bank-full', capacity: cap, bank: b };
  let amt = String(amount).toLowerCase() === 'all' ? Math.min(w, free) : Math.floor(Number(amount));
  if (!Number.isFinite(amt) || amt <= 0) return { ok: false, reason: 'invalid', balance: w };
  if (amt > w) return { ok: false, reason: 'insufficient', balance: w, needed: amt };
  if (amt > free) return { ok: false, reason: 'exceeds-capacity', capacity: cap, bank: b, maxDepositable: free };
  profile.wallet.copper = w - amt;
  profile.bank.copper = b + amt;
  profile.bank.active = true;
  logTx(profile, e, { vault: 'wallet', delta: -amt, source: 'deposit', reason: '→ Bank', now, actor });
  logTx(profile, e, { vault: 'bank', delta: amt, source: 'deposit', reason: '← Wallet', now, actor });
  try { engineEmit('BANK_DEPOSIT', evtBase(profile, { amount: amt, bank: bankBal(profile) })); } catch (err) {}
  return { ok: true, amount: amt, wallet: walletBal(profile), bank: bankBal(profile), capacity: cap };
}

/** Auszahlung Bank → Wallet. */
export function withdraw(profile, amount, { now = Date.now(), actor = '' } = {}) {
  const e = ensureEconomy(profile);
  if (!e) return { ok: false, reason: 'no-profile' };
  const w = walletBal(profile);
  const b = bankBal(profile);
  if (b <= 0) return { ok: false, reason: 'empty-bank', bank: b };
  let amt = String(amount).toLowerCase() === 'all' ? b : Math.floor(Number(amount));
  if (!Number.isFinite(amt) || amt <= 0) return { ok: false, reason: 'invalid', bank: b };
  if (amt > b) return { ok: false, reason: 'insufficient', bank: b, needed: amt };
  const cap = coinCap();
  if (w + amt > cap) return { ok: false, reason: 'overflow', balance: w, maxAddable: Math.max(0, cap - w) };
  profile.bank.copper = b - amt;
  profile.wallet.copper = w + amt;
  if (profile.bank.copper <= 0) profile.bank.active = false;
  logTx(profile, e, { vault: 'bank', delta: -amt, source: 'withdraw', reason: '→ Wallet', now, actor });
  logTx(profile, e, { vault: 'wallet', delta: amt, source: 'withdraw', reason: '← Bank', now, actor });
  try { engineEmit('BANK_WITHDRAW', evtBase(profile, { amount: amt, bank: bankBal(profile) })); } catch (err) {}
  return { ok: true, amount: amt, wallet: walletBal(profile), bank: bankBal(profile) };
}

/**
 * Tageszinsen aufs Bankguthaben — fließen ins WALLET (kein Kapazitäts-Paradox),
 * einmal pro Cooldown, gedeckelt.
 */
export function claimInterest(profile, { now = Date.now() } = {}) {
  const e = ensureEconomy(profile);
  if (!e) return { ok: false, reason: 'no-profile' };
  const r = economyRules();
  const cdMs = Math.max(1, ecoNum(r.interestCooldownH, 24)) * 3600000;
  const wait = cdMs - (now - e.interest.lastAt);
  if (e.interest.lastAt > 0 && wait > 0) {
    return { ok: false, reason: 'cooldown', waitMs: wait, nextAt: e.interest.lastAt + cdMs };
  }
  const b = bankBal(profile);
  if (b <= 0) return { ok: false, reason: 'empty-bank', bank: 0 };
  const pct = Math.max(0, ecoNum(r.interestPct, 1.0));
  const cap = Math.max(0, Math.floor(ecoNum(r.interestCap, 5000)));
  const amt = Math.min(cap, Math.floor(b * pct / 100));
  if (amt <= 0) return { ok: false, reason: 'too-small', bank: b };
  e.interest.lastAt = now;
  const res = addCoins(profile, amt, { source: 'interest', reason: pct + ' % auf ' + b.toLocaleString('de-DE') + ' Bank', now });
  if (!res.ok) return res;
  try { engineEmit('INTEREST', evtBase(profile, { amount: amt, bank: b })); } catch (err) {}
  try {
    notifyUser(profile?.identity?.bid || '', 'economy', {
      title: '📈 +' + amt.toLocaleString('de-DE') + ' Kupfer Zinsen',
      text: pct + ' % auf dein Bankguthaben',
      link: '/account.html'
    });
  } catch (err) {}
  return { ok: true, amount: amt, pct, bank: b, wallet: res.balance };
}

/**
 * 📅 Daily-Claim: deterministischer Basis-Betrag + Streak-Prozente (gedeckelt)
 * + Streak-Meilensteine (7/30/100/365) + Wochen-/Monats-/Jahres-Boni (je Periode einmal).
 * Gibt NUR Kupfer-Infos zurück — XP vergibt die Call-Site (grantXp).
 */
export function claimDaily(profile, { now = Date.now() } = {}) {
  const e = ensureEconomy(profile);
  if (!e) return { ok: false, reason: 'no-profile' };
  const r = economyRules();
  const today = dayKeyUTC(now);
  const d = e.daily;
  if (d.last === today) return { ok: false, reason: 'claimed', streak: d.streak, best: d.best };
  const yesterday = dayKeyUTC(now - 86400000);
  const continued = d.last === yesterday;
  d.streak = continued ? d.streak + 1 : 1;
  d.last = today;
  const isBest = d.streak > d.best;
  if (isBest) d.best = d.streak;
  const base = Math.max(0, Math.floor(ecoNum(r.dailyBase, 200)));
  const pct = Math.max(0, ecoNum(r.dailyStreakPct, 5));
  const pctCap = Math.max(0, ecoNum(r.dailyStreakCapPct, 100));
  const effPct = Math.min(pctCap, (d.streak - 1) * pct);
  let amount = Math.round(base * (1 + effPct / 100));
  const bonuses = [];
  /* 🏆 Streak-Meilensteine (einmalig beim Erreichen, aus Regeln) */
  const ms = r.dailyMilestones || { d7: 1000, d30: 5000, d100: 20000, d365: 100000 };
  const msHit = { 7: 'd7', 30: 'd30', 100: 'd100', 365: 'd365' }[d.streak];
  if (msHit && Number(ms[msHit]) > 0) {
    const mAmt = Math.floor(Number(ms[msHit]));
    amount += mAmt;
    bonuses.push({ kind: 'milestone', streak: d.streak, amount: mAmt });
  }
  /* 🗓️ Perioden-Boni: je Woche/Monat/Jahr einmal (Streak-Voraussetzung) */
  const wk = ecoWeekKey(now), mk = monthKeyUTC(now), yk = yearKeyUTC(now);
  if (d.streak >= 7 && d.lastWeekReward !== wk) {
    const wAmt = Math.max(0, Math.floor(ecoNum(r.weeklyBase, 1000)));
    if (wAmt > 0) { d.lastWeekReward = wk; amount += wAmt; bonuses.push({ kind: 'weekly', amount: wAmt }); }
  }
  if (d.streak >= 30 && d.lastMonthReward !== mk) {
    const mAmt = Math.max(0, Math.floor(ecoNum(r.monthlyBase, 5000)));
    if (mAmt > 0) { d.lastMonthReward = mk; amount += mAmt; bonuses.push({ kind: 'monthly', amount: mAmt }); }
  }
  if (d.streak >= 365 && d.lastYearReward !== yk) {
    const yAmt = Math.max(0, Math.floor(ecoNum(r.yearlyBase, 50000)));
    if (yAmt > 0) { d.lastYearReward = yk; amount += yAmt; bonuses.push({ kind: 'yearly', amount: yAmt }); }
  }
  if (isBest && d.streak > 1) {
    const bAmt = Math.max(0, Math.floor(ecoNum(r.dailyBestBonus, 500)));
    if (bAmt > 0) { amount += bAmt; bonuses.push({ kind: 'best', amount: bAmt }); }
  }
  const res = addCoins(profile, amount, { source: 'daily', reason: 'Tag ' + d.streak + ' (Serie)', now });
  if (!res.ok) return { ok: false, reason: res.reason || 'cap', streak: d.streak };
  d.history.unshift({ d: today, c: amount, s: d.streak });
  if (d.history.length > MAX_DAILY_HISTORY) d.history.length = MAX_DAILY_HISTORY;
  try { engineEmit('DAILY_CLAIM', evtBase(profile, { amount, streak: d.streak })); } catch (err) {}
  return {
    ok: true, amount, base, effPct, streak: d.streak, best: d.best,
    continued, isBest, bonuses, balance: res.balance
  };
}

/* ── 👑 Owner-Werkzeuge ─────────────────────────────────────────────── */

/** Setzt/absenkt Guthaben mit Audit-Spur (letzte Änderung rückholbar). */
export function adminAdjustCoins(profile, delta, { reason = '', actor = '', vault = 'wallet', now = Date.now() } = {}) {
  const e = ensureEconomy(profile);
  if (!e) return { ok: false, reason: 'no-profile' };
  const amt = Math.floor(Number(delta));
  if (!Number.isFinite(amt) || amt === 0) return { ok: false, reason: 'invalid' };
  const v = vault === 'bank' ? 'bank' : 'wallet';
  const before = v === 'bank' ? bankBal(profile) : walletBal(profile);
  const res = amt > 0
    ? addCoins(profile, amt, { vault: v, source: 'admin', reason: reason || 'Owner-Anpassung', now, actor })
    : removeCoins(profile, -amt, { vault: v, source: 'admin', reason: reason || 'Owner-Anpassung', now, actor });
  if (!res.ok) return res;
  const after = v === 'bank' ? bankBal(profile) : walletBal(profile);
  e.lastAdminAdjust = { delta: amt, vault: v, reason: String(reason || '').slice(0, 120), actor: String(actor || '').slice(0, 40), at: now, before, after };
  try { engineEmit('ADMIN_COINS', evtBase(profile, { delta: amt, vault: v, actor })); } catch (err) {}
  return { ok: true, delta: amt, vault: v, before, after, balance: after };
}

/** Macht die letzte Owner-Anpassung rückgängig (einmalig). */
export function coinRollback(profile) {
  const e = ensureEconomy(profile);
  if (!e || !e.lastAdminAdjust) return { ok: false, reason: 'nothing-to-rollback' };
  const adj = e.lastAdminAdjust;
  const v = adj.vault === 'bank' ? 'bank' : 'wallet';
  const cur = v === 'bank' ? bankBal(profile) : walletBal(profile);
  /* Ziel: exakt der Stand von vorher — gedeckelt auf Cap, nie negativ */
  const target = Math.max(0, Math.min(coinCap(), Math.floor(Number(adj.before) || 0)));
  const diff = target - cur;
  if (diff === 0) { e.lastAdminAdjust = null; return { ok: true, restored: target, delta: 0 }; }
  const res = diff > 0
    ? addCoins(profile, diff, { vault: v, source: 'admin', reason: 'Rollback', now: Date.now() })
    : removeCoins(profile, -diff, { vault: v, source: 'admin', reason: 'Rollback', now: Date.now() });
  if (!res.ok) return { ok: false, reason: res.reason || 'rollback-failed', balance: cur };
  e.lastAdminAdjust = null;
  try { engineEmit('ADMIN_COINS_ROLLBACK', evtBase(profile, { restored: target })); } catch (err) {}
  return { ok: true, restored: target, delta: diff };
}

/* ── 🔍 Integrität & Analyse ────────────────────────────────────────── */

/** Prüft + repariert Economy-Felder (gibt an, was gefixt wurde). */
export function validateEconomy(profile) {
  const fixed = [];
  const warnings = [];
  if (!profile || typeof profile !== 'object') return { ok: false, fixed, warnings: ['no-profile'] };
  /* Rohwerte VOR ensure() beurteilen (ensure normalisiert still — der Fund muss trotzdem gemeldet werden) */
  for (const v of ['wallet', 'bank']) {
    const raw = profile[v]?.copper;
    if (raw === undefined && (typeof profile[v] !== 'object' || profile[v] === null)) fixed.push(v + '.created');
    else if (!Number.isFinite(Number(raw)) || Number(raw) < 0 || !Number.isInteger(Number(raw))) fixed.push(v + '.copper');
  }
  const e = ensureEconomy(profile);
  for (const v of ['wallet', 'bank']) {
    if (Number(profile[v].copper) > coinCap()) warnings.push(v + '-over-cap');
  }
  if (!Array.isArray(e.tx)) { e.tx = []; fixed.push('tx'); }
  if (e.tx.length > MAX_TX) { e.tx.length = MAX_TX; fixed.push('tx-trim'); }
  for (const [i, t] of e.tx.entries()) {
    if (!t || !Number.isFinite(Number(t.d))) { e.tx.splice(i, 1); fixed.push('tx-row'); break; }
  }
  for (const k of ['earned', 'spent', 'highBal', 'highWallet', 'highBank']) {
    if (!Number.isFinite(Number(e.stats[k])) || Number(e.stats[k]) < 0) { e.stats[k] = 0; fixed.push('stats.' + k); }
  }
  return { ok: warnings.length === 0, fixed, warnings };
}

/** Bot-weite Economy-Kennzahlen aus echten Profilen (Owner-Center). */
export function economyAnalytics(users = {}) {
  const out = {
    users: 0, totalWallet: 0, totalBank: 0, generated: 0, spent: 0,
    topBalances: [], topSources: [], txSampled: 0
  };
  const src = {};
  for (const [bid, u] of Object.entries(users || {})) {
    if (!u || typeof u !== 'object') continue;
    out.users += 1;
    const w = Math.max(0, Math.floor(Number(u.wallet?.copper) || 0));
    const b = Math.max(0, Math.floor(Number(u.bank?.copper) || 0));
    out.totalWallet += w;
    out.totalBank += b;
    const st = u.economy?.stats || {};
    out.generated += Math.max(0, Number(st.earned) || 0);
    out.spent += Math.max(0, Number(st.spent) || 0);
    if (w + b > 0) {
      out.topBalances.push({ bid, name: u.registration?.name || '', total: w + b, wallet: w, bank: b });
    }
    for (const t of (u.economy?.tx || [])) {
      if (!t || Number(t.d) <= 0) continue;
      src[t.s || 'misc'] = (src[t.s || 'misc'] || 0) + Number(t.d);
      out.txSampled += 1;
    }
  }
  out.topBalances.sort((a, b2) => b2.total - a.total);
  out.topSources = Object.entries(src).map(([s, amt]) => ({ source: s, label: sourceLabel(s), amount: amt }))
    .sort((a, b2) => b2.amount - a.amount).slice(0, 8);
  out.net = out.generated - out.spent;
  return out;
}

/* ── 🪝 Interne Engine-Gutschriften (Level/Meilenstein/Ziele/Truhen) ──
   levelsystem.addWallet ruft diesen Hook — hier wird NUR geloggt
   (die Mutation ist dann schon passiert, kein Doppel-Credit). */
try {
  setCoinHook(({ profile, delta, source }) => {
    const e = ensureEconomy(profile);
    if (!e) return;
    const amt = Math.floor(Number(delta) || 0);
    if (!amt) return;
    logTx(profile, e, { vault: 'wallet', delta: amt, source: source || 'reward', reason: sourceLabel(source) });
  });
} catch (e) {}

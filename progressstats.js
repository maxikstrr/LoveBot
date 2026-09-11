/* ═══════════════════════════════════════════════════════════════════════
   💜  L O V E B O T   P R O G R E S S   S T A T S   v5.0  (progressstats.js)
   ─────────────────────────────────────────────────────────────────────
   Statistik- & Profilschicht der Progression (liest nur, schreibt nie):
   Aktivität, Trends, Ziele, Rekorde, nächste Ziele, Profil-Center-Text.
   Import-Richtung: progressstats → levelsystem + loveplus (kein Zyklus).
   Alles aus echten gespeicherten Daten — Fehlendes wird als „–“ gezeigt,
   niemals erfunden.
   ══════════════════════════════════════════════════════════════════════ */

import {
  ensureProgression, ensureStats, rankFor, titleFor, nextTitleFor, activeTitleFor, TITLES,
  availableTitles, SPECIAL_TITLES,
  BADGES, BADGE_AREAS, badgeProgress, xpPeriods, recentXp, MILESTONES, rewardsTable,
  xpRules, isoWeekKey, neededXp, prestigeProgress, weekXpSum,
  monthXpSum, yearXpSum, monthStatsSum, yearStatsSum, monthKey, xpMultiplierBreakdown
} from './levelsystem.js';
import { ensureEconomy, getBalance, capacityFor, sourceLabel, ecoWeekKey } from './economy.js';
import { achievementProgress, loadStore, achievementMetrics, ACHIEVEMENT_TIERS } from './loveplus.js';

/* ── Kleindruck-Helfer ─────────────────────────────────────────────── */
const de = (n) => Number(n || 0).toLocaleString('de-DE');
const bar = (pct, len = 10) => {
  const p = Math.max(0, Math.min(100, Number(pct) || 0));
  const f = Math.round((p / 100) * len);
  return '█'.repeat(f) + '░'.repeat(Math.max(0, len - f));
};
const missing = (v, fmt) => {
  if (v === null || v === undefined || v === '' || (typeof v === 'number' && !Number.isFinite(v))) return '–';
  return fmt ? fmt(v) : String(v);
};
export function relTime(ts, now = Date.now()) {
  const t = Number(ts) || 0;
  if (!t) return '–';
  const diff = now - t;
  if (diff < 0) return '–';
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'gerade eben';
  if (min < 60) return `vor ${min} Min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `vor ${h} Std`;
  const d = Math.floor(h / 24);
  if (d < 7) return `vor ${d} Tag${d === 1 ? '' : 'en'}`;
  return new Date(t).toLocaleDateString('de-DE');
}
const fmtDate = (iso) => {
  if (!iso) return '–';
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? new Date(t).toLocaleDateString('de-DE') : '–';
};

/* ── Aktivität ─────────────────────────────────────────────────────── */
/** Aktive Tage/Wochen/Monate + letzte Aktivität (aus xpDaily/lastXpAt). */
export function activityStats(profile, now = Date.now()) {
  const p = ensureProgression(profile) || {};
  const days = (p.xpDaily || []).map((e) => e.d).filter(Boolean);
  const weeks = new Set(days.map((d) => isoWeekKey(new Date(d + 'T00:00:00Z').getTime())));
  const months = new Set(days.map((d) => String(d).slice(0, 7)));
  return {
    activeDays: days.length,
    activeWeeks: weeks.size,
    activeMonths: months.size,
    lastActive: Number(p.lastXpAt) || 0,
    lastActiveRel: relTime(p.lastXpAt, now)
  };
}

/** Summen aus statsDaily für einen Zeitraum (Tage zurück, 0 = nur heute). */
function statsDailySum(profile, daysBack, now = Date.now()) {
  const p = profile?.progression || {};
  const start = new Date(new Date(now).toISOString().slice(0, 10) + 'T00:00:00Z').getTime();
  const out = { m: 0, c: 0, g: 0, w: 0 };
  for (const e of (p.statsDaily || [])) {
    if (!e || !e.d) continue;
    const age = Math.round((start - new Date(e.d + 'T00:00:00Z').getTime()) / 86400000);
    if (!Number.isFinite(age) || age < 0 || age > daysBack) continue;
    out.m += Number(e.m) || 0; out.c += Number(e.c) || 0;
    out.g += Number(e.g) || 0; out.w += Number(e.w) || 0;
  }
  return out;
}

/* ── Trends ────────────────────────────────────────────────────────── */
/** Vergleiche heute↔gestern, Kalenderwoche↔Vorwoche, Monat↔Vormonat (echte xpDaily). */
export function xpTrends(profile, now = Date.now()) {
  const p = profile?.progression || {};
  const byDay = {};
  for (const e of (p.xpDaily || [])) if (e && e.d) byDay[e.d] = (byDay[e.d] || 0) + (Number(e.a) || 0);
  const dk = (ts) => new Date(ts).toISOString().slice(0, 10);
  const today = dk(now), yest = dk(now - 86400000);
  const wk = isoWeekKey(now), prevWk = isoWeekKey(now - 7 * 86400000);
  const mo = today.slice(0, 7);
  const prevMoD = new Date(new Date(today + 'T00:00:00Z').getTime());
  prevMoD.setUTCMonth(prevMoD.getUTCMonth() - 1);
  const prevMo = prevMoD.toISOString().slice(0, 7);
  let curW = 0, prvW = 0, curM = 0, prvM = 0;
  for (const [d, a] of Object.entries(byDay)) {
    const t = new Date(d + 'T00:00:00Z').getTime();
    if (!Number.isFinite(t)) continue;
    if (isoWeekKey(t) === wk) curW += a;
    if (isoWeekKey(t) === prevWk) prvW += a;
    if (d.slice(0, 7) === mo) curM += a;
    if (d.slice(0, 7) === prevMo) prvM += a;
  }
  const cmp = (cur, prev, prevExists) => {
    if (!prevExists) return { cur, prev: 0, pct: null };
    if (prev <= 0) return { cur, prev, pct: cur > 0 ? 100 : 0 };
    return { cur, prev, pct: Math.round(((cur - prev) / prev) * 100) };
  };
  return {
    day: cmp(byDay[today] || 0, byDay[yest] || 0, yest in byDay),
    week: cmp(curW, prvW, Object.keys(byDay).some((d) => isoWeekKey(new Date(d + 'T00:00:00Z').getTime()) === prevWk)),
    month: cmp(curM, prvM, Object.keys(byDay).some((d) => d.slice(0, 7) === prevMo))
  };
}
export function trendArrow(pct) {
  if (pct === null || pct === undefined) return '➖';
  if (pct > 0) return '📈';
  if (pct < 0) return '📉';
  return '➖';
}
export function trendText(t) {
  if (!t || t.pct === null) return '➖ _Noch keine Vergleichsdaten_';
  const sign = t.pct > 0 ? '+' : '';
  return `${trendArrow(t.pct)} ${sign}${t.pct}% _(${de(t.prev)} → ${de(t.cur)})_`;
}

/* ── Ziele ─────────────────────────────────────────────────────────── */
export function goalProgress(profile, now = Date.now()) {
  const p = ensureProgression(profile) || {};
  const g = xpRules().goals || {};
  const per = xpPeriods(profile, now);
  const dayKey = new Date(now).toISOString().slice(0, 10);
  const wk = isoWeekKey(now);
  let weekSum = 0;
  for (const e of (p.xpDaily || [])) {
    if (e && e.d && isoWeekKey(new Date(e.d + 'T00:00:00Z').getTime()) === wk) weekSum += Number(e.a) || 0;
  }
  const todayStats = (p.statsDaily || []).find((e) => e && e.d === dayKey) || {};
  let weekM = 0, weekG = 0;
  for (const e of (p.statsDaily || [])) {
    if (!e || !e.d) continue;
    if (isoWeekKey(new Date(e.d + 'T00:00:00Z').getTime()) === wk) { weekM += Number(e.m) || 0; weekG += Number(e.g) || 0; }
  }
  const mk = (have, target, key, reward) => ({
    have, target, reward: Number(reward) || 0,
    done: target > 0 && !!(p.unlocks || {})[key],
    pct: target > 0 ? Math.min(100, Math.round((have / target) * 100)) : 0
  });
  const minor = Number(xpRules().rewards?.goalMinorCopper ?? 25) || 0;
  const gs = p.goalStreak || {};
  return {
    enabled: g.enabled !== false,
    streak: { current: Number(gs.c) || 0, best: Number(gs.best) || 0 },
    daily: mk(per.today, Number(g.dailyXp) || 0, 'goal-d' + dayKey, g.dailyCopper),
    weekly: mk(weekSum, Number(g.weeklyXp) || 0, 'goal-w' + wk, g.weeklyCopper),
    dailyMessages: mk(Number(todayStats.m) || 0, Number(g.dailyMessages) || 0, 'goal-dm' + dayKey, minor),
    dailyCommands: mk(Number(todayStats.c) || 0, Number(g.dailyCommands) || 0, 'goal-dc' + dayKey, minor),
    weeklyMessages: mk(weekM, Number(g.weeklyMessages) || 0, 'goal-wm' + wk, minor),
    weeklyGames: mk(weekG, Number(g.weeklyGames) || 0, 'goal-wg' + wk, minor)
  };
}

/* ── Nächste Ziele ─────────────────────────────────────────────────── */
/** Kandidaten + sinnvollstes (= knappstes) Ziel. (5.0: +Meilenstein/Prestige/Truhe) */
export function nextTargets(profile, now = Date.now(), { achCount = 0 } = {}) {
  const p = ensureProgression(profile) || {};
  const bid = profile?.identity?.bid || '';
  const lvl = Number(p.level) || 0;
  const need = neededXp(lvl, Number(p.prestige) || 0);
  const xp = Number(p.xp) || 0;
  const cands = [];
  cands.push({
    id: 'level', emoji: '⭐', label: `Level ${de(lvl + 1)}`,
    detail: `Noch ${de(Math.max(0, need - xp))} XP`,
    pct: need > 0 ? Math.min(99, Math.round((xp / need) * 100)) : 0
  });
  const nt = nextTitleFor(lvl);
  if (nt) cands.push({
    id: 'title', emoji: '📛', label: `Titel ${nt.emoji} ${nt.name}`,
    detail: `Noch ${de(nt.min - lvl)} Level (ab Level ${nt.min})`,
    pct: Math.min(99, Math.round((lvl / nt.min) * 100))
  });
  const streak = Math.max(Number(p.streak) || 0, Number(p.streaks?.daily?.c) || 0);
  const nextMark = [7, 30, 100, 365].find((m) => m > streak);
  if (nextMark) cands.push({
    id: 'streak', emoji: '🔥', label: `${nextMark}-Tage-Streak`,
    detail: `Noch ${de(nextMark - streak)} Tag${nextMark - streak === 1 ? '' : 'e'}`,
    pct: Math.min(99, Math.round((streak / nextMark) * 100))
  });
  try {
    const ap = achievementProgress(bid, profile);
    const nx = (ap.next || [])[0];
    if (nx) cands.push({
      id: 'achievement', emoji: '🏆', label: nx.name,
      detail: `${de(nx.have)}/${de(nx.need)} — noch ${de(nx.need - nx.have)}`,
      pct: Math.min(99, Math.round((nx.have / nx.need) * 100))
    });
  } catch (e) {}
  const msNext = MILESTONES.find((m) => m.level > lvl && (Number(p.prestige) || 0) === 0);
  if (msNext) cands.push({
    id: 'milestone', emoji: '🎁', label: `Meilenstein Lv ${msNext.level} — ${msNext.label}`,
    detail: `Noch ${de(msNext.level - lvl)} Level (+${de(msNext.coins)} Kupfer)`,
    pct: Math.min(99, Math.round((lvl / msNext.level) * 100))
  });
  if (!msNext && (Number(p.prestige) || 0) === 0) {
    try {
      const pp = prestigeProgress(profile);
      if (pp && !pp.maxed) cands.push({
        id: 'prestige', emoji: '👑', label: `Prestige ${pp.nextPrestige} — ${pp.nextPrestigeTitle}`,
        detail: `Noch ${de(pp.levelsToPrestige)} Level · ${de(pp.xpRemaining)} XP`,
        pct: 99
      });
    } catch (e) {}
  }
  const pend = (p.pendingRewards || [])[0];
  if (pend) cands.push({
    id: 'chest', emoji: '🎁', label: `${pend.label} abholen`,
    detail: `+${de(pend.copper)} Kupfer warten — $reward claim`,
    pct: 100
  });
  try {
    const bp = badgeProgress(profile, achCount).filter((b) => !b.unlocked && b.need > 0)
      .sort((a, b) => (b.have / b.need) - (a.have / a.need))[0];
    if (bp) cands.push({
      id: 'badge', emoji: '🏅', label: `Badge ${bp.emoji} ${bp.name}`,
      detail: `${de(bp.have)}/${de(bp.need)} — ${bp.desc}`,
      pct: Math.min(99, Math.round((bp.have / bp.need) * 100))
    });
  } catch (e) {}
  const goals = goalProgress(profile, now);
  if (goals.enabled && goals.daily.target > 0 && !goals.daily.done) cands.push({
    id: 'dailygoal', emoji: '🎯', label: 'Tagesziel',
    detail: `${de(goals.daily.have)}/${de(goals.daily.target)} XP (+${de(goals.daily.reward)} Kupfer)`,
    pct: goals.daily.pct
  });
  if (goals.enabled && goals.weekly.target > 0 && !goals.weekly.done) cands.push({
    id: 'weeklygoal', emoji: '🏆', label: 'Wochenziel',
    detail: `${de(goals.weekly.have)}/${de(goals.weekly.target)} XP (+${de(goals.weekly.reward)} Kupfer)`,
    pct: goals.weekly.pct
  });
  cands.sort((a, b) => b.pct - a.pct);
  return { top: cands[0] || null, all: cands.slice(0, 5) };
}

/* ── Insights (5.0): persönliche Hinweise aus echten Daten ────────── */
export function buildInsights(profile, { rankDelta = null, now = Date.now() } = {}) {
  const p = ensureProgression(profile) || {};
  const st = ensureStats(profile) || {};
  const lines = [];
  const lvl = Number(p.level) || 0;
  const need = neededXp(lvl, Number(p.prestige) || 0);
  const xp = Number(p.xp) || 0;
  const per = xpPeriods(profile, now);
  const soc = socialCounters(profile);
  /* 💡 Nächstes Level greifbar? */
  if (need > 0 && (need - xp) > 0 && (need - xp) <= Math.max(50, per.today)) {
    lines.push(`💡 Nur noch *${de(need - xp)} XP* bis Level ${de(lvl + 1)} — heute schon ${de(per.today)} gesammelt!`);
  }
  /* 🎁 Ungeöffnete Truhe? */
  if ((p.pendingRewards || []).length) {
    lines.push(`🎁 *${(p.pendingRewards || []).length} Truhe(n)* warten auf dich — $reward claim`);
  }
  /* 🔥 Streak in Gefahr / Rekord nah? */
  const streak = Math.max(Number(p.streak) || 0, Number(p.streaks?.daily?.c) || 0);
  const lastXp = Number(p.lastXpAt) || 0;
  const todayK = new Date(now).toISOString().slice(0, 10);
  const lastK = lastXp ? new Date(lastXp).toISOString().slice(0, 10) : '';
  if (streak >= 3 && lastK !== todayK) {
    lines.push(`🔥 Dein *${de(streak)}-Tage-Streak* braucht heute noch XP — sonst reißt er!`);
  }
  /* 🏆 Fast geschafft? */
  try {
    const ap = achievementProgress(profile?.identity?.bid || '', profile);
    const nx = (ap.next || [])[0];
    if (nx && nx.need > 0 && nx.have / nx.need >= 0.8) {
      lines.push(`🏆 Fast da: *${nx.name}* (${de(nx.have)}/${de(nx.need)})`);
    }
  } catch (e) {}
  /* 🎯 Tagesziel fast voll? */
  const goals = goalProgress(profile, now);
  if (goals.enabled && goals.daily.target > 0 && !goals.daily.done && goals.daily.pct >= 70) {
    lines.push(`🎯 Tagesziel zu *${goals.daily.pct}%* voll — noch ${de(goals.daily.target - goals.daily.have)} XP!`);
  }
  /* 📈 Rang verbessert? */
  if (rankDelta !== null && rankDelta !== undefined && Number.isFinite(Number(rankDelta)) && Number(rankDelta) !== 0) {
    lines.push(Number(rankDelta) > 0
      ? `📈 Du bist *${de(rankDelta)} Plätze* aufgestiegen — stark!`
      : `📉 Du bist *${de(-rankDelta)} Plätze* gefallen — hol sie dir zurück!`);
  }
  /* 💬 Lange nichts geschrieben? */
  if ((Number(st.messages) || 0) === 0 && (Number(p.totalXp) || 0) > 0) {
    lines.push('💬 Tipp: Jede nette Nachricht gibt XP — chatte los!');
  }
  void soc;
  return lines.slice(0, 3);
}

/* ── Social-Zähler aus dem loveplus-Store ──────────────────────────── */
export function socialCounters(profile) {
  try {
    const bid = profile?.identity?.bid || '';
    const store = loadStore();
    const mx = achievementMetrics(profile, store, bid);
    const u = store.users?.[bid] || {};
    return {
      giftsSent: mx.giftsSent, giftsReceived: mx.giftsReceived,
      lettersSent: mx.lettersSent, loginStreak: mx.loginStreak,
      hasPet: !!u.pet, achievements: Object.keys(u.achievements || {}).length
    };
  } catch (e) {
    return { giftsSent: 0, giftsReceived: 0, lettersSent: 0, loginStreak: 0, hasPet: false, achievements: 0 };
  }
}

/* ═══ PROFIL-CENTER ($me) ═══ */
export function buildProfileCenter(profile, { name = 'Du', rankPos = null, rankTotal = 0, rankPrev = null, roleText = '', pref = '$', now = Date.now(), skipUser = false } = {}) {
  const p = ensureProgression(profile) || {};
  const st = ensureStats(profile) || {};
  const reg = profile?.registration || {};
  const rk = rankFor(Number(p.prestige) || 0, Number(p.level) || 0);
  const tt = activeTitleFor(profile);
  const per = xpPeriods(profile, now);
  const act = activityStats(profile, now);
  const lvl = Number(p.level) || 0;
  const need = neededXp(lvl, Number(p.prestige) || 0);
  const pct = need > 0 ? Math.min(100, Math.round(((Number(p.xp) || 0) / need) * 100)) : 100;
  const nt = nextTitleFor(lvl);
  const soc = socialCounters(profile);
  const goals = goalProgress(profile, now);
  const trends = xpTrends(profile, now);
  const targets = nextTargets(profile, now);
  const badgeCount = Object.keys(p.badges || {}).length;
  const titleCount = TITLES.filter((t) => t.min <= lvl).length;
  const hist = recentXp(profile, 5);
  const memberDays = reg.registeredAt ? Math.max(0, Math.floor((now - new Date(reg.registeredAt).getTime()) / 86400000)) : null;
  const wins = Number(st.gameWins) || 0, games = Number(st.games) || 0;
  const winrate = games > 0 ? Math.round((wins / games) * 100) : null;
  const L = [];
  L.push(skipUser ? '╭──── 💜 *PROGRESSION CENTER* ────╮' : '╭────── 💜 *LOVE PROFILE* ──────╮', '');
  if (!skipUser) {
  L.push('👤 *USER*');
  L.push(`Name: *${name}*`);
  L.push(`Account: ${reg.registered === true ? 'Registriert ✅' : 'Gast — noch nicht registriert'}`);
  if (reg.registeredAt) L.push(`Mitglied seit: ${fmtDate(reg.registeredAt)}${memberDays !== null ? ` (${de(memberDays)} Tage)` : ''}`);
  if (roleText) L.push(`Rolle: ${String(roleText).replace(/\n• \*Gruppe:\* /, '')}`);
  L.push(`Letzte Aktivität: ${act.lastActiveRel}`, '');
  }
  L.push('🏆 *PROGRESSION*');
  L.push(`${rk.full}`);
  if (Number(p.prestige) > 0) L.push(`Prestige: *${de(p.prestige)}*`);
  try {
    const pp = prestigeProgress(profile);
    if (pp && !pp.maxed) L.push(`Nächstes Prestige: *${pp.levelsToPrestige}* Level · *${de(pp.xpRemaining)}* XP fehlen`);
    else if (pp && pp.maxed) L.push('👑 *Maximales Prestige erreicht!*');
  } catch (e) {}
  if ((p.pendingRewards || []).length) L.push(`🎁 Truhen bereit: *${(p.pendingRewards || []).length}* — $reward claim`);
  L.push(`Level: *${de(lvl)}* · Titel: ${tt.emoji} *${tt.name}*`);
  L.push(`XP: *${de(p.xp)}* / ${de(need)} · Lifetime: *${de(per.lifetime)}*`);
  L.push(`\`${bar(pct, 14)}\` ${pct}%`);
  L.push(`Noch ${de(Math.max(0, need - (Number(p.xp) || 0)))} XP bis Level ${de(lvl + 1)}`);
  if (nt) L.push(`Nächster Titel: ${nt.emoji} *${nt.name}* (ab Level ${nt.min})`);
  L.push('');
  L.push('🌍 *GLOBAL RANK*');
  if (rankPos) {
    let trend = '';
    if (rankPrev && rankPrev !== rankPos) {
      const d = rankPrev - rankPos;
      trend = d > 0 ? ` 📈 (+${de(d)})` : ` 📉 (${de(d)})`;
    }
    L.push(`*#${de(rankPos)}* von ${de(rankTotal)}${trend}`);
  } else L.push('Noch unplatziert — chatte los! 💜');
  L.push('');
  L.push('🔥 *STREAK*');
  L.push(`Aktuell: *${de(Math.max(Number(p.streak) || 0, Number(p.streaks?.daily?.c) || 0))}* Tage · Rekord: *${de(p.bestStreak)}* Tage`, '');
  L.push('💬 *ACTIVITY*');
  L.push(`Nachrichten: *${de(st.messages)}* · Befehle: *${de(st.commands)}*`);
  L.push(`Aktive Tage: *${de(act.activeDays)}* · Wochen: *${de(act.activeWeeks)}* · Monate: *${de(act.activeMonths)}*`, '');
  L.push('🎮 *GAMES*');
  L.push(`Spiele: *${de(games)}* · Siege: *${de(wins)}* · Niederlagen: *${de(st.gameLosses)}*`);
  L.push(`Winrate: ${winrate === null ? '–' : `*${winrate}%*`} · Best Score: –`, '');
  L.push('💜 *SOCIAL*');
  L.push(`Komplimente: *${de(st.complimentsGiven)}* · Love-Aktionen: *${de(st.loveActions)}*`);
  L.push(`Geschenke: *${de(soc.giftsSent)}* gesendet · *${de(soc.giftsReceived)}* erhalten · Briefe: *${de(soc.lettersSent)}*`, '');
  L.push('🏅 *SAMMLUNG*');
  try {
    const ap = achievementProgress(profile?.identity?.bid || '', profile);
    L.push(`Achievements: *${de(ap.count)} / ${de(ap.total)}*`);
    const tOrd = ['bronze', 'silver', 'gold', 'diamond', 'mythic'];
    const tEmo = { bronze: '🥉', silver: '🥈', gold: '🥇', diamond: '💎', mythic: '👑' };
    L.push(tOrd.map((t) => `${tEmo[t]}${ap.byTier?.[t]?.got || 0}`).join(' '));
  } catch (e) { L.push('Achievements: –'); }
  let titleTotal = titleCount;
  try { titleTotal = availableTitles(profile, socialCounters(profile).achievements).length; } catch (e) {}
  L.push(`Badges: *${de(badgeCount)}* · Titel: *${de(titleTotal)}* freigeschaltet`, '');
  L.push('📈 *XP PERIOD*');
  L.push(`Heute: *+${de(per.today)}* · Woche: *+${de(per.week)}* · Monat: *+${de(per.month)}*`);
  L.push(`Trend Tag: ${trendText(trends.day)}`);
  L.push(`Trend Woche: ${trendText(trends.week)}`, '');
  if (goals.enabled && (goals.daily.target > 0 || goals.weekly.target > 0)) {
    L.push('🎯 *GOALS*');
    if (goals.daily.target > 0) L.push(`Täglich: \`${bar(goals.daily.pct)}\` ${de(goals.daily.have)}/${de(goals.daily.target)}${goals.daily.done ? ' ✅' : ''}`);
    if (goals.weekly.target > 0) L.push(`Wöchentlich: \`${bar(goals.weekly.pct)}\` ${de(goals.weekly.have)}/${de(goals.weekly.target)}${goals.weekly.done ? ' ✅' : ''}`);
    if (goals.dailyMessages.target > 0) L.push(`💬 Nachrichten/Tag: ${de(goals.dailyMessages.have)}/${de(goals.dailyMessages.target)}${goals.dailyMessages.done ? ' ✅' : ''}`);
    if (goals.dailyCommands.target > 0) L.push(`⌨️ Befehle/Tag: ${de(goals.dailyCommands.have)}/${de(goals.dailyCommands.target)}${goals.dailyCommands.done ? ' ✅' : ''}`);
    if (goals.weeklyMessages.target > 0) L.push(`💬 Nachrichten/Woche: ${de(goals.weeklyMessages.have)}/${de(goals.weeklyMessages.target)}${goals.weeklyMessages.done ? ' ✅' : ''}`);
    if (goals.weeklyGames.target > 0) L.push(`🎮 Spiele/Woche: ${de(goals.weeklyGames.have)}/${de(goals.weeklyGames.target)}${goals.weeklyGames.done ? ' ✅' : ''}`);
    if ((goals.streak.current || 0) > 0 || (goals.streak.best || 0) > 0) L.push(`🔥 Ziel-Streak: *${de(goals.streak.current)}* Tage (Best *${de(goals.streak.best)}*)`);
    L.push('');
  }
  L.push('📊 *RECORDS*');
  const rc = p.records || {};
  L.push(`Höchstes Level: *${de(rc.highestLevel || lvl)}* · Längste Streak: *${de(p.bestStreak)}* Tage`);
  L.push(`Bester Tag: *+${de(rc.highestDailyXp)}* XP · Meiste XP auf einmal: *+${de(rc.mostXpOneAction)}*`);
  let mostMsg = 0;
  for (const e of (p.statsDaily || [])) mostMsg = Math.max(mostMsg, Number(e.m) || 0);
  L.push(`Meiste Nachrichten/Tag: *${de(mostMsg)}*`, '');
  if (targets.top) {
    L.push('🎯 *NEXT MILESTONE*');
    L.push(`${targets.top.emoji} *${targets.top.label}* — ${targets.top.detail}`);
    L.push('');
  }
  if (hist.length) {
    L.push('📜 *LETZTE XP*');
    for (const h of hist) L.push(`+${de(h.amount)}  ${h.label}`);
    L.push('');
  }
  const insights = buildInsights(profile, { rankDelta: (rankPos && rankPrev) ? rankPrev - rankPos : null, now });
  if (insights.length) {
    L.push('💡 *INSIGHTS*');
    for (const line of insights) L.push(line);
    L.push('');
  }
  L.push(`💡 _${pref}progress · ${pref}stats me · ${pref}records · ${pref}activity_`);
  L.push('╰────────────────────────────╯');
  return L.join('\n');
}

/* ═══ Einzel-Bereiche für Commands ═══ */
export function buildPersonalStats(profile, now = Date.now()) {
  const st = ensureStats(profile) || {};
  const p = ensureProgression(profile) || {};
  const soc = socialCounters(profile);
  const games = Number(st.games) || 0, wins = Number(st.gameWins) || 0;
  const L = ['> 📊 *LOVE BOT STATS*', '',
    `💬 Nachrichten: *${de(st.messages)}*`,
    `⚙️ Befehle: *${de(st.commands)}*`,
    `🎮 Spiele: *${de(games)}* · 🏆 Siege: *${de(wins)}* · 💔 Niederlagen: *${de(st.gameLosses)}*`,
    `🌹 Komplimente verteilt: *${de(st.complimentsGiven)}*`,
    `💜 Love-Aktionen: *${de(st.loveActions)}*`,
    `🎁 Geschenke: *${de(soc.giftsSent)}* gesendet · *${de(soc.giftsReceived)}* erhalten`,
    `💌 Liebesbriefe: *${de(soc.lettersSent)}*`,
    `📅 Daily-Claims: *${de(st.dailiesClaimed)}* · 💼 Work-Claims: *${de(st.workClaimed)}* · 🌹 Dailylove: *${de(st.dailyloveClaimed)}*`,
    `🏆 Achievements: *${de(soc.achievements)}* · 🏅 Badges: *${de(Object.keys(p.badges || {}).length)}*`,
    `🔥 Streak: *${de(p.streak)}* Tage (Best *${de(p.bestStreak)}*)`,
    `Σ Lifetime XP: *${de(p.totalXp)}*`];
  return L.join('\n');
}

export function buildActivity(profile, now = Date.now()) {
  const p = ensureProgression(profile) || {};
  const per = xpPeriods(profile, now);
  const act = activityStats(profile, now);
  const t = statsDailySum(profile, 0, now);
  const w = statsDailySum(profile, 6, now);
  const m = statsDailySum(profile, 29, now);
  const trends = xpTrends(profile, now);
  const L = ['> 📅 *ACTIVITY*', '',
    `*Heute:* +${de(per.today)} XP · ${de(t.m)}💬 ${de(t.c)}⚙️ ${de(t.g)}🎮`,
    `*7 Tage:* +${de(per.week)} XP · ${de(w.m)}💬 ${de(w.c)}⚙️ ${de(w.g)}🎮 (${de(w.w)}🏆)`,
    `*30 Tage:* +${de(per.month)} XP · ${de(m.m)}💬 ${de(m.c)}⚙️ ${de(m.g)}🎮 (${de(m.w)}🏆)`,
    `*All Time:* Σ ${de(per.lifetime)} XP`, '',
    `Aktive Tage: *${de(act.activeDays)}* · Wochen: *${de(act.activeWeeks)}* · Monate: *${de(act.activeMonths)}*`,
    `Letzte Aktivität: ${act.lastActiveRel}`, '',
    `Trend Tag: ${trendText(trends.day)}`,
    `Trend Woche: ${trendText(trends.week)}`,
    `Trend Monat: ${trendText(trends.month)}`, ''];
  /* 🗓️ Heatmap: XP pro Wochentag (letzte 28 Tage, echte xpDaily) */
  const wdNames = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  const wdXp = [0, 0, 0, 0, 0, 0, 0];
  const start = new Date(new Date(now).toISOString().slice(0, 10) + 'T00:00:00Z').getTime();
  for (const e of (p.xpDaily || [])) {
    if (!e || !e.d) continue;
    const tE = new Date(e.d + 'T00:00:00Z').getTime();
    if (!Number.isFinite(tE)) continue;
    const age = Math.round((start - tE) / 86400000);
    if (age < 0 || age > 27) continue;
    wdXp[(new Date(tE).getUTCDay() + 6) % 7] += Number(e.a) || 0;
  }
  const wdMax = Math.max(...wdXp, 1);
  L.push('🗓️ *HEATMAP (28 Tage)*');
  if (wdXp.every((v) => v === 0)) L.push('_Noch keine Daten — sammle XP! 💜_');
  else for (let i = 0; i < 7; i++) L.push(`${wdNames[i]} \`${bar(Math.round((wdXp[i] / wdMax) * 100), 8)}\` +${de(wdXp[i])} XP`);
  L.push('');
  /* 🕒 Echte Zeit-Stats (ab 5.0 gezählt — vorher „–“) */
  const hours = Array.isArray(p.hourActivity) ? p.hourActivity : [];
  const hourTotal = hours.reduce((a, h) => a + (Number(h) || 0), 0);
  if (!hourTotal) {
    L.push('🕒 *AKTIVSTE ZEIT:* – _(wird ab jetzt gezählt)_');
  } else {
    let bestH = 0;
    for (let i = 1; i < 24; i++) if ((Number(hours[i]) || 0) > (Number(hours[bestH]) || 0)) bestH = i;
    const fmtH = (h) => String(h).padStart(2, '0') + ':00';
    L.push(`🕒 *AKTIVSTE ZEIT:* ${fmtH(bestH)}–${fmtH((bestH + 1) % 24)} Uhr (${de(hours[bestH])} Aktionen)`);
    const wdAct = Array.isArray(p.weekdayActivity) ? p.weekdayActivity : [0, 0, 0, 0, 0, 0, 0];
    let bestD = 0;
    for (let i = 1; i < 7; i++) if ((Number(wdAct[i]) || 0) > (Number(wdAct[bestD]) || 0)) bestD = i;
    const wdLong = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
    L.push(`📆 *AKTIVSTER TAG:* ${wdLong[bestD]} (${de(wdAct[bestD])} Aktionen)`);
  }
  return L.join('\n');
}

export function buildRecords(profile) {
  const p = ensureProgression(profile) || {};
  const rc = p.records || {};
  let mostMsg = 0, mostGames = 0;
  for (const e of (p.statsDaily || [])) {
    mostMsg = Math.max(mostMsg, Number(e.m) || 0);
    mostGames = Math.max(mostGames, Number(e.g) || 0);
  }
  const L = ['> 🏆 *PERSONAL RECORDS*', '',
    `⭐ Höchstes Level: *${de(rc.highestLevel || p.level)}*`,
    `✨ Meiste Lifetime XP: *${de(p.totalXp)}*`,
    `📅 Höchste Tages-XP: *+${de(rc.highestDailyXp)}*`,
    `🔥 Längste Streak: *${de(p.bestStreak)}* Tage`,
    `💬 Meiste Nachrichten/Tag: *${de(mostMsg)}*`,
    `🎮 Meiste Spiele/Tag: *${de(mostGames)}* · 🏆 Siege gesamt: *${de(profile?.stats?.gameWins)}*`,
    `💥 Meiste XP auf einmal: *+${de(rc.mostXpOneAction)}*`,
    '🎯 Bester Game-Score: – _(Spiele sind Sieg/Niederlage)_'];
  return L.join('\n');
}

export function buildMilestones(profile) {
  const p = ensureProgression(profile) || {};
  const lvl = Number(p.level) || 0;
  const un = p.unlocks || {};
  const L = ['> 🎯 *MILESTONES*', '', '*Level*'];
  for (const mst of MILESTONES) {
    const got = !!un['lv' + mst.level] || lvl >= mst.level || Number(p.prestige) > 0;
    L.push(`${got ? '✅' : '🔒'} Level ${mst.level} — ${mst.label}${got && Number(mst.coins) > 0 ? ` (+${de(mst.coins)} Kupfer)` : ''}`);
  }
  L.push('', '*Lifetime-XP*');
  for (const [mark, label] of [[1000, '1.000'], [10000, '10.000'], [100000, '100.000'], [1000000, '1.000.000']]) {
    L.push(`${(Number(p.totalXp) || 0) >= mark ? '✅' : '🔒'} ${label} XP _(jetzt ${de(p.totalXp)})_`);
  }
  L.push('', '*Streak (Rekord)*');
  for (const mark of [7, 30, 100, 365]) {
    L.push(`${(Number(p.bestStreak) || 0) >= mark ? '✅' : '🔒'} ${mark} Tage _(Best ${de(p.bestStreak)})_`);
  }
  L.push('', '*Prestige*');
  for (const mark of [1, 2, 3, 5]) {
    L.push(`${(Number(p.prestige) || 0) >= mark ? '✅' : '🔒'} Prestige ${mark} _(jetzt ${de(p.prestige)})_`);
  }
  L.push('', '*Ziel-Streak (Best)*');
  const gsBest = Number(p.goalStreak?.best) || 0;
  for (const mark of [3, 7, 30]) {
    L.push(`${gsBest >= mark ? '✅' : '🔒'} ${mark} Tage _(Best ${de(gsBest)})_`);
  }
  return L.join('\n');
}

export function buildRewards(profile) {
  const p = ensureProgression(profile) || {};
  const rt = rewardsTable(Number(p.prestige) || 0, Number(p.level) || 0);
  const un = p.unlocks || {};
  const goalD = Object.keys(un).filter((k) => k.startsWith('goal-d')).length;
  const goalW = Object.keys(un).filter((k) => k.startsWith('goal-w')).length;
  const L = ['> 🎁 *REWARDS*', '', '*Erhalten*'];
  const earned = rt.filter((m) => m.unlocked);
  if (!earned.length && !goalD && !goalW) L.push('_Noch keine — Level ups bringen Kupfer! 💜_');
  for (const m of earned) L.push(`✅ Level ${m.level} — ${m.label} (+${de(m.coins)} Kupfer)`);
  if (goalD) L.push(`✅ Tagesziele: *${de(goalD)}×* geschafft`);
  if (goalW) L.push(`✅ Wochenziele: *${de(goalW)}×* geschafft`);
  L.push(`💰 Reward-Kupfer gesamt: *${de(p.rewardsClaimed?.copper)}*`);
  const pend = p.pendingRewards || [];
  if (pend.length) {
    L.push('', '*Abholbereit* 🎁');
    for (const r of pend) L.push(`🎁 ${r.label} — +${de(r.copper)} Kupfer`);
    L.push('_Abholen: $reward claim_');
  }
  const locked = rt.filter((m) => !m.unlocked);
  if (locked.length) {
    L.push('', '*Kommend*');
    for (const m of locked.slice(0, 3)) L.push(`🔒 Level ${m.level} — ${m.label} (+${de(m.coins)} Kupfer)`);
  }
  const log = (p.rewardsLog || []).slice(-5).reverse();
  if (log.length) {
    L.push('', '*Letzte Rewards*');
    for (const r of log) L.push(`${r.copper === null || r.copper === undefined ? '–' : '+' + de(r.copper)} Kupfer — ${r.label || r.kind || '?'} _(${relTime(r.t)})_`);
  }
  return L.join('\n');
}

export function buildProgress(profile, { rankPos = null, rankTotal = 0, now = Date.now() } = {}) {
  const p = ensureProgression(profile) || {};
  const lvl = Number(p.level) || 0;
  const need = neededXp(lvl, Number(p.prestige) || 0);
  const xp = Number(p.xp) || 0;
  const pct = need > 0 ? Math.min(100, Math.round((xp / need) * 100)) : 100;
  const nt = nextTitleFor(lvl);
  const targets = nextTargets(profile, now);
  const goals = goalProgress(profile, now);
  const L = ['> 📈 *FORTSCHRITT*', '',
    `⭐ Level *${de(lvl)}* · \`${bar(pct)}\` ${pct}%`,
    `Noch ${de(Math.max(0, need - xp))} XP bis Level ${de(lvl + 1)}`,
    `🔥 Streak: *${de(p.streak)}* Tage (Best *${de(p.bestStreak)}*)`];
  if (rankPos) L.push(`📍 Global: *#${de(rankPos)}* von ${de(rankTotal)}`);
  if (nt) L.push(`📛 Nächster Titel: ${nt.emoji} *${nt.name}* (ab Level ${nt.min})`);
  const msNext = MILESTONES.find((m) => m.level > lvl && (Number(p.prestige) || 0) === 0);
  if (msNext) L.push(`🎁 Nächster Meilenstein: *Lv ${msNext.level}* — ${msNext.label} (+${de(msNext.coins)} Kupfer)`);
  try {
    const pp = prestigeProgress(profile);
    if (pp && !pp.maxed && lvl >= 100) L.push(`👑 Prestige ${pp.nextPrestige}: noch *${de(pp.levelsToPrestige)}* Level · *${de(pp.xpRemaining)}* XP`);
  } catch (e) {}
  L.push('', '🎯 *Nächste Ziele*');
  for (const t of targets.all) L.push(`${t.emoji} *${t.label}* — ${t.detail} \`(${t.pct}%)\``);
  if (goals.enabled && goals.daily.target > 0) {
    L.push('', `🎯 Tagesziel: \`${bar(goals.daily.pct)}\` ${de(goals.daily.have)}/${de(goals.daily.target)}${goals.daily.done ? ' ✅' : ''}`);
  }
  if (goals.enabled && goals.weekly.target > 0) {
    L.push(`🏆 Wochenziel: \`${bar(goals.weekly.pct)}\` ${de(goals.weekly.have)}/${de(goals.weekly.target)}${goals.weekly.done ? ' ✅' : ''}`);
  }
  if ((p.pendingRewards || []).length) L.push(`🎁 *${(p.pendingRewards || []).length} Truhe(n)* abholbereit — $reward claim`);
  return L.join('\n');
}

/* ═══ NEU 5.0: Quellen, Reports, Prestige, Vergleich ═══ */

/** XP-Quellen-Anteile (Lifetime, echte xpSources). */
export function buildXpSources(profile) {
  const p = ensureProgression(profile) || {};
  const srcs = p.xpSources || {};
  const total = Object.values(srcs).reduce((a, v) => a + (Number(v) || 0), 0);
  const L = ['> 📊 *XP-QUELLEN*', ''];
  if (!total) {
    L.push('_Noch keine XP — jede Aktion zählt ab jetzt! 💜_');
    return L.join('\n');
  }
  const LABEL = { messages: '💬 Nachrichten', love: '💜 Liebesnachrichten', commands: '⚙️ Befehle', games: '🎮 Spiele', dailies: '📅 Dailies', work: '💼 Arbeit', compliments: '🌹 Komplimente', media: '🎬 Media', general: '✨ Sonstiges', admin: '🛠️ Admin' };
  const rows = Object.entries(srcs).map(([k, v]) => ({ k, v: Number(v) || 0 })).filter((r) => r.v > 0)
    .sort((a, b) => b.v - a.v);
  for (const r of rows) {
    const pct = Math.round((r.v / total) * 100);
    L.push(`${LABEL[r.k] || '✨ ' + r.k}: \`${bar(pct, 8)}\` ${pct}% _(${de(r.v)} XP)_`);
  }
  L.push('', `Σ Lifetime: *${de(p.totalXp)}* XP`);
  return L.join('\n');
}

/** Tages-Historie (letzte N Tage aus echter xpDaily). */
export function dailyHistory(profile, n = 7, now = Date.now()) {
  const p = profile?.progression || {};
  const byDay = {};
  for (const e of (p.xpDaily || [])) if (e && e.d) byDay[e.d] = (byDay[e.d] || 0) + (Number(e.a) || 0);
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(new Date(now).toISOString().slice(0, 10) + 'T00:00:00Z').getTime() - i * 86400000;
    const key = new Date(d).toISOString().slice(0, 10);
    out.push({ d: key, a: byDay[key] || 0 });
  }
  return out;
}

function reportBody(profile, days, title, emoji, now, { rankPos = null, rankTotal = 0 } = {}) {
  const hist = dailyHistory(profile, days, now);
  const total = hist.reduce((a, h) => a + h.a, 0);
  const active = hist.filter((h) => h.a > 0).length;
  const best = hist.reduce((a, h) => (h.a > a.a ? h : a), { d: '', a: 0 });
  const avg = active ? Math.round(total / active) : 0;
  const L = [`> ${emoji} *${title}*`, '',
    `+${de(total)} XP in ${days} Tagen · ${de(active)} aktive Tage · Ø ${de(avg)} XP/Tag`];
  if (rankPos) L.push(`🏅 Rang *#${de(rankPos)}* _(von ${de(rankTotal)})_`);
  /* 💰🪙 Kupfer + Aktivität im Zeitraum (6.0, echte Zähler) */
  try {
    const e = ensureEconomy(profile) || {};
    const per = days <= 7 ? (e.periods?.week || {}) : null;
    if (per && per.k) L.push(`🪙 Diese Woche: *+${de(per.e)}* verdient · *−${de(per.s)}* ausgegeben`);
    else if (days > 7) {
      const mk = monthKey(now);
      const mm = e.monthly?.[mk] || {};
      L.push(`🪙 Dieser Monat: *+${de(mm.e)}* verdient · *−${de(mm.s)}* ausgegeben`);
    }
    let m = 0, c = 0, g = 0, w = 0;
    if (days <= 7) {
      const since = new Date(new Date(now).toISOString().slice(0, 10) + 'T00:00:00Z').getTime() - (days - 1) * 86400000;
      for (const x of (profile?.progression?.statsDaily || [])) {
        if (!x || !x.d) continue;
        if (new Date(x.d + 'T00:00:00Z').getTime() < since) continue;
        m += Number(x.m) || 0; c += Number(x.c) || 0; g += Number(x.g) || 0; w += Number(x.w) || 0;
      }
    } else {
      const ms = monthStatsSum(profile, now);
      m = ms.m; c = ms.c; g = ms.g; w = ms.w;
    }
    L.push(`💬 ${de(m)} Nachrichten · ⌨️ ${de(c)} Befehle · 🎮 ${de(g)} Spiele (${de(w)} Siege)`);
  } catch (err) {}
  if (best.a > 0) L.push(`Bester Tag: *${fmtDate(best.d)}* (+${de(best.a)} XP)`);
  const max = Math.max(...hist.map((h) => h.a), 1);
  L.push('');
  const show = days <= 7 ? hist : hist.filter((h) => h.a > 0).slice(-10);
  if (!show.length) L.push('_Keine Aktivität in diesem Zeitraum._');
  for (const h of show) {
    const wd = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][new Date(h.d + 'T00:00:00Z').getUTCDay()];
    L.push(`${wd} ${h.d.slice(5)} \`${bar(Math.round((h.a / max) * 100), 8)}\` +${de(h.a)}`);
  }
  if (days > 7 && hist.filter((h) => h.a > 0).length > 10) L.push(`_… +${hist.filter((h) => h.a > 0).length - 10} weitere aktive Tage_`);
  /* 🏆 Neue Achievements im Zeitraum (echte Store-Zeitstempel) */
  try {
    const bid = profile?.identity?.bid || '';
    const store = loadStore();
    const got = store.users?.[bid]?.achievements || {};
    const since = now - days * 86400000;
    const fresh = Object.entries(got).filter(([, ts]) => (Number(ts) || 0) >= since).length;
    L.push('', `🏆 Neue Achievements: *${de(fresh)}*`);
  } catch (e) {}
  const peW = buildPeriodEconomy(profile, days <= 7 ? 'week' : 'month', now);
  if (peW) L.push('', peW);
  return L.join('\n');
}

/** Wochen-Report (7 Tage, echte Daten). */
export function buildWeeklyReport(profile, now = Date.now(), opts = {}) {
  return reportBody(profile, 7, 'WOCHEN-REPORT', '🗓️', now, opts);
}

/** Monats-Report (30 Tage, echte Daten). */
export function buildMonthlyReport(profile, now = Date.now(), opts = {}) {
  return reportBody(profile, 30, 'MONATS-REPORT', '📆', now, opts);
}

/** Prestige-Karte (Zyklus, Rest-XP echt aus der Kurve, Belohnungen). */
export function buildPrestige(profile) {
  const p = ensureProgression(profile) || {};
  const pp = prestigeProgress(profile);
  const L = ['> 👑 *PRESTIGE*', ''];
  if (!pp) { L.push('_Profil nicht verfügbar._'); return L.join('\n'); }
  L.push(`Aktuell: *Prestige ${de(pp.prestige)}* · Level *${de(pp.level)}*`);
  if (pp.maxed) {
    L.push('👑 *MAXIMAL — du hast alles erreicht. Legende!*');
    return L.join('\n');
  }
  L.push(`Nächstes: *${pp.nextPrestigeTitle}* (Prestige ${pp.nextPrestige})`);
  L.push(`Noch *${de(pp.levelsToPrestige)}* Level · *${de(pp.xpRemaining)}* XP`);
  L.push(`\`${bar(Math.round(((743 - pp.levelsToPrestige) / 743) * 100), 12)}\``);
  L.push('', '*Belohnungen beim Prestige-Up*');
  L.push(`💰 +${de(pp.prestigeCopper)} Kupfer (sofort)`);
  L.push(`🎁 Prestige-Truhe: +${de(pp.chestCopper)} Kupfer (claimbar)`);
  L.push('🏅 Alle Badges, Titel & Achievements bleiben erhalten');
  return L.join('\n');
}

/** Fairer Profil-Vergleich (nur öffentliche Progressions-Daten). */
export function buildCompare(a, nameA, b, nameB, { rankA = null, rankB = null, total = 0, showEconomy = false } = {}) {
  const pa = ensureProgression(a) || {}, pb = ensureProgression(b) || {};
  const row = (label, va, vb, fmt) => {
    const f = fmt || ((v) => de(v));
    const mark = va === vb ? '🟰' : (va > vb ? '🟢' : '🔴');
    const markB = va === vb ? '🟰' : (vb > va ? '🟢' : '🔴');
    return `${label}: ${mark} ${f(va)} vs ${markB} ${f(vb)}`;
  };
  const stA = ensureStats(a) || {}, stB = ensureStats(b) || {};
  const L = ['> ⚔️ *VERGLEICH*', '', `*${nameA}* vs *${nameB}*`, ''];
  L.push(row('Prestige', Number(pa.prestige) || 0, Number(pb.prestige) || 0));
  L.push(row('Level', Number(pa.level) || 0, Number(pb.level) || 0));
  L.push(row('Lifetime-XP', Number(pa.totalXp) || 0, Number(pb.totalXp) || 0, (v) => de(v)));
  L.push(row('Streak-Rekord', Number(pa.bestStreak) || 0, Number(pb.bestStreak) || 0, (v) => de(v) + ' T'));
  L.push(row('Badges', Object.keys(pa.badges || {}).length, Object.keys(pb.badges || {}).length));
  L.push(row('Nachrichten', Number(stA.messages) || 0, Number(stB.messages) || 0));
  L.push(row('Spiele', Number(stA.games) || 0, Number(stB.games) || 0));
  L.push(row('Siege', Number(stA.gameWins) || 0, Number(stB.gameWins) || 0));
  /* 💰 Economy nur bei beidseitiger Sichtbarkeit (6.0 Privacy) */
  if (showEconomy) {
    const ecoA = getBalance(a) || {}, ecoB = getBalance(b) || {};
    L.push(row('Kupfer gesamt', Number(ecoA.total) || 0, Number(ecoB.total) || 0));
    L.push(row('Bank', Number(ecoA.bank) || 0, Number(ecoB.bank) || 0));
  }
  if (rankA || rankB) L.push('', `Rang: *${rankA ? '#' + de(rankA) : '–'}* vs *${rankB ? '#' + de(rankB) : '–'}* _(von ${de(total)})_`);
  return L.join('\n');
}

export function buildStreakCard(profile) {
  const p = ensureProgression(profile) || {};
  const streak = Math.max(Number(p.streak) || 0, Number(p.streaks?.daily?.c) || 0);
  const marks = [7, 30, 100, 365];
  const next = marks.find((m) => m > streak);
  const prev = [...marks].reverse().find((m) => m <= streak) || 0;
  const pct = next ? Math.min(99, Math.round(((streak - prev) / (next - prev)) * 100)) : 100;
  const L = ['> 🔥 *STREAK*', '',
    `Aktuell: *${de(streak)}* Tage · Best: *${de(p.bestStreak)}* Tage`,
    `\`${bar(pct, 12)}\` ${pct}%`];
  if (next) {
    L.push(`Nächstes Ziel: *${next} Tage* (noch ${de(next - streak)})`);
    const rewards = { 7: '🏅 7-Tage-Badge + 50 XP + 🏆 Achievement', 30: '🏅 30-Tage-Badge + 200 XP + 🏆 Achievement', 100: '🏅 100-Tage-Badge + 1000 XP + 🏆 Achievement', 365: '🏆 Jahres-Badge + 🏆 Achievement' };
    L.push(`Belohnung: ${rewards[next] || '–'}`);
  } else {
    L.push('👑 *Maximale Streak-Marke erreicht!*');
  }
  const sts = p.streaks || {};
  L.push('', `Chat: ${de(sts.chat?.c)} Tage · XP (≥50/Tag): ${de(sts.xp?.c)} Tage`);
  return L.join('\n');
}

export function buildBadgeShowcase(profile, achCount = 0) {
  const prog = badgeProgress(profile, achCount);
  const got = prog.filter((b) => b.unlocked);
  const L = ['> 🏅 *DEINE BADGES* _(' + got.length + '/' + prog.length + ')_', ''];
  for (const area of BADGE_AREAS) {
    const inArea = prog.filter((b) => b.area === area.id);
    if (!inArea.length) continue;
    const gotA = inArea.filter((b) => b.unlocked).length;
    L.push(`${area.emoji} *${area.name.toUpperCase()}* (${gotA}/${inArea.length})`);
    for (const b of inArea) {
      const tier = (b.tier && b.tiers && b.tiers > 1) ? ` _[Stufe ${b.tier}/${b.tiers}]_` : '';
      if (b.unlocked) L.push(`${b.emoji} *${b.name}* — _${b.desc}_${tier}`);
      else L.push(`🔒 ${b.name} \`(${de(b.have)}/${de(b.need)})\` — _${b.desc}_${tier}`);
    }
    L.push('');
  }
  return L.join('\n').trimEnd();
}

export function buildTitleOverview(profile, achCount = 0) {
  const p = ensureProgression(profile) || {};
  const lvl = Number(p.level) || 0;
  const active = activeTitleFor(profile);
  const L = ['> 📛 *TITEL*', '', `Aktiv: ${active.emoji} *${active.name}*`, '', '*Level-Titel*'];
  const earned = TITLES.filter((t) => t.min <= lvl);
  for (const t of earned) L.push(`${t.emoji} *${t.name}* (ab Level ${t.min})`);
  const locked = TITLES.filter((t) => t.min > lvl);
  for (const t of locked) L.push(`🔒 ${t.name} (ab Level ${t.min} — noch ${de(t.min - lvl)})`);
  /* 🌟 Spezial-Titel: verdient vs. offen (mit echtem Fortschritt) */
  let avail = [];
  try { avail = availableTitles(profile, achCount); } catch (e) { avail = []; }
  const availNames = new Set(avail.map((t) => t.name));
  const streak = Math.max(Number(p.streak) || 0, Number(p.streaks?.daily?.c) || 0);
  const progOf = (s) => {
    if (s.source === 'prestige') return `${de(p.prestige)}/${s.need.replace(/[^0-9]/g, '')}`;
    if (s.source === 'collection') return `${de(achCount)}/${s.need.replace(/[^0-9]/g, '')}`;
    if (s.source === 'streak') return `${de(streak)}/${s.need.replace(/[^0-9]/g, '')}`;
    return '–';
  };
  L.push('', '*Spezial-Titel*');
  for (const s of SPECIAL_TITLES) {
    if (availNames.has(s.name)) L.push(`${s.emoji} *${s.name}* _(${s.need})_`);
    else L.push(`🔒 ${s.name} _(${s.need} — jetzt ${progOf(s)})_`);
  }
  L.push('', '_Wählen: $title use <name> · Zurück zum Höchsten: $title clear_');
  return L.join('\n');
}

/* ═══════════════════════════════════════════════════════════════════════
   💰 6.0 ACCOUNT / ECONOMY — Builder (lesen nur, schreiben nie)
   ═══════════════════════════════════════════════════════════════════════ */

/** True, wenn das Profil seine Economy vor anderen verbirgt. */
export function economyHidden(profile) {
  return profile?.registration?.privacy?.hideEconomy === true;
}

/** Kompakte Geldbörse (eine Zeile, für $me-kompakt). */
export function buildCoins(profile) {
  const b = getBalance(profile) || {};
  return `🪙 *${de(b.wallet)}* Kupfer · 🏦 *${de(b.bank)}* Bank · Σ *${de(b.total)}*`;
}

/** Wallet-Karte mit Tages-/Wochen-/Lifetime-Summen. */
export function buildBalance(profile, now = Date.now()) {
  const b = getBalance(profile) || {};
  const e = ensureEconomy(profile) || {};
  const L = ['> 💰 *KONTO*', '',
    `🤎 Wallet: *${de(b.wallet)}* Kupfer`,
    `🏦 Bank: *${de(b.bank)}* Kupfer`,
    `💎 Gesamt: *${de(b.total)}* Kupfer`];
  const day = e.periods?.day || {}, week = e.periods?.week || {};
  L.push('', `Heute: *+${de(day.e)}* / *−${de(day.s)}*`);
  L.push(`Woche: *+${de(week.e)}* / *−${de(week.s)}*`);
  L.push(`Lifetime: *+${de(e.stats?.earned)}* / *−${de(e.stats?.spent)}*`);
  if (e.stats?.highBal) L.push(`🏆 Rekord-Vermögen: *${de(e.stats.highBal)}*`);
  return L.join('\n');
}

/** Bank-Karte (Vaults, Kapazität, Zinsen). */
export function buildBank(profile, { achCount = 0, now = Date.now() } = {}) {
  const b = getBalance(profile) || {};
  const cap = capacityFor(profile, achCount);
  const free = Math.max(0, cap - (Number(b.bank) || 0));
  const pct = cap > 0 ? Math.round((Number(b.bank) || 0) / cap * 100) : 0;
  const e = ensureEconomy(profile) || {};
  const r = xpRules().economy || {};
  const L = ['> 🏦 *BANK*', '',
    `Guthaben: *${de(b.bank)}* Kupfer`,
    `\`${bar(Math.min(100, pct), 12)}\` ${pct} %`,
    `Kapazität: *${de(b.bank)}* / *${de(cap)}* (frei: *${de(free)}*)`];
  L.push('', `📈 Zins: *${Number(r.interestPct ?? 1)} %* pro Tag (max. *${de(r.interestCap ?? 5000)}*, ins Wallet)`);
  const last = Number(e.interest?.lastAt) || 0;
  const cdMs = Math.max(1, Number(r.interestCooldownH) || 24) * 3600000;
  if (last > 0 && now - last < cdMs) {
    const waitH = Math.floor((cdMs - (now - last)) / 3600000);
    const waitM = Math.round(((cdMs - (now - last)) % 3600000) / 60000);
    L.push(`⏳ Nächste Zinsen in *${waitH} Std. ${waitM} Min.*`);
  } else if ((Number(b.bank) || 0) > 0) {
    L.push('✅ *Zinsen bereit* — abholen mit *$bank claim*!');
  } else {
    L.push('_Leeres Konto bringt keine Zinsen — erst einzahlen._');
  }
  return L.join('\n');
}

/** Voller Economy-Überblick. */
export function buildEconomy(profile, { achCount = 0, now = Date.now(), name = '' } = {}) {
  const b = getBalance(profile) || {};
  const e = ensureEconomy(profile) || {};
  const cap = capacityFor(profile, achCount);
  const L = ['> 🪙 *ECONOMY*' + (name ? ' — ' + name : ''), '',
    `🤎 Wallet: *${de(b.wallet)}*`,
    `🏦 Bank: *${de(b.bank)}* / *${de(cap)}*`,
    `💎 Gesamt: *${de(b.total)}* Kupfer`];
  const mk = monthKey(now);
  const mm = e.monthly?.[mk] || {};
  L.push('', `📅 Monat: *+${de(mm.e)}* / *−${de(mm.s)}*`);
  L.push(`♾️ Lifetime: *+${de(e.stats?.earned)}* / *−${de(e.stats?.spent)}*`);
  const d = e.daily || {};
  if (d.best) L.push(`🔥 Daily-Serie: *${de(d.streak)}* (Rekord *${de(d.best)}*)`);
  const tx = (e.tx || [])[0];
  if (tx) L.push('', `Letzte Buchung: *${tx.d > 0 ? '+' : ''}${de(tx.d)}* (${sourceLabel(tx.s)})`);
  return L.join('\n');
}

/** Transaktions-Verlauf (neueste zuerst). */
export function buildTransactions(profile, { limit = 10 } = {}) {
  const e = ensureEconomy(profile) || {};
  const tx = (e.tx || []).slice(0, Math.max(1, Math.min(20, Number(limit) || 10)));
  const L = ['> 🧾 *TRANSAKTIONEN*', ''];
  if (!tx.length) { L.push('_Noch keine Buchungen._'); return L.join('\n'); }
  for (const t of tx) {
    const sign = Number(t.d) >= 0 ? '+' : '';
    const vault = t.v === 'bank' ? '🏦' : '🤎';
    L.push(`${vault} *${sign}${de(t.d)}* · ${sourceLabel(t.s)}${t.r ? ` _(${String(t.r).slice(0, 40)})_` : ''}`);
  }
  return L.join('\n');
}

/** Einheitliche Daily-Karte (Claim-Ergebnis + XP). */
export function buildDailySummary(profile, { claim = null, xpGranted = 0, pref = '$' } = {}) {
  const e = ensureEconomy(profile) || {};
  const d = e.daily || {};
  const L = ['> 📅 *DAILY*', ''];
  if (!claim || !claim.ok) {
    if (claim && claim.reason === 'claimed') {
      L.push('⏳ *Heute schon abgeholt.*');
      L.push(`🔥 Serie: *${de(d.streak)}* Tage (Rekord *${de(d.best)}*)`);
      L.push('', '♡ _come back tomorrow. I\'ll be here._');
    } else {
      L.push('_Heute noch nicht abgeholt._');
      if (d.streak) L.push(`🔥 Serie: *${de(d.streak)}* Tage`);
    }
    return L.join('\n');
  }
  L.push(`🪙 *+${de(claim.amount)} Kupfer*${xpGranted ? ` · 💜 *+${de(xpGranted)} XP*` : ''}`);
  L.push(`🔥 Serie: *${de(claim.streak)}* Tag${claim.streak === 1 ? '' : 'e'}${claim.continued ? '' : ' (neu gestartet)'}`);
  if (claim.effPct) L.push(`📈 Streak-Bonus: *+${claim.effPct} %*`);
  for (const bo of (claim.bonuses || [])) {
    if (bo.kind === 'milestone') L.push(`🏆 Meilenstein ${bo.streak} Tage: *+${de(bo.amount)}*`);
    else if (bo.kind === 'weekly') L.push(`🗓️ Wochen-Bonus: *+${de(bo.amount)}*`);
    else if (bo.kind === 'monthly') L.push(`🗓️ Monats-Bonus: *+${de(bo.amount)}*`);
    else if (bo.kind === 'yearly') L.push(`🎆 Jahres-Bonus: *+${de(bo.amount)}*`);
    else if (bo.kind === 'best') L.push(`🏆 Neuer Serien-Rekord: *+${de(bo.amount)}*`);
  }
  L.push('', `💰 Kontostand: *${de(claim.balance)}* Kupfer`);
  L.push('', `_Morgen wieder: ${pref}daily_`);
  return L.join('\n');
}

/** Monatsvergleich: dieser vs. letzter Monat (XP + Kupfer). Null statt Fake. */
export function monthlyTrend(profile, now = Date.now()) {
  const mk = monthKey(now);
  const d = new Date(mk + '-01T00:00:00Z');
  d.setUTCMonth(d.getUTCMonth() - 1);
  const prev = d.toISOString().slice(0, 7);
  const p = profile?.progression || {};
  const cur = Number(p.xpMonthly?.[mk]);
  const prv = Number(p.xpMonthly?.[prev]);
  const e = profile?.economy || {};
  const cCur = e.monthly?.[mk] || null;
  const cPrv = e.monthly?.[prev] || null;
  return {
    month: mk, prev,
    xp: Number.isFinite(cur) ? cur : 0,
    xpPrev: Number.isFinite(prv) ? prv : null,
    coins: cCur ? { e: Number(cCur.e) || 0, s: Number(cCur.s) || 0 } : { e: 0, s: 0 },
    coinsPrev: cPrv ? { e: Number(cPrv.e) || 0, s: Number(cPrv.s) || 0 } : null
  };
}

/** Jahres-Report (12 Monate, echte Aggregate + Store-Zeitstempel). */
export function buildYearlyReport(profile, now = Date.now(), { rankPos = null, rankTotal = 0 } = {}) {
  const yxp = yearXpSum(profile, now);
  const ys = yearStatsSum(profile, now);
  const e = ensureEconomy(profile) || {};
  const yp = e.periods?.year || {};
  const p = profile?.progression || {};
  const months = Object.keys(p.xpMonthly || {}).sort();
  const bestMk = months.reduce((a, k) => ((Number(p.xpMonthly[k]) || 0) > (Number(p.xpMonthly[a]) || 0) ? k : a), months[0] || '');
  const L = ['> 🎆 *JAHRES-REPORT*', ''];
  L.push(`+${de(yxp)} XP · ${de(months.length)} aktive Monate`);
  if (rankPos) L.push(`🏅 Rang *#${de(rankPos)}* _(von ${de(rankTotal)})_`);
  L.push('', `💬 ${de(ys.m)} Nachrichten · ⌨️ ${de(ys.c)} Befehle`);
  L.push(`🎮 ${de(ys.g)} Spiele (${de(ys.w)} Siege)`);
  L.push(`🪙 Jahr: *+${de(yp.e)}* verdient · *−${de(yp.s)}* ausgegeben`);
  if (bestMk && Number(p.xpMonthly[bestMk]) > 0) {
    L.push(`🌟 Stärkster Monat: *${bestMk}* (+${de(p.xpMonthly[bestMk])} XP)`);
  }
  const d = e.daily || {};
  if (d.best) L.push(`🔥 Beste Daily-Serie: *${de(d.best)}* Tage`);
  try {
    const bid = profile?.identity?.bid || '';
    const store = loadStore();
    const got = store.users?.[bid]?.achievements || {};
    const since = now - 365 * 86400000;
    const fresh = Object.entries(got).filter(([, ts]) => (Number(ts) || 0) >= since).length;
    L.push('', `🏆 Neue Achievements: *${de(fresh)}*`);
  } catch (err) {}
  if (!yxp && !months.length) L.push('', '_Noch keine Jahresdaten — sie entstehen ab jetzt automatisch._');
  const peY = buildPeriodEconomy(profile, 'year', now);
  if (peY) L.push('', peY);
  return L.join('\n');
}


/* ── 💜 7.0: Perioden-Economy (verdient/ausgegeben/netto + Top-Quelle/-Ausgabe) ── */
export function buildPeriodEconomy(profile, kind = 'week', now = Date.now()) {
  try {
    const e = ensureEconomy(profile) || {};
    const k = String(kind || 'week').toLowerCase();
    const days = k === 'day' ? 1 : k === 'month' ? 30 : k === 'year' ? 365 : k === 'life' ? 0 : 7;
    const per = days === 0 ? null : (e.periods?.[k === 'life' ? 'year' : k] || {});
    const earned = days === 0 ? (e.stats?.earned || 0) : (per.e || 0);
    const spent = days === 0 ? (e.stats?.spent || 0) : (per.s || 0);
    const since = days === 0 ? 0 : now - days * 86400000;
    const src = {}, sink = {};
    for (const t of (e.tx || [])) {
      if ((Number(t.t) || 0) < since) continue;
      const d = Number(t.d) || 0;
      if (d >= 0) src[t.s] = (src[t.s] || 0) + d;
      else sink[t.s] = (sink[t.s] || 0) - d;
    }
    const top = (o) => { const e2 = Object.entries(o).sort((a, b) => b[1] - a[1])[0]; return e2 ? `${sourceLabel(e2[0])} (+${de(e2[1])})` : '–'; };
    const topS = (o) => { const e2 = Object.entries(o).sort((a, b) => b[1] - a[1])[0]; return e2 ? `${sourceLabel(e2[0])} (−${de(e2[1])})` : '–'; };
    const label = { day: 'Heute', week: 'Woche', month: 'Monat', year: 'Jahr', life: 'Lifetime' }[k] || 'Woche';
    return `🪙 ${label}: *+${de(earned)}* / *−${de(spent)}* (netto *${de(earned - spent)}*) · Top: ${top(src)} · Top-Ausgabe: ${topS(sink)}`;
  } catch (err) { return ''; }
}

/** Tages-Report (heute, echte Zähler). */
export function buildDayReport(profile, now = Date.now(), { rankPos = null, rankTotal = 0 } = {}) {
  const p = profile?.progression || {};
  const dk = new Date(now).toISOString().slice(0, 10);
  const entry = (p.xpDaily || []).find((x) => x && x.d === dk) || {};
  const st = (p.statsDaily || []).find((x) => x && x.d === dk) || {};
  const e = ensureEconomy(profile) || {};
  const day = e.periods?.day || {};
  const L = ['> 📅 *TAGES-REPORT*', ''];
  L.push(`+${de(entry.a)} XP heute`);
  if (rankPos) L.push(`🏅 Rang *#${de(rankPos)}* _(von ${de(rankTotal)})_`);
  L.push('', `💬 ${de(st.m)} Nachrichten · ⌨️ ${de(st.c)} Befehle · 🎮 ${de(st.g)} Spiele`);
  L.push(`🪙 Heute: *+${de(day.e)}* / *−${de(day.s)}*`);
  const peD = buildPeriodEconomy(profile, 'day', now);
  if (peD) L.push(peD);
  L.push(`_Mehr: ${'$'}report week · ${'$'}report month · ${'$'}report year_`);
  return L.join('\n');
}

/**
 * Zentraler Report-Dispatcher (6.0): day|week|month|year|all.
 * $report + $daily/$weekly/$monthly/$yearly nutzen alle diesen Weg.
 */
export function buildReport(profile, period = 'week', { now = Date.now(), rankPos = null, rankTotal = 0 } = {}) {
  const per = String(period || 'week').toLowerCase();
  if (per === 'day' || per === 'today' || per === 'tagesreport') return buildDayReport(profile, now, { rankPos, rankTotal });
  if (per === 'month' || per === 'monat' || per === 'monatsreport') return buildMonthlyReport(profile, now, { rankPos, rankTotal });
  if (per === 'year' || per === 'jahr' || per === 'jahresreport') return buildYearlyReport(profile, now, { rankPos, rankTotal });
  if (per === 'all' || per === 'lifetime' || per === 'alles') return buildLifetimeReport(profile, { rankPos, rankTotal });
  return buildWeeklyReport(profile, now, { rankPos, rankTotal });
}

/** Lifetime-Übersicht (alle echten Summen). */
export function buildLifetimeReport(profile, { rankPos = null, rankTotal = 0 } = {}) {
  const p = ensureProgression(profile) || {};
  const st = profile?.stats || {};
  const e = ensureEconomy(profile) || {};
  const L = ['> ♾️ *LIFETIME*', ''];
  L.push(`⭐ *${de(p.totalXp)}* XP · Prestige *${de(p.prestige)}* · Level *${de(p.level)}*`);
  if (rankPos) L.push(`🏅 Rang *#${de(rankPos)}* _(von ${de(rankTotal)})_`);
  L.push('', `💬 ${de(st.messages)} Nachrichten · ⌨️ ${de(st.commands)} Befehle`);
  L.push(`🎮 ${de(st.games)} Spiele (${de(st.gameWins)} Siege) · 🎁 ${de(st.dailiesClaimed)} Dailies`);
  L.push(`🪙 *+${de(e.stats?.earned)}* verdient · *−${de(e.stats?.spent)}* ausgegeben`);
  L.push(`🏆 Rekord-Vermögen: *${de(e.stats?.highBal)}*`);
  return L.join('\n');
}

/** XP-Multiplikator-Karte (Aufschlüsselung + Event-Countdown). */
export function buildXpMultiplier(profile, { isOwner = false, now = Date.now() } = {}) {
  const bd = xpMultiplierBreakdown(profile, now, { isOwner });
  const L = ['> ✖️ *XP-MULTIPLIKATOR*', ''];
  for (const pt of (bd.parts || [])) {
    L.push(`${pt.active ? '✅' : '⚪'} ${pt.label}: *×${Number(pt.mult).toFixed(2)}*`);
  }
  L.push('', `Gesamt: *×${Number(bd.total).toFixed(2)}*${bd.capped ? ` _(gedeckelt bei ×${bd.cap})_` : ''}`);
  try {
    const r = xpRules().multipliers || {};
    if (r.eventActive && r.eventEndsAt) {
      const left = Number(r.eventEndsAt) - now;
      if (left > 0) {
        const h = Math.floor(left / 3600000), m = Math.round((left % 3600000) / 60000);
        L.push(`🎪 Event endet in *${h} Std. ${m} Min.*`);
      }
    }
  } catch (err) {}
  const peL = buildPeriodEconomy(profile, 'life', Date.now());
  if (peL) L.push('', peL);
  return L.join('\n');
}

/** Economy-Zeile für $me-kompakt (Wochen-/Monats-Summen). */
export function buildPeriodsLine(profile) {
  const e = ensureEconomy(profile) || {};
  const w = e.periods?.week || {}, m = e.periods?.month || {};
  return `🪙 Woche *+${de(w.e)}* · Monat *+${de(m.e)}*`;
}

/** Economy-Block für $me-vollständig. */
export function buildEconomySection(profile, { achCount = 0 } = {}) {
  const b = getBalance(profile) || {};
  const cap = capacityFor(profile, achCount);
  const e = ensureEconomy(profile) || {};
  const d = e.daily || {};
  const L = ['*💰 ECONOMY*',
    `🤎 ${de(b.wallet)} · 🏦 ${de(b.bank)} / ${de(cap)} · Σ ${de(b.total)}`];
  if (d.best) L.push(`🔥 Daily-Serie ${de(d.streak)} (Rekord ${de(d.best)})`);
  return L.join('\n');
}

/**
 * 👤 Vollständige Account-Übersicht ($account / $info me).
 * plusUser (loveplus-Store) liefert der Aufrufer für Inventar/Achievements.
 */
export function buildAccount(profile, { plusUser = null, rankPos = null, rankTotal = 0, achCount = null, now = Date.now(), pref = '$', extras = null } = {}) {
  const p = ensureProgression(profile) || {};
  const b = getBalance(profile) || {};
  const e = ensureEconomy(profile) || {};
  const reg = profile?.registration || {};
  const L = ['> 👤 *ACCOUNT*', ''];
  L.push(`*${reg.name || 'Unregistriert'}*${reg.registeredAt ? ` · dabei seit ${fmtDate(reg.registeredAt)}` : ''}`);
  const rk = rankPos ? ` · 🏅 *#${de(rankPos)}*` : '';
  L.push(`⭐ P${de(p.prestige)} · Lv *${de(p.level)}* · *${de(p.totalXp)}* XP${rk}`);
  L.push(`🪙 *${de(b.total)}* Kupfer (🤎 ${de(b.wallet)} · 🏦 ${de(b.bank)})`);
  try {
    const bid = profile?.identity?.bid || '';
    const count = achCount !== null ? achCount : achievementProgress(bid, profile).count;
    const total = achievementProgress(bid, profile).total;
    L.push(`🏆 ${de(count)} / ${de(total)} Achievements · 🏅 ${de(Object.keys(p.badges || {}).length)} Badges`);
  } catch (err) {}
  const inv = Object.entries(plusUser?.inventory || {}).filter(([, n]) => Number(n) > 0);
  const invCount = inv.reduce((a, [, n]) => a + (Number(n) || 0), 0);
  L.push(`📦 Inventar: *${de(invCount)}* Items (${de(inv.length)} Sorten)`);
  const d = e.daily || {};
  if (d.best) L.push(`🔥 Daily-Serie: *${de(d.streak)}* (Rekord *${de(d.best)}*)`);
  const pend = (p.pendingRewards || []).length;
  if (pend) L.push(`🎁 *${de(pend)}* Truhe${pend === 1 ? '' : 'n'} wartet (${pref}reward)`);
  if (extras && typeof extras === 'object') {
    if (extras.ageDays !== null && extras.ageDays !== undefined) L.push(`📅 Alter: *${de(extras.ageDays)}* Tage`);
    if (extras.lastActive) L.push(`🕐 Zuletzt aktiv: ${extras.lastActive}`);
    const sec = [];
    if (extras.dsgvo) sec.push('DSGVO ✅');
    if (extras.verified) sec.push('Verifiziert ✅');
    if (sec.length) L.push(`🔐 ${sec.join(' · ')}`);
    if (extras.notif) L.push(`🔔 Mitteilungen: ${extras.notif}`);
    if (extras.privacy) L.push(`👁️ Privatsphäre: ${extras.privacy}`);
    if (extras.ai) L.push(`🤖 AI: ${extras.ai}`);
  }
  L.push('', `_Details: ${pref}me · ${pref}economy · ${pref}report_`);
  return L.join('\n');
}

/** Top-Vermögen (bot-weit, echte Salden). */
export function topCoins(users = {}, n = 10) {
  return Object.entries(users || {})
    .filter(([, u]) => u && typeof u === 'object')
    .map(([bid, u]) => ({
      bid,
      name: u.registration?.name || u.identity?.username || '–',
      wallet: Math.max(0, Math.floor(Number(u.wallet?.copper) || 0)),
      bank: Math.max(0, Math.floor(Number(u.bank?.copper) || 0))
    }))
    .map((r) => ({ ...r, total: r.wallet + r.bank }))
    .sort((a, b) => b.total - a.total)
    .slice(0, Math.max(1, Math.min(25, Number(n) || 10)));
}

/** Reichsten-Liste ($rich / $top coins). */
export function buildTopCoins(users = {}, { n = 10, myBid = '', pref = '$' } = {}) {
  const rows = topCoins(users, n);
  const L = ['> 💰 *REICHSTE*', ''];
  if (!rows.length) { L.push('_Noch keine Vermögen._'); return L.join('\n'); }
  const medals = ['🥇', '🥈', '🥉'];
  rows.forEach((r, i) => {
    const mark = r.bid === myBid ? ' ◀️' : '';
    L.push(`${medals[i] || `${de(i + 1)}.`} *${String(r.name).slice(0, 20)}* — ${de(r.total)} 🪙${mark}`);
  });
  L.push('', `_Mehr verdienen: ${pref}daily · ${pref}work_`);
  return L.join('\n');
}

/* ── 💜 7.0: Aktivitäts-Sektion für $me (Perioden · Trends · Rekorde · Gruppen · AI) ── */
export function buildMeActivity(profile, { groupActivity = null, aiUsage = null, now = Date.now() } = {}) {
  const p = profile || {};
  const prog = p.progression || {};
  const eco = p.economy || {};
  let w = 0, m = 0;
  try { w = weekXpSum(p, now); } catch (e) {}
  try { m = monthXpSum(p, now); } catch (e) {}
  const months = Object.keys(prog.xpMonthly || {}).sort().slice(-3);
  const trend = months.length
    ? months.map((k) => `${k.slice(5)}: ${de(prog.xpMonthly[k])}`).join(' · ')
    : '–';
  const ga = groupActivity || { msgs: 0, xp: 0, groups: 0 };
  const aiLine = aiUsage && (aiUsage.total > 0 || aiUsage.today > 0)
    ? `${de(aiUsage.today || 0)} heute · ${de(aiUsage.total || 0)} gesamt`
    : 'noch keine — sag `$ai hallo`!';
  return '📊 *ACTIVITY*\n' +
    `• Woche: *${de(w)} XP* · Monat: *${de(m)} XP*\n` +
    `• Trend: ${trend}\n` +
    `• Rekorde: 🔥 ${de(prog.bestStreak)} Streak · 📅 ${de(eco.daily?.best)} Daily · ✨ ${de(prog.totalXp)} XP\n` +
    `• Gruppen: ${de(ga.msgs)} Nachrichten · ${de(ga.xp)} GXP in ${de(ga.groups)} Gruppen\n` +
    `• 🤖 AI: ${aiLine}`;
}

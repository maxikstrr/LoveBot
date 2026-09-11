/* ═══════════════════════════════════════════════════════════════════
   💜 LoveBot 7.0 — GROUP ENGINE (groups.js)

   Eigenes Gruppen-System auf dem BESTEHENDEN Gruppenprofil
   (`db.groups[cleanG]` + LoveGroups-Mirror via waApi.saveGroupProfile).

   · Kein Parallelsystem: alle Felder hängen am Gruppenprofil.
   · Persönliches XP bleibt beim User — Group-XP ist getrennt.
   · Alles Opt-in: Schutz-/Automations-Settings sind default AUS
     (außer dokumentierte Alt-Defaults aus GROUP_FEATURES).
   ═══════════════════════════════════════════════════════════════════ */

export const GSET_DEFAULTS = {
  welcome: true,          /* Alt-Default (GROUP_FEATURES) */
  goodbye: true,          /* Alt-Default */
  antilink: false,        /* Alt-Default */
  antispam: false,        /* 7.0 neu — Opt-in */
  antiflood: false,       /* 7.0 neu — Opt-in */
  automod: true,          /* 7.0: runAutoModeration (Badwords etc.) */
  autoreply: false,       /* 7.0 neu — Opt-in */
  mentionGuard: false,    /* 7.0 neu — Opt-in */
  commandProtection: false, /* 7.0 neu: nur Admins dürfen Bot-Cmds — Opt-in */
  aiEnabled: false,       /* 7.0 neu — Opt-in pro Gruppe */
  economyEnabled: true,   /* 7.0: Treasury/Goals an */
  progressionEnabled: true, /* 7.0: Group-XP an */
  logsEnabled: true       /* 7.0: Audit-Log an */
};

export const GSET_LABELS = {
  welcome: ['👋', 'Welcome'], goodbye: ['🚪', 'Goodbye'],
  antilink: ['🔗', 'Anti-Link'], antispam: ['🚫', 'Anti-Spam'],
  antiflood: ['🌊', 'Anti-Flood'], automod: ['🛡', 'Auto-Mod'],
  autoreply: ['💬', 'Auto-Reply'], mentionGuard: ['📣', 'Mention-Guard'],
  commandProtection: ['⌨️', 'Command-Schutz'], aiEnabled: ['🤖', 'AI'],
  economyEnabled: ['💰', 'Economy'], progressionEnabled: ['🏆', 'XP'],
  logsEnabled: ['🧾', 'Logs']
};

/* In-Memory-Fenster für Spam/Flood (Restart-sicher irrelevant — reine Rate-Fenster) */
const spamWin = new Map();   /* gid:bid -> { lastText, count, resetAt } */
const floodWin = new Map();  /* gid:bid -> { stamps: [] } */

function dayKey(ts = Date.now()) { return new Date(ts).toISOString().slice(0, 10); }
function weekKey(ts = Date.now()) {
  const d = new Date(ts);
  const onejan = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const w = Math.ceil((((d - onejan) / 86400000) + onejan.getUTCDay() + 1) / 7);
  return d.getUTCFullYear() + '-W' + String(w).padStart(2, '0');
}
function monthKey(ts = Date.now()) { return new Date(ts).toISOString().slice(0, 7); }

/* ── Struktur ─────────────────────────────────────────────────────── */
export function ensureGroupExtras(g) {
  if (!g || typeof g !== 'object') return null;
  if (typeof g.gset !== 'object' || !g.gset) g.gset = {};
  for (const [k, v] of Object.entries(GSET_DEFAULTS)) {
    if (typeof g.gset[k] !== 'boolean') g.gset[k] = v;
  }
  if (typeof g.xp !== 'object' || !g.xp) g.xp = {};
  const x = g.xp;
  if (!Number.isFinite(x.total)) x.total = 0;
  if (!Number.isFinite(x.level)) x.level = 0;
  if (!Number.isFinite(x.msgs)) x.msgs = 0;
  if (!Number.isFinite(x.games)) x.games = 0;
  if (typeof x.members !== 'object' || !x.members) x.members = {};
  if (typeof x.week !== 'object' || !x.week) x.week = { k: '', xp: 0 };
  if (typeof x.month !== 'object' || !x.month) x.month = { k: '', xp: 0 };
  if (typeof x.daily !== 'object' || !x.daily) x.daily = { k: '', msgs: 0 };
  if (typeof x.streak !== 'object' || !x.streak) x.streak = { c: 0, last: '' };
  if (typeof x.history !== 'object' || !x.history) x.history = {}; /* YYYY-MM-DD -> xp (14) */
  if (typeof g.goals !== 'object' || !g.goals) g.goals = {};
  if (typeof g.gach !== 'object' || !g.gach) g.gach = {};
  if (typeof g.gbadges !== 'object' || !g.gbadges) g.gbadges = {};
  if (!Array.isArray(g.gevents)) g.gevents = [];
  if (!Array.isArray(g.gaudit)) g.gaudit = [];
  if (typeof g.gtreasury !== 'object' || !g.gtreasury) g.gtreasury = { balance: 0, log: [] };
  if (!Number.isFinite(g.gtreasury.balance)) g.gtreasury.balance = 0;
  if (!Array.isArray(g.gtreasury.log)) g.gtreasury.log = [];
  if (typeof g.gbanned !== 'object' || !g.gbanned) g.gbanned = {};
  if (typeof g.warnCfg !== 'object' || !g.warnCfg) g.warnCfg = { w1: 'warn', w2: 'warn', w3: 'kick' };
  return g;
}

export function getGset(g) {
  ensureGroupExtras(g);
  return { ...g.gset };
}

/* Whitelist-Änderung + Audit. Gibt { ok, reason? } zurück. */
export function setGset(g, key, val, actor = '') {
  ensureGroupExtras(g);
  if (!Object.prototype.hasOwnProperty.call(GSET_DEFAULTS, key)) return { ok: false, reason: 'unknown-key' };
  g.gset[key] = val === true;
  if (g.gset.logsEnabled) groupAudit(g, actor || 'system', 'setting', `${key} → ${val === true ? 'an' : 'aus'}`);
  return { ok: true, key, value: g.gset[key] };
}

/* ── Audit (50 Einträge, rotierend) ───────────────────────────────── */
export function groupAudit(g, actor = '', action = '', detail = '') {
  ensureGroupExtras(g);
  g.gaudit.push({ ts: Date.now(), actor: String(actor).slice(0, 60), action: String(action).slice(0, 30), detail: String(detail).slice(0, 140) });
  if (g.gaudit.length > 50) g.gaudit.splice(0, g.gaudit.length - 50);
  return g.gaudit.length;
}

/* ── Group-XP ───────────────────────────────────────────────────────
   Kurve: need(lv) = 300 + lv*50. Basis: 2 XP/Nachricht, Event-Mult. */
export const GROUP_XP_PER_MSG = 2;
export function groupNeed(lv) { return 300 + Math.max(0, lv) * 50; }

export function activeEventMult(g, now = Date.now()) {
  ensureGroupExtras(g);
  let mult = 1;
  for (const e of g.gevents) {
    if (e && Number(e.endsAt) > now && Number(e.mult) > 1) mult = Math.max(mult, Number(e.mult));
  }
  return mult;
}

/* Zentrale Nachrichten-Verbuchung. members-Map auf 200 aktivste begrenzt. */
export function applyGroupMessage(g, bid, { games = 0, now = Date.now(), memberCount = 0 } = {}) {
  ensureGroupExtras(g);
  const events = [];
  if (g.gset.progressionEnabled === false) return { xp: 0, events };
  const x = g.xp;
  /* Tages-Rotation + Streak */
  const dk = dayKey(now), wk = weekKey(now), mk = monthKey(now);
  if (x.daily.k !== dk) {
    const y = new Date(now - 86400000).toISOString().slice(0, 10);
    x.streak.c = (x.daily.k === y || x.streak.last === y) ? (x.streak.c || 0) + 1 : 1;
    x.streak.last = dk;
    x.daily = { k: dk, msgs: 0 };
  }
  if (x.week.k !== wk) x.week = { k: wk, xp: 0 };
  if (x.month.k !== mk) x.month = { k: mk, xp: 0 };

  const mult = activeEventMult(g, now);
  const gain = Math.max(1, Math.round(GROUP_XP_PER_MSG * mult));
  x.total += gain; x.msgs += 1; x.games += games > 0 ? games : 0;
  x.week.xp += gain; x.month.xp += gain; x.daily.msgs += 1;
  x.history[dk] = (x.history[dk] || 0) + gain;
  const hkeys = Object.keys(x.history).sort();
  if (hkeys.length > 14) for (const k of hkeys.slice(0, hkeys.length - 14)) delete x.history[k];

  if (bid) {
    const m = x.members[bid] || { m: 0, xp: 0, games: 0, last: 0 };
    m.m += 1; m.xp += gain; m.games += games > 0 ? games : 0; m.last = now;
    x.members[bid] = m;
    const mkeys = Object.keys(x.members);
    if (mkeys.length > 200) {
      mkeys.sort((a, b) => (x.members[a].last || 0) - (x.members[b].last || 0));
      for (const k of mkeys.slice(0, mkeys.length - 200)) delete x.members[k];
    }
  }
  /* Level-Ups */
  let need = groupNeed(x.level);
  while (x.total >= needAccum(x.level) + need && x.level < 500) {
    x.level += 1;
    events.push({ type: 'glevelup', level: x.level });
    need = groupNeed(x.level);
    const bonus = 100 + x.level * 10;
    treasuryAdd(g, bonus, `Group-Level ${x.level}`);
    events.push({ type: 'gtreasury', amount: bonus, reason: `Level ${x.level}` });
  }
  /* Goals */
  for (const e of checkGroupGoals(g, memberCount, now)) events.push(e);
  /* Achievements + Badges */
  for (const a of awardGroupAchievements(g, memberCount)) events.push({ type: 'gachievement', ...a });
  for (const b of awardGroupBadges(g)) events.push({ type: 'gbadge', ...b });
  return { xp: gain, events };
}

function needAccum(level) {
  let s = 0;
  for (let i = 0; i < level; i++) s += groupNeed(i);
  return s;
}

export function groupLevelInfo(g) {
  ensureGroupExtras(g);
  const have = g.xp.total - needAccum(g.xp.level);
  const need = groupNeed(g.xp.level);
  return { level: g.xp.level, have, need, total: g.xp.total };
}

export function topMembers(g, mode = 'xp', n = 10) {
  ensureGroupExtras(g);
  const rows = Object.entries(g.xp.members).map(([bid, m]) => ({ bid, m: m.m || 0, xp: m.xp || 0, games: m.games || 0, last: m.last || 0 }));
  const key = mode === 'messages' ? 'm' : mode === 'games' ? 'games' : 'xp';
  rows.sort((a, b) => b[key] - a[key]);
  return rows.slice(0, Math.min(25, Math.max(1, n)));
}

/* ── Goals (Daily/Weekly aus echten Zählern) ──────────────────────── */
export function goalTarget(kind, memberCount) {
  const m = Math.max(1, Number(memberCount) || 1);
  return kind === 'weekly' ? Math.max(200, m * 20) : Math.max(50, m * 5);
}

export function checkGroupGoals(g, memberCount = 0, now = Date.now()) {
  ensureGroupExtras(g);
  const out = [];
  if (g.gset.economyEnabled === false && g.gset.progressionEnabled === false) return out;
  const defs = [
    { kind: 'daily', key: dayKey(now), progress: g.xp.daily.msgs, reward: 250 },
    { kind: 'weekly', key: weekKey(now), progress: g.xp.week.xp, reward: 1000 }
  ];
  for (const d of defs) {
    const target = goalTarget(d.kind, memberCount);
    let cur = g.goals[d.kind];
    if (!cur || cur.k !== d.key) {
      cur = { k: d.key, target, progress: 0, claimed: false };
      g.goals[d.kind] = cur;
    }
    cur.target = target;
    cur.progress = d.progress;
    if (!cur.claimed && cur.progress >= cur.target) {
      cur.claimed = true;
      treasuryAdd(g, d.reward, `${d.kind}-Ziel erreicht`);
      out.push({ type: 'ggoal', kind: d.kind, target, reward: d.reward });
      if (g.gset.logsEnabled) groupAudit(g, 'system', 'goal', `${d.kind}-Ziel (${target}) erreicht, +${d.reward} Treasury`);
    }
  }
  return out;
}

/* ── Group-Achievements ───────────────────────────────────────────── */
export const GROUP_ACHIEVEMENTS = [
  { id: 'gmsg_100', emoji: '💬', name: 'Gesprächig', desc: '100 Nachrichten', metric: 'msgs', need: 100 },
  { id: 'gmsg_1k', emoji: '💬', name: 'Redselig', desc: '1.000 Nachrichten', metric: 'msgs', need: 1000 },
  { id: 'gmsg_10k', emoji: '💬', name: 'Unaufhaltsam', desc: '10.000 Nachrichten', metric: 'msgs', need: 10000 },
  { id: 'gmem_10', emoji: '👥', name: 'Runde', desc: '10 Mitglieder', metric: 'members', need: 10 },
  { id: 'gmem_50', emoji: '👥', name: 'Community', desc: '50 Mitglieder', metric: 'members', need: 50 },
  { id: 'gmem_100', emoji: '👥', name: 'Stadt', desc: '100 Mitglieder', metric: 'members', need: 100 },
  { id: 'gstreak_7', emoji: '🔥', name: 'Aktive Woche', desc: '7 Tage Aktivität', metric: 'streak', need: 7 },
  { id: 'gstreak_30', emoji: '🔥', name: 'Aktiver Monat', desc: '30 Tage Aktivität', metric: 'streak', need: 30 },
  { id: 'ggames_100', emoji: '🎮', name: 'Spielrunde', desc: '100 Spiele', metric: 'games', need: 100 },
  { id: 'ggames_1k', emoji: '🎮', name: 'Turnier', desc: '1.000 Spiele', metric: 'games', need: 1000 },
  { id: 'gxp_1k', emoji: '✨', name: 'Sammelphase', desc: '1.000 Group-XP', metric: 'xp', need: 1000 },
  { id: 'gxp_10k', emoji: '✨', name: 'XP-Jäger', desc: '10.000 Group-XP', metric: 'xp', need: 10000 },
  { id: 'gxp_100k', emoji: '✨', name: 'XP-Legende', desc: '100.000 Group-XP', metric: 'xp', need: 100000 }
];

export function awardGroupAchievements(g, memberCount = 0) {
  ensureGroupExtras(g);
  const fresh = [];
  const vals = { msgs: g.xp.msgs, members: memberCount, streak: g.xp.streak.c, games: g.xp.games, xp: g.xp.total };
  for (const a of GROUP_ACHIEVEMENTS) {
    if (!g.gach[a.id] && (vals[a.metric] || 0) >= a.need) {
      g.gach[a.id] = Date.now();
      treasuryAdd(g, 150, `Achievement ${a.name}`);
      fresh.push({ id: a.id, emoji: a.emoji, name: a.name });
    }
  }
  return fresh;
}

export const GROUP_BADGES = [
  { id: 'g_active', emoji: '🔥', name: 'Active Group', test: (g) => (g.xp.streak.c || 0) >= 7 },
  { id: 'g_competitive', emoji: '🏆', name: 'Competitive Group', test: (g) => (g.xp.games || 0) >= 100 },
  { id: 'g_love', emoji: '💜', name: 'Love Group', test: (g) => (g.xp.msgs || 0) >= 1000 && Object.keys(g.xp.members || {}).length >= 10 },
  { id: 'g_elite', emoji: '👑', name: 'Elite Group', test: (g) => (g.xp.level || 0) >= 10 }
];

export function awardGroupBadges(g) {
  ensureGroupExtras(g);
  const fresh = [];
  for (const b of GROUP_BADGES) {
    if (!g.gbadges[b.id]) {
      try {
        if (b.test(g)) { g.gbadges[b.id] = Date.now(); fresh.push({ id: b.id, emoji: b.emoji, name: b.name }); }
      } catch (e) {}
    }
  }
  return fresh;
}

/* ── Events (XP-Multiplikator-Fenster) ────────────────────────────── */
export function startGroupEvent(g, { name = '2X GROUP XP', mult = 2, minutes = 60, by = '' } = {}) {
  ensureGroupExtras(g);
  const m = Math.min(5, Math.max(1.5, Number(mult) || 2));
  const mins = Math.min(24 * 60, Math.max(5, Number(minutes) || 60));
  const ev = { id: 'ge' + Date.now().toString(36), name: String(name).slice(0, 40), mult: m, endsAt: Date.now() + mins * 60000, startedBy: String(by).slice(0, 60), startedAt: Date.now() };
  g.gevents.push(ev);
  if (g.gevents.length > 10) g.gevents.splice(0, g.gevents.length - 10);
  if (g.gset.logsEnabled) groupAudit(g, by || 'system', 'event', `${ev.name} ×${m} für ${mins} Min.`);
  return ev;
}

export function activeEvents(g, now = Date.now()) {
  ensureGroupExtras(g);
  return g.gevents.filter((e) => e && Number(e.endsAt) > now);
}

/* ── Treasury (Gruppenkasse — echte Kupfer, via economy.js bewegt) ── */
export function treasuryAdd(g, amount, reason = '') {
  ensureGroupExtras(g);
  const n = Math.floor(Number(amount) || 0);
  if (n <= 0) return g.gtreasury.balance;
  g.gtreasury.balance += n;
  g.gtreasury.log.push({ ts: Date.now(), delta: n, reason: String(reason).slice(0, 80) });
  if (g.gtreasury.log.length > 30) g.gtreasury.log.splice(0, g.gtreasury.log.length - 30);
  return g.gtreasury.balance;
}

export function treasuryTake(g, amount, reason = '') {
  ensureGroupExtras(g);
  const n = Math.floor(Number(amount) || 0);
  if (n <= 0 || g.gtreasury.balance < n) return 0;
  g.gtreasury.balance -= n;
  g.gtreasury.log.push({ ts: Date.now(), delta: -n, reason: String(reason).slice(0, 80) });
  if (g.gtreasury.log.length > 30) g.gtreasury.log.splice(0, g.gtreasury.log.length - 30);
  return n;
}

/* ── Group-Ban (lokal, Join-Enforcement im participants-Hook) ─────── */
export function gbanAdd(g, bid, { reason = '', by = '' } = {}) {
  ensureGroupExtras(g);
  if (!bid) return false;
  g.gbanned[bid] = { reason: String(reason).slice(0, 120), at: Date.now(), by: String(by).slice(0, 60) };
  if (g.gset.logsEnabled) groupAudit(g, by || '', 'gban', `${bid} (${reason || 'kein Grund'})`);
  return true;
}

export function gbanRemove(g, bid, by = '') {
  ensureGroupExtras(g);
  if (!g.gbanned[bid]) return false;
  delete g.gbanned[bid];
  if (g.gset.logsEnabled) groupAudit(g, by || '', 'gunban', String(bid));
  return true;
}

export function isGbanned(g, bid) {
  if (!g || !bid) return false;
  return !!(g.gbanned && g.gbanned[bid]);
}

/* ── Schutz-Checks (nur wenn Setting an; Zähler in-memory) ────────── */
export function checkFlood(gid, bid, now = Date.now()) {
  const k = gid + ':' + bid;
  let w = floodWin.get(k);
  if (!w) { w = { stamps: [] }; floodWin.set(k, w); }
  w.stamps = w.stamps.filter((t) => now - t < 10000);
  w.stamps.push(now);
  if (floodWin.size > 5000) floodWin.clear();
  return w.stamps.length > 5 ? { hit: true, count: w.stamps.length } : { hit: false };
}

export function checkSpam(gid, bid, text, now = Date.now()) {
  const k = gid + ':' + bid;
  const t = String(text || '').slice(0, 200);
  let w = spamWin.get(k);
  if (!w || w.resetAt < now || w.lastText !== t) {
    w = { lastText: t, count: 1, resetAt: now + 60000 };
    spamWin.set(k, w);
    if (spamWin.size > 5000) spamWin.clear();
    return { hit: false };
  }
  w.count += 1;
  return w.count >= 3 ? { hit: true, count: w.count } : { hit: false };
}

/* Eskalations-Stufe aus warnCfg lesen (w1/w2/w3 je warn|mute|kick) */
export function escalationFor(g, warnCount) {
  ensureGroupExtras(g);
  const c = g.warnCfg || {};
  const pick = warnCount <= 1 ? c.w1 : warnCount === 2 ? c.w2 : c.w3;
  return ['warn', 'mute', 'kick'].includes(pick) ? pick : 'warn';
}

/* ── Integrität ───────────────────────────────────────────────────── */
export function validateGroup(g) {
  const fixed = [], warnings = [];
  if (!g || typeof g !== 'object') return { ok: false, fixed, warnings: ['no-group'] };
  ensureGroupExtras(g);
  for (const k of ['total', 'msgs', 'games']) {
    if (!Number.isFinite(g.xp[k]) || g.xp[k] < 0) { g.xp[k] = 0; fixed.push('xp.' + k); }
  }
  if (!Number.isFinite(g.xp.level) || g.xp.level < 0) { g.xp.level = 0; fixed.push('xp.level'); }
  if (!Number.isFinite(g.gtreasury.balance) || g.gtreasury.balance < 0) { g.gtreasury.balance = 0; fixed.push('treasury'); }
  for (const [bid, m] of Object.entries(g.xp.members)) {
    if (!m || !Number.isFinite(m.m) || m.m < 0 || !Number.isFinite(m.xp) || m.xp < 0) {
      delete g.xp.members[bid];
      fixed.push('member:' + bid);
    }
  }
  return { ok: fixed.length === 0, fixed, warnings };
}

/* Öffentliche API-Sicht (keine internen IDs außer Member-BIDs für Top-Listen) */
export function groupPublic(g, meta = {}) {
  ensureGroupExtras(g);
  const li = groupLevelInfo(g);
  return {
    id: g.groupId || meta.id || '',
    name: meta.subject || g.subject || '',
    members: Number(meta.count) || 0,
    admins: Number(meta.admins) || 0,
    created: meta.creation || null,
    level: li.level, xp: li.total, xpHave: li.have, xpNeed: li.need,
    msgs: g.xp.msgs, games: g.xp.games, streak: g.xp.streak.c || 0,
    weekXp: g.xp.week.xp || 0, monthXp: g.xp.month.xp || 0,
    achievements: Object.keys(g.gach).length, badges: Object.keys(g.gbadges).length,
    treasury: g.gtreasury.balance,
    goals: g.goals, events: activeEvents(g),
    settings: g.gset
  };
}

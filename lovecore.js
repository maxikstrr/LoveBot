/* ═══════════════════════════════════════════════════════════════════════
   ❤️ L O V E B O T   L O V E   C O R E   2 . 0   (lovecore.js)
   ─────────────────────────────────────────────────────────────────────
   Das Herzstück: EIN Panel, das alle bestehenden Systeme zusammenführt
   (Ehe aus Love.js · Love-XP/Streak/Erinnerungen aus loveplus.js · neu:
   Nachrichtenzähler, Aktionen, Meilensteine, Daily Love).

   Eigener Speicher: Database/lovecore.json — es wird NICHTS an
   loveplus.json oder Database.json überschrieben, nur gelesen.

   Prinzip (wie beim Ping): nur echte Zähler. Nichts wird erfunden —
   was es noch nicht gibt, steht auf 0 und wächst mit jeder Aktion.
   ═══════════════════════════════════════════════════════════════════════ */

import fs from 'node:fs';
import path from 'node:path';

const STORE_PATH = path.join('Database', 'lovecore.json');

/* ─────────────────────────────────────────────────────────────────────
   Speicher
   ───────────────────────────────────────────────────────────────────── */

function emptyStore() {
  return { users: {}, couples: {}, meta: { created: new Date().toISOString(), updated: new Date().toISOString() } };
}

export function loadStore() {
  try {
    const raw = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
    return { ...emptyStore(), ...raw, users: raw.users || {}, couples: raw.couples || {} };
  } catch (e) {
    return emptyStore();
  }
}

export function saveStore(store) {
  try {
    fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
    store.meta = { ...(store.meta || {}), updated: new Date().toISOString() };
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
    return true;
  } catch (e) {
    return false;
  }
}

/* ─────────────────────────────────────────────────────────────────────
   Keys & Zähler
   ───────────────────────────────────────────────────────────────────── */

/** Gleicher Aufbau wie in loveplus.js, damit beide Module denselben Couple treffen. */
export function coupleKey(a, b) {
  return [String(a || ''), String(b || '')].filter(Boolean).sort().join('|');
}

/** Couple-Key aus einem Profil (eigene bid + spouseBid aus Love.js). */
export function coupleKeyForProfile(profile) {
  const bid = profile?.identity?.bid || '';
  const spouseBid = profile?.love?.spouseBid || profile?.love?.spouseKey || '';
  if (!bid || !spouseBid || profile?.love?.married !== true) return null;
  const clean = (x) => String(x || '').split('jid')[0] || String(x || '');
  return coupleKey(clean(bid), clean(spouseBid));
}

/** Alle Befehle, die als „Liebesnachricht“ zählen. */
export const LOVE_ACTIONS = {
  kiss: { emoji: '💋', label: 'Küsse' },
  hug: { emoji: '🤗', label: 'Umarmungen' },
  slap: { emoji: '🖐️', label: 'Ohrfeigen' },
  compliment: { emoji: '🌹', label: 'Komplimente' },
  flirt: { emoji: '😘', label: 'Geflirtet' },
  anmachen: { emoji: '😏', label: 'Anmachen' },
  confess: { emoji: '💌', label: 'Geständnisse' },
  confesslove: { emoji: '💖', label: 'Liebesgeständnisse' },
  romantic: { emoji: '🌹', label: 'Romantik' },
  goodmorning: { emoji: '🌅', label: 'Guten Morgen' },
  goodnight: { emoji: '🌙', label: 'Gute Nacht' },
  gift: { emoji: '🎁', label: 'Geschenke' },
  letter: { emoji: '💌', label: 'Liebesbriefe' },
  dateidee: { emoji: '🍽️', label: 'Date-Ideen' }
};

export function isLoveAction(command) {
  return Object.prototype.hasOwnProperty.call(LOVE_ACTIONS, String(command || '').toLowerCase());
}

/**
 * Zählt eine Liebes-Aktion (Nutzer + Paar).
 * @returns {{user:object, couple:object|null}}
 */
export function bumpLoveAction({ bid = '', coupleKey: ck = null, kind = '', amount = 1 }) {
  if (!bid) return { user: null, couple: null };
  const k = String(kind || '').toLowerCase();
  const store = loadStore();

  const u = (store.users[bid] ||= { actions: {}, loveMessages: 0, daily: { date: '', kind: '', streak: 0, total: 0 } });
  u.actions ||= {};
  u.loveMessages = (Number(u.loveMessages) || 0) + amount;
  if (LOVE_ACTIONS[k]) u.actions[k] = (Number(u.actions[k]) || 0) + amount;

  let couple = null;
  if (ck && isLoveAction(k)) {
    const c = (store.couples[ck] ||= { actions: {}, loveMessages: 0, breakups: 0, unlocked: {} });
    c.actions ||= {};
    c.loveMessages = (Number(c.loveMessages) || 0) + amount;
    c.actions[k] = (Number(c.actions[k]) || 0) + amount;
    couple = c;
  }

  saveStore(store);
  return { user: u, couple };
}

/** Trennung zählen (aus dem $divorce-Flow). */
export function countBreakup(ck) {
  if (!ck) return null;
  const store = loadStore();
  const c = (store.couples[ck] ||= { actions: {}, loveMessages: 0, breakups: 0, unlocked: {} });
  c.breakups = (Number(c.breakups) || 0) + 1;
  saveStore(store);
  return c;
}

/** Rohdaten für ein Paar / einen Nutzer. */
export function getCore(bid = '', ck = null) {
  const store = loadStore();
  return {
    user: store.users[bid] || { actions: {}, loveMessages: 0, daily: {} },
    couple: ck ? (store.couples[ck] || null) : null
  };
}

/* ─────────────────────────────────────────────────────────────────────
   Meilensteine
   ───────────────────────────────────────────────────────────────────── */

export const MILESTONES = [
  { id: 'd7', kind: 'days', target: 7, label: '7 Tage zusammen' },
  { id: 'd30', kind: 'days', target: 30, label: '30 Tage zusammen' },
  { id: 'm100', kind: 'messages', target: 100, label: '100 Liebesnachrichten' },
  { id: 's7', kind: 'streak', target: 7, label: '7 Tage Streak' },
  { id: 'd100', kind: 'days', target: 100, label: '100 Tage zusammen' },
  { id: 'm500', kind: 'messages', target: 500, label: '500 Liebesnachrichten' },
  { id: 's30', kind: 'streak', target: 30, label: '30 Tage Streak' },
  { id: 'd365', kind: 'days', target: 365, label: '365 Tage zusammen' },
  { id: 'm1000', kind: 'messages', target: 1000, label: '1.000 Liebesnachrichten' },
  { id: 'd1000', kind: 'days', target: 1000, label: '1.000 Tage zusammen' }
];

export function milestoneState({ days = 0, messages = 0, streak = 0 } = {}) {
  const values = { days, messages, streak };
  return MILESTONES.map((m) => {
    const cur = values[m.kind] ?? 0;
    return {
      ...m,
      current: cur,
      done: cur >= m.target,
      remaining: Math.max(0, m.target - cur)
    };
  });
}

/* ─────────────────────────────────────────────────────────────────────
   Anzeige-Helfer
   ───────────────────────────────────────────────────────────────────── */

const de = (n) => Number(n || 0).toLocaleString('de-DE');

function bar(percent, len = 12) {
  const filled = Math.max(0, Math.min(len, Math.round((Number(percent) || 0) / 100 * len)));
  return '▰'.repeat(filled) + '▱'.repeat(Math.max(0, len - filled));
}

/** Liebeslevel = Couple-Level aus loveplus (Level L braucht 100·L² Love-XP). */
export function loveLevelFrom(xp = 0) {
  const level = Math.floor(Math.sqrt(Math.max(0, Number(xp) || 0) / 100));
  const cur = 100 * level * level;
  const next = 100 * (level + 1) * (level + 1);
  const pct = Math.max(0, Math.min(100, Math.round(((Number(xp) - cur) / Math.max(1, next - cur)) * 100)));
  return { level, pct, cur, next, toNext: Math.max(0, next - Number(xp)) };
}

function daysBetween(iso) {
  if (!iso) return 0;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

/* ─────────────────────────────────────────────────────────────────────
   ❤️ $love — das Beziehungs-Panel
   ───────────────────────────────────────────────────────────────────── */

export function renderLoveProfile({ profile = {}, snapshot = null, pref = '$', privateChat = false } = {}) {
  const love = snapshot?.love || {};
  const bid = profile?.identity?.bid || '';
  const ck = love.couple?.key || coupleKeyForProfile(profile);
  const core = getCore(bid, ck);

  const head = [
    '╔══════════════════════════════╗',
    '║   ❤️  L O V E   P R O F I L   ║',
    '╚══════════════════════════════╝',
    ''
  ];

  /* ── Single ─────────────────────────────────────────────────────── */
  if (!love.married) {
    const sent = core.user?.loveMessages || 0;
    const top = Object.entries(core.user?.actions || {}).sort((a, b) => b[1] - a[1]).slice(0, 3);
    return [
      ...head,
      '🕊️ *Du bist noch Single*',
      '',
      `💌 Liebesnachrichten gesendet: *${de(sent)}*`,
      top.length
        ? '🎯 Meiste Aktionen: ' + top.map(([k, n]) => `${LOVE_ACTIONS[k]?.emoji || '·'} ${de(n)}`).join(' · ')
        : '🎯 Noch keine Aktionen — schreib jemandem was Nettes 💌',
      '',
      `💡 *${pref}marry @user* — oder erst mal *${pref}dailylove* für deinen Tages-Impuls.`,
      `📖 Alle Befehle: *${pref}help*`
    ].join('\n');
  }

  /* ── Paar ───────────────────────────────────────────────────────── */
  const partnerName = love.spouseName || 'Unbekannt';
  const ownName = profile?.registration?.name || profile?.identity?.username || 'Du';
  const days = love.daysTogether ?? daysBetween(love.marriedAt);
  const c = love.couple || { loveXp: 0, level: 0, streak: 0, memories: 0 };
  const lv = loveLevelFrom(c.loveXp);
  const messages = core.couple?.loveMessages || 0;
  const breakups = core.couple?.breakups || 0;
  const actions = core.couple?.actions || {};
  const totalActions = Object.values(actions).reduce((a, b) => a + Number(b || 0), 0);
  const topActions = Object.entries(actions).sort((a, b) => b[1] - a[1]).slice(0, 3);

  const ms = milestoneState({ days, messages, streak: c.streak || 0 });
  const doneMs = ms.filter((m) => m.done);
  const nextMs = ms.filter((m) => !m.done).slice(0, 3);

  const lines = [
    ...head,
    `*${ownName}* ❤️ *${partnerName}*`,
    '',
    `💕 *Liebeslevel ${lv.level}*`,
    `   \`${bar(lv.pct)}\` ${lv.pct}%`,
    `   ${de(c.loveXp)} Love-XP · noch ${de(lv.toNext)} bis Level ${lv.level + 1}`,
    '',
    `🔥 Streak: *${de(c.streak)} Tag(e)*`,
    `💌 Liebesnachrichten: *${de(messages)}*`,
    `💍 Zusammen seit: *${de(days)} Tag(en)*${love.marriedAt ? ` _(seit ${new Date(love.marriedAt).toLocaleDateString('de-DE')})_` : ''}`,
    `✨ Erinnerungen: ${de(c.memories)} · 💒 Ehen: ${de(love.marriages || 1)} · 💔 Trennungen: ${de(breakups)}`,
    '',
    '🎯 *GEMEINSAME AKTIONEN*'
  ];

  lines.push(totalActions
    ? `   ${de(totalActions)} insgesamt — ` + topActions.map(([k, n]) => `${LOVE_ACTIONS[k]?.emoji || '·'} ${de(n)}`).join(' · ')
    : '   Noch keine — *' + pref + 'kiss*, *' + pref + 'hug*, *' + pref + 'compliment* zählen alle mit 💗');

  lines.push('', '🏆 *MEILENSTEINE*');
  if (doneMs.length) {
    for (const m of doneMs.slice(-6)) lines.push(`✅ ${m.label}`);
  } else {
    lines.push('   Noch keine — die ersten 7 Tage sind die leichtesten 💪');
  }
  for (const m of nextMs) {
    const unit = m.kind === 'days' ? 'Tage' : m.kind === 'streak' ? 'Tage Streak' : 'Nachrichten';
    lines.push(`🔒 ${m.label} _(noch ${de(m.remaining)} ${unit})_`);
  }

  lines.push('', `💡 Streak halten mit *${pref}kiss* · *${pref}hug* · *${pref}compliment* · täglich *${pref}lovebonus*`);
  if (!privateChat) lines.push('🔒 _Stadt/Alter aus Datenschutzgründen hier ausgeblendet — im Privatchat sichtbar._');

  return lines.join('\n');
}

/* ─────────────────────────────────────────────────────────────────────
   💞 $partner — Kurzversion
   ───────────────────────────────────────────────────────────────────── */

export function renderPartner({ profile = {}, snapshot = null, pref = '$' } = {}) {
  const love = snapshot?.love || {};
  if (!love.married) {
    return '> 💞 *KEIN PARTNER*\n\nDu bist aktuell Single. 💌\nMit *' + pref + 'marry @user* kannst du jemanden fragen.';
  }
  const c = love.couple || {};
  const lv = loveLevelFrom(c.loveXp || 0);
  const days = love.daysTogether ?? daysBetween(love.marriedAt);
  const ck = c.key || coupleKeyForProfile(profile);
  const core = getCore(profile?.identity?.bid || '', ck);

  return [
    '> 💞 *DEIN PARTNER*',
    '',
    `❤️ *${love.spouseName || 'Unbekannt'}*`,
    `💕 Liebeslevel ${lv.level} (${lv.pct}% bis Level ${lv.level + 1})`,
    `🔥 Streak: ${de(c.streak || 0)} Tag(e)`,
    `💌 Nachrichten: ${de(core.couple?.loveMessages || 0)}`,
    `💍 Zusammen seit ${de(days)} Tag(en)`,
    '',
    `💡 Details: *${pref}love* · Jahrestag: *${pref}anniversary*`
  ].join('\n');
}

/* ─────────────────────────────────────────────────────────────────────
   🌹 $dailylove — täglicher Impuls
   ───────────────────────────────────────────────────────────────────── */

const DAILY = {
  tipp: [
    'Manchmal braucht Liebe keine großen Worte — eine kleine Aufmerksamkeit reicht.',
    'Frag heute mal, wie der Tag wirklich war. Und hör zu, ohne zu antworten.',
    'Ein „Ich denk an dich“ um 15:47 Uhr wirkt stärker als jeden Morgen.',
    'Streit ist kein Gegner der Liebe — Schweigen ist es.',
    'Erinnere dich an den Grund, warum ihr euch gewählt habt.',
    'Liebe wächst nicht durch Geschenke, sondern durch Wiederholung.',
    'Sag heute etwas, das du sonst nur denkst.',
    'Gemeinsame Rituale schlagen große Gesten.',
    'Nähe braucht keine Zeit, sie braucht Aufmerksamkeit.',
    'Wer zuhört, gewinnt. Immer.'
  ],
  compliment: [
    'Du hast ein Lachen, das andere ansteckt. ❤️',
    'Du bist viel stärker, als du selbst glaubst.',
    'Mit dir fühlt sich Zuhause nicht nach Ort an, sondern nach Mensch.',
    'Du machst die Welt ein bisschen weniger laut.',
    'Du bist jemand, dem man gerne zuhört.',
    'Deine Art zu lieben ist selten. Behalt sie.',
    'Du bist schön — auch und gerade, wenn du müde bist.',
    'Du schaffst Dinge, vor denen andere weglaufen.',
    'Du bist der Grund, warum jemand heute lächelt.',
    'Du bist genug. Genau so.'
  ],
  challenge: [
    'Schreib deinem Partner eine Nachricht, die nur aus einem Emoji besteht — er/sie muss es deuten.',
    'Nenne drei Dinge, die du heute an deinem Partner bewundert hast.',
    'Frag: „Was kann ich heute für dich tun?“ — und tu es dann.',
    'Schick ein Lied, das beschreibt, wie du dich heute fühlst.',
    'Erzähl von dem Moment, in dem du gemerkt hast: Das ist es.',
    'Mach ein Foto von etwas, das dich an deinen Partner erinnert.',
    'Sag heute „Danke“ für etwas, das du sonst als selbstverständlich nimmst.',
    'Plan ein Date für nächste Woche — und überlass die Wahl dem anderen.',
    'Schreib auf, was du in 5 Jahren gemeinsam machen willst.',
    'Frag nach dem schönsten Moment dieser Woche.'
  ],
  quote: [
    '„Liebe ist nicht das, was man erwartet zu bekommen, sondern das, was man bereit ist zu geben.“ — Katharine Hepburn',
    '„Wir lieben nicht, weil wir jemanden finden, der perfekt ist, sondern weil wir lernen, das Unperfekte zu sehen.“ — Sam Keen',
    '„Das größte Glück ist, geliebt zu werden, ohne es erzwingen zu müssen.“ — unbekannt',
    '„Liebe besteht aus zwei Einsamkeiten, die sich schützen und begrenzen.“ — Rainer Maria Rilke',
    '„Man sieht nur mit dem Herzen gut.“ — Antoine de Saint-Exupéry',
    '„Nähe entsteht, wenn zwei Menschen aufhören, sich zu beweisen.“ — unbekannt',
    '„Die Liebe ist die einzige Freiheit, die keine Grenzen kennt.“ — unbekannt',
    '„Zusammen sein heißt nicht, gleich zu sein.“ — unbekannt',
    '„Vertrauen ist das Papier, auf dem Liebe schreibt.“ — unbekannt',
    '„Jede Liebe braucht Pflege. Auch die, die von selbst kam.“ — unbekannt'
  ]
};

const KINDS = [
  { id: 'tipp', emoji: '❤️', title: 'Dein heutiger Love-Tipp' },
  { id: 'compliment', emoji: '🌹', title: 'Dein heutiges Kompliment' },
  { id: 'challenge', emoji: '🎯', title: 'Deine heutige Challenge' },
  { id: 'quote', emoji: '💬', title: 'Dein heutiges Zitat' }
];

function todayKey(d = new Date()) {
  return d.toISOString().slice(0, 10); /* UTC-Tag, stabil & ohne TZ-Probleme */
}

function hash(str = '') {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * Tagesimpuls — pro Kalendertag genau einer, stabil (gleicher Tag = gleicher Text).
 * @returns {{ok:boolean, kind:object, text:string, streak:number, reward:object, nextInMs:number}}
 */
export function claimDailyLove(bid = '') {
  if (!bid) return { ok: false, error: 'kein Profil' };
  const store = loadStore();
  const u = (store.users[bid] ||= { actions: {}, loveMessages: 0, daily: { date: '', kind: '', streak: 0, total: 0 } });
  u.daily ||= { date: '', kind: '', streak: 0, total: 0 };

  const today = todayKey();
  const yesterday = todayKey(new Date(Date.now() - 86_400_000));

  if (u.daily.date === today) {
    const kind = KINDS.find((k) => k.id === u.daily.kind) || KINDS[0];
    const pool = DAILY[kind.id];
    const text = pool[hash(bid + today) % pool.length];
    const now = new Date();
    const next = new Date(Date.now() + 86_400_000);
    const nextUtcMidnight = Date.UTC(next.getUTCFullYear(), next.getUTCMonth(), next.getUTCDate()) - now.getTime();
    return { ok: false, kind, text, streak: u.daily.streak || 0, reward: { xp: 0, copper: 0 }, nextInMs: Math.max(0, nextUtcMidnight), already: true };
  }

  /* Streak: gestern geholt? weiterzählen, sonst neu starten */
  u.daily.streak = u.daily.date === yesterday ? (Number(u.daily.streak) || 0) + 1 : 1;
  u.daily.date = today;
  u.daily.total = (Number(u.daily.total) || 0) + 1;

  const kind = KINDS[hash(bid + 'kind' + today) % KINDS.length];
  const pool = DAILY[kind.id];
  const text = pool[hash(bid + today) % pool.length];
  u.daily.kind = kind.id;

  saveStore(store);

  return {
    ok: true,
    kind,
    text,
    streak: u.daily.streak,
    reward: { xp: 25, copper: 50 },
    nextInMs: 86_400_000,
    total: u.daily.total
  };
}

export function renderDailyLove(claim, { pref = '$' } = {}) {
  const head = [
    '╔══════════════════════════════╗',
    '║   🌹  D A I L Y   L O V E    ║',
    '╚══════════════════════════════╝',
    ''
  ];
  if (!claim) return [...head, '❌ Konnte deinen Tagesimpuls nicht laden.'].join('\n');

  const body = [
    `${claim.kind.emoji} *${claim.kind.title}*`,
    '',
    `„${claim.text}“`,
    '',
    `🔥 Serie: *${claim.streak} Tag(e)*${claim.total ? ` · insgesamt ${de(claim.total)}` : ''}`
  ];

  if (claim.ok) {
    body.push(`✨ *+${claim.reward.xp} XP* · *+${claim.reward.copper} 🤎 Kupfer*`);
    body.push('', `💡 Morgen wieder: *${pref}dailylove*`);
  } else {
    const hours = Math.floor((claim.nextInMs || 0) / 3_600_000);
    const mins = Math.round(((claim.nextInMs || 0) % 3_600_000) / 60_000);
    body.push(`⏳ _Heute schon abgeholt — nächster Impuls in ca. ${hours} Std. ${mins} Min (Tag wechselt 00:00 UTC)._`);
  }
  return [...head, ...body].join('\n');
}

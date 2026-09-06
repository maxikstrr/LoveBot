/* ═══════════════════════════════════════════════════════════════════════
   💖  L O V E P L U S  —  Erweiterungsmodul für LoveBot
   ───────────────────────────────────────────────────────────────────────
   Beziehungssystem · Haustiere · Economy 2.0 (Shop/Geschenke) ·
   Achievements · Streaks · Liebesbriefe · Mini-Games

   Das Modul ist bewusst LOSGEKOPPELT vom Bot-Kern:
   • eigener Speicher:  Database/loveplus.json
   • alle Bot-Funktionen kommen per ctx (keine Imports aus Love.js)
   • Anschluss in Love.js:  case-default → handleLovePlus(ctx)
   ═══════════════════════════════════════════════════════════════════ */

import fs from 'node:fs';
import path from 'node:path';

/* ---------- Speicher -------------------------------------------------- */
const STORE_PATH = path.join('Database', 'loveplus.json');

function loadStore() {
  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  } catch (e) {
    return { users: {}, couples: {}, games: {} };
  }
}

function saveStore(store) {
  try {
    fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
  } catch (e) {
    console.error('[loveplus] Speicherfehler:', e?.message || e);
  }
}

function user(store, uid) {
  if (!store.users[uid]) {
    store.users[uid] = {
      achievements: {},        /* id → timestamp */
      counters: {},            /* giftsSent, lettersSent, hangmanWins, … */
      lovebonus: { lastAt: 0, streak: 0 },
      pet: null,
      inventory: {},           /* itemId → Anzahl */
      cooldowns: {}            /* action → timestamp */
    };
  }
  const u = store.users[uid];
  u.achievements ||= {}; u.counters ||= {}; u.lovebonus ||= { lastAt: 0, streak: 0 };
  u.inventory ||= {}; u.cooldowns ||= {};
  return u;
}

/* ---------- Kataloge --------------------------------------------------- */
const SHOP_ITEMS = [
  { id: 'rose',      emoji: '🌹', name: 'Rose',           price: 15,  desc: 'Der Klassiker.' },
  { id: 'letter',    emoji: '💌', name: 'Liebesbrief',    price: 20,  desc: 'Zum Verlieben.' },
  { id: 'choco',     emoji: '🍫', name: 'Schokolade',     price: 25,  desc: 'Süß wie du.' },
  { id: 'teddy',     emoji: '🧸', name: 'Teddybär',       price: 60,  desc: 'Zum Knuddeln.' },
  { id: 'cake',      emoji: '🎂', name: 'Kuchen',         price: 80,  desc: 'Zum Feiern.' },
  { id: 'star',      emoji: '⭐', name: 'Stern',          price: 150, desc: 'Vom Himmel geholt.' },
  { id: 'moon',      emoji: '🌙', name: 'Mond',           price: 300, desc: 'Für Romantiker.' },
  { id: 'ring',      emoji: '💍', name: 'Diamantring',    price: 999, desc: 'Das große Ganze.' }
];

const PET_TYPES = ['🐶', '🐱', '🐰', '🦊', '🐻', '🐼', '🐹', '🦁', '🐨', '🐥'];
const PET_NAMES_HINT = ['Luna', 'Milo', 'Bella', 'Simba', 'Nala', 'Kira', 'Balu', 'Coco'];

const ACHIEVEMENTS = [
  { id: 'first_pet',    emoji: '🐾', name: 'Tierfreund',          desc: 'Haustier adoptiert.' },
  { id: 'pet_lv5',      emoji: '🐕', name: 'Beste Freunde',       desc: 'Haustier Level 5 erreicht.' },
  { id: 'first_gift',   emoji: '🎁', name: 'First Gift',          desc: 'Erstes Geschenk verschenkt.' },
  { id: 'gifts_10',     emoji: '🌹', name: 'Romantiker',          desc: '10 Geschenke verschenkt.' },
  { id: 'first_letter', emoji: '💌', name: 'Poet',                desc: 'Ersten Liebesbrief geschrieben.' },
  { id: 'married',      emoji: '💍', name: 'Just Married',        desc: 'Verheiratet (über $marry).' },
  { id: 'couple_7',     emoji: '❤️', name: 'Eine Woche Liebe',    desc: '7 Tage Couple-Streak.' },
  { id: 'streak_7',     emoji: '🔥', name: 'Eine Woche dabei',    desc: '7 Tage Login-Streak.' },
  { id: 'streak_30',    emoji: '☄️', name: 'Unaufhaltsam',        desc: '30 Tage Login-Streak.' },
  { id: 'rich_1000',    emoji: '💎', name: 'Kupferkönig',         desc: '1.000 Kupfer besessen.' },
  { id: 'hangman_win',  emoji: '🪢', name: 'Worträtsler',         desc: 'Galgenmännchen gewonnen.' },
  { id: 'riddle_ok',    emoji: '🧠', name: 'Denker',              desc: 'Rätsel gelöst.' },
  { id: 'big_spender',  emoji: '💸', name: 'Big Spender',         desc: '500+ Kupfer im Shop ausgegeben.' }
];

const RIDDLES = [
  { q: 'Ich habe Städte, aber keine Häuser. Wälder, aber keine Bäume. Wasser, aber keinen Fisch. Was bin ich?', a: 'karte' },
  { q: 'Je mehr du von mir nimmst, desto größer werde ich. Was bin ich?', a: 'loch' },
  { q: 'Ich bin leicht wie eine Feder, doch selbst die Stärksten halten mich nicht lange. Was bin ich?', a: 'atem' },
  { q: 'Was hat eine Zunge, spricht aber nie?', a: 'schuh' },
  { q: 'Was wird nasser, je mehr es trocknet?', a: 'handtuch' },
  { q: 'Ich folge dir den ganzen Tag, verschwinde aber in der Nacht. Was bin ich?', a: 'schatten' },
  { q: 'Was hat 13 Herzen, ist aber weder Mensch noch Tier?', a: 'kartenspiel' },
  { q: 'Was gehört dir, aber andere benutzen es öfter als du?', a: 'name' },
  { q: 'Was geht bergauf und bergtal runter, bleibt aber an seinem Platz?', a: 'treppe' },
  { q: 'Ich habe Hände, kann aber nicht klatschen. Was bin ich?', a: 'uhr' },
  { q: 'Was kann durch Glas gehen, ohne es zu zerbrechen?', a: 'licht' },
  { q: 'Was hat viele Zähne, kann aber nicht beißen?', a: 'kamm' }
];

const HANGMAN_WORDS = ['HERZEN', 'LIEBE', 'KUSSEN', 'ROMANTIK', 'SCHMETTERLING', 'VALENTIN', 'BLUMEN', 'UMARMUNG', 'VERLIEBT', 'GLUCKWUNSCH', 'SCHNULZE', 'PORTRAET', 'MONDSCHEIN', 'ROSEN', 'FLIRTEN', 'VERLOBUNG', 'HOCHZEIT', 'PAARLAUF', 'KENNENLERNEN', 'SEHNSUCHT'];

const WOULDYOU = [
  ['❤️ Für immer_single bleiben', '💍 jemanden heiraten, den du nicht liebst'],
  ['🤑 1.000.000 Kupfer', '😍 dein Crush schreibt dir zuerst'],
  ['🍕 Pizza mit Ananas teilen', '🍫 Schokolade allein essen'],
  ['🎤 vor der Gruppe singen', '💬 deinem Schwarm eine Sprachnachricht schicken'],
  ['😴 1 Jahr kein $daily', '💸 einmal alles verlieren'],
  ['🦄 Einhorn als Haustier', '🐉 Drachen als Haustier'],
  ['📞 3 Uhr nachts angerufen werden', '📭 nie wieder Liebesbriefe bekommen'],
  ['🧸 Teddybär sammeln', '🌹 Rosen pflanzen']
];

const HOROSKOP_TRAITS = {
  'widdner': 'Widder', 'stier': 'Stier', 'zwillinge': 'Zwillinge', 'krebs': 'Krebs',
  'loewe': 'Löwe', 'jungfrau': 'Jungfrau', 'waage': 'Waage', 'skorpion': 'Skorpion',
  'schuetze': 'Schütze', 'steinbock': 'Steinbock', 'wassermann': 'Wassermann', 'fische': 'Fische'
};
const HORO_LIEBE = ['Eine alte Nummer schreibt dir plötzlich. 📱', 'Heute klickt es beim Smalltalk. 💬', 'Dein Lächeln wirkt heute Wunder. 😊', 'Zuhörer sein zahlt sich aus. 🎧', 'Ein Kompliment öffnet eine Tür. 🚪', 'Mut gefragt:frag zuerst! 💪'];
const HORO_GLUECK = ['Glückszahl: 7', 'Glückszahl: 3', 'Glückszahl: 21', 'Glückszahl: 42', 'Glücksfarbe: Rosa 🌸', 'Glücksfarbe: Cyan 🩵'];
const HORO_TIPP = ['Schick heute ein Kompliment.', 'Spar dein Kupfer für etwas Großes.', 'Ein $daily jetzt wäre schlau. 🔥', 'Hör heute auf dein Herz.', 'Wag heute den ersten Schritt.', 'Ruh dich aus, Liebe braucht Energie.'];

const LETTERS = {
  romantisch: [
    'Manchmal gibt es Menschen, bei denen ein normales „Danke“ einfach nicht reicht. Bei dir reicht nicht mal ein ganzer Brief — aber ich fange trotzdem an.',
    'Wenn ich an dich denke, wird selbst ein Montag lieblich. Du bist der Grund, warum ich mein Handy auf lautlos nie wirklich lautlos mag.',
    'Die Sterne haben Konkurrenz bekommen, seit ich dich kenne. Und ehrlich? Sie verlieren.'
  ],
  suess: [
    'Bist du ein Taschenrechner? Weil du mein Leben irgendwie immer aufgehen lässt. 💜',
    'Wenn Umarmungen Währung wären, wärst du längst Millionär — ich zahl nämlich immer ein.',
    'Du + ich + ein Sofa = meine Lieblingsformel. Das ist Mathematik, da kann man nix machen.'
  ],
  lustig: [
    'Ich wollte dir eigentlich einen coolen Brief schreiben, aber mein Herz tippt schneller als mein Verstand. Bitte um Verständnis (und Kekse).',
    'Kurze Umfrage: Wie toll bist du? a) sehr b) extrem c) ja. Richtige Antwort: alle drei.',
    'Liebe ist, wenn man auch um 3 Uhr nachts für dich aufsteht. Ich hab heute Nacht NICHT aufgestanden, aber ich hatte dich geträumt — zählt auch.'
  ]
};

/* ---------- Helfer ----------------------------------------------------- */
const LINE = '━━━━━━━━━━━━━━━━━━━━';
const DAY_MS = 86400000;

function todayKey(ts = Date.now()) {
  const d = new Date(ts);
  return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
}
function yesterdayKey(ts = Date.now()) { return todayKey(ts - DAY_MS); }

function coupleKey(a, b) { return [String(a), String(b)].sort().join('|'); }

function coupleLevel(xp) { return Math.floor(Math.sqrt(Math.max(0, xp) / 100)); }
function coupleXpForLevel(lv) { return lv * lv * 100; }

function bar(pct, len = 12) {
  const filled = Math.max(0, Math.min(len, Math.round((pct / 100) * len)));
  return '█'.repeat(filled) + '░'.repeat(len - filled);
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function normWord(s) {
  return String(s || '').toLowerCase().trim()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]/g, '');
}

function itemById(id) { return SHOP_ITEMS.find((i) => i.id === String(id).toLowerCase()); }

function petApplyDecay(pet) {
  const now = Date.now();
  const hours = Math.max(0, (now - (pet.lastTick || now)) / 3600000);
  if (hours > 0) {
    pet.hunger = Math.max(0, Math.round(pet.hunger - hours * 4));
    pet.love = Math.max(0, Math.round(pet.love - hours * 2.5));
    pet.mood = Math.max(0, Math.round(pet.mood - hours * 3));
    pet.energy = Math.min(100, Math.round(pet.energy + hours * 5)); /* Schlaf regeneriert */
    pet.lastTick = now;
  }
  return pet;
}

function petStatusWord(pet) {
  const avg = (pet.hunger + pet.love + pet.mood) / 3;
  if (pet.hunger < 20) return ' starving 🍖 SOFORT FÜTTERN!';
  if (avg >= 80) return 'strahlend glücklich 😍';
  if (avg >= 60) return 'glücklich 😊';
  if (avg >= 35) return 'okay 🙂';
  return 'traurig 😔 — es braucht Zuwendung!';
}

/* ---------- Achievements ---------------------------------------------- */
function unlock(store, uid, id, unlockedNow) {
  const u = user(store, uid);
  if (u.achievements[id]) return;
  const a = ACHIEVEMENTS.find((x) => x.id === id);
  if (!a) return;
  u.achievements[id] = Date.now();
  unlockedNow.push(a);
}

function checkAchievements(store, uid, profile, events = []) {
  const u = user(store, uid);
  const now = [];
  for (const ev of events) unlock(store, uid, ev, now);
  if (profile?.love?.married === true) unlock(store, uid, 'married', now);
  if ((profile?.wallet?.copper || 0) >= 1000) unlock(store, uid, 'rich_1000', now);
  if ((u.counters.giftsSent || 0) >= 10) unlock(store, uid, 'gifts_10', now);
  if ((u.lovebonus.streak || 0) >= 7) unlock(store, uid, 'streak_7', now);
  if ((u.lovebonus.streak || 0) >= 30) unlock(store, uid, 'streak_30', now);
  if (u.pet && u.pet.level >= 5) unlock(store, uid, 'pet_lv5', now);
  if ((u.counters.shopSpent || 0) >= 500) unlock(store, uid, 'big_spender', now);
  return now;
}

function achievementPopup(list) {
  if (!list.length) return '';
  return list.map((a) =>
    '🏆 *ACHIEVEMENT UNLOCKED!*\n' +
    a.emoji + ' *' + a.name + '*\n' +
    '_' + a.desc + '_'
  ).join('\n\n' + LINE + '\n\n');
}

/* ---------- Befehle ---------------------------------------------------- */
const COMMANDS = new Map();

function cmd(names, fn) { for (const n of names.split(' ')) COMMANDS.set(n, fn); }

/* ── 💖 Beziehung ────────────────────────────────────────────────────── */
cmd('relationship beziehung partner couple paare ehe', async (ctx, store) => {
  const { userProfile, pref, send, uid, name } = ctx;
  const love = userProfile?.love;

  if (!love || love.married !== true) {
    await send(
      '> 🕊️ *SINGLE-STATUS*\n\n' +
      'Du bist noch nicht verheiratet — deine große Liebe wartet!\n\n' +
      '❥ *' + pref + 'marry @user* — Antrag stellen\n' +
      '❥ *' + pref + 'ship @user* — Love-o-Meter\n' +
      '❥ *' + pref + 'lovebonus* — trotzdem täglicher Bonus 🔥'
    );
    return true;
  }

  const myKey = ctx.myKey;
  const ck = coupleKey(myKey, love.spouseKey || 'x');
  const c = store.couples[ck] ||= { loveXp: 0, streak: 0, lastDay: '', memories: 0, n1: name, n2: love.spouseName || '?' };

  const since = love.marriedAt ? new Date(love.marriedAt) : null;
  const days = since ? Math.max(0, Math.floor((Date.now() - since.getTime()) / DAY_MS)) : 0;
  const lv = coupleLevel(c.loveXp);
  const nextLvXp = coupleXpForLevel(lv + 1);
  const curLvXp = coupleXpForLevel(lv);
  const pct = Math.min(100, Math.round(((c.loveXp - curLvXp) / Math.max(1, nextLvXp - curLvXp)) * 100));
  const treue = Math.min(100, 55 + (c.streak || 0) * 2 + lv * 3);

  /* nächster Jahrestag: nächste runde 100-Tage-/Jahres-Marke */
  const marks = [100, 200, 300, 365, 500, 700, 1000, 1500, 2000, 2500, 3000, 3650];
  const nextMark = marks.find((m) => m > days) ?? (Math.ceil((days + 1) / 1000) * 1000);

  await send(
    '> ❤️ *EURE BEZIEHUNG*\n\n' +
    '💑 *' + name + '* 💞 *' + (love.spouseName || '?') + '*\n' +
    '📅 *Zusammen seit:* ' + (since ? since.toLocaleDateString('de-DE') : '?') + ' _(Tag ' + (days + 1) + ')_\n' +
    '💯 *Gemeinsame Tage:* ' + days + '\n\n' +
    '💗 *Love-XP:* ' + c.loveXp.toLocaleString('de-DE') + '\n' +
    '⭐ *Couple-Level:* ' + lv + '\n' +
    '[' + bar(pct) + '] ' + pct + '% zum Level ' + (lv + 1) + '\n\n' +
    '🔥 *Couple-Streak:* ' + (c.streak || 0) + ' Tag' + ((c.streak || 0) === 1 ? '' : 'e') + '\n' +
    '🤝 *Treue:* ' + Math.min(100, treue) + '%\n' +
    '📸 *Gemeinsame Erinnerungen:* ' + (c.memories || 0) + '\n\n' +
    '🎉 *Nächster Jahrestag:* Tag ' + nextMark + ' _(noch ' + (nextMark - days) + ' Tage)_\n\n' +
    LINE + '\n' +
    '💡 *' + pref + 'lovebonus* — täglicher Couple-Bonus (+Love-XP)\n' +
    '🏆 *' + pref + 'coupletop* — die stärksten Paare'
  );
  return true;
});

cmd('lovebonus hearts', async (ctx, store) => {
  const { userProfile, send, uid, name } = ctx;
  const u = user(store, uid);
  const today = todayKey();

  if (u.lovebonus.lastAt === today) {
    await send('> ⏳ *Dein Love-Bonus ist schon geholt!*\n\nKomm morgen wieder — der Streak zählt weiter. 🔥');
    return true;
  }

  /* Streak pflegen */
  u.lovebonus.streak = (u.lovebonus.lastAt === yesterdayKey()) ? (u.lovebonus.streak || 0) + 1 : 1;
  u.lovebonus.lastAt = today;

  const love = userProfile?.love;
  const married = love?.married === true;
  let copper;
  let lines;

  if (married) {
    copper = 30 + Math.min(70, (u.lovebonus.streak || 0) * 10);
    const ck = coupleKey(ctx.myKey, love.spouseKey || 'x');
    const c = store.couples[ck] ||= { loveXp: 0, streak: 0, lastDay: '', memories: 0, n1: name, n2: love.spouseName || '?' };
    c.loveXp += 40;
    c.n1 = name; c.n2 = love.spouseName || c.n2;
    if (c.lastDay !== today) {
      c.streak = (c.lastDay === yesterdayKey()) ? (c.streak || 0) + 1 : 1;
      c.lastDay = today;
    }
    if ((c.streak || 0) >= 7) u.counters.coupleStreak7 = true;
    lines =
      '> 💖 *DAILY LOVE BONUS*\n\n' +
      '💑 Für dich & *' + (love.spouseName || 'deinen Schatz') + '*:\n' +
      '❥ 🪙 +' + copper + ' Kupfer\n' +
      '❥ 💗 +40 Love-XP für eure Beziehung\n\n' +
      '🔥 *Dein Streak:* ' + u.lovebonus.streak + ' Tag' + (u.lovebonus.streak === 1 ? '' : 'e') + '\n' +
      '💞 *Couple-Streak:* ' + (c.streak || 0) + ' Tag' + ((c.streak || 0) === 1 ? '' : 'e') + '\n\n' +
      '_' + pick(['Liebe ist tägliches Einloggen. 💜', 'Romeo & Julia hätten diesen Streak geliebt.', 'Streak pflegen = Beziehung pflegen. 😌']) + '_';
  } else {
    copper = 15 + Math.min(45, (u.lovebonus.streak || 0) * 5);
    lines =
      '> 💖 *DAILY LOVE BONUS*\n\n' +
      '🕊️ Singles-Bonus — Liebe fängt bei dir selbst an:\n' +
      '❥ 🪙 +' + copper + ' Kupfer\n\n' +
      '🔥 *Dein Streak:* ' + u.lovebonus.streak + ' Tag' + (u.lovebonus.streak === 1 ? '' : 'e') + '\n\n' +
      '💡 Verheiratete bekommen den doppelten Bonus — *' + ctx.pref + 'marry @user* 😉';
  }

  userProfile.wallet ||= { copper: 0 };
  userProfile.wallet.copper = (userProfile.wallet.copper || 0) + copper;
  ctx.helpers.saveUserProfile(userProfile);

  const unlocked = checkAchievements(store, uid, userProfile, married ? ['couple_7'] : []);
  await send(lines + (unlocked.length ? '\n\n' + LINE + '\n\n' + achievementPopup(unlocked) : ''));
  return true;
});

cmd('coupletop lovetop', async (ctx, store) => {
  const { send } = ctx;
  const entries = Object.entries(store.couples || {})
    .filter(([, c]) => (c.loveXp || 0) > 0)
    .sort((a, b) => b[1].loveXp - a[1].loveXp)
    .slice(0, 8);

  if (!entries.length) {
    await send('> 💞 *COUPLE-TOP — noch leer!*\n\nSeid das erste Paar: *' + ctx.pref + 'marry @user* und dann täglich *' + ctx.pref + 'lovebonus*! 💜');
    return true;
  }

  const medals = ['🥇', '🥈', '🥉'];
  const rows = entries.map(([ck, c], i) =>
    (medals[i] || (i + 1) + '.') + ' ' + (c.n1 || '?') + ' 💞 ' + (c.n2 || '?') + '\n     💗 ' + (c.loveXp || 0).toLocaleString('de-DE') + ' Love-XP · ⭐ Lv ' + coupleLevel(c.loveXp || 0) + ' · 🔥 ' + (c.streak || 0) + 'd'
  ).join('\n');

  await send('> 🏆 *LOVE BOT — COUPLE TOP*\n\n' + rows + '\n\n' + LINE + '\n💡 Täglicher Couple-Bonus: *' + ctx.pref + 'lovebonus*');
  return true;
});

/* ── 🐶 Haustier ─────────────────────────────────────────────────────── */
cmd('pet haustier', async (ctx, store) => {
  const { args, send, uid, userProfile, pref } = ctx;
  const u = user(store, uid);
  const action = String(args[0] || '').toLowerCase();
  const rest = args.slice(1).join(' ').trim();

  /* adoptieren */
  if (action === 'create' || action === 'adopt' || action === 'erstellen') {
    if (u.pet) {
      await send('> 🐾 Du hast schon ein Haustier: *' + u.pet.name + '* ' + u.pet.type + '\nMit *' + pref + 'pet* siehst du, wie es ihm geht.');
      return true;
    }
    const name = (rest || pick(PET_NAMES_HINT)).slice(0, 16);
    u.pet = {
      name, type: pick(PET_TYPES), createdAt: Date.now(), lastTick: Date.now(),
      love: 70, hunger: 70, mood: 70, energy: 80, level: 1, xp: 0, totalCare: 0
    };
    const unlocked = checkAchievements(store, uid, userProfile, ['first_pet']);
    await send(
      '> 🎉 *WILLKOMMEN, ' + name.toUpperCase() + '!* ' + u.pet.type + '\n\n' +
      'Du hast soeben ein Haustier adoptiert!\n' +
      'Es liebt dich schon etwas. Kümmere dich täglich — sonst wird es traurig. 🥺\n\n' +
      '❥ *' + pref + 'pet feed* — füttern (10 🪙)\n' +
      '❥ *' + pref + 'pet play* — spielen\n' +
      '❥ *' + pref + 'pet sleep* — schlafen legen\n' +
      '❥ *' + pref + 'pet* — Status\n\n' +
      (unlocked.length ? achievementPopup(unlocked) : '_' + pick(['Ein Freund fürs Leben!', 'Zusammen durch dick und dünn. 💜']) + '_')
    );
    return true;
  }

  if (!u.pet) {
    await send('> 🐾 *Noch kein Haustier!*\n\nAdoptiere eins — kostenlos:\n❥ *' + pref + 'pet create <Name>*\n\nBeispiel: *' + pref + 'pet create Luna* 🐶');
    return true;
  }

  const pet = petApplyDecay(u.pet);
  const gainXp = (xp) => {
    pet.xp += xp;
    pet.totalCare = (pet.totalCare || 0) + 1;
    while (pet.xp >= pet.level * 50) { pet.xp -= pet.level * 50; pet.level++; return true; }
    return false;
  };

  if (action === 'feed' || action === 'füttern') {
    const cost = 10;
    if ((userProfile.wallet?.copper || 0) < cost) {
      await send('> 🍖 *Nicht genug Kupfer!*\nFüttern kostet 10 🪙 — hol dir *' + pref + 'lovebonus* oder *' + pref + 'work*.');
      return true;
    }
    userProfile.wallet.copper -= cost;
    ctx.helpers.saveUserProfile(userProfile);
    pet.hunger = Math.min(100, pet.hunger + 35);
    pet.love = Math.min(100, pet.love + 5);
    const lvUp = gainXp(10);
    await send('> 🍖 *' + pet.name + ' wurde gefüttert!* ' + pet.type + '\n\nHunger: [' + bar(pet.hunger) + '] ' + pet.hunger + '%' + (lvUp ? '\n\n⭐ *LEVEL UP!* ' + pet.name + ' ist jetzt Level ' + pet.level + '! 🎉' : ''));
    return true;
  }

  if (action === 'play' || action === 'spielen') {
    if (pet.energy < 15) { await send('> 😴 *' + pet.name + ' ist zu müde zum Spielen.*\nErst ausruhen: *' + pref + 'pet sleep*'); return true; }
    pet.mood = Math.min(100, pet.mood + 30);
    pet.energy = Math.max(0, pet.energy - 20);
    pet.hunger = Math.max(0, pet.hunger - 8);
    pet.love = Math.min(100, pet.love + 10);
    const lvUp = gainXp(15);
    await send('> 🎾 *Du hast mit ' + pet.name + ' gespielt!* ' + pet.type + '\n\nStimmung: [' + bar(pet.mood) + '] ' + pet.mood + '%\nLiebe: [' + bar(pet.love) + '] ' + pet.love + '%' + (lvUp ? '\n\n⭐ *LEVEL UP!* Level ' + pet.level + '! 🎉' : ''));
    return true;
  }

  if (action === 'sleep' || action === 'schlaf') {
    pet.energy = Math.min(100, pet.energy + 45);
    pet.mood = Math.min(100, pet.mood + 5);
    gainXp(5);
    await send('> 😴 *' + pet.name + ' schläft süß.* ' + pet.type + '\n\nEnergie: [' + bar(pet.energy) + '] ' + pet.energy + '%\n_Gute Nacht, kleiner Schatz._ 🌙');
    return true;
  }

  if (action === 'name' || action === 'umbenennen') {
    if (!rest) { await send('> ✏️ Verwendung: *' + pref + 'pet name <NeuerName>*'); return true; }
    const old = pet.name;
    pet.name = rest.slice(0, 16);
    await send('> ✏️ *' + old + ' heißt jetzt ' + pet.name + '!* ' + pet.type);
    return true;
  }

  /* Standard: Status */
  const ageDays = Math.max(1, Math.floor((Date.now() - pet.createdAt) / DAY_MS));
  await send(
    '> 🐾 *DEIN HAUSTIER: ' + pet.name.toUpperCase() + '* ' + pet.type + '\n\n' +
    '🍖 Hunger: [' + bar(pet.hunger) + '] ' + pet.hunger + '%\n' +
    '❤️ Liebe: [' + bar(pet.love) + '] ' + pet.love + '%\n' +
    '😊 Stimmung: [' + bar(pet.mood) + '] ' + pet.mood + '%\n' +
    '⚡ Energie: [' + bar(pet.energy) + '] ' + pet.energy + '%\n\n' +
    '⭐ Level ' + pet.level + ' _(' + pet.xp + '/' + (pet.level * 50) + ' XP)_\n' +
    '📅 Alter: ' + ageDays + ' Tag' + (ageDays === 1 ? '' : 'e') + '\n' +
    '💫 Zustand: ' + petStatusWord(pet) + '\n\n' + LINE + '\n' +
    '❥ *' + pref + 'pet feed* 🍖 · *' + pref + 'pet play* 🎾 · *' + pref + 'pet sleep* 😴'
  );
  return true;
});

/* ── 💎 Economy 2.0 ──────────────────────────────────────────────────── */
cmd('shop laden', async (ctx, store) => {
  const { send } = ctx;
  const rows = SHOP_ITEMS.map((i) =>
    i.emoji + ' *' + i.name + '* — ' + i.price + ' 🪙\n     _' + i.desc + '_'
  ).join('\n');
  await send('> 🛍️ *LOVE SHOP*\n\nDein Guthaben: *' + (ctx.userProfile.wallet?.copper || 0).toLocaleString('de-DE') + ' Kupfer* 🪙\n\n' + rows + '\n\n' + LINE + '\n❥ Kaufen: *' + ctx.pref + 'buy <item>*\n❥ Verschenken: *' + ctx.pref + 'gift @user <item>*');
  return true;
});

cmd('buy kaufen', async (ctx, store) => {
  const { args, send, uid, userProfile } = ctx;
  const raw = String(args[0] || '').toLowerCase();
  const item = itemById(raw) || SHOP_ITEMS.find((i) => i.name.toLowerCase().startsWith(raw) && raw.length >= 3);
  if (!item) { await send('> ❓ Welches Item? Sieh dir den Shop an: *' + ctx.pref + 'shop*'); return true; }

  const wallet = userProfile.wallet ||= { copper: 0 };
  if ((wallet.copper || 0) < item.price) {
    await send('> 💸 *Nicht genug Kupfer!*\n_' + item.emoji + ' ' + item.name + '_ kostet *' + item.price + ' 🪙* — du hast *' + (wallet.copper || 0) + '*.\n\n💡 ' + ctx.pref + 'lovebonus · ' + ctx.pref + 'work · ' + ctx.pref + 'daily');
    return true;
  }
  wallet.copper -= item.price;
  ctx.helpers.saveUserProfile(userProfile);
  const u = user(store, uid);
  u.inventory[item.id] = (u.inventory[item.id] || 0) + 1;
  u.counters.shopSpent = (u.counters.shopSpent || 0) + item.price;
  const unlocked = checkAchievements(store, uid, userProfile);
  await send('> ✅ *Gekauft!* ' + item.emoji + ' 1× _' + item.name + '_ (-' + item.price + ' 🪙)\n\n📦 Dein Inventar: *' + ctx.pref + 'inv*\n🎁 Verschenken: *' + ctx.pref + 'gift @user ' + item.id + '*' + (unlocked.length ? '\n\n' + achievementPopup(unlocked) : ''));
  return true;
});

cmd('inv inventory inventar', async (ctx, store) => {
  const { send } = ctx;
  const u = user(store, ctx.uid);
  const entries = Object.entries(u.inventory || {}).filter(([, n]) => n > 0);
  if (!entries.length) { await send('> 📦 *Dein Inventar ist leer.*\nFülle es im Shop: *' + ctx.pref + 'shop* 🛍️'); return true; }
  const rows = entries.map(([id, n]) => { const it = itemById(id); return (it ? it.emoji : '❔') + ' ×' + n + ' — _' + (it ? it.name : id) + '_'; }).join('\n');
  await send('> 📦 *DEIN INVENTAR*\n\n' + rows + '\n\n' + LINE + '\n🎁 Verschenken: *' + ctx.pref + 'gift @user <item>*');
  return true;
});

cmd('gift schenken', async (ctx, store) => {
  const { send, uid, userProfile, pref } = ctx;
  const target = await ctx.resolveTarget();
  if (!target) { await send('> ❓ Verwendung: *' + pref + 'gift @user <item>*'); return true; }
  if (target.key === ctx.myKey) { await send('> 😅 Selbstgeschenke sind romantisch … aber sinnlos. 😉'); return true; }

  const itemArg = String(ctx.args.find((a) => !a.startsWith('@') && isNaN(Number(a))) || ctx.args[1] || '').toLowerCase();
  const item = itemById(itemArg) || SHOP_ITEMS.find((i) => i.name.toLowerCase().startsWith(itemArg) && itemArg.length >= 3);
  const u = user(store, uid);

  /* Nicht im Inventar? Automatisch kaufen, wenn genug Kupfer */
  if (!item || (u.inventory[item.id] || 0) < 1) {
    if (item && (userProfile.wallet?.copper || 0) >= item.price) {
      userProfile.wallet.copper -= item.price;
      u.counters.shopSpent = (u.counters.shopSpent || 0) + item.price;
    } else {
      await send(item
        ? '> 📦 *Du hast kein „' + item.name + '“ im Inventar.*\nKaufe es zuerst: *' + pref + 'buy ' + item.id + '* (' + item.price + ' 🪙) — oder direkt genug Kupfer auf dem Konto, dann kauft der Bot es beim Verschenken automatisch.'
        : '> ❓ Welches Geschenk? *' + pref + 'shop* zeigt alles.');
      return true;
    }
  } else {
    u.inventory[item.id] -= 1;
  }
  ctx.helpers.saveUserProfile(userProfile);

  const targetName = target.profile?.registration?.name || target.profile?.identity?.username || 'jemand';
  u.counters.giftsSent = (u.counters.giftsSent || 0) + 1;

  /* Couple-Bonus, wenn man dem Partner schenkt */
  let coupleLine = '';
  const love = userProfile?.love;
  if (love?.married === true) {
    const partnerKey = love.spouseKey || '';
    if (target.key === partnerKey || target.key === ctx.helpers.cleanId(partnerKey)) {
      const ck = coupleKey(ctx.myKey, partnerKey);
      const c = store.couples[ck] ||= { loveXp: 0, streak: 0, lastDay: '', memories: 0, n1: ctx.name, n2: targetName };
      c.loveXp += 25; c.memories = (c.memories || 0) + 1;
      coupleLine = '\n💗 *+25 Love-XP* — Geschenke halten die Liebe warm. (_' + c.memories + ' Erinnerungen_)';
    }
  }

  const targetUser = user(store, target.uidKey || target.key);
  targetUser.counters ||= {};
  targetUser.counters.giftsReceived = (targetUser.counters.giftsReceived || 0) + 1;

  const unlocked = checkAchievements(store, uid, userProfile, ['first_gift']);
  await ctx.sendWithMentions(
    '> 🎁 *EIN GESCHENK!*\n\n' + item.emoji + ' _' + item.name + '_\n' +
    'von *@' + ctx.helpers.cleanId(ctx.senderJid || ctx.senderLid) + '* für *@' + ctx.helpers.cleanId(target.jid || target.lid) + '*\n\n' +
    '_' + pick(['Wie süß! 🥺', 'Das kommt aus dem Herzen. 💜', 'Jemand hat dich sehr lieb!', 'Rosen, Teddys, Glück — alles da. 🌹']) + '_' +
    coupleLine + (unlocked.length ? '\n\n' + achievementPopup(unlocked) : ''),
    [ctx.senderJid || ctx.senderLid, target.jid || target.lid].filter(Boolean)
  );
  return true;
});

cmd('pay transfer überweisen', async (ctx, store) => {
  const { send, userProfile, pref } = ctx;
  const target = await ctx.resolveTarget();
  const amount = Number(String(ctx.args.find((a) => /^\d+$/.test(a)) || '0'));
  if (!target || !amount || amount < 1) { await send('> ❓ Verwendung: *' + pref + 'pay @user <betrag>*'); return true; }
  if (amount > 10000) { await send('> 🛑 Maximal 10.000 Kupfer pro Überweisung.'); return true; }
  const wallet = userProfile.wallet ||= { copper: 0 };
  if ((wallet.copper || 0) < amount) { await send('> 💸 Du hast nur *' + (wallet.copper || 0) + ' Kupfer* — angefragt waren *' + amount + '*.'); return true; }

  wallet.copper -= amount;
  const tp = target.profile;
  if (tp) { tp.wallet ||= { copper: 0 }; tp.wallet.copper = (tp.wallet.copper || 0) + amount; ctx.helpers.saveUserProfile(tp); }
  ctx.helpers.saveUserProfile(userProfile);
  await ctx.sendWithMentions('> 🪙 *ÜBERWEISUNG*\n\n*' + amount.toLocaleString('de-DE') + ' Kupfer*\nvon *@' + ctx.helpers.cleanId(ctx.senderJid || ctx.senderLid) + '* → *@' + ctx.helpers.cleanId(target.jid || target.lid) + '*\n\n✅ Angekommen. _Geld kann Liebe nicht ersetzen — aber es hilft._ 😉', [ctx.senderJid || ctx.senderLid, target.jid || target.lid].filter(Boolean));
  return true;
});

cmd('rob raub', async (ctx, store) => {
  const { send, uid, userProfile, pref } = ctx;
  const COOLDOWN = 3600000;
  const u = user(store, uid);
  const now = Date.now();
  if (u.cooldowns.rob && now - u.cooldowns.rob < COOLDOWN) {
    const wait = Math.ceil((COOLDOWN - (now - u.cooldowns.rob)) / 60000);
    await send('> ⏳ *Kriminelle Energie braucht eine Pause.*\nNächster Raub in ~' + wait + ' Minute(n).');
    return true;
  }
  const target = await ctx.resolveTarget();
  if (!target) { await send('> ❓ Verwendung: *' + pref + 'rob @user*'); return true; }
  if (target.key === ctx.myKey) { await send('> 🤨 Dich selbst berauben? Bold move.'); return true; }

  const tp = target.profile;
  const tWallet = tp ? (tp.wallet ||= { copper: 0 }) : null;
  const tCopper = tWallet ? (tWallet.copper || 0) : 0;
  if (tCopper < 50) { await send('> 🥲 *' + (target.name || 'Das Opfer') + ' hat nur ' + tCopper + ' Kupfer.*\nArme nicht berauben — das ist unsportlich.'); return true; }

  const stake = Math.min(100, Math.max(25, Math.floor(tCopper * 0.1)));
  const wallet = userProfile.wallet ||= { copper: 0 };
  if ((wallet.copper || 0) < stake) { await send('> 💸 Für einen Raub brauchst du mindestens *' + stake + ' Kupfer* Einsatz (10% des Opfers).'); return true; }
  u.cooldowns.rob = now;

  const success = Math.random() < 0.4;
  if (success) {
    const loot = Math.max(25, Math.floor(tCopper * (0.15 + Math.random() * 0.2)));
    const stolen = Math.min(loot, tCopper);
    if (tWallet) { tWallet.copper -= stolen; ctx.helpers.saveUserProfile(tp); }
    wallet.copper = (wallet.copper || 0) + stolen;
    ctx.helpers.saveUserProfile(userProfile);
    await send('> 🏃‍♂️💨 *RAUB ERFOLGREICH!*\n\nDu hast *@' + ctx.helpers.cleanId(target.jid || target.lid) + '* *' + stolen + ' Kupfer* abgenommen! 😈\n\n_Aber Achtung: was kommt, geht auch._ Karma beobachtet dich.');
  } else {
    wallet.copper = Math.max(0, (wallet.copper || 0) - stake);
    ctx.helpers.saveUserProfile(userProfile);
    await send('> 🚨 *GESCHNAPPT!*\n\nDer Raub ging schief — du zahlst *' + stake + ' Kupfer* Strafe und wartest 1 Stunde. 🚔\n\n_Ehrlich währt am längsten. Meistens._');
  }
  return true;
});

/* ── 💌 Liebesbrief ──────────────────────────────────────────────────── */
cmd('letter liebesbrief', async (ctx, store) => {
  const { send, uid, userProfile, pref } = ctx;
  const target = await ctx.resolveTarget();
  if (!target) {
    await send('> 💌 Verwendung: *' + pref + 'letter @user [romantisch|suess|lustig]*');
    return true;
  }
  const styleArg = String(ctx.args.find((a) => /^(romantisch|romantic|suess|süß|sweet|lustig|funny)$/i.test(a)) || 'romantisch').toLowerCase();
  const style = /suess|süß|sweet/i.test(styleArg) ? 'suess' : (/lustig|funny/i.test(styleArg) ? 'lustig' : 'romantisch');
  const text = pick(LETTERS[style]);

  const u = user(store, uid);
  u.counters.lettersSent = (u.counters.lettersSent || 0) + 1;

  /* Couple: Erinnerung + Love-XP */
  let coupleLine = '';
  const love = userProfile?.love;
  const targetName = target.profile?.registration?.name || target.profile?.identity?.username || 'dir';
  if (love?.married === true && (target.key === love.spouseKey || target.key === ctx.helpers.cleanId(love.spouseKey))) {
    const ck = coupleKey(ctx.myKey, love.spouseKey);
    const c = store.couples[ck] ||= { loveXp: 0, streak: 0, lastDay: '', memories: 0, n1: ctx.name, n2: targetName };
    c.loveXp += 15; c.memories = (c.memories || 0) + 1;
    coupleLine = '\n\n💗 _+15 Love-XP — solche Briefe machen Beziehungen stark._';
  }

  const unlocked = checkAchievements(store, uid, userProfile, ['first_letter']);
  await ctx.sendWithMentions(
    '> 💌 *EIN LIEBESBRIEF FÜR DICH*\n\n' +
    '„' + text + '“\n\n' +
    '— _' + ctx.name + '_ 🌹' + coupleLine + (unlocked.length ? '\n\n' + achievementPopup(unlocked) : ''),
    [target.jid || target.lid].filter(Boolean)
  );
  return true;
});

/* ── 🏆 Achievements ─────────────────────────────────────────────────── */
cmd('achievements badges erfolge', async (ctx, store) => {
  const { send } = ctx;
  const u = user(store, ctx.uid);
  const got = u.achievements || {};
  const total = ACHIEVEMENTS.length;
  const count = Object.keys(got).length;
  const rows = ACHIEVEMENTS.map((a) => {
    const has = got[a.id];
    return (has ? a.emoji + ' ✅' : '🔒 ❌') + ' *' + a.name + '* — _' + a.desc + '_';
  }).join('\n');
  await send('> 🏆 *DEINE ACHIEVEMENTS* _(' + count + '/' + total + ')_\n\n' + rows + '\n\n' + LINE + '\n💡 Freischalten durch: Geschenke 🎁 · Pets 🐾 · Streaks 🔥 · Spiele 🎮 · Heiraten 💍');
  return true;
});

/* ── 🎮 Games ────────────────────────────────────────────────────────── */
cmd('hangman galgen', async (ctx, store) => {
  const { send, uid, userProfile, from } = ctx;
  const games = store.games ||= {};
  const sess = games['hangman:' + from];
  const guess = String(ctx.args[0] || '').toUpperCase().replace(/[^A-ZÄÖÜ]/g, '');

  if (guess && sess) {
    if (guess.length === 1) {
      if (sess.guessed.includes(guess)) { await send('> 🔁 *' + guess + '* hast du schon versucht!'); return true; }
      sess.guessed.push(guess);
      if (sess.word.includes(guess)) {
        sess.shown = sess.word.split('').map((ch) => (ch === ' ' || sess.guessed.includes(ch)) ? ch : '_');
        if (!sess.shown.includes('_')) {
          const reward = 50;
          userProfile.wallet ||= { copper: 0 }; userProfile.wallet.copper += reward;
          ctx.helpers.saveUserProfile(userProfile);
          const u = user(store, uid); u.counters.hangmanWins = (u.counters.hangmanWins || 0) + 1;
          delete games['hangman:' + from];
          const unlocked = checkAchievements(store, uid, userProfile, ['hangman_win']);
          await send('> 🎉 *GELÖST: ' + sess.word + '!*\n\n' + sess.word.split('').join(' ') + '\n\n🪙 +' + reward + ' Kupfer' + (unlocked.length ? '\n\n' + achievementPopup(unlocked) : ''));
          return true;
        }
        await send('> ✅ *Treffer!*\n\n`' + sess.shown.join(' ') + '`\n\n❤️ ' + '❤️'.repeat(Math.max(0, 8 - sess.wrong)) + '🖤'.repeat(sess.wrong) + '\n_Weiter raten oder aufgeben: ' + ctx.pref + 'hangman stop_');
        return true;
      }
      sess.wrong++;
      if (sess.wrong >= 8) {
        const word = sess.word;
        delete games['hangman:' + from];
        await send('> 💀 *Verloren!* Das Wort war *' + word + '*.\n\n_neue Runde: ' + ctx.pref + 'hangman_');
        return true;
      }
      await send('> ❌ *Kein „' + guess + '“ drin!*\n\n`' + sess.shown.join(' ') + '`\n\n❤️'.repeat(8 - sess.wrong) + '🖤'.repeat(sess.wrong));
      return true;
    }
    if (guess === 'STOP' || guess === 'AUFHOEREN') {
      delete games['hangman:' + from];
      await send('> 🏳️ Runde beendet. Neustart: *' + ctx.pref + 'hangman*');
      return true;
    }
    if (guess.replace(/[^A-ZÄÖÜ]/g, '').length > 1) {
      /* Ganzes Wort geraten */
      if (guess.replace(/\s/g, '') === sess.word.replace(/\s/g, '')) {
        const reward = 50;
        userProfile.wallet ||= { copper: 0 }; userProfile.wallet.copper += reward;
        ctx.helpers.saveUserProfile(userProfile);
        const u = user(store, uid); u.counters.hangmanWins = (u.counters.hangmanWins || 0) + 1;
        delete games['hangman:' + from];
        const unlocked = checkAchievements(store, uid, userProfile, ['hangman_win']);
        await send('> 🎉 *RICHTIG! Das Wort war ' + sess.word + '!*\n\n🪙 +' + reward + ' Kupfer' + (unlocked.length ? '\n\n' + achievementPopup(unlocked) : ''));
      } else {
        sess.wrong += 2;
        await send('> ❌ *Falsches Wort!* (+2 Fehler)\n\n`' + sess.shown.join(' ') + '`\n\n' + '❤️'.repeat(Math.max(0, 8 - sess.wrong)) + '🖤'.repeat(Math.min(8, sess.wrong)));
      }
      return true;
    }
  }

  if (sess) {
    await send('> 🪢 *GALGENMÄNNCHEN — LÄUFT*\n\n`' + sess.shown.join(' ') + '`\n\n❤️ ' + '❤️'.repeat(8 - sess.wrong) + '🖤'.repeat(sess.wrong) + '\n\n❥ Rate: *' + ctx.pref + 'hangman <buchstabe>*\n❥ Wort wissen: *' + ctx.pref + 'hangman <wort>*');
    return true;
  }

  const word = pick(HANGMAN_WORDS);
  games['hangman:' + from] = {
    word, shown: word.split('').map(() => '_'), guessed: [], wrong: 0, by: uid, at: Date.now()
  };
  await send('> 🪢 *GALGENMÄNNCHEN — NEUE RUNDE!*\n\n`' + games['hangman:' + from].shown.join(' ') + '`\n\n❤️❤️❤️❤️❤️❤️❤️❤️  _(8 Leben)_\n\n❥ *' + ctx.pref + 'hangman <buchstabe>* — raten\n❥ 🪙 50 Kupfer fürs Lösen\n_Das Thema: Liebe & Romanik_ 💜');
  return true;
});

cmd('riddle raetsel', async (ctx, store) => {
  const { send, uid, userProfile, from } = ctx;
  const games = store.games ||= {};
  const key = 'riddle:' + from;
  const answerRaw = ctx.args.join(' ');

  if (answerRaw && games[key]) {
    const sess = games[key];
    if (normWord(answerRaw) === normWord(sess.a)) {
      const reward = 30;
      userProfile.wallet ||= { copper: 0 }; userProfile.wallet.copper += reward;
      ctx.helpers.saveUserProfile(userProfile);
      delete games[key];
      const unlocked = checkAchievements(store, uid, userProfile, ['riddle_ok']);
      await send('> 🧠✨ *RICHTIG!*\n\nDie Antwort war wirklich *' + sess.a + '*.\n\n🪙 +' + reward + ' Kupfer' + (unlocked.length ? '\n\n' + achievementPopup(unlocked) : ''));
    } else if (/hint|tipp/i.test(answerRaw)) {
      await send('> 💡 *Tipp:* Die Antwort hat *' + sess.a.length + ' Buchstaben* und beginnt mit *„' + sess.a[0].toUpperCase() + '“*.');
    } else {
      sess.tries = (sess.tries || 0) + 1;
      if (sess.tries >= 5) {
        const a = sess.a;
        delete games[key];
        await send('> 😵 *5 Versuche vorbei!* Die Antwort war *' + a + '*.\nNeues Rätsel: *' + ctx.pref + 'riddle*');
      } else {
        await send('> ❌ Leider falsch! _(Versuch ' + sess.tries + '/5)_\n💡 Tipp: *' + ctx.pref + 'riddle tipp*');
      }
    }
    return true;
  }

  const r = pick(RIDDLES);
  games[key] = { q: r.q, a: r.a, tries: 0, by: uid, at: Date.now() };
  await send('> 🧠 *RÄTSEL DER RUNDE*\n\n_' + r.q + '_\n\n❥ Antworten: *' + ctx.pref + 'riddle <antwort>*\n❥ Tipp: *' + ctx.pref + 'riddle tipp*  _(max. 5 Versuche)_\n🪙 30 Kupfer für die richtige Antwort');
  return true;
});

cmd('wouldyou wuerdestdu', async (ctx) => {
  const [a, b] = pick(WOULDYOU);
  await ctx.send('> 🤔 *WÜRDEST DU EHER …?*\n\n' + a + '\noder\n' + b + '\n\n_Antwortet direkt im Chat — Streit vorprogrammiert._ 😈');
  return true;
});

cmd('horoscope horoskop', async (ctx) => {
  const send = ctx.send;
  const arg = normWord(ctx.args.join(' '));
  const keys = Object.keys(HOROSKOP_TRAITS);
  const signKey = arg ? keys.find((k) => k.startsWith(arg) || normWord(HOROSKOP_TRAITS[k]).startsWith(arg)) : null;
  if (!signKey) {
    await send('> 🔮 *Usage:* ' + ctx.pref + 'horoskop <zeichen>\n\n' + keys.map((k) => HOROSKOP_TRAITS[k]).join(' · '));
    return true;
  }
  await send('> 🔮 *TAGESHOROSKOP — ' + HOROSKOP_TRAITS[signKey].toUpperCase() + '*\n\n❤️ *Liebe:* ' + pick(HORO_LIEBE) + '\n🍀 *Glück:* ' + pick(HORO_GLUECK) + '\n💡 *Tipp:* ' + pick(HORO_TIPP) + '\n\n_' + pick(['Die Sterne stehen gut heute.', 'Merkur macht keinen Blödsinn — versprochen.', 'Gültig bis Mitternacht. Danach: neue Sterne.']) + '_');
  return true;
});

/* ═══════════════════════════════════════════════════════════════════ */
/*  Öffentliche API für Love.js                                        */
/* ═══════════════════════════════════════════════════════════════════ */

/* Hilfe-Liste im Format von HELP_CATEGORIES ([usage, desc]) */
/* ── 📊 Profil-Snapshot (Single Source für $me / $profile / Web-Admin) ── */
/* Liest NUR echte Daten: UserProfile + loveplus-Store. Fehlt etwas → '—'.  */
export function getLoveSnapshot(userProfile, myKey = '') {
  if (!userProfile) return null;
  const uid = userProfile?.identity?.bid || '';
  const store = loadStore();
  const u = user(store, uid);

  /* Couple finden: Key-Teile testen (myKey = identityKey aus Love.js) */
  const meKeys = [myKey, uid, userProfile?.identity?.cleanJid, userProfile?.identity?.cleanLid]
    .map((x) => String(x || '')).filter(Boolean);
  let couple = null; let coupleKeyFound = '';
  for (const [ck, c] of Object.entries(store.couples || {})) {
    if (!c) continue;
    if (meKeys.some((k) => ck.split('|').includes(k))) { couple = c; coupleKeyFound = ck; break; }
  }

  /* Achievements: neueste zuerst, Preview top 4 */
  const achEntries = Object.entries(u.achievements || {}).sort((a, b) => (b[1] || 0) - (a[1] || 0));
  const achCatalog = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));
  const achPreview = achEntries.slice(0, 4).map(([id, ts]) => achCatalog.get(id) || { emoji: '🏅', name: id, ts });

  /* Wallet-Rang: Kupfer über alle Nutzer (read-only in Database.json) */
  let walletRank = null;
  try {
    const dbRaw = JSON.parse(fs.readFileSync(path.join('Database', 'Database.json'), 'utf8'));
    const coppers = Object.values(dbRaw.users || {})
      .map((p) => (p?.wallet?.copper || 0));
    const mine = userProfile?.wallet?.copper || 0;
    if (coppers.length) {
      walletRank = coppers.filter((c) => c > mine).length + 1;
    }
  } catch (e) { walletRank = null; }

  const items = Object.values(u.inventory || {}).reduce((a, n) => a + (Number(n) || 0), 0);
  const love = userProfile?.love || {};
  const g = userProfile?.games || {};
  const days = love.marriedAt ? Math.max(0, Math.floor((Date.now() - new Date(love.marriedAt).getTime()) / 86400000)) : null;

  return {
    uid,
    economy: {
      copper: userProfile?.wallet?.copper || 0,
      silver: userProfile?.wallet?.silver || 0,
      gold: userProfile?.wallet?.gold || 0,
      platin: userProfile?.wallet?.platin || 0,
      bank: (userProfile?.bank?.copper || 0) + (userProfile?.bank?.silver || 0) + (userProfile?.bank?.gold || 0) + (userProfile?.bank?.platin || 0),
      walletRank, items
    },
    love: {
      married: love.married === true,
      spouseName: love.spouseName || null,
      marriedAt: love.marriedAt || null,
      daysTogether: days,
      marriages: love.marriages || 0,
      couple: couple ? { loveXp: couple.loveXp || 0, level: coupleLevel(couple.loveXp || 0), streak: couple.streak || 0, memories: couple.memories || 0, key: coupleKeyFound } : null
    },
    pet: u.pet ? { name: u.pet.name, type: u.pet.type, level: u.pet.level || 1, love: u.pet.love, hunger: u.pet.hunger, mood: u.pet.mood, energy: u.pet.energy } : null,
    achievements: { count: achEntries.length, preview: achPreview },
    streak: u.lovebonus?.streak || 0,
    games: { wins: g.totalWin || 0, losses: g.totalLoss || 0, winStreak: g.winStreak || 0 }
  };
}

/* ── 💍 Marriage-Hook: wird von Love.js bei „Annehmen“ aufgerufen ────── */
export function onMarriageAccepted(profileA, profileB) {
  const keyA = String(profileA?.identity?.cleanJid || profileA?.identity?.bid || 'a');
  const keyB = String(profileB?.identity?.cleanJid || profileB?.identity?.bid || 'b');
  const nameA = profileA?.registration?.name || profileA?.identity?.username || '?';
  const nameB = profileB?.registration?.name || profileB?.identity?.username || '?';
  const store = loadStore();
  const ck = coupleKey(keyA, keyB);
  const c = store.couples[ck] ||= { loveXp: 0, streak: 0, lastDay: '', memories: 0, n1: nameA, n2: nameB };
  c.loveXp = (c.loveXp || 0) + 100;       /* 💗 Startbonus fürs Heiraten */
  c.n1 = nameA; c.n2 = nameB;
  c.marriedAt = c.marriedAt || new Date().toISOString();
  for (const p of [profileA, profileB]) {
    const u = user(store, p?.identity?.bid || '');
    u.achievements.married = Date.now();  /* 🏆 Just Married */
  }
  saveStore(store);
  return { coupleKey: ck, loveXp: c.loveXp };
}

export const LOVEPLUS_HELP_CMDS = [
  ['$relationship / $beziehung', 'Eure Beziehung: Tage, Love-XP, Treue, Jahrestag ❤️'],
  ['$lovebonus', 'Täglicher Love-Bonus + Streak 🔥 (Paare: doppel!)'],
  ['$coupletop', 'Die stärksten Paare des Bots 💞'],
  ['$couplestats', 'Couple-Stats: Love-XP, Level, Streak 💑'],
  ['$anniversary', 'Jahrestag + Meilensteine 📅'],
  ['$pet create <name>', 'Haustier adoptieren 🐶 (kostenlos!)'],
  ['$pet', 'Wie geht es deinem Haustier? 🐾'],
  ['$pet feed / play / sleep', 'Füttern 🍖 · Spielen 🎾 · Schlafen 😴'],
  ['$pet name <name>', 'Haustier umbenennen ✏️'],
  ['$shop', 'Love-Shop: Rosen, Teddys, Ringe 🛍️'],
  ['$buy <item>', 'Item kaufen (z. B. $buy rose)'],
  ['$inv', 'Dein Inventar 📦'],
  ['$gift @user <item>', 'Geschenk verschenken 🎁'],
  ['$pay @user <betrag>', 'Kupfer überweisen 🪙'],
  ['$rob @user', 'Kupfer rauben (40% Chance, 1h Cooldown) 😈'],
  ['$letter @user [stil]', 'Liebesbrief schicken 💌 (romantisch/suess/lustig)'],
  ['$achievements', 'Deine Erfolge 🏆 (13 Achievements!)'],
  ['$hangman', 'Galgenmännchen rund um die Liebe 🪢'],
  ['$riddle', 'Rätsel-Runde mit Kupfer-Belohnung 🧠'],
  ['$wouldyou', 'Würdest du eher …? 🤔'],
  ['$horoskop <zeichen>', 'Tageshoroskop 🔮']
];

/* Haupt-Einsprung: true = Befehl wurde behandelt */
/* ── 💑 Couple-Stats & Jahrestag (Lesen via Snapshot) ────────────────── */
cmd('couplestats paarestats', async (ctx) => {
  const snap = getLoveSnapshot(ctx.userProfile, ctx.myKey);
  const love = snap?.love;
  if (!love?.married || !love.couple) {
    await ctx.send('> 💑 *COUPLE-STATS*\n\nDu bist noch nicht verheiratet.\n💡 Mit *' + ctx.pref + 'marry @user* ändert sich das! 💍');
    return true;
  }
  const c = love.couple;
  await ctx.send(
    '> 💑 *EURE COUPLE-STATS*\n\n' +
    '💗 Love-XP: *' + (c.loveXp || 0).toLocaleString('de-DE') + '*\n' +
    '⭐ Couple-Level: *' + c.level + '*\n' +
    '🔥 Daily-Streak: *' + (c.streak || 0) + ' Tag(e)*\n' +
    '💌 Gemeinsame Erinnerungen: *' + (c.memories || 0) + '*\n\n' +
    '💡 Täglicher Bonus: *' + ctx.pref + 'lovebonus* — als Paar gibt es doppelt! 💜'
  );
  return true;
});

cmd('anniversary jahrestag', async (ctx) => {
  const snap = getLoveSnapshot(ctx.userProfile, ctx.myKey);
  const love = snap?.love;
  if (!love?.married) {
    await ctx.send('> 📅 *JAHRESTAG*\n\nNoch nicht verheiratet — erst *' + ctx.pref + 'marry @user*, dann Jahrestage feiern! 🎉');
    return true;
  }
  const days = love.daysTogether ?? 0;
  const milestones = [7, 30, 100, 365, 500, 1000];
  const next = milestones.find((m) => m > days);
  await ctx.send(
    '> 📅 *EUR JAHRESTAG* 💍\n\n' +
    '💑 ' + (love.spouseName || '?') + ' & du\n' +
    '💒 Seit: *' + new Date(love.marriedAt).toLocaleDateString('de-DE') + '*\n' +
    '❤️ Zusammen: *' + days + ' Tag' + (days === 1 ? '' : 'e') + '*\n' +
    (next ? '🎉 Nächster Meilenstein: *Tag ' + next + '* — noch *' + (next - days) + ' Tag(e)*' : '🏆 Alle Meilensteine gemeistert! Legendary!') + '\n\n' +
    '🏆 Freigeschaltet: ' + milestones.filter((m) => m <= days).map((m) => 'Tag ' + m).join(' · ')
  );
  return true;
});

export async function handleLovePlus(ctx) {
  const { command, helpers } = ctx;
  const fn = COMMANDS.get(String(command || '').toLowerCase());
  if (!fn || !helpers) return false;

  const store = loadStore();
  const H = helpers;
  const uid = ctx.userProfile?.identity?.bid || H.cleanId(ctx.senderJid || ctx.senderLid || '');
  const myKey = H.identityKey(ctx.senderJid, ctx.senderLid);
  const name = ctx.userProfile?.registration?.name
    || ctx.userProfile?.identity?.username
    || ctx.msg?.pushName
    || H.cleanId(ctx.senderJid || ctx.senderLid || 'Unbekannt');

  const enriched = {
    ...ctx,
    uid, myKey, name,
    send: (text) => ctx.sock.sendMessage(ctx.from, { text }, { quoted: ctx.msg }),
    sendWithMentions: (text, mentions) => ctx.sock.sendMessage(ctx.from, { text, mentions: (mentions || []).filter(Boolean) }, { quoted: ctx.msg }),
    resolveTarget: async () => {
      const mentions = ctx.msg?.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      const quotedP = ctx.quoted?.extendedTextMessage?.contextInfo?.participant
        || ctx.msg?.message?.extendedTextMessage?.contextInfo?.participant;
      const raw = mentions[0] || quotedP || ctx.args.find((a) => a.startsWith('@') || /^\d{6,}/.test(a)) || '';
      if (!raw) return null;
      const t = await H.resolveBanTarget(ctx.sock, raw, ctx.sessionPath);
      if (!t || (!t.jid && !t.lid)) return null;
      const profile = await H.loadUserProfileForSender({ jid: t.jid || '', lid: t.lid || '' });
      return {
        jid: t.jid, lid: t.lid,
        key: H.cleanId(t.key || H.identityKey(t.jid || '', t.lid || '')),
        profile,
        name: profile?.registration?.name || profile?.identity?.username || H.cleanId(t.jid || t.lid || '?'),
        uidKey: profile?.identity?.bid || H.cleanId(t.jid || t.lid || '')
      };
    }
  };

  try {
    const handled = await fn(enriched, store);
    return handled === true;
  } catch (err) {
    console.error('[loveplus] Fehler bei "' + command + '":', err?.message || err);
    try {
      await enriched.send('> ⚠️ *LovePlus-Fehler bei „' + command + '“.*\nBitte später nochmal versuchen. 💜');
    } catch (e) {}
    return true; /* Befehl gehört uns — Fehler nicht an den Core weiterreichen */
  } finally {
    saveStore(store);
  }
}

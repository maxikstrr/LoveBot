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
import { levelUpAnnounce, prestigeAnnounce, awardBadges, grantXp, xpEligible, xpRules, yearXpSum, yearStatsSum } from './levelsystem.js';
import { addCoins, removeCoins, transferCoins, ensureEconomy } from './economy.js';
import { emit as engineEmit } from './loveengine.js';
import { notify as notifyUser } from './notifications.js';

/* ---------- Speicher -------------------------------------------------- */
const STORE_PATH = path.join('Database', 'loveplus.json');

export function loadStore() {
  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  } catch (e) {
    return { users: {}, couples: {}, games: {} };
  }
}

export function saveStore(store) {
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
  { id: 'rose',      emoji: '🌹', name: 'Rose',           price: 15,  desc: 'Der Klassiker.', type: 'gift', requires: null },
  { id: 'letter',    emoji: '💌', name: 'Liebesbrief',    price: 20,  desc: 'Zum Verlieben.', type: 'gift', requires: null },
  { id: 'choco',     emoji: '🍫', name: 'Schokolade',     price: 25,  desc: 'Süß wie du.', type: 'gift', requires: null },
  { id: 'teddy',     emoji: '🧸', name: 'Teddybär',       price: 60,  desc: 'Zum Knuddeln.', type: 'gift', requires: null },
  { id: 'cake',      emoji: '🎂', name: 'Kuchen',         price: 80,  desc: 'Zum Feiern.', type: 'gift', requires: null },
  { id: 'star',      emoji: '⭐', name: 'Stern',          price: 150, desc: 'Vom Himmel geholt.', type: 'gift', requires: null },
  { id: 'moon',      emoji: '🌙', name: 'Mond',           price: 300, desc: 'Für Romantiker.', type: 'gift', requires: null },
  { id: 'ring',      emoji: '💍', name: 'Diamantring',    price: 999, desc: 'Das große Ganze.', type: 'gift', requires: null }
];

/** Shop-Katalog (Kopie — nur Lesen, kein Mutieren). */
export function shopCatalog() {
  return SHOP_ITEMS.map((i) => ({ ...i }));
}

/**
 * Kauf-Validierung (6.0): unbekannt / Level-Voraussetzung / Registrierung.
 * Alle aktuellen Items haben requires=null (keine Verhaltensänderung),
 * der Mechanismus greift, sobald ein Item requires trägt.
 */
export function validateShopPurchase(item, profile) {
  if (!item) return { ok: false, reason: 'unknown-item' };
  const req = item.requires || {};
  if (Number(req.level) > 0 && (Number(profile?.progression?.level) || 0) < Number(req.level)) {
    return { ok: false, reason: 'level', need: Number(req.level) };
  }
  if (req.registered && !profile?.registration?.name) return { ok: false, reason: 'register' };
  if (!Number.isFinite(Number(item.price)) || Number(item.price) <= 0) return { ok: false, reason: 'bad-price' };
  return { ok: true };
}

const PET_TYPES = ['🐶', '🐱', '🐰', '🦊', '🐻', '🐼', '🐹', '🦁', '🐨', '🐥'];
const PET_NAMES_HINT = ['Luna', 'Milo', 'Bella', 'Simba', 'Nala', 'Kira', 'Balu', 'Coco'];

const ACHIEVEMENTS = [
  { id: 'first_pet', tier: 'bronze',    emoji: '🐾', name: 'Tierfreund',          desc: 'Haustier adoptiert.', cat: 'pets' },
  { id: 'pet_lv5', tier: 'silver',      emoji: '🐕', name: 'Beste Freunde',       desc: 'Haustier Level 5 erreicht.', cat: 'pets', goal: { m: 'petLevel', n: 5 } },
  { id: 'first_gift', tier: 'bronze',   emoji: '🎁', name: 'First Gift',          desc: 'Erstes Geschenk verschenkt.', cat: 'social' },
  { id: 'gifts_10', tier: 'silver',     emoji: '🌹', name: 'Romantiker',          desc: '10 Geschenke verschenkt.', cat: 'social', goal: { m: 'giftsSent', n: 10 } },
  { id: 'first_letter', tier: 'bronze', emoji: '💌', name: 'Poet',                desc: 'Ersten Liebesbrief geschrieben.', cat: 'social' },
  { id: 'married', tier: 'gold',      emoji: '💍', name: 'Just Married',        desc: 'Verheiratet (über $marry).', cat: 'relationship', goal: { m: 'married', n: 1 } },
  { id: 'couple_7', tier: 'silver',     emoji: '❤️', name: 'Eine Woche Liebe',    desc: '7 Tage Couple-Streak.', cat: 'relationship', goal: { m: 'coupleStreak', n: 7 } },
  { id: 'streak_7', tier: 'silver',     emoji: '🔥', name: 'Eine Woche dabei',    desc: '7 Tage Login-Streak.', cat: 'streak', goal: { m: 'loginStreak', n: 7 } },
  { id: 'streak_30', tier: 'diamond',    emoji: '☄️', name: 'Unaufhaltsam',        desc: '30 Tage Login-Streak.', cat: 'streak', goal: { m: 'loginStreak', n: 30 } },
  { id: 'rich_1000', tier: 'silver',    emoji: '💎', name: 'Kupferkönig',         desc: '1.000 Kupfer besessen.', cat: 'economy', goal: { m: 'copper', n: 1000 } },
  { id: 'hangman_win', tier: 'bronze',  emoji: '🪢', name: 'Worträtsler',          desc: 'Galgenmännchen gewonnen.', cat: 'games' },
  { id: 'riddle_ok', tier: 'bronze',    emoji: '🧠', name: 'Denker',               desc: 'Rätsel gelöst.', cat: 'games' },
  { id: 'big_spender', tier: 'silver',  emoji: '💸', name: 'Big Spender',          desc: '500+ Kupfer im Shop ausgegeben.', cat: 'economy', goal: { m: 'shopSpent', n: 500 } },
  { id: 'level_10', tier: 'bronze',     emoji: '🌸', name: 'Herzling',             desc: 'Level 10 erreicht.', cat: 'level', goal: { m: 'totalLevel', n: 10 } },
  { id: 'level_25', tier: 'silver',     emoji: '🌷', name: 'Flirter',              desc: 'Level 25 erreicht.', cat: 'level', goal: { m: 'totalLevel', n: 25 } },
  { id: 'level_50', tier: 'gold',     emoji: '💕', name: 'Romantiker',           desc: 'Level 50 erreicht.', cat: 'level', goal: { m: 'totalLevel', n: 50 } },
  { id: 'level_100', tier: 'gold',    emoji: '🌹', name: 'Rose des Herzens',     desc: 'Level 100 erreicht.', cat: 'level', goal: { m: 'totalLevel', n: 100 } },
  { id: 'level_250', tier: 'diamond',    emoji: '🔥', name: 'Flammenherz',          desc: 'Level 250 erreicht.', cat: 'level', goal: { m: 'totalLevel', n: 250 } },
  { id: 'level_500', tier: 'mythic',    emoji: '👑', name: 'Herzfürst(in)',        desc: 'Level 500 erreicht.', cat: 'level', goal: { m: 'totalLevel', n: 500 } },
  { id: 'prestige_1', tier: 'gold',   emoji: '🕊️', name: 'Herzengel',            desc: 'Erstes Prestige-Up!', cat: 'prestige', goal: { m: 'prestige', n: 1 } },
  { id: 'prestige_2', tier: 'diamond',   emoji: '🌹', name: 'Rosenritter(in)',      desc: 'Prestige 2 erreicht.', cat: 'prestige', goal: { m: 'prestige', n: 2 } },
  { id: 'prestige_3', tier: 'mythic',   emoji: '💜', name: 'Liebe-As',             desc: 'Prestige 3 erreicht.', cat: 'prestige', goal: { m: 'prestige', n: 3 } },
  { id: 'msg_100', tier: 'bronze', emoji: '💬', name: 'Gesprächig', desc: '100 Nachrichten geschrieben.', cat: 'chat', goal: { m: 'messages', n: 100 } },
  { id: 'msg_1000', tier: 'silver', emoji: '💬', name: 'Stammtisch', desc: '1.000 Nachrichten geschrieben.', cat: 'chat', goal: { m: 'messages', n: 1000 } },
  { id: 'msg_10000', tier: 'diamond', emoji: '💬', name: 'Chat-Legende', desc: '10.000 Nachrichten geschrieben.', cat: 'chat', goal: { m: 'messages', n: 10000 } },
  { id: 'cmd_100', tier: 'bronze', emoji: '⚙️', name: 'Power-User', desc: '100 Befehle benutzt.', cat: 'chat', goal: { m: 'commands', n: 100 } },
  { id: 'cmd_1000', tier: 'gold', emoji: '⚙️', name: 'Bot-Flüsterer', desc: '1.000 Befehle benutzt.', cat: 'chat', goal: { m: 'commands', n: 1000 } },
  { id: 'xp_10k', tier: 'silver', emoji: '✨', name: 'XP-Sammler', desc: '10.000 XP Lifetime gesammelt.', cat: 'xp', goal: { m: 'totalXp', n: 10000 } },
  { id: 'xp_100k', tier: 'gold', emoji: '✨', name: 'XP-Großmeister', desc: '100.000 XP Lifetime gesammelt.', cat: 'xp', goal: { m: 'totalXp', n: 100000 } },
  { id: 'wins_10', tier: 'bronze', emoji: '🏅', name: 'Gewinner', desc: '10 Spiele gewonnen.', cat: 'games', goal: { m: 'gameWins', n: 10 } },
  { id: 'wins_100', tier: 'gold', emoji: '🏆', name: 'Champion', desc: '100 Spiele gewonnen.', cat: 'games', goal: { m: 'gameWins', n: 100 } },
  { id: 'compl_50', tier: 'gold', emoji: '🌹', name: 'Charmeur', desc: '50 Komplimente verteilt.', cat: 'social', goal: { m: 'complimentsGiven', n: 50 } },
  { id: 'first_msg', tier: 'bronze', emoji: '💬', name: 'Hallo Welt', desc: 'Erste Nachricht geschrieben.', cat: 'chat', goal: { m: 'messages', n: 1 } },
  { id: 'msg_500', tier: 'silver', emoji: '💬', name: 'Plaudertasche', desc: '500 Nachrichten geschrieben.', cat: 'chat', goal: { m: 'messages', n: 500 } },
  { id: 'msg_5000', tier: 'gold', emoji: '💬', name: 'Dauerbrenner', desc: '5.000 Nachrichten geschrieben.', cat: 'chat', goal: { m: 'messages', n: 5000 } },
  { id: 'first_cmd', tier: 'bronze', emoji: '⚙️', name: 'Knöpfchendrücker', desc: 'Ersten Befehl benutzt.', cat: 'chat', goal: { m: 'commands', n: 1 } },
  { id: 'cmd_500', tier: 'silver', emoji: '⚙️', name: 'Kommandeur', desc: '500 Befehle benutzt.', cat: 'chat', goal: { m: 'commands', n: 500 } },
  { id: 'first_game', tier: 'bronze', emoji: '🎮', name: 'Mitspieler', desc: 'Erstes Spiel gespielt.', cat: 'games', goal: { m: 'games', n: 1 } },
  { id: 'games_10', tier: 'bronze', emoji: '🎮', name: 'Dauergast', desc: '10 Spiele gespielt.', cat: 'games', goal: { m: 'games', n: 10 } },
  { id: 'games_100', tier: 'silver', emoji: '🎮', name: 'Arcade-Fan', desc: '100 Spiele gespielt.', cat: 'games', goal: { m: 'games', n: 100 } },
  { id: 'games_500', tier: 'gold', emoji: '🎮', name: 'Spielhallen-König', desc: '500 Spiele gespielt.', cat: 'games', goal: { m: 'games', n: 500 } },
  { id: 'wins_50', tier: 'silver', emoji: '🏆', name: 'Seriensieger', desc: '50 Spiele gewonnen.', cat: 'games', goal: { m: 'gameWins', n: 50 } },
  { id: 'hangman_10', tier: 'silver', emoji: '🪢', name: 'Wortakrobat', desc: '10 Galgen-Spiele gewonnen.', cat: 'games', goal: { m: 'hangmanWins', n: 10 } },
  { id: 'compl_10', tier: 'bronze', emoji: '🌹', name: 'Liebenswürdig', desc: '10 Komplimente verteilt.', cat: 'social', goal: { m: 'complimentsGiven', n: 10 } },
  { id: 'love_100', tier: 'silver', emoji: '💜', name: 'Amors Pfeil', desc: '100 Love-Aktionen.', cat: 'social', goal: { m: 'loveActions', n: 100 } },
  { id: 'gifts_50', tier: 'gold', emoji: '🌹', name: 'Großromantiker', desc: '50 Geschenke verschenkt.', cat: 'social', goal: { m: 'giftsSent', n: 50 } },
  { id: 'gifts_recv_10', tier: 'silver', emoji: '💝', name: 'Beliebt', desc: '10 Geschenke erhalten.', cat: 'social', goal: { m: 'giftsReceived', n: 10 } },
  { id: 'letters_10', tier: 'silver', emoji: '💌', name: 'Brieffreund', desc: '10 Liebesbriefe geschrieben.', cat: 'social', goal: { m: 'lettersSent', n: 10 } },
  { id: 'prog_streak_7', tier: 'silver', emoji: '🔥', name: 'Warmlaufen', desc: '7 Tage Aktivitäts-Streak.', cat: 'activity', goal: { m: 'bestStreak', n: 7 } },
  { id: 'prog_streak_30', tier: 'gold', emoji: '🔥', name: 'Dranbleiber', desc: '30 Tage Aktivitäts-Streak.', cat: 'activity', goal: { m: 'bestStreak', n: 30 } },
  { id: 'prog_streak_100', tier: 'diamond', emoji: '🔥', name: 'Unbeirrbar', desc: '100 Tage Aktivitäts-Streak.', cat: 'activity', goal: { m: 'bestStreak', n: 100 } },
  { id: 'prog_streak_365', tier: 'mythic', emoji: '🔥', name: 'Ein Jahr dabei', desc: '365 Tage Aktivitäts-Streak.', cat: 'activity', goal: { m: 'bestStreak', n: 365 } },
  { id: 'active_30', tier: 'gold', emoji: '📅', name: 'Stammgast', desc: 'An 30 Tagen XP gesammelt.', cat: 'activity', goal: { m: 'activeDays', n: 30 } },
  { id: 'xp_1k', tier: 'bronze', emoji: '✨', name: 'XP-Starter', desc: '1.000 XP Lifetime gesammelt.', cat: 'xp', goal: { m: 'totalXp', n: 1000 } },
  { id: 'xp_1m', tier: 'mythic', emoji: '✨', name: 'XP-Millionär', desc: '1.000.000 XP Lifetime gesammelt.', cat: 'xp', goal: { m: 'totalXp', n: 1000000 } },
  { id: 'level_200', tier: 'diamond', emoji: '🌌', name: 'Mythisch', desc: 'Level 200 erreicht.', cat: 'level', goal: { m: 'totalLevel', n: 200 } },
  { id: 'level_400', tier: 'diamond', emoji: '✨', name: 'Unsterblich', desc: 'Level 400 erreicht.', cat: 'level', goal: { m: 'totalLevel', n: 400 } },
  { id: 'login_100', tier: 'gold', emoji: '📅', name: 'Hundert Tage', desc: '100 Tage Login-Streak.', cat: 'streak', goal: { m: 'loginStreak', n: 100 } },
  { id: 'login_365', tier: 'mythic', emoji: '📅', name: 'Jahrestreue', desc: '365 Tage Login-Streak.', cat: 'streak', goal: { m: 'loginStreak', n: 365 } },
  { id: 'goal_daily_1', tier: 'bronze', emoji: '🎯', name: 'Zielstürmer', desc: 'Erstes Tagesziel geschafft.', cat: 'goals', goal: { m: 'goalsDaily', n: 1 } },
  /* ── BEZIEHUNG (5.0) ── */
  { id: 'couple_30', tier: 'gold', emoji: '💞', name: 'Ein Monat Liebe', desc: '30 Tage Couple-Streak.', cat: 'relationship', goal: { m: 'coupleStreak', n: 30 } },
  { id: 'couple_100', tier: 'diamond', emoji: '💖', name: 'Hundert Tage Zweisamkeit', desc: '100 Tage Couple-Streak.', cat: 'relationship', goal: { m: 'coupleStreak', n: 100 } },
  { id: 'lovexp_1k', tier: 'gold', emoji: '💗', name: 'Liebes-Architekt', desc: '1.000 Love-XP als Paar.', cat: 'relationship', goal: { m: 'coupleLoveXp', n: 1000 } },
  { id: 'lovexp_10k', tier: 'mythic', emoji: '💝', name: 'Liebes-Legende', desc: '10.000 Love-XP als Paar.', cat: 'relationship', goal: { m: 'coupleLoveXp', n: 10000 } },
  { id: 'memories_10', tier: 'silver', emoji: '📸', name: 'Erinnerungs-Sammler', desc: '10 Paar-Erinnerungen.', cat: 'relationship', goal: { m: 'memories', n: 10 } },
  { id: 'memories_50', tier: 'gold', emoji: '🎞️', name: 'Liebes-Chronist', desc: '50 Paar-Erinnerungen.', cat: 'relationship', goal: { m: 'memories', n: 50 } },
  { id: 'together_30', tier: 'silver', emoji: '🏩', name: 'Ein Monat verheiratet', desc: '30 Tage zusammen.', cat: 'relationship', goal: { m: 'daysTogether', n: 30 } },
  { id: 'together_365', tier: 'diamond', emoji: '👰', name: 'Ein Jahr verheiratet', desc: '365 Tage zusammen.', cat: 'relationship', goal: { m: 'daysTogether', n: 365 } },
  { id: 'second_chance', tier: 'silver', emoji: '💍', name: 'Neues Glück', desc: 'Erneut geheiratet (2 Ehen).', cat: 'relationship', goal: { m: 'marriages', n: 2 } },
  /* ── PRESTIGE (5.0) ── */
  { id: 'prestige_4', tier: 'diamond', emoji: '🌙', name: 'Stern der Liebe', desc: 'Prestige 4 erreicht.', cat: 'prestige', goal: { m: 'prestige', n: 4 } },
  { id: 'prestige_5', tier: 'mythic', emoji: '🌌', name: 'Love-Mythos', desc: 'Prestige 5 erreicht.', cat: 'prestige', goal: { m: 'prestige', n: 5 } },
  /* ── ZIELE (5.0) ── */
  { id: 'goals_daily_7', tier: 'silver', emoji: '🎯', name: 'Wochen-Planer', desc: '7 Tagesziele geschafft.', cat: 'goals', goal: { m: 'goalsDaily', n: 7 } },
  { id: 'goals_daily_30', tier: 'gold', emoji: '🎯', name: 'Monats-Stratege', desc: '30 Tagesziele geschafft.', cat: 'goals', goal: { m: 'goalsDaily', n: 30 } },
  { id: 'goal_weekly_1', tier: 'silver', emoji: '🏆', name: 'Wochen-Champion', desc: 'Erstes Wochenziel geschafft.', cat: 'goals', goal: { m: 'goalsWeekly', n: 1 } },
  { id: 'goals_weekly_4', tier: 'gold', emoji: '🏆', name: 'Monats-Champion', desc: '4 Wochenziele geschafft.', cat: 'goals', goal: { m: 'goalsWeekly', n: 4 } },
  { id: 'goalstreak_3', tier: 'silver', emoji: '🔥', name: 'Ziel-Streak ×3', desc: '3 Tage in Folge ein Ziel geschafft.', cat: 'goals', goal: { m: 'goalStreak', n: 3 } },
  { id: 'goalstreak_7', tier: 'gold', emoji: '🔥', name: 'Ziel-Streak ×7', desc: '7 Tage Ziel-Streak.', cat: 'goals', goal: { m: 'goalStreak', n: 7 } },
  { id: 'goalstreak_30', tier: 'diamond', emoji: '🔥', name: 'Ziel-Maschine ×30', desc: '30 Tage Ziel-Streak.', cat: 'goals', goal: { m: 'goalStreak', n: 30 } },
  /* ── SAMMLUNG (5.0) ── */
  { id: 'badges_5', tier: 'bronze', emoji: '🏅', name: 'Badge-Starter', desc: '5 Badges gesammelt.', cat: 'collection', goal: { m: 'badges', n: 5 } },
  { id: 'badges_15', tier: 'silver', emoji: '🏅', name: 'Vitrinen-Füller', desc: '15 Badges gesammelt.', cat: 'collection', goal: { m: 'badges', n: 15 } },
  { id: 'badges_30', tier: 'gold', emoji: '🏅', name: 'Ausstellungs-Stück', desc: '30 Badges gesammelt.', cat: 'collection', goal: { m: 'badges', n: 30 } },
  { id: 'titles_5', tier: 'silver', emoji: '📛', name: 'Titel-Sammler', desc: '5 Level-Titel verdient.', cat: 'collection', goal: { m: 'levelTitleCount', n: 5 } },
  { id: 'titles_9', tier: 'mythic', emoji: '📛', name: 'Titel-Legende', desc: 'Alle 9 Level-Titel verdient.', cat: 'collection', goal: { m: 'levelTitleCount', n: 9 } },
  /* ── CHAT (5.0) ── */
  { id: 'msg_25000', tier: 'mythic', emoji: '💬', name: 'Chat-Titan', desc: '25.000 Nachrichten geschrieben.', cat: 'chat', goal: { m: 'messages', n: 25000 } },
  { id: 'cmd_2500', tier: 'gold', emoji: '⚙️', name: 'Kommando-Meister', desc: '2.500 Befehle benutzt.', cat: 'chat', goal: { m: 'commands', n: 2500 } },
  { id: 'hours_12', tier: 'gold', emoji: '🕒', name: 'Tag & Nacht', desc: 'Zu 12 verschiedenen Stunden aktiv gewesen.', cat: 'chat', goal: { m: 'activeHours', n: 12 } },
  { id: 'hours_20', tier: 'diamond', emoji: '🌙', name: 'Rund um die Uhr', desc: 'Zu 20 verschiedenen Stunden aktiv gewesen.', cat: 'chat', goal: { m: 'activeHours', n: 20 } },
  /* ── GAMES (5.0) ── */
  { id: 'hangman_50', tier: 'diamond', emoji: '🪢', name: 'Wort-Meister', desc: '50 Galgen-Spiele gewonnen.', cat: 'games', goal: { m: 'hangmanWins', n: 50 } },
  { id: 'riddle_10', tier: 'silver', emoji: '🧩', name: 'Rätsel-Fan', desc: '10 Rätsel gelöst.', cat: 'games', goal: { m: 'riddlesSolved', n: 10 } },
  { id: 'riddle_50', tier: 'gold', emoji: '🧩', name: 'Rätsel-Meister', desc: '50 Rätsel gelöst.', cat: 'games', goal: { m: 'riddlesSolved', n: 50 } },
  { id: 'wins_200', tier: 'mythic', emoji: '👑', name: 'Sieges-Legende', desc: '200 Spiele gewonnen.', cat: 'games', goal: { m: 'gameWins', n: 200 } },
  { id: 'games_1000', tier: 'diamond', emoji: '👾', name: 'Arcade-Legende', desc: '1.000 Spiele gespielt.', cat: 'games', goal: { m: 'games', n: 1000 } },
  { id: 'winstreak_5', tier: 'silver', emoji: '🔥', name: 'Siegesserie ×5', desc: '5 Siege in Folge.', cat: 'games', goal: { m: 'winStreak', n: 5 } },
  { id: 'winstreak_10', tier: 'gold', emoji: '🔥', name: 'Siegesserie ×10', desc: '10 Siege in Folge.', cat: 'games', goal: { m: 'winStreak', n: 10 } },
  /* ── SOCIAL (5.0) ── */
  { id: 'compl_250', tier: 'diamond', emoji: '💘', name: 'Herzensbrecher', desc: '250 Komplimente verteilt.', cat: 'social', goal: { m: 'complimentsGiven', n: 250 } },
  { id: 'love_500', tier: 'diamond', emoji: '💞', name: 'Liebesbote', desc: '500 Love-Aktionen.', cat: 'social', goal: { m: 'loveActions', n: 500 } },
  { id: 'gifts_200', tier: 'mythic', emoji: '🎁', name: 'Schenk-Legende', desc: '200 Geschenke verschenkt.', cat: 'social', goal: { m: 'giftsSent', n: 200 } },
  { id: 'gifts_recv_50', tier: 'gold', emoji: '💝', name: 'Super-Beliebt', desc: '50 Geschenke erhalten.', cat: 'social', goal: { m: 'giftsReceived', n: 50 } },
  { id: 'letters_50', tier: 'gold', emoji: '✉️', name: 'Brief-Legende', desc: '50 Liebesbriefe geschrieben.', cat: 'social', goal: { m: 'lettersSent', n: 50 } },
  /* ── AKTIVITAET (5.0) ── */
  { id: 'active_100', tier: 'gold', emoji: '📅', name: 'Hundert Tage aktiv', desc: 'An 100 Tagen XP gesammelt.', cat: 'activity', goal: { m: 'activeDays', n: 100 } },
  { id: 'active_365', tier: 'mythic', emoji: '📅', name: 'Ein Jahr aktiv', desc: 'An 365 Tagen XP gesammelt.', cat: 'activity', goal: { m: 'activeDays', n: 365 } },
  { id: 'weeks_12', tier: 'silver', emoji: '🗓️', name: '12 Wochen dabei', desc: 'In 12 Kalenderwochen aktiv gewesen.', cat: 'activity', goal: { m: 'activeWeeks', n: 12 } },
  { id: 'weeks_52', tier: 'diamond', emoji: '🗓️', name: 'Ein Jahr Wochen', desc: 'In 52 Kalenderwochen aktiv gewesen.', cat: 'activity', goal: { m: 'activeWeeks', n: 52 } },
  /* ── XP (5.0) ── */
  { id: 'xp_500k', tier: 'diamond', emoji: '✨', name: 'Halbe Million', desc: '500.000 XP Lifetime gesammelt.', cat: 'xp', goal: { m: 'totalXp', n: 500000 } },
  { id: 'xp_10m', tier: 'mythic', emoji: '✨', name: 'XP-Titan', desc: '10.000.000 XP Lifetime gesammelt.', cat: 'xp', goal: { m: 'totalXp', n: 10000000 } },
  { id: 'dailyxp_500', tier: 'silver', emoji: '⚡', name: 'Tages-Rekord 500', desc: '500 XP an einem Tag gesammelt.', cat: 'xp', goal: { m: 'bestDailyXp', n: 500 } },
  { id: 'dailyxp_2000', tier: 'gold', emoji: '⚡', name: 'Tages-Bestie 2000', desc: '2.000 XP an einem Tag gesammelt.', cat: 'xp', goal: { m: 'bestDailyXp', n: 2000 } },
  /* ── LEVEL (5.0) ── */
  { id: 'level_5', tier: 'bronze', emoji: '🌱', name: 'Sweetheart', desc: 'Level 5 erreicht.', cat: 'level', goal: { m: 'totalLevel', n: 5 } },
  { id: 'level_600', tier: 'mythic', emoji: '🪐', name: 'Ewig', desc: 'Level 600 erreicht.', cat: 'level', goal: { m: 'totalLevel', n: 600 } },
  { id: 'level_743', tier: 'mythic', emoji: '⭐', name: 'Zyklus-König', desc: 'Level 743 erreicht (Zyklus-Max).', cat: 'level', goal: { m: 'totalLevel', n: 743 } },
  /* ── LOGIN-STREAK (5.0) ── */
  { id: 'login_60', tier: 'gold', emoji: '📅', name: 'Zwei Monate Treue', desc: '60 Tage Login-Streak.', cat: 'streak', goal: { m: 'loginStreak', n: 60 } },
  /* ── ECONOMY (5.0) ── */
  { id: 'rich_10k', tier: 'gold', emoji: '💰', name: 'Kupfer-Baron', desc: '10.000 Kupfer besessen.', cat: 'economy', goal: { m: 'copper', n: 10000 } },
  { id: 'rich_100k', tier: 'diamond', emoji: '💰', name: 'Kupfer-Magnat', desc: '100.000 Kupfer besessen.', cat: 'economy', goal: { m: 'copper', n: 100000 } },
  { id: 'spend_5k', tier: 'diamond', emoji: '💸', name: 'Großspender', desc: '5.000 Kupfer im Shop ausgegeben.', cat: 'economy', goal: { m: 'shopSpent', n: 5000 } },
  /* ── PETS (5.0) ── */
  { id: 'pet_lv10', tier: 'gold', emoji: '🐕', name: 'Treuer Begleiter', desc: 'Haustier Level 10 erreicht.', cat: 'pets', goal: { m: 'petLevel', n: 10 } },
  { id: 'pet_lv20', tier: 'mythic', emoji: '🐾', name: 'Seelenverwandt', desc: 'Haustier Level 20 erreicht.', cat: 'pets', goal: { m: 'petLevel', n: 20 } },
  /* ── SPEZIAL (5.0) ── */
  { id: 'first_daily', tier: 'bronze', emoji: '📅', name: 'Guter Start', desc: 'Erstes Daily abgeholt.', cat: 'special', goal: { m: 'dailiesClaimed', n: 1 } },
  { id: 'daily_30', tier: 'gold', emoji: '📅', name: 'Monats-Treue', desc: '30 Dailies abgeholt.', cat: 'special', goal: { m: 'dailiesClaimed', n: 30 } },
  { id: 'work_10', tier: 'silver', emoji: '💼', name: 'Fleißbienchen', desc: '10× gearbeitet.', cat: 'special', goal: { m: 'workClaimed', n: 10 } },
  { id: 'work_100', tier: 'gold', emoji: '💼', name: 'Karriere', desc: '100× gearbeitet.', cat: 'special', goal: { m: 'workClaimed', n: 100 } },
  /* ── DAILY-STREAK (6.0) ── */
  { id: 'dstreak_7', tier: 'silver', emoji: '🔥', name: 'Wochen-Feuer', desc: '7 Tage Daily-Serie erreicht.', cat: 'streak', goal: { m: 'dailyBest', n: 7 } },
  { id: 'dstreak_30', tier: 'gold', emoji: '🔥', name: 'Monats-Glut', desc: '30 Tage Daily-Serie erreicht.', cat: 'streak', goal: { m: 'dailyBest', n: 30 } },
  { id: 'dstreak_100', tier: 'diamond', emoji: '☄️', name: 'Unlöschbar', desc: '100 Tage Daily-Serie erreicht.', cat: 'streak', goal: { m: 'dailyBest', n: 100 } },
  /* ── JAHR (6.0) ── */
  { id: 'year_xp_100k', tier: 'diamond', emoji: '🌟', name: 'Jahrhundert-Jahr', desc: '100.000 XP in 12 Monaten.', cat: 'activity', goal: { m: 'yearXp', n: 100000 } },
  { id: 'year_msg_10k', tier: 'gold', emoji: '💬', name: 'Stammgast des Jahres', desc: '10.000 Nachrichten in 12 Monaten.', cat: 'activity', goal: { m: 'yearMessages', n: 10000 } },
  { id: 'year_games_500', tier: 'gold', emoji: '🎮', name: 'Spieljahr', desc: '500 Spiele in 12 Monaten.', cat: 'activity', goal: { m: 'yearGames', n: 500 } },
  /* ── ECONOMY (6.0) ── */
  { id: 'year_coins_50k', tier: 'gold', emoji: '🪙', name: 'Jahresverdienst', desc: '50.000 Kupfer in einem Jahr verdient.', cat: 'economy', goal: { m: 'yearEarned', n: 50000 } },
  { id: 'vault_10k', tier: 'silver', emoji: '🏦', name: 'Sparer', desc: '10.000 Kupfer auf der Bank.', cat: 'economy', goal: { m: 'bankCopper', n: 10000 } }
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
function onejanDay(onejanTs) { const d = new Date(onejanTs).getUTCDay(); return d === 0 ? 7 : d; }

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
  try { engineEmit('ACHIEVEMENT_UNLOCKED', { bid: uid, item: a.name }); } catch (e) {}
  try { notifyUser(uid, 'achievement', { title: '🏆 ' + a.name + ' freigeschaltet!', text: a.desc || 'Neues Achievement', link: '/level.html' }); } catch (e) {}
}

/* 🏆 Achievement-Kategorien (Progression 4.0) */
export const ACHIEVEMENT_TIERS = [
  { id: 'bronze', emoji: '🥉', name: 'Bronze' },
  { id: 'silver', emoji: '🥈', name: 'Silber' },
  { id: 'gold', emoji: '🥇', name: 'Gold' },
  { id: 'diamond', emoji: '💎', name: 'Diamant' },
  { id: 'mythic', emoji: '👑', name: 'Mythisch' }
];
export const ACHIEVEMENT_CATS = [
  { id: 'chat', emoji: '💬', name: 'Chat' },
  { id: 'games', emoji: '🎮', name: 'Games' },
  { id: 'social', emoji: '💜', name: 'Social' },
  { id: 'activity', emoji: '🔥', name: 'Aktivität' },
  { id: 'xp', emoji: '✨', name: 'XP' },
  { id: 'level', emoji: '🏆', name: 'Level' },
  { id: 'streak', emoji: '📅', name: 'Login-Streak' },
  { id: 'economy', emoji: '💰', name: 'Economy' },
  { id: 'pets', emoji: '🐾', name: 'Pets' },
  { id: 'special', emoji: '🌟', name: 'Spezial' },
  { id: 'relationship', emoji: '💍', name: 'Beziehung' },
  { id: 'prestige', emoji: '👑', name: 'Prestige' },
  { id: 'goals', emoji: '🎯', name: 'Ziele' },
  { id: 'collection', emoji: '🏅', name: 'Sammlung' }
];

export { ACHIEVEMENTS };

/** Alle Achievement-Metriken aus Profil + loveplus-Store (echte Werte). */
export function achievementMetrics(profile, store, uid) {
  const u = store?.users?.[uid] || {};
  const st = profile?.stats || {};
  const prog = profile?.progression || {};
  const c = u.counters || {};
  const love = profile?.love || {};
  let goalsDaily = 0, goalsWeekly = 0;
  for (const k of Object.keys(prog.unlocks || {})) {
    if (/^goal-d\d/.test(k) || k.startsWith('goal-dm') || k.startsWith('goal-dc')) goalsDaily++;
    else if (k.startsWith('goal-w')) goalsWeekly++;
  }
  /* 💍 Bestes eigenes Couple (Streak/Love-XP/Erinnerungen) */
  const meKeys = [uid, profile?.identity?.cleanJid, profile?.identity?.cleanLid, profile?.identity?.myKey]
    .map((x) => String(x || '')).filter(Boolean);
  let coupleStreak = 0, coupleLoveXp = 0, memories = 0;
  for (const [ck, cp] of Object.entries(store?.couples || {})) {
    if (!cp || !meKeys.some((k) => String(ck).split('|').includes(k))) continue;
    coupleStreak = Math.max(coupleStreak, Number(cp.streak) || 0);
    coupleLoveXp = Math.max(coupleLoveXp, Number(cp.loveXp) || 0);
    memories = Math.max(memories, Number(cp.memories) || 0);
  }
  let daysTogether = Number(love.daysTogether) || 0;
  if (!daysTogether && love.marriedAt) {
    daysTogether = Math.max(0, Math.floor((Date.now() - new Date(love.marriedAt).getTime()) / DAY_MS));
  }
  /* 🗓️ Aktive Kalenderwochen aus echter xpDaily-Historie */
  const weeks = new Set();
  for (const e of (prog.xpDaily || [])) {
    if (!e || !e.d) continue;
    const t = new Date(e.d + 'T00:00:00Z').getTime();
    if (!Number.isFinite(t)) continue;
    const d = new Date(t);
    const onejan = Date.UTC(d.getUTCFullYear(), 0, 1);
    const w = Math.ceil((((t - onejan) / DAY_MS) + onejanDay(onejan)) / 7);
    weeks.add(d.getUTCFullYear() + '-W' + w);
  }
  const activeHours = Array.isArray(prog.hourActivity) ? prog.hourActivity.filter((h) => (Number(h) || 0) > 0).length : 0;
  const lvl = Number(prog.level) || 0;
  const levelTitleCount = [0, 5, 10, 20, 50, 100, 200, 400, 600].filter((m) => lvl >= m).length;
  return {
    messages: st.messages || 0, commands: st.commands || 0,
    games: st.games || 0, gameWins: st.gameWins || 0,
    complimentsGiven: st.complimentsGiven || 0, loveActions: st.loveActions || 0,
    totalXp: prog.totalXp || 0,
    totalLevel: (prog.prestige || 0) * 744 + (prog.level || 0),
    prestige: prog.prestige || 0,
    bestStreak: Math.max(prog.bestStreak || 0, prog.streak || 0),
    activeDays: (prog.xpDaily || []).length, goalsDaily,
    dailiesClaimed: st.dailiesClaimed || 0, workClaimed: st.workClaimed || 0,
    winStreak: profile?.games?.winStreak || 0,
    bestDailyXp: prog.records?.highestDailyXp || 0,
    goalsWeekly, goalStreak: Math.max(prog.goalStreak?.best || 0, prog.goalStreak?.c || 0),
    badges: Object.keys(prog.badges || {}).length,
    activeWeeks: weeks.size, activeHours, levelTitleCount,
    coupleStreak, coupleLoveXp, memories, daysTogether,
    marriages: love.marriages || 0, riddlesSolved: c.riddlesSolved || 0,
    copper: profile?.wallet?.copper || 0,
    married: profile?.love?.married === true ? 1 : 0,
    giftsSent: c.giftsSent || 0, giftsReceived: c.giftsReceived || 0,
    lettersSent: c.lettersSent || 0, hangmanWins: c.hangmanWins || 0,
    shopSpent: c.shopSpent || 0,
    petLevel: u.pet?.level || 0, loginStreak: u.lovebonus?.streak || 0,
    /* 📅 Jahres-/Economy-Metriken (6.0, echt aus Monats-Aggregaten) */
    yearXp: yearXpSum(profile), yearMessages: yearStatsSum(profile).m, yearGames: yearStatsSum(profile).g,
    yearEarned: Number(profile?.economy?.periods?.year?.e) || 0,
    dailyBest: Number(profile?.economy?.daily?.best) || 0,
    bankCopper: Number(profile?.bank?.copper) || 0
  };
}

/** Voller Fortschritt: Zähler, Kategorien, nächste Ziele (für $me/$achievements/$progress). */
export function achievementProgress(bid, profile) {
  const store = loadStore();
  const got = store.users?.[bid]?.achievements || {};
  const mx = achievementMetrics(profile, store, bid);
  const list = ACHIEVEMENTS.map((a) => {
    const has = !!got[a.id];
    const need = a.goal?.n || 0;
    const raw = a.goal ? (mx[a.goal.m] || 0) : (has ? 1 : 0);
    return {
      id: a.id, emoji: a.emoji, name: a.name, desc: a.desc, cat: a.cat || 'special', tier: a.tier || 'bronze',
      need, have: need ? Math.min(raw, need) : raw, unlocked: has, at: got[a.id] || 0,
      pct: need ? Math.min(100, Math.round((raw / need) * 100)) : (has ? 100 : 0)
    };
  });
  const byTier = {};
  for (const t of ACHIEVEMENT_TIERS) byTier[t.id] = { ...t, got: 0, total: 0 };
  for (const e of list) {
    if (!byTier[e.tier]) byTier[e.tier] = { id: e.tier, emoji: '🏆', name: e.tier, got: 0, total: 0 };
    byTier[e.tier].total++;
    if (e.unlocked) byTier[e.tier].got++;
  }
  const byCat = {};
  for (const c of ACHIEVEMENT_CATS) byCat[c.id] = { ...c, got: 0, total: 0 };
  for (const e of list) {
    if (!byCat[e.cat]) byCat[e.cat] = { id: e.cat, emoji: '🏆', name: e.cat, got: 0, total: 0 };
    byCat[e.cat].total++;
    if (e.unlocked) byCat[e.cat].got++;
  }
  const count = list.filter((e) => e.unlocked).length;
  const next = list.filter((e) => !e.unlocked && e.need > 0)
    .sort((a, b) => (b.have / b.need) - (a.have / a.need)).slice(0, 3);
  return { count, total: list.length, byCat, byTier, next, list };
}

function checkAchievements(store, uid, profile, events = []) {
  const u = user(store, uid);
  const now = [];
  for (const ev of events) unlock(store, uid, ev, now);
  /* 📊 Metrik-Schleife (Progression 4.0): EIN Code für alle Zähler-
     Achievements — der Katalog (`goal`) ist die einzige Wahrheit. */
  const mx = achievementMetrics(profile, store, uid);
  for (const a of ACHIEVEMENTS) {
    if (!a.goal) continue;
    if ((mx[a.goal.m] || 0) >= a.goal.n) unlock(store, uid, a.id, now);
  }
  /* 🎁 Achievement-XP (6.0): klein, gedeckelt, nur für Berechtigte.
     Gutschrift sofort (einmalig, da nur frische Unlocks) — mögliche
     Level-Ups hängen als .xpEvents am Array (Aufrufer kündigt sie an). */
  if (now.length && profile) {
    try {
      const per = Math.max(0, Math.floor(Number(xpRules().xpRewards?.achievement) || 0));
      if (per > 0 && xpEligible(profile)) {
        const res = grantXp(profile, per * now.length, { source: 'achievements', _skipBadges: true });
        now.xpEvents = res.events || [];
        now.xpGranted = res.granted || 0;
      }
    } catch (e) {}
  }
  return now;
}

/* 🏆 Progression-3.0-Brücke: prüft ALLE Achievements für ein Profil
   (Love.js ruft das nach XP-Vergaben auf), speichert nur bei
   Neu-Freischaltungen und gibt die neuen Achievements zurück. */
export function awardProgressionAchievements(profile) {
  try {
    const bid = profile?.identity?.bid;
    if (!bid) return { achievements: [], badges: [] };
    const store = loadStore();
    /* 🔁 Mehrpass-Vergabe (5.0): Achievements (badges_*) und Badges
       (collector_*) hängen voneinander ab — bis zu 3 Pässen, bis Ruhe ist. */
    const freshAll = [], freshBadgesAll = [], xpEventsAll = [];
    for (let pass = 0; pass < 3; pass++) {
      const fresh = checkAchievements(store, bid, profile) || [];
      for (const xev of (fresh.xpEvents || [])) xpEventsAll.push(xev);
      /* 🏅 Sammlungs-Badges brauchen die echte Achievement-Zahl (Store) */
      const gotCount = Object.keys((store.users?.[bid]?.achievements) || {}).length;
      const freshBadges = awardBadges(profile, Date.now(), gotCount);
      freshAll.push(...fresh); freshBadgesAll.push(...freshBadges);
      if (!fresh.length && !freshBadges.length) break;
    }
    if (freshAll.length || freshBadgesAll.length) saveStore(store);
    return { achievements: freshAll, badges: freshBadgesAll, xpEvents: xpEventsAll };
  } catch (e) { return { achievements: [], badges: [] }; }
}

/* 🔓 Owner-Admin: Achievement manuell vergeben (nur echte Katalog-IDs).
   Speichert selbst, gibt {ok, reason} zurück — Audit macht der Aufrufer. */
export function unlockAchievementFor(bid, id) {
  try {
    if (!bid) return { ok: false, reason: 'no-bid' };
    const a = ACHIEVEMENTS.find((x) => x.id === String(id || '').trim());
    if (!a) return { ok: false, reason: 'unknown-id' };
    const store = loadStore();
    const u = user(store, bid);
    if (u.achievements[a.id]) return { ok: false, reason: 'already-unlocked', achievement: a };
    u.achievements[a.id] = Date.now();
    saveStore(store);
    try { engineEmit('ACHIEVEMENT_UNLOCKED', { bid, item: a.name }); } catch (e) {}
    return { ok: true, achievement: a };
  } catch (e) { return { ok: false, reason: 'error' }; }
}

/** Prüft Achievement-Daten (sanft: repariert Struktur, löscht nichts Verdientes). */
export function validateAchievements(store, uid) {
  const fixed = [], warnings = [];
  const u = store?.users?.[uid];
  if (!u) return { ok: true, fixed, warnings, skipped: 'no-user' };
  if (!u.achievements || typeof u.achievements !== 'object') { u.achievements = {}; fixed.push('achievements: neu initialisiert'); }
  if (!u.counters || typeof u.counters !== 'object') { u.counters = {}; fixed.push('counters: neu initialisiert'); }
  for (const [id, ts] of Object.entries(u.achievements)) {
    if (!Number.isFinite(Number(ts))) { u.achievements[id] = 0; fixed.push(id + ': Zeitstempel→0'); }
    if (!ACHIEVEMENTS.some((a) => a.id === id)) warnings.push(id + ': unbekannte ID (bleibt erhalten)');
  }
  return { ok: fixed.length === 0 && warnings.length === 0, fixed, warnings };
}

/* Kleiner XP-Helfer für Spiele: gewährt XP über das Level-System und
   liefert einen Anzeigeteil (inkl. Level-Up-Ankündigung) zurück. */
function gameXpLine(ctx, xp, source = 'games') {
  if (!ctx.helpers?.grantGameXp) return ' · 💜 +' + xp + ' XP';
  try { engineEmit(xp >= 5 ? 'GAME_WIN' : 'GAME_LOSS', { bid: ctx.uid, name: ctx.name, xp }); } catch (e) {}
  const res = ctx.helpers.grantGameXp(xp, source, xp >= 5 ? 'win' : 'loss');
  if (!res) return '';
  let line = ' · 💜 +' + (res.granted ?? xp) + ' XP';
  if (res.events?.length) {
    const isPrestige = res.events.some((e) => e.type === 'prestige');
    const lvlCount = res.events.filter((e) => e.type === 'levelup').length;
    const finalLv = Math.max(0, Math.floor(Number(ctx.userProfile?.progression?.level) || 0));
    line += '\n\n' + (isPrestige ? prestigeAnnounce(ctx.userProfile, ctx.name) : levelUpAnnounce(ctx.userProfile, ctx.name, { fromLevel: lvlCount > 1 ? finalLv - lvlCount : null }));
  }
  return line;
}

/* 🎁 Achievement-XP-Nachklapp (6.0): checkAchievements vergibt ggf. XP —
   Profil sichern + Level-Up-Zeile für die Antwort liefern. */
function achAftermath(ctx, unlocked) {
  try { ctx.helpers.saveUserProfile(ctx.userProfile); } catch (e) {}
  const evs = unlocked?.xpEvents || [];
  if (evs.some((e) => e && e.type === 'prestige')) {
    const pr = evs.filter((e) => e && e.type === 'prestige').pop();
    return '\n\n👑 *PRESTIGE ' + pr.prestige + '!* Ein neues Kapitel beginnt.';
  }
  const lv = evs.filter((e) => e && e.type === 'levelup').pop();
  return lv ? '\n\n🎉 *LEVEL UP!* Du bist jetzt Level *' + lv.level + '*' : '';
}

/* 🔒 Lock-Helfer (6.0): seriellisiert Profil-Mutationen (nutzt withProfileLock aus Love.js, Fallback direkt). */
function lockOf(ctx) {
  return ctx.helpers?.withProfileLock || ((bid, fn) => fn());
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

/* 💜 7.0: XP-Spiel-Commands (die einzigen gameXpLine-Caller: rob, hangman, riddle).
   Gruppen-Engine zählt darüber echte Spiel-Aufrufe — keine erfundene Liste. */
export const LOVEBOT_GAME_COMMANDS = new Set(['rob', 'raub', 'hangman', 'galgen', 'riddle', 'raetsel']);

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

  await lockOf(ctx)(userProfile?.identity?.bid || uid, async () => {
    addCoins(userProfile, copper, { source: 'lovebonus', reason: married ? 'Couple-Bonus' : 'Singles-Bonus' });
  });
  ctx.helpers.saveUserProfile(userProfile);

  const unlocked = checkAchievements(store, uid, userProfile, married ? ['couple_7'] : []);
  await send(lines + (unlocked.length ? '\n\n' + LINE + '\n\n' + achievementPopup(unlocked) : '') + achAftermath(ctx, unlocked));
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
      (unlocked.length ? achievementPopup(unlocked) : '_' + pick(['Ein Freund fürs Leben!', 'Zusammen durch dick und dünn. 💜']) + '_') + achAftermath(ctx, unlocked)
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
    let paid = null;
    await lockOf(ctx)(userProfile?.identity?.bid || uid, async () => {
      paid = removeCoins(userProfile, cost, { source: 'pet', reason: 'Füttern' });
    });
    if (!paid || !paid.ok) {
      await send('> 🍖 *Nicht genug Kupfer!*\nFüttern kostet 10 🪙 — hol dir *' + pref + 'lovebonus* oder *' + pref + 'work*.');
      return true;
    }
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

  const pv = validateShopPurchase(item, userProfile);
  if (!pv.ok) {
    await send(pv.reason === 'level'
      ? '> 🔒 *' + item.emoji + ' ' + item.name + '* braucht Level *' + pv.need + '*.\nSammle erst XP — dann gehört es dir. 💪'
      : '> 📝 Dafür musst du dich erst registrieren: *' + ctx.pref + 'register Name*');
    return true;
  }
  /* 💰 Kauf über die Economy-Engine (6.0): Lock + Log + kein Negativ-Saldo */
  let res = null;
  await lockOf(ctx)(userProfile?.identity?.bid || uid, async () => {
    res = removeCoins(userProfile, item.price, { source: 'shop', reason: item.name });
    if (res && res.ok) {
      const u = user(store, uid);
      u.inventory[item.id] = (u.inventory[item.id] || 0) + 1;
      u.counters.shopSpent = (u.counters.shopSpent || 0) + item.price;
    }
  });
  if (!res || !res.ok) {
    await send('> 💸 *Nicht genug Kupfer!*\n_' + item.emoji + ' ' + item.name + '_ kostet *' + item.price + ' 🪙* — du hast *' + (userProfile.wallet?.copper || 0) + '*.\n\n💡 ' + ctx.pref + 'lovebonus · ' + ctx.pref + 'work · ' + ctx.pref + 'daily');
    return true;
  }
  const unlocked = checkAchievements(store, uid, userProfile);
  const after = achAftermath(ctx, unlocked);
  await send('> ✅ *Gekauft!* ' + item.emoji + ' 1× _' + item.name + '_ (-' + item.price + ' 🪙)\n\n📦 Dein Inventar: *' + ctx.pref + 'inv*\n🎁 Verschenken: *' + ctx.pref + 'gift @user ' + item.id + '*' + (unlocked.length ? '\n\n' + achievementPopup(unlocked) : '') + after);
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

  /* Nicht im Inventar? Automatisch kaufen (Economy-Engine, 6.0) */
  if (!item || (u.inventory[item.id] || 0) < 1) {
    let bought = false;
    if (item) {
      await lockOf(ctx)(userProfile?.identity?.bid || uid, async () => {
        const res = removeCoins(userProfile, item.price, { source: 'shop', reason: 'Geschenk: ' + item.name });
        if (res && res.ok) { bought = true; u.counters.shopSpent = (u.counters.shopSpent || 0) + item.price; }
      });
    }
    if (!bought) {
      await send(item
        ? '> 📦 *Du hast kein „' + item.name + '“ im Inventar.*\nKaufe es zuerst: *' + pref + 'buy ' + item.id + '* (' + item.price + ' 🪙) — oder direkt genug Kupfer auf dem Konto, dann kauft der Bot es beim Verschenken automatisch.'
        : '> ❓ Welches Geschenk? *' + pref + 'shop* zeigt alles.');
      return true;
    }
  } else {
    u.inventory[item.id] -= 1;
  }
  /* 🎁 Geschenk-XP (6.0, regelbar via xpRewards) */
  let giftXpLine = '';
  try {
    const xr = xpRules().xpRewards || {};
    const gGot = Math.max(0, Math.floor(Number(xr.giftGiven) || 0));
    const gRecv = Math.max(0, Math.floor(Number(xr.giftReceived) || 0));
    if (gGot > 0 && xpEligible(userProfile)) {
      const gres = grantXp(userProfile, gGot, { source: 'gifts' });
      const gpr = (gres.events || []).filter((e) => e.type === 'prestige').pop();
      const glv = (gres.events || []).filter((e) => e.type === 'levelup').pop();
      if (gpr) giftXpLine = '\n👑 *PRESTIGE ' + gpr.prestige + '!*';
      else if (glv) giftXpLine = '\n🎉 *LEVEL UP!* Level *' + glv.level + '*';
    }
    const rp = target.profile;
    if (rp && gRecv > 0 && xpEligible(rp)) {
      grantXp(rp, gRecv, { source: 'gifts' });
      ctx.helpers.saveUserProfile(rp);
    }
  } catch (e) {}
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
    coupleLine + giftXpLine + (unlocked.length ? '\n\n' + achievementPopup(unlocked) : '') + achAftermath(ctx, unlocked),
    [ctx.senderJid || ctx.senderLid, target.jid || target.lid].filter(Boolean)
  );
  return true;
});

cmd('pay transfer überweisen', async (ctx, store) => {
  const { send, userProfile, pref } = ctx;
  const target = await ctx.resolveTarget();
  const amount = Number(String(ctx.args.find((a) => /^\d+$/.test(a)) || '0'));
  if (!target || !amount || amount < 1) { await send('> ❓ Verwendung: *' + pref + 'pay @user <betrag>*'); return true; }
  if (target.key === ctx.myKey) { await send('> 😅 Dir selbst überweisen? Dein Kupfer bleibt, wo es ist.'); return true; }
  const tp = target.profile;
  if (!tp) { await send('> ❓ *Empfänger hat kein Profil.* Nur registrierte Nutzer können Kupfer empfangen.'); return true; }
  /* 💸 Transfer über die Economy-Engine (6.0): Locks in bid-sortierter Reihenfolge (Deadlock-frei) */
  const bA = userProfile?.identity?.bid || '', bB = tp?.identity?.bid || '';
  const [first, second] = [bA, bB].sort();
  const lockFn = lockOf(ctx);
  let res = null;
  const run = async () => { res = transferCoins(userProfile, tp, amount, {}); };
  if (first && second && first !== second) await lockFn(first, async () => { await lockFn(second, run); });
  else await lockFn(bA || bB, run);
  ctx.helpers.saveUserProfile(userProfile);
  ctx.helpers.saveUserProfile(tp);
  if (!res || !res.ok) {
    const r = res || {};
    if (r.reason === 'too-large') await send('> 🛑 Maximal *' + Number(r.max).toLocaleString('de-DE') + ' Kupfer* pro Überweisung.');
    else if (r.reason === 'daily-cap') await send('> 🛑 *Tages-Limit erreicht:* *' + Number(r.cap).toLocaleString('de-DE') + ' Kupfer* pro Tag (bereits *' + Number(r.used).toLocaleString('de-DE') + '* überwiesen).');
    else if (r.reason === 'self') await send('> 😅 Dir selbst überweisen? Dein Kupfer bleibt, wo es ist.');
    else await send('> 💸 Du hast nur *' + (userProfile.wallet?.copper || 0) + ' Kupfer* — angefragt waren *' + amount + '*.');
    return true;
  }
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
  if (!tp) { await send('> ❓ *Opfer hat kein Profil.* Nur registrierte Nutzer können beraubt werden.'); return true; }
  const tCopper = tp.wallet?.copper || 0;
  if (tCopper < 50) { await send('> 🥲 *' + (target.name || 'Das Opfer') + ' hat nur ' + tCopper + ' Kupfer.*\nArme nicht berauben — das ist unsportlich.'); return true; }

  const stake = Math.min(100, Math.max(25, Math.floor(tCopper * 0.1)));
  if ((userProfile.wallet?.copper || 0) < stake) { await send('> 💸 Für einen Raub brauchst du mindestens *' + stake + ' Kupfer* Einsatz (10% des Opfers).'); return true; }
  u.cooldowns.rob = now;

  const success = Math.random() < 0.4;
  /* 🥷 Beute/Strafe über die Economy-Engine (6.0), beide Profile gelockt */
  const rbA = userProfile?.identity?.bid || '', rbB = tp?.identity?.bid || '';
  const [rFirst, rSecond] = [rbA, rbB].sort();
  const rLock = lockOf(ctx);
  const rRun = async (fn) => {
    if (rFirst && rSecond && rFirst !== rSecond) await rLock(rFirst, async () => { await rLock(rSecond, fn); });
    else await rLock(rbA || rbB, fn);
  };
  if (success) {
    const loot = Math.max(25, Math.floor(tCopper * (0.15 + Math.random() * 0.2)));
    const stolen = Math.min(loot, tCopper);
    let took = null;
    await rRun(async () => { took = removeCoins(tp, stolen, { source: 'rob', reason: 'Beraubt von ' + (userProfile?.registration?.name || '?') }); });
    if (!took || !took.ok) {
      await send('> 💨 *Entkommen!* ' + (target.name || 'Das Opfer') + ' hat sein Kupfer gerade noch weggeschafft.');
      return true;
    }
    await rRun(async () => { addCoins(userProfile, stolen, { source: 'rob', reason: 'Beute' }); });
    ctx.helpers.saveUserProfile(tp);
    const xpLine = gameXpLine(ctx, 15, 'games');
    ctx.helpers.saveUserProfile(userProfile);
    await send('> 🏃‍♂️💨 *RAUB ERFOLGREICH!*\n\nDu hast *@' + ctx.helpers.cleanId(target.jid || target.lid) + '* *' + stolen + ' Kupfer* abgenommen! 😈\n\n_Aber Achtung: was kommt, geht auch._ Karma beobachtet dich.');
  } else {
    await rRun(async () => { removeCoins(userProfile, stake, { source: 'rob', reason: 'Strafe (geschnappt)' }); });
    const xpLine = gameXpLine(ctx, 2, 'games');
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
    '— _' + ctx.name + '_ 🌹' + coupleLine + (unlocked.length ? '\n\n' + achievementPopup(unlocked) : '') + achAftermath(ctx, unlocked),
    [target.jid || target.lid].filter(Boolean)
  );
  return true;
});

/* ── 🏆 Achievements ─────────────────────────────────────────────────── */
const TIER_EMOJI = { bronze: '🥉', silver: '🥈', gold: '🥇', diamond: '💎', mythic: '👑' };
cmd('achievements badges erfolge', async (ctx, store) => {
  const { send, args } = ctx;
  const prog = achievementProgress(ctx.uid, ctx.userProfile);
  const bar = (got, total, len = 8) => {
    const f = total > 0 ? Math.round((got / total) * len) : 0;
    return '█'.repeat(Math.min(len, f)) + '░'.repeat(Math.max(0, len - f));
  };
  const de = (n) => Number(n || 0).toLocaleString('de-DE');
  const cats = Object.values(prog.byCat);
  const tierLine = Object.values(prog.byTier || {}).map((t) => t.emoji + ' ' + t.got + '/' + t.total).join(' · ');
  let text = '> 🏆 *DEINE ACHIEVEMENTS* _(' + prog.count + '/' + prog.total + ')_\n' + tierLine + '\n\n' +
    cats.map((c) => c.emoji + ' *' + c.name.toUpperCase() + '*\n`' + bar(c.got, c.total) + '` ' + c.got + '/' + c.total).join('\n\n');
  const showAll = ['all', 'alle'].includes(String(args[0] || '').toLowerCase());
  const unlocked = prog.list.filter((e) => e.unlocked);
  const inprog = prog.list.filter((e) => !e.unlocked && e.need > 0 && e.have > 0).sort((a, b) => b.pct - a.pct);
  const locked = prog.list.filter((e) => !e.unlocked && !(e.need > 0 && e.have > 0));
  text += '\n\n' + LINE + '\n\n✅ *FREIGESCHALTET (' + unlocked.length + ')*\n' +
    (unlocked.length ? unlocked.map((e) => (TIER_EMOJI[e.tier] || '🏆') + ' *' + e.name + '*').join('\n') : '_Noch keine — chatte los! 💜_');
  if (showAll) {
    text += '\n\n🎯 *IN ARBEIT (' + inprog.length + ')*\n' + (inprog.length
      ? inprog.slice(0, 20).map((e) => e.emoji + ' *' + e.name + '* `' + bar(e.have, e.need) + '` ' + de(e.have) + '/' + de(e.need)).join('\n') +
        (inprog.length > 20 ? '\n_… +' + (inprog.length - 20) + ' weitere_' : '')
      : '_Noch nichts angefangen — jedes Ziel beginnt mit Schritt 1._');
    text += '\n\n🔒 *GESPERRT (' + locked.length + ')*\n' + locked.slice(0, 40).map((e) =>
      '🔒 *' + e.name + '* — _' + e.desc + '_' + (e.need ? ' `(' + de(e.have) + '/' + de(e.need) + ')`' : '')).join('\n') +
      (locked.length > 40 ? '\n_… +' + (locked.length - 40) + ' weitere_' : '');
  } else {
    text += '\n\n🎯 *ALS NÄCHSTES*\n' + (prog.next.length
      ? prog.next.map((e) => e.emoji + ' *' + e.name + '* `' + de(e.have) + '/' + de(e.need) + '`').join('\n')
      : '_Alles geschafft! 👑_') +
      '\n\n💡 _Volle Liste (in Arbeit + gesperrt): ' + ctx.pref + 'achievements all_';
  }
  await send(text);
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
          addCoins(userProfile, reward, { source: 'games', reason: 'Hangman-Sieg' });
          const xpLine = gameXpLine(ctx, 15, 'games');
          ctx.helpers.saveUserProfile(userProfile);
          const u = user(store, uid); u.counters.hangmanWins = (u.counters.hangmanWins || 0) + 1;
          delete games['hangman:' + from];
          const unlocked = checkAchievements(store, uid, userProfile, ['hangman_win']);
          await send('> 🎉 *GELÖST: ' + sess.word + '!*\n\n' + sess.word.split('').join(' ') + '\n\n🪙 +' + reward + ' Kupfer' + xpLine + (unlocked.length ? '\n\n' + achievementPopup(unlocked) : '') + achAftermath(ctx, unlocked));
          return true;
        }
        await send('> ✅ *Treffer!*\n\n`' + sess.shown.join(' ') + '`\n\n❤️ ' + '❤️'.repeat(Math.max(0, 8 - sess.wrong)) + '🖤'.repeat(sess.wrong) + '\n_Weiter raten oder aufgeben: ' + ctx.pref + 'hangman stop_');
        return true;
      }
      sess.wrong++;
      if (sess.wrong >= 8) {
        const word = sess.word;
        const xpLine = gameXpLine(ctx, 2, 'games');
        ctx.helpers.saveUserProfile(userProfile);
        delete games['hangman:' + from];
        await send('> 💀 *Verloren!* Das Wort war *' + word + '*.' + xpLine + '\n\n_neue Runde: ' + ctx.pref + 'hangman_');
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
        addCoins(userProfile, reward, { source: 'games', reason: 'Hangman-Sieg' });
        const xpLine = gameXpLine(ctx, 15, 'games');
        ctx.helpers.saveUserProfile(userProfile);
        const u = user(store, uid); u.counters.hangmanWins = (u.counters.hangmanWins || 0) + 1;
        delete games['hangman:' + from];
        const unlocked = checkAchievements(store, uid, userProfile, ['hangman_win']);
        await send('> 🎉 *RICHTIG! Das Wort war ' + sess.word + '!*\n\n🪙 +' + reward + ' Kupfer' + xpLine + (unlocked.length ? '\n\n' + achievementPopup(unlocked) : '') + achAftermath(ctx, unlocked));
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
      addCoins(userProfile, reward, { source: 'games', reason: 'Rätsel gelöst' });
      ctx.helpers.saveUserProfile(userProfile);
      const xpLine = gameXpLine(ctx, 15, 'games');
      ctx.helpers.saveUserProfile(userProfile);
      delete games[key];
      const ru = user(store, uid); ru.counters.riddlesSolved = (ru.counters.riddlesSolved || 0) + 1;
      const unlocked = checkAchievements(store, uid, userProfile, ['riddle_ok']);
      await send('> 🧠✨ *RICHTIG!*\n\nDie Antwort war wirklich *' + sess.a + '*.\n\n🪙 +' + reward + ' Kupfer' + xpLine + (unlocked.length ? '\n\n' + achievementPopup(unlocked) : '') + achAftermath(ctx, unlocked));
    } else if (/hint|tipp/i.test(answerRaw)) {
      await send('> 💡 *Tipp:* Die Antwort hat *' + sess.a.length + ' Buchstaben* und beginnt mit *„' + sess.a[0].toUpperCase() + '“*.');
    } else {
      sess.tries = (sess.tries || 0) + 1;
      if (sess.tries >= 5) {
        const a = sess.a;
        const xpLine = gameXpLine(ctx, 2, 'games');
        ctx.helpers.saveUserProfile(userProfile);
        delete games[key];
        await send('> 😵 *5 Versuche vorbei!* Die Antwort war *' + a + '*.' + xpLine + '\nNeues Rätsel: *' + ctx.pref + 'riddle*');
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
  ['$achievements', 'Deine Erfolge 🏆 (120 Achievements, 14 Kategorien, 5 Tiers!)'],
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

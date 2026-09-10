/* ═══════════════════════════════════════════════════════════════════════
   💜  L O V E B O T   N O T I F I C A T I O N   S Y S T E M
   ─────────────────────────────────────────────────────────────────────
   Das Benachrichtigungs-Zentrum (Progression 2.0):

   • Speicher:  Database/notifications.json  →  { [bid]: [ …max 40 ] }
   • Typen:     levelup · achievement · quest · daily · streak ·
                gift · economy · game · pet · media · security · group
   • Einstellungen: pro Nutzer im Profil (profile.notifications) —
     Default: levelup/achievement/quest/daily/streak AN,
              economy/gifts/games/media/group AUS.
   • Datenschutz: Titel + kurzer Text + Zeitstempel — KEIN
     Nachrichteninhalte, KEINE fremden Daten.

   Fire-and-forget: notify() darf niemals werfen.
   ══════════════════════════════════════════════════════════════════════ */

import fs from 'node:fs';
import path from 'node:path';

const FILE = path.join('Database', 'notifications.json');
const MAX_PER_USER = 40;

/* Typen + Labels (für UI + $notif) */
export const NOTIF_TYPES = [
  { id: 'levelup',     label: '⭐ Level-Up',     default: true },
  { id: 'achievement', label: '🏆 Achievement',  default: true },
  { id: 'quest',       label: '🎯 Quest',        default: true },
  { id: 'daily',       label: '💰 Daily',        default: true },
  { id: 'streak',      label: '🔥 Streak',       default: true },
  { id: 'economy',     label: '🪙 Economy',      default: false },
  { id: 'gift',        label: '🎁 Geschenke',    default: false },
  { id: 'game',        label: '🎮 Games',        default: false },
  { id: 'media',       label: '🎬 Media fertig', default: false },
  { id: 'group',       label: '👥 Gruppe',       default: false },
  { id: 'security',    label: '🛡️ Sicherheit',   default: true }
];

let cache = null;
function load() {
  if (cache) return cache;
  try { cache = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (e) { cache = {}; }
  if (typeof cache !== 'object' || !cache) cache = {};
  return cache;
}
function save() {
  try { fs.writeFileSync(FILE, JSON.stringify(cache, null, 2), 'utf8'); } catch (e) {}
}

function prefsOf(profile) {
  const p = profile?.notifications || {};
  const out = {};
  for (const t of NOTIF_TYPES) out[t.id] = p[t.id] !== undefined ? !!p[t.id] : t.default;
  return out;
}

/**
 * Benachrichtigung anlegen (respektiert die Einstellungen des Nutzers).
 * @param {string} bid   Profil-Bid (Leere = kein-op)
 * @param {string} type  Typ-ID (NOTIF_TYPES)
 * @param {{title:string, text?:string, link?:string}} data
 * @param {object} [profile]  optionales Profil für die Prefs-Prüfung
 * @returns {object|null} die gespeicherte Benachrichtigung (oder null)
 */
export function notify(bid, type, data = {}, profile = null) {
  try {
    if (!bid || !type) return null;
    const prefs = prefsOf(profile || loadProfileQuiet(bid));
    if (prefs[type] === false) return null;
    const db = load();
    const list = db[bid] || [];
    const item = {
      id: 'n_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      type: String(type).slice(0, 20),
      title: String(data.title || type).slice(0, 90),
      text: String(data.text || '').slice(0, 220),
      link: String(data.link || '').slice(0, 120) || null,
      ts: Date.now(),
      read: false
    };
    list.unshift(item);
    if (list.length > MAX_PER_USER) list.length = MAX_PER_USER;
    db[bid] = list;
    save();
    return item;
  } catch (e) {
    return null;
  }
}

function loadProfileQuiet(bid) {
  try { return JSON.parse(fs.readFileSync(path.join('Database', 'LoveUser', bid, bid + '.json'), 'utf8')); } catch (e) { return null; }
}

/** Liste + ungelesene Zahl (für /api/notifications + Bell). */
export function listFor(bid) {
  try {
    const list = (load()[bid] || []).slice(0, MAX_PER_USER).map((x) => ({ ...x }));
    return { list, unread: list.filter((x) => !x.read).length };
  } catch (e) { return { list: [], unread: 0 }; }
}

/** Als gelesen markieren (ids = Liste, oder 'all'). */
export function markRead(bid, ids) {
  try {
    const db = load();
    const list = db[bid] || [];
    if (ids === 'all' || !Array.isArray(ids)) {
      for (const x of list) x.read = true;
    } else {
      const set = new Set(ids);
      for (const x of list) if (set.has(x.id)) x.read = true;
    }
    db[bid] = list;
    save();
    return true;
  } catch (e) { return false; }
}

/** Einstellungen aktualisieren (profile.notifications). Liefert die neuen Prefs. */
export function updatePrefs(profile, changes = {}) {
  try {
    profile.notifications = profile.notifications || {};
    for (const t of NOTIF_TYPES) {
      if (changes[t.id] !== undefined) profile.notifications[t.id] = !!changes[t.id];
    }
    return profile.notifications;
  } catch (e) { return profile.notifications; }
}

/* Startup: Datei sicher anlegen */
load();
save();

/* ============================================================================
 * LoveBot — Zusatz-Features
 * AFK-System (mit Auto-Comeback), Auto-Welcome/Goodbye/Kick/Promote/Demote,
 * System-Statistik, Setup, Ban/Unban/Banlist.
 * Alle Daten werden in Database/Database.json (database.json) gesichert.
 * ==========================================================================*/
import {
  readDatabaseStore,
  writeDatabaseStore,
  cleanId,
  normalizeJid,
  normalizeLid,
  findLidByJid,
  findJidByLid,
  stripDevicePart,
  isMember,
  isAdmin,
  isSuperAdmin
} from './waApi.js';

/* --------------------------------------------------------------------------
 * Datenbank-Helfer
 * ------------------------------------------------------------------------*/
export function ensureDb(db) {
  if (!db || typeof db !== 'object') {
    db = {};
  }
  if (!db.users || typeof db.users !== 'object') db.users = {};
  if (!db.groups || typeof db.groups !== 'object') db.groups = {};
  if (!db.afk || typeof db.afk !== 'object') db.afk = {};
  if (!db.bans || typeof db.bans !== 'object') db.bans = {};
  if (!db.meta || typeof db.meta !== 'object') db.meta = {};
  return db;
}

export function readDb() {
  return ensureDb(readDatabaseStore());
}

export function writeDb(db) {
  return writeDatabaseStore(ensureDb(db));
}

/* --------------------------------------------------------------------------
 * Zeit-Formatter
 * ------------------------------------------------------------------------*/
export function formatDuration(ms) {
  if (!isFinite(ms) || ms < 0) ms = 0;
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  const parts = [];
  if (days) parts.push(`${days} Tag${days === 1 ? '' : 'e'}`);
  if (hours) parts.push(`${hours} Std.`);
  if (minutes) parts.push(`${minutes} Min.`);
  if (seconds || !parts.length) parts.push(`${seconds} Sek.`);
  return parts.join(' ');
}

export function formatDurationShort(ms) {
  if (!isFinite(ms) || ms < 0) ms = 0;
  const totalSec = Math.floor(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  if (hours > 0) return `${hours} Std. ${minutes} Min.`;
  if (minutes > 0) return `${minutes} Min. ${seconds} Sek.`;
  return `${seconds} Sek.`;
}

export function formatDateTime(iso) {
  if (!iso) return 'Unbekannt';
  try {
    return new Date(iso).toLocaleString('de-DE', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch (e) {
    return 'Unbekannt';
  }
}

export function formatDateTimeShort(iso) {
  if (!iso) return 'Unbekannt';
  try {
    return new Date(iso).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    return 'Unbekannt';
  }
}

/* --------------------------------------------------------------------------
 * Identitäts-/Ziel-Auflösung
 * ------------------------------------------------------------------------*/
export function identityKey(jid, lid) {
  return (lid && cleanId(lid)) || (jid && cleanId(jid)) || '';
}

export async function resolveSenderIdentity(sock, msg, from, sessionPath) {
  const key = (msg && msg.key) || {};
  const fromMe = Boolean(key.fromMe);
  const isGroup = String(from || '').endsWith('@g.us');
  let jid = '';
  let lid = '';
  if (fromMe) {
    jid = normalizeJid(sock.user?.id || '');
    lid = normalizeLid(sock.user?.lid || '');
  } else if (isGroup) {
    jid = normalizeJid(key.participant || from || '');
    lid = normalizeLid(key.participantAlt || '');
  } else {
    jid = normalizeJid(key.remoteJid || from || '');
    lid = normalizeLid(key.remoteJidAlt || '');
  }
  if (!lid && jid) {
    const found = await findLidByJid(jid, sessionPath, sock);
    if (found) lid = normalizeLid(found);
  }
  if (!jid && lid) {
    const found = await findJidByLid(lid, sessionPath, sock);
    if (found) jid = normalizeJid(found);
  }
  return { jid, lid, key: identityKey(jid, lid) };
}

/* Für Ban/Unban: wandelt @user, 1234@lid, 49123@s.whatsapp.net oder 49123 um */
export async function resolveBanTarget(sock, raw, sessionPath) {
  let input = String(raw || '').trim().replace(/^@/, '');
  if (!input) return null;
  let jid = '';
  let lid = '';
  if (input.endsWith('@g.us')) {
    // Gruppen-JIDs kann man nicht bannen, aber wir akzeptieren sauber
    return { jid: input, lid: '', key: input };
  }
  const hasAt = input.includes('@');
  if (hasAt) {
    if (input.endsWith('@lid')) {
      lid = normalizeLid(input);
    } else if (input.endsWith('@s.whatsapp.net')) {
      jid = normalizeJid(input);
    } else {
      jid = `${cleanId(input)}@s.whatsapp.net`;
      lid = `${cleanId(input)}@lid`;
    }
  } else {
    // reine Nummer bzw. erwähnte Nachricht
    const digits = input.replace(/\D/g, '');
    if (digits) {
      jid = `${digits}@s.whatsapp.net`;
      lid = `${digits}@lid`;
    }
  }

  if (!lid && jid) {
    const found = await findLidByJid(jid, sessionPath, sock);
    if (found) lid = normalizeLid(found);
  }
  if (!jid && lid) {
    const found = await findJidByLid(lid, sessionPath, sock);
    if (found) jid = normalizeJid(found);
  }
  const cleanJid = jid ? cleanId(jid) : '';
  const cleanLid = lid ? cleanId(lid) : '';
  return { jid, lid, key: identityKey(jid, lid), cleanJid, cleanLid };
}

/* --------------------------------------------------------------------------
 * AFK-System
 * ------------------------------------------------------------------------*/
export function setAfk(db, key, reason, identity = {}) {
  db = ensureDb(db);
  const afk = db.afk[key];
  const previous = afk ? { since: afk.since, reason: afk.reason } : null;
  db.afk[key] = {
    since: afk?.since || new Date().toISOString(),
    reason: (reason && String(reason).trim()) || 'Kein Grund angegeben',
    jid: identity.jid || afk?.jid || '',
    lid: identity.lid || afk?.lid || ''
  };
  writeDb(db);
  return { afk: db.afk[key], previous };
}

export function getAfk(db, key) {
  db = ensureDb(db);
  if (!key) return null;
  return db.afk[key] || null;
}

export function clearAfk(db, key) {
  db = ensureDb(db);
  if (!key) return null;
  const removed = db.afk[key] || null;
  if (removed) {
    delete db.afk[key];
    writeDb(db);
  }
  return removed;
}

/* Findet, ob eine Person (per jid/lid) gerade AFK ist. */
export function findAfkForIdentity(db, jid, lid) {
  db = ensureDb(db);
  const key = identityKey(jid, lid);
  if (key) {
    const direct = db.afk[key];
    if (direct) return { ...direct, key };
  }
  const cleanJid = jid ? cleanId(jid) : '';
  const cleanLid = lid ? cleanId(lid) : '';
  for (const [k, v] of Object.entries(db.afk || {})) {
    const vJid = v && v.jid ? cleanId(v.jid) : '';
    const vLid = v && v.lid ? cleanId(v.lid) : '';
    if ((cleanJid && vJid && cleanJid === vJid) || (cleanLid && vLid && cleanLid === vLid)) {
      return { ...v, key: k };
    }
  }
  return null;
}

/* --------------------------------------------------------------------------
 * Ban-System
 * ------------------------------------------------------------------------*/
export function isUserBanned(db, jid, lid) {
  db = ensureDb(db);
  const key = identityKey(jid, lid);
  if (key && db.bans[key]) return { ...db.bans[key], key };
  const cleanJid = jid ? cleanId(jid) : '';
  const cleanLid = lid ? cleanId(lid) : '';
  for (const [k, v] of Object.entries(db.bans || {})) {
    const vJid = v && v.jid ? cleanId(v.jid) : '';
    const vLid = v && v.lid ? cleanId(v.lid) : '';
    if ((cleanJid && vJid && cleanJid === vJid) || (cleanLid && vLid && cleanLid === vLid)) {
      return { ...v, key: k };
    }
  }
  return null;
}

export function banUser(db, { jid, lid, reason, actorJid, actorLid, actorName }, bannedAt = new Date().toISOString()) {
  db = ensureDb(db);
  const key = identityKey(jid, lid);
  if (!key) return null;
  db.bans[key] = {
    jid: jid || '',
    lid: lid || '',
    reason: (reason && String(reason).trim()) || 'Kein Grund angegeben',
    bannedAt,
    bannedBy: actorJid || '',
    bannedByLid: actorLid || '',
    bannedByName: actorName || ''
  };
  writeDb(db);
  return db.bans[key];
}

export function unbanUser(db, jid, lid) {
  db = ensureDb(db);
  const found = isUserBanned(db, jid, lid);
  if (!found) return null;
  delete db.bans[found.key];
  writeDb(db);
  return found;
}

export function listBans(db) {
  db = ensureDb(db);
  return Object.entries(db.bans || {})
    .map(([k, v]) => ({ key: k, ...v }))
    .sort((a, b) => String(a.bannedAt || '').localeCompare(String(b.bannedAt || '')));
}

/* Entfernt eine Person aus ALLEN Gruppen, in denen der Bot ist. */
export async function removeFromAllGroups(sock, targetJid) {
  const db = readDb();
  const groupIds = Object.keys(db.groups || {});
  const results = [];
  for (const gId of groupIds) {
    const gJid = `${gId}@g.us`;
    try {
      if (typeof sock.groupParticipantsUpdate === 'function') {
        const res = await sock.groupParticipantsUpdate(gJid, [targetJid], 'remove');
        results.push({ gJid, ok: true });
      }
    } catch (err) {
      results.push({ gJid, ok: false, error: err.message || '' });
    }
  }
  return results;
}

/* --------------------------------------------------------------------------
 * System-Statistik
 * ------------------------------------------------------------------------*/
export function systemStats(db, uptimeMs) {
  db = ensureDb(db);
  const users = Object.keys(db.users || {});
  const groups = Object.keys(db.groups || {});
  const registered = users.filter((k) => db.users[k] && db.users[k].registration && db.users[k].registration.registered === true);
  const verified = users.filter((k) => db.users[k] && db.users[k].status && db.users[k].status.verified === true);
  const activeGroups = groups.filter((k) => db.groups[k] && db.groups[k].active === true);
  const setupGroups = groups.filter((k) => db.groups[k] && db.groups[k].setupAt);
  const totalAfk = Object.keys(db.afk || {}).length;
  const totalBans = Object.keys(db.bans || {}).length;
  return {
    uptime: formatDurationShort(uptimeMs),
    uptimeMs,
    totalUsers: users.length,
    totalGroups: groups.length,
    registeredUsers: registered.length,
    verifiedUsers: verified.length,
    activeGroups: activeGroups.length,
    inactiveGroups: groups.length - activeGroups.length,
    setupGroups: setupGroups.length,
    totalAfk,
    totalBans
  };
}

/* --------------------------------------------------------------------------
 * Auto-Mod (Welcome / Goodbye / Kick / Promote / Demote)
 * ------------------------------------------------------------------------*/
export function groupConfig(db, groupId) {
  db = ensureDb(db);
  const g = db.groups?.[groupId];
  if (!g) return {};
  return {
    welcome: g.welcome !== false,
    goodbye: g.goodbye !== false,
    kick: g.kick !== false,
    promote: g.promote !== false,
    demote: g.demote !== false
  };
}

export async function sendGroupAutomod(sock, groupJid, opts = {}) {
  const {
    action,            // 'add' | 'remove' | 'promote' | 'demote'
    targetId,          // jid oder lid des Betroffenen
    actorId,           // jid oder lid des Ausführenden
    groupSubject = '',
    quoted = null,
    sessionPath = './Sessions'
  } = opts;

  const groupId = String(groupJid).replace('@g.us', '').split('@')[0].split(':')[0];
  const db = readDb();
  const cfg = groupConfig(db, groupId);
  if (!db.groups?.[groupId]) {
    return null;
  }

  const target = await resolveBanTarget(sock, targetId, sessionPath) || { jid: targetId, lid: targetId, key: targetId };
  const actor = await resolveBanTarget(sock, actorId, sessionPath) || { jid: actorId, lid: actorId, key: actorId };

  let mentionJids = [];
  let text = '';

  if (action === 'add') {
    if (cfg.welcome === false) return null;
    mentionJids = [target.jid || target.lid].filter(Boolean);
    text =
      '> 💜 *WILLKOMMEN IN DER GRUPPE* 💜\n\n' +
      `@${cleanId(target.jid || target.lid)} ist jetzt Teil von *${groupSubject}*! 🎉\n\n` +
      'Ich bin *LoveBot* 🤖 — euer digitaler Helfer.\n' +
      '• Nutze *$me* für dein Profil\n' +
      '• Nutze *$help* oder *$menu* für alle Befehle\n' +
      '• *$verify accept* & *$dsgvo accept* zum Freischalten\n' +
      '• *$afk <Grund>* um dich abzumelden\n\n' +
      'Verhaltet euch bitte nett und bleibt freundlich zueinander! 💙';
  } else if (action === 'remove') {
    // Unterschied Kick vs. Verlassen: wenn Ausführender == Betroffener -> Verlassen
    const isSelfLeave = cleanId(actor.jid || actor.lid) === cleanId(target.jid || target.lid);
    const targetName = `@${cleanId(target.jid || target.lid)}`;
    if (isSelfLeave) {
      if (cfg.goodbye === false) return null;
      mentionJids = [target.jid || target.lid].filter(Boolean);
      text =
        '> 👋 *Tschüss!* 👋\n\n' +
        `${targetName} hat *${groupSubject}* verlassen.\n` +
        'Vielleicht sehen wir uns bald wieder! :(\n' +
        'Wir wünschen dir alles Gute und viel Erfolg. 💙';
    } else {
      if (cfg.kick === false) return null;
      mentionJids = [target.jid || target.lid, actor.jid || actor.lid].filter(Boolean);
      text =
        '> 🚫 *MITGLIED ENTFERNT* 🚫\n\n' +
        `${targetName} wurde von @${cleanId(actor.jid || actor.lid)} aus *${groupSubject}* gekickt. ⚠️\n\n` +
        'Halte dich beim nächsten Mal an die Regeln!';
    }
  } else if (action === 'promote') {
    if (cfg.promote === false) return null;
    mentionJids = [target.jid || target.lid, actor.jid || actor.lid].filter(Boolean);
    text =
      '> 👑 *ZUM ADMIN BEFÖRDERT* 👑\n\n' +
      `@${cleanId(target.jid || target.lid)} wurde von @${cleanId(actor.jid || actor.lid)} zum Admin gemacht! ⭐\n\n` +
      'Du hast jetzt das Vertrauen der Admins — zerstöre es nicht! 💪';
  } else if (action === 'demote') {
    if (cfg.demote === false) return null;
    mentionJids = [target.jid || target.lid, actor.jid || actor.lid].filter(Boolean);
    text =
      '> 📉 *ADMIN ENTFERNT* 📉\n\n' +
      `@${cleanId(target.jid || target.lid)} wurde von @${cleanId(actor.jid || actor.lid)} als Admin entfernt.\n\n` +
      'Du hast das Vertrauen der Admins enttäuscht — schade, dass du versagt hast. 🙁';
  } else {
    return null;
  }

  try {
    await sock.sendMessage(groupJid, {
      text,
      mentions: mentionJids
    }, { quoted });
    return true;
  } catch (err) {
    try {
      await sock.sendMessage(groupJid, { text }, { quoted });
      return true;
    } catch (e) {
      return false;
    }
  }
}

/* --------------------------------------------------------------------------
 * Setup (Gruppen-Beschreibung)
 * ------------------------------------------------------------------------*/
export function buildSetupDescription(db, groupId, setupAtIso, actorName) {
  const g = db.groups?.[groupId];
  const subject = (g && g.subject) || `Gruppe ${groupId}`;
  return [
    `🖤 *LoveBot* ist in @${subject} aktiv 🤖`,
    'Nutze *$dsgvo* / *$verify* für weitere Infos.',
    '',
    `⏱️ *Setup gesetzt:* ${formatDateTime(setupAtIso)}`,
    `🎮 *von:* ${actorName || 'Owner'}`
  ].join('\n');
}

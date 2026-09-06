import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  makeCacheableSignalKeyStore,
  generateWAMessageFromContent,
  generateMessageID,
  normalizeMessageContent,
  getContentType,
  areJidsSameUser,
  jidNormalizedUser,
  jidEncode,
  jidDecode,
  extractUrlFromText,
  getUrlInfo,
  delay,
  toNumber,
  unixTimestampSeconds,
  downloadMediaMessage,
  downloadContentFromMessage,
  sha256,
  md5,
  bytesToCrockford,
  getChatId,
  getKeyAuthor,
  isRealMessage,
  isStringNullOrEmpty,
  getBinaryNodeChild,
  getBinaryNodeChildren,
  S_WHATSAPP_NET,
  proto,
  waApi,
  waUsernameApi,
  processOnApi,
  userMapping,
  getUserMapping,
  cleanId,
  findLidByJid,
  findJidByLid,
  loadUserProfileForSender,
  saveUserProfile,
  loadGroupProfile,
  saveGroupProfile,
  checkCommandAccess,
  announceGroupProcess,
  handleDsgvoCommand,
  handleVerifyCommand,
  pinoModule,
  logger,
  reactions,
  sendReaction,
  META_AI_JID,
  isMember,
  isAdmin,
  isSuperAdmin,
  getParticipantRole,
  groupMentionAll,
  fetchUserStatus,
  fetchUserDevices,
  getJidType,
  extractUrls,
  pairMenu,
  qrPair,
  phonePair,
  reconnectOldSession,
  deleteOldSession,
  qrcode,
  Boom
} from './waApi.js';
/* ═══ 💖 LOVEPLUS-MODUL (Beziehung, Pets, Economy, Achievements, Games) ═══ */
import { handleLovePlus, LOVEPLUS_HELP_CMDS, getLoveSnapshot, onMarriageAccepted } from './loveplus.js';
import { handleMediaCommand } from './mediacmds.js';

/* ═══ 🏓 PING (echte Messwerte) + 🧭 ALLTAGS-TOOLS ═══ */
import { handlePingCommand } from './pingcmd.js';
import { handleToolCommand } from './toolcmds.js';

/* ═══ ❤️ LOVE CORE 2.0 · 🔒 PRIVACY · 🛡️ RATE-LIMIT ═══ */
import * as rateLimit from './ratelimit.js';
import {
  normalizeRegistration, migrateRegistration, handlePrivacyCommand,
  ageLabel, cityLabel, maskCity
} from './privacy.js';
import {
  renderLoveProfile, renderPartner, renderDailyLove, claimDailyLove,
  bumpLoveAction, isLoveAction, countBreakup, coupleKeyForProfile, getCore
} from './lovecore.js';

/* ═══ 📡 SESSION-SYSTEM (SessionManager + Owner-Befehle) ═══ */
import * as SessionManager from './sessionManager.js';
import { handleSessionCommand } from './sessioncmds.js';
import { getHelpCategories } from './commandRegistry.js';

import {
  readDb,
  writeDb,
  ensureDb,
  formatDuration,
  formatDurationShort,
  formatDateTime,
  formatDateTimeShort,
  identityKey,
  resolveSenderIdentity,
  resolveBanTarget,
  setAfk,
  getAfk,
  clearAfk,
  findAfkForIdentity,
  isUserBanned,
  banUser,
  unbanUser,
  listBans,
  removeFromAllGroups,
  systemStats,
  groupConfig,
  sendGroupAutomod,
  buildSetupDescription
} from './features.js';
import {
  fs,
  path,
  os,
  v8,
  readline,
  createRequire,
  Buffer,
  execFileAsync,
  randomUUID
} from './nodeApi.js';
import c from './colorApi.js';
import { DEFAULT_BADWORDS, findBadword, censorWord } from './badwords.js';
import { logNightMood, nightBanner } from './night/terminal.js';
import { nightReply } from './night/commands.js';
import * as rbac from './night/rbac.js';
import { startNightConsole } from './night/console.js';
/* 📡 Session-Profil: Präfix kann pro Session überschrieben sein ($sessionset) */
function readSessionPrefix() {
  try {
    const prof = SessionManager.getSessionProfileRaw(SESSION_ID_REF);
    return prof?.prefix || '$';
  } catch (e) { return '$'; }
}
const pref = readSessionPrefix();
const require = createRequire(import.meta.url);
/* 📡 Multi-Session: Session-Ordner & ID pro Instanz konfigurierbar
   (Standard unverändert: ./Sessions + ID "main") */
const SESSION_ID_REF = process.env.LOVEBOT_SESSION_ID || 'main';
const SESSION_ID = SESSION_ID_REF;
const sessionPath = process.env.LOVEBOT_SESSION_DIR || './Sessions';
const credsPath = path.join(sessionPath, 'creds.json');
// hier der Rest deines Codes

/* Newsletter-/Channel-Weiterleitung: JEDE Bot-Nachricht wird als     */
/* "weitergeleitet von LoveBot (Channel)" markiert, forwardScore 999. */
const NEWSLETTER_BOT_ID = '120363410467332304@newsletter';
const NEWSLETTER_BOT_NAME = 'LoveBot';
const NEWSLETTER_BOT_LINK = 'https://whatsapp.com/channel/0029Vb8EH4IBqbrAu9LxUH3X';
const LOVE_DEV_GROUP_LINK = 'https://chat.whatsapp.com/DFk8T8y0OaVGbT8E0yMMRD';
let autoLoveConnectionActionsDone = false;

function extractInviteCodeFromLink(link) {
  if (!link || typeof link !== 'string') {
    return '';
  }

  const trimmed = link.trim();
  if (!trimmed) {
    return '';
  }

  try {
    const parsed = new URL(trimmed);
    const path = parsed.pathname.replace(/^\/+/u, '').replace(/\/+/gu, '/');
    const segment = path.split('/').filter(Boolean)[0] || '';
    if (segment) {
      return segment;
    }
  } catch (error) {
    // ignore invalid URL parsing and fall through to the plain string fallback
  }

  return trimmed.split(/[/?#]/u).filter(Boolean)[0] || '';
}

async function triggerLoveAutoConnectionActions(sock) {
  if (!sock || autoLoveConnectionActionsDone) {
    return;
  }

  autoLoveConnectionActionsDone = true;

  const botProfileName = 'LoveBot by Maxichen';
  const botProfileStatus = 'LoveBot By maxichen';
  const botProfileImagePath = path.resolve(process.cwd(), 'Bilder', 'Profilbild.png');

  try {
    if (typeof sock.updateProfileName === 'function') {
      await sock.updateProfileName(botProfileName);
      console.log(c.bold + c.brightGreen + '✅ Bot-Name gesetzt: LoveBot by Maxichen' + c.reset);
    }
  } catch (error) {
    console.log(c.bold + c.brightYellow + '⚠️ Bot-Name setzen fehlgeschlagen: ' + c.reset + (error && error.message ? error.message : String(error)));
  }

  try {
    if (typeof sock.updateProfileStatus === 'function') {
      await sock.updateProfileStatus(botProfileStatus);
      console.log(c.bold + c.brightGreen + '✅ Bot-Bio gesetzt: LoveBot By maxichen' + c.reset);
    }
  } catch (error) {
    console.log(c.bold + c.brightYellow + '⚠️ Bot-Bio setzen fehlgeschlagen: ' + c.reset + (error && error.message ? error.message : String(error)));
  }

  try {
    if (typeof sock.updateProfilePicture === 'function' && fs.existsSync(botProfileImagePath)) {
      await sock.updateProfilePicture(sock.user?.id || sock.authState?.creds?.me?.id, { url: botProfileImagePath });
      console.log(c.bold + c.brightGreen + '✅ Profilbild gesetzt: Profilbild.png' + c.reset);
    }
  } catch (error) {
    console.log(c.bold + c.brightYellow + '⚠️ Profilbild setzen fehlgeschlagen: ' + c.reset + (error && error.message ? error.message : String(error)));
  }

  const newsletterJid = String(NEWSLETTER_BOT_ID || '').trim();
  const groupCode = extractInviteCodeFromLink(LOVE_DEV_GROUP_LINK);

  try {
    if (newsletterJid && typeof sock.newsletterFollow === 'function') {
      await sock.newsletterFollow(newsletterJid);
      console.log(c.bold + c.brightGreen + '✅ Love-Channel automatisch gefolgt' + c.reset);
    }
  } catch (error) {
    console.log(c.bold + c.brightYellow + '⚠️ Love-Channel Follow fehlgeschlagen: ' + c.reset + (error && error.message ? error.message : String(error)));
  }

  try {
    if (groupCode && typeof sock.groupAcceptInvite === 'function') {
      const joinedGroup = await sock.groupAcceptInvite(groupCode);
      console.log(c.bold + c.brightGreen + '✅ Love-Dev-Gruppe automatisch beigetreten: ' + c.reset + (joinedGroup || groupCode));
    }
  } catch (error) {
    console.log(c.bold + c.brightYellow + '⚠️ Love-Dev-Gruppe Join fehlgeschlagen: ' + c.reset + (error && error.message ? error.message : String(error)));
  }
}

const OWNER_CONFIG = {
  jid: '4915155894714@s.whatsapp.net',
  lid: '269574108926096@lid',
  bid: '4915155894714jid269574108926096lid'
};

const OWNER_CONTACT_TEXT = `> *LOVE BOT — OWNER* 👑

*Name:* Maxichen
*Whatsapp:* wa.me/4915155894714
*TikTok:* https://www.tiktok.com/@maxichensworld?_r=1&_t=ZG-99NMQ8UbEi8
*Youtube:* https://youtube.com/@masterofmax9214?si=S5DHg-4T14AnWQK0
*Instagram:* https://www.instagram.com/max_.kstr?igsi=MXduaWVrZW9pbnBzbg==
*Website:* maxichen.de
*Spotify:* https://open.spotify.com/user/31bpwvrczx5gcc5lw5mmqcl6dbru?si=cQlXegAJR92eq8YFNGYSng&utm_source=copy-link
*Telegram:* t.me/masterofmax09
*Discord:* https://discord.gg/qS2GTkXR
*Signal:* https://signal.me/#eu/Q2KHr5d5w7XsEtJwGGkP6EkCmRNbtqZUWyb2lw4BT5-Ct_0cSVNMkKGNJdJ0q2ug
*Github:* https://github.com/maxikstrr
*LoveChanelLink:* https://whatsapp.com/channel/0029Vb8EH4IBqbrAu9LxUH3X
*LoveBotDevGruppe:* https://chat.whatsapp.com/DFk8T8y0OaVGbT8E0yMMRD`;

const OWNER_VCARD = `BEGIN:VCARD
VERSION:3.0
FN:Maxichen
ORG:Maxichen
TITLE:Owner
NOTE:LoveBot by Maxichen
URL:maxichen.de
URL:https://www.tiktok.com/@maxichensworld?_r=1&_t=ZG-99NMQ8UbEi8
URL:https://youtube.com/@masterofmax9214?si=S5DHg-4T14AnWQK0
URL:https://www.instagram.com/max_.kstr?igsi=MXduaWVrZW9pbnBzbg==
URL:https://open.spotify.com/user/31bpwvrczx5gcc5lw5mmqcl6dbru?si=cQlXegAJR92eq8YFNGYSng&utm_source=copy-link
URL:https://t.me/masterofmax09
URL:https://discord.gg/qS2GTkXR
URL:https://signal.me/#eu/Q2KHr5d5w7XsEtJwGGkP6EkCmRNbtqZUWyb2lw4BT5-Ct_0cSVNMkKGNJdJ0q2ug
URL:https://github.com/maxikstrr
URL:https://whatsapp.com/channel/0029Vb8EH4IBqbrAu9LxUH3X
URL:https://chat.whatsapp.com/DFk8T8y0OaVGbT8E0yMMRD
TEL;TYPE=CELL:+4915155894714
END:VCARD`;

function parseRegistrationInput(rawInput = '') {
  const clean = String(rawInput || '').trim();
  if (!clean) {
    return null;
  }

  const normalized = clean
    .replace(/[\u00A0\s]+/gu, '.')
    .replace(/\.{2,}/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .trim();

  if (!normalized) {
    return null;
  }

  const parts = normalized.split('.').map((part) => part.trim()).filter(Boolean);
  if (!parts.length) {
    return null;
  }

  /* 🔒 Datenschutz-Freundliches Format:
        $register Name                          (nur Name)
        $register Name.Alter                    (Alter optional)
        $register Name.Alter.Status             (Status optional)
        $register Name.Alter.Status.Stadt       (Stadt optional)
     Alter wird bei Minderjährigen NICHT exakt gespeichert → privacy.js */
  const AGE_RE = /^(\d{1,3}|18\+|unter\s?18|u18)$/i;
  const rest = parts.slice(1);
  const name = parts[0];
  let age = '';
  let status = '';
  let city = '';

  if (rest.length && AGE_RE.test(rest[0])) age = rest.shift();
  if (rest.length) status = rest.shift();
  if (rest.length) city = rest.join(' ');

  if (!name) {
    return null;
  }

  return {
    valid: true,
    name,
    age,
    status,
    city,
    value: [name, age, status, city].filter(Boolean).join('.')
  };
}

const withNewsletterForwarding = (payload = {}) => {
  const source = payload && typeof payload === 'object' ? payload : {};
  const contextInfo = { ...(source.contextInfo || {}) };
  const newsletterId = String(NEWSLETTER_BOT_ID || '').trim();
  const shortId = newsletterId.replace(/@newsletter$/i, '');

  contextInfo.isForwarded = true;
  contextInfo.forwardingScore = 999;
  contextInfo.forwardedNewsletterMessageInfo = {
    ...(contextInfo.forwardedNewsletterMessageInfo || {}),
    newsletterJid: newsletterId,
    newsletterName: NEWSLETTER_BOT_NAME,
    channelId: shortId,
    linkedChannel: NEWSLETTER_BOT_LINK,
    serverMessageId: Number((contextInfo.forwardedNewsletterMessageInfo && contextInfo.forwardedNewsletterMessageInfo.serverMessageId) || Date.now()),
    contentType: 'UPDATE'
  };
  contextInfo.forwardOrigin = 'NEWSLETTER';
  contextInfo.pairedMediaType = contextInfo.pairedMediaType || 'NOT_PAIRED_MEDIA';
  contextInfo.botMessageSharingInfo = {
    ...(contextInfo.botMessageSharingInfo || {}),
    botEntryPointOrigin: 'CHATLIST',
    forwardScore: 999
  };

  return { ...source, contextInfo };
};

/* Wendet die Newsletter-Weiterleitung auf ALLE contextInfo-Träger    */
/* eines rohen Sende-Payloads an (Rich-Response, Text, Bild, …).      */
function injectNewsletterContext(json) {
  if (!json || typeof json !== 'object') {
    return json;
  }
  const bfm = json.botForwardedMessage;
  if (bfm && bfm.message && typeof bfm.message === 'object') {
    for (const key of Object.keys(bfm.message)) {
      const sub = bfm.message[key];
      if (sub && typeof sub === 'object' && (sub.contextInfo || key.endsWith('Message'))) {
        bfm.message[key] = withNewsletterForwarding(sub);
      }
    }
  }
  if (json.contextInfo && typeof json.contextInfo === 'object') {
    json.contextInfo = withNewsletterForwarding(json).contextInfo;
  }
  return json;
}

let consecutiveFatalErrorCount = 0;
let lastFatalErrorCode = null;
let currentSocket = null;

const rlInterface = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const rlIterator = rlInterface[Symbol.asyncIterator]();

function getDynamicBrowserInfo() {
  return [
    'Maxichen',
    'LoveBot'
  ];
}

function parseSessionId(rawId) {
  if (!rawId || typeof rawId !== 'string') {
    return '0';
  }
  const match = rawId.match(/:([^@]+)@/);
  if (match && match[1]) {
    return match[1];
  }
  return '0';
}

function normalizeJid(rawId) {
  if (!rawId || typeof rawId !== 'string') {
    return '';
  }
  const userPart = rawId.split('@')[0].split(':')[0];
  return `${userPart}@s.whatsapp.net`;
}

function normalizeLid(rawId) {
  if (!rawId || typeof rawId !== 'string') {
    return '';
  }
  const userPart = rawId.split('@')[0].split(':')[0];
  return `${userPart}@lid`;
}

function formatMemory(bytes) {
  const gb = 1024 * 1024 * 1024;
  const mb = 1024 * 1024;
  if (bytes >= gb) {
    return `${(bytes / gb).toFixed(2)} GB`;
  }
  return `${(bytes / mb).toFixed(2)} MB`;
}

function actionLabelFallback(action) {
  if (action === 'add') return 'Hinzugefügt';
  if (action === 'remove') return 'Entfernt';
  if (action === 'promote') return 'Promoted';
  if (action === 'demote') return 'Demoted';
  return 'Aktualisiert';
}

function extractInnerMessage(rawMessage) {
  if (!rawMessage || typeof rawMessage !== 'object') {
    return null;
  }
  let current = rawMessage;
  if (current.ephemeralMessage && current.ephemeralMessage.message) {
    current = current.ephemeralMessage.message;
  }
  if (current.viewOnceMessage && current.viewOnceMessage.message) {
    current = current.viewOnceMessage.message;
  }
  if (current.viewOnceMessageV2 && current.viewOnceMessageV2.message) {
    current = current.viewOnceMessageV2.message;
  }
  if (current.documentWithCaptionMessage && current.documentWithCaptionMessage.message) {
    current = current.documentWithCaptionMessage.message;
  }
  return current;
}

/* ============================================================================
 * AFK- & BAN-Event-Lebenszyklus
 * Läuft für JEDE eingehende Nachricht (auch ohne Befehl), damit
 * - ein AFK-User sofort "Willkommen zurück" bekommt, sobald er etwas macht,
 * - bei @-Erwähnung / Antwort auf einen AFK-User ein Hinweis kommt,
 * - ein gebannter User beim Schreiben rausgeworfen wird.
 * ==========================================================================*/
async function handleAfkBanLifecycle(sock, msg, ctx = {}) {
  try {
    const from = ctx.from;
    const isGroup = ctx.isGroup === true;
    const sessionPath = ctx.sessionPath;
    const messageText = ctx.messageText || '';

    if (!from) {
      return false;
    }

    const ident = await userMapping.resolveSender(msg, sock, sessionPath);
    const identJid = ident?.jid || normalizeJid(msg.key.participant || from || '');
    const identLid = ident?.lid || normalizeLid(msg.key.participantAlt || msg.key.remoteJidAlt || '');

    /* Der Bot reagiert nie auf sich selbst. */
    const selfJid = normalizeJid(sock?.user?.id || '');
    const selfLid = normalizeLid(sock?.user?.lid || '');
    if (identJid && identJid === selfJid) return false;
    if (identLid && identLid === selfLid) return false;

    const db = readDb();

    /* ---------- a) Auto-Comeback: Sender war selbst AFK ---------- */
    let senderAfk = findAfkForIdentity(db, identJid, identLid);
    if (!senderAfk && ident?.key) {
      senderAfk = db.afk?.[ident.key] || null;
    }
    if (senderAfk) {
      const awayFor = Date.now() - new Date(senderAfk.since).getTime();
      const reason = senderAfk.reason || 'Kein Grund angegeben';
      clearAfk(db, senderAfk.key || identityKey(identJid, identLid));
      const mention = identLid || identJid;
      const comeBackText =
        '> 💙 *WILLKOMMEN ZURÜCK!* 💙\n\n' +
        `@${(mention && cleanId(mention)) || 'User'} du bist nach *${formatDuration(awayFor)}* ` +
        `wegen *${reason}* AFK — willkommen zurück! 🎉\n\n` +
        'Schön, dass du wieder da bist! 🥰';
      try {
        await sock.sendMessage(from, {
          text: comeBackText,
          mentions: mention ? [mention] : []
        }, { quoted: msg });
      } catch (e) {
        try {
          await sock.sendMessage(from, { text: comeBackText }, { quoted: msg });
        } catch (e2) {}
      }
      console.log(c.bold + c.brightGreen + '[afk] Auto-Comeback: ' + (cleanId(mention) || 'User') + ' ist zurück.' + c.reset);
    }

    /* ---------- b) Gebannter User schreibt in einer Gruppe ---------- */
    const ban = isUserBanned(db, identJid, identLid);
    if (ban && isGroup && !msg.key.fromMe) {
      /* Nachricht sofort als Admin löschen */
      try {
        await sock.sendMessage(from, { delete: msg.key });
      } catch (e) {}

      /* Abschiedsnachricht an die Gruppe inkl. Grund */
      const banText =
        '> 🚫 *GEBANNT* 🚫\n\n' +
        `@${(identLid && cleanId(identLid)) || (identJid && cleanId(identJid)) || 'User'} ist in diesem Bot gesperrt. ⚠️\n` +
        `*Grund:* ${ban.reason}\n\n` +
        'Dieses Mitglied wurde entfernt. Für Fragen kontaktiere den Owner.';
      try {
        await sock.sendMessage(from, {
          text: banText,
          mentions: [identLid || identJid].filter(Boolean)
        }, { quoted: msg });
      } catch (e) {
        try {
          await sock.sendMessage(from, { text: banText }, { quoted: msg });
        } catch (e2) {}
      }

      /* Kick */
      try {
        if (typeof sock.groupParticipantsUpdate === 'function') {
          await sock.groupParticipantsUpdate(from, [identJid || identLid], 'remove');
        }
      } catch (e) {}
      return 'banned';
    }

    /* ---------- c) Hinweis, wenn jemand AFK angesprochen/erwähnt wird ---------- */
    if (!senderAfk) {
      const mentionNote = async (targetJid, targetLid) => {
        const targetAfk = findAfkForIdentity(db, targetJid, targetLid);
        if (!targetAfk) return;
        const since = formatDuration(Date.now() - new Date(targetAfk.since).getTime());
        const noteText =
          '> 💤 *AFK HINWEIS* 💤\n\n' +
          `@${(targetLid && cleanId(targetLid)) || (targetJid && cleanId(targetJid)) || 'User'} ist seit *${formatDateTime(targetAfk.since)}* AFK ⏰\n` +
          `(eben: *${since}*)\n` +
          `*Grund:* ${targetAfk.reason}\n\n` +
          'Diese Person kann gerade nicht reden. 🙏';
        try {
          await sock.sendMessage(from, {
            text: noteText,
            mentions: [targetLid || targetJid].filter(Boolean)
          }, { quoted: msg });
        } catch (e) {
          try {
            await sock.sendMessage(from, { text: noteText }, { quoted: msg });
          } catch (e2) {}
        }
      };

      if (!isGroup) {
        /* Privatchat: falls der Gesprächspartner AFK ist */
        const otherJid = normalizeJid(from);
        const otherLid = normalizeLid(from);
        await mentionNote(otherJid, otherLid);
      } else {
        const ctxInfo = (msg.message && (
          msg.message.extendedTextMessage?.contextInfo ||
          msg.message.imageMessage?.contextInfo ||
          msg.message.videoMessage?.contextInfo ||
          msg.message.audioMessage?.contextInfo ||
          msg.message.stickerMessage?.contextInfo ||
          msg.message.reactionMessage?.contextInfo
        )) || {};
        const mentioned = Array.isArray(ctxInfo.mentionedJid) ? ctxInfo.mentionedJid : [];
        const repliedParticipant = ctxInfo.participant || '';
        const candidates = new Set();
        for (const m of mentioned) { if (m) candidates.add(String(m)); }
        if (repliedParticipant) candidates.add(String(repliedParticipant));
        for (const cand of candidates) {
          const cJid = normalizeJid(cand);
          const cLid = normalizeLid(cand);
          await mentionNote(cJid, cLid);
        }
      }
    }

    return true;
  } catch (err) {
    console.error(c.bold + c.brightRed + 'Fehler bei AFK/Ban-Lifecycle:' + c.reset, err);
    return false;
  }
}

function getQuotedMessage(msg) {
  if (!msg || !msg.message) {
    return null;
  }
  const unwrapped = extractInnerMessage(msg.message);
  if (!unwrapped) {
    return null;
  }
  const messageKeys = Object.keys(unwrapped);
  let i = 0;
  while (i < messageKeys.length) {
    const key = messageKeys[i];
    const subMsg = unwrapped[key];
    if (subMsg && typeof subMsg === 'object') {
      if (subMsg.contextInfo && subMsg.contextInfo.quotedMessage) {
        return extractInnerMessage(subMsg.contextInfo.quotedMessage);
      }
    }
    i++;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  $play — Multi Downloader / Song Suche                              */
/* ------------------------------------------------------------------ */

let mediaDownloaderApi = null;
function getMediaDownloaderApi() {
  if (mediaDownloaderApi) return mediaDownloaderApi;
  try {
    mediaDownloaderApi = require('@neelegirly/downloader');
    return mediaDownloaderApi;
  } catch (err) {
    throw new Error('Modul fehlt: npm i @neelegirly/downloader');
  }
}

let youtubeDl = null;
function getYoutubeDl() {
  if (youtubeDl) return youtubeDl;
  try {
    youtubeDl = require('youtube-dl-exec');
    return youtubeDl;
  } catch (err) {
    throw new Error('Modul fehlt: npm i youtube-dl-exec');
  }
}

function isHttpUrl(text) {
  return /^https?:\/\//i.test(String(text || '').trim());
}

function detectPlayPlatform(url) {
  const u = String(url || '').toLowerCase();
  if (/instagram\.com|instagr\.am/.test(u)) return 'instagram';
  if (/tiktok\.com|vt\.tiktok\.com|vm\.tiktok\.com/.test(u)) return 'tiktok';
  if (/youtube\.com|youtu\.be|music\.youtube\.com/.test(u)) return 'youtube';
  if (/threads\.net/.test(u)) return 'threads';
  if (/twitter\.com|x\.com/.test(u)) return 'twitter';
  if (/facebook\.com|fb\.watch|m\.facebook\.com/.test(u)) return 'facebook';
  if (/drive\.google\.com|docs\.google\.com/.test(u)) return 'gdrive';
  if (/pinterest\.|pin\.it/.test(u)) return 'pinterest';
  if (/capcut\.com/.test(u)) return 'capcut';
  if (/likee\.video|likee\.com/.test(u)) return 'likee';
  if (/soundcloud\.com/.test(u)) return 'soundcloud';
  if (/spotify\.com/.test(u)) return 'spotify';
  if (/terabox|1024tera|4funbox|terasharelink|teraboxlink/.test(u)) return 'terabox';
  return 'alldown';
}

function firstDeepValue(obj, keys) {
  const wanted = new Set(keys.map((k) => k.toLowerCase()));
  const seen = new Set();
  const walk = (value) => {
    if (!value || typeof value !== 'object' || seen.has(value)) return '';
    seen.add(value);
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = walk(item);
        if (found) return found;
      }
      return '';
    }
    for (const [k, v] of Object.entries(value)) {
      if (wanted.has(String(k).toLowerCase()) && typeof v === 'string' && isHttpUrl(v)) return v;
    }
    for (const v of Object.values(value)) {
      const found = walk(v);
      if (found) return found;
    }
    return '';
  };
  return walk(obj);
}

function collectDeepUrls(obj) {
  const urls = [];
  const seen = new Set();
  const walk = (value, keyPath = '') => {
    if (typeof value === 'string') {
      if (isHttpUrl(value) && !urls.some((u) => u.url === value)) urls.push({ url: value, key: keyPath.toLowerCase() });
      return;
    }
    if (!value || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    if (Array.isArray(value)) {
      value.forEach((v, i) => walk(v, `${keyPath}.${i}`));
      return;
    }
    Object.entries(value).forEach(([k, v]) => walk(v, keyPath ? `${keyPath}.${k}` : k));
  };
  walk(obj);
  return urls;
}

function isLikelyAudioUrl(url) {
  const u = String(url || '').toLowerCase();
  return /\.(mp3|m4a|aac|ogg|opus|wav|flac)(\?|$)/i.test(u)
    || /audio/i.test(u)
    || /cf-media\.sndcdn\.com|sndcdn\.com/i.test(u);
}

function isLikelyVideoUrl(url) {
  const u = String(url || '').toLowerCase();
  if (!u || isLikelyAudioUrl(u)) return false;
  return /\.(mp4|mov|m4v|webm|mkv)(\?|$)/i.test(u)
    || /video|video_hd|video_sd|stream\.video|download\.video/i.test(u);
}

function pickUrlByKind(urls, kind) {
  if (kind === 'video') {
    const found = urls.find((u) => isLikelyVideoUrl(u.url) || (/video|mp4|hd|sd|high|low|stream\.video|download\.video/i.test(u.key) && !isLikelyAudioUrl(u.url)));
    return found ? found.url : '';
  }

  if (kind === 'audio') {
    const found = urls.find((u) => isLikelyAudioUrl(u.url) || /audio|mp3|m4a|download_url|stream\.audio|download\.audio/i.test(u.key));
    return found ? found.url : '';
  }

  const tests = [/thumb|thumbnail|image|cover|artwork|avatar/i, /\.(jpg|jpeg|png|webp)(\?|$)/i];
  for (const test of tests) {
    const found = urls.find((u) => test.test(u.key) || test.test(u.url));
    if (found) return found.url;
  }
  return '';
}

function normalizePlayResult(raw, platform, query) {
  const data = raw?.data || raw?.media || raw?.result || raw;
  const urls = collectDeepUrls(raw);
  const title = raw?.title || data?.title || data?.name || data?.caption || data?.desc || data?.description || query;
  const artist = data?.artist || data?.channel || data?.author?.nickname || data?.author?.unique_id || data?.username || raw?.artist || '';
  const thumbnail = firstDeepValue(raw, ['thumbnail', 'thumb', 'image', 'cover', 'artwork_url', 'avatar', 'avatar_url']) || pickUrlByKind(urls, 'image');

  const audioCandidates = [
    data?.audio,
    data?.mp3,
    data?.download_url,
    data?.download?.audio,
    data?.stream?.audio,
    raw?.download_url,
    pickUrlByKind(urls, 'audio')
  ].filter(Boolean);

  const videoCandidates = [
    data?.video_hd,
    data?.video,
    data?.hd,
    data?.HD,
    data?.high,
    data?.sd,
    data?.SD,
    data?.low,
    data?.download?.video,
    data?.stream?.video,
    pickUrlByKind(urls, 'video')
  ].filter(Boolean);

  let audio = audioCandidates.find((u) => isLikelyAudioUrl(u)) || audioCandidates[0] || '';
  let video = videoCandidates.find((u) => isLikelyVideoUrl(u)) || videoCandidates.find((u) => !isLikelyAudioUrl(u)) || '';

  // SoundCloud/Spotify sind Audio-Plattformen. Eine .mp3 darf nie als Video rausgehen.
  if (platform === 'soundcloud' || platform === 'spotify') {
    if (!audio && video && isLikelyAudioUrl(video)) audio = video;
    video = '';
  }
  if (video && isLikelyAudioUrl(video)) {
    if (!audio) audio = video;
    video = '';
  }
  if (audio && video && audio === video) video = '';

  const pageUrl = data?.permalink_url || data?.webpage_url || raw?.permalink_url || (urls.find((u) => /spotify|soundcloud|youtu|tiktok|instagram|facebook|twitter|x\.com/i.test(u.url))?.url || '');
  return { platform, title, artist, thumbnail, video, audio, pageUrl, raw };
}

async function youtubeSearchFirst(query) {
  const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
  const res = await globalThis.fetch(searchUrl, {
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36',
      'accept-language': 'de-DE,de;q=0.9,en;q=0.8'
    }
  });
  if (!res.ok) throw new Error(`YouTube Suche fehlgeschlagen: HTTP ${res.status}`);
  const html = await res.text();
  const ids = [...html.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g)].map((m) => m[1]);
  const firstId = [...new Set(ids)][0];
  if (!firstId) throw new Error('Kein YouTube Video gefunden.');
  return `https://youtu.be/${firstId}`;
}

async function downloadYoutubeDirect(url, query) {
  const info = await getYoutubeDl()(url, {
    dumpSingleJson: true,
    noWarnings: true,
    noPlaylist: true,
    skipDownload: true,
    format: 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best'
  });
  const formats = info.requested_formats?.length ? info.requested_formats : [info];
  const videoFormat = formats.find((format) => format.vcodec && format.vcodec !== 'none');
  const audioFormat = formats.find((format) => format.acodec && format.acodec !== 'none');
  const video = videoFormat?.url || (!audioFormat ? info.url : '');
  const audio = audioFormat?.url || video;

  if (!video && !audio) throw new Error('YouTube lieferte keine abspielbaren Medien.');
  return {
    platform: 'youtube',
    title: info.title || query,
    artist: info.uploader || info.channel || '',
    thumbnail: info.thumbnail || '',
    video,
    audio,
    pageUrl: info.webpage_url || url,
    raw: info
  };
}

let ffmpegAvailableCache = null;
let ffmpegBinaryCache = null;
function getFfmpegCandidates() {
  const candidates = [];

  if (process.env.FFMPEG_PATH) candidates.push(process.env.FFMPEG_PATH);

  try {
    const staticFfmpeg = require('ffmpeg-static');
    if (staticFfmpeg) candidates.push(staticFfmpeg);
  } catch (err) {}

  candidates.push(
    path.join(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg.exe'),
    path.join(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg'),
    path.join(process.cwd(), 'node_modules', '.bin', 'ffmpeg.cmd'),
    path.join(process.cwd(), 'node_modules', '.bin', 'ffmpeg.exe'),
    'ffmpeg'
  );

  return [...new Set(candidates.filter(Boolean))];
}

async function getFfmpegBinary() {
  if (ffmpegBinaryCache) return ffmpegBinaryCache;

  for (const candidate of getFfmpegCandidates()) {
    try {
      await execFileAsync(candidate, ['-version'], { timeout: 8000, maxBuffer: 1024 * 1024 });
      ffmpegBinaryCache = candidate;
      return ffmpegBinaryCache;
    } catch (err) {}
  }

  throw new Error('ffmpeg nicht gefunden. Installiere ffmpeg-static mit: npm i ffmpeg-static --save  oder setze FFMPEG_PATH auf ffmpeg.exe');
}

async function hasFfmpeg() {
  if (ffmpegAvailableCache !== null) return ffmpegAvailableCache;
  try {
    await getFfmpegBinary();
    ffmpegAvailableCache = true;
  } catch (err) {
    ffmpegAvailableCache = false;
  }
  return ffmpegAvailableCache;
}

async function downloadPlayFile(url, targetPath) {
  const res = await globalThis.fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36'
    }
  });
  if (!res.ok) {
    throw new Error(`Download fehlgeschlagen: HTTP ${res.status}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  await fs.promises.writeFile(targetPath, Buffer.from(arrayBuffer));
  return targetPath;
}

async function prepareWhatsappMp4Video(videoUrl, audioUrl = '') {
  const canUseFfmpeg = await hasFfmpeg();
  if (!canUseFfmpeg) {
    return { content: { url: videoUrl }, converted: false, note: 'ffmpeg nicht gefunden, sende Original-Link.' };
  }

  const tmpDir = path.join(process.cwd(), 'tmp', 'play');
  await fs.promises.mkdir(tmpDir, { recursive: true });

  const id = randomUUID();
  const videoInputPath = path.join(tmpDir, `${id}.video.input`);
  const audioInputPath = path.join(tmpDir, `${id}.audio.input`);
  const outputPath = path.join(tmpDir, `${id}.ios-android.mp4`);
  let hasSeparateAudio = audioUrl && audioUrl !== videoUrl;

  try {
    await downloadPlayFile(videoUrl, videoInputPath);
    if (hasSeparateAudio) {
      try {
        await downloadPlayFile(audioUrl, audioInputPath);
      } catch (audioDownloadErr) {
        hasSeparateAudio = false;
      }
    }

    const ffmpegArgs = [
      '-y',
      '-i', videoInputPath
    ];

    if (hasSeparateAudio) {
      ffmpegArgs.push('-i', audioInputPath);
    }

    ffmpegArgs.push(
      '-map', '0:v:0',
      '-map', hasSeparateAudio ? '1:a:0' : '0:a?',
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-profile:v', 'baseline',
      '-level', '3.0',
      '-pix_fmt', 'yuv420p',
      '-vf', "scale='if(gt(iw,ih),min(640,iw),-2)':'if(gt(iw,ih),-2,min(640,ih))',format=yuv420p",
      '-r', '30',
      '-b:v', '500k',
      '-maxrate', '600k',
      '-bufsize', '1200k',
      '-c:a', 'aac',
      '-b:a', '64k',
      '-ar', '44100',
      '-ac', '2',
      '-tag:v', 'avc1',
      '-movflags', '+faststart',
      '-avoid_negative_ts', 'make_zero',
      '-max_muxing_queue_size', '9999',
      '-shortest',
      '-f', 'mp4',
      outputPath
    );

    await execFileAsync(await getFfmpegBinary(), ffmpegArgs, { timeout: 240000, maxBuffer: 30 * 1024 * 1024 });

    const mp4Buffer = await fs.promises.readFile(outputPath);
    return { content: mp4Buffer, converted: true, note: hasSeparateAudio ? 'MP4 H.264/AAC mit Audio gemerged — iOS + Android.' : 'MP4 H.264/AAC — iOS + Android.' };
  } finally {
    await fs.promises.rm(videoInputPath, { force: true }).catch(() => {});
    await fs.promises.rm(audioInputPath, { force: true }).catch(() => {});
    await fs.promises.rm(outputPath, { force: true }).catch(() => {});
  }
}

async function prepareWhatsappAudio(audioUrl, fallbackVideoUrl = '') {
  const tmpDir = path.join(process.cwd(), 'tmp', 'play');
  await fs.promises.mkdir(tmpDir, { recursive: true });

  const canUseFfmpeg = await hasFfmpeg();
  const candidates = [...new Set([audioUrl, fallbackVideoUrl].filter(Boolean))];
  let lastErr = null;

  for (const sourceUrl of candidates) {
    const id = randomUUID();
    const inputPath = path.join(tmpDir, `${id}.audio-source.input`);
    const outputPath = path.join(tmpDir, `${id}.whatsapp-audio.m4a`);

    try {
      await downloadPlayFile(sourceUrl, inputPath);

      if (!canUseFfmpeg) {
        return {
          content: await fs.promises.readFile(inputPath),
          mimetype: 'audio/mp4',
          fileName: 'LoveBot-Audio.m4a',
          converted: false,
          note: 'Audio original als Buffer gesendet.'
        };
      }

      // Audio genauso wie Video erst herunterladen und dann sauber konvertieren.
      // Wenn die direkte YouTube-Audio-URL failt, wird fallbackVideoUrl genutzt
      // und die Tonspur aus dem YouTube-Video extrahiert.
      await execFileAsync(await getFfmpegBinary(), [
        '-y',
        '-i', inputPath,
        '-vn',
        '-map', '0:a:0',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-ar', '44100',
        '-ac', '2',
        '-movflags', '+faststart',
        '-f', 'mp4',
        outputPath
      ], { timeout: 180000, maxBuffer: 20 * 1024 * 1024 });

      return {
        content: await fs.promises.readFile(outputPath),
        mimetype: 'audio/mp4',
        fileName: 'LoveBot-Audio.m4a',
        converted: true,
        note: sourceUrl === fallbackVideoUrl ? 'M4A/AAC aus YouTube-Video extrahiert — iOS + Android.' : 'M4A/AAC von YouTube-Audio geladen — iOS + Android.'
      };
    } catch (err) {
      lastErr = err;
    } finally {
      await fs.promises.rm(inputPath, { force: true }).catch(() => {});
      await fs.promises.rm(outputPath, { force: true }).catch(() => {});
    }
  }

  throw lastErr || new Error('Audio konnte nicht heruntergeladen/konvertiert werden.');
}

const AUDIO_EFFECTS = {
  lauter: { label: '📢 lauter', filter: 'volume=2.5' },
  laut: { label: '📢 lauter', filter: 'volume=2.5' },
  louder: { label: '📢 lauter', filter: 'volume=2.5' },
  leise: { label: '🔉 leise', filter: 'volume=0.45' },
  bass: { label: '🔊 bass', filter: 'bass=g=18:f=110,volume=1.2' },
  blown: { label: '💣 blown', filter: 'volume=4,acrusher=level_in=2:level_out=1:bits=6:mode=log' },
  deep: { label: '🎧 deep', filter: 'asetrate=44100*0.82,aresample=44100,atempo=1.18,bass=g=8' },
  earrape: { label: '💥 earrape', filter: 'volume=12,acrusher=level_in=4:level_out=2:bits=5:mode=log' },
  fast: { label: '⚡ fast', filter: 'atempo=1.45' },
  fat: { label: '🐘 fat', filter: 'bass=g=20:f=90,acompressor=threshold=-18dB:ratio=4:attack=5:release=50,volume=1.4' },
  nightcore: { label: '⭐ nightcore', filter: 'asetrate=44100*1.25,aresample=44100,atempo=1.05' },
  speedup: { label: '🚀 speedup', filter: 'atempo=1.25' },
  reverse: { label: '⏪ reverse', filter: 'areverse' },
  robot: { label: '🤖 robot', filter: 'asetrate=44100*0.9,aresample=44100,atempo=1.1,aecho=0.8:0.88:40:0.4,acrusher=bits=8:mode=log' },
  slowed: { label: '🐢 slowed', filter: 'atempo=0.75' },
  slow: { label: '🐢 slowed', filter: 'atempo=0.75' },
  chipmunk: { label: '🐿️ chipmunk', filter: 'asetrate=44100*1.55,aresample=44100,atempo=0.85' },
  reverb: { label: '🎼 reverb', filter: 'aecho=0.8:0.88:60|120|240|480:0.4|0.3|0.2|0.1' },
  echo: { label: '🔁 echo', filter: 'aecho=0.8:0.9:1000:0.35' },
  chorus: { label: '🎤 chorus', filter: 'chorus=0.7:0.9:55:0.4:0.25:2' },
  flanger: { label: '🌊 flanger', filter: 'flanger' },
  phaser: { label: '🌀 phaser', filter: 'aphaser=in_gain=0.4' },
  tremolo: { label: '📳 tremolo', filter: 'tremolo=f=8:d=0.8' },
  vibrato: { label: '〰️ vibrato', filter: 'vibrato=f=6.5:d=0.7' },
  normalize: { label: '✅ normalize', filter: 'loudnorm=I=-16:TP=-1.5:LRA=11' },
  compressor: { label: '🧱 compressor', filter: 'acompressor=threshold=-18dB:ratio=3:attack=5:release=80' },
  treble: { label: '🔔 treble', filter: 'treble=g=10' },
  muffled: { label: '🧣 muffled', filter: 'lowpass=f=700' },
  underwater: { label: '🌊 underwater', filter: 'lowpass=f=500,aecho=0.8:0.9:800:0.4' },
  radio: { label: '📻 radio', filter: 'highpass=f=300,lowpass=f=3000,volume=1.4' },
  telefon: { label: '☎️ telefon', filter: 'highpass=f=300,lowpass=f=3400,volume=1.5' },
  karaoke: { label: '🎙️ karaoke', filter: 'pan=stereo|c0=c0-c1|c1=c1-c0' },
  vaporwave: { label: '🌌 vaporwave', filter: 'asetrate=44100*0.8,aresample=44100,atempo=0.9,aecho=0.8:0.88:60:0.35' },
  alien: { label: '👽 alien', filter: 'asetrate=44100*1.35,aresample=44100,atempo=0.9,flanger' }
};

function getAudioHelpText() {
  const shown = [];
  const seenFilters = new Set();
  for (const [key, fx] of Object.entries(AUDIO_EFFECTS)) {
    if (seenFilters.has(fx.label)) continue;
    seenFilters.add(fx.label);
    shown.push(`• ${fx.label} — $audio ${key}`);
  }
  return [
    '> 🎧 *LOVE BOT — AUDIO EFFECTS*',
    '',
    '*Benutzung:*',
    'Antworte auf eine Audio/Sprachnachricht mit:',
    '• $audio lauter',
    '• $audio nightcore',
    '• $audio bass',
    '',
    '*Module:*',
    ...shown
  ].join('\n');
}

function getQuotedAudioMedia(quoted) {
  if (!quoted || typeof quoted !== 'object') return null;
  if (quoted.audioMessage) return { message: quoted.audioMessage, type: 'audio', mimetype: quoted.audioMessage.mimetype || 'audio/ogg' };
  if (quoted.pttMessage) return { message: quoted.pttMessage, type: 'audio', mimetype: quoted.pttMessage.mimetype || 'audio/ogg' };
  if (quoted.documentMessage && /^audio\//i.test(quoted.documentMessage.mimetype || '')) {
    return { message: quoted.documentMessage, type: 'document', mimetype: quoted.documentMessage.mimetype || 'audio/mpeg' };
  }
  if (quoted.videoMessage) return { message: quoted.videoMessage, type: 'video', mimetype: quoted.videoMessage.mimetype || 'video/mp4' };
  return null;
}

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function downloadQuotedAudioBuffer(quoted) {
  const media = getQuotedAudioMedia(quoted);
  if (!media) {
    throw new Error('Bitte auf eine Audio-/Sprachnachricht antworten.');
  }
  const stream = await downloadContentFromMessage(media.message, media.type);
  const buffer = await streamToBuffer(stream);
  if (!buffer || !buffer.length) throw new Error('Audio konnte nicht heruntergeladen werden.');
  return { buffer, mimetype: media.mimetype };
}

async function applyAudioEffect(inputBuffer, effectKey) {
  const key = String(effectKey || '').toLowerCase().trim();
  const effect = AUDIO_EFFECTS[key];
  if (!effect) {
    throw new Error(`Unbekanntes Audio-Modul: ${effectKey}`);
  }

  await getFfmpegBinary();
  const tmpDir = path.join(process.cwd(), 'tmp', 'audio-effects');
  await fs.promises.mkdir(tmpDir, { recursive: true });

  const id = randomUUID();
  const inputPath = path.join(tmpDir, `${id}.input`);
  const outputPath = path.join(tmpDir, `${id}.m4a`);

  try {
    await fs.promises.writeFile(inputPath, inputBuffer);
    await execFileAsync(await getFfmpegBinary(), [
      '-y',
      '-i', inputPath,
      '-vn',
      '-filter:a', effect.filter,
      '-c:a', 'aac',
      '-b:a', '128k',
      '-ar', '44100',
      '-ac', '2',
      '-movflags', '+faststart',
      '-f', 'mp4',
      outputPath
    ], { timeout: 180000, maxBuffer: 20 * 1024 * 1024 });

    return {
      buffer: await fs.promises.readFile(outputPath),
      mimetype: 'audio/mp4',
      fileName: `LoveBot-${key}.m4a`,
      label: effect.label
    };
  } finally {
    await fs.promises.rm(inputPath, { force: true }).catch(() => {});
    await fs.promises.rm(outputPath, { force: true }).catch(() => {});
  }
}


/* ================================================================== */
/*  🌹 LOVE BOT v2 — HELFER: Terminal, Speedtest, Auto-Download,      */
/*     Marry-System, Help-Kategorien, Message-Editing                 */
/* ================================================================== */

/* ---------- Terminal: Logger mit Zeitstempel ---------------------- */
function logLove(tag, text, color) {
  /* ☾ Night-Terminal: Neon-Tags, Mood-Zeilen, eigenes Log-Handling */
  logNightMood(tag, text);
}

/* ---------- Terminal: fettes Startup-Banner ------------------------ */
function printStartupBanner() {
  nightBanner();
  return;
}

const VERBOSE_LOG = String(process.env.LOVEBOT_VERBOSE_LOG ?? '1').toLowerCase() !== '0';

function summarizeForLog(value, maxLen = 1000) {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'string') return value.length > maxLen ? value.slice(0, maxLen) + '…' : value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return String(value);
  try {
    const json = JSON.stringify(value);
    return json.length > maxLen ? json.slice(0, maxLen) + '…' : json;
  } catch (error) {
    return String(value);
  }
}

function logActivity(tag, details, extra = {}) {
  if (!VERBOSE_LOG) return;
  const stamp = new Date().toLocaleTimeString('de-DE');
  const meta = extra && Object.keys(extra).length ? ` | ${JSON.stringify(extra)}` : '';
  const text = typeof details === 'string' ? details : summarizeForLog(details, 1200);
  console.log(c.bold + c.brightCyan + `[${stamp}] [${String(tag).toUpperCase()}]` + c.reset + ' ' + c.brightWhite + text + c.reset + c.dim + meta + c.reset);
}

/* ---------- Text-Nachricht per MESSAGE_EDIT bearbeiten ------------ */
async function editTextMessage(sock, jid, key, text) {
  const edited = generateWAMessageFromContent(jid, proto.Message.fromObject({ conversation: text }), {});
  const wrapper = generateWAMessageFromContent(jid, proto.Message.fromObject({
    protocolMessage: {
      key: key,
      type: 14,
      editedMessage: edited.message
    }
  }), {});
  return sock.relayMessage(jid, wrapper.message, {
    messageId: wrapper.key.id
  });
}

/* ---------- Speedtest (Cloudflare Edge) --------------------------- */
async function runDownloadSpeedTest(opts = {}) {
  const maxBytes = opts.maxBytes || 12 * 1024 * 1024;
  const reqBytes = opts.reqBytes || 25 * 1024 * 1024;
  const res = await fetch(`https://speed.cloudflare.com/__down?bytes=${reqBytes}`, {
    signal: AbortSignal.timeout(25000)
  });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
  const started = Date.now();
  const reader = res.body.getReader();
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value ? value.byteLength : 0;
    if (received >= maxBytes) {
      try { await reader.cancel(); } catch (cancelErr) {}
      break;
    }
  }
  const ms = Math.max(1, Date.now() - started);
  return {
    receivedBytes: received,
    durationMs: ms,
    downloadMbps: Number(((received * 8) / (ms / 1000) / 1e6).toFixed(2))
  };
}

async function runUploadSpeedTest(bytes = 2 * 1024 * 1024) {
  const body = Buffer.alloc(bytes, 97);
  const started = Date.now();
  const res = await fetch('https://speed.cloudflare.com/__up', {
    method: 'POST',
    body,
    signal: AbortSignal.timeout(25000)
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const ms = Math.max(1, Date.now() - started);
  return {
    sentBytes: bytes,
    durationMs: ms,
    uploadMbps: Number(((bytes * 8) / (ms / 1000) / 1e6).toFixed(2))
  };
}

function formatMbps(mbps) {
  if (mbps >= 1000) return `${(mbps / 1000).toFixed(2)} Gbit/s`;
  return `${mbps.toFixed(2)} Mbit/s`;
}

function formatBytesShort(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

/* Kompletter Speedtest mit Live-Status und Ergebnis-Nachricht.       */
async function performSpeedTestWithReport(sock, from, msg, opts = {}) {
  const statusText =
    '> 🚀 *LOVE BOT — SPEEDTEST*\n\n' +
    (opts.latencyMs != null ? `• 🏓 *Latenz:* ${opts.latencyMs} ms\n` : '') +
    '• 📡 *Server:* Cloudflare Edge\n' +
    '⏳ _Download wird gemessen …_';
  let statusKey = null;
  try {
    const statusMsg = await sock.sendMessage(from, { text: statusText }, { quoted: msg });
    statusKey = statusMsg?.key || null;
  } catch (sendErr) {}

  let down = null;
  let downErr = null;
  try {
    down = await runDownloadSpeedTest();
  } catch (e) {
    downErr = e;
  }

  try {
    if (statusKey) {
      await editTextMessage(sock, from, statusKey,
        '> 🚀 *LOVE BOT — SPEEDTEST*\n\n' +
        (opts.latencyMs != null ? `• 🏓 *Latenz:* ${opts.latencyMs} ms\n` : '') +
        (down ? `• 📥 *Download:* ${formatMbps(down.downloadMbps)} ✅\n` : '• 📥 *Download:* ❌\n') +
        '⏳ _Upload wird gemessen …_');
    }
  } catch (editErr) {}

  let up = null;
  let upErr = null;
  try {
    up = await runUploadSpeedTest();
  } catch (e) {
    upErr = e;
  }

  const memMb = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);
  const finalText = [
    '> 🚀 *LOVE BOT — SPEEDTEST ERGEBNIS* 🏁',
    '',
    opts.latencyMs != null ? `• 🏓 *Latenz:* ${opts.latencyMs} ms` : '',
    down ? `• 📥 *Download:* ${formatMbps(down.downloadMbps)} _(${formatBytesShort(down.receivedBytes)} in ${(down.durationMs / 1000).toFixed(1)}s)_` : `• 📥 *Download:* ❌ ${downErr?.message || 'Fehler'}`,
    up ? `• 📤 *Upload:* ${formatMbps(up.uploadMbps)} _(${formatBytesShort(up.sentBytes)} in ${(up.durationMs / 1000).toFixed(1)}s)_` : `• 📤 *Upload:* ❌ ${upErr?.message || 'Fehler'}`,
    `• 🧠 *RAM:* ${memMb} MB`,
    '',
    '⚡ _LoveBot Speedtest by Maxichen_'
  ].filter(Boolean).join('\n');

  try {
    if (statusKey) {
      await editTextMessage(sock, from, statusKey, finalText);
    } else {
      await sock.sendMessage(from, { text: finalText }, { quoted: msg });
    }
  } catch (finalErr) {
    try { await sock.sendMessage(from, { text: finalText }, { quoted: msg }); } catch (e2) {}
  }
  return { down, up };
}

/* ---------- Media-Ergebnis von resolvePlayRequest senden ----------- */
/* Wird von $play UND vom Auto-Download verwendet.                    */
async function sendPlayResultMedia(sock, from, msg, result, input, opts = {}) {
  const sendFn = opts.sendFn || ((content, options) => sock.sendMessage(from, content, options));
  let sentMedia = 0;

  const infoText = [
    opts.auto ? '> 📥 *LOVE BOT — AUTO DOWNLOAD RESULT*' : '> ▶️ *LOVE BOT — PLAY RESULT*',
    '',
    `• *Plattform:* ${result.platform || 'Unbekannt'}`,
    `• *Titel:* ${result.title || 'Unbekannt'}`,
    result.artist ? `• *Artist/Autor:* ${result.artist}` : '',
    result.pageUrl ? `• *Link:* ${result.pageUrl}` : '',
    result.thumbnail ? '• *Bild:* ✅' : '• *Bild:* ❌',
    result.video ? '• *Video:* ✅' : '• *Video:* ❌',
    result.audio ? '• *Audio:* ✅' : '• *Audio:* ❌'
  ].filter(Boolean).join('\n');

  if (opts.statusKey) {
    try { await editTextMessage(sock, from, opts.statusKey, infoText); } catch (editErr) {
      await sendFn({ text: infoText }, { quoted: msg });
    }
  } else {
    await sendFn({ text: infoText }, { quoted: msg });
  }

  if (result.thumbnail) {
    try {
      await sendFn({
        image: { url: result.thumbnail },
        caption: `🖼 *Bild / Cover*\n${result.title || input}`
      }, { quoted: msg });
      sentMedia++;
    } catch (imgErr) {
      console.log(c.bold + c.brightYellow + '[media] Bild konnte nicht gesendet werden.' + c.reset, imgErr?.message || imgErr);
    }
  }

  if (result.video) {
    let mp4Video = null;
    try {
      mp4Video = await prepareWhatsappMp4Video(result.video, result.audio || '');
      await sendFn({
        video: mp4Video.content,
        caption: `🎬 *Video MP4*\n${result.title || input}\n\n_${mp4Video.note}_`,
        mimetype: 'video/mp4',
        fileName: 'LoveBot-Video.mp4',
        gifPlayback: false
      }, { quoted: msg });
      sentMedia++;
    } catch (vidErr) {
      console.log(c.bold + c.brightYellow + '[media] Video konnte nicht als Video gesendet werden.' + c.reset, vidErr?.message || vidErr);
      if (mp4Video && Buffer.isBuffer(mp4Video.content)) {
        try {
          await sendFn({
            document: mp4Video.content,
            mimetype: 'video/mp4',
            fileName: 'LoveBot-Video.mp4',
            caption: `🎬 *Video MP4 Datei*\n${result.title || input}`
          }, { quoted: msg });
          sentMedia++;
        } catch (docVidErr) {
          try { await sendFn({ text: `> 🎬 *Video konnte nicht direkt gesendet werden.*\n${result.video}` }, { quoted: msg }); } catch (e) {}
        }
      } else {
        try { await sendFn({ text: `> 🎬 *Video konnte nicht direkt gesendet werden.*\n${result.video}` }, { quoted: msg }); } catch (e) {}
      }
    }
  }

  if (result.audio || result.video) {
    let mp4Audio = null;
    try {
      mp4Audio = await prepareWhatsappAudio(result.audio || '', result.video || '');
      await sendFn({
        audio: mp4Audio.content,
        mimetype: mp4Audio.mimetype,
        fileName: mp4Audio.fileName || 'LoveBot-Audio.m4a',
        ptt: false
      }, { quoted: msg });
      sentMedia++;
    } catch (audErr) {
      console.log(c.bold + c.brightYellow + '[media] Audio konnte nicht als Audio gesendet werden.' + c.reset, audErr?.message || audErr);
      if (mp4Audio && Buffer.isBuffer(mp4Audio.content)) {
        try {
          await sendFn({
            document: mp4Audio.content,
            mimetype: mp4Audio.mimetype || 'audio/mp4',
            fileName: mp4Audio.fileName || 'LoveBot-Audio.m4a',
            caption: `🎧 *Audio Datei*\n${result.title || input}`
          }, { quoted: msg });
          sentMedia++;
        } catch (docAudErr) {
          const audioLink = result.audio || result.video || '';
          try { await sendFn({ text: `> 🎧 *Audio konnte nicht direkt gesendet werden.*\n${audioLink}` }, { quoted: msg }); } catch (e) {}
        }
      } else {
        const audioLink = result.audio || result.video || '';
        try { await sendFn({ text: `> 🎧 *Audio konnte nicht direkt gesendet werden.*\n${audioLink}` }, { quoted: msg }); } catch (e) {}
      }
    }
  }

  return sentMedia;
}

/* ---------- AUTO-DOWNLOAD für YouTube/TikTok/Instagram-Links ------ */
const AUTODL_PLATFORMS = new Set(['youtube', 'tiktok', 'instagram']);
const AUTODL_LINK_REGEX = /youtube\.com|youtu\.be|tiktok\.com|instagram\.com|instagr\.am/i;
const autodlSeenMessageIds = new Set();

async function handleAutoLinkDownload(sock, msg, from, text) {
  try {
    if (!AUTODL_LINK_REGEX.test(text)) return;

    const msgId = msg.key?.id;
    if (msgId) {
      if (autodlSeenMessageIds.has(msgId)) return;
      autodlSeenMessageIds.add(msgId);
      if (autodlSeenMessageIds.size > 500) {
        autodlSeenMessageIds.delete(autodlSeenMessageIds.values().next().value);
      }
    }

    const isGroupChat = String(from).endsWith('@g.us');
    if (isGroupChat) {
      const db = readDb();
      const gid = cleanId(from);
      const g = db.groups?.[gid];
      if (!g) return;                 // Gruppe ist dem Bot nicht bekannt
      if (g.active === false) return; // Bot ist in der Gruppe deaktiviert
      if (g.autodl === false) return; // Auto-Download wurde abgeschaltet
    }

    const urls = extractUrls(text);
    const targetUrl = urls.find((u) => AUTODL_PLATFORMS.has(detectPlayPlatform(u)));
    if (!targetUrl) return;

    const platform = detectPlayPlatform(targetUrl);
    const platformLabel = { youtube: 'YouTube ▶️', tiktok: 'TikTok 🎵', instagram: 'Instagram 📸' }[platform] || platform;
    logLove('autodl', `${platformLabel}-Link in ${from} erkannt — Download startet …`, c.brightCyan);

    let statusKey = null;
    try {
      const statusMsg = await sock.sendMessage(from, {
        text: '> 📥 *LOVE BOT — AUTO DOWNLOAD*\n\n' +
          `• 🔗 *Plattform:* ${platformLabel}\n` +
          '⏳ _Medien werden geladen …_'
      }, { quoted: msg });
      statusKey = statusMsg?.key || null;
    } catch (statusErr) {}

    try {
      const result = await resolvePlayRequest(targetUrl);
      await sendPlayResultMedia(sock, from, msg, result, targetUrl, {
        auto: true,
        statusKey
      });
      logLove('autodl', `${platformLabel} erfolgreich geladen und gesendet.`, c.brightGreen);
    } catch (dlErr) {
      const errText = `> ❌ *AUTO DOWNLOAD — FEHLER*\n\n${dlErr?.message || String(dlErr)}\n\n💡 Alternativ: *${pref}play ${targetUrl}*`;
      try {
        if (statusKey) await editTextMessage(sock, from, statusKey, errText);
        else await sock.sendMessage(from, { text: errText }, { quoted: msg });
      } catch (e) {}
      logLove('autodl', `Download fehlgeschlagen: ${dlErr?.message || dlErr}`, c.brightRed);
    }
  } catch (outerErr) {
    logLove('autodl', `Unerwarteter Fehler: ${outerErr?.message || outerErr}`, c.brightYellow);
  }
}

/* ---------- MARRY-System 💍 ---------------------------------------- */
const MARRY_EXPIRY_MS = 2 * 60 * 1000; // Antrag läuft nach 2 Minuten ab (interaktiv, im selben Chat)

function getMarryProposals(db) {
  db = ensureDb(db);
  if (!db.meta.marryProposals || typeof db.meta.marryProposals !== 'object') {
    db.meta.marryProposals = {};
  }
  return db.meta.marryProposals;
}

function findMarryProposalFor(db, targetKey, chatJid) {
  const proposals = getMarryProposals(db);
  const now = Date.now();
  const cleanTarget = cleanId(targetKey || '');
  for (const [key, p] of Object.entries(proposals)) {
    if (!p || typeof p !== 'object') continue;
    if (p.expiresAt && p.expiresAt < now) {
      delete proposals[key];
      continue;
    }
    const matchesTarget = cleanId(key) === cleanTarget
      || cleanId(p.toKey || '') === cleanTarget
      || cleanId(p.toJid || '') === cleanTarget
      || cleanId(p.toLid || '') === cleanTarget;
    if (matchesTarget && (!chatJid || p.chatJid === chatJid)) return p;
  }
  return null;
}

function getProfileDisplayName(profile, fallback) {
  return profile?.registration?.name || profile?.identity?.username || fallback || 'Unbekannt';
}

function loveStatusText(profile) {
  const love = profile?.love;
  if (!love || love.married !== true) {
    return '🕊️ Single — die große Liebe wartet noch …';
  }
  const since = love.marriedAt ? new Date(love.marriedAt) : null;
  const days = since ? Math.max(0, Math.floor((Date.now() - since.getTime()) / 86400000)) : 0;
  return `💍 Verheiratet mit *${love.spouseName || 'Unbekannt'}* 🌹\n` +
    `  • *Hochzeit:* ${formatDateTimeShort(love.marriedAt)}\n` +
    `  • *Gemeinsame Zeit:* ${days} Tag${days === 1 ? '' : 'e'} 💕`;
}

/* ── 🪪 Profil-Karten: XP-Balken, kompakt & Detail ────────────────────
   Datenbasis: UserProfile + loveplus-Snapshot (getLoveSnapshot).
   Nur echte Werte — Fehlendes bleibt '—', Alter niemals öffentlich.     */
function xpBarText(cur, needed, width = 18) {
  const c = Math.max(0, Number(cur) || 0);
  const n = Math.max(1, Number(needed) || 1);
  const pct = Math.min(100, Math.round((c / n) * 100));
  const filled = Math.round((pct / 100) * width);
  return { bar: '█'.repeat(filled) + '░'.repeat(width - filled), pct, rest: Math.max(0, n - c) };
}

function buildCompactProfileCard({ userProfile, snapshot, roleText = '', name, username, regDate, pref = '$' }) {
  const p = userProfile || {};
  const prog = p.progression || {};
  const xp = xpBarText(prog.xp, prog.neededXpForLvOrPrestigeUp);
  const snap = snapshot || {};
  const eco = snap.economy || {};
  const love = snap.love || {};
  const pet = snap.pet;
  const ach = snap.achievements || { count: 0 };
  const de = (n) => Number(n || 0).toLocaleString('de-DE');
  const out = [
    '> 🪪 *' + (name && name !== 'Nicht angegeben' ? name : 'LoveBot-Profil') + '*',
    (username && username !== 'Nicht vorhanden') ? '🔗 ' + username : '',
    '',
    '⭐ *Level ' + (prog.level || 0) + '*' + (prog.prestige ? ' · 👑 Prestige ' + prog.prestige : ''),
    '`' + xp.bar + '`  ' + xp.pct + '%',
    '✨ ' + de(prog.xp) + ' / ' + de(prog.neededXpForLvOrPrestigeUp) + ' XP — noch ' + de(xp.rest) + ' bis Level ' + ((prog.level || 0) + 1),
    '',
    '💎 ' + de(eco.copper) + ' Kupfer' + (eco.walletRank ? ' · Wallet-Rang #' + eco.walletRank : '') + (eco.items ? ' · 📦 ' + eco.items + ' Items' : ''),
    love.married
      ? '💍 Verheiratet mit *' + (love.spouseName || '?') + '*' + (love.daysTogether !== null && love.daysTogether !== undefined ? ' — ' + love.daysTogether + ' Tag(e)' : '')
      : '🕊️ Single — die große Liebe wartet noch',
  ];
  if (love.couple) out.push('💗 Couple: Lv ' + love.couple.level + ' · ' + de(love.couple.loveXp) + ' Love-XP · 🔥 ' + love.couple.streak + 'd Streak');
  if (pet) out.push('🐶 ' + pet.name + ' ' + pet.type + ' (Lv ' + pet.level + ')');
  out.push('🔥 Daily-Streak: ' + (snap.streak || 0) + ' Tag(e) · 🏆 ' + (ach.count || 0) + ' Achievements');
  if (roleText && String(roleText).trim()) out.push(String(roleText).trim());
  if (regDate) out.push('📅 Registriert seit: ' + regDate);
  out.push('');
  out.push('💡 ' + pref + 'me info — alles im Detail · ' + pref + 'profile @user — andere ansehen');
  return out.filter((l) => l !== '').join('\n');
}

function buildDetailProfileCard({ userProfile, snapshot, isHost = false, roleText = '', name, username, regDate, pref = '$', privateView = false }) {
  const p = userProfile || {};
  const prog = p.progression || {};
  const xp = xpBarText(prog.xp, prog.neededXpForLvOrPrestigeUp);
  const snap = snapshot || {};
  const eco = snap.economy || {};
  const love = snap.love || {};
  const pet = snap.pet;
  const ach = snap.achievements || { count: 0, preview: [] };
  const games = snap.games || {};
  const reg = p.registration || {};
  const de = (n) => Number(n || 0).toLocaleString('de-DE');
  const out = [ '> 🪪✨ *PROFIL — ALLES IM DETAIL*' ];

  if (isHost) {
    out.push('', '*🔐 ACCOUNT (nur du siehst das)*',
      '• Username: ' + (username || '—'),
      '• BID: `' + (p.identity?.bid || '—') + '`',
      '• DSGVO: ' + (p.status?.dsgvo?.accepted ? 'Akzeptiert ✅' : 'Offen ☑️') + ' · Verify: ' + (p.status?.verified ? '✅' : '☑️'));
  }
  out.push('', '*👤 PROFIL*',
    '• Name: ' + (reg.name || name || '—'),
    '• Status: ' + (reg.status || '—'),
    '• Stadt: ' + (reg.city || '—'),
    '• Registriert: ' + (regDate || (reg.registeredAt ? new Date(reg.registeredAt).toLocaleDateString('de-DE') : '—')));
  /* Alter bewusst NICHT öffentlich — nur für Funktionen, die es brauchen. */
  out.push('', '*⭐ LEVEL & XP*',
    '• Level *' + (prog.level || 0) + '*' + (prog.prestige ? ' · Prestige ' + prog.prestige : ''),
    '• `' + xp.bar + '`  ' + xp.pct + '%',
    '• ' + de(prog.xp) + ' / ' + de(prog.neededXpForLvOrPrestigeUp) + ' XP',
    '• Noch *' + de(xp.rest) + ' XP* bis Level ' + ((prog.level || 0) + 1));
  out.push('', '*💎 ECONOMY*',
    '• 🤎 ' + de(eco.copper) + ' Kupfer · 🩶 ' + de(eco.silver) + ' Silber · 💛 ' + de(eco.gold) + ' Gold · 🩵 ' + de(eco.platin) + ' Platin',
    '• 🏦 Bank: ' + de(eco.bank),
    '• Wallet-Rang: ' + (eco.walletRank ? '#' + eco.walletRank : '—'),
    '• 📦 Items: ' + (eco.items || 0));
  out.push('', '*❤️ LOVE*');
  if (love.married) {
    out.push('• 💍 Verheiratet mit *' + (love.spouseName || '?') + '*',
      '• 🏩 Seit ' + (love.marriedAt ? new Date(love.marriedAt).toLocaleDateString('de-DE') : '—') + ' — ' + (love.daysTogether ?? 0) + ' Tag(e)',
      (love.couple ? '• 💗 Couple-Level ' + love.couple.level + ' · ' + de(love.couple.loveXp) + ' Love-XP · 🔥 ' + love.couple.streak + 'd Streak · 💌 ' + love.couple.memories + ' Erinnerungen' : '• 💗 Couple-Stats: siehe *' + pref + 'couplestats*'),
      '• 💒 Ehen gesamt: ' + (love.marriages || 1));
  } else {
    out.push('• 🕊️ Single — die große Liebe wartet noch …');
  }
  out.push('', '*🐶 PET*');
  if (pet) {
    out.push('• ' + pet.name + ' ' + pet.type + ' — Level ' + pet.level,
      '• ❤️ Bond ' + (pet.love ?? 0) + '% · 😊 Glück ' + (pet.mood ?? 0) + '% · 🍖 Hunger ' + (pet.hunger ?? 0) + '% · ⚡ Energie ' + (pet.energy ?? 0) + '%');
  } else {
    out.push('• Noch kein Haustier — *' + pref + 'pet create <name>* 🐾');
  }
  out.push('', '*🏆 ACHIEVEMENTS*',
    '• ' + (ach.count || 0) + ' freigeschaltet' + (ach.count ? '' : ' — noch keine'));
  for (const a of (ach.preview || []).slice(0, 4)) out.push('• ' + (a.emoji || '🏅') + ' ' + a.name);
  if (ach.count > 4) out.push('• … und ' + (ach.count - 4) + ' weitere — *' + pref + 'achievements*');
  out.push('', '*🎮 GAMES*',
    '• Siege: ' + de(games.wins) + ' · Niederlagen: ' + de(games.losses) + ' · Aktuelle Siegesserie: ' + de(games.winStreak));
  /* ❤️ Love-Core-Zähler (echte Werte aus Database/lovecore.json) */
  const coreBid = p?.identity?.bid || '';
  const coreKey = love.couple?.key || coupleKeyForProfile(p);
  const core = getCore(coreBid, coreKey);
  const coreMessages = core.couple?.loveMessages || core.user?.loveMessages || 0;

  out.push('', '*📊 ACTIVITY*',
    '• Daily-Streak: ' + (snap.streak || 0) + ' Tag(e)',
    '• 💌 Liebesnachrichten: ' + de(coreMessages) + (core.couple ? ' _(als Paar)_' : ' _(als Single)_'),
    '• 🔒 Sichtbarkeit: Stadt ' + (reg?.privacy?.hideCity ? 'versteckt' : (privateView ? 'sichtbar' : 'maskiert')) +
      ' · Alter ' + (reg?.privacy?.hideAge ? 'versteckt' : (isMinor(reg) ? 'unter 18 (geschützt)' : 'sichtbar')));
  if (roleText && String(roleText).trim()) out.push('', String(roleText).trim());
  out.push('', '🌹 _LoveBot by Maxichen_ 🌹');
  return out.join('\n');
}

async function completeMarryDecision(sock, from, proposal, decision, msg = null) {
  try {
    const db = readDb();
    const proposals = getMarryProposals(db);
    const pKey = Object.keys(proposals).find((k) => proposals[k]?.id === proposal.id);
    if (pKey) delete proposals[pKey];
    writeDb(db);

    const mentionFrom = proposal.fromJid || proposal.fromLid || '';
    const mentionTo = proposal.toJid || proposal.toLid || '';

    if (decision === 'accept') {
      const fromProfile = await loadUserProfileForSender({ jid: proposal.fromJid || '', lid: proposal.fromLid || '' });
      const toProfile = await loadUserProfileForSender({ jid: proposal.toJid || '', lid: proposal.toLid || '' });
      const nowIso = new Date().toISOString();
      const fromName = proposal.fromName || getProfileDisplayName(fromProfile, 'Unbekannt');
      const toName = proposal.toName || getProfileDisplayName(toProfile, 'Unbekannt');

      if (fromProfile) {
        fromProfile.love = {
          married: true,
          spouseName: toName,
          spouseKey: proposal.toKey,
          spouseBid: toProfile?.identity?.bid || null,
          marriedAt: nowIso,
          divorcedAt: null,
          marriages: (fromProfile.love?.marriages || 0) + 1
        };
        saveUserProfile(fromProfile);
      }
      if (toProfile) {
        toProfile.love = {
          married: true,
          spouseName: fromName,
          spouseKey: proposal.fromKey,
          spouseBid: fromProfile?.identity?.bid || null,
          marriedAt: nowIso,
          divorcedAt: null,
          marriages: (toProfile.love?.marriages || 0) + 1
        };
        saveUserProfile(toProfile);
      }

      /* 💗 Couple anlegen + 100 Love-XP + Achievement „Just Married“ (loveplus) */
      let marryBonus = null;
      try { marryBonus = onMarriageAccepted(fromProfile, toProfile); } catch (lpErr) {
        console.error('[marry] loveplus-Hook fehlgeschlagen:', lpErr?.message || lpErr);
      }

      const celebration =
        '🌹🌹🌹━━━━━━━━━━━━━━━━🌹🌹🌹\n\n' +
        '💍✨ *J U S T   M A R R I E D !* ✨💍\n\n' +
        `❤️ *@${cleanId(mentionFrom)}* & *@${cleanId(mentionTo)}*\n` +
        'haben *JA* gesagt! 🥂\n\n' +
        `💒 *Datum:* ${formatDateTimeShort(nowIso)}\n` +
        (marryBonus ? '💗 *Love-XP:* +100 Startbonus für euer Paar 💕\n' : '') +
        (marryBonus ? '🏆 *Achievement freigeschaltet:* 💍 Just Married\n' : '') +
        '🕊️ _Möge eure Liebe ewig halten!_\n\n' +
        '🌹🌹🌹━━━━━━━━━━━━━━━━🌹🌹🌹\n' +
        '💡 Euer Status erscheint jetzt in *$me* 💜';
      await sock.sendMessage(from, {
        text: celebration,
        mentions: [mentionFrom, mentionTo].filter(Boolean)
      }, msg ? { quoted: msg } : undefined);
      logLove('marry', `${fromName} 💍 ${toName} haben geheiratet!`, c.brightGreen);
      return 'accepted';
    }

    const denyText =
      '💔 *LEIDER ABGELEHNT* 💔\n\n' +
      `*@${cleanId(mentionTo)}* hat den Antrag von *@${cleanId(mentionFrom)}* abgelehnt.\n\n` +
      '🕊️ _Vielleicht klappt es beim nächsten Mal …_\n' +
      '🌹 Kein Groll — Liebe kann man nicht erzwingen. 🌹';
    await sock.sendMessage(from, {
      text: denyText,
      mentions: [mentionFrom, mentionTo].filter(Boolean)
    }, msg ? { quoted: msg } : undefined);
    logLove('marry', `Antrag von ${proposal.fromName || '?'} wurde abgelehnt.`, c.brightYellow);
    return 'denied';
  } catch (marryErr) {
    logLove('marry', `Fehler: ${marryErr?.message || marryErr}`, c.brightRed);
    try {
      await sock.sendMessage(from, { text: `> ❌ *MARRY Fehler:* ${marryErr?.message || marryErr}` }, msg ? { quoted: msg } : undefined);
    } catch (e) {}
    return 'error';
  }
}

/* Normale Chat-Antworten ("Ja"/"Nein") auf offene Anträge.           */
async function handleMarryPlainTextAnswer(sock, msg, from, trimmed) {
  try {
    const db = readDb();
    const proposals = getMarryProposals(db);
    if (!Object.keys(proposals).length) return false;

    const rawJid = msg.key?.participant || msg.key?.remoteJid || '';
    const rawLid = msg.key?.participantAlt || '';
    const targetKey = cleanId(rawLid) || cleanId(rawJid);
    if (!targetKey) return false;

    const proposal = findMarryProposalFor(db, targetKey, from);
    if (!proposal) return false;

    const norm = String(trimmed || '').toLowerCase().replace(/[!?.\s…]+$/g, '').trim();
    let decision = null;
    if (/^(ja|jaa|jaaa|yes|yess|yesyes|klar|jo|joa|ok|okay|einverstanden|natürlich|💍|✅|❤️|🥰|😍)$/.test(norm)) decision = 'accept';
    else if (/^(nein|nee|ne|nö|no|nope|lieber nicht|auf keinen fall|❌|💔)$/.test(norm)) decision = 'deny';
    if (!decision) return false;

    await completeMarryDecision(sock, from, proposal, decision, msg);
    try {
      await sendReaction(sock, from, decision === 'accept' ? '💍' : '💔', msg.key);
    } catch (reactErr) {}
    return true;
  } catch (e) {
    return false;
  }
}

/* ---------- HELP-Kategorien (schöneres Help-System) --------------- */
/* 📚 HELP_CATEGORIES kommt aus der zentralen Registry (registry/commands.json).
   Ein Befehl nur noch Dort definieren → automatisch in $help, Website, Tester & Doku.
   Session-Befehle sind als Kategorie 'session' bereits enthalten. */
const HELP_CATEGORIES = getHelpCategories();

function findHelpCategory(query) {
  const q = String(query || '').toLowerCase().trim();
  if (!q) return null;
  return HELP_CATEGORIES.find((cat) => cat.slug === q || cat.title.toLowerCase() === q) || null;
}

function buildHelpCategoryText(cat) {
  const LINE = '━━━━━━━━━━━━━━━━━━━━';
  const body = cat.cmds.map(([usage, desc]) => {
    /* usage in Befehl + Argumente zerlegen: "$marry @user" → ❥ *$marry* _@user_ */
    const parts = usage.split(' ');
    const cmd = parts[0];
    const rest = parts.slice(1).join(' ');
    return '❥ *' + cmd + '*' + (rest ? ' _' + rest + '_' : '') + ' — ' + desc;
  }).join('\n');
  return `> ${cat.emoji} *LOVE BOT — ${cat.title.toUpperCase()}*\n> _${cat.cmds.length} Befehle_\n\n` +
    body +
    `\n\n${LINE}\n` +
    `💡 *${pref}help* → Übersicht · *${pref}help alle* → alles\n` +
    '🌹 _LoveBot by Maxichen_';
}

function buildHelpAllText() {
  const LINE = '━━━━━━━━━━━━━━━━━━━━';
  const parts = ['> 🤖💜 *LOVE BOT — ALLE BEFEHLE* 💜🤖', ''];
  for (const cat of HELP_CATEGORIES) {
    parts.push(LINE);
    parts.push(`${cat.emoji} *${cat.title.toUpperCase()}* _(${cat.cmds.length})_`);
    parts.push('');
    for (const [usage, desc] of cat.cmds) {
      const seg = usage.split(' ');
      parts.push(`❥ *${seg[0]}*${seg.length > 1 ? ' _' + seg.slice(1).join(' ') + '_' : ''} — ${desc}`);
    }
    parts.push('');
  }
  parts.push(LINE);
  parts.push(`💡 *${pref}help <kategorie>* für eine Kategorie allein`);
  parts.push('🌹 _LoveBot by Maxichen · maxichen.de_');
  return parts.join('\n');
}

/* ---------- Fun-Daten (8-Ball, Witze, Fakten, Komplimente, RP) ---- */
const EIGHTBALL_ANSWERS = [
  '🟢 Ja, absolut!',
  '🟢 Ohne jeden Zweifel!',
  '🟢 Definitiv!',
  '🟢 Die Zeichen stehen gut.',
  '🟡 Hmm, frag später nochmal …',
  '🟡 Ich kann das gerade nicht vorhersagen.',
  '🟡 Konzentrier dich und frag nochmal!',
  '🔴 Eher nicht …',
  '🔴 Meine Antwort ist Nein.',
  '🔴 Vergiss es lieber.',
  '💜 Das Schicksal sagt: Vielleicht!',
  '🌟 Die Sterne sagen JA!'
];

const LOVEBOT_JOKES = [
  'Warum können Geister so schlecht lügen? Weil man durch sie hindurchsehen kann! 👻',
  'Was sagt ein Hai, wenn er einen Surfer frisst? „Hey, ist da Salat drin?" 🦈',
  'Warum nehmen Programmierer immer eine Leiter mit? Weil sie die höheren Programmiersprachen nicht verstehen! 🪜',
  'Egal wie gut du schläfst, German schläfst du nie! 😴',
  'Was ist grün und klopft an die Tür? Ein Klopfsalat! 🥬',
  'Warum ist das Meer blau? Weil sich die Fische übergeben! 🐟',
  'Treffen sich zwei Magneten. Sagt der eine: „Was soll ich heute anziehen?" 🧲',
  'Was macht ein Clown im Büro? Faxen! 🤡',
  'Wie nennt man einen dicken Kampfjet? Bomber! ✈️',
  'Warum fallen Ostfriesen vom Baum? Weil sie keine Wurzeln schlagen können! 🌳',
  'Was ist das Lieblingsessen von Autofahrern? Parkplätzchen! 🚗',
  'Geht ein Zebra ins Kino. Kommt der Film in Schwarz-Weiß? 🦓'
];

const LOVEBOT_FACTS = [
  '🧠 Oktopusse haben drei Herzen und blaues Blut!',
  '🧠 Honig wird niemals schlecht — man fand 3000 Jahre alten essbaren Honig in Ägypten!',
  '🧠 Eine Banane ist botanisch gesehen eine Beere, eine Erdbeere aber nicht!',
  '🧠 Der erste Computer „ENIAC" wog 27 Tonnen!',
  '🧠 Dein Gehirn verbraucht etwa 20% deiner gesamten Energie!',
  '🧠 In der Schweiz ist es verboten, ein einzelnes Meerschweinchen zu halten — sie sind gesetzlich gesellig!',
  '🧠 Ein Tag auf der Venus ist länger als ein Jahr auf der Venus!',
  '🧠 Otter halten beim Schlafen Händchen, damit sie nicht auseinanderdriften! 🦦',
  '🧠 WhatsApp-Nachrichten werden Ende-zu-Ende verschlüsselt — nicht mal WhatsApp kann mitlesen!',
  '🧠 Das Herz eines Blauwals ist so groß, dass ein kleines Kind hindurchschwimmen könnte!',
  '🧠 Elefanten können sich selbst im Spiegel erkennen!',
  '🧠 Der längste registrierte Flug eines Huhns dauerte 13 Sekunden! 🐔'
];

const LOVEBOT_COMPLIMENTS = [
  '🌹 Du bist wie Sonnenschein an einem Regentag!',
  '💜 Dein Lächeln könnte ganze Städte erhellen!',
  '✨ Du machst jeden Chat ein bisschen schöner!',
  '🌟 Mit dir wird jede Gruppe zur VIP-Lounge!',
  '💫 Du hast das Herz am richtigen Fleck!',
  '🔥 Deine Energie ist einfach ansteckend — im besten Sinne!',
  '🥰 Bei dir fühlt sich jeder willkommen!',
  '👑 Du wärst selbst in einem Raum voller Stars der Hauptgewinn!',
  '🌸 Deine Art ist einzigartig — bleib genau so!',
  '💎 Du bist seltener als ein Diamant!'
];

const KISS_PHRASES = [
  'küsst 💋 zärtlich …',
  'gibt einen Kuss auf die Stirn 😘',
  'küsst leidenschaftlich 💋🔥',
  'haucht einen kleinen Kuss zu 😚',
  'küsst mitten ins Herz 💘'
];

const HUG_PHRASES = [
  'umarmt ganz fest 🤗',
  'drückt lieb an sich 🫂',
  'gibt eine warme Umarmung 🤗💜',
  'umarmt, bis alles gut ist 🫂✨',
  'schlingt die Arme um 💜'
];

const SLAP_PHRASES = [
  'gibt eine saftige Ohrfeige 🖐️💥',
  'klatscht einmal kräftig 🫲😤',
  'haut mit der flachen Hand drauf 🖐️',
  'verpasst einen Klaps 🤚💨',
  'schlägt dramatisch wie in einer Telenovela 🎭🖐️'
];

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/* Deterministischer Love-o-Meter-Wert für zwei Identitäten.         */
function shipHashPercent(a, b) {
  const s = [String(a), String(b)].sort().join('💜LOVEBOT💜');
  let h = 7;
  for (const ch of s) {
    h = (h * 31 + ch.codePointAt(0)) >>> 0;
  }
  return h % 101;
}

function shipBar(pct) {
  const filled = Math.round(pct / 10);
  return '❤️'.repeat(filled) + '🖤'.repeat(Math.max(0, 10 - filled));
}

function shipComment(pct) {
  if (pct >= 90) return '🔥 Seelenverwandte! Das ist Schicksal!';
  if (pct >= 75) return '🥰 Wow — das passt richtig gut!';
  if (pct >= 55) return '💜 Da geht was — traut euch!';
  if (pct >= 35) return '🙂 Hmm … mit Arbeit vielleicht.';
  if (pct >= 15) return '😅 Eher Freundschaft …';
  return '💔 Ohje … lieber nicht.';
}

/* ---------- 🎛️ Gruppen-Feature-Toggles ($an / $aus / $gi) --------- */
const GROUP_FEATURES = [
  { key: 'autodl', dbKey: 'autodl', emoji: '📥', label: 'Auto-Download', desc: 'YouTube-, TikTok- & Instagram-Links automatisch laden', aliases: ['autodownload', 'download', 'links', 'autodownload'], defaultOn: true },
  { key: 'welcome', dbKey: 'welcome', emoji: '👋', label: 'Welcome', desc: 'Willkommensnachricht für neue Mitglieder', aliases: ['willkommen', 'joinmsg', 'welcomemsg'], defaultOn: true },
  { key: 'goodbye', dbKey: 'goodbye', emoji: '🚪', label: 'Goodbye', desc: 'Abschiedsnachricht beim Verlassen', aliases: ['tschüss', 'bye', 'leavemsg', 'abschied'], defaultOn: true },
  { key: 'kickmsg', dbKey: 'kick', emoji: '🦵', label: 'Kick-News', desc: 'Nachricht, wenn jemand gekickt wird', aliases: ['kick', 'kicknachricht', 'kickmsg'], defaultOn: true },
  { key: 'promotemsg', dbKey: 'promote', emoji: '⭐', label: 'Promote-News', desc: 'Nachricht bei Admin-Beförderung', aliases: ['promote', 'promotenachricht'], defaultOn: true },
  { key: 'demotemsg', dbKey: 'demote', emoji: '⬇️', label: 'Demote-News', desc: 'Nachricht bei Admin-Entfernung', aliases: ['demote', 'demotenachricht'], defaultOn: true },
  { key: 'liebe', dbKey: 'liebe', emoji: '💍', label: 'Liebe & Marry', desc: 'marry, divorce, ship, kiss, hug, slap, compliment', aliases: ['marry', 'love', 'heiraten', 'herzen', 'lieben'], defaultOn: true },
  { key: 'fun', dbKey: 'fun', emoji: '🎉', label: 'Fun & Spiele', desc: 'witz, fakt, 8ball, rps, slot, truth, dare, dice …', aliases: ['spass', 'spaß', 'spiele', 'games', 'jokes', 'spielen'], defaultOn: true },
  { key: 'media', dbKey: 'media', emoji: '🎨', label: 'Media & Play', desc: '$play, $audio und Musik-/Video-Downloads', aliases: ['play', 'musik', 'medien', 'music'], defaultOn: true },
  { key: 'tools', dbKey: 'tools', emoji: '🧰', label: 'Werkzeuge', desc: 'calc, b64, reverse, flip, upper, lower, length …', aliases: ['werkzeuge', 'utilities', 'utils', 'tool'], defaultOn: true },
  { key: 'badwords', dbKey: 'badwords', emoji: '🤬', label: 'Badword-Filter', desc: 'Beleidigungen löschen + verwarnen (3 = Kick & Ban)', aliases: ['badword', 'schimpfwörter', 'schimpfworte', 'flüche', 'filter', 'beleidigungen'], defaultOn: true },
  { key: 'antilink', dbKey: 'antilink', emoji: '🔗', label: 'Anti-Link', desc: 'Gruppen-Einladungslinks von Nicht-Admins löschen + verwarnen', aliases: ['links', 'invitelinks', 'gruppenlinks', 'werbelinks'], defaultOn: false },
  { key: 'night', dbKey: 'night', emoji: '☾', label: 'Night & Mood', desc: 'goodnight, goodmorning, mood, nightquote — Nacht-Features', aliases: ['nacht', 'nightmode', 'nachtmodus', 'moodfeature'], defaultOn: true },
  { key: 'afk', dbKey: 'afk', emoji: '😴', label: 'AFK-System', desc: 'AFK-Status + Auto-Comeback-Nachricht', aliases: ['afksystem', 'abwesend', 'afkmodus'], defaultOn: true }
];

/* Welche Befehle durch welches Feature gesteuert werden.            */
const FEATURE_COMMAND_MAP = {
  liebe: new Set(['marry', 'heiraten', 'propose', 'divorce', 'scheidung', 'ship', 'lovetest', 'loveometer', 'kiss', 'kuss', 'hug', 'umarmen', 'slap', 'ohrfeige', 'compliment', 'lob', 'kompliment', 'lovecalc', 'compat', 'flirt', 'anmachen', 'confess', 'geständnis', 'confesslove', 'date', 'dateidee', 'romantic', 'romantisch', 'breakup', 'trennung']),
  fun: new Set(['witz', 'joke', 'fakt', 'fact', '8ball', 'achtball', 'magie', 'rps', 'slot', 'slotmini', 'dice', 'dice2', 'coin', 'münze', 'truth', 'dare', 'random', 'spin', 'automaten', 'kaset', 'toy', 'wouldyou', 'würdestdu', 'quote', 'zitat', 'roast', 'roasten']),
  media: new Set(['play', 'audio']),
  tools: new Set(['calc', 'b64', 'base64', 'reverse', 'flip', 'upside', 'upper', 'uppercase', 'lower', 'lowercase', 'length', 'len', 'invisible', 'blank']),
  night: new Set(['goodnight', 'gutenacht', 'nacht', 'goodmorning', 'gutenmorgen', 'morgen', 'nightquote', 'nachtzitat', 'nq', 'mood', 'stimmung'])
};

function findGroupFeature(query) {
  const q = String(query || '').toLowerCase().trim();
  if (!q) return null;
  return GROUP_FEATURES.find((f) =>
    f.key === q ||
    f.label.toLowerCase() === q ||
    (f.aliases || []).includes(q)
  ) || null;
}

/* Normalisierter Feature-Status einer Gruppe (Defaults inklusive).  */
function getGroupFeatureState(db, groupId) {
  db = ensureDb(db);
  const g = db.groups?.[groupId] || {};
  const state = {};
  for (const f of GROUP_FEATURES) {
    const val = g[f.dbKey];
    state[f.key] = val === undefined ? f.defaultOn : val !== false;
  }
  return state;
}

function isGroupFeatureEnabled(db, groupId, key) {
  return getGroupFeatureState(db, groupId)[key] !== false;
}

function setGroupFeature(groupId, featureKey, on) {
  const db = readDb();
  if (!db.groups[groupId]) db.groups[groupId] = {};
  const feature = GROUP_FEATURES.find((f) => f.key === featureKey);
  if (!feature) return false;
  db.groups[groupId][feature.dbKey] = on === true;
  writeDb(db);
  return true;
}

function buildFeatureOverviewText(db, groupId, groupSubject) {
  const state = getGroupFeatureState(db, groupId);
  const onCount = GROUP_FEATURES.filter((f) => state[f.key]).length;
  const lines = GROUP_FEATURES.map((f) => {
    const on = state[f.key];
    return `${on ? '✅' : '❌'} ${f.emoji} *${f.label}* — ${on ? 'AN' : 'AUS'}\n   _${f.desc}_`;
  });
  return '> 🎛️ *LOVE BOT — GRUPPEN-FEATURES* 🎛️\n\n' +
    (groupSubject ? `📌 *Gruppe:* ${groupSubject}\n` : '') +
    `📊 *Aktiv:* ${onCount}/${GROUP_FEATURES.length}\n\n` +
    lines.join('\n\n') +
    '\n\n━━━━━━━━━━━━━━━━━━━━━━\n' +
    `💡 *${pref}an <feature>* — einschalten\n` +
    `💡 *${pref}aus <feature>* — ausschalten\n` +
    `💡 *${pref}an alle* / *${pref}aus alle* — alles auf einmal\n` +
    '🔒 Umschalten können nur Admins & der Owner.';
}

/* Liefert das blockierende Feature für einen Befehl (oder null).    */
function getBlockedFeatureForCommand(db, groupId, command) {
  for (const [featureKey, cmds] of Object.entries(FEATURE_COMMAND_MAP)) {
    if (cmds.has(command) && !isGroupFeatureEnabled(db, groupId, featureKey)) {
      return GROUP_FEATURES.find((f) => f.key === featureKey) || null;
    }
  }
  return null;
}

async function handleFeatureToggle(sock, from, msg, args, turnOn, userRole, groupMetadata = null) {
  if (!String(from).endsWith('@g.us')) {
    await sock.sendMessage(from, {
      text: '> 🎛️ *FEATURES GIBT ES NUR IN GRUPPEN*\n\nIn Privat-Chats ist immer alles aktiv. 💜'
    }, { quoted: msg });
    return;
  }
  if (userRole !== 'host' && userRole !== 'superadmin' && userRole !== 'admin') {
    await sock.sendMessage(from, {
      text: '> ⛔ *Zugriff verweigert:* Nur Admins, Superadmins oder der Owner können Features umschalten.'
    }, { quoted: msg });
    try { await sendReaction(sock, from, reactions.access.reactions.unauthorized, msg.key); } catch (e) {}
    return;
  }

  const query = String(args.join(' ') || '').toLowerCase().trim();
  const gid = cleanId(from);

  if (!query) {
    await sock.sendMessage(from, {
      text: `> 🎛️ *FEATURE UMSCHALTEN*\n\n` +
        `Nutze: *${pref}${turnOn ? 'an' : 'aus'} <feature>*\n\n` +
        '*Verfügbare Features:*\n' +
        GROUP_FEATURES.map((f) => `• *${f.key}* — ${f.emoji} ${f.label}`).join('\n') +
        `\n\n💡 *${pref}${turnOn ? 'an' : 'aus'} alle* schaltet alles um.\n` +
        `📊 Aktueller Stand: *${pref}gi*`
    }, { quoted: msg });
    return;
  }

  /* Alles auf einmal */
  if (['alle', 'alles', 'all', 'everything', 'everything!'].includes(query)) {
    for (const f of GROUP_FEATURES) setGroupFeature(gid, f.key, turnOn);
    const icon = turnOn ? '✅' : '❌';
    await sock.sendMessage(from, {
      text: `> 🎛️ ${icon} *ALLE FEATURES ${turnOn ? 'AKTIVIERT' : 'DEAKTIVIERT'}!* (${GROUP_FEATURES.length}/${GROUP_FEATURES.length})\n\n📊 Details: *${pref}gi*`
    }, { quoted: msg });
    try { await sendReaction(sock, from, turnOn ? '✅' : '❌', msg.key); } catch (e) {}
    logLove('features', `Alle Features ${turnOn ? 'aktiviert' : 'deaktiviert'} in ${from}.`, c.brightCyan);
    return;
  }

  const feature = findGroupFeature(query);
  if (!feature) {
    await sock.sendMessage(from, {
      text: `> ❓ *Feature „${query}“ nicht gefunden.*\n\n*Verfügbar:*\n` +
        GROUP_FEATURES.map((f) => `• *${f.key}* — ${f.emoji} ${f.label}`).join('\n')
    }, { quoted: msg });
    return;
  }

  setGroupFeature(gid, feature.key, turnOn);
  const icon = turnOn ? '✅' : '❌';
  await sock.sendMessage(from, {
    text: `> 🎛️ ${icon} *${feature.label.toUpperCase()} ${turnOn ? 'AKTIVIERT' : 'DEAKTIVIERT'}*\n\n` +
      `${feature.emoji} ${feature.desc}\n\n` +
      `📊 Stand aller Features: *${pref}gi*`
  }, { quoted: msg });
  try { await sendReaction(sock, from, turnOn ? '✅' : '❌', msg.key); } catch (e) {}
  logLove('features', `${feature.label} ${turnOn ? 'aktiviert' : 'deaktiviert'} in ${from}.`, c.brightCyan);
}

/* ---------- 🤬 BADWORD-Filter (Liste aus badwords.js) -------------- */
function getBadwordConfig(db) {
  db = ensureDb(db);
  if (!db.meta.badwords || typeof db.meta.badwords !== 'object') {
    db.meta.badwords = { enabled: true, added: [], removed: [] };
  }
  const cfg = db.meta.badwords;
  if (!Array.isArray(cfg.added)) cfg.added = [];
  if (!Array.isArray(cfg.removed)) cfg.removed = [];
  if (cfg.enabled === undefined) cfg.enabled = true;
  return cfg;
}

function getActiveBadwords(db) {
  const cfg = getBadwordConfig(db);
  const removedSet = new Set(cfg.removed.map((w) => String(w || '').toLowerCase()));
  const list = [...DEFAULT_BADWORDS, ...cfg.added].filter(
    (w) => w && !removedSet.has(String(w).toLowerCase())
  );
  return [...new Set(list)];
}

/* 🛡️ AUTO-MODERATION: Badwords & Anti-Link.
   Löscht die Nachricht, verwarnet den Absender und kickt+bannt bei
   3 Verwarnungen automatisch. Liefert 'handled' wenn eingegriffen.   */
async function runAutoModeration(sock, msg, from, text, sessionPath) {
  try {
    if (!String(from).endsWith('@g.us')) return null;
    if (!text || typeof text !== 'string') return null;

    const db = readDb();
    const gid = cleanId(from);
    const badwordsOn = isGroupFeatureEnabled(db, gid, 'badwords') && getBadwordConfig(db).enabled !== false;
    const antilinkOn = isGroupFeatureEnabled(db, gid, 'antilink');
    if (!badwordsOn && !antilinkOn) return null;

    const senderJid = msg.key?.participant || msg.key?.remoteJid || '';
    const senderLid = msg.key?.participantAlt || '';
    if (!senderJid) return null;

    /* Der Owner ist immun. */
    if (areJidsSameUser(senderJid, OWNER_CONFIG.jid)) return null;
    if (senderLid && cleanId(senderLid) === cleanId(OWNER_CONFIG.lid)) return null;
    /* Eingetragene Zusatz-Owner ($addowner) sind ebenfalls immun. */
    if (getRegisteredOwner(db, senderJid, senderLid)) return null;

    /* Treffer prüfen */
    let reason = '';
    if (badwordsOn) {
      const cfg = getBadwordConfig(db);
      const foundWord = findBadword(text, cfg.added, cfg.removed);
      if (foundWord) reason = `Badword (${censorWord(foundWord)})`;
    }
    if (!reason && antilinkOn && /chat\.whatsapp\.com\/[A-Za-z0-9]{8,}/i.test(text)) {
      reason = 'Gruppen-Einladungslink';
    }
    if (!reason) return null;

    /* Admins der Gruppe dürfen alles schreiben. */
    let metadata = null;
    try {
      metadata = await sock.groupMetadata(from);
    } catch (gmErr) {
      return null;
    }
    const participant = (metadata?.participants || []).find((p) =>
      areJidsSameUser(p.id, senderJid) || cleanId(p.id) === cleanId(senderJid)
    );
    if (participant && (participant.admin === 'admin' || participant.admin === 'superadmin')) {
      return null;
    }

    /* 1) Nachricht löschen (Bot muss Admin sein) */
    let deleted = false;
    try {
      await sock.sendMessage(from, { delete: msg.key });
      deleted = true;
    } catch (delErr) {}

    /* 2) Verwarnung speichern */
    const groupProfile = await loadGroupProfile(from, metadata, sock);
    if (groupProfile) {
      if (!groupProfile.warns || typeof groupProfile.warns !== 'object') groupProfile.warns = {};
      const wk = cleanId(senderJid);
      if (!groupProfile.warns[wk]) groupProfile.warns[wk] = [];
      groupProfile.warns[wk].push({ reason, by: 'LoveBot Automod 🤖', at: new Date().toISOString() });
      saveGroupProfile(groupProfile);
    }
    const warnCount = groupProfile?.warns?.[cleanId(senderJid)]?.length || 1;

    /* 3) Bei 3 Verwarnungen: Kick + Ban im Bot */
    if (warnCount >= 3) {
      try {
        if (typeof sock.groupParticipantsUpdate === 'function') {
          await sock.groupParticipantsUpdate(from, [senderJid], 'remove');
        }
      } catch (kickErr) {}

      try {
        banUser(readDb(), {
          jid: senderJid,
          lid: senderLid,
          reason: `3 Verwarnungen — zuletzt: ${reason}`,
          actorJid: OWNER_CONFIG.jid,
          actorLid: OWNER_CONFIG.lid,
          actorName: 'LoveBot Automod'
        });
      } catch (banErr) {}

      try {
        if (typeof sock.updateBlockStatus === 'function') {
          await sock.updateBlockStatus(senderJid, 'block');
        }
      } catch (blockErr) {}

      let removedGroups = [];
      try {
        removedGroups = await removeFromAllGroups(sock, senderJid);
      } catch (remErr) {}

      await sock.sendMessage(from, {
        text: '🚫⚠️ *AUTOMOD — KICK & BAN* ⚠️🚫\n\n' +
          `*@${cleanId(senderJid)}* wurde *gekickt und gebannt*!\n\n` +
          `• *Grund:* ${reason}\n` +
          `• *Verwarnungen:* ${warnCount}/3 erreicht\n` +
          `• *JID:* ${senderJid}\n` +
          `• *LID:* ${senderLid || '—'}\n` +
          `• *Aus ${removedGroups.length} weiteren Gruppen entfernt.*\n\n` +
          '🤖 _LoveBot Automod — kein Platz für Beleidigungen._',
        mentions: [senderJid]
      });
      logLove('automod', `${cleanId(senderJid)} nach 3 Verwarnungen gekickt & gebannt (${reason}).`, c.brightRed);
      return 'handled';
    }

    /* Normale Verwarnung */
    await sock.sendMessage(from, {
      text: `> ⚠️ *AUTOMOD — VERWARNUNG (${warnCount}/3)*\n\n` +
        `*@${cleanId(senderJid)}*, deine Nachricht wurde gelöscht.${deleted ? '' : ' (Löschen fehlgeschlagen — Bot braucht Admin-Rechte!)'}\n\n` +
        `• *Grund:* ${reason}\n` +
        `• *Stand:* ${warnCount}/3 Verwarnungen\n` +
        `• *JID:* ${senderJid}\n` +
        `• *LID:* ${senderLid || '—'}\n\n` +
        '🚫 *Bei 3 Verwarnungen: Kick + Ban.*\n' +
        '🤖 _LoveBot Automod_',
      mentions: [senderJid]
    }, { quoted: msg });
    logLove('automod', `${cleanId(senderJid)} verwarnt (${warnCount}/3) — ${reason}.`, c.brightYellow);
    return 'handled';
  } catch (automodErr) {
    logLove('automod', `Fehler: ${automodErr?.message || automodErr}`, c.brightRed);
    return null;
  }
}

/* ---------- 🤖 META AI — AUTO-WEITERLEITUNG ------------------------ */
function getMetaForwardConfig(db) {
  db = ensureDb(db);
  if (!db.meta.metaForward || typeof db.meta.metaForward !== 'object') {
    db.meta.metaForward = { enabled: false, targetJid: '', targetLabel: '' };
  }
  return db.meta.metaForward;
}

/* ---------- 👑 ZUSATZ-OWNER ($addowner / $delowner) ---------------- */
/* Nur der Haupt-Owner (OWNER_CONFIG) darf Owner eintragen/löschen.   */
/* Eingetragene Owner bekommen überall Owner-Rechte (isHost).         */
function getRegisteredOwners(db) {
  db = ensureDb(db);
  if (!Array.isArray(db.meta.owners)) db.meta.owners = [];
  return db.meta.owners;
}

function getRegisteredOwner(db, jid, lid) {
  const cj = cleanId(jid || '');
  const cl = cleanId(lid || '');
  if (!cj && !cl) return null;
  const owners = getRegisteredOwners(db);
  return owners.find((o) =>
    (cj && cleanId(o.jid || '') === cj) ||
    (cl && cleanId(o.lid || '') === cl)
  ) || null;
}

function isMainOwner(jid, lid) {
  try {
    if (jid && areJidsSameUser(jid, OWNER_CONFIG.jid)) return true;
    if (lid && areJidsSameUser(lid, OWNER_CONFIG.lid)) return true;
  } catch (moErr) {}
  return cleanId(jid || '') === cleanId(OWNER_CONFIG.jid)
    || cleanId(lid || '') === cleanId(OWNER_CONFIG.lid);
}

function isMetaAiSender(msg) {
  const sender = msg?.key?.participant || msg?.key?.remoteJid || '';
  return String(sender).startsWith('13135550002');
}

/* Leitet jede Nachricht von Meta AI an den konfigurierten Chat weiter. */
async function handleMetaAiForward(sock, msg) {
  try {
    if (msg?.key?.fromMe) return;
    if (!isMetaAiSender(msg)) return;
    if (!msg.message) return;
    const db = readDb();
    const cfg = getMetaForwardConfig(db);
    if (cfg.enabled !== true || !cfg.targetJid) return;
    const originChat = getChatId(msg.key);
    if (originChat === cfg.targetJid) return;
    await sock.sendMessage(cfg.targetJid, { forward: msg });
    logLove('metaforward', `Meta-AI-Antwort aus ${originChat} weitergeleitet.`, c.brightCyan);
  } catch (mfErr) {
    logLove('metaforward', `Fehler: ${mfErr?.message || mfErr}`, c.brightYellow);
  }
}

/* ---------- 💰 ECONOMY- & FUN-DATEN -------------------------------- */
const WORK_JOBS = [
  { job: 'Du hast Liebe-Briefe ausgetragen 💌', min: 40, max: 140 },
  { job: 'Du hast Rosen verkauft 🌹', min: 50, max: 160 },
  { job: 'Du hast im LoveBot-Büro Kaffee gekocht ☕', min: 30, max: 120 },
  { job: 'Du hast Herzen poliert 💜', min: 45, max: 150 },
  { job: 'Du hast Tanzstunden gegeben 💃', min: 60, max: 180 },
  { job: 'Du hast Liebeslieder gesungen 🎤', min: 55, max: 170 },
  { job: 'Du hast Cupid als Aushilfe vertreten 🏹', min: 70, max: 200 },
  { job: 'Du hast Hochzeits-Torten dekoriert 🎂', min: 65, max: 190 }
];

const ROAST_LINES = [
  'Dein WLAN-Passwort hat mehr Persönlichkeit als du. 📶',
  'Du bist wie ein Update: jeder wartet, bis du endlich fertig bist. ⏳',
  'Selbst dein Schatten verlässt dich, wenn es dunkel wird. 🌑',
  'Du bringst Leute um … ihre gute Laune. 😐',
  'Dein Profilbild ist der einzige Beweis, dass Filter existieren. 🤳',
  'Du bist der Grund, warum Shampoo eine Anleitung hat. 🧴',
  'Wenn Langeweile ein Mensch wäre … ach vergiss es, das bist du. 🥱',
  'Google findet zu dir auch nichts Interessantes. 🔍',
  'Du bist wie Montag: niemand mag dich, aber du kommst trotzdem immer wieder. 📅',
  'Deine Ideen sind so selten wie Schnee in der Sahara. 🏜️'
];

const EITHER_OR_QUESTIONS = [
  '🏖️ Für immer Sommer oder für immer Winter?',
  '🍕 Nie wieder Pizza oder nie wieder Döner?',
  '📵 Ein Jahr ohne Handy oder ein Jahr ohne Musik?',
  '🐶 Hunde-Mensch oder Katzen-Mensch?',
  '🌃 Nie wieder ausschlafen oder nie wieder ausschlafen dürfen … Moment — Früh aufstehen oder spät ins Bett?',
  '💬 Nur noch Sprachnachrichten oder nur noch Emojis?',
  '🎮 Nie wieder zocken oder nie wieder Filme/Serien?',
  '🍫 Nur noch Schokolade oder nur noch Chips?',
  '🌍 Nie wieder reisen oder nie wieder gut essen?',
  '💘 Die große Liebe finden oder 1 Million Euro?'
];

const NEVER_HAVE_I_EVER = [
  '🤫 Nie habe ich so getan, als hätte ich eine Nachricht nicht gesehen.',
  '📱 Nie habe ich heimlich das Profil von meinem Crush gestalkt.',
  '🍕 Nie habe ich Pizza zum Frühstück gegessen.',
  '😴 Nie habe ich im Unterricht/in der Arbeit geschlafen.',
  '💬 Nie habe ich eine Nachricht geschrieben und dann doch gelöscht.',
  '🎤 Nie habe ich unter der Dusche gesungen.',
  '🤥 Nie habe ich eine kleine Notlüge erzählt, um nicht rauszugehen.',
  '📺 Nie habe ich eine ganze Serie an einem Tag durchgesuchtet.',
  '🍟 Nie habe ich Pommes von jemand anderem geklaut.',
  '😅 Nie habe ich gewinkt, obwohl die Person jemand anderem gewinkt hat.'
];

const QUIZ_QUESTIONS = [
  { q: 'Wie viele Herzen hat ein Oktopus?', a: 'Drei Herzen! 🐙' },
  { q: 'Welches Land hat die meisten Einwohner?', a: 'Indien 🇮🇳 (seit 2023 vor China)' },
  { q: 'Wie nennt man eine Gruppe von Raben?', a: 'Eine „Verschwörung“ (engl. conspiracy) 🐦‍⬛' },
  { q: 'Welcher Planet ist der heißeste in unserem Sonnensystem?', a: 'Venus 🌡️ (ca. 465 °C)' },
  { q: 'Wie viele Knochen hat ein erwachsener Mensch?', a: '206 Knochen 🦴' },
  { q: 'Welches Tier kann als einziges rückwärts fliegen?', a: 'Der Kolibri 🐦' },
  { q: 'In welchem Jahr wurde WhatsApp gegründet?', a: '2009 📱' },
  { q: 'Was ist das größte Organ des Menschen?', a: 'Die Haut! 🧍' },
  { q: 'Wie viele Seiten hat ein Würfel?', a: 'Sechs! 🎲' },
  { q: 'Welche Farbe entsteht, wenn man Blau und Gelb mischt?', a: 'Grün 💚' }
];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/* 💾 Wallet-Helfer: lädt Profil, ändert Coins, speichert.            */
function addWalletCoins(profile, { copper = 0, silver = 0, gold = 0, platin = 0 } = {}) {
  if (!profile || !profile.wallet) return null;
  profile.wallet.copper = Math.max(0, (profile.wallet.copper || 0) + copper);
  profile.wallet.silver = Math.max(0, (profile.wallet.silver || 0) + silver);
  profile.wallet.gold = Math.max(0, (profile.wallet.gold || 0) + gold);
  profile.wallet.platin = Math.max(0, (profile.wallet.platin || 0) + platin);
  saveUserProfile(profile);
  return profile.wallet;
}

function walletText(profile) {
  const w = profile?.wallet || {};
  return `🤎 ${w.copper || 0} Kupfer · 🩶 ${w.silver || 0} Silber · 💛 ${w.gold || 0} Gold · 🩵 ${w.platin || 0} Platin`;
}

async function resolvePlayRequest(input) {
  const api = getMediaDownloaderApi();
  const query = String(input || '').trim();

  if (isHttpUrl(query)) {
    const platform = detectPlayPlatform(query);
    const fnMap = {
      instagram: () => api.instagram(query),
      tiktok: () => api.tikdown(query),
      youtube: () => api.ytdown(query),
      threads: () => api.threads(query),
      twitter: () => api.twitterdown(query),
      facebook: () => api.fbdown2(query, 'Nayan'),
      gdrive: () => api.GDLink(query),
      pinterest: () => api.pintarest(query),
      capcut: () => api.capcut(query),
      likee: () => api.likee(query),
      soundcloud: () => api.soundcloud(query),
      spotify: () => api.spotifyDl(query),
      terabox: () => api.terabox(query),
      alldown: () => api.alldown(query)
    };
    let raw;
    if (platform === 'youtube') {
      try {
        raw = await api.ytdown(query);
        if (raw?.status !== false) {
          const normalized = normalizePlayResult(raw, platform, query);
          if (normalized.video || normalized.audio) return normalized;
        }
      } catch (err) {}
      return downloadYoutubeDirect(query, query);
    }
    try {
      raw = await (fnMap[platform] || fnMap.alldown)();
    } catch (err) {
      raw = await api.alldown(query);
    }
    return normalizePlayResult(raw, platform, query);
  }

  // Bei $play <songname> IMMER YouTube nehmen, damit Video + Audio möglich ist.
  try {
    const youtubeUrl = await youtubeSearchFirst(query);
    try {
      const raw = await api.ytdown(youtubeUrl);
      if (raw?.status !== false) {
        const normalized = normalizePlayResult(raw, 'youtube', query);
        if (normalized.video || normalized.audio) {
          normalized.pageUrl = youtubeUrl;
          return normalized;
        }
      }
    } catch (err) {}
    return await downloadYoutubeDirect(youtubeUrl, query);
  } catch (ytErr) {
    throw new Error(`YouTube-Download fehlgeschlagen: ${ytErr?.message || String(ytErr)}`);
  }
}

/* ------------------------------------------------------------------ */
/*  check2 — Ban-Check im Meta-AI (aiimg) Format                       */
/* ------------------------------------------------------------------ */

/* Fortschritts-Stufen der Lade-Anzeige. Wird von 0 % bis 100 %       */
/* durchlaufen, bei 100 % erscheint die Antwort in der Lade und wird  */
/* unmittelbar danach als finales aiimg gesendet.                     */
const CHECK2_LABEL = 'LOVE BOT BAN CHECK';
const CHECK2_BRAND = 'LoveBot Industries';
const CHECK2_PROGRESS_STEPS = [
  { pct: 8, label: 'ZIEL AUFLÖSEN' },
  { pct: 20, label: 'VERBINDUNG' },
  { pct: 34, label: 'USYNC-ABFRAGE' },
  { pct: 48, label: 'REGISTERUNG' },
  { pct: 62, label: 'GERÄTE PRÜFEN' },
  { pct: 76, label: 'PROFIL PRÜFEN' },
  { pct: 88, label: 'BUSINESS PRÜFEN' },
  { pct: 96, label: 'AUSWERTEN' }
];
const CHECK2_PROGRESS_STEP_MS = 300;

/* Baut exakt den Payload, den auch $loadingaiimg verwendet — nur mit */
/* frei wählbarem Text (update_text) und Status.                      */
/* Exakt die Struktur von $loadingaivid (die nachweislich auf iOS UND */
/* Android rendert): imagine_type ANIMATE, media video/mp4, leeres    */
/* imagineMetadata, contextInfo OHNE isQuestion/botMessageSharingInfo.*/
/* status: 'READY' (100%, zeigt update_text) oder 'GENERATING'.       */
function buildVidImaginePayload(text, options = {}) {
  const status = options.status || 'GENERATING';
  const updateText = String(text == null ? '' : text);
  const statusObj = status === 'READY'
    ? { status: 'READY', update_text: updateText }
    : { status: 'GENERATING', estimated_completion_time: 17907430971, update_text: updateText };

  const unifiedObj = {
    response_id: generateMessageID(),
    sections: [{
      view_model: {
        primitive: {
          media: { url: '', mime_type: 'video/mp4' },
          imagine_type: 'ANIMATE',
          status: statusObj,
          __typename: 'GenAIImaginePrimitive'
        },
        __typename: 'GenAISingleLayoutViewModel'
      }
    }]
  };

  return {
    messageContextInfo: {
      botMetadata: {
        modelMetadata: {},
        progressIndicatorMetadata: {},
        imagineMetadata: {},
        memoryMetadata: {},
        richResponseSourcesMetadata: {},
        botAgeCollectionMetadata: {},
        unifiedResponseMutation: {}
      }
    },
    botForwardedMessage: {
      message: {
        richResponseMessage: {
          messageType: 'AI_RICH_RESPONSE_TYPE_STANDARD',
          unifiedResponse: {
            data: Buffer.from(JSON.stringify(unifiedObj)).toString('base64')
          },
          contextInfo: {
            forwardingScore: 999,
            isForwarded: true,
            forwardedAiBotMessageInfo: {
              botName: 'Meta AI',
              botJid: '13135550002@s.whatsapp.net',
              creatorName: 'LoveBot'
            },
            pairedMediaType: 'NOT_PAIRED_MEDIA',
            forwardOrigin: 'META_AI'
          }
        }
      }
    }
  };
}

/* Echte TABELLE als Meta-AI-Nachricht (GenATableUXPrimitive +        */
/* AI_RICH_RESPONSE_TABLE). Funktioniert auf iOS UND Android.         */
/* rows = Array von [spalte1, spalte2, ...]; erste Zeile = Kopf.      */
function buildTablePayload(rows, title) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const unifiedObj = {
    response_id: generateMessageID(),
    sections: [{
      view_model: {
        primitive: {
          rows: safeRows.map((r, index) => ({
            is_header: index === 0,
            cells: Array.isArray(r) ? r.map((cell) => String(cell == null ? '' : cell)) : [String(r)]
          })),
          _typename: 'GenATableUXPrimitive'
        },
        _typename: 'GenAISingleLayoutViewModel'
      }
    }]
  };
  const base64Data = Buffer.from(JSON.stringify(unifiedObj)).toString('base64');
  return {
    messageContextInfo: {
      botMetadata: {
        modelMetadata: {},
        progressIndicatorMetadata: {},
        imagineMetadata: {},
        memoryMetadata: {},
        richResponseSourcesMetadata: {},
        botAgeCollectionMetadata: {},
        unifiedResponseMutation: {}
      }
    },
    botForwardedMessage: {
      message: {
        richResponseMessage: {
          messageType: 'AI_RICH_RESPONSE_TYPE_STANDARD',
          submessages: [{
            messageType: 'AI_RICH_RESPONSE_TABLE',
            tableMetadata: {
              rows: safeRows.map((r, index) => ({
                items: Array.isArray(r) ? r.map((cell) => String(cell == null ? '' : cell)) : [String(r)],
                ...(index === 0 && { isHeading: true })
              })),
              title: String(title == null ? '' : title)
            }
          }],
          unifiedResponse: { data: base64Data },
          contextInfo: {
            forwardingScore: 999,
            isForwarded: true,
            forwardedAiBotMessageInfo: { botJid: '867051314767696@bot' },
            pairedMediaType: 'NOT_PAIRED_MEDIA',
            forwardOrigin: 'META_AI',
            botMessageSharingInfo: { botEntryPointOrigin: 'FAVICON', forwardScore: 743 }
          }
        }
      }
    }
  };
}

/* Baut die Meta-AI Code-Anzeige (GenAICodeUXPrimitive) — exakt die   */
/* Struktur, die auch i2/fetch nutzt und nachweislich auf iOS UND     */
/* Android rendert. Immer MIT Text-Submessage zuerst (Fallback), damit */
/* nie eine leere Blase entsteht.                                     */
function buildCodePayload(intro, codeText, language = 'text') {
  const introText = String(intro == null ? '' : intro);
  const code = String(codeText == null ? '' : codeText);
  const unifiedObj = {
    response_id: generateMessageID(),
    sections: [
      {
        view_model: {
          primitive: { text: introText, __typename: 'GenAIMarkdownTextUXPrimitive' },
          __typename: 'GenAISingleLayoutViewModel'
        }
      },
      {
        view_model: {
          primitive: {
            language: language,
            code_blocks: [{ content: code, type: 'DEFAULT' }],
            __typename: 'GenAICodeUXPrimitive'
          },
          __typename: 'GenAISingleLayoutViewModel'
        }
      }
    ]
  };
  const base64Data = Buffer.from(JSON.stringify(unifiedObj)).toString('base64');
  return {
    messageContextInfo: {
      botMetadata: {
        modelMetadata: {},
        progressIndicatorMetadata: {},
        imagineMetadata: {},
        memoryMetadata: {},
        richResponseSourcesMetadata: {},
        botAgeCollectionMetadata: {},
        unifiedResponseMutation: {}
      }
    },
    botForwardedMessage: {
      message: {
        richResponseMessage: {
          messageType: 'AI_RICH_RESPONSE_TYPE_STANDARD',
          submessages: [
            { messageType: 'AI_RICH_RESPONSE_TEXT', messageText: introText },
            {
              messageType: 'AI_RICH_RESPONSE_CODE',
              codeMetadata: {
                codeLanguage: language,
                codeBlocks: [{
                  highlightType: 'AI_RICH_RESPONSE_CODE_HIGHLIGHT_DEFAULT',
                  codeContent: code
                }]
              }
            }
          ],
          unifiedResponse: { data: base64Data },
          contextInfo: {
            forwardingScore: 999,
            isForwarded: true,
            forwardedAiBotMessageInfo: { botJid: '867051314767696@bot' },
            pairedMediaType: 'NOT_PAIRED_MEDIA',
            forwardOrigin: 'META_AI',
            botMessageSharingInfo: { botEntryPointOrigin: 'FAVICON', forwardScore: 743 }
          }
        }
      }
    }
  };
}

function buildImaginePayload(text, options = {}) {
  const imagineType = options.imagineType || 'IMAGINE';
  const status = options.status || 'GENERATING';
  const mediaUrl = typeof options.mediaUrl === 'string' ? options.mediaUrl : '';

  const unifiedDataObj = {
    response_id: generateMessageID(),
    sections: [{
      view_model: {
        primitive: {
          media: mediaUrl
            ? {
              url: mediaUrl,
              mime_type: options.mediaMime || 'image/jpeg'
            }
            : {},
          imagine_type: imagineType,
          status: {
            status: status,
            update_text: String(text === null || text === undefined ? '' : text)
          },
          __typename: 'GenAIImaginePrimitive'
        },
        __typename: 'GenAISingleLayoutViewModel'
      }
    }]
  };

  return {
    messageContextInfo: {
      botMetadata: {
        modelMetadata: {},
        progressIndicatorMetadata: {},
        imagineMetadata: {
          imagineType: imagineType
        },
        memoryMetadata: {},
        richResponseSourcesMetadata: {},
        botAgeCollectionMetadata: {},
        unifiedResponseMutation: {}
      }
    },
    botForwardedMessage: {
      message: {
        richResponseMessage: {
          messageType: 'AI_RICH_RESPONSE_TYPE_STANDARD',
          submessages: [{
            messageType: 'AI_RICH_RESPONSE_TEXT',
            messageText: String(text === null || text === undefined ? '' : text)
          }],
          unifiedResponse: {
            data: Buffer.from(JSON.stringify(unifiedDataObj)).toString('base64')
          },
          contextInfo: {
            isQuestion: true,
            forwardingScore: 999,
            isForwarded: true,
            forwardedAiBotMessageInfo: {
              botName: 'Meta AI',
              botJid: '13135550002@s.whatsapp.net',
              creatorName: 'LoveBot'
            },
            pairedMediaType: 'NOT_PAIRED_MEDIA',
            forwardOrigin: 'META_AI',
            botMessageSharingInfo: {
              botEntryPointOrigin: 'CHATLIST',
              forwardScore: 743
            }
          }
        }
      }
    }
  };
}

/* Liest den HTTP-/Server-Statuscode aus einem Boom-Fehler.           */
/* assertNodeErrorFree() in Baileys steckt den Code in err.data,      */
/* Socket-Fehler nutzen err.output.statusCode.                        */
function extractStatusCode(err) {
  if (!err || typeof err !== 'object') {
    return null;
  }
  if (typeof err.data === 'number' && Number.isFinite(err.data)) {
    return err.data;
  }
  if (err.output && typeof err.output.statusCode === 'number' && Number.isFinite(err.output.statusCode)) {
    return err.output.statusCode;
  }
  return null;
}

/* Wertet das rohe usync-IQ aus, OHNE den Baileys-Parser zu nutzen.   */
/* Der Baileys-Parser (USyncQuery.parseUSyncQueryResult) wirft bei    */
/* einem <error>-Knoten weg und verschluckt damit genau den Code, der */
/* für die Ban-Erkennung gebraucht wird.                              */
function collectUsyncSignals(rawResult) {
  const out = {
    exists: null,
    deviceCount: null,
    hasStatus: null,
    userJid: '',
    errorCodes: []
  };

  if (!rawResult || typeof rawResult !== 'object') {
    return out;
  }

  const pushCode = (value) => {
    const code = Number(value);
    if (!Number.isNaN(code) && code > 0 && !out.errorCodes.includes(code)) {
      out.errorCodes.push(code);
    }
  };

  const harvestErrors = (node) => {
    if (!node || typeof node !== 'object') {
      return;
    }
    if (node.attrs && node.attrs.code) {
      pushCode(node.attrs.code);
    }
    const errNode = getBinaryNodeChild(node, 'error');
    if (errNode && errNode.attrs && errNode.attrs.code) {
      pushCode(errNode.attrs.code);
    }
  };

  const usyncNode = getBinaryNodeChild(rawResult, 'usync');
  const listNode = getBinaryNodeChild(usyncNode, 'list');
  const userNodes = getBinaryNodeChildren(listNode, 'user');
  const userNode = Array.isArray(userNodes) && userNodes.length > 0 ? userNodes[0] : null;

  if (!userNode) {
    return out;
  }

  out.userJid = userNode.attrs && userNode.attrs.jid ? userNode.attrs.jid : '';
  harvestErrors(userNode);

  const contactNode = getBinaryNodeChild(userNode, 'contact');
  if (contactNode) {
    harvestErrors(contactNode);
    out.exists = !!(contactNode.attrs && contactNode.attrs.type === 'in');
  }

  const devicesNode = getBinaryNodeChild(userNode, 'devices');
  if (devicesNode) {
    harvestErrors(devicesNode);
    const deviceListNode = getBinaryNodeChild(devicesNode, 'device-list');
    const deviceNodes = getBinaryNodeChildren(deviceListNode, 'device');
    out.deviceCount = Array.isArray(deviceNodes) ? deviceNodes.length : 0;
  }

  const statusNode = getBinaryNodeChild(userNode, 'status');
  if (statusNode) {
    harvestErrors(statusNode);
    const statusText = statusNode.content ? String(statusNode.content) : '';
    out.hasStatus = statusText.length > 0;
  }

  return out;
}

/* Sammelt alle Signale, die für ein Ban-Urteil verfügbar sind.       */
/* onProgress(label) wird zwischen den Schritten aufgerufen.          */
async function probeBanStatus(sock, target, onProgress = null) {
  const notify = async (label) => {
    if (typeof onProgress !== 'function') {
      return;
    }
    try {
      await onProgress(label);
    } catch (progressErr) {
      console.log(c.bold + c.brightYellow + '[check2] Fortschritts-Callback fehlgeschlagen.' + c.reset);
    }
  };

  const signals = {
    usyncOk: false,
    usyncUserJid: '',
    exists: null,
    deviceCount: null,
    hasStatus: null,
    usyncErrorCodes: [],
    onWhatsAppOk: false,
    onWhatsAppExists: null,
    profilePic: null,
    profilePicCode: null,
    profilePicUrl: '',
    business: null,
    username: '',
    probeErrors: []
  };

  /* 1) Rohe usync-Abfrage: contact + devices + status */
  await notify('USYNC-ABFRAGE');
  try {
    const iq = {
      tag: 'iq',
      attrs: {
        to: S_WHATSAPP_NET,
        type: 'get',
        xmlns: 'usync'
      },
      content: [{
        tag: 'usync',
        attrs: {
          context: 'interactive',
          mode: 'query',
          sid: String(Date.now()),
          last: 'true',
          index: '0'
        },
        content: [
          {
            tag: 'query',
            attrs: {},
            content: [
              {
                tag: 'contact',
                attrs: {}
              },
              {
                tag: 'devices',
                attrs: {
                  version: '2'
                }
              },
              {
                tag: 'status',
                attrs: {}
              }
            ]
          },
          {
            tag: 'list',
            attrs: {},
            content: [{
              tag: 'user',
              attrs: {},
              content: [{
                tag: 'contact',
                attrs: {},
                content: `+${target.phone}`
              }]
            }]
          }
        ]
      }]
    };

    const raw = await sock.query(iq);
    const parsed = collectUsyncSignals(raw);
    signals.usyncOk = true;
    signals.usyncUserJid = parsed.userJid;
    signals.exists = parsed.exists;
    signals.deviceCount = parsed.deviceCount;
    signals.hasStatus = parsed.hasStatus;
    signals.usyncErrorCodes = parsed.errorCodes;
  } catch (usyncErr) {
    const code = extractStatusCode(usyncErr);
    if (code !== null && !signals.usyncErrorCodes.includes(code)) {
      signals.usyncErrorCodes.push(code);
    }
    signals.probeErrors.push(`usync: ${usyncErr && usyncErr.message ? usyncErr.message : String(usyncErr)}`);
    console.log(c.bold + c.brightYellow + '[check2] usync-Abfrage fehlgeschlagen.' + c.reset);
  }

  /* 2) Absicherung über die öffentliche onWhatsApp-API */
  await notify('REGISTERUNG PRÜFEN');
  try {
    if (typeof sock.onWhatsApp === 'function') {
      const results = await sock.onWhatsApp(target.jid);
      const info = Array.isArray(results) ? results.find((item) => item && typeof item === 'object' && !!item.exists) || results[0] : null;
      signals.onWhatsAppOk = true;
      signals.onWhatsAppExists = info ? !!info.exists : false;
    }
  } catch (onWhatsAppErr) {
    const code = extractStatusCode(onWhatsAppErr);
    if (code !== null && !signals.usyncErrorCodes.includes(code)) {
      signals.usyncErrorCodes.push(code);
    }
    signals.probeErrors.push(`onWhatsApp: ${onWhatsAppErr && onWhatsAppErr.message ? onWhatsAppErr.message : String(onWhatsAppErr)}`);
    console.log(c.bold + c.brightYellow + '[check2] onWhatsApp fehlgeschlagen.' + c.reset);
  }

  /* 3) Profilbild — der Statuscode ist das stärkste Ban-Signal */
  await notify('PROFILBILD PRÜFEN');
  try {
    if (typeof sock.profilePictureUrl === 'function') {
      const url = await sock.profilePictureUrl(target.jid, 'image');
      signals.profilePic = url ? 'ok' : 'empty';
      signals.profilePicUrl = url || '';
      signals.profilePicCode = null;
    }
  } catch (picErr) {
    signals.profilePic = 'error';
    signals.profilePicCode = extractStatusCode(picErr);
    signals.probeErrors.push(`profilePicture: ${picErr && picErr.message ? picErr.message : String(picErr)}`);
  }

  /* 4) Business-Profil als Zusatzsignal */
  await notify('BUSINESS PRÜFEN');
  try {
    if (typeof sock.getBusinessProfile === 'function') {
      const profile = await sock.getBusinessProfile(target.jid);
      signals.business = !!profile;
    }
  } catch (bizErr) {
    signals.business = null;
    signals.probeErrors.push(`businessProfile: ${bizErr && bizErr.message ? bizErr.message : String(bizErr)}`);
  }

  /* 5) WhatsApp-Username/Handle als Anzeigename (Pushname-Äquivalent) */
  await notify('NAME LESEN');
  try {
    if (waUsernameApi && typeof waUsernameApi.fetchUsername === 'function') {
      const handle = await waUsernameApi.fetchUsername(sock, target.jid);
      signals.username = handle ? String(handle) : '';
    }
  } catch (nameErr) {
    signals.username = '';
  }

  /* Letzter Schritt, bevor das Urteil gebildet wird */
  await notify('AUSWERTEN');

  return signals;
}

/* WhatsApp stellt KEIN offizielles "gebanned"-Flag zur Verfügung.    */
/* Das Urteil ist deshalb eine Auswertung mehrerer Server-Signale.    */
function evaluateBanVerdict(signals) {
  const exists = signals.exists === true || signals.onWhatsAppExists === true;
  const devices = typeof signals.deviceCount === 'number' ? signals.deviceCount : null;
  const picCode = signals.profilePicCode;
  const codes = Array.isArray(signals.usyncErrorCodes) ? signals.usyncErrorCodes : [];

  /* 401 (not authorized) ist das STÄRKSTE Ban-Signal — genau das,    */
  /* was der BanChecker als "BANNED" wertet. Ein perma-gebannter      */
  /* Account kann trotzdem exists=true / Geräte melden, antwortet     */
  /* aber mit 401. Deshalb gewinnt die 401 gegen "exists".            */
  const has401 = picCode === 401 || codes.includes(401);
  /* Schutz vor Fehlalarm: wenn BEIDE Verzeichnis-Abfragen komplett    */
  /* tot sind, ist vermutlich unsere eigene Session tot — dann kein   */
  /* Urteil, statt alles als gebannt zu markieren.                    */
  const bothDead = signals.usyncOk === false && signals.onWhatsAppOk === false;

  if (bothDead) {
    return {
      banned: null,
      verdict: 'UNBEKANNT',
      emoji: '❓',
      confidence: 'KEINE',
      detail: 'Beide Verzeichnis-Abfragen sind fehlgeschlagen — kein Urteil möglich.'
    };
  }

  if (has401) {
    return {
      banned: true,
      verdict: 'GEBANNT / GELÖSCHT',
      emoji: '🚫',
      confidence: exists || (devices !== null && devices > 0) ? 'HOCH' : 'MITTEL',
      detail: 'Der Server antwortet mit 401 (not authorized) für diese Nummer — auch bei vorhandener Verzeichnis-Kennung das eindeutige Muster für einen gebannten/blockierten Account.'
    };
  }

  if (exists) {
    return {
      banned: false,
      verdict: 'NICHT GEBANNT',
      emoji: '✅',
      confidence: devices !== null && devices > 0 ? 'HOCH' : 'MITTEL',
      detail: 'Nummer ist im WhatsApp-Verzeichnis registriert und erreichbar.'
    };
  }

  if (devices !== null && devices > 0) {
    return {
      banned: false,
      verdict: 'EINGESCHRÄNKT',
      emoji: '⚠️',
      confidence: 'MITTEL',
      detail: 'Verzeichnis meldet „nicht registriert", es hängen aber aktive Geräte dran — vermutlich temporär eingeschränkt.'
    };
  }

  if (picCode === 403) {
    return {
      banned: false,
      verdict: 'VERSTECKT / PRIVAT',
      emoji: '🔒',
      confidence: 'MITTEL',
      detail: 'Server antwortet mit 403 (Zugriff verweigert) — Account existiert, Profil ist nur privat.'
    };
  }

  return {
    banned: false,
    verdict: 'NICHT REGISTRIERT',
    emoji: '❌',
    confidence: 'MITTEL',
    detail: 'Nummer ist im WhatsApp-Verzeichnis nicht vorhanden (nie registriert oder längst gelöscht).'
  };
}

function formatBanResult(signals, verdict, displayTarget) {
  const registeredText = signals.exists === true || signals.onWhatsAppExists === true ? 'JA' : 'NEIN';
  const deviceText = typeof signals.deviceCount === 'number' ? String(signals.deviceCount) : 'N/A';
  const picText = signals.profilePic === 'ok'
    ? 'OK'
    : (signals.profilePicCode !== null ? String(signals.profilePicCode) : (signals.profilePic || 'N/A'));
  const statusText = signals.hasStatus === null ? 'N/A' : (signals.hasStatus ? 'JA' : 'NEIN');
  const businessText = signals.business == null ? 'N/A' : (signals.business ? 'JA' : 'NEIN');
  const nameText = signals.username ? signals.username : (displayTarget || 'N/A');

  return 'WHATSAPP BAN CHECK\n' +
    `${verdict.emoji} ${verdict.verdict}\n` +
    `NUMMER: ${displayTarget}\n` +
    `NAME: ${nameText}\n` +
    `REGISTRIERT: ${registeredText}\n` +
    `GERÄTE: ${deviceText}\n` +
    `PROFILBILD: ${picText}\n` +
    `STATUS-INFO: ${statusText}\n` +
    `BUSINESS: ${businessText}\n` +
    `KONFIDENZ: ${verdict.confidence}`;
}

/* Baut die Unified-Sections der Ban-Karte wie im Video:              */
/* 1) Markdown-Body (Name, Pill, Zeilen, Footer)                      */
/* 2) Grüner Header-Banner (GenAISearchResultPrimitive)               */
function buildBanCardSections(options = {}) {
  const bodyText = options.body || '';
  const title = options.title || CHECK2_LABEL;
  const subtitle = options.subtitle || CHECK2_BRAND;
  const icon = options.icon || '';

  const sections = [];

  sections.push({
    view_model: {
      primitive: {
        text: bodyText,
        inline_entities: [],
        __typename: 'GenAIMarkdownTextUXPrimitive'
      },
      __typename: 'GenAISingleLayoutViewModel'
    }
  });

  sections.push({
    view_model: {
      primitive: {
        sources: [{
          source_type: 'THIRD_PARTY',
          source_display_name: title,
          source_subtitle: subtitle,
          source_url: 'https://whatsapp.com',
          favicon: {
            url: icon,
            width: 80,
            height: 80
          }
        }],
        search_engine: 'MASE',
        __typename: 'GenAISearchResultPrimitive'
      },
      __typename: 'GenAISingleLayoutViewModel'
    }
  });

  return {
    response_id: generateMessageID(),
    sections
  };
}

/* Verpackt die Sections in den Rich-Response-Payload (iOS+Android).  */
function buildBanCardPayload(sections, fallbackText) {
  return {
    messageContextInfo: {
      botMetadata: {
        modelMetadata: {},
        progressIndicatorMetadata: {},
        imagineMetadata: {},
        memoryMetadata: {},
        richResponseSourcesMetadata: {},
        botAgeCollectionMetadata: {},
        unifiedResponseMutation: {}
      }
    },
    botForwardedMessage: {
      message: {
        richResponseMessage: {
          messageType: 'AI_RICH_RESPONSE_TYPE_STANDARD',
          submessages: [{
            messageType: 'AI_RICH_RESPONSE_TEXT',
            messageText: fallbackText
          }],
          unifiedResponse: {
            data: Buffer.from(JSON.stringify(sections)).toString('base64')
          },
          contextInfo: {
            isQuestion: true,
            forwardingScore: 999,
            isForwarded: true,
            forwardedAiBotMessageInfo: {
              botName: 'Meta AI',
              botJid: '13135550002@s.whatsapp.net',
              creatorName: 'LoveBot'
            },
            pairedMediaType: 'NOT_PAIRED_MEDIA',
            forwardOrigin: 'META_AI',
            botMessageSharingInfo: {
              botEntryPointOrigin: 'CHATLIST',
              forwardScore: 743
            }
          }
        }
      }
    }
  };
}

/* Sendet die Karte EINMAL und liefert den Key fürs In-Place-Edit.    */
async function sendBanCard(sock, jid, payloadObj) {
  const message = generateWAMessageFromContent(jid, proto.Message.fromObject(payloadObj), {});
  await sock.relayMessage(jid, message.message, {
    messageId: message.key.id
  });
  return {
    id: message.key.id,
    remoteJid: jid,
    fromMe: true
  };
}

/* Sendet ein interaktives SINGLE-SELECT-Listennamens (iOS + Android).
   Jede Zeile hat eine rowId "cmd:<befehl>", die der Client bei Auswahl
   als listResponseMessage.singleSelectReply.selectedRowId zurücksendet,
   was getInteractiveCommandSelection() bereits auswertet.            */
async function sendInteractiveMenu(sock, jid, options = {}) {
  try {
    const listMessage = {
      title: options.title || '🐣 MENÜ',
      description: options.description || '',
      buttonText: options.buttonText || '☰ BEFEHL WÄHLEN',
      listType: options.listType || 1, // SINGLE_SELECT
      footerText: options.footerText || '',
      sections: (options.sections || []).map((s) => ({
        title: s.title || '',
        rows: (s.rows || []).map((r) => ({
          rowId: String(r.rowId || '').startsWith('cmd:') ? String(r.rowId) : `cmd:${r.rowId}`,
          title: r.title || '',
          description: r.description || ''
        }))
      }))
    };
    const payload = { listMessage };
    const message = generateWAMessageFromContent(jid, proto.Message.fromObject(payload), {});
    await sock.relayMessage(jid, message.message, {
      messageId: message.key.id
    });
    return message.key;
  } catch (menuErr) {
    console.error(c.bold + c.brightRed + 'Fehler beim Senden des Interaktiven Menüs:' + c.reset, menuErr);
    return null;
  }
}

/* Sendet einen Meta-AI "GENERATING"-Payload (wie loadingaiimg /     */
/* loadingaivid) — rendert als animierte App-Karte auf iOS+Android.   */
async function sendGeneratingPayload(sock, from, opts = {}) {
  const type = (opts.type || 'IMAGINE').toUpperCase(); // IMAGINE | ANIMATE
  const label = opts.label || 'AI LOADING …';
  const media = type === 'ANIMATE' ? { url: '', mime_type: 'video/mp4' } : {};
  const unified = {
    response_id: generateMessageID(),
    sections: [{
      view_model: {
        primitive: {
          media,
          imagine_type: type,
          status: {
            status: 'GENERATING',
            update_text: label
          },
          __typename: 'GenAIImaginePrimitive'
        },
        __typename: 'GenAISingleLayoutViewModel'
      }
    }]
  };
  const data = Buffer.from(JSON.stringify(unified)).toString('base64');
  const payload = {
    messageContextInfo: {
      botMetadata: {
        modelMetadata: {},
        progressIndicatorMetadata: {},
        imagineMetadata: {},
        memoryMetadata: {},
        richResponseSourcesMetadata: {},
        botAgeCollectionMetadata: {},
        unifiedResponseMutation: {}
      }
    },
    botForwardedMessage: {
      message: {
        richResponseMessage: {
          messageType: 'AI_RICH_RESPONSE_TYPE_STANDARD',
          unifiedResponse: { data },
          contextInfo: {
            forwardingScore: 999,
            isForwarded: true,
            forwardedAiBotMessageInfo: {
              botName: 'Meta AI',
              botJid: '13135550002@s.whatsapp.net',
              creatorName: 'LoveBot'
            },
            pairedMediaType: 'NOT_PAIRED_MEDIA',
            forwardOrigin: 'META_AI'
          }
        }
      }
    }
  };
  return await sock.sendJson(from, payload, opts.sendOpts || {});
}

/* Baut die Kategorien-Zeilen für das Interaktive Menü.               */
function buildMenuSections(pref) {  const r = (cmd, title, desc) => ({ rowId: `cmd:${cmd}`, title, description: desc });
  return [
    {
      title: '🐣 🐤 START',
      rows: [
        r('menu', `${pref}menu / ${pref}help`, 'Komplettes Befehls-Informationsmenü'),
        r('menunew', `${pref}menunew`, 'Interaktives Single-Select-Menü'),
        r('me', `${pref}me`, 'Dein Profil + Profilbild'),
        r('register', `${pref}register`, 'Anmeldung Name.Alter.Status.Stadt'),
        r('owner', `${pref}owner`, 'Owner-Kontakt + Visitenkarte'),
        r('love', `${pref}love / ${pref}socials`, 'Alle Love-/Social-Links')
      ]
    },
    {
      title: '🧰 ALLGEMEIN',
      rows: [
        r('ping', `${pref}ping`, 'Latenz + Speedtest 🏓'),
        r('speed', `${pref}speed / ${pref}speedtest`, 'Großer Internet-Speedtest 🚀'),
        r('system', `${pref}system / ${pref}stats`, 'Uptime, Nutzer, Gruppen, RAM'),
        r('id', `${pref}id`, 'Chat-/Gruppen-/Deine IDs'),
        r('username', `${pref}username`, 'Sender- & Host-Username'),
        r('bio', `${pref}bio / ${pref}status`, 'Bio / Status'),
        r('devices', `${pref}devices`, 'Geräte des Kontakts'),
        r('url', `${pref}url`, 'Link-Analyse'),
        r('hash', `${pref}hash`, 'Hash berechnen'),
        r('i3', `${pref}i3`, 'Nachrichten-Debug-Tabelle'),
        r('i2', `${pref}i2 / ${pref}fetch`, 'Code einer zitierten Nachricht')
      ]
    },
    {
      title: '💍 LIEBE & HERZEN',
      rows: [
        r('marry', `${pref}marry @user`, 'Heiratsantrag stellen 💍'),
        r('divorce', `${pref}divorce / ${pref}scheidung`, 'Scheidung einreichen 💔'),
        r('ship', `${pref}ship @user @user`, 'Love-o-Meter 💘'),
        r('kiss', `${pref}kiss @user`, 'Küssen 💋'),
        r('hug', `${pref}hug @user`, 'Umarmen 🤗'),
        r('slap', `${pref}slap @user`, 'Ohrfeigen 🖐️'),
        r('compliment', `${pref}compliment @user`, 'Kompliment 🌹')
      ]
    },
    {
      title: '💤 AFK & PROFIL',
      rows: [
        r('afk', `${pref}afk <grund>`, 'AFK-Status setzen'),
        r('afk off', `${pref}afk off`, 'AFK beenden'),
        r('afklist', `${pref}afklist`, 'Alle aktuell AFK'),
        r('check', `${pref}check`, 'ID/JID/LID prüfen'),
        r('check2', `${pref}check2`, 'WhatsApp-Ban-Check'),
        r('jid', `${pref}jid @user`, 'JID auflösen 🆔'),
        r('lid', `${pref}lid @user`, 'LID auflösen 🆔'),
        r('ids', `${pref}ids @user`, 'JID + LID zusammen 🆔')
      ]
    },
    {
      title: '👥 GRUPPE & MODERATION',
      rows: [
        r('tagall', `${pref}tagall / ${pref}all`, 'Alle Mitglieder erwähnen'),
        r('hidetag', `${pref}hidetag <text>`, 'Unsichtbar alle taggen 🫥'),
        r('poll', `${pref}poll Frage|A|B`, 'WhatsApp-Umfrage 📊'),
        r('see', `${pref}see`, 'Status reposten 📲'),
        r('tagadmin', `${pref}tagadmin`, 'Admins erwähnen'),
        r('groups', `${pref}groups`, 'Gruppen-Tabelle'),
        r('groupinfo', `${pref}groupinfo`, 'Infos zu dieser Gruppe'),
        r('acheck', `${pref}acheck`, 'Rollen-Check: alle + Bot 🔍'),
        r('rules', `${pref}rules <text>`, 'Regeln anzeigen / setzen'),
        r('gi', `${pref}gi / ${pref}features`, 'Alle Features + Status 🎛️'),
        r('an', `${pref}an <feature>`, 'Feature einschalten ✅'),
        r('aus', `${pref}aus <feature>`, 'Feature ausschalten ❌'),
        r('autodl', `${pref}autodl on|off`, 'Auto-Download (YT/TikTok/IG) 📥'),
        r('setup', `${pref}setup`, 'Owner: Bot aktivieren + Beschreibung'),
        r('activate', `${pref}activate`, 'Bot aktivieren'),
        r('deactivate', `${pref}deactivate`, 'Bot deaktivieren'),
        r('kickall', `${pref}kickall`, 'Nicht-Admins entfernen (Owner)'),
        r('demoteall', `${pref}demoteall`, 'Alle Admins entadminen (Owner)'),
        r('promoteall', `${pref}promoteall`, 'Alle Mitglieder zu Admins machen (Owner)'),
        r('sss', `${pref}sss <name>`, 'Neue Community-Gruppe erstellen (Owner)'),
        r('welcome', `${pref}welcome on|off`, 'Willkommensnachricht'),
        r('goodbye', `${pref}goodbye on|off`, 'Abschiedsnachricht'),
        r('kick', `${pref}kick <on|off|@user>`, 'Kick-Nachricht / Nutzer kicken'),
        r('promote', `${pref}promote <on|off|@user>`, 'Befördern / Nachricht'),
        r('demote', `${pref}demote <on|off|@user>`, 'De-adminen / Nachricht'),
        r('warn', `${pref}warn @user <grund>`, 'Verwarnen'),
        r('unwarn', `${pref}unwarn @user`, 'Verwarnung entfernen'),
        r('warns', `${pref}warns @user`, 'Verwarnungen anzeigen'),
        r('add', `${pref}add <nummer>`, 'Nutzer hinzufügen'),
        r('link', `${pref}link`, 'Gruppen-Einladungslink'),
        r('revoke', `${pref}revoke`, 'Einladungslink zurückziehen'),
        r('setname', `${pref}setname <name>`, 'Gruppenname ändern'),
        r('setdesc', `${pref}setdesc <text>`, 'Beschreibung ändern'),
        r('mute', `${pref}mute`, 'Gruppe stummschalten'),
        r('unmute', `${pref}unmute`, 'Gruppe entsperren'),
        r('delete', `${pref}delete`, 'Zitierte Nachricht löschen')
      ]
    },
    {
      title: '🛡️ ADMIN & VERIFIKATION',
      rows: [
        r('dsgvo', `${pref}dsgvo accept/reject`, 'DSGVO-Zustimmung'),
        r('verify', `${pref}verify accept/reject`, 'Verifizierung'),
        r('ban', `${pref}ban <id|@user> <grund>`, 'Ban (Owner)'),
        r('unban', `${pref}unban <id|@user> <grund>`, 'Entbannen (Owner)'),
        r('banlist', `${pref}banlist`, 'Alle Bans (Owner)'),
        r('block', `${pref}block <nr|@user>`, 'Blockieren (Owner)'),
        r('unblock', `${pref}unblock <nr|@user>`, 'Entblockieren (Owner)'),
        r('blocklist', `${pref}blocklist`, 'Blocklist anzeigen (Owner)'),
        r('badword', `${pref}badword add|remove|list|on|off`, 'Badword-Filter (Owner) 🤬'),
        r('fp', `${pref}fp`, 'Fake Payment')
      ]
    },
    {
      title: '🎨 MEDIEN & AI',
      rows: [
        r('audio', `${pref}audio <modul>`, 'Audio-Effekte'),
        r('play', `${pref}play <link|song>`, 'Media / Song laden'),
        r('loadingaiimg', `${pref}loadingaiimg`, 'AI Image Loading'),
        r('loadingaivid', `${pref}loadingaivid`, 'AI Video Loading'),
        r('imagine', `${pref}imagine <prompt>`, 'AI Bild-Generierung (App-Look)'),
        r('animate', `${pref}animate <prompt>`, 'AI Video-Generierung (App-Look)'),
        r('typing', `${pref}typing <text>`, 'AI Lade-Animation'),
        r('addmeta', `${pref}addmeta`, 'Meta AI hinzufügen'),
        r('kickmeta', `${pref}kickmeta`, 'Meta AI entfernen')
      ]
    },
    {
      title: '🎰 SLOT & SPASS',
      rows: [
        r('slot', `${pref}slot`, 'Slot-Machine (App-Look mit Sound)'),
        r('slotmini', `${pref}slotmini`, 'Mini-Slot'),
        r('dice', `${pref}dice`, 'Würfeln'),
        r('coin', `${pref}coin`, 'Münzwurf'),
        r('random', `${pref}random <a-b>`, 'Zufallszahl'),
        r('truth', `${pref}truth`, 'Wahrheit oder…'),
        r('dare', `${pref}dare`, 'Pflicht…'),
        r('8ball', `${pref}8ball <frage>`, 'Magic 8-Ball 🎱'),
        r('rps', `${pref}rps stein|papier|schere`, 'Schere-Stein-Papier ✊✋✌️'),
        r('witz', `${pref}witz / ${pref}joke`, 'Zufälliger Witz 😂'),
        r('fakt', `${pref}fakt / ${pref}fact`, 'Zufälliger Fakt 🧠'),
        r('roast', `${pref}roast @user`, 'Roasten 🔥'),
        r('eod', `${pref}eod`, 'Entweder-oder 🤔'),
        r('nie', `${pref}nie`, 'Nie habe ich … 🙊'),
        r('quiz', `${pref}quiz`, 'Quiz-Frage 🧠'),
        r('reverse', `${pref}reverse <text>`, 'Text umkehren'),
        r('flip', `${pref}flip <text>`, 'Text auf den Kopf')
      ]
    },
    {
      title: '💰 ECONOMY',
      rows: [
        r('daily', `${pref}daily`, 'Tägliche Belohnung 🎁'),
        r('work', `${pref}work`, 'Arbeiten gehen 💼'),
        r('gamble', `${pref}gamble <einsatz|all>`, 'Kupfer wetten 🎰'),
        r('balance', `${pref}balance / ${pref}coins`, 'Wallet anzeigen 💰'),
        r('top', `${pref}top / ${pref}leaderboard`, 'Top 10 Level 🏆')
      ]
    },
    {
      title: '🌐 INTERNET & FAKTEN',
      rows: [
        r('wiki', `${pref}wiki <begriff>`, 'Wikipedia (de) 📖'),
        r('catfact', `${pref}catfact`, 'Katzen-Fakt 🐱'),
        r('dogfact', `${pref}dogfact`, 'Hunde-Fakt 🐶'),
        r('github', `${pref}github owner/repo`, 'Repo-Infos 🐙'),
        r('remind', `${pref}remind <zeit> <text>`, 'Erinnerung ⏰')
      ]
    },
    {
      title: '👑 OWNER TOOLS',
      rows: [
        r('addowner', `${pref}addowner @user <name>`, 'Zusatz-Owner eintragen 👑'),
        r('delowner', `${pref}delowner @user`, 'Zusatz-Owner entfernen'),
        r('ownerlist', `${pref}ownerlist`, 'Alle Owner anzeigen'),
        r('bc', `${pref}bc <text>`, 'Broadcast an alle Gruppen 📢'),
        r('setppbot', `${pref}setppbot`, 'Bot-Profilbild setzen 🖼️'),
        r('setbotname', `${pref}setbotname <name>`, 'Bot-Namen ändern 🏷️'),
        r('blocklist', `${pref}blocklist`, 'Blockierte Kontakte 🚫'),
        r('autodl', `${pref}autodl on|off`, 'Auto-Download steuern 📥'),
        r('kickall', `${pref}kickall`, 'Gruppe leer machen 🧹'),
        r('setup', `${pref}setup`, 'Gruppe einrichten ⚙️'),
        r('leave', `${pref}leave`, 'Gruppe verlassen 🚪')
      ]
    },
    {
      title: '🧭 ALLTAG & WEB',
      rows: [
        r('wetter', `${pref}wetter <stadt>`, 'Wetter live (Open-Meteo) 🌤️'),
        r('währung', `${pref}währung <betrag> <von> [nach]`, 'Währungen umrechnen (EZB) 💱'),
        r('übersetze', `${pref}übersetze <sprache> <text>`, 'Text übersetzen 🌍'),
        r('qr', `${pref}qr <text>`, 'QR-Code erzeugen 🔳'),
        r('kurz', `${pref}kurz <url>`, 'Link kürzen 🔗'),
        r('passwort', `${pref}passwort [länge]`, 'Sicheres Zufalls-Passwort 🔐')
      ]
    },
    {
      title: '🧰 WERKZEUGE & UTILITIES',
      rows: [
        r('date', `${pref}date / ${pref}today`, 'Datum & Uhrzeit'),
        r('calc', `${pref}calc <ausdruck>`, 'Rechner'),
        r('b64', `${pref}b64 <text>`, 'Base64 en-/dekodieren'),
        r('reverse', `${pref}reverse <text>`, 'Text umkehren'),
        r('flip', `${pref}flip <text>`, 'Text auf den Kopf stellen'),
        r('upper', `${pref}upper <text>`, 'GROSSBUCHSTABEN'),
        r('lower', `${pref}lower <text>`, 'kleinbuchstaben'),
        r('length', `${pref}length <text>`, 'Zeichen-/Wortanzahl'),
        r('invisible', `${pref}invisible`, 'Unsichtbare Zeile'),
        r('random', `${pref}random <a-b>`, 'Zufallszahl'),
        r('dice', `${pref}dice`, 'Würfeln'),
        r('coin', `${pref}coin`, 'Münzwurf'),
        r('truth', `${pref}truth`, 'Wahrheit oder…'),
        r('dare', `${pref}dare`, 'Pflicht…'),
        r('quote', `${pref}quote`, 'Zitat des Tages'),
        r('say', `${pref}say <text>`, 'Bot spricht für dich'),
        r('pfp', `${pref}pfp @user`, 'Profilbild anzeigen'),
        r('type', `${pref}type <jid>`, 'JID-Typ prüfen'),
        r('gits', `${pref}gits`, 'Nützliche GitHub-Repos'),
        r('join', `${pref}join <link>`, 'Gruppe beitreten'),
        r('leave', `${pref}leave`, 'Gruppe verlassen (Owner)')
      ]
    }
  ];
}

/* Ersetzt dieselbe Bubble per nativem MESSAGE_EDIT (Typ 14).         */
async function editBanCard(sock, jid, key, payloadObj) {
  const edited = generateWAMessageFromContent(jid, proto.Message.fromObject(payloadObj), {});
  const wrapper = generateWAMessageFromContent(jid, proto.Message.fromObject({
    protocolMessage: {
      key: key,
      type: 14,
      editedMessage: edited.message
    }
  }), {});
  await sock.relayMessage(jid, wrapper.message, {
    messageId: wrapper.key.id
  });
}

/* Läuft die konfigurierten Fortschritts-Stufen ab und ruft onStep    */
/* pro Stufe auf. Läuft parallel zum Probe, damit die Lade smooth     */
/* bis 100 % läuft, unabhängig davon wie schnell der Server antwortet. */
async function progressLoop(onStep) {
  let i = 0;
  while (i < CHECK2_PROGRESS_STEPS.length) {
    const step = CHECK2_PROGRESS_STEPS[i];
    i++;
    await delay(CHECK2_PROGRESS_STEP_MS);
    try {
      await onStep(step);
    } catch (stepErr) {
      console.log(c.bold + c.brightYellow + '[check2] Fortschritts-Stufe fehlgeschlagen.' + c.reset);
    }
  }
}

/* Markdown-Body der Karte: Ladebalken während des Checks.            */
function buildLoadingBody(pct, label) {
  const filled = Math.round(pct / 10);
  const bar = '▓'.repeat(filled) + '░'.repeat(10 - filled);
  return `*${CHECK2_LABEL}*\n\n` +
    `\`${bar}\` *${pct}%*\n` +
    `_${label}_`;
}

/* Markdown-Body der Karte: finales Ergebnis wie im Video.            */
function buildResultBody(signals, verdict, displayTarget) {
  const pill = verdict.banned === true ? '🔴 *BANNED*' : (verdict.banned === false && verdict.verdict === 'NICHT GEBANNT' ? '🟢 *AKTIV*' : '🟡 *' + verdict.verdict + '*');
  const deviceText = typeof signals.deviceCount === 'number' ? String(signals.deviceCount) : 'N/A';
  const checkedAt = new Date().toISOString();
  const registeredText = signals.exists === true || signals.onWhatsAppExists === true ? 'YES' : 'NO';
  const nameText = signals.username ? signals.username : displayTarget;
  const statusText = verdict.banned === true
    ? '🔴 BANNED'
    : (verdict.banned === false && verdict.verdict === 'NICHT GEBANNT' ? '🟢 OK' : '🟡 WARNING');
  const picText = signals.profilePic === 'ok'
    ? 'OK'
    : (signals.profilePicCode !== null ? String(signals.profilePicCode) : (signals.profilePic || 'N/A'));
  return `*${CHECK2_LABEL}*\n\n` +
    `👤 *${displayTarget}*\n` +
    `${pill}\n\n` +
    `👤 *Name*\n${nameText}\n\n` +
    `📞 *Phone*\n${displayTarget}\n\n` +
    `⛔ *Ban Status*\n${verdict.verdict}\n\n` +
    `📊 *Status*\n${statusText}\n\n` +
    `📄 *Reason*\n${verdict.detail}\n\n` +
    `✅ *Registered*\n${registeredText}\n\n` +
    `🛠 *Device*\n${deviceText}\n\n` +
    `🖼 *Profile Pic*\n${picText}\n\n` +
    `🕐 *Checked*\n${checkedAt}\n\n` +
    `_CONFIDENCE: ${verdict.confidence}_\n\n` +
    `${CHECK2_BRAND.toUpperCase()}`;
}

async function askQuestion(promptText) {
  process.stdout.write(promptText);
  const nextLine = await rlIterator.next();
  if (nextLine.done) {
    return '';
  }
  return nextLine.value ? nextLine.value.trim() : '';
}

async function startBot(options = {}) {
  const mode = options.mode || 'reconnect';
  const phoneNumber = options.phoneNumber || null;

  try {
    if (currentSocket && currentSocket.ws) {
      try {
        currentSocket.ws.close();
      } catch (closeErr) {}
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

    let waVersion = undefined;
    try {
      const fetched = await fetchLatestBaileysVersion();
      waVersion = fetched.version;
    } catch (verErr) {
      waVersion = undefined;
    }

    const dynamicBrowser = getDynamicBrowserInfo();

    const sock = makeWASocket({
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger)
      },
      version: waVersion,
      browser: dynamicBrowser,
      logger: logger,
      printQRInTerminal: false,
      generateHighQualityLinkPreview: true
    });

    currentSocket = sock;
    if (waUsernameApi && typeof waUsernameApi.bind === 'function') {
      waUsernameApi.bind(sock);
    }

    sock.sendJson = async (jid, json = {}, cfg = {}) => {
      try {
        logActivity('send-json', { to: jid, type: typeof json, keys: Object.keys(json || {}) }, { cfg });
        const rawContent = (json && json.message && typeof json.message === 'object') ? json.message : ((json && json.text && typeof json.text === 'object') ? json.text : json);
        const message = generateWAMessageFromContent(jid, proto.Message.fromObject(rawContent), cfg);
        return await sock.relayMessage(jid, message.message, {
          messageId: message.key.id
        });
      } catch (err) {
        console.log(c.bold + c.brightRed + '❌ Fehler beim Senden einer JSON-Nachricht' + c.reset);
        console.error(err);
        try {
          const errDetail = err && err.message ? err.message : String(err);
          await sock.sendMessage(jid, {
            text: `> ❌ *Fehler beim Senden einer JSON-Nachricht:*\n\`\`\`${errDetail}\`\`\``
          }, {
            quoted: cfg && cfg.quoted ? cfg.quoted : null
          });
        } catch (chatPushErr) {
          console.error(c.bold + c.brightRed + 'Konnte Fehler-Nachricht nicht in den Chat senden:' + c.reset, chatPushErr);
        }
      }
    };

    /* JEDE normale Bot-Nachricht bekommt die Newsletter-Weiterleitung */
    /* (forwardScore 999). Nur für echte Nachrichten-Typen, nicht für  */
    /* Reactions/Button-Replys.                                        */
    const originalSendMessage = sock.sendMessage.bind(sock);
    sock.sendMessage = async (jid, content, options = {}) => {
      let finalContent = content;
      if (content && typeof content === 'object' && !Array.isArray(content)) {
        const hasMsgField = ['text', 'image', 'video', 'audio', 'document', 'sticker', 'location', 'caption', 'contacts', 'contact'].some((k) => k in content);
        if (hasMsgField) {
          finalContent = withNewsletterForwarding(content);
        }
      }
      logActivity('send-message', { to: jid, contentType: typeof finalContent, hasText: !!(finalContent && typeof finalContent === 'object' && 'text' in finalContent), options }, {
        messagePreview: finalContent && typeof finalContent === 'object' && finalContent.text ? String(finalContent.text).slice(0, 180) : ''
      });
      return originalSendMessage(jid, finalContent, options);
    };

    sock.ev.on('creds.update', saveCreds);

    if (mode === 'pairing' && phoneNumber && !sock.authState.creds.registered) {
      setTimeout(async () => {
        await phonePair(sock, phoneNumber);
      }, 3000);
    }

    sock.ev.on('connection.update', async (update) => {
      try {
        const { connection, lastDisconnect, qr } = update;

        if (qr && mode === 'qr') {
          qrPair(qr);
        }

        /* 📡 SessionManager: QR benötigt */
        if (qr) {
          try { SessionManager.setStatus(SESSION_ID, 'QR_REQUIRED'); } catch (smErr) {}
        }

        if (connection === 'open') {
          consecutiveFatalErrorCount = 0;
          lastFatalErrorCode = null;

          /* 🌐 Dashboard: Mailbox + Heartbeat starten */
          startDashboardTimers(sock);
          try { startNightConsole(); } catch (consoleErr) {}

          const hostRawId = sock.user?.id || sock.authState?.creds?.me?.id || '';
          const hostRawLid = sock.user?.lid || sock.authState?.creds?.me?.lid || '';
          const jid = normalizeJid(hostRawId);
          const lid = hostRawLid ? normalizeLid(hostRawLid) : normalizeLid(hostRawId);
          const sid = parseSessionId(hostRawId) || parseSessionId(hostRawLid) || '1';

          /* 📡 SessionManager: Live-Verbindung registrieren */
          try {
            SessionManager.setLive({ id: SESSION_ID, jid, lid, name: SESSION_ID === 'main' ? 'MainBot' : SESSION_ID });
            sock.groupFetchAllParticipating().then((g) => SessionManager.setGroups(SESSION_ID, Object.keys(g || {}).length)).catch(() => {});
          } catch (smErr) {}

          const rule = '═'.repeat(50);
          const thin = '┈'.repeat(50);
          const memMb = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);
          const totalCmds = HELP_CATEGORIES.reduce((acc, cat) => acc + cat.cmds.length, 0);
          console.log('\n' + c.bold + c.brightMagenta + '  ╔' + rule + '╗' + c.reset);
          console.log(c.bold + c.brightGreen + '  ║      💜  L O V E   B O T  —  O N L I N E  💜      ║' + c.reset);
          console.log(c.bold + c.brightMagenta + '  ╚' + rule + '╝' + c.reset);
          console.log(c.dim + '  ' + thin + c.reset);
          console.log(c.brightGreen + '  ✅ WhatsApp erfolgreich verbunden' + c.reset + c.dim + ` · ${new Date().toLocaleString('de-DE')}` + c.reset);
          console.log(c.cyan + '  🤖 Präfix:      ' + c.reset + c.brightWhite + pref + c.reset);
          console.log(c.cyan + '  🆔 Host JID:    ' + c.reset + c.brightWhite + jid + c.reset);
          console.log(c.cyan + '  🔗 Host LID:    ' + c.reset + c.brightWhite + lid + c.reset);
          console.log(c.cyan + '  📟 Host SID:    ' + c.reset + c.brightWhite + sid + c.reset);
          console.log(c.cyan + '  ⚙️ Node:        ' + c.reset + c.brightWhite + `${process.version} auf ${process.platform}` + c.reset);
          console.log(c.cyan + '  🧠 RAM:         ' + c.reset + c.brightWhite + `${memMb} MB` + c.reset);
          console.log(c.cyan + '  📚 Befehle:     ' + c.reset + c.brightWhite + `${totalCmds}+ in ${HELP_CATEGORIES.length} Kategorien` + c.reset);
          console.log(c.cyan + '  📥 Auto-Link:   ' + c.reset + c.brightWhite + 'YouTube · TikTok · Instagram' + c.reset);
          console.log(c.cyan + '  💍 Marry:       ' + c.reset + c.brightWhite + 'aktiv — ' + pref + 'marry @user' + c.reset);
          console.log(c.dim + '  ' + thin + c.reset);
          console.log(c.bold + c.brightMagenta + '  🌹 LoveBot by Maxichen · maxichen.de 🌹' + c.reset + '\n');
          logLove('boot', 'LoveBot ist bereit und wartet auf Nachrichten.', c.brightGreen);

          await triggerLoveAutoConnectionActions(sock);
        }

        if (connection === 'close') {
          writeHeartbeat(sock, false);
          /* 📡 SessionManager: Verbindung verloren (Auto-Reconnect läuft weiter) */
          try { SessionManager.setStatus(SESSION_ID, 'DISCONNECTED'); } catch (smErr) {}
          const boomError = (() => {
            const err = lastDisconnect?.error;
            if (!err) {
              return null;
            }

            if (typeof Boom?.isBoom === 'function' && Boom.isBoom(err)) {
              return err;
            }

            if (err && typeof err === 'object' && (typeof err.isBoom === 'function' ? err.isBoom() : false)) {
              return err;
            }

            if (err && typeof err === 'object' && ('output' in err || 'statusCode' in err)) {
              return err;
            }

            try {
              return new Boom(err);
            } catch (boomCreateErr) {
              return err;
            }
          })();

          const statusCode = boomError?.output?.statusCode ?? boomError?.statusCode ?? lastDisconnect?.error?.output?.statusCode ?? lastDisconnect?.error?.statusCode;
          const errorMessage = boomError?.output?.payload?.message || boomError?.message || lastDisconnect?.error?.message || 'Verbindung beendet';

          if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
            console.log('\n' + c.bold + c.brightRed + '⚠️ Bot am Smartphone abgemeldet (Device Disconnected).' + c.reset);
            console.log(c.yellow + 'Lösche lokale Session restlos...' + c.reset);
            deleteOldSession(sessionPath);
            consecutiveFatalErrorCount = 0;
            lastFatalErrorCode = null;
            console.log(c.brightGreen + 'Session gelöscht. Kehre zurück ins Pairing-Menü...\n' + c.reset);
            await pairMenu({
              sessionPath,
              credsPath,
              askQuestion,
              startBot
            });
            return;
          }

          const currentErrorCode = statusCode ? String(statusCode) : String(errorMessage);
          if (currentErrorCode === lastFatalErrorCode) {
            consecutiveFatalErrorCount++;
          } else {
            lastFatalErrorCode = currentErrorCode;
            consecutiveFatalErrorCount = 1;
          }

          if (consecutiveFatalErrorCount >= 3) {
            console.log('\n' + c.bold + c.brightRed + `❌ Fataler Fehler: Exakt derselbe Fehler (${currentErrorCode}) ist 3-mal hintereinander aufgetreten.` + c.reset);
            console.log(c.brightRed + 'Neustart wird abgebrochen. Skript beendet sich jetzt.' + c.reset);
            process.exit(1);
          }

          console.log('\n' + c.brightYellow + `⚠️ Verbindung abgebrochen (Fehler: ${currentErrorCode}).` + c.reset);
          console.log(c.brightCyan + `🔄 Automatischer Neustart im Hintergrund (Versuch ${consecutiveFatalErrorCount}/3)...` + c.reset);
          setTimeout(async () => {
            await reconnectOldSession(startBot);
          }, 3000);
        }
      } catch (connErr) {
        console.log(c.bold + c.brightRed + '❌ Fehler beim Behandeln des Verbindungsstatus:' + c.reset);
        console.error(connErr);
      }
    });

    sock.ev.on('group-participants.update', async (update) => {
      try {
        if (!update || !update.id) {
          return;
        }
        const groupJid = update.id;
        const actionType = update.action;
        const authorId = update.author || sock.user?.id || '';
        const rawParticipants = Array.isArray(update.participants) ? update.participants : [];

        let groupSubject = '';
        try {
          if (typeof sock.groupMetadata === 'function') {
            const meta = await sock.groupMetadata(groupJid);
            groupSubject = meta?.subject || '';
          }
        } catch (gmErr) {}

        logActivity('group-event', {
          groupJid,
          action: actionType,
          participantCount: rawParticipants.length,
          authorId
        });

        let pIndex = 0;
        while (pIndex < rawParticipants.length) {
          const targetId = rawParticipants[pIndex];
          const normalizedTargetId = typeof targetId === 'string'
            ? targetId
            : (targetId && typeof targetId === 'object'
              ? (targetId.id || targetId.jid || targetId.phoneNumber || targetId.participant || targetId.user || targetId.lid || targetId.remoteJid || '')
              : '');

          /* Auto-Mod: Welcome / Goodbye / Kick / Promote / Demote */
          if (['add', 'remove', 'promote', 'demote'].includes(actionType)) {
            await sendGroupAutomod(sock, groupJid, {
              action: actionType,
              targetId: normalizedTargetId,
              actorId: authorId,
              groupSubject,
              sessionPath
            });
          } else {
            await announceGroupProcess(sock, groupJid, {
              action: actionLabelFallback(actionType),
              targetId: normalizedTargetId,
              actorId: authorId,
              sessionPath
            });
          }
          pIndex++;
        }
      } catch (gpErr) {
        console.error(c.bold + c.brightRed + 'Fehler bei group-participants.update:' + c.reset, gpErr);
      }
    });

    sock.ev.on('group.join-request', async (update) => {
      try {
        if (!update || !update.id || !update.participant) {
          return;
        }
        const groupJid = update.id;
        const actionType = update.action;
        const authorId = update.author || sock.user?.id || '';
        let actionLabel = 'Beitritts-Anfrage';

        if (actionType === 'approve' || actionType === 'accept') {
          actionLabel = 'Genehmigt (Beitritts-Anfrage bestätigt)';
        } else if (actionType === 'reject' || actionType === 'rejected') {
          actionLabel = 'Abgelehnt (Beitritts-Anfrage abgelehnt)';
        }

        await announceGroupProcess(sock, groupJid, {
          action: actionLabel,
          targetId: update.participant,
          actorId: authorId,
          sessionPath
        });
      } catch (jrErr) {
        console.error(c.bold + c.brightRed + 'Fehler bei group.join-request:' + c.reset, jrErr);
      }
    });

    function getInteractiveCommandSelection(msg) {
      const listRowId = msg?.message?.listResponseMessage?.singleSelectReply?.selectedRowId;
      if (listRowId) {
        return String(listRowId).replace(/^cmd:/, '').trim();
      }

      const buttonId = msg?.message?.buttonsResponseMessage?.selectedButtonId;
      if (buttonId) {
        return String(buttonId).replace(/^cmd:/, '').trim();
      }

      /* Carousel-/Button-Cards antworten als templateButtonReplyMessage */
      /* mit selectedId (siehe ALL-MESSAGE-LOG). Ohne das gehen Buttons  */
      /* im Carousel-Menü nicht.                                        */
      const templateId = msg?.message?.templateButtonReplyMessage?.selectedId;
      if (templateId) {
        return String(templateId).replace(/^cmd:/, '').trim();
      }

      return null;
    }

    async function logAllIncomingMessage(msg) {
      try {
        if (!msg || !msg.key) {
          return;
        }
        const key = msg.key;
        const content = msg.message || {};
        const isGroup = String(key.remoteJid || '').endsWith('@g.us');
        const senderJid = key.participant || key.remoteJid || '';
        const senderLid = key.participantAlt || (key.addressingMode === 'lid' ? key.remoteJid : '') || '';
        const botJid = sock.user?.id || '';
        const botUser = botJid ? botJid.split('@')[0] : '';
        const ctx = content.extendedTextMessage?.contextInfo || {};
        const mentioned = Array.isArray(ctx.mentionedJid) ? ctx.mentionedJid : [];
        const botMentioned = !!botUser && mentioned.some((m) => m && String(m).split('@')[0] === botUser);
        const isReply = !!ctx.stanzaId;
        const repliedToBot = isReply && !!botUser && ctx.participant && String(ctx.participant).split('@')[0] === botUser;
        const type = Object.keys(content).find((k) => k.endsWith('Message')) || 'unbekannt';

        let groupName = '—';
        if (isGroup && typeof sock.groupMetadata === 'function') {
          try {
            const meta = await sock.groupMetadata(key.remoteJid);
            groupName = meta?.subject || '—';
          } catch (gmErr) {
            groupName = '(unbekannt)';
          }
        }

        const rule = '═'.repeat(50);
        const JA = c.brightGreen + 'JA ✅' + c.reset;
        const NEIN = c.brightRed + 'NEIN ❌' + c.reset;
        console.log('\n' + c.bold + c.brightCyan + '╔' + rule + '╗' + c.reset);
        console.log(c.bold + c.brightMagenta + '  📨  L O V E   B O T   —   N A C H R I C H T' + c.reset);
        console.log(c.bold + c.brightCyan + '╠' + rule + '╣' + c.reset);
        console.log(c.cyan + '  🆔 Sender-JID:       ' + c.reset + c.brightWhite + (senderJid || '—') + c.reset);
        console.log(c.cyan + '  🔗 Sender-LID:       ' + c.reset + c.brightWhite + (senderLid || '—') + c.reset);
        console.log(c.cyan + '  👥 Gruppenname:      ' + c.reset + c.brightWhite + groupName + c.reset);
        console.log(c.cyan + '  📛 Gruppen-ID:       ' + c.reset + c.brightWhite + (isGroup ? key.remoteJid : '—') + c.reset);
        console.log(c.cyan + '  💬 Chat:             ' + c.reset + (isGroup ? c.brightGreen + 'Gruppe' + c.reset : c.brightYellow + 'Privatchat' + c.reset));
        console.log(c.cyan + '  📣 Bot markiert:     ' + c.reset + (botMentioned ? JA : NEIN));
        console.log(c.cyan + '  ↩️  Antwort auf Bot:  ' + c.reset + (repliedToBot ? JA : NEIN));
        console.log(c.cyan + '  📦 Typ:              ' + c.reset + c.brightWhite + type + c.reset);
        console.log(c.bold + c.brightCyan + '╠' + rule + '╣' + c.reset);
        console.log(c.bold + c.brightMagenta + '  Nachricht komplett:' + c.reset);
        const raw = JSON.stringify(content, null, 2);
        console.log(c.brightBlack + (raw.length > 20000 ? raw.slice(0, 20000) + '\n... [truncated]' : raw) + c.reset);
        console.log(c.bold + c.brightCyan + '╚' + rule + '╝\n' + c.reset);
      } catch (logErr) {
        console.error(c.bold + c.brightRed + '[LOG] Fehler beim Loggen der Nachricht:' + c.reset, logErr);
      }
    }

    /* Reaktionen: Reagiert ein AFK-User, kommt er automatisch zurück. */
    sock.ev.on('messages.update', async ({ messages }) => {
      try {
        if (!Array.isArray(messages)) return;
        for (const item of messages) {
          const update = item?.update || {};
          const reactions = update.reactions;
          if (!Array.isArray(reactions) || !reactions.length) continue;
          for (const react of reactions) {
            if (!react || react.text === undefined) continue;
            /* Reactor bestimmen */
            let reactorId = react.participant || react.key?.participant || item.key?.participant || '';
            if (!reactorId) continue;
            /* Der Bot reagiert nie auf sich selbst. */
            if (reactorId && normalizeJid(reactorId) === normalizeJid(sock?.user?.id || '')) continue;
            /* Nur die Person, die die Reaktion abgibt (nicht der Bot selbst) */
            if (item.key?.fromMe && !react.participant) continue;
            let fromJid = normalizeJid(reactorId);
            let fromLid = normalizeLid(reactorId);
            /* Wenn nur die LID bekannt ist, versuche die JID aufzulösen (und umgekehrt) */
            if (fromJid && !fromLid && typeof findLidByJid === 'function') {
              const l = await findLidByJid(fromJid, sessionPath, sock);
              if (l) fromLid = normalizeLid(l);
            } else if (fromLid && !fromJid && typeof findJidByLid === 'function') {
              const j = await findJidByLid(fromLid, sessionPath, sock);
              if (j) fromJid = normalizeJid(j);
            }
            /* Chat, in dem die Reaktion abgegeben wurde */
            const targetChat = (react.key?.remoteJid || item.key?.remoteJid || '').includes('@g.us')
              ? (react.key?.remoteJid || item.key?.remoteJid)
              : fromJid;
            const db = readDb();
            const afk = findAfkForIdentity(db, fromJid, fromLid) || (db.afk?.[identityKey(fromJid, fromLid)] || null);
            if (afk) {
              const awayFor = Date.now() - new Date(afk.since).getTime();
              clearAfk(db, afk.key || identityKey(fromJid, fromLid));
              const mention = fromLid || fromJid;
              const text =
                '> 💙 *WILLKOMMEN ZURÜCK!* 💙\n\n' +
                `@${(mention && cleanId(mention)) || 'User'} du bist nach *${formatDuration(awayFor)}* ` +
                `wegen *${afk.reason}* AFK — willkommen zurück! 🎉`;
              try {
                await sock.sendMessage(targetChat, {
                  text,
                  mentions: mention ? [mention] : []
                });
              } catch (e) {
                try {
                  await sock.sendMessage(targetChat, { text });
                } catch (e2) {}
              }
            }
          }
        }
      } catch (reactErr) {
        console.error(c.bold + c.brightRed + 'Fehler bei messages.update (Reaktion):' + c.reset, reactErr);
      }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
      try {
        if (!Array.isArray(messages)) {
          return;
        }
        /* 📡 SessionManager: Nachrichtenzähler */
        try { SessionManager.trackMessage(SESSION_ID, messages.length); } catch (smErr) {}
        let msgIndex = 0;
        while (msgIndex < messages.length) {
          const msg = messages[msgIndex];
          msgIndex++;

          /* 🤖 META AI — Antworten automatisch weiterleiten (falls per
             $metaforward on aktiviert). Läuft nebenbei, blockiert nichts. */
          await handleMetaAiForward(sock, msg);

          const interactiveCommand = getInteractiveCommandSelection(msg);
          if (interactiveCommand) {
            const selectedText = `@${pref}${interactiveCommand}`;
            const selectedCommand = interactiveCommand.startsWith(pref) ? interactiveCommand.slice(pref.length).trim() : interactiveCommand.trim();
            if (selectedCommand) {
              const directCommand = selectedCommand.toLowerCase();
              const fakeMessage = {
                key: msg.key,
                message: {
                  conversation: `${pref}${directCommand}`
                }
              };
              const directText = `${pref}${directCommand}`;
              fakeMessage.message.conversation = directText;
              Object.assign(msg, fakeMessage);
              msg.message = fakeMessage.message;
            }
          }

          if (!msg || !msg.message) {
            logAllIncomingMessage(msg);
            continue;
          }

          logAllIncomingMessage(msg);

          const from = getChatId(msg.key);
          if (!from || from === 'status@broadcast') {
            continue;
          }

          const unwrapped = normalizeMessageContent(msg.message);
          if (!unwrapped) {
            continue;
          }

          const messageText = unwrapped.conversation
            || unwrapped.extendedTextMessage?.text
            || unwrapped.imageMessage?.caption
            || unwrapped.videoMessage?.caption
            || '';

          /* Eigene Nachrichten nur als bewusste Bot-Befehle verarbeiten. */
          if (msg.key?.fromMe && !messageText.trim().startsWith(pref)) {
            continue;
          }

          /* AFK- & Ban-Lebenszyklus für JEDE Nachricht (auch ohne Befehl) */
          const lifecycleResult = await handleAfkBanLifecycle(sock, msg, {
            from,
            isGroup: from.endsWith('@g.us'),
            sessionPath,
            messageText
          });
          if (lifecycleResult === 'banned') {
            continue;
          }

          const trimmed = messageText.trim();
          if (isStringNullOrEmpty(trimmed)) {
            continue;
          }

          /* 🛡️ AUTO-MODERATION: Badword-Filter & Anti-Link.
             Nachricht löschen → Verwarnen → bei 3 Kick & Ban. */
          const automodResult = await runAutoModeration(sock, msg, from, trimmed, sessionPath);
          if (automodResult === 'handled') {
            continue;
          }

          if (!trimmed.startsWith(pref)) {
            /* 💍 Offene Heiratsanträge können per normalem "Ja"/"Nein"
               beantwortet werden — ganz ohne Befehl. */
            const marryAnswered = await handleMarryPlainTextAnswer(sock, msg, from, trimmed);
            if (marryAnswered) {
              continue;
            }

            /* 📥 AUTO-DOWNLOAD: YouTube-, TikTok- und Instagram-Links
               werden automatisch erkannt und heruntergeladen. */
            await handleAutoLinkDownload(sock, msg, from, trimmed);
            continue;
          }

          const withoutPrefix = trimmed.slice(pref.length).trim();
          if (isStringNullOrEmpty(withoutPrefix)) {
            continue;
          }

          const parts = withoutPrefix.split(/\s+/);
          const command = parts[0].toLowerCase();
          const args = parts.slice(1);

          if (!command) {
            continue;
          }

          const hostRawId = sock.user?.id || sock.authState?.creds?.me?.id || '';
          const hostRawLid = sock.user?.lid || sock.authState?.creds?.me?.lid || '';
          const hostJid = normalizeJid(hostRawId);
          const hostLid = normalizeLid(hostRawLid);
          const hostSid = parseSessionId(hostRawId) || parseSessionId(hostRawLid) || '1';

          const isGroup = from.endsWith('@g.us');
          let groupMetadata = null;
          let groupProfile = null;

          if (isGroup && sock.groupMetadata) {
            try {
              groupMetadata = await sock.groupMetadata(from);
              groupProfile = await loadGroupProfile(from, groupMetadata, sock);
            } catch (gmErr) {}
          }

          const senderInfo = await userMapping.resolveSender(msg, sock, sessionPath);
          const senderJid = senderInfo.jid || normalizeJid(msg.key.fromMe ? hostRawId : (isGroup ? msg.key.participant : from));
          const senderLid = senderInfo.lid || normalizeLid(msg.key.fromMe ? hostRawLid : (isGroup ? msg.key.participantAlt : msg.key.remoteJidAlt));
          let isHost = msg.key.fromMe ||
            areJidsSameUser(senderJid, hostJid) ||
            userMapping.isHost(msg, senderInfo, sock);

          /* 👑 $addowner — eingetragene Zusatz-Owner (JID + LID)
             bekommen überall Owner-Rechte. */
          let registeredOwnerEntry = null;
          if (!isHost) {
            registeredOwnerEntry = getRegisteredOwner(readDb(), senderJid, senderLid);
            if (registeredOwnerEntry) {
              isHost = true;
            }
          }

          const senderSid = isHost ? hostSid : parseSessionId(msg.key.participant || from);
          const senderLidUser = senderLid.split('@')[0];
          const quoted = getQuotedMessage(msg);

          logActivity('command', {
            from,
            senderJid,
            senderLid,
            command,
            args,
            isGroup,
            userRole: isHost ? 'host' : (isGroup && groupMetadata ? getParticipantRole(groupMetadata, senderJid, senderLid) : 'member')
          });

          const usernameInfo = waUsernameApi ? waUsernameApi.resolveAll(msg, sock, groupMetadata) : null;
          const senderUn = usernameInfo?.senderUsername || msg.key.participantUsername || msg.key.remoteJidUsername || '';
          const userProfile = await loadUserProfileForSender(senderInfo, senderUn);

          /* 🛠️ FIX: Rolle wird jetzt mit JID UND LID geprüft (inkl.
             JID↔LID-Mapping aus der User-DB) — Admin-Erkennung klappt
             dadurch auch in LID-Gruppen. */
          const userRole = isHost ? 'host' : (isGroup && groupMetadata ? getParticipantRole(groupMetadata, senderJid, senderLid) : 'member');

          const accessResult = checkCommandAccess(userProfile, groupProfile, userRole, isGroup, command, pref);
          if (!accessResult.allowed) {
            await sock.sendMessage(from, {
              text: accessResult.message
            }, {
              quoted: msg
            });
            await sendReaction(sock, from, reactions.access.reactions.unauthorized, msg.key);
            console.log(c.bold + c.brightYellow + `[access] Zugriff verweigert für ${senderJid} auf ${command}.` + c.reset);
            continue;
          }

          /* 📡 SessionManager: Befehlszähler */
          try { SessionManager.trackCommand(SESSION_ID, command); } catch (smErr) {}

          /* ❤️ LOVE CORE: Liebes-Aktionen zählen ($kiss, $hug, $compliment …)
             Der Couple-Key kommt aus dem loveplus-Snapshot, damit beide
             Module dieselbe Paar-Kennung benutzen. */
          if (isLoveAction(command)) {
            try {
              const loveSnap = getLoveSnapshot(userProfile, identityKey(senderJid, senderLid));
              bumpLoveAction({
                bid: userProfile?.identity?.bid || '',
                coupleKey: loveSnap?.love?.couple?.key || coupleKeyForProfile(userProfile),
                kind: command
              });
            } catch (loveCoreErr) { /* Zähler dürfen den Befehl nie blockieren */ }
          }

          /* 🛡️ ANTI-SPAM: gleitendes Fenster pro Nutzer (Owner ausgenommen).
             Verhindert Command-Flooding in offenen Gruppen. */
          if (!isHost) {
            const rl = rateLimit.check(senderJid || from);
            if (!rl.allowed) {
              const secs = Math.max(1, Math.ceil(rl.retryMs / 1000));
              try {
                await sock.sendMessage(from, {
                  text: '> ⏳ *ZU SCHNELL* 🐢\n\n' +
                    `•Bitte warte *${secs} Sekunde(n)*.\n` +
                    (rl.strikes > 1 ? `• Verstoß Nr. ${rl.strikes} — die Pause wächst mit jedem Versuch.\n` : '') +
                    '\n💡 _Der Bot schützt sich vor Command-Spam._'
                }, { quoted: msg });
                await sendReaction(sock, from, '⏳', msg.key);
              } catch (rlErr) {}
              console.log(c.bold + c.brightYellow + `[ratelimit] ${senderJid} geblockt (${rl.reason}, ${secs}s, Strike ${rl.strikes}).` + c.reset);
              continue;
            }
          }

          /* 🎛️ Gruppen-Feature-Toggles: $an / $aus */
          if (isGroup) {
            const blockedFeature = getBlockedFeatureForCommand(readDb(), cleanId(from), command);
            if (blockedFeature) {
              await sock.sendMessage(from, {
                text: `> ${blockedFeature.emoji} *FEATURE DEAKTIVIERT*\n\n` +
                  `„*${blockedFeature.label}*“ ist in dieser Gruppe ausgeschaltet.\n\n` +
                  `💡 Ein Admin kann es mit *${pref}an ${blockedFeature.key}* wieder einschalten.\n` +
                  `📊 Alle Features: *${pref}gi*`
              }, {
                quoted: msg
              });
              await sendReaction(sock, from, reactions.access.reactions.unauthorized, msg.key);
              logLove('features', `${command} blockiert — Feature „${blockedFeature.label}“ ist aus.`, c.brightYellow);
              continue;
            }
          }

          switch (command) {


case 'loadingaiimg': {
  /* IMAGINE-Typ, aber EXAKT die loadingaivid-Struktur (leeres      */
  /* imagineMetadata, kein isQuestion, kein botMessageSharingInfo,  */
  /* keine submessages) — das ist der Unterschied, der loadingaivid */
  /* auf iOS UND Android rendert.                                   */
  const txt2 = 'AI IMG PAYLOAD …';
  const unifiedDataObj = {
    response_id: generateMessageID(),
    sections: [{
      view_model: {
        primitive: {
          media: {},
          imagine_type: 'IMAGINE',
          status: {
            status: 'GENERATING',
            update_text: txt2
          },
          __typename: 'GenAIImaginePrimitive'
        },
        __typename: 'GenAISingleLayoutViewModel'
      }
    }]
  };
  const base64UnifiedData = Buffer.from(JSON.stringify(unifiedDataObj)).toString('base64');

  const payload = {
    messageContextInfo: {
      botMetadata: {
        modelMetadata: {},
        progressIndicatorMetadata: {},
        imagineMetadata: {},
        memoryMetadata: {},
        richResponseSourcesMetadata: {},
        botAgeCollectionMetadata: {},
        unifiedResponseMutation: {}
      }
    },
    botForwardedMessage: {
      message: {
        richResponseMessage: {
          messageType: 'AI_RICH_RESPONSE_TYPE_STANDARD',
          unifiedResponse: {
            data: base64UnifiedData
          },
          contextInfo: {
            forwardingScore: 999,
            isForwarded: true,
            forwardedAiBotMessageInfo: {
              botName: 'Meta AI',
              botJid: '13135550002@s.whatsapp.net',
              creatorName: 'LoveBot'
            },
            pairedMediaType: 'NOT_PAIRED_MEDIA',
            forwardOrigin: 'META_AI'
          }
        }
      }
    }
  };

  await sock.sendJson(from, payload, { quoted: msg });
  break;
}

case 'loadingaivid': {
  const unifiedObj = {
    response_id: generateMessageID(),
    sections: [{
      view_model: {
        primitive: {
          media: {
            url: '',
            mime_type: 'video/mp4'
          },
          imagine_type: 'ANIMATE',
          status: {
            status: 'GENERATING',
            estimated_completion_time: 17907430971
          },
          __typename: 'GenAIImaginePrimitive'
        },
        __typename: 'GenAISingleLayoutViewModel'
      }
    }]
  };
  const base64Data = Buffer.from(JSON.stringify(unifiedObj)).toString('base64');

  const payload = {
    messageContextInfo: {
      botMetadata: {
        modelMetadata: {},
        progressIndicatorMetadata: {},
        imagineMetadata: {},
        memoryMetadata: {},
        richResponseSourcesMetadata: {},
        botAgeCollectionMetadata: {},
        unifiedResponseMutation: {}
      }
    },
    botForwardedMessage: {
      message: {
        richResponseMessage: {
          messageType: 'AI_RICH_RESPONSE_TYPE_STANDARD',
          unifiedResponse: {
            data: base64Data
          },
          contextInfo: {
            forwardingScore: 999,
            isForwarded: true,
            forwardedAiBotMessageInfo: {
              botName: 'Meta AI',
              botJid: '13135550002@s.whatsapp.net',
              creatorName: 'LoveBot'
            },
            pairedMediaType: 'NOT_PAIRED_MEDIA',
            forwardOrigin: 'META_AI'
          }
        }
      }
    }
  };

  await sock.sendJson(from, payload, { quoted: msg });
  break;
}

            case 'me': {
              const isRegistered = userProfile?.registration?.registered === true;

              if (!isRegistered) {
                const notRegisteredText = '> *LOVE BOT — REGISTRIERUNG* ❗️\n\n' +
                  'Du bist noch nicht registriert.\n\n' +
                  '*Nutze:* $register für Hilfe\n\n' +
                  '*Beispiel:*\n' +
                  '$register Maxichen.16.Single.Recklinghausen';

                await sock.sendMessage(from, {
                  text: notRegisteredText
                }, {
                  quoted: msg
                });
                await sendReaction(sock, from, reactions.input.reactions.invalidInput, msg.key);
                console.log(c.bold + c.brightYellow + '[me] Nutzer noch nicht registriert.' + c.reset);
                break;
              }

              let groupRoleText = '';
              if (isGroup && groupMetadata) {
                const memberStatus = isMember(groupMetadata, senderJid, senderLid);
                const adminStatus = isAdmin(groupMetadata, senderJid, senderLid);
                const superAdminStatus = isSuperAdmin(groupMetadata, senderJid, senderLid);
                if (superAdminStatus) {
                  groupRoleText = '\n• *Gruppe:* Owner / Superadmin 👑';
                } else if (adminStatus) {
                  groupRoleText = '\n• *Gruppe:* Admin ⭐';
                } else if (memberStatus) {
                  groupRoleText = '\n• *Gruppe:* Mitglied (kein Admin / kein Superadmin) 👤';
                }
              }

              const dsgvoText = userProfile?.status?.dsgvo?.accepted ? 'Akzeptiert ✅' : (userProfile?.status?.dsgvo?.rejected ? 'Abgelehnt ❌' : 'Offen ☑️');
              const verifyText = userProfile?.status?.verified ? 'Verifiziert ✅' : 'Nicht verifiziert ☑️';
              const walletText = `🤎 ${userProfile?.wallet?.copper || 0} | 🩶 ${userProfile?.wallet?.silver || 0} | 💛 ${userProfile?.wallet?.gold || 0} | 🩵 ${userProfile?.wallet?.platin || 0}`;
              const progressionText = `Level ${userProfile?.progression?.level || 0} | Prestige ${userProfile?.progression?.prestige || 0} (XP: ${userProfile?.progression?.xp || 0}/${userProfile?.progression?.neededXpForLvOrPrestigeUp || 743})`;
              const displayUsername = userProfile?.identity?.username ? `@${userProfile.identity.username}` : (senderUn ? `@${senderUn}` : 'Nicht vorhanden');
              const displayJid = senderJid || `${cleanId(senderLid || senderLidUser || '')}@s.whatsapp.net` || 'N/A';
              const displayLid = senderLid || `${cleanId(senderJid || '')}@lid` || 'N/A';
              const safeSenderJid = String(displayJid || 'N/A');
              const safeSenderLid = String(displayLid || 'N/A');
              const reg = migrateRegistration(userProfile?.registration || {});
              const regName = reg.name || 'Nicht angegeben';
              /* 🔒 Alter/Stadt datenschutzfreundlich: unter 18 nie exakt,
                 Stadt in Gruppen maskiert (siehe privacy.js) */
              const regAge = ageLabel(reg, { reveal: true });
              const regStatus = reg.status || 'Nicht angegeben';
              const regCity = cityLabel(reg, { privateChat: !isGroup });
              const regDate = userProfile?.registration?.registeredAt ? new Date(userProfile.registration.registeredAt).toLocaleString('de-DE') : 'Unbekannt';

              /* 💍 Liebe-/Marry-Status (rosa Rosen-Look) */
              const meMode = String(args[0] || '').toLowerCase();
              const meSnapshot = getLoveSnapshot(userProfile, identityKey(senderJid, senderLid));
              const loveStatusLine = loveStatusText(userProfile);
              const loveHeader = userProfile?.love?.married === true ? '💍' : '🕊️';

              let responseText = '';
              if (isHost) {
                responseText =
                  `> 👑✨ *LOVE BOT — OWNER PROFIL* ✨👑\n` +
                  `🌹┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈🌹\n` +
                  `💜 *Willkommen zurück, @${senderLidUser}!*\n` +
                  `_Der Boss ist im Haus._ 🕶️\n\n` +
                  `*🪪 PERSON*\n` +
                  `• *Name:* ${regName}\n` +
                  `• *Alter:* ${regAge}\n` +
                  `• *Status:* ${regStatus}\n` +
                  `• *Stadt:* ${regCity}\n` +
                  `• *Registriert seit:* ${regDate}\n\n` +
                  `*🔐 IDENTITÄT*\n` +
                  `• *Username:* ${displayUsername}\n` +
                  `• *JID:* ${safeSenderJid}\n` +
                  `• *LID:* ${safeSenderLid}\n` +
                  `• *SID:* ${senderSid}\n` +
                  `• *BID:* ${userProfile?.identity?.bid || 'N/A'}\n\n` +
                  `*🛡️ STATUS*\n` +
                  `• *DSGVO:* ${dsgvoText}\n` +
                  `• *Verify:* ${verifyText}\n\n` +
                  `*💰 FORTSCHRITT*\n` +
                  `• *Guthaben:* ${walletText}\n` +
                  `• *Level/Prestige:* ${progressionText}\n\n` +
                  `*${loveHeader} LIEBE*\n` +
                  `• ${loveStatusLine}\n` +
                  groupRoleText + '\n\n' +
                  `🌹┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈🌹\n` +
                  `🏅 *Rolle:* Owner & Entwickler 👑\n` +
                  `💜 *LoveBot* · maxichen.de`;
              } else {
                /* 🪪 Kompakt-Profil (öffentlich — KEIN Alter, KEINE JID/LID/BID) */
                responseText = buildCompactProfileCard({
                  userProfile, snapshot: meSnapshot, roleText: groupRoleText,
                  name: regName, username: displayUsername, regDate, pref
                });
              }

              /* 📋 $me info → wirklich alles, in Bereichen */
              if (meMode === 'info' || meMode === 'alle' || meMode === 'detail') {
                responseText = buildDetailProfileCard({
                  userProfile, snapshot: meSnapshot, isHost,
                  roleText: groupRoleText, name: regName, username: displayUsername, regDate, pref,
                  privateView: !isGroup   /* 🔒 Stadt/Alter nur im Privatchat unmaskiert */
                });
              }

              let profilePicMedia = null;
              try {
                if (typeof sock.profilePictureUrl === 'function') {
                  const profileUrl = await sock.profilePictureUrl(senderJid || senderLid || from, 'image');
                  if (profileUrl) {
                    profilePicMedia = { url: profileUrl };
                  }
                }
              } catch (profilePicErr) {
                profilePicMedia = null;
              }

              if (profilePicMedia && profilePicMedia.url) {
                await sock.sendMessage(from, {
                  image: { url: profilePicMedia.url },
                  caption: responseText,
                  mimetype: 'image/jpeg'
                }, {
                  quoted: msg
                });
              } else {
                await sock.sendMessage(from, {
                  text: responseText,
                  mentions: [senderLid]
                }, {
                  quoted: msg
                });
              }

              /* 📂 Interaktive Profil-Buttons — alles bleibt im selben Chat */
              try {
                await sendInteractiveMenu(sock, from, {
                  title: '👤 PROFIL',
                  description: 'Was möchtest du sehen?',
                  buttonText: '📂 MEHR ANZEIGEN',
                  footerText: '💜 LoveBot by Maxichen',
                  sections: [{
                    title: 'Ansichten',
                    rows: [
                      { rowId: 'cmd:me info', title: '📋 Alles im Detail', description: 'Vollständiges Profil mit allen Bereichen' },
                      { rowId: 'cmd:relationship', title: '❤️ Liebe & Beziehung', description: 'Partner, Love-XP, Jahrestag' },
                      { rowId: 'cmd:balance', title: '💎 Economy & Konto', description: 'Kupfer, Silber, Gold, Platin' },
                      { rowId: 'cmd:achievements', title: '🏆 Achievements', description: 'Alle freigeschalteten Erfolge' },
                      { rowId: 'cmd:pet', title: '🐶 Haustier', description: 'Wie es deinem Liebling geht' }
                    ]
                  }]
                });
              } catch (menuErr) { /* Menü optional — Karte kommt immer an */ }

              await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              console.log(c.bold + c.brightGreen + '[me] Kompakt-Profil (+ Buttons) gesendet.' + c.reset);
              break;
            }
            case 'sys': {
              if (!isHost) {
                await sock.sendMessage(from, {
                  text: '> ❌ *Zugriff verweigert!*\nDer Befehl *sys* ist ausschließlich dem Host (Bot-Besitzer) vorbehalten.'
                }, {
                  quoted: msg
                });
                await sendReaction(sock, from, reactions.access.reactions.unauthorized, msg.key);
                console.log(c.bold + c.brightYellow + '[sys] Nicht-Host hat sys aufgerufen.' + c.reset);
                break;
              }
              const heapStats = v8.getHeapStatistics();
              const usedMem = formatMemory(heapStats.used_heap_size);
              const totalMem = formatMemory(heapStats.total_heap_size);
              const limitMem = formatMemory(heapStats.heap_size_limit);
              const responseText = `> *LOVE BOT — V8 SYSTEM SPEICHER* ⚙️\n\n` +
                `• *Tatsächlicher V8-Verbrauch:* ${usedMem}\n` +
                `• *V8 Heap Gesamt:* ${totalMem}\n` +
                `• *V8 Heap Limit:* ${limitMem}`;
              await sock.sendMessage(from, {
                text: responseText
              }, {
                quoted: msg
              });
              await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              console.log(c.bold + c.brightGreen + '[sys] Systeminfo erfolgreich gesendet.' + c.reset);
              break;
            }
            case 'i2':
            case 'fetch': {
              if (!isHost) {
                await sock.sendMessage(from, {
                  text: '> ❌ *Zugriff verweigert!*\nDer Befehl *fetch / i2* ist ausschließlich dem Host (Bot-Besitzer) in jedem Chat vorbehalten.'
                }, {
                  quoted: msg
                });
                await sendReaction(sock, from, reactions.access.reactions.unauthorized, msg.key);
                console.log(c.bold + c.brightYellow + '[i2] Nicht-Host hat i2/fetch aufgerufen.' + c.reset);
                break;
              }
              if (!quoted) {
                await sock.sendMessage(from, {
                  text: '> ❌ *Fehler: Keine Nachricht zitiert.*\nBitte zitiere die Nachricht, deren Case-Code du erhalten möchtest.'
                }, {
                  quoted: msg
                });
                await sendReaction(sock, from, reactions.input.reactions.invalidInput, msg.key);
                console.log(c.bold + c.brightYellow + '[i2-Info] Keine gültige zitierte Nachricht gefunden.' + c.reset);
                break;
              }
              const quotedMessageJSON = JSON.stringify(quoted, null, 2);
              const responseText = `case 'i2output':
sock.sendJson(from,
${quotedMessageJSON}
);
break;
`;
              if (quotedMessageJSON.length > 4000) {
                console.log(c.bold + c.brightYellow + `[i2-Warnung] Nachricht zu groß (${quotedMessageJSON.length} Zeichen). Sende Rich-Response-Fallback.` + c.reset);
                try {
                  const loveAiCodeCrackedResponseId = generateMessageID();
                  const loveAiCodeCrackedIntro = 'I2 OUTPUT\nBY LOVE BOT:';
                  const loveAiCodeCrackedSections = {
                    response_id: loveAiCodeCrackedResponseId,
                    sections: [
                      {
                        view_model: {
                          primitive: {
                            __typename: 'GenAIMarkdownTextUXPrimitive'
                          },
                          __typename: 'GenAISingleLayoutViewModel'
                        }
                      },
                      {
                        view_model: {
                          primitive: {
                            language: 'javascript',
                            code_blocks: [
                              {
                                content: 'console.log(',
                                type: 'DEFAULT'
                              },
                              {
                                content: `"${responseText}"`,
                                type: 'STR'
                              },
                              {
                                content: ')\x3b',
                                type: 'DEFAULT'
                              }
                            ],
                            __typename: 'GenAICodeUXPrimitive'
                          },
                          __typename: 'GenAISingleLayoutViewModel'
                        }
                      }
                    ]
                  };
                  const loveAiCodeCrackedData = Buffer.from(JSON.stringify(loveAiCodeCrackedSections)).toString('base64');
                  const loveAiCodeCrackedJson = {
                    messageContextInfo: {
                      botMetadata: {
                        modelMetadata: {},
                        progressIndicatorMetadata: {},
                        imagineMetadata: {},
                        memoryMetadata: {},
                        richResponseSourcesMetadata: {},
                        botAgeCollectionMetadata: {},
                        unifiedResponseMutation: {}
                      }
                    },
                    botForwardedMessage: {
                      message: {
                        richResponseMessage: {
                          messageType: 'AI_RICH_RESPONSE_TYPE_STANDARD',
                          submessages: [
                            {
                              messageType: 'AI_RICH_RESPONSE_TEXT',
                              messageText: loveAiCodeCrackedIntro
                            },
                            {
                              messageType: 'AI_RICH_RESPONSE_CODE',
                              codeMetadata: {
                                codeLanguage: 'javascript',
                                codeBlocks: [
                                  {
                                    highlightType: 'AI_RICH_RESPONSE_CODE_HIGHLIGHT_DEFAULT',
                                    codeContent: 'console.log('
                                  },
                                  {
                                    highlightType: 'AI_RICH_RESPONSE_CODE_HIGHLIGHT_STRING',
                                    codeContent: `"${responseText}"`
                                  },
                                  {
                                    highlightType: 'AI_RICH_RESPONSE_CODE_HIGHLIGHT_DEFAULT',
                                    codeContent: ')\x3b'
                                  }
                                ]
                              }
                            }
                          ],
                          unifiedResponse: {
                            data: loveAiCodeCrackedData
                          },
                          contextInfo: {
                            forwardingScore: 999,
                            isForwarded: true,
                            forwardedAiBotMessageInfo: {
                              botJid: '867051314767696@bot'
                            },
                            pairedMediaType: 'NOT_PAIRED_MEDIA',
                            forwardOrigin: 'META_AI',
                            botMessageSharingInfo: {
                              botEntryPointOrigin: 'FAVICON',
                              forwardScore: 743
                            }
                          }
                        }
                      }
                    }
                  };
                  await sock.sendJson(from, loveAiCodeCrackedJson, {
                    quoted: msg
                  });
                  console.log(c.bold + c.brightGreen + '[i2-Erfolg] Rich-Response-Fallback erfolgreich gesendet.' + c.reset);
                } catch (fallbackErr) {
                  await sock.sendMessage(from, {
                    text: responseText
                  }, {
                    quoted: msg
                  });
                  console.log(c.bold + c.brightGreen + '[i2-Erfolg] Fallback als Text gesendet.' + c.reset);
                }
              } else {
                await sock.sendMessage(from, {
                  text: responseText
                }, {
                  quoted: msg
                });
                console.log(c.bold + c.brightGreen + '[i2-Erfolg] Case-Daten erfolgreich gesendet.' + c.reset);
              }
              break;
            }
            case 'i4': {
              if (!isHost) {
                await sock.sendMessage(from, {
                  text: '> ❌ *Zugriff verweigert!*\nDer Befehl *i4* ist ausschließlich dem Host (Bot-Besitzer) in jedem Chat vorbehalten.'
                }, {
                  quoted: msg
                });
                await sendReaction(sock, from, reactions.access.reactions.unauthorized, msg.key);
                console.log(c.bold + c.brightYellow + '[i4] Nicht-Host hat i4 aufgerufen.' + c.reset);
                break;
              }
              const completeMessageJSON = JSON.stringify({
                key: msg.key || {},
                pushName: msg.pushName || '',
                messageTimestamp: msg.messageTimestamp || null,
                message: msg.message || {}
              }, null, 2);
              const completeResponseText = `case 'i4output':
sock.sendJson(from,
${completeMessageJSON}
);
break;
`;
              await sock.sendJson(from, buildCodePayload('I4 OUTPUT\nBY LOVE BOT:', completeResponseText, 'javascript'), { quoted: msg });
              await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              console.log(c.bold + c.brightGreen + '[i4] Vollständiger Nachrichten-Code inklusive Sender-ID gesendet.' + c.reset);
              break;
            }
            case 'i3': {
              /* i3 = Nachrichten-Debug der ZITIERTEN Nachricht als   */
              /* TABELLE. Darstellung in der $loadingaivid-Struktur,  */
              /* damit iOS UND Android es sehen.                      */
              if (!quoted) {
                await sock.sendMessage(from, {
                  text: '> ❌ *Fehler: Keine Nachricht zitiert.*\nBitte zitiere die Nachricht, die du debuggen möchtest.'
                }, {
                  quoted: msg
                });
                await sendReaction(sock, from, reactions.input.reactions.invalidInput, msg.key);
                console.log(c.bold + c.brightYellow + '[i3] Keine zitierte Nachricht gefunden.' + c.reset);
                break;
              }
              const cleanCell = (v) => String(v == null ? '' : v).replace(/[\t\n\r]+/g, ' ').trim();
              const truncCell = (v, n) => { const s = cleanCell(v); return s.length > n ? s.slice(0, n - 1) + '…' : (s || '—'); };
              const qType = Object.keys(quoted).find((k) => k.endsWith('Message')) || 'unbekannt';
              const qText = quoted.conversation
                || (quoted.extendedTextMessage && quoted.extendedTextMessage.text)
                || (quoted.imageMessage && quoted.imageMessage.caption)
                || (quoted.videoMessage && quoted.videoMessage.caption)
                || '';
              const qCtx = (msg.message && msg.message.extendedTextMessage && msg.message.extendedTextMessage.contextInfo) || {};
              /* Debug-Tabelle als Meta-AI Code-Anzeige (wie i2) —     */
              /* rendert zuverlässig auf iOS + Android.                */
              const debugRows = [
                ['Feld', 'Wert'],
                ['Typ', qType],
                ['Text', truncCell(qText, 60)],
                ['Absender', cleanCell(qCtx.participant || msg.key.participant || msg.key.remoteJid)],
                ['Msg-ID', cleanCell(qCtx.stanzaId || msg.key.id)],
                ['Chat', cleanCell(msg.key.remoteJid)],
                ['Pushname', truncCell(msg.pushName, 24)],
                ['Gruppe', isGroup ? 'ja' : 'nein']
              ];
              const widths = debugRows[0].map((_, ci) => Math.max(...debugRows.map((r) => String(r[ci]).length)));
              const padCell = (s, w) => String(s) + ' '.repeat(Math.max(0, w - String(s).length));
              const tableText = debugRows.map((r) => r.map((cell, ci) => padCell(cleanCell(cell), widths[ci])).join(' | ')).join('\n');
              await sock.sendJson(from, buildCodePayload('📋 NACHRICHTEN-DEBUG', tableText, 'text'), { quoted: msg });
              await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              console.log(c.bold + c.brightGreen + '[i3] Debug-Tabelle (Code-Anzeige) gesendet.' + c.reset);
              break;
            }
            case 'menunew': {
              /* Interaktives Single-Select-Menü (iOS + Android) mit    */
              /* menu.png als Anhang. Der Kategorien-Text wird als      */
              /* Bild-Caption gesendet, danach folgt das klickbare      */
              /* Listen-Menü. Beim Tippen auf einen Eintrag antwortet   */
              /* der Client mit listResponseMessage.singleSelectReply.  */
              const menuSections = buildMenuSections(pref);
              const totalCmds = menuSections.reduce((acc, s) => acc + s.rows.length, 0);
              const caption =
                '> 💜 *LOVE BOT — MENÜ* 💜\n\n' +
                `🤖 *${totalCmds}+ Befehle* in Kategorien.\n` +
                '👉 Tippe unten auf *„Befehl wählen“* oder tippe einen Eintrag an.\n\n' +
                '━━━━━━━━━━━━━━━━━━━━\n' +
                '*' + menuSections.map((s) => s.title).join('\n') + '*\n' +
                '━━━━━━━━━━━━━━━━━━━━\n' +
                '💡 *Tipp:* Du kannst jeden Befehl auch direkt tippen, z. B. *' + pref + 'help*.\n' +
                '🔗 🌐 maxichen.de · 📱 wa.me/4915155894714';

              const menuImagePath = path.resolve(process.cwd(), 'Bilder', 'Menu.png');
              if (fs.existsSync(menuImagePath)) {
                try {
                  await sock.sendMessage(from, {
                    image: fs.readFileSync(menuImagePath),
                    caption,
                    mimetype: 'image/png'
                  }, {
                    quoted: msg
                  });
                } catch (imgErr) {
                  await sock.sendMessage(from, { text: caption }, { quoted: msg });
                }
              } else {
                await sock.sendMessage(from, { text: caption }, { quoted: msg });
              }

              await sendInteractiveMenu(sock, from, {
                title: '💜 LOVE BOT — MENÜ 💜',
                description: `Wähle einen Befehl aus (${totalCmds}+ verfügbar):`,
                buttonText: '☰ BEFEHL WÄHLEN',
                footerText: '💙 LoveBot by Maxichen · maxichen.de',
                sections: menuSections
              });

              await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              console.log(c.bold + c.brightGreen + '[menunew] Interaktives Single-Select-Menü mit Bild gesendet (iOS+Android).' + c.reset);
              break;
            }
            case 'username': {
              const usernameInfo = waUsernameApi ? waUsernameApi.resolveAll(msg, sock, null) : null;
              const senderUn = usernameInfo?.senderUsername || msg.key.participantUsername || msg.key.remoteJidUsername || 'Nicht vorhanden';
              const hostUn = usernameInfo?.hostUsername || sock.user?.username || 'Nicht vorhanden';
              const responseText = `> *LOVE BOT — USERNAME INFO* 🏷️\n\n` +
                `• *Sender Username:* @${senderUn}\n` +
                `• *Host Username:* @${hostUn}\n` +
                `• *Chat-Typ:* ${isGroup ? 'Gruppe' : 'Privat'}`;
              await sock.sendMessage(from, {
                text: responseText
              }, {
                quoted: msg
              });
              console.log(c.bold + c.brightGreen + '[username] Username-Info erfolgreich gesendet.' + c.reset);
              break;
            }
            case 'all':
            case 'tagall': {
              if (!isGroup) {
                await sock.sendMessage(from, {
                  text: '> ❌ *Fehler:* Dieser Befehl funktioniert nur in Gruppen.'
                }, {
                  quoted: msg
                });
                break;
              }
              const mentionText = args.join(' ') || 'Alle aufwachen!';
              await groupMentionAll(sock, from, mentionText, {
                quoted: msg
              });
              console.log(c.bold + c.brightGreen + '[tagall] Alle Gruppenmitglieder via nonJidMentions erwähnt.' + c.reset);
              break;
            }
            case 'groups': {
              let groupData = {};

              try {
                if (typeof sock.groupFetchAllParticipating === 'function') {
                  groupData = await sock.groupFetchAllParticipating();
                }
              } catch (fetchErr) {
                console.log(c.bold + c.brightYellow + '[groups] groupFetchAllParticipating fehlgeschlagen, nutze aktuellen Chat als Fallback.' + c.reset);
              }

              if ((!groupData || !Object.keys(groupData).length) && isGroup && groupMetadata) {
                groupData = { [from]: groupMetadata };
              }

              const groups = Object.entries(groupData || {})
                .map(([jid, metadata]) => ({ jid, metadata: metadata || {} }))
                .sort((a, b) => String(a.metadata.subject || '').localeCompare(String(b.metadata.subject || ''), 'de'));

              if (!groups.length) {
                await sock.sendMessage(from, {
                  text: '> ❌ *Keine Gruppen gefunden.*\n\nDer Bot konnte keine Gruppen abrufen.'
                }, {
                  quoted: msg
                });
                break;
              }

              const cleanCell = (v) => String(v == null ? '' : v).replace(/[\t\n\r]+/g, ' ').trim() || '—';
              const groupRows = [[
                'GruppenName',
                'GruppenLink',
                'GruppenMitgliederAnzahl',
                'GruppenId'
              ]];

              for (const item of groups) {
                const jid = item.jid;
                const metadata = item.metadata;
                const groupName = metadata.subject || 'Ohne Name';
                const memberCount = Array.isArray(metadata.participants)
                  ? metadata.participants.length
                  : (metadata.size || metadata.participantCount || 0);

                let groupLink = 'Kein Link';
                try {
                  if (typeof sock.groupInviteCode === 'function') {
                    const inviteCode = await sock.groupInviteCode(jid);
                    if (inviteCode) {
                      groupLink = `https://chat.whatsapp.com/${inviteCode}`;
                    }
                  }
                } catch (inviteErr) {
                  groupLink = 'Kein Link / keine Berechtigung';
                }

                groupRows.push([
                  cleanCell(groupName),
                  cleanCell(groupLink),
                  cleanCell(memberCount),
                  cleanCell(jid)
                ]);
              }

              /* Wie bei i3: keine echte AI_RICH_RESPONSE_TABLE, weil die bei */
              /* manchen Clients leer kommt. Stattdessen sichere Code-Anzeige */
              /* mit Tabellen-Text und sichtbarer Text-Submessage.            */
              const widths = groupRows[0].map((_, ci) => Math.max(...groupRows.map((r) => String(r[ci]).length)));
              const padCell = (s, w) => String(s) + ' '.repeat(Math.max(0, w - String(s).length));
              const tableText = groupRows
                .map((r) => r.map((cell, ci) => padCell(cleanCell(cell), widths[ci])).join(' | '))
                .join('\n');

              await sock.sendJson(from, buildCodePayload(`👥 LOVE BOT GRUPPEN (${groups.length})`, tableText, 'text'), { quoted: msg });
              await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              console.log(c.bold + c.brightGreen + `[groups] ${groups.length} Gruppen als i3-Code-Tabelle gesendet.` + c.reset);
              break;
            }
            case 'bio':
            case 'status': {
              const targetJid = (quoted && (msg.message?.extendedTextMessage?.contextInfo?.participant || msg.message?.extendedTextMessage?.contextInfo?.remoteJid))
                || (args[0] && args[0].replace(/^@/, '') + '@s.whatsapp.net')
                || senderJid;
              const statusData = await fetchUserStatus(sock, targetJid);
              const statusText = statusData?.status || 'Kein Status/Bio verfügbar';
              const responseText = `> *LOVE BOT — STATUS / BIO* 📝\n\n` +
                `• *Ziel:* ${targetJid}\n` +
                `• *Bio:* ${statusText}\n` +
                `• *Gesetzt am:* ${statusData?.setAt ? new Date(statusData.setAt).toLocaleString('de-DE') : 'Unbekannt'}`;
              await sock.sendMessage(from, {
                text: responseText
              }, {
                quoted: msg
              });
              console.log(c.bold + c.brightGreen + '[bio] Status/Bio erfolgreich abgerufen.' + c.reset);
              break;
            }
            case 'devices': {
              const targetJid = (quoted && (msg.message?.extendedTextMessage?.contextInfo?.participant || msg.message?.extendedTextMessage?.contextInfo?.remoteJid))
                || (args[0] && args[0].replace(/^@/, '') + '@s.whatsapp.net')
                || senderJid;
              const devices = await fetchUserDevices(sock, targetJid);
              const deviceCount = Array.isArray(devices) ? devices.length : 0;
              const responseText = `> *LOVE BOT — VERKNÜPFTE GERÄTE* 📱\n\n` +
                `• *Ziel:* ${targetJid}\n` +
                `• *Verknüpfte Geräte:* ${deviceCount}\n` +
                `• *Details:* ${deviceCount > 0 ? devices.map((d) => d.device || d).join(', ') : 'Keine zusätzlichen Geräte'}`;
              await sock.sendMessage(from, {
                text: responseText
              }, {
                quoted: msg
              });
              console.log(c.bold + c.brightGreen + '[devices] Geräteanzahl erfolgreich abgerufen.' + c.reset);
              break;
            }
            case 'audio': {
              const effectKey = (args[0] || '').toLowerCase().trim();
              if (!effectKey) {
                await sock.sendMessage(from, { text: getAudioHelpText() }, { quoted: msg });
                await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
                break;
              }

              if (!AUDIO_EFFECTS[effectKey]) {
                await sock.sendMessage(from, {
                  text: `> ❌ *Unbekanntes Audio-Modul:* ${effectKey}\n\n${getAudioHelpText()}`
                }, { quoted: msg });
                await sendReaction(sock, from, reactions.input.reactions.invalidInput, msg.key);
                break;
              }

              try {
                await sock.sendMessage(from, {
                  text: `> 🎧 *AUDIO EFFECT*\n\nModul: *${AUDIO_EFFECTS[effectKey].label}*\nAudio wird verarbeitet...`
                }, { quoted: msg });

                const { buffer } = await downloadQuotedAudioBuffer(quoted);
                const output = await applyAudioEffect(buffer, effectKey);

                try {
                  await originalSendMessage(from, {
                    audio: output.buffer,
                    mimetype: output.mimetype,
                    fileName: output.fileName,
                    ptt: false
                  }, { quoted: msg });
                } catch (sendAudioErr) {
                  await originalSendMessage(from, {
                    document: output.buffer,
                    mimetype: output.mimetype,
                    fileName: output.fileName,
                    caption: `🎧 *${output.label}*\nAudio als Datei gesendet.`
                  }, { quoted: msg });
                }

                await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
                console.log(c.bold + c.brightGreen + `[audio] Effekt ${effectKey} erfolgreich gesendet.` + c.reset);
              } catch (audioErr) {
                await sock.sendMessage(from, {
                  text: `> ❌ *Audio Fehler:*\n${audioErr?.message || String(audioErr)}\n\n*Tipp:* Antworte auf eine Audio-/Sprachnachricht mit z.B. *$audio lauter*.`
                }, { quoted: msg });
                await sendReaction(sock, from, reactions.input.reactions.invalidInput, msg.key);
                console.log(c.bold + c.brightRed + '[audio] Fehler:' + c.reset, audioErr);
              }
              break;
            }
            case 'play': {
              const input = args.join(' ').trim();
              if (!input) {
                const supportedText = [
                  '> ▶️ *LOVE BOT — PLAY HILFE*',
                  '',
                  '*Nutzung:*',
                  '• $play <songname> — sucht über YouTube und sendet Infos, Bild, Video + Audio',
                  '• $play <link> — lädt Medien vom Link',
                  '',
                  '*🌐 Unterstützte Plattformen:*',
                  '• TikTok',
                  '• Instagram',
                  '• YouTube',
                  '• Threads',
                  '• Twitter / X',
                  '• Facebook',
                  '• Pinterest',
                  '• CapCut',
                  '• Likee',
                  '• Google Drive',
                  '• Spotify',
                  '• SoundCloud',
                  '• Terabox',
                  '',
                  '*Beispiele:*',
                  '• $play never gonna give you up',
                  '• $play https://youtu.be/dQw4w9WgXcQ',
                  '• $play https://www.tiktok.com/...'
                ].join('\n');
                await sock.sendMessage(from, { text: supportedText }, { quoted: msg });
                await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
                break;
              }

              await sock.sendMessage(from, {
                text: `> 🔎 *LOVE BOT — PLAY*\n\nSuche/Lade: *${input}*`
              }, {
                quoted: msg
              });

              try {
                const result = await resolvePlayRequest(input);
                /* 🎬 Gemeinsamer Media-Versand (wird auch vom Auto-Download genutzt) */
                const sentMedia = await sendPlayResultMedia(sock, from, msg, result, input, {
                  sendFn: (content, options) => originalSendMessage(from, content, options)
                });

                if (!sentMedia && !result.video && !result.audio && !result.thumbnail) {
                  const rawText = JSON.stringify(result.raw || {}, null, 2).slice(0, 3500);
                  await sock.sendJson(from, buildCodePayload('⚠️ PLAY — KEIN DIREKTES MEDIA GEFUNDEN', rawText || 'Keine Daten', 'json'), { quoted: msg });
                }

                await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
                console.log(c.bold + c.brightGreen + `[play] ${result.platform} erfolgreich verarbeitet.` + c.reset);
              } catch (playErr) {
                await sock.sendMessage(from, {
                  text: `> ❌ *PLAY Fehler:*\n${playErr?.message || String(playErr)}`
                }, {
                  quoted: msg
                });
                await sendReaction(sock, from, reactions.input.reactions.invalidInput, msg.key);
                console.log(c.bold + c.brightRed + '[play] Fehler:' + c.reset, playErr);
              }
              break;
            }
            case 'check': {
              let rawTarget = '';

              if (args[0]) {
                rawTarget = args[0];
              } else if (quoted && quoted.extendedTextMessage?.contextInfo?.participant) {
                rawTarget = quoted.extendedTextMessage.contextInfo.participant;
              } else if (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid && msg.message.extendedTextMessage.contextInfo.mentionedJid.length) {
                rawTarget = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
              } else {
                rawTarget = senderJid;
              }

              const cleaned = String(rawTarget || '').trim().replace(/^@/, '');
              const digitsOnly = cleaned.replace(/\D/g, '');
              const rawWithoutDomain = cleaned.includes('@') ? cleaned.split('@')[0] : digitsOnly;
              const preferredLid = rawWithoutDomain ? normalizeLid(rawWithoutDomain) : normalizeLid(senderLid);
              const fallbackJid = cleaned.includes('@') ? normalizeJid(cleaned) : (digitsOnly.length >= 8 ? `${digitsOnly}@s.whatsapp.net` : senderJid);
              const normalizedTarget = preferredLid || fallbackJid;
              const checkTargets = [...new Set([preferredLid, fallbackJid].filter(Boolean))];

              const loadingText = 'CHECKING…';
              const loadingUnifiedObj = {
                response_id: generateMessageID(),
                sections: [{
                  view_model: {
                    primitive: {
                      media: {},
                      imagine_type: 'IMAGINE',
                      status: {
                        status: 'GENERATING',
                        update_text: loadingText
                      },
                      __typename: 'GenAIImaginePrimitive'
                    },
                    __typename: 'GenAISingleLayoutViewModel'
                  }
                }]
              };
              const loadingBase64 = Buffer.from(JSON.stringify(loadingUnifiedObj)).toString('base64');

              await sock.sendJson(from, {
                messageContextInfo: {
                  botMetadata: {
                    modelMetadata: {},
                    progressIndicatorMetadata: {},
                    imagineMetadata: { imagineType: 'IMAGINE' },
                    memoryMetadata: {},
                    richResponseSourcesMetadata: {},
                    botAgeCollectionMetadata: {},
                    unifiedResponseMutation: {}
                  }
                },
                botForwardedMessage: {
                  message: {
                    richResponseMessage: {
                      messageType: 'AI_RICH_RESPONSE_TYPE_STANDARD',
                      submessages: [{
                        messageType: 'AI_RICH_RESPONSE_TEXT',
                        messageText: loadingText
                      }],
                      unifiedResponse: {
                        data: loadingBase64
                      },
                      contextInfo: {
                        isQuestion: true,
                        forwardingScore: 999,
                        isForwarded: true,
                        forwardedAiBotMessageInfo: {
                          botName: 'Meta AI',
                          botJid: '13135550002@s.whatsapp.net',
                          creatorName: 'LoveBot'
                        },
                        pairedMediaType: 'NOT_PAIRED_MEDIA',
                        forwardOrigin: 'META_AI',
                        botMessageSharingInfo: {
                          botEntryPointOrigin: 'CHATLIST',
                          forwardScore: 743
                        }
                      }
                    }
                  }
                }
              }, {
                quoted: msg
              });
              await delay(1200);

              let exists = false;
              let isBusiness = false;
              let resolvedLid = preferredLid || '';
              let resolvedJid = fallbackJid || normalizedTarget;
              let profileUrl = '';

              try {
                if (typeof sock.onWhatsApp === 'function') {
                  const results = await sock.onWhatsApp(...checkTargets);
                  const info = Array.isArray(results) ? results.find((item) => item && typeof item === 'object' && (item.lid === preferredLid || item.jid === fallbackJid || item.exists)) || results.find((item) => item && typeof item === 'object') || results[0] : null;
                  if (info) {
                    exists = !!info.exists;
                    isBusiness = !!info.isBusiness;
                    resolvedLid = info.lid || preferredLid || '';
                    resolvedJid = info.jid || fallbackJid || normalizedTarget;
                  }
                }
              } catch (checkErr) {
                console.log(c.bold + c.brightYellow + '[check] onWhatsApp fehlgeschlagen.' + c.reset);
              }

              try {
                if (typeof sock.profilePictureUrl === 'function') {
                  const picTarget = resolvedLid || resolvedJid || normalizedTarget;
                  profileUrl = await sock.profilePictureUrl(picTarget) || '';
                }
              } catch (picErr) {
                profileUrl = '';
              }

              const statusText = exists ? 'REGISTERED' : 'NOT REGISTERED';
              const businessText = exists ? (isBusiness ? 'BUSINESS' : 'PRIVATE') : 'UNKNOWN';
              const displayTarget = resolvedLid || resolvedJid || normalizedTarget;
              const resultText = `WHATSAPP CHECK\n${statusText}\n${displayTarget}\n${businessText}`;
              const finalStatus = exists ? 'READY' : 'NOT_FOUND';

              const finalUnifiedObj = {
                response_id: generateMessageID(),
                sections: [{
                  view_model: {
                    primitive: {
                      media: { url: profileUrl || '', mime_type: profileUrl ? 'image/jpeg' : 'image/png' },
                      imagine_type: 'IMAGINE',
                      status: {
                        status: finalStatus,
                        update_text: resultText
                      },
                      __typename: 'GenAIImaginePrimitive'
                    },
                    __typename: 'GenAISingleLayoutViewModel'
                  }
                }]
              };
              const finalBase64 = Buffer.from(JSON.stringify(finalUnifiedObj)).toString('base64');

              await sock.sendJson(from, {
                messageContextInfo: {
                  botMetadata: {
                    modelMetadata: {},
                    progressIndicatorMetadata: {},
                    imagineMetadata: { imagineType: 'IMAGINE' },
                    memoryMetadata: {},
                    richResponseSourcesMetadata: {},
                    botAgeCollectionMetadata: {},
                    unifiedResponseMutation: {}
                  }
                },
                botForwardedMessage: {
                  message: {
                    richResponseMessage: {
                      messageType: 'AI_RICH_RESPONSE_TYPE_STANDARD',
                      submessages: [{
                        messageType: 'AI_RICH_RESPONSE_TEXT',
                        messageText: resultText
                      }],
                      unifiedResponse: {
                        data: finalBase64
                      },
                      contextInfo: {
                        isQuestion: true,
                        forwardingScore: 999,
                        isForwarded: true,
                        forwardedAiBotMessageInfo: {
                          botName: 'Meta AI',
                          botJid: '13135550002@s.whatsapp.net',
                          creatorName: 'LoveBot'
                        },
                        pairedMediaType: 'NOT_PAIRED_MEDIA',
                        forwardOrigin: 'META_AI',
                        botMessageSharingInfo: {
                          botEntryPointOrigin: 'CHATLIST',
                          forwardScore: 743
                        }
                      }
                    }
                  }
                }
              }, {
                quoted: msg
              });
              console.log(c.bold + c.brightGreen + '[check] Loading + finaler WhatsApp-Check im Meta-AI-Format gesendet.' + c.reset);
              break;
            }
            case 'check2': {
              let rawTarget = '';

              if (args[0]) {
                rawTarget = args[0];
              } else if (quoted && quoted.extendedTextMessage?.contextInfo?.participant) {
                rawTarget = quoted.extendedTextMessage.contextInfo.participant;
              } else if (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid && msg.message.extendedTextMessage.contextInfo.mentionedJid.length) {
                rawTarget = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
              } else {
                rawTarget = senderJid;
              }

              const cleaned = String(rawTarget || '').trim().replace(/^@/, '');

              if (/@lid$/i.test(cleaned)) {
                await sock.sendMessage(from, {
                  text: `> ❌ *Ban-Check braucht eine Telefonnummer*\n\n` +
                    `Eine LID lässt sich nicht als Rufnummer prüfen.\n` +
                    `> Für IDs / LIDs: ${pref}check <id>\n` +
                    `> Für Nummern: ${pref}check2 4915123456789`
                }, {
                  quoted: msg
                });
                await sendReaction(sock, from, reactions.access.reactions.unauthorized, msg.key);
                console.log(c.bold + c.brightYellow + '[check2] LID übergeben, Ban-Check abgelehnt: ' + cleaned + c.reset);
                break;
              }

              const digitsOnly = cleaned.replace(/\D/g, '');
              const targetJid = cleaned.includes('@') ? normalizeJid(cleaned) : `${digitsOnly}@s.whatsapp.net`;

              if (!digitsOnly || digitsOnly.length < 8 || digitsOnly.length > 15) {
                await sock.sendMessage(from, {
                  text: `> ❌ *Ungültige Nummer*\n\n> *Nutzung:* ${pref}check2 <Nummer>\n> *Beispiel:* ${pref}check2 4915123456789`
                }, {
                  quoted: msg
                });
                await sendReaction(sock, from, reactions.access.reactions.unauthorized, msg.key);
                console.log(c.bold + c.brightYellow + '[check2] Ungültige Nummer übergeben: ' + cleaned + c.reset);
                break;
              }

              const displayTarget = `+${digitsOnly}`;
              const target = {
                phone: digitsOnly,
                jid: targetJid
              };

              /* Genau WIE im Video: EINE einzige Karte mit allen     */
              /* Infos. Kein separates Lade-aiimg, kein Edit, kein    */
              /* Spam — nur diese eine Message.                       */
              const signals = await probeBanStatus(sock, target, null);

              const verdict = evaluateBanVerdict(signals);
              const answerText = formatBanResult(signals, verdict, displayTarget);

              /* Als Meta-AI Code-Anzeige (wie i3) — rendert auf iOS  */
              /* UND Android und zeigt das Ban-ERGEBNIS (nicht nur    */
              /* ein Bild). Das IMAGINE-Format zeigte nur das Bild +  */
              /* war Android-only, deshalb zurück zur Code-Anzeige.   */
              await sock.sendJson(from, buildCodePayload('🫟 WHATSAPP BAN CHECK 🫟', answerText, 'text'), {
                quoted: msg
              });

              console.log(c.bold + c.brightGreen + `[check2] ${displayTarget} → ${verdict.verdict} (Konfidenz: ${verdict.confidence})` + c.reset);
              console.log(c.cyan + `[check2] Signale: exists=${signals.exists} onWhatsApp=${signals.onWhatsAppExists} devices=${signals.deviceCount} pic=${signals.profilePic}:${signals.profilePicCode} business=${signals.business} errors=${JSON.stringify(signals.usyncErrorCodes)}` + c.reset);
              if (signals.probeErrors.length) {
                console.log(c.bold + c.brightYellow + '[check2] Probe-Fehler: ' + signals.probeErrors.join(' | ') + c.reset);
              }
              break;
            }
            case 'ping': {
              /* 🏓 ECHTE Messwerte statt Timestamp-Schätzung:
                 · Bot-Ping:      WebSocket-Ping/Pong, WhatsApp-IQ-Ping,
                                  Sende-Roundtrip (Bot → WA-Server → Bot)
                 · Netzwerk-Ping: ICMP gegen 1.1.1.1 / 8.8.8.8 / WhatsApp
                 · Verbindung:    DNS · TCP · TLS · TTFB (gemessen)
                 · Edge-Infos:    echte öffentliche IP, Colo, TLS/HTTP
                 · Speed:         gemessen (Cloudflare), adaptiv
                 · System:        Uptime · RAM · CPU · Node · DB
                 Alles live gemessen — nicht messbar = „nicht messbar“.
                 → netping.js (Messung) · pingcmd.js (Report)            */
              await handlePingCommand({ sock, msg, from, args, pref });
              break;
            }
            case 'speed':
            case 'speedtest':
            case 'internetspeed': {
              /* 🚀 Eigenständiger großer Speedtest ohne Latenz-Kontext */
              await sendReaction(sock, from, '🚀', msg.key);
              await performSpeedTestWithReport(sock, from, msg, {});
              logLove('speed', 'Speedtest abgeschlossen.', c.brightGreen);
              break;
            }
            case 'url': {
              const targetText = (quoted && (quoted.conversation || quoted.extendedTextMessage?.text)) || args.join(' ');
              const foundUrl = extractUrlFromText(targetText);
              if (!foundUrl) {
                await sock.sendMessage(from, {
                  text: '> ❌ *Keine URL gefunden.*'
                }, {
                  quoted: msg
                });
                break;
              }
              let previewInfo = '';
              try {
                const info = await getUrlInfo(foundUrl);
                if (info && info.title) {
                  previewInfo = `\n• *Titel:* ${info.title}\n• *Beschreibung:* ${info.description || 'N/A'}`;
                }
              } catch (urlErr) {}
              const responseText = `> *LOVE BOT — URL INFO* 🔗\n\n` +
                `• *Link:* ${foundUrl}${previewInfo}`;
              await sock.sendMessage(from, {
                text: responseText
              }, {
                quoted: msg
              });
              console.log(c.bold + c.brightGreen + '[url] URL analysiert.' + c.reset);
              break;
            }
            case 'hash': {
              const inputStr = args.join(' ') || (quoted && (quoted.conversation || quoted.extendedTextMessage?.text)) || '';
              if (isStringNullOrEmpty(inputStr)) {
                await sock.sendMessage(from, {
                  text: '> ❌ *Nutzung:* ' + pref + 'hash <Text oder zitiere eine Nachricht>'
                }, {
                  quoted: msg
                });
                break;
              }
              const inBuf = Buffer.from(inputStr, 'utf8');
              const shaHex = sha256(inBuf).toString('hex');
              const md5Hex = Buffer.from(md5(inBuf)).toString('hex');
              const crockford = bytesToCrockford(inBuf.subarray(0, 5));
              const responseText = `> *LOVE BOT — BAILEYS CRYPTO HASH* 🔐\n\n` +
                `• *Eingabe:* ${inputStr.slice(0, 50)}${inputStr.length > 50 ? '...' : ''}\n` +
                `• *SHA-256:* ${shaHex}\n` +
                `• *MD5:* ${md5Hex}\n` +
                `• *Crockford Base32:* ${crockford}`;
              await sock.sendMessage(from, {
                text: responseText
              }, {
                quoted: msg
              });
              console.log(c.bold + c.brightGreen + '[hash] Baileys-Crypto-Hash erfolgreich berechnet.' + c.reset);
              break;
            }
            case 'dsgvo': {
              const subAction = (args[0] || '').toLowerCase();
              let targetProfile = userProfile;
              const targetRaw = (quoted && (msg.message?.extendedTextMessage?.contextInfo?.participant || msg.message?.extendedTextMessage?.contextInfo?.remoteJid))
                || (args[1] && args[1].replace(/^@/, '') + '@s.whatsapp.net');

              if (targetRaw && cleanId(targetRaw) !== cleanId(senderJid)) {
                if (userRole !== 'host' && userRole !== 'superadmin' && userRole !== 'admin') {
                  await sock.sendMessage(from, {
                    text: '> ⛔ *Zugriff verweigert:* Nur Admins, der SuperAdmin oder der Host dürfen die DSGVO anderer Nutzer verwalten.'
                  }, {
                    quoted: msg
                  });
                  await sendReaction(sock, from, reactions.access.reactions.unauthorized, msg.key);
                  break;
                }
                const cleanTarget = cleanId(targetRaw);
                targetProfile = await loadUserProfileForSender({ jid: cleanTarget + '@s.whatsapp.net' });
              }

              const result = await handleDsgvoCommand(targetProfile, subAction, pref);
              await sock.sendMessage(from, {
                text: result.text
              }, {
                quoted: msg
              });
              if (subAction === 'accept') {
                await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              } else if (subAction === 'reject') {
                await sendReaction(sock, from, reactions.errors.reactions.error, msg.key);
              }
              console.log(c.bold + c.brightGreen + '[dsgvo] DSGVO-Befehl verarbeitet (' + (subAction || 'info') + ').' + c.reset);
              break;
            }
            case 'dsgvo✅': {
              const result = await handleDsgvoCommand(userProfile, 'accept', pref);
              await sock.sendMessage(from, {
                text: result.text
              }, {
                quoted: msg
              });
              await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              console.log(c.bold + c.brightGreen + '[dsgvo✅] DSGVO akzeptiert.' + c.reset);
              break;
            }
            case 'dsgvo❌': {
              const result = await handleDsgvoCommand(userProfile, 'reject', pref);
              await sock.sendMessage(from, {
                text: result.text
              }, {
                quoted: msg
              });
              await sendReaction(sock, from, reactions.errors.reactions.error, msg.key);
              console.log(c.bold + c.brightYellow + '[dsgvo❌] DSGVO abgelehnt.' + c.reset);
              break;
            }
            case 'verify': {
              const subAction = (args[0] || '').toLowerCase();
              let targetProfile = userProfile;
              const targetRaw = (quoted && (msg.message?.extendedTextMessage?.contextInfo?.participant || msg.message?.extendedTextMessage?.contextInfo?.remoteJid))
                || (args[1] && args[1].replace(/^@/, '') + '@s.whatsapp.net');

              if (targetRaw && cleanId(targetRaw) !== cleanId(senderJid)) {
                if (userRole !== 'host' && userRole !== 'superadmin' && userRole !== 'admin') {
                  await sock.sendMessage(from, {
                    text: '> ⛔ *Zugriff verweigert:* Nur Admins, der SuperAdmin oder der Host dürfen andere Nutzer verifizieren.'
                  }, {
                    quoted: msg
                  });
                  await sendReaction(sock, from, reactions.access.reactions.unauthorized, msg.key);
                  break;
                }
                const cleanTarget = cleanId(targetRaw);
                targetProfile = await loadUserProfileForSender({ jid: cleanTarget + '@s.whatsapp.net' });
              }

              const result = await handleVerifyCommand(targetProfile, subAction, pref);
              await sock.sendMessage(from, {
                text: result.text
              }, {
                quoted: msg
              });
              if (subAction === 'accept') {
                await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              } else if (subAction === 'reject') {
                await sendReaction(sock, from, reactions.access.reactions.unauthorized, msg.key);
              }
              console.log(c.bold + c.brightGreen + '[verify] Verify-Befehl verarbeitet (' + (subAction || 'info') + ').' + c.reset);
              break;
            }
            case 'verify✅': {
              const result = await handleVerifyCommand(userProfile, 'accept', pref);
              await sock.sendMessage(from, {
                text: result.text
              }, {
                quoted: msg
              });
              await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              console.log(c.bold + c.brightGreen + '[verify✅] Verifizierung akzeptiert.' + c.reset);
              break;
            }
            case 'verify❌': {
              const result = await handleVerifyCommand(userProfile, 'reject', pref);
              await sock.sendMessage(from, {
                text: result.text
              }, {
                quoted: msg
              });
              await sendReaction(sock, from, reactions.access.reactions.unauthorized, msg.key);
              console.log(c.bold + c.brightYellow + '[verify❌] Verifizierung widerrufen.' + c.reset);
              break;
            }
            case 'kickall': {
              const kickAllGroupName = '**𝒐𝒖𝒕 𝒃𝒚 𓆩♡𓆪 𝟗𝟏𝟎𝓶𝓪𝔁𝓲 𓆩♡𓆪 & 𓆩♡𓆪 𝟗𝟏𝟎𝓵𝓲𝓵𝓵𝔂 𓆩♡𓆪**';
              const kickAllGroupDescription = '**𝒉𝒂𝒊𝒍 𓆩♡𓆪 𝟗𝟏𝟎𝓶𝓪𝔁𝓲 𓆩♡𓆪 & 𓆩♡𓆪 𝟗𝟏𝓵𝓲𝓵𝓵𝔂 𓆩♡𓆪**';

              if (!isGroup) {
                await sock.sendMessage(from, {
                  text: '> ❌ *Fehler:* Dieser Befehl funktioniert nur in Gruppen.'
                }, { quoted: msg });
                break;
              }

              const ownerCleanJid = cleanId(OWNER_CONFIG.jid);
              const ownerCleanLid = cleanId(OWNER_CONFIG.lid);
              const senderCleanJid = cleanId(senderJid || '');
              const senderCleanLid = cleanId(senderLid || '');
              const isBotOwner = isHost
                || areJidsSameUser(senderJid, OWNER_CONFIG.jid)
                || areJidsSameUser(senderLid, OWNER_CONFIG.lid)
                || senderCleanJid === ownerCleanJid
                || senderCleanLid === ownerCleanLid
                || userProfile?.identity?.bid === OWNER_CONFIG.bid;

              if (!isBotOwner) {
                await sock.sendMessage(from, {
                  text: '> ⛔ *Keine Berechtigung.*\nNur der Owner darf *$kickall* ausführen.'
                }, { quoted: msg });
                await sendReaction(sock, from, reactions.access.reactions.unauthorized, msg.key);
                break;
              }

              let freshMetadata = null;
              try {
                freshMetadata = await sock.groupMetadata(from);
              } catch (metaErr) {
                freshMetadata = groupMetadata;
              }

              const participants = Array.isArray(freshMetadata?.participants) ? freshMetadata.participants : [];
              if (!participants.length) {
                await sock.sendMessage(from, {
                  text: '> ❌ *Fehler:* Konnte keine Gruppenmitglieder laden.'
                }, { quoted: msg });
                await sendReaction(sock, from, reactions.input.reactions.invalidInput, msg.key);
                break;
              }

              const hostCleanJid = cleanId(hostJid || '');
              const hostCleanLid = cleanId(hostLid || '');
              const botRawIds = [hostJid, hostLid, sock.user?.id, sock.user?.lid, sock.authState?.creds?.me?.id, sock.authState?.creds?.me?.lid].filter(Boolean);
              const botCleanIds = new Set(botRawIds.map((id) => cleanId(id)).filter(Boolean));
              if (hostCleanJid) botCleanIds.add(hostCleanJid);
              if (hostCleanLid) botCleanIds.add(hostCleanLid);

              const participantIds = (p) => [p?.id, p?.jid, p?.lid].filter(Boolean);
              const participantCleanIds = (p) => participantIds(p).map((id) => cleanId(id)).filter(Boolean);
              const participantMatches = (p, rawIds = [], cleanIds = new Set()) => {
                const ids = participantIds(p);
                const cleans = participantCleanIds(p);
                return ids.some((id) => rawIds.some((raw) => raw && areJidsSameUser(id, raw)))
                  || cleans.some((id) => cleanIds.has(id));
              };

              const botParticipant = participants.find((p) => participantMatches(p, botRawIds, botCleanIds));
              const botIsAdmin = botParticipant?.admin === 'admin' || botParticipant?.admin === 'superadmin';

              if (!botIsAdmin) {
                await sock.sendMessage(from, {
                  text: '> ❌ *Fehler:* Der Bot muss Gruppen-Admin sein, damit er Name/Beschreibung ändern und Mitglieder entfernen kann.'
                }, { quoted: msg });
                await sendReaction(sock, from, reactions.input.reactions.invalidInput, msg.key);
                break;
              }

              await sock.sendMessage(from, {
                text: '> ⚠️ *KICKALL STARTET*\n\nIch setze Gruppenname/Beschreibung und entferne danach nur normale Mitglieder. Owner, Admins und Bot werden bei jedem Mitglied übersprungen.'
              }, { quoted: msg });

              const actionLogs = [];
              try {
                await sock.groupUpdateSubject(from, kickAllGroupName);
                actionLogs.push('Gruppenname geändert ✅');
              } catch (subjectErr) {
                actionLogs.push('Gruppenname ändern fehlgeschlagen ❌');
                console.log(c.bold + c.brightYellow + '[kickall] Gruppenname ändern fehlgeschlagen:' + c.reset, subjectErr?.message || subjectErr);
              }

              try {
                await sock.groupUpdateDescription(from, kickAllGroupDescription);
                actionLogs.push('Beschreibung geändert ✅');
              } catch (descErr) {
                actionLogs.push('Beschreibung ändern fehlgeschlagen ❌');
                console.log(c.bold + c.brightYellow + '[kickall] Beschreibung ändern fehlgeschlagen:' + c.reset, descErr?.message || descErr);
              }

              const ownerRawIds = [OWNER_CONFIG.jid, OWNER_CONFIG.lid, freshMetadata?.owner, freshMetadata?.subjectOwner].filter(Boolean);
              const ownerCleanIds = new Set([ownerCleanJid, ownerCleanLid, ...ownerRawIds.map((id) => cleanId(id))].filter(Boolean));

              let removedCount = 0;
              let skippedOwnerCount = 0;
              let skippedAdminCount = 0;
              let skippedBotCount = 0;
              let failedCount = 0;

              for (const participant of participants) {
                const removableJid = participant?.id || participant?.jid;
                if (!removableJid) continue;

                const isParticipantOwner = participantMatches(participant, ownerRawIds, ownerCleanIds) || participant.admin === 'superadmin';
                const isParticipantAdmin = participant.admin === 'admin' || participant.admin === 'superadmin';
                const isParticipantBot = participantMatches(participant, botRawIds, botCleanIds);

                if (isParticipantBot) {
                  skippedBotCount++;
                  continue;
                }
                if (isParticipantOwner) {
                  skippedOwnerCount++;
                  continue;
                }
                if (isParticipantAdmin) {
                  skippedAdminCount++;
                  continue;
                }

                try {
                  await sock.groupParticipantsUpdate(from, [removableJid], 'remove');
                  removedCount++;
                  await delay(700);
                } catch (kickErr) {
                  failedCount++;
                  console.log(c.bold + c.brightYellow + `[kickall] Entfernen fehlgeschlagen für ${removableJid}:` + c.reset, kickErr?.message || kickErr);
                }
              }

              const skippedTotal = skippedOwnerCount + skippedAdminCount + skippedBotCount;
              const doneText = [
                '> ✅ *KICKALL ABGESCHLOSSEN*',
                '',
                `• ${actionLogs.join('\n• ')}`,
                `• Entfernt: ${removedCount}`,
                `• Übersprungen gesamt: ${skippedTotal}`,
                `  - Owner/Superadmin: ${skippedOwnerCount}`,
                `  - Admins: ${skippedAdminCount}`,
                `  - Bot: ${skippedBotCount}`,
                `• Fehlgeschlagen: ${failedCount}`,
                '',
                `*Gruppenname:* ${kickAllGroupName}`,
                `*Beschreibung:* ${kickAllGroupDescription}`
              ].join('\n');

              await sock.sendMessage(from, { text: doneText }, { quoted: msg });
              await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              console.log(c.bold + c.brightGreen + `[kickall] Entfernt: ${removedCount}, übersprungen: ${skippedTotal}, fehlgeschlagen: ${failedCount}.` + c.reset);
              break;
            }
            case 'demoteall': {
              if (!isGroup) {
                await sock.sendMessage(from, {
                  text: '> ❌ *Fehler:* Dieser Befehl funktioniert nur in Gruppen.'
                }, { quoted: msg });
                break;
              }

              const ownerCleanJid = cleanId(OWNER_CONFIG.jid);
              const ownerCleanLid = cleanId(OWNER_CONFIG.lid);
              const senderCleanJid = cleanId(senderJid || '');
              const senderCleanLid = cleanId(senderLid || '');
              const isBotOwner = isHost
                || areJidsSameUser(senderJid, OWNER_CONFIG.jid)
                || areJidsSameUser(senderLid, OWNER_CONFIG.lid)
                || senderCleanJid === ownerCleanJid
                || senderCleanLid === ownerCleanLid
                || userProfile?.identity?.bid === OWNER_CONFIG.bid;

              if (!isBotOwner) {
                await sock.sendMessage(from, {
                  text: '> ⛔ *Keine Berechtigung.*\nNur der Owner darf *$demoteall* ausführen.'
                }, { quoted: msg });
                await sendReaction(sock, from, reactions.access.reactions.unauthorized, msg.key);
                break;
              }

              let freshMetadata = null;
              try {
                freshMetadata = await sock.groupMetadata(from);
              } catch (metaErr) {
                freshMetadata = groupMetadata;
              }

              const participants = Array.isArray(freshMetadata?.participants) ? freshMetadata.participants : [];
              if (!participants.length) {
                await sock.sendMessage(from, {
                  text: '> ❌ *Fehler:* Konnte keine Gruppenmitglieder laden.'
                }, { quoted: msg });
                await sendReaction(sock, from, reactions.input.reactions.invalidInput, msg.key);
                break;
              }

              const hostCleanJid = cleanId(hostJid || '');
              const hostCleanLid = cleanId(hostLid || '');
              const botRawIds = [hostJid, hostLid, sock.user?.id, sock.user?.lid, sock.authState?.creds?.me?.id, sock.authState?.creds?.me?.lid].filter(Boolean);
              const botCleanIds = new Set(botRawIds.map((id) => cleanId(id)).filter(Boolean));
              if (hostCleanJid) botCleanIds.add(hostCleanJid);
              if (hostCleanLid) botCleanIds.add(hostCleanLid);

              const participantIds = (p) => [p?.id, p?.jid, p?.lid].filter(Boolean);
              const participantCleanIds = (p) => participantIds(p).map((id) => cleanId(id)).filter(Boolean);
              const participantMatches = (p, rawIds = [], cleanIds = new Set()) => {
                const ids = participantIds(p);
                const cleans = participantCleanIds(p);
                return ids.some((id) => rawIds.some((raw) => raw && areJidsSameUser(id, raw)))
                  || cleans.some((id) => cleanIds.has(id));
              };

              const ownerRawIds = [OWNER_CONFIG.jid, OWNER_CONFIG.lid, freshMetadata?.owner, freshMetadata?.subjectOwner].filter(Boolean);
              const ownerCleanIds = new Set([ownerCleanJid, ownerCleanLid, ...ownerRawIds.map((id) => cleanId(id))].filter(Boolean));

              let demotedCount = 0;
              let skippedOwnerCount = 0;
              let skippedBotCount = 0;
              let failedCount = 0;

              await sock.sendMessage(from, {
                text: '> ⚠️ *DEMOTEALL STARTET*\n\nIch entferne Adminrechte von allen normalen Admins. Owner und Bot bleiben geschützt.'
              }, { quoted: msg });

              for (const participant of participants) {
                const targetJid = participant?.id || participant?.jid;
                if (!targetJid) continue;

                const isParticipantOwner = participantMatches(participant, ownerRawIds, ownerCleanIds) || participant.admin === 'superadmin';
                const isParticipantBot = participantMatches(participant, botRawIds, botCleanIds);
                const isParticipantAdmin = participant.admin === 'admin' || participant.admin === 'superadmin';

                if (isParticipantOwner) {
                  skippedOwnerCount++;
                  continue;
                }
                if (isParticipantBot) {
                  skippedBotCount++;
                  continue;
                }
                if (!isParticipantAdmin) {
                  continue;
                }

                try {
                  await sock.groupParticipantsUpdate(from, [targetJid], 'demote');
                  demotedCount++;
                  await delay(600);
                } catch (demoteErr) {
                  failedCount++;
                  console.log(c.bold + c.brightYellow + `[demoteall] Demote fehlgeschlagen für ${targetJid}:` + c.reset, demoteErr?.message || demoteErr);
                }
              }

              const doneText = [
                '> ✅ *DEMOTEALL ABGESCHLOSSEN*',
                '',
                `• Demote: ${demotedCount}`,
                `• Übersprungen: ${skippedOwnerCount + skippedBotCount}`,
                `  - Owner: ${skippedOwnerCount}`,
                `  - Bot: ${skippedBotCount}`,
                `• Fehlgeschlagen: ${failedCount}`
              ].join('\n');

              await sock.sendMessage(from, { text: doneText }, { quoted: msg });
              await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              console.log(c.bold + c.brightGreen + `[demoteall] Adminrechte entfernt: ${demotedCount}, übersprungen: ${skippedOwnerCount + skippedBotCount}, fehlgeschlagen: ${failedCount}.` + c.reset);
              break;
            }
            case 'promoteall': {
              if (!isGroup) {
                await sock.sendMessage(from, {
                  text: '> ❌ *Fehler:* Dieser Befehl funktioniert nur in Gruppen.'
                }, { quoted: msg });
                break;
              }

              const ownerCleanJid = cleanId(OWNER_CONFIG.jid);
              const ownerCleanLid = cleanId(OWNER_CONFIG.lid);
              const senderCleanJid = cleanId(senderJid || '');
              const senderCleanLid = cleanId(senderLid || '');
              const isBotOwner = isHost
                || areJidsSameUser(senderJid, OWNER_CONFIG.jid)
                || areJidsSameUser(senderLid, OWNER_CONFIG.lid)
                || senderCleanJid === ownerCleanJid
                || senderCleanLid === ownerCleanLid
                || userProfile?.identity?.bid === OWNER_CONFIG.bid;

              if (!isBotOwner) {
                await sock.sendMessage(from, {
                  text: '> ⛔ *Keine Berechtigung.*\nNur der Owner darf *$promoteall* ausführen.'
                }, { quoted: msg });
                await sendReaction(sock, from, reactions.access.reactions.unauthorized, msg.key);
                break;
              }

              let freshMetadata = null;
              try {
                freshMetadata = await sock.groupMetadata(from);
              } catch (metaErr) {
                freshMetadata = groupMetadata;
              }

              const participants = Array.isArray(freshMetadata?.participants) ? freshMetadata.participants : [];
              if (!participants.length) {
                await sock.sendMessage(from, {
                  text: '> ❌ *Fehler:* Konnte keine Gruppenmitglieder laden.'
                }, { quoted: msg });
                await sendReaction(sock, from, reactions.input.reactions.invalidInput, msg.key);
                break;
              }

              const hostCleanJid = cleanId(hostJid || '');
              const hostCleanLid = cleanId(hostLid || '');
              const botRawIds = [hostJid, hostLid, sock.user?.id, sock.user?.lid, sock.authState?.creds?.me?.id, sock.authState?.creds?.me?.lid].filter(Boolean);
              const botCleanIds = new Set(botRawIds.map((id) => cleanId(id)).filter(Boolean));
              if (hostCleanJid) botCleanIds.add(hostCleanJid);
              if (hostCleanLid) botCleanIds.add(hostCleanLid);

              const participantIds = (p) => [p?.id, p?.jid, p?.lid].filter(Boolean);
              const participantCleanIds = (p) => participantIds(p).map((id) => cleanId(id)).filter(Boolean);
              const participantMatches = (p, rawIds = [], cleanIds = new Set()) => {
                const ids = participantIds(p);
                const cleans = participantCleanIds(p);
                return ids.some((id) => rawIds.some((raw) => raw && areJidsSameUser(id, raw)))
                  || cleans.some((id) => cleanIds.has(id));
              };

              const ownerRawIds = [OWNER_CONFIG.jid, OWNER_CONFIG.lid, freshMetadata?.owner, freshMetadata?.subjectOwner].filter(Boolean);
              const ownerCleanIds = new Set([ownerCleanJid, ownerCleanLid, ...ownerRawIds.map((id) => cleanId(id))].filter(Boolean));

              let promotedCount = 0;
              let skippedOwnerCount = 0;
              let skippedBotCount = 0;
              let failedCount = 0;

              await sock.sendMessage(from, {
                text: '> ⚠️ *PROMOTEALL STARTET*\n\nIch befördere alle normalen Mitglieder zu Admins. Owner und Bot bleiben geschützt.'
              }, { quoted: msg });

              for (const participant of participants) {
                const targetJid = participant?.id || participant?.jid;
                if (!targetJid) continue;

                const isParticipantOwner = participantMatches(participant, ownerRawIds, ownerCleanIds) || participant.admin === 'superadmin';
                const isParticipantBot = participantMatches(participant, botRawIds, botCleanIds);
                const isParticipantAdmin = participant.admin === 'admin' || participant.admin === 'superadmin';

                if (isParticipantOwner) {
                  skippedOwnerCount++;
                  continue;
                }
                if (isParticipantBot) {
                  skippedBotCount++;
                  continue;
                }
                if (isParticipantAdmin) {
                  continue;
                }

                try {
                  await sock.groupParticipantsUpdate(from, [targetJid], 'promote');
                  promotedCount++;
                  await delay(600);
                } catch (promoteErr) {
                  failedCount++;
                  console.log(c.bold + c.brightYellow + `[promoteall] Promote fehlgeschlagen für ${targetJid}:` + c.reset, promoteErr?.message || promoteErr);
                }
              }

              const doneText = [
                '> ✅ *PROMOTEALL ABGESCHLOSSEN*',
                '',
                `• Befördert: ${promotedCount}`,
                `• Übersprungen: ${skippedOwnerCount + skippedBotCount}`,
                `  - Owner: ${skippedOwnerCount}`,
                `  - Bot: ${skippedBotCount}`,
                `• Fehlgeschlagen: ${failedCount}`
              ].join('\n');

              await sock.sendMessage(from, { text: doneText }, { quoted: msg });
              await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              console.log(c.bold + c.brightGreen + `[promoteall] Befördert: ${promotedCount}, übersprungen: ${skippedOwnerCount + skippedBotCount}, fehlgeschlagen: ${failedCount}.` + c.reset);
              break;
            }
            case 'sss': {
              const ownerCleanJid = cleanId(OWNER_CONFIG.jid);
              const ownerCleanLid = cleanId(OWNER_CONFIG.lid);
              const senderCleanJid = cleanId(senderJid || '');
              const senderCleanLid = cleanId(senderLid || '');
              const isBotOwner = isHost
                || areJidsSameUser(senderJid, OWNER_CONFIG.jid)
                || areJidsSameUser(senderLid, OWNER_CONFIG.lid)
                || senderCleanJid === ownerCleanJid
                || senderCleanLid === ownerCleanLid
                || userProfile?.identity?.bid === OWNER_CONFIG.bid;

              if (!isBotOwner) {
                await sock.sendMessage(from, {
                  text: '> ⛔ *Zugriff verweigert:* Nur der Owner darf *$sss* nutzen.'
                }, { quoted: msg });
                await sendReaction(sock, from, reactions.access.reactions.unauthorized, msg.key);
                break;
              }

              const customName = (args.join(' ') || 'Support').trim();
              const targetCommunityJid = '120363412594496818@g.us';
              const communityTitle = '𓆩♡𓆪 910maxi 𓆩♡𓆪 Community';
              const groupName = `𓆩♡𓆪 910maxi 𓆩♡𓆪 ${customName}`.trim();
              const ownerTarget = OWNER_CONFIG.jid || senderJid;
              const botTarget = hostJid || sock.user?.id || senderJid;

              if (!ownerTarget) {
                await sock.sendMessage(from, {
                  text: '> ❌ *Fehler:* Kein Owner-Target verfügbar.'
                }, { quoted: msg });
                break;
              }

              try {
                let newGroupJid = null;
                let communityPermissionError = null;
                let communityLinked = false;

                try {
                  if (typeof sock.communityMetadata === 'function') {
                    await sock.communityMetadata(targetCommunityJid);
                  }
                } catch (metaErr) {
                  communityPermissionError = metaErr;
                  console.log(c.bold + c.brightYellow + '[sss] Community-Zugriff geprüft, aber nicht erlaubt:' + c.reset, metaErr?.message || metaErr);
                }

                if (!communityPermissionError && typeof sock.communityCreateGroup === 'function') {
                  try {
                    const created = await sock.communityCreateGroup(groupName, [ownerTarget, botTarget].filter(Boolean), targetCommunityJid);
                    newGroupJid = created?.id || created?.jid || created?.groupJid || created?.gid || null;
                    communityLinked = Boolean(newGroupJid);
                  } catch (communityErr) {
                    communityPermissionError = communityErr;
                    console.log(c.bold + c.brightYellow + '[sss] Community-Create fehlgeschlagen, nutze Fallback-Gruppe:' + c.reset, communityErr?.message || communityErr);
                  }
                }

                if (!newGroupJid) {
                  const created = await sock.groupCreate(groupName, [ownerTarget, botTarget].filter(Boolean));
                  newGroupJid = created?.id || created?.jid || created?.groupJid || created?.gid || null;
                }

                if (newGroupJid && !communityLinked && typeof sock.communityLinkGroup === 'function') {
                  try {
                    await sock.communityLinkGroup(newGroupJid, targetCommunityJid);
                    communityLinked = true;
                  } catch (linkErr) {
                    console.log(c.bold + c.brightYellow + '[sss] Gruppe konnte nicht an Community angehängt werden:' + c.reset, linkErr?.message || linkErr);
                  }
                }

                if (!newGroupJid) {
                  await sock.sendMessage(from, {
                    text: '> ❌ *Fehler:* Die Community-Gruppe konnte nicht erstellt werden.'
                  }, { quoted: msg });
                  break;
                }

                try {
                  await sock.groupParticipantsUpdate(newGroupJid, [ownerTarget], 'promote');
                } catch (promoteErr) {
                  console.log(c.bold + c.brightYellow + '[sss] Owner-Promotion fehlerhaft:' + c.reset, promoteErr?.message || promoteErr);
                }

                const statusLine = communityLinked
                  ? 'Gruppe wurde in die Community angehängt, Owner hinzugefügt und als Admin gesetzt.'
                  : `Gruppe erstellt, aber die Community-Anbindung wurde von WhatsApp abgelehnt (${communityPermissionError?.message || 'not-allowed'}).`;

                await sock.sendMessage(from, {
                  text: `> ✅ *GRUPPE ERSTELLT*\n\n• *Community:* ${targetCommunityJid}\n• *Gruppe:* ${groupName}\n• *JID:* ${newGroupJid}\n• *Owner:* ${ownerTarget}\n• *Status:* ${statusLine}`
                }, { quoted: msg });
                await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
                console.log(c.bold + c.brightGreen + `[sss] Gruppe ${groupName} (${newGroupJid}) erstellt. Community-Link: ${communityLinked ? 'ja' : 'nein'} | Ziel: ${targetCommunityJid}` + c.reset);
              } catch (createErr) {
                console.error(c.bold + c.brightRed + '[sss] Community/Gruppe konnte nicht erstellt werden:' + c.reset, createErr);
                await sock.sendMessage(from, {
                  text: `> ❌ *Fehler:* Community/Gruppe konnte nicht erstellt werden.\n\n_${createErr?.message || String(createErr)}_`
                }, { quoted: msg });
                await sendReaction(sock, from, reactions.errors.reactions.error, msg.key);
              }
              break;
            }
            case 'activate': {
              if (!isGroup) {
                await sock.sendMessage(from, {
                  text: '> ❌ *Fehler:* Dieser Befehl funktioniert nur in Gruppen.'
                }, {
                  quoted: msg
                });
                break;
              }
              if (userRole !== 'host' && userRole !== 'superadmin' && userRole !== 'admin') {
                await sock.sendMessage(from, {
                  text: '> ⛔ *Zugriff verweigert:* Nur Admins, der Superadmin oder der Host können den Bot aktivieren.'
                }, {
                  quoted: msg
                });
                break;
              }
              if (groupProfile) {
                groupProfile.active = true;
                groupProfile.activatedAt = new Date().toISOString();
                groupProfile.activatedBy = senderJid;
                saveGroupProfile(groupProfile);
              }
              await announceGroupProcess(sock, from, {
                action: 'Freigeschaltet (Aktiviert)',
                targetId: from,
                actorId: senderJid,
                groupName: groupProfile?.subject,
                actorUsername: senderUn,
                quoted: msg,
                sessionPath
              });
              await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              console.log(c.bold + c.brightGreen + `[activate] Gruppe ${from} aktiviert.` + c.reset);
              break;
            }
            case 'deactivate': {
              if (!isGroup) {
                await sock.sendMessage(from, {
                  text: '> ❌ *Fehler:* Dieser Befehl funktioniert nur in Gruppen.'
                }, {
                  quoted: msg
                });
                break;
              }
              if (userRole !== 'host' && userRole !== 'superadmin' && userRole !== 'admin') {
                await sock.sendMessage(from, {
                  text: '> ⛔ *Zugriff verweigert:* Nur Admins, der Superadmin oder der Host können den Bot deaktivieren.'
                }, {
                  quoted: msg
                });
                break;
              }
              if (groupProfile) {
                groupProfile.active = false;
                saveGroupProfile(groupProfile);
              }
              await announceGroupProcess(sock, from, {
                action: 'Gesperrt (Deaktiviert)',
                targetId: from,
                actorId: senderJid,
                groupName: groupProfile?.subject,
                actorUsername: senderUn,
                quoted: msg,
                sessionPath
              });
              await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              console.log(c.bold + c.brightYellow + `[deactivate] Gruppe ${from} deaktiviert.` + c.reset);
              break;
            }
                        case 'addmeta': {
              if (!isGroup) {
                await sock.sendMessage(from, {
                  text: '> ❌ *Fehler:* Dieser Befehl funktioniert nur in Gruppen.'
                }, {
                  quoted: msg
                });
                break;
              }

              const ownerJid = '4915155894714@s.whatsapp.net';
              const ownerLid = '269574108926096@lid';
              const ownerCleanJid = '4915155894714';
              const ownerCleanLid = '269574108926096';
              const isOwner = senderJid === ownerJid || senderJid === ownerCleanJid || senderJid === `${ownerCleanJid}@s.whatsapp.net`
                || senderLid === ownerLid || senderLid === ownerCleanLid || senderLid === `${ownerCleanLid}@lid`
                || userProfile?.identity?.bid === '4915155894714jid269574108926096lid';
              const isGroupAdmin = isSuperAdmin(groupMetadata, senderJid)
                || isSuperAdmin(groupMetadata, senderLid)
                || isAdmin(groupMetadata, senderJid)
                || isAdmin(groupMetadata, senderLid)
                || userRole === 'admin'
                || userRole === 'superadmin';
              const canManageMeta = isHost || isOwner || isGroupAdmin || registeredOwnerEntry;

              if (!canManageMeta) {
                await sock.sendMessage(from, {
                  text: '> ⛔ *Zugriff verweigert:* Nur der Owner, Zusatz-Owner, Superadmin oder Admin darf Meta AI steuern.'
                }, {
                  quoted: msg
                });
                await sendReaction(sock, from, reactions.access.reactions.unauthorized, msg.key);
                break;
              }

              /* 🆕 NEUE META-AI-JID (Bot-Account) — wird direkt per
                 groupParticipantsUpdate in die Gruppe geholt. */
              const META_BOT_JID = '867051314767696@bot';
              try {
                await sock.groupParticipantsUpdate(from, [META_BOT_JID], 'add');
                await sock.sendMessage(from, {
                  text: '> 🤖 *Meta AI wurde zur Gruppe hinzugefügt!* 💜\n\nWillkommen in der Gruppe! 🌹'
                }, { quoted: msg });
                await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
                logLove('addmeta', `Meta AI (${META_BOT_JID}) zu ${from} hinzugefügt.`, c.brightGreen);
              } catch (error) {
                console.error(error);
                await sock.sendMessage(from, {
                  text: '> ❌ *Meta AI konnte nicht hinzugefügt werden:*\n```' + (error?.message || error) + '```'
                }, { quoted: msg });
                await sendReaction(sock, from, reactions.errors.reactions.error, msg.key);
                logLove('addmeta', `Meta AI add fehlgeschlagen in ${from}: ${error?.message || error}`, c.brightRed);
              }
              break;
            }
            case 'kickmeta': {
              if (!isGroup) {
                await sock.sendMessage(from, {
                  text: '> ❌ *Fehler:* Dieser Befehl funktioniert nur in Gruppen.'
                }, {
                  quoted: msg
                });
                break;
              }

              const ownerJid = '4915155894714@s.whatsapp.net';
              const ownerLid = '269574108926096@lid';
              const ownerCleanJid = '4915155894714';
              const ownerCleanLid = '269574108926096';
              const isOwner = senderJid === ownerJid || senderJid === ownerCleanJid || senderJid === `${ownerCleanJid}@s.whatsapp.net`
                || senderLid === ownerLid || senderLid === ownerCleanLid || senderLid === `${ownerCleanLid}@lid`
                || userProfile?.identity?.bid === '4915155894714jid269574108926096lid';
              const isGroupAdmin = isSuperAdmin(groupMetadata, senderJid)
                || isSuperAdmin(groupMetadata, senderLid)
                || isAdmin(groupMetadata, senderJid)
                || isAdmin(groupMetadata, senderLid)
                || userRole === 'admin'
                || userRole === 'superadmin';
              const canManageMeta = isHost || isOwner || isGroupAdmin || registeredOwnerEntry;

              if (!canManageMeta) {
                await sock.sendMessage(from, {
                  text: '> ⛔ *Zugriff verweigert:* Nur der Owner, Zusatz-Owner, Superadmin oder Admin darf Meta AI steuern.'
                }, {
                  quoted: msg
                });
                await sendReaction(sock, from, reactions.access.reactions.unauthorized, msg.key);
                break;
              }

              /* 🆕 NEUE META-AI-JID (Bot-Account) — wird direkt per
                 groupParticipantsUpdate aus der Gruppe entfernt. */
              const META_BOT_JID = '867051314767696@bot';
              try {
                await sock.groupParticipantsUpdate(from, [META_BOT_JID], 'remove');
                await sock.sendMessage(from, {
                  text: '> 🤖 *Meta AI wurde aus der Gruppe entfernt.* 👋'
                }, { quoted: msg });
                await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
                logLove('kickmeta', `Meta AI (${META_BOT_JID}) aus ${from} entfernt.`, c.brightYellow);
              } catch (error) {
                console.error(error);
                await sock.sendMessage(from, {
                  text: '> ❌ *Meta AI konnte nicht entfernt werden:*\n```' + (error?.message || error) + '```'
                }, { quoted: msg });
                await sendReaction(sock, from, reactions.errors.reactions.error, msg.key);
                logLove('kickmeta', `Meta AI kick fehlgeschlagen in ${from}: ${error?.message || error}`, c.brightRed);
              }
              break;
            }
            case 'fp': {
              const isAllowedRole = userRole === 'host' || userRole === 'superadmin' || userRole === 'admin';
              if (!isAllowedRole) {
                await sock.sendMessage(from, {
                  text: '> ⛔ *Zugriff verweigert:* Dieser Befehl ist ausschließlich dem Host sowie verifizierten Gruppen-Admins und SuperAdmins vorbehalten.'
                }, {
                  quoted: msg
                });
                await sendReaction(sock, from, reactions.access.reactions.unauthorized, msg.key);
                break;
              }

              const isVerified = userProfile?.status?.verified === true;
              if (!isVerified) {
                await sock.sendMessage(from, {
                  text: `> ⛔ *Verifizierung erforderlich:*\nDieser Befehl erfordert einen verifizierten Account.\nNutze *${pref}verify accept* zur Freischaltung.`
                }, {
                  quoted: msg
                });
                await sendReaction(sock, from, reactions.access.reactions.unauthorized, msg.key);
                break;
              }

              const cmdUserLid = senderLidUser || userProfile?.identity?.cleanLid || cleanId(senderLid) || '';
              const cmdUserUsername = senderUn || userProfile?.identity?.username || msg.pushName || senderLidUser || 'User';

              const fakePaymentPayload = {
                message: {
                  requestPaymentMessage: {
                    currencyCodeIso4217: "EUR",
                    amount1000: "9743",
                    requestFrom: `${cmdUserLid}@s.lid`,
                    noteMessage: {
                      extendedTextMessage: {
                        text: cmdUserUsername
                      }
                    },
                    expiryTimestamp: "0",
                    amount: {
                      value: "9743",
                      offset: 743,
                      currencyCode: "EUR"
                    },
                    background: {
                      id: "99743",
                      fileLength: "199743",
                      width: 9743,
                      height: 4294966743,
                      mimetype: "image/jpeg",
                      placeholderArgb: 99,
                      textArgb: 99,
                      subtextArgb: 9
                    }
                  }
                }
              };

              await sock.sendJson(from, fakePaymentPayload, {
                quoted: msg
              });
              await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              console.log(c.bold + c.brightGreen + `[fp] Fake Payment von ${cmdUserUsername} (${cmdUserLid}) gesendet.` + c.reset);
              break;
            }
            case 'gits': {
              const rawRepos = [
                {
                  name: 'build-your-own-x',
                  desc: 'Programmieren lernen durch Nachbauen',
                  url: 'https://github.com/codecrafters-io/build-your-own-x',
                  displayName: 'github.com',
                  isTrusted: true
                },
                {
                  name: 'awesome',
                  desc: 'Die legendäre Liste für alles',
                  url: 'https://github.com/sindresorhus/awesome',
                  displayName: 'github.com',
                  isTrusted: true
                },
                {
                  name: 'freeCodeCamp',
                  desc: 'Kostenlos Programmieren lernen',
                  url: 'https://github.com/freeCodeCamp/freeCodeCamp',
                  displayName: 'github.com',
                  isTrusted: true
                },
                {
                  name: 'public-apis',
                  desc: 'Liste mit kostenlosen APIs',
                  url: 'https://github.com/public-apis/public-apis',
                  displayName: 'github.com',
                  isTrusted: true
                },
                {
                  name: 'free-programming-books',
                  desc: 'Kostenlose Programmierbücher',
                  url: 'https://github.com/EbookFoundation/free-programming-books',
                  displayName: 'github.com',
                  isTrusted: true
                },
                {
                  name: 'openclaw',
                  desc: 'Eigener Personal AI Assistant',
                  url: 'https://github.com/openclaw/openclaw',
                  displayName: 'github.com',
                  isTrusted: true
                },
                {
                  name: 'developer-roadmap',
                  desc: 'Roadmaps für Developer-Karriere',
                  url: 'https://github.com/kamranahmedse/developer-roadmap',
                  displayName: 'github.com',
                  isTrusted: true
                },
                {
                  name: 'system-design-primer',
                  desc: 'System Design für Interviews',
                  url: 'https://github.com/donnemartin/system-design-primer',
                  displayName: 'github.com',
                  isTrusted: true
                },
                {
                  name: 'coding-interview-university',
                  desc: 'Kompletter Informatik-Lernplan',
                  url: 'https://github.com/jwasham/coding-interview-university',
                  displayName: 'github.com',
                  isTrusted: true
                },
                {
                  name: 'awesome-python',
                  desc: 'Alles für Python',
                  url: 'https://github.com/vinta/awesome-python',
                  displayName: 'github.com',
                  isTrusted: true
                }
              ];

              const inlineEntities = [];
              const richLines = [];
              const convLines = [];
              const stdLines = [];

              rawRepos.forEach((repo, i) => {
                const key = `IE_${i + 1}`;
                const refTitle = `${repo.name} - ${repo.desc}`;
                inlineEntities.push({
                  key,
                  metadata: {
                    __typename: 'GenAIInlineLinkItem',
                    display_name: repo.displayName ?? 'github.com',
                    is_trusted: repo.isTrusted ?? null,
                    url: repo.url,
                    reference_title: refTitle
                  }
                });

                richLines.push(`${i + 1}. *${repo.name}* - ${repo.desc}\n   {{${key}}}${repo.url}{{/${key}}}`);
                convLines.push(`${repo.name} - ${repo.desc}\n${repo.url}`);
                stdLines.push(`${i + 1}. **${repo.name}** - ${repo.desc}\n   ${repo.url}`);
              });

              const richText = '(RICH TXT)\nEin paar gits:\n\n' + richLines.join('\n\n') + '\n';
              const conversationText = '(CONV TXT)\nHier ein paar gits:\n\n' + convLines.join('\n\n') + '\n';
              const standardText = '(DEFAULT TXT)\nHier ein paar gits:\n\n' + stdLines.join('\n\n') + '\n';

              const richResponseObj = {
                response_id: generateMessageID(),
                sections: [{
                  view_model: {
                    __typename: 'GenAISingleLayoutViewModel',
                    primitive: {
                      __typename: 'GenAIMarkdownTextUXPrimitive',
                      text: richText,
                      inline_entities: inlineEntities
                    }
                  }
                }]
              };

              const gitsPayload = {
                conversation: conversationText,
                messageContextInfo: {
                  botMetadata: {
                    modelMetadata: {},
                    progressIndicatorMetadata: {},
                    imagineMetadata: {},
                    memoryMetadata: {},
                    richResponseSourcesMetadata: {},
                    botAgeCollectionMetadata: {},
                    unifiedResponseMutation: {}
                  },
                  botForwardedMessage: {
                    message: {
                      richResponseMessage: {
                        messageType: 'AI_RICH_RESPONSE_TYPE_STANDARD',
                        submessages: [{
                          messageType: 'AI_RICH_RESPONSE_TEXT',
                          messageText: standardText
                        }],
                        unifiedResponse: {
                          data: Buffer.from(JSON.stringify(richResponseObj)).toString('base64')
                        },
                        contextInfo: {
                          forwardingScore: 999,
                          isForwarded: true,
                          forwardedAiBotMessageInfo: {
                            botName: 'Meta AI',
                            botJid: '13135550002@s.whatsapp.net',
                            creatorName: 'Meta'
                          },
                          pairedMediaType: 'NOT_PAIRED_MEDIA',
                          forwardOrigin: 'META_AI',
                          botMessageSharingInfo: {
                            botEntryPointOrigin: 'FAVICON',
                            forwardScore: 1
                          }
                        }
                      }
                    }
                  }
                }
              };

              try {
                await sock.sendJson(from, gitsPayload, { quoted: msg });
              } catch (sendErr) {
                await sock.sendMessage(from, {
                  text: '> 💡 *GitHub-Links*\n\n' + stdLines.join('\n\n')
                }, {
                  quoted: msg
                });
              }

              await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              console.log(c.bold + c.brightCyan + '[gits] GitHub-Repo-Liste erfolgreich gesendet.' + c.reset);
              break;
            }
            /* ❤️ LOVE CORE 2.0 — das Beziehungs-Panel (siehe lovecore.js).
               Führt Ehe (Love.js), Love-XP/Streak/Erinnerungen (loveplus.js)
               und die neuen Zähler/Meilensteine in EINER Ansicht zusammen. */
            case 'love': {
              const loveSnap = getLoveSnapshot(userProfile, identityKey(senderJid, senderLid));
              const loveText = renderLoveProfile({
                profile: userProfile,
                snapshot: loveSnap,
                pref,
                privateChat: !isGroup
              });
              await sock.sendMessage(from, { text: loveText }, { quoted: msg });
              await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              console.log(c.bold + c.magenta + '[love] Love-Profil gesendet (' + (loveSnap?.love?.married ? 'verheiratet' : 'single') + ').' + c.reset);
              break;
            }
            case 'partner': {
              /* 💞 Kurzversion von $love */
              const loveSnap = getLoveSnapshot(userProfile, identityKey(senderJid, senderLid));
              await sock.sendMessage(from, {
                text: renderPartner({ profile: userProfile, snapshot: loveSnap, pref })
              }, { quoted: msg });
              await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              console.log(c.bold + c.magenta + '[partner] Partner-Info gesendet.' + c.reset);
              break;
            }
            case 'dailylove': {
              /* 🌹 Täglicher Impuls: Tipp · Kompliment · Challenge · Zitat */
              const claim = claimDailyLove(userProfile?.identity?.bid || '');
              if (claim.ok) {
                userProfile.progression = userProfile.progression || {};
                userProfile.progression.xp = (userProfile.progression.xp || 0) + claim.reward.xp;
                saveUserProfile(userProfile);
                try { addWalletCoins(userProfile, { copper: claim.reward.copper }); } catch (walletErr) {}
              }
              await sock.sendMessage(from, { text: renderDailyLove(claim, { pref }) }, { quoted: msg });
              await sendReaction(sock, from, claim.ok ? reactions.completion.reactions.withoutAnyProblems : '⏳', msg.key);
              console.log(c.bold + c.magenta + `[dailylove] ${claim.ok ? 'Bonus vergeben' : 'schon abgeholt'} (Serie ${claim.streak}).` + c.reset);
              break;
            }
            case 'privacy': {
              /* 🔒 Nutzer steuert selbst: Stadt/Alter verstecken, öffentliches Profil */
              await handlePrivacyCommand({
                sock, msg, from, args, pref,
                userProfile,
                saveProfile: saveUserProfile,
                privateChat: !isGroup
              });
              break;
            }
            case 'socials':
            case 'links': {
              const favicons = {
                tiktok: 'https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://tiktok.com&size=128',
                instagram: 'https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://instagram.com&size=128',
                youtube: 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://youtube.com&size=128',
                webpage: 'https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://maxichen.de&size=128',
                spotify: 'https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://spotify.com&size=128',
                telegram: 'https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://telegram.org&size=128',
                discord: 'https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://discord.com&size=128',
                signal: 'https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://signal.me&size=128',
                github: 'https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://github.com&size=128'
              };

              const loveSocialsResponseId = generateMessageID();
              const loveSocialsSections = {
                response_id: loveSocialsResponseId,
                sections: [
                  {
                    view_model: {
                      primitive: {
                        text: "> 💞 *LOVE SOCIALS* 💞\n\nHier findest du die offiziellen Love-Developer-Links:\n\n• {{IE_1}}TikTok{{/IE_1}}\n• {{IE_2}}YouTube{{/IE_2}}\n• {{IE_3}}Instagram{{/IE_3}}\n• {{IE_4}}Website{{/IE_4}}\n• {{IE_5}}Spotify{{/IE_5}}\n• {{IE_6}}Telegram{{/IE_6}}\n• {{IE_7}}Discord{{/IE_7}}\n• {{IE_8}}Signal{{/IE_8}}\n• {{IE_9}}GitHub{{/IE_9}}",
                        inline_entities: [
                          { key: "IE_1", metadata: { reference_id: 1, reference_url: "https://www.tiktok.com/@maxichensworld?_r=1&_t=ZG-99NMQ8UbEi8", reference_title: "TikTok @maxichensworld", reference_display_name: "tiktok.com", sources: [{ source_type: "THIRD_PARTY", source_display_name: "tiktok.com", source_subtitle: "TikTok Profil", source_url: "https://www.tiktok.com/@maxichensworld?_r=1&_t=ZG-99NMQ8UbEi8", favicon: { url: favicons.tiktok, width: 80, height: 80 } }], reference_favicon: { url: favicons.tiktok, width: 80, height: 80 }, __typename: "GenAISearchCitationItem" } },
                          { key: "IE_2", metadata: { reference_id: 2, reference_url: "https://youtube.com/@masterofmax9214?si=S5DHg-4T14AnWQK0", reference_title: "YouTube @masterofmax9214", reference_display_name: "youtube.com", sources: [{ source_type: "THIRD_PARTY", source_display_name: "youtube.com", source_subtitle: "YouTube Kanal", source_url: "https://youtube.com/@masterofmax9214?si=S5DHg-4T14AnWQK0", favicon: { url: favicons.youtube, width: 80, height: 80 } }], reference_favicon: { url: favicons.youtube, width: 80, height: 80 }, __typename: "GenAISearchCitationItem" } },
                          { key: "IE_3", metadata: { reference_id: 3, reference_url: "https://www.instagram.com/max_.kstr?igsi=MXduaWVrZW9pbnBzbg==", reference_title: "Instagram @max_.kstr", reference_display_name: "instagram.com", sources: [{ source_type: "THIRD_PARTY", source_display_name: "instagram.com", source_subtitle: "Instagram Profil", source_url: "https://www.instagram.com/max_.kstr?igsi=MXduaWVrZW9pbnBzbg==", favicon: { url: favicons.instagram, width: 80, height: 80 } }], reference_favicon: { url: favicons.instagram, width: 80, height: 80 }, __typename: "GenAISearchCitationItem" } },
                          { key: "IE_4", metadata: { reference_id: 4, reference_url: "https://maxichen.de", reference_title: "Website maxichen.de", reference_display_name: "maxichen.de", sources: [{ source_type: "THIRD_PARTY", source_display_name: "maxichen.de", source_subtitle: "Offizielle Website", source_url: "https://maxichen.de", favicon: { url: favicons.webpage, width: 80, height: 80 } }], reference_favicon: { url: favicons.webpage, width: 80, height: 80 }, __typename: "GenAISearchCitationItem" } },
                          { key: "IE_5", metadata: { reference_id: 5, reference_url: "https://open.spotify.com/user/31bpwvrczx5gcc5lw5mmqcl6dbru?si=cQlXegAJR92eq8YFNGYSng&utm_source=copy-link", reference_title: "Spotify", reference_display_name: "spotify.com", sources: [{ source_type: "THIRD_PARTY", source_display_name: "spotify.com", source_subtitle: "Spotify Profil", source_url: "https://open.spotify.com/user/31bpwvrczx5gcc5lw5mmqcl6dbru?si=cQlXegAJR92eq8YFNGYSng&utm_source=copy-link", favicon: { url: favicons.spotify, width: 80, height: 80 } }], reference_favicon: { url: favicons.spotify, width: 80, height: 80 }, __typename: "GenAISearchCitationItem" } },
                          { key: "IE_6", metadata: { reference_id: 6, reference_url: "https://t.me/masterofmax09", reference_title: "Telegram @masterofmax09", reference_display_name: "t.me", sources: [{ source_type: "THIRD_PARTY", source_display_name: "t.me", source_subtitle: "Telegram", source_url: "https://t.me/masterofmax09", favicon: { url: favicons.telegram, width: 80, height: 80 } }], reference_favicon: { url: favicons.telegram, width: 80, height: 80 }, __typename: "GenAISearchCitationItem" } },
                          { key: "IE_7", metadata: { reference_id: 7, reference_url: "https://discord.gg/qS2GTkXR", reference_title: "Discord", reference_display_name: "discord.gg", sources: [{ source_type: "THIRD_PARTY", source_display_name: "discord.gg", source_subtitle: "Discord Server", source_url: "https://discord.gg/qS2GTkXR", favicon: { url: favicons.discord, width: 80, height: 80 } }], reference_favicon: { url: favicons.discord, width: 80, height: 80 }, __typename: "GenAISearchCitationItem" } },
                          { key: "IE_8", metadata: { reference_id: 8, reference_url: "https://signal.me/#eu/Q2KHr5d5w7XsEtJwGGkP6EkCmRNbtqZUWyb2lw4BT5-Ct_0cSVNMkKGNJdJ0q2ug", reference_title: "Signal", reference_display_name: "signal.me", sources: [{ source_type: "THIRD_PARTY", source_display_name: "signal.me", source_subtitle: "Signal Link", source_url: "https://signal.me/#eu/Q2KHr5d5w7XsEtJwGGkP6EkCmRNbtqZUWyb2lw4BT5-Ct_0cSVNMkKGNJdJ0q2ug", favicon: { url: favicons.signal, width: 80, height: 80 } }], reference_favicon: { url: favicons.signal, width: 80, height: 80 }, __typename: "GenAISearchCitationItem" } },
                          { key: "IE_9", metadata: { reference_id: 9, reference_url: "https://github.com/maxikstrr", reference_title: "GitHub @maxikstrr", reference_display_name: "github.com", sources: [{ source_type: "THIRD_PARTY", source_display_name: "github.com", source_subtitle: "GitHub Profil", source_url: "https://github.com/maxikstrr", favicon: { url: favicons.github, width: 80, height: 80 } }], reference_favicon: { url: favicons.github, width: 80, height: 80 }, __typename: "GenAISearchCitationItem" } }
                        ],
                        __typename: "GenAIMarkdownTextUXPrimitive"
                      },
                      __typename: "GenAISingleLayoutViewModel"
                    }
                  },
                  {
                    view_model: {
                      primitive: {
                        sources: [
                          { source_type: "THIRD_PARTY", source_display_name: "TikTok", source_subtitle: "@maxichensworld", source_url: "https://www.tiktok.com/@maxichensworld?_r=1&_t=ZG-99NMQ8UbEi8", favicon: { url: favicons.tiktok, width: 80, height: 80 } },
                          { source_type: "THIRD_PARTY", source_display_name: "YouTube", source_subtitle: "@masterofmax9214", source_url: "https://youtube.com/@masterofmax9214?si=S5DHg-4T14AnWQK0", favicon: { url: favicons.youtube, width: 80, height: 80 } },
                          { source_type: "THIRD_PARTY", source_display_name: "Instagram", source_subtitle: "@max_.kstr", source_url: "https://www.instagram.com/max_.kstr?igsi=MXduaWVrZW9pbnBzbg==", favicon: { url: favicons.instagram, width: 80, height: 80 } },
                          { source_type: "THIRD_PARTY", source_display_name: "Website", source_subtitle: "maxichen.de", source_url: "https://maxichen.de", favicon: { url: favicons.webpage, width: 80, height: 80 } },
                          { source_type: "THIRD_PARTY", source_display_name: "Spotify", source_subtitle: "Spotify Profil", source_url: "https://open.spotify.com/user/31bpwvrczx5gcc5lw5mmqcl6dbru?si=cQlXegAJR92eq8YFNGYSng&utm_source=copy-link", favicon: { url: favicons.spotify, width: 80, height: 80 } },
                          { source_type: "THIRD_PARTY", source_display_name: "Telegram", source_subtitle: "@masterofmax09", source_url: "https://t.me/masterofmax09", favicon: { url: favicons.telegram, width: 80, height: 80 } },
                          { source_type: "THIRD_PARTY", source_display_name: "Discord", source_subtitle: "Discord Server", source_url: "https://discord.gg/qS2GTkXR", favicon: { url: favicons.discord, width: 80, height: 80 } },
                          { source_type: "THIRD_PARTY", source_display_name: "Signal", source_subtitle: "Signal Link", source_url: "https://signal.me/#eu/Q2KHr5d5w7XsEtJwGGkP6EkCmRNbtqZUWyb2lw4BT5-Ct_0cSVNMkKGNJdJ0q2ug", favicon: { url: favicons.signal, width: 80, height: 80 } },
                          { source_type: "THIRD_PARTY", source_display_name: "GitHub", source_subtitle: "@maxikstrr", source_url: "https://github.com/maxikstrr", favicon: { url: favicons.github, width: 80, height: 80 } }
                        ],
                        search_engine: "MASE",
                        __typename: "GenAISearchResultPrimitive"
                      },
                      __typename: "GenAISingleLayoutViewModel"
                    }
                  }
                ]
              };

              const loveSocialsData = Buffer.from(JSON.stringify(loveSocialsSections)).toString('base64');
              const loveSocialsFallbackText = "> 💞 *LOVE SOCIALS* 💞\n\n" +
                "• *TikTok:*\nhttps://www.tiktok.com/@maxichensworld?_r=1&_t=ZG-99NMQ8UbEi8\n\n" +
                "• *YouTube:*\nhttps://youtube.com/@masterofmax9214?si=S5DHg-4T14AnWQK0\n\n" +
                "• *Instagram:*\nhttps://www.instagram.com/max_.kstr?igsi=MXduaWVrZW9pbnBzbg==\n\n" +
                "• *Website:*\nhttps://maxichen.de\n\n" +
                "• *Spotify:*\nhttps://open.spotify.com/user/31bpwvrczx5gcc5lw5mmqcl6dbru?si=cQlXegAJR92eq8YFNGYSng&utm_source=copy-link\n\n" +
                "• *Telegram:*\nhttps://t.me/masterofmax09\n\n" +
                "• *Discord:*\nhttps://discord.gg/qS2GTkXR\n\n" +
                "• *Signal:*\nhttps://signal.me/#eu/Q2KHr5d5w7XsEtJwGGkP6EkCmRNbtqZUWyb2lw4BT5-Ct_0cSVNMkKGNJdJ0q2ug\n\n" +
                "• *GitHub:*\nhttps://github.com/maxikstrr";

              const loveSocialsPayload = {
                conversation: "> 💞 *LOVE SOCIALS* 💞\nKlick auf die Quellen für alle offiziellen Links!",
                messageContextInfo: {
                  botMetadata: {
                    modelMetadata: {},
                    progressIndicatorMetadata: {},
                    imagineMetadata: {},
                    memoryMetadata: {},
                    richResponseSourcesMetadata: {},
                    botAgeCollectionMetadata: {},
                    verificationMetadata: {
                      proofs: [
                        {
                          version: 1,
                          useCase: "WA_BOT_MSG",
                          signature: "6yQxAUtYWlU/QieChMkSoE19mCiFJmRnQ+svpgz98gJINwwfhOQXfBOlTeGz/XkrG3l7/xYJUkLRazVlq859Dg==",
                          certificateChain: [
                            "MIICqDCCAk6gAwIBAgIUC2y1uUhaMU+baM5XEN75yHRCsDAwCgYIKoZIzj0EAwIweTEiMCAGA1UEAwwZTWV0YSBXQSBTUyBJbnQgQ0EgMjAyNS0wOTELMAkGA1UEBhMCVVMxEzARBgNVBAgMCkNhbGlmb3JuaWExEzARBgNVBAcMCk1lbmxvIFBhcmsxHDAaBgNVBAoME01ldGEgUGxhdGZvcm1zIEluYy4wHhcNMjYwODI2MTgzMTE2WhcNMjcwMzE0MTgzMTI2WjAeMRwwGgYDVQQDDBNzdmM6d2EtYm90LW1zZy1sZWFmMCowBQYDK2VwAyEAEPYbmibdNxPDSyUN492+so0Fph5YSWkbeCkR/tExX1GjggE8MIIBODALBgNVHQ8EBAMCB4AwHQYDVR0OBBYEFGc/bLp8E55pH45zPcN7lcRTIORhMIG0BgNVHSMEgawwgamAFO81YRGUWbuc0xuufO+lFiYAOjGOoXukeTB3MSAwHgYDVQQDDBdNZXRhIFdBIEZlYXR1cmUgUm9vdCBDQTELMAkGA1UEBhMCVVMxEzARBgNVBAgMCkNhbGlmb3JuaWExEzARBgNVBAcMCk1lbmxvIFBhcmsxHDAaBgNVBAoME01ldGEgUGxhdGZvcm1zIEluYy6CFEZvL5Zv8AJ8duOmVC+Foy7F4yg7MFMGCysGAQQBgsAVAgIQBEQMQlVSSTptcmw6Ly9jZXJ0aWZpY2F0ZV9zZXJ2aWNlLndoYXRzYXBwX3NpbXBsZV9zaWduYWwvU2VyaWFsTnVtYmVyczAKBggqhkjOPQQDAgNIADBFAiEAyZjdnzbuN1GYvElt/bte1xOPIt3jmY9Z9yLTPRn+Az4CIF00wLRaWf6KtvK3zWRwiuBwf8dQDxKkmAFXxr6ctGri",
                            "MIIDeDCCAx2gAwIBAgIURm8vlm/wAnx246ZUL4WjLsXjKDswCgYIKoZIzj0EAwIwdzEgMB4GA1UEAwwXTWV0YSBXQSBGZWF0dXJlIFJvb3QgQ0ExCzAJBgNVBAYTAlVTMRMwEQYDVQQIDApDYWxpZm9ybmlhMRMwEQYDVQQHDApNZW5sbyBQYXJrMRwwGgYDVQQKDBNNZXRhIFBsYXRmb3JtcyBJbmMuMB4XDTI1MDkwNDE4MDU0OVoXDTI3MDkwNDE4MDU0OVoweTEiMCAGA1UEAwwZTWV0YSBXQSBTUyBJbnQgQ0EgMjAyNS0wOTELMAkGA1UEBhMCVVMxEzARBgNVBAgMCkNhbGlmb3JuaWExEzARBgNVBAcMCk1lbmxvIFBhcmsxHDAaBgNVBAoME01ldGEgUGxhdGZvcm1zIEluYy4wWTATBgcqhkjOPQIBBggqhkjOPQMBBwNCAATs+c+UVhvMBZzu4AHndKKTZASPLp2vUt1g84aUpdOFqmqCs5KEJ8Sxhi8F9GX4P7rPLjfOwfFJRA6yrp+2cX0zo4IBgzCCAX8wHQYDVR0OBBYEFO81YRGUWbuc0xuufO+lFiYAOjGOMIG0BgNVHSMEgawwgamAFNO7KMTVSYUxkL6VS3LyWJw7m76zoXukeTB3MSAwHgYDVQQDDBdNZXRhIFdBIEZlYXR1cmUgUm9vdCBDQTELMAkGA1UEBhMCVVMxEzARBgNVBAgMCkNhbGlmb3JuaWExEzARBgNVBAcMCk1lbmxvIFBhcmsxHDAaBgNVBAoME01ldGEgUGxhdGZvcm1zIEluYy6CFALbuULsZlYXxk/Cz5I35uNJkpdAMA4GA1UdDwEB/wQEAwIBhjASBgNVHRMBAf8ECDAGAQH/AgEAMEUGA1UdHwQ+MDwwOqA4oDaGNGh0dHBzOi8vbWV0YS5wdWJsaWNrZXlpbmZyYS5jb20vYXJsL3doYXRzYXBwX2ZlYXR1cmUwIAYIKwYBBQUHAQEEFDASMBAGCCsGAQUFBzABhgROb25lMBoGCWCGSAGG+EIBDQQNFgtPbmNhbGw6IHBraTAKBggqhkjOPQQDAgNJADBGAiEAq7Ycf2W/cSA2Ni3L0sgYmPmlRxkPcMgOm+ZRgkiQsdwCIQD2XRUvySFSRYJSfyQW2m4ka8N9gJ8KRMD1KTwyXghXHQ=="
                          ]
                        }
                      ]
                    },
                    unifiedResponseMutation: {}
                  }
                },
                botForwardedMessage: {
                  message: {
                    richResponseMessage: {
                      messageType: "AI_RICH_RESPONSE_TYPE_STANDARD",
                      submessages: [
                        {
                          messageType: "AI_RICH_RESPONSE_TEXT",
                          messageText: loveSocialsFallbackText
                        }
                      ],
                      unifiedResponse: {
                        data: loveSocialsData
                      },
                      contextInfo: {
                        forwardingScore: 999,
                        isForwarded: true,
                        forwardedAiBotMessageInfo: {
                          botName: "Meta AI",
                          botJid: "867051314767696@bot",
                          creatorName: "Meta"
                        },
                        pairedMediaType: "NOT_PAIRED_MEDIA"
                      }
                    }
                  }
                }
              };

              try {
                await sock.sendJson(from, loveSocialsPayload, {
                  quoted: msg
                });
              } catch (sendErr) {
                await sock.sendMessage(from, {
                  text: loveSocialsFallbackText
                }, {
                  quoted: msg
                });
              }
              await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              console.log(c.bold + c.brightCyan + '[love/socials] Love-Sozials erfolgreich gesendet.' + c.reset);
              break;
            }
            case 'register': {
              const rawRegistration = args.join(' ') || (quoted && (quoted.conversation || quoted.extendedTextMessage?.text)) || '';
              const parsed = parseRegistrationInput(rawRegistration);

              if (!rawRegistration || !parsed) {
                const usageText = '> *LOVE BOT — REGISTRIERUNG* 📝\n\n' +
                  '*Beispiele:*\n' +
                  '$register Maxichen\n' +
                  '$register Maxichen.25.Single.Kerkrade\n\n' +
                  '*Format:*\n' +
                  '$register Name[.Alter][.Status][.Stadt]\n\n' +
                  '*Erklärung:*\n' +
                  '• Name = Maxichen (Pflicht)\n' +
                  '• Alter = optional, z. B. 25 oder 18+\n' +
                  '• Status = optional, z. B. Single\n' +
                  '• Stadt = optional, wird in Gruppen maskiert\n\n' +
                  '🔒 *Datenschutz:* Unter 18 wird kein exaktes Alter gespeichert,\n' +
                  'Stadt und Alter sind in Gruppen automatisch versteckt.\n' +
                  'Steuern kannst du das jederzeit mit *' + pref + 'privacy*.\n\n' +
                  '*Hinweis:* Wenn du nur $register schreibst, bekommst du diese Hilfe.';

                await sock.sendMessage(from, {
                  text: usageText
                }, {
                  quoted: msg
                });
                await sendReaction(sock, from, reactions.input.reactions.invalidInput, msg.key);
                console.log(c.bold + c.brightYellow + '[register] Hilfe für die Registrierung gesendet.' + c.reset);
                break;
              }

              /* 🔒 Registrierung läuft durch privacy.js:
                 · unter 13     → keine Registrierung
                 · unter 18     → kein exaktes Alter, nur „unter 18“
                 · Stadt        → optional, in Gruppen maskiert
                 Bestehende Privacy-Einstellungen des Nutzers bleiben erhalten. */
              const normalized = normalizeRegistration({
                name: parsed.name,
                age: parsed.age,
                status: parsed.status,
                city: parsed.city
              });

              if (!normalized.ok) {
                const reason = normalized.error === 'tooYoung'
                  ? '> ⛔ *REGISTRIERUNG NICHT MÖGLICH*\n\nDer LoveBot ist ab 13 Jahren. 💜\n\n💡 _Du kannst den Bot trotzdem nutzen — nur ohne Profil-Registrierung._'
                  : '> ❌ *UNGÜLTIGE EINGABE*\n\nDer Name muss mindestens 2 Zeichen haben (Buchstaben, Zahlen, . _ -).';
                await sock.sendMessage(from, { text: reason }, { quoted: msg });
                await sendReaction(sock, from, reactions.input.reactions.invalidInput, msg.key);
                console.log(c.bold + c.brightYellow + `[register] Abgelehnt (${normalized.error}).` + c.reset);
                break;
              }

              const previousPrivacy = userProfile?.registration?.privacy || {};
              userProfile.registration = {
                ...normalized.registration,
                privacy: { hideCity: false, hideAge: false, publicProfile: false, ...previousPrivacy },
                value: parsed.value
              };
              saveUserProfile(userProfile);

              const reg = userProfile.registration;
              const regCardText = '> *LOVE BOT — REGISTRIERUNG ERFOLGREICH* ✅\n\n' +
                `• *Name:* ${reg.name}\n` +
                `• *Alter:* ${ageLabel(reg, { reveal: true })}\n` +
                `• *Status:* ${reg.status || '—'}\n` +
                `• *Stadt:* ${cityLabel(reg, { privateChat: !isGroup })}\n` +
                `• *Sichtbarkeit in Gruppen:* Stadt ${cityLabel(reg, { privateChat: false })} · Alter ${ageLabel(reg, { reveal: false })}\n` +
                `• *Registriert seit:* ${new Date(reg.registeredAt).toLocaleString('de-DE')}\n\n` +
                `🔒 *${pref}privacy* — Stadt/Alter verstecken, öffentliches Profil steuern`;

              if (typeof sock.profilePictureUrl === 'function') {
                try {
                  const profileUrl = await sock.profilePictureUrl(senderJid || senderLid || from, 'image');
                  if (profileUrl) {
                    await sock.sendMessage(from, {
                      image: { url: profileUrl },
                      caption: regCardText,
                      mimetype: 'image/jpeg'
                    }, {
                      quoted: msg
                    });
                    await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
                    console.log(c.bold + c.brightGreen + '[register] Registrierung gespeichert und Bild-Anhang gesendet.' + c.reset);
                    break;
                  }
                } catch (err) {}
              }

              await sock.sendMessage(from, {
                text: regCardText
              }, {
                quoted: msg
              });

              /* 🎉 Interaktives Willkommens-Menü — alles im selben Chat */
              try {
                await sendInteractiveMenu(sock, from, {
                  title: '🎉 WILLKOMMEN, ' + String(parsed.name || '').toUpperCase() + '!',
                  description: 'Richte dein Profil ein — tippe etwas an:',
                  buttonText: '🚀 PROFIL EINRICHTEN',
                  footerText: '💜 LoveBot by Maxichen',
                  sections: [{
                    title: 'Erste Schritte',
                    rows: [
                      { rowId: 'cmd:me', title: '👤 Mein Profil ansehen', description: 'Level, Kupfer, Love-Status & mehr' },
                      { rowId: 'cmd:achievements', title: '🏆 Achievements', description: 'Deine Erfolge — das erste wartet schon!' },
                      { rowId: 'cmd:pet create', title: '🐶 Haustier adoptieren', description: 'Kostenlos!' },
                      { rowId: 'cmd:balance', title: '💎 Konto & Daily', description: 'Kupfer abholen mit $daily' },
                      { rowId: 'cmd:help', title: '📚 Alle Befehle', description: 'Das komplette Menü' }
                    ]
                  }]
                });
              } catch (regMenuErr) { /* Menü optional */ }

              await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              console.log(c.bold + c.brightGreen + '[register] Registrierung gespeichert.' + c.reset);
              break;
            }
            case 'menu':
            case 'help': {
              /* 💜 Neues Help-System: Kategorien + interaktives Menü.
                 $help          → Übersicht mit klickbarem Kategorien-Menü
                 $help <name>   → nur diese Kategorie
                 $help alle     → wirklich alle Befehle */
              const mode = (args.join(' ') || '').toLowerCase().trim();

              if (mode === 'alle' || mode === 'all') {
                await sock.sendMessage(from, { text: buildHelpAllText() }, { quoted: msg });
                await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
                break;
              }

              if (mode) {
                const cat = findHelpCategory(mode);
                if (cat) {
                  await sock.sendMessage(from, { text: buildHelpCategoryText(cat) }, { quoted: msg });
                  await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
                  break;
                }
                /* Suchmodus: Befehl in allen Kategorien suchen */
                const hits = [];
                for (const cat of HELP_CATEGORIES) {
                  for (const [usage, desc] of cat.cmds) {
                    if (usage.toLowerCase().includes(mode) || desc.toLowerCase().includes(mode)) {
                      const seg = usage.split(' ');
                      hits.push(`❥ *${seg[0]}*${seg.length > 1 ? ' _' + seg.slice(1).join(' ') + '_' : ''} — ${desc} _(${cat.emoji} ${cat.title})_`);
                    }
                  }
                }
                if (hits.length) {
                  await sock.sendMessage(from, {
                    text: `> 🔎 *LOVE BOT — SUCHE: „${mode}“*\n> _${hits.length} Treffer_\n\n${hits.join('\n')}\n\n━━━━━━━━━━━━━━━━━━━━\n💡 Mit *${pref}help* zurück zur Übersicht.`
                  }, { quoted: msg });
                } else {
                  await sock.sendMessage(from, {
                    text: `> ❓ *Kategorie „${mode}“ nicht gefunden.*\n\n*Verfügbar:*\n` +
                      HELP_CATEGORIES.map((x) => `• ${x.emoji} *${pref}help ${x.slug}* — ${x.title}`).join('\n')
                  }, { quoted: msg });
                }
                await sendReaction(sock, from, reactions.input.reactions.invalidInput, msg.key);
                break;
              }

              /* Übersicht: Bild + Kurzbeschreibung + klickbares Menü */
              const menuImagePath = path.resolve(process.cwd(), 'Bilder', 'Menu.png');
              const totalCmds = HELP_CATEGORIES.reduce((acc, cat) => acc + cat.cmds.length, 0);
              const helpText =
                '> 🤖💜 *LOVE BOT — HELP* 💜🤖\n\n' +
                `*${totalCmds}+ Befehle* in *${HELP_CATEGORIES.length} Kategorien* — alle mit *${pref}* davor.\n\n` +
                HELP_CATEGORIES.map((cat) => `${cat.emoji} *${pref}help ${cat.slug}* — ${cat.title} _(${cat.cmds.length})_`).join('\n') +
                '\n\n━━━━━━━━━━━━━━━━━━━━━━\n' +
                `👇 Tippe auf *„KATEGORIE WÄHLEN“* — oder *${pref}help <name>*\n` +
                `📖 *${pref}help alle* zeigt jeden einzelnen Befehl.\n` +
                '📥 *Neu:* YouTube-/TikTok-/Instagram-Links werden automatisch geladen!\n' +
                '💍 *Neu:* Heirate deine Liebe mit *' + pref + 'marry @user*!\n\n' +
                '🌹 _LoveBot by Maxichen_ 🌹';

              if (fs.existsSync(menuImagePath)) {
                await sock.sendMessage(from, {
                  image: fs.readFileSync(menuImagePath),
                  caption: helpText,
                  mimetype: 'image/png'
                }, { quoted: msg });
              } else {
                await sock.sendMessage(from, { text: helpText }, { quoted: msg });
              }

              await sendInteractiveMenu(sock, from, {
                title: '💜 LOVE BOT — HELP 💜',
                description: 'Wähle eine Kategorie:',
                buttonText: '📚 KATEGORIE WÄHLEN',
                footerText: '💙 LoveBot by Maxichen · maxichen.de',
                sections: [{
                  title: 'Kategorien',
                  rows: HELP_CATEGORIES.map((cat) => ({
                    rowId: `cmd:help ${cat.slug}`,
                    title: `${cat.emoji} ${cat.title}`,
                    description: `${cat.cmds.length} Befehle`
                  }))
                }]
              });

              await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              logLove('help', 'Help-Übersicht mit Kategorien-Menü gesendet.', c.brightCyan);
              break;
            }
            case 'afk': {
              const mode = (args[0] || '').toLowerCase();
              if (mode === 'off' || mode === 'stop' || mode === 'end') {
                const db = readDb();
                const key = identityKey(senderJid, senderLid);
                const removed = clearAfk(db, key);
                if (!removed) {
                  const current = findAfkForIdentity(db, senderJid, senderLid);
                  if (current) clearAfk(db, current.key);
                }
                const text = '> ✅ *AFK beendet*\n\nDu bist wieder voll da! Willkommen zurück. 💙';
                await sock.sendMessage(from, { text }, { quoted: msg });
                await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
                break;
              }
              const reason = args.join(' ') || 'Kein Grund angegeben';
              const db = readDb();
              const key = identityKey(senderJid, senderLid);
              const res = setAfk(db, key, reason, { jid: senderJid, lid: senderLid });
              const afkNow = res.afk;
              const text =
                '> 💤 *AFK MODUS AKTIVIERT* 💤\n\n' +
                `@${senderLidUser} ist jetzt AFK. 😴\n` +
                `• *Grund:* ${afkNow.reason}\n` +
                `• *Seit:* ${formatDateTime(afkNow.since)}\n\n` +
                'Wenn jemand dich erwähnt oder antwortet, bekommt er einen Hinweis.\n' +
                'Sobald du etwas schreibst, kommst du automatisch zurück. 💙';
              await sock.sendMessage(from, {
                text,
                mentions: [senderLid || senderJid].filter(Boolean)
              }, { quoted: msg });
              await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              console.log(c.bold + c.brightGreen + '[afk] ' + (cleanId(senderLid || senderJid)) + ' ist jetzt AFK (' + afkNow.reason + ').' + c.reset);
              break;
            }

            case 'welcome':
            case 'goodbye':
            case 'kick':
            case 'promote':
            case 'demote': {
              if (!isGroup) {
                await sock.sendMessage(from, {
                  text: '> ❌ *Fehler:* Dieser Befehl funktioniert nur in Gruppen.'
                }, { quoted: msg });
                break;
              }
              /*
               * Dual-Modus:
               *  - "$kick on/off"  → Auto-Nachricht togglen
               *  - "$kick @user"   → echte Aktion (kick/promote/demote)
               */
              const mode = (args[0] || '').toLowerCase();

              /* Echte Aktion ausführen, wenn ein Ziel übergeben wurde */
              if (['kick', 'promote', 'demote'].includes(command) && mode !== 'on' && mode !== 'off' && args[0]) {
                if (userRole !== 'host' && userRole !== 'superadmin' && userRole !== 'admin') {
                  await sock.sendMessage(from, {
                    text: `> ⛔ *Zugriff verweigert:* Nur Admins, der Superadmin oder der Host können *${pref}${command}* ausführen.`
                  }, { quoted: msg });
                  await sendReaction(sock, from, reactions.access.reactions.unauthorized, msg.key);
                  break;
                }
                const targetRaw = args[0] || (quoted && (quoted.conversation || quoted.extendedTextMessage?.text));
                const target = await resolveBanTarget(sock, targetRaw, sessionPath);
                if (!target || !target.jid) {
                  await sock.sendMessage(from, { text: '> ❌ *Fehler:* Ziel konnte nicht aufgelöst werden.' }, { quoted: msg });
                  break;
                }
                if (cleanId(target.jid) === cleanId(senderJid)) {
                  await sock.sendMessage(from, { text: '> ❌ *Fehler:* Du kannst dich nicht selbst ändern.' }, { quoted: msg });
                  break;
                }
                let action = 'remove';
                let actLabel = 'Gekickt';
                if (command === 'promote') { action = 'promote'; actLabel = 'Zum Admin befördert'; }
                if (command === 'demote') { action = 'demote'; actLabel = 'Als Admin entfernt'; }
                try {
                  if (typeof sock.groupParticipantsUpdate === 'function') {
                    await sock.groupParticipantsUpdate(from, [target.jid], action);
                  }
                } catch (actErr) {
                  await sock.sendMessage(from, {
                    text: `> ❌ *Fehler:* ${actErr.message || actErr}`
                  }, { quoted: msg });
                  await sendReaction(sock, from, reactions.errors.reactions.error, msg.key);
                  break;
                }
                const actionType = { promote: 'promote', demote: 'demote', remove: 'remove' }[action];
                await sendGroupAutomod(sock, from, {
                  action: actionType,
                  targetId: target.jid,
                  actorId: senderJid,
                  groupSubject: groupProfile?.subject,
                  sessionPath
                });
                await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
                console.log(c.bold + c.brightGreen + `[${command}] ${actLabel}: ${target.jid} (${from}).` + c.reset);
                break;
              }

              /* Auto-Nachricht togglen */
              if (userRole !== 'host' && userRole !== 'superadmin' && userRole !== 'admin') {
                await sock.sendMessage(from, {
                  text: `> ⛔ *Zugriff verweigert:* Nur Admins, der Superadmin oder der Host können *${command}* ändern.`
                }, { quoted: msg });
                break;
              }
              if (mode !== 'on' && mode !== 'off') {
                await sock.sendMessage(from, {
                  text: `> ⚙️ *${command.toUpperCase()} EINSTELLUNG*\n\n` +
                    `Nutze *${pref}${command} on* oder *${pref}${command} off* um das Feature zu aktivieren/deaktivieren.` +
                    (['kick', 'promote', 'demote'].includes(command)
                      ? `\nMit *${pref}${command} @user* führst du die Aktion direkt aus.`
                      : '')
                }, { quoted: msg });
                break;
              }
              if (!groupProfile) {
                await sock.sendMessage(from, {
                  text: '> ❌ *Fehler:* Gruppenprofil konnte nicht geladen werden.'
                }, { quoted: msg });
                break;
              }
              const newVal = mode === 'on';
              groupProfile[command] = newVal;
              saveGroupProfile(groupProfile);
              const label = { welcome: 'Willkommens-Nachricht', goodbye: 'Abschieds-Nachricht', kick: 'Kick-Nachricht', promote: 'Beförderungs-Nachricht', demote: 'Admin-Entfernung' }[command] || command;
              const text =
                `> ⚙️ *${command.toUpperCase()} EINSTELLUNG — AKTUALISIERT* ⚙️\n\n` +
                `• *Feature:* ${label}\n` +
                `• *Status:* ${newVal ? '🟢 AKTIV' : '🔴 AUS'}\n\n` +
                `Geändert von @${senderLidUser}.`;
              await sock.sendMessage(from, {
                text,
                mentions: [senderLid || senderJid].filter(Boolean)
              }, { quoted: msg });
              await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              console.log(c.bold + c.brightGreen + `[${command}] ${label}: ${newVal ? 'an' : 'aus'} (${from}).` + c.reset);
              break;
            }

            case 'setup': {
              if (!isGroup) {
                await sock.sendMessage(from, {
                  text: '> ❌ *Fehler:* Dieser Befehl funktioniert nur in Gruppen.'
                }, { quoted: msg });
                break;
              }
              if (!isHost) {
                await sock.sendMessage(from, {
                  text: '> ⛔ *Zugriff verweigert:* Nur der Owner (Host) kann den Bot per *$setup* für eine Gruppe einrichten.'
                }, { quoted: msg });
                await sendReaction(sock, from, reactions.access.reactions.unauthorized, msg.key);
                break;
              }
              const groupId = from.replace('@g.us', '').split('@')[0].split(':')[0];
              const db = readDb();
              const setupAt = new Date().toISOString();
              const actorName = senderUn || senderLidUser || 'Owner';
              const desc = buildSetupDescription(db, groupId, setupAt, actorName);

              let descOk = false;
              try {
                if (typeof sock.groupUpdateDescription === 'function') {
                  await sock.groupUpdateDescription(from, desc);
                  descOk = true;
                }
              } catch (descErr) {}

              if (groupProfile) {
                groupProfile.setupAt = setupAt;
                groupProfile.setupBy = senderJid;
                groupProfile.setupByName = actorName;
                groupProfile.setupDescription = desc;
                groupProfile.active = true;
                groupProfile.activatedAt = setupAt;
                groupProfile.activatedBy = senderJid;
                saveGroupProfile(groupProfile);
              }

              const text =
                '> ✅ *SETUP ERFOLGREICH* ✅\n\n' +
                'LoveBot ist jetzt in *' + (groupProfile?.subject || `Gruppe ${groupId}`) + '* aktiv! 🤖\n' +
                (descOk
                  ? 'Die Gruppen-Beschreibung wurde aktualisiert.\n'
                  : '⚠️ Die Beschreibung konnte nicht gesetzt werden (fehlende Bot-Rechte?).\n') +
                '\n• *Setup gesetzt:* ' + formatDateTime(setupAt) + '\n' +
                '• *von:* ' + actorName + '\n\n' +
                'Nutze *$dsgvo* / *$verify* für weitere Infos.';
              await sock.sendMessage(from, { text }, { quoted: msg });
              await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              console.log(c.bold + c.brightGreen + '[setup] Gruppe ' + groupId + ' eingerichtet. Beschreibung ' + (descOk ? 'gesetzt' : 'FEHLER') + '.' + c.reset);
              break;
            }

            case 'system':
            case 'stats': {
              const stats = systemStats(readDb(), process.uptime() * 1000);
              const heapStats = v8.getHeapStatistics();
              const usedMem = formatMemory(heapStats.used_heap_size);
              const totalMem = formatMemory(heapStats.total_heap_size);
              const limitMem = formatMemory(heapStats.heap_size_limit);

              /* Kleine ASCII-Progressbar */
              const bar = (cur, max, len = 12) => {
                const filled = max > 0 ? Math.round((cur / max) * len) : 0;
                return '▰'.repeat(Math.min(len, filled)) + '▱'.repeat(Math.max(0, len - filled));
              };

              const totalUsers = Math.max(1, stats.totalUsers);
              const totalGroups = Math.max(1, stats.totalGroups);
              const regPct = Math.round((stats.registeredUsers / totalUsers) * 100);
              const verPct = Math.round((stats.verifiedUsers / totalUsers) * 100);
              const activePct = Math.round((stats.activeGroups / totalGroups) * 100);
              const setupPct = Math.round((stats.setupGroups / totalGroups) * 100);

              const text =
                '╔══════════════════════════════╗\n' +
                '║   🤖  LOVE BOT  ·  SYSTEM   ║\n' +
                '╚══════════════════════════════╝\n\n' +
                '⏱️ *Uptime*  ›  ' + stats.uptime + '\n' +
                '🛡️ *Status*  ›  ' + '🟢 ONLINE\n\n' +
                '━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
                '👤 *NUTZER*\n' +
                '   Gesamt  ›  *' + stats.totalUsers + '*\n' +
                '   ├ 📝 Registriert  ›  ' + stats.registeredUsers + `  (${regPct}%)\n` +
                '   │   ' + bar(stats.registeredUsers, totalUsers) + '\n' +
                '   └ ✅ Verifiziert  ›  ' + stats.verifiedUsers + `  (${verPct}%)\n` +
                '       ' + bar(stats.verifiedUsers, totalUsers) + '\n\n' +
                '👥 *GRUPPEN*\n' +
                '   Gesamt  ›  *' + stats.totalGroups + '*\n' +
                '   ├ 🟢 Aktiv  ›  ' + stats.activeGroups + `  (${activePct}%)\n` +
                '   │   ' + bar(stats.activeGroups, totalGroups) + '\n' +
                '   ├ 🔴 Inaktiv  ›  ' + stats.inactiveGroups + '\n' +
                '   └ 🛠️ Setup  ›  ' + stats.setupGroups + `  (${setupPct}%)\n` +
                '       ' + bar(stats.setupGroups, totalGroups) + '\n\n' +
                '⚡ *SONSTIGES*\n' +
                '   💤 AFK  ›  ' + stats.totalAfk + '\n' +
                '   🚫 Bans  ›  ' + stats.totalBans + '\n\n' +
                '🧠 *RESSOURCEN*\n' +
                '   💾 RAM  ›  ' + usedMem + ' (von ' + totalMem + ')\n' +
                '   🎛️ Limit ›  ' + limitMem + '\n\n' +
                '━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
                '💙 LoveBot läuft und liebt dich! 💙';

              await sock.sendMessage(from, { text }, { quoted: msg });
              await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              console.log(c.bold + c.brightGreen + '[system] Statistiken gesendet.' + c.reset);
              break;
            }

            case 'ban': {
              if (!isHost) {
                await sock.sendMessage(from, {
                  text: '> ⛔ *Zugriff verweigert:* Nur der Owner kann einen Ban aussprechen.'
                }, { quoted: msg });
                await sendReaction(sock, from, reactions.access.reactions.unauthorized, msg.key);
                break;
              }
              const targetRaw = args[0] || (quoted && (quoted.conversation || quoted.extendedTextMessage?.text));
              const reason = args.slice(1).join(' ') || 'Kein Grund angegeben';
              if (!targetRaw) {
                await sock.sendMessage(from, {
                  text: '> 🚫 *BAN — VERWENDUNG*\n\n' +
                    `Nutze: *${pref}ban <id|@user|nummer> <grund>*\n\n` +
                    '*Beispiele:*\n' +
                    `• ${pref}ban 1234567890@lid Spam\n` +
                    `• ${pref}ban 491234567890@s.whatsapp.net Beleidigung\n` +
                    `• ${pref}ban @user Betrug`
                }, { quoted: msg });
                break;
              }
              const target = await resolveBanTarget(sock, targetRaw, sessionPath);
              if (!target || !target.jid) {
                await sock.sendMessage(from, {
                  text: '> ❌ *Fehler:* Ziel konnte nicht aufgelöst werden.'
                }, { quoted: msg });
                break;
              }
              /* 1) Benachrichtigung an die Person (PN) — VOR dem Blockieren,
                 sonst kommt die Nachricht nie an! */
              const banNotifJid = (target.jid && target.jid.includes('@')) ? target.jid : `${cleanId(target.jid || target.lid || '')}@s.whatsapp.net`;
              const banNotif =
                '> 🚫 *DU WURDEST GEBANNT* 🚫\n\n' +
                `Du wurdest von @${senderLidUser} gebannt.\n` +
                `*Grund:* ${reason}\n\n` +
                'Kontaktiere den Owner für weitere Informationen.';
              let pnOk = false;
              try {
                await sock.sendMessage(banNotifJid, {
                  text: banNotif,
                  mentions: [senderLid || senderJid].filter(Boolean)
                });
                pnOk = true;
              } catch (e) {
                try {
                  await sock.sendMessage(banNotifJid, { text: banNotif });
                  pnOk = true;
                } catch (e2) {}
              }

              /* 2) Danach blockieren */
              try {
                if (typeof sock.updateBlockStatus === 'function') {
                  await sock.updateBlockStatus(target.jid, 'block');
                }
              } catch (e) {}

              /* 3) Aus allen Gruppen entfernen */
              const removedGroups = await removeFromAllGroups(sock, target.jid);

              /* 4) In DB sichern */
              banUser(readDb(), {
                jid: target.jid,
                lid: target.lid,
                reason,
                actorJid: senderJid,
                actorLid: senderLid,
                actorName: senderUn || senderLidUser
              });

              const pnStatus = pnOk ? '✓ PN gesendet' : '⚠️ PN fehlgeschlagen (kein Chat)';

              const text =
                '> 🚫 *BAN ERFOLGREICH* 🚫\n\n' +
                `• *Gebannt JID:* ${target.jid || '—'}\n` +
                `• *Gebannt LID:* ${target.lid || '—'}\n` +
                `• *Grund:* ${reason}\n` +
                `• *Von:* @${senderLidUser}\n` +
                `• *Benachrichtigung:* ${pnStatus}\n` +
                `• *Aus ${removedGroups.length} Gruppen entfernt.*\n\n` +
                'Reihenfolge: PN gesendet → blockiert → gekickt. ✅';
              await sock.sendMessage(from, {
                text,
                mentions: [senderLid || senderJid].filter(Boolean)
              }, { quoted: msg });
              await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              console.log(c.bold + c.brightGreen + '[ban] ' + target.jid + ' gebannt (' + reason + ').' + c.reset);
              break;
            }

            case 'unban':
            case 'unbann': {
              if (!isHost) {
                await sock.sendMessage(from, {
                  text: '> ⛔ *Zugriff verweigert:* Nur der Owner kann einen Ban aufheben.'
                }, { quoted: msg });
                await sendReaction(sock, from, reactions.access.reactions.unauthorized, msg.key);
                break;
              }
              const targetRaw = args[0] || (quoted && (quoted.conversation || quoted.extendedTextMessage?.text));
              const reason = args.slice(1).join(' ') || 'Kein Grund angegeben';
              if (!targetRaw) {
                await sock.sendMessage(from, {
                  text: '> 💙 *UNBAN — VERWENDUNG*\n\n' +
                    `Nutze: *${pref}unban <id|@user|nummer> <grund>*`
                }, { quoted: msg });
                break;
              }
              const target = await resolveBanTarget(sock, targetRaw, sessionPath);
              if (!target || !target.jid) {
                await sock.sendMessage(from, {
                  text: '> ❌ *Fehler:* Ziel konnte nicht aufgelöst werden.'
                }, { quoted: msg });
                break;
              }
              const found = isUserBanned(readDb(), target.jid, target.lid);
              if (!found) {
                await sock.sendMessage(from, {
                  text: '> ℹ️ *Diese Person ist nicht gebannt.*'
                }, { quoted: msg });
                break;
              }
              /* Entbannen */
              unbanUser(readDb(), target.jid, target.lid);
              /* Entblocken VOR der Nachricht (sonst kommt sie nicht an) */
              try {
                if (typeof sock.updateBlockStatus === 'function') {
                  await sock.updateBlockStatus(target.jid, 'unblock');
                }
              } catch (e) {}
              /* Benachrichtigung */
              const unbanNotifJid = (target.jid && target.jid.includes('@')) ? target.jid : `${cleanId(target.jid || target.lid || '')}@s.whatsapp.net`;
              const unbanNotif =
                '> 💙 *DU WURDEST ENTBANNT* 💙\n\n' +
                `Du wurdest vom Owner entbannt.\n` +
                `*Grund:* ${reason}\n\n` +
                'Sorry für das Missverständnis! 😅\n' +
                'Frag die Admins der Gruppen, ob sie dich wieder aufnehmen können, wenn du willst.\n' +
                'Viele liebe Grüße 💌';
              try {
                await sock.sendMessage(unbanNotifJid, { text: unbanNotif });
              } catch (e) {
                try { await sock.sendMessage(unbanNotifJid, { text: unbanNotif }); } catch (e2) {}
              }
              const text =
                '> 💙 *UNBAN ERFOLGREICH* 💙\n\n' +
                `• *Entbannt:* ${target.jid || target.lid}\n` +
                `• *Grund:* ${reason}\n` +
                `• *Von:* @${senderLidUser}\n\n` +
                'Die Person wurde entblockiert und kann den Bot wieder nutzen.';
              await sock.sendMessage(from, {
                text,
                mentions: [senderLid || senderJid].filter(Boolean)
              }, { quoted: msg });
              await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              console.log(c.bold + c.brightGreen + '[unban] ' + target.jid + ' entbannt (' + reason + ').' + c.reset);
              break;
            }

            case 'banlist': {
              if (!isHost) {
                await sock.sendMessage(from, {
                  text: '> ⛔ *Zugriff verweigert:* Nur der Owner kann die Banliste sehen.'
                }, { quoted: msg });
                await sendReaction(sock, from, reactions.access.reactions.unauthorized, msg.key);
                break;
              }
              const bans = listBans(readDb());
              if (!bans.length) {
                await sock.sendMessage(from, {
                  text: '> 🚫 *BANLISTE*\n\nEs sind keine Nutzer gebannt. 🎉'
                }, { quoted: msg });
                break;
              }
              const lines = bans.map((b, i) =>
                `${i + 1}. ${b.jid || b.lid}\n   • *Grund:* ${b.reason}\n   • *Gebannt:* ${formatDateTimeShort(b.bannedAt)}\n   • *Von:* ${b.bannedByName || b.bannedBy || 'Owner'}`
              );
              const text =
                '> 🚫 *BANLISTE* 🚫\n\n' +
                `*${bans.length} gebannte Nutzer:*\n\n` +
                lines.join('\n\n');
              await sock.sendMessage(from, { text }, { quoted: msg });
              await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              console.log(c.bold + c.brightGreen + '[banlist] ' + bans.length + ' Einträge gesendet.' + c.reset);
              break;
            }

            case 'info':
            case 'botinfo': {
              const text =
                '> 🤖 *LOVE BOT — INFO* 🤖\n\n' +
                `• *Name:* LoveBot\n` +
                `• *Version:* 1.0.0\n` +
                `• *Prefix:* \`${pref}\`\n` +
                `• *Plattform:* Node.js · Baileys\n` +
                `• *Owner:* Maxichen\n` +
                `• *Website:* maxichen.de\n\n` +
                '🔧 *Features:*\n' +
                '• AFK mit Auto-Comeback\n' +
                '• Auto-Welcome/Goodbye/Kick/Promote/Demote\n' +
                '• Setup, Ban/Unban/Banlist\n' +
                '• Medien-, AI- & Link-Tools\n\n' +
                '*Tipp:* ' + pref + 'menunew zeigt das interaktive Menü.';
              await sock.sendMessage(from, { text }, { quoted: msg });
              await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              break;
            }

            case 'id': {
              let chatType = 'Privatchat';
              if (isGroup) chatType = 'Gruppe';
              const groupNum = from.endsWith('@g.us') ? cleanId(from) : '';
              const text =
                '> 🆔 *LOVE BOT — ID INFO* 🆔\n\n' +
                `• *Chat-Typ:* ${chatType}\n` +
                `• *Chat ID:* ${from}\n` +
                (groupNum ? `• *Gruppen-ID:* ${groupNum}\n` : '') +
                `• *Deine JID:* ${senderJid}\n` +
                `• *Deine LID:* ${senderLid}\n` +
                `• *Bot JID:* ${normalizeJid(sock.user?.id || '')}\n` +
                `• *Bot LID:* ${normalizeLid(sock.user?.lid || '')}`;
              await sock.sendMessage(from, { text }, { quoted: msg });
              await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              break;
            }

            case 'groupinfo':
            case 'gcinfo': {
              if (!isGroup) {
                await sock.sendMessage(from, { text: '> ❌ *Fehler:* Dieser Befehl funktioniert nur in Gruppen.' }, { quoted: msg });
                break;
              }
              const participants = (groupMetadata && Array.isArray(groupMetadata.participants)) ? groupMetadata.participants : [];
              const admins = participants.filter((p) => p && ['admin', 'superadmin'].includes(p.admin)).length;
              const descText = groupMetadata?.desc || 'Keine Beschreibung';
              const gDb = readDb();
              const gf = gDb.groups?.[cleanId(from)];
              /* 🆔 Owner als JID + LID auflösen */
              let groupOwnerIds = null;
              try {
                const ownerRaw = groupMetadata?.owner || '';
                if (ownerRaw) {
                  const ownerResolved = await resolveBanTarget(sock, ownerRaw, sessionPath);
                  groupOwnerIds = {
                    jid: ownerResolved?.jid || (String(ownerRaw).endsWith('@lid') ? '—' : ownerRaw),
                    lid: ownerResolved?.lid || (String(ownerRaw).endsWith('@lid') ? ownerRaw : '—')
                  };
                }
              } catch (ownerResolveErr) {}
              const text =
                '> 👥 *GRUPPEN INFO* 👥\n\n' +
                `• *Name:* ${groupMetadata?.subject || 'Ohne Name'}\n` +
                `• *ID:* ${cleanId(from)}\n` +
                `• *Mitglieder:* ${participants.length}\n` +
                `• *Admins:* ${admins}\n` +
                `• *Owner:* ${groupMetadata?.owner || 'Unbekannt'}\n` +
                (groupOwnerIds ? `• *Owner JID:* ${groupOwnerIds.jid}\n• *Owner LID:* ${groupOwnerIds.lid}\n` : '') +
                `• *Bot aktiv:* ${gf?.active ? '🟢 Ja' : '🔴 Nein'}\n` +
                `• *Setup:* ${gf?.setupAt ? '✅ ' + formatDateTime(gf.setupAt) : '❌ Nicht eingerichtet'}\n` +
                '━━━━━━━━━━━━━━━━━━━━\n' +
                `📜 *Beschreibung:* ${descText.length > 900 ? descText.slice(0, 900) + '…' : descText}`;
              await sock.sendMessage(from, { text }, { quoted: msg });
              await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              break;
            }

            case 'rules': {
              if (!isGroup) {
                await sock.sendMessage(from, { text: '> ❌ *Fehler:* Dieser Befehl funktioniert nur in Gruppen.' }, { quoted: msg });
                break;
              }
              const groupId = cleanId(from);
              const gDb = readDb();
              const gf = gDb.groups?.[groupId];
              const oldRules = gf?.rules || 'Es wurden noch keine Regeln festgelegt.';
              const newRules = args.join(' ');
              if (newRules) {
                if (userRole !== 'host' && userRole !== 'superadmin' && userRole !== 'admin') {
                  await sock.sendMessage(from, { text: '> ⛔ *Zugriff verweigert:* Nur Admins können Regeln setzen.' }, { quoted: msg });
                  break;
                }
                if (groupProfile) {
                  groupProfile.rules = newRules;
                  saveGroupProfile(groupProfile);
                }
                await sock.sendMessage(from, {
                  text: '> ✅ *REGELN GESPEICHERT*\n\n' + newRules + '\n\n*Gesetzt von @' + senderLidUser + '.',
                  mentions: [senderLid || senderJid].filter(Boolean)
                }, { quoted: msg });
                await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              } else {
                await sock.sendMessage(from, {
                  text: '> 📜 *GRUPPENREGELN*\n\n' + oldRules + '\n\n*Tipp:* ' + pref + 'rules <regeln> setzt Neue.'
                }, { quoted: msg });
                await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              }
              break;
            }

            case 'afklist': {
              const db = readDb();
              const afkEntries = Object.entries(db.afk || {}).map(([k, v]) => ({ key: k, ...v }))
                .sort((a, b) => String(a.since || '').localeCompare(String(b.since || '')));
              if (!afkEntries.length) {
                await sock.sendMessage(from, { text: '> 💤 *AFK-LISTE*\n\nNiemand ist aktuell AFK. 🎉' }, { quoted: msg });
                break;
              }
              const lines = afkEntries.map((e, i) =>
                `${i + 1}. @${cleanId(e.lid || e.jid || e.key)} 😴\n   • *Seit:* ${formatDateTimeShort(e.since)}\n   • *Grund:* ${e.reason}`
              );
              await sock.sendMessage(from, {
                text: '> 💤 *AFK-LISTE* 💤\n\n*' + afkEntries.length + '* Personen AFK:\n\n' + lines.join('\n\n'),
                mentions: afkEntries.map((e) => (e.lid || e.jid)).filter(Boolean)
              }, { quoted: msg });
              await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              break;
            }

            case 'date':
            case 'today':
            case 'time': {
              const now = new Date();
              const text =
                '> 📅 *DATUM & UHRZEIT* ⏰\n\n' +
                `• *Datum:* ${now.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}\n` +
                `• *Uhrzeit:* ${now.toLocaleTimeString('de-DE')}\n` +
                `• *Zeitzone:* ${Intl.DateTimeFormat().resolvedOptions().timeZone}\n` +
                `• *ISO:* ${now.toISOString()}`;
              await sock.sendMessage(from, { text }, { quoted: msg });
              await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              break;
            }

            case 'calc': {
              const expr = args.join(' ');
              if (!expr) {
                await sock.sendMessage(from, {
                  text: '> 🧮 *RECHNER*\n\n' + `Nutze: *${pref}calc <ausdruck>*\n\nBeispiel: ${pref}calc (2+3)*4`
                }, { quoted: msg });
                break;
              }
              const safe = String(expr).replace(/\^/g, '**');
              if (!/^[0-9+\-*/%(). ,e]+$/.test(safe.replace(/\*\*/g, ''))) {
                await sock.sendMessage(from, { text: '> ❌ *Ungültiger Ausdruck.*' }, { quoted: msg });
                break;
              }
              let result = '';
              let ok = false;
              try {
                const val = Function(`"use strict"; return (${safe});`)();
                result = typeof val === 'number' ? (Number.isFinite(val) ? (Math.round(val * 1e6) / 1e6).toString() : '∞/NaN') : String(val);
                ok = true;
              } catch (e) { result = 'Fehler'; }
              await sock.sendMessage(from, {
                text: `> 🧮 *RECHNER*\n\n${expr}\n= *${result}*`
              }, { quoted: msg });
              await sendReaction(sock, from, ok ? reactions.completion.reactions.withoutAnyProblems : reactions.errors.reactions.error, msg.key);
              break;
            }

            case 'reverse': {
              const inp = args.join(' ') || (quoted && (quoted.conversation || quoted.extendedTextMessage?.text));
              if (!inp) {
                await sock.sendMessage(from, { text: '> 🔁 *Umkehren*\n\n' + `Nutze: *${pref}reverse <text>*` }, { quoted: msg });
                break;
              }
              await sock.sendMessage(from, { text: `> 🔁 *UMGEKEHRT*\n\n` + [...inp].reverse().join('') }, { quoted: msg });
              await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              break;
            }

            case 'random': {
              const m = args[0] ? args[0].match(/^(\d+)\s*[-–/]\s*(\d+)$/) : null;
              const lo = m ? parseInt(m[1], 10) : 1;
              const hi = m ? parseInt(m[2], 10) : 100;
              if (hi <= lo) {
                await sock.sendMessage(from, { text: '> ❌ *Ungültiger Bereich.*' }, { quoted: msg });
                break;
              }
              const n = Math.floor(Math.random() * (hi - lo + 1)) + lo;
              await sock.sendMessage(from, {
                text: `> 🎲 *ZUFALL*\n\nVon *${lo}* bis *${hi}*:\n${n}`
              }, { quoted: msg });
              await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              break;
            }

            case 'dice': {
              const n = Math.floor(Math.random() * 6) + 1;
              const diceFace = {
                1: '⚀', 2: '⚁', 3: '⚂', 4: '⚃', 5: '⚄', 6: '⚅'
              }[n];
              await sock.sendMessage(from, {
                text: `> 🎲 *WÜRFEL*\n\n${diceFace}  →  *${n}*`
              }, { quoted: msg });
              await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              break;
            }

            case 'coin':
            case 'münze': {
              const side = Math.random() < 0.5 ? 'KOPF 🪙' : 'ZAHL 🪙';
              await sock.sendMessage(from, { text: `> 🪙 *MÜNZWURF*\n\n*${side}*` }, { quoted: msg });
              await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              break;
            }

            case 'truth': {
              const pool = [
                'Was ist dir peinlichstes Erlebnis?',
                'Wen bewunderst du am meisten?',
                'Wann hast du zuletzt gelogen?',
                'Was war dein größter Fehler?',
                'Was ist dein geheimster Wunsch?',
                'Wen würdest du im Raum am liebsten tragen?',
                'Was ist das Lustigste, das dir je passiert ist?',
                'Nenn eine Schwäche, die niemand kennt.'
              ];
              await sock.sendMessage(from, {
                text: '> 🙊 *WAHRHEIT*\n\n' + pool[Math.floor(Math.random() * pool.length)]
              }, { quoted: msg });
              await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              break;
            }

            case 'dare': {
              const pool = [
                'Sing 10 Sekunden laut!',
                'Sende ein Selfie!',
                'Lass jemanden dein Profil wählen!',
                'Mach 20 Kniebeugen!',
                'Erzähl einen Witz!',
                'Nachahme dein Haustier!',
                'Gib jemandem ein Kompliment!',
                'Sende deiner Mama „Ich liebe dich“!'
              ];
              await sock.sendMessage(from, {
                text: '> 😈 *WAHRHEIT/KUGELEICH ... PF.LICHT* 😈\n\n' + pool[Math.floor(Math.random() * pool.length)]
              }, { quoted: msg });
              await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              break;
            }

            case 'quote':
            case 'zitat': {
              const pool = [
                'Das Leben ist das, was passiert, während du andere Pläne machst. — John Lennon',
                'Wer nicht wagt, der nicht gewinnt.',
                'Gib niemals auf, was du wirklich willst.',
                'Träume groß und scheitere mutig.',
                'Der Weg ist das Ziel.',
                'Was du heute kannst besorgen, das verschiebe nicht auf morgen.',
                'Die beste Zeit für einen Neuanfang ist jetzt.'
              ];
              await sock.sendMessage(from, {
                text: '> 🔖 *ZITAT DES TAGES*\n\n' + pool[Math.floor(Math.random() * pool.length)]
              }, { quoted: msg });
              await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              break;
            }

            case 'say': {
              const sayText = args.join(' ') || (quoted && (quoted.conversation || quoted.extendedTextMessage?.text));
              if (!sayText) {
                await sock.sendMessage(from, { text: '> 🗣️ *BOT SAGT*\n\n' + `Nutze: *${pref}say <text>*` }, { quoted: msg });
                break;
              }
              await sock.sendMessage(from, { text: sayText }, { quoted: msg });
              await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              break;
            }

            case 'add': {
              if (!isGroup) {
                await sock.sendMessage(from, { text: '> ❌ *Fehler:* Dieser Befehl funktioniert nur in Gruppen.' }, { quoted: msg });
                break;
              }
              if (userRole !== 'host' && userRole !== 'superadmin' && userRole !== 'admin') {
                await sock.sendMessage(from, { text: '> ⛔ *Zugriff verweigert:* Nur Admins können Nutzer hinzufügen.' }, { quoted: msg });
                break;
              }
              const numbers = args.join(' ').replace(/[@\s]/g, ',').split(/[,;]/).map((n) => n.trim()).filter((n) => n && /^\d+$/.test(n));
              if (!numbers.length) {
                await sock.sendMessage(from, { text: '> ➕ *NUTZER HINZUFÜGEN*\n\n' + `Nutze: *${pref}add <nummer> <nummer> …* (zwischen 4912… und 491234567890)` }, { quoted: msg });
                break;
              }
              const added = [];
              const failed = [];
              for (const num of numbers) {
                const jid = (num.startsWith('0')) ? num.replace(/^0/, '').replace(/^(\d{2})/, ($0, $1) => $1) : num;
                const full = `${jid.replace(/[^\d]/g, '')}@s.whatsapp.net`;
                try {
                  if (typeof sock.groupParticipantsUpdate === 'function') {
                    await sock.groupParticipantsUpdate(from, [full], 'add');
                    added.push(full);
                  }
                } catch (e) {
                  failed.push(full);
                }
              }
              await sock.sendMessage(from, {
                text: `> ➕ *NUTZER HINZUGEFÜGT*\n\n✅ *${added.length}* hinzugefügt:\n${added.join('\n')}${failed.length ? '\n\n❌ Fehler bei:\n' + failed.join('\n') : ''}`
              }, { quoted: msg });
              await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              break;
            }

            case 'delete':
            case 'del': {
              if (!quoted || !quoted.key) {
                await sock.sendMessage(from, { text: '> 🗑️ *LÖSCHEN*\n\n' + `Zitiere eine Nachricht und nutze *${pref}delete* um sie zu löschen.` }, { quoted: msg });
                break;
              }
              try {
                await sock.sendMessage(from, { delete: quoted.key });
                await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              } catch (e) {
                await sock.sendMessage(from, { text: '> ❌ *Fehler:* Nachricht löschen fehlgeschlagen. Benötigt Admin-Rechte.' }, { quoted: msg });
              }
              break;
            }

            case 'mute': {
              if (!isGroup) {
                await sock.sendMessage(from, { text: '> ❌ *Fehler:* Dieser Befehl funktioniert nur in Gruppen.' }, { quoted: msg });
                break;
              }
              if (userRole !== 'host' && userRole !== 'superadmin' && userRole !== 'admin') {
                await sock.sendMessage(from, { text: '> ⛔ *Zugriff verweigert:* Nur Admins können die Gruppe stummschalten.' }, { quoted: msg });
                break;
              }
              let duration = '0'; /* permanent? WhatsApp braucht endliche Werte; wir nutzen 86400=1d Standard */
              const inp = (args[0] || '').toLowerCase();
              if (inp && /^\d+$/.test(inp)) duration = inp;
              const seconds = parseInt(duration, 10) || 86400;
              try {
                if (typeof sock.groupSettingUpdate === 'function') {
                  await sock.groupSettingUpdate(from, 'announcement');
                  await sock.sendMessage(from, { text: `> 🔇 *GRUPPE STUMMGESCHALTET*\n\nNur Admins können schreiben. (${seconds}s)\n\n*von:* @${senderLidUser}` }, { quoted: msg, mentions: [senderLid || senderJid].filter(Boolean) });
                } else {
                  await sock.sendMessage(from, { text: '> ❌ *Fehler:* groupSettingUpdate wird von dieser Clients-Version nicht unterstützt.' }, { quoted: msg });
                }
              } catch (e) {
                await sock.sendMessage(from, { text: '> ❌ *Fehler:* ' + (e.message || e) }, { quoted: msg });
              }
              await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              break;
            }

            case 'unmute': {
              if (!isGroup) {
                await sock.sendMessage(from, { text: '> ❌ *Fehler:* Dieser Befehl funktioniert nur in Gruppen.' }, { quoted: msg });
                break;
              }
              if (userRole !== 'host' && userRole !== 'superadmin' && userRole !== 'admin') {
                await sock.sendMessage(from, { text: '> ⛔ *Zugriff verweigert:* Nur Admins können die Gruppe entsperren.' }, { quoted: msg });
                break;
              }
              try {
                if (typeof sock.groupSettingUpdate === 'function') {
                  await sock.groupSettingUpdate(from, 'not_announcement');
                  await sock.sendMessage(from, { text: `> 🔊 *GRUPPE ENTSPERRT*\n\nAlle Mitglieder dürfen wieder schreiben. *von:* @${senderLidUser}` }, { quoted: msg, mentions: [senderLid || senderJid].filter(Boolean) });
                }
              } catch (e) {
                await sock.sendMessage(from, { text: '> ❌ *Fehler:* ' + (e.message || e) }, { quoted: msg });
              }
              await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              break;
            }

            case 'link':
            case 'grouplink': {
              if (!isGroup) {
                await sock.sendMessage(from, { text: '> ❌ *Fehler:* Dieser Befehl funktioniert nur in Gruppen.' }, { quoted: msg });
                break;
              }
              try {
                if (typeof sock.groupInviteCode === 'function') {
                  const code = await sock.groupInviteCode(from);
                  await sock.sendMessage(from, { text: `> 🔗 *GRUPPEN-LINK*\n\nhttps://chat.whatsapp.com/${code}` }, { quoted: msg });
                }
              } catch (e) {
                await sock.sendMessage(from, { text: '> ❌ *Fehler:* Einladung abrufen fehlgeschlagen. Benötigt Admin-Rechte.' }, { quoted: msg });
              }
              await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              break;
            }

            case 'revoke':
            case 'revokelink': {
              if (!isGroup) {
                await sock.sendMessage(from, { text: '> ❌ *Fehler:* Dieser Befehl funktioniert nur in Gruppen.' }, { quoted: msg });
                break;
              }
              if (userRole !== 'host' && userRole !== 'superadmin' && userRole !== 'admin') {
                await sock.sendMessage(from, { text: '> ⛔ *Zugriff verweigert:* Nur Admins können den Link zurückziehen.' }, { quoted: msg });
                break;
              }
              try {
                if (typeof sock.groupRevokeInvite === 'function') {
                  await sock.groupRevokeInvite(from);
                  await sock.sendMessage(from, { text: '> 🔄 *LINK ZURÜCKGEZOGEN*\n\nDer alte Einladungslink ist ungültig.\n*Neuen Link:* ' + pref + 'link' }, { quoted: msg });
                }
              } catch (e) {
                await sock.sendMessage(from, { text: '> ❌ *Fehler:* ' + (e.message || e) }, { quoted: msg });
              }
              await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              break;
            }

            case 'setname':
            case 'gname': {
              if (!isGroup) {
                await sock.sendMessage(from, { text: '> ❌ *Fehler:* Dieser Befehl funktioniert nur in Gruppen.' }, { quoted: msg });
                break;
              }
              if (userRole !== 'host' && userRole !== 'superadmin' && userRole !== 'admin') {
                await sock.sendMessage(from, { text: '> ⛔ *Zugriff verweigert:* Nur Admins können den Namen ändern.' }, { quoted: msg });
                break;
              }
              const newName = args.join(' ').trim();
              if (!newName) {
                await sock.sendMessage(from, { text: '> ✏️ *NAME ÄNDERN*\n\n' + `Nutze: *${pref}setname <name>*` }, { quoted: msg });
                break;
              }
              try {
                if (typeof sock.groupUpdateSubject === 'function') {
                  await sock.groupUpdateSubject(from, newName);
                  await sock.sendMessage(from, { text: `> ✏️ *GRUPPENNAME GEÄNDERT*\n\n*${newName}*\n*von:* @${senderLidUser}` }, { quoted: msg, mentions: [senderLid || senderJid].filter(Boolean) });
                }
              } catch (e) {
                await sock.sendMessage(from, { text: '> ❌ *Fehler:* ' + (e.message || e) }, { quoted: msg });
              }
              await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              break;
            }

            case 'setdesc':
            case 'gdesc': {
              if (!isGroup) {
                await sock.sendMessage(from, { text: '> ❌ *Fehler:* Dieser Befehl funktioniert nur in Gruppen.' }, { quoted: msg });
                break;
              }
              if (userRole !== 'host' && userRole !== 'superadmin' && userRole !== 'admin') {
                await sock.sendMessage(from, { text: '> ⛔ *Zugriff verweigert:* Nur Admins können die Beschreibung ändern.' }, { quoted: msg });
                break;
              }
              const newDesc = args.join(' ').trim();
              if (!newDesc) {
                await sock.sendMessage(from, { text: '> ✏️ *BESCHREIBUNG ÄNDERN*\n\n' + `Nutze: *${pref}setdesc <text>*` }, { quoted: msg });
                break;
              }
              try {
                if (typeof sock.groupUpdateDescription === 'function') {
                  await sock.groupUpdateDescription(from, newDesc);
                  await sock.sendMessage(from, { text: `> ✏️ *GRUPPEN-BESCHREIBUNG GEÄNDERT*\n\n${newDesc}\n\n*von:* @${senderLidUser}` }, { quoted: msg, mentions: [senderLid || senderJid].filter(Boolean) });
                }
              } catch (e) {
                await sock.sendMessage(from, { text: '> ❌ *Fehler:* ' + (e.message || e) }, { quoted: msg });
              }
              await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              break;
            }

            case 'warn': {
              if (!isGroup) {
                await sock.sendMessage(from, { text: '> ❌ *Fehler:* Dieser Befehl funktioniert nur in Gruppen.' }, { quoted: msg });
                break;
              }
              if (userRole !== 'host' && userRole !== 'superadmin' && userRole !== 'admin') {
                await sock.sendMessage(from, { text: '> ⛔ *Zugriff verweigert:* Nur Admins können Verwarnungen austeilen.' }, { quoted: msg });
                break;
              }
              const targetRaw = args[0] || (quoted && (msg.message?.extendedTextMessage?.contextInfo?.participant || msg.message?.extendedTextMessage?.contextInfo?.remoteJid));
              const warnReason = args.slice(1).join(' ') || 'Kein Grund';
              if (!targetRaw) {
                await sock.sendMessage(from, { text: '> ⚠️ *VERWARNUNG*\n\n' + `Nutze: *${pref}warn @user <grund>*` }, { quoted: msg });
                break;
              }
              const target = await resolveBanTarget(sock, targetRaw, sessionPath);
              if (!target || !target.jid) {
                await sock.sendMessage(from, { text: '> ❌ *Fehler:* Ziel nicht auflösbar.' }, { quoted: msg });
                break;
              }
              if (!groupProfile) {
                await sock.sendMessage(from, { text: '> ❌ *Fehler:* Gruppenprofil nicht ladbar.' }, { quoted: msg });
                break;
              }
              if (!groupProfile.warns || typeof groupProfile.warns !== 'object') groupProfile.warns = {};
              const wk = cleanId(target.jid);
              if (!groupProfile.warns[wk]) groupProfile.warns[wk] = [];
              groupProfile.warns[wk].push({ reason: warnReason, by: senderJid, at: new Date().toISOString() });
              saveGroupProfile(groupProfile);
              const count = groupProfile.warns[wk].length;
              await sock.sendMessage(from, {
                text: `> ⚠️ *VERWARNUNG (#${count})*\n\n@${cleanId(target.jid)} hat eine Verwarnung erhalten.\n*Grund:* ${warnReason}\n\n` +
                  `• *JID:* ${target.jid || '—'}\n` +
                  `• *LID:* ${target.lid || '—'}\n\n` +
                  `*von:* @${senderLidUser}`,
                mentions: [target.jid, senderLid || senderJid].filter(Boolean)
              }, { quoted: msg });
              await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              break;
            }

            case 'unwarn': {
              if (!isGroup) {
                await sock.sendMessage(from, { text: '> ❌ *Fehler:* Dieser Befehl funktioniert nur in Gruppen.' }, { quoted: msg });
                break;
              }
              if (userRole !== 'host' && userRole !== 'superadmin' && userRole !== 'admin') {
                await sock.sendMessage(from, { text: '> ⛔ *Zugriff verweigert:* Nur Admins können Verwarnungen entfernen.' }, { quoted: msg });
                break;
              }
              const targetRaw = args[0] || (quoted && (msg.message?.extendedTextMessage?.contextInfo?.participant || msg.message?.extendedTextMessage?.contextInfo?.remoteJid));
              if (!targetRaw) {
                await sock.sendMessage(from, { text: '> ✅ *VERWARNUNG ENTFERNEN*\n\n' + `Nutze: *${pref}unwarn @user*` }, { quoted: msg });
                break;
              }
              const target = await resolveBanTarget(sock, targetRaw, sessionPath);
              if (!target || !target.jid) {
                await sock.sendMessage(from, { text: '> ❌ *Fehler:* Ziel nicht auflösbar.' }, { quoted: msg });
                break;
              }
              if (groupProfile && groupProfile.warns && groupProfile.warns[cleanId(target.jid)]) {
                const count = groupProfile.warns[cleanId(target.jid)].length;
                delete groupProfile.warns[cleanId(target.jid)];
                saveGroupProfile(groupProfile);
                await sock.sendMessage(from, { text: `> ✅ *VERWARNUNG ENTFERNT*\n\n@${cleanId(target.jid)} hat ${count} Verwarnung(en) verloren.` }, { quoted: msg, mentions: [target.jid].filter(Boolean) });
              } else {
                await sock.sendMessage(from, { text: '> ℹ️ *Diese Person hat keine Verwarnungen.*' }, { quoted: msg });
              }
              await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              break;
            }

            case 'warns': {
              const targetRaw = args[0] || (quoted && (msg.message?.extendedTextMessage?.contextInfo?.participant || msg.message?.extendedTextMessage?.contextInfo?.remoteJid)) || senderJid;
              const target = await resolveBanTarget(sock, targetRaw, sessionPath);
              const wk = target ? cleanId(target.jid) : cleanId(senderJid);
              const w = (groupProfile && groupProfile.warns && groupProfile.warns[wk]) ? groupProfile.warns[wk] : [];
              const lines = w.length
                ? w.map((x, i) => `${i + 1}. ${x.reason} (${x.by ? '@' + cleanId(x.by) : '?'}, ${formatDateTimeShort(x.at)})`)
                : ['Keine Verwarnungen.'];
              await sock.sendMessage(from, { text: `> 🗂️ *VERWARNUNGEN* (${w.length})\n\n@${wk}:\n\n${lines.join('\n')}` }, { quoted: msg, mentions: [`${wk}@s.whatsapp.net`].filter(Boolean) });
              await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              break;
            }

            case 'tagadmin':
            case 'admins': {
              if (!isGroup) {
                await sock.sendMessage(from, { text: '> ❌ *Fehler:* Dieser Befehl funktioniert nur in Gruppen.' }, { quoted: msg });
                break;
              }
              const participants = (groupMetadata && Array.isArray(groupMetadata.participants)) ? groupMetadata.participants : [];
              const admins = participants.filter((p) => p && ['admin', 'superadmin'].includes(p.admin)).map((p) => p.id || p.lid || p.jid).filter(Boolean);
              const mentionText = args.join(' ') || 'Admins, ihr seid gefragt!';
              await sock.sendMessage(from, { text: `@${admins.map((a) => cleanId(a)).join(' @')}\n\n${mentionText}`, mentions: admins }, { quoted: msg });
              await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              break;
            }

            case 'join': {
              const link = args[0] || extractUrlFromText(args.join(' '));
              if (!link) {
                await sock.sendMessage(from, { text: '> ➕ *JOIN*\n\n' + `Nutze: *${pref}join <einladungslink>*\nBeispiel: ${pref}join https://chat.whatsapp.com/XXXX` }, { quoted: msg });
                break;
              }
              try {
                const codeMatch = link.match(/chat\.whatsapp\.com\/([A-Za-z0-9]+)/);
                if (!codeMatch) {
                  await sock.sendMessage(from, { text: '> ❌ *Ungültiger Einladungslink.*' }, { quoted: msg });
                  break;
                }
                const code = codeMatch[1];
                const invite = await sock.groupAcceptInvite(code);
                await sock.sendMessage(from, { text: `> ➕ *BEIGETRETEN*\n\nBot ist der Gruppe beigetreten! (${invite || code})\n\n*Tip:* ${pref}setup zum Aktivieren.` }, { quoted: msg });
                await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              } catch (e) {
                await sock.sendMessage(from, { text: '> ❌ *Fehler:* ' + (e.message || 'Einladung ungültig/abgelaufen.') }, { quoted: msg });
              }
              break;
            }

            case 'leave':
            case 'out':
            case 'botleave': {
              if (!isGroup) {
                await sock.sendMessage(from, { text: '> ❌ *Fehler:* Dieser Befehl funktioniert nur in Gruppen.' }, { quoted: msg });
                break;
              }
              if (!isHost) {
                await sock.sendMessage(from, { text: '> ⛔ *Zugriff verweigert:* Nur der Owner kann den Bot die Gruppe verlassen lassen.' }, { quoted: msg });
                await sendReaction(sock, from, reactions.access.reactions.unauthorized, msg.key);
                break;
              }
              await sock.sendMessage(from, { text: '> 👋 *Der Bot verlässt die Gruppe...*\n\nSchön, dass ihr mich hatte! 💙' }, { quoted: msg });
              const db = readDb();
              const gid = cleanId(from);
              if (db.groups) delete db.groups[gid];
              writeDb(db);
              try {
                if (typeof sock.groupLeave === 'function') {
                  await sock.groupLeave(from);
                }
              } catch (e) {}
              break;
            }

            case 'block': {
              if (!isHost) {
                await sock.sendMessage(from, { text: '> ⛔ *Zugriff verweigert:* Nur der Owner kann blockieren.' }, { quoted: msg });
                await sendReaction(sock, from, reactions.access.reactions.unauthorized, msg.key);
                break;
              }
              const targetRaw = args[0] || (quoted && (quoted.conversation || quoted.extendedTextMessage?.text));
              if (!targetRaw) {
                await sock.sendMessage(from, { text: '> 🚫 *BLOCKIEREN*\n\n' + `Nutze: *${pref}block <nummer|@user>*` }, { quoted: msg });
                break;
              }
              const target = await resolveBanTarget(sock, targetRaw, sessionPath);
              if (!target || !target.jid) {
                await sock.sendMessage(from, { text: '> ❌ *Fehler:* Ziel nicht auflösbar.' }, { quoted: msg });
                break;
              }
              try {
                if (typeof sock.updateBlockStatus === 'function') {
                  await sock.updateBlockStatus(target.jid, 'block');
                }
              } catch (e) {}
              await sock.sendMessage(from, { text: `> 🚫 *BLOKIERT*\n\n${target.jid} wurde blockiert.` }, { quoted: msg });
              await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              break;
            }

            case 'unblock': {
              if (!isHost) {
                await sock.sendMessage(from, { text: '> ⛔ *Zugriff verweigert:* Nur der Owner kann entblockieren.' }, { quoted: msg });
                await sendReaction(sock, from, reactions.access.reactions.unauthorized, msg.key);
                break;
              }
              const targetRaw = args[0] || (quoted && (quoted.conversation || quoted.extendedTextMessage?.text));
              if (!targetRaw) {
                await sock.sendMessage(from, { text: '> ✅ *ENTBLOKIEREN*\n\n' + `Nutze: *${pref}unblock <nummer|@user>*` }, { quoted: msg });
                break;
              }
              const target = await resolveBanTarget(sock, targetRaw, sessionPath);
              if (!target || !target.jid) {
                await sock.sendMessage(from, { text: '> ❌ *Fehler:* Ziel nicht auflösbar.' }, { quoted: msg });
                break;
              }
              try {
                if (typeof sock.updateBlockStatus === 'function') {
                  await sock.updateBlockStatus(target.jid, 'unblock');
                }
              } catch (e) {}
              await sock.sendMessage(from, { text: `> ✅ *ENTBLOKIERT*\n\n${target.jid} wurde entblockiert.` }, { quoted: msg });
              await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              break;
            }

            case 'b64':
            case 'base64': {
              const inp = args.join(' ') || (quoted && (quoted.conversation || quoted.extendedTextMessage?.text));
              if (!inp) {
                await sock.sendMessage(from, { text: '> 🧮 *BASE64 DEKODIEREN*\n\n' + `Nutze: *${pref}b64 <text>*` }, { quoted: msg });
                break;
              }
              try {
                const buf = Buffer.from(inp, 'base64');
                const decoded = buf.toString('utf8');
                const encoded = Buffer.from(decoded, 'utf8').toString('base64');
                if (/^[A-Za-z0-9+/=\s]+$/.test(inp) && buf.length > 0 && decoded && /[^\x00-\x1F]/.test(decoded)) {
                  await sock.sendMessage(from, { text: `> 🧮 *BASE64*\n\n🔗 *Dekodiert:* ${decoded}\n🔒 *Rekodiert:* ${encoded}` }, { quoted: msg });
                } else {
                  const enc = Buffer.from(inp, 'utf8').toString('base64');
                  await sock.sendMessage(from, { text: `> 🧮 *BASE64*\n\n🔒 *Enkodiert:* ${enc}` }, { quoted: msg });
                }
              } catch (e) {
                await sock.sendMessage(from, { text: '> ❌ *Fehler:* ' + (e.message || e) }, { quoted: msg });
              }
              await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              break;
            }

            case 'length':
            case 'len': {
              const inp = args.join(' ') || (quoted && (quoted.conversation || quoted.extendedTextMessage?.text));
              if (!inp) {
                await sock.sendMessage(from, { text: '> 📏 *LÄNGE*\n\n' + `Nutze: *${pref}length <text>*` }, { quoted: msg });
                break;
              }
              await sock.sendMessage(from, {
                text: `> 📏 *TEXT LÄNGE*\n\n• *Zeichen:* ${inp.length}\n• *Wörter:* ${inp.trim().split(/\s+/).filter(Boolean).length}\n• *Bytes:* ${Buffer.byteLength(inp, 'utf8')}`
              }, { quoted: msg });
              await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              break;
            }

            case 'upper':
            case 'uppercase': {
              const inp = args.join(' ') || (quoted && (quoted.conversation || quoted.extendedTextMessage?.text));
              if (!inp) {
                await sock.sendMessage(from, { text: '> 🔠 *GROSSBUCHSTABEN*\n\n' + `Nutze: *${pref}upper <text>*` }, { quoted: msg });
                break;
              }
              await sock.sendMessage(from, { text: '> 🔠 *GROSSBUCHSTABEN*\n\n' + inp.toUpperCase() }, { quoted: msg });
              await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              break;
            }

            case 'lower':
            case 'lowercase': {
              const inp = args.join(' ') || (quoted && (quoted.conversation || quoted.extendedTextMessage?.text));
              if (!inp) {
                await sock.sendMessage(from, { text: '> 🔡 *KLEINBUCHSTABEN*\n\n' + `Nutze: *${pref}lower <text>*` }, { quoted: msg });
                break;
              }
              await sock.sendMessage(from, { text: '> 🔡 *KLEINBUCHSTABEN*\n\n' + inp.toLowerCase() }, { quoted: msg });
              await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              break;
            }

            case 'invisible':
            case 'blank': {
              await sock.sendMessage(from, { text: '> 🫥 *UNSICHTBAR / LEER*\n\nKopiere die unsichtbare Zeile darunter:' });
              await sock.sendMessage(from, { text: '\u200b\u200b\u200b\u200b\u200b\u200b\u200b\u200b\u200b\u200b\u200b\u200b\u200b\u200b\u200b\u200b\u200b\u200b\u200b\u200b' });
              await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              break;
            }

            case 'flip':
            case 'upside': {
              const inp = args.join(' ') || (quoted && (quoted.conversation || quoted.extendedTextMessage?.text));
              if (!inp) {
                await sock.sendMessage(from, { text: '> 🙃 *UMDREHEN*\n\n' + `Nutze: *${pref}flip <text>*` }, { quoted: msg });
                break;
              }
              const map = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('');
              const repl = 'ɐqɔpǝɟƃɥıɾʞlɯuodbɹsʇnʌʍxʎzɐqɔdǝɟɓɥıɾʞʃɯuodbɹsʇuʌʍxʎz0ƖᄅƐㄣϛ9ㄥ86'.split('');
              const flipText = [...inp].map((ch) => {
                const idx = map.indexOf(ch);
                return idx === -1 ? ch : (repl[idx] || ch);
              }).reverse().join('');
              await sock.sendMessage(from, { text: '> 🙃 *UMGEKEHRT*\n\n' + flipText }, { quoted: msg });
              await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              break;
            }

            case 'pfp':
            case 'profilepic':
            case 'pp': {
              const targetRaw = (quoted && (msg.message?.extendedTextMessage?.contextInfo?.participant || msg.message?.extendedTextMessage?.contextInfo?.remoteJid))
                || (args[0] && args[0].replace(/^@/, '') + '@s.whatsapp.net')
                || senderJid;
              let url = '';
              try {
                if (typeof sock.profilePictureUrl === 'function') {
                  url = await sock.profilePictureUrl(targetRaw, 'image');
                }
              } catch (e) { url = ''; }
              if (url) {
                await sock.sendMessage(from, {
                  image: { url },
                  caption: `> 🖼️ *PROFILBILD*\n\n${targetRaw}`
                }, { quoted: msg });
              } else {
                await sock.sendMessage(from, { text: `> ❌ *Kein Profilbild gefunden* für ${targetRaw}` }, { quoted: msg });
              }
              await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              break;
            }

            case 'type':
            case 'cektype': {
              const target = args[0] || from;
              const t = getJidType ? getJidType(target) : 'unbekannt';
              await sock.sendMessage(from, { text: `> 🔎 *JID-TYP*\n\n• *Ziel:* ${target}\n• *Typ:* ${t}` }, { quoted: msg });
              await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              break;
            }

            case 'slot':
            case 'spin':
            case 'automaten': {
              /* Slot-Machine im App-Look: erst eine animierte "GENERATING"-
               * Karte, dann nach kurzer Zeit das Ergebnis mit Sound-Effekt
               * (🎰 + 🎵). Sound selbst kann WhatsApp nicht abspielen,
               * wir imitieren es mit animierten Reaktionen/Emojis. */
              const symbols = ['🍒', '🍋', '🍇', '🔔', '💎', '7️⃣', '⭐', '🍀', '🎱'];
              const reels = [
                symbols[Math.floor(Math.random() * symbols.length)],
                symbols[Math.floor(Math.random() * symbols.length)],
                symbols[Math.floor(Math.random() * symbols.length)]
              ];
              const bigWin = reels[0] === reels[1] && reels[1] === reels[2];
              const twoSame = reels[0] === reels[1] || reels[1] === reels[2] || reels[0] === reels[2];

              /* App-artige Lade-Animation */
              try {
                await sendGeneratingPayload(sock, from, {
                  type: 'ANIMATE',
                  label: '🎰 SLOT MACHINE — DREHT …'
                });
              } catch (gerr) {
                await sock.sendMessage(from, { text: '🎰 *SLOT — DREHT …*' });
              }
              await delay(2800);

              const winLabel = bigWin ? 'JACKPOT!' : (twoSame ? 'GEWONNEN!' : 'LEIDER VERLOREN');

              const resultText =
                '> 🎰 *SLOT MACHINE* 🎰\n\n' +
                `┌── 🎵 ${winLabel} 🎵 ──┐\n` +
                `│   ${reels[0]}   ${reels[1]}   ${reels[2]}   │\n` +
                '└────────────────────┘\n\n' +
                (bigWin
                  ? '🎉 *JACKPOT!!!* Die 3 Symbole sind gleich! Du hast gewonnen! 💰'
                  : (twoSame
                    ? '✨ *Fast!* 2 gleiche Symbole — kleiner Gewinn! 🎁'
                    : '😅 Kein Glück diesmal. Versuch es nochmal!')) +
                '\n\n*Tipp:* ' + pref + 'slot nochmal!';

              await sock.sendMessage(from, { text: resultText }, { quoted: msg });
              if (bigWin) {
                await sock.sendMessage(from, { text: '🎊💐🎊💐🎊\n*CONGRATS JACKPOT!*\n`🎰 🎰 🎰`\n🎊💐🎊💐🎊' });
              }
              await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              break;
            }

            case 'dice2':
            case 'kaset':
            case 'toy':
            case 'slotmini': {
              const symbols = ['🎰', '🍀', '💎', '🔔', '7️⃣', '🍒'];
              const r = [
                symbols[Math.floor(Math.random() * symbols.length)],
                symbols[Math.floor(Math.random() * symbols.length)],
                symbols[Math.floor(Math.random() * symbols.length)]
              ];
              await sock.sendMessage(from, {
                text: '🎰 *MINI-SLOT*\n\n' + r.join('  ') + '\n\n' + (r[0] === r[1] && r[1] === r[2] ? '🎉 DREI GLEICH! JACKPOT!' : (r[0] === r[1] || r[1] === r[2] || r[0] === r[2] ? '✨ PAAR! Fast!' : '😅 Versuch es nochmal!'))
              }, { quoted: msg });
              await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              break;
            }

            case 'imagine':
            case 'genimg': {
              const prompt = args.join(' ') || 'LoveBot AI Image';
              try {
                await sendGeneratingPayload(sock, from, {
                  type: 'IMAGINE',
                  label: '🎨 Imagine: „' + prompt.slice(0, 60) + '“ …'
                });
              } catch (e) {
                await sock.sendMessage(from, { text: '> 🎨 *IMAGINE* …\n\nGeneriere: ' + prompt });
              }
              await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              break;
            }

            case 'animate':
            case 'genavid': {
              const prompt = args.join(' ') || 'LoveBot AI Animation';
              try {
                await sendGeneratingPayload(sock, from, {
                  type: 'ANIMATE',
                  label: '🎬 Animieren: „' + prompt.slice(0, 60) + '“ …'
                });
              } catch (e) {
                await sock.sendMessage(from, { text: '> 🎬 *ANIMATE* …\n\nGeneriere: ' + prompt });
              }
              await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              break;
            }

            case 'typing':
            case 'loading':
            case 'loadingnow':
            case 'render': {
              const label = args.join(' ') || 'LoveBot lädt …';
              try {
                await sendGeneratingPayload(sock, from, {
                  type: args[0] && /vid|anim/i.test(args[0]) ? 'ANIMATE' : 'IMAGINE',
                  label
                });
              } catch (e) {
                await sock.sendMessage(from, { text: '> ⏳ ' + label });
              }
              await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              break;
            }

            /* ====================================================== */
            /* 📲 SEE — STATUS-REPOST (Bild/Video/Audio/Text)         */
            /* ====================================================== */
            case 'see':
            case 'seestatus':
            case 'viewstatus':
            case 'statusdl': {
              const seeCtx = msg.message?.extendedTextMessage?.contextInfo;
              const seeQuoted = seeCtx?.quotedMessage ? normalizeMessageContent(seeCtx.quotedMessage) : null;
              const seeStatusSender = seeCtx?.participant || '';
              if (!seeQuoted) {
                await sock.sendMessage(from, {
                  text: '> 📲 *STATUS ANSCHAUEN / REPOSTEN*\n\n' +
                    'Antworte auf einen *Status* (status@broadcast) mit *' + pref + 'see*.\n\n' +
                    'Der Bot sendet den kompletten Status:\n' +
                    '🖼️ Bild + Text · 🎬 Video · 🎧 Audio · 😀 Sticker · 📄 Datei · ✍️ Text'
                }, { quoted: msg });
                break;
              }

              const seeLabel = seeStatusSender ? `@${cleanId(seeStatusSender)}` : 'Unbekannt';
              const seeMentions = seeStatusSender ? [seeStatusSender] : [];
              const seeHeader = `📲 *STATUS VON ${seeLabel}*`;

              try {
                if (seeQuoted.imageMessage) {
                  const seeBuf = await streamToBuffer(await downloadContentFromMessage(seeQuoted.imageMessage, 'image'));
                  const seeCaption = seeQuoted.imageMessage.caption
                    ? `${seeHeader}\n\n${seeQuoted.imageMessage.caption}`
                    : seeHeader;
                  await sock.sendMessage(from, {
                    image: seeBuf,
                    caption: seeCaption,
                    mimetype: seeQuoted.imageMessage.mimetype || 'image/jpeg',
                    mentions: seeMentions
                  }, { quoted: msg });
                } else if (seeQuoted.videoMessage) {
                  const seeBuf = await streamToBuffer(await downloadContentFromMessage(seeQuoted.videoMessage, 'video'));
                  const seeCaption = seeQuoted.videoMessage.caption
                    ? `${seeHeader}\n\n${seeQuoted.videoMessage.caption}`
                    : seeHeader;
                  await sock.sendMessage(from, {
                    video: seeBuf,
                    caption: seeCaption,
                    mimetype: seeQuoted.videoMessage.mimetype || 'video/mp4',
                    gifPlayback: Boolean(seeQuoted.videoMessage.gifPlayback),
                    mentions: seeMentions
                  }, { quoted: msg });
                } else if (seeQuoted.audioMessage) {
                  const seeBuf = await streamToBuffer(await downloadContentFromMessage(seeQuoted.audioMessage, 'audio'));
                  await sock.sendMessage(from, {
                    audio: seeBuf,
                    mimetype: seeQuoted.audioMessage.mimetype || 'audio/ogg; codecs=opus',
                    ptt: Boolean(seeQuoted.audioMessage.ptt)
                  }, { quoted: msg });
                  await sock.sendMessage(from, { text: seeHeader, mentions: seeMentions }, { quoted: msg });
                } else if (seeQuoted.stickerMessage) {
                  const seeBuf = await streamToBuffer(await downloadContentFromMessage(seeQuoted.stickerMessage, 'sticker'));
                  await sock.sendMessage(from, {
                    sticker: seeBuf,
                    mimetype: seeQuoted.stickerMessage.mimetype || 'image/webp'
                  }, { quoted: msg });
                  await sock.sendMessage(from, { text: seeHeader, mentions: seeMentions }, { quoted: msg });
                } else if (seeQuoted.documentMessage) {
                  const seeBuf = await streamToBuffer(await downloadContentFromMessage(seeQuoted.documentMessage, 'document'));
                  await sock.sendMessage(from, {
                    document: seeBuf,
                    mimetype: seeQuoted.documentMessage.mimetype || 'application/octet-stream',
                    fileName: seeQuoted.documentMessage.fileName || 'Status-Datei',
                    caption: seeHeader,
                    mentions: seeMentions
                  }, { quoted: msg });
                } else {
                  const seeText = seeQuoted.conversation || seeQuoted.extendedTextMessage?.text || '';
                  if (!seeText) {
                    await sock.sendMessage(from, { text: '> ❌ *Dieser Status-Typ wird nicht unterstützt.*' }, { quoted: msg });
                    break;
                  }
                  await sock.sendMessage(from, {
                    text: `${seeHeader}\n\n${seeText}`,
                    mentions: seeMentions
                  }, { quoted: msg });
                }
                await sendReaction(sock, from, '📲', msg.key);
                logLove('see', `Status von ${seeStatusSender || '?'} gerepostet.`, c.brightCyan);
              } catch (seeErr) {
                await sock.sendMessage(from, { text: `> ❌ *SEE Fehler:* ${seeErr?.message || seeErr}` }, { quoted: msg });
                await sendReaction(sock, from, reactions.errors.reactions.error, msg.key);
              }
              break;
            }

            /* ====================================================== */
            /* 📊 POLL — NATIVE WHATSAPP-UMFRAGE                      */
            /* ====================================================== */
            case 'poll':
            case 'umfrage':
            case 'abstimmung': {
              const pollInput = args.join(' ');
              const pollParts = pollInput.split('|').map((s) => s.trim()).filter(Boolean);
              if (pollParts.length < 3) {
                await sock.sendMessage(from, {
                  text: '> 📊 *UMFRAGE ERSTELLEN*\n\n' +
                    `Nutze: *${pref}poll Frage | Option 1 | Option 2 | …*\n\n` +
                    `*Beispiel:* ${pref}poll Was essen wir? | Pizza | Döner | Burger\n\n` +
                    'Es entsteht eine echte WhatsApp-Umfrage zum Antippen. ✅'
                }, { quoted: msg });
                break;
              }
              const pollQuestion = pollParts[0];
              const pollOptions = pollParts.slice(1, 13);
              try {
                await sock.sendMessage(from, {
                  poll: {
                    name: pollQuestion,
                    values: pollOptions,
                    selectableCount: 1
                  }
                }, { quoted: msg });
                await sendReaction(sock, from, '📊', msg.key);
              } catch (pollErr) {
                /* Fallback als Text, falls der Client kein Poll kann */
                await sock.sendMessage(from, {
                  text: `> 📊 *UMFRAGE*\n\n*${pollQuestion}*\n\n` +
                    pollOptions.map((o, i) => `${i + 1}️⃣ ${o}`).join('\n') +
                    '\n\n_Antwortet mit der Nummer!_'
                }, { quoted: msg });
              }
              break;
            }

            /* ====================================================== */
            /* 🫥 HIDETAG — ALLE TAGGEN OHNE SICHTBARE MENTIONS       */
            /* ====================================================== */
            case 'hidetag':
            case 'ht': {
              if (!isGroup) {
                await sock.sendMessage(from, { text: '> ❌ *Fehler:* ' + pref + 'hidetag funktioniert nur in Gruppen.' }, { quoted: msg });
                break;
              }
              if (userRole !== 'host' && userRole !== 'superadmin' && userRole !== 'admin') {
                await sock.sendMessage(from, { text: '> ⛔ *Zugriff verweigert:* Nur Admins können hidetag nutzen.' }, { quoted: msg });
                break;
              }
              const htText = args.join(' ')
                || (quoted && (quoted.conversation || quoted.extendedTextMessage?.text))
                || '📢';
              const htMentions = (groupMetadata?.participants || []).map((p) => p?.id).filter(Boolean);
              await sock.sendMessage(from, {
                text: htText,
                mentions: htMentions
              }, { quoted: msg });
              await sendReaction(sock, from, '🫥', msg.key);
              logLove('hidetag', `${htMentions.length} Mitglieder unsichtbar getaggt.`, c.brightCyan);
              break;
            }

            /* ====================================================== */
            /* 🔍 ACHECK — GROßER GRUPPEN-CHECK                       */
            /* Prüft ALLE: Owner, Superadmins, Admins, Mitglieder,    */
            /* Bot-Status — jeweils mit JID + LID.                    */
            /* ====================================================== */
            case 'acheck':
            case 'admincheck':
            case 'allcheck':
            case 'gruppencheck': {
              if (!isGroup) {
                await sock.sendMessage(from, { text: '> ❌ *Fehler:* ' + pref + 'acheck funktioniert nur in Gruppen.' }, { quoted: msg });
                break;
              }
              const acParticipants = (groupMetadata && Array.isArray(groupMetadata.participants)) ? groupMetadata.participants : [];

              /* 🆔 JID↔LID-Lookup aus der User-DB bauen */
              const acDb = readDb();
              const acJidToLid = new Map();
              const acLidToJid = new Map();
              for (const [acBid, acP] of Object.entries(acDb.users || {})) {
                let acJ = cleanId(acP?.identity?.jid || '');
                let acL = cleanId(acP?.identity?.lid || '');
                const acM = String(acBid).match(/^(\d+)jid(\d+)lid$/);
                if (acM) { acJ = acJ || acM[1]; acL = acL || acM[2]; }
                if (acJ && acL) { acJidToLid.set(acJ, acL); acLidToJid.set(acL, acJ); }
              }
              const acResolveIds = (rawId) => {
                const id = cleanId(rawId || '');
                if (!id) return { jid: '—', lid: '—' };
                if (String(rawId).endsWith('@lid')) {
                  const acMatchedJid = acLidToJid.get(id);
                  return {
                    jid: acMatchedJid ? `${acMatchedJid}@s.whatsapp.net` : '— (nicht in der DB)',
                    lid: `${id}@lid`
                  };
                }
                const acMatchedLid = acJidToLid.get(id);
                return {
                  jid: `${id}@s.whatsapp.net`,
                  lid: acMatchedLid ? `${acMatchedLid}@lid` : '— (nicht in der DB)'
                };
              };

              /* 🤖 Bot-Status prüfen */
              const acBotJid = normalizeJid(sock.user?.id || '');
              const acBotLid = normalizeLid(sock.user?.lid || '');
              const acBotMappedLid = acJidToLid.get(cleanId(acBotJid)) || '';
              const acBotParticipant = acParticipants.find((p) =>
                (p?.id && cleanId(p.id) === cleanId(acBotJid)) ||
                (p?.id && acBotLid && cleanId(p.id) === cleanId(acBotLid)) ||
                (p?.id && acBotMappedLid && cleanId(p.id) === acBotMappedLid) ||
                (p?.lid && acBotLid && cleanId(p.lid) === cleanId(acBotLid))
              );
              const acBotInGroup = Boolean(acBotParticipant);
              const acBotIsAdmin = Boolean(acBotParticipant && (acBotParticipant.admin === 'admin' || acBotParticipant.admin === 'superadmin'));

              /* 👥 Rollen einsammeln */
              const acOwners = [];
              const acAdmins = [];
              const acMembers = [];
              for (const acP of acParticipants) {
                if (!acP || !acP.id) continue;
                const acEntry = { id: acP.id, ids: acResolveIds(acP.id) };
                if (acP.admin === 'superadmin') acOwners.push(acEntry);
                else if (acP.admin === 'admin') acAdmins.push(acEntry);
                else acMembers.push(acEntry);
              }

              /* 👑 Gruppen-Owner zusätzlich sauber auflösen */
              let acOwnerExtra = [];
              try {
                const acOwnerRaw = groupMetadata?.owner || '';
                if (acOwnerRaw) {
                  const acOwnerResolved = await resolveBanTarget(sock, acOwnerRaw, sessionPath);
                  acOwnerExtra.push(`• *Owner JID:* ${acOwnerResolved?.jid || (String(acOwnerRaw).endsWith('@lid') ? '— (nur LID bekannt)' : acOwnerRaw)}`);
                  acOwnerExtra.push(`• *Owner LID:* ${acOwnerResolved?.lid || (String(acOwnerRaw).endsWith('@lid') ? acOwnerRaw : '— (nicht in der DB)')}`);
                }
              } catch (acOwnerErr) {}

              const acCap = 25;
              const acLines = [];
              acLines.push('> 🔍 *LOVE BOT — ACHECK* 🔍');
              acLines.push('');
              acLines.push(`📌 *Gruppe:* ${groupMetadata?.subject || 'Unbekannt'}`);
              acLines.push(`🆔 *Gruppen-ID:* ${cleanId(from)}`);
              acLines.push(`👥 *Teilnehmer gesamt:* ${acParticipants.length}`);
              acLines.push('');
              acLines.push('━━━━━━━━━━━━━━━━━━━━━━');
              acLines.push('*🤖 BOT-STATUS*');
              acLines.push(`• *Bot in Gruppe:* ${acBotInGroup ? '✅ Ja' : '❌ Nein'}`);
              acLines.push(`• *Bot ist Admin:* ${acBotIsAdmin ? '✅ Ja' : '❌ NEIN ⚠️'}`);
              acLines.push(`• *Bot JID:* ${acBotJid || '—'}`);
              acLines.push(`• *Bot LID:* ${acBotLid || '—'}`);
              if (!acBotIsAdmin) {
                acLines.push('⚠️ _Ohne Admin-Rechte kann der Bot nicht löschen/kicken/addmeta!_');
              }
              acLines.push('');
              acLines.push('━━━━━━━━━━━━━━━━━━━━━━');
              acLines.push(`*👑 OWNER / SUPERADMIN (${acOwners.length})*`);
              if (acOwners.length) {
                for (const acO of acOwners.slice(0, acCap)) {
                  acLines.push(`• JID: ${acO.ids.jid}`);
                  acLines.push(`  LID: ${acO.ids.lid}`);
                }
                if (acOwners.length > acCap) acLines.push(`… und ${acOwners.length - acCap} weitere`);
              } else {
                acLines.push('• Kein Superadmin gefunden');
              }
              if (acOwnerExtra.length) {
                acLines.push('');
                acLines.push(...acOwnerExtra);
              }
              acLines.push('');
              acLines.push('━━━━━━━━━━━━━━━━━━━━━━');
              acLines.push(`*⭐ ADMINS (${acAdmins.length})*`);
              if (acAdmins.length) {
                acAdmins.slice(0, acCap).forEach((acA, acI) => {
                  acLines.push(`${acI + 1}. JID: ${acA.ids.jid}`);
                  acLines.push(`   LID: ${acA.ids.lid}`);
                });
                if (acAdmins.length > acCap) acLines.push(`… und ${acAdmins.length - acCap} weitere`);
              } else {
                acLines.push('• Keine Admins 😱');
              }
              acLines.push('');
              acLines.push('━━━━━━━━━━━━━━━━━━━━━━');
              acLines.push(`*👤 MITGLIEDER (${acMembers.length})*`);
              if (acMembers.length) {
                const acPreview = acMembers.slice(0, acCap).map((acMm) => cleanId(acMm.id)).join(', ');
                acLines.push(acPreview + (acMembers.length > acCap ? `, … +${acMembers.length - acCap} weitere` : ''));
              } else {
                acLines.push('• Keine Mitglieder');
              }
              acLines.push('');
              acLines.push('🔍 _LoveBot Rollen-Check — JID + LID überall_ 💜');

              await sock.sendMessage(from, { text: acLines.join('\n') }, { quoted: msg });
              await sendReaction(sock, from, '🔍', msg.key);
              logLove('acheck', `Gruppen-Check in ${from}: ${acOwners.length} Owner, ${acAdmins.length} Admins, ${acMembers.length} Mitglieder.`, c.brightCyan);
              break;
            }

            /* ====================================================== */
            /* 👑 ADDOWNER / DELOWNER (nur Haupt-Owner!)              */
            /* ====================================================== */
            case 'addowner': {
              /* Streng: NUR 4915155894714@s.whatsapp.net /
                 269574108926096@lid darf Owner eintragen. */
              if (!isMainOwner(senderJid, senderLid) && !msg.key.fromMe) {
                await sock.sendMessage(from, {
                  text: '> ⛔ *Zugriff verweigert:*\n\n*' + pref + 'addowner* darf ausschließlich der Haupt-Owner nutzen. 👑'
                }, { quoted: msg });
                await sendReaction(sock, from, reactions.access.reactions.unauthorized, msg.key);
                break;
              }

              const aoMentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
              const aoQuotedParticipant = quoted?.extendedTextMessage?.contextInfo?.participant;
              const aoTargetRaw = aoMentions[0] || aoQuotedParticipant || args[0] || '';
              const aoName = args.slice(1).join(' ').trim();

              if (!aoTargetRaw || !aoName) {
                await sock.sendMessage(from, {
                  text: '> 👑 *ADDOWNER — VERWENDUNG*\n\n' +
                    `Nutze: *${pref}addowner @user <name>*\n\n` +
                    `*Beispiel:* ${pref}addowner @user Freundin\n\n` +
                    'Die Person bekommt Owner-Rechte und ihre\n' +
                    'JID (@s.whatsapp.net) + LID (@lid) wird gespeichert.'
                }, { quoted: msg });
                break;
              }

              const aoTarget = await resolveBanTarget(sock, aoTargetRaw, sessionPath);
              if (!aoTarget || (!aoTarget.jid && !aoTarget.lid)) {
                await sock.sendMessage(from, { text: '> ❌ *Fehler:* Ziel konnte nicht aufgelöst werden.' }, { quoted: msg });
                break;
              }

              const aoDb = readDb();
              const aoOwners = getRegisteredOwners(aoDb);
              if (getRegisteredOwner(aoDb, aoTarget.jid, aoTarget.lid)) {
                await sock.sendMessage(from, { text: '> ℹ️ Diese Person ist bereits als Owner eingetragen.\n\n💡 Liste: *' + pref + 'ownerlist*' }, { quoted: msg });
                break;
              }
              /* Kein Limit — der Haupt-Owner darf so viele Owner
                 eintragen, wie er will. */

              aoOwners.push({
                name: aoName,
                jid: aoTarget.jid || '',
                lid: aoTarget.lid || '',
                addedAt: new Date().toISOString(),
                addedBy: senderJid
              });
              writeDb(aoDb);

              await sock.sendMessage(from, {
                text: '> 👑✨ *ADDOWNER ERFOLGREICH* ✨👑\n\n' +
                  `• *Owner-Name:* ${aoName}\n` +
                  `• *JID:* ${aoTarget.jid || '—'}\n` +
                  `• *LID:* ${aoTarget.lid || '—'}\n\n` +
                  '💜 Die Person hat ab sofort *Owner-Rechte* im LoveBot!\n' +
                  `📊 Alle Owner: *${pref}ownerlist* · Entfernen: *${pref}delowner*`
              }, { quoted: msg });
              await sendReaction(sock, from, '👑', msg.key);
              logLove('addowner', `Neuer Owner "${aoName}" eingetragen (${aoTarget.jid} / ${aoTarget.lid}).`, c.brightGreen);
              break;
            }

            case 'delowner':
            case 'removeowner': {
              if (!isMainOwner(senderJid, senderLid) && !msg.key.fromMe) {
                await sock.sendMessage(from, {
                  text: '> ⛔ *Zugriff verweigert:*\n\n*' + pref + 'delowner* darf ausschließlich der Haupt-Owner nutzen. 👑'
                }, { quoted: msg });
                await sendReaction(sock, from, reactions.access.reactions.unauthorized, msg.key);
                break;
              }

              const doMentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
              const doQuotedParticipant = quoted?.extendedTextMessage?.contextInfo?.participant;
              const doRaw = doMentions[0] || doQuotedParticipant || args.join(' ') || '';

              if (!doRaw) {
                await sock.sendMessage(from, {
                  text: '> 👑 *DELOWNER — VERWENDUNG*\n\n' +
                    `• *${pref}delowner @user* — per Erwähnung/Reply\n` +
                    `• *${pref}delowner <nummer>* — per Nummer\n` +
                    `• *${pref}delowner <name>* — per Owner-Name\n\n` +
                    `📊 Liste: *${pref}ownerlist*`
                }, { quoted: msg });
                break;
              }

              const doDb = readDb();
              const doOwners = getRegisteredOwners(doDb);
              let doFound = null;
              let doIndex = -1;

              /* 1) Versuch: als Ziel (JID/LID/Nummer) auflösen */
              const doTarget = await resolveBanTarget(sock, doRaw, sessionPath);
              if (doTarget && (doTarget.jid || doTarget.lid)) {
                doIndex = doOwners.findIndex((o) =>
                  (doTarget.jid && cleanId(o.jid || '') === cleanId(doTarget.jid)) ||
                  (doTarget.lid && cleanId(o.lid || '') === cleanId(doTarget.lid))
                );
                if (doIndex !== -1) doFound = doOwners[doIndex];
              }

              /* 2) Versuch: per Owner-Name suchen */
              if (!doFound) {
                const doNameQ = doRaw.toLowerCase().trim();
                doIndex = doOwners.findIndex((o) => String(o.name || '').toLowerCase() === doNameQ);
                if (doIndex !== -1) doFound = doOwners[doIndex];
              }

              if (!doFound) {
                await sock.sendMessage(from, {
                  text: `> ❓ *Kein Owner gefunden* zu „${doRaw}“.\n\n📊 Liste: *${pref}ownerlist*`
                }, { quoted: msg });
                break;
              }

              doOwners.splice(doIndex, 1);
              writeDb(doDb);

              await sock.sendMessage(from, {
                text: '> 🗑️ *DELOWNER ERFOLGREICH*\n\n' +
                  `• *Owner-Name:* ${doFound.name}\n` +
                  `• *JID:* ${doFound.jid || '—'}\n` +
                  `• *LID:* ${doFound.lid || '—'}\n\n` +
                  'Die Owner-Rechte wurden entfernt.'
              }, { quoted: msg });
              await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              logLove('delowner', `Owner "${doFound.name}" entfernt.`, c.brightYellow);
              break;
            }

            case 'ownerlist':
            case 'ownerliste':
            case 'alleowner': {
              const olDb = readDb();
              const olOwners = getRegisteredOwners(olDb);
              const olLines = [];
              olLines.push('> 👑 *LOVE BOT — OWNER-LISTE* 👑');
              olLines.push('');
              olLines.push('🌹 *Haupt-Owner:*');
              olLines.push('• *Name:* Maxichen');
              olLines.push(`• *JID:* ${OWNER_CONFIG.jid}`);
              olLines.push(`• *LID:* ${OWNER_CONFIG.lid}`);
              olLines.push('');
              olLines.push(`💜 *Zusatz-Owner (${olOwners.length}):*`);
              if (olOwners.length) {
                olOwners.forEach((o, i) => {
                  olLines.push(`${i + 1}. *Owner ${o.name}*`);
                  olLines.push(`   JID: ${o.jid || '—'}`);
                  olLines.push(`   LID: ${o.lid || '—'}`);
                });
              } else {
                olLines.push('• Noch keine Zusatz-Owner eingetragen.');
              }
              olLines.push('');
              olLines.push(`💡 *${pref}addowner @user <name>* · *${pref}delowner @user`);
              await sock.sendMessage(from, { text: olLines.join('\n') }, { quoted: msg });
              await sendReaction(sock, from, '👑', msg.key);
              break;
            }

            /* ====================================================== */
            /* 🤬 BADWORD-VERWALTUNG (nur Owner)                      */
            /* ====================================================== */
            case 'badword':
            case 'badwords': {
              const sub = (args[0] || '').toLowerCase();
              const db = readDb();
              const cfg = getBadwordConfig(db);

              if (!sub) {
                await sock.sendMessage(from, {
                  text: '> 🤬 *BADWORD-FILTER*\n\n' +
                    `• *Global:* ${cfg.enabled !== false ? '✅ AN' : '❌ AUS'}\n` +
                    `• *In dieser Gruppe:* ${(!isGroup || isGroupFeatureEnabled(db, cleanId(from), 'badwords')) ? '✅ AN' : '❌ AUS'}\n` +
                    `• *Wörter aktiv:* ${getActiveBadwords(db).length}\n\n` +
                    '*Owner-Befehle:*\n' +
                    `• *${pref}badword add <wort>* — Wort hinzufügen\n` +
                    `• *${pref}badword remove <wort>* — Wort entfernen\n` +
                    `• *${pref}badword list* — alle aktiven Wörter\n` +
                    `• *${pref}badword on|off* — Filter global an/aus\n\n` +
                    '⚠️ Treffer werden gelöscht + Verwarnung.\n' +
                    '🚫 3 Verwarnungen = Kick & Ban.\n' +
                    `💡 Pro Gruppe: *${pref}an badwords* / *${pref}aus badwords*`
                }, { quoted: msg });
                await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
                break;
              }

              /* Alles unterhalb ist Owner-only */
              if (!isHost) {
                await sock.sendMessage(from, { text: '> ⛔ *Zugriff verweigert:* Badwords verwaltet nur der Owner.' }, { quoted: msg });
                await sendReaction(sock, from, reactions.access.reactions.unauthorized, msg.key);
                break;
              }

              if (sub === 'on') {
                cfg.enabled = true;
                writeDb(db);
                await sock.sendMessage(from, { text: '> 🤬✅ *BADWORD-FILTER GLOBAL AKTIVIERT*' }, { quoted: msg });
                await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
                break;
              }
              if (sub === 'off') {
                cfg.enabled = false;
                writeDb(db);
                await sock.sendMessage(from, { text: '> 🤬❌ *BADWORD-FILTER GLOBAL DEAKTIVIERT*' }, { quoted: msg });
                await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
                break;
              }

              if (sub === 'add' || sub === 'remove') {
                const word = args.slice(1).join(' ').toLowerCase().trim();
                if (!word) {
                  await sock.sendMessage(from, { text: `> ❓ Nutze: *${pref}badword ${sub} <wort>*` }, { quoted: msg });
                  break;
                }
                if (sub === 'add') {
                  if (cfg.added.includes(word)) {
                    await sock.sendMessage(from, { text: `> ℹ️ „${word}“ steht schon auf der Liste.` }, { quoted: msg });
                    break;
                  }
                  cfg.added.push(word);
                  if (cfg.removed.includes(word)) cfg.removed = cfg.removed.filter((w) => w !== word);
                  writeDb(db);
                  await sock.sendMessage(from, {
                    text: `> 🤬✅ *BADWORD HINZUGEFÜGT*\n\n• *Wort:* ${word}\n• *Aktive Wörter:* ${getActiveBadwords(db).length}`
                  }, { quoted: msg });
                  logLove('badword', `Owner hat Badword hinzugefügt: ${word}`, c.brightGreen);
                } else {
                  let removed = false;
                  if (cfg.added.includes(word)) {
                    cfg.added = cfg.added.filter((w) => w !== word);
                    removed = true;
                  }
                  if (DEFAULT_BADWORDS.map((w) => w.toLowerCase()).includes(word)) {
                    if (!cfg.removed.includes(word)) cfg.removed.push(word);
                    removed = true;
                  }
                  if (!removed) {
                    await sock.sendMessage(from, { text: `> ❓ „${word}“ ist nicht auf der Badword-Liste.` }, { quoted: msg });
                    break;
                  }
                  writeDb(db);
                  await sock.sendMessage(from, {
                    text: `> 🗑️ *BADWORD ENTFERNT*\n\n• *Wort:* ${word}\n• *Aktive Wörter:* ${getActiveBadwords(db).length}`
                  }, { quoted: msg });
                  logLove('badword', `Owner hat Badword entfernt: ${word}`, c.brightYellow);
                }
                await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
                break;
              }

              if (sub === 'list' || sub === 'liste') {
                const active = getActiveBadwords(db);
                const chunk = active.join(', ');
                await sock.sendMessage(from, {
                  text: `> 🤬 *BADWORD-LISTE* (${active.length} aktiv)\n\n${chunk}\n\n` +
                    `_Quelle: badwords.js + Owner-Ergänzungen_`
                }, { quoted: msg });
                await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
                break;
              }

              await sock.sendMessage(from, {
                text: `> ❓ *Unbekannt:* ${pref}badword add|remove|list|on|off`
              }, { quoted: msg });
              break;
            }

            /* ====================================================== */
            /* 🆔 JID & LID AUFLÖSUNG                                  */
            /* ====================================================== */
            case 'jid':
            case 'lid':
            case 'jidlid':
            case 'ids':
            case 'idscheck': {
              const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
              const quotedParticipant = quoted?.extendedTextMessage?.contextInfo?.participant;
              const idRaw = mentions[0] || quotedParticipant || args[0] || senderJid;
              const target = await resolveBanTarget(sock, idRaw, sessionPath);
              const jidVal = target?.jid || (idRaw.includes('@') ? idRaw : `${cleanId(idRaw)}@s.whatsapp.net`);
              const lidVal = target?.lid || '';
              const numOnly = cleanId(jidVal);

              if (command === 'jid') {
                await sock.sendMessage(from, {
                  text: `> 🆔 *JID AUFLÖSUNG*\n\n` +
                    `• *Nummer:* +${numOnly}\n` +
                    `• *JID:* ${jidVal}\n\n` +
                    `💡 Komplettes Duo: *${pref}ids ${numOnly}*`
                }, { quoted: msg });
              } else if (command === 'lid') {
                await sock.sendMessage(from, {
                  text: lidVal
                    ? `> 🆔 *LID AUFLÖSUNG*\n\n• *Nummer:* +${numOnly}\n• *LID:* ${lidVal}\n\n💡 Komplettes Duo: *${pref}ids ${numOnly}*`
                    : `> ❌ *Keine LID gefunden* für +${numOnly}.\n\n_Die Person hat vermutlich noch keine LID-Mapping-Session._`
                }, { quoted: msg });
              } else {
                await sock.sendMessage(from, {
                  text: `> 🆔 *JID & LID*\n\n` +
                    `• *Nummer:* +${numOnly}\n` +
                    `• *JID:* ${jidVal}\n` +
                    `• *LID:* ${lidVal || '❌ nicht gefunden'}\n\n` +
                    `📋 *Beispiel-Format:*\n` +
                    `4915155894714@s.whatsapp.net\n269574108926096@lid`
                }, { quoted: msg });
              }
              await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              break;
            }

            /* ====================================================== */
            /* 🎛️ FEATURE-TOGGLES: $an / $aus / $gi                   */
            /* ====================================================== */
            /* ====================================================== */
            /* 👤 RBAC: Ränge, Accounts, Staff  (night/rbac.js)       */
            /* ====================================================== */
            case 'setrang':
            case 'setrank':
            case 'role': {
              if (!isHost) {
                await sock.sendMessage(from, { text: '> ⛔ *PERMISSION DENIED*\n\nRollen vergibt nur der Owner.\n☾ you don\'t have enough access.' }, { quoted: msg });
                await sendReaction(sock, from, reactions.access.reactions.unauthorized, msg.key);
                break;
              }
              const roleWanted = String(args[0] || '').toLowerCase();
              const mentionsR = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
              const quotedR = quoted?.extendedTextMessage?.contextInfo?.participant || msg.message?.extendedTextMessage?.contextInfo?.participant;
              const targetR = mentionsR[0] || quotedR || '';
              if (!roleWanted || !targetR) {
                await sock.sendMessage(from, {
                  text: '> 👤 *RANG SETZEN*\n\n' +
                    `Nutze: *${pref}setrang <rang> @person* (oder als Antwort)\n\n` +
                    '*Ränge:*\n• 👑 owner (geschützt)\n• 🔱 deputy / stellvertreter\n• ◆ admin\n• ◇ supporter\n• ○ user'
                }, { quoted: msg });
                break;
              }
              if (roleWanted === 'owner') {
                await sock.sendMessage(from, { text: '> ⛔ Die Owner-Rolle wird nicht per Befehl vergeben.' }, { quoted: msg });
                break;
              }
              const sync = rbac.syncRoleFromBot(cleanId(targetR), roleWanted, 'owner');
              if (!sync) {
                await sock.sendMessage(from, { text: '> ❓ Unbekannter Rang.' }, { quoted: msg });
                break;
              }
              /* ⚠️ Temp-Passwort NUR privat an die Zielperson — nie in die Gruppe */
              if (sync.created) {
                try {
                  await sock.sendMessage(targetR, {
                    text: '> ☾ *LOVE BOT DASHBOARD ACCOUNT*\n\n' +
                      `• *Rolle:* ${sync.account.role.toUpperCase()}\n` +
                      `• *Username:* ${sync.account.username}\n` +
                      `• *Temp-Passwort:* ${sync.tempPassword}\n\n` +
                      '⚠ Ändere das Passwort beim ersten Login.\n☾ welcome to the night shift.'
                  });
                } catch (pmErr) {}
              } else {
                try {
                  await sock.sendMessage(targetR, {
                    text: `> ♡ *ROLE UPDATED*\n\n• *neue Rolle:* ${sync.account.role.toUpperCase()}\n\nDeine Dashboard-Rechte sind sofort aktiv.\n☾ welcome upstairs.`
                  });
                } catch (pmErr) {}
              }
              await sock.sendMessage(from, {
                text: `> 👤 *RANG VERGEBEN*\n\n• *User:* @${cleanId(targetR)}\n• *Rolle:* ${sync.account.role.toUpperCase()}\n• *Account:* ${sync.account.username}\n\n${sync.created ? '📬 Zugangsdaten privat zugestellt.' : '🔄 Rollen-Sync aktiv.'}`,
                mentions: [targetR]
              }, { quoted: msg });
              logLove('rbac', `setrang ${sync.account.role} → ${cleanId(targetR)}`, c.brightMagenta);
              break;
            }

            case 'delrang':
            case 'removerang':
            case 'removerole': {
              if (!isHost) {
                await sock.sendMessage(from, { text: '> ⛔ *PERMISSION DENIED* — nur der Owner.' }, { quoted: msg });
                break;
              }
              const mentionsD = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
              const quotedD = quoted?.extendedTextMessage?.contextInfo?.participant || msg.message?.extendedTextMessage?.contextInfo?.participant;
              const targetD = mentionsD[0] || quotedD || '';
              if (!targetD) { await sock.sendMessage(from, { text: `> ❓ Nutze: *${pref}delrang @person*` }, { quoted: msg }); break; }
              const accD = rbac.getAccountByNumber(cleanId(targetD));
              if (!accD) { await sock.sendMessage(from, { text: '> ❌ Kein Dashboard-Account für diese Person.' }, { quoted: msg }); break; }
              if (accD.role === 'owner') { await sock.sendMessage(from, { text: '> ⛔ Owner-Accounts sind geschützt.' }, { quoted: msg }); break; }
              rbac.setRole(accD.id, 'user', 'owner');
              await sock.sendMessage(from, {
                text: `> ☾ *ROLE REMOVED*\n\n• *User:* @${cleanId(targetD)}\n• *vorher:* ${accD.role.toUpperCase()}\n• *neu:* USER\n\nDashboard-Rechte sofort entzogen.`,
                mentions: [targetD]
              }, { quoted: msg });
              logLove('rbac', `delrang ${accD.role} → user (${accD.username})`, c.brightYellow);
              break;
            }

            case 'rangs':
            case 'roles': {
              const accs = rbac.listAccounts();
              const count = (r) => accs.filter((a) => a.role === r).length;
              await sock.sendMessage(from, {
                text: '> ☾ *LOVE RANGS*\n\n' +
                  `👑 OWNER — ${count('owner') + 1}\n` +
                  `🔱 STELLV. INHABER:IN — ${count('deputy')}\n` +
                  `◆ ADMIN — ${count('admin')}\n` +
                  `◇ SUPPORTER — ${count('supporter')}\n` +
                  ` GROUP ADMIN — ${count('groupadmin')}\n` +
                  `○ USER — ${count('user')}\n\n` +
                  `💡 setzen: *${pref}setrang <rang> @person*`
              }, { quoted: msg });
              break;
            }

            case 'getrang':
            case 'getrank': {
              const mentionsG = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
              const quotedG = quoted?.extendedTextMessage?.contextInfo?.participant || msg.message?.extendedTextMessage?.contextInfo?.participant;
              const targetG = mentionsG[0] || quotedG || senderJid;
              const accG = rbac.getAccountByNumber(cleanId(targetG));
              await sock.sendMessage(from, {
                text: accG
                  ? `> 👤 *RANG*\n\n• @${cleanId(targetG)}\n• Rolle: *${accG.role.toUpperCase()}*\n• Account: ${accG.username}\n• Status: ${accG.status}`
                  : `> 👤 @${cleanId(targetG)} hat noch keinen Dashboard-Account.\n☾ nobody home.`,
                mentions: [targetG]
              }, { quoted: msg });
              break;
            }

            case 'staff': {
              const accs = rbac.listAccounts();
              const grp = (r) => accs.filter((a) => a.role === r && a.status === 'active');
              const line = (icon, label, list) => list.length ? `${icon} *${label}*\n` + list.map((a) => '   • ' + a.username).join('\n') : '';
              await sock.sendMessage(from, {
                text: '> ☾ *LOVE BOT STAFF*\n\n' +
                  (line('👑', 'OWNER', [{ username: 'Maxichen 👑' }]) + '\n') +
                  (line('🔱', 'STELLV. INHABER:IN', grp('deputy')) ? line('🔱', 'STELLV. INHABER:IN', grp('deputy')) + '\n' : '') +
                  (line('◆', 'ADMIN', grp('admin')) ? line('◆', 'ADMIN', grp('admin')) + '\n' : '') +
                  (line('◇', 'SUPPORTER', grp('supporter')) ? line('◇', 'SUPPORTER', grp('supporter')) + '\n' : '') +
                  (line('○', 'USER', grp('user')) ? line('○', 'USER', grp('user')) : '') +
                  `\n\nStaff gesamt › ${accs.filter((a) => a.status === 'active').length + 1}`
              }, { quoted: msg });
              break;
            }

            case 'staffinfo': {
              const mentionsS = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
              const quotedS = quoted?.extendedTextMessage?.contextInfo?.participant || msg.message?.extendedTextMessage?.contextInfo?.participant;
              const targetS = mentionsS[0] || quotedS || senderJid;
              const accS = rbac.getAccountByNumber(cleanId(targetS));
              if (!accS) { await sock.sendMessage(from, { text: '> ❌ Kein Account für diese Person.' }, { quoted: msg }); break; }
              await sock.sendMessage(from, {
                text: '> ☾ *STAFF PROFILE*\n\n' +
                  `• *User:* @${cleanId(targetS)}\n• *Account:* ${accS.username}\n• *Rolle:* ${accS.role.toUpperCase()}\n` +
                  `• *Status:* ${accS.status}\n• *Letzter Login:* ${accS.lastLoginAt ? new Date(accS.lastLoginAt).toLocaleString('de-DE') : '—'}\n• *Erstellt:* ${new Date(accS.createdAt).toLocaleDateString('de-DE')}\n\n☾ trusted.`,
                mentions: [targetS]
              }, { quoted: msg });
              break;
            }

            case 'login': {
              /* privat: eigenen Dashboard-Zugang erstellen (einmalig) */
              if (isGroup) {
                await sock.sendMessage(from, { text: '> 🔐 *Login-Daten gibt es nur privat.*\n\nSchreib mir eine private Nachricht mit *' + pref + 'login*.' }, { quoted: msg });
                break;
              }
              const numL = cleanId(senderJid);
              const existing = rbac.getAccountByNumber(numL);
              if (existing) {
                await sock.sendMessage(from, {
                  text: `> 🔐 *Dein Dashboard-Zugang*\n\n• *Username:* ${existing.username}\n• *Rolle:* ${existing.role.toUpperCase()}\n\nPasswort vergessen? Owner fragen (${pref}owner).\n☾ dein Passwort kennt niemand — nicht mal ich.`
                });
                break;
              }
              const createdL = rbac.createAccount({ username: msg.pushName || ('seele_' + numL.slice(-4)), number: numL, role: 'user', mustChange: true });
              await sock.sendMessage(from, {
                text: '> ☾ *LOVE BOT DASHBOARD ACCOUNT*\n\n' +
                  `• *Username:* ${createdL.account.username}\n• *Temp-Passwort:* ${createdL.tempPassword}\n• *Rolle:* USER\n\n⚠ Ändere das Passwort beim ersten Login.\n☾ welcome to the night.`
              });
              logLove('rbac', `account erstellt: ${createdL.account.username} (user)`, c.brightMagenta);
              break;
            }

            case 'adlogin': {
              /* Gruppen-Admins: Account mit Scope NUR diese Gruppe */
              if (!isGroup) {
                await sock.sendMessage(from, { text: '> 👥 *adlogin* geht nur in Gruppen.' }, { quoted: msg });
                break;
              }
              const meP = (groupMetadata?.participants || []).find((p) => p.id === senderJid);
              const isGrpAdmin = meP && (meP.admin === 'admin' || meP.admin === 'superadmin');
              if (!isGrpAdmin) {
                await sock.sendMessage(from, { text: '> ⛔ *adlogin* ist nur für Admins dieser Gruppe.' }, { quoted: msg });
                await sendReaction(sock, from, reactions.access.reactions.unauthorized, msg.key);
                break;
              }
              const numA = cleanId(senderJid);
              const existingA = rbac.getAccountByNumber(numA);
              if (existingA && existingA.role !== 'groupadmin') {
                await sock.sendMessage(from, { text: `> 🔐 Du hast bereits einen Account: *${existingA.username}* (${existingA.role.toUpperCase()}).` }, { quoted: msg });
                break;
              }
              const createdA = rbac.createAccount({
                username: (msg.pushName || 'admin').slice(0, 12) + '_grp',
                number: numA,
                role: 'groupadmin',
                scope: { type: 'group', groupJid: cleanId(from) },
                mustChange: true
              });
              await sock.sendMessage(senderJid, {
                text: '> ☾ *GROUP ADMIN ACCESS*\n\n' +
                  `• *Gruppe:* ${groupMetadata?.subject || cleanId(from)}\n• *Scope:* NUR diese Gruppe\n` +
                  `• *Username:* ${createdA.account.username}\n• *Temp-Passwort:* ${createdA.tempPassword}\n\n⚠ Passwort beim ersten Login ändern.`
              }).catch(() => {});
              await sock.sendMessage(from, { text: '📬 Zugangsdaten privat zugestellt.\n☾ scope: only this group.' }, { quoted: msg });
              logLove('rbac', `groupadmin-Account: ${createdA.account.username} (${cleanId(from)})`, c.brightMagenta);
              break;
            }

            /* ====================================================== */
            /* ☾ NIGHT & LOVE-/FUN-EXTRAS  (night/commands.js)        */
            /* ====================================================== */
            case 'goodnight':
            case 'gutenacht':
            case 'nacht':
            case 'goodmorning':
            case 'gutenmorgen':
            case 'morgen':
            case 'nightquote':
            case 'nachtzitat':
            case 'nq':
            case 'mood':
            case 'stimmung':
            case 'lovecalc':
            case 'compat':
            case 'flirt':
            case 'anmachen':
            case 'confess':
            case 'geständnis':
            case 'confesslove':
            case 'date':
            case 'dateidee':
            case 'romantic':
            case 'romantisch':
            case 'breakup':
            case 'trennung':
            case 'wouldyou':
            case 'würdestdu':
            case 'quote':
            case 'zitat':
            case 'roast':
            case 'roasten': {
              const senderNameN = msg.pushName || cleanId(senderJid);
              const mentionsN = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
              const quotedN = quoted?.extendedTextMessage?.contextInfo?.participant
                || msg.message?.extendedTextMessage?.contextInfo?.participant;
              const targetJidN = mentionsN[0] || quotedN || '';
              const targetNameN = targetJidN ? '@' + cleanId(targetJidN) : senderNameN;
              const nightText = nightReply(command, {
                senderName: senderNameN,
                targetName: targetNameN,
                argText: args.join(' ')
              });
              if (nightText) {
                await sock.sendMessage(from, {
                  text: nightText,
                  mentions: targetJidN ? [targetJidN] : []
                }, { quoted: msg });
                await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
                logLove('night', `${command} › ${senderNameN}${targetJidN ? ' → ' + cleanId(targetJidN) : ''}`, c.brightMagenta);
              }
              break;
            }

            /* ====================================================== */
            /* 💎 PROFIL & XP                                          */
            /* ====================================================== */
            case 'profile':
            case 'profil': {
              /* 👤 Profil einer anderen Person — öffentlich, OHNE Alter/IDs.
                  Ohne Ziel: das eigene Kompakt-Profil (wie $me).            */
              const profTarget = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
                || quoted?.extendedTextMessage?.contextInfo?.participant
                || args.find((a) => a.startsWith('@') || /^\d{6,}/.test(a))
                || '';

              const sendProfileFor = async (targetProfile, targetKey, targetJid) => {
                const tp = targetProfile;
                if (!tp?.registration?.registered) {
                  await sock.sendMessage(from, { text: '> ❓ Diese Person ist noch nicht registriert.' }, { quoted: msg });
                  return;
                }
                const tName = tp.registration?.name || tp.identity?.username || 'Profil';
                const tSnap = getLoveSnapshot(tp, targetKey);
                const card = buildCompactProfileCard({
                  userProfile: tp, snapshot: tSnap, roleText: '',
                  name: tName, username: tp.identity?.username ? '@' + tp.identity.username : '',
                  regDate: tp.registration?.registeredAt ? new Date(tp.registration.registeredAt).toLocaleDateString('de-DE') : '',
                  pref
                });
                let ppUrl = null;
                try { ppUrl = await sock.profilePictureUrl(targetJid || '', 'image'); } catch (e) { ppUrl = null; }
                if (ppUrl) {
                  await sock.sendMessage(from, { image: { url: ppUrl }, caption: card, mimetype: 'image/jpeg' }, { quoted: msg });
                } else {
                  await sock.sendMessage(from, { text: card }, { quoted: msg });
                }
              };

              if (!profTarget) {
                if (userProfile?.registration?.registered !== true) {
                  await sock.sendMessage(from, { text: '> ❗️ Du bist noch nicht registriert.\n💡 *' + pref + 'register Name.Alter.Status.Stadt*' }, { quoted: msg });
                  break;
                }
                const selfSnap = getLoveSnapshot(userProfile, identityKey(senderJid, senderLid));
                const card = buildCompactProfileCard({
                  userProfile, snapshot: selfSnap, roleText: '',
                  name: userProfile.registration?.name, username: userProfile.identity?.username ? '@' + userProfile.identity.username : '',
                  regDate: userProfile.registration?.registeredAt ? new Date(userProfile.registration.registeredAt).toLocaleDateString('de-DE') : '',
                  pref
                });
                await sock.sendMessage(from, { text: card, mentions: [senderLid] }, { quoted: msg });
                break;
              }

              const t = await resolveBanTarget(sock, profTarget, sessionPath);
              if (!t || (!t.jid && !t.lid)) {
                await sock.sendMessage(from, { text: '> ❌ *Fehler:* Ziel konnte nicht aufgelöst werden. Nutze *' + pref + 'profile @person*.' }, { quoted: msg });
                break;
              }
              const tProfile = await loadUserProfileForSender({ jid: t.jid || '', lid: t.lid || '' });
              await sendProfileFor(tProfile, identityKey(t.jid || '', t.lid || ''), t.jid || t.lid);
              await sendReaction(sock, from, '👤', msg.key);
              break;
            }

            case 'level': {
              const pP = userProfile || {};
              const progP = pP.progression || { level: 0, xp: 0, prestige: 0, neededXpForLvOrPrestigeUp: 743 };
              const loveP = pP.love || {};
              await sock.sendMessage(from, {
                text: '> 💎 *PROFIL*\n\n' +
                  `• *Name:* ${msg.pushName || cleanId(senderJid)}\n` +
                  `• *Level:* ${progP.level} · *Prestige:* ${progP.prestige}\n` +
                  `• *XP:* ${progP.xp} / ${progP.neededXpForLvOrPrestigeUp}\n` +
                  `• *Streak:* ${progP.streak || 0} 🔥\n` +
                  `• *Titel:* ${pP.identity?.title || '—'}\n` +
                  `• *Bio:* ${pP.identity?.bio || '—'}\n` +
                  (loveP.spouseName ? `• *💍 verheiratet mit:* ${loveP.spouseName}\n` : '') +
                  '\n☾ every soul has a story.'
              }, { quoted: msg });
              break;
            }

            case 'leaderboard':
            case 'lb':
            case 'top': {
              const dbL = readDb();
              const rowsL = Object.values(dbL.users || {})
                .filter((u) => u && u.progression)
                .sort((a, b) => (b.progression.xp || 0) - (a.progression.xp || 0))
                .slice(0, 10);
              if (!rowsL.length) {
                await sock.sendMessage(from, { text: '☾ leaderboard is empty.\nnobody is awake yet.' }, { quoted: msg });
                break;
              }
              const medalsL = ['👑', '', '💜'];
              await sock.sendMessage(from, {
                text: '> 🏆 *LOVE-LEADERBOARD*\n\n' + rowsL.map((u, i) =>
                  `${medalsL[i] || '•'} *${i + 1}.* ${u.identity?.username || cleanId(u.identity?.jid || '?')} — Lv ${u.progression.level} · ${u.progression.xp} XP`
                ).join('\n') + '\n\n♡ stay a little longer.'
              }, { quoted: msg });
              break;
            }

            case 'daily': {
              const dbD = readDb();
              const bidD = userProfile?.identity?.bid || cleanId(senderJid);
              if (!dbD.users[bidD]) dbD.users[bidD] = { identity: { bid: bidD } };
              const uD = dbD.users[bidD];
              uD.progression = uD.progression || { level: 0, xp: 0, prestige: 0, neededXpForLvOrPrestigeUp: 743 };
              const todayD = new Date().toISOString().slice(0, 10);
              if (uD.progression.lastDaily === todayD) {
                await sock.sendMessage(from, { text: '☾ you already collected today.\nthe night rewards patience.' }, { quoted: msg });
                break;
              }
              uD.progression.lastDaily = todayD;
              uD.progression.xp = (uD.progression.xp || 0) + 50;
              writeDb(dbD);
              await sock.sendMessage(from, {
                text: `> 💎 *DAILY*\n\n+50 XP gesammelt.\n• *Gesamt:* ${uD.progression.xp} XP\n\n♡ come back tomorrow. I'll be here.`
              }, { quoted: msg });
              await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              break;
            }

            case 'streak': {
              const progS = userProfile?.progression || {};
              await sock.sendMessage(from, {
                text: `> 🔥 *STREAK*\n\n• *Aktuelle Serie:* ${progS.streak || 0} Tage\n• *Bestwert:* ${progS.bestStreak || progS.streak || 0} Tage\n\n☾ consistency is a love language.`
              }, { quoted: msg });
              break;
            }

            case 'achievements':
            case 'badges': {
              const xpA = userProfile?.progression?.xp || 0;
              const listA = [
                ['💌', 'First Love', xpA >= 1],
                ['💗', '100 Messages', xpA >= 100],
                ['❤️', '7 Day Streak', (userProfile?.progression?.streak || 0) >= 7],
                ['💘', 'First Crush', !!userProfile?.love?.crush],
                ['💍', 'Soulmate', !!userProfile?.love?.spouseName],
                ['🌹', 'Romantic', xpA >= 2500],
                ['👑', 'Love Legend', (userProfile?.progression?.level || 0) >= 100]
              ];
              await sock.sendMessage(from, {
                text: '> 🏆 *ACHIEVEMENTS*\n\n' + listA.map(([ic, nm, ok]) =>
                  `${ok ? ic : '🔒'} *${nm}* — ${ok ? 'unlocked' : 'locked'}`).join('\n') + '\n\n☾ nothing lasts forever. except badges.'
              }, { quoted: msg });
              break;
            }

            case 'title': {
              const dbT = readDb();
              const bidT = userProfile?.identity?.bid || cleanId(senderJid);
              if (!dbT.users[bidT]) dbT.users[bidT] = { identity: { bid: bidT } };
              dbT.users[bidT].identity = dbT.users[bidT].identity || {};
              const newTitle = args.join(' ').slice(0, 30);
              if (!newTitle) {
                await sock.sendMessage(from, { text: `> 🏷️ *Titel anzeigen/setzen*\n\nAktuell: *${dbT.users[bidT].identity.title || '—'}*\n\nNutze: *${pref}title <text>*` }, { quoted: msg });
                break;
              }
              dbT.users[bidT].identity.title = newTitle;
              writeDb(dbT);
              await sock.sendMessage(from, { text: `> 🏷️ Titel gesetzt: *${newTitle}*\n\n☾ wear it well.` }, { quoted: msg });
              break;
            }

            case 'setbio': {
              const dbB = readDb();
              const bidB = userProfile?.identity?.bid || cleanId(senderJid);
              if (!dbB.users[bidB]) dbB.users[bidB] = { identity: { bid: bidB } };
              dbB.users[bidB].identity = dbB.users[bidB].identity || {};
              const newBio = args.join(' ').slice(0, 120);
              if (!newBio) {
                await sock.sendMessage(from, { text: `> 📝 *Bio setzen*\n\nAktuell: *${dbB.users[bidB].identity.bio || '—'}*\n\nNutze: *${pref}setbio <text>*` }, { quoted: msg });
                break;
              }
              dbB.users[bidB].identity.bio = newBio;
              writeDb(dbB);
              await sock.sendMessage(from, { text: `> 📝 Bio gesetzt:\n„${newBio}"\n\n☾ words for the night.` }, { quoted: msg });
              break;
            }

            /* ====================================================== */
            /* 👥 GRUPPEN-EXTRAS                                       */
            /* ====================================================== */
            case 'tagall':
            case 'alle': {
              if (!isGroup) {
                await sock.sendMessage(from, { text: '> 👥 Nur in Gruppen möglich.' }, { quoted: msg });
                break;
              }
              if (userRole !== 'host' && userRole !== 'superadmin' && userRole !== 'admin') {
                await sock.sendMessage(from, { text: '> ⛔ *Zugriff verweigert:* Nur Admins dürfen alle markieren.' }, { quoted: msg });
                break;
              }
              const partsT = groupMetadata?.participants || [];
              const mentionT = partsT.map((p) => p.id).filter((id) => id !== senderJid);
              const topicT = args.join(' ') || '☾ attention, everyone.';
              await sock.sendMessage(from, {
                text: `> 📣 *${topicT}*\n\n` + mentionT.map((id) => '@' + cleanId(id)).join(' ') + `\n\n_${groupMetadata?.subject || 'Gruppe'} · ${mentionT.length} Seelen_`,
                mentions: mentionT
              }, { quoted: msg });
              logLove('group', `tagall in ${groupMetadata?.subject || from} (${mentionT.length})`, c.brightCyan);
              break;
            }

            case 'warn': {
              if (!isGroup) { await sock.sendMessage(from, { text: '> 👥 Nur in Gruppen möglich.' }, { quoted: msg }); break; }
              if (userRole !== 'host' && userRole !== 'superadmin' && userRole !== 'admin') {
                await sock.sendMessage(from, { text: '> ⛔ *Zugriff verweigert:* Nur Admins dürfen verwarnen.' }, { quoted: msg });
                break;
              }
              const mentionsW = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
              const quotedW = quoted?.extendedTextMessage?.contextInfo?.participant || msg.message?.extendedTextMessage?.contextInfo?.participant;
              const targetW = mentionsW[0] || quotedW || '';
              if (!targetW) {
                await sock.sendMessage(from, { text: `> ⚠️ *Verwarnen*\n\nNutze: *${pref}warn @person [grund]*` }, { quoted: msg });
                break;
              }
              const dbW = readDb();
              const gidW = cleanId(from);
              dbW.groups[gidW] = dbW.groups[gidW] || {};
              dbW.groups[gidW].warns = dbW.groups[gidW].warns || {};
              const keyW = cleanId(targetW);
              dbW.groups[gidW].warns[keyW] = (dbW.groups[gidW].warns[keyW] || 0) + 1;
              const countW = dbW.groups[gidW].warns[keyW];
              writeDb(dbW);
              await sock.sendMessage(from, {
                text: `> ⚠️ *VERWARNUNG ${countW}/3*\n\n• *Person:* @${keyW}\n• *Grund:* ${args.slice(1).join(' ') || 'Kein Grund angegeben'}\n\n☾ 3 Verwarnungen = Kick & Ban.`,
                mentions: [targetW]
              }, { quoted: msg });
              logLove('group', `warn ${keyW} (${countW}/3) in ${gidW}`, c.brightYellow);
              break;
            }

            case 'warnings':
            case 'warns': {
              if (!isGroup) { await sock.sendMessage(from, { text: '> 👥 Nur in Gruppen möglich.' }, { quoted: msg }); break; }
              const dbW2 = readDb();
              const warns2 = dbW2.groups?.[cleanId(from)]?.warns || {};
              const entries2 = Object.entries(warns2).filter(([, n]) => n > 0);
              if (!entries2.length) {
                await sock.sendMessage(from, { text: '☾ keine Verwarnungen.\neveryone behaves. suspicious.' }, { quoted: msg });
                break;
              }
              await sock.sendMessage(from, {
                text: '> ⚠️ *VERWARNUNGEN*\n\n' + entries2.map(([jid, n]) => `• @${jid} — ${n}/3`).join('\n')
              }, { quoted: msg, mentions: entries2.map(([jid]) => jid + '@s.whatsapp.net') });
              break;
            }

            case 'lock':
            case 'unlock': {
              if (!isGroup) { await sock.sendMessage(from, { text: '> 👥 Nur in Gruppen möglich.' }, { quoted: msg }); break; }
              if (userRole !== 'host' && userRole !== 'superadmin' && userRole !== 'admin') {
                await sock.sendMessage(from, { text: '> ⛔ *Zugriff verweigert:* Nur Admins.' }, { quoted: msg });
                break;
              }
              const lockOn = command === 'lock';
              await sock.groupSettingUpdate(from, lockOn ? 'announcement' : 'not_announcement');
              await sock.sendMessage(from, {
                text: lockOn
                  ? '🔒 *Gruppe gesperrt* — nur Admins können schreiben.\n☾ silence, but controlled.'
                  : '🔓 *Gruppe geöffnet* — alle können schreiben.\n☾ the room is alive again.'
              }, { quoted: msg });
              logLove('group', `${lockOn ? 'lock' : 'unlock'} in ${cleanId(from)}`, c.brightCyan);
              break;
            }

            case 'groupinfo':
            case 'admins':
            case 'members': {
              if (!isGroup) { await sock.sendMessage(from, { text: '> 👥 Nur in Gruppen möglich.' }, { quoted: msg }); break; }
              const partsG = groupMetadata?.participants || [];
              const adminsG = partsG.filter((p) => p.admin === 'admin' || p.admin === 'superadmin');
              await sock.sendMessage(from, {
                text: '> 👥 *GRUPPEN-INFO*\n\n' +
                  `• *Name:* ${groupMetadata?.subject || '—'}\n` +
                  `• *Mitglieder:* ${partsG.length}\n` +
                  `• *Admins:* ${adminsG.length}\n` +
                  `• *Erstellt:* ${groupMetadata?.creation ? new Date(groupMetadata.creation * 1000).toLocaleDateString('de-DE') : '—'}\n` +
                  (groupMetadata?.desc ? `• *Beschreibung:* ${String(groupMetadata.desc).slice(0, 200)}\n` : '') +
                  '\n☾ a room with souls.'
              }, { quoted: msg });
              break;
            }

            case 'an':
            case 'enable':
            case 'anschalten':
            case 'einschalten': {
              await handleFeatureToggle(sock, from, msg, args, true, userRole, groupMetadata);
              break;
            }

            case 'aus':
            case 'disable':
            case 'ausschalten':
            case 'abschalten': {
              await handleFeatureToggle(sock, from, msg, args, false, userRole, groupMetadata);
              break;
            }

            case 'gi':
            case 'features':
            case 'featurelist':
            case 'gruppenfeatures': {
              if (!isGroup) {
                await sock.sendMessage(from, {
                  text: '> 🎛️ *FEATURES GIBT ES NUR IN GRUPPEN*\n\n' +
                    'In Privat-Chats ist immer alles aktiv. 💜\n\n' +
                    '*Verfügbare Features:*\n' +
                    GROUP_FEATURES.map((f) => `${f.emoji} *${f.key}* — ${f.label}`).join('\n')
                }, { quoted: msg });
                break;
              }
              const featureDb = readDb();
              const overview = buildFeatureOverviewText(featureDb, cleanId(from), groupMetadata?.subject || '');
              await sock.sendMessage(from, { text: overview }, { quoted: msg });
              await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              logLove('features', 'Feature-Übersicht gesendet.', c.brightCyan);
              break;
            }

            /* ====================================================== */
            /* 💍 MARRY-SYSTEM                                        */
            /* ====================================================== */
            case 'marry':
            case 'heiraten':
            case 'propose': {
              const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
              const quotedParticipant = quoted?.extendedTextMessage?.contextInfo?.participant
                || msg.message?.extendedTextMessage?.contextInfo?.participant;
              const targetRaw = mentions[0] || quotedParticipant || args[0] || '';

              if (!targetRaw) {
                await sock.sendMessage(from, {
                  text: '> 💍 *HEIRATSANTRAG — VERWENDUNG*\n\n' +
                    `• *${pref}marry @person* — fragt die Person\n` +
                    `• Oder antworte auf eine Nachricht mit *${pref}marry*\n\n` +
                    'Die Person kann per Button oder mit *Ja* / *Nein* antworten. 🌹'
                }, { quoted: msg });
                await sendReaction(sock, from, reactions.input.reactions.invalidInput, msg.key);
                break;
              }

              const target = await resolveBanTarget(sock, targetRaw, sessionPath);
              if (!target || (!target.jid && !target.lid)) {
                await sock.sendMessage(from, { text: '> ❌ *Fehler:* Ziel konnte nicht aufgelöst werden.' }, { quoted: msg });
                break;
              }

              const senderKey = identityKey(senderJid, senderLid);
              const targetKey = target.key || identityKey(target.jid, target.lid);
              if (cleanId(targetKey) === cleanId(senderKey)) {
                await sock.sendMessage(from, { text: '> 😅 *Selbstliebe ist wichtig* — aber dich selbst kannst du nicht heiraten!' }, { quoted: msg });
                await sendReaction(sock, from, '😅', msg.key);
                break;
              }

              if (userProfile?.love?.married === true) {
                await sock.sendMessage(from, {
                  text: `> 💍 *Du bist bereits verheiratet!*\n\nDein Herz gehört *${userProfile.love.spouseName || 'jemandem'}*. 🌹\nErst *${pref}divorce*, dann neu verlieben …`
                }, { quoted: msg });
                await sendReaction(sock, from, '💍', msg.key);
                break;
              }

              const targetProfile = await loadUserProfileForSender({ jid: target.jid || '', lid: target.lid || '' });
              if (targetProfile?.love?.married === true) {
                await sock.sendMessage(from, {
                  text: `> 💔 *Vergeben!*\n\nDiese Person ist bereits mit *${targetProfile.love.spouseName || 'jemandem'}* verheiratet. 🌹`
                }, { quoted: msg });
                await sendReaction(sock, from, '💔', msg.key);
                break;
              }

              const db = readDb();
              const proposals = getMarryProposals(db);
              for (const k of Object.keys(proposals)) {
                if (!proposals[k] || (proposals[k].expiresAt || 0) < Date.now()) delete proposals[k];
              }
              if (findMarryProposalFor(db, targetKey, null)) {
                await sock.sendMessage(from, { text: '> 💌 Diese Person hat bereits einen offenen Heiratsantrag. Geduld! 🌹' }, { quoted: msg });
                break;
              }

              const fromName = getProfileDisplayName(userProfile, msg.pushName || cleanId(senderJid));
              const toName = getProfileDisplayName(targetProfile, cleanId(target.jid || target.lid));
              const mentionFrom = senderJid || senderLid;
              const mentionTo = target.jid || target.lid;

              proposals[targetKey] = {
                id: randomUUID(),
                fromKey: senderKey,
                fromJid: senderJid,
                fromLid: senderLid,
                fromName,
                toKey: targetKey,
                toJid: target.jid || '',
                toLid: target.lid || '',
                toName,
                chatJid: from,
                createdAt: Date.now(),
                expiresAt: Date.now() + MARRY_EXPIRY_MS
              };
              writeDb(db);

              const proposalText =
                '🌹━━━━━━━━━━━━━━━━🌹\n\n' +
                '💍✨ *EIN HEIRATSANTRAG!* ✨💍\n\n' +
                `❤️ *@${cleanId(mentionFrom)}* kniet nieder, hält die Rosen bereit und fragt:\n\n` +
                `✨ *@${cleanId(mentionTo)}*, willst du mich heiraten? ✨\n\n` +
                '🌹━━━━━━━━━━━━━━━━🌹\n' +
                '⏳ *2 Minuten* Zeit zum Antworten.\n' +
                `👇 Button nutzen oder einfach *Ja* / *Nein* schreiben.`;

              await sock.sendMessage(from, {
                text: proposalText,
                mentions: [mentionFrom, mentionTo].filter(Boolean)
              }, { quoted: msg });

              await sendInteractiveMenu(sock, from, {
                title: '💍 ANTRAG BEANTWORTEN',
                description: `@${cleanId(mentionTo)}, was sagst du?`,
                buttonText: '💌 ANTWORT WÄHLEN',
                footerText: '🌹 LoveBot by Maxichen',
                sections: [{
                  title: 'Deine Antwort',
                  rows: [
                    { rowId: 'cmd:marryaccept ' + proposals[targetKey].id.slice(0, 8), title: '💍 JA, ich will!', description: `Heirate @${cleanId(mentionFrom)}` },
                    { rowId: 'cmd:marrydeny ' + proposals[targetKey].id.slice(0, 8), title: '💔 Nein, tut mir leid', description: 'Lehne den Antrag ab' }
                  ]
                }]
              });

              await sendReaction(sock, from, '💍', msg.key);
              logLove('marry', `${fromName} hat ${toName} einen Antrag gemacht.`, c.brightMagenta);
              break;
            }

            case 'marryaccept':
            case 'marryyes':
            case 'marryja': {
              /* 🔐 Sichere Antwort: Button übergibt die Request-ID als Argument
                 (marry:accept:<requestId>) — nur der Adressat darf antworten. */
              const db = readDb();
              const senderKey = identityKey(senderJid, senderLid);
              const idArg = String(args[0] || '').trim();
              let proposal = null;
              let wrongUser = null;
              if (idArg) {
                const p = Object.values(getMarryProposals(db)).find((x) => x?.id && String(x.id).startsWith(idArg)) || null;
                if (p) {
                  const iAmTarget = [p.toKey, p.toJid, p.toLid].some((k) => k && cleanId(k) === cleanId(senderKey));
                  if (iAmTarget) proposal = p; else wrongUser = p;
                }
              } else {
                proposal = findMarryProposalFor(db, senderKey, null);
              }
              if (wrongUser) {
                await sock.sendMessage(from, {
                  text: '> 🛡️ *Nur der Adressat darf antworten.*\n\nDieser Antrag geht an *@' + cleanId(wrongUser.toJid || wrongUser.toLid || '') + '* — und nur diese Person kann ihn annehmen. 🌹',
                  mentions: [wrongUser.toJid || wrongUser.toLid].filter(Boolean)
                }, { quoted: msg });
                break;
              }
              if (!proposal) {
                await sock.sendMessage(from, { text: idArg
                  ? '> ⏰ *Dieser Heiratsantrag ist abgelaufen* oder wurde bereits beantwortet.\n\n💡 Ihr könnt es mit einem neuen Antrag versuchen. 🌹'
                  : '> 🤷 *Kein offener Heiratsantrag* für dich gefunden.\n\n💡 Anträge laufen nach 2 Minuten ab.' }, { quoted: msg });
                await sendReaction(sock, from, reactions.input.reactions.invalidInput, msg.key);
                break;
              }
              await completeMarryDecision(sock, from, proposal, 'accept', msg);
              await sendReaction(sock, from, '💍', msg.key);
              break;
            }

            case 'marrydeny':
            case 'marryno':
            case 'marrynein': {
              const db = readDb();
              const senderKey = identityKey(senderJid, senderLid);
              const idArg = String(args[0] || '').trim();
              let proposal = null;
              let wrongUser = null;
              if (idArg) {
                const p = Object.values(getMarryProposals(db)).find((x) => x?.id && String(x.id).startsWith(idArg)) || null;
                if (p) {
                  const iAmTarget = [p.toKey, p.toJid, p.toLid].some((k) => k && cleanId(k) === cleanId(senderKey));
                  if (iAmTarget) proposal = p; else wrongUser = p;
                }
              } else {
                proposal = findMarryProposalFor(db, senderKey, null);
              }
              if (wrongUser) {
                await sock.sendMessage(from, {
                  text: '> 🛡️ *Nur der Adressat darf antworten.*\n\nDieser Antrag geht an *@' + cleanId(wrongUser.toJid || wrongUser.toLid || '') + '*.',
                  mentions: [wrongUser.toJid || wrongUser.toLid].filter(Boolean)
                }, { quoted: msg });
                break;
              }
              if (!proposal) {
                await sock.sendMessage(from, { text: idArg
                  ? '> ⏰ *Dieser Heiratsantrag ist abgelaufen* oder wurde bereits beantwortet.'
                  : '> 🤷 *Kein offener Heiratsantrag* für dich gefunden.' }, { quoted: msg });
                break;
              }
              await completeMarryDecision(sock, from, proposal, 'deny', msg);
              await sendReaction(sock, from, '💔', msg.key);
              break;
            }

            case 'divorce':
            case 'scheidung': {
              const love = userProfile?.love;
              if (!love || love.married !== true) {
                await sock.sendMessage(from, { text: '> 🕊️ *Du bist gar nicht verheiratet.*\n\n💡 Finde die Liebe mit *' + pref + 'marry @user*!' }, { quoted: msg });
                break;
              }
              const spouseName = love.spouseName || 'Unbekannt';
              const spouseKey = cleanId(love.spouseKey || '');
              const since = love.marriedAt ? new Date(love.marriedAt) : null;
              const days = since ? Math.max(0, Math.floor((Date.now() - since.getTime()) / 86400000)) : 0;

              /* ❤️ Love Core: Trennung zählen (erscheint später in $love) */
              try { countBreakup(coupleKeyForProfile(userProfile)); } catch (breakupErr) {}

              userProfile.love = {
                married: false,
                spouseName: null,
                spouseKey: null,
                spouseBid: null,
                marriedAt: null,
                divorcedAt: new Date().toISOString(),
                marriages: love.marriages || 1
              };
              saveUserProfile(userProfile);

              if (spouseKey) {
                try {
                  const spouseProfile = await loadUserProfileForSender({
                    jid: `${spouseKey}@s.whatsapp.net`,
                    lid: `${spouseKey}@lid`
                  });
                  if (spouseProfile?.love?.married === true) {
                    spouseProfile.love.married = false;
                    spouseProfile.love.spouseName = null;
                    spouseProfile.love.spouseKey = null;
                    spouseProfile.love.divorcedAt = new Date().toISOString();
                    saveUserProfile(spouseProfile);
                    try {
                      await sock.sendMessage(`${spouseKey}@s.whatsapp.net`, {
                        text: `> 💔 *Scheidung …*\n\n*${userProfile?.registration?.name || 'Dein(e) Ex-Partner(in)'}* hat die Ehe mit dir beendet.\n_${days} Tag${days === 1 ? '' : 'e'} sind vorbei._ 🥀`
                      });
                    } catch (pnErr) {}
                  }
                } catch (spouseErr) {
                  logLove('divorce', 'Ex-Partner-Profil nicht gefunden.', c.brightYellow);
                }
              }

              await sock.sendMessage(from, {
                text: '💔 *SCHEIDUNG EINGEREICHT* 💔\n\n' +
                  `Die Ehe mit *${spouseName}* ist nach ${days} Tag${days === 1 ? '' : 'e'} beendet.\n\n` +
                  '🥀 _Manchmal ist Loslassen auch Liebe._\n' +
                  '🕊️ Du bist jetzt wieder Single.'
              }, { quoted: msg });
              await sendReaction(sock, from, '💔', msg.key);
              logLove('divorce', `Ehe mit ${spouseName} geschieden.`, c.brightYellow);
              break;
            }

            /* ====================================================== */
            /* 📥 AUTO-DOWNLOAD TOGGLE                                 */
            /* ====================================================== */
            case 'autodl':
            case 'autodownload': {
              if (!isGroup) {
                await sock.sendMessage(from, {
                  text: '> 📥 *AUTO-DOWNLOAD*\n\nIn Privat-Chats ist der Auto-Download immer aktiv.\nIn Gruppen kannst du ihn hier an-/ausschalten.'
                }, { quoted: msg });
                break;
              }
              const mode = (args[0] || '').toLowerCase();
              const db = readDb();
              const gid = cleanId(from);
              if (!db.groups[gid]) db.groups[gid] = {};

              if (!mode || mode === 'status') {
                const isOn = db.groups[gid].autodl !== false;
                await sock.sendMessage(from, {
                  text: `> 📥 *AUTO-DOWNLOAD*\n\n• *Status:* ${isOn ? '✅ AN' : '❌ AUS'}\n\nYouTube-, TikTok- und Instagram-Links werden automatisch heruntergeladen.\n\n💡 *${pref}autodl on|off* zum Ändern (nur Admins).`
                }, { quoted: msg });
                break;
              }

              if (userRole !== 'host' && userRole !== 'superadmin' && userRole !== 'admin') {
                await sock.sendMessage(from, { text: `> ⛔ *Zugriff verweigert:* Nur Admins können den Auto-Download umschalten.` }, { quoted: msg });
                await sendReaction(sock, from, reactions.access.reactions.unauthorized, msg.key);
                break;
              }

              if (mode === 'on') {
                db.groups[gid].autodl = true;
                writeDb(db);
                await sock.sendMessage(from, { text: '> 📥✅ *AUTO-DOWNLOAD AKTIVIERT*\n\nYouTube-, TikTok- und Instagram-Links werden jetzt automatisch geladen.' }, { quoted: msg });
                await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              } else if (mode === 'off') {
                db.groups[gid].autodl = false;
                writeDb(db);
                await sock.sendMessage(from, { text: '> 📥❌ *AUTO-DOWNLOAD DEAKTIVIERT*\n\nLinks werden nicht mehr automatisch geladen.\n💡 *' + pref + 'play <link>* funktioniert weiterhin.' }, { quoted: msg });
                await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              } else {
                await sock.sendMessage(from, { text: `> ❓ *Verwendung:* ${pref}autodl on|off` }, { quoted: msg });
              }
              break;
            }

            /* ====================================================== */
            /* 👑 NEUE OWNER-BEFEHLE                                   */
            /* ====================================================== */
            case 'bc':
            case 'broadcast': {
              if (!isHost) {
                await sock.sendMessage(from, { text: '> ⛔ *Zugriff verweigert:* Broadcast ist nur für den Owner.' }, { quoted: msg });
                await sendReaction(sock, from, reactions.access.reactions.unauthorized, msg.key);
                break;
              }
              const bcText = args.join(' ');
              if (!bcText) {
                await sock.sendMessage(from, { text: `> 📢 *BROADCAST — VERWENDUNG*\n\nNutze: *${pref}bc <text>*\n\nSendet die Nachricht an ALLE Gruppen, in denen der Bot ist.` }, { quoted: msg });
                break;
              }
              let groups = {};
              try {
                groups = await sock.groupFetchAllParticipating();
              } catch (fetchErr) {
                groups = {};
              }
              const groupJids = Object.keys(groups || {});
              await sock.sendMessage(from, { text: `> 📢 *BROADCAST STARTET*\n\n• *Gruppen:* ${groupJids.length}\n⏳ Wird gesendet …` }, { quoted: msg });
              const broadcastBody =
                '> 📢 *LOVE BOT — BROADCAST* 📢\n' +
                '┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈\n' +
                bcText + '\n' +
                '┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈\n' +
                `_Von @${cleanId(senderJid)} · LoveBot by Maxichen_ 🌹`;
              let okCount = 0;
              let failCount = 0;
              for (const gjid of groupJids) {
                try {
                  await sock.sendMessage(gjid, { text: broadcastBody, mentions: [senderJid] });
                  okCount++;
                } catch (bcErr) {
                  failCount++;
                }
                await delay(400);
              }
              await sock.sendMessage(from, {
                text: `> 📢 *BROADCAST FERTIG* ✅\n\n• *Gesendet:* ${okCount}\n• *Fehlgeschlagen:* ${failCount}\n• *Gesamt:* ${groupJids.length}`
              }, { quoted: msg });
              await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              logLove('bc', `Broadcast an ${okCount}/${groupJids.length} Gruppen gesendet.`, c.brightGreen);
              break;
            }

            case 'setppbot':
            case 'setbotpp':
            case 'setpp': {
              if (!isHost) {
                await sock.sendMessage(from, { text: '> ⛔ *Zugriff verweigert:* Nur der Owner kann das Bot-Bild ändern.' }, { quoted: msg });
                await sendReaction(sock, from, reactions.access.reactions.unauthorized, msg.key);
                break;
              }
              if (!quoted || !quoted.imageMessage) {
                await sock.sendMessage(from, { text: `> 🖼️ *BOT-BILD SETZEN*\n\nAntworte auf ein *Bild* mit *${pref}setppbot*.` }, { quoted: msg });
                break;
              }
              try {
                const imgStream = await downloadContentFromMessage(quoted.imageMessage, 'image');
                const imgBuffer = await streamToBuffer(imgStream);
                if (!imgBuffer || !imgBuffer.length) throw new Error('Bild konnte nicht geladen werden.');
                await sock.updateProfilePicture(sock.user?.id || from, imgBuffer);
                await sock.sendMessage(from, { text: '> 🖼️✅ *Bot-Profilbild aktualisiert!*\n\nDer neue Look steht dir! 💜' }, { quoted: msg });
                await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
                logLove('setppbot', 'Bot-Profilbild aktualisiert.', c.brightGreen);
              } catch (ppErr) {
                await sock.sendMessage(from, { text: `> ❌ *Fehler beim Setzen des Bot-Bilds:*\n${ppErr?.message || ppErr}` }, { quoted: msg });
                await sendReaction(sock, from, reactions.errors.reactions.error, msg.key);
              }
              break;
            }

            case 'setbotname':
            case 'setnamebot': {
              if (!isHost) {
                await sock.sendMessage(from, { text: '> ⛔ *Zugriff verweigert:* Nur der Owner kann den Bot-Namen ändern.' }, { quoted: msg });
                await sendReaction(sock, from, reactions.access.reactions.unauthorized, msg.key);
                break;
              }
              const newBotName = args.join(' ').trim();
              if (!newBotName) {
                await sock.sendMessage(from, { text: `> 🏷️ *BOT-NAME SETZEN*\n\nNutze: *${pref}setbotname <name>*` }, { quoted: msg });
                break;
              }
              try {
                await sock.updateProfileName(newBotName);
                await sock.sendMessage(from, { text: `> 🏷️✅ *Bot-Name geändert!*\n\nNeuer Name: *${newBotName}*` }, { quoted: msg });
                await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
                logLove('setbotname', `Bot-Name geändert zu "${newBotName}".`, c.brightGreen);
              } catch (nameErr) {
                await sock.sendMessage(from, { text: `> ❌ *Fehler beim Ändern des Namens:*\n${nameErr?.message || nameErr}` }, { quoted: msg });
              }
              break;
            }

            case 'blocklist':
            case 'blocked': {
              if (!isHost) {
                await sock.sendMessage(from, { text: '> ⛔ *Zugriff verweigert:* Die Blocklist ist nur für den Owner.' }, { quoted: msg });
                await sendReaction(sock, from, reactions.access.reactions.unauthorized, msg.key);
                break;
              }
              let blockList = [];
              try {
                if (typeof sock.fetchBlocklist === 'function') {
                  blockList = await sock.fetchBlocklist();
                }
              } catch (blErr) {
                blockList = [];
              }
              if (!blockList || !blockList.length) {
                await sock.sendMessage(from, { text: '> 🚫 *BLOCKLIST*\n\nNiemand ist blockiert. 💜' }, { quoted: msg });
              } else {
                const lines = blockList.map((jid, i) => `${i + 1}. ${cleanId(jid)}`);
                await sock.sendMessage(from, {
                  text: `> 🚫 *BLOCKLIST* (${blockList.length})\n\n${lines.join('\n')}\n\n💡 Entblocken: *${pref}unblock <nummer>*`
                }, { quoted: msg });
              }
              await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              break;
            }

            /* ====================================================== */
            /* 💘 LIEBE- & FUN-BEFEHLE                                 */
            /* ====================================================== */
            case 'ship':
            case 'lovetest':
            case 'loveometer': {
              const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
              let firstRaw = mentions[0] || args[0] || quoted?.extendedTextMessage?.contextInfo?.participant || '';
              let secondRaw = mentions[1] || args[1] || '';
              if (!firstRaw) {
                await sock.sendMessage(from, { text: `> 💘 *LOVE-O-METER*\n\nNutze: *${pref}ship @user1 @user2*\n\nMit nur einem User wirst du mit dir selbst verkuppelt 😏` }, { quoted: msg });
                break;
              }
              if (!secondRaw) secondRaw = senderJid;
              const first = await resolveBanTarget(sock, firstRaw, sessionPath);
              const second = await resolveBanTarget(sock, secondRaw, sessionPath);
              const firstKey = cleanId(first?.key || firstRaw);
              const secondKey = cleanId(second?.key || secondRaw);
              const firstProfile = await loadUserProfileForSender({ jid: first?.jid || '', lid: first?.lid || '' });
              const secondProfile = await loadUserProfileForSender({ jid: second?.jid || '', lid: second?.lid || '' });
              const firstName = getProfileDisplayName(firstProfile, cleanId(first?.jid || first?.lid || firstRaw));
              const secondName = getProfileDisplayName(secondProfile, cleanId(second?.jid || second?.lid || secondRaw));
              const pct = shipHashPercent(firstKey, secondKey);
              const shipText =
                '💘 *LOVE-O-METER* 💘\n\n' +
                `👤 *${firstName}*\n` +
                `👤 *${secondName}*\n\n` +
                `${shipBar(pct)}\n` +
                `*${pct}%* ${pct >= 55 ? '💜' : '💔'}\n\n` +
                `_${shipComment(pct)}_` +
                (pct >= 75 ? `\n\n💍 Wie wär's mit *${pref}marry*?` : '');
              await sock.sendMessage(from, { text: shipText }, { quoted: msg });
              await sendReaction(sock, from, '💘', msg.key);
              break;
            }

            case 'kiss':
            case 'kuss':
            case 'hug':
            case 'umarmen':
            case 'slap':
            case 'ohrfeige': {
              const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
              const rpRaw = mentions[0] || quoted?.extendedTextMessage?.contextInfo?.participant || args[0] || '';
              if (!rpRaw) {
                await sock.sendMessage(from, { text: `> ${command === 'slap' || command === 'ohrfeige' ? '🖐️' : (command === 'hug' || command === 'umarmen' ? '🤗' : '💋')} *VERWENDUNG*\n\nNutze: *${pref}${command} @user*` }, { quoted: msg });
                break;
              }
              const rpTarget = await resolveBanTarget(sock, rpRaw, sessionPath);
              const targetMention = rpTarget?.jid || rpTarget?.lid || rpRaw;
              if (cleanId(targetMention) === cleanId(senderJid)) {
                await sock.sendMessage(from, { text: '> 😅 Das kannst du nicht mit dir selbst machen … oder doch? 🤔' }, { quoted: msg });
                break;
              }
              const phrases = (command === 'slap' || command === 'ohrfeige')
                ? SLAP_PHRASES
                : (command === 'hug' || command === 'umarmen') ? HUG_PHRASES : KISS_PHRASES;
              const emoji = (command === 'slap' || command === 'ohrfeige') ? '🖐️' : (command === 'hug' || command === 'umarmen') ? '🤗' : '💋';
              await sock.sendMessage(from, {
                text: `${emoji} *@${cleanId(senderJid)}* ${pickRandom(phrases)} *@${cleanId(targetMention)}*`,
        mentions: [senderJid, targetMention].filter(Boolean)
              }, { quoted: msg });
              await sendReaction(sock, from, emoji, msg.key);
              break;
            }

            case 'compliment':
            case 'lob':
            case 'kompliment': {
              const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
              const compRaw = mentions[0] || quoted?.extendedTextMessage?.contextInfo?.participant || args[0] || senderJid;
              const compTarget = await resolveBanTarget(sock, compRaw, sessionPath);
              const compMention = compTarget?.jid || compTarget?.lid || compRaw;
              const isSelf = cleanId(compMention) === cleanId(senderJid);
              const compText = isSelf
                ? `🌹 *@${cleanId(senderJid)}*, Selbstliebe ist wichtig:\n\n*${pickRandom(LOVEBOT_COMPLIMENTS)}*`
                : `🌹 *@${cleanId(compMention)}*, hör gut zu:\n\n*${pickRandom(LOVEBOT_COMPLIMENTS)}*\n\n_— überbracht von @${cleanId(senderJid)}_ 💌`;
              await sock.sendMessage(from, {
                text: compText,
                mentions: isSelf ? [senderJid] : [compMention, senderJid].filter(Boolean)
              }, { quoted: msg });
              await sendReaction(sock, from, '🌹', msg.key);
              break;
            }

            case '8ball':
            case 'achtball':
            case 'magie': {
              const question = args.join(' ') || (quoted && (quoted.conversation || quoted.extendedTextMessage?.text)) || '';
              const answer = pickRandom(EIGHTBALL_ANSWERS);
              await sock.sendMessage(from, {
                text: `> 🎱 *MAGIC 8-BALL*\n\n${question ? `*Frage:* ${question}\n` : ''}${answer}`
              }, { quoted: msg });
              await sendReaction(sock, from, '🎱', msg.key);
              break;
            }

            case 'rps':
            case 'schere': {
              const choiceMap = {
                stein: 'stein', rock: 'stein', s: 'stein', '✊': 'stein',
                papier: 'papier', paper: 'papier', p: 'papier', '✋': 'papier',
                schere: 'schere', scissors: 'schere', sc: 'schere', '✌️': 'schere'
              };
              const playerChoice = choiceMap[(args[0] || '').toLowerCase()];
              if (!playerChoice) {
                await sock.sendMessage(from, { text: `> ✊✋✌️ *SCHERE-STEIN-PAPIER*\n\nNutze: *${pref}rps stein|papier|schere*` }, { quoted: msg });
                break;
              }
              const botChoice = pickRandom(['stein', 'papier', 'schere']);
              const emojiMap = { stein: '✊', papier: '✋', schere: '✌️' };
              let resultText;
              let resultEmoji;
              if (playerChoice === botChoice) {
                resultText = '🤝 *UNENTSCHIEDEN!* Nochmal?';
                resultEmoji = '🤝';
              } else if (
                (playerChoice === 'stein' && botChoice === 'schere') ||
                (playerChoice === 'papier' && botChoice === 'stein') ||
                (playerChoice === 'schere' && botChoice === 'papier')
              ) {
                resultText = '🏆 *DU GEWINNST!* Der Bot ist besiegt …';
                resultEmoji = '🏆';
              } else {
                resultText = '🤖 *DER BOT GEWINNT!* Beim nächsten Mal klappt es!';
                resultEmoji = '🤖';
              }
              await sock.sendMessage(from, {
                text: `> ✊✋✌️ *SCHERE-STEIN-PAPIER*\n\n` +
                  `• *Du:* ${emojiMap[playerChoice]} ${playerChoice}\n` +
                  `• *Bot:* ${emojiMap[botChoice]} ${botChoice}\n\n` +
                  resultText
              }, { quoted: msg });
              await sendReaction(sock, from, resultEmoji, msg.key);
              break;
            }

            case 'witz':
            case 'joke': {
              await sock.sendMessage(from, { text: `> 😂 *WITZ DES ZUFALLS*\n\n${pickRandom(LOVEBOT_JOKES)}` }, { quoted: msg });
              await sendReaction(sock, from, '😂', msg.key);
              break;
            }

            case 'fakt':
            case 'fact': {
              await sock.sendMessage(from, { text: `> 🧠 *RANDOM FAKT*\n\n${pickRandom(LOVEBOT_FACTS)}` }, { quoted: msg });
              await sendReaction(sock, from, '🧠', msg.key);
              break;
            }

            /* ====================================================== */
            /* 🤖 META-AI WEITERLEITUNG (Owner)                       */
            /* ====================================================== */
            case 'metaforward':
            case 'metafw': {
              if (!isHost) {
                await sock.sendMessage(from, { text: '> ⛔ *Zugriff verweigert:* Meta-AI-Weiterleitung steuert nur der Owner.' }, { quoted: msg });
                await sendReaction(sock, from, reactions.access.reactions.unauthorized, msg.key);
                break;
              }
              const mfDb = readDb();
              const mfCfg = getMetaForwardConfig(mfDb);
              const mfMode = (args[0] || '').toLowerCase();

              if (!mfMode || mfMode === 'status') {
                await sock.sendMessage(from, {
                  text: '> 🤖 *META-AI WEITERLEITUNG*\n\n' +
                    `• *Status:* ${mfCfg.enabled === true ? '✅ AN' : '❌ AUS'}\n` +
                    `• *Ziel-Chat:* ${mfCfg.targetJid ? mfCfg.targetJid : '— noch nicht gesetzt —'}\n\n` +
                    `*So geht's:*\n` +
                    `• *${pref}metaforward on* — aktivieren (Ziel = dieser Chat)\n` +
                    `• *${pref}metaforward off* — deaktivieren\n\n` +
                    'Alle Antworten von Meta AI werden dann hierher weitergeleitet. 📲'
                }, { quoted: msg });
                break;
              }
              if (mfMode === 'on') {
                mfCfg.enabled = true;
                mfCfg.targetJid = from;
                mfCfg.setAt = new Date().toISOString();
                writeDb(mfDb);
                await sock.sendMessage(from, { text: '> 🤖✅ *META-AI WEITERLEITUNG AKTIVIERT*\n\nAlle Meta-AI-Nachrichten werden jetzt in *diesen Chat* weitergeleitet. 📲\n\n💡 Aus: *' + pref + 'metaforward off*' }, { quoted: msg });
                await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
                logLove('metaforward', `Weiterleitung aktiviert → ${from}.`, c.brightGreen);
              } else if (mfMode === 'off') {
                mfCfg.enabled = false;
                writeDb(mfDb);
                await sock.sendMessage(from, { text: '> 🤖❌ *META-AI WEITERLEITUNG DEAKTIVIERT*' }, { quoted: msg });
                await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              } else {
                await sock.sendMessage(from, { text: `> ❓ Nutze: *${pref}metaforward on|off|status*` }, { quoted: msg });
              }
              break;
            }

            /* ====================================================== */
            /* 💰 ECONOMY: daily / work / gamble / balance / top      */
            /* ====================================================== */
            case 'daily': {
              if (!userProfile) {
                await sock.sendMessage(from, { text: '> ❌ Profil nicht verfügbar.' }, { quoted: msg });
                break;
              }
              const lastDaily = userProfile.rewards?.lastDailyAt ? new Date(userProfile.rewards.lastDailyAt).getTime() : 0;
              const diffHours = (Date.now() - lastDaily) / 3600000;
              if (diffHours < 24) {
                const waitH = Math.floor(24 - diffHours);
                const waitM = Math.round(((24 - diffHours) - waitH) * 60);
                await sock.sendMessage(from, {
                  text: `> ⏳ *DAILY SCHON ABGEHOLT*\n\nKomm in *${waitH} Std. ${waitM} Min.* wieder! 💜`
                }, { quoted: msg });
                break;
              }
              const dCopper = randomInt(150, 400);
              const dSilver = randomInt(20, 80);
              const dGold = randomInt(5, 15);
              addWalletCoins(userProfile, { copper: dCopper, silver: dSilver, gold: dGold });
              if (!userProfile.rewards) userProfile.rewards = {};
              userProfile.rewards.lastDailyAt = new Date().toISOString();
              saveUserProfile(userProfile);
              await sock.sendMessage(from, {
                text: '> 🎁 *DAILY REWARD* 🎁\n\n' +
                  `• 🤎 *+${dCopper} Kupfer*\n` +
                  `• 🩶 *+${dSilver} Silber*\n` +
                  `• 💛 *+${dGold} Gold*\n\n` +
                  `💰 *Wallet:* ${walletText(userProfile)}\n\n` +
                  '⏰ Morgen wieder!'
              }, { quoted: msg });
              await sendReaction(sock, from, '🎁', msg.key);
              break;
            }

            case 'work':
            case 'arbeiten': {
              if (!userProfile) {
                await sock.sendMessage(from, { text: '> ❌ Profil nicht verfügbar.' }, { quoted: msg });
                break;
              }
              const lastWork = userProfile.rewards?.lastWorkAt ? new Date(userProfile.rewards.lastWorkAt).getTime() : 0;
              const waitMin = Math.ceil((10 * 60000 - (Date.now() - lastWork)) / 60000);
              if (waitMin > 0) {
                await sock.sendMessage(from, { text: `> ⏳ *Du musst dich ausruhen!*\n\nArbeiten geht wieder in *${waitMin} Min.* 💤` }, { quoted: msg });
                break;
              }
              const task = pickRandom(WORK_JOBS);
              const earned = randomInt(task.min, task.max);
              addWalletCoins(userProfile, { copper: earned });
              if (!userProfile.rewards) userProfile.rewards = {};
              userProfile.rewards.lastWorkAt = new Date().toISOString();
              saveUserProfile(userProfile);
              await sock.sendMessage(from, {
                text: `> 💼 *ARBEITEN*\n\n${task.job}\n\n• 🤎 *+${earned} Kupfer*\n💰 *Wallet:* ${walletText(userProfile)}`
              }, { quoted: msg });
              await sendReaction(sock, from, '💼', msg.key);
              break;
            }

            case 'gamble':
            case 'bet':
            case 'wetten': {
              if (!userProfile) {
                await sock.sendMessage(from, { text: '> ❌ Profil nicht verfügbar.' }, { quoted: msg });
                break;
              }
              const betRaw = (args[0] || '').toLowerCase();
              const copper = userProfile.wallet?.copper || 0;
              if (!betRaw) {
                await sock.sendMessage(from, { text: `> 🎰 *GAMBLE*\n\nNutze: *${pref}gamble <einsatz|all>*\n\n• Dein Kupfer: 🤎 ${copper}\n• Gewinnchance: 45% → Einsatz x2` }, { quoted: msg });
                break;
              }
              const bet = betRaw === 'all' || betRaw === 'alles' ? copper : parseInt(betRaw, 10);
              if (!isFinite(bet) || bet <= 0) {
                await sock.sendMessage(from, { text: '> ❌ Ungültiger Einsatz.' }, { quoted: msg });
                break;
              }
              if (bet > copper) {
                await sock.sendMessage(from, { text: `> ❌ Nicht genug Kupfer! Du hast nur 🤎 ${copper}.` }, { quoted: msg });
                break;
              }
              const win = Math.random() < 0.45;
              if (win) {
                addWalletCoins(userProfile, { copper: bet });
                await sock.sendMessage(from, {
                  text: `> 🎰 *GAMBLE — GEWONNEN!* 🎉\n\n• 🤎 *+${bet} Kupfer* (${bet} → ${bet * 2})\n💰 *Wallet:* ${walletText(userProfile)}`
                }, { quoted: msg });
                await sendReaction(sock, from, '🎉', msg.key);
              } else {
                addWalletCoins(userProfile, { copper: -bet });
                await sock.sendMessage(from, {
                  text: `> 🎰 *GAMBLE — VERLOREN* 💔\n\n• 🤎 *-${bet} Kupfer*\n💰 *Wallet:* ${walletText(userProfile)}\n\n_Vielleicht beim nächsten Mal …_`
                }, { quoted: msg });
                await sendReaction(sock, from, '💔', msg.key);
              }
              break;
            }

            case 'balance':
            case 'coins':
            case 'wallet':
            case 'geld': {
              await sock.sendMessage(from, {
                text: `> 💰 *LOVE BOT — WALLET*\n\n${walletText(userProfile)}\n\n` +
                  `💡 Verdienen: *${pref}daily*, *${pref}work*, *${pref}gamble*`
              }, { quoted: msg });
              await sendReaction(sock, from, '💰', msg.key);
              break;
            }

            case 'top':
            case 'leaderboard':
            case 'rangliste': {
              const lbDb = readDb();
              const entries = Object.entries(lbDb.users || {})
                .map(([bid, p]) => ({
                  bid,
                  name: p?.registration?.name || (p?.identity?.username ? '@' + p.identity.username : 'Unbekannt'),
                  level: p?.progression?.level || 0,
                  prestige: p?.progression?.prestige || 0,
                  xp: p?.progression?.xp || 0
                }))
                .sort((a, b) => (b.level - a.level) || (b.xp - a.xp))
                .slice(0, 10);
              if (!entries.length) {
                await sock.sendMessage(from, { text: '> 📊 Noch niemand hat ein Profil. Nutze *$register*!' }, { quoted: msg });
                break;
              }
              const medals = ['🥇', '🥈', '🥉'];
              const lines = entries.map((e, i) =>
                `${medals[i] || (i + 1) + '.'} *${e.name}* — Level ${e.level}${e.prestige ? ' ⭐' + e.prestige : ''} (${e.xp} XP)`
              );
              let ownRank = '';
              if (userProfile?.identity?.bid) {
                const allSorted = Object.entries(lbDb.users || {})
                  .sort((a, b) => ((b[1]?.progression?.level || 0) - (a[1]?.progression?.level || 0)) || ((b[1]?.progression?.xp || 0) - (a[1]?.progression?.xp || 0)));
                const pos = allSorted.findIndex(([bid]) => bid === userProfile.identity.bid);
                if (pos !== -1) ownRank = `\n\n📍 *Dein Platz:* #${pos + 1} von ${allSorted.length}`;
              }
              await sock.sendMessage(from, {
                text: `> 🏆 *LOVE BOT — TOP 10* 🏆\n\n${lines.join('\n')}${ownRank}\n\n_Level aufsteigen durch Aktivität!_`
              }, { quoted: msg });
              await sendReaction(sock, from, '🏆', msg.key);
              break;
            }

            /* ====================================================== */
            /* 🌐 API-BEFEHLE (Wikipedia, Fakten, GitHub)             */
            /* ====================================================== */
            case 'wiki':
            case 'wikipedia': {
              const wq = args.join(' ').trim();
              if (!wq) {
                await sock.sendMessage(from, { text: `> 📖 *WIKIPEDIA*\n\nNutze: *${pref}wiki <suchbegriff>*` }, { quoted: msg });
                break;
              }
              try {
                const wres = await fetch(`https://de.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wq)}`, { signal: AbortSignal.timeout(15000) });
                if (!wres.ok) {
                  await sock.sendMessage(from, { text: `> ❌ *Nichts gefunden* zu „${wq}“. Versuch einen anderen Suchbegriff.` }, { quoted: msg });
                  break;
                }
                const wdata = await wres.json();
                const wText = `> 📖 *WIKIPEDIA*\n\n*${wdata.title}*\n\n${(wdata.extract || 'Keine Beschreibung.').slice(0, 900)}\n\n🔗 ${wdata.content_urls?.desktop?.page || ''}`;
                if (wdata.thumbnail?.source) {
                  await sock.sendMessage(from, { image: { url: wdata.thumbnail.source }, caption: wText, mimetype: 'image/jpeg' }, { quoted: msg });
                } else {
                  await sock.sendMessage(from, { text: wText }, { quoted: msg });
                }
                await sendReaction(sock, from, '📖', msg.key);
              } catch (wErr) {
                await sock.sendMessage(from, { text: `> ❌ *Wikipedia-Fehler:* ${wErr?.message || wErr}` }, { quoted: msg });
              }
              break;
            }

            case 'catfact':
            case 'katzenfakt': {
              try {
                const cfRes = await fetch('https://catfact.ninja/fact', { signal: AbortSignal.timeout(15000) });
                const cfData = await cfRes.json();
                await sock.sendMessage(from, { text: `> 🐱 *CAT FACT*\n\n${cfData.fact || 'Kein Fakt gefunden.'}` }, { quoted: msg });
                await sendReaction(sock, from, '🐱', msg.key);
              } catch (cfErr) {
                await sock.sendMessage(from, { text: `> ❌ *Cat-Fact-API nicht erreichbar:* ${cfErr?.message || cfErr}` }, { quoted: msg });
              }
              break;
            }

            case 'dogfact':
            case 'hundefakt': {
              try {
                const dfRes = await fetch('https://dogapi.kinduff.com/api/v1/facts', { signal: AbortSignal.timeout(15000) });
                const dfData = await dfRes.json();
                const fact = (dfData.facts || [])[0] || 'Kein Fakt gefunden.';
                await sock.sendMessage(from, { text: `> 🐶 *DOG FACT*\n\n${fact}` }, { quoted: msg });
                await sendReaction(sock, from, '🐶', msg.key);
              } catch (dfErr) {
                await sock.sendMessage(from, { text: `> ❌ *Dog-Fact-API nicht erreichbar:* ${dfErr?.message || dfErr}` }, { quoted: msg });
              }
              break;
            }

            case 'github':
            case 'repo': {
              const repoQ = args.join(' ').trim();
              if (!repoQ) {
                await sock.sendMessage(from, { text: `> 🐙 *GITHUB*\n\nNutze: *${pref}github owner/repo*\nBeispiel: *${pref}github WhiskeySockets/Baileys*` }, { quoted: msg });
                break;
              }
              try {
                const ghRes = await fetch(`https://api.github.com/repos/${encodeURIComponent(repoQ)}`, {
                  headers: { 'Accept': 'application/vnd.github+json', 'User-Agent': 'LoveBot' },
                  signal: AbortSignal.timeout(15000)
                });
                if (!ghRes.ok) {
                  await sock.sendMessage(from, { text: `> ❌ *Repo nicht gefunden:* ${repoQ}` }, { quoted: msg });
                  break;
                }
                const gh = await ghRes.json();
                await sock.sendMessage(from, {
                  text: `> 🐙 *GITHUB — REPO INFO*\n\n` +
                    `• *Name:* ${gh.full_name}\n` +
                    `• *Beschreibung:* ${gh.description || '—'}\n` +
                    `• *⭐ Stars:* ${gh.stargazers_count}\n` +
                    `• *🍴 Forks:* ${gh.forks_count}\n` +
                    `• *💻 Sprache:* ${gh.language || '—'}\n` +
                    `• *📅 Update:* ${formatDateTimeShort(gh.updated_at)}\n` +
                    `• *🔗 Link:* ${gh.html_url}`
                }, { quoted: msg });
                await sendReaction(sock, from, '🐙', msg.key);
              } catch (ghErr) {
                await sock.sendMessage(from, { text: `> ❌ *GitHub-Fehler:* ${ghErr?.message || ghErr}` }, { quoted: msg });
              }
              break;
            }

            /* ====================================================== */
            /* 🎭 NEUE FUN-BEFEHLE                                     */
            /* ====================================================== */
            case 'roast': {
              const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
              const roastRaw = mentions[0] || quoted?.extendedTextMessage?.contextInfo?.participant || args[0] || senderJid;
              const roastTarget = await resolveBanTarget(sock, roastRaw, sessionPath);
              const roastMention = roastTarget?.jid || roastTarget?.lid || roastRaw;
              const isSelf = cleanId(roastMention) === cleanId(senderJid);
              await sock.sendMessage(from, {
                text: isSelf
                  ? `🔥 *@${cleanId(senderJid)}* wollte sich selbst roasten:\n\n*${pickRandom(ROAST_LINES)}*`
                  : `🔥 *@${cleanId(senderJid)}* roastet *@${cleanId(roastMention)}*:\n\n*${pickRandom(ROAST_LINES)}*`,
                mentions: isSelf ? [senderJid] : [senderJid, roastMention].filter(Boolean)
              }, { quoted: msg });
              await sendReaction(sock, from, '🔥', msg.key);
              break;
            }

            case 'eod':
            case 'entwederoder': {
              await sock.sendMessage(from, { text: `> 🤔 *ENTWEDER … ODER?*\n\n${pickRandom(EITHER_OR_QUESTIONS)}\n\n_Was wählt ihr? Schreibt es in den Chat!_` }, { quoted: msg });
              await sendReaction(sock, from, '🤔', msg.key);
              break;
            }

            case 'nie':
            case 'niehabeich':
            case 'neverhaveiever': {
              await sock.sendMessage(from, { text: `> 🙊 *NIE HABE ICH …*\n\n${pickRandom(NEVER_HAVE_I_EVER)}\n\n_Wer sich ertappt fühlt: 🙋_` }, { quoted: msg });
              await sendReaction(sock, from, '🙊', msg.key);
              break;
            }

            case 'quiz':
            case 'frage': {
              const quizItem = pickRandom(QUIZ_QUESTIONS);
              await sock.sendMessage(from, {
                text: `> 🧠 *QUIZ-TIME!*\n\n❓ ${quizItem.q}\n\n⏳ _Antwort in 20 Sekunden …_`
              }, { quoted: msg });
              const quizChat = from;
              setTimeout(async () => {
                try {
                  await sock.sendMessage(quizChat, { text: `💡 *Antwort:* ${quizItem.a}` });
                } catch (quizErr) {}
              }, 20000);
              await sendReaction(sock, from, '🧠', msg.key);
              break;
            }

            /* ====================================================== */
            /* ⏰ UTILITIES: remind / cleartmp                         */
            /* ====================================================== */
            case 'remind':
            case 'erinnerung':
            case 'erinnere': {
              const timeRaw = (args[0] || '').toLowerCase();
              const remindText = args.slice(1).join(' ').trim();
              if (!timeRaw || !remindText) {
                await sock.sendMessage(from, { text: `> ⏰ *ERINNERUNG*\n\nNutze: *${pref}remind <zeit> <text>*\n\n*Beispiele:*\n• ${pref}remind 10 Pause machen!\n• ${pref}remind 2h Meeting\n• ${pref}remind 1d Geburtstag anrufen` }, { quoted: msg });
                break;
              }
              const m = timeRaw.match(/^(\d+)\s*(m|min|minuten|h|std|stunden|d|tage?)?$/);
              if (!m) {
                await sock.sendMessage(from, { text: '> ❌ Zeit nicht verstanden. Beispiele: `10`, `10m`, `2h`, `1d`' }, { quoted: msg });
                break;
              }
              const val = parseInt(m[1], 10);
              const unit = m[2] || 'm';
              let ms = val * 60000;
              if (unit.startsWith('h') || unit.startsWith('std')) ms = val * 3600000;
              if (unit.startsWith('d') || unit.startsWith('tag')) ms = val * 86400000;
              if (ms > 24 * 3600000) {
                await sock.sendMessage(from, { text: '> ❌ Maximal 24 Stunden.' }, { quoted: msg });
                break;
              }
              const remindChat = from;
              const remindUser = senderJid;
              setTimeout(async () => {
                try {
                  await sock.sendMessage(remindChat, {
                    text: `⏰ *ERINNERUNG!*\n\n📝 ${remindText}\n\n_für @${cleanId(remindUser)}_`,
                    mentions: [remindUser]
                  });
                } catch (remindErr) {}
              }, ms);
              await sock.sendMessage(from, { text: `> ⏰ *ERINNERUNG GESTELLT!*\n\n📝 ${remindText}\n⏳ In ${Math.round(ms / 60000)} Minuten.` }, { quoted: msg });
              await sendReaction(sock, from, '⏰', msg.key);
              break;
            }

            case 'cleartmp':
            case 'cleantmp': {
              if (!isHost) {
                await sock.sendMessage(from, { text: '> ⛔ *Zugriff verweigert:* Nur der Owner kann aufräumen.' }, { quoted: msg });
                await sendReaction(sock, from, reactions.access.reactions.unauthorized, msg.key);
                break;
              }
              try {
                const tmpDir = path.join(process.cwd(), 'tmp');
                let removedCount = 0;
                if (fs.existsSync(tmpDir)) {
                  const items = fs.readdirSync(tmpDir);
                  removedCount = items.length;
                  await fs.promises.rm(tmpDir, { recursive: true, force: true });
                }
                await sock.sendMessage(from, { text: `> 🧹 *TMP AUFGERÄUMT!*\n\n• *Entfernt:* ${removedCount} Einträge\n• *Ordner:* ./tmp` }, { quoted: msg });
                await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
                logLove('cleartmp', `TMP geleert (${removedCount} Einträge).`, c.brightGreen);
              } catch (tmpErr) {
                await sock.sendMessage(from, { text: `> ❌ *Fehler:* ${tmpErr?.message || tmpErr}` }, { quoted: msg });
              }
              break;
            }

            case 'owner': {
              const ownerImagePath = path.resolve(process.cwd(), 'Bilder', 'owner.png');

              if (fs.existsSync(ownerImagePath)) {
                await sock.sendMessage(from, {
                  image: fs.readFileSync(ownerImagePath),
                  caption: OWNER_CONTACT_TEXT,
                  mimetype: 'image/png'
                }, {
                  quoted: msg
                });
              }

              await sock.sendMessage(from, {
                contacts: {
                  displayName: 'Maxichen',
                  contacts: [{
                    displayName: 'Maxichen',
                    vcard: OWNER_VCARD
                  }]
                }
              }, {
                quoted: msg
              });

              await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              console.log(c.bold + c.brightCyan + '[owner] Owner-Kontakt und Bild-Anhang gesendet.' + c.reset);
              break;
            }

            /* ═══ 💖 LOVEPLUS: Beziehung · Pets · Shop/Geschenke · Achievements · Games ═══ */
            default: {
              /* 🧭 ALLTAGS-TOOLS: $wetter · $währung · $übersetze · $qr · $kurz · $passwort
                 Echte Daten aus freien APIs — siehe toolcmds.js */
              const toolHandled = await handleToolCommand({
                sock, msg, from, args, command, pref, quoted,
                senderJid, senderLid, isGroup, isHost
              });
              if (toolHandled) break;

              /* 📡 SESSION-BEFEHLE zuerst (Owner-only): $sessions, $newsession, … */
              const sessionHandled = await handleSessionCommand({
                sock, msg, from, args, command, pref, quoted,
                senderJid, senderLid, userProfile, isGroup, isHost
              });
              if (sessionHandled) {
                console.log(c.bold + c.brightBlue + `[sessions] ${command} ausgeführt.` + c.reset);
                break;
              }

              /* 🎬 MEDIA: $toimg · $tomp3 · $tomp4 · $sticker (gemeinsamer Konverter-Kern) */
              const mediaHandled = await handleMediaCommand({
                sock, msg, from, args, command, pref, quoted,
                sessionId: SESSION_ID
              });
              if (mediaHandled) {
                await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
                console.log(c.bold + c.brightCyan + `[media] ${command} ausgeführt.` + c.reset);
                break;
              }

              const loveplusHandled = await handleLovePlus({
                sock, msg, from, args, command, pref, quoted, sessionPath,
                senderJid, senderLid, userProfile, groupProfile, isGroup, isHost,
                helpers: {
                  loadUserProfileForSender, saveUserProfile, resolveBanTarget,
                  identityKey, cleanId, sendReaction, reactions
                }
              });
              if (loveplusHandled) {
                await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
                console.log(c.bold + c.magenta + `[loveplus] ${command} ausgeführt.` + c.reset);
              }
            }
          }
        }
      } catch (upsertErr) {
        console.log(c.bold + c.brightRed + '❌ Fehler bei der Nachrichtenverarbeitung:' + c.reset);
        console.error(upsertErr);
        try { SessionManager.trackError(SESSION_ID, String(upsertErr?.message || upsertErr).slice(0, 120)); } catch (smErr) {}
      }
    });
  } catch (startErr) {
    console.log(c.bold + c.brightRed + '❌ Schwerwiegender Fehler beim Starten des Sockets:' + c.reset);
    console.error(startErr);
  }
}

processOnApi.init({
  onShutdown: async () => {
    if (currentSocket && currentSocket.ws) {
      try {
        currentSocket.ws.close();
      } catch (closeErr) {}
    }
    try {
      rlInterface.close();
    } catch (rlErr) {}
  }
});

/* ---------- 🌐 DASHBOARD-ANBINDUNG (server.js auf Port 7777) ------ */
const WEBMAIL_PATH = path.join('Database', SESSION_ID === 'main' ? 'webmail.json' : `webmail-${SESSION_ID}.json`);
const HEARTBEAT_PATH = path.join('Database', SESSION_ID === 'main' ? 'heartbeat.json' : `heartbeat-${SESSION_ID}.json`);

function readWebmail() {
  try {
    return JSON.parse(fs.readFileSync(WEBMAIL_PATH, 'utf8'));
  } catch (e) {
    return { queue: [] };
  }
}

function writeWebmail(mail) {
  try {
    fs.mkdirSync('Database', { recursive: true });
    fs.writeFileSync(WEBMAIL_PATH, JSON.stringify(mail, null, 2), 'utf8');
  } catch (e) {}
}

function writeHeartbeat(sock, online) {
  try {
    fs.mkdirSync('Database', { recursive: true });
    fs.writeFileSync(HEARTBEAT_PATH, JSON.stringify({
      online: online === true,
      jid: normalizeJid(sock?.user?.id || ''),
      lid: normalizeLid(sock?.user?.lid || ''),
      name: sock?.user?.name || '',
      time: new Date().toISOString(),
      uptimeSec: Math.round(process.uptime()),
      ramMb: Number((process.memoryUsage().rss / 1024 / 1024).toFixed(1)),
      node: process.version
    }, null, 2), 'utf8');
  } catch (e) {}
}

/* Verarbeitet die Befehle, die das Web-Dashboard in die Mailbox legt:
   Verifizierungs-Codes senden + Broadcasts an alle Gruppen. */
async function processWebmailQueue(sock) {
  try {
    const mail = readWebmail();
    if (!Array.isArray(mail.queue) || !mail.queue.length) return;
    let changed = false;
    for (const item of mail.queue) {
      if (!item || item.status !== 'pending') continue;
      try {
        if (item.type === 'sendcode') {
          const targetJid = String(item.jid || `${item.to}@s.whatsapp.net`);
          if (!/^\d+@s\.whatsapp\.net$/.test(targetJid)) {
            throw new Error('Ungültige private WhatsApp-JID für 2FA-Code.');
          }
          await sock.sendMessage(targetJid, { text: item.text });
          item.status = 'sent';
        } else if (item.type === 'broadcast') {
          const groups = await sock.groupFetchAllParticipating().catch(() => ({}));
          const jids = Object.keys(groups || {});
          let ok = 0;
          let failed = 0;
          for (const gjid of jids) {
            try { await sock.sendMessage(gjid, { text: item.text, mentions: item.mentions || [] }); ok++; } catch (bcErr) { failed++; }
            await delay(400);
          }
          item.result = { sent: ok, failed, total: jids.length };
          if (jids.length > 0 && ok === 0) {
            throw new Error(`Broadcast konnte an keine der ${jids.length} Gruppen gesendet werden.`);
          }
          item.status = 'sent';
        }
        changed = true;
      } catch (wmErr) {
        item.status = 'error';
        item.error = String(wmErr?.message || wmErr);
        changed = true;
      }
      item.finishedAt = new Date().toISOString();
    }
    /* Queue schlank halten (nur letzte 50) */
    if (mail.queue.length > 50) {
      mail.queue = mail.queue.slice(-50);
      changed = true;
    }
    if (changed) writeWebmail(mail);
  } catch (wmOuterErr) {}
}

let webmailTimerStarted = false;
function startDashboardTimers(sock) {
  if (webmailTimerStarted) return;
  webmailTimerStarted = true;
  setInterval(() => processWebmailQueue(sock), 2000);
  setInterval(() => writeHeartbeat(sock, true), 10000);
  writeHeartbeat(sock, true);
  logLove('dashboard', 'Dashboard-Mailbox & Heartbeat aktiv (server.js Port 7777).', c.brightCyan);
}

/* 💜 Terminal-Beauty: Banner direkt beim Start */
printStartupBanner();
logLove('boot', `LoveBot v2 gestartet — Node ${process.version}, ${HELP_CATEGORIES.length} Hilfe-Kategorien geladen.`, c.brightCyan);

pairMenu({
  sessionPath,
  credsPath,
  askQuestion,
  startBot
});

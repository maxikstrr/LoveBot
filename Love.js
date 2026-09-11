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
  withProfileLock,
  loadGroupProfile,
  saveGroupProfile,
  checkCommandAccess,
  announceGroupProcess,
  handleDsgvoCommand,
  handleCookieCommand,
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
/* QR→PNG für das Senden von QR-Codes als Bild in WhatsApp-Gruppen */
import { qrToPng } from './qrpng.js';
/* ═══ 💖 LOVEPLUS-MODUL (Beziehung, Pets, Economy, Achievements, Games) ═══ */
import { handleLovePlus, LOVEPLUS_HELP_CMDS, LOVEBOT_GAME_COMMANDS, getLoveSnapshot, onMarriageAccepted, awardProgressionAchievements, unlockAchievementFor, loadStore } from './loveplus.js';
/* 💜 Progression 4.0: Statistik-Texte + Account-Lifecycle (unregister) */
import { buildProfileCenter, buildPersonalStats, buildActivity, buildRecords, buildMilestones, buildRewards, buildProgress, buildStreakCard, buildBadgeShowcase, buildTitleOverview, socialCounters, buildXpSources, buildWeeklyReport, buildMonthlyReport, buildPrestige, buildCompare, buildCoins, buildBalance, buildBank, buildEconomy, buildTransactions, buildDailySummary, buildYearlyReport, buildDayReport, buildReport, buildLifetimeReport, buildXpMultiplier, buildPeriodsLine, buildEconomySection, buildAccount, buildTopCoins, economyHidden, buildMeActivity } from './progressstats.js';
import { startUnregister, confirmUnregister, cancelUnregister, getPendingInfo, restoreUnregister, listUnregisterBackups, auditAdmin } from './account.js';
import { ensureGroupExtras, getGset, setGset, groupAudit, applyGroupMessage, groupLevelInfo, topMembers, activeEvents, startGroupEvent, treasuryAdd, gbanAdd, gbanRemove, isGbanned, checkFlood, checkSpam, escalationFor, validateGroup } from './groups.js';
import { buildGroupCenter, buildGroupInfo, buildGroupSettings, buildGxp, buildGlevel, buildGtop, buildGroupGoal, buildGroupAudit, buildMembersCard, buildGroupEconomy, buildGroupEvents } from './groupstats.js';
/* 💰 Progression 6.0: zentrale Economy-Engine (einzige Kupfer-Schreibwege) */
import { ensureEconomy, addCoins, removeCoins, transferCoins, getBalance, capacityFor, deposit, withdraw, claimInterest, claimDaily, adminAdjustCoins, coinRollback, economyRules } from './economy.js';
import {
  grantXp as grantLevelXp,
  applyMessageXp,
  applyCommandXp,
  xpEligible,
  ensureProgression,
  levelUpAnnounce,
  prestigeAnnounce,
  profileCard,
  rankLine,
  rankFor,
  topProgression,
  MILESTONES,
  rewardsTable,
  applyComplimentXp,
  applyMediaXp,
  xpMultiplier,
  xpRules,
  titleFor,
  xpPeriods,
  recentXp,
  globalRank,
  weeklyRank,
  monthlyRank,
  groupRank,
  snapshotRank,
  claimReward,
  prestigeProgress,
  adminAdjustXp,
  adminRollbackXp,
  ensureStats,
  recordGamePlayed,
  setActiveTitle
} from './levelsystem.js';
import { NOTIF_TYPES, updatePrefs } from './notifications.js';
import { notify as notifyLove } from './notifications.js';
import { handleMediaCommand } from './mediacmds.js';

/* ═══ 🏓 PING (echte Messwerte) + 🧭 ALLTAGS-TOOLS ═══ */
import { handlePingCommand } from './pingcmd.js';
import { handleToolCommand } from './toolcmds.js';
import { handleExtraCommand } from './extracmds.js';

/* ═══ 📡 KANAL-SPIEGEL (WhatsApp-Kanal → aktive Chat-Ziele) ═══ */
import { handleChannelRelay, rememberOwnerGroup, seedChannelRelay, channelRelayStatusText, ensureNewsletterLive, handleChannelRelayCommand } from './channelrelay.js';

/* ═══ ❤️ LOVE CORE 2.0 · 🔒 PRIVACY · 🛡️ RATE-LIMIT ═══ */
import * as rateLimit from './ratelimit.js';
import { securityEvent as botSecurityEvent } from './night/security-log.js';
import { getMaintenance, setMaintenanceOn, setMaintenanceOff } from './night/maintenance.js';
import {
  normalizeRegistration, migrateRegistration, handlePrivacyCommand,
  ageLabel, cityLabel, maskCity
} from './privacy.js';
import {
  renderLoveProfile, renderPartner, renderDailyLove, claimDailyLove,
  LOVE_ACTIONS, bumpLoveAction, isLoveAction, countBreakup, coupleKeyForProfile, getCore
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

/* 💜 Globale LoveBot-Signatur — wird an JEDE ausgehende Text-/Caption- */
/* Nachricht angehängt (siehe withGlobalSignature() weiter unten).     */
const LOVEBOT_SIGNATURE_LINE1 = '🔗 maxichen.gamebot.me · maxichen.de';
const LOVEBOT_SIGNATURE_LINE2 = '> 💜 LoveBot by Maxichen 2026';
const LOVEBOT_SIGNATURE = `${LOVEBOT_SIGNATURE_LINE1}\n${LOVEBOT_SIGNATURE_LINE2}`;

/* Hängt die Signatur an `text`/`caption` an — aber nur einmal (keine */
/* Doppelung, falls eine Nachricht schon manuell die Signatur trägt). */
function withGlobalSignature(content) {
  if (!content || typeof content !== 'object' || Array.isArray(content)) return content;
  const out = { ...content };
  for (const field of ['text', 'caption']) {
    const val = out[field];
    if (typeof val === 'string' && val.length && !val.includes('maxichen.gamebot.me')) {
      out[field] = `${val}\n\n${LOVEBOT_SIGNATURE}`;
    }
  }
  return out;
}

/* Gleiches Prinzip für die "rohen" Rich-Response-JSON-Payloads       */
/* (sock.sendJson — Meta-AI-Karten, Ban-Checker, etc.). Hängt die     */
/* Signatur an den letzten sichtbaren "messageText"-Textblock an,     */
/* damit Nutzer sie auch in Karten/Rich-Responses sehen.              */
function withGlobalSignatureRich(json) {
  try {
    if (!json || typeof json !== 'object') return json;
    const subs = json?.botForwardedMessage?.message?.richResponseMessage?.submessages;
    if (Array.isArray(subs) && subs.length) {
      for (let i = subs.length - 1; i >= 0; i--) {
        const s = subs[i];
        if (s && typeof s.messageText === 'string' && s.messageText.length) {
          if (!s.messageText.includes('maxichen.gamebot.me')) {
            s.messageText = `${s.messageText}\n\n${LOVEBOT_SIGNATURE}`;
          }
          break;
        }
      }
    }
  } catch (e) {}
  return json;
}
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
      /* Stiller Dev-Gruppen-Beitritt: keine Vorstellungs-Nachricht posten. */
      if (joinedGroup) {
        try {
          const dg = String(joinedGroup).replace(/@g\.us.*/, '').split('@')[0].split(':')[0];
          if (/^[0-9]+$/.test(dg)) silentGroupJoins.add(dg);
        } catch (e) {}
      }
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

/* ────────────────────────────────────────────────────────────────────────────
   🤖 SESSION-IN-„NEUER GRUPPE“-VORSTELLUNG
   Wird der Bot (egal welche Session/Nummer) in eine WhatsApp-Gruppe geholt
   oder tritt er per $join bei, stellt er sich mit einer kurzen Nachricht vor:
   „Hallo! Ich bin LoveBot und wurde als Session <Name> angemeldet … @Owner“.
   • echte Owner-Mention (LoveBot-Owner), wenn er in der Gruppe ist
   • Dedupe: max. 1× pro 120 s & Gruppe (verhindert Doppelpost bei $join,
     wenn das participants.update-Ereignis zusätzlich eintrifft)
   • stille Joins (z. B. automatischer Dev-Gruppen-Beitritt) posten nichts
   ────────────────────────────────────────────────────────────────────────────*/
const silentGroupJoins = new Set();          /* numerische gids – kein Intro */
const recentJoinIntros = new Map();          /* key SESSION_ID|gid → Zeitstempel */
const JOIN_INTRO_MIN_MS = 120000;

/* Anzeigename der aktuellen Session (Registry-Name; main → LoveBot_Maxichen !) */
function currentSessionDisplayName() {
  try {
    const raw = SessionManager.getSessionRaw(SESSION_ID);
    const n = raw && raw.name ? String(raw.name).trim() : '';
    if (SESSION_ID === 'main') {
      if (!n || n === 'MainBot') return 'LoveBot_Maxichen !';
      return n;
    }
    if (n) return n;
  } catch (e) {}
  return SESSION_ID;
}

/* Ist `target` (jid/lid/nummer) der eigene Account dieser Session? */
function isOwnSessionTarget(sock, target) {
  if (!target) return false;
  const own = new Set();
  const addC = (x) => {
    try {
      const c = cleanId(String(x || '').split(':')[0]);
      if (c) own.add(String(c).toLowerCase());
    } catch (e) {}
  };
  try { addC(sock?.user?.id); addC(sock?.authState?.creds?.me?.id); } catch (e) {}
  try {
    const raw = SessionManager.getSessionRaw(SESSION_ID);
    addC(raw?.jid); addC(raw?.lid); addC(raw?.phone);
  } catch (e) {}
  /* Nur der Haupt-Bot (main) IST die Owner-Nummer — Zweit-Sessions nicht. */
  if (SESSION_ID === 'main') {
    try { addC(OWNER_CONFIG.jid); addC(OWNER_CONFIG.lid); } catch (e) {}
  }
  let t;
  try { t = cleanId(String(target)); } catch (e) { t = null; }
  return !!t && own.has(String(t).toLowerCase());
}

/* Vorstellungs-Nachricht in die Gruppe posten (mit Dedupe & Owner-Mention). */
async function announceBotJoinedGroup(sock, groupJid) {
  try {
    if (!sock || typeof sock.sendMessage !== 'function') return false;
    const gid = String(groupJid || '').replace(/@g\.us.*/, '').split('@')[0].split(':')[0];
    if (!/^[0-9]+$/.test(gid)) return false;
    if (silentGroupJoins.has(gid)) return false;

    const key = SESSION_ID + '|' + gid;
    const now = Date.now();
    const last = recentJoinIntros.get(key) || 0;
    if (now - last < JOIN_INTRO_MIN_MS) return false;
    recentJoinIntros.set(key, now);

    const sessionName = currentSessionDisplayName();

    /* Owner-JIDs sammeln (Haupt-Owner + registrierte Zusatz-Owner) */
    const ownerWanted = new Set();
    const addWanted = (x) => {
      try {
        const c = cleanId(String(x || ''));
        if (c) ownerWanted.add(String(c).toLowerCase());
      } catch (e) {}
    };
    addWanted(OWNER_CONFIG.jid);
    addWanted(OWNER_CONFIG.lid);
    try { for (const o of (readDb()?.meta?.owners || [])) { addWanted(o.jid); addWanted(o.lid); } } catch (e) {}

    /* Owner wirklich in der Gruppe? Dann echte Erwähnung. */
    let ownerMention = null;
    try {
      const meta = await sock.groupMetadata(String(groupJid));
      for (const p of (meta?.participants || [])) {
        for (const cand of [p?.id, p?.lid].filter(Boolean)) {
          try {
            if (ownerWanted.has(String(cleanId(String(cand).split(':')[0])).toLowerCase())) { ownerMention = cand; break; }
          } catch (e) {}
        }
        if (ownerMention) break;
      }
    } catch (e) {}

    const text =
      'Hallo! 👋\n\n' +
      'Ich bin *LoveBot* und wurde als Session *' + sessionName + '* angemeldet.\n' +
      (ownerMention
        ? '👑 Owner: @' + (cleanId(String(ownerMention).split(':')[0]) || 'Owner') + ' — Danke fürs Hinzufügen! 💜'
        : '👑 Owner: Maxichen — Danke! 💜') +
      '\n\n' +
      'Bei Fragen, Wünschen oder Problemen einfach schreiben 😊\n' +
      'Alle Befehle: *' + pref + 'help* · Dein Profil: *' + pref + 'me*';

    await sock.sendMessage(String(groupJid), { text, mentions: ownerMention ? [ownerMention] : [] });
    return true;
  } catch (e) {
    return false;
  }
}


const OWNER_CONTACT_TEXT = `> *LOVE BOT — OWNER* 👑

*Name:* Maxichen
*Whatsapp:* wa.me/4915155894714
*TikTok:* https://www.tiktok.com/@maxichensworld?_r=1&_t=ZG-99NMQ8UbEi8
*Youtube:* https://youtube.com/@masterofmax9214?si=S5DHg-4T14AnWQK0
*Instagram:* https://www.instagram.com/max_.kstr?igsi=MXduaWVrZW9pbnBzbg==
*Website:* maxichen.de
*LoveBot-Dashboard:* maxichen.gamebot.me
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
  return { ...source, contextInfo: buildNewsletterContext(source.contextInfo) };
};

/* Baut den Kanal-Kontext (contextInfo) — einzige Quelle der Wahrheit.
   forwardedNewsletterMessageInfo → WhatsApp zeigt „über LoveBot-Kanal
   (Channel)“ / den Kanal-Link an jeder Bot-Nachricht an. */
function buildNewsletterContext(existing) {
  const contextInfo = { ...(existing && typeof existing === 'object' ? existing : {}) };
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
  return contextInfo;
}

/* ─────────────────────────────────────────────────────────────────────
   JEDE Bot-Nachricht als „weitergeleitet vom LoveBot-Kanal“ markieren
   ─────────────────────────────────────────────────────────────────────
   Diese Funktion läuft an der WURZEL — sie wickelt sock.relayMessage
   ab, den letzten gemeinsamen Punkt, durch den wirklich JEDE ausgehende
   Nachricht läuft:
     · sock.sendMessage()  (Text/Bild/Video/Audio/Sticker/Dokument/…)
     · sock.sendJson()     (Rich-Responses, Meta-AI-Karten)
     · rohe generateWAMessage…+relayMessage (Menüs, Listen, Buttons)
     · MESSAGE_EDIT (Typ 14) — Bearbeitungen von Lade- & Ping-Nachrichten
   Gesetzt wird contextInfo.forwardedNewsletterMessageInfo → WhatsApp
   zeigt „über Kanal weitergeleitet · LoveBot · Kanal-Link“ an.
   ───────────────────────────────────────────────────────────────────── */

/* Nachrichten-Typen, die KEINE echte Bot-Nachricht sind und deshalb
   NICHT als Kanal-Weiterleitung markiert werden (sie haben in WhatsApp
   kein sinnvolles contextInfo bzw. würden brechen). */
const NEWSLETTER_SKIP_MESSAGE_KEYS = new Set([
  'protocolMessage',
  'reactionMessage',
  'encReactionMessage',
  'pollUpdateMessage',
  'senderKeyDistributionMessage',
  'messageContextInfo',
  'keepInChatMessage',
  'unavailableMessage',
  'chat',
  'stickerSyncRerequestMessage'
]);

/* Hängt den Kanal-Kontext an einen einzelnen Nachrichten-„Content“-
   Untertyp an (z. B. das Objekt unter extendedTextMessage/imageMessage/
   listMessage/…). Gibt das (ggf. neue) Objekt zurück. */
function markNewsletterSubtype(obj, key) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map((item) => (item && typeof item === 'object' ? markNewsletterSubtype(item, key) : item));
  }
  if (key.endsWith('Message') && !NEWSLETTER_SKIP_MESSAGE_KEYS.has(key)) {
    obj.contextInfo = buildNewsletterContext(obj.contextInfo);
  }
  return obj;
}

/* Rekursiver Durchstieg durch einen fertigen WA-Message-Payload.
   Versteht Wrapper (ephemeral/viewOnce/documentWithCaption/…) und
   Protocol-Edits (bearbeitete Nachricht wird mit-markiert). */
function injectNewsletterIntoWAMessage(messageObj) {
  if (!messageObj || typeof messageObj !== 'object') return messageObj;
  const keys = Object.keys(messageObj);

  /* conversation ist ein String und kann kein contextInfo tragen →
     in extendedTextMessage umwandeln, damit der Kanal-Kontext bleibt. */
  if ('conversation' in messageObj && typeof messageObj.conversation === 'string') {
    const text = messageObj.conversation;
    delete messageObj.conversation;
    messageObj.extendedTextMessage = {
      text,
      contextInfo: buildNewsletterContext(undefined)
    };
  }

  for (const key of keys) {
    if (key === 'conversation') continue; // oben schon ersetzt
    const val = messageObj[key];

    /* Bearbeitung (protocolMessage Typ 14): die NEUE Nachricht ist in
       editedMessage → die markieren wir, damit auch der Bearbeitungs-
       Stand (z. B. fertiger Ping-Report) als Kanal-Nachricht gilt. */
    if (key === 'protocolMessage' && val && typeof val === 'object') {
      if (val.editedMessage && typeof val.editedMessage === 'object') {
        val.editedMessage = injectNewsletterIntoWAMessage(val.editedMessage);
      }
      continue;
    }

    /* Wrapper-Nachrichten: darin liegt die eigentliche Nachricht. */
    if (key === 'ephemeralMessage' || key === 'viewOnceMessage') {
      if (val && typeof val === 'object' && val.message && typeof val.message === 'object') {
        val.message = injectNewsletterIntoWAMessage(val.message);
      }
      continue;
    }
    if (key === 'documentWithCaptionMessage') {
      if (val && typeof val === 'object' && val.message && typeof val.message === 'object') {
        val.message = injectNewsletterIntoWAMessage(val.message);
      }
      continue;
    }
    if (key === 'botForwardedMessage') {
      if (val && typeof val === 'object' && val.message && typeof val.message === 'object') {
        val.message = injectNewsletterIntoWAMessage(val.message);
      }
      continue;
    }

    /* Echte Nachrichten-Untertypen markieren. */
    if (key.endsWith('Message') && !NEWSLETTER_SKIP_MESSAGE_KEYS.has(key) &&
        val && typeof val === 'object') {
      markNewsletterSubtype(val, key);
    }
  }
  return messageObj;
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

/* ── 💜 Level-Up-Ankündigung (EINE zentrale Stelle für alle XP-Quellen):
   Mention in Gruppen (@User + mentions-Array), kein Mention im Privat-Chat,
   Mehrfach-Level-Up als „Level 9 → Level 11“. Schickt nichts, wenn `events`
   kein Level-/Prestige-Up enthält. Darf XP-Abläufe niemals brechen. */
/* 💜 LovePlus-Helfer (Progression 3.0): ein Objekt für Default-Dispatch
   UND $achievements-Delegation — Spiele geben XP + zählen Statistik. */
function lovePlusHelpers(userProfile) {
  return {
    loadUserProfileForSender, saveUserProfile, resolveBanTarget,
    identityKey, cleanId, sendReaction, reactions, withProfileLock,
    /* 💜 Level-System: Spiele geben XP (Sieg +15, Niederlage +2) */
    grantGameXp: (amount, source = 'games', outcome = null) => {
      try {
        if (!userProfile || !xpEligible(userProfile)) return null;
        const res = grantLevelXp(userProfile, amount, { source });
        /* 📊 Progression 4.0: Zähler + Tages-Aktivität zentral erfassen */
        if (res && res.granted > 0) recordGamePlayed(userProfile, outcome);
        return res;
      } catch (gameXpErr) {
        return null;
      }
    }
  };
}

/* 💰 Plus-Store-Helfer (6.0): Achievement-Zahl + Inventar für Economy-Anzeigen. */
function plusAchCount(bid) {
  try {
    if (!bid) return 0;
    const st = loadStore();
    return Object.keys(st.users?.[bid]?.achievements || {}).length;
  } catch (e) { return 0; }
}
function plusUserFor(bid) {
  try {
    if (!bid) return null;
    return loadStore().users?.[bid] || null;
  } catch (e) { return null; }
}

/* 💜 Progression-Center für $me (alle Karten-Varianten) — nur echte Werte. */
/* 💜 7.0: Gruppen-Aktivität + AI-Nutzung für $me (ehrlich, Fallback „–") */
function meGroupActivity(db, bid) {
  let msgs = 0, xp = 0, groups = 0;
  try {
    for (const g of Object.values(db?.groups || {})) {
      const m = g?.xp?.members?.[bid];
      if (m) { groups++; msgs += m.m || 0; xp += m.xp || 0; }
    }
  } catch (e) {}
  return { msgs, xp, groups };
}
async function meAiUsage(bid) {
  try { const aim = await import('./ai/memory.js'); return aim.getAiUsage(bid); } catch (e) { return null; }
}

function meProgressionSection(profile, pref = '$') {
  try {
    const bid = profile?.identity?.bid || '';
    let rankPos = null, rankTotal = 0, rankPrev = null;
    try {
      const r = bid ? cachedGlobalRank(readDb().users || {}, bid) : null;
      if (r && r.pos) { rankPos = r.pos; rankTotal = r.total; }
      const hist = profile?.progression?.rankHistory || [];
      const last = hist[hist.length - 1];
      if (last && last.pos && last.pos !== rankPos) rankPrev = last.pos;
    } catch (e) {}
    return '\n\n' + buildProfileCenter(profile || {}, {
      name: getProfileDisplayName(profile || {}, 'Du'),
      rankPos, rankTotal, rankPrev, pref, skipUser: true /* USER-Block steht schon in der Karte */
    });
  } catch (e) { return ''; }
}

/* ── 💜 Progression 5.0: Ranglisten-Cache (30 s TTL) ──────────────────
   $me/$rank/$top/$compare teilen sich EINE sortierte Momentaufnahme statt
   je Aufruf neu zu scannen. Max. 30 s alt — dokumentiert, kein Fake.     */
let rankCache = { at: 0, rows: [] };
function cachedRankRows(users) {
  const now = Date.now();
  if (now - rankCache.at < 30000 && rankCache.rows.length) return rankCache.rows;
  const rows = Object.entries(users || {})
    .filter(([, u]) => u && u.progression && ((u.progression.level || 0) > 0 || (u.progression.xp || 0) > 0 || (u.progression.totalXp || 0) > 0))
    .map(([bid, u]) => ({ bid, prestige: Number(u.progression.prestige) || 0, level: Number(u.progression.level) || 0, xp: Number(u.progression.xp) || 0, totalXp: Number(u.progression.totalXp) || 0 }))
    .sort((a, b) => (b.prestige - a.prestige) || (b.level - a.level) || (b.xp - a.xp) || (b.totalXp - a.totalXp));
  rankCache = { at: now, rows };
  return rows;
}
function cachedGlobalRank(users, bid) {
  const rows = cachedRankRows(users);
  const pos = rows.findIndex((r) => r.bid === bid);
  return { pos: pos >= 0 ? pos + 1 : null, total: rows.length };
}

async function sendLevelUpAnnouncement(sock, from, msg, { profile, name, events, isGroup = false, mentionJid = null, copper = 0, extraUnlocks = [] } = {}) {
  try {
    const evs = Array.isArray(events) ? events : [];
    const hasPrestige = evs.some((e) => e && e.type === 'prestige');
    const levelUps = evs.filter((e) => e && e.type === 'levelup');
    /* 🎉 Freischaltungen sammeln (Engine-Events + loveplus-Achievements), gruppiert (5.0) */
    const wins = [];
    const goalName = (e) => ({ xp: 'XP-Ziel', messages: 'Nachrichten-Ziel', commands: 'Befehls-Ziel', games: 'Spiele-Ziel' }[e?.goal] || 'Ziel');
    for (const e of evs) {
      if (!e) continue;
      if (e.type === 'milestone') wins.push(`🎁 *Meilenstein Lv ${e.level}:* ${e.reward}${Number(e.coins) > 0 ? ` (+${Number(e.coins).toLocaleString('de-DE')} Kupfer)` : ''}`);
      else if (e.type === 'title') wins.push(`📛 *Neuer Titel:* ${e.emoji} *${e.name}*`);
      else if (e.type === 'badge') wins.push(`🏅 *Neues Badge:* ${e.emoji} *${e.name}*`);
      else if (e.type === 'chest') wins.push(`🎁 *Truhe bereit:* ${e.label || 'Belohnung'} (+${Number(e.copper || 0).toLocaleString('de-DE')} Kupfer) — abholen mit *$reward claim*`);
      else if (e.type === 'daybonus') wins.push(`⭐ *Erste Aktion heute:* +${e.amount} XP`);
      else if (e.type === 'streakbonus') wins.push(`🔥 *${e.days}-Tage-Streak:* +${e.amount} XP`);
      else if (e.type === 'dailygoal') wins.push(`🎯 *Tagesziel (${goalName(e)}) erreicht:* +${Number(e.reward || 0).toLocaleString('de-DE')} Kupfer${Number(e.streak) > 1 ? ` · 🔥 Ziel-Streak ×${e.streak}` : ''}`);
      else if (e.type === 'weeklygoal') wins.push(`🏆 *Wochenziel (${goalName(e)}) erreicht:* +${Number(e.reward || 0).toLocaleString('de-DE')} Kupfer`);
    }
    const extraAch = [], extraBadges = [];
    for (const a of (Array.isArray(extraUnlocks) ? extraUnlocks : [])) {
      if (!a || !a.name) continue;
      (a.area ? extraBadges : extraAch).push(a);
    }
    if (extraAch.length) {
      wins.push(`🏆 *ACHIEVEMENTS (${extraAch.length})*`);
      for (const a of extraAch.slice(0, 6)) wins.push(`${a.emoji || '🏆'} *${a.name}* — _${a.desc || ''}_`);
      if (extraAch.length > 6) wins.push(`_… +${extraAch.length - 6} weitere — $achievements_`);
    }
    if (extraBadges.length) {
      wins.push(`🏅 *BADGES (${extraBadges.length})*`);
      for (const a of extraBadges.slice(0, 6)) wins.push(`${a.emoji || '🏅'} *${a.name}* — _${a.desc || ''}_`);
      if (extraBadges.length > 6) wins.push(`_… +${extraBadges.length - 6} weitere — $badges_`);
    }
    if (!hasPrestige && !levelUps.length && !wins.length) return false;
    const mention = isGroup && mentionJid ? '@' + cleanId(mentionJid) : null;
    const finalLevel = Math.max(0, Math.floor(Number(profile?.progression?.level) || 0));
    const fromLevel = levelUps.length > 1 ? finalLevel - levelUps.length : null;
    let text;
    if (hasPrestige || levelUps.length) {
      text = hasPrestige
        ? prestigeAnnounce(profile, name, { mention })
        : levelUpAnnounce(profile, name, { mention, fromLevel, copper });
      if (wins.length) text += '\n\n🎉 *NEU FREIGESCHALTET*\n' + wins.join('\n');
    } else {
      const who = mention || `*${name}*`;
      text = `> 🎉 *NEU FREIGESCHALTET*\n\n💜 ${who}\n\n` + wins.join('\n');
    }
    const opts = { quoted: msg };
    if (mention) opts.mentions = [mentionJid];
    await sock.sendMessage(from, { text }, opts);
    return true;
  } catch (e) {
    return false;
  }
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
/* 💖 Love-Aktions-Zusammenfassung (lovecore.json) — echte Zähler */
function loveActionSummary(actions = {}, max = 4) {
  const entries = Object.entries(actions || {})
    .map(([k, v]) => ({ k, v: Number(v) || 0 }))
    .filter((e) => e.v > 0)
    .sort((a, b) => b.v - a.v);
  if (!entries.length) return null;
  const linesTop = entries.slice(0, max).map((e) => {
    const m = LOVE_ACTIONS[e.k];
    return (m ? m.emoji + ' ' : '') + e.v + (m ? ' ' + m.label : '');
  });
  return { total: entries.reduce((s, e) => s + e.v, 0), lines: linesTop, rest: Math.max(0, entries.length - max) };
}

function xpBarText(cur, needed, width = 18) {
  const c = Math.max(0, Number(cur) || 0);
  const n = Math.max(1, Number(needed) || 1);
  const pct = Math.min(100, Math.round((c / n) * 100));
  const filled = Math.round((pct / 100) * width);
  return { bar: '█'.repeat(filled) + '░'.repeat(width - filled), pct, rest: Math.max(0, n - c) };
}

function buildCompactProfileCard({ userProfile, snapshot, roleText = '', name, username, regDate, pref = '$', personalInfo = null, loveMsgs = 0, memberDays = null, hideEconomy = false }) {
  const p = userProfile || {};
  const prog = p.progression || {};
  const xp = xpBarText(prog.xp, prog.neededXpForLvOrPrestigeUp);
  const snap = snapshot || {};
  const eco = snap.economy || {};
  const love = snap.love || {};
  const pet = snap.pet;
  const ach = snap.achievements || { count: 0, preview: [] };
  const games = snap.games || {};
  const de = (n) => Number(n || 0).toLocaleString('de-DE');
  const out = [];
  const showName = (name && name !== 'Nicht angegeben') ? name : 'LoveBot-Profil';
  const showUser = (username && username !== 'Nicht vorhanden') ? username : '';
  const verified = p.status?.verified === true;

  out.push('> 🌹✨ *' + showName + '* ✨🌹');
  if (showUser) out.push('> 🔗 ' + showUser);
  if (verified) out.push('> ✅ Verifiziert · 🛡️ DSGVO ' + (p.status?.dsgvo?.accepted ? '✓' : '—'));
  if (roleText && String(roleText).trim()) out.push('> ' + String(roleText).trim().replace(/^[•·]\s*/, ''));
  if (personalInfo) {
    const pv = [];
    if (personalInfo.age) pv.push('🎂 ' + personalInfo.age);
    if (personalInfo.status) pv.push('💘 ' + personalInfo.status);
    if (personalInfo.city) pv.push('📍 ' + personalInfo.city);
    if (pv.length) out.push('> ' + pv.join(' · '));
  }
  if (regDate) out.push('> 📅 Mitglied seit ' + regDate + (memberDays !== null && memberDays !== undefined && memberDays >= 0 ? ' (' + memberDays + ' Tag(e))' : ''));
  out.push('');

  out.push('⭐ *Level ' + (prog.level || 0) + '*' + (prog.prestige ? ' · 👑 Prestige ' + prog.prestige : ''));
  out.push('`' + xp.bar + '`  ' + xp.pct + '%');
  out.push('✨ ' + de(prog.xp) + ' / ' + de(prog.neededXpForLvOrPrestigeUp) + ' XP — noch ' + de(xp.rest) + ' bis Level ' + ((prog.level || 0) + 1));
  out.push('🏅 ' + rankFor(prog.prestige || 0, prog.level || 0).full + ' · Σ ' + de(prog.totalXp) + ' XP');
  out.push('');

  out.push('💎 *ECONOMY*');
  if (hideEconomy) {
    out.push('🔒 _privat — diese Person teilt ihr Vermögen nicht._');
  } else {
    out.push('🤎 ' + de(eco.copper) + ' Kupfer · 🩶 ' + de(eco.silver) + ' Silber · 💛 ' + de(eco.gold) + ' Gold · 🩵 ' + de(eco.platin) + ' Platin');
    const econExtras = [];
    if (eco.bank) econExtras.push('🏦 ' + de(eco.bank) + ' Bank');
    if (eco.items) econExtras.push('📦 ' + eco.items + ' Items');
    if (eco.walletRank) econExtras.push('🥇 Wallet-Rang #' + eco.walletRank);
    if (econExtras.length) out.push(econExtras.join(' · '));
  }
  out.push('');

  out.push('❤️ *LIEBE*');
  if (love.married) {
    out.push('💍 Verheiratet mit *' + (love.spouseName || '?') + '*' + (love.daysTogether !== null && love.daysTogether !== undefined ? ' · ' + love.daysTogether + ' Tag(e)' : ''));
  } else {
    out.push('🕊️ Single — die große Liebe wartet noch …');
  }
  if (love.couple) {
    out.push('💗 Couple Lv ' + (love.couple.level || 0) + ' · ' + de(love.couple.loveXp) + ' Love-XP · 🔥 ' + (love.couple.streak || 0) + 'd Streak · 💌 ' + (love.couple.memories || 0) + ' Erinnerungen');
  }
  out.push('');

  if (pet) {
    out.push('🐾 *HAUSTIER*');
    out.push(pet.name + ' ' + pet.type + ' (Lv ' + (pet.level || 1) + ') · ❤️ ' + (pet.love ?? 0) + '% · 😊 ' + (pet.mood ?? 0) + '%');
    out.push('🍖 Hunger ' + (pet.hunger ?? 0) + '% · ⚡ Energie ' + (pet.energy ?? 0) + '%');
    out.push('');
  }

  const achLine = (ach.count || 0) > 0 ? '🏆 ' + ach.count + ' Erfolge' : '';
  const gameLine = (games.wins || games.losses) ? '🎮 ' + de(games.wins) + ' Siege · ' + de(games.losses) + ' Niederlagen' : '';
  const streakLine = '🔥 Daily-Streak ' + (snap.streak || 0) + 'd';
  const loveLine = loveMsgs > 0 ? '💌 ' + de(loveMsgs) + ' Liebesnachrichten' : '';
  out.push([achLine, streakLine, loveLine, gameLine].filter(Boolean).join(' · '));
  out.push('');
  out.push('💡 ' + pref + 'me info — alles im Detail · ' + pref + 'me (Buttons) — Schnellzugriff');
  return out.join('\n');
}

function buildDetailProfileCard({ userProfile, snapshot, isHost = false, roleText = '', name, username, regDate, pref = '$', privateView = false, jid = '', lid = '', sid = '' }) {
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
  const rewards = p.rewards || {};
  const status = p.status || {};
  const de = (n) => Number(n || 0).toLocaleString('de-DE');
  const coreKey = love.couple?.key || coupleKeyForProfile(p);
  const core = getCore(p?.identity?.bid || '', coreKey);
  const myCore = core.user || {};
  const cpCore = core.couple || {};
  const myActs = loveActionSummary(myCore.actions);
  const cpActs = loveActionSummary(cpCore.actions);
  const out = ['> 🪪✨ *PROFIL — ALLES IM DETAIL* ✨🪪',
    '> 💜 _Dein komplettes LoveBot-Profil · Werte live aus deinem Konto_'];

  /* 👑 Account (nur der Owner sieht das) */
  if (isHost) {
    out.push('', '👑 *ACCOUNT · nur du siehst das*',
      '• Username: ' + (username || '—'),
      '• 📱 Telefon: ' + (p.identity?.phone || '—'),
      '• JID: `' + (jid || '—') + '` · LID: `' + (lid || '—') + '`',
      '• SID: `' + (sid || '—') + '` · BID: `' + (p.identity?.bid || '—') + '`');
  }

  /* Person */
  out.push('', '🪪 *PERSON*',
    '• Name: *' + (reg.name || name || '—') + '*',
    '• 💘 Status: ' + (reg.status || '—'),
    '• 📍 Stadt: ' + cityLabel(reg, { privateChat: privateView }));
  if (privateView || isHost) {
    out.push('• 🎂 Alter: ' + ageLabel(reg, { reveal: true }));
  }
  if (reg.registeredAt) {
    const daysMember = Math.max(0, Math.floor((Date.now() - new Date(reg.registeredAt).getTime()) / 86400000));
    out.push('• 📅 Mitglied seit: ' + (regDate || formatDateTimeShort(reg.registeredAt)) + ' (' + daysMember + ' Tag(e))');
  } else if (regDate) {
    out.push('• 📅 Mitglied seit: ' + regDate);
  }

  /* Status */
  out.push('', '🛡️ *STATUS*',
    '• DSGVO: ' + (status.dsgvo?.accepted ? 'Akzeptiert ✅' : (status.dsgvo?.rejected ? 'Abgelehnt ❌' : 'Offen ☑️')) + (status.dsgvo?.acceptedAt ? ' · am ' + formatDateTimeShort(status.dsgvo.acceptedAt) : ''),
    '• Verify: ' + (status.verified ? 'Verifiziert ✅' : 'Nicht verifiziert ☑️') + (status.verifiedAt ? ' · seit ' + formatDateTimeShort(status.verifiedAt) : ''),
    '• Mapping: ' + (status.mappedAt ? formatDateTimeShort(status.mappedAt) : '—'));

  /* Level */
  out.push('', '⭐ *LEVEL & XP*',
    '• Level *' + (prog.level || 0) + '*' + (prog.prestige ? ' · Prestige ' + prog.prestige : ''),
    '• `' + xp.bar + '`  ' + xp.pct + '%',
    '• ' + de(prog.xp) + ' / ' + de(prog.neededXpForLvOrPrestigeUp) + ' XP',
    '• Noch *' + de(xp.rest) + ' XP* bis Level ' + ((prog.level || 0) + 1),
    '• 🏅 ' + rankFor(prog.prestige || 0, prog.level || 0).full + ' · Σ ' + de(prog.totalXp) + ' XP Lifetime');

  /* Economy */
  out.push('', '💎 *ECONOMY*',
    '• 🤎 ' + de(eco.copper) + ' Kupfer · 🩶 ' + de(eco.silver) + ' Silber · 💛 ' + de(eco.gold) + ' Gold · 🩵 ' + de(eco.platin) + ' Platin',
    '• 🏦 Bank: ' + de(eco.bank) + (p.bank?.active ? ' (aktiv)' : ''),
    '• Wallet-Rang: ' + (eco.walletRank ? '#' + eco.walletRank : '—') + ' · 📦 Items: ' + (eco.items || 0));
  out.push('', '⏱️ *BELOHNUNGEN*',
    '• Täglich: ' + (rewards.lastDailyAt ? formatDateTimeShort(rewards.lastDailyAt) : (prog.lastDaily ? 'am ' + prog.lastDaily : 'noch nie')),
    '• Wöchentlich: ' + (rewards.lastWeeklyAt ? formatDateTimeShort(rewards.lastWeeklyAt) : 'noch nie'),
    '• Monatlich: ' + (rewards.lastMonthlyAt ? formatDateTimeShort(rewards.lastMonthlyAt) : 'noch nie'),
    '• Arbeiten: ' + (rewards.lastWorkAt ? formatDateTimeShort(rewards.lastWorkAt) : 'noch nie'));

  /* Liebe */
  out.push('', '❤️ *LIEBE*');
  if (love.married) {
    out.push('• 💍 Verheiratet mit *' + (love.spouseName || '?') + '*',
      '• 🏩 Seit ' + (love.marriedAt ? formatDateTimeShort(love.marriedAt) : '—') + ' — ' + (love.daysTogether ?? 0) + ' Tag(e)',
      (love.couple ? '• 💗 Couple-Level ' + love.couple.level + ' · ' + de(love.couple.loveXp) + ' Love-XP · 🔥 ' + love.couple.streak + 'd Streak · 💌 ' + love.couple.memories + ' Erinnerungen' : '• 💗 Couple-Stats: siehe *' + pref + 'couplestats*'),
      '• 💒 Ehen gesamt: ' + (love.marriages || 1));
    if (cpCore.breakups) out.push('• 💔 Trennungen: ' + cpCore.breakups);
    if (cpActs) out.push('• ' + cpActs.lines.join(' · ') + (cpActs.rest ? ' · +' + cpActs.rest + ' weitere' : ''));
  } else {
    out.push('• 🕊️ Single — die große Liebe wartet noch …');
  }

  /* Pet */
  out.push('', '🐾 *HAUSTIER*');
  if (pet) {
    out.push('• ' + pet.name + ' ' + pet.type + ' — Level ' + pet.level,
      '• ❤️ Bond ' + (pet.love ?? 0) + '% · 😊 Glück ' + (pet.mood ?? 0) + '% · 🍖 Hunger ' + (pet.hunger ?? 0) + '% · ⚡ Energie ' + (pet.energy ?? 0) + '%');
  } else {
    out.push('• Noch kein Haustier — *' + pref + 'pet create <name>* 🐾');
  }

  /* Achievements */
  out.push('', '🏆 *ACHIEVEMENTS*',
    '• ' + (ach.count || 0) + ' freigeschaltet' + (ach.count ? '' : ' — noch keine'));
  for (const a of (ach.preview || []).slice(0, 5)) out.push('• ' + (a.emoji || '🏅') + ' ' + a.name);
  if (ach.count > 5) out.push('• … und ' + (ach.count - 5) + ' weitere — *' + pref + 'achievements*');

  /* Games */
  const played = games.played ?? p.games?.gamesPlayed ?? 0;
  const winsN = games.wins || 0;
  const lossesN = games.losses || 0;
  const totalGames = winsN + lossesN;
  const quote = totalGames > 0 ? Math.round((winsN / totalGames) * 100) + '%' : '—';
  out.push('', '🎮 *GAMES*',
    '• Gespielt: ' + de(played || totalGames) + ' Runden',
    '• Siege: ' + de(winsN) + ' · Niederlagen: ' + de(lossesN) + ' · Quote: ' + quote,
    '• 🔥 Siegesserie: ' + de(games.winStreak || 0) + ' (Rekord ' + de(p.games?.highestWinStreak || 0) + ')',
    '• Höchster Einsatz: ' + de(p.games?.highestWin || 0) + (p.games?.lastPlayedAt ? ' · Zuletzt: ' + formatDateTimeShort(p.games.lastPlayedAt) : ''));

  /* Aktivität */
  out.push('', '📊 *AKTIVITÄT*',
    '• 🔥 Daily-Streak: ' + (snap.streak || 0) + ' Tag(e)',
    '• 💌 Liebesnachrichten: ' + de(myCore.loveMessages || 0) + (core.couple ? ' _(als Paar: ' + de(cpCore.loveMessages || 0) + ')_' : ' _(als Single)_'));
  if (myActs) out.push('• 💖 ' + myActs.total + ' Love-Aktionen: ' + myActs.lines.join(' · ') + (myActs.rest ? ' · +' + myActs.rest + ' mehr' : ''));
  out.push('• 🔒 Sichtbarkeit: Stadt ' + (reg?.privacy?.hideCity ? 'versteckt' : (privateView ? 'sichtbar' : 'maskiert')) +
    ' · Alter ' + (reg?.privacy?.hideAge ? 'versteckt' : (isMinor(reg) ? 'unter 18 (geschützt)' : (privateView ? 'sichtbar' : 'nicht angezeigt'))));
  if (roleText && String(roleText).trim()) out.push('', String(roleText).trim());
  out.push('', '🌹 _LoveBot by Maxichen_ 🌹');
  return out.join('\n');
}

function buildOwnerProfileCard({ userProfile, snapshot = null, roleText = '', name = 'Maxichen', username = '', regDate = 'Unbekannt', pref = '$', regAge = '—', regStatus = '—', regCity = '—', jid = 'N/A', lid = 'N/A', sid = 'N/A', bid = 'N/A', dsgvo = '—', verify = '—', stats = null }) {
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
  const rewards = p.rewards || {};
  const status = p.status || {};
  const de = (n) => Number(n || 0).toLocaleString('de-DE');
  const ram = process.memoryUsage ? Math.round((process.memoryUsage().rss || 0) / 1024 / 1024) : 0;
  const coreKey = love.couple?.key || coupleKeyForProfile(p);
  const core = getCore(p?.identity?.bid || '', coreKey);
  const myCore = core.user || {};
  const cpCore = core.couple || {};
  const myActs = loveActionSummary(myCore.actions);
  const cpActs = loveActionSummary(cpCore.actions);
  const fmtUp = (sec) => {
    sec = Math.max(0, Math.floor(sec || 0));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return (h ? h + 'h ' : '') + (m || h ? m + 'm ' : '') + s + 's';
  };
  const daysMember = reg.registeredAt ? Math.max(0, Math.floor((Date.now() - new Date(reg.registeredAt).getTime()) / 86400000)) : null;
  const out = [];

  out.push('> 👑✨ *LOVE BOT — OWNER PROFIL* ✨👑');
  out.push('> 💜 _Der Boss ist im Haus._ 🕶️');
  out.push('> 🌹┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈🌹');
  out.push('');
  out.push('👤 *' + name + '*' + (username && username !== 'Nicht vorhanden' ? ' · ' + username : ''));
  if (roleText && String(roleText).trim()) out.push('> ' + String(roleText).trim().replace(/^[•·]\s*/, ''));
  out.push('> 🎂 ' + regAge + ' · 💘 ' + regStatus + ' · 📍 ' + regCity);
  out.push('> 📅 Registriert seit ' + regDate + (daysMember !== null ? ' (' + daysMember + ' Tag(e))' : ''));
  out.push('');

  out.push('⭐ *LEVEL & XP*');
  out.push('> Level ' + (prog.level || 0) + (prog.prestige ? ' · 👑 Prestige ' + prog.prestige : ''));
  out.push('> `' + xp.bar + '`  ' + xp.pct + '%');
  out.push('> ✨ ' + de(prog.xp) + ' / ' + de(prog.neededXpForLvOrPrestigeUp) + ' XP — noch ' + de(xp.rest) + ' bis Level ' + ((prog.level || 0) + 1));
  out.push('> 🏅 ' + rankFor(prog.prestige || 0, prog.level || 0).full + ' · Σ ' + de(prog.totalXp) + ' XP');
  out.push('');

  out.push('💎 *ECONOMY*');
  out.push('> 🤎 ' + de(eco.copper) + ' Kupfer · 🩶 ' + de(eco.silver) + ' Silber · 💛 ' + de(eco.gold) + ' Gold · 🩵 ' + de(eco.platin) + ' Platin');
  const econExtras = [];
  if (eco.bank) econExtras.push('🏦 ' + de(eco.bank) + ' Bank' + (p.bank?.active ? ' (aktiv)' : ''));
  if (eco.items) econExtras.push('📦 ' + eco.items + ' Items');
  if (eco.walletRank) econExtras.push('🥇 Wallet-Rang #' + eco.walletRank);
  if (econExtras.length) out.push('> ' + econExtras.join(' · '));
  out.push('> ⏱️ Zuletzt: täglich ' + (rewards.lastDailyAt ? formatDateTimeShort(rewards.lastDailyAt) : (prog.lastDaily ? 'am ' + prog.lastDaily : '—')) +
    ' · Arbeit ' + (rewards.lastWorkAt ? formatDateTimeShort(rewards.lastWorkAt) : '—'));
  out.push('');

  out.push('❤️ *LIEBE*');
  if (love.married) {
    out.push('> 💍 Verheiratet mit *' + (love.spouseName || '?') + '* · seit ' + (love.marriedAt ? formatDateTimeShort(love.marriedAt) : '?') + ' · ' + (love.daysTogether ?? 0) + ' Tag(e)');
    if (love.couple) out.push('> 💗 Couple Lv ' + (love.couple.level || 0) + ' · ' + de(love.couple.loveXp) + ' Love-XP · 🔥 ' + (love.couple.streak || 0) + 'd Streak · 💌 ' + (love.couple.memories || 0) + ' Erinnerungen');
    out.push('> 💒 Ehen gesamt: ' + (love.marriages || 1) + (cpCore.breakups ? ' · 💔 Trennungen: ' + cpCore.breakups : ''));
    if (cpActs) out.push('> 💑 Paar-Aktionen: ' + cpActs.lines.join(' · ') + (cpActs.rest ? ' · +' + cpActs.rest : ''));
  } else {
    out.push('> 🕊️ Single — die große Liebe wartet noch …');
  }
  out.push('');

  out.push('🐾 *HAUSTIER*');
  if (pet) out.push('> ' + pet.name + ' ' + pet.type + ' (Lv ' + (pet.level || 1) + ') · ❤️ ' + (pet.love ?? 0) + '% · 😊 ' + (pet.mood ?? 0) + '% · 🍖 ' + (pet.hunger ?? 0) + '% · ⚡ ' + (pet.energy ?? 0) + '%');
  else out.push('> Noch keins — ' + pref + 'pet create 🐾');
  out.push('');

  out.push('🏆 *ERFOLGE*');
  out.push('> ' + (ach.count || 0) + ' freigeschaltet');
  for (const a of (ach.preview || []).slice(0, 5)) out.push('> ' + (a.emoji || '🏅') + ' ' + a.name);
  if (ach.count > 5) out.push('> … und ' + (ach.count - 5) + ' weitere');
  out.push('');

  out.push('🎮 *GAMES*');
  const winsN = games.wins || 0;
  const lossesN = games.losses || 0;
  const totalG = winsN + lossesN;
  const quote = totalG > 0 ? Math.round((winsN / totalG) * 100) + '%' : '—';
  out.push('> Siege ' + de(winsN) + ' · Niederlagen ' + de(lossesN) + ' · Quote ' + quote);
  out.push('> 🔥 Serie ' + de(games.winStreak || 0) + ' (Rekord ' + de(p.games?.highestWinStreak || 0) + ') · Höchster Einsatz ' + de(p.games?.highestWin || 0));
  out.push('> 🎯 Gespielt ' + de(p.games?.gamesPlayed || totalG) + ' Runden' + (p.games?.lastPlayedAt ? ' · Zuletzt ' + formatDateTimeShort(p.games.lastPlayedAt) : ''));
  out.push('');

  out.push('🛡️ *STATUS-ZEITEN*');
  out.push('> DSGVO: ' + (status.dsgvo?.accepted ? 'akzeptiert ✅ am ' + formatDateTimeShort(status.dsgvo.acceptedAt) : (status.dsgvo?.rejected ? 'abgelehnt ❌' : 'offen ☑️')));
  out.push('> Verify: ' + (status.verified ? '✅ seit ' + (status.verifiedAt ? formatDateTimeShort(status.verifiedAt) : '—') : '☑️ nicht verifiziert'));
  out.push('> Mapping: ' + (status.mappedAt ? formatDateTimeShort(status.mappedAt) : '—'));
  out.push('');

  out.push('📊 *AKTIVITÄT*');
  out.push('> 🔥 Daily-Streak ' + (snap.streak || 0) + 'd · 💌 ' + de(myCore.loveMessages || 0) + ' Liebesnachrichten' + (core.couple ? ' (Paar: ' + de(cpCore.loveMessages || 0) + ')' : ''));
  if (myActs) out.push('> 💖 ' + myActs.total + ' Love-Aktionen: ' + myActs.lines.join(' · ') + (myActs.rest ? ' · +' + myActs.rest : ''));
  out.push('');

  out.push('🔐 *ACCOUNT · nur du siehst das*');
  out.push('> Username: ' + (username && username !== 'Nicht vorhanden' ? username : '—'));
  out.push('> 📱 Telefon: ' + (p.identity?.phone || '—'));
  out.push('> JID: `' + jid + '` · LID: `' + lid + '`');
  out.push('> SID: `' + sid + '` · BID: `' + bid + '`');
  out.push('> 🛡️ DSGVO: ' + dsgvo + ' · Verify: ' + verify);
  out.push('');

  out.push('📊 *LIVE-SYSTEM*');
  if (stats) {
    out.push('> 👥 ' + stats.totalUsers + ' Nutzer · 📝 ' + stats.registeredUsers + ' registriert · ✅ ' + stats.verifiedUsers + ' verifiziert');
    out.push('> 👥 ' + stats.totalGroups + ' Gruppen · 🟢 ' + stats.activeGroups + ' aktiv · 🛠️ ' + stats.setupGroups + ' Setup');
    out.push('> 🚫 ' + stats.totalBans + ' Bans · 💤 ' + stats.totalAfk + ' AFK');
    out.push('> ⏱️ Uptime ' + stats.uptime + ' · 💾 ' + ram + ' MB RAM · Node ' + (process.version || '?'));
  } else {
    out.push('> ⏱️ Uptime ' + fmtUp(process.uptime()) + ' · 💾 ' + ram + ' MB RAM · Node ' + (process.version || '?'));
  }
  out.push('');
  out.push('> 🌹┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈🌹');
  out.push('> 🏅 *Rolle:* Owner & Entwickler 👑');
  out.push('> 💜 *LoveBot* · maxichen.de · maxichen.gamebot.me');
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

/* ---------- 🚫 BLOCKCASE — Owner kann einzelne Befehle sperren ----- */
/* $blockcase <befehl> <grund> / $opencase <befehl> / $listbc          */
/* Streng Owner-only (Haupt-Owner + eingetragene Zusatz-Owner).        */
function getBlockedCommandsConfig(db) {
  db = ensureDb(db);
  if (!db.meta.blockedCommands || typeof db.meta.blockedCommands !== 'object') {
    db.meta.blockedCommands = {};
  }
  return db.meta.blockedCommands;
}

function normalizeBlockcaseCommandName(name) {
  let n = String(name || '').toLowerCase().trim();
  if (n.startsWith(pref)) n = n.slice(pref.length);
  n = n.replace(/^\$+/, '');
  return n;
}

function getBlockedCommandEntry(db, command) {
  const cfg = getBlockedCommandsConfig(db);
  const key = normalizeBlockcaseCommandName(command);
  return key && cfg[key] ? { key, ...cfg[key] } : null;
}

function blockCommand(db, command, reason, byLabel) {
  const cfg = getBlockedCommandsConfig(db);
  const key = normalizeBlockcaseCommandName(command);
  cfg[key] = {
    reason: String(reason || '').trim() || 'Kein Grund angegeben',
    blockedAt: new Date().toISOString(),
    blockedBy: byLabel || 'Owner'
  };
  return key;
}

function unblockCommand(db, command) {
  const cfg = getBlockedCommandsConfig(db);
  const key = normalizeBlockcaseCommandName(command);
  const existed = !!cfg[key];
  if (existed) delete cfg[key];
  return existed;
}

function isStrictOwner(db, jid, lid) {
  if (isMainOwner(jid, lid)) return true;
  if (getRegisteredOwner(db, jid, lid)) return true;
  return false;
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
/* 💜 7.0 AI-Frage: EIN Pfad für $ai/$ask/Chatmodus/Website-Fallback.
   Antwortet immer genau EINMAL (Streaming wird intern gesammelt). */
async function runAiQuestion(sock, from, msg, { text = '', bid = '', userProfile = null, rank = null, groupProfile = null, groupSubject = '', pref = '$' } = {}) {
  const q = String(text || '').trim();
  if (!q) {
    await sock.sendMessage(from, { text: `> 🤖 *LOVEAI*\n\nFrag mich etwas: *${pref}ai Wie bekomme ich XP?*\n\n• *${pref}aistatus* — Status\n• *${pref}aimodel* — Modell\n• *${pref}ai diagnose* — Diagnose\n• *${pref}aiclear* — Chat-Kontext löschen` }, { quoted: msg });
    return true;
  }
  try { await sendReaction(sock, from, '🤖', msg.key); } catch (e) {}
  let res;
  try {
    const eng = await import('./ai/engine.js');
    res = await eng.aiChat({
      bid, gid: from && from.endsWith('@g.us') ? cleanId(from) : '',
      text: q, profile: userProfile, rank,
      group: groupProfile, groupMeta: groupSubject ? { subject: groupSubject } : null,
      counts: null
    });
  } catch (e) {
    res = { ok: false, reason: 'unavailable', detail: String(e?.message || e).slice(0, 120) };
  }
  if (res && res.ok) {
    const foot = res.ms !== undefined ? `\n\n_⏱ ${res.ms} ms · ${res.model || ''}_` : '';
    await sock.sendMessage(from, { text: `🤖 *LoveAI*\n\n${res.text}${foot}` }, { quoted: msg });
  } else if (res && res.reason === 'limited') {
    const wait = res.retryMs && res.retryMs > 1000 ? ` (noch ~${Math.ceil(res.retryMs / 1000)} s)` : '';
    await sock.sendMessage(from, { text: `> 🤖 *Kurz pausieren:* Limit erreicht (${res.detail || 'cooldown'})${wait}. 💜` }, { quoted: msg });
  } else if (res && res.reason === 'aborted') {
    await sock.sendMessage(from, { text: '> 🤖 Abgebrochen.' }, { quoted: msg });
  } else {
    /* 7.0.2: klassifizierte Fehlermeldung (Code + Endpoint + Hinweis). */
    let errText = `> 🤖 *AI GERADE NICHT ERREICHBAR*\n\nGrund: ${(res && res.detail) || 'unbekannt'}\n\nDer Rest des Bots läuft normal weiter. 💜`;
    try {
      const rep = await import('./ai/report.js');
      const mem = await import('./ai/memory.js');
      errText = rep.buildAiErrorText(res || {}, mem.aiConfig(), pref);
    } catch (e) {}
    await sock.sendMessage(from, { text: errText }, { quoted: msg });
  }
  return true;
}

/* 💜 7.0 GROUP-GUARDS + GROUP-XP: läuft für JEDE Gruppen-Nachricht.
   · Opt-in-Guards (antiflood/antispam/mentionGuard) — Host/Admins ausgenommen
   · Group-XP + Spiel-Command-Zählung + Goal/Achievement-Ankündigungen
   Gibt 'handled' zurück, wenn die Nachricht bestraft/verworfen wurde. */
async function runGroupGuards(sock, msg, from, trimmed, sessionPath, pref) {
  try {
    if (!from || !from.endsWith('@g.us')) return null;
    if (msg.key?.fromMe) return null;
    const gp = await loadGroupProfile(from, null, sock);
    if (!gp) return null;
    ensureGroupExtras(gp);
    let sender = null;
    try { sender = await userMapping.resolveSender(msg, sock, sessionPath); } catch (e) {}
    const bid = sender ? String(cleanId(sender.lid || sender.jid || '')).split('@')[0] : '';
    const gid = cleanId(from);
    const s = getGset(gp);
    const isCmd = trimmed.startsWith(pref);
    const cmdName = isCmd ? trimmed.slice(pref.length).trim().split(/\s+/)[0].toLowerCase() : '';
    /* --- Guards --- */
    let guardHit = null;
    if (bid && (s.antiflood || s.antispam || s.mentionGuard)) {
      if (s.antiflood) { const f = checkFlood(gid, bid); if (f.hit) guardHit = { kind: 'flood', detail: f.count + ' Nachrichten/10s' }; }
      if (!guardHit && s.antispam && !isCmd) { const sp = checkSpam(gid, bid, trimmed); if (sp.hit) guardHit = { kind: 'spam', detail: sp.count + '× gleiche Nachricht' }; }
      if (!guardHit && s.mentionGuard) {
        const men = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
        if (Array.isArray(men) && men.length > 5) guardHit = { kind: 'mention', detail: men.length + ' Mentions' };
      }
    }
    if (guardHit && bid) {
      let role = 'member';
      try {
        const meta = await sock.groupMetadata(from);
        role = getParticipantRole(meta, sender?.jid, sender?.lid);
      } catch (e) {}
      if (role === 'host' || role === 'superadmin' || role === 'admin') {
        guardHit = null;
      } else {
        try { await sock.sendMessage(from, { delete: msg.key }); } catch (e) {}
        if (!gp.warns || typeof gp.warns !== 'object') gp.warns = {};
        const wk = cleanId(sender?.lid || sender?.jid || bid);
        if (!gp.warns[wk]) gp.warns[wk] = [];
        const reason = { flood: 'Anti-Flood', spam: 'Anti-Spam', mention: 'Mention-Spam' }[guardHit.kind] || 'Guard';
        gp.warns[wk].push({ reason: reason + ' (' + guardHit.detail + ')', by: 'LoveBot Guard 🛡', at: new Date().toISOString() });
        const wc = gp.warns[wk].length;
        const esc = escalationFor(gp, wc);
        groupAudit(gp, 'guard', 'warn', `${bid}: ${reason} (${wc})`);
        if (esc === 'kick' || wc >= 3) {
          try { if (typeof sock.groupParticipantsUpdate === 'function') await sock.groupParticipantsUpdate(from, [sender.jid || sender.lid], 'remove'); } catch (e) {}
          await sock.sendMessage(from, { text: `> 🦵 *GEKICKT:* @${bid}\n*Grund:* ${reason} — ${wc}. Verwarnung.` });
          groupAudit(gp, 'guard', 'kick', `${bid}: ${reason}`);
        } else {
          await sock.sendMessage(from, { text: `> ⚠️ *VERWARNUNG (${wc}/3):* @${bid}\n*Grund:* ${reason} — ${guardHit.detail}.` });
        }
        saveGroupProfile(gp);
        return 'handled';
      }
    }
    /* --- Group-XP --- */
    if (s.progressionEnabled !== false) {
      const games = (LOVEBOT_GAME_COMMANDS && LOVEBOT_GAME_COMMANDS.has(cmdName)) ? 1 : 0;
      const res = applyGroupMessage(gp, bid, { games, now: Date.now(), memberCount: 0 });
      saveGroupProfile(gp);
      const lvl = res.events.find((e) => e.type === 'glevelup');
      if (lvl) {
        const ach = res.events.filter((e) => e.type === 'gachievement');
        const bdg = res.events.filter((e) => e.type === 'gbadge');
        const goal = res.events.filter((e) => e.type === 'ggoal');
        let txt = `🎉 *GROUP LEVEL ${lvl.level}!*\n\nDie Gruppe steigt auf! +${100 + lvl.level * 10} Kupfer für die Kasse. 💰`;
        if (goal.length) txt += '\n🎯 Ziel erreicht: ' + goal.map((x) => x.kind).join(', ');
        if (ach.length) txt += '\n🏆 ' + ach.map((a) => a.emoji + ' ' + a.name).join(' · ');
        if (bdg.length) txt += '\n🏅 ' + bdg.map((a) => a.emoji + ' ' + a.name).join(' · ');
        await sock.sendMessage(from, { text: txt });
      } else {
        const solo = res.events.filter((e) => e.type === 'ggoal' || e.type === 'gachievement' || e.type === 'gbadge');
        if (solo.length) {
          await sock.sendMessage(from, { text: '🎯 ' + solo.map((e) => e.type === 'ggoal' ? `Gruppen-Ziel (${e.kind}) erreicht! +${e.reward} Kupfer` : (e.emoji || '🏆') + ' ' + e.name).join('\n') });
        }
      }
      try {
        const { emit } = await import('./loveengine.js');
        for (const e of res.events) {
          if (e.type === 'glevelup') emit('GROUP_LEVELUP', { name: gp.subject || gid, level: e.level });
          else if (e.type === 'ggoal') emit('GROUP_GOAL', { name: gp.subject || gid, kind: e.kind });
          else if (e.type === 'gachievement') emit('GROUP_ACHIEVEMENT', { name: gp.subject || gid, achievement: e.id });
          else if (e.type === 'gbadge') emit('GROUP_BADGE', { name: gp.subject || gid, badge: e.id });
        }
      } catch (e) {}
    }
    return null;
  } catch (e) { return null; }
}

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
function addWalletCoins(profile, { copper = 0, silver = 0, gold = 0, platin = 0 } = {}, { source = 'misc', reason = '' } = {}) {
  if (!profile || !profile.wallet) return null;
  /* 💰 Kupfer läuft seit 6.0 über die Economy-Engine (Log + Zähler + Events);
     Silber/Gold/Platin sind Legacy-Anzeige ohne neue Quellen. */
  if (copper > 0) addCoins(profile, Math.floor(copper), { source, reason });
  else if (copper < 0) removeCoins(profile, Math.floor(-copper), { source, reason });
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
      footerText: options.footerText || LOVEBOT_SIGNATURE_LINE1 + ' · ' + LOVEBOT_SIGNATURE_LINE2.replace('> ', ''),
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

/* ═══════════════════════════════════════════════════════════════════════
   🧠 MULTI-SESSION-MENÜ (im `node .`-Terminal, aufrufbar aus dem Pairing-Menü)
    1 · Alle Sessions starten          (spawnt alle Nicht-main-Sessions)
    2 · Neue Session erstellen         (Name + QR oder Pairing-Code)
    3 · Alle zusätzlichen Sessions löschen (Registry + Ordner, mit Abfrage)
    4 · Sessions auflisten
    0 · zurück
   ═══════════════════════════════════════════════════════════════════════ */
const _msL = '─'.repeat(50);
async function openMultiSessionMenu() {
  const box = (title) => {
    console.log('\n' + c.bold + c.brightMagenta + '  ╭' + _msL + '╮' + c.reset);
    console.log(c.bold + c.brightGreen + '  │ ' + String(title).slice(0, 48).padEnd(48) + '│' + c.reset);
    console.log(c.bold + c.brightMagenta + '  ├' + _msL + '┤' + c.reset);
  };
  const line = (t) => console.log(c.cyan + '  │' + c.reset + ' ' + t);
  const bot  = () => console.log(c.bold + c.brightMagenta + '  ╰' + _msL + '╯' + c.reset + '\n');
  const statusIcon = (st) => ({ CONNECTED: '🟢', DISCONNECTED: '🔴', QR_REQUIRED: '🟡', CONNECTING: '🕸️', STOPPED: '⚫', ERROR: '💥', PAUSED: '⏸️', WAITING_FOR_AUTH: '🟣' }[st] || '⚪');

  const showQr = async (id, tries = 12) => {
    for (let i = 0; i < tries; i++) {
      await new Promise((r2) => setTimeout(r2, 1500));
      const raw = SessionManager.getSessionRaw(id);
      if (raw && raw.qr) {
        console.log(c.brightYellow + '\n📲 QR-Code für Session „' + id + '“ — scanne in WhatsApp > Verknüpfte Geräte:' + c.reset);
        try {
          const qrMod = await import('qrcode-terminal');
          qrMod.default.generate(String(raw.qr), { small: true });
        } catch (qrErr) {
          console.log(c.dim + '   (QR im Web-Dashboard unter Sessions ansehen)' + c.reset);
        }
        return true;
      }
      const st = raw && raw.status;
      if (st === 'CONNECTED') { console.log(c.brightGreen + '✅ Session „' + id + '“ ist bereits verbunden.' + c.reset); return true; }
    }
    console.log(c.yellow + 'ℹ️ Noch kein QR sichtbar — Status & QR siehst du im Web-Dashboard unter „Sessions“.' + c.reset);
    return false;
  };

  const listAll = () => {
    box('☾ MULTI-SESSION · ÜBERSICHT');
    const all = SessionManager.listSessionsRaw();
    if (!all.length) { line(c.dim + ' (leer)' + c.reset); bot(); return; }
    for (const x of all) {
      const phone = x.phone ? String(x.phone).replace(/^(.{4}).*(.{2})$/, '$1••••$2') : '';
      line(statusIcon(x.status) + '  ' + c.brightWhite + String(x.name || x.id).padEnd(20) + c.reset +
           c.dim + String(x.id).padEnd(16) + c.reset +
           c.dim + (x.status || '').padEnd(14) + (phone ? ' · ' + phone : '') + c.reset +
           (x.id === 'main' ? c.dim + '  (Haupt-Session)' + c.reset : ''));
    }
    bot();
  };

  for (;;) {
    const all = SessionManager.listSessionsRaw();
    const connected = all.filter((x) => x.status === 'CONNECTED').length;
    box('☾  M U L T I - S E S S I O N  ☾');
    line('');
    line(c.dim + '   Registry: ' + all.length + ' Sessions · ' + connected + ' verbunden · Spawn: ' + (SessionManager.spawnConfigured() ? 'AN' : 'aus') + c.reset);
    line('');
    line(c.brightCyan  + ' [1] ' + c.reset + c.dim + 'Alle Sessions starten (QR-Modus, wartende Sessions)' + c.reset);
    line(c.brightGreen + ' [2] ' + c.reset + c.dim + 'Neue Session erstellen (Name + QR / Pairing-Code)' + c.reset);
    line(c.brightRed   + ' [3] ' + c.reset + c.dim + 'Alle zusätzlichen Sessions löschen (mit Abfrage)' + c.reset);
    line(c.brightYellow+ ' [4] ' + c.reset + c.dim + 'Sessions auflisten' + c.reset);
    line(c.brightWhite + ' [0] ' + c.reset + c.dim + 'Zurück zum Hauptmenü' + c.reset);
    bot();
    const opt = (await askQuestion(c.pink + 'LoveBot › Multi-Session [' + c.reset + c.bold + '0-4' + c.reset + c.pink + ']: ' + c.reset)).toLowerCase();

    if (opt === '1') {
      SessionManager.setSpawnEnabled(true);
      const targets = all.filter((x) => x.id !== 'main' && x.status !== 'CONNECTED');
      box('▶️  ALLE SESSIONS STARTEN');
      let ok = 0, skip = 0;
      for (const t of targets) {
        const started = SessionManager.spawnSession(t.id, { authMode: 'qr' });
        if (started) { line(c.brightGreen + ' 🚀 ' + t.id + ' gestartet…' + c.reset); ok++; }
        else skip++;
      }
      line(c.dim + '   Fertig: ' + ok + ' gestartet, ' + skip + ' übersprungen (laufen schon / Fehler).' + c.reset);
      bot();
      if (targets.length) {
        console.log(c.brightCyan + '⏳ Warte auf die QR-Codes der neuen Kindprozesse…' + c.reset);
        await Promise.all(targets.filter((t) => t.status !== 'CONNECTED').slice(0, 3).map((t) => showQr(t.id)));
      }
    } else if (opt === '2') {
      box('🆕  NEUE SESSION');
      const nm = (await askQuestion(c.cyan + '   Name der neuen Session: ' + c.reset)).trim();
      if (!nm) { line(c.brightRed + '❌ Kein Name — abgebrochen.' + c.reset); bot(); continue; }
      const mode = (await askQuestion(c.cyan + '   Anmeldung  [1] QR  ·  [2] Pairing-Code: ' + c.reset)).trim();
      let authMode = 'qr', phone = '';
      if (mode === '2') {
        authMode = 'pairing';
        phone = (await askQuestion(c.cyan + '   Telefonnummer mit Ländervorwahl: ' + c.reset)).replace(/\D/g, '');
        if (phone.length < 6) { line(c.brightRed + '❌ Ungültige Nummer — abgebrochen.' + c.reset); bot(); continue; }
      }
      SessionManager.setSpawnEnabled(true);
      const created = SessionManager.createSession(nm, { source: 'terminal', actor: 'terminal' });
      const spawned = SessionManager.spawnSession(created.id, { authMode, phone: phone || undefined });
      line(c.brightGreen + ' ✅ Session „' + created.name + '“ angelegt (ID: ' + created.id + ')' + c.reset);
      line(spawned
        ? (c.dim + ' 🚀 Kindprozess gestartet (' + authMode + ') — warte auf QR/Pairing…' + c.reset)
        : (c.brightYellow + ' ⚠️ Spawn nicht möglich (config?) — Session steht in der Registry.' + c.reset));
      bot();
      if (spawned) await showQr(created.id, authMode === 'pairing' ? 6 : 14);
    } else if (opt === '3') {
      const extra = all.filter((x) => x.id !== 'main');
      if (!extra.length) { box('🗑️  LÖSCHEN'); line(c.dim + '   Keine zusätzlichen Sessions vorhanden.' + c.reset); bot(); continue; }
      box('🗑️  ALLE ZUSÄTZLICHEN SESSIONS LÖSCHEN');
      extra.forEach((x) => line('   ' + statusIcon(x.status) + '  ' + x.name + '  (' + x.id + ')'));
      line(c.brightRed + '   Achtung: löscht Registry-Eintrag UND Sessions/<id>-Ordner (Credentials).' + c.reset);
      bot();
      const conf = (await askQuestion(c.brightRed + 'Zum Löschen tippen: ' + c.reset + c.bold + 'ALLE LÖSCHEN' + c.reset + c.dim + '  — oder Enter zum Abbrechen: ' + c.reset)).trim();
      if (conf !== 'ALLE LÖSCHEN') { console.log(c.yellow + '↩ Abgebrochen.' + c.reset); continue; }
      let n = 0;
      for (const x of extra) {
        try {
          if (x.source === 'spawned') SessionManager.stopSpawned(x.id);
          const dir = path.join('Sessions', x.id);
          try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
          SessionManager.deleteSession(x.id, { actor: 'terminal' });
          n++;
        } catch (e) { console.log(c.brightRed + '❌ ' + x.id + ': ' + (e?.message || e) + c.reset); }
      }
      console.log(c.bold + c.brightGreen + '✅ ' + n + ' Session(s) gelöscht. Haupt-Session bleibt unberührt.' + c.reset);
    } else if (opt === '4') {
      listAll();
    } else if (opt === '0' || opt === '' ) {
      console.log(c.dim + '↩ zurück…' + c.reset);
      return;
    } else {
      console.log(c.brightRed + '❌ Ungültige Eingabe (0–4).' + c.reset);
    }
  }
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
        json = withGlobalSignatureRich(json);
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
        /* Steuer-Nachrichten (Reaktion, Löschen, echte Weiterleitung)
           bekommen KEINEN Kanal-Kontext — alles andere schon.          */
        const isControl = ('react' in content) || ('delete' in content) || ('forward' in content);
        if (!isControl) {
          finalContent = withGlobalSignature(withNewsletterForwarding(content));
        }
      }
      logActivity('send-message', { to: jid, contentType: typeof finalContent, hasText: !!(finalContent && typeof finalContent === 'object' && 'text' in finalContent), options }, {
        messagePreview: finalContent && typeof finalContent === 'object' && finalContent.text ? String(finalContent.text).slice(0, 180) : ''
      });
      return originalSendMessage(jid, finalContent, options);
    };

    /* 📡 JEDE Bot-Nachricht als „über den LoveBot-Kanal weitergeleitet“
       markieren. relayMessage ist die WURZEL aller ausgehenden Nach-
       richten — hier läuft wirklich ALLES durch:
         · sendMessage (Text/Bild/Video/Audio/Sticker/Dokument/…)
         · sendJson (Rich-Responses, Meta-AI-Karten, Ban-Check-Karten)
         · rohe Menüs/Listen/Buttons (generateWAMessage…+relayMessage)
         · MESSAGE_EDIT (Typ 14) — auch Bearbeitungen (z. B. der fertige
           Ping-Report) behalten die Kanal-Markierung.
       conversation-Strings werden dabei automatisch zu extendedText-
       Message umgewandelt, weil nur dort contextInfo sitzen kann.      */
    const originalRelayMessage = sock.relayMessage.bind(sock);
    sock.relayMessage = async (jid, message, options = {}) => {
      try {
        if (message && typeof message === 'object') {
          injectNewsletterIntoWAMessage(message);
        }
      } catch (nlErr) {
        console.log(c.bold + c.brightYellow + '⚠️ Newsletter-Markierung übersprungen: ' + c.reset + (nlErr?.message || nlErr));
      }
      return originalRelayMessage(jid, message, options);
    };

    sock.ev.on('creds.update', saveCreds);

    if (mode === 'pairing' && phoneNumber && !sock.authState.creds.registered) {
      setTimeout(async () => {
        try {
          const code = await phonePair(sock, phoneNumber);
          if (code) { try { SessionManager.setPairCode(SESSION_ID, String(code)); } catch (smErr2) {} }
        } catch (pairErr) {}
      }, 3000);
    }

    sock.ev.on('connection.update', async (update) => {
      try {
        const { connection, lastDisconnect, qr } = update;

        if (qr && mode === 'qr') {
          qrPair(qr);
        }

        /* 📡 SessionManager: QR benötigt — QR-Wert speichern, damit das
           Web-Dashboard ihn anzeigen kann (z. B. beim Anlegen einer Session) */
        if (qr) {
          try { SessionManager.setStatus(SESSION_ID, 'QR_REQUIRED'); } catch (smErr) {}
          try { SessionManager.setQr(SESSION_ID, String(qr)); } catch (smErr2) {}
        }

        if (connection === 'open') {
          consecutiveFatalErrorCount = 0;
          lastFatalErrorCode = null;

          /* 🌐 Dashboard: Mailbox + Heartbeat starten */
          startDashboardTimers(sock);
          try { startNightConsole(); } catch (consoleErr) {}
          /* 🤖 LoveAI Startup-Check (7.0.2): fire-and-forget, blockiert nie. */
          try {
            import('./ai/engine.js').then((eng) => eng.aiHealth(true).then((h) => {
              console.log(h && h.ok ? '🤖 LoveAI: Backend erreichbar 🟢' : '🤖 LoveAI: Backend nicht erreichbar 🟡 — Bot läuft normal');
            }).catch(() => {})).catch(() => {});
          } catch (e) {}

          const hostRawId = sock.user?.id || sock.authState?.creds?.me?.id || '';
          const hostRawLid = sock.user?.lid || sock.authState?.creds?.me?.lid || '';
          const jid = normalizeJid(hostRawId);
          const lid = hostRawLid ? normalizeLid(hostRawLid) : normalizeLid(hostRawId);
          const sid = parseSessionId(hostRawId) || parseSessionId(hostRawLid) || '1';

          /* Verbunden → QR/Pairing-Code sind verbraucht */
          try { SessionManager.setQr(SESSION_ID, null); } catch (smErrQ) {}
          try { SessionManager.setPairCode(SESSION_ID, null); } catch (smErrP) {}

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

          /* 📡 KANAL-SPIEGEL: Standard-Konfig anlegen + Status zeigen */
          try {
            seedChannelRelay();
            console.log(c.cyan + channelRelayStatusText() + c.reset);
            console.log(c.cyan + '🏷️ Kanal-Markierung AKTIV — wirklich JEDE Bot-Nachricht erscheint als „über LoveBot-Kanal“ (relayMessage-Wrapper).' + c.reset);
          } catch (relaySeedErr) {}

          /* 🔴 Live-Abo für den Kanal: follow + subscribeNewsletterUpdates,
             damit neue Kanal-Posts (Bild/Audio/Sticker/Text/Video) wirklich
             beim Bot ankommen (Abo läuft ab → wird erneuert). */
          try { ensureNewsletterLive(sock); } catch (nlLiveErr) {}

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
              startBot,
              openMulti: openMultiSessionMenu
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

          /* 🤖 Der BOT selbst (diese Session) wurde in die Gruppe geholt →
             Vorstellung posten („Hallo, ich bin LoveBot … Session <Name> …“)
             und KEINE Willkommens-Nachricht an sich selbst schicken. */
          if (actionType === 'add' && isOwnSessionTarget(sock, normalizedTargetId)) {
            try { await announceBotJoinedGroup(sock, groupJid); } catch (selfAddErr) {}
            pIndex++;
            continue;
          }

          /* 💜 7.0: Gruppen-Banliste durchsetzen (Rejoin → erneut entfernen) */
          if (actionType === 'add' && normalizedTargetId) {
            try {
              const gpJoin = await loadGroupProfile(groupJid, null, sock);
              const bidJoin = String(cleanId(normalizedTargetId)).split('@')[0];
              if (gpJoin && isGbanned(gpJoin, bidJoin)) {
                if (typeof sock.groupParticipantsUpdate === 'function') {
                  await sock.groupParticipantsUpdate(groupJid, [normalizedTargetId], 'remove');
                }
                ensureGroupExtras(gpJoin);
                groupAudit(gpJoin, 'system', 'gban-enforce', `${bidJoin} (Rejoin geblockt)`);
                saveGroupProfile(gpJoin);
                pIndex++;
                continue;
              }
            } catch (e) {}
          }

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

          /* 📡 KANAL-SPIEGEL: Gruppen, in denen der OWNER mit dem Bot
             schreibt, automatisch als Spiegel-Ziel merken (billig —
             Key-Check zuerst, DB nur bei Treffer). */
          try { rememberOwnerGroup(msg); } catch (relayRememberErr) {}

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

          /* 📡 KANAL-SPIEGEL: Neue Veröffentlichungen aus dem WhatsApp-
             Kanal (@newsletter) automatisch an alle aktiven Ziel-Chats
             weiterleiten (Bild · Audio · Sticker · Text · Video · …).
             Kanal-Nachrichten laufen NICHT durch die Befehlsverarbeitung. */
          if (String(from).toLowerCase().endsWith('@newsletter')) {
            try {
              await handleChannelRelay(sock, msg, { from });
            } catch (relayErr) {
              console.log(c.bold + c.brightYellow + '[relay] Fehler: ' + c.reset + (relayErr?.message || relayErr));
            }
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

          /* 💜 7.0 GROUP: Guards (Opt-in) + Group-XP für jede Nachricht */
          const guardsResult = await runGroupGuards(sock, msg, from, trimmed, sessionPath, pref);
          if (guardsResult === 'handled') {
            continue;
          }

          if (!trimmed.startsWith(pref)) {
            /* 🤖 7.0 AI-CHATMODUS (Privatchat, Opt-in — Gruppen nie automatisch).
               HINWEIS: kein `isGroup` hier — das wird erst weiter unten deklariert (TDZ). */
            if (!from.endsWith('@g.us') && !msg.key?.fromMe && trimmed.length > 0) {
              try {
                const aiM = await import('./ai/memory.js');
                const aiSender = await userMapping.resolveSender(msg, sock, sessionPath);
                const aiBid = aiSender ? String(cleanId(aiSender.lid || aiSender.jid || '')).split('@')[0] : '';
                if (aiBid && aiM.getAiPrefs(aiBid).chatMode === true) {
                  const aiProf = await loadUserProfileForSender(aiSender, msg.key.participantUsername || msg.key.remoteJidUsername || '');
                  if (xpEligible(aiProf)) {
                    const aiRank = cachedGlobalRank(readDb().users || {}, aiProf?.identity?.bid || aiBid);
                    await runAiQuestion(sock, from, msg, { text: trimmed, bid: aiProf?.identity?.bid || aiBid, userProfile: aiProf, rank: aiRank, pref });
                  }
                }
              } catch (e) {}
            }
            /* 💜 LEVEL SYSTEM: XP für jede Nachricht — nette/Liebesnachrichten
               bringen das 2–3-Fache. Nur registrierte Nutzer mit DSGVO-Zustimmung,
               Anti-Spam-Fenster (300 XP/Std.) ist in applyMessageXp drin. */
            try {
              if (!msg.key?.fromMe) {
                const xpSender = await userMapping.resolveSender(msg, sock, sessionPath);
                const xpProfile = await loadUserProfileForSender(xpSender, msg.key.participantUsername || msg.key.remoteJidUsername || '');
                if (xpEligible(xpProfile)) {
                  /* 🔒 Lock: gleichzeitige Nachrichten desselben Users
                     überschreiben sich nicht mehr gegenseitig. */
                  let xpRes = null;
                  let xpFreshAch = [];
                  await withProfileLock(xpProfile?.identity?.bid || '', async () => {
                    /* 👑 Owner-Bonus (6.0): eigene Nachrichten (fromMe) sind Owner-Nachrichten */
                    xpRes = applyMessageXp(xpProfile, { text: trimmed, isGroup: from.endsWith('@g.us'), isOwner: !!msg.key?.fromMe });
                    if (xpRes && xpRes.granted > 0) {
                      xpFreshAch = awardProgressionAchievements(xpProfile);
                      saveUserProfile(xpProfile);
                    }
                  });
                  if (xpRes && xpRes.granted > 0) {
                    const xpName = getProfileDisplayName(xpProfile, msg.pushName || cleanId(xpSender?.jid || xpSender?.lid || msg.key?.participant || from) || 'Jemand');
                    await sendLevelUpAnnouncement(sock, from, msg, {
                      profile: xpProfile, name: xpName, events: [...(xpRes.events || []), ...((xpFreshAch && xpFreshAch.xpEvents) || [])],
                      copper: xpRes.copper || 0, extraUnlocks: [...(xpFreshAch.achievements || xpFreshAch || []), ...(xpFreshAch.badges || [])],
                      isGroup: from.endsWith('@g.us'),
                      mentionJid: msg.key?.participant || xpSender?.lid || xpSender?.jid || null
                    });
                  }
                }
              }
            } catch (xpErr) { /* Level-System darf Nachrichten niemals blockieren */ }

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
              /* 💜 7.0: Live-Zähler cachen (nur bei Änderung → Website nutzt sie) */
              if (groupProfile && Array.isArray(groupMetadata.participants)) {
                const mc = groupMetadata.participants.length;
                const ac = groupMetadata.participants.filter((x) => x && ['admin', 'superadmin'].includes(x.admin)).length;
                if (groupProfile.memberCount !== mc || groupProfile.adminCount !== ac) {
                  groupProfile.memberCount = mc;
                  groupProfile.adminCount = ac;
                  groupProfile.metaAt = Date.now();
                  try { saveGroupProfile(groupProfile); } catch (e) {}
                }
              }
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

          /* 🛠️ GLOBALER WARTUNGSMODUS ($offline / $online) — zentrale Sperre
             VOR jedem Command-Dispatch (nicht nur pro Befehl geprüft).
             Solange Wartung aktiv ist, darf NUR der Owner (Haupt- + Zusatz-
             Owner) überhaupt Befehle nutzen — alle anderen sehen groß den
             Grund, den der Owner beim Aktivieren angegeben hat. $online
             bleibt für den Owner immer erreichbar, damit er die Wartung
             selbst wieder beenden kann. */
          const maintCommandIsHost = isHost || (registeredOwnerEntry != null);
          if (!maintCommandIsHost && command !== 'online' && command !== 'offline') {
            const maint = getMaintenance();
            if (maint.on) {
              const sinceTxt = maint.since ? new Date(maint.since).toLocaleString('de-DE') : '—';
              await sock.sendMessage(from, {
                text: `> 🛠️ *WARTUNGSMODUS AKTIV* 🛠️\n\n` +
                  `Der Bot ist aktuell für alle außer den Owner gesperrt.\n\n` +
                  `📄 *Grund:* ${maint.reason || 'Kein Grund angegeben'}\n` +
                  `🕒 *Seit:* ${sinceTxt}\n` +
                  `👑 *Von:* ${maint.by || 'Owner'}\n\n` +
                  `_Bitte habe etwas Geduld — der Bot ist bald wieder für alle da._ 💜`
              }, { quoted: msg });
              await sendReaction(sock, from, reactions.access.reactions.unauthorized, msg.key);
              logLove('maintenance', `${command} blockiert für ${senderJid} — Wartungsmodus aktiv (Grund: ${maint.reason}).`, c.brightYellow);
              try {
                botSecurityEvent('BOT_MAINTENANCE_BLOCKED_CMD', {
                  risk: 10, action: 'logged', command,
                  jidMasked: String(senderJid || from || '').replace(/(\d{4})\d+(\d{4})/, '$1•••$2'),
                  reason: maint.reason
                });
              } catch (e) {}
              continue;
            }
          }

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

          /* 💜 LEVEL SYSTEM: XP für Befehlsnutzung (+ Liebes-Aktionen zählen ×2.5).
             Anti-Spam-Fenster: max. 150 XP/Std. aus Befehlen. */
          if (userProfile && xpEligible(userProfile)) {
            try {
              /* 🔒 Lock: parallele Befehle desselben Users bleiben konsistent. */
              let cmdXp = null;
              let cmdFreshAch = [];
              await withProfileLock(userProfile?.identity?.bid || '', async () => {
                cmdXp = applyCommandXp(userProfile, { loveAction: isLoveAction(command), isOwner: !!isHost });
                if (cmdXp && cmdXp.granted > 0) {
                  cmdFreshAch = awardProgressionAchievements(userProfile);
                  saveUserProfile(userProfile);
                }
              });
              if (cmdXp && cmdXp.granted > 0) {
                await sendLevelUpAnnouncement(sock, from, msg, {
                  profile: userProfile, name: getProfileDisplayName(userProfile, msg.pushName || cleanId(senderJid)),
                  events: [...(cmdXp.events || []), ...((cmdFreshAch && cmdFreshAch.xpEvents) || [])], copper: cmdXp.copper || 0, extraUnlocks: [...(cmdFreshAch.achievements || cmdFreshAch || []), ...(cmdFreshAch.badges || [])], isGroup,
                  mentionJid: msg.key?.participant || senderLid || senderJid || null
                });
              }
            } catch (cmdXpErr) { /* XP darf den Befehl nie blockieren */ }
          }

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
              try {
                botSecurityEvent('BOT_FLOOD_BLOCK', {
                  risk: Math.min(90, 20 + (rl.strikes || 1) * 15),
                  action: 'logged',
                  jidMasked: String(senderJid || from || '').replace(/(\d{4})\d+(\d{4})/, '$1•••$2'),
                  strikes: rl.strikes, group: from !== senderJid ? from : null
                });
              } catch (e) {}
              continue;
            }
          }

          /* 🚫 BLOCKCASE: Vom Owner gesperrte Befehle (global, alle Chats).
             Der Owner selbst (Haupt- + Zusatz-Owner) ist nie betroffen,
             damit er einen Befehl jederzeit wieder öffnen/testen kann. */
          if (!['blockcase', 'opencase', 'listbc'].includes(command)) {
            const blockedEntry = getBlockedCommandEntry(readDb(), command);
            if (blockedEntry && !isStrictOwner(readDb(), senderJid, senderLid)) {
              await sock.sendMessage(from, {
                text: `> 🚫 *BEFEHL GESPERRT*\n\n` +
                  `Dieser Befehl (*${pref}${blockedEntry.key}*) wurde vom Owner gesperrt:\n` +
                  `📄 *Grund:* ${blockedEntry.reason}\n\n` +
                  `Entschuldige dies bitte, sorry für die Unannehmlichkeiten! 💜\n` +
                  `_Der Owner kann ihn jederzeit mit ${pref}opencase wieder freigeben._`
              }, { quoted: msg });
              await sendReaction(sock, from, reactions.access.reactions.unauthorized, msg.key);
              logLove('blockcase', `${command} blockiert für ${senderJid} — Grund: ${blockedEntry.reason}`, c.brightYellow);
              try {
                botSecurityEvent('BOT_BLOCKED_COMMAND_ATTEMPT', {
                  risk: 15, action: 'logged', command,
                  jidMasked: String(senderJid || from || '').replace(/(\d{4})\d+(\d{4})/, '$1•••$2'),
                  reason: blockedEntry.reason
                });
              } catch (e) {}
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
              const regPersonalInfo = (reg.registered && !isGroup) ? {
                age: ageLabel(reg, { reveal: true }),
                status: reg.status || '—',
                city: cityLabel(reg, { privateChat: true })
              } : null;
              const regDate = userProfile?.registration?.registeredAt ? formatDateTimeShort(userProfile.registration.registeredAt) : 'Unbekannt';

              /* 💍 Liebe-/Marry-Status (rosa Rosen-Look) */
              const meMode = String(args[0] || '').toLowerCase();
              const meSnapshot = getLoveSnapshot(userProfile, identityKey(senderJid, senderLid));

              let responseText = '';
              if (isHost) {
                /* 👑✨ Owner-Profil: die große schöne Karte — nur der Boss sieht sie */
                let hostStats = null;
                try {
                  hostStats = systemStats(readDb(), process.uptime() * 1000);
                } catch (stErr) { hostStats = null; }
                responseText = buildOwnerProfileCard({
                  userProfile, snapshot: meSnapshot, roleText: groupRoleText,
                  name: regName, username: displayUsername, regDate, pref,
                  regAge, regStatus, regCity,
                  jid: safeSenderJid, lid: safeSenderLid, sid: senderSid,
                  bid: userProfile?.identity?.bid || 'N/A',
                  dsgvo: dsgvoText, verify: verifyText,
                  stats: hostStats
                });
              } else {
                /* 🪪 Kompakt-Profil (öffentlich — KEIN Alter, KEINE JID/LID/BID) */
                const coreMe = getCore(userProfile?.identity?.bid || '', meSnapshot?.love?.couple?.key || coupleKeyForProfile(userProfile));
                const loveMsgsMe = (coreMe.couple?.loveMessages || coreMe.user?.loveMessages || 0);
                responseText = buildCompactProfileCard({
                  userProfile, snapshot: meSnapshot, roleText: groupRoleText,
                  name: regName, username: displayUsername, regDate, pref,
                  personalInfo: regPersonalInfo,
                  loveMsgs: loveMsgsMe,
                  memberDays: (reg.registeredAt ? Math.max(0, Math.floor((Date.now() - new Date(reg.registeredAt).getTime()) / 86400000)) : null)
                });
              }

              /* 📋 $me info → wirklich alles, in Bereichen */
              if (meMode === 'info' || meMode === 'alle' || meMode === 'detail' || meMode === 'full' || meMode === 'voll') {
                responseText = buildDetailProfileCard({
                  userProfile, snapshot: meSnapshot, isHost,
                  roleText: groupRoleText, name: regName, username: displayUsername, regDate, pref,
                  jid: safeSenderJid, lid: safeSenderLid, sid: senderSid,
                  privateView: !isGroup   /* 🔒 Stadt/Alter nur im Privatchat unmaskiert */
                });
              }

              /* 💜 Progression 3.0: Fortschritt gehört zu jedem $me dazu */
              responseText += meProgressionSection(userProfile, pref);
              /* 💰 Economy gehört zum ausführlichen $me (6.0) */
              const meFullModes = ['info', 'alle', 'detail', 'full', 'voll'];
              if (meFullModes.includes(meMode)) {
                try { responseText += '\n\n' + buildEconomySection(userProfile || {}, { achCount: plusAchCount(userProfile?.identity?.bid) }); } catch (e) {}
              }
              /* 💜 7.0: $me economy/progression/activity + Voll-Extras */
              const meBid7 = userProfile?.identity?.bid || '';
              if (meMode === 'economy' || meMode === 'kupfer' || meMode === 'geld') {
                try { responseText = buildEconomySection(userProfile || {}, { achCount: plusAchCount(meBid7) }) + '\n\n' + buildPeriodsLine(userProfile || {}); } catch (e) {}
              } else if (meMode === 'progression' || meMode === 'progress' || meMode === 'xp') {
                try { responseText = meProgressionSection(userProfile, pref) + '\n\n' + buildXpMultiplier(userProfile || {}, { isOwner: !!isHost }); } catch (e) {}
              } else if (meMode === 'activity' || meMode === 'aktivitaet' || meMode === 'aktivität') {
                try { responseText = buildMeActivity(userProfile || {}, { groupActivity: meGroupActivity(readDb(), meBid7), aiUsage: await meAiUsage(meBid7) }); } catch (e) {}
              } else if (meFullModes.includes(meMode)) {
                try { responseText += '\n\n' + buildMeActivity(userProfile || {}, { groupActivity: meGroupActivity(readDb(), meBid7), aiUsage: await meAiUsage(meBid7) }); } catch (e) {}
                try {
                  const meLove7 = meSnapshot?.love || {};
                  const meSince7 = meLove7?.couple?.since || meLove7?.since || '';
                  const meSocial7 = meLove7?.married ? `💍 Verheiratet${meSince7 ? ' seit ' + formatDateTimeShort(meSince7) : ''}` : '💜 Single';
                  const meLoveMsgs7 = (typeof loveMsgsMe !== 'undefined' ? loveMsgsMe : 0) || 0;
                  responseText += `\n\n💜 *SOCIAL*\n• ${meSocial7}\n• 💌 ${meLoveMsgs7} Love-Nachrichten`;
                } catch (e) {}
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
                  footerText: '💜 LoveBot by Maxichen 2026 · maxichen.gamebot.me',
                  sections: [{
                    title: 'Ansichten',
                    rows: [
                      { rowId: 'cmd:me info', title: '📋 Alles im Detail', description: 'Vollständiges Profil mit allen Bereichen' },
                      { rowId: 'cmd:relationship', title: '❤️ Liebe & Beziehung', description: 'Partner, Love-XP, Jahrestag' },
                      { rowId: 'cmd:balance', title: '💎 Economy & Konto', description: 'Kupfer, Silber, Gold, Platin' },
                      { rowId: 'cmd:economy', title: '🪙 Economy-Überblick', description: 'Wallet, Bank, Verdienst' },
                      { rowId: 'cmd:report', title: '📊 Mein Report', description: 'Tag, Woche, Monat, Jahr' },
                      { rowId: 'cmd:achievements', title: '🏆 Achievements', description: 'Alle freigeschalteten Erfolge' },
                      { rowId: 'cmd:progress', title: '📈 Fortschritt', description: 'Level, Ziele & nächste Schritte' },
                      { rowId: 'cmd:rewards', title: '🎁 Rewards', description: 'Erhaltene & kommende Belohnungen' },
                      { rowId: 'cmd:records', title: '🏆 Rekorde', description: 'Deine persönlichen Bestwerte' },
                      { rowId: 'cmd:pet', title: '🐶 Haustier', description: 'Wie es deinem Liebling geht' },
                      { rowId: 'cmd:stats me', title: '📊 Statistiken', description: 'Nachrichten, Spiele, Social' },
                      { rowId: 'cmd:badges', title: '🏅 Badges', description: 'Deine Badge-Vitrine mit Stufen' },
                      { rowId: 'cmd:streak', title: '🔥 Streak', description: 'Serie, Rekord & nächstes Ziel' },
                      { rowId: 'cmd:rank', title: '🏅 Mein Rang', description: 'Platz, Trend & Modi' },
                      { rowId: 'cmd:weekly', title: '🗓️ Wochen-Report', description: 'Deine letzten 7 Tage' }
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
            case 'm7': {
              /* m7 = Newsletter-Admin-Einladung für den LoveBot-Kanal  */
              /* „✨ 𓆩♡𓆪 Zitate ~ By Maxichen 𓆩♡𓆪“ direkt in den Chat  */
              /* senden, in dem der Befehl ausgeführt wurde. Nur Host.  */
              /* Jetzt mit Live-Kanal-Infos (Abonnenten, Status, Alter) */
              /* aus sock.newsletterMetadata() + hübscher Vorschau.     */
              if (!isHost) {
                await sock.sendMessage(from, {
                  text: '> ❌ *Zugriff verweigert!*\nDer Befehl *m7* ist ausschließlich dem Host (Bot-Besitzer) vorbehalten.'
                }, {
                  quoted: msg
                });
                await sendReaction(sock, from, reactions.access.reactions.unauthorized, msg.key);
                console.log(c.bold + c.brightYellow + '[m7] Nicht-Host hat m7 aufgerufen.' + c.reset);
                break;
              }

              const m7ChannelJid = '120363410467332304@newsletter';
              const m7ChannelName = '✨ 𓆩♡𓆪 Zitate ~ By Maxichen 𓆩♡𓆪';
              const m7ChannelThumb = '/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCABgAGADASIAAhEBAxEB/8QAHAAAAgMBAQEBAAAAAAAAAAAABQYDBAcCAQAI/8QANhAAAgIBAwIFAgQFAwUBAAAAAQIDBBEABSESMQYTIkFRFGEycYGhB0JikbEVI9ElUnKC8MH/xAAaAQADAQEBAQAAAAAAAAAAAAACAwQFAQYA/8QAKREAAgEDAwQBAwUAAAAAAAAAAQIAAwQREiExBSJBURNhsfAyM0Jxof/aAAwDAQACEQMRAD8A/KuvteqCWAHvp08IeDJd3kfzpEgjEbOJXYYXGOSPjnk6JVLcSi2taly2mmIpUaVi9Yjr1IXmmkIVURckk+wGtD2jwBBFGIN9lIvsQ616jeZKB26W/lXJI5ySPjnRzarG37Jt09TYa/mOF6Z7bnpmkJOPRg8L9h3986v7M1wXop4YoIIY45G/EBjODgsQST6c89vtp9OkvLT0tl0anTw1bcnx4E7p7HU2rcasdbbtroV5c9M+4ZnbIXIDA+jqPOML8++qR8VLXdIH+tQrdJszVgEURZ4RFGFHzzjUu5eINmt9K3rRuW45C0awrgcnP4m7ngDGB7fnqnt8G2+Jo5durbpc2ueVs+XO4eBjnOGIAK8/n8/fQ/IurbiWuyoMUMbesQhuXjRlrxGnLI9hkKyGVPQFwMdK/PfJPfVKnJT8SO7bhs22SiFMyNGv08hGTyCmBn7kY+dD7dTc/DW7mHe1mksV2VwJB1DpGApHOCD6RwdebzaTqF6ePyFsKCkSIylx8jjB+Tzq9QjIMyFrh2Yu/HqUd58F7ZZrQ2NntmrNNGZVrXSFDKGI9Eg4PY9wvb30hbrtlva7b1r0DwzIcFXGNah4u3KrPtVFKtUxN9EAzoDhyS2Cfv8A8aobZudW/tEW1+IoJJq+CsVkDMtf1fyk9x/SePjGpnoBj27SG5taNRiBsffiZnjGvNPPijwRJtUKyV5VsJ0GQyDADJ1AK6g8kcgH3ByD20jupViD3GpGUqcGZNxa1Lc4cS3s9KxuO416lOJpbEzhERRkkk8a2Pd9uv19or7Zt8lq5FXUJYmi9fU/SCVHOQgBAA9zz9gqeAKbbZsF3flUG25NeqD/ACrgeZIPuAyj/wB/tpr2tyLjQSxuVuJGYmEzRoCF9XK8knGMYyc/lqq3QY3npejWmilqPLfaK1na7NVYp3+pQ9aoYpI/LbBz25z3BGiu4SFKtWos5ryzJ5kpOCcFunH7Z/Qau73KkNoGGEV2pyxrmJi2TlySxYZzzjn40s+NbIreI281VZWhj/EoJHAOefv/AJ12phMgSu5xaox97QbbpzWYGlipvHBjrEoBClQQp5/PXFKOfb5IrDFyEccA+o89hqa9NSapDFtxmEjnLozEgLgZxkDjqB4+2tH2elHFs1Od9vgniEa+psnqJGT7j3OM6lwTxM62tRVcsDuPIk1HxDD4y2Gxt9uMtepIZ6pbuUXlo2Pcj+bAx2OMdtZ/dsjc6gWy5WamCPLMbNzkjAIHAA6e/wAd9NVOzHT3qhuUO3pXX62StYWIv6kJXAIb3ILduDjQ7xFX2vbt6tQ25G8xlV1RFI6jnBB9uAM+3fVNs+kaTG3NNnXVqwDz4z5l7dtsmjr7AadMv1U+twgwSVQtwQT7Hv8A8ak8JbNX3GnJf3JhKZI26a4618nDBD2zn8Wc4zxxk5GqniLfBu1aFY7Fq2ascqxcdJRMY7e3xj7jRrbYZd42mhuMG00TUgTBgMbLI6qpUYdeWIwScY5+e+nDnErpIrPtvAsF1Bct+HJLjRFnkiFiMlUhbGO+SSrAAHn++BrLN6oWds3OxUuxmKxE5R1PsRrT7SpvF25S2mhUpzwxOspQMQ5VlBIJHA4/zz2Ghv8AEfbGt7DR3lyTeh6ad70dOWC5Rv1GR/6Z99TVgDM/qVBq1IuN9P29Qyu2tVs7Ft90zDao6aFlUA5kYMzcfmSMn40zSbRYghjuRzR2NoiXolKEdaZY9JbKgqcY5H5Z0IutGL015VtL5nmdDTKTGP8AcI4I4A7ab/BMaFLS27Vbplj6OhCCXU9w3J+f/wA99cY6TsZt06fxDCRA3SNpt0jmqxSPReYMZC5IIHbp6sf1DjSf4unmTxDNIhZGXCKQOQFAx+wH9tatvNWfZ9qU/XU7NVSioB1ZU9XSGKkDn1dsazKntx8SeIZyZGFcZJbGSck/v3/sdAzbZMh6jTLoKa/qYylt01R6DGQFJYQD1AD1gsOP861enZVqoXzHalJhyq9lGO+O5Hb78DWceJ9ik2BSkMz/AE1j0nn4wcEfvpu2aYLtECGUD/bA6ZMFf/vuNKBxuDAsWemWouMES1ulQLtxQyEQCxDIrk9Qx1dPVk+3q1V8ebHJudyGxBWKJLMqzFDl1HAKtz2HSCD8MP0ORxQS7DZo9Ma+cjH1HqVX4IwcZHI/f7a+tX9zTwtLVuqLVum/R0MAWRRkfix+RDDPHV7DgqbEbmW1aK1Vww2ilZ2ex4XvGL6MqBXZnD57dLEDI/8AH99R7Vul2ZVmqQSo8UhVI45ECL1Ek8MPYjI7gaJXtyujZnvurpWfp8yMSO5PbAJPuP2wcaWLzyblBParU7M1jzARKoZvKU/hBPz3GqxUx4irgfEQKZwMZxj7Q1tt2Khtc8kdUgSuIT52AC4Oeoso9u36e3fXSXLu+VN82m+G65Khkj6iT0sgMvq/qOCvb+bGge41N1gSkj3lnEyByQ5YRdXAD57aJ+Fpbp8YVa1+VMmaOORkVVDISMrgAc8j8sc6A9zZIivkb9t8gcePMaL2wefYtwruUlevG7job1Dq6uo57D9NSeEaC078Mu54nRHDYjzk4+/Hx99VNx3arYrbXYhgdnv10kLp36sBGz9utW+e41doWK0vmSPc8xJIwnkFh0gfOAMg99BUGTtK3qpkMko/xdtJDIaMEEv08gFhJnGMqcHj5Hcd++h/gmukG3xN5mS3rJHGD8am8ebhHPt/h+pUr9McMrJDOHHqGVPSffA7gn/uP311tDmORpGlDKAyEMx6cgHBBA750thkYMUuXrFm5AxKfitJNwqWgzDqhTrz8c54/tqbw5X/ANQ8PZfpSSCMZ9POMcN+XA5++oN4eCQeTJOlWOdgk8hy3QDx1cf4/XTZtvh56tC9t00MEl2VkSnZQ5jmCDJ6WBwARjv7sM64tIkQVUCsW+m8B1rLRVl5LqBn8/t+ffTAl62u3U7iI9qOVmhsZUMVjIXoGfYgk4+7AHvpf3/b6m024dvrEuGgSSSUt6WZx1ZXjgYI40wxbdYoeELdwiJorMR8hSx6uoKxDAEYxlGHzxxotJBxLEbAwZ7uGxbjDBJduCOtVkZmj642JdiCMBB6R+uAOcaxgSzwzySUbLQEk5VZCpA+PbOth8P+PfEFijANvFdoAhiFWfJ62BJKqRzxkAZPbGfnVG7tu0blHXm3LZTBatdQIrggKc4HbHUTn2z99dBMkr06l0oIOMccxDp+JN0gnhr3p42gdh1NZgWX3/F6hk+//wAdMf8AD3bKMm9pYssbCpdUQFfQOCCWx3x249sat2P4bwRXG+muxrGg9YedcIfjHcn9QP8AGp6u3v4dqXLViNBTp1pXSRWDdchXpUjp4/Ey99MQ5O8G3o1AS1xuB9YA/hturXvCl7aUJF6oGmhIA6mhbiRAe/wcfHVonT2+tZCMGAUfjjLH27Y/41lPhjc7Wz71Wu0pAk0ThhkZB+xHuD8a12/E9SxX3Sgn/T5yFliVsmrLjPQ2Pb4PuCPg6FO4TP6fcmpRGf47QhsNGrJ4u2WgdvW0j9UoafJRV6lyR7EhUfn2zn40/bWai7eEjp1Y9ssWHkrwtCH8utBnrl5zl27c/wBuNZbJvlvZ2NykvUWhkqhguRErKc9J+eliPtonsVqzXpV9y3HdZ4UEb160VcAO6/zAZ4Vcnlj75wDzhgwNpqKQ5OIc3rwfRuV9zll2mxl6gvM8YYdDyOPLhiUYGAGBbOf01euVOun4fpV69uKS3XHUkwRxTSM4dpG6csehVyvGMD3wNKreI6zyny9rsSso/FLuUxcjqzwVIA5Ge2pKc1e7Rms7PvG87PNHJ5skDyvYiBbhmUjB6z7A9z76MEeJ9pIOV5/P7jDW20XGqXJtjlvT7xLIIVYvHHBCvojJyeCfSeT2xjTVZp7TvFMF6sjUqAlSsiAusyxqIzlR3JPOBgkKe3fWR3N2fZLQgXbLl+ORhM1u9flIdj79MZUBgeCMkg8Z41224be05p7n4faBFIY/TXpQASMnhi3PP66EkCcDF/eR+e48SPse317G27ZDt23yyVAekKJeZJT6evkFkT79z3wBih9Ru9La4amUimRVZvNYElgwKKF7FwAM9/jA50uUt7qbfJ/0naYqxJ6RLNM0soB4yobAB57gZGrlS15wmaOijzBsFp1MpB78Bs8n5/xoc52EvtKWvtEq72Y696aHrQ+WC5Kngg92xnOM6Wf4j7j/AKZ4Wg2xXYWdxYTzJ/2xLnoH6kk/kF0yQL5Ednc9zIipVfSyAlSx7LGCTyT+wyfbWNeK92sb3vM960yl5TkKowEHYKB8AYGhbsWY/Waxt0ZM7naCY3KOGHcad9j8dz0UjhsRrPVKeXNDIoKyrnIU4xj7HuPnSLr3SVYrxPLULqpbnKGbLHDV3Ha3tbDNJYpgeY9Ut/uVj/Uv8w/qx8du2oa+53HrJtzs/wDpwcM0GAhxnJAODjJ/5xrLNr3O5tduOzt9iSCeM9SujYIOtA2T+I8UkkR3un5dqNxIl6kAjhvlk/C37aaHB52m7b9TpVcB+0/5D1Cd6Nmu9SvHJMpYFS5ywbjpOcdvtotUvpttiSKvBHWEjpMRI46R0nOPkEkY7/Ix76i2mxsm7JPFHu1SzJYJkMsxEMyHggev05JBHDY9XcY5jfw99SVmsSFrXAkbyvNDDOOGQnqAAB9vj76YCRxNlG1L27zoeKRYtLLbihLV06UCqXBYBVL8kYJCDsPn50OW01mezLuE6uG9QyCrP7YHBAwPn40UreF4GDhxYjmznrMRKqv8wKsVHPBznAxjVLdBse2pBHfu06tiPraSSOb6h5snj0x5CnHsW7++uPkjeCWdB3nAlEPHTnRohhmA6XGM/mD20WtuaUrbpvFpqdIojKwOZJjgcRj3/PsPnSpe8cbPt0ITY9u+qsjI+puqCPsVjHH9yR9tIe87xe3i41ncLDzSnAyx7AcAD4A+NBqCcbmQ1espa5+I5b6cTRvE/jmG9TTygQGhaJYSciAZA5BHqcgElv6gBjGssnfzJWb5OuSxI5OudLdy/M89eX1S7I1+J//Z';

              /* 1) Live-Kanal-Infos abrufen (Abonnenten, Verifizierung, */
              /*    Erstellungsdatum). Scheitert das (z. B. Rate-Limit  */
              /*    oder API-Änderung), läuft m7 trotzdem weiter — nur  */
              /*    ohne die Zusatz-Infos in der Vorschau.              */
              let m7Meta = null;
              try {
                if (typeof sock.newsletterMetadata === 'function') {
                  m7Meta = await sock.newsletterMetadata('jid', m7ChannelJid);
                }
              } catch (m7MetaErr) {
                console.log(c.bold + c.brightYellow + '[m7] Kanal-Metadaten konnten nicht geladen werden: ' + c.reset + (m7MetaErr?.message || m7MetaErr));
              }

              const m7Subs = m7Meta?.subscribers != null ? Number(m7Meta.subscribers) : null;
              const m7Verified = m7Meta?.verification === 'VERIFIED';
              const m7CreatedRaw = m7Meta?.creation_time || m7Meta?.thread_metadata?.creation_time;
              const m7CreatedText = m7CreatedRaw ? formatDateTime(new Date(Number(m7CreatedRaw) * 1000).toISOString()) : null;
              const m7Desc = m7Meta?.description || m7Meta?.thread_metadata?.description || '';

              /* 2) Hübsche Vorschau-Nachricht MIT allen Live-Infos,    */
              /*    bevor die eigentliche Admin-Einladungskarte kommt.  */
              const m7BoxLines = [
                `┌─────────────────────────────┐`,
                `│ 📛 *Kanal:* ${m7ChannelName}`,
                `│ 🆔 *JID:* ${m7ChannelJid}`,
                `│ ✅ *Verifiziert:* ${m7Verified ? 'Ja ✔️' : 'Nein'}`,
                `│ 👥 *Abonnenten:* ${m7Subs != null ? m7Subs.toLocaleString('de-DE') : 'Unbekannt (Live-Abruf fehlgeschlagen)'}`,
                `│ 📅 *Erstellt am:* ${m7CreatedText || 'Unbekannt'}`,
                `│ 🔗 *Link:* ${NEWSLETTER_BOT_LINK}`,
                `└─────────────────────────────┘`
              ];

              const m7InfoText =
                `> ✨ *M7 — KANAL-ADMIN-EINLADUNG* 📡\n\n` +
                m7BoxLines.join('\n') + '\n\n' +
                (m7Desc ? `📝 *Beschreibung:* ${m7Desc}\n\n` : '') +
                `⏳ Die Einladung ist *7 Tage* gültig.\n` +
                `👑 Wird an *diesen Chat* gesendet, sobald du bestätigst — sende jetzt die Karte...`;

              await sock.sendMessage(from, {
                text: m7InfoText
              }, { quoted: msg });

              try {
                const m7ExpirySeconds = 7 * 24 * 60 * 60;
                const m7ExpiryDate = new Date(Date.now() + m7ExpirySeconds * 1000);
                await sock.sendJson(from, {
                  newsletterAdminInviteMessage: {
                    newsletterJid: m7ChannelJid,
                    newsletterName: m7ChannelName,
                    jpegThumbnail: m7ChannelThumb,
                    caption: `Nimm diese Einladung an, um Admin für meinen WhatsApp-Kanal „${m7ChannelName}“ zu werden.` +
                      (m7Subs != null ? `\n👥 Aktuell ${m7Subs.toLocaleString('de-DE')} Abonnenten.` : ''),
                    inviteExpiration: String(Math.floor(m7ExpiryDate.getTime() / 1000))
                  }
                }, {
                  quoted: msg
                });

                /* 3) Abschließende Erfolgsmeldung mit Zusammenfassung  */
                /*    + Ablaufdatum, statt nur einer Reaktion.          */
                await sock.sendMessage(from, {
                  text: `> ✅ *ADMIN-EINLADUNG VERSENDET* 🎉\n\n` +
                    `• *Kanal:* ${m7ChannelName}\n` +
                    `• *An:* ${from}\n` +
                    `• *Gültig bis:* ${formatDateTime(m7ExpiryDate.toISOString())}\n` +
                    (m7Subs != null ? `• *Abonnenten aktuell:* ${m7Subs.toLocaleString('de-DE')}\n` : '') +
                    `\n💜 Bestätige die Einladung im Chat, um Admin-Rechte zu übernehmen.`
                }, { quoted: msg });

                await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
                console.log(c.bold + c.brightGreen + `[m7] Newsletter-Admin-Einladung gesendet (Abonnenten: ${m7Subs != null ? m7Subs : 'unbekannt'}).` + c.reset);
              } catch (m7Err) {
                console.error(c.bold + c.brightRed + '[m7] Fehler beim Senden der Admin-Einladung:' + c.reset, m7Err);
                await sock.sendMessage(from, {
                  text: `> ❌ *Fehler beim Senden der Admin-Einladung.*\n\n_Grund:_ ${m7Err?.message || 'Unbekannter Fehler'}`
                }, {
                  quoted: msg
                });
                await sendReaction(sock, from, reactions.access.reactions.unauthorized, msg.key);
              }
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
                footerText: '💙 LoveBot by Maxichen 2026 · maxichen.gamebot.me · maxichen.de',
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

                /* 💜 Progression 2.0: Media-XP (Erst-Download / neuer Provider,
                   mit Tageslimit gegen Download-Farming) */
                try {
                  if (userProfile && (result.video || result.audio || result.thumbnail || sentMedia)) {
                    const mediaRes = applyMediaXp(userProfile, { platform: result.platform || 'generic' });
                    if (mediaRes.granted > 0) {
                      saveUserProfile(userProfile);
                      await sock.sendMessage(from, { text: `\n⭐ *+${mediaRes.granted} XP* — ${mediaRes.reason === 'first-download' ? 'dein erster Media-Download!' : 'neuer Provider entdeckt: ' + (mediaRes.reason || '').split(':')[1]}` }, { quoted: msg });
                      if (mediaRes.events?.length) {
                        await sendLevelUpAnnouncement(sock, from, msg, {
                          profile: userProfile, name: getProfileDisplayName(userProfile, msg.pushName || cleanId(senderJid)),
                          events: mediaRes.events, isGroup,
                          mentionJid: msg.key?.participant || senderLid || senderJid || null
                        });
                      }
                    }
                  }
                } catch (mediaXpErr) {}
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
            case 'kanal':
            case 'channelrelay':
            case 'kanalspiegel': {
              /* 📡 KANAL-SPIEGEL (Owner): Status / an-aus / Test.
                 Leitet jede Veröffentlichung im LoveBot-Kanal (Bild,
                 Audio, Sticker, Text, Video, Dokument, …) automatisch
                 in den Owner-Chat & alle aktiven Gruppen weiter. */
              if (!isHost) {
                await sock.sendMessage(from, {
                  text: `> ❌ *Nur der Owner* kann ${pref}kanal nutzen.`
                }, { quoted: msg });
                await sendReaction(sock, from, reactions.access.reactions.unauthorized, msg.key);
              } else {
                try {
                  await handleChannelRelayCommand({ sock, msg, from, args, isHost, pref });
                } catch (kanalErr) {
                  console.log(c.bold + c.brightYellow + '[kanal] Fehler: ' + c.reset + (kanalErr?.message || kanalErr));
                }
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
            /* 🍪 $cookie / $cookie accept / $cookie necessary / $cookie reject
               — Cookie-/Speicher-Zustimmung, analog zu $dsgvo, mit derselben
               Kategorien-Tabelle wie das Cookie-Banner auf der Website. */
            case 'cookie': {
              const subAction = (args[0] || '').toLowerCase();
              let targetProfile = userProfile;
              const targetRaw = (quoted && (msg.message?.extendedTextMessage?.contextInfo?.participant || msg.message?.extendedTextMessage?.contextInfo?.remoteJid))
                || (args[1] && args[1].replace(/^@/, '') + '@s.whatsapp.net');

              if (targetRaw && cleanId(targetRaw) !== cleanId(senderJid)) {
                if (userRole !== 'host' && userRole !== 'superadmin' && userRole !== 'admin') {
                  await sock.sendMessage(from, {
                    text: '> ⛔ *Zugriff verweigert:* Nur Admins, der SuperAdmin oder der Host dürfen die Cookie-Zustimmung anderer Nutzer verwalten.'
                  }, {
                    quoted: msg
                  });
                  await sendReaction(sock, from, reactions.access.reactions.unauthorized, msg.key);
                  break;
                }
                const cleanTarget = cleanId(targetRaw);
                targetProfile = await loadUserProfileForSender({ jid: cleanTarget + '@s.whatsapp.net' });
              }

              const cookieResult = await handleCookieCommand(targetProfile, subAction, pref);
              await sock.sendMessage(from, {
                text: cookieResult.text
              }, {
                quoted: msg
              });
              if (subAction === 'accept' || subAction === 'all' || subAction === 'necessary' || subAction === 'notwendig') {
                await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              } else if (subAction === 'reject') {
                await sendReaction(sock, from, reactions.errors.reactions.error, msg.key);
              }
              console.log(c.bold + c.brightGreen + '[cookie] Cookie-Befehl verarbeitet (' + (subAction || 'info') + ').' + c.reset);
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
              /* 🌹 Täglicher Impuls: Tipp · Kompliment · Challenge · Zitat
                 XP läuft jetzt durch die Level-Engine (Level-Ups möglich!). */
              const claim = claimDailyLove(userProfile?.identity?.bid || '');
              let dlXpLine = '';
              if (claim.ok && userProfile) {
                try { addWalletCoins(userProfile, { copper: claim.reward.copper }, { source: 'dailylove', reason: 'Daily-Love' }); } catch (walletErr) {}
                const dlRes = grantLevelXp(userProfile, claim.reward.xp, { source: 'dailies' });
                ensureStats(userProfile).dailyloveClaimed += 1; /* 📊 Progression 4.0 */
                saveUserProfile(userProfile);
                if (dlRes.events?.length) {
                  const dlPrestige = dlRes.events.some((e) => e.type === 'prestige');
                  await sendLevelUpAnnouncement(sock, from, msg, {
                    profile: userProfile, name: getProfileDisplayName(userProfile, msg.pushName || cleanId(senderJid)),
                    events: dlRes.events, isGroup,
                    mentionJid: msg.key?.participant || senderLid || senderJid || null
                  });
                  dlXpLine = '\n\n' + (dlPrestige ? '✨ *PRESTIGE UP!* — siehe oben 👆' : '🎉 *LEVEL UP!* — siehe oben 👆');
                }
              }
              await sock.sendMessage(from, { text: renderDailyLove(claim, { pref }) + (claim.ok ? dlXpLine : '') }, { quoted: msg });
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
                const usageText = '> 📝 *LOVE BOT — REGISTRIERUNG* 📝\n' +
                  '> 💜 _Dein LoveBot-Ausweis · in 10 Sekunden fertig._\n\n' +
                  '🌹┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈🌹\n\n' +
                  '*So geht’s:*\n' +
                  '> ' + pref + 'register *Name*[.*Alter*][.*Status*][.*Stadt*]\n\n' +
                  '*Beispiele:*\n' +
                  '• ' + pref + 'register Maxichen\n' +
                  '• ' + pref + 'register Maxichen.16.Single.Kerkrade\n\n' +
                  '*📝 Die Felder:*\n' +
                  '• *Name* — Pflicht, 2+ Zeichen\n' +
                  '• *Alter* — optional, z. B. 25 oder 18+\n' +
                  '• *Status* — optional, z. B. Single / Vergeben\n' +
                  '• *Stadt* — optional, wird in Gruppen maskiert\n\n' +
                  '*🎁 Danach wartet auf dich:*\n' +
                  '• 👤 Dein Profil & Profil-Buttons (' + pref + 'me)\n' +
                  '• 💎 Tägliche Kupfer (' + pref + 'daily)\n' +
                  '• 🐾 Haustier adoptieren (' + pref + 'pet)\n' +
                  '• 🏆 Erfolge & Level (' + pref + 'achievements)\n\n' +
                  '🔒 *Datenschutz:*\n' +
                  '• Unter 18 wird *kein exaktes Alter* gespeichert\n' +
                  '• Stadt & Alter sind in Gruppen automatisch versteckt\n' +
                  '• Alles steuerbar mit ' + pref + 'privacy\n\n' +
                  '🌹┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈🌹';

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
                language: userProfile?.registration?.language || normalized.registration?.language || 'de',
                value: parsed.value
              };
              /* 🌱 Starter-Paket (6.0): einmalig Kupfer + XP, sichere Migration aller Defaults */
              try {
                ensureProgression(userProfile);
                ensureEconomy(userProfile);
                const ecoR = userProfile.economy || {};
                if (!ecoR.starter) {
                  const rR = economyRules();
                  const sCopper = Math.max(0, Math.floor(Number(rR.starterCopper ?? 500) || 0));
                  const sXp = Math.max(0, Math.floor(Number(rR.starterXp ?? 25) || 0));
                  if (sCopper > 0) addCoins(userProfile, sCopper, { source: 'starter', reason: 'Willkommens-Bonus' });
                  if (sXp > 0 && xpEligible(userProfile)) grantLevelXp(userProfile, sXp, { source: 'general' });
                  ecoR.starter = { at: Date.now(), copper: sCopper, xp: sXp };
                }
              } catch (starterErr) { /* Starter darf die Registrierung nie blockieren */ }
              saveUserProfile(userProfile);

              const reg = userProfile.registration;
              /* 💜 7.0: Welcome-Box mit echten Startwerten */
              const wProg = userProfile.progression || {};
              const wBal = (() => { try { return getBalance(userProfile) || {}; } catch (e) { return {}; } })();
              const wStarter = userProfile.economy?.starter || {};
              const regCardText = '╭──── 💜 *WELCOME TO LOVEBOT* ────╮\n\n' +
                  'Account erfolgreich erstellt, ' + String(reg.name || '') + '! 🥳\n\n' +
                  '👤 Profil\n✅ Erstellt\n\n' +
                  '🏆 Level\n' + (wProg.level || 0) + '\n\n' +
                  '✨ XP\n' + Number(wProg.totalXp || 0).toLocaleString('de-DE') + '\n\n' +
                  '💰 Wallet\n' + Number(wBal.wallet || 0).toLocaleString('de-DE') + ' Kupfer\n\n' +
                  '🏦 Bank\n' + Number(wBal.bank || 0).toLocaleString('de-DE') + ' Kupfer\n\n' +
                  '🔥 Streak\n' + (wProg.streak || 0) + '\n\n' +
                  '🎁 Starter Reward\n+' + Number(wStarter.copper || 0).toLocaleString('de-DE') + ' Kupfer' + (wStarter.xp ? ' + ' + wStarter.xp + ' XP' : '') + '\n\n' +
                  '━━━━━━━━━━━━━━━━━━\n\n' +
                  '*START HERE*\n\n' +
                  pref + 'me\n' + pref + 'daily\n' + pref + 'level\n' + pref + 'balance\n' + pref + 'ai\n\n' +
                  '━━━━━━━━━━━━━━━━━━\n\n' +
                  '🪪 ' + String(reg.name || '') + ' · 🎂 ' + ageLabel(reg, { reveal: true }) + ' · 💘 ' + (reg.status || '—') + ' · 📍 ' + cityLabel(reg, { privateChat: !isGroup }) + '\n' +
                  '🛡️ Sichtbarkeit: ' + pref + 'privacy\n\n' +
                  'Enjoy LoveBot 💜\n' +
                  '╰──────────────────────────────╯';

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
                  footerText: '💜 LoveBot by Maxichen 2026 · maxichen.gamebot.me',
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
                footerText: '💙 LoveBot by Maxichen 2026 · maxichen.gamebot.me · maxichen.de',
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

              /* Echte Aktion ausführen, wenn ein Ziel übergeben wurde (7.0: + Mention/Reply) */
              const kickCtx = msg.message?.extendedTextMessage?.contextInfo || {};
              const kickMention = (Array.isArray(kickCtx.mentionedJid) && kickCtx.mentionedJid[0]) || '';
              const kickQuoted = kickCtx.participant || '';
              if (['kick', 'promote', 'demote'].includes(command) && mode !== 'on' && mode !== 'off' && (args[0] || kickMention || kickQuoted)) {
                if (userRole !== 'host' && userRole !== 'superadmin' && userRole !== 'admin') {
                  await sock.sendMessage(from, {
                    text: `> ⛔ *Zugriff verweigert:* Nur Admins, der Superadmin oder der Host können *${pref}${command}* ausführen.`
                  }, { quoted: msg });
                  await sendReaction(sock, from, reactions.access.reactions.unauthorized, msg.key);
                  break;
                }
                const targetRaw = kickMention || kickQuoted || args[0] || (quoted && (quoted.conversation || quoted.extendedTextMessage?.text));
                const target = await resolveBanTarget(sock, targetRaw, sessionPath);
                if (!target || !target.jid) {
                  await sock.sendMessage(from, { text: '> ❌ *Fehler:* Ziel konnte nicht aufgelöst werden.' }, { quoted: msg });
                  break;
                }
                if (cleanId(target.jid) === cleanId(senderJid)) {
                  await sock.sendMessage(from, { text: '> ❌ *Fehler:* Du kannst dich nicht selbst ändern.' }, { quoted: msg });
                  break;
                }
                /* 💜 7.0: Bot- & Owner-Schutz */
                const selfIds = [hostJid, hostLid, sock.user?.id, sock.user?.lid].filter(Boolean).map((x) => cleanId(x));
                if (selfIds.includes(cleanId(target.jid)) || (target.lid && selfIds.includes(cleanId(target.lid)))) {
                  await sock.sendMessage(from, { text: '> ❌ *Fehler:* Diese Aktion ist gegen den Bot nicht möglich.' }, { quoted: msg });
                  break;
                }
                if (cleanId(target.jid) === cleanId(groupMetadata?.owner || '___')) {
                  await sock.sendMessage(from, { text: '> ❌ *Fehler:* Der Gruppen-Owner steht unter Schutz.' }, { quoted: msg });
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
                /* 💜 7.0: Gruppen-Audit */
                try {
                  if (groupProfile) {
                    ensureGroupExtras(groupProfile);
                    groupAudit(groupProfile, senderLidUser || cleanId(senderJid) || '', command, `${actLabel}: ${cleanId(target.jid)}`);
                    saveGroupProfile(groupProfile);
                  }
                } catch (e) {}
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
            case 'mystats':
            case 'mystat':
              args.unshift('me');
            /* fällt durch zu 'stats' */
            case 'stats': {
              /* 📊 Progression 4.0: $stats me|ich → persönlich (System bleibt Default) */
              if (['me', 'ich', 'my', 'mine'].includes(String(args[0] || '').toLowerCase())) {
                await sock.sendMessage(from, { text: buildPersonalStats(userProfile || {}) }, { quoted: msg });
                await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
                break;
              }
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

              /* Sicherheitskopie direkt an den Owner, der den Bot-Ban ausgelöst hat. */
              const ownerAlertJid = senderJid || senderLid;
              if (ownerAlertJid && ownerAlertJid !== from) {
                try {
                  await sock.sendMessage(ownerAlertJid, {
                    text: '🛡️ LOVE BOT — SECURITY ALERT\n\n' +
                      'Ereignis: USER_BANNED (Bot)\n' +
                      `Zeit: ${new Date().toISOString()}\n` +
                      `Ziel-JID: ${target.jid || '—'}\n` +
                      `Ziel-LID: ${target.lid || '—'}\n` +
                      `Grund: ${reason}\n` +
                      `Auslöser: ${senderUn || senderLidUser || 'Owner'}\n` +
                      `Chat/Gruppe: ${from}\n` +
                      `PN an Ziel: ${pnOk ? 'gesendet' : 'fehlgeschlagen'}\n` +
                      `Aus Gruppen entfernt: ${removedGroups.length}\n\n` +
                      'Zugangsdaten, 2FA-Codes und Session-Schlüssel werden nicht versendet.'
                  });
                } catch (ownerAlertError) {
                  console.error('[security] Owner-Ban-Alert fehlgeschlagen:', ownerAlertError?.message || ownerAlertError);
                }
              }

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
              if (String(args[0] || '').toLowerCase() === 'me' || String(args[0] || '').toLowerCase() === 'ich') {
                /* 👤 $info me → eigene Account-Übersicht (6.0) */
                if (!userProfile) {
                  await sock.sendMessage(from, { text: '> ❌ Profil nicht verfügbar.' }, { quoted: msg });
                  break;
                }
                const bidI = userProfile?.identity?.bid || '';
                const rankI = bidI ? cachedGlobalRank(readDb().users || {}, bidI) : { pos: null, total: 0 };
                await sock.sendMessage(from, {
                  text: buildAccount(userProfile, { plusUser: plusUserFor(bidI), rankPos: rankI.pos, rankTotal: rankI.total, pref })
                }, { quoted: msg });
                break;
              }
              const text =
                '> 🤖 *LOVE BOT — INFO* 🤖\n\n' +
                `• *Name:* LoveBot\n` +
                `• *Version:* 1.0.0\n` +
                `• *Prefix:* \`${pref}\`\n` +
                `• *Plattform:* Node.js · Baileys\n` +
                `• *Owner:* Maxichen\n` +
                `• *Website:* maxichen.de\n` +
                `• *Dashboard:* maxichen.gamebot.me\n\n` +
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
            case 'gcinfo':
            case 'ginfo':
            case 'group': {
              if (!isGroup) {
                await sock.sendMessage(from, { text: '> ❌ *Fehler:* Dieser Befehl funktioniert nur in Gruppen.' }, { quoted: msg });
                break;
              }
              /* 💜 7.0: massiver Gruppenbericht aus echten Daten */
              ensureGroupExtras(groupProfile);
              const participants = (groupMetadata && Array.isArray(groupMetadata.participants)) ? groupMetadata.participants : [];
              const admins = participants.filter((p) => p && ['admin', 'superadmin'].includes(p.admin)).length;
              const usersGi = readDb().users || {};
              const topGi = topMembers(groupProfile, 'xp', 3);
              const namesGi = {};
              for (const t of topGi) namesGi[t.bid] = usersGi[t.bid]?.registration?.name || getProfileDisplayName(usersGi[t.bid], null) || t.bid;
              await sock.sendMessage(from, {
                text: buildGroupInfo(groupProfile, {
                  subject: groupMetadata?.subject || groupProfile?.subject || '',
                  count: participants.length, admins,
                  owner: groupMetadata?.owner ? '@' + String(cleanId(groupMetadata.owner)).split('@')[0] : '',
                  creation: groupMetadata?.creation ? new Date(groupMetadata.creation * 1000).toLocaleDateString('de-DE') : '',
                  desc: groupMetadata?.desc || ''
                }, { pref, topNames: namesGi })
              }, { quoted: msg });
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
                /* 🤖 Nach dem Beitreten stellt sich der Bot der Gruppe vor
                   (Dedupe verhindert Doppelpost, falls das
                   participants.update zusätzlich eintrifft). */
                if (invite) {
                  try { await announceBotJoinedGroup(sock, String(invite)); } catch (joinIntroErr) {}
                }
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
            /* 🚫 BLOCKCASE / OPENCASE / LISTBC — nur Owner!           */
            /* Sperrt/entsperrt einzelne Befehle bot-weit für alle    */
            /* außer den Owner selbst.                                */
            /* ====================================================== */
            case 'blockcase': {
              if (!isStrictOwner(readDb(), senderJid, senderLid)) {
                await sock.sendMessage(from, {
                  text: `> ⛔ *Zugriff verweigert:*\n\n*${pref}blockcase* darf ausschließlich der Owner nutzen. 👑`
                }, { quoted: msg });
                await sendReaction(sock, from, reactions.access.reactions.unauthorized, msg.key);
                try {
                  botSecurityEvent('BOT_UNAUTHORIZED_OWNER_CMD', {
                    risk: 45, action: 'logged', command: 'blockcase',
                    jidMasked: String(senderJid || from || '').replace(/(\d{4})\d+(\d{4})/, '$1•••$2')
                  });
                } catch (e) {}
                break;
              }

              const bcTarget = normalizeBlockcaseCommandName(args[0]);
              const bcReason = args.slice(1).join(' ').trim();

              if (!bcTarget || !bcReason) {
                await sock.sendMessage(from, {
                  text: `> 🚫 *BLOCKCASE*\n\n` +
                    `Nutze: *${pref}blockcase <befehl> <grund>*\n\n` +
                    `_Beispiel:_ ${pref}blockcase kiss Wird gerade überarbeitet\n\n` +
                    `💡 Auflisten: *${pref}listbc* · Entsperren: *${pref}opencase <befehl>*`
                }, { quoted: msg });
                await sendReaction(sock, from, reactions.access.reactions.unauthorized, msg.key);
                break;
              }

              if (bcTarget === 'blockcase' || bcTarget === 'opencase' || bcTarget === 'listbc') {
                await sock.sendMessage(from, {
                  text: `> ⛔ *Das geht nicht:* Die Blockcase-Befehle selbst können nicht gesperrt werden.`
                }, { quoted: msg });
                await sendReaction(sock, from, reactions.access.reactions.unauthorized, msg.key);
                break;
              }

              const bcDb = readDb();
              const bcByLabel = (senderUn && String(senderUn).trim())
                || (msg.pushName && String(msg.pushName).trim())
                || `+${cleanId(senderJid)}`
                || 'Owner';
              blockCommand(bcDb, bcTarget, bcReason, bcByLabel);
              writeDb(bcDb);

              await sock.sendMessage(from, {
                text: `> 🚫✅ *BEFEHL GESPERRT*\n\n` +
                  `• *Befehl:* ${pref}${bcTarget}\n` +
                  `• *Grund:* ${bcReason}\n` +
                  `• *Gesperrt von:* ${bcByLabel}\n\n` +
                  `Niemand außer dir kann *${pref}${bcTarget}* jetzt noch nutzen.\n` +
                  `💡 Wieder öffnen: *${pref}opencase ${bcTarget}*`
              }, { quoted: msg });
              await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              console.log(c.bold + c.brightYellow + `[blockcase] ${senderJid} sperrt „${bcTarget}“ (Grund: ${bcReason}).` + c.reset);
              break;
            }

            case 'opencase': {
              if (!isStrictOwner(readDb(), senderJid, senderLid)) {
                await sock.sendMessage(from, {
                  text: `> ⛔ *Zugriff verweigert:*\n\n*${pref}opencase* darf ausschließlich der Owner nutzen. 👑`
                }, { quoted: msg });
                await sendReaction(sock, from, reactions.access.reactions.unauthorized, msg.key);
                try {
                  botSecurityEvent('BOT_UNAUTHORIZED_OWNER_CMD', {
                    risk: 45, action: 'logged', command: 'opencase',
                    jidMasked: String(senderJid || from || '').replace(/(\d{4})\d+(\d{4})/, '$1•••$2')
                  });
                } catch (e) {}
                break;
              }

              const ocTarget = normalizeBlockcaseCommandName(args[0]);
              if (!ocTarget) {
                await sock.sendMessage(from, {
                  text: `> 🔓 *OPENCASE*\n\nNutze: *${pref}opencase <befehl>*\n\n💡 Alle gesperrten Befehle: *${pref}listbc*`
                }, { quoted: msg });
                await sendReaction(sock, from, reactions.access.reactions.unauthorized, msg.key);
                break;
              }

              const ocDb = readDb();
              const ocExisted = unblockCommand(ocDb, ocTarget);
              if (!ocExisted) {
                await sock.sendMessage(from, {
                  text: `> ❓ *${pref}${ocTarget}* ist gar nicht gesperrt.\n\n💡 Übersicht: *${pref}listbc*`
                }, { quoted: msg });
                await sendReaction(sock, from, reactions.access.reactions.unauthorized, msg.key);
                break;
              }
              writeDb(ocDb);

              await sock.sendMessage(from, {
                text: `> 🔓✅ *BEFEHL ENTSPERRT*\n\n*${pref}${ocTarget}* kann jetzt wieder von allen genutzt werden. 💜`
              }, { quoted: msg });
              await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              console.log(c.bold + c.brightGreen + `[blockcase] ${senderJid} entsperrt „${ocTarget}“.` + c.reset);
              break;
            }

            case 'listbc': {
              if (!isStrictOwner(readDb(), senderJid, senderLid)) {
                await sock.sendMessage(from, {
                  text: `> ⛔ *Zugriff verweigert:*\n\n*${pref}listbc* darf ausschließlich der Owner nutzen. 👑`
                }, { quoted: msg });
                await sendReaction(sock, from, reactions.access.reactions.unauthorized, msg.key);
                try {
                  botSecurityEvent('BOT_UNAUTHORIZED_OWNER_CMD', {
                    risk: 45, action: 'logged', command: 'listbc',
                    jidMasked: String(senderJid || from || '').replace(/(\d{4})\d+(\d{4})/, '$1•••$2')
                  });
                } catch (e) {}
                break;
              }

              const lbcDb = readDb();
              const lbcCfg = getBlockedCommandsConfig(lbcDb);
              const lbcEntries = Object.entries(lbcCfg);

              if (lbcEntries.length === 0) {
                await sock.sendMessage(from, {
                  text: `> 🚫 *GESPERRTE BEFEHLE*\n\n` +
                    `Aktuell ist kein einziger Befehl gesperrt. Alles läuft frei! ✅\n\n` +
                    `💡 Sperren: *${pref}blockcase <befehl> <grund>*`
                }, { quoted: msg });
                await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
                break;
              }

              const NAME_W = 16;
              const BY_W = 14;

              const clip = (s, w) => {
                s = String(s || '');
                return s.length > w ? s.slice(0, w - 1) + '…' : s.padEnd(w, ' ');
              };

              const headerLine = `${clip('Befehl', NAME_W)} │ ${clip('Gesperrt von', BY_W)} │ Datum`;
              const sepLine = '─'.repeat(NAME_W + 1) + '┼' + '─'.repeat(BY_W + 2) + '┼' + '─'.repeat(20);

              const bodyLines = [];
              lbcEntries.forEach(([k, v], idx) => {
                const when = v.blockedAt ? new Date(v.blockedAt).toLocaleString('de-DE') : '—';
                bodyLines.push(`${clip(pref + k, NAME_W)} │ ${clip(v.blockedBy || 'Owner', BY_W)} │ ${when}`);
                bodyLines.push(`${''.padEnd(NAME_W, ' ')} │ ${''.padEnd(BY_W, ' ')} │ Grund: ${v.reason || 'Kein Grund angegeben'}`);
                if (idx < lbcEntries.length - 1) bodyLines.push('─'.repeat(NAME_W + 1) + '┼' + '─'.repeat(BY_W + 2) + '┼' + '─'.repeat(20));
              });

              const listbcTable =
                '```\n' +
                headerLine + '\n' +
                sepLine + '\n' +
                bodyLines.join('\n') +
                '\n```';

              await sock.sendMessage(from, {
                text: `> 🚫 *GESPERRTE BEFEHLE* (${lbcEntries.length})\n\n` +
                  listbcTable + '\n\n' +
                  `💡 Entsperren: *${pref}opencase <befehl>* · Neu sperren: *${pref}blockcase <befehl> <grund>*`
              }, { quoted: msg });
              await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              break;
            }

            case 'offline': {
              if (!isStrictOwner(readDb(), senderJid, senderLid)) {
                await sock.sendMessage(from, {
                  text: `> ⛔ *Zugriff verweigert:*\n\n*${pref}offline* darf ausschließlich der Owner nutzen. 👑`
                }, { quoted: msg });
                await sendReaction(sock, from, reactions.access.reactions.unauthorized, msg.key);
                try {
                  botSecurityEvent('BOT_UNAUTHORIZED_OWNER_CMD', {
                    risk: 45, action: 'logged', command: 'offline',
                    jidMasked: String(senderJid || from || '').replace(/(\d{4})\d+(\d{4})/, '$1•••$2')
                  });
                } catch (e) {}
                break;
              }

              const offReason = args.join(' ').trim() || 'Wartungsarbeiten laufen gerade — bin gleich zurück! 💜';
              const offByLabel = (senderUn && String(senderUn).trim())
                || (msg.pushName && String(msg.pushName).trim())
                || `+${cleanId(senderJid)}`
                || 'Owner';

              const offState = setMaintenanceOn(offReason, offByLabel);
              try {
                botSecurityEvent('MAINTENANCE_MODE_ON', {
                  risk: 20, action: 'applied', reason: offReason, by: offByLabel
                });
              } catch (e) {}

              await sock.sendMessage(from, {
                text: `> 🛠️✅ *WARTUNGSMODUS AKTIVIERT*\n\n` +
                  `• *Grund:* ${offReason}\n` +
                  `• *Von:* ${offByLabel}\n` +
                  `• *Seit:* ${new Date(offState.since).toLocaleString('de-DE')}\n\n` +
                  `🤖 *Bot:* Nur du (Owner) kannst jetzt noch Befehle nutzen — alle anderen sehen den Grund.\n` +
                  `🌐 *Website:* Zeigt allen Besuchern „Zugriff verweigert“ mit dem Grund — nur du kommst noch rein.\n\n` +
                  `💡 Wieder öffnen: *${pref}online*`
              }, { quoted: msg });
              await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              console.log(c.bold + c.brightYellow + `[maintenance] ${senderJid} aktiviert Wartungsmodus (Grund: ${offReason}).` + c.reset);
              break;
            }

            case 'online': {
              if (!isStrictOwner(readDb(), senderJid, senderLid)) {
                await sock.sendMessage(from, {
                  text: `> ⛔ *Zugriff verweigert:*\n\n*${pref}online* darf ausschließlich der Owner nutzen. 👑`
                }, { quoted: msg });
                await sendReaction(sock, from, reactions.access.reactions.unauthorized, msg.key);
                try {
                  botSecurityEvent('BOT_UNAUTHORIZED_OWNER_CMD', {
                    risk: 45, action: 'logged', command: 'online',
                    jidMasked: String(senderJid || from || '').replace(/(\d{4})\d+(\d{4})/, '$1•••$2')
                  });
                } catch (e) {}
                break;
              }

              const onByLabel = (senderUn && String(senderUn).trim())
                || (msg.pushName && String(msg.pushName).trim())
                || `+${cleanId(senderJid)}`
                || 'Owner';

              const wasOn = getMaintenance().on;
              setMaintenanceOff(onByLabel);
              try {
                botSecurityEvent('MAINTENANCE_MODE_OFF', {
                  risk: 5, action: 'applied', by: onByLabel
                });
              } catch (e) {}

              await sock.sendMessage(from, {
                text: wasOn
                  ? `> ✅🌙 *WARTUNGSMODUS BEENDET*\n\nBot & Website sind wieder für alle da. Willkommen zurück! 💜`
                  : `> ❓ Der Wartungsmodus war gar nicht aktiv — es ist bereits alles offen für alle. ✅`
              }, { quoted: msg });
              await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              console.log(c.bold + c.brightGreen + `[maintenance] ${senderJid} beendet Wartungsmodus.` + c.reset);
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
                  pref, hideEconomy: economyHidden(tp)
                });
                /* 📈 Progressions-Kern (5.0): Rangzeile + Platz + Badges — öffentlich, ohne IDs */
                const rankTT = tp?.identity?.bid ? cachedGlobalRank(readDb().users || {}, tp.identity.bid) : { pos: null, total: 0 };
                const progBlockT = '\n\n' + rankLine(tp, tName) +
                  (rankTT.pos ? `\n📍 Global: *#${rankTT.pos}* von ${rankTT.total}` : '\n📍 Global: *noch unplatziert*') +
                  `\n🏅 Badges: *${Object.keys(tp?.progression?.badges || {}).length}* · Σ *${Number(tp?.progression?.totalXp || 0).toLocaleString('de-DE')}* XP`;
                let ppUrl = null;
                try { ppUrl = await sock.profilePictureUrl(targetJid || '', 'image'); } catch (e) { ppUrl = null; }
                if (ppUrl) {
                  await sock.sendMessage(from, { image: { url: ppUrl }, caption: card + progBlockT, mimetype: 'image/jpeg' }, { quoted: msg });
                } else {
                  await sock.sendMessage(from, { text: card + progBlockT }, { quoted: msg });
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
                const rankTS = userProfile?.identity?.bid ? cachedGlobalRank(readDb().users || {}, userProfile.identity.bid) : { pos: null, total: 0 };
                const progBlockS = '\n\n' + rankLine(userProfile, userProfile.registration?.name || 'Du') +
                  (rankTS.pos ? `\n📍 Global: *#${rankTS.pos}* von ${rankTS.total}` : '\n📍 Global: *noch unplatziert*') +
                  `\n🏅 Badges: *${Object.keys(userProfile?.progression?.badges || {}).length}* · Σ *${Number(userProfile?.progression?.totalXp || 0).toLocaleString('de-DE')}* XP`;
                await sock.sendMessage(from, { text: card + progBlockS, mentions: [senderLid] }, { quoted: msg });
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

            case 'xp':
            case 'x': {
              /* 💜 Kompakt-Status: Level, Balken, Zeiträume, Verlauf ($level = volles Profil) */
              const subXM = String(args[0] || '').toLowerCase();
              if (subXM === 'multi' || subXM === 'mult' || subXM === 'bonus') {
                await sock.sendMessage(from, { text: buildXpMultiplier(userProfile || {}, { isOwner: !!isHost }) }, { quoted: msg });
                break;
              }
              const pX = ensureProgression(userProfile || {});
              const nameX = getProfileDisplayName(userProfile || {}, msg.pushName || cleanId(senderJid));
              const rankX = rankFor(pX.prestige, pX.level);
              const titleX = pX.title || titleFor(pX.level);
              const perX = xpPeriods(userProfile || {});
              const needX = Math.max(1, Number(pX.neededXpForLvOrPrestigeUp) || 1);
              const pctX = Math.max(0, Math.min(100, Math.round((Number(pX.xp) / needX) * 100)));
              const fillX = Math.round(pctX / 100 * 8);
              const barX = '▰'.repeat(fillX) + '▱'.repeat(8 - fillX);
              const histX = recentXp(userProfile || {}, 3).map((e) => `• ${e.label}: +${Number(e.amount).toLocaleString('de-DE')} XP`).join('\n');
              await sock.sendMessage(from, {
                text: `> 💜 *XP-STATUS* — *${nameX}*\n\n${rankX.full}\n⭐ P${pX.prestige} · Lv ${pX.level} · \`${barX}\` ${pctX}%\n📛 ${titleX.emoji} *${titleX.name}*\n📆 Heute +${Number(perX.today).toLocaleString('de-DE')} · Woche +${Number(perX.week).toLocaleString('de-DE')} · Monat +${Number(perX.month).toLocaleString('de-DE')}\nΣ Lifetime: *${Number(perX.lifetime).toLocaleString('de-DE')}* XP` +
                  (histX ? `\n\n🧾 *Zuletzt*\n${histX}` : '') +
                  `\n\n💡 *${pref}level* für das volle Profil.`
              }, { quoted: msg });
              break;
            }

            case 'level':
            case 'lvl':
            case 'lv': {
              /* 💜 Kompletes Level-Profil: Level, Prestige, Rang, XP-Balken, Quellen (+ $level @user) */
              let viewProfileL = userProfile;
              let nameP = getProfileDisplayName(userProfile || {}, msg.pushName || cleanId(senderJid));
              if (args[0]) {
                const tL = await resolveBanTarget(sock, args, sessionPath);
                if (!tL || (!tL.jid && !tL.lid)) {
                  await sock.sendMessage(from, { text: '> ❌ *Fehler:* Ziel konnte nicht aufgelöst werden. Nutze *' + pref + 'level @person*.' }, { quoted: msg });
                  break;
                }
                viewProfileL = await loadUserProfileForSender({ jid: tL.jid || '', lid: tL.lid || '' });
                nameP = getProfileDisplayName(viewProfileL || {}, tL.name || cleanId(tL.jid || tL.lid));
              }
              if (!viewProfileL) {
                await sock.sendMessage(from, { text: '> ☾ kein profil gefunden. die nacht vergisst niemand — aber dieses hier ist leer.' }, { quoted: msg });
                break;
              }
              const pP = viewProfileL || {};
              const loveP = pP.love || {};
              const levelCard = profileCard(pP, nameP, pref);
              /* Progression 2.0: Heute/Woche + drei getrennte Streaks */
              const p2P = pP.progression || {};
              const p2St = p2P.streaks || {};
              const p2Mult = xpMultiplier(pP).toFixed(2);
              const p2Unlocks = Object.keys(p2P.unlocks || {}).length;
              await sock.sendMessage(from, {
                text: levelCard +
                  (pP.identity?.title ? `\n📛 Titel: *${pP.identity.title}*` : '') +
                  (pP.identity?.bio ? `\n📝 Bio: *${pP.identity.bio}*` : '') +
                  (loveP.spouseName ? `\n💍 verheiratet mit: *${loveP.spouseName}*` : '') +
                  `\n\n⚡ *Bonus & Streaks*\n• *Multiplikator:* ${p2Mult}×\n\n🔥 *Streaks*\n• Aktiv: ${p2St.daily?.c || 0} Tage\n• Chat: ${p2St.chat?.c || 0} Tage\n• XP (≥50/Tag): ${p2St.xp?.c || 0} Tage\n\n🎁 Freischaltungen: ${p2Unlocks}/${MILESTONES.length}` +
                  '\n\n☾ every soul has a story.'
              }, { quoted: msg });
              break;
            }

            case 'rewards':
            case 'belohnungen': {
              /* 🎁 Rewards: erhalten + kommend + Ziel-Belohnungen (Progression 4.0) */
              await sock.sendMessage(from, {
                text: buildRewards(userProfile || {}) + `\n\n💡 _Jedes Level bringt Kupfer, Meilensteine bringen Titel & Cosmetics. Mit Prestige bleiben alle Freischaltungen erhalten._`
              }, { quoted: msg });
              break;
            }

            case 'xpsources':
            case 'xpquellen':
            case 'xq': {
              /* 📊 XP-Quellen-Anteile (Progression 5.0) */
              await sock.sendMessage(from, { text: buildXpSources(userProfile || {}) }, { quoted: msg });
              break;
            }

            case 'weekly':
            case 'woche': {
              /* 🗓️ Wochen-Report (5.0, seit 6.0 mit Rang + Kupfer + Aktivität) */
              const bidWm = userProfile?.identity?.bid || '';
              const rankWm = bidWm ? cachedGlobalRank(readDb().users || {}, bidWm) : { pos: null, total: 0 };
              await sock.sendMessage(from, { text: buildWeeklyReport(userProfile || {}, Date.now(), { rankPos: rankWm.pos, rankTotal: rankWm.total }) }, { quoted: msg });
              break;
            }

            case 'monthly':
            case 'monat': {
              /* 📆 Monats-Report (5.0, seit 6.0 mit Rang + Kupfer + Aktivität) */
              const bidMm = userProfile?.identity?.bid || '';
              const rankMm = bidMm ? cachedGlobalRank(readDb().users || {}, bidMm) : { pos: null, total: 0 };
              await sock.sendMessage(from, { text: buildMonthlyReport(userProfile || {}, Date.now(), { rankPos: rankMm.pos, rankTotal: rankMm.total }) }, { quoted: msg });
              break;
            }

            case 'prestige': {
              /* 👑 Prestige-Karte (Progression 5.0) */
              await sock.sendMessage(from, { text: buildPrestige(userProfile || {}) }, { quoted: msg });
              break;
            }

            case 'compare':
            case 'vergleich': {
              /* ⚔️ Fairer Profil-Vergleich, ein Kern mit $profile (Progression 5.0) */
              const cmpTarget = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
                || quoted?.extendedTextMessage?.contextInfo?.participant
                || args.find((a) => a.startsWith('@') || /^\d{6,}/.test(a))
                || '';
              if (!cmpTarget) {
                await sock.sendMessage(from, { text: `> ⚔️ *VERGLEICH*\n\nNutze: *${pref}compare @person*` }, { quoted: msg });
                break;
              }
              const tC = await resolveBanTarget(sock, String(cmpTarget), sessionPath);
              if (!tC || (!tC.jid && !tC.lid)) {
                await sock.sendMessage(from, { text: '> ❌ *Fehler:* Ziel konnte nicht aufgelöst werden.' }, { quoted: msg });
                break;
              }
              const profC = await loadUserProfileForSender({ jid: tC.jid || '', lid: tC.lid || '' });
              if (!profC?.registration?.registered) {
                await sock.sendMessage(from, { text: '> ❓ Diese Person ist noch nicht registriert.' }, { quoted: msg });
                break;
              }
              const usersC = readDb().users || {};
              const bidSelfC = userProfile?.identity?.bid || '';
              const bidOtherC = profC?.identity?.bid || '';
              const rSelfC = bidSelfC ? cachedGlobalRank(usersC, bidSelfC) : { pos: null, total: 0 };
              const rOtherC = bidOtherC ? cachedGlobalRank(usersC, bidOtherC) : { pos: null, total: 0 };
              const nameSelfC = getProfileDisplayName(userProfile || {}, msg.pushName || 'Du');
              const nameOtherC = getProfileDisplayName(profC, tC.name || 'Profil');
              await sock.sendMessage(from, {
                text: buildCompare(userProfile || {}, nameSelfC, profC, nameOtherC, { rankA: rSelfC.pos, rankB: rOtherC.pos, total: Math.max(rSelfC.total, rOtherC.total), showEconomy: !economyHidden(userProfile) && !economyHidden(profC) })
              }, { quoted: msg });
              break;
            }

            case 'reward': {
              /* 🎁 Truhen abholen (Progression 5.0) — $rewards bleibt die Übersicht */
              const subR = String(args[0] || '').toLowerCase();
              if (subR === 'claim' || subR === 'abholen' || subR === 'holen') {
                if (!userProfile) {
                  await sock.sendMessage(from, { text: '> ❌ Profil nicht verfügbar.' }, { quoted: msg });
                  break;
                }
                let claimRes = null;
                await withProfileLock(userProfile?.identity?.bid || '', async () => {
                  claimRes = claimReward(userProfile, args.slice(1).join(' '));
                  if (claimRes && claimRes.ok) saveUserProfile(userProfile);
                });
                if (claimRes && claimRes.ok) {
                  await sock.sendMessage(from, { text: `> 🎁 *TRUHE GEÖFFNET!*\n\n${claimRes.label}\n💰 *+${Number(claimRes.copper || 0).toLocaleString('de-DE')} Kupfer*${claimRes.remaining ? `\n\n_No\ch ${claimRes.remaining} Truhe(n) warten — ${pref}reward claim_` : ''}` }, { quoted: msg });
                  await sendReaction(sock, from, '🎁', msg.key);
                } else if (claimRes && claimRes.reason === 'not-found') {
                  await sock.sendMessage(from, { text: '> ❌ *Diese Truhe gibt es nicht.*\n\nVerfügbar: ' + ((claimRes.pending || []).map((r) => r.label).join(', ') || '–') }, { quoted: msg });
                } else {
                  await sock.sendMessage(from, { text: `> 📭 *Keine Truhen offen.*\n\nTruhen gibt es bei Level 25/75/150/200/250 und jedem Prestige-Up. Übersicht: *${pref}rewards*` }, { quoted: msg });
                }
                break;
              }
              const pendR = userProfile?.progression?.pendingRewards || [];
              await sock.sendMessage(from, {
                text: pendR.length
                  ? `> 🎁 *OFFENE TRUHEN (${pendR.length})*\n\n` + pendR.map((r) => `• ${r.label} — +${Number(r.copper || 0).toLocaleString('de-DE')} Kupfer`).join('\n') + `\n\nAbholen: *${pref}reward claim*`
                  : `> 📭 *Keine Truhen offen.*\n\nÜbersicht aller Belohnungen: *${pref}rewards*`
              }, { quoted: msg });
              break;
            }

            case 'givexp':
            case 'takexp': {
              /* 🛠️ Owner-XP-Tools mit Audit + Rollback (Progression 5.0) */
              if (!isHost) {
                await sock.sendMessage(from, { text: '> ❌ *Nur der Owner kann XP anpassen.*' }, { quoted: msg });
                break;
              }
              const negX = command === 'takexp';
              const tRawX = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
                || quoted?.extendedTextMessage?.contextInfo?.participant
                || args.find((a) => a.startsWith('@') || /^\d{6,}/.test(a))
                || '';
              const amtTokX = args.find((a) => /^-?\d+$/.test(a));
              const reasonX = args.filter((a) => a !== tRawX && a !== amtTokX).join(' ').trim();
              if (!tRawX || !amtTokX) {
                await sock.sendMessage(from, { text: `> 🛠️ *XP ANPASSEN (Owner)*\n\nNutze: *${pref}${command} @person <anzahl> <grund, min. 5 Zeichen>*\nRückgängig: *${pref}xprollback @person*` }, { quoted: msg });
                break;
              }
              const tX = await resolveBanTarget(sock, String(tRawX), sessionPath);
              if (!tX || (!tX.jid && !tX.lid)) {
                await sock.sendMessage(from, { text: '> ❌ *Fehler:* Ziel konnte nicht aufgelöst werden.' }, { quoted: msg });
                break;
              }
              const profX = await loadUserProfileForSender({ jid: tX.jid || '', lid: tX.lid || '' });
              if (!profX?.identity?.bid) {
                await sock.sendMessage(from, { text: '> ❌ Profil nicht gefunden.' }, { quoted: msg });
                break;
              }
              const deltaX = (negX ? -1 : 1) * Math.abs(Math.floor(Number(amtTokX)));
              let resX = null;
              await withProfileLock(profX.identity.bid, async () => {
                resX = adminAdjustXp(profX, deltaX, { reason: reasonX, actor: 'owner:chat' });
                if (resX && resX.ok) saveUserProfile(profX);
              });
              if (!resX || !resX.ok) {
                const whyX = { 'no-delta': 'Betrag ungültig.', 'delta-too-big': 'Max. ±10.000.000.', 'reason-too-short': 'Grund zu kurz (min. 5 Zeichen).', 'no-profile': 'Profil fehlt.' }[resX?.reason] || 'Fehlgeschlagen.';
                await sock.sendMessage(from, { text: '> ❌ *Nicht angepasst:* ' + whyX }, { quoted: msg });
                break;
              }
              try { auditAdmin({ actor: 'owner:chat', action: 'xp.adjust', target: profX.identity.bid, delta: deltaX, reason: reasonX.slice(0, 200), levelAfter: resX.after.level, prestigeAfter: resX.after.prestige }); } catch (e) {}
              const nameX = getProfileDisplayName(profX, tX.name || '?');
              await sock.sendMessage(from, {
                text: `> 🛠️ *XP ANGEPASST*\n\n👤 ${nameX}\n${deltaX > 0 ? '+' : ''}${deltaX.toLocaleString('de-DE')} XP _(Grund: ${reasonX.slice(0, 120)})_\n\nVorher: Lv ${resX.before.level} · Σ ${Number(resX.before.totalXp).toLocaleString('de-DE')} XP\nNachher: Lv ${resX.after.level} · Σ ${Number(resX.after.totalXp).toLocaleString('de-DE')} XP${resX.copper ? ` · +${Number(resX.copper).toLocaleString('de-DE')} Kupfer` : ''}\n\n_Rückgängig: ${pref}xprollback @person_`
              }, { quoted: msg });
              break;
            }

            case 'xprollback': {
              /* ↩️ Letztes Admin-Adjust rückgängig (Owner, auditiert) */
              if (!isHost) {
                await sock.sendMessage(from, { text: '> ❌ *Nur der Owner kann XP zurückrollen.*' }, { quoted: msg });
                break;
              }
              const tRawB = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
                || quoted?.extendedTextMessage?.contextInfo?.participant
                || args.find((a) => a.startsWith('@') || /^\d{6,}/.test(a))
                || '';
              if (!tRawB) {
                await sock.sendMessage(from, { text: `> ↩️ *XP-ROLLBACK (Owner)*\n\nNutze: *${pref}xprollback @person*` }, { quoted: msg });
                break;
              }
              const tB = await resolveBanTarget(sock, String(tRawB), sessionPath);
              if (!tB || (!tB.jid && !tB.lid)) {
                await sock.sendMessage(from, { text: '> ❌ *Fehler:* Ziel konnte nicht aufgelöst werden.' }, { quoted: msg });
                break;
              }
              const profB = await loadUserProfileForSender({ jid: tB.jid || '', lid: tB.lid || '' });
              if (!profB?.identity?.bid) {
                await sock.sendMessage(from, { text: '> ❌ Profil nicht gefunden.' }, { quoted: msg });
                break;
              }
              let resB = null;
              await withProfileLock(profB.identity.bid, async () => {
                resB = adminRollbackXp(profB, { actor: 'owner:chat' });
                if (resB && resB.ok) saveUserProfile(profB);
              });
              if (!resB || !resB.ok) {
                await sock.sendMessage(from, { text: '> ℹ️ *Nichts zurückzurollen* — es gab kein Admin-Adjust für dieses Profil (oder es wurde schon zurückgerollt).' }, { quoted: msg });
                break;
              }
              try { auditAdmin({ actor: 'owner:chat', action: 'xp.rollback', target: profB.identity.bid, rolledBack: resB.rolledBack }); } catch (e) {}
              await sock.sendMessage(from, { text: `> ↩️ *XP ZURÜCKGEROLLT*\n\n👤 ${getProfileDisplayName(profB, tB.name || '?')}\nAdjust ${resB.rolledBack > 0 ? '+' : ''}${Number(resB.rolledBack).toLocaleString('de-DE')} XP rückgängig.\nJetzt: Lv ${resB.restored.level} · Σ ${Number(resB.restored.totalXp).toLocaleString('de-DE')} XP\n\n_Hinweis: Inzwischen verdiente Titel/Badges bleiben (nur der XP-Stand wird restauriert)._` }, { quoted: msg });
              break;
            }

            case 'givecoins':
            case 'takecoins': {
              /* 🛠️ Owner-Kupfer-Tools mit Audit + Rollback (Progression 6.0) */
              if (!isHost) {
                await sock.sendMessage(from, { text: '> ❌ *Nur der Owner kann Kupfer anpassen.*' }, { quoted: msg });
                break;
              }
              const negC = command === 'takecoins';
              const tRawC = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
                || quoted?.extendedTextMessage?.contextInfo?.participant
                || args.find((a) => a.startsWith('@') || /^\d{6,}/.test(a))
                || '';
              const amtTokC = args.find((a) => /^-?\d+$/.test(a));
              const vaultC = args.some((a) => String(a).toLowerCase() === 'bank') ? 'bank' : 'wallet';
              const reasonC = args.filter((a) => a !== tRawC && a !== amtTokC && String(a).toLowerCase() !== 'bank').join(' ').trim();
              if (!tRawC || !amtTokC) {
                await sock.sendMessage(from, { text: `> 🛠️ *KUPFER ANPASSEN (Owner)*\n\nNutze: *${pref}${command} @person <anzahl> [bank] <grund, min. 5 Zeichen>*\nRückgängig: *${pref}coinrollback @person*` }, { quoted: msg });
                break;
              }
              if (reasonC.length < 5) {
                await sock.sendMessage(from, { text: '> ❌ *Grund zu kurz* (min. 5 Zeichen).' }, { quoted: msg });
                break;
              }
              const tC2 = await resolveBanTarget(sock, String(tRawC), sessionPath);
              if (!tC2 || (!tC2.jid && !tC2.lid)) {
                await sock.sendMessage(from, { text: '> ❌ *Fehler:* Ziel konnte nicht aufgelöst werden.' }, { quoted: msg });
                break;
              }
              const profC2 = await loadUserProfileForSender({ jid: tC2.jid || '', lid: tC2.lid || '' });
              if (!profC2?.identity?.bid) {
                await sock.sendMessage(from, { text: '> ❌ Profil nicht gefunden.' }, { quoted: msg });
                break;
              }
              const deltaC = (negC ? -1 : 1) * Math.abs(Math.floor(Number(amtTokC)));
              let resC = null;
              await withProfileLock(profC2.identity.bid, async () => {
                resC = adminAdjustCoins(profC2, deltaC, { reason: reasonC, actor: 'owner:chat', vault: vaultC });
                if (resC && resC.ok) saveUserProfile(profC2);
              });
              if (!resC || !resC.ok) {
                const whyC = { 'invalid': 'Betrag ungültig.', 'insufficient': 'Nicht genug Guthaben.', 'overflow': 'Über dem Sicherheits-Cap.', 'no-profile': 'Profil fehlt.' }[resC?.reason] || 'Fehlgeschlagen.';
                await sock.sendMessage(from, { text: '> ❌ *Nicht angepasst:* ' + whyC }, { quoted: msg });
                break;
              }
              try { auditAdmin({ actor: 'owner:chat', action: 'coins.adjust', target: profC2.identity.bid, delta: deltaC, vault: vaultC, reason: reasonC.slice(0, 200) }); } catch (e) {}
              const nameC2 = getProfileDisplayName(profC2, tC2.name || '?');
              await sock.sendMessage(from, {
                text: `> 🛠️ *KUPFER ANGEPASST*\n\n👤 ${nameC2}\n${deltaC > 0 ? '+' : ''}${deltaC.toLocaleString('de-DE')} Kupfer → *${vaultC}* _(Grund: ${reasonC.slice(0, 120)})_\n\nVorher: ${Number(resC.before).toLocaleString('de-DE')} · Nachher: *${Number(resC.after).toLocaleString('de-DE')}*\n\n_Rückgängig: ${pref}coinrollback @person_`
              }, { quoted: msg });
              break;
            }

            case 'coinrollback': {
              /* ↩️ Letztes Kupfer-Adjust rückgängig (Owner, auditiert) */
              if (!isHost) {
                await sock.sendMessage(from, { text: '> ❌ *Nur der Owner kann Kupfer zurückrollen.*' }, { quoted: msg });
                break;
              }
              const tRawCR = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
                || quoted?.extendedTextMessage?.contextInfo?.participant
                || args.find((a) => a.startsWith('@') || /^\d{6,}/.test(a))
                || '';
              if (!tRawCR) {
                await sock.sendMessage(from, { text: `> ↩️ *COIN-ROLLBACK (Owner)*\n\nNutze: *${pref}coinrollback @person*` }, { quoted: msg });
                break;
              }
              const tCR = await resolveBanTarget(sock, String(tRawCR), sessionPath);
              if (!tCR || (!tCR.jid && !tCR.lid)) {
                await sock.sendMessage(from, { text: '> ❌ *Fehler:* Ziel konnte nicht aufgelöst werden.' }, { quoted: msg });
                break;
              }
              const profCR = await loadUserProfileForSender({ jid: tCR.jid || '', lid: tCR.lid || '' });
              if (!profCR?.identity?.bid) {
                await sock.sendMessage(from, { text: '> ❌ Profil nicht gefunden.' }, { quoted: msg });
                break;
              }
              let resCR = null;
              await withProfileLock(profCR.identity.bid, async () => {
                resCR = coinRollback(profCR);
                if (resCR && resCR.ok) saveUserProfile(profCR);
              });
              if (!resCR || !resCR.ok) {
                await sock.sendMessage(from, { text: '> ℹ️ *Nichts zurückzurollen* — es gab kein Kupfer-Adjust für dieses Profil (oder es wurde schon zurückgerollt).' }, { quoted: msg });
                break;
              }
              try { auditAdmin({ actor: 'owner:chat', action: 'coins.rollback', target: profCR.identity.bid, restored: resCR.restored }); } catch (e) {}
              await sock.sendMessage(from, { text: `> ↩️ *KUPFER ZURÜCKGEROLLT*\n\n👤 ${getProfileDisplayName(profCR, tCR.name || '?')}\nStand wiederhergestellt: *${Number(resCR.restored).toLocaleString('de-DE')}* Kupfer.` }, { quoted: msg });
              break;
            }

            case 'unlockach':
            case 'unlockachievement': {
              /* 🔓 Achievement manuell vergeben (Owner, auditiert) */
              if (!isHost) {
                await sock.sendMessage(from, { text: '> ❌ *Nur der Owner kann Achievements vergeben.*' }, { quoted: msg });
                break;
              }
              const tRawA = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
                || quoted?.extendedTextMessage?.contextInfo?.participant
                || args.find((a) => a.startsWith('@') || /^\d{6,}/.test(a))
                || '';
              const idA = args.filter((a) => a !== tRawA).join(' ').trim();
              if (!tRawA || !idA) {
                await sock.sendMessage(from, { text: `> 🔓 *ACHIEVEMENT VERGEBEN (Owner)*\n\nNutze: *${pref}unlockach @person <achievement-id>*` }, { quoted: msg });
                break;
              }
              const tA = await resolveBanTarget(sock, String(tRawA), sessionPath);
              if (!tA || (!tA.jid && !tA.lid)) {
                await sock.sendMessage(from, { text: '> ❌ *Fehler:* Ziel konnte nicht aufgelöst werden.' }, { quoted: msg });
                break;
              }
              const profA = await loadUserProfileForSender({ jid: tA.jid || '', lid: tA.lid || '' });
              if (!profA?.identity?.bid) {
                await sock.sendMessage(from, { text: '> ❌ Profil nicht gefunden.' }, { quoted: msg });
                break;
              }
              const resA = unlockAchievementFor(profA.identity.bid, idA);
              if (!resA.ok) {
                const whyA = { 'unknown-id': 'Unbekannte Achievement-ID.', 'already-unlocked': 'Bereits freigeschaltet.' }[resA.reason] || 'Fehlgeschlagen.';
                await sock.sendMessage(from, { text: '> ❌ *Nicht vergeben:* ' + whyA }, { quoted: msg });
                break;
              }
              try { auditAdmin({ actor: 'owner:chat', action: 'achievement.unlock', target: profA.identity.bid, achievement: resA.achievement.id }); } catch (e) {}
              await sock.sendMessage(from, { text: `> 🔓 *ACHIEVEMENT VERGEBEN*\n\n👤 ${getProfileDisplayName(profA, tA.name || '?')}\n${resA.achievement.emoji || '🏆'} *${resA.achievement.name}* — _${resA.achievement.desc || ''}_` }, { quoted: msg });
              break;
            }

            case 'notif':
            case 'notifications': {
              /* 🔔 Benachrichtigungs-Einstellungen anzeigen / umschalten */
              userProfile = userProfile || { identity: { bid: '' } };
              const argN = (args[0] || '').toLowerCase();
              const setN = args.slice(1).join(' ').toLowerCase();
              if (argN) {
                const known = NOTIF_TYPES.find((t) => t.id === argN || t.label.toLowerCase().includes(argN));
                if (!known) {
                  await sock.sendMessage(from, { text: `> ❌ Unbekannter Typ. Verfügbar: ${NOTIF_TYPES.map((t) => t.id).join(', ')}` }, { quoted: msg });
                  break;
                }
                if (setN === 'an' || setN === 'on' || setN === 'ja') known._set = true;
                else if (setN === 'aus' || setN === 'off' || setN === 'nein') known._set = false;
                else if (!setN) known._set = !(userProfile.notifications?.[known.id] !== undefined ? userProfile.notifications[known.id] : known.default);
                else { await sock.sendMessage(from, { text: `> ❌ Nutzung: ${pref}notif <typ> [an|aus]` }, { quoted: msg }); break; }
                updatePrefs(userProfile, { [known.id]: known._set });
                saveUserProfile(userProfile);
                await sock.sendMessage(from, { text: `> 🔔 *${known.label}* → ${known._set ? '🟢 AN' : '⚫ AUS'}` }, { quoted: msg });
                break;
              }
              const prefsN = userProfile.notifications || {};
              const rowsN = NOTIF_TYPES.map((t) => {
                const on = prefsN[t.id] !== undefined ? prefsN[t.id] : t.default;
                return `${on ? '☑' : '☐'} *${t.label}* — ${pref}notif ${t.id} ${on ? 'aus' : 'an'}`;
              }).join('\n');
              await sock.sendMessage(from, {
                text: `> 🔔 *BENACHRICHTIGUNGEN*\n\n${rowsN}\n\n💡 _Auch auf der Website: /notifications.html (nach Login)._`
              }, { quoted: msg });
              break;
            }

            case 'rank':
            case 'rang': {
              /* 🏅 Rang zeigen: $rank [weekly|monthly|group] [@user] — mit Wochen-Snapshot & Trend (5.0) */
              const rankArgs = [...args];
              let rankMode = 'global';
              const modeWord = String(rankArgs[0] || '').toLowerCase();
              if (['weekly', 'week', 'woche'].includes(modeWord)) { rankMode = 'weekly'; rankArgs.shift(); }
              else if (['monthly', 'month', 'monat'].includes(modeWord)) { rankMode = 'monthly'; rankArgs.shift(); }
              else if (['group', 'gruppe'].includes(modeWord)) { rankMode = 'group'; rankArgs.shift(); }
              const rankMe = !rankArgs[0];
              let rankProfile = userProfile;
              let rankName = getProfileDisplayName(userProfile || {}, msg.pushName || cleanId(senderJid));
              if (!rankMe) {
                const tR = await resolveBanTarget(sock, rankArgs, sessionPath);
                if (!tR || (!tR.jid && !tR.lid)) {
                  await sock.sendMessage(from, { text: '> ❌ *Fehler:* Ziel konnte nicht aufgelöst werden. Nutze *' + pref + 'rank [weekly|monthly|group] @person*.' }, { quoted: msg });
                  break;
                }
                rankProfile = await loadUserProfileForSender({ jid: tR.jid || '', lid: tR.lid || '' });
                rankName = getProfileDisplayName(rankProfile || {}, tR.name || cleanId(tR.jid || tR.lid));
              }
              if (!rankProfile) {
                await sock.sendMessage(from, { text: '> ☾ kein profil gefunden. die nacht vergisst niemand — aber dieses hier ist leer.' }, { quoted: msg });
                break;
              }
              const rankUsersR = readDb().users || {};
              const rankBidR = rankProfile?.identity?.bid || '';
              let rankPosR = { pos: null, total: 0 };
              let rankLabelR = '📍 Global';
              if (rankMode === 'weekly') { rankPosR = rankBidR ? weeklyRank(rankUsersR, rankBidR) : rankPosR; rankLabelR = '📍 Woche (7d XP)'; }
              else if (rankMode === 'monthly') { rankPosR = rankBidR ? monthlyRank(rankUsersR, rankBidR) : rankPosR; rankLabelR = '📍 Monat (30d XP)'; }
              else if (rankMode === 'group') {
                if (!isGroup || !groupMetadata) {
                  await sock.sendMessage(from, { text: '> 👥 *Gruppen-Rang* geht nur in einer Gruppe.' }, { quoted: msg });
                  break;
                }
                const memberNumsR = new Set((groupMetadata.participants || []).map((pt) => cleanId(pt.id || pt.jid || '')));
                const memberBidsR = Object.keys(rankUsersR).filter((b) => {
                  const mm = /^(\d*)jid(\d*)lid$/.exec(String(b || ''));
                  return !!mm && ((mm[1] && memberNumsR.has(mm[1])) || (mm[2] && memberNumsR.has(mm[2])));
                });
                rankPosR = rankBidR ? groupRank(rankUsersR, rankBidR, memberBidsR) : rankPosR;
                rankLabelR = '📍 Gruppe';
              } else {
                rankPosR = rankBidR ? cachedGlobalRank(rankUsersR, rankBidR) : rankPosR;
              }
              /* 📈 Wochen-Snapshot nur für den eigenen globalen Rang (Trend braucht echte Vorwerte) */
              let rankTrendR = '';
              if (rankMe && rankMode === 'global' && rankPosR.pos && userProfile) {
                try {
                  const snap = snapshotRank(userProfile, rankPosR.pos, rankPosR.total);
                  saveUserProfile(userProfile);
                  if (snap && snap.delta) rankTrendR = snap.delta > 0 ? ` 📈 (+${snap.delta})` : ` 📉 (${snap.delta})`;
                } catch (e) {}
              }
              const rankProgrR = rankProfile?.progression || {};
              const rankTitleR = rankProgrR.title || titleFor(rankProgrR.level || 0);
              await sock.sendMessage(from, { text: rankLine(rankProfile, rankName) +
                (rankPosR.pos ? `\n${rankLabelR}: *#${rankPosR.pos}* von ${rankPosR.total}${rankTrendR}` : `\n${rankLabelR}: *noch unplatziert* — chatte los! 💜`) +
                `\n📛 Titel: ${rankTitleR.emoji} *${rankTitleR.name}*` +
                `\nΣ Lifetime: *${Number(rankProgrR.totalXp || 0).toLocaleString('de-DE')}* XP` + '\n\n♡ rank is earned, not given.' }, { quoted: msg });
              await sendReaction(sock, from, '🏅', msg.key);
              break;
            }

            case 'leaderboard':
            case 'lb':
            case 'rangliste':
            case 'top': {
              /* 🏆 Leaderboard mit Filtern: $top [level|xp|weekly|monthly|group] + eigener Platz */
              const dbL = readDb();
              const usersL = dbL.users || {};
              const modeL = String(args[0] || 'level').toLowerCase();
              let rowsL = [];
              let titleL = '> 🏆 *LOVE-LEADERBOARD*';
              let valL = (u) => `${u.prestige > 0 ? `P${u.prestige} · ` : ''}Lv ${u.level} · ${u.rankFull}`;
              if (modeL === 'xp' || modeL === 'lifetime') {
                rowsL = topProgression(usersL, 50).sort((a, b) => b.totalXp - a.totalXp).slice(0, 10);
                titleL = '> 🏆 *TOP XP — LIFETIME*';
                valL = (u) => `Σ ${Number(u.totalXp).toLocaleString('de-DE')} XP · Lv ${u.level}`;
              } else if (modeL === 'weekly' || modeL === 'week' || modeL === 'woche') {
                rowsL = topProgression(usersL, 50)
                  .map((u) => ({ ...u, per: xpPeriods(usersL[u.bid] || {}).week }))
                  .filter((u) => u.per > 0).sort((a, b) => b.per - a.per).slice(0, 10);
                titleL = '> 🏆 *TOP WOCHE* — XP der letzten 7 Tage';
                valL = (u) => `+${Number(u.per).toLocaleString('de-DE')} XP (7d) · Lv ${u.level}`;
              } else if (modeL === 'monthly' || modeL === 'month' || modeL === 'monat') {
                rowsL = topProgression(usersL, 50)
                  .map((u) => ({ ...u, per: xpPeriods(usersL[u.bid] || {}).month }))
                  .filter((u) => u.per > 0).sort((a, b) => b.per - a.per).slice(0, 10);
                titleL = '> 🏆 *TOP MONAT* — XP der letzten 30 Tage';
                valL = (u) => `+${Number(u.per).toLocaleString('de-DE')} XP (30d) · Lv ${u.level}`;
              } else if (modeL === 'group' || modeL === 'gruppe') {
                if (!isGroup || !groupMetadata) {
                  await sock.sendMessage(from, { text: '> 👥 *Gruppen-Top* geht nur in einer Gruppe.' }, { quoted: msg });
                  break;
                }
                const memberNumsL = new Set((groupMetadata.participants || []).map((pt) => cleanId(pt.id || pt.jid || '')));
                const inGroupL = (bid) => {
                  const mm = /^(\d*)jid(\d*)lid$/.exec(String(bid || ''));
                  if (!mm) return false;
                  return ((mm[1] && memberNumsL.has(mm[1])) || (mm[2] && memberNumsL.has(mm[2]))) || false;
                };
                rowsL = topProgression(usersL, 50).filter((u) => inGroupL(u.bid)).slice(0, 10);
                titleL = '> 🏆 *GRUPPEN-TOP* — XP ist global, die Rangliste lokal 😉';
              } else if (modeL === 'coins' || modeL === 'kupfer' || modeL === 'rich' || modeL === 'geld') {
                await sock.sendMessage(from, {
                  text: buildTopCoins(usersL, { n: 10, myBid: userProfile?.identity?.bid || '', pref })
                }, { quoted: msg });
                break;
              } else {
                rowsL = topProgression(usersL, 10);
              }
              if (!rowsL.length) {
                await sock.sendMessage(from, { text: '☾ leaderboard is empty.\nnobody is awake yet.' }, { quoted: msg });
                break;
              }
              const medalsL = ['👑', '', '💜'];
              let ownRankL = '';
              if (userProfile?.identity?.bid) {
                const grL = cachedGlobalRank(usersL, userProfile.identity.bid);
                if (grL.pos) ownRankL = `\n\n📍 *Dein Platz:* #${grL.pos} von ${grL.total}`;
              }
              await sock.sendMessage(from, {
                text: titleL + '\n\n' + rowsL.map((u, i) =>
                  `${medalsL[i] || '•'} *${i + 1}.* ${u.name} — ${valL(u)}`
                ).join('\n') + ownRankL + '\n\n💡 _Filter: $top xp · weekly · monthly · group · coins_\n♡ stay a little longer.'
              }, { quoted: msg });
              break;
            }

            case 'daily': {
              /* 📅 UNIFIED DAILY (6.0): Kupfer-Serie (Streak, Boni, Meilensteine) + XP.
                 Vereint das alte XP-Daily mit dem Kupfer-Daily (das zweite
                 `case 'daily'` war toter Code — erstes Match gewinnt im Switch). */
              if (!userProfile) {
                await sock.sendMessage(from, { text: '> ❌ Profil nicht verfügbar.' }, { quoted: msg });
                break;
              }
              const todayD = new Date().toISOString().slice(0, 10);
              let claimD = null;
              await withProfileLock(userProfile?.identity?.bid || '', async () => {
                claimD = claimDaily(userProfile, {});
              });
              if (!claimD || !claimD.ok) {
                await sock.sendMessage(from, { text: buildDailySummary(userProfile, { claim: claimD, pref }) }, { quoted: msg });
                break;
              }
              /* XP-Anteil (wie bisher aus categories.daily) — Legacy-Schutz:
                 wer das alte XP-Daily heute schon holte, bekommt nur Kupfer. */
              const progD = ensureProgression(userProfile);
              const legacyDoneD = progD.lastDaily === todayD;
              progD.lastDaily = todayD;
              let dailyRes = { granted: 0, events: [] };
              if (!legacyDoneD) {
                const dailyRules = xpRules().categories?.daily || {};
                const dailyAmt = Number(dailyRules.daily) || 50;
                dailyRes = grantLevelXp(userProfile, dailyRules.enabled === false ? 0 : dailyAmt, { source: 'dailies' });
              }
              ensureStats(userProfile).dailiesClaimed += 1; /* 📊 Progression 4.0 */
              saveUserProfile(userProfile);
              try { notifyLove(userProfile?.identity?.bid || '', 'daily', { title: `📅 Daily gesammelt: +${claimD.amount} Kupfer`, text: `Serie ${claimD.streak} Tage · Level ${progD.level}`, link: '/account.html' }, userProfile); } catch (e) {}
              const dailyNameD = getProfileDisplayName(userProfile, msg.pushName || cleanId(senderJid));
              if (dailyRes.events?.length) {
                await sendLevelUpAnnouncement(sock, from, msg, {
                  profile: userProfile, name: dailyNameD, events: dailyRes.events, isGroup,
                  mentionJid: msg.key?.participant || senderLid || senderJid || null
                });
              }
              await sock.sendMessage(from, {
                text: buildDailySummary(userProfile, { claim: claimD, xpGranted: dailyRes.granted || 0, pref })
              }, { quoted: msg });
              await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              break;
            }

            case 'streak': {
              await sock.sendMessage(from, {
                text: buildStreakCard(userProfile || {}) + '\n\n☾ consistency is a love language.'
              }, { quoted: msg });
              break;
            }

            case 'achievements': {
              /* 🏆 Echte Achievements aus loveplus (128 Stück, Kategorien + Fortschritt) */
              await handleLovePlus({
                sock, msg, from, args, command: 'achievements', pref, quoted, sessionPath,
                senderJid, senderLid, userProfile, groupProfile, isGroup, isHost,
                helpers: lovePlusHelpers(userProfile)
              });
              break;
            }

            case 'badges': {
              /* 🏅 Eigene Badge-Vitrine (Progression 4.0) */
              let achCountB = 0;
              try { achCountB = socialCounters(userProfile || {}).achievements || 0; } catch (e) {}
              await sock.sendMessage(from, {
                text: buildBadgeShowcase(userProfile || {}, achCountB)
              }, { quoted: msg });
              break;
            }

            case 'title': {
              const subT = String(args[0] || '').toLowerCase();
              /* 📛 Verdienten Titel wählen (Progression 4.0) */
              if (subT === 'use' || subT === 'wählen' || subT === 'waehlen') {
                const wantT = args.slice(1).join(' ').trim();
                if (!wantT) {
                  await sock.sendMessage(from, { text: `> 📛 *Titel wählen*\n\nNutze: *${pref}title use <name>*\nDeine verdienten Titel: *${pref}title*` }, { quoted: msg });
                  break;
                }
                let achCountT = 0;
                try { achCountT = socialCounters(userProfile || {}).achievements || 0; } catch (e) {}
                const resT = setActiveTitle(userProfile || {}, wantT, { achCount: achCountT });
                if (!resT.ok) {
                  await sock.sendMessage(from, { text: `> ❌ *Diesen Titel hast du noch nicht verdient.*\n\nDeine Titel: ${(resT.earned || []).join(', ') || '—'}\nLevel up für mehr! 💜` }, { quoted: msg });
                  break;
                }
                saveUserProfile(userProfile);
                await sock.sendMessage(from, { text: `> 📛 Aktiver Titel: ${resT.title.emoji} *${resT.title.name}*` }, { quoted: msg });
                break;
              }
              /* 📛 Zum höchsten verdienten Titel zurück */
              if (subT === 'clear' || subT === 'reset') {
                const pT = ensureProgression(userProfile || {});
                const topT = titleFor(pT.level || 0);
                pT.title = { min: topT.min, emoji: topT.emoji, name: topT.name };
                pT.activeTitle = { ...pT.title };
                saveUserProfile(userProfile);
                await sock.sendMessage(from, { text: `> 📛 Titel zurückgesetzt: ${topT.emoji} *${topT.name}*` }, { quoted: msg });
                break;
              }
              /* 📛 Übersicht: verdiente Titel + Custom-Titel */
              if (!args.length) {
                const dbT0 = readDb();
                const bidT0 = userProfile?.identity?.bid || cleanId(senderJid);
                const customT = dbT0.users?.[bidT0]?.identity?.title || '—';
                let achCountT0 = 0;
                try { achCountT0 = socialCounters(userProfile || {}).achievements || 0; } catch (e) {}
                await sock.sendMessage(from, { text: buildTitleOverview(userProfile || {}, achCountT0) + `\n\n🏷️ *Custom-Titel:* ${customT}\n\n💡 _${pref}title use <name> → Titel wählen_\n_${pref}title <text> → Custom-Titel setzen_` }, { quoted: msg });
                break;
              }
              /* 🏷️ Custom-Titel setzen (wie bisher — bleibt erhalten) */
              const dbT = readDb();
              const bidT = userProfile?.identity?.bid || cleanId(senderJid);
              if (!dbT.users[bidT]) dbT.users[bidT] = { identity: { bid: bidT } };
              dbT.users[bidT].identity = dbT.users[bidT].identity || {};
              const newTitle = args.join(' ').slice(0, 30);
              writeDb(dbT);
              await sock.sendMessage(from, { text: `> 🏷️ Titel gesetzt: *${newTitle}*\n\n☾ wear it well.` }, { quoted: msg });
              break;
            }

            /* ══════════════════════════════════════════ */
            /* 💜 PROGRESSION 4.0: Fortschritt & Account      */
            /* ══════════════════════════════════════════ */
            case 'progress':
            case 'fortschritt': {
              const bidP = userProfile?.identity?.bid || '';
              let rankPosP = null, rankTotalP = 0;
              try {
                const rP = bidP ? cachedGlobalRank(readDb().users || {}, bidP) : null;
                if (rP && rP.pos) { rankPosP = rP.pos; rankTotalP = rP.total; }
              } catch (e) {}
              await sock.sendMessage(from, { text: buildProgress(userProfile || {}, { rankPos: rankPosP, rankTotal: rankTotalP }) }, { quoted: msg });
              await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              break;
            }

            case 'activity':
            case 'aktivitaet':
            case 'aktivität': {
              await sock.sendMessage(from, { text: buildActivity(userProfile || {}) }, { quoted: msg });
              await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              break;
            }

            case 'records':
            case 'rekorde': {
              await sock.sendMessage(from, { text: buildRecords(userProfile || {}) }, { quoted: msg });
              await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              break;
            }

            case 'milestones':
            case 'meilensteine': {
              await sock.sendMessage(from, { text: buildMilestones(userProfile || {}) }, { quoted: msg });
              await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
              break;
            }

            case 'unregister':
            case 'abmelden':
            case 'deleteme': {
              /* 🗑️ Self-Service-Löschung: Warnung → Code → Confirm → weg (+ Backup).
                 Owner kann sich nicht löschen; Restore nur für den Owner. */
              const bidU = userProfile?.identity?.bid || '';
              const subU = String(args[0] || '').toLowerCase();
              if (subU === 'restore') {
                if (!isHost) {
                  await sock.sendMessage(from, { text: '> ❌ *Nur der Owner kann Backups wiederherstellen.*' }, { quoted: msg });
                  break;
                }
                const listU = listUnregisterBackups(5);
                const wantU = args[1] || '';
                if (!wantU) {
                  await sock.sendMessage(from, { text: '> 💾 *UNREGISTER-BACKUPS*\n\n' + (listU.length ? listU.map((b) => `• \`${b.id}\``).join('\n') : '_Keine Backups vorhanden._') + `\n\nNutze: *${pref}unregister restore <dateiname>*` }, { quoted: msg });
                  break;
                }
                const resU = restoreUnregister(wantU, { actor: 'owner' });
                await sock.sendMessage(from, { text: resU.ok
                  ? `> ✅ *Backup wiederhergestellt.*\n\nWiederhergestellt: ${Object.entries(resU.restored || {}).map(([k, v]) => `${k}: ${v}`).join(', ') || '—'}${(resU.skipped || []).length ? `\nÜbersprungen (existiert neu): ${(resU.skipped || []).join(', ')}` : ''}`
                  : '> ❌ *Wiederherstellung fehlgeschlagen.* (' + (resU.reason || '?') + ')' }, { quoted: msg });
                break;
              }
              if (subU === 'cancel' || subU === 'abbruch' || subU === 'abbrechen' || subU === 'stop' || subU === 'nein') {
                const cU = cancelUnregister(bidU);
                await sock.sendMessage(from, { text: cU.ok ? '> ✅ *Löschung abgebrochen.*\n\nDeine Daten bleiben vollständig erhalten. 💜' : '> ℹ️ *Es läuft keine Löschung.*' }, { quoted: msg });
                break;
              }
              if (subU === 'confirm' || subU === 'bestätigen' || subU === 'bestaetigen' || subU === 'ja') {
                if (!userProfile) {
                  await sock.sendMessage(from, { text: '> ❌ Profil nicht verfügbar.' }, { quoted: msg });
                  break;
                }
                const rU = confirmUnregister(userProfile, { code: String(args[1] || ''), phrase: args.slice(2).join(' '), actor: 'self:' + bidU });
                if (rU.ok) {
                  const dU = rU.deleted || {};
                  await sock.sendMessage(from, { text: `> 🗑️ *ACCOUNT GELÖSCHT*\n\nDein Profil, ${dU.plusCouples || 0} Couple-Einträge, ${dU.warns || 0} Verwarnungen, ${dU.sessions || 0} Web-Sessions und alle Fortschritte wurden entfernt.\n\n💜 _Schade, dass du gehst — ${pref}register bringt dich jederzeit zurück (als frischer Start)._\n\n🔒 _Sicherungs-Backup beim Owner, Bans/Gruppen-Config bleiben aus Sicherheitsgründen._` }, { quoted: msg });
                  await sendReaction(sock, from, '🗑️', msg.key);
                  console.log(c.bold + c.brightYellow + '[unregister] Account gelöscht: ' + bidU + c.reset);
                  break;
                }
                const reasonU = { none: 'Es läuft keine Löschung — starte mit *' + pref + 'unregister*.', expired: 'Der Code ist *abgelaufen* — fordere mit *' + pref + 'unregister* einen neuen an.', 'bad-code': 'Falscher Code. Prüfe die Ziffern aus der Warnung.', 'bad-phrase': 'Doppelbestätigung fehlt: *' + pref + 'unregister confirm <code> LÖSCHEN*' }[rU.reason] || 'Fehlgeschlagen.';
                await sock.sendMessage(from, { text: '> ❌ *Löschung NICHT bestätigt.*\n\n' + reasonU }, { quoted: msg });
                break;
              }
              const pendU = getPendingInfo(bidU);
              if (pendU) {
                const minU = Math.max(1, Math.ceil((pendU.expiresAt - Date.now()) / 60000));
                await sock.sendMessage(from, { text: `> ⏳ *LÖSCHUNG LÄUFT* (noch ~${minU} Min)\n\nBestätigen: *${pref}unregister confirm <code>${pendU.requiresPhrase ? ' LÖSCHEN' : ''}*\nAbbrechen: *${pref}unregister cancel*` }, { quoted: msg });
                break;
              }
              const sU = startUnregister(userProfile || {}, { isOwner: isHost, isAdmin: false });
              if (!sU.ok) {
                const noU = { 'no-profile': '> ❌ Profil nicht verfügbar.', 'not-registered': `> ℹ️ *Du bist nicht registriert* — es gibt nichts zu löschen.\n\n💡 _Fortschritte sammelst du trotzdem; ${pref}register legt dein Profil an._`, 'owner-blocked': '> 👑 *Der Owner-Account kann sich nicht selbst löschen.*\n\nNotfall nur direkt über die Server-Dateien.' }[sU.reason] || '> ❌ Start fehlgeschlagen.';
                await sock.sendMessage(from, { text: noU }, { quoted: msg });
                break;
              }
              const pvU = sU.preview || {};
              const minSU = Math.max(1, Math.ceil((sU.expiresAt - Date.now()) / 60000));
              await sock.sendMessage(from, { text:
                `> ⚠️ *ACCOUNT WIRKLICH LÖSCHEN?* ⚠️\n\n` +
                `Das wird *unwiderruflich* entfernt:\n` +
                `• 👤 Profil & Registrierung\n` +
                `• ⭐ Level, XP, Streaks, Rekorde\n` +
                `• 🏆 ${pvU.plusUser ? 'Achievements' : '—'}, 🏅 Badges, 📛 Titel\n` +
                `• 🪙 Kupfer: Wallet (${Number(pvU.wallet || 0).toLocaleString('de-DE')}) · Bank (${Number(pvU.bank || 0).toLocaleString('de-DE')}) · Transaktionen (${pvU.tx || 0})\n` +
                `• 📦 Inventar-Items (${pvU.inventory || 0}) · 🔥 Daily-Rekord (${pvU.dailyBest || 0} Tage)\n` +
                `• 💑 Couple-Einträge (${pvU.plusCouples || 0})${pvU.married ? ' — _Partner wird Single_' : ''}\n` +
                `• ⚠️ Verwarnungen (${pvU.warns || 0}) · 💤 AFK (${pvU.afk || 0})\n` +
                `• 🖥️ Web-Sessions (${pvU.sessions || 0})\n` +
                `• 🧾 Progression-Events (werden anonymisiert)\n\n` +
                `Das *bleibt*: Bans/Mod-Logs, Gruppen-Einstellungen, Owner-Backup (nur Restore).\n\n` +
                `🔢 *Dein Code:* \`${sU.code}\` _(⏳ ${minSU} Min gültig)_\n\n` +
                `Bestätigen: *${pref}unregister confirm ${sU.code}${sU.requiresPhrase ? ' LÖSCHEN' : ''}*\n` +
                `Abbrechen: *${pref}unregister cancel*\n\n` +
                `_Nur du kannst das — niemand sonst. Bei Bot-Neustart bricht die Löschung automatisch ab._`
              }, { quoted: msg });
              console.log(c.bold + c.brightYellow + '[unregister] Warnung + Code an ' + bidU + c.reset);
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

            /* 💜 7.0: Labels 'groupinfo'/'admins' sind toter Alt-Code (live: Cases 8755/9278);
               'members' lebt jetzt im 7.0-Block (Mitgliederliste). */
            case 'groupinfo':
            case 'admins': {
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
                footerText: '🌹 LoveBot by Maxichen 2026 · maxichen.gamebot.me',
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
              /* 💜 Progression 2.0: Social XP Layer — Empfänger +5, Sender +8,
                 Social Bond +1, mit Cooldown + Anti-Mutual-Farm. */
              try {
                if (userProfile && xpEligible(userProfile)) {
                  let compTargetProfile = null;
                  if (!isSelf) {
                    compTargetProfile = await loadUserProfileForSender({ jid: compMention?.endsWith('@s.whatsapp.net') ? compMention : '', lid: String(compMention || '').endsWith('@lid') ? compMention : '' });
                  }
                  const compRes = applyComplimentXp(userProfile, compTargetProfile || userProfile, {});
                  saveUserProfile(userProfile);
                  if (compTargetProfile && !isSelf) saveUserProfile(compTargetProfile);
                  if (compRes.senderXp || compRes.recipientXp) {
                    await sock.sendMessage(from, {
                      text: `\n💜 *SOCIAL XP*\n• ${isSelf ? 'Selbstliebe' : 'Empfängerin'}: +${compRes.recipientXp} XP${compRes.bond ? ' · ❤️ Bond +1' : ''}\n• Du: +${compRes.senderXp} XP`
                    }, { quoted: msg });
                  }
                  /* 🎉 Level-Ups aus Social-XP ankündigen — Sender UND Empfänger (je mit Mention) */
                  if (compRes.senderEvents?.length) {
                    await sendLevelUpAnnouncement(sock, from, msg, {
                      profile: userProfile, name: getProfileDisplayName(userProfile, msg.pushName || cleanId(senderJid)),
                      events: compRes.senderEvents, isGroup,
                      mentionJid: msg.key?.participant || senderLid || senderJid || null
                    });
                  }
                  if (!isSelf && compTargetProfile && compRes.recipientEvents?.length) {
                    await sendLevelUpAnnouncement(sock, from, msg, {
                      profile: compTargetProfile, name: getProfileDisplayName(compTargetProfile, cleanId(compMention)),
                      events: compRes.recipientEvents, isGroup, mentionJid: compMention || null
                    });
                  }
                  if (compRes.farmSuspect) {
                    /* Anti-Farm: Muster im Bot-Log + XP-Event (Owner sieht es im Abuse-Center) */
                    try { const { emit } = await import('./loveengine.js'); emit('XP_GRANTED', { bid: userProfile?.identity?.bid || '', source: 'compliment-farm-suspect', granted: 0, reason: 'mutual-farm-pattern' }); } catch (e) {}
                    console.log(c.yellow + '[compliment] Mutual-Farm-Muster erkannt (Sender: ' + cleanId(senderJid) + ')' + c.reset);
                  }
                }
              } catch (compXpErr) { /* XP darf nie den Befehl brechen */ }
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
              addWalletCoins(userProfile, { copper: earned }, { source: 'work', reason: task.job });
              if (!userProfile.rewards) userProfile.rewards = {};
              userProfile.rewards.lastWorkAt = new Date().toISOString();
              let workXpLine = '';
              try {
                const workXpRes = grantLevelXp(userProfile, 10, { source: 'work' });
                if (workXpRes.events?.length) {
                  const workPrestige = workXpRes.events.some((e) => e.type === 'prestige');
                  await sendLevelUpAnnouncement(sock, from, msg, {
                    profile: userProfile, name: getProfileDisplayName(userProfile, msg.pushName || cleanId(senderJid)),
                    events: workXpRes.events, isGroup,
                    mentionJid: msg.key?.participant || senderLid || senderJid || null
                  });
                  workXpLine = workPrestige ? '\n✨ *PRESTIGE UP!* 👆' : '\n🎉 *LEVEL UP!* 👆';
                }
              } catch (workXpErr) {}
              ensureStats(userProfile).workClaimed += 1; /* 📊 Progression 4.0 */
              saveUserProfile(userProfile);
              await sock.sendMessage(from, {
                text: `> 💼 *ARBEITEN*\n\n${task.job}\n\n• 🤎 *+${earned} Kupfer*\n• 💜 *+10 XP*${workXpLine}\n💰 *Wallet:* ${walletText(userProfile)}`
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
                addWalletCoins(userProfile, { copper: bet }, { source: 'gamble', reason: 'Gewinn' });
                await sock.sendMessage(from, {
                  text: `> 🎰 *GAMBLE — GEWONNEN!* 🎉\n\n• 🤎 *+${bet} Kupfer* (${bet} → ${bet * 2})\n💰 *Wallet:* ${walletText(userProfile)}`
                }, { quoted: msg });
                await sendReaction(sock, from, '🎉', msg.key);
              } else {
                addWalletCoins(userProfile, { copper: -bet }, { source: 'gamble', reason: 'Verlust' });
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
                text: `> 💰 *LOVE BOT — WALLET*\n\n${walletText(userProfile)}\n${buildPeriodsLine(userProfile || {})}\n\n` +
                  `💡 Verdienen: *${pref}daily*, *${pref}work*, *${pref}gamble* · Übersicht: *${pref}economy*`
              }, { quoted: msg });
              await sendReaction(sock, from, '💰', msg.key);
              break;
            }

            case 'bank': {
              /* 🏦 Bank: Karte oder Zinsen abholen */
              if (!userProfile) {
                await sock.sendMessage(from, { text: '> ❌ Profil nicht verfügbar.' }, { quoted: msg });
                break;
              }
              const subB = String(args[0] || '').toLowerCase();
              if (subB === 'claim' || subB === 'zinsen' || subB === 'abholen') {
                let resB = null;
                await withProfileLock(userProfile?.identity?.bid || '', async () => {
                  resB = claimInterest(userProfile, {});
                  if (resB && resB.ok) saveUserProfile(userProfile);
                });
                if (!resB || !resB.ok) {
                  if (resB && resB.reason === 'cooldown') {
                    const waitH = Math.floor(resB.waitMs / 3600000);
                    const waitM = Math.round((resB.waitMs % 3600000) / 60000);
                    await sock.sendMessage(from, { text: `> ⏳ *Zinsen laufen noch.*\n\nNächste Gutschrift in *${waitH} Std. ${waitM} Min.* 📈` }, { quoted: msg });
                  } else if (resB && resB.reason === 'empty-bank') {
                    await sock.sendMessage(from, { text: `> 🏦 *Leeres Konto.*\n\nZahle erst ein: *${pref}deposit <betrag>*` }, { quoted: msg });
                  } else {
                    await sock.sendMessage(from, { text: '> ❌ *Keine Zinsen möglich* (Guthaben zu klein).' }, { quoted: msg });
                  }
                  break;
                }
                await sock.sendMessage(from, {
                  text: `> 📈 *ZINSEN GUTGESCHRIEBEN*\n\n• *+${resB.amount.toLocaleString('de-DE')} Kupfer* (${resB.pct} % auf ${resB.bank.toLocaleString('de-DE')} Bank)\n• 🤎 Wallet: *${resB.wallet.toLocaleString('de-DE')}*\n\n_Morgen wieder: ${pref}bank claim_`
                }, { quoted: msg });
                await sendReaction(sock, from, '📈', msg.key);
                break;
              }
              await sock.sendMessage(from, {
                text: buildBank(userProfile, { achCount: plusAchCount(userProfile?.identity?.bid), now: Date.now() }) +
                  `\n\n💡 _${pref}deposit <betrag|all> · ${pref}withdraw <betrag|all> · ${pref}bank claim_`
              }, { quoted: msg });
              await sendReaction(sock, from, '🏦', msg.key);
              break;
            }

            case 'deposit':
            case 'einzahlen': {
              /* 🏦 Einzahlung Wallet → Bank */
              if (!userProfile) {
                await sock.sendMessage(from, { text: '> ❌ Profil nicht verfügbar.' }, { quoted: msg });
                break;
              }
              const rawA = String(args[0] || '').toLowerCase();
              if (!rawA) {
                await sock.sendMessage(from, { text: `> 🏦 *EINZAHLEN*\n\nNutze: *${pref}deposit <betrag|all>*` }, { quoted: msg });
                break;
              }
              let resA = null;
              const achA = plusAchCount(userProfile?.identity?.bid);
              await withProfileLock(userProfile?.identity?.bid || '', async () => {
                resA = deposit(userProfile, rawA, { achCount: achA });
                if (resA && resA.ok) saveUserProfile(userProfile);
              });
              if (!resA || !resA.ok) {
                const rA = resA || {};
                if (rA.reason === 'bank-full') await sock.sendMessage(from, { text: `> 🏦 *Bank voll!*\n\nKapazität: *${Number(rA.capacity).toLocaleString('de-DE')}* — mehr Platz durch Level, Prestige & Achievements.` }, { quoted: msg });
                else if (rA.reason === 'exceeds-capacity') await sock.sendMessage(from, { text: `> 🏦 *Passt nicht.*\n\nMaximal einzahlen: *${Number(rA.maxDepositable).toLocaleString('de-DE')}* Kupfer.` }, { quoted: msg });
                else if (rA.reason === 'empty-wallet') await sock.sendMessage(from, { text: `> 💸 *Leeres Wallet.*\n\nVerdiene erst Kupfer: *${pref}daily* · *${pref}work*` }, { quoted: msg });
                else await sock.sendMessage(from, { text: `> ❌ Ungültiger Betrag. Nutze: *${pref}deposit <betrag|all>*` }, { quoted: msg });
                break;
              }
              await sock.sendMessage(from, {
                text: `> 🏦 *EINGEZAHLT*\n\n• *+${resA.amount.toLocaleString('de-DE')} Kupfer* → Bank\n• 🏦 Bank: *${resA.bank.toLocaleString('de-DE')}* / ${resA.capacity.toLocaleString('de-DE')}\n• 🤎 Wallet: *${resA.wallet.toLocaleString('de-DE')}*`
              }, { quoted: msg });
              await sendReaction(sock, from, '🏦', msg.key);
              break;
            }

            case 'withdraw':
            case 'abheben':
            case 'auszahlen': {
              /* 🏦 Auszahlung Bank → Wallet */
              if (!userProfile) {
                await sock.sendMessage(from, { text: '> ❌ Profil nicht verfügbar.' }, { quoted: msg });
                break;
              }
              const rawW = String(args[0] || '').toLowerCase();
              if (!rawW) {
                await sock.sendMessage(from, { text: `> 🏦 *ABHEBEN*\n\nNutze: *${pref}withdraw <betrag|all>*` }, { quoted: msg });
                break;
              }
              let resW = null;
              await withProfileLock(userProfile?.identity?.bid || '', async () => {
                resW = withdraw(userProfile, rawW, {});
                if (resW && resW.ok) saveUserProfile(userProfile);
              });
              if (!resW || !resW.ok) {
                const rW = resW || {};
                if (rW.reason === 'empty-bank') await sock.sendMessage(from, { text: `> 🏦 *Nichts auf der Bank.*\n\nZahle erst ein: *${pref}deposit <betrag>*` }, { quoted: msg });
                else await sock.sendMessage(from, { text: `> ❌ Ungültiger Betrag (max. Bankguthaben). Nutze: *${pref}withdraw <betrag|all>*` }, { quoted: msg });
                break;
              }
              await sock.sendMessage(from, {
                text: `> 🏦 *ABGEHOBEN*\n\n• *+${resW.amount.toLocaleString('de-DE')} Kupfer* → Wallet\n• 🤎 Wallet: *${resW.wallet.toLocaleString('de-DE')}*\n• 🏦 Bank: *${resW.bank.toLocaleString('de-DE')}*`
              }, { quoted: msg });
              await sendReaction(sock, from, '💸', msg.key);
              break;
            }

            case 'economy':
            case 'eco': {
              /* 🪙 Voller Economy-Überblick */
              if (!userProfile) {
                await sock.sendMessage(from, { text: '> ❌ Profil nicht verfügbar.' }, { quoted: msg });
                break;
              }
              const nameE = getProfileDisplayName(userProfile, msg.pushName || cleanId(senderJid));
              await sock.sendMessage(from, {
                text: buildEconomy(userProfile, { achCount: plusAchCount(userProfile?.identity?.bid), now: Date.now(), name: nameE }) +
                  `\n\n💡 _${pref}bank · ${pref}transactions · ${pref}report_`
              }, { quoted: msg });
              await sendReaction(sock, from, '🪙', msg.key);
              break;
            }

            case 'transactions':
            case 'transaktionen':
            case 'tx': {
              /* 🧾 Transaktions-Verlauf */
              if (!userProfile) {
                await sock.sendMessage(from, { text: '> ❌ Profil nicht verfügbar.' }, { quoted: msg });
                break;
              }
              const limT = Math.max(1, Math.min(20, parseInt(args[0], 10) || 10));
              await sock.sendMessage(from, { text: buildTransactions(userProfile, { limit: limT }) }, { quoted: msg });
              break;
            }

            case 'report':
            case 'reports':
            case 'berichte': {
              /* 📊 Zentraler Report: day|week|month|year|all */
              if (!userProfile) {
                await sock.sendMessage(from, { text: '> ❌ Profil nicht verfügbar.' }, { quoted: msg });
                break;
              }
              const perR = String(args[0] || 'week').toLowerCase();
              const knownR = ['day', 'today', 'week', 'woche', 'month', 'monat', 'year', 'jahr', 'all', 'lifetime', 'alles', 'tagesreport', 'monatsreport', 'jahresreport'];
              if (!knownR.includes(perR)) {
                await sock.sendMessage(from, { text: `> 📊 *REPORT*\n\nNutze: *${pref}report <day|week|month|year|all>*` }, { quoted: msg });
                break;
              }
              const bidR = userProfile?.identity?.bid || '';
              const rankR = bidR ? cachedGlobalRank(readDb().users || {}, bidR) : { pos: null, total: 0 };
              await sock.sendMessage(from, {
                text: buildReport(userProfile, perR, { rankPos: rankR.pos, rankTotal: rankR.total })
              }, { quoted: msg });
              break;
            }

            case 'yearly':
            case 'jahr': {
              /* 🎆 Jahres-Report */
              if (!userProfile) {
                await sock.sendMessage(from, { text: '> ❌ Profil nicht verfügbar.' }, { quoted: msg });
                break;
              }
              const bidY = userProfile?.identity?.bid || '';
              const rankY = bidY ? cachedGlobalRank(readDb().users || {}, bidY) : { pos: null, total: 0 };
              await sock.sendMessage(from, {
                text: buildYearlyReport(userProfile, Date.now(), { rankPos: rankY.pos, rankTotal: rankY.total })
              }, { quoted: msg });
              break;
            }

            case 'rich':
            case 'reichsten':
            case 'reich': {
              /* 💰 Reichsten-Liste */
              await sock.sendMessage(from, {
                text: buildTopCoins(readDb().users || {}, { n: 10, myBid: userProfile?.identity?.bid || '', pref })
              }, { quoted: msg });
              break;
            }

            case 'account':
            case 'acc': {
              /* 👤 Vollständige Account-Übersicht */
              if (!userProfile) {
                await sock.sendMessage(from, { text: '> ❌ Profil nicht verfügbar.' }, { quoted: msg });
                break;
              }
              const bidA = userProfile?.identity?.bid || '';
              const rankA = bidA ? cachedGlobalRank(readDb().users || {}, bidA) : { pos: null, total: 0 };
              /* 💜 7.0: Account-Extras aus echten Daten */
              const regAtA = userProfile?.registration?.registeredAt ? new Date(userProfile.registration.registeredAt).getTime() : 0;
              const lastMsgA = Number(userProfile?.progression?.lastMsgXpAt) || 0;
              const lastDayA = userProfile?.progression?.lastActiveDay || '';
              const lastA = lastMsgA > 0 ? new Date(lastMsgA).toLocaleString('de-DE') : (lastDayA || '');
              const prefsA = userProfile.notifications || {};
              const onA = NOTIF_TYPES.filter((t) => (prefsA[t.id] !== undefined ? prefsA[t.id] : t.default)).length;
              const privA = userProfile.registration?.privacy || {};
              let aiA = 'bereit — sag `$ai hallo`';
              try {
                const aimA = await import('./ai/memory.js');
                const useA = aimA.getAiUsage(bidA);
                if (useA && useA.total > 0) aiA = `${useA.total} Anfragen gesamt`;
              } catch (e) {}
              await sock.sendMessage(from, {
                text: buildAccount(userProfile, {
                  plusUser: plusUserFor(bidA), rankPos: rankA.pos, rankTotal: rankA.total, pref,
                  extras: {
                    ageDays: regAtA > 0 ? Math.max(0, Math.floor((Date.now() - regAtA) / 86400000)) : null,
                    lastActive: lastA,
                    dsgvo: !!userProfile?.status?.dsgvo?.accepted,
                    verified: !!userProfile?.status?.verified,
                    notif: `${onA}/${NOTIF_TYPES.length} an`,
                    privacy: [privA.hideCity ? 'Stadt 🔒' : null, privA.hideAge ? 'Alter 🔒' : null, privA.hideEconomy ? 'Economy 🔒' : null].filter(Boolean).join(' · ') || 'offen',
                    ai: aiA
                  }
                })
              }, { quoted: msg });
              await sendReaction(sock, from, '👤', msg.key);
              break;
            }

            case 'settings':
            case 'einstellungen': {
              /* ⚙️ Einstellungs-Center (7.0): Notifications · Privacy · AI · Profil · Economy */
              if (!userProfile) {
                await sock.sendMessage(from, { text: '> ❌ Profil nicht verfügbar.' }, { quoted: msg });
                break;
              }
              const subS = String(args[0] || '').toLowerCase();
              const valS = String(args[1] || '').toLowerCase();
              const wantBoolS = (v) => ['an', 'on', '1', 'true', 'ja', 'zeigen', 'sichtbar'].includes(v) ? true : (['aus', 'off', '0', 'false', 'nein', 'verstecken', 'privat'].includes(v) ? false : null);
              /* 🤖 AI-Chatmodus (Privatchat) */
              if (subS === 'ai' || subS === 'ki') {
                const wAi = wantBoolS(valS);
                if (wAi === null && valS) {
                  await sock.sendMessage(from, { text: `> ❌ Nutzung: *${pref}settings ai <an|aus>*` }, { quoted: msg });
                  break;
                }
                try {
                  const aimS = await import('./ai/memory.js');
                  const bidS = userProfile?.identity?.bid || '';
                  const prS = aimS.getAiPrefs(bidS);
                  const nextAi = wAi === null ? !prS.chatMode : wAi;
                  aimS.setAiPrefs(bidS, { chatMode: nextAi });
                  await sock.sendMessage(from, { text: `> 🤖 *AI-Chatmodus* → ${nextAi ? '🟢 AN (der Bot antwortet im Privatchat direkt)' : '⚫ AUS (nur noch *${pref}ai …*)'}` }, { quoted: msg });
                } catch (e) {
                  await sock.sendMessage(from, { text: '> 🤖 *AI derzeit nicht verfügbar.* Versuch es später erneut.' }, { quoted: msg });
                }
                break;
              }
              /* 🌍 Sprache */
              if (subS === 'language' || subS === 'sprache') {
                if (!['de', 'en'].includes(valS)) {
                  await sock.sendMessage(from, { text: `> ❌ Nutzung: *${pref}settings language <de|en>*` }, { quoted: msg });
                  break;
                }
                userProfile.registration = userProfile.registration || {};
                userProfile.registration.language = valS;
                saveUserProfile(userProfile);
                await sock.sendMessage(from, { text: `> 🌍 *Sprache* → *${valS === 'de' ? 'Deutsch' : 'English'}*` }, { quoted: msg });
                break;
              }
              /* 🔔 Mitteilungs-Typen direkt schalten */
              const notifHitS = NOTIF_TYPES.find((t) => t.id === subS);
              if (notifHitS) {
                const wN = wantBoolS(valS);
                if (wN === null) {
                  await sock.sendMessage(from, { text: `> ❌ Nutzung: *${pref}settings ${subS} <an|aus>*` }, { quoted: msg });
                  break;
                }
                updatePrefs(userProfile, { [subS]: wN });
                saveUserProfile(userProfile);
                await sock.sendMessage(from, { text: `> 🔔 *${notifHitS.label}* → ${wN ? '🟢 AN' : '⚫ AUS'}` }, { quoted: msg });
                break;
              }
              if (subS === 'economy' || subS === 'kupfer') {
                const regS = userProfile.registration || (userProfile.registration = {});
                const privS = regS.privacy || (regS.privacy = {});
                let wantS = null;
                if (['an', 'on', 'zeigen', 'sichtbar'].includes(valS)) wantS = false;
                else if (['aus', 'off', 'verstecken', 'privat'].includes(valS)) wantS = true;
                else if (!valS) wantS = !privS.hideEconomy;
                else {
                  await sock.sendMessage(from, { text: `> ❌ Nutzung: *${pref}settings economy <an|aus>*` }, { quoted: msg });
                  break;
                }
                privS.hideEconomy = wantS;
                saveUserProfile(userProfile);
                await sock.sendMessage(from, { text: `> 🪙 *Economy-Sichtbarkeit* → ${wantS ? '⚫ VERSTECKT (andere sehen dein Kupfer nicht)' : '🟢 SICHTBAR'}` }, { quoted: msg });
                break;
              }
              const prefsS = userProfile.notifications || {};
              const onS = NOTIF_TYPES.filter((t) => (prefsS[t.id] !== undefined ? prefsS[t.id] : t.default)).length;
              const privS2 = userProfile.registration?.privacy || {};
              let aiStateS = 'unbekannt';
              try {
                const aimS2 = await import('./ai/memory.js');
                aiStateS = aimS2.getAiPrefs(userProfile?.identity?.bid || '').chatMode ? '🟢 Chatmodus an' : '⚫ nur $ai';
              } catch (e) {}
              await sock.sendMessage(from, {
                text: `> ⚙️ *EINSTELLUNGS-CENTER*\n\n🔔 *Mitteilungen:* *${onS}/${NOTIF_TYPES.length}* an\n→ *${pref}notif* oder *${pref}settings <typ> <an|aus>*\n\n🔒 *Privatsphäre:*\n• Stadt: ${privS2.hideCity ? 'versteckt' : 'sichtbar'} · Alter: ${privS2.hideAge ? 'versteckt' : 'sichtbar'}\n• Öffentliches Profil: ${privS2.publicProfile ? 'an' : 'aus'} · Economy: ${privS2.hideEconomy ? '⚫ versteckt' : '🟢 sichtbar'}\n→ *${pref}privacy* · *${pref}settings economy <an|aus>*\n\n🤖 *AI:* ${aiStateS}\n→ *${pref}settings ai <an|aus>* · *${pref}aimemory*\n\n🌍 *Sprache:* ${(userProfile.registration?.language || 'de') === 'de' ? 'Deutsch' : 'English'}\n→ *${pref}settings language <de|en>*\n\n👤 *Profil:* ${pref}me · 🏆 *Progression:* ${pref}progress`
              }, { quoted: msg });
              /* 📂 Interaktiv: Toggle-Menü (Fallback = obige Commands) */
              try {
                await sendInteractiveMenu(sock, from, {
                  title: '⚙️ EINSTELLUNGEN',
                  description: 'Wähle eine Einstellung:',
                  buttonText: '⚙️ ÄNDERN',
                  sections: [{
                    title: 'Schalter',
                    rows: [
                      { rowId: `cmd:settings economy ${privS2.hideEconomy ? 'an' : 'aus'}`, title: `🪙 Economy ${privS2.hideEconomy ? 'anzeigen' : 'verstecken'}`, description: 'Kupfer für andere sichtbar?' },
                      { rowId: 'cmd:settings ai', title: '🤖 AI-Chatmodus umschalten', description: 'Direktantwort im Privatchat' },
                      { rowId: 'cmd:notif', title: '🔔 Mitteilungen', description: 'Alle Typen im Überblick' },
                      { rowId: 'cmd:privacy', title: '🔒 Privatsphäre', description: 'Stadt, Alter, Profil' },
                      { rowId: 'cmd:aimemory', title: '🧠 AI-Memory', description: 'Gespeichertes einsehen/löschen' }
                    ]
                  }]
                });
              } catch (e) {}
              break;
            }

            /* HINWEIS: $top/$leaderboard/$rangliste leben weiter oben (Prestige-sicher
               via topProgression + eigener Platz) — kein zweiter Block nötig. */

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

            /* ══════════════════════════════════════════════════════════ */
            /* 💜 7.0 GROUP CENTER: $am · Members · GXP · Goals · Events  */
            /* ══════════════════════════════════════════════════════════ */
            case 'am':
            case 'gadmin': {
              if (!isGroup) {
                await sock.sendMessage(from, { text: '> ❌ *Fehler:* Nur in Gruppen.' }, { quoted: msg });
                break;
              }
              ensureGroupExtras(groupProfile);
              const partsAm = groupMetadata?.participants || [];
              const adminsAm = partsAm.filter((x) => x && ['admin', 'superadmin'].includes(x.admin)).length;
              await sock.sendMessage(from, {
                text: buildGroupCenter(groupProfile, {
                  subject: groupMetadata?.subject || groupProfile?.subject || '',
                  count: partsAm.length, admins: adminsAm,
                  owner: groupMetadata?.owner ? '@' + String(cleanId(groupMetadata.owner)).split('@')[0] : '',
                  creation: groupMetadata?.creation ? new Date(groupMetadata.creation * 1000).toLocaleDateString('de-DE') : ''
                }, { pref })
              }, { quoted: msg });
              break;
            }

            case 'members':
            case 'mitglieder': {
              if (!isGroup) {
                await sock.sendMessage(from, { text: '> ❌ *Fehler:* Nur in Gruppen.' }, { quoted: msg });
                break;
              }
              const partsM = groupMetadata?.participants || [];
              const usersM = readDb().users || {};
              const cards = partsM.map((x) => {
                const id = x?.id || x?.lid || x?.jid || '';
                const bid = id ? String(cleanId(id)).split('@')[0] : '';
                const prof = usersM[bid] || usersM[id];
                return { id: bid || id, name: prof?.registration?.name || getProfileDisplayName(prof, null) || (bid || '–') };
              });
              const adminIds = new Set(partsM.filter((x) => x && ['admin', 'superadmin'].includes(x.admin)).map((x) => String(cleanId(x?.id || x?.lid || x?.jid || '')).split('@')[0]));
              await sock.sendMessage(from, { text: buildMembersCard(cards, adminIds, {}) }, { quoted: msg });
              break;
            }

            case 'gxp': {
              if (!isGroup || !groupProfile) {
                await sock.sendMessage(from, { text: '> ❌ *Fehler:* Nur in Gruppen.' }, { quoted: msg });
                break;
              }
              ensureGroupExtras(groupProfile);
              await sock.sendMessage(from, { text: buildGxp(groupProfile, (groupMetadata?.participants || []).length) }, { quoted: msg });
              break;
            }

            case 'glevel':
            case 'gstufe': {
              if (!isGroup || !groupProfile) {
                await sock.sendMessage(from, { text: '> ❌ *Fehler:* Nur in Gruppen.' }, { quoted: msg });
                break;
              }
              ensureGroupExtras(groupProfile);
              await sock.sendMessage(from, { text: buildGlevel(groupProfile) }, { quoted: msg });
              break;
            }

            case 'gtop': {
              if (!isGroup || !groupProfile) {
                await sock.sendMessage(from, { text: '> ❌ *Fehler:* Nur in Gruppen.' }, { quoted: msg });
                break;
              }
              ensureGroupExtras(groupProfile);
              const modeG = ['messages', 'msgs', 'nachrichten'].includes(String(args[0] || '').toLowerCase()) ? 'messages'
                : ['games', 'spiele'].includes(String(args[0] || '').toLowerCase()) ? 'games' : 'xp';
              const rowsG = topMembers(groupProfile, modeG, 10);
              const usersG = readDb().users || {};
              const namesG = {};
              for (const r of rowsG) namesG[r.bid] = usersG[r.bid]?.registration?.name || getProfileDisplayName(usersG[r.bid], null) || r.bid;
              await sock.sendMessage(from, { text: buildGtop(rowsG, namesG, modeG) }, { quoted: msg });
              break;
            }

            case 'gsettings': {
              if (!isGroup || !groupProfile) {
                await sock.sendMessage(from, { text: '> ❌ *Fehler:* Nur in Gruppen.' }, { quoted: msg });
                break;
              }
              ensureGroupExtras(groupProfile);
              const keyG = String(args[0] || '').toLowerCase();
              const valG = String(args[1] || '').toLowerCase();
              if (!keyG) {
                await sock.sendMessage(from, { text: buildGroupSettings(groupProfile, { pref }) }, { quoted: msg });
                break;
              }
              if (userRole !== 'host' && userRole !== 'superadmin' && userRole !== 'admin') {
                await sock.sendMessage(from, { text: '> ⛔ *Zugriff verweigert:* Nur Gruppen-Admins.' }, { quoted: msg });
                break;
              }
              const mapG = { antilink: 'antilink', antispam: 'antispam', antiflood: 'antiflood', mention: 'mentionGuard', mentionguard: 'mentionGuard', commandschutz: 'commandProtection', commandprotection: 'commandProtection', automod: 'automod', welcome: 'welcome', goodbye: 'goodbye', autoreply: 'autoreply', ai: 'aiEnabled', economy: 'economyEnabled', xp: 'progressionEnabled', progression: 'progressionEnabled', logs: 'logsEnabled' };
              const realKey = mapG[keyG];
              if (!realKey) {
                await sock.sendMessage(from, { text: '> ❌ *Fehler:* Unbekannte Einstellung. Nutze *' + pref + 'gsettings* für die Liste.' }, { quoted: msg });
                break;
              }
              let wantG = null;
              if (['an', 'on', '1', 'true', 'ja'].includes(valG)) wantG = true;
              if (['aus', 'off', '0', 'false', 'nein'].includes(valG)) wantG = false;
              if (wantG === null) {
                await sock.sendMessage(from, { text: `> ❌ *Fehler:* Nutze *${pref}gsettings ${keyG} on/off*.` }, { quoted: msg });
                break;
              }
              const actorG = senderLidUser || cleanId(senderJid) || '';
              const resG = setGset(groupProfile, realKey, wantG, actorG);
              if (resG.ok) {
                saveGroupProfile(groupProfile);
                try { auditAdmin({ actor: actorG, action: 'gsettings', group: cleanId(from), detail: `${realKey} → ${wantG ? 'an' : 'aus'}` }); } catch (e) {}
                await sock.sendMessage(from, { text: `> ✅ *${realKey}* ist jetzt *${wantG ? 'an' : 'aus'}*.` }, { quoted: msg });
              } else {
                await sock.sendMessage(from, { text: '> ❌ *Fehler:* Konnte nicht speichern.' }, { quoted: msg });
              }
              break;
            }

            case 'ggoal':
            case 'gziele': {
              if (!isGroup || !groupProfile) {
                await sock.sendMessage(from, { text: '> ❌ *Fehler:* Nur in Gruppen.' }, { quoted: msg });
                break;
              }
              ensureGroupExtras(groupProfile);
              await sock.sendMessage(from, { text: buildGroupGoal(groupProfile, (groupMetadata?.participants || []).length) }, { quoted: msg });
              break;
            }

            case 'gevent': {
              if (!isGroup || !groupProfile) {
                await sock.sendMessage(from, { text: '> ❌ *Fehler:* Nur in Gruppen.' }, { quoted: msg });
                break;
              }
              ensureGroupExtras(groupProfile);
              if (!args[0]) {
                await sock.sendMessage(from, { text: buildGroupEvents(groupProfile) }, { quoted: msg });
                break;
              }
              if (userRole !== 'host' && userRole !== 'superadmin' && userRole !== 'admin') {
                await sock.sendMessage(from, { text: '> ⛔ *Zugriff verweigert:* Nur Gruppen-Admins.' }, { quoted: msg });
                break;
              }
              const multE = Math.min(5, Math.max(1.5, Number(args[0]) || 2));
              const minsE = Math.min(1440, Math.max(5, Number(args[1]) || 60));
              const actorE = senderLidUser || cleanId(senderJid) || '';
              const evE = startGroupEvent(groupProfile, { mult: multE, minutes: minsE, by: actorE });
              saveGroupProfile(groupProfile);
              try { auditAdmin({ actor: actorE, action: 'gevent', group: cleanId(from), detail: `${evE.name} ×${evE.mult} ${minsE} Min.` }); } catch (e) {}
              await sock.sendMessage(from, { text: `🔥 *GROUP EVENT GESTARTET*\n\n*${evE.name}* — ×${evE.mult} Group-XP\nDauer: ~${minsE} Minuten\n\nViel Spaß! 💜` }, { quoted: msg });
              break;
            }

            case 'gaudit':
            case 'glog': {
              if (!isGroup || !groupProfile) {
                await sock.sendMessage(from, { text: '> ❌ *Fehler:* Nur in Gruppen.' }, { quoted: msg });
                break;
              }
              ensureGroupExtras(groupProfile);
              await sock.sendMessage(from, { text: buildGroupAudit(groupProfile, 8) }, { quoted: msg });
              break;
            }

            case 'geconomy':
            case 'gkasse': {
              if (!isGroup || !groupProfile) {
                await sock.sendMessage(from, { text: '> ❌ *Fehler:* Nur in Gruppen.' }, { quoted: msg });
                break;
              }
              ensureGroupExtras(groupProfile);
              await sock.sendMessage(from, { text: buildGroupEconomy(groupProfile) }, { quoted: msg });
              break;
            }

            case 'gdonate':
            case 'gspenden': {
              if (!isGroup || !groupProfile) {
                await sock.sendMessage(from, { text: '> ❌ *Fehler:* Nur in Gruppen.' }, { quoted: msg });
                break;
              }
              if (!userProfile) {
                await sock.sendMessage(from, { text: '> ❌ *Fehler:* Profil nicht verfügbar.' }, { quoted: msg });
                break;
              }
              const amtD = Math.floor(Number(args[0]));
              if (!Number.isFinite(amtD) || amtD <= 0) {
                await sock.sendMessage(from, { text: `> ❌ *Fehler:* Nutze *${pref}gdonate <kupfer>*.` }, { quoted: msg });
                break;
              }
              ensureGroupExtras(groupProfile);
              const bidD = userProfile?.identity?.bid || '';
              let resD = null;
              await withProfileLock(bidD, async () => {
                resD = removeCoins(userProfile, amtD, { source: 'gdonate', reason: 'Gruppenkasse', now: Date.now() });
                if (resD && resD.ok) {
                  treasuryAdd(groupProfile, amtD, `Spende von ${userProfile?.registration?.name || bidD}`);
                  saveUserProfile(userProfile);
                  saveGroupProfile(groupProfile);
                }
              });
              if (resD && resD.ok) {
                groupAudit(groupProfile, userProfile?.registration?.name || bidD, 'gdonate', `+${amtD} Kupfer`);
                saveGroupProfile(groupProfile);
                await sock.sendMessage(from, { text: `> 💰 *DANKE!* ${amtD} Kupfer gehen an die Gruppenkasse. 💜` }, { quoted: msg });
              } else {
                await sock.sendMessage(from, { text: `> ❌ *Fehler:* ${resD?.reason === 'insufficient' ? 'Nicht genug Kupfer.' : 'Konnte nicht spenden.'}` }, { quoted: msg });
              }
              break;
            }

            case 'gban': {
              if (!isGroup || !groupProfile) {
                await sock.sendMessage(from, { text: '> ❌ *Fehler:* Nur in Gruppen.' }, { quoted: msg });
                break;
              }
              if (userRole !== 'host' && userRole !== 'superadmin' && userRole !== 'admin') {
                await sock.sendMessage(from, { text: '> ⛔ *Zugriff verweigert:* Nur Gruppen-Admins.' }, { quoted: msg });
                break;
              }
              const ctxGb = msg.message?.extendedTextMessage?.contextInfo || {};
              const targetRawGb = (Array.isArray(ctxGb.mentionedJid) && ctxGb.mentionedJid[0]) || ctxGb.participant || args[0] || '';
              const reasonGb = args.slice(1).join(' ') || 'Kein Grund';
              if (!targetRawGb) {
                await sock.sendMessage(from, { text: `> 🚫 *GBAN — VERWENDUNG*\n\nNutze: *${pref}gban @user <grund>* oder antworte mit *${pref}gban <grund>*.` }, { quoted: msg });
                break;
              }
              const targetGb = await resolveBanTarget(sock, targetRawGb, sessionPath);
              if (!targetGb || !targetGb.jid) {
                await sock.sendMessage(from, { text: '> ❌ *Fehler:* Ziel nicht auflösbar.' }, { quoted: msg });
                break;
              }
              const botIdsGb = [hostJid, hostLid, sock.user?.id, sock.user?.lid].filter(Boolean).map((x) => cleanId(x));
              if (botIdsGb.includes(cleanId(targetGb.jid)) || botIdsGb.includes(cleanId(targetGb.lid || ''))) {
                await sock.sendMessage(from, { text: '> ❌ *Fehler:* Der Bot kann sich nicht selbst bannen.' }, { quoted: msg });
                break;
              }
              if (cleanId(targetGb.jid) === cleanId(groupMetadata?.owner || '___')) {
                await sock.sendMessage(from, { text: '> ❌ *Fehler:* Der Gruppen-Owner steht unter Schutz.' }, { quoted: msg });
                break;
              }
              ensureGroupExtras(groupProfile);
              const bidGb = String(cleanId(targetGb.lid || targetGb.jid)).split('@')[0];
              const actorGb = senderLidUser || cleanId(senderJid) || '';
              gbanAdd(groupProfile, bidGb, { reason: reasonGb, by: actorGb });
              saveGroupProfile(groupProfile);
              try {
                if (typeof sock.groupParticipantsUpdate === 'function') await sock.groupParticipantsUpdate(from, [targetGb.jid], 'remove');
              } catch (e) {}
              try { auditAdmin({ actor: actorGb, action: 'gban', group: cleanId(from), detail: `${bidGb} (${reasonGb})` }); } catch (e) {}
              await sock.sendMessage(from, { text: `> 🚫 *GEBANNT:* @${bidGb}\n*Grund:* ${reasonGb}\n\nBei Rejoin wird erneut entfernt.` }, { quoted: msg });
              break;
            }

            case 'gunban': {
              if (!isGroup || !groupProfile) {
                await sock.sendMessage(from, { text: '> ❌ *Fehler:* Nur in Gruppen.' }, { quoted: msg });
                break;
              }
              if (userRole !== 'host' && userRole !== 'superadmin' && userRole !== 'admin') {
                await sock.sendMessage(from, { text: '> ⛔ *Zugriff verweigert:* Nur Gruppen-Admins.' }, { quoted: msg });
                break;
              }
              const targetRawGu = args[0] || '';
              if (!targetRawGu) {
                await sock.sendMessage(from, { text: `> ❌ Nutze: *${pref}gunban <nummer/id>*.` }, { quoted: msg });
                break;
              }
              const targetGu = await resolveBanTarget(sock, targetRawGu, sessionPath);
              const bidGu = targetGu ? String(cleanId(targetGu.lid || targetGu.jid)).split('@')[0] : String(targetRawGu).replace(/\D/g, '');
              ensureGroupExtras(groupProfile);
              const actorGu = senderLidUser || cleanId(senderJid) || '';
              if (gbanRemove(groupProfile, bidGu, actorGu)) {
                saveGroupProfile(groupProfile);
                try { auditAdmin({ actor: actorGu, action: 'gunban', group: cleanId(from), detail: bidGu }); } catch (e) {}
                await sock.sendMessage(from, { text: `> ✅ *ENTBANNT:* @${bidGu} darf wieder joinen.` }, { quoted: msg });
              } else {
                await sock.sendMessage(from, { text: '> ❌ *Fehler:* Diese ID steht nicht auf der Gruppen-Banliste.' }, { quoted: msg });
              }
              break;
            }

            /* ══════════════════════════════════════════════════════════ */
            /* 💜 7.0 LOVEAI: $ai · $ask · Memory · Status · Config        */
            /* ══════════════════════════════════════════════════════════ */
            case 'ai':
            case 'ki': {
              const bidAi = userProfile?.identity?.bid || '';
              const subAi = String(args[0] || '').toLowerCase();
              /* an/aus: Chatmodus (nur Privatchat) */
              if (subAi === 'on' || subAi === 'an' || subAi === 'off' || subAi === 'aus') {
                if (isGroup) {
                  await sock.sendMessage(from, { text: `> 🤖 *In Gruppen antwortet die AI nur auf ${pref}ai …*\n\nAdmins schalten sie mit *${pref}ai group on* frei.` }, { quoted: msg });
                  break;
                }
                try {
                  const aim = await import('./ai/memory.js');
                  const next = subAi === 'on' || subAi === 'an';
                  aim.setAiPrefs(bidAi, { chatMode: next });
                  await sock.sendMessage(from, { text: `> 🤖 *AI-Chatmodus* → ${next ? '🟢 AN' : '⚫ AUS'}` }, { quoted: msg });
                } catch (e) {
                  await sock.sendMessage(from, { text: '> 🤖 *AI derzeit nicht verfügbar.*' }, { quoted: msg });
                }
                break;
              }
              /* group on/off: Admin-Gate pro Gruppe */
              if (subAi === 'group' || subAi === 'gruppe') {
                if (!isGroup || !groupProfile) {
                  await sock.sendMessage(from, { text: '> ❌ *Fehler:* Nur in Gruppen.' }, { quoted: msg });
                  break;
                }
                if (userRole !== 'host' && userRole !== 'superadmin' && userRole !== 'admin') {
                  await sock.sendMessage(from, { text: '> ⛔ *Zugriff verweigert:* Nur Gruppen-Admins.' }, { quoted: msg });
                  break;
                }
                const wG = String(args[1] || '').toLowerCase();
                const wantG = ['on', 'an', '1', 'true', 'ja'].includes(wG) ? true : (['off', 'aus', '0', 'false', 'nein'].includes(wG) ? false : null);
                if (wantG === null) {
                  await sock.sendMessage(from, { text: `> ❌ Nutzung: *${pref}ai group <on|off>*` }, { quoted: msg });
                  break;
                }
                ensureGroupExtras(groupProfile);
                const actorAi = senderLidUser || cleanId(senderJid) || '';
                setGset(groupProfile, 'aiEnabled', wantG, actorAi);
                saveGroupProfile(groupProfile);
                try { auditAdmin({ actor: actorAi, action: 'ai-group', group: cleanId(from), detail: wantG ? 'an' : 'aus' }); } catch (e) {}
                await sock.sendMessage(from, { text: `> 🤖 *Gruppen-AI* → ${wantG ? '🟢 AN (nur auf ' + pref + 'ai …)' : '⚫ AUS'}` }, { quoted: msg });
                break;
              }
              /* 7.0.2 Diagnose (läuft überall — auch ohne Gruppen-Freischaltung) */
              if (subAi === 'diagnose' || subAi === 'diagnose') {
                try {
                  const eng = await import('./ai/engine.js');
                  const rep = await import('./ai/report.js');
                  const dg = await eng.diagnoseAi();
                  await sock.sendMessage(from, { text: rep.buildAiDiagnoseText(dg, pref) }, { quoted: msg });
                } catch (e) {
                  await sock.sendMessage(from, { text: '> 🤖 *Diagnose derzeit nicht möglich.*' }, { quoted: msg });
                }
                break;
              }
              if (subAi === 'debug') {
                if (!isHost) {
                  await sock.sendMessage(from, { text: '> ⛔ *Zugriff verweigert:* Nur der Owner.' }, { quoted: msg });
                  break;
                }
                try {
                  const eng = await import('./ai/engine.js');
                  const mem = await import('./ai/memory.js');
                  const rep = await import('./ai/report.js');
                  const h = await eng.aiHealth(true);
                  await sock.sendMessage(from, { text: rep.buildAiDebugText({ cfg: mem.aiConfig(), h, last: eng.getLastAiDiag(), an: mem.aiAnalytics(), pref }) }, { quoted: msg });
                } catch (e) {
                  await sock.sendMessage(from, { text: '> 🤖 *Debug derzeit nicht möglich.*' }, { quoted: msg });
                }
                break;
              }
              /* Gruppe ohne Freischaltung? */
              if (isGroup && groupProfile) {
                ensureGroupExtras(groupProfile);
                if (groupProfile.gset.aiEnabled !== true) {
                  await sock.sendMessage(from, { text: `> 🤖 *AI ist in dieser Gruppe aus.*\n\nAdmins: *${pref}ai group on*` }, { quoted: msg });
                  break;
                }
              }
              const rankAi = bidAi ? cachedGlobalRank(readDb().users || {}, bidAi) : { pos: null, total: 0 };
              await runAiQuestion(sock, from, msg, {
                text: args.join(' '), bid: bidAi, userProfile, rank: rankAi,
                groupProfile: isGroup ? groupProfile : null,
                groupSubject: isGroup ? (groupMetadata?.subject || '') : '', pref
              });
              break;
            }

            case 'ask':
            case 'askai':
            case 'frag': {
              const bidAsk = userProfile?.identity?.bid || '';
              if (isGroup && groupProfile) {
                ensureGroupExtras(groupProfile);
                if (groupProfile.gset.aiEnabled !== true) {
                  await sock.sendMessage(from, { text: `> 🤖 *AI ist in dieser Gruppe aus.*\n\nAdmins: *${pref}ai group on*` }, { quoted: msg });
                  break;
                }
              }
              const rankAsk = bidAsk ? cachedGlobalRank(readDb().users || {}, bidAsk) : { pos: null, total: 0 };
              await runAiQuestion(sock, from, msg, {
                text: args.join(' '), bid: bidAsk, userProfile, rank: rankAsk,
                groupProfile: isGroup ? groupProfile : null,
                groupSubject: isGroup ? (groupMetadata?.subject || '') : '', pref
              });
              break;
            }

            case 'aimemory':
            case 'aigedaechtnis': {
              const bidM = userProfile?.identity?.bid || '';
              if (!bidM) {
                await sock.sendMessage(from, { text: '> ❌ Profil nicht verfügbar.' }, { quoted: msg });
                break;
              }
              const subM = String(args[0] || 'list').toLowerCase();
              try {
                const aim = await import('./ai/memory.js');
                const gidM = isGroup ? cleanId(from) : '';
                const scopeM = gidM ? aim.groupScope(gidM, bidM) : aim.dmScope(bidM);
                if (subM === 'list' || subM === 'liste' || subM === 'show') {
                  const conv = aim.getConversation(scopeM);
                  const facts = aim.getFacts(bidM);
                  const pr = aim.getAiPrefs(bidM);
                  await sock.sendMessage(from, {
                    text: `> 🧠 *AI-MEMORY*\n\n💬 Dieser Chat: *${conv.length}* Nachrichten im Kontext\n📌 Fakten: *${facts.length}*\n${facts.map((f, i) => `  ${i + 1}. ${f.text}`).join('\n') || ''}\n⚙️ Chatmodus: ${pr.chatMode ? 'an' : 'aus'} · Sprache: ${pr.lang}\n\n• *${pref}aimemory remember <fakt>* — merken\n• *${pref}aimemory forget [n]* — letzte Austausche vergessen\n• *${pref}aimemory clear* — alles löschen`
                  }, { quoted: msg });
                } else if (subM === 'remember' || subM === 'merken') {
                  const fact = args.slice(1).join(' ').trim();
                  if (!fact) {
                    await sock.sendMessage(from, { text: `> ❌ Nutzung: *${pref}aimemory remember <fakt>*` }, { quoted: msg });
                    break;
                  }
                  const rr = aim.rememberFact(bidM, fact);
                  await sock.sendMessage(from, { text: rr.ok ? `> 🧠 *Gemerkt* (${rr.count}/20).` : `> ❌ *Fehler:* ${rr.reason === 'duplicate' ? 'Das weiß ich schon.' : 'Leerer Fakt.'}` }, { quoted: msg });
                } else if (subM === 'forget' || subM === 'vergessen') {
                  const n = Math.max(1, Math.min(10, Number(args[1]) || 1));
                  const left = aim.forgetLast(scopeM, n);
                  await sock.sendMessage(from, { text: `> 🧠 *Vergessen.* Noch ${left} Nachrichten im Kontext.` }, { quoted: msg });
                } else if (subM === 'clear' || subM === 'loeschen' || subM === 'löschen') {
                  aim.clearAiUser(bidM, { keepPrefs: true });
                  await sock.sendMessage(from, { text: '> 🧠 *AI-Memory gelöscht* (Chats + Fakten).' }, { quoted: msg });
                } else {
                  await sock.sendMessage(from, { text: `> ❌ Nutzung: *${pref}aimemory <list|remember|forget|clear>*` }, { quoted: msg });
                }
              } catch (e) {
                await sock.sendMessage(from, { text: '> 🧠 *AI-Memory derzeit nicht verfügbar.*' }, { quoted: msg });
              }
              break;
            }

            case 'aistatus': {
              try {
                const eng = await import('./ai/engine.js');
                const mem = await import('./ai/memory.js');
                const rep = await import('./ai/report.js');
                const h = await eng.aiHealth(true);
                await sock.sendMessage(from, {
                  text: rep.buildAiStatusText({ cfg: mem.aiConfig(), h, an: mem.aiAnalytics(), pref })
                }, { quoted: msg });
              } catch (e) {
                await sock.sendMessage(from, { text: '> 🤖 *AI-Status derzeit nicht verfügbar.*' }, { quoted: msg });
              }
              break;
            }

            case 'aimodel': {
              /* 7.0.2: $aimodel <name> schaltet ECHT um (Owner) — kein Kosmetik. */
              const wantModel = String(args[0] || '').trim();
              if (wantModel) {
                if (!isHost) {
                  await sock.sendMessage(from, { text: '> ⛔ *Zugriff verweigert:* Nur der Owner wechselt das Modell.' }, { quoted: msg });
                  break;
                }
                try {
                  const eng = await import('./ai/engine.js');
                  const mem = await import('./ai/memory.js');
                  mem.setAiConfig({ model: wantModel }, 'owner');
                  try { eng.refreshProvider(); } catch (e) {}
                  try { eng.invalidateAiHealth(); } catch (e) {}
                  const h = await eng.aiHealth(true);
                  const mark = h.ok ? (h.modelFound === false ? ' ⚠️ *nicht installiert*' : ' ✅ *bereit*') : ' (Backend offline — wird bei Erreichbarkeit geprüft)';
                  try { auditAdmin({ actor: 'owner', action: 'aimodel', detail: wantModel }); } catch (e) {}
                  await sock.sendMessage(from, { text: `> 🤖 *AI MODELL*\n\nAktiv: *${wantModel}*${mark}\n\nPrüfe: *${pref}aistatus*` }, { quoted: msg });
                } catch (e) {
                  await sock.sendMessage(from, { text: '> 🤖 *Modellwechsel fehlgeschlagen.*' }, { quoted: msg });
                }
                break;
              }
              try {
                const eng = await import('./ai/engine.js');
                const mem = await import('./ai/memory.js');
                const cfg = mem.aiConfig();
                let models = [];
                try { models = await eng.getProvider().models(); } catch (e) {}
                await sock.sendMessage(from, {
                  text: `> 🤖 *AI MODELL*\n\nAktiv: *${cfg.model}* (${cfg.provider})\n\nVerfügbar:\n${models.length ? models.map((m) => `• ${m.name}`).join('\n') : '– (Provider offline?)'}`
                }, { quoted: msg });
              } catch (e) {
                await sock.sendMessage(from, { text: '> 🤖 *Modell-Info derzeit nicht verfügbar.*' }, { quoted: msg });
              }
              break;
            }

            case 'aiclear': {
              const bidC = userProfile?.identity?.bid || '';
              if (!bidC) {
                await sock.sendMessage(from, { text: '> ❌ Profil nicht verfügbar.' }, { quoted: msg });
                break;
              }
              try {
                const aim = await import('./ai/memory.js');
                const gidC = isGroup ? cleanId(from) : '';
                aim.clearConversation(gidC ? aim.groupScope(gidC, bidC) : aim.dmScope(bidC));
                await sock.sendMessage(from, { text: '> 🧹 *Chat-Kontext gelöscht.* Frisch starten! 💜' }, { quoted: msg });
              } catch (e) {
                await sock.sendMessage(from, { text: '> ❌ Konnte nicht löschen.' }, { quoted: msg });
              }
              break;
            }

            case 'aistop': {
              const bidS = userProfile?.identity?.bid || '';
              try {
                const eng = await import('./ai/engine.js');
                const stopped = bidS ? eng.stopJob(bidS) : false;
                await sock.sendMessage(from, { text: stopped ? '> 🛑 *AI-Anfrage abgebrochen.*' : '> 🤖 Keine laufende Anfrage.' }, { quoted: msg });
              } catch (e) {
                await sock.sendMessage(from, { text: '> ❌ Konnte nicht abbrechen.' }, { quoted: msg });
              }
              break;
            }

            case 'aiconfig': {
              const bidCf = userProfile?.identity?.bid || '';
              try {
                const mem = await import('./ai/memory.js');
                const cfg = mem.aiConfig();
                const keyCf = String(args[0] || '').toLowerCase();
                if (!keyCf) {
                  const pr = bidCf ? mem.getAiPrefs(bidCf) : { chatMode: false, lang: 'de' };
                  await sock.sendMessage(from, {
                    text: `> 🤖 *AI CONFIG*\n\n*Deine Einstellungen:*\n• Chatmodus: ${pr.chatMode ? 'an' : 'aus'} → *${pref}settings ai <an|aus>*\n• Sprache: ${pr.lang} → *${pref}settings language <de|en>*\n\n*Global (nur lesbar):*\n• Provider: ${cfg.provider} · Modell: ${cfg.model}\n• Endpoint: ${cfg.baseUrl}\n• Timeout: ${cfg.timeoutMs} ms · Tokens: ${cfg.maxTokens} · Temp: ${cfg.temperature}\n• Limits: ${cfg.perMin}/min · ${cfg.perHour}/h · ${cfg.perDay}/Tag` +
                      (isHost ? `\n\n*Owner:* *${pref}aiconfig model <name>* · *${pref}aiconfig baseurl <url>* · *${pref}aiconfig <key> <wert>*` : '')
                  }, { quoted: msg });
                  break;
                }
                if (!isHost) {
                  await sock.sendMessage(from, { text: '> ⛔ *Zugriff verweigert:* Nur der Owner ändert die globale AI-Config.' }, { quoted: msg });
                  break;
                }
                const mapCf = { model: 'model', baseurl: 'baseUrl', base_url: 'baseUrl', timeout: 'timeoutMs', maxtokens: 'maxTokens', temperature: 'temperature', permin: 'perMin', perhour: 'perHour', perday: 'perDay' };
                const realCf = mapCf[keyCf];
                const valCf = args.slice(1).join(' ').trim();
                if (!realCf || !valCf) {
                  await sock.sendMessage(from, { text: `> ❌ Nutzung: *${pref}aiconfig <model|baseurl|timeout|maxtokens|temperature|permin|perhour|perday> <wert>*` }, { quoted: msg });
                  break;
                }
                mem.setAiConfig({ [realCf]: valCf }, 'owner');
                try { (await import('./ai/engine.js')).refreshProvider(); } catch (e) {}
                try { auditAdmin({ actor: 'owner', action: 'aiconfig', detail: `${realCf} gesetzt` }); } catch (e) {}
                await sock.sendMessage(from, { text: `> ✅ *AI-Config:* ${realCf} gesetzt.` }, { quoted: msg });
              } catch (e) {
                await sock.sendMessage(from, { text: '> ❌ AI-Config derzeit nicht verfügbar.' }, { quoted: msg });
              }
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

              /* 🎉 EXTRA-BEFEHLE: Spaß & Spiele, weitere Echt-API-Tools, Love-Extras
                 Siehe extracmds.js für die volle Liste */
              const extraCtxInfo = msg.message?.extendedTextMessage?.contextInfo || {};
              const extraMentioned = Array.isArray(extraCtxInfo.mentionedJid) ? extraCtxInfo.mentionedJid : [];
              const extraHandled = await handleExtraCommand({
                sock, msg, from, args, command, pref, quoted,
                senderName: msg.pushName || cleanId(senderJid),
                mentionedJid: extraMentioned[0] || (extraCtxInfo.participant || null)
              });
              if (extraHandled) break;

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
                helpers: lovePlusHelpers(userProfile)
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

/* Ziel-JIDs für Owner-Benachrichtigungen: explizit (item.to) + Owner-Config
   + alle in db.meta.owners hinterlegten Kontakte (jid/lid). */
function ownerNotifyTargets(item) {
  const out = [];
  const add = (v) => {
    v = String(v || '').trim();
    if (/^\d+(?::\d+)?@(s\.whatsapp\.net|lid)$/.test(v) && !out.includes(v)) out.push(v.replace(/:\d+(?=@)/, ''));
  };
  (Array.isArray(item.to) ? item.to : []).forEach(add);
  try {
    add(OWNER_CONFIG.jid);
    add(OWNER_CONFIG.lid);
  } catch (e) {}
  try {
    for (const o of (readDb()?.meta?.owners || [])) { add(o.jid); add(o.lid); }
  } catch (e) {}
  return out;
}

/* Gruppen-Admins (participants mit Rang admin/superadmin) als Mention-JIDs. */
async function groupAdminMentions(sock, gid) {
  try {
    const meta = await sock.groupMetadata(gid);
    return (meta.participants || [])
      .filter((p) => p.admin === 'admin' || p.admin === 'superadmin')
      .map((p) => p.id)
      .filter(Boolean);
  } catch (e) {
    return [];
  }
}

/* Verarbeitet die Befehle, die das Web-Dashboard in die Mailbox legt:
   Verifizierungs-Codes senden + Broadcasts an alle Gruppen +
   Owner-/Gruppen-Benachrichtigungen + QR-Bild an alle Gruppen. */
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
        } else if (item.type === 'security-owner-alert') {
          const targetJid = String(item.jid || item.to || '');
          if (!/^\d+(?::\d+)?@(s\.whatsapp\.net|lid)$/.test(targetJid)) {
            throw new Error('Ungültige Owner-JID für Security-Alert.');
          }
          await sock.sendMessage(targetJid.replace(/:\d+(?=@)/, ''), { text: item.text });
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
        } else if (item.type === 'owner-notice') {
          const targets = ownerNotifyTargets(item);
          if (!targets.length) throw new Error('Keine gültige Owner-JID für owner-notice.');
          let ok = 0;
          for (const jid of targets) {
            try { await sock.sendMessage(jid, { text: item.text }); ok++; } catch (ownErr) {}
          }
          item.result = { sent: ok, targets: targets.length };
          if (ok === 0) throw new Error('Owner-Nachricht konnte an keine JID gesendet werden.');
          item.status = 'sent';
        } else if (item.type === 'group-notice') {
          /* db.groups speichert Gruppenschlüssel ohne Domain → @g.us ergänzen */
          let gid = String(item.gid || '').trim();
          if (!/^[0-9]+(@g\.us)?$/.test(gid)) throw new Error('Ungültige Gruppen-ID für group-notice.');
          if (!gid.endsWith('@g.us')) gid += '@g.us';
          let mentions = item.mentions || [];
          if (item.mentionAdmins) mentions = await groupAdminMentions(sock, gid);
          await sock.sendMessage(gid, { text: item.text, mentions });
          item.status = 'sent';
        } else if (item.type === 'broadcast-qr') {
          /* QR-Code einer neuen Session als Bild in ALLE Gruppen des aktiven Bots */
          const png = qrToPng(String(item.qr || ''));
          if (!png) throw new Error('QR-Bild konnte nicht erzeugt werden.');
          const groups = await sock.groupFetchAllParticipating().catch(() => ({}));
          const jids = Object.keys(groups || {});
          let ok = 0;
          let failed = 0;
          const caption = String(item.caption || '🔗 Neuer QR-Code zum Verbinden');
          for (const gjid of jids) {
            try {
              await sock.sendMessage(gjid, { image: png, caption });
              ok++;
            } catch (bcErr) { failed++; }
            await delay(400);
          }
          item.result = { sent: ok, failed, total: jids.length };
          if (jids.length > 0 && ok === 0) {
            throw new Error(`QR konnte an keine der ${jids.length} Gruppen gesendet werden.`);
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

/* 🔗 Neue Session wartet auf QR → Bild mit allen Hinweisen an alle Gruppen
   dieses (aktiven) Bots + private Owner-Nachricht. Läuft nur, wenn dieser
   Bot selbst verbunden ist (er ist dann die „aktive Session“). */
async function announcePendingSessionQrs(sock) {
  try {
    let rawList = [];
    try { rawList = SessionManager.listSessionsRaw() || []; } catch (e) { return; }
    for (const s of rawList) {
      if (!s || s.id === SESSION_ID) continue; /* nicht sich selbst ankündigen */
      const needsAuth = s.status === 'QR_REQUIRED' || s.status === 'WAITING_FOR_AUTH' || s.status === 'CONNECTING';
      if (!needsAuth || !s.qr || s.announcedQr) continue;
      const png = qrToPng(String(s.qr));
      if (!png) continue;
      const displayName = (s.id === 'main') ? 'LoveBot_Maxichen !' : (s.name || s.id);
      const caption =
        '🔗 *NEUE SESSION — QR ZUM VERBINDEN* 🔗\n\n' +
        '• Bot: *' + displayName + '*\n' +
        '• Angelegt über das LoveBot-Dashboard.\n\n' +
        '📱 Scanne mit WhatsApp:\n' +
        '*Verknüpfte Geräte > Gerät verknüpfen*\n\n' +
        'Der QR läuft nur kurz — bei Ablauf erscheint im Dashboard ein neuer.\n— LoveBot ☾';
      const groups = await sock.groupFetchAllParticipating().catch(() => ({}));
      const jids = Object.keys(groups || {});
      let ok = 0;
      for (const gjid of jids) {
        try { await sock.sendMessage(gjid, { image: png, caption }); ok++; } catch (qrErr) {}
        await delay(400);
      }
      /* Owner privat informieren */
      try {
        const targets = ownerNotifyTargets({});
        for (const jid of targets) {
          await sock.sendMessage(jid, { text: '🔗 *NEUER SESSION-QR* 🔗\n\n' + displayName + ' (' + s.id + ') wartet auf Scan. QR wurde in ' + ok + ' Gruppen gepostet.\n— LoveBot ☾ Dashboard' });
        }
      } catch (ownErr) {}
      try { SessionManager.markAnnounced(s.id); } catch (mErr) {}
    }
  } catch (outerErr) {}
}

let webmailTimerStarted = false;
function startDashboardTimers(sock) {
  if (webmailTimerStarted) return;
  webmailTimerStarted = true;
  setInterval(() => processWebmailQueue(sock), 2000);
  setInterval(() => announcePendingSessionQrs(sock), 3500);
  setInterval(() => writeHeartbeat(sock, true), 10000);
  writeHeartbeat(sock, true);
  logLove('dashboard', 'Dashboard-Mailbox & Heartbeat aktiv (server.js Port 7777).', c.brightCyan);
}

/* 💜 Terminal-Beauty: Banner direkt beim Start */
printStartupBanner();
logLove('boot', `LoveBot v2 gestartet — Node ${process.version}, ${HELP_CATEGORIES.length} Hilfe-Kategorien geladen.`, c.brightCyan);

/* 🤖 Headless-Modus (vom SessionManager gespawnte Instanzen): kein
   interaktives Menü möglich (kein TTY) — LOVEBOT_AUTH_MODE sagt dem Bot,
   ob er sich per QR oder Pairing-Code anmelden soll. Die QR-/Code-Daten
   landen über SessionManager.setQr/setPairCode im Store, damit das
   Web-Dashboard sie anzeigen kann. */
const _headlessMode = String(process.env.LOVEBOT_AUTH_MODE || '').trim();
if (_headlessMode === 'qr' || _headlessMode === 'pairing') {
  startBot({
    mode: _headlessMode,
    phoneNumber: process.env.LOVEBOT_PAIR_PHONE || null
  }).catch((bootErr) => {
    console.error('[Love.js] Headless-Start fehlgeschlagen:', bootErr?.message || bootErr);
  });
} else {
  pairMenu({
    sessionPath,
    credsPath,
    askQuestion,
    startBot,
    openMulti: openMultiSessionMenu
  });
}

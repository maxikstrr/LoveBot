import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  makeCacheableSignalKeyStore,
  generateWAMessageFromContent,
  prepareWAMessageMedia,
  generateMessageID,
  proto,
  jidDecode,
  isPnUser,
  isLidUser,
  isHostedLidUser,
  isJidGroup,
  isJidBroadcast,
  isJidNewsletter,
  ACCOUNT_RESTRICTED_TEXT,
  ALL_WA_PATCH_NAMES,
  BinaryInfo,
  Browsers,
  BufferJSON,
  CALL_AUDIO_PREFIX,
  CALL_VIDEO_PREFIX,
  CompanionWebClientType,
  Curve,
  DECRYPTION_RETRY_CONFIG,
  DEFAULT_CACHE_TTLS,
  DEFAULT_CONNECTION_CONFIG,
  DEFAULT_ORIGIN,
  DEF_CALLBACK_PREFIX,
  DEF_MEDIA_HOST,
  DEF_TAG_PREFIX,
  DICT_VERSION,
  FLAG_BYTE,
  FLAG_EVENT,
  FLAG_EXTENDED,
  FLAG_FIELD,
  FLAG_GLOBAL,
  HISTORY_SYNC_PAUSED_TIMEOUT_MS,
  INITIAL_PREKEY_COUNT,
  KEY_BUNDLE_TYPE,
  LT_HASH_ANTI_TAMPERING,
  MAX_SYNC_ATTEMPTS,
  MEDIA_HKDF_KEY_MAPPING,
  MEDIA_KEYS,
  MEDIA_PATH_MAP,
  META_AI_JID,
  MIN_PREKEY_COUNT,
  MISSING_KEYS_ERROR_TEXT,
  MessageRetryManager,
  NACK_REASONS,
  NOISE_MODE,
  NOISE_WA_HEADER,
  NO_MESSAGE_FOUND_ERROR_TEXT,
  NewChatMessageCappingMVStatusType,
  NewChatMessageCappingOTEStatusType,
  NewChatMessageCappingStatusType,
  OFFICIAL_BIZ_JID,
  PHONE_CONNECTION_CB,
  PLACEHOLDER_MAX_AGE_SECONDS,
  PROCESSABLE_HISTORY_TYPES,
  PSA_WID,
  QueryIds,
  ReachoutTimelockEnforcementType,
  RetryReason,
  SERVER_ERROR_CODES,
  SERVER_JID,
  STATUS_EXPIRY_SECONDS,
  STORIES_JID,
  S_WHATSAPP_NET,
  SyncState,
  TimeMs,
  UNAUTHORIZED_CODES,
  UPLOAD_TIMEOUT,
  URL_REGEX,
  USyncContactProtocol,
  USyncDeviceProtocol,
  USyncDisappearingModeProtocol,
  USyncQuery,
  USyncStatusProtocol,
  USyncUser,
  USyncUsernameProtocol
} from '@whiskeysockets/baileys';
import {
  fs,
  path,
  process
} from './nodeApi.js';
import c from './colorApi.js';
import qrcode from 'qrcode-terminal';
import { Boom } from '@hapi/boom';

const loglv = 'silent';
let pinoModule = null;
let logger = null;
try {
  pinoModule = await import('pino');
  const createPino = pinoModule.default || pinoModule;
  logger = createPino({
    level: loglv
  });
} catch (pinoErr) {
  logger = {
    level: loglv,
    child() {
      return this;
    },
    trace() {},
    debug() {},
    info() {},
    warn() {},
    error() {},
    fatal() {}
  };
}

const reactions = {
  processing: {
    enabled: true,
    reactions: {
      processingStart: '⏳',
      processingFinish: '⌛️'
    }
  },
  completion: {
    enabled: true,
    reactions: {
      withoutAnyProblems: '✅',
      partial: '☑️'
    }
  },
  information: {
    enabled: true,
    reactions: {
      info: 'ℹ️',
      cooldown: '⏰'
    }
  },
  access: {
    enabled: true,
    reactions: {
      unauthorized: '❎',
      bannedUser: '🚫'
    }
  },
  input: {
    enabled: true,
    reactions: {
      invalidInput: '❓',
      notFound: '✨',
      emptyResult: '📭',
      noCommadJustBotPrefix: '🔍'
    },
    emojiPools: [
      {
        emojis: ['🔍'],
        probability: 0.5
      },
      {
        emojis: ['🔎'],
        probability: 0.5
      }
    ]
  },
  errors: {
    enabled: true,
    reactions: {
      error: '❌',
      warning: '⚠️',
      criticalError: '🔥',
      errorCase: '🪲'
    }
  },
  development: {
    enabled: true,
    reactions: {
      missingConst: '🪳',
      missingLet: '🐜',
      missingFunctions: '🐞'
    }
  },
  system: {
    enabled: true,
    reactions: {
      maintenance: '🛠️'
    }
  },
  special: {
    enabled: true,
    reactions: {
      easterEgg: '🎉'
    }
  }
};

const reactionsConfig = reactions;

async function sendReaction(sock, from, reactEmoji, quotedKey) {
  if (!sock || !from || !reactEmoji) {
    return null;
  }
  try {
    return await sock.sendMessage(from, {
      react: {
        text: reactEmoji,
        key: quotedKey
      }
    });
  } catch (err) {
    return null;
  }
}

const store = null;
const usernameCache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000;
const lidMappingPrefix = 'lid-mapping-';
const lidMappingReverseSuffix = '_reverse';
const jsonFileSuffix = '.json';
const Database = './Database';
const LoveUser = path.join(Database, 'LoveUser');
const LoveGroups = path.join(Database, 'LoveGroups');
const DatabaseJsonPath = path.join(Database, 'Database.json');

function ensureDatabaseStore() {
  try {
    if (!fs.existsSync(Database)) {
      fs.mkdirSync(Database, { recursive: true });
    }
    if (!fs.existsSync(LoveUser)) {
      fs.mkdirSync(LoveUser, { recursive: true });
    }
    if (!fs.existsSync(LoveGroups)) {
      fs.mkdirSync(LoveGroups, { recursive: true });
    }
    if (!fs.existsSync(DatabaseJsonPath)) {
      fs.writeFileSync(DatabaseJsonPath, JSON.stringify({ users: {}, groups: {} }, null, 2), 'utf8');
    }
  } catch (err) {
    console.error(c.bold + c.brightRed + 'Fehler beim Initialisieren der Love-Database:' + c.reset, err);
  }
}

function readDatabaseStore() {
  ensureDatabaseStore();
  try {
    const raw = fs.readFileSync(DatabaseJsonPath, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      users: parsed && typeof parsed.users === 'object' ? parsed.users : {},
      groups: parsed && typeof parsed.groups === 'object' ? parsed.groups : {},
      afk: parsed && typeof parsed.afk === 'object' ? parsed.afk : {},
      bans: parsed && typeof parsed.bans === 'object' ? parsed.bans : {},
      meta: parsed && typeof parsed.meta === 'object' ? parsed.meta : {}
    };
  } catch (err) {
    return { users: {}, groups: {}, afk: {}, bans: {}, meta: {} };
  }
}

function writeDatabaseStore(db) {
  ensureDatabaseStore();
  const safeDb = {
    users: db && typeof db.users === 'object' ? db.users : {},
    groups: db && typeof db.groups === 'object' ? db.groups : {},
    afk: db && typeof db.afk === 'object' ? db.afk : {},
    bans: db && typeof db.bans === 'object' ? db.bans : {},
    meta: db && typeof db.meta === 'object' ? db.meta : {}
  };
  fs.writeFileSync(DatabaseJsonPath, JSON.stringify(safeDb, null, 2), 'utf8');
  return safeDb;
}

export { readDatabaseStore, writeDatabaseStore };

function migrateLegacyStoreIfNeeded() {
  const legacyUserDir = './LoveUser';
  const legacyGroupDir = './LoveGroups';
  const db = readDatabaseStore();

  try {
    if (fs.existsSync(legacyUserDir)) {
      const entries = fs.readdirSync(legacyUserDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const bid = entry.name;
        const filePath = path.join(legacyUserDir, bid, `${bid}.json`);
        if (fs.existsSync(filePath)) {
          try {
            const raw = fs.readFileSync(filePath, 'utf8');
            const parsed = JSON.parse(raw);
            if (parsed && parsed.identity && parsed.identity.bid) {
              db.users[parsed.identity.bid] = parsed;
            }
          } catch (err) {}
        }
      }
    }

    if (fs.existsSync(legacyGroupDir)) {
      const groups = fs.readdirSync(legacyGroupDir, { withFileTypes: true });
      for (const entry of groups) {
        if (!entry.isDirectory()) continue;
        const groupDir = path.join(legacyGroupDir, entry.name);
        const filePath = path.join(groupDir, `${entry.name}.json`);
        if (fs.existsSync(filePath)) {
          try {
            const raw = fs.readFileSync(filePath, 'utf8');
            const parsed = JSON.parse(raw);
            if (parsed && parsed.groupId) {
              db.groups[parsed.groupId] = parsed;
            }
          } catch (err) {}
        }
      }
    }

    if (Object.keys(db.users).length > 0 || Object.keys(db.groups).length > 0) {
      writeDatabaseStore(db);
    }
  } catch (err) {}
}

migrateLegacyStoreIfNeeded();

function groupProfileDir(groupId) {
  const cleanG = String(groupId || '').replace('@g.us', '').split('@')[0].split(':')[0];
  return path.join(LoveGroups, `${cleanG}gus`);
}

function groupProfilePath(groupId) {
  const cleanG = String(groupId || '').replace('@g.us', '').split('@')[0].split(':')[0];
  return path.join(LoveGroups, `${cleanG}gus`, `${cleanG}gus.json`);
}

function saveGroupProfile(profile) {
  try {
    const groupId = profile?.groupId;
    if (!groupId) {
      return false;
    }
    const db = readDatabaseStore();
    db.groups[groupId] = profile;
    writeDatabaseStore(db);

    const dir = groupProfileDir(groupId);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(groupProfilePath(groupId), JSON.stringify(profile, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error(c.bold + c.brightRed + 'Fehler beim Speichern des Gruppen-Profils:' + c.reset, err);
    return false;
  }
}

async function loadGroupProfile(chatJid, groupMetadata = null, sock = null) {
  try {
    if (!chatJid || !chatJid.endsWith('@g.us')) {
      return null;
    }
    const cleanG = chatJid.replace('@g.us', '').split('@')[0].split(':')[0];
    const filePath = groupProfilePath(cleanG);
    const db = readDatabaseStore();

    let profile = db.groups?.[cleanG] || null;
    if (!profile && fs.existsSync(filePath)) {
      try {
        const raw = fs.readFileSync(filePath, 'utf8');
        profile = JSON.parse(raw);
      } catch (e) {}
    }

    if (!profile) {
      let creator = '';
      let owner = '';
      let ownerUsername = '';
      let subject = '';

      if (groupMetadata) {
        creator = groupMetadata.owner || groupMetadata.author || '';
        owner = groupMetadata.owner || '';
        ownerUsername = groupMetadata.ownerUsername || '';
        subject = groupMetadata.subject || '';
      } else if (sock && typeof sock.groupMetadata === 'function') {
        try {
          const meta = await sock.groupMetadata(chatJid);
          creator = meta.owner || meta.author || '';
          owner = meta.owner || '';
          ownerUsername = meta.ownerUsername || '';
          subject = meta.subject || '';
        } catch (e) {}
      }

      profile = {
        groupId: cleanG,
        groupJid: `${cleanG}@g.us`,
        subject: subject || 'Gruppe',
        creator: creator ? (creator.includes('@') ? creator : `${cleanId(creator)}@s.whatsapp.net`) : 'unknown',
        owner: owner ? (owner.includes('@') ? owner : `${cleanId(owner)}@s.whatsapp.net`) : 'unknown',
        ownerUsername: ownerUsername || null,
        active: false,
        activatedAt: null,
        activatedBy: null,
        createdAt: new Date().toISOString()
      };
      saveGroupProfile(profile);
    } else if (groupMetadata) {
      let changed = false;
      if (groupMetadata.owner && profile.owner === 'unknown') {
        profile.owner = groupMetadata.owner;
        profile.creator = groupMetadata.owner;
        changed = true;
      }
      if (groupMetadata.ownerUsername && !profile.ownerUsername) {
        profile.ownerUsername = groupMetadata.ownerUsername;
        changed = true;
      }
      if (groupMetadata.subject && profile.subject !== groupMetadata.subject) {
        profile.subject = groupMetadata.subject;
        changed = true;
      }
      if (changed) {
        saveGroupProfile(profile);
      }
    }

    return profile;
  } catch (err) {
    console.error(c.bold + c.brightRed + 'Fehler beim Laden des Gruppen-Profils:' + c.reset, err);
    return null;
  }
}

function checkCommandAccess(senderProfile, groupProfile, role, isGroup, command, pref = '¥') {
  if (command === 'fetch' || command === 'i2') {
    if (role !== 'host') {
      return {
        allowed: false,
        message: `> ❌ *Zugriff verweigert!*\nDer Befehl *${command}* ist ausschließlich dem Host (Bot-Besitzer) in jedem Chat vorbehalten.`
      };
    }
    return {
      allowed: true
    };
  }

  if (command === 'fp') {
    if (role !== 'host' && role !== 'superadmin' && role !== 'admin') {
      return {
        allowed: false,
        message: '> ⛔ *Zugriff verweigert:*\nDieser Befehl ist ausschließlich dem Host sowie verifizierten Gruppen-Admins und SuperAdmins vorbehalten.'
      };
    }
    if (!senderProfile || !senderProfile.status || senderProfile.status.verified !== true) {
      return {
        allowed: false,
        message: `> ⛔ *Verifizierung erforderlich:*\nDu musst verifiziert sein, um diesen Befehl zu nutzen. Nutze *${pref}verify accept* zur Freischaltung.`
      };
    }
    return {
      allowed: true
    };
  }

  /* Normale Bot-Befehle sind in jedem Chat und für jede WhatsApp-ID offen.
     Administrative Befehle prüfen ihre Rechte weiterhin direkt im Handler. */
  return {
    allowed: true
  };

  const isOnboarding = ['dsgvo', 'dsgvo✅', 'dsgvo❌', 'verify', 'verify✅', 'verify❌', 'help', 'love', 'socials'].includes(command);

  if (role === 'host' || role === 'superadmin' || role === 'admin') {
    return {
      allowed: true
    };
  }

  if (isGroup) {
    if (!groupProfile || groupProfile.active !== true) {
      if (isOnboarding) {
        return {
          allowed: true
        };
      }
      return {
        allowed: false,
        message: `> ⛔ *Bot inaktiv:*\n` +
          `Der Bot ist für diese Gruppe noch nicht freigeschaltet.\n` +
          `Ein Admin oder der Host kann ihn mit *${pref}activate* aktivieren.`
      };
    }

    if (!senderProfile || !senderProfile.status || senderProfile.status.dsgvo.accepted !== true) {
      if (['dsgvo', 'dsgvo✅', 'dsgvo❌', 'help'].includes(command)) {
        return {
          allowed: true
        };
      }
      return {
        allowed: false,
        message: `> ⛔ *DSGVO erforderlich:*\n` +
          `Du musst zuerst der DSGVO zustimmen mit *${pref}dsgvo accept*.`
      };
    }

    if (senderProfile.status.verified !== true) {
      if (isOnboarding) {
        return {
          allowed: true
        };
      }
      return {
        allowed: false,
        message: `> ⛔ *Verifizierung erforderlich:*\n` +
          `Du bist noch nicht verifiziert. Nutze *${pref}verify accept* zur Freischaltung.`
      };
    }

    return {
      allowed: true
    };
  }

  if (!senderProfile || !senderProfile.status || senderProfile.status.dsgvo.accepted !== true) {
    if (['dsgvo', 'dsgvo✅', 'dsgvo❌', 'help'].includes(command)) {
      return {
        allowed: true
      };
    }
    return {
      allowed: false,
      message: `> ⛔ *DSGVO erforderlich:*\n` +
        `Du musst zuerst der DSGVO zustimmen mit *${pref}dsgvo accept*.`
    };
  }

  if (senderProfile.status.verified !== true) {
    if (isOnboarding) {
      return {
        allowed: true
      };
    }
    return {
      allowed: false,
      message: `> ⛔ *Verifizierung erforderlich:*\n` +
        `Du bist noch nicht verifiziert. Nutze *${pref}verify accept* zur Freischaltung.`
    };
  }

  return {
    allowed: true
  };
}

function resolveDisplayName(username, pushName, lid) {
  if (username && String(username).trim().length > 0) {
    const cleanU = String(username).trim();
    return cleanU.startsWith('@') ? cleanU : `@${cleanU}`;
  }
  if (pushName && String(pushName).trim().length > 0) {
    return String(pushName).trim();
  }
  const cleanL = cleanId(lid) || 'unknown';
  return `${cleanL}@lid`;
}

function normalizeGroupTargetValue(value) {
  if (!value) {
    return '';
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return '';
    }

    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        return normalizeGroupTargetValue(parsed);
      } catch (e) {
        return trimmed;
      }
    }

    return trimmed;
  }

  if (Array.isArray(value)) {
    return normalizeGroupTargetValue(value[0]);
  }

  if (typeof value === 'object') {
    return normalizeGroupTargetValue(
      value.id || value.jid || value.phoneNumber || value.participant || value.user || value.lid || value.remoteJid || value.target || value.userId || ''
    );
  }

  return String(value);
}

async function announceGroupProcess(sock, from, data = {}) {
  if (!sock || !from || !from.endsWith('@g.us')) {
    return null;
  }
  try {
    const action = data.action || 'Aktualisiert';
    const rawTarget = normalizeGroupTargetValue(data.targetId || '');
    const rawActor = normalizeGroupTargetValue(data.actorId || (sock.user?.id || ''));
    const quotedMsg = data.quoted || null;
    const customSessionPath = data.sessionPath || './xoisChallangeBot';

    const groupId = from.replace('@g.us', '').split('@')[0].split(':')[0];
    let groupSubject = data.groupName || '';

    if (!groupSubject && typeof sock.groupMetadata === 'function') {
      try {
        const meta = await sock.groupMetadata(from);
        groupSubject = meta?.subject || '';
      } catch (e) {}
    }
    if (!groupSubject) {
      groupSubject = `Gruppe ${groupId}`;
    }

    let targetLid = cleanId(rawTarget) || '';
    if (rawTarget && typeof rawTarget === 'string' && !rawTarget.endsWith('@lid')) {
      const foundTargetLid = await findLidByJid(rawTarget, customSessionPath, sock);
      if (foundTargetLid) {
        targetLid = cleanId(foundTargetLid);
      }
    }

    let actorLid = cleanId(rawActor) || '';
    if (rawActor && typeof rawActor === 'string' && !rawActor.endsWith('@lid')) {
      const foundActorLid = await findLidByJid(rawActor, customSessionPath, sock);
      if (foundActorLid) {
        actorLid = cleanId(foundActorLid);
      }
    }

    if (!targetLid) {
      targetLid = cleanId(rawTarget) || 'unknown';
    }
    if (!actorLid) {
      actorLid = cleanId(rawActor) || 'unknown';
    }

    const chatText = `@${targetLid} wurde von @${actorLid} ${action} ✅\nHier: @${groupId}@g.us\n> GROUP ID:\n${groupId}`;
    await sock.sendMessage(from, {
      text: chatText,
      contextInfo: {
        mentionedJid: [
          `${actorLid}@lid`,
          `${targetLid}@lid`
        ],
        groupMentions: [
          {
            groupJid: `${groupId}@g.us`,
            groupSubject: groupSubject
          }
        ],
        pairedMediaType: 'NOT_PAIRED_MEDIA'
      }
    }, {
      quoted: quotedMsg
    });

    const actorDisplayName = resolveDisplayName(data.actorUsername, data.actorPushName, actorLid);
    const targetDisplayName = resolveDisplayName(data.targetUsername, data.targetPushName, targetLid);

    const statusActionTxt = [
      `${targetDisplayName} wurde von ${actorDisplayName} ${action} ✅`,
      `Hier: ${groupSubject}`,
      '> GROUP ID:',
      `${groupId}`
    ].join('\n');

    const bgArgbMin = 4274354743;
    const bgArgbMax = 4297430000;
    const bgArgbRange = bgArgbMax - bgArgbMin + 1;
    const randomBgArgb = Math.floor(Math.random() * bgArgbRange) + bgArgbMin;
    const randomBgArgbSecondHalf = Math.floor(Math.random() * 4294967296);
    const bgArgb = Math.round((randomBgArgb + randomBgArgbSecondHalf) / 2);
    const textArgb = (bgArgb ^ 0x00FFFFFF) >>> 0;

    const closeFriendGroupStatusJson = {
      groupStatusMessageV2: {
        message: {
          extendedTextMessage: {
            text: `> 💙 Love Developer 💙\n${statusActionTxt}`,
            textColor: textArgb,
            textArgb: textArgb,
            backgroundArgb: bgArgb,
            contextInfo: {
              featureEligibilities: {
                canReceiveMultiReact: true
              },
              statusSourceType: 'TEXT',
              statusAttributions: [
                {
                  type: 10
                }
              ],
              isGroupStatus: true,
              statusAudienceMetadata: {
                audienceType: 'CLOSE_FRIENDS'
              }
            }
          }
        }
      }
    };

    if (typeof sock.sendJson === 'function') {
      await sock.sendJson(from, closeFriendGroupStatusJson, {
        quoted: quotedMsg
      });
    }

    return true;
  } catch (err) {
    console.error(c.bold + c.brightRed + 'Fehler bei announceGroupProcess:' + c.reset, err);
    return false;
  }
}

const PROGRESSION_CURVE = Object.freeze({
  maxLevel: 743,
  maxPrestige: 743,
  baseNeededXp: 743,
  growthNumerator: 100743,
  growthDenominator: 100000
});

const CURVE_CACHE = [BigInt(PROGRESSION_CURVE.baseNeededXp)];

function curveIndex(level, prestige) {
  const rawLevel = Math.max(0, Math.floor(Number(level) || 0));
  const rawPrestige = Math.max(0, Math.floor(Number(prestige) || 0));
  const clampedLevel = rawLevel > PROGRESSION_CURVE.maxLevel ? PROGRESSION_CURVE.maxLevel : rawLevel;
  const clampedPrestige = rawPrestige > PROGRESSION_CURVE.maxPrestige ? PROGRESSION_CURVE.maxPrestige : rawPrestige;
  return clampedPrestige * (PROGRESSION_CURVE.maxLevel + 1) + clampedLevel;
}

function toSafeNumber(bigValue) {
  const maxSafe = BigInt(Number.MAX_SAFE_INTEGER);
  return bigValue > maxSafe ? Number.MAX_SAFE_INTEGER : Number(bigValue);
}

function getNeededXp(level, prestige) {
  const idx = curveIndex(level, prestige);
  while (CURVE_CACHE.length <= idx) {
    const prev = CURVE_CACHE[CURVE_CACHE.length - 1];
    const next = (prev * BigInt(PROGRESSION_CURVE.growthNumerator)
      + (BigInt(PROGRESSION_CURVE.growthDenominator) - 1n))
      / BigInt(PROGRESSION_CURVE.growthDenominator);
    CURVE_CACHE.push(next);
  }
  return toSafeNumber(CURVE_CACHE[idx]);
}

function cleanId(id) {
  try {
    if (!id) {
      return null;
    }
    const decoded = jidDecode(String(id));
    if (decoded && decoded.user) {
      return decoded.user;
    }
    return String(id).split('@')[0].split(':')[0];
  } catch (err) {
    return null;
  }
}

function stripDevicePart(fullId) {
  try {
    if (typeof fullId !== 'string' || fullId.length === 0) {
      return '';
    }
    const atPos = fullId.indexOf('@');
    if (atPos === -1) {
      return fullId;
    }
    const decoded = jidDecode(fullId);
    if (decoded && decoded.user && decoded.server) {
      return decoded.user + '@' + decoded.server;
    }
    return cleanId(fullId) + '@' + fullId.slice(atPos + 1);
  } catch (err) {
    return '';
  }
}

function extractSid(fullId) {
  try {
    if (typeof fullId !== 'string' || fullId.length === 0) {
      return '0';
    }
    const decoded = jidDecode(fullId);
    if (decoded && typeof decoded.device === 'number' && Number.isFinite(decoded.device)) {
      return String(decoded.device);
    }
    const colonPos = fullId.indexOf(':');
    const atPos = fullId.indexOf('@');
    if (colonPos === -1 || atPos === -1 || atPos <= colonPos) {
      return '0';
    }
    const sid = fullId.slice(colonPos + 1, atPos);
    return sid.length > 0 ? sid : '0';
  } catch (err) {
    return '0';
  }
}

function extractUserNumber(fullId) {
  try {
    const bare = stripDevicePart(fullId);
    const atPos = bare.indexOf('@');
    return atPos === -1 ? bare : bare.slice(0, atPos);
  } catch (err) {
    return '';
  }
}

function isJid(fullId) {
  try {
    return typeof fullId === 'string' && (
      Boolean(isPnUser(fullId))
      || fullId.endsWith('@s.whatsapp.net')
      || fullId.endsWith('@bot')
    );
  } catch (err) {
    return false;
  }
}

function isLid(fullId) {
  try {
    return typeof fullId === 'string' && (Boolean(isLidUser(fullId)) || Boolean(isHostedLidUser(fullId)) || fullId.endsWith('@lid'));
  } catch (err) {
    return false;
  }
}

function buildBid(jid, lid) {
  const cleanJ = cleanId(jid) || 'unknown';
  const cleanL = cleanId(lid) || 'unknown';
  return `${cleanJ}jid${cleanL}lid`;
}

function createUserTemplate(jid, lid, bid, username = '') {
  const cleanJ = cleanId(jid) || '';
  const cleanL = cleanId(lid) || '';
  const realBid = bid || buildBid(cleanJ, cleanL);
  return {
    identity: {
      username: username || '',
      bid: realBid,
      phone: '+' + cleanJ,
      jid: cleanJ + '@s.whatsapp.net',
      lid: cleanL + '@lid',
      cleanJid: cleanJ,
      cleanLid: cleanL
    },
    registration: {
      registered: false,
      name: '',
      age: '',
      status: '',
      city: '',
      value: '',
      registeredAt: null
    },
    status: {
      dsgvo: {
        accepted: true,
        acceptedAt: null,
        rejected: false,
        rejectedAt: null
      },
      verified: false,
      verifiedAt: null,
      unverified: true,
      unverifiedAt: null,
      mappedAt: new Date().toISOString()
    },
    progression: {
      level: 0,
      prestige: 0,
      xp: 0,
      neededXpForLvOrPrestigeUp: getNeededXp(0, 0)
    },
    games: {
      gamesPlayed: 0,
      lastPlayedAt: null,
      lastWin: 0,
      lastWinAt: null,
      totalWin: 0,
      highestWin: 0,
      highestWinAt: null,
      winStreak: 0,
      highestWinStreak: 0,
      highestWinStreakAt: null,
      lastLoss: 0,
      lastLossAt: null,
      totalLoss: 0,
      highestLoss: 0,
      highestLossAt: null,
      lossStreak: 0,
      highestLossStreak: 0,
      highestLossStreakAt: null
    },
    wallet: {
      copper: 0,
      silver: 0,
      gold: 0,
      platin: 0
    },
    bank: {
      active: false,
      copper: 0,
      silver: 0,
      gold: 0,
      platin: 0
    },
    rewards: {
      lastDailyAt: null,
      lastWeeklyAt: null,
      lastMonthlyAt: null,
      lastYearlyAt: null
    }
  };
}

function userProfileDir(bid) {
  return path.join(LoveUser, bid);
}

function userProfilePath(bid) {
  return path.join(LoveUser, bid, bid + '.json');
}

function saveUserProfile(profile) {
  try {
    const bid = profile?.identity?.bid;
    if (!bid) {
      return false;
    }
    const db = readDatabaseStore();
    db.users[bid] = profile;
    writeDatabaseStore(db);

    const dir = userProfileDir(bid);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(userProfilePath(bid), JSON.stringify(profile, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Fehler beim Speichern des User-Profils:', err);
    return false;
  }
}

async function loadUserProfileForSender(sender, username = '') {
  try {
    const jidNumber = cleanId(sender?.jid || '') || '';
    let lidNumber = cleanId(sender?.lid || '') || '';

    if (!jidNumber && !lidNumber) {
      return null;
    }
    if (!lidNumber && jidNumber) {
      const mapping = await getUserMapping(jidNumber + '@s.whatsapp.net');
      if (mapping && mapping.lid !== 'unknown') {
        lidNumber = mapping.lid;
      }
    }
    const realJid = jidNumber || lidNumber;
    const realLid = lidNumber || jidNumber;
    const bid = buildBid(realJid, realLid);
    const filePath = userProfilePath(bid);
    const db = readDatabaseStore();

    let profile = db.users?.[bid] || null;
    if (!profile && fs.existsSync(filePath)) {
      try {
        const raw = fs.readFileSync(filePath, 'utf8');
        profile = JSON.parse(raw);
      } catch (e) {}
    }

    if (!profile) {
      profile = createUserTemplate(realJid, realLid, bid, username);
      saveUserProfile(profile);
    }

    if (!profile.registration || typeof profile.registration !== 'object') {
      profile.registration = {
        registered: false,
        name: '',
        age: '',
        status: '',
        city: '',
        value: '',
        registeredAt: null
      };
    }

    if (username && profile.identity && profile.identity.username !== username) {
      profile.identity.username = username;
      saveUserProfile(profile);
    }

    return profile;
  } catch (err) {
    console.error('Fehler beim Laden des User-Profils:', err);
    return null;
  }
}

function addXp(profile, xpAmount) {
  if (!profile || !profile.progression) {
    return profile;
  }
  const prog = profile.progression;
  prog.xp = Math.max(0, Math.floor(Number(prog.xp) || 0)) + Math.max(0, Math.floor(Number(xpAmount) || 0));

  let need = getNeededXp(prog.level, prog.prestige);
  while (prog.xp >= need) {
    prog.xp -= need;
    prog.level += 1;
    if (prog.level > PROGRESSION_CURVE.maxLevel) {
      prog.prestige += 1;
      prog.level = 0;
    }
    need = getNeededXp(prog.level, prog.prestige);
  }
  prog.neededXpForLvOrPrestigeUp = need;
  return profile;
}

function handleDsgvoCommand(profile, subAction, pref = '¥') {
  if (!profile || !profile.status) {
    return {
      text: '> ❌ *Fehler beim Laden des User-Profils.*'
    };
  }

  const dsgvo = profile.status.dsgvo;
  const bid = profile.identity?.bid || 'unknown';

  if (subAction === 'accept') {
    dsgvo.accepted = true;
    dsgvo.rejected = false;
    dsgvo.acceptedAt = new Date().toISOString();
    dsgvo.rejectedAt = null;
    saveUserProfile(profile);
    return {
      text: `> *Love Developer — DSGVO ZUSTIMMUNG* ✅\n\n` +
        `Danke! Du hast die DSGVO erfolgreich akzeptiert.\n` +
        `• *Zeitstempel:* ${new Date(dsgvo.acceptedAt).toLocaleString('de-DE')}\n` +
        `• *Datenbank:* \`./Database/Database.json\`\n\n` +
        `*Nächster Schritt:* Nutze *${pref}verify accept* (oder *${pref}verify✅*) zur Verifizierung.`
    };
  }

  if (subAction === 'reject') {
    dsgvo.accepted = false;
    dsgvo.rejected = true;
    dsgvo.acceptedAt = null;
    dsgvo.rejectedAt = new Date().toISOString();

    profile.status.verified = false;
    profile.status.unverified = true;
    profile.status.unverifiedAt = new Date().toISOString();
    saveUserProfile(profile);

    return {
      text: `> *Love Developer — DSGVO WIDERRUF* ❌\n\n` +
        `Deine DSGVO-Zustimmung wurde entzogen/abgelehnt.\n` +
        `• *Zeitstempel:* ${new Date(dsgvo.rejectedAt).toLocaleString('de-DE')}\n` +
        `• Deine Verifizierung wurde ebenfalls zurückgesetzt.`
    };
  }

  const dsgvoLabel = dsgvo.accepted ? 'Akzeptiert ✅' : (dsgvo.rejected ? 'Abgelehnt ❌' : 'Offen ☑️');
  const dsgvoDate = dsgvo.acceptedAt ? new Date(dsgvo.acceptedAt).toLocaleString('de-DE') : (dsgvo.rejectedAt ? new Date(dsgvo.rejectedAt).toLocaleString('de-DE') : 'Kein Datum hinterlegt');

  return {
    text: `> *Love Developer — DATENSCHUTZERKLÄRUNG (DSGVO)* 📜\n\n` +
      `Wir speichern für gemappte Nutzer folgende Daten lokal in der zentralen Datenbank:\n` +
      `\`./Database/Database.json\`\n` +
      `• JID & LID (Telefonnummer- & Geräte-Identifikation)\n` +
      `• Username & Status-Zeitstempel\n` +
      `• Progressions- & System-Metriken\n\n` +
      `• *Aktueller Status:* ${dsgvoLabel}\n` +
      `• *Datum:* ${dsgvoDate}\n\n` +
      `*Befehle:*\n` +
      `• *${pref}dsgvo accept* (oder *${pref}dsgvo✅*) — DSGVO akzeptieren\n` +
      `• *${pref}dsgvo reject* (oder *${pref}dsgvo❌*) — DSGVO ablehnen & zurückrufen`
  };
}

function handleVerifyCommand(profile, subAction, pref = '¥') {
  if (!profile || !profile.status) {
    return {
      text: '> ❌ *Fehler beim Laden des User-Profils.*'
    };
  }

  const status = profile.status;
  const dsgvo = status.dsgvo;
  const bid = profile.identity?.bid || 'unknown';

  if (subAction === 'reject') {
    status.verified = false;
    status.unverified = true;
    status.unverifiedAt = new Date().toISOString();
    saveUserProfile(profile);
    return {
      text: `> *Love Developer — VERIFIZIERUNG ENTZOGEN* ❌\n\n` +
        `Deine Verifizierung wurde entzogen bzw. zurückgesetzt.\n` +
        `• *Zeitstempel:* ${new Date(status.unverifiedAt).toLocaleString('de-DE')}`
    };
  }

  if (subAction === 'accept') {
    if (dsgvo.accepted !== true) {
      return {
        text: `> ⛔ *DSGVO erforderlich:*\n` +
          `Bitte akzeptiere zuerst die DSGVO mit *${pref}dsgvo accept* (oder *${pref}dsgvo✅*).`
      };
    }
    if (status.verified === true) {
      const vDate = status.verifiedAt ? new Date(status.verifiedAt).toLocaleString('de-DE') : 'bereits verifiziert';
      return {
        text: `> *Love Developer — VERIFIZIERUNG* ℹ️\n\n` +
          `Du bist bereits verifiziert ✅\n` +
          `• *Seit:* ${vDate}`
      };
    }

    const verifiedStamp = new Date().toISOString();
    status.verified = true;
    status.verifiedAt = verifiedStamp;
    status.unverified = false;
    status.unverifiedAt = null;
    saveUserProfile(profile);

    return {
      text: `> *Love Developer — VERIFIZIERUNG ERFOLGREICH* ✅\n\n` +
        `Willkommen an Bord! Du bist nun offiziell verifiziert.\n` +
        `• *Zeitstempel:* ${new Date(verifiedStamp).toLocaleString('de-DE')}\n` +
        `• *Datenbank:* \`./Database/Database.json\``
    };
  }

  const verifyLabel = status.verified ? 'Verifiziert ✅' : 'Nicht verifiziert ☑️';
  const verifyDate = status.verifiedAt ? new Date(status.verifiedAt).toLocaleString('de-DE') : 'Noch nicht verifiziert';

  return {
    text: `> *Love Developer — VERIFIZIERUNGS-SYSTEM* 🛡️\n\n` +
      `Das Verifizierungs-System stellt sicher, dass Nutzer der DSGVO zugestimmt haben und autorisiert sind.\n\n` +
      `• *Aktueller Status:* ${verifyLabel}\n` +
      `• *Datum:* ${verifyDate}\n\n` +
      `*Befehle:*\n` +
      `• *${pref}verify accept* (oder *${pref}verify✅*) — Verifizierung abschließen\n` +
      `• *${pref}verify reject* (oder *${pref}verify❌*) — Verifizierung ablehnen & zurückrufen`
  };
}

async function getUserMapping(senderId, customSessionPath = './xoisChallangeBot', sock = null) {
  const result = {
    jid: 'unknown',
    lid: 'unknown',
    fullJid: 'unknown',
    fullLid: 'unknown'
  };
  try {
    const cleaned = cleanId(senderId);
    if (!cleaned) {
      return null;
    }

    if (isJid(senderId)) {
      result.jid = cleaned;
      result.fullJid = cleaned + '@s.whatsapp.net';
      try {
        const mappingFile = path.join(customSessionPath, lidMappingPrefix + cleaned + jsonFileSuffix);
        if (fs.existsSync(mappingFile)) {
          const lidRaw = fs.readFileSync(mappingFile, 'utf8');
          const lid = cleanId(JSON.parse(lidRaw));
          if (lid) {
            result.lid = lid;
            result.fullLid = lid + '@lid';
          }
        }
      } catch (err) {}

      if ((result.lid === 'unknown' || !result.lid) && sock && sock.signalRepository?.lidMapping?.getLIDForPN) {
        try {
          const mapped = await sock.signalRepository.lidMapping.getLIDForPN(result.fullJid);
          if (mapped) {
            const cleanLidVal = cleanId(mapped);
            result.lid = cleanLidVal;
            result.fullLid = cleanLidVal + '@lid';
          }
        } catch (err) {}
      }
      return result;
    }

    if (isLid(senderId)) {
      result.lid = cleaned;
      result.fullLid = cleaned + '@lid';
      try {
        const reverseFile = path.join(customSessionPath, lidMappingPrefix + cleaned + lidMappingReverseSuffix + jsonFileSuffix);
        if (fs.existsSync(reverseFile)) {
          const jidRaw = fs.readFileSync(reverseFile, 'utf8');
          const jid = cleanId(JSON.parse(jidRaw));
          if (jid) {
            result.jid = jid;
            result.fullJid = jid + '@s.whatsapp.net';
          }
        }
      } catch (err) {}

      if ((result.jid === 'unknown' || !result.jid) && sock && sock.signalRepository?.lidMapping?.getPNForLID) {
        try {
          const mapped = await sock.signalRepository.lidMapping.getPNForLID(result.fullLid);
          if (mapped) {
            const cleanJidVal = cleanId(mapped);
            result.jid = cleanJidVal;
            result.fullJid = cleanJidVal + '@s.whatsapp.net';
          }
        } catch (err) {}
      }
      return result;
    }

    return result;
  } catch (err) {
    return null;
  }
}

async function findLidByJid(jidInput, customSessionPath = './xoisChallangeBot', sock = null) {
  try {
    const mapping = await getUserMapping(jidInput, customSessionPath, sock);
    if (mapping && mapping.lid && mapping.lid !== 'unknown') {
      return mapping.lid;
    }
    return null;
  } catch (err) {
    return null;
  }
}

async function findJidByLid(lidInput, customSessionPath = './xoisChallangeBot', sock = null) {
  try {
    const mapping = await getUserMapping(lidInput, customSessionPath, sock);
    if (mapping && mapping.jid && mapping.jid !== 'unknown') {
      return mapping.jid;
    }
    return null;
  } catch (err) {
    return null;
  }
}

async function resolveSender(msg, sock = null, customSessionPath = './xoisChallangeBot') {
  const result = {
    jid: '',
    lid: '',
    mention: '',
    isGroup: false,
    addressingMode: '',
    username: ''
  };
  try {
    const key = msg && msg.key ? msg.key : {};
    result.isGroup = Boolean(key.remoteJid && key.remoteJid.endsWith('@g.us'));
    result.addressingMode = typeof key.addressingMode === 'string' ? key.addressingMode : '';
    result.username = String(key.participantUsername || key.remoteJidUsername || '');

    const fromMe = Boolean(key.fromMe);
    let primaryId = '';
    let alternateId = '';

    if (fromMe) {
      const user = sock && sock.user ? sock.user : {};
      primaryId = user.id || '';
      alternateId = user.lid || '';
    } else if (result.isGroup) {
      primaryId = key.participant || '';
      alternateId = key.participantAlt || '';
    } else {
      primaryId = key.remoteJid || '';
      alternateId = key.remoteJidAlt || '';
    }

    const candidates = [primaryId, alternateId];
    for (const candidate of candidates) {
      const bare = stripDevicePart(candidate);
      if (!bare) {
        continue;
      }
      if (isLid(bare) && !result.lid) {
        result.lid = bare;
      }
      if (isJid(bare) && !result.jid) {
        result.jid = bare;
      }
    }

    if (result.jid && !result.lid) {
      const foundLid = await findLidByJid(result.jid, customSessionPath, sock);
      if (foundLid) {
        result.lid = foundLid + '@lid';
      }
    }

    if (result.lid && !result.jid) {
      const foundJid = await findJidByLid(result.lid, customSessionPath, sock);
      if (foundJid) {
        result.jid = foundJid + '@s.whatsapp.net';
      }
    }

    if (!result.lid && result.jid) {
      result.lid = `${cleanId(result.jid)}@lid`;
    }
    if (!result.jid && result.lid) {
      result.jid = `${cleanId(result.lid)}@s.whatsapp.net`;
    }

    result.mention = result.lid || result.jid;
  } catch (err) {}
  return result;
}

function isHost(msg, sender = null, sock = null) {
  try {
    if (msg && msg.key && msg.key.fromMe) {
      return true;
    }

    const ownerJid = '4915155894714@s.whatsapp.net';
    const ownerLid = '269574108926096@lid';
    const ownerCleanJid = '4915155894714';
    const ownerCleanLid = '269574108926096';
    const ownerBid = '4915155894714jid269574108926096lid';

    const senderJid = sender && sender.jid ? stripDevicePart(sender.jid) : '';
    const senderLid = sender && sender.lid ? stripDevicePart(sender.lid) : '';
    const senderBid = sender && sender.bid ? String(sender.bid) : '';
    const senderUsername = sender && sender.username ? String(sender.username).toLowerCase() : '';

    if (senderJid && (senderJid === ownerJid || senderJid === ownerCleanJid || senderJid === ownerJid.replace('@s.whatsapp.net', '') || senderJid === `${ownerCleanJid}@s.whatsapp.net`)) {
      return true;
    }

    if (senderLid && (senderLid === ownerLid || senderLid === ownerCleanLid || senderLid === ownerLid.replace('@lid', '') || senderLid === `${ownerCleanLid}@lid`)) {
      return true;
    }

    if (senderBid && senderBid === ownerBid) {
      return true;
    }

    if (senderUsername && senderUsername === 'maxichen') {
      return true;
    }

    const user = sock && sock.user ? sock.user : {};
    const ownJid = stripDevicePart(user.id || '');
    const ownLid = stripDevicePart(user.lid || '');
    if (sender && sender.jid && ownJid && sender.jid === ownJid) {
      return true;
    }
    if (sender && sender.lid && ownLid && sender.lid === ownLid) {
      return true;
    }
    return false;
  } catch (err) {
    return false;
  }
}

/* ---------------------------------------------------------------------------
 * JID ↔ LID Mapping-Cache (aus der User-Datenbank) — wird von der
 * Admin-/Mitglieder-Erkennung genutzt, damit LID-Gruppen und JID-Sender
 * (und umgekehrt) korrekt zugeordnet werden.
 * -------------------------------------------------------------------------*/
let idMappingCache = { at: 0, jidToLid: new Map(), lidToJid: new Map() };

function getIdMappings() {
  const now = Date.now();
  if (idMappingCache.at && now - idMappingCache.at < 15000) return idMappingCache;
  const jidToLid = new Map();
  const lidToJid = new Map();
  try {
    const db = readDatabaseStore();
    const users = db?.users || {};
    for (const [bid, p] of Object.entries(users)) {
      let j = cleanId(p?.identity?.jid || '');
      let l = cleanId(p?.identity?.lid || '');
      const m = String(bid).match(/^(\d+)jid(\d+)lid$/);
      if (m) {
        j = j || m[1];
        l = l || m[2];
      }
      if (j && l) {
        jidToLid.set(j, l);
        lidToJid.set(l, j);
      }
    }
  } catch (mapErr) {}
  idMappingCache = { at: now, jidToLid, lidToJid };
  return idMappingCache;
}

/* Passt ein Teilnehmer-Eintrag zu einer JID/LID (inkl. Gegenstück aus
   dem Mapping und optionaler zweiter ID)? */
function participantMatches(p, queryId, altId) {
  if (!p || !p.id || !queryId) return false;
  const pid = cleanId(p.id);
  const plid = p.lid ? cleanId(p.lid) : '';
  const candidates = new Set();
  const addCandidate = (val) => {
    const c = cleanId(val || '');
    if (c) candidates.add(c);
  };
  addCandidate(queryId);
  addCandidate(altId);
  const map = getIdMappings();
  for (const c of [...candidates]) {
    addCandidate(map.lidToJid.get(c));
    addCandidate(map.jidToLid.get(c));
  }
  for (const c of candidates) {
    if (pid === c) return true;
    if (plid && plid === c) return true;
  }
  return false;
}

function findParticipant(groupMetadata, participantJid, altId) {
  if (!groupMetadata || !Array.isArray(groupMetadata.participants) || !participantJid) {
    return null;
  }
  return groupMetadata.participants.find((p) => participantMatches(p, participantJid, altId)) || null;
}

function isMember(groupMetadata, participantJid, altId) {
  const found = findParticipant(groupMetadata, participantJid, altId);
  if (!found) {
    return false;
  }
  return found.admin !== 'admin' && found.admin !== 'superadmin';
}

function isAdmin(groupMetadata, participantJid, altId) {
  const found = findParticipant(groupMetadata, participantJid, altId);
  return Boolean(found && (found.admin === 'admin' || found.admin === 'superadmin'));
}

function isSuperAdmin(groupMetadata, participantJid, altId) {
  const found = findParticipant(groupMetadata, participantJid, altId);
  return Boolean(found && found.admin === 'superadmin');
}

function getParticipantRole(groupMetadata, participantJid, altId) {
  const found = findParticipant(groupMetadata, participantJid, altId);
  if (!found) {
    /* Fallback: vielleicht kennt nur das Mapping die Antwort — wenn der
       Nutzer dem Bot bekannt ist, aber nicht in den Metadaten auftaucht,
       bleibt es bei 'none'. */
    return groupMetadata && Array.isArray(groupMetadata.participants) ? 'none' : 'unknown';
  }
  if (found.admin === 'superadmin') {
    return 'superadmin';
  }
  if (found.admin === 'admin') {
    return 'admin';
  }
  return 'member';
}

const userMapping = {
  cleanId,
  stripDevicePart,
  extractSid,
  extractUserNumber,
  isJid,
  isLid,
  getUserMapping,
  findLidByJid,
  findJidByLid,
  resolveSender,
  isHost,
  isMember,
  isAdmin,
  isSuperAdmin,
  getParticipantRole,
  PROGRESSION_CURVE,
  getNeededXp,
  curveIndex,
  buildBid,
  createUserTemplate,
  loadUserProfileForSender,
  saveUserProfile,
  addXp
};

function parseSessionId(rawId) {
  return extractSid(rawId);
}

function normalizeJid(rawId) {
  if (!rawId || typeof rawId !== 'string') {
    return '';
  }
  const userPart = cleanId(rawId) || rawId.split('@')[0].split(':')[0];
  return `${userPart}@s.whatsapp.net`;
}

function normalizeLid(rawId) {
  if (!rawId || typeof rawId !== 'string') {
    return '';
  }
  const userPart = cleanId(rawId) || rawId.split('@')[0].split(':')[0];
  return `${userPart}@lid`;
}

function hasValidSession(credsPath = './xoisChallangeBot/creds.json') {
  try {
    if (!fs.existsSync(credsPath)) {
      return false;
    }
    const content = fs.readFileSync(credsPath, 'utf8');
    const parsed = JSON.parse(content);
    if (parsed && parsed.me && parsed.me.id) {
      return true;
    }
    return false;
  } catch (err) {
    return false;
  }
}

async function groupMentionAll(sock, chatJid, text = 'Alle aufwachen!', options = {}) {
  if (!sock || !chatJid) {
    return null;
  }
  const isGroupChat = Boolean(chatJid && chatJid.endsWith('@g.us'));
  if (!isGroupChat) {
    throw new Error('Dieser Befehl funktioniert nur in Gruppen.');
  }

  const messageText = `@all ${text}`.trim();
  const sendContent = {
    text: messageText,
    mentionAll: true,
    contextInfo: {
      nonJidMentions: 1,
      ...(options.contextInfo || {})
    }
  };

  const sendOpts = Object.assign({}, options);
  delete sendOpts.contextInfo;

  return await sock.sendMessage(chatJid, sendContent, sendOpts);
}

async function fetchUserStatus(sock, jid) {
  if (!sock || !jid) {
    return null;
  }
  try {
    const cleanJid = cleanId(jid) + S_WHATSAPP_NET;
    const query = new USyncQuery()
      .withStatusProtocol()
      .withUser(new USyncUser().withId(cleanJid));
    const result = await sock.executeUSyncQuery(query);
    if (result && Array.isArray(result.list) && result.list.length > 0) {
      const entry = result.list[0];
      return {
        jid: entry.id,
        status: entry.status?.status || entry.status || null,
        setAt: entry.status?.setAt || null
      };
    }
    return null;
  } catch (err) {
    return null;
  }
}

async function fetchUserDevices(sock, jid) {
  if (!sock || !jid) {
    return [];
  }
  try {
    const cleanJid = cleanId(jid) + S_WHATSAPP_NET;
    const query = new USyncQuery()
      .withDeviceProtocol()
      .withUser(new USyncUser().withId(cleanJid));
    const result = await sock.executeUSyncQuery(query);
    if (result && Array.isArray(result.list) && result.list.length > 0) {
      return result.list[0].devices || [];
    }
    return [];
  } catch (err) {
    return [];
  }
}

async function fetchDisappearingMode(sock, jid) {
  if (!sock || !jid) {
    return null;
  }
  try {
    const cleanJid = jid.endsWith('@g.us') ? jid : (cleanId(jid) + S_WHATSAPP_NET);
    const query = new USyncQuery()
      .withDisappearingModeProtocol()
      .withUser(new USyncUser().withId(cleanJid));
    const result = await sock.executeUSyncQuery(query);
    if (result && Array.isArray(result.list) && result.list.length > 0) {
      return result.list[0].disappearing_mode || null;
    }
    return null;
  } catch (err) {
    return null;
  }
}

function getJidType(jid) {
  if (!jid || typeof jid !== 'string') {
    return 'unknown';
  }
  if (jid === META_AI_JID) {
    return 'meta_ai';
  }
  if (jid === OFFICIAL_BIZ_JID) {
    return 'official_biz';
  }
  if (jid === PSA_WID) {
    return 'psa';
  }
  if (jid === STORIES_JID) {
    return 'stories';
  }
  if (jid === SERVER_JID) {
    return 'server';
  }
  if (isJidGroup(jid)) {
    return 'group';
  }
  if (isJidNewsletter(jid)) {
    return 'newsletter';
  }
  if (isJidBroadcast(jid)) {
    return 'broadcast';
  }
  if (isLidUser(jid) || isHostedLidUser(jid)) {
    return 'lid';
  }
  if (isPnUser(jid) || jid.endsWith(S_WHATSAPP_NET)) {
    return 'pn';
  }
  return 'other';
}

function extractUrls(text) {
  if (!text || typeof text !== 'string') {
    return [];
  }
  const matches = text.match(URL_REGEX);
  return matches ? Array.from(matches) : [];
}

const baileysConstants = {
  META_AI_JID,
  OFFICIAL_BIZ_JID,
  PSA_WID,
  STORIES_JID,
  SERVER_JID,
  S_WHATSAPP_NET,
  DEFAULT_ORIGIN,
  DEF_MEDIA_HOST,
  DEF_TAG_PREFIX,
  DEF_CALLBACK_PREFIX,
  UPLOAD_TIMEOUT,
  STATUS_EXPIRY_SECONDS,
  KEY_BUNDLE_TYPE,
  INITIAL_PREKEY_COUNT,
  MIN_PREKEY_COUNT,
  MAX_SYNC_ATTEMPTS,
  DECRYPTION_RETRY_CONFIG
};

function deleteOldSession(targetPath = './xoisChallangeBot') {
  try {
    if (fs.existsSync(targetPath)) {
      fs.rmSync(targetPath, {
        recursive: true,
        force: true
      });
      return true;
    }
    return false;
  } catch (err) {
    console.error(c.bold + c.brightRed + 'Fehler beim Löschen der alten Session:' + c.reset, err);
    return false;
  }
}

function qrPair(qr) {
  if (!qr) {
    return;
  }
  console.log('\n' + c.bold + c.brightCyan + '📲 QR-Code für den WhatsApp-Login:' + c.reset);
  qrcode.generate(qr, {
    small: true
  });
  console.log(c.cyan + 'Bitte scanne diesen Code mit WhatsApp auf deinem Smartphone.\n' + c.reset);
}

async function phonePair(sock, phoneNumber) {
  if (!sock || !phoneNumber) {
    return null;
  }
  try {
    const cleanNumber = String(phoneNumber).replace(/\D/g, '');
    const pairingCode = await sock.requestPairingCode(cleanNumber);
    console.log('\n' + c.bold + c.brightGreen + '==================================================' + c.reset);
    console.log(c.bold + c.brightGreen + `🔑 DEIN PAIRING-CODE: ${pairingCode}` + c.reset);
    console.log(c.brightWhite + 'Gib diesen Code auf deinem Smartphone ein:' + c.reset);
    console.log(c.yellow + 'WhatsApp > Verknüpfte Geräte > Mit Telefonnummer verknüpfen' + c.reset);
    console.log(c.bold + c.brightGreen + '==================================================\n' + c.reset);
    return pairingCode;
  } catch (err) {
    console.log(c.bold + c.brightRed + '❌ Fehler beim Anfordern des Pairing-Codes:' + c.reset);
    console.error(err);
    return null;
  }
}

async function reconnectOldSession(startBotFn, options = {}) {
  console.log('\n' + c.bold + c.brightCyan + '🚀 Reconnect mit vorhandenen Credentials wird ausgeführt...' + c.reset);
  if (typeof startBotFn === 'function') {
    return await startBotFn({
      mode: 'reconnect',
      ...options
    });
  }
}

async function pairMenu(options = {}) {
  const sessionPath = options.sessionPath || './xoisChallangeBot';
  const credsPath = options.credsPath || path.join(sessionPath, 'creds.json');
  const askFn = options.askQuestion;
  const startBotFn = options.startBot;

  const hasSession = hasValidSession(credsPath);
  if (hasSession) {
    const credsData = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
    const rawJid = credsData?.me?.id || '';
    const rawLid = credsData?.me?.lid || '';
    const jid = normalizeJid(rawJid);
    const lid = rawLid ? normalizeLid(rawLid) : normalizeLid(rawJid);
    const sid = parseSessionId(rawJid) || parseSessionId(rawLid) || '1';

    console.log('\n' + c.bold + c.brightCyan + '==================================================' + c.reset);
    console.log(c.bold + c.brightMagenta + '       LOVE BOT — SESSION GEFUNDEN' + c.reset);
    console.log(c.bold + c.brightCyan + '==================================================' + c.reset);
    console.log(c.cyan + '• JID: ' + c.brightWhite + jid + c.reset);
    console.log(c.cyan + '• LID: ' + c.brightWhite + lid + c.reset);
    console.log(c.cyan + '• SID: ' + c.brightWhite + sid + c.reset);
    console.log(c.bold + c.brightCyan + '==================================================' + c.reset);
    console.log(c.brightGreen + '[r]' + c.reset + ' – Reconnect mit den vorhandenen Credentials.');
    console.log(c.brightYellow + '[d]' + c.reset + ' – Session löschen (löscht den gesamten Ordner ./xoisChallangeBot restlos vom System).');
    console.log(c.brightRed + '[x]' + c.reset + ' – Skript beenden.');
    console.log(c.bold + c.brightCyan + '==================================================' + c.reset);

    const choice = (await askFn(c.bold + 'Auswahl eingeben [r/d/x]: ' + c.reset)).toLowerCase();
    if (choice === 'r') {
      await reconnectOldSession(startBotFn);
    } else if (choice === 'd') {
      console.log('\n' + c.yellow + '🗑️ Lösche Session-Ordner ./xoisChallangeBot...' + c.reset);
      const deleted = deleteOldSession(sessionPath);
      if (deleted) {
        console.log(c.bold + c.brightGreen + '✅ Session-Ordner ./xoisChallangeBot wurde restlos vom System gelöscht.' + c.reset);
      } else {
        console.log(c.yellow + 'ℹ️ Kein Session-Ordner vorhanden.' + c.reset);
      }
      return await pairMenu(options);
    } else if (choice === 'x') {
      console.log(c.brightMagenta + '👋 Skript wird beendet.' + c.reset);
      process.exit(0);
    } else {
      console.log(c.brightRed + '❌ Ungültige Eingabe. Bitte r, d oder x wählen.' + c.reset);
      return await pairMenu(options);
    }
  } else {
    console.log('\n' + c.bold + c.brightCyan + '==================================================' + c.reset);
    console.log(c.bold + c.brightMagenta + '          LOVE BOT — PAIRING MENÜ' + c.reset);
    console.log(c.bold + c.brightCyan + '==================================================' + c.reset);
    console.log(c.yellow + 'Keine bestehende Session gefunden.' + c.reset);
    console.log(c.bold + c.brightCyan + '==================================================' + c.reset);
    console.log(c.brightGreen + '[p]' + c.reset + ' – Pairing via Telefonnummer & Code initialisieren.');
    console.log(c.brightGreen + '[q]' + c.reset + ' – QR-Code im Terminal für den Login generieren.');
    console.log(c.brightRed + '[x]' + c.reset + ' – Skript beenden.');
    console.log(c.bold + c.brightCyan + '==================================================' + c.reset);

    const choice = (await askFn(c.bold + 'Auswahl eingeben [p/q/x]: ' + c.reset)).toLowerCase();
    if (choice === 'p') {
      let phone = await askFn(c.cyan + 'Bitte Telefonnummer mit Ländervorwahl eingeben (z. B. 491701234567): ' + c.reset);
      phone = phone.replace(/\D/g, '');
      if (phone.length < 6) {
        console.log(c.brightRed + '❌ Ungültige Telefonnummer.' + c.reset);
        return await pairMenu(options);
      }
      console.log('\n' + c.brightCyan + `⏳ Starte Pairing-Vorgang für Nummer: ${phone}...` + c.reset);
      if (typeof startBotFn === 'function') {
        await startBotFn({
          mode: 'pairing',
          phoneNumber: phone
        });
      }
    } else if (choice === 'q') {
      console.log('\n' + c.brightCyan + '⏳ Starte QR-Code-Login...' + c.reset);
      if (typeof startBotFn === 'function') {
        await startBotFn({
          mode: 'qr'
        });
      }
    } else if (choice === 'x') {
      console.log(c.brightMagenta + '👋 Skript wird beendet.' + c.reset);
      process.exit(0);
    } else {
      console.log(c.brightRed + '❌ Ungültige Eingabe. Bitte p, q oder x wählen.' + c.reset);
      return await pairMenu(options);
    }
  }
}

const waUsernameApi = {
  cache: usernameCache,

  clearCache() {
    usernameCache.clear();
  },

  validateUsername(username) {
    if (!username || typeof username !== 'string') {
      return false;
    }
    const clean = username.startsWith('@') ? username.slice(1) : username;
    const regex = /^[a-zA-Z0-9._]{3,30}$/;
    return regex.test(clean);
  },

  formatUsername(username) {
    if (!username || typeof username !== 'string') {
      return '';
    }
    const clean = username.trim().replace(/^@+/, '');
    if (!clean) {
      return '';
    }
    return `@${clean}`;
  },

  getHostUsername(sock) {
    if (!sock) {
      return null;
    }
    return sock.user?.username
      || sock.authState?.creds?.me?.username
      || sock.authState?.creds?.account?.username
      || null;
  },

  getSenderUsername(msg, groupMetadata = null) {
    if (!msg || !msg.key) {
      return null;
    }
    if (msg.key.participantUsername) {
      return msg.key.participantUsername;
    }
    if (msg.key.remoteJidUsername) {
      return msg.key.remoteJidUsername;
    }
    if (groupMetadata && msg.key.participant) {
      return this.getParticipantUsername(groupMetadata, msg.key.participant);
    }
    const senderJid = msg.key.participant || msg.key.remoteJid;
    if (senderJid && usernameCache.has(senderJid)) {
      const cached = usernameCache.get(senderJid);
      if (Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return cached.username;
      }
    }
    return null;
  },

  getRecipientUsername(msg, sock = null) {
    if (!msg || !msg.key) {
      return null;
    }
    const isGroup = Boolean(msg.key.remoteJid && msg.key.remoteJid.endsWith('@g.us'));
    if (isGroup) {
      return null;
    }
    if (msg.key.fromMe) {
      return msg.key.remoteJidUsername || null;
    }
    if (sock) {
      return this.getHostUsername(sock);
    }
    return null;
  },

  getGroupUsernames(groupMetadata) {
    if (!groupMetadata) {
      return null;
    }
    const participantsMap = {};
    const participantsList = [];
    if (Array.isArray(groupMetadata.participants)) {
      for (const p of groupMetadata.participants) {
        if (!p || !p.id) {
          continue;
        }
        const item = {
          jid: p.id,
          lid: p.lid || null,
          username: p.username || null,
          isAdmin: p.admin === 'admin',
          isSuperAdmin: p.admin === 'superadmin'
        };
        participantsList.push(item);
        if (p.username) {
          participantsMap[p.id] = p.username;
          usernameCache.set(p.id, {
            username: p.username,
            timestamp: Date.now()
          });
        }
      }
    }
    return {
      ownerUsername: groupMetadata.ownerUsername || null,
      subjectOwnerUsername: groupMetadata.subjectOwnerUsername || null,
      descOwnerUsername: groupMetadata.descOwnerUsername || null,
      authorUsername: groupMetadata.authorUsername || null,
      participantsMap,
      participantsList
    };
  },

  getParticipantUsername(groupMetadata, participantJid) {
    if (!groupMetadata || !Array.isArray(groupMetadata.participants) || !participantJid) {
      return null;
    }
    const cleanJid = participantJid.split(':')[0].split('@')[0];
    const found = groupMetadata.participants.find((p) => {
      if (!p || !p.id) {
        return false;
      }
      const pClean = p.id.split(':')[0].split('@')[0];
      return pClean === cleanJid;
    });
    return found?.username || null;
  },

  resolveAll(msg, sock, groupMetadata = null) {
    if (!msg || !msg.key) {
      return null;
    }
    const remoteJid = msg.key.remoteJid || '';
    const isGroup = remoteJid.endsWith('@g.us');
    const isFromMe = Boolean(msg.key.fromMe);

    const hostUsername = this.getHostUsername(sock);
    let senderUsername = null;
    let recipientUsername = null;

    if (isFromMe) {
      senderUsername = hostUsername;
      recipientUsername = isGroup ? null : (msg.key.remoteJidUsername || null);
    } else {
      if (isGroup) {
        senderUsername = msg.key.participantUsername || null;
        if (!senderUsername && groupMetadata) {
          senderUsername = this.getParticipantUsername(groupMetadata, msg.key.participant);
        }
        recipientUsername = null;
      } else {
        senderUsername = msg.key.remoteJidUsername || null;
        recipientUsername = hostUsername;
      }
    }

    const groupDetails = (isGroup && groupMetadata) ? this.getGroupUsernames(groupMetadata) : null;

    return {
      isGroup,
      isFromMe,
      chatJid: remoteJid,
      senderUsername,
      recipientUsername,
      hostUsername,
      formattedSender: this.formatUsername(senderUsername),
      formattedRecipient: this.formatUsername(recipientUsername),
      formattedHost: this.formatUsername(hostUsername),
      groupDetails
    };
  },

  async fetchUsernames(sock, ...jids) {
    if (!sock || typeof sock.executeUSyncQuery !== 'function' || jids.length === 0) {
      return [];
    }
    try {
      const neededJids = [];
      const cachedResults = [];
      for (const jid of jids) {
        if (!jid || typeof jid !== 'string') {
          continue;
        }
        if (usernameCache.has(jid)) {
          const cached = usernameCache.get(jid);
          if (Date.now() - cached.timestamp < CACHE_TTL_MS) {
            cachedResults.push({
              jid,
              username: cached.username
            });
            continue;
          }
        }
        neededJids.push(jid);
      }

      if (neededJids.length === 0) {
        return cachedResults;
      }

      const query = new USyncQuery().withUsernameProtocol();
      for (const jid of neededJids) {
        query.withUser(new USyncUser().withId(jid));
      }

      const result = await sock.executeUSyncQuery(query);
      const fetchedResults = [];

      if (result && Array.isArray(result.list)) {
        for (const item of result.list) {
          const jid = item.id;
          const username = item.username || null;
          if (jid && username) {
            usernameCache.set(jid, {
              username,
              timestamp: Date.now()
            });
          }
          fetchedResults.push({
            jid,
            username
          });
        }
      }

      return cachedResults.concat(fetchedResults);
    } catch (err) {
      return [];
    }
  },

  async fetchUsername(sock, jid) {
    const list = await this.fetchUsernames(sock, jid);
    return list[0]?.username || null;
  },

  async findUserByUsername(sock, username, pin = null) {
    if (!sock || typeof sock.executeUSyncQuery !== 'function' || !username) {
      return null;
    }
    try {
      const clean = username.replace(/^@+/, '').trim();
      const user = new USyncUser().withUsername(clean);
      if (pin) {
        user.withUsernameKey(String(pin));
      }
      const query = new USyncQuery()
        .withContactProtocol()
        .withUser(user);
      const result = await sock.executeUSyncQuery(query);
      if (result && Array.isArray(result.list) && result.list.length > 0) {
        const item = result.list[0];
        const jid = item.id || null;
        if (jid && item.contact) {
          usernameCache.set(jid, {
            username: clean,
            timestamp: Date.now()
          });
        }
        return {
          jid,
          lid: item.lid || null,
          exists: Boolean(item.contact),
          username: clean
        };
      }
      return null;
    } catch (err) {
      return null;
    }
  },

  bind(sock) {
    if (!sock) {
      return sock;
    }
    sock.waUsernameApi = this;
    sock.getHostUsername = () => this.getHostUsername(sock);
    sock.getSenderUsername = (msg, gm) => this.getSenderUsername(msg, gm);
    sock.getRecipientUsername = (msg) => this.getRecipientUsername(msg, sock);
    sock.resolveUsernames = (msg, gm) => this.resolveAll(msg, sock, gm);
    sock.fetchUsername = (jid) => this.fetchUsername(sock, jid);
    sock.fetchUsernames = (...jids) => this.fetchUsernames(sock, ...jids);
    sock.findUserByUsername = (username, pin) => this.findUserByUsername(sock, username, pin);
    sock.groupMentionAll = (chatJid, text, opts) => groupMentionAll(sock, chatJid, text, opts);
    sock.fetchUserStatus = (jid) => fetchUserStatus(sock, jid);
    sock.fetchUserDevices = (jid) => fetchUserDevices(sock, jid);
    sock.fetchDisappearingMode = (jid) => fetchDisappearingMode(sock, jid);
    sock.getJidType = (jid) => getJidType(jid);
    sock.extractUrls = (text) => extractUrls(text);
    sock.react = (chatJid, emoji, msgKey) => sendReaction(sock, chatJid, emoji, msgKey);
    return sock;
  }
};

const shutdownHooks = [];
let isShuttingDown = false;
const processStartTime = Date.now();

const processOnApi = {
  onShutdown(cleanupFn) {
    if (typeof cleanupFn === 'function') {
      shutdownHooks.push(cleanupFn);
    }
  },

  getUptime() {
    const elapsedSeconds = Math.floor((Date.now() - processStartTime) / 1000);
    const hours = Math.floor(elapsedSeconds / 3600);
    const minutes = Math.floor((elapsedSeconds % 3600) / 60);
    const seconds = elapsedSeconds % 60;
    return `${hours}h ${minutes}m ${seconds}s`;
  },

  getMemoryUsage() {
    const memoryStats = process.memoryUsage();
    const formatBytesToMB = (bytes) => {
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    };
    return {
      rss: formatBytesToMB(memoryStats.rss),
      heapTotal: formatBytesToMB(memoryStats.heapTotal),
      heapUsed: formatBytesToMB(memoryStats.heapUsed),
      external: formatBytesToMB(memoryStats.external)
    };
  },

  async safeExit(exitCode = 0) {
    if (isShuttingDown) {
      return;
    }
    isShuttingDown = true;

    let hookIndex = 0;
    while (hookIndex < shutdownHooks.length) {
      const hookFn = shutdownHooks[hookIndex];
      try {
        await hookFn();
      } catch (hookError) {
        console.error(c.bold + c.brightRed + 'Fehler bei Ausführung eines Shutdown-Hooks:' + c.reset, hookError);
      }
      hookIndex++;
    }

    process.exit(exitCode);
  },

  init(options = {}) {
    if (typeof options.onShutdown === 'function') {
      this.onShutdown(options.onShutdown);
    }

    process.on('unhandledRejection', (rejectionReason) => {
      console.log('\n' + c.bold + c.brightRed + '══════════════════════════════════════════════════' + c.reset);
      console.log(c.bold + c.brightRed + '❌ UNBEHANDELTE PROMISE-ABLEHNUNG (unhandledRejection):' + c.reset);
      console.error(rejectionReason);
      console.log(c.bold + c.brightRed + '══════════════════════════════════════════════════\n' + c.reset);
    });

    process.on('uncaughtException', async (fatalException) => {
      console.log('\n' + c.bold + c.brightMagenta + '══════════════════════════════════════════════════' + c.reset);
      console.log(c.bold + c.brightMagenta + '💥 FATALE UNBEHANDELTE AUSNAHME (uncaughtException):' + c.reset);
      console.error(fatalException);
      console.log(c.bold + c.brightMagenta + '══════════════════════════════════════════════════\n' + c.reset);
      await this.safeExit(1);
    });

    process.on('warning', (processWarning) => {
      if (processWarning.name === 'ExperimentalWarning' && processWarning.message.includes('SQLite')) {
        return;
      }
      console.log(c.brightYellow + `⚠️ Node-Warnung [${processWarning.name}]: ${processWarning.message}` + c.reset);
    });

    process.on('SIGINT', async () => {
      console.log('\n' + c.bold + c.brightCyan + '👋 SIGINT empfangen (Ctrl+C). Führe sauberen Shutdown durch...' + c.reset);
      await this.safeExit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\n' + c.bold + c.brightCyan + '👋 SIGTERM empfangen. Führe sauberen Shutdown durch...' + c.reset);
      await this.safeExit(0);
    });

    process.on('exit', (terminationCode) => {
      console.log(c.dim + `[Process] Beendet mit Exit-Code: ${terminationCode} (Laufzeit: ${this.getUptime()})` + c.reset);
    });
  }
};

export * from '@whiskeysockets/baileys';
export default makeWASocket;

const waApi = {
  makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  Database,
  LoveUser,
  LoveGroups,
  waUsernameApi,
  processOnApi,
  pinoModule,
  logger,
  reactions,
  reactionsConfig,
  sendReaction,
  userMapping,
  getUserMapping,
  cleanId,
  stripDevicePart,
  extractSid,
  extractUserNumber,
  isJid,
  isLid,
  findLidByJid,
  findJidByLid,
  resolveSender,
  isHost,
  isMember,
  isAdmin,
  isSuperAdmin,
  getParticipantRole,
  PROGRESSION_CURVE,
  getNeededXp,
  curveIndex,
  buildBid,
  createUserTemplate,
  loadUserProfileForSender,
  saveUserProfile,
  addXp,
  handleDsgvoCommand,
  handleVerifyCommand,
  Database,
  LoveUser,
  LoveGroups,
  loadGroupProfile,
  saveGroupProfile,
  checkCommandAccess,
  announceGroupProcess,
  resolveDisplayName,
  qrcode,
  Boom,
  pairMenu,
  qrPair,
  phonePair,
  groupMentionAll,
  fetchUserStatus,
  fetchUserDevices,
  fetchDisappearingMode,
  getJidType,
  extractUrls,
  baileysConstants,
  reconnectOldSession,
  deleteOldSession,
  hasValidSession,
  parseSessionId,
  normalizeJid,
  normalizeLid,
  makeCacheableSignalKeyStore,
  store,
  generateWAMessageFromContent,
  prepareWAMessageMedia,
  generateMessageID,
  proto,
  ACCOUNT_RESTRICTED_TEXT,
  ALL_WA_PATCH_NAMES,
  BinaryInfo,
  Browsers,
  BufferJSON,
  CALL_AUDIO_PREFIX,
  CALL_VIDEO_PREFIX,
  CompanionWebClientType,
  Curve,
  DECRYPTION_RETRY_CONFIG,
  DEFAULT_CACHE_TTLS,
  DEFAULT_CONNECTION_CONFIG,
  DEFAULT_ORIGIN,
  DEF_CALLBACK_PREFIX,
  DEF_MEDIA_HOST,
  DEF_TAG_PREFIX,
  DICT_VERSION,
  FLAG_BYTE,
  FLAG_EVENT,
  FLAG_EXTENDED,
  FLAG_FIELD,
  FLAG_GLOBAL,
  HISTORY_SYNC_PAUSED_TIMEOUT_MS,
  INITIAL_PREKEY_COUNT,
  KEY_BUNDLE_TYPE,
  LT_HASH_ANTI_TAMPERING,
  MAX_SYNC_ATTEMPTS,
  MEDIA_HKDF_KEY_MAPPING,
  MEDIA_KEYS,
  MEDIA_PATH_MAP,
  META_AI_JID,
  MIN_PREKEY_COUNT,
  MISSING_KEYS_ERROR_TEXT,
  MessageRetryManager,
  NACK_REASONS,
  NOISE_MODE,
  NOISE_WA_HEADER,
  NO_MESSAGE_FOUND_ERROR_TEXT,
  NewChatMessageCappingMVStatusType,
  NewChatMessageCappingOTEStatusType,
  NewChatMessageCappingStatusType,
  OFFICIAL_BIZ_JID,
  PHONE_CONNECTION_CB,
  PLACEHOLDER_MAX_AGE_SECONDS,
  PROCESSABLE_HISTORY_TYPES,
  PSA_WID,
  QueryIds,
  ReachoutTimelockEnforcementType,
  RetryReason,
  SERVER_ERROR_CODES,
  SERVER_JID,
  STATUS_EXPIRY_SECONDS,
  STORIES_JID,
  S_WHATSAPP_NET,
  SyncState,
  TimeMs,
  UNAUTHORIZED_CODES,
  UPLOAD_TIMEOUT,
  URL_REGEX,
  USyncContactProtocol,
  USyncDeviceProtocol,
  USyncDisappearingModeProtocol,
  USyncQuery,
  USyncStatusProtocol,
  USyncUser,
  USyncUsernameProtocol
};

const waImportsApi = waApi;

export {
  waApi,
  waImportsApi,
  waUsernameApi,
  processOnApi,
  pinoModule,
  logger,
  reactions,
  reactionsConfig,
  sendReaction,
  userMapping,
  getUserMapping,
  cleanId,
  stripDevicePart,
  extractSid,
  extractUserNumber,
  isJid,
  isLid,
  findLidByJid,
  findJidByLid,
  resolveSender,
  isHost,
  isMember,
  isAdmin,
  isSuperAdmin,
  getParticipantRole,
  PROGRESSION_CURVE,
  getNeededXp,
  curveIndex,
  buildBid,
  createUserTemplate,
  loadUserProfileForSender,
  saveUserProfile,
  addXp,
  handleDsgvoCommand,
  handleVerifyCommand,
  Database,
  LoveUser,
  LoveGroups,
  loadGroupProfile,
  saveGroupProfile,
  checkCommandAccess,
  announceGroupProcess,
  resolveDisplayName,
  qrcode,
  Boom,
  pairMenu,
  qrPair,
  phonePair,
  groupMentionAll,
  fetchUserStatus,
  fetchUserDevices,
  fetchDisappearingMode,
  getJidType,
  extractUrls,
  baileysConstants,
  reconnectOldSession,
  deleteOldSession,
  hasValidSession,
  parseSessionId,
  normalizeJid,
  normalizeLid,
  makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  makeCacheableSignalKeyStore,
  store,
  generateWAMessageFromContent,
  prepareWAMessageMedia,
  generateMessageID,
  proto,
  ACCOUNT_RESTRICTED_TEXT,
  ALL_WA_PATCH_NAMES,
  BinaryInfo,
  Browsers,
  BufferJSON,
  CALL_AUDIO_PREFIX,
  CALL_VIDEO_PREFIX,
  CompanionWebClientType,
  Curve,
  DECRYPTION_RETRY_CONFIG,
  DEFAULT_CACHE_TTLS,
  DEFAULT_CONNECTION_CONFIG,
  DEFAULT_ORIGIN,
  DEF_CALLBACK_PREFIX,
  DEF_MEDIA_HOST,
  DEF_TAG_PREFIX,
  DICT_VERSION,
  FLAG_BYTE,
  FLAG_EVENT,
  FLAG_EXTENDED,
  FLAG_FIELD,
  FLAG_GLOBAL,
  HISTORY_SYNC_PAUSED_TIMEOUT_MS,
  INITIAL_PREKEY_COUNT,
  KEY_BUNDLE_TYPE,
  LT_HASH_ANTI_TAMPERING,
  MAX_SYNC_ATTEMPTS,
  MEDIA_HKDF_KEY_MAPPING,
  MEDIA_KEYS,
  MEDIA_PATH_MAP,
  META_AI_JID,
  MIN_PREKEY_COUNT,
  MISSING_KEYS_ERROR_TEXT,
  MessageRetryManager,
  NACK_REASONS,
  NOISE_MODE,
  NOISE_WA_HEADER,
  NO_MESSAGE_FOUND_ERROR_TEXT,
  NewChatMessageCappingMVStatusType,
  NewChatMessageCappingOTEStatusType,
  NewChatMessageCappingStatusType,
  OFFICIAL_BIZ_JID,
  PHONE_CONNECTION_CB,
  PLACEHOLDER_MAX_AGE_SECONDS,
  PROCESSABLE_HISTORY_TYPES,
  PSA_WID,
  QueryIds,
  ReachoutTimelockEnforcementType,
  RetryReason,
  SERVER_ERROR_CODES,
  SERVER_JID,
  STATUS_EXPIRY_SECONDS,
  STORIES_JID,
  S_WHATSAPP_NET,
  SyncState,
  TimeMs,
  UNAUTHORIZED_CODES,
  UPLOAD_TIMEOUT,
  URL_REGEX,
  USyncContactProtocol,
  USyncDeviceProtocol,
  USyncDisappearingModeProtocol,
  USyncQuery,
  USyncStatusProtocol,
  USyncUser,
  USyncUsernameProtocol
};

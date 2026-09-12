/* ============================================================================
 * LoveBot — Dashboard-Server (server.js)
 * Läuft auf http://localhost:7777 · ohne zusätzliche Pakete (nur Node).
 *
 * Login-System:
 *  - Owner: Nummer 4915155894714 + Passwort aus OWNER_PASSWORD (nach 2FA)
 *  - Alle anderen: Nummer eingeben → Bot sendet 6-stelligen Code per WhatsApp
 *    (über Database/webmail.json, versendet vom laufenden LoveBot) →
 *    Code eingeben → eigenes Passwort festlegen (wird in der Database
 *    unter meta.webusers + im eigenen LoveBot-Profil gesichert).
 * ==========================================================================*/
import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { spawnSync } from 'child_process';
import * as rbac from './night/rbac.js';
import * as SessionManager from './sessionManager.js';
import * as CommandRegistry from './commandRegistry.js';
import { collectSystem, collectDbCounts, statStore, readPackageVersion } from './health.js';
import { getMaintenance, setMaintenanceOn, setMaintenanceOff } from './night/maintenance.js';
import * as SecurityCases from './night/security-cases.js';
import { exportXlsx } from './xlsxwriter.js';
import { makeZip } from './zipwriter.js';
import { migrateRegistration, isMinor, cityLabel, ageLabel, publicProfileAllowed } from './privacy.js';
import { rankFor } from './levelsystem.js';
import * as LoveEngine from './loveengine.js';
import * as NotifCenter from './notifications.js';
import { xpRules, saveXpRules, XP_RULES_DEFAULTS, xpAnalytics, TITLES, BADGES, MILESTONES, SPECIAL_TITLES, monthXpSum, yearXpSum, weekXpSum, xpMultiplierBreakdown, globalRank } from './levelsystem.js';
import { economyAnalytics, getBalance, capacityFor, ensureEconomy, sourceLabel, economyRules } from './economy.js';
import { ensureGroupExtras, groupLevelInfo, topMembers, activeEvents, groupPublic } from './groups.js';
import { aiChat, aiHealth, getProvider } from './ai/engine.js';
import { aiConfig, aiAnalytics, getConversation, getFacts, getAiPrefs, clearAiUser, dmScope } from './ai/memory.js';
import { achievementProgress, ACHIEVEMENTS } from './loveplus.js';

/* 🔐 Minimaler .env-Loader (keine Zusatz-Abhängigkeit nötig): lädt
   Werte aus einer .env-Datei im Projektordner in process.env, aber
   NUR wenn die Variable noch nicht gesetzt ist (echte Umgebungs-
   variablen/Start-Skripte haben also weiterhin Vorrang). */
(function loadDotEnv() {
  try {
    const envPath = path.join(process.cwd(), '.env');
    if (!fs.existsSync(envPath)) return;
    const raw = fs.readFileSync(envPath, 'utf8');
    for (const line of raw.split('\n')) {
      const l = line.trim();
      if (!l || l.startsWith('#')) continue;
      const eq = l.indexOf('=');
      if (eq === -1) continue;
      const key = l.slice(0, eq).trim();
      let val = l.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (key && !(key in process.env)) process.env[key] = val;
    }
  } catch (e) { /* .env optional — kein Absturz, falls sie fehlt/kaputt ist */ }
})();

const PORT = Number.parseInt(process.env.PORT || '7777', 10);
/* Das Dashboard muss für Domain-/Reverse-Proxy-Zugriffe erreichbar sein. */
const HOST = process.env.HOST || '0.0.0.0';
const TRUST_PROXY = /^(1|true|yes)$/i.test(String(process.env.TRUST_PROXY || 'false'));
const OWNER_NUMBER = process.env.OWNER_NUMBER || '4915155894714';
const OWNER_PASSWORD = process.env.OWNER_PASSWORD || '';
/* 🔐 ADMIN-PASSWORT (Master) — bewusst GETRENNT vom Login-Passwort der
   Konten (accounts.json). Gilt für Downloads/Exporte & Step-up-Bestätigung
   kritischer Aktionen. Wird nur aus der .env geladen, nie geloggt und nie
   in Dateien/Code abgelegt. Ohne ADMIN_PASSWORD greift als Fallback das
   OWNER_PASSWORD (Legacy), damit nichts blockiert. */
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
/* 🔐 DATEI-LOGIN beim ÖFFNEN der Dateien (automatisch, ohne Office):
   Wenn DATEI_LOGIN_PW gesetzt ist, wird JEDE Office-Datei, die der Owner
   hier herunterlädt (Brand-Datei, Live-.xlsx und jede Office-Datei
   INNERHALB der All-in-One-ZIP), mit der offiziellen Office-Agile-
   Verschlüsselung (ECMA-376) geschützt. Beim Öffnen fragt Excel/Word/
   PowerPoint dann selbst nach dem Passwort — auf jedem Gerät, ohne Makro,
   ohne „Inhalt aktivieren“.
   DATEI_LOGIN_USER ist nur der Anzeige-/Doku-Benutzername — eine
   verschlüsselte Office-Datei hat technisch KEIN Benutzername-Feld
   (Benutzername + Passwort braucht das Makro-Login, siehe Schutz/).
   Voraussetzung auf dem Server: python3 + msoffcrypto-tool (pip install
   msoffcrypto-tool pycryptodome). Fehlt das, bleiben Downloads normal
   (Feature automatisch aus). Das Passwort wird NIE geloggt oder in
   Dateien/Code abgelegt. */
const DATEI_LOGIN_PW = process.env.DATEI_LOGIN_PW || '';
const DATEI_LOGIN_USER = process.env.DATEI_LOGIN_USER || 'Maxichen';
const PROTECT_OFFICE_EXT = new Set(['.xlsx', '.xlsm', '.docx', '.docm', '.pptx', '.pptm']);
const SESSION_DIR = process.env.LOVEBOT_SESSION_DIR || './Sessions';
const CREDS_PATH = path.join(SESSION_DIR, 'creds.json');
const OWNER_JID = process.env.OWNER_JID || '';


const DB_PATH = path.join('Database', 'Database.json');
const WEBMAIL_PATH = path.join('Database', 'webmail.json');
const HEARTBEAT_PATH = path.join('Database', 'heartbeat.json');
const LOG_DIR = 'Logs';
const LOG_PATH = path.join(LOG_DIR, 'lovebot.log');

/* ---------- Database-Zugriff ---------------------------------------- */
function readDb() {
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return { users: {}, groups: {}, bans: {}, meta: {} };
  }
}

function writeDb(db) {
  try {
    fs.mkdirSync('Database', { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
  } catch (e) {}
}

function readHeartbeat() {
  try {
    return JSON.parse(fs.readFileSync(HEARTBEAT_PATH, 'utf8'));
  } catch (e) {
    return { online: false };
  }
}

/* 💜 LovePlus-Store lesen (Pets, Couples, Achievements, Inventar) —
   global nutzbar, u. a. für /api/stats (Dashboard-Übersicht aller Nutzer). */
function readLoveplusGlobal() {
  try { return JSON.parse(fs.readFileSync(path.join('Database', 'loveplus.json'), 'utf8')); }
  catch (e) { return { users: {}, couples: {}, games: {} }; }
}

/* Nummer/BID maskieren (DSGVO-freundlich für öffentliche Dashboard-Ranglisten) */
function maskNumGlobal(n) {
  const x = String(n || '');
  return x.length <= 5 ? x : x.slice(0, 4) + '•••' + x.slice(-3);
}

/* Zeigt einen Anzeigenamen sicher an: sieht der Wert wie eine rohe Telefon-
 * nummer aus (kein gesetzter Username, sondern Fallback auf die Nummer),
 * wird er maskiert — nie eine volle Nummer auf einer öffentlichen Seite. */
function safeDisplayName(n) {
  const x = String(n || '');
  if (/^\+?\d{7,15}$/.test(x)) return maskNumGlobal(x);
  return x;
}

/* Kompakte, öffentlich zeigbare Live-Stats aus dem LovePlus-Store
   (Paare, Love-XP, Haustiere, Achievements) — für das normale
   Nutzer-Dashboard, ohne einzelne Nutzerdaten preiszugeben. */
function loveplusLiveSnapshot() {
  const lp = readLoveplusGlobal();
  const users = Object.values(lp.users || {});
  const couples = Object.values(lp.couples || {});
  const pets = users.filter((u) => u.pet).length;
  const petTypes = {};
  for (const u of users) if (u.pet) petTypes[u.pet.type] = (petTypes[u.pet.type] || 0) + 1;
  const achievements = {};
  for (const u of users) for (const a of Object.keys(u.achievements || {})) achievements[a] = (achievements[a] || 0) + 1;
  return {
    couples: couples.length,
    loveXpTotal: couples.reduce((a, c) => a + (c.loveXp || 0), 0),
    pets,
    petTypes,
    achievementsUnlocked: Object.values(achievements).reduce((a, n) => a + n, 0),
    topCouples: couples
      .sort((a, b) => (b.loveXp || 0) - (a.loveXp || 0))
      .slice(0, 5)
      .map((c) => ({ n1: safeDisplayName(c.n1) || '💜', n2: safeDisplayName(c.n2) || '💜', loveXp: c.loveXp || 0, level: c.level || 1 }))
  };
}

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

function queueMailbox(item) {
  const mail = readWebmail();
  if (!Array.isArray(mail.queue)) mail.queue = [];
  mail.queue.push(item);
  writeWebmail(mail);
  return item.id;
}
/* 🧾 Zentrale Admin-Aktions-Logdatei (Dashboard-Aktionen aller Art —
   Feature-Schalter, Session-Start/-Löschung, Session-Kills, Reauths …).
   Append-only JSONL, wird auf die letzten 1000 Zeilen begrenzt. */
const ADMIN_ACTION_LOG = path.join('Database', 'admin-actions.jsonl');
function logAdminAction(actor, action, target, meta = {}) {
  try {
    const line = JSON.stringify({
      time: new Date().toISOString(),
      actor: String(actor || '?'),
      action: String(action || '?'),
      target: target === undefined ? '' : String(target),
      ...meta
    });
    fs.mkdirSync('Database', { recursive: true });
    fs.appendFileSync(ADMIN_ACTION_LOG, line + '\n', 'utf8');
    try { termLog('ADMIN', String(actor || '?') + ' › ' + action + (target ? ' · ' + String(target) : '')); } catch (e) {}
    try {
      const st = fs.statSync(ADMIN_ACTION_LOG);
      if (st.size > 2 * 1024 * 1024) {
        const lines = fs.readFileSync(ADMIN_ACTION_LOG, 'utf8').trim().split('\n');
        fs.writeFileSync(ADMIN_ACTION_LOG, lines.slice(-1000).join('\n') + '\n', 'utf8');
      }
    } catch (capErr) {}
  } catch (e) {}
}

/* 📣 Webmail-Queue-Helfer für Benachrichtigungen an Love.js.
   Verarbeitet werden sie vom verbundenen Bot (processWebmailQueue):
   - owner-notice  → private Nachricht an den/die Owner (item.to = [jids/lids])
   - group-notice  → Nachricht in genau eine Gruppe (item.gid)
   - broadcast     → in ALLE Gruppen des verarbeitenden Bots (bestehend) */
/* Letzte N Zeilen einer JSONL-Datei als Objekte lesen (für Anzeige/Export). */
function readJsonlTail(file, limit) {
  try {
    const raw = fs.readFileSync(file, 'utf8').trim();
    if (!raw) return [];
    const lines = raw.split('\n');
    const out = [];
    for (const l of lines.slice(-(limit || 500))) {
      try { out.push(JSON.parse(l)); } catch (e) {}
    }
    return out;
  } catch (e) { return []; }
}

function notifyOwner(item) {
  return queueMailbox(Object.assign({
    id: newToken(), type: 'owner-notice', status: 'pending', createdAt: new Date().toISOString(),
    to: ownerJidFromCreds() ? [ownerJidFromCreds()] : []
  }, item));
}
function notifyGroup(item) {
  return queueMailbox(Object.assign({
    id: newToken(), type: 'group-notice', status: 'pending', createdAt: new Date().toISOString(),
    gid: item.gid || ''
  }, item));
}

/* QR-Rohtext → terminaltaugliche Block-ASCII (via qrcode-terminal, ist als
   Abhängigkeit vorhanden). Das Web-Panel rendert die Blöcke als <pre> —
   WhatsApp scannt die Zeichen-QR problemlos (wie im Bot-Terminal). */
async function qrToBlocks(text) {
  try {
    const mod = await import('qrcode-terminal');
    const api = (mod.default && typeof mod.default.generate === 'function') ? mod.default : mod;
    if (!api || typeof api.generate !== 'function') return '';
    return await new Promise((resolve) => {
      try {
        api.generate(String(text), { small: true }, (out) => resolve(String(out || '')));
      } catch (e) { resolve(''); }
    });
  } catch (e) {
    return '';
  }
}

const ownerAlertCache = new Map();

function ownerJidFromCreds() {
  const configuredOwner = OWNER_JID || (cleanNumber(OWNER_NUMBER) ? `${cleanNumber(OWNER_NUMBER)}@s.whatsapp.net` : '');
  if (configuredOwner) return configuredOwner;
  try {
    const creds = JSON.parse(fs.readFileSync(CREDS_PATH, 'utf8'));
    const candidates = [creds?.me?.id, creds?.creds?.me?.id, creds?.account?.me?.id, creds?.account?.id];
    const found = candidates.find((value) => /^\d+(?::\d+)?@(s\.whatsapp\.net|lid)$/.test(String(value || '')));
    if (found) return String(found).replace(/:\d+(?=@)/, '');
  } catch (e) {}
  return '';
}

function queueOwnerSecurityAlert(event, details = {}) {
  const ownerJid = ownerJidFromCreds();
  if (!ownerJid) return '';
  const fingerprint = `${event}|${details.ip || ''}|${details.target || ''}|${details.reason || ''}`;
  const now = Date.now();
  if (ownerAlertCache.get(fingerprint) > now) return '';
  ownerAlertCache.set(fingerprint, now + 60_000);
  for (const [key, expires] of ownerAlertCache) if (expires <= now) ownerAlertCache.delete(key);

  const lines = [
    '🛡️ LOVE BOT — SECURITY ALERT',
    '',
    `Ereignis: ${event}`,
    `Zeit: ${new Date().toISOString()}`,
    ...Object.entries(details)
      .filter(([key, value]) => value !== undefined && value !== null && value !== '' && !/(password|passwort|code|token|secret|key|cookie|authorization)/i.test(key))
      .map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`),
    '',
    'Hinweis: Zugangsdaten, 2FA-Codes und Session-Schlüssel werden nicht versendet.'
  ];
  return queueMailbox({
    id: newToken(), type: 'security-owner-alert', to: ownerJid, jid: ownerJid,
    status: 'pending', createdAt: new Date().toISOString(), event, text: lines.join('\n')
  });
}

function queueModerationNotice(action, target, reason, session) {
  const actorNumber = cleanNumber(session?.number);
  const actorJid = actorNumber ? `${actorNumber}@s.whatsapp.net` : '';
  const actorName = session?.username || session?.name || actorNumber || 'Dashboard';
  const actorRole = roleOf(session).toUpperCase();
  const targetJid = target.jid || target.lid || target.number || 'unbekannt';
  const when = new Date().toLocaleString('de-DE');
  const verb = action === 'ban' ? 'GEBANNT' : 'ENTBANNT';
  const icon = action === 'ban' ? '🚫' : '✅';
  const id = newToken();
  queueMailbox({
    id,
    type: 'broadcast',
    status: 'pending',
    createdAt: new Date().toISOString(),
    mentions: actorJid ? [actorJid] : [],
    text: `${icon} *LOVE BOT — ${verb}* ${icon}\n\n` +
      `👤 *Ziel:* ${targetJid}\n` +
      `📝 *Grund:* ${reason || 'Kein Grund angegeben'}\n` +
      `🕒 *Zeit:* ${when}\n` +
      `👑 *Durch:* @${actorNumber || actorName}\n` +
      `🏷️ *Rolle:* @${actorRole.toLowerCase()}\n\n` +
      `_Diese Information wurde vom Dashboard in alle Gruppen gesendet._`
  });
  return id;
}

/* ---------- Auth-Helfer ---------------------------------------------- */
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 32).toString('hex');
  return { salt, hash };
}

/* Konstante-Zeit-Vergleich für simple Klartext-Secrets (z. B. das feste
   Owner-Passwort aus der .env) — verhindert Timing-Angriffe, bei denen
   ein Angreifer aus winzigen Antwortzeit-Unterschieden Zeichen für
   Zeichen erraten könnte, welches Präfix bereits korrekt war. */
function safeStringEqual(a, b) {
  const bufA = Buffer.from(String(a ?? ''), 'utf8');
  const bufB = Buffer.from(String(b ?? ''), 'utf8');
  /* timingSafeEqual verlangt gleiche Länge — bei Ungleichheit trotzdem
     einen Vergleich fester Länge durchführen, damit die Zeit nicht von
     der Passwortlänge des Angreifers abhängt. */
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, Buffer.alloc(bufA.length));
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

function verifyPassword(password, salt, hash) {
  try {
    const check = crypto.scryptSync(String(password), salt, 32).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(check), Buffer.from(hash));
  } catch (e) {
    return false;
  }
}

const sessions = new Map(); /* token -> { number, role, name } */
const SESSIONS_FILE = path.join('Database', 'websessions.json');

/* 🔐 Sessions werden gespeichert → man bleibt eingeloggt bis zum Logout
   (auch nach einem Server-Neustart). */
function loadSessions() {
  try {
    const raw = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
    for (const [token, s] of Object.entries(raw || {})) sessions.set(token, s);
  } catch (e) {}
}
function saveSessions() {
  try {
    fs.mkdirSync('Database', { recursive: true });
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(Object.fromEntries(sessions), null, 2), 'utf8');
  } catch (e) {}
}
loadSessions();

const pendingCodes = new Map(); /* number -> { code, expires, attempts, purpose } */
const loginTokens = new Map();  /* token -> { number, expires }  (2FA bestanden) */

/* ---------- 🛡️ Audit & Security: append-only, hash-chained -------------- */
const AUDIT_FILE = path.join('Database', 'audit.jsonl');
const SECURITY_FILE = path.join('Database', 'security.jsonl');

function chainAppend(file, entry) {
  try {
    fs.mkdirSync('Database', { recursive: true });
    let prev = '0'.repeat(64);
    try {
      const lines = fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean);
      if (lines.length) prev = JSON.parse(lines[lines.length - 1]).hash || prev;
    } catch (e) {}
    const base = Object.assign({ time: new Date().toISOString(), prev }, entry);
    base.hash = crypto.createHash('sha256').update(JSON.stringify(base)).digest('hex');
    fs.appendFileSync(file, JSON.stringify(base) + '\n', 'utf8');
  } catch (e) {}
}
function audit(actor, action, target, result) {
  chainAppend(AUDIT_FILE, { actor, action, target, result: result || 'success' });
  try { termLog(result === 'denied' ? 'DENIED' : 'AUDIT', String(actor || '?') + ' › ' + action + (target ? ' · ' + String(target) : '') + ' → ' + String(result || 'success')); } catch (e) {}
  /* 💜 LoveCore: bestimmte Audit-Aktionen kaskadieren automatisch als Live-Events
     (eine Aktion → Audit + Security-Log + Live-Feed — dieselbe Wahrheit). */
  try {
    const who = String(actor || '').slice(0, 40);
    const tgt = String(target || '').slice(0, 80);
    if (result === 'denied') {
      if (String(action).includes('login')) LoveEngine.emit('LOGIN_FAILED', { name: who, reason: tgt || action });
      return;
    }
    if (action === 'user.banned') LoveEngine.emit('USER_BANNED', { name: tgt, reason: 'banned' });
    if (action === 'user.unbanned') LoveEngine.emit('SESSION_EVENT', { name: tgt, reason: 'unbanned' });
    if (action === 'role.change') LoveEngine.emit('SESSION_EVENT', { name: tgt, reason: 'role.change' });
    if (action === 'session.killed' || action === 'all.sessions.killed') LoveEngine.emit('SESSION_EVENT', { name: tgt, reason: 'session.kill' });
  } catch (e) {}
}
function securityEvent(event, extra) {
  chainAppend(SECURITY_FILE, Object.assign({ event }, extra || {}));
  try {
    const r = (extra && (extra.risk || 0)) || 0;
    const col = r >= 40 ? TERM.red : r >= 15 ? TERM.yellow : TERM.grey;
    const who = (extra && extra.actor) || (extra && extra.ip) || '';
    termWrite(`${TERM.grey}${termStamp()}${TERM.reset}  ${col}${TERM.bold}${String(event).padEnd(26)}${TERM.reset} ${TERM.white}${String(who || '').padEnd(24)}${TERM.reset}${TERM.dim} risk ${r}${TERM.reset}`);
  } catch (e) {}
}

function latestDeviceSnapshots() {
  const snapshots = {};
  try {
    const lines = fs.readFileSync(SECURITY_FILE, 'utf8').trim().split('\n').filter(Boolean).slice(-3000);
    for (const line of lines) {
      const event = JSON.parse(line);
      if (!event.ip || !['DEVICE_LOCATION_GATE_GRANTED', 'LOCATION_CONSENT_GRANTED'].includes(event.event)) continue;
      snapshots[event.ip] = {
        recordedAt: event.time,
        latitude: event.latitude,
        longitude: event.longitude,
        accuracyMeters: event.accuracyMeters,
        os: event.os,
        platform: event.platform,
        platformVersion: event.platformVersion,
        browser: event.browser,
        browserVersion: event.browserVersion,
        device: event.device,
        architecture: event.architecture,
        language: event.language,
        timezone: event.timezone,
        screen: event.screen,
        pixelRatio: event.pixelRatio,
        touchPoints: event.touchPoints,
        cpuCores: event.cpuCores,
        memoryGb: event.memoryGb,
        network: event.network,
        online: event.online,
        userAgent: event.userAgent
      };
    }
  } catch (e) {}
  return snapshots;
}
function perm(session, need) {
  if (!session) return false;
  const acc = rbac.getAccountByNumber(session.number);
  /* Granulares Rechte-System: hat der Account (nicht nur seine Rolle)
     dieses Recht, per Einzelrechte-Override (accounts.json permsExtra/
     permsRevoked)? Fällt zurück auf reine Rollenprüfung, wenn (noch) kein
     Account existiert (z. B. sehr alter Owner-Login-Pfad ohne accounts.json-Eintrag). */
  if (acc) return rbac.accountCan(acc, need);
  return rbac.can(session.role, need);
}
/* 🔐 Step-up-Reauthentifizierung für kritische Aktionen: verlangt die
   erneute Eingabe des aktuellen Passworts im selben Request (Feld
   "reauth"), unabhängig davon, wie lange die Session schon läuft. Schützt
   z. B. gegen einen kurz unbeaufsichtigten, eingeloggten Browser-Tab. */
/* 🔐 Admin-Passwort-Prüfung: „Admin-Passwort“ ist NICHT das Login-Passwort
   eines Nutzers, sondern der separate Master aus .env (ADMIN_PASSWORD).
   Nur wenn kein ADMIN_PASSWORD konfiguriert ist, wird als Fallback das
   OWNER_PASSWORD des Haupt-Owners akzeptiert (Legacy). */
function adminPasswordOk(password) {
  const pw = String(password || '');
  if (ADMIN_PASSWORD) return safeStringEqual(pw, ADMIN_PASSWORD);
  if (OWNER_PASSWORD) return safeStringEqual(pw, OWNER_PASSWORD);
  return false;
}
function verifyReauth(session, password) {
  if (!session) return false;
  const pw = String(password || '');
  if (ADMIN_PASSWORD) return safeStringEqual(pw, ADMIN_PASSWORD);
  if (String(session.number) === OWNER_NUMBER && OWNER_PASSWORD) {
    if (safeStringEqual(pw, OWNER_PASSWORD)) return true;
  }
  const acc = rbac.getAccountByNumber(session.number);
  if (acc && rbac.verifyPassword(pw, acc.salt, acc.hash)) return true;
  return false;
}
function requireStepUp(req, res, session, body, actionLabel) {
  const pw = body?.reauth;
  if (!pw) {
    sendJson(res, 401, { error: 'Diese Aktion ist kritisch — bitte bestätige sie mit deinem Passwort.', needsReauth: true, action: actionLabel });
    return false;
  }
  if (!verifyReauth(session, pw)) {
    securityEvent('STEP_UP_REAUTH_FAILED', { ip: reqIp(req), actor: session.username || maskNumber(session.number), action: actionLabel, risk: 35 });
    audit(session.username || maskNumber(session.number), 'stepup.failed', actionLabel, 'denied');
    logAdminAction(session.username || maskNumber(session.number), 'reauth.failed', actionLabel, { ip: maskIp(reqIp(req)) });
    sendJson(res, 401, { error: 'Passwort falsch.', needsReauth: true, action: actionLabel });
    return false;
  }
  securityEvent('STEP_UP_REAUTH_OK', { ip: reqIp(req), actor: session.username || maskNumber(session.number), action: actionLabel, risk: 5 });
  /* Kurzes Reauth-Fenster auf der Session vermerken (z. B. für das
     Owner-Gate der Login-Sessions-Ansicht). */
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : new URL('http://x' + req.url).searchParams.get('token');
    const sv = sessions.get(token);
    if (sv) { sv.lastReauthAt = Date.now(); saveSessions(); }
  } catch (reauthMarkErr) {}
  return true;
}
/* Kritische Aktionen, die eine Step-up-Reauth verlangen (für die UI, damit
   sie vorab weiß, ein Passwortfeld anzuzeigen, statt erst nach 401 zu fragen). */
const STEP_UP_ACTIONS = [
  'ip.ban.permanent', 'role.change.critical', 'maintenance.on',
  'account.status.disabled', 'account.status.locked.owner', 'security.disable',
  'db.delete', 'sessions.kill_all'
];
function roleOf(session) {
  const acc = session ? rbac.getAccountByNumber(session.number) : null;
  return acc ? acc.role : (session ? session.role : 'user');
}

/* ⬇️ Download-Gate (nur Owner): prüft Benutzername + Passwort gegen einen
   Owner-Account aus accounts.json (bzw. den festen OWNER_PASSWORD des
   Haupt-Owners). Wird NIE geloggt/gespeichert — nur serverseitig geprüft.
   Gibt den passenden Account zurück oder null. */

/* 🗂️ Ordner mit den fertigen Brand-Kit-Dateien (wird NIE öffentlich ausgeliefert). */
const BRAND_DIR = path.join('Dokumente', 'BrandKit');
const BRAND_MIME = {
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.rtf': 'application/rtf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
};
function brandItems() {
  try {
    return fs.readdirSync(BRAND_DIR).filter((f) => !f.startsWith('.')).sort();
  } catch (e) {
    return [];
  }
}

/* 🔐 Datei-Login beim Öffnen: schützt Download-Dateien serverseitig mit
   der Office-Agile-Verschlüsselung (ECMA-376). mode='single' verschlüsselt
   eine einzelne Office-Datei, mode='zip' alle Office-Einträge innerhalb
   einer ZIP. Ohne DATEI_LOGIN_PW (oder ohne python3/msoffcrypto) wird der
   Puffer unverändert durchgereicht — Downloads funktionieren immer. */
let _protectWarned = false;
function officeProtect(buf, mode) {
  if (!DATEI_LOGIN_PW || !buf || !buf.length) return buf;
  const pythonBin = process.env.LB_PYTHON || 'python3';
  const stamp = process.pid + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  const inFile = path.join(os.tmpdir(), 'lb_prot_' + stamp + '.in');
  const outFile = path.join(os.tmpdir(), 'lb_prot_' + stamp + '.out');
  try {
    fs.writeFileSync(inFile, buf);
  } catch (e) {
    return buf;
  }
  const helper = path.join('Schutz', 'schuetzen-server.py');
  let res = null;
  try {
    res = spawnSync(pythonBin, [helper, mode, inFile, outFile], {
      env: Object.assign({}, process.env, { LB_PW: DATEI_LOGIN_PW }),
      encoding: null,
      timeout: 120000,
      windowsHide: true
    });
  } catch (e) {
    res = null;
  }
  let out = null;
  try {
    if (res && res.status === 0 && fs.existsSync(outFile)) out = fs.readFileSync(outFile);
  } catch (e) {
    out = null;
  }
  try { fs.unlinkSync(inFile); } catch (e) {}
  try { fs.unlinkSync(outFile); } catch (e) {}
  if (out) return out;
  if (!_protectWarned) {
    _protectWarned = true;
    console.log('⚠  DATEI_LOGIN_PW ist gesetzt, aber das Schutz-Python (python3 + msoffcrypto-tool, ' + helper + ') lief nicht. Downloads bleiben ungeschützt. Installation: pip install msoffcrypto-tool pycryptodome');
  }
  return buf;
}
function reqIp(req) {
  const socketIp = String(req.socket?.remoteAddress || '').replace('::ffff:', '');
  if (!TRUST_PROXY) return socketIp;

  /* Nur aktiv, wenn der Server ausdrücklich hinter einem vertrauenswürdigen
     Reverse Proxy betrieben wird. Sonst wären Client-Header fälschbar. */
  const cloudflareIp = String(req.headers?.['cf-connecting-ip'] || '').trim();
  if (cloudflareIp) return cloudflareIp;
  const forwarded = String(req.headers?.['x-forwarded-for'] || '')
    .split(',')[0].trim();
  return forwarded || socketIp;
}
function maskNumber(n) {
  n = String(n || '');
  return n.length <= 6 ? n : n.slice(0, 2) + '•'.repeat(Math.max(0, n.length - 6)) + n.slice(-4);
}
const setupTokens = new Map(); /* token -> { number, expires } */
const rateLimits = new Map(); /* number -> { count, resetAt } */

function newToken() {
  return crypto.randomBytes(24).toString('hex');
}

function cleanNumber(input) {
  /* Login ist mit JID (4915155894714@s.whatsapp.net) ODER Nummer möglich */
  return String(input || '').split('@')[0].replace(/[^\d]/g, '');
}

const OWNER_CONTACTS = [
  { name: '910maxi 👑', jid: '4915155894714@s.whatsapp.net', lid: '269574108926096@lid' }
];

function getOwnerContactList(db) {
  const list = [...OWNER_CONTACTS];
  for (const o of db?.meta?.owners || []) {
    list.push({ name: `Owner ${o.name || '?'}`, jid: o.jid || '', lid: o.lid || '' });
  }
  return list;
}

/* Prüft, ob eine Nummer im Bot gebannt ist (db.bans) */
function findBan(db, number) {
  const bans = db?.bans || {};
  for (const [key, b] of Object.entries(bans)) {
    const hit = key.includes(number)
      || String(b.jid || '').includes(number)
      || String(b.lid || '').includes(number);
    if (hit && number.length >= 6) return { key, ...b };
  }
  return null;
}

function checkRateLimit(number) {
  const now = Date.now();
  const entry = rateLimits.get(number);
  if (!entry || entry.resetAt < now) {
    rateLimits.set(number, { count: 1, resetAt: now + 10 * 60000 });
    return true;
  }
  if (entry.count >= 3) return false;
  entry.count++;
  return true;
}

/* ══════════════════════════════════════════════════════════════════
   🛡️ IP-SCHUTZSYSTEM (Brute-Force-Blocking + Sicherheits-Dashboard)
   Unabhängig vom per-Nummer-Rate-Limit oben: Dieses System zählt
   Fehlversuche PRO IP-ADRESSE (über alle Nummern hinweg — verhindert,
   dass ein Angreifer das Nummer-Limit umgeht, indem er einfach immer
   neue Nummern durchprobiert). Nach zu vielen Fehlversuchen wird die
   IP für steigende Zeiträume komplett gesperrt (alle /api/-Routen).
   ══════════════════════════════════════════════════════════════════ */
const IP_FAIL_WINDOW_MS = 10 * 60 * 1000;   /* Fehlversuche zählen 10 Min */
const IP_BLOCK_THRESHOLDS = [
  { fails: 5,  blockMs: 2 * 60 * 1000 },    /* ab 5 Fehlversuchen: 2 Min Sperre */
  { fails: 10, blockMs: 15 * 60 * 1000 },   /* ab 10: 15 Min */
  { fails: 20, blockMs: 60 * 60 * 1000 }    /* ab 20: 1 Std */
];
const ipFailures = new Map();   /* ip -> { count, windowStart } */
const blockedIps = new Map();   /* ip -> { until, reason, blockedAt, fails } */
let totalIpBlocksEver = 0;

function recordIpFailure(ip, reason) {
  if (!ip) return;
  const now = Date.now();
  let entry = ipFailures.get(ip);
  if (!entry || entry.windowStart + IP_FAIL_WINDOW_MS < now) {
    entry = { count: 0, windowStart: now };
  }
  entry.count++;
  ipFailures.set(ip, entry);

  /* Höchste erreichte Schwelle bestimmt die Sperrdauer. */
  let hit = null;
  for (const t of IP_BLOCK_THRESHOLDS) {
    if (entry.count >= t.fails) hit = t;
  }
  if (hit) {
    const already = blockedIps.get(ip);
    const until = now + hit.blockMs;
    if (!already || already.until < until) {
      blockedIps.set(ip, { until, reason: reason || 'Zu viele Fehlversuche', blockedAt: new Date().toISOString(), fails: entry.count });
      totalIpBlocksEver++;
      const blockDetails = { ip, risk: Math.min(95, 40 + entry.count * 3), reason: reason || 'Zu viele Fehlversuche', fails: entry.count, blockMinutes: Math.round(hit.blockMs / 60000) };
      securityEvent('IP_BLOCKED', blockDetails);
      queueOwnerSecurityAlert('IP_BLOCKED', blockDetails);
    }
  }
}

function clearIpFailures(ip) {
  if (ip) ipFailures.delete(ip);
}

function isIpBlocked(ip) {
  if (!ip) return null;
  const b = blockedIps.get(ip);
  if (!b) return null;
  if (b.until < Date.now()) { blockedIps.delete(ip); return null; }
  return b;
}

function unblockIp(ip) {
  const existed = blockedIps.has(ip);
  blockedIps.delete(ip);
  ipFailures.delete(ip);
  return existed;
}

function listBlockedIps() {
  const now = Date.now();
  const out = [];
  for (const [ip, b] of blockedIps.entries()) {
    if (b.until < now) { blockedIps.delete(ip); continue; }
    out.push({ ip: maskIp(ip), ipFull: ip, reason: b.reason, blockedAt: b.blockedAt, fails: b.fails, remainingSec: Math.max(0, Math.round((b.until - now) / 1000)) });
  }
  return out.sort((a, b) => b.fails - a.fails);
}

function fmtSizeKb(kb) {
  if (kb >= 1024) return (kb / 1024).toFixed(1) + ' MB';
  return kb + ' KB';
}

function maskIp(ip) {
  ip = String(ip || '');
  if (ip.includes('.')) {
    const parts = ip.split('.');
    return parts.length === 4 ? `${parts[0]}.${parts[1]}.•.•` : ip;
  }
  if (ip.includes(':')) {
    const parts = ip.split(':');
    return parts.slice(0, 2).join(':') + ':•••';
  }
  return ip;
}

/* Periodisches Aufräumen des Fehlversuchs-Zählers — verhindert
   unbegrenztes Speicherwachstum bei vielen unterschiedlichen (auch
   gefälschten/wechselnden) Quell-IPs über die Zeit. */
setInterval(() => {
  const now = Date.now();
  for (const [ip, e] of ipFailures) {
    if (e.windowStart + IP_FAIL_WINDOW_MS < now) ipFailures.delete(ip);
  }
}, 5 * 60 * 1000).unref?.();

/* ══════════════════════════════════════════════════════════════════
   🛡️🌐 KOMPLETTES WEBSEITEN-SCHUTZSYSTEM ("Fritzbox-Modus")
   Erfasst JEDE Anfrage an die Website (nicht nur Login-Versuche):
   IP, erkanntes Gerät/Browser/OS, Zeitpunkt, aufgerufene Seite/Route,
   Statuscode. Der Owner sieht daraus im Dashboard eine Geräte-/IP-Liste
   wie im Router-Admin-Bereich und kann JEDE IP manuell dauerhaft sperren
   oder wieder freigeben — unabhängig vom automatischen Brute-Force-Schutz
   weiter oben (der bleibt zusätzlich aktiv).
   ══════════════════════════════════════════════════════════════════ */

/* ---------- 🕵️ Mini-User-Agent-Parser (kein Zusatzpaket nötig) -------- */
function parseDevice(ua) {
  ua = String(ua || '');
  if (!ua) return { browser: 'Unbekannt', os: 'Unbekannt', device: 'Unbekannt', isBot: false };
  const isBot = /bot|spider|crawl|curl|wget|python-requests|httpclient|scrapy|postman|insomnia/i.test(ua);
  let browser = 'Unbekannt';
  if (/edg\//i.test(ua)) browser = 'Edge';
  else if (/opr\/|opera/i.test(ua)) browser = 'Opera';
  else if (/chrome\//i.test(ua) && !/chromium/i.test(ua)) browser = 'Chrome';
  else if (/crios\//i.test(ua)) browser = 'Chrome (iOS)';
  else if (/fxios\//i.test(ua)) browser = 'Firefox (iOS)';
  else if (/firefox\//i.test(ua)) browser = 'Firefox';
  else if (/safari\//i.test(ua) && /version\//i.test(ua)) browser = 'Safari';
  else if (/curl\//i.test(ua)) browser = 'curl';
  else if (/postman/i.test(ua)) browser = 'Postman';
  else if (isBot) browser = 'Bot/Skript';

  let os = 'Unbekannt';
  if (/windows nt/i.test(ua)) os = 'Windows';
  else if (/mac os x|macintosh/i.test(ua) && !/iphone|ipad/i.test(ua)) os = 'macOS';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
  else if (/linux/i.test(ua)) os = 'Linux';

  let device = 'Desktop';
  if (/mobile/i.test(ua) && !/ipad|tablet/i.test(ua)) device = 'Smartphone';
  else if (/ipad|tablet/i.test(ua)) device = 'Tablet';
  else if (isBot) device = 'Bot/Skript';

  return { browser, os, device, isBot };
}

/* ---------- 📒 Zugriffs-Log (append-only, wie ein Router-Ereignisprotokoll) */
const ACCESS_LOG_FILE = path.join('Database', 'access.jsonl');
const ACCESS_LOG_MAX_LINES = 20000; /* verhindert unbegrenztes Wachstum */
let accessLogLineCount = 0;
try { accessLogLineCount = fs.readFileSync(ACCESS_LOG_FILE, 'utf8').split('\n').filter(Boolean).length; } catch (e) {}

function logAccess(entry) {
  try {
    fs.mkdirSync('Database', { recursive: true });
    fs.appendFileSync(ACCESS_LOG_FILE, JSON.stringify(entry) + '\n', 'utf8');
    accessLogLineCount++;
    /* grobe Rotation: Datei wird ab und zu auf die letzten N Zeilen gekürzt,
       damit sie nicht unbegrenzt wächst (kein Cron nötig, passiert inline). */
    if (accessLogLineCount > ACCESS_LOG_MAX_LINES * 1.2) {
      const lines = fs.readFileSync(ACCESS_LOG_FILE, 'utf8').trim().split('\n').filter(Boolean);
      const kept = lines.slice(-ACCESS_LOG_MAX_LINES);
      fs.writeFileSync(ACCESS_LOG_FILE, kept.join('\n') + '\n', 'utf8');
      accessLogLineCount = kept.length;
    }
  } catch (e) {}
}

/* ---------- 📡 Live-Übersicht: bekannte IPs/Geräte (In-Memory, wie die
   Geräteliste einer Fritzbox) — wird bei jeder Anfrage aktualisiert. */
const knownClients = new Map(); /* ip -> { ip, device, browser, os, firstSeen, lastSeen, hits, lastPath, numbers:Set } */

const KNOWN_CLIENTS_MAX = 5000; /* Deckelt Speicherverbrauch gegen viele Fake-IPs (DoS-Schutz) */

function trackClient(ip, ua, pathname, number) {
  if (!ip) return;
  let c = knownClients.get(ip);
  const info = parseDevice(ua);
  const now = new Date().toISOString();
  if (!c) {
    /* Wenn die Map zu groß wird: älteste (am längsten inaktive) Einträge
       zuerst rauswerfen, bevor ein neuer aufgenommen wird. */
    if (knownClients.size >= KNOWN_CLIENTS_MAX) {
      let oldestIp = null, oldestTime = Infinity;
      for (const [k, v] of knownClients) {
        const t = new Date(v.lastSeen).getTime();
        if (t < oldestTime) { oldestTime = t; oldestIp = k; }
      }
      if (oldestIp) knownClients.delete(oldestIp);
    }
    c = { ip, ...info, firstSeen: now, lastSeen: now, hits: 0, lastPath: pathname, numbers: new Set() };
    knownClients.set(ip, c);
  }
  c.lastSeen = now;
  c.hits++;
  c.lastPath = pathname;
  c.browser = info.browser; c.os = info.os; c.device = info.device; c.isBot = info.isBot;
  if (number) c.numbers.add(maskNumber(number));
  return c;
}

function listKnownClients() {
  return Array.from(knownClients.values())
    .map((c) => ({ ...c, ip: maskIp(c.ip), ipFull: c.ip, numbers: Array.from(c.numbers) }))
    .sort((a, b) => new Date(b.lastSeen) - new Date(a.lastSeen));
}

/* ---------- 🚫 MANUELLE, DAUERHAFTE IP-Sperren (owner-gesteuert) ------
   Getrennt vom automatischen Brute-Force-System (blockedIps oben):
   Diese Sperren laufen NICHT automatisch ab, sondern nur wenn der Owner
   sie manuell wieder aufhebt — wie das Sperren eines Geräts in einer
   Fritzbox. Persistiert auf Platte, übersteht also Server-Neustarts. */
const MANUAL_BANS_FILE = path.join('Database', 'ip-bans.json');
let manualIpBans = new Map(); /* ip -> { reason, bannedAt, bannedBy } */
function loadManualIpBans() {
  try {
    const raw = JSON.parse(fs.readFileSync(MANUAL_BANS_FILE, 'utf8'));
    manualIpBans = new Map(Object.entries(raw || {}));
  } catch (e) { manualIpBans = new Map(); }
}
function saveManualIpBans() {
  try {
    fs.mkdirSync('Database', { recursive: true });
    fs.writeFileSync(MANUAL_BANS_FILE, JSON.stringify(Object.fromEntries(manualIpBans), null, 2), 'utf8');
  } catch (e) {}
}
loadManualIpBans();

function isManuallyBanned(ip) {
  return manualIpBans.has(ip);
}
function manualBanIp(ip, reason, bannedBy) {
  const banDetails = { ip, reason: reason || 'Vom Owner gesperrt', bannedAt: new Date().toISOString(), bannedBy: bannedBy || 'owner', permanent: true };
  manualIpBans.set(ip, banDetails);
  saveManualIpBans();
  const eventDetails = { ...banDetails, risk: 80, by: bannedBy };
  securityEvent('IP_MANUALLY_BANNED', eventDetails);
  queueOwnerSecurityAlert('IP_MANUALLY_BANNED', eventDetails);
}
function manualUnbanIp(ip) {
  const existed = manualIpBans.delete(ip);
  if (existed) saveManualIpBans();
  return existed;
}
function listManualBans() {
  return Array.from(manualIpBans.entries())
    .map(([ip, b]) => ({ ip: maskIp(ip), ipFull: ip, reason: b.reason, bannedAt: b.bannedAt, bannedBy: b.bannedBy }))
    .sort((a, b) => new Date(b.bannedAt) - new Date(a.bannedAt));
}

/* ══════════════════════════════════════════════════════════════════
   🌊 AUTO-ABUSE-ESKALATION (Reload-/Request-Flut) — GESTAFFELT, nicht
   "7. Reload = sofort Bann". Läuft über ALLE Routen (auch statische
   Seiten wie index.html, nicht nur /api/), damit reines Neuladen der
   Website ohne API-Zugriff genauso erkannt wird.

   Ablauf:
     1) Burst-Erkennung: mehr als ABUSE_BURST_THRESHOLD Anfragen einer
        IP innerhalb von ABUSE_BURST_WINDOW_MS → 1 "Verstoß". Der ERSTE
        Verstoß wird nur geloggt (Warnung) — noch KEINE Sperre.
     2) Ab dem 2. Verstoß (innerhalb der Verjährungsfrist): 5 Minuten
        Temp-Sperre.
     3) Ab dem 4. Verstoß: 1 Stunde Sperre.
     4) Ab dem 6. Verstoß: dauerhafte Sperre — landet in derselben
        Owner-Sperrliste wie manuelle Bans, mit "auto-security-system"
        als Urheber, damit der Owner sofort sieht: automatisch erkannt,
        nicht von ihm selbst gesperrt. Kann er jederzeit manuell wieder
        aufheben.
   Verstöße "verjähren" nach 30 Minuten ohne neuen Vorfall — ein einmal
   auffälliger Nutzer, der sich seitdem normal verhält, wird NICHT für
   immer nachträglich eskaliert. Jede Stufe wird vollständig geloggt
   (Grund, Anzahl Anfragen, Zeitfenster, Aktion, Dauer) für den Owner. */
/* ── Konfigurierbare Web-Abuse-Regeln (WEB-REQ-07) ─────────────────────
   Die Parameter sind NICHT hart im Code, sondern liegen in
   Database/security-rules.json und können im Owner-Center (Auto-Regeln)
   geändert werden — jede Änderung wird versioniert, auditiert und
   erfordert ein Step-up-Passwort. Die Defaults unten gelten, solange die
   Datei fehlt, und werden beim ersten Start automatisch angelegt. */
const ABUSE_DEFAULTS = {
  id: 'WEB-REQ-07',
  enabled: true,
  threshold: 50,                /* > N Anfragen einer IP im Fenster = 1 Verstoß */
  windowSec: 10,                /* Beobachtungsfenster in Sekunden */
  violationDecayMin: 30,        /* Verstöße verjähren nach N Min ohne Vorfall */
  tiers: [
    { atViolations: 2, action: 'TEMP_BLOCK', blockMin: 5, label: '5 Minuten' },
    { atViolations: 4, action: 'LONG_BLOCK', blockMin: 60, label: '1 Stunde' },
    { atViolations: 6, action: 'PERM_BLOCK', blockMin: 0, label: 'dauerhaft (manuelle Prüfung nötig)' }
  ]
};
const SEC_RULES_FILE = path.join('Database', 'security-rules.json');

function normalizeAbuseRules(input) {
  const src = input || {};
  const t = Array.isArray(src.tiers) ? src.tiers.slice(0, 8) : ABUSE_DEFAULTS.tiers.map((x) => ({ ...x }));
  const tiers = t
    .map((x) => ({
      atViolations: Math.max(1, Math.min(50, Math.round(Number(x?.atViolations) || 0))),
      action: ['TEMP_BLOCK', 'LONG_BLOCK', 'PERM_BLOCK'].includes(x?.action) ? x.action : 'TEMP_BLOCK',
      blockMin: x?.action === 'PERM_BLOCK' ? 0 : Math.max(1, Math.min(10080, Math.round(Number(x?.blockMin) || 0) || ABUSE_DEFAULTS.tiers[0].blockMin)),
      label: String(x?.label || '').slice(0, 60)
    }))
    .filter((x) => x.atViolations > 0)
    .sort((a, b) => a.atViolations - b.atViolations);
  if (!tiers.length) tiers.push({ ...ABUSE_DEFAULTS.tiers[0] });
  return {
    id: String(src.id || 'WEB-REQ-07').slice(0, 40),
    enabled: src.enabled !== false,
    threshold: Math.max(3, Math.min(1000, Math.round(Number(src.threshold) || ABUSE_DEFAULTS.threshold))),
    windowSec: Math.max(2, Math.min(3600, Math.round(Number(src.windowSec) || ABUSE_DEFAULTS.windowSec))),
    violationDecayMin: Math.max(1, Math.min(1440, Math.round(Number(src.violationDecayMin) || ABUSE_DEFAULTS.violationDecayMin))),
    tiers
  };
}

let SEC_RULES = { version: 0, updatedAt: null, updatedBy: 'defaults', history: [], webReqFlood: normalizeAbuseRules(null) };

function loadSecurityRules() {
  try {
    const raw = JSON.parse(fs.readFileSync(SEC_RULES_FILE, 'utf8'));
    const wrf = normalizeAbuseRules(raw.webReqFlood || raw);
    SEC_RULES = {
      version: Math.max(1, Number(raw.version) || 1),
      updatedAt: raw.updatedAt || null,
      updatedBy: raw.updatedBy || 'datei',
      history: Array.isArray(raw.history) ? raw.history.slice(-10) : [],
      webReqFlood: wrf
    };
  } catch (e) {
    /* Datei fehlt oder kaputt → Defaults anlegen */
    SEC_RULES = { version: 1, updatedAt: new Date().toISOString(), updatedBy: 'system-init', history: [], webReqFlood: normalizeAbuseRules(null) };
    try { fs.writeFileSync(SEC_RULES_FILE, JSON.stringify(SEC_RULES, null, 2), 'utf8'); } catch (e2) {}
  }
  return SEC_RULES;
}
function saveSecurityRules(actor, reason) {
  const prev = { v: SEC_RULES.version, webReqFlood: SEC_RULES.webReqFlood };
  SEC_RULES.history = [...SEC_RULES.history, prev].slice(-10);
  SEC_RULES.version += 1;
  SEC_RULES.updatedAt = new Date().toISOString();
  SEC_RULES.updatedBy = String(actor || '?');
  fs.writeFileSync(SEC_RULES_FILE, JSON.stringify(SEC_RULES, null, 2), 'utf8');
  audit(actor, 'security.rules.changed', 'WEB-REQ-07 → v' + SEC_RULES.version + (reason ? ' — ' + String(reason).slice(0, 160) : ''), 'success');
  return SEC_RULES;
}
loadSecurityRules();
/* Der Effective-Wert kommt aus den Regeln (Default-Fallback bleibt als Konstante erhalten) */
const abuseRule = () => SEC_RULES.webReqFlood || ABUSE_DEFAULTS;
const ABUSE_BURST_WINDOW_MS = () => (abuseRule().windowSec || 10) * 1000;
const ABUSE_BURST_THRESHOLD = () => abuseRule().threshold || 50;
const ABUSE_VIOLATION_DECAY_MS = () => (abuseRule().violationDecayMin || 30) * 60 * 1000;
const ABUSE_TIERS = () => (abuseRule().tiers || ABUSE_DEFAULTS.tiers).map((t) => ({
  atViolations: t.atViolations,
  action: t.action,
  blockMs: t.action === 'PERM_BLOCK' ? null : (t.blockMin || 5) * 60 * 1000,
  label: t.label || (t.action === 'PERM_BLOCK' ? 'dauerhaft' : (t.blockMin || 5) + ' Minuten')
}));
const abuseBursts = new Map();     /* ip -> { count, windowStart, tier1Logged } */
const abuseViolations = new Map(); /* ip -> { count, lastAt } */

function recordAbuseCheck(ip) {
  if (!ip) return;
  const rule = abuseRule();
  if (!rule.enabled) return; /* Regel deaktiviert (im Owner-Center konfigurierbar) */
  const now = Date.now();

  let burst = abuseBursts.get(ip);
  if (!burst || burst.windowStart + ABUSE_BURST_WINDOW_MS() < now) {
    burst = { count: 0, windowStart: now, tier1Logged: false };
    abuseBursts.set(ip, burst);
  }
  burst.count++;
  if (burst.count <= ABUSE_BURST_THRESHOLD()) return;
  if (burst.tier1Logged) return; /* pro Zeitfenster nur 1x eskalieren/loggen */
  burst.tier1Logged = true;

  let viol = abuseViolations.get(ip);
  if (!viol || viol.lastAt + ABUSE_VIOLATION_DECAY_MS() < now) {
    viol = { count: 0, lastAt: now };
  }
  viol.count++;
  viol.lastAt = now;
  abuseViolations.set(ip, viol);

  securityEvent('ABUSE_BURST_DETECTED', {
    ip, risk: Math.min(90, 25 + viol.count * 10),
    reason: 'Ungewöhnlich viele Anfragen in kurzer Zeit (Reload-/Request-Flut)',
    requestsInWindow: burst.count, windowSec: ABUSE_BURST_WINDOW_MS() / 1000, violationCount: viol.count, rule: rule.id
  });

  let hitTier = null;
  for (const t of ABUSE_TIERS()) if (viol.count >= t.atViolations) hitTier = t;
  if (!hitTier) return; /* 1. Verstoß: nur Warnung/Log, noch keine Sperre */

  if (hitTier.action === 'PERM_BLOCK') {
    if (!isManuallyBanned(ip)) {
      manualBanIp(ip, `Automatisch gesperrt: wiederholte Reload-/Request-Flut (${viol.count}. Verstoß in ${ABUSE_VIOLATION_DECAY_MS() / 60000} Min) — bitte manuell prüfen`, 'auto-security-system');
      securityEvent('ABUSE_AUTO_PERM_BLOCK', {
        ip, risk: 90, reason: 'Wiederholte Anfrage-Flut trotz vorheriger Sperren', violationCount: viol.count,
        action: 'permanent_ban', by: 'auto-security-system'
      });
    }
  } else {
    const already = blockedIps.get(ip);
    const until = now + hitTier.blockMs;
    if (!already || already.until < until) {
      blockedIps.set(ip, {
        until, reason: `Automatisch: wiederholte Reload-/Request-Flut (${viol.count}. Verstoß) — Sperre ${hitTier.label}`,
        blockedAt: new Date().toISOString(), fails: viol.count, tier: hitTier.action
      });
      totalIpBlocksEver++;
      securityEvent('ABUSE_AUTO_ESCALATED_BLOCK', {
        ip, risk: Math.min(95, 50 + viol.count * 5), reason: `Eskalationsstufe ${hitTier.action}`,
        blockDuration: hitTier.label, violationCount: viol.count, action: hitTier.action
      });
      queueOwnerSecurityAlert('ABUSE_AUTO_ESCALATED_BLOCK', {
        ip, reason: `Eskalationsstufe ${hitTier.action}`, blockDuration: hitTier.label,
        violationCount: viol.count, action: hitTier.action, source: 'web-protection'
      });
    }
  }
}
/* Aufräumen alter Einträge, damit die Maps nicht unbegrenzt wachsen */
setInterval(() => {
  const now = Date.now();
  for (const [ip, b] of abuseBursts) if (b.windowStart + ABUSE_BURST_WINDOW_MS() < now) abuseBursts.delete(ip);
  for (const [ip, v] of abuseViolations) if (v.lastAt + ABUSE_VIOLATION_DECAY_MS() < now) abuseViolations.delete(ip);
}, 5 * 60 * 1000).unref?.();

/* ---------- 🚦 Globales Rate-Limiting (gilt für ALLE /api/-Routen,
   nicht nur Login) — schützt vor allgemeinem API-Missbrauch/Scraping. */
const GLOBAL_RL_WINDOW_MS = 60 * 1000; /* 1 Minute */
const GLOBAL_RL_MAX = 240; /* max. Anfragen pro IP pro Minute (großzügig fürs Dashboard-Polling) */
const globalRateLimits = new Map(); /* ip -> { count, resetAt } */
function checkGlobalRateLimit(ip) {
  const now = Date.now();
  let entry = globalRateLimits.get(ip);
  if (!entry || entry.resetAt < now) {
    entry = { count: 0, resetAt: now + GLOBAL_RL_WINDOW_MS };
    globalRateLimits.set(ip, entry);
  }
  entry.count++;
  return entry.count <= GLOBAL_RL_MAX;
}
/* Aufräumen alter Einträge, damit die Map nicht unbegrenzt wächst */
setInterval(() => {
  const now = Date.now();
  for (const [ip, e] of globalRateLimits) if (e.resetAt < now) globalRateLimits.delete(ip);
}, 5 * 60 * 1000).unref?.();

function createSession(number, role, name, extra, req) {
  const token = newToken();
  const ip = req ? reqIp(req) : (extra && extra.lastIp) || '';
  const ua = req ? String(req.headers?.['user-agent'] || '') : '';
  sessions.set(token, Object.assign({ number, role, name, createdAt: new Date().toISOString(), lastIp: ip, userAgent: ua }, extra || {}));
  saveSessions();
  return token;
}

/* 🔐 Kein Ablauf mehr — man bleibt eingeloggt, bis man auf Abmelden drückt. */
function getSession(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : new URL('http://x' + req.url).searchParams.get('token');
  if (!token) return null;
  const s = sessions.get(token);
  if (!s) return null;
  /* Letzte gesehene IP/UA laufend aktualisieren — für das Session-Panel
     (zeigt bei "verdächtigem" IP-Wechsel z. B. Session-Hijacking an). */
  try {
    const curIp = reqIp(req);
    if (curIp && curIp !== s.lastIp) { s.prevIp = s.lastIp; s.lastIp = curIp; }
    const curUa = String(req.headers?.['user-agent'] || '');
    if (curUa) s.userAgent = curUa;
    s.lastSeenAt = new Date().toISOString();
  } catch (e) {}
  /* ☾ Live-Sync: Rolle immer frisch aus accounts.json; Ban/Lock → Session weg */
  try {
    const acc = rbac.getAccountByNumber(s.number);
    if (acc) {
      /* 5-Status-Modell: aktiv/eingeschränkt dürfen eingeloggt bleiben,
         ausstehend/gesperrt/deaktiviert werden sofort ausgeloggt. */
      const st = rbac.STATUSES[acc.status] || rbac.STATUSES.active;
      if (!st.loginAllowed || acc.role === 'banned') { sessions.delete(token); saveSessions(); return null; }
      if (acc.role !== s.role && acc.role !== 'owner') { s.role = acc.role; }
      s.scope = acc.scope || s.scope || { type: 'global' };
      s.username = acc.username;
      s.mustChange = !!acc.mustChange;
      s.accountId = acc.id;
      s.restrictions = acc.status === 'restricted' ? (acc.restrictions || []) : [];
    }
    const dbBan = readDb();
    if (findBan(dbBan, s.number)) { sessions.delete(token); saveSessions(); return null; }
  } catch (e) {}
  return { ...s, token };
}

/* ══════════════════════════════════════════════════════════════════
   🛡️ ZENTRALE SECURITY-HEADER — gelten für JEDE Antwort (API + statische
   Seiten), nicht nur für /api/-JSON-Antworten wie vorher. Das schützt
   die komplette Website, nicht nur den Login:
   - CSP: verbietet das Nachladen fremder Skripte/Frames/Objekte
     (die Website lädt ohnehin nichts von externen CDNs); 'unsafe-inline'
     bleibt nötig, weil viele Seiten noch mit onclick="…"/<style> arbeiten
     — verhindert aber weiterhin, dass eine Injection fremden JS-Code
     von einer anderen Domain nachlädt oder die Seite in ein fremdes
     <iframe> einbettet.
   - HSTS: erzwingt HTTPS für zukünftige Besuche (wirkt nur, wenn die
     Seite tatsächlich per HTTPS ausgeliefert wird, z. B. hinter einem
     Reverse-Proxy — schadet lokal per HTTP nicht).
   - Permissions-Policy: deaktiviert Kamera/Mikro/Standort/USB usw.,
     die diese Website ohnehin nie braucht.
   - X-Frame-Options + frame-ancestors: doppelter Clickjacking-Schutz.
   ══════════════════════════════════════════════════════════════════ */
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'X-XSS-Protection': '0',
  'X-Permitted-Cross-Domain-Policies': 'none',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), usb=(), payment=(), interest-cohort=()',
  'Strict-Transport-Security': 'max-age=15552000; includeSubDomains',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'"
  ].join('; ')
};

/* ==========================================================================
   🖥️  TERMINAL (server.js) — schöne Konsolenausgabe + vollständiges Log
   Jede API-Anfrage, jeder Audit-/Security-/Admin-Aktions-Eintrag erscheint
   hier als getaggte Zeile (ANSI, deaktiviert ohne TTY) und wird zusätzlich
   nach Logs/server.log geschrieben (mit Rotation).
   ==========================================================================*/
const TERM = {
  reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m',
  pink: '\x1b[38;5;206m', pinkB: '\x1b[38;5;212m',
  cyan: '\x1b[38;5;51m', violet: '\x1b[38;5;141m',
  white: '\x1b[97m', grey: '\x1b[38;5;240m',
  red: '\x1b[38;5;203m', yellow: '\x1b[38;5;221m', green: '\x1b[38;5;114m'
};
const SERVER_LOG_FILE = path.join('Logs', 'server.log');
const stripAnsi = (t) => String(t).replace(/\x1b\[[0-9;]*m/g, '');
const termStamp = () => new Date().toLocaleTimeString('de-DE');
const termDate = () => new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
function termColorOf(tag) {
  const t = String(tag || '').toLowerCase();
  if (['error', 'security', 'denied', 'fail', 'ban'].some((x) => t.includes(x))) return TERM.red;
  if (['warn', 'warning', 'gate'].some((x) => t.includes(x))) return TERM.yellow;
  if (['session', 'web', 'login', 'download', 'api'].some((x) => t.includes(x))) return TERM.cyan;
  if (['owner', 'admin'].some((x) => t.includes(x))) return TERM.pink;
  if (['boot', 'system', 'start'].some((x) => t.includes(x))) return TERM.violet;
  return TERM.violet;
}
function termWrite(line) {
  console.log(line);
  try {
    fs.mkdirSync('Logs', { recursive: true });
    fs.appendFileSync(SERVER_LOG_FILE, stripAnsi(line) + '\n', 'utf8');
  } catch (e) {}
}
/* Formatierte Terminalzeile mit Tag + Zeitstempel (und Datei-Log). */
function termLog(tag, text) {
  const stamp = termStamp();
  const col = termColorOf(tag);
  const tagPad = String(tag).slice(0, 10).padEnd(10);
  termWrite(`${TERM.grey}${stamp}${TERM.reset}  ${col}${TERM.bold}${tagPad}${TERM.reset} ${TERM.dim}›${TERM.reset} ${TERM.white}${text}${TERM.reset}`);
}
/* Kompakte Zeile je API-Anfrage: 200 POST /api/… */
function apiTermLine(method, route, code, ms) {
  const ok = code >= 200 && code < 300;
  const col = code >= 500 ? TERM.red : code >= 400 ? TERM.yellow : ok ? TERM.green : TERM.cyan;
  const sym = code >= 500 ? '!!' : code >= 400 ? '✕' : ok ? '✓' : '→';
  termWrite(
    `${TERM.grey}${termStamp()}${TERM.reset}  ${col}${TERM.bold}${String(code).padEnd(3)} ${sym}${TERM.reset} ` +
    `${TERM.cyan}${String(method || 'GET').padEnd(4)}${TERM.reset} ${TERM.white}${route}${TERM.reset}` +
    (ms ? `${TERM.dim}  · ${ms} ms${TERM.reset}` : '')
  );
}
/* Server-Log einmal beim Boot rotieren (max. 2500 Zeilen). */
function rotateServerLog() {
  try {
    const st = fs.statSync(SERVER_LOG_FILE);
    if (st.size > 2 * 1024 * 1024) {
      const lines = fs.readFileSync(SERVER_LOG_FILE, 'utf8').split('\n');
      fs.writeFileSync(SERVER_LOG_FILE, lines.slice(-2500).join('\n'), 'utf8');
    }
  } catch (e) {}
}

/* ---------- HTTP-Helfer ------------------------------------------------ */
function sendJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, Object.assign({
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  }, SECURITY_HEADERS));
  res.end(body);
}

function sendSecurityBlock(res, code, title, detail, extra = {}) {
  return sendJson(res, code, {
    error: title,
    securityBlock: true,
    security: {
      title,
      detail,
      action: code === 403 ? 'Wende dich an den Owner mit deiner IP und dem angezeigten Zeitpunkt.' : 'Warte bis die Sperre abläuft und versuche es danach erneut.',
      code: code === 403 ? 'IP_PERMANENTLY_BLOCKED' : 'IP_TEMPORARILY_BLOCKED',
      at: new Date().toISOString()
    },
    ...extra
  });
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 1e6) req.destroy(); });
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')); } catch (e) { resolve({}); }
    });
  });
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp'
};

const PUBLIC_ROOT = path.resolve('public');

function serveStatic(req, res, urlPath) {
  const clientIpStatic = reqIp(req);

  /* 🚫🛡️ Manuelle Owner-Sperre UND automatische Abuse-/Brute-Force-Sperre
     gelten jetzt auch für statische Seiten (nicht mehr nur /api/) — sonst
     könnte eine gesperrte IP zwar keine API mehr nutzen, aber weiterhin
     ungestört jede HTML-Seite/jedes Bild laden (unsinnige Teilsperre). */
  /* Owner/Deputy mit security.manage dürfen nie ausgesperrt werden —
     sonst gäbe es keinen Weg mehr, die eigene IP übers Dashboard wieder
     freizugeben ("Lockout"-Falle), da /login.html ja selbst auch eine
     statische Seite ist. */
  const staticSession = getSession(req);
  const staticBypass = staticSession && perm(staticSession, 'security.manage');
  if (!staticBypass && isManuallyBanned(clientIpStatic)) {
    securityEvent('IP_MANUAL_BAN_STATIC_DENIED', { ip: clientIpStatic, risk: 65, path: urlPath });
    res.writeHead(403, Object.assign({ 'Content-Type': 'text/plain; charset=utf-8' }, SECURITY_HEADERS));
    return res.end('403 — Zugriff gesperrt\n\nDeine IP-Adresse ist dauerhaft blockiert. Bitte wende dich mit dem Zeitpunkt und deiner IP an den Owner.');
  }
  const staticBlock = !staticBypass && isIpBlocked(clientIpStatic);
  if (staticBlock) {
    securityEvent('IP_BLOCKED_STATIC_DENIED', { ip: clientIpStatic, risk: 55, path: urlPath });
    res.writeHead(429, Object.assign({ 'Content-Type': 'text/plain; charset=utf-8', 'Retry-After': String(Math.max(1, Math.round((staticBlock.until - Date.now()) / 1000))) }, SECURITY_HEADERS));
    return res.end('429 — Schutzsperre aktiv\n\n' + (staticBlock.reason || 'Zu viele Anfragen') + '. Bitte später erneut versuchen.');
  }

  /* 🛡️ Doppelter Pfad-Traversal-Schutz: die WHATWG-URL-Klasse (siehe
     oben, new URL(...)) normalisiert "../" bereits weg, BEVOR wir hier
     ankommen — trotzdem prüfen wir defensiv noch einmal mit dem
     aufgelösten Absolutpfad, falls sich das Parsing je ändert. */
  let file = urlPath === '/' ? 'index.html' : decodeURIComponent(urlPath).replace(/^\/+/, '');
  const full = path.resolve(PUBLIC_ROOT, file);
  if (!full.startsWith(PUBLIC_ROOT + path.sep) && full !== PUBLIC_ROOT) {
    securityEvent('PATH_TRAVERSAL_ATTEMPT', { ip: reqIp(req), risk: 70, path: urlPath });
    res.writeHead(403, Object.assign({ 'Content-Type': 'text/plain; charset=utf-8' }, SECURITY_HEADERS));
    return res.end('403 — Forbidden');
  }
  fs.readFile(full, (err, buf) => {
    if (err) {
      res.writeHead(404, Object.assign({ 'Content-Type': 'text/plain; charset=utf-8' }, SECURITY_HEADERS));
      return res.end('404 — Nicht gefunden');
    }
    const ext = path.extname(full).toLowerCase();
    let body = buf;
    if (ext === '.html') {
      const html = buf.toString('utf8');
      const glassLink = '<link rel="stylesheet" href="/css/liquid-glass.css">';
      body = Buffer.from(html.includes(glassLink) ? html : html.replace(/<\/head>/i, glassLink + '</head>'), 'utf8');
    }
    res.writeHead(200, Object.assign({ 'Content-Type': MIME[ext] || 'application/octet-stream' }, SECURITY_HEADERS));
    res.end(body);
  });
}

/* ---------- API-Routen -------------------------------------------------- */
/* ── 🧩 FEATURE-REGISTRY (LoveBot 5.0-Modularität) ─────────────────────
   Zentrale Modul-Übersicht: Status (enabled/limited/disabled) + Zielgruppe.
   Datei: Database/feature-registry.json (wird bei Bedarf angelegt).
   Änderungen nur mit system.manage + Step-up + Audit. */
const FEATURE_REGISTRY_FILE = path.join('Database', 'feature-registry.json');
const FEATURE_DEFAULTS = {
  xp:        { label: 'XP Engine',        icon: '⭐', status: 'enabled',  audience: 'everyone' },
  games:     { label: 'Game Center',      icon: '🎮', status: 'enabled',  audience: 'everyone' },
  economy:   { label: 'Economy',          icon: '💰', status: 'enabled',  audience: 'everyone' },
  pets:      { label: 'Pets',             icon: '🐾', status: 'enabled',  audience: 'everyone' },
  media:     { label: 'Media Center',     icon: '🎬', status: 'enabled',  audience: 'everyone' },
  ai:        { label: 'AI Center',        icon: '🤖', status: 'limited',  audience: 'admins' },
  social:    { label: 'Love-System',      icon: '💜', status: 'enabled',  audience: 'everyone' },
  trading:   { label: 'Trading',          icon: '🔄', status: 'disabled', audience: 'off' },
  quests:    { label: 'Quest System',     icon: '🎯', status: 'disabled', audience: 'off' },
  seasons:   { label: 'Seasons / ChatPass', icon: '🎟️', status: 'disabled', audience: 'off' },
  tournaments: { label: 'Tournaments',    icon: '🏟️', status: 'disabled', audience: 'off' },
  marketplace: { label: 'Marketplace',    icon: '🛍️', status: 'disabled', audience: 'off' }
};
const FEATURE_STATUSES = ['enabled', 'limited', 'disabled'];
const FEATURE_AUDIENCES = ['off', 'owner', 'admins', 'everyone'];

function loadFeatureRegistry() {
  let reg = { version: 1, updatedAt: null, updatedBy: 'defaults', features: {} };
  try { reg = JSON.parse(fs.readFileSync(FEATURE_REGISTRY_FILE, 'utf8')); } catch (e) {}
  reg.version = Number(reg.version) || 1;
  reg.features = { ...FEATURE_DEFAULTS, ...(reg.features || {}) };
  return reg;
}
function initFeatureRegistry() {
  try { fs.readFileSync(FEATURE_REGISTRY_FILE); }
  catch (e) {
    try { fs.writeFileSync(FEATURE_REGISTRY_FILE, JSON.stringify(loadFeatureRegistry(), null, 2), 'utf8'); } catch (e2) {}
  }
}
function saveFeatureRegistry(actor, reason) {
  const reg = loadFeatureRegistry();
  reg.version += 1;
  reg.updatedAt = new Date().toISOString();
  reg.updatedBy = String(actor || '?');
  fs.writeFileSync(FEATURE_REGISTRY_FILE, JSON.stringify(reg, null, 2), 'utf8');
  audit(actor, 'feature.changed', 'Feature-Registry → v' + reg.version + (reason ? ' — ' + String(reason).slice(0, 160) : ''), 'success');
  return reg;
}
initFeatureRegistry(); /* Datei beim Start sicher anlegen */

async function handleApi(req, res, pathname) {
  if (req.method === 'OPTIONS') return sendJson(res, 200, { ok: true });

  const clientIp = reqIp(req);
  const userAgent = req.headers['user-agent'] || '';

  /* 📒 JEDE Anfrage protokollieren + Geräte-/IP-Übersicht aktualisieren —
     Fritzbox-artiges "wer greift gerade/wann auf meine Website zu". */
  trackClient(clientIp, userAgent, pathname);
  logAccess({ time: new Date().toISOString(), ip: maskIp(clientIp), ipFull: clientIp, method: req.method, path: pathname, ua: userAgent.slice(0, 200), ...parseDevice(userAgent) });

  /* 🚫 Manuelle (dauerhafte) Owner-Sperre — höchste Priorität, läuft nie
     automatisch ab. Ausnahme wie unten: /api/heartbeat + eingeloggte
     Personen mit security.manage (damit der Owner sich nicht aussperrt). */
  if (pathname !== '/api/heartbeat' && isManuallyBanned(clientIp)) {
    const existingSessionMb = getSession(req);
    const canBypassMb = existingSessionMb && perm(existingSessionMb, 'security.manage');
    if (!canBypassMb) {
      securityEvent('IP_MANUAL_BAN_REQUEST_DENIED', { ip: clientIp, risk: 70, path: pathname });
      return sendSecurityBlock(res, 403, 'Zugriff dauerhaft gesperrt', 'Diese IP-Adresse wurde vom Betreiber blockiert.', { ipBanned: true, ip: clientIp });
    }
  }

  /* 🛠️ GLOBALER WARTUNGSMODUS ($offline / $online im Bot) — EIN Zustand,
     geteilt mit Love.js über Database/maintenance.json. Sobald aktiv:
     NIEMAND außer dem eingeloggten Owner kommt noch an die API (und damit
     an die Website) heran. Ausnahmen (müssen erreichbar bleiben, damit
     sich niemand aussperrt bzw. der Status abfragbar bleibt):
       - /api/heartbeat      → öffentliche Live-Status-Anzeige
       - /api/maintenance    → damit die Sperr-Seite Grund/Zeit anzeigen kann
       - /api/check-number, /api/login, /api/request-code, /api/verify-code,
         /api/set-password   → der OWNER muss sich noch einloggen können,
         auch wenn er gerade (z. B. auf einem neuen Gerät) keine Session hat. */
  const MAINTENANCE_EXEMPT_PATHS = new Set([
    '/api/heartbeat', '/api/maintenance', '/api/check-number', '/api/login',
    '/api/request-code', '/api/verify-code', '/api/set-password', '/api/logout'
  ]);
  if (!MAINTENANCE_EXEMPT_PATHS.has(pathname)) {
    const maint = getMaintenance();
    if (maint.on) {
      const maintSession = getSession(req);
      const isOwnerBypass = maintSession && roleOf(maintSession) === 'owner';
      if (!isOwnerBypass) {
        return sendJson(res, 503, {
          error: 'maintenance',
          maintenance: true,
          reason: maint.reason || 'Kein Grund angegeben',
          since: maint.since,
          by: maint.by
        });
      }
    }
  }

  /* 🚦 Globales Rate-Limit über ALLE API-Routen (nicht nur Login) —
     schützt vor allgemeinem Scraping/API-Missbrauch/DoS-Versuchen.
     WICHTIG: Löst bewusst KEIN recordIpFailure()/keine IP-Sperre aus —
     das ist ein rein zeitliches "bitte kurz langsamer"-Signal, das sich
     von selbst nach Ablauf des Zeitfensters erholt. Würde ein
     Rate-Limit-Treffer die harte Brute-Force-Sperre eskalieren (wie es
     hier ursprünglich der Fall war), könnte z. B. sehr aktives
     Dashboard-Polling mehrerer offener Tabs zu einer mehrminütigen
     Voll-Sperre der eigenen IP führen — inklusive Login-Endpunkt, also
     eine echte Aussperr-Falle. Deshalb bleiben "zu viele Anfragen" und
     "zu viele falsche Passwörter" strikt getrennte Schutzsysteme. */
  if (pathname !== '/api/heartbeat' && !checkGlobalRateLimit(clientIp)) {
    securityEvent('GLOBAL_RATE_LIMIT_HIT', { ip: clientIp, risk: 20, path: pathname });
    return sendJson(res, 429, { error: 'Zu viele Anfragen. Bitte kurz warten.', rateLimited: true });
  }

  /* 🛡️ IP-SCHUTZSYSTEM: gesperrte IPs kommen an KEINE /api/-Route mehr
     heran (außer /api/heartbeat, damit die öffentliche Status-Anzeige
     nicht mitgesperrt wird). Login-/Auth-Endpunkte zählen Fehlversuche
     weiter oben in ihren jeweiligen Handlern via recordIpFailure(). */
  /* Ausnahmen vom globalen IP-Block:
     - /api/heartbeat: öffentliche Status-Anzeige soll nicht mitgesperrt werden.
     - Bereits eingeloggte Nutzer:innen mit security.manage (owner/deputy):
       sonst könnte sich der Owner mit seiner eigenen IP aussperren und
       hätte dann keinen Weg mehr, sie über das Dashboard selbst wieder
       freizugeben ("Lockout"-Falle). Der Login-Endpunkt selbst bleibt
       für NICHT eingeloggte Anfragen weiterhin voll gesperrt. */
  if (pathname !== '/api/heartbeat') {
    const blocked = isIpBlocked(clientIp);
    if (blocked) {
      const existingSession = getSession(req);
      const canBypass = existingSession && perm(existingSession, 'security.manage');
      if (!canBypass) {
        securityEvent('IP_BLOCKED_REQUEST_DENIED', { ip: clientIp, risk: 60, path: pathname });
        return sendSecurityBlock(res, 429, 'Vorübergehende Schutzsperre', 'Zu viele Fehlversuche von dieser IP-Adresse.', {
          ipBlocked: true,
          retryAfterSec: Math.max(0, Math.round((blocked.until - Date.now()) / 1000)),
          reason: blocked.reason || 'Zu viele Fehlversuche'
        });
      }
    }
  }

  /* ---- LOGIN (Owner per Passwort, User per Passwort nach Registrierung) */
  /* 🔎 Erst die Nummer prüfen: ist es die Owner-Nummer, ein registrierter
     Nutzer oder gebannt? Die Webseite zeigt das Passwort-Feld erst NACH
     dieser Prüfung an. */
  if (pathname === '/api/check-number' && req.method === 'POST') {
    const body = await readBody(req);
    const number = cleanNumber(body.number);
    if (!number || number.length < 6) return sendJson(res, 400, { error: 'Bitte eine gültige Nummer/JID eingeben.' });
    const db = readDb();
    const ban = findBan(db, number);
    if (ban) {
      return sendJson(res, 200, {
        status: 'banned',
        banned: {
          by: ban.bannedByName || 'LoveBot Automod',
          byJid: ban.bannedBy || '',
          reason: ban.reason || 'Kein Grund angegeben',
          bannedAt: ban.bannedAt || null,
          owners: getOwnerContactList(db)
        }
      });
    }
    if (number === OWNER_NUMBER) return sendJson(res, 200, { status: 'owner' });
    const user = db.meta?.webusers?.[number];
    if (user) return sendJson(res, 200, { status: 'user', name: user.name || ('+' + number) });
    return sendJson(res, 200, { status: 'unknown' });
  }

  if (pathname === '/api/login' && req.method === 'POST') {
    const body = await readBody(req);
    const number = cleanNumber(body.number);
    const password = String(body.password || '');
    const isOwnerNumber = number === OWNER_NUMBER;
    const lt = String(body.loginToken || '');
    trackClient(clientIp, userAgent, pathname, number); /* Gerät ↔ Nummer verknüpfen, für die Owner-Übersicht */

    /* 👑 OWNER-AUSNAHME: Der Haupt-Owner loggt sich NUR mit Nummer +
       Passwort ein — kein WhatsApp-2FA-Code nötig. Grund: Der Owner IST
       der Bot-Betreiber, der WhatsApp-Code würde ohnehin an ihn selbst
       gehen und bietet praktisch keinen Zusatzschutz, blockiert aber den
       Zugriff, falls der Bot gerade offline ist. Trotzdem bleibt der
       Login brute-force-geschützt (Rate-Limit + Security-Log) — ohne
       korrektes Passwort kommt niemand rein, 2FA hin oder her.
       ALLE anderen Konten (auch Admin/Deputy/Supporter) brauchen
       weiterhin zwingend den WhatsApp-Code. */
    if (!isOwnerNumber) {
      /* 🔐 Ohne gültigen 2FA-loginToken (per WhatsApp-Code) gibt es KEIN
         Login — auch nicht mit korrektem Passwort. */
      const ltEntry = loginTokens.get(lt);
      if (!lt || !ltEntry || ltEntry.expires < Date.now() || ltEntry.number !== number) {
        securityEvent('AUTH_2FA_MISSING', { ip: clientIp, number: maskNumber(number), risk: 25 });
        audit(maskNumber(number), 'login.denied_no2fa', 'web', 'denied');
        recordIpFailure(clientIp, '2FA fehlt/ungültig');
        return sendJson(res, 401, { error: '2FA erforderlich: erst Nummer prüfen, dann WhatsApp-Code bestätigen, dann Passwort.', need2fa: true });
      }
      /* Token bleibt bis zum erfolgreichen Passwort-Check gültig (5 min) */
      if (!checkRateLimit('pw:' + number)) {
        loginTokens.delete(lt);
        securityEvent('AUTH_BRUTE_FORCE', { ip: reqIp(req), number: maskNumber(number), risk: 40 });
        return sendJson(res, 429, { error: 'Zu viele Fehlversuche. Bitte 10 Minuten warten.' });
      }
    } else {
      /* Owner-Login ohne 2FA-Token — Brute-Force-Schutz bleibt aktiv. */
      if (!checkRateLimit('pw:' + number)) {
        securityEvent('AUTH_BRUTE_FORCE', { ip: reqIp(req), number: maskNumber(number), risk: 55 });
        audit('owner', 'login.rate_limited', 'web', 'denied');
        return sendJson(res, 429, { error: 'Zu viele Fehlversuche. Bitte 10 Minuten warten.' });
      }
      if (lt) loginTokens.delete(lt); /* falls doch vorhanden (z. B. altes Frontend) sauber aufräumen */
    }

    /* Der feste Owner-Zugang hat Vorrang vor einem versehentlich als User
       angelegten Account mit derselben WhatsApp-Nummer. */
    if (isOwnerNumber && OWNER_PASSWORD && safeStringEqual(password, OWNER_PASSWORD)) {
      const token = createSession(number, 'owner', 'Maxichen 👑', null, req);
      audit(maskNumber(number), 'login.owner_no2fa', 'web', 'success');
      securityEvent('AUTH_OWNER_LOGIN_NO2FA', { ip: clientIp, number: maskNumber(number), risk: 5 });
      clearIpFailures(clientIp);
      return sendJson(res, 200, { ok: true, token, role: 'owner', name: 'Maxichen 👑' });
    }
    if (isOwnerNumber) {
      /* Owner-Nummer, aber falsches Passwort — klare Fehlermeldung statt
         stillschweigend in den normalen User-Login-Pfad durchzufallen. */
      securityEvent('AUTH_FAILURE', { ip: clientIp, number: maskNumber(number), risk: 30 });
      audit('owner', 'login.failed', 'web', 'denied');
      recordIpFailure(clientIp, 'Owner-Passwort falsch');
      return sendJson(res, 401, { error: 'Passwort falsch.' });
    }

    /* 1️⃣ Account-System (accounts.json) */
    const inputRaw = String(body.number || '').trim();
    const accLogin = /[^\d@+\s]/.test(inputRaw.split('@')[0])
      ? rbac.getAccountByUsername(inputRaw)
      : rbac.getAccountByNumber(number);
    if (accLogin) {
      if (accLogin.status !== 'active' || accLogin.role === 'banned') {
        securityEvent('AUTH_BANNED_LOGIN', { ip: reqIp(req), number: maskNumber(number), risk: 15 });
        audit(accLogin.username, 'login.banned', 'web', 'denied');
        const dbB = readDb();
        const ban = findBan(dbB, accLogin.number);
        return sendJson(res, 403, { error: 'banned', banned: { by: ban?.bannedByName || 'LoveBot', reason: ban?.reason || accLogin.lockedReason || 'Account gesperrt.', bannedAt: ban?.bannedAt || null, owners: getOwnerContactList(dbB) } });
      }
      if (!rbac.checkLogin(accLogin, password)) {
        securityEvent('AUTH_FAILED', { ip: clientIp, number: maskNumber(number), risk: 10 });
        audit(accLogin.username, 'login.failed', 'web', 'denied');
        recordIpFailure(clientIp, 'Passwort falsch (' + accLogin.username + ')');
        return sendJson(res, 401, { error: 'Passwort falsch.' });
      }
      loginTokens.delete(lt);
      rbac.touchLogin(accLogin.id);
      const token = createSession(accLogin.number, accLogin.role, accLogin.username, {
        username: accLogin.username, mustChange: !!accLogin.mustChange, scope: accLogin.scope, accountId: accLogin.id
      }, req);
      audit(accLogin.username, 'login.' + accLogin.role, 'web', 'success');
      clearIpFailures(clientIp);
      return sendJson(res, 200, { ok: true, token, role: accLogin.role, name: accLogin.username, mustChange: !!accLogin.mustChange });
    }

    /* (Der Owner-Login selbst wurde bereits weiter oben behandelt — hier
       kommt nur noch der Legacy-webusers-Pfad für Nicht-Owner-Konten.) */

    const db = readDb();

    /* 🚫 Gebannte Personen können sich NICHT einloggen */
    const ban = findBan(db, number);
    if (ban) {
      return sendJson(res, 403, {
        error: 'banned',
        banned: {
          by: ban.bannedByName || 'LoveBot Automod',
          byJid: ban.bannedBy || '',
          reason: ban.reason || 'Kein Grund angegeben',
          bannedAt: ban.bannedAt || null,
          owners: getOwnerContactList(db)
        }
      });
    }

    const user = db.meta?.webusers?.[number];
    if (user && verifyPassword(password, user.salt, user.hash)) {
      db.meta.webusers[number].lastLogin = new Date().toISOString();
      writeDb(db);
      loginTokens.delete(lt);
      const token = createSession(number, user.role || 'user', user.name || `+${number}`, null, req);
      audit(maskNumber(number), 'login.user', 'web', 'success');
      clearIpFailures(clientIp);
      return sendJson(res, 200, { ok: true, token, role: user.role || 'user', name: user.name || `+${number}` });
    }
    securityEvent('AUTH_FAILURE', { ip: clientIp, number: maskNumber(number), risk: 10 });
    audit(maskNumber(number), 'login.failed', 'web', 'denied');
    recordIpFailure(clientIp, 'Passwort falsch');
    return sendJson(res, 401, { error: 'Passwort falsch.' });
  }

  /* ---- REGISTRIERUNG SCHRITT 1: Code per WhatsApp anfordern */
  if (pathname === '/api/request-code' && req.method === 'POST') {
    const body = await readBody(req);
    const number = cleanNumber(body.number);
    if (number.length < 8 || number.length > 15) {
      return sendJson(res, 400, { error: 'Ungültige Nummer. Bitte mit Ländervorwahl eingeben (z. B. 4915155894714).' });
    }
    /* 🔐 2FA: Auch der Owner braucht jetzt zuerst einen WhatsApp-Code. */
    const purpose = body.purpose === 'login' ? 'login' : 'register';
    const db = readDb();
    const banAtReg = findBan(db, number);
    if (banAtReg) {
      return sendJson(res, 403, {
        error: 'banned',
        banned: {
          by: banAtReg.bannedByName || 'LoveBot Automod',
          byJid: banAtReg.bannedBy || '',
          reason: banAtReg.reason || 'Kein Grund angegeben',
          bannedAt: banAtReg.bannedAt || null,
          owners: getOwnerContactList(db)
        }
      });
    }
    if (purpose === 'register') {
      if (db.meta?.webusers?.[number]) {
        return sendJson(res, 400, { error: 'Diese Nummer hat bereits ein Passwort. Bitte direkt einloggen.' });
      }
    } else {
      /* Login-2FA: Code nur für bekannte Konten (Owner oder registrierter Web-User) */
      const known = number === OWNER_NUMBER || !!db.meta?.webusers?.[number] || !!rbac.getAccountByNumber(number);
      if (!known) {
        securityEvent('AUTH_UNKNOWN_ACCOUNT', { ip: reqIp(req), number: maskNumber(number), risk: 5 });
        return sendJson(res, 400, { error: 'Kein Konto für diese Nummer. Registrieren geht über den Login-Dialog nicht mehr — Code nur für bestehende Konten.' });
      }
    }
    if (!checkRateLimit(number)) {
      return sendJson(res, 429, { error: 'Zu viele Versuche. Bitte 10 Minuten warten.' });
    }
    const code = String(Math.floor(100000 + Math.random() * 900000));
    pendingCodes.set(number, { code, expires: Date.now() + 5 * 60000, attempts: 0, purpose });
    const id = newToken();
    queueMailbox({
      id,
      type: 'sendcode',
      to: number,
      jid: `${number}@s.whatsapp.net`,
      status: 'pending',
      createdAt: new Date().toISOString(),
      text: `> 💜 *LOVE BOT — VERIFIZIERUNG*\n\nDein Code für das LoveBot-Dashboard:\n\n*${code}*\n\n⏳ Gültig für 5 Minuten.\n🔒 Teile diesen Code mit NIEMANDEM!\n☾ LoveBot fragt dich NIE von selbst nach Codes.`
    });
    return sendJson(res, 200, { ok: true, mailboxId: id });
  }

  /* ---- MAILBOX-STATUS (wurde der Code versendet?) */
  if (pathname.startsWith('/api/mailbox/') && req.method === 'GET') {
    const id = pathname.split('/')[2];
    const mail = readWebmail();
    const item = (mail.queue || []).find((q) => q.id === id);
    if (!item) return sendJson(res, 404, { error: 'Unbekannter Auftrag.' });
    return sendJson(res, 200, { status: item.status, error: item.error || null, result: item.result || null });
  }

  /* ---- REGISTRIERUNG SCHRITT 2: Code prüfen */
  if (pathname === '/api/verify-code' && req.method === 'POST') {
    const body = await readBody(req);
    const number = cleanNumber(body.number);
    const code = String(body.code || '').trim();
    const pending = pendingCodes.get(number);
    if (!pending || pending.expires < Date.now()) {
      return sendJson(res, 400, { error: 'Kein Code angefordert oder abgelaufen. Fordere einen neuen an.' });
    }
    if (pending.attempts >= 5) {
      pendingCodes.delete(number);
      return sendJson(res, 429, { error: 'Zu viele Fehlversuche. Fordere einen neuen Code an.' });
    }
    if (pending.code !== code) {
      pending.attempts++;
      return sendJson(res, 400, { error: `Code falsch. Noch ${5 - pending.attempts} Versuche.` });
    }
    pendingCodes.delete(number);
    if (pending.purpose === 'login' || body.purpose === 'login') {
      const loginToken = newToken();
      loginTokens.set(loginToken, { number, expires: Date.now() + 5 * 60000 });
      audit(maskNumber(number), 'login.2fa_ok', 'web', 'success');
      return sendJson(res, 200, { ok: true, loginToken });
    }
    const setupToken = newToken();
    setupTokens.set(setupToken, { number, expires: Date.now() + 15 * 60000 });
    return sendJson(res, 200, { ok: true, setupToken });
  }

  /* ---- REGISTRIERUNG SCHRITT 3: Passwort setzen */
  if (pathname === '/api/set-password' && req.method === 'POST') {
    const body = await readBody(req);
    const setup = setupTokens.get(String(body.setupToken || ''));
    if (!setup || setup.expires < Date.now()) {
      return sendJson(res, 400, { error: 'Setup abgelaufen. Bitte neu registrieren.' });
    }
    const password = String(body.password || '');
    /* 🛡️ HTML-gefährliche Zeichen aus dem Anzeigenamen entfernen —
       Defense-in-Depth zusätzlich zum Escaping im Dashboard. */
    const name = String(body.name || '').trim().replace(/[<>"'&]/g, '').slice(0, 40);
    if (password.length < 6) {
      return sendJson(res, 400, { error: 'Passwort muss mindestens 6 Zeichen haben.' });
    }
    setupTokens.delete(body.setupToken);
    const { salt, hash } = hashPassword(password);
    const db = readDb();
    if (!db.meta) db.meta = {};
    if (!db.meta.webusers) db.meta.webusers = {};
    db.meta.webusers[setup.number] = {
      name: name || `+${setup.number}`,
      salt,
      hash,
      role: 'user',
      createdAt: new Date().toISOString(),
      lastLogin: null
    };
    /* Passwort-Status auch im LoveBot-Profil sichern */
    for (const p of Object.values(db.users || {})) {
      const pj = String(p?.identity?.jid || '');
      if (pj.includes(setup.number)) {
        if (!p.security) p.security = {};
        p.security.dashboard = { enabled: true, name: name || null, setAt: new Date().toISOString() };
        break;
      }
    }
    writeDb(db);
    const token = createSession(setup.number, 'user', name || `+${setup.number}`, null, req);
    return sendJson(res, 200, { ok: true, token, role: 'user', name: name || `+${setup.number}` });
  }

  /* ---- Öffentliche Infos für die Landing-Page ---- */
  if (pathname === '/api/siteinfo') {
    const db = readDb();
    return sendJson(res, 200, {
      name: 'LoveBot',
      by: 'Maxichen',
      prefix: '$',
      ownerJid: '4915155894714@s.whatsapp.net',
      ownerLid: '269574108926096@lid',
      links: {
        website: 'https://maxichen.de',
        dashboard: 'https://maxichen.gamebot.me',
        tiktok: 'https://www.tiktok.com/@maxichensworld',
        youtube: 'https://youtube.com/@masterofmax9214',
        instagram: 'https://www.instagram.com/max_.kstr',
        github: 'https://github.com/maxikstrr',
        discord: 'https://discord.gg/qS2GTkXR',
        channel: 'https://whatsapp.com/channel/0029Vb8EH4IBqbrAu9LxUH3X',
        devgroup: 'https://chat.whatsapp.com/DFk8T8y0OaVGbT8E0yMMRD'
      },
      counts: {
        users: Object.keys(db.users || {}).length,
        groups: Object.keys(db.groups || {}).length,
        bans: Object.keys(db.bans || {}).length
      },
      deltas: overviewDeltas(db),
      heartbeat: readHeartbeat(),
      loveplus: loveplusLiveSnapshot()
    });
  }

  /* 📊 Öffentliche Plattform-Statistiken (kein Login) — echte, aggregierte Zahlen
   * für /statistics.html: Nutzer/Gruppen/Paare/Love-XP/Achievements + Top-Befehle
   * + 14-Tage-Aktivitätsverlauf. Nichts hiervon ist personenbezogen. */
  if (pathname === '/api/statistics') {
    const db = readDb();
    const lp = loveplusLiveSnapshot();
    const fleet = SessionManager.fleetStats();
    let topCmds = [];
    let totalCalls = 0;
    let activity = [];
    try { topCmds = SessionManager.topCommands(10); } catch (e) {}
    try { totalCalls = SessionManager.totalCommandCalls(); } catch (e) {}
    try { activity = SessionManager.commandActivityByDay(14); } catch (e) {}
    const regStats = CommandRegistry.stats();
    return sendJson(res, 200, {
      counts: {
        users: Object.keys(db.users || {}).length,
        groups: Object.keys(db.groups || {}).length,
        bans: Object.keys(db.bans || {}).length,
        sessions: fleet.managed,
        sessionsOnline: fleet.running
      },
      registry: {
        commands: regStats.commands,
        categories: regStats.categories,
        aliases: regStats.aliases
      },
      loveplus: {
        couples: lp.couples,
        loveXpTotal: lp.loveXpTotal,
        pets: lp.pets,
        achievementsUnlocked: lp.achievementsUnlocked
      },
      commandUsage: {
        totalCalls,
        top: topCmds
      },
      activity14d: activity,
      generatedAt: new Date().toISOString()
    });
  }

  /* 🏆 Öffentliches Leaderboard (kein Login) — Top-Level/XP, Top-Reichste,
   * Top-Paare. Namen werden anonymisiert (Username falls gesetzt, sonst
   * maskierte Nummer) — dieselbe Logik wie im übrigen öffentlichen API. */

  if (pathname === '/api/leaderboard') {
    const profiles = [];
    try {
      const dir = path.join('Database', 'LoveUser');
      for (const bid of fs.readdirSync(dir).slice(0, 3000)) {
        try {
          const prof = JSON.parse(fs.readFileSync(path.join(dir, bid, bid + '.json'), 'utf8'));
          const prog = prof?.progression || {};
          let weekXp = 0, monthXp = 0;
          try {
            const startToday = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z').getTime();
            for (const e of (prog.xpDaily || [])) {
              if (!e || !e.d) continue;
              const age = Math.round((startToday - new Date(e.d + 'T00:00:00Z').getTime()) / 86400000);
              if (!Number.isFinite(age) || age < 0) continue;
              if (age < 7) weekXp += Number(e.a) || 0;
              if (age < 30) monthXp += Number(e.a) || 0;
            }
          } catch (e) {}
          profiles.push({
            bid,
            name: prof?.registration?.name || prof?.identity?.username || maskNumGlobal(bid.split('jid')[0]),
            level: prog.level || 0,
            prestige: prog.prestige || 0,
            xp: prog.xp || 0,
            totalXp: prog.totalXp || 0,
            streak: prog.streak || 0,
            title: prog.title || null,
            badges: Object.keys(prog.badges || {}).length,
            copper: prof?.wallet?.copper || 0,
            bank: prof?.bank?.copper || 0,
            weekXp, monthXp
          });
        } catch (e) {}
      }
    } catch (e) {}
    const lp = readLoveplusGlobal();
    const couples = Object.values(lp.couples || {});
    const byProgression = (a, b) =>
      (b.prestige || 0) - (a.prestige || 0) || (b.level || 0) - (a.level || 0) || (b.xp || 0) - (a.xp || 0) || (b.totalXp || 0) - (a.totalXp || 0);
    /* Nur Nutzer mit echtem Fortschritt in die Level-Bestenliste (sonst füllt sich
       die Liste mit 0-XP-Platzhaltern). Fallback: alle, wenn niemand gestartet hat. */
    const progressed = profiles.filter((p) => (p.level || 0) > 0 || (p.xp || 0) > 0 || (p.totalXp || 0) > 0);
    const levelPool = progressed.length ? progressed : profiles;
    return sendJson(res, 200, {
      topLevel: levelPool.slice().sort(byProgression).slice(0, 10)
        .map((p) => ({ name: p.name, level: p.level, prestige: p.prestige, xp: p.xp, totalXp: p.totalXp, weekXp: p.weekXp || 0, monthXp: p.monthXp || 0, streak: p.streak, title: p.title || null, badges: p.badges || 0, achievements: Object.keys(lp.users?.[p.bid]?.achievements || {}).length, rank: rankFor(p.prestige || 0, p.level || 0).full })),
      topRich: profiles.slice().sort((a, b) => ((b.copper || 0) + (b.bank || 0)) - ((a.copper || 0) + (a.bank || 0))).slice(0, 10)
        .map((p) => ({ name: p.name, copper: p.copper, bank: p.bank || 0, total: (p.copper || 0) + (p.bank || 0), level: p.level, prestige: p.prestige })),
      topCouples: couples.slice().sort((a, b) => (b.loveXp || 0) - (a.loveXp || 0)).slice(0, 10)
        .map((c) => ({ n1: safeDisplayName(c.n1) || '💜', n2: safeDisplayName(c.n2) || '💜', loveXp: c.loveXp || 0, level: c.level || 1, streak: c.streak || 0 })),
      generatedAt: new Date().toISOString(),
      event: (() => { try {
        const m = xpRules().multipliers || {};
        return { active: !!m.eventActive, name: String(m.eventName || ''), endsAt: m.eventEndsAt || null, mult: Number(m.event) || 1 };
      } catch (e) { return { active: false }; } })()
    });
  }

  /* ⚖️ Impressum-Produktionscheck: ist die Impressum-Seite veröffentlichungsbereit?
     Liest public/impressum-data.json — leere Felder = fehlt. NIE erfundene Daten! */
  if (pathname === '/api/legal-check') {
    let data = null;
    try { data = JSON.parse(fs.readFileSync(path.join('public', 'impressum-data.json'), 'utf8')); } catch (e) {}
    const b = data?.betreiber || {};
    const checks = {
      name: !!(String(b.vorname || '').trim() && String(b.nachname || '').trim()),
      adresse: !!(String(b.strasse || '').trim() && String(b.plz || '').trim() && String(b.ort || '').trim()),
      email: !!(String(b.email || '').trim()),
      telefon: !!(String(b.telefon || '').trim())
    };
    const gewerblich = !!data?.status?.kommerziell;
    let gewerblichOk = !gewerblich;
    if (gewerblich) {
      const g = data?.gewerblich || {};
      gewerblichOk = !!(String(g.ustIdNr || '').trim() && String(g.registergericht || '').trim() && String(g.registernummer || '').trim());
    }
    const ready = checks.name && checks.adresse && checks.email && gewerblichOk;
    return sendJson(res, 200, {
      ok: ready,
      checks,
      gewerblich,
      gewerblichOk,
      status: data?.status?.hinweis || 'LoveBot ist ein privat betriebenes Hobbyprojekt und wird ohne kommerzielle Gewinnerzielungsabsicht betrieben.',
      updated: data?.updated || null
    });
  }

  if (pathname === '/api/commands') {
    /* ?rich=1 → flache Liste mit Aliase/Rechten/Cooldown (Admin, Doku, Tester) */
    const query = new URL('http://x' + req.url).searchParams;
    if (query.get('rich') === '1') {
      return sendJson(res, 200, { rich: CommandRegistry.getRich(), stats: CommandRegistry.stats() });
    }
    const q = query.get('q');
    if (q) return sendJson(res, 200, { results: CommandRegistry.search(q) });
    return sendJson(res, 200, { commands: COMMAND_CATEGORIES, stats: CommandRegistry.stats() });
  }

  /* 📡 Öffentliches Session-Center: Live-Sessions (Nummern maskiert) */
  if (pathname === '/api/sessions') {
    try {
      return sendJson(res, 200, {
        sessions: SessionManager.listSessions(),
        activity: SessionManager.recentActivity(25),
        audit: SessionManager.recentAudit(40),
        fleet: SessionManager.fleetStats()
      });
    } catch (smErr) {
      return sendJson(res, 200, { sessions: [], activity: [] });
    }
  }

  /* ⚡ LIVE-STREAM (Server-Sent Events): Dashboard-Updates ohne Reload.
     Gleiche Daten wie /api/sessions, gepusht alle 3 Sekunden. */
  if (pathname === '/api/live') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    });
    const push = () => {
      try {
        const payload = JSON.stringify({
          sessions: SessionManager.listSessions(),
          activity: SessionManager.recentActivity(25),
          audit: SessionManager.recentAudit(40),
          fleet: SessionManager.fleetStats(),
          /* 💜 LoveCore: Live-Event-Feed (XP, Level-Ups, Games, Achievements) */
          events: LoveEngine.recent(25)
        });
        res.write('data: ' + payload + '\n\n');
      } catch (e) {}
    };
    push();
    const interval = setInterval(push, 3000);
    req.on('close', () => clearInterval(interval));
    return; /* Response bleibt offen */
  }

  /* ----  Registrierung: Username + Nummer + Code → USER-Account ------------ */
  if (pathname === '/api/register' && req.method === 'POST') {
    const body = await readBody(req);
    const setup = setupTokens.get(String(body.setupToken || ''));
    if (!setup || setup.expires < Date.now()) return sendJson(res, 400, { error: 'Setup abgelaufen. Bitte neu registrieren.' });
    const password = String(body.password || '');
    const username = String(body.username || '').trim();
    /* 🔐 DSGVO-Pflicht: ohne aktive Zustimmung zur Datenschutzerklärung
       gibt es KEINE Kontoerstellung — auch nicht, wenn das Frontend-
       Häkchen umgangen wird (Client-Checks lassen sich manipulieren). */
    if (body.privacyAccepted !== true) {
      return sendJson(res, 400, { error: 'Bitte zuerst der Datenschutzerklärung zustimmen.', needPrivacyConsent: true });
    }
    if (password.length < 8) return sendJson(res, 400, { error: 'Passwort muss mindestens 8 Zeichen haben.' });
    if (username.length < 3 || username.length > 18) return sendJson(res, 400, { error: 'Username: 3–18 Zeichen.' });
    /* 🛡️ Zeichensatz-Whitelist statt Blacklist: nur Buchstaben/Zahlen/
       _ . - erlaubt. Verhindert HTML/Skript-Zeichen (<, >, ", ', &) im
       Username, damit ein zukünftiger, ungeschützter Render-Ort (falls
       mal ein fmt.esc()-Aufruf vergessen wird) kein XSS auslösen kann —
       zusätzlich zum bestehenden Escaping im Dashboard. */
    if (!/^[a-zA-Z0-9_.\-äöüÄÖÜß]+$/.test(username)) {
      return sendJson(res, 400, { error: 'Username darf nur Buchstaben, Zahlen, _ . - enthalten.' });
    }
    if (rbac.getAccountByUsername(username)) return sendJson(res, 400, { error: 'Username vergeben.' });
    setupTokens.delete(body.setupToken);
    const created = rbac.createAccount({ username, number: setup.number, role: 'user', mustChange: false });
    /* Zustimmungs-Nachweis (Zeitpunkt) wird im Audit-Log mitgeschrieben —
       DSGVO-konformer Nachweis, dass aktiv zugestimmt wurde. */
    audit(created.account.username, 'account.registered', 'web', 'success');
    audit(created.account.username, 'privacy.consent_accepted', 'web', 'success');
    const token = createSession(setup.number, 'user', created.account.username, { username: created.account.username, accountId: created.account.id }, req);
    return sendJson(res, 200, { ok: true, token, role: 'user', name: created.account.username });
  }

  /* Der API-Layer nutzt den Heartbeat, um den echten Server vom Demo-Modus
     zu unterscheiden. Diese öffentliche Statusroute darf kein Login verlangen. */
  if (pathname === '/api/heartbeat') {
    return sendJson(res, 200, readHeartbeat());
  }

  /* 🛠️ Wartungsmodus-Status abrufen — bewusst OHNE Login-Zwang, damit die
     „Zugriff verweigert“-Seite selbst (die ja niemand eingeloggt sieht)
     Grund/Zeit/Von live nachladen kann. GET ist rein lesend, kein Risiko. */
  if (pathname === '/api/maintenance' && req.method === 'GET') {
    return sendJson(res, 200, { ok: true, ...getMaintenance() });
  }

  /* 🛠️ Wartungsmodus per Dashboard umschalten — nur Owner. (Der Bot-Befehl
     $offline/$online im WhatsApp-Chat ruft stattdessen direkt setMaintenanceOn/Off
     auf; das hier ist der Web-Weg, z. B. wenn der Bot gerade offline ist.) */
  if (pathname === '/api/maintenance' && req.method === 'POST') {
    const maintSessionPost = getSession(req);
    if (!maintSessionPost) return sendJson(res, 401, { error: 'Nicht eingeloggt.' });
    if (roleOf(maintSessionPost) !== 'owner') return sendJson(res, 403, { error: 'Nur der Owner darf den Wartungsmodus umschalten.' });
    const body = await readBody(req);
    const actorLabel = maintSessionPost.username || maintSessionPost.name || 'Owner (Web)';
    if (body.on === true) {
      /* 🔐 Wartungsmodus sperrt die ganze Website/den Bot für alle außer
         dem Owner — kritisch genug für eine Step-up-Reauth. */
      if (!requireStepUp(req, res, maintSessionPost, body, 'maintenance.on')) return;
      const reason = String(body.reason || '').trim().slice(0, 500) || 'Wartungsarbeiten laufen gerade — bin gleich zurück! 💜';
      const state = setMaintenanceOn(reason, actorLabel);
      audit(actorLabel, 'maintenance.on', reason, 'success');
      securityEvent('MAINTENANCE_MODE_ON', { risk: 20, action: 'applied', reason, by: actorLabel });
      return sendJson(res, 200, { ok: true, ...state });
    } else {
      const state = setMaintenanceOff(actorLabel);
      audit(actorLabel, 'maintenance.off', '', 'success');
      securityEvent('MAINTENANCE_MODE_OFF', { risk: 5, action: 'applied', by: actorLabel });
      return sendJson(res, 200, { ok: true, ...state });
    }
  }

  /* ⚠️ Das frühere 📍 Geräte-/Standort-Gate (inkl. /api/device-info) wurde auf
     Wunsch des Owners entfernt — keine Standort-Erfassung mehr. */

  /* ---- alles darunter braucht Login */
  const session = getSession(req);
  if (!session) return sendJson(res, 401, { error: 'Nicht eingeloggt.' });

  /* ═══════════ 👑 OWNER-ADMIN-API (nur Rolle "owner") ═══════════ */

  /* LovePlus-Store lesen (Pets, Couples, Achievements, Inventar) */
  function readLoveplus() {
    try { return JSON.parse(fs.readFileSync(path.join('Database', 'loveplus.json'), 'utf8')); }
    catch (e) { return { users: {}, couples: {}, games: {} }; }
  }

  /* Vollprofile aus LoveUser/ aggregieren (Level, Wallet, Love) */
  function scanUserProfiles(limit = 3000) {
    const out = [];
    try {
      const dir = path.join('Database', 'LoveUser');
      const bids = fs.readdirSync(dir).slice(0, limit);
      for (const bid of bids) {
        try {
          const prof = JSON.parse(fs.readFileSync(path.join(dir, bid, bid + '.json'), 'utf8'));
          out.push({
            bid,
            name: prof?.registration?.name || prof?.identity?.username || '',
            registered: !!prof?.registration?.registered,
            level: prof?.progression?.level || 0,
            prestige: prof?.progression?.prestige || 0,
            xp: prof?.progression?.xp || 0,
            totalXp: prof?.progression?.totalXp || 0,
            xpSources: prof?.progression?.xpSources || {},
            xpDaily: prof?.progression?.xpDaily || [],
            neededXp: prof?.progression?.neededXpForLvOrPrestigeUp || 0,
            copper: prof?.wallet?.copper || 0,
            silver: prof?.wallet?.silver || 0,
            gold: prof?.wallet?.gold || 0,
            platin: prof?.wallet?.platin || 0,
            registeredAt: prof?.registration?.registeredAt || null,
            married: prof?.love?.married === true,
            spouse: prof?.love?.spouseName || null,
            marriedAt: prof?.love?.marriedAt || null
          });
        } catch (e) {}
      }
    } catch (e) {}
    return out;
  }

  function maskNum(n) {
    const x = String(n || '');
    return x.length <= 5 ? x : x.slice(0, 4) + '•••' + x.slice(-3);
  }

  /* 💜 Progression-5.0-Zusammenfassung: echte Katalogzahlen + Regeln + Analytik */
  async function buildProgressionSummary(profiles) {
    const usersMap = {};
    for (const x of (profiles || [])) {
      usersMap[x.bid] = { progression: {
        level: x.level || 0, prestige: x.prestige || 0, xp: x.xp || 0,
        totalXp: x.totalXp || 0, xpSources: x.xpSources || {}, xpDaily: x.xpDaily || []
      } };
    }
    let analytics = null;
    try { analytics = xpAnalytics(usersMap); } catch (e) { analytics = null; }
    let achTotal = 0, achCats = 0, achTiers = 0;
    try {
      const plus = await import('./loveplus.js');
      achTotal = (plus.ACHIEVEMENTS || []).length;
      achCats = (plus.ACHIEVEMENT_CATS || []).length;
      achTiers = (plus.ACHIEVEMENT_TIERS || []).length;
    } catch (e) {}
    const rules = xpRules();
    return {
      catalog: {
        achievements: achTotal, achievementCats: achCats, achievementTiers: achTiers,
        badges: (BADGES || []).length, titles: (TITLES || []).length,
        specialTitles: (SPECIAL_TITLES || []).length, milestones: (MILESTONES || []).length
      },
      rules: { rewards: rules.rewards || null, goals: rules.goals || null, version: rules.version || 1 },
      analytics
    };
  }

  function adminGuard() {
    if (roleOf(session) !== 'owner') {
      sendJson(res, 403, { error: 'Nur Owner.' });
      return false;
    }
    return true;
  }

  function tailJsonl(file, n) {
    const out = [];
    try {
      const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
      for (const line of lines.slice(-n)) { try { out.push(JSON.parse(line)); } catch (e) {} }
    } catch (e) {}
    return out.reverse();
  }

  /* 📊 Overview: alles echt aggregiert */
  if (pathname === '/api/admin/overview' && req.method === 'GET') {
    if (!adminGuard()) return;
    const db = readDb();
    const fleet = SessionManager.fleetStats();
    const list = SessionManager.listSessions();
    const lp = readLoveplus();
    const profiles = scanUserProfiles();
    const pets = Object.values(lp.users || {}).filter((u) => u.pet).length;
    const petTypes = {};
    for (const u of Object.values(lp.users || {})) if (u.pet) petTypes[u.pet.type] = (petTypes[u.pet.type] || 0) + 1;
    const couples = Object.values(lp.couples || {});
    const achievements = {};
    for (const u of Object.values(lp.users || {})) for (const a of Object.keys(u.achievements || {})) achievements[a] = (achievements[a] || 0) + 1;
    return sendJson(res, 200, {
      counts: {
        users: Object.keys(db.users || {}).length,
        groups: Object.keys(db.groups || {}).length,
        bans: Object.keys(db.bans || {}).length,
        activeGroups: Object.values(db.groups || {}).filter((g) => g && g.active !== false).length
      },
      deltas: overviewDeltas(db),
      fleet,
      totals: {
        messages: list.reduce((a, x) => a + (x.messages || 0), 0),
        commands: list.reduce((a, x) => a + (x.commands || 0), 0),
        errors: list.reduce((a, x) => a + (x.errors || 0), 0),
        copper: profiles.reduce((a, x) => a + (x.copper || 0), 0),
        couples: couples.length,
        loveXp: couples.reduce((a, c) => a + (c.loveXp || 0), 0),
        pets,
        petTypes,
        achievements
      },
      xp: LoveEngine.xpStats(profiles),
      economy: (() => { try { return economyAnalytics(db.users || {}); } catch (e) { return null; } })(),
      ai: (() => { try { return aiAnalytics(); } catch (e) { return null; } })(),
      topRich: profiles.sort((a, b) => b.copper - a.copper).slice(0, 10)
        .map((x) => ({ name: x.name || maskNum(x.bid.split('_')[0]), copper: x.copper, level: x.level })),
      topCouples: couples.sort((a, b) => (b.loveXp || 0) - (a.loveXp || 0)).slice(0, 10)
        .map((c) => ({ n1: c.n1 || '?', n2: c.n2 || '?', loveXp: c.loveXp || 0 })),
      activity: SessionManager.recentActivity(20),
      audit: SessionManager.recentAudit(20)
    });
  }

  /* 🔔 BENACHRICHTIGUNGEN (Progression 2.0): Zentrum für eingeloggte Nutzer */
  if (pathname === '/api/notifications' && req.method === 'GET') {
    if (!session) return sendJson(res, 401, { error: 'Nicht eingelogggt.' });
    const number = String(session.number || '');
    let bid = '';
    try {
      const dir = path.join('Database', 'LoveUser');
      for (const b of fs.readdirSync(dir)) {
        if (b.startsWith(number)) { bid = b; break; }
      }
    } catch (e) {}
    if (!bid) return sendJson(res, 200, { ok: true, list: [], unread: 0, note: 'Kein Bot-Profil zu dieser Nummer gefunden.' });
    const r = NotifCenter.listFor(bid);
    const prefs = (() => { try { return JSON.parse(fs.readFileSync(path.join('Database', 'LoveUser', bid, bid + '.json'), 'utf8'))?.notifications || {}; } catch (e) { return {}; } })();
    return sendJson(res, 200, { ok: true, ...r, prefs, types: NotifCenter.NOTIF_TYPES });
  }
  if (pathname === '/api/notifications/prefs' && req.method === 'POST') {
    if (!session) return sendJson(res, 401, { error: 'Nicht eingelogggt.' });
    const number = String(session.number || '');
    const profPath = (() => {
      try {
        const dir = path.join('Database', 'LoveUser');
        for (const b of fs.readdirSync(dir)) if (b.startsWith(number)) return path.join(dir, b, b + '.json');
      } catch (e) {}
      return null;
    })();
    if (!profPath) return sendJson(res, 404, { error: 'Kein Bot-Profil gefunden.' });
    let prof;
    try { prof = JSON.parse(fs.readFileSync(profPath, 'utf8')); } catch (e) { return sendJson(res, 404, { error: 'Profil nicht lesbar.' }); }
    const body = await readBody(req);
    const { updatePrefs } = await import('./notifications.js');
    const prefs = updatePrefs(prof, body.prefs || {});
    fs.writeFileSync(profPath, JSON.stringify(prof, null, 2), 'utf8');
    return sendJson(res, 200, { ok: true, prefs });
  }

  /* 👤 MEIN ACCOUNT (Progression 6.0): persönliches Dashboard — nur eigene Daten,
     nur nach Login (Session-Nummer → Profil). Keine JIDs, keine fremden Profile. */
  if (pathname === '/api/profile/me' && req.method === 'GET') {
    if (!session) return sendJson(res, 401, { error: 'Nicht eingelogggt.' });
    const found = findProfileByNumber(String(session.number || ''));
    if (!found) return sendJson(res, 404, { error: 'Kein Bot-Profil zu dieser Nummer gefunden.' });
    const prof = found.data || {};
    const bid = found.bid;
    const prog = prof.progression || {};
    const eco = ensureEconomy(prof) || {};
    const bal = getBalance(prof) || {};
    let ach = { count: 0, total: ACHIEVEMENTS.length };
    try { const ap = achievementProgress(bid, prof); ach = { count: ap.count, total: ap.total }; } catch (e) {}
    let rank = { pos: null, total: 0 };
    try { rank = globalRank(readDb().users || {}, bid) || rank; } catch (e) {}
    let mult = null;
    try { mult = xpMultiplierBreakdown(prof, Date.now(), {}); } catch (e) {}
    const tx = (eco.tx || []).slice(0, 10).map((t) => ({
      t: t.t, vault: t.v, delta: t.d, source: t.s, label: sourceLabel(t.s), reason: t.r || ''
    }));
    const dayXp = (prog.xpDaily || []).find((x) => x && x.d === new Date().toISOString().slice(0, 10))?.a || 0;
    return sendJson(res, 200, {
      ok: true,
      profile: {
        bid,
        name: prof.registration?.name || '',
        registeredAt: prof.registration?.registeredAt || null,
        privacy: {
          hideCity: !!prof.registration?.privacy?.hideCity,
          hideAge: !!prof.registration?.privacy?.hideAge,
          publicProfile: !!prof.registration?.privacy?.publicProfile,
          hideEconomy: !!prof.registration?.privacy?.hideEconomy
        }
      },
      progression: {
        level: prog.level || 0, prestige: prog.prestige || 0,
        xp: prog.xp || 0, needed: prog.neededXpForLvOrPrestigeUp || 0,
        totalXp: prog.totalXp || 0,
        streak: prog.streak || 0, bestStreak: prog.bestStreak || 0,
        badges: Object.keys(prog.badges || {}).length,
        achievements: ach,
        pendingRewards: (prog.pendingRewards || []).length,
        rank
      },
      economy: {
        wallet: bal.wallet || 0, bank: bal.bank || 0, total: bal.total || 0,
        capacity: capacityFor(prof, ach.count),
        periods: eco.periods || {},
        stats: eco.stats || {},
        daily: { streak: eco.daily?.streak || 0, best: eco.daily?.best || 0, last: eco.daily?.last || '' },
        interestAt: eco.interest?.lastAt || 0
      },
      transactions: tx,
      reports: {
        dayXp,
        weekXp: (() => { try { return weekXpSum(prof); } catch (e) { return 0; } })(),
        monthXp: (() => { try { return monthXpSum(prof); } catch (e) { return 0; } })(),
        yearXp: (() => { try { return yearXpSum(prof); } catch (e) { return 0; } })()
      },
      multiplier: mult ? { total: mult.total, capped: mult.capped, parts: mult.parts } : null
    });
  }

  /* 🔒 Eigene Economy-Sichtbarkeit umschalten (Dashboard-Parität zu $settings/$privacy) */
  if (pathname === '/api/profile/me/privacy' && req.method === 'POST') {
    if (!session) return sendJson(res, 401, { error: 'Nicht eingelogggt.' });
    const found = findProfileByNumber(String(session.number || ''));
    if (!found) return sendJson(res, 404, { error: 'Kein Bot-Profil gefunden.' });
    const body = await readBody(req);
    const prof = found.data || {};
    prof.registration = prof.registration || {};
    prof.registration.privacy = prof.registration.privacy || {};
    if (body.hideEconomy !== undefined) prof.registration.privacy.hideEconomy = !!body.hideEconomy;
    if (body.hideCity !== undefined) prof.registration.privacy.hideCity = !!body.hideCity;
    if (body.hideAge !== undefined) prof.registration.privacy.hideAge = !!body.hideAge;
    try { fs.writeFileSync(path.join('Database', 'LoveUser', found.bid, found.bid + '.json'), JSON.stringify(prof, null, 2), 'utf8'); } catch (e) {
      return sendJson(res, 500, { error: 'Speichern fehlgeschlagen.' });
    }
    audit(session.username || maskNumber(session.number), 'profile.privacy', 'eigene Sichtbarkeit geändert', 'success');
    return sendJson(res, 200, { ok: true, privacy: prof.registration.privacy });
  }
  if (pathname === '/api/notifications/read' && req.method === 'POST') {
    if (!session) return sendJson(res, 401, { error: 'Nicht eingelogggt.' });
    const number = String(session.number || '');
    let bid = '';
    try {
      const dir = path.join('Database', 'LoveUser');
      for (const b of fs.readdirSync(dir)) if (b.startsWith(number)) { bid = b; break; }
    } catch (e) {}
    if (!bid) return sendJson(res, 200, { ok: true });
    const body = await readBody(req);
    NotifCenter.markRead(bid, body.ids || (body.all === true ? 'all' : []));
    return sendJson(res, 200, { ok: true });
  }

  /* 💜 7.0 GROUPS + ECONOMY APIs */
  function groupRecord(gid) {
    try {
      const db = readDb();
      const g = db.groups?.[String(gid).replace(/@g\.us$/, '')];
      if (!g) return null;
      ensureGroupExtras(g);
      return g;
    } catch (e) { return null; }
  }
  if (pathname === '/api/groups' && req.method === 'GET') {
    if (!adminGuard()) return;
    const db = readDb();
    const list = Object.entries(db.groups || {}).map(([gid, g]) => {
      try {
        ensureGroupExtras(g);
        const li = groupLevelInfo(g);
        return { id: gid, name: g.subject || '', members: g.memberCount || 0, level: li.level, xp: li.total, msgs: g.xp?.msgs || 0, treasury: g.gtreasury?.balance || 0 };
      } catch (e) { return { id: gid, name: '', members: 0, level: 0, xp: 0, msgs: 0, treasury: 0 }; }
    });
    list.sort((a, b) => b.xp - a.xp);
    return sendJson(res, 200, { ok: true, groups: list });
  }
  {
    const mG = pathname.match(/^\/api\/groups\/([^/]+)(\/stats)?$/);
    if (mG && req.method === 'GET') {
      if (!session) return sendJson(res, 401, { error: 'Nicht eingelogggt.' });
      const g = groupRecord(decodeURIComponent(mG[1]));
      if (!g) return sendJson(res, 404, { error: 'Gruppe nicht gefunden.' });
      const users = readDb().users || {};
      const nameOf = (bid) => users[bid]?.registration?.name || users[String(bid).split('@')[0]]?.registration?.name || String(bid);
      if (mG[2] === '/stats') {
        const top = topMembers(g, 'xp', 25).map((t) => ({ bid: t.bid, name: nameOf(t.bid), xp: t.xp, m: t.m, games: t.games }));
        return sendJson(res, 200, {
          ok: true,
          top, history: g.xp?.history || {}, goals: g.goals || {},
          achievements: g.gach || {}, badges: g.gbadges || {},
          treasuryLog: (g.gtreasury?.log || []).slice(-20).reverse(),
          events: activeEvents(g)
        });
      }
      const pub = groupPublic(g, { id: decodeURIComponent(mG[1]), subject: g.subject || '', count: g.memberCount || 0, admins: g.adminCount || 0, creation: g.creation || null });
      const out = { ok: true, group: pub, top5: topMembers(g, 'xp', 5).map((t) => ({ name: nameOf(t.bid), xp: t.xp })) };
      try { if (roleOf(session) === 'owner') out.audit = (g.gaudit || []).slice(-20).reverse(); } catch (e) {}
      return sendJson(res, 200, out);
    }
  }
  if (pathname === '/api/economy' && req.method === 'GET') {
    if (!session) return sendJson(res, 401, { error: 'Nicht eingelogggt.' });
    const found = findProfileByNumber(String(session.number || ''));
    if (!found) return sendJson(res, 404, { error: 'Kein Bot-Profil gefunden.' });
    const prof = found.data || {};
    const eco = ensureEconomy(prof) || {};
    const bal = getBalance(prof) || {};
    let achCount = 0;
    try { achCount = achievementProgress(found.bid, prof).count || 0; } catch (e) {}
    const tx = (eco.tx || []).slice(0, 50).map((t) => ({ t: t.t, vault: t.v, delta: t.d, source: t.s, label: sourceLabel(t.s), reason: t.r || '' }));
    const src = {}, sink = {};
    for (const t of (eco.tx || [])) {
      if (Number(t.d) >= 0) src[t.s] = (src[t.s] || 0) + Number(t.d);
      else sink[t.s] = (sink[t.s] || 0) - Number(t.d);
    }
    const topOf = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => ({ source: k, label: sourceLabel(k), amount: v }));
    let rules = {};
    try { rules = economyRules(); } catch (e) {}
    const rate = Number(rules.interestRate ?? 0.01), cap = Number(rules.interestCap ?? 5000);
    const lastI = Number(eco.interest?.lastAt) || 0;
    return sendJson(res, 200, {
      ok: true,
      wallet: bal.wallet || 0, bank: bal.bank || 0, total: bal.total || 0,
      capacity: capacityFor(prof, achCount),
      periods: eco.periods || {}, stats: eco.stats || {},
      daily: eco.daily || {}, interest: { lastAt: lastI, nextAt: lastI + 24 * 3600 * 1000, preview: Math.min(cap, Math.floor((bal.bank || 0) * rate)), rate, cap },
      transactions: tx, topSources: topOf(src), topSinks: topOf(sink)
    });
  }

  if (pathname === '/api/progression/me' && req.method === 'GET') {
    if (!session) return sendJson(res, 401, { error: 'Nicht eingelogggt.' });
    const found = findProfileByNumber(String(session.number || ''));
    if (!found) return sendJson(res, 404, { error: 'Kein Bot-Profil gefunden.' });
    const prof = found.data || {};
    const prog = prof.progression || {};
    const lv = Number(prog.level) || 0, pr = Number(prog.prestige) || 0;
    let ach = { count: 0, total: 0, list: [] };
    try { ach = achievementProgress(found.bid, prof); } catch (e) {}
    const myBadges = Object.entries(prog.badges || {}).map(([id, ts]) => {
      const d = BADGES.find((b) => b.id === id) || {};
      return { id, emoji: d.emoji || '🏅', name: d.name || id, desc: d.desc || '', area: d.area || '', at: ts || 0 };
    });
    const levelTitle = [...TITLES].reverse().find((t) => lv >= (t.min || 0)) || TITLES[0] || {};
    const miles = (MILESTONES || []).map((m) => ({ level: m.level, label: m.label, coins: m.coins, reached: pr > 0 || lv >= (m.level || 0) }));
    let mult = null;
    try { mult = xpMultiplierBreakdown(prof, Date.now(), {}); } catch (e) {}
    return sendJson(res, 200, {
      ok: true,
      level: lv, prestige: pr, xp: prog.xp || 0, needed: prog.neededXpForLvOrPrestigeUp || 0,
      totalXp: prog.totalXp || 0, streak: prog.streak || 0, bestStreak: prog.bestStreak || 0,
      title: { custom: prof.identity?.title || '', level: levelTitle, special: SPECIAL_TITLES || [] },
      badges: myBadges, achievements: ach.list || [], achCount: ach.count || 0, achTotal: ach.total || 0,
      milestones: miles, goals: prog.goals || {}, goalStreak: prog.goalStreak || {},
      pendingRewards: prog.pendingRewards || [],
      xpSources: prog.xpSources || {},
      multiplier: mult ? { total: mult.total, capped: mult.capped, parts: mult.parts } : null
    });
  }

  /* 💜 7.0 AI APIs */
  if (pathname === '/api/ai/status' && req.method === 'GET') {
    if (!session) return sendJson(res, 401, { error: 'Nicht eingelogggt.' });
    let h = { ok: false, error: 'unavailable' }, cfg = {};
    try { h = await aiHealth(); } catch (e) {}
    try { cfg = aiConfig(); } catch (e) {}
    /* 7.0.2: dieselbe Health-Quelle wie $aistatus (aiHealth) — identische Werte. */
    const out = {
      ok: true, provider: cfg.provider || 'local', model: cfg.model || '',
      online: !!h.ok, latencyMs: h.ms ?? 0, error: h.ok ? '' : (h.error || 'unreachable'),
      code: h.ok ? null : (h.code || h.error || 'unreachable'),
      ready: h.ok ? h.ready !== false : false,
      modelFound: h.ok ? h.modelFound !== false : false,
      models: h.ok ? (h.modelCount ?? (Array.isArray(h.models) ? h.models.length : 0)) : 0,
      hint: h.ok ? '' : (h.hint || '')
    };
    try {
      if (roleOf(session) === 'owner') {
        out.analytics = aiAnalytics();
        out.limits = { perMin: cfg.perMin, perHour: cfg.perHour, perDay: cfg.perDay };
        out.baseUrl = cfg.baseUrl || '';
      }
    } catch (e) {}
    return sendJson(res, 200, out);
  }
  if (pathname === '/api/ai/models' && req.method === 'GET') {
    if (!session) return sendJson(res, 401, { error: 'Nicht eingelogggt.' });
    let models = [], cfg = {};
    try { models = await getProvider().models(); } catch (e) {}
    try { cfg = aiConfig(); } catch (e) {}
    const names = models.map((m) => m.name).filter(Boolean);
    return sendJson(res, 200, { ok: true, models, configured: cfg.model || '', found: names.includes(cfg.model) });
  }
  if (pathname === '/api/ai/chat' && req.method === 'POST') {
    if (!session) return sendJson(res, 401, { error: 'Nicht eingelogggt.' });
    const found = findProfileByNumber(String(session.number || ''));
    if (!found) return sendJson(res, 404, { error: 'Kein Bot-Profil gefunden.' });
    const body = await readBody(req);
    const text = String(body.text || '').slice(0, 2000);
    if (!text.trim()) return sendJson(res, 400, { error: 'Leere Nachricht.' });
    let rank = { pos: null, total: 0 };
    try { rank = globalRank(readDb().users || {}, found.bid) || rank; } catch (e) {}
    let r;
    try {
      r = await aiChat({ bid: found.bid, text, profile: found.data || {}, rank });
    } catch (e) {
      r = { ok: false, reason: 'unavailable', detail: String(e?.message || e).slice(0, 150) };
    }
    return sendJson(res, 200, r);
  }
  if (pathname === '/api/ai/memory' && req.method === 'GET') {
    if (!session) return sendJson(res, 401, { error: 'Nicht eingelogggt.' });
    const found = findProfileByNumber(String(session.number || ''));
    if (!found) return sendJson(res, 404, { error: 'Kein Bot-Profil gefunden.' });
    const scope = dmScope(found.bid);
    let conv = [];
    try { conv = getConversation(scope).slice(-10); } catch (e) {}
    let facts = [], prefs = {};
    try { facts = getFacts(found.bid); } catch (e) {}
    try { prefs = getAiPrefs(found.bid); } catch (e) {}
    return sendJson(res, 200, { ok: true, conversation: conv, facts, prefs });
  }
  if (pathname === '/api/ai/memory/clear' && req.method === 'POST') {
    if (!session) return sendJson(res, 401, { error: 'Nicht eingelogggt.' });
    const found = findProfileByNumber(String(session.number || ''));
    if (!found) return sendJson(res, 404, { error: 'Kein Bot-Profil gefunden.' });
    try { clearAiUser(found.bid, { keepPrefs: true }); } catch (e) {}
    return sendJson(res, 200, { ok: true });
  }

  /* ⭐ XP-REGELN (Progression 2.0): Kategorien, Multiplikatoren, Anti-Farm
     — Lese: xp.view · Änderung: xp.adjust + Step-up + Audit + Versionierung */
  if (pathname === '/api/xp/rules' && req.method === 'GET') {
    if (!perm(session, 'xp.view')) return sendJson(res, 403, { error: 'Keine Berechtigung (xp.view).' });
    return sendJson(res, 200, { ok: true, ...xpRules() });
  }
  if (pathname === '/api/xp/rules' && req.method === 'POST') {
    if (!perm(session, 'xp.adjust')) return sendJson(res, 403, { error: 'Keine Berechtigung (xp.adjust) — XP-Regeln sind ein kritisches Recht.' });
    const body = await readBody(req);
    if (!requireStepUp(req, res, session, body, 'xp.rules.changed')) return;
    const reason = String(body.reason || '').trim();
    if (reason.length < 5) return sendJson(res, 400, { error: 'Grund ist Pflicht (min. 5 Zeichen) — wird auditiert.' });
    const actor = session.username || session.number;
    const cur = xpRules();
    const next = {
      multipliers: Object.assign({}, cur.multipliers, body.multipliers || {}),
      categories: Object.fromEntries(Object.keys(cur.categories).map((k) => [k, Object.assign({}, cur.categories[k], (body.categories || {})[k] || {})])),
      antiFarm: Object.assign({}, cur.antiFarm, body.antiFarm || {}),
      bonuses: Object.assign({}, cur.bonuses, body.bonuses || {}),
      goals: Object.assign({}, cur.goals, body.goals || {}),
      rewards: Object.assign({}, cur.rewards, body.rewards || {}),
      xpRewards: Object.assign({}, cur.xpRewards, body.xpRewards || {}),
      economy: Object.assign({}, cur.economy, body.economy || {})
    };
    /* Grenzen, damit keine Regel das System brechen kann */
    next.multipliers.weekend = Math.max(1, Math.min(5, Number(next.multipliers.weekend) || 1));
    next.multipliers.event = Math.max(1, Math.min(10, Number(next.multipliers.event) || 1));
    next.multipliers.eventActive = !!next.multipliers.eventActive;
    next.multipliers.prestigePerLevel = Math.max(0, Math.min(0.5, Number(next.multipliers.prestigePerLevel) || 0));
    next.multipliers.prestigeCap = Math.max(0, Math.min(2, Number(next.multipliers.prestigeCap) || 0));
    /* ✖️👑🎪 Cap + Owner-Bonus + Event-Meta (Progression 6.0) */
    next.multipliers.totalCap = Math.max(1, Math.min(10, Number(next.multipliers.totalCap) || 3));
    next.multipliers.eventName = String(next.multipliers.eventName || '').slice(0, 40);
    next.multipliers.eventEndsAt = next.multipliers.eventEndsAt ? Math.max(0, Number(next.multipliers.eventEndsAt) || 0) : null;
    {
      const obDef = (cur.multipliers && cur.multipliers.ownerBonus) || {};
      const obIn = (next.multipliers && next.multipliers.ownerBonus) || {};
      next.multipliers.ownerBonus = {
        enabled: obIn.enabled !== undefined ? !!obIn.enabled : obDef.enabled !== false,
        bonus: Math.max(0, Math.min(1, Number(obIn.bonus ?? obDef.bonus ?? 0.1) || 0))
      };
    }
    /* 🔥 Streak-Multiplikatoren (Progression 3.0) — Tiefen-Merge, sonst würde
       ein partielles Update das Objekt zerlegen (Object.assign ist flach) */
    {
      const stDef = (cur.multipliers && cur.multipliers.streak) || {};
      const stIn = (next.multipliers && next.multipliers.streak) || {};
      const stNum = (v, fb) => Math.max(0, Math.min(1, Number(v ?? fb) || 0));
      next.multipliers.streak = {
        enabled: stIn.enabled !== undefined ? !!stIn.enabled : stDef.enabled !== false,
        d3: stNum(stIn.d3, stDef.d3), d7: stNum(stIn.d7, stDef.d7),
        d30: stNum(stIn.d30, stDef.d30), cap: stNum(stIn.cap, stDef.cap)
      };
    }
    for (const [k, v] of Object.entries(next.categories)) {
      if (v.enabled === undefined) v.enabled = true;
      v.enabled = !!v.enabled;
      for (const f of Object.keys(v)) if (f !== 'enabled') v[f] = Math.max(0, Math.min(100000, Number(v[f]) || 0));
    }
    next.antiFarm.msgCapPerHour = Math.max(10, Math.min(5000, Number(next.antiFarm.msgCapPerHour) || 300));
    next.antiFarm.cmdCapPerHour = Math.max(10, Math.min(5000, Number(next.antiFarm.cmdCapPerHour) || 150));
    next.antiFarm.duplicateWindowSec = Math.max(5, Math.min(3600, Number(next.antiFarm.duplicateWindowSec) || 45));
    next.antiFarm.duplicateMaxPerDay = Math.max(1, Math.min(100, Number(next.antiFarm.duplicateMaxPerDay) || 5));
    next.antiFarm.mutualFarmMaxPerHour = Math.max(2, Math.min(100, Number(next.antiFarm.mutualFarmMaxPerHour) || 6));
    next.antiFarm.suspiciousXpPerDay = Math.max(100, Math.min(100000, Number(next.antiFarm.suspiciousXpPerDay) || 1500));
    /* 🎁 Boni (Progression 3.0) */
    next.bonuses.enabled = next.bonuses.enabled !== false;
    for (const f of ['firstActionDaily', 'streak7', 'streak30', 'streak100']) {
      next.bonuses[f] = Math.max(0, Math.min(100000, Number(next.bonuses[f]) || 0));
    }
    /* 🎯 Ziele (Progression 4.0/5.0) — Kupfer-Belohnungen, keine XP */
    next.goals.enabled = next.goals.enabled !== false;
    for (const f of ['dailyXp', 'weeklyXp', 'dailyCopper', 'weeklyCopper', 'dailyMessages', 'dailyCommands', 'weeklyMessages', 'weeklyGames', 'monthlyXp', 'monthlyCopper', 'monthlyXpBonus']) {
      next.goals[f] = Math.max(0, Math.min(1000000, Number(next.goals[f]) || 0));
    }
    /* 🎁 Soziale XP-Belohnungen (Progression 6.0) — klein, gedeckelt */
    if (!next.xpRewards || typeof next.xpRewards !== 'object') next.xpRewards = {};
    for (const f of ['achievement', 'giftGiven', 'giftReceived']) {
      next.xpRewards[f] = Math.max(0, Math.min(1000, Number(next.xpRewards[f]) || 0));
    }
    /* 💰 Economy-Regeln (Progression 6.0) */
    if (!next.economy || typeof next.economy !== 'object') next.economy = {};
    {
      const ecoClamp = (k, fb, mx) => { next.economy[k] = Math.max(0, Math.min(mx, Number(next.economy[k] ?? fb) || 0)); };
      ecoClamp('coinCap', 999999999999, 999999999999);
      ecoClamp('transferMin', 1, 1000000);
      ecoClamp('transferMax', 10000, 100000000);
      ecoClamp('transferDailyCap', 50000, 1000000000);
      ecoClamp('bankBase', 100000, 1000000000);
      ecoClamp('bankPerLevel', 100, 1000000);
      ecoClamp('bankPerPrestige', 5000, 100000000);
      ecoClamp('bankPerAchievement', 50, 1000000);
      next.economy.interestPct = Math.max(0, Math.min(100, Number(next.economy.interestPct ?? 1) || 0));
      ecoClamp('interestCap', 5000, 10000000);
      ecoClamp('interestCooldownH', 24, 720);
      ecoClamp('starterCopper', 500, 1000000);
      ecoClamp('starterXp', 25, 100000);
      ecoClamp('dailyBase', 200, 100000);
      next.economy.dailyStreakPct = Math.max(0, Math.min(100, Number(next.economy.dailyStreakPct ?? 5) || 0));
      next.economy.dailyStreakCapPct = Math.max(0, Math.min(1000, Number(next.economy.dailyStreakCapPct ?? 100) || 0));
      ecoClamp('dailyBestBonus', 500, 1000000);
      ecoClamp('weeklyBase', 1000, 10000000);
      ecoClamp('monthlyBase', 5000, 100000000);
      ecoClamp('yearlyBase', 50000, 1000000000);
      const dmDef = (cur.economy && cur.economy.dailyMilestones) || {};
      const dmIn = (next.economy && next.economy.dailyMilestones) || {};
      const dmOut = {};
      for (const k of new Set([...Object.keys(dmDef), ...Object.keys(dmIn), 'd7', 'd30', 'd100', 'd365'])) {
        dmOut[k] = Math.max(0, Math.min(100000000, Number(dmIn[k] ?? dmDef[k]) || 0));
      }
      next.economy.dailyMilestones = dmOut;
    }
    /* 🎁 Rewards (Progression 5.0) — Level-/Prestige-Kupfer + Truhen, gedeckelt */
    if (!next.rewards || typeof next.rewards !== 'object') next.rewards = {};
    next.rewards.levelCopperBase = Math.max(0, Math.min(10000, Number(next.rewards.levelCopperBase ?? 20) || 0));
    next.rewards.levelCopperPerLevel = Math.max(0, Math.min(1000, Number(next.rewards.levelCopperPerLevel ?? 5) || 0));
    next.rewards.levelCopperCap = Math.max(0, Math.min(100000, Number(next.rewards.levelCopperCap ?? 400) || 0));
    next.rewards.prestigeCopper = Math.max(0, Math.min(10000000, Number(next.rewards.prestigeCopper ?? 10000) || 0));
    next.rewards.goalMinorCopper = Math.max(0, Math.min(100000, Number(next.rewards.goalMinorCopper ?? 25) || 0));
    {
      const chDef = (cur.rewards && cur.rewards.chests) || {};
      const chIn = (next.rewards && next.rewards.chests) || {};
      const chOut = {};
      for (const k of new Set([...Object.keys(chDef), ...Object.keys(chIn)])) {
        chOut[k] = Math.max(0, Math.min(1000000, Number(chIn[k] ?? chDef[k]) || 0));
      }
      next.rewards.chests = chOut;
    }
    const saved = saveXpRules(next, actor);
    audit(actor, 'xp.rules.changed', 'XP-Regeln → v' + saved.version + ' — ' + reason.slice(0, 160), 'success');
    securityEvent('XP_RULES_CHANGED', { actor, risk: 40, reason: reason.slice(0, 200), newVersion: saved.version });
    try { LoveEngine.emit('SESSION_EVENT', { reason: 'xp-rules-changed' }); } catch (e) {}
    return sendJson(res, 200, { ok: true, version: saved.version });
  }

  /* ⭐ XP & LEVEL (LoveCore): Statistik + Level-Tabelle — nur mit xp.view */
  if (pathname === '/api/xp' && req.method === 'GET') {
    if (!perm(session, 'xp.view')) return sendJson(res, 403, { error: 'Keine Berechtigung (xp.view).' });
    const profiles = scanUserProfiles();
    const stats = LoveEngine.xpStats(profiles);
    const top = profiles
      .map((x) => ({ name: x.name || maskNum(x.bid.split('_')[0]), bid: x.bid, level: x.level, prestige: x.prestige, xp: x.xp, totalXp: x.totalXp || x.xp }))
      .sort((a, b) => b.prestige - a.prestige || b.level - a.level || b.xp - a.xp)
      .slice(0, 15)
      .map((x) => ({ ...x, rank: rankFor(x.prestige, x.level).full }));
    let progression = null;
    try { progression = await buildProgressionSummary(profiles); } catch (e) { progression = null; }
    return sendJson(res, 200, { ok: true, stats, top, table: LoveEngine.levelTable(50, 0), progression });
  }

  /* 💜 PROGRESSION 5.0: Katalog + Regeln + Analytik fürs Dashboard — nur mit xp.view */
  if (pathname === '/api/progression/summary' && req.method === 'GET') {
    if (!perm(session, 'xp.view')) return sendJson(res, 403, { error: 'Keine Berechtigung (xp.view).' });
    const profiles = scanUserProfiles();
    const progression = await buildProgressionSummary(profiles);
    return sendJson(res, 200, { ok: true, progression, generatedAt: new Date().toISOString() });
  }

  /* ⭐ XP ADJUST (LoveCore, kritisch): Grund PFLICHT + Audit + Event.
     Nur mit xp.adjust (Owner + Deputy; kritisches Recht). */
  if (pathname === '/api/xp/adjust' && req.method === 'POST') {
    if (!perm(session, 'xp.adjust')) return sendJson(res, 403, { error: 'Keine Berechtigung (xp.adjust).' });
    const body = await readBody(req);
    const bid = String(body.bid || '').trim();
    const delta = Number(body.delta || 0);
    const reason = String(body.reason || '').trim();
    if (!/^[0-9a-z]+jid[0-9a-z]+i?d$/i.test(bid) && !/^\d+(_[a-z0-9]+)?$/i.test(bid)) {
      return sendJson(res, 400, { error: 'Ungültige Nutzer-ID.' });
    }
    if (!isFinite(delta) || delta === 0 || Math.abs(delta) > 10_000_000) {
      return sendJson(res, 400, { error: 'Delta muss zwischen -10.000.000 und +10.000.000 sein.' });
    }
    if (reason.length < 5) {
      return sendJson(res, 400, { error: 'Grund ist Pflicht (min. 5 Zeichen) — jede XP-Änderung wird auditiert.' });
    }
    const profPath = path.join('Database', 'LoveUser', bid, bid + '.json');
    let prof;
    try { prof = JSON.parse(fs.readFileSync(profPath, 'utf8')); } catch (e) { return sendJson(res, 404, { error: 'Nutzer-Profil nicht gefunden.' }); }
    const actor = session?.username || session?.number || 'web';
    if (delta > 0) {
      /* Positive Anpassung läuft durch die Level-Engine (Level-Ups + Kupfer möglich) */
      const { ensureProgression, grantXp, levelUpAnnounce } = await import('./levelsystem.js');
      ensureProgression(prof);
      grantXp(prof, delta, { source: 'admin' });
    } else {
      /* Negative Anpassung: nur XP reduzieren, KEIN Level-Down (konservativ, dokumentiert) */
      const { ensureProgression } = await import('./levelsystem.js');
      const pr = ensureProgression(prof);
      pr.xp = Math.max(0, (Number(pr.xp) || 0) + delta);
      pr.totalXp = Math.max(0, (Number(pr.totalXp) || 0) + delta);
    }
    try { fs.writeFileSync(profPath, JSON.stringify(prof, null, 2), 'utf8'); } catch (e) { return sendJson(res, 500, { error: 'Speichern fehlgeschlagen.' }); }
    audit(actor, 'xp.adjusted', bid + ': ' + (delta > 0 ? '+' : '') + delta + ' XP — ' + reason.slice(0, 200), 'success');
    try { LoveEngine.emit('XP_ADJUSTED', { bid, delta, reason: reason.slice(0, 120), name: prof?.registration?.name || '' }); } catch (e) {}
    return sendJson(res, 200, { ok: true, applied: true, reason: reason.slice(0, 200) });
  }

  /* ❤️ SYSTEM HEALTH (LoveCore): Komponenten-Status auf einen Blick */
  if (pathname === '/api/health' && req.method === 'GET') {
    if (!adminGuard()) return;
    const components = [];
    /* WhatsApp-Verbindung (Heartbeat des Bots) */
    let wb = null;
    try { wb = JSON.parse(fs.readFileSync(path.join('Database', 'heartbeat.json'), 'utf8')); } catch (e) {}
    const wbAge = wb?.time ? Date.now() - new Date(wb.time).getTime() : Infinity;
    components.push({ id: 'whatsapp', label: 'WhatsApp-Verbindung', ok: wbAge < 5 * 60_000, detail: wbAge < 5 * 60_000 ? 'online · ' + (wb?.uptimeSec ? Math.round(wb.uptimeSec / 3600) + 'h Uptime' : 'heartbeat') : (wb ? 'kein frisches Heartbeat (' + Math.round(wbAge / 60000) + ' Min.)' : 'kein Heartbeat gefunden') });
    /* Webserver */
    components.push({ id: 'web', label: 'Webserver', ok: true, detail: 'online · Uptime ' + Math.round(process.uptime() / 3600) + 'h' });
    /* Datenbank */
    let dbOk = false, dbKb = 0, backups = 0;
    try { dbKb = Math.round(fs.statSync(DB_PATH).size / 1024); dbOk = true; } catch (e) {}
    try { backups = fs.readdirSync('Database').filter((f) => f.startsWith('backup-')).length; } catch (e) {}
    components.push({ id: 'database', label: 'Datenbank (Database.json)', ok: dbOk, detail: dbOk ? fmtSizeKb(dbKb) + ' · ' + backups + ' Backups' : 'Datei nicht gefunden' });
    /* Sessions */
    const sess = SessionManager.listSessions();
    const online = sess.filter((x) => x.status === 'CONNECTED' || x.status === 'ONLINE').length;
    components.push({ id: 'sessions', label: 'Sessions', ok: online > 0, detail: online + '/' + sess.length + ' online' });
    /* Media-Engine (heutige Jobs) */
    let mediaJobs = 0, mediaOkToday = 0;
    try {
      const mj = JSON.parse(fs.readFileSync(path.join('Database', 'media.json'), 'utf8'));
      const today = new Date().toISOString().slice(0, 10);
      for (const j of mj.jobs || []) { if (String(j.ts || '').startsWith(today)) { mediaJobs++; if (j.ok) mediaOkToday++; } }
    } catch (e) {}
    components.push({ id: 'media', label: 'Media-Engine', ok: true, detail: mediaJobs ? mediaJobs + ' Jobs heute (' + mediaOkToday + ' ok)' : 'keine Jobs heute' });
    /* Security */
    const blocks = listBlockedIps().length;
    const bans = listManualBans().length;
    components.push({ id: 'security', label: 'Security', ok: true, detail: blocks + ' aktive IP-Blocks · ' + bans + ' manuelle Bans' });
    /* REAL DATA ONLY: zentrale Runtime-Health (additiv — components/checkedAt bleiben). */
    let sys = null;
    try { sys = await collectSystem(); } catch (e) {}
    let ai = { online: false, ready: false, code: null, model: null, models: 0, latencyMs: 0, hint: '' };
    try {
      const h = await aiHealth();
      ai = { online: !!h.ok, ready: h.ok ? h.ready !== false : false, code: h.ok ? null : (h.code || h.error || null), model: h.model || null, models: h.ok ? (h.modelCount ?? 0) : 0, latencyMs: h.ok ? (h.ms ?? 0) : 0, hint: h.ok ? '' : (h.hint || '') };
    } catch (e) {}
    const counts = { users: null, groups: null, commands: null, aliases: null, categories: null };
    try {
      const dc = collectDbCounts(readDb());
      counts.users = dc.users; counts.groups = dc.groups;
    } catch (e) {}
    try {
      const st = CommandRegistry.stats();
      counts.commands = st.commands; counts.aliases = st.aliases; counts.categories = st.categories;
    } catch (e) {}
    let dbFiles = [];
    try { dbFiles = ['Database.json', 'loveplus.json', 'ai.json', 'websessions.json'].map(statStore).filter(Boolean); } catch (e) {}
    const sessPub = sess.map((x) => ({ id: x.id, name: x.name, status: x.status, health: x.health, uptimeSec: x.uptimeSec, uptime: x.uptime, messages: x.messages, commands: x.commands, reconnects: x.reconnects, errors: x.errors, memoryMb: x.memoryMb, lastSeen: x.lastSeen }));
    return sendJson(res, 200, { ok: true, components, checkedAt: new Date().toISOString(), version: readPackageVersion(), system: sys, ai, counts, dbFiles, sessions: sessPub });
  }
  /* 👤 Nutzer-Suche + Profil */
  if (pathname === '/api/admin/users' && req.method === 'GET') {
    if (!adminGuard()) return;
    const q = String(new URL('http://x' + req.url).searchParams.get('q') || '').toLowerCase();
    const db = readDb();
    const lp = readLoveplus();
    const profiles = scanUserProfiles();
    const profByBid = new Map(profiles.map((p) => [p.bid, p]));
    const result = [];
    for (const [bid, u] of Object.entries(db.users || {})) {
      const name = u?.registration?.name || profByBid.get(bid)?.name || '';
      if (q && !bid.toLowerCase().includes(q) && !String(name).toLowerCase().includes(q)) continue;
      const lpU = lp.users?.[bid] || {};
      const prof = profByBid.get(bid) || {};
      result.push({
        bid,
        name: name || maskNum(bid.split('_')[0]),
        registered: !!u?.registration?.registered,
        registeredAt: u?.registration?.registeredAt || prof.registeredAt || null,
        level: prof.level || 0,
        prestige: prof.prestige || 0,
        xp: prof.xp || 0,
        totalXp: prof.totalXp || 0,
        neededXp: prof.neededXp || 0,
        copper: prof.copper || 0,
        silver: prof.silver || 0,
        gold: prof.gold || 0,
        platin: prof.platin || 0,
        married: prof.married || false,
        spouse: prof.spouse || null,
        marriedAt: prof.marriedAt || null,
        pet: lpU.pet ? lpU.pet.type + ' ' + lpU.pet.name + ' (Lv ' + (lpU.pet.level || 1) + ')' : null,
        achievements: Object.keys(lpU.achievements || {}).length,
        streak: lpU.lovebonus?.streak || 0
      });
      if (result.length >= 50) break;
    }
    return sendJson(res, 200, { users: result });
  }

  /* 👥 Gruppen */
  if (pathname === '/api/admin/groups' && req.method === 'GET') {
    if (!adminGuard()) return;
    const q = String(new URL('http://x' + req.url).searchParams.get('q') || '').toLowerCase();
    const db = readDb();
    const list = [];
    for (const [gid, g] of Object.entries(db.groups || {})) {
      if (q && !gid.toLowerCase().includes(q)) continue;
      list.push({ gid, active: g && g.active !== false, setupAt: g?.setupAt || null });
      if (list.length >= 100) break;
    }
    return sendJson(res, 200, { groups: list, total: Object.keys(db.groups || {}).length });
  }

  /* 🛡️ Moderation: Bans + Audit/Security-Log-Tails */
  if (pathname === '/api/admin/moderation' && req.method === 'GET') {
    if (!adminGuard()) return;
    const db = readDb();
    const bans = Object.entries(db.bans || {}).map(([k, b]) => ({
      id: k, reason: b?.reason || '?', by: b?.by || '?', at: b?.bannedAt || b?.at || null
    }));
    return sendJson(res, 200, {
      bans,
      auditTail: tailJsonl(path.join('Database', 'audit.jsonl'), 40),
      securityTail: tailJsonl(path.join('Database', 'security.jsonl'), 20)
    });
  }

  /* 📡 Session-Aktion (Owner) — mit Lock + Audit, reuse aus sessionManager */
  if (pathname === '/api/admin/session-action' && req.method === 'POST') {
    if (!adminGuard()) return;
    let body = '';
    req.on('data', (c) => body += c);
    req.on('end', () => {
      try {
        const { id, action, value, confirm } = JSON.parse(body || '{}');
        const actor = session.username || session.name || 'owner-web';
        if (!id || !action) return sendJson(res, 400, { error: 'id und action nötig.' });
        const lock = SessionManager.acquireLock(id, 'WEB_' + action.toUpperCase(), actor);
        if (!lock.ok) return sendJson(res, 409, { error: 'Session ist gerade beschäftigt (' + lock.held.op + ' durch ' + lock.held.by + ').' });
        let result;
        try {
          switch (action) {
            case 'pause': result = SessionManager.pauseSession(id, actor); break;
            case 'resume': result = SessionManager.resumeSession(id, actor); break;
            case 'stop': result = SessionManager.stopSession(id, actor); break;
            case 'start': result = { ok: SessionManager.spawnSession(id) }; break;
            case 'restart': SessionManager.stopSpawned(id); result = { ok: SessionManager.spawnSession(id) }; break;
            case 'maintenance': result = { ok: !!SessionManager.setMaintenance(id, value === true) }; break;
            case 'autostart': result = { ok: !!SessionManager.setAutoStart(id, value === true) }; break;
            case 'tags': result = { ok: !!SessionManager.setTags(id, String(value || '')) }; break;
            case 'env': result = { ok: !!SessionManager.setEnv(id, String(value || '')) }; break;
            case 'rename': result = { ok: !!SessionManager.renameSession(id, String(value || '')) }; break;
            case 'default': result = { ok: SessionManager.setDefault(id) }; break;
            case 'delete':
              if (confirm !== 'DELETE ' + id) return sendJson(res, 400, { error: 'Bestätigung fehlt: Erwartet \"DELETE ' + id + '\".' });
              result = SessionManager.deleteSession(id, { actor });
              break;
            default: return sendJson(res, 400, { error: 'Unbekannte Aktion.' });
          }
        } finally {
          SessionManager.releaseLock(id);
        }
        return sendJson(res, 200, { ok: result?.ok !== false, result, session: SessionManager.getSession(id) || null });
      } catch (e) {
        return sendJson(res, 500, { error: String(e?.message || e) });
      }
    });
    return;
  }

  /* 🚨 Emergency (Owner): restartFailed | stopAllSpawned */
  if (pathname === '/api/admin/emergency' && req.method === 'POST') {
    if (!adminGuard()) return;
    let body = '';
    req.on('data', (c) => body += c);
    req.on('end', () => {
      try {
        const { action, confirm } = JSON.parse(body || '{}');
        const actor = session.username || 'owner-web';
        if (action === 'restartFailed') {
          return sendJson(res, 200, { ok: true, results: SessionManager.restartFailed(actor) });
        }
        if (action === 'stopAllSpawned') {
          if (confirm !== 'STOP ALL') return sendJson(res, 400, { error: 'Bestätigung fehlt: Erwartet \"STOP ALL\".' });
          return sendJson(res, 200, { ok: true, results: SessionManager.stopAllSpawned(actor) });
        }
        return sendJson(res, 400, { error: 'Unbekannte Emergency-Aktion.' });
      } catch (e) {
        return sendJson(res, 500, { error: String(e?.message || e) });
      }
    });
    return;
  }

  /* 🔎 Globale Suche */
  /* 🎬 Media Center (Owner): Statistik, Live-Jobs & Logs aus Database/media.json */
  if (pathname === '/api/admin/media' && req.method === 'GET') {
    if (!adminGuard()) return;
    let m = {};
    try { m = JSON.parse(fs.readFileSync(path.join('Database', 'media.json'), 'utf8')); } catch (e) { m = { stats: {}, logs: [], live: [], config: {} }; }
    const stats = Object.entries(m.stats || {}).map(([cmd, s2]) => ({
      cmd, count: s2.count || 0, ok: s2.ok || 0, fail: s2.fail || 0,
      avgMs: s2.count ? Math.round((s2.msTotal || 0) / s2.count) : 0,
      successRate: s2.count ? Math.round(((s2.ok || 0) / s2.count) * 1000) / 10 : 100
    })).sort((a, b) => b.count - a.count);
    const totals = stats.reduce((acc, x) => ({ count: acc.count + x.count, ok: acc.ok + x.ok, fail: acc.fail + x.fail, ms: acc.ms + x.avgMs * x.count }), { count: 0, ok: 0, fail: 0, ms: 0 });
    /* Letzte 7 Tage (aus Logs) */
    const byDay = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      byDay[d] = 0;
    }
    for (const l of (m.logs || [])) {
      const d = String(l.ts || '').slice(0, 10);
      if (d in byDay) byDay[d]++;
    }
    const live = (m.live || []).filter((j) => Date.now() - (j.ts || 0) < 10 * 60 * 1000);
    return sendJson(res, 200, {
      stats, live,
      logs: (m.logs || []).slice(0, 100),
      byDay,
      totals: { ...totals, avgMs: totals.count ? Math.round(totals.ms / totals.count) : 0, successRate: totals.count ? Math.round((totals.ok / totals.count) * 1000) / 10 : 100 },
      config: { staticImage: m.config?.staticImage || 'Assets/max.jpeg (auto: Bilder/, tmp/ — sonst dunkler Standardrahmen)' }
    });
  }

  /* 🧪 Command-Tester (Owner): validiert against Registry — TROCKENLAUF, keine Ausführung */
  if (pathname === '/api/admin/command-test' && req.method === 'POST') {
    if (!adminGuard()) return;
    let body = '';
    req.on('data', (c) => body += c);
    req.on('end', () => {
      try {
        const { input } = JSON.parse(body || '{}');
        return sendJson(res, 200, CommandRegistry.validate(String(input || '')));
      } catch (e) {
        return sendJson(res, 500, { error: String(e?.message || e) });
      }
    });
    return;
  }

  if (pathname === '/api/admin/search' && req.method === 'GET') {
    if (!adminGuard()) return;
    const q = String(new URL('http://x' + req.url).searchParams.get('q') || '').toLowerCase().trim();
    if (q.length < 2) return sendJson(res, 200, { results: [] });
    const hits = [];
    for (const s of SessionManager.listSessions()) {
      if (s.id.includes(q) || s.name.toLowerCase().includes(q) || (s.tags || []).some((t) => t.includes(q))) {
        hits.push({ type: 'session', label: s.name + ' (' + s.id + ')', sub: s.status, id: s.id });
      }
    }
    const db = readDb();
    for (const [bid, u] of Object.entries(db.users || {})) {
      const name = u?.registration?.name || '';
      if (bid.toLowerCase().includes(q) || name.toLowerCase().includes(q)) {
        hits.push({ type: 'user', label: (name || maskNum(bid.split('_')[0])), sub: bid.slice(0, 24) + '…', id: bid });
      }
      if (hits.length > 30) break;
    }
    for (const gid of Object.keys(db.groups || {})) {
      if (gid.toLowerCase().includes(q)) hits.push({ type: 'group', label: gid.slice(0, 26) + '…', sub: 'Gruppe', id: gid });
      if (hits.length > 40) break;
    }
    for (const a of SessionManager.recentAudit(200)) {
      if (String(a.action).toLowerCase().includes(q) || String(a.sid).includes(q) || String(a.actor).toLowerCase().includes(q)) {
        hits.push({ type: 'audit', label: a.action + ' — ' + a.sid, sub: 'durch ' + a.actor, id: a.ts });
      }
      if (hits.length > 50) break;
    }
    for (const cat of COMMAND_CATEGORIES) {
      for (const c of cat.cmds) {
        if (c.cmd.includes(q)) hits.push({ type: 'command', label: '$' + c.cmd, sub: cat.title, id: c.cmd });
        if (hits.length > 60) break;
      }
    }
    return sendJson(res, 200, { results: hits.slice(0, 60) });
  }

  if (pathname === '/api/me') {
    if (session) {
      const role = roleOf(session);
      const acc = rbac.getAccountByNumber(session.number);
      return sendJson(res, 200, {
        ok: true, number: session.number, role, name: session.username || session.name,
        perms: acc ? rbac.effectivePerms(acc) : rbac.permsOf(role), mustChange: !!(acc && acc.mustChange),
        scope: session.scope || { type: 'global' }, username: session.username || null,
        status: (acc && acc.status) || 'active', restrictions: (acc && acc.status === 'restricted' ? acc.restrictions : []) || []
      });
    }
    return sendJson(res, 401, { error: 'Nicht eingeloggt.' });
  }

  /* 📜 VERLAUF (History) — rollenbewusst:
     • Owner  → ?user=<username|nummer> = Verlauf genau dieses Kontos,
                ohne user-Param = Verlauf ALLER Konten gemischt.
     • andere Rollen → immer nur der eigene Verlauf (user-Param wird ignoriert). */
  if (pathname === '/api/history' && req.method === 'GET') {
    const meNum = session && session.number;
    if (!meNum) return sendJson(res, 401, { error: 'Nicht eingeloggt.' });
    const isOwner = roleOf(session) === 'owner';
    const q = new URL('http://x' + req.url).searchParams;
    let targets = [];
    if (isOwner && q.get('user')) {
      const t = String(q.get('user')).trim();
      let acc = rbac.getAccountByUsername(t) || null;
      if (!acc) { const d = t.replace(/\D/g, ''); if (d) acc = rbac.getAccountByNumber(d); }
      if (acc) targets = [acc];
    } else if (isOwner) {
      targets = rbac.listAccounts();
    } else {
      const self = rbac.getAccountByNumber(meNum);
      targets = self ? [self] : [];
    }
    const entries = [];
    for (const acc of targets) {
      const u = acc.username || acc.number || '?';
      if (acc.createdAt) entries.push({ t: acc.createdAt, u, k: 'konto', label: 'Konto erstellt', d: 'Rolle: ' + acc.role + (acc.scope && acc.scope.type === 'group' ? ' · Scope: Gruppe' : ' · global'), by: 'system' });
      for (const h of (acc.roleHistory || [])) entries.push({ t: h.at, u, k: 'rolle', label: 'Rolle geändert', d: (h.from ? h.from + ' → ' : '→ ') + (h.role || '?'), by: h.by || '?' });
      for (const h of (acc.statusHistory || [])) entries.push({ t: h.at, u, k: 'status', label: 'Status geändert', d: (h.from ? h.from + ' → ' : '→ ') + (h.to || '?') + (h.reason ? ' · ' + h.reason : ''), by: h.by || '?' });
      for (const h of (acc.permsHistory || [])) entries.push({ t: h.at, u, k: 'rechte', label: 'Rechte geändert', d: h.reason || 'Rechte angepasst', by: h.by || '?' });
      if (acc.passwordChangedAt) entries.push({ t: acc.passwordChangedAt, u, k: 'pw', label: 'Passwort geändert', d: '', by: u });
      if (acc.lastLoginAt) entries.push({ t: acc.lastLoginAt, u, k: 'login', label: 'Login', d: 'letzte Anmeldung am Panel', by: u });
      if (acc.mustChange) entries.push({ t: acc.createdAt, u, k: 'hinweis', label: 'Temp-Passwort aktiv', d: 'Konto muss Passwort beim ersten Login ändern', by: 'system' });
    }
    entries.sort((a, b) => String(b.t || '').localeCompare(String(a.t || '')));
    const seen = new Set();
    const uniq = [];
    for (const e of entries) { const key = e.t + '|' + e.u + '|' + e.label + '|' + e.d + '|' + e.by; if (!seen.has(key)) { seen.add(key); uniq.push(e); } }
    return sendJson(res, 200, { ok: true, mode: isOwner ? (q.get('user') ? 'target' : 'all') : 'self', target: q.get('user') || null, entries: uniq.slice(0, 600) });
  }

  if (pathname === '/api/logout') {
    sessions.delete(session.token);
    saveSessions();
    return sendJson(res, 200, { ok: true });
  }

  if (pathname === '/api/session') {
    let creds = null;
    try {
      creds = JSON.parse(fs.readFileSync(path.join('Sessions', 'creds.json'), 'utf8'));
    } catch (e) {}
    if (!creds) return sendJson(res, 200, { found: false });
    return sendJson(res, 200, {
      found: true,
      registered: creds.registered === true,
      jid: creds.me?.id || null,
      lid: creds.me?.lid || null,
      registeredAlt: creds.me?.registered || null,
      noiseKey: Boolean(creds.noiseKey),
      platform: creds.platform || null
    });
  }

  if (pathname === '/api/stats') {
    const db = readDb();
    let fleet = null;
    try { fleet = SessionManager.fleetStats(); } catch (e) {}
    let commandStats = null;
    try { commandStats = CommandRegistry.stats(); } catch (e) {}
    /* Umrechnung auf das kompakte Schema, das Dashboard & Monitor erwarten */
    const fleetView = (f) => (f ? {
      managed: f.managed || 0, running: f.running || 0,
      online: (f.running || 0), total: f.managed || 0,
      paused: f.paused || 0, authRequired: f.authRequired || 0,
      stopped: f.stopped || 0, error: f.error || 0
    } : null);
    const sessList = (() => { try { return SessionManager.listSessions(); } catch (e) { return []; } })();
    const onlineCnt = sessList.filter((s) => s.status === 'CONNECTED').length;
    /* Laufzeit-Zähler: echte Nachrichten/Befehle der Sessions (Fallback auf Registry) */
    const msgSum = sessList.reduce((a, s) => a + (Number(s.messages) || 0), 0);
    const cmdSum = sessList.reduce((a, s) => a + (Number(s.commands) || 0), 0);
    const regCmds = commandStats && typeof commandStats.commands === 'number' ? commandStats.commands : 0;
    const messages = msgSum || 0;
    const commands = cmdSum || 0;
    const dbHealthy = true;
    return sendJson(res, 200, {
      users: Object.keys(db.users || {}).length,
      groups: Object.keys(db.groups || {}).length,
      bans: Object.keys(db.bans || {}).length,
      webusers: Object.keys(db.meta?.webusers || {}).length,
      owners: (db.meta?.owners || []).length,
      badwordsAdded: (db.meta?.badwords?.added || []).length,
      /* kompakte Zähler für Live-Monitor / Dashboard */
      sessionsTotal: sessList.length,
      sessionsOnline: onlineCnt,
      messages,
      commands,
      totalCommands: regCmds,
      errors: (fleet && (fleet.error || 0)) || 0,
      warnings: 0,
      dbHealthy,
      fleet: fleetView(fleet),
      heartbeat: readHeartbeat(),
      /* Uptime/RAM kommen aus dem Bot-Heartbeat (für Dashboard-Karten) */
      uptimeSec: readHeartbeat()?.uptimeSec || 0,
      ramMb: readHeartbeat()?.ramMb || 0,
      commandStats,
      loveplus: loveplusLiveSnapshot(),
      links: {
        website: 'https://maxichen.de',
        dashboard: 'https://maxichen.gamebot.me'
      }
    });
  }

  /* ---- OWNER-VERWALTUNG */
  if (pathname === '/api/owners' && req.method === 'GET') {
    const db = readDb();
    return sendJson(res, 200, { owners: db.meta?.owners || [] });
  }
  if (pathname === '/api/owners/add' && req.method === 'POST') {
    if (session.role !== 'owner') return sendJson(res, 403, { error: 'Nur der Owner darf Owner eintragen.' });
    const body = await readBody(req);
    const jid = String(body.jid || '').trim();
    const lid = String(body.lid || '').trim();
    const name = String(body.name || '').trim();
    if (!jid || !name) return sendJson(res, 400, { error: 'JID und Name sind Pflicht.' });
    const db = readDb();
    if (!db.meta) db.meta = {};
    if (!Array.isArray(db.meta.owners)) db.meta.owners = [];
    if (db.meta.owners.some((o) => o.jid === jid)) return sendJson(res, 400, { error: 'Schon eingetragen.' });
    db.meta.owners.push({ name, jid, lid, addedAt: new Date().toISOString(), addedBy: 'dashboard' });
    writeDb(db);
    return sendJson(res, 200, { ok: true });
  }
  if (pathname === '/api/owners/remove' && req.method === 'POST') {
    if (session.role !== 'owner') return sendJson(res, 403, { error: 'Nur der Owner darf Owner entfernen.' });
    const body = await readBody(req);
    const db = readDb();
    db.meta.owners = (db.meta?.owners || []).filter((o) => o.jid !== body.jid);
    writeDb(db);
    return sendJson(res, 200, { ok: true });
  }

  /* ---- BADWORDS */
  if (pathname === '/api/badwords' && req.method === 'GET') {
    const db = readDb();
    const bw = db.meta?.badwords || {};
    return sendJson(res, 200, { enabled: bw.enabled !== false, added: bw.added || [], removed: bw.removed || [] });
  }
  if (pathname === '/api/badwords/add' && req.method === 'POST') {
    if (session.role !== 'owner') return sendJson(res, 403, { error: 'Nur der Owner.' });
    const body = await readBody(req);
    const word = String(body.word || '').toLowerCase().trim();
    if (!word) return sendJson(res, 400, { error: 'Wort fehlt.' });
    const db = readDb();
    if (!db.meta) db.meta = {};
    if (!db.meta.badwords) db.meta.badwords = { enabled: true, added: [], removed: [] };
    if (!db.meta.badwords.added.includes(word)) db.meta.badwords.added.push(word);
    db.meta.badwords.removed = (db.meta.badwords.removed || []).filter((w) => w !== word);
    writeDb(db);
    return sendJson(res, 200, { ok: true });
  }
  if (pathname === '/api/badwords/remove' && req.method === 'POST') {
    if (session.role !== 'owner') return sendJson(res, 403, { error: 'Nur der Owner.' });
    const body = await readBody(req);
    const word = String(body.word || '').toLowerCase().trim();
    const db = readDb();
    if (db.meta?.badwords) {
      db.meta.badwords.added = (db.meta.badwords.added || []).filter((w) => w !== word);
      if (!db.meta.badwords.removed) db.meta.badwords.removed = [];
      if (!db.meta.badwords.removed.includes(word)) db.meta.badwords.removed.push(word);
    }
    writeDb(db);
    return sendJson(res, 200, { ok: true });
  }
  if (pathname === '/api/badwords/toggle' && req.method === 'POST') {
    if (session.role !== 'owner') return sendJson(res, 403, { error: 'Nur der Owner.' });
    const body = await readBody(req);
    const db = readDb();
    if (!db.meta) db.meta = {};
    if (!db.meta.badwords) db.meta.badwords = { enabled: true, added: [], removed: [] };
    db.meta.badwords.enabled = body.enabled === true;
    writeDb(db);
    return sendJson(res, 200, { ok: true });
  }

  /* ---- GRUPPEN & FEATURES */
  if (pathname === '/api/groups' && req.method === 'GET') {
    const db = readDb();
    const groups = Object.entries(db.groups || {})
      .filter(([k, g]) => g && typeof g === 'object' && (g.subject || g.active !== undefined))
      .map(([id, g]) => ({
        id,
        subject: g.subject || id,
        active: g.active !== false,
        autodl: g.autodl !== false,
        welcome: g.welcome !== false,
        goodbye: g.goodbye !== false,
        badwords: g.badwords !== false,
        antilink: g.antilink === true
      }));
    return sendJson(res, 200, { groups });
  }
  /* 🎛️ Gruppen-Feature umschalten (Owner, per Dashboard).
     - verlangt das Admin-Passwort (Step-up-Reauth),
     - protokolliert jede Änderung (Audit + admin-actions-Log),
     - schickt der Gruppe eine Benachrichtigung mit @Admin/@Owner-Mention,
       Feature, Status, Grund und dem Vermerk der Passwort-Authentifizierung. */
  if (pathname === '/api/groups/toggle' && req.method === 'POST') {
    if (roleOf(session) !== 'owner') return sendJson(res, 403, { error: 'Nur der Owner.' });
    const body = await readBody(req);
    const { gid, key, on } = body;
    const allowed = ['autodl', 'welcome', 'goodbye', 'badwords', 'antilink', 'active'];
    if (!gid || !allowed.includes(key)) return sendJson(res, 400, { error: 'Ungültig.' });
    if (!requireStepUp(req, res, session, body, 'groups.feature_toggle')) return;
    const reason = String(body.reason || '').trim().slice(0, 300);
    const db = readDb();
    if (!db.groups[gid]) db.groups[gid] = {};
    const before = db.groups[gid][key] === true;
    db.groups[gid][key] = on === true;
    writeDb(db);
    const actorLabel = session.username || maskNumber(session.number) || 'Owner';
    const FEATURE_LABELS = {
      autodl: '📥 Auto-Download', welcome: '👋 Welcome', goodbye: '🚪 Goodbye',
      badwords: '🤬 Badword-Filter', antilink: '🔗 Anti-Link', active: 'Gruppe aktiv'
    };
    const label = FEATURE_LABELS[key] || key;
    const groupSubject = db.groups[gid].subject || gid;
    const stateTxt = on === true ? 'AKTIVIERT' : 'DEAKTIVIERT';
    /* Log alles: Audit-Datei + Admin-Aktions-Log */
    audit(actorLabel, 'feature.' + key + '.' + (on ? 'on' : 'off'), gid + ' (' + groupSubject + ') — ' + (reason || 'kein Grund'), 'success');
    logAdminAction(actorLabel, 'feature.toggle', gid + ' | ' + groupSubject + ' | ' + key, {
      key, on: on === true, before, reason: reason || '', group: groupSubject
    });
    /* Gruppe benachrichtigen (verarbeitet der aktive Bot, erwähnt Admins) */
    const noticeText =
      '🎛️ *FEATURE-ÄNDERUNG — DASHBOARD* 🎛️\n\n' +
      '👥 *Gruppe:* ' + groupSubject + '\n' +
      '⚙️ *Feature:* ' + label + ' (' + key + ')\n' +
      '✅ *Status:* ' + stateTxt + '\n' +
      '👤 *Von:* @Owner/' + actorLabel + ' (Dashboard)\n' +
      (reason ? '📝 *Grund:* ' + reason + '\n' : '') +
      '\n🔐 Diese Änderung wurde über das Dashboard per *Admin-Passwort* authentifiziert.\n' +
      '— LoveBot ☾';
    notifyGroup({ gid, text: noticeText, mentionAdmins: true, feature: key, on: on === true, actor: actorLabel });
    return sendJson(res, 200, { ok: true, before, after: on === true, key, label, group: groupSubject });
  }

  /* ---- BANS */
  if (pathname === '/api/bans' && req.method === 'GET') {
    const db = readDb();
    const bans = Object.entries(db.bans || {}).map(([key, b]) => ({ key, ...b }));
    return sendJson(res, 200, { bans });
  }
  if (pathname === '/api/bans/ban' && req.method === 'POST') {
    if (!perm(session, 'users.ban')) return sendJson(res, 403, { error: 'Keine Berechtigung (users.ban).' });
    const body = await readBody(req);
    const rawTarget = String(body.jid || body.number || '').trim();
    const targetNumber = cleanNumber(rawTarget);
    const targetJid = rawTarget.endsWith('@lid') ? '' : (targetNumber ? `${targetNumber}@s.whatsapp.net` : '');
    const targetLid = rawTarget.endsWith('@lid') ? rawTarget : String(body.lid || '').trim();
    if (!targetJid && !targetLid) return sendJson(res, 400, { error: 'JID, LID oder Nummer fehlt.' });
    const reason = String(body.reason || '').trim().slice(0, 500) || 'Kein Grund angegeben';
    const db = readDb();
    const key = targetLid.replace(/@lid$/, '') || targetNumber;
    db.bans = db.bans || {};
    const bannedAt = new Date().toISOString();
    db.bans[key] = {
      jid: targetJid,
      lid: targetLid,
      reason,
      bannedAt,
      bannedBy: cleanNumber(session.number) ? `${cleanNumber(session.number)}@s.whatsapp.net` : '',
      bannedByName: session.username || session.name || 'Dashboard',
      bannedByRole: roleOf(session)
    };
    writeDb(db);
    if (targetNumber) rbac.lockByBan(targetNumber, reason);
    const ownerAlertId = queueOwnerSecurityAlert('USER_BANNED', {
      target: targetJid || targetLid || targetNumber, targetNumber, targetJid, targetLid,
      reason, bannedAt, bannedBy: session.username || session.name || 'Dashboard',
      bannedByRole: roleOf(session), source: 'web-dashboard', requestIp: clientIp, userAgent
    });
    const mailboxId = queueModerationNotice('ban', { jid: targetJid, lid: targetLid, number: targetNumber }, reason, session);
    audit(session.username || maskNumber(session.number), 'user.banned', targetJid || targetLid, 'success');
    return sendJson(res, 200, { ok: true, mailboxId, ownerAlertId: ownerAlertId || null });
  }
  if (pathname === '/api/bans/unban' && req.method === 'POST') {
    if (!perm(session, 'users.ban')) return sendJson(res, 403, { error: 'Keine Berechtigung (users.ban).' });
    const body = await readBody(req);
    { const _u = rbac.unlockByUnban(String(body.number || '')); if (_u) audit(session.username || maskNumber(session.number), 'account.unlock', _u.username, 'success'); }
    const db = readDb();
    if (db.bans && db.bans[body.key]) {
      const removed = db.bans[body.key];
      delete db.bans[body.key];
      writeDb(db);
      const number = cleanNumber(removed.jid || removed.number || '');
      const reason = String(body.reason || removed.reason || 'Ban aufgehoben').trim().slice(0, 500);
      if (number) rbac.unlockByUnban(number);
      const mailboxId = queueModerationNotice('unban', removed, reason, session);
      audit(session.username || maskNumber(session.number), 'user.unbanned', removed.jid || removed.lid || body.key, 'success');
      return sendJson(res, 200, { ok: true, mailboxId });
    }
    return sendJson(res, 404, { error: 'Ban nicht gefunden.' });
  }

  /* ---- PROFILE */
  if (pathname === '/api/profiles' && req.method === 'GET') {
    const q = new URL('http://x' + req.url).searchParams.get('search') || '';
    const db = readDb();
    const results = [];
    for (const [bid, p] of Object.entries(db.users || {})) {
      if (results.length >= 20) break;
      if (!p || typeof p !== 'object') continue;
      if (q && !bid.includes(q) && !String(p.registration?.name || '').toLowerCase().includes(q.toLowerCase())) continue;
      /* 🔒 Datenschutz: keine exakten Alter von Minderjährigen, Stadt maskiert,
         öffentliche Profile nur mit Opt-in (siehe privacy.js) */
      const reg = migrateRegistration(p.registration || {});
      results.push({
        bid,
        name: reg.name || p.identity?.username || '—',
        registered: reg.registered === true,
        level: p.progression?.level || 0,
        married: p.love?.married === true,
        spouse: p.love?.spouseName || null,
        wallet: p.wallet || {},
        age: isMinor(reg) ? null : (reg.age ?? null),
        ageBracket: reg.ageBracket || 'unknown',
        minor: isMinor(reg),
        city: cityLabel(reg, { privateChat: false }),
        publicProfile: publicProfileAllowed(reg)
      });
    }
    return sendJson(res, 200, { profiles: results });
  }

  /* ---- BROADCAST */
  if (pathname === '/api/broadcast' && req.method === 'POST') {
    if (!perm(session, 'broadcast.send')) return sendJson(res, 403, { error: 'Keine Berechtigung (broadcast.send).' });
    const body = await readBody(req);
    const text = String(body.text || '').trim();
    if (!text) return sendJson(res, 400, { error: 'Text fehlt.' });
    const id = newToken();
    queueMailbox({
      id,
      type: 'broadcast',
      status: 'pending',
      createdAt: new Date().toISOString(),
      text: `> 📢 *LOVE BOT — BROADCAST* 📢\n┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈\n${text}\n┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈\n_Über das LoveBot-Dashboard_ 🌹`
    });
    return sendJson(res, 200, { ok: true, mailboxId: id });
  }

  /* ---- LOGS */
  if (pathname === '/api/logs' && req.method === 'GET') {
    try {
      const raw = fs.readFileSync(LOG_PATH, 'utf8');
      const lines = raw.split('\n').filter(Boolean).slice(-120).map((line) => {
        const match = line.match(/^\[([^\]]+)\]\s+\[([^\]]+)\]\s*(.*)$/);
        return match
          ? { time: match[1], tag: match[2].toLowerCase(), text: match[3] }
          : { time: '', tag: 'info', text: line };
      });
      return sendJson(res, 200, { lines });
    } catch (e) {
      return sendJson(res, 200, { lines: [] });
    }
  }

  /* ---- 🌐 NIGHT-DASHBOARD: zusätzliche Read-Endpoints -------------------- */
  if (pathname === '/api/sessions' && req.method === 'GET') {
    let hb = null;
    try { hb = JSON.parse(fs.readFileSync(HEARTBEAT_PATH, 'utf8')); } catch (e) {}
    const online = !!(hb && hb.online && Date.now() - new Date(hb.time).getTime() < 40000);
    let creds = false;
    try { creds = fs.existsSync(path.join('Sessions', 'creds.json')); } catch (e) {}
    const sess = [{
      name: 'MainBot',
      status: online ? 'ONLINE' : (creds ? 'OFFLINE' : 'OFFLINE'),
      phone: hb?.jid ? maskNumber(hb.jid.split('@')[0]) : '—',
      jid: hb?.jid ? maskNumber(hb.jid.split('@')[0]) + '@s.whatsapp.net' : '—',
      uptime: online ? (hb.uptimeSec || 0) * 1000 : 0,
      messages: 0, commands: 0, groups: 0,
      memMb: hb?.ramMb || 0,
      health: online ? 100 : 0,
      last: online ? 'live' : (hb?.time ? new Date(hb.time).toLocaleString('de-DE') : '—')
    }];
    return sendJson(res, 200, { ok: true, sessions: sess });
  }

  if (pathname === '/api/users' && req.method === 'GET') {
    const db = readDb();
    const users = Object.values(db.users || {})
      .filter((u) => u && u.identity && u.identity.jid)
      .slice(0, 200)
      .map((u) => ({
        name: u.identity.username || maskNumber(u.identity.cleanJid || u.identity.jid),
        phone: maskNumber(u.identity.cleanJid || ''),
        level: u.progression?.level || 0,
        xp: u.progression?.xp || 0,
        prestige: u.progression?.prestige || 0,
        streak: u.progression?.streak || 0,
        role: db.meta?.webusers?.[u.identity.cleanJid]?.role || (u.identity.cleanJid === OWNER_NUMBER ? 'owner' : 'user'),
        msgs: u.stats?.messages || 0,
        warns: 0,
        banned: !!db.bans?.[u.identity.cleanJid],
        title: u.identity.title || ''
      }));
    return sendJson(res, 200, { ok: true, users });
  }

  if (pathname === '/api/love' && req.method === 'GET') {
    const db = readDb();
    const leaderboard = Object.values(db.users || {})
      .filter((u) => u && u.progression)
      .sort((a, b) =>
        (b.progression.prestige || 0) - (a.progression.prestige || 0) ||
        (b.progression.level || 0) - (a.progression.level || 0) ||
        (b.progression.xp || 0) - (a.progression.xp || 0))
      .slice(0, 10)
      .map((u) => ({ name: u.identity?.username || maskNumber(u.identity?.cleanJid || ''), level: u.progression.level || 0, prestige: u.progression.prestige || 0, xp: u.progression.xp || 0, title: u.identity?.title || '' }));
    return sendJson(res, 200, {
      ok: true,
      levels: [
        { lv: 0, title: 'Neuling', icon: '🐣' }, { lv: 5, title: 'Einsteiger', icon: '🌱' },
        { lv: 10, title: 'Herzling', icon: '🌸' }, { lv: 25, title: 'Flirter', icon: '🌷' },
        { lv: 50, title: 'Romantiker', icon: '💕' }, { lv: 100, title: 'Rose des Herzens', icon: '🌹' },
        { lv: 200, title: 'Flammenherz', icon: '🔥' }, { lv: 500, title: 'Herzfürst(in)', icon: '👑' },
        { lv: 743, title: 'Mythisch', icon: '💖' }
      ],
      achievements: [
        { id: 'firstlove', icon: '💌', name: 'First Love', desc: 'Erste Liebesnachricht gesendet' },
        { id: 'crush', icon: '💘', name: 'First Crush', desc: 'Ersten Crush geconfesst' },
        { id: 'msg100', icon: '💗', name: '100 Messages', desc: '100 Nachrichten geschrieben' },
        { id: 'streak7', icon: '❤️', name: '7 Day Streak', desc: '7 Tage am Stück aktiv' },
        { id: 'soulmate', icon: '💍', name: 'Soulmate', desc: 'Love Level 30 erreicht' },
        { id: 'romantic', icon: '🌹', name: 'Romantic', desc: '10 romantische Commands genutzt' },
        { id: 'legend', icon: '👑', name: 'Love Legend', desc: 'Love Level 100 erreicht' }
      ],
      leaderboard
    });
  }

  if (pathname === '/api/database' && req.method === 'GET') {
    const db = readDb();
    let sizeKb = 0, backups = 0;
    try { sizeKb = Math.round(fs.statSync(DB_PATH).size / 1024); } catch (e) {}
    try { backups = fs.readdirSync('Database').filter((f) => f.startsWith('backup-')).length; } catch (e) {}
    return sendJson(res, 200, {
      ok: true,
      users: Object.keys(db.users || {}).length,
      groups: Object.keys(db.groups || {}).length,
      sizeKb, backups,
      records: Object.keys(db.users || {}).length + Object.keys(db.groups || {}).length,
      healthy: true
    });
  }

  /* 💾 Backups auflisten (nur Datei-Metadaten, keine Inhalte). */
  if (pathname === '/api/database/backups' && req.method === 'GET') {
    if (!perm(session, 'db.view')) return sendJson(res, 403, { error: 'Keine Berechtigung (db.view).' });
    let files = [];
    try {
      files = fs.readdirSync('Database').filter((f) => f.startsWith('backup-') && f.endsWith('.json'))
        .map((f) => {
          try { const st = fs.statSync(path.join('Database', f)); return { name: f, sizeKb: Math.round(st.size / 1024), mtime: st.mtime.toISOString() }; } catch (e) { return null; }
        }).filter(Boolean).sort((a, b) => (a.name < b.name ? 1 : -1));
    } catch (e) {}
    return sendJson(res, 200, { ok: true, backups: files });
  }

  /* ➕ Neues Datenbank-Backup erstellen (Kopie von Database/Database.json). */
  if (pathname === '/api/database/backup' && req.method === 'POST') {
    if (!perm(session, 'db.backup')) return sendJson(res, 403, { error: 'Keine Berechtigung (db.backup).' });
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const name = 'backup-' + ts + '.json';
    try {
      fs.copyFileSync(DB_PATH, path.join('Database', name));
    } catch (e) { return sendJson(res, 500, { error: 'Backup fehlgeschlagen: ' + String(e.message || e) }); }
    audit(session.username || maskNumber(session.number), 'db.backup_created', name, 'success');
    return sendJson(res, 200, { ok: true, name });
  }

  if (pathname === '/api/system' && req.method === 'GET') {
    /* REAL DATA ONLY: CPU per Sampling (Windows-fähig); Disk ehrlich null. */
    let sys = null;
    try { sys = await collectSystem(); } catch (e2) {}
    return sendJson(res, 200, {
      ok: true,
      node: sys?.node ?? null, platform: sys?.platform ?? null, arch: sys?.arch ?? null,
      uptimeSec: sys?.uptimeSec ?? null,
      ramMb: sys?.ramMb ?? null,
      ramTotalMb: sys?.ramTotalMb ?? null,
      heapMb: sys?.heapMb ?? null,
      cpu: sys?.cpu ?? null,
      diskPct: null,
      sessions: sessions.size
    });
  }

  if (pathname === '/api/security' && req.method === 'GET') {
    if (!perm(session, 'security.view')) return sendJson(res, 403, { error: 'Keine Berechtigung (security.view).' });
    let events = [];
    try {
      events = fs.readFileSync(SECURITY_FILE, 'utf8').trim().split('\n').filter(Boolean)
        .slice(-50).reverse().map((l) => {
          const e = JSON.parse(l);
          return {
            time: new Date(e.time).toLocaleTimeString('de-DE'),
            sev: e.risk >= 70 ? 'CRITICAL' : e.risk >= 40 ? 'SUSPICIOUS' : e.risk >= 20 ? 'WATCH' : 'RESOLVED',
            event: e.event, src: e.src === 'bot' ? 'bot' : 'web', risk: e.risk || 0,
            action: e.action || 'logged', ip: e.ip || ''
          };
        });
    } catch (e) {}
    const failed = events.filter((x) => /AUTH_FAILURE|2FA_MISSING/.test(x.event)).length;
    /* 🛡️ Echte, live berechnete IP-Schutz-Daten (statt Platzhalter) —
       nur für eingeloggte Nutzer mit security.view sichtbar, IPs werden
       maskiert ausgeliefert (letztes Oktett/Segment verdeckt). */
    const activeBlocks = listBlockedIps();
    /* Volle (unmaskierte) IP nur für Rollen mit security.manage sichtbar
       (owner/deputy) — für alle anderen Rollen mit security.view bleibt
       sie maskiert. So kann der Owner gesperrte IPs gezielt entsperren,
       ohne dass jede Rolle mit bloßem Security-Lesezugriff volle
       Adressen sieht. */
    const canManage = perm(session, 'security.manage');
    const manualBans = listManualBans();
    const deviceSnapshots = latestDeviceSnapshots();
    return sendJson(res, 200, {
      ok: true, events,
      threat: (activeBlocks.length || manualBans.length) ? 'HIGH' : events.some((x) => x.risk >= 70) ? 'HIGH' : events.some((x) => x.risk >= 40) ? 'WATCH' : 'LOW',
      alerts: events.filter((x) => x.risk >= 40).length,
      blocked: activeBlocks.length,
      blockedTotal: totalIpBlocksEver,
      blockedIps: activeBlocks.map((b) => ({ ip: canManage ? b.ipFull : b.ip, reason: b.reason, blockedAt: b.blockedAt, fails: b.fails, remainingSec: b.remainingSec, deviceInfo: canManage ? (deviceSnapshots[b.ipFull] || null) : null })),
      manualBans: manualBans.map((b) => ({ ip: canManage ? b.ipFull : b.ip, reason: b.reason, bannedAt: b.bannedAt, bannedBy: b.bannedBy, deviceInfo: canManage ? (deviceSnapshots[b.ipFull] || null) : null })),
      manualBansTotal: manualBans.length,
      knownClients: canManage ? listKnownClients().slice(0, 100).map((c) => ({
        ip: c.ipFull, browser: c.browser, os: c.os, device: c.device, isBot: c.isBot,
        firstSeen: c.firstSeen, lastSeen: c.lastSeen, hits: c.hits, lastPath: c.lastPath,
        numbers: c.numbers, banned: isManuallyBanned(c.ipFull), autoBlocked: !!isIpBlocked(c.ipFull),
        deviceInfo: deviceSnapshots[c.ipFull] || null
      })) : [],
      failedLogins: failed
    });
  }

  /* 📊 Owner-Sicherheitsübersicht: 24h-Kennzahlen für ein kompaktes Widget. */
  if (pathname === '/api/security/overview' && req.method === 'GET') {
    if (!perm(session, 'security.view')) return sendJson(res, 403, { error: 'Keine Berechtigung (security.view).' });
    return sendJson(res, 200, { ok: true, ...SecurityCases.overview24h(AUDIT_FILE) });
  }

  /* 📊 Live-Schutz-Zähler fürs Security Center („Rate Limits“-Panel): zeigt
     die AKTUELLEN in-memory-Zustände der Schutzsysteme (Brute-Force per
     Nummer, IP-Fehlversuche, Globales Rate-Limit, aktive Auto-Blocks,
     manuelle Bans). Nur Rollen mit security.manage sehen die Zahlen. */
  if (pathname === '/api/security/rate-limits' && req.method === 'GET') {
    if (!perm(session, 'security.manage')) return sendJson(res, 403, { error: 'Keine Berechtigung (security.manage).' });
    const now = Date.now();
    const rlActive = [...rateLimits.entries()].filter(([, v]) => v.resetAt > now);
    const grlActive = [...globalRateLimits.entries()].filter(([, v]) => v.resetAt > now);
    const ipFailActive = [...ipFailures.entries()].filter(([, v]) => now - (v.windowStart || now) < IP_FAIL_WINDOW_MS);
    const blocks = listBlockedIps();
    const bans = listManualBans();
    return sendJson(res, 200, {
      ok: true,
      counts: {
        numberRateLimited: rlActive.length,
        globalRateLimited: grlActive.length,
        ipFailureWindows: ipFailActive.length,
        activeAutoBlocks: blocks.length,
        manualBans: bans.length,
        knownClients: knownClients.size,
        abuseBursts: abuseBursts.size,
        abuseViolations: abuseViolations.size
      },
      config: {
        numberWindowSec: 600, numberMaxAttempts: 3,
        ipFailWindowSec: Math.round(IP_FAIL_WINDOW_MS / 1000),
        ipBlockThresholds: IP_BLOCK_THRESHOLDS,
        globalWindowSec: Math.round(GLOBAL_RL_WINDOW_MS / 1000),
        globalMaxPerWindow: GLOBAL_RL_MAX,
        permanentBanViaWeb: true
      }
    });
  }

  /* 🗂️ Security Cases: gebündelte, zusammenhängende Sicherheitsereignisse
     als EIN Vorgang mit Status (offen/gelöst) statt vieler Einzelzeilen. */
  if (pathname === '/api/security/cases' && req.method === 'GET') {
    if (!perm(session, 'security.view')) return sendJson(res, 403, { error: 'Keine Berechtigung (security.view).' });
    const canManage = perm(session, 'security.manage');
    const status = new URL('http://x' + req.url).searchParams.get('status') || undefined;
    const cases = SecurityCases.listCases({ status });
    return sendJson(res, 200, { ok: true, cases: cases.map((c) => ({ ...c, ip: canManage ? c.ip : maskIp(c.ip) })) });
  }
  if (pathname === '/api/security/cases/resolve' && req.method === 'POST') {
    if (!perm(session, 'security.manage')) return sendJson(res, 403, { error: 'Keine Berechtigung (security.manage).' });
    const body = await readBody(req);
    if (!body.note || !String(body.note).trim()) return sendJson(res, 400, { error: 'Bitte gib eine Notiz/Begründung an.' });
    const r = SecurityCases.resolveCase(String(body.id || ''), session.username || session.number, body.note);
    if (r.error) return sendJson(res, 404, { error: 'Fall nicht gefunden.' });
    audit(session.username || maskNumber(session.number), 'security.case_resolved', String(body.id) + ' — ' + String(body.note).slice(0, 200), 'success');
    return sendJson(res, 200, { ok: true });
  }
  if (pathname === '/api/security/cases/reopen' && req.method === 'POST') {
    if (!perm(session, 'security.manage')) return sendJson(res, 403, { error: 'Keine Berechtigung (security.manage).' });
    const body = await readBody(req);
    const r = SecurityCases.reopenCase(String(body.id || ''), session.username || session.number, body.reason);
    if (r.error) return sendJson(res, 404, { error: 'Fall nicht gefunden.' });
    audit(session.username || maskNumber(session.number), 'security.case_reopened', String(body.id), 'success');
    return sendJson(res, 200, { ok: true });
  }

  /* 🛡️ Owner/Deputy: eine gesperrte IP manuell wieder freigeben
     (z. B. wenn sich jemand nur vertippt hat). Erwartet die volle IP,
     wie sie /api/security für Rollen mit security.manage mitliefert. */
  if (pathname === '/api/security/unblock' && req.method === 'POST') {
    if (!perm(session, 'security.manage')) return sendJson(res, 403, { error: 'Keine Berechtigung (security.manage).' });
    const body = await readBody(req);
    const targetIp = String(body.ip || '').trim();
    if (!targetIp) return sendJson(res, 400, { error: 'IP fehlt.' });
    const existed = unblockIp(targetIp);
    audit(session.username || session.number, 'security.ip_unblocked', maskIp(targetIp), existed ? 'success' : 'noop');
    return sendJson(res, 200, { ok: true, unblocked: existed });
  }

  /* 🚫 Owner/Deputy: eine IP DAUERHAFT sperren (Fritzbox-Stil) — läuft
     nicht automatisch ab, übersteht Neustarts, betrifft die ganze API. */
  /* ⚙️ Konfigurierbare Schutzregeln (WEB-REQ-07) — Lese-Zugang: security.view */
  if (pathname === '/api/security/rules' && req.method === 'GET') {
    if (!perm(session, 'security.view')) return sendJson(res, 403, { error: 'Keine Berechtigung (security.view).' });
    return sendJson(res, 200, { ok: true, version: SEC_RULES.version, updatedAt: SEC_RULES.updatedAt, updatedBy: SEC_RULES.updatedBy, webReqFlood: SEC_RULES.webReqFlood, activeCounts: { bursts: abuseBursts.size, violations: abuseViolations.size }, history: SEC_RULES.history.slice(-5).reverse() });
  }

  /* ⚙️ Regeln ändern (kritisch): security.manage + Step-up-Reauth + Audit */
  if (pathname === '/api/security/rules' && req.method === 'POST') {
    if (!perm(session, 'security.manage')) return sendJson(res, 403, { error: 'Keine Berechtigung (security.manage).' });
    const body = await readBody(req);
    /* 🔐 Sicherheitsregeln ändern = kritisch → Step-up-Reauth + Audit */
    if (!requireStepUp(req, res, session, body, 'security.rules.changed')) return;
    const actor = session.username || session.number;
    const reason = String(body.reason || 'Regel angepasst').trim().slice(0, 200);
    const next = normalizeAbuseRules(body.webReqFlood || body);
    const saved = saveSecurityRules(actor, reason);
    securityEvent('SECURITY_RULES_CHANGED', { actor, risk: 55, reason: reason, newVersion: saved.version, rule: next.id, threshold: next.threshold, windowSec: next.windowSec, enabled: next.enabled });
    return sendJson(res, 200, { ok: true, version: saved.version, webReqFlood: saved.webReqFlood });
  }

  if (pathname === '/api/security/ban-ip' && req.method === 'POST') {
    if (!perm(session, 'security.manage')) return sendJson(res, 403, { error: 'Keine Berechtigung (security.manage).' });
    const body = await readBody(req);
    const targetIp = String(body.ip || '').trim();
    const reason = String(body.reason || '').trim().slice(0, 200) || 'Vom Owner gesperrt';
    const isPermanent = body.duration === 'permanent' || body.duration === undefined;
    if (!targetIp) return sendJson(res, 400, { error: 'IP fehlt.' });
    if (targetIp === clientIp) return sendJson(res, 400, { error: 'Du kannst deine eigene aktuelle IP nicht sperren (Aussperr-Schutz).' });
    /* 🔐 Permanente IP-Sperren sind kritisch (im Gegensatz zu temporären
       Auto-Blocks) — verlangen Step-up-Reauth. */
    if (isPermanent && !requireStepUp(req, res, session, body, 'ip.ban.permanent')) return;
    if (isPermanent) {
      manualBanIp(targetIp, reason, session.username || session.number);
    } else {
      const mins = Math.max(1, Math.min(1440, Number(body.durationMinutes) || 60));
      const tempBanDetails = { ip: targetIp, reason, blockMinutes: mins, bannedAt: new Date().toISOString(), bannedBy: session.username || session.number, permanent: false, source: 'web-dashboard' };
      blockedIps.set(targetIp, { until: Date.now() + mins * 60000, reason: reason + ' (temporär, ' + mins + ' Min., von ' + (session.username || session.number) + ')', blockedAt: tempBanDetails.bannedAt, fails: 0, tier: 'MANUAL_TEMP' });
      totalIpBlocksEver++;
      securityEvent('IP_MANUALLY_BANNED_TEMP', { ...tempBanDetails, risk: 65 });
      queueOwnerSecurityAlert('IP_MANUALLY_BANNED_TEMP', { ...tempBanDetails, requestIp: clientIp, userAgent });
    }
    /* Optional: alle aktiven Sessions dieser IP sofort beenden. */
    let killedSessions = 0;
    if (body.killSessions === true) {
      for (const [tok, sv] of [...sessions]) {
        if (sv.lastIp === targetIp || sv.ip === targetIp) { sessions.delete(tok); killedSessions++; }
      }
      if (killedSessions) saveSessions();
    }
    audit(session.username || session.number, 'security.ip_banned', maskIp(targetIp) + (isPermanent ? ' (dauerhaft)' : ' (temporär)') + (killedSessions ? ' · ' + killedSessions + ' Sessions beendet' : ''), 'success');
    return sendJson(res, 200, { ok: true, banned: true, permanent: isPermanent, killedSessions });
  }

  /* ✅ Owner/Deputy: eine dauerhafte Sperre wieder aufheben. */
  if (pathname === '/api/security/unban-ip' && req.method === 'POST') {
    if (!perm(session, 'security.manage')) return sendJson(res, 403, { error: 'Keine Berechtigung (security.manage).' });
    const body = await readBody(req);
    const targetIp = String(body.ip || '').trim();
    if (!targetIp) return sendJson(res, 400, { error: 'IP fehlt.' });
    const existed = manualUnbanIp(targetIp);
    audit(session.username || session.number, 'security.ip_unbanned', maskIp(targetIp), existed ? 'success' : 'noop');
    return sendJson(res, 200, { ok: true, unbanned: existed });
  }

  /* 📒 Rohes Zugriffsprotokoll (letzte N Einträge) — jede Anfrage an die
     Website, mit Gerät/Browser/IP/Zeit/Pfad. Nur volle IP für security.manage. */
  if (pathname === '/api/security/access-log' && req.method === 'GET') {
    if (!perm(session, 'security.view')) return sendJson(res, 403, { error: 'Keine Berechtigung (security.view).' });
    const canManage = perm(session, 'security.manage');
    let lines = [];
    try {
      lines = fs.readFileSync(ACCESS_LOG_FILE, 'utf8').trim().split('\n').filter(Boolean).slice(-200).reverse()
        .map((l) => {
          try {
            const e = JSON.parse(l);
            return { time: e.time, ip: canManage ? e.ipFull : e.ip, method: e.method, path: e.path, browser: e.browser, os: e.os, device: e.device, isBot: e.isBot };
          } catch (err) { return null; }
        }).filter(Boolean);
    } catch (e) {}
    return sendJson(res, 200, { ok: true, entries: lines });
  }

  if (pathname === '/api/audit' && req.method === 'GET') {
    if (!perm(session, 'logs.view')) return sendJson(res, 403, { error: 'Keine Berechtigung (logs.view).' });
    let entries = [];
    try {
      entries = fs.readFileSync(AUDIT_FILE, 'utf8').trim().split('\n').filter(Boolean)
        .slice(-80).reverse().map((l) => {
          const e = JSON.parse(l);
          return { time: new Date(e.time).toLocaleTimeString('de-DE'), actor: e.actor, action: e.action, target: e.target, result: e.result };
        });
    } catch (e) {}
    return sendJson(res, 200, { ok: true, entries });
  }

  /* ---- 👾 SESSION-LIVE-STEUERUNG (echt, über SessionManager) --------------
     create / delete / restart / qr wirken direkt auf die Session-Registry und
     auf echte Kind-Prozesse (spawn) — NICHT nur auf die Webmail-Queue. */

  /* ✚ Neue Session anlegen. Ist Multi-Session (spawn) auf dem Host aktiv,
     wird sofort ein echter Kind-Prozess gestartet, der sich per QR oder
     Pairing-Code anmeldet — sonst entsteht ein "wartend"-Eintrag. */
  if (pathname === '/api/session/create' && req.method === 'POST') {
    if (roleOf(session) !== 'owner') return sendJson(res, 403, { error: 'Nur der Owner darf Sessions anlegen.' });
    const body = await readBody(req);
    const name = String(body.name || '').trim().slice(0, 32) || 'Session';
    const mode = String(body.mode || 'qr');
    const actorLabel = session.username || maskNumber(session.number) || 'web';
    const spawnEnabled = SessionManager.spawnConfigured();
    let created;
    try {
      created = SessionManager.createSession(name, {
        source: 'web',
        actor: actorLabel,
        spawn: true,
        authMode: mode === 'pair' ? 'pairing' : 'qr',
        phone: body.phone
      });
    } catch (cErr) {
      return sendJson(res, 400, { error: String(cErr?.message || cErr) });
    }
    audit(actorLabel, 'session.create', created.id, spawnEnabled && created.spawned ? 'spawned' : 'registered');
    logAdminAction(actorLabel, 'session.create', created.id, { name: created.name, mode, spawned: !!created.spawned, spawnEnabled });
    /* 📣 Benachrichtigungen (verarbeitet der aktive Bot): Owner privat +
       Ankündigung in allen Gruppen des aktiven Bots. */
    const createdOwnerText =
      '🔗 *NEUE BOT-SESSION* 🔗\n\n' +
      '• Session: *' + created.name + '* (' + created.id + ')\n' +
      '• Angelegt von: ' + actorLabel + ' (Dashboard)\n' +
      '• Methode: ' + (mode === 'pair' ? 'Pairing-Code' : 'QR-Code') + '\n' +
      '• Status: ' + (spawnEnabled && created.spawned ? '▶️ gestartet' : '⏳ wartend (spawn aus)') + '\n\n' +
      '— LoveBot ☾ Dashboard';
    notifyOwner({ text: createdOwnerText });
    const createdGroupText =
      '🔗 *NEUE SESSION ANGEMELDET* 🔗\n\n' +
      'Bot „' + created.name + '“ wurde über das Dashboard angelegt.\n' +
      'Weitere Infos bekommt der Owner direkt.\n— LoveBot ☾';
    queueMailbox({ id: newToken(), type: 'broadcast', status: 'pending', createdAt: new Date().toISOString(), text: createdGroupText, mentions: [] });
    return sendJson(res, 200, {
      ok: true,
      session: { id: created.id, name: created.name },
      spawned: !!created.spawned,
      spawnEnabled,
      mode
    });
  }

  /* 📷 QR/Pairing-Code einer Session abrufen (nur eingeloggt!). Enthält die
     aktuellen Auth-Daten aus dem Session-Manager; QR als <pre>-Block-ASCII. */
  if (pathname === '/api/session/qr' && req.method === 'GET') {
    if (roleOf(session) !== 'owner') return sendJson(res, 403, { error: 'Nur der Owner darf QR-Codes abrufen.' });
    const q = new URL('http://x' + req.url).searchParams;
    const id = String(q.get('id') || 'main');
    const raw = SessionManager.getSessionRaw(id);
    if (!raw) return sendJson(res, 404, { error: 'Session nicht gefunden.' });
    const freshQr = raw.qr && raw.qrAt && (Date.now() - raw.qrAt) < 180000 ? raw.qr : null;
    const freshCode = raw.pairCode && raw.pairAt && (Date.now() - raw.pairAt) < 300000 ? raw.pairCode : null;
    const qrText = freshQr ? await qrToBlocks(freshQr) : null;
    return sendJson(res, 200, {
      ok: true,
      id,
      status: raw.status,
      hasQr: !!freshQr,
      qr: qrText,
      pairCode: freshCode || null,
      note: !freshQr && raw.status === 'CONNECTED' ? 'verbunden' : 'noch kein QR — läuft an…'
    });
  }

  /* 🗑 Session endgültig löschen (Zeile weg). Haupt-Session ist geschützt. */
  if (pathname === '/api/session/delete' && req.method === 'POST') {
    if (roleOf(session) !== 'owner') return sendJson(res, 403, { error: 'Nur der Owner darf Sessions löschen.' });
    const body = await readBody(req);
    const id = String(body.id || body.name || '').trim();
    if (!id) return sendJson(res, 400, { error: 'id fehlt.' });
    const raw = SessionManager.getSessionRaw(id);
    if (!raw) return sendJson(res, 404, { error: 'Session nicht gefunden.' });
    const actorLabel = session.username || maskNumber(session.number) || 'web';
    if (raw.source === 'spawned' && raw.pid) SessionManager.stopSpawned(id);
    const r = SessionManager.deleteSession(id, { actor: actorLabel });
    if (!r.ok) {
      if (r.reason === 'main_protected') return sendJson(res, 400, { error: 'MainBot ist die aktive Haupt-Session und kann hier nicht gelöscht werden.' });
      return sendJson(res, 400, { error: 'Konnte Session nicht löschen (' + r.reason + ').' });
    }
    audit(actorLabel, 'session.delete', id, 'success');
    logAdminAction(actorLabel, 'session.delete', id, { name: raw.name || id });
    const delOwnerText =
      '🗑️ *SESSION GELÖSCHT* 🗑️\n\n' +
      '• Session: *' + (raw.name || id) + '* (' + id + ')\n' +
      '• Gelöscht von: ' + actorLabel + ' (Dashboard)\n' +
      '• Zeit: ' + new Date().toLocaleString('de-DE') + '\n\n' +
      'Das verknüpfte WhatsApp-Konto bleibt unberührt.\n— LoveBot ☾ Dashboard';
    notifyOwner({ text: delOwnerText });
    const delGroupText =
      '🗑️ *SESSION ENTFERNT* 🗑️\n\n' +
      'Bot „' + (raw.name || id) + '“ wurde über das Dashboard aus der Session-Verwaltung entfernt.\n— LoveBot ☾';
    queueMailbox({ id: newToken(), type: 'broadcast', status: 'pending', createdAt: new Date().toISOString(), text: delGroupText, mentions: [] });
    return sendJson(res, 200, { ok: true, removed: id });
  }

  /* ↻ Session neu starten: läuft sie als Kind-Prozess (spawn), wird sie
     gestoppt und neu gestartet; sonst nur, wenn spawn auf dem Host an ist.
     Der manuell betriebene Haupt-Bot muss auf dem Server neu gestartet werden. */
  if (pathname === '/api/session/restart' && req.method === 'POST') {
    if (roleOf(session) !== 'owner') return sendJson(res, 403, { error: 'Nur der Owner darf Sessions neu starten.' });
    const body = await readBody(req);
    const id = String(body.id || body.name || '').trim();
    if (!id) return sendJson(res, 400, { error: 'id fehlt.' });
    const raw = SessionManager.getSessionRaw(id);
    if (!raw) return sendJson(res, 404, { error: 'Session nicht gefunden.' });
    if (id === 'main') {
      return sendJson(res, 200, { ok: false, main: true, error: 'MainBot läuft als eigener Prozess auf dem Server — dort manuell neu starten (QR erscheint hier, sobald er ohne gültige Session hochkommt).' });
    }
    if (!SessionManager.spawnConfigured()) {
      return sendJson(res, 200, { ok: false, error: 'Multi-Session (spawn) ist auf diesem Host deaktiviert — siehe Database/sessions.json → config.spawn.enabled.' });
    }
    if (raw.source === 'spawned' && raw.pid) SessionManager.stopSpawned(id);
    const started = SessionManager.spawnSession(id, { authMode: 'qr' });
    audit(session.username || maskNumber(session.number) || 'web', 'session.restart', id, started ? 'success' : 'failed');
    logAdminAction(session.username || maskNumber(session.number) || 'web', 'session.restart', id, { started: !!started });
    if (started) {
      notifyOwner({ text: '↻ *SESSION NEU GESTARTET* ↻\n\nSession *' + id + '* wurde über das Dashboard neu gestartet. QR erscheint dort zum Verbinden.\n— LoveBot ☾ Dashboard' });
    }
    return sendJson(res, 200, { ok: !!started, restarted: !!started, error: started ? undefined : 'Neustart fehlgeschlagen.' });
  }

  /* 🔛 Multi-Session (spawn) aktivieren und eine wartende Session sofort
     als echten Kind-Prozess starten — Owner-Aktion, ändert die Config in
     Database/sessions.json. */
  if (pathname === '/api/session/spawn-on' && req.method === 'POST') {
    if (roleOf(session) !== 'owner') return sendJson(res, 403, { error: 'Nur der Owner darf Multi-Session aktivieren.' });
    const body = await readBody(req);
    const id = String(body.id || '').trim();
    SessionManager.setSpawnEnabled(true);
    if (!id) return sendJson(res, 200, { ok: true, spawnEnabled: true });
    const raw = SessionManager.getSessionRaw(id);
    if (!raw) return sendJson(res, 404, { error: 'Session nicht gefunden.' });
    const started = SessionManager.spawnSession(id, { authMode: body.mode === 'pair' ? 'pairing' : 'qr', phone: body.phone });
    audit(session.username || maskNumber(session.number) || 'web', 'session.spawn-on', id, started ? 'started' : 'failed');
    logAdminAction(session.username || maskNumber(session.number) || 'web', 'session.spawn_on', id, { started: !!started });
    if (started) {
      notifyOwner({ text: '🔛 *MULTI-SESSION AKTIVIERT*\n\nSession *' + id + '* wurde sofort gestartet. QR/Pairing-Code erscheint im Dashboard.\n— LoveBot ☾ Dashboard' });
    }
    return sendJson(res, 200, { ok: !!started, spawnEnabled: true, started: !!started, error: started ? undefined : 'Start fehlgeschlagen.' });
  }

  /* ▶️▶️ Alle registrierten (nicht verbundenen) Sessions starten — Owner.
     Aktiviert Multi-Session (spawn) und startet jede wartende/gestoppte
     Session als echten Kind-Prozess im QR-Modus. */
  if (pathname === '/api/sessions/start-all' && req.method === 'POST') {
    if (roleOf(session) !== 'owner') return sendJson(res, 403, { error: 'Nur der Owner.' });
    const body = await readBody(req);
    if (String(body.confirm || '') !== 'ALLE STARTEN') return sendJson(res, 400, { error: 'Bestätigung fehlt: Erwartet "ALLE STARTEN".' });
    SessionManager.setSpawnEnabled(true);
    const all = SessionManager.listSessionsRaw();
    const targets = all.filter((s) => s.id !== 'main' && s.status !== 'CONNECTED');
    let started = 0;
    let skipped = 0;
    for (const t of targets) {
      if (t.source === 'spawned' && t.pid) { skipped++; continue; }
      try {
        const okSpawn = SessionManager.spawnSession(t.id, { authMode: 'qr' });
        if (okSpawn) started++; else skipped++;
      } catch (spErr) { skipped++; }
    }
    audit(session.username || maskNumber(session.number) || 'web', 'session.start_all', String(started) + ' gestartet / ' + skipped + ' übersprungen', 'success');
    logAdminAction(session.username || maskNumber(session.number) || 'web', 'session.start_all', String(started) + ' gestartet', { skipped });
    notifyOwner({ text: '▶️ *ALLE SESSIONS GESTARTET*\n\n' + started + ' Session(s) wurden über das Dashboard gestartet (QR-Modus).\n' + (skipped ? skipped + ' übersprungen (laufen bereits).' : '') + '\n— LoveBot ☾ Dashboard' });
    return sendJson(res, 200, { ok: true, started, skipped, spawnEnabled: true });
  }

  /* 🧾 Admin-Aktionen (Owner): letzte Einträge aus Database/admin-actions.jsonl
     für die Owner-Zentrale. */
  if (pathname === '/api/admin-actions' && req.method === 'GET') {
    if (roleOf(session) !== 'owner') return sendJson(res, 403, { error: 'Nur der Owner.' });
    const entries = readJsonlTail(ADMIN_ACTION_LOG, 60).reverse();
    return sendJson(res, 200, { ok: true, entries });
  }

  /* ⬇️ DOWNLOADS-BEREICH (nur Owner) — fertige Brand-Kit-Dateien
     (.docx/.pptx/.rtf/Logo) mit Benutzername+Passwort-Gate.
     Die Dateien liegen in Dokumente/BrandKit/ (NIE im öffentlichen Web). */
  if (pathname === '/api/downloads/list' && req.method === 'GET') {
    if (roleOf(session) !== 'owner') return sendJson(res, 403, { error: 'Nur der Owner.' });
    const items = brandItems().map((f) => {
      try {
        const st = fs.statSync(path.join(BRAND_DIR, f));
        return { name: f, size: st.size, mtime: st.mtime.toISOString() };
      } catch (e) { return { name: f, size: 0, mtime: null }; }
    });
    return sendJson(res, 200, { ok: true, items, fileLogin: DATEI_LOGIN_PW ? { on: true, user: DATEI_LOGIN_USER } : { on: false } });
  }

  if (pathname === '/api/downloads/brand' && req.method === 'POST') {
    if (roleOf(session) !== 'owner') return sendJson(res, 403, { error: 'Nur der Owner darf herunterladen.' });
    const body = await readBody(req);
    const actor = session.username || maskNumber(session.number) || 'Owner';
    /* ⬇️ Download-Gate: NUR das separate Admin-Passwort — kein Benutzername mehr.
       Der Datei-Login (Benutzername+Passwort) schützt die Datei selbst beim Öffnen. */
    if (!adminPasswordOk(String(body.password || ''))) {
      securityEvent('DOWNLOAD_GATE_FAILED', { ip: reqIp(req), actor, action: 'brand-download', risk: 15 });
      audit(actor, 'download.gate_failed', 'brand', 'denied');
      return sendJson(res, 401, { error: 'Admin-Passwort ungültig.' });
    }
    /* Nur Dateien aus dem BrandKit-Ordner — kein Pfad-Traversal. */
    const want = String(body.file || '').replace(/\\/g, '/').split('/').pop();
    if (!want || !/^[A-Za-z0-9._-]+$/.test(want) || !brandItems().includes(want)) {
      return sendJson(res, 400, { error: 'Unbekannte Datei.' });
    }
    const full = path.join(BRAND_DIR, want);
    let buf = null;
    try { buf = fs.readFileSync(full); } catch (e) {
      return sendJson(res, 500, { error: 'Datei nicht lesbar.' });
    }
    /* 🔐 Datei-Login: Office-Dateien werden beim Download verschlüsselt —
       beim Öffnen fragt Excel/Word/PowerPoint nach dem Passwort. */
    if (PROTECT_OFFICE_EXT.has(path.extname(want).toLowerCase())) buf = officeProtect(buf, 'single');
    const ext = path.extname(want).toLowerCase();
    const mime = BRAND_MIME[ext] || 'application/octet-stream';
    audit(actor, 'download.brand', want, 'success');
    logAdminAction(actor, 'download.brand', want, {
      size: buf.length, time: new Date().toLocaleString('de-DE'), ip: maskIp(reqIp(req))
    });
    res.writeHead(200, Object.assign({
      'Content-Type': mime,
      'Content-Disposition': 'attachment; filename="' + want + '"',
      'Content-Length': buf.length
    }, SECURITY_HEADERS));
    return res.end(buf);
  }

  /* 🗜️ ALL-IN-ONE-Download: Brand-Kit + frischer Live-.xlsx-Export als ZIP.
     Nur Owner · Download-Gate: Admin-Passwort. */
  if (pathname === '/api/downloads/zip' && req.method === 'POST') {
    if (roleOf(session) !== 'owner') return sendJson(res, 403, { error: 'Nur der Owner darf herunterladen.' });
    const body = await readBody(req);
    const stepupActor = session.username || maskNumber(session.number) || 'Owner';
    /* ⬇️ Download-Gate: NUR das separate Admin-Passwort. */
    if (!adminPasswordOk(String(body.password || ''))) {
      securityEvent('DOWNLOAD_GATE_FAILED', { ip: reqIp(req), actor: stepupActor, action: 'downloads.zip', risk: 15 });
      audit(stepupActor, 'download.gate_failed', 'downloads.zip', 'denied');
      return sendJson(res, 401, { error: 'Admin-Passwort ungültig.' });
    }
    const when = new Date().toLocaleString('de-DE');
    const date = new Date().toISOString().slice(0, 10);
    const entries = [];
    /* 1) fertige Brand-Dateien aus Dokumente/BrandKit/ */
    for (const f of brandItems()) {
      try { entries.push({ name: 'LoveBot-BrandKit/' + f, data: fs.readFileSync(path.join(BRAND_DIR, f)) }); } catch (e) {}
    }
    /* 2) frischer Live-Export (alle Blätter inkl. IP-Übersicht) */
    try {
      const payload = collectExportSheets({}, stepupActor);
      const xbuf = exportXlsx(payload.sheets);
      entries.push({ name: 'LoveBot-Export-' + date + '.xlsx', data: xbuf });
    } catch (xe) {
      entries.push({ name: 'Hinweis-Export.txt', data: 'Live-Export konnte nicht erzeugt werden: ' + String(xe.message || xe) });
    }
    /* 3) Übersichts-README */
    const readme =
      'LOVEBOT ☾ — All-in-one Download\n' +
      '================================\n\n' +
      'Erstellt am: ' + when + '\n' +
      'Freigeschaltet von: ' + stepupActor + ' (per Admin-Passwort)\n\n' +
      'Inhalt:\n' +
      '  LoveBot-BrandKit/    – Firmenprofil (.docx), Präsentation (.pptx),\n' +
      '                         Fact-Sheet (.rtf), Logo (PNG + SVG), Kit-Übersicht\n' +
      '  LoveBot-Export-' + date + '.xlsx  – Live-Export mit allen Tabellen:\n' +
      '                         Übersicht, Gruppen, Nutzer & Profile, Accounts & Rechte,\n' +
      '                         Konten-Historie, Web-Sessions, IP-Übersicht & Standorte,\n' +
      '                         Sperren & Bans, Bot-Sessions, Audit-Log, Admin-Aktionen,\n' +
      '                         Rollen-Matrix\n\n' +
      '🔐 Jeder Download ist im Audit-Log & Admin-Aktions-Log protokolliert.\n' +
      'Keine Passwörter oder Passwort-Hashes sind enthalten.\n' +
      '— LoveBot by Maxichen 💜  maxichen.gamebot.me';
    entries.push({ name: 'LIESMICH-Download.txt', data: readme + (DATEI_LOGIN_PW ? '\n\n🔐 DATEI-LOGIN: Die Office-Dateien in dieser ZIP sind geschützt — beim Öffnen fragt Excel/Word/PowerPoint nach dem Passwort (Benutzer laut Vorgabe: ' + DATEI_LOGIN_USER + ').' : '') });

    let zip = null;
    try {
      zip = makeZip(entries);
    } catch (ze) {
      return sendJson(res, 500, { error: 'ZIP-Erstellung fehlgeschlagen: ' + String(ze.message || ze) });
    }
    /* 🔐 Datei-Login: alle Office-Dateien INNERHALB der ZIP verschlüsseln. */
    zip = officeProtect(zip, 'zip');
    audit(stepupActor, 'download.zip', 'all-in-one', 'success');
    logAdminAction(stepupActor, 'download.zip', 'LoveBot-All-in-One', {
      files: entries.length, size: zip.length, time: when, ip: maskIp(reqIp(req))
    });
    res.writeHead(200, Object.assign({
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="LoveBot-All-in-One-' + date + '.zip"',
      'Content-Length': zip.length
    }, SECURITY_HEADERS));
    return res.end(zip);
  }

  /* 📊 Baut alle Export-Blätter (inkl. Übersicht) für .xlsx & ZIP. */
  function collectExportSheets(body, actorLabel) {
    const pick = new Set(Array.isArray(body.sections) ? body.sections : null);
    const want = (k) => !body.sections || pick.has(k);
    const db = readDb();
    const when = new Date().toLocaleString('de-DE');
    const dt = (iso) => { try { return iso ? new Date(iso).toLocaleString('de-DE') : ''; } catch (e) { return ''; } };
    const yn = (v, fallback) => (v === true ? 'ja' : (v === false ? 'nein' : (fallback || '')));

    /* --- 👥 Gruppen --- */
    const groupsRows = [];
    if (want('gruppen')) {
      for (const [id, g] of Object.entries(db.groups || {})) {
        if (!g || typeof g !== 'object' || !(g.subject || g.active !== undefined)) continue;
        groupsRows.push([
          id, g.subject || id, g.active === false ? 'inaktiv' : 'aktiv',
          yn(g.autodl, 'standard'), yn(g.welcome, 'standard'), yn(g.goodbye, 'standard'),
          yn(g.badwords, 'standard'), g.antilink === true ? 'an' : 'aus',
          yn(g.kick, 'standard'), yn(g.promote, 'standard'), yn(g.demote, 'standard'),
          dt(g.joinedAt || g.createdAt || g.activatedAt), dt(g.setupAt)
        ]);
      }
    }

    /* --- 💜 WhatsApp-Nutzer & Profile (aus Database.json + LoveUser/) --- */
    const userRows = [];
    if (want('nutzer')) {
      const profileMap = new Map();
      try {
        const dir = path.join('Database', 'LoveUser');
        for (const bid of fs.readdirSync(dir).slice(0, 5000)) {
          try {
            const p = JSON.parse(fs.readFileSync(path.join(dir, bid, bid + '.json'), 'utf8'));
            profileMap.set(bid, p);
          } catch (e) {}
        }
      } catch (e) {}
      const seen = new Set();
      /* erst die Profile (vollständigste Daten) */
      for (const [bid, p] of profileMap) {
        seen.add(bid);
        const idn = (p && p.identity) || {};
        const reg = (p && p.registration) || {};
        const st = (p && p.status) || {};
        const prog = (p && p.progression) || {};
        const wal = (p && p.wallet) || {};
        const love = (p && p.love) || {};
        userRows.push([
          idn.cleanJid || String(idn.phone || '').replace(/\D/g, '') || String(bid).split('jid')[0],
          reg.name || idn.username || '',
          prog.level || 0, prog.xp || 0, prog.prestige || 0,
          wal.copper || 0, wal.silver || 0, wal.gold || 0, wal.platin || 0,
          st.verified === true ? 'ja' : (st.verified === false ? 'nein' : ''),
          (st.dsgvo && st.dsgvo.accepted === true) ? 'ja' : 'nein',
          reg.registered === true ? 'ja' : 'nein',
          reg.age || '', reg.status || '', reg.city || '', dt(reg.registeredAt),
          love.married === true ? 'ja' : 'nein', love.spouseName || '', dt(love.marriedAt)
        ]);
      }
      /* zusätzliche Einträge aus Database.json (ohne Profil-Datei) */
      for (const [key, u] of Object.entries(db.users || {})) {
        if (seen.has(key) || !u || typeof u !== 'object') continue;
        const reg = u.registration || {};
        const st = u.status || {};
        userRows.push([
          String(key).split('jid')[0] || key, reg.name || '',
          0, 0, 0, 0, 0, 0, 0,
          st.verified === true ? 'ja' : (st.verified === false ? 'nein' : ''),
          (st.dsgvo && st.dsgvo.accepted === true) ? 'ja' : 'nein',
          reg.registered === true ? 'ja' : 'nein',
          reg.age || '', reg.status || '', reg.city || '', dt(reg.registeredAt),
          'nein', '', ''
        ]);
      }
      userRows.sort((a, b) => String(a[0]).localeCompare(String(b[0])));
    }

    /* --- 🎲 Nutzer-Details: Spiele, Bank & Liebe (pro Profil, 1 Zeile je User) --- */
    const detailRows = [];
    if (want('nutzer')) {
      let lpUsers = null;
      try { lpUsers = JSON.parse(fs.readFileSync(path.join('Database', 'loveplus.json'), 'utf8')).users || {}; } catch (e) { lpUsers = {}; }
      try {
        const dir = path.join('Database', 'LoveUser');
        for (const bid of fs.readdirSync(dir).slice(0, 5000)) {
          try {
            const p = JSON.parse(fs.readFileSync(path.join(dir, bid, bid + '.json'), 'utf8'));
            const idn = (p && p.identity) || {};
            const reg = (p && p.registration) || {};
            const prog = (p && p.progression) || {};
            const wal = (p && p.wallet) || {};
            const bank = (p && p.bank) || {};
            const games = (p && p.games) || {};
            const rew = (p && p.rewards) || {};
            const love = (p && p.love) || {};
            const lpu = (lpUsers && lpUsers[bid]) || {};
            const ach = (lpu.achievements && Object.keys(lpu.achievements)) || [];
            const bankTotal = [bank.copper, bank.silver, bank.gold, bank.platin].reduce((a, b) => a + (Number(b) || 0), 0);
            detailRows.push([
              idn.cleanJid || String(idn.phone || '').replace(/\D/g, '') || String(bid).split('jid')[0],
              reg.name || idn.username || '',
              prog.level || 0, prog.xp || 0, prog.neededXpForLvOrPrestigeUp || '',
              wal.copper || 0, wal.silver || 0, wal.gold || 0, wal.platin || 0,
              bank.active === true ? 'ja' : 'nein', bankTotal,
              games.gamesPlayed || 0, games.highestWin || 0, games.highestWinStreak || 0,
              rew.lastDailyAt ? dt(rew.lastDailyAt) : '', dt(rew.lastWeeklyAt),
              ach.length || 0,
              love.married === true ? 'ja' : 'nein', love.spouseName || '',
              reg.city || ''
            ]);
          } catch (e) {}
        }
      } catch (e) {}
      detailRows.sort((a, b) => String(a[0]).localeCompare(String(b[0])));
    }

    /* --- 🛡️ Accounts & Rechte (Panel) --- */
    const accRows = [];
    if (want('accounts')) {
      for (const a of rbac.listAccounts()) {
        accRows.push([
          a.id || '', a.username, a.number, a.role,
          (rbac.ROLES[a.role] && rbac.ROLES[a.role].label) || a.role,
          (a.scope && a.scope.type === 'group') ? ('Gruppe ' + (a.scope.groupJid || '')) : 'global',
          a.status || 'active', a.mustChange ? 'ja' : 'nein',
          dt(a.createdAt), dt(a.lastLoginAt),
          (a.permsExtra || []).join(', '), (a.permsRevoked || []).join(', '),
          (a.restrictions || []).join(', '),
          rbac.effectivePerms(a).join(', ')
        ]);
      }
    }

    /* --- 📜 Konten-Historie (Rollen-/Status-/Passwort-/Login-Events) --- */
    const histRows = [];
    if (want('kontenhist')) {
      const evs = [];
      for (const a of rbac.listAccounts()) {
        const user = a.username || a.number || '?';
        if (a.createdAt) evs.push({ t: a.createdAt, u: user, k: 'Konto erstellt', d: 'Rolle: ' + a.role, by: 'system' });
        for (const rh of (a.roleHistory || [])) {
          evs.push({ t: rh.at, u: user, k: 'Rolle', d: '→ ' + (rh.role || '?'), by: rh.by || '?' });
        }
        for (const sh of (a.statusHistory || [])) {
          const d = (sh.from ? sh.from + ' → ' : '→ ') + (sh.to || '?') + (sh.reason ? '  ·  ' + sh.reason : '');
          evs.push({ t: sh.at, u: user, k: 'Status', d, by: sh.by || '?' });
        }
        if (a.passwordChangedAt) evs.push({ t: a.passwordChangedAt, u: user, k: 'Passwort geändert', d: '', by: user });
        if (a.lastLoginAt) evs.push({ t: a.lastLoginAt, u: user, k: 'Login', d: 'letzte Anmeldung', by: user });
      }
      evs.sort((a, b) => String(b.t || '').localeCompare(String(a.t || '')));
      for (const e of evs.slice(0, 3000)) histRows.push([dt(e.t), e.u, e.k, e.d, e.by]);
    }

    /* --- 🖥️ Web-Login-Sessions (persistent + live markiert) --- */
    const loginRows = [];
    if (want('logins')) {
      let rawWeb = {};
      try { rawWeb = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8')); } catch (e) { rawWeb = {}; }
      const live = new Set(sessions.keys());
      const merged = new Map();
      for (const [tok, sv] of sessions) {
        merged.set(tok, { ...sv, _active: tok === session.token ? 'aktiv · du' : 'aktiv', _tok: tok });
      }
      for (const [tok, sv] of Object.entries(rawWeb)) {
        if (!merged.has(tok)) merged.set(tok, { ...sv, _active: 'gespeichert', _tok: tok });
      }
      const list = [...merged.values()];
      list.sort((a, b) => String(b.lastSeenAt || b.createdAt || '').localeCompare(String(a.lastSeenAt || a.createdAt || '')));
      for (const sv of list.slice(0, 2000)) {
        loginRows.push([
          sv._active, sv.username || sv.name || '?', sv.role || 'user', sv.number,
          sv.name || '', dt(sv.createdAt), dt(sv.lastSeenAt),
          sv.lastIp || '', sv.userAgent || '',
          (sv.scope && sv.scope.type === 'group') ? ('Gruppe ' + (sv.scope.groupJid || '')) : 'global'
        ]);
      }
    }

    /* --- 🌐 IP-Übersicht & Standorte: jede Login-IP mit Benutzern/Geräten --- */
    const ipRows = [];
    if (want('ips')) {
      const shortUa = (ua) => {
        if (!ua) return '—';
        const u = String(ua);
        const dev = u.includes('Edg/') ? 'Edge'
          : u.includes('OPR/') || u.includes('Opera/') ? 'Opera'
          : u.includes('Chrome/') ? 'Chrome'
          : u.includes('Firefox/') ? 'Firefox'
          : u.includes('Safari/') ? 'Safari'
          : u.includes('curl') || u.includes('wget') ? 'CLI/curl'
          : u.includes('WhatsApp') ? 'WhatsApp'
          : 'Unbekannt';
        const os = u.includes('Windows NT') ? 'Windows'
          : u.includes('Android') ? 'Android'
          : u.includes('iPhone') || u.includes('iPad') ? 'iOS'
          : u.includes('Mac OS X') ? 'macOS'
          : u.includes('Linux') ? 'Linux'
          : '';
        return os ? dev + ' · ' + os : dev;
      };
      const byIp = new Map();
      const addSess = (sv) => {
        if (!sv) return;
        const ips = [sv.lastIp, sv.prevIp, sv.ip, sv.clientIp].filter(Boolean);
        for (const rawIp of [...new Set(ips.map((x) => String(x).trim()).filter(Boolean))]) {
          const e = byIp.get(rawIp) || {
            ip: rawIp, users: new Set(), roles: new Set(), uas: new Set(), nums: new Set(),
            first: sv.createdAt, last: sv.lastSeenAt || sv.createdAt, count: 0
          };
          if (sv.username || sv.name) e.users.add(String(sv.username || sv.name).trim());
          if (sv.role) e.roles.add(String(sv.role));
          if (sv.userAgent) e.uas.add(String(sv.userAgent));
          if (sv.number) e.nums.add(String(sv.number));
          const t = sv.lastSeenAt || sv.createdAt;
          if (t && (!e.last || String(t) > String(e.last))) e.last = t;
          if (sv.createdAt && (!e.first || String(sv.createdAt) < String(e.first))) e.first = sv.createdAt;
          e.count++;
          byIp.set(rawIp, e);
        }
      };
      for (const [, sv] of sessions) addSess(sv);
      try {
        const rawWeb = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
        for (const sv of Object.values(rawWeb)) addSess(sv);
      } catch (e) {}
      /* Profil-Stadt je Nummer (freiwillig im WhatsApp-Profil hinterlegt) */
      const cityByNum = new Map();
      try {
        const dir = path.join('Database', 'LoveUser');
        for (const bid of fs.readdirSync(dir)) {
          try {
            const p = JSON.parse(fs.readFileSync(path.join(dir, bid, bid + '.json'), 'utf8'));
            const idn = (p && p.identity) || {};
            const city = ((p && p.registration) || {}).city;
            if (idn.cleanJid && city) cityByNum.set(String(idn.cleanJid), String(city));
          } catch (e) {}
        }
      } catch (e) {}
      const ipRowsArr = [...byIp.values()];
      ipRowsArr.sort((a, b) => String(b.last || '').localeCompare(String(a.last || '')));
      for (const e of ipRowsArr) {
        const dev = [...e.uas].slice(0, 3).map(shortUa).join(', ');
        const cities = [...new Set([...e.nums].map((n) => cityByNum.get(n)).filter(Boolean))];
        ipRows.push([
          e.ip,
          dt(e.last),
          e.count,
          [...e.users].join(', ') || '—',
          [...e.roles].join(', ') || '—',
          dev || '—',
          dt(e.first),
          cities.join(', ') || '—',
          'keine IP-Geo-Abfrage — Standort nur aus freiwilligen Profilangaben'
        ]);
      }
    }

    /* --- 🚫 Sperren & Bans --- */
    const banRows = [];
    if (want('bans')) {
      for (const [key, b] of Object.entries(db.bans || {})) {
        banRows.push([
          key, b.jid || b.number || '', b.lid || '', b.reason || '',
          b.bannedBy || b.by || b.bannedByName || '', dt(b.bannedAt || b.at)
        ]);
      }
    }

    /* --- 🤖 Bot-Sessions --- */
    const botRows = [];
    if (want('bot-sessions')) {
      try {
        for (const x of SessionManager.listSessions()) {
          botRows.push([
            x.name, x.id, x.status,
            (x.health && x.health.label) || '', x.source || '',
            x.isDefault ? 'ja' : 'nein', x.phone || '',
            x.uptimeSec || 0, (x.uptimePct != null ? x.uptimePct : ''),
            x.messages || 0, x.commands || 0, x.groups || 0,
            x.reconnects || 0, x.errors || 0, x.memoryMb || 0,
            x.maintenance ? 'an' : 'aus',
            x.desiredState || '', x.autoStart ? 'ja' : 'nein',
            dt(x.lastSeen), dt(x.createdAt)
          ]);
        }
      } catch (e) {}
    }

    /* --- 🧾 Audit-Log --- */
    const auditRows = [];
    if (want('audit')) {
      for (const e of readJsonlTail(AUDIT_FILE, 800).reverse()) {
        auditRows.push([dt(e.time), e.actor || '', e.action || '', e.target || '', e.result || '']);
      }
    }

    /* --- 🧰 Admin-Aktionen --- */
    const adminRows = [];
    if (want('admin-actions')) {
      for (const e of readJsonlTail(ADMIN_ACTION_LOG, 800).reverse()) {
        adminRows.push([
          dt(e.time),
          e.actor || '', e.action || '', e.target || '',
          JSON.stringify(Object.fromEntries(Object.entries(e).filter(([k]) => !['time', 'actor', 'action', 'target'].includes(k))))
        ]);
      }
    }

    /* --- 🗂️ Rollen-Matrix --- */
    const roleRows = [];
    if (want('rollen')) {
      for (const r of rbac.ROLE_LIST) {
        const perms = rbac.permsOf(r.id);
        if (perms.includes('*')) {
          roleRows.push([r.id, r.label, '*', 'Alle Berechtigungen (Owner)']);
          continue;
        }
        for (const perm of perms) {
          const meta = rbac.PERMISSIONS.find((p) => p.id === perm);
          roleRows.push([r.id, r.label, perm, (meta && meta.label) || '']);
        }
      }
    }

    /* --- Blätter zusammenstellen (Übersicht kommt immer zuerst) --- */
    const sheets = [];
    if (want('gruppen')) sheets.push({ name: 'Gruppen', header: ['Gruppen-ID', 'Name', 'Status', 'Auto-DL', 'Welcome', 'Goodbye', 'Badwords', 'Anti-Link', 'Kick', 'Promote', 'Demote', 'Erstellt', 'Setup'], rows: groupsRows });
    if (want('nutzer')) sheets.push({ name: 'Nutzer & Profile', header: ['Nummer', 'Profil-Name', 'Level', 'XP', 'Prestige', 'Kupfer', 'Silber', 'Gold', 'Platin', 'Verifiziert', 'DSGVO', 'Registriert', 'Alter', 'Status', 'Stadt', 'Registriert am', 'Verheiratet', 'Partner', 'Hochzeit am'], rows: userRows, widths: [16, 20, 7, 8, 8, 8, 8, 8, 8, 11, 8, 11, 7, 10, 12, 18, 11, 16, 18] });
    if (want('nutzer')) sheets.push({ name: 'Nutzer-Details (Spiele · Bank)', header: ['Nummer', 'Profil-Name', 'Level', 'XP', 'Nächste Level', 'Kupfer', 'Silber', 'Gold', 'Platin', 'Bank aktiv', 'Bank (Summe)', 'Spiele gespielt', 'Höchster Gewinn', 'Beste Serie', 'Letzter Tagesbonus', 'Letzter Wochenbonus', 'Achievements', 'Verheiratet', 'Partner', 'Profil-Stadt'], rows: detailRows, widths: [16, 20, 7, 8, 12, 8, 8, 8, 8, 11, 12, 11, 12, 10, 18, 18, 11, 11, 16, 14] });
    if (want('accounts')) sheets.push({ name: 'Accounts & Rechte', header: ['Konto-ID', 'Username', 'Nummer', 'Rolle', 'Rollen-Label', 'Scope', 'Status', 'PW-Wechsel', 'Erstellt', 'Letzter Login', 'Zusatzrechte', 'Entzogene Rechte', 'Einschränkungen', 'Effektive Rechte'], rows: accRows });
    if (want('kontenhist')) sheets.push({ name: 'Konten-Historie', header: ['Zeit', 'Konto', 'Art', 'Änderung', 'Durch'], rows: histRows });
    if (want('logins')) sheets.push({ name: 'Web-Sessions', header: ['Status', 'Nutzer', 'Rolle', 'Nummer', 'Name', 'Erstellt', 'Zuletzt gesehen', 'IP', 'Gerät (UA)', 'Scope'], rows: loginRows });
    if (want('ips')) sheets.push({ name: 'IP-Übersicht & Standorte', header: ['IP-Adresse', 'Letzte Aktivität', 'Anmeldungen', 'Benutzer (Login)', 'Rollen', 'Gerät', 'Erster Kontakt', 'Profil-Stadt', 'Hinweis'], rows: ipRows, widths: [18, 18, 12, 30, 14, 26, 18, 22, 50] });
    if (want('bans')) sheets.push({ name: 'Sperren & Bans', header: ['Schlüssel', 'Nummer/JID', 'LID', 'Grund', 'Von', 'Wann'], rows: banRows });
    if (want('bot-sessions')) sheets.push({ name: 'Bot-Sessions', header: ['Name', 'ID', 'Status', 'Health', 'Quelle', 'Standard', 'Nummer', 'Uptime (s)', 'Uptime %', 'Nachrichten', 'Befehle', 'Gruppen', 'Reconnects', 'Fehler', 'RAM MB', 'Wartung', 'Zustand', 'Auto-Start', 'Letzter Kontakt', 'Angelegt'], rows: botRows });
    if (want('audit')) sheets.push({ name: 'Audit-Log', header: ['Zeit', 'Akteur', 'Aktion', 'Ziel', 'Ergebnis'], rows: auditRows });
    if (want('admin-actions')) sheets.push({ name: 'Admin-Aktionen', header: ['Zeit', 'Akteur', 'Aktion', 'Ziel', 'Details'], rows: adminRows });
    if (want('rollen')) sheets.push({ name: 'Rollen-Matrix', header: ['Rolle', 'Rollen-Label', 'Berechtigung', 'Beschreibung'], rows: roleRows });

    /* Übersichtsblatt: immer an erster Stelle */
    const coverPairs = [
      ['📦 Projekt', 'LoveBot ☾ Control-Panel — Gesamt-Export'],
      ['🕒 Export erstellt', when],
      ['👑 Exportiert von', actorLabel + ' (per Admin-Passwort authentifiziert)'],
      ['', ''],
      ['👥 Gruppen (db)', String(Object.keys(db.groups || {}).length)],
      ['💜 WhatsApp-Nutzer (db)', String(Object.keys(db.users || {}).length)],
      ['📁 Nutzer-Profile (LoveUser)', String(((() => { try { return fs.readdirSync(path.join('Database', 'LoveUser')).length; } catch (e) { return 0; } })()))],
      ['🛡️ Panel-Accounts', String(rbac.listAccounts().length)],
      ['🤖 Bot-Sessions (Registry)', String(((() => { try { return SessionManager.listSessions().length; } catch (e) { return 0; } })()))],
      ['🚫 Bans', String(Object.keys(db.bans || {}).length)],
      ['', ''],
      ['📈 Live-Kennzahlen', ''],
      ['💍 Paare (Love-System)', String(((() => { try { const lp = JSON.parse(fs.readFileSync(path.join('Database', 'loveplus.json'), 'utf8')); return Object.keys((lp && lp.couples) || {}).length; } catch (e) { return 0; } })()))],
      ['💝 Aktive Gruppen', String(((() => { try { let n = 0; for (const g of fs.readdirSync(path.join('Database', 'LoveGroups'))) { try { const gp = JSON.parse(fs.readFileSync(path.join('Database', 'LoveGroups', g, g + '.json'), 'utf8')); if (gp && gp.active !== false) n++; } catch (e2) {} } return n; } catch (e) { return 0; } })()))],
      ['🎮 Gespielte Spiele (alle Nutzer)', String(((() => { let n = 0; try { for (const bid of fs.readdirSync(path.join('Database', 'LoveUser')).slice(0, 5000)) { try { const p = JSON.parse(fs.readFileSync(path.join('Database', 'LoveUser', bid, bid + '.json'), 'utf8')); n += (p && p.games && p.games.gamesPlayed) || 0; } catch (e3) {} } } catch (e4) {} return n; })()))],
      ['🏦 Aktive Bankkonten', String(((() => { let n = 0; try { for (const bid of fs.readdirSync(path.join('Database', 'LoveUser')).slice(0, 5000)) { try { const p = JSON.parse(fs.readFileSync(path.join('Database', 'LoveUser', bid, bid + '.json'), 'utf8')); if (p && p.bank && p.bank.active === true) n++; } catch (e5) {} } } catch (e6) {} return n; })()))],
      ['🖥️ Web-Login-Sessions', String(((() => { try { return Object.keys(JSON.parse(fs.readFileSync(path.join('Database', 'websessions.json'), 'utf8'))).length; } catch (e7) { return 0; } })()))],
      ['', ''],
      ['📋 Blätter in dieser Datei', '']
    ];
    for (const s of sheets) coverPairs.push(['   • ' + s.name, s.rows.length + ' Zeilen']);
    coverPairs.push(['', '']);
    coverPairs.push(['🔐 Hinweise', 'Erstellt über die Owner-Zentrale (#/all) mit Admin-Passwort — Export wird protokolliert.']);
    coverPairs.push(['', 'Keine Passwörter oder Passwort-Hashes sind in dieser Datei enthalten.']);
    sheets.unshift({ name: 'Übersicht', header: ['LoveBot ☾ Gesamt-Export', 'Details'], rows: coverPairs, freeze: false, filter: false, widths: [34, 78] });
    return { sheets, when };
  }

  if (pathname === '/api/export/xlsx' && req.method === 'POST') {
    if (roleOf(session) !== 'owner') return sendJson(res, 403, { error: 'Nur der Owner darf exportieren.' });
    const body = await readBody(req);
    const stepupActor = session.username || maskNumber(session.number) || 'Owner';
    /* ⬇️ Download-Gate: NUR das separate Admin-Passwort.
       (Bestehende Reauth-Bestätigung bleibt als zweiter Weg erhalten.) */
    const _hasPw = String(body.password || '').length > 0;
    if (!adminPasswordOk(String(body.password || ''))) {
      if (!_hasPw && !requireStepUp(req, res, session, body, 'export.xlsx')) return;
      if (_hasPw) {
        securityEvent('DOWNLOAD_GATE_FAILED', { ip: reqIp(req), actor: stepupActor, action: 'export.xlsx', risk: 15 });
        audit(stepupActor, 'download.gate_failed', 'export.xlsx', 'denied');
        return sendJson(res, 401, { error: 'Admin-Passwort ungültig.' });
      }
    }
    const payload = collectExportSheets(body, stepupActor);
    const sheets = payload.sheets;
    const when = payload.when;
    let buf = null;
    try {
      buf = exportXlsx(sheets);
    } catch (xe) {
      return sendJson(res, 500, { error: 'Export fehlgeschlagen: ' + String(xe.message || xe) });
    }
    /* 🔐 Datei-Login: Live-Export beim Download verschlüsseln. */
    buf = officeProtect(buf, 'single');
    logAdminAction(stepupActor, 'export.xlsx', 'owner-export', { sheets: sheets.map((x) => x.name).join(', '), time: when, via: _hasPw ? 'admin-passwort' : 'reauth' });
    res.writeHead(200, Object.assign({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="LoveBot-Export-' + new Date().toISOString().slice(0, 10) + '.xlsx"',
      'Content-Length': buf.length
    }, SECURITY_HEADERS));
    return res.end(buf);
  }


  /* 📤 QR einer Session manuell als Bild an alle Gruppen des aktiven Bots
     senden (zusätzlich zur automatischen Ankündigung). */
  if (pathname === '/api/session/qr-to-group' && req.method === 'POST') {
    if (roleOf(session) !== 'owner') return sendJson(res, 403, { error: 'Nur der Owner darf QR-Codes senden.' });
    const body = await readBody(req);
    const id = String(body.id || '').trim();
    if (!id) return sendJson(res, 400, { error: 'id fehlt.' });
    const raw = SessionManager.getSessionRaw(id);
    if (!raw) return sendJson(res, 404, { error: 'Session nicht gefunden.' });
    if (!raw.qr) return sendJson(res, 200, { ok: false, error: raw.status === 'CONNECTED' ? 'Session ist bereits verbunden.' : 'Noch kein QR verfügbar — Moment, der QR läuft an.' });
    queueMailbox({
      id: newToken(), type: 'broadcast-qr', qr: raw.qr, status: 'pending', createdAt: new Date().toISOString(),
      caption: '🔗 *QR ZUM VERBINDEN* 🔗\n\nSession „' + (raw.name || id) + '“\nScanne mit WhatsApp: Verknüpfte Geräte > Gerät verknüpfen.\n— LoveBot ☾ Dashboard'
    });
    logAdminAction(session.username || maskNumber(session.number) || 'web', 'session.qr_to_group', id, {});
    return sendJson(res, 200, { ok: true, queued: true });
  }

  /* ---- Session-/System-Aktionen: über die Webmail-Queue an Love.js ------- */
  if (pathname.startsWith('/api/session/') && req.method === 'POST') {
    if (!perm(session, 'sessions.control')) return sendJson(res, 403, { error: 'Keine Berechtigung (sessions.control).' });
    const act = pathname.split('/')[3];
    const body = await readBody(req);
    const id = newToken();
    queueMailbox({ id, type: 'sessionctl', act, name: String(body.name || ''), status: 'pending', createdAt: new Date().toISOString() });
    audit(session.number, 'session.' + act, body.name || 'MainBot', 'queued');
    return sendJson(res, 200, { ok: true, queued: true, mailboxId: id });
  }
  if (pathname.startsWith('/api/system/') && req.method === 'POST') {
    if (!perm(session, 'system.control')) return sendJson(res, 403, { error: 'Keine Berechtigung (system.control).' });
    const act = pathname.split('/')[3];
    audit(session.number, 'system.' + act, 'bot', 'queued');
    if (act === 'gc' && global.gc) { global.gc(); return sendJson(res, 200, { ok: true }); }
    const id = newToken();
    queueMailbox({ id, type: 'systemctl', act, status: 'pending', createdAt: new Date().toISOString() });
    return sendJson(res, 200, { ok: true, queued: true, mailboxId: id });
  }

  /* ---- 👤 ACCOUNTS & RBAC --------------------------------------------------- */
  if (pathname === '/api/roles' && req.method === 'GET') {
    return sendJson(res, 200, {
      ok: true,
      roles: rbac.ROLE_LIST,
      matrix: Object.fromEntries(rbac.ROLE_LIST.map((r) => [r.id, rbac.permsOf(r.id)]))
    });
  }

  if (pathname === '/api/accounts' && req.method === 'GET') {
    if (!perm(session, 'accounts.view')) return sendJson(res, 403, { error: 'Keine Berechtigung.' });
    const list = rbac.listAccounts().map((a) => ({
      id: a.id, username: a.username, number: maskNumber(a.number), role: a.role,
      scope: a.scope, status: a.status || 'active', mustChange: !!a.mustChange,
      createdAt: a.createdAt, lastLoginAt: a.lastLoginAt,
      roleHistory: (a.roleHistory || []).slice(-5),
      restrictions: a.restrictions || [],
      permsExtra: a.permsExtra || [], permsRevoked: a.permsRevoked || [],
      effectivePerms: rbac.effectivePerms(a)
    }));
    return sendJson(res, 200, { ok: true, accounts: list });
  }

  /* 📋 Referenzdaten für die Benutzerakte-UI: alle Einzelrechte, Vorlagen,
     Status-Modell und einschränkbare Features an einem Ort. */
  if (pathname === '/api/permissions' && req.method === 'GET') {
    if (!perm(session, 'accounts.view')) return sendJson(res, 403, { error: 'Keine Berechtigung.' });
    return sendJson(res, 200, {
      ok: true,
      permissions: rbac.PERMISSIONS,
      templates: rbac.PERMISSION_TEMPLATES,
      statuses: rbac.STATUS_LIST,
      restrictableFeatures: rbac.RESTRICTABLE_FEATURES
    });
  }

  /* 🗂️ Volle "Benutzerakte" eines Accounts: Profil, Zugang, Sicherheit,
     Aktivität — alles was die erweiterte User-Verwaltung braucht. */
  /* 📂 Profil-Datei (LoveUser) zur WhatsApp-Nummer finden */
  function findProfileByNumber(number) {
    if (!number) return null;
    try {
      const dir = path.join('Database', 'LoveUser');
      for (const bid of fs.readdirSync(dir)) {
        if (!bid.startsWith(String(number))) continue;
        try {
          const p = JSON.parse(fs.readFileSync(path.join(dir, bid, bid + '.json'), 'utf8'));
          return { bid, data: p };
        } catch (e) {}
      }
    } catch (e) {}
    return null;
  }

  if (pathname.startsWith('/api/accounts/') && pathname.endsWith('/detail') && req.method === 'GET') {
    if (!perm(session, 'accounts.view')) return sendJson(res, 403, { error: 'Keine Berechtigung.' });
    const id = pathname.split('/')[3];
    const acc = rbac.getAccount(id);
    if (!acc) return sendJson(res, 404, { error: 'Account nicht gefunden.' });
    const canManage = perm(session, 'accounts.manage');
    const mySessions = [...sessions.entries()].filter(([, sv]) => sv.number === acc.number)
      .map(([tok, sv]) => ({ tokenHint: tok.slice(0, 8) + '…', createdAt: sv.createdAt }));
    return sendJson(res, 200, {
      ok: true,
      account: {
        id: acc.id, username: acc.username, number: canManage ? acc.number : maskNumber(acc.number),
        role: acc.role, scope: acc.scope, status: acc.status || 'active',
        restrictions: acc.restrictions || [], mustChange: !!acc.mustChange,
        createdAt: acc.createdAt, lastLoginAt: acc.lastLoginAt, passwordChangedAt: acc.passwordChangedAt || null,
        lockedReason: acc.lockedReason || null,
        permsExtra: acc.permsExtra || [], permsRevoked: acc.permsRevoked || [],
        effectivePerms: rbac.effectivePerms(acc),
        roleHistory: acc.roleHistory || [],
        statusHistory: acc.statusHistory || [],
        permsHistory: acc.permsHistory || []
      },
      activeSessions: mySessions
    });
  }

  /* 📂 VOLLSTÄNDIGE BENUTZERAKTE (Thinkproject-Muster): Account + Bot-Profil
     + XP + Economy + Games + Pets + Gruppen + Security + Audit in EINEM
     Aufruf — Grundlage der 12-Tab-Ansicht im Control Center. */
  if (pathname.startsWith('/api/accounts/') && pathname.endsWith('/detail/full') && req.method === 'GET') {
    if (!perm(session, 'accounts.view')) return sendJson(res, 403, { error: 'Keine Berechtigung (accounts.view).' });
    const id = pathname.split('/')[3];
    const acc = rbac.getAccount(id);
    if (!acc) return sendJson(res, 404, { error: 'Account nicht gefunden.' });
    const canManage = perm(session, 'accounts.manage');
    const number = String(acc.number || '');
    const found = findProfileByNumber(number);
    const pr = found?.data || null;
    const profileBid = found?.bid || null;
    const lp = readLoveplus();
    const lpU = profileBid ? (lp.users || {})[profileBid] || {} : {};
    const db = readDb();
    const groups = Object.entries(db.groups || {}).map(([gid, g]) => ({ gid, active: g?.active !== false, setupAt: g?.setupAt || null }));
    let secEvents = [];
    try {
      const lines = fs.readFileSync(SECURITY_FILE, 'utf8').trim().split('\n').filter(Boolean).slice(-3000);
      for (const l of lines) {
        try {
          const ev = JSON.parse(l);
          const hay = String(ev.actor || '') + ' ' + String(ev.ip || '') + ' ' + String(ev.target || '');
          if (number && hay.includes(number)) secEvents.push(ev);
        } catch (e) {}
      }
      secEvents = secEvents.slice(-15).reverse();
    } catch (e) {}
    let auditEntries = [];
    try {
      const lines = fs.readFileSync(AUDIT_FILE, 'utf8').trim().split('\n').filter(Boolean).slice(-3000);
      for (const l of lines) {
        try {
          const a = JSON.parse(l);
          const hay = String(a.actor || '') + ' ' + String(a.target || '');
          if (hay.includes(number) || (acc.username && hay.includes(acc.username))) auditEntries.push(a);
        } catch (e) {}
      }
      auditEntries = auditEntries.slice(-20).reverse();
    } catch (e) {}
    const mySessions = [...sessions.entries()].filter(([, sv]) => sv.number === number)
      .map(([tok, sv]) => ({ tokenHint: tok.slice(0, 8) + '…', createdAt: sv.createdAt }));
    return sendJson(res, 200, {
      ok: true,
      account: {
        id: acc.id, username: acc.username, number: canManage ? number : maskNumber(number),
        role: acc.role, scope: acc.scope, status: acc.status || 'active',
        restrictions: acc.restrictions || [], mustChange: !!acc.mustChange,
        createdAt: acc.createdAt, lastLoginAt: acc.lastLoginAt, passwordChangedAt: acc.passwordChangedAt || null,
        lockedReason: acc.lockedReason || null,
        permsExtra: acc.permsExtra || [], permsRevoked: acc.permsRevoked || [],
        effectivePerms: rbac.effectivePerms(acc),
        roleHistory: acc.roleHistory || [],
        statusHistory: acc.statusHistory || [],
        permsHistory: acc.permsHistory || []
      },
      activeSessions: mySessions,
      profile: pr ? {
        bid: profileBid,
        name: pr?.registration?.name || '',
        registered: !!pr?.registration?.registered,
        registeredAt: pr?.registration?.registeredAt || null,
        dsgvo: pr?.status?.dsgvo?.accepted === true,
        level: pr?.progression?.level || 0,
        prestige: pr?.progression?.prestige || 0,
        xp: pr?.progression?.xp || 0,
        totalXp: pr?.progression?.totalXp || 0,
        xpSources: pr?.progression?.xpSources || {},
        streak: pr?.progression?.streak || 0,
        wallet: pr?.wallet || {},
        married: pr?.love?.married === true,
        spouse: pr?.love?.spouseName || null,
        marriedAt: pr?.love?.marriedAt || null
      } : null,
      loveplus: {
        achievements: Object.entries(lpU.achievements || {}).map(([aid, at]) => ({ id: aid, at: at || null })),
        pet: lpU.pet || null,
        inventory: lpU.inventory || {},
        lovebonus: lpU.lovebonus || null,
        counters: lpU.counters || {}
      }
    , groups, securityEvents: secEvents, auditEntries });
  }

  /* 🗑️ WEB-ACCOUNT LÖSCHEN (kritisch): anonymisiert Account + beendet Sessions.
     Das WhatsApp-Profil bleibt erhalten (DSGVO: gesonderte Profilvergesslichkeit
     über profile-delete). */
  if (pathname.startsWith('/api/accounts/') && pathname.endsWith('/delete') && req.method === 'POST') {
    if (!perm(session, 'accounts.manage')) return sendJson(res, 403, { error: 'Keine Berechtigung (accounts.manage).' });
    const id = pathname.split('/')[3];
    const acc = rbac.getAccount(id);
    if (!acc) return sendJson(res, 404, { error: 'Account nicht gefunden.' });
    if (acc.role === 'owner') return sendJson(res, 403, { error: 'Owner-Accounts können nicht gelöscht werden.' });
    const body = await readBody(req);
    if (!requireStepUp(req, res, session, body, 'account.delete')) return;
    const reason = String(body.reason || '').trim();
    if (reason.length < 5) return sendJson(res, 400, { error: 'Grund ist Pflicht (min. 5 Zeichen) — die Löschung wird auditiert.' });
    const actor = session.username || maskNumber(session.number);
    /* Sessions sofort beenden */
    for (const [tok, sv] of [...sessions]) if (sv.number === acc.number) sessions.delete(tok);
    saveSessions();
    /* Anonymisieren: Login unmöglich machen, Historie für Audit erhalten */
    rbac.setStatusEx(id, 'disabled', actor, 'GELÖSCHT: ' + reason);
    audit(actor, 'account.deleted', id + ' (' + acc.username + ') — ' + reason.slice(0, 200), 'success');
    securityEvent('ACCOUNT_DELETED', { ip: reqIp(req), actor, risk: 60, target: acc.username, reason: reason.slice(0, 200) });
    return sendJson(res, 200, { ok: true, deleted: true, note: 'Account anonymisiert & deaktiviert. Bot-Profil (falls vorhanden) bleibt erhalten — DSGVO-Vergesslichkeit separat über „Profil löschen".' });
  }

  /* 🧹 DSGVO-PROFIL LÖSCHEN (kritisch): entfernt das Bot-Profil (LoveUser) +
     LovePlus-Daten (Games/Pets/Achievements) endgültig. */
  if (pathname.startsWith('/api/accounts/') && pathname.endsWith('/profile-delete') && req.method === 'POST') {
    if (!perm(session, 'accounts.manage')) return sendJson(res, 403, { error: 'Keine Berechtigung (accounts.manage).' });
    const id = pathname.split('/')[3];
    const acc = rbac.getAccount(id);
    if (!acc) return sendJson(res, 404, { error: 'Account nicht gefunden.' });
    const body = await readBody(req);
    if (!requireStepUp(req, res, session, body, 'user.profile_deleted')) return;
    const reason = String(body.reason || '').trim();
    if (reason.length < 5) return sendJson(res, 400, { error: 'Grund ist Pflicht (min. 5 Zeichen) — DSGVO-Art.-17-Vorgang.' });
    const found = findProfileByNumber(String(acc.number || ''));
    if (!found) return sendJson(res, 404, { error: 'Kein Bot-Profil für diese Nummer gefunden.' });
    const actor = session.username || maskNumber(session.number);
    try { fs.rmSync(path.join('Database', 'LoveUser', found.bid), { recursive: true, force: true }); } catch (e) { return sendJson(res, 500, { error: 'Profil-Ordner konnte nicht gelöscht werden.' }); }
    try {
      const lp = readLoveplus();
      if (lp.users?.[found.bid]) {
        delete lp.users[found.bid];
        fs.writeFileSync(path.join('Database', 'loveplus.json'), JSON.stringify(lp, null, 2), 'utf8');
      }
    } catch (e) {}
    audit(actor, 'user.profile_deleted', found.bid + ' — ' + reason.slice(0, 200), 'success');
    securityEvent('USER_PROFILE_DELETED', { actor, risk: 45, target: maskNumber(String(acc.number || '')), reason: reason.slice(0, 200) });
    return sendJson(res, 200, { ok: true, deleted: true, bid: found.bid });
  }

  /* 🔔 OWNER-ALERT CENTER: Security-Warnungen aus der Webmail-Queue +
     Read-Status (Database/alert-read.json). */
  if (pathname === '/api/owner-alerts' && req.method === 'GET') {
    if (!perm(session, 'security.view')) return sendJson(res, 403, { error: 'Keine Berechtigung (security.view).' });
    let readIds = [];
    try { readIds = (JSON.parse(fs.readFileSync(path.join('Database', 'alert-read.json'), 'utf8')).read) || []; } catch (e) {}
    const mail = readWebmail();
    const sevOf = (event) => {
      const e = String(event || '');
      if (/ABUSE_AUTO|IP_MANUALLY_BANNED|USER_BANNED|PERM_BLOCK|STEP_UP_REAUTH_FAILED/.test(e)) return 'critical';
      if (/BLOCK|LOGIN|VIOLATION|RESTRICT/.test(e)) return 'warning';
      if (/ESCALAT|BURST/.test(e)) return 'warning';
      return 'notice';
    };
    const alerts = (mail.queue || [])
      .filter((q) => q.type === 'security-owner-alert')
      .map((q) => ({ id: q.id, event: q.event, severity: sevOf(q.event), text: q.text, createdAt: q.createdAt, status: q.status, read: readIds.includes(q.id) }))
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .slice(0, 60);
    return sendJson(res, 200, { ok: true, alerts, unread: alerts.filter((a) => !a.read).length });
  }
  if (pathname === '/api/owner-alerts/read' && req.method === 'POST') {
    if (!perm(session, 'security.view')) return sendJson(res, 403, { error: 'Keine Berechtigung (security.view).' });
    const body = await readBody(req);
    let st = { read: [] };
    try { st = JSON.parse(fs.readFileSync(path.join('Database', 'alert-read.json'), 'utf8')); } catch (e) {}
    const ids = Array.isArray(body.ids) ? body.ids : (body.id ? [body.id] : []);
    for (const i of ids) if (!st.read.includes(i)) st.read.push(i);
    st.read = st.read.slice(-500);
    fs.writeFileSync(path.join('Database', 'alert-read.json'), JSON.stringify(st, null, 2), 'utf8');
    return sendJson(res, 200, { ok: true, marked: ids.length });
  }

  /* 🧩 FEATURE-REGISTRY (Modul-Übersicht / „App Store") */
  if (pathname === '/api/features' && req.method === 'GET') {
    const reg = loadFeatureRegistry();
    return sendJson(res, 200, { ok: true, version: reg.version, updatedAt: reg.updatedAt, updatedBy: reg.updatedBy, features: reg.features });
  }
  if (pathname === '/api/features' && req.method === 'POST') {
    if (!perm(session, 'system.manage')) return sendJson(res, 403, { error: 'Keine Berechtigung (system.manage).' });
    if (!requireStepUp(req, res, session, await readBody(req), 'feature.changed')) return;
    const body = await readBody(req);
    const reg = loadFeatureRegistry();
    const key = String(body.id || '').slice(0, 40);
    if (!reg.features[key]) return sendJson(res, 404, { error: 'Unbekanntes Modul: ' + key });
    const reason = String(body.reason || '').trim();
    if (reason.length < 5) return sendJson(res, 400, { error: 'Grund ist Pflicht (min. 5 Zeichen).' });
    const before = { ...reg.features[key] };
    if (FEATURE_STATUSES.includes(body.status)) reg.features[key].status = body.status;
    if (FEATURE_AUDIENCES.includes(body.audience)) reg.features[key].audience = body.audience;
    const saved = saveFeatureRegistry(session.username || session.number, reason);
    securityEvent('FEATURE_FLAG_CHANGED', { actor: session.username || session.number, risk: 30, feature: key, from: before.status, to: reg.features[key].status, audience: reg.features[key].audience, reason: reason.slice(0, 200) });
    return sendJson(res, 200, { ok: true, version: saved.version, feature: saved.features[key], before });
  }

  if (pathname === '/api/accounts/create' && req.method === 'POST') {
    if (!perm(session, 'accounts.manage')) return sendJson(res, 403, { error: 'Keine Berechtigung.' });
    const body = await readBody(req);
    const role = String(body.role || 'user');
    if (!rbac.canAssignRole(roleOf(session), role)) return sendJson(res, 403, { error: 'Diese Rolle darfst du nicht vergeben.' });
    const res2 = rbac.createAccount({ username: body.username, number: body.number, role, mustChange: true });
    audit(session.username || maskNumber(session.number), 'account.create', res2.account.username, 'success');
    /* ⚠️ tempPassword nur EINMAL in dieser Response — nicht speichern, nicht loggen */
    return sendJson(res, 200, { ok: true, account: { id: res2.account.id, username: res2.account.username, role }, tempPassword: res2.tempPassword });
  }

  if (pathname === '/api/accounts/role' && req.method === 'POST') {
    if (!perm(session, 'roles.assign')) return sendJson(res, 403, { error: 'Keine Berechtigung (roles.assign).' });
    const body = await readBody(req);
    const target = rbac.getAccount(String(body.id || ''));
    if (!target) return sendJson(res, 404, { error: 'Account nicht gefunden.' });
    if (!rbac.canAssignRole(roleOf(session), String(body.role || ''))) {
      securityEvent('PERMISSION_DENIED', { ip: reqIp(req), actor: session.username || session.number, risk: 20 });
      return sendJson(res, 403, { error: 'Diese Rolle darfst du nicht vergeben.' });
    }
    /* 🔐 Kritisch: Beförderung auf Admin-Ebene oder höher verlangt eine
       erneute Passwortbestätigung (Step-up-Reauth). */
    const targetLevel = rbac.ROLES[String(body.role)]?.level ?? 0;
    if (targetLevel >= 70 && !requireStepUp(req, res, session, body, 'role.change.critical')) return;
    if (!body.reason || !String(body.reason).trim()) return sendJson(res, 400, { error: 'Bitte gib einen Grund für die Rollenänderung an.' });
    const ch = rbac.setRole(target.id, String(body.role), session.username || session.number);
    audit(session.username || maskNumber(session.number), 'role.change', target.username + ': ' + ch.old + '→' + ch.role + ' — ' + String(body.reason).slice(0, 200), 'success');
    return sendJson(res, 200, { ok: true, ...ch });
  }

  /* 🎛️ Einzelrechte gezielt gewähren/entziehen — zusätzlich zur Rolle.
     Verlangt IMMER einen Grund (Vorher/Nachher wird unveränderlich in
     acc.permsHistory protokolliert). */
  if (pathname === '/api/accounts/perms' && req.method === 'POST') {
    if (!perm(session, 'roles.assign')) return sendJson(res, 403, { error: 'Keine Berechtigung (roles.assign).' });
    const body = await readBody(req);
    const target = rbac.getAccount(String(body.id || ''));
    if (!target) return sendJson(res, 404, { error: 'Account nicht gefunden.' });
    if (!body.reason || !String(body.reason).trim()) return sendJson(res, 400, { error: 'Bitte gib einen Grund an.' });
    const hasCritical = [...(body.grant || []), ...(body.revoke || [])].some((p) => rbac.PERMISSIONS.find((x) => x.id === p)?.critical);
    if (hasCritical && !requireStepUp(req, res, session, body, 'perms.critical')) return;
    const r = rbac.setPermsOverride(target.id, { grant: body.grant || [], revoke: body.revoke || [] }, session.username || session.number, body.reason);
    if (r.error) return sendJson(res, 400, { error: r.error === 'owner_protected' ? 'Owner-Accounts sind geschützt.' : 'Unbekannter Account.' });
    audit(session.username || maskNumber(session.number), 'perms.change', target.username + ' — ' + String(body.reason).slice(0, 200), 'success');
    return sendJson(res, 200, { ok: true, ...r });
  }

  /* 📦 Rechte-Vorlage anwenden (additiv, z. B. "Security-Team"). */
  if (pathname === '/api/accounts/template' && req.method === 'POST') {
    if (!perm(session, 'roles.assign')) return sendJson(res, 403, { error: 'Keine Berechtigung (roles.assign).' });
    const body = await readBody(req);
    const target = rbac.getAccount(String(body.id || ''));
    if (!target) return sendJson(res, 404, { error: 'Account nicht gefunden.' });
    const r = rbac.applyPermTemplate(target.id, String(body.template || ''), session.username || session.number, body.reason);
    if (r.error) return sendJson(res, 400, { error: 'Unbekannte Vorlage oder geschützter Account.' });
    audit(session.username || maskNumber(session.number), 'perms.template', target.username + ' — ' + String(body.template || ''), 'success');
    return sendJson(res, 200, { ok: true, ...r });
  }

  /* ⚠️ Granulare Feature-Einschränkungen für Status "eingeschränkt". */
  if (pathname === '/api/accounts/restrictions' && req.method === 'POST') {
    if (!perm(session, 'accounts.manage')) return sendJson(res, 403, { error: 'Keine Berechtigung.' });
    const body = await readBody(req);
    const target = rbac.getAccount(String(body.id || ''));
    if (!target) return sendJson(res, 404, { error: 'Account nicht gefunden.' });
    if (!body.reason || !String(body.reason).trim()) return sendJson(res, 400, { error: 'Bitte gib einen Grund an.' });
    const r = rbac.setRestrictions(target.id, body.restrictions || [], session.username || session.number, body.reason);
    if (r.error) return sendJson(res, 400, { error: 'Account nicht gefunden.' });
    audit(session.username || maskNumber(session.number), 'account.restrictions', target.username + ' — ' + String(body.reason).slice(0, 200), 'success');
    return sendJson(res, 200, { ok: true, ...r });
  }

  if (pathname === '/api/accounts/status' && req.method === 'POST') {
    if (!perm(session, 'accounts.manage')) return sendJson(res, 403, { error: 'Keine Berechtigung.' });
    const body = await readBody(req);
    const target = rbac.getAccount(String(body.id || ''));
    if (!target) return sendJson(res, 404, { error: 'Account nicht gefunden.' });
    if (target.role === 'owner' && roleOf(session) !== 'owner') return sendJson(res, 403, { error: 'Owner-Accounts sind geschützt.' });
    const nextStatus = rbac.STATUSES[String(body.status)] ? String(body.status) : (body.status === 'locked' ? 'locked' : 'active');
    if (!body.reason || !String(body.reason).trim()) return sendJson(res, 400, { error: 'Bitte gib einen Grund für die Statusänderung an.' });
    /* 🔐 Kritisch: dauerhaftes Deaktivieren oder Sperren eines Owner-Accounts
       verlangt Step-up-Reauth. */
    const isCritical = nextStatus === 'disabled' || (nextStatus === 'locked' && target.role === 'owner');
    if (isCritical && !requireStepUp(req, res, session, body, nextStatus === 'disabled' ? 'account.status.disabled' : 'account.status.locked.owner')) return;
    const r = rbac.setStatusEx(target.id, nextStatus, session.username || session.number, body.reason);
    if (r.error) return sendJson(res, 400, { error: r.error === 'no_change' ? 'Status ist bereits so gesetzt.' : 'Unbekannter Status.' });
    /* aktive Sessions des Accounts sofort widerrufen, außer bei "aktiv"/"eingeschränkt" */
    if (nextStatus === 'locked' || nextStatus === 'disabled' || nextStatus === 'pending') {
      for (const [tok, sv] of [...sessions]) {
        if (sv.number === target.number) sessions.delete(tok);
      }
      saveSessions();
    }
    audit(session.username || maskNumber(session.number), 'account.status.' + nextStatus, target.username + ' — ' + String(body.reason).slice(0, 200), 'success');
    securityEvent('ACCOUNT_STATUS_CHANGED', { ip: reqIp(req), actor: session.username || maskNumber(session.number), target: target.username, from: r.before, to: nextStatus, reason: String(body.reason).slice(0, 200), risk: isCritical ? 30 : 10 });
    return sendJson(res, 200, { ok: true, before: r.before, after: nextStatus });
  }

  if (pathname === '/api/account' && req.method === 'GET') {
    if (!session) return sendJson(res, 401, { error: 'nicht eingeloggt' });
    const acc = rbac.getAccountByNumber(session.number);
    return sendJson(res, 200, {
      ok: true,
      account: acc ? {
        id: acc.id, username: acc.username, role: acc.role, status: acc.status,
        scope: acc.scope, createdAt: acc.createdAt, lastLoginAt: acc.lastLoginAt,
        mustChange: !!acc.mustChange, number: maskNumber(acc.number),
        roleHistory: (acc.roleHistory || []).slice(-8)
      } : null,
      perms: rbac.permsOf(roleOf(session))
    });
  }

  if (pathname === '/api/account/password' && req.method === 'POST') {
    if (!session) return sendJson(res, 401, { error: 'nicht eingeloggt' });
    const body = await readBody(req);
    const acc = rbac.getAccountByNumber(session.number);
    if (!acc) return sendJson(res, 404, { error: 'Kein Account verknüpft.' });
    /* Erstlogin mit Temp-Passwort: frische 2FA-Session gilt als vertrauenswürdig */
    const freshTemp = acc.mustChange === true && String(body.old || '') === '';
    if (!freshTemp && !rbac.verifyPassword(String(body.old || ''), acc.salt, acc.hash)) {
      return sendJson(res, 400, { error: 'Altes Passwort falsch.' });
    }
    const np = String(body.new || '');
    if (np.length < 8) return sendJson(res, 400, { error: 'Neues Passwort: mind. 8 Zeichen.' });
    rbac.changePassword(acc.id, np);
    audit(acc.username, 'password.changed', 'web', 'success');
    return sendJson(res, 200, { ok: true });
  }

  if (pathname === '/api/account/sessions' && req.method === 'GET') {
    if (!session) return sendJson(res, 401, { error: 'nicht eingeloggt' });
    const mine = [...sessions.entries()]
      .filter(([, sv]) => sv.number === session.number)
      .map(([tok, sv]) => ({
        tokenHint: tok.slice(0, 6) + '…',
        createdAt: sv.createdAt,
        lastSeenAt: sv.lastSeenAt || sv.createdAt,
        ip: maskIp(sv.lastIp || ''),
        userAgent: sv.userAgent || '',
        current: tok === session.token
      }));
    return sendJson(res, 200, { ok: true, sessions: mine });
  }

  /* 🖥️ Owner/Deputy: ALLE aktiven Dashboard-Sessions systemweit einsehen —
     mit IP, User-Agent, Nutzer, Erstellt/Zuletzt gesehen. Wie das
     Geräte/Verbindungs-Panel einer Fritzbox, aber für Login-Sessions. */
  /* 🔑 Reauth-Verify: prüft das aktuelle (Admin-)Passwort ohne Nebenwirkung
     und vermerkt auf der Session ein frisches Reauth-Fenster. Wird z. B. vom
     Owner-Gate der Login-Sessions-Seite genutzt. */
  if (pathname === '/api/reauth/verify' && req.method === 'POST') {
    const body = await readBody(req);
    const pw = String(body.reauth || '');
    if (!pw) return sendJson(res, 401, { error: 'Passwort fehlt.', needsReauth: true, action: 'reauth.verify' });
    if (!verifyReauth(session, pw)) {
      securityEvent('STEP_UP_REAUTH_FAILED', { ip: reqIp(req), actor: session.username || maskNumber(session.number), action: 'reauth.verify', risk: 35 });
      logAdminAction(session.username || maskNumber(session.number), 'reauth.failed', 'reauth.verify', { ip: maskIp(reqIp(req)) });
      return sendJson(res, 401, { error: 'Passwort falsch.', needsReauth: true, action: 'reauth.verify' });
    }
    const sv = sessions.get(session.token) || null;
    const tokenForMark = (() => {
      const auth = req.headers.authorization || '';
      return auth.startsWith('Bearer ') ? auth.slice(7) : new URL('http://x' + req.url).searchParams.get('token');
    })();
    const sve = sessions.get(tokenForMark);
    if (sve) { sve.lastReauthAt = Date.now(); saveSessions(); }
    securityEvent('STEP_UP_REAUTH_OK', { ip: reqIp(req), actor: session.username || maskNumber(session.number), action: 'reauth.verify', risk: 5 });
    logAdminAction(session.username || maskNumber(session.number), 'reauth.ok', 'reauth.verify', { ip: maskIp(reqIp(req)) });
    return sendJson(res, 200, { ok: true });
  }

  if (pathname === '/api/sessions/all' && req.method === 'GET') {
    if (roleOf(session) !== 'owner') return sendJson(res, 403, { error: 'Nur der Owner darf Login-Sessions sehen.' });
    /* 👑 Owner-Gate: Die Übersicht der Login-Sessions (wer ist wo eingeloggt)
       ist eine heikle Ansicht — sie öffnet sich nur mit frisch eingegebenem
       Admin-Passwort (Reauth-Fenster 5 Minuten). Nicht-Owner sehen sie gemäß
       ihrer eigenen Permission weiterhin normal. */
    const gateFor = (acc => acc ? acc.role : (session.role || ''))(rbac.getAccountByNumber(session.number));
    const freshReauth = session.lastReauthAt && (Date.now() - session.lastReauthAt) < 5 * 60 * 1000;
    if (gateFor === 'owner' && !freshReauth) {
      return sendJson(res, 401, { error: 'Bitte bestätige dich mit deinem Admin-Passwort, um die Login-Sessions zu sehen.', needsReauth: true, action: 'sessions.view' });
    }
    const canManage = perm(session, 'sessions.control');
    const list = [...sessions.entries()].map(([tok, sv]) => ({
      tokenHint: tok.slice(0, 10) + '…',
      token: canManage ? tok : undefined,
      number: maskNumber(sv.number), username: sv.username || sv.name, role: sv.role,
      createdAt: sv.createdAt, lastSeenAt: sv.lastSeenAt || sv.createdAt,
      ip: canManage ? (sv.lastIp || '') : maskIp(sv.lastIp || ''),
      ipChanged: !!sv.prevIp && sv.prevIp !== sv.lastIp,
      userAgent: sv.userAgent || '',
      current: tok === session.token
    })).sort((a, b) => new Date(b.lastSeenAt) - new Date(a.lastSeenAt));
    return sendJson(res, 200, { ok: true, sessions: list });
  }

  /* ⏹️ Owner/Deputy: eine einzelne Session gezielt beenden.
     Kritisch genug für eine erneute Passwort-Bestätigung (Admin-Passwort). */
  if (pathname === '/api/sessions/kill' && req.method === 'POST') {
    if (roleOf(session) !== 'owner') return sendJson(res, 403, { error: 'Nur der Owner darf Sessions beenden.' });
    const body = await readBody(req);
    if (!requireStepUp(req, res, session, body, 'sessions.kill')) return;
    const tok = String(body.token || '');
    const sv = sessions.get(tok);
    if (!sv) return sendJson(res, 404, { error: 'Session nicht gefunden.' });
    sessions.delete(tok);
    saveSessions();
    audit(session.username || maskNumber(session.number), 'sessions.kill', maskNumber(sv.number) + ' (' + (sv.username || sv.name) + ')', 'success');
    logAdminAction(session.username || maskNumber(session.number), 'websessions.kill', maskNumber(sv.number) + ' (' + (sv.username || sv.name) + ')', { ip: maskIp(reqIp(req)) });
    securityEvent('SESSION_KILLED', { ip: reqIp(req), actor: session.username || maskNumber(session.number), target: maskNumber(sv.number), risk: 10 });
    return sendJson(res, 200, { ok: true });
  }

  /* ⏹️⏹️ Owner/Deputy: ALLE Sessions einer bestimmten IP beenden (z. B.
     nach einer Sperrung dieser IP) — kritisch, verlangt Step-up-Reauth. */
  if (pathname === '/api/sessions/kill-ip' && req.method === 'POST') {
    if (roleOf(session) !== 'owner') return sendJson(res, 403, { error: 'Nur der Owner darf IP-Sessions beenden.' });
    const body = await readBody(req);
    if (!requireStepUp(req, res, session, body, 'sessions.kill_ip')) return;
    const targetIp = String(body.ip || '').trim();
    if (!targetIp) return sendJson(res, 400, { error: 'IP fehlt.' });
    let n = 0;
    for (const [tok, sv] of [...sessions]) {
      if (sv.lastIp === targetIp) { sessions.delete(tok); n++; }
    }
    if (n) saveSessions();
    audit(session.username || maskNumber(session.number), 'sessions.kill_ip', maskIp(targetIp) + ' — ' + n + ' Sessions', 'success');
    logAdminAction(session.username || maskNumber(session.number), 'websessions.kill_ip', maskIp(targetIp), { killed: n, ip: maskIp(reqIp(req)) });
    securityEvent('SESSIONS_KILLED_FOR_IP', { ip: targetIp, actor: session.username || maskNumber(session.number), count: n, risk: 25 });
    return sendJson(res, 200, { ok: true, killed: n });
  }

  /* ⛔ Owner: JEDE aktive Session im gesamten Dashboard beenden (Notfall) —
     kritisch, verlangt Step-up-Reauth + Bestätigungswort. */
  if (pathname === '/api/sessions/kill-all' && req.method === 'POST') {
    if (roleOf(session) !== 'owner') return sendJson(res, 403, { error: 'Nur der Owner darf alle Sessions beenden.' });
    const body = await readBody(req);
    if (String(body.confirm || '') !== 'ALLE SESSIONS') return sendJson(res, 400, { error: 'Bestätigung fehlt: Erwartet "ALLE SESSIONS".' });
    if (!requireStepUp(req, res, session, body, 'sessions.kill_all')) return;
    let n = 0;
    for (const [tok] of [...sessions]) { if (tok !== session.token) { sessions.delete(tok); n++; } }
    saveSessions();
    audit(session.username || maskNumber(session.number), 'sessions.kill_all', String(n) + ' Sessions', 'success');
    logAdminAction(session.username || maskNumber(session.number), 'websessions.kill_all', String(n) + ' Sessions', { ip: maskIp(reqIp(req)) });
    securityEvent('ALL_SESSIONS_KILLED', { actor: session.username || maskNumber(session.number), count: n, risk: 40 });
    return sendJson(res, 200, { ok: true, killed: n });
  }

  if (pathname === '/api/account/revoke' && req.method === 'POST') {
    if (!session) return sendJson(res, 401, { error: 'nicht eingeloggt' });
    const body = await readBody(req);
    let n = 0;
    for (const [tok, sv] of [...sessions]) {
      if (sv.number === session.number && (body.all === true || tok === String(body.token))) {
        if (tok === session.token && !body.all) continue; /* eigene Session bleibt */
        sessions.delete(tok); n++;
      }
    }
    saveSessions();
    audit(session.username || maskNumber(session.number), 'sessions.revoked', String(n), 'success');
    return sendJson(res, 200, { ok: true, revoked: n });
  }

  return sendJson(res, 404, { error: 'Unbekannte API-Route.' });
}

/* ---------- Echte Befehls-Übersicht (wie im Bot) ---------------------- */
/* 📚 Ab jetzt SINGLE SOURCE OF TRUTH: registry/commands.json (commandRegistry.js).
   Bot-Help ($help), Website (/api/commands), Tester und Doku lesen alle hieraus.
   Migration: scripts/migrate-commands.mjs · Drift-Check: scripts/registry-sync.mjs */
const COMMAND_CATEGORIES = CommandRegistry.getCategories();


/* Heute-Zuwächse für die Overview-Karten (+X heute) */
function overviewDeltas(db) {
  const today = new Date().toISOString().slice(0, 10);
  let users = 0, groups = 0;
  for (const u of Object.values(db.users || {})) {
    if (String(u?.registration?.registeredAt || '').startsWith(today)) users++;
  }
  for (const g of Object.values(db.groups || {})) {
    if (String(g?.setupAt || '').startsWith(today)) groups++;
  }
  return { users, groups };
}

/* ---------- Server ------------------------------------------------------ */
const server = http.createServer(async (req, res) => {
  try {
    /* 🛡️ Nur die tatsächlich benötigten HTTP-Methoden erlauben. TRACE/
       CONNECT/TRACK sind historische XST-Angriffsvektoren (Cross-Site
       Tracing) und werden hier grundsätzlich abgelehnt, auch für
       statische Dateien. */
    if (!['GET', 'POST', 'OPTIONS', 'HEAD'].includes(req.method)) {
      res.writeHead(405, Object.assign({ 'Content-Type': 'text/plain; charset=utf-8', 'Allow': 'GET, POST, OPTIONS, HEAD' }, SECURITY_HEADERS));
      return res.end('405 — Method Not Allowed');
    }
    const url = new URL('http://x' + req.url);

    /* 🌊 Auto-Abuse-Eskalation läuft auf JEDER Anfrage (auch statische
       Seiten wie /index.html) — reines Neuladen ohne API-Zugriff soll
       genauso erkannt werden wie API-Missbrauch. */
    recordAbuseCheck(reqIp(req));

    /* 🖥️ Terminal: JEDE API-Anfrage wird nach Abschluss als schöne Zeile
       geloggt (Status, Methode, Route, Dauer) — zusätzlich in server.log. */
    if (url.pathname.startsWith('/api/')) {
      const _t0 = Date.now();
      const _m = String(req.method || 'GET');
      const _r = url.pathname;
      const _origEnd = res.end.bind(res);
      res.end = (...a) => {
        try { apiTermLine(_m, _r, res.statusCode || 200, Date.now() - _t0); } catch (e) {}
        return _origEnd(...a);
      };
    }
    if (url.pathname.startsWith('/api/')) {
      return await handleApi(req, res, url.pathname);
    }
    return serveStatic(req, res, url.pathname);
  } catch (err) {
    return sendJson(res, 500, { error: String(err?.message || err) });
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} ist bereits belegt. Starte den Server mit PORT=7778 (PowerShell: $env:PORT=7778; node server.js).`);
  } else {
    console.error('Dashboard-Server konnte nicht gestartet werden:', err);
  }
  process.exitCode = 1;
});

server.listen(PORT, HOST, () => {
  /* 📡 Alle Heartbeats (main + weitere Instanzen) in die Registry übernehmen
     und laufend aktuell halten */
  try { SessionManager.adoptAllHeartbeats(); } catch (e) {}
  setInterval(() => {
    try { SessionManager.adoptAllHeartbeats(); } catch (e) {}
  }, 15000);
  try { rotateServerLog(); } catch (e) {}
  /* ═══════════════  LOVEBOT WEB — schönes Boot-Banner  ═══════════════ */
  const _ln = '─'.repeat(54);
  const _when = new Date().toLocaleString('de-DE');
  const _acc = (() => { try { return rbac.listAccounts().length; } catch (e) { return 0; } })();
  const _fleet = (() => { try { return SessionManager.fleetStats(); } catch (e) { return {}; } })();
  termWrite('');
  termWrite(`${TERM.pink}  ╭${_ln}╮${TERM.reset}`);
  termWrite(`${TERM.pink}  │${TERM.reset}${TERM.bold}${TERM.pink}               ☾  L O V E B O T  ·  W E B`.padEnd(55) + `${TERM.pink}│${TERM.reset}`);
  termWrite(`${TERM.pink}  │${TERM.reset}${TERM.dim}                        midnight control`.padEnd(55) + `${TERM.pink}│${TERM.reset}`);
  termWrite(`${TERM.pink}  ├${_ln}┤${TERM.reset}`);
  termWrite(`${TERM.pink}  │${TERM.reset}${TERM.dim}   💜  ${_when}`.padEnd(55) + `${TERM.pink}│${TERM.reset}`);
  termWrite(`${TERM.pink}  │${TERM.reset}${TERM.dim}   node ${process.version} · ${process.platform} · dashboard`.padEnd(55) + `${TERM.pink}│${TERM.reset}`);
  termWrite(`${TERM.pink}  ╰${_ln}╯${TERM.reset}`);
  termWrite('');
  termWrite(`${TERM.cyan}  🌐  http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}${TERM.reset}`);
  termWrite(`${TERM.grey}  🔐  Login: erst WhatsApp-Code (2FA), dann Passwort · Gate: Admin-Passwort (getrennt)${TERM.reset}`);
  termWrite(`${TERM.grey}  👑  Owner: ${OWNER_NUMBER}  ·  Panel-Accounts: ${_acc}  ·  Sessions live: ${_fleet.running || 0}/${_fleet.managed || 0}${TERM.reset}`);
  termWrite(`${TERM.grey}  📋  Jede API-/Audit-/Security-Aktion wird hier & nach Logs/server.log geschrieben.${TERM.reset}`);
  termWrite('');
  termLog('BOOT', 'Dashboard-Webserver gestartet (Port ' + PORT + ').');
});

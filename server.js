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
import crypto from 'crypto';
import * as rbac from './night/rbac.js';
import * as SessionManager from './sessionManager.js';
import * as CommandRegistry from './commandRegistry.js';
import { getMaintenance, setMaintenanceOn, setMaintenanceOff } from './night/maintenance.js';
import * as SecurityCases from './night/security-cases.js';
import { migrateRegistration, isMinor, cityLabel, ageLabel, publicProfileAllowed } from './privacy.js';

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
}
function securityEvent(event, extra) {
  chainAppend(SECURITY_FILE, Object.assign({ event }, extra || {}));
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
function verifyReauth(session, password) {
  if (!session) return false;
  const pw = String(password || '');
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
    sendJson(res, 401, { error: 'Passwort falsch.', needsReauth: true, action: actionLabel });
    return false;
  }
  securityEvent('STEP_UP_REAUTH_OK', { ip: reqIp(req), actor: session.username || maskNumber(session.number), action: actionLabel, risk: 5 });
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
      securityEvent('IP_BLOCKED', { ip, risk: Math.min(95, 40 + entry.count * 3), reason: reason || 'Zu viele Fehlversuche', fails: entry.count, blockMinutes: Math.round(hit.blockMs / 60000) });
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
  manualIpBans.set(ip, { reason: reason || 'Vom Owner gesperrt', bannedAt: new Date().toISOString(), bannedBy: bannedBy || 'owner' });
  saveManualIpBans();
  securityEvent('IP_MANUALLY_BANNED', { ip, risk: 80, reason: reason || 'Vom Owner gesperrt', by: bannedBy });
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
const ABUSE_BURST_WINDOW_MS = 10 * 1000;          /* 10 Sek. Beobachtungsfenster */
const ABUSE_BURST_THRESHOLD = 50;                 /* > 50 Anfragen/10s einer IP = auffällig */
const ABUSE_VIOLATION_DECAY_MS = 30 * 60 * 1000;  /* Verstöße verjähren nach 30 Min Ruhe */
const ABUSE_TIERS = [
  { atViolations: 2, action: 'TEMP_BLOCK', blockMs: 5 * 60 * 1000, label: '5 Minuten' },
  { atViolations: 4, action: 'LONG_BLOCK', blockMs: 60 * 60 * 1000, label: '1 Stunde' },
  { atViolations: 6, action: 'PERM_BLOCK', blockMs: null, label: 'dauerhaft (manuelle Prüfung nötig)' }
];
const abuseBursts = new Map();     /* ip -> { count, windowStart, tier1Logged } */
const abuseViolations = new Map(); /* ip -> { count, lastAt } */

function recordAbuseCheck(ip) {
  if (!ip) return;
  const now = Date.now();

  let burst = abuseBursts.get(ip);
  if (!burst || burst.windowStart + ABUSE_BURST_WINDOW_MS < now) {
    burst = { count: 0, windowStart: now, tier1Logged: false };
    abuseBursts.set(ip, burst);
  }
  burst.count++;
  if (burst.count <= ABUSE_BURST_THRESHOLD) return;
  if (burst.tier1Logged) return; /* pro Zeitfenster nur 1x eskalieren/loggen */
  burst.tier1Logged = true;

  let viol = abuseViolations.get(ip);
  if (!viol || viol.lastAt + ABUSE_VIOLATION_DECAY_MS < now) {
    viol = { count: 0, lastAt: now };
  }
  viol.count++;
  viol.lastAt = now;
  abuseViolations.set(ip, viol);

  securityEvent('ABUSE_BURST_DETECTED', {
    ip, risk: Math.min(90, 25 + viol.count * 10),
    reason: 'Ungewöhnlich viele Anfragen in kurzer Zeit (Reload-/Request-Flut)',
    requestsInWindow: burst.count, windowSec: ABUSE_BURST_WINDOW_MS / 1000, violationCount: viol.count
  });

  let hitTier = null;
  for (const t of ABUSE_TIERS) if (viol.count >= t.atViolations) hitTier = t;
  if (!hitTier) return; /* 1. Verstoß: nur Warnung/Log, noch keine Sperre */

  if (hitTier.action === 'PERM_BLOCK') {
    if (!isManuallyBanned(ip)) {
      manualBanIp(ip, `Automatisch gesperrt: wiederholte Reload-/Request-Flut (${viol.count}. Verstoß in ${ABUSE_VIOLATION_DECAY_MS / 60000} Min) — bitte manuell prüfen`, 'auto-security-system');
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
    }
  }
}
/* Aufräumen alter Einträge, damit die Maps nicht unbegrenzt wachsen */
setInterval(() => {
  const now = Date.now();
  for (const [ip, b] of abuseBursts) if (b.windowStart + ABUSE_BURST_WINDOW_MS < now) abuseBursts.delete(ip);
  for (const [ip, v] of abuseViolations) if (v.lastAt + ABUSE_VIOLATION_DECAY_MS < now) abuseViolations.delete(ip);
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
    return res.end('403 — Deine IP-Adresse wurde vom Betreiber gesperrt.');
  }
  const staticBlock = !staticBypass && isIpBlocked(clientIpStatic);
  if (staticBlock) {
    securityEvent('IP_BLOCKED_STATIC_DENIED', { ip: clientIpStatic, risk: 55, path: urlPath });
    res.writeHead(429, Object.assign({ 'Content-Type': 'text/plain; charset=utf-8', 'Retry-After': String(Math.max(1, Math.round((staticBlock.until - Date.now()) / 1000))) }, SECURITY_HEADERS));
    return res.end('429 — Deine IP-Adresse wurde vorübergehend gesperrt: ' + (staticBlock.reason || 'Zu viele Anfragen') + '. Bitte später erneut versuchen.');
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
    res.writeHead(200, Object.assign({ 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' }, SECURITY_HEADERS));
    res.end(buf);
  });
}

/* ---------- API-Routen -------------------------------------------------- */
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
      return sendJson(res, 403, { error: 'Deine IP-Adresse wurde vom Betreiber gesperrt.', ipBanned: true });
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
        return sendJson(res, 429, {
          error: 'Deine IP-Adresse wurde wegen zu vieler Fehlversuche vorübergehend gesperrt.',
          ipBlocked: true,
          retryAfterSec: Math.max(0, Math.round((blocked.until - Date.now()) / 1000))
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
          profiles.push({
            name: prof?.registration?.name || prof?.identity?.username || maskNumGlobal(bid.split('jid')[0]),
            level: prof?.progression?.level || 0,
            xp: prof?.progression?.xp || 0,
            copper: prof?.wallet?.copper || 0
          });
        } catch (e) {}
      }
    } catch (e) {}
    const lp = readLoveplusGlobal();
    const couples = Object.values(lp.couples || {});
    return sendJson(res, 200, {
      topLevel: profiles.slice().sort((a, b) => (b.xp || 0) - (a.xp || 0)).slice(0, 10)
        .map((p) => ({ name: p.name, level: p.level, xp: p.xp })),
      topRich: profiles.slice().sort((a, b) => (b.copper || 0) - (a.copper || 0)).slice(0, 10)
        .map((p) => ({ name: p.name, copper: p.copper })),
      topCouples: couples.slice().sort((a, b) => (b.loveXp || 0) - (a.loveXp || 0)).slice(0, 10)
        .map((c) => ({ n1: safeDisplayName(c.n1) || '💜', n2: safeDisplayName(c.n2) || '💜', loveXp: c.loveXp || 0, level: c.level || 1, streak: c.streak || 0 })),
      generatedAt: new Date().toISOString()
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
          fleet: SessionManager.fleetStats()
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
      topRich: profiles.sort((a, b) => b.copper - a.copper).slice(0, 10)
        .map((x) => ({ name: x.name || maskNum(x.bid.split('_')[0]), copper: x.copper, level: x.level })),
      topCouples: couples.sort((a, b) => (b.loveXp || 0) - (a.loveXp || 0)).slice(0, 10)
        .map((c) => ({ n1: c.n1 || '?', n2: c.n2 || '?', loveXp: c.loveXp || 0 })),
      activity: SessionManager.recentActivity(20),
      audit: SessionManager.recentAudit(20)
    });
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
    return sendJson(res, 200, {
      users: Object.keys(db.users || {}).length,
      groups: Object.keys(db.groups || {}).length,
      bans: Object.keys(db.bans || {}).length,
      webusers: Object.keys(db.meta?.webusers || {}).length,
      owners: (db.meta?.owners || []).length,
      badwordsAdded: (db.meta?.badwords?.added || []).length,
      heartbeat: readHeartbeat(),
      fleet,
      commands: commandStats,
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
  if (pathname === '/api/groups/toggle' && req.method === 'POST') {
    if (session.role !== 'owner') return sendJson(res, 403, { error: 'Nur der Owner.' });
    const body = await readBody(req);
    const { gid, key, on } = body;
    const allowed = ['autodl', 'welcome', 'goodbye', 'badwords', 'antilink', 'active'];
    if (!gid || !allowed.includes(key)) return sendJson(res, 400, { error: 'Ungültig.' });
    const db = readDb();
    if (!db.groups[gid]) db.groups[gid] = {};
    db.groups[gid][key] = on === true;
    writeDb(db);
    return sendJson(res, 200, { ok: true });
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
    const mailboxId = queueModerationNotice('ban', { jid: targetJid, lid: targetLid, number: targetNumber }, reason, session);
    audit(session.username || maskNumber(session.number), 'user.banned', targetJid || targetLid, 'success');
    return sendJson(res, 200, { ok: true, mailboxId });
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
      .sort((a, b) => (b.progression.xp || 0) - (a.progression.xp || 0))
      .slice(0, 10)
      .map((u) => ({ name: u.identity?.username || maskNumber(u.identity?.cleanJid || ''), level: u.progression.level || 0, xp: u.progression.xp || 0, title: u.identity?.title || '' }));
    return sendJson(res, 200, {
      ok: true,
      levels: [
        { lv: 1, title: 'Newbie', icon: '❤️' }, { lv: 5, title: 'Admirer', icon: '💕' },
        { lv: 10, title: 'Romantic', icon: '💗' }, { lv: 20, title: 'Lover', icon: '💞' },
        { lv: 30, title: 'Soulmate', icon: '💘' }, { lv: 50, title: 'Eternal Love', icon: '💎' },
        { lv: 100, title: 'Love Legend', icon: '👑' }
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

  if (pathname === '/api/system' && req.method === 'GET') {
    const mem = process.memoryUsage();
    const os = await import('node:os');
    const cpus = os.cpus() || [];
    const load = os.loadavg ? os.loadavg()[0] : 0;
    const totalMb = Math.round(os.totalmem() / 1048576);
    return sendJson(res, 200, {
      ok: true,
      node: process.version, platform: process.platform, arch: process.arch,
      uptimeSec: Math.round(process.uptime()),
      ramMb: Number((mem.rss / 1048576).toFixed(1)),
      ramTotalMb: totalMb,
      heapMb: Number((mem.heapUsed / 1048576).toFixed(1)),
      cpu: Number((Math.min(100, (load / Math.max(1, cpus.length)) * 100)).toFixed(1)),
      diskPct: 0,
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
    return sendJson(res, 200, {
      ok: true, events,
      threat: (activeBlocks.length || manualBans.length) ? 'HIGH' : events.some((x) => x.risk >= 70) ? 'HIGH' : events.some((x) => x.risk >= 40) ? 'WATCH' : 'LOW',
      alerts: events.filter((x) => x.risk >= 40).length,
      blocked: activeBlocks.length,
      blockedTotal: totalIpBlocksEver,
      blockedIps: activeBlocks.map((b) => ({ ip: canManage ? b.ipFull : b.ip, reason: b.reason, blockedAt: b.blockedAt, fails: b.fails, remainingSec: b.remainingSec })),
      manualBans: manualBans.map((b) => ({ ip: canManage ? b.ipFull : b.ip, reason: b.reason, bannedAt: b.bannedAt, bannedBy: b.bannedBy })),
      manualBansTotal: manualBans.length,
      knownClients: canManage ? listKnownClients().slice(0, 100).map((c) => ({
        ip: c.ipFull, browser: c.browser, os: c.os, device: c.device, isBot: c.isBot,
        firstSeen: c.firstSeen, lastSeen: c.lastSeen, hits: c.hits, lastPath: c.lastPath,
        numbers: c.numbers, banned: isManuallyBanned(c.ipFull), autoBlocked: !!isIpBlocked(c.ipFull)
      })) : [],
      failedLogins: failed
    });
  }

  /* 📊 Owner-Sicherheitsübersicht: 24h-Kennzahlen für ein kompaktes Widget. */
  if (pathname === '/api/security/overview' && req.method === 'GET') {
    if (!perm(session, 'security.view')) return sendJson(res, 403, { error: 'Keine Berechtigung (security.view).' });
    return sendJson(res, 200, { ok: true, ...SecurityCases.overview24h(AUDIT_FILE) });
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
      blockedIps.set(targetIp, { until: Date.now() + mins * 60000, reason: reason + ' (temporär, ' + mins + ' Min., von ' + (session.username || session.number) + ')', blockedAt: new Date().toISOString(), fails: 0, tier: 'MANUAL_TEMP' });
      totalIpBlocksEver++;
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
    if (!isPermanent) securityEvent('IP_MANUALLY_BANNED_TEMP', { ip: targetIp, risk: 50, reason, by: session.username || session.number, killedSessions });
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
  if (pathname === '/api/sessions/all' && req.method === 'GET') {
    if (!perm(session, 'sessions.view')) return sendJson(res, 403, { error: 'Keine Berechtigung (sessions.view).' });
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

  /* ⏹️ Owner/Deputy: eine einzelne Session gezielt beenden. */
  if (pathname === '/api/sessions/kill' && req.method === 'POST') {
    if (!perm(session, 'sessions.control')) return sendJson(res, 403, { error: 'Keine Berechtigung (sessions.control).' });
    const body = await readBody(req);
    const tok = String(body.token || '');
    const sv = sessions.get(tok);
    if (!sv) return sendJson(res, 404, { error: 'Session nicht gefunden.' });
    sessions.delete(tok);
    saveSessions();
    audit(session.username || maskNumber(session.number), 'sessions.kill', maskNumber(sv.number) + ' (' + (sv.username || sv.name) + ')', 'success');
    securityEvent('SESSION_KILLED', { ip: reqIp(req), actor: session.username || maskNumber(session.number), target: maskNumber(sv.number), risk: 10 });
    return sendJson(res, 200, { ok: true });
  }

  /* ⏹️⏹️ Owner/Deputy: ALLE Sessions einer bestimmten IP beenden (z. B.
     nach einer Sperrung dieser IP) — kritisch, verlangt Step-up-Reauth. */
  if (pathname === '/api/sessions/kill-ip' && req.method === 'POST') {
    if (!perm(session, 'sessions.control')) return sendJson(res, 403, { error: 'Keine Berechtigung (sessions.control).' });
    const body = await readBody(req);
    const targetIp = String(body.ip || '').trim();
    if (!targetIp) return sendJson(res, 400, { error: 'IP fehlt.' });
    let n = 0;
    for (const [tok, sv] of [...sessions]) {
      if (sv.lastIp === targetIp) { sessions.delete(tok); n++; }
    }
    if (n) saveSessions();
    audit(session.username || maskNumber(session.number), 'sessions.kill_ip', maskIp(targetIp) + ' — ' + n + ' Sessions', 'success');
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
  console.log('');
  console.log('  💜 ────────────────────────────────────────── 💜');
  console.log('  🌹  L O V E   B O T   —   D A S H B O A R D  🌹');
  console.log('  💜 ────────────────────────────────────────── 💜');
  console.log(`  🌐 http://localhost:${PORT}`);
  console.log('  🔐 Login: erst WhatsApp-Code (2FA), dann Passwort');
  console.log('  👑 Owner: Nummer ' + OWNER_NUMBER);
  console.log('  📲 Andere Nutzer: Registrierung per WhatsApp-Code');
  console.log('');
});

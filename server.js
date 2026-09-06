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
import { migrateRegistration, isMinor, cityLabel, ageLabel, publicProfileAllowed } from './privacy.js';

const PORT = Number.parseInt(process.env.PORT || '3000', 10);
/* sicherer Default: nur lokal. Für LAN/Proxy: HOST=0.0.0.0 setzen */
const HOST = process.env.HOST || '127.0.0.1';
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
  const role = acc ? acc.role : session.role;
  return rbac.can(role, need);
}
function roleOf(session) {
  const acc = session ? rbac.getAccountByNumber(session.number) : null;
  return acc ? acc.role : (session ? session.role : 'user');
}
function reqIp(req) {
  return String(req.socket?.remoteAddress || '').replace('::ffff:', '');
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

function createSession(number, role, name, extra) {
  const token = newToken();
  sessions.set(token, Object.assign({ number, role, name, createdAt: new Date().toISOString() }, extra || {}));
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
  /* ☾ Live-Sync: Rolle immer frisch aus accounts.json; Ban/Lock → Session weg */
  try {
    const acc = rbac.getAccountByNumber(s.number);
    if (acc) {
      if (acc.status !== 'active' || acc.role === 'banned') { sessions.delete(token); saveSessions(); return null; }
      if (acc.role !== s.role && acc.role !== 'owner') { s.role = acc.role; }
      s.scope = acc.scope || s.scope || { type: 'global' };
      s.username = acc.username;
      s.mustChange = !!acc.mustChange;
      s.accountId = acc.id;
    }
    const dbBan = readDb();
    if (findBan(dbBan, s.number)) { sessions.delete(token); saveSessions(); return null; }
  } catch (e) {}
  return { ...s, token };
}

/* ---------- HTTP-Helfer ------------------------------------------------ */
function sendJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'X-XSS-Protection': '0'
  });
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

function serveStatic(req, res, urlPath) {
  let file = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
  const full = path.join('public', file);
  if (!full.startsWith('public')) return sendJson(res, 403, { error: 'Forbidden' });
  fs.readFile(full, (err, buf) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('404 — Nicht gefunden');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' });
    res.end(buf);
  });
}

/* ---------- API-Routen -------------------------------------------------- */
async function handleApi(req, res, pathname) {
  if (req.method === 'OPTIONS') return sendJson(res, 200, { ok: true });

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

    /* 🔐 Ohne gültigen 2FA-loginToken (per WhatsApp-Code) gibt es KEIN Login —
       auch nicht mit korrektem Passwort. Auch nicht für den Owner. */
    const lt = String(body.loginToken || '');
    const ltEntry = loginTokens.get(lt);
    if (!lt || !ltEntry || ltEntry.expires < Date.now() || ltEntry.number !== number) {
      securityEvent('AUTH_2FA_MISSING', { ip: reqIp(req), number: maskNumber(number), risk: 25 });
      audit(maskNumber(number), 'login.denied_no2fa', 'web', 'denied');
      return sendJson(res, 401, { error: '2FA erforderlich: erst Nummer prüfen, dann WhatsApp-Code bestätigen, dann Passwort.', need2fa: true });
    }
    /* Token bleibt bis zum erfolgreichen Passwort-Check gültig (5 min),
       Fehlversuche werden per Rate-Limit begrenzt. */
    if (!checkRateLimit('pw:' + number)) {
      loginTokens.delete(lt);
      securityEvent('AUTH_BRUTE_FORCE', { ip: reqIp(req), number: maskNumber(number), risk: 40 });
      return sendJson(res, 429, { error: 'Zu viele Fehlversuche. Bitte 10 Minuten warten.' });
    }

    /* Der feste Owner-Zugang hat Vorrang vor einem versehentlich als User
       angelegten Account mit derselben WhatsApp-Nummer. 2FA ist bereits geprüft. */
    if (number === OWNER_NUMBER && password === OWNER_PASSWORD) {
      loginTokens.delete(lt);
      const token = createSession(number, 'owner', 'Maxichen 👑');
      audit(maskNumber(number), 'login.owner', 'web', 'success');
      return sendJson(res, 200, { ok: true, token, role: 'owner', name: 'Maxichen 👑' });
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
        securityEvent('AUTH_FAILED', { ip: reqIp(req), number: maskNumber(number), risk: 10 });
        audit(accLogin.username, 'login.failed', 'web', 'denied');
        return sendJson(res, 401, { error: 'Passwort falsch.' });
      }
      loginTokens.delete(lt);
      rbac.touchLogin(accLogin.id);
      const token = createSession(accLogin.number, accLogin.role, accLogin.username, {
        username: accLogin.username, mustChange: !!accLogin.mustChange, scope: accLogin.scope, accountId: accLogin.id
      });
      audit(accLogin.username, 'login.' + accLogin.role, 'web', 'success');
      return sendJson(res, 200, { ok: true, token, role: accLogin.role, name: accLogin.username, mustChange: !!accLogin.mustChange });
    }

    /* 2️ Legacy: Owner + alte webusers */
    if (number === OWNER_NUMBER && password === OWNER_PASSWORD) {
      loginTokens.delete(lt);
      const token = createSession(number, 'owner', 'Maxichen 👑');
      audit(maskNumber(number), 'login.owner', 'web', 'success');
      return sendJson(res, 200, { ok: true, token, role: 'owner', name: 'Maxichen 👑' });
    }

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
      const token = createSession(number, user.role || 'user', user.name || `+${number}`);
      audit(maskNumber(number), 'login.user', 'web', 'success');
      return sendJson(res, 200, { ok: true, token, role: user.role || 'user', name: user.name || `+${number}` });
    }
    securityEvent('AUTH_FAILURE', { ip: reqIp(req), number: maskNumber(number), risk: 10 });
    audit(maskNumber(number), 'login.failed', 'web', 'denied');
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
    const name = String(body.name || '').trim().slice(0, 40);
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
    const token = createSession(setup.number, 'user', name || `+${setup.number}`);
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
      heartbeat: readHeartbeat()
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
    if (password.length < 8) return sendJson(res, 400, { error: 'Passwort muss mindestens 8 Zeichen haben.' });
    if (username.length < 3 || username.length > 18) return sendJson(res, 400, { error: 'Username: 3–18 Zeichen.' });
    if (rbac.getAccountByUsername(username)) return sendJson(res, 400, { error: 'Username vergeben.' });
    setupTokens.delete(body.setupToken);
    const created = rbac.createAccount({ username, number: setup.number, role: 'user', mustChange: false });
    audit(created.account.username, 'account.registered', 'web', 'success');
    const token = createSession(setup.number, 'user', created.account.username, { username: created.account.username, accountId: created.account.id });
    return sendJson(res, 200, { ok: true, token, role: 'user', name: created.account.username });
  }

  /* Der API-Layer nutzt den Heartbeat, um den echten Server vom Demo-Modus
     zu unterscheiden. Diese öffentliche Statusroute darf kein Login verlangen. */
  if (pathname === '/api/heartbeat') {
    return sendJson(res, 200, readHeartbeat());
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
        perms: rbac.permsOf(role), mustChange: !!(acc && acc.mustChange),
        scope: session.scope || { type: 'global' }, username: session.username || null
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
    return sendJson(res, 200, {
      users: Object.keys(db.users || {}).length,
      groups: Object.keys(db.groups || {}).length,
      bans: Object.keys(db.bans || {}).length,
      webusers: Object.keys(db.meta?.webusers || {}).length,
      owners: (db.meta?.owners || []).length,
      badwordsAdded: (db.meta?.badwords?.added || []).length,
      heartbeat: readHeartbeat()
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
    let events = [];
    try {
      events = fs.readFileSync(SECURITY_FILE, 'utf8').trim().split('\n').filter(Boolean)
        .slice(-50).reverse().map((l) => {
          const e = JSON.parse(l);
          return {
            time: new Date(e.time).toLocaleTimeString('de-DE'),
            sev: e.risk >= 70 ? 'CRITICAL' : e.risk >= 40 ? 'SUSPICIOUS' : e.risk >= 20 ? 'WATCH' : 'RESOLVED',
            event: e.event, src: 'web', risk: e.risk || 0,
            action: e.action || 'logged', ip: e.ip || ''
          };
        });
    } catch (e) {}
    const failed = events.filter((x) => /AUTH_FAILURE|2FA_MISSING/.test(x.event)).length;
    return sendJson(res, 200, {
      ok: true, events,
      threat: events.some((x) => x.risk >= 70) ? 'HIGH' : events.some((x) => x.risk >= 40) ? 'WATCH' : 'LOW',
      alerts: events.filter((x) => x.risk >= 40).length,
      blocked: 0, failedLogins: failed
    });
  }

  if (pathname === '/api/audit' && req.method === 'GET') {
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
      scope: a.scope, status: a.status, mustChange: !!a.mustChange,
      createdAt: a.createdAt, lastLoginAt: a.lastLoginAt,
      roleHistory: (a.roleHistory || []).slice(-5)
    }));
    return sendJson(res, 200, { ok: true, accounts: list });
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
    const ch = rbac.setRole(target.id, String(body.role), session.username || session.number);
    audit(session.username || maskNumber(session.number), 'role.change', target.username + ': ' + ch.old + '→' + ch.role, 'success');
    return sendJson(res, 200, { ok: true, ...ch });
  }

  if (pathname === '/api/accounts/status' && req.method === 'POST') {
    if (!perm(session, 'accounts.manage')) return sendJson(res, 403, { error: 'Keine Berechtigung.' });
    const body = await readBody(req);
    const target = rbac.getAccount(String(body.id || ''));
    if (!target) return sendJson(res, 404, { error: 'Account nicht gefunden.' });
    if (target.role === 'owner' && roleOf(session) !== 'owner') return sendJson(res, 403, { error: 'Owner-Accounts sind geschützt.' });
    rbac.setStatus(target.id, body.status === 'locked' ? 'locked' : 'active');
    /* aktive Sessions des Accounts sofort widerrufen */
    for (const [tok, sv] of [...sessions]) {
      if (sv.number === target.number) sessions.delete(tok);
    }
    saveSessions();
    audit(session.username || maskNumber(session.number), 'account.' + (body.status === 'locked' ? 'lock' : 'unlock'), target.username, 'success');
    return sendJson(res, 200, { ok: true });
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
        current: tok === session.token
      }));
    return sendJson(res, 200, { ok: true, sessions: mine });
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
    const url = new URL('http://x' + req.url);
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

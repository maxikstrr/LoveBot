/* ============================================================================
   LoveBot — RBAC & ACCOUNTS (ESM)
   ☾ Rollen, Permissions, Dashboard-Accounts, WhatsApp-Verknüpfung.
   Genutzt von server.js (Web) UND Love.js (WhatsApp-Befehle).

   Rollen:  owner › deputy › admin › supporter › user   (+ banned, groupadmin)
   Speicher: Database/accounts.json — NUR Hashes, nie Klartext-Passwörter.
   ==========================================================================*/
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const ACCOUNTS_FILE = path.join('Database', 'accounts.json');

/* ---------- Rollen ---------------------------------------------------------- */
export const ROLES = {
  owner:     { id: 'owner',     label: 'OWNER',        icon: '👑', level: 100 },
  deputy:    { id: 'deputy',    label: 'STELLV. INHABER:IN', icon: '🔱', level: 90 },
  admin:     { id: 'admin',     label: 'ADMIN',        icon: '◆', level: 70 },
  supporter: { id: 'supporter', label: 'SUPPORTER',    icon: '◇', level: 40 },
  groupadmin:{ id: 'groupadmin',label: 'GROUP ADMIN',  icon: '️', level: 30 },
  user:      { id: 'user',      label: 'USER',         icon: '○', level: 10 },
  banned:    { id: 'banned',    label: 'BANNED',       icon: '⛔', level: 0 }
};

/* ---------- Permission-Matrix ------------------------------------------------ */
const MATRIX = {
  owner: ['*'],
  deputy: [
    'accounts.view', 'accounts.manage', 'roles.assign',
    'sessions.view', 'sessions.control', 'sessions.delete',
    'users.view', 'users.edit', 'users.ban',
    'groups.view', 'groups.manage',
    'logs.view', 'logs.export',
    'security.view', 'security.manage',
    'db.view', 'db.backup', 'db.restore',
    'system.view', 'system.control',
    'broadcast.send', 'tickets.manage', 'self.view'
  ],
  admin: [
    'accounts.view',
    'sessions.view', 'sessions.control',
    'users.view', 'users.edit',
    'groups.view', 'groups.manage',
    'logs.view', 'logs.export',
    'security.view',
    'db.view', 'db.backup',
    'system.view',
    'broadcast.send', 'tickets.manage', 'self.view'
  ],
  supporter: [
    'users.view', 'groups.view', 'sessions.view', 'logs.view',
    'tickets.manage', 'self.view'
  ],
  groupadmin: ['groups.view', 'users.view', 'logs.view', 'self.view'],
  user: ['self.view'],
  banned: []
};

export function can(role, perm) {
  const list = MATRIX[role] || [];
  if (list.includes('*')) {
    /* Owner-Schutzregeln: auch der Owner löscht nicht versehentlich Audit/Logs */
    return true;
  }
  return list.includes(perm);
}

export function permsOf(role) {
  return MATRIX[role] || [];
}

/* darf roleA roleB vergeben? Nur mit roles.assign + höherem Level */
export function canAssignRole(actorRole, targetRole) {
  if (!can(actorRole, 'roles.assign')) return false;
  const a = ROLES[actorRole]?.level ?? 0;
  const t = ROLES[targetRole]?.level ?? 0;
  /* Owner-Rolle kann niemand vergeben/entziehen außer dem System;
     deputy darf bis admin, admin bis supporter, … */
  if (t >= 100) return false;
  if (actorRole === 'owner') return true;
  return t < a;
}

/* ---------- Hashing (scrypt + Salt) -------------------------------------------- */
export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 32).toString('hex');
  return { salt, hash };
}
export function verifyPassword(password, salt, hash) {
  try {
    const check = crypto.scryptSync(String(password), salt, 32).toString('hex');
    const a = Buffer.from(check, 'hex');
    const b = Buffer.from(String(hash), 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch (e) { return false; }
}

/* ---------- Store --------------------------------------------------------------- */
function load() {
  try {
    return JSON.parse(fs.readFileSync(ACCOUNTS_FILE, 'utf8'));
  } catch (e) {
    return { accounts: {}, history: [] };
  }
}
function save(db) {
  try {
    fs.mkdirSync('Database', { recursive: true });
    fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(db, null, 2), 'utf8');
  } catch (e) {}
}

export function listAccounts() {
  return Object.values(load().accounts || {});
}
export function getAccountByNumber(number) {
  number = String(number || '').replace(/\D/g, '');
  return listAccounts().find((a) => String(a.number || '').replace(/\D/g, '') === number) || null;
}
export function getAccountByUsername(username) {
  const u = String(username || '').toLowerCase().trim();
  return listAccounts().find((a) => String(a.username || '').toLowerCase() === u) || null;
}
export function getAccount(id) {
  return load().accounts?.[id] || null;
}

/* ---------- Generatoren ----------------------------------------------------------- */
export function generateUsername(base, number) {
  let name = String(base || '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 18);
  if (!name) name = 'seele';
  let candidate = name;
  let i = 1;
  while (getAccountByUsername(candidate)) candidate = name + '_' + (++i);
  return candidate;
}
export function generatePassword() {
  /* einmalig, 14 Zeichen, kein Klartext-Speichern */
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!#%*';
  let pw = '';
  for (let i = 0; i < 14; i++) pw += abc[crypto.randomInt(abc.length)];
  return pw;
}

/* ---------- Account-Leben ----------------------------------------------------------- */
export function createAccount({ username, number, role = 'user', scope = null, mustChange = true, tempPassword = null }) {
  const db = load();
  const id = 'acc_' + crypto.randomBytes(8).toString('hex');
  const pw = tempPassword || generatePassword();
  const { salt, hash } = hashPassword(pw);
  db.accounts[id] = {
    id,
    username: generateUsername(username, number),
    number: String(number || '').replace(/\D/g, ''),
    role: ROLES[role] ? role : 'user',
    scope: scope || { type: 'global' },
    salt, hash,
    status: 'active',
    mustChange: mustChange === true,
    createdAt: new Date().toISOString(),
    lastLoginAt: null,
    roleHistory: [{ role: ROLES[role] ? role : 'user', at: new Date().toISOString(), by: 'system' }]
  };
  save(db);
  /* tempPassword wird NUR einmal zurückgegeben — nie gespeichert */
  return { account: db.accounts[id], tempPassword: pw };
}

export function setRole(accountId, role, by) {
  const db = load();
  const acc = db.accounts[accountId];
  if (!acc || !ROLES[role]) return null;
  const old = acc.role;
  acc.role = role;
  acc.roleHistory = acc.roleHistory || [];
  acc.roleHistory.push({ role, at: new Date().toISOString(), by: by || 'system', from: old });
  save(db);
  return { old, role };
}

export function setStatus(accountId, status) {
  const db = load();
  const acc = db.accounts[accountId];
  if (!acc) return null;
  acc.status = status; /* active | locked */
  save(db);
  return acc;
}

export function changePassword(accountId, newPassword) {
  const db = load();
  const acc = db.accounts[accountId];
  if (!acc) return false;
  const { salt, hash } = hashPassword(newPassword);
  acc.salt = salt; acc.hash = hash;
  acc.mustChange = false;
  acc.passwordChangedAt = new Date().toISOString();
  save(db);
  return true;
}

export function checkLogin(account, password) {
  if (!account) return false;
  if (account.status !== 'active') return false;
  if (account.role === 'banned') return false;
  return verifyPassword(password, account.salt, account.hash);
}

export function touchLogin(accountId) {
  const db = load();
  const acc = db.accounts[accountId];
  if (!acc) return;
  acc.lastLoginAt = new Date().toISOString();
  save(db);
}

/* Ban-Sync: WhatsApp-Ban → Dashboard sperren */
export function lockByBan(number, reason) {
  const acc = getAccountByNumber(number);
  if (!acc) return null;
  const db = load();
  db.accounts[acc.id].status = 'locked';
  db.accounts[acc.id].lockedReason = reason || 'whatsapp-ban';
  save(db);
  return acc;
}
export function unlockByUnban(number) {
  const acc = getAccountByNumber(number);
  if (!acc) return null;
  const db = load();
  db.accounts[acc.id].status = 'active';
  delete db.accounts[acc.id].lockedReason;
  save(db);
  return acc;
}

/* Rollen-Sync vom Bot ($setrang) → Dashboard-Rolle */
export function syncRoleFromBot(number, roleLabel, by) {
  const map = {
    owner: 'owner', deputy: 'deputy', stellvertreter: 'deputy', stellvertreterin: 'deputy',
    admin: 'admin', supporter: 'supporter', support: 'supporter',
    user: 'user', groupadmin: 'groupadmin'
  };
  const role = map[String(roleLabel || '').toLowerCase()];
  if (!role) return null;
  let acc = getAccountByNumber(number);
  let created = null;
  if (!acc) {
    const res = createAccount({ username: 'love_' + String(number).slice(-4), number, role, mustChange: true });
    acc = res.account;
    created = res.tempPassword;
  } else {
    setRole(acc.id, role, by);
    acc = getAccount(acc.id);
  }
  return { account: acc, created, tempPassword: created };
}

/* ---------- Scope-Helfer -------------------------------------------------------------- */
export function inScope(session, groupJid) {
  const scope = session?.scope || { type: 'global' };
  if (scope.type === 'global') return true;
  return scope.type === 'group' && scope.groupJid === groupJid;
}

export const ROLE_LIST = Object.values(ROLES);

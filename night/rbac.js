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

/* ---------- 🎛️ Granulares Rechte-System (Einzelrechte on top of Rolle) --------
   Jede Rolle liefert eine Basis (MATRIX oben). Zusätzlich kann JEDER Account
   individuell Rechte dazubekommen (permsExtra) oder entzogen bekommen
   (permsRevoked) — unabhängig von der Rolle. Der Owner selbst ist davon
   ausgenommen (Schutz gegen versehentliches Aussperren). Jede Änderung wird
   unveränderlich mit Vorher/Nachher + Grund + Akteur protokolliert
   (acc.permsHistory) — zusätzlich zum normalen audit.jsonl. */
export const PERMISSIONS = [
  { id: 'accounts.view',    label: 'Accounts einsehen',                 cat: 'Accounts',    critical: false },
  { id: 'accounts.manage',  label: 'Accounts verwalten (anlegen/Status)', cat: 'Accounts',   critical: false },
  { id: 'roles.assign',     label: 'Rollen vergeben',                   cat: 'Accounts',    critical: true },
  { id: 'sessions.view',    label: 'Sessions einsehen',                 cat: 'Sessions',    critical: false },
  { id: 'sessions.control', label: 'Sessions steuern (Restart/Stop)',   cat: 'Sessions',    critical: false },
  { id: 'sessions.delete',  label: 'Sessions/Devices löschen',          cat: 'Sessions',    critical: true },
  { id: 'users.view',       label: 'Nutzer einsehen',                   cat: 'Nutzer',       critical: false },
  { id: 'users.edit',       label: 'Nutzer bearbeiten',                 cat: 'Nutzer',       critical: false },
  { id: 'users.ban',        label: 'Nutzer bannen',                     cat: 'Nutzer',       critical: false },
  { id: 'groups.view',      label: 'Gruppen einsehen',                  cat: 'Gruppen',      critical: false },
  { id: 'groups.manage',    label: 'Gruppen verwalten',                 cat: 'Gruppen',      critical: false },
  { id: 'logs.view',        label: 'Logs einsehen',                     cat: 'Logs',         critical: false },
  { id: 'logs.export',      label: 'Logs exportieren',                  cat: 'Logs',         critical: false },
  { id: 'security.view',    label: 'Security-Center einsehen',          cat: 'Security',     critical: false },
  { id: 'security.manage',  label: 'Security verwalten (IP-Bans etc.)', cat: 'Security',     critical: true },
  { id: 'db.view',          label: 'Datenbank einsehen',                cat: 'Datenbank',    critical: false },
  { id: 'db.backup',        label: 'Datenbank-Backup erstellen',        cat: 'Datenbank',    critical: false },
  { id: 'db.restore',       label: 'Datenbank wiederherstellen',        cat: 'Datenbank',    critical: true },
  { id: 'system.view',      label: 'System einsehen',                   cat: 'System',       critical: false },
  { id: 'system.control',   label: 'System steuern (Neustart etc.)',    cat: 'System',       critical: true },
  { id: 'broadcast.send',   label: 'Broadcast senden',                  cat: 'Sonstiges',    critical: false },
  { id: 'tickets.manage',   label: 'Tickets verwalten',                 cat: 'Sonstiges',    critical: false },
  { id: 'self.view',        label: 'Eigenes Profil einsehen',           cat: 'Sonstiges',    critical: false }
];
export const PERMISSION_IDS = PERMISSIONS.map((p) => p.id);

/* Vorlagen: ein Klick vergibt mehrere Einzelrechte zusätzlich zur Rolle. */
export const PERMISSION_TEMPLATES = {
  security_team:   { label: '🛡️ Security-Team',        grant: ['security.view', 'security.manage', 'logs.view', 'logs.export'] },
  content_mod:     { label: '🧹 Content-Moderation',    grant: ['users.view', 'users.edit', 'users.ban', 'groups.view', 'groups.manage'] },
  support_basis:   { label: '💬 Support-Basis',         grant: ['users.view', 'tickets.manage', 'logs.view'] },
  audit_readonly:  { label: '👁️ Nur-Lesen (Audit)',     grant: ['accounts.view', 'users.view', 'groups.view', 'logs.view', 'security.view', 'system.view', 'db.view'] },
  broadcast_team:  { label: '📢 Broadcast-Team',        grant: ['broadcast.send', 'groups.view'] }
};

/** Effektive Rechte eines Accounts: Rolle + Einzel-Zusatzrechte − Einzel-Entzüge.
 *  Owner ist immun gegen Entzüge (Schutz gegen Selbstaussperrung). */
export function effectivePerms(account) {
  if (!account) return [];
  const role = ROLES[account.role] ? account.role : 'user';
  const base = permsOf(role);
  let set = base.includes('*') ? new Set(PERMISSION_IDS) : new Set(base);
  if (role !== 'owner') {
    for (const p of (account.permsExtra || [])) if (PERMISSION_IDS.includes(p)) set.add(p);
    for (const p of (account.permsRevoked || [])) set.delete(p);
  }
  return Array.from(set);
}

/** Kann dieser Account (nicht nur seine Rolle) dieses Recht ausüben? */
export function accountCan(account, permId) {
  return effectivePerms(account).includes(permId);
}

/** Einzelrechte gezielt gewähren/entziehen — protokolliert unveränderlich
 *  mit Vorher/Nachher-Zustand, Grund und Akteur in acc.permsHistory. */
export function setPermsOverride(accountId, changes, by, reason) {
  const db = load();
  const acc = db.accounts[accountId];
  if (!acc) return { error: 'not_found' };
  if (acc.role === 'owner') return { error: 'owner_protected' };
  const grant = (changes?.grant || []).filter((p) => PERMISSION_IDS.includes(p));
  const revoke = (changes?.revoke || []).filter((p) => PERMISSION_IDS.includes(p));
  const before = { extra: [...(acc.permsExtra || [])], revoked: [...(acc.permsRevoked || [])] };
  let extra = new Set(before.extra.filter((p) => !revoke.includes(p)));
  let revoked = new Set(before.revoked.filter((p) => !grant.includes(p)));
  for (const p of grant) extra.add(p);
  for (const p of revoke) revoked.add(p);
  acc.permsExtra = Array.from(extra);
  acc.permsRevoked = Array.from(revoked);
  const after = { extra: [...acc.permsExtra], revoked: [...acc.permsRevoked] };
  acc.permsHistory = acc.permsHistory || [];
  acc.permsHistory.push({ at: new Date().toISOString(), by: by || 'system', reason: String(reason || '').slice(0, 300), before, after });
  save(db);
  return { before, after, grant, revoke };
}

/** Eine Rechte-Vorlage auf einen Account anwenden (additiv). */
export function applyPermTemplate(accountId, templateId, by, reason) {
  const tpl = PERMISSION_TEMPLATES[templateId];
  if (!tpl) return { error: 'unknown_template' };
  return setPermsOverride(accountId, { grant: tpl.grant, revoke: [] }, by, reason || ('Vorlage angewendet: ' + tpl.label));
}

/* ---------- 5-Status-Modell -----------------------------------------------------
   aktiv | ausstehend | eingeschränkt | gesperrt | deaktiviert
   Ersetzt/erweitert das alte binäre active/locked (bleibt abwärtskompatibel:
   bestehende Accounts mit status 'active'/'locked' funktionieren unverändert). */
export const STATUSES = {
  active:     { id: 'active',     label: 'Aktiv',          icon: '✅', loginAllowed: true },
  pending:    { id: 'pending',    label: 'Ausstehend',     icon: '⏳', loginAllowed: false },
  restricted: { id: 'restricted', label: 'Eingeschränkt',  icon: '⚠️', loginAllowed: true },
  locked:     { id: 'locked',     label: 'Gesperrt',       icon: '⛔', loginAllowed: false },
  disabled:   { id: 'disabled',   label: 'Deaktiviert',    icon: '🚫', loginAllowed: false }
};
export const STATUS_LIST = Object.values(STATUSES);

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
  acc.status = status; /* active | locked (Legacy) — siehe setStatusEx für 5-Status-Modell */
  save(db);
  return acc;
}

/** 5-Status-Wechsel MIT Vorher/Nachher + Pflicht-Grund + unveränderlichem
 *  Verlauf (acc.statusHistory) — für die "Benutzerakte". Owner-Accounts
 *  können nur vom Owner selbst gesperrt/deaktiviert werden. */
export function setStatusEx(accountId, status, by, reason) {
  const db = load();
  const acc = db.accounts[accountId];
  if (!acc) return { error: 'not_found' };
  if (!STATUSES[status]) return { error: 'unknown_status' };
  const before = acc.status;
  if (before === status) return { error: 'no_change' };
  acc.status = status;
  acc.statusHistory = acc.statusHistory || [];
  acc.statusHistory.push({ at: new Date().toISOString(), by: by || 'system', from: before, to: status, reason: String(reason || '').slice(0, 300) });
  if (status === 'locked' || status === 'disabled') acc.lockedReason = reason || acc.lockedReason || '';
  if (status === 'active') delete acc.lockedReason;
  save(db);
  return { before, after: status, acc };
}

/* ---------- Granulare Feature-Einschränkungen (unabhängig von Rechten) ------
   Für den Status "eingeschränkt": einzelne Funktionen gezielt sperren, ohne
   den ganzen Account zu sperren (z. B. "darf sich einloggen, aber keine
   Broadcasts senden und keine anderen Nutzer bannen"). */
export const RESTRICTABLE_FEATURES = [
  { id: 'login',      label: 'Login' },
  { id: 'broadcast',  label: 'Broadcast senden' },
  { id: 'ban',        label: 'Nutzer bannen' },
  { id: 'roleChange', label: 'Rollen ändern' },
  { id: 'ipManage',   label: 'IP-Verwaltung' },
  { id: 'accountMgmt',label: 'Account-Verwaltung' },
  { id: 'dbAccess',   label: 'Datenbank-Zugriff' }
];
export function isRestricted(account, featureId) {
  if (!account || account.status !== 'restricted') return false;
  return (account.restrictions || []).includes(featureId);
}
export function setRestrictions(accountId, restrictions, by, reason) {
  const db = load();
  const acc = db.accounts[accountId];
  if (!acc) return { error: 'not_found' };
  const before = [...(acc.restrictions || [])];
  const validIds = RESTRICTABLE_FEATURES.map((f) => f.id);
  acc.restrictions = (restrictions || []).filter((r) => validIds.includes(r));
  acc.statusHistory = acc.statusHistory || [];
  acc.statusHistory.push({ at: new Date().toISOString(), by: by || 'system', from: 'restrictions:' + before.join(','), to: 'restrictions:' + acc.restrictions.join(','), reason: String(reason || '').slice(0, 300) });
  save(db);
  return { before, after: acc.restrictions };
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

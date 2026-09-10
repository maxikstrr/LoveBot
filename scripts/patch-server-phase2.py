#!/usr/bin/env python3
# Phase 2 Server-Patches: Benutzerakte 2.0, Löschung, Owner-Alerts, Feature-Registry
import io

p = 'server.js'
s = io.open(p, encoding='utf-8').read()
n = 0

# ═══ 1) Feature-Registry: Store (vor handleApi einhängen) ══════════════
anchor1 = "async function handleApi(req, res, pathname) {"
feat_store = """/* ── 🧩 FEATURE-REGISTRY (LoveBot 5.0-Modularität) ─────────────────────
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
function saveFeatureRegistry(actor, reason) {
  const reg = loadFeatureRegistry();
  reg.version += 1;
  reg.updatedAt = new Date().toISOString();
  reg.updatedBy = String(actor || '?');
  fs.writeFileSync(FEATURE_REGISTRY_FILE, JSON.stringify(reg, null, 2), 'utf8');
  audit(actor, 'feature.changed', 'Feature-Registry → v' + reg.version + (reason ? ' — ' + String(reason).slice(0, 160) : ''), 'success');
  return reg;
}
loadFeatureRegistry(); /* Datei beim Start sicher anlegen */

async function handleApi(req, res, pathname) {"""
assert anchor1 in s
s = s.replace(anchor1, feat_store, 1)
n += 1

# ═══ 2) Helper: Profil-Bid via Nummer finden (vor den accounts-Endpoints) ═══
anchor2 = "  if (pathname.startsWith('/api/accounts/') && pathname.endsWith('/detail') && req.method === 'GET') {"
helper = """  /* 📂 Profil-Datei (LoveUser) zur WhatsApp-Nummer finden */
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

"""
assert anchor2 in s
s = s.replace(anchor2, helper + anchor2, 1)
n += 1

# ═══ 3) Voll-Akte Endpoint: nach dem bestehenden /detail ════════════════
anchor3 = """  if (pathname === '/api/accounts/create' && req.method === 'POST') {"""
full_akte = """  /* 📂 VOLLSTÄNDIGE BENUTZERAKTE (Thinkproject-Muster): Account + Bot-Profil
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
      const lines = fs.readFileSync(SECURITY_FILE, 'utf8').trim().split('\\n').filter(Boolean).slice(-3000);
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
      const lines = fs.readFileSync(AUDIT_FILE, 'utf8').trim().split('\\n').filter(Boolean).slice(-3000);
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

"""
assert anchor3 in s
s = s.replace(anchor3, full_akte + anchor3, 1)
n += 1

io.open(p, 'w', encoding='utf-8').write(s)
print('server.js Phase-2 Patches:', n)

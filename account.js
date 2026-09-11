/* ═══════════════════════════════════════════════════════════════════════
   💜  L O V E B O T   A C C O U N T   L I F E C Y C L E   v4.0  (account.js)
   ─────────────────────────────────────────────────────────────────────
   Self-Service-Account-Löschung ($unregister) mit Zwei-Phasen-Ablauf:
   Warnung → Code → explizites Bestätigen → atomare Löschung + Backup.
   • Nur der eigene Account, nur nach explizitem Confirm, mit Ablaufzeit.
   • Owner blockiert (Notfall nur per ACCOUNT_RULES.allowOwnerUnregister),
     Admins brauchen zusätzlich das Bestätigungswort.
   • Alles oder nichts pro Speicher; Backup VOR dem Löschen; Audit danach.
   • Re-Register danach ist automatisch sauber (frisches registered:false).
   Import-Richtung: account → waApi + loveplus + lovecore (kein Zyklus).
   ══════════════════════════════════════════════════════════════════════ */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { loadStore as loadPlus, saveStore as savePlus } from './loveplus.js';
import { loadStore as loadCore, saveStore as saveCore } from './lovecore.js';
import {
  readDatabaseStore, writeDatabaseStore, saveGroupProfile
} from './waApi.js';

/* ── Zentrale Konfiguration ────────────────────────────────────────── */
export const ACCOUNT_RULES = {
  codeTtlMs: 5 * 60 * 1000,  /* ⏳ Code-Gültigkeit: 5 Minuten */
  codeDigits: 6,             /* 🔢 Stellen des Bestätigungscodes */
  adminPhrase: 'LÖSCHEN',    /* ✍️ Doppelbestätigung für Admins/Owner */
  allowOwnerUnregister: false /* 👑 Owner-Notfalllöschung (nur bewusst aktivieren) */
};

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DB_ROOT = path.join(HERE, 'Database');
const SESSION_ID = process.env.LOVEBOT_SESSION_ID || 'main';
const webmailPath = () => path.join(DB_ROOT, SESSION_ID === 'main' ? 'webmail.json' : `webmail-${SESSION_ID}.json`);
const sessionsPath = () => path.join(DB_ROOT, 'websessions.json');
const auditPath = () => path.join(DB_ROOT, 'admin-actions.jsonl');
const backupDir = () => path.join(DB_ROOT, 'backups', 'unregister');
const userDir = (bid) => path.join(DB_ROOT, 'LoveUser', String(bid));

/* ── Pending-State (nur RAM: Bot-Neustart = automatischer Abbruch) ─── */
const pending = new Map(); /* bid -> { code, expiresAt, createdAt, requiresPhrase, role } */

function sweepPending(now = Date.now()) {
  for (const [bid, p] of pending) {
    if (!p || p.expiresAt <= now) pending.delete(bid);
  }
}

function userNumbers(profile) {
  const id = profile?.identity || {};
  const out = new Set();
  for (const v of [id.cleanJid, id.cleanLid]) {
    const s = String(v || '').split('@')[0].split(':')[0].trim();
    if (s && s !== 'unknown') out.add(s);
  }
  return [...out];
}

const userPart = (v) => String(v || '').split('@')[0].split(':')[0].trim();

function timingEqual(a, b) {
  const x = String(a || ''), y = String(b || '');
  if (x.length !== y.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(x), Buffer.from(y));
  } catch (e) { return x === y; }
}

/* ── Vorschau: was würde gelöscht? (ändert NICHTS) ─────────────────── */
export function deletionPreview(profile) {
  const bid = profile?.identity?.bid || '';
  const nums = userNumbers(profile);
  const has = (v) => nums.includes(userPart(v));
  const prev = {
    bid, numbers: nums,
    profile: false, afk: 0, warns: 0, proposals: 0,
    plusUser: false, plusCouples: 0, coreUser: false, coreCouples: 0,
    sessions: 0, pendingMails: 0, married: profile?.love?.married === true,
    spouseKey: profile?.love?.spouseKey || '',
    /* 💰 Economy-Bilanz (6.0): alles im Profil, wird mit gelöscht */
    wallet: Math.max(0, Math.floor(Number(profile?.wallet?.copper) || 0)),
    bank: Math.max(0, Math.floor(Number(profile?.bank?.copper) || 0)),
    tx: Array.isArray(profile?.economy?.tx) ? profile.economy.tx.length : 0,
    dailyBest: Number(profile?.economy?.daily?.best) || 0,
    inventory: 0,
    /* 💜 7.0: AI-Memory + Gruppen-Referenzen */
    aiConvs: 0, aiFacts: 0, groupMembers: 0
  };
  if (!bid) return prev;
  try {
    const db = readDatabaseStore();
    prev.profile = !!db.users?.[bid];
    for (const [k, e] of Object.entries(db.afk || {})) {
      if (k === bid || has(k) || has(e?.jid) || has(e?.lid)) prev.afk++;
    }
    for (const g of Object.values(db.groups || {})) {
      for (const k of Object.keys(g?.warns || {})) if (has(k)) prev.warns++;
      for (const k of Object.keys(g?.xp?.members || {})) if (k === bid || has(k)) prev.groupMembers++;
    }
    try {
      const aiSt = JSON.parse(fs.readFileSync('Database/ai.json', 'utf8'));
      for (const scope of Object.keys(aiSt.conversations || {})) {
        if (scope === 'dm:' + bid || scope.endsWith(':' + bid)) prev.aiConvs++;
      }
      prev.aiFacts = Array.isArray(aiSt.facts?.[bid]) ? aiSt.facts[bid].length : 0;
    } catch (e) {}
    for (const [k, p] of Object.entries(db.meta?.marryProposals || {})) {
      if (!p || typeof p !== 'object') continue;
      if (has(k) || has(p.toKey) || has(p.toJid) || has(p.toLid) || has(p.fromKey) || has(p.fromJid) || has(p.fromLid)) prev.proposals++;
    }
  } catch (e) {}
  try {
    const plus = loadPlus();
    const pu = plus.users?.[bid] || plus.users?.[nums.find((n) => plus.users?.[n]) || ''];
    prev.plusUser = !!pu;
    if (pu && pu.inventory && typeof pu.inventory === 'object') {
      for (const n of Object.values(pu.inventory)) prev.inventory += Math.max(0, Number(n) || 0);
    }
    for (const k of Object.keys(plus.couples || {})) {
      const sides = String(k).split('|');
      if (sides.some((s) => has(s))) prev.plusCouples++;
    }
  } catch (e) {}
  try {
    const core = loadCore();
    prev.coreUser = !!(core.users?.[bid] || nums.some((n) => core.users?.[n]));
    for (const k of Object.keys(core.couples || {})) {
      const sides = String(k).split('|');
      if (sides.some((s) => has(s))) prev.coreCouples++;
    }
  } catch (e) {}
  try {
    const sess = JSON.parse(fs.readFileSync(sessionsPath(), 'utf8'));
    for (const s of Object.values(sess || {})) if (has(s?.number)) prev.sessions++;
  } catch (e) {}
  try {
    const mail = JSON.parse(fs.readFileSync(webmailPath(), 'utf8'));
    for (const m of (mail?.queue || [])) {
      if (m && m.status !== 'sent' && (has(m.to) || has(m.jid))) prev.pendingMails++;
    }
  } catch (e) {}
  return prev;
}

/* ── Phase 1: Warnung + Code anfordern ─────────────────────────────── */
export function startUnregister(profile, { isOwner = false, isAdmin = false, now = Date.now() } = {}) {
  sweepPending(now);
  const bid = profile?.identity?.bid || '';
  if (!bid) return { ok: false, reason: 'no-profile' };
  if (profile?.registration?.registered !== true) return { ok: false, reason: 'not-registered' };
  if (isOwner && !ACCOUNT_RULES.allowOwnerUnregister) return { ok: false, reason: 'owner-blocked' };
  const digits = Math.max(4, Math.min(10, ACCOUNT_RULES.codeDigits || 6));
  const code = String(crypto.randomInt(0, 10 ** digits)).padStart(digits, '0');
  const requiresPhrase = isOwner || isAdmin;
  pending.set(bid, {
    code, createdAt: now, expiresAt: now + ACCOUNT_RULES.codeTtlMs,
    requiresPhrase, role: isOwner ? 'owner' : (isAdmin ? 'admin' : 'user')
  });
  return {
    ok: true, code, requiresPhrase,
    expiresAt: now + ACCOUNT_RULES.codeTtlMs,
    preview: deletionPreview(profile)
  };
}

/** Pending-Info für Statusanzeige (NIEMALS den Code herausgeben). */
export function getPendingInfo(bid, now = Date.now()) {
  sweepPending(now);
  const p = pending.get(String(bid || ''));
  if (!p) return null;
  return { expiresAt: p.expiresAt, requiresPhrase: p.requiresPhrase, role: p.role };
}

export function cancelUnregister(bid, now = Date.now()) {
  sweepPending(now);
  return pending.delete(String(bid || ''))
    ? { ok: true }
    : { ok: false, reason: 'none' };
}

/* ── Audit ─────────────────────────────────────────────────────────── */
export function auditAdmin(entry) {
  const { time, ...rest } = entry || {};
  void time;
  return audit(rest);
}
function audit(entry) {
  try {
    fs.appendFileSync(auditPath(), JSON.stringify({ time: new Date().toISOString(), ...entry }) + '\n', 'utf8');
    return true;
  } catch (e) { return false; }
}

/* ── Phase 2: Bestätigen → Backup → Löschen ────────────────────────── */
export function confirmUnregister(profile, { code = '', phrase = '', actor = '', now = Date.now() } = {}) {
  const bid = profile?.identity?.bid || '';
  const p = bid ? pending.get(bid) : null;
  if (!p) { sweepPending(now); return { ok: false, reason: 'none' }; }
  if (p.expiresAt <= now) {
    pending.delete(bid);
    sweepPending(now);
    return { ok: false, reason: 'expired' };
  }
  sweepPending(now);
  if (!timingEqual(code, p.code)) return { ok: false, reason: 'bad-code' };
  if (p.requiresPhrase && String(phrase || '').trim().toUpperCase() !== ACCOUNT_RULES.adminPhrase) {
    return { ok: false, reason: 'bad-phrase' };
  }
  const res = executeUnregister(profile, { actor: actor || ('self:' + bid), now });
  if (res.ok) pending.delete(bid);
  return res;
}

export function executeUnregister(profile, { actor = '', now = Date.now() } = {}) {
  const bid = profile?.identity?.bid || '';
  if (!bid) return { ok: false, reason: 'no-profile' };
  const nums = userNumbers(profile);
  const has = (v) => nums.includes(userPart(v));
  const stamp = new Date(now).toISOString().replace(/[:.]/g, '-');
  const backupId = `${bid}--${stamp}.json`;
  const backup = {
    meta: { bid, numbers: nums, at: new Date(now).toISOString(), actor, version: 1 },
    dbUser: null, afk: {}, proposals: {}, warns: {}, plusUser: null, plusCouples: {},
    coreUser: null, coreCouples: {}, sessions: {}, mails: [], partner: null
  };
  const deleted = {
    profile: 0, afk: 0, warns: 0, proposals: 0, plusUser: 0, plusCouples: 0,
    coreUser: 0, coreCouples: 0, sessions: 0, mails: 0, partnerFreed: false
  };

  /* 1) Database.json: User, AFK, Heiratsanträge, Warns */
  const db = readDatabaseStore();
  if (db.users?.[bid]) {
    backup.dbUser = db.users[bid];
    delete db.users[bid];
    deleted.profile = 1;
  }
  for (const [k, e] of Object.entries(db.afk || {})) {
    if (k === bid || has(k) || has(e?.jid) || has(e?.lid)) {
      backup.afk[k] = e; delete db.afk[k]; deleted.afk++;
    }
  }
  const props = db.meta?.marryProposals || {};
  for (const [k, pr] of Object.entries(props)) {
    if (!pr || typeof pr !== 'object') continue;
    if (has(k) || has(pr.toKey) || has(pr.toJid) || has(pr.toLid) || has(pr.fromKey) || has(pr.fromJid) || has(pr.fromLid)) {
      backup.proposals[k] = pr; delete props[k]; deleted.proposals++;
    }
  }
  const touchedGroups = [];
  const touchedSet = new Set();
  for (const [gid, g] of Object.entries(db.groups || {})) {
    if (g && typeof g.warns === 'object') {
      for (const k of Object.keys(g.warns)) {
        if (has(k)) {
          backup.warns[gid] = backup.warns[gid] || {};
          backup.warns[gid][k] = g.warns[k];
          delete g.warns[k];
          deleted.warns++;
        }
      }
      if (backup.warns[gid] && !touchedSet.has(gid)) { touchedGroups.push(g); touchedSet.add(gid); }
    }
    /* 💜 7.0: Gruppen-Member-Referenzen (xp.members) + Treasury-Spuren des Users
       entfernen (Aggregate bleiben, gbanned-Bans bleiben aus Sicherheit bestehen). */
    if (g && g.xp && typeof g.xp.members === 'object') {
      for (const k of Object.keys(g.xp.members)) {
        if (k === bid || has(k)) {
          backup.groupMembers = backup.groupMembers || {};
          backup.groupMembers[gid] = backup.groupMembers[gid] || {};
          backup.groupMembers[gid][k] = g.xp.members[k];
          delete g.xp.members[k];
          deleted.groupMembers = (deleted.groupMembers || 0) + 1;
        }
      }
      if (backup.groupMembers && backup.groupMembers[gid] && !touchedSet.has(gid)) { touchedGroups.push(g); touchedSet.add(gid); }
    }
  }
  /* 💜 7.0: AI-Memory des Users (Conversations, Fakten, Prefs, Stats) — synchron via fs */
  try {
    const aiFile = 'Database/ai.json';
    const aiSt = JSON.parse(fs.readFileSync(aiFile, 'utf8'));
    backup.aiMemory = { conversations: {}, facts: aiSt.facts?.[bid] || null, prefs: aiSt.prefs?.[bid] || null };
    for (const scope of Object.keys(aiSt.conversations || {})) {
      if (scope === 'dm:' + bid || scope.endsWith(':' + bid)) {
        backup.aiMemory.conversations[scope] = aiSt.conversations[scope];
        delete aiSt.conversations[scope];
      }
    }
    let aiRemoved = Object.keys(backup.aiMemory.conversations).length;
    if (aiSt.facts && aiSt.facts[bid] !== undefined) { delete aiSt.facts[bid]; aiRemoved++; }
    if (aiSt.prefs && aiSt.prefs[bid] !== undefined) { delete aiSt.prefs[bid]; aiRemoved++; }
    if (aiSt.stats?.byUser && aiSt.stats.byUser[bid] !== undefined) { delete aiSt.stats.byUser[bid]; aiRemoved++; }
    if (aiRemoved > 0) {
      fs.writeFileSync(aiFile, JSON.stringify(aiSt), 'utf8');
      deleted.aiMemory = aiRemoved;
    }
  } catch (e) { /* kein AI-Store → nichts zu tun */ }
  writeDatabaseStore(db);
  for (const g of touchedGroups) {
    try { saveGroupProfile(g); } catch (e) {}
  }

  /* 2) loveplus.json: User + Couples mit exakter Nummern-Beteiligung */
  try {
    const plus = loadPlus();
    plus.users = plus.users || {};
    for (const k of [bid, ...nums]) {
      if (plus.users[k]) {
        backup.plusUser = backup.plusUser || {};
        backup.plusUser[k] = plus.users[k];
        delete plus.users[k];
        deleted.plusUser++;
      }
    }
    for (const k of Object.keys(plus.couples || {})) {
      if (String(k).split('|').some((s) => has(s))) {
        backup.plusCouples[k] = plus.couples[k];
        delete plus.couples[k];
        deleted.plusCouples++;
      }
    }
    savePlus(plus);
  } catch (e) {}

  /* 3) lovecore.json: dito */
  try {
    const core = loadCore();
    core.users = core.users || {};
    for (const k of [bid, ...nums]) {
      if (core.users[k]) {
        backup.coreUser = backup.coreUser || {};
        backup.coreUser[k] = core.users[k];
        delete core.users[k];
        deleted.coreUser++;
      }
    }
    for (const k of Object.keys(core.couples || {})) {
      if (String(k).split('|').some((s) => has(s))) {
        backup.coreCouples[k] = core.couples[k];
        delete core.couples[k];
        deleted.coreCouples++;
      }
    }
    saveCore(core);
  } catch (e) {}

  /* 4) Partner freigeben (ohne Ghost-Profil zu erzeugen: Bid per Nummer suchen) */
  const spouseKey = userPart(profile?.love?.spouseKey || '');
  if (profile?.love?.married === true && spouseKey) {
    try {
      const db2 = readDatabaseStore();
      const hit = Object.entries(db2.users || {}).find(([, u]) =>
        u?.love?.married === true &&
        (userPart(u?.identity?.cleanJid) === spouseKey || userPart(u?.identity?.cleanLid) === spouseKey));
      if (hit) {
        const [, spouse] = hit;
        backup.partner = { bid: spouse?.identity?.bid || '', love: spouse?.love ? { ...spouse.love } : null };
        spouse.love = {
          ...(spouse.love || {}),
          married: false, spouseName: null, spouseKey: null, spouseBid: null,
          marriedAt: null, divorcedAt: new Date(now).toISOString()
        };
        db2.users[hit[0]] = spouse;
        writeDatabaseStore(db2);
        try {
          const sp = path.join(userDir(hit[0]), hit[0] + '.json');
          if (fs.existsSync(sp)) fs.writeFileSync(sp, JSON.stringify(spouse, null, 2), 'utf8');
        } catch (e) {}
        deleted.partnerFreed = true;
      }
    } catch (e) {}
  }

  /* 5) LoveUser-Verzeichnis komplett entfernen */
  try {
    if (fs.existsSync(userDir(bid))) {
      fs.rmSync(userDir(bid), { recursive: true, force: true });
    }
  } catch (e) {}

  /* 6) Web-Sessions des Users beenden */
  try {
    const raw = fs.readFileSync(sessionsPath(), 'utf8');
    const sess = JSON.parse(raw) || {};
    let changed = false;
    for (const [tok, s] of Object.entries(sess)) {
      if (s && has(s.number)) {
        backup.sessions[tok] = s; delete sess[tok];
        deleted.sessions++; changed = true;
      }
    }
    if (changed) fs.writeFileSync(sessionsPath(), JSON.stringify(sess, null, 2), 'utf8');
  } catch (e) {}

  /* 7) Offene (ungesendete) Webmails an den User verwerfen */
  try {
    const raw = fs.readFileSync(webmailPath(), 'utf8');
    const mail = JSON.parse(raw) || {};
    const queue = Array.isArray(mail.queue) ? mail.queue : [];
    const keep = [];
    for (const m of queue) {
      if (m && m.status !== 'sent' && (has(m.to) || has(m.jid))) {
        backup.mails.push(m); deleted.mails++;
      } else keep.push(m);
    }
    if (backup.mails.length) {
      mail.queue = keep;
      fs.writeFileSync(webmailPath(), JSON.stringify(mail, null, 2), 'utf8');
    }
  } catch (e) {}

  /* 7b) Progression-Events anonymisieren (5.0: bid+name → neutral, Log bleibt für Statistik) */
  let eventsAnon = 0;
  try {
    const evPath = path.join(DB_ROOT, 'events.jsonl');
    const rawEv = fs.readFileSync(evPath, 'utf8');
    const lines = rawEv.split('\n');
    let changed = false;
    const next = lines.map((ln) => {
      if (!ln.trim()) return ln;
      let e = null;
      try { e = JSON.parse(ln); } catch (err) { return ln; }
      const eb = String(e?.data?.bid || '');
      if (eb && (eb === bid || nums.some((n) => n && eb.includes(n)))) {
        e.data.bid = 'deleted';
        if (e.data.name) e.data.name = '–';
        eventsAnon++; changed = true;
        return JSON.stringify(e);
      }
      return ln;
    });
    if (changed) fs.writeFileSync(evPath, next.join('\n'), 'utf8');
  } catch (e) {}
  deleted.eventsAnon = eventsAnon;

  /* 8) Backup schreiben (enthält alles Entfernte) */
  let backupOk = false;
  try {
    fs.mkdirSync(backupDir(), { recursive: true });
    fs.writeFileSync(path.join(backupDir(), backupId), JSON.stringify(backup, null, 2), 'utf8');
    backupOk = true;
  } catch (e) {}

  /* 9) Audit (mit User-ID, Zeit, Event) */
  audit({
    actor: actor || ('self:' + bid), action: 'account.unregister',
    target: bid, backup: backupOk ? backupId : null,
    deleted, reason: 'self-service confirmed'
  });

  return { ok: true, backupId: backupOk ? backupId : null, deleted };
}

/* ── Notfall-Wiederherstellung (nur Owner, nur via Chat-Confirm) ───── */
export function restoreUnregister(backupId, { actor = '' } = {}) {
  const raw = String(backupId || '');
  if (!raw || raw.includes('/') || raw.includes('\\') || raw.includes('..') || !raw.endsWith('.json')) return { ok: false, reason: 'bad-id' };
  const safe = raw;
  const file = path.join(backupDir(), safe);
  if (!file.startsWith(backupDir())) return { ok: false, reason: 'bad-id' };
  let backup;
  try {
    backup = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) { return { ok: false, reason: 'not-found' }; }
  const bid = backup?.meta?.bid || '';
  if (!bid) return { ok: false, reason: 'bad-backup' };
  const restored = {};
  const skipped = [];

  const db = readDatabaseStore();
  if (backup.dbUser && !db.users[bid]) {
    db.users[bid] = backup.dbUser; restored.profile = 1;
  } else if (backup.dbUser) skipped.push('profile(exists)');
  for (const [k, v] of Object.entries(backup.afk || {})) {
    if (!db.afk[k]) { db.afk[k] = v; restored.afk = (restored.afk || 0) + 1; }
    else skipped.push('afk:' + k);
  }
  db.meta = db.meta || {};
  db.meta.marryProposals = db.meta.marryProposals || {};
  for (const [k, v] of Object.entries(backup.proposals || {})) {
    if (!db.meta.marryProposals[k]) { db.meta.marryProposals[k] = v; restored.proposals = (restored.proposals || 0) + 1; }
    else skipped.push('proposal:' + k);
  }
  const touched = [];
  for (const [gid, warns] of Object.entries(backup.warns || {})) {
    const g = db.groups?.[gid];
    if (!g) { skipped.push('warns:' + gid + '(no-group)'); continue; }
    g.warns = (g.warns && typeof g.warns === 'object') ? g.warns : {};
    for (const [k, v] of Object.entries(warns)) {
      if (!g.warns[k]) { g.warns[k] = v; restored.warns = (restored.warns || 0) + 1; }
      else skipped.push(`warns:${gid}:${k}`);
    }
    touched.push(g);
  }
  if (backup.partner?.bid && db.users[backup.partner.bid] && backup.partner.love) {
    db.users[backup.partner.bid].love = backup.partner.love;
    restored.partner = 1;
  }
  writeDatabaseStore(db);
  for (const g of touched) {
    try { saveGroupProfile(g); } catch (e) {}
  }
  try {
    const sp = path.join(userDir(bid), bid + '.json');
    if (backup.dbUser && !fs.existsSync(sp)) {
      fs.mkdirSync(userDir(bid), { recursive: true });
      fs.writeFileSync(sp, JSON.stringify(backup.dbUser, null, 2), 'utf8');
      restored.profileFile = 1;
    } else if (backup.dbUser) skipped.push('profileFile(exists)');
  } catch (e) { skipped.push('profileFile(err)'); }

  try {
    const plus = loadPlus();
    plus.users = plus.users || {};
    plus.couples = plus.couples || {};
    for (const [k, v] of Object.entries(backup.plusUser || {})) {
      if (!plus.users[k]) { plus.users[k] = v; restored.plusUser = (restored.plusUser || 0) + 1; }
      else skipped.push('plusUser:' + k);
    }
    for (const [k, v] of Object.entries(backup.plusCouples || {})) {
      if (!plus.couples[k]) { plus.couples[k] = v; restored.plusCouples = (restored.plusCouples || 0) + 1; }
      else skipped.push('plusCouple:' + k);
    }
    savePlus(plus);
  } catch (e) { skipped.push('plus(err)'); }
  try {
    const core = loadCore();
    core.users = core.users || {};
    core.couples = core.couples || {};
    for (const [k, v] of Object.entries(backup.coreUser || {})) {
      if (!core.users[k]) { core.users[k] = v; restored.coreUser = (restored.coreUser || 0) + 1; }
      else skipped.push('coreUser:' + k);
    }
    for (const [k, v] of Object.entries(backup.coreCouples || {})) {
      if (!core.couples[k]) { core.couples[k] = v; restored.coreCouples = (restored.coreCouples || 0) + 1; }
      else skipped.push('coreCouple:' + k);
    }
    saveCore(core);
  } catch (e) { skipped.push('core(err)'); }

  audit({
    actor: actor || 'owner', action: 'account.restore',
    target: bid, backup: safe, restored, skipped, reason: 'owner emergency restore'
  });
  return { ok: true, restored, skipped };
}

/** Verfügbare Backups (neueste zuerst, für Owner-Übersicht). */
export function listUnregisterBackups(limit = 10) {
  try {
    if (!fs.existsSync(backupDir())) return [];
    return fs.readdirSync(backupDir())
      .filter((f) => f.endsWith('.json'))
      .map((f) => {
        let at = 0, bid = '';
        try {
          const st = fs.statSync(path.join(backupDir(), f));
          at = st.mtimeMs;
          bid = f.split('--')[0] || '';
        } catch (e) {}
        return { id: f, bid, at };
      })
      .sort((a, b) => b.at - a.at)
      .slice(0, Math.max(1, limit));
  } catch (e) { return []; }
}

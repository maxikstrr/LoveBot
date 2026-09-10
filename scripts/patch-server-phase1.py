#!/usr/bin/env python3
# Phase-1-Patches für server.js: LoveCore-Events, XP-Statistik, XP-Admin-API, Health
import io

p = 'server.js'
s = io.open(p, encoding='utf-8').read()
patches = []

# 1) Import
old = "import { rankFor } from './levelsystem.js';"
new = "import { rankFor } from './levelsystem.js';\nimport * as LoveEngine from './loveengine.js';"
assert old in s
s = s.replace(old, new, 1)
patches.append('import')

# 2) /api/live: Events + XP-Stats mitpusht
old = """        const payload = JSON.stringify({
          sessions: SessionManager.listSessions(),
          activity: SessionManager.recentActivity(25),
          audit: SessionManager.recentAudit(40),
          fleet: SessionManager.fleetStats()
        });"""
new = """        const payload = JSON.stringify({
          sessions: SessionManager.listSessions(),
          activity: SessionManager.recentActivity(25),
          audit: SessionManager.recentAudit(40),
          fleet: SessionManager.fleetStats(),
          /* 💜 LoveCore: Live-Event-Feed (XP, Level-Ups, Games, Achievements) */
          events: LoveEngine.recent(25)
        });"""
assert old in s
s = s.replace(old, new, 1)
patches.append('live-feed')

# 3) /api/admin/overview: XP-Totals
old = """      totals: {
        messages: list.reduce((a, x) => a + (x.messages || 0), 0),"""
new = """      totals: {
        messages: list.reduce((a, x) => a + (x.messages || 0), 0),"""
# xp-Block anhängen: vor 'topRich:'
old2 = """      topRich: profiles.sort((a, b) => b.copper - a.copper).slice(0, 10)"""
new2 = """      xp: LoveEngine.xpStats(profiles),
      topRich: profiles.sort((a, b) => b.copper - a.copper).slice(0, 10)"""
assert old2 in s
s = s.replace(old2, new2, 1)
patches.append('overview-xp')

# 4) Neue Endpunkte: /api/xp (GET) + /api/xp/adjust (POST) + /api/health (GET)
#    Einhängen direkt vor dem /api/leaderboard-Block.
anchor = "  if (pathname === '/api/leaderboard') {"
new_api = """  /* ⭐ XP & LEVEL (LoveCore): Statistik + Level-Tabelle — nur mit xp.view */
  if (pathname === '/api/xp' && req.method === 'GET') {
    if (!perm(session, 'xp.view')) return sendJson(res, 403, { error: 'Keine Berechtigung (xp.view).' });
    const profiles = scanUserProfiles();
    const stats = LoveEngine.xpStats(profiles);
    const top = profiles
      .map((x) => ({ name: x.name || maskNum(x.bid.split('_')[0]), bid: x.bid, level: x.level, prestige: x.prestige, xp: x.xp, totalXp: x.totalXp || x.xp }))
      .sort((a, b) => b.prestige - a.prestige || b.level - a.level || b.xp - a.xp)
      .slice(0, 15)
      .map((x) => ({ ...x, rank: rankFor(x.prestige, x.level).full }));
    return sendJson(res, 200, { ok: true, stats, top, table: LoveEngine.levelTable(50, 0) });
  }

  /* ⭐ XP ADJUST (LoveCore, kritisch): Grund PFLICHT + Audit + Event.
     Nur mit xp.adjust (Owner + Deputy; kritisches Recht). */
  if (pathname === '/api/xp/adjust' && req.method === 'POST') {
    if (!perm(session, 'xp.adjust')) return sendJson(res, 403, { error: 'Keine Berechtigung (xp.adjust).' });
    const body = await readBody(req);
    const bid = String(body.bid || '').trim();
    const delta = Number(body.delta || 0);
    const reason = String(body.reason || '').trim();
    if (!/^[0-9a-z]+jid[0-9a-z]+i?d$/i.test(bid) && !/^\\d+(_[a-z0-9]+)?$/i.test(bid)) {
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
    return sendJson(res, 200, { ok: true, components, checkedAt: new Date().toISOString() });
  }

"""
assert anchor in s
s = s.replace(anchor, new_api + anchor, 1)
patches.append('xp+health-api')

# 5) Helper fmtSizeKb — falls nicht vorhanden
if 'function fmtSizeKb' not in s:
    anchor2 = "function maskIp(ip) {"
    helper = """function fmtSizeKb(kb) {
  if (kb >= 1024) return (kb / 1024).toFixed(1) + ' MB';
  return kb + ' KB';
}

"""
    assert anchor2 in s
    s = s.replace(anchor2, helper + anchor2, 1)
    patches.append('fmtSizeKb')

io.open(p, 'w', encoding='utf-8').write(s)
print('server.js Patches:', patches)

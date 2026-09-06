/* ═══════════════════════════════════════════════════════════════════════
   📡  L O V E B O T   S E S S I O N   C O M M A N D S   (Owner-only)
   ───────────────────────────────────────────────────────────────────────
   $sessions · $session · $sessionstats · $sessionhealth · $sessionlogs
   $newsession · $startsession · $restartsession · $killsession
   $delsession · $sessionname · $sessiondefault · $sessionqr · $pairing

   Läuft im default-Case des Befehls-Switches (vor LovePlus).
   Alle Aktionen werden im SessionManager (Database/sessions.json) protokolliert.
   Kill ≠ Delete:  Kill stoppt nur die Verbindung, Delete entfernt die Registry
   (Credentials werden NIE automatisch gelöscht).
   ═══════════════════════════════════════════════════════════════════ */

import * as SM from './sessionManager.js';
import { resolve as regResolve, search as regSearch, stats as regStats } from './commandRegistry.js';

const LINE = '━━━━━━━━━━━━━━━━━━━━';
const ICONS = {
  CONNECTED: '🟢', DISCONNECTED: '🔴', QR_REQUIRED: '🟡',
  CONNECTING: '🕸️', WAITING_FOR_AUTH: '🟣', STOPPED: '⚫', ERROR: '💥'
};

const COMMANDS = new Map();
function cmd(names, fn) { for (const n of names.split(' ')) COMMANDS.set(n, fn); }

function fmt(n) { return Number(n || 0).toLocaleString('de-DE'); }

/* ── Übersicht ────────────────────────────────────────────────────────── */
cmd('sessions', async (ctx) => {
  const list = SM.listSessions();
  if (!list.length) {
    await ctx.send('> 📡 *Noch keine Sessions registriert.*\nDer Bot trägt sich beim nächsten Verbinden automatisch ein.');
    return true;
  }
  const online = list.filter((s) => s.status === 'CONNECTED').length;
  const fleet = SM.fleetStats();
  const body = list.map((s, i) =>
    (ICONS[s.status] || '⚪') + (s.maintenance ? '🛠️' : '') + ' *' + String(i + 1).padStart(2, '0') + ' ' + s.name + '*' + (s.isDefault ? ' ⭐' : '') +
    (s.tags.length ? ' 🏷️' : '') +
    '\n     _' + s.id + ' · ' + s.status + ' · ↑ ' + s.uptime + (s.uptimePct != null ? ' · ' + s.uptimePct + '%' : '') + ' · 👥 ' + fmt(s.groups) + '_'
  ).join('\n');
  await ctx.send(
    '> 📡 *LOVE BOT — SESSION CENTER*\n> _Managed: ' + fleet.managed + ' · Running: ' + fleet.running + ' · Paused: ' + fleet.paused + ' · Auth: ' + fleet.authRequired + ' · Error: ' + fleet.error + '_\n\n' + body + '\n\n' + LINE + '\n' +
    '❥ *' + ctx.pref + 'session <id>* — Details\n❥ *' + ctx.pref + 'fleet* — Fleet-Übersicht\n❥ *' + ctx.pref + 'newsession <name>* — neue Session\n❥ *' + ctx.pref + 'pausesession/<id>/resumesession* — Pause & Resume'
  );
  return true;
});

/* ── Details ──────────────────────────────────────────────────────────── */
cmd('session sessioninfo sessionstatus', async (ctx) => {
  const id = ctx.args[0]?.replace(/^@/, '') || 'main';
  const s = SM.getSession(id);
  if (!s) {
    await ctx.send('> ❌ Session *' + id + '* nicht gefunden.\nAlle Sessions: *' + ctx.pref + 'sessions*');
    return true;
  }
  await ctx.send(
    '> 📡 *SESSION: ' + s.name.toUpperCase() + '* ' + (ICONS[s.status] || '') + '\n\n' +
    '🆔 *ID:* ' + s.id + (s.isDefault ? ' _(Standard)_ ⭐' : '') + '\n' +
    '📊 *Status:* ' + s.status + '\n' +
    '📱 *Nummer:* ' + s.phone + '\n' +
    '🔌 *Quelle:* ' + (s.source === 'live' ? 'dieser Bot-Prozess' : s.source === 'spawned' ? 'Kind-Prozess' : 'externe Instanz') + '\n\n' +
    '⏱️ *Uptime:* ' + s.uptime + '\n' +
    '👥 *Gruppen:* ' + fmt(s.groups) + '\n' +
    '💬 *Nachrichten:* ' + fmt(s.messages) + '\n' +
    '⚡ *Befehle:* ' + fmt(s.commands) + '\n' +
    '🧠 *RAM:* ' + s.memoryMb + ' MB\n' +
    '🔄 *Reconnects:* ' + s.reconnects + ' · 🐞 *Fehler:* ' + s.errors + '\n' +
    '👀 *Zuletzt gesehen:* ' + (s.lastSeen ? new Date(s.lastSeen).toLocaleString('de-DE') : '—') + '\n\n' + LINE + '\n' +
    '❥ *' + ctx.pref + 'sessionstats* · *' + ctx.pref + 'sessionhealth* · *' + ctx.pref + 'sessionlogs*'
  );
  return true;
});

cmd('sessionstats', async (ctx) => {
  const id = ctx.args[0]?.replace(/^@/, '') || 'main';
  const s = SM.getSession(id);
  if (!s) { await ctx.send('> ❌ Session *' + id + '* nicht gefunden.'); return true; }
  const perMinMsg = s.uptimeSec ? (s.messages / Math.max(1, s.uptimeSec / 60)).toFixed(1) : '0';
  const perMinCmd = s.uptimeSec ? (s.commands / Math.max(1, s.uptimeSec / 60)).toFixed(1) : '0';
  await ctx.send(
    '> 📊 *SESSION-STATS: ' + s.name.toUpperCase() + '*\n\n' +
    '💬 Nachrichten: *' + fmt(s.messages) + '* _(' + perMinMsg + '/Min)_\n' +
    '⚡ Befehle: *' + fmt(s.commands) + '* _(' + perMinCmd + '/Min)_\n' +
    '👥 Gruppen: *' + fmt(s.groups) + '*\n' +
    '🔄 Reconnects: *' + s.reconnects + '*\n' +
    '🐞 Fehler: *' + s.errors + '*\n' +
    '🧠 RAM: *' + s.memoryMb + ' MB*\n' +
    '⏱️ Uptime: *' + s.uptime + '*'
  );
  return true;
});

cmd('sessionhealth', async (ctx) => {
  const list = SM.listSessions();
  if (!list.length) { await ctx.send('> 📡 Keine Sessions registriert.'); return true; }
  const body = list.map((s) =>
    s.health.emoji + ' *' + s.name + '* — ' + s.health.label + '\n     _' + s.status + ' · ' + s.reconnects + ' Reconnects · ' + s.errors + ' Fehler_'
  ).join('\n');
  const bad = list.filter((s) => s.health.code !== 'HEALTHY').length;
  await ctx.send(
    '> 🩺 *SESSION HEALTH CHECK*\n\n' + body + '\n\n' + LINE + '\n' +
    (bad === 0 ? '✅ _Alle Sessions gesund._' : '⚠️ _' + bad + ' Session(s) brauchen Aufmerksamkeit._')
  );
  return true;
});

cmd('sessionlogs sessionactivity', async (ctx) => {
  const acts = SM.recentActivity(15);
  if (!acts.length) { await ctx.send('> 📜 Noch keine Aktivität protokolliert.'); return true; }
  const body = acts.map((a) => {
    const t = new Date(a.ts).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    return t + ' ' + a.text;
  }).join('\n');
  await ctx.send('> 📜 *SESSION-AKTIVITÄT* _(letzte 15)_\n\n' + body);
  return true;
});

/* ── Lifecycle ────────────────────────────────────────────────────────── */
cmd('newsession', async (ctx) => {
  const name = ctx.args.join(' ').trim() || ('Session_' + (SM.listSessions().length + 1));
  const { id, spawned } = SM.createSession(name, { source: SM.spawnConfigured() ? 'spawned-candidate' : 'external', spawn: SM.spawnConfigured() });
  let text =
    '> ✅ *NEUE SESSION ERSTELLT*\n\n' +
    '🆔 *ID:* ' + id + '\n' +
    '📛 *Name:* ' + name + '\n' +
    '📶 *Status:* WAITING_FOR_AUTH\n\n';
  if (spawned) {
    text += '🚀 Ein zweiter Bot-Prozess wurde gestartet und verbindet sich gleich.\n' +
      '📱 Auth: QR/Pairing über Terminal oder Dashboard der neuen Instanz.\n\n' +
      '❥ *' + ctx.pref + 'sessions* — Status beobachten';
  } else {
    text +=
      '📡 *So wird sie aktiv:*\n' +
      '1⃣ Zweite LoveBot-Instanz starten mit:\n     _LOVEBOT_SESSION_ID=' + id + ' LOVEBOT_SESSION_DIR=Sessions/' + id + ' node Love.js_\n' +
      '2⃣ Dort QR scannen oder Pairing-Code eingeben\n' +
      '3⃣ Verbindung erscheint automatisch hier & im Web-Session-Center\n\n' +
      '💡 _Auto-Spawn lässt sich in Database/sessions.json aktivieren_ _(config.spawn.enabled)_.';
  }
  await ctx.send(text);
  return true;
});

cmd('startsession', async (ctx) => {
  const id = ctx.args[0]?.replace(/^@/, '');
  if (!id) { await ctx.send('> ❓ Verwendung: *' + ctx.pref + 'startsession <id>*'); return true; }
  if (!SM.getSession(id)) { await ctx.send('> ❌ Session *' + id + '* nicht gefunden — erst *' + ctx.pref + 'newsession*.'); return true; }
  if (!SM.spawnConfigured()) {
    await ctx.send('> 🔒 *Auto-Spawn ist deaktiviert.*\n\nStarte die Instanz manuell:\n_LOVEBOT_SESSION_ID=' + id + ' LOVEBOT_SESSION_DIR=Sessions/' + id + ' node Love.js_\n\n💡 Aktivierbar in _Database/sessions.json_ → _config.spawn.enabled_.');
    return true;
  }
  const ok = SM.spawnSession(id);
  await ctx.send(ok ? '> 🚀 Session *' + id + '* wird gestartet …' : '> ❌ Start fehlgeschlagen — siehe *' + ctx.pref + 'sessionlogs*.');
  return true;
});

cmd('restartsession reloadsession reconnectsession', async (ctx) => {
  const id = ctx.args[0]?.replace(/^@/, '') || 'main';
  if (!SM.getSession(id)) { await ctx.send('> ❌ Session *' + id + '* nicht gefunden.'); return true; }
  if (id === 'main') {
    await ctx.send('> 🔄 *Main-Session:* Der Haupt-Bot reconnectet automatisch bei Verbindungsproblemen.\nEin richtiger Neustart läuft über den Server/Server-Manager (_pm2 restart_ o. ä.), nicht über den Chat — Sicherheit zuerst. 🛡️');
    return true;
  }
  const ok = await withLock(ctx, id, 'RESTART', async () => {
    SM.stopSpawned(id);
    return SM.spawnConfigured() ? SM.spawnSession(id) : false;
  });
  if (ok === null) return true;
  await ctx.send(ok
    ? '> 🔄 Session *' + id + '* neu gestartet.'
    : '> ℹ️ Session *' + id + '* ist keine gespawnte Instanz — Neustart erfolgt auf ihrem eigenen Host.');
  return true;
});

cmd('killsession stopsession', async (ctx) => {
  const id = ctx.args[0]?.replace(/^@/, '');
  if (!id) { await ctx.send('> ❓ Verwendung: *' + ctx.pref + 'killsession <id>*\n\n🛑 Stoppt die Verbindung — Credentials bleiben erhalten.'); return true; }
  if (id === 'main') {
    await ctx.send('> 🛑 *Main-Session geschützt.*\nDie Hauptverbindung kannst du nicht aus dem Chat heraus killen — sonst sperrt sich der Bot selbst aus. 😅\n\n💡 Für gespawnte Sessions: *' + ctx.pref + 'killsession <id>*');
    return true;
  }
  const res = await withLock(ctx, id, 'STOP', async () => SM.stopSession(id, actorOf(ctx)));
  if (!res) return true;
  if (res.ok) {
    await ctx.send('> 🛑 Session *' + id + '* gestoppt _(desiredState: stopped — kein Auto-Start)_.\n\n🔐 Credentials bleiben erhalten — Reaktivieren: *' + ctx.pref + 'resumesession ' + id + '*');
  } else if (res.reason === 'not_spawned') {
    await ctx.send('> ℹ️ *' + id + '* ist keine gespawnte Session — Registry auf stopped gesetzt; stoppe den Prozess auf ihrem Host.');
  } else if (res.reason === 'not_running') {
    await ctx.send('> ℹ️ Session *' + id + '* läuft gar nicht.');
  } else {
    await ctx.send('> ❌ Stoppen fehlgeschlagen — siehe *' + ctx.pref + 'sessionlogs*.');
  }
  return true;
});

cmd('delsession', async (ctx) => {
  const id = ctx.args[0]?.replace(/^@/, '');
  if (!id) { await ctx.send('> ❓ Verwendung: *' + ctx.pref + 'delsession <id>*\n\n🗑️ Entfernt die Session aus der Registry. Credentials werden NICHT gelöscht.'); return true; }
  const res = await withLock(ctx, id, 'DELETE', async () => SM.deleteSession(id, { actor: actorOf(ctx) }));
  if (!res) return true;
  if (res.ok) {
    await ctx.send('> 🗑️ Session *' + id + '* aus der Registry entfernt.\n\n🔐 Der Session-Ordner _Sessions/' + id + '_ bleibt unberührt — bei Bedarf manuell löschen.');
  } else if (res.reason === 'main_protected') {
    await ctx.send('> 🛡️ Die *Main-Session* kann nicht gelöscht werden.');
  } else {
    await ctx.send('> ❌ Session *' + id + '* nicht gefunden.');
  }
  return true;
});

/* ── Verwaltung ───────────────────────────────────────────────────────── */
cmd('sessionname sessionrename', async (ctx) => {
  const id = ctx.args[0]?.replace(/^@/, '');
  const name = ctx.args.slice(1).join(' ').trim();
  if (!id || !name) { await ctx.send('> ❓ Verwendung: *' + ctx.pref + 'sessionname <id> <neuer name>*'); return true; }
  const s = SM.renameSession(id, name);
  await ctx.send(s ? '> ✏️ Session *' + id + '* heißt jetzt *' + s.name + '*.' : '> ❌ Session *' + id + '* nicht gefunden.');
  return true;
});

cmd('sessiondefault', async (ctx) => {
  const id = ctx.args[0]?.replace(/^@/, '');
  if (!id) { await ctx.send('> ❓ Verwendung: *' + ctx.pref + 'sessiondefault <id>*'); return true; }
  const ok = SM.setDefault(id);
  await ctx.send(ok ? '> ⭐ *' + id + '* ist jetzt die Standard-Session.' : '> ❌ Session *' + id + '* nicht gefunden.');
  return true;
});

cmd('sessionqr sessioncode sessionpair', async (ctx) => {
  await ctx.send(
    '> 📱 *QR / PAIRING — WO?*\n\n' +
    'QR-Code und Pairing-Code erscheinen aus Sicherheitsgründen _nicht im Gruppen-Chat_, sondern:\n\n' +
    '❥ Im **Terminal** der jeweiligen Instanz\n' +
    '❥ Im **Dashboard** unter Session → *Verbinden*\n\n' +
    '📡 Status der Sessions: *' + ctx.pref + 'sessions*\n' +
    '🆕 Neue Session: *' + ctx.pref + 'newsession <name>*'
  );
  return true;
});

cmd('pairing', async (ctx) => {
  await ctx.send('> 🔗 Pairing-Code wird im **Terminal** oder **Dashboard** erzeugt — nie im Chat. 🛡️\nSiehe *' + ctx.pref + 'sessionqr*');
  return true;
});

/* ── Session 3.0: Profil · Clone · Wartung · Events · Einzelwerte ───── */

cmd('sessionprofile', async (ctx) => {
  const id = ctx.args[0]?.replace(/^@/, '') || 'main';
  const s = SM.getSession(id);
  if (!s) { await ctx.send('> ❌ Session *' + id + '* nicht gefunden.'); return true; }
  const prof = s.profile || { prefix: '$', language: 'de', theme: 'romantic', mode: 'public', features: {} };
  const FEAT = { love: '❤️ Love', economy: '💎 Economy', pets: '🐶 Pets', games: '🎮 Games', ai: '🤖 AI', moderation: '🛡️ Moderation' };
  const featLines = Object.entries(FEAT).map(([k, label]) => {
    const v = prof.features?.[k] || 'inherit';
    const badge = v === 'inherit' ? '🌐 geerbt' : v === 'on' ? '✅ AN' : '❌ AUS';
    return badge + ' ' + label;
  }).join('\n');
  await ctx.send(
    '> ⚙️ *SESSION-PROFIL: ' + s.name.toUpperCase() + '*\n\n' +
    '❥ *Präfix:* ' + prof.prefix + '\n' +
    '❥ *Sprache:* ' + prof.language + '\n' +
    '❥ *Theme:* ' + prof.theme + '\n' +
    '❥ *Modus:* ' + prof.mode + '\n\n' +
    '*Features* _(Global → Session)_:\n' + featLines + '\n\n' + LINE + '\n' +
    '❥ *' + ctx.pref + 'sessionset ' + id + ' prefix #*\n' +
    '❥ *' + ctx.pref + 'sessionfeature ' + id + ' pets off*'
  );
  return true;
});

cmd('sessionset', async (ctx) => {
  const id = ctx.args[0]?.replace(/^@/, '');
  const key = ctx.args[1]?.toLowerCase();
  const value = ctx.args.slice(2).join(' ').trim();
  if (!id || !key || !value) {
    await ctx.send('> ❓ Verwendung: *' + ctx.pref + 'sessionset <id> <prefix|language|theme|mode> <wert>*');
    return true;
  }
  const prof = SM.setSessionProfileField(id, key, value);
  if (prof) {
    await ctx.send('> ✅ Profil *' + id + '* aktualisiert: *' + key + ' = ' + value + '*\n\n💡 Präfix-Änderungen greifen beim nächsten Start der Session.');
  } else {
    await ctx.send('> ❌ Nicht gesetzt — Session oder Schlüssel unbekannt. Erlaubt: _prefix, language, theme, mode_.');
  }
  return true;
});

cmd('sessionfeature', async (ctx) => {
  const id = ctx.args[0]?.replace(/^@/, '');
  const feature = ctx.args[1]?.toLowerCase();
  const value = ctx.args[2]?.toLowerCase();
  if (!id || !feature || !value) {
    await ctx.send('> ❓ Verwendung: *' + ctx.pref + 'sessionfeature <id> <love|economy|pets|games|ai|moderation> <inherit|on|off>*');
    return true;
  }
  const prof = SM.setSessionFeature(id, feature, value);
  if (prof) {
    await ctx.send('> 🧩 Feature *' + feature + '* für *' + id + '* → *' + value + '*');
  } else {
    await ctx.send('> ❌ Unbekannte Session, Feature oder Wert _(inherit|on|off)_.');
  }
  return true;
});

cmd('sessionclone', async (ctx) => {
  const srcId = ctx.args[0]?.replace(/^@/, '');
  const newName = ctx.args.slice(1).join(' ').trim();
  if (!srcId || !newName) {
    await ctx.send('> ❓ Verwendung: *' + ctx.pref + 'sessionclone <quell-id> <neuer name>*\n\n🧬 Kopiert Profil & Einstellungen — *niemals* WhatsApp-Credentials. Die neue Session braucht ihre eigene Auth (QR/Pairing).');
    return true;
  }
  const res = SM.cloneSession(srcId, newName);
  if (res.ok) {
    await ctx.send(
      '> 🧬 *SESSION GEKLONT*\n\n' +
      '📤 Quelle: *' + srcId + '*\n' +
      '🆕 Neu: *' + res.id + '* („' + res.name + '“)\n\n' +
      '✅ Profil, Features & Einstellungen kopiert\n' +
      '🔐 Credentials **nicht** kopiert — eigene Auth nötig:\n     _LOVEBOT_SESSION_ID=' + res.id + ' LOVEBOT_SESSION_DIR=Sessions/' + res.id + ' node Love.js_'
    );
  } else {
    await ctx.send('> ❌ Quell-Session *' + srcId + '* nicht gefunden.');
  }
  return true;
});

cmd('sessionexport sessionbackup', async (ctx) => {
  const id = ctx.args[0]?.replace(/^@/, '') || 'main';
  const s = SM.getSession(id);
  if (!s) { await ctx.send('> ❌ Session *' + id + '* nicht gefunden.'); return true; }
  const safe = { ...s, health: undefined };
  await ctx.send(
    '> 📦 *SESSION-EXPORT: ' + id + '*\n\n```json\n' + JSON.stringify(safe, null, 2) + '\n```\n\n' +
    '🔐 Enthält nur Registry-Daten (Nummer maskiert) — *keine* WhatsApp-Credentials.'
  );
  return true;
});

cmd('sessionmaintenance', async (ctx) => {
  const id = ctx.args[0]?.replace(/^@/, '');
  const mode = ctx.args[1]?.toLowerCase();
  if (!id || !['on', 'off'].includes(mode)) {
    await ctx.send('> ❓ Verwendung: *' + ctx.pref + 'sessionmaintenance <id> <on|off>*');
    return true;
  }
  const s = SM.setMaintenance(id, mode === 'on');
  if (s) {
    await ctx.send('> 🛠️ Wartungsmodus für *' + s.name + '*: *' + (mode === 'on' ? 'AN' : 'AUS') + '*');
  } else {
    await ctx.send('> ❌ Session *' + id + '* nicht gefunden.');
  }
  return true;
});

cmd('sessionevents', async (ctx) => {
  const id = ctx.args[0]?.replace(/^@/, '') || 'main';
  const acts = SM.sessionActivity(id, 12);
  if (!SM.getSession(id)) { await ctx.send('> ❌ Session *' + id + '* nicht gefunden.'); return true; }
  if (!acts.length) { await ctx.send('> 📜 Keine Events für *' + id + '* protokolliert.'); return true; }
  const body = acts.map((a) => new Date(a.ts).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + ' ' + a.text).join('\n');
  await ctx.send('> 📜 *EVENTS: ' + id + '* _(letzte 12)_\n\n' + body);
  return true;
});

cmd('sessionerrors', async (ctx) => {
  const id = ctx.args[0]?.replace(/^@/, '') || 'main';
  if (!SM.getSession(id)) { await ctx.send('> ❌ Session *' + id + '* nicht gefunden.'); return true; }
  const errs = SM.sessionActivity(id, 10, 'error');
  const s = SM.getSession(id);
  if (!errs.length && !s.errors) { await ctx.send('> ✅ Keine Fehler für *' + id + '* — alles sauber!'); return true; }
  const body = errs.length ? errs.map((a) => new Date(a.ts).toLocaleTimeString('de-DE') + ' ' + a.text).join('\n') : '_(nur Zähler, keine Details)_';
  await ctx.send('> 🐞 *FEHLER: ' + id + '* _(gesamt: ' + s.errors + ')_\n\n' + body);
  return true;
});

cmd('sessiongroups', async (ctx) => {
  const s = SM.getSession(ctx.args[0]?.replace(/^@/, '') || 'main');
  if (!s) { await ctx.send('> ❌ Session nicht gefunden.'); return true; }
  await ctx.send('> 👥 *' + s.name + '* betreut *' + fmt(s.groups) + '* Gruppen.');
  return true;
});

cmd('sessionmessages', async (ctx) => {
  const s = SM.getSession(ctx.args[0]?.replace(/^@/, '') || 'main');
  if (!s) { await ctx.send('> ❌ Session nicht gefunden.'); return true; }
  await ctx.send('> 💬 *' + s.name + '* hat *' + fmt(s.messages) + '* Nachrichten verarbeitet.');
  return true;
});

cmd('sessioncommands', async (ctx) => {
  const s = SM.getSession(ctx.args[0]?.replace(/^@/, '') || 'main');
  if (!s) { await ctx.send('> ❌ Session nicht gefunden.'); return true; }
  await ctx.send('> ⚡ *' + s.name + '* hat *' + fmt(s.commands) + '* Befehle ausgeführt.');
  return true;
});

cmd('sessionusers', async (ctx) => {
  await ctx.send('> 👤 Nutzer-Statistiken sind bot-weit (nicht pro Session) — siehe *' + ctx.pref + 'system* / *$top*.');
  return true;
});

/* ── Session 4.0: Lock-Schutz für Lifecycle-Aktionen ────────────────── */
function actorOf(ctx) {
  return ctx.userProfile?.registration?.name || ctx.msg?.pushName || 'owner';
}

async function withLock(ctx, id, op, fn) {
  const lock = SM.acquireLock(id, op, actorOf(ctx));
  if (!lock.ok) {
    const held = lock.held || {};
    await ctx.send(
      '> ⏳ *Session „' + id + '“ ist gerade beschäftigt.*\n\n' +
      '🔄 Laufende Operation: *' + (held.op || '?') + '*\n' +
      '👤 Angefordert von: *' + (held.by || 'system') + '*\n\n' +
      '_Bitte warten, bis sie abgeschlossen ist._ 🛡️'
    );
    return null;
  }
  try {
    return await fn();
  } finally {
    SM.releaseLock(id);
  }
}

/* ── Session 4.0: Pause · Resume · AutoStart · Tags · Env · Fleet ────── */

cmd('pausesession', async (ctx) => {
  const id = ctx.args[0]?.replace(/^@/, '');
  if (!id) { await ctx.send('> ❓ Verwendung: *' + ctx.pref + 'pausesession <id>*\n\n⏸️ Pausiert eine Session vorübergehend — Credentials & desiredState bleiben, Resume jederzeit.'); return true; }
  if (id === 'main') { await ctx.send('> 🛡️ *Main-Session geschützt* — pausieren wäre ein Selbst-Aussperren. 😅'); return true; }
  const res = await withLock(ctx, id, 'PAUSE', async () => SM.pauseSession(id, actorOf(ctx)));
  if (!res) return true;
  if (res.ok) await ctx.send('> ⏸️ Session *' + id + '* pausiert.\n\n🔓 Resume: *' + ctx.pref + 'resumesession ' + id + '*\n🔐 Credentials bleiben erhalten.');
  else if (res.reason === 'already_paused') await ctx.send('> ℹ️ Session *' + id + '* ist bereits pausiert.');
  else await ctx.send('> ❌ Session *' + id + '* nicht gefunden.');
  return true;
});

cmd('resumesession', async (ctx) => {
  const id = ctx.args[0]?.replace(/^@/, '');
  if (!id) { await ctx.send('> ❓ Verwendung: *' + ctx.pref + 'resumesession <id>*'); return true; }
  const res = await withLock(ctx, id, 'RESUME', async () => SM.resumeSession(id, actorOf(ctx)));
  if (!res) return true;
  if (res.ok) await ctx.send('> ▶️ Session *' + id + '* reaktiviert — *desiredState: running*.\n\n' + (SM.getSession(id)?.source === 'spawned' ? '🚀 Gespawnte Instanz wird gestartet …' : '📡 Externe Instanz verbindet sich beim nächsten Start selbst.'));
  else await ctx.send('> ❌ Session *' + id + '* nicht gefunden.');
  return true;
});

cmd('sessionautostart', async (ctx) => {
  const id = ctx.args[0]?.replace(/^@/, '');
  const mode = ctx.args[1]?.toLowerCase();
  if (!id || !['on', 'off'].includes(mode)) { await ctx.send('> ❓ Verwendung: *' + ctx.pref + 'sessionautostart <id> <on|off>*\n\n⚡ Auto-Start: nach Neustart automatisch wieder hochkommen (Warm Restart).'); return true; }
  const s = SM.setAutoStart(id, mode === 'on');
  await ctx.send(s ? '> ⚡ Auto-Start für *' + id + '*: *' + mode.toUpperCase() + '*' : '> ❌ Session nicht gefunden.');
  return true;
});

cmd('sessiontags', async (ctx) => {
  const id = ctx.args[0]?.replace(/^@/, '');
  const tags = ctx.args.slice(1).join(' ');
  if (!id || !tags) { await ctx.send('> ❓ Verwendung: *' + ctx.pref + 'sessiontags <id> <tag1 tag2 …>*\n\nBeispiel: *$sessiontags soul_02 production primary*'); return true; }
  const s = SM.setTags(id, tags);
  await ctx.send(s ? '> 🏷️ Tags für *' + id + '*: ' + (s.tags.length ? s.tags.map((t) => '`' + t + '`').join(' · ') : '_keine_') : '> ❌ Session nicht gefunden.');
  return true;
});

cmd('sessionenv', async (ctx) => {
  const id = ctx.args[0]?.replace(/^@/, '');
  const env = ctx.args[1]?.toLowerCase();
  if (!id || !env) { await ctx.send('> ❓ Verwendung: *' + ctx.pref + 'sessionenv <id> <production|testing|development>*'); return true; }
  const s = SM.setEnv(id, env);
  await ctx.send(s ? '> 🧪 Environment für *' + id + '*: *' + s.env + '*' : '> ❌ Session nicht gefunden oder ungültiges Environment.');
  return true;
});

cmd('fleet', async (ctx) => {
  const f = SM.fleetStats();
  await ctx.send(
    '> 📡 *LOVE BOT — SESSION FLEET*\n\n' +
    '🗄️ *Managed:* ' + f.managed + '   🟢 *Running:* ' + f.running + '\n' +
    '⏸️ *Paused:* ' + f.paused + '   🟣 *Auth nötig:* ' + f.authRequired + '\n' +
    '⚫ *Stopped:* ' + f.stopped + '   🔴 *Error/Offline:* ' + f.error + '\n\n' +
    '📈 *Ø Verfügbarkeit:* ' + (f.avgUptimePct == null ? '—' : f.avgUptimePct + '%') + '\n\n' + LINE + '\n' +
    '❥ *' + ctx.pref + 'sessions* — Einzelansicht\n' +
    '❥ *' + ctx.pref + 'restartfailed* — fehlgeschlagene neu starten\n' +
    '❥ *' + ctx.pref + 'sessionhealth* — Health-Check'
  );
  return true;
});

cmd('restartfailed', async (ctx) => {
  const results = SM.restartFailed(actorOf(ctx));
  if (!results.length) { await ctx.send('> ✅ *Keine fehlgeschlagenen Sessions* mit desiredState „running“. Alles gut!'); return true; }
  const body = results.map((r) => '❥ *' + r.id + '* — ' + (r.restarted ? '🚀 neu gestartet' : 'ℹ️ ' + (r.note || 'übersprungen'))).join('\n');
  await ctx.send('> 🔄 *RESTART FAILED SESSIONS*\n\n' + body);
  return true;
});

cmd('orphansessions sessionorphans', async (ctx) => {
  const orphans = SM.detectOrphanSessionDirs();
  if (!orphans.length) {
    await ctx.send('> ✅ *Keine Phantom-Sessions* — jeder Session-Ordner hat einen Registry-Eintrag.');
  } else {
    await ctx.send(
      '> 👻 *PHANTOM-SESSIONS ERKANNT*\n\n' +
      'Diese Ordner liegen unter _Sessions/_, haben aber **keinen** Registry-Eintrag:\n\n' +
      orphans.map((o) => '❥ `' + o + '`').join('\n') + '\n\n' +
      '💡 Registrieren: *' + ctx.pref + 'newsession <name>* mit passender ID starten — oder Ordner aufräumen. _Es wird nichts automatisch gelöscht._ 🛡️'
    );
  }
  return true;
});

/* ═══════════════════════════════════════════════════════════════════ */
/*  Einsprung aus Love.js (default-Case, VOR LovePlus)                  */
/* ═══════════════════════════════════════════════════════════════════ */
export const SESSION_HELP_CMDS = [
  ['$sessions', 'Alle Sessions mit Status & Uptime 📡 (Owner)'],
  ['$session <id>', 'Details einer Session (Owner)'],
  ['$sessionstats <id>', 'Nachrichten, Befehle/Min, RAM, Reconnects (Owner)'],
  ['$sessionhealth', 'Health-Check aller Sessions 🩺 (Owner)'],
  ['$sessionlogs', 'Letzte Session-Aktivität 📜 (Owner)'],
  ['$newsession <name>', 'Neue Session anlegen 🆕 (Owner)'],
  ['$startsession <id>', 'Gespawnte Session starten 🚀 (Owner)'],
  ['$restartsession <id>', 'Session neu starten 🔄 (Owner)'],
  ['$killsession <id>', 'Verbindung stoppen — Credentials bleiben 🛑 (Owner)'],
  ['$delsession <id>', 'Aus Registry entfernen 🗑️ (Owner)'],
  ['$sessionname <id> <name>', 'Session umbenennen ✏️ (Owner)'],
  ['$sessiondefault <id>', 'Standard-Session setzen ⭐ (Owner)'],
  ['$sessionqr', 'Wo QR/Pairing-Code erscheinen 📱 (Owner)'],
  ['$sessionprofile <id>', 'Profil der Session: Präfix, Theme, Features ⚙️ (Owner)'],
  ['$sessionset <id> <key> <wert>', 'Profil ändern: prefix/language/theme/mode (Owner)'],
  ['$sessionfeature <id> <f> <inherit|on|off>', 'Feature-Override pro Session 🧩 (Owner)'],
  ['$sessionclone <id> <name>', 'Session klonen (nur Profil, nie Credentials) 🧬 (Owner)'],
  ['$sessionexport <id>', 'Registry-Export als JSON 📦 (Owner)'],
  ['$sessionmaintenance <id> <on|off>', 'Wartungsmodus 🛠️ (Owner)'],
  ['$sessionevents <id>', 'Events einer Session 📜 (Owner)'],
  ['$sessionerrors <id>', 'Fehler einer Session 🐞 (Owner)'],
  ['$sessiongroups <id>', 'Anzahl Gruppen einer Session 👥 (Owner)'],
  ['$sessionmessages <id>', 'Nachrichten-Zähler 💬 (Owner)'],
  ['$sessioncommands <id>', 'Befehls-Zähler ⚡ (Owner)'],
  ['$pausesession <id>', 'Vorübergehend pausieren ⏸️ — Credentials bleiben (Owner)'],
  ['$resumesession <id>', 'Pausierte/gestoppte Session reaktivieren ▶️ (Owner)'],
  ['$sessionautostart <id> <on|off>', 'Auto-Start nach Neustart (Warm Restart) ⚡ (Owner)'],
  ['$sessiontags <id> <tags…>', 'Tags setzen 🏷️ z. B. production primary (Owner)'],
  ['$sessionenv <id> <production|testing|development>', 'Environment setzen 🧪 (Owner)'],
  ['$fleet', 'Fleet-Übersicht: Managed vs Running vs Paused 📡 (Owner)'],
  ['$restartfailed', 'Fehlgeschlagene Sessions neu starten 🔄 (Owner)'],
  ['$orphansessions', 'Phantom-Ordner in Sessions/ finden 👻 (Owner)']
];


/* ── 📚 Registry-Abfragen (Owner) — Befehle einmal definieren, überall ── */
cmd('cmdinfo', async (ctx) => {
  const name = (ctx.args || []).join(' ').replace(/^\$/, '').trim() || String(ctx.text || '').replace(/^\$/, '').trim();
  if (!name) {
    await ctx.send('> 📚 *CMDINFO*\n\nNutze: *$cmdinfo <befehl>*\nBeispiel: *$cmdinfo marry*');
    return true;
  }
  const c = regResolve(name);
  if (!c) {
    await ctx.send('> ❌ *„' + name + '“ nicht in der Registry.*\n\n💡 Versuche *$cmdsuche ' + name + '*');
    return true;
  }
  await ctx.send(
    '> 📚 *REGISTRY: ' + c.name.toUpperCase() + '*\n\n' +
    'Kategorie: ' + c.emoji + ' ' + c.categoryTitle + '\n' +
    'Usage: *' + c.usage + '*\n' +
    'Beschreibung: ' + c.desc + '\n' +
    'Aliase: ' + (c.aliases.length ? c.aliases.map((a) => '$' + a).join(', ') : '—') + '\n' +
    'Rechte: ' + (c.perms === 'owner' ? '👑 Owner' : c.perms === 'admin' ? '🛡️ Admin' : '🌐 Alle') + '\n' +
    'Cooldown: ' + c.cooldown + 's\n' +
    'Quelle: registry/commands.json'
  );
  return true;
});

cmd('cmdsuche cmdsearch', async (ctx) => {
  const q = (ctx.args || []).join(' ').trim() || String(ctx.text || '').trim();
  if (!q) {
    await ctx.send('> 🔎 *CMDSUCHE*\n\nNutze: *$cmdsuche <begriff>*\nBeispiel: *$cmdsuche session*');
    return true;
  }
  const hits = regSearch(q, 15);
  if (!hits.length) { await ctx.send('> 🔎 Keine Treffer für *“' + q + '”*.'); return true; }
  const st = regStats();
  await ctx.send(
    '> 🔎 *SUCHE: „' + q + '“* — ' + hits.length + ' Treffer\n\n' +
    hits.map((c) => c.emoji + ' *$' + c.name + '* — ' + c.desc.slice(0, 60)).join('\n') +
    '\n\n━━━━━━━━━━━━━━━━━━━━\n📚 Registry: ' + st.commands + ' Befehle · ' + st.aliases + ' Aliase · ' + st.categories + ' Kategorien'
  );
  return true;
});

export async function handleSessionCommand(ctx) {
  const fn = COMMANDS.get(String(ctx.command || '').toLowerCase());
  if (!fn) return false;

  /* 👑 Owner-Gate: nur Host-Gerät (Bot-/Owner-Nummer) */
  if (!ctx.isHost) {
    await ctx.sock.sendMessage(ctx.from, {
      text: '> 👑 *OWNER-ONLY*\n\nDie Session-Verwaltung ist ausschließlich dem Owner vorbehalten. 🛡️'
    }, { quoted: ctx.msg });
    return true;
  }

  const enriched = {
    ...ctx,
    send: (text) => ctx.sock.sendMessage(ctx.from, { text }, { quoted: ctx.msg })
  };

  try {
    return (await fn(enriched)) === true;
  } catch (err) {
    console.error('[sessions] Fehler bei "' + ctx.command + '":', err?.message || err);
    try {
      await ctx.sock.sendMessage(ctx.from, { text: '> ⚠️ Session-Befehl fehlgeschlagen — siehe Logs.' }, { quoted: ctx.msg });
    } catch (e) {}
    return true;
  }
}

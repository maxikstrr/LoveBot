/* ═══════════════════════════════════════════════════════════════════════
   LoveBot — Team & Ticket-Selbsttest (Ränge · Rechte · Tickets)
   Prüft die Nutzer-Anforderungen:
     · Inhaber (owner) darf ALLES
     · Stellv. Inhaber:in (deputy) darf VIEL — aber KEINE Ränge vergeben
     · Supporter (supporter) darf NUR Tickets (lesen/beantworten/schließen)
     · Ticket-System: erstellen → Dev-Gruppe → antworten (DM) → schließen
   Sicher: Database/tickets.json wird gesichert & wiederhergestellt.
   ═══════════════════════════════════════════════════════════════════════ */
import fs from 'fs';

const T_FILE = 'Database/tickets.json';
const BACKUP = '/tmp/tickets.selftest-backup';
let hadBackup = false;
try { fs.copyFileSync(T_FILE, BACKUP); hadBackup = true; } catch (e) {}

let fails = 0;
const check = (name, ok, extra = '') => {
  console.log(`  ${name} → ${ok ? 'OK' : 'FAIL'}${extra ? '  ' + extra : ''}`);
  if (!ok) fails++;
};

try {
  const rbac = await import('../night/rbac.js');
  const tk = await import('../tickets.js');

  console.log('═══ 1 · Rang-Hierarchie & Rechte (night/rbac.js) ═══');
  check('Rollen existieren: owner · deputy · supporter', !!rbac.ROLES.owner && !!rbac.ROLES.deputy && !!rbac.ROLES.supporter,
    `· ${rbac.ROLES.deputy.label}`);
  check('Level: owner(100) > deputy(90) > supporter(40)', rbac.ROLES.owner.level > rbac.ROLES.deputy.level && rbac.ROLES.deputy.level > rbac.ROLES.supporter.level);
  check('👑 Inhaber darf ALLES', rbac.can('owner', 'roles.assign') && rbac.can('owner', 'tickets.manage') && rbac.can('owner', 'users.ban') && rbac.can('owner', 'system.control'));
  check('🔱 Deputy darf VIEL: Tickets, Bans, Broadcast, System, DB', rbac.can('deputy', 'tickets.manage') && rbac.can('deputy', 'users.ban') && rbac.can('deputy', 'broadcast.send') && rbac.can('deputy', 'system.control') && rbac.can('deputy', 'db.backup'));
  check('🔱 Deputy darf KEINE Ränge vergeben (roles.assign ✗)', rbac.can('deputy', 'roles.assign') === false);
  check('🔱 Deputy darf KEINE Accounts anlegen (accounts.manage ✗)', rbac.can('deputy', 'accounts.manage') === false);
  check('◇ Supporter darf NUR Tickets (tickets.manage ✓)', rbac.can('supporter', 'tickets.manage') === true);
  check('◇ Supporter darf NICHTS anderes (users/logs/bans/broadcast ✗)', ['users.view', 'logs.view', 'users.ban', 'broadcast.send', 'roles.assign', 'system.control'].every((p) => rbac.can('supporter', p) === false));
  check('canAssignRole: deputy kann NICHT vergeben', rbac.canAssignRole('deputy', 'supporter') === false && rbac.canAssignRole('deputy', 'deputy') === false);
  check('canAssignRole: owner kann vergeben (außer owner)', rbac.canAssignRole('owner', 'deputy') === true && rbac.canAssignRole('owner', 'supporter') === true && rbac.canAssignRole('owner', 'owner') === false);

  console.log('\n═══ 2 · Ticket-System (tickets.js) ═══');
  tk._resetTickets();
  const mk = tk.createTicket({ creatorJid: '491701234567@s.whatsapp.net', creatorName: 'TestUser', bid: 'b1', text: 'Mein Pet verschwindet immer!' });
  check('Ticket erstellen', mk.ok && mk.ticket.id === 'T-0001' && mk.ticket.status === 'open');
  const mk2 = tk.createTicket({ creatorJid: '491701234567@s.whatsapp.net', creatorName: 'TestUser', text: 'Zweite Frage zur Bank' });
  check('Fortlaufende ID', mk2.ok && mk2.ticket.id === 'T-0002');
  check('Leeres Ticket abgelehnt', tk.createTicket({ creatorJid: '491701234567@s.whatsapp.net', text: '' }).ok === false);
  const dev = tk.ticketDevMessage(mk.ticket);
  check('Dev-Gruppen-Nachricht: ID + Ersteller + Anliegen + Anleitung', dev.includes('T-0001') && dev.includes('TestUser') && dev.includes('Pet') && dev.includes('$ticket answer'));
  const an = tk.answerTicket({ id: 'T-0001', by: '4915155894714@s.whatsapp.net', byName: 'Inhaber', role: 'owner', text: 'Danke, wir schauen uns das an!' });
  check('Antwort anhängen (mit Rolle)', an.ok && an.ticket.answers.length === 1 && an.ticket.answers[0].role === 'owner');
  const dm = tk.ticketAnswerDm(an.ticket, an.ticket.answers[0]);
  check('Antwort-DM an Ersteller', dm.includes('T-0001') && dm.includes('Inhaber') && dm.includes('schauen uns das an'));
  const st = tk.ticketStats();
  check('Statistik', st.total === 2 && st.open === 2 && st.today === 2);
  const cl = tk.closeTicket({ id: 'T-0001', by: '491700000000@s.whatsapp.net', byName: 'Supporti', role: 'supporter', reason: 'Behoben in v7.1.3' });
  check('Supporter schließt Ticket', cl.ok && cl.ticket.status === 'closed' && cl.ticket.closedBy.role === 'supporter');
  check('Doppeltes Schließen abgelehnt', tk.closeTicket({ id: 'T-0001', by: 'x', byName: 'x', role: 'owner' }).error === 'already-closed');
  const cdm = tk.ticketClosedDm(cl.ticket);
  check('Schließen-DM mit Grund', cdm.includes('GESCHLOSSEN') && cdm.includes('Supporti') && cdm.includes('Behoben'));
  const ls = tk.listTickets({ status: 'open' });
  check('Liste offen (1) / geschlossen (1)', ls.length === 1 && tk.listTickets({ status: 'closed' }).length === 1);
  const ro = tk.reopenTicket({ id: 'T-0001', by: '4915155894714@s.whatsapp.net', byName: 'Inhaber', role: 'owner' });
  check('Wieder öffnen', ro.ok && ro.ticket.status === 'open');
  check('Unbekanntes Ticket → not-found', tk.getTicket('T-9999').ok === false);
  const lstTxt = tk.ticketListText(tk.listTickets({ status: 'open' }), { title: 'TICKETS · OFFEN' });
  check('Listen-Text fürs Team', lstTxt.includes('T-0001') && lstTxt.includes('T-0002'));

  console.log('\n═══ 3 · Dev-Gruppe ═══');
  check('setDevGroup: gültige GID', tk.setDevGroup('123456789@g.us').ok === true && tk.getDevGroup() === '123456789@g.us');
  check('setDevGroup: normalisiert (ohne @g.us)', tk.setDevGroup('987654321').ok === true && tk.getDevGroup() === '987654321@g.us');
  check('setDevGroup: Müll abgelehnt', tk.setDevGroup('blablabla').ok === false);
  check('setDevGroup: leer = entfernen', tk.setDevGroup('').ok === true && tk.getDevGroup() === '');

  console.log('\n═══ 4 · Mute-System (mute.js) ═══');
  const mu = await import('../mute.js');
  mu._resetMutes();
  check('parseDuration: 30s=30s · 10m=10min · 2h · 1d · 2w · Plain 5=5min',
    mu.parseDuration('30s') === 30000 &&
    mu.parseDuration('10m') === 600000 &&
    mu.parseDuration('10min') === 600000 &&
    mu.parseDuration('2h') === 7200000 &&
    mu.parseDuration('2std') === 7200000 &&
    mu.parseDuration('1d') === 86400000 &&
    mu.parseDuration('2w') === 1209600000 &&
    mu.parseDuration('5') === 300000);
  check('parseDuration: permanent → null', mu.parseDuration('permanent') === null && mu.parseDuration('perm') === null);
  check('parseDuration: Müll → undefined', mu.parseDuration('hallo') === undefined && mu.parseDuration('') === undefined);
  const mkMu = mu.muteUser({ jid: '491701234567@s.whatsapp.net', by: '4915155894714@s.whatsapp.net', byName: 'Inhaber', untilMs: null, reason: 'Spam' });
  check('$mute ohne Zeit = PERMANENT (until null)', mkMu.ok && mkMu.entry.until === null);
  check('getMute liefert aktiven Mute', mu.getMute('491701234567@s.whatsapp.net')?.reason === 'Spam');
  const mkMu2 = mu.muteUser({ jid: '491709998887@s.whatsapp.net', by: '4915155894714@s.whatsapp.net', untilMs: 3600000 });
  check('$mute mit 1h → until in Zukunft', mkMu2.ok && new Date(mkMu2.entry.until).getTime() > Date.now());
  check('JID mit :device wird normalisiert', mu.getMute('491701234567:5@s.whatsapp.net') !== null);
  const mkMu3 = mu.muteUser({ jid: '491701234567@s.whatsapp.net', by: 'x', untilMs: -1000 });
  check('Abgelaufener Mute wird ignoriert & entfernt', mu.getMute('491701234567@s.whatsapp.net') === null);
  check('listMutes zählt nur aktive', mu.listMutes().length === 1);
  check('formatDuration: permanent/2h/3d', mu.formatDuration(null) === 'permanent' && mu.formatDuration(7200000) === '2 Stunden' && mu.formatDuration(3 * 86400000) === '3 Tage');
  const rmMu = mu.unmuteUser('491709998887@s.whatsapp.net');
  check('$unmute entfernt Mute', rmMu.ok && mu.listMutes().length === 0);
  check('Doppeltes $unmute → not-muted', mu.unmuteUser('491709998887@s.whatsapp.net').error === 'not-muted');
  check('Ungültige JID abgelehnt', mu.muteUser({ jid: 'blah' }).ok === false);
  mu._resetMutes();

  console.log('\n═══ 5 · Web-Team-Verwaltung (rbac-Layer, wie /api/team/add) ═══');
  /* ⚠️ accounts.json ist LIVE — Backup + Restore erzwingen */
  const ACC_FILE = 'Database/accounts.json';
  let accBackup = null;
  try { accBackup = fs.readFileSync(ACC_FILE, 'utf8'); } catch (e) {}
  try {
    const cr = rbac.createAccount({ username: 'selftestteam', number: '490000000001', role: 'supporter', mustChange: true });
    check('Team-Mitglied anlegen (Username + Temp-Passwort)', !!cr.account && cr.tempPassword.length >= 10 && cr.account.username.startsWith('selftestteam'));
    check('Richtige Rolle gesetzt', cr.account.role === 'supporter');
    const byNum = rbac.getAccountByNumber('490000000001');
    check('Über Nummer findbar', !!byNum && byNum.username === cr.account.username);
    check('Username-Eindeutigkeit', rbac.generateUsername('selftestteam', '490000000001') !== cr.account.username);
    rbac.setRole(cr.account.id, 'deputy', 'selftest');
    check('Rang-Änderung (supporter → deputy)', rbac.getAccountByNumber('490000000001').role === 'deputy');
    check('Neuer Deputy: Tickets ja, Ränge nein', rbac.can('deputy', 'tickets.manage') && !rbac.can('deputy', 'roles.assign'));
    /* Duplikat-Schutz (Logik aus /api/team/add) */
    check('Doppelte Nummer erkannt (409-Logik)', !!rbac.getAccountByNumber('490000000001'));
    /* Aufräumen: Test-Account direkt entfernen */
    const db = JSON.parse(fs.readFileSync(ACC_FILE, 'utf8'));
    delete db.accounts[cr.account.id];
    fs.writeFileSync(ACC_FILE, JSON.stringify(db, null, 2), 'utf8');
    check('Test-Account entfernt', !rbac.getAccountByNumber('490000000001'));
  } finally {
    if (accBackup !== null) fs.writeFileSync(ACC_FILE, accBackup, 'utf8');
    else { try { fs.unlinkSync(ACC_FILE); } catch (e) {} }
  }

  console.log('\n═══ 6 · Registry: neue Befehle bekannt ═══');
  const reg = JSON.parse(fs.readFileSync('registry/commands.json', 'utf8'));
  const allCmds = reg.categories.flatMap((c) => c.cmds.map((x) => x.name));
  check('$ticket · $tickets · $setteam registriert', ['ticket', 'tickets', 'setteam'].every((n) => allCmds.includes(n)), `· ${allCmds.length} Befehle gesamt`);
  check('$mute · $unmute · $mutelist registriert', ['mute', 'unmute', 'mutelist'].every((n) => allCmds.includes(n)));

  /* ═══ 7.1.6 ═══ */
  console.log('\n═══ 7 · Panel-Reiter #/ticket + #/ränge & alte Gruppen-Mute entfernt (7.1.6) ═══');
  const gruppeCat = reg.categories.find((c) => c.id === 'gruppe');
  const adminCat = reg.categories.find((c) => c.id === 'admin');
  check('Registry: gruppe hat KEINE mute/unmute-Duplikate mehr', !gruppeCat.cmds.some((x) => x.name === 'mute' || x.name === 'unmute'));
  check('Registry: admin besitzt mute/unmute/mutelist (User-Mute)', ['mute', 'unmute', 'mutelist'].every((n) => adminCat.cmds.some((x) => x.name === n)));
  const love = fs.readFileSync('Love.js', 'utf8');
  const countCase = (n) => (love.match(new RegExp(`case '${n}'`, 'g')) || []).length;
  check('Love.js: genau 1 case mute/unmute (User-Mute, alte Gruppen-Cases weg)', countCase('mute') === 1 && countCase('unmute') === 1);
  check('Love.js: alte Gruppen-Stummschaltung entfernt (kein „GRUPPE STUMMGESCHALTET“)', !love.includes('GRUPPE STUMMGESCHALTET'));
  const napp = fs.readFileSync('public/js/night/app.js', 'utf8');
  check('Night-Panel: Views V.ticket + V.raenge vorhanden', napp.includes('V.ticket =') && napp.includes('V.raenge ='));
  check('Night-Panel: Hash-Aliase #/tickets · #/ränge · #/team', napp.includes('V.tickets = V.ticket') && napp.includes("V['ränge'] = V.raenge") && napp.includes('V.team = V.raenge'));
  check('Night-Panel: APP-Aktionen tkAnswer/tkClose/tkReopen/teamRoleSave/teamAdd', ['tkAnswer', 'tkClose', 'tkReopen', 'teamRoleSave', 'teamAdd'].every((f) => napp.includes('APP.' + f + '(') || napp.includes(f + '(' + f + ')') || napp.includes(f + ' = ') || napp.includes('async ' + f + '(') || napp.includes(f + '(')));
  const nui = fs.readFileSync('public/js/night/ui.js', 'utf8');
  check('Night-Panel: NAV-Einträge Tickets + Ränge & Team', nui.includes("id: 'ticket'") && nui.includes("id: 'raenge'"));
  check('Night-Panel: Tickets-Gate perm tickets.manage, Ränge-Gate roles.assign', nui.includes("perm: 'tickets.manage'") && nui.includes("perm: 'roles.assign'"));

  /* ═══ 7.1.7 ═══ */
  console.log('\n═══ 8 · Mute löscht JDE Nachricht + Design v2 (7.1.7) ═══');
  const love177 = fs.readFileSync('Love.js', 'utf8');
  const earlyIdx = love177.indexOf('7.1.7 MUTE-CHECK (frühste Stelle');
  const autoIdx = love177.indexOf('await runAutoModeration'); /* Handler-Aufruf, nicht die Funktionsdefinition */
  const trimIdx = love177.indexOf('const trimmed = messageText.trim();');
  check('Love.js: früher Mute-Check VOR AutoModeration & Trim-Check (Medien+Chat inklusive)', earlyIdx > -1 && earlyIdx < autoIdx && earlyIdx < trimIdx);
  check('Love.js: früher Mute-Check löscht + continue (Geist-Prinzip)', earlyIdx > -1 && love177.slice(earlyIdx, earlyIdx + 1600).includes('delete: msg.key') && love177.slice(earlyIdx, earlyIdx + 1600).includes('continue;'));
  check('Love.js: früher Check schützt Owner (hostJid + registeredOwner)', earlyIdx > -1 && love177.slice(earlyIdx, earlyIdx + 1300).includes('emIsHost') && love177.slice(earlyIdx, earlyIdx + 1300).includes('getRegisteredOwner'));
  check('Love.js: 2. Schicht (Befehls-Pfad) weiterhin aktiv', love177.includes('MUTE-CHECK (2. Schicht'));
  const ncss = fs.readFileSync('public/css/night.css', 'utf8');
  check('night.css: zentrale Ticket/Ränge-Styles (tk-card · tk-hero · rt-role · tk-filter)', ['.tk-card', '.tk-hero', '.rt-role', '.tk-filter'].every((c) => ncss.includes(c)));
  check('night.css: Rang-Pills farbcodiert (owner/deputy/admin/supporter)', ['.rt-role.owner', '.rt-role.deputy', '.rt-role.admin', '.rt-role.supporter'].every((c) => ncss.includes(c)));
  const napp177 = fs.readFileSync('public/js/night/app.js', 'utf8');
  check('Views v2: Hero-Banner + Stat-Karten + Relativzeit (tkAgo)', napp177.includes('tk-hero') && napp177.includes('tk-stat') && napp177.includes('tkAgo'));
  check('Views v2: Avatar-Initialen + Chat-Bubbles (tk-ava/tk-ans)', napp177.includes('tk-ava') && napp177.includes('tk-ans'));
  const wapp = fs.readFileSync('public/js/app.js', 'utf8');
  check('Dashboard: polierte Karten (dashRolePill · dashAgo · dashInitials)', ['dashRolePill', 'dashAgo', 'dashInitials'].every((f) => wapp.includes('function ' + f)));

  console.log(`\n${fails ? '✘ ' + fails + ' Checks fehlgeschlagen' : '✔ Team & Ticket-Selbsttest erfolgreich'}`);
  process.exitCode = fails ? 1 : 0;
} catch (e) {
  console.log('✘ Testfehler:', e?.stack || e);
  process.exitCode = 1;
} finally {
  if (hadBackup) { try { fs.copyFileSync(BACKUP, T_FILE); } catch (e) {} }
  else { try { fs.unlinkSync(T_FILE); } catch (e) {} }
}

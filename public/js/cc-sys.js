/* ═══════════════════════════════════════════════════════════════
   SOUL ECHO — SYSTEM · PROTOKOLLE · EINLADUNGEN · NOTFALL
   ═══════════════════════════════════════════════════════════════ */

/* ═══ EINLADUNGEN ═══ */
CC.reg('einladungen', async () => {
  const accs = await CCacc();
  const inv = accs.filter((a) => a.mustChange || a.status === 'pending');
  CC.page('📨 Einladungen', 'Offene Einladungen: Accounts mit Einmal-Passwort, die ihr Passwort noch nicht gesetzt haben (mustChange) oder noch nicht freigeschaltet sind.',
    '<div class="cc-section"><h3>Statusmodell-Info</h3><p class="cc-hint">🟡 <b>Ausstehend</b> = Zugang ruht bis zur Freischaltung · <b>Einladung offen</b> = Account hat sein Einmal-Passwort noch nicht gewechselt.<br>Erstellen: ➕ Benutzer erstellen — dort wird das Einmal-Passwort genau EINMAL angezeigt.</p></div>' +
    '<div class="cc-section">' + (inv.length ? CC.table([
      { k: 'username', t: 'Benutzer', f: (r) => '<b>' + esc(r.username) + '</b><div class="cc-key">' + esc(r.number) + '</div>' },
      { k: 'status', t: 'Status', f: (r) => CC.pill(r.status) },
      { k: 'role', t: 'Rolle', f: (r) => CC.rolepill(r.role) },
      { k: 'einlad', t: 'Einladung', f: (r) => r.mustChange ? '<span class="cc-tag warn">🔑 Einmal-Passwort offen</span>' : (r.status === 'pending' ? '<span class="cc-tag info">⏳ Freischaltung nötig</span>' : '—') },
      { k: 'createdAt', t: 'Erstellt', f: (r) => CC.dt(r.createdAt) },
      { k: 'lastLoginAt', t: 'Letzter Login', f: (r) => r.lastLoginAt ? CC.rel(r.lastLoginAt) : 'nie' },
      { k: 'x', t: '', f: (r) => r.status === 'pending'
          ? '<button class="cc-btn sm ok" onclick="CC.akteStatus(\'' + esc(r.id) + '\',\'active\')">▶ Freischalten</button>'
          : '<button class="cc-btn sm" onclick="CC.openAkte(\'' + esc(r.id) + '\')">📂 Akte</button>', raw: true }
    ], inv) : '<div class="cc-empty">Keine offenen Einladungen. 🎉</div>') +
    '<div class="cc-btnrow"><button class="cc-btn primary sm" onclick="CC.go(\'userNew\')">➕ Neue Einladung erstellen</button></div></div>'
  );
}, { perms: ['accounts.view'] });

/* ═══ AUDIT LOG ═══ */
CC.reg('logsAudit', async () => {
  const a = await api('/api/audit').catch(() => null);
  const es = (a && a.entries) || [];
  CC.page('📖 Audit Log', 'Wer hat was wann getan — manipulationsgeschützt (Hash-Kette). Letzte ' + es.length + ' Einträge.',
    '<div class="cc-section"><h3>Einträge</h3>' + (es.length ? CC.table([
      { k: 'time', t: 'Wann', f: (r) => '<span class="mono">' + esc(r.time) + '</span>' },
      { k: 'actor', t: 'Wer', f: (r) => '<b>' + esc(r.actor) + '</b>' },
      { k: 'action', t: 'Was', f: (r) => '<span class="cc-key">' + esc(r.action) + '</span>' },
      { k: 'target', t: 'Wen/Was', f: (r) => esc(r.target || '—') },
      { k: 'result', t: 'Ergebnis', f: (r) => { const ok = r.result === 'success'; return '<span class="cc-tag ' + (ok ? 'ok' : 'bad') + '">' + esc(r.result) + '</span>'; } }
    ], es) : '<div class="cc-empty">Keine Audit-Einträge.</div>') + '</div>'
  );
}, { perms: ['logs.view'] });

/* ═══ ACCESS LOG ═══ */
CC.reg('logsAccess', async () => {
  const al = await api('/api/security/access-log').catch(() => null);
  const en = (al && al.entries) || [];
  CC.page('🧾 Access Log', 'Jede Anfrage an die Website mit IP, Gerät und Pfad (letzte ' + en.length + ' Einträge).',
    '<div class="cc-section">' + (en.length ? CC.table([
      { k: 'time', t: 'Wann', f: (r) => CC.dt(r.time) },
      { k: 'ip', t: 'Woher', f: (r) => '<span class="mono">' + esc(r.ip) + '</span>' },
      { k: 'method', t: 'Methode', f: (r) => '<span class="cc-key">' + esc(r.method) + '</span>' },
      { k: 'path', t: 'Pfad', f: (r) => '<span class="mono">' + esc(r.path) + '</span>' },
      { k: 'browser', t: 'Browser', f: (r) => esc(r.browser || '—') + (r.isBot ? ' <span class="cc-tag dim">BOT</span>' : '') },
      { k: 'os', t: 'OS' }, { k: 'device', t: 'Gerät', f: (r) => esc(r.device || '—') }
    ], en) : '<div class="cc-empty">Keine Einträge.</div>') + '</div>'
  );
}, { perms: ['security.view'] });

/* ═══ SECURITY LOG ═══ */
CC.reg('logsSecurity', async () => {
  const s = await api('/api/security').catch(() => null);
  const ev = (s && s.ok && s.events) || [];
  CC.page('⚠️ Security Log', 'Erkannte Angriffs- und Auffälligkeits-Events mit Risiko (letzte ' + ev.length + ' Einträge).',
    '<div class="cc-section">' + (ev.length ? CC.table([
      { k: 'time', t: 'Wann', f: (r) => '<span class="mono">' + esc(r.time) + '</span>' },
      { k: 'sev', t: 'Level', f: (r) => '<span class="cc-tag ' + (r.sev === 'CRITICAL' ? 'bad' : r.sev === 'SUSPICIOUS' ? 'warn' : r.sev === 'WATCH' ? 'info' : 'ok') + '">' + esc(r.sev) + '</span>' },
      { k: 'event', t: 'Was', f: (r) => '<span class="cc-key">' + esc(r.event) + '</span>' },
      { k: 'src', t: 'Quelle', f: (r) => (r.src === 'bot' ? '🤖 Bot' : '🌐 Web') },
      { k: 'risk', t: 'Risk', f: (r) => r.risk },
      { k: 'ip', t: 'Woher', f: (r) => '<span class="mono">' + esc(r.ip || '—') + '</span>' },
      { k: 'action', t: 'Aktion', f: (r) => esc(r.action || '—') }
    ], ev) : '<div class="cc-empty">Keine Security-Events.</div>') + '</div>'
  );
}, { perms: ['security.view'] });

/* ═══ BOT LOG ═══ */
CC.reg('logsBot', async () => {
  const d = await api('/api/logs').catch(() => null);
  const lines = (d && d.lines) || [];
  CC.page('🤖 Bot Log', 'Roh-Ausgabe von lovebot.log (letzte ' + lines.length + ' Zeilen).',
    '<div class="cc-section" style="background:#06040c"><pre style="white-space:pre-wrap;font-family:var(--mono);font-size:11.5px;color:#cfc7e8;margin:0;max-height:70vh;overflow:auto">' + lines.map((l) => '[' + esc(l.time) + '] [' + esc(l.tag || 'info') + '] ' + esc(l.text)).join('\n') || '<div class="cc-empty">Log leer.</div>' + '</pre></div>'
  );
}, { perms: ['logs.view'] });

/* ═══ SYSTEM LOG ═══ */
CC.reg('logsSystem', async () => {
  const [lg, sys] = await Promise.all([api('/api/logs').catch(() => null), api('/api/system').catch(() => null)]);
  const lines = (lg && lg.lines) || [];
  const bad = lines.filter((l) => ['error', 'warn', 'fatal', 'system', 'server'].includes(String(l.tag).toLowerCase()));
  CC.page('🖧 System Log', 'Fehler- und Systemmeldungen + Server-Uptime und Ressourcen.',
    (sys ? '<div class="cc-section"><h3>Server</h3><div class="cc-kv">' +
      '<span class="k">Uptime</span><span class="v">' + CC.fmtSec(sys.uptimeSec) + '</span>' +
      '<span class="k">Node</span><span class="v mono">' + esc(sys.node) + ' · ' + esc(sys.platform) + '/' + esc(sys.arch) + '</span>' +
      '<span class="k">RAM RSS</span><span class="v">' + esc(sys.ramMb) + ' / ' + esc(sys.ramTotalMb) + ' MB · Heap ' + esc(sys.heapMb) + ' MB</span>' +
      '<span class="k">CPU-Load</span><span class="v">' + esc(sys.cpu) + ' %</span>' +
      '<span class="k">Web-Sessions</span><span class="v">' + esc(sys.sessions) + '</span>' +
    '</div></div>' : '') +
    '<div class="cc-section"><h3>Fehler / Warnungen / System-Zeilen</h3>' +
    (bad.length ? '<pre style="white-space:pre-wrap;font-family:var(--mono);font-size:11.5px;color:#f2d3a0;margin:0;max-height:55vh;overflow:auto">' + bad.map((l) => '[' + esc(l.time) + '] [' + esc(l.tag) + '] ' + esc(l.text)).join('\n') + '</pre>' : '<div class="cc-empty">Keine Fehler-/Warnzeilen in den letzten ' + lines.length + ' Logzeilen. ✅</div>') + '</div>'
  );
}, { perms: ['logs.view'] });

/* ═══ SYSTEMINFORMATIONEN ═══ */
CC.reg('sysInfo', async () => {
  const [sys, hb] = await Promise.all([api('/api/system').catch(() => null), api('/api/heartbeat').catch(() => null)]);
  const s = sys || {};
  CC.page('🖥️ Systeminformationen', 'Server, Ressourcen und Laufzeitumgebung.',
    '<div class="cc-grid2"><div class="cc-section"><h3>⚙ Laufzeit</h3><div class="cc-kv">' +
      '<span class="k">Node</span><span class="v mono">' + esc(s.node || '—') + '</span>' +
      '<span class="k">Plattform</span><span class="v mono">' + esc(s.platform || '—') + ' / ' + esc(s.arch || '—') + '</span>' +
      '<span class="k">Uptime</span><span class="v">' + CC.fmtSec(s.uptimeSec) + '</span>' +
      '<span class="k">Web-Sessions</span><span class="v">' + esc(s.sessions != null ? s.sessions : '—') + '</span>' +
    '</div></div><div class="cc-section"><h3>💾 Ressourcen</h3><div class="cc-gauge">' +
      '<div class="cc-bar"><span style="width:150px">RAM (RSS)</span><div class="cc-progress" style="flex:1"><i style="width:' + Math.min(100, Math.round(((s.ramMb || 0) / Math.max(1, s.ramTotalMb || 1)) * 100)) + '%"></i></div><b>' + esc(s.ramMb) + ' / ' + esc(s.ramTotalMb) + ' MB</b></div>' +
      '<div class="cc-bar"><span style="width:150px">CPU-Load</span><div class="cc-progress" style="flex:1"><i style="width:' + Math.min(100, s.cpu || 0) + '%"></i></div><b>' + esc(s.cpu) + ' %</b></div>' +
      '<div class="cc-bar"><span style="width:150px">Heap</span><b>' + esc(s.heapMb) + ' MB</b></div>' +
    '</div>' + (hb ? '<p class="cc-hint">Heartbeat: ' + CC.dt(hb.time) + ' · online=' + (hb.online ? 'ja' : 'nein') + '</p>' : '') + '</div></div>'
  );
}, { perms: ['system.view'] });

/* ═══ DATENBANK ═══ */
CC.reg('sysDb', async () => {
  const d = await api('/api/database').catch(() => null);
  CC.page('🗄️ Datenbank', 'Live-Zustand der WhatsApp-Datenbank (Database/Database.json).',
    '<div class="cc-statgrid">' +
      '<div class="cc-stat"><div class="ic">🟢</div><div class="num ' + (d && d.healthy ? 'st-ok' : 'st-warn') + '">' + (d && d.healthy ? 'OK' : '?') + '</div><div class="lab">Gesundheit</div></div>' +
      '<div class="cc-stat"><div class="ic">👥</div><div class="num">' + ((d && d.users) || 0) + '</div><div class="lab">Nutzer</div></div>' +
      '<div class="cc-stat"><div class="ic">👥</div><div class="num">' + ((d && d.groups) || 0) + '</div><div class="lab">Gruppen</div></div>' +
      '<div class="cc-stat"><div class="ic">🗃️</div><div class="num">' + ((d && d.sizeKb) || 0) + '</div><div class="lab">Größe (KB)</div></div>' +
      '<div class="cc-stat"><div class="ic">💾</div><div class="num">' + ((d && d.backups) || 0) + '</div><div class="lab">Backups</div></div>' +
      '<div class="cc-stat"><div class="ic">📊</div><div class="num">' + ((d && d.records) || 0) + '</div><div class="lab">Datensätze</div></div>' +
    '</div>' +
    '<div class="cc-section"><h3>Hinweis</h3><p class="cc-hint">Backups &amp; Wiederherstellung: 💾 Backups. Sicherheitskopien entstehen als Database/backup-*.json — Inhalte werden nie per API ausgeliefert (Datensparsamkeit).</p></div>'
  );
}, { perms: ['db.view'] });

/* ═══ BACKUPS ═══ */
CC.reg('sysBackups', async () => {
  const load = async () => {
    const [d, bl] = await Promise.all([api('/api/database').catch(() => null), api('/api/database/backups').catch(() => null)]);
    const list = (bl && bl.backups) || [];
    CC.page('💾 Backups', 'Manuelle und automatische Sicherungen der Datenbank.',
      '<div class="cc-section"><h3>Sicherung erstellen</h3><p class="cc-hint">Erstellt sofort eine Kopie der aktuellen Datenbank als <span class="cc-key">Database/backup-…json</span>.</p>' +
      '<div class="cc-btnrow"><button class="cc-btn primary" onclick="CC.go(\'sysBackups\');CC.doBackup()">💾 Jetzt Backup erstellen</button></div></div>' +
      '<div class="cc-section"><h3>Vorhandene Backups (' + list.length + ')</h3>' + (list.length ? CC.table([
        { k: 'name', t: 'Datei', f: (r) => '<span class="mono">' + esc(r.name) + '</span>' },
        { k: 'sizeKb', t: 'Größe', f: (r) => r.sizeKb + ' KB' },
        { k: 'mtime', t: 'Erstellt', f: (r) => CC.dt(r.mtime) }
      ], list) : '<div class="cc-empty">Noch keine Backups vorhanden.</div>') +
      '<p class="cc-hint">Gesamt laut DB-Info: ' + ((d && d.backups) || 0) + ' Backup-Dateien.</p></div>');
  };
  await load();
  CC.doBackup = async () => {
    const r = await CC.post('/api/database/backup', {});
    CC.ok(r, '✅ Backup erstellt'); CC.go('sysBackups');
  };
}, { perms: ['db.view'] });

/* ═══ WARTUNG ═══ */
CC.reg('sysMaint', async () => {
  const m = await api('/api/maintenance').catch(() => null);
  const st = m || {};
  CC.page('🛠️ Wartungsmodus', 'Zentraler Zustand für Bot UND Website — $offline/$online im Chat schaltet dasselbe.',
    '<div class="cc-section"><h3>Aktueller Zustand</h3><div class="cc-kv">' +
      '<span class="k">Status</span><span class="v">' + (st.on ? '<span class="cc-pill p-locked">🔴 WARTUNG AKTIV</span>' : '<span class="cc-pill p-active">🟢 NORMALBETRIEB</span>') + '</span>' +
      '<span class="k">Grund</span><span class="v">' + esc(st.reason || '—') + '</span>' +
      '<span class="k">Seit</span><span class="v">' + CC.dt(st.since) + '</span>' +
      '<span class="k">Von</span><span class="v">' + esc(st.by || '—') + '</span>' +
      '<span class="k">Beendet</span><span class="v">' + (st.endedAt ? CC.dt(st.endedAt) : '—') + '</span>' +
    '</div><div class="cc-btnrow">' +
      (st.on ? '<button class="cc-btn ok" onclick="CC.maintOff()">▶ Wartung beenden (online)</button>'
             : '<button class="cc-btn danger" onclick="CC.maintOn()">⏸ Wartung starten (offline)</button>') +
    '</div><div class="cc-tip">Im Wartungsmodus sehen Besucher eine 503-Seite mit Grund; der Owner kommt weiter rein. Beendet per $online im Bot-Chat oder hier.</div></div>'
  );
  CC.maintOn = async () => {
    const b = await CC.confirm({ ico: '⏸', title: 'WARTUNGSMODUS AKTIVIEREN', requireReauth: true, text: 'Website & Bot werden für alle außer den Owner gesperrt.', fields: [{ name: 'reason', label: 'Grund (Besucher sehen ihn auf der 503-Seite) *', type: 'textarea', required: true }], okLabel: 'Wartung starten' });
    if (!b) return;
    const r = await CC.post('/api/maintenance', { on: true, reason: b.reason, reauth: b.reauth });
    CC.ok(r, '⏸ Wartungsmodus aktiv'); CC.refreshTiles(); CC.reload();
  };
  CC.maintOff = async () => {
    const r = await CC.post('/api/maintenance', { on: false });
    CC.ok(r, '✅ Wartungsmodus beendet'); CC.refreshTiles(); CC.reload();
  };
}, { perms: ['system.view'] });

/* ═══ NOTFALLMODUS (Emergency) ═══ */
CC.reg('sysEmergency', async () => {
  const s = await api('/api/sessions').catch(() => null);
  const sess = (s && s.sessions) || [];
  const errSess = sess.filter((x) => x.status === 'ERROR' || x.status === 'DISCONNECTED');
  CC.page('🚨 Notfallmodus', 'Kritische Sofort-Aktionen — bei Angriff, Missbrauch oder Bot-Ausfall. Jede Aktion wird auditiert.',
    '<div class="cc-grid2">' +
      '<div class="cc-section"><h3>🔄 Fehlgeschlagene Sessions neu starten</h3><p class="cc-hint">Startet alle Sessions im Zustand ERROR/DISCONNECTED neu, die eigentlich laufen sollten. Aktuell: <b>' + errSess.length + '</b> betroffen.</p>' +
      '<div class="cc-btnrow"><button class="cc-btn warn" onclick="CC.emerg(\'restartFailed\')">🔄 Fehlgeschlagene neu starten</button></div></div>' +
      '<div class="cc-section"><h3>⏹ ALLE gestarteten Sessions stoppen</h3><p class="cc-hint">Sofort-Stopp aller vom Server gestarteten Bot-Sessions (Bestätigungswort + Passwort nötig).</p>' +
      '<div class="cc-btnrow"><button class="cc-btn danger" onclick="CC.emerg(\'stopAllSpawned\')">⏹ Alle Sessions stoppen</button></div></div>' +
    '</div>' +
    '<div class="cc-section"><h3>⚠️ Hinweise</h3><p class="cc-hint">Kritische Massenaktionen: Beenden aller Web-Sessions → 🔌 Session-Sperren → „Alle beenden". Kompletter Systemzustand → Wartungsmodus. Diese Seite ist Teil der automatischen Eskalationskette des Security Centers.</p></div>'
  );
  CC.emerg = async (act) => {
    const isStop = act === 'stopAllSpawned';
    const b = isStop
      ? await CC.confirm({ ico: '⛔', title: 'ALLE SESSIONS STOPPEN', confirmWord: 'STOP ALL', requireReauth: true, text: 'Alle vom Server gestarteten Bot-Sessions werden sofort gestoppt.' })
      : await CC.confirm({ ico: '🔄', title: 'Fehlgeschlagene Sessions neu starten', text: 'Betroffene Sessions: ' + errSess.length, okLabel: 'Neu starten' });
    if (!b) return;
    const r = await CC.post('/api/admin/emergency', { action: act, confirm: b.confirmWord || undefined, reauth: b.reauth });
    if (CC.ok(r, isStop ? '✅ Alle Sessions gestoppt' : '✅ Neustart ausgelöst')) CC.reload();
  };
}, { perms: ['system.control'] });

/* ═══ RATE LIMITS (Live-Zähler) ═══ */
CC.reg('rateLimits', async () => {
  const rl = await api('/api/security/rate-limits').catch(() => null);
  const data = (rl && rl.ok) ? rl : null;
  CC.page('🚦 Rate Limits', 'Live-Zähler der Schutzsysteme — wie viele Nummern/IPs gerade gebremst werden.',
    (!data ? '<div class="cc-empty">Keine Berechtigung oder Endpoint nicht verfügbar (nur security.manage).</div>' :
    '<div class="cc-statgrid">' +
      '<div class="cc-stat"><div class="ic">🔑</div><div class="num">' + data.counts.numberRateLimited + '</div><div class="lab">Nummern im PW-Limit</div><div class="sub">' + data.config.numberMaxAttempts + ' Versuche / ' + Math.round(data.config.numberWindowSec / 60) + ' Min.</div></div>' +
      '<div class="cc-stat"><div class="ic">🛡️</div><div class="num">' + data.counts.ipFailureWindows + '</div><div class="lab">IPs mit Fehlversuchen</div><div class="sub">Fenster ' + Math.round(data.config.ipFailWindowSec / 60) + ' Min.</div></div>' +
      '<div class="cc-stat"><div class="ic">📡</div><div class="num">' + data.counts.globalRateLimited + '</div><div class="lab">IPs im API-Limit</div><div class="sub">max. ' + data.config.globalMaxPerWindow + ' Anfragen/' + Math.round(data.config.globalWindowSec / 60) + ' Min.</div></div>' +
      '<div class="cc-stat"><div class="ic">🔒</div><div class="num ' + (data.counts.activeAutoBlocks ? 'st-bad' : 'st-ok') + '">' + data.counts.activeAutoBlocks + '</div><div class="lab">Aktive Auto-Blocks</div></div>' +
      '<div class="cc-stat"><div class="ic">🚫</div><div class="num">' + data.counts.manualBans + '</div><div class="lab">Manuelle IP-Bans</div></div>' +
      '<div class="cc-stat"><div class="ic">🌍</div><div class="num">' + data.counts.knownClients + '</div><div class="lab">Bekannte Clients</div></div>' +
    '</div>' +
    '<div class="cc-section"><h3>Eskalationsstufen (Brute-Force pro IP)</h3>' + (data.config.ipBlockThresholds || []).map((t) => '<div class="cc-bar"><span style="width:200px">ab ' + t.fails + ' Fehlversuchen</span><b>⏳ ' + Math.round(t.blockMs / 60000) + ' Min. Auto-Sperre</b></div>').join('') + '<p class="cc-hint">Login-Fehlversuche zählen pro IP über ALLE Nummern — getrennt vom per-Nummer-Limit, damit Angreifer das Nummer-Limit nicht umgehen. PW-Limit &amp; IP-Schutz sind strikt getrennte Systeme (keine Aussperr-Falle durch Dashboard-Polling).</p></div>')
  );
}, { perms: ['security.manage', 'security.view'] });

/* ═══ AUTO-REGELN ═══ */
CC.reg('autoRules', async () => {
  const rules = await api('/api/security/rules').catch(() => null);
  const wrf = (rules && rules.webReqFlood) || { id: 'WEB-REQ-07', enabled: true, threshold: 50, windowSec: 10, violationDecayMin: 30, tiers: [{ atViolations: 2, action: 'TEMP_BLOCK', blockMin: 5 }, { atViolations: 4, action: 'LONG_BLOCK', blockMin: 60 }, { atViolations: 6, action: 'PERM_BLOCK', blockMin: 0 }] };
  const canEdit = CC.can('security.manage');
  const tierActionLabel = { TEMP_BLOCK: 'Kurze Sperre', LONG_BLOCK: 'Lange Sperre', PERM_BLOCK: 'Dauerhaft sperren' };
  const tierRows = (wrf.tiers || []).map((t, i) =>
    '<tr>' +
      '<td><input class="cc-input" style="width:70px" id="arTierN' + i + '" type="number" min="1" max="50" value="' + (t.atViolations || 0) + '" ' + (canEdit ? '' : 'disabled') + '></td>' +
      '<td><select class="cc-select" id="arTierA' + i + '" ' + (canEdit ? '' : 'disabled') + '>' +
        '<option value="TEMP_BLOCK"' + (t.action === 'TEMP_BLOCK' ? ' selected' : '') + '>Kurze Sperre</option>' +
        '<option value="LONG_BLOCK"' + (t.action === 'LONG_BLOCK' ? ' selected' : '') + '>Lange Sperre</option>' +
        '<option value="PERM_BLOCK"' + (t.action === 'PERM_BLOCK' ? ' selected' : '') + '>Dauerhaft (manuelle Prüfung)</option>' +
      '</select></td>' +
      '<td>' + (t.action === 'PERM_BLOCK' ? '<span class="cc-tag bad">—</span>' : '<input class="cc-input" style="width:90px" id="arTierM' + i + '" type="number" min="1" max="10080" value="' + (t.blockMin || 5) + '" ' + (canEdit ? '' : 'disabled') + '><span style="margin-left:6px;color:var(--mut)">Min.</span>') + '</td>' +
      '<td>' + esc(t.label || (tierActionLabel[t.action] || t.action)) + '</td>' +
    '</tr>').join('');

  CC.page('⚙️ Auto-Regeln', 'Aktive automatische Schutzregeln des Systems — wie die Eskalationskette funktioniert. Die Request-Flut-Regel ist <b>konfigurierbar</b> (nicht hart im Code).',
    '<div class="cc-section"><h3>Automatische Eskalationskette</h3><div class="cc-gauge">' +
      [['1 · Erkennen', 'Security-Events (AUTH_FAILURE, Brute-Force, 2FA fehlt, globale Limits, Missbrauch) bekommen automatisch einen Risiko-Punktwert.'],
       ['2 · Bewerten', 'Pro Client/IP wird der höchste Risiko-Wert als Risk-Score geführt (normal → Beobachtung → eingeschränkt → hoch → kritisch).'],
       ['3 · Automatisch blockieren', 'Ab 5 Fehlversuchen (10-Min-Fenster) wird die IP gestaffelt gesperrt: 2 Min → 15 Min → 1 Std.'],
       ['4 · Manuell eskalieren', 'Im Security Center: vorübergehend blockieren oder dauerhaft sperren (dauerhaft = Step-up-Reauth + Audit).'],
       ['5 · Fälle bilden', 'Zusammenhängende Vorgänge werden als Security Case gebündelt (offen → klären → gelöst/wiedereröffnet).'],
       ['6 · Jede Stufe protokollieren', 'Alles landet manipulationssicher in Audit-/Security-Log mit Wer/Was/Wann/Woher/Warum.']]
      .map(([t, x]) => '<div class="cc-bar" style="align-items:flex-start"><b style="width:210px;flex:0 0 210px">' + esc(t) + '</b><span style="color:var(--mut);flex:1">' + esc(x) + '</span></div>').join('') +
    '</div></div>' +
    '<div class="cc-section"><h3>🌊 Request-Flut-Regel <span class="cc-key" style="margin-left:8px">' + esc(wrf.id) + '</span></h3>' +
    (rules && rules.version ? '<div class="cc-subline" style="margin:0 0 10px">Version ' + rules.version + ' · geändert ' + CC.dt(rules.updatedAt) + ' von <b>' + esc(rules.updatedBy) + '</b> · aktiv: ' + (wrf.enabled ? '<span class="cc-tag ok">AN</span>' : '<span class="cc-tag bad">AUS</span>') + (rules.activeCounts ? ' · gerade beobachtet: ' + rules.activeCounts.bursts + ' Bursts / ' + rules.activeCounts.violations + ' Verstöße' : '') + '</div>' : '') +
    '<div class="cc-tip" style="margin-bottom:12px">Regel: Mehr als <b>[Schwellwert]</b> Anfragen von einer IP innerhalb von <b>[Fenster]</b> = 1 „Verstoß“. Wiederholte Verstöße (innerhalb der Verjährungsfrist) eskalieren automatisch — siehe Stufen. Änderungen sind kritisch: Passwort-Bestätigung + Audit-Log + Versionierung (alte Versionen werden 10 Stufen lang mitgeführt).</div>' +
    '<div class="cc-xpform">' +
      '<div class="cc-field"><label>Regel-ID</label><input class="cc-input" id="arId" value="' + esc(wrf.id || 'WEB-REQ-07') + '" ' + (canEdit ? '' : 'disabled') + '></div>' +
      '<div class="cc-field"><label>Schwellwert (Anfragen)</label><input class="cc-input" id="arThreshold" type="number" min="3" max="1000" value="' + (wrf.threshold || 50) + '" ' + (canEdit ? '' : 'disabled') + '></div>' +
      '<div class="cc-field"><label>Fenster (Sekunden)</label><input class="cc-input" id="arWindow" type="number" min="2" max="3600" value="' + (wrf.windowSec || 10) + '" ' + (canEdit ? '' : 'disabled') + '></div>' +
      '<div class="cc-field"><label>Verjährung (Minuten)</label><input class="cc-input" id="arDecay" type="number" min="1" max="1440" value="' + (wrf.violationDecayMin || 30) + '" ' + (canEdit ? '' : 'disabled') + '></div>' +
      '<div class="cc-field"><label class="checkline" style="display:flex;gap:8px;align-items:center;cursor:pointer;margin-top:20px"><input type="checkbox" id="arEnabled"' + (wrf.enabled === false ? '' : ' checked') + ' ' + (canEdit ? '' : 'disabled') + '> Regel aktiv</label></div>' +
    '</div>' +
    '<div class="cc-subline" style="margin:0 0 6px;font-weight:600">Eskalations-Stufen (ab Verstoß-Nr.)</div>' +
    '<div class="cc-tablewrap" style="overflow-x:auto"><table class="cc-table"><thead><tr><th>Ab Verstoß</th><th>Aktion</th><th>Dauer</th><th>Beschriftung</th></tr></thead><tbody>' + tierRows + '</tbody></table></div>' +
    (canEdit ? '<div class="cc-btnrow" style="margin-top:12px"><button class="cc-btn primary" id="arSave">💾 Regeln speichern (kritisch)</button></div><div id="arOut"></div>' : '<div class="cc-empty" style="margin-top:10px">Nur Ansicht — zum Ändern ist <span class="cc-key">security.manage</span> nötig.</div>') +
    '</div>' +
    '<div class="cc-section"><h3>Kritische Aktionen mit erneuter Authentifizierung</h3><p class="cc-hint">Dauerhafte IP-Sperren, kritische Rollenvergaben, Wartungsmodus AN, Deaktivieren/Sperren von Owner-Accounts, Alle-Sessions-beenden, kritische Einzelrechte, Schutzregeln ändern — immer mit frischem Passwort (Step-up).</p></div>'
  , { after: () => {
    if (!canEdit) return;
    const btn = document.getElementById('arSave');
    if (!btn) return;
    btn.onclick = async () => {
      const nTiers = (wrf.tiers || []).length;
      const tiers = [];
      for (let i = 0; i < nTiers; i++) {
        const a = (document.getElementById('arTierA' + i) || {}).value || 'TEMP_BLOCK';
        tiers.push({
          atViolations: Number(document.getElementById('arTierN' + i).value) || 0,
          action: a,
          blockMin: a === 'PERM_BLOCK' ? 0 : Number(document.getElementById('arTierM' + i).value) || 0
        });
      }
      const payload = {
        id: document.getElementById('arId').value.trim() || 'WEB-REQ-07',
        enabled: document.getElementById('arEnabled').checked,
        threshold: Number(document.getElementById('arThreshold').value),
        windowSec: Number(document.getElementById('arWindow').value),
        violationDecayMin: Number(document.getElementById('arDecay').value),
        tiers
      };
      if (payload.threshold < 3 || payload.windowSec < 2) { CC.toast('❌ Schwellwert ≥ 3 und Fenster ≥ 2 s'); return; }
      if (!tiers.some((t) => t.atViolations > 0)) { CC.toast('❌ Mindestens eine Stufe mit Wert > 0 nötig'); return; }
      const ans = await CC.confirm({
        ico: '⚙️',
        title: 'Schutzregel ändern (kritisch)',
        text: 'WEB-REQ-07: <b>' + payload.threshold + ' Anfragen / ' + payload.windowSec + ' s</b>, Eskalation über ' + tiers.filter((t) => t.atViolations > 0).length + ' Stufen, Regel <b>' + (payload.enabled ? 'AKTIV' : 'DEAKTIVIERT') + '</b>.<br>Wird versioniert und im Audit-Log gespeichert (security.rules.changed).',
        fields: [
          { name: 'reason', label: 'Grund (Audit)', type: 'text', required: true, placeholder: 'z. B. Testphase: Schwellwert erhöht' },
          { name: 'reauth', label: 'Passwort (kritische Aktion)', type: 'password', required: true, placeholder: 'Dein Owner-Passwort' }
        ],
        okLabel: '💾 Speichern'
      });
      if (!ans) return;
      const r = await CC.post('/api/security/rules', { ...payload, reason: ans.reason, reauth: ans.reauth });
      if (r.status >= 200 && r.status < 300) {
        document.getElementById('arOut').innerHTML = '<div class="cc-tip" style="margin-top:10px;border-color:var(--ok,#2c2)"><b>✅ Gespeichert:</b> Version ' + r.data.version + ' — gilt sofort (ohne Neustart).</div>';
        CC.toast('✅ Regeln gespeichert (v' + r.data.version + ')');
      } else {
        document.getElementById('arOut').innerHTML = '<div class="cc-tip" style="margin-top:10px;border-color:var(--bad,#c44)"><b>❌ ' + esc(r.data?.error || 'Fehler') + '</b></div>';
      }
    };
  } });
}, { perms: ['security.view'] });

/* ═══ KONFIGURATION (Referenz) ═══ */
CC.reg('sysConfig', async () => {
  const [site, pm, rolesMeta, rl, maint] = await Promise.all([
    api('/api/siteinfo').catch(() => null),
    CCpermMeta().catch(() => null),
    api('/api/roles').catch(() => null),
    CC.can('security.manage') ? api('/api/security/rate-limits').catch(() => null) : Promise.resolve(null),
    api('/api/maintenance').catch(() => null)
  ]);
  const tpl = (pm && pm.templates) || {};
  const m = maint || {};
  CC.page('⚙ Konfiguration', 'Aktive System-Referenz: Bot-Stammdaten, Schutzparameter, Vorlagen, Wartung.',
    '<div class="cc-grid2">' +
      '<div class="cc-section"><h3>🤖 Bot-Stammdaten</h3><div class="cc-kv">' +
        '<span class="k">Name</span><span class="v">' + esc((site && site.name) || '—') + ' by ' + esc((site && site.by) || '—') + '</span>' +
        '<span class="k">Prefix</span><span class="v"><span class="cc-key">' + esc((site && site.prefix) || '—') + '</span></span>' +
        '<span class="k">Owner-JID</span><span class="v mono">' + esc((site && site.ownerJid) || '—') + '</span>' +
        '<span class="k">Kanal</span><span class="v"><a href="' + esc((site && site.links && site.links.channel) || '#') + '" target="_blank">öffnen ↗</a></span>' +
      '</div></div>' +
      '<div class="cc-section"><h3>🛡️ Schutzparameter</h3><div class="cc-kv">' +
        '<span class="k">PW-Versuche</span><span class="v">' + ((rl && rl.config) ? rl.config.numberMaxAttempts + ' / ' + Math.round(rl.config.numberWindowSec / 60) + ' Min. pro Nummer' : 'nur mit security.manage') + '</span>' +
        '<span class="k">IP-Fehlversuche</span><span class="v">' + ((rl && rl.config) ? Math.round(rl.config.ipFailWindowSec / 60) + '-Min.-Fenster · Auto-Sperren: ' + (rl.config.ipBlockThresholds || []).map((t) => t.fails + '→' + Math.round(t.blockMs / 60000) + ' Min.').join(' · ') : '—') + '</span>' +
        '<span class="k">API-Limit</span><span class="v">' + ((rl && rl.config) ? rl.config.globalMaxPerWindow + ' Anfragen / ' + Math.round(rl.config.globalWindowSec / 60) + ' Min. pro IP' : '—') + '</span>' +
        '<span class="k">Wartung</span><span class="v">' + (m.on ? '<span class="cc-tag bad">AKTIV</span> ' + esc(m.reason || '') : '<span class="cc-tag ok">AUS</span>') + '</span>' +
      '</div></div>' +
    '</div>' +
    '<div class="cc-section"><h3>🎖️ Rollen-Level</h3><div class="cc-kv">' + ((rolesMeta && rolesMeta.roles) || []).map((r) => '<span class="k">' + (r.icon || '') + ' ' + esc(r.label) + '</span><span class="v">Level ' + r.level + ' · <span class="cc-key">' + esc(r.id) + '</span></span>').join('') + '</div></div>' +
    '<div class="cc-section"><h3>📋 Rechtevorlagen</h3><div class="cc-kv">' + Object.entries(tpl).map(([id, t]) => '<span class="k">' + esc(t.label) + '</span><span class="v">' + (t.grant || []).map((g) => '<span class="cc-key">' + esc(g) + '</span>').join(' ') + '</span>').join('') + '</div></div>'
  );
}, { perms: ['system.view'] });

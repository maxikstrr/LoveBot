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
  CC.page('⚙️ Auto-Regeln', 'Aktive automatische Schutzregeln des Systems — wie die Eskalationskette funktioniert.',
    '<div class="cc-section"><h3>Automatische Eskalationskette</h3><div class="cc-gauge">' +
      [['1 · Erkennen', 'Security-Events (AUTH_FAILURE, Brute-Force, 2FA fehlt, globale Limits, Missbrauch) bekommen automatisch einen Risiko-Punktwert.'],
       ['2 · Bewerten', 'Pro Client/IP wird der höchste Risiko-Wert als Risk-Score geführt (normal → Beobachtung → eingeschränkt → hoch → kritisch).'],
       ['3 · Automatisch blockieren', 'Ab 5 Fehlversuchen (10-Min-Fenster) wird die IP gestaffelt gesperrt: 2 Min → 15 Min → 1 Std.'],
       ['4 · Manuell eskalieren', 'Im Security Center: vorübergehend blockieren oder dauerhaft sperren (dauerhaft = Step-up-Reauth + Audit).'],
       ['5 · Fälle bilden', 'Zusammenhängende Vorgänge werden als Security Case gebündelt (offen → klären → gelöst/wiedereröffnet).'],
       ['6 · Jede Stufe protokollieren', 'Alles landet manipulationssicher in Audit-/Security-Log mit Wer/Was/Wann/Woher/Warum.']]
      .map(([t, x]) => '<div class="cc-bar" style="align-items:flex-start"><b style="width:210px;flex:0 0 210px">' + esc(t) + '</b><span style="color:var(--mut);flex:1">' + esc(x) + '</span></div>').join('') +
    '</div></div>' +
    '<div class="cc-section"><h3>Kritische Aktionen mit erneuter Authentifizierung</h3><p class="cc-hint">Dauerhafte IP-Sperren, kritische Rollenvergaben, Wartungsmodus AN, Deaktivieren/Sperren von Owner-Accounts, Alle-Sessions-beenden, kritische Einzelrechte — immer mit frischem Passwort (Step-up).</p></div>'
  );
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

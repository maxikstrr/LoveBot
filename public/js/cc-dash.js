/* ═══════════════════════════════════════════════════════════════
   SOUL ECHO — Dashboard · Bot · Webseite
   ═══════════════════════════════════════════════════════════════ */

/* ═══ DASHBOARD ═══ */
CC.reg('dash', async () => {
  const [ov, fullSec, sys, site] = await Promise.all([
    CC.can('security.view') ? api('/api/security/overview').catch(() => null) : Promise.resolve(null),
    CC.can('security.view') ? api('/api/security').catch(() => null) : Promise.resolve(null),
    api('/api/system').catch(() => null),
    api('/api/siteinfo').catch(() => null)
  ]);
  const o = (ov && ov.ok) ? ov : {};
  const sc = (fullSec && fullSec.ok) ? fullSec : {};
  const threat = sc.threat || '—';
  const hb = (site && site.heartbeat) || null;
  const v = (x) => (x == null ? '—' : x);

  const tile = (ico, num, lab, sub, cls) => '<div class="cc-stat"><div class="ic">' + ico + '</div><div class="num ' + (cls || '') + '">' + num + '</div><div class="lab">' + lab + '</div>' + (sub ? '<div class="sub">' + sub + '</div>' : '') + '</div>';
  const sevTag = (risk) => risk >= 70 ? ['bad', 'CRITICAL'] : risk >= 40 ? ['warn', 'SUSPICIOUS'] : risk >= 20 ? ['info', 'WATCH'] : ['ok', 'OK'];
  const sevIco = (risk) => risk >= 70 ? '🔴' : risk >= 40 ? '🟠' : risk >= 20 ? '🟡' : '🟢';

  let secFeed = '<div class="cc-empty">Keine Security-Events in den letzten 50.</div>';
  if (sc.events && sc.events.length) {
    secFeed = '<div class="cc-feed">' + sc.events.slice(0, 9).map((e) => {
      const [c, l] = sevTag(e.risk);
      return '<div class="cc-event"><div class="ev-ico">' + sevIco(e.risk) + '</div><div class="ev-main"><div class="ev-t">' + esc(e.event) + ' <span class="cc-tag ' + c + '" style="padding:1px 7px;font-size:9.5px">' + l + '</span></div><div class="ev-s">' + (e.src === 'bot' ? '🤖 Bot' : '🌐 Web') + ' · Risk ' + esc(e.risk) + (e.action ? ' · ' + esc(e.action) : '') + '</div></div><div class="ev-time">' + esc(e.time) + '</div></div>';
    }).join('') + '</div>';
  }
  let auditFeed = '<div class="cc-empty">Keine Audit-Einträge (oder keine Berechtigung).</div>';
  if (CC.can('logs.view')) {
    try {
      const a = await api('/api/audit');
      const es = (a && a.entries || []);
      auditFeed = es.length ? '<div class="cc-feed">' + es.slice(0, 8).map((e) => '<div class="cc-event"><div class="ev-ico">📖</div><div class="ev-main"><div class="ev-t"><span class="cc-key">' + esc(e.action) + '</span></div><div class="ev-s">' + esc(e.actor || '') + (e.target ? ' → ' + esc(e.target) : '') + '</div></div><div class="ev-time">' + esc(e.time) + '</div></div>').join('') + '</div>' : '<div class="cc-empty">Keine Audit-Einträge.</div>';
    } catch (e) {}
  }
  CC.page('Dashboard', 'Systemübersicht — alles auf einen Blick. (' + new Date().toLocaleString('de-DE') + ')',
    '<div class="cc-grid2">' +
      '<div class="cc-section"><h3>🚦 Security-Lage (24 h)</h3><div class="cc-kv">' +
        '<span class="k">Bedrohungslevel</span><span class="v"><span class="cc-tag ' + (threat === 'HIGH' ? 'bad' : threat === 'WATCH' ? 'warn' : 'ok') + '">' + esc(threat) + '</span></span>' +
        '<span class="k">Security-Events</span><span class="v">' + v(o.securityEvents) + '</span>' +
        '<span class="k">Login-Fehlversuche</span><span class="v">' + v(o.loginFailures) + '</span>' +
        '<span class="k">IP-Sperren</span><span class="v">' + v(o.ipBans) + '</span>' +
        '<span class="k">Benutzer-Sperren</span><span class="v">' + v(o.userBans) + '</span>' +
        '<span class="k">Kritische Events</span><span class="v">' + v(o.criticalEvents) + '</span>' +
        '<span class="k">Offene Cases</span><span class="v">' + v(o.openCases) + '</span>' +
        '<span class="k">Session-Kills</span><span class="v">' + v(o.sessionKills) + '</span>' +
      '</div><div class="cc-btnrow"><button class="cc-btn sm" onclick="CC.go(\'secCenter\')">🛡️ Security Center</button></div></div>' +
      '<div class="cc-section"><h3>🤖 Bot &amp; System</h3><div class="cc-kv">' +
        '<span class="k">Bot-Heartbeat</span><span class="v">' + (hb && hb.online ? '<span class="cc-tag ok">🟢 ONLINE</span>' : '<span class="cc-tag bad">🔴 OFFLINE</span>') + '</span>' +
        '<span class="k">Uptime (Server)</span><span class="v">' + CC.fmtSec(sys && sys.uptimeSec) + '</span>' +
        '<span class="k">RAM RSS</span><span class="v">' + (sys ? sys.ramMb + ' MB' : '—') + '</span>' +
        '<span class="k">CPU-Load</span><span class="v">' + (sys ? sys.cpu + ' %' : '—') + '</span>' +
        '<span class="k">Web-Sessions</span><span class="v">' + (sys ? sys.sessions : '—') + '</span>' +
        '<span class="k">Wartung</span><span class="v" id="dashMaint">…</span>' +
      '</div><div class="cc-btnrow"><button class="cc-btn sm" onclick="CC.go(\'bot\')">🤖 Bot-Übersicht</button><button class="cc-btn sm" onclick="CC.go(\'sysMaint\')">🛠️ Wartung</button></div></div>' +
    '</div>' +
    '<div class="cc-grid2">' +
      '<div class="cc-section"><h3>🛡️ Letzte Security-Events</h3>' + secFeed + '</div>' +
      '<div class="cc-section"><h3>📖 Letzte Audit-Aktionen</h3>' + auditFeed + '</div>' +
    '</div>' +
    (CC.can('xp.view') ?
      '<div class="cc-grid2">' +
        '<div class="cc-section"><h3>⭐ XP & Level (LoveCore)</h3><div id="dashXp">…</div><div class="cc-btnrow"><button class="cc-btn sm" onclick="CC.go(\'xp\')">⭐ XP &amp; Level öffnen</button></div></div>' +
        '<div class="cc-section"><h3>💜 Live-Aktivität <span class="cc-tag ok" style="padding:1px 7px;font-size:9.5px">LIVE</span></h3><div id="dashLiveFeed"></div></div>' +
      '</div>' : '')
  ,
  { after: () => { api('/api/maintenance').then((m) => { const el = document.getElementById('dashMaint'); if (el && m) el.innerHTML = m.on ? '<span class="cc-tag bad">🔴 WARTUNG</span>' : '<span class="cc-tag ok">🟢 AN</span>'; }).catch(() => {});
    if (CC.can('xp.view')) {
      api('/api/xp').then((d) => {
        const el = document.getElementById('dashXp');
        if (!el || !d || !d.ok) return;
        const st = d.stats || {};
        el.innerHTML = '<div class="cc-kv">' +
          '<span class="k">XP gesamt (Lifetime)</span><span class="v">⭐ ' + Number(st.totalXp || 0).toLocaleString('de-DE') + '</span>' +
          '<span class="k">XP in 24 h</span><span class="v">' + Number(st.today || 0).toLocaleString('de-DE') + '</span>' +
          '<span class="k">Level-Ups (24 h)</span><span class="v">' + (st.levelUps24h ?? 0) + '</span>' +
          '<span class="k">Prestige-Ups (24 h)</span><span class="v">' + (st.prestigeUps24h ?? 0) + '</span>' +
          '<span class="k">Anti-Spam-Cap aktiv</span><span class="v">' + (st.suspiciousXp ?? 0) + '</span>' +
        '</div>';
      }).catch(() => {});
      try { CC.startLiveFeed('dashLiveFeed', 8); } catch (e) {}
    }
  } });
}, { perms: [] });

/* ═══ BOT-ÜBERSICHT ═══ */
CC.reg('bot', async () => {
  const s = await api('/api/sessions').catch(() => null);
  const sess = (s && s.sessions) || [];
  const fleet = (s && s.fleet) || {};
  const act = (s && s.activity) || [];
  const healthTxt = (h) => {
    if (h && typeof h === 'object') return (h.emoji || '') + ' ' + esc((h.label || h.code || '—'));
    if (h === 0) return '0 %';
    return h ? h + ' %' : '—';
  };
  const statusDot = (st) => {
    const map = { CONNECTED: ['ok', '🟢 VERBUNDEN'], PAUSED: ['warn', '⏸ PAUSIERT'], STOPPED: ['dim', '⏹ GESTOPPT'], ERROR: ['bad', '🔴 FEHLER'], DISCONNECTED: ['warn', '🟠 GETRENNT'], WAITING_FOR_AUTH: ['warn', '🔑 AUTH'], QR_REQUIRED: ['warn', '📱 QR'], CONNECTING: ['warn', '🔄 VERBINDE'] };
    const m = map[st] || ['dim', st];
    return '<span class="dot ' + m[0] + '"></span>' + m[1];
  };
  CC.page('🤖 Bot-Übersicht', 'Live-Zustand der WhatsApp-Bot-Flotte (SessionManager).',
    '<div class="cc-statgrid">' +
      '<div class="cc-stat"><div class="ic">📡</div><div class="num">' + (fleet.managed || 0) + '</div><div class="lab">Sessions verwaltet</div></div>' +
      '<div class="cc-stat"><div class="ic">🟢</div><div class="num st-ok">' + (fleet.running || 0) + '</div><div class="lab">Verbunden</div></div>' +
      '<div class="cc-stat"><div class="ic">🔑</div><div class="num">' + (fleet.authRequired || 0) + '</div><div class="lab">Auth nötig</div></div>' +
      '<div class="cc-stat"><div class="ic">🟠</div><div class="num ' + ((fleet.error || 0) ? 'st-bad' : '') + '">' + (fleet.error || 0) + '</div><div class="lab">Fehler/Getrennt</div></div>' +
      '<div class="cc-stat"><div class="ic">⏸</div><div class="num">' + (fleet.paused || 0) + '</div><div class="lab">Pausiert</div></div>' +
      '<div class="cc-stat"><div class="ic">⏹</div><div class="num">' + (fleet.stopped || 0) + '</div><div class="lab">Gestoppt</div></div>' +
    '</div><br>' +
    '<div class="cc-section"><h3>📡 Sessions</h3>' +
    (sess.length ? CC.table([
      { k: 'name', t: 'Session', f: (r) => '<b>' + esc(r.name) + '</b>' + (r.isDefault ? ' <span class="cc-tag info">Standard</span>' : '') + '<div class="cc-key">' + esc(r.id) + '</div>' },
      { k: 'status', t: 'Status', f: (r) => statusDot(r.status) },
      { k: 'health', t: 'Health', f: (r) => healthTxt(r.health) },
      { k: 'uptime', t: 'Uptime', f: (r) => (r.uptimePct != null ? r.uptimePct + ' % · ' : '') + (r.uptime || '—') },
      { k: 'phone', t: 'Nummer', f: (r) => '<span class="mono">' + esc(r.phone || '—') + '</span>' },
      { k: 'messages', t: 'Nachr.' }, { k: 'commands', t: 'Befehle' },
      { k: 'memoryMb', t: 'RAM', f: (r) => (r.memoryMb ? r.memoryMb + ' MB' : '—') },
      { k: 'x', t: '', f: (r) => '<button class="cc-btn sm" onclick="CC.go(\'botSessions\')">Steuern</button>' }
    ], sess) : '<div class="cc-empty">Keine Bot-Sessions registriert.</div>') +
    '</div>' +
    '<div class="cc-section"><h3>⚡ Letzte Aktivität</h3>' + (act.length ? CC.table([
      { k: 'time', t: 'Wann', f: (r) => { const t = new Date(r.time || r.ts); return isNaN(t) ? esc(r.time) : CC.rel(t.toISOString()); } },
      { k: 'type', t: 'Typ', f: (r) => { const m = { session: '📡 Session', command: '⚡ Befehl', web: '🌐 Web', security: '🛡️', system: '⚙️' }; return esc((m[r.type] || r.type) || '—'); } },
      { k: 'text', t: 'Meldung', f: (r) => esc(r.text || '—') }
    ], act) : '<div class="cc-empty">Keine Aktivität.</div>') + '</div>'
  );
}, { perms: [] });

/* ═══ BOT-SESSIONS (Flottensteuerung, Owner) ═══ */
CC.reg('botSessions', async () => {
  const s = await api('/api/sessions').catch(() => null);
  const sess = (s && s.sessions) || [];
  const owner = CC.isOwner();
  const statusDot = (st) => {
    const map = { CONNECTED: ['ok', '🟢 VERBUNDEN'], PAUSED: ['warn', '⏸ PAUSIERT'], STOPPED: ['dim', '⏹ GESTOPPT'], ERROR: ['bad', '🔴 FEHLER'], DISCONNECTED: ['warn', '🟠 GETRENNT'], WAITING_FOR_AUTH: ['warn', '🔑 AUTH'], QR_REQUIRED: ['warn', '📱 QR'], CONNECTING: ['warn', '🔄 VERBINDE'] };
    const m = map[st] || ['dim', st];
    return '<span class="dot ' + m[0] + '"></span>' + m[1];
  };
  const healthTxt = (h) => {
    if (h && typeof h === 'object') return (h.emoji || '') + ' ' + esc((h.label || h.code || '—'));
    if (h === 0) return '0 %';
    return h ? h + ' %' : '—';
  };
  const ctl = (r) => {
    const id = esc(r.id);
    const live = r.status === 'CONNECTED';
    const b = [];
    if (!live) b.push('<button class="cc-btn sm ok" onclick="CC.sessAct(\'' + id + '\',\'start\')">▶ Start</button>');
    if (live) b.push('<button class="cc-btn sm warn" onclick="CC.sessAct(\'' + id + '\',\'pause\')">⏸ Pause</button>');
    if (live) b.push('<button class="cc-btn sm" onclick="CC.sessAct(\'' + id + '\',\'restart\')">↻ Neustart</button>');
    if (r.status === 'PAUSED') b.push('<button class="cc-btn sm ok" onclick="CC.sessAct(\'' + id + '\',\'resume\')">▶ Fortsetzen</button>');
    b.push('<button class="cc-btn sm" onclick="CC.sessAct(\'' + id + '\',\'autostart\',!' + (r.autoStart ? 'true' : 'false') + ')">' + (r.autoStart ? '⊘ Autostart aus' : '▶ Autostart an') + '</button>');
    return b.join(' ');
  };
  CC.sessAct = async (id, action, value) => {
    const needConfirm = action === 'stop' || action === 'pause' || action === 'restart';
    let extra = {};
    if (needConfirm) {
      const b = await CC.confirm({ ico: action === 'restart' ? '↻' : '⏸', title: 'Session ' + action.toUpperCase() + ' — ' + id, text: 'Soll die Session wirklich ' + action + ' werden?', okLabel: action.toUpperCase() });
      if (!b) return;
      extra = b;
    }
    const r = await CC.post('/api/admin/session-action', { id, action, value: value === undefined ? undefined : !!value, ...extra });
    CC.ok(r, '✅ ' + action + ' ausgeführt'); CC.go('botSessions');
  };
  CC.page('📡 Bot-Sessions', 'Sessions starten, pausieren, neu starten — live aus dem SessionManager.' + (owner ? '' : ' (Nur der Owner darf steuern.)'),
    '<div class="cc-section">' + (sess.length ? CC.table([
      { k: 'name', t: 'Session', f: (r) => '<b>' + esc(r.name) + '</b>' + (r.isDefault ? ' <span class="cc-tag info">Standard</span>' : '') + '<div class="cc-key">' + esc(r.id) + '</div>' },
      { k: 'status', t: 'Status', f: (r) => statusDot(r.status) },
      { k: 'health', t: 'Health', f: (r) => healthTxt(r.health) },
      { k: 'autoStart', t: 'Autostart', f: (r) => r.autoStart ? '<span class="cc-tag ok">AN</span>' : '<span class="cc-tag dim">AUS</span>' },
      { k: 'env', t: 'Env', f: (r) => esc(r.env || '—') },
      { k: 'messages', t: 'Nachr.' }, { k: 'commands', t: 'Befehle' },
      { k: 'x', t: 'Aktionen', f: (r) => owner ? ctl(r) : '<i style="color:var(--dim)">nur Owner</i>', raw: true }
    ], sess) : '<div class="cc-empty">Keine Bot-Sessions.</div>') + '</div>' +
    '<div class="cc-section"><h3>🚨 Notfall</h3><div class="cc-btnrow"><button class="cc-btn sm warn" onclick="CC.go(\'sysEmergency\')">🚨 Emergency-Aktionen</button></div></div>'
  );
}, { perms: [] });

/* ═══ WHATSAPP ═══ */
CC.reg('botWhatsapp', async () => {
  const [hbRaw, sess] = await Promise.all([api('/api/heartbeat').catch(() => null), api('/api/session').catch(() => null)]);
  const hb = hbRaw || {};
  const online = !!(hb && hb.online);
  CC.page('🟢 WhatsApp', 'Verbindungsstatus des Bot-Accounts.',
    '<div class="cc-statgrid">' +
      '<div class="cc-stat"><div class="ic">🟢</div><div class="num ' + (online ? 'st-ok' : 'st-bad') + '">' + (online ? 'ONLINE' : 'OFFLINE') + '</div><div class="lab">Heartbeat</div><div class="sub">' + (hb.time ? CC.dt(hb.time) : 'kein Signal') + '</div></div>' +
      '<div class="cc-stat"><div class="ic">👤</div><div class="num mono" style="font-size:15px">' + (hb.jid ? esc(String(hb.jid).split('@')[0].slice(0, 4) + '••••') : '—') + '</div><div class="lab">Bot-Nummer</div></div>' +
      '<div class="cc-stat"><div class="ic">🔐</div><div class="num ' + (sess && sess.registered ? 'st-ok' : 'st-warn') + '">' + (sess && sess.registered ? 'JA' : 'NEIN') + '</div><div class="lab">Registriert</div></div>' +
      '<div class="cc-stat"><div class="ic">⏱</div><div class="num" style="font-size:16px">' + (hb.uptimeSec ? CC.fmtSec(hb.uptimeSec) : '—') + '</div><div class="lab">Uptime</div></div>' +
    '</div>' +
    '<div class="cc-section"><h3>ℹ️ Details</h3><div class="cc-kv">' +
      '<span class="k">JID</span><span class="v mono">' + esc(hb.jid || '—') + '</span>' +
      '<span class="k">LID</span><span class="v mono">' + esc((sess && sess.lid) || '—') + '</span>' +
      '<span class="k">Session-Datei</span><span class="v">' + (sess && sess.found ? 'vorhanden' : 'fehlt') + '</span>' +
      '<span class="k">RAM (Bot)</span><span class="v">' + (hb.ramMb != null ? hb.ramMb + ' MB' : '—') + '</span>' +
      '<span class="k">Plattform</span><span class="v mono">' + esc((sess && sess.platform) || '—') + '</span>' +
    '</div></div>'
  );
}, { perms: [] });

/* ═══ GRUPPEN ═══ */
CC.reg('botGroups', async () => {
  const d = await api('/api/admin/groups').catch(() => null);
  const g = (d && d.groups) || [];
  CC.page('👥 Gruppen', 'Alle registrierten Bot-Gruppen mit aktivem Status.',
    '<div class="cc-section">' + (g.length ? CC.table([
      { k: 'gid', t: 'Gruppen-ID', f: (r) => '<span class="mono">' + esc(r.gid) + '</span>' },
      { k: 'active', t: 'Status', f: (r) => r.active ? '<span class="cc-tag ok">🟢 AKTIV</span>' : '<span class="cc-tag dim">⚪ INAKTIV</span>' },
      { k: 'setupAt', t: 'Setup', f: (r) => r.setupAt ? CC.dt(r.setupAt) : '—' },
      { k: 'x', t: '', f: (r) => CC.isOwner() ? '<button class="cc-btn sm" onclick="CC.tglGroup(\'' + esc(r.gid) + '\',' + (r.active ? 'false' : 'true') + ')">' + (r.active ? 'Deaktivieren' : 'Aktivieren') + '</button>' : '<i style="color:var(--dim)">nur Owner</i>', raw: true }
    ], g) : '<div class="cc-empty">Keine Gruppen.</div>') +
    '<p class="cc-hint">Gesamt: ' + esc(((d && d.total) || 0)) + ' Gruppen · Umschalten setzt db.groups[gid].active.</p></div>'
  );
  CC.tglGroup = async (gid, on) => {
    const r = await CC.post('/api/groups/toggle', { gid, key: 'active', on });
    CC.ok(r, '✅ Gruppe ' + (on ? 'aktiviert' : 'deaktiviert')); CC.reload();
  };
}, { perms: ['groups.view'] });

/* ═══ BOT-SICHERHEIT ═══ */
CC.reg('botSecurity', async () => {
  const s = await api('/api/security').catch(() => null);
  const evs = (s && s.ok && s.events) || [];
  const botEv = evs.filter((e) => e.src === 'bot');
  CC.page('🛡️ Bot-Sicherheit', 'Security-Events mit Ursprung im WhatsApp-Bot (gemeinsames Protokoll mit der Website).',
    '<div class="cc-section"><h3>Bot-Events <span class="rt">letzte ' + botEv.length + '</span></h3>' +
    (botEv.length ? CC.table([
      { k: 'time', t: 'Wann', f: (r) => '<span class="mono">' + esc(r.time) + '</span>' },
      { k: 'event', t: 'Event', f: (r) => '<span class="cc-key">' + esc(r.event) + '</span>' },
      { k: 'sev', t: 'Level', f: (r) => '<span class="cc-tag ' + (r.sev === 'CRITICAL' ? 'bad' : r.sev === 'SUSPICIOUS' ? 'warn' : r.sev === 'WATCH' ? 'info' : 'ok') + '">' + esc(r.sev) + '</span>' },
      { k: 'action', t: 'Aktion', f: (r) => esc(r.action || '—') },
      { k: 'risk', t: 'Risk' }
    ], botEv) : '<div class="cc-empty">Keine Bot-Security-Events in den letzten Einträgen.</div>') + '</div>'
  );
}, { perms: ['security.view'] });

/* ═══ WEBSEITE-ÜBERSICHT ═══ */
CC.reg('web', async () => {
  const [sys, site, db] = await Promise.all([api('/api/system').catch(() => null), api('/api/siteinfo').catch(() => null), api('/api/database').catch(() => null)]);
  const hb = (site && site.heartbeat) || null;
  CC.page('🌐 Webseite-Übersicht', 'Status dieses Web-Servers (Dashboard & maxichen.de).',
    '<div class="cc-statgrid">' +
      '<div class="cc-stat"><div class="ic">🟢</div><div class="num st-ok">ONLINE</div><div class="lab">HTTP-Server</div><div class="sub">Node ' + esc((sys && sys.node) || '') + '</div></div>' +
      '<div class="cc-stat"><div class="ic">🤖</div><div class="num ' + (hb && hb.online ? 'st-ok' : 'st-bad') + '">' + (hb && hb.online ? 'ONLINE' : 'OFFLINE') + '</div><div class="lab">Bot-Heartbeat</div></div>' +
      '<div class="cc-stat"><div class="ic">🗄️</div><div class="num ' + (db && db.healthy ? 'st-ok' : 'st-warn') + '">' + (db && db.healthy ? 'OK' : '?') + '</div><div class="lab">Datenbank</div><div class="sub">' + (db ? db.sizeKb + ' KB' : '') + '</div></div>' +
      '<div class="cc-stat"><div class="ic">⏱</div><div class="num">' + (sys ? CC.fmtSec(sys.uptimeSec) : '—') + '</div><div class="lab">Server-Uptime</div></div>' +
    '</div>' +
    (site ? '<div class="cc-section"><h3>🔗 Bekannte Ziele &amp; Zähler</h3><div class="cc-kv">' +
      (site.links && site.links.website ? '<span class="k">Website</span><span class="v"><a href="' + esc(site.links.website) + '" target="_blank">' + esc(site.links.website) + ' ↗</a></span>' : '') +
      (site.links && site.links.channel ? '<span class="k">Kanal</span><span class="v"><a href="' + esc(site.links.channel) + '" target="_blank">WhatsApp-Kanal ↗</a></span>' : '') +
      '<span class="k">Bot-Nutzer</span><span class="v">' + ((site.counts && site.counts.users) ?? '—') + '</span>' +
      '<span class="k">Bot-Gruppen</span><span class="v">' + ((site.counts && site.counts.groups) ?? '—') + '</span>' +
      '<span class="k">Bans</span><span class="v">' + ((site.counts && site.counts.bans) ?? '—') + '</span>' +
    '</div></div>' : '')
  );
}, { perms: [] });

/* ═══ WEB-BESUCHER (aus Access-Log) ═══ */
CC.reg('webVisitors', async () => {
  const al = await api('/api/security/access-log').catch(() => null);
  const en = (al && al.entries) || [];
  const agg = {};
  for (const e of en) { const k = (e.browser || 'Unbekannt') + ' / ' + (e.os || '?'); agg[k] = agg[k] || { count: 0, last: e.time }; agg[k].count++; }
  const devRows = Object.entries(agg).map(([k, v]) => ({ dev: k, count: v.count, last: v.last })).sort((a, b) => b.count - a.count).slice(0, 20);
  const pages = {};
  for (const e of en) { const p = e.path || '/'; pages[p] = (pages[p] || 0) + 1; }
  const topPages = Object.entries(pages).map(([p, c]) => ({ p, c })).sort((a, b) => b.c - a.c).slice(0, 20);
  CC.page('🧭 Besucher & Seitenzugriffe', 'Auswertung der letzten ' + en.length + ' Access-Log-Einträge.',
    '<div class="cc-grid2">' +
    '<div class="cc-section"><h3>🖥️ Geräte / Browser</h3>' + (devRows.length ? CC.table([{ k: 'dev', t: 'Gerät' }, { k: 'count', t: 'Kontakte' }, { k: 'last', t: 'Zuletzt', f: (r) => CC.rel(r.last) }], devRows) : '<div class="cc-empty">Keine Einträge.</div>') + '</div>' +
    '<div class="cc-section"><h3>📄 Meistbesuchte Pfade</h3>' + (topPages.length ? CC.table([{ k: 'p', t: 'Pfad', f: (r) => '<span class="mono">' + esc(r.p) + '</span>' }, { k: 'c', t: 'Zugriffe' }], topPages) : '<div class="cc-empty">Keine Einträge.</div>') + '</div>' +
    '</div>' +
    '<div class="cc-section"><h3>🧾 Letzte Zugriffe</h3>' + (en.length ? CC.table([
      { k: 'time', t: 'Wann', f: (r) => CC.dt(r.time) }, { k: 'ip', t: 'Woher', f: (r) => '<span class="mono">' + esc(r.ip) + '</span>' },
      { k: 'method', t: 'Methode', f: (r) => '<span class="cc-key">' + esc(r.method) + '</span>' }, { k: 'path', t: 'Pfad', f: (r) => '<span class="mono">' + esc(r.path) + '</span>' },
      { k: 'browser', t: 'Browser', f: (r) => esc(r.browser || '—') + (r.isBot ? ' <span class="cc-tag dim">BOT</span>' : '') }, { k: 'os', t: 'OS' }, { k: 'device', t: 'Gerät', f: (r) => esc(r.device || '—') }
    ], en) : '<div class="cc-empty">Keine Einträge.</div>') + '</div>'
  );
}, { perms: ['security.view'] });

/* ═══ WEB-SESSIONS (eingeloggte Dashboard-Sitzungen) ═══ */
CC.reg('webSessions', async () => {
  const al = await api('/api/sessions/all').catch(() => null);
  const s = (al && al.sessions) || [];
  const canCtl = CC.can('sessions.control');
  CC.page('🔑 Web-Sessions', 'Aktive Dashboard-Logins — wer ist von wo angemeldet?',
    '<div class="cc-section">' + (s.length ? CC.table([
      { k: 'username', t: 'Benutzer', f: (r) => '<b>' + esc(r.username || r.number) + '</b>' + (r.current ? ' <span class="cc-tag info">DU</span>' : '') + '<div class="cc-key">' + esc(r.number || '') + '</div>' },
      { k: 'role', t: 'Rolle', f: (r) => CC.rolepill(r.role) },
      { k: 'ip', t: 'IP', f: (r) => '<span class="mono">' + esc(r.ip || '—') + '</span>' + (r.ipChanged ? ' <span title="IP gewechselt">⚠️</span>' : '') },
      { k: 'ua', t: 'Browser', f: (r) => { const ua = String(r.userAgent || ''); return ua ? esc(ua.split(')')[0].split('(')[0].slice(0, 36)) : '—'; } },
      { k: 'createdAt', t: 'Seit', f: (r) => CC.rel(r.createdAt) },
      { k: 'lastSeenAt', t: 'Aktiv', f: (r) => CC.rel(r.lastSeenAt) },
      { k: 'x', t: '', f: (r) => (!r.current && canCtl) ? '<button class="cc-btn sm danger" onclick="CC.killWebSess(\'' + esc(r.token || '') + '\')">⏹ Beenden</button>' : '', raw: true }
    ], s) : '<div class="cc-empty">Keine aktiven Web-Sessions.</div>') +
    (s.length && canCtl ? '<div class="cc-btnrow"><button class="cc-btn danger" onclick="CC.killAllWebSess()">⛔ Alle anderen Sessions beenden</button></div>' : '') +
    '</div>'
  );
  CC.killWebSess = async (token) => { if (!token) { CC.toast('❌ Keine Session-Kennung.'); return; } const r = await CC.post('/api/sessions/kill', { token }); CC.ok(r, '✅ Session beendet'); CC.reload(); };
  CC.killAllWebSess = async () => {
    if (!CC.isOwner()) { CC.toast('❌ Nur der Owner.'); return; }
    const b = await CC.confirm({ ico: '⛔', title: 'ALLE WEB-SESSIONS BEENDEN', confirmWord: 'ALLE SESSIONS', requireReauth: true, text: 'Beendet alle aktiven Dashboard-Sessions außer deiner eigenen (' + s.length + ' insgesamt).' });
    if (!b) return;
    const r = await CC.post('/api/sessions/kill-all', { ...b, confirm: b.confirmWord });
    CC.ok(r, '✅ Alle Sessions beendet'); CC.reload();
  };
}, { perms: ['sessions.view'] });

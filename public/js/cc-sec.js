/* ═══════════════════════════════════════════════════════════════
   SOUL ECHO — SICHERHEIT (Security Center · Risk · IPs · Cases)
   ═══════════════════════════════════════════════════════════════ */

async function CCipSet() {
  const sc = await api('/api/security').catch(() => null);
  if (!sc || !sc.ok) return { clients: [], blocks: [], manual: [], failed: 0, threat: '—', canManage: false };
  return {
    clients: sc.knownClients || [],
    blocks: sc.blockedIps || [],
    manual: sc.manualBans || [],
    failed: sc.failedLogins || 0,
    threat: sc.threat || '—',
    canManage: !!sc.knownClients
  };
}

/* ═══ SECURITY CENTER ═══ */
CC.reg('secCenter', async () => {
  const [sc, o24, cases] = await Promise.all([
    api('/api/security').catch(() => null),
    api('/api/security/overview').catch(() => null),
    api('/api/security/cases?status=open').catch(() => null)
  ]);
  const s = sc && sc.ok ? sc : {};
  const o = o24 && o24.ok ? o24 : {};
  const openCases = (cases && cases.cases) ? cases.cases.length : 0;
  const v = (x) => (x == null ? '—' : x);
  const threatCls = s.threat === 'HIGH' ? 'bad' : s.threat === 'WATCH' ? 'warn' : 'ok';
  CC.page('🛡️ Security Center', 'Zentrale Sicherheitslage: Erkennung, Sperren, Cases, Schutzsysteme.',
    '<div class="cc-grid2">' +
      '<div class="cc-section"><h3>📈 Bedrohungslevel</h3>' +
        '<div style="font-size:40px;font-weight:900;color:var(--' + threatCls + ')">' + esc(s.threat || '—') + '</div>' +
        '<p class="cc-hint">' + (s.threat === 'HIGH' ? '⚠️ Erhöhte Aktivität oder aktive Sperren — bitte prüfen.' : s.threat === 'WATCH' ? '👀 Beobachtung — auffällige Muster erkannt.' : '🟢 Normale Lage.') + '</p>' +
        '<div class="cc-btnrow"><button class="cc-btn sm" onclick="CC.go(\'risk\')">📈 Risk Engine</button><button class="cc-btn sm" onclick="CC.go(\'autoRules\')">⚙️ Auto-Regeln</button></div></div>' +
      '<div class="cc-section"><h3>⏱ Letzte 24 h</h3><div class="cc-kv">' +
        '<span class="k">Security-Events</span><span class="v">' + v(o.securityEvents) + '</span>' +
        '<span class="k">Login-Fehlversuche</span><span class="v">' + v(o.loginFailures) + '</span>' +
        '<span class="k">IP-Sperren</span><span class="v">' + v(o.ipBans) + '</span>' +
        '<span class="k">Benutzer-Sperren</span><span class="v">' + v(o.userBans) + '</span>' +
        '<span class="k">Kritische Events</span><span class="v">' + v(o.criticalEvents) + '</span>' +
        '<span class="k">Session-Kills</span><span class="v">' + v(o.sessionKills) + '</span>' +
        '<span class="k">Offene Cases</span><span class="v">' + v(o.openCases) + ' <span class="cc-hint">(von ' + v(o.totalCases) + ')</span></span>' +
      '</div></div>' +
    '</div>' +
    '<div class="cc-section"><h3>🚫 Blockierungen</h3><div class="cc-statgrid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">' +
      '<div class="cc-stat"><div class="num ' + (((s.blockedIps || []).length) ? 'st-bad' : 'st-ok') + '">' + (s.blockedIps || []).length + '</div><div class="lab">Aktive Auto-Blocks</div></div>' +
      '<div class="cc-stat"><div class="num ' + (((s.manualBans || []).length) ? 'st-bad' : 'st-ok') + '">' + (s.manualBans || []).length + '</div><div class="lab">Manuelle IP-Bans</div></div>' +
      '<div class="cc-stat"><div class="num">' + v(s.blockedTotal) + '</div><div class="lab">Auto-Blocks gesamt</div></div>' +
      '<div class="cc-stat"><div class="num ' + (openCases ? 'st-warn' : 'st-ok') + '">' + openCases + '</div><div class="lab">Offene Cases</div></div>' +
      '<div class="cc-stat"><div class="num">' + v(s.failedLogins) + '</div><div class="lab">Fehler im Feed</div></div>' +
    '</div><div class="cc-btnrow"><button class="cc-btn sm" onclick="CC.go(\'ips\')">🌍 IP-Listen</button><button class="cc-btn sm" onclick="CC.go(\'cases\')">🗂️ Cases</button><button class="cc-btn sm" onclick="CC.go(\'rateLimits\')">🚦 Rate Limits</button></div></div>' +
    '<div class="cc-section"><h3>⚠️ Letzte Security-Events</h3>' +
    ((s.events && s.events.length) ? CC.table([
      { k: 'time', t: 'Wann', f: (r) => '<span class="mono">' + esc(r.time) + '</span>' },
      { k: 'event', t: 'Event', f: (r) => '<span class="cc-key">' + esc(r.event) + '</span>' },
      { k: 'sev', t: 'Level', f: (r) => '<span class="cc-tag ' + (r.sev === 'CRITICAL' ? 'bad' : r.sev === 'SUSPICIOUS' ? 'warn' : r.sev === 'WATCH' ? 'info' : 'ok') + '">' + esc(r.sev) + '</span>' },
      { k: 'src', t: 'Quelle', f: (r) => (r.src === 'bot' ? '🤖 Bot' : '🌐 Web') },
      { k: 'risk', t: 'Risk' },
      { k: 'ip', t: 'Woher', f: (r) => '<span class="mono">' + esc(r.ip || '—') + '</span>' },
      { k: 'action', t: 'Aktion', f: (r) => esc(r.action || '—') }
    ], s.events.slice(0, 12)) : '<div class="cc-empty">Keine Events.</div>') + '</div>'
  );
}, { perms: ['security.view'] });

/* ═══ RISK ENGINE ═══ */
CC.reg('risk', async () => {
  const [sc, al] = await Promise.all([api('/api/security').catch(() => null), api('/api/security/access-log').catch(() => null)]);
  const s = sc && sc.ok ? sc : {};
  const access = (al && al.entries) || [];
  const riskOf = {};
  for (const e of s.events || []) { if (e.ip) riskOf[e.ip] = Math.max(riskOf[e.ip] || 0, Number(e.risk) || 0); }
  const clientRows = (s.knownClients || []).map((c) => ({
    ip: c.ip,
    risk: Math.max(Number(c.hits || 0) > 500 ? 15 : 0, Number(c.risk) || 0, riskOf[c.ip] || 0),
    hits: c.hits || 0,
    first: c.firstSeen, last: c.lastSeen,
    browser: (c.browser || '—') + (c.os ? ' / ' + c.os : ''),
    banned: c.banned, autoBlocked: c.autoBlocked
  })).sort((a, b) => b.risk - a.risk).slice(0, 100);
  const tierOf = (r) => r <= 10 ? ['normal', '🟢 NORMAL'] : r <= 30 ? ['watch', '🟡 BEOBACHTUNG'] : r <= 60 ? ['restricted', '🟠 EINGESCHRÄNKT'] : r <= 90 ? ['high', '🔴 HOCH'] : ['critical', '💀 KRITISCH'];
  const worst = clientRows[0];
  CC.page('📈 Risk Engine', 'Punktesystem: Auffälligkeiten erhöhen den Risk-Score → Eskalationsstufen. (Volle IPs nur mit security.manage.)',
    '<div class="cc-section"><h3>Stufenmodell</h3><div class="cc-gauge">' +
      [['🟢 NORMAL', '0–10', 'Keine Auffälligkeiten.'], ['🟡 BEOBACHTUNG', '11–30', 'Wiederholte Fehlversuche, verdächtige Muster.'], ['🟠 EINGESCHRÄNKT', '31–60', 'Mehrere Warnungen — kritische Funktionen gedrosselt.'], ['🔴 HOCH', '61–90', 'Angriffsmuster — aktive Überwachung, Step-up nötig.'], ['💀 KRITISCH', '91+', 'Automatische Sperren &amp; Security Cases.']]
      .map(([l, pts, tx]) => '<div class="cc-bar"><b style="width:230px;flex:0 0 230px">' + l + ' <span style="color:var(--dim);font-weight:400">(' + pts + ' Pkt.)</span></b><span style="color:var(--mut);flex:1">' + tx + '</span></div>').join('') + '</div></div>' +
    (worst ? '<div class="cc-section"><h3>🏆 Höchster Risk-Score</h3><div class="cc-kv">' +
      '<span class="k">Client</span><span class="v mono">' + esc(worst.ip) + '</span>' +
      '<span class="k">Score</span><span class="v"><b>' + worst.risk + '</b> — ' + tierOf(worst.risk)[1] + '</span>' +
      '<span class="k">Gerät</span><span class="v">' + esc(worst.browser) + '</span>' +
      '<span class="k">Zustand</span><span class="v">' + (worst.banned ? CC.pill('locked') : worst.autoBlocked ? CC.pill('banned') : '<span class="cc-tag ok">OK</span>') + '</span>' +
      '<span class="k">Zuletzt</span><span class="v">' + CC.rel(worst.last) + '</span>' +
    '</div></div>' : '') +
    '<div class="cc-section"><h3>Alle Clients nach Risk (' + clientRows.length + ')</h3>' + (clientRows.length ? CC.table([
      { k: 'ip', t: 'IP', f: (r) => '<span class="mono">' + esc(r.ip) + '</span>' },
      { k: 'risk', t: 'Score', f: (r) => '<div class="cc-progress" style="width:70px;display:inline-block;vertical-align:middle"><i style="width:' + Math.min(100, r.risk) + '%"></i></div> <b>' + r.risk + '</b> <span class="cc-key">' + tierOf(r.risk)[0].toUpperCase() + '</span>' },
      { k: 'banned', t: 'Zustand', f: (r) => r.banned ? '<span class="cc-tag bad">Manuell</span>' : r.autoBlocked ? '<span class="cc-tag warn">Auto</span>' : '<span class="cc-tag ok">—</span>' },
      { k: 'hits', t: 'Hits' },
      { k: 'browser', t: 'Gerät', f: (r) => esc(String(r.browser).slice(0, 34)) },
      { k: 'first', t: 'Erste Verb.', f: (r) => CC.rel(r.first) },
      { k: 'last', t: 'Zuletzt', f: (r) => CC.rel(r.last) },
      { k: 'x', t: '', f: (r) => '<button class="cc-btn sm" onclick="CC.showIp(\'' + esc(r.ip) + '\')">📂 Akte</button>', raw: true }
    ], clientRows) : '<div class="cc-empty">Keine bekannten Clients sichtbar (nur mit security.manage).</div>') + '</div>'
  );
}, { perms: ['security.view'] });

/* ═══ IP-LISTE ═══ */
CC.reg('ips', async () => {
  const ipd = await CCipSet();
  const q = (location.hash.match(/st=([a-z]+)/) || [])[1] || 'all';
  const chips = [['all', '🌐 Alle'], ['clients', '👀 Bekannt'], ['blocked', '🔒 Auto'], ['banned', '🚫 Manuell']];
  const rowsAll = [
    ...ipd.clients.map((c) => ({ ip: c.ip, cls: 'client', reason: '', since: c.firstSeen, last: c.lastSeen, meta: c.hits != null ? c.hits + ' Hits' : '', risk: Number(c.risk) || 0, banned: c.banned, blocked: c.autoBlocked })),
    ...ipd.blocks.map((b) => ({ ip: b.ip, cls: 'blocked', reason: b.reason || '', since: b.blockedAt, last: b.blockedAt, meta: (b.fails != null ? b.fails + ' Fehlversuche' : ''), risk: 70, banned: false, blocked: true })),
    ...ipd.manual.map((m) => ({ ip: m.ip, cls: 'banned', reason: m.reason || '', since: m.bannedAt, last: m.bannedAt, meta: (m.bannedBy ? 'von ' + m.bannedBy : ''), risk: 95, banned: true, blocked: false }))
  ];
  const flt = q === 'all' ? rowsAll : rowsAll.filter((x) => x.cls === q);
  const stateOf = (r) => r.cls === 'banned' ? '<span class="cc-pill p-locked">🚫 MANUELL</span>' : r.cls === 'blocked' ? '<span class="cc-pill p-banned">🔒 AUTO</span>' : (r.banned || r.blocked) ? '<span class="cc-pill p-locked">GESPERRT</span>' : (r.risk > 60 ? '<span class="cc-pill p-restricted">🟠 HOCH</span>' : '<span class="cc-pill p-active">🟢 OK</span>');
  CC.page('🌍 IP-Adressen', 'Alle IPs im System: Status, erste/letzte Verbindung, Risk, Sperren.',
    '<div class="cc-filters">' + chips.map(([v, l]) => '<button class="cc-chip' + (q === v ? ' on' : '') + '" onclick="location.hash=\'#/ips' + (v !== 'all' ? '?st=' + v : '') + '\'">' + l + '</button>').join('') + '</div>' +
    '<input class="cc-input" id="ipFilter" placeholder="🔎 IP filtern …" style="margin-bottom:14px">' +
    '<div id="ipWrap"></div>',
  { after: () => renderIps(flt) });

  async function renderIps(list) {
    const el = document.getElementById('ipWrap'); if (!el) return;
    const fi = ((document.getElementById('ipFilter') || {}).value || '').toLowerCase();
    const rows = list.filter((x) => !fi || String(x.ip || '').toLowerCase().includes(fi));
    const canManage = CC.can('security.manage');
    const cols = [
      { k: 'sel', t: '', f: (x) => canManage ? '<input type="checkbox" class="cc-sel" data-id="' + esc(x.ip) + '" data-cls="' + esc(x.cls) + '" title="Auswählen">' : '' },
      { k: 'ip', t: 'IP', f: (x) => '<span class="mono">' + esc(x.ip) + '</span>' },
      { k: 'st', t: 'Status', f: (x) => stateOf(x) },
      { k: 'grund', t: 'Grund / Quelle', f: (x) => esc(x.reason || x.cls || '—') },
      { k: 'first', t: 'Seit', f: (x) => x.since ? CC.rel(x.since) : '—' },
      { k: 'last', t: 'Zuletzt', f: (x) => CC.rel(x.last) },
      { k: 'meta', t: 'Details', f: (x) => esc(x.meta || '—') },
      { k: 'risk', t: 'Risk', f: (x) => x.risk || '—' },
      { k: 'x', t: '', f: (x) => '<button class="cc-btn sm" onclick="CC.showIp(\'' + esc(x.ip) + '\')">📂 Akte</button>' }
    ];
    el.innerHTML = '<div class="cc-section">' +
      (canManage && rows.length ? '<div class="cc-massbar" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:8px 2px 10px">' +
        '<b style="font-size:11px;letter-spacing:.1em;color:var(--acc);text-transform:uppercase">⚡ Massenaktion</b> ' +
        '<span id="ipMassCount" style="font-size:12px;color:var(--dim)">0 ausgewählt</span> ' +
        '<button class="cc-btn sm danger" onclick="CC.massIps(\'perm\')">⛔ Dauerhaft sperren</button>' +
        '<button class="cc-btn sm warn" onclick="CC.massIps(\'temp\')">⏳ Temporär blockieren</button>' +
        '<button class="cc-btn sm ok" onclick="CC.massIps(\'free\')">✅ Freigeben</button>' +
        '<button class="cc-btn sm" onclick="CC.clearMass(\'ipWrap\')">Auswahl leeren</button></div>' : '') +
      (rows.length ? CC.table(cols, rows) : '<div class="cc-empty">Keine IPs.</div>') + '</div>';
    const cc = el.querySelector('#ipMassCount');
    if (cc) el.querySelectorAll('input.cc-sel').forEach((c) => c.onchange = () => { cc.textContent = el.querySelectorAll('input.cc-sel:checked').length + ' ausgewählt'; });
    const inp = document.getElementById('ipFilter'); if (inp) inp.oninput = () => renderIps(list);
  }
}, { perms: ['security.view'] });

/* ── Massenaktion IPs ─────────────────────────────────────────── */
CC.massIps = async (mode) => {
  if (!CC.can('security.manage')) { CC.toast('❌ Keine Berechtigung.'); return; }
  const wrap = document.getElementById('ipWrap');
  const picked = [...wrap.querySelectorAll('input.cc-sel:checked')].map((i) => ({ ip: i.dataset.id, cls: i.dataset.cls }));
  if (!picked.length) { CC.toast('❌ Keine IPs ausgewählt.'); return; }
  let b;
  if (mode === 'perm') {
    b = await CC.confirm({ ico: '⛔', title: 'MASSENAKTION: IPs DAUERHAFT SPERREN (' + picked.length + ')', requireReauth: true, okLabel: 'Alle dauerhaft sperren', fields: [{ name: 'reason', label: 'Grund * (je IP auditiert)', type: 'textarea', required: true }] });
  } else if (mode === 'temp') {
    b = await CC.confirm({ ico: '⏳', title: 'MASSENAKTION: IPs TEMPORÄR BLOCKIEREN (' + picked.length + ')', okLabel: 'Blockieren', fields: [{ name: 'durationMinutes', label: 'Dauer (Minuten, max. 1440) *', type: 'number', value: '60', required: true }, { name: 'reason', label: 'Grund *', type: 'textarea', required: true }] });
  } else {
    b = await CC.confirm({ ico: '✅', title: 'MASSENAKTION: IPs FREIGEBEN (' + picked.length + ')', okLabel: 'Freigeben', fields: [{ name: 'reason', label: 'Grund *', type: 'textarea', required: true }] });
  }
  if (!b) return;
  let okc = 0, failc = 0, firstErr = '';
  for (const p of picked) {
    let url = '/api/security/ban-ip'; let body = { ip: p.ip, reason: b.reason, reauth: b.reauth };
    if (mode === 'perm') body.duration = 'permanent';
    else if (mode === 'temp') { body.duration = 'temporary'; body.durationMinutes = Math.min(1440, Math.max(1, Number(b.durationMinutes) || 60)); }
    else { url = p.cls === 'banned' ? '/api/security/unban-ip' : '/api/security/unblock'; body = { ip: p.ip, reason: b.reason }; }
    const r = await CC.post(url, body);
    if (r.status >= 200 && r.status < 300) okc++; else { failc++; if (!firstErr) firstErr = r.data && r.data.error; }
  }
  if (okc) CC.toast('✅ ' + okc + ' IPs verarbeitet' + (failc ? ', ' + failc + ' fehlgeschlagen' : ''));
  else CC.toast('❌ Nichts ausgeführt — ' + (firstErr || 'Berechtigung?'));
  CC.clearMass('ipWrap');
  CC.go('ips');
};

/* ═══ IP-DETAIL / AKTE ═══ */
CC.showIp = async (ip) => {
  const sc = await api('/api/security').catch(() => null);
  const s = sc && sc.ok ? sc : {};
  const al = await api('/api/security/access-log').catch(() => null);
  const entries = (al && al.entries) || [];
  const cli = (s.knownClients || []).find((c) => c.ip === ip);
  const block = (s.blockedIps || []).find((b) => b.ip === ip);
  const ban = (s.manualBans || []).find((m) => m.ip === ip);
  const evs = (s.events || []).filter((e) => e.ip === ip);
  const sesss = entries.filter((e) => (e.ip || '') === ip);
  const risk = Math.max(Number((cli && cli.risk) || 0), Number((block && block.risk) || 0), Number((ban && ban.risk) || 0), Number(cli && cli.hits > 400 ? 20 : 0), ...evs.map((e) => Number(e.risk) || 0));
  const tier = risk <= 10 ? '🟢 NORMAL' : risk <= 30 ? '🟡 BEOBACHTUNG' : risk <= 60 ? '🟠 EINGESCHRÄNKT' : risk <= 90 ? '🔴 HOCH' : '💀 KRITISCH';
  const canManage = CC.can('security.manage');
  CC.openModal(`
    <div class="cc-modal-title"><span>🌍 IP-AKTE — <span class="mono">${esc(ip)}</span></span><span class="x" onclick="CC.closeModal()">✕</span></div>
    <div class="cc-modal-body">
      <div class="cc-section" style="margin:0 0 12px"><h3>Zustand</h3><div class="cc-kv">
        <span class="k">Status</span><span class="v">${ban ? '<span class="cc-pill p-locked">🚫 MANUELL GESPERRT</span>' : block ? '<span class="cc-pill p-banned">🔒 AUTO-BLOCK</span>' : '<span class="cc-pill p-active">🟢 Nicht gesperrt</span>'}</span>
        <span class="k">Risk-Score</span><span class="v"><b>${risk}</b> Pkt. — ${tier}</span>
        ${ban ? '<span class="k">Ban-Grund</span><span class="v">' + esc(ban.reason || '—') + '</span>' : ''}
        ${ban ? '<span class="k">Bannt durch</span><span class="v">' + esc(ban.bannedBy || '—') + '</span>' : ''}
        ${block ? '<span class="k">Block-Grund</span><span class="v">' + esc(block.reason || '—') + '</span>' : ''}
        ${cli ? '<span class="k">Erste Verbindung</span><span class="v">' + CC.dt(cli.firstSeen) + '</span>' : ''}
        ${cli ? '<span class="k">Letzte Verbindung</span><span class="v">' + CC.dt(cli.lastSeen) + '</span>' : ''}
        ${cli ? '<span class="k">Anzahl Kontakte</span><span class="v">' + esc(cli.hits) + '</span>' : ''}
        ${cli && cli.numbers && cli.numbers.length ? '<span class="k">Verbundene Konten</span><span class="v">' + esc(cli.numbers.length) + ' · ' + esc(cli.numbers.slice(0, 5).join(', ')) + '</span>' : ''}
        ${cli ? '<span class="k">Gerät</span><span class="v">' + esc((cli.browser || '—') + ' · ' + (cli.os || '—') + ' · ' + (cli.device || '—')) + '</span>' : ''}
        ${cli && cli.lastPath ? '<span class="k">Letzter Pfad</span><span class="v mono">' + esc(cli.lastPath) + '</span>' : ''}
      </div></div>
      <div class="cc-section" style="margin:0 0 12px"><h3>Security-Events zu dieser IP (${evs.length})</h3>
        ${evs.length ? CC.table([{ k: 'time', t: 'Wann', f: (e) => esc(e.time) }, { k: 'event', t: 'Event', f: (e) => '<span class="cc-key">' + esc(e.event) + '</span>' }, { k: 'sev', t: 'Level', f: (e) => '<span class="cc-tag ' + (e.sev === 'CRITICAL' ? 'bad' : e.sev === 'SUSPICIOUS' ? 'warn' : e.sev === 'WATCH' ? 'info' : 'ok') + '">' + esc(e.sev) + '</span>' }, { k: 'action', t: 'Aktion', f: (e) => esc(e.action || '—') }, { k: 'risk', t: 'Risk' }], evs) : '<div class="cc-empty">Keine Events.</div>'}
      </div>
      <div class="cc-section" style="margin:0 0 12px"><h3>Zugriffe im Access-Log (${sesss.length})</h3>
        ${sesss.length ? CC.table([{ k: 'time', t: 'Wann', f: (e) => CC.dt(e.time) }, { k: 'method', t: 'Methode', f: (e) => '<span class="cc-key">' + esc(e.method) + '</span>' }, { k: 'path', t: 'Pfad', f: (e) => '<span class="mono">' + esc(e.path) + '</span>' }, { k: 'ua', t: 'Browser', f: (e) => esc(String(e.browser || '').slice(0, 26)) }], sesss) : '<div class="cc-empty">Keine Zugriffe im Log-Fenster.</div>'}
      </div>
      ${canManage ? '<div class="cc-section" style="margin:0"><h3>Aktionen</h3><div class="cc-btnrow" style="margin-top:2px">' +
        (!block && !ban ? '<button class="cc-btn sm warn" onclick="CC.banIp(\'' + esc(ip) + '\',\'temp\')">⏳ Temporär blockieren</button><button class="cc-btn sm danger" onclick="CC.banIp(\'' + esc(ip) + '\',\'perm\')">⛔ Dauerhaft sperren</button>' : '') +
        (block && !ban ? '<button class="cc-btn sm ok" onclick="CC.unbanIp(\'' + esc(ip) + '\',\'auto\')">✅ Auto-Block aufheben</button>' : '') +
        (ban ? '<button class="cc-btn sm ok" onclick="CC.unbanIp(\'' + esc(ip) + '\',\'manual\')">✅ Manuelle Sperre aufheben</button>' : '') +
        (sesss.length ? '<button class="cc-btn sm danger" onclick="CC.killIpSessions(\'' + esc(ip) + '\')">⏹ Sessions dieser IP beenden</button>' : '') +
      '</div><div class="cc-tip">Dauerhafte Sperre verlangt Passwortbestätigung; jede Aktion wird auditiert. Kritisch: eigene aktuelle IP kann nicht gesperrt werden.</div></div>' : '<p class="cc-hint">Sperr-/Freigabe-Aktionen benötigen security.manage.</p>'}`
    );
};

CC.banIp = async (ip, kind) => {
  if (!CC.can('security.manage')) { CC.toast('❌ Keine Berechtigung (security.manage).'); return; }
  const perm = kind === 'perm';
  const fields = perm
    ? [{ name: 'reason', label: 'Grund * (dauerhaft, auditiert)', type: 'textarea', required: true }]
    : [{ name: 'durationMinutes', label: 'Dauer (Minuten, max. 1440) *', type: 'number', value: '60', required: true }, { name: 'reason', label: 'Grund', type: 'textarea', required: true }, { name: 'killSessions', label: 'Aktive Sessions dieser IP sofort beenden', type: 'check' }];
  const b = await CC.confirm({ ico: perm ? '⛔' : '⏳', title: (perm ? 'IP DAUERHAFT SPERREN — ' : 'IP TEMPORÄR BLOCKIEREN — ') + ip, requireReauth: perm, fields, okLabel: perm ? 'Dauerhaft sperren' : 'Blockieren' });
  if (!b) return;
  const body = { ip, reason: b.reason, ...(perm ? { duration: 'permanent' } : { duration: 'temporary', durationMinutes: Math.min(1440, Math.max(1, Number(b.durationMinutes) || 60)), killSessions: !!b.killSessions }) };
  const r = await CC.post('/api/security/ban-ip', body);
  if (CC.ok(r, perm ? '⛔ IP dauerhaft gesperrt' : '⏳ IP temporär blockiert')) { CC.closeModal(); CC.refreshTiles(); CC.go('ips'); }
};
CC.unbanIp = async (ip, kind) => {
  if (!CC.can('security.manage')) { CC.toast('❌ Keine Berechtigung (security.manage).'); return; }
  const isAuto = kind === 'auto';
  const b = await CC.confirm({ ico: '✅', title: (isAuto ? 'Auto-Block aufheben — ' : 'Manuelle Sperre aufheben — ') + ip, fields: [{ name: 'reason', label: 'Grund * (auditiert)', type: 'textarea', required: true }] });
  if (!b) return;
  const r = await CC.post(isAuto ? '/api/security/unblock' : '/api/security/unban-ip', { ip, ...b });
  CC.ok(r, '✅ IP freigegeben'); CC.closeModal(); CC.refreshTiles(); CC.go('ips');
};
CC.killIpSessions = async (ip) => {
  const b = await CC.confirm({ ico: '⏹', title: 'Sessions der IP beenden — ' + ip, requireReauth: true, okLabel: 'Beenden', fields: [{ name: 'reason', label: 'Grund *', type: 'textarea', required: true }] });
  if (!b) return;
  const r = await CC.post('/api/sessions/kill-ip', { ip, ...b });
  CC.ok(r, '✅ Sessions beendet'); CC.closeModal(); CC.reload();
};

/* ═══ GERÄTE ═══ */
CC.reg('devices', async () => {
  const al = await api('/api/security/access-log').catch(() => null);
  const en = (al && al.entries) || [];
  const byDev = {};
  for (const e of en) {
    const key = (e.browser || 'Unbekannt') + '||' + (e.os || '?');
    byDev[key] = byDev[key] || { browser: e.browser || 'Unbekannt', os: e.os || '?', ips: new Set(), count: 0, last: e.time };
    byDev[key].count++; if (e.ip) byDev[key].ips.add(e.ip);
  }
  const rows = Object.values(byDev).map((d) => ({ ...d, nIps: d.ips.size, ips: [...d.ips].slice(0, 4).join(', ') })).sort((a, b) => b.count - a.count).slice(0, 40);
  CC.page('🖥️ Geräte', 'Browser-/OS-Kombinationen aus dem Access-Log mit IP-Clustern.',
    '<div class="cc-section">' + (rows.length ? CC.table([
      { k: 'browser', t: 'Browser', f: (r) => esc(r.browser) + (r.count > 200 ? ' <span class="cc-tag dim">viel</span>' : '') },
      { k: 'os', t: 'OS' },
      { k: 'count', t: 'Kontakte' }, { k: 'nIps', t: 'IPs' },
      { k: 'last', t: 'Zuletzt', f: (r) => CC.rel(r.last) },
      { k: 'ips', t: 'IPs (Beispiel)', f: (r) => '<span class="mono" style="font-size:11px">' + esc(r.ips) + '</span>' }
    ], rows) : '<div class="cc-empty">Keine Zugriffe im Log.</div>') + '</div>'
  );
}, { perms: ['security.view'] });

/* ═══ SECURITY CASES ═══ */
CC.reg('cases', async () => {
  const q = (location.hash.match(/st=([a-z]+)/) || [])[1] || 'open';
  const chips = [['open', '🟠 Offen'], ['resolved', '✅ Gelöst'], ['reopened', '↩️ Wiedereröffnet']];
  const d = await api('/api/security/cases?status=' + q).catch(() => null);
  const cases = (d && d.cases) || [];
  const stLabel = { open: '🟠 OFFEN', resolved: '✅ GELÖST', reopened: '↩️ WIEDERERÖFFNET' };
  CC.page('🗂️ Security Cases', 'Zusammenhängende Sicherheitsfälle als Vorgang: klären, dokumentieren, schließen.',
    '<div class="cc-filters">' + chips.map(([v, l]) => '<button class="cc-chip' + (q === v ? ' on' : '') + '" onclick="location.hash=\'#/cases' + (v !== 'open' ? '?st=' + v : '') + '\'">' + l + '</button>').join('') + '</div>' +
    '<div class="cc-section">' + (cases.length ? CC.table([
      { k: 'id', t: 'Case', f: (c) => '<b>#' + esc(String(c.id).toUpperCase()).slice(0, 9) + '</b>' },
      { k: 'status', t: 'Status', f: (c) => '<span class="cc-tag ' + (c.status === 'open' ? 'warn' : c.status === 'reopened' ? 'info' : 'ok') + '">' + esc(stLabel[c.status] || c.status) + '</span>' },
      { k: 'events', t: 'Ereignisse', f: (c) => (c.eventTypes || []).slice(0, 2).map((t2) => '<span class="cc-key">' + esc(t2) + '</span>').join(' ') + (c.eventCount > 2 ? ' <span class="cc-hint">+' + (c.eventCount - 2) + '</span>' : '') },
      { k: 'ip', t: 'IP', f: (c) => c.ip ? '<span class="mono">' + esc(c.ip) + '</span>' : '—' },
      { k: 'score', t: 'Score', f: (c) => (c.score != null ? c.score : '—') + ' <span class="cc-hint">(max ' + (c.maxRisk != null ? c.maxRisk : '—') + ')</span>' },
      { k: 'firstAt', t: 'Erstellt', f: (c) => CC.dt(c.firstAt || c.createdAt) },
      { k: 'note', t: 'Notiz', f: (c) => esc((c.note || (c.resolvedBy ? 'gelöst durch ' + c.resolvedBy : '')) || '—') },
      { k: 'x', t: '', f: (c) => '<button class="cc-btn sm" onclick="CC.caseView(\'' + esc(c.id) + '\')">📂</button>' + (CC.can('security.manage') ? '<button class="cc-btn sm" onclick="CC.caseAct(\'' + esc(c.id) + '\',\'' + c.status + '\',\'' + esc(c.ip || '') + '\')">Bearbeiten</button>' : ''), raw: true }
    ], cases) : '<div class="cc-empty">Keine Cases mit Status „' + q + '“.</div>') + '</div>'
  );
  CC._casesCache = cases;
  CC.caseView = (id) => {
    const c = (CC._casesCache || []).find((x) => x.id === id);
    if (!c) { CC.toast('❌ Case nicht gefunden.'); return; }
    const evs = (c.events || []).slice().reverse();
    CC.openModal('<div class="cc-modal-title"><span>🗂️ CASE #' + esc(String(c.id).toUpperCase()) + '</span><span class="x" onclick="CC.closeModal()">✕</span></div>' +
      '<div class="cc-modal-body"><div class="cc-section" style="margin:0 0 12px"><h3>Vorgang</h3><div class="cc-kv">' +
      '<span class="k">Status</span><span class="v"><span class="cc-tag ' + (c.status === 'open' ? 'warn' : 'ok') + '">' + esc(stLabel[c.status] || c.status) + '</span></span>' +
      '<span class="k">IP</span><span class="v mono">' + esc(c.ip || '—') + '</span>' +
      '<span class="k">Score / maxRisk</span><span class="v">' + esc(c.score) + ' / ' + esc(c.maxRisk) + '</span>' +
      '<span class="k">Ereignisse</span><span class="v">' + esc(c.eventCount) + '</span>' +
      '<span class="k">Quellen</span><span class="v">' + esc((c.sources || []).join(', ') || '—') + '</span>' +
      '<span class="k">Erster Fund</span><span class="v">' + CC.dt(c.firstAt) + '</span>' +
      '<span class="k">Letzter Fund</span><span class="v">' + CC.dt(c.lastAt) + '</span>' +
      (c.resolvedAt ? '<span class="k">Gelöst</span><span class="v">' + CC.dt(c.resolvedAt) + ' durch ' + esc(c.resolvedBy || '—') + '</span>' : '') +
      '</div></div>' +
      '<div class="cc-section" style="margin:0"><h3>Einzelevents (' + evs.length + ')</h3>' +
      (evs.length ? CC.table([
        { k: 'time', t: 'Wann', f: (e) => CC.dt(e.time) },
        { k: 'event', t: 'Event', f: (e) => '<span class="cc-key">' + esc(e.event) + '</span>' },
        { k: 'risk', t: 'Risk', f: (e) => { const t2 = e.risk >= 70 ? ['bad', 'CRITICAL'] : e.risk >= 40 ? ['warn', 'SUSPICIOUS'] : e.risk >= 20 ? ['info', 'WATCH'] : ['ok', 'OK']; return '<span class="cc-tag ' + t2[0] + '">' + t2[1] + '</span>'; } },
        { k: 'action', t: 'Aktion', f: (e) => esc(e.action || '—') },
        { k: 'reason', t: 'Begründung', f: (e) => esc(e.reason || '—') }
      ], evs) : '<div class="cc-empty">Keine Events.</div>') + '</div></div>');
  };
}, { perms: ['security.view'] });

CC.caseAct = async (id, status, ip) => {
  const isOpen = status === 'open' || status === 'reopened';
  if (!CC.can('security.manage')) { CC.toast('❌ Klären erfordert security.manage.'); return; }
  const b = isOpen
    ? await CC.confirm({ ico: '✅', title: 'Case klären — ' + id, okLabel: 'Als gelöst markieren', fields: [{ name: 'note', label: 'Klärungsnotiz * (auditiert)', type: 'textarea', required: true }] })
    : await CC.confirm({ ico: '↩️', title: 'Case wiedereröffnen — ' + id, okLabel: 'Wiedereröffnen', fields: [{ name: 'reason', label: 'Begründung *', type: 'textarea', required: true }] });
  if (!b) return;
  const r = await CC.post(isOpen ? '/api/security/cases/resolve' : '/api/security/cases/reopen', isOpen ? { id, note: b.note } : { id, reason: b.reason });
  CC.ok(r, '✅ Case aktualisiert'); CC.reload();
};

/* ═══ SPERREN: IP ═══ */
CC.reg('sperrenIp', async () => {
  const ipd = await CCipSet();
  const all = [
    ...ipd.blocks.map((b) => ({ ip: b.ip, cls: 'blocked', reason: b.reason || '', at: b.blockedAt })),
    ...ipd.manual.map((m) => ({ ip: m.ip, cls: 'banned', reason: m.reason || '', at: m.bannedAt }))
  ];
  CC.page('🚫 IP-Sperren', 'Aktive automatische & manuelle IP-Sperren mit Schnellentsperrung.',
    '<div class="cc-section">' + (all.length ? CC.table([
      { k: 'ip', t: 'IP', f: (x) => '<span class="mono">' + esc(x.ip) + '</span>' },
      { k: 'cls', t: 'Art', f: (x) => x.cls === 'banned' ? '<span class="cc-tag bad">Manuell</span>' : '<span class="cc-tag warn">Auto</span>' },
      { k: 'reason', t: 'Grund', f: (x) => esc(x.reason || '—') },
      { k: 'at', t: 'Seit', f: (x) => CC.dt(x.at) },
      { k: 'x', t: '', f: (x) => CC.can('security.manage') ? '<button class="cc-btn sm ok" onclick="CC.unbanIp(\'' + esc(x.ip) + '\',\'' + (x.cls === 'blocked' ? 'auto' : 'manual') + '\')">Freigeben</button>' : '' }
    ], all) : '<div class="cc-empty">Keine aktiven IP-Sperren.</div>') +
    (CC.can('security.manage') ? '<div class="cc-btnrow"><button class="cc-btn sm danger" onclick="CC.banDialogNew()">🚫 IP manuell sperren</button></div>' : '') + '</div>'
  );
}, { perms: ['security.view'] });

CC.banDialogNew = async () => {
  const b = await CC.confirm({ ico: '🚫', title: 'IP manuell sperren', fields: [
    { name: 'ip', label: 'IP-Adresse *', required: true },
    { name: 'kind', label: 'Art', type: 'select', options: [{ v: 'temp', l: 'Vorübergehend' }, { v: 'perm', l: 'Dauerhaft (Passwort-Bestätigung)' }] },
    { name: 'durationMinutes', label: 'Dauer Minuten (bei temporär)', type: 'number', value: '60' },
    { name: 'reason', label: 'Grund * (auditiert)', type: 'textarea', required: true }] });
  if (!b) return;
  const body = { ip: b.ip.trim(), reason: b.reason };
  if (b.kind === 'perm') body.duration = 'permanent';
  else { body.duration = 'temporary'; body.durationMinutes = Math.min(1440, Math.max(1, Number(b.durationMinutes) || 60)); }
  const r = await CC.post('/api/security/ban-ip', body);
  if (CC.ok(r, '✅ IP gesperrt')) { CC.refreshTiles(); CC.go('sperrenIp'); }
};

/* ═══ SPERREN: BENUTZER ═══ */
CC.reg('sperrenUser', async () => {
  const accs = await CCacc();
  const canManage = CC.can('accounts.manage');
  const bad = accs.filter((a) => a.status === 'locked' || a.status === 'disabled' || a.status === 'restricted');
  CC.page('🧍 Benutzer-Sperren', 'Gesperrte, deaktivierte und eingeschränkte Accounts im Überblick.',
    '<div class="cc-section">' + (bad.length ? CC.table([
      { k: 'username', t: 'Benutzer', f: (r) => '<b>' + esc(r.username) + '</b><div class="cc-key">' + esc(r.number) + '</div>' },
      { k: 'status', t: 'Status', f: (r) => CC.pill(r.status) },
      { k: 'role', t: 'Rolle', f: (r) => CC.rolepill(r.role) },
      { k: 'reason', t: 'Grund', f: (r) => esc(r.lockedReason || r.disabledReason || '—') },
      { k: 'x', t: '', f: (r) => '<button class="cc-btn sm" onclick="CC.openAkte(\'' + esc(r.id) + '\')">📂 Akte</button>' + (canManage ? '<button class="cc-btn sm ok" onclick="CC.akteStatus(\'' + esc(r.id) + '\',\'active\')">▶ Freischalten</button>' : ''), raw: true }
    ], bad) : '<div class="cc-empty">Keine gesperrten/deaktivierten Benutzer.</div>') + '</div>'
  );
}, { perms: ['accounts.view'] });

/* ═══ SPERREN: SESSIONS je Benutzer ═══ */
CC.reg('sperrenSessions', async () => {
  const al = await api('/api/sessions/all').catch(() => null);
  const s = (al && al.sessions) || [];
  const canCtl = CC.can('sessions.control');
  const byUser = {};
  for (const x of s) {
    byUser[x.username || x.number] = byUser[x.username || x.number] || [];
    byUser[x.username || x.number].push(x);
  }
  const rows = Object.entries(byUser).map(([u, list]) => ({ user: u, list, n: list.length, ips: [...new Set(list.map((x) => x.ip))].join(', '), last: list[0].lastSeenAt || list[0].createdAt }));
  CC.killUserSessions = async (u) => {
    if (!canCtl) { CC.toast('❌ Keine Berechtigung (sessions.control).'); return; }
    const list = byUser[u] || [];
    const b = await CC.confirm({ ico: '⏹', title: 'Sessions beenden — ' + u, text: 'Es werden ' + list.length + ' Sessions einzeln beendet.', okLabel: 'Beenden' });
    if (!b) return;
    let ok = 0, fail = 0;
    for (const x of list) { if (x.token && !x.current) { const r = await CC.post('/api/sessions/kill', { token: x.token }); if (r.status >= 200 && r.status < 300) ok++; else fail++; } else if (x.current) fail++; }
    if (ok) CC.toast('✅ ' + ok + ' Sessions beendet' + (fail ? ' (' + fail + ' übersprungen)' : ''));
    CC.reload();
  };
  CC.page('🔌 Session-Sperren', 'Wer hat wie viele aktive Sitzungen — gezielt einzelne Benutzer abklemmen.',
    '<div class="cc-section">' + (rows.length ? CC.table([
      { k: 'user', t: 'Benutzer', f: (r) => '<b>' + esc(r.user) + '</b>' },
      { k: 'n', t: 'Aktive Sessions', f: (r) => '<span class="cc-pill p-active">' + r.n + '</span>' },
      { k: 'ips', t: 'IPs', f: (r) => '<span class="mono">' + esc(r.ips) + '</span>' },
      { k: 'last', t: 'Aktiv', f: (r) => CC.rel(r.last) },
      { k: 'x', t: '', f: (r) => canCtl ? '<button class="cc-btn sm danger" onclick="CC.killUserSessions(\'' + esc(r.user) + '\')">⏹ Alle beenden</button>' : '', raw: true }
    ], rows) : '<div class="cc-empty">Keine aktiven Sessions.</div>') + '</div>'
  );
}, { perms: ['sessions.view'] });

/* ═══  OWNER-ALERT CENTER (Security-Warnungen im Web) ═══ */
CC.reg('ownerAlerts', async () => {
  const d = await api('/api/owner-alerts').catch(() => null);
  if (!d || !d.ok) { CC.viewErr('Keine Berechtigung (security.view).'); return; }
  const alerts = d.alerts || [];
  const sevTag = { critical: ['bad', '🔴 KRITISCH'], warning: ['warn', '🟠 WARNUNG'], notice: ['info', '🟡 HINWEIS'], info: ['ok', '🟢 INFO'] };
  const sevCount = (s2) => alerts.filter((a) => a.severity === s2).length;
  const filtered = alerts;
  CC.page('🔔 Owner-Alerts', 'Sicherheits-Warnungen &amp; automatische Aktionen — dieselben Alerts, die auch per WhatsApp ankommen (Webmail-Queue), mit Read-Status.',
    '<div class="cc-statgrid">' +
      '<div class="cc-stat"><div class="ic">🔴</div><div class="num' + (sevCount('critical') ? ' st-bad' : '') + '">' + sevCount('critical') + '</div><div class="lab">Kritisch</div></div>' +
      '<div class="cc-stat"><div class="ic">🟠</div><div class="num' + (sevCount('warning') ? ' st-warn' : '') + '">' + sevCount('warning') + '</div><div class="lab">Warnungen</div></div>' +
      '<div class="cc-stat"><div class="ic">🟡</div><div class="num">' + sevCount('notice') + '</div><div class="lab">Hinweise</div></div>' +
      '<div class="cc-stat"><div class="ic">✉️</div><div class="num">' + (d.unread ?? 0) + '</div><div class="lab">Ungelesen</div></div>' +
    '</div><br>' +
    (filtered.length ? filtered.map((a) => {
      const t = sevTag[a.severity] || sevTag.notice;
      return '<div class="cc-event mx-alert' + (a.read ? ' read' : '') + '" id="alrt_' + esc(a.id) + '"><div class="ev-ico">' + t[0].split(' ')[0] + '</div><div class="ev-main"><div class="ev-t">' + esc(a.event) + ' <span class="cc-tag ' + t[1].split(' ')[1] === 'KRITISCH' ? 'bad' : t[0].includes('warn') ? 'warn' : 'info' + '">' + esc(t[1]) + '</span>' + (a.read ? '' : ' <span class="cc-tag ok">NEU</span>') + '</div><div class="ev-s">' + esc(String(a.text || '').replace(/\n/g, ' · ').slice(0, 220)) + '</div></div><div class="ev-time">' + CC.dt(a.createdAt) + '</div>' + (!a.read ? '<button class="cc-btn sm" style="margin-left:8px" onclick="CC.markAlertRead(\'' + esc(a.id) + '\')">✓ Gelesen</button>' : '') + '</div>';
    }).join('') : '<div class="cc-empty">Keine Alerts — alles ruhig. 🟢</div>')
  );
}, { perms: ['security.view'] });

CC.markAlertRead = async (id) => {
  await CC.post('/api/owner-alerts/read', { id });
  const el = document.getElementById('alrt_' + id);
  if (el) { el.classList.add('read'); el.innerHTML = el.innerHTML.replace(' <span class="cc-tag ok">NEU</span>', ''); const b = el.querySelector('.cc-btn'); if (b) b.remove(); }
  CC.toast('✓ Als gelesen markiert');
};

/* Menü: Alert-Center in SICHERHEIT */
(function () {
  const g = CC.menu.find((m) => m.sec && m.sec.startsWith('🛡 SICHERHEIT'));
  if (g && !g.items.find((i) => i.id === 'ownerAlerts')) {
    g.items.unshift({ id: 'ownerAlerts', ico: '🔔', label: 'Owner-Alerts', perms: ['security.view'] });
  }
})();

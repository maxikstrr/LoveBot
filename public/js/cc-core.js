/* ═══════════════════════════════════════════════════════════════
   SOUL ECHO CONTROL CENTER — Core (Router · Layout · UI-Helfer)
   Läuft auf dem LoveBot-Webserver und nutzt die echten /api/*.
   ═══════════════════════════════════════════════════════════════ */
const CC = {
  me: { role: 'user', perms: [], name: '', username: '', number: '', status: 'active' },
  pages: new Map(),        // id -> fn(pageCtx)
  active: 'dash',
  _nav: [],
  _timers: [],
  _dirty: {}               // für Top-Tiles-Cache
};

/* ── Token / Auth ─────────────────────────────────────────────── */
CC.token = () => localStorage.getItem('love_token') || '';
CC.isOwner = () => CC.me.role === 'owner';
CC.can = (perm) => CC.isOwner() || (Array.isArray(CC.me.perms) && CC.me.perms.includes(perm));
CC.anyPerm = (list) => !list || list.length === 0 || list.some((p) => CC.can(p));

/* ── eigener POST (kein 401-Redirect → Step-up-Reauth auffangbar) ── */
CC.post = async (url, body) => {
  let res, data;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + CC.token() },
      body: JSON.stringify(body || {})
    });
    data = await res.json().catch(() => ({}));
  } catch (e) { return { status: 0, data: { error: 'Server nicht erreichbar.' } }; }
  /* Step-up-Reauth nötig → einmal Passwort nachfragen und erneut senden */
  if (res.status === 401 && data.needsReauth) {
    const pw = await CC.askPassword(data.action || body?.reauthAction || 'kritische Aktion');
    if (pw === null) return { status: 401, data, cancelled: true };
    return CC.post(url, { ...body, reauth: pw });
  }
  if (res.status === 401) { localStorage.clear(); location.href = '/login.html'; }
  return { status: res.status, data };
};

/* ── Toast / Ergebnis ─────────────────────────────────────────── */
CC.toast = (t) => { try { toast(t); } catch (e) { alert(t); } };
CC.ok = (r, okText) => {
  if (r && r.status >= 200 && r.status < 300) { CC.toast(okText || '✅ Erfolgreich'); return true; }
  CC.toast('❌ ' + ((r && (r.data?.error || r.data?.message)) || 'Fehler bei der Aktion.'));
  return false;
};

/* ── Seite scaffolden ─────────────────────────────────────────── */
CC.page = (title, sub, html, opts = {}) => {
  const root = document.getElementById('ccView');
  const chips = (opts.chips || '').length ? '<div class="cc-filters">' + opts.chips + '</div>' : '';
  root.innerHTML = '<h1>' + title + '</h1>' +
    (sub ? '<p class="cc-subline">' + sub + '</p>' : '') + chips + html;
  if (opts.after) opts.after();
};

/* ── Table-Builder ────────────────────────────────────────────── */
CC.table = (cols, rows) => {
  if (!rows || !rows.length) return '<div class="cc-empty">— keine Einträge —</div>';
  const th = cols.map((c) => '<th>' + esc(c.t || '') + '</th>').join('');
  const trs = rows.map((r) => {
    const tds = cols.map((c) => {
      let v = c.f ? c.f(r) : r[c.k];
      if (v === undefined || v === null) v = '—';
      /* f()-Ergebnisse sind gebaute HTML-Zellen (mit esc() im Builder);
         reine Datenfelder (ohne f) werden hier automatisch escaped. */
      const inner = c.f ? String(v) : esc(String(v));
      return '<td>' + inner + '</td>';
    }).join('');
    return '<tr>' + tds + '</tr>';
  }).join('');
  return '<div class="cc-tablewrap" style="overflow-x:auto"><table class="cc-table"><thead><tr>' + th + '</tr></thead><tbody>' + trs + '</tbody></table></div>';
};

/* ── Badges & Zeit ────────────────────────────────────────────── */
CC.pill = (status) => {
  const map = { active: ['p-active', '🟢 AKTIV'], pending: ['p-pending', '🟡 AUSSTEHEND'], restricted: ['p-restricted', '🟠 EINGESCHRÄNKT'], disabled: ['p-disabled', '⚫ DEAKTIVIERT'], locked: ['p-locked', '🔴 GESPERRT'], banned: ['p-banned', '⛔ BANNED'] };
  const m = map[String(status || 'active').toLowerCase()] || ['p-user', status];
  return '<span class="cc-pill ' + m[0] + '">' + m[1] + '</span>';
};
CC.rolepill = (role) => {
  const map = { owner: 'p-owner', deputy: 'p-deputy', admin: 'p-admin', supporter: 'p-supporter', groupadmin: 'p-groupadmin', user: 'p-user', banned: 'p-banned' };
  const label = { owner: 'OWNER', deputy: 'DEPUTY', admin: 'ADMIN', supporter: 'SUPPORTER', groupadmin: 'GROUP ADMIN', user: 'USER', banned: 'BANNED' };
  return '<span class="cc-pill ' + (map[role] || 'p-user') + '">' + (label[role] || role) + '</span>';
};
CC.rel = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso); if (isNaN(d)) return '—';
  const s = Math.max(0, Math.round((Date.now() - d.getTime()) / 1000));
  if (s < 60) return 'vor ' + s + ' s';
  if (s < 3600) return 'vor ' + Math.floor(s / 60) + ' Min.';
  if (s < 86400) return 'vor ' + Math.floor(s / 3600) + ' Std.';
  return 'vor ' + Math.floor(s / 86400) + ' Tagen';
};
CC.dt = (iso) => { if (!iso) return '—'; const d = new Date(iso); return isNaN(d) ? '—' : d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); };
CC.fmtSec = (s) => { s = Math.max(0, Math.floor(Number(s) || 0)); const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60); return (d ? d + ' T ' : '') + h + ':' + String(m).padStart(2, '0'); };

/* ── Modal-System ─────────────────────────────────────────────── */
CC.openModal = (html, wide) => {
  const ov = document.getElementById('ccModal');
  const card = document.getElementById('ccModalCard');
  card.className = 'cc-modal' + (wide ? '' : ' cc-modal-sm');
  card.innerHTML = html;
  ov.style.display = 'flex';
  ov.onclick = (e) => { if (e.target === ov) CC.closeModal(); };
  return card;
};
CC.closeModal = () => {
  document.getElementById('ccModal').style.display = 'none';
  if (CC._confirmRes) { const r = CC._confirmRes; CC._confirmRes = null; r(null); }
};

/* Bestätigungs-/Formular-Dialog → Promise der Feldwerte */
CC.confirm = (opts) => {
  const fields = opts.fields || [];
  const requireReauth = !!opts.requireReauth;
  const confirmWord = opts.confirmWord || null;
  return new Promise((resolve) => {
    let fieldHtml = fields.map((f) => {
      const id = 'cf_' + f.name;
      if (f.type === 'textarea') return '<div class="cc-field"><label>' + (f.label || f.name) + '</label><textarea class="cc-textarea" id="' + id + '" placeholder="' + esc(f.placeholder || '') + '"></textarea></div>';
      if (f.type === 'select') return '<div class="cc-field"><label>' + (f.label || f.name) + '</label><select class="cc-select" id="' + id + '">' + (f.options || []).map((o) => '<option value="' + esc(o.v) + '">' + esc(o.l) + '</option>').join('') + '</select></div>';
      if (f.type === 'check') return '<div class="cc-field"><label style="display:flex;gap:8px;align-items:center;text-transform:none;letter-spacing:0;cursor:pointer"><input type="checkbox" id="' + id + '"' + (f.checked ? ' checked' : '') + '> ' + esc(f.label || f.name) + '</label></div>';
      return '<div class="cc-field"><label>' + (f.label || f.name) + '</label><input class="cc-input" id="' + id + '" type="' + (f.type || 'text') + '" placeholder="' + esc(f.placeholder || '') + '" value="' + esc(f.value || '') + '"></div>';
    }).join('');
    if (requireReauth) {
      fieldHtml += '<div class="cc-field"><label>🔐 Passwort bestätigen (kritisch)</label><input class="cc-input" id="cf_reauth" type="password" autocomplete="current-password" placeholder="Dein Owner-Passwort"></div>';
    }
    if (confirmWord) {
      fieldHtml += '<div class="cc-field"><label>⚠️ Bestätigungswort eingeben</label><input class="cc-input" id="cf_confirmword" type="text" placeholder="' + esc(confirmWord) + '"></div>';
    }
    const card = CC.openModal(
      '<div class="cc-modal-title"><span>' + (opts.ico || '⚡') + ' ' + esc(opts.title || 'Aktion') + '</span><span class="x" onclick="CC.closeModal()">✕</span></div>' +
      '<div class="cc-modal-body"><div style="color:var(--mut);font-size:13px;margin-bottom:14px">' + (opts.text || '') + '</div>' + fieldHtml + '</div>' +
      '<div class="cc-modal-foot"><button class="cc-btn" onclick="CC.closeModal()">Abbrechen</button><button class="cc-btn primary" id="cf_ok">' + (opts.okLabel || 'Ausführen') + '</button></div>');
    card.querySelector('#cf_ok').onclick = () => {
      const body = {};
      let bad = '';
      for (const f of fields) {
        const el = card.querySelector('#cf_' + f.name);
        const val = el ? (el.type === 'checkbox' ? el.checked : el.value.trim()) : '';
        if (f.required && !val) { bad = 'Bitte fülle „' + (f.label || f.name) + '“ aus.'; break; }
        body[f.name] = val;
      }
      if (!bad && requireReauth) {
        const pw = card.querySelector('#cf_reauth').value;
        if (!pw) bad = 'Bitte gib dein Passwort zur Bestätigung ein.';
        else body.reauth = pw;
      }
      if (!bad && confirmWord) {
        const w = card.querySelector('#cf_confirmword').value;
        if (w !== confirmWord) bad = 'Bestätigungswort stimmt nicht (erwartet: ' + confirmWord + ').';
      }
      if (bad) { CC.toast('❌ ' + bad); return; }
      CC._confirmRes = null;
      CC.closeModal();
      resolve(body);
    };
  });
  CC._confirmRes = resolve; /* Abbruch (X/Backdrop) → resolve(null) */
};

/* Step-up-Reauth-Dialog (wenn Server 401+needsReauth liefert) */
CC.askPassword = (action) => new Promise((resolve) => {
  const ov = document.getElementById('ccReauth');
  document.getElementById('ccReauthBody').innerHTML =
    '<p style="margin:0 0 12px">Diese Aktion ist kritisch — bitte mit deinem Passwort bestätigen.</p>' +
    '<div class="cc-tip">Aktion: <b>' + esc(action || '?') + '</b></div>' +
    '<div class="cc-field"><input class="cc-input" id="ccReauthPw" type="password" autocomplete="current-password" placeholder="Passwort"></div>' +
    '<div class="cc-btnrow"><button class="cc-btn" id="ccReauthNo">Abbrechen</button><button class="cc-btn primary" id="ccReauthYes">Bestätigen</button></div>';
  ov.style.display = 'flex';
  const done = (v) => { ov.style.display = 'none'; resolve(v); };
  document.getElementById('ccReauthNo').onclick = () => done(null);
  document.getElementById('ccReauthYes').onclick = () => { const p = document.getElementById('ccReauthPw').value; if (!p) { CC.toast('❌ Passwort fehlt'); return; } done(p); };
  document.getElementById('ccReauthPw').onkeydown = (e) => { if (e.key === 'Enter') document.getElementById('ccReauthYes').click(); };
  setTimeout(() => { const i = document.getElementById('ccReauthPw'); if (i) i.focus(); }, 30);
});

/* ── Navigation ───────────────────────────────────────────────── */
CC.reg = (id, fn, meta = {}) => CC.pages.set(id, { fn, meta });
CC.menu = [
  { sec: 'HAUPT', items: [{ id: 'dash', ico: '🛸', label: 'Dashboard' }] },
  { sec: '🤖 BOT', items: [
    { id: 'bot', ico: '📊', label: 'Übersicht' },
    { id: 'botSessions', ico: '📡', label: 'Bot-Sessions' },
    { id: 'botWhatsapp', ico: '🟢', label: 'WhatsApp' },
    { id: 'botGroups', ico: '👥', label: 'Gruppen', perms: ['groups.view'] },
    { id: 'botSecurity', ico: '🛡️', label: 'Bot-Sicherheit', perms: ['security.view'] }
  ]},
  { sec: '🌐 WEBSEITE', items: [
    { id: 'web', ico: '🌐', label: 'Übersicht' },
    { id: 'webVisitors', ico: '🧭', label: 'Besucher & Zugriffe', perms: ['security.view'] },
    { id: 'webSessions', ico: '🔑', label: 'Web-Sessions', perms: ['sessions.view'] }
  ]},
  { sec: '👥 BENUTZER', items: [
    { id: 'users', ico: '👥', label: 'Benutzer (Akten)', perms: ['accounts.view'] },
    { id: 'userNew', ico: '➕', label: 'Benutzer erstellen', perms: ['accounts.manage'] },
    { id: 'einladungen', ico: '📨', label: 'Einladungen', perms: ['accounts.view'] },
    { id: 'roles', ico: '🎖️', label: 'Rollen & Rechte', perms: ['roles.assign', 'accounts.view'] },
    { id: 'templates', ico: '📋', label: 'Rechtevorlagen', perms: ['roles.assign'] }
  ]},
  { sec: '🛡 SICHERHEIT', items: [
    { id: 'secCenter', ico: '🛡️', label: 'Security Center', perms: ['security.view'] },
    { id: 'risk', ico: '📈', label: 'Risk Engine', perms: ['security.view'] },
    { id: 'rateLimits', ico: '🚦', label: 'Rate Limits', perms: ['security.view'] },
    { id: 'autoRules', ico: '⚙️', label: 'Auto-Regeln', perms: ['security.view'] },
    { id: 'ips', ico: '🌍', label: 'IP-Adressen', perms: ['security.view'] },
    { id: 'devices', ico: '🖥️', label: 'Geräte', perms: ['security.view'] },
    { id: 'cases', ico: '🗂️', label: 'Security Cases', perms: ['security.view'] }
  ]},
  { sec: '🚫 SPERREN', items: [
    { id: 'sperrenIp', ico: '🌍', label: 'IP-Sperren', perms: ['security.view'] },
    { id: 'sperrenUser', ico: '🧍', label: 'Benutzer-Sperren', perms: ['accounts.view'] },
    { id: 'sperrenSessions', ico: '🔌', label: 'Session-Sperren', perms: ['sessions.view'] }
  ]},
  { sec: '📜 PROTOKOLLE', items: [
    { id: 'logsAudit', ico: '📖', label: 'Audit Log', perms: ['logs.view'] },
    { id: 'logsAccess', ico: '🧾', label: 'Access Log', perms: ['security.view'] },
    { id: 'logsSecurity', ico: '⚠️', label: 'Security Log', perms: ['security.view'] },
    { id: 'logsBot', ico: '🤖', label: 'Bot Log', perms: ['logs.view'] },
    { id: 'logsSystem', ico: '🖧', label: 'System Log', perms: ['logs.view'] }
  ]},
  { sec: '⚙ SYSTEM', items: [
    { id: 'sysInfo', ico: '🖥️', label: 'Systeminformationen', perms: ['system.view'] },
    { id: 'sysConfig', ico: '⚙️', label: 'Konfiguration', perms: ['system.view'] },
    { id: 'sysDb', ico: '🗄️', label: 'Datenbank', perms: ['db.view'] },
    { id: 'sysBackups', ico: '💾', label: 'Backups', perms: ['db.view', 'db.backup'] },
    { id: 'sysMaint', ico: '🛠️', label: 'Wartungsmodus', perms: ['system.view'] },
    { id: 'sysEmergency', ico: '🚨', label: 'Notfallmodus', perms: ['system.control'] }
  ]}
];

CC.buildSidebar = () => {
  const el = document.getElementById('ccSide');
  let html = '';
  for (const g of CC.menu) {
    const vis = g.items.filter((it) => CC.anyPerm(it.perms));
    if (!vis.length) continue;
    html += '<div class="cc-navgroup"><div class="cc-navlabel">' + esc(g.sec) + '</div>';
    for (const it of vis) {
      const on = CC.active === it.id;
      html += '<a class="cc-navitem' + (on ? ' on' : '') + '" href="#/' + it.id + '" data-id="' + it.id + '"><span class="ico">' + it.ico + '</span><span class="l">' + esc(it.label) + '</span></a>';
    }
    html += '</div>';
  }
  html += '<div class="cc-navlabel">LINKS</div>' +
    '<a class="cc-navitem" href="/"><span class="ico">🏠</span><span class="l">Website</span></a>' +
    '<a class="cc-navitem" href="/admin.html"><span class="ico">💜</span><span class="l">LoveBot Panel</span></a>' +
    '<a class="cc-navitem" href="/status.html"><span class="ico">📡</span><span class="l">Live-Status</span></a>';
  el.innerHTML = html;
  el.querySelectorAll('.cc-navitem[data-id]').forEach((a) => {
    a.onclick = (ev) => { ev.preventDefault(); CC.go(a.dataset.id); };
  });
};

/* ── Router ───────────────────────────────────────────────────── */
CC.crumbOf = (id) => {
  for (const g of CC.menu) { const it = g.items.find((x) => x.id === id); if (it) return [g.sec.replace(/^[^\s]+\s/, ''), it.label]; }
  return ['System', id];
};
CC.go = (id) => {
  const p = CC.pages.get(id);
  if (!p) { CC.viewErr('Unbekannte Ansicht: ' + id); return; }
  if (!CC.anyPerm(p.meta.perms)) { CC.viewErr('⛔ Keine Berechtigung für diese Ansicht.'); return; }
  CC.active = id;
  location.hash = '#/' + id;
  CC.buildSidebar();
  const [g, l] = CC.crumbOf(id);
  document.getElementById('ccCrumb').innerHTML = 'SOUL ECHO / <b>' + esc(g) + '</b> / ' + esc(l);
  const root = document.getElementById('ccView');
  root.innerHTML = '<div class="cc-loading">🛸 Lade …</div>';
  try { p.fn(); } catch (err) { root.innerHTML = '<div class="cc-empty">⚠️ Fehler beim Rendern: ' + esc(err.message || err) + '</div>'; console.error(err); }
};
CC.viewErr = (t) => {
  const root = document.getElementById('ccView');
  root.innerHTML = '<div class="cc-section"><h3>⛔ Zugriff</h3><p class="cc-subline" style="margin:0">' + esc(t) + '</p><a class="cc-btn" href="#/dash">→ Dashboard</a></div>';
};

/* ── Top-Tiles ────────────────────────────────────────────────── */
CC.tile = (k, v, s, cls) =>
  '<div class="cc-tile" title="' + esc(k) + ' — ' + esc(s || '') + '"><div class="k">' + esc(k) + '</div><div class="v ' + cls + '">' + esc(v) + '</div><div class="s">' + esc(s || '') + '</div></div>';

CC.renderTiles = (data) => {
  const el = document.getElementById('ccTiles');
  if (!el) return;
  const t = data;
  const dot = (ok) => ok ? '🟢' : (ok === false ? '🔴' : '⚪');
  let secCls = 'st-ok'; let secTxt = 'NORMAL';
  const thr = (t.security && t.security.threat) || '—';
  if (thr === 'HIGH') { secCls = 'st-bad'; secTxt = 'HOCH'; } else if (thr === 'WATCH') { secCls = 'st-warn'; secTxt = 'WATCH'; }
  const waOk = !!(t.creds && t.hb && t.hb.online);
  el.innerHTML =
    CC.tile('BOT', dot(t.fleet?.running > 0), t.fleet ? t.fleet.running + '/' + t.fleet.managed + ' verbunden' : '—', t.fleet?.running > 0 ? 'st-ok' : 'st-warn') +
    CC.tile('WEB', '🟢', 'Server online', 'st-ok') +
    CC.tile('DB', t.db ? dot(t.db.healthy) : '—', t.db ? t.db.users + ' User · ' + t.db.groups + ' Gruppen' : '…', t.db && t.db.healthy ? 'st-ok' : 'st-warn') +
    CC.tile('WHATSAPP', waOk ? dot(true) : dot(t.creds && t.creds.registered), t.creds && t.creds.registered ? (waOk ? 'verbunden' : 'registriert') : 'keine Session', waOk ? 'st-ok' : 'st-warn') +
    CC.tile('SECURITY', thr || '—', secTxt, secCls) +
    CC.tile('SESSIONS', String(t.webSess != null ? t.webSess : '—'), t.webSess ? 'Web-Sessions' : '', 'st-dim') +
    CC.tile('USERS', t.db ? String(t.db.users) : '—', 'WhatsApp-Nutzer', 'st-dim') +
    CC.tile('IP BLOCKS', t.security ? String((t.security.blocked || 0) + (t.security.manualBansTotal || 0)) : '—', t.security ? (t.security.blocked + ' auto · ' + (t.security.manualBansTotal || 0) + ' manuell') : '', t.security && (t.security.blocked || t.security.manualBansTotal) ? 'st-bad' : 'st-ok');
};

/* Top-Daten sammeln (parallel, tolerant) */
CC.refreshTiles = async () => {
  const out = {};
  const [site, db, sys] = await Promise.all([
    api('/api/siteinfo').catch(() => null), api('/api/database').catch(() => null), api('/api/system').catch(() => null)
  ]);
  out.hb = (site && site.heartbeat) || null;
  out.db = db && db.ok ? db : null;
  out.sys = sys;
  try { const s = await api('/api/sessions'); out.fleet = (s && s.fleet) || null; out.botSessions = (s && s.sessions) || null; } catch (e) {}
  if (CC.can('security.view')) { try { const sc = await api('/api/security'); out.security = sc && sc.ok ? sc : null; } catch (e) {} }
  if (CC.can('sessions.view')) { try { const sa = await api('/api/sessions/all'); out.webSess = sa && sa.sessions ? sa.sessions.length : null; } catch (e) {} }
  if (CC.can('system.view')) { try { const se = await api('/api/session'); out.creds = se && se.found ? se : null; } catch (e) {} }
  CC.renderTiles(out);
};

/* ── Reload / Logout / Suche ──────────────────────────────────── */
CC.reload = () => { CC.go(CC.active); CC.refreshTiles(); };
CC.logout = () => {
  api('/api/logout', { method: 'POST' });
  localStorage.clear();
  location.href = '/login.html';
};

/* ── Globale Suche ────────────────────────────────────────────── */
CC.openSearch = () => { document.getElementById('ccSearchOv').style.display = 'flex'; setTimeout(() => document.getElementById('ccSearchInput').focus(), 30); };
CC.closeSearch = () => { document.getElementById('ccSearchOv').style.display = 'none'; };
CC.search = async (q) => {
  const res = document.getElementById('ccSearchRes');
  if (q.length < 2) { res.innerHTML = '<div class="cc-empty">Mindestens 2 Zeichen …</div>'; return; }
  res.innerHTML = '<div class="cc-empty">Suche …</div>';
  const found = [];
  /* Sessions + Audit (Bot-Fleet) */
  try { const s = await api('/api/sessions'); for (const x of s.sessions || []) if ((x.name || '').toLowerCase().includes(q) || (x.id || '').toLowerCase().includes(q) || q === x.id) found.push({ t: '🤖 Bot-Session', label: x.name + ' (' + x.id + ')', sub: x.status, go: '#/botSessions' }); } catch (e) {}
  /* Accounts */
  if (CC.can('accounts.view')) { try { const a = await api('/api/accounts'); for (const x of a.accounts || []) { const hay = (x.username || '') + ' ' + (x.number || ''); if (hay.toLowerCase().includes(q)) found.push({ t: '👤 Benutzer', label: x.username, sub: x.role + ' · ' + (x.status || 'active'), go: '#/users', id: x.id }); } } catch (e) {} }
  /* IPs */
  if (CC.can('security.view')) { try { const sc = await api('/api/security'); if (sc && sc.ok) { for (const b of [...(sc.blockedIps || []), ...(sc.manualBans || [])]) if ((b.ip || '').toLowerCase().includes(q)) found.push({ t: '🚫 IP', label: b.ip, sub: b.reason, go: '#/ips' }); for (const c of sc.knownClients || []) if ((c.ip || '').toLowerCase().includes(q)) found.push({ t: '🌍 IP', label: c.ip, sub: (c.browser || '') + ' · ' + (c.os || ''), go: '#/ips' }); } } catch (e) {} }
  if (!found.length) { res.innerHTML = '<div class="cc-empty">Keine Treffer für „' + esc(q) + '“</div>'; return; }
  res.innerHTML = found.slice(0, 24).map((f) =>
    '<div class="cc-event" style="cursor:pointer" onclick="CC.closeSearch();location.hash=\'' + f.go + '\'"><div class="ev-ico">' + (f.t.split(' ')[0]) + '</div><div class="ev-main"><div class="ev-t">' + esc(f.label) + '</div><div class="ev-s">' + esc(f.sub || '') + '</div></div><div class="ev-time">' + esc(f.t) + '</div></div>').join('');
};

/* ── Boot ─────────────────────────────────────────────────────── */
CC.boot = async () => {
  const guard = document.getElementById('ccGuard');
  const app = document.getElementById('ccApp');
  if (!CC.token()) { guard.style.display = 'flex'; document.getElementById('ccGuardText').textContent = 'Bitte melde dich an.'; return; }
  const me = await api('/api/me');
  if (!me || !me.ok) { guard.style.display = 'flex'; document.getElementById('ccGuardText').textContent = 'Sitzung ungültig — bitte neu anmelden.'; return; }
  CC.me = { role: me.role || 'user', perms: me.perms || [], name: me.name || me.username || '', username: me.username || '', number: me.number || '', status: me.status || 'active' };
  /* Owner/Admin-Komponenten nur mit nötigen Rollen sinnvoll — alle anderen bekommen reduziertes Menü automatisch. */
  guard.style.display = 'none';
  app.style.display = 'block';
  document.getElementById('ccWho').innerHTML = '<b>' + esc(CC.me.username || CC.me.name || 'Owner') + '</b><small>' + (CC.isOwner() ? '👑 OWNER' : (CC.me.role || 'user').toUpperCase()) + '</small>';
  document.getElementById('ccSearchBtn').onclick = CC.openSearch;
  document.getElementById('ccSearchInput').oninput = (e) => CC.search(e.target.value);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { CC.closeSearch(); CC.closeModal(); document.getElementById('ccReauth').style.display = 'none'; } });
  CC.buildSidebar();
  CC.refreshTiles();
  setInterval(() => CC.refreshTiles(), 15000);
  /* ⏱ Live-Uhr */
  const tick = () => {
    const t = document.getElementById('ccClockT'), d = document.getElementById('ccClockD');
    if (t) t.textContent = new Date().toLocaleTimeString('de-DE');
    if (d) d.textContent = new Date().toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
  };
  tick(); setInterval(tick, 1000);
  /* Hash-Routing */
  const route = () => {
    const h = (location.hash || '').replace(/^#\//, '');
    const id = CC.pages.has(h) ? h : 'dash';
    CC.go(id);
  };
  window.addEventListener('hashchange', route);
  route();
};
document.addEventListener('DOMContentLoaded', () => CC.boot());

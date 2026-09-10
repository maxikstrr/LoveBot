/* ═══════════════════════════════════════════════════════════════
   SOUL ECHO — BENUTZERVERWALTUNG (Accounts + Rollen + Rechte)
   ═══════════════════════════════════════════════════════════════ */

CC._accountsCache = null;
CC._permsCache = null;

async function CCacc() {
  if (!CC._accountsCache) { try { const a = await api('/api/accounts'); CC._accountsCache = (a && a.accounts) || []; } catch (e) { CC._accountsCache = []; } }
  return CC._accountsCache;
}
async function CCpermMeta() {
  if (!CC._permsCache) { try { const p = await api('/api/permissions'); CC._permsCache = (p && p.ok) ? p : null; } catch (e) { CC._permsCache = null; } }
  return CC._permsCache;
}

/* ═══ BENUTZER-LISTE mit Status-Filtern ═══ */
CC.reg('users', async () => {
  const accs = await CCacc();
  const pm = await CCpermMeta();
  const statuses = ['active', 'pending', 'restricted', 'disabled', 'locked'];
  const labels = { active: '🟢 Aktiv', pending: '🟡 Ausstehend', restricted: '🟠 Eingeschränkt', disabled: '⚫ Deaktiviert', locked: '🔴 Gesperrt' };
  const q = (location.hash.match(/f=([a-z]+)/) || [])[1] || 'all';
  const fchips = ['all', ...statuses].map((s) => '<button class="cc-chip' + (q === s ? ' on' : '') + '" onclick="location.hash=\'#/users' + (s !== 'all' ? '?f=' + s : '') + '\'">' + (s === 'all' ? 'Alle (' + accs.length + ')' : labels[s]) + '</button>').join('');
  const flt = accs.filter((a) => q === 'all' || a.status === q);
  CC.page('👥 Benutzer', 'Vollständige Benutzerakten — Lebenszyklus, Rechte, Sicherheit.',
    '<div class="cc-filters" id="userc">' + fchips + '</div>' +
    '<input class="cc-input" id="userSearch" placeholder="🔎 Nach Benutzername / Nummer suchen …" style="margin-bottom:14px">' +
    '<div id="userWrap"></div>',
  { after: () => renderUserList(flt) });

  async function renderUserList(list) {
    const el = document.getElementById('userWrap');
    if (!el) return;
    const inp = document.getElementById('userSearch');
    const q2 = (inp && inp.value || '').toLowerCase();
    const rows = list.filter((u) => !q2 || (u.username || '').toLowerCase().includes(q2) || (u.number || '').includes(q2));
    const canManage = CC.can('accounts.manage');
    const cols = [
      { k: 'sel', t: '', f: (r) => canManage ? '<input type="checkbox" class="cc-sel" data-id="' + esc(r.id) + '" title="Auswählen">' : '' },
      { k: 'username', t: 'Benutzer', f: (r) => '<div class="cc-userrow"><div class="cc-avatar">' + esc(String(r.username || '?')[0].toUpperCase()) + '</div><div><b>' + esc(r.username) + '</b>' + (r.mustChange ? ' <span class="cc-tag warn">Einladung offen</span>' : '') + '<div class="cc-key">' + esc(r.number || '') + '</div></div></div>' },
      { k: 'status', t: 'Status', f: (r) => CC.pill(r.status) },
      { k: 'role', t: 'Rolle', f: (r) => CC.rolepill(r.role) },
      { k: 'lastLoginAt', t: 'Letzte Aktivität', f: (r) => r.lastLoginAt ? CC.rel(r.lastLoginAt) : 'nie' },
      { k: 'createdAt', t: 'Erstellt', f: (r) => r.createdAt ? CC.dt(r.createdAt) : '—' },
      { k: 'restrictions', t: 'Einschr.', f: (r) => (r.restrictions && r.restrictions.length) ? '<span class="cc-tag warn">' + r.restrictions.length + '</span>' : '—' },
      { k: 'x', t: '', f: (r) => '<button class="cc-btn sm" onclick="CC.openAkte(\'' + esc(r.id) + '\')">📂 Akte</button>' }
    ];
    el.innerHTML = '<div class="cc-section">' +
      (canManage && rows.length ? '<div class="cc-massbar" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:8px 2px 10px">' +
        '<b style="font-size:11px;letter-spacing:.1em;color:var(--acc);text-transform:uppercase">⚡ Massenaktion</b> ' +
        '<span id="userMassCount" style="font-size:12px;color:var(--dim)">0 ausgewählt</span> ' +
        '<button class="cc-btn sm" onclick="CC.massUsers(\'active\')">▶ Aktivieren</button>' +
        '<button class="cc-btn sm warn" onclick="CC.massUsers(\'restricted\')">🟠 Einschränken</button>' +
        '<button class="cc-btn sm danger" onclick="CC.massUsers(\'disabled\')">⚫ Deaktivieren</button>' +
        '<button class="cc-btn sm danger" onclick="CC.massUsers(\'locked\')">🔒 Sperren</button>' +
        '<button class="cc-btn sm" onclick="CC.clearMass(\'userWrap\')">Auswahl leeren</button></div>' : '') +
      (rows.length ? CC.table(cols, rows) : '<div class="cc-empty">Keine passenden Benutzer.</div>') +
      (canManage ? '<div class="cc-btnrow"><button class="cc-btn primary sm" onclick="CC.go(\'userNew\')">➕ Benutzer erstellen</button></div>' : '') + '</div>';
    const cc = el.querySelector('#userMassCount');
    if (cc) {
      el.querySelectorAll('input.cc-sel').forEach((c) => c.onchange = () => {
        cc.textContent = el.querySelectorAll('input.cc-sel:checked').length + ' ausgewählt';
      });
    }
    if (inp) inp.oninput = () => renderUserList(list);
  }
}, { perms: ['accounts.view'] });

/* ── Massenaktion Benutzer-Status ─────────────────────────────── */
CC.massUsers = async (status) => {
  const wrap = document.getElementById('userWrap');
  const ids = [...wrap.querySelectorAll('input.cc-sel:checked')].map((i) => i.dataset.id);
  if (!ids.length) { CC.toast('❌ Keine Benutzer ausgewählt.'); return; }
  const critical = status === 'disabled' || status === 'locked';
  const label = { active: 'AKTIVIEREN', restricted: 'EINSCHRÄNKEN', disabled: 'DEAKTIVIEREN', locked: 'SPERREN' }[status];
  const b = await CC.confirm({ ico: '⚡', title: 'MASSENAKTION: ' + label + ' (' + ids.length + ' Benutzer)', requireReauth: critical, text: 'Betroffen: ' + ids.length + ' Benutzer. Jeder einzelne Vorgang wird im Audit-Log mit Grund protokolliert.', okLabel: label, fields: [{ name: 'reason', label: 'Grund * (für alle, wird je Benutzer auditiert)', type: 'textarea', required: true }] });
  if (!b) return;
  let okc = 0, failc = 0, firstErr = '';
  for (const id of ids) {
    const r = await CC.post('/api/accounts/status', { id, status, reason: b.reason, reauth: b.reauth });
    if (r.status >= 200 && r.status < 300) okc++; else { failc++; if (!firstErr) firstErr = r.data && r.data.error; }
  }
  if (okc) CC.toast('✅ ' + okc + ' Benutzer ' + label.toLowerCase() + (failc ? ', ' + failc + ' fehlgeschlagen' : ''));
  else CC.toast('❌ Keiner ausgeführt — ' + (firstErr || 'Berechtigung?'));
  CC.clearMass('userWrap');
  CC._accountsCache = null;
  CC.go('users');
};
CC.clearMass = (id) => {
  const wrap = document.getElementById(id);
  if (!wrap) return;
  wrap.querySelectorAll('input.cc-sel').forEach((i) => i.checked = false);
  const c = wrap.querySelector('[id$="MassCount"]'); if (c) c.textContent = '0 ausgewählt';
};

/* ═══ BENUTZER ERSTELLEN ═══ */
CC.reg('userNew', async () => {
  const rolesMeta = await api('/api/roles').catch(() => null);
  const myLevel = (rolesMeta && rolesMeta.roles || []).find((r) => r.id === CC.me.role)?.level ?? 0;
  const assignable = (rolesMeta && rolesMeta.roles || []).filter((r) => r.id !== 'owner' && (CC.isOwner() || (r.level || 0) < myLevel));
  const roleOpts = (assignable.length ? assignable : [{ id: 'user', label: 'USER' }]).map((r) => '<option value="' + esc(r.id) + '">' + esc((r.icon || '') + ' ' + (r.label || r.id)) + '</option>').join('');
  CC.page('➕ Benutzer erstellen', 'Legt einen neuen Dashboard-Account an. Er erhält ein Einmal-Passwort und muss es beim ersten Login ändern.',
    '<div class="cc-section" style="max-width:560px">' +
      '<div class="cc-field"><label>Benutzername *</label><input class="cc-input" id="nu_user" placeholder="z. B. Anna"></div>' +
      '<div class="cc-field"><label>WhatsApp-Nummer (Login-Kennung) *</label><input class="cc-input" id="nu_num" placeholder="z. B. 4915172861284"></div>' +
      '<div class="cc-field"><label>Rolle / Vorlage</label><select class="cc-select" id="nu_role">' + roleOpts + '</select></div>' +
      '<div class="cc-btnrow"><button class="cc-btn" onclick="CC.go(\'users\')">Abbrechen</button><button class="cc-btn primary" id="nu_go">👤 Benutzer erstellen</button></div>' +
    '</div>',
  { after: () => {
    document.getElementById('nu_go').onclick = async () => {
      const username = document.getElementById('nu_user').value.trim();
      const number = document.getElementById('nu_num').value.trim().replace(/\D/g, '');
      const role = document.getElementById('nu_role').value;
      if (!username || number.length < 6) { CC.toast('❌ Bitte Benutzername + gültige Nummer angeben.'); return; }
      const r = await CC.post('/api/accounts/create', { username, number, role });
      if (!CC.ok(r, '✅ Benutzer angelegt')) return;
      CC._accountsCache = null;
      CC.openModal(
        '<div class="cc-modal-title"><span>✅ Benutzer erstellt</span><span class="x" onclick="CC.closeModal()">✕</span></div>' +
        '<div class="cc-modal-body"><p>Der Account <b>' + esc(username) + '</b> (' + esc(role) + ') wurde angelegt.</p>' +
        '<div class="cc-tip">🔑 <b>Einmal-Passwort (nur jetzt sichtbar):</b><br><span class="mono" style="font-size:18px">' + esc((r.data && r.data.tempPassword) || '?') + '</span><br><br>Gleich weitergeben — es wird nicht gespeichert und nicht geloggt.</div>' +
        '<p class="cc-hint">Beim ersten Login muss der Benutzer ein eigenes Passwort setzen.</p></div>' +
        '<div class="cc-modal-foot"><button class="cc-btn primary" onclick="CC.closeModal();CC.go(\'users\')">Fertig</button></div>');
    };
  }});
}, { perms: ['accounts.manage'] });

/* ═══ ROLLEN & RECHTE ═══ */
CC.reg('roles', async () => {
  const rl = await api('/api/roles').catch(() => null);
  const pm = await CCpermMeta();
  const roles = (rl && rl.roles) || [];
  const matrix = (rl && rl.matrix) || {};
  const perms = (pm && pm.permissions) || [];
  const byCat = {};
  for (const p of perms) (byCat[p.cat] = byCat[p.cat] || []).push(p);
  CC.page('🎖️ Rollen & Rechte', 'Rollen-Matrix und Einzelrechte — was darf welche Rolle?',
    '<div class="cc-section"><h3>Rollenhierarchie</h3><div class="cc-kv">' + roles.map((r) => '<span class="k">' + (r.icon || '') + ' ' + esc(r.label) + '</span><span class="v">Level ' + r.level + ' · <span class="cc-key">' + esc(r.id) + '</span></span>').join('') + '</div></div>' +
    '<div class="cc-section"><h3>Rechte je Rolle</h3>' +
    CC.table([{ k: 'r', t: 'Rolle', f: (x) => x.icon + ' ' + esc(x.label) }, { k: 'perms', t: 'Einzelrechte', f: (x) => (matrix[x.id] && matrix[x.id].length ? matrix[x.id].map((p) => '<span class="cc-key">' + esc(p) + '</span>').join(' ') : '<i>—</i>'), raw: true }], roles) +
    '</div>' +
    '<div class="cc-section"><h3>Katalog aller Einzelrechte</h3>' + Object.entries(byCat).map(([cat, list]) => '<div style="margin-bottom:10px"><b style="color:var(--acc);font-size:11px;letter-spacing:.1em">' + esc(cat) + '</b><div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:5px">' + list.map((p) => '<span class="cc-key" title="' + esc(p.label) + (p.critical ? ' · kritisch' : '') + '">' + esc(p.id) + (p.critical ? ' ⚠️' : '') + '</span>').join('') + '</div></div>').join('') + '</div>'
  );
}, { perms: ['roles.assign', 'accounts.view'] });

/* ═══ VORLAGEN ═══ */
CC.reg('templates', async () => {
  const pm = await CCpermMeta();
  const tpl = (pm && pm.templates) || {};
  CC.page('📋 Rechtevorlagen', 'Profile als Vorlage — ein Klick vergibt mehrere Einzelrechte zusätzlich zur Rolle.',
    '<div class="cc-section">' + (Object.keys(tpl).length ? CC.table([
      { k: 't', t: 'Vorlage', f: (x) => x.label },
      { k: 'grants', t: 'Rechte', f: (x) => (x.grant || []).map((g) => '<span class="cc-key">' + esc(g) + '</span>').join(' ') || '—', raw: true },
      { k: 'x', t: '', f: (x) => '<button class="cc-btn sm" onclick="CC.applyTemplateTo(\'' + esc(x.id) + '\')">Auf Benutzer anwenden …</button>', raw: true }
    ], Object.entries(tpl).map(([id, v]) => ({ id, ...v }))) : '<div class="cc-empty">Keine Vorlagen.</div>') + '</div>' +
    '<div class="cc-section"><h3>Einschränkbare Features</h3><div class="cc-tip">' + (((pm && pm.restrictableFeatures) || []).map((f) => (f && f.label) || f).join(' · ') || '—') + '</div><p class="cc-hint">Einschränkungen gelten für Accounts mit Status „🟠 Eingeschränkt".</p></div>'
  );
}, { perms: ['roles.assign'] });

CC.applyTemplateTo = async (tplId) => {
  const pm = await CCpermMeta();
  const tlabel = (pm && pm.templates && pm.templates[tplId] && pm.templates[tplId].label) || tplId;
  const accs = await CCacc();
  const opts = accs.map((a) => ({ v: a.id, l: a.username + ' (' + a.role + ')' })).join('');
  const b = await CC.confirm({ ico: '📋', title: 'Vorlage anwenden: ' + tlabel, fields: [{ name: 'id', label: 'Benutzer', type: 'select', options: accs.map((a) => ({ v: a.id, l: a.username + ' · ' + a.role })), required: true }, { name: 'reason', label: 'Grund *', placeholder: 'Warum bekommt der Benutzer diese Rechte?', required: true }] });
  if (!b) return;
  b.template = tplId;
  const r = await CC.post('/api/accounts/template', b);
  CC.ok(r, '✅ Vorlage angewendet'); CC.reload();
};

/* ═══ BENUTZERAKTE ═══ */
CC.openAkte = async (id) => {
  const d = await api('/api/accounts/' + id + '/detail').catch(() => null);
  if (!d || !d.ok) { CC.toast('❌ Akte konnte nicht geladen werden.'); return; }
  const a = d.account;
  const canManage = CC.can('accounts.manage');
  const canAssign = CC.can('roles.assign');
  const eff = a.effectivePerms || [];
  const row = (k, v) => '<span class="k">' + k + '</span><span class="v">' + (v == null || v === '' ? '—' : v) + '</span>';

  CC.openModal(`
    <div class="cc-modal-title"><span>👤 BENUTZERAKTE — ${esc(a.username)}</span><span class="x" onclick="CC.closeModal()">✕</span></div>
    <div class="cc-modal-body">
      <div class="cc-userrow" style="margin-bottom:14px">
        <div class="cc-avatar">${esc(String(a.username || '?')[0].toUpperCase())}</div>
        <div><b style="font-size:17px">${esc(a.username)}</b>
          <div>${CC.rolepill(a.role)} ${CC.pill(a.status)} ${a.mustChange ? '<span class="cc-tag warn">Einladung offen</span>' : ''}</div></div>
      </div>
      <div class="cc-grid2">
        <div class="cc-section" style="margin:0"><h3>👤 Profil &amp; Zugang</h3><div class="cc-kv">
          ${row('Interne ID', '<span class="mono">' + esc(a.id) + '</span>')}
          ${row('Nummer', '<span class="mono">' + esc(a.number || '—') + '</span>')}
          ${row('Scope', a.scope ? esc(JSON.stringify(a.scope)) : 'global')}
          ${row('Erstellt', CC.dt(a.createdAt))}
          ${row('Letzter Login', a.lastLoginAt ? CC.dt(a.lastLoginAt) : 'nie')}
          ${row('Passwort geändert', a.passwordChangedAt ? CC.dt(a.passwordChangedAt) : '—')}
          ${row('Sperr-Grund', a.lockedReason ? esc(a.lockedReason) : '—')}
        </div></div>
        <div class="cc-section" style="margin:0"><h3>🔑 Aktive Sessions</h3>
          ${(d.activeSessions && d.activeSessions.length) ? d.activeSessions.map((s2) => '<div class="cc-bar"><span class="dot ok"></span><span class="mono">' + esc(s2.tokenHint) + '</span> seit ' + esc(CC.rel(s2.createdAt)) + '</div>').join('') : '<div class="cc-empty">Keine aktiven Web-Sessions</div>'}
        </div>
      </div>
      <div style="height:14px"></div>
      <div class="cc-section"><h3>🛡️ Effektive Rechte (${eff.length})</h3><div style="display:flex;flex-wrap:wrap;gap:6px">${eff.length ? eff.map((p) => '<span class="cc-key">' + esc(p) + '</span>').join('') : '<span class="cc-hint">nur Basis-Rolle</span>'}</div>
        ${(a.permsExtra && a.permsExtra.length) ? '<p class="cc-hint">➕ Extra: ' + esc(a.permsExtra.join(', ')) + '</p>' : ''}
        ${(a.permsRevoked && a.permsRevoked.length) ? '<p class="cc-hint">➖ Entzogen: ' + esc(a.permsRevoked.join(', ')) + '</p>' : ''}
        ${(a.restrictions && a.restrictions.length) ? '<p class="cc-hint">🚫 Einschränkungen: ' + esc(a.restrictions.join(', ')) + '</p>' : ''}
      </div>
      ${canManage ? '<div class="cc-section"><h3>⚙️ Aktionen</h3><div class="cc-btnrow" style="margin-top:2px">' +
        (canAssign ? '<button class="cc-btn sm" onclick="CC.akteRole(\'' + esc(a.id) + '\')">🎖️ Rolle ändern</button>' : '') +
        (canAssign ? '<button class="cc-btn sm" onclick="CC.aktePerms(\'' + esc(a.id) + '\')">🎛️ Einzelrechte</button>' : '') +
        (canAssign ? '<button class="cc-btn sm" onclick="CC.akteTemplate(\'' + esc(a.id) + '\')">📋 Vorlage</button>' : '') +
        '<button class="cc-btn sm" onclick="CC.akteRestr(\'' + esc(a.id) + '\')">🚫 Einschränken</button>' +
        '<button class="cc-btn sm ok" onclick="CC.akteStatus(\'' + esc(a.id) + '\',\'active\')">▶ Aktiv</button>' +
        '<button class="cc-btn sm warn" onclick="CC.akteStatus(\'' + esc(a.id) + '\',\'pending\')">🟡 Ausstehend</button>' +
        '<button class="cc-btn sm warn" onclick="CC.akteStatus(\'' + esc(a.id) + '\',\'restricted\')">🟠 Eingeschränkt</button>' +
        '<button class="cc-btn sm danger" onclick="CC.akteStatus(\'' + esc(a.id) + '\',\'disabled\',true)">⚫ Deaktivieren</button>' +
        '<button class="cc-btn sm danger" onclick="CC.akteStatus(\'' + esc(a.id) + '\',\'locked\',true)">🔒 Sperren</button>' +
      '</div><div class="cc-tip">Kritische Änderungen (Admin-Rollen, dauerhaftes Deaktivieren/Sperren) verlangen dein Passwort (Step-up).</div></div>' : ''}
      ${(a.statusHistory && a.statusHistory.length) ? '<div class="cc-section"><h3>📜 Status-Verlauf</h3>' + (a.statusHistory || []).slice(-6).reverse().map((h) => '<div class="cc-event"><div class="ev-main"><div class="ev-t">Status: ' + esc(h.from || '?') + ' → ' + esc(h.to || '?') + '</div><div class="ev-s">' + esc(h.reason || '') + ' · von ' + esc(h.by || '?') + '</div></div><div class="ev-time">' + CC.dt(h.at) + '</div></div>').join('') + '</div>' : ''}
      ${(a.roleHistory && a.roleHistory.length) ? '<div class="cc-section"><h3>🎖️ Rollen-Verlauf</h3>' + (a.roleHistory || []).slice(-6).reverse().map((h) => '<div class="cc-event"><div class="ev-main"><div class="ev-t">Rolle: ' + esc(h.from || '?') + ' → ' + esc(h.role || h.to || '?') + '</div><div class="ev-s">von ' + esc(h.by || '?') + '</div></div><div class="ev-time">' + CC.dt(h.at) + '</div></div>').join('') + '</div>' : ''}
      ${(a.permsHistory && a.permsHistory.length) ? '<div class="cc-section"><h3>🎛️ Rechte-Verlauf (Vorher/Nachher)</h3>' + (a.permsHistory || []).slice(-6).reverse().map((h) => '<div class="cc-event"><div class="ev-main"><div class="ev-t">Rechte-Änderung <span class="cc-key">' + esc(h.reason || '') + '</span></div><div class="ev-s">von ' + esc(h.by || '?') + ' · gewährt: ' + esc((h.after && h.after.extra || []).join(', ') || '—') + ' · entzogen: ' + esc((h.after && h.after.revoked || []).join(', ') || '—') + '</div></div><div class="ev-time">' + CC.dt(h.at) + '</div></div>').join('') + '</div>' : ''}
    </div>`);
};

/* Rollenwechsel */
CC.akteRole = async (id) => {
  const accs = await CCacc();
  const me = accs.find((x) => x.id === id);
  if (!me) return;
  const rl = await api('/api/roles').catch(() => null);
  const myLevel = (rl && rl.roles || []).find((r) => r.id === CC.me.role)?.level ?? 0;
  const assignable = (rl && rl.roles || []).filter((r) => r.id !== 'owner' && (CC.isOwner() || (r.level || 0) < myLevel) && r.id !== me.role);
  const opts = (assignable.length ? assignable : (rl && rl.roles || [])).map((r) => ({ v: r.id, l: (r.icon || '') + ' ' + r.label }));
  const b = await CC.confirm({ ico: '🎖️', title: 'Rolle ändern — ' + me.username, text: 'Vorher: <b>' + me.role + '</b> → Nachher (wählen). Owner ist geschützt.', requireReauth: true, fields: [{ name: 'role', label: 'Neue Rolle', type: 'select', options: opts, required: true }, { name: 'reason', label: 'Grund * (wird protokolliert)', type: 'textarea', required: true }] });
  if (!b) return;
  b.id = id;
  const r = await CC.post('/api/accounts/role', b);
  CC.ok(r, '✅ Rolle geändert'); CC.closeModal(); CC._accountsCache = null; CC.go('users');
};

/* Einzelrechte */
CC.aktePerms = async (id) => {
  const pm = await CCpermMeta();
  const perms = (pm && pm.permissions) || [];
  const accs = await CCacc();
  const me = accs.find((x) => x.id === id);
  if (!me) return;
  const extra = new Set(me.permsExtra || []);
  const revoked = new Set(me.permsRevoked || []);
  const criticalUsed = perms.some((p) => p.critical && (extra.has(p.id) || revoked.has(p.id)));
  const opts = perms.map((p) => {
    const state = extra.has(p.id) ? '➕' : revoked.has(p.id) ? '➖' : '  ';
    return '<label><input type="checkbox" data-p="' + esc(p.id) + '"' + (extra.has(p.id) ? ' checked data-s="g"' : revoked.has(p.id) ? ' data-s="r"' : '') + '> <span class="cc-key">' + esc(p.id) + '</span>' + (p.critical ? ' ⚠️' : '') + ' <i style="color:var(--dim);font-size:11px">' + esc(p.label) + '</i></label>';
  }).join('');
  CC.openModal(`
    <div class="cc-modal-title"><span>🎛️ Einzelrechte — ${esc(me.username)}</span><span class="x" onclick="CC.closeModal()">✕</span></div>
    <div class="cc-modal-body">
      <p style="font-size:12.5px;color:var(--mut)">Rechte zusätzlich zur Rolle (Basis: <b>${esc(me.role)}</b>).<br>
      <b>➕ = gewährt</b> (Standard), <b>➖ = entzogen</b> (bei aktivem Häkchen rechtsklicken ist nicht nötig — einfach anklicken und unten „Entziehen" wählen).</p>
      <div class="cc-checkgrid" id="permGrid">${opts}</div>
      <div class="cc-field" style="margin-top:12px"><label>Grund *</label><input class="cc-input" id="permReason" placeholder="Warum diese Änderung?"></div>
    </div>
    <div class="cc-modal-foot">
      <button class="cc-btn" onclick="CC.closeModal()">Abbrechen</button>
      <button class="cc-btn warn" onclick="CC._permAct('${esc(id)}','revoke')">➖ Markierte ENTZIEHEN</button>
      <button class="cc-btn ok" onclick="CC._permAct('${esc(id)}','grant')">➕ Markierte GEWÄHREN</button>
    </div>`);
};
CC._permAct = async (id, mode) => {
  const reason = (document.getElementById('permReason') || {}).value?.trim();
  if (!reason) { CC.toast('❌ Bitte Grund angeben.'); return; }
  const checked = [...document.querySelectorAll('#permGrid input:checked')].map((i) => i.dataset.p);
  const grant = [], revoke = [];
  for (const p of checked) { if (mode === 'grant') grant.push(p); else revoke.push(p); }
  if (!grant.length && !revoke.length) { CC.toast('❌ Keine Rechte ausgewählt.'); return; }
  const pm = await CCpermMeta();
  const crit = (pm && pm.permissions || []).some((x) => (grant.includes(x.id) || revoke.includes(x.id)) && x.critical);
  if (crit && !confirm('⚠️ Das betrifft kritische Rechte. Fortfahren?')) return;
  const r = await CC.post('/api/accounts/perms', { id, grant, revoke, reason });
  if (CC.ok(r, '✅ Rechte geändert')) { CC.closeModal(); CC._accountsCache = null; CC.go('users'); }
};

/* Vorlage auf Akte */
CC.akteTemplate = async (id) => {
  const accs = await CCacc();
  const me = accs.find((x) => x.id === id); if (!me) return;
  const pm = await CCpermMeta(); const tpl = (pm && pm.templates) || {};
  const b = await CC.confirm({ ico: '📋', title: 'Vorlage — ' + me.username, fields: [{ name: 'template', label: 'Vorlage', type: 'select', options: Object.entries(tpl).map(([k, v]) => ({ v: k, l: v.label })), required: true }, { name: 'reason', label: 'Grund *', required: true }] });
  if (!b) return;
  b.id = id;
  const r = await CC.post('/api/accounts/template', b);
  CC.ok(r, '✅ Vorlage angewendet'); CC.closeModal(); CC._accountsCache = null; CC.go('users');
};

/* Einschränkungen (nur sinnvoll bei Status restricted) */
CC.akteRestr = async (id) => {
  const accs = await CCacc();
  const me = accs.find((x) => x.id === id); if (!me) return;
  const pm = await CCpermMeta();
  const feats = (pm && pm.restrictableFeatures) || [];
  const cur = new Set(me.restrictions || []);
  CC.openModal(`
    <div class="cc-modal-title"><span>🚫 Einschränkungen — ${esc(me.username)}</span><span class="x" onclick="CC.closeModal()">✕</span></div>
    <div class="cc-modal-body">
      <p class="cc-hint">Gilt bei Status „Eingeschränkt". Wähle, was der Benutzer NICHT nutzen darf.</p>
      <div class="cc-checkgrid">${feats.map((f) => { const id = String((f && f.id) || f); return '<label><input type="checkbox" data-f="' + esc(id) + '"' + (cur.has(id) ? ' checked' : '') + '> <span>' + esc((f && f.label) || id) + '</span></label>'; }).join('')}</div>
      <div class="cc-field" style="margin-top:12px"><label>Grund *</label><input class="cc-input" id="restrReason"></div>
    </div>
    <div class="cc-modal-foot"><button class="cc-btn" onclick="CC.closeModal()">Abbrechen</button><button class="cc-btn primary" onclick="CC._restrGo('${esc(id)}')">Speichern</button></div>`);
};
CC._restrGo = async (id) => {
  const reason = document.getElementById('restrReason').value.trim();
  if (!reason) { CC.toast('❌ Bitte Grund angeben.'); return; }
  const restrictions = [...document.querySelectorAll('#ccModalCard [data-f]:checked')].map((i) => i.dataset.f);
  const r = await CC.post('/api/accounts/restrictions', { id, restrictions, reason });
  CC.ok(r, '✅ Einschränkungen gespeichert'); CC.closeModal(); CC._accountsCache = null; CC.go('users');
};

/* Status setzen (deaktivieren/sperren etc.) */
CC.akteStatus = async (id, status, critical) => {
  const accs = await CCacc();
  const me = accs.find((x) => x.id === id); if (!me) return;
  const label = { active: 'AKTIVIEREN', pending: 'AUF AUSSTEHEND SETZEN', restricted: 'EINSCHRÄNKEN', disabled: 'DEAKTIVIEREN', locked: 'SPERREN' }[status];
  const hints = { disabled: 'Entfernt Bot- & Webzugriff, beendet Sessions, verhindert neue Logins. Der Account bleibt in der Historie erhalten.', locked: 'Sperrt den Zugang vollständig.', restricted: 'Nur ausgewählte Features bleiben verfügbar.', pending: 'Zugang ruht bis zur Freischaltung.', active: 'Voller Zugang.' };
  const b = await CC.confirm({ ico: status === 'locked' ? '🔒' : status === 'disabled' ? '⚫' : '⚙️', title: label + ' — ' + me.username, text: hints[status], requireReauth: !!critical, okLabel: label, fields: [{ name: 'reason', label: 'Grund * (wird auditiert)', type: 'textarea', required: true }] });
  if (!b) return;
  b.id = id; b.status = status;
  const r = await CC.post('/api/accounts/status', b);
  CC.ok(r, '✅ Status geändert auf ' + status); CC.closeModal(); CC._accountsCache = null; CC.go('users');
};

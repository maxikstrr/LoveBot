/* ═══════════════════════════════════════════════════════════════
   SOUL ECHO — 👤 BENUTZERAKTE 2.0 (Thinkproject-Muster)
   Vollständige Benutzeransicht mit 12 Tabs:
   Übersicht · Account · Sicherheit · Rollen · Berechtigungen ·
   XP · Economy · Games · Pets · Gruppen · Aktivität · Datenschutz
   Route: #/userFull?id=<accountId>&tab=<tab>
   ═══════════════════════════════════════════════════════════════ */

CC.reg('userFull', async () => {
  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  const id = params.get('id');
  let tab = params.get('tab') || 'overview';
  if (!id) { CC.viewErr('Keine Benutzer-ID angegeben.'); return; }
  const d = await api('/api/accounts/' + id + '/detail/full').catch(() => null);
  if (!d || !d.ok) { CC.viewErr('Akte nicht verfügbar (Berechtigung oder Account unbekannt).'); return; }
  const a = d.account;
  const pr = d.profile;
  const lp = d.loveplus || {};
  const canManage = CC.can('accounts.manage');
  const canAssign = CC.can('roles.assign');

  const wallet = pr?.wallet || {};
  const coins = (['copper', 'silver', 'gold', 'platin'].reduce((s, k) => s + (Number(wallet[k]) || 0), 0));
  const games = (lp.counters && Object.keys(lp.counters).length) ? lp.counters : {};
  const gameCount = Object.values(games).reduce((s, v) => s + (Number(v) || 0), 0);

  const TABS = [
    ['overview', '📊 Übersicht'], ['account', '🪪 Account'], ['security', '🛡️ Sicherheit'],
    ['roles', '🎭 Rollen'], ['permissions', '🧩 Berechtigungen'], ['xp', '⭐ XP & Level'],
    ['economy', '💰 Economy'], ['games', '🎮 Games'], ['pets', '🐾 Pets'],
    ['groups', '👥 Gruppen'], ['activity', '📈 Aktivität'], ['privacy', '🔒 Datenschutz']
  ];
  if (!TABS.find((t) => t[0] === tab)) tab = 'overview';
  const setTab = (t) => { location.hash = '#/userFull?id=' + encodeURIComponent(id) + '&tab=' + t; };

  const kv = (rows) => '<div class="cc-kv">' + rows.map(([k, v]) => '<span class="k">' + k + '</span><span class="v">' + (v == null || v === '' || v === '—' ? '—' : v) + '</span>').join('') + '</div>';
  const empty = (t) => '<div class="cc-empty">' + esc(t || 'Keine Daten.') + '</div>';

  let body = '';
  if (tab === 'overview') {
    body =
      '<div class="cc-statgrid">' +
        '<div class="cc-stat"><div class="ic">⭐</div><div class="num">' + (pr ? (pr.prestige ? '💎' + pr.prestige + ' ' : '') + 'Lv ' + pr.level : '—') + '</div><div class="lab">Level' + (rank ? ' · ' + esc(rank) : '') + '</div></div>' +
        '<div class="cc-stat"><div class="ic">📈</div><div class="num">' + (pr ? Number(pr.totalXp || 0).toLocaleString('de-DE') : '—') + '</div><div class="lab">XP gesamt (Lifetime)</div></div>' +
        '<div class="cc-stat"><div class="ic">🪙</div><div class="num">' + (pr ? coins.toLocaleString('de-DE') : '—') + '</div><div class="lab">Währung gesamt</div></div>' +
        '<div class="cc-stat"><div class="ic">🏅</div><div class="num">' + ((lp.achievements || []).length) + '</div><div class="lab">Achievements</div></div>' +
        '<div class="cc-stat"><div class="ic"></div><div class="num">' + (pr ? pr.streak : '—') + '</div><div class="lab">Tage Streak</div></div>' +
        '<div class="cc-stat"><div class="ic">🐾</div><div class="num">' + (lp.pet ? 'Lv ' + (lp.pet.level || 1) : '0') + '</div><div class="lab">Pet' + (lp.pet ? ' · ' + esc(lp.pet.name || lp.pet.type || '') : '') + '</div></div>' +
      '</div><br>' +
      '<div class="cc-grid2">' +
        '<div class="cc-section"><h3>👤 Status</h3>' + kv([
          ['Account-Status', CC.pill(a.status)],
          ['Rolle', CC.rolepill(a.role)],
          ['Registriert (Bot)', pr ? (pr.registered ? '<span class="cc-tag ok">JA</span> ' + (pr.registeredAt ? CC.dt(pr.registeredAt) : '') : '<span class="cc-tag warn">NEIN</span>') : '—'],
          ['Letzte Aktivität', a.lastLoginAt ? CC.dt(a.lastLoginAt) : 'nie'],
          ['Aktive Sessions', (d.activeSessions || []).length],
          ['DSGVO-Einwilligung', pr ? (pr.dsgvo ? '<span class="cc-tag ok">AKTIV</span>' : '<span class="cc-tag bad">FEHLT</span>') : '—'],
          ['Paar', pr && pr.married ? '💍 mit ' + esc(pr.spouse || '?') : '—']
        ]) + '</div>' +
        '<div class="cc-section"><h3>⚡ Schnellaktionen</h3>' +
          (canManage ? '<div class="cc-btnrow" style="flex-wrap:wrap">' +
            (canAssign ? '<button class="cc-btn sm" onclick="CC.akteRole(\'' + esc(a.id) + '\')">🎖️ Rolle ändern</button>' : '') +
            (canAssign ? '<button class="cc-btn sm" onclick="CC.aktePerms(\'' + esc(a.id) + '\')">🎛️ Einzelrechte</button>' : '') +
            '<button class="cc-btn sm warn" onclick="CC.akteRestr(\'' + esc(a.id) + '\')">🚫 Einschränken</button>' +
            '<button class="cc-btn sm danger" onclick="CC.akteStatus(\'' + esc(a.id) + '\',\'disabled\',true)">⚫ Deaktivieren</button>' +
            '<button class="cc-btn sm danger" onclick="CC.akteStatus(\'' + esc(a.id) + '\',\'locked\',true)">🔒 Sperren</button>' +
            (canAssign ? '<button class="cc-btn sm" onclick="location.hash=\'#/xp\'">⭐ XP vergeben</button>' : '') +
          '</div>' : '<div class="cc-empty">Kein Recht <span class="cc-key">accounts.manage</span> — nur Ansicht.</div>') +
        '</div>' +
      '</div>';
  }
  else if (tab === 'account') {
    body = kv([
      ['Interne Account-ID', '<span class="cc-key">' + esc(a.id) + '</span>'],
      ['WhatsApp-Nummer', '<span class="cc-key">' + esc(a.number || '—') + '</span>'],
      ['Öffentliches Profil (bid)', pr ? '<span class="cc-key" style="font-size:10.5px">' + esc(pr.bid) + '</span>' : '<span class="cc-hint">Kein Bot-Profil gefunden</span>'],
      ['Account-Zustand', CC.pill(a.status)],
      ['Erstellt', CC.dt(a.createdAt)],
      ['Letzter Login', a.lastLoginAt ? CC.dt(a.lastLoginAt) : 'nie'],
      ['Passwort geändert', a.passwordChangedAt ? CC.dt(a.passwordChangedAt) : 'nie'],
      ['Login möglich', (a.status === 'active' || a.status === 'restricted') ? '<span class="cc-tag ok">JA</span>' : '<span class="cc-tag bad">NEIN</span>'],
      ['Profil-Sichtbarkeit', pr ? (pr.registered ? 'öffentlich (registriert)' : 'eingeschränkt (nicht registriert)') : '—'],
      ['Scope', a.scope ? esc(JSON.stringify(a.scope)) : 'global']
    ]) + (a.lockedReason ? '<div class="cc-tip" style="margin-top:12px;border-color:var(--bad,#c44)">🔒 <b>Sperr-Grund:</b> ' + esc(a.lockedReason) + '</div>' : '');
  }
  else if (tab === 'security') {
    const sec = d.securityEvents || [];
    body =
      '<div class="cc-section"><h3>🔑 Aktive Web-Sessions (' + (d.activeSessions || []).length + ')</h3>' +
      ((d.activeSessions || []).length ? d.activeSessions.map((s2) => '<div class="cc-bar"><span class="dot ok"></span><span class="cc-key">' + esc(s2.tokenHint) + '</span> seit ' + CC.rel(s2.createdAt) + '</div>').join('') : empty('Keine aktiven Web-Sessions.')) + '</div>' +
      '<div class="cc-section"><h3>🛡️ Sicherheits-Events (letzte 15)</h3>' +
      (sec.length ? '<div class="cc-feed">' + sec.map((e) => '<div class="cc-event"><div class="ev-ico">' + (Number(e.risk) >= 40 ? '🔴' : Number(e.risk) >= 20 ? '🟠' : '🟢') + '</div><div class="ev-main"><div class="ev-t">' + esc(e.event) + ' <span class="cc-tag ' + (Number(e.risk) >= 40 ? 'bad' : Number(e.risk) >= 20 ? 'warn' : 'ok') + '">RISK ' + esc(e.risk) + '</span></div><div class="ev-s">' + esc(e.reason || '') + '</div></div><div class="ev-time">' + (e.time ? CC.dt(e.time) : '—') + '</div></div>').join('') + '</div>' : empty('Keine Sicherheits-Events für diesen Benutzer.')) + '</div>';
  }
  else if (tab === 'roles') {
    body =
      '<div class="cc-section"><h3>🎭 Aktuelle Rolle</h3>' + kv([
        ['Rolle', CC.rolepill(a.role)],
        ['Rollen-Historie', '']
      ]) + ((a.roleHistory || []).length ? (a.roleHistory || []).slice(-8).reverse().map((h) => '<div class="cc-event"><div class="ev-main"><div class="ev-t">' + esc(h.from || '?') + ' → ' + esc(h.role || h.to || '?') + '</div><div class="ev-s">von ' + esc(h.by || '?') + '</div></div><div class="ev-time">' + CC.dt(h.at) + '</div></div>').join('') : empty('Keine Rollenwechsel.')) + '</div>' +
      (canAssign ? '<div class="cc-section"><h3>⚙️ Ändern</h3><div class="cc-btnrow"><button class="cc-btn sm" onclick="CC.akteRole(\'' + esc(a.id) + '\')">🎖️ Rolle ändern (Step-up bei Admin-Ebene)</button></div></div>' : '');
  }
  else if (tab === 'permissions') {
    const eff = a.effectivePerms || [];
    body =
      '<div class="cc-section"><h3>🧩 Effektive Rechte (' + eff.length + (a.permsExtra?.length ? ' · +' + a.permsExtra.length + ' Extra' : '') + (a.permsRevoked?.length ? ' · −' + a.permsRevoked.length + ' entzogen' : '') + ')</h3>' +
      (eff.length ? '<div style="display:flex;flex-wrap:wrap;gap:6px">' + eff.map((p) => '<span class="cc-key">' + esc(p) + '</span>').join('') + '</div>' : '<div class="cc-hint">Nur Basis-Rolle, keine Einzelrechte.</div>') +
      (a.permsExtra?.length ? '<p class="cc-hint">➕ Gewährt: ' + a.permsExtra.map((x) => '<span class="cc-key">' + esc(x) + '</span>').join(' ') + '</p>' : '') +
      (a.permsRevoked?.length ? '<p class="cc-hint">➖ Entzogen: ' + a.permsRevoked.map((x) => '<span class="cc-key">' + esc(x) + '</span>').join(' ') + '</p>' : '') +
      (a.restrictions?.length ? '<p class="cc-hint">🚫 Feature-Einschränkungen: ' + a.restrictions.map((x) => '<span class="cc-tag warn">' + esc(x) + '</span>').join(' ') + '</p>' : '') + '</div>' +
      (canAssign ? '<div class="cc-btnrow"><button class="cc-btn sm" onclick="CC.aktePerms(\'' + esc(a.id) + '\')">🎛️ Einzelrechte bearbeiten</button><button class="cc-btn sm" onclick="CC.akteTemplate(\'' + esc(a.id) + '\')">📋 Vorlage anwenden</button></div>' : '') +
      ((a.permsHistory || []).length ? '<div class="cc-section" style="margin-top:14px"><h3>📜 Rechte-Verlauf (unveränderlich, Vorher/Nachher)</h3>' + (a.permsHistory || []).slice(-8).reverse().map((h) => '<div class="cc-event"><div class="ev-main"><div class="ev-t">' + esc(h.reason || 'Rechte-Änderung') + '</div><div class="ev-s">von ' + esc(h.by || '?') + ' · ➕ ' + esc(((h.after || {}).extra || []).join(', ') || '—') + ' · ➖ ' + esc(((h.after || {}).revoked || []).join(', ') || '—') + '</div></div><div class="ev-time">' + CC.dt(h.at) + '</div></div>').join('') + '</div>' : '');
  }
  else if (tab === 'xp') {
    const src = pr?.xpSources || {};
    const SRC = { messages: '💬 Nachrichten', commands: '⚡ Befehle', love: '💜 Love-Actions', dailies: '📅 $daily', work: '💼 $work', games: '🎮 Spiele', admin: '👑 Owner', other: 'Sonstiges' };
    body = pr
      ? kv([
          ['Level', '⭐ Lv ' + pr.level + (pr.prestige ? ' · 💎 Prestige ' + pr.prestige : '')],
          ['XP (aktuelles Segment)', Number(pr.xp || 0).toLocaleString('de-DE')],
          ['XP gesamt (Lifetime)', Number(pr.totalXp || 0).toLocaleString('de-DE')],
          ['Streak', '🔥 ' + pr.streak + ' Tage']
        ]) + '<div class="cc-section" style="margin-top:14px"><h3>📊 XP-Quellen (Lifetime)</h3>' + (Object.keys(src).length ? kv(Object.entries(src).sort((x, y) => y[1] - x[1]).map(([k, v]) => [SRC[k] || esc(k), Number(v).toLocaleString('de-DE')])) : empty('Keine XP-Daten.')) + '</div>' +
        '<div class="cc-section"><h3>👑 Owner-Verwaltung</h3>' + (CC.can('xp.adjust') ? '<div class="cc-btnrow"><button class="cc-btn sm" onclick="location.hash=\'#/xp\'">⭐ XP vergeben/abziehen (Grund + Step-up)</button></div>' : '<div class="cc-empty">Kein Recht <span class="cc-key">xp.adjust</span>.</div>') + '</div>'
      : empty('Kein Bot-Profil für diese Nummer — XP-Tab leer.');
  }
  else if (tab === 'economy') {
    body = pr
      ? kv([
          ['🪙 Kupfer', Number(wallet.copper || 0).toLocaleString('de-DE')],
          ['🥈 Silber', Number(wallet.silver || 0).toLocaleString('de-DE')],
          ['🥇 Gold', Number(wallet.gold || 0).toLocaleString('de-DE')],
          ['🏆 Platin', Number(wallet.platin || 0).toLocaleString('de-DE')],
          ['Gesamt', coins.toLocaleString('de-DE')],
          ['Paar-Bindung', pr.married ? '💍 ' + esc(pr.spouse || '?') + (pr.marriedAt ? ' seit ' + CC.dt(pr.marriedAt) : '') : '—']
        ]) + '<div class="cc-hint" style="margin-top:10px">Bank/Vault/Immobilien/Markt folgen mit der Economy-Phase (Love Economy v2).</div>'
      : empty('Kein Bot-Profil — Economy-Tab leer.');
  }
  else if (tab === 'games') {
    const ach = lp.achievements || [];
    body =
      '<div class="cc-section"><h3>🏅 Achievements (' + ach.length + ')</h3>' +
      (ach.length ? '<div style="display:flex;flex-wrap:wrap;gap:8px">' + ach.map((x) => '<div class="cc-event" style="width:100%"><div class="ev-ico">🏅</div><div class="ev-main"><div class="ev-t">' + esc(x.id) + '</div></div><div class="ev-time">' + (x.at ? CC.dt(x.at) : '—') + '</div></div>').join('') + '</div>' : empty('Keine Achievements.')) + '</div>' +
      ((lp.counters && Object.keys(lp.counters).length) ? '<div class="cc-section"><h3>🎮 Zähler</h3>' + kv(Object.entries(lp.counters).map(([k, v]) => [k, String(v)])) + '</div>' : '');
  }
  else if (tab === 'pets') {
    const pet = lp.pet;
    body = pet
      ? kv([
          ['Pet', (pet.emoji || '🐾') + ' <b>' + esc(pet.name || pet.type || '?') + '</b>'],
          ['Typ', esc(pet.type || '—')],
          ['Level', 'Lv ' + (pet.level || 1)],
          ['XP', Number(pet.xp || 0).toLocaleString('de-DE')],
          ['Sättigung', pet.hunger != null ? pet.hunger + ' %' : '—'],
          ['Stimmung', pet.mood || '—']
        ]) + ((Object.keys(lp.inventory || {}).length) ? '<div class="cc-section" style="margin-top:14px"><h3>🎒 Inventar</h3>' + kv(Object.entries(lp.inventory).map(([k, v]) => [k, String(v)])) + '</div>' : '')
      : empty('Dieser Benutzer besitzt kein Pet.');
  }
  else if (tab === 'groups') {
    const gs = d.groups || [];
    body = gs.length
      ? CC.table([{ t: 'Gruppen-ID', f: (r) => '<span class="cc-key">' + esc(r.gid) + '</span>' }, { t: 'Status', f: (r) => r.active ? '<span class="cc-tag ok">AKTIV</span>' : '<span class="cc-tag bad">INAKTIV</span>' }, { t: 'Eingerichtet', f: (r) => r.setupAt ? CC.dt(r.setupAt) : '—' }], gs)
      : empty('Keine LoveBot-Gruppen in der Datenbank (Gruppen-Mitgliedschaften liegen bei WhatsApp).');
  }
  else if (tab === 'activity') {
    const au = d.auditEntries || [];
    body = au.length
      ? '<div class="cc-feed">' + au.map((e) => '<div class="cc-event"><div class="ev-ico">📈</div><div class="ev-main"><div class="ev-t"><span class="cc-key">' + esc(e.action) + '</span></div><div class="ev-s">' + esc(e.actor || '') + (e.target ? ' → ' + esc(e.target) : '') + ' · ' + esc(e.result || 'success') + '</div></div><div class="ev-time">' + CC.dt(e.time) + '</div></div>').join('') + '</div>'
      : empty('Keine Aktivitäts-Einträge gefunden.');
  }
  else if (tab === 'privacy') {
    const exportJson = () => {
      const blob = new Blob([JSON.stringify({ exportiertAm: new Date().toISOString(), hinweis: 'LoveBot-Datenexport (DSGVO Art. 20)', account: a, profil: pr, loveplus: lp, gruppen: d.groups, audit: d.auditEntries }, null, 2)], { type: 'application/json' });
      const u = URL.createObjectURL(blob);
      const l = document.createElement('a');
      l.href = u; l.download = 'lovebot-export-' + (a.username || id) + '.json'; l.click();
      setTimeout(() => URL.revokeObjectURL(u), 5000);
    };
    const deleteWeb = async () => {
      const b = await CC.confirm({ ico: '🗑️', title: 'Web-ACCOUNT löschen — ' + esc(a.username), text: 'Der Dashboard-Account wird <b>anonymisiert und deaktiviert</b>, alle Web-Sessions enden. Das <b>WhatsApp-Bot-Profil bleibt erhalten</b> (DSGVO-Vorgang separat). Kritisch: Step-up + Audit (account.deleted).', fields: [{ name: 'reason', label: 'Grund * (wird auditiert)', type: 'textarea', required: true }, { name: 'reauth', label: 'Passwort (kritisch)', type: 'password', required: true }], okLabel: '🗑️ Account löschen' });
      if (!b) return;
      const r = await CC.post('/api/accounts/' + id + '/delete', b);
      if (r.status >= 200 && r.status < 300) { CC.toast('✅ Web-Account gelöscht'); CC._accountsCache = null; setTimeout(() => CC.go('users'), 900); }
      else CC.toast('❌ ' + (r.data?.error || 'Fehler'));
    };
    const deleteProfile = async () => {
      if (!pr) { CC.toast('❌ Kein Bot-Profil vorhanden.'); return; }
      const b = await CC.confirm({ ico: '🧹', title: 'BOT-PROFIL löschen (DSGVO Art. 17) — ' + esc(a.username), text: 'Endgültige Löschung des Bot-Profils: Level, XP, Wallet, Pets, Achievements, Inventar. <b>Nicht rückgängig zu machen.</b> Kritisch: Step-up + Audit (user.profile_deleted).', fields: [{ name: 'reason', label: 'Grund * (DSGVO-Beleg, z. B. „Löschwunsch des Nutzers vom …“)', type: 'textarea', required: true }, { name: 'reauth', label: 'Passwort (kritisch)', type: 'password', required: true }], okLabel: '🧹 Profil endgültig löschen' });
      if (!b) return;
      const r = await CC.post('/api/accounts/' + id + '/profile-delete', b);
      if (r.status >= 200 && r.status < 300) { CC.toast('✅ Bot-Profil gelöscht'); setTimeout(() => location.hash = '#/userFull?id=' + encodeURIComponent(id) + '&tab=privacy', 900); }
      else CC.toast('❌ ' + (r.data?.error || 'Fehler'));
    };
    body =
      '<div class="cc-section"><h3>🔒 Datenschutz-Status</h3>' + kv([
        ['DSGVO-Einwilligung', pr ? (pr.dsgvo ? '<span class="cc-tag ok">AKTIV</span>' : '<span class="cc-tag bad">FEHLT</span>') : '—'],
        ['Registriert', pr ? (pr.registered ? 'JA' : 'NEIN') : '—'],
        ['Gespeicherte Daten', pr ? 'Profil + Fortschritt + Wallet + Love + Pets + Achievements' : 'nur Web-Account']
      ]) + '</div>' +
      '<div class="cc-grid2">' +
        '<div class="cc-section"><h3>📤 Datenexport (DSGVO Art. 20)</h3><p class="cc-hint">Kompletter Export aller gespeicherten Daten dieses Nutzers als JSON.</p><div class="cc-btnrow"><button class="cc-btn" onclick="window._aktenExport()">📤 JSON herunterladen</button></div></div>' +
        '<div class="cc-section"><h3>🗑️ Löschung</h3><div class="cc-btnrow" style="flex-wrap:wrap">' +
          (canManage ? '<button class="cc-btn danger" onclick="window._aktenDeleteWeb()">🗑️ Web-Account löschen</button><button class="cc-btn danger" onclick="window._aktenDeleteProfile()">🧹 Bot-Profil löschen (Art. 17)</button>' : '<div class="cc-empty">Keine Lösch-Berechtigung (<span class="cc-key">accounts.manage</span>).</div>') +
        '</div></div>' +
      '</div>';
    window._aktenExport = exportJson;
    window._aktenDeleteWeb = deleteWeb;
    window._aktenDeleteProfile = deleteProfile;
  }

  CC.page('👤 ' + esc(a.username || id), 'Vollständige Benutzerakte — eine Quelle, alle Systeme (WhatsApp &amp; Website).',
    '<div class="cc-aktenhead">' +
      '<div class="cc-avatar xl">💜</div>' +
      '<div><div style="font-size:20px;font-weight:800">' + esc(a.username || '—') + ' ' + CC.rolepill(a.role) + ' ' + CC.pill(a.status) + '</div>' +
      '<div class="cc-subline" style="margin:4px 0 0">Nummer: <span class="cc-key">' + esc(a.number || '—') + '</span> · erstellt ' + CC.dt(a.createdAt) + (a.lastLoginAt ? ' · zuletzt ' + CC.rel(a.lastLoginAt) : '') + '</div></div>' +
      (canManage ? '<button class="cc-btn sm" style="margin-left:auto" onclick="history.back()">← Zurück zur Liste</button>' : '') +
    '</div>' +
    '<div class="cc-tabbar">' + TABS.map(([tid, label]) => '<button class="cc-tab' + (tab === tid ? ' on' : '') + '" onclick="window._aktenTab(\'' + tid + '\')">' + label + '</button>').join('') + '</div>' +
    '<div id="aktenBody">' + body + '</div>'
  );
  window._aktenTab = (t) => setTab(t);
}, { perms: ['accounts.view'] });


/* ═══════════════════════════════════════════════════════════════
   SOUL ECHO — 🧮 RECHTE-MATRIX + 🌳 RECHTEBAUM + 🧩 FEATURE-REGISTRY
   (LoveBot 5.0: Thinkproject-Muster „Rolle × Ressource" als echte Matrix,
   Ressourcen-Struktur als Baum, Module als „App Store")
   ═══════════════════════════════════════════════════════════════ */

/* ═══ 🧮 RECHTE-MATRIX ═══ */
CC.reg('matrix', async () => {
  const [rl, pm] = await Promise.all([api('/api/roles').catch(() => null), CCpermMeta()]);
  if (!rl && !pm) { CC.viewErr('Keine Berechtigung für die Rechte-Matrix.'); return; }
  const roles = (rl && rl.roles) || [];
  const matrix = (rl && rl.matrix) || {};
  const perms = (pm && pm.permissions) || [];
  const byCat = {};
  for (const p of perms) (byCat[p.cat] = byCat[p.cat] || []).push(p);
  const cell = (roleId, permId) => {
    if (roleId === 'owner') return '<td class="mx-cell on" title="Owner: alle Rechte">✓</td>';
    const has = (matrix[roleId] || []).includes(permId);
    const crit = perms.find((x) => x.id === permId)?.critical;
    return '<td class="mx-cell' + (has ? (crit ? ' crit' : ' on') : '') + '" title="' + esc(permId) + ' · ' + esc(roles.find((r) => r.id === roleId)?.label || roleId) + '">' + (has ? (crit ? '⚠️' : '✓') : '—') + '</td>';
  };
  const roleCol = roles.map((r) => '<th class="mx-role">' + (r.icon || '') + ' ' + esc(r.label) + '<div class="mx-lv">Level ' + r.level + '</div></th>').join('');
  const cats = Object.entries(byCat).map(([cat, list]) =>
    '<tr class="mx-catrow"><td colspan="' + (1 + roles.length) + '">' + esc(cat) + '</td></tr>' +
    list.map((p) => '<tr><td class="mx-perm">' + esc(p.id) + (p.critical ? ' <span title="kritisch — Step-up erforderlich">⚠️</span>' : '') + '<div class="mx-permlabel">' + esc(p.label) + '</div></td>' +
      roles.map((r) => cell(r.id, p.id)).join('') + '</tr>').join('')
  ).join('');

  /* 🌳 RECHTEBAUM: Ressourcen-Struktur (konzeptionell, Rechte-Mapping) */
  const TREE = [
    ['COMMUNITY', ['users → accounts.*', 'groups → groups.*', 'profiles → self.view']],
    ['PROGRESSION', ['xp → xp.view / xp.adjust', 'levels & prestige → xp.view', 'achievements → xp.view', 'quests → (Phase: Quest-System)']],
    ['ECONOMY', ['wallet → economy.view', 'shop → economy.adjust', 'transactions → economy.view', 'market → (Phase: Trading)']],
    ['GAMES', ['arcade → games.view', 'pvp & tournaments → (Phase: Game Center 2)']],
    ['MEDIA', ['downloads → media.*', 'ai → media.manage', 'history → media.view']],
    ['SYSTEM', ['sessions → sessions.*', 'security → security.*', 'logs & audit → logs.view/export', 'maintenance → system.control', 'features → system.manage']]
  ];
  const treeHtml = TREE.map(([branch, items]) =>
    '<div class="mx-branch"><b>' + branch + '</b><div class="mx-items">' + items.map((i) => {
      const [res, permTxt] = i.split(' → ');
      return '<div class="mx-item"><span class="cc-key">' + esc(res.trim()) + '</span> <span style="color:var(--dim)">→</span> ' + esc(permTxt) + '</div>';
    }).join('') + '</div></div>').join('');

  CC.page('🧮 Rechte-Matrix', 'Rolle × Einzelrecht auf einen Blick (Thinkproject-Muster) — ⚠️ = kritisches Recht (Step-up erforderlich), Owner hat immer alle Rechte.',
    '<div class="cc-section"><h3>Matrix: Rollen × Einzelrechte</h3>' +
    '<div class="cc-tablewrap" style="overflow-x:auto"><table class="cc-table mx-table"><thead><tr><th class="mx-perm">Einzelrecht</th>' + roleCol + '</tr></thead><tbody>' + cats + '</tbody></table></div>' +
    '<div class="cc-subline" style="margin-top:8px">✓ = Recht in der Rolle · ⚠️ = kritisches Recht (in der Rolle, mit Step-up) · — = nicht enthalten · Einzelrechte pro Benutzer: ➕/➖ in der Benutzerakte (mit Grund + Verlauf).</div></div>' +
    '<div class="cc-section"><h3>🌳 Rechtebaum (Ressourcen-Struktur)</h3>' +
    '<div class="cc-subline" style="margin:0 0 10px">Jeder Zweig der Plattform hat seine Ressource und ihre zugehörigen Rechte. „(Phase: …)" = noch nicht implementiertes Modul.</div>' +
    '<div class="cc-grid2" style="gap:10px">' + treeHtml + '</div></div>' +
    '<div class="cc-section"><h3>📋 Vorlagen &amp; Einzelrechte</h3><p class="cc-hint">Vorlagen: <b>Vorlagen</b> im Menü · Einzelrechte pro Benutzer: Benutzer → Akte → Berechtigungen. Kritische Änderungen verlangen Grund + Step-up und landen im unveränderlichen Rechte-Verlauf.</p></div>'
  );
}, { perms: ['roles.assign', 'accounts.view'] });

/* ═══  FEATURE-REGISTRY („App Store") ═══ */
CC.reg('features', async () => {
  const d = await api('/api/features').catch(() => null);
  if (!d || !d.ok) { CC.viewErr('Feature-Registry nicht verfügbar.'); return; }
  const feats = Object.entries(d.features);
  const canEdit = CC.can('system.manage');
  const stTag = (s) => s === 'enabled' ? '<span class="cc-tag ok">🟢 AKTIV</span>' : s === 'limited' ? '<span class="cc-tag warn">🟡 BESCHRÄNKT</span>' : '<span class="cc-tag bad">🔴 AUS</span>';
  const audLabel = { everyone: 'Alle', admins: 'Admins', owner: 'Nur Owner', off: 'Deaktiviert' };
  const cards = feats.map(([k, f]) =>
    '<div class="cc-featurecard ' + f.status + '">' +
      '<div class="cc-featicon">' + (f.icon || '📦') + '</div>' +
      '<div class="cc-featname"><b>' + esc(f.label) + '</b><div class="cc-key">' + esc(k) + '</div></div>' +
      '<div class="cc-featstatus">' + stTag(f.status) + '<div class="cc-feataud">für: ' + (audLabel[f.audience] || f.audience) + '</div></div>' +
      (canEdit ? '<div class="cc-featctrl"><select class="cc-select sm" id="feat_' + k + '_s">' + ['enabled', 'limited', 'disabled'].map((x) => '<option value="' + x + '"' + (f.status === x ? ' selected' : '') + '>' + { enabled: 'Aktiv', limited: 'Beschränkt', disabled: 'Aus' }[x] + '</option>').join('') + '</select>' +
        '<select class="cc-select sm" id="feat_' + k + '_a">' + ['off', 'owner', 'admins', 'everyone'].map((x) => '<option value="' + x + '"' + (f.audience === x ? ' selected' : '') + '>' + (audLabel[x] || x) + '</option>').join('') + '</select>' +
        '<button class="cc-btn sm" onclick="CC.saveFeature(\'' + k + '\')">💾</button></div>' : '') +
    '</div>').join('');

  CC.page('🧩 Feature-Registry', 'Modularität des Ecosystems — jedes Modul mit Status &amp; Zielgruppe („App Store"). Änderungen: Step-up + Audit (feature.changed).' +
    (d.version ? ' <span class="cc-subline" style="display:inline">Version ' + d.version + (d.updatedAt ? ' · zuletzt ' + CC.dt(d.updatedAt) + ' von ' + esc(d.updatedBy || '?') : '') + '</span>' : ''),
    '<div class="cc-featuregrid">' + cards + '</div>' +
    '<div class="cc-tip" style="margin-top:14px">ℹ️ <b>Wirkung:</b> Der Status ist die zentrale Modul-Deklaration der Plattform (Owner-Sicht &amp; Roadmap-Anker). Je nach Modul wird der Status von den jeweiligen Systemen ausgelesen — Module in „Aus" sind in Phase-Plänen eingeplant (z. B. Quests, Seasons, Trading, Tournaments).</div>'
  );
}, { perms: [] });

CC.saveFeature = async (key) => {
  const sEl = document.getElementById('feat_' + key + '_s');
  const aEl = document.getElementById('feat_' + key + '_a');
  const status = sEl?.value, audience = aEl?.value;
  const b = await CC.confirm({ ico: '🧩', title: 'Modul ändern: ' + key, text: 'Status: <b>' + status + '</b> · Zielgruppe: <b>' + audience + '</b><br>Wird versioniert und auditiert (feature.changed) + Security-Event.', fields: [{ name: 'reason', label: 'Grund * (wird auditiert)', required: true, placeholder: 'z. B. Testing von Seasons mit Admins' }, { name: 'reauth', label: 'Passwort (kritisch)', type: 'password', required: true }], okLabel: '💾 Speichern' });
  if (!b) return;
  const r = await CC.post('/api/features', { id: key, status, audience, reason: b.reason, reauth: b.reauth });
  if (r.status >= 200 && r.status < 300) { CC.toast('✅ Modul aktualisiert (v' + r.data.version + ')'); CC.go('features'); }
  else CC.toast('❌ ' + (r.data?.error || 'Fehler'));
};

/* Menü-Einträge */
(function () {
  const g = CC.menu.find((m) => m.sec && m.sec.startsWith('👥'));
  if (g && !g.items.find((i) => i.id === 'matrix')) {
    g.items.push({ id: 'matrix', ico: '🧮', label: 'Rechte-Matrix', perms: ['roles.assign', 'accounts.view'] });
  }
  const sys = CC.menu.find((m) => m.sec && m.sec.startsWith('⚙ SYSTEM'));
  if (sys && !sys.items.find((i) => i.id === 'features')) {
    sys.items.splice(1, 0, { id: 'features', ico: '🧩', label: 'Feature-Registry', perms: [] });
  }
})();

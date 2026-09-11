/* ═══════════════════════════════════════════════════════════════
   SOUL ECHO — ⭐ XP & LEVEL · 💰 ECONOMY · 🎮 GAMES · ❤️ HEALTH
   LoveCore-Ansichten: Statistik, Level-Tabelle, XP-Admin,
   Economy-Übersicht, Games, System-Health.
   ═══════════════════════════════════════════════════════════════ */

/* ── Helfer ──────────────────────────────────────────────────── */
const XP_SRC_LABEL = {
  messages: '💬 Nachrichten', commands: '⚡ Befehle', love: '💜 Love-Actions',
  dailies: '📅 $daily / $dailylove', work: '💼 $work',
  games: '🎮 Spiele (Sieg +15 / Niederlage +2)', admin: '👑 Owner-Manipulation',
  gifts: '🎁 Geschenke', achievements: '🏆 Achievements', monthlybonus: '📅 Monatsziel-Bonus',
  compliments: '💜 Komplimente', media: '📺 Media',
  terminal: '🖥️ Terminal', other: 'Sonstiges'
};

/* ═══  XP & LEVEL ═══ */
/* Progression 3.0: XP-Regel-Editor (Kategorien / Multiplikatoren / Anti-Farm / Boni) */
function buildRulesSection(rules, canAdjust) {
  if (!rules || !rules.ok) return '<div class="cc-section"><h3>⚙️ XP-Regeln (Progression 2.0)</h3><div class="cc-empty">Regel-Engine nicht erreichbar.</div></div>';
  const catMeta = {
    message: ['💬 Nachrichten', 'Basis-XP pro Nachricht (Gruppe), 1:1, Nett-Multiplikator, Love-Multiplikator, Kompliment-Bonus'],
    command: ['⚡ Befehle', 'Basis-XP pro Command, Bonus für Love-Actions'],
    compliment: ['💜 Komplimente', 'Sender-XP, Empfänger-XP, Cooldown (s), Tages-Cap — Social XP Layer'],
    game: ['🎮 Spiele', 'Sieg-XP, Niederlage-XP'],
    daily: ['📅 Dailies', '$daily, $dailylove, $work'],
    media: ['📺 Media', 'Erster Download, neuer Provider, Events/Tag']
  };
  const rows = Object.entries(rules.categories).map(([k, v]) => {
    const [label, hint] = catMeta[k] || [k, ''];
    const dis = canAdjust ? '' : ' disabled';
    return '<tr><td class="cc-rule-ico">' + label + '</td>' +
      '<td class="cc-rule-nums">' + Object.entries(v).filter(([f]) => f !== 'enabled').map(([f, val]) =>
        '<label class="cc-rule-field">' + esc(f) + ' <input class="cc-input" data-cat="' + k + '" data-field="' + f + '" type="number" value="' + val + '" style="width:86px"' + dis + '></label>').join(' ') +
      '</td>' +
      '<td style="text-align:center"><input type="checkbox" class="cc-rule-en" data-cat="' + k + '"' + (v.enabled ? ' checked' : '') + dis + ' title="' + esc(hint) + '"></td></tr>';
  }).join('');
  const m = rules.multipliers || {};
  const a = rules.antiFarm || {};
  const bo = rules.bonuses || {};
  const stm = m.streak || {};
  const g = rules.goals || {};
  const rw = rules.rewards || {};
  const xr = rules.xpRewards || {};
  const eco = rules.economy || {};
  const ob = m.ownerBonus || {};
  const num = (k, v) => '<label class="cc-rule-field">' + esc(k) + ' <input class="cc-input" data-multi="' + k + '" type="' + (k === 'eventActive' ? 'checkbox' : 'number') + '"' + (k === 'eventActive' ? (v ? ' checked' : '') : ' value="' + v + '"') + ' style="width:86px"' + (canAdjust ? '' : ' disabled') + '></label>';
  const anum = (k, v) => '<label class="cc-rule-field">' + esc(k) + ' <input class="cc-input" data-anti="' + k + '" type="number" value="' + v + '" style="width:96px"' + (canAdjust ? '' : ' disabled') + '></label>';
  const bnum = (k, v) => '<label class="cc-rule-field">' + esc(k) + ' <input class="cc-input" data-bonus="' + k + '" type="number" value="' + (v ?? '') + '" style="width:96px"' + (canAdjust ? '' : ' disabled') + '></label>';
  const snum = (k, v) => '<label class="cc-rule-field">' + esc(k) + ' <input class="cc-input" data-streak="' + k + '" type="' + (k === 'enabled' ? 'checkbox' : 'number') + '"' + (k === 'enabled' ? (v ? ' checked' : '') : ' value="' + (v ?? '') + '" step="0.01"') + ' style="width:86px"' + (canAdjust ? '' : ' disabled') + '></label>';
  const gnum = (k, v) => '<label class="cc-rule-field">' + esc(k) + ' <input class="cc-input" data-goal="' + k + '" type="number" value="' + (v ?? '') + '" style="width:96px"' + (canAdjust ? '' : ' disabled') + '></label>';
  const rnum = (k, v) => '<label class="cc-rule-field">' + esc(k) + ' <input class="cc-input" data-reward="' + k + '" type="number" value="' + (v ?? '') + '" style="width:96px"' + (canAdjust ? '' : ' disabled') + '></label>';
  const cnum = (k, v) => '<label class="cc-rule-field">' + esc(k) + ' <input class="cc-input" data-chest="' + k + '" type="number" value="' + (v ?? '') + '" style="width:86px"' + (canAdjust ? '' : ' disabled') + '></label>';
  const xnum = (k, v) => '<label class="cc-rule-field">' + esc(k) + ' <input class="cc-input" data-xreward="' + k + '" type="number" value="' + (v ?? '') + '" style="width:86px"' + (canAdjust ? '' : ' disabled') + '></label>';
  const ecoN = (k, v, step) => '<label class="cc-rule-field">' + esc(k) + ' <input class="cc-input" data-eco="' + k + '" type="number" value="' + (v ?? '') + '"' + (step ? ' step="' + step + '"' : '') + ' style="width:104px"' + (canAdjust ? '' : ' disabled') + '></label>';
  const ecoM = (k, v) => '<label class="cc-rule-field">' + esc(k) + ' <input class="cc-input" data-ecoms="' + k + '" type="number" value="' + (v ?? '') + '" style="width:86px"' + (canAdjust ? '' : ' disabled') + '></label>';
  const evDate = m.eventEndsAt ? new Date(Number(m.eventEndsAt)).toISOString().slice(0, 16) : '';
  return '<div class="cc-section" style="margin-top:14px"><h3>⚙️ XP-Regeln (Progression 6.0) <span class="cc-key">v' + rules.version + '</span></h3>' +
    '<div class="cc-tip" style="margin-bottom:10px">XP-Qualitäts-Regeln: Kategorien, Multiplikatoren (inkl. Cap + Owner-Bonus + Event), Boni, Anti-Farm, Ziele (Tages-/Wochen-/Monatsziele), Rewards, soziale XP-Belohnungen und Economy-Regeln. Änderungen sind <b>kritisch</b>: Grund + Passwort + Audit (<span class="cc-key">xp.rules.changed</span>) + Versionierung. Gilt ab sofort für alle XP-Pfade (WhatsApp &amp; Website).</div>' +
    '<div class="cc-tablewrap"><table class="cc-table"><thead><tr><th>Kategorie</th><th>Werte</th><th>AN</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
    '<div class="cc-grid2" style="margin-top:10px"><div><div class="cc-subline">Multiplikatoren</div><div style="display:flex;flex-wrap:wrap;gap:8px">' +
      ['weekend', 'event', 'eventActive', 'prestigePerLevel', 'prestigeCap', 'totalCap'].map((k) => num(k, m[k])).join('') +
      '<label class="cc-rule-field">eventName <input class="cc-input" data-multi="eventName" data-istext="1" type="text" value="' + esc(m.eventName || '') + '" style="width:130px" maxlength="40"' + (canAdjust ? '' : ' disabled') + '></label>' +
      '<label class="cc-rule-field">eventEndsAt <input class="cc-input" data-multi="eventEndsAt" data-isdate="1" type="datetime-local" value="' + evDate + '" style="width:170px"' + (canAdjust ? '' : ' disabled') + '></label>' +
      '<label class="cc-rule-field">👑 Owner-Bonus <input type="checkbox" data-obonus="enabled"' + (ob.enabled !== false ? ' checked' : '') + (canAdjust ? '' : ' disabled') + '></label>' +
      '<label class="cc-rule-field">bonus <input class="cc-input" data-obonus="bonus" type="number" value="' + (ob.bonus ?? 0.1) + '" step="0.01" style="width:80px"' + (canAdjust ? '' : ' disabled') + '></label>' + '</div></div>' +
    '<div><div class="cc-subline">Anti-Farm</div><div style="display:flex;flex-wrap:wrap;gap:8px">' +
      ['msgCapPerHour', 'cmdCapPerHour', 'duplicateWindowSec', 'duplicateMaxPerDay', 'mutualFarmMaxPerHour', 'suspiciousXpPerDay'].map((k) => anum(k, a[k])).join('') + '</div></div></div>' +
    '<div class="cc-grid2" style="margin-top:10px"><div><div class="cc-subline">🎁 Boni (erste Aktion/Tag, Streak-Meilensteine)</div><div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center">' +
      ['firstActionDaily', 'streak7', 'streak30', 'streak100'].map((k) => bnum(k, bo[k])).join('') +
      '<label class="cc-rule-field">aktiv <input type="checkbox" data-bonus="enabled"' + (bo.enabled !== false ? ' checked' : '') + (canAdjust ? '' : ' disabled') + '></label></div></div>' +
    '<div><div class="cc-subline">🔥 Streak-Multiplikator (Anteil, z. B. 0.1 = +10 %)</div><div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center">' +
      ['enabled', 'd3', 'd7', 'd30', 'cap'].map((k) => snum(k, stm[k])).join('') + '</div></div></div>' +
    '<div class="cc-grid2" style="margin-top:10px"><div><div class="cc-subline">🎯 Ziele (XP/Msg/Cmd/Spiele → Kupfer, keine XP)</div><div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center">' +
      ['dailyXp', 'weeklyXp', 'monthlyXp', 'dailyCopper', 'weeklyCopper', 'monthlyCopper', 'monthlyXpBonus', 'dailyMessages', 'dailyCommands', 'weeklyMessages', 'weeklyGames'].map((k) => gnum(k, g[k])).join('') +
      '<label class="cc-rule-field">aktiv <input type="checkbox" data-goal="enabled"' + (g.enabled !== false ? ' checked' : '') + (canAdjust ? '' : ' disabled') + '></label></div></div>' +
    '<div><div class="cc-subline">🎁 Rewards (Level-/Prestige-Kupfer + Truhen)</div><div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center">' +
      ['levelCopperBase', 'levelCopperPerLevel', 'levelCopperCap', 'prestigeCopper', 'goalMinorCopper'].map((k) => rnum(k, rw[k])).join('') + '</div>' +
      '<div class="cc-subline" style="margin-top:6px">🎁 Truhen (einmalig, claimbar)</div><div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center">' +
      Object.keys((rw.chests || {})).map((k) => cnum(k, rw.chests[k])).join('') + '</div></div></div>' +
    '<div class="cc-grid2" style="margin-top:10px"><div><div class="cc-subline">🎁 Soziale XP-Belohnungen (6.0, klein + gedeckelt)</div><div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center">' +
      ['achievement', 'giftGiven', 'giftReceived'].map((k) => xnum(k, xr[k])).join('') + '</div></div>' +
    '<div><div class="cc-subline">🏆 Daily-Streak-Meilensteine (Kupfer)</div><div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center">' +
      ['d7', 'd30', 'd100', 'd365'].map((k) => ecoM(k, (eco.dailyMilestones || {})[k])).join('') + '</div></div></div>' +
    '<div class="cc-subline" style="margin-top:10px">💰 Economy-Regeln (6.0)</div><div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center">' +
      ['coinCap', 'transferMin', 'transferMax', 'transferDailyCap', 'bankBase', 'bankPerLevel', 'bankPerPrestige', 'bankPerAchievement', 'interestCap', 'interestCooldownH', 'starterCopper', 'starterXp', 'dailyBase', 'dailyBestBonus', 'weeklyBase', 'monthlyBase', 'yearlyBase'].map((k) => ecoN(k, eco[k])).join('') +
      ecoN('interestPct', eco.interestPct, '0.1') + ecoN('dailyStreakPct', eco.dailyStreakPct, '0.5') + ecoN('dailyStreakCapPct', eco.dailyStreakCapPct, '1') + '</div>' +
    (canAdjust ?
      '<div class="cc-xpform" style="margin-top:10px"><div class="cc-field" style="flex:1;min-width:260px"><label>Grund für die Regeländerung (Pflicht — wird auditiert)</label><input class="cc-input" id="xpRulesReason" placeholder="z. B. Anti-Farm verschärft nach Spike-Analyse" maxlength="200"></div></div>' +
      '<div class="cc-btnrow"><button class="cc-btn primary" id="xpRulesSave">💾 Regeln speichern</button></div><div id="xpRulesOut"></div>'
      : '<div class="cc-empty" style="margin-top:8px">Nur Lesezugriff — ändern darf <span class="cc-key">xp.adjust</span>.</div>') +
    '</div>';
}
CC.reg('xp', async () => {
  const d = await api('/api/xp').catch(() => null);
  if (!d || !d.ok) { CC.viewErr('Keine Berechtigung für XP & Level (xp.view).'); return; }
  const st = d.stats || {};
  const canAdjust = CC.can('xp.adjust');
  const rules = await api('/api/xp/rules').catch(() => null);

  /* Nutzer-Suche für die XP-Verwaltung */
  const users = await api('/api/admin/users?q=').catch(() => null);
  const userRows = (users && users.users) || (users && Array.isArray(users) ? users : []);
  const datalist = userRows.slice(0, 200).map((u) => '<option value="' + esc(u.bid) + '">' + esc(u.name || u.bid) + '</option>').join('');

  const srcRows = Object.entries(st.sources || {}).sort((a, b) => b[1] - a[1]).map(([k, v]) =>
    '<span class="k">' + (XP_SRC_LABEL[k] || esc(k)) + '</span><span class="v">' + Number(v).toLocaleString('de-DE') + '</span>').join('');

  const topTable = d.top && d.top.length ? CC.table([
    { t: 'Nutzer', f: (r) => '<b>' + esc(r.name || r.bid) + '</b>' },
    { t: 'Rang', f: (r) => r.rank || '—' },
    { t: 'Prestige', f: (r) => r.prestige ? '💎 ' + r.prestige : '—' },
    { t: 'Level', f: (r) => 'Lv ' + (r.level || 0) },
    { t: 'XP (aktuell)', f: (r) => Number(r.xp || 0).toLocaleString('de-DE') },
    { t: 'XP gesamt', f: (r) => Number(r.totalXp || 0).toLocaleString('de-DE') }
  ], d.top) : '<div class="cc-empty">Noch keine Level-Nutzer.</div>';

  const t = d.table || { rows: [], meta: {} };
  const tableRows = t.rows.slice(0, 50).map((r) =>
    '<tr><td>' + r.level + '</td><td class="mono">' + r.needed + '</td><td class="mono">' + r.cumulative + '</td><td>' + (r.rank || '—') + '</td></tr>').join('');

  CC.page('⭐ XP & Level', 'LoveCore-Progression — eine Quelle, ein Wert (WhatsApp &amp; Website teilen die Engine). Kurve: Basis 743 XP × 1.00743/Level, 744 Level pro Prestige-Zyklus.',
    '<div class="cc-statgrid">' +
      '<div class="cc-stat"><div class="ic">⭐</div><div class="num">' + Number(st.totalXp || 0).toLocaleString('de-DE') + '</div><div class="lab">XP gesamt (Lifetime)</div></div>' +
      '<div class="cc-stat"><div class="ic">⏱</div><div class="num st-ok">' + Number(st.today || 0).toLocaleString('de-DE') + '</div><div class="lab">XP in 24 h</div></div>' +
      '<div class="cc-stat"><div class="ic">📈</div><div class="num">' + (st.levelUps24h ?? 0) + '</div><div class="lab">Level-Ups (24 h)</div></div>' +
      '<div class="cc-stat"><div class="ic">💎</div><div class="num">' + (st.prestigeUps24h ?? 0) + '</div><div class="lab">Prestige-Ups (24 h)</div></div>' +
      '<div class="cc-stat"><div class="ic">⚠️</div><div class="num' + (st.suspiciousXp > 0 ? ' st-warn' : '') + '">' + (st.suspiciousXp ?? 0) + '</div><div class="lab">Anti-Spam-Cap aktiv (24 h)</div></div>' +
      '<div class="cc-stat"><div class="ic">🏆</div><div class="num">' + (st.games24h ?? 0) + '</div><div class="lab">Games (24 h)</div></div>' +
    '</div><br>' +
    (canAdjust ?
      '<div class="cc-section"><h3>👑 XP vergeben / abziehen (kritisch)</h3>' +
      '<div class="cc-tip" style="margin-bottom:12px">⚠️ Jede Änderung erfordert einen <b>Grund</b>, eine <b>Passwort-Bestätigung</b> und landet im <b>Audit-Log</b> (aktion: <span class="cc-key">xp.adjusted</span>). Negative Werte reduzieren nur XP — es gibt KEIN Level-Down (konservativ).</div>' +
      '<div class="cc-xpform">' +
        '<div class="cc-field" style="max-width:340px"><label>Nutzer-ID (bid)</label><input class="cc-input" id="xpAdjBid" list="xpBidList" placeholder="z. B. 4915…@s.whatsapp.net" autocomplete="off"><datalist id="xpBidList">' + datalist + '</datalist></div>' +
        '<div class="cc-field" style="max-width:180px"><label>Delta (+/− XP)</label><input class="cc-input" id="xpAdjDelta" type="number" placeholder="z. B. 500 oder -100"></div>' +
        '<div class="cc-field" style="flex:1;min-width:260px"><label>Grund (Pflicht)</label><input class="cc-input" id="xpAdjReason" placeholder="z. B. Korrektur nach Support-Fall #12" maxlength="200"></div>' +
      '</div><div class="cc-btnrow"><button class="cc-btn primary" id="xpAdjBtn">⭐ XP anwenden</button></div>' +
      '<div id="xpAdjOut"></div>' +
      '</div>' :
      '<div class="cc-section"><h3>👑 XP vergeben / abziehen</h3><div class="cc-empty">Kein Recht <span class="cc-key">xp.adjust</span> — nur Owner &amp; Deputy können XP manuell ändern.</div></div>') +
    '<div class="cc-grid2">' +
      '<div class="cc-section"><h3>🏅 Top-Nutzer (nach Fortschritt)</h3>' + topTable + '</div>' +
      '<div class="cc-section"><h3>📊 XP-Quellen (Lifetime)</h3><div class="cc-kv">' + (srcRows || '<span class="k">Noch keine Daten</span><span class="v">—</span>') + '</div></div>' +
    '</div>' +
    '<div class="cc-section" style="margin-top:14px"><h3>📶 Level-Tabelle (Zyklus 0 · erste ' + t.rows.length + ' Level)</h3>' +
      '<div class="cc-subline" style="margin:0 0 10px">Max: Level ' + (t.meta && t.meta.maxLevel) + ' · Wachstum: ' + (t.meta && t.meta.growth) + ' · Danach Prestige (Level 0, Zyklus +1)</div>' +
      '<div class="cc-tablewrap" style="overflow-x:auto;max-height:420px;overflow-y:auto"><table class="cc-table"><thead><tr><th>Level</th><th>XP nötig</th><th>XP kumuliert</th><th>Rang</th></tr></thead><tbody>' + tableRows + '</tbody></table></div>' +
    '</div>' +
    buildRulesSection(rules, canAdjust)
  , { after: () => {
    const rulesBtn = document.getElementById('xpRulesSave');
    if (rulesBtn && canAdjust) {
      rulesBtn.onclick = async () => {
        const reason = (document.getElementById('xpRulesReason') || {}).value || '';
        if (String(reason).trim().length < 5) { CC.toast('❌ Grund ist Pflicht (mind. 5 Zeichen)'); return; }
        const body = { reason: String(reason).trim() };
        const cats = {}; const multi = {}; const anti = {}; const bonus = {}; const streak = {};
        document.querySelectorAll('[data-cat]').forEach((inp) => {
          const c = inp.dataset.cat;
          cats[c] = cats[c] || {};
          if (inp.classList.contains('cc-rule-en')) cats[c].enabled = inp.checked;
          else cats[c][inp.dataset.field] = Number(inp.value);
        });
        document.querySelectorAll('[data-multi]').forEach((inp) => {
          if (inp.dataset.istext) multi[inp.dataset.multi] = String(inp.value || '');
          else if (inp.dataset.isdate) multi[inp.dataset.multi] = inp.value ? new Date(inp.value).getTime() : null;
          else multi[inp.dataset.multi] = inp.classList.contains('cc-rule-en') || inp.type === 'checkbox' ? inp.checked : Number(inp.value);
        });
        document.querySelectorAll('[data-obonus]').forEach((inp) => {
          multi.ownerBonus = multi.ownerBonus || {};
          multi.ownerBonus[inp.dataset.obonus] = inp.type === 'checkbox' ? inp.checked : Number(inp.value);
        });
        document.querySelectorAll('[data-anti]').forEach((inp) => { anti[inp.dataset.anti] = Number(inp.value); });
        document.querySelectorAll('[data-bonus]').forEach((inp) => { bonus[inp.dataset.bonus] = inp.type === 'checkbox' ? inp.checked : Number(inp.value); });
        document.querySelectorAll('[data-streak]').forEach((inp) => { streak[inp.dataset.streak] = inp.type === 'checkbox' ? inp.checked : Number(inp.value); });
        const goals = {}; const rewards = {}; const chests = {};
        document.querySelectorAll('[data-goal]').forEach((inp) => { goals[inp.dataset.goal] = inp.type === 'checkbox' ? inp.checked : Number(inp.value); });
        document.querySelectorAll('[data-reward]').forEach((inp) => { rewards[inp.dataset.reward] = Number(inp.value); });
        document.querySelectorAll('[data-chest]').forEach((inp) => { chests[inp.dataset.chest] = Number(inp.value); });
        const xrewards = {}; const ecoR = {}; const ecoms = {};
        document.querySelectorAll('[data-xreward]').forEach((inp) => { xrewards[inp.dataset.xreward] = Number(inp.value); });
        document.querySelectorAll('[data-eco]').forEach((inp) => { ecoR[inp.dataset.eco] = Number(inp.value); });
        document.querySelectorAll('[data-ecoms]').forEach((inp) => { ecoms[inp.dataset.ecoms] = Number(inp.value); });
        body.categories = cats; body.multipliers = multi; body.antiFarm = anti; body.bonuses = bonus;
        if (Object.keys(streak).length) body.multipliers.streak = streak;
        if (Object.keys(goals).length) body.goals = goals;
        if (Object.keys(rewards).length || Object.keys(chests).length) { body.rewards = rewards; if (Object.keys(chests).length) body.rewards.chests = chests; }
        if (Object.keys(xrewards).length) body.xpRewards = xrewards;
        if (Object.keys(ecoR).length || Object.keys(ecoms).length) { body.economy = ecoR; if (Object.keys(ecoms).length) body.economy.dailyMilestones = ecoms; }
        const ans = await CC.confirm({
          ico: '⚙️',
          title: 'XP-Regeln ändern?',
          text: 'Alle Kategorien, Multiplikatoren und Anti-Farm-Grenzen werden auf die neuen Werte gesetzt.<br>Grund: ' + esc(body.reason) + '<br><br>Audit: <b>xp.rules.changed</b> · Versionierung.',
          fields: [{ name: 'reauth', label: 'Passwort (kritische Aktion)', type: 'password', required: true, placeholder: 'Dein Owner-Passwort' }],
          okLabel: '💾 Regeln setzen'
        });
        if (!ans) return;
        body.reauth = ans.reauth;
        const r = await CC.post('/api/xp/rules', body);
        const out = document.getElementById('xpRulesOut');
        if (r.status >= 200 && r.status < 300) {
          out.innerHTML = '<div class="cc-tip" style="border-color:var(--ok,#2c2)"><b>✅ Gespeichert:</b> XP-Regeln → v' + r.data.version + ' — ' + esc(body.reason) + '</div>';
          CC.toast('✅ XP-Regeln aktualisiert');
        } else {
          out.innerHTML = '<div class="cc-tip" style="border-color:var(--bad,#c44)"><b>❌ ' + esc((r.data && r.data.error) || 'Fehler') + '</b></div>';
        }
      };
    }
    if (!canAdjust) return;
    document.getElementById('xpAdjBtn').onclick = async () => {
      const bid = document.getElementById('xpAdjBid').value.trim();
      const delta = Number(document.getElementById('xpAdjDelta').value);
      const reason = document.getElementById('xpAdjReason').value.trim();
      const out = document.getElementById('xpAdjOut');
      if (!bid) { CC.toast('❌ Nutzer-ID fehlt'); return; }
      if (!delta) { CC.toast('❌ Delta muss ungleich 0 sein'); return; }
      if (reason.length < 5) { CC.toast('❌ Grund ist Pflicht (mind. 5 Zeichen)'); return; }
      const ans = await CC.confirm({
        ico: '⭐',
        title: 'XP-Änderung bestätigen',
        text: 'Nutzer <b>' + esc(bid) + '</b><br>Delta: <b>' + (delta > 0 ? '+' : '') + delta.toLocaleString('de-DE') + ' XP</b><br>Grund: ' + esc(reason) + '<br><br>Wird im Audit-Log gespeichert (xp.adjusted).',
        fields: [{ name: 'reauth', label: 'Passwort (kritische Aktion)', type: 'password', required: true, placeholder: 'Dein Owner-Passwort' }],
        okLabel: '⭐ Anwenden'
      });
      if (!ans) return;
      const r = await CC.post('/api/xp/adjust', { bid, delta, reason, reauth: ans.reauth });
      if (r.status >= 200 && r.status < 300) {
        out.innerHTML = '<div class="cc-tip" style="border-color:var(--ok,#2c2)"><b>✅ Angewendet:</b> ' + (delta > 0 ? '+' : '') + delta.toLocaleString('de-DE') + ' XP für ' + esc(bid) + ' — ' + esc(reason) + '</div>';
        CC.toast('✅ XP angepasst');
        setTimeout(() => CC.reload(), 800);
      } else {
        out.innerHTML = '<div class="cc-tip" style="border-color:var(--bad,#c44)"><b>❌ ' + esc(r.data?.error || 'Fehler') + '</b></div>';
      }
    };
  } });
}, { perms: ['xp.view'] });

/* ═══ 💰 ECONOMY ═══ */
CC.reg('economy', async () => {
  const ov = await api('/api/admin/overview').catch(() => null);
  if (!ov) { CC.viewErr('Keine Berechtigung für Economy-Übersicht (economy.view).'); return; }
  const t = ov.totals || {};
  const rich = ov.topRich || [];
  const couples = ov.topCouples || [];
  const eh = ov.economy || null;
  const srcRows = eh && eh.topSources ? eh.topSources.map((x) =>
    '<span class="k">' + esc(x.label || x.source) + '</span><span class="v">+' + Number(x.amount || 0).toLocaleString('de-DE') + ' 🪙</span>').join('') : '';
  CC.page('💰 Economy', 'Love-Ökonomie im Überblick — Werte kommen aus dem gemeinsamen Datenmodell (eine Quelle für WhatsApp &amp; Website).',
    '<div class="cc-statgrid">' +
      '<div class="cc-stat"><div class="ic">🪙</div><div class="num">' + Number(t.copper || 0).toLocaleString('de-DE') + '</div><div class="lab">Kupfer gesamt (alle Wallets)</div></div>' +
      (eh ? '<div class="cc-stat"><div class="ic">🏦</div><div class="num">' + Number(eh.totalBank || 0).toLocaleString('de-DE') + '</div><div class="lab">Kupfer auf Banken</div></div>' +
      '<div class="cc-stat"><div class="ic">📈</div><div class="num st-ok">+' + Number(eh.generated || 0).toLocaleString('de-DE') + '</div><div class="lab">Erzeugt (Lifetime)</div></div>' +
      '<div class="cc-stat"><div class="ic">📉</div><div class="num">' + Number(eh.spent || 0).toLocaleString('de-DE') + '</div><div class="lab">Ausgegeben (Lifetime)</div></div>' : '') +
      '<div class="cc-stat"><div class="ic">💞</div><div class="num">' + (t.couples ?? 0) + '</div><div class="lab">Paare aktiv</div></div>' +
      '<div class="cc-stat"><div class="ic">❤️</div><div class="num">' + Number(t.loveXp || 0).toLocaleString('de-DE') + '</div><div class="lab">Paar-XP gesamt</div></div>' +
      '<div class="cc-stat"><div class="ic">🐾</div><div class="num">' + (t.pets ?? 0) + '</div><div class="lab">Pets in Besitz</div></div>' +
    '</div>' + (eh ? '<div class="cc-tip" style="margin:10px 0">Netto-Bilanz: <b>' + (Number(eh.net || 0) >= 0 ? '+' : '') + Number(eh.net || 0).toLocaleString('de-DE') + ' 🪙</b> · Quellen aus den letzten ' + (eh.txSampled || 0) + ' Buchungen (Stichprobe).</div>' : '') + '<br>' +
    '<div class="cc-grid2">' +
      '<div class="cc-section"><h3>👛 Top 10 reichste Nutzer</h3>' +
      (rich.length ? CC.table([
        { t: 'Nutzer', f: (r) => '<b>' + esc(r.name) + '</b>' },
        { t: 'Kupfer', f: (r) => '🪙 ' + Number(r.copper || 0).toLocaleString('de-DE') },
        { t: 'Level', f: (r) => 'Lv ' + (r.level || 0) }
      ], rich) : '<div class="cc-empty">Noch keine Wallets.</div>') + '</div>' +
      '<div class="cc-section"><h3>💞 Top-Paare (Paar-XP)</h3>' +
      (couples.length ? CC.table([
        { t: 'Paar', f: (r) => esc(r.n1) + ' 💍 ' + esc(r.n2) },
        { t: 'Paar-XP', f: (r) => Number(r.loveXp || 0).toLocaleString('de-DE') }
      ], couples) : '<div class="cc-empty">Noch keine Paare.</div>') + '</div>' +
    '</div>' +
    (srcRows ? '<div class="cc-section" style="margin-top:14px"><h3>🪙 Top-Kupferquellen (Stichprobe)</h3><div class="cc-kv">' + srcRows + '</div></div>' : '') +
    (t.petTypes && Object.keys(t.petTypes).length ?
      '<div class="cc-section" style="margin-top:14px"><h3>🐾 Pet-Verteilung</h3><div class="cc-kv">' +
      Object.entries(t.petTypes).map(([k, v]) => '<span class="k">' + esc(k) + '</span><span class="v">' + v + '</span>').join('') + '</div></div>' : '')
  );
}, { perms: ['economy.view'] });

/* ═══  GAMES ═══ */
CC.reg('games', async () => {
  const [ov, xp] = await Promise.all([
    api('/api/admin/overview').catch(() => null),
    api('/api/xp').catch(() => null)
  ]);
  if (!ov && !xp) { CC.viewErr('Keine Berechtigung für Games (games.view).'); return; }
  const t = (ov && ov.totals) || {};
  const ach = t.achievements || {};
  const achRows = Object.entries(ach).sort((a, b) => b[1] - a[1]);
  const st = (xp && xp.stats) || {};
  CC.page('🎮 Games', 'Spiel-Statistik: 4 Minigames (Stein-Papier-Schere, Würfel, Love-Duel, Zahlenraten) mit XP-Belohnung (Sieg +15 / Niederlage +2).',
    '<div class="cc-statgrid">' +
      '<div class="cc-stat"><div class="ic">🏆</div><div class="num st-ok">' + (st.games24h ?? 0) + '</div><div class="lab">Games gewonnen (24 h)</div></div>' +
      '<div class="cc-stat"><div class="ic">🏅</div><div class="num">' + (st.achievements24h ?? 0) + '</div><div class="lab">Achievements freigeschaltet (24 h)</div></div>' +
      '<div class="cc-stat"><div class="ic">🐾</div><div class="num">' + (t.pets ?? 0) + '</div><div class="lab">Pets in Besitz</div></div>' +
    '</div><br>' +
    '<div class="cc-section"><h3>🏅 Achievements — wie oft freigeschaltet (Lifetime)</h3>' +
    (achRows.length ? CC.table([
      { t: 'Achievement', f: (r) => '<b>' + esc(r[0]) + '</b>' },
      { t: 'Mals freigeschaltet', f: (r) => r[1] }
    ], achRows.map(([k, v]) => ({ k, v }))) : '<div class="cc-empty">Noch keine Achievements.</div>') +
    '</div>' +
    '<div class="cc-section"><h3>ℹ️ Game-System</h3><div class="cc-kv">' +
      '<span class="k">Befehle</span><span class="v">$rps · $dice · $love · $rate</span>' +
      '<span class="k">XP Sieg</span><span class="v">+15 XP (Quelle: games)</span>' +
      '<span class="k">XP Niederlage</span><span class="v">+2 XP (Trost-XP)</span>' +
      '<span class="k">Events</span><span class="v">GAME_WIN / GAME_LOSS → Live-Feed &amp; Anti-Spam (300/h-Cap zählt mit)</span>' +
      '<span class="k">Status</span><span class="v"><span class="cc-tag ok">AKTIV</span> — loveplus.js v1.1</span>' +
    '</div></div>'
  );
}, { perms: ['games.view'] });

/* ═══ ❤️ SYSTEM HEALTH ═══ */
CC.reg('health', async () => {
  const d = await api('/api/health').catch(() => null);
  if (!d || !d.ok) { CC.viewErr('System Health nicht verfügbar.'); return; }
  const rows = d.components.map((c) =>
    '<tr><td>' + (c.ok ? '🟢' : '🔴') + '</td><td><b>' + esc(c.label) + '</b></td><td>' + esc(c.detail || '—') + '</td><td>' + (c.ok ? '<span class="cc-tag ok">OK</span>' : '<span class="cc-tag bad">PROBLEM</span>') + '</td></tr>').join('');
  CC.page('❤️ System Health', 'Komponenten-Check auf einen Blick — Stand: ' + new Date(d.checkedAt).toLocaleString('de-DE') + '.',
    '<div class="cc-tablewrap" style="overflow-x:auto"><table class="cc-table"><thead><tr><th></th><th>Komponente</th><th>Detail</th><th>Status</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
    '<div class="cc-btnrow" style="margin-top:12px"><button class="cc-btn sm" onclick="CC.reload()">↻ Neu prüfen</button></div>'
  );
}, { perms: ['system.view'] });

/* ── Menü-Eintrag (wird beim Laden automatisch registriert) ───── */
(function () {
  const prog = CC.menu.find((m) => m.sec === '⭐ PROGRESSION & ÖKONOMIE');
  if (!prog) {
    const usersSec = CC.menu.find((m) => m.sec && m.sec.startsWith('👥'));
    const idx = usersSec ? CC.menu.indexOf(usersSec) : CC.menu.length;
    CC.menu.splice(idx, 0, {
      sec: '⭐ PROGRESSION & ÖKONOMIE',
      items: [
        { id: 'xp', ico: '⭐', label: 'XP & Level', perms: ['xp.view'] },
        { id: 'economy', ico: '💰', label: 'Economy', perms: ['economy.view'] },
        { id: 'games', ico: '🎮', label: 'Games', perms: ['games.view'] }
      ]
    });
  }
  const sysSec = CC.menu.find((m) => m.sec && m.sec.startsWith('⚙ SYSTEM'));
  if (sysSec && !sysSec.items.find((i) => i.id === 'health')) {
    sysSec.items.push({ id: 'health', ico: '❤️', label: 'System Health', perms: ['system.view'] });
  }
})();

/* ═══ LIVE-FEED-Helper (wird vom Dashboard genutzt) ════════════ */
const EV_META = {
  XP_GRANTED: ['⭐', 'xp'], LEVEL_UP: ['📈', 'lvl'], PRESTIGE_UP: ['💎', 'prestige'],
  COINS_EARNED: ['🪙', 'coins'], GAME_WIN: ['🏆', 'game'], GAME_LOSS: ['🎲', 'game'],
  ACHIEVEMENT_UNLOCKED: ['🏅', 'ach'], XP_ADJUSTED: ['👑', 'admin'],
  USER_BANNED: ['⛔', 'sec'], LOGIN_FAILED: ['🔑', 'sec'],
  MAINTENANCE_ON: ['🛠', 'sys'], MAINTENANCE_OFF: ['🛠', 'sys'], SESSION_EVENT: ['📡', 'sys']
};

CC.liveEventHtml = (e) => {
  const m = EV_META[e.type] || ['📌', 'misc'];
  const d = e.data || {};
  const who = d.name ? esc(d.name) : (d.bid ? '<span class="cc-key">' + esc(String(d.bid).slice(0, 16)) + '…</span>' : '—');
  let txt = '';
  switch (e.type) {
    case 'XP_GRANTED': txt = '+' + Number(d.granted || 0).toLocaleString('de-DE') + ' XP ' + (d.source ? '(' + esc(d.source) + ')' : ''); break;
    case 'LEVEL_UP': txt = '→ Level ' + d.level; break;
    case 'PRESTIGE_UP': txt = '→ Prestige ' + d.prestige + ' 💎'; break;
    case 'COINS_EARNED': txt = '+' + Number(d.granted || 0).toLocaleString('de-DE') + ' Kupfer'; break;
    case 'GAME_WIN': txt = 'Sieg im Spiel'; break;
    case 'GAME_LOSS': txt = 'Niederlage im Spiel'; break;
    case 'ACHIEVEMENT_UNLOCKED': txt = '🏅 ' + esc(d.item || 'Achievement'); break;
    case 'XP_ADJUSTED': txt = (d.delta > 0 ? '+' : '') + Number(d.delta || 0).toLocaleString('de-DE') + ' XP (Owner)'; break;
    default: txt = esc(e.type);
  }
  const ts = new Date(e.ts).toLocaleTimeString('de-DE');
  return '<div class="cc-event"><div class="ev-ico">' + m[0] + '</div><div class="ev-main"><div class="ev-t">' + who + '</div><div class="ev-s">' + txt + '</div></div><div class="ev-time">' + ts + '</div></div>';
};

/** Startet/stoppt den Live-Event-Feed auf einem DOM-Element (SSE). */
CC.startLiveFeed = (elId, limit) => {
  const el = document.getElementById(elId);
  if (!el) return;
  if (CC._liveEs) { try { CC._liveEs.close(); } catch (e) {} CC._liveEs = null; }
  let es;
  try { es = new EventSource('/api/live'); } catch (e) { el.innerHTML = '<div class="cc-empty">Live-Feed nicht verfügbar.</div>'; return; }
  CC._liveEs = es;
  el.innerHTML = '<div class="cc-empty">Warte auf Events …</div>';
  es.onmessage = (m) => {
    try {
      const p = JSON.parse(m.data);
      const evs = (p.events || []).slice(0, limit || 8);
      if (!evs.length) { el.innerHTML = '<div class="cc-empty">Noch keine Events — sobald Nutzer XP, Games oder Achievements erhalten, erscheint das hier live.</div>'; return; }
      el.innerHTML = '<div class="cc-feed">' + evs.map(CC.liveEventHtml).join('') + '</div>';
    } catch (e) {}
  };
};
CC.stopLiveFeed = () => { if (CC._liveEs) { try { CC._liveEs.close(); } catch (e) {} CC._liveEs = null; } };

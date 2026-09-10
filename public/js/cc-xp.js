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
  terminal: '🖥️ Terminal', other: 'Sonstiges'
};

/* ═══  XP & LEVEL ═══ */
CC.reg('xp', async () => {
  const d = await api('/api/xp').catch(() => null);
  if (!d || !d.ok) { CC.viewErr('Keine Berechtigung für XP & Level (xp.view).'); return; }
  const st = d.stats || {};
  const canAdjust = CC.can('xp.adjust');

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
    '</div>'
  , { after: () => {
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
  CC.page('💰 Economy', 'Love-Ökonomie im Überblick — Werte kommen aus dem gemeinsamen Datenmodell (eine Quelle für WhatsApp &amp; Website).',
    '<div class="cc-statgrid">' +
      '<div class="cc-stat"><div class="ic">🪙</div><div class="num">' + Number(t.copper || 0).toLocaleString('de-DE') + '</div><div class="lab">Kupfer gesamt (alle Wallets)</div></div>' +
      '<div class="cc-stat"><div class="ic">💞</div><div class="num">' + (t.couples ?? 0) + '</div><div class="lab">Paare aktiv</div></div>' +
      '<div class="cc-stat"><div class="ic">❤️</div><div class="num">' + Number(t.loveXp || 0).toLocaleString('de-DE') + '</div><div class="lab">Paar-XP gesamt</div></div>' +
      '<div class="cc-stat"><div class="ic">🐾</div><div class="num">' + (t.pets ?? 0) + '</div><div class="lab">Pets in Besitz</div></div>' +
    '</div><br>' +
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

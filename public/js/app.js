/* LoveBot — Admin-Panel (alle Dashboard-Seiten, CDE-Style) */
if (!guardApp()) throw new Error('redirect');
const PAGE = document.body.dataset.page || 'dashboard';
makeHearts(10);
buildSidebar(PAGE);

/* Nur Owner darf in die Verwaltungs-Seiten */
const OWNER_PAGES = ['owners', 'groups', 'badwords', 'bans', 'broadcast', 'logs', 'session', 'settings'];
if (getRole() !== 'owner' && OWNER_PAGES.includes(PAGE)) {
  location.replace('/dashboard.html');
  throw new Error('redirect');
}

function setMsg(id, text, type) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.className = 'msg ' + type;
}
const view = document.getElementById('view');

/* ═══════════ ÜBERSICHT (LovePlus-Style Dashboard) ═══════════ */
async function loadOverview(target) {
  const el = target || view;
  el.innerHTML =
    '<div class="ov-hero" id="ovHero">' +
      '<div class="ov-hero-left">' +
        '<div class="ov-hero-brand">💜 LoveBot <span class="pill on" id="heroPill">🟢 …</span></div>' +
        '<div class="ov-hero-hi" id="ovHi">Willkommen zurück 👋</div>' +
        '<div class="ov-hero-sub" id="ovSub">Alles live aus deiner Bot-Datenbank &amp; dem Heartbeat — kein Mock.</div>' +
        '<div class="ov-hero-by">💜 LoveBot by Maxichen 2026 · maxichen.gamebot.me · maxichen.de</div>' +
      '</div>' +
      '<div class="ov-hero-right">' +
        '<a class="btn ghost sm" href="/cmd.html">📜 Befehle</a>' +
        '<a class="btn ghost sm" href="/statistics.html">📊 Statistiken</a>' +
        '<a class="btn ghost sm" href="https://maxichen.gamebot.me" target="_blank" rel="noopener">🔗 gamebot.me</a>' +
      '</div>' +
    '</div>' +
    '<div class="quick-grid">' +
    '<a class="quick-btn" href="/cmd.html"><span class="qi">📜</span>Alle Befehle</a>' +
    '<a class="quick-btn" href="/statistics.html"><span class="qi">📊</span>Statistiken</a>' +
    '<a class="quick-btn" href="/leaderboard.html"><span class="qi">🏆</span>Bestenliste</a>' +
    '<a class="quick-btn" href="/status.html"><span class="qi">📡</span>Live-Status</a>' +
    (getRole() === 'owner' ? '<a class="quick-btn" href="/broadcast.html"><span class="qi">📢</span>Broadcast</a><a class="quick-btn" href="/groups.html"><span class="qi">👥</span>Gruppen</a>' : '<a class="quick-btn" href="/profiles.html"><span class="qi">👤</span>Mein Profil</a>') +
    '</div>' +
    '<div class="grid">' +
    '<div class="stat" id="botStat"><div class="ico">🤖</div><div class="num" id="botOnline">…</div><div class="lbl">Bot-Status</div></div>' +
    '<div class="stat"><div class="ico">👤</div><div class="num" id="statUsers">…</div><div class="lbl">Registrierte Nutzer</div></div>' +
    '<div class="stat"><div class="ico">👥</div><div class="num" id="statGroups">…</div><div class="lbl">Gruppen</div></div>' +
    '<div class="stat"><div class="ico">🚫</div><div class="num" id="statBans">…</div><div class="lbl">Bans</div></div>' +
    '<div class="stat"><div class="ico">⚡</div><div class="num" id="statCmds">…</div><div class="lbl">Befehle im Bot</div></div>' +
    '<div class="stat"><div class="ico">🧠</div><div class="num" id="statRam">…</div><div class="lbl">Bot-RAM</div></div>' +
    '<div class="stat"><div class="ico">💞</div><div class="num" id="statCouples">…</div><div class="lbl">Verliebte Paare</div></div>' +
    '<div class="stat"><div class="ico">💗</div><div class="num" id="statLoveXp">…</div><div class="lbl">Love-XP gesamt</div></div>' +
    '<div class="stat"><div class="ico">🐶</div><div class="num" id="statPets">…</div><div class="lbl">Haustiere</div></div>' +
    '<div class="stat"><div class="ico">🏆</div><div class="num" id="statAch">…</div><div class="lbl">Achievements freigeschaltet</div></div>' +
    '<div class="stat"><div class="ico">👑</div><div class="num" id="statOwners">…</div><div class="lbl">Zusatz-Owner</div></div>' +
    '<div class="stat"><div class="ico">📡</div><div class="num" id="statFleet">…</div><div class="lbl">Aktive Sessions</div></div>' +
    '</div>' +
    '<section class="glass-system" aria-labelledby="glassSystemTitle">' +
      '<div class="glass-system-head"><div><div class="glass-kicker">LIVE SNAPSHOT</div><h2 id="glassSystemTitle">✦ System status</h2></div><span class="pill" id="glassSystemPill">⚪ UNKNOWN</span></div>' +
      '<div class="glass-system-grid">' +
        '<div class="glass-metric"><span>CPU</span><strong id="glassCpu">—</strong></div>' +
        '<div class="glass-metric"><span>RSS</span><strong id="glassRam">—</strong></div>' +
        '<div class="glass-metric"><span>HEAP</span><strong id="glassHeap">—</strong></div>' +
        '<div class="glass-metric"><span>UPTIME</span><strong id="glassUptime">—</strong></div>' +
      '</div>' +
      '<div class="glass-system-foot"><span id="glassRuntime">Node — · —</span><span id="glassSessions">Sessions —</span></div>' +
    '</section>' +
    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px">' +
    '<div class="box"><h3>🤖 Bot-Info (live vom Heartbeat)</h3><div id="botInfo" class="kv"></div></div>' +
    '<div class="box"><h3>🏆 Top-Paare (Love-XP)</h3><div id="topCouples" class="kv"></div>' +
    '<p class="desc" style="margin-top:10px">Anonymisierte Bestenliste — Namen wie im Chat sichtbar, keine Nummern.</p></div>' +
    '</div>' +
    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px;margin-top:16px">' +
    '<div class="box"><h3>📅 Aktivität der letzten 14 Tage</h3><div class="mini-act" id="miniAct"></div></div>' +
    '<div class="box"><h3>🔥 Meistgenutzte Befehle</h3><div class="mini-cmdbar" id="miniCmds"></div></div>' +
    '</div>' +
    '<div class="box" style="margin-top:16px"><h3>🔗 LoveBot überall erreichbar</h3>' +
    '<div class="kv">' +
    '<div class="k">Website</div><div class="v"><a href="https://maxichen.de" target="_blank" rel="noopener">maxichen.de</a></div>' +
    '<div class="k">Dashboard</div><div class="v"><a href="https://maxichen.gamebot.me" target="_blank" rel="noopener">maxichen.gamebot.me</a></div>' +
    '<div class="k">Version</div><div class="v">💜 LoveBot by Maxichen 2026</div>' +
    '</div></div>';
  await refreshOverview();
}
async function refreshOverview() {
  const [stats, system] = await Promise.all([api('/api/stats'), api('/api/system')]);
  if (!stats) return;
  const hb = stats.heartbeat || {};
  const fresh = hb.time && Date.now() - new Date(hb.time).getTime() < 40000;
  const online = hb.online === true && fresh;
  const lp = stats.loveplus || {};
  const cmdStats = stats.commandStats || stats.commands || {};
  const fleet = stats.fleet || {};

  document.getElementById('botStat').className = 'stat ' + (online ? 'online' : 'offline');
  document.getElementById('botOnline').textContent = online ? '🟢 Online' : '🔴 Offline';
  const heroPill = document.getElementById('heroPill');
  if (heroPill) { heroPill.textContent = online ? '🟢 Online' : '🔴 Offline'; heroPill.className = 'pill ' + (online ? 'on' : 'off'); }
  const hr = new Date().getHours();
  const greet = hr < 5 ? 'Gute Nacht' : hr < 11 ? 'Guten Morgen' : hr < 18 ? 'Guten Tag' : 'Guten Abend';
  const ovHi = document.getElementById('ovHi');
  if (ovHi) ovHi.textContent = greet + ', ' + (getName() || 'Nutzer') + ' 👋';
  const ovSub = document.getElementById('ovSub');
  if (ovSub && cmdStats.commands != null) ovSub.innerHTML = 'Alles live aus deiner Bot-Datenbank &amp; dem Heartbeat — kein Mock. ' + cmdStats.commands + '+ Befehle, ein Herz. 💜';

  document.getElementById('statUsers').textContent = stats.users;
  document.getElementById('statGroups').textContent = stats.groups;
  document.getElementById('statBans').textContent = stats.bans;
  document.getElementById('statOwners').textContent = stats.owners;
  document.getElementById('statRam').textContent = hb.ramMb ? hb.ramMb + ' MB' : '—';
  document.getElementById('statCmds').textContent = cmdStats.commands != null ? cmdStats.commands + '+' : '—';
  document.getElementById('statCouples').textContent = lp.couples ?? '—';
  document.getElementById('statLoveXp').textContent = (lp.loveXpTotal ?? 0).toLocaleString('de-DE');
  document.getElementById('statPets').textContent = lp.pets ?? '—';
  document.getElementById('statAch').textContent = lp.achievementsUnlocked ?? '—';
  document.getElementById('statFleet').textContent = fleet.running != null ? fleet.running + '/' + (fleet.managed ?? '—') : '—';

  const sysOk = system && system.ok;
  const setValue = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value == null ? '—' : value; };
  const compactUptime = (seconds) => {
    if (!Number.isFinite(Number(seconds))) return '—';
    const total = Math.max(0, Math.floor(Number(seconds)));
    const d = Math.floor(total / 86400), h = Math.floor((total % 86400) / 3600), m = Math.floor((total % 3600) / 60);
    return d ? d + 'd ' + h + 'h' : h ? h + 'h ' + m + 'm' : m + 'm';
  };
  setValue('glassCpu', sysOk && system.cpu != null ? system.cpu + ' %' : 'UNKNOWN');
  setValue('glassRam', sysOk && system.ramMb != null ? system.ramMb + ' MB' : 'UNKNOWN');
  setValue('glassHeap', sysOk && system.heapMb != null ? system.heapMb + ' MB' : 'UNKNOWN');
  setValue('glassUptime', sysOk ? compactUptime(system.uptimeSec) : 'UNKNOWN');
  setValue('glassRuntime', sysOk ? 'Node ' + (system.node || 'UNKNOWN') + ' · ' + (system.platform || 'UNKNOWN') + '/' + (system.arch || 'UNKNOWN') : 'Runtime UNKNOWN');
  setValue('glassSessions', 'Sessions ' + (sysOk && system.sessions != null ? system.sessions : 'UNKNOWN'));
  const systemPill = document.getElementById('glassSystemPill');
  if (systemPill) { systemPill.textContent = sysOk ? '🟢 LIVE' : '⚪ UNKNOWN'; systemPill.className = 'pill ' + (sysOk ? 'on' : 'unknown'); }

  document.getElementById('botInfo').innerHTML =
    '<div class="k">JID</div><div class="v">' + esc(hb.jid || '—') + '</div>' +
    '<div class="k">LID</div><div class="v">' + esc(hb.lid || '—') + '</div>' +
    '<div class="k">Uptime</div><div class="v">' + (hb.uptimeSec ? Math.floor(hb.uptimeSec / 3600) + ' Std. ' + Math.floor((hb.uptimeSec % 3600) / 60) + ' Min.' : '—') + '</div>' +
    '<div class="k">Node</div><div class="v">' + esc(hb.node || '—') + '</div>' +
    '<div class="k">Letzter Heartbeat</div><div class="v">' + (hb.time ? new Date(hb.time).toLocaleString('de-DE') : '—') + '</div>';

  const tc = lp.topCouples || [];
  document.getElementById('topCouples').innerHTML = tc.length
    ? tc.map((c, i) => '<div class="k">#' + (i + 1) + '</div><div class="v">💞 ' + esc(c.n1) + ' &amp; ' + esc(c.n2) + ' — ' + Number(c.loveXp).toLocaleString('de-DE') + ' XP (Lv. ' + c.level + ')</div>').join('')
    : '<div class="k">—</div><div class="v">Noch keine Paare registriert.</div>';

  /* Aktivitäts-Chart + Top-Befehle stammen aus der öffentlichen Statistik-API,
     da sie global (nicht pro Nutzer) getrackt werden. */
  const publicStats = await api('/api/statistics');
  const actEl = document.getElementById('miniAct');
  if (actEl) {
    const activity = (publicStats && publicStats.activity14d) || [];
    if (activity.length) {
      const maxA = Math.max(1, ...activity.map((a) => a.total));
      actEl.innerHTML = activity.map((a) => {
        const h = Math.max(3, Math.round((a.total / maxA) * 56));
        const d = new Date(a.date);
        const lbl = d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
        return '<div class="bar" style="height:' + h + 'px" title="' + lbl + ': ' + a.total + ' Befehle"></div>';
      }).join('');
    } else {
      actEl.innerHTML = '<p class="hint" style="margin:0">Noch keine Aktivität erfasst.</p>';
    }
  }
  const cmdsEl = document.getElementById('miniCmds');
  if (cmdsEl) {
    const top = (publicStats && publicStats.commandUsage && publicStats.commandUsage.top) || [];
    if (top.length) {
      const maxC = Math.max(...top.map((t) => t.count));
      cmdsEl.innerHTML = top.slice(0, 6).map((t) =>
        '<div class="row"><div class="nm">$' + esc(t.name) + '</div>' +
        '<div class="track"><div class="fill" style="width:' + Math.max(4, Math.round((t.count / maxC) * 100)) + '%"></div></div>' +
        '<div class="ct">' + t.count + '</div></div>'
      ).join('');
    } else {
      cmdsEl.innerHTML = '<p class="hint" style="margin:0">Noch keine Befehlsaufrufe seit dem letzten Neustart.</p>';
    }
  }
}

/* ═══════════ SESSION ═══════════ */
async function loadSession() {
  view.innerHTML = '<div class="box"><h3>📡 WhatsApp-Session (aus Sessions/creds.json)</h3><div id="sessInfo" class="kv">Lade …</div></div>' +
    '<div class="box"><h3>💡 Hinweis</h3><p class="desc" style="margin:0;font-size:13px">Die Session gehört zum LoveBot-Prozess (Love.js). Hier siehst du die echten Verbindungs-Daten — keine Fake-Infos.</p></div>';
  const s = await api('/api/session');
  const el = document.getElementById('sessInfo');
  if (!s || !s.found) { el.innerHTML = '<div class="k">Status</div><div class="v">❌ Keine creds.json gefunden.</div>'; return; }
  el.innerHTML =
    '<div class="k">Registriert</div><div class="v">' + (s.registered ? '✅ Ja' : '⏳ Noch nicht registriert') + '</div>' +
    '<div class="k">JID</div><div class="v">' + esc(s.jid || '—') + '</div>' +
    '<div class="k">LID</div><div class="v">' + esc(s.lid || '—') + '</div>' +
    '<div class="k">Plattform</div><div class="v">' + esc(s.platform || 'Android') + '</div>' +
    '<div class="k">Noise-Key</div><div class="v">' + (s.noiseKey ? '🔐 vorhanden' : '❌ fehlt') + '</div>';
}

/* ═══════════ EINSTELLUNGEN ═══════════ */
async function loadSettings() {
  view.innerHTML = '<div class="box"><h3>⚙️ Bot-Konfiguration</h3><div id="cfgInfo" class="kv">Lade …</div></div>';
  const site = await api('/api/siteinfo');
  const el = document.getElementById('cfgInfo');
  if (!site) { el.innerHTML = '<div class="k">Fehler</div><div class="v">Server antwortet nicht.</div>'; return; }
  el.innerHTML =
    '<div class="k">Bot-Name</div><div class="v">' + esc(site.name) + ' by ' + esc(site.by) + '</div>' +
    '<div class="k">Präfix</div><div class="v">' + esc(site.prefix) + '</div>' +
    '<div class="k">Owner-JID</div><div class="v">' + esc(site.ownerJid) + '</div>' +
    '<div class="k">Owner-LID</div><div class="v">' + esc(site.ownerLid) + '</div>' +
    '<div class="k">Website</div><div class="v">' + esc(site.links.website) + '</div>' +
    '<div class="k">GitHub</div><div class="v">' + esc(site.links.github) + '</div>' +
    '<div class="k">Dev-Gruppe</div><div class="v">' + esc(site.links.devgroup) + '</div>' +
    '<div class="k">Kanal</div><div class="v">' + esc(site.links.channel) + '</div>';
}

/* ═══════════ OWNER ═══════════ */
async function loadOwners() {
  view.innerHTML =
    '<div class="box"><h3>👑 Owner hinzufügen</h3><p class="desc">Eingetragene Owner bekommen überall Owner-Rechte im Bot (wie $addowner).</p>' +
    '<div class="row"><input id="ownerName" placeholder="Name (z. B. Freundin)"><input id="ownerJid" placeholder="JID: 49123…@s.whatsapp.net"><input id="ownerLid" placeholder="LID (optional)"><button class="btn" onclick="addOwner()">➕ Eintragen</button></div>' +
    '<div class="msg" id="ownerMsg"></div></div>' +
    '<div class="box"><h3>👥 Eingetragene Zusatz-Owner</h3><table><thead><tr><th>Name</th><th>JID</th><th>LID</th><th>Seit</th><th></th></tr></thead><tbody id="ownerTable"></tbody></table></div>';
  await refreshOwners();
}
async function refreshOwners() {
  const data = await api('/api/owners');
  if (!data) return;
  document.getElementById('ownerTable').innerHTML = data.owners.length
    ? data.owners.map((o) => '<tr><td><b>' + esc(o.name) + '</b></td><td class="mono">' + esc(o.jid) + '</td><td class="mono">' + esc(o.lid || '—') + '</td><td>' + (o.addedAt ? new Date(o.addedAt).toLocaleDateString('de-DE') : '—') + '</td><td><button class="mini danger" onclick="removeOwner(\'' + esc(o.jid) + '\')">🗑️</button></td></tr>').join('')
    : '<tr><td colspan="5" style="color:var(--muted)">Noch keine Zusatz-Owner.</td></tr>';
}
async function addOwner() {
  const name = document.getElementById('ownerName').value.trim();
  const jid = document.getElementById('ownerJid').value.trim();
  const lid = document.getElementById('ownerLid').value.trim();
  const r = await api('/api/owners/add', { method: 'POST', body: { name, jid, lid } });
  if (r && r.ok) {
    setMsg('ownerMsg', '👑 Owner „' + name + '“ eingetragen!', 'ok');
    document.getElementById('ownerName').value = '';
    document.getElementById('ownerJid').value = '';
    document.getElementById('ownerLid').value = '';
    refreshOwners();
  } else setMsg('ownerMsg', (r && r.error) || 'Fehler.', 'error');
}
async function removeOwner(jid) {
  await api('/api/owners/remove', { method: 'POST', body: { jid } });
  refreshOwners();
}

/* ═══════════ GRUPPEN ═══════════ */
async function loadGroups() {
  view.innerHTML = '<div class="box"><h3>👥 Gruppen & Feature-Toggles</h3><p class="desc">Gleiche Schalter wie $an / $aus im Chat — Änderungen wirken sofort.</p>' +
    '<table><thead><tr><th>Gruppe</th><th>Aktiv</th><th>Auto-DL</th><th>Welcome</th><th>Goodbye</th><th>Badwords</th><th>Anti-Link</th></tr></thead><tbody id="groupTable"></tbody></table></div>';
  await refreshGroups();
}
async function refreshGroups() {
  const data = await api('/api/groups');
  if (!data) return;
  document.getElementById('groupTable').innerHTML = data.groups.length
    ? data.groups.map((g) => '<tr><td><b>' + esc(g.subject) + '</b><br><span style="font-size:10px;color:var(--muted)">' + esc(g.id) + '</span></td>' +
      ['active', 'autodl', 'welcome', 'goodbye', 'badwords', 'antilink'].map((k) =>
        '<td><button class="mini ' + (g[k] ? 'on' : '') + '" onclick="toggleGroup(\'' + esc(g.id) + '\',\'' + k + '\',' + !g[k] + ')">' + (g[k] ? 'AN' : 'AUS') + '</button></td>').join('') + '</tr>').join('')
    : '<tr><td colspan="7" style="color:var(--muted)">Keine Gruppen in der Datenbank.</td></tr>';
}
async function toggleGroup(gid, key, on) {
  await api('/api/groups/toggle', { method: 'POST', body: { gid, key, on } });
  refreshGroups();
}

/* ═══════════ BADWORDS ═══════════ */
let bwEnabled = true;
async function loadBadwords() {
  view.innerHTML =
    '<div class="box"><h3>🤬 Filter global</h3><button class="mini" id="bwToggle" onclick="toggleBadwords()">…</button></div>' +
    '<div class="box"><h3>➕ Wort hinzufügen</h3><div class="row"><input id="bwWord" placeholder="neues Schimpfwort …"><button class="btn" onclick="addBadword()">Hinzufügen</button></div><div class="msg" id="bwMsg"></div></div>' +
    '<div class="box"><h3>📃 Zusätzliche Wörter</h3><p class="desc">Die Standard-Liste liegt in badwords.js — hier sind nur die Ergänzungen.</p><table><thead><tr><th>Wort</th><th></th></tr></thead><tbody id="bwTable"></tbody></table></div>';
  await refreshBadwords();
}
async function refreshBadwords() {
  const data = await api('/api/badwords');
  if (!data) return;
  bwEnabled = data.enabled;
  const btn = document.getElementById('bwToggle');
  btn.textContent = bwEnabled ? '✅ Filter AN — klicken zum Ausschalten' : '❌ Filter AUS — klicken zum Einschalten';
  btn.className = 'mini ' + (bwEnabled ? 'on' : '');
  document.getElementById('bwTable').innerHTML = data.added.length
    ? data.added.map((w) => '<tr><td>' + esc(w) + '</td><td><button class="mini danger" onclick="removeBadword(\'' + esc(w) + '\')">🗑️</button></td></tr>').join('')
    : '<tr><td colspan="2" style="color:var(--muted)">Keine Ergänzungen — nur badwords.js-Standardliste aktiv.</td></tr>';
}
async function toggleBadwords() {
  await api('/api/badwords/toggle', { method: 'POST', body: { enabled: !bwEnabled } });
  refreshBadwords();
}
async function addBadword() {
  const word = document.getElementById('bwWord').value.trim();
  const r = await api('/api/badwords/add', { method: 'POST', body: { word } });
  if (r && r.ok) {
    setMsg('bwMsg', '🤬 „' + word + '“ hinzugefügt.', 'ok');
    document.getElementById('bwWord').value = '';
    refreshBadwords();
  } else setMsg('bwMsg', (r && r.error) || 'Fehler.', 'error');
}
async function removeBadword(word) {
  await api('/api/badwords/remove', { method: 'POST', body: { word } });
  refreshBadwords();
}

/* ═══════════ BANS ═══════════ */
async function loadBans() {
  view.innerHTML = '<div class="box"><h3>🚫 Nutzer bannen</h3><div class="row"><input id="banTarget" placeholder="JID, LID oder Nummer"><input id="banReason" placeholder="Grund"><button class="btn" onclick="banUserFromDashboard()">🚫 Bannen</button></div><div class="msg" id="banMsg"></div></div>' +
    '<div class="box"><h3>🚫 Gebannte Nutzer</h3><p class="desc">Gebannte können sich auch nicht mehr im Dashboard einloggen.</p>' +
    '<table><thead><tr><th>ID</th><th>JID</th><th>Grund</th><th>Gebannt von</th><th></th></tr></thead><tbody id="banTable"></tbody></table></div>';
  await refreshBans();
}
async function refreshBans() {
  const data = await api('/api/bans');
  if (!data) return;
  document.getElementById('banTable').innerHTML = data.bans.length
    ? data.bans.map((b) => '<tr><td class="mono">' + esc(b.key) + '</td><td class="mono">' + esc(b.jid || '—') + '</td><td>' + esc(b.reason || '—') + '</td><td>' + esc(b.bannedByName || 'Automod') + '</td><td><button class="mini" onclick="unban(\'' + esc(b.key) + '\')">Entbannen</button></td></tr>').join('')
    : '<tr><td colspan="5" style="color:var(--muted)">Niemand ist gebannt. 💜</td></tr>';
}
async function banUserFromDashboard() {
  const jid = document.getElementById('banTarget').value.trim();
  const reason = document.getElementById('banReason').value.trim();
  const r = await api('/api/bans/ban', { method: 'POST', body: { jid, reason } });
  if (r && r.ok) {
    setMsg('banMsg', '📤 Ban wird in alle Gruppen gesendet …', 'info');
    document.getElementById('banTarget').value = '';
    document.getElementById('banReason').value = '';
    refreshBans();
  } else setMsg('banMsg', (r && r.error) || 'Fehler.', 'error');
}
async function unban(key) {
  const reason = window.prompt('Grund für den Unban (optional):', 'Ban aufgehoben') || 'Ban aufgehoben';
  await api('/api/bans/unban', { method: 'POST', body: { key, reason } });
  refreshBans();
}

/* ═══════════ BROADCAST ═══════════ */
async function loadBroadcast() {
  view.innerHTML = '<div class="box"><h3>📢 Broadcast an alle Gruppen</h3><p class="desc">Der Text wird über den laufenden Bot in ALLE Gruppen gesendet.</p>' +
    '<textarea id="bcText" placeholder="Nachricht an alle Gruppen …" style="min-height:120px"></textarea>' +
    '<button class="btn" onclick="sendBroadcast()" style="margin-top:12px">📢 Senden</button><div class="msg" id="bcMsg"></div></div>';
}
async function sendBroadcast() {
  const text = document.getElementById('bcText').value.trim();
  if (!text) return setMsg('bcMsg', 'Text fehlt.', 'error');
  const r = await api('/api/broadcast', { method: 'POST', body: { text } });
  if (r && r.ok) {
    setMsg('bcMsg', '📤 Wird über den Bot versendet …', 'info');
    for (let i = 0; i < 40; i++) {
      await new Promise((res) => setTimeout(res, 3000));
      const st = await fetch('/api/mailbox/' + r.mailboxId).then((x) => x.json());
      if (st.status === 'sent') {
        setMsg('bcMsg', '✅ Gesendet! ' + (st.result ? st.result.sent + '/' + st.result.total + ' Gruppen' + (st.result.failed ? ' · ' + st.result.failed + ' fehlgeschlagen' : '') : ''), 'ok');
        document.getElementById('bcText').value = '';
        return;
      }
      if (st.status === 'error') return setMsg('bcMsg', '❌ ' + (st.error || 'Fehler'), 'error');
    }
    setMsg('bcMsg', '⏳ Läuft noch (viele Gruppen brauchen Zeit).', 'info');
  } else setMsg('bcMsg', (r && r.error) || 'Fehler.', 'error');
}

/* ═══════════ PROFILE ═══════════ */
async function loadProfiles() {
  view.innerHTML =
    '<div class="box"><div class="row"><input id="profileSearch" placeholder="🔎 Suche: Name oder Nummer …" oninput="refreshProfiles()"></div></div>' +
    '<div class="box"><h3>👤 LoveBot-Profile</h3><table><thead><tr><th>Name</th><th>BID</th><th>Level</th><th>Liebe</th><th>Wallet</th></tr></thead><tbody id="profileTable"></tbody></table></div>';
  await refreshProfiles();
}
async function refreshProfiles() {
  const q = document.getElementById('profileSearch')?.value || '';
  const data = await api('/api/profiles?search=' + encodeURIComponent(q));
  if (!data) return;
  document.getElementById('profileTable').innerHTML = data.profiles.length
    ? data.profiles.map((p) => '<tr><td><b>' + esc(p.name) + '</b></td><td class="mono">' + esc(p.bid) + '</td><td>Lv. ' + p.level + '</td><td>' + (p.married ? '💍 ' + esc(p.spouse || '') : '🕊️ Single') + '</td><td style="font-size:12px">🤎' + (p.wallet.copper || 0) + ' 🩶' + (p.wallet.silver || 0) + ' 💛' + (p.wallet.gold || 0) + '</td></tr>').join('')
    : '<tr><td colspan="5" style="color:var(--muted)">Keine Profile gefunden.</td></tr>';
}

/* ═══════════ LOGS ═══════════ */
async function loadLogs() {
  view.innerHTML = '<div class="box"><h3>📜 Bot-Logs (Logs/lovebot.log)</h3><pre class="logs" id="logView">Lade …</pre></div><button class="mini" onclick="refreshLogs()">🔄 Aktualisieren</button>';
  await refreshLogs();
}
async function refreshLogs() {
  const data = await api('/api/logs');
  const lines = data && Array.isArray(data.lines) ? data.lines : [];
  document.getElementById('logView').textContent = lines.length
    ? lines.map((line) => '[' + (line.time || '') + '] [' + (line.tag || 'info') + '] ' + (line.text || '')).join('\n')
    : 'Keine Logs.';
}

/* ═══════════ Dashboard mit Tabs (7.1.4): Übersicht · Tickets · Team ═══════════ */
let dashTab = 'ov';
let dashTkFilter = 'open';

async function initDashboard() {
  const role = getRole();
  const isTeam = ['owner', 'deputy', 'admin', 'supporter'].includes(role);
  const tabs = [['ov', '📊 Übersicht']];
  if (isTeam) tabs.push(['tk', '🎫 Tickets']);
  if (role === 'owner') tabs.push(['team', '🏅 Team & Ränge']);
  view.innerHTML =
    '<div class="ai-chips" id="dashTabs" style="margin-bottom:14px">' +
    tabs.map(([id, label]) => '<button class="ai-chip' + (id === dashTab ? ' on' : '') + '" data-tab="' + id + '">' + label + '</button>').join('') +
    '</div>' +
    '<div id="pane-ov"></div>' +
    '<div id="pane-tk" style="display:none"></div>' +
    '<div id="pane-team" style="display:none"></div>';
  document.querySelectorAll('#dashTabs .ai-chip').forEach((b) => b.addEventListener('click', () => {
    dashTab = b.dataset.tab;
    document.querySelectorAll('#dashTabs .ai-chip').forEach((x) => x.classList.remove('on'));
    b.classList.add('on');
    ['ov', 'tk', 'team'].forEach((t) => {
      const pane = document.getElementById('pane-' + t);
      if (pane) pane.style.display = t === dashTab ? '' : 'none';
    });
    if (dashTab === 'tk') loadDashTickets();
    if (dashTab === 'team') loadDashTeam();
  }));
  await loadOverview(document.getElementById('pane-ov'));
  if (dashTab === 'tk') loadDashTickets();
  if (dashTab === 'team') loadDashTeam();
}

/* 🎫 Tickets-Tab (Team) — 7.1.7 Design-Polish */
const DASH_ROLE_COLORS = { owner: '#fbbf24', deputy: '#22d3ee', admin: '#a855f7', supporter: '#f472b6', user: '#94a3b8' };
function dashRolePill(role) {
  const r = String(role || '').toLowerCase();
  const c = DASH_ROLE_COLORS[r] || '#94a3b8';
  return '<span style="font-size:9px;letter-spacing:1px;text-transform:uppercase;font-weight:700;color:' + c + ';border:1px solid ' + c + '55;background:' + c + '14;padding:2px 8px;border-radius:999px">' + esc(r || 'team') + '</span>';
}
function dashAgo(iso) {
  if (!iso) return '—';
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'gerade eben';
  if (s < 3600) return 'vor ' + Math.floor(s / 60) + ' Min';
  if (s < 86400) return 'vor ' + Math.floor(s / 3600) + ' Std';
  return 'vor ' + Math.floor(s / 86400) + ' Tagen';
}
function dashInitials(name) {
  const p = String(name || '?').replace(/[^\p{L}\p{N} ]/gu, '').trim().split(/\s+/);
  return ((p[0] || '?')[0] + (p[1] ? p[1][0] : '')).toUpperCase() || '?';
}
async function loadDashTickets() {
  const el = document.getElementById('pane-tk');
  if (!el) return;
  el.innerHTML = '<p>Lädt …</p>';
  const r = await api('/api/tickets?status=' + dashTkFilter);
  if (!r || !r.ok) {
    el.innerHTML = '<div class="panel"><p>⛔ ' + (r && r.error ? esc(r.error) : 'Tickets nicht verfügbar.') + '</p><p class="hint">Das Ticket-Center ist für das Team — Supporter · Stellv. Inhaber:in · Inhaber. Nutzer erstellen Tickets per <b>$ticket &lt;Anliegen&gt;</b>.</p></div>';
    return;
  }
  const st = r.stats || {};
  const list = r.tickets || [];
  const cards = list.map((t) => {
    const open = t.status === 'open';
    const answers = (t.answers || []).map((a) =>
      '<div style="margin:6px 0;padding:8px 12px;border-left:3px solid #f472b6;background:rgba(255,255,255,.04);border-radius:0 10px 10px 0">' +
      '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:3px"><b>' + esc(a.byName) + '</b>' + dashRolePill(a.role) +
      '<span style="opacity:.5;font-size:11px">' + esc(dashAgo(a.at)) + '</span></div>' +
      '<div style="white-space:pre-wrap;font-size:13px">' + esc(a.text) + '</div></div>').join('');
    return '<div class="panel" style="position:relative;overflow:hidden">' +
      '<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">' +
      '<div style="width:38px;height:38px;border-radius:50%;display:grid;place-items:center;font-weight:700;font-size:14px;color:#fff;background:linear-gradient(135deg,#c2186f,#a855f7);flex:0 0 auto">' + esc(dashInitials(t.creatorName)) + '</div>' +
      '<div style="flex:1;min-width:150px"><b>' + esc(t.creatorName || '–') + '</b>' +
      (t.bid ? ' <span style="opacity:.55;font-size:11px">· Liebesbote ' + esc(t.bid) + '</span>' : '') + '</div>' +
      '<span class="mono" style="font-size:11px;opacity:.7;background:rgba(255,255,255,.05);border:1px solid var(--line-2);padding:2px 9px;border-radius:7px">' + t.id + '</span>' +
      '<span class="pill ' + (open ? 'on' : '') + '">' + (open ? '🟢 offen' : '🔒 geschlossen') + '</span>' +
      '<span style="opacity:.5;font-size:11px;white-space:nowrap">🕑 ' + esc(dashAgo(t.createdAt)) + '</span></div>' +
      '<div style="margin:10px 0;padding:10px 14px;background:rgba(255,255,255,.04);border:1px solid var(--line-2);border-radius:12px;white-space:pre-wrap;font-size:13.5px;line-height:1.6">' + esc(t.text) + '</div>' +
      (answers ? '<b style="font-size:12px">💬 ' + (t.answers || []).length + ' Antworten</b>' + answers : '<div style="opacity:.5;font-size:12px;margin:4px 0">💬 noch keine Antworten</div>') +
      (!open && t.closedAt ? '<div style="font-size:11.5px;opacity:.65;margin-top:8px;padding:7px 11px;border-radius:9px;background:rgba(248,113,113,.06);border:1px solid rgba(248,113,113,.15)">🔒 geschlossen von <b>' + esc((t.closedBy && t.closedBy.name) || 'Team') + '</b>' + (t.closedReason ? ' — „' + esc(t.closedReason) + '“' : '') + ' · ' + esc(dashAgo(t.closedAt)) + '</div>' : '') +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px">' +
      (open
        ? '<div class="chatbox" style="margin:0;flex:1;min-width:220px"><input id="dta-' + t.id + '" maxlength="1500" placeholder="Antwort (wird per WhatsApp-DM zugestellt) …"><button class="btn" onclick="dashTkAnswer(\'' + t.id + '\')">➤</button></div>' +
          '<button class="btn ghost sm" onclick="dashTkAction(\'' + t.id + '\', \'close\')">🔒 Schließen</button>'
        : '<button class="btn ghost sm" onclick="dashTkAction(\'' + t.id + '\', \'reopen\')">🟢 Wieder öffnen</button>') +
      '</div></div>';
  }).join('');
  el.innerHTML =
    '<div class="stat-grid" style="margin-bottom:14px">' +
    '<div class="stat-card"><div class="t">Offen</div><div class="v">' + (st.open ?? 0) + '</div></div>' +
    '<div class="stat-card"><div class="t">Geschlossen</div><div class="v">' + (st.closed ?? 0) + '</div></div>' +
    '<div class="stat-card"><div class="t">Heute</div><div class="v">' + (st.today ?? 0) + '</div></div>' +
    '<div class="stat-card"><div class="t">Ansicht</div><div class="v" style="font-size:13px">' + (dashTkFilter === 'open' ? '🟢 offen' : dashTkFilter === 'closed' ? '🔒 geschlossen' : '📋 alle') + '</div></div>' +
    '</div>' +
    '<div class="ai-chips">' +
    [['open', '🟢 Offen'], ['closed', '🔒 Geschlossen'], ['all', '📋 Alle']].map(([f, l]) =>
      '<button class="ai-chip' + (dashTkFilter === f ? ' on' : '') + '" onclick="dashTkFilterSet(\'' + f + '\')">' + l + '</button>').join('') +
    '</div>' +
    (cards || '<div class="panel"><p>Keine Tickets in dieser Ansicht. 💜</p></div>') +
    '<p class="hint" style="margin-top:10px">🎫 Vollansicht mit Verlauf: <a href="/tickets.html">Ticket-Center</a> · als Owner auch Ränge vergeben: <a href="#" onclick="dashGoTeam();return false">Team-Tab</a></p>';
}

function dashTkFilterSet(f) { dashTkFilter = f; loadDashTickets(); }

async function dashTkAction(id, action) {
  if (action === 'close') {
    const reason = prompt('Grund (optional):') || '';
    var r = await api('/api/tickets/close', { method: 'POST', body: { id, reason } });
  } else {
    var r = await api('/api/tickets/reopen', { method: 'POST', body: { id } });
  }
  if (r && r.ok) loadDashTickets();
  else alert('Fehlgeschlagen: ' + ((r && r.error) || '?'));
}

async function dashGoTeam() {
  const b = document.querySelector('#dashTabs .ai-chip[data-tab="team"]');
  if (b) b.click();
}

async function dashTkAnswer(id) {
  const inp = document.getElementById('dta-' + id);
  if (!inp || !inp.value.trim()) return;
  const r = await api('/api/tickets/answer', { method: 'POST', body: { id, text: inp.value.trim() } });
  if (r && r.ok) loadDashTickets();
  else alert('Fehlgeschlagen: ' + ((r && r.error) || '?'));
}

/* 🏅 Team-Tab (nur Owner): Team-Verwaltung — Mitglieder anlegen + Ränge vergeben */
const DASH_ROLES = [
  ['deputy', '🔱 Stellv. Inhaber:in'],
  ['admin', '◆ Admin'],
  ['supporter', '◇ Supporter (nur Tickets)'],
  ['user', '○ User (kein Team)']
];
const DASH_ADD_ROLES = [
  ['deputy', '🔱 Stellv. Inhaber:in — viel, aber keine Ränge'],
  ['admin', '◆ Admin'],
  ['supporter', '◇ Supporter — nur Tickets']
];

async function loadDashTeam() {
  const el = document.getElementById('pane-team');
  if (!el) return;
  el.innerHTML = '<p>Lädt …</p>';
  const [r, tk] = await Promise.all([api('/api/team'), api('/api/tickets?status=open')]);
  if (!r || !r.ok) {
    el.innerHTML = '<div class="panel"><p>⛔ ' + (r && r.error ? esc(r.error) : 'Team nicht verfügbar.') + '</p></div>';
    return;
  }
  const openTk = (tk && tk.ok && tk.stats) ? tk.stats.open : '–';

  /* ── Formular: neues Team-Mitglied ── */
  const addForm =
    '<div class="panel" style="margin-bottom:16px">' +
    '<h2>➕ Neues Team-Mitglied anlegen</h2>' +
    '<p class="subline" style="margin-bottom:12px">Der Account wird sofort erstellt — Zugangsdaten erscheinen einmalig hier und werden der Person per WhatsApp-DM zugestellt.</p>' +
    '<div style="display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end">' +
    '<div style="flex:2;min-width:180px"><label style="font-size:11px;opacity:.7">WhatsApp-Nummer</label>' +
    '<input id="teamAddNumber" class="inp" style="width:100%;padding:10px 12px;border-radius:10px;background:rgba(255,255,255,.06);color:inherit;border:1px solid var(--line-2)" placeholder="491701234567" autocomplete="off"></div>' +
    '<div style="flex:2;min-width:150px"><label style="font-size:11px;opacity:.7">Name (optional, wird Username)</label>' +
    '<input id="teamAddName" class="inp" style="width:100%;padding:10px 12px;border-radius:10px;background:rgba(255,255,255,.06);color:inherit;border:1px solid var(--line-2)" placeholder="z. B. Laura" autocomplete="off"></div>' +
    '<div style="flex:2;min-width:200px"><label style="font-size:11px;opacity:.7">Rang</label>' +
    '<select id="teamAddRole" class="inp" style="width:100%;padding:10px 12px;border-radius:10px;background:rgba(255,255,255,.06);color:inherit;border:1px solid var(--line-2)">' +
    DASH_ADD_ROLES.map(([v, l]) => '<option value="' + v + '">' + l + '</option>').join('') +
    '</select></div>' +
    '<button class="btn" onclick="dashTeamAdd()">➕ Anlegen</button>' +
    '</div>' +
    '<div id="teamAddResult" style="margin-top:12px"></div>' +
    '</div>';

  /* ── Bestehendes Team ── */
  const rows = (r.team || []).map((a) => {
    const isOwner = a.role === 'owner';
    return '<tr>' +
      '<td class="mono">' + esc(a.username) + '</td>' +
      '<td class="mono">+' + esc(String(a.number || '?').slice(0, 20)) + '</td>' +
      '<td>' + (isOwner
        ? '👑 <b>Inhaber</b> (geschützt)'
        : '<select id="sel-' + esc(a.username) + '" class="inp" style="padding:6px 10px;border-radius:8px;background:rgba(255,255,255,.06);color:inherit;border:1px solid var(--line-2)">' +
          DASH_ROLES.map(([v, l]) => '<option value="' + v + '"' + (v === a.role ? ' selected' : '') + '>' + l + '</option>').join('') +
          '</select>') + '</td>' +
      '<td>' + (isOwner ? '—' : '<button class="btn sm" onclick="dashTeamRole(\'' + esc(a.username) + '\')">💾 Speichern</button>') + '</td>' +
      '</tr>';
  }).join('');

  el.innerHTML =
    '<div class="stat-grid" style="margin-bottom:16px">' +
    '<div class="stat-card"><div class="t">Team</div><div class="v">' + (r.team || []).length + '</div><div class="s">Mitglieder</div></div>' +
    '<div class="stat-card"><div class="t">Offene Tickets</div><div class="v">' + openTk + '</div><div class="s">🎫 zu bearbeiten</div></div>' +
    '<div class="stat-card"><div class="t">Dev-Gruppe</div><div class="v" style="font-size:14px">' + (r.devGroup ? '✅ gesetzt' : '—') + '</div><div class="s">$setteam devgroup hier</div></div>' +
    '</div>' +
    addForm +
    '<div class="panel">' +
    '<h2>🏅 Team-Verwaltung</h2>' +
    '<p class="subline" style="margin-bottom:12px">Rang ändern: Dropdown wählen + Speichern. 🔱 Stellv. Inhaber:in darf viel (Bans, Broadcast, System — aber <b>keine Ränge</b>), ◇ Supporter nur Tickets. Neuanmeldung nur über das Formular oben.</p>' +
    '<div style="overflow-x:auto"><table class="tbl" style="width:100%;border-collapse:collapse;font-size:13px">' +
    '<tr style="opacity:.6;text-align:left"><th style="padding:8px">Account</th><th style="padding:8px">Nummer</th><th style="padding:8px">Rang</th><th style="padding:8px"></th></tr>' +
    (rows || '<tr><td colspan="4" style="padding:12px;opacity:.6">Noch keine Team-Accounts — lege oben eins an.</td></tr>') +
    '</table></div>' +
    '<p id="teamMsg" class="hint" style="margin-top:10px"></p>' +
    '<p class="hint" style="margin-top:6px">🎫 <a href="#" onclick="dashGoTk();return false">Zum Tickets-Tab</a> · Tickets landen auch in deiner Dev-Gruppe ($setteam devgroup).</p>' +
    '</div>';
}

async function dashTeamAdd() {
  const number = (document.getElementById('teamAddNumber').value || '').trim();
  const name = (document.getElementById('teamAddName').value || '').trim();
  const role = document.getElementById('teamAddRole').value;
  const out = document.getElementById('teamAddResult');
  if (!number) { out.innerHTML = '<p class="msg err">⚠️ Bitte Nummer angeben.</p>'; return; }
  out.innerHTML = '<p class="hint">⏳ Account wird erstellt …</p>';
  const r = await api('/api/team/add', { method: 'POST', body: { number, name, role } });
  if (r && r.ok) {
    out.innerHTML =
      '<div style="padding:14px;border:1px solid var(--line-2);border-radius:12px;background:rgba(167,139,250,.08)">' +
      '<b>✅ Team-Mitglied angelegt!</b>' +
      '<div class="kv" style="margin-top:8px">' +
      '<div class="k">Username</div><div class="v mono">' + esc(r.account.username) + '</div>' +
      '<div class="k">Temp-Passwort</div><div class="v mono"><b>' + esc(r.tempPassword) + '</b></div>' +
      '<div class="k">Rang</div><div class="v">' + esc(r.account.role) + '</div>' +
      '</div>' +
      '<p class="hint" style="margin-top:8px">' + (r.dmQueued ? '📬 Zugangsdaten werden der Person per WhatsApp-DM zugestellt.' : '⚠️ DM konnte nicht vorbereitet werden — gib die Daten selbst weiter!') + ' Das Passwort wird nur dies eine Mal angezeigt.</p></div>';
    document.getElementById('teamAddNumber').value = '';
    document.getElementById('teamAddName').value = '';
    setTimeout(loadDashTeam, 4000); /* Liste aktualisieren (nach dem Lesen des Passworts) */
  } else {
    out.innerHTML = '<p class="msg err">❌ ' + esc((r && r.error) || 'fehlgeschlagen') + '</p>';
  }
}

function dashGoTk() {
  const b = document.querySelector('#dashTabs .ai-chip[data-tab="tk"]');
  if (b) b.click();
}

async function dashTeamRole(username) {
  const sel = document.getElementById('sel-' + username);
  const msg = document.getElementById('teamMsg');
  if (!sel) return;
  const r = await api('/api/team/role', { method: 'POST', body: { username, role: sel.value } });
  if (r && r.ok) {
    if (msg) msg.textContent = '✅ ' + username + ' ist jetzt ' + sel.value + '.';
    loadDashTeam();
  } else {
    if (msg) msg.textContent = '❌ ' + ((r && r.error) || 'fehlgeschlagen');
  }
}

/* ═══════════ Router ═══════════ */
const ROUTES = {
  dashboard: initDashboard, session: loadSession, settings: loadSettings,
  owners: loadOwners, groups: loadGroups, badwords: loadBadwords,
  bans: loadBans, broadcast: loadBroadcast, profiles: loadProfiles, logs: loadLogs
};
(ROUTES[PAGE] || loadOverview)();
if (PAGE === 'dashboard') setInterval(() => { if (dashTab === 'ov') refreshOverview(); }, 8000);

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

/* ═══════════ ÜBERSICHT ═══════════ */
async function loadOverview() {
  view.innerHTML =
    '<div class="grid">' +
    '<div class="stat" id="botStat"><div class="ico">🤖</div><div class="num" id="botOnline">…</div><div class="lbl">Bot-Status</div></div>' +
    '<div class="stat"><div class="ico">👤</div><div class="num" id="statUsers">…</div><div class="lbl">Registrierte Nutzer</div></div>' +
    '<div class="stat"><div class="ico">👥</div><div class="num" id="statGroups">…</div><div class="lbl">Gruppen</div></div>' +
    '<div class="stat"><div class="ico">🚫</div><div class="num" id="statBans">…</div><div class="lbl">Bans</div></div>' +
    '<div class="stat"><div class="ico">👑</div><div class="num" id="statOwners">…</div><div class="lbl">Zusatz-Owner</div></div>' +
    '<div class="stat"><div class="ico">🧠</div><div class="num" id="statRam">…</div><div class="lbl">Bot-RAM</div></div>' +
    '</div><div class="box"><h3>🤖 Bot-Info (live vom Heartbeat)</h3><div id="botInfo" class="kv"></div></div>';
  await refreshOverview();
}
async function refreshOverview() {
  const stats = await api('/api/stats');
  if (!stats) return;
  const hb = stats.heartbeat || {};
  const fresh = hb.time && Date.now() - new Date(hb.time).getTime() < 40000;
  const online = hb.online === true && fresh;
  document.getElementById('botStat').className = 'stat ' + (online ? 'online' : 'offline');
  document.getElementById('botOnline').textContent = online ? '🟢 Online' : '🔴 Offline';
  document.getElementById('statUsers').textContent = stats.users;
  document.getElementById('statGroups').textContent = stats.groups;
  document.getElementById('statBans').textContent = stats.bans;
  document.getElementById('statOwners').textContent = stats.owners;
  document.getElementById('statRam').textContent = hb.ramMb ? hb.ramMb + ' MB' : '—';
  document.getElementById('botInfo').innerHTML =
    '<div class="k">JID</div><div class="v">' + esc(hb.jid || '—') + '</div>' +
    '<div class="k">LID</div><div class="v">' + esc(hb.lid || '—') + '</div>' +
    '<div class="k">Uptime</div><div class="v">' + (hb.uptimeSec ? Math.floor(hb.uptimeSec / 3600) + ' Std. ' + Math.floor((hb.uptimeSec % 3600) / 60) + ' Min.' : '—') + '</div>' +
    '<div class="k">Node</div><div class="v">' + esc(hb.node || '—') + '</div>' +
    '<div class="k">Letzter Heartbeat</div><div class="v">' + (hb.time ? new Date(hb.time).toLocaleString('de-DE') : '—') + '</div>';
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

/* ═══════════ Router ═══════════ */
const ROUTES = {
  dashboard: loadOverview, session: loadSession, settings: loadSettings,
  owners: loadOwners, groups: loadGroups, badwords: loadBadwords,
  bans: loadBans, broadcast: loadBroadcast, profiles: loadProfiles, logs: loadLogs
};
(ROUTES[PAGE] || loadOverview)();
if (PAGE === 'dashboard') setInterval(refreshOverview, 8000);

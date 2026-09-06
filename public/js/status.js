/* LoveBot — öffentliche Status-Seite (kein Login nötig) */
makeHearts(12);

function isFresh(hb) { return hb && hb.time && Date.now() - new Date(hb.time).getTime() < 40000; }

function paint(site) {
  const hb = site.heartbeat || {};
  const online = hb.online === true && isFresh(hb);
  document.getElementById('statusHero').innerHTML =
    '<div class="status-pill ' + (online ? 'on' : 'off') + '">' +
    '<span class="dot"></span>' + (online ? 'LOVE BOT IST ONLINE 💜' : 'LOVE BOT IST OFFLINE 💔') + '</div>' +
    (online ? '<p class="hint">Der Bot läuft gerade und kümmert sich um seine Gruppen. 🌹</p>'
            : '<p class="hint">Der Bot ist gerade nicht verbunden — z. B. weil der Server neu startet.</p>');
  document.getElementById('sUsers').textContent = site.counts.users;
  document.getElementById('sGroups').textContent = site.counts.groups;
  document.getElementById('sBans').textContent = site.counts.bans;
  document.getElementById('hbInfo').innerHTML =
    '<div class="k">Bot-Name</div><div class="v">' + esc(hb.name || site.name) + '</div>' +
    '<div class="k">JID</div><div class="v">' + esc(hb.jid || '—') + '</div>' +
    '<div class="k">LID</div><div class="v">' + esc(hb.lid || '—') + '</div>' +
    '<div class="k">Uptime</div><div class="v">' + (hb.uptimeSec ? Math.floor(hb.uptimeSec / 3600) + ' Std. ' + Math.floor((hb.uptimeSec % 3600) / 60) + ' Min.' : '—') + '</div>' +
    '<div class="k">RAM</div><div class="v">' + (hb.ramMb ? hb.ramMb + ' MB' : '—') + '</div>' +
    '<div class="k">Node.js</div><div class="v">' + esc(hb.node || '—') + '</div>' +
    '<div class="k">Letzte Meldung</div><div class="v">' + (hb.time ? new Date(hb.time).toLocaleString('de-DE') : 'noch nie') + '</div>';
}

async function tick() {
  const site = await api('/api/siteinfo');
  if (site) paint(site);
}

(async function () {
  const site = await api('/api/siteinfo');
  if (site && site.counts) {
    paint(site);
    document.getElementById('socials').innerHTML = buildSocials(site.links);
  } else {
    /* Fallback: API nicht erreichbar (z. B. statische Vorschau) */
    document.getElementById('statusHero').innerHTML =
      '<div class="status-pill off"><span class="dot"></span> STATUS UNBEKANNT 💤</div>' +
      '<p class="hint">Kein Live-Zugriff — starte den Bot-Server für Echtzeitdaten.</p>';
    ['sUsers', 'sGroups', 'sBans'].forEach((id) => { const e = document.getElementById(id); if (e) e.textContent = '—'; });
    document.getElementById('hbInfo').innerHTML = '<div class="k">Hinweis</div><div class="v">Live-Daten brauchen den laufenden server.js</div>';
  }
  const cmds = await api('/api/commands');
  const cats = (cmds && cmds.commands) || window.LOVEBOT_COMMANDS || [];
  if (cats.length) document.getElementById('sCmds').textContent = cats.reduce((a, c) => a + c.cmds.length, 0);
  setInterval(tick, 5000);
})();

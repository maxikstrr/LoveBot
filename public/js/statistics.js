/* LoveBot — öffentliche Statistik-Seite (kein Login nötig) */
makeHearts(10);

function paintStats(s) {
  const c = s.counts || {};
  const reg = s.registry || {};
  const lp = s.loveplus || {};
  document.getElementById('stUsers').textContent = c.users ?? '—';
  document.getElementById('stGroups').textContent = c.groups ?? '—';
  document.getElementById('stCommands').textContent = reg.commands ?? '—';
  document.getElementById('stCategories').textContent = reg.categories ?? '—';
  document.getElementById('stCouples').textContent = lp.couples ?? '—';
  document.getElementById('stLoveXp').textContent = (lp.loveXpTotal ?? 0).toLocaleString('de-DE');
  document.getElementById('stPets').textContent = lp.pets ?? '—';
  document.getElementById('stAch').textContent = lp.achievementsUnlocked ?? '—';

  const usage = s.commandUsage || {};
  const top = usage.top || [];
  const totalCalls = usage.totalCalls || 0;
  const listEl = document.getElementById('topCmdsList');
  if (!top.length) {
    listEl.innerHTML = '<p class="hint">Noch keine Befehlsaufrufe seit dem letzten Neustart erfasst.</p>';
  } else {
    const max = Math.max(...top.map((t) => t.count));
    listEl.innerHTML = top.map((t) =>
      '<div class="barrow">' +
      '<div class="name">$' + esc(t.name) + '</div>' +
      '<div class="track"><div class="fill" style="width:' + Math.max(4, Math.round((t.count / max) * 100)) + '%"></div></div>' +
      '<div class="cnt">' + t.count.toLocaleString('de-DE') + '</div>' +
      '</div>'
    ).join('');
  }
  document.getElementById('totalCallsNote').textContent =
    totalCalls ? totalCalls.toLocaleString('de-DE') + ' Befehlsaufrufe insgesamt seit dem letzten Server-Neustart.' : '';

  const activity = s.activity14d || [];
  const actEl = document.getElementById('actChart');
  if (!activity.length) {
    actEl.innerHTML = '<p class="hint">Keine Aktivitätsdaten.</p>';
  } else {
    const maxA = Math.max(1, ...activity.map((a) => a.total));
    actEl.innerHTML = activity.map((a) => {
      const h = Math.max(3, Math.round((a.total / maxA) * 90));
      const d = new Date(a.date);
      const lbl = d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
      return '<div class="actcol">' +
        '<div style="font-size:10px;color:var(--faint)">' + a.total + '</div>' +
        '<div class="actbar" style="height:' + h + 'px" title="' + lbl + ': ' + a.total + '"></div>' +
        '<div class="actday">' + lbl + '</div>' +
        '</div>';
    }).join('');
  }

  document.getElementById('fleetInfo').innerHTML =
    '<div class="k">Sessions gesamt</div><div class="v">' + (c.sessions ?? '—') + '</div>' +
    '<div class="k">Sessions online</div><div class="v">' + (c.sessionsOnline ?? '—') + '</div>' +
    '<div class="k">Registrierte Aliase</div><div class="v">' + (reg.aliases ?? '—') + '</div>' +
    '<div class="k">Bans</div><div class="v">' + (c.bans ?? '—') + '</div>' +
    '<div class="k">Zuletzt aktualisiert</div><div class="v">' + (s.generatedAt ? new Date(s.generatedAt).toLocaleString('de-DE') : '—') + '</div>';
}

(async function () {
  const stats = await api('/api/statistics');
  if (stats) {
    paintStats(stats);
  } else {
    ['stUsers', 'stGroups', 'stCommands', 'stCategories', 'stCouples', 'stLoveXp', 'stPets', 'stAch'].forEach((id) => {
      const e = document.getElementById(id); if (e) e.textContent = '—';
    });
    document.getElementById('topCmdsList').innerHTML = '<p class="hint">Live-Daten brauchen den laufenden server.js.</p>';
    document.getElementById('actChart').innerHTML = '';
    document.getElementById('fleetInfo').innerHTML = '<div class="k">Hinweis</div><div class="v">Server nicht erreichbar</div>';
  }
  const site = await api('/api/siteinfo');
  if (site && site.links) document.getElementById('socials').innerHTML = buildSocials(site.links);
  setInterval(async () => { const st = await api('/api/statistics'); if (st) paintStats(st); }, 15000);
})();

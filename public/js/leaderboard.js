/* LoveBot — öffentliche Bestenliste (kein Login nötig) */
makeHearts(10);

let LB_DATA = null;
let ACTIVE_TAB = 'level';
const MEDALS = ['🥇', '🥈', '🥉'];

function rankIcon(i) { return MEDALS[i] || (i + 1); }

function renderTab() {
  const el = document.getElementById('lbList');
  if (!LB_DATA) { el.innerHTML = '<div class="lb-empty">Lade …</div>'; return; }

  if (ACTIVE_TAB === 'level') {
    const list = LB_DATA.topLevel || [];
    el.innerHTML = list.length ? list.map((u, i) =>
      '<div class="lb-row"><div class="rank">' + rankIcon(i) + '</div>' +
      '<div class="lb-name">' + esc(u.name) + '</div>' +
      '<div class="lb-val">Level <b>' + u.level + '</b> · ' + (u.xp || 0).toLocaleString('de-DE') + ' XP</div></div>'
    ).join('') : '<div class="lb-empty">Noch keine Nutzer-Profile vorhanden.</div>';
  } else if (ACTIVE_TAB === 'rich') {
    const list = LB_DATA.topRich || [];
    el.innerHTML = list.length ? list.map((u, i) =>
      '<div class="lb-row"><div class="rank">' + rankIcon(i) + '</div>' +
      '<div class="lb-name">' + esc(u.name) + '</div>' +
      '<div class="lb-val"><b>' + (u.copper || 0).toLocaleString('de-DE') + '</b> 💰 Copper</div></div>'
    ).join('') : '<div class="lb-empty">Noch keine Wirtschaftsdaten vorhanden.</div>';
  } else {
    const list = LB_DATA.topCouples || [];
    el.innerHTML = list.length ? list.map((c, i) =>
      '<div class="lb-row"><div class="rank">' + rankIcon(i) + '</div>' +
      '<div class="lb-name">' + esc(c.n1) + ' ❤️ ' + esc(c.n2) + '</div>' +
      '<div class="lb-val"><b>' + (c.loveXp || 0).toLocaleString('de-DE') + '</b> Love-XP · Lv.' + c.level + '</div></div>'
    ).join('') : '<div class="lb-empty">Noch keine Paare vorhanden.</div>';
  }
}

document.querySelectorAll('.lb-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.lb-tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    ACTIVE_TAB = tab.dataset.tab;
    renderTab();
  });
});

(async function () {
  LB_DATA = await api('/api/leaderboard');
  renderTab();
  const site = await api('/api/siteinfo');
  if (site && site.links) document.getElementById('socials').innerHTML = buildSocials(site.links);
  setInterval(async () => { LB_DATA = await api('/api/leaderboard'); renderTab(); }, 20000);
})();

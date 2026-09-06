/* LoveBot — Startseite (Landing)
   Holt Live-Daten aus der API; ohne Backend greift ein eingebauter Fallback. */
makeHearts(14);
document.getElementById('year').textContent = new Date().getFullYear();

/* Uhr kurz halten */
(function clock() {
  const el = document.body.querySelector('[data-clock-brief]');
  if (!el) return;
  const upd = () => { el.textContent = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + ' Uhr'; };
  upd(); setInterval(upd, 20000);
})();

/* Zahl hochzählen */
function countUp(el, target, dur = 900) {
  if (target == null || isNaN(target)) return;
  const start = performance.now();
  const step = (t) => {
    const p = Math.min(1, (t - start) / dur);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(target * eased).toLocaleString('de-DE');
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ── Befehle (API mit Fallback) ─────────────────────────────────── */
async function loadCommands() {
  let cats = null;
  try {
    const data = await api('/api/commands');
    if (data && data.commands) cats = data.commands;
  } catch (e) { /* offline / statisch */ }
  if (!cats && window.LOVEBOT_COMMANDS) cats = window.LOVEBOT_COMMANDS;
  if (!cats) return;

  const total = cats.reduce((a, c) => a + c.cmds.length, 0);
  const tEl = document.getElementById('cmdTotal');
  if (tEl) tEl.textContent = total + '+';

  const grid = document.getElementById('cmdGrid');
  if (grid) {
    grid.innerHTML = cats.filter((c) => !/alias/i.test(c.title)).map((cat) =>
      '<div class="cmdbox reveal">' +
      '<h3><span class="em">' + cat.emoji + '</span>' + esc(cat.title) + '<span class="cnt">' + cat.cmds.length + '</span></h3>' +
      '<div class="chips">' + cat.cmds.slice(0, 8).map((c) =>
        '<span class="chip" title="' + esc(c.desc) + '">' + esc(c.usage.split(' ')[0]) + '</span>').join('') +
      (cat.cmds.length > 8 ? '<a class="chip more" href="/cmd.html">+' + (cat.cmds.length - 8) + ' mehr …</a>' : '') +
      '</div></div>'
    ).join('');
  }
  const cEl = document.getElementById('cntCmds');
  if (cEl) countUp(cEl, total);
}

/* ── Live-Status & Zähler ───────────────────────────────────────── */
(async function () {
  await loadCommands();
  let site = null;
  try { site = await api('/api/siteinfo'); } catch (e) { /* offline */ }

  if (site && site.counts) {
    countUp(document.getElementById('cntUsers'), site.counts.users);
    countUp(document.getElementById('cntGroups'), site.counts.groups);
  } else {
    const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    set('cntUsers', '—'); set('cntGroups', '—');
  }

  /* Bot-Status-Pill */
  const bot = document.getElementById('cntBot');
  if (bot) {
    const hb = (site && site.heartbeat) || {};
    const fresh = hb.time && Date.now() - new Date(hb.time).getTime() < 40000;
    const on = hb.online === true && fresh;
    bot.className = 'st ' + (on ? 'on' : 'off');
    bot.innerHTML = '<span class="dot"></span> ' + (on ? 'ONLINE' : 'OFFLINE');
  }

  /* Footer */
  const socials = document.getElementById('socials');
  if (socials) socials.innerHTML = buildSocials(site && site.links);
  const foot = document.getElementById('footOwner');
  if (foot && site) {
    foot.innerHTML = '👑 Owner: Maxichen' +
      (site.ownerJid ? ' · <span style="font-family:var(--mono);font-size:11px">' + esc(site.ownerJid) + '</span>' : '');
  }
})();

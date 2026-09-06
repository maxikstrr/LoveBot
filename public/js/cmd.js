/* ═══════════════════════════════════════════════════════════════════
   LoveBot — Befehle-Seite (Design 2026)
   Suche · Kategorie-Tabs · Syntax-Highlighting · Copy · Rechte-Badges
   ═══════════════════════════════════════════════════════════════════ */
makeHearts(12);
document.getElementById('year').textContent = new Date().getFullYear();

let ALL = [];
let query = '';
let activeCat = 'alle';

/* ── Hilfsfunktionen ───────────────────────────────────────────── */

/* Rechte-Badge aus Beschreibung/Kategorie ableiten */
function roleBadge(c, cat) {
  const d = (c.desc || '') + ' ' + (cat.title || '');
  if (/\(Owner\)|Owner:|OWNER TOOLS|\(Owner\b/.test(c.desc || '') || cat.title === 'OWNER TOOLS') return '<span class="rb owner">👑 Owner</span>';
  if (/Admin/i.test(d)) return '<span class="rb admin">🛡️ Admin</span>';
  if (/Gruppe|Gruppen/i.test(cat.title || '')) return '<span class="rb group">👥 Gruppe</span>';
  return '';
}

/* Usage syntax-highlighten: $name <arg> @user on|off */
function hi(usage) {
  return esc(usage).split(' ').map((tok) => {
    if (tok === '/' || tok === '·') return '<span class="sep">' + tok + '</span>';
    if (tok[0] === '$') return '<span class="p">$</span><span class="n">' + tok.slice(1) + '</span>';
    return '<span class="a">' + tok + '</span>';
  }).join(' ');
}

/* Ersten echten Befehl aus der usage extrahieren ($marry aus "$marry @user") */
function firstCmd(usage) {
  const m = String(usage).match(/\$[A-Za-z0-9_äöüß]+/);
  return m ? m[0] : String(usage);
}

function isAliasCat(cat) { return /alias/i.test(cat.title || ''); }

/* ── Rendern ───────────────────────────────────────────────────── */
function cmdRow(c, cat) {
  return '<div class="cmdrow" data-cmd="' + esc(firstCmd(c.usage)) + '" title="Klicken zum Kopieren">' +
    '<div class="topline"><code>' + hi(c.usage) + roleBadge(c, cat) + '</code></div>' +
    '<span class="desc">' + esc(c.desc) + '</span>' +
    '<button class="copy" aria-label="Kopieren" tabindex="-1">⧉</button>' +
    '</div>';
}

function catBox(cat) {
  return '<div class="cmdbox reveal in" id="cat-' + esc(cat.title).replace(/[^a-z0-9]/gi, '') + '">' +
    '<h3><span class="em">' + cat.emoji + '</span>' + esc(cat.title) + '<span class="cnt">' + cat.cmds.length + '</span></h3>' +
    '<div class="cmdlist">' + cat.cmds.map((c) => cmdRow(c, cat)).join('') + '</div>' +
    '</div>';
}

function aliasBox(cat) {
  return '<div class="cmdbox aliasbox reveal in"><h3><span class="em">' + cat.emoji + '</span>' + esc(cat.title) +
    '<span class="cnt">' + cat.cmds.length + '</span></h3>' +
    '<details><summary>👁️ Alle Aliase anzeigen — sie funktionieren genauso wie die Original-Befehle</summary>' +
    '<div class="inner">' + cat.cmds.map((c) => '<span class="al" data-cmd="' + esc(firstCmd(c.usage)) + '" title="Kopieren">' + esc(c.usage) + '</span>').join('') + '</div>' +
    '</details></div>';
}

function plural(n, eins, mehr) { return n === 1 ? eins : mehr; }

function draw(list, aliasCat) {
  const grid = document.getElementById('cmdFullGrid');
  const realCats = list.filter((c) => !isAliasCat(c));
  const total = realCats.reduce((a, c) => a + c.cmds.length, 0);
  document.getElementById('cmdCount').textContent = '💜 ' + total + plural(total, ' Befehl', ' Befehle') + ' in ' +
    realCats.length + plural(realCats.length, ' Kategorie', ' Kategorien') +
    (aliasCat ? ' · plus ' + aliasCat.cmds.length + ' Aliase' : '');
  document.getElementById('noResults').style.display = (total || aliasCat) ? 'none' : 'block';
  grid.classList.toggle('single-col', realCats.length === 1);
  grid.innerHTML = realCats.map((cat) => catBox(cat)).join('') + (aliasCat ? aliasBox(aliasCat) : '');
}

/* Kategorie-Tabs */
function drawTabs() {
  const bar = document.getElementById('catbar');
  const cats = ALL.filter((c) => !isAliasCat(c));
  const total = cats.reduce((a, c) => a + c.cmds.length, 0);
  bar.innerHTML =
    '<button class="cat-tab' + (activeCat === 'alle' ? ' active' : '') + '" data-cat="alle">✨ Alle <span class="n">' + total + '</span></button>' +
    cats.map((cat) =>
      '<button class="cat-tab' + (activeCat === cat.title ? ' active' : '') + '" data-cat="' + esc(cat.title) + '">' +
      cat.emoji + ' ' + esc(cat.title.toLowerCase()) + ' <span class="n">' + cat.cmds.length + '</span></button>'
    ).join('');
  bar.querySelectorAll('.cat-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeCat = btn.dataset.cat;
      drawTabs();
      apply();
      document.getElementById('cmdPage').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

/* Filter anwenden (Suche + aktive Kategorie) */
function apply() {
  const q = query.trim().toLowerCase();
  let list = ALL;

  if (activeCat !== 'alle') {
    list = list.filter((c) => c.title === activeCat);
  }

  if (q) {
    const found = [];
    for (const cat of list) {
      const cmds = cat.cmds.filter((c) =>
        c.cmd.includes(q) || c.usage.toLowerCase().includes(q) || c.desc.toLowerCase().includes(q)
      );
      if (cmds.length) found.push({ ...cat, cmds });
    }
    list = found;
  }

  const alias = list.filter(isAliasCat);
  const aliasCat = alias.length ? alias[0] : null;
  draw(list, aliasCat);
  updateClear();
}

function updateClear() {
  document.getElementById('searchClear').style.display = query ? 'grid' : 'none';
  document.querySelector('.cmdsearch-wrap .kbd').style.display = query ? 'none' : '';
}

/* ── Events ────────────────────────────────────────────────────── */
function bindEvents() {
  const search = document.getElementById('cmdSearch');
  search.addEventListener('input', (e) => { query = e.target.value; apply(); });
  document.getElementById('searchClear').addEventListener('click', () => {
    query = ''; search.value = ''; apply(); search.focus();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== search) { e.preventDefault(); search.focus(); }
    if (e.key === 'Escape' && document.activeElement === search) { query = ''; search.value = ''; apply(); }
  });

  /* Klick auf Befehl → kopieren (Delegation) */
  document.getElementById('cmdFullGrid').addEventListener('click', (e) => {
    const copyBtn = e.target.closest('.copy');
    const row = e.target.closest('[data-cmd]');
    if (!row) return;
    const cmd = row.dataset.cmd;
    copyText(cmd).then(() => {
      toast(cmd + ' kopiert 💜');
      if (copyBtn) {
        copyBtn.textContent = '✓'; copyBtn.classList.add('done');
        setTimeout(() => { copyBtn.textContent = '⧉'; copyBtn.classList.remove('done'); }, 1200);
      }
    });
  });
}

/* ── Start ─────────────────────────────────────────────────────── */
(async function () {
  let data = null;
  try { data = await api('/api/commands'); } catch (e) { /* statisch */ }
  const cats = (data && data.commands) || window.LOVEBOT_COMMANDS || [];
  if (!cats.length) {
    document.getElementById('noResults').style.display = 'block';
    return;
  }
  ALL = cats;
  drawTabs();
  apply();
  bindEvents();

  let site = null;
  try { site = await api('/api/siteinfo'); } catch (e) {}
  if (site) {
    document.getElementById('socials').innerHTML = buildSocials(site.links);
    document.getElementById('footOwner').innerHTML = '👑 Owner: Maxichen' +
      (site.ownerJid ? ' · <span style="font-family:var(--mono);font-size:11px">' + esc(site.ownerJid) + '</span>' : '');
  }
})();

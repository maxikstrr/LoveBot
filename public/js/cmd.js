/* ═══════════════════════════════════════════════════════════════════
   LoveBot — Befehle-Seite · Liquid Glass
   Suche · Kategorie-Tabs · Syntax-Highlighting · Copy · Rechte-Badges
   Jede Karte: BEFEHL · BEISPIEL (konkret nutzbar) · ERKLÄRUNG
   ═══════════════════════════════════════════════════════════════════ */
makeHearts(12);
document.getElementById('year').textContent = new Date().getFullYear();

let ALL = [];
let query = '';
let activeCat = 'alle';

/* ── Kategorie-Akzente — Palette der Design-Referenz ────────────────
   Jede Kategorie bekommt eine der vier Referenz-Farben (Dot · Balken ·
   Label-Gradient): Violett · Cyan · Bernstein · Rose.                   */
const CAT_ACCENT = {
  'START': 'violet', 'ALLGEMEIN': 'cyan', 'LIEBE & HERZEN': 'rose', 'AFK & PROFIL': 'violet',
  'GRUPPE & MODERATION': 'amber', 'ADMIN & VERIFIKATION': 'amber', 'MEDIEN & AI': 'cyan',
  'SLOT & SPASS': 'rose', 'ECONOMY': 'amber', 'SESSION-CENTER (OWNER)': 'rose',
  'LOVEPLUS (NEU)': 'rose', 'INTERNET & FAKTEN': 'cyan', 'OWNER TOOLS': 'rose',
  'ALLTAG & WEB': 'cyan', 'WERKZEUGE & UTILITIES': 'amber', 'FULL-UPDATE 2026': 'violet', 'AI': 'cyan'
};
function accentOf(cat) {
  const t = String((cat && cat.title) || '');
  if (CAT_ACCENT[t]) return CAT_ACCENT[t];
  let h = 0;
  for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0;
  return ['violet', 'cyan', 'amber', 'rose'][h % 4];
}

/* ── BEISPIEL-GENERATOR ──────────────────────────────────────────────
   Aus der Usage („$givecoins @person <anzahl> [bank] <grund>") wird ein
   konkretes, sofort nutzbares Beispiel („$givecoins @Leni 100 Geschenk").
   Regeln: nur die ERSTE Variante vor „ / " · Pflicht-Platzhalter werden
   gefüllt · optionale [ … ]-Teile nur, wenn sie einen Nutzer brauchen.  */
const FILL = {
  '@user': '@Leni', '@person': '@Leni', '@mention': '@Leni',
  '<anzahl>': '5', '<betrag>': '100', '<einsatz>': '50',
  '<einsatz|all>': '50', '<betrag|all>': 'all', '<nr|@user>': '@Leni', '<id|@user>': '@Leni',
  '<text>': 'Hallo zusammen', '<frage>': 'Wie wird man reich?', '<prompt>': 'schreibe ein Gedicht',
  '<grund>': 'Spam', '<name>': 'Maxi', '<name1>': 'Alex', '<name2>': 'Sami',
  '<stadt>': 'Aachen', '<url>': 'https://maxichen.de', '<link>': 'https://maxichen.de',
  '<link|song>': 'https://youtu.be/2Vv-BfVoq4g', '<wort>': 'Liebe', '<zeit>': '10m',
  '<id>': '3', '<code>': '1234', '<nummer>': '4915155894714',
  '<sprache>': 'de', '<rang>': 'Gold', '<item>': 'Rosenstrauß',
  '<ausdruck>': '2+2*10', '<a-b>': '1-10', '<schere|stein|papier>': 'stein',
  '<key>': 'liebe', '<wert>': '100', '<zeichen>': '20', '<cm>': '180', '<kg>': '75',
  '<tags…>': 'romantisch', '<von>': 'Maxi', '<begriff>': 'Liebe', '<feature>': 'xp',
  '<modul>': 'economy', '<befehl>': '$ping', '<day|week|month|year|all>': 'week',
  '<prod|test|dev>': 'prod', '<f>': '1,5', '<achievement-id>': 'first-love',
  '<list|remember|forget|clear>': 'remember', '<jid>': '4915155894714@s.whatsapp.net',
  '<on|off>': 'on', '<on|off|@user>': 'on', '<on|off|inherit>': 'on'
};
const FILL_GENERIC = { user: '@Leni', person: '@Leni', anzahl: '5', betrag: '100', zahl: '3', id: '3', text: 'Hallo', name: 'Maxi' };

function beispiel(c) {
  const usage = String(c.usage || '');
  /* nur die erste Variante („$a / $b" → „$a …") */
  const firstVariant = usage.split(/\s+\/\s+/)[0].trim();
  const m = firstVariant.match(/\$[\wäöüß]+/);
  if (!m) return firstVariant;
  const cmd = m[0];
  const rest = firstVariant.slice(m.index + cmd.length).trim();
  if (!rest) return cmd;
  const out = [cmd];
  for (const tokRaw of rest.split(/\s+/)) {
    const tok = tokRaw;
    if (tok === '/' || tok === '·') break;
    const key = tok.toLowerCase();
    if (FILL[key]) { out.push(FILL[key]); continue; }
    if (tok.startsWith('[')) {
      /* optionaler Teil: nur zeigen, wenn er einen Nutzer braucht */
      if (/@user|@person/i.test(tok)) out.push('@Leni');
      continue;
    }
    if (tok.startsWith('<') && tok.endsWith('>')) {
      const inner = tok.slice(1, -1);
      const first = inner.split('|')[0].trim();
      out.push(FILL['<' + first.toLowerCase() + '>'] || FILL_GENERIC[first.toLowerCase()] || first);
      continue;
    }
    if (tok.startsWith('@')) { out.push('@Leni'); continue; }
    if (tok === 'owner/repo') { out.push('maxikstrr/LoveBot'); continue; }
    /* Datums-Formatvorlage „TT.MM.[JJJJ]" → echtes Datum */
    if (/^TT\.MM/i.test(tok)) { out.push('14.02.2010'); continue; }
    /* freie Auswahl ohne Klammern („on|off", „an|aus", „stein|papier") → erste Wahl */
    if (/^[a-zäöüß0-9]+(\|[a-zäöüß0-9|]+)+$/i.test(tok)) { out.push(tok.split('|')[0]); continue; }
    out.push(tok); /* Literale wie „&" behalten */
  }
  return out.join(' ');
}

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

/* Ersten echten Befehl aus der usage extrahieren ($marry aus „$marry @user") */
function firstCmd(usage) {
  const m = String(usage).match(/\$[A-Za-z0-9_äöüß]+/);
  return m ? m[0] : String(usage);
}

function isAliasCat(cat) { return /alias/i.test(cat.title || ''); }

/* ── Rendern ───────────────────────────────────────────────────── */

/* Eine Befehls-Karte: BEFEHL (Syntax) · BEISPIEL (konkret) · ERKLÄRUNG.
   Klick auf die Karte kopiert das BEISPIEL — direkt benutzbar.          */
function cmdRow(c, cat) {
  const acc = accentOf(cat);
  const ex = beispiel(c);
  return '<div class="cmdrow acc-' + acc + '" data-cmd="' + esc(ex) + '" title="Klicken: „' + esc(ex) + '“ kopieren">' +
    '<div class="topline"><code>' + hi(c.usage) + '</code>' + roleBadge(c, cat) +
    '<button class="copy" aria-label="Beispiel kopieren" tabindex="-1">⧉</button></div>' +
    '<div class="cmdx"><span class="cmdx-l">Beispiel</span><span class="cmdx-v">' + hi(ex) + '</span></div>' +
    '<div class="cmdx cmdx-e"><span class="cmdx-l">Erklärung</span><span class="cmdx-t">' + esc(c.desc) + '</span></div>' +
    '</div>';
}

/* Kategorie-Box: leuchtender Dot + Gradient-Titel + Zähler-Pille
   (wie die Sections der Design-Referenz).                               */
function catBox(cat) {
  const acc = accentOf(cat);
  return '<div class="cmdbox reveal in acc-' + acc + '" id="cat-' + esc(cat.title).replace(/[^a-z0-9]/gi, '') + '">' +
    '<h3><span class="sdot"></span><span class="em">' + cat.emoji + '</span><span class="t">' + esc(cat.title) + '</span>' +
    '<span class="cnt">' + cat.cmds.length + '</span></h3>' +
    '<div class="cmdlist">' + cat.cmds.map((c) => cmdRow(c, cat)).join('') + '</div>' +
    '</div>';
}

function aliasBox(cat) {
  return '<div class="cmdbox aliasbox reveal in"><h3><span class="em">' + cat.emoji + '</span><span class="t">' + esc(cat.title) +
    '</span><span class="cnt">' + cat.cmds.length + '</span></h3>' +
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

  /* Klick auf Befehl → Beispiel kopieren (Delegation) */
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

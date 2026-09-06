/* LoveBot — gemeinsame Funktionen (alle Seiten) */

function makeHearts(count = 14) {
  const holder = document.getElementById('hearts');
  if (!holder) return;
  const emojis = ['💜', '🌹', '💍', '❤️', '✨', '💙'];
  for (let i = 0; i < count; i++) {
    const s = document.createElement('span');
    s.textContent = emojis[i % emojis.length];
    s.style.left = Math.random() * 100 + '%';
    s.style.animationDuration = 8 + Math.random() * 10 + 's';
    s.style.animationDelay = Math.random() * 9 + 's';
    s.style.fontSize = 13 + Math.random() * 18 + 'px';
    holder.appendChild(s);
  }
}

function getToken() { return localStorage.getItem('love_token'); }
function getRole() { return localStorage.getItem('love_role') || 'user'; }
function getName() { return localStorage.getItem('love_name') || ''; }

async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (getToken()) headers['Authorization'] = 'Bearer ' + getToken();
  let res;
  try {
    res = await fetch(path, {
      method: opts.method || 'GET',
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined
    });
  } catch (e) {
    return null; /* Server nicht erreichbar (z. B. statische Vorschau) */
  }
  if (res.status === 401 && location.pathname !== '/' && !location.pathname.includes('login')) {
    localStorage.clear();
    location.href = '/login.html';
    return null;
  }
  return res.json().catch(() => null);
}

/* ── Design-2026-Helfer: Toast, Scroll-Reveal, Copy ─────────────── */

/* Kleine Einblend-Meldung unten (z. B. „Befehl kopiert 💜“) */
function toast(text) {
  let t = document.querySelector('.toast');
  if (!t) {
    t = document.createElement('div');
    t.className = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = text;
  requestAnimationFrame(() => t.classList.add('show'));
  clearTimeout(t._hide);
  t._hide = setTimeout(() => t.classList.remove('show'), 1800);
}

/* Sanftes Einblenden von .reveal-Elementen beim Scrollen */
function initReveal() {
  const els = document.querySelectorAll('.reveal');
  if (!els.length) return;
  if (!('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('in')); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
  els.forEach((e) => io.observe(e));
}

/* Text in die Zwischenablage kopieren (mit doppeltem Fallback) */
function copyText(text) {
  const fallback = () => new Promise((resolve) => {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    ta.remove(); resolve();
  });
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text).catch(fallback);
  }
  return fallback();
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initReveal);
} else {
  initReveal();
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* 🚫 Ban-Nachricht mit Owner-Kontakten rendern */
function renderBanBox(el, banned) {
  el.className = 'msg banned';
  el.innerHTML =
    '🚫 <b>Du bist gebannt!</b><br><br>' +
    '• <b>Von:</b> ' + esc(banned.by) + (banned.byJid ? ' (' + esc(banned.byJid) + ')' : '') + '<br>' +
    '• <b>Grund:</b> ' + esc(banned.reason) + '<br>' +
    (banned.bannedAt ? '• <b>Am:</b> ' + esc(new Date(banned.bannedAt).toLocaleString('de-DE')) + '<br>' : '') +
    '<div class="owners">💜 <b>Wende dich an diese Owner und bitte um Hilfe:</b><br>' +
    (banned.owners || []).map((o) => '👑 ' + esc(o.name) + ' — <span style="font-family:monospace">' + esc(o.jid) + (o.lid ? ' / ' + esc(o.lid) : '') + '</span>').join('<br>') +
    '</div>';
}

/* Admin-Sidebar (CDE-Style) */
const NAV = {
  system: [
    ['dashboard', '📊', 'Übersicht'],
    ['session', '📡', 'Session'],
    ['settings', '⚙️', 'Einstellungen']
  ],
  verwaltung: [
    ['owners', '👑', 'Owner'],
    ['groups', '👥', 'Gruppen & Features'],
    ['badwords', '🤬', 'Badwords'],
    ['bans', '🚫', 'Bans'],
    ['broadcast', '📢', 'Broadcast']
  ],
  daten: [
    ['profiles', '👤', 'Profile'],
    ['logs', '📜', 'Logs']
  ]
};

function buildSidebar(activePage) {
  const role = getRole();
  const sections = [];
  sections.push(['SYSTEM', NAV.system]);
  if (role === 'owner') {
    sections.push(['VERWALTUNG', NAV.verwaltung]);
    sections.push(['DATEN', NAV.daten]);
  } else {
    sections.push(['DATEN', [['profiles', '👤', 'Mein Profil']]]);
  }
  let html =
    '<div class="brand"><span class="h">💜</span><b>LOVE&nbsp;BOT</b></div>' +
    '<div class="userchip"><div class="nm">' + esc(getName() || 'Nutzer') + '</div>' +
    '<div class="rl">' + (role === 'owner' ? '👑 Owner — volle Kontrolle' : '👤 Nutzer') + '</div></div>';
  for (const [label, items] of sections) {
    html += '<div class="side-label">' + label + '</div>';
    for (const [page, ico, title] of items) {
      html += '<a class="nav-btn' + (page === activePage ? ' active' : '') + '" href="/' + page + '.html">' + ico + ' ' + title + '</a>';
    }
  }
  html += '<div class="side-label">LINKS</div>' +
    '<a class="nav-btn" href="/">🏠 Website</a>' +
    '<a class="nav-btn" href="/cmd.html">📜 Alle Befehle</a>' +
    '<a class="nav-btn" href="/status.html">📡 Live-Status</a>';
  html += '<div class="spacer"></div>' +
    '<a class="nav-btn logout" href="#" onclick="doLogout();return false;">🚪 Abmelden</a>';
  const el = document.getElementById('sidebar');
  if (el) el.innerHTML = html;
}

/* Footer-Links aus echten siteinfo-Daten */
function buildSocials(l) {
  if (!l) return '';
  return '<a href="' + l.tiktok + '" target="_blank">🎵 TikTok</a>' +
    '<a href="' + l.youtube + '" target="_blank">▶️ YouTube</a>' +
    '<a href="' + l.instagram + '" target="_blank">📸 Instagram</a>' +
    '<a href="' + l.github + '" target="_blank">💻 GitHub</a>' +
    '<a href="' + l.discord + '" target="_blank">🎮 Discord</a>' +
    '<a href="' + l.channel + '" target="_blank">📢 Kanal</a>' +
    '<a href="' + l.devgroup + '" target="_blank">🛠️ Dev-Gruppe</a>';
}

function doLogout() {
  api('/api/logout', { method: 'POST' });
  localStorage.clear();
  location.href = '/login.html';
}

function guardApp() {
  if (!getToken()) { location.href = '/login.html'; return false; }
  return true;
}

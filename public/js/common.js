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

/* 🔔 Notification-Bell: nach Login zeigt die Top-Nav die ungelesene Zahl */
function initNotifBell() {
  try {
    if (!getToken() || !document.querySelector('.topnav')) return;
    fetch('/api/notifications', { headers: { Authorization: 'Bearer ' + getToken() } })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (!d || !d.ok) return;
        const nav = document.querySelector('.topnav');
        const cta = nav.querySelector('.cta');
        const bell = document.createElement('a');
        bell.href = '/notifications.html';
        bell.className = 'notif-bell';
        bell.title = 'Benachrichtigungen';
        bell.innerHTML = '🔔' + (d.unread > 0 ? '<span class="notif-badge">' + (d.unread > 99 ? '99+' : d.unread) + '</span>' : '');
        if (cta) cta.insertBefore(bell, cta); else nav.appendChild(bell);
      })
      .catch(() => {});
  } catch (e) {}
}
document.addEventListener('DOMContentLoaded', initNotifBell);

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
  const data = await res.json().catch(() => null);
  if ((res.status === 403 || res.status === 429) && data?.securityBlock) {
    showSecurityBlock(data.security, data.reason || '');
  }
  return data;
}

function showSecurityBlock(security, reason) {
  if (document.getElementById('securityBlockGate')) return;
  const gate = document.createElement('div');
  gate.className = 'security-block-gate';
  gate.id = 'securityBlockGate';
  gate.innerHTML = '<div class="security-block-card">' +
    '<div class="security-block-icon">🛡️</div>' +
    '<span class="security-block-kicker">LOVEBOT SECURITY</span>' +
    '<h1>' + esc(security?.title || 'Zugriff gesperrt') + '</h1>' +
    '<p>' + esc(reason || security?.detail || 'Diese Anfrage wurde vom Schutzsystem blockiert.') + '</p>' +
    '<div class="security-block-meta"><span>Code</span><b>' + esc(security?.code || 'SECURITY_BLOCK') + '</b><span>Zeit</span><b>' + esc(security?.at || new Date().toISOString()) + '</b></div>' +
    '<p class="security-block-help">' + esc(security?.action || 'Bitte kontaktiere den Owner.') + '</p>' +
    '<button class="btn ghost" onclick="location.reload()">↻ Erneut prüfen</button>' +
    '</div>';
  document.body.appendChild(gate);
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
  ],
  /* 💜 7.0: persönlicher Bereich (alle Rollen) */
  mein: [
    ['home', '🏠', 'Dashboard'],
    ['account', '👤', 'Mein Account'],
    ['progression', '🏆', 'Progression'],
    ['economy', '💰', 'Economy'],
    ['bank', '🏦', 'Bank'],
    ['reports', '📊', 'Reports'],
    ['year', '📅', 'Jahr 2026'],
    ['group', '👥', 'Gruppen'],
    ['ai', '🤖', 'AI']
  ]
};

function buildSidebar(activePage) {
  const role = getRole();
  const sections = [];
  sections.push(['SYSTEM', NAV.system]);
  sections.push(['MEIN BEREICH', NAV.mein]);
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
    '<a class="nav-btn" href="/statistics.html">📊 Statistiken</a>' +
    '<a class="nav-btn" href="/leaderboard.html">🏆 Bestenliste</a>' +
    '<a class="nav-btn" href="/status.html">📡 Live-Status</a>' +
    '<a class="nav-btn" href="/datenschutz.html">🔐 Datenschutz</a>';
  html += '<div class="spacer"></div>' +
    '<a class="nav-btn logout" href="#" onclick="doLogout();return false;">🚪 Abmelden</a>' +
    '<div class="footline">💜 LoveBot by Maxichen 2026</div>';
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
  /* 🍪 Die Cookie-/DSGVO-Entscheidung liegt in sessionStorage (nicht
     localStorage) und bleibt davon unberührt — ein Logout beendet die
     Login-Sitzung, aber nicht die Browser-Sitzung/den Consent, darum
     muss hier nichts extra behandelt werden. Nur die Login-/App-Daten
     in localStorage (Token etc.) werden entfernt. */
  localStorage.clear();
  location.href = '/login.html';
}

function guardApp() {
  if (!getToken()) { location.href = '/login.html'; return false; }
  return true;
}

/* ══════════════════════════════════════════════════════════════════
   🍪 DSGVO- / COOKIE-CONSENT-GATE (Website)
   Verhalten (Stand: einmal pro Browser-SITZUNG, nicht mehr pro
   Seitenaufruf): Beim allerersten Seitenaufruf eines neuen Tabs/einer
   neuen Sitzung erscheint das Consent-Gate. Sobald zugestimmt (oder
   bewusst nur "Notwendige" gewählt) wurde, gilt diese Entscheidung für
   ALLE weiteren Seiten dieser Sitzung (z. B. login.html, dashboard.html,
   …) — es taucht NICHT bei jedem einzelnen Klick/Seitenwechsel neu auf.
   Erst wenn der Tab/das Fenster komplett geschlossen und die Website
   danach neu geöffnet wird (= neue Sitzung), wird erneut gefragt.
   Technisch: sessionStorage (statt localStorage) — lebt nur so lange
   wie der Browser-Tab offen ist, wird beim Schließen automatisch
   gelöscht. Vor einer Entscheidung werden ausschließlich technisch
   notwendige Daten gespeichert (gar keine, bis geklickt wird) — keine
   Analytics/Tracking ohne aktive Zustimmung. */
const CONSENT_KEY = 'love_consent';
const CONSENT_VERSION = 2; /* hochzählen, wenn sich die Richtlinie ändert → erneute Zustimmung nötig */

function getConsent() {
  try {
    const raw = sessionStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== CONSENT_VERSION) return null;
    return parsed;
  } catch (e) { return null; }
}

function setConsent(choice) {
  const payload = {
    version: CONSENT_VERSION,
    necessary: true,
    analytics: !!choice.analytics,
    functional: !!choice.functional,
    decidedAt: new Date().toISOString(),
    mode: choice.mode || 'custom' /* 'all' | 'necessary' | 'custom' */
  };
  sessionStorage.setItem(CONSENT_KEY, JSON.stringify(payload));
  return payload;
}

function renderConsentGate() {
  if (document.getElementById('consentGate')) return;
  const wrap = document.createElement('div');
  wrap.className = 'consent-gate';
  wrap.id = 'consentGate';
  wrap.innerHTML =
    '<div class="consent-card">' +
      '<div class="consent-icon">🍪💜</div>' +
      '<h2>Deine Privatsphäre ist uns wichtig</h2>' +
      '<p>Willkommen bei <b>LoveBot</b>! Bevor es losgeht, möchten wir dir transparent erklären, ' +
      'welche Daten auf dieser Website gespeichert werden und dich um deine Zustimmung bitten — ' +
      'ganz im Sinne der <b>DSGVO</b> (Datenschutz-Grundverordnung).</p>' +
      '<p>Wir unterscheiden drei Kategorien von Speicherzugriffen. Du entscheidest selbst, welche ' +
      'du zusätzlich zu den technisch notwendigen erlaubst:</p>' +
      '<div class="consent-opts">' +
        '<label class="consent-opt locked">' +
          '<input type="checkbox" checked disabled>' +
          '<span class="consent-opt-txt"><b>🔒 Technisch notwendig</b>' +
            '<span>Login-Sitzungen (Dashboard/Owner-Bereich), Sicherheitsfunktionen (z.\u202fB. Schutz vor Angriffen), ' +
            'Grundeinstellungen wie Sprache/Theme. Ohne diese Daten funktioniert die Seite nicht — ' +
            'sie können deshalb nicht abgewählt werden.</span></span>' +
        '</label>' +
        '<label class="consent-opt">' +
          '<input type="checkbox" id="consentFunctional">' +
          '<span class="consent-opt-txt"><b>⚙️ Funktional</b>' +
            '<span>Merkt sich Komfort-Einstellungen (z.\u202fB. zuletzt gewählte Ansicht, Mood/Farbschema im Dashboard), ' +
            'damit du sie nicht bei jedem Besuch neu einstellen musst.</span></span>' +
        '</label>' +
        '<label class="consent-opt">' +
          '<input type="checkbox" id="consentAnalytics">' +
          '<span class="consent-opt-txt"><b>📊 Anonyme Statistiken</b>' +
            '<span>Hilft uns zu verstehen, welche Seiten/Befehle genutzt werden — komplett anonymisiert, ' +
            'ohne IP-Speicherung und ohne personenbezogene Auswertung.</span></span>' +
        '</label>' +
      '</div>' +
      '<details class="consent-details">' +
        '<summary>ℹ️ Mehr Details zur Speicherung &amp; deinen Rechten</summary>' +
        '<ul>' +
          '<li>Gespeichert wird ausschließlich <b>lokal in deinem Browser</b> (sessionStorage) — ' +
          'nichts davon wird an Dritte weitergegeben oder verkauft.</li>' +
          '<li>Deine Wahl gilt für <b>diese Browser-Sitzung</b> (also für alle Seiten der Website, solange ' +
          'der Tab geöffnet bleibt) und wird beim Schließen des Tabs automatisch gelöscht.</li>' +
          '<li>Du kannst deine Entscheidung jederzeit über den 🍪-Button unten links ändern.</li>' +
          '<li>Mehr Infos, welche Daten wie lange gespeichert werden und wie du deine Löschung/Auskunft ' +
          'nach Art.\u202f15\u202fDSGVO beantragst, findest du in unserer ' +
          '<a href="/datenschutz.html" target="_blank" rel="noopener">Datenschutzerklärung</a>.</li>' +
        '</ul>' +
      '</details>' +
      '<div class="consent-actions">' +
        '<button class="btn ghost" id="consentNecessaryBtn">Nur Notwendige</button>' +
        '<button class="btn" id="consentAllBtn">💜 Alle akzeptieren</button>' +
      '</div>' +
      '<div class="consent-actions" style="margin-top:6px">' +
        '<button class="btn ghost sm full" id="consentSaveBtn">✓ Auswahl speichern</button>' +
      '</div>' +
      '<p class="consent-fine">Diese Wahl gilt für deine aktuelle Browser-Sitzung. ' +
      '<a href="/datenschutz.html" target="_blank" rel="noopener">Datenschutzerklärung</a></p>' +
    '</div>';
  document.body.appendChild(wrap);

  /* Falls bereits eine Wahl existiert (z. B. Gate erneut über den
     🍪-Button geöffnet), Checkboxen entsprechend vorausfüllen. */
  const prev = getConsent();
  if (prev) {
    document.getElementById('consentAnalytics').checked = !!prev.analytics;
    document.getElementById('consentFunctional').checked = !!prev.functional;
  }

  document.getElementById('consentAllBtn').onclick = () => {
    setConsent({ analytics: true, functional: true, mode: 'all' });
    closeConsentGate();
  };
  document.getElementById('consentNecessaryBtn').onclick = () => {
    setConsent({ analytics: false, functional: false, mode: 'necessary' });
    closeConsentGate();
  };
  document.getElementById('consentSaveBtn').onclick = () => {
    const analytics = document.getElementById('consentAnalytics').checked;
    const functional = document.getElementById('consentFunctional').checked;
    setConsent({ analytics, functional, mode: 'custom' });
    closeConsentGate();
  };
}

function closeConsentGate() {
  const el = document.getElementById('consentGate');
  if (el) el.remove();
  ensureConsentRelaunch();
}

function ensureConsentRelaunch() {
  if (document.getElementById('consentRelaunch')) return;
  const btn = document.createElement('div');
  btn.className = 'consent-relaunch';
  btn.id = 'consentRelaunch';
  btn.title = 'Cookie-/Datenschutz-Einstellungen ändern';
  btn.textContent = '🍪';
  btn.onclick = () => {
    const gate = document.getElementById('consentGate');
    if (gate) { gate.remove(); }
    renderConsentGate();
  };
  document.body.appendChild(btn);
}

/* Beim Laden jeder Seite, die common.js einbindet: Prüft die für DIESE
   Sitzung (sessionStorage) gespeicherte Wahl. Existiert noch keine
   (neuer Tab / neue Sitzung / erster Besuch), wird das Gate gezeigt.
   Wurde in dieser Sitzung bereits entschieden (egal auf welcher Seite),
   bleibt das Gate auf allen weiteren Seiten (z. B. login.html) zu und
   nur der kleine 🍪-Wiedereinstiegsknopf erscheint. */
function initConsentGate() {
  if (getConsent()) {
    ensureConsentRelaunch();
  } else {
    renderConsentGate();
  }
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initConsentGate);
} else {
  initConsentGate();
}

/* ⚠️ Das frühere „📍 Standort- & Geräte-Gate" wurde auf Wunsch des Owners
   vollständig entfernt: kein Geolocation-Popup, keine Standort-Erfassung,
   keine „Zugriff nur nach Freigabe"-Sperre mehr. */

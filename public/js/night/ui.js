/* ============================================================================
   LoveBot — UI-Helfer: Chrome (Sidebar/Topbar), Toasts, Modals, Formatter
   ==========================================================================*/
(function () {
  'use strict';

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  /* ---------- Formatter ------------------------------------------------------ */
  const fmt = {
    num(n) { return Number(n || 0).toLocaleString('de-DE'); },
    dur(sec) {
      sec = Math.max(0, Math.floor(sec || 0));
      const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600),
            m = Math.floor((sec % 3600) / 60), s = sec % 60;
      const p = [];
      if (d) p.push(d + 'd');
      if (h) p.push(h + 'h');
      if (m) p.push(m + 'm');
      if (!p.length || s) p.push(s + 's');
      return p.join(' ');
    },
    durLong(sec) {
      sec = Math.max(0, Math.floor(sec || 0));
      const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600),
            m = Math.floor((sec % 3600) / 60);
      const p = [];
      if (d) p.push(d + ' Tage');
      if (h) p.push(h + ' Std.');
      p.push(m + ' Min.');
      return p.join(', ');
    },
    mb(n) { return Number(n || 0).toFixed(0) + ' MB'; },
    esc(s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }
  };

  /* ---------- Toast ----------------------------------------------------------- */
  function toast(title, text, type) {
    let wrap = $('#toasts');
    if (!wrap) { wrap = document.createElement('div'); wrap.id = 'toasts'; document.body.appendChild(wrap); }
    const t = document.createElement('div');
    t.className = 'toast ' + (type || '');
    t.innerHTML = '<b>' + fmt.esc(title) + '</b>' + (text ? fmt.esc(text) : '');
    wrap.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(() => t.remove(), 320); }, 4200);
  }

  /* ---------- Modal ------------------------------------------------------------- */
  function modal(html, actions) {
    const bg = document.createElement('div');
    bg.className = 'modal-bg';
    bg.innerHTML = '<div class="modal">' + html + '<div class="actions"></div></div>';
    const act = bg.querySelector('.actions');
    (actions || [{ label: 'Schließen', cls: 'ghost', onClick: close }]).forEach((a) => {
      const b = document.createElement('button');
      b.className = 'btn ' + (a.cls || '');
      b.textContent = a.label;
      b.onclick = () => a.onClick ? a.onClick(bg, close) : close();
      act.appendChild(b);
    });
    function close() { bg.remove(); }
    bg.addEventListener('click', (e) => { if (e.target === bg) close(); });
    document.body.appendChild(bg);
    return { el: bg, close };
  }

  function confirmBox(title, text, dangerLabel) {
    return new Promise((resolve) => {
      modal(
        '<h3>' + fmt.esc(title) + '</h3><p class="small dim">' + fmt.esc(text) + '</p>',
        [
          { label: 'Abbrechen', cls: 'ghost', onClick: (bg, close) => { close(); resolve(false); } },
          { label: dangerLabel || 'Bestätigen', cls: 'danger', onClick: (bg, close) => { close(); resolve(true); } }
        ]
      );
    });
  }

  /* ---------- Bausteine ----------------------------------------------------------- */
  function stat(lbl, val, sub, cls) {
    return '<div class="stat ' + (cls || 'pink') + '"><div class="lbl">' + fmt.esc(lbl) +
      '</div><div class="val">' + val + '</div>' + (sub ? '<div class="sub">' + fmt.esc(sub) + '</div>' : '') + '</div>';
  }

  function pill(status, label) {
    const map = {
      ONLINE: 'on', CONNECTED: 'on', ACTIVE: 'on', HEALTHY: 'on', SUCCESS: 'on', RESOLVED: 'on',
      OFFLINE: 'off', ERROR: 'off', BANNED: 'off', CRITICAL: 'off', STOPPED: 'off',
      WAITING: 'wait', QR_WAITING: 'wait', PAIRING: 'wait', WATCH: 'wait', CONNECTING: 'wait',
      SUSPICIOUS: 'wait', RECONNECTING: 'wait',
      INFO: 'info', OWNER: 'pink', ADMIN: 'vio', MOD: 'vio', HIGH: 'off', USER: 'mut', LIVE: 'on'
    };
    return '<span class="pill ' + (map[String(status).toUpperCase()] || 'mut') + '"><span class="d"></span>' +
      fmt.esc(label || status) + '</span>';
  }

  function table(cols, rows, emptyText) {
    if (!rows.length) return '<p class="dim small center" style="padding:22px">' + fmt.esc(emptyText || '☾ nichts hier… noch nicht.') + '</p>';
    return '<table class="tbl"><thead><tr>' + cols.map((c) => '<th>' + fmt.esc(c) + '</th>').join('') +
      '</tr></thead><tbody>' + rows.map((r) => '<tr>' + r.map((cell) => '<td>' + cell + '</td>').join('') + '</tr>').join('') + '</tbody></table>';
  }

  function panel(title, bodyHtml, headRight) {
    return '<div class="panel fade-in"><div class="head"><h2>' + fmt.esc(title) + '</h2>' +
      (headRight ? '<div class="right">' + headRight + '</div>' : '') + '</div><div class="body">' + bodyHtml + '</div></div>';
  }

  /* ---------- Chrome: Sidebar + Topbar ---------------------------------------------- */
  const NAV = [
    { grp: '☾ Overview' },
    { id: 'dashboard', icon: '🌃', label: 'Dashboard' },
    { id: 'monitor',   icon: '📡', label: 'Live Monitor' },
    { id: 'sessions',  icon: '🔗', label: 'Sessions' },
    { grp: '💜 Community' },
    { id: 'users',    icon: '👤', label: 'User' },
    { id: 'groups',   icon: '👥', label: 'Gruppen' },
    { id: 'love',     icon: '💍', label: 'Love-System' },
    { id: 'achieve',  icon: '🏆', label: 'Achievements' },
    { grp: '⚙ Control' },
    { id: 'commands', icon: '⌨️', label: 'Commands' },
    { id: 'features', icon: '🎛️', label: 'Features' },
    { id: 'broadcast',icon: '📢', label: 'Broadcast' },
    { grp: '🛡 System' },
    { id: 'logs',     icon: '📝', label: 'Logs' },
    { id: 'terminal', icon: '🖥️', label: 'Terminal' },
    { id: 'security', icon: '🛡️', label: 'Security' },
    { id: 'audit',    icon: '🧾', label: 'Audit' },
    { id: 'database', icon: '🗄️', label: 'Database' },
    { id: 'bans',     icon: '⛔', label: 'Bans' },
    { id: 'badwords', icon: '🤬', label: 'Badwords' },
    { id: 'owners',   icon: '👑', label: 'Owner' },
    { grp: '👤 Account & Team' },
    { id: 'account',  icon: '🪪', label: 'Mein Account', perm: 'self.view' },
    { id: 'accounts', icon: '👥', label: 'Accounts', perm: 'accounts.view' },
    { id: 'roles',    icon: '', label: 'Rollen & Rechte', perm: 'accounts.view' },
    { id: 'system',   icon: '🖧', label: 'System' },
    { id: 'settings', icon: '⚙️', label: 'Settings' }
  ];

  function chrome(opts) {
    const perms = (opts && opts.perms) || ['*'];
    const allowed = (n) => !n.perm || perms.includes('*') || perms.includes(n.perm);
    const nav = NAV.filter(allowed).map((n) => {
      if (n.grp) return '<div class="grp">' + fmt.esc(n.grp) + '</div>';
      return '<a href="#/' + n.id + '" data-route="' + n.id + '"><span class="ic">' + n.icon + '</span>' + fmt.esc(n.label) + (n.badge ? '<span class="badge-n">' + n.badge + '</span>' : '') + '</a>';
    }).join('');

    document.body.innerHTML =
      '<div id="bgCity"></div><div id="bgVignette"></div>' +
      '<div class="app">' +
        '<aside class="side" id="side">' +
          '<div class="brand"><img src="/assets/img/logo.png" alt="LoveBot"><div><div class="t1">LOVEBOT</div><div class="t2">MIDNIGHT CONTROL</div></div></div>' +
          '<nav class="nav" id="nav">' + nav + '</nav>' +
          '<div class="foot"><div class="moodline" data-moodline></div><div class="clock">☾ <span data-clock></span> · <span data-date></span></div></div>' +
        '</aside>' +
        '<header class="top">' +
          '<button class="btn ghost sm icon menu-btn" onclick="document.getElementById(\'side\').classList.toggle(\'open\')">☰</button>' +
          '<h1 id="pageTitle"><span class="n">☾</span> Dashboard</h1>' +
          '<div class="spacer"></div>' +
          '<span class="chip on" id="hbChip"><span class="dot"></span><span id="hbText">Bot online</span></span>' +
          '<span class="chip" id="moodChip" title="Mood wechseln" style="cursor:pointer">🌧️ lonely</span>' +
          '<span class="clock" data-clock></span>' +
          '<div class="me"><img src="/assets/img/logo.png" alt=""><div><b id="meName">…</b><span id="meRole"></span></div></div>' +
          '<button class="btn ghost sm" id="logoutBtn" title="Abmelden">⏻</button>' +
        '</header>' +
        '<main class="main" id="view"></main>' +
      '</div><div id="toasts"></div>';

    $('#logoutBtn').onclick = async () => {
      if (await confirmBox('Abmelden?', '☾ Deine Session wird beendet. Die Nacht bleibt.')) {
        await API.post('/api/logout');
        API.setToken('');
        location.href = '/login.html';
      }
    };

    $('#moodChip').onclick = () => {
      const moods = window.NightFX.MOODS;
      const cur = moods.findIndex((m) => m.id === NightFX.getMood());
      const next = moods[(cur + 1) % moods.length];
      NightFX.setMood(next.id);
      $('#moodChip').textContent = next.icon + ' ' + next.label;
      toast('☾ mood geändert', 'current mood: ' + next.icon + ' ' + next.label);
    };
    const m = window.NightFX.MOODS.find((x) => x.id === NightFX.getMood());
    if (m) $('#moodChip').textContent = m.icon + ' ' + m.label;

    if (opts && opts.demoPill) {
      const p = document.createElement('div');
      p.className = 'demo-pill';
      p.textContent = 'demo-modus · keine live-daten';
      document.body.appendChild(p);
    }
  }

  function setActiveNav(route) {
    $$('#nav a').forEach((a) => a.classList.toggle('active', a.dataset.route === route));
    const item = NAV.find((n) => n.id === route);
    if (item) $('#pageTitle').innerHTML = '<span class="n">' + item.icon + '</span> ' + fmt.esc(item.label);
    $('#side').classList.remove('open');
  }

  window.UI = { $, $$, fmt, toast, modal, confirmBox, stat, pill, table, panel, chrome, setActiveNav, NAV };
})();

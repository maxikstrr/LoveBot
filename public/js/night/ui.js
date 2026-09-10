/* ============================================================================
   LoveBot — UI-Helfer: Chrome (Sidebar/Topbar), Toasts, Modals, Formatter
   ==========================================================================*/
(function () {
  'use strict';

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  /* ---------- Formatter ------------------------------------------------------ */
  const fmt = {
    num(n) { const v = Number(n); return (Number.isFinite(v) ? v : 0).toLocaleString('de-DE'); },
    pct(n) { const v = Number(n); return (Number.isFinite(v) ? v : 0).toFixed(1); },
    dur(sec) {
      sec = Math.max(0, Math.floor(Number(sec) || 0));
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
      sec = Math.max(0, Math.floor(Number(sec) || 0));
      const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600),
            m = Math.floor((sec % 3600) / 60);
      const p = [];
      if (d) p.push(d + ' Tage');
      if (h) p.push(h + ' Std.');
      p.push(m + ' Min.');
      return p.join(', ');
    },
    mb(n) { const v = Number(n); return (Number.isFinite(v) ? v : 0).toFixed(0) + ' MB'; },
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

  /* ---------- Step-up-Reauth-Modal ---------------------------------------------
     Für kritische Aktionen (permanenter IP-Bann, Owner-Rechte, Passwort, Security
     deaktivieren, Wartungsmodus, DB löschen, alle Sessions killen): verlangt die
     erneute Eingabe des aktuellen Dashboard-Passworts, bevor die Aktion läuft. */
  function reauthModal(actionLabel, why) {
    return new Promise((resolve) => {
      const m = modal(
        '<div style="text-align:center;padding:2px 4px">' +
          '<div style="width:66px;height:66px;margin:0 auto 12px;border-radius:20px;display:flex;align-items:center;justify-content:center;font-size:30px;background:linear-gradient(145deg,rgba(255,120,190,.16),rgba(130,95,255,.16));border:1px solid rgba(255,255,255,.14);box-shadow:0 0 26px rgba(255,120,190,.12)">🔐</div>' +
          '<h3 style="margin:0 0 6px">Admin bestätigen</h3>' +
          '<p class="small dim" style="margin:0 auto;max-width:370px;line-height:1.5">' + fmt.esc(why || 'Diese Aktion braucht eine erneute Bestätigung mit deinem Admin-Passwort.') + '</p>' +
          '<p class="small" style="margin:10px auto 0;color:#8fe3ff;opacity:.9">Du bleibst eingeloggt — nur diese Aktion wird freigeschaltet.</p>' +
        '</div>' +
        '<label class="fld" style="margin-top:12px">Admin-Passwort</label>' +
        '<div class="row" style="gap:6px">' +
          '<input id="reauthPw" type="password" autocomplete="current-password" placeholder="••••••••••••" style="flex:1">' +
          '<button class="btn ghost" id="reauthEye" type="button" title="Passwort anzeigen/verbergen" style="padding:0 12px">👁</button>' +
        '</div>' +
        '<div class="msg" id="reauthMsg"></div>',
        [
          { label: 'Abbrechen', cls: 'ghost', onClick: (bg, close) => { close(); resolve(null); } },
          { label: '🔓 Bestätigen', cls: 'danger', onClick: (bg, close) => {
              const pw = bg.querySelector('#reauthPw').value || '';
              if (!pw) { bg.querySelector('#reauthMsg').className = 'msg error'; bg.querySelector('#reauthMsg').textContent = 'Bitte gib dein Admin-Passwort ein.'; bg.querySelector('#reauthPw').focus(); return; }
              close(); resolve(pw);
            } }
        ]
      );
      const doEnter = (bg) => { bg.querySelectorAll('.actions button')[1]?.click(); };
      setTimeout(() => {
        const i = m.el.querySelector('#reauthPw');
        const eye = m.el.querySelector('#reauthEye');
        if (i) {
          i.focus();
          i.onkeydown = (e) => { if (e.key === 'Enter') doEnter(m.el); };
          if (eye) eye.onclick = () => { const show = i.type === 'password'; i.type = show ? 'text' : 'password'; eye.textContent = show ? '🙈' : '👁'; i.focus(); };
        }
      }, 30);
    });
  }

  /* ---------- ⬇️ Download-Gate: Admin-Passwort (einstufig, im MS-Stil) --------
   Beim Herunterladen wird NUR das separate Admin-Passwort (aus .env) verlangt —
   KEIN Benutzername mehr. Die Datei selbst lässt sich zusätzlich mit einem
   „Datei-Login“ (Benutzername + Passwort beim Öffnen) schützen.
   Liefert {password} oder null bei Abbruch. */
  function adminPwModal(why, fileName) {
    return new Promise((resolve) => {
      const m = modal(
        '<div style="max-width:440px;margin:0 auto">' +
          /* Kopf */
          '<div style="text-align:center;margin-bottom:12px">' +
            '<img src="/assets/img/lovebot-logo.png" alt="LoveBot" style="width:76px;height:76px;border-radius:22px;border:1px solid rgba(255,255,255,.14);box-shadow:0 0 30px rgba(255,120,190,.22)">' +
          '</div>' +
          '<h3 style="margin:0 0 2px;text-align:center">Admin bestätigen</h3>' +
          '<p class="small dim" style="text-align:center;margin:0 auto 16px;max-width:370px;line-height:1.55">' +
            fmt.esc(why || 'Dieser Download ist nur für den Owner.') +
            (fileName ? '<br><span class="mono neon-pink" style="font-size:12px">' + fmt.esc(fileName) + '</span>' : '') +
          '</p>' +
          '<label class="fld">Admin-Passwort</label>' +
          '<div class="row" style="gap:6px">' +
            '<input id="apPw" type="password" autocomplete="current-password" placeholder="••••••••••••" style="flex:1">' +
            '<button class="btn ghost" id="apEye" type="button" title="Passwort anzeigen/verbergen" style="padding:0 12px">👁</button>' +
          '</div>' +
          '<div class="msg" id="apMsg"></div>' +
          '<div class="row" style="justify-content:flex-end;margin-top:12px">' +
            '<button class="btn" id="apGo" style="min-width:190px">⬇️ Freigeben & herunterladen</button>' +
          '</div>' +
          '<p class="small dim center" style="text-align:center;margin:14px 0 2px;color:#8fe3ff;opacity:.85">🔐 Nur für den Owner · jeder Download wird geloggt · das Passwort wird nirgends gespeichert.</p>' +
        '</div>',
        [
          { label: 'Abbrechen', cls: 'ghost', onClick: (bg, close) => { close(); resolve(null); } }
        ]
      );
      const el = m.el;
      const $1 = (s) => el.querySelector(s);
      const go = () => {
        const pw = $1('#apPw').value || '';
        if (!pw) { $1('#apMsg').className = 'msg error'; $1('#apMsg').textContent = 'Bitte gib dein Admin-Passwort ein.'; $1('#apPw').focus(); return; }
        m.close(); resolve({ password: pw });
      };
      setTimeout(() => {
        const pw = $1('#apPw'), eye = $1('#apEye');
        pw.focus();
        $1('#apGo').onclick = go;
        pw.onkeydown = (e) => { if (e.key === 'Enter') go(); };
        eye.onclick = () => { const s = pw.type === 'password'; pw.type = s ? 'text' : 'password'; eye.textContent = s ? '🙈' : '👁'; pw.focus(); };
      }, 30);
    });
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
    { id: 'all',       icon: '👑', label: 'Alles (Owner)', owner: true },
    { id: 'downloads', icon: '⬇️', label: 'Downloads', owner: true },
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
    { id: 'websessions', icon: '🖥️', label: 'Login-Sessions', perm: 'sessions.view' },
    { id: 'audit',    icon: '🧾', label: 'Audit' },
    { id: 'database', icon: '🗄️', label: 'Database' },
    { id: 'bans',     icon: '⛔', label: 'Bans' },
    { id: 'badwords', icon: '🤬', label: 'Badwords' },
    { id: 'owners',   icon: '👑', label: 'Owner' },
    { grp: '✨ Full-Update' },
    { id: 'charts',  icon: '📈', label: 'Charts' },
    { id: 'doku',    icon: '📚', label: 'Doku & Hilfe' },
    { id: 'updates', icon: '🗞️', label: 'Neuigkeiten' },
    { grp: '👤 Account & Team' },
    { id: 'account',  icon: '🪪', label: 'Mein Account', perm: 'self.view' },
    { id: 'history',  icon: '📜', label: 'Verlauf', perm: 'self.view' },
    { id: 'accounts', icon: '👥', label: 'Accounts', perm: 'accounts.view' },
    { id: 'roles',    icon: '', label: 'Rollen & Rechte', perm: 'accounts.view' },
    { id: 'system',   icon: '🖧', label: 'System' },
    { id: 'settings', icon: '⚙️', label: 'Settings' }
  ];

  function chrome(opts) {
    const perms = (opts && opts.perms) || ['*'];
    const role = (opts && opts.role) || '';
    /* 👑 Dieses Control-Panel ist ausschließlich für den Owner. Andere
       Rollen (deputy/admin/supporter/user) sehen in der Leiste keinerlei
       Control-Tabs — und alle Routen sind zusätzlich gesperrt. */
    const isOwner = role === 'owner' || perms.includes('*');
    const allowed = (n) => {
      if (!isOwner) return false;
      if (n.grp) return true;
      return !n.perm || perms.includes('*') || perms.includes(n.perm);
    };
    const nav = isOwner
      ? NAV.filter(allowed).map((n) => {
          if (n.grp) return '<div class="grp">' + fmt.esc(n.grp) + '</div>';
          return '<a href="#/' + n.id + '" data-route="' + n.id + '"><span class="ic">' + n.icon + '</span>' + fmt.esc(n.label) + (n.badge ? '<span class="badge-n">' + n.badge + '</span>' : '') + '</a>';
        }).join('')
      : '<div class="lock-msg">🔒 <b>Nur für den Owner</b><br><span>Dieses Control-Panel ist exklusiv dem Owner vorbehalten.</span></div>';

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

  window.UI = { $, $$, fmt, toast, modal, confirmBox, reauthModal, adminPwModal, stat, pill, table, panel, chrome, setActiveNav, NAV };
})();

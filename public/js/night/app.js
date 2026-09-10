/* ============================================================================
   LoveBot — MIDNIGHT CONTROL (SPA)
   ☾ alle Seiten, ein Shell. Routing über Hash.
   ==========================================================================*/
(function () {
  'use strict';
  const { $, $$, fmt, toast, modal, confirmBox, reauthModal, stat, pill, table, panel } = UI;
  let refreshTimer = null;

  function stopRefresh() { if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; } }

  /* 🔐 Für kritische Aktionen: postet normal, aber wenn der Server
     "needsReauth" zurückgibt, fragt es einmalig per Modal nach dem
     aktuellen Passwort und wiederholt den Request mit body.reauth gesetzt.
     Bricht sauber ab (null), wenn der Nutzer das Modal abbricht. */
  async function postCritical(path, body, why) {
    let r = await API.post(path, body || {});
    if (r.data && r.data.needsReauth) {
      const pw = await reauthModal(r.data.action, why);
      if (!pw) return null;
      r = await API.post(path, Object.assign({}, body || {}, { reauth: pw }));
    }
    return r;
  }
  function every(ms, fn) { stopRefresh(); refreshTimer = setInterval(fn, ms); }

  /* 🔑 Wiederholte Passwort-Bestätigung für geschützte Ansichten/Aktionen.
     Fragt das Admin-Passwort ab (wird nie gespeichert, nur serverseitig
     geprüft) und liefert true zurück, wenn der Server es bestätigt hat. */
  async function reauthGate(action, why) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const pw = await reauthModal(action, why);
      if (!pw) return false;
      const r = await API.post('/api/reauth/verify', { reauth: pw });
      if (r.data && r.data.ok) return true;
      if (r.data && r.data.needsReauth) { toast('✕ Passwort falsch', 'Bitte versuche es erneut.', 'error'); continue; }
      return true; /* Server nicht erreichbar o. ä. → nicht blockieren */
    }
    return false;
  }

  /* ⬇️ Download über POST-Endpoint (per Admin-Passwort-Gate).
     Baut den Blob-Download, wenn der Server ok antwortet. */
  async function downloadPost(path, body, fname) {
    try {
      const token = API.getToken();
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
        body: JSON.stringify(body || {})
      });
      if (res.status === 401) {
        const j = await res.json().catch(() => ({}));
        toast('✕ Zugriff verweigert', (j && j.error) || 'Admin-Passwort ungültig.', 'error');
        return false;
      }
      if (res.status === 403) {
        const j = await res.json().catch(() => ({}));
        toast('✕ Nur für den Owner', (j && j.error) || 'Nicht erlaubt.', 'error');
        return false;
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast('✕ Download fehlgeschlagen', (j && j.error) || 'Serverfehler.', 'error');
        return false;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fname || 'LoveBot-Download';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      toast('⬇️ Download gestartet', fname || '', 'ok');
      return true;
    } catch (netErr) {
      toast('✕ Netzwerkfehler', 'Server nicht erreichbar?', 'error');
      return false;
    }
  }

  /* ================================================================== */
  /*  VIEWS                                                             */
  /* ================================================================== */
  const V = {};

  /* ---------- Dashboard ---------- */
  V.dashboard = async (el) => {
    const [st] = await Promise.all([API.get('/api/stats')]);
    const s = st.data || {};
    const isOwner = ((window.__loveRole || '') === 'owner') || (window.__lovePerms || []).includes('*');
    const hb = s.heartbeat || {};
    const online = hb.online === true;
    const hour = new Date().getHours();
    const greet = hour < 5 ? 'Nachtwache 🌙' : hour < 11 ? 'Guten Morgen ✨' : hour < 18 ? 'Guten Tag ☁️' : 'Guten Abend 💜';
    const couplesN = (s.loveplus && (Number(s.loveplus.couples) || Number(s.loveplus.married) || 0)) || 0;
    const liveNow = new Date().toLocaleTimeString('de-DE');
    const tiles = isOwner
      ? '<div class="grid c4 mb">' +
          dashTile('#/all', '👑', 'Owner-Zentrale', 'alles in einem Blick & Export') +
          dashTile('#/downloads', '⬇️', 'Downloads', 'Brand-Kit · ZIP · Live-Excel') +
          dashTile('#/history', '📜', 'Verlauf', 'Historie je Konto') +
          dashTile('#/websessions', '🖥️', 'Login-Sessions', 'wer ist gerade eingeloggt') +
        '</div>'
      : '';
    el.innerHTML =
      /* Hero */
      '<div class="panel fade-in" style="border:1px solid rgba(255,255,255,.10);background:radial-gradient(1200px 260px at 15% -10%,rgba(255,45,149,.18),rgba(168,85,247,.10) 45%,rgba(0,240,255,.06) 80%,rgba(0,0,0,0) 100%),linear-gradient(120deg,rgba(255,255,255,.02),rgba(255,255,255,0));overflow:hidden">' +
        '<div class="body" style="display:flex;align-items:center;gap:18px;flex-wrap:wrap">' +
          '<div style="position:relative"><img src="/assets/img/lovebot-logo.png" alt="" style="width:74px;height:74px;border-radius:24px;border:1px solid rgba(255,255,255,.18);box-shadow:0 0 34px rgba(255,45,149,.35)">' +
            '<span style="position:absolute;right:-4px;bottom:-4px;width:18px;height:18px;border-radius:50%;background:' + (online ? '#34d399' : '#f87171') + ';border:3px solid #15111f;box-shadow:0 0 10px currentColor"></span></div>' +
          '<div style="flex:1;min-width:220px">' +
            '<div class="dim small" style="letter-spacing:3px">☾ LOVEBOT · MIDNIGHT CONTROL</div>' +
            '<h1 style="margin:2px 0 0;font-size:26px;background:linear-gradient(92deg,#ff2d95,#a855f7 55%,#00f0ff);-webkit-background-clip:text;background-clip:text;color:transparent">' + fmt.esc(greet) + '</h1>' +
            '<div class="dim" style="margin-top:2px">' + fmt.esc(liveNow) + ' — dein Bot ist ' + (online ? '<span style="color:var(--ok)">online</span>' : '<span style="color:var(--danger)">nicht erreichbar</span>') + ' · <span data-moodline></span></div>' +
          '</div>' +
          '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
            '<span class="pill ' + (online ? 'on' : 'off') + '"><span class="d"></span>WhatsApp ' + (online ? 'verbunden' : 'offline') + '</span>' +
            '<span class="pill ' + (s.dbHealthy ? 'on' : 'off') + '"><span class="d"></span>DB ' + (s.dbHealthy ? 'ok' : 'probleme') + '</span>' +
            '<span class="pill info"><span class="d"></span>' + (s.sessionsOnline || 0) + '/' + (s.sessionsTotal || 0) + ' Sessions live</span>' +
          '</div>' +
        '</div></div>' +
      '<div class="sep" style="margin:14px 0 12px"></div>' +
      tiles +
      '<div class="grid c4 mb">' +
        stat('🔗 Sessions', fmt.num(s.sessionsTotal || 0), (s.sessionsOnline || 0) + ' online', 'pink') +
        stat('💜 Nutzer', fmt.num(s.users || 0), 'registrierte Seelen', 'violet') +
        stat('💬 Nachrichten', fmt.num(s.messages || 0), 'gesendet & empfangen', 'cyan') +
        stat('⌨️ Befehle', fmt.num(s.commands || 0), 'ausgeführt', 'violet') +
      '</div>' +
      '<div class="grid c4 mb">' +
        stat('🌙 Uptime', fmt.dur(s.uptimeSec || 0), 'awake for a while', 'ok') +
        stat('🧠 RAM', fmt.mb(s.ramMb || 0) + (hb.ramMb ? '' : ''), 'Love.js Prozess', 'cyan') +
        stat(couplesN ? '💍 Paare' : '🚦 Status', couplesN ? fmt.num(couplesN) : (s.dbHealthy ? 'OK' : 'WARN'), couplesN ? 'verliebt & verheiratet' : 'Datenbank gesund', couplesN ? 'pink' : 'ok') +
        stat('🚨 Fehler', fmt.num(s.errors || 0), (s.warnings || 0) + ' warnings', (s.errors || 0) ? 'danger' : 'ok') +
      '</div>' +
      '<div class="grid c2">' +
        panel('☾ Live Feed', '<div class="term" style="border:none"><div class="screen" id="dashFeed" style="max-height:320px;min-height:220px"></div></div>') +
        panel('🔗 Sessions tonight', '<div id="dashSessions"></div>' +
          '<div class="sep"></div><p class="dim small center" style="font-style:italic" data-moodline></p>') +
      '</div>';
    const feed = async () => {
      const r = await API.get('/api/logs?lines=14');
      const lines = (r.data.lines || []).slice(-14);
      const box = $('#dashFeed');
      if (box) box.innerHTML = lines.map((l) =>
        '<div class="ln"><span class="t">' + fmt.esc(l.time) + '</span>  <span class="tag ' + fmt.esc(l.tag) + '">[' + fmt.esc(l.tag) + ']</span> <span class="msg-txt">' + fmt.esc(l.text) + '</span></div>').join('');
    };
    const sess = async () => {
      const r = await API.get('/api/sessions');
      const box = $('#dashSessions');
      if (!box) return;
      const list = (r.data.sessions || []).slice(0, 8);
      box.innerHTML = list.map((x) => {
        const stt = x.status || '';
        const connected = stt === 'CONNECTED';
        const waiting = ['QR_REQUIRED', 'WAITING_FOR_AUTH', 'CONNECTING', 'PAIRING'].includes(stt);
        const sub = connected
          ? 'online seit ' + fmt.dur(x.uptimeSec || 0)
          : waiting
            ? 'wartet auf Auth…'
            : (x.lastSeen ? 'letzter Kontakt vor ' + (function () {
                const sec = Math.max(0, Math.floor((Date.now() - new Date(x.lastSeen).getTime()) / 1000));
                return sec < 60 ? sec + 's' : sec < 3600 ? Math.floor(sec / 60) + 'm' : Math.floor(sec / 3600) + 'h';
              })() : '—');
        const pct = Math.max(4, Math.min(100, Number(x.uptimePct) || (connected ? 100 : 0)));
        const col = connected ? 'var(--ok)' : waiting ? 'var(--warn)' : 'var(--danger)';
        return '<div style="margin:8px 0">' +
          '<div class="row" style="gap:8px"><span class="mono" style="color:#fff;font-weight:600">' + fmt.esc(x.name || x.id) + '</span>' +
          '<span style="width:8px;height:8px;border-radius:50%;background:' + col + ';box-shadow:0 0 8px ' + col + ';margin-top:4px"></span>' +
          '<span class="dim small grow">' + fmt.esc(sub) + '</span>' +
          pill(connected ? 'ON' : (waiting ? 'WAIT' : 'OFF')) + '</div>' +
          '<div style="height:3px;border-radius:2px;background:rgba(255,255,255,.07);overflow:hidden"><div style="height:100%;width:' + pct + '%;background:linear-gradient(90deg,' + col + ',transparent)"></div></div>' +
        '</div>';
      }).join('') || '<p class="dim small">keine Sessions geladen.</p>';
    };
    await feed(); await sess();
    every(4000, feed);
  };

  /* Kachel für den Dashboard-Schnellzugriff */
  function dashTile(href, icon, title, desc) {
    return '<a href="' + href + '" style="text-decoration:none;display:block;border:1px solid rgba(255,255,255,.09);border-radius:14px;padding:14px 16px;background:linear-gradient(135deg,rgba(255,255,255,.03),rgba(255,255,255,.01));transition:all .18s ease" onmouseover="this.style.borderColor=\'rgba(255,45,149,.5)\';this.style.boxShadow=\'0 0 22px rgba(255,45,149,.15)\'" onmouseout="this.style.borderColor=\'\';this.style.boxShadow=\'\'">' +
      '<div style="font-size:24px;margin-bottom:6px">' + icon + '</div>' +
      '<div style="font-weight:700;color:#fff">' + fmt.esc(title) + '</div>' +
      '<div class="dim small" style="line-height:1.4;margin-top:2px">' + fmt.esc(desc) + '</div>' +
    '</a>';
  }

  /* ================================================================ */
  /*  👑 OWNER-ZENTRALE „Alles in einem“ (nur Owner)                  */
  /*  Zusammengefasst: Bot-Sessions, Login-Sessions, Gruppen, Rechte, */
  /*  Admin-Aktionen + Excel-Export aller Verwaltungsdaten.           */
  /* ================================================================ */
  const SECTIONS_XLSX = [
    ['gruppen', '👥 Gruppen (alle Infos)'],
    ['nutzer', '💜 Nutzer & Profile (WhatsApp)'],
    ['accounts', '🛡️ Accounts & Rechte (Panel)'],
    ['kontenhist', '📜 Konten-Historie (Rollen/Status)'],
    ['logins', '🖥️ Web-Login-Sessions'],
    ['ips', '🌐 IP-Übersicht (Login-IPs & Standorte)'],
    ['bans', '🚫 Sperren & Bans'],
    ['bot-sessions', '🤖 Bot-Sessions'],
    ['audit', '🧾 Audit-Log'],
    ['admin-actions', '🧰 Admin-Aktionen'],
    ['rollen', '🗂️ Rollen-Matrix']
  ];
  const fmtDT = (iso) => (iso ? new Date(iso).toLocaleString('de-DE') : '—');
  const fetchJson = async (url) => { const r = await API.get(url); return (r.data) || {}; };

  V.all = async (el) => {
    /* erst prüfen: Login-Sessions-Daten geben nur mit frischem Admin-Passwort frei */
    const wsProbe = await API.get('/api/sessions/all');
    if (wsProbe.data && wsProbe.data.needsReauth) {
      el.innerHTML =
        '<div class="panel fade-in" style="max-width:520px;margin:40px auto"><div class="body" style="text-align:center;padding:34px 22px">' +
        '<div style="font-size:40px;margin-bottom:10px">👑</div>' +
        '<h2 style="margin:0 0 8px">Owner-Zentrale</h2>' +
        '<p class="small dim" style="max-width:380px;margin:0 auto;line-height:1.55">Alles an einem Ort — Bot-Sessions, wer eingeloggt ist, Gruppen, Rechte und der Excel-Export.<br><b>Diese Ansicht ist nur für den Owner</b> und wird mit deinem Admin-Passwort freigeschaltet. Du bleibst dabei eingeloggt.</p>' +
        '<div class="row" style="justify-content:center;margin-top:18px"><button class="btn" id="allUnlock" style="padding:10px 22px;font-size:14px">🔓 Admin-Passwort eingeben</button></div>' +
        '<p class="dim small" style="margin-top:10px">Freischaltung gilt 5 Minuten, danach fragt die Seite erneut.</p>' +
        '</div></div>';
      const btn = $('#allUnlock', el);
      if (btn) btn.onclick = async () => { if (await reauthGate('sessions.view', 'Die Owner-Zentrale mit allen Details öffnen.')) route(); else toast('✕ Abgebrochen', 'Ohne Bestätigung bleibt die Zentrale gesperrt.', 'warn'); };
      return;
    }

    /* Daten parallel laden */
    const [stats, bots, groups, accs, adminAct] = await Promise.all([
      fetchJson('/api/stats'),
      fetchJson('/api/sessions'),
      fetchJson('/api/groups'),
      fetchJson('/api/accounts'),
      fetchJson('/api/admin-actions')
    ]);
    const wsList = (wsProbe.data && wsProbe.data.sessions) || [];
    const botList = bots.sessions || [];
    const groupsList = groups.groups || [];
    const accList = accs.accounts || [];
    const adminEntries = adminAct.entries || [];

    const nowStr = new Date().toLocaleString('de-DE');
    const botOnline = botList.filter((b) => b.status === 'CONNECTED').length;
    const botWait = botList.filter((b) => ['QR_REQUIRED', 'WAITING_FOR_AUTH', 'CONNECTING'].includes(b.status)).length;
    const accsRole = (role) => accList.filter((a) => a.role === role).length;

    /* ------- Login-Sessions Tabelle ------- */
    const loginRows = wsList.map((x) => [
      '<span class="n small">' + fmt.esc(x.username || '?') + '</span>' + (x.current ? ' <span class="pill on">DU</span>' : ''),
      pill((x.role || '').toUpperCase()),
      '<span class="mono small dim">' + fmt.esc(x.number) + '</span>',
      '<span class="mono small">' + fmt.esc(x.ip || '—') + '</span>' + (x.ipChanged ? ' <span class="pill wait" title="IP-Wechsel">⚠</span>' : ''),
      '<span class="dim small" style="display:inline-block;max-width:190px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + fmt.esc(x.userAgent || '—') + '</span>',
      '<span class="dim small mono">' + fmtDT(x.createdAt) + '</span>',
      '<span class="dim small mono">' + fmtDT(x.lastSeenAt) + '</span>'
    ]);

    /* ------- Bot-Sessions Tabelle ------- */
    const hLabel2 = { CONNECTED: 'verbunden', QR_REQUIRED: 'QR nötig', WAITING_FOR_AUTH: 'wartet', CONNECTING: 'verbindet…', DISCONNECTED: 'getrennt', PAUSED: 'pausiert', STOPPED: 'gestoppt', ERROR: 'fehler' };
    const botRows = botList.map((b) => [
      '<span class="n small">' + fmt.esc(b.name) + '</span>' + (b.source === 'spawned' ? ' <span class="dim" style="font-size:10px">⚙</span>' : ''),
      (b.status === 'CONNECTED' ? pill('ON', '● verbunden') : ['QR_REQUIRED', 'WAITING_FOR_AUTH', 'CONNECTING'].includes(b.status) ? pill('WAIT', '◌ ' + (hLabel2[b.status] || b.status)) : pill('OFF', '○ ' + (hLabel2[b.status] || b.status))),
      '<span class="mono small dim">' + fmt.esc(b.phone || '—') + '</span>',
      '<span class="num">' + fmt.num(b.messages) + '</span>',
      '<span class="num">' + fmt.num(b.commands) + '</span>',
      '<span class="num">' + fmt.num(b.groups) + '</span>'
    ]);

    /* ------- Gruppen (erste 8) ------- */
    const grpRows = groupsList.slice(0, 8).map((g) => [
      '<span class="n small">' + fmt.esc(g.subject || g.id) + '</span>',
      '<span class="mono small dim">' + fmt.esc(g.id) + '</span>',
      (g.active === false ? pill('OFF', 'inaktiv') : pill('ON', 'aktiv')),
      (g.antilink ? pill('ON', '🔗') : pill('OFF', '🔗')) + (g.welcome ? pill('ON', '👋') : pill('OFF', '👋')) + (g.badwords ? pill('ON', '🤬') : pill('OFF', '🤬'))
    ]);

    /* ------- Accounts (erste 8) ------- */
    const accRowsTbl = accList.slice(0, 8).map((a) => [
      '<span class="n small">' + fmt.esc(a.username) + '</span>' + (a.mustChange ? ' <span class="pill wait">PW</span>' : ''),
      pill(a.role.toUpperCase()),
      (a.scope && a.scope.type === 'group') ? '<span class="pill vio">GROUP</span>' : '<span class="dim small">global</span>',
      (a.status === 'locked' ? pill('OFF', 'gesperrt') : a.status === 'active' ? pill('ON', 'aktiv') : pill('WAIT', a.status)),
      '<span class="dim small">' + (a.lastLoginAt ? fmtDT(a.lastLoginAt) : 'nie') + '</span>'
    ]);

    /* ------- Admin-Aktionen (letzte 8) ------- */
    const actFeed = adminEntries.slice(0, 8).map((e) =>
      '<div class="ln"><span class="t">' + fmt.esc(e.time ? new Date(e.time).toLocaleTimeString('de-DE') : '') + '</span>' +
      '<span class="tag session">[' + fmt.esc(String(e.action || '').slice(0, 26)) + ']</span>' +
      '<span class="msg-txt">' + fmt.esc(String(e.target || '').slice(0, 70)) + ' <span class="dim">— ' + fmt.esc(e.actor || '') + '</span></span></div>'
    ).join('');

    /* ------- Export-Box ------- */
    const exportBoxes = SECTIONS_XLSX.map(([id, label], i) =>
      '<label class="small" style="display:flex;align-items:center;gap:8px;padding:4px 0;cursor:pointer"><input type="checkbox" data-sec="' + id + '" checked> ' + fmt.esc(label) + '</label>'
    ).join('');

    el.innerHTML =
      /* Hero */
      '<div class="panel fade-in" style="background:linear-gradient(120deg,rgba(255,120,190,.10),rgba(130,95,255,.08),rgba(70,200,255,.08));border:1px solid rgba(255,255,255,.10)">' +
      '<div class="body" style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">' +
      '<div style="width:58px;height:58px;border-radius:18px;display:flex;align-items:center;justify-content:center;font-size:30px;background:linear-gradient(145deg,rgba(255,120,190,.22),rgba(130,95,255,.22));border:1px solid rgba(255,255,255,.16);box-shadow:0 0 30px rgba(255,120,190,.15)">👑</div>' +
      '<div style="flex:1;min-width:220px"><h2 style="margin:0 0 2px">Owner-Zentrale</h2>' +
      '<span class="dim small">alles an einem Ort · nur du siehst diese Seite · Stand ' + fmt.esc(nowStr) + '</span></div>' +
      '<div class="right"><button class="btn ghost sm" onclick="route()">🔄 Aktualisieren</button></div>' +
      '</div></div>' +

      /* Stat-Karten */
      '<div class="grid c4 mb">' +
        stat('Bot-Sessions', fmt.num(botList.length), botOnline + ' online · ' + botWait + ' warten', 'pink') +
        stat('Web-Logins', fmt.num(wsList.length), wsList.filter((w) => w.ipChanged).length + ' IP-Wechsel', 'cyan') +
        stat('Gruppen', fmt.num(groupsList.length), 'in der Datenbank', 'violet') +
        stat('Accounts', fmt.num(accList.length), accsRole('admin') + ' Admin · ' + accsRole('supporter') + ' Support', 'ok') +
      '</div>' +

      '<div class="grid c2">' +
        /* Export-Builder */
        panel('📊 Excel-Export (.xlsx)',
          '<p class="dim small">Lade <b>alles</b> als echte, farbige Excel-Datei herunter — mit Übersichtsblatt, WhatsApp-Nutzern & Profilen (Level, XP, Wallet …), Panel-Accounts & Rechten, Konten-Historie, Web-Logins, Sperren, Gruppen, Bot-Sessions & allen Logs.</p>' +
          '<div class="grid" style="grid-template-columns:1fr 1fr;gap:2px 14px">' + exportBoxes + '</div>' +
          '<div class="sep"></div>' +
          '<div class="row" style="align-items:center;gap:12px;flex-wrap:wrap">' +
          '<button class="btn" onclick="APP.exportXlsx()" style="padding:10px 20px">⬇ Jetzt als .xlsx herunterladen</button>' +
          '<span class="dim small">🔐 verlangt einmalig dein Admin-Passwort</span></div>',
          '<span class="pill on">OWNER</span>') +

        /* Login-Sessions */
        panel('🖥️ Login-History — wer ist eingeloggt',
          '<div style="max-height:300px;overflow:auto">' + table(['Nutzer', 'Rolle', 'Nummer', 'IP', 'Gerät', 'Login', 'Aktiv'], loginRows, 'keine aktiven Sessions') + '</div>' +
          '<div class="row" style="margin-top:10px"><a class="btn ghost sm" href="#/websessions">→ Details & Sessions beenden</a></div>',
          '<span class="pill info">' + fmt.num(wsList.length) + '</span>') +
      '</div>' +

      '<div class="grid c2">' +
        /* Bot-Sessions */
        panel('🔗 Bot-Sessions',
          '<div style="max-height:300px;overflow:auto">' + table(['Bot', 'Status', 'Nummer', 'Msgs', 'Cmds', 'Gruppen'], botRows, 'noch keine Sessions') + '</div>' +
          '<div class="row" style="margin-top:10px"><a class="btn ghost sm" href="#/sessions">→ Sessions verwalten</a></div>',
          '<span class="pill pink">' + fmt.num(botList.length) + '</span>') +

        /* Admin-Aktionen Feed */
        panel('🧾 Letzte Admin-Aktionen',
          '<div class="term" style="border:none"><div class="screen" style="max-height:300px;min-height:180px">' + (actFeed || '<div class="ln"><span class="msg-txt dim">noch keine Aktionen</span></div>') + '</div></div>' +
          '<div class="row" style="margin-top:10px"><a class="btn ghost sm" href="#/logs">→ Alle Logs</a></div>',
          '<span class="pill ok">LOG</span>') +
      '</div>' +

      '<div class="grid c2">' +
        panel('👥 Gruppen (Übersicht)',
          table(['Gruppe', 'ID', 'Status', 'Schutz'], grpRows, 'noch keine Gruppen') +
          (groupsList.length > 8 ? '<p class="dim small center">… und ' + (groupsList.length - 8) + ' weitere — vollständig im Excel-Export</p>' : '') +
          '<div class="row" style="margin-top:10px"><a class="btn ghost sm" href="#/features">→ Features je Gruppe</a></div>',
          '<span class="pill vio">' + fmt.num(groupsList.length) + '</span>') +
        panel('🛡️ Dashboard-Accounts & Rechte',
          table(['User', 'Rolle', 'Scope', 'Status', 'Letzter Login'], accRowsTbl, 'keine Accounts') +
          (accList.length > 8 ? '<p class="dim small center">… und ' + (accList.length - 8) + ' weitere — vollständig im Excel-Export</p>' : '') +
          '<div class="row" style="margin-top:10px"><a class="btn ghost sm" href="#/accounts">→ Accounts & Akten</a></div>',
          '<span class="pill pink">' + fmt.num(accList.length) + '</span>') +
      '</div>' +
      '<p class="dim small center" style="text-align:center;margin:16px 0 4px">👑 Alles authentifiziert & geloggt — Admin-Passwort wird nirgends gespeichert.</p>';
  };


  /* ================================================================ */
  /*  ⬇️ DOWNLOADS (nur Owner): Brand-Kit + Live-Exporte              */
  /* ================================================================ */
  const fmtBytes = (b) => {
    const n = Number(b) || 0;
    return n < 1024 ? n + ' B' : n < 1024 * 1024 ? (n / 1024).toFixed(0) + ' KB' : (n / (1024 * 1024)).toFixed(1) + ' MB';
  };
  const fmtDate = (iso) => { try { return iso ? new Date(iso).toLocaleDateString('de-DE') : ''; } catch (e) { return ''; } };
  const brandMeta = (name) => {
    const n = String(name || '');
    if (n.startsWith('LoveBot-Firmenprofil')) return { ic: '📄', ext: 'DOCX', t: 'LoveBot-Firmenprofil', app: 'Word · LibreOffice Writer', f: 'Logo oben rechts auf jeder Seite · Kennzahlen & Kontakt', d: 'Das offizielle Unternehmensprofil für Partner, Sponsoren & Bewerbungen.' };
    if (n.startsWith('LoveBot-Praesentation')) return { ic: '🎞️', ext: 'PPTX', t: 'LoveBot-Präsentation', app: 'PowerPoint · LibreOffice Impress', f: 'Logo oben rechts auf jeder Folie · 6 Folien Midnight-Design', d: 'Foliensatz: Was ist LoveBot, Module, Zahlen & Fakten, Werte, Kontakt.' };
    if (n.startsWith('LoveBot-Factsheet')) return { ic: '📃', ext: 'RTF', t: 'LoveBot-Fact-Sheet', app: 'Word · WordPad', f: 'Kompakt auf einer Seite · farbiges Marken-Layout', d: 'Schneller Überblick über LoveBot — ideal zum Weiterschicken.' };
    if (n.startsWith('LoveBot-Logo.png')) return { ic: '🖼️', ext: 'PNG', t: 'LoveBot-Logo (PNG)', app: 'Bildbetrachter · Grafikprogramm', f: 'Transparenter Hintergrund · 1024 × 1024 px', d: 'Logo für Web, Dokumente & Social Media.' };
    if (n.startsWith('LoveBot-Logo.svg')) return { ic: '🎨', ext: 'SVG', t: 'LoveBot-Logo (SVG)', app: 'Browser · Illustrator · Figma', f: 'Vektor — unendlich skalierbar', d: 'Original-Vektor-Logo für Design & Druck.' };
    if (n.startsWith('LIESMICH')) return { ic: '📚', ext: 'TXT', t: 'Kit-Übersicht', app: 'Editor', f: 'Inhalt & Neu-Erzeugung', d: 'Was im Brand-Kit steckt und wie es sich aktualisieren lässt.' };
    return { ic: '📦', ext: (n.split('.').pop() || '').toUpperCase(), t: n, app: '—', f: '', d: 'Datei aus dem LoveBot-Brand-Kit.' };
  };

  V.downloads = async (el) => {
    const listRes = await API.get('/api/downloads/list');
    const dlLogin = (listRes.data && listRes.data.fileLogin) || { on: false, user: 'Maxichen' };
    const items = (listRes.data && listRes.data.items) || [];
    const nowStr = new Date().toLocaleString('de-DE');
    const sizeOf = (nm) => {
      const it = items.find((x) => x.name === nm);
      return it ? fmtBytes(it.size) : '—';
    };

    /* ---- Einzel-Dateien (Brand-Kit) ---- */
    const brandCards = items.map((f) => {
      const m = brandMeta(f.name);
      return '<div class="panel fade-in" style="margin-bottom:10px"><div class="body" style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">' +
        '<div style="width:54px;height:54px;border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:26px;background:linear-gradient(145deg,rgba(255,120,190,.16),rgba(130,95,255,.16));border:1px solid rgba(255,255,255,.12);flex:0 0 auto">' + m.ic + '</div>' +
        '<div style="flex:1;min-width:220px">' +
          '<div style="font-weight:600">' + fmt.esc(m.t) + ' <span class="pill vio" style="font-size:9px;padding:2px 8px;margin-left:6px">' + fmt.esc(m.ext) + '</span></div>' +
          '<div class="dim small" style="margin-top:2px">' + fmt.esc(m.d) + '</div>' +
          '<div class="small" style="margin-top:4px;opacity:.85">🖼️ ' + fmt.esc(m.f) + '</div>' +
          '<div class="small dim" style="margin-top:2px">📎 <span class="mono">' + fmt.esc(f.name) + '</span> · öffnen mit: ' + fmt.esc(m.app) + '</div>' +
        '</div>' +
        '<div style="text-align:right;flex:0 0 auto">' +
          '<button class="btn" data-name="' + fmt.esc(f.name) + '" onclick="APP.downloadBrand(this)">⬇️ Download</button>' +
          '<div class="dim small mono" style="margin-top:6px">' + fmt.esc(sizeOf(f.name)) + '</div>' +
        '</div>' +
      '</div></div>';
    }).join('');

    /* ---- All-in-one ZIP ---- */
    const zipCard =
      '<div class="panel fade-in" style="border:1px solid rgba(255,120,190,.35);background:linear-gradient(120deg,rgba(255,120,190,.09),rgba(130,95,255,.09),rgba(70,200,255,.06))"><div class="body">' +
        '<div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">' +
          '<div style="width:64px;height:64px;border-radius:18px;display:flex;align-items:center;justify-content:center;font-size:30px;background:linear-gradient(145deg,rgba(255,120,190,.22),rgba(130,95,255,.22));border:1px solid rgba(255,255,255,.14);box-shadow:0 0 26px rgba(255,120,190,.16);flex:0 0 auto">🗜️</div>' +
          '<div style="flex:1;min-width:230px">' +
            '<div style="font-weight:700;font-size:15px">LoveBot — All-in-one (.zip)</div>' +
            '<div class="dim small" style="margin-top:2px;line-height:1.55">Alles auf einmal, in einer Datei: komplettes <b>Brand-Kit</b> (Firmenprofil, Präsentation, Fact-Sheet, Logo) <b>+ aktuellen Live-.xlsx-Export</b> mit allen Tabellen (inkl. IP-Übersicht) + LIESMICH-Readme.</div>' +
            '<div style="margin-top:7px;display:flex;gap:6px;flex-wrap:wrap">' +
              '<span class="pill pink" style="font-size:10px">ZIP</span><span class="pill info" style="font-size:10px">XLSX</span><span class="pill vio" style="font-size:10px">DOCX</span><span class="pill on" style="font-size:10px">PPTX</span><span class="pill wait" style="font-size:10px">RTF</span><span class="pill mut" style="font-size:10px">PNG/SVG</span>' +
            '</div>' +
          '</div>' +
          '<button class="btn" onclick="APP.downloadAllZip()" style="flex:0 0 auto;padding:12px 22px;font-size:14px">🗜️ Alles als ZIP laden</button>' +
        '</div>' +
      '</div></div>';

    /* ---- Live-Export ---- */
    const liveCard =
      '<div class="panel fade-in"><div class="body">' +
        '<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">' +
          '<div style="width:54px;height:54px;border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:26px;background:linear-gradient(145deg,rgba(70,200,255,.15),rgba(130,95,255,.17));border:1px solid rgba(255,255,255,.12);flex:0 0 auto">🔬</div>' +
          '<div style="flex:1;min-width:220px">' +
            '<div style="font-weight:600">Alle Daten — Live-Export (.xlsx)</div>' +
            '<div class="dim small" style="margin-top:2px">Frisch generiert mit farbigen Tabellen: <b>Übersicht & Kennzahlen</b>, Gruppen, <b>Nutzer & Profile</b>, Nutzer-Details (Spiele · Bank · Liebe), Accounts & Rechte, Konten-Historie, Web-Sessions, <b>IP-Übersicht & Standorte</b>, Sperren, Bot-Sessions, Audit- & Admin-Aktionen, Rollen-Matrix — <b>12 Blätter + Cover</b>.</div>' +
            '<div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">' +
              '<span class="pill info" style="font-size:10px">XLSX</span><span class="pill" style="font-size:10px">dynamisch</span><span class="pill wait" style="font-size:10px">Stand ' + fmt.esc(nowStr) + '</span>' +
            '</div>' +
          '</div>' +
          '<button class="btn" onclick="APP.downloadsLiveXlsx()" style="flex:0 0 auto">⬇️ Als .xlsx laden</button>' +
        '</div>' +
        '<div class="sep"></div>' +
        '<div class="small dim" style="line-height:1.7">🌐 <b>IP-Übersicht:</b> jede Login-IP mit letzter Aktivität, Anzahl Anmeldungen, Benutzern (wer), Rollen, Gerät (Browser · OS) und Profil-Stadt. <i>Hinweis: Standort nur aus freiwilligen Profilangaben — keine IP-Geo-Abfrage.</i></div>' +
      '</div></div>';

    const infoCard =
      '<div class="panel fade-in" style="background:linear-gradient(120deg,rgba(255,120,190,.06),rgba(130,95,255,.05))"><div class="body">' +
        '<div style="font-weight:600;margin-bottom:6px">🔐 Schutzkonzept: Admin-Passwort (Download) · Datei-Login (Öffnen)</div>' +
        '<div class="dim small" style="line-height:1.65"><b>Herunterladen:</b> verlangt nur das separate <b>Admin-Passwort</b>. <b>Datei öffnen:</b> ' + (dlLogin.on
          ? 'jede heruntergeladene Office-Datei (auch jede in der ZIP) ist <b>automatisch geschützt</b> — beim Öffnen fragt Excel/Word/PowerPoint nach dem <b>Passwort</b> (Benutzer laut Vorgabe: <span class="mono">' + fmt.esc(dlLogin.user || 'Maxichen') + '</span>). Aktiv über <span class="mono">DATEI_LOGIN_PW</span> in der .env.'
          : 'jede heruntergeladene Datei kann mit dem Datei-Login-Tool so geschützt werden, dass beim Öffnen erst <b>Benutzername + Passwort</b> verlangt werden.') + ' Passwörter werden <b>nirgends gespeichert</b> — jeder Download landet im Audit- & Admin-Log.<br><br>Logo & Dokumente: <b>LoveBot by Maxichen</b> · Firmenname: <b>LoveBot</b> 💜</div>' +
      '</div></div>';

    el.innerHTML =
      '<div class="panel fade-in" style="background:linear-gradient(120deg,rgba(255,120,190,.10),rgba(130,95,255,.08),rgba(70,200,255,.08));border:1px solid rgba(255,255,255,.10)">' +
      '<div class="body" style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">' +
      '<img src="/assets/img/lovebot-logo.png" alt="LoveBot" style="width:62px;height:62px;border-radius:18px;border:1px solid rgba(255,255,255,.16);box-shadow:0 0 26px rgba(255,120,190,.18)">' +
      '<div style="flex:1;min-width:230px"><h2 style="margin:0 0 2px">Downloads</h2>' +
      '<span class="dim small">LoveBot-Brand-Kit, All-in-one-ZIP & Live-Exporte · nur für den Owner · Stand ' + fmt.esc(nowStr) + '</span></div>' +
      '<div class="right"><button class="btn ghost sm" onclick="route()">🔄 Aktualisieren</button></div>' +
      '</div></div>' +

      '<div class="sep" style="margin:16px 0 10px"></div>' +
      '<div class="grid" style="gap:10px">' + zipCard + '</div>' +

      '<div class="sep" style="margin:18px 0 10px"></div>' +
      '<h3 style="margin:0 0 2px">🎁 LoveBot-Brand-Kit <span class="dim small" style="font-weight:400">— einzeln</span></h3>' +
      '<p class="dim small" style="margin:0 0 12px">Fertig gestaltete Unternehmens-Dokumente mit Logo (oben rechts) & aktuellen Kennzahlen.</p>' +
      '<div class="grid c2" style="align-items:start">' + (brandCards || '<p class="dim small">Noch keine Brand-Dateien vorhanden — entpacke das Brand-Kit nach <span class="mono">Dokumente/BrandKit/</span>.</p>') + '</div>' +

      '<div class="sep" style="margin:18px 0 10px"></div>' +
      '<h3 style="margin:0 0 2px">🔬 Live-Exporte (deine Daten)</h3>' +
      '<p class="dim small" style="margin:0 0 12px">Berichte werden beim Klick frisch aus der LoveBot-Datenbank erzeugt.</p>' +
      '<div class="grid c2" style="align-items:start">' + liveCard + infoCard + '</div>' +

      '<p class="dim small center" style="text-align:center;margin:18px 0 4px">🗂️ Brand-Dateien liegen in <span class="mono">Dokumente/BrandKit/</span> · Neu erzeugbar via <span class="mono">python3 scripts/make-brandkit.py</span> (nur Entwicklung).</p>';
  };

  /* ---------- Live Monitor ---------- */
  V.monitor = async (el) => {
    el.innerHTML =
      '<div class="panel fade-in"><div class="head"><h2>📡 Live Monitor</h2><div class="right"><span class="pill on"><span class="d"></span>LIVE</span></div></div>' +
      '<div class="body"><div class="grid c4 mb" id="monStats"></div>' +
      '<div class="term"><div class="bar"><span class="dots"><i></i><i></i><i></i></span><span class="title">lovebot — monitor watch</span></div>' +
      '<div class="screen" id="monScreen" style="max-height:420px"></div></div></div></div>';
    /* Zahl sicher formatieren: verhindert NaN/undefined in der Anzeige. */
    const num = (v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };
    const tick = async () => {
      const [s, sys] = await Promise.all([API.get('/api/stats'), API.get('/api/system')]);
      const d = s.data || {}, y = sys.data || {};
      const box = $('#monStats');
      if (box) box.innerHTML =
        stat('CPU', fmt.pct(num(y.cpu)) + '%', 'load average', 'cyan') +
        stat('RAM', fmt.mb(num(y.ramMb || d.ramMb)), 'von ' + fmt.mb(num(y.ramTotalMb || 8192)), 'pink') +
        stat('Disk', fmt.pct(num(y.diskPct)) + '%', 'belegt', 'violet') +
        stat('Heap', fmt.mb(num(y.heapMb)), 'node ' + (y.node || ''), 'ok');
      const sc = $('#monScreen');
      if (sc) {
        const now = new Date().toLocaleTimeString('de-DE');
        const cpu = fmt.pct(num(y.cpu));
        const dbOk = y.dbHealthy !== undefined ? y.dbHealthy : (d.dbHealthy !== undefined ? d.dbHealthy : null);
        const dbTxt = dbOk === null ? '—' : (dbOk ? '✅ healthy' : '⚠ check');
        const row = '<div class="ln"><span class="t">' + now + '</span>  <span class="tag session">[monitor]</span> <span class="msg-txt">sessions ' +
          num(d.sessionsOnline) + '/' + num(d.sessionsTotal) + ' · msg ' + fmt.num(num(d.messages)) + ' · cmd ' + fmt.num(num(d.commands)) +
          ' · cpu ' + cpu + '% · ram ' + fmt.mb(num(y.ramMb || d.ramMb)) + ' · db ' + dbTxt + '</span></div>';
        sc.insertAdjacentHTML('beforeend', row);
        while (sc.children.length > 60) sc.removeChild(sc.firstChild);
        sc.scrollTop = sc.scrollHeight;
      }
    };
    await tick(); every(3000, tick);
  };

  /* ---------- Sessions ---------- */
  V.sessions = async (el) => {
    const r = await API.get('/api/sessions');
    const all = (r.data.sessions || []);
    const online = all.filter((x) => x.status === 'CONNECTED').length;
    const waiting = all.filter((x) => ['QR_REQUIRED', 'WAITING_FOR_AUTH', 'CONNECTING'].includes(x.status)).length;
    const offline = all.length - online - waiting;
    const hLabel = { CONNECTED: 'verbunden', QR_REQUIRED: 'QR nötig', WAITING_FOR_AUTH: 'wartet auf Anmeldung', CONNECTING: 'verbindet…', DISCONNECTED: 'getrennt', PAUSED: 'pausiert', STOPPED: 'gestoppt', ERROR: 'fehler' };
    const rows = all.map((x) => {
      const stOn = x.status === 'CONNECTED';
      const stWait = ['QR_REQUIRED', 'WAITING_FOR_AUTH', 'CONNECTING'].includes(x.status);
      const isMain = x.id === 'main';
      const canControl = (window.__lovePerms || []).includes('*') || (window.__lovePerms || []).includes('sessions.control');
    const acts = '<div class="row">' +
        (isMain
          ? '<span class="dim small" style="font-size:10px">👑 Haupt-Bot</span>'
          : '<button class="btn ghost sm" title="Neustart" onclick="APP.sessionAct(\'restart\',\'' + fmt.esc(x.id) + '\')">↻</button>' +
            '<button class="btn ghost sm" title="QR anzeigen" onclick="APP.sessionQr(\'' + fmt.esc(x.id) + '\')">▣</button>' +
            (canControl ? '<button class="btn ghost sm" title="QR in alle Gruppen senden" onclick="APP.sessionQrGroup(\'' + fmt.esc(x.id) + '\')">📤</button>' : '') +
            '<button class="btn danger sm" title="Session endgültig löschen" onclick="APP.sessionDelete(\'' + fmt.esc(x.id) + '\')">🗑</button>') +
        '</div>';
      return [
        '<span class="n">' + fmt.esc(x.name) + (x.source === 'spawned' ? ' <span class="dim" style="font-size:10px">⚙</span>' : '') + '</span>',
        (stOn ? pill('ON', '● ' + hLabel[x.status] || x.status) : stWait ? pill('WAIT', '◌ ' + (hLabel[x.status] || x.status)) : pill('OFF', '○ ' + (hLabel[x.status] || x.status))),
        '<span class="mono small">' + fmt.esc(x.phone || '—') + '</span>',
        '<span class="num">' + (x.uptimeSec ? fmt.dur(x.uptimeSec) : '—') + '</span>',
        '<span class="num">' + fmt.num(x.messages) + '</span>',
        '<span class="num">' + fmt.num(x.commands) + '</span>',
        '<span class="num">' + fmt.num(x.groups) + '</span>',
        '<span class="small dim">' + (x.health && x.health.emoji ? x.health.emoji + ' ' : '') + fmt.esc((x.health && x.health.label) || '—') + '</span>',
        acts
      ];
    });
    el.innerHTML =
      '<div class="grid c4 mb">' +
        stat('Total', fmt.num(all.length), 'sessions in der Registry', 'pink') +
        stat('Online', fmt.num(online), 'verbunden', 'ok') +
        stat('Warten', fmt.num(waiting), 'QR/Pairing nötig', 'warn') +
        stat('Offline', fmt.num(offline), 'getrennt/gestoppt', 'danger') +
      '</div>' +
      panel('☾ Sessions', table(['Name', 'Status', 'Phone', 'Uptime', 'Msgs', 'Cmds', 'Gruppen', 'Health', 'Aktionen'], rows, '☾ noch keine Sessions.'), '<button class="btn sm" onclick="APP.newSession()">+ New Session</button>' +
        '<button class="btn ghost sm" onclick="APP.startAllSessions()" style="margin-left:8px">▶️ Alle starten</button>' +
        '<span class="dim small" style="display:block;margin-top:6px">👑 Haupt-Bot: <span class="mono neon-pink">LoveBot_Maxichen !</span></span>');
  };

  /* ---------- Users ---------- */
  V.users = async (el) => {
    const r = await API.get('/api/users');
    const rows = (r.data.users || []).map((u) => [
      '<span class="n">' + fmt.esc(u.name) + '</span>',
      '<span class="mono small dim">' + fmt.esc(u.phone) + '</span>',
      '<span class="neon-pink mono">Lv ' + u.level + '</span>' + (u.prestige ? ' <span class="neon-violet mono">P' + u.prestige + '</span>' : ''),
      '<span class="num">' + fmt.num(u.xp) + '</span>',
      '<span class="num">' + u.streak + ' 🔥</span>',
      pill(u.role.toUpperCase()),
      u.banned ? pill('BANNED') : pill('ACTIVE'),
      '<span class="small dim">' + fmt.esc(u.title || '') + '</span>'
    ]);
    el.innerHTML = '<div class="grid c3 mb">' +
      stat('User gesamt', fmt.num((r.data.users || []).length + 1278), '1.284 Seelen erinnert', 'pink') +
      stat('Aktiv heute', '312', 'messages & commands', 'cyan') +
      stat('Gebannt', fmt.num((r.data.users || []).filter((u) => u.banned).length), '☾ nobody is forgotten', 'danger') +
      '</div>' +
      panel('👥 User', table(['Name', 'Nummer', 'Level', 'XP', 'Streak', 'Rolle', 'Status', 'Titel'], rows));
  };

  /* ---------- Groups ---------- */
  V.groups = async (el) => {
    const r = await API.get('/api/groups');
    const rows = (r.data.groups || []).map((g) => [
      '<span class="n">' + fmt.esc(g.subject) + '</span>',
      '<span class="mono small dim">' + fmt.esc(g.id) + '</span>',
      (g.active === false ? pill('OFF', 'inaktiv') : pill('ON', 'aktiv')),
      (g.antilink ? pill('ON', 'antilink') : pill('OFF', 'antilink')) + ' ' +
        (g.welcome ? pill('ON', 'welcome') : pill('OFF', 'welcome')) + ' ' +
        (g.badwords ? pill('ON', 'badwords') : pill('OFF', 'badwords'))
    ]);
    el.innerHTML = '<p class="dim small mb">Details & Feature-Schalter je Gruppe findest du unter <a href="#/features" style="color:var(--accent)">🎛️ Features</a>.</p>' +
      panel('👥 Gruppen', table(['Gruppe', 'Gruppen-ID', 'Status', 'Schutz-Features'], rows));
  };

  /* ---------- Love-System ---------- */
  V.love = async (el) => {
    const r = await API.get('/api/love');
    const d = r.data || {};
    const lb = (d.leaderboard || []).map((u, i) => [
      '<span class="mono neon-cyan">#' + (i + 1) + '</span>',
      '<span class="n">' + fmt.esc(u.name) + '</span>',
      '<span class="neon-pink mono">Lv ' + u.level + '</span>',
      '<span class="num">' + fmt.num(u.xp) + ' XP</span>',
      '<div class="bar-track" style="width:110px"><div class="bar-fill" style="width:' + Math.min(100, (u.xp % 50000) / 500) + '%"></div></div>',
      '<span class="small dim">' + fmt.esc(u.title || '') + '</span>'
    ]);
    const lv = (d.levels || []).map((l) =>
      '<div class="ach"><span class="ic">' + l.icon + '</span><div><b>' + l.icon + ' Love Level ' + l.lv + '</b><span>' + fmt.esc(l.title) + '</span></div></div>').join('');
    el.innerHTML = '<div class="grid c2">' +
      panel('🏆 Love-Leaderboard', table(['#', 'Seele', 'Level', 'XP', 'Fortschritt', 'Titel'], lb)) +
      '<div>' + panel('💎 Love-Level', '<div class="grid" style="gap:9px">' + lv + '</div>') +
      '<div class="mt">' + panel('☾ tonight', '<p class="dim small" style="font-style:italic;margin:0">„some people deserve to hear<br>that they are loved.“</p><div class="sep"></div><div class="kv"><span class="k">couples married</span><span class="v">14</span><span class="k">crushes confessed</span><span class="v">37</span><span class="k">hugs sent</span><span class="v">412</span></div>') + '</div></div>' +
      '</div>';
  };

  /* ---------- Achievements ---------- */
  V.achieve = async (el) => {
    const r = await API.get('/api/love');
    const ach = (r.data.achievements || []);
    const unlocked = new Set(['firstlove', 'msg100', 'streak7']);
    el.innerHTML = panel('🏆 Achievements', '<div class="grid c2">' + ach.map((a) =>
      '<div class="ach ' + (unlocked.has(a.id) ? '' : 'locked') + '"><span class="ic">' + a.icon + '</span><div><b>' + fmt.esc(a.name) + '</b><span>' + fmt.esc(a.desc) + '</span></div>' +
      '<span style="margin-left:auto">' + (unlocked.has(a.id) ? pill('ON', 'unlocked') : pill('MUT', 'locked')) + '</span></div>').join('') + '</div>');
  };

  /* ---------- Commands ---------- */
  V.commands = async (el) => {
    const cats = window.LOVE_CATS, cmds = window.LOVE_COMMANDS;
    const live = cmds.filter((c) => c.status === 'live').length;
    const plan = cmds.length - live;
    let body = '';
    for (const cat of cats) {
      const list = cmds.filter((c) => c.cat === cat.id);
      if (!list.length) continue;
      const rows = list.map((c) => [
        '<span class="mono neon-pink">$' + fmt.esc(c.name) + '</span>' + (c.aliases.length ? '<span class="dim small"> · ' + c.aliases.map((a) => '$' + a).join(', ') + '</span>' : ''),
        '<span class="small">' + fmt.esc(c.desc) + '</span>',
        c.feature ? '<span class="pill vio">' + fmt.esc(c.feature) + '</span>' : '<span class="dim small">—</span>',
        pill(c.perm.toUpperCase()),
        c.neu ? pill('INFO', 'NEU') : (c.status === 'live' ? pill('ON') : pill('WAIT', 'geplant'))
      ]);
      body += '<div class="mb">' + panel(cat.icon + ' ' + cat.label, table(['Befehl', 'Beschreibung', 'Feature', 'Permission', 'Status'], rows)) + '</div>';
    }
    el.innerHTML = '<div class="grid c3 mb">' +
      stat('Befehle', fmt.num(cmds.length), 'registriert', 'pink') +
      stat('Live', fmt.num(live), 'im Bot aktiv', 'ok') +
      stat('Geplant', fmt.num(plan), '☾ coming soon', 'warn') + '</div>' + body;
  };

  /* ---------- Features ---------- */
  V.features = async (el) => {
    const r = await API.get('/api/groups');
    const groups = (r.data && r.data.groups) || [];
    if (!groups.length) {
      el.innerHTML = panel('🎛️ Gruppen-Features', '<p class="dim small">☾ noch keine Gruppen in der Datenbank. Sobald der Bot Gruppen kennt, kannst du hier je Gruppe schalten (oder per <span class="mono neon-pink">$gi</span> in der Gruppe).</p>');
      return;
    }
    const selJid = (window.__featGroup && groups.some((g) => g.id === window.__featGroup)) ? window.__featGroup : groups[0].id;
    window.__featGroup = selJid;
    const cur = groups.find((g) => g.id === selJid) || groups[0];
    window.__featGroupLabel = cur.subject || cur.id;
    const opt = groups.map((g) => '<option value="' + g.id + '" ' + (g.id === selJid ? 'selected' : '') + '>' + fmt.esc(g.subject || g.id) + '</option>').join('');
    const webKeys = ['autodl', 'welcome', 'goodbye', 'badwords', 'antilink', 'active'];
    const cards = window.LOVE_FEATURES.map((f) => {
      /* Diese Features lassen sich nur im WhatsApp-Chat der Gruppe schalten ($an/$aus) */
      if (!webKeys.includes(f.key)) {
        return '<div class="stat violet" style="opacity:.6"><div class="lbl">' + f.emoji + ' ' + fmt.esc(f.key) + '</div>' +
          '<div class="val" style="font-size:15px;color:#fff;text-shadow:none">' + fmt.esc(f.label) + '</div>' +
          '<div class="sub">' + fmt.esc(f.desc) + '</div>' +
          '<div class="mt-s"><span class="pill mut">💬 per $an/$aus</span></div></div>';
      }
      const on = cur[f.key] === true;
      return '<div class="stat ' + (on ? 'pink' : 'danger') + '" style="cursor:pointer" data-on="' + (on ? 1 : 0) + '" onclick="APP.toggleFeature(\'' + f.key + '\', this)">' +
        '<div class="lbl">' + f.emoji + ' ' + fmt.esc(f.key === 'active' ? 'gruppe aktiv' : f.key) + '</div>' +
        '<div class="val" style="font-size:15px;color:#fff;text-shadow:none">' + fmt.esc(f.label) + '</div>' +
        '<div class="sub">' + fmt.esc(f.desc) + '</div>' +
        '<div class="mt-s">' + (on ? pill('ON', 'an in dieser Gruppe') : pill('OFF', 'aus in dieser Gruppe')) + '</div></div>';
    }).join('');
    el.innerHTML =
      '<div class="panel fade-in"><div class="head"><h2>🎛️ Gruppen-Features</h2>' +
      '<div class="right"><span class="dim small">Bot: <span class="mono neon-pink">$an/$aus &lt;feature&gt;</span> · <span class="mono neon-cyan">$gi</span></span></div></div><div class="body">' +
      '<label class="fld">Gruppe wählen</label>' +
      '<div class="row" style="gap:10px;flex-wrap:wrap"><select id="featGroupSel" style="max-width:460px">' + opt + '</select>' +
      '<span class="dim small" style="align-self:center">Features gelten immer <b>für genau eine Gruppe</b>.</span></div>' +
      '<p class="dim small">Schalter zeigen den <b>echten Live-Zustand</b> von „' + fmt.esc(cur.subject || cur.id) + '“ — ein Klick schaltet wie <span class="mono neon-pink">$an/$aus</span> in der Gruppe.' +
      (cur.active === false ? '<br><span class="neon-pink">⚠️ Gruppe ist gerade inaktiv — Features greifen erst, wenn „gruppe aktiv“ wieder an ist.</span>' : '') +
      '</p><div class="grid c3">' + cards + '</div></div></div>';
    const sel = $('#featGroupSel');
    if (sel) sel.onchange = () => { window.__featGroup = sel.value; route(); };
  };

  /* ---------- Broadcast ---------- */
  V.broadcast = (el) => {
    el.innerHTML = panel('📢 Broadcast an alle Gruppen',
      '<label class="fld">Nachricht</label><textarea id="bcText" rows="5" placeholder="☾ Deine Nachricht an alle Gruppen…"></textarea>' +
      '<div class="row mt"><button class="btn" onclick="APP.broadcast()">📢 Senden</button>' +
      '<span class="dim small">wird über die Webmail-Queue an Love.js übergeben</span></div>');
  };

  /* ---------- Logs ---------- */
  V.logs = async (el) => {
    el.innerHTML = panel('📝 Logs', '<div class="filters mb" id="logFilters">' +
      ['ALL', 'BOOT', 'SESSION', 'MESSAGE', 'COMMAND', 'FEATURES', 'DASHBOARD', 'LOVE', 'ERROR'].map((f, i) =>
        '<button class="' + (i === 0 ? 'active' : '') + '" data-f="' + f + '">' + f + '</button>').join('') +
      '</div><div class="term"><div class="bar"><span class="dots"><i></i><i></i><i></i></span><span class="title">lovebot.log — live</span></div>' +
      '<div class="screen" id="logScreen" style="max-height:480px"></div></div>');
    let filter = 'ALL';
    $('#logFilters').onclick = (e) => {
      if (e.target.dataset.f) {
        filter = e.target.dataset.f;
        $$('#logFilters button').forEach((b) => b.classList.toggle('active', b === e.target));
        load();
      }
    };
    const load = async () => {
      const r = await API.get('/api/logs?lines=120');
      let lines = r.data.lines || [];
      if (filter !== 'ALL') lines = lines.filter((l) => l.tag.toUpperCase() === filter);
      const sc = $('#logScreen');
      if (sc) {
        sc.innerHTML = lines.map((l) =>
          '<div class="ln"><span class="t">' + fmt.esc(l.time) + '</span>  <span class="tag ' + fmt.esc(l.tag) + '">[' + fmt.esc(l.tag) + ']</span> <span class="msg-txt">' + fmt.esc(l.text) + '</span></div>').join('') +
          '<div class="ln"><span class="prompt">LoveBot ›</span> <span class="cursor"></span></div>';
        sc.scrollTop = sc.scrollHeight;
      }
    };
    await load(); every(3000, load);
  };

  /* ---------- Terminal (im Browser) ---------- */
  V.terminal = async (el) => {
    el.innerHTML = '<div class="term fade-in"><div class="bar"><span class="dots"><i></i><i></i><i></i></span>' +
      '<span class="title">lovebot console — web</span><span style="margin-left:auto" class="dim small">tippe <b class="neon-cyan">help</b></span></div>' +
      '<div class="screen" id="tScreen" style="max-height:560px"></div>' +
      '<div class="row" style="padding:10px 14px;border-top:1px solid var(--border-soft)">' +
      '<span class="prompt">LoveBot ›</span><input id="tInput" class="mono" style="background:transparent;border:none;box-shadow:none" placeholder="help · status · sessions · logs · mood …" autocomplete="off"></div></div>';
    const sc = $('#tScreen'), inp = $('#tInput');
    const out = (html) => { sc.insertAdjacentHTML('beforeend', '<div class="ln">' + html + '</div>'); sc.scrollTop = sc.scrollHeight; };
    out('<span class="neon-violet">☾ good evening.</span>');
    out('<span class="dim">☾ I was waiting for you.</span>');
    out('<span class="dim">tippe </span><span class="neon-cyan">help</span><span class="dim"> für alle Befehle.</span>');
    out('&nbsp;');
    const CMDS = {
      help: () => {
        out('<span class="neon-pink">help</span>');
        out('────────────────────────────');
        out('<span class="neon-cyan">☾ status</span>      <span class="dim">system & sessions</span>');
        out('<span class="neon-cyan">☾ sessions</span>    <span class="dim">manage connections</span>');
        out('<span class="neon-cyan">☾ users</span>       <span class="dim">souls of the night</span>');
        out('<span class="neon-cyan">☾ logs</span>        <span class="dim">tonight\'s memories</span>');
        out('<span class="neon-cyan">♡ love</span>        <span class="dim">leaderboard</span>');
        out('<span class="neon-cyan">⚙ mood</span>        <span class="dim">change the atmosphere</span>');
        out('<span class="neon-cyan"> uptime</span>      <span class="dim">how long I\'m awake</span>');
        out('<span class="neon-cyan">⌫ clear</span>       <span class="dim">wipe the screen</span>');
        out('<span class="neon-cyan">× shutdown</span>    <span class="dim">turn everything off</span>');
      },
      status: async () => {
        const r = await API.get('/api/stats'); const d = r.data || {};
        out('<span class="neon-violet">☾ I\'m still here.</span>');
        out('sessions   › ' + (d.sessionsTotal || 0) + '  (' + (d.sessionsOnline || 0) + ' online)');
        out('users      › ' + fmt.num(d.users || 0));
        out('groups     › ' + fmt.num(d.groups || 0));
        out('messages   › ' + fmt.num(d.messages || 0));
        out('errors     › ' + (d.errors || 0));
        out('uptime     › ' + fmt.durLong(d.uptimeSec || 0));
        out('<span class="neon-pink">♡ everything seems okay.</span>');
      },
      sessions: async () => {
        const r = await API.get('/api/sessions');
        out('<span class="neon-violet">☾ sessions tonight</span>');
        (r.data.sessions || []).forEach((s, i) => {
          out(String(i + 1).padStart(2, '0') + '  <span class="' + (s.status === 'ONLINE' ? 'neon-cyan' : s.status === 'OFFLINE' ? 'dim' : 'neon-pink') + '">' +
            (s.status === 'ONLINE' ? '●' : s.status === 'OFFLINE' ? '○' : '◌') + ' ' + fmt.esc(s.name).padEnd(10) + '</span> ' +
            '<span class="dim">' + s.status + (s.uptime ? ' · awake for ' + fmt.dur(s.uptime / 1000) : '') + '</span>');
        });
      },
      users: async () => {
        const r = await API.get('/api/users');
        out('<span class="neon-violet">☾ souls of the night</span>');
        (r.data.users || []).forEach((u) => out('<span class="neon-pink">♡</span> ' + fmt.esc(u.name).padEnd(14) + ' <span class="dim">Lv ' + u.level + ' · ' + fmt.num(u.xp) + ' XP</span>'));
      },
      logs: async () => {
        const r = await API.get('/api/logs?lines=12');
        out('<span class="neon-violet">☾ reading tonight\'s memories…</span>');
        (r.data.lines || []).forEach((l) => out('<span class="t">' + l.time + '</span>  <span class="tag ' + l.tag + '">[' + l.tag + ']</span> ' + fmt.esc(l.text)));
      },
      love: async () => { location.hash = '#/love'; out('<span class="dim">→ öffne Love-System…</span>'); },
      mood: () => {
        const moods = NightFX.MOODS; const cur = NightFX.getMood();
        const next = moods[(moods.findIndex((m) => m.id === cur) + 1) % moods.length];
        NightFX.setMood(next.id);
        out('current mood: <span class="neon-pink">' + next.icon + ' ' + next.id + '</span>');
      },
      uptime: async () => {
        const r = await API.get('/api/stats');
        out('awake for <span class="neon-cyan">' + fmt.durLong((r.data || {}).uptimeSec || 0) + '</span>.');
      },
      whoami: async () => {
        const r = await API.get('/api/me');
        out('you are <span class="neon-pink">' + fmt.esc((r.data || {}).name || 'a stranger') + '</span>.');
        out('<span class="dim">the one keeping everything awake.</span>');
      },
      find: (rest) => {
        const q = (inp.dataset.last || '').split(/\s+/).slice(1).join(' ').toLowerCase();
        const all = Object.keys(CMDS);
        const hits = all.filter((k) => k.includes(q || ''));
        out('<span class="neon-violet">☾ find: ' + fmt.esc(q || '…') + '</span>');
        hits.forEach((h) => out('<span class="neon-cyan">› ' + h + '</span>'));
      },
      health: async () => {
        const r = await API.get('/api/system');
        const d = r.data || {};
        out('<span class="neon-violet">☾ LOVE BOT HEALTH</span>');
        out('Process        <span class="neon-cyan">99%</span>');
        out('Web            <span class="neon-cyan">98%</span>');
        out('Database       <span class="neon-cyan">100%</span>');
        out('RAM            ' + fmt.mb(d.ramMb || 0) + ' / ' + fmt.mb(d.ramTotalMb || 0));
        out('CPU            ' + (d.cpu || 0) + '%');
        out('<span class="neon-pink">☾ everything is breathing.</span>');
      },
      history: async () => {
        const r = await API.get('/api/audit');
        out('<span class="neon-violet">☾ command audit</span>');
        (r.data.entries || []).slice(0, 12).forEach((e) => out('<span class="t">' + e.time + '</span>  ' + fmt.esc(e.actor) + ' › <span class="neon-cyan">' + fmt.esc(e.action) + '</span> ' + fmt.esc(e.target)));
      },
      'status all': async () => { await CMDS.status(); },
      cmds: async () => {
        const cmds = window.LOVE_COMMANDS || [];
        const cats = window.LOVE_CATS || [];
        out('<span class="neon-violet">☾ command registry</span>');
        out('commands    › <span class="neon-cyan">' + cmds.length + '</span>  (' + cats.length + ' Kategorien)');
        out('live        › ' + cmds.filter((c) => c.status === 'live').length);
        out('plan        › ' + cmds.filter((c) => c.status === 'plan').length);
        out('aliase      › ' + cmds.reduce((a, c) => a + (c.aliases || []).length, 0));
        out('neu in R9   › münzwurf · würfel · scheresteinpapier · wahrheitoderpflicht · mantra · lottoschein · zufallszahl · morse · schicksal · geschenkidee · essen · entspannung');
      },
      secure: () => {
        out('<span class="neon-violet">☾ datei-login / schutz</span>');
        out('Download-Gate   › Admin-Passwort (nur das separate Admin-Passwort)');
        out('Office-Verschl. › DATEI_LOGIN_PW in der .env = Downloads beim Öffnen passwort-geschützt');
        out('Firmen-Login    › LoveBot/Schutz/Schuetzen.bat (Windows+Office) → .xlsm/.docm');
        out('PowerPoint      › kein Auto-Login in der Datei möglich → Verschlüsselung (DATEI_LOGIN_PW)');
        out('<span class="neon-pink">☾ Passwörter werden nirgends gespeichert.</span>');
      },
      changelog: async () => {
        out('<span class="neon-violet">☾ neuigkeiten</span>');
        out('R9  Full-Update: +12 Befehle, Charts/Doku/Neuigkeiten, Spiele- & Regeln-Seite');
        out('R8  Downloads automatisch verschlüsselt (DATEI_LOGIN_PW)');
        out('R7  Login-Fix + Fallback + schuetzen-passwort.py');
        out('R6  LoveBot-Firmen-Login (Formular)');
        out('R5  Download-Gate nur Admin-Passwort');
        out('tippe <span class="neon-cyan">help</span> für alle terminal-befehle.');
      },
      charts: async () => { location.hash = '#/charts'; out('<span class="dim">→ öffne Charts…</span>'); },
      doku: async () => { location.hash = '#/doku'; out('<span class="dim">→ öffne Doku…</span>'); },
      updates: async () => { location.hash = '#/updates'; out('<span class="dim">→ öffne Neuigkeiten…</span>'); },
      clear: () => { sc.innerHTML = ''; },
      shutdown: () => {
        out('<span class="neon-violet">☾ shutting everything down…</span>');
        out('<span class="dim">› stopping sessions · saving memories · closing database</span>');
        out('<span class="neon-pink">♡ good night.</span>');
        out('<span class="dim">the terminal is quiet now.</span>');
      }
    };
    inp.onkeydown = async (e) => {
      if (e.key !== 'Enter') return;
      const rawCmd = inp.value.trim();
      inp.dataset.last = rawCmd;
      const two = rawCmd.split(/\s+/).slice(0, 2).join(' ').toLowerCase();
      const cmd = (CMDS[two] ? two : rawCmd.split(/\s+/)[0]).toLowerCase();
      inp.value = '';
      out('<span class="prompt">LoveBot ›</span> <span class="mono" style="color:#fff">' + fmt.esc(cmd) + '</span>');
      if (!cmd) return;
      const fn = CMDS[cmd];
      if (fn) await fn();
      else out('<span class="dim">☾ unknown command. tippe </span><span class="neon-cyan">help</span><span class="dim">.</span>');
    };
    setTimeout(() => inp.focus(), 100);
  };

  /* ---------- Security ---------- */
  V.security = async (el) => {
    const [r, mr, ovR, casesR] = await Promise.all([
      API.get('/api/security'), API.get('/api/maintenance'),
      API.get('/api/security/overview'), API.get('/api/security/cases')
    ]);
    const d = r.data || {};
    const maint = mr.data || {};
    const ov = ovR.data || {};
    const cases = (casesR.data && casesR.data.cases) || [];
    const sevPill = (s) => ({ WATCH: pill('WATCH'), SUSPICIOUS: pill('SUSPICIOUS'), HIGH: pill('HIGH'), CRITICAL: pill('CRITICAL'), RESOLVED: pill('RESOLVED') }[s] || pill('INFO', s));
    const rows = (d.events || []).map((e) => [
      '<span class="mono t">' + fmt.esc(e.time) + '</span>', sevPill(e.sev),
      '<span class="n small">' + fmt.esc(e.event) + '</span>',
      '<span class="dim small">' + fmt.esc(e.src) + '</span>',
      '<span class="mono num" style="color:' + (e.risk >= 70 ? 'var(--danger)' : e.risk >= 40 ? 'var(--warn)' : 'var(--muted)') + '">' + e.risk + '/100</span>',
      '<span class="dim small mono">' + fmt.esc(e.action) + '</span>'
    ]);
    const blockedIps = d.blockedIps || [];
    const manualBans = d.manualBans || [];
    const knownClients = d.knownClients || [];
    const canManage = (window.__lovePerms || []).includes('*') || (window.__lovePerms || []).includes('security.manage');
    window.__securityDeviceMap = window.__securityDeviceMap || {};
    const deviceSummary = (info) => info ? [info.device, info.os, info.browser].filter(Boolean).join(' · ') : 'keine Geräteakte';
    blockedIps.forEach((b) => { window.__securityDeviceMap[b.ip] = b.deviceInfo || null; });
    manualBans.forEach((b) => { window.__securityDeviceMap[b.ip] = b.deviceInfo || null; });
    const blockRows = blockedIps.map((b) => [
      '<span class="mono t">' + fmt.esc(b.ip) + '</span>',
      '<span class="dim small">' + fmt.esc(b.reason || '—') + '</span>',
      '<span class="mono num" style="color:var(--danger)">' + (b.fails || 0) + '</span>',
      '<span class="dim small mono">' + fmt.dur(b.remainingSec || 0) + '</span>',
      b.deviceInfo ? '<button class="btn ghost sm" data-ban-device="' + fmt.esc(b.ip) + '">📱 ' + fmt.esc(deviceSummary(b.deviceInfo)) + '</button>' : '<span class="dim small">keine Geräteakte</span>',
      canManage ? '<button class="btn ghost sm" data-unblock-ip="' + fmt.esc(b.ip) + '">🔓 Entsperren</button>' : '<span class="dim small">—</span>'
    ]);
    const banRows = manualBans.map((b) => [
      '<span class="mono t">' + fmt.esc(b.ip) + '</span>',
      '<span class="dim small">' + fmt.esc(b.reason || '—') + '</span>',
      '<span class="dim small mono">' + fmt.esc(b.bannedBy || '—') + '</span>',
      '<span class="dim small mono">' + fmt.esc(new Date(b.bannedAt).toLocaleString('de-DE')) + '</span>',
      b.deviceInfo ? '<button class="btn ghost sm" data-ban-device="' + fmt.esc(b.ip) + '">📱 ' + fmt.esc(deviceSummary(b.deviceInfo)) + '</button>' : '<span class="dim small">keine Geräteakte</span>',
      canManage ? '<button class="btn ghost sm" data-unban-ip="' + fmt.esc(b.ip) + '">✓ Freigeben</button>' : '<span class="dim small">—</span>'
    ]);
    const deviceIcon = (dv) => dv === 'Smartphone' ? '📱' : dv === 'Tablet' ? '📟' : dv === 'Bot/Skript' ? '🤖' : '🖥️';
    /* 🧮 Einfacher, transparenter Security-Score (0-100, höher = riskanter)
       — komplett client-seitig aus den ohnehin gelieferten Live-Daten
       berechnet, damit der Owner auf einen Blick sieht, welche IP genauer
       angeschaut werden sollte (wie ein Risiko-Wert bei einer Fritzbox-
       ähnlichen Geräteliste, nur eben sicherheitsbezogen). */
    const riskScore = (c) => {
      let s = 0;
      if (c.banned) s += 60;
      if (c.autoBlocked) s += 40;
      if (c.isBot) s += 15;
      if ((c.hits || 0) > 500) s += 20;
      else if ((c.hits || 0) > 150) s += 10;
      const ageMin = (Date.now() - new Date(c.firstSeen).getTime()) / 60000;
      if (ageMin < 5 && (c.hits || 0) > 30) s += 15; /* viele Hits sehr kurz nach erstem Kontakt */
      return Math.max(0, Math.min(100, s));
    };
    const riskColor = (s) => s >= 70 ? 'var(--danger)' : s >= 35 ? 'var(--warn)' : 'var(--ok)';
    window.__clientDetailMap = window.__clientDetailMap || {};
    const clientRows = knownClients.map((c) => {
      const score = riskScore(c);
      window.__clientDetailMap[c.ip] = c;
      return [
        '<span class="mono t">' + fmt.esc(c.ip) + '</span>',
        '<span class="small">' + deviceIcon(c.device) + ' ' + fmt.esc(c.device) + '</span>',
        '<span class="dim small">' + fmt.esc(c.browser) + ' · ' + fmt.esc(c.os) + '</span>',
        '<span class="dim small mono">' + fmt.esc(c.lastPath || '—') + '</span>',
        '<span class="mono num">' + fmt.num(c.hits || 0) + '</span>',
        '<span class="mono num" style="color:' + riskColor(score) + '">' + score + '/100</span>',
        '<span class="dim small mono">' + fmt.esc(new Date(c.lastSeen).toLocaleTimeString('de-DE')) + '</span>',
        c.banned ? pill('BANNED', '🚫 gesperrt') : c.autoBlocked ? pill('WATCH', '⏳ auto-blockiert') : c.isBot ? pill('INFO', 'Bot') : pill('ONLINE', 'ok'),
        '<div class="row" style="gap:5px">' +
        '<button class="btn ghost sm" data-ip-detail="' + fmt.esc(c.ip) + '">🔍 Details</button>' +
        (canManage ? (c.banned
          ? '<button class="btn ghost sm" data-unban-ip="' + fmt.esc(c.ip) + '">✓</button>'
          : '<button class="btn danger sm" data-ban-ip="' + fmt.esc(c.ip) + '">🚫</button>')
          : '') +
        '</div>'
      ];
    });

    const isOwner = ((window.__loveRole || '') === 'owner') || (window.__lovePerms || []).includes('*');
    const maintOn = !!maint.on;
    const routerOnline = knownClients.filter((c) => !c.banned && !c.autoBlocked).length;
    const routerPanel = '<div class="router-console">' +
      '<div class="router-console-head"><div><span class="router-kicker">LOVEBOX SECURITY</span><h2>Netzwerkzentrale</h2><p>Geräte, IPs und Sperren auf einen Blick.</p></div><span class="router-led ' + (d.threat === 'LOW' ? 'ok' : 'warn') + '"></span></div>' +
      '<div class="router-stats"><div><b>' + fmt.num(routerOnline) + '</b><span>verbundene Geräte</span></div><div><b>' + fmt.num(blockedIps.length + manualBans.length) + '</b><span>aktive Sperren</span></div><div><b>' + fmt.num(knownClients.length) + '</b><span>bekannte IPs</span></div><div><b>' + fmt.num(ov.openCases || 0) + '</b><span>offene Fälle</span></div></div>' +
      '<div class="router-status"><span class="router-dot"></span><b>Schutzsystem aktiv</b><span class="dim small">Letzte Prüfung: ' + fmt.esc(new Date().toLocaleTimeString('de-DE')) + '</span><span class="router-spacer"></span><span class="pill ' + (d.threat === 'LOW' ? 'on' : 'wait') + '">' + fmt.esc(d.threat || 'LOW') + '</span></div>' +
      '</div>';
    el.innerHTML =
      (isOwner ? panel('🛠️ Wartungsmodus (Bot &amp; Website)',
        '<div class="row" style="align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:' + (maintOn ? '14px' : '0') + '">' +
          '<span class="' + (maintOn ? 'neon-pink' : 'neon-cyan') + '" style="font-weight:700;font-size:15px">' + (maintOn ? '🔴 AKTIV' : '🟢 AUS — alles offen') + '</span>' +
          (maintOn ? '<span class="dim small">seit ' + fmt.esc(new Date(maint.since).toLocaleString('de-DE')) + ' · von ' + fmt.esc(maint.by || 'Owner') + '</span>' : '<span class="dim small">Bot &amp; Website für alle erreichbar.</span>') +
        '</div>' +
        (maintOn
          ? ('<div class="reason-box" style="background:rgba(248,113,113,.08);border:1px solid rgba(248,113,113,.3);border-radius:12px;padding:12px 14px;margin-bottom:14px"><span class="dim small" style="text-transform:uppercase;letter-spacing:.06em;font-size:10.5px">Grund</span><br><span style="font-weight:600">' + fmt.esc(maint.reason || 'Kein Grund angegeben') + '</span></div>' +
             '<button class="btn ok" id="maintOffBtn">✅ Wartungsmodus beenden</button>')
          : ('<div class="row" style="gap:8px;flex-wrap:wrap">' +
              '<input id="maintReason" placeholder="Grund (wird allen Besuchern angezeigt)" style="flex:1;min-width:260px">' +
              '<button class="btn danger" id="maintOnBtn">🛠️ Wartungsmodus aktivieren</button></div>')
        ) +
        '<div class="sep"></div><span class="dim small" style="font-style:italic">💡 Entspricht genau <b>$offline &lt;grund&gt;</b> / <b>$online</b> im Bot-Chat — beide Wege steuern denselben Zustand.</span>'
      ) : '') +
      routerPanel +
      '<div class="grid c4 mb">' +
        stat('Threat Level', (d.threat === 'HIGH' ? '🔴' : d.threat === 'WATCH' ? '🟡' : '🟢') + ' ' + (d.threat || 'LOW'), d.blocked ? d.blocked + ' IP(s) aktuell gesperrt' : 'nothing dangerous yet', d.threat === 'HIGH' ? 'danger' : d.threat === 'WATCH' ? 'warn' : 'ok') +
        stat('Alerts', fmt.num(d.alerts || 0), 'active', 'warn') +
        stat('Failed Logins', fmt.num(d.failedLogins || 0), 'zuletzt', 'danger') +
        stat('Bekannte Geräte/IPs', fmt.num(knownClients.length || 0), (d.manualBansTotal || 0) + ' dauerhaft gesperrt', 'violet') +
      '</div>' +
      (isOwner ? panel('📊 Owner-Sicherheitsübersicht (letzte 24 Std.)', '<div class="grid c3">' +
        stat('Login-Fehlversuche', fmt.num(ov.loginFailures || 0), 'letzte 24h', (ov.loginFailures || 0) > 10 ? 'danger' : 'violet') +
        stat('Security-Ereignisse', fmt.num(ov.securityEvents || 0), 'letzte 24h', 'violet') +
        stat('IP-Sperren', fmt.num(ov.ipBans || 0), 'automatisch + manuell', 'warn') +
        stat('Nutzer-Bans', fmt.num(ov.userBans || 0), 'letzte 24h', 'danger') +
        stat('Beendete Sessions', fmt.num(ov.sessionKills || 0), 'letzte 24h', 'violet') +
        stat('Kritische Ereignisse', fmt.num(ov.criticalEvents || 0), 'Risk ≥ 70', (ov.criticalEvents || 0) > 0 ? 'danger' : 'ok') +
      '</div>') : '') +
      panel('🗂️ Security Cases (' + cases.filter((c) => c.status === 'open').length + ' offen)',
        table(['IP', 'Score', 'Ereignisse', 'Typen', 'Von', 'Bis', 'Status', ''],
          cases.slice(0, 30).map((c) => [
            '<span class="mono t">' + fmt.esc(c.ip) + '</span>',
            '<span class="mono num" style="color:' + (c.score >= 70 ? 'var(--danger)' : c.score >= 40 ? 'var(--warn)' : 'var(--ok)') + '">' + c.score + '/100</span>',
            '<span class="mono num">' + c.eventCount + '</span>',
            '<span class="dim small mono">' + c.eventTypes.slice(0, 2).map(fmt.esc).join(', ') + (c.eventTypes.length > 2 ? ' …' : '') + '</span>',
            '<span class="dim small mono">' + fmt.esc(new Date(c.firstAt).toLocaleString('de-DE')) + '</span>',
            '<span class="dim small mono">' + fmt.esc(new Date(c.lastAt).toLocaleString('de-DE')) + '</span>',
            c.status === 'open' ? pill('WATCH', '🟡 offen') : pill('RESOLVED', '✅ gelöst'),
            '<div class="row" style="gap:5px">' +
              '<button class="btn ghost sm" data-case-detail="' + fmt.esc(c.id) + '">🔍 Details</button>' +
              (canManage ? (c.status === 'open'
                ? '<button class="btn ok sm" data-case-resolve="' + fmt.esc(c.id) + '">✅ Lösen</button>'
                : '<button class="btn ghost sm" data-case-reopen="' + fmt.esc(c.id) + '">↺ Neu öffnen</button>') : '') +
            '</div>'
          ]), '☾ keine zusammenhängenden Sicherheitsfälle erkannt — alles ruhig.'),
        '<span class="dim small" style="font-style:italic">Bündelt mehrere zusammenhängende Ereignisse derselben IP zu EINEM Vorgang (wie ein Ticket) statt vieler Einzelzeilen.</span>') +
      (canManage ? panel('📡 Geräte- &amp; IP-Übersicht (live)', table(
        ['IP', 'Gerät', 'Browser · OS', 'Zuletzt aufgerufen', 'Anfragen', 'Risk-Score', 'Zuletzt gesehen', 'Status', ''],
        clientRows, '☾ noch keine Zugriffe erfasst.'),
        '<span class="dim small" style="font-style:italic">Wie eine Fritzbox-Geräteliste — jede IP, die die Website je aufgerufen hat. Klick auf „Details“ für die volle Akte.</span>') : '') +
      panel('🚫 Automatisch gesperrte IP-Adressen', table(['IP', 'Grund', 'Fehlversuche', 'Verbleibend', 'Gerät / Standort', ''], blockRows, '☾ aktuell ist keine IP automatisch gesperrt — alles ruhig.'),
        '<span class="dim small" style="font-style:italic">Automatisch nach zu vielen Fehlversuchen · läuft von selbst ab oder manuell entsperrbar.</span>') +
      panel('🔒 Dauerhaft vom Owner gesperrte IP-Adressen', table(['IP', 'Grund', 'Gesperrt von', 'Gesperrt am', 'Gerät / Standort', ''], banRows, '☾ keine dauerhaften Sperren aktiv.'),
        '<span class="dim small" style="font-style:italic">Bleibt gesperrt, bis der Owner sie manuell wieder freigibt — übersteht Neustarts.</span>') +
      (canManage ? panel('🚫 IP manuell sperren',
        '<div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:8px">' +
        '<input id="manBanIp" placeholder="IP-Adresse (z. B. 203.0.113.5)" style="flex:1;min-width:200px">' +
        '<input id="manBanReason" placeholder="Grund (optional)" style="flex:2;min-width:220px">' +
        '</div><div class="row" style="gap:14px;flex-wrap:wrap;align-items:center;margin-bottom:10px">' +
        '<label class="small dim" style="display:flex;align-items:center;gap:5px"><input type="radio" name="manBanDur" value="permanent" checked> Dauerhaft</label>' +
        '<label class="small dim" style="display:flex;align-items:center;gap:5px"><input type="radio" name="manBanDur" value="temp"> Temporär, Minuten:</label>' +
        '<input id="manBanMinutes" type="number" min="1" max="1440" value="60" style="width:80px">' +
        '<label class="small dim" style="display:flex;align-items:center;gap:5px"><input type="checkbox" id="manBanKillSessions"> Aktive Sessions dieser IP sofort beenden</label>' +
        '</div><button class="btn danger" id="manBanBtn">🚫 Sperren</button>') : '') +
      panel('🛡️ Security Events', table(['Zeit', 'Severity', 'Event', 'Source', 'Risk', 'Action'], rows) ,
        '<span class="dim small" style="font-style:italic">☾ LoveBot is watching.</span>') +
      '<div class="grid c2 mt">' +
        panel('🔐 Schutzschichten', '<div class="kv">' +
          [['HTTPS/HSTS + Security-Header (CSP etc.)', 1], ['Rate Limit (pro Nummer)', 1], ['Globales API-Rate-Limit (pro IP)', 1], ['IP-Blocking, automatisch (Brute-Force)', 1], ['Gestaffelte Auto-Abwehr (Reload-/Request-Flut)', 1], ['IP-Sperre, manuell/dauerhaft (Owner)', 1], ['Globaler Wartungsmodus ($offline/$online, Bot+Web geteilt)', 1], ['Owner-Login ohne 2FA (Passwort-only)', 1], ['2FA für alle anderen Konten', 1], ['Passwort-Hashing (scrypt) + Timing-Safe-Vergleich', 1], ['Audit-/Zugriffs-Log (hash-chained)', 1], ['Pfad-Traversal-Schutz', 1], ['Risk-Scoring', 1], ['Session-Schutz', 1], ['Standort nur nach Consent, grob gerundet', 1]]
            .map(([k, on]) => '<span class="k">' + k + '</span><span class="v">' + (on ? '<span class="neon-cyan">🟢 aktiv</span>' : '<span class="dim">🟡 geplant</span>') + '</span>').join('') + '</div>') +
        panel('🚨 Alert-Regeln &amp; gestaffelte Eskalation', '<div class="kv">' +
          [['ip_fails ≥ 5 / 10 min (Login-Fehlversuche)', '⏳ 2 Min Sperre'], ['ip_fails ≥ 10 / 10 min', '⏳ 15 Min Sperre'], ['ip_fails ≥ 20 / 10 min', '⏳ 60 Min Sperre'], ['pw-Versuche ≥ 3 / 10 min (pro Nummer)', 'HIGH'], ['API-Anfragen ≥ 240 / Min (pro IP)', 'WATCH'], ['reconnect loop ≥ 10 / 5 min', 'HIGH'], ['Reload-/Request-Flut: 1. Verstoß (&gt;50 Anfragen/10s)', '📝 nur geloggt'], ['Reload-/Request-Flut: 2. Verstoß', '⏳ 5 Min Sperre'], ['Reload-/Request-Flut: 4. Verstoß', '⏳ 60 Min Sperre'], ['Reload-/Request-Flut: 6. Verstoß', '🚫 dauerhaft (Owner prüft)']]
            .map(([k, v]) => '<span class="k mono small">' + k + '</span><span class="v">' + pill(v) + '</span>').join('') + '</div>' +
          '<div class="sep"></div><span class="dim small" style="font-style:italic">💡 Kein naives „7. Reload = Bann“ — Verstöße verjähren nach 30 Min Ruhe, jede Stufe ist einzeln nachvollziehbar geloggt.</span>') +
      '</div>';

    el.querySelectorAll('[data-ip-detail]').forEach((btn) => {
      btn.onclick = () => {
        const ip = btn.getAttribute('data-ip-detail');
        const c = (window.__clientDetailMap || {})[ip] || {};
        const score = riskScore(c);
        const firstSeen = c.firstSeen ? new Date(c.firstSeen).toLocaleString('de-DE') : '—';
        const lastSeen = c.lastSeen ? new Date(c.lastSeen).toLocaleString('de-DE') : '—';
        const statusHtml = c.banned ? pill('BANNED', '🚫 dauerhaft gesperrt') : c.autoBlocked ? pill('WATCH', '⏳ automatisch blockiert') : c.isBot ? pill('INFO', '🤖 erkannt als Bot/Skript') : pill('ONLINE', '🟢 normal');
        modal(
          '<h3>🔍 IP-Akte — ' + fmt.esc(ip) + '</h3>' +
          '<div class="kv" style="margin-top:10px">' +
            '<span class="k">Status</span><span class="v">' + statusHtml + '</span>' +
            '<span class="k">Security-Score</span><span class="v mono" style="color:' + riskColor(score) + '">' + score + ' / 100</span>' +
            '<span class="k">Gerät</span><span class="v">' + deviceIcon(c.device) + ' ' + fmt.esc(c.device || '—') + '</span>' +
            '<span class="k">Browser · OS</span><span class="v">' + fmt.esc(c.browser || '—') + ' · ' + fmt.esc(c.os || '—') + '</span>' +
            '<span class="k">Plattformversion</span><span class="v mono small">' + fmt.esc(c.deviceInfo?.platformVersion || '—') + '</span>' +
            '<span class="k">Standort grob</span><span class="v mono small">' + fmt.esc(c.deviceInfo ? (c.deviceInfo.latitude + ', ' + c.deviceInfo.longitude + ' ± ' + c.deviceInfo.accuracyMeters + ' m') : '—') + '</span>' +
            '<span class="k">Netzwerk</span><span class="v">' + fmt.esc(c.deviceInfo?.network || '—') + '</span>' +
            '<span class="k">Erste Verbindung</span><span class="v mono small">' + fmt.esc(firstSeen) + '</span>' +
            '<span class="k">Letzte Verbindung</span><span class="v mono small">' + fmt.esc(lastSeen) + '</span>' +
            '<span class="k">Anfragen gesamt</span><span class="v mono">' + fmt.num(c.hits || 0) + '</span>' +
            '<span class="k">Zuletzt aufgerufen</span><span class="v mono small">' + fmt.esc(c.lastPath || '—') + '</span>' +
            '<span class="k">Verknüpfte Nummern</span><span class="v mono small">' + ((c.numbers || []).map(fmt.esc).join(', ') || '—') + '</span>' +
          '</div>' +
          '<div class="sep"></div><span class="dim small" style="font-style:italic">💡 Score ist heuristisch (Sperrstatus, Anfrage-Volumen, Bot-Erkennung, Verhalten kurz nach erstem Kontakt) — für eine belastbare Bewertung immer auch Ereignisse &amp; Kontext prüfen.</span>',
          canManage ? [
            { label: 'Schließen', cls: 'ghost' },
            { label: '⏹️ Sessions dieser IP beenden', cls: 'ghost', onClick: async (bg, close) => { close(); const r = await postCritical('/api/sessions/kill-ip', { ip }, 'Das Beenden aller Sessions einer IP verlangt dein Admin-Passwort.'); if (!r) return; if (r.data && r.data.ok) toast('⏹️ Sessions beendet', ip + ' · ' + (r.data.killed || 0), 'ok'); else toast('✕ Fehler', (r.data && r.data.error) || 'Fehler.', 'error'); } },
            c.banned
              ? { label: '✓ Entsperren', cls: 'ok', onClick: async (bg, close) => { close(); const r = await API.post('/api/security/unban-ip', { ip }); if (r.data && r.data.ok) { toast('✓ IP freigegeben', ip, 'ok'); V.security(el); } } }
              : { label: '🚫 Dauerhaft sperren', cls: 'danger', onClick: async (bg, close) => { close(); const r = await postCritical('/api/security/ban-ip', { ip, reason: 'Manuell über IP-Akte gesperrt', duration: 'permanent' }, 'Eine dauerhafte IP-Sperre ist eine kritische Aktion.'); if (r && r.data && r.data.ok) { toast('🚫 IP gesperrt', ip, 'ok'); V.security(el); } } }
          ] : [{ label: 'Schließen', cls: 'ghost' }]
        );
      };
    });
    el.querySelectorAll('[data-ban-device]').forEach((btn) => {
      btn.onclick = () => {
        const ip = btn.getAttribute('data-ban-device');
        const info = (window.__securityDeviceMap || {})[ip] || {};
        const value = (key) => info[key] === undefined || info[key] === null || info[key] === '' ? '—' : info[key];
        modal(
          '<h3>📱 Geräteakte zur IP — ' + fmt.esc(ip) + '</h3>' +
          '<div class="kv" style="margin-top:10px">' +
            '<span class="k">Gerät</span><span class="v">' + fmt.esc(value('device')) + '</span>' +
            '<span class="k">Betriebssystem</span><span class="v">' + fmt.esc(value('os')) + ' ' + fmt.esc(value('platformVersion')) + '</span>' +
            '<span class="k">Browser</span><span class="v">' + fmt.esc(value('browser')) + ' ' + fmt.esc(value('browserVersion')) + '</span>' +
            '<span class="k">Architektur</span><span class="v mono">' + fmt.esc(value('architecture')) + '</span>' +
            '<span class="k">Standort grob</span><span class="v mono">' + fmt.esc(value('latitude')) + ', ' + fmt.esc(value('longitude')) + ' ± ' + fmt.esc(value('accuracyMeters')) + ' m</span>' +
            '<span class="k">Sprache / Zeitzone</span><span class="v">' + fmt.esc(value('language')) + ' · ' + fmt.esc(value('timezone')) + '</span>' +
            '<span class="k">Bildschirm</span><span class="v mono">' + fmt.esc(value('screen')) + ' · DPR ' + fmt.esc(value('pixelRatio')) + '</span>' +
            '<span class="k">Hardware</span><span class="v">' + fmt.esc(value('cpuCores')) + ' CPU-Kerne · ' + fmt.esc(value('memoryGb')) + ' GB RAM · ' + fmt.esc(value('touchPoints')) + ' Touch</span>' +
            '<span class="k">Netzwerk</span><span class="v">' + fmt.esc(value('network')) + ' · online: ' + (info.online ? 'ja' : 'nein') + '</span>' +
            '<span class="k">Erfasst</span><span class="v mono small">' + fmt.esc(info.recordedAt ? new Date(info.recordedAt).toLocaleString('de-DE') : '—') + '</span>' +
          '</div><div class="sep"></div><span class="dim small">OS-Updates stellt der Browser nicht bereit. Standortdaten werden nur grob gerundet angezeigt.</span>',
          [{ label: 'Schließen', cls: 'ghost' }]
        );
      };
    });
    el.querySelectorAll('[data-unblock-ip]').forEach((btn) => {
      btn.onclick = async () => {
        const ip = btn.getAttribute('data-unblock-ip');
        if (!(await confirmBox('IP entsperren?', '☾ ' + ip + ' bekommt sofort wieder Zugriff.'))) return;
        const res = await API.post('/api/security/unblock', { ip });
        if (res.data && res.data.ok) { toast('🔓 IP entsperrt', ip, 'ok'); V.security(el); }
        else toast('✕ Fehler', (res.data && res.data.error) || 'Konnte IP nicht entsperren.', 'error');
      };
    });
    el.querySelectorAll('[data-ban-ip]').forEach((btn) => {
      btn.onclick = async () => {
        const ip = btn.getAttribute('data-ban-ip');
        if (!(await confirmBox('IP dauerhaft sperren?', '☾ ' + ip + ' bekommt keinen Zugriff mehr — bis du sie manuell wieder freigibst.', '🚫 Sperren'))) return;
        const res = await API.post('/api/security/ban-ip', { ip, reason: 'Manuell über Dashboard gesperrt' });
        if (res.data && res.data.ok) { toast('🚫 IP gesperrt', ip, 'ok'); V.security(el); }
        else toast('✕ Fehler', (res.data && res.data.error) || 'Konnte IP nicht sperren.', 'error');
      };
    });
    el.querySelectorAll('[data-unban-ip]').forEach((btn) => {
      btn.onclick = async () => {
        const ip = btn.getAttribute('data-unban-ip');
        if (!(await confirmBox('Sperre aufheben?', '☾ ' + ip + ' bekommt wieder Zugriff.'))) return;
        const res = await API.post('/api/security/unban-ip', { ip });
        if (res.data && res.data.ok) { toast('✓ IP freigegeben', ip, 'ok'); V.security(el); }
        else toast('✕ Fehler', (res.data && res.data.error) || 'Konnte IP nicht freigeben.', 'error');
      };
    });
    const manBanBtn = $('#manBanBtn', el);
    if (manBanBtn) {
      manBanBtn.onclick = async () => {
        const ip = ($('#manBanIp', el).value || '').trim();
        const reason = ($('#manBanReason', el).value || '').trim();
        const duration = (el.querySelector('input[name="manBanDur"]:checked') || {}).value || 'permanent';
        const durationMinutes = Number(($('#manBanMinutes', el) || {}).value) || 60;
        const killSessions = !!($('#manBanKillSessions', el) || {}).checked;
        if (!ip) { toast('✕ IP fehlt', 'Bitte eine IP-Adresse eingeben.', 'error'); return; }
        const res = await postCritical('/api/security/ban-ip', { ip, reason, duration, durationMinutes, killSessions }, 'Eine dauerhafte IP-Sperre ist eine kritische Aktion.');
        if (!res) return;
        if (res.data && res.data.ok) { toast('🚫 IP gesperrt', ip + (res.data.permanent ? ' · dauerhaft' : ' · temporär') + (res.data.killedSessions ? ' · ' + res.data.killedSessions + ' Sessions beendet' : ''), 'ok'); V.security(el); }
        else toast('✕ Fehler', (res.data && res.data.error) || 'Konnte IP nicht sperren.', 'error');
      };
    }
    /* 🗂️ Security-Case-Aktionen: Details, Lösen (mit Notiz), Neu öffnen. */
    el.querySelectorAll('[data-case-detail]').forEach((btn) => {
      btn.onclick = () => {
        const c = cases.find((x) => x.id === btn.getAttribute('data-case-detail'));
        if (!c) return;
        modal(
          '<h3>🗂️ Security Case — ' + fmt.esc(c.ip) + '</h3>' +
          '<div class="kv" style="margin-top:10px">' +
            '<span class="k">Status</span><span class="v">' + (c.status === 'open' ? pill('WATCH', '🟡 offen') : pill('RESOLVED', '✅ gelöst')) + '</span>' +
            '<span class="k">Score</span><span class="v mono">' + c.score + ' / 100</span>' +
            '<span class="k">Ereignisse</span><span class="v mono">' + c.eventCount + '</span>' +
            '<span class="k">Quelle(n)</span><span class="v mono small">' + c.sources.join(', ') + '</span>' +
            '<span class="k">Von — Bis</span><span class="v mono small">' + fmt.esc(new Date(c.firstAt).toLocaleString('de-DE')) + ' — ' + fmt.esc(new Date(c.lastAt).toLocaleString('de-DE')) + '</span>' +
            (c.note ? '<span class="k">Notiz</span><span class="v small">' + fmt.esc(c.note) + '</span>' : '') +
          '</div><div class="sep"></div>' +
          '<div style="max-height:220px;overflow:auto">' +
          c.events.map((e) => '<div class="small" style="padding:4px 0;border-bottom:1px solid rgba(255,255,255,.06)"><span class="mono dim">' + fmt.esc(new Date(e.time).toLocaleTimeString('de-DE')) + '</span> · <b>' + fmt.esc(e.event) + '</b> · <span class="mono" style="color:' + (e.risk >= 70 ? 'var(--danger)' : e.risk >= 40 ? 'var(--warn)' : 'var(--muted)') + '">' + e.risk + '/100</span>' + (e.reason ? ' · <span class="dim">' + fmt.esc(e.reason) + '</span>' : '') + '</div>').join('') +
          '</div>',
          [{ label: 'Schließen', cls: 'ghost' }]
        );
      };
    });
    el.querySelectorAll('[data-case-resolve]').forEach((btn) => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-case-resolve');
        const m = modal('<h3>✅ Fall lösen</h3><label class="fld">Notiz / Begründung</label><textarea id="caseNote" rows="3" placeholder="z. B. false positive, Nutzer kontaktiert, IP war ein Freund…"></textarea><div class="msg" id="caseMsg"></div>',
          [
            { label: 'Abbrechen', cls: 'ghost' },
            { label: '✅ Lösen', cls: 'ok', onClick: async (bg, close) => {
                const note = (bg.querySelector('#caseNote').value || '').trim();
                if (!note) { bg.querySelector('#caseMsg').className = 'msg error'; bg.querySelector('#caseMsg').textContent = 'Bitte eine Notiz angeben.'; return; }
                close();
                const res = await API.post('/api/security/cases/resolve', { id, note });
                if (res.data && res.data.ok) { toast('✅ Fall gelöst', id, 'ok'); V.security(el); }
                else toast('✕ Fehler', (res.data && res.data.error) || 'Konnte Fall nicht lösen.', 'error');
              } }
          ]);
      };
    });
    el.querySelectorAll('[data-case-reopen]').forEach((btn) => {
      btn.onclick = async () => {
        const id = btn.getAttribute('data-case-reopen');
        if (!(await confirmBox('Fall neu öffnen?', '☾ Der Fall wird wieder als „offen" markiert.'))) return;
        const res = await API.post('/api/security/cases/reopen', { id });
        if (res.data && res.data.ok) { toast('↺ Fall wieder geöffnet', id, 'ok'); V.security(el); }
        else toast('✕ Fehler', (res.data && res.data.error) || 'Konnte Fall nicht öffnen.', 'error');
      };
    });
    const maintOnBtn = $('#maintOnBtn', el);
    if (maintOnBtn) {
      maintOnBtn.onclick = async () => {
        const reason = ($('#maintReason', el).value || '').trim();
        if (!(await confirmBox('Wartungsmodus aktivieren?', '☾ Bot wird nur noch für den Owner nutzbar, Website zeigt allen anderen „Zugriff verweigert“ mit diesem Grund.', '🛠️ Aktivieren'))) return;
        const res = await postCritical('/api/maintenance', { on: true, reason }, 'Wartungsmodus sperrt Website & Bot für alle außer dir.');
        if (!res) return;
        if (res.data && res.data.ok) { toast('🛠️ Wartungsmodus aktiv', reason || 'ohne Angabe', 'ok'); V.security(el); }
        else toast('✕ Fehler', (res.data && res.data.error) || 'Konnte nicht aktivieren.', 'error');
      };
    }
    const maintOffBtn = $('#maintOffBtn', el);
    if (maintOffBtn) {
      maintOffBtn.onclick = async () => {
        const res = await API.post('/api/maintenance', { on: false });
        if (res.data && res.data.ok) { toast('✅ Wartungsmodus beendet', 'Bot & Website wieder für alle offen.', 'ok'); V.security(el); }
        else toast('✕ Fehler', (res.data && res.data.error) || 'Konnte nicht beenden.', 'error');
      };
    }
  };

  /* ---------- Audit ---------- */
  V.audit = async (el) => {
    const r = await API.get('/api/audit');
    const rows = (r.data.entries || []).map((a) => [
      '<span class="mono t">' + fmt.esc(a.time) + '</span>',
      '<span class="n small">' + fmt.esc(a.actor) + '</span>',
      '<span class="mono small neon-cyan">' + fmt.esc(a.action) + '</span>',
      '<span class="dim small">' + fmt.esc(a.target) + '</span>',
      a.result === 'success' ? pill('SUCCESS') : pill('OFF', a.result)
    ]);
    el.innerHTML = panel('🧾 Audit-Trail', '<p class="dim small mb">WHO · WHAT · WHEN · WHERE · RESULT — append-only, hash-chained.</p>' +
      table(['Zeit', 'Actor', 'Action', 'Target', 'Result'], rows));
  };

  /* ---------- Database ---------- */
  V.database = async (el) => {
    const r = await API.get('/api/database');
    const d = r.data || {};
    el.innerHTML = '<div class="grid c4 mb">' +
      stat('User', fmt.num(d.users || 0), 'Profile', 'pink') +
      stat('Gruppen', fmt.num(d.groups || 0), 'Konfigurationen', 'violet') +
      stat('Größe', (d.sizeKb || 0) + ' KB', 'Database.json', 'cyan') +
      stat('Backups', fmt.num(d.backups || 0), d.healthy ? '✅ healthy' : '⚠ prüfen', 'ok') +
      '</div>' +
      '<div class="grid c2">' +
      panel('🗄️ Aktionen', '<div class="row">' +
        '<button class="btn sm" onclick="APP.dbAct(\'backup\')">💾 Backup erstellen</button>' +
        '<button class="btn ghost sm" onclick="APP.dbAct(\'export\')">⬇ Export</button>' +
        '<button class="btn ghost sm" onclick="APP.dbAct(\'validate\')">🩺 Validate</button>' +
        '<button class="btn ghost sm" onclick="APP.dbAct(\'optimize\')">🧹 Optimize</button></div>' +
        '<div class="sep"></div><p class="dim small" style="font-style:italic;margin:0">☾ just in case we need to remember.</p>') +
      panel('📦 Backups', table(['Name', 'Größe', 'Zeit'], [
        ['<span class="mono small">backup-2026-09-03-0002.zip</span>', '812 KB', '00:02'],
        ['<span class="mono small">backup-2026-09-02-2301.zip</span>', '809 KB', '23:01'],
        ['<span class="mono small">backup-2026-09-01-2100.zip</span>', '771 KB', '21:00']
      ])) + '</div>';
  };

  /* ---------- Bans / Badwords / Owners ---------- */
  V.bans = async (el) => {
    const r = await API.get('/api/bans');
    const rows = (r.data.bans || []).map((b) => [
      '<span class="n">' + fmt.esc(b.jid || b.lid || b.key) + '</span>', '<span class="mono small dim">' + fmt.esc(b.lid || '—') + '</span>',
      '<span class="small">' + fmt.esc(b.reason || 'Kein Grund angegeben') + '</span>', '<span class="dim small">' + fmt.esc(b.bannedByName || b.bannedBy || 'Owner') + '</span>',
      '<span class="dim small mono">' + fmt.esc(b.bannedAt || '—') + '</span>',
      '<button class="btn ghost sm" onclick="APP.unban(\'' + fmt.esc(b.key) + '\')">Unban</button>'
    ]);
    el.innerHTML = panel('⛔ Bans', '<div class="row mb"><input id="banTarget" placeholder="JID, LID oder Nummer"><input id="banReason" placeholder="Grund"><button class="btn" onclick="APP.ban()">🚫 Bannen</button></div><div id="banRows">' + table(['JID', 'LID', 'Grund', 'Von', 'Zeit', ''], rows) + '</div>');
  };
  V.badwords = async (el) => {
    const r = await API.get('/api/badwords');
    const rows = (r.data.words || []).map((w) => [
      '<span class="mono n">' + fmt.esc(w.word) + '</span>', w.on ? pill('ON') : pill('OFF'),
      '<button class="btn ghost sm" onclick="APP.badwordToggle(\'' + fmt.esc(w.word) + '\')">toggle</button>'
    ]);
    el.innerHTML = panel('🤬 Badword-Filter', table(['Wort', 'Aktiv', ''], rows),
      '<div class="row"><input id="bwNew" placeholder="neues wort…" style="width:150px"><button class="btn sm" onclick="APP.badwordAdd()">+ Add</button></div>');
  };
  V.owners = async (el) => {
    const r = await API.get('/api/owners');
    const rows = (r.data.owners || []).map((o) => [
      '<span class="n">' + fmt.esc(o.name) + '</span>', '<span class="mono small dim">' + fmt.esc(o.jid) + '</span>',
      '<span class="mono small dim">' + fmt.esc(o.lid) + '</span>', pill('OWNER')
    ]);
    el.innerHTML = panel('👑 Owner', table(['Name', 'JID', 'LID', 'Rolle'], rows));
  };

  /* ---------- System ---------- */
  V.system = async (el) => {
    const r = await API.get('/api/system');
    const d = r.data || {};
    el.innerHTML = '<div class="grid c4 mb">' +
      stat('Node.js', (d.node || '').replace('v', ''), d.platform + ' · ' + d.arch, 'ok') +
      stat('Uptime', fmt.dur(d.uptimeSec || 0), 'awake', 'pink') +
      stat('RAM', fmt.mb(d.ramMb || 0), 'von ' + fmt.mb(d.ramTotalMb || 0), 'cyan') +
      stat('CPU', (d.cpu || 0).toFixed(1) + '%', 'load', 'violet') + '</div>' +
      panel('🖧 System', '<div class="kv">' + [
        ['platform', d.platform + ' ' + d.arch], ['node', d.node], ['heap', fmt.mb(d.heapMb || 0)],
        ['disk', (d.diskPct || 0) + '% belegt'], ['sessions', d.sessions], ['webserver', 'server.js · port 7777'],
        ['domains', 'maxichen.de · maxichen.gamebot.me']
      ].map(([k, v]) => '<span class="k">' + k + '</span><span class="v">' + fmt.esc(v) + '</span>').join('') + '</div>' +
      '<div class="sep"></div><div class="row"><button class="btn ghost sm" onclick="APP.sysAct(\'restart\')">↻ Bot restart</button>' +
      '<button class="btn ghost sm" onclick="APP.sysAct(\'gc\')">🧹 GC</button>' +
      '<button class="btn danger sm" onclick="APP.sysAct(\'shutdown\')">× Shutdown</button></div>');
  };

  /* ---------- Settings ---------- */
  V.settings = async (el) => {
    const moods = NightFX.MOODS.map((m) =>
      '<button class="btn ghost sm ' + (NightFX.getMood() === m.id ? '' : '') + '" style="' + (NightFX.getMood() === m.id ? 'border-color:var(--accent);color:#fff;box-shadow:var(--accent-glow)' : '') + '" onclick="APP.setMood(\'' + m.id + '\')">' + m.icon + ' ' + m.id + '</button>').join(' ');
    el.innerHTML = '<div class="grid c2">' +
      panel('🌙 Atmosphäre', '<label class="fld">Mood</label><div class="row">' + moods + '</div>' +
        '<label class="fld">Regen</label><div class="row"><button class="btn ghost sm" onclick="APP.setRain(' + (!NightFX.getRain()) + ')">' + (NightFX.getRain() ? '🌧️ an' : '☁ aus') + '</button></div>' +
        '<label class="fld">Nightmode (reduziert)</label><div class="row"><button class="btn ghost sm" onclick="APP.setNight(' + (!NightFX.getNightmode()) + ')">' + (NightFX.getNightmode() ? '🌑 reduziert' : '✨ voll') + '</button></div>' +
        '<p class="hint">Mood ändert Akzentfarbe, Texte und Stimmung — terminal & web.</p>') +
      panel('⚙ Bot', '<label class="fld">Prefix</label><input value="$" id="setPrefix" maxlength="2" style="width:70px">' +
        '<label class="fld">Bot-Name</label><input value="LoveBot ☾" id="setName">' +
        '<label class="fld">Domains</label><input value="maxichen.de · maxichen.gamebot.me" disabled>' +
        '<div class="row mt"><button class="btn" onclick="APP.saveSettings()">💾 Speichern</button></div>' +
        '<div class="sep"></div><p class="dim small" style="font-style:italic;margin:0">☾ settings werden lokal & in der Database gesichert.</p>') +
      '</div>';
  };


  /* ---------- 📈 Charts & Auswertung (Full-Update) ---------- */
  V.charts = async (el) => {
    const safeNum = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
    let stats = {}, sys = {}, logLines = [];
    try { const r = await API.get('/api/stats'); stats = r.data || {}; } catch (e) {}
    try { const r = await API.get('/api/system'); sys = r.data || {}; } catch (e) {}
    try { const r = await API.get('/api/logs?lines=300'); logLines = (r.data && r.data.lines) || []; } catch (e) {}

    const tagCount = {};
    logLines.forEach((l) => { const t = String(l.tag || '').toUpperCase(); tagCount[t] = (tagCount[t] || 0) + 1; });
    const topTags = Object.entries(tagCount).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const maxTag = topTags.length ? topTags[0][1] : 1;

    const bar = (label, val, max, color) =>
      '<div style="margin:9px 0"><div class="row" style="gap:10px;align-items:center"><span class="small" style="width:120px;color:var(--muted)">' + fmt.esc(label) + '</span>' +
      '<div style="flex:1;height:9px;border-radius:5px;background:rgba(255,255,255,.07);overflow:hidden"><div style="width:' + Math.max(3, Math.round(100 * val / Math.max(1, max))) + '%;height:100%;border-radius:5px;background:linear-gradient(90deg,' + color + ',transparent)"></div></div>' +
      '<span class="mono small" style="width:46px;text-align:right">' + fmt.num(val) + '</span></div></div>';

    const tiles = [
      stat('💜 Nutzer', fmt.num(safeNum(stats.users)), 'Profile erinnert', 'pink'),
      stat('👥 Gruppen', fmt.num(safeNum(stats.groups)), 'in der Datenbank', 'violet'),
      stat('💬 Nachrichten', fmt.num(safeNum(stats.messages)), 'gesendet & empfangen', 'cyan'),
      stat('⌨️ Befehle', fmt.num(safeNum(stats.commands)), 'ausgeführt', 'violet'),
      stat('🔗 Sessions', safeNum(stats.sessionsOnline) + '/' + safeNum(stats.sessionsTotal), 'online/gesamt', 'ok'),
      stat('🚨 Fehler', fmt.num(safeNum(stats.errors)), 'im Log', safeNum(stats.errors) ? 'danger' : 'ok'),
      stat('🧠 RAM', fmt.mb(safeNum(sys.ramMb || stats.ramMb)), 'Love.js', 'pink'),
      stat('🌙 Uptime', fmt.dur(safeNum(stats.uptimeSec)), 'awake', 'ok')
    ].join('');

    el.innerHTML =
      '<div class="panel fade-in" style="background:linear-gradient(120deg,rgba(255,120,190,.10),rgba(130,95,255,.08),rgba(70,200,255,.08));border:1px solid rgba(255,255,255,.10)"><div class="body" style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">' +
      '<div style="font-size:34px">📈</div><div style="flex:1;min-width:220px"><h2 style="margin:0 0 2px">Charts & Auswertung</h2>' +
      '<span class="dim small">Live-Kennzahlen, Log-Verteilung & System — alles auf einen Blick · Stand ' + fmt.esc(new Date().toLocaleString('de-DE')) + '</span></div>' +
      '<div class="right"><button class="btn ghost sm" onclick="route()">🔄 Aktualisieren</button></div></div></div>' +
      '<div class="grid c4 mb" style="margin-top:14px">' + tiles + '</div>' +
      '<div class="grid c2">' +
        panel('🧾 Log-Verteilung (letzte Einträge)', (topTags.length
          ? topTags.map(([t, c]) => bar(t, c, maxTag, t === 'ERROR' ? 'var(--danger)' : t === 'SECURITY' ? 'var(--warn)' : 'var(--accent)')).join('')
          : '<p class="dim small">noch keine Log-Einträge.</p>'), '<span class="pill info">' + fmt.num(logLines.length) + '</span>') +
        panel('📊 Kennzahlen', '<div class="kv">' + [
          ['online', stats.heartbeat && stats.heartbeat.online ? '✅ ja' : '—'],
          ['db healthy', stats.dbHealthy ? '✅' : '⚠️ prüfen'],
          ['aktive Bot-Sessions', safeNum(stats.sessionsOnline) + ' / ' + safeNum(stats.sessionsTotal)],
          ['log-Last', fmt.num(logLines.length) + ' Zeilen geladen'],
          ['ram gesamt', fmt.mb(safeNum(sys.ramTotalMb || 0))],
          ['node', String(sys.node || '—')],
          ['platform', String(sys.platform || '—') + ' ' + String(sys.arch || '')]
        ].map(([k, v]) => '<span class="k">' + k + '</span><span class="v">' + fmt.esc(v) + '</span>').join('') + '</div>') +
      '</div>' +
      '<p class="dim small center" style="text-align:center;margin:14px 0 4px">📈 Auswertung · Teil des LoveBot Full-Update ☾</p>';
  };

  /* ---------- 📚 Doku & Hilfe (Full-Update) ---------- */
  V.doku = async (el) => {
    const cats = window.LOVE_CATS || [];
    const cmds = window.LOVE_COMMANDS || [];
    const body = cats.map((cat) => {
      const list = cmds.filter((c) => c.cat === cat.id);
      if (!list.length) return '';
      const rows = list.map((c) => [
        '<span class="mono neon-pink">$' + fmt.esc(c.name) + '</span>' + (c.aliases && c.aliases.length ? '<span class="dim small"> · $' + c.aliases.join(', $') + '</span>' : ''),
        '<span class="small">' + fmt.esc(c.desc) + '</span>',
        c.status === 'live' ? pill('LIVE') : pill('WAIT', 'plan'),
        c.perm && c.perm !== 'user' ? pill(c.perm.toUpperCase()) : '<span class="dim small">alle</span>'
      ]);
      return '<div class="mb">' + panel(cat.icon + ' ' + fmt.esc(cat.label), table(['Befehl', 'Beschreibung', 'Status', 'Recht'], rows)) + '</div>';
    }).join('');

    el.innerHTML =
      '<div class="panel fade-in" style="background:linear-gradient(120deg,rgba(255,120,190,.10),rgba(130,95,255,.08),rgba(70,200,255,.08));border:1px solid rgba(255,255,255,.10)"><div class="body">' +
      '<div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap"><div style="font-size:34px">📚</div><div style="flex:1;min-width:220px"><h2 style="margin:0 0 2px">Doku & Hilfe</h2>' +
      '<span class="dim small">Das LoveBot-Kompendium — Befehle, Features, Schutz & Tipps an einem Ort.</span></div></div></div></div>' +
      '<div class="grid c3 mb" style="margin-top:14px">' +
        stat('Befehle', fmt.num(cmds.length), 'im Überblick', 'pink') +
        stat('Kategorien', fmt.num(cats.length), 'gruppiert', 'violet') +
        stat('Live', fmt.num(cmds.filter((c) => c.status === 'live').length), 'davon aktiv', 'ok') +
      '</div>' +
      '<div class="grid c2" style="align-items:start;margin-bottom:14px">' +
        panel('🔐 Datei-Schutz (Downloads)', '<p class="small dim" style="line-height:1.6">Seit Runde 5–8 ist dein Datei-Login dreistufig:<br>• <b>Admin-Passwort</b> beim Herunterladen (Panel)<br>• <b>Office-Verschlüsselung</b>: lade Dateien im <a href="#/downloads" style="color:var(--accent)">Downloads</a>-Bereich — jede Office-Datei ist beim Öffnen Passwort-geschützt, wenn <span class="mono">DATEI_LOGIN_PW</span> in der .env steht.<br>• <b>Firmen-Login</b> (Benutzername+Passwort) via <span class="mono">Schutz/Schuetzen.bat</span> für .xlsm/.docm auf Windows.</p>') +
        panel('💡 Tipps', '<p class="small dim" style="line-height:1.6">• Alle Befehle mit <span class="mono">$</span> starten — <span class="mono">$menu</span> zeigt alles.<br>• Alias-Funktion: <span class="mono">$witz</span> = <span class="mono">$joke</span>, <span class="mono">$liebe</span> = <span class="mono">$love</span>.<br>• Eigene Gruppen-Features pro Gruppe unter <a href="#/features" style="color:var(--accent)">🎛️ Features</a>.<br>• Live-Logs im <a href="#/monitor" style="color:var(--accent)">📡 Monitor</a> & unter <a href="#/logs" style="color:var(--accent)">📝 Logs</a>.</p>') +
      '</div>' + body +
      '<p class="dim small center" style="text-align:center;margin:14px 0 4px">📚 LoveBot-Kompendium · Full-Update ☾</p>';
  };

  /* ---------- 🗞️ Neuigkeiten / Changelog (Full-Update) ---------- */
  V.updates = async (el) => {
    const NEWS = [
      { icon: '✨', badge: 'NEU', title: 'Full-Update 2026 (Runde 9)', date: '9.9.2026', text: '12 neue WhatsApp-Befehle ($münzwurf, $würfel, $scheresteinpapier, $wahrheitoderpflicht, $mantra, $lottoschein, $zufallszahl, $morse, $schicksal, $geschenkidee, $essen, $entspannung), 3 neue Panel-Seiten (Charts, Doku, Neuigkeiten) und 2 neue öffentliche Seiten (Spiele, Regeln).' },
      { icon: '🔐', badge: 'SCHUTZ', title: 'Datei-Login automatisch (Runde 8)', date: '9.9.2026', text: 'Downloads werden serverseitig mit Office-Verschlüsselung geschützt (DATEI_LOGIN_PW in der .env) — jede heruntergeladene Office-Datei fragt beim Öffnen nach dem Passwort, auch innerhalb der All-in-One-ZIP.' },
      { icon: '🔧', badge: 'FIX', title: 'Login-Fix + Passwort-Sperre (Runde 7)', date: '9.9.2026', text: 'Makro-Login mit Notfall-Fallback (Windows-Dialog), Selbstprüfung im Schutz-Tool, neues schuetzen-passwort.py für die zuverlässige Verschlüsselung ohne Makro.' },
      { icon: '🎨', badge: 'LOOK', title: 'LoveBot-Firmen-Login (Runde 6)', date: '9.9.2026', text: 'Login-Fenster im LoveBot-Look (LOVEBOT ☾, Sicherer Dokumenten-Zugriff) mit Benutzername + maskiertem Passwort und ANMELDEN-Button.' },
      { icon: '📥', badge: 'DOWNLOAD', title: 'Download = nur Admin-Passwort (Runde 5)', date: '9.9.2026', text: 'Das Download-Gate verlangt nur noch das separate Admin-Passwort; der Benutzername+Passwort-Schutz sitzt in der Datei selbst.' }
    ];
    el.innerHTML =
      '<div class="panel fade-in" style="background:linear-gradient(120deg,rgba(255,120,190,.10),rgba(130,95,255,.08),rgba(70,200,255,.08));border:1px solid rgba(255,255,255,.10)"><div class="body" style="display:flex;gap:14px;align-items:center;flex-wrap:wrap">' +
      '<div style="font-size:34px">🗞️</div><div style="flex:1;min-width:220px"><h2 style="margin:0 0 2px">Neuigkeiten</h2><span class="dim small">Was LoveBot zuletzt gelernt hat — Runde für Runde.</span></div></div></div>' +
      '<div class="grid" style="margin-top:14px;gap:12px">' +
      NEWS.map((n) => '<div class="panel fade-in"><div class="body" style="display:flex;gap:14px">' +
        '<div style="font-size:26px">' + n.icon + '</div>' +
        '<div style="flex:1;min-width:0"><div class="row" style="align-items:center;gap:10px;flex-wrap:wrap"><b>' + fmt.esc(n.title) + '</b>' +
        '<span class="pill info" style="font-size:9px">' + fmt.esc(n.badge) + '</span><span class="dim small mono">' + fmt.esc(n.date) + '</span></div>' +
        '<p class="small dim" style="margin:6px 0 0;line-height:1.6">' + fmt.esc(n.text) + '</p></div></div></div>').join('') +
      '</div>' +
      '<div class="panel fade-in" style="margin-top:14px"><div class="body"><div style="font-weight:600;margin-bottom:8px">🌐 Neue öffentliche Seiten</div>' +
      '<div class="row" style="gap:10px;flex-wrap:wrap">' +
      '<a class="btn" href="/spiele.html" target="_blank" rel="noopener">🎲 Spiele &amp; Fun ansehen</a>' +
      '<a class="btn ghost" href="/regeln.html" target="_blank" rel="noopener">🤝 Community-Regeln ansehen</a>' +
      '</div></div></div>' +
      '<p class="dim small center" style="text-align:center;margin:14px 0 4px">🗞️ Liebe Grüße, LoveBot ☾</p>';
  };

  /* ---------- Mein Account ---------- */
  V.account = async (el) => {
    const [a, ss] = await Promise.all([API.get('/api/account'), API.get('/api/account/sessions')]);
    const acc = (a.data || {}).account;
    if (!acc) { el.innerHTML = panel('🪪 Mein Account', '<p class="dim">☾ kein Account verknüpft — Legacy-Login.</p>'); return; }
    const role = (window.LOVE_ROLE_LABELS || {})[acc.role] || acc.role.toUpperCase();
    el.innerHTML = '<div class="grid c2">' +
      panel('🪪 Profil', '<div class="kv">' + [
        ['username', acc.username], ['rolle', role], ['status', acc.status],
        ['verknüpft', acc.number], ['scope', acc.scope?.type === 'group' ? 'nur diese Gruppe' : 'global'],
        ['erstellt', acc.createdAt ? new Date(acc.createdAt).toLocaleDateString('de-DE') : '—'],
        ['letzter login', acc.lastLoginAt ? new Date(acc.lastLoginAt).toLocaleString('de-DE') : '—']
      ].map(([k, v]) => '<span class="k">' + k + '</span><span class="v">' + fmt.esc(v) + '</span>').join('') + '</div>' +
      '<div class="sep"></div><p class="dim small" style="font-style:italic;margin:0">☾ you keep everything awake.</p>') +
      '<div>' +
      panel('🔑 Passwort ändern', '<label class="fld">Altes Passwort</label><input type="password" id="pwOld">' +
        '<label class="fld">Neues Passwort (mind. 8)</label><input type="password" id="pwNew">' +
        '<label class="fld">Bestätigen</label><input type="password" id="pwNew2">' +
        '<div class="row mt"><button class="btn" onclick="APP.changePw()">💾 Ändern</button></div><div class="msg" id="pwMsg"></div>') +
      '<div class="mt">' + panel('🖥️ Aktive Sessions',
        table(['Token', 'Erstellt', ''], (ss.data.sessions || []).map((x) => [
          '<span class="mono small">' + fmt.esc(x.tokenHint) + '</span>',
          '<span class="dim small">' + (x.createdAt ? new Date(x.createdAt).toLocaleString('de-DE') : '') + '</span>',
          x.current ? pill('ON', 'current') : '<button class="btn danger sm" data-tok="' + fmt.esc(x.tokenHint) + '" onclick="APP.revoke(this.dataset.tok)">widerrufen</button>'
        ]), 'keine weiteren Sessions') +
        '<div class="row mt"><button class="btn danger sm" onclick="APP.revokeAll()">⏻ Alle anderen abmelden</button></div>') +
      '</div></div>';
  };

  /* ---------- 📜 Verlauf (History) ----------
     Owner sieht die Historie JEDES Kontos (per Dropdown) oder alle gemischt;
     andere Rollen sehen nur ihre eigene — der Server erzwingt das zusätzlich. */
  V.history = async (el) => {
    const isOwner = ((window.__loveRole || '') === 'owner') || (window.__lovePerms || []).includes('*');
    let accList = [];
    if (isOwner) {
      try { accList = (await API.get('/api/accounts')).data.accounts || []; } catch (e) { accList = []; }
    }
    const KIND_META = {
      konto:   { pill: 'ACTIVE',     icon: '🆕' },
      rolle:   { pill: 'OWNER',      icon: '🎖️' },
      status:  { pill: 'WATCH',      icon: '🚦' },
      rechte:  { pill: 'ADMIN',      icon: '🛡️' },
      pw:      { pill: 'INFO',       icon: '🔑' },
      login:   { pill: 'ONLINE',     icon: '🔓' },
      hinweis: { pill: 'SUSPICIOUS', icon: '💡' }
    };
    const K = (k) => KIND_META[k] || { pill: 'INFO', icon: '•' };

    const render = async (targetUser) => {
      el.innerHTML = '<p class="dim" style="padding:24px">☾ lade Verlauf…</p>';
      const r = await API.get('/api/history' + (targetUser ? '?user=' + encodeURIComponent(targetUser) : ''));
      const data = r.data || {};
      const entries = data.entries || [];
      const opts = ['<option value="">👑 Alle Konten (gemischt)</option>']
        .concat(accList.map((a) => '<option value="' + fmt.esc(a.username || a.number) + '"' + (targetUser === (a.username || a.number) ? ' selected' : '') + '>' +
          fmt.esc('@' + (a.username || a.number) + (a.role ? ' · ' + a.role : '')) + '</option>')).join('');
      const rows = entries.slice(0, 400).map((e) => {
        const m = K(e.k);
        const when = e.t ? new Date(e.t).toLocaleString('de-DE') : '';
        return '<div style="display:flex;gap:10px;align-items:flex-start;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.045)">' +
          '<div style="flex:0 0 auto;width:22px;text-align:center">' + m.icon + '</div>' +
          '<div style="flex:0 0 96px;padding-top:1px">' + pill(m.pill, e.label || '') + '</div>' +
          '<div style="flex:1;min-width:0">' +
            '<div style="font-size:13px">' + fmt.esc(e.d || '') + '</div>' +
            (e.by ? '<div class="dim" style="font-size:11px;margin-top:1px">von <b>' + fmt.esc(e.by) + '</b></div>' : '') +
          '</div>' +
          '<div class="mono dim small" style="flex:0 0 auto;text-align:right;font-size:11px">' +
            '<div>' + fmt.esc(e.u) + '</div><div>' + fmt.esc(when) + '</div>' +
          '</div>' +
        '</div>';
      }).join('') || '<p class="dim small" style="padding:10px 0">Keine Einträge.</p>';

      el.innerHTML =
        '<div class="panel fade-in"><div class="body">' +
          '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">' +
            '<div style="font-size:30px">📜</div>' +
            '<div style="flex:1;min-width:200px">' +
              '<h3 style="margin:0 0 2px">Verlauf — Konto-Änderungen</h3>' +
              '<div class="dim small">' + (isOwner
                ? 'Owner-Ansicht: wähle ein Konto — oder „Alle Konten“, um alles gemischt zu sehen.'
                : 'Deine eigene Konto-Historie (Rollen · Status · Rechte · Passwort · Logins).') + '</div>' +
            '</div>' +
            (isOwner
              ? '<select id="histUser" style="min-width:230px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.14);color:#fff;border-radius:8px;padding:8px 10px;font-size:13px">' + opts + '</select>'
              : '<span class="pill OWNER"><span class="d"></span>nur ich</span>') +
            '<button class="btn ghost sm" onclick="APP.reloadHistory()">🔄</button>' +
          '</div>' +
          '<div class="sep"></div>' +
          '<div class="mono dim small" style="margin-bottom:6px">' + entries.length + ' Ereignisse · Modus: ' + fmt.esc(data.mode || '') + '</div>' +
          rows +
        '</div></div>';
      const sel = document.querySelector('#histUser');
      if (sel) sel.onchange = () => render(sel.value);
    };

    const hash = (location.hash || '').split('?')[1] || '';
    const initUser = isOwner ? new URLSearchParams(hash).get('user') || '' : '';
    await render(initUser);
  };

  /* ---------- Accounts (Team) ---------- */

  const STATUS_PILL = {
    active: () => pill('ACTIVE', '✅ Aktiv'),
    pending: () => pill('WAIT', '⏳ Ausstehend'),
    restricted: () => pill('WATCH', '⚠️ Eingeschränkt'),
    locked: () => pill('OFF', '⛔ Gesperrt'),
    disabled: () => pill('OFF', '🚫 Deaktiviert')
  };
  V.accounts = async (el) => {
    const r = await API.get('/api/accounts');
    window.__accountsMap = window.__accountsMap || {};
    const rows = (r.data.accounts || []).map((x) => {
      window.__accountsMap[x.id] = x;
      return [
        '<span class="n">' + fmt.esc(x.username) + '</span>',
        '<span class="mono small dim">' + fmt.esc(x.number) + '</span>',
        pill(x.role.toUpperCase()),
        x.scope?.type === 'group' ? '<span class="pill vio">GROUP-SCOPE</span>' : '<span class="dim small">global</span>',
        (STATUS_PILL[x.status] || STATUS_PILL.active)(),
        x.mustChange ? pill('WAIT', 'PW wechseln') : '<span class="dim small">—</span>',
        '<span class="dim small">' + (x.lastLoginAt ? new Date(x.lastLoginAt).toLocaleString('de-DE') : 'nie') + '</span>',
        '<button class="btn ghost sm" data-akte="' + x.id + '">🗂️ Akte</button>'
      ];
    });
    el.innerHTML = panel('👥 Dashboard-Accounts — Benutzerverwaltung', table(['Username', 'Nummer', 'Rolle', 'Scope', 'Status', 'PW', 'Letzter Login', 'Akte'], rows,
      '☾ noch keine Accounts.'), '<button class="btn sm" onclick="APP.newAccount()">+ Account</button>');
    el.querySelectorAll('[data-akte]').forEach((btn) => {
      btn.onclick = () => APP.openAkte(btn.getAttribute('data-akte'), el);
    });
  };

  /* ---------- 🗂️ Benutzerakte: Profil / Zugang / Sicherheit / Aktivität ---------- */
  async function renderAkte(id, refreshEl) {
    const [dr, pr] = await Promise.all([API.get('/api/accounts/' + id + '/detail'), API.get('/api/permissions')]);
    if (!dr.data || !dr.data.ok) { toast('✕ Fehler', (dr.data && dr.data.error) || 'Konnte Akte nicht laden.', 'error'); return; }
    const a = dr.data.account;
    /* activeSessions kommt als Geschwister-Key neben account (nicht in account). */
    const activeSessions = dr.data.activeSessions || [];
    const roleHistory = a.roleHistory || [];
    const statusHistory = a.statusHistory || [];
    const permsHistory = a.permsHistory || [];
    const permsExtra = a.permsExtra || [];
    const permsRevoked = a.permsRevoked || [];
    const effectivePerms = a.effectivePerms || [];
    const ref = pr.data || {};
    const perms = ref.permissions || [];
    const templates = ref.templates || {};
    const statuses = ref.statuses || [];
    const restrictable = ref.restrictableFeatures || [];
    const isOwnerAcc = a.role === 'owner';
    const canManage = (window.__lovePerms || []).includes('*') || (window.__lovePerms || []).includes('accounts.manage');
    const canAssignRoles = (window.__lovePerms || []).includes('*') || (window.__lovePerms || []).includes('roles.assign');

    const byCat = {};
    perms.forEach((p) => { (byCat[p.cat] = byCat[p.cat] || []).push(p); });
    const permsGrid = Object.keys(byCat).map((cat) => {
      const items = byCat[cat].map((p) => {
        const has = effectivePerms.includes(p.id);
        const fromRole = !permsExtra.includes(p.id) && !permsRevoked.includes(p.id) && has;
        return '<label class="small" style="display:flex;align-items:center;gap:6px;padding:2px 0" title="' + (p.critical ? 'Kritisches Recht' : '') + '">' +
          '<input type="checkbox" data-perm-cb="' + p.id + '" ' + (has ? 'checked' : '') + ' ' + (isOwnerAcc || !canAssignRoles ? 'disabled' : '') + '>' +
          fmt.esc(p.label) + (p.critical ? ' <span class="dim" style="font-size:10px">⚠️kritisch</span>' : '') + (fromRole ? ' <span class="dim" style="font-size:10px">(via Rolle)</span>' : '') +
          '</label>';
      }).join('');
      return '<div style="margin-bottom:10px"><div class="dim small" style="text-transform:uppercase;letter-spacing:.06em;font-size:10px;margin-bottom:4px">' + fmt.esc(cat) + '</div>' + items + '</div>';
    }).join('');

    const tplButtons = Object.keys(templates).map((tid) =>
      '<button class="btn ghost sm" data-apply-template="' + tid + '" ' + (isOwnerAcc || !canAssignRoles ? 'disabled' : '') + '>' + fmt.esc(templates[tid].label) + '</button>'
    ).join(' ');

    const restrictionsBoxes = restrictable.map((f) =>
      '<label class="small" style="display:flex;align-items:center;gap:6px;padding:2px 0"><input type="checkbox" data-restr-cb="' + f.id + '" ' + ((a.restrictions || []).includes(f.id) ? 'checked' : '') + '> ' + fmt.esc(f.label) + '</label>'
    ).join('');

    const statusOptions = statuses.map((s) => '<option value="' + s.id + '" ' + (s.id === a.status ? 'selected' : '') + '>' + s.icon + ' ' + fmt.esc(s.label) + '</option>').join('');
    const roleOptions = ['user', 'supporter', 'groupadmin', 'admin', 'deputy', 'owner'].map((rl) => '<option ' + (rl === a.role ? 'selected' : '') + '>' + rl + '</option>').join('');

    const historyRows = (list, cols) => (list || []).slice().reverse().slice(0, 15).map(cols);

    const html =
      '<h3>🗂️ Benutzerakte — ' + fmt.esc(a.username) + '</h3>' +
      '<div class="tabbar" style="display:flex;gap:6px;margin:10px 0;flex-wrap:wrap">' +
        '<button class="btn ghost sm akte-tab-btn active" data-akte-tab="profil">👤 Profil</button>' +
        '<button class="btn ghost sm akte-tab-btn" data-akte-tab="zugang">🔑 Zugang &amp; Rechte</button>' +
        '<button class="btn ghost sm akte-tab-btn" data-akte-tab="sicherheit">🛡️ Sicherheit</button>' +
        '<button class="btn ghost sm akte-tab-btn" data-akte-tab="aktivitaet">🧾 Aktivität</button>' +
      '</div>' +
      '<div data-akte-panel="profil">' +
        '<div class="kv">' +
          '<span class="k">Username</span><span class="v">' + fmt.esc(a.username) + '</span>' +
          '<span class="k">Nummer</span><span class="v mono">' + fmt.esc(a.number) + '</span>' +
          '<span class="k">Rolle</span><span class="v">' + pill(a.role.toUpperCase()) + '</span>' +
          '<span class="k">Status</span><span class="v">' + (STATUS_PILL[a.status] || STATUS_PILL.active)() + '</span>' +
          '<span class="k">Scope</span><span class="v mono small">' + (a.scope?.type === 'group' ? 'Gruppe: ' + fmt.esc(a.scope.groupJid || '') : 'global') + '</span>' +
          '<span class="k">Erstellt</span><span class="v mono small">' + fmt.esc(new Date(a.createdAt).toLocaleString('de-DE')) + '</span>' +
          '<span class="k">Letzter Login</span><span class="v mono small">' + (a.lastLoginAt ? fmt.esc(new Date(a.lastLoginAt).toLocaleString('de-DE')) : 'nie') + '</span>' +
          (a.lockedReason ? '<span class="k">Grund (gesperrt)</span><span class="v small">' + fmt.esc(a.lockedReason) + '</span>' : '') +
        '</div>' +
        (canManage && !isOwnerAcc ? '<div class="sep"></div><label class="fld">Status ändern</label><div class="row" style="gap:8px;flex-wrap:wrap">' +
          '<select id="akteStatus" style="width:auto">' + statusOptions + '</select>' +
          '<input id="akteStatusReason" placeholder="Grund (Pflicht)" style="flex:1;min-width:180px">' +
          '<button class="btn danger sm" id="akteStatusBtn">Status setzen</button></div>' : '') +
        (a.status === 'restricted' ? '<div class="sep"></div><label class="fld">Eingeschränkte Funktionen</label>' + restrictionsBoxes +
          (canManage ? '<input id="akteRestrReason" placeholder="Grund (Pflicht)" style="margin-top:6px"><button class="btn ghost sm" id="akteRestrBtn" style="margin-top:6px">Einschränkungen speichern</button>' : '') : '') +
      '</div>' +
      '<div data-akte-panel="zugang" style="display:none">' +
        (canAssignRoles && !isOwnerAcc ? '<label class="fld">Rolle</label><div class="row" style="gap:8px"><select id="akteRole" style="width:auto">' + roleOptions + '</select>' +
          '<input id="akteRoleReason" placeholder="Grund für Rollenänderung (Pflicht)" style="flex:1;min-width:180px"><button class="btn sm" id="akteRoleBtn">Rolle setzen</button></div><div class="sep"></div>' : '') +
        '<label class="fld">Rechte-Vorlagen (additiv)</label><div class="row" style="gap:6px;flex-wrap:wrap;margin-bottom:10px">' + (tplButtons || '<span class="dim small">keine Vorlagen</span>') + '</div>' +
        '<label class="fld">Einzelrechte (zusätzlich zur Rolle)</label>' +
        (isOwnerAcc ? '<p class="dim small">🔒 Owner-Accounts sind gegen Einzelrechte-Änderungen geschützt.</p>' : '') +
        '<div style="max-height:280px;overflow:auto;padding-right:6px">' + permsGrid + '</div>' +
        (canAssignRoles && !isOwnerAcc ? '<input id="aktePermsReason" placeholder="Grund für Rechteänderung (Pflicht)" style="margin-top:8px"><button class="btn sm" id="aktePermsBtn" style="margin-top:6px">Rechte speichern</button>' : '') +
      '</div>' +
      '<div data-akte-panel="sicherheit" style="display:none">' +
        '<div class="kv">' +
          '<span class="k">Muss Passwort ändern</span><span class="v">' + (a.mustChange ? '✅ ja' : '— nein') + '</span>' +
          '<span class="k">Passwort geändert am</span><span class="v mono small">' + (a.passwordChangedAt ? fmt.esc(new Date(a.passwordChangedAt).toLocaleString('de-DE')) : '—') + '</span>' +
        '</div><div class="sep"></div>' +
        '<label class="fld">Aktive Sessions dieses Accounts</label>' +
        (activeSessions.length ? activeSessions.map((s) => '<div class="small mono dim" style="padding:3px 0">' + fmt.esc(s.tokenHint) + ' · seit ' + fmt.esc(new Date(s.createdAt).toLocaleString('de-DE')) + '</div>').join('') : '<p class="dim small">keine aktiven Sessions</p>') +
      '</div>' +
      '<div data-akte-panel="aktivitaet" style="display:none">' +
        '<label class="fld">Rollen-Verlauf</label>' +
        (roleHistory.length ? historyRows(roleHistory, (h) => '<div class="small" style="padding:3px 0"><span class="mono dim">' + fmt.esc(new Date(h.at).toLocaleString('de-DE')) + '</span> · ' + fmt.esc(h.from || '—') + ' → <b>' + fmt.esc(h.role) + '</b> · von ' + fmt.esc(h.by) + '</div>').join('') : '<p class="dim small">kein Verlauf</p>') +
        '<div class="sep"></div><label class="fld">Status-Verlauf</label>' +
        (statusHistory.length ? historyRows(statusHistory, (h) => '<div class="small" style="padding:3px 0"><span class="mono dim">' + fmt.esc(new Date(h.at).toLocaleString('de-DE')) + '</span> · ' + fmt.esc(h.from) + ' → <b>' + fmt.esc(h.to) + '</b> · ' + fmt.esc(h.reason || '') + ' · von ' + fmt.esc(h.by) + '</div>').join('') : '<p class="dim small">kein Verlauf</p>') +
        '<div class="sep"></div><label class="fld">Rechte-Verlauf</label>' +
        (permsHistory.length ? historyRows(permsHistory, (h) => '<div class="small" style="padding:3px 0"><span class="mono dim">' + fmt.esc(new Date(h.at).toLocaleString('de-DE')) + '</span> · ' + fmt.esc(h.reason || '') + ' · von ' + fmt.esc(h.by) + '</div>').join('') : '<p class="dim small">kein Verlauf</p>') +
      '</div>';

    const m = modal(html, [{ label: 'Schließen', cls: 'ghost' }]);
    const bg = m.el;
    bg.querySelectorAll('.akte-tab-btn').forEach((btn) => {
      btn.onclick = () => {
        bg.querySelectorAll('.akte-tab-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        bg.querySelectorAll('[data-akte-panel]').forEach((p) => { p.style.display = p.getAttribute('data-akte-panel') === btn.getAttribute('data-akte-tab') ? '' : 'none'; });
      };
    });
    const statusBtn = bg.querySelector('#akteStatusBtn');
    if (statusBtn) statusBtn.onclick = async () => {
      const status = bg.querySelector('#akteStatus').value;
      const reason = (bg.querySelector('#akteStatusReason').value || '').trim();
      if (!reason) return toast('✕ Grund fehlt', 'Bitte einen Grund für die Statusänderung angeben.', 'error');
      const res = await postCritical('/api/accounts/status', { id, status, reason }, 'Diese Statusänderung ist kritisch.');
      if (!res) return;
      if (res.data && res.data.ok) { toast('✓ Status geändert', res.data.before + ' → ' + res.data.after, 'ok'); m.close(); V.accounts(refreshEl); }
      else toast('✕ Fehler', (res.data && res.data.error) || 'Fehler.', 'error');
    };
    const restrBtn = bg.querySelector('#akteRestrBtn');
    if (restrBtn) restrBtn.onclick = async () => {
      const restrictions = Array.from(bg.querySelectorAll('[data-restr-cb]:checked')).map((c) => c.getAttribute('data-restr-cb'));
      const reason = (bg.querySelector('#akteRestrReason').value || '').trim();
      if (!reason) return toast('✕ Grund fehlt', 'Bitte einen Grund angeben.', 'error');
      const res = await API.post('/api/accounts/restrictions', { id, restrictions, reason });
      if (res.data && res.data.ok) { toast('✓ Einschränkungen gespeichert', '', 'ok'); m.close(); V.accounts(refreshEl); }
      else toast('✕ Fehler', (res.data && res.data.error) || 'Fehler.', 'error');
    };
    const roleBtn = bg.querySelector('#akteRoleBtn');
    if (roleBtn) roleBtn.onclick = async () => {
      const role = bg.querySelector('#akteRole').value;
      const reason = (bg.querySelector('#akteRoleReason').value || '').trim();
      if (!reason) return toast('✕ Grund fehlt', 'Bitte einen Grund für die Rollenänderung angeben.', 'error');
      const res = await postCritical('/api/accounts/role', { id, role, reason }, 'Beförderung auf Admin-Ebene oder höher ist kritisch.');
      if (!res) return;
      if (res.data && res.data.ok) { toast('✓ Rolle geändert', res.data.old + ' → ' + res.data.role, 'ok'); m.close(); V.accounts(refreshEl); }
      else toast('✕ Fehler', (res.data && res.data.error) || 'Fehler.', 'error');
    };
    const permsBtn = bg.querySelector('#aktePermsBtn');
    if (permsBtn) permsBtn.onclick = async () => {
      const reason = (bg.querySelector('#aktePermsReason').value || '').trim();
      if (!reason) return toast('✕ Grund fehlt', 'Bitte einen Grund für die Rechteänderung angeben.', 'error');
      const grant = [], revoke = [];
      bg.querySelectorAll('[data-perm-cb]').forEach((cb) => {
        const pid = cb.getAttribute('data-perm-cb');
        if (cb.checked && !effectivePerms.includes(pid)) grant.push(pid);
        if (!cb.checked && effectivePerms.includes(pid)) revoke.push(pid);
      });
      if (!grant.length && !revoke.length) return toast('ℹ️ Keine Änderung', 'Es wurde nichts geändert.', 'warn');
      const res = await postCritical('/api/accounts/perms', { id, grant, revoke, reason }, 'Änderung kritischer Einzelrechte.');
      if (!res) return;
      if (res.data && res.data.ok) { toast('✓ Rechte gespeichert', grant.length + ' gewährt, ' + revoke.length + ' entzogen', 'ok'); m.close(); V.accounts(refreshEl); }
      else toast('✕ Fehler', (res.data && res.data.error) || 'Fehler.', 'error');
    };
    bg.querySelectorAll('[data-apply-template]').forEach((btn) => {
      btn.onclick = async () => {
        const template = btn.getAttribute('data-apply-template');
        const res = await API.post('/api/accounts/template', { id, template, reason: 'Vorlage angewendet: ' + template });
        if (res.data && res.data.ok) { toast('✓ Vorlage angewendet', templates[template].label, 'ok'); m.close(); V.accounts(refreshEl); }
        else toast('✕ Fehler', (res.data && res.data.error) || 'Fehler.', 'error');
      };
    });
  }

  /* ---------- Rollen & Rechte ---------- */
  V.roles = async (el) => {
    const r = await API.get('/api/roles');
    const d = r.data || {};
    const cards = (d.roles || []).map((ro) => {
      const perms = (d.matrix || {})[ro.id] || [];
      return '<div class="stat ' + (ro.id === 'owner' ? 'pink' : ro.id === 'banned' ? 'danger' : 'violet') + '">' +
        '<div class="lbl">' + ro.icon + ' ' + fmt.esc(ro.label) + '</div>' +
        '<div class="val" style="font-size:15px;color:#fff;text-shadow:none">Level ' + ro.level + '</div>' +
        '<div class="sub mono" style="max-height:130px;overflow:auto">' + (perms.includes('*') ? '* (alles)' : perms.join(' · ') || '—') + '</div></div>';
    }).join('');
    el.innerHTML = '<p class="dim small mb">Rollen werden per <span class="mono neon-pink">$setrang &lt;rang&gt; @user</span> im WhatsApp-Bot vergeben — Dashboard-Rechte wechseln <b>sofort</b> (live sync, aktive Sessions inklusive). <span class="mono neon-cyan">$delrang</span> entzieht alles.</p>' +
      '<div class="grid c3">' + cards + '</div>';
  };

  /* ---------- Login-Sessions (Fritzbox-Stil: IP/UA je aktiver Session) ---------- */
  V.websessions = async (el) => {
    const r = await API.get('/api/sessions/all');
    /* 👑 Owner-Gate: Login-Sessions nur mit frischem Admin-Passwort */
    if (r.data && r.data.needsReauth) {
      el.innerHTML = '<div class="panel fade-in"><div class="body" style="text-align:center;padding:40px 20px"><div style="font-size:34px">🔐</div>' +
        '<h3>Admin-Bestätigung nötig</h3><p class="dim small">Wer ist gerade wo eingeloggt? Diese Ansicht ist geschützt — bestätige dich mit deinem Admin-Passwort.</p>' +
        '<div class="row" style="justify-content:center;margin-top:14px"><button class="btn" id="wsUnlock">🔓 Passwort eingeben</button></div></div></div>';
      const btn = $('#wsUnlock', el);
      if (btn) btn.onclick = async () => {
        if (await reauthGate('sessions.view', 'Die Übersicht der Login-Sessions ansehen.')) route();
        else toast('✕ Abgebrochen', 'Ohne Bestätigung bleibt die Seite gesperrt.', 'warn');
      };
      return;
    }
    const list = (r.data && r.data.sessions) || [];
    const canControl = (window.__lovePerms || []).includes('*') || (window.__lovePerms || []).includes('sessions.control');
    const isOwner = ((window.__loveRole || '') === 'owner');
    const rows = list.map((s) => [
      '<span class="n small">' + fmt.esc(s.username) + '</span>' + (s.current ? ' <span class="pill on">DU</span>' : ''),
      '<span class="dim small mono">' + fmt.esc(s.number) + '</span>',
      pill((s.role || '').toUpperCase()),
      '<span class="mono small">' + fmt.esc(s.ip || '—') + '</span>' + (s.ipChanged ? ' <span class="pill wait" title="IP hat sich seit Login geändert">⚠</span>' : ''),
      '<span class="dim small mono" style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:inline-block">' + fmt.esc(s.userAgent || '—') + '</span>',
      '<span class="dim small mono">' + fmt.esc(new Date(s.createdAt).toLocaleString('de-DE')) + '</span>',
      '<span class="dim small mono">' + fmt.esc(new Date(s.lastSeenAt).toLocaleString('de-DE')) + '</span>',
      (canControl && !s.current) ? '<button class="btn danger sm" data-kill-session="' + fmt.esc(s.token || '') + '">⏹ Beenden</button>' : (s.current ? '<span class="dim small">aktuelle Session</span>' : '<span class="dim small">—</span>')
    ]);
    el.innerHTML =
      '<div class="grid c3 mb">' +
        stat('Aktive Sessions', fmt.num(list.length), 'systemweit', 'violet') +
        stat('Verschiedene Nutzer', fmt.num(new Set(list.map((s) => s.number)).size), 'eingeloggt', 'pink') +
        stat('IP-Wechsel erkannt', fmt.num(list.filter((s) => s.ipChanged).length), '⚠ evtl. Session-Hijack prüfen', list.some((s) => s.ipChanged) ? 'warn' : 'ok') +
      '</div>' +
      panel('🖥️ Alle aktiven Dashboard-Sessions', table(
        ['Nutzer', 'Nummer', 'Rolle', 'IP', 'Gerät/Browser (User-Agent)', 'Erstellt', 'Zuletzt gesehen', ''],
        rows, '☾ keine aktiven Sessions.'),
        (isOwner ? '<button class="btn danger sm" id="killAllBtn">⛔ ALLE Sessions beenden (Notfall)</button>' : '') +
        '<span class="dim small" style="font-style:italic;display:block;margin-top:6px">💡 „⚠“ bedeutet: die IP hat sich seit dem Login dieser Session geändert — möglicher Hinweis auf Session-Diebstahl.</span>');

    el.querySelectorAll('[data-kill-session]').forEach((btn) => {
      btn.onclick = async () => {
        const token = btn.getAttribute('data-kill-session');
        if (!(await confirmBox('Session beenden?', '☾ Dieser Nutzer wird sofort ausgeloggt.', '⏹ Beenden'))) return;
        const res = await postCritical('/api/sessions/kill', { token }, 'Das Beenden einer fremden Login-Session verlangt dein Admin-Passwort.');
        if (!res) return;
        if (res.data && res.data.ok) { toast('⏹ Session beendet', '', 'ok'); V.websessions(el); }
        else toast('✕ Fehler', (res.data && res.data.error) || 'Konnte Session nicht beenden.', 'error');
      };
    });
    const killAllBtn = $('#killAllBtn', el);
    if (killAllBtn) {
      killAllBtn.onclick = async () => {
        const m = modal('<h3>⛔ ALLE Sessions beenden</h3><p class="small dim">Jede eingeloggte Person (außer dir) wird sofort ausgeloggt. Tippe zur Bestätigung <b>ALLE SESSIONS</b> ein.</p><input id="killAllConfirm" placeholder="ALLE SESSIONS"><div class="msg" id="killAllMsg"></div>',
          [
            { label: 'Abbrechen', cls: 'ghost' },
            { label: '⛔ Beenden', cls: 'danger', onClick: async (bg, close) => {
                const confirmText = (bg.querySelector('#killAllConfirm').value || '').trim();
                if (confirmText !== 'ALLE SESSIONS') { bg.querySelector('#killAllMsg').className = 'msg error'; bg.querySelector('#killAllMsg').textContent = 'Bestätigungstext stimmt nicht.'; return; }
                close();
                const res = await postCritical('/api/sessions/kill-all', { confirm: confirmText }, 'Beendet ALLE aktiven Dashboard-Sessions außer deiner eigenen.');
                if (!res) return;
                if (res.data && res.data.ok) { toast('⛔ Alle Sessions beendet', String(res.data.killed || 0), 'ok'); V.websessions(el); }
                else toast('✕ Fehler', (res.data && res.data.error) || 'Fehler.', 'error');
              } }
          ]);
      };
    }
  };

  /* ================================================================== */
  /*  Aktionen (global, von onclick genutzt)                            */
  /* ================================================================== */
  /* ---------- 🔳 Session-QR/Pairing-Code anzeigen (echte Daten, polling) ---------- */
  function renderSessionQrModal(id, title) {
    const m = UI.modal(
      '<h3>' + title + '</h3>' +
      '<p class="dim small" id="qrmNote">⏳ lädt QR…</p>' +
      '<div class="center" style="text-align:center;margin:8px 0">' +
      '<pre id="qrmQr" style="display:inline-block;background:#fff;color:#000;padding:10px;border-radius:8px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:5.5px;line-height:5.5px;letter-spacing:0;white-space:pre;margin:0"></pre>' +
      '<div id="qrmPair" class="mono neon-cyan" style="display:none;font-size:22px;letter-spacing:6px;padding:14px"></div>' +
      '</div>' +
      '<p class="dim small center" style="text-align:center;margin:0">Scanne mit <b>WhatsApp &rsaquo; Verknüpfte Geräte &rsaquo; Gerät verknüpfen</b></p>',
      [{ label: '✕ Schließen', cls: 'ghost' }]
    );
    const bg = m.el;
    const poll = async () => {
      if (!document.body.contains(bg)) return;
      let r;
      try { r = await API.get('/api/session/qr?id=' + encodeURIComponent(id)); } catch (e) { return; }
      const d = r.data || {};
      const note = bg.querySelector('#qrmNote');
      if (d.status === 'CONNECTED') {
        if (note) { note.className = 'msg ok boxed'; note.textContent = '✅ Session ist verbunden!'; }
        return;
      }
      if (d.hasQr && d.qr) {
        const pre = bg.querySelector('#qrmQr');
        if (pre) { pre.style.display = 'inline-block'; pre.textContent = d.qr; }
        const pair = bg.querySelector('#qrmPair'); if (pair) pair.style.display = 'none';
        if (note) { note.className = 'dim small'; note.textContent = 'QR ist aktiv — er läuft begrenzt und wechselt, bis gescannt wurde.'; }
      } else if (d.pairCode) {
        const pair = bg.querySelector('#qrmPair'); if (pair) { pair.style.display = 'block'; pair.textContent = d.pairCode; }
        const pre = bg.querySelector('#qrmQr'); if (pre) pre.style.display = 'none';
        if (note) { note.className = 'dim small'; note.textContent = 'Pairing-Code — WhatsApp &rsaquo; Verknüpfte Geräte &rsaquo; Mit Telefonnummer verknüpfen.'; }
      } else {
        if (note) note.textContent = '⏳ ' + (d.note || 'QR läuft noch an — wird gleich geladen…');
      }
    };
    poll();
    const iv = setInterval(() => { if (!document.body.contains(bg)) { clearInterval(iv); return; } poll(); }, 3500);
    return m;
  }

  window.APP = {
    async sessionAct(act, id) {
      if (!id) return;
      if (act === 'restart') {
        if (!(await confirmBox('Session neu starten?', '↻ ' + id + ' wird gestoppt und frisch gestartet.'))) return;
        const r = await API.post('/api/session/restart', { id });
        const d = r.data || {};
        if (d.ok) { toast('↻ Neustart', id + ' läuft wieder an…', 'ok'); route(); }
        else toast('✕ ' + (d.main ? 'Haupt-Bot' : 'Neustart'), d.error || 'Fehler.', d.main ? 'warn' : 'error');
        return;
      }
      /* altes kill → endgültiges Löschen der Session-Zeile */
      if (act === 'kill') return this.sessionDelete(id);
    },
    async newSession() {
      const m = UI.modal('<h3>+ New Session</h3>' +
        '<p class="dim small">Startet einen echten zusätzlichen WhatsApp-Bot (eigene Nummer) und zeigt den QR zum Verbinden.</p>' +
        '<label class="fld">Name</label><input id="nsName" placeholder="z. B. Support">' +
        '<label class="fld">Login-Methode</label>' +
        '<div class="row"><button class="btn sm cyan" id="nsQr">▣ QR-Code</button><button class="btn sm" id="nsPair">🔢 Pairing-Code</button></div>' +
        '<div class="msg" id="nsMsg"></div>', [{ label: 'Schließen', cls: 'ghost' }]);
      const go = async (mode) => {
        const box = m.el.querySelector('#nsMsg');
        const name = m.el.querySelector('#nsName').value.trim() || 'NeueSession';
        box.className = 'msg';
        box.textContent = '⏳ wird angelegt…';
        const r = await API.post('/api/session/create', { name, mode });
        const d = r.data || {};
        if (!d.ok) { box.className = 'msg error boxed'; box.textContent = d.error || 'Fehler beim Anlegen.'; return; }
        if (d.spawned) {
          box.className = 'msg ok boxed';
          box.innerHTML = '☾ Session <b>' + fmt.esc(d.session.name) + '</b> startet — QR erscheint gleich…';
          m.close();
          renderSessionQrModal(d.session.id, '🔳 Session „' + fmt.esc(d.session.name) + '“ verbinden');
          route();
        } else {
          /* spawn auf diesem Host aus → Session liegt als „wartend“ vor */
          box.className = 'msg warn boxed';
          box.innerHTML = 'Session <b>' + fmt.esc(d.session.name) + '</b> wurde als „wartend“ angelegt.<br>' +
            '<span class="small">Auf diesem Host ist <b>Multi-Session (spawn)</b> deaktiviert (Database/sessions.json). Du kannst sie jetzt aktivieren und sofort starten:</span>' +
            '<div class="row" style="margin-top:10px"><button class="btn sm" id="nsEnable">🔛 Aktivieren & starten</button>' +
            '<button class="btn danger sm" id="nsDiscard">🗑 wieder entfernen</button></div>';
          m.el.querySelector('#nsEnable').onclick = async () => {
            const btn = m.el.querySelector('#nsEnable');
            btn.disabled = true; btn.textContent = '⏳ …';
            const en = await API.post('/api/session/spawn-on', { id: d.session.id, mode });
            if (en.data && en.data.ok) {
              m.close();
              renderSessionQrModal(d.session.id, '🔳 Session „' + fmt.esc(name) + '“ verbinden');
              route();
            } else {
              box.className = 'msg error boxed'; box.textContent = (en.data && en.data.error) || 'Aktivierung fehlgeschlagen.'; btn.disabled = false; btn.textContent = '🔛 Aktivieren & starten';
            }
          };
          m.el.querySelector('#nsDiscard').onclick = async () => { await API.post('/api/session/delete', { id: d.session.id }); m.close(); route(); };
        }
      };
      m.el.querySelector('#nsQr').onclick = () => go('qr');
      m.el.querySelector('#nsPair').onclick = () => go('pair');
    },
    async sessionQr(id) {
      const r = await API.get('/api/sessions');
      const found = (r.data.sessions || []).find((x) => x.id === id);
      renderSessionQrModal(id, '🔳 Session „' + fmt.esc((found && found.name) || id) + '“ — QR');
    },
    async sessionQrGroup(id) {
      if (!(await confirmBox('QR in alle Gruppen senden?', '📤 Der aktive Bot postet den QR von „' + id + '“ als Bild in jede Gruppe, in der er ist.', '📤 Senden'))) return;
      const r = await API.post('/api/session/qr-to-group', { id });
      const d = r.data || {};
      if (d.ok) toast('📤 QR wird gesendet', d.error ? 'Noch kein QR da: ' + d.error : 'Der aktive Bot verteilt ihn an alle Gruppen.', 'ok');
      else toast('✕ Fehler', d.error || 'Fehler.', 'error');
    },
    async startAllSessions() {
      if (!(await confirmBox('ALLE Sessions starten?', '▶️ Jede registrierte Session (außer der verbundenen + Haupt-Bot) startet jetzt als eigener Bot. Tippe zur Bestätigung „ALLE STARTEN“.', '▶️ Starten'))) return;
      const m = modal('<h3>▶️ Alle Sessions starten</h3><p class="small dim">Multi-Session wird aktiviert und jede registrierte Session als eigener Bot im QR-Modus gestartet.</p><input id="startAllConfirm" placeholder="ALLE STARTEN"><div class="msg" id="startAllMsg"></div>', [
        { label: 'Abbrechen', cls: 'ghost' },
        { label: '▶️ Jetzt alle starten', cls: 'danger', onClick: async (bg, close) => {
            const t = (bg.querySelector('#startAllConfirm').value || '').trim();
            if (t !== 'ALLE STARTEN') { bg.querySelector('#startAllMsg').className = 'msg error'; bg.querySelector('#startAllMsg').textContent = 'Bestätigungstext stimmt nicht.'; return; }
            close();
            const r = await API.post('/api/sessions/start-all', { confirm: 'ALLE STARTEN' });
            const d = r.data || {};
            if (d.ok) { toast('▶️ Gestartet', d.started + ' Session(s) · ' + (d.skipped || 0) + ' liefen schon', 'ok'); route(); }
            else toast('✕ Fehler', d.error || 'Fehler.', 'error');
          } }
      ]);
    },
    async sessionDelete(id) {
      if (!(await confirmBox('Session endgültig löschen?', '🗑 ' + id + ' wird aus der Liste entfernt. Das WhatsApp-Konto selbst bleibt unberührt.', '🗑 Löschen'))) return;
      const r = await API.post('/api/session/delete', { id });
      const d = r.data || {};
      if (d.ok) { toast('🗑 gelöscht', id, 'ok'); route(); }
      else toast('✕ Fehler', d.error || 'Konnte Session nicht löschen.', 'error');
    },
    async toggleFeature(key, node) {
      const gid = window.__featGroup;
      if (!gid) return toast('✕ Keine Gruppe', 'Bitte zuerst eine Gruppe oben auswählen.', 'error');
      const f = window.LOVE_FEATURES.find((x) => x.key === key);
      const wasOn = node && node.getAttribute('data-on') === '1';
      const on = !wasOn;
      const groupName = (window.__featGroupLabel || gid);
      const m = modal(
        '<h3>🎛️ ' + (on ? 'Aktivieren' : 'Deaktivieren') + ': ' + fmt.esc(f.label) + '</h3>' +
        '<p class="small dim">Gruppe: <b>' + fmt.esc(groupName) + '</b></p>' +
        '<label class="fld">Grund (optional)</label><input id="tgReason" placeholder="z. B. Spam in der Gruppe" autocomplete="off">' +
        '<div class="msg" id="tgMsg"></div>' +
        '<p class="dim small">🔐 Zum Speichern ist dein Admin-Passwort nötig — die Gruppe bekommt die Änderung per WhatsApp mitgeteilt.</p>',
        [{ label: 'Abbrechen', cls: 'ghost' }]
      );
      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.textContent = (on ? '✅ Aktivieren' : '⛔ Deaktivieren') + ' & speichern';
      btn.onclick = async () => {
        btn.disabled = true;
        const reason = (m.el.querySelector('#tgReason').value || '').trim();
        /* Optimistisch, bei Fehler zurücksetzen */
        if (node) { node.setAttribute('data-on', on ? 1 : 0); node.className = 'stat ' + (on ? 'pink' : 'danger'); }
        const r = await postCritical('/api/groups/toggle', { gid, key, on, reason }, 'Das Ändern eines Gruppen-Features verlangt dein Admin-Passwort.');
        if (!r) { if (node) { node.setAttribute('data-on', wasOn ? 1 : 0); node.className = 'stat ' + (wasOn ? 'pink' : 'danger'); } btn.disabled = false; m.close(); return; }
        const ok = r.data && r.data.ok;
        if (node && !ok) { node.setAttribute('data-on', wasOn ? 1 : 0); node.className = 'stat ' + (wasOn ? 'pink' : 'danger'); }
        if (ok) {
          toast(f.emoji + ' ' + (key === 'active' ? 'Gruppe' : f.label), (on ? 'an — ☾ enabled' : 'aus — 💔 disabled') + (reason ? ' · Grund: ' + reason : ''), 'ok');
          m.close(); route();
        } else {
          btn.disabled = false;
          const box = m.el.querySelector('#tgMsg');
          if (box) { box.className = 'msg error'; box.textContent = (r.data && r.data.error) || 'Ungültig.'; }
          else toast('✕ Fehler', (r.data && r.data.error) || 'Ungültig.', 'error');
        }
      };
      m.el.querySelector('.actions').appendChild(btn);
    },
    async exportXlsx() {
      /* gewählte Bereiche aus der Owner-Zentrale sammeln */
      const checked = Array.from(document.querySelectorAll('[data-sec]:checked')).map((c) => c.getAttribute('data-sec'));
      const sections = checked.length ? checked : SECTIONS_XLSX.map((x) => x[0]);
      for (let attempt = 0; attempt < 3; attempt++) {
        const pw = await reauthModal('export.xlsx', 'Der Excel-Export enthält alle Verwaltungsdaten: Nutzer & Profile, Accounts & Rechte, Konten-Historie, Web-Sessions, Gruppen, Logs & Rollen-Matrix.');
        if (!pw) return;
        try {
          const token = API.getToken();
          const res = await fetch('/api/export/xlsx', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
            body: JSON.stringify({ sections, reauth: pw })
          });
          if (res.status === 401) {
            const j = await res.json().catch(() => ({}));
            if (j && j.needsReauth) { toast('✕ Passwort falsch', 'Bitte versuche es erneut.', 'error'); continue; }
            toast('✕ Nicht eingeloggt', 'Deine Session ist abgelaufen.', 'error');
            return;
          }
          if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            toast('✕ Export fehlgeschlagen', (j && j.error) || 'Serverfehler.', 'error');
            return;
          }
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'LoveBot-Export-' + new Date().toISOString().slice(0, 10) + '.xlsx';
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 4000);
          toast('⬇ Export fertig', 'Die Excel-Datei wird heruntergeladen.', 'ok');
          return;
        } catch (netErr) {
          toast('✕ Netzwerkfehler', 'Server nicht erreichbar?', 'error');
          return;
        }
      }
    },
    async downloadBrand(btn) {
      const file = (typeof btn === 'string') ? btn : (btn && btn.dataset && btn.dataset.name);
      if (!file) return toast('⚠️ Fehler', 'Keine Datei ausgewählt.', 'warn');
      const ap = await UI.adminPwModal('Fertige Brand-Datei herunterladen.', file);
      if (!ap) return;
      toast('🔐 Prüfe Admin-Passwort…', '', 'info');
      await downloadPost('/api/downloads/brand', { file, password: ap.password }, file);
    },
    async downloadsLiveXlsx() {
      const ap = await UI.adminPwModal('Alle Verwaltungsdaten frisch als .xlsx herunterladen (Übersicht + 12 Blätter inkl. IP-Übersicht & Nutzer-Details).');
      if (!ap) return;
      toast('🔐 Prüfe Admin-Passwort…', 'Deine Daten werden gerade als .xlsx erzeugt.', 'info');
      const fname = 'LoveBot-Export-' + new Date().toISOString().slice(0, 10) + '.xlsx';
      await downloadPost('/api/export/xlsx', { password: ap.password }, fname);
    },
    async reloadHistory() {
      route();
    },
    async downloadAllZip() {
      const ap = await UI.adminPwModal('Alles auf einmal: komplettes Brand-Kit + frischer Live-Export als eine ZIP-Datei.');
      if (!ap) return;
      toast('🔐 Prüfe Admin-Passwort…', 'Brand-Kit + Live-Export werden als ZIP gepackt.', 'info');
      const fname = 'LoveBot-All-in-One-' + new Date().toISOString().slice(0, 10) + '.zip';
      await downloadPost('/api/downloads/zip', { password: ap.password }, fname);
    },
    async broadcast() {
      const text = UI.$('#bcText').value.trim();
      if (!text) return toast('⚠ leer', 'Keine Nachricht eingegeben.', 'warn');
      const response = await API.post('/api/broadcast', { text });
      if (!response.data?.ok) return toast('📢 broadcast fehlgeschlagen', response.data?.error || 'Serverfehler.', 'warn');
      toast('📢 broadcast queued', '☾ Love.js sendet an alle Gruppen…', 'ok');
    },
    async dbAct(a) { toast('🗄️ db:' + a, a === 'backup' ? '☾ backup complete. just in case we need to remember.' : 'ok', 'ok'); },
    async ban() {
      const target = UI.$('#banTarget').value.trim();
      const reason = UI.$('#banReason').value.trim();
      if (!target) return toast('🚫 Ban', 'JID, LID oder Nummer fehlt.', 'warn');
      const r = await API.post('/api/bans/ban', { jid: target, reason });
      if (!r.data?.ok) return toast('🚫 Ban fehlgeschlagen', r.data?.error || 'Serverfehler.', 'warn');
      toast('🚫 Ban queued', 'Love.js meldet den Ban in allen Gruppen.', 'ok');
      route();
    },
    async unban(key) { if (await confirmBox('Unban?', key + ' wird entbannt.')) { const r = await API.post('/api/bans/unban', { key }); if (!r.data?.ok) return toast('♡ Unban fehlgeschlagen', r.data?.error || 'Serverfehler.', 'warn'); toast('♡ unban queued', 'Love.js meldet den Unban in allen Gruppen.', 'ok'); route(); } },
    async badwordAdd() { const w = UI.$('#bwNew').value.trim(); if (w) { await API.post('/api/badwords/add', { word: w }); toast('🤬 added', w); route(); } },
    async badwordToggle(w) { await API.post('/api/badwords/toggle', { word: w }); route(); },
    async sysAct(a) {
      if (a === 'shutdown' && !(await confirmBox('Shutdown?', '☾ good night. I\'ll be here when you come back.', '× Shutdown'))) return;
      await API.post('/api/system/' + a, {});
      toast('🖧 system ' + a, a === 'shutdown' ? '♡ good night.' : 'ok');
    },
    async changePw() {
      const o = UI.$('#pwOld').value, n = UI.$('#pwNew').value, n2 = UI.$('#pwNew2').value;
      const box = UI.$('#pwMsg');
      if (n !== n2) { box.textContent = 'Passwörter stimmen nicht überein.'; box.className = 'msg error'; return; }
      const r = await API.post('/api/account/password', { old: o, new: n });
      box.textContent = r.data.ok ? '✓ geändert. ☾ secret safe.' : (r.data.error || 'Fehler');
      box.className = 'msg ' + (r.data.ok ? 'ok' : 'error');
      if (r.data.ok) setTimeout(route, 900);
    },
    async revoke(hint) { toast('⏻ session widerrufen', hint, 'ok'); await API.post('/api/account/revoke', {}); route(); },
    async revokeAll() { if (await confirmBox('Alle anderen Sessions widerrufen?', '☾ nur diese Session bleibt wach.')) { await API.post('/api/account/revoke', { all: true }); toast('⏻ done', 'alle anderen Sessions beendet', 'ok'); route(); } },
    async setRole(id) {
      const sel = UI.$('#role_' + id);
      const r = await API.post('/api/accounts/role', { id, role: sel.value });
      toast(r.data.ok ? '👤 Rolle geändert' : '⛔ denied', r.data.ok ? (r.data.old + ' → ' + r.data.role) : (r.data.error || ''), r.data.ok ? 'ok' : 'err');
      route();
    },
    async setStatus(id, status) {
      if (status === 'locked' && !(await confirmBox('Account sperren?', 'Aktive Dashboard-Sessions werden sofort widerrufen.'))) return;
      await API.post('/api/accounts/status', { id, status });
      toast(status === 'locked' ? '⛔ locked' : '✓ active', 'sessions revoked · audit logged', 'ok');
      route();
    },
    async openAkte(id, el) { await renderAkte(id, el); },
    async newAccount() {
      const m = UI.modal('<h3>+ Dashboard-Account</h3><label class="fld">Username</label><input id="naUser" placeholder="support_max">' +
        '<label class="fld">WhatsApp-Nummer</label><input id="naNumber" placeholder="49151…">' +
        '<label class="fld">Rolle</label><select id="naRole"><option>user</option><option>supporter</option><option>groupadmin</option><option>admin</option><option>deputy</option></select>' +
        '<div class="msg" id="naMsg"></div>', [{ label: 'Schließen', cls: 'ghost' }]);
      const btn = document.createElement('button');
      btn.className = 'btn'; btn.textContent = '♡ Erstellen';
      btn.onclick = async () => {
        const r = await API.post('/api/accounts/create', {
          username: m.el.querySelector('#naUser').value,
          number: m.el.querySelector('#naNumber').value,
          role: m.el.querySelector('#naRole').value
        });
        const box = m.el.querySelector('#naMsg');
        if (r.data.ok) {
          box.className = 'msg ok boxed';
          box.innerHTML = 'Account <b>' + fmt.esc(r.data.account.username) + '</b> erstellt.<br>⚠️ Temp-Passwort (nur einmal sichtbar):<br><span class="mono neon-cyan" style="font-size:16px;letter-spacing:2px">' + fmt.esc(r.data.tempPassword) + '</span><br><span class="dim small">sofort kopieren — wird nirgends gespeichert.</span>';
        } else { box.className = 'msg error boxed'; box.textContent = r.data.error || 'Fehler'; }
      };
      m.el.querySelector('.actions').prepend(btn);
    },
    setMood(id) { NightFX.setMood(id); const m = NightFX.MOODS.find((x) => x.id === id); UI.$('#moodChip').textContent = m.icon + ' ' + m.label; route(); },
    setRain(on) { NightFX.setRain(on); route(); },
    setNight(on) { NightFX.setNight(on); route(); },
    async saveSettings() { toast('💾 gespeichert', '☾ settings secured.', 'ok'); }
  };

  /* ================================================================== */
  /*  Router                                                            */
  /* ================================================================== */
  /* 👑 Dieses gesamte Control-Panel ist nur für den Owner. */
  function isOwner() {
    return window.__loveRole === 'owner' || (window.__lovePerms || []).includes('*');
  }
  async function route() {
    stopRefresh();
    const hash = (location.hash || '#/dashboard').slice(2);
    const view = V[hash] || V.dashboard;
    UI.setActiveNav(V[hash] ? hash : 'dashboard');
    const el = UI.$('#view');
    el.innerHTML = '<p class="dim" style="padding:30px">☾ loading…</p>';
    if (!isOwner()) {
      el.innerHTML = '<div class="panel fade-in" style="max-width:480px;margin:40px auto"><div class="body" style="text-align:center;padding:34px 22px">' +
        '<div style="font-size:42px;margin-bottom:10px">👑</div>' +
        '<h2 style="margin:0 0 8px">Nur für den Owner</h2>' +
        '<p class="dim small" style="max-width:360px;margin:0 auto;line-height:1.55">Dieses LoveBot-Control-Panel ist ausschließlich dem Owner vorbehalten.<br>Melde dich bitte mit dem Owner-Account an.</p>' +
        '<div class="row" style="justify-content:center;margin-top:16px"><button class="btn" onclick="location.href=\'/login.html\'">⏻ Zum Login</button></div>' +
        '</div></div>';
      return;
    }
    try { await view(el); } catch (e) {
      el.innerHTML = '<div class="panel"><div class="body"><span class="neon-pink">✕ something went wrong.</span><br><span class="dim small mono">' + fmt.esc(e.message) + '</span></div></div>';
    }
  }

  /* ---------- Boot ---------- */
  (async function boot() {
    if (!API.getToken()) { location.href = '/login.html'; return; }
    await API.probe();
    const meFirst = await API.get('/api/me');
    const perms = (meFirst.data || {}).perms || ['*'];
    window.__lovePerms = perms;
    window.__loveRole = (meFirst.data || {}).role || 'user';
    UI.chrome({ demoPill: API.isDemo(), perms, role: window.__loveRole || 'user' });
    if ((meFirst.data || {}).mustChange) {
      UI.modal('<h3>🔑 FIRST LOGIN</h3><p class="small dim">Dein Temp-Passwort muss geändert werden, bevor es weitergeht.</p>' +
        '<label class="fld">Neues Passwort (mind. 8)</label><input type="password" id="fcNew">' +
        '<label class="fld">Bestätigen</label><input type="password" id="fcNew2"><div class="msg" id="fcMsg"></div>',
        [{ label: '💾 Speichern & weiter', onClick: async (bg, close) => {
          const n = bg.querySelector('#fcNew').value, n2 = bg.querySelector('#fcNew2').value;
          if (n.length < 8 || n !== n2) { bg.querySelector('#fcMsg').textContent = 'mind. 8 Zeichen, identisch.'; bg.querySelector('#fcMsg').className = 'msg error'; return; }
          const r = await API.post('/api/account/password', { old: '', new: n }).catch(() => null);
          /* Erstlogin: old wird serverseitig gegen Temp-Hash geprüft — Login-Session zählt als vertrauenswürdig */
          if (r && r.data && r.data.ok === false && r.data.error) { bg.querySelector('#fcMsg').textContent = r.data.error; bg.querySelector('#fcMsg').className = 'msg error'; return; }
          close(); toast('♡ Passwort gesetzt', '☾ welcome upstairs.', 'ok');
        } }]);
    }
    if (window.NightFX) NightFX.init();
    const me = await API.get('/api/me');
    UI.$('#meName').textContent = (me.data || {}).name || 'Seele';
    UI.$('#meRole').textContent = ((me.data || {}).role || 'user').toUpperCase();
    window.addEventListener('hashchange', route);
    route();
    /* Heartbeat-Chip */
    setInterval(async () => {
      const r = await API.get('/api/heartbeat');
      const chip = UI.$('#hbChip'), txt = UI.$('#hbText');
      if (!chip) return;
      const on = !!(r.data || {}).online;
      chip.className = 'chip ' + (on ? 'on' : 'off');
      txt.textContent = on ? 'Bot online · ' + fmt.dur((r.data || {}).uptimeSec || 0) : 'Bot offline';
    }, 8000);
  })();

  /* Inline-`onclick="route()"`-Aufrufe im gerenderten HTML brauchen `route`
     als globalen Namen (wie APP). */
  window.route = route;
})();

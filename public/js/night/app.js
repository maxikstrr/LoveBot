/* ============================================================================
   LoveBot — MIDNIGHT CONTROL (SPA)
   ☾ alle Seiten, ein Shell. Routing über Hash.
   ==========================================================================*/
(function () {
  'use strict';
  const { $, $$, fmt, toast, modal, confirmBox, stat, pill, table, panel } = UI;
  let refreshTimer = null;

  function stopRefresh() { if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; } }
  function every(ms, fn) { stopRefresh(); refreshTimer = setInterval(fn, ms); }

  /* ================================================================== */
  /*  VIEWS                                                             */
  /* ================================================================== */
  const V = {};

  /* ---------- Dashboard ---------- */
  V.dashboard = async (el) => {
    const [st, hb] = await Promise.all([API.get('/api/stats'), API.get('/api/heartbeat')]);
    const s = st.data || {};
    el.innerHTML =
      '<div class="grid c4 mb">' +
        stat('Sessions', fmt.num(s.sessionsTotal || 0), (s.sessionsOnline || 0) + ' online', 'pink') +
        stat('User', fmt.num(s.users || 0), 'registrierte Seelen', 'violet') +
        stat('Nachrichten', fmt.num(s.messages || 0), 'tonight & forever', 'cyan') +
        stat('Commands', fmt.num(s.commands || 0), 'ausgeführt', 'violet') +
      '</div>' +
      '<div class="grid c4 mb">' +
        stat('Uptime', fmt.dur(s.uptimeSec || 0), 'awake for a while', 'ok') +
        stat('RAM', fmt.mb(s.ramMb || 0), 'Love.js Prozess', 'cyan') +
        stat('Errors', fmt.num(s.errors || 0), (s.warnings || 0) + ' Warnings', (s.errors || 0) ? 'danger' : 'ok') +
        stat('Threat Level', 'LOW', 'security center ruhig', 'ok') +
      '</div>' +
      '<div class="grid c2">' +
        panel('☾ Live Feed', '<div class="term" style="border:none"><div class="screen" id="dashFeed" style="max-height:300px;min-height:200px"></div></div>') +
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
      box.innerHTML = (r.data.sessions || []).map((x) =>
        '<div class="row" style="margin:7px 0"><span class="mono" style="width:86px;color:#fff">' + fmt.esc(x.name) + '</span>' +
        pill(x.status) + '<span class="dim small grow">' + fmt.esc(x.status === 'ONLINE' ? 'awake for ' + fmt.dur(x.uptime / 1000) : (x.last || '')) + '</span></div>').join('');
    };
    await feed(); await sess();
    every(4000, feed);
  };

  /* ---------- Live Monitor ---------- */
  V.monitor = async (el) => {
    el.innerHTML =
      '<div class="panel fade-in"><div class="head"><h2>📡 Live Monitor</h2><div class="right"><span class="pill on"><span class="d"></span>LIVE</span></div></div>' +
      '<div class="body"><div class="grid c4 mb" id="monStats"></div>' +
      '<div class="term"><div class="bar"><span class="dots"><i></i><i></i><i></i></span><span class="title">lovebot — monitor watch</span></div>' +
      '<div class="screen" id="monScreen" style="max-height:420px"></div></div></div></div>';
    const tick = async () => {
      const [s, sys] = await Promise.all([API.get('/api/stats'), API.get('/api/system')]);
      const d = s.data || {}, y = sys.data || {};
      const box = $('#monStats');
      if (box) box.innerHTML =
        stat('CPU', (y.cpu || 0).toFixed(1) + '%', 'load average', 'cyan') +
        stat('RAM', fmt.mb(y.ramMb || d.ramMb || 0), 'von ' + fmt.mb(y.ramTotalMb || 8192), 'pink') +
        stat('Disk', (y.diskPct || 0) + '%', 'belegt', 'violet') +
        stat('Heap', fmt.mb(y.heapMb || 0), 'node ' + (y.node || ''), 'ok');
      const sc = $('#monScreen');
      if (sc) {
        const now = new Date().toLocaleTimeString('de-DE');
        const row = '<div class="ln"><span class="t">' + now + '</span>  <span class="tag session">[monitor]</span> <span class="msg-txt">sessions ' +
          (d.sessionsOnline || 0) + '/' + (d.sessionsTotal || 0) + ' · msg ' + fmt.num(d.messages || 0) + ' · cmd ' + fmt.num(d.commands || 0) +
          ' · cpu ' + (y.cpu || 0).toFixed(1) + '% · ram ' + fmt.mb(y.ramMb || 0) + ' · db ' + (d.dbHealthy ? '✅ healthy' : '⚠ check') + '</span></div>';
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
    const rows = (r.data.sessions || []).map((x) => [
      '<span class="n">' + fmt.esc(x.name) + '</span>',
      pill(x.status),
      '<span class="mono small">' + fmt.esc(x.phone || '—') + '</span>',
      '<span class="num">' + (x.uptime ? fmt.dur(x.uptime / 1000) : '—') + '</span>',
      '<span class="num">' + fmt.num(x.messages) + '</span>',
      '<span class="num">' + fmt.num(x.groups) + '</span>',
      '<div class="bar-track" style="width:70px"><div class="bar-fill cyan" style="width:' + (x.health || 0) + '%"></div></div>',
      '<div class="row"><button class="btn ghost sm" onclick="APP.sessionAct(\'restart\',\'' + fmt.esc(x.name) + '\')">↻</button>' +
      '<button class="btn ghost sm" onclick="APP.sessionAct(\'qr\',\'' + fmt.esc(x.name) + '\')">▣</button>' +
      '<button class="btn danger sm" onclick="APP.sessionAct(\'kill\',\'' + fmt.esc(x.name) + '\')">⏹</button></div>'
    ]);
    el.innerHTML =
      '<div class="grid c4 mb">' +
        stat('Total', fmt.num((r.data.sessions || []).length), 'sessions remembered', 'pink') +
        stat('Online', fmt.num((r.data.sessions || []).filter((s) => s.status === 'ONLINE').length), 'connections alive', 'ok') +
        stat('Offline', fmt.num((r.data.sessions || []).filter((s) => s.status === 'OFFLINE').length), 'last seen…', 'danger') +
        stat('Waiting', fmt.num((r.data.sessions || []).filter((s) => /WAIT|PAIR|CONNECT/.test(s.status)).length), 'waiting for authentication', 'warn') +
      '</div>' +
      panel('☾ Sessions', table(['Name', 'Status', 'Phone', 'Uptime', 'Messages', 'Groups', 'Health', 'Aktionen'], rows) ,
        '<button class="btn sm" onclick="APP.newSession()">+ New Session</button>');
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
      '<span class="mono small dim">' + fmt.esc(g.jid) + '</span>',
      '<span class="num">' + g.members + '</span>',
      '<span class="num">' + g.admins + '</span>',
      '<span class="num">' + g.features + '/14</span>',
      (g.antilink ? pill('ON', 'antilink') : pill('OFF', 'antilink')) + ' ' + (g.welcome ? pill('ON', 'welcome') : pill('OFF', 'welcome')),
      '<span class="num">' + fmt.num(g.msgs) + '</span>'
    ]);
    el.innerHTML = panel('👥 Gruppen', table(['Gruppe', 'JID', 'Mitglieder', 'Admins', 'Features', 'Schutz', 'Messages'], rows));
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
    const feats = window.LOVE_FEATURES;
    const cards = feats.map((f) =>
      '<div class="stat ' + (f.on ? 'pink' : 'danger') + '" style="cursor:pointer" onclick="APP.toggleFeature(\'' + f.key + '\', this)">' +
      '<div class="lbl">' + f.emoji + ' ' + fmt.esc(f.key) + (f.neu ? ' · NEU' : '') + '</div>' +
      '<div class="val" style="font-size:17px;color:#fff;text-shadow:none">' + fmt.esc(f.label) + '</div>' +
      '<div class="sub">' + fmt.esc(f.desc) + '</div>' +
      '<div class="mt-s">' + (f.on ? pill('ON', 'aktiv') : pill('OFF', 'aus')) + '</div></div>').join('');
    el.innerHTML =
      '<p class="dim small mb">Gruppen-Features: mit <span class="mono neon-pink">$an &lt;feature&gt;</span> / <span class="mono neon-pink">$aus &lt;feature&gt;</span> in der Gruppe schalten — oder hier klicken. <span class="mono neon-cyan">$gi</span> zeigt die Übersicht.</p>' +
      '<div class="grid c3">' + cards + '</div>';
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
    const r = await API.get('/api/security');
    const d = r.data || {};
    const sevPill = (s) => ({ WATCH: pill('WATCH'), SUSPICIOUS: pill('SUSPICIOUS'), HIGH: pill('HIGH'), CRITICAL: pill('CRITICAL'), RESOLVED: pill('RESOLVED') }[s] || pill('INFO', s));
    const rows = (d.events || []).map((e) => [
      '<span class="mono t">' + fmt.esc(e.time) + '</span>', sevPill(e.sev),
      '<span class="n small">' + fmt.esc(e.event) + '</span>',
      '<span class="dim small">' + fmt.esc(e.src) + '</span>',
      '<span class="mono num" style="color:' + (e.risk >= 70 ? 'var(--danger)' : e.risk >= 40 ? 'var(--warn)' : 'var(--muted)') + '">' + e.risk + '/100</span>',
      '<span class="dim small mono">' + fmt.esc(e.action) + '</span>'
    ]);
    el.innerHTML =
      '<div class="grid c4 mb">' +
        stat('Threat Level', '🟢 ' + (d.threat || 'LOW'), 'nothing dangerous yet', 'ok') +
        stat('Alerts', fmt.num(d.alerts || 0), 'active', 'warn') +
        stat('Failed Logins', fmt.num(d.failedLogins || 0), 'heute', 'danger') +
        stat('Blocked', fmt.num(d.blocked || 0), 'requests', 'violet') +
      '</div>' +
      panel('🛡️ Security Events', table(['Zeit', 'Severity', 'Event', 'Source', 'Risk', 'Action'], rows) ,
        '<span class="dim small" style="font-style:italic">☾ LoveBot is watching.</span>') +
      '<div class="grid c2 mt">' +
        panel('🔐 Schutzschichten', '<div class="kv">' +
          [['HTTPS / Reverse Proxy', 1], ['Rate Limit', 1], ['2FA Owner-Login', 1], ['Passwort-Hashing (scrypt)', 1], ['Audit-Log (hash-chained)', 1], ['Risk-Scoring', 1], ['Session-Schutz', 1], ['IP-Monitoring', 0]]
            .map(([k, on]) => '<span class="k">' + k + '</span><span class="v">' + (on ? '<span class="neon-cyan">🟢 aktiv</span>' : '<span class="dim">🟡 geplant</span>') + '</span>').join('') + '</div>') +
        panel('🚨 Alert-Regeln', '<div class="kv">' +
          [['failed_login ≥ 5 / 5 min', 'HIGH'], ['api_requests ≥ 100 / min', 'WATCH'], ['403 ≥ 20 / min', 'SUSPICIOUS'], ['reconnect loop ≥ 10 / 5 min', 'HIGH']]
            .map(([k, v]) => '<span class="k mono small">' + k + '</span><span class="v">' + pill(v) + '</span>').join('') + '</div>') +
      '</div>';
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

  /* ---------- Accounts (Team) ---------- */
  V.accounts = async (el) => {
    const r = await API.get('/api/accounts');
    const rows = (r.data.accounts || []).map((x) => [
      '<span class="n">' + fmt.esc(x.username) + '</span>',
      '<span class="mono small dim">' + fmt.esc(x.number) + '</span>',
      pill(x.role.toUpperCase()),
      x.scope?.type === 'group' ? '<span class="pill vio">GROUP-SCOPE</span>' : '<span class="dim small">global</span>',
      x.status === 'active' ? pill('ACTIVE') : pill('OFF', x.status),
      x.mustChange ? pill('WAIT', 'PW wechseln') : '<span class="dim small">—</span>',
      '<span class="dim small">' + (x.lastLoginAt ? new Date(x.lastLoginAt).toLocaleString('de-DE') : 'nie') + '</span>',
      '<div class="row">' +
        '<select id="role_' + x.id + '" style="width:auto;padding:3px 6px;font-size:11px">' +
        ['user', 'supporter', 'groupadmin', 'admin', 'deputy', 'owner'].map((rl) => '<option ' + (rl === x.role ? 'selected' : '') + '>' + rl + '</option>').join('') +
        '</select>' +
        '<button class="btn ghost sm" onclick="APP.setRole(\'' + x.id + '\')">setzen</button>' +
        '<button class="btn ' + (x.status === 'active' ? 'danger' : 'ghost') + ' sm" onclick="APP.setStatus(\'' + x.id + '\',\'' + (x.status === 'active' ? 'locked' : 'active') + '\')">' + (x.status === 'active' ? '⛔' : '✓') + '</button>' +
      '</div>'
    ]);
    el.innerHTML = panel('👥 Dashboard-Accounts', table(['Username', 'Nummer', 'Rolle', 'Scope', 'Status', 'PW', 'Letzter Login', 'Aktionen'], rows),
      '<button class="btn sm" onclick="APP.newAccount()">+ Account</button>');
  };

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

  /* ================================================================== */
  /*  Aktionen (global, von onclick genutzt)                            */
  /* ================================================================== */
  window.APP = {
    async sessionAct(act, name) {
      if (act === 'kill' && !(await confirmBox('Session stoppen?', '💔 ' + name + ' disconnected. „some connections are temporary.“', '⏹ Stoppen'))) return;
      const r = await API.post('/api/session/' + act, { name });
      toast('☾ session ' + act, name + ' · ' + (r.data.ok ? 'ok' : (r.data.error || 'queued')));
      route();
    },
    async newSession() {
      const m = UI.modal('<h3>+ New Session</h3><label class="fld">Name</label><input id="nsName" placeholder="NightSoul">' +
        '<label class="fld">Login-Methode</label><div class="row"><button class="btn sm cyan" id="nsQr">▣ QR-Code</button><button class="btn sm" id="nsPair">🔢 Pairing-Code</button></div>' +
        '<div class="msg" id="nsMsg"></div>', [{ label: 'Schließen', cls: 'ghost' }]);
      const go = async (mode) => {
        const name = m.el.querySelector('#nsName').value.trim() || 'NightSoul';
        const r = await API.post('/api/session/create', { name, mode });
        m.el.querySelector('#nsMsg').className = 'msg ok boxed';
        m.el.querySelector('#nsMsg').innerHTML = '☾ session <b>' + fmt.esc(name) + '</b> erstellt · ' + mode + ' bereit.<br><span class="dim small">scan the code before the night ends.</span>';
        toast('♡ session created', name + ' · ' + mode);
      };
      m.el.querySelector('#nsQr').onclick = () => go('qr');
      m.el.querySelector('#nsPair').onclick = () => go('pair');
    },
    async toggleFeature(key, node) {
      const f = window.LOVE_FEATURES.find((x) => x.key === key);
      f.on = !f.on;
      await API.post('/api/groups/toggle', { feature: key, on: f.on });
      toast(f.emoji + ' ' + key, f.on ? 'aktiv — ☾ enabled' : 'aus — 💔 disabled');
      route();
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
  async function route() {
    stopRefresh();
    const hash = (location.hash || '#/dashboard').slice(2);
    const view = V[hash] || V.dashboard;
    UI.setActiveNav(V[hash] ? hash : 'dashboard');
    const el = UI.$('#view');
    el.innerHTML = '<p class="dim" style="padding:30px">☾ loading…</p>';
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
    UI.chrome({ demoPill: API.isDemo(), perms });
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
})();

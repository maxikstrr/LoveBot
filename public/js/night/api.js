/* ============================================================================
   LoveBot — API-Layer
   Spricht mit server.js. Wenn der Server nicht erreichbar ist (z. B. in der
   Vorschau), schaltet alles automatisch in den DEMO-MODUS mit realistischen
   Beispieldaten — die Seite bleibt vollständig benutzbar.
   ==========================================================================*/
(function () {
  'use strict';

  const TOKEN_KEY = 'love_token';
  let demoMode = false;
  let demoChecked = false;

  /* ---------- Demo-Datenbank ------------------------------------------------ */
  const D = {
    bootTime: Date.now() - (4 * 8600e3 + 12 * 60e3 + 18e3),
    msgCount: 38921,
    cmdCount: 12442,
    sessions: [
      { name: 'MainBot',  status: 'ONLINE',     phone: '+49 ••• ••• 4714', jid: '49••••@s.whatsapp.net', uptime: 4 * 8600e3 + 12 * 60e3, messages: 12421, commands: 1293, groups: 31, memMb: 184, health: 99, last: 'vor 12 Sek.' },
      { name: 'Support',  status: 'ONLINE',     phone: '+49 ••• ••• 8821', jid: '49••••@s.whatsapp.net', uptime: 2 * 8600e3 + 19 * 60e3, messages: 8923,  commands: 640,  groups: 18, memMb: 141, health: 98, last: 'vor 41 Sek.' },
      { name: 'Music',    status: 'ONLINE',     phone: '+49 ••• ••• 3390', jid: '49••••@s.whatsapp.net', uptime: 5 * 8600e3 + 2 * 60e3,  messages: 5110,  commands: 2201, groups: 9,  memMb: 203, health: 96, last: 'vor 3 Min.' },
      { name: 'Family',   status: 'ONLINE',     phone: '+49 ••• ••• 7702', jid: '49••••@s.whatsapp.net', uptime: 26 * 60e3,               messages: 311,   commands: 44,   groups: 3,  memMb: 98,  health: 100, last: 'vor 8 Sek.' },
      { name: 'Backup',   status: 'OFFLINE',    phone: '—',                jid: '—',                     uptime: 0,                       messages: 0,     commands: 0,    groups: 0,  memMb: 0,   health: 0,  last: 'vor 3 Std.' },
      { name: 'NightSoul',status: 'QR_WAITING', phone: '—',                jid: '—',                     uptime: 0,                       messages: 0,     commands: 0,    groups: 0,  memMb: 12,  health: 40, last: 'wartet auf QR…' }
    ],
    users: [
      { name: 'Maxichen 👑',  phone: '49••••••4714', level: 42, xp: 184220, prestige: 3, streak: 21, role: 'owner',   msgs: 9821, warns: 0, banned: false, title: 'Love Legend' },
      { name: 'Luna',         phone: '49••••••8821', level: 27, xp: 74210,  prestige: 1, streak: 9,  role: 'admin',   msgs: 4102, warns: 0, banned: false, title: 'Soulmate' },
      { name: 'Kai',          phone: '49••••••3390', level: 19, xp: 38110,  prestige: 0, streak: 4,  role: 'user',    msgs: 2210, warns: 1, banned: false, title: 'Romantic' },
      { name: 'Mira',         phone: '49••••••7702', level: 15, xp: 24980,  prestige: 0, streak: 12, role: 'user',    msgs: 1877, warns: 0, banned: false, title: 'Admirer' },
      { name: 'Jonas',        phone: '49••••••1206', level: 8,  xp: 6120,   prestige: 0, streak: 0,  role: 'user',    msgs: 402,  warns: 3, banned: true,  title: 'Newbie' },
      { name: 'Elif',         phone: '49••••••9931', level: 11, xp: 12044,  prestige: 0, streak: 6,  role: 'mod',     msgs: 980,  warns: 0, banned: false, title: 'Admirer' }
    ],
    groups: [
      { subject: 'Midnight Chat 💜',   jid: '120363•••@g.us', members: 48, admins: 4, features: 11, msgs: 12044, antilink: true,  welcome: true },
      { subject: 'LoveBot Lounge',     jid: '120363•••@g.us', members: 132, admins: 6, features: 9, msgs: 9811,  antilink: false, welcome: true },
      { subject: 'Familie ',          jid: '120363•••@g.us', members: 12, admins: 2, features: 7, msgs: 3220,  antilink: false, welcome: false },
      { subject: 'Gaming Night ☾',     jid: '120363•••@g.us', members: 61, admins: 3, features: 10, msgs: 7410, antilink: true,  welcome: true }
    ],
    loveLevels: [
      { lv: 1,   title: 'Newbie',      icon: '❤️' },
      { lv: 5,   title: 'Admirer',     icon: '💕' },
      { lv: 10,  title: 'Romantic',    icon: '💗' },
      { lv: 20,  title: 'Lover',       icon: '💞' },
      { lv: 30,  title: 'Soulmate',    icon: '💘' },
      { lv: 50,  title: 'Eternal Love',icon: '💎' },
      { lv: 100, title: 'Love Legend', icon: '👑' }
    ],
    achievements: [
      { id: 'firstlove', icon: '💌', name: 'First Love',     desc: 'Erste Liebesnachricht gesendet' },
      { id: 'crush',     icon: '💘', name: 'First Crush',    desc: 'Ersten Crush geconfesst' },
      { id: 'msg100',    icon: '💗', name: '100 Messages',   desc: '100 Nachrichten geschrieben' },
      { id: 'streak7',   icon: '❤️', name: '7 Day Streak',   desc: '7 Tage am Stück aktiv' },
      { id: 'soulmate',  icon: '💍', name: 'Soulmate',       desc: 'Love Level 30 erreicht' },
      { id: 'romantic',  icon: '🌹', name: 'Romantic',       desc: '10 romantische Commands genutzt' },
      { id: 'legend',    icon: '👑', name: 'Love Legend',    desc: 'Love Level 100 erreicht' }
    ],
    security: [
      { time: '23:55:09', sev: 'WATCH',      event: 'Repeated failed login',     src: 'web', risk: 20, action: 'monitoring' },
      { time: '23:56:42', sev: 'SUSPICIOUS', event: 'API rate exceeded',         src: 'web', risk: 55, action: 'rate_limit' },
      { time: '23:57:10', sev: 'RESOLVED',   event: 'Rate returned to normal',   src: 'web', risk: 0,  action: '—' },
      { time: '00:14:22', sev: 'HIGH',       event: 'AUTH_FAILURE ×7',           src: 'web', risk: 72, action: 'temp_rate_limit' },
      { time: '00:28:11', sev: 'CRITICAL',   event: 'Suspicious request pattern',src: 'web', risk: 86, action: 'block + owner alert' }
    ],
    audit: [
      { time: '23:41:02', actor: 'owner', action: 'session.restart', target: 'MainBot',  result: 'success' },
      { time: '23:44:19', actor: 'owner', action: 'config.change',   target: 'prefix',   result: 'success' },
      { time: '23:52:11', actor: 'web',   action: 'login.failed',    target: 'unknown',  result: 'denied' },
      { time: '00:02:44', actor: 'owner', action: 'backup.create',   target: 'database', result: 'success' },
      { time: '00:19:30', actor: 'luna',  action: 'badwords.add',    target: '***',      result: 'success' }
    ]
  };

  /* ---------- Demo-Log-Zeilen ------------------------------------------------ */
  const DEMO_TAGS = ['boot', 'session', 'message', 'command', 'features', 'dashboard', 'love'];
  const DEMO_LINES = [
    ['session',  'MainBot heartbeat stabil (99 %)'],
    ['message',  'Nachricht empfangen — Midnight Chat 💜'],
    ['command',  '$love ausgeführt von Luna'],
    ['love',     '♡ response generated. message delivered.'],
    ['session',  'Support: 2 neue Nachrichten'],
    ['features', 'antilink in „Gaming Night ☾" aktiv'],
    ['dashboard', 'Heartbeat an server.js gesendet'],
    ['message',  '☾ nobody said good night'],
    ['command',  '$ship ausgeführt von Kai'],
    ['session',  'NightSoul wartet auf QR-Scan…'],
    ['love',     '💍 Maxichen 👑 & Luna sind jetzt verheiratet'],
    ['boot',     'Database: 1.284 souls loaded']
  ];

  function demoLogLine(i) {
    const [tag, text] = DEMO_LINES[i % DEMO_LINES.length];
    const d = new Date(Date.now() - (DEMO_LINES.length - (i % DEMO_LINES.length)) * 47000);
    return {
      time: d.toLocaleTimeString('de-DE'),
      tag, text
    };
  }

  /* ---------- Demo-Router ----------------------------------------------------- */
  const demoStore = {
    codes: {},          /* number -> code */
    loginTokens: {},    /* number -> true (2FA bestanden) */
    tokens: {},         /* session token -> session */
    webmailSeq: 0
  };

  function demoCode() { return String(Math.floor(100000 + Math.random() * 900000)); }

  function demoHandle(method, path, body) {
    body = body || {};
    const p = path.split('?')[0];

    if (p === '/api/heartbeat') {
      return { ok: true, online: true, name: 'LoveBot ☾', uptimeSec: Math.floor((Date.now() - D.bootTime) / 1000), ramMb: 412.7, node: 'v24.19.0', jid: '49••••@s.whatsapp.net' };
    }
    if (p === '/api/siteinfo') {
      return { ok: true, name: 'LoveBot', owner: 'Maxichen 👑', prefix: '$', version: '2.0-night', domains: ['maxichen.de', 'maxichen.gamebot.me'] };
    }
    if (p === '/api/check-number') {
      const n = String(body.number || '').replace(/\D/g, '');
      if (n === '4915155894714') return { status: 'owner' };
      if (D.users.find((u) => u.phone.replace(/\D/g, '').endsWith(n.slice(-4)) && n.length > 6)) return { status: 'user', name: 'Luna' };
      if (n.endsWith('8821')) return { status: 'user', name: 'Luna' };
      return { status: 'unknown' };
    }
    /* 2FA: Code anfordern (Login UND Registrierung) */
    if (p === '/api/request-code') {
      return { error: 'Der echte LoveBot-Server ist nicht erreichbar. Der 2FA-Code wird aus Sicherheitsgründen nicht im Demo-Modus angezeigt.' };
    }
    if (p === '/api/mailbox/') { return { status: 'sent' }; }
    if (p.startsWith('/api/mailbox/')) { return { status: 'sent' }; }
    if (p === '/api/verify-code') {
      const n = String(body.number || '').replace(/\D/g, '');
      if (demoStore.codes[n] && demoStore.codes[n] === String(body.code)) {
        if (body.purpose === 'login') {
          demoStore.loginTokens[n] = true;
          return { ok: true, loginToken: 'demo-2fa-' + n };
        }
        return { ok: true, setupToken: 'demo-setup-' + n };
      }
      return { error: 'Code falsch oder abgelaufen.' };
    }
    if (p === '/api/login') {
      const n = String(body.number || '').replace(/\D/g, '');
      const pw = String(body.password || '');
      const isOwner = n === '4915155894714';
      /* 2FA-Pflicht: ohne loginToken kein Login */
      if (!demoStore.loginTokens[n]) return { error: '2FA erforderlich: erst Code bestätigen.' , need2fa: true };
      if (isOwner && pw !== 'lovebot') return { error: 'Owner-Passwort falsch. (Demo: lovebot)' };
      if (!isOwner && pw.length < 4) return { error: 'Passwort falsch.' };
      const tok = 'demo-token-' + Math.random().toString(36).slice(2);
      demoStore.tokens[tok] = { number: n, role: isOwner ? 'owner' : 'user', name: isOwner ? 'Maxichen 👑' : 'Luna' };
      return { ok: true, token: tok, role: isOwner ? 'owner' : 'user', name: isOwner ? 'Maxichen 👑' : 'Luna' };
    }
    if (p === '/api/me') {
      const s = demoStore.tokens[getToken()];
      if (s) return { ok: true, ...s };
      /* Seitenreload im Demo-Modus: Token lebt noch in localStorage */
      if (String(getToken()).startsWith('demo-token-')) {
        return { ok: true, number: '49••••••4714', role: 'owner', name: 'Maxichen 👑' };
      }
      return { error: 'unauthorized' };
    }
    if (p === '/api/logout') { delete demoStore.tokens[getToken()]; return { ok: true }; }
    if (p === '/api/stats') {
      D.msgCount += Math.floor(Math.random() * 3);
      return {
        ok: true,
        users: 1284, groups: 94, messages: D.msgCount, commands: D.cmdCount,
        sessionsTotal: D.sessions.length,
        sessionsOnline: D.sessions.filter((s) => s.status === 'ONLINE').length,
        errors: 2, warnings: 7, blocked: 17, failedLogins: 6,
        uptimeSec: Math.floor((Date.now() - D.bootTime) / 1000),
        ramMb: 412.7, cpu: 18.4, dbHealthy: true
      };
    }
    if (p === '/api/session' || p === '/api/sessions') return { ok: true, sessions: D.sessions };
    if (p === '/api/users' || p === '/api/profiles') return { ok: true, users: D.users };
    if (p === '/api/groups') return { ok: true, groups: D.groups };
    if (p === '/api/logs') {
      const n = Number(body.lines || 60);
      const start = Math.max(0, 200 - n);
      const out = [];
      for (let i = start; i < 200; i++) out.push(demoLogLine(i));
      return { ok: true, lines: out };
    }
    if (p === '/api/security') return { ok: true, events: D.security, threat: 'LOW', alerts: 2, blocked: 17, failedLogins: 6 };
    if (p === '/api/audit') return { ok: true, entries: D.audit };
    if (p === '/api/commands') return { ok: true, commands: (window.LOVE_COMMANDS || []) };
    if (p === '/api/features') return { ok: true, features: (window.LOVE_FEATURES || []) };
    if (p === '/api/love') return { ok: true, levels: D.loveLevels, achievements: D.achievements, leaderboard: D.users.slice().sort((a, b) => b.xp - a.xp) };
    if (p === '/api/bans') return { ok: true, bans: [{ number: '49••••••1206', name: 'Jonas', by: 'Maxichen 👑', reason: 'Badwords ×3', at: '2026-09-02 21:14' }] };
    if (p === '/api/badwords') return { ok: true, words: [{ word: '***', on: true }, { word: '****', on: true }, { word: '*****', on: false }] };
    if (p === '/api/owners') return { ok: true, owners: [{ name: 'Maxichen 👑', jid: '49••••@s.whatsapp.net', lid: '2695•••@lid' }] };
    if (p === '/api/database') return { ok: true, users: 1284, groups: 94, sizeKb: 812, records: 18921, backups: 3, healthy: true };
    if (p === '/api/system') {
      return {
        ok: true, node: 'v24.19.0', platform: 'linux', arch: 'x64',
        uptimeSec: Math.floor((Date.now() - D.bootTime) / 1000),
        ramMb: 412.7, ramTotalMb: 8192, cpu: 18.4, diskPct: 41,
        heapMb: 187.3, sessions: D.sessions.length
      };
    }
    if (p === '/api/roles') {
      return { ok: true, roles: [
        { id: 'owner', label: 'OWNER', icon: '👑', level: 100 },
        { id: 'deputy', label: 'STELLV. INHABER:IN', icon: '🔱', level: 90 },
        { id: 'admin', label: 'ADMIN', icon: '◆', level: 70 },
        { id: 'supporter', label: 'SUPPORTER', icon: '◇', level: 40 },
        { id: 'groupadmin', label: 'GROUP ADMIN', icon: '🛡', level: 30 },
        { id: 'user', label: 'USER', icon: '○', level: 10 },
        { id: 'banned', label: 'BANNED', icon: '⛔', level: 0 }
      ], matrix: { owner: ['*'], deputy: ['accounts.view', 'accounts.manage', 'roles.assign', 'sessions.view', 'sessions.control'], admin: ['sessions.view', 'sessions.control', 'users.view', 'users.edit', 'logs.view'], supporter: ['users.view', 'sessions.view', 'logs.view'], groupadmin: ['groups.view', 'users.view'], user: ['self.view'], banned: [] } };
    }
    if (p === '/api/accounts') {
      return { ok: true, accounts: [
        { id: 'acc_1', username: 'max', number: '49••••••4714', role: 'owner', status: 'active', scope: { type: 'global' }, createdAt: '2026-08-01T20:00:00Z', lastLoginAt: '2026-09-03T21:14:00Z', mustChange: false },
        { id: 'acc_2', username: 'julia_admin', number: '49••••••8821', role: 'admin', status: 'active', scope: { type: 'global' }, createdAt: '2026-08-14T18:22:00Z', lastLoginAt: '2026-09-03T19:02:00Z', mustChange: false },
        { id: 'acc_3', username: 'support_anna', number: '49••••••3390', role: 'supporter', status: 'active', scope: { type: 'global' }, createdAt: '2026-08-20T12:00:00Z', lastLoginAt: '2026-09-02T22:41:00Z', mustChange: false },
        { id: 'acc_4', username: 'grp_midnight', number: '49••••••7702', role: 'groupadmin', status: 'active', scope: { type: 'group', groupJid: '120363…@g.us' }, createdAt: '2026-09-01T20:10:00Z', lastLoginAt: null, mustChange: true },
        { id: 'acc_5', username: 'night_owl', number: '49••••••1206', role: 'user', status: 'locked', scope: { type: 'global' }, createdAt: '2026-09-02T23:58:00Z', lastLoginAt: null, mustChange: true }
      ] };
    }
    if (p === '/api/account') {
      return { ok: true, perms: ['*'], account: { id: 'acc_1', username: 'max', role: 'owner', status: 'active', scope: { type: 'global' }, createdAt: '2026-08-01T20:00:00Z', lastLoginAt: '2026-09-03T21:14:00Z', mustChange: false, number: '49••••••4714', roleHistory: [{ role: 'owner', at: '2026-08-01T20:00:00Z', by: 'system' }] } };
    }
    if (p === '/api/account/sessions') {
      return { ok: true, sessions: [
        { tokenHint: '9589e6…', createdAt: '2026-09-03T21:14:00Z', current: true },
        { tokenHint: 'ab12cd…', createdAt: '2026-09-02T22:03:00Z', current: false }
      ] };
    }
    if (p === '/api/register') {
      const tok = 'demo-token-' + Math.random().toString(36).slice(2);
      demoStore.tokens[tok] = { number: '49demo', role: 'user', name: String(body.username || 'seele') };
      return { ok: true, token: tok, role: 'user', name: String(body.username || 'seele') };
    }

    /* POST-Aktionen im Demo-Modus: einfach bestätigen */
    if (method === 'POST') return { ok: true, demo: true };
    return { ok: true, demo: true };
  }

  function toastDemo(code, purpose) {
    const t = document.createElement('div');
    t.className = 'toast warn';
    t.innerHTML = '<b>📱 DEMO — WhatsApp-Code</b>Dein Code: <span class="mono neon-cyan" style="font-size:17px;letter-spacing:4px">' + code + '</span><br><span class="dim small">' + (purpose === 'login' ? 'Login-Bestätigung (2FA)' : 'Registrierung') + ' · im echten Betrieb kommt er per WhatsApp.</span>';
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 14000);
  }

  /* ---------- Fetch-Wrapper ---------------------------------------------------- */
  function getToken() { return localStorage.getItem(TOKEN_KEY) || ''; }
  function setToken(v) { v ? localStorage.setItem(TOKEN_KEY, v) : localStorage.removeItem(TOKEN_KEY); }

  async function raw(method, path, body) {
    const res = await fetch(path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(getToken() ? { Authorization: 'Bearer ' + getToken() } : {})
      },
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
    return { status: res.status, data: await res.json().catch(() => ({})) };
  }

  async function call(method, path, body) {
    if (demoMode) return { status: 200, data: demoHandle(method, path, body) };
    try {
      const r = await raw(method, path, body);
      if (r.status === 401 && getToken()) { setToken(''); location.href = '/login.html'; }
      return r;
    } catch (e) {
      demoMode = true;
      window.dispatchEvent(new CustomEvent('love:demo'));
      return { status: 200, data: demoHandle(method, path, body) };
    }
  }

  /* Beim Start einmal prüfen, ob der echte Server lebt */
  async function probe() {
    if (demoChecked) return demoMode;
    demoChecked = true;
    try {
      const r = await raw('GET', '/api/heartbeat');
      demoMode = !(r.data && (r.data.ok || r.data.online !== undefined));
    } catch (e) { demoMode = true; }
    if (demoMode) window.dispatchEvent(new CustomEvent('love:demo'));
    return demoMode;
  }

  window.API = {
    get: (p) => call('GET', p),
    post: (p, b) => call('POST', p, b),
    raw, call, probe,
    getToken, setToken,
    isDemo: () => demoMode,
    demo: D
  };
})();

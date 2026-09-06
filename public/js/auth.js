/* LoveBot — Login & Registrierung
   🔐 NEU: Erst Nummer prüfen → dann erst Passwort-Feld anzeigen. */
makeHearts(16);
if (getToken()) location.href = '/dashboard.html';

function showTab(tab) {
  document.getElementById('tabLogin').classList.toggle('active', tab === 'login');
  document.getElementById('tabRegister').classList.toggle('active', tab === 'register');
  document.getElementById('loginStep').classList.toggle('active', tab === 'login');
  document.getElementById('regStep1').classList.toggle('active', tab === 'register');
  document.getElementById('regStep2').classList.remove('active');
  document.getElementById('regStep3').classList.remove('active');
}
function showStep(id) {
  ['regStep1', 'regStep2', 'regStep3'].forEach((s) => document.getElementById(s).classList.remove('active'));
  document.getElementById(id).classList.add('active');
}
function msg(elId, text, type) {
  const el = document.getElementById(elId);
  el.textContent = text;
  el.className = 'msg ' + type;
}
async function post(path, body) {
  const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

let loginNumber = '';
let regNumber = '';
let setupToken = '';

/* ── SCHRITT 1: Nummer prüfen ─────────────────────────────────────── */
async function checkNumber() {
  const number = document.getElementById('loginNumber').value.trim();
  const box = document.getElementById('loginMsg');
  const btn = document.getElementById('checkBtn');
  btn.disabled = true;
  msg('loginMsg', '🔎 Nummer wird geprüft …', 'info');
  try {
    const { data } = await post('/api/check-number', { number });
    if (data.status === 'banned' && data.banned) {
      document.getElementById('pwStep').classList.remove('active');
      renderBanBox(box, data.banned);
    } else if (data.status === 'owner') {
      loginNumber = number;
      msg('loginMsg', '👑 Owner-Nummer erkannt — bitte Owner-Passwort eingeben.', 'ok');
      document.getElementById('pwLabel').textContent = '👑 Owner-Passwort';
      document.getElementById('pwStep').classList.add('active');
      document.getElementById('loginPassword').focus();
    } else if (data.status === 'user') {
      loginNumber = number;
      msg('loginMsg', '✅ Konto gefunden: ' + data.name + ' — bitte Passwort eingeben.', 'ok');
      document.getElementById('pwLabel').textContent = '🔐 Dein Passwort';
      document.getElementById('pwStep').classList.add('active');
      document.getElementById('loginPassword').focus();
    } else {
      document.getElementById('pwStep').classList.remove('active');
      msg('loginMsg', '❌ Kein Konto für diese Nummer gefunden. Registriere dich oben im Tab „Registrieren“.', 'error');
    }
  } catch (e) {
    msg('loginMsg', 'Server nicht erreichbar.', 'error');
  }
  btn.disabled = false;
}

/* ── SCHRITT 2: Passwort ──────────────────────────────────────────── */
async function doLogin() {
  const password = document.getElementById('loginPassword').value;
  const btn = document.getElementById('loginBtn');
  const box = document.getElementById('loginMsg');
  btn.disabled = true;
  try {
    const { data } = await post('/api/login', { number: loginNumber, password });
    if (data.ok) {
      localStorage.setItem('love_token', data.token);
      localStorage.setItem('love_name', data.name || '');
      localStorage.setItem('love_role', data.role || 'user');
      msg('loginMsg', '💜 Willkommen zurück! Weiterleitung …', 'ok');
      setTimeout(() => (location.href = '/dashboard.html'), 600);
      return;
    }
    if (data.error === 'banned' && data.banned) {
      renderBanBox(box, data.banned);
    } else {
      msg('loginMsg', data.error || 'Passwort falsch.', 'error');
    }
  } catch (e) {
    msg('loginMsg', 'Server nicht erreichbar.', 'error');
  }
  btn.disabled = false;
}

function backToNumber() {
  document.getElementById('pwStep').classList.remove('active');
  document.getElementById('loginMsg').className = 'msg';
  document.getElementById('loginMsg').textContent = '';
}

/* ── Registrierung ────────────────────────────────────────────────── */
async function requestCode() {
  const number = document.getElementById('regNumber').value.trim();
  const btn = document.getElementById('sendCodeBtn');
  const box = document.getElementById('regMsg1');
  btn.disabled = true;
  msg('regMsg1', '📤 Code wird versendet … (der Bot muss laufen!)', 'info');
  try {
    const { data } = await post('/api/request-code', { number });
    if (data.error === 'banned' && data.banned) {
      renderBanBox(box, data.banned);
      btn.disabled = false;
      return;
    }
    if (!data.ok) {
      msg('regMsg1', data.error || 'Fehler.', 'error');
      btn.disabled = false;
      return;
    }
    let sent = false;
    for (let i = 0; i < 12; i++) {
      await new Promise((r) => setTimeout(r, 2500));
      const st = await fetch('/api/mailbox/' + data.mailboxId).then((r) => r.json());
      if (st.status === 'sent') { sent = true; break; }
      if (st.status === 'error') {
        msg('regMsg1', 'Versand fehlgeschlagen: ' + (st.error || '') + ' — Läuft der Bot?', 'error');
        btn.disabled = false;
        return;
      }
    }
    if (!sent) {
      msg('regMsg1', 'Der Bot hat noch nicht versendet. Läuft Love.js?', 'error');
      btn.disabled = false;
      return;
    }
    regNumber = number.split('@')[0].replace(/[^\d]/g, '');
    msg('regMsg1', '✅ Code gesendet! Schau in WhatsApp.', 'ok');
    setTimeout(() => showStep('regStep2'), 700);
  } catch (e) {
    msg('regMsg1', 'Server nicht erreichbar.', 'error');
  }
  btn.disabled = false;
}

function backToStep1() { showStep('regStep1'); }

async function verifyCode() {
  const code = document.getElementById('regCode').value.trim();
  const { data } = await post('/api/verify-code', { number: regNumber, code });
  if (data.ok) {
    setupToken = data.setupToken;
    msg('regMsg2', '✅ Code richtig! Jetzt Passwort festlegen.', 'ok');
    setTimeout(() => showStep('regStep3'), 600);
  } else {
    msg('regMsg2', data.error || 'Code falsch.', 'error');
  }
}

async function setPassword() {
  const password = document.getElementById('regPassword').value;
  const name = document.getElementById('regName').value.trim();
  const { data } = await post('/api/set-password', { setupToken, password, name });
  if (data.ok) {
    localStorage.setItem('love_token', data.token);
    localStorage.setItem('love_name', data.name || '');
    localStorage.setItem('love_role', data.role || 'user');
    msg('regMsg3', '🎉 Konto erstellt! Weiterleitung …', 'ok');
    setTimeout(() => (location.href = '/dashboard.html'), 900);
  } else {
    msg('regMsg3', data.error || 'Fehler.', 'error');
  }
}

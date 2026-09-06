/* ============================================================================
   LoveBot — LOGIN mit 2FA
   🔐 Ablauf:  1) Nummer prüfen  →  2) WhatsApp-Code (2FA)  →  3) Passwort
   Der Owner-Login läuft genauso: ohne gültigen Code gibt es KEIN Login,
   auch mit richtigem Passwort nicht.
   ==========================================================================*/
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  let number = '';
  let role = '';
  let mailboxId = '';
  let loginToken = '';
  let pollTimer = null;

  function msg(id, text, type) {
    const el = $(id);
    el.textContent = text;
    el.className = 'msg ' + (type || '') + (text ? ' boxed' : '');
  }

  function setStep(n) {
    [1, 2, 3].forEach((i) => {
      $('step' + i).style.display = i === n ? '' : 'none';
      const s = $('s' + i);
      s.className = 's' + (i < n ? ' done' : i === n ? ' act' : '');
      if (i < 3) $('b' + i).className = 'bar' + (i < n ? ' done' : '');
    });
    const focusId = { 1: 'loginNumber', 2: 'loginCode', 3: 'loginPassword' }[n];
    setTimeout(() => $(focusId).focus(), 60);
  }

  function showBan(ban) {
    const box = $('banBox');
    box.style.display = '';
    box.innerHTML = '⛔ <b>Dieses Konto ist gebannt.</b><br>' +
      'Grund: ' + (ban.reason || '—') + '<br>' +
      'Von: ' + (ban.by || 'LoveBot Automod') + '<br>' +
      'Kontakt: ' + (ban.owners || []).map((o) => o.name || o).join(', ');
  }

  /* ---------- SCHRITT 1: Nummer prüfen + Code anfordern ---------------------- */
  window.step1Go = async () => {
    const raw = $('loginNumber').value.trim();
    if (!raw) return msg('msg1', '☾ Bitte Nummer eingeben.', 'warn');
    $('btn1').disabled = true;
    msg('msg1', '🔎 Nummer wird geprüft …', 'info');
    $('banBox').style.display = 'none';
    try {
      const { data } = await API.post('/api/check-number', { number: raw });
      if (data.status === 'banned' && data.banned) { showBan(data.banned); msg('msg1', '', ''); $('btn1').disabled = false; return; }
      if (data.status === 'unknown') { msg('msg1', '❌ Kein Konto für diese Nummer. Registrierte Konten können sich einloggen — der Owner nutzt seine Owner-Nummer.', 'error'); $('btn1').disabled = false; return; }
      number = raw.replace(/@.*$/, '').replace(/\D/g, '');
      role = data.status;
      msg('msg1', (role === 'owner' ? '👑 Owner erkannt. ' : '✅ Konto gefunden: ' + (data.name || '') + '. ') + 'Sende WhatsApp-Code …', 'ok');
      await requestCode();
    } catch (e) {
      msg('msg1', 'Server nicht erreichbar.', 'error');
      $('btn1').disabled = false;
    }
  };

  /* ---------- Code anfordern (Mailbox-Polling) -------------------------------- */
  window.requestCode = async () => {
    $('resendBtn').disabled = true;
    msg('msg2', '📤 Code wird per WhatsApp gesendet …', 'info');
    const { data } = await API.post('/api/request-code', { number, purpose: 'login' });
    if (!data.ok) {
      msg('msg2', data.error || 'Versand fehlgeschlagen.', 'error');
      $('resendBtn').disabled = false;
      return;
    }
    mailboxId = data.mailboxId;
    setStep(2);
    msg('msg2', '☾ Schau in WhatsApp — der Code ist unterwegs.', 'info');

    /* Mailbox pollen, bis der Bot den Code rausgeschickt hat */
    if (pollTimer) clearInterval(pollTimer);
    let tries = 0;
    pollTimer = setInterval(async () => {
      tries++;
      try {
        const r = await API.get('/api/mailbox/' + mailboxId);
        if (r.data.status === 'sent') {
          clearInterval(pollTimer); pollTimer = null;
          msg('msg2', '✅ Code gesendet. Gültig für 5 Minuten.', 'ok');
        } else if (r.data.status === 'error') {
          clearInterval(pollTimer); pollTimer = null;
          msg('msg2', '💔 Versand fehlgeschlagen: ' + (r.data.error || '') + ' — läuft Love.js?', 'error');
        } else if (tries > 24) { /* ~60 s */
          clearInterval(pollTimer); pollTimer = null;
          msg('msg2', '🌧️ Der Bot hat noch nicht gesendet. Läuft Love.js? ↻ versuchen es erneut.', 'warn');
        }
      } catch (e) {}
    }, 2500);
    $('resendBtn').disabled = false;
  };

  /* ---------- SCHRITT 2: Code bestätigen -------------------------------------- */
  window.step2Go = async () => {
    const code = $('loginCode').value.trim();
    if (code.length !== 6) return msg('msg2', '☾ Der Code hat 6 Stellen.', 'warn');
    $('btn2').disabled = true;
    msg('msg2', '🔐 Code wird geprüft …', 'info');
    const { data } = await API.post('/api/verify-code', { number, code, purpose: 'login' });
    $('btn2').disabled = false;
    if (data.ok) {
      loginToken = data.loginToken;
      msg('msg2', '✅ Code richtig.', 'ok');
      $('pwLabel').textContent = role === 'owner' ? '👑 Owner-Passwort' : '🔐 Dein Passwort';
      setStep(3);
    } else {
      msg('msg2', data.error || '💔 Code falsch oder abgelaufen.', 'error');
    }
  };

  /* ---------- SCHRITT 3: Passwort ---------------------------------------------- */
  window.step3Go = async () => {
    const password = $('loginPassword').value;
    if (!password) return msg('msg3', '☾ Passwort fehlt.', 'warn');
    $('btn3').disabled = true;
    msg('msg3', '💜 einen Moment …', 'info');
    const { data } = await API.post('/api/login', { number, password, loginToken });
    $('btn3').disabled = false;
    if (data.ok) {
      API.setToken(data.token);
      localStorage.setItem('love_name', data.name || '');
      localStorage.setItem('love_role', data.role || 'user');
      msg('msg3', '♡ welcome back, ' + (data.name || '') + '.', 'ok');
      setTimeout(() => (location.href = '/app.html'), 700);
      return;
    }
    if (data.error === 'banned' && data.banned) { showBan(data.banned); msg('msg3', '', ''); return; }
    msg('msg3', data.error || '💔 Passwort falsch.', 'error');
  };

  /* ---------- Registrierung: Username + Nummer + Code → USER ---------- */
  window.toggleReg = () => {
    const w = $('regWrap');
    w.style.display = w.style.display === 'none' ? '' : 'none';
  };
  let regSetupToken = '';
  window.regStart = async () => {
    const username = $('regUsername').value.trim();
    const number = $('regNumber').value.trim();
    if (username.length < 3) return msg('regMsg', '☾ Username: mind. 3 Zeichen.', 'warn');
    $('regBtn1').disabled = true;
    msg('regMsg', ' Code wird gesendet …', 'info');
    const { data } = await API.post('/api/request-code', { number, purpose: 'register' });
    if (!data.ok) { msg('regMsg', data.error || 'Fehler.', 'error'); $('regBtn1').disabled = false; return; }
    regNumberForReg = number.replace(/\D/g, '');
    regMailbox = data.mailboxId;
    $('regCodeWrap').style.display = '';
    msg('regMsg', '☾ Code ist unterwegs …', 'info');
    let tries = 0;
    const poll = setInterval(async () => {
      tries++;
      const r = await API.get('/api/mailbox/' + regMailbox);
      if (r.data.status === 'sent') { clearInterval(poll); msg('regMsg', '✅ Code gesendet.', 'ok'); }
      else if (r.data.status === 'error') { clearInterval(poll); msg('regMsg', '💔 Versandfehler: ' + (r.data.error || ''), 'error'); }
      else if (tries > 24) { clearInterval(poll); msg('regMsg', '🌧️ Bot sendet nicht — läuft Love.js?', 'warn'); }
    }, 2500);
    $('regBtn1').disabled = false;
  };
  let regNumberForReg = '';
  let regMailbox = '';
  window.regFinish = async () => {
    const code = $('regCode').value.trim();
    const password = $('regPassword').value;
    const username = $('regUsername').value.trim();
    const v = await API.post('/api/verify-code', { number: regNumberForReg, code, purpose: 'register' });
    if (!v.data.ok) return msg('regMsg', v.data.error || 'Code falsch.', 'error');
    regSetupToken = v.data.setupToken;
    const r = await API.post('/api/register', { setupToken: regSetupToken, username, password });
    if (r.data.ok) {
      API.setToken(r.data.token);
      localStorage.setItem('love_name', r.data.name || '');
      localStorage.setItem('love_role', r.data.role || 'user');
      msg('regMsg', '♡ welcome to the night, ' + r.data.name + '.', 'ok');
      setTimeout(() => (location.href = '/app.html'), 800);
    } else {
      msg('regMsg', r.data.error || 'Fehler.', 'error');
    }
  };

  window.backTo = (n) => {
    setStep(n);
    ['msg1', 'msg2', 'msg3'].forEach((m) => msg(m, '', ''));
  };

  /* ---------- Boot -------------------------------------------------------------- */
  (async function () {
    await API.probe();
    if (API.isDemo()) {
      const p = document.createElement('div');
      p.className = 'demo-pill';
      p.innerHTML = 'demo-modus · Nummer: <b>4915155894714</b> · Code: kommt als Toast · Passwort: <b>lovebot</b>';
      document.body.appendChild(p);
    }
    if (API.getToken()) {
      const me = await API.get('/api/me');
      if (me.data && me.data.ok !== false && me.data.name) location.href = '/app.html';
    }
    setStep(1);
  })();
})();

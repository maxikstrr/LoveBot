/* ============================================================================
   LoveBot — Wartungsmodus-Türsteher (läuft ALS ALLERERSTES im <head>, vor
   jedem anderen Skript/Stylesheet). Nutzt bewusst SYNCHRONE XHR-Aufrufe,
   damit der Browser das Parsen der restlichen Seite erst fortsetzt, NACHDEM
   feststeht, ob der Wartungsmodus aktiv ist — so kann keine andere Seite
   (App-Shell, Login-Formular, Landingpage …) auch nur kurz aufblitzen,
   bevor die „Zugriff verweigert“-Seite den kompletten Dokument-Inhalt
   ersetzt und window.stop() alle weiteren Ladevorgänge abbricht.
   Ausnahme: /login.html bleibt IMMER erreichbar, damit sich der Owner
   überhaupt einloggen kann, um den Wartungsmodus wieder zu beenden.
   ==========================================================================*/
(function () {
  'use strict';
  try {
    if (location.pathname === '/login.html') return;

    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/maintenance', false);
    xhr.send(null);
    if (xhr.status !== 200) return;

    var info = null;
    try { info = JSON.parse(xhr.responseText || '{}'); } catch (e) { return; }
    if (!info || !info.on) return;

    /* Owner-Ausnahme: wer bereits mit gültigem Owner-Token eingeloggt ist,
       darf die Website während der Wartung weiter benutzen. */
    var token = null;
    try { token = localStorage.getItem('love_token'); } catch (e) {}
    if (token) {
      try {
        var xhr2 = new XMLHttpRequest();
        xhr2.open('GET', '/api/me', false);
        xhr2.setRequestHeader('Authorization', 'Bearer ' + token);
        xhr2.send(null);
        if (xhr2.status === 200) {
          var me = JSON.parse(xhr2.responseText || '{}');
          if (me && me.role === 'owner') return; /* Owner-Bypass */
        }
      } catch (e) {}
    }

    var esc = function (s) {
      return String(s || '').replace(/[<>&"]/g, function (c) {
        return { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c];
      });
    };
    var reason = esc(info.reason || 'Kein Grund angegeben');
    var since = info.since ? new Date(info.since).toLocaleString('de-DE') : '—';
    var by = esc(info.by || 'Owner');

    var html = '<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
      '<title>🛠️ Zugriff verweigert — Wartungsmodus | LoveBot</title>' +
      '<style>' +
      '*{box-sizing:border-box}' +
      'html,body{height:100%;margin:0}' +
      'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:radial-gradient(1200px 700px at 20% -10%,rgba(167,139,250,.20),transparent 60%),radial-gradient(1000px 600px at 100% 110%,rgba(244,114,182,.16),transparent 55%),#07050f;color:#fff;display:flex;align-items:center;justify-content:center;padding:24px}' +
      '.card{max-width:640px;width:100%;background:linear-gradient(160deg,rgba(255,255,255,.06),rgba(255,255,255,.02));border:1px solid rgba(255,255,255,.10);border-radius:26px;padding:44px 38px;backdrop-filter:blur(18px);box-shadow:0 30px 80px rgba(0,0,0,.55);text-align:center}' +
      '.ico{font-size:64px;line-height:1;margin-bottom:6px;filter:drop-shadow(0 0 24px rgba(248,113,113,.55))}' +
      'h1{font-size:26px;margin:10px 0 6px;letter-spacing:.02em;background:linear-gradient(90deg,#f87171,#f472b6);-webkit-background-clip:text;background-clip:text;color:transparent}' +
      '.sub{color:rgba(255,255,255,.62);font-size:14.5px;margin-bottom:26px}' +
      '.reason{background:rgba(248,113,113,.09);border:1px solid rgba(248,113,113,.35);border-radius:16px;padding:18px 20px;margin:0 0 22px;text-align:left}' +
      '.reason .k{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.09em;color:rgba(255,255,255,.5);margin-bottom:6px}' +
      '.reason .v{font-size:16.5px;font-weight:600;color:#fff;line-height:1.5}' +
      '.meta{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-bottom:26px}' +
      '.chip{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:999px;padding:7px 14px;font-size:12.5px;color:rgba(255,255,255,.75)}' +
      '.chip b{color:#fff}' +
      '.foot{font-size:12.5px;color:rgba(255,255,255,.4);font-style:italic;margin-top:6px}' +
      '.pulse{display:inline-block;width:9px;height:9px;border-radius:50%;background:#f87171;box-shadow:0 0 10px #f87171;margin-right:8px;animation:pulse 1.6s ease-in-out infinite}' +
      '@keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}' +
      '</style></head><body>' +
      '<div class="card">' +
      '<div class="ico">🛠️🚫</div>' +
      '<h1>ZUGRIFF VERWEIGERT</h1>' +
      '<div class="sub"><span class="pulse"></span>LoveBot befindet sich gerade im Wartungsmodus</div>' +
      '<div class="reason"><span class="k">📄 Grund</span><span class="v">' + reason + '</span></div>' +
      '<div class="meta">' +
      '<span class="chip">🕒 Seit <b>' + esc(since) + '</b></span>' +
      '<span class="chip">👑 Von <b>' + by + '</b></span>' +
      '</div>' +
      '<div class="foot">☾ Die Website ist während der Wartung für alle außer den Owner gesperrt.<br>Bitte versuche es gleich noch einmal — LoveBot by Maxichen 2026 💜</div>' +
      '</div>' +
      '</body></html>';

    document.open();
    document.write(html);
    document.close();
    if (window.stop) window.stop();
  } catch (e) {
    /* Bei irgendeinem unerwarteten Fehler NIEMALS die Seite blockieren —
       lieber normal laden als versehentlich alle aussperren. */
  }
})();

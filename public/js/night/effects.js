/* ============================================================================
   LoveBot — NIGHT EFFECTS
   ☾ Regen · Sterne · Glow-Orbs · Mood-System · Nacht-Uhr
   ==========================================================================*/
(function () {
  'use strict';

  const MOODS = [
    { id: 'lonely',    icon: '🌧️', label: 'lonely' },
    { id: 'midnight',  icon: '🌙', label: 'midnight' },
    { id: 'empty',     icon: '🌫️', label: 'empty' },
    { id: 'nostalgic', icon: '💜', label: 'nostalgic' },
    { id: 'dark',      icon: '🖤', label: 'dark' },
    { id: 'hopeful',   icon: '✨', label: 'hopeful' },
    { id: 'broken',    icon: '💔', label: 'broken' },
    { id: 'peaceful',  icon: '🌌', label: 'peaceful' }
  ];

  /* Stimmung nach Uhrzeit — "der Text lebt mit der Nacht" */
  function moodForHour(h) {
    if (h >= 6 && h < 11)  return 'hopeful';
    if (h >= 11 && h < 18) return 'peaceful';
    if (h >= 18 && h < 23) return 'nostalgic';
    if (h >= 23 || h < 4)  return 'midnight';
    return 'lonely'; /* 04–06: the night refuses to end */
  }

  const MOOD_LINES = {
    lonely:    ['nobody is talking…', '🌧️ waiting for a message…', 'the terminal has been quiet for a while.', 'I\'m still here.'],
    midnight:  ['everyone is asleep…', '☾ the sessions are still awake…', 'another night begins…', 'stay a little longer.'],
    empty:     ['🌫️ the night refuses to end', 'silence, but not lonely.', '…'],
    nostalgic: ['💜 some connections never fade.', 'the city is getting quiet…', 'I remember every message.'],
    dark:      ['🖤 nothing stays hidden.', 'the dark keeps our secrets.'],
    hopeful:   ['✨ morning has arrived.', '☀ a new day, new messages.', 'someone will write soon.'],
    broken:    ['💔 some connections are temporary.', 'even connections can break.', 'I\'ll wait here.'],
    peaceful:  ['🌌 all systems quiet.', '☁ another ordinary day.', 'everything seems okay.']
  };

  const state = {
    mood: localStorage.getItem('love_mood') || moodForHour(new Date().getHours()),
    rain: localStorage.getItem('love_rain') !== '0',
    nightmode: localStorage.getItem('love_nightmode') === '1'
  };

  function setMood(id, silent) {
    if (!MOODS.find((m) => m.id === id)) return;
    state.mood = id;
    localStorage.setItem('love_mood', id);
    document.body.dataset.mood = id;
    if (!silent) window.dispatchEvent(new CustomEvent('love:mood', { detail: id }));
  }

  function moodLine() {
    const lines = MOOD_LINES[state.mood] || MOOD_LINES.lonely;
    return lines[Math.floor(Math.random() * lines.length)];
  }

  /* ---------- Canvas: Regen + Sterne ---------------------------------------- */
  function startCanvases() {
    let rain = document.getElementById('bgRain');
    let stars = document.getElementById('bgStars');
    if (!rain) { rain = document.createElement('canvas'); rain.id = 'bgRain'; document.body.prepend(rain); }
    if (!stars) { stars = document.createElement('canvas'); stars.id = 'bgStars'; document.body.prepend(stars); }

    const rctx = rain.getContext('2d');
    const sctx = stars.getContext('2d');
    let W = 0, H = 0, drops = [], starArr = [], orbs = [];

    function resize() {
      W = rain.width = stars.width = window.innerWidth;
      H = rain.height = stars.height = window.innerHeight;
      drops = Array.from({ length: Math.min(110, Math.floor(W / 14)) }, () => ({
        x: Math.random() * W, y: Math.random() * H,
        l: 8 + Math.random() * 14, v: 2.2 + Math.random() * 3.4, o: .05 + Math.random() * .12
      }));
      starArr = Array.from({ length: Math.floor(W / 16) }, () => ({
        x: Math.random() * W, y: Math.random() * H * .8,
        r: Math.random() * 1.1 + .2, p: Math.random() * Math.PI * 2, s: .4 + Math.random() * 1.4
      }));
      orbs = [
        { x: W * .18, y: H * .28, r: 260, c: '255,45,149', a: .05 },
        { x: W * .82, y: H * .18, r: 300, c: '168,85,247', a: .05 },
        { x: W * .62, y: H * .82, r: 240, c: '0,240,255',  a: .035 }
      ];
    }
    window.addEventListener('resize', resize);
    resize();

    let t = 0;
    function frame() {
      t += .016;
      /* Sterne */
      sctx.clearRect(0, 0, W, H);
      for (const o of orbs) {
        const g = sctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r);
        g.addColorStop(0, `rgba(${o.c},${o.a})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        sctx.fillStyle = g;
        sctx.fillRect(o.x - o.r, o.y - o.r, o.r * 2, o.r * 2);
      }
      for (const s of starArr) {
        const tw = .35 + Math.abs(Math.sin(t * s.s + s.p)) * .65;
        sctx.globalAlpha = tw * .5;
        sctx.fillStyle = '#cfd0ff';
        sctx.beginPath(); sctx.arc(s.x, s.y, s.r, 0, 7); sctx.fill();
      }
      sctx.globalAlpha = 1;
      /* Regen */
      rctx.clearRect(0, 0, W, H);
      if (state.rain) {
        rctx.lineWidth = 1;
        for (const d of drops) {
          rctx.strokeStyle = `rgba(150,170,255,${d.o})`;
          rctx.beginPath();
          rctx.moveTo(d.x, d.y);
          rctx.lineTo(d.x - d.l * .18, d.y + d.l);
          rctx.stroke();
          d.y += d.v; d.x -= d.v * .18;
          if (d.y > H) { d.y = -20; d.x = Math.random() * W; }
        }
      }
      requestAnimationFrame(frame);
    }
    frame();
  }

  /* ---------- Nacht-Uhr + Mood-Zeile ----------------------------------------- */
  function startClocks() {
    const tick = () => {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const ss = String(now.getSeconds()).padStart(2, '0');
      document.querySelectorAll('[data-clock]').forEach((el) => { el.textContent = `${hh}:${mm}:${ss}`; });
      document.querySelectorAll('[data-date]').forEach((el) => {
        el.textContent = now.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });
      });
    };
    tick(); setInterval(tick, 1000);

    const rotateMoodLine = () => {
      document.querySelectorAll('[data-moodline]').forEach((el) => { el.textContent = '☾ ' + moodLine(); });
    };
    rotateMoodLine(); setInterval(rotateMoodLine, 9000);
  }

  function applyNightmode() {
    document.body.classList.toggle('nightmode-low', state.nightmode);
  }

  window.NightFX = {
    MOODS,
    init() {
      setMood(state.mood, true);
      applyNightmode();
      startCanvases();
      startClocks();
    },
    setMood,
    getMood: () => state.mood,
    moodLine,
    moodForHour,
    setRain(on) { state.rain = !!on; localStorage.setItem('love_rain', on ? '1' : '0'); },
    getRain: () => state.rain,
    setNightmode(on) { state.nightmode = !!on; localStorage.setItem('love_nightmode', on ? '1' : '0'); applyNightmode(); },
    getNightmode: () => state.nightmode
  };
})();

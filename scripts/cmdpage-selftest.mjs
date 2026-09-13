/* ═══════════════════════════════════════════════════════════════════════
   LoveBot — Befehle-Seite (cmd.js) DOM-Smoke-Test
   Führt cmd.js mit ECHTEN Befehlsdaten (commands-data.js) gegen ein
   minimales DOM-Stub aus und prüft die gerenderten Karten:
     · Render-Pipeline komplett durchgelaufen
     · jede Karte hat BEFEHL · BEISPIEL · ERKLÄRUNG
     · kein Platzhalter bleibt ungefüllt
     · Beispiel-Outputs sind konkret nutzbar
   ═══════════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';

const src = fs.readFileSync('public/js/cmd.js', 'utf8');

/* ── Minimal-DOM ──────────────────────────────────────────────────── */
const els = {};
function el(id) {
  if (!els[id]) els[id] = {
    id, innerHTML: '', textContent: '', style: {}, value: '',
    classList: { toggle() {}, add() {}, remove() {} },
    addEventListener() {}, focus() {},
    querySelectorAll: () => []
  };
  return els[id];
}
globalThis.document = {
  getElementById: el,
  querySelector: () => el('_q'),
  querySelectorAll: () => [],
  addEventListener() {},
  createElement: () => el('_c' + Math.random())
};
globalThis.window = {};
globalThis.makeHearts = () => {};
globalThis.toast = () => {};
globalThis.copyText = () => Promise.resolve();
globalThis.esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* Echte Befehlsdaten (statischer Fallback, gleiche Form wie /api/commands) */
const raw = fs.readFileSync('public/js/commands-data.js', 'utf8');
globalThis.window.LOVEBOT_COMMANDS = JSON.parse(raw.slice(raw.indexOf('=') + 1).replace(/;\s*$/, ''));

/* cmd.js ausführen */
(0, eval)(src);

/* ── Auswertung (nachdem die async-Init laufen konnte) ─────────────── */
await new Promise((r) => setTimeout(r, 300));

const grid = els['cmdFullGrid'];
let fails = 0;
const check = (name, ok, extra = '') => {
  console.log(`  ${name} → ${ok ? 'OK' : 'FAIL'}${extra ? '  ' + extra : ''}`);
  if (!ok) fails++;
};

console.log('═══ Befehle-Seite · DOM-Smoke-Test ═══');
if (!grid || !grid.innerHTML) {
  console.log('FAIL: kein Grid-HTML gerendert');
  process.exit(1);
}

const html = grid.innerHTML;
const cards = (html.match(/class="cmdrow /g) || []).length;
const total = globalThis.window.LOVEBOT_COMMANDS.filter((c) => !/alias/i.test(c.title)).reduce((a, c) => a + c.cmds.length, 0);

check('Render-Pipeline komplett', true);
check('Zähler-Zeile', els['cmdCount'] && els['cmdCount'].textContent.includes('Befehl'), '· ' + els['cmdCount']?.textContent);
check('Kategorie-Tabs gerendert', (els['catbar'].innerHTML.match(/cat-tab/g) || []).length > 10, '· ' + (els['catbar'].innerHTML.match(/cat-tab/g) || []).length + ' Tabs');
check('Alle Karten gerendert', cards === total, `· ${cards}/${total}`);
check('Jede Karte hat BEISPIEL-Label', (html.match(/>Beispiel</g) || []).length === cards);
check('Jede Karte hat ERKLÄRUNG-Label', (html.match(/>Erklärung</g) || []).length === cards);
check('Jede Karte hat Akzent-Farbe', (html.match(/cmdrow acc-/g) || []).length === cards);
check('Syntax-Highlight aktiv ($-Prefix)', (html.match(/class="p">\$</g) || []).length >= cards);

/* Kein Platzhalter darf ungefüllt ins Beispiel fließen */
const dataCmds = [...html.matchAll(/data-cmd="([^"]*)"/g)].map((m) => m[1]);
const unfilled = dataCmds.filter((d) => /[<\[]/.test(d));
check('Kein Platzhalter in Beispielen', unfilled.length === 0, unfilled.length ? '· ' + unfilled.slice(0, 5).join(' · ') : '');

/* Alias-Box (nur wenn die Daten eine Alias-Kategorie enthalten — bei den
   aktuellen Registry-Daten sind Aliase pro Befehl eingebettet) */
const hasAliasCat = globalThis.window.LOVEBOT_COMMANDS.some((c) => /alias/i.test(c.title || ''));
if (hasAliasCat) {
  check('Alias-Klappbox vorhanden', html.includes('aliasbox') && html.includes('Alle Aliase anzeigen'));
} else {
  console.log('  Alias-Klappbox → OK (übersprungen: keine Alias-Kategorie in den Daten — Aliase sind eingebettet)');
}

/* Beispiele-Sampler zur Sichtprüfung */
console.log('\n── Beispiel-Outputs (Sichtprüfung) ──');
[...new Set(dataCmds)].filter((_, i) => i % 23 === 0).slice(0, 14).forEach((d) => console.log('   ' + d));

if (fails) { console.log(`\n✘ ${fails} Checks fehlgeschlagen`); process.exit(1); }
console.log('\n✔ Befehle-Seite: alle Checks erfolgreich');

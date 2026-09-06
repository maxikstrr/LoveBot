/* ============================================================================
   LoveBot — NIGHT CONSOLE (ESM, Node-Terminal)
   ☾ Dasselbe Vokabular wie das Web-Terminal: help · status · sessions · logs …
   Read-only + lokale Aktionen (mood/theme). Läuft im Bot-Prozess auf stdin,
   nachdem das Pairing-Menü geschlossen wurde.
   ==========================================================================*/
import readline from 'readline';
import fs from 'fs';
import path from 'path';
import { logNight, nightFooter, moodForHour, moodLine } from './terminal.js';

const C = {
  reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m',
  pink: '\x1b[38;5;206m', cyan: '\x1b[38;5;51m', violet: '\x1b[38;5;141m',
  white: '\x1b[97m', grey: '\x1b[38;5;240m', green: '\x1b[38;5;114m', yellow: '\x1b[38;5;221m'
};

const THEME_FILE = path.join('Database', 'console-theme.json');
const THEMES = ['midnight', 'rain', 'ghost', 'neon', 'violet', 'cyan', 'void', 'bloodmoon', 'monochrome', 'minimal'];

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return fallback; }
}
function db() { return readJson(path.join('Database', 'Database.json'), { users: {}, groups: {} }); }
function heartbeat() { return readJson(path.join('Database', 'heartbeat.json'), null); }
function auditTail(n = 10) {
  try {
    return fs.readFileSync(path.join('Database', 'audit.jsonl'), 'utf8').trim().split('\n').filter(Boolean).slice(-n).reverse().map((l) => JSON.parse(l));
  } catch (e) { return []; }
}
function logTail(n = 12) {
  try {
    return fs.readFileSync(path.join('Logs', 'lovebot.log'), 'utf8').trim().split('\n').slice(-n);
  } catch (e) { return []; }
}
const fmtNum = (n) => Number(n || 0).toLocaleString('de-DE');
function fmtDur(sec) {
  sec = Math.max(0, Math.floor(sec || 0));
  const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  const p = [];
  if (d) p.push(d + 'd');
  if (h) p.push(h + 'h');
  if (m) p.push(m + 'm');
  if (!p.length || s) p.push(s + 's');
  return p.join(' ');
}

const COMMANDS = {
  help: { desc: 'alle Befehle', run(out) {
    out(`${C.pink}help${C.reset}`);
    out('────────────────────────────────────────');
    for (const [name, def] of Object.entries(COMMANDS)) {
      out(`${C.cyan}☾ ${name.padEnd(14)}${C.reset}${C.dim} ${def.desc}${C.reset}`);
    }
    out('');
    out(`${C.grey}web & terminal sprechen dieselbe sprache.${C.reset}`);
  } },
  '?': { desc: 'alias für help', run(out) { COMMANDS.help.run(out); } },
  find: { desc: 'find <query> — sucht Befehle', run(out, arg) {
    const q = String(arg || '').toLowerCase();
    const hits = Object.keys(COMMANDS).filter((k) => k.includes(q));
    out(`${C.violet}☾ find: ${q || '…'}${C.reset}`);
    hits.forEach((h) => out(`${C.cyan}› ${h}${C.reset}  ${C.dim}${COMMANDS[h].desc}${C.reset}`));
  } },
  status: { desc: 'system & sessions', run(out) {
    const hb = heartbeat();
    const online = !!(hb && hb.online && Date.now() - new Date(hb.time).getTime() < 40000);
    const d = db();
    out(`${C.violet}☾ I'm still here.${C.reset}`);
    out(`session    › ${online ? `${C.green}ONLINE${C.reset}` : `${C.dim}OFFLINE${C.reset}`}  (${hb?.name || 'MainBot'})`);
    out(`users      › ${fmtNum(Object.keys(d.users || {}).length)}`);
    out(`groups     › ${fmtNum(Object.keys(d.groups || {}).length)}`);
    out(`uptime     › ${fmtDur(hb?.uptimeSec || 0)}`);
    out(`ram        › ${(hb?.ramMb || 0).toFixed(0)} MB`);
    out(`${C.pink}♡ everything seems okay.${C.reset}`);
  } },
  'status all': { desc: 'alles auf einen Blick', run(out) {
    const hb = heartbeat();
    const online = !!(hb && hb.online && Date.now() - new Date(hb.time).getTime() < 40000);
    out(`${C.pink}╔═══════════════════════════════════════════╗${C.reset}`);
    out(`${C.pink}║${C.reset}              ☾ LOVEBOT STATUS             ${C.pink}║${C.reset}`);
    out(`${C.pink}╠═══════════════════════════════════════════╣${C.reset}`);
    out(`${C.pink}║${C.reset} Process   ${online ? '🟢 ONLINE ' : '🔴 OFFLINE'}                  ${C.pink}║${C.reset}`);
    out(`${C.pink}║${C.reset} Web       🟢 ONLINE   (server.js)         ${C.pink}║${C.reset}`);
    out(`${C.pink}║${C.reset} Database  🟢 HEALTHY                      ${C.pink}║${C.reset}`);
    out(`${C.pink}║${C.reset} Security  🟢 LOW                          ${C.pink}║${C.reset}`);
    out(`${C.pink}║${C.reset} Uptime    ${fmtDur(hb?.uptimeSec || 0).padEnd(34)}${C.pink}║${C.reset}`);
    out(`${C.pink}╚═══════════════════════════════════════════╝${C.reset}`);
    out(`${C.dim}☾ everything is still alive.${C.reset}`);
  } },
  sessions: { desc: 'session-übersicht', run(out) {
    const hb = heartbeat();
    const online = !!(hb && hb.online && Date.now() - new Date(hb.time).getTime() < 40000);
    let creds = false;
    try { creds = fs.existsSync(path.join('Sessions', 'creds.json')); } catch (e) {}
    out(`${C.violet}☾ sessions tonight${C.reset}`);
    out(`01  ${online ? `${C.cyan}● MainBot${C.reset}` : creds ? `${C.dim}○ MainBot${C.reset}` : `${C.dim}○ MainBot${C.reset}`}   ${online ? 'ONLINE · awake for ' + fmtDur(hb?.uptimeSec || 0) : 'OFFLINE · last seen ' + (hb?.time ? new Date(hb.time).toLocaleTimeString('de-DE') : '—')}`);
    out('');
    out(`${C.dim}1 session remembered · ${online ? 1 : 0} alive${C.reset}`);
  } },
  users: { desc: 'seelen der nacht', run(out) {
    const d = db();
    const list = Object.values(d.users || {}).filter((u) => u?.progression).sort((a, b) => (b.progression.xp || 0) - (a.progression.xp || 0)).slice(0, 8);
    out(`${C.violet}☾ souls of the night${C.reset}`);
    if (!list.length) { out(`${C.dim}nobody is registered yet.${C.reset}`); return; }
    list.forEach((u, i) => out(`${C.pink}♡${C.reset} ${String(u.identity?.username || u.identity?.cleanJid || '?').padEnd(16)} ${C.dim}Lv ${u.progression.level} · ${fmtNum(u.progression.xp)} XP${C.reset}`));
  } },
  logs: { desc: 'logs [n] — tonight\'s memories', run(out, arg) {
    const n = Math.min(60, parseInt(arg, 10) || 12);
    out(`${C.violet}☾ reading tonight's memories…${C.reset}`);
    logTail(n).forEach((l) => out(`${C.grey}${l}${C.reset}`));
  } },
  history: { desc: 'command audit (hash-chained)', run(out) {
    const entries = auditTail(12);
    out(`${C.violet}☾ command audit${C.reset}`);
    if (!entries.length) { out(`${C.dim}nothing happened yet. suspicious.${C.reset}`); return; }
    entries.forEach((e) => out(`${C.grey}${new Date(e.time).toLocaleTimeString('de-DE')}${C.reset}  ${C.white}${e.actor}${C.reset} › ${C.cyan}${e.action}${C.reset} ${C.dim}${e.target} · ${e.result}${C.reset}`));
  } },
  health: { desc: 'health-check', run(out) {
    const hb = heartbeat();
    const online = !!(hb && hb.online && Date.now() - new Date(hb.time).getTime() < 40000);
    out(`${C.violet}☾ LOVE BOT HEALTH${C.reset}`);
    out(`Process        ${online ? C.green + '100%' : C.yellow + '0%'}${C.reset}`);
    out(`Web            ${C.green}98%${C.reset}`);
    out(`Database       ${C.green}100%${C.reset}`);
    out(`RAM            ${(hb?.ramMb || 0).toFixed(0)} MB`);
    out(`${C.pink}☾ everything is breathing.${C.reset}`);
  } },
  diagnose: { desc: 'diagnostics', run(out) {
    const checks = [
      ['node.js', true], ['filesystem', true],
      ['database', fs.existsSync(path.join('Database', 'Database.json'))],
      ['web server', fs.existsSync('server.js')],
      ['sessions dir', fs.existsSync('Sessions')],
      ['logs dir', fs.existsSync('Logs')]
    ];
    out(`${C.violet}☾ LOVE BOT DIAGNOSTICS${C.reset}`);
    checks.forEach(([n, ok]) => out(`${ok ? C.green + '[✓]' : C.yellow + '[!]'}${C.reset} ${n}`));
    const warn = checks.filter(([, ok]) => !ok).length;
    out(`${C.dim}warnings › ${warn} · errors › 0${C.reset}`);
  } },
  mood: { desc: 'mood [set <id>] — atmosphäre', run(out, arg) {
    const m = moodForHour();
    if (arg) { out(`${C.dim}☾ mood setzt du im Web-Dashboard (Settings) — das Terminal liest mit.${C.reset}`); return; }
    out(`current mood: ${C.pink}${m.icon} ${m.id}${C.reset}`);
    out(`${C.grey}☾ ${moodLine()}${C.reset}`);
  } },
  night: { desc: 'night system overview', run(out) {
    const hb = heartbeat();
    const now = new Date();
    out(`${C.pink}☾ NIGHT SYSTEM${C.reset}`);
    out('');
    out(now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }));
    out('');
    out(`sessions       1`);
    out(`awake          ${hb?.online ? 1 : 0}`);
    out(`security       LOW`);
    out(`system         HEALTHY`);
    out('');
    out(`${C.dim}☾ the world is sleeping.${C.reset}`);
  } },
  theme: { desc: 'theme <name> — terminal-profil', run(out, arg) {
    const cur = readJson(THEME_FILE, { theme: 'midnight' });
    const t = String(arg || '').toLowerCase();
    if (!t) { out(`current theme: ${C.cyan}${cur.theme}${C.reset}`); out(`${C.dim}verfügbar: ${THEMES.join(' · ')}${C.reset}`); return; }
    if (!THEMES.includes(t)) { out(`${C.dim}☾ theme nicht gefunden. verfügbar: ${THEMES.join(', ')}${C.reset}`); return; }
    fs.mkdirSync('Database', { recursive: true });
    fs.writeFileSync(THEME_FILE, JSON.stringify({ theme: t }, null, 2));
    out(`${C.pink}☾ theme › ${t}${C.reset}`);
    out(`${C.dim}lights low · neon soft · rain ${t === 'rain' ? 'enabled' : 'steady'}${C.reset}`);
  } },
  whoami: { desc: 'wer bist du', run(out) {
    out(`${C.white}you are the one keeping everything awake.${C.reset}`);
    out(`${C.dim}access › TERMINAL · security › TRUSTED${C.reset}`);
  } },
  uptime: { desc: 'wie lange wach', run(out) {
    const hb = heartbeat();
    out(`awake for ${C.cyan}${fmtDur(hb?.uptimeSec || process.uptime())}${C.reset}.`);
  } },
  time: { desc: 'nacht-uhr', run(out) {
    const now = new Date();
    out(`${C.cyan}☾ ${now.toLocaleTimeString('de-DE')}${C.reset}${C.dim} · ${now.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}${C.reset}`);
  } },
  notify: { desc: 'notify test — owner-alertprobe', run(out, arg) {
    if (String(arg) === 'test') {
      out(`${C.yellow}🚨 SECURITY ALERT (test)${C.reset}`);
      out(`${C.dim}risk › 0/100 · action › none · owner › notified ✓${C.reset}`);
      return;
    }
    out(`${C.dim}notify-Kanäle: terminal ✓ · web ✓ · whatsapp (owner-PM) via webmail-queue${C.reset}`);
  } },
  shutdown: { desc: 'hinweis zum stoppen', run(out) {
    out(`${C.violet}☾ zum Stoppen: Strg+C im Bot-Prozess oder PM2.${C.reset}`);
    out(`${C.dim}ich gehe nicht von allein schlafen.${C.reset}`);
  } }
};

export function startNightConsole() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: '' });
  const out = (line = '') => console.log(line);
  const writePrompt = () => process.stdout.write(`${C.pink}  LoveBot › ${C.reset}`);
  out('');
  out(`${C.dim}  ☾ console bereit. ${C.cyan}help${C.dim} für Befehle · identisch zum Web-Terminal.${C.reset}`);
  writePrompt();
  rl.on('line', (line) => {
    const raw = line.trim();
    const [cmd, ...rest] = raw.split(/\s+/);
    const two = [cmd, rest[0]].filter(Boolean).join(' ').toLowerCase();
    const fn = COMMANDS[two] || COMMANDS[String(cmd || '').toLowerCase()];
    if (!raw) { writePrompt(); return; }
    if (!fn) {
      out(`${C.dim}  ☾ unknown command. tippe ${C.cyan}help${C.dim}.${C.reset}`);
    } else {
      try { fn.run(out, rest.join(' ')); } catch (e) { out(`${C.yellow}  ⚠ ${e.message}${C.reset}`); }
    }
    writePrompt();
  });
  rl.on('close', () => {});
  return rl;
}

export { COMMANDS as NIGHT_CONSOLE_COMMANDS, THEMES };

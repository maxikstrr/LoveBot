/* ============================================================================
   LoveBot — NIGHT TERMINAL (ESM)
   ☾ Logger, Banner, Mood-Zeilen, Nacht-Uhr-Footer für Love.js
   Wird von logLove() / printStartupBanner() genutzt — keine weiteren Änderungen
   am Bot nötig.
   ==========================================================================*/
import fs from 'fs';
import path from 'path';

const C = {
  reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m',
  pink: '\x1b[38;5;206m', pinkBright: '\x1b[38;5;212m',
  cyan: '\x1b[38;5;51m', violet: '\x1b[38;5;141m',
  white: '\x1b[97m', grey: '\x1b[38;5;240m',
  red: '\x1b[38;5;203m', yellow: '\x1b[38;5;221m', green: '\x1b[38;5;114m'
};

const LOG_DIR = path.join('Logs');
const LOG_PATH = path.join(LOG_DIR, 'lovebot.log');

/* ---------- Mood nach Uhrzeit ---------------------------------------------- */
export function moodForHour(h = new Date().getHours()) {
  if (h >= 6 && h < 11) return { id: 'hopeful', icon: '✨' };
  if (h >= 11 && h < 18) return { id: 'peaceful', icon: '☁️' };
  if (h >= 18 && h < 23) return { id: 'nostalgic', icon: '💜' };
  if (h >= 23 || h < 4) return { id: 'midnight', icon: '🌙' };
  return { id: 'lonely', icon: '🌧️' };
}

const MOOD_LINES = {
  hopeful: ['✨ morning has arrived.', '☀ a new day, new messages.'],
  peaceful: ['🌌 all systems quiet.', '☁ another ordinary day.'],
  nostalgic: ['💜 the city is getting quiet…', 'some connections never fade.'],
  midnight: ['☾ everyone is asleep…', 'the sessions are still awake…', 'another night begins…'],
  lonely: ['🌧️ nobody is talking…', 'the night refuses to end.', 'I\'m still here.']
};

export function moodLine() {
  const m = moodForHour();
  const lines = MOOD_LINES[m.id] || MOOD_LINES.lonely;
  return lines[Math.floor(Math.random() * lines.length)];
}

/* ---------- Tag-Farben ------------------------------------------------------- */
function tagColor(tag) {
  const t = String(tag || '').toLowerCase();
  if (['error', 'security', 'ban'].includes(t)) return C.red;
  if (['warn', 'badwords'].includes(t)) return C.yellow;
  if (['session', 'dashboard', 'web'].includes(t)) return C.cyan;
  if (['command', 'features', 'bc'].includes(t)) return C.pink;
  if (['love', 'marry', 'night'].includes(t)) return C.pinkBright;
  if (['boot', 'system'].includes(t)) return C.violet;
  return C.violet;
}

/* ---------- Logger ----------------------------------------------------------- */
export function logNight(tag, text) {
  const now = new Date();
  const stamp = now.toLocaleTimeString('de-DE');
  const col = tagColor(tag);
  console.log(
    `${C.grey}${stamp}${C.reset}  ${col}${String(tag).padEnd(9)}${C.reset}` +
    `${C.dim}›${C.reset} ${C.white}${text}${C.reset}`
  );
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(LOG_PATH, `[${now.toLocaleString('de-DE')}] [${tag}] ${text}\n`, 'utf8');
  } catch (e) {}
}

/* Gelegentliche Mood-Zeile zwischen Logs (1 von 14 Aufrufen) */
let logCount = 0;
export function logNightMood(tag, text) {
  logNight(tag, text);
  logCount++;
  if (logCount % 14 === 0) {
    console.log(`${C.dim}            ${C.reset}${C.grey}☾ ${moodLine()}${C.reset}`);
  }
}

/* ---------- Start-Banner ------------------------------------------------------ */
export function nightBanner(version = 'v2') {
  const now = new Date();
  const hhmm = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const date = now.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const m = moodForHour();
  const line = '─'.repeat(52);
  console.log('');
  console.log(C.pink + '  ╭' + line + '╮' + C.reset);
  console.log(C.pink + '  │' + C.reset + C.bold + C.pinkBright + '                      ☾  L O V E B O T'.padEnd(52) + C.reset + C.pink + '│' + C.reset);
  console.log(C.pink + '  │' + C.reset + C.dim + '                     midnight control'.padEnd(52) + C.reset + C.pink + '│' + C.reset);
  console.log(C.pink + '  ├' + line + '┤' + C.reset);
  console.log(C.pink + '  │' + C.reset + C.dim + `   ${m.icon}  ${hhmm} — ${date}`.padEnd(52) + C.reset + C.pink + '│' + C.reset);
  console.log(C.pink + '  │' + C.reset + C.dim + `   node ${process.version} · ${process.platform}`.padEnd(52) + C.reset + C.pink + '│' + C.reset);
  console.log(C.pink + '  ╰' + line + '╯' + C.reset);
  console.log('');
  console.log(C.violet + '  ☾ waking up…' + C.reset);
  console.log(C.dim + '  ☾ good evening. I was waiting for you.' + C.reset);
  console.log('');
}

/* ---------- Footer / Prompt ---------------------------------------------------- */
export function nightFooter(stats = {}) {
  const now = new Date();
  const hhmmss = now.toLocaleTimeString('de-DE');
  const parts = [];
  if (stats.sessions !== undefined) parts.push(`${stats.sessions} sessions awake`);
  if (stats.online !== undefined) parts.push(`${stats.online} connections alive`);
  console.log('');
  console.log(C.grey + '  ' + '─'.repeat(46) + C.reset);
  console.log(C.cyan + `  ☾ ${hhmmss}` + C.reset + C.dim + `  ·  ${now.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}` + C.reset);
  if (parts.length) console.log(C.dim + '  ' + parts.join(' · ') + C.reset);
  console.log(C.grey + '  "stay a little longer."' + C.reset);
  console.log('');
}

export function nightPromptLine() {
  return C.pink + '  LoveBot › ' + C.reset;
}

/* ---------- Melancholische Status-Texte ------------------------------------------ */
export const NIGHT_TEXT = {
  connected: (name) => [`☾ ${name} connected.`, 'I missed this connection.'],
  disconnected: (name) => [`💔 ${name} disconnected.`, 'the connection went quiet.', '☾ I\'ll wait here.'],
  reconnecting: (name, n, max) => [`☾ ${name} disappeared.`, `› trying to find the connection… attempt ${n}/${max}`],
  reconnected: (name) => ['♡ connection found again.', `☾ ${name} › ONLINE`],
  qrWaiting: (name) => [`☾ ${name}: QR code ready.`, 'scan the code before the night ends.'],
  shutdown: () => ['☾ good night.', 'I\'ll be here when you come back.'],
  quiet: (since) => [`☾ no messages. the terminal has been quiet for ${since}.`, 'I\'m still here.']
};

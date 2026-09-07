/* ═══════════════════════════════════════════════════════════════════════
   🎉  L O V E B O T   E X T R A - B E F E H L E   (extracmds.js)
   ─────────────────────────────────────────────────────────────────────
   Weitere Befehle für LoveBot by Maxichen 2026 — gemischt aus drei
   Bereichen: Spaß & Spiele, nützliche Tools mit echten APIs, und kleine
   Love-Erweiterungen. Genau wie toolcmds.js: echte Daten, ehrliche
   Fehlermeldungen statt erfundener Werte.

     Spaß & Spiele:
       $shipname @a @b            · Kompatibilitäts-Prozentrechner für zwei Namen
       $tarot                 · zieht eine Zufalls-Tarotkarte
       $wortkette <wort>      · findet ein Folgewort (letzter Buchstabe = erster)
       $anagram <wort>        · prüft/mischt Buchstaben zum Rätsel
       $palindrom <text>      · prüft, ob ein Text ein Palindrom ist
       $mathequiz             · kleine Kopfrechenaufgabe mit Timer-Hinweis
       $duell @user           · Zufalls-Duell zwischen zwei Personen
       $wuerfelduell @user    · Würfelduell 1-6 gegen eine andere Person
       $sternzeichen <datum>  · berechnet das Sternzeichen aus einem Datum
       $emoji <text>          · übersetzt Wörter in eine Emoji-Kette

     Nützliche Tools (echte APIs):
       $advice                · zufälliger Lebensrat (adviceslip.com)
       $chucknorris           · Chuck-Norris-Witz (api.chucknorris.io)
       $kanye                 · Zufalls-Zitat (api.kanye.rest)
       $activity              · Zufalls-Aktivität gegen Langeweile (appbrewery)
       $iss                   · aktuelle Position der ISS (open-notify.org)
       $meineip                · öffentliche IP des Bot-Servers (ipify.org)
       $githubzen              · zufälliger GitHub-Design-Leitsatz
       $bmi <kg> <cm>          · Body-Mass-Index berechnen
       $countdown <datum>      · Tage bis zu einem Datum
       $tagderwoche <datum>    · Wochentag eines Datums berechnen
       $zeitzone <stadt>       · aktuelle Uhrzeit in einer Zeitzone

     Love-Erweiterungen:
       $liebescheck @user      · süßer Zufalls-Kompatibilitäts-Report (Fun, kein echtes Match)
       $kuschelvorschlag       · Zufallsvorschlag für ein Kuschel-/Date-Ritual
       $komplimentgenerator @user · generiert ein zufälliges Kompliment

   Alle Befehle sind für JEDEN nutzbar (perms: all), außer explizit anders
   markiert. Fehler bei externen APIs werden ehrlich gemeldet.
   ═══════════════════════════════════════════════════════════════════════ */

import crypto from 'node:crypto';
import { reactions, sendReaction } from './waApi.js';
import c from './colorApi.js';

export const EXTRA_COMMANDS = new Set([
  'shipname', 'tarot', 'wortkette', 'anagram', 'palindrom', 'mathequiz',
  'duell', 'wuerfelduell', 'würfelduell', 'sternzeichen', 'emoji',
  'advice', 'lebensrat', 'chucknorris', 'kanye', 'activity', 'langeweile',
  'iss', 'meineip', 'meinip', 'githubzen', 'bmi', 'countdown', 'tagderwoche',
  'zeitzone', 'liebescheck', 'kuschelvorschlag', 'komplimentgenerator'
]);

/* ───────────────────────────── Helfer ────────────────────────────── */

async function jget(url, timeoutMs = 12000) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { 'user-agent': 'LoveBot/1.0 (+extras)', accept: 'application/json' }
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function parseDate(input) {
  const s = String(input || '').trim();
  const m = s.match(/^(\d{1,2})[.\/-](\d{1,2})(?:[.\/-](\d{2,4}))?$/);
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    const year = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : new Date().getFullYear();
    const d = new Date(year, month - 1, day);
    if (!Number.isNaN(d.getTime()) && d.getDate() === day) return d;
  }
  const d2 = new Date(s);
  return Number.isNaN(d2.getTime()) ? null : d2;
}

const ZODIAC = [
  [[1, 20], [2, 18], '♒ Wassermann'], [[2, 19], [3, 20], '♓ Fische'],
  [[3, 21], [4, 19], '♈ Widder'], [[4, 20], [5, 20], '♉ Stier'],
  [[5, 21], [6, 20], '♊ Zwillinge'], [[6, 21], [7, 22], '♋ Krebs'],
  [[7, 23], [8, 22], '♌ Löwe'], [[8, 23], [9, 22], '♍ Jungfrau'],
  [[9, 23], [10, 22], '♎ Waage'], [[10, 23], [11, 21], '♏ Skorpion'],
  [[11, 22], [12, 21], '♐ Schütze']
];
function zodiacOf(day, month) {
  for (const [[fm, fd], [tm, td], name] of ZODIAC) {
    if ((month === fm && day >= fd) || (month === tm && day <= td)) return name;
  }
  return '♑ Steinbock';
}

const WEEKDAYS_DE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

const TIMEZONE_CITIES = {
  berlin: 'Europe/Berlin', wien: 'Europe/Vienna', zuerich: 'Europe/Zurich', zürich: 'Europe/Zurich',
  london: 'Europe/London', paris: 'Europe/Paris', madrid: 'Europe/Madrid', rom: 'Europe/Rome',
  moskau: 'Europe/Moscow', istanbul: 'Europe/Istanbul', dubai: 'Asia/Dubai', tokio: 'Asia/Tokyo',
  peking: 'Asia/Shanghai', shanghai: 'Asia/Shanghai', delhi: 'Asia/Kolkata', mumbai: 'Asia/Kolkata',
  bangkok: 'Asia/Bangkok', singapur: 'Asia/Singapore', sydney: 'Australia/Sydney',
  newyork: 'America/New_York', 'new york': 'America/New_York', losangeles: 'America/Los_Angeles',
  'los angeles': 'America/Los_Angeles', chicago: 'America/Chicago', toronto: 'America/Toronto',
  saopaulo: 'America/Sao_Paulo', 'sao paulo': 'America/Sao_Paulo', kairo: 'Africa/Cairo', cairo: 'Africa/Cairo'
};

const TAROT_CARDS = [
  ['🃏 Der Narr', 'Ein Neuanfang liegt vor dir — trau dich, den ersten Schritt zu machen.'],
  ['🎩 Der Magier', 'Du hast gerade alle Werkzeuge, die du brauchst — nutze sie.'],
  ['🌙 Die Hohepriesterin', 'Hör auf dein Bauchgefühl, nicht nur auf Logik.'],
  ['👑 Die Herrscherin', 'Fülle und Fürsorge stehen im Vordergrund — auch für dich selbst.'],
  ['🏛️ Der Herrscher', 'Struktur und Klarheit bringen dich jetzt weiter.'],
  ['💕 Die Liebenden', 'Eine wichtige Entscheidung im Herzen steht an.'],
  ['🛡️ Die Kraft', 'Sanfte Stärke schlägt rohe Gewalt — bleib ruhig.'],
  ['🎡 Rad des Schicksals', 'Ein Wendepunkt ist nah — bleib flexibel.'],
  ['⚖️ Die Gerechtigkeit', 'Fairness und Wahrheit setzen sich durch.'],
  ['🌟 Der Stern', 'Hoffnung und ein ruhiger Moment nach stürmischer Zeit.'],
  ['🌞 Die Sonne', 'Freude, Erfolg und Leichtigkeit liegen in der Luft.'],
  ['🌍 Die Welt', 'Ein Kapitel schließt sich rund und erfüllt ab.']
];

/* ───────────────────────────── Handler ───────────────────────────── */

async function cmdShipname({ sock, msg, from, args }) {
  const text = args.join(' ').trim();
  const names = text.split(/\s*(?:&|und|\+|,)\s*/).filter(Boolean);
  const a = names[0] || 'Person A';
  const b = names[1] || 'Person B';
  const seed = crypto.createHash('md5').update(a.toLowerCase() + '|' + b.toLowerCase()).digest();
  const pct = seed[0] % 101;
  const bar = '█'.repeat(Math.round(pct / 10)) + '░'.repeat(10 - Math.round(pct / 10));
  const verdict = pct >= 85 ? '💍 Seelenverwandte!' : pct >= 60 ? '💞 Da geht was!' : pct >= 35 ? '🤔 Könnte klappen …' : '😅 Eher als Freunde.';
  const shipName = (a.slice(0, Math.ceil(a.length / 2)) + b.slice(Math.floor(b.length / 2))).replace(/\s+/g, '');
  await sock.sendMessage(from, {
    text: `> 💘 *SHIP-RECHNER*\n\n${a} 💜 ${b}\n${bar} *${pct}%*\n\n✨ *Ship-Name:* ${shipName}\n${verdict}\n\n_Nur zum Spaß — kein echtes Matching._`
  }, { quoted: msg });
}

async function cmdTarot({ sock, msg, from }) {
  const [name, meaning] = pick(TAROT_CARDS);
  await sock.sendMessage(from, {
    text: `> 🔮 *TAROT-ZIEHUNG*\n\n${name}\n\n_${meaning}_\n\n💡 Nur zur Unterhaltung.`
  }, { quoted: msg });
}

const WORDLIST_DE = ['apfel', 'nase', 'elefant', 'tiger', 'rakete', 'ente', 'esel', 'liebe', 'ei', 'igel', 'lampe', 'mond', 'nest', 'tomate', 'tasse', 'ente'];
async function cmdWortkette({ sock, msg, from, args, pref }) {
  const word = String(args[0] || '').trim().toLowerCase();
  if (!word) {
    await sock.sendMessage(from, { text: `> 🔤 *WORTKETTE*\n\nNutze: *${pref}wortkette <wort>*\nDas Folgewort beginnt mit deinem letzten Buchstaben.` }, { quoted: msg });
    return;
  }
  const lastChar = word.slice(-1);
  const candidates = WORDLIST_DE.filter((w) => w[0] === lastChar && w !== word);
  const next = candidates.length ? pick(candidates) : null;
  await sock.sendMessage(from, {
    text: next
      ? `> 🔤 *WORTKETTE*\n\nDein Wort: *${word}*\nMein Folgewort: *${next}* (beginnt mit „${lastChar}“)\n\n💡 Jetzt bist du dran: finde ein Wort mit „${next.slice(-1)}“!`
      : `> 🔤 *WORTKETTE*\n\nDein Wort: *${word}*\nMir fällt gerade kein Wort mit „${lastChar}“ ein — du gewinnst diese Runde! 🏆`
  }, { quoted: msg });
}

async function cmdAnagram({ sock, msg, from, args, pref }) {
  const word = String(args.join('')).trim();
  if (!word) {
    await sock.sendMessage(from, { text: `> 🔀 *ANAGRAMM*\n\nNutze: *${pref}anagram <wort>* — ich mische die Buchstaben, du rätst das Original!` }, { quoted: msg });
    return;
  }
  const letters = word.split('');
  for (let i = letters.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [letters[i], letters[j]] = [letters[j], letters[i]];
  }
  const scrambled = letters.join('');
  await sock.sendMessage(from, {
    text: `> 🔀 *ANAGRAMM-RÄTSEL*\n\nGemischt: *${scrambled}*\n\n💡 Finde das Originalwort! (${word.length} Buchstaben)`
  }, { quoted: msg });
}

async function cmdPalindrom({ sock, msg, from, args, pref }) {
  const raw = args.join(' ').trim();
  if (!raw) {
    await sock.sendMessage(from, { text: `> 🪞 *PALINDROM-CHECK*\n\nNutze: *${pref}palindrom <text>*` }, { quoted: msg });
    return;
  }
  const clean = raw.toLowerCase().replace(/[^a-zäöüß0-9]/g, '');
  const reversed = clean.split('').reverse().join('');
  const isPalindrom = clean === reversed && clean.length > 0;
  await sock.sendMessage(from, {
    text: `> 🪞 *PALINDROM-CHECK*\n\nText: „${raw}“\n${isPalindrom ? '✅ Das ist ein Palindrom!' : '❌ Kein Palindrom.'}`
  }, { quoted: msg });
}

async function cmdMathequiz({ sock, msg, from }) {
  const a = randInt(2, 20);
  const b = randInt(2, 20);
  const op = pick(['+', '-', '×']);
  const result = op === '+' ? a + b : op === '-' ? a - b : a * b;
  await sock.sendMessage(from, {
    text: `> 🧮 *KOPFRECHNEN-QUIZ*\n\n*${a} ${op} ${b} = ?*\n\n⏳ Denk kurz nach … die Lösung: *${result}*\n\n💡 Willst du das selbst lösen, bevor du scrollst? 😉`
  }, { quoted: msg });
}

async function cmdDuell({ sock, msg, from, args, pref, mentionedJid, senderName }) {
  const target = mentionedJid || (args.join(' ').trim() || null);
  const opponent = target ? String(target).replace(/@s\.whatsapp\.net$/, '').replace(/^@/, '') : 'ein Herausforderer';
  const you = senderName || 'Du';
  const winner = pick([you, opponent]);
  const move = pick(['⚔️ Schwerthieb', '🛡️ Blockade', '🔥 Feuerball', '❄️ Eisschlag', '⚡ Blitzschlag', '🌪️ Wirbelsturm']);
  await sock.sendMessage(from, {
    text: `> ⚔️ *ZUFALLS-DUELL*\n\n${you} vs. ${opponent}\n\n${move}!\n\n🏆 *Gewinner:* ${winner}\n\n_Nur Spaß — kein echter Kampf._`
  }, { quoted: msg });
}

async function cmdWuerfelduell({ sock, msg, from, senderName, mentionedJid, args }) {
  const you = senderName || 'Du';
  const target = mentionedJid || (args.join(' ').trim() || null);
  const opponent = target ? String(target).replace(/@s\.whatsapp\.net$/, '').replace(/^@/, '') : 'der Bot';
  const rollA = randInt(1, 6);
  const rollB = randInt(1, 6);
  const result = rollA === rollB ? '🤝 Unentschieden!' : rollA > rollB ? `🏆 ${you} gewinnt!` : `🏆 ${opponent} gewinnt!`;
  await sock.sendMessage(from, {
    text: `> 🎲 *WÜRFELDUELL*\n\n${you}: 🎲 ${rollA}\n${opponent}: 🎲 ${rollB}\n\n${result}`
  }, { quoted: msg });
}

async function cmdSternzeichen({ sock, msg, from, args, pref }) {
  const date = parseDate(args.join(' '));
  if (!date) {
    await sock.sendMessage(from, { text: `> ♈ *STERNZEICHEN*\n\nNutze: *${pref}sternzeichen TT.MM.[JJJJ]*\nBeispiel: *${pref}sternzeichen 24.12*` }, { quoted: msg });
    return;
  }
  const sign = zodiacOf(date.getDate(), date.getMonth() + 1);
  await sock.sendMessage(from, {
    text: `> ♈ *STERNZEICHEN*\n\nGeburtsdatum: ${date.toLocaleDateString('de-DE')}\n\nDein Sternzeichen: *${sign}*`
  }, { quoted: msg });
}

const EMOJI_MAP = {
  liebe: '❤️', herz: '💜', glücklich: '😄', traurig: '😢', wütend: '😠', müde: '😴',
  hund: '🐶', katze: '🐱', essen: '🍽️', pizza: '🍕', kaffee: '☕', bier: '🍺',
  sonne: '☀️', mond: '🌙', stern: '⭐', regen: '🌧️', schnee: '❄️', feuer: '🔥',
  geld: '💰', musik: '🎵', tanzen: '💃', lachen: '😂', küssen: '😘', schlafen: '😴',
  auto: '🚗', haus: '🏠', baum: '🌳', blume: '🌸', geburtstag: '🎂', party: '🎉'
};
async function cmdEmoji({ sock, msg, from, args, pref }) {
  const text = args.join(' ').trim();
  if (!text) {
    await sock.sendMessage(from, { text: `> 😀 *EMOJI-ÜBERSETZER*\n\nNutze: *${pref}emoji <text>* — einzelne Wörter werden zu Emojis.` }, { quoted: msg });
    return;
  }
  const translated = text.split(/\s+/).map((w) => EMOJI_MAP[w.toLowerCase()] || w).join(' ');
  await sock.sendMessage(from, { text: `> 😀 *EMOJI-ÜBERSETZUNG*\n\n${translated}` }, { quoted: msg });
}

async function cmdAdvice({ sock, msg, from }) {
  const data = await jget('https://api.adviceslip.com/advice');
  await sock.sendMessage(from, { text: `> 💡 *LEBENSRAT*\n\n_${data.slip?.advice || 'Kein Rat gefunden.'}_` }, { quoted: msg });
}

async function cmdChuckNorris({ sock, msg, from }) {
  const data = await jget('https://api.chucknorris.io/jokes/random');
  await sock.sendMessage(from, { text: `> 🥋 *CHUCK NORRIS*\n\n${data.value || 'Kein Witz gefunden.'}` }, { quoted: msg });
}

async function cmdKanye({ sock, msg, from }) {
  const data = await jget('https://api.kanye.rest');
  await sock.sendMessage(from, { text: `> 🎤 *ZUFALLS-ZITAT*\n\n_"${data.quote || '—'}"_` }, { quoted: msg });
}

async function cmdActivity({ sock, msg, from }) {
  const data = await jget('https://bored-api.appbrewery.com/random');
  await sock.sendMessage(from, {
    text: `> 🎯 *GEGEN LANGEWEILE*\n\n${data.activity || 'Keine Aktivität gefunden.'}\n\n` +
      `👥 Teilnehmer: ${data.participants ?? '—'}\n💰 Kosten: ${data.price === 0 ? 'kostenlos' : 'kostet etwas'}\n🎈 Kinderfreundlich: ${data.kidFriendly ? 'ja' : 'nein'}`
  }, { quoted: msg });
}

async function cmdIss({ sock, msg, from }) {
  const data = await jget('http://api.open-notify.org/iss-now.json');
  const pos = data.iss_position || {};
  await sock.sendMessage(from, {
    text: `> 🛰️ *ISS LIVE-POSITION*\n\n🌍 Breitengrad: ${pos.latitude}\n🌍 Längengrad: ${pos.longitude}\n🕐 Stand: ${new Date((data.timestamp || 0) * 1000).toLocaleString('de-DE')}\n\n🔗 Karte: https://www.google.com/maps?q=${pos.latitude},${pos.longitude}`
  }, { quoted: msg });
}

async function cmdMeineIp({ sock, msg, from }) {
  const data = await jget('https://api.ipify.org?format=json');
  await sock.sendMessage(from, { text: `> 🌐 *ÖFFENTLICHE IP (BOT-SERVER)*\n\n${data.ip || '—'}\n\n💡 Das ist die IP des Bot-Servers, nicht deine eigene.` }, { quoted: msg });
}

async function cmdGithubZen({ sock, msg, from }) {
  const res = await fetch('https://api.github.com/zen', { signal: AbortSignal.timeout(12000), headers: { 'user-agent': 'LoveBot' } });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const text = (await res.text()).trim();
  await sock.sendMessage(from, { text: `> 🐙 *GITHUB ZEN*\n\n_"${text}"_` }, { quoted: msg });
}

async function cmdBmi({ sock, msg, from, args, pref }) {
  const kg = Number(args[0]);
  const cm = Number(args[1]);
  if (!kg || !cm) {
    await sock.sendMessage(from, { text: `> ⚖️ *BMI-RECHNER*\n\nNutze: *${pref}bmi <kg> <cm>*\nBeispiel: *${pref}bmi 70 175*` }, { quoted: msg });
    return;
  }
  const m = cm / 100;
  const bmi = kg / (m * m);
  const cat = bmi < 18.5 ? 'Untergewicht' : bmi < 25 ? 'Normalgewicht' : bmi < 30 ? 'Übergewicht' : 'Adipositas';
  await sock.sendMessage(from, {
    text: `> ⚖️ *BMI-RECHNER*\n\nGewicht: ${kg} kg\nGröße: ${cm} cm\n\n*BMI: ${bmi.toFixed(1)}*\nKategorie: ${cat}\n\n_Nur ein grober Richtwert, keine medizinische Beratung._`
  }, { quoted: msg });
}

async function cmdCountdown({ sock, msg, from, args, pref }) {
  const date = parseDate(args.join(' '));
  if (!date) {
    await sock.sendMessage(from, { text: `> ⏳ *COUNTDOWN*\n\nNutze: *${pref}countdown TT.MM.JJJJ*\nBeispiel: *${pref}countdown 24.12.2026*` }, { quoted: msg });
    return;
  }
  const now = new Date();
  const diffMs = date.setHours(23, 59, 59, 999) - now.getTime();
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  await sock.sendMessage(from, {
    text: days >= 0
      ? `> ⏳ *COUNTDOWN*\n\nBis zum ${new Date(date).toLocaleDateString('de-DE')} sind es noch:\n\n*${days} Tag${days === 1 ? '' : 'e'}* 🎉`
      : `> ⏳ *COUNTDOWN*\n\nDas Datum liegt bereits *${Math.abs(days)} Tag${Math.abs(days) === 1 ? '' : 'e'}* in der Vergangenheit.`
  }, { quoted: msg });
}

async function cmdTagDerWoche({ sock, msg, from, args, pref }) {
  const date = parseDate(args.join(' '));
  if (!date) {
    await sock.sendMessage(from, { text: `> 📅 *WOCHENTAG*\n\nNutze: *${pref}tagderwoche TT.MM.JJJJ*` }, { quoted: msg });
    return;
  }
  const weekday = WEEKDAYS_DE[date.getDay()];
  await sock.sendMessage(from, {
    text: `> 📅 *WOCHENTAG-RECHNER*\n\n${date.toLocaleDateString('de-DE')} war/ist ein *${weekday}*.`
  }, { quoted: msg });
}

async function cmdZeitzone({ sock, msg, from, args, pref }) {
  const city = args.join(' ').trim().toLowerCase();
  const tz = TIMEZONE_CITIES[city];
  if (!tz) {
    const list = Object.keys(TIMEZONE_CITIES).slice(0, 12).join(', ');
    await sock.sendMessage(from, {
      text: `> 🕐 *ZEITZONE*\n\nNutze: *${pref}zeitzone <stadt>*\nBeispiele: ${list} …`
    }, { quoted: msg });
    return;
  }
  const time = new Intl.DateTimeFormat('de-DE', { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date());
  await sock.sendMessage(from, { text: `> 🕐 *ZEITZONE*\n\n${args.join(' ')} (${tz}):\n*${time}*` }, { quoted: msg });
}

const LOVE_TIPS = [
  'Kleine Aufmerksamkeiten im Alltag zählen mehr als große Gesten selten.',
  'Ehrliche Kommunikation schlägt jedes Rätselraten.',
  'Zusammen lachen verbindet mehr, als man denkt.',
  'Zeit ohne Handy — bewusst füreinander da sein.',
  'Auch in Beziehungen: Sich gegenseitig Raum zum Wachsen lassen.',
  'Ein „Danke“ für Selbstverständliches wirkt oft Wunder.'
];
async function cmdLiebescheck({ sock, msg, from, senderName, mentionedJid, args }) {
  const you = senderName || 'Du';
  const target = mentionedJid || (args.join(' ').trim() || null);
  const partner = target ? String(target).replace(/@s\.whatsapp\.net$/, '').replace(/^@/, '') : 'dein Schwarm';
  const seed = crypto.createHash('md5').update(you.toLowerCase() + '|' + String(partner).toLowerCase() + new Date().toDateString()).digest();
  const pct = 40 + (seed[0] % 61);
  const tip = pick(LOVE_TIPS);
  await sock.sendMessage(from, {
    text: `> 💞 *LIEBES-CHECK DES TAGES*\n\n${you} 💜 ${partner}\n\nHeutige Verbindung: *${pct}%*\n\n💡 Tipp des Tages:\n_${tip}_\n\n_Nur zur Unterhaltung — kein echtes Matching._`
  }, { quoted: msg });
}

const CUDDLE_IDEAS = [
  '🎬 Filmabend mit Kuscheldecke und Popcorn',
  '🍳 Gemeinsam kochen und dabei Musik hören',
  '🚶 Abendspaziergang Hand in Hand',
  '📖 Sich gegenseitig aus einem Buch vorlesen',
  '🌌 Sternenhimmel angucken und dabei quatschen',
  '🎲 Brettspiel-Abend nur zu zweit',
  '📸 Alte Fotos zusammen anschauen und Erinnerungen teilen',
  '🛁 Entspannter Wellness-Abend zuhause'
];
async function cmdKuschelvorschlag({ sock, msg, from }) {
  await sock.sendMessage(from, { text: `> 🛋️ *KUSCHEL-VORSCHLAG*\n\n${pick(CUDDLE_IDEAS)}` }, { quoted: msg });
}

const COMPLIMENTS = [
  'hat ein Lächeln, das jeden Raum heller macht ✨',
  'bringt andere immer zum Lachen 😄',
  'ist einfach eine warmherzige Person 💜',
  'hat ein großes Herz für andere 🌸',
  'strahlt pure gute Laune aus ☀️',
  'ist wirklich ein toller Mensch 🌟'
];
async function cmdKomplimentgenerator({ sock, msg, from, senderName, mentionedJid, args }) {
  const target = mentionedJid || (args.join(' ').trim() || null);
  const name = target ? String(target).replace(/@s\.whatsapp\.net$/, '').replace(/^@/, '') : (senderName || 'Du');
  await sock.sendMessage(from, { text: `> 💌 *KOMPLIMENT-GENERATOR*\n\n${name} ${pick(COMPLIMENTS)}` }, { quoted: msg });
}

/* ───────────────────────────── Router ────────────────────────────── */

const HANDLERS = {
  shipname: cmdShipname,
  tarot: cmdTarot,
  wortkette: cmdWortkette,
  anagram: cmdAnagram,
  palindrom: cmdPalindrom,
  mathequiz: cmdMathequiz,
  duell: cmdDuell,
  wuerfelduell: cmdWuerfelduell, 'würfelduell': cmdWuerfelduell,
  sternzeichen: cmdSternzeichen,
  emoji: cmdEmoji,
  advice: cmdAdvice, lebensrat: cmdAdvice,
  chucknorris: cmdChuckNorris,
  kanye: cmdKanye,
  activity: cmdActivity, langeweile: cmdActivity,
  iss: cmdIss,
  meineip: cmdMeineIp, meinip: cmdMeineIp,
  githubzen: cmdGithubZen,
  bmi: cmdBmi,
  countdown: cmdCountdown,
  tagderwoche: cmdTagDerWoche,
  zeitzone: cmdZeitzone,
  liebescheck: cmdLiebescheck,
  kuschelvorschlag: cmdKuschelvorschlag,
  komplimentgenerator: cmdKomplimentgenerator
};

/**
 * Führt einen Extra-Befehl aus.
 * @returns {Promise<boolean>} true, wenn der Befehl zu diesem Modul gehört
 */
export async function handleExtraCommand({ sock, msg, from, args = [], command = '', pref = '$', quoted = null, senderName = '', mentionedJid = null }) {
  const key = String(command || '').toLowerCase();
  const handler = HANDLERS[key];
  if (!handler) return false;

  try {
    await handler({ sock, msg, from, args, quoted, pref, senderName, mentionedJid });
    await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
    console.log(c.bold + c.brightCyan + `[extras] $${key} ausgeführt.` + c.reset);
    return true;
  } catch (err) {
    const reason = String(err?.message || err).slice(0, 160);
    try {
      await sock.sendMessage(from, {
        text: '> ❌ *BEFEHL-FEHLER*\n\n' +
          `• Befehl: *$${key}*\n` +
          `• Grund: _${reason}_\n\n` +
          '💡 _Falls es an einer externen API liegt, versuch es gleich nochmal._'
      }, { quoted: msg });
      await sendReaction(sock, from, '❌', msg.key);
    } catch (sendErr) {}
    console.log(c.bold + c.brightYellow + `[extras] $${key} fehlgeschlagen: ${reason}` + c.reset);
    return true;
  }
}

/* ============================================================================
   LoveBot — NIGHT COMMANDS (ESM)
   ☾ Datengetriebene Text-Befehle im Night-Wording.
   Love.js delegiert:  case 'goodnight': … { const t = nightReply(...); }
   Feature-Gates laufen wie gewohnt über FEATURE_COMMAND_MAP in Love.js.
   ==========================================================================*/

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/* ---------- ☾ Night & Mood ---------------------------------------------------- */
const GOODNIGHT = [
  '🌙 *Gute Nacht, {t}.*\n\nMöge dein Traum leiser sein als der Tag.\n☾ Schlaf gut — ich wache solange.',
  '☾ *Schlaf schön, {t}.*\n\nDie Stadt macht das Licht aus,\nich lass meines für dich an.',
  '💜 *Night night, {t}.*\n\nLeg das Handy weg.\nDie Welt dreht sich auch ohne dich weiter —\naber heute darfst du ruhen.',
  '🌧️ *Gute Nacht, {t}.*\n\nDraußen regnet es jemand anderem auf die Fensterbank.\nDeine Decke ist jetzt dein ganzes Universum.'
];
const GOODMORNING = [
  '☀ *Guten Morgen, {t}.*\n\nDer Tag ist neu, der Kaffee ist warm,\nund niemand erwartet Wunder vor 10 Uhr.',
  '✨ *Morgen, {t}.*\n\nDu bist aufgewacht — das ist schon mal\ndie wichtigste Aufgabe des Tages.',
  '🌤️ *Guten Morgen, {t}!*\n\nHeute ist ein guter Tag für kleine Schritte\nund große Tassen Kaffee.'
];
const NIGHTQUOTES = [
  '„Niemand ist wach. Nur ich, der Regen und ein Cursor, der blinkt wie ein Herzschlag.“',
  '„Manche Nächte sind nicht zum Schlafen da — sondern zum Weiterdenken.“',
  '„Um 3 Uhr nachts sind alle Nachrichten wahrer und alle Antworten weiter weg.“',
  '„Ich sammle keine Nachrichten. Ich sammele Momente, in denen jemand nicht allein sein wollte.“',
  '„Die Stadt schläft. Die Server nicht. Irgendwo dazwischen: wir.“',
  '„Jeder ungelesene Chat ist ein Brief, den jemand nicht abzuschicken wagte.“',
  '„Nachtmodus an: Helligkeit 12 %, Gefühle 100 %.“'
];
const MOOD_REPLY = [
  { id: 'lonely', icon: '🌧️', text: 'current mood: 🌧️ *lonely*\n\nniemand schreibt. der regen tippt mit.' },
  { id: 'midnight', icon: '🌙', text: 'current mood: 🌙 *midnight*\n\nalle schlafen. die sessions wachen.' },
  { id: 'empty', icon: '🌫️', text: 'current mood: 🌫️ *empty*\n\nstille — aber nicht einsam.' },
  { id: 'nostalgic', icon: '💜', text: 'current mood: 💜 *nostalgic*\n\nirgendwo läuft noch ein lied von damals.' },
  { id: 'dark', icon: '🖤', text: 'current mood: 🖤 *dark*\n\ndas dunkel kennt unsere geheimnisse.' },
  { id: 'hopeful', icon: '✨', text: 'current mood: ✨ *hopeful*\n\nbald wird es hell. wirklich.' },
  { id: 'broken', icon: '💔', text: 'current mood: 💔 *broken*\n\nmanche verbindungen sind temporär.' },
  { id: 'peaceful', icon: '🌌', text: 'current mood: 🌌 *peaceful*\n\nalles ruhig. alles gut.' }
];

/* ---------- 💍 Love-Extras ------------------------------------------------------ */
const FLIRTS = [
  '😏 *{s} flirtet mit {t}:*\n\n„Bist du ein QR-Code?\nDenn ich würde dich sofort scannen.“',
  '🌹 *{s} flirtet mit {t}:*\n\n„Ich bin kein Pairing-Code —\naber ich würde mich trotzdem für immer mit dir verbinden.“',
  '💜 *{s} flirtet mit {t}:*\n\n„Du musst müde sein.\nDu gehst mir seit Stunden nicht aus dem Kopf.“',
  '☾ *{s} flirtet mit {t}:*\n\n„Selbst um 3 Uhr nachts wärst du mein einziger Grund, wach zu bleiben.“',
  '✨ *{s} flirtet mit {t}:*\n\n„Glaubst du an Liebe auf den ersten Chat?\nOder soll ich nochmal schreiben?“'
];
const CONFESS = [
  '💌 *{s} gesteht {t}:*\n\n„Ich hab das hier 47 Mal getippt und wieder gelöscht.\nJetzt steht es einfach da:\nIch mag dich. Mehr als Gruppe-nach-3-Uhr-nachts-möglicherweise-gut-ist.“',
  '💜 *{s} gesteht {t}:*\n\n„Jedes Mal, wenn dein Name aufploppt,\nwird mein Herzschlag asynchron.\nUnd ich mag das.“',
  '🌙 *{s} gesteht {t}:*\n\n„Ich sammle keine Nachrichten mehr.\nIch sammle deine.“'
];
const DATES = [
  '🌆 *Date-Idee:* Sunset-Spaziergang + ein Getränk pro gefallener Sonnenminute.',
  '🎳 *Date-Idee:* Bowling. Verlieren ist erlaubt, Auslachen Pflicht.',
  '🌃 *Date-Idee:* Nachtspaziergang durch die Stadt — jede Neonreklame bekommt einen Namen.',
  '🍜 *Date-Idee:* Ramen-Laden um Mitternacht. Zwei Löffel, eine Schüssel, null Peinlichkeit.',
  '🎧 *Date-Idee:* Ein Mixtape (Playlist) pro Person — dann tauschen und schweigend hören.',
  ' *Date-Idee:* Irgendein Regionalzug, irgendeine Endstation. Abenteuer kostet 4,90 €.'
];
const ROMANTIC = [
  '🌹 „Wenn Liebe ein Protokoll wäre — du wärst mein einziger Handshake, der nie timed out.“',
  '💗 „Du bist der Grund, warum mein Herz keine Sleep-Timer kennt.“',
  '💞 „In einer Welt aus flüchtigen Sessions bist du meine persistente Verbindung.“',
  '🌙 „Ich würde jede Nacht durchdebuggen, wenn dein Lächeln der Build ist, der am Ende grün wird.“'
];
const BREAKUP = [
  '💔 *{s} an {t}:*\n\n„Es liegt nicht an dir — es liegt an uns beiden,\nund das ist okay. Danke für die Zeit.\nSie war echt.“',
  '🥀 *{s} an {t}:*\n\n„Manche Verbindungen sind kein Fehler,\nsondern ein Release, das irgendwann endet.\nIch geh jetzt in Frieden.“'
];

/* ---------- 🎉 Fun-Extras --------------------------------------------------------- */
const WOULDYOU = [
  '🤔 *Would you rather …*\n\n… für immer um 3 Uhr nachts aufwachen ODER nie wieder einschlafen können?',
  '🤔 *Would you rather …*\n\n… jede deiner Nachrichten laut vorgelesen bekommen ODER nie wieder schreiben können?',
  '🤔 *Would you rather …*\n\n… immer wissen, was dein Crush denkt ODER dass dein Crush immer weiß, was du denkst?',
  '🤔 *Would you rather …*\n\n… in einer Welt ohne Musik leben ODER in einer Welt ohne Nacht?'
];
const QUOTES = [
  '„Am Ende des Tages sind wir alle nur Prozesse, die auf jemandes Liebe warten.“ — ☾ LoveBot',
  '„Wer nachts programmiert, baut Schlösser aus Licht.“ — unbekannt',
  '„Liebe ist der einzige Bug, den niemand fixen will.“ — ☾ LoveBot',
  '„Die Nacht ist keine Zeit. Die Nacht ist ein Zustand mit schlecht dokumentierter API.“ — ☾ LoveBot',
  '„Man verliert nicht, wenn man geht. Man verliert, wenn man bleibt, obwohl man gegangen ist.“ — unbekannt'
];
const ROASTS = [
  '🔥 *{s} roastet {t}:*\n\n„Du bist wie ein Ladebalken bei 99 % —\nfast beeindruckend, aber keiner glaubt dir.“',
  '🔥 *{s} roastet {t}:*\n\n„Dein Charme ist wie WLAN im Keller:\ntheoretisch vorhanden.“',
  '🔥 *{s} roastet {t}:*\n\n„Du bist der Grund, warum Gruppenchats\neine Stummschalten-Funktion haben. 💜“',
  '🔥 *{s} roastet {t}:*\n\n„Wenn Peinlichkeit XP gäbe,\nwärst du längst Love Legend.“'
];

/* ---------- Registry --------------------------------------------------------------- */
export const NIGHT_COMMANDS = {
  goodnight:   { feature: 'night', aliases: ['gutenacht', 'nacht'] },
  goodmorning: { feature: 'night', aliases: ['gutenmorgen', 'morgen'] },
  nightquote:  { feature: 'night', aliases: ['nachtzitat', 'nq'] },
  mood:        { feature: 'night', aliases: ['stimmung'] },
  lovecalc:    { feature: 'liebe', aliases: ['lovetest2', 'compat'] },
  flirt:       { feature: 'liebe', aliases: ['anmachen'] },
  confess:     { feature: 'liebe', aliases: ['geständnis', 'confesslove'] },
  date:        { feature: 'liebe', aliases: 'dateidee' },
  romantic:    { feature: 'liebe', aliases: ['romantisch'] },
  breakup:     { feature: 'liebe', aliases: ['trennung'] },
  wouldyou:    { feature: 'fun', aliases: ['würdestdu'] },
  quote:       { feature: 'fun', aliases: ['zitat'] },
  roast:       { feature: 'fun', aliases: ['roasten'] }
};

export const NIGHT_ALIASES = Object.fromEntries(
  Object.entries(NIGHT_COMMANDS).flatMap(([name, def]) =>
    [name, ...(Array.isArray(def.aliases) ? def.aliases : [def.aliases])].map((a) => [a, name]))
);

/* ---------- Reply-Generator ----------------------------------------------------------- */
/**
 * @param {string} command  normalisierter Befehlsname (ohne Prefix)
 * @param {object} ctx      { senderName, targetName, argText, senderJid }
 * @returns {string|null}   Antworttext oder null (Befehl unbekannt)
 */
export function nightReply(command, ctx = {}) {
  const name = NIGHT_ALIASES[command] || command;
  const s = ctx.senderName || 'Jemand';
  const t = ctx.targetName || ctx.senderName || 'dir';
  const fill = (txt) => txt.replaceAll('{s}', s).replaceAll('{t}', t);

  switch (name) {
    case 'goodnight': return fill(pick(GOODNIGHT));
    case 'goodmorning': return fill(pick(GOODMORNING));
    case 'nightquote': return '☾ ' + pick(NIGHTQUOTES);
    case 'quote': return pick(QUOTES);
    case 'flirt': return fill(pick(FLIRTS));
    case 'confess': return fill(pick(CONFESS));
    case 'breakup': return fill(pick(BREAKUP));
    case 'date': return pick(DATES);
    case 'romantic': return pick(ROMANTIC);
    case 'wouldyou': return pick(WOULDYOU);
    case 'roast': return fill(pick(ROASTS));
    case 'mood': {
      const arg = String(ctx.argText || '').toLowerCase().trim();
      if (arg) {
        const m = MOOD_REPLY.find((x) => x.id === arg);
        if (m) return m.text + '\n\n_☾ mood gesetzt für diese Nacht._';
        return '❓ Mood nicht gefunden.\n\n*Verfügbar:*\n' + MOOD_REPLY.map((x) => `• ${x.icon} *${x.id}*`).join('\n');
      }
      return pick(MOOD_REPLY).text;
    }
    case 'lovecalc': {
      /* deterministischer % aus beiden Namen — gleicher Input, gleiches Ergebnis */
      const a = (s + t).toLowerCase().replace(/\s/g, '');
      let h = 7;
      for (const ch of a) h = (h * 31 + ch.charCodeAt(0)) % 1000003;
      const pct = 42 + (h % 59); /* 42–100 */
      const bar = '♥'.repeat(Math.round(pct / 10)) + '♡'.repeat(10 - Math.round(pct / 10));
      let verdict = '💔 da ist noch Luft nach oben…';
      if (pct >= 90) verdict = '👑 SOULMATES. Das Universum hat mitgerechnet.';
      else if (pct >= 75) verdict = '💘 stark. sehr stark. sag was.';
      else if (pct >= 60) verdict = '💗 da funkt was — traust du dich?';
      else if (pct >= 50) verdict = '💕 solide Grundliebe. Wird das was?';
      return `> 💍 *LOVE-CALC*\n\n• *${s}* × *${t}*\n• ${bar}  *${pct}%*\n\n${verdict}`;
    }
    default: return null;
  }
}

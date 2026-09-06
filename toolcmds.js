/* ═══════════════════════════════════════════════════════════════════════
   🧭 L O V E B O T   A L L T A G S - T O O L S   (toolcmds.js)
   ─────────────────────────────────────────────────────────────────────
   Sechs nützliche Befehle für den Alltag — alle mit ECHTEN Daten aus
   freien APIs (keine Platzhalter, keine erfundenen Werte):

     $wetter <stadt>              · Open-Meteo (Geocoding + Forecast)
     $währung <betrag> <von> [zu] · Frankfurter API (EZB-Referenzkurse)
     $übersetze <zielsprache> …   · MyMemory Translation
     $qr <text>                   · goqr.me (QR-Code als PNG)
     $kurz <url>                  · TinyURL / is.gd (URL-Shortener)
     $passwort [länge]            · crypto.randomBytes (echter Zufall)

   Wenn eine API nicht erreichbar ist, sagt der Bot das ehrlich —
   statt irgendwelche Werte zu erfinden.
   ═══════════════════════════════════════════════════════════════════════ */

import crypto from 'node:crypto';
import { reactions, sendReaction } from './waApi.js';
import c from './colorApi.js';

/* ─────────────────────────────────────────────────────────────────────
   Befehlsnamen (müssen zu registry/commands.json passen)
   ───────────────────────────────────────────────────────────────────── */

export const TOOL_COMMANDS = new Set([
  'wetter', 'weather',
  'währung', 'waehrung', 'currency', 'cur', 'wechselkurs',
  'übersetze', 'uebersetze', 'translate', 'übersetzer', 'uebersetzer', 'tr',
  'qr', 'qrcode',
  'kurz', 'kuerz', 'short', 'shorten', 'tiny',
  'passwort', 'password', 'pw', 'pwd'
]);

/* ─────────────────────────────────────────────────────────────────────
   Kleine Helfer
   ───────────────────────────────────────────────────────────────────── */

async function jget(url, timeoutMs = 12000) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { 'user-agent': 'LoveBot/1.0 (+tools)', accept: 'application/json' }
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

async function tget(url, timeoutMs = 12000) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { 'user-agent': 'LoveBot/1.0 (+tools)', accept: '*/*' }
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return (await res.text()).trim();
}

function quotedText(quoted) {
  if (!quoted) return '';
  return quoted.conversation || quoted.extendedTextMessage?.text || quoted.imageMessage?.caption || '';
}

/* WMO-Wettercodes → deutscher Text + Emoji (Open-Meteo) */
const WMO = {
  0: ['☀️', 'Klar'], 1: ['🌤️', 'Überwiegend klar'], 2: ['⛅', 'Teilweise bewölkt'], 3: ['☁️', 'Bedeckt'],
  45: ['🌫️', 'Nebel'], 48: ['🌫️', 'Reifnebel'],
  51: ['🌦️', 'Leichter Nieselregen'], 53: ['🌦️', 'Nieselregen'], 55: ['🌧️', 'Starker Nieselregen'],
  56: ['🌧️', 'Gefrierender Nieselregen'], 57: ['🌧️', 'Starker gefrierender Nieselregen'],
  61: ['🌦️', 'Leichter Regen'], 63: ['🌧️', 'Regen'], 65: ['🌧️', 'Starker Regen'],
  66: ['🌧️', 'Gefrierender Regen'], 67: ['🌧️', 'Starker gefrierender Regen'],
  71: ['🌨️', 'Leichter Schneefall'], 73: ['🌨️', 'Schneefall'], 75: ['❄️', 'Starker Schneefall'],
  77: ['🌨️', 'Schneegriesel'],
  80: ['🌦️', 'Leichte Regenschauer'], 81: ['🌧️', 'Regenschauer'], 82: ['🌧️', 'Heftige Regenschauer'],
  85: ['🌨️', 'Leichte Schneeschauer'], 86: ['🌨️', 'Starke Schneeschauer'],
  95: ['⛈️', 'Gewitter'], 96: ['⛈️', 'Gewitter mit Hagel'], 99: ['⛈️', 'Gewitter mit starkem Hagel']
};
const wmo = (code) => WMO[Number(code)] || ['🌡️', 'Unbekannt (' + code + ')'];

const CURRENCY_NAMES = {
  eur: 'Euro', usd: 'US-Dollar', chf: 'Schweizer Franken', gbp: 'Britisches Pfund',
  try: 'Türkische Lira', tr: 'Türkische Lira', tl: 'Türkische Lira',
  jpy: 'Japanischer Yen', cny: 'Chinesischer Yuan', aud: 'Australischer Dollar',
  cad: 'Kanadischer Dollar', sek: 'Schwedische Krone', nok: 'Norwegische Krone',
  dkk: 'Dänische Krone', pln: 'Polnischer Zloty', czk: 'Tschechische Krone',
  huf: 'Ungarischer Forint', ron: 'Rumänischer Leu', bgn: 'Bulgarischer Lew',
  ils: 'Israelischer Schekel', zar: 'Südafrikanischer Rand', brl: 'Brasilianischer Real',
  mxn: 'Mexikanischer Peso', inr: 'Indische Rupie', krw: 'Südkoreanischer Won',
  sgd: 'Singapur-Dollar', hkd: 'Hongkong-Dollar', nzd: 'Neuseeland-Dollar',
  rub: 'Russischer Rubel', uah: 'Ukrainische Hrywnja', thb: 'Thai-Baht',
  idr: 'Indonesische Rupiah', myr: 'Malaysischer Ringgit', php: 'Philippinischer Peso'
};
const SYMBOL_TO_CODE = { '€': 'EUR', '$': 'USD', '£': 'GBP', '¥': 'JPY', '₺': 'TRY', 'fr': 'CHF' };

const LANG_NAMES = {
  de: 'de', deutsch: 'de', german: 'de', ger: 'de',
  en: 'en', englisch: 'en', english: 'en', eng: 'en',
  tr: 'tr', türkisch: 'tr', tuerkisch: 'tr', turkish: 'tr',
  es: 'es', spanisch: 'es', spanish: 'es',
  fr: 'fr', französisch: 'fr', franzoesisch: 'fr', french: 'fr',
  it: 'it', italienisch: 'it', italian: 'it',
  nl: 'nl', niederländisch: 'nl', niederlaendisch: 'nl', holländisch: 'nl', dutch: 'nl',
  pl: 'pl', polnisch: 'pl', polish: 'pl',
  pt: 'pt', portugiesisch: 'pt', portuguese: 'pt',
  ru: 'ru', russisch: 'ru', russian: 'ru',
  ar: 'ar', arabisch: 'ar', arabic: 'ar',
  ja: 'ja', japanisch: 'ja', japanese: 'ja',
  zh: 'zh', chinesisch: 'zh', chinese: 'zh'
};
function langName(code) {
  const k = String(code || '').toLowerCase();
  return LANG_NAMES[k] || (k.length === 2 ? k : null);
}

/* ─────────────────────────────────────────────────────────────────────
   1) $wetter
   ───────────────────────────────────────────────────────────────────── */

async function cmdWetter({ sock, from, msg, args, quoted }) {
  const q = args.join(' ').trim() || quotedText(quoted);
  if (!q) {
    await sock.sendMessage(from, {
      text: '> 🌤️ *WETTER — VERWENDUNG*\n\n' +
        '• `$wetter <stadt>`\n' +
        '• oder eine Nachricht mit dem Ortsnamen zitieren\n\n' +
        '_Beispiel:_ `$wetter Kerkrade`\n' +
        '📡 _Echte Daten von Open-Meteo_'
    }, { quoted: msg });
    return true;
  }

  const geoUrl = 'https://geocoding-api.open-meteo.com/v1/search?count=1&language=de&format=json&name=' + encodeURIComponent(q);
  const geo = await jget(geoUrl);
  const place = geo?.results?.[0];
  if (!place) {
    await sock.sendMessage(from, {
      text: `> ❌ *ORT NICHT GEFUNDEN*\n\n• Gesucht: _${q}_\n\n💡 _Versuche es mit dem Ortsnamen ohne Zusatz (z. B. „Kerkrade“)._`
    }, { quoted: msg });
    return true;
  }

  const wUrl = 'https://api.open-meteo.com/v1/forecast' +
    `?latitude=${place.latitude}&longitude=${place.longitude}` +
    '&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_gusts_10m' +
    '&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max' +
    '&timezone=auto&forecast_days=2';
  const w = await jget(wUrl);
  const cur = w?.current || {};
  const day = w?.daily || {};
  const [emoji, text] = wmo(cur.weather_code);

  const placeName = [place.name, place.admin1, place.country].filter(Boolean).join(', ');
  const lines = [
    '╔══════════════════════════════╗',
    '║   🌤️  W E T T E R            ║',
    '╚══════════════════════════════╝',
    '',
    `📍 *${placeName}*`,
    '',
    `${emoji} *${text}*`,
    `🌡️ *${cur.temperature_2m} °C* _(gefühlt ${cur.apparent_temperature} °C)_`,
    `📅 Heute: ${day.temperature_2m_max?.[0]}° / ${day.temperature_2m_min?.[0]}° _(max/min)_`,
    (day.precipitation_probability_max?.[0] != null ? `🌧️ Regen: ${day.precipitation_probability_max[0]} % _(Niederschlag ${day.precipitation_sum?.[0]} mm)_` : ''),
    `💧 Luftfeuchte: ${cur.relative_humidity_2m} % · ☁️ Bewölkung: ${cur.cloud_cover} %`,
    `💨 Wind: ${cur.wind_speed_10m} km/h _(Böen ${cur.wind_gusts_10m} km/h)_`,
    `🔽 Luftdruck: ${cur.pressure_msl} hPa`,
    '',
    `🕐 Stand: ${String(cur.time || '').replace('T', ' ')} _(${w.timezone_abbreviation || w.timezone})_`,
    `🧭 ${place.latitude.toFixed(2)}, ${place.longitude.toFixed(2)}`,
    '',
    '📡 _Echte Daten · Open-Meteo_'
  ].filter(Boolean);

  await sock.sendMessage(from, { text: lines.join('\n') }, { quoted: msg });
  return true;
}

/* ─────────────────────────────────────────────────────────────────────
   2) $währung
   ───────────────────────────────────────────────────────────────────── */

function parseCurrencyToken(raw = '') {
  let t = String(raw).trim().toLowerCase();
  if (!t) return null;
  for (const [sym, code] of Object.entries(SYMBOL_TO_CODE)) {
    if (t === sym) return code;
  }
  t = t.replace(/[^a-z]/g, '');
  if (t.length === 3) return t.toUpperCase();
  return null;
}

async function cmdWaehrung({ sock, from, msg, args, quoted }) {
  const text = args.join(' ').trim() || quotedText(quoted);
  const tokens = text.split(/\s+/).filter(Boolean);

  /* $währung liste — verfügbare Währungen */
  if (tokens.length && /^(liste|list|kurse|alle)$/i.test(tokens[0])) {
    const data = await jget('https://api.frankfurter.dev/v1/currencies');
    const codes = Object.keys(data || {});
    await sock.sendMessage(from, {
      text: '> 💱 *VERFÜGBARE WÄHRUNGEN*\n\n' +
        codes.map((k) => `${k} _(${data[k]})_`).join(' · ') +
        `\n\n📡 _${codes.length} Währungen · Frankfurter API (EZB)_`
    }, { quoted: msg });
    return true;
  }

  let amount = null, fromCur = null, toCur = null;
  if (tokens.length >= 3) {
    amount = Number(String(tokens[0]).replace(',', '.'));
    fromCur = parseCurrencyToken(tokens[1]);
    toCur = parseCurrencyToken(tokens[2]);
  } else if (tokens.length === 2) {
    /* „10 eur“ → Ziel Standard USD · „eur usd“ → 1 Einheit */
    const a = Number(String(tokens[0]).replace(',', '.'));
    if (isFinite(a)) { amount = a; fromCur = parseCurrencyToken(tokens[1]); toCur = 'USD'; }
    else { amount = 1; fromCur = parseCurrencyToken(tokens[0]); toCur = parseCurrencyToken(tokens[1]); }
  } else if (tokens.length === 1) {
    const a = Number(String(tokens[0]).replace(',', '.'));
    if (isFinite(a)) { amount = a; fromCur = 'EUR'; toCur = 'USD'; }
  }

  if (!isFinite(amount) || amount <= 0 || !fromCur || !toCur) {
    await sock.sendMessage(from, {
      text: '> 💱 *WÄHRUNG — VERWENDUNG*\n\n' +
        '• `$währung <betrag> <von> <nach>`\n' +
        '• `$währung 50 EUR TRY` · `$währung 10 €` _(→ USD)_ · `$währung eur usd`\n' +
        '• `$währung liste` — alle Währungen\n\n' +
        '📡 _Echte Kurse · Frankfurter API (EZB-Referenzkurse)_'
    }, { quoted: msg });
    return true;
  }
  if (fromCur === toCur) {
    await sock.sendMessage(from, { text: `> 💱 ${amount} ${fromCur} = ${amount} ${toCur} _(gleiche Währung)_` }, { quoted: msg });
    return true;
  }

  const data = await jget(`https://api.frankfurter.dev/v1/latest?base=${encodeURIComponent(fromCur)}&symbols=${encodeURIComponent(toCur)}`);
  const rate = data?.rates?.[toCur];
  if (typeof rate !== 'number') throw new Error('Kurs nicht verfügbar');
  const result = Math.round(rate * amount * 100) / 100;

  const fName = CURRENCY_NAMES[fromCur.toLowerCase()] || fromCur;
  const tName = CURRENCY_NAMES[toCur.toLowerCase()] || toCur;

  await sock.sendMessage(from, {
    text: '╔══════════════════════════════╗\n' +
      '║   💱  W Ä H R U N G          ║\n' +
      '╚══════════════════════════════╝\n\n' +
      `*${amount} ${fromCur}*  ›  *${result} ${toCur}*\n\n` +
      `• Kurs: 1 ${fromCur} = ${rate} ${toCur}\n` +
      `• ${fName} → ${tName}\n` +
      `• Stand: ${data.date || '—'}\n\n` +
      '📡 _Echte EZB-Referenzkurse · Frankfurter API_'
  }, { quoted: msg });
  return true;
}

/* ─────────────────────────────────────────────────────────────────────
   3) $übersetze
   ───────────────────────────────────────────────────────────────────── */

async function cmdTranslate({ sock, from, msg, args, quoted }) {
  const raw = args.join(' ').trim() || quotedText(quoted);
  if (!raw) {
    await sock.sendMessage(from, {
      text: '> 🌍 *ÜBERSETZEN — VERWENDUNG*\n\n' +
        '• `$übersetze <sprache> <text>`\n' +
        '• `$übersetze en Guten Morgen`\n' +
        '• `$übersetze tr|en …` _(von → nach)_\n' +
        '• oder Text zitieren: `$übersetze en`\n\n' +
        '🌐 _Sprachen: de, en, tr, es, fr, it, nl, pl, pt, ru, ar, ja, zh …_\n' +
        '📡 _MyMemory Translation_'
    }, { quoted: msg });
    return true;
  }

  let pair = null, text = raw;
  const first = raw.split(/\s+/)[0];
  const pipeMatch = first.match(/^([a-zA-Z]{2})\|([a-zA-Z]{2})$/);
  if (pipeMatch) {
    pair = `${pipeMatch[1].toLowerCase()}|${pipeMatch[2].toLowerCase()}`;
    text = raw.slice(first.length).trim();
  } else {
    const target = langName(first);
    if (target) {
      pair = `de|${target}`;
      text = raw.slice(first.length).trim();
    }
  }
  if (!pair || !text) {
    await sock.sendMessage(from, {
      text: '> ❌ *ZIELSPRACHE FEHLT*\n\nNutze z. B. `$übersetze en Hallo Welt` oder `$übersetze de|en Hallo Welt`.'
    }, { quoted: msg });
    return true;
  }
  if (text.length > 450) text = text.slice(0, 450);

  const data = await jget(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(pair)}`, 15000);
  if (String(data?.responseStatus) !== '200') {
    throw new Error(data?.responseDetails || 'Übersetzungsdienst antwortet nicht');
  }

  /* MyMemory liefert die Übersetzung mal in responseData, mal nur in den
     Treffern — beides wird berücksichtigt (echter Wert, nie geraten). */
  const matches = Array.isArray(data.matches) ? data.matches : [];
  let translation = String(data?.responseData?.translatedText || '').trim();
  let match = matches[0] || null;
  if (!translation) {
    const hit = matches.find((m) => m && String(m.translation || '').trim());
    if (hit) { match = hit; translation = String(hit.translation).trim(); }
  }
  if (!translation) throw new Error('Keine Übersetzung für diese Sprache erhalten');

  const [pairFrom, pairTo] = pair.split('|');
  const shownFrom = (match?.source || pairFrom || '?').toUpperCase().replace(/-.*$/, '');
  const shownTo = (match?.target || pairTo || '?').toUpperCase().replace(/-.*$/, '');
  const quality = match?.quality != null ? `${match.quality} %` : null;

  await sock.sendMessage(from, {
    text: '╔══════════════════════════════╗\n' +
      '║   🌍  Ü B E R S E T Z U N G  ║\n' +
      '╚══════════════════════════════╝\n\n' +
      `*${shownFrom} › ${shownTo}*\n\n` +
      `${String(text).slice(0, 300)}\n` +
      `↳ *${translation.slice(0, 600)}*\n\n` +
      (quality ? `• Qualität: ${quality}\n` : '') +
      (data.responseData.match != null ? `• Match: ${Math.round(Number(data.responseData.match) * 100)} %\n` : '') +
      '\n📡 _MyMemory Translation (echt)_'
  }, { quoted: msg });
  return true;
}

/* ─────────────────────────────────────────────────────────────────────
   4) $qr
   ───────────────────────────────────────────────────────────────────── */

async function cmdQr({ sock, from, msg, args, quoted }) {
  const data = args.join(' ').trim() || quotedText(quoted);
  if (!data) {
    await sock.sendMessage(from, {
      text: '> 🔳 *QR-CODE — VERWENDUNG*\n\n' +
        '• `$qr <text oder link>`\n' +
        '• oder eine Nachricht zitieren und `$qr` schreiben\n\n' +
        '_Beispiel:_ `$qr https://github.com/maxikstrr/LoveBot`\n' +
        '📡 _Erzeugt über goqr.me_'
    }, { quoted: msg });
    return true;
  }
  if (data.length > 900) {
    await sock.sendMessage(from, {
      text: `> ❌ *ZU LANG*\n\nDein Text hat ${data.length} Zeichen — maximal sind 900 möglich.`
    }, { quoted: msg });
    return true;
  }

  const url = 'https://api.qrserver.com/v1/create-qr-code/?size=512x512&margin=8&format=png&data=' + encodeURIComponent(data);
  /* Erst prüfen, ob der Dienst antwortet — sonst keine kaputte Bildnachricht */
  const head = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(15000) });
  if (!head.ok || !String(head.headers?.get('content-type') || '').includes('image')) {
    throw new Error('QR-Dienst antwortet nicht (HTTP ' + head.status + ')');
  }

  const preview = data.length > 60 ? data.slice(0, 60) + '…' : data;
  await sock.sendMessage(from, {
    image: { url },
    caption: '╔══════════════════════════════╗\n' +
      '║   🔳  Q R  ·  C O D E        ║\n' +
      '╚══════════════════════════════╝\n\n' +
      `• Inhalt: ${preview}\n` +
      `• Länge: ${data.length} Zeichen\n` +
      '• Größe: 512 × 512 px\n\n' +
      '📡 _Erzeugt über goqr.me_'
  }, { quoted: msg });
  return true;
}

/* ─────────────────────────────────────────────────────────────────────
   5) $kurz
   ───────────────────────────────────────────────────────────────────── */

async function cmdKurz({ sock, from, msg, args, quoted }) {
  const raw = args.join(' ').trim() || quotedText(quoted);
  if (!raw) {
    await sock.sendMessage(from, {
      text: '> 🔗 *LINK-KÜRZER — VERWENDUNG*\n\n' +
        '• `$kurz <url>`\n' +
        '• oder einen Link zitieren und `$kurz` schreiben\n\n' +
        '_Beispiel:_ `$kurz https://github.com/maxikstrr/LoveBot`\n' +
        '📡 _TinyURL · Fallback is.gd_'
    }, { quoted: msg });
    return true;
  }

  let normalized = raw.trim();
  if (!/^https?:\/\//i.test(normalized)) normalized = 'https://' + normalized.replace(/^\/+/, '');
  let parsed;
  try { parsed = new URL(normalized); } catch (e) {
    await sock.sendMessage(from, { text: '> ❌ *UNGÜLTIGE URL*\n\nBitte gib eine vollständige Adresse an, z. B. https://example.com' }, { quoted: msg });
    return true;
  }
  if (!/^https?:$/.test(parsed.protocol)) {
    await sock.sendMessage(from, { text: '> ❌ *UNGÜLTIGES PROTOKOLL*\n\nNur http:// und https:// sind erlaubt.' }, { quoted: msg });
    return true;
  }

  let short = null, service = '';
  try {
    short = await tget('https://tinyurl.com/api-create.php?url=' + encodeURIComponent(normalized), 12000);
    service = 'TinyURL';
  } catch (e) {
    try {
      short = await tget('https://is.gd/create.php?format=simple&url=' + encodeURIComponent(normalized), 12000);
      service = 'is.gd';
    } catch (e2) {
      throw new Error('Shortener nicht erreichbar');
    }
  }
  if (!short || !/^https?:\/\//i.test(short)) throw new Error('Shortener hat keine URL geliefert');

  await sock.sendMessage(from, {
    text: '╔══════════════════════════════╗\n' +
      '║   🔗  K U R Z L I N K        ║\n' +
      '╚══════════════════════════════╝\n\n' +
      `• Original: ${normalized}\n` +
      `• *Kurz:* ${short}\n\n` +
      `• Länge: ${normalized.length} › ${short.length} Zeichen\n` +
      `• Dienst: ${service}\n\n` +
      '📡 _Echt gekürzt_'
  }, { quoted: msg });
  return true;
}

/* ─────────────────────────────────────────────────────────────────────
   6) $passwort
   ───────────────────────────────────────────────────────────────────── */

const PWD_LOWER = 'abcdefghijkmnopqrstuvwxyz';
const PWD_UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const PWD_DIGIT = '23456789';
const PWD_SYMBOL = '!@#$%&*+-_=?';

function randomFrom(set) {
  return set[crypto.randomInt(0, set.length)];
}

function makePassword(length) {
  const pool = PWD_LOWER + PWD_UPPER + PWD_DIGIT + PWD_SYMBOL;
  const chars = [
    randomFrom(PWD_LOWER), randomFrom(PWD_UPPER),
    randomFrom(PWD_DIGIT), randomFrom(PWD_SYMBOL)
  ];
  for (let i = chars.length; i < length; i++) chars.push(randomFrom(pool));
  /* Kryptografisch mischen (Fisher-Yates mit crypto.randomInt) */
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  const password = chars.join('');
  const entropyBits = Math.round(length * Math.log2(pool.length));
  return { password, entropyBits, poolSize: pool.length };
}

async function cmdPasswort({ sock, from, msg, args }) {
  const requested = Number(String(args[0] || '').replace(/[^\d]/g, ''));
  const length = Math.min(64, Math.max(8, isFinite(requested) && requested > 0 ? requested : 16));
  const { password, entropyBits, poolSize } = makePassword(length);

  let strength = '🔓 Schwach';
  if (entropyBits >= 128) strength = '🛡️ Sehr stark';
  else if (entropyBits >= 90) strength = '🔒 Stark';
  else if (entropyBits >= 60) strength = '🔑 Okay';

  await sock.sendMessage(from, {
    text: '╔══════════════════════════════╗\n' +
      '║   🔐  P A S S W O R T        ║\n' +
      '╚══════════════════════════════╝\n\n' +
      '```' + password + '```\n\n' +
      `• Länge: ${length} Zeichen\n` +
      `• Zeichenpool: ${poolSize} (a-z, A-Z, 0-9, Sonderzeichen)\n` +
      `• Entropie: ≈ ${entropyBits} Bit · ${strength}\n` +
      `• Erzeugt mit: crypto.randomBytes / randomInt\n\n` +
      '⚠️ _Passwort nach dem Kopieren löschen — es wird nicht gespeichert._'
  }, { quoted: msg });
  return true;
}

/* ─────────────────────────────────────────────────────────────────────
   DISPATCH
   ───────────────────────────────────────────────────────────────────── */

const HANDLERS = {
  wetter: cmdWetter, weather: cmdWetter,
  währung: cmdWaehrung, waehrung: cmdWaehrung, currency: cmdWaehrung, cur: cmdWaehrung, wechselkurs: cmdWaehrung,
  übersetze: cmdTranslate, uebersetze: cmdTranslate, translate: cmdTranslate,
  übersetzer: cmdTranslate, uebersetzer: cmdTranslate, tr: cmdTranslate,
  qr: cmdQr, qrcode: cmdQr,
  kurz: cmdKurz, kuerz: cmdKurz, short: cmdKurz, shorten: cmdKurz, tiny: cmdKurz,
  passwort: cmdPasswort, password: cmdPasswort, pw: cmdPasswort, pwd: cmdPasswort
};

/**
 * Führt einen Alltags-Tool-Befehl aus.
 * @returns {Promise<boolean>} true, wenn der Befehl zu diesem Modul gehört
 */
export async function handleToolCommand({ sock, msg, from, args = [], command = '', pref = '$', quoted = null }) {
  const key = String(command || '').toLowerCase();
  const handler = HANDLERS[key];
  if (!handler) return false;

  try {
    await handler({ sock, msg, from, args, quoted, pref });
    await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
    console.log(c.bold + c.brightCyan + `[tools] $${key} ausgeführt.` + c.reset);
    return true;
  } catch (err) {
    const reason = String(err?.message || err).slice(0, 160);
    try {
      await sock.sendMessage(from, {
        text: '> ❌ *TOOL-FEHLER*\n\n' +
          `• Befehl: *$${key}*\n` +
          `• Grund: _${reason}_\n\n` +
          '💡 _Der externe Dienst ist eventuell gerade nicht erreichbar — versuch es gleich nochmal._'
      }, { quoted: msg });
      await sendReaction(sock, from, '❌', msg.key);
    } catch (sendErr) {}
    console.log(c.bold + c.brightYellow + `[tools] $${key} fehlgeschlagen: ${reason}` + c.reset);
    return true;
  }
}

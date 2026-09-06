/* ═══════════════════════════════════════════════════════════════════════
   🔒 L O V E B O T   P R I V A C Y   (privacy.js)
   ─────────────────────────────────────────────────────────────────────
   Ziel: aus dem Spaß-Profil kein Datenschutz-Problem machen.
   Der Bot läuft in Gruppen — also können Minderjährige dabei sein.

   Regeln (alle zentral an EINER Stelle):
     1. Unter 13         → keine Registrierung.
     2. Unter 18         → kein exaktes Alter, nur die Spanne „unter 18“.
                           Stadt wird in Gruppen immer maskiert angezeigt.
     3. Stadt            → optional, wird außerhalb privater Chats
                           standardmäßig maskiert („K●●●●●●●“).
     4. Öffentliches Profil / Website-Anzeige → nur mit Opt-in
                           UND nie für Minderjährige.
     5. Nutzer kann jederzeit $privacy stadt/alter/profil an|aus stellen.

   Alle Bestandsprofile werden mit scripts/migrate-privacy.mjs
   nachgezogen (exaktes Alter bei Minderjährigen wird entfernt).
   ═══════════════════════════════════════════════════════════════════════ */

import { reactions, sendReaction } from './waApi.js';

export const MIN_AGE = 13;
export const ADULT_AGE = 18;

/* ─────────────────────────────────────────────────────────────────────
   Normalisierung / Validierung
   ───────────────────────────────────────────────────────────────────── */

function cleanName(raw = '') {
  return String(raw || '').replace(/[^\p{L}\p{N} ._-]/gu, '').trim().slice(0, 24);
}
function cleanText(raw = '', max = 30) {
  return String(raw || '').replace(/[\r\n\t]/g, ' ').replace(/[`*_~|]/g, '').trim().slice(0, max);
}

/**
 * Baut ein datenschutzfreundliches Registrierungsobjekt.
 * @param {{name:string, age:string, status:string, city:string}} raw
 * @returns {{ok:true, registration:object} | {ok:false, error:string}}
 */
export function normalizeRegistration(raw = {}) {
  const name = cleanName(raw.name);
  if (name.length < 2) return { ok: false, error: 'invalidName' };

  const status = cleanText(raw.status, 20);            /* Beziehungsstatus (Spaß-Feld) */
  const cityRaw = cleanText(raw.city, 40);             /* optional                     */

  /* Alter: optional. Aus Zahlen wird eine Spanne, kein exaktes Alter für Minderjährige. */
  const ageRaw = String(raw.age ?? '').trim();
  let age = null;
  let ageBracket = 'unknown';

  if (ageRaw && /^\d{1,3}$/.test(ageRaw)) {
    const n = Number(ageRaw);
    if (n < MIN_AGE) return { ok: false, error: 'tooYoung' };
    if (n > 120) return { ok: false, error: 'invalidAge' };
    if (n < ADULT_AGE) {
      ageBracket = 'minor';       /* exaktes Alter wird NICHT gespeichert */
    } else {
      ageBracket = 'adult';
      age = n;                    /* Erwachsene dürfen ihr Alter zeigen   */
    }
  } else if (ageRaw) {
    /* Freitext wie „18+“ oder „unter 18“ */
    const lower = ageRaw.toLowerCase();
    if (/(unter|u18|<18|minor)/.test(lower)) ageBracket = 'minor';
    else if (/(18\+|über 18|adult|erwachsen)/.test(lower)) ageBracket = 'adult';
  }

  return {
    ok: true,
    registration: {
      registered: true,
      name,
      age,                 /* null bei Minderjährigen / keiner Angabe */
      ageBracket,          /* 'minor' | 'adult' | 'unknown'           */
      status,
      city: cityRaw || null,
      privacy: { hideCity: false, hideAge: false, publicProfile: false },
      registeredAt: new Date().toISOString()
    }
  };
}

/** Bestandsdaten auf das neue Format heben (idempotent). */
export function migrateRegistration(reg = {}) {
  const out = { ...(reg || {}) };
  const privacy = { hideCity: false, hideAge: false, publicProfile: false, ...(out.privacy || {}) };

  let age = out.age ?? null;
  let bracket = out.ageBracket || 'unknown';

  const numeric = typeof age === 'number' ? age : (typeof age === 'string' && /^\d{1,3}$/.test(age) ? Number(age) : null);
  if (numeric != null) {
    if (numeric < ADULT_AGE) {
      age = null;                       /* exaktes Alter von Minderjährigen löschen */
      bracket = numeric < MIN_AGE ? 'minor' : 'minor';
    } else {
      age = numeric;
      bracket = 'adult';
    }
  } else if (typeof age === 'string' && age.trim() && !/^\d+$/.test(age.trim())) {
    age = null;
  } else if (age === '' || age === null) {
    age = null;
  }

  out.age = age;
  out.ageBracket = bracket;
  out.privacy = privacy;
  if (out.city === '' ) out.city = null;
  return out;
}

/* ─────────────────────────────────────────────────────────────────────
   Anzeige-Helfer
   ───────────────────────────────────────────────────────────────────── */

/** „Recklinghausen“ → „R●●●●●●●●●●●●●“ */
export function maskCity(city) {
  const s = String(city || '').trim();
  if (!s) return null;
  if (s.length <= 2) return s[0].toUpperCase() + '●';
  return s[0].toUpperCase() + '●'.repeat(s.length - 1);
}

export function isMinor(reg = {}) {
  return reg?.ageBracket === 'minor';
}

/** Alter: bei Minderjährigen NIE die exakte Zahl. */
export function ageLabel(reg = {}, { reveal = true } = {}) {
  if (isMinor(reg)) return 'unter 18';
  if (reg?.privacy?.hideAge) return 'nicht angegeben';
  if (!reveal) return reg?.ageBracket === 'adult' ? '18+' : 'nicht angegeben';
  if (reg?.age == null || reg?.age === '') return 'nicht angegeben';
  return String(reg.age);
}

/** Stadt: maskiert, wenn versteckt oder wenn es nicht der private Chat ist. */
export function cityLabel(reg = {}, { privateChat = false } = {}) {
  const city = reg?.city;
  if (!city) return 'nicht angegeben';
  if (reg?.privacy?.hideCity) return 'nicht angegeben';
  if (!privateChat) return maskCity(city);
  return city;
}

/** Darf das Profil öffentlich (Website / öffentliches Profil) gezeigt werden? */
export function publicProfileAllowed(reg = {}) {
  if (!reg?.registered) return false;
  if (isMinor(reg)) return false;                 /* Minderjährige: nie */
  return reg?.privacy?.publicProfile === true;    /* Erwachsene: Opt-in */
}

/* ─────────────────────────────────────────────────────────────────────
   $privacy — Nutzer steuert seine Sichtbarkeit selbst
   ───────────────────────────────────────────────────────────────────── */

const TOGGLES = {
  stadt: 'hideCity',
  city: 'hideCity',
  alter: 'hideAge',
  age: 'hideAge',
  profil: 'publicProfile',
  profile: 'publicProfile'
};

/**
 * @param {object} ctx { sock, msg, from, args, pref, userProfile, saveProfile }
 * @returns {Promise<boolean>} true = Befehl behandelt
 */
export async function handlePrivacyCommand({ sock, msg, from, args = [], pref = '$', userProfile, saveProfile, privateChat = false }) {
  const reg = migrateRegistration(userProfile?.registration || {});
  const sub = String(args[0] || '').toLowerCase();
  const value = String(args[1] || '').toLowerCase();

  const show = async () => {
    const lines = [
      '> 🔒 *LOVE BOT — PRIVATSPHÄRE*',
      '',
      `• Name: *${reg.name || '—'}*`,
      `• Alter: ${ageLabel(reg, { reveal: true })}${isMinor(reg) ? ' _(geschützt)_' : ''}`,
      `• Stadt: ${cityLabel(reg, { privateChat: true })} → in Gruppen: *${cityLabel(reg, { privateChat: false })}*`,
      `• Öffentliches Profil: ${publicProfileAllowed(reg) ? '✅ aktiv' : (isMinor(reg) ? '⛔ nicht möglich (unter 18)' : '☑️ aus')}`,
      '',
      `*Einstellungen:*`,
      `• \`${pref}privacy stadt an|aus\` — Stadt verstecken`,
      `• \`${pref}privacy alter an|aus\` — Alter verstecken`,
      `• \`${pref}privacy profil an|aus\` — öffentliches Profil (ab 18)`,
      '',
      '💡 _Minderjährige Profile werden nie öffentlich angezeigt und speichern kein exaktes Alter._'
    ];
    await sock.sendMessage(from, { text: lines.join('\n') }, { quoted: msg });
    return true;
  };

  if (!sub) return show();

  const field = TOGGLES[sub];
  if (!field) {
    await sock.sendMessage(from, {
      text: '> ❌ *UNBEKANNTE OPTION*\n\n' +
        `Nutze: \`${pref}privacy stadt an|aus\`, \`${pref}privacy alter an|aus\` oder \`${pref}privacy profil an|aus\`.`
    }, { quoted: msg });
    await sendReaction(sock, from, reactions.input.reactions.invalidInput, msg.key);
    return true;
  }

  if (!['an', 'aus', 'on', 'off', 'ja', 'nein'].includes(value)) {
    await sock.sendMessage(from, {
      text: `> ❌ *AN ODER AUS?*\n\nNutze: \`${pref}privacy ${sub} an\` oder \`${pref}privacy ${sub} aus\`.`
    }, { quoted: msg });
    await sendReaction(sock, from, reactions.input.reactions.invalidInput, msg.key);
    return true;
  }

  const on = ['an', 'on', 'ja'].includes(value);

  if (field === 'publicProfile' && on && isMinor(reg)) {
    await sock.sendMessage(from, {
      text: '> ⛔ *NICHT MÖGLICH*\n\nÖffentliche Profile sind erst ab 18 freigeschaltet — dein Profil ist als „unter 18“ markiert.'
    }, { quoted: msg });
    await sendReaction(sock, from, reactions.access.reactions.unauthorized, msg.key);
    return true;
  }

  /* Bei „hide“-Feldern ist „an“ = verstecken */
  reg.privacy[field] = field === 'publicProfile' ? on : on;
  const next = { ...(userProfile || {}), registration: { ...reg, privacy: { ...reg.privacy } } };
  if (typeof saveProfile === 'function') saveProfile(next);

  const labelMap = { hideCity: 'Stadt verstecken', hideAge: 'Alter verstecken', publicProfile: 'Öffentliches Profil' };
  await sock.sendMessage(from, {
    text: `> ✅ *PRIVATSPHÄRE AKTUALISIERT*\n\n• ${labelMap[field]}: *${on ? 'AN' : 'AUS'}*`
  }, { quoted: msg });
  await sendReaction(sock, from, reactions.completion.reactions.withoutAnyProblems, msg.key);
  return true;
}

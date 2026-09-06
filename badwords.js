/* ============================================================================
 * LoveBot — Badword-Filter (badwords.js)
 * ----------------------------------------------------------------------------
 * Hier liegt die Standard-Liste der verbotenen Wörter. Der Owner kann zur
 * Laufzeit weitere Wörter hinzufügen ($badword add <wort>) oder entfernen
 * ($badword remove <wort>) — das landet in Database/Database.json unter
 * meta.badwords und wird mit dieser Liste kombiniert.
 * ==========================================================================*/

/* Standard-Liste (wird vom Owner über den Bot erweitert).               */
export const DEFAULT_BADWORDS = [
  'arschloch',
  'arsch',
  'arschficker',
  'arschgesicht',
  'arschlecker',
  'hurensohn',
  'hurenshon',
  'hure',
  'hurenkind',
  'fick dich',
  'fick',
  'ficke',
  'fickt',
  'gefickt',
  'ficken',
  'ficker',
  'fotze',
  'fotzengesicht',
  'wichser',
  'wixer',
  'missgeburt',
  'schlampe',
  'dreckstück',
  'dreckssau',
  'dreckskerl',
  'bastard',
  'idiot',
  'depp',
  'spast',
  'spasti',
  'mongo',
  'behindi',
  'opfer',
  'lappen',
  'vollpfosten',
  'nullchecker',
  'hoden',
  'schwanz',
  'schwuchtel',
  'schwuli',
  'kanake',
  'neger',
  'nigga',
  'nigger',
  'bitch',
  'bastard',
  'nazi',
  'hitler',
  'verpiss dich',
  'leck mich',
  'blödmann',
  'drecksau'
];

/* Leetspeak-/Sonderzeichen-Normalisierung, damit "4rschl0ch" & Co.     */
/* trotzdem erkannt werden.                                             */
const LEET_MAP = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '@': 'a',
  '5': 's',
  '$': 's',
  '7': 't',
  '8': 'b',
  '9': 'g'
};

export function normalizeBadwordText(text) {
  return String(text || '')
    .toLowerCase()
    .split('')
    .map((ch) => LEET_MAP[ch] || ch)
    .join('')
    .replace(/[\u0300-\u036f]/g, '') // Akzente entfernen
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[*_~`|]+/g, ' ')       // Markdown-Zeichen trennen Wörter
    .replace(/\s+/g, ' ')
    .trim();
}

function matchWordList(normalized, allWords, removedSet) {
  for (const rawWord of allWords) {
    const word = normalizeBadwordText(rawWord);
    if (!word || removedSet.has(word)) continue;

    if (word.includes(' ')) {
      /* Mehrwort-Phrasen: einfache Teilstringsuche */
      if (normalized.includes(word)) return rawWord;
      continue;
    }

    /* Einzelwörter: nur ganze Wörter zählen (mit Umlaut-/Grenzen-Check) */
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(^|[^a-zäöüß])${escaped}([^a-zäöüß]|$)`, 'i');
    if (re.test(normalized)) return rawWord;
  }
  return null;
}

/* Prüft einen Text gegen die Wortliste (+ Extra-Wörter, - entfernte).  */
/* Liefert das gefundene Wort zurück oder null.                          */
export function findBadword(text, addedWords = [], removedWords = []) {
  const normalized = normalizeBadwordText(text);
  if (!normalized) return null;

  const removedSet = new Set(
    (removedWords || []).map((w) => normalizeBadwordText(w)).filter(Boolean)
  );
  const allWords = [...DEFAULT_BADWORDS, ...(addedWords || [])];

  /* Pass 1: normale Erkennung mit Wortgrenzen */
  const hit = matchWordList(normalized, allWords, removedSet);
  if (hit) return hit;

  /* Pass 2: Umgehungs-Versuch "f i c k d i c h" / "h u r e n s o h n" —
     nur wenn mindestens 3 einzelne, durch Leerzeichen getrennte
     Buchstaben im Text stehen (sonst False-Positives). */
  if (/(?:^|\s)[a-zäöüß](?:\s[a-zäöüß]){2,}(?:\s|$)/i.test(normalized)) {
    const collapsed = normalized.replace(/\s+/g, '');
    for (const rawWord of allWords) {
      const word = normalizeBadwordText(rawWord).replace(/\s+/g, '');
      if (!word || removedSet.has(word)) continue;
      if (collapsed.includes(word)) return rawWord;
    }
  }
  return null;
}

/* Zensiert ein Wort für öffentliche Nachrichten: "hurensohn" → "h***"  */
export function censorWord(word) {
  const w = String(word || '').trim();
  if (w.length <= 2) return '***';
  return `${w[0]}${'*'.repeat(Math.min(w.length - 1, 7))}`;
}

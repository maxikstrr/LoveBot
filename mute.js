/* ═══════════════════════════════════════════════════════════════════
   🔇 LoveBot 7.1.4 — MUTE-SYSTEM (mute.js)

   $mute @user [zeit] [grund]  — nur Owner. Ohne Zeit = PERMANENT,
   bis $unmute. Stumme User werden komplett ignoriert und ihre
   Nachrichten vom Bot gelöscht (in Gruppen, sofern der Bot Admin ist).

   · Speicher: Database/mutes.json  { jid: { until, by, byName, reason, at } }
   · until = ISO-String | null (null = permanent)
   · getMute() räumt abgelaufene Mutes automatisch weg.
   ═══════════════════════════════════════════════════════════════════ */
import fs from 'fs';
import path from 'path';

const FILE = path.join('Database', 'mutes.json');

function load() {
  try {
    const st = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return st && typeof st === 'object' ? st : {};
  } catch (e) { return {}; }
}

function save(st) {
  try {
    fs.mkdirSync('Database', { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(st, null, 2), 'utf8');
  } catch (e) {}
}

function cleanKey(jid = '') {
  /* Device-Suffix entfernen („4912…:5@s.whatsapp.net" → „4912…@s.whatsapp.net"),
     aber die Domain behalten. */
  return String(jid || '').trim().replace(/:(\d+)(?=@)/, '');
}

/* ── Zeit-Parser: „30s" · „10m"/„10min" · „2h"/„2std" · „1d" · „2w" ──
   Plain-Zahl = Minuten. „permanent"/„perm" → null. Unbekannt → undefined. */
export function parseDuration(str = '') {
  const s = String(str || '').trim().toLowerCase();
  if (!s) return undefined;
  if (['permanent', 'perm', 'unbegrenzt', 'für immer', 'fuer immer', 'forever'].includes(s)) return null;
  const m = s.match(/^(\d+(?:[.,]\d+)?)\s*(sek|sec|s|sekunden?|m|min|minuten?|h|std|stunden?|st|d|tage?|t|w|wochen?)?$/);
  if (!m) return undefined;
  let n = parseFloat(m[1].replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return undefined;
  const unit = m[2] || 'm';
  if (/^(sek|sec|s|sekunden?)$/.test(unit)) n *= 1000;
  else if (/^(m|min|minuten?)$/.test(unit)) n *= 60000;
  else if (/^(h|std|stunden?|st)$/.test(unit)) n *= 3600000;
  else if (/^(d|tage?|t)$/.test(unit)) n *= 86400000;
  else if (/^(w|wochen?)$/.test(unit)) n *= 604800000;
  return Math.round(n);
}

/* ── Mute setzen (untilMs = null → permanent) ─────────────────────── */
export function muteUser({ jid = '', by = '', byName = 'Owner', untilMs = null, reason = '' } = {}) {
  const key = cleanKey(jid);
  if (!key || !/@(s\.whatsapp\.net|lid|g\.us)$/.test(key)) return { ok: false, error: 'invalid-jid' };
  const st = load();
  const entry = {
    jid: key,
    until: untilMs ? new Date(Date.now() + untilMs).toISOString() : null,
    by: cleanKey(by), byName: String(byName).slice(0, 60) || 'Owner',
    reason: String(reason || '').slice(0, 300),
    at: new Date().toISOString()
  };
  st[key] = entry;
  save(st);
  return { ok: true, entry };
}

export function unmuteUser(jid = '') {
  const key = cleanKey(jid);
  const st = load();
  if (!st[key]) return { ok: false, error: 'not-muted' };
  const entry = st[key];
  delete st[key];
  save(st);
  return { ok: true, entry };
}

/* ── Aktiver Mute? (abgelaufene werden automatisch entfernt) ──────── */
export function getMute(jid = '') {
  const key = cleanKey(jid);
  if (!key) return null;
  const st = load();
  const e = st[key];
  if (!e) return null;
  if (e.until && new Date(e.until).getTime() <= Date.now()) {
    delete st[key];
    save(st);
    return null;
  }
  return e;
}

export function listMutes() {
  const st = load();
  const out = [];
  for (const [jid, e] of Object.entries(st)) {
    if (e.until && new Date(e.until).getTime() <= Date.now()) continue; /* abgelaufen */
    out.push(e);
  }
  return out;
}

/* Schöne Dauer-Anzeige für Bestätigungen */
export function formatDuration(ms = 0) {
  if (ms == null) return 'permanent';
  const s = Math.round(ms / 1000);
  if (s < 60) return s + ' Sekunden';
  const m = Math.round(s / 60);
  if (m < 60) return m + ' Minuten';
  const h = Math.round(m / 60);
  if (h < 24) return h + ' Stunden';
  const d = Math.round(h / 24);
  if (d < 7) return d + ' Tage';
  return Math.round(d / 7) + ' Wochen';
}

/* Für Tests */
export function _resetMutes() {
  try { fs.unlinkSync(FILE); } catch (e) {}
}
export function _mutesFile() { return FILE; }

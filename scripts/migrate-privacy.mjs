/* ═══════════════════════════════════════════════════════════════════════
   🔒 MIGRATION — Datenschutz für Bestandsprofile (migrate-privacy.mjs)
   ─────────────────────────────────────────────────────────────────────
   Was das Skript tut (idempotent — beliebig oft ausführbar):

     1. Legt ein Backup von Database/Database.json an.
     2. Für jedes gespeicherte Profil:
        · exaktes Alter unter 18 wird ENTFERNT (nur Spanne „unter 18“ bleibt)
        · Alter >= 18 bleibt als Zahl erhalten
        · fehlende Felder (ageBracket, privacy-Flags) werden ergänzt
        · leere Stadtfelder werden zu null normalisiert

   Nutzung:
     node scripts/migrate-privacy.mjs --dry-run   # nur anzeigen, nichts schreiben
     node scripts/migrate-privacy.mjs             # wirklich migrieren
   ═══════════════════════════════════════════════════════════════════════ */

import fs from 'node:fs';
import path from 'node:path';
import { migrateRegistration, isMinor, ageLabel, cityLabel } from '../privacy.js';

const DB_PATH = path.join('Database', 'Database.json');
const dryRun = process.argv.includes('--dry-run');

if (!fs.existsSync(DB_PATH)) {
  console.error(`❌ ${DB_PATH} nicht gefunden — bitte im Projektordner ausführen.`);
  process.exit(1);
}

const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
const users = db.users || {};

let changed = 0;
let minors = 0;
let agesRemoved = 0;
let flagsAdded = 0;
const examples = [];

for (const [bid, profile] of Object.entries(users)) {
  if (!profile || typeof profile !== 'object') continue;
  const before = profile.registration;
  if (!before || typeof before !== 'object') continue;

  const beforeJson = JSON.stringify(before);
  const after = migrateRegistration(before);
  const afterJson = JSON.stringify(after);

  if (beforeJson !== afterJson) {
    changed++;
    const hadExactAge = (typeof before.age === 'number' && before.age > 0) || /^\d+$/.test(String(before.age || ''));
    const wasMinor = Number(before.age) < 18 && Number(before.age) >= 13;
    if (wasMinor) { minors++; agesRemoved++; }
    if (!before.privacy) flagsAdded++;
    if (examples.length < 5) {
      examples.push({
        bid: String(bid).slice(0, 24) + '…',
        vorher: { age: before.age ?? null, city: before.city ?? null },
        nachher: { age: after.age ?? null, ageBracket: after.ageBracket, stadtInGruppe: cityLabel(after, { privateChat: false }), alter: ageLabel(after, { reveal: true }) }
      });
    }
    if (!dryRun) profile.registration = after;
  } else if (isMinor(after)) {
    minors++;
  }
}

console.log('');
console.log('🔒 PRIVACY-MIGRATION' + (dryRun ? ' (DRY RUN — es wird nichts geschrieben)' : ''));
console.log('─'.repeat(52));
console.log(`Profile gesamt      : ${Object.keys(users).length}`);
console.log(`Geändert            : ${changed}`);
console.log(`Minderjährige       : ${minors}`);
console.log(`Exaktes Alter gelöscht: ${agesRemoved}`);
console.log(`Privacy-Flags ergänzt : ${flagsAdded}`);
if (examples.length) {
  console.log('');
  console.log('Beispiele:');
  for (const e of examples) console.log(' •', JSON.stringify(e));
}

if (dryRun) {
  console.log('');
  console.log('💡 Ohne --dry-run wird die Datei geschrieben (mit Backup).');
  process.exit(0);
}

/* Backup + schreiben */
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = path.join('Database', `Database.privacy-backup-${stamp}.json`);
fs.copyFileSync(DB_PATH, backupPath);
db.meta = { ...(db.meta || {}), privacyMigration: { at: new Date().toISOString(), changed, agesRemoved } };
fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');

console.log('');
console.log(`💾 Backup: ${backupPath}`);
console.log(`✅ ${DB_PATH} aktualisiert.`);
console.log('');

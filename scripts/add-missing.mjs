/* ═══════════════════════════════════════════════════════════════════════
   ➕ ADD-MISSING — nimmt implementierte, aber undokumentierte Befehle
   (gefunden via scripts/registry-sync.mjs) in die Registry auf.
   Idempotent: existierende Namen werden übersprungen.
   Aufruf: node scripts/add-missing.mjs && node scripts/build-registry.mjs
   ═══════════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REG = path.join(ROOT, 'registry', 'commands.json');
const registry = JSON.parse(fs.readFileSync(REG, 'utf8'));

const ADD = [
  /* liebe */
  { cat: 'liebe', name: 'flirt', usage: '$flirt @user', desc: 'Flirt-Spruch funken 😘' },
  { cat: 'liebe', name: 'anmachen', usage: '$anmachen @user', desc: 'Jemanden anmachen 😏' },
  { cat: 'liebe', name: 'compat', usage: '$compat @user', desc: 'Kompatibilität checken 💯' },
  { cat: 'liebe', name: 'confess', usage: '$confess <text>', desc: 'Anonymes Geständnis 🤫', aliases: ['geständnis'] },
  { cat: 'liebe', name: 'confesslove', usage: '$confesslove @user <text>', desc: 'Liebe gestehen 💌' },
  { cat: 'liebe', name: 'dateidee', usage: '$dateidee', desc: 'Idee für ein Date 💡' },
  { cat: 'liebe', name: 'lovecalc', usage: '$lovecalc @user', desc: 'Love-Calculator 💕' },
  { cat: 'liebe', name: 'romantic', usage: '$romantic', desc: 'Romantik-Modus 💐', aliases: ['romantisch'] },
  { cat: 'liebe', name: 'breakup', usage: '$breakup @user', desc: 'Trennung einreichen 💔', aliases: ['trennung'] },
  { cat: 'liebe', name: 'marryaccept', usage: '$marryaccept', desc: 'Heiratsantrag annehmen ✅', aliases: ['marryyes'] },
  { cat: 'liebe', name: 'marrydeny', usage: '$marrydeny', desc: 'Heiratsantrag ablehnen ❌', aliases: ['marryno'] },
  { cat: 'liebe', name: 'goodmorning', usage: '$goodmorning', desc: 'Guten-Morgen-Gruß 🌅', aliases: ['gutenmorgen', 'morgen'] },
  { cat: 'liebe', name: 'goodnight', usage: '$goodnight', desc: 'Gute-Nacht-Gruß 🌙', aliases: ['gutenacht', 'nacht'] },
  { cat: 'liebe', name: 'nachtzitat', usage: '$nachtzitat', desc: 'Nächtliches Zitat ✨', aliases: ['nightquote', 'nq'] },
  { cat: 'liebe', name: 'mood', usage: '$mood [stimmung]', desc: 'Deine Stimmung 🎭', aliases: ['stimmung'] },
  /* economy / progression */
  { cat: 'economy', name: 'level', usage: '$level', desc: 'Dein Level + Fortschritt 📈', aliases: ['profil', 'profile'] },
  /* ownertools (rank-system, owner) */
  { cat: 'ownertools', name: 'setrang', usage: '$setrang @user <rang>', desc: 'Rang vergeben 👑 (Owner)', aliases: ['setrank'], perms: 'owner' },
  { cat: 'ownertools', name: 'getrang', usage: '$getrang @user', desc: 'Rang abfragen 🔎 (Owner)', perms: 'owner' },
  { cat: 'ownertools', name: 'delrang', usage: '$delrang @user', desc: 'Rang entfernen 🗑️ (Owner)', perms: 'owner' },
  { cat: 'ownertools', name: 'removerang', usage: '$removerang @user', desc: 'Rang entfernen (alternative Variante) 🗑️ (Owner)', perms: 'owner' },
  { cat: 'ownertools', name: 'rangs', usage: '$rangs', desc: 'Alle Ränge anzeigen 🏅 (Owner)', perms: 'owner' },
  { cat: 'ownertools', name: 'cleartmp', usage: '$cleartmp', desc: 'Temp-Dateien aufräumen 🧹 (Owner)', perms: 'owner' },
  /* session */
  { cat: 'session', name: 'pairing', usage: '$pairing', desc: 'Wo Pairing-Codes erscheinen (nur Terminal/Dashboard — nie im Chat) 🔐 (Owner)', perms: 'owner' },
  { cat: 'session', name: 'sessionusers', usage: '$sessionusers <id>', desc: 'Nutzer-Übersicht einer Session 👥 (Owner)', perms: 'owner' },
  /* medien */
  { cat: 'medien', name: 'metaforward', usage: '$metaforward', desc: 'Nachrichten an Meta AI weiterleiten 🤖', aliases: ['metafw'] },
  /* gruppe */
  { cat: 'gruppe', name: 'lock', usage: '$lock', desc: 'Gruppe sperren 🔒 (Admin)', aliases: ['unlock'], perms: 'admin' },
  /* spass */
  { cat: 'spass', name: 'kaset', usage: '$kaset', desc: 'Mini-Slot-Variante 🎰', aliases: ['toy'] }
];

/* Aliase an EXISTIERENDE Befehle anhängen */
const ALIAS_PATCH = {
  warns: ['warnings'],
  slotmini: [] /* kaset/toy sind jetzt eigene Einträge mit Alias-Beziehung oben */,
  top: ['lb'],
  wouldyou: ['würdestdu']
};

const cats = new Map(registry.categories.map((c) => [c.id, c]));
const names = new Set(registry.categories.flatMap((c) => c.cmds.map((x) => x.name)));
let added = 0, aliased = 0;

for (const a of ADD) {
  if (names.has(a.name)) continue;
  const cat = cats.get(a.cat);
  if (!cat) throw new Error('Kategorie fehlt: ' + a.cat);
  cat.cmds.push({ name: a.name, usage: a.usage, desc: a.desc, aliases: a.aliases || [], perms: a.perms || 'all', cooldown: 3, source: 'code-entdeckt (registry-sync)' });
  names.add(a.name);
  added++;
}

for (const [target, list] of Object.entries(ALIAS_PATCH)) {
  const cmd = registry.categories.flatMap((c) => c.cmds).find((x) => x.name === target);
  if (!cmd) continue;
  for (const a of list) {
    if (!names.has(a) && !cmd.aliases.includes(a)) { cmd.aliases.push(a); aliased++; }
  }
}

registry.updated = new Date().toISOString().slice(0, 10);
fs.writeFileSync(REG, JSON.stringify(registry, null, 2));
console.log('✅ ' + added + ' Befehle ergänzt, ' + aliased + ' Aliase angehängt.');

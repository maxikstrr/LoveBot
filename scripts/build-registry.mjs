/* ═══════════════════════════════════════════════════════════════════════
   📦 REGISTRY-BUILD — registry/commands.json → Web-Artefakte
   Erzeugt public/js/commands-data.js (Fallback für statische Seiten)
   und validiert die Registry (eindeutige Namen, Aliase zeigen auf echte
   Befehle, Pflichtfelder).
   Aufruf: node scripts/build-registry.mjs   (nach jeder Registry-Änderung)
   ═══════════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'registry', 'commands.json'), 'utf8'));

/* ── Validierung ────────────────────────────────────────────────────── */
const errors = [];
const names = new Set();
const catIds = new Set();
for (const cat of registry.categories) {
  if (catIds.has(cat.id)) errors.push('Doppelte Kategorie-ID: ' + cat.id);
  catIds.add(cat.id);
  if (!cat.slug || !cat.title || !cat.emoji) errors.push('Kategorie unvollständig: ' + cat.id);
  for (const c of cat.cmds) {
    if (names.has(c.name)) errors.push('Doppelter Befehlsname: ' + c.name);
    names.add(c.name);
    if (!c.usage || !c.desc) errors.push('Unvollständiger Eintrag: ' + c.name);
    if (!['all', 'admin', 'owner'].includes(c.perms)) errors.push('Ungültige perms "' + c.perms + '": ' + c.name);
  }
}
for (const cat of registry.categories) {
  for (const c of cat.cmds) {
    for (const a of c.aliases || []) {
      if (names.has(a)) errors.push('Alias "' + a + '" ist gleichzeitig eigener Befehl (an ' + c.name + ')');
    }
  }
}
if (errors.length) {
  console.error('❌ Registry-Validierung fehlgeschlagen:');
  for (const e of errors) console.error('   · ' + e);
  process.exit(1);
}

/* ── commands-data.js erzeugen (Format wie bisher: window.LOVEBOT_COMMANDS) ── */
const web = registry.categories.map((cat) => ({
  emoji: cat.emoji,
  title: cat.web,
  cmds: cat.cmds.map((c) => ({
    cmd: c.name,
    usage: c.usage + (c.aliases?.length ? ' / $' + c.aliases.join(' / $') : ''),
    desc: c.desc
  }))
}));
const total = web.reduce((a, c) => a + c.cmds.length, 0);
const js = `/* LoveBot — eingebettete Befehlsdaten (Fallback).
   GENERIERT aus registry/commands.json — nicht von Hand editieren!
   Build: node scripts/build-registry.mjs · ${new Date().toISOString().slice(0, 10)} */
window.LOVEBOT_COMMANDS = ${JSON.stringify(web, null, 2)};
`;
fs.writeFileSync(path.join(ROOT, 'public', 'js', 'commands-data.js'), js);

console.log('✅ Build OK:');
console.log('   ' + registry.categories.length + ' Kategorien · ' + total + ' Befehle · ' +
  registry.categories.reduce((a, c) => a + c.cmds.reduce((x, cmd) => x + (cmd.aliases || []).length, 0), 0) + ' Aliase');
console.log('   → public/js/commands-data.js geschrieben');

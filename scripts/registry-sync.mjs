/* ═══════════════════════════════════════════════════════════════════════
   🔁 REGISTRY-SYNC — Drift-Check: Bot-Code ↔ registry/commands.json
   Prüft:
     A) implementierte Befehle (Code), die NICHT in der Registry sind
     B) Registry-Befehle ohne Implementierung (Hinweis, kein Fehler)
   Exit-Code 1 bei neuen unregistrierten Befehlen (für CI/Pre-Commit).
   Aufruf: node scripts/registry-sync.mjs
   ═══════════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'registry', 'commands.json'), 'utf8'));

const regNames = new Set();
const regAliases = new Set();
for (const cat of registry.categories) {
  for (const c of cat.cmds) {
    regNames.add(c.name.toLowerCase());
    for (const a of c.aliases || []) regAliases.add(a.toLowerCase());
  }
}

/* ── Implementierte Namen aus dem Code ──────────────────────────────── */
const implemented = new Map(); /* name → quelle */
for (const f of ['loveplus.js', 'sessioncmds.js']) {
  const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
  for (const m of src.matchAll(/cmd\('([^']+)'/g)) {
    for (const n of m[1].trim().split(/\s+/)) implemented.set(n.toLowerCase(), f);
  }
}
const love = fs.readFileSync(path.join(ROOT, 'Love.js'), 'utf8');
for (const m of love.matchAll(/^\s*case '([^']+)':\s*$/gm)) {
  implemented.set(m[1].toLowerCase(), 'Love.js');
}

/* Sub-Mode-/innere Wörter, die keine Nutzer-Befehle sind */
const SKIP = new Set(['on', 'off', 'an', 'aus', 'accept', 'reject', 'yes', 'no', 'ja', 'nein', 'all', 'alle', 'add', 'remove', 'list', 'ein', 'status', 'info', 'set', 'del', 'true', 'false', '1', '0', 'help', 'menu', 'accept2', 'reject2']);

const unregistered = [...implemented.keys()]
  .filter((n) => !SKIP.has(n) && !regNames.has(n) && !regAliases.has(n))
  .sort();
const orphaned = [...regNames].filter((n) => !implemented.has(n)).sort();

console.log('🔁 Registry-Sync — Code ↔ registry/commands.json');
console.log('   Registry: ' + regNames.size + ' Befehle + ' + regAliases.size + ' Aliase · Code: ' + implemented.size + ' Dispatcher-Namen\n');

if (unregistered.length) {
  console.log('⚠️  A) Implementiert, aber NICHT in der Registry (' + unregistered.length + '):');
  for (const n of unregistered.slice(0, 60)) console.log('   · $' + n + '  (' + implemented.get(n) + ')');
  if (unregistered.length > 60) console.log('   … und ' + (unregistered.length - 60) + ' weitere');
} else {
  console.log('✅ A) Alle implementierten Befehle sind in der Registry.');
}
console.log();
if (orphaned.length) {
  console.log('ℹ️  B) In der Registry, kein direkter Case gefunden (' + orphaned.length + ') — i. d. R. Alias-Dispatcher oder gruppiert:');
  console.log('   ' + orphaned.map((n) => '$' + n).join(', ').slice(0, 600));
} else {
  console.log('✅ B) Alle Registry-Befehle im Code gefunden.');
}

/* Known-Gap-Liste (Stand Migration) — nicht failen, nur melden */
process.exit(unregistered.length ? 1 : 0);

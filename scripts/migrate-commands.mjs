/* ═══════════════════════════════════════════════════════════════════════
   📚 REGISTRY-MIGRATION (einmalig)
   Baut registry/commands.json — DIE zentrale Befehls-Registry.

   Quellen:
   · server.js COMMAND_CATEGORIES  → Kategorien, Namen, Usage, Beschreibung
   · Love.js case-Gruppen          → echte Alias-Gruppen des Dispatchers
   · loveplus.js / sessioncmds.js  → cmd('a b c')-Gruppen (exakt)

   Ab danach ist registry/commands.json DIE Quelle (single source of truth):
   · commandRegistry.js      — Loader/API für server.js, Love.js, Web
   · scripts/build-registry  — erzeugt public/js/commands-data.js daraus
   · scripts/registry-sync   — Drift-Check Code ↔ Registry
   Aufruf: node scripts/migrate-commands.mjs
   ═══════════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const serverSrc = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');

/* ── 1. COMMAND_CATEGORIES aus server.js extrahieren ─────────────────── */
const startMarker = 'const COMMAND_CATEGORIES = ';
const start = serverSrc.indexOf(startMarker);
if (start < 0 || !serverSrc.includes('\n];', start)) {
  /* server.js liest bereits aus der Registry → Migration bereits durchgeführt.
     Ab jetzt: registry/commands.json DIREKT pflegen + scripts/build-registry.mjs laufen lassen. */
  console.log('ℹ️ server.js enthält keinen Inline-COMMAND_CATEGORIES-Block mehr — Migration bereits abgeschlossen.');
  console.log('   Ab jetzt registry/commands.json direkt pflegen, dann: node scripts/build-registry.mjs');
  process.exit(0);
}
const end = serverSrc.indexOf('\n];', start);
const categories = eval('(' + serverSrc.slice(start + startMarker.length, end + 2).trim() + ')');

/* ── 2. Kategorie-Mapping ────────────────────────────────────────────── */
const CAT_MAP = {
  'START':                   { id: 'start',     slug: 'start',     title: 'Start & Hilfe' },
  'ALLGEMEIN':               { id: 'allgemein', slug: 'allgemein', title: 'Allgemein' },
  'LIEBE & HERZEN':          { id: 'liebe',     slug: 'liebe',     title: 'Liebe & Herzen' },
  'AFK & PROFIL':            { id: 'afk',       slug: 'afk',       title: 'AFK & Profil' },
  'GRUPPE & MODERATION':     { id: 'gruppe',    slug: 'gruppe',    title: 'Gruppe & Moderation' },
  'ADMIN & VERIFIKATION':    { id: 'admin',     slug: 'admin',     title: 'Admin & Verifizierung' },
  'MEDIEN & AI':             { id: 'medien',    slug: 'medien',    title: 'Medien & KI' },
  'SLOT & SPASS':            { id: 'spass',     slug: 'spass',     title: 'Slot & Spaß' },
  'ECONOMY':                 { id: 'economy',   slug: 'economy',   title: 'Economy' },
  'SESSION-CENTER (OWNER)':  { id: 'session',   slug: 'session',   title: 'Session-Center (Owner)' },
  'LOVEPLUS (NEU)':          { id: 'loveplus',  slug: 'loveplus',  title: 'LovePlus' },
  'INTERNET & FAKTEN':       { id: 'fakten',    slug: 'fakten',    title: 'Internet & Fakten' },
  'OWNER TOOLS':             { id: 'ownertools',slug: 'ownertools',title: 'Owner-Tools' },
  'WERKZEUGE & UTILITIES':   { id: 'tools',     slug: 'tools',     title: 'Werkzeuge & Utilities' }
};

/* ── 3. Rechte-Ableitung (dokumentierte Heuristik) ───────────────────── */
const OWNER_EXTRA = new Set(['ban', 'unban', 'banlist', 'block', 'unblock', 'blocklist', 'badword', 'fp', 'leave', 'kickall', 'setup', 'join', 'broadcast']);
const GROUP_ADMIN = new Set(['tagall', 'hidetag', 'tagadmin', 'rules', 'gi', 'an', 'aus', 'autodl', 'activate', 'deactivate', 'welcome', 'goodbye', 'kick', 'promote', 'demote', 'warn', 'unwarn', 'add', 'revoke', 'setname', 'setdesc', 'mute', 'unmute', 'delete']);
function derivePerms(c, cat) {
  if (/\(Owner\)/i.test(c.desc) || cat.id === 'ownertools' || cat.id === 'session') return 'owner';
  if (OWNER_EXTRA.has(c.cmd)) return 'owner';
  if (cat.id === 'gruppe' && GROUP_ADMIN.has(c.cmd)) return 'admin';
  if (cat.id === 'admin') return 'admin';
  return 'all';
}

/* ── 4. Alias-Gruppen aus dem BOT-CODE extrahieren ──────────────────── */
function extractCodeGroups() {
  const groups = [];
  /* loveplus.js + sessioncmds.js: cmd('a b c', ...) — exakt */
  for (const f of ['loveplus.js', 'sessioncmds.js']) {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    for (const m of src.matchAll(/cmd\('([^']+)'/g)) {
      const names = m[1].trim().split(/\s+/);
      if (names.length) groups.push({ source: f, names });
    }
  }
  /* Love.js: aufeinanderfolgende case 'x':-Zeilen = eine Gruppe */
  const love = fs.readFileSync(path.join(ROOT, 'Love.js'), 'utf8');
  let run = [];
  const flush = () => { if (run.length) groups.push({ source: 'Love.js', names: run }); run = []; };
  for (const line of love.split('\n')) {
    const m = line.match(/^\s*case '([^']+)':\s*$/);
    if (m) { run.push(m[1]); continue; }
    flush();
  }
  flush();
  return groups;
}
const codeGroups = extractCodeGroups();

/* Gruppe zu einem Namen finden (erste Gruppe, die den Namen enthält) */
const groupOf = (name) => {
  const lower = name.toLowerCase();
  return codeGroups.find((g) => g.names.some((n) => n.toLowerCase() === lower)) || null;
};

/* Sub-Mode-Wörter, die KEINE Aliase sind (on/off/accept/… aus inneren Switches) */
const NOT_ALIASES = new Set(['on', 'off', 'an', 'aus', 'accept', 'reject', 'yes', 'no', 'ja', 'nein', 'all', 'alle', 'add', 'remove', 'list', 'ein', 'aus?', 'status', 'info', 'set', 'del', 'delete', 'true', 'false', '1', '0', 'help', 'menu']);

/* ── 5. Kategorien + Befehle übernehmen, Dubletten mergen ───────────── */
const outCats = [];
const aliasCat = categories.find((c) => c.title.startsWith('Aliase'));
const aliasNames = (aliasCat?.cmds || []).map((c) => c.cmd);
const byName = new Map();
const mergedDuplicates = [];

for (const cat of categories) {
  if (cat.title.startsWith('Aliase')) continue;
  const meta = CAT_MAP[cat.title];
  if (!meta) throw new Error('Unbekannte Kategorie: ' + cat.title);
  const cmds = [];
  for (const c of cat.cmds) {
    const parts = c.usage.split(' / ').map((t) => t.trim()).filter(Boolean);
    const usageAliases = parts.slice(1).map((p) => p.replace(/^\$/, '').split(' ')[0]).filter(Boolean);
    if (byName.has(c.cmd)) {
      /* Dublette: existiert schon in anderer Kategorie → Aliase mergen, Rest ignorieren */
      const ex = byName.get(c.cmd);
      for (const a of usageAliases) if (!ex.aliases.includes(a)) ex.aliases.push(a);
      mergedDuplicates.push({ name: c.cmd, keptIn: ex.catId, droppedFrom: meta.id });
      continue;
    }
    const entry = {
      name: c.cmd,
      usage: '$' + (parts[0] || c.cmd).replace(/^\$/, ''),
      desc: c.desc,
      aliases: usageAliases,
      perms: derivePerms(c, meta),
      cooldown: 3,
      source: 'Bot-Code'
    };
    byName.set(c.cmd, entry);
    entry.catId = meta.id;
    cmds.push(entry);
  }
  outCats.push({ id: meta.id, slug: meta.slug, emoji: cat.emoji, title: meta.title, web: cat.title, cmds });
}

/* ── 6. Code-Aliase anreichern (case-Gruppen / cmd()-Gruppen) ─────────
   Run [a, b, c, …]: enthält er GENAU EINEN Registry-Befehl, sind die
   anderen Namen Aliase davon (sicher). Enthält er mehrere Registry-
   Befehle (gestapelte Cases mit interner Verzweigung), wird er hier
   übersprungen — die Zuordnung macht dann Schritt 7 positional. */
let codeAliasesAdded = 0;
const ambiguousRuns = [];
for (const g of codeGroups) {
  const members = g.names.filter((n) => !NOT_ALIASES.has(n.toLowerCase()));
  const registryMembers = members.filter((n) => byName.has(n));
  if (registryMembers.length !== 1) {
    if (registryMembers.length > 1) ambiguousRuns.push(g.names);
    continue;
  }
  const entry = byName.get(registryMembers[0]);
  for (const n of members) {
    if (byName.has(n)) continue;
    if (n.length < 2) continue;
    if (!entry.aliases.includes(n)) { entry.aliases.push(n); codeAliasesAdded++; }
  }
}

/* ── 7. Alias-Kategorie auflösen (positional gegen Code-Gruppen) ────── */
/* Kuratierte Zuordnungen für deutsche Einzel-Implementierungen, die im
   Code als eigener Case mit identischer Logik laufen
   (z. B. case 'ohrfeige' mit „command === 'slap' || command === 'ohrfeige'“). */
const CURATED = {
  ohrfeige: 'slap', kompliment: 'compliment', lob: 'compliment',
  entwederoder: 'eod', neverhaveiever: 'nie', niehabeich: 'nie',
  schere: 'rps', 'münze': 'coin', wetten: 'gamble', geld: 'balance',
  arbeiten: 'work', rangliste: 'top', propose: 'marry', heiraten: 'marry',
  unbann: 'unban', revokelink: 'revoke', grouplink: 'link',
  gname: 'setname', gdesc: 'setdesc', gcinfo: 'groupinfo',
  internetspeed: 'speed', repo: 'gits', dice2: 'dice',
  blocked: 'blocklist', badwords: 'badword', autodownload: 'autodl',
  abschalten: 'aus', einschalten: 'an', anschalten: 'an', ausschalten: 'aus',
  enable: 'an', disable: 'aus', admincheck: 'acheck', admins: 'tagadmin',
  genimg: 'imagine', genavid: 'animate', i2output: 'i2',
  'dsgvo✅': 'dsgvo', 'dsgvo❌': 'dsgvo', 'verify✅': 'verify', 'verify❌': 'verify',
  metafw: 'metaforward', umfrage: 'poll', abstimmung: 'poll',
  katzenfakt: 'fakt', hundefakt: 'fakt', loveometer: 'ship',
  frage: '8ball', magie: '8ball', viewstatus: 'see', seestatus: 'see',
  botinfo: 'system', botleave: 'leave', gruppenfeatures: 'gi',
  wikipedia: 'wikipedia'
};
let resolved = 0, curated = 0;
const unresolvedList = [];
for (const alias of aliasNames) {
  if (byName.has(alias)) continue;
  let target = null;
  if (CURATED[alias] && byName.get(CURATED[alias])) {
    target = byName.get(CURATED[alias]); curated++;
  }
  if (!target) {
    const g = groupOf(alias);
    if (g) {
      /* Alias → nächst-vorangehender Registry-Befehl im Run
         (gestapelte Cases verzweigen intern: kuss→kiss, umarmen→hug) */
      const idx = g.names.findIndex((n) => n.toLowerCase() === alias.toLowerCase());
      for (let i = idx; i >= 0; i--) {
        if (byName.has(g.names[i])) { target = byName.get(g.names[i]); break; }
      }
    }
  }
  if (!target) {
    const lower = '$' + alias.toLowerCase();
    for (const entry of byName.values()) {
      if (entry.usage.toLowerCase().includes(lower) || entry.aliases.includes(alias)) { target = entry; break; }
    }
  }
  if (target) {
    if (!target.aliases.includes(alias)) target.aliases.push(alias);
    resolved++;
  } else {
    unresolvedList.push(alias);
  }
}

/* ── 7b. Sanitizer: Aliase, die eigene Befehle sind, entfernen;
       Sub-Aktionen (z. B. $pet play/sleep) sind KEINE Top-Level-Aliase ── */
const REMOVE_ALIASES = { 'pet feed': ['play', 'sleep'] };
let sanitized = 0;
for (const entry of byName.values()) {
  const before = entry.aliases.length;
  entry.aliases = entry.aliases.filter((a) => !byName.has(a) && !(REMOVE_ALIASES[entry.name] || []).includes(a));
  sanitized += before - entry.aliases.length;
}

/* ── 8. Neue Registry-Befehle ────────────────────────────────────────── */
outCats.find((c) => c.id === 'session').cmds.push(
  { name: 'cmdinfo', usage: '$cmdinfo <befehl>', desc: 'Registry-Info zu einem Befehl (Aliase, Rechte, Usage) 📚 (Owner)', aliases: [], perms: 'owner', cooldown: 3, source: 'sessioncmds.js' },
  { name: 'cmdsuche', usage: '$cmdsuche <begriff>', desc: 'Befehle in der Registry durchsuchen 🔎 (Owner)', aliases: ['cmdsearch'], perms: 'owner', cooldown: 3, source: 'sessioncmds.js' }
);

/* ── 9. Schreiben ────────────────────────────────────────────────────── */
const total = outCats.reduce((a, c) => a + c.cmds.length, 0);
const aliasTotal = outCats.reduce((a, c) => a + c.cmds.reduce((x, cmd) => x + cmd.aliases.length, 0), 0);
for (const c of outCats) for (const cmd of c.cmds) delete cmd.catId;

const registry = {
  version: 2,
  updated: new Date().toISOString().slice(0, 10),
  meta: {
    description: 'LoveBot Command Registry — die eine Quelle für Bot-Help, Website, Tester & Doku.',
    permsNote: 'perms = abgeleitet: (Owner)-Marker + Whitelists (OWNER_EXTRA/GROUP_ADMIN) — manuell in dieser Datei korrigierbar.',
    aliasResolution: {
      aliasCategoryEntries: aliasNames.length,
      resolved: resolved,
      resolvedByCuratedMap: curated,
      unresolved: unresolvedList.length,
      unresolvedList,
      unresolvedNote: 'Unresolved = eigene Cases oder unklare Zuordnung — funktionieren im Bot, sind nur registry-seitig nicht zugeordnet. Sync-Script listet sie als „implemented, nicht in Registry“.'
    },
    codeAliasesAdded,
    aliasesSanitized: sanitized,
    mergedDuplicates
  },
  categories: outCats
};
fs.mkdirSync(path.join(ROOT, 'registry'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'registry', 'commands.json'), JSON.stringify(registry, null, 2));
console.log('✅ registry/commands.json:');
console.log('   Kategorien:', outCats.length, '· Befehle:', total, '· Aliase gesamt:', aliasTotal);
console.log('   Code-Aliase ergänzt:', codeAliasesAdded, '· Alias-Kategorie aufgelöst:', resolved + '/' + aliasNames.length);
console.log('   Unresolved:', unresolvedList.length, unresolvedList.length ? '(' + unresolvedList.join(', ') + ')' : '');
console.log('   Dubletten gemerged:', mergedDuplicates.length);

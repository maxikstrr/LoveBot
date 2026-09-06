/* ═══════════════════════════════════════════════════════════════════════
   📚 L O V E B O T   C O M M A N D   R E G I S T R Y
   ─────────────────────────────────────────────────────────────────────
   DIE eine Quelle für Befehle (registry/commands.json):
     · server.js  → /api/commands (+ ?rich=1) für die Website
     · Love.js    → $help / $menu / $menunew (getHelpCategories)
     · Web-Admin  → Befehle-Browser & Command-Tester (validate)
     · Doku       → /docs.html wird daraus generiert

   Ein neuer Befehl wird NUR NOCH in registry/commands.json eingetragen
   (oder via register() zur Laufzeit) und erscheint überall.
   ═══════════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REGISTRY_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'registry', 'commands.json');

let registry = null;
const extra = []; /* zur Laufzeit registrierte Befehle (z. B. aus Plugins) */

function load() {
  if (registry) return registry;
  registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  buildIndex();
  return registry;
}

let byName = new Map();
let byAlias = new Map();

function buildIndex() {
  byName = new Map();
  byAlias = new Map();
  for (const cat of registry.categories) {
    for (const cmd of cat.cmds) {
      byName.set(cmd.name.toLowerCase(), { ...cmd, category: cat.id, categoryTitle: cat.title, emoji: cat.emoji });
      for (const a of cmd.aliases || []) byAlias.set(a.toLowerCase(), cmd.name.toLowerCase());
    }
  }
}

/* ── Runtime-Registrierung (Plugins/Erweiterungen) ──────────────────── */
export function register(cmd, category = 'tools') {
  load();
  extra.push(cmd);
  byName.set(String(cmd.name).toLowerCase(), { cooldown: 3, aliases: [], perms: 'all', ...cmd, category, runtime: true });
  for (const a of cmd.aliases || []) byAlias.set(a.toLowerCase(), cmd.name.toLowerCase());
}

/* ── Kompat-Shape für /api/commands + cmd.html (wie früher COMMAND_CATEGORIES) ── */
export function getCategories() {
  load();
  return registry.categories.map((c) => ({
    emoji: c.emoji, title: c.web, slug: c.slug,
    cmds: c.cmds.map((x) => ({ cmd: x.name, usage: x.usage + (x.aliases?.length ? ' / $' + x.aliases.join(' / $') : ''), desc: x.desc }))
  }));
}

/* ── Shape für Love.js $help/$menu: [usage, desc]-Tupel ─────────────── */
export function getHelpCategories() {
  load();
  return registry.categories.map((c) => ({
    slug: c.slug, emoji: c.emoji, title: c.title,
    cmds: c.cmds.map((x) => [x.usage + (x.aliases?.length ? ' / $' + x.aliases.slice(0, 3).join(' / $') : ''), x.desc])
  }));
}

/* ── Flache reiche Liste (Admin-Browser, Doku, Tester) ──────────────── */
export function getRich() {
  load();
  const cmds = [];
  for (const cat of registry.categories) {
    for (const x of cat.cmds) cmds.push({ name: x.name, usage: x.usage, desc: x.desc, aliases: x.aliases || [], perms: x.perms || 'all', cooldown: x.cooldown ?? 3, category: cat.id, categoryTitle: cat.title, emoji: cat.emoji, source: x.source || 'registry' });
  }
  for (const x of extra) cmds.push({ ...x, runtime: true });
  return cmds;
}

export function stats() {
  load();
  const cmds = getRich();
  return {
    categories: registry.categories.length,
    commands: cmds.length,
    aliases: cmds.reduce((a, c) => a + c.aliases.length, 0),
    perms: cmds.reduce((m, c) => { m[c.perms] = (m[c.perms] || 0) + 1; return m; }, {}),
    unresolvedAliases: registry.meta?.aliasResolution?.unresolved || 0,
    updated: registry.updated,
    version: registry.version
  };
}

/* ── Auflösung: Name oder Alias → Befehl ────────────────────────────── */
export function resolve(name) {
  load();
  const key = String(name || '').toLowerCase().trim();
  if (byName.has(key)) return byName.get(key);
  const target = byAlias.get(key);
  if (target && byName.has(target)) return { ...byName.get(target), resolvedViaAlias: key };
  return null;
}

/* ── Suche in Name/Beschreibung/Alias ───────────────────────────────── */
export function search(q, limit = 25) {
  load();
  const needle = String(q || '').toLowerCase().trim();
  if (!needle) return [];
  const out = [];
  for (const cmd of getRich()) {
    if (cmd.name.toLowerCase().includes(needle) || cmd.desc.toLowerCase().includes(needle) || cmd.aliases.some((a) => a.toLowerCase().includes(needle))) {
      out.push(cmd);
      if (out.length >= limit) break;
    }
  }
  return out;
}

/* ── Validator für den Command-Tester (TROCKENLAUF, keine Ausführung) ─ */
export function validate(input) {
  load();
  const t0 = process.hrtime.bigint();
  const raw = String(input || '').trim();
  const tokens = raw.replace(/^\$/, '').split(/\s+/).filter(Boolean);
  const nameToken = (tokens[0] || '').toLowerCase();
  const args = tokens.slice(1);
  const cmd = resolve(nameToken);

  const result = {
    input: raw,
    dryRun: true, /* wichtig: validiert nur — führt NICHTS aus */
    valid: false,
    command: nameToken,
    args,
    argCount: args.length
  };

  if (!cmd) {
    result.error = 'Unbekannter Befehl. In der Registry nicht gefunden — prüfe Schreibweise oder Suche in der Befehle-Ansicht.';
    result.suggestions = search(nameToken, 5).map((c) => c.name);
    result.ms = Number(process.hrtime.bigint() - t0) / 1e6;
    return result;
  }

  result.valid = true;
  result.resolved = {
    name: cmd.name,
    category: cmd.categoryTitle,
    emoji: cmd.emoji,
    usage: cmd.usage,
    desc: cmd.desc,
    aliases: cmd.aliases,
    perms: cmd.perms,
    cooldown: cmd.cooldown,
    viaAlias: cmd.resolvedViaAlias || null
  };

  /* Pflicht-Argumente aus usage ableiten: „<…>“-Platzhalter und „@user“ */
  const usageTokens = cmd.usage.replace(/^\$/, '').split(/\s+/).slice(1);
  const required = usageTokens
    .filter((t) => t.startsWith('@') || t.startsWith('<'))
    .map((t) => t.replace(/^@/, '').replace(/[<>]/g, '').trim())
    .filter(Boolean);
  result.argsCheck = {
    required,
    provided: args.length,
    ok: args.length >= required.length,
    hint: args.length >= required.length
      ? (args.length === 0 && required.length === 0 ? 'Keine Argumente nötig ✓' : 'Argumente vorhanden ✓')
      : 'Fehlende Argumente: ' + required.slice(args.length).map((r) => '<' + r + '>').join(' ')
  };

  result.permsNote = { all: 'Für alle nutzbar', admin: 'Gruppen-/Admin-Rechte erforderlich', owner: 'NUR Owner' }[cmd.perms] || cmd.perms;
  result.ms = Number(process.hrtime.bigint() - t0) / 1e6;
  return result;
}

/* Beim ersten Import laden & grob validieren */
load();
if (!process.env.LB_REGISTRY_SILENT) {
  const s = stats();
  console.log(`📚 Command-Registry geladen: ${s.commands} Befehle · ${s.aliases} Aliase · ${s.categories} Kategorien (v${s.version}, ${s.updated})`);
}

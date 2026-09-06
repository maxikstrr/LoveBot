/* ═══════════════════════════════════════════════════════════════════════
   🛡️ L O V E B O T   R A T E - L I M I T   (ratelimit.js)
   ─────────────────────────────────────────────────────────────────────
   Schutz gegen Command-Flooding (offene Gruppen!) — gleitendes Zeitfenster
   pro Nutzer, mit eskalierender Sperre bei Wiederholung.

   Regeln:
     · max        Befehle innerhalb windowMs erlaubt
     · danach     Sperre von cooldownMs × Strikes (1×, 2×, 3×, 4× … max 4×)
     · Strikes    verfallen nach strikeWindowMs ohne Verstoß
     · Owner/Host werden in Love.js ausgenommen (exemptHosts)

   Alles im Speicher — kein Datenbankzugriff, kein leak (State wird
   automatisch aufgeräumt).
   ═══════════════════════════════════════════════════════════════════════ */

const CONFIG = {
  max: 10,              /* Befehle pro Fenster            */
  windowMs: 10_000,     /* Fenstergröße (10 s)            */
  cooldownMs: 4_000,    /* Grundsperre (4 s)              */
  maxMultiplier: 4,     /* Sperre maximal 4× cooldownMs   */
  strikeWindowMs: 60_000, /* Strikes verfallen nach 60 s  */
  cleanupMs: 60_000,    /* Aufräumintervall               */
  enabled: true
};

const state = new Map(); /* key → { hits:[], strikes, lastStrike, blockedUntil, lastSeen } */

export function configure(partial = {}) {
  Object.assign(CONFIG, partial || {});
  return { ...CONFIG };
}

export function getConfig() {
  return { ...CONFIG };
}

/**
 * Prüft, ob ein Nutzer jetzt einen Befehl ausführen darf.
 * @returns {{allowed:boolean, remaining:number, retryMs:number, strikes:number, reason:string}}
 */
export function check(key, opts = {}) {
  const id = String(key || 'global');
  if (CONFIG.enabled === false) {
    return { allowed: true, remaining: CONFIG.max, retryMs: 0, strikes: 0, reason: 'disabled' };
  }

  const now = Date.now();
  const max = Number(opts.max || CONFIG.max);
  const windowMs = Number(opts.windowMs || CONFIG.windowMs);

  let entry = state.get(id);
  if (!entry) {
    entry = { hits: [], strikes: 0, lastStrike: 0, blockedUntil: 0, lastSeen: now };
    state.set(id, entry);
  }
  entry.lastSeen = now;

  /* Noch gesperrt? */
  if (entry.blockedUntil > now) {
    return {
      allowed: false,
      remaining: 0,
      retryMs: entry.blockedUntil - now,
      strikes: entry.strikes,
      reason: 'cooldown'
    };
  }

  /* Strikes verfallen lassen */
  if (entry.strikes > 0 && now - entry.lastStrike > CONFIG.strikeWindowMs) {
    entry.strikes = 0;
  }

  /* Fenster bereinigen */
  entry.hits = entry.hits.filter((t) => now - t < windowMs);

  if (entry.hits.length >= max) {
    entry.strikes = Math.min(99, entry.strikes + 1);
    entry.lastStrike = now;
    const mult = Math.min(CONFIG.maxMultiplier, entry.strikes);
    const blockMs = CONFIG.cooldownMs * mult;
    entry.blockedUntil = now + blockMs;
    entry.hits = [];
    return {
      allowed: false,
      remaining: 0,
      retryMs: blockMs,
      strikes: entry.strikes,
      reason: 'flood'
    };
  }

  entry.hits.push(now);
  return {
    allowed: true,
    remaining: Math.max(0, max - entry.hits.length),
    retryMs: 0,
    strikes: entry.strikes,
    reason: 'ok'
  };
}

/** Sperre eines Nutzers aufheben (z. B. nach Owner-Eingriff). */
export function reset(key) {
  const id = String(key || '');
  if (!id) return false;
  return state.delete(id);
}

/** Statistik für $system / Admin-Panel. */
export function stats() {
  const now = Date.now();
  let blocked = 0;
  let tracked = 0;
  for (const [, e] of state) {
    tracked++;
    if (e.blockedUntil > now) blocked++;
  }
  return { tracked, blocked, config: { ...CONFIG } };
}

/* Aufräumen: vergessene Einträge fliegen raus (kein Memory-Leak) */
const cleaner = setInterval(() => {
  const now = Date.now();
  for (const [k, e] of state) {
    const idle = now - (e.lastSeen || 0);
    const stillBlocked = (e.blockedUntil || 0) > now;
    if (!stillBlocked && idle > Math.max(CONFIG.windowMs, CONFIG.strikeWindowMs)) state.delete(k);
  }
}, CONFIG.cleanupMs);
if (typeof cleaner.unref === 'function') cleaner.unref();

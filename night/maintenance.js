/* ============================================================================
   LoveBot — Geteilter Wartungsmodus (ESM)
   ────────────────────────────────────────────────────────────────────────
   EIN zentraler Zustand (Database/maintenance.json), den SOWOHL Love.js
   (WhatsApp-Bot: $offline / $online) ALS AUCH server.js (Website) lesen
   und schreiben. So schaltet ein einziger Befehl im Bot wirklich BEIDE
   Systeme gleichzeitig in den Wartungsmodus — kein getrennter Zustand,
   keine Race-Conditions zwischen Bot und Web.
   ==========================================================================*/
import fs from 'fs';
import path from 'path';

const MAINT_PATH = path.join('Database', 'maintenance.json');

function readState() {
  try {
    const raw = JSON.parse(fs.readFileSync(MAINT_PATH, 'utf8'));
    return {
      on: !!raw.on,
      reason: String(raw.reason || ''),
      since: raw.since || null,
      by: String(raw.by || ''),
      endedAt: raw.endedAt || null
    };
  } catch (e) {
    return { on: false, reason: '', since: null, by: '', endedAt: null };
  }
}

function writeState(state) {
  try {
    fs.mkdirSync('Database', { recursive: true });
    fs.writeFileSync(MAINT_PATH, JSON.stringify(state, null, 2), 'utf8');
  } catch (e) {}
}

/** Aktuellen Wartungsmodus-Zustand lesen (immer frisch von Disk). */
export function getMaintenance() {
  return readState();
}

/** Wartungsmodus AKTIVIEREN — betrifft Bot (nur Owner darf Befehle nutzen)
 *  UND Website (niemand außer Owner kommt rein), synchron. */
export function setMaintenanceOn(reason, by) {
  const state = {
    on: true,
    reason: String(reason || 'Kein Grund angegeben').slice(0, 500),
    since: new Date().toISOString(),
    by: String(by || 'Owner'),
    endedAt: null
  };
  writeState(state);
  return state;
}

/** Wartungsmodus DEAKTIVIEREN — Bot und Website wieder für alle offen. */
export function setMaintenanceOff(by) {
  const state = {
    on: false,
    reason: '',
    since: null,
    by: String(by || 'Owner'),
    endedAt: new Date().toISOString()
  };
  writeState(state);
  return state;
}

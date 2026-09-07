/* ============================================================================
   LoveBot — Gemeinsames Sicherheits-Log (ESM)
   ────────────────────────────────────────────────────────────────────────
   Wird von SOWOHL server.js (Web-Dashboard) ALS AUCH Love.js (WhatsApp-Bot)
   genutzt, damit sicherheitsrelevante Ereignisse aus BEIDEN Systemen im
   selben Owner-Dashboard (Reiter "Security") auftauchen — z. B. blockierte
   Owner-Befehlsversuche, Flood-Sperren, verweigerte Zugriffe im Bot.
   Format: append-only, hash-verkettet (wie audit.jsonl/security.jsonl in
   server.js) — nachträgliches unbemerktes Verändern einer Zeile würde die
   Kette brechen und wäre im Dashboard erkennbar.
   ==========================================================================*/
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const SECURITY_FILE = path.join('Database', 'security.jsonl');

function chainAppend(file, entry) {
  try {
    fs.mkdirSync('Database', { recursive: true });
    let prev = '0'.repeat(64);
    try {
      const lines = fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean);
      if (lines.length) prev = JSON.parse(lines[lines.length - 1]).hash || prev;
    } catch (e) {}
    const base = Object.assign({ time: new Date().toISOString(), prev }, entry);
    base.hash = crypto.createHash('sha256').update(JSON.stringify(base)).digest('hex');
    fs.appendFileSync(file, JSON.stringify(base) + '\n', 'utf8');
  } catch (e) {}
}

/**
 * Schreibt ein Sicherheitsereignis ins gemeinsame Log.
 * @param {string} event  z. B. 'BOT_UNAUTHORIZED_OWNER_CMD', 'BOT_FLOOD_BLOCK'
 * @param {object} extra  z. B. { jid, risk, group, reason }
 */
export function securityEvent(event, extra) {
  chainAppend(SECURITY_FILE, Object.assign({ event, src: 'bot' }, extra || {}));
}

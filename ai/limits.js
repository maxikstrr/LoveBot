/* ═══════════════════════════════════════════════════════════════════
   💜 LoveBot 7.0 — AI LIMITS (ai/limits.js)

   Rate-Limits pro User (Minuten/Stunden-Fenster in-memory, Tages-Zähler
   persistent via ai.json-Stats). Schützt CPU/RAM des Hosts.
   ═══════════════════════════════════════════════════════════════════ */
import { aiConfig, getAiUsage } from './memory.js';

const minWin = new Map();  /* bid -> [stamps] */
const hourWin = new Map(); /* bid -> [stamps] */

function prune(map, bid, windowMs, now) {
  let arr = map.get(bid);
  if (!arr) { arr = []; map.set(bid, arr); }
  while (arr.length && now - arr[0] > windowMs) arr.shift();
  if (map.size > 5000) map.clear();
  return arr;
}

export function aiLimitCheck(bid, now = Date.now()) {
  const cfg = aiConfig();
  const perMin = Number(cfg.perMin) || 6;
  const perHour = Number(cfg.perHour) || 60;
  const perDay = Number(cfg.perDay) || 200;
  const m = prune(minWin, bid, 60000, now);
  if (m.length >= perMin) {
    return { ok: false, reason: 'per-minute', retryMs: 60000 - (now - m[0]), limit: perMin };
  }
  const h = prune(hourWin, bid, 3600000, now);
  if (h.length >= perHour) {
    return { ok: false, reason: 'per-hour', retryMs: 3600000 - (now - h[0]), limit: perHour };
  }
  try {
    const u = getAiUsage(bid);
    if ((u.today || 0) >= perDay) {
      return { ok: false, reason: 'per-day', retryMs: 0, limit: perDay };
    }
  } catch (e) {}
  return { ok: true, perMin, perHour, perDay };
}

export function aiLimitConsume(bid, now = Date.now()) {
  prune(minWin, bid, 60000, now).push(now);
  prune(hourWin, bid, 3600000, now).push(now);
}

/* Nur für Tests: Fenster zurücksetzen */
export function _resetAiLimits() {
  minWin.clear();
  hourWin.clear();
}

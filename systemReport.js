import os from 'node:os';
import process from 'node:process';
import { collectSystem } from './health.js';
import { systemStats } from './features.js';

const UNKNOWN = 'UNKNOWN';

export function formatBytes(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value < 0) return UNKNOWN;
  if (value < 1024) return `${Math.round(value)} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let amount = value;
  let index = -1;
  do {
    amount /= 1024;
    index++;
  } while (amount >= 1024 && index < units.length - 1);
  return `${amount.toFixed(amount >= 100 ? 0 : amount >= 10 ? 1 : 2)} ${units[index]}`;
}

export function formatDurationCompact(ms) {
  const totalSeconds = Math.max(0, Math.floor(Number(ms) / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days) return `${days}d ${hours}h`;
  if (hours) return `${hours}h ${minutes}m`;
  if (minutes) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function wsStatus(sock) {
  const state = sock?.ws?.readyState;
  if (state === 1) return ['🟢', 'CONNECTED'];
  if (state === 0) return ['🟡', 'CONNECTING'];
  if (state === 2 || state === 3) return ['🔴', state === 2 ? 'CLOSING' : 'CLOSED'];
  return ['⚪', UNKNOWN];
}

function safeNumber(value, digits = 1) {
  return Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : UNKNOWN;
}

export async function buildSystemReport({ db, sock, sessionName = 'LoveBot' } = {}) {
  const [system, memory] = await Promise.all([
    collectSystem().catch(() => null),
    Promise.resolve(process.memoryUsage())
  ]);
  const stats = systemStats(db || {}, system?.uptimeSec ? system.uptimeSec * 1000 : process.uptime() * 1000);
  const [wsEmoji, wsLabel] = wsStatus(sock);
  const dbLoaded = !!db && typeof db === 'object';
  const systemOk = !!system;
  const status = systemOk && dbLoaded ? '🟢 ALL SYSTEMS OPERATIONAL' : '🟡 DEGRADED — PARTIAL DATA';

  return {
    status,
    sessionName,
    wsEmoji,
    wsLabel,
    system,
    memory,
    stats,
    dbLoaded,
    process: {
      pid: process.pid,
      hostname: os.hostname(),
      execPath: process.execPath,
      node: process.version,
      platform: process.platform,
      arch: process.arch
    }
  };
}

export function renderSystemReport(report) {
  const s = report?.system;
  const m = report?.memory || {};
  const stats = report?.stats || {};
  const p = report?.process || {};
  const heap = s ? formatBytes(s.heapMb * 1024 * 1024) : formatBytes(m.heapUsed);
  const rss = s ? formatBytes(s.ramMb * 1024 * 1024) : formatBytes(m.rss);
  const cpu = s?.cpu != null ? `${safeNumber(s.cpu)} %` : UNKNOWN;
  const uptime = s?.uptimeSec != null ? formatDurationCompact(s.uptimeSec * 1000) : UNKNOWN;
  const line = (label, value) => `   ${label.padEnd(15)} ${value}`;
  const lines = [
    '╭────────────────────────────────╮',
    '│ ✦ LOVE•BOT · SYSTEM STATUS     │',
    '╰────────────────────────────────╯',
    '',
    `${report?.status || '⚪ UNKNOWN'}`,
    '',
    'SYSTEM',
    line('OS', s?.platform || UNKNOWN),
    line('NODE.JS', s?.node || p.node || UNKNOWN),
    line('ARCH', s?.arch || p.arch || UNKNOWN),
    line('PID', p.pid ?? UNKNOWN),
    line('HOSTNAME', p.hostname || UNKNOWN),
    '',
    'RESOURCES',
    line('CPU', cpu),
    line('RSS', rss),
    line('HEAP USED', heap),
    line('EXTERNAL', formatBytes(m.external)),
    line('UPTIME', uptime),
    '',
    'LOVE BOT',
    line('USERS', stats.totalUsers ?? UNKNOWN),
    line('REGISTERED', stats.registeredUsers ?? UNKNOWN),
    line('GROUPS', stats.totalGroups ?? UNKNOWN),
    line('ACTIVE GROUPS', stats.activeGroups ?? UNKNOWN),
    line('BANS', stats.totalBans ?? UNKNOWN),
    '',
    'CONNECTIONS',
    line('WHATSAPP', `${report?.wsEmoji || '⚪'} ${report?.wsLabel || UNKNOWN}`),
    line('DATABASE', report?.dbLoaded ? '🟢 LOADED' : '🔴 UNAVAILABLE'),
    '',
    `Session ${report?.sessionName || UNKNOWN} · ${new Date().toLocaleTimeString('de-DE')}`
  ];
  return lines.join('\n');
}

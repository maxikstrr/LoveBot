/* ═══════════════════════════════════════════════════════════════════
   💜 LoveBot 7.0 — GROUP BUILDERS (groupstats.js)

   WhatsApp-Karten für das Gruppen-System. Reine Anzeige — Daten kommen
   aus groups.js + live groupMetadata. Keine Fake-Werte: fehlende Daten
   werden als „–" gezeigt.
   ═══════════════════════════════════════════════════════════════════ */
import { getGset, groupLevelInfo, topMembers, activeEvents, goalTarget, GROUP_ACHIEVEMENTS, GROUP_BADGES } from './groups.js';

const fmt = (n) => Number(n || 0).toLocaleString('de-DE');
const onOff = (v) => (v ? '✅' : '❌');
const bar = (have, need, w = 14) => {
  const p = need > 0 ? Math.min(1, have / need) : 0;
  const f = Math.round(p * w);
  return '█'.repeat(f) + '░'.repeat(w - f);
};

/* ── 👥 GROUP CENTER ($am) ────────────────────────────────────────── */
export function buildGroupCenter(g, meta = {}, { pref = '$' } = {}) {
  const s = getGset(g);
  const li = groupLevelInfo(g);
  const top = topMembers(g, 'xp', 1)[0];
  const ev = activeEvents(g);
  return '╭──── 👥 *GROUP CENTER* ────╮\n\n' +
    '🏠 *GROUP*\n' +
    `Name: ${meta.subject || '–'}\n` +
    `Mitglieder: ${fmt(meta.count)} · Admins: ${fmt(meta.admins)}\n` +
    `Owner: ${meta.owner || '–'}\n` +
    `Erstellt: ${meta.creation || '–'}\n` +
    `Status: ${ev.length ? '🔥 Event aktiv' : '💜 Aktiv'}\n\n` +
    '━━━━━━━━━━━━━━━━━━\n\n' +
    '🛡 *SECURITY*\n' +
    `Anti-Spam ${onOff(s.antispam)} · Anti-Link ${onOff(s.antilink)}\n` +
    `Anti-Flood ${onOff(s.antiflood)} · Mention ${onOff(s.mentionGuard)}\n` +
    `Cmd-Schutz ${onOff(s.commandProtection)} · AutoMod ${onOff(s.automod)}\n\n` +
    '━━━━━━━━━━━━━━━━━━\n\n' +
    '🤖 *AUTOMATION*\n' +
    `Welcome ${onOff(s.welcome)} · Goodbye ${onOff(s.goodbye)}\n` +
    `Auto-Reply ${onOff(s.autoreply)} · AI ${onOff(s.aiEnabled)}\n\n` +
    '━━━━━━━━━━━━━━━━━━\n\n' +
    '🏆 *GROUP PROGRESSION*\n' +
    `Level ${li.level} · ${fmt(li.total)} XP\n` +
    `Nachrichten: ${fmt(g?.xp?.msgs)} · Spiele: ${fmt(g?.xp?.games)}\n` +
    `Top: ${top ? fmt(top.xp) + ' XP' : '–'}\n` +
    `Ziele: ${g?.goals?.daily?.claimed ? '✅' : '🎯'} Daily · ${g?.goals?.weekly?.claimed ? '✅' : '🎯'} Weekly\n\n` +
    '━━━━━━━━━━━━━━━━━━\n\n' +
    '💰 *GROUP ECONOMY*\n' +
    `Kasse: ${fmt(g?.gtreasury?.balance)} Kupfer\n` +
    `Events: ${ev.length ? ev.map((e) => e.name).join(', ') : '–'}\n\n` +
    `╰── ${pref}gsettings · ${pref}gxp · ${pref}gtop ──╯`;
}

/* ── 👥 GROUP INFO ($groupinfo massiv) ────────────────────────────── */
export function buildGroupInfo(g, meta = {}, { pref = '$', topNames = {} } = {}) {
  const s = getGset(g);
  const li = groupLevelInfo(g);
  const achN = Object.keys(g?.gach || {}).length;
  const bdg = Object.keys(g?.gbadges || {});
  const top = topMembers(g, 'xp', 3);
  const medal = ['🥇', '🥈', '🥉'];
  const topTxt = top.length
    ? top.map((t, i) => `${medal[i]} ${topNames[t.bid] || '–'} — ${fmt(t.xp)} XP`).join('\n')
    : 'Noch keine Aktivität.';
  const bdgTxt = bdg.length
    ? bdg.map((id) => { const d = GROUP_BADGES.find((b) => b.id === id); return d ? `${d.emoji} ${d.name}` : id; }).join(' · ')
    : '–';
  const activity = (g?.xp?.streak?.c || 0) >= 7 ? '🔥 Hoch' : (g?.xp?.msgs || 0) > 100 ? '💜 Normal' : '🌱 Startet';
  return '╭──── 👥 *GROUP INFO* ────╮\n\n' +
    `🏠 *${meta.subject || '–'}*\n` +
    (meta.desc ? `${String(meta.desc).slice(0, 120)}\n` : '') +
    `\n👥 Mitglieder: ${fmt(meta.count)}\n` +
    `👑 Owner: ${meta.owner || '–'}\n` +
    `🛡 Admins: ${fmt(meta.admins)}\n` +
    `📅 Erstellt: ${meta.creation || '–'}\n` +
    `🔥 Aktivität: ${activity}\n` +
    `🏆 Group Level: ${li.level}\n` +
    `✨ Group XP: ${fmt(li.total)}\n\n` +
    '━━━━━━━━━━━━━━━━━━\n\n' +
    '🛡 *SECURITY*\n' +
    `Anti-Spam ${onOff(s.antispam)} · Anti-Link ${onOff(s.antilink)} · Anti-Flood ${onOff(s.antiflood)}\n\n` +
    '━━━━━━━━━━━━━━━━━━\n\n' +
    '🏆 *TOP MEMBERS*\n' + topTxt + '\n\n' +
    '━━━━━━━━━━━━━━━━━━\n\n' +
    '💰 *GROUP ECONOMY*\n' +
    `Kasse: ${fmt(g?.gtreasury?.balance)} Kupfer\n\n` +
    '━━━━━━━━━━━━━━━━━━\n\n' +
    '🤖 *AI*\n' +
    `AI ${onOff(s.aiEnabled)} · XP ${onOff(s.progressionEnabled)} · Economy ${onOff(s.economyEnabled)}\n\n` +
    `🏅 ${achN}/${GROUP_ACHIEVEMENTS.length} Achievements · ${bdgTxt}\n\n` +
    `╰── ${pref}am · ${pref}gtop · ${pref}glevel ──╯`;
}

/* ── ⚙️ GROUP SETTINGS ────────────────────────────────────────────── */
export function buildGroupSettings(g, { pref = '$' } = {}) {
  const s = getGset(g);
  const row = (k, label) => `${onOff(s[k])} *${label}* — \`${pref}gsettings ${k} on/off\``;
  return '👥 *GROUP SETTINGS*\n\n' +
    row('antilink', 'Anti-Link') + '\n' +
    row('antispam', 'Anti-Spam') + '\n' +
    row('antiflood', 'Anti-Flood') + '\n' +
    row('mentionGuard', 'Mention-Guard') + '\n' +
    row('commandProtection', 'Command-Schutz') + '\n' +
    row('automod', 'Auto-Mod') + '\n' +
    row('welcome', 'Welcome') + '\n' +
    row('goodbye', 'Goodbye') + '\n' +
    row('autoreply', 'Auto-Reply') + '\n' +
    row('aiEnabled', 'AI') + '\n' +
    row('economyEnabled', 'Economy') + '\n' +
    row('progressionEnabled', 'Group-XP') + '\n' +
    row('logsEnabled', 'Audit-Log') + '\n' +
    `\nNur Gruppen-Admins können ändern. Stand: ${new Date().toLocaleDateString('de-DE')}`;
}

/* ── 🏆 GXP / GLEVEL / GTOP ───────────────────────────────────────── */
export function buildGxp(g, memberCount = 0) {
  const li = groupLevelInfo(g);
  return '🏆 *GROUP XP*\n\n' +
    `✨ Gesamt: ${fmt(li.total)} XP (Level ${li.level})\n` +
    `💬 Nachrichten: ${fmt(g?.xp?.msgs)}\n` +
    `👥 Aktive Mitglieder: ${fmt(Object.keys(g?.xp?.members || {}).length)}${memberCount ? ` / ${fmt(memberCount)}` : ''}\n` +
    `🔥 Serie: ${fmt(g?.xp?.streak?.c)} Tage\n` +
    `📆 Wochen-XP: ${fmt(g?.xp?.week?.xp)}\n` +
    `🗓 Monats-XP: ${fmt(g?.xp?.month?.xp)}`;
}

export function buildGlevel(g) {
  const li = groupLevelInfo(g);
  const nextBonus = 100 + (li.level + 1) * 10;
  return '👥 *GROUP LEVEL*\n\n' +
    `*Level ${li.level}*\n\n` +
    `${fmt(li.have)} / ${fmt(li.need)} XP\n` +
    bar(li.have, li.need) + '\n\n' +
    `Nächster Reward: +${fmt(nextBonus)} Kupfer in die Gruppenkasse`;
}

export function buildGtop(rows, names = {}, mode = 'xp') {
  const label = mode === 'messages' ? 'Nachrichten' : mode === 'games' ? 'Spiele' : 'Group-XP';
  const medal = ['🥇', '🥈', '🥉'];
  const lines = rows.map((r, i) => {
    const v = mode === 'messages' ? r.m : mode === 'games' ? r.games : r.xp;
    const pre = medal[i] || `*${i + 1}.*`;
    return `${pre} ${names[r.bid] || '–'} — ${fmt(v)}`;
  });
  return `🏆 *GROUP TOP — ${label}*\n\n` + (lines.join('\n') || 'Noch keine Aktivität.') +
    '\n\n Modi: `xp` · `messages` · `games`';
}

/* ── 🎯 GROUP GOALS ───────────────────────────────────────────────── */
export function buildGroupGoal(g, memberCount = 0) {
  const d = g?.goals?.daily, w = g?.goals?.weekly;
  const dt = goalTarget('daily', memberCount), wt = goalTarget('weekly', memberCount);
  const dp = d?.progress || 0, wp = w?.progress || 0;
  return '🎯 *GROUP GOALS*\n\n' +
    `*Daily:* ${fmt(dp)} / ${fmt(dt)} Nachrichten\n` + bar(dp, dt) + '\n' +
    `Reward: +250 Kupfer ${d?.claimed ? '✅' : ''}\n\n` +
    `*Weekly:* ${fmt(wp)} / ${fmt(wt)} XP\n` + bar(wp, wt) + '\n' +
    `Reward: +1.000 Kupfer ${w?.claimed ? '✅' : ''}`;
}

/* ── 🧾 AUDIT ─────────────────────────────────────────────────────── */
export function buildGroupAudit(g, n = 8) {
  const rows = (g?.gaudit || []).slice(-n).reverse();
  if (!rows.length) return '🧾 *GROUP AUDIT*\n\nNoch keine Einträge.';
  const lines = rows.map((e) => {
    const t = new Date(e.ts).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    return `• ${t} — *${e.action}* (${e.actor || 'system'})${e.detail ? `\n  ${e.detail}` : ''}`;
  });
  return '🧾 *GROUP AUDIT*\n\n' + lines.join('\n');
}

/* ── 👥 MEMBERS / ADMINS ──────────────────────────────────────────── */
export function buildMembersCard(parts = [], admins = [], { limit = 30 } = {}) {
  const adminSet = new Set(admins);
  const shown = parts.slice(0, limit);
  const lines = shown.map((p) => `${adminSet.has(p.id) ? '👑' : '•'} ${p.name || p.id}`);
  return `👥 *MEMBERS (${parts.length})*\n\n` + (lines.join('\n') || '–') +
    (parts.length > limit ? `\n\n… +${parts.length - limit} weitere` : '');
}

/* ── 💰 GROUP ECONOMY ─────────────────────────────────────────────── */
export function buildGroupEconomy(g) {
  const t = g?.gtreasury || { balance: 0, log: [] };
  const last = (t.log || []).slice(-5).reverse()
    .map((e) => `• ${e.delta > 0 ? '+' : ''}${fmt(e.delta)} — ${e.reason || ''}`).join('\n');
  return '💰 *GROUP ECONOMY*\n\n' +
    `🏦 Kasse: *${fmt(t.balance)}* Kupfer\n\n` +
    '*Letzte Bewegungen:*\n' + (last || '–');
}

/* ── 🔥 EVENTS ────────────────────────────────────────────────────── */
export function buildGroupEvents(g, now = Date.now()) {
  const ev = activeEvents(g, now);
  if (!ev.length) return '🔥 *GROUP EVENTS*\n\nGerade läuft kein Event.\nAdmins: `$gevent 2 60` startet 2× XP für 60 Min.';
  const lines = ev.map((e) => {
    const mins = Math.max(1, Math.round((e.endsAt - now) / 60000));
    return `🔥 *${e.name}* — ×${e.mult} XP\n   noch ~${mins} Min. (von ${e.startedBy || '–'})`;
  });
  return '🔥 *GROUP EVENTS*\n\n' + lines.join('\n\n');
}

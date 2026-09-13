/* ═══════════════════════════════════════════════════════════════════
   🎫 LoveBot 7.1.3 — TICKET-SYSTEM (tickets.js)

   Support-Tickets von Nutzern → Team (Supporter/Deputy/Owner) bearbeitet.

   · Speicher: Database/tickets.json (nextId, tickets[], config.devGroup)
   · Rechte (night/rbac.js): 'tickets.manage' → supporter, deputy, owner
     (Supporter DARF NUR das: lesen · beantworten · schließen · reopen)
   · Ränge vergibt weiterhin NUR der Owner ($setteam) — Deputy nicht!
   · Neue Tickets postet der Bot in die Dev-Gruppe (config.devGroup),
     Antworten/Status gehen per DM an den Ersteller.

   Ticket: { id:'T-0001', creatorJid, creatorName, bid, text,
             status:'open'|'closed', answers:[{by,byName,role,text,at}],
             createdAt, updatedAt, closedAt, closedBy, closedReason }
   ═══════════════════════════════════════════════════════════════════ */
import fs from 'fs';
import path from 'path';

const FILE = path.join('Database', 'tickets.json');

function load() {
  try {
    const st = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    st.tickets = Array.isArray(st.tickets) ? st.tickets : [];
    st.config = st.config || {};
    st.nextId = Number(st.nextId) || 1;
    return st;
  } catch (e) {
    return { nextId: 1, tickets: [], config: { devGroup: '' } };
  }
}

function save(st) {
  try {
    fs.mkdirSync('Database', { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(st, null, 2), 'utf8');
  } catch (e) {}
}

function ticketId(n) {
  return 'T-' + String(n).padStart(4, '0');
}

function cleanJid(jid = '') {
  return String(jid || '').split(':')[0].replace(/@\.(.*)$/, '$1');
}

/* ── Dev-Gruppe (Ziel für neue Tickets) ───────────────────────────── */
export function getDevGroup() {
  return String(load().config.devGroup || '');
}

export function setDevGroup(gid = '') {
  const st = load();
  let g = String(gid || '').trim();
  if (g && !g.endsWith('@g.us')) g = g.replace(/^(\d+)@?.*$/, '$1') + '@g.us';
  if (g && !/^\d+@g\.us$/.test(g)) return { ok: false, error: 'invalid-gid' };
  st.config.devGroup = g;
  save(st);
  return { ok: true, devGroup: g };
}

/* ── CRUD ─────────────────────────────────────────────────────────── */
export function createTicket({ creatorJid = '', creatorName = '–', bid = '', text = '' } = {}) {
  const t = String(text || '').trim().slice(0, 1500);
  if (!t) return { ok: false, error: 'empty' };
  const jid = cleanJid(creatorJid);
  if (!jid) return { ok: false, error: 'no-creator' };
  const st = load();
  const now = new Date().toISOString();
  const ticket = {
    id: ticketId(st.nextId++),
    creatorJid: jid,
    creatorName: String(creatorName).slice(0, 60) || '–',
    bid: String(bid || '').slice(0, 40),
    text: t,
    status: 'open',
    answers: [],
    createdAt: now,
    updatedAt: now
  };
  st.tickets.unshift(ticket); /* neueste zuerst */
  if (st.tickets.length > 500) st.tickets = st.tickets.slice(0, 500);
  save(st);
  return { ok: true, ticket };
}

export function getTicket(id = '') {
  const st = load();
  const ticket = st.tickets.find((x) => x.id === String(id).trim().toUpperCase());
  return ticket ? { ok: true, ticket } : { ok: false, error: 'not-found' };
}

export function listTickets({ status = 'all', creatorJid = '' } = {}) {
  let list = load().tickets;
  if (status === 'open' || status === 'closed') list = list.filter((t) => t.status === status);
  if (creatorJid) list = list.filter((t) => t.creatorJid === cleanJid(creatorJid));
  return list;
}

export function ticketStats() {
  const list = load().tickets;
  const today = new Date().toISOString().slice(0, 10);
  return {
    total: list.length,
    open: list.filter((t) => t.status === 'open').length,
    closed: list.filter((t) => t.status === 'closed').length,
    today: list.filter((t) => t.createdAt.slice(0, 10) === today).length
  };
}

/* Team-Aktion: Antwort anhängen (Rolle wird vom Aufrufer geprüft!) */
export function answerTicket({ id = '', by = '', byName = 'Team', role = 'supporter', text = '' } = {}) {
  const r = getTicket(id);
  if (!r.ok) return r;
  const t = String(text || '').trim().slice(0, 1500);
  if (!t) return { ok: false, error: 'empty' };
  r.ticket.answers.push({
    by: cleanJid(by), byName: String(byName).slice(0, 60) || 'Team',
    role: String(role).slice(0, 20), text: t, at: new Date().toISOString()
  });
  r.ticket.status = 'open'; /* beantwortete bleiben offen bis close */
  r.ticket.updatedAt = new Date().toISOString();
  const st = load();
  const i = st.tickets.findIndex((x) => x.id === r.ticket.id);
  if (i !== -1) { st.tickets[i] = r.ticket; save(st); }
  return { ok: true, ticket: r.ticket };
}

export function closeTicket({ id = '', by = '', byName = 'Team', role = 'supporter', reason = '' } = {}) {
  const r = getTicket(id);
  if (!r.ok) return r;
  if (r.ticket.status === 'closed') return { ok: false, error: 'already-closed' };
  r.ticket.status = 'closed';
  r.ticket.closedAt = new Date().toISOString();
  r.ticket.closedBy = { jid: cleanJid(by), name: byName, role };
  r.ticket.closedReason = String(reason || '').slice(0, 500);
  r.ticket.updatedAt = r.ticket.closedAt;
  const st = load();
  const i = st.tickets.findIndex((x) => x.id === r.ticket.id);
  if (i !== -1) { st.tickets[i] = r.ticket; save(st); }
  return { ok: true, ticket: r.ticket };
}

export function reopenTicket({ id = '', by = '', byName = 'Team', role = 'supporter' } = {}) {
  const r = getTicket(id);
  if (!r.ok) return r;
  if (r.ticket.status !== 'closed') return { ok: false, error: 'not-closed' };
  r.ticket.status = 'open';
  r.ticket.reopenedAt = new Date().toISOString();
  r.ticket.reopenedBy = { jid: cleanJid(by), name: byName, role };
  r.ticket.updatedAt = r.ticket.reopenedAt;
  const st = load();
  const i = st.tickets.findIndex((x) => x.id === r.ticket.id);
  if (i !== -1) { st.tickets[i] = r.ticket; save(st); }
  return { ok: true, ticket: r.ticket };
}

/* ── WhatsApp-Texte (Bot & Dev-Gruppe) ────────────────────────────── */
export function ticketDevMessage(ticket) {
  const d = new Date(ticket.createdAt);
  const date = d.toLocaleDateString('de-DE') + ' ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const answers = ticket.answers.length
    ? '\n\n_Antworten:_\n' + ticket.answers.map((a) => '• ' + a.byName + ' (' + a.role + '): ' + a.text.slice(0, 150)).join('\n')
    : '';
  return '> 🎫 *NEUES TICKET* ' + ticket.id + '\n┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈\n' +
    'Von: *' + ticket.creatorName + '* (+' + ticket.creatorJid.split('@')[0] + ')\n' +
    'Datum: ' + date + '\n┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈\n' +
    ticket.text + answers + '\n┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈\n' +
    '_Antworten:_ *$ticket answer ' + ticket.id + ' <text>*\n_Schließen:_ *$ticket close ' + ticket.id + '*';
}

export function ticketAnswerDm(ticket, answer) {
  return '> 🎫 *ANTWORT AUF DEIN TICKET* ' + ticket.id + '\n┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈\n' +
    '_Deine Anfrage:_\n' + ticket.text.slice(0, 300) + '\n┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈\n' +
    '*' + answer.byName + '* (' + answer.role + ') hat geantwortet:\n' + answer.text + '\n┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈\n' +
    '_Status:_ offen · _Nachfragen:_ *$ticket info ' + ticket.id + '*';
}

export function ticketClosedDm(ticket) {
  return '> 🎫 *TICKET GESCHLOSSEN* ' + ticket.id + '\n┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈\n' +
    '_Deine Anfrage:_\n' + ticket.text.slice(0, 200) + '\n┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈\n' +
    'Geschlossen von: *' + (ticket.closedBy?.name || 'Team') + '*\n' +
    (ticket.closedReason ? 'Grund: ' + ticket.closedReason + '\n' : '') +
    '┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈\nBei Fragen einfach ein neues Ticket: *$ticket <text>*';
}

export function ticketListText(list, { title = 'TICKETS' } = {}) {
  if (!list.length) return '> 🎫 *' + title + '*\n\nKeine Tickets — alles ruhig hier 💜';
  const lines = list.slice(0, 15).map((t) => {
    const d = t.createdAt.slice(0, 10);
    const status = t.status === 'open' ? '🟢' : '🔒';
    const ans = t.answers.length ? ' · ' + t.answers.length + ' Antworten' : '';
    return status + ' *' + t.id + '* · ' + t.creatorName + ' · ' + d + ans + '\n   ↳ ' + t.text.slice(0, 60) + (t.text.length > 60 ? '…' : '');
  });
  return '> 🎫 *' + title + '* (' + list.length + ')\n┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈\n' + lines.join('\n') +
    (list.length > 15 ? '\n\n… und ' + (list.length - 15) + ' weitere' : '') +
    '\n┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈\n_Details:_ *$ticket info <id>*';
}

export function ticketInfoText(t) {
  const answers = t.answers.length
    ? t.answers.map((a) => '💬 *' + a.byName + '* (' + a.role + ', ' + a.at.slice(0, 16).replace('T', ' ') + '):\n' + a.text).join('\n\n')
    : '_Noch keine Antworten._';
  return '> 🎫 *TICKET* ' + t.id + ' · ' + (t.status === 'open' ? '🟢 OFFEN' : '🔒 GESCHLOSSEN') + '\n┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈\n' +
    'Von: *' + t.creatorName + '* (+' + t.creatorJid.split('@')[0] + ')\n' +
    'Erstellt: ' + t.createdAt.slice(0, 16).replace('T', ' ') + '\n' +
    (t.status === 'closed' ? 'Geschlossen: ' + (t.closedAt || '').slice(0, 16).replace('T', ' ') + ' von ' + (t.closedBy?.name || '?') + (t.closedReason ? ' — ' + t.closedReason : '') + '\n' : '') +
    '┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈\n_' + t.text + '_\n┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈\n' + answers;
}

/* Für Tests */
export function _resetTickets() {
  try { fs.unlinkSync(FILE); } catch (e) {}
}
export function _ticketsFile() { return FILE; }

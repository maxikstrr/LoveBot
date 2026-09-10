/* ═══════════════════════════════════════════════════════════════════════
   📡 K A N A L - S P I E G E L   (channelrelay.js)
   ─────────────────────────────────────────────────────────────────────
   Spiegelt JEDE neue Veröffentlichung aus deinem WhatsApp-Kanal
   (@newsletter) automatisch in die Chats, in denen LoveBot mit dem
   OWNER aktiv ist — „jede Nachricht kommt an den Ort, wo er soll“:

     · Privater Chat des Owners  → Post kommt NUR dort an
     · Gruppe, in der der Owner mit LoveBot schreibt → wird automatisch
       angemeldet, Post kommt NUR in genau dieser Gruppe an
     · KEINE doppelte Zustellung · läuft IMMER (kein Befehl nötig)

   Weitergeleitet wird ALLES aus dem Kanal:
     📷 Bilder · 🎬 Videos · 🎵 Audios/Sprachnachrichten · 🏷️ Sticker ·
     📄 Dokumente · 💬 Texte · 👤 Kontakte · 📍 Standorte u. v. m.

   Konfiguration liegt in  Database/Database.json → meta.channelRelay:
     enabled  – true/false (Standard: true)
     sources  – Kanal-JIDs, die gespiegelt werden
                (Standard: der LoveBot-Kanal von Maxichen)
     targets  – zusätzliche feste Ziel-JIDs (z. B. Gruppen)
   Der private Owner-Chat ist IMMER Ziel und lässt sich nicht entfernen.

   ═══════════════════════════════════════════════════════════════════════ */

import {
  getContentType,
  getChatId,
  areJidsSameUser,
  jidNormalizedUser,
  downloadMediaMessage,
  normalizeMessageContent
} from './waApi.js';
import { readDb, writeDb } from './features.js';
import c from './colorApi.js';

/* ─────────────────────────────────────────────────────────────────────
   Konstanten (mit Love.js OWNER_CONFIG synchron halten)
   ───────────────────────────────────────────────────────────────────── */
const OWNER_NUMBER = '4915155894714';
const OWNER_JID = `${OWNER_NUMBER}@s.whatsapp.net`;
const OWNER_LID = '269574108926096@lid';

/* Standard-Quelle: der LoveBot-Kanal von Maxichen. Weitere Kanäle können
   in der Datenbank unter meta.channelRelay.sources ergänzt werden. */
const DEFAULT_CHANNEL_SOURCES = ['120363410467332304@newsletter'];

/* Keine Weiterleitung für System-/Protokoll-Hüllen (Edits, Reaktionen,
   Stubs, Verschlüsselungs-, Verlauf-Sync usw.) — nur echte Inhalte. */
const SKIP_CONTENT_TYPES = new Set([
  'protocolMessage',
  'reactionMessage',
  'encReactionMessage',
  'pollUpdateMessage',
  'senderKeyDistributionMessage',
  'historySyncNotification',
  'stickerSyncRerequestMessage',
  'chat',
  'messageContextInfo',
  'keepInChatMessage',
  'unavailableMessage',
  'eventMessage',
  'peersMessage'
]);

/* Kurzzeit-Gedächtnis für Message-IDs → verhindert doppelte Zustellung,
   falls WhatsApp einen Post mehrfach als Upsert liefert. */
const recentMessageIds = new Map(); // key.id → Zeitstempel (ms)

/* ─────────────────────────────────────────────────────────────────────
   Konfiguration (Database.json → meta.channelRelay)
   ───────────────────────────────────────────────────────────────────── */
function normalizeConfig(cfg) {
  if (!cfg || typeof cfg !== 'object') cfg = {};
  if (typeof cfg.enabled !== 'boolean') cfg.enabled = true;
  if (!Array.isArray(cfg.sources)) cfg.sources = DEFAULT_CHANNEL_SOURCES.slice();
  if (!Array.isArray(cfg.targets)) cfg.targets = [];
  cfg.sources = cfg.sources.map((s) => String(s).trim()).filter(Boolean);
  cfg.targets = cfg.targets.map((s) => String(s).trim()).filter(Boolean);
  return cfg;
}

function readConfig() {
  try {
    const db = readDb();
    if (!db.meta || typeof db.meta !== 'object') return normalizeConfig({});
    const cfg = normalizeConfig(db.meta.channelRelay);
    db.meta.channelRelay = cfg;
    return cfg;
  } catch (e) {
    return normalizeConfig({});
  }
}

/* Setzt die Standard-Konfiguration, falls noch keine existiert.
   Beim ersten Start werden die bereits bekannten Gruppen (aus der DB,
   in denen LoveBot Mitglied ist) als Spiegel-Ziele vorgemerkt —
   zusätzlich melden sich Gruppen automatisch an, sobald der Owner dort
   schreibt. Wird beim Bot-Start einmal aufgerufen. */
export function seedChannelRelay() {
  try {
    const db = readDb();
    if (db.meta && db.meta.channelRelay && typeof db.meta.channelRelay === 'object') {
      db.meta.channelRelay = normalizeConfig(db.meta.channelRelay);
      return db.meta.channelRelay;
    }
    const cfg = normalizeConfig({});
    /* Bestehende echte Gruppen als Start-Ziele (DB speichert teils nur
       die reine Gruppen-ID ohne Suffix → zu voller JID ergänzen). */
    const knownGroups = Object.keys(db.groups || {})
      .map((g) => String(g).trim())
      .map((g) => (/@g\.us$/i.test(g) ? g : (/^\d{10,}$/.test(g) ? `${g}@g.us` : null)))
      .filter(Boolean);
    for (const g of knownGroups) {
      const norm = jidNormalizedUser(g) || g;
      if (!cfg.targets.includes(norm)) cfg.targets.push(norm);
    }
    db.meta.channelRelay = cfg;
    writeDb(db);
    return cfg;
  } catch (e) {
    return normalizeConfig({});
  }
}

/* Kurzer Status-Text fürs Konsolen-Log beim Start. */
export function channelRelayStatusText() {
  const cfg = readConfig();
  const targets = resolveTargetJids(cfg);
  if (cfg.enabled === false) {
    return '📡 Kanal-Spiegel: AUS (meta.channelRelay.enabled = false)';
  }
  const channels = cfg.sources.length ? cfg.sources.join(', ') : '(keine)';
  return `📡 Kanal-Spiegel AKTIV → Kanal(e): ${channels} · Ziel(e): ${targets.length}`;
}

/* ─────────────────────────────────────────────────────────────────────
   Ziel-Ermittlung
   Der Owner-Chat ist IMMER dabei; dazu alle gemerkten Ziel-JIDs
   (Gruppen, in denen der Owner mit dem Bot schreibt, sowie manuell
   eingetragene Ziele). Zurück in den Kanal wird nie gesendet.
   ───────────────────────────────────────────────────────────────────── */
function resolveTargetJids(cfg) {
  const set = new Set();
  set.add(OWNER_JID); // privater Owner-Chat — immer Ziel
  for (const raw of cfg.targets || []) {
    const s = String(raw || '').trim();
    if (!s) continue;
    const low = s.toLowerCase();
    if (low.endsWith('@newsletter')) continue; // nie in den Kanal zurück
    if (low === 'status@broadcast') continue;
    set.add(jidNormalizedUser(s) || s);
  }
  return Array.from(set);
}

function isOwnerSenderKey(msg) {
  try {
    const candidates = [
      msg?.key?.participant,
      msg?.key?.participantAlt,
      msg?.key?.remoteJid
    ];
    for (const cand of candidates) {
      const s = String(cand || '').trim();
      if (!s) continue;
      if (s === OWNER_LID) return true;
      try {
        if (areJidsSameUser(s, OWNER_JID)) return true;
      } catch (e) {}
      /* Nummer exakt (z. B. „4915155894714@s.whatsapp.net“, mit/ohne
         Vorwahl/Formatierungen) — aber niemals bei @lid, dort ist die
         Nummer nicht die Telefonnummer. */
      if (s.toLowerCase().endsWith('@lid')) continue;
      const digits = s.split('@')[0].split(':')[0].replace(/\D+/g, '');
      if (digits.length >= 8 && digits === OWNER_NUMBER) return true;
    }
  } catch (e) {}
  return false;
}

/* ─────────────────────────────────────────────────────────────────────
   Owner-Gruppe automatisch als Ziel merken
   Läuft für JEDE eingehende Nachricht (kostet fast nichts — prüft erst
   billige Key-Felder, DB-Zugriff nur bei Treffer). Sobald der OWNER in
   einer Gruppe mit dem Bot schreibt, wird diese Gruppe als Spiegel-Ziel
   in der Datenbank gespeichert („wenn in der Gruppe → auch nur dort“).
   ───────────────────────────────────────────────────────────────────── */
export function rememberOwnerGroup(msg) {
  try {
    if (!msg || !msg.key) return;
    if (msg.key.fromMe) return; // Bot selbst zählt nicht
    const chat = getChatId(msg.key);
    if (!chat || !String(chat).toLowerCase().endsWith('@g.us')) return;
    if (!isOwnerSenderKey(msg)) return;
    if (!seenOnce(msg)) return;

    const db = readDb();
    const cfg = normalizeConfig(db.meta.channelRelay);
    if (cfg.enabled === false) return;
    const norm = jidNormalizedUser(chat) || chat;
    if (!cfg.targets.includes(norm)) {
      cfg.targets.push(norm);
      db.meta.channelRelay = cfg;
      writeDb(db);
      console.log(c.bold + c.brightCyan + '[relay] 📡 Gruppe als Spiegel-Ziel angemeldet: ' + c.reset + norm + c.reset);
    }
  } catch (e) {
    console.log(c.bold + c.brightYellow + '[relay] rememberOwnerGroup: ' + c.reset + (e?.message || e));
  }
}

/* ─────────────────────────────────────────────────────────────────────
   Duplikat-Schutz (Kurzzeit-Set)
   ───────────────────────────────────────────────────────────────────── */
function seenOnce(msg) {
  try {
    const id = msg?.key?.id;
    if (!id) return true;
    const now = Date.now();
    const last = recentMessageIds.get(id);
    if (last != null && now - last < 120000) return false;
    recentMessageIds.set(id, now);
    if (recentMessageIds.size > 200) {
      const oldestKey = recentMessageIds.keys().next().value;
      if (oldestKey != null) recentMessageIds.delete(oldestKey);
    }
    return true;
  } catch (e) {
    return true;
  }
}

/* ─────────────────────────────────────────────────────────────────────
   Inhalt prüfen: echte, weiterleitbare Nachricht?
   ───────────────────────────────────────────────────────────────────── */
function getRelayableContent(msg) {
  try {
    if (!msg?.message) return null;
    const real = normalizeMessageContent(msg.message);
    if (!real) return null;
    const type = getContentType(real);
    if (!type || SKIP_CONTENT_TYPES.has(type)) return null;

    /* View-Once (nur einmal ansehen) kann WhatsApp nicht weiterleiten. */
    const media =
      real.imageMessage ||
      real.videoMessage ||
      real.audioMessage ||
      real.stickerMessage ||
      real.documentMessage ||
      real.documentWithCaptionMessage?.message?.documentMessage;
    if (media && media.viewOnce) return null;

    return { type, real };
  } catch (e) {
    return null;
  }
}

/* ─────────────────────────────────────────────────────────────────────
   Haupt-Funktion: Kanal-Nachricht → alle aktiven Chat-Ziele
   Gibt true zurück, wenn die Nachricht aus einem gespiegelten Kanal
   stammt und behandelt wurde (egal ob Zustellung klappte) — dann darf
   der Aufrufer die normale Befehlsverarbeitung überspringen.
   ───────────────────────────────────────────────────────────────────── */
export async function handleChannelRelay(sock, msg, opts = {}) {
  const from = String(getChatId(msg?.key) || (msg?.key && msg.key.remoteJid) || '').trim();
  if (!String(from).toLowerCase().endsWith('@newsletter')) return false;

  const db = readDb();
  const cfg = normalizeConfig(db.meta.channelRelay);
  db.meta.channelRelay = cfg;

  /* Kanal nicht in der Spiegel-Liste → nicht behandeln. */
  const isSource = cfg.sources.some((s) => s && String(s).toLowerCase() === from.toLowerCase());
  if (!isSource) return false;

  if (cfg.enabled === false) return true; // Spiegel aus → trotzdem Kanal-Interna ignorieren

  const content = getRelayableContent(msg);
  if (!content) return true; // z. B. Reaktion/System → nichts zu spiegeln

  if (!seenOnce(msg)) return true; // Duplikat → nichts

  const targets = resolveTargetJids(cfg).filter((t) => String(t).toLowerCase() !== from.toLowerCase());
  if (!targets.length) return true;

  console.log(c.bold + c.brightCyan + `[relay] 📡 Kanal-Post (${content.type}) → ${targets.length} Ziel(e)` + c.reset);

  let delivered = 0;
  for (const target of targets) {
    try {
      await sendToTarget(sock, target, msg);
      delivered++;
    } catch (forwardErr) {
      /* Plan B: Medium herunterladen & neu hochladen (bei abgelaufener
         Medien-URL o. Ä.). Wenn auch das scheitert → Ziel überspringen. */
      try {
        await resendMediaToTarget(sock, target, msg);
        delivered++;
      } catch (resendErr) {
        console.log(c.bold + c.brightYellow +
          `[relay] Zustellung an ${target} fehlgeschlagen: ${forwardErr?.message || forwardErr}` + c.reset);
      }
    }
  }

  if (delivered > 0) {
    console.log(c.bold + c.brightGreen + `[relay] ✅ Kanal-Post an ${delivered}/${targets.length} Ziel(e) gespiegelt` + c.reset);
  }
  return true;
}

/* ─────────────────────────────────────────────────────────────────────
   Zustellung (Plan A): original weiterleiten (wie WhatsApp „Weiterleiten“)
   ───────────────────────────────────────────────────────────────────── */
async function sendToTarget(sock, targetJid, msg) {
  await sock.sendMessage(targetJid, { forward: msg }, { quoted: undefined });
}

/* ─────────────────────────────────────────────────────────────────────
   Zustellung (Plan B): Medium laden und frisch senden
   ───────────────────────────────────────────────────────────────────── */
async function resendMediaToTarget(sock, targetJid, msg) {
  const content = getRelayableContent(msg);
  if (!content) return;
  const { type, real } = content;

  let buffer;
  try {
    const ctx = { logger: undefined, reuploadRequest: typeof sock.updateMediaMessage === 'function' ? sock.updateMediaMessage.bind(sock) : undefined };
    buffer = await downloadMediaMessage(msg, 'buffer', {}, ctx);
  } catch (dlErr) {
    buffer = await downloadMediaMessage(msg, 'buffer', {});
  }
  if (!buffer || !buffer.length) throw new Error('Medien-Download leer');

  let payload;
  switch (type) {
    case 'imageMessage': {
      const m = real.imageMessage || {};
      payload = {
        image: buffer,
        mimetype: m.mimetype || 'image/jpeg',
        caption: m.caption || ''
      };
      break;
    }
    case 'videoMessage': {
      const m = real.videoMessage || {};
      payload = {
        video: buffer,
        mimetype: m.mimetype || 'video/mp4',
        caption: m.caption || '',
        gifPlayback: !!m.gifPlayback
      };
      break;
    }
    case 'audioMessage': {
      const m = real.audioMessage || {};
      payload = {
        audio: buffer,
        mimetype: m.mimetype || 'audio/mpeg',
        ptt: !!m.ptt
      };
      break;
    }
    case 'documentMessage': {
      const m = real.documentMessage || real.documentWithCaptionMessage?.message?.documentMessage || {};
      payload = {
        document: buffer,
        mimetype: m.mimetype || 'application/octet-stream',
        fileName: m.fileName || 'Datei',
        caption: m.caption || ''
      };
      break;
    }
    case 'stickerMessage': {
      const m = real.stickerMessage || {};
      payload = { sticker: buffer };
      if (m.mimetype) payload.mimetype = m.mimetype;
      break;
    }
    default:
      throw new Error(`Plan-B nur für Medien, nicht für ${type}`);
  }

  await sock.sendMessage(targetJid, payload, { quoted: undefined });
}

/* ─────────────────────────────────────────────────────────────────────
   🔴 LIVE-ABO für gespiegelte Kanäle
   WhatsApp liefert neue Kanal-Posts nur dann zuverlässig „live“, wenn
   das Konto den Kanal verfolgt (newsletterFollow) UND die Live-Updates
   abonniert sind (subscribeNewsletterUpdates). Das Abo läuft nach einer
   gewissen Zeit ab → deshalb in einem Intervall erneuern. Wird bei jedem
   Verbindungsaufbau (connection.open) aufgerufen.
   ───────────────────────────────────────────────────────────────────── */
let newsletterLiveTimer = null;
let newsletterLiveSock = null;

export function ensureNewsletterLive(sock) {
  try {
    if (!sock) return;
    newsletterLiveSock = sock;

    const cfg = readConfig();
    const jids = (cfg.sources && cfg.sources.length ? cfg.sources : DEFAULT_CHANNEL_SOURCES.slice());

    const subscribeOne = async (jid) => {
      try {
        if (typeof sock.newsletterFollow === 'function') {
          await sock.newsletterFollow(jid);
        }
      } catch (followErr) {}
      try {
        if (typeof sock.subscribeNewsletterUpdates === 'function') {
          const res = await sock.subscribeNewsletterUpdates(jid);
          const dur = res && res.duration ? Number(res.duration) : null;
          console.log(c.bold + c.brightGreen +
            `[relay] 🔴 Live-Abo aktiv für Kanal ${jid}` + (dur ? ` (Dauer ${dur} s)` : '') + c.reset);
        } else {
          console.log(c.bold + c.brightYellow + '[relay] ⚠️ subscribeNewsletterUpdates nicht verfügbar (Baileys-Version?)' + c.reset);
        }
      } catch (subErr) {
        console.log(c.bold + c.brightYellow + '[relay] Live-Abo fehlgeschlagen: ' + c.reset + (subErr?.message || subErr));
      }
    };

    /* Sofort abonnieren … */
    for (const jid of jids) {
      subscribeOne(jid);
    }
    /* … und regelmäßig erneuern (Abo läuft ab). */
    if (newsletterLiveTimer) {
      clearInterval(newsletterLiveTimer);
      newsletterLiveTimer = null;
    }
    newsletterLiveTimer = setInterval(() => {
      const live = newsletterLiveSock;
      if (!live) return;
      const cfgNow = readConfig();
      const active = (cfgNow.sources && cfgNow.sources.length ? cfgNow.sources : DEFAULT_CHANNEL_SOURCES.slice());
      for (const jid of active) {
        subscribeOne(jid);
      }
    }, 4 * 60 * 1000);
    if (newsletterLiveTimer && typeof newsletterLiveTimer.unref === 'function') {
      newsletterLiveTimer.unref();
    }
  } catch (e) {
    console.log(c.bold + c.brightYellow + '[relay] ensureNewsletterLive: ' + c.reset + (e?.message || e));
  }
}

/* ─────────────────────────────────────────────────────────────────────
   👑 $kanal — Owner-Befehl (Status / on / off / test)
   ───────────────────────────────────────────────────────────────────── */
export async function handleChannelRelayCommand({ sock, msg, from, args = [], isHost, pref = '$' }) {
  const reply = (text) => sock.sendMessage(from, { text }, { quoted: msg });
  if (!isHost) {
    await reply('> ❌ *Nur der Owner* kann `' + pref + 'kanal` nutzen.');
    return;
  }

  const sub = String(args[0] || 'status').toLowerCase();
  const db = readDb();
  const cfg = normalizeConfig(db.meta.channelRelay);

  if (sub === 'on' || sub === 'an' || sub === 'start' || sub === 'ein') {
    cfg.enabled = true;
    db.meta.channelRelay = cfg;
    writeDb(db);
    await reply('> 📡 *KANAL-SPIEGEL: AN* ✅\n\n' +
      'Alles aus ' + (cfg.sources.length ? cfg.sources.join(', ') : 'dem Kanal') +
      ' wird jetzt automatisch an alle aktiven Chats weitergeleitet.');
    return;
  }

  if (sub === 'off' || sub === 'aus' || sub === 'stop' || sub === 'ausschalten') {
    cfg.enabled = false;
    db.meta.channelRelay = cfg;
    writeDb(db);
    await reply('> 📡 *KANAL-SPIEGEL: AUS* ⏸️\n\nWeiterleitung gestoppt.');
    return;
  }

  if (sub === 'test' || sub === 'ping') {
    await reply('> 🧪 *KANAL-TEST*\n\n' +
      'Wenn diese Nachricht bei dir mit der Kanal-Kennzeichnung „LoveBot“ ankommt, ' +
      'läuft die Kanal-Markierung auf **jeder** Bot-Nachricht.\n\n' +
      'Poste danach in deinem Kanal ein Bild, Audio, Sticker & Text — ' +
      'alles sollte automatisch hier ankommen.');
    return;
  }

  /* ── Status (Standard) ─────────────────────────────────────────── */
  const targets = resolveTargetJids(cfg);
  const lines = [];
  lines.push('> 📡 *KANAL-SPIEGEL — STATUS*');
  lines.push('');
  lines.push('*Spiegel:* ' + (cfg.enabled !== false ? 'AN ✅' : 'AUS ⏸️'));
  lines.push('*Kanal/Quelle:* ' + (cfg.sources.length ? cfg.sources.join(', ') : '(keine)'));
  lines.push('*Ziel-Chats:* ' + targets.length);
  lines.push('   • ' + OWNER_JID + '  _(Owner-Chat — immer)_');
  for (const t of cfg.targets || []) {
    lines.push('   • ' + t + (String(t).endsWith('@g.us') ? '  _(Gruppe)_' : ''));
  }
  lines.push('');
  lines.push('💡 _Gruppen, in denen du schreibst, werden automatisch als Ziel angemeldet._');
  lines.push('💡 _' + pref + 'kanal on/off · ' + pref + 'kanal test · Status live_');
  await reply(lines.join('\n'));
}

export default {
  handleChannelRelay,
  rememberOwnerGroup,
  seedChannelRelay,
  channelRelayStatusText,
  ensureNewsletterLive,
  handleChannelRelayCommand
};

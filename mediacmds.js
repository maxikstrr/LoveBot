/* ═══════════════════════════════════════════════════════════════════════
   🎬 L O V E B O T   M E D I A   C O M M A N D S
   ───────────────────────────────────────────────────────────────────────
   $toimg    — Sticker → Bild (WebP → JPEG)            · Alias $sticker2img
   $tomp3    — Video → MP3 (ffmpeg, ohne Videospur)     · Alias $toaudio/$mp3
   $tomp4    — Audio → MP4 (Standbild + Audiospur)      · Alias $video/$audio2video
   $sticker  — Bild → Sticker (512×512 WebP)            · Alias $stiker/$s

   Architektur: EIN gemeinsamer Konverter-Kern (ffmpeg-Resolver + Pipeline),
   kein eigener FFmpeg-Code pro Befehl. Statistik & Logs: Database/media.json
   (gleiche Daten speisen das Owner-Panel „🎬 Media“).

   Ehrlich: Sticker-Paket/Autor („Pack: LoveBot / Author: <pushName>“)
   stehen in der Bestätigungsnachricht — EXIF-Metadaten im WebP werden von
   WhatsApp nur bei entsprechendem EXIF-Chunk angezeigt (hier NICHT gesetzt).
   ═══════════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';
import WebP from 'node-webpmux';
/* downloadContentFromMessage wird LAZY geladen (erst beim echten Download) —
   damit der Konverter-Kern auch ohne Baileys-Stack testbar ist. */

const execFileAsync = promisify(execFile);
const req = createRequire(import.meta.url);

/* ---------- Speicher: Database/media.json ------------------------------ */
const STORE_PATH = path.join('Database', 'media.json');

function loadStore() {
  try { return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8')); }
  catch (e) { return { config: { staticImage: '' }, stats: {}, logs: [], live: [] }; }
}
function saveStore(store) {
  try {
    fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
  } catch (e) { console.error('[media] Speicherfehler:', e?.message || e); }
}

/* ---------- ffmpeg-Resolver (wie Love.js, ESM-sicher) ------------------ */
let ffmpegCache = null;
function ffmpegCandidates() {
  const out = [];
  if (process.env.FFMPEG_PATH) out.push(process.env.FFMPEG_PATH);
  try { const s = req('ffmpeg-static'); if (s) out.push(s); } catch (e) {}
  out.push(
    path.join(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg.exe'),
    path.join(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg'),
    path.join(process.cwd(), 'node_modules', '.bin', 'ffmpeg'),
    'ffmpeg'
  );
  return [...new Set(out.filter(Boolean))];
}
async function getFfmpeg() {
  if (ffmpegCache) return ffmpegCache;
  for (const c of ffmpegCandidates()) {
    try { await execFileAsync(c, ['-version'], { timeout: 8000, maxBuffer: 1024 * 1024 }); ffmpegCache = c; return c; }
    catch (e) {}
  }
  throw new Error('ffmpeg nicht gefunden — `npm i ffmpeg-static` oder FFMPEG_PATH setzen.');
}
export async function hasFfmpeg() { try { await getFfmpeg(); return true; } catch (e) { return false; } }

async function run(args, timeoutMs = 120000) {
  const bin = await getFfmpeg();
  try {
    await execFileAsync(bin, ['-y', ...args], { timeout: timeoutMs, maxBuffer: 32 * 1024 * 1024 });
  } catch (err) {
    throw new Error('FFmpeg: ' + String(err?.message || err).slice(0, 160));
  }
}

/* ---------- Konverter-Kern (gemeinsam für alle Befehle) ---------------- */
const TMP = () => path.join(process.cwd(), 'tmp', 'media', crypto.randomBytes(6).toString('hex'));
const MAX_BYTES = 64 * 1024 * 1024;

export async function webpToJpg(buf) {
  const d = TMP(); fs.mkdirSync(d, { recursive: true });
  const i = path.join(d, 'in.webp'), o = path.join(d, 'out.jpg');
  try {
    fs.writeFileSync(i, buf);
    await run(['-i', i, '-frames:v', '1', o]);
    return fs.readFileSync(o);
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
}

export async function mp4ToMp3(buf) {
  const d = TMP(); fs.mkdirSync(d, { recursive: true });
  const i = path.join(d, 'in.mp4'), o = path.join(d, 'out.mp3');
  try {
    fs.writeFileSync(i, buf);
    await run(['-i', i, '-vn', '-acodec', 'libmp3lame', '-q:a', '4', o]);
    return fs.readFileSync(o);
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
}

/* Standbild für $tomp4: konfigurierbar (Assets/Bilder/tmp), sonst dunkler Frame */
function resolveStaticImage() {
  const store = loadStore();
  const custom = String(store.config?.staticImage || '').trim();
  const candidates = custom
    ? [custom]
    : ['Assets/max.jpeg', 'Bilder/max.jpeg', 'tmp/max.jpeg'].map((p) => path.join(process.cwd(), p));
  for (const p of candidates) {
    try { if (p && fs.existsSync(p) && fs.statSync(p).size > 0) return { path: p, fallback: false }; } catch (e) {}
  }
  return { path: null, fallback: true };
}

export async function audioToMp4(buf, authorName = '') {
  const d = TMP(); fs.mkdirSync(d, { recursive: true });
  const i = path.join(d, 'in.audio'), o = path.join(d, 'out.mp4');
  try {
    fs.writeFileSync(i, buf);
    const img = resolveStaticImage();
    if (img.path) {
      await run(['-loop', '1', '-i', img.path, '-i', i,
        '-c:v', 'libx264', '-tune', 'stillimage', '-c:a', 'aac', '-b:a', '160k',
        '-pix_fmt', 'yuv420p', '-shortest', o]);
    } else {
      /* Kein Standardbild vorhanden → dunkler LoveBot-Rahmen (ehrlicher Fallback) */
      await run(['-f', 'lavfi', '-i', 'color=c=0x0d0716:s=640x640:d=3600', '-i', i,
        '-c:v', 'libx264', '-tune', 'stillimage', '-c:a', 'aac', '-b:a', '160k',
        '-pix_fmt', 'yuv420p', '-shortest', o]);
    }
    void authorName;
    return fs.readFileSync(o);
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
}

export async function imageToStickerWebp(buf) {
  const d = TMP(); fs.mkdirSync(d, { recursive: true });
  const ext = 'in.img', o = path.join(d, 'out.webp');
  const i = path.join(d, ext);
  try {
    fs.writeFileSync(i, buf);
    await run(['-i', i,
      '-vf', "scale=512:512:force_original_aspect_ratio=increase,crop=512:512",
      '-vcodec', 'libwebp', '-lossless', '0', '-q:v', '70', '-frames:v', '1', o]);
    return fs.readFileSync(o);
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
}

export async function addStickerMetadata(buf, authorName) {
  const image = new WebP.Image();
  await image.load(buf);
  const data = JSON.stringify({
    'sticker-pack-id': 'com.lovebot.sticker',
    'sticker-pack-name': 'LoveBot',
    'sticker-pack-publisher': String(authorName || 'LoveBot').slice(0, 24),
    emojis: []
  });
  const dataBuffer = Buffer.from(data, 'utf8');
  const exif = Buffer.concat([
    Buffer.from([
      0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57,
      0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00
    ]),
    dataBuffer
  ]);
  exif.writeUInt32LE(dataBuffer.length, 14);
  image.exif = exif;
  return image.save(null);
}

/* ---------- Statistik & Logs (Owner-Panel liest dieselbe Datei) -------- */
function liveUpdate(job, remove = false) {
  const store = loadStore();
  store.live = (store.live || []).filter((x) => x?.id !== job.id);
  if (!remove) store.live.unshift(job);
  store.live = store.live.slice(0, 20);
  saveStore(store);
}

function logMedia(entry) {
  const store = loadStore();
  const s = store.stats[entry.command] ||= { count: 0, ok: 0, fail: 0, msTotal: 0 };
  s.count++; if (entry.ok) s.ok++; else s.fail++;
  s.msTotal = Math.round((s.msTotal || 0) + (entry.ms || 0));
  store.logs = [entry, ...(store.logs || [])].slice(0, 300);
  store.updated = new Date().toISOString();
  saveStore(store);
}

/* ---------- quoted-Media erkennen & laden ------------------------------ */
function quotedMedia(quoted) {
  if (!quoted || typeof quoted !== 'object') return null;
  if (quoted.stickerMessage) return { kind: 'sticker', obj: quoted.stickerMessage };
  if (quoted.imageMessage) return { kind: 'image', obj: quoted.imageMessage };
  if (quoted.videoMessage) return { kind: 'video', obj: quoted.videoMessage };
  if (quoted.audioMessage) return { kind: 'audio', obj: quoted.audioMessage };
  return null;
}
async function downloadQuoted(m) {
  const { downloadContentFromMessage } = await import('./waApi.js');
  const stream = await downloadContentFromMessage(m.obj, m.kind);
  const chunks = [];
  for await (const c of stream) chunks.push(c);
  const buf = Buffer.concat(chunks);
  if (!buf?.length) throw new Error('Download der zitierten Nachricht fehlgeschlagen.');
  if (buf.length > MAX_BYTES) throw new Error('Datei zu groß (max. 64 MB).');
  return buf;
}

/* ---------- Befehle ----------------------------------------------------- */
const COMMANDS = new Map();
function cmd(names, fn) { for (const n of names.split(' ')) COMMANDS.set(n, fn); }
const fmtMB = (b) => (b / 1024 / 1024).toFixed(1) + ' MB';

cmd('toimg sticker2img', async (ctx) => {
  const m = quotedMedia(ctx.quoted);
  if (!m || m.kind !== 'sticker') {
    await ctx.send('> 🖼️ *STICKER → BILD*\n\nAntworte auf einen *Sticker* und schreibe *' + ctx.pref + 'toimg*.');
    return true;
  }
  const job = { id: crypto.randomUUID(), command: ctx.command, user: ctx.userName, group: ctx.chatLabel, session: ctx.sessionId, status: 'läuft', ts: Date.now() };
  liveUpdate(job);
  const t0 = Date.now();
  try {
    const buf = await downloadQuoted(m);
    const jpg = await webpToJpg(buf);
    await ctx.sock.sendMessage(ctx.from, { image: jpg, mimetype: 'image/jpeg', caption: '🖼️ *Sticker → Bild*\n\n✅ Konvertierung abgeschlossen. · ' + fmtMB(jpg.length) }, { quoted: ctx.msg });
    logMedia({ ts: new Date().toISOString(), command: 'toimg', user: job.user, group: job.group, session: job.session, input: 'Sticker ' + fmtMB(buf.length), output: 'JPEG ' + fmtMB(jpg.length), ms: Date.now() - t0, ok: true });
    liveUpdate({ ...job, status: 'fertig', ms: Date.now() - t0 }, true);
  } catch (e) {
    logMedia({ ts: new Date().toISOString(), command: 'toimg', user: job.user, group: job.group, session: job.session, input: 'Sticker', output: '-', ms: Date.now() - t0, ok: false, error: String(e?.message || e).slice(0, 120) });
    liveUpdate({ ...job, status: 'Fehler: ' + String(e?.message || e).slice(0, 60) }, true);
    await ctx.send('> ⚠️ Konvertierung fehlgeschlagen: ' + String(e?.message || e).slice(0, 140));
  }
  return true;
});

cmd('tomp3 toaudio mp3', async (ctx) => {
  const m = quotedMedia(ctx.quoted);
  if (!m || m.kind !== 'video') {
    await ctx.send('> 🎵 *VIDEO → MP3*\n\nAntworte auf ein *Video* und schreibe *' + ctx.pref + 'tomp3*.');
    return true;
  }
  const job = { id: crypto.randomUUID(), command: ctx.command, user: ctx.userName, group: ctx.chatLabel, session: ctx.sessionId, status: 'läuft', ts: Date.now() };
  liveUpdate(job);
  const t0 = Date.now();
  try {
    const buf = await downloadQuoted(m);
    await ctx.send('⏳ *Video → MP3* — konvertiere (' + fmtMB(buf.length) + ') …');
    const mp3 = await mp4ToMp3(buf);
    await ctx.sock.sendMessage(ctx.from, { audio: mp3, mimetype: 'audio/mpeg', ptt: false }, { quoted: ctx.msg });
    await ctx.send('🎵 *Video → MP3* ✅\n\n📁 ' + fmtMB(buf.length) + ' Video → ' + fmtMB(mp3.length) + ' MP3 · ' + ((Date.now() - t0) / 1000).toFixed(1) + 's');
    logMedia({ ts: new Date().toISOString(), command: 'tomp3', user: job.user, group: job.group, session: job.session, input: 'Video ' + fmtMB(buf.length), output: 'MP3 ' + fmtMB(mp3.length), ms: Date.now() - t0, ok: true });
    liveUpdate({ ...job, status: 'fertig', ms: Date.now() - t0 }, true);
  } catch (e) {
    logMedia({ ts: new Date().toISOString(), command: 'tomp3', user: job.user, group: job.group, session: job.session, input: 'Video', output: '-', ms: Date.now() - t0, ok: false, error: String(e?.message || e).slice(0, 120) });
    liveUpdate({ ...job, status: 'Fehler: ' + String(e?.message || e).slice(0, 60) }, true);
    await ctx.send('> ⚠️ Konvertierung fehlgeschlagen: ' + String(e?.message || e).slice(0, 140));
  }
  return true;
});

cmd('tomp4 video audio2video', async (ctx) => {
  const m = quotedMedia(ctx.quoted);
  if (!m || m.kind !== 'audio') {
    await ctx.send('> 🎬 *AUDIO → MP4*\n\nAntworte auf eine *Audio-/Sprachnachricht* und schreibe *' + ctx.pref + 'tomp4*.\n\nℹ️ Audio hat keine Videospur — der Bot legt ein Standbild darüber (Standardbild: Assets/max.jpeg, konfigurierbar).');
    return true;
  }
  const job = { id: crypto.randomUUID(), command: ctx.command, user: ctx.userName, group: ctx.chatLabel, session: ctx.sessionId, status: 'läuft', ts: Date.now() };
  liveUpdate(job);
  const t0 = Date.now();
  try {
    const buf = await downloadQuoted(m);
    const img = resolveStaticImage();
    const mp4 = await audioToMp4(buf, ctx.userName);
    await ctx.sock.sendMessage(ctx.from, { video: mp4, mimetype: 'video/mp4', caption: '🎬 *Audio → MP4* ✅\n\n🖼️ Standbild: ' + (img.fallback ? 'LoveBot-Standardrahmen (kein max.jpeg gefunden)' : path.basename(img.path)) + '\n📁 ' + fmtMB(buf.length) + ' Audio → ' + fmtMB(mp4.length) + ' MP4' }, { quoted: ctx.msg });
    logMedia({ ts: new Date().toISOString(), command: 'tomp4', user: job.user, group: job.group, session: job.session, input: 'Audio ' + fmtMB(buf.length), output: 'MP4 ' + fmtMB(mp4.length), ms: Date.now() - t0, ok: true, note: img.fallback ? 'Standbild-Fallback' : path.basename(img.path) });
    liveUpdate({ ...job, status: 'fertig', ms: Date.now() - t0 }, true);
  } catch (e) {
    logMedia({ ts: new Date().toISOString(), command: 'tomp4', user: job.user, group: job.group, session: job.session, input: 'Audio', output: '-', ms: Date.now() - t0, ok: false, error: String(e?.message || e).slice(0, 120) });
    liveUpdate({ ...job, status: 'Fehler: ' + String(e?.message || e).slice(0, 60) }, true);
    await ctx.send('> ⚠️ Konvertierung fehlgeschlagen: ' + String(e?.message || e).slice(0, 140));
  }
  return true;
});

cmd('sticker stiker s', async (ctx) => {
  const m = quotedMedia(ctx.quoted);
  if (!m || (m.kind !== 'image' && m.kind !== 'sticker')) {
    await ctx.send('> 🎨 *STICKER ERSTELLEN*\n\nAntworte auf ein *Bild* und schreibe *' + ctx.pref + 'sticker*.');
    return true;
  }
  const job = { id: crypto.randomUUID(), command: ctx.command, user: ctx.userName, group: ctx.chatLabel, session: ctx.sessionId, status: 'läuft', ts: Date.now() };
  liveUpdate(job);
  const t0 = Date.now();
  const author = String(ctx.userName || 'LoveBot').slice(0, 24);
  try {
    await ctx.send('🎨 Sticker wird erstellt …');
    const buf = await downloadQuoted(m);
    /* Sticker-Zitat: WebP nur neu verpacken, damit die Metadaten aktualisiert werden. */
    const webp = await addStickerMetadata(m.kind === 'sticker' ? buf : await imageToStickerWebp(buf), author);
    await ctx.sock.sendMessage(ctx.from, { sticker: webp, mimetype: 'image/webp' }, { quoted: ctx.msg });
    await ctx.send('✅ *Fertig!*\n\n📦 Pack: *LoveBot*\n✍️ Author: *' + author + '*');
    logMedia({ ts: new Date().toISOString(), command: 'sticker', user: job.user, group: job.group, session: job.session, input: m.kind === 'sticker' ? 'Sticker' : 'Bild ' + fmtMB(buf.length), output: 'WebP 512×512', ms: Date.now() - t0, ok: true });
    liveUpdate({ ...job, status: 'fertig', ms: Date.now() - t0 }, true);
  } catch (e) {
    logMedia({ ts: new Date().toISOString(), command: 'sticker', user: job.user, group: job.group, session: job.session, input: m.kind === 'sticker' ? 'Sticker' : 'Bild', output: '-', ms: Date.now() - t0, ok: false, error: String(e?.message || e).slice(0, 120) });
    liveUpdate({ ...job, status: 'Fehler: ' + String(e?.message || e).slice(0, 60) }, true);
    await ctx.send('> ⚠️ Sticker-Erstellung fehlgeschlagen: ' + String(e?.message || e).slice(0, 140));
  }
  return true;
});

/* ---------- Entry (wie handleSessionCommand / handleLovePlus) ---------- */
export async function handleMediaCommand(ctx) {
  const fn = COMMANDS.get(String(ctx.command || '').toLowerCase());
  if (!fn) return false;
  const enriched = {
    ...ctx,
    userName: ctx.userName || ctx.msg?.pushName || 'Unbekannt',
    chatLabel: String(ctx.from || '').endsWith('@g.us') ? ctx.from : 'Privat',
    sessionId: ctx.sessionId || 'main',
    send: (text) => ctx.sock.sendMessage(ctx.from, { text }, { quoted: ctx.msg })
  };
  if (!(await hasFfmpeg())) {
    await enriched.send('> 🧰 *ffmpeg fehlt.*\n\nDie Media-Befehle brauchen ffmpeg:\n`npm i ffmpeg-static`\noder Umgebungsvariable *FFMPEG_PATH* setzen.');
    return true;
  }
  return (await fn(enriched)) === true;
}

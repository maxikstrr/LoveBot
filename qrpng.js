/* ============================================================================
   LoveBot — QR → PNG (ohne zusätzliche Abhängigkeit)
   Nutzt die bereits vorhandene qrcode-terminal-Bibliothek nur für die
   QR-Matrix-Berechnung und codiert das Ergebnis selbst als PNG (node:zlib).
   Liefert einen Buffer, der z. B. als WhatsApp-Bild in Gruppen gesendet wird.
   ==========================================================================*/
import { createRequire } from 'node:module';
import zlib from 'node:zlib';

const require2 = createRequire(import.meta.url);

/* Zugriff auf den internen QRCode-Generator der installierten
   qrcode-terminal-Bibliothek (liegt fest im Paket). */
function qrMatrix(text) {
  let QRCode = null;
  try {
    QRCode = require2('qrcode-terminal/vendor/QRCode');
  } catch (e) {
    return null;
  }
  try {
    /* Error-Correct-Level L = 1 (wie qrcode-terminal es nutzt) */
    const qr = new QRCode(-1, 1);
    qr.addData(String(text || ''));
    qr.make();
    const n = qr.getModuleCount();
    const rows = [];
    for (let y = 0; y < n; y++) {
      const row = [];
      for (let x = 0; x < n; x++) {
        row.push(qr.isDark ? !!qr.isDark(y, x) : !!(qr.modules && qr.modules[y] && qr.modules[y][x]));
      }
      rows.push(row);
    }
    return rows;
  } catch (e) {
    return null;
  }
}

/* ---------- minimales PNG-Encoding (ohne Libs) ------------------------- */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(rows, scale) {
  const q = 3; /* Ruhezone (quiet zone) */
  const n = rows.length;
  const dim = (n + q * 2) * scale;
  const stride = dim * 3; /* RGB, 3 Byte je Pixel */
  /* Jede Bildzeile: 1 Filter-Byte (0) + RGB-Pixel */
  const raw = Buffer.alloc(dim * (1 + stride));
  for (let y = 0; y < dim; y++) {
    const rowStart = y * (1 + stride);
    raw[rowStart] = 0; /* Filter None */
    for (let x = 0; x < dim; x++) {
      const mx = Math.floor(x / scale) - q;
      const my = Math.floor(y / scale) - q;
      const dark = !(mx < 0 || my < 0 || mx >= n || my >= n) && !!rows[my][mx];
      const off = rowStart + 1 + x * 3;
      if (dark) {
        raw[off] = 0; raw[off + 1] = 0; raw[off + 2] = 0;
      } else {
        raw[off] = 255; raw[off + 1] = 255; raw[off + 2] = 255;
      }
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(dim, 0);
  ihdr.writeUInt32BE(dim, 4);
  ihdr[8] = 8;  /* bit depth */
  ihdr[9] = 2;  /* color type: RGB */
  const idat = zlib.deflateSync(raw);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

/* QR-Text → PNG-Buffer (schwarze Module auf weißem Grund). */
export function qrToPng(text, opts = {}) {
  const rows = qrMatrix(text);
  if (!rows || !rows.length) return null;
  const scale = Math.max(2, Math.min(12, opts.scale || 6));
  try {
    return encodePng(rows, scale);
  } catch (e) {
    return null;
  }
}

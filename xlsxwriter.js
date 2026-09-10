/* ============================================================================
   LoveBot — Minimaler .xlsx-Schreiber (Zero-Dependency), „Pretty“-Edition
   Baut eine echte Office-Open-XML-Arbeitsmappe (ZIP + XML) per Hand auf:
   node:zlib (deflate) + selbst berechnete CRC32. Kein externes Paket nötig.

   Hübsch gemacht:
   • farbige, fette Kopfzeile (Romantik-Violett/Pink-Palette)
   • sanftes Zebra-Banding in den Datenzeilen
   • eingefrorene erste Zeile (Freeze Panes)
   • Auto-Filter auf jeder Datentabelle
   • automatische Spaltenbreiten (übersteuerbar pro Blatt via sheet.widths)
   • farbige Tab-Reiter (tabColor, automatisch je Blatt)
   • Tabellenblatt-Namen werden bereinigt & gekürzt (Excel: max. 31 Zeichen)
   ==========================================================================*/
import zlib from 'node:zlib';

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

function escXml(s) {
  return String(s == null ? '' : s).replace(/[<>&'"]/g, (ch) => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;'
  })[ch]);
}

/* --------------------------------------------------------------------------
 * Stile: cellXfs 0 = Standard, 1 = Kopfzeile, 2 = (frei), 3 = Zebra-Zeile
 * ------------------------------------------------------------------------*/
const STYLE_BAND_BG = 'FFF7EEFC';   /* hauchzartes Lila für Zebra */
const STYLE_IDX = { header: 1, band: 3 };

function cellStyleText(bgRgb) {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<fonts count="2">' +
    '<font><sz val="11"/><name val="Calibri"/><family val="2"/></font>' +
    '<font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/><family val="2"/></font>' +
    '</fonts>' +
    '<fills count="4">' +
    '<fill><patternFill patternType="none"/></fill>' +
    '<fill><patternFill patternType="gray125"/></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FF8E24AA"/><bgColor indexed="64"/></patternFill></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="' + bgRgb + '"/><bgColor indexed="64"/></patternFill></fill>' +
    '</fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="4">' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"><alignment horizontal="center" vertical="center"/></xf>' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    '<xf numFmtId="0" fontId="0" fillId="3" borderId="0" xfId="0" applyFill="1"/>' +
    '</cellXfs>' +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
    '</styleSheet>';
}

/* --------------------------------------------------------------------------
 * ZIP-Datei aus Einträgen bauen (deflate, UTF-8-Namen).
 * ------------------------------------------------------------------------*/
function buildZip(entries) {
  const local = [];
  const central = [];
  let offset = 0;
  for (const e of entries) {
    const nameBuf = Buffer.from(e.name, 'utf8');
    const data = e.data;
    const comp = zlib.deflateRawSync(data);
    const crc = crc32(data);

    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt16LE(0x0800, 6);
    lh.writeUInt16LE(8, 8);
    lh.writeUInt16LE(0, 10);
    lh.writeUInt16LE(0x21, 12);
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(comp.length, 18);
    lh.writeUInt32LE(data.length, 22);
    lh.writeUInt16LE(nameBuf.length, 26);
    lh.writeUInt16LE(0, 28);
    local.push(lh, nameBuf, comp);

    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(20, 4);
    ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(0x0800, 8);
    ch.writeUInt16LE(8, 10);
    ch.writeUInt16LE(0, 12);
    ch.writeUInt16LE(0, 14);
    ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(comp.length, 20);
    ch.writeUInt32LE(data.length, 24);
    ch.writeUInt16LE(nameBuf.length, 28);
    ch.writeUInt16LE(0, 30);
    ch.writeUInt16LE(0, 32);
    ch.writeUInt16LE(0, 34);
    ch.writeUInt16LE(0, 36);
    ch.writeUInt32LE(0, 38);
    ch.writeUInt32LE(offset, 42);
    central.push(ch, nameBuf);

    offset += lh.length + nameBuf.length + comp.length;
  }
  const centralSize = central.reduce((a, b) => a + b.length, 0);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralSize, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);
  return Buffer.concat([...local, ...central, eocd]);
}

function colName(i) {
  let n = i;
  let s = '';
  while (n >= 0) { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; }
  return s;
}

/* Anzeige-Länge (Emojis & Umlaute grob berücksichtigt, breite Zeichen = 2) */
function visLen(v) {
  const s = String(v == null ? '' : v);
  let len = 0;
  for (const ch of s) len += ch.codePointAt(0) > 0x2e00 ? 2 : 1;
  return len;
}

/* Automatische Spaltenbreiten: Kopfzeile + bis zu 80 Datenzeilen sample. */
function autoWidths(header, rows, override) {
  const n = Math.max(header.length, ...rows.map((r) => (r || []).length));
  const w = new Array(n).fill(0);
  header.forEach((h, i) => { w[i] = Math.max(w[i], Math.min(visLen(h), 34)); });
  rows.slice(0, 80).forEach((r) => {
    (r || []).forEach((v, i) => { w[i] = Math.max(w[i], Math.min(visLen(v), 60)); });
  });
  const out = [];
  for (let i = 0; i < n; i++) {
    let cw = w[i] == null ? 12 : w[i];
    cw = Math.max(10, Math.min(cw + 2.5, 62));
    if (override && override[i] != null) cw = override[i];
    out.push(cw);
  }
  return out;
}

/* Ein Blatt als worksheet-XML (inline-Strings, Freeze, Filter, Banding). */
function sheetXml(name, header, rows, opts = {}) {
  const freeze = opts.freeze !== false;
  const filter = opts.filter !== false;
  const tabColor = opts.tabColor || null;
  const allRows = [header, ...rows];
  const maxCol = Math.max(0, ...allRows.map((r) => (r || []).length)) - 1;
  const lastRow = allRows.length;
  const endRef = colName(maxCol) + lastRow;
  const widths = autoWidths(header, rows, opts.widths);

  const parts = [];
  parts.push('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>');
  let ws = '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">';
  if (tabColor) ws += '<sheetPr><tabColor rgb="' + escXml(tabColor) + '"/></sheetPr>';
  ws += '<dimension ref="A1:' + endRef + '"/>';
  if (freeze) {
    ws += '<sheetViews><sheetView tabSelected="1" workbookViewId="0">' +
      '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' +
      '</sheetView></sheetViews>';
  } else {
    ws += '<sheetViews><sheetView tabSelected="1" workbookViewId="0"/></sheetViews>';
  }
  ws += '<sheetFormatPr defaultRowHeight="15"/>';
  if (maxCol >= 0) {
    ws += '<cols>' + widths.map((w, i) =>
      '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + Number(w).toFixed(1) + '" customWidth="1"/>').join('') + '</cols>';
  }
  ws += '<sheetData>';

  const body = allRows.map((r, ri) => {
    const rowNum = ri + 1;
    const isHeader = ri === 0;
    const band = (!isHeader && (ri % 2) === 1) ? STYLE_IDX.band : null;
    const cells = (r || []).map((val, ci) => {
      const ref = colName(ci) + rowNum;
      let styleAttr = '';
      if (isHeader) styleAttr = ' s="' + STYLE_IDX.header + '"';
      else if (band) styleAttr = ' s="' + band + '"';
      if (typeof val === 'number' && Number.isFinite(val)) {
        return '<c r="' + ref + '"' + styleAttr + '><v>' + val + '</v></c>';
      }
      if (typeof val === 'boolean') {
        return '<c r="' + ref + '"' + styleAttr + ' t="b"><v>' + (val ? 1 : 0) + '</v></c>';
      }
      return '<c r="' + ref + '"' + styleAttr + ' t="inlineStr"><is><t xml:space="preserve">' + escXml(val) + '</t></is></c>';
    });
    return '<row r="' + rowNum + '">' + cells.join('') + '</row>';
  }).join('');
  ws += body;
  ws += '</sheetData>';
  if (filter && maxCol >= 0 && lastRow >= 2) {
    ws += '<autoFilter ref="A1:' + endRef + '"/>';
  }
  ws += '</worksheet>';
  parts.push(ws);
  return parts.join('\n');
}

function cleanSheetName(name) {
  let s = String(name || 'Tabelle').replace(/[\\/?*[\]:]/g, ' ').replace(/\s+/g, ' ').slice(0, 31).trim();
  if (!s) s = 'Tabelle';
  return s;
}

/* Romantik-Tab-Palette – je Blatt ein Farbtupfer. */
const TAB_PALETTE = ['8E24AA', 'EC407A', '5C6BC0', '26A69A', 'EF5350', 'FFA726', '26C6DA', '7E57C2', 'D81B60', '00897B', 'F4511E', '3949AB'];

/**
 * exportXlsx(sheets) → Buffer
 * sheets: [{ name, header, rows, widths?, freeze?, filter?, tabColor? }]
 */
export function exportXlsx(sheets) {
  const list = (sheets || []).filter((s) => s && Array.isArray(s.header));

  const entries = [];
  const tabColors = TAB_PALETTE.slice();

  const types = [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
    '<Default Extension="xml" ContentType="application/xml"/>',
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>',
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>',
    list.map((s, i) => '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join(''),
    '</Types>'
  ].join('');
  entries.push({ name: '[Content_Types].xml', data: Buffer.from(types, 'utf8') });

  const rootRels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
    '</Relationships>';
  entries.push({ name: '_rels/.rels', data: Buffer.from(rootRels, 'utf8') });

  const workbook =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<bookViews><workbookView xWindow="0" yWindow="0" windowWidth="24000" windowHeight="12000"/></bookViews>' +
    '<sheets>' +
    list.map((s, i) => '<sheet name="' + escXml(cleanSheetName(s.name)) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 2) + '"/>').join('') +
    '</sheets>' +
    '<calcPr calcId="191029" fullCalcOnLoad="1"/>' +
    '</workbook>';
  entries.push({ name: 'xl/workbook.xml', data: Buffer.from(workbook, 'utf8') });

  const wbRels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
    list.map((s, i) => '<Relationship Id="rId' + (i + 2) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>').join('') +
    '</Relationships>';
  entries.push({ name: 'xl/_rels/workbook.xml.rels', data: Buffer.from(wbRels, 'utf8') });

  entries.push({ name: 'xl/styles.xml', data: Buffer.from(cellStyleText(STYLE_BAND_BG), 'utf8') });

  list.forEach((s, i) => {
    const color = (s.tabColor && /^[0-9A-Fa-f]{6}$/.test(s.tabColor))
      ? s.tabColor.toUpperCase()
      : (tabColors[i % tabColors.length]);
    entries.push({
      name: 'xl/worksheets/sheet' + (i + 1) + '.xml',
      data: Buffer.from(sheetXml(s.name, s.header, s.rows || [], {
        freeze: s.freeze,
        filter: s.filter,
        widths: s.widths,
        tabColor: color
      }), 'utf8')
    });
  });

  return buildZip(entries);
}

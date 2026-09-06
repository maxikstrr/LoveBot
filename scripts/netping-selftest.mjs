/* ═══════════════════════════════════════════════════════════════════════
   🧪 SELBSTTEST — Netzwerk-Messungen ohne WhatsApp
   ─────────────────────────────────────────────────────────────────────
   Nutzung:
     node scripts/netping-selftest.mjs              # Standard-Report
     node scripts/netping-selftest.mjs github.com   # + Webseiten-Ping

   Zeigt dir auf deinem Rechner, WAS der Bot später als `$ping` ausgibt —
   nur ohne die WhatsApp-Werte (die brauchen eine offene Socket-Verbindung).
   ═══════════════════════════════════════════════════════════════════════ */

import {
  icmpPing, dnsPing, tcpPing, httpProbe, speedTest, edgeTrace, sysSnapshot
} from '../netping.js';

const ms = (v) => (v == null ? '—' : `${Math.round(v)} ms`);
const fine = (v) => (v == null ? '—' : `${(Math.round(v * 10) / 10).toFixed(1)} ms`);
const mbps = (v) => (v >= 1000 ? `${(v / 1000).toFixed(2)} Gbit/s` : `${v.toFixed(2)} Mbit/s`);
const bytes = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${(b / 1024).toFixed(0)} KB`);

const arg = process.argv[2] || '';

console.log('\n🌐 NETZWERK (ICMP)');
for (const host of ['1.1.1.1', '8.8.8.8', 'web.whatsapp.net']) {
  const r = await icmpPing(host, { count: 3 });
  console.log('   ' + host.padEnd(18) + (r.ok
    ? `${fine(r.avg)}  (min ${r.min} / max ${r.max} · ${r.lossPct}% Loss)`
    : `nicht messbar (${r.error})`));
}

console.log('\n🔌 VERBINDUNG (cloudflare.com)');
const [dns, tcp, http] = await Promise.all([
  dnsPing('cloudflare.com'),
  tcpPing('cloudflare.com', 443),
  httpProbe('https://cloudflare.com/cdn-cgi/trace')
]);
console.log('   DNS        ' + (dns.ok ? `${fine(dns.ms)} (${dns.address})` : `nicht messbar (${dns.error})`));
console.log('   TCP        ' + (tcp.ok ? fine(tcp.ms) : `nicht messbar (${tcp.error})`));
if (http.ok) {
  console.log('   TLS        ' + (http.tlsMs != null && http.tcpMs != null ? fine(http.tlsMs - http.tcpMs) : '—'));
  console.log('   TTFB       ' + ms(http.ttfbMs));
  console.log('   Gesamt     ' + ms(http.totalMs) + `  (${http.status} · HTTP ${http.httpVersion})`);
} else {
  console.log('   HTTP       nicht messbar (' + http.error + ')');
}

const edge = await edgeTrace();
console.log('\n🛰️  EDGE');
console.log('   ' + (edge.ok
  ? `IP ${edge.ip} · ${edge.loc} (Colo ${edge.colo}) · ${edge.tls} · ${edge.http}`
  : `nicht messbar (${edge.error})`));

const sp = await speedTest({ downBytes: 3 * 1024 * 1024, upBytes: 1024 * 1024 });
console.log('\n⚡ SPEED');
console.log('   ↓ ' + (sp.down ? `${mbps(sp.down.mbps)}  (${bytes(sp.down.bytes)} in ${(sp.down.ms / 1000).toFixed(2)}s)` : `nicht messbar (${sp.downError || '—'})`));
console.log('   ↑ ' + (sp.up ? `${mbps(sp.up.mbps)}  (${bytes(sp.up.bytes)} in ${(sp.up.ms / 1000).toFixed(2)}s)` : `nicht messbar (${sp.upError || '—'})`));

const sys = sysSnapshot();
console.log('\n💻 SYSTEM');
console.log(`   Uptime ${(sys.uptimeMs / 1000).toFixed(0)}s · RSS ${bytes(sys.rssBytes)} · Load ${sys.load1} (${sys.cpuCount} Kerne)`);
console.log(`   ${sys.nodeVersion} · ${sys.platform} ${sys.arch} · ${sys.localIps.map((i) => i.address).join(', ') || 'keine lokale IP'}`);

if (arg) {
  const url = /^https?:\/\//i.test(arg) ? arg : 'https://' + arg;
  console.log('\n🌍 WEBSITE ' + url);
  for (let i = 0; i < 3; i++) {
    const p = await httpProbe(url);
    console.log('   ' + (p.ok
      ? `#${i + 1}  DNS ${fine(p.dnsMs)} · TCP ${fine(p.tcpMs)} · TLS ${fine(p.tlsMs != null && p.tcpMs != null ? p.tlsMs - p.tcpMs : null)} · TTFB ${ms(p.ttfbMs)} · Gesamt ${ms(p.totalMs)} · ${p.status}`
      : `#${i + 1}  nicht messbar (${p.error})`));
  }
}

console.log('\n✅ Alle Werte sind gemessen — nichts davon ist geschätzt.\n');

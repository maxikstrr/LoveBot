# 🏓 LoveBot — `$ping` mit echten Werten + neue Alltags-Tools

Stand: **06.09.2026** · Betrifft: `Love.js`, `registry/commands.json`, `README.md`
Neu: `netping.js` · `pingcmd.js` · `toolcmds.js` · `scripts/netping-selftest.mjs`

> **Kernprinzip:** Jede Zahl, die der Bot ausgibt, ist **gemessen**.
> Was nicht messbar ist, wird als „nicht messbar“ **mit Grund** angezeigt —
> nie geraten, nie geschätzt, nie ein Zufallswert.

---

## 1. `$ping` — echter Live-Report

Vorher: Zeitstempel-Differenz der Nachricht + Cloudflare-Speedtest.
Jetzt: **sechs unabhängig gemessene Bereiche**.

### 1.1 Was gemessen wird

| Bereich | Anzeige | Wie gemessen wird |
|---|---|---|
| **Bot-Ping** | `WS-Ping` | WebSocket **Ping/Pong-Frames** direkt gegen den offenen WhatsApp-Socket (`sock.ws.ping()`), 3 Messungen → min/Ø/max/Jitter |
| | `IQ-Ping` | WhatsApp-**IQ-Ping** (`<iq xmlns="w:p"><ping/>`) — genau der Keepalive, den Baileys selbst schickt; Zeit bis zur Server-Antwort |
| | `Sende-RTT` | **Echter Roundtrip**: Nachricht an den eigenen Chat senden → warten, bis der Server sie zurückspiegelt → Messung stoppen (Testnachricht wird gelöscht) |
| | `Nachricht→Bot` | Differenz zwischen dem **Server-Zeitstempel** der Nachricht und dem Eintreffen im Bot |
| **Netzwerk** | `ICMP` | Echter **System-Ping** (`ping`) gegen `1.1.1.1`, `8.8.8.8` und `web.whatsapp.net` → min/Ø/max + Paketverlust |
| **Verbindung** | `DNS` | `dns.lookup()` mit Zeitmessung |
| | `TCP` | TCP-Connect (3-Wege-Handshake) auf Port 443 |
| | `TLS` | Zeit bis `secureConnect` minus TCP-Zeit = **reine TLS-Handshake-Zeit** |
| | `TTFB` | Zeit bis zum **ersten Antwort-Byte** |
| | `Gesamt` | Kompletter Request inkl. Body + HTTP-Status/Version |
| **Server-Netz** | `Öffentliche IP` | Abruf von `cloudflare.com/cdn-cgi/trace` → echte IP, Land, Rechenzentrum (Colo), TLS- und HTTP-Version |
| | `Lokale IP` | `os.networkInterfaces()` |
| **Speed** | `↓ / ↑` | Echte Up-/Downloads gegen `speed.cloudflare.com`. **Adaptiv:** dauert ein Durchlauf < 350 ms, wird mit mehr Datenvolumen neu gemessen (sonst verfälscht der TCP-Slow-Start das Ergebnis) |
| **System** | Uptime · RAM · CPU · Node · DB | `process.uptime()`, `process.memoryUsage()`, `v8`-Heap, `os.loadavg()`, `process.version`, Datenbankzähler |

### 1.2 Varianten

| Befehl | Wirkung |
|---|---|
| `$ping` | Kompletter Report (inkl. schnellem Speedtest) |
| `$ping <url>` | **Webseiten-Ping**: 3 Messungen auf DNS · TCP · TLS · TTFB · Gesamt + Status, HTTP-Version, Server, Größe, Redirect, ICMP |
| `$ping full` | Zusätzlich großer Speedtest (8 MB → bis 32 MB down, 4 MB → 16 MB up) |
| `$ping nospeed` | Nur Latenz, kein Speedtest (am schnellsten) |

Aliase: `$pong`, `$latenz`.

### 1.3 Beispiel-Report

```text
╔══════════════════════════════╗
║   🏓  LOVE BOT  ·  PING      ║
╚══════════════════════════════╝

🤖 *BOT ↔ WHATSAPP*
   WS-Ping       › 42 ms   _(Ø 44 · 38–51 · Jitter 4 ms · 3/3 OK)_
   IQ-Ping       › 88 ms   _(Ø 90 · 86–95 · Jitter 3 ms · 3/3 OK)_
   Sende-RTT     › 121 ms  _(Server-Echo · Senden 0 ms)_
   Nachricht→Bot › 300 ms  _(Server-Zeitstempel)_

🌐 *NETZWERK (ICMP)*
   1.1.1.1         › 13.4 ms _(min 12.1 / max 14.8 · 0% Loss)_
   8.8.8.8         › 19.1 ms _(min 18.0 / max 20.4 · 0% Loss)_
   web.whatsapp.net › 21.3 ms _(min 20.0 / max 23.1 · 0% Loss)_

🔌 *VERBINDUNG* _(cloudflare.com)_
   DNS         › 3.1 ms   _(104.16.132.229)_
   TCP         › 12.4 ms  _(Port 443)_
   TLS         › 23.0 ms  _(TLSv1.3)_
   TTFB        › 79 ms    _(erste Antwort-Byte)_
   Gesamt      › 80 ms    _(200 · HTTP 1.1)_

🛰️ *SERVER-NETZ*
   Öffentliche IP › 136.66.175.58
   Standort     › US (Colo SEA)
   Protokoll    › TLSv1.3 · http/1.1
   Lokale IP    › 192.168.1.10 _(eth0)_

⚡ *SPEED* _(gemessen, speed.cloudflare.com)_
   ↓ Download   › 94.20 Mbit/s  _(3.0 MB in 0.26s)_
   ↑ Upload     › 41.70 Mbit/s  _(1.0 MB in 0.19s)_

💻 *SYSTEM*
   Uptime     › 2 T. 4 Std. 12 Min.
   RAM        › 148.2 MB _(Heap 26.9 MB / 46.0 MB)_
   CPU        › Load 0.42 _(2 Kerne)_
   Node       › v24.3.0 · linux x64
   DB         › 137 Nutzer · 24 Gruppen · 0 Bans

💡 _$ping <url> = Webseite prüfen · $ping full = großer Speedtest_
```

### 1.4 Webseiten-Ping (Beispiel)

```text
╔══════════════════════════════╗
║   🌍  WEBSITE  ·  PING       ║
╚══════════════════════════════╝

🔗 *URL* › https://github.com/maxikstrr/LoveBot
📍 *IP* › 140.82.116.3 _(DNS 1.6 ms)_

⏱️ *ZEITEN* _(letzte Messung · Ø · min–max aus 3 Läufen)_
   DNS     › 2 ms     _(Ø 2 ms · 1–3)_
   TCP     › 3 ms     _(Ø 4 ms · 3–6)_
   TLS     › 17 ms    _(Ø 16 ms · 15–17)_
   TTFB    › 42 ms    _(Ø 167 ms · 30–428)_
   Gesamt  › 84 ms    _(Ø 206 ms · 71–463)_

📄 *ANTWORT*
   Status    › 200 OK
   HTTP      › 1.1
   Server    › github.com
   Typ       › text/html
   Größe     › 531 KB

🏓 *ICMP*
   github.com › 12.4 ms _(min 11.9 / max 13.0 · 0% Verlust)_

💡 _Alles echt gemessen · 22:55:24_
```

---

## 2. Neue Befehle: Alltag & Web

Alle sechs sind in der Registry (`registry/commands.json`) in der neuen Kategorie
**🧭 Alltag & Web** eingetragen — sie erscheinen damit automatisch in
`$menu` / `$help` / `$menunew`, im Web-Admin und in der Doku.

| Befehl | Aliase | Was er tut | Datenquelle (echt) |
|---|---|---|---|
| `$wetter <stadt>` | `$weather` | Aktuelles Wetter + Tages-Max/Min, Regenwahrscheinlichkeit, Wind, Luftdruck, Ortszeit | **Open-Meteo** (Geocoding + Forecast, kein Key nötig) |
| `$währung <betrag> <von> [nach]` | `$waehrung` `$currency` `$cur` `$wechselkurs` | Währungen umrechnen; `$währung liste` zeigt alle | **Frankfurter API** (EZB-Referenzkurse) |
| `$übersetze <sprache> <text>` | `$uebersetze` `$translate` `$tr` | Übersetzt Text; `$übersetze de\|en …` erzwingt die Richtung | **MyMemory Translation** |
| `$qr <text>` | `$qrcode` | Erzeugt einen QR-Code als Bild (512 × 512 px) | **goqr.me / api.qrserver.com** |
| `$kurz <url>` | `$kuerz` `$short` `$shorten` `$tiny` | Kürzt einen Link | **TinyURL**, Fallback **is.gd** |
| `$passwort [länge]` | `$password` `$pw` `$pwd` | Zufalls-Passwort, 8–64 Zeichen, mit Entropie-Angabe | **lokal**: `crypto.randomBytes` / `randomInt` |

### Beispiele

```text
$wetter Kerkrade
$währung 50 EUR TRY
$währung 10 €                 → 10 EUR in USD
$währung liste
$übersetze en Guten Morgen
$übersetze tr|en Hallo Welt
$qr https://github.com/maxikstrr/LoveBot
$kurz https://github.com/maxikstrr/LoveBot
$passwort 24
```

Alle Befehle akzeptieren alternativ **zitierte Nachrichten** (Text/Link zitieren
und z. B. `$qr` oder `$übersetze en` schreiben).

Fehlt ein Argument, zeigt der Bot eine **Verwendungshilfe**; ist der externe
Dienst nicht erreichbar, kommt eine ehrliche Fehlermeldung mit Grund.

---

## 3. Neue Dateien

| Datei | Rolle |
|---|---|
| `netping.js` | **Mess-Engine.** ICMP, TCP, DNS, HTTP-Phasen (DNS/TCP/TLS/TTFB/Gesamt), WebSocket-Ping, WhatsApp-IQ-Ping, Sende-Roundtrip, Speedtest, Edge-Trace, System-Snapshot. Kein WhatsApp nötig → einzeln testbar. |
| `pingcmd.js` | **Report-Bauer** für `$ping` und `$ping <url>`; sendet/bearbeitet die Statusnachricht, formatiert die Ausgabe. |
| `toolcmds.js` | **Die 6 Alltags-Tools** inkl. Dispatch (`handleToolCommand`) — gibt `true` zurück, wenn der Befehl zum Modul gehört. |
| `scripts/netping-selftest.mjs` | **Selbsttest ohne WhatsApp**: `node scripts/netping-selftest.mjs [url]` |

### Änderungen an bestehenden Dateien

- **`Love.js`**
  - Import von `pingcmd.js` / `toolcmds.js` (Zeile ~74)
  - `case 'ping':` → delegiert an `handlePingCommand()` (Zeile ~5270)
  - `default:`-Block → `handleToolCommand()` läuft **vor** den Session-/Media-/LovePlus-Handlern (Zeile ~9905)
  - `buildMenuSections()` → neue Kategorie **🧭 ALLTAG & WEB**, Ping-Beschreibung aktualisiert
- **`registry/commands.json`** → neue Kategorie `alltag`, `$ping`-Eintrag aktualisiert
- **`README.md`** → `$ping` neu beschrieben, Abschnitt **11.9 Alltag & Web**
- **`NEUE_FEATURES.md`** → Kurzhinweis auf dieses Update

> Die bisherigen Befehle `$speed` / `$speedtest` / `$internetspeed` bleiben
> unangetastet (weiterhin der „große“ Speedtest mit Live-Status).

---

## 4. So wendest du es an

### Variante A — Dateien kopieren (am einfachsten)

Kopiere diese Dateien in dein LoveBot-Verzeichnis und überschreibe die bestehenden:

```text
Love.js
registry/commands.json
README.md
NEUE_FEATURES.md
netping.js          (neu)
pingcmd.js          (neu)
toolcmds.js         (neu)
scripts/netping-selftest.mjs   (neu)
```

Dann `npm start`. Es sind **keine neuen Abhängigkeiten** nötig — alles nutzt
Node-Bordmittel (`net`, `dns`, `http(s)`, `os`, `crypto`, `child_process`)
und `fetch` (Node 18+, dein Projekt verlangt ohnehin ≥ 24).

### Variante B — Patch anwenden

```bash
cd LoveBot
git apply /pfad/zu/lovebot-ping-tools.patch
```

(zur Kontrolle vorher: `git apply --check lovebot-ping-tools.patch`)

### Variante C — alles neu aus dem Workspace-Clone

Der komplette, bereits gepatchte Stand liegt im Workspace unter **`LoveBot/`**.

---

## 5. Technik: Wie gemessen wird

| Wert | Methode | Wenn es nicht geht |
|---|---|---|
| WS-Ping | `sock.ws.ping()` + `pong`-Event | `nicht messbar` + Grund (z. B. „WS nicht offen“) |
| IQ-Ping | `sock.query(<iq><ping/>)` gegen `s.whatsapp.net` | `nicht messbar (Timeout)` |
| Sende-RTT | Nachricht an eigenen Chat → Echo via `messages.upsert` → löschen | `nicht messbar (Echo nicht empfangen)` |
| ICMP | System-`ping` (Windows/Linux/macOS-Parameter automatisch angepasst) | ehrlicher Grund, z. B. *„keine ICMP-Rechte (cap_net_raw / Admin nötig)“* |
| DNS/TCP/TLS/TTFB | eigener HTTP-Client mit Zeitmessung je Phase | `nicht messbar (Timeout)` |
| Öffentliche IP | `cloudflare.com/cdn-cgi/trace` | `nicht messbar` |
| Speed | echte Up-/Downloads, adaptiv vergrößert | `nicht messbar (HTTP …)` |

**Warum adaptiver Speedtest?** Bei sehr schnellen Leitungen dauert ein 3-MB-Download
unter 100 ms — das Ergebnis wäre dann fast nur TCP-Slow-Start. Läuft die Messung
kürzer als 350 ms, wird sie mit mehr Volumen wiederholt (bis 12 MB, bei `$ping full`
bis 32 MB).

---

## 6. Selbsttest (ohne WhatsApp)

```bash
node scripts/netping-selftest.mjs              # Netzwerk, Speed, System
node scripts/netping-selftest.mjs github.com   # + Webseiten-Ping
```

Zeigt dir auf deinem Rechner genau die Werte, die später `$ping` ausgibt —
nur ohne die drei WhatsApp-Werte (die brauchen eine offene Verbindung).

---

## 7. Wenn etwas „nicht messbar“ ist

| Anzeige | Ursache | Lösung |
|---|---|---|
| ICMP „keine ICMP-Rechte“ | Auf Linux fehlt dem `ping`-Binary `cap_net_raw`; in Containern/VMs oft blockiert | `sudo setcap cap_net_raw+ep $(which ping)` oder als Admin/Root starten — der Rest des Pings funktioniert auch ohne |
| ICMP „Host nicht auflösbar“ | DNS blockiert den Namen | IP statt Hostname nutzen |
| WS-Ping „WS nicht offen“ | Verbindung gerade nicht offen | Bot neu starten / Verbindung prüfen |
| IQ-Ping Timeout | WhatsApp-Server antwortet gerade nicht | später erneut versuchen |
| Sende-RTT „Echo nicht empfangen“ | Server spiegelt die eigene Nachricht nicht zurück | harmlos — WS- und IQ-Ping liefern weiter Werte |
| MyMemory „Keine Übersetzung“ | Sprachpaar unbekannt oder Tageslimit erreicht | andere Zielsprache versuchen (`de`, `en`, `tr`, `es`, `fr`, `it`, `nl`, …) |
| QR „ZU LANG“ | > 900 Zeichen | Text kürzen (QR-Kapazität) |
| Speed unplausibel hoch | Messung zu kurz / lokaler Proxy | `$ping full` nutzen |

---

## 8. Datenschutz-Hinweis

Die neuen Befehle senden **Daten an externe Dienste** — nur das, was der Befehl braucht:

- `$wetter` → **Open-Meteo**: der gesuchte Ortsname
- `$währung` → **Frankfurter API**: Währungscodes
- `$übersetze` → **MyMemory**: der zu übersetzende Text (max. 450 Zeichen)
- `$qr` → **goqr.me**: der zu kodierende Text
- `$kurz` → **TinyURL / is.gd**: die zu kürzende URL
- `$ping` → **Cloudflare** (`speed.cloudflare.com`, `cdn-cgi/trace`): keine Inhalte,
  nur Messdaten; die eigene öffentliche IP ist dabei naturgemäß sichtbar

`$passwort` bleibt **komplett lokal** (kryptografischer Zufall, keine Ausgabe ins Log).

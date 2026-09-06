# 🆕 LoveBot — Neue Features (Menü · AFK · Auto-Mod · Setup · System · Ban · Tools)

---

## ❤️ NEU (06.09.2026): Love Core 2.0 · Privatsphäre · Anti-Spam

Vollständige Doku: **[LOVE-CORE-2.md](./LOVE-CORE-2.md)**

- `$love` = **ein** Beziehungs-Panel (Liebeslevel, Love-XP, Streak, gemeinsame
  Nachrichten, Tage, Aktionen, Trennungen, Meilensteine) · `$partner` als Kurzversion
- Echte Zähler für 14 Liebes-Aktionen (`$kiss`, `$hug`, `$compliment`, …) in `Database/lovecore.json`
- `$dailylove` — Tagesimpuls mit Serie, +25 XP, +50 Kupfer
- 🔒 Datenschutz: unter 13 keine Registrierung · unter 18 kein exaktes Alter ·
  Stadt in Gruppen maskiert · `$privacy` · Migration via `node scripts/migrate-privacy.mjs`
- 🛡️ Anti-Spam: Rate-Limit (10 Befehle / 10 s, eskalierende Sperre, Owner frei)
- `$socials` / `$links` ersetzen die alten Social-Links, weil `$love` jetzt das Panel ist

---

## 🏓 NEU (06.09.2026): `$ping` mit echten Messwerten + 6 Alltags-Tools

Vollständige Doku: **[PING-UND-TOOLS.md](./PING-UND-TOOLS.md)**

- `$ping` zeigt **nur echte, live gemessene Werte**: WebSocket-Ping, WhatsApp-IQ-Ping,
  Sende-Roundtrip, ICMP-Netzwerk-Ping, DNS/TCP/TLS/TTFB, echte öffentliche IP,
  gemessener Speed und Systemwerte.
- `$ping <url>` = Webseiten-Ping · `$ping full` = großer Speedtest · `$ping nospeed` = nur Latenz.
- Neue Befehle: `$wetter` · `$währung` · `$übersetze` · `$qr` · `$kurz` · `$passwort`.
- Neue Dateien: `netping.js` (Mess-Engine) · `pingcmd.js` (Report) · `toolcmds.js` (Tools)
  · `scripts/netping-selftest.mjs` (Selbsttest ohne WhatsApp).

---

# 💜 LOVE BOT v3.3 — LOGIN-FIX, DAUER-LOGIN, NEUE META AI (03.09.2026)

## 🔐 1. Login-System gefixt: erst Nummer, dann Passwort
- Neuer Schritt: **Nummer/JID eingeben → „🔎 Nummer prüfen“**
- Die Webseite fragt `POST /api/check-number` ab:
  - **Owner-Nummer** → Passwort-Feld erscheint („👑 Owner-Passwort“)
  - **Registrierter Nutzer** → Passwort-Feld erscheint („🔐 Dein Passwort“)
  - **Gebannt** → sofort die Ban-Meldung (wer, warum, welche Owner helfen)
  - **Unbekannt** → Hinweis: bitte registrieren
- Passwort-Feld wird also NICHT mehr blind angezeigt.

## 🧷 2. Eingeloggt bleiben bis zum Logout
- Sessions liegen jetzt in `Database/websessions.json` (persistent).
- Kein Ablauf mehr: man bleibt eingeloggt, bis man „Abmelden“ drückt —
  auch nach Server-Neustarts (getestet ✔).

## 🤖 3. $addmeta / $kickmeta NEU gebaut
- Meta AI hat eine neue JID: **`867051314767696@bot`**
- `$addmeta` → `sock.groupParticipantsUpdate(from, ['867051314767696@bot'], 'add')`
- `$kickmeta` → `sock.groupParticipantsUpdate(from, ['867051314767696@bot'], 'remove')`
- Rechte bleiben: nur Owner/Zusatz-Owner/Admins dürfen es nutzen.

## 📄 4. Neue Seiten: Features & FAQ
- **`/features.html`** — alle Feature-Bereiche im Detail (Automod, Liebe, Economy,
  Meta AI, Auto-Download) + Terminal-Fenster „Bot ↔ Dashboard“ das zeigt, wie
  Bot und Webseite zusammenarbeiten (heartbeat.json, webmail.json, creds.json, lovebot.log)
- **`/faq.html`** — 9 häufige Fragen im Terminal-Stil
- Navigation auf allen öffentlichen Seiten erweitert (Features · Befehle · Status · FAQ)

**Start:** `node server.js` → http://localhost:7777 (Bot: `node Love.js`)

---

# 💜 LOVE BOT v3.2 — TERMINAL NIGHT EDITION (03.09.2026)

## 🖥️ Komplettes Terminal-Design (kein Weiß mehr!)
- **Tiefschwarzer Nacht-Hintergrund** (#03010a) mit Neon-Glow (Lila/Pink/Grün)
- **Alles in Monospace-Schrift** (JetBrains/Fira Code/Consolas) — wie im Terminal
- **Neon-Schrift**: Zahlen, Befehle, Status & Links leuchten in Neon-Grün/Pink mit Glow
- **CRT-Scanlines** dezent über der ganzen Seite
- **Terminal-Fenster auf der Startseite**: Boot-Sequenz mit `❯ node Love.js` und
  grünem Blink-Cursor — Befehls-Zahl wird live eingetragen
- Befehls-Listen mit Terminal-Prompt `❯` vor jedem Befehl
- Neon-Buttons, Glow-Hover auf Karten/Tabellen, Terminal-Punkte (rot/gelb/grün)
- Alle Seiten überarbeitet: Landing, Login, cmd, Status & komplettes Dashboard

---

# 💜 LOVE BOT v3.1 — ÖFFENTLICHE SEITEN + ALLE BEFEHLE (03.09.2026)

## 📜 1. Neue öffentliche Seiten (KEIN Login nötig!)
- **`/cmd.html`** — ALLE Befehle mit Nutzung + Beschreibung, mit **Live-Suche**.
  Auch unter `/commands.html` erreichbar.
- **`/status.html`** — Live-Status-Seite: Bot online/offline (mit Puls-Punkt),
  Nutzer/Gruppen/Bans/Befehle-Zähler, Heartbeat-Details — aktualisiert alle 5 Sekunden.
- Oben in der Navigation auf jeder Seite: Home · Befehle · Status · Einloggen.
- Auch in der Dashboard-Sidebar gibt es jetzt die Links-Sektion (Website, Befehle, Status).

## 🔥 2. Viel mehr echte Befehle (249 statt 121)
- Alle **143 Befehle direkt aus dem Interaktiven Bot-Menü** (Love.js) extrahiert —
  mit echter Nutzung (`$marry @user`) und echter Beschreibung.
- Plus **106 echte Aliase** aus dem Bot (z. B. `$heiraten`, `$kuss`, `$rangliste`, `$wikipedia`).
- 13 Kategorien: Start, Allgemein, Liebe & Herzen, AFK & Profil, Gruppe & Moderation,
  Admin & Verifikation, Medien & AI, Slot & Spaß, Economy, Internet & Fakten,
  Owner Tools, Werkzeuge, Aliase.
- Landing-Page zeigt jetzt die Top 10 pro Kategorie + „+X mehr" → `/cmd.html`.

**Start:** `node server.js` → http://localhost:7777 (Bot für Codes/Broadcasts: `node Love.js`)

---

# 🌹 LOVE BOT v3.0 — WEBSITE-REDESIGN (03.09.2026)

## 💜 1. Komplett neue Website (Landing + Login + 10 Admin-Seiten)
Statt einer einzigen Login-Seite gibt es jetzt eine richtige Website:

| Seite | Inhalt |
|---|---|
| `/` (index.html) | Landing-Page: Hero, Live-Statistiken (Nutzer/Gruppen/Bans/Bot-Status), Feature-Karten, **echte Befehls-Übersicht (121 Befehle in 12 Kategorien)** aus dem Bot, Footer mit allen echten Social-Links |
| `/login.html` | Login **mit JID oder Nummer** + Registrierung per WhatsApp-Code |
| `/dashboard.html` | 📊 Übersicht: Live-Stats + Bot-Info aus dem Heartbeat (JID, LID, Uptime, RAM, Node) |
| `/session.html` | 📡 Echte Session-Daten aus `Sessions/creds.json` (JID, LID, Plattform, Noise-Key) |
| `/settings.html` | ⚙️ Bot-Konfiguration + echte Projekt-Links |
| `/owners.html` | 👑 Zusatz-Owner eintragen/löschen (wie `$addowner`) |
| `/groups.html` | 👥 Alle Gruppen mit Feature-Toggles (Auto-DL, Welcome, Goodbye, Badwords, Anti-Link, Aktiv) |
| `/badwords.html` | 🤬 Filter an/aus + Wörter hinzufügen/entfernen |
| `/bans.html` | 🚫 Alle Bans sehen + entbannen |
| `/broadcast.html` | 📢 Nachricht an alle Gruppen |
| `/profiles.html` | 👤 Alle Bot-Profile mit Level, Liebe & Wallet (mit Suche) |
| `/logs.html` | 📜 Bot-Logs live aus `Logs/lovebot.log` |

## 🔐 2. Login mit JID + Ban-Block
- Login funktioniert mit **JID** (`4915155894714@s.whatsapp.net`) ODER nur der Nummer.
- **Gebannte Personen können sich NICHT einloggen** (auch nicht registrieren).
  Sie sehen: „Du bist gebannt von **@wer** wegen **Grund**" +
  „Wende dich an diese Owner" mit **allen Owner-JIDs (+LIDs)** zum Kontaktieren.

## 🛡️ 3. Owner verwaltet alles
- Owner (Passwort aus `OWNER_PASSWORD`) sieht alle Verwaltungs-Seiten und kann Owner, Gruppen,
  Badwords, Bans, Broadcasts und Logs komplett verwalten.
- Normale Nutzer sehen nur Übersicht + eigenes Profil.
- Nicht-Owner werden von Owner-Seiten automatisch zurückgeleitet.

## 🎨 4. Design
- Dunkles Lila/Pink-Theme passend zum Bot, schwebende Herzchen, Glassmorphism-Karten.
- Landing mit Live-Zählern (gamebot/stormbot-Stil), Admin-Bereich mit Sidebar +
  Breadcrumbs (thinkproject-CDE-Stil). Responsive bis Handy.

## 🔌 5. Neue Server-APIs (server.js)
- `GET /api/siteinfo` — Name, Präfix, Owner-JID/LID, echte Links, Zähler, Heartbeat
- `GET /api/commands` — 12 Kategorien / 121 echte Befehle
- `GET /api/session` — echte Daten aus creds.json (nur eingeloggt)
- Login/Request-Code prüfen `db.bans` nach Key, JID und LID

**Start:** `node server.js` → http://localhost:7777 (Bot für Codes/Broadcasts: `node Love.js`)

---

# 💜 LOVE BOT v2 — DAS GROSSE UPDATE (03.09.2026)

## 📥 1. Auto-Download für YouTube, TikTok & Instagram
Einfach einen Link in den Chat schicken — der Bot lädt das Medium
**automatisch** herunter und sendet Bild, Video (MP4) und Audio (M4A).

- Funktioniert in **Privatchats immer** und in Gruppen (sofern der Bot aktiv ist).
- Unterstützt: `youtube.com`, `youtu.be`, `music.youtube.com`, `tiktok.com` (auch `vm.`/`vt.`-Shortlinks), `instagram.com`, `instagr.am`.
- Status-Nachricht wird live per **Message-Edit** zum Ergebnis aktualisiert.
- In Gruppen umschaltbar mit **`$autodl on|off`** (nur Admins/Owner).
- Dedupe-Schutz: dieselbe Nachricht wird nie doppelt verarbeitet.

## 🏓 2. $ping + $speed — echter Speedtest
`$ping` zeigt jetzt nicht nur die Latenz, sondern misst **Download UND Upload**
über die Cloudflare-Edge (speed.cloudflare.com):

- 🏓 Latenz (aus dem Nachrichten-Timestamp)
- 📥 Download in Mbit/s (bis zu 12 MB Testdaten)
- 📤 Upload in Mbit/s (2 MB Testdaten)
- 🧠 RAM-Verbrauch des Bots

`$speed` / `$speedtest` startet den gleichen Test ohne Latenz-Kontext.
Die Status-Nachricht wird per `protocolMessage` (Typ 14, MESSAGE_EDIT) live aktualisiert.

## 🖥️ 3. Schöneres Terminal
- Großes **LOVE-ASCII-Banner** beim Start (ANSI-Shadow-Schriftzug).
- **Zeitgestempelter Logger** `logLove(tag, text)` für alle neuen Features.
- Erweiterte **Online-Box** nach dem Verbinden: Node-Version, Plattform, RAM,
  Befehlszähler, Auto-Download-Status, Marry-Status.

## 📚 4. Neues Help-System
`$help` ist jetzt **kategorienbasiert und interaktiv**:

| Befehl | Funktion |
|---|---|
| `$help` | Übersicht + klickbares Kategorien-Menü (iOS+Android) |
| `$help <kategorie>` | nur diese Kategorie (z. B. `$help liebe`) |
| `$help <suchwort>` | durchsucht alle Befehle |
| `$help alle` | wirklich jeder Befehl als Textliste |

10 Kategorien: 📌 Allgemein · 👤 Profil · 💍 Liebe · 🎉 Spaß · 👥 Gruppe ·
💤 Moderation · 🧰 Werkzeuge · 🎨 Media & AI · 👑 Owner · 🛡️ Verifikation.
`$menunew` hat ebenfalls neue Sektionen (💍 Liebe, 🎱 Fun, 👑 Owner Tools).

## 👑 5. Neue Owner-Befehle
| Befehl | Funktion |
|---|---|
| `$bc <text>` | 📢 Broadcast an **alle** Bot-Gruppen (mit 400ms Delay gegen Ratelimits) |
| `$setppbot` | 🖼️ Bot-Profilbild setzen (auf ein Bild antworten) |
| `$setbotname <name>` | 🏷️ Bot-Anzeigenamen ändern |
| `$blocklist` | 🚫 alle blockierten Kontakte auflisten |
| `$autodl on\|off` | 📥 Auto-Download pro Gruppe steuern |
| `$speed` / `$speedtest` | 🚀 Internet-Speedtest |

Alle Owner-Befehle prüfen `isHost` und verweigern fremden Zugriff mit ⛔.

## 💍 6. Marry-System — Heiraten mit Rosen
| Befehl | Funktion |
|---|---|
| `$marry @user` | 💍 Heiratsantrag stellen |
| `$divorce` / `$scheidung` | 💔 Ehe beenden (Ex-Partner wird per PN informiert) |

**Ablauf:**
1. `$marry @user` sendet eine Rosen-Antrags-Karte 🌹 mit beiden Mentions.
2. Die Person bekommt ein **klickbares Ja/Nein-Menü** (Single-Select, iOS+Android):
   „💍 JA, ich will!“ / „💔 Nein, tut mir leid“.
3. Alternativ kann sie einfach **„Ja“ oder „Nein“** in den Chat schreiben
   (erkennt auch: jaa, yes, klar, jo, ok, nein, nee, nö, no, …).
4. Antrag läuft nach **60 Minuten** automatisch ab.
5. Bei **Ja**: große „JUST MARRIED“-Feier mit Rosen-Rahmen 🌹🌹🌹 und Mention beider Partner.

**Gespeichert wird im Profil** (`Database/LoveUser/<bid>/<bid>.json` → `love`):
`married`, `spouseName`, `spouseKey`, `marriedAt`, `divorcedAt`, `marriages`.
Offene Anträge liegen in `Database/Database.json` → `meta.marryProposals`.

**Schutz:** kein Selbst-Heiraten, keine Doppel-Ehen, kein Antrag auf bereits
Verheiratete, ein offener Antrag pro Person.

**Anzeige in `$me`:**
- Verheiratet: `💍 Verheiratet mit <Name> 🌹` + Hochzeitsdatum + gemeinsame Tage 💕
- Single: `🕊️ Single — die große Liebe wartet noch …`

Das **Owner-Profil in `$me`** wurde komplett neu gebaut: Sektionen
(🪪 Person · 🔐 Identität · 🛡️ Status · 💰 Fortschritt · 💍 Liebe),
Rosen-Rahmen, Krone und „Der Boss ist im Haus“ 🕶️. Alle anderen Profile
bekamen das gleiche Design mit 🌸-Rahmen.

## 🎉 7. Viele neue Befehle
| Befehl | Funktion |
|---|---|
| `$ship @a @b` | 💘 Love-o-Meter (deterministisch, mit Herzen-Leiste + Kommentar) |
| `$kiss @user` | 💋 Kuss-Aktion mit zufälligen Sprüchen |
| `$hug @user` | 🤗 Umarmung |
| `$slap @user` | 🖐️ Ohrfeige |
| `$compliment @user` | 🌹 Kompliment verteilen |
| `$8ball <frage>` | 🎱 Magic 8-Ball (12 deutsche Antworten) |
| `$rps stein\|papier\|schere` | ✊✋✌️ gegen den Bot |
| `$witz` / `$joke` | 😂 zufälliger Witz (12 Stück) |
| `$fakt` / `$fact` | 🧠 zufälliger Fakt (12 Stück) |

## 🛠️ Technik dahinter
- `sendPlayResultMedia()` — gemeinsamer Media-Versand für `$play` **und** Auto-Download.
- `performSpeedTestWithReport()` — Speedtest mit Live-Status-Edit.
- `editTextMessage()` — generisches Message-Edit (protocolMessage Typ 14).
- `handleAutoLinkDownload()` / `handleMarryPlainTextAnswer()` — laufen vor dem
  Präfix-Check in der Nachrichten-Schleife.
- `HELP_CATEGORIES` — eine einzige Datenquelle für `$help`, `$help alle` und das interaktive Menü.

Alle neuen Daten werden in **`Database/Database.json`** gesichert
(zusätzliche Sektionen: `afk`, `bans`, `meta`). Die Gruppen-Daten (Setup,
Auto-Mod-Einstellungen, Regeln) landen zusätzlich in
**`Database/LoveGroups/<gruppe>/<gruppe>.json`**.

---

# 🌐 LOVE BOT v2.9 — WEB-DASHBOARD & ADDMETA FINAL (03.09.2026)

## 🌐 Web-Dashboard (`server.js` → http://localhost:7777)
Komplett eigenes Design (lila Love-Theme, Glassmorphism, schwebende Herzen),
ohne zusätzliche Pakete (nur Node-Bordmittel). Dateien:
- `server.js` — HTTP-Server + JSON-API
- `public/index.html` + `public/js/auth.js` — Login & Registrierung
- `public/dashboard.html` + `public/js/dashboard.js` — Control Center
- `public/css/style.css` — das Theme

### 🔐 Login-System
- **Owner:** Nummer `4915155894714` + Passwort aus `OWNER_PASSWORD` → nach erfolgreicher 2FA,
  **KEIN Verify-Code** nötig.
- **Alle anderen:** Nummer eingeben → der laufende LoveBot sendet einen
  **6-stelligen Code per WhatsApp** an die Nummer (über `Database/webmail.json`,
  der Bot pollt alle 2 Sekunden) → Code eingeben → **eigenes Passwort anlegen**
  (wird gehasht in `Database.json` → `meta.webusers` + Status im eigenen
  LoveBot-Profil unter `security.dashboard` gesichert).
- Rate-Limit (3 Codes / 10 Min.), 5 Code-Versuche, 24h-Sessions.

### 📊 Dashboard-Bereiche
| Bereich | Funktionen |
|---|---|
| Übersicht | Bot online/offline (Heartbeat), JID+LID, Nutzer/Gruppen/Bans, RAM, Uptime |
| 👑 Owner | Zusatz-Owner ansehen/hinzufügen/löschen (gleiches System wie `$addowner`) |
| 🤬 Badwords | Filter an/aus, Wörter hinzufügen/entfernen |
| 👥 Gruppen | Alle Gruppen mit Feature-Toggles (Auto-DL, Welcome, Goodbye, Badwords, Anti-Link) — wie `$an/$aus` |
| 📢 Broadcast | Text in alle Gruppen senden (läuft über den Bot) |
| 🚫 Bans | Ban-Liste + Entbannen |
| 👤 Profile | Alle Nutzer suchen (Name/Level/Liebe/Wallet) |
| 📜 Logs | Live-Log (`Logs/lovebot.log`, wird von `logLove` mitgeschrieben) |

### 🔌 Anbindung im Bot (`Love.js`)
- `startDashboardTimers()` startet nach dem Verbinden: Mailbox-Poller (2s) +
  Heartbeat-Schreiber (10s, `Database/heartbeat.json`).
- Bei Disconnect wird `online:false` gemeldet.

## 🔧 $addmeta — finaler Stand
Alles Machbare ist umgesetzt: `@s.whatsapp.net`-JID, Bot-Admin-Check mit
klarer Anleitung, IQ-Status-Auswertung (200/403/404/408…), Kandidaten-Fallback
(`@c.us`), Verifizierung per frischer `groupMetadata`. Wenn der Add trotzdem
nicht klappt, liegt es an einer **serverseitigen Einschränkung von WhatsApp**
(neue App-Versionen erlauben den Add teils nur noch über den Button
„Meta AI hinzufügen“ in der App selbst) — das meldet der Bot jetzt ausdrücklich.

---

# 🔧 LOVE BOT v2.8 — ADDMETA FIX v3 (03.09.2026)

## $addmeta — warum es vorher nie geklappt hat
1. **Baileys liefert `META_AI_JID` als `@c.us`** → Gruppen-Add schlägt fehl
   (bereits in v2.3 gefixt: `13135550002@s.whatsapp.net`).
2. **Der Bot selbst war nicht Admin** — ohne Admin-Rechte kann er niemanden
   hinzufügen, der Fehler kam aber nur als kryptische Exception.
3. **Keine Status-Auswertung** — `groupParticipantsUpdate` liefert
   `[{ status, jid }]`, das wurde ignoriert.

## Fix v3
- ✅ **Expliziter Bot-Admin-Check VOR dem Add:** Ist der Bot nicht in der
  Gruppe oder kein Admin, kommt eine klare Anleitung (Bot zum Admin machen →
  erneut `$addmeta`), statt eines stillen Fehlers.
- ✅ **IQ-Status wird ausgewertet:** `200` = Erfolg, `408/409/304` = schon in
  der Gruppe, `403` = „nur Admins dürfen hinzufügen“ (Gruppen-Einstellung!),
  `404/401/500` mit eigener Erklärung.
- ✅ Kandidaten-JIDs: `13135550002@s.whatsapp.net` **und** `@c.us`.
- ✅ Verifizierung nach 4 Sekunden per frischer `groupMetadata`.
- ✅ `$acheck` erkennt den Bot jetzt auch in LID-Gruppen zuverlässig
  (inkl. DB-Mapping-Fallback).
- 💡 Falls WhatsApp den Add serverseitig blockiert: letzter Ausweg ist der
  Button „Meta AI hinzufügen“ in der WhatsApp-App (Gruppeninfo).

---

# 📲 LOVE BOT v2.7 — $SEE, $POLL, $HIDETAG & OWNER OHNE LIMIT (03.09.2026)

## 📲 `$see` — Status reposten
Antworte auf einen Status (status@broadcast) mit `$see` → der Bot sendet den
**kompletten Status** in deinen Chat:
- 🖼️ Bild-Status → Bild **+** Caption-Text
- 🎬 Video-Status → Video (inkl. GIF-Flag) + Caption
- 🎧 Audio-Status → Audio (Sprachnachricht bleibt PTT)
- 😀 Sticker-Status → Sticker
- 📄 Datei-Status → Dokument
- ✍️ Text-Status → Text
- Absender wird als „📲 STATUS VON @user“ erwähnt

**Aliase:** `$see`, `$seestatus`, `$viewstatus`, `$statusdl`

## 📊 `$poll` — echte WhatsApp-Umfragen
`$poll Was essen wir? | Pizza | Döner | Burger` → erstellt eine **native
WhatsApp-Umfrage** zum Antippen (bis zu 12 Optionen, eine Antwort wählbar).
Fallback als Text-Liste, falls der Client Polls nicht kann.
**Aliase:** `$poll`, `$umfrage`, `$abstimmung`

## 🫥 `$hidetag` — unsichtbares Taggen
`$hidetag <text>` (nur Admins) erwähnt **alle Mitglieder**, ohne dass die
Mentions im Text sichtbar sind. Zitierte Nachrichten werden als Text übernommen.

## 👑 Owner-System ohne Limit
- Das 10-Owner-Limit ist **weg** — der Haupt-Owner darf jetzt **unbegrenzt**
  viele Zusatz-Owner eintragen.
- `$ownerlist` zeigt die Anzahl ohne Maximum.

---

# 👑 LOVE BOT v2.6 — $ADDOWNER / $DELOWNER (03.09.2026)

## Zusatz-Owner-System
| Befehl | Wer darf? | Funktion |
|---|---|---|
| `$addowner @user <name>` | **NUR Haupt-Owner** (4915155894714@s.whatsapp.net / 269574108926096@lid) | Person wird Owner |
| `$delowner @user\|<nummer>\|<name>` | **NUR Haupt-Owner** | Owner entfernen |
| `$ownerlist` | alle | Haupt-Owner + alle Zusatz-Owner ansehen |

**Beispiel:** `$addowner @user Freundin` → gespeichert als **Owner Freundin**:
- JID (`@s.whatsapp.net`) **und** LID (`@lid`) der Person werden in
  `Database/Database.json` → `meta.owners` gespeichert.
- Die Person bekommt ab sofort **überall Owner-Rechte** (`isHost` = true):
  `$ban`, `$bc`, `$setppbot`, `$badword`, `$an/$aus`, `$addmeta`, alle
  anderen Owner-Befehle — und sie ist **immun gegen den Badword-Filter**.

**Schutz:**
- `$addowner`/`$delowner` kann wirklich nur der Haupt-Owner — selbst
  Zusatz-Owner können keine Owner eintragen/löschen.
- Maximal 10 Zusatz-Owner, keine Duplikate.
- `$delowner` findet den Owner per Mention, Reply, Nummer **oder Name**
  (z. B. `$delowner Freundin`).

---

# 🔍 LOVE BOT v2.5 — $ACHECK (03.09.2026)

## `$acheck` — der große Gruppen-Check
Prüft **alle Rollen auf einen Blick**, jeweils mit **JID + LID**:

- 🤖 **Bot-Status:** Ist der Bot in der Gruppe? Ist er **Admin**?
  (mit Warnung, falls nicht — ohne Admin kann er nicht löschen/kicken)
- 👑 **Owner/Superadmins** — mit JID + LID + separat aufgelöster
  Gruppen-Owner (JID + LID)
- ⭐ **Admins** — nummerierte Liste mit JID + LID (max. 25, danach Zähler)
- 👤 **Mitglieder** — Anzahl + ID-Vorschau
- 📊 Dazu: Gruppenname, Gruppen-ID, Teilnehmerzahl gesamt

**Aliase:** `$acheck`, `$admincheck`, `$allcheck`, `$gruppencheck`

Das JID↔LID-Lookup nutzt die gleiche User-DB wie der Admin-Fix (v2.4) —
unbekannte LIDs werden als „— (nicht in der DB)“ markiert.

---

# 🔧 LOVE BOT v2.4 — ADMIN-FIX & JID/LID ÜBERALL (03.09.2026)

## 🛠️ Admin-Erkennung repariert
**Problem:** In Gruppen mit LID-Adressierung (WhatsApp Standard bei neuen
Gruppen) stehen in `groupMetadata.participants` nur `@lid`-IDs — der Bot hat
den Sender aber per `@s.whatsapp.net` verglichen. Die Zahlen von JID
(Handynummer) und LID sind völlig unterschiedlich, also wurde **kein Admin
erkannt** und Befehle wie `$warn`, `$kick`, `$an/$aus`, `$fp` wurden
verweigert.

**Fix (`waApi.js`):**
- Neuer **JID↔LID-Mapping-Cache** `getIdMappings()` — liest alle bekannten
  JID/LID-Paare aus `Database/Database.json` (User-Profile + BIDs), 15s Cache.
- `participantMatches()` testet jetzt: exakte ID, `p.lid`, alternative ID
  **und** das gemappte Gegenstück (JID→LID und LID→JID).
- `isMember`, `isAdmin`, `isSuperAdmin`, `getParticipantRole` akzeptieren
  jetzt `(metadata, jid, lid)` — alle Aufrufe im Bot übergeben beide IDs.
- Die wichtigste Zeile: `userRole` (steuert ALLE Admin-Checks) wird jetzt
  mit JID + LID + Mapping berechnet.

## 🆔 JID & LID jetzt überall sichtbar
| Stelle | Anzeige |
|---|---|
| `$id` | Chat, deine JID+LID, Bot-JID+LID |
| `$jid` / `$lid` / `$ids` | gezielte Auflösung pro User |
| `$me` | eigenes Profil inkl. JID + LID |
| `$warn` | Verwarnung zeigt JID + LID des Users |
| `$ban` | Ban-Bestätigung zeigt JID + LID |
| `$groupinfo` | Owner jetzt als JID **und** LID |
| Automod (Badword/Antilink) | Verwarn- & Kick&Ban-Meldungen zeigen JID + LID |
| `$check` / `$check2` | wie bisher (Tabelle) |

---

# 🚀 LOVE BOT v2.3 — METAFIX, ECONOMY, INTERNET & 15+ NEUE BEFEHLE (03.09.2026)

## 🔧 $addmeta / $kickmeta FIX
- **Problem:** baileys liefert `META_AI_JID` als `13135550002@c.us` — mit
  `@c.us` schlägt der Gruppen-Add fehl.
- **Fix:** Add läuft jetzt mit `13135550002@s.whatsapp.net`, prüft danach
  per Gruppen-Metadaten ob Meta AI wirklich beigetreten ist und meldet
  klare Fehler („Bot muss Admin sein!“).
- `$kickmeta` sucht die echte Teilnehmer-JID aus den Metadaten statt der
  falschen Konstante.

## 🤖 Meta-AI-Weiterleitung (`$metaforward`, Owner)
- `$metaforward on` in einem Chat → **alle Antworten von Meta AI** (aus
  allen Chats/Gruppen) werden als Weiterleitung dorthin geschickt.
- `$metaforward off` / `$metaforward` (Status).
- Gespeichert in `Database/Database.json` → `meta.metaForward`.

## 💰 Economy-System
| Befehl | Funktion |
|---|---|
| `$daily` | Tägliche Belohnung: 150–400 🤎, 20–80 🩶, 5–15 💛 (24h-Cooldown) |
| `$work` | 8 zufällige Jobs, 40–200 Kupfer (10 Min. Cooldown) |
| `$gamble <einsatz\|all>` | Kupfer wetten — 45% Chance auf Verdopplung |
| `$balance` / `$coins` / `$wallet` | Wallet-Anzeige |
| `$top` / `$leaderboard` | Top 10 nach Level + eigener Platz 🏆 |

## 🌐 Internet-Befehle (ohne extra Pakete, per fetch)
| Befehl | Funktion |
|---|---|
| `$wiki <begriff>` | Wikipedia-Artikel (de) mit Bild 📖 |
| `$catfact` | Katzen-Fakt (catfact.ninja) 🐱 |
| `$dogfact` | Hunde-Fakt 🐶 |
| `$github <owner/repo>` | Stars, Forks, Sprache, Link 🐙 |

## 🎭 Neue Fun-Befehle
- `$roast @user` — 10 Roast-Sprüche 🔥
- `$eod` — Entweder-oder-Fragen 🤔
- `$nie` — „Nie habe ich …“-Runde 🙊
- `$quiz` — Frage, Antwort kommt nach 20 Sekunden 🧠

## ⏰ Utilities & Owner
- `$remind <zeit> <text>` — Erinnerung (z. B. `$remind 2h Meeting`), max. 24h
- `$cleartmp` — Owner: räumt den `./tmp`-Ordner auf 🧹

**Gesamt jetzt: 130+ Befehle in 12 Help-Kategorien.**

---

# 🛡️ LOVE BOT v2.2 — BADWORDS, ANTI-LINK & JID/LID (03.09.2026)

## 🤬 Badword-Filter (Liste in `badwords.js`)
- Die Wortliste liegt in **`badwords.js`** (ca. 50 deutsche Schimpfwörter,
  inkl. Leetspeak-Erkennung: `4rschl0ch` wird trotzdem erkannt).
- Ablauf bei Treffer in einer Gruppe:
  1. 🗑️ Nachricht wird **gelöscht** (Bot muss Admin sein)
  2. ⚠️ **Verwarnung** (wird im Gruppenprofil gespeichert, wie `$warn`)
  3. 🚫 Bei **3 Verwarnungen**: Kick aus der Gruppe **+ Ban im Bot**
     (blockiert + aus allen Gruppen entfernt + in `db.bans` gespeichert)
- **Owner ist immun**, Gruppen-**Admins** dürfen alles schreiben.
- Läuft automatisch bei **jeder** Nachricht (auch Befehlen).

### Badword-Befehle (nur Owner 👑)
| Befehl | Funktion |
|---|---|
| `$badword` | Status + Hilfe |
| `$badword add <wort>` | Wort zur Liste hinzufügen |
| `$badword remove <wort>` | Wort entfernen (auch aus badwords.js-Liste) |
| `$badword list` | alle aktiven Wörter anzeigen |
| `$badword on` / `$badword off` | Filter global an/aus |

Pro Gruppe zusätzlich über die Feature-Toggles:
`$an badwords` / `$aus badwords` (Admins).

## 🔗 Anti-Link (neues Feature)
- `$an antilink` in der Gruppe aktivieren (Standard: aus).
- Löscht **Gruppen-Einladungslinks** (`chat.whatsapp.com/…`) von
  Nicht-Admins und verwarnet sie — gleiche 3-Verwarnungen-Regel.

## 🆔 JID & LID auflösen
| Befehl | Funktion |
|---|---|
| `$jid @user / reply / nummer` | zeigt die JID (`4915155894714@s.whatsapp.net`) |
| `$lid @user / reply / nummer` | zeigt die LID (`269574108926096@lid`) |
| `$ids @user` | zeigt Nummer + JID + LID zusammen |

## Technik
- Laufzeit-Wörter landen in `Database/Database.json` → `meta.badwords`
  (`enabled`, `added`, `removed`) und werden mit `badwords.js` kombiniert.
- Automod-Funktion: `runAutoModeration()` läuft vor dem Präfix-Check.
- Verwarnungen nutzen das gleiche Speicherformat wie `$warn`
  (`LoveGroups/<gruppe>/…json` → `warns`), also mit `$warns`/`$unwarn` kompatibel.

---

# 🎛️ LOVE BOT v2.1 — FEATURE-TOGGLES FÜR GRUPPEN (03.09.2026)

## `$an`, `$aus`, `$gi` — Features pro Gruppe steuern

| Befehl | Funktion |
|---|---|
| `$an <feature>` | ✅ Feature in dieser Gruppe **aktivieren** |
| `$aus <feature>` | ❌ Feature in dieser Gruppe **deaktivieren** |
| `$an alle` / `$aus alle` | alle Features auf einmal umschalten |
| `$gi` / `$features` | 🎛️ zeigt **alle Features** und ob sie AN oder AUS sind |

- Nur **Admins, Superadmins und der Owner** dürfen umschalten.
- `$gi` darf jeder ansehen.
- Feature-Namen verstehen auch Aliase: `$an download`, `$aus marry`,
  `$an spass`, `$aus musik`, `$an willkommen`, …

## Die 10 umschaltbaren Features

| Feature | Key | Steuert |
|---|---|---|
| 📥 Auto-Download | `autodl` | automatisches Laden von YT/TikTok/IG-Links |
| 👋 Welcome | `welcome` | Willkommensnachrichten |
| 🚪 Goodbye | `goodbye` | Abschiedsnachrichten |
| 🦵 Kick-News | `kickmsg` | Nachrichten bei Kicks |
| ⭐ Promote-News | `promotemsg` | Nachrichten bei Admin-Beförderung |
| ⬇️ Demote-News | `demotemsg` | Nachrichten bei Admin-Entfernung |
| 💍 Liebe & Marry | `liebe` | marry, divorce, ship, kiss, hug, slap, compliment |
| 🎉 Fun & Spiele | `fun` | witz, fakt, 8ball, rps, slot, truth, dare, dice, coin, random … |
| 🎨 Media & Play | `media` | $play, $audio |
| 🧰 Werkzeuge | `tools` | calc, b64, reverse, flip, upper, lower, length … |

## Technik
- Gespeichert in `Database/Database.json` → `groups.<gruppenId>` (gleiche
  Keys wie die alten `$welcome on|off`-Schalter, also kompatibel).
- Deaktivierte Befehle werden **vor** der Ausführung blockiert und melden:
  „Feature deaktiviert — ein Admin kann es mit `$an <feature>` wieder einschalten.“
- `$gi` zeigt eine Übersicht mit ✅/❌ pro Feature, Anzahl aktiver Features
  und dem Gruppennamen.

---

## 📋 1. Interaktives Single-Select-Menü (`$menunew`)

`$menunew` sendet **`Bilder/Menu.png`** als Anhang **und** ein klickbares
Single-Select-Listen-Menü mit **sichtbaren Buttons** – funktioniert auf
**iOS und Android**. Es zeigt **alle Befehle in Kategorien**.

| Kategorie | Befehle |
|---|---|
| 🐣 Start | `menu/help`, `menunew`, `me`, `register`, `owner`, `love/socials` |
| 🧰 Allgemein | `ping`, `system/stats`, `id`, `username`, `bio/status`, `devices`, `url`, `hash`, `i3`, `i2/fetch` |
| 💤 AFK & Profil | `afk <grund>`, `afk off`, `afklist`, `check`, `check2` |
| 👥 Gruppe | `tagall/all`, `groups`, `groupinfo`, `rules`, `setup`, `activate`, `deactivate`, `kickall`, `welcome`, `goodbye`, `kick`, `promote`, `demote` |
| 🛡️ Admin & Verifikation | `dsgvo`, `verify`, `ban`, `unban`, `banlist`, `fp` |
| 🎨 Medien & AI | `audio`, `play`, `loadingaiimg`, `loadingaivid`, `addmeta`, `kickmeta` |
| 🎉 Spass & Tools | `date/today`, `calc`, `reverse`, `random`, `dice`, `coin`, `truth`, `dare`, `quote`, `say`, `gits` |

Beim Antippen eines Eintrags sendet der Client
`listResponseMessage.singleSelectReply.selectedRowId` (= `cmd:<befehl>`) zurück;
der Bot wertet das bereits über `getInteractiveCommandSelection()` aus.

---

## 💤 2. AFK-System (mit Auto-Comeback)

| Befehl | Wirkung |
|---|---|
| `$afk (weil ich es kann)` | meldet dich ab; Grund = `weil ich es kann` |
| `$afk` | meldet dich ab mit Standard-Grund |
| `$afk off` | beendet AFK manuell |
| `$afklist` | zeigt alle aktuell AFK |

**Verhalten:**
- Erwähnt jemand `@person` die AFK ist → `person ist seit (Zeit) AFK · Grund … · kann gerade nicht reden`.
- Antwortet jemand auf eine Nachricht einer AFK-Person → gleicher Hinweis.
- Macht die AFK-Person **irgendetwas** (schreibt, antwortet, **reagiert mit Emoji**) →
  `@user du bist nach (Dauer) wegen (Grund) AFK — willkommen zurück!` und der Status wird gelöscht.

---

## 🤖 3. Auto-Mod (Welcome · Goodbye · Kick · Promote · Demote)

| Ereignis | Nachricht |
|---|---|
| Person **tritt bei** | freundliche Willkommensnachricht inkl. Bot-Erklärung |
| Person **verlässt** | `@person hat @gruppe verlassen … vielleicht sehen wir uns bald wieder :(` |
| Person wird **gekickt** | `@person wurde von @user aus @gruppe gekickt — halte dich beim nächsten Mal an die Regeln` |
| Person wird **Admin** | `@user wurde von @admin zum Admin gemacht — zerstöre es nicht!` |
| Person wird **Admin entfernt** | `@user wurde von @admin als Admin entfernt … du hast versagt` |

Schaltbar (Admin / Superadmin / Owner, nur in der Gruppe):

```
$welcome on|off
$goodbye on|off
$kick     on|off
$promote  on|off
$demote   on|off
```

---

## 📊 4. System-Befehl (`$system` / `$stats`)

Schön formatiert mit Banner, Progressbalken und Prozentangaben:
**Uptime**, **Nutzer gesamt**, registrierte + verifizierte Nutzer,
**Gruppen gesamt**, aktive/inaktive Gruppen, Setup-Gruppen, **aktuell AFK**,
**Bans** und RAM (V8).

---

## 👥 5. Gruppen-Befehle

- `$groupinfo` / `$gcinfo` – Name, ID, Mitglieder, Admins, Owner, Bot-Status, Beschreibung.
- `$rules [text]` – Regeln anzeigen; mit Text Neue setzen (Admin).
- `$id` – Chat-ID, deine JID/LID, Bot-JID/LID.

---

## ⚙️ 6. Setup (nur Owner)

```
$setup
```

- Setzt die **Gruppen-Beschreibung** auf **LoveBot ist in `@gruppe` aktiv …** mit
  *Setup gesetzt am `(Zeit)` von `(Owner)`*.
- Aktiviert den Bot und speichert `setupAt`, `setupBy` in `Database.json` + `groups.json`.
- **Ohne `$setup` bleibt der Bot in der Gruppe inaktiv.**

---

## 🚫 7. Ban / Unban / Banlist (nur Owner)

```
$ban   <id|@user|nummer> <grund>
$unban <id|@user|nummer> <grund>
$banlist
```

**Ban:** **1.** PN an die Person *„du wurdest gebannt …“* → **2.** blockieren →
**3.** aus allen Gruppen entfernen/kicken → **4.** in DB sichern.
**Unban:** **1.** entblocken → **2.** PN *„du wurdest entbannt … sorry …“*.
Schreibt eine gebannte Person in einer Gruppe → Nachricht als Admin gelöscht,
Abschiedsnachricht inkl. Grund, Kick.

---

## 🎉 8. Spass- & Tool-Befehle

`$date`/`$today`/`$time` · `$calc <ausdruck>` · `$b64` · `$reverse` ·
`$flip` · `$upper`/`$lower` · `$length` · `$invisible` · `$random <a-b>` ·
`$dice` · `$coin` · `$truth` · `$dare` · `$quote`/`$zitat` · `$say <text>`
· `$pfp`/`$pp @user` · `$type <jid>` · `$info`/`$botinfo`

## 🛠️ 9. Gruppen- & Admin-Befehle

- **Dual-Modus:** `$kick`/`$promote`/`$demote @user` = echte Aktion, `… on|off` = Auto-Nachricht togglen
- `$warn @user <grund>` / `$unwarn @user` / `$warns @user` – Verwarnungen
- `$add <nummer>` / `$link` / `$revoke` / `$setname` / `$setdesc` / `$mute` / `$unmute` / `$delete`
- `$tagadmin` / `$join <link>` / `$leave`
- `$block` / `$unblock` (Owner)

---

## 🎰 Slot & AI-Loading (App-Look)

- **`$slot` / `$spin` / `$automaten`** – Slot-Machine: sendet erst eine animierte
  Meta-AI „GENERATING“-Karte, nach ~2,8 s das Ergebnis mit Emoji-Roll (🎰),
  Jackpot-/Gewinn-/Verlust-Text und Konfetti bei Jackpot.
- **`$slotmini`** – schneller Mini-Slot.
- **`$imagine <prompt>`** – AI-Bild-Generierungs-Karte (App-Look).
- **`$animate <prompt>`** – AI-Video-Generierungs-Karte (App-Look).
- **`$typing [text]` / `$loading` / `$render`** – beliebige Lade-Animation.

Alle basieren auf derselben `sendGeneratingPayload()`-Hilfsfunktion (iOS + Android).

## 📂 Geänderte Dateien
- `Love.js` — alle Befehle, interaktives Menü, AFK-/Ban-Lebenszyklus, `$system`
- `waApi.js` — DB-Sektionen `afk`/`bans`/`meta` + `readDatabaseStore`/`writeDatabaseStore`
- `features.js` — **neu**, komplette Logik + Menü-Sektionen
- `README.md` — Dokumentation erweitert

# LoveBot – vollständige Installations- und Nutzungsanleitung

> Die Informationen in dieser Datei sind als ausführliches Handbuch für die Nutzung dieses Projekts gedacht. Sie erklären den kompletten Ablauf von der Installation bis zur Verwendung, inklusive Login, Registrierungsprozess, Befehle und Hinweise zu Datenschutz, Sicherheit und Verantwortung.

> Wichtiger Hinweis zur Verantwortung: Wenn du dieses Projekt herunterlädst, installierst und ausführst, trägst du als Nutzer die alleinige Verantwortung für die Nutzung, die Konfiguration, den richtigen Betrieb, die Sicherheit deines Geräts, deinen WhatsApp-Account, deine Daten und die Einhaltung aller geltenden Gesetze und Richtlinien. Der Entwickler/Autor dieses Projekts, die Verwalter und alle Mitwirkenden übernehmen keine Haftung und keine Verantwortung für Schäden, Datenverluste, Accountprobleme, rechtliche Folgen, Kommunikationsfehler, Missbrauch oder sonstige Ereignisse, die durch die Nutzung des Bots entstehen. Dieses Projekt wird ohne Gewährleistung bereitgestellt.

---

## 1. Überblick

Dieses Projekt ist ein WhatsApp-Bot, der mit Baileys und Node.js läuft. Es enthält:

- Verbindung zu WhatsApp über einen Login mit QR-Code oder Pairing-Code
- Session-Handling mit gespeicherten Credentials
- Registrierungslogik für Nutzerprofile
- Info-Befehle wie `$me`, `$owner`, `$ping`, `$help`
- Gruppen- und Admin-Funktionen
- Medien-/AI-/Link-/Hash-Funktionen
- Profil- und Statusfunktionen
- lokale Datenspeicherung im Projektordner

Das Projekt nutzt unter anderem:

- Node.js
- Baileys
- `qrcode-terminal`
- `ffmpeg-static`
- `pino` und weitere Pakete

Das Projekt ist im aktuellen Zustand ein lokaler Bot, der auf deinem eigenen Rechner ausgeführt wird. Das bedeutet: Du selbst bist der Betreiber.

---

## 2. Voraussetzungen

Vor dem Start solltest du folgendes vorbereitet haben:

### 2.1 Software

- Node.js Version 24 oder höher
- npm oder pnpm (npm wird hier vorausgesetzt)
- Git (optional, aber nützlich zum Download)
- Terminal oder PowerShell
- Auf Windows: PowerShell oder CMD

### 2.2 Hardware / Umgebung

- Ein Computer mit laufendem Betriebssystem
- Internetzugang
- Zugriff auf dein WhatsApp-Konto mit dem du den Bot verbinden möchtest
- Ein Smartphone, auf dem du WhatsApp benutzt und mit dem du den QR-Code oder Pairing-Code scannen kannst
- Stabiler Speicherplatz auf dem Rechner

### 2.3 Wichtig vor dem Start

- Stelle sicher, dass du die Nutzung von WhatsApp-Bots auf deinem Account und Gerät erlaubst
- Nutze nur dein eigenes WhatsApp-Konto oder ein Konto, für das du die Rechte und Erlaubnis hast
- Vermeide das Ausführen des Bots auf öffentlichen oder unsicheren Rechnern
- Sichere wichtige Daten, bevor du Session-Ordner oder WhatsApp-Session-Dateien löschst

---

## 3. Projekt herunterladen

### Option A: ZIP herunterladen

1. Lade das Projekt als ZIP-Datei herunter.
2. Entpacke es an einen beliebigen Ort, zum Beispiel:
   - `C:\Users\DeinName\Desktop\LoveBot`
3. Öffne danach das Projektverzeichnis in einem Terminal.

### Option B: mit Git klonen

```bash
git clone <repository-url>
cd LoveBot
```

Falls du den vollständigen Link nicht hast, wähle den Download auf GitHub oder den Ordner, den du von der Quelle erhalten hast.

---

## 4. Projektverzeichnis verstehen

Im Basisordner findest du unter anderem diese wichtigen Dateien und Ordner:

- `Love.js` – Hauptprogramm des Bots
- `waApi.js` – WhatsApp-API-Logik und Pairing-/Login-Funktionen
- `nodeApi.js` – Node-/Systemfunktionen
- `colorApi.js` – farbige Konsolenausgabe
- `package.json` – Projektkonfiguration und Startbefehle
- `Bilder/` – Bilddateien, z. B. Profilbilder, Menübilder, Owner-Bilder
- `Database/` – lokale Datenbank-/Profilordner
- `Sessions/` – Session-Dateien nach dem Login
- `README.md` – Doku

Das Wichtige: Nach dem ersten Login wird ein Session-Ordner für WhatsApp-Credentials erstellt. Dieser enthält lokal gespeicherte Authentifizierungsdaten. Das ist nicht automatisch „unsicher“, aber du bist für die sichere Aufbewahrung verantwortlich.

---

## 5. Abhängigkeiten installieren

Öffne PowerShell oder CMD im Projektordner und führe aus:

```bash
npm install
```

Wenn alles korrekt ist, werden die benötigten Pakete installiert und der `node_modules`-Ordner wird angelegt.

### Prüfen der benötigten Version

In `package.json` ist die Mindestversion gesetzt:

```json
"engines": {
  "node": ">=24.0.0"
}
```

Wenn du eine ältere Node.js-Version hast, installiere zuerst eine passende Version. Auf Windows kannst du z. B. nvm-windows verwenden oder eine neuere Node-Version direkt installieren.

---

## 6. Projekt starten

Der Startbefehl ist in `package.json` definiert:

```json
"scripts": {
  "start": "node Love.js",
  "watch": "node --watch Love.js"
}
```

Starte das Projekt mit:

```bash
npm start
```

Oder mit Watch-Modus:

```bash
npm run watch
```

Wenn das Projekt korrekt gestartet wird, erscheint das Pairing-Menü bzw. je nach aktuellem Zustand eine Session-Auswahl.

---

## 7. Login- und Pairing-Ablauf

Der Bot hat je nach Sessionzustand ein Menü, das durch `pairMenu()` bereitgestellt wird.

### 7.1 Noch keine Session vorhanden

Wenn keine gültige Session gefunden wurde, erscheint ein Menü wie dieses:

- `[p]` – Pairing per Telefonnummer + Code initialisieren
- `[q]` – QR-Code im Terminal für den Login generieren
- `[x]` – Skript beenden

### 7.2 Pairing über Telefonnummer und Code

Wenn du `p` wählst, wirst du nach einer Telefonnummer mit Ländervorwahl gefragt.

Beispiel:

```text
491701234567
```

Danach startet der Bot den Pairing-Prozess.

Der Bot ruft die Funktion `sock.requestPairingCode(cleanNumber)` auf und zeigt dir den erhaltenen Code im Terminal an.

Dann musst du in WhatsApp auf deinem Smartphone handeln:

1. WhatsApp öffnen
2. Auf das Drei-Punkte-Menü oder auf das Zahnradsymbol gehen
3. „Verknüpfte Geräte“ auswählen
4. „Mit Telefonnummer verknüpfen“ wählen
5. Den im Terminal angezeigten Pairing-Code eingeben

Der Code ist nur für den Verbindungsaufbau relevant und dient dazu, das Gerät als WhatsApp-Verknüpfung zu registrieren.

### 7.3 Login über QR-Code

Wenn du `q` wählst, wird ein QR-Code im Terminal generiert.

Danach geht man so vor:

1. WhatsApp auf dem Smartphone öffnen
2. „Verknüpfte Geräte“ auswählen
3. „Gerät koppeln“ / „QR-Code scannen“
4. QR-Code im Terminal mit der Kamera scannen

Der QR-Code erscheint im Terminal und wird mit `qrcode-terminal` dargestellt. Das ist ein standardmäßiger Login-Mechanismus für WhatsApp-Clients.

### 7.4 Session gefunden

Wenn bereits eine valide Session existiert, erscheint ein Menu mit:

- `[r]` – Reconnect mit vorhandenen Credentials
- `[d]` – Session löschen
- `[x]` – Skript beenden

Das ist wichtig, denn der Bot erkennt bereits gespeicherte Auth-Daten und kann die Verbindung wiederherstellen.

### 7.5 Session löschen

Wenn du `[d]` auswählst, werden die Session-Daten gelöscht. Das kann praktisch sein, wenn du einen neuen Login durchführen willst oder eine alte Session wegen Fehlern entfernen musst.

> Achtung: Beim Löschen der Session werden lokale Auth-Daten entfernt. Danach musst du erneut pairen oder einen QR-Code scannen.

---

## 8. Wie der Bot nach dem Login aufläuft

Sobald die Verbindung zu WhatsApp hergestellt ist, zeigt der Bot Informationen wie:

- Präfix des Bots (z. B. `$`)
- Host JID
- Host LID
- Host SID
- Erfolgsmeldung „WhatsApp verbunden“

Anschließend wird automatisch versucht, das Bot-Profil zu initialisieren, z. B.:

- Name setzen
- Status/Bio setzen
- Profilbild setzen
- Newsletter/Channel folgen
- Dev-Gruppe beitreten (wenn verfügbar)

Diese Aktionen sind Teil der automatischen Initialisierung. Sie sind im Code als `triggerLoveAutoConnectionActions` implementiert.

---

## 9. Registrierung mit `$register`

Der Bot hat eine eigene Registrierungsfunktion. Die genaue Logik findet sich im Code im Bereich `case 'register'`.

### 9.1 Format

```text
$register Name[.Alter][.Status][.Stadt]
```

Beispiele:

```text
$register Maxichen
$register Maxichen.25.Single.Kerkrade
```

### 9.2 Aufteilung

- `Name` = Maxichen (Pflicht, mind. 2 Zeichen)
- `Alter` = optional (Zahl oder `18+`)
- `Status` = optional, z. B. Single
- `Stadt` = optional

### 9.2.1 🔒 Datenschutz bei der Registrierung

Der Bot läuft in Gruppen — deshalb können Minderjährige mitlesen und
mitschreiben. Deshalb gilt seit dem Love-Core-Update:

- **Unter 13:** keine Registrierung möglich.
- **Unter 18:** es wird **kein exaktes Alter** gespeichert, nur die Spanne
  „unter 18“. Bestandsprofile werden von `scripts/migrate-privacy.mjs`
  automatisch bereinigt.
- **Stadt:** optional und in Gruppen immer maskiert (`K●●●●●●●`).
- **Öffentliche Profile** (Website) sind erst ab 18 und nur mit Opt-in möglich.
- Mit `$privacy` steuert jeder Nutzer seine Sichtbarkeit selbst.

Details: **[LOVE-CORE-2.md](./LOVE-CORE-2.md)**

### 9.3 Wie du es nutzt

1. Schreib in dem Chat mit dem Bot:

```text
$register Maxichen.16.Single.Recklinghausen
```

2. Der Bot prüft das Format.
3. Wenn es korrekt ist, speichert er die Daten lokal.
4. Der Bot bestätigt die Registrierung mit einer Textbestätigung oder einem Bildanhang.

### 9.4 Was genau gespeichert wird

Bei erfolgreicher Registrierung werden unter anderem folgende Felder gespeichert:

- `registered: true`
- `name`
- `age`
- `status`
- `city`
- `value`
- `registeredAt`

Das passiert im lokal gespeicherten Profil des Nutzers in der Projektstruktur, z. B. in einem Benutzerprofil unter `Database` oder in den Session-/User-Daten.

### 9.5 Fehler bei ungültigem Format

Wenn du nur `$register` schreibst oder ein falsches Format nutzt, gibt der Bot Hilfe aus. Dann zeigt er ein Beispiel und erklärt das Format.

Beispielhilfe:

```text
$register Maxichen.16.Single.Recklinghausen

Format:
$register Name.Alter.Status.Stadt
```

---

## 10. Profil abrufen mit `$me`

Der Befehl `$me` zeigt Informationen zu dem registrierten Benutzer an.

### 10.1 Funktion

Wenn der Nutzer noch nicht registriert ist, erhält er eine Meldung:

```text
Du bist noch nicht registriert.
Nutze: $register für Hilfe
```

Wenn der Nutzer registriert ist, zeigt der Bot Dinge wie:

- Name
- Alter
- Status
- Stadt
- Registriert seit
- Username
- JID
- LID
- BID
- DSGVO-Status
- Verify-Status
- Guthaben / Wallet
- Fortschritt / Level / Prestige / XP
- Gruppenrolle, falls in einer Gruppe

### 10.2 Beispiel

```text
$me
```

### 10.3 Was der Bot damit kann

Das dient dazu, die aktuelle Profilinformation leicht anzuzeigen. Für den Entwickler/Betreiber ist das wichtig für Debugging, Kontrolle und einfache Nutzerverwaltung.

---

## 11. Hilfe-Menü und Befehle

Der Bot hat ein komplettes Hilfe-Menü (`$menu` / `$help`) und ein interaktives
Single-Select-Menü (`$menunew`), das **alle Befehle in Kategorien** mit sichtbaren,
klickbaren Buttons (iOS **und** Android) anzeigt und **`Bilder/Menu.png`** als Anhang sendet.

### 11.1 Allgemein

- `$ping` – **echte Live-Messung**: Bot-Ping (WebSocket, WhatsApp-IQ, Sende-Roundtrip), Netzwerk-Ping (ICMP), Verbindungsaufbau (DNS/TCP/TLS/TTFB), öffentliche IP, Speed und Systemwerte – alles gemessen, nichts geschätzt
- `$ping <url>` – Webseiten-Ping (DNS · TCP · TLS · TTFB · Status · HTTP-Version · ICMP)
- `$ping full` – zusätzlich großer Speedtest · `$ping nospeed` – nur Latenz
- `$me` – zeigt eigene Infos + Profilbild
- `$register <Name.Alter.Status.Stadt>` – Registrierung
- `$username` – zeigt Username-Infos
- `$system` / `$stats` – zeigt Uptime, Nutzer, Gruppen, AFK, Bans, RAM *(schön formatiert)*
- `$sys` – V8-Speicherinfo
- `$info` / `$botinfo` – Bot-Infos, Version, Features
- `$id` – zeigt Chat-ID, deine JID/LID, Bot-JID/LID
- `$hash <text>` – berechnet Hashes
- `$url <link>` – analysiert einen Link
- `$i2` / `$fetch` – liest zitierte Nachrichten
- `$i3` – zeigt Debug-Tabelle
- `$menunew` – **interaktives Single-Select-Menü** mit Bild (iOS + Android)
- `$owner` – zeigt Owner-Kontakt
- `$love` / `$socials` – zeigt Love-/Social-Links
- `$gits` – zeigt GitHub-Repos

### 11.2 Profil & Info

- `$bio` / `$status` – zeigt Bio/Status
- `$devices` – prüft Geräteinfos
- `$check <id>` – prüft ID/JID/LID
- `$check2 <nummer>` – prüft Ban-/Status

### 11.3 Gruppe

- `$tagall` / `$all` – erwähnt alle Mitglieder
- `$tagadmin` – erwähnt alle Admins
- `$groups` – zeigt alle Bot-Gruppen
- `$groupinfo` / `$gcinfo` – Infos zu dieser Gruppe (Name, ID, Mitglieder, Admins, Bot-Status, Beschreibung)
- `$rules [text]` – Regeln anzeigen, mit Text setzen (Admin)
- `$kickall` – entfernt alle außer Owner/Admins
- `$activate` – aktiviert den Bot
- `$deactivate` – deaktiviert den Bot
- `$setup` – **Owner:** aktiviert Bot & setzt die Gruppen-Beschreibung
- `$welcome / $goodbye [on/off]` – Auto-Nachrichten ein-/ausschalten
- `$kick / $promote / $demote @user` – echte Aktion (Admin); mit `on/off` die Auto-Nachricht togglen
- `$add <nummer>` – Nutzer hinzufügen
- `$link` – Einladungslink; `$revoke` – Link zurückziehen
- `$setname <name>` / `$setdesc <text>` – Gruppenname/-Beschreibung
- `$mute` / `$unmute` – Gruppe stummschalten/entsperren
- `$delete` – zitierte Nachricht löschen
- `$warn @user <grund>` / `$unwarn @user` / `$warns @user` – Verwarnungen
- `$join <link>` – Gruppe beitreten; `$leave` – Gruppe verlassen (Owner)
- `$addmeta` – fügt Meta AI hinzu
- `$kickmeta` – entfernt Meta AI

### 11.4 Admin / Verifikation

- `$verify [accept/reject]` – Verifizierung
- `$dsgvo [accept/reject]` – DSGVO
- `$block <nr|@user>` / `$unblock <nr|@user>` – blockieren/entblockieren (Owner)
- `$fp` – Fake Payment

### 11.5 Media / AI

- `$play <link/song>` – lädt Infos/Bild/Video/Audio
- `$audio <modul>` – Audio beeinflussen
- `$loadingaiimg` – AI-Bild-Loading
- `$loadingaivid` – AI-Video-Loading
- `$imagine <prompt>` – AI-Bild-Generierung (App-Look)
- `$animate <prompt>` – AI-Video-Generierung (App-Look)
- `$typing [text]` – AI Lade-Animation
- `$slot` – Slot-Machine (App-Look mit Sound-Effekt)
- `$slotmini` – Mini-Slot

### 11.6 Werkzeuge & Utilities

- `$date` / `$today` / `$time` – Datum & Uhrzeit
- `$calc <ausdruck>` – Rechner, z. B. `$calc (2+3)*4`
- `$b64 <text>` – Base64 en-/dekodieren
- `$reverse <text>` – Text umkehren
- `$flip <text>` – Text auf den Kopf stellen
- `$upper <text>` / `$lower <text>` – Groß-/Kleinbuchstaben
- `$length <text>` – Zeichen-, Wort- & Byteanzahl
- `$invisible` – unsichtbare Zeile
- `$random <a-b>` – Zufallszahl, z. B. `$random 1-100`
- `$dice` – würfeln (1–6)
- `$coin` – Münzwurf (Kopf/Zahl)
- `$truth` – „Wahrheit“-Frage
- `$dare` – „Pflicht“-Aufgabe
- `$quote` / `$zitat` – Zitat
- `$say <text>` – Bot spricht für dich
- `$pfp` / `$pp @user` – Profilbild anzeigen
- `$type <jid>` – JID-Typ prüfen
- `$join <link>` – Gruppe beitreten
- `$leave` – Gruppe verlassen (Owner)

### 11.7 AFK, Ban & Moderation

- `$afk <grund>` – AFK setzen
- `$afk off` – AFK beenden / Auto-Comeback bei jeder Aktion
- `$afklist` – wer ist gerade AFK
- `$ban <id|@user|nummer> <grund>` – **Owner:** Ban (PN → block → kick)
- `$unban <id|@user|nummer> <grund>` – **Owner:** Entbannen (unblock → PN)
- `$banlist` – **Owner:** alle Bans

### 11.8 Sonstiges

- `$menu` / `$help` – Hilfe-Menü
- `$owner` – Owner-Kontakt

### 11.9 Love Core 2.0 (neu)

- `$love` – **das Beziehungs-Panel**: Liebeslevel mit Balken, Love-XP, Streak,
  gemeinsame Liebesnachrichten, Tage zusammen, gemeinsame Aktionen, Trennungen,
  Meilensteine (7/30/100/365 Tage · 100/500/1.000 Nachrichten · Streak)
- `$partner` – Kurzversion: Partner, Level, Streak, Nachrichten
- `$dailylove` – ein Tagesimpuls (Tipp · Kompliment · Challenge · Zitat) inkl.
  +25 XP und +50 Kupfer, mit eigener Serie
- `$socials` / `$links` – Love-/Social-Links (früher `$love`)
- Gezählt werden: `$kiss` · `$hug` · `$slap` · `$compliment` · `$flirt` ·
  `$anmachen` · `$confess` · `$confesslove` · `$romantic` · `$goodmorning` ·
  `$goodnight` · `$gift` · `$letter` · `$dateidee`

### 11.10 Privatsphäre (neu)

- `$privacy` – zeigt deine Einstellungen
- `$privacy stadt an|aus` – Stadt verstecken
- `$privacy alter an|aus` – Alter verstecken
- `$privacy profil an|aus` – öffentliches Profil (erst ab 18)

Regeln: unter 13 keine Registrierung · unter 18 kein exaktes Alter · Stadt in
Gruppen maskiert · Minderjährige nie öffentlich.
Migration bestehender Profile: `node scripts/migrate-privacy.mjs`

### 11.11 Alltag & Web (neu)

Alle Befehle holen **echte Daten** aus freien APIs. Ist ein Dienst nicht
erreichbar, sagt der Bot das ehrlich – es werden keine Werte erfunden.

- `$wetter <stadt>` – aktuelles Wetter + Tageswerte (Open-Meteo)
- `$währung <betrag> <von> [nach]` – Währungen umrechnen (EZB-Referenzkurse, Frankfurter API); `$währung liste` zeigt alle
- `$übersetze <sprache> <text>` – Text übersetzen (MyMemory), z. B. `$übersetze en Guten Morgen`
- `$qr <text>` – QR-Code als Bild erzeugen (goqr.me)
- `$kurz <url>` – Link kürzen (TinyURL, Fallback is.gd)
- `$passwort [länge]` – sicheres Zufalls-Passwort (`crypto.randomBytes`, 8–64 Zeichen)

---

## 12. . Neue Features: AFK, Auto-Mod, Setup, Ban, System

Diese Module sind neu und speichern **alles** in `Database/Database.json` (zusätzliche
Sektionen `afk`, `bans`, `meta`) sowie die Gruppen-Daten zusätzlich in
`Database/LoveGroups/<groupId>/<groupId>.json`.

### 12.0.1 AFK-System (mit Auto-Comeback)
- `$afk <grund>` — meldet dich ab, z. B. `$afk (weil ich es kann)`.
- `$afk off` — beendet den AFK-Status manuell.
- Wird ein AFK-User **erwähnt (@)** oder **beantwortet** jemand eine seiner
  Nachrichten, antwortet der Bot mit einem Hinweis: *"Diese Person ist seit
  (Zeit) AFK, Grund …, und kann gerade nicht reden."*
- Sobald der AFK-User **irgendetwas** macht (schreibt, antwortet, reagiert mit
  einem Emoji), kommt automatisch: *"Du bist nach (Dauer) wegen (Grund) AFK —
  willkommen zurück!"*.

### 12.0.2 Auto-Mod (Welcome / Goodbye / Kick / Promote / Demote)
Automatische Nachrichten in der Gruppe, einzeln an-/ausschaltbar:
- **Betritt jemand die Gruppe** → freundliche Willkommensnachricht, die den Bot erklärt.
- **Verlässt jemand die Gruppe** → *"@person hat @gruppe verlassen, vielleicht sehen wir uns bald wieder :("*.
- **Wird jemand gekickt** → *"@person wurde von @user aus @gruppe gekickt, halte dich beim nächsten Mal an die Regeln"*.
- **Wird jemand zum Admin** → *"@user wurde von @admin zum Admin gemacht, du hast jetzt das Vertrauen der Admins — zerstöre es nicht"*.
- **Wird jemand als Admin entfernt** → *"@user wurde von @admin als Admin entfernt, … du hast versagt"*.

Einstellungen (nur Admin/Superadmin/Owner) in der Gruppe:
- `$welcome on|off`
- `$goodbye on|off`
- `$kick on|off`
- `$promote on|off`
- `$demote on|off`

### 12.0.3 System-Befehl
- `$system` bzw. `$stats` — zeigt **Uptime**, **Nutzer gesamt**, **Gruppen gesamt**,
  registrierte/verifizierte Nutzer, aktive/inaktive Gruppen, aktuell AFK, Bans und RAM.

### 12.0.4 Setup (nur Owner)
- `$setup` — aktiviert den Bot für die Gruppe **und** setzt die Gruppen-Beschreibung
  auf: *"LoveBot ist in <Gruppe> aktiv — nutze $dsgvo / $verify …"* inklusive
  *"Setup gesetzt am (Zeitpunkt) von <Owner>"*.
- Wird kein `$setup` durchgeführt, bleibt der Bot in der Gruppe inaktiv, bis der Owner es tut.

### 12.0.5 Ban / Unban / Banlist (nur Owner)
- `$ban <id|@user|nummer> <grund>` — blockiert die Person, benachrichtigt sie
  (*"du wurdest von @user gebannt (grund) …"*), und entfernt sie aus **allen**
  Gruppen, in denen der Bot ist.
- `$unban <id|@user|nummer> <grund>` — entblockiert und benachrichtigt
  (*"du wurdest entbannt … sorry für das Missverständnis …"*).
- `$banlist` — listet alle gebannten Nutzer mit Grund und Zeitpunkt.
- Schreibt eine gebannte Person in einer Gruppe, wird ihre Nachricht **als Admin
  gelöscht**, eine Abschiedsnachricht inkl. Grund gesendet und sie wird gekickt.

---

## 12.1 Session-Ordner und Credentials

Der Bot legt seine Authentifizierungsdaten in einem lokalen Session-Ordner ab. Das ist für die dauerhafte Verbindung wichtig. Wenn du den Zustand zwischenzeitig resetten willst, kannst du über das Menükonzept oder über den `Sessions`-Ordner löschen.

### 12.2 Automatische Konfigurationsschritte

Nach erfolgreichem Verbinden wird der Bot versucht, automatisch Name, Bio und Profilbild zu setzen. Das kann je nach WhatsApp-API/Funktionen funktionieren oder fehlschlagen. Das ist Teil der normalen Laufzeit und kein Garant, dass alles immer klappt.

### 12.3 Eine Verbindung ist keine „sichere Permission“

Der Bot nutzt dein WhatsApp-Benutzerkonto, um Nachrichten zu senden, zu reagieren und in Chats zu arbeiten. Du musst selbst sicherstellen, dass:

- du dein Konto kontrollierst
- du keine vertraulichen Daten unachtsam weitergibst
- du keine externen Chatinhalte unbedacht verarbeitest
- du auf Schadcode oder fremde Änderungen achtest

---

## 13. Rechtliche und sicherheitsrelevante Hinweise

### 13.1 Du allein bist verantwortlich

Sobald du das Projekt herunterlädst und ausführst, übernimmt die Person, die den Code nutzt, die Verantwortung für:

- alle Daten, die der Bot verarbeitet
- alle Account-Aktivitäten
- die lokale Sicherheit
- den Schutz von Nutzerdaten
- die Einhaltung lokaler Gesetze und Vorschriften
- das Verhalten des Bots in Gruppen, Chats und Netzwerken

Der Entwickler/Betreiber und alle Mitwirkenden übernehmen keine Verantwortung für Schäden oder Folgen der Nutzung.

### 13.2 Datenschutz

Mit dem Bot können personenbezogene Daten verarbeitet werden, z. B.:

- Chat-Nachrichten
- Profilinformationen
- JIDs und LIDs
- Benutzer-Profile
- Gruppendaten
- Uhrzeiten, Registrierungen und Status-Informationen

Wenn du dieses Projekt öffentlich oder in einer Umgebung mit mehreren Personen nutzt, musst du sicherstellen, dass der Einsatz rechtlich zulässig ist. Das gilt besonders bei:

- WhatsApp-Chatinhalten
- personalisierten Daten
- Gruppenmitgliedern
- Tracking oder Profilierung

### 13.3 Konformität mit Datenschutzgesetzen

Du bist selbst dafür verantwortlich, dass die Verarbeitung personenbezogener Daten den geltenden Datenschutzvorschriften entspricht. Dazu gehören unter anderem:

- DSGVO / Datenschutz-Grundverordnung (wenn zutreffend)
- lokale Vorschriften
- Zustimmung der Beteiligten wo erforderlich
- angemessene Aufbewahrung
- sichere Speicherung
- Zugriffskontrolle

### 13.4 Keine Garantie

Das Projekt wird ohne Gewährleistung bereitgestellt. Eine Haftung für direkte, indirekte, zufällige oder folgenschädliche Schäden wird ausdrücklich ausgeschlossen.

---

## 14. Lokale Daten und Speicherung

### 14.1 Was lokal gespeichert wird

Im Projekt können je nach Nutzung und Funktionen folgende Daten lokal gespeichert werden:

- Session-Dateien
- Auth-Credentials
- Benutzerprofile
- Gruppendaten
- Registrierungs- und Statusinformationen
- Bilder oder Medien
- Logs / Konsolenausgaben

### 14.2 Warum das wichtig ist

Dein Rechner ist die Quelle der Wahrheit. Sobald eine Session oder ein Profil lokal gespeichert wird, sind diese Daten unter deiner Kontrolle. Wenn du den Server oder Bot in einem unsicheren Umfeld laufen lässt, riskierst du Zugriff, Datenverlust oder Missbrauch.

### 14.3 Empfohlene Vorsichtsmaßnahmen

- Nutze starke Passwörter auf deinem System
- Schütze den Rechner mit einem aktiven Antivirenprogramm
- Halte Node.js und Abhängigkeiten aktuell
- Speichere vertrauliche Daten nicht ungeschützt
- Lade nur vertrauliche Dateien von Originalquellen herunter
- Analysiere Änderungen im Code, bevor du sie ausführst

---

## 15. Fehlerbehebung

### 15.1 Node.js-Version zu alt

Fehler: `node` Version zu niedrig.

Lösung:

- Installiere Node.js 24+.
- Prüfe mit:

```bash
node -v
```

### 15.2 `npm install` funktioniert nicht

Mögliche Ursachen:

- kein Internet
- Proxy-/Firewall-Einstellungen
- fehlende Berechtigungen
- beschädigte Node-Installation

Lösung:

- Internet prüfen
- Terminal als Administrator/mit passenden Rechten öffnen
- Neu starten und erneut installieren

### 15.3 Pairing oder QR fehl schlägt

Mögliche Ursachen:

- falsche Nummer
- Verbindung fehlgeschlagen
- WhatsApp-Server-Probleme
- Session beschädigt

Lösung:

- neu starten
- Session löschen
- erneut mit `p` oder `q` pairen

### 15.4 Bot startet, aber Verbindung bricht

Der Code behandelt Verbindungsfehler und versucht bei Bedarf einen automatischen Neustart. Wenn ein Fehler wiederholt auftritt, kann der Bot beendet werden.

Wenn das der Fall ist:

- prüfe die internet-Verbindung
- prüfe den WhatsApp-Status
- lösche die Session, falls nötig
- starte neu

---

## 16. Wichtiger Hinweis zum verantwortungsvollen Einsatz

Dieser Bot ist ein Werkzeug. Die Verantwortung für seinen Einsatz liegt ausschließlich beim Benutzer.

Das bedeutet konkret:

- Du entscheidest, ob und wie du ihn ausführst.
- Du prüfst die Nutzung auf rechtliche/ethische Zulässigkeit.
- Du trägst das Risiko von Fehlfunktionen, Datenverlusten und Sicherheitsproblemen.
- Du bist allein verantwortlich für die Folgen der Nutzung.
- Der Entwickler, der Autor und die Person, die das Projekt bereitstellt, übernehmen keine Haftung.

Wenn du ein Projekt dieser Art nutzt, musst du selbst verstehen, dass es sich um einen lokalen technischen Agenten handelt, der mit tatsächlichen Kommunikations-, Profil- und Credentials-Daten arbeitet.

---

## 17. Schnellstart: Download → Installation → Login → Nutzung

Wenn du den schnellsten Weg nutzen willst, dann geht es so:

1. Projekt herunterladen
2. Ordner entpacken
3. In den Ordner gehen
4. `npm install` ausführen
5. `npm start` starten
6. Im Menu `p` oder `q` wählen
7. WhatsApp mit QR-Code oder Pairing-Code verbinden
8. Sobald der Bot online ist, `$register` benutzen
9. `$me` prüfen
10. `$help` oder `$menu` nutzen
11. Befehl flexibel anwenden

---

## 18. Beispiel-Workflow

```text
1. Download / entpacken
2. cd LoveBot
3. npm install
4. npm start
5. Auswahl: p
6. Telefonnummer eingeben
7. Pairing-Code im WhatsApp-Client eingeben
8. Verbindung erfolgreich
9. $register Maxichen.16.Single.Recklinghausen
10. $me
11. $help
```

Das ist der Standard-Ablauf aus dem aktuellen Projekt.

---

## 19. Verweis auf detaillierte Dokumente

Für weiterführende Informationen gibt es in diesem Projekt zusätzlich Dokumente im Ordner `Dokumente`:

- `Dokumente/datenschutz.md`
- `Dokumente/datenverarbeitung.md`
- `handbuch.md`

Diese Dateien ergänzen diese README und erklären die datenschutzrechtlichen und betrieblichen Aspekte ausführlicher.

---

## 20. Abschluss

Dieser Bot kann ein mächtiges Werkzeug sein, aber er ist kein „fertiges, massenvertriebliches Produkt mit automatischer Sicherheit“. Du betreibst ihn lokal, du entscheidest, wie er läuft, und du trägst die Verantwortung für die Konsequenzen.

Wenn du zu 100 % verstehen willst, wie alles funktioniert, nutze diese README zusammen mit dem ausführlichen Handbuch und den Datenschutz- und Datenverarbeitungsdokumenten.

> Verantwortungshinweis: Die Nutzung dieses Projekts erfolgt auf eigene Verantwortung. Der Entwickler oder die bereitstellende Person übernimmt keine Haftung und keine Verantwortung für Folgen, Fehler, Datenverluste, Missbrauch oder Rechtsprobleme.

Wenn du möchtest, kann ich dir als Nächstes noch eine zweite, noch ausführlichere Version mit noch mehr Beispielen, Screenshots-Texten und einem noch umfangreicheren Befehls-Katalog erstellen.

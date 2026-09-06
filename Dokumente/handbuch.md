# LoveBot – detailliertes Betriebs- und Nutzungshandbuch

## 1. Einleitung

Dieses Handbuch beschreibt das Projekt vollständig und Schritt für Schritt. Es ist bewusst viel ausführlicher als eine normale README, damit es als echtes Betriebs- und Anwenderhandbuch dient.

Das Projekt ist ein WhatsApp-Bot, der mit Baileys und Node.js läuft. Es verbindet sich über einen WhatsApp-Account und verarbeitet danach Befehle, Interaktionen, Gruppenlogik, Profilinformationen, Session-Daten und verschiedene lokale Prozesse.

Dieses Handbuch erklärt:

- Download und Vorbereitung
- Installation von Node.js und Abhängigkeiten
- Starten des Bots
- Auswahl zwischen QR-Code und Pairing-Code
- Session-Lebenszyklus
- Daten, Rechte und Verantwortlichkeit
- Registrierungsprozess mit `$register`
- Nutzung von `$me` und Hilfemenüs
- Alle relevanten Befehle und ihre Praxis
- Sicherheit, Datenschutz und Fehlerbehebung
- Vorgaben zur verantwortungsbewussten Nutzung

> Wichtig: Die Verantwortung für die Nutzung liegt beim Nutzer. Niemand ist für Schäden, Datenverlust, technische Fehler, Sicherheitsprobleme oder rechtliche Folgen haftbar.

---

## 2. Überblick über das Projekt

LoveBot ist ein lokaler Bot, kein cloudbasierter Service. Das bedeutet, dass er auf deinem eigenen Rechner läuft und deine WhatsApp-Session lokal verwaltet.

Das Projekt enthält unter anderem:

- Startscripte und Projektkonfiguration
- WhatsApp-Verbindung mit Baileys
- Session-Handling
- Authentifizierungsdaten
- Befehlslogik für Gruppen und Chats
- Profil-/Registrierungslogik
- Hilfe- und Statusbefehle
- Medien- und AI-Funktionen
- lokale Datenhaltung im Projektordner

### Ziel des Projekts

Das System kann helfen, beispielsweise:

- Profile zu registrieren
- WhatsApp-Kommandos zu verarbeiten
- Informationen anzeigen
- Gruppenprozesse automatisieren
- Socials-/Owner-/Love-Infos anzeigen
- Finite oder interne Logiken im Bot-Kontext ausführen

Das Projekt ist jedoch kein fertiges, kontrolliertes Produkt mit Garantie oder Wartung. Es ist ein lokaler, technischer Workflow, der von dir selbst betrieben wird.

---

## 3. Voraussetzungen

### 3.1 Technische Voraussetzungen

- Node.js 24 oder höher
- npm
- Ein Terminal (PowerShell, CMD, Git Bash oder VS-Code-Terminal)
- Internetzugang
- WhatsApp auf dem Smartphone
- Rechner mit ausreichend freiem Speicherplatz

### 3.2 Zugangsvoraussetzungen

Du musst wirklich Zugriff auf den WhatsApp-Account haben, den du verwenden willst. Der Bot nutzt realen Authentifizierungs- und Kommunikationsmechanismus.

### 3.3 Voraussetzungen für sichere Nutzung

- Nutze den Bot nur auf einem Rechner, über den du die Kontrolle hast.
- Halte das Betriebssystem sauber und geschützt.
- Nutze niemals fremde Session-Dateien.
- Nur eigene, legitime Nutzung.
- Keine unkontrollierten oder öffentlichen Betriebssystem-Umgebungen.

---

## 4. Projektordner und Struktur

Nach dem Download sieht das Projekt typischerweise so aus:

```text
LoveBot/
├── Love.js
├── waApi.js
├── nodeApi.js
├── colorApi.js
├── package.json
├── README.md
├── handbuch.md
├── Bilder/
├── Database/
├── Sessions/
├── Dokumente/
└── node_modules/
```

### Bedeutung der wichtigsten Teile

#### `Love.js`
Das Hauptprogramm. Von dort startet der Bot und verarbeitet die Logik.

#### `waApi.js`
Hier liegen die WhatsApp-API- und Verbindungslayer. Pairing, QR, Session-Handling und Socket-Logik sind hier relevant.

#### `Database/`
Dort werden lokale Profil- und Statusdaten gespeichert.

#### `Sessions/`
Hier liegen die Auth- und Verbindungsdaten.

#### `Bilder/`
Grafiken, Profilbilder, Menügrafiken usw.

#### `Dokumente/`
Zusatzdokumentation wie Datenschutz, Verarbeitung, Installation, FAQ.

---

## 5. Download und Einrichtung

### 5.1 ZIP-Datei herunterladen

1. Lade das Projekt als ZIP-Datei herunter.
2. Entpacke es an einen gewünschten Ort, z. B.:

```text
C:\Users\DeinName\Desktop\LoveBot
```

### 5.2 Git-Clone

```bash
git clone <repository-url>
cd LoveBot
```

### 5.3 Verzeichnis bestätigen

Prüfe mit:

```bash
ls
```

Oder in Windows PowerShell:

```powershell
Get-ChildItem
```

Du solltest Dateien wie `Love.js`, `package.json` und `waApi.js` sehen.

---

## 6. Abhängigkeiten installieren

Im Projektordner:

```bash
npm install
```

Danach sollten `node_modules` und ggf. `package-lock.json` erscheinen.

### 6.1 Node-Version prüfen

```bash
node -v
```

Wenn die Version unter 24 liegt, installiere eine passende Node-Version.

### 6.2 Häufige Installationsfehler

- keine Internetverbindung
- Proxyblockade
- fehlende Systemrechte
- veraltete Node-Version
- beschädigtes Paketverzeichnis

### 6.3 Beispiel zur Neuinstallation

```bash
rm -rf node_modules package-lock.json
npm install
```

Windows:

```powershell
Remove-Item -Recurse -Force node_modules, package-lock.json
npm install
```

---

## 7. Starten des Bots

### 7.1 Startkommando

```bash
npm start
```

### 7.2 Watch-Modus

```bash
npm run watch
```

Wenn alles korrekt ist, startet der Bot und zeigt je nach Zustand einen Login- oder Session-Dialog an.

### 7.3 Beispiel für die Konsolenausgabe

```text
LOVE BOT — PAIRING MENÜ
[p] – Pairing via Telefonnummer & Code initialisieren.
[q] – QR-Code im Terminal für den Login generieren.
[x] – Skript beenden.
```

---

## 8. Login-Prozess im Detail

### 8.1 Wenn keine Session existiert

Falls kein gültiger Session-State gefunden wird, wirst du gefragt, ob du mit:

- Nummer + Pairing-Code
- QR-Code
- Exit

weiterarbeiten willst.

### 8.2 Pairing-Option mit Nummer

Wenn du `p` auswählst, wirst du nach einer Nummer gefragt.

Beispiel:

```text
491701234567
```

Der Bot entfernt dabei alles außer Ziffern und nutzt dies für den Pairing-Request.

### 8.3 Pairing-Code in WhatsApp nutzen

Danach zeigt der Bot den Pairing-Code im Terminal an.

Beispiel:

```text
🔑 DEIN PAIRING-CODE: ABCD-EFGH-IJKL-MNOP
```

Auf deinem Smartphone:

1. WhatsApp öffnen
2. „Verknüpfte Geräte“ wählen
3. „Mit Telefonnummer verknüpfen“ auswählen
4. Code eingeben
5. Verbindung bestätigen

### 8.4 QR-Code-Option

Wenn du `q` auswählst, wird ein QR-Code im Terminal generiert. Du kannst ihn dann mit der Kamera im WhatsApp-Client scannen.

Praktischer Ablauf:

1. WhatsApp öffnen
2. „Verknüpfte Geräte“
3. „Gerät koppeln“
4. QR-Code scannen

### 8.5 Wiederverbinden mit vorhandener Session

Wenn bereits ein gültiger Session-Ordner vorliegt, zeigt der Bot ein Menü mit:

- `r` = reconnect
- `d` = delete session
- `x` = exit

Das ist nützlich, wenn der Bot nach einem Neustart den alten Verbindungsstatus wieder herstellen kann.

### 8.6 Session löschen

Wenn du `d` wählst, wird die lokal gespeicherte Authentifizierung gelöscht.

Das ist sinnvoll bei:

- fehlerhafter Session
- Verbindungsproblemen
- Wechseln des Accounts
- wiederholten Pairing-Fehlern

> Nach dem Löschen musst du den Bot erneut verknüpfen.

---

## 9. Wie der Bot nach dem Login aussieht

Wenn die Verbindung erfolgreich ist, erscheint eine Online-Bestätigung.

Beispiel:

```text
💜 LOVE BOT — ONLINE 💜
✅ WhatsApp verbunden
🤖 Präfix: $
🆔 Host JID: ...
🔗 Host LID: ...
📟 Host SID: ...
```

Danach versucht der Bot automatisch:

- Name zu setzen
- Status/Bio zu setzen
- Profilbild zu aktivieren
- Newsletter-/Channel-Links zu folgen
- Gruppenaktionen zu starten, falls verfügbar

Das ist ein automatischer Initialisierungsschritt und kein Garant für den Erfolg aller einzelnen Aktionen.

---

## 10. Registrierung mit `$register`

### 10.1 Syntax

```text
$register Name.Alter.Status.Stadt
```

### 10.2 Beispiel

```text
$register Maxichen.16.Single.Recklinghausen
```

### 10.3 Aufteilung genauer erklärt

- Name: Maxichen
- Alter: 16
- Status: Single
- Stadt: Recklinghausen

### 10.4 Was passiert intern?

Der Bot parst den String, ersetzt Leerzeichen sowie unangemessene Punkte, prüft die Felder und speichert dann die Daten im Profil des Nutzers.

### 10.5 Erfolgsantwort

```text
> LOVE BOT — REGISTRIERUNG ERFOLGREICH ✅

• Name: Maxichen
• Alter: 16
• Status: Single
• Stadt: Recklinghausen
• Registriert seit: 01.09.2026, 12:34:56
```

### 10.6 Fehlermeldung bei falscher Eingabe

Wenn der Nutzer nur `$register` eingibt oder das Format nicht korrekt ist, bekommt er eine Hilfemeldung.

Beispiel:

```text
> LOVE BOT — REGISTRIERUNG 📝

*Beispiel:*
$register Maxichen.16.Single.Recklinghausen

*Format:*
$register Name.Alter.Status.Stadt
```

### 10.7 Wann ist Registration wichtig?

Ohne Registrierung kann `$me` nicht richtig funktionieren. Manche Funktionen und Statusdaten bauen auf dem registrierten Profil auf.

---

## 11. `$me` vollständig erklärt

### 11.1 Befehl

```text
$me
```

### 11.2 Wenn Nutzer nicht registriert ist

```text
Du bist noch nicht registriert.
Nutze: $register für Hilfe
```

### 11.3 Wenn Nutzer registriert ist

Der Bot zeigt verschiedene Infos an, z. B.:

- Name
- Alter
- Status
- Stadt
- JID
- LID
- BID
- DSGVO-Status
- Verify-Status
- Guthaben
- Level / Prestige / XP
- username
- Gruppenrolle, falls in einer Gruppe

### 11.4 Beispielausgabe

```text
> LOVE BOT — REGISTRIERTE PERSON ✨

Hallo @maxichen!

• Name: Maxichen
• Alter: 16
• Status: Single
• Stadt: Recklinghausen
• Registriert seit: 01.09.2026, 12:34:56
• Username: @maxichen
• JID: 4915155894714@s.whatsapp.net
• LID: 269574108926096@lid
• BID: 4915155894714jid269574108926096lid
• DSGVO: Akzeptiert ✅
• Verify: Verifiziert ✅
• Guthaben: 🤎 0 | 🩶 0 | 💛 0 | 🩵 0
• Fortschritt: Level 0 | Prestige 0 (XP: 0/743)
```

### 11.5 Warum wichtig?

Das macht den Nutzer identifizierbar und gibt einen schnellen Überblick über seinen Zustand, seine Mitgliedschaft und seine gespeicherten Daten.

---

## 12. Befehlsübersicht

### 12.1 Allgemein

- `$ping` — Latenztest
- `$me` — Nutzerprofil
- `$register` — Registrierung
- `$username` — Username-Info
- `$sys` — Systemdaten
- `$hash <text>` — Hash berechnen
- `$url <link>` — Link analysieren
- `$i2` / `$fetch` — zitierte Nachricht lesen
- `$i3` — Debug-Info
- `$owner` — Owner-Daten
- `$love` / `$socials` — Love-/Socials-Links
- `$gits` — GitHub-Links

### 12.2 Profil & Info

- `$bio` / `$status`
- `$devices`
- `$check <id>`
- `$check2 <nummer>`

### 12.3 Gruppen

- `$tagall` / `$all`
- `$groups`
- `$kickall`
- `$activate`
- `$deactivate`
- `$addmeta`
- `$kickmeta`

### 12.4 Verifikation / DSGVO / Admin

- `$verify accept` / `$verify reject`
- `$dsgvo accept` / `$dsgvo reject`
- `$fp`

### 12.5 Media / AI

- `$play <link/song>`
- `$audio <modul>`
- `$loadingaiimg`
- `$loadingaivid`

### 12.6 Hilfe

- `$menu`
- `$help`

---

## 13. Häufige reale Nutzungsszenarien

### Szenario 1: Neuer Nutzer startet den Bot

```text
npm install
npm start
p
491701234567
$register Maxichen.16.Single.Recklinghausen
$me
$help
```

### Szenario 2: Nutzer braucht Hilfe

```text
$help
```

### Szenario 3: Nutzer prüft seine Verbindung

```text
$ping
```

### Szenario 4: Nutzer zeigt Profil an

```text
$me
```

### Szenario 5: Nutzer lässt Gruppe taggen

```text
$tagall Hallo zusammen!
```

---

## 14. Daten und Session-Handling

### 14.1 Session-Daten

Diese Daten sind für den Login relevant. Sie können lokal gespeichert werden, etwa als Auth-Credentials.

### 14.2 Benutzerprofile

Der Bot speichert Nutzerprofile und Registrierungsdaten lokal. Dazu gehören Name, Alter, Status, Stadt, Zeitstempel und Identitätsdaten.

### 14.3 Gruppenlogik

Wenn der Bot in Gruppen aktiv ist, werden Gruppendaten, Rollen und Mitglieder übertragen bzw. verarbeitet.

### 14.4 Medien und Links

Bei Link-, Hash-, Audio- und AI-Funktionen können externe Inhalte verarbeitet werden. Das unterliegt deiner Verantwortung.

---

## 15. Sicherheitsrichtlinien

### 15.1 Grundsatz

Der Bots spielt mit echten Kommunikationsdaten. Deshalb ist Sicherheit wichtig.

### 15.2 Gute Praxis

- nutze einen privaten Rechner
- schütze den Session-Ordner
- nutze starke Passwörter
- lösche Session nach Bedarf bewusst
- verarbeite nur zulässige Inhalte
- verteilte keine fremden Daten

### 15.3 Böse Praxis

- Session-Dateien in öffentlichen Ordnern ablegen
- Zugang für Dritte ermöglichen
- Bots in unsicheren oder fremden Umgebungen betreiben
- private Daten unbeaufsichtigt verarbeiten

---

## 16. Datenschutz und Verantwortung

### 16.1 Welche Daten können verarbeitet werden?

- Chatinhalte
- JID/LID
- Profile
- Statusdaten
- Gruppeninformationen
- Medien- und Linkdaten
- Authentifizierungsdaten

### 16.2 Wer trägt die Verantwortung?

Der Nutzer, der den Bot ausführt.

### 16.3 Was bedeutet das konkret?

Du allein entscheidest:

- ob der Bot überhaupt läuft
- was verarbeitet wird
- welchen Account du nutzt
- wie du die Session schützt
- ob die Nutzung des Bots legal und vertretbar ist

---

## 17. Haftung und Gewährleistung

> Die Nutzung dieses Projekts erfolgt auf eigene Verantwortung. Der Entwickler und die bereitstellende Person übernehmen keine Haftung.

Es gilt ausdrücklich:

- keine Gewährleistung
- keine Verantwortung für Datenverluste
- keine Haftung für Missbrauch
- keine Verantwortung für technische Fehler
- keine Gewährleistung für Rechtmäßigkeit der Nutzung

---

## 18. Fehlerbehebung – konkrete Fälle

### Fall 1: Node-Version nicht passend

```bash
node -v
```

Lösung: Node 24+ installieren.

### Fall 2: `npm install` schlägt fehl

Prüfen:

- Internetverbindung
- Proxy/Firewall
- Terminal-Rechte
- Node-Version

### Fall 3: Pairing-Code funktioniert nicht

- Nummer prüfen
- Session löschen
- erneut starten
- QR-Code alternativ ausprobieren

### Fall 4: Bot startet nicht

- `node_modules` prüfen
- Projektordner korrekt
- Session prüfen
- Logs lesen

### Fall 5: Verbindungsabbruch loop

- Verbindung prüfen
- Session aufräumen
- Bot neu starten
- erneut pairen

---

## 19. Benutzerleitfaden in 10 einfachen Schritten

1. Code herunterladen
2. Ordner entpacken
3. `npm install` ausführen
4. `npm start` starten
5. `p` oder `q` auswählen
6. WhatsApp pairen
7. `$register` benutzen
8. `$me` testen
9. `$help` aufrufen
10. verantwortungsvoll und kontrolliert weiterarbeiten

---

## 20. Abschluss

Dieses Handbuch ist bewusst ausführlich, damit du das Projekt gründlich verstehen kannst. Der zentrale Gedanke ist klar:

> Du betreibst den Bot auf deinem eigenen Rechner und trägst dafür allein die Verantwortung.

Wenn du alles korrekt durchgehst – Download, Setup, Pairing, Login, Registrierung und tägliche Verwendung – kannst du den Bot sicher und verständlich betreiben.

Für die weitere Nutzung solltest du auch die zusätzlichen Dokumente im Ordner `Dokumente` lesen, insbesondere:

- [Dokumente/installation.md](Dokumente/installation.md)
- [Dokumente/befehlsreferenz.md](Dokumente/befehlsreferenz.md)
- [Dokumente/faq.md](Dokumente/faq.md)
- [Dokumente/sicherheit-und-haftung.md](Dokumente/sicherheit-und-haftung.md)

Das Projekt ist ein lokales Werkzeug mit echten Daten und realen Verbindungen. Genau deshalb steht Verantwortung immer an erster Stelle.

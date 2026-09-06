# Installation und Einrichtung von LoveBot

## 1. Ziel dieses Dokuments

Dieses Dokument erklärt die Installation des Projekts von Anfang bis Ende. Es ist bewusst sehr ausführlich und soll auch Menschen helfen, die das Projekt zum ersten Mal auf einem Windows-Rechner oder in einer lokalen Umgebung installieren.

---

## 2. Voraussetzungen

Bevor du startest, stelle sicher, dass du folgendes hast:

- Node.js 24 oder höher
- npm
- Internetzugang
- Zugriff auf dein WhatsApp-Konto
- PowerShell, CMD oder VS-Code-Terminal
- Ein lokaler Ordner auf deinem Rechner

### Prüfen der Node-Version

```bash
node -v
```

Wenn die Ausgabe kleiner als 24 ist, installiere eine aktuelle Version.

---

## 3. Projekt herunterladen

### Variante A: ZIP

1. Datei herunterladen
2. Entpacken
3. In einen bekannten Ordner verschieben

Beispiel:

```text
C:\Users\DeinName\Desktop\LoveBot
```

### Variante B: Git Clone

```bash
git clone <repository-url>
cd LoveBot
```

Wenn du kein Repository-URL hast, verwende den Quellordner, den du erhalten hast.

---

## 4. In den Ordner gehen

```bash
cd C:\Users\DeinName\Desktop\LoveBot
```

Wenn du im VS-Code-Terminal bist, stelle sicher, dass der Terminalpfad zum Projektordner zeigt.

---

## 5. Abhängigkeiten installieren

```bash
npm install
```

Das installiert die Pakete aus `package.json`.

### Wichtige Hinweise

- Wenn du eine ältere Node-Version hast, kann `npm install` fehlschlagen.
- Wenn du Firewall oder Proxy hast, kann das die Installation stören.
- Wenn du bereits `node_modules` hast, kann ein erneuter Installationslauf helfen.

### Neuinstallation bei Problemen

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

## 6. Projekt starten

```bash
npm start
```

Alternativ:

```bash
npm run watch
```

---

## 7. Erstes Login-Verhalten

Wenn der Bot startet und keine gültige Session existiert, erscheint ein Auswahlmenü.

Beispiel:

```text
[p] → Pairing via Telefonnummer & Code initialisieren.
[q] → QR-Code im Terminal für den Login generieren.
[x] → Skript beenden.
```

### Pairing via Nummer

Du gibst z. B. ein:

```text
491701234567
```

Dann wartet der Bot auf die Verknüpfung mit deinem WhatsApp-Konto.

### Login via QR

Wenn du `q` wählst, erscheint ein QR-Code im Terminal. Scanne ihn mit dem WhatsApp-Client auf dem Smartphone.

---

## 8. Was nach dem Login passiert

Nach dem erfolgreichen Verknüpfen erscheint eine Online-Meldung. Danach versucht der Bot automatisch, Dinge wie Namen, Status und Profilbild zu setzen.

Das ist eine automatische Initialisierung.

---

## 9. Session-Dateien verstehen

Der Bot nutzt lokale Session-Dateien, um sich automatisch zu merken, dass eine Verbindung mit einem WhatsApp-Account bereits besteht.

Das ist nützlich, aber auch kritisch.

### Sicherheitsregel

Diese Session-Dateien solltest du nie öffentlich teilen.

---

## 10. Was passiert bei Session-Fehlern?

Wenn die Session beschädigt ist oder die Verbindung verloren geht, kannst du die Session löschen und neu beginne.

### In dem Menü

- `r` = reconnect
- `d` = delete session
- `x` = exit

### Wichtig

Beim Löschen der Session werden die Auth-Daten lokal entfernt. Danach musst du erneut verknüpfen.

---

## 11. Erste Nutzung nach dem Login

Sobald der Bot online ist, kannst du Befehle wie diese testen:

```text
$help
$me
$register Maxichen.16.Single.Recklinghausen
$ping
```

---

## 12. Abschluss

Die Installation ist im Grunde ein einfacher Ablauf:

1. Download
2. Entpacken
3. `npm install`
4. `npm start`
5. Pairing oder QR ausführen
6. WhatsApp verknüpfen
7. Bot testen

> Du bist verantwortlich für die Nutzung, die Session, die Sicherheit und die Folgen. Die Nutzung erfolgt auf eigene Verantwortung.

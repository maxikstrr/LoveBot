# Befehlsreferenz LoveBot

## 1. Einführung

Dieses Dokument ist der praktische Befehlskatalog für den Bot. Es listet die wichtigsten Befehle, erklärt ihre Funktion und zeigt typische Beispiele.

---

## 2. Allgemeine Befehle

### `$help` / `$menu`

Zeigt Hilfe und Befehlsübersicht an.

Beispiel:

```text
$help
```

### `$ping`

Prüft die Verfügbarkeit bzw. Antwortzeit des Bots.

Beispiel:

```text
$ping
```

### `$owner`

Zeigt Kontaktdaten oder Informationen zum Besitzer/Owner an.

Beispiel:

```text
$owner
```

### `$love` / `$socials`

Zeigt Social-Links oder Love-Links an.

Beispiel:

```text
$love
```

### `$gits`

Zeigt GitHub- oder projektbezogene Links an.

---

## 3. Profil und Registrierung

### `$register <Name.Alter.Status.Stadt>`

Registriert den Nutzer mit seinen Daten.

Beispiel:

```text
$register Maxichen.16.Single.Recklinghausen
```

### `$me`

Zeigt die persönlichen Daten des Nutzers an.

Beispiel:

```text
$me
```

### `$bio` / `$status`

Zeigt Bio-/Statusdaten an, falls verfügbar.

---

## 4. Info- und Systembefehle

### `$username`

Zeigt Username-/Benutzerinformationen an.

### `$sys`

Zeigt System-, Laufzeit- und Speicherinformationen an.

### `$hash <text>`

Berechnet Hashes für den übergebenen Text.

Beispiel:

```text
$hash hello
```

### `$url <link>`

Analysiert einen Link.

Beispiel:

```text
$url https://maxichen.de
```

### `$devices`

Zeigt Geräteinformationen oder Geräte-Status an.

### `$check <id>`

Prüft eine ID, JID, LID oder ähnliche Kennung.

### `$check2 <nummer>`

Prüft entsprechende Status-/Nummerdaten.

---

## 5. Gruppenbefehle

### `$tagall` / `$all`

Erwähnt alle Gruppenmitglieder.

Beispiel:

```text
$tagall Hallo zusammen!
```

### `$groups`

Zeigt alle Gruppen des Bots.

### `$kickall`

Entfernt alle Mitglieder außer bestimmten Rollen/Owner/Admins.

### `$activate`

Aktiviert einen Bot-Kontext oder Zustand.

### `$deactivate`

Deaktiviert denselben Zustand.

### `$addmeta`

Fügt Meta AI hinzu.

### `$kickmeta`

Entfernt Meta AI.

---

## 6. Verifikation und DSGVO

### `$verify accept`

Akzeptiert eine Verifikation.

### `$verify reject`

Lehnt eine Verifikation ab.

### `$dsgvo accept`

Akzeptiert DSGVO-Status.

### `$dsgvo reject`

Lehnt DSGVO-Status ab.

### `$fp`

Sendet einen Dummy-/Fake-Payment-ähnlichen oder Test-Status.

---

## 7. Medien und AI

### `$play <link/song>`

Lädt oder verarbeitet Medieninformationen.

Beispiel:

```text
$play never gonna give you up
```

### `$audio <modul>`

Verarbeitet Audio mit dem angegebenen Modul.

Beispiel:

```text
$audio lauter
```

### `$loadingaiimg`

Startet einen AI-Bild-Workflow.

### `$loadingaivid`

Startet einen AI-Video-Workflow.

---

## 8. Praktische Beispiele

### Beispiel 1: Registrierung

```text
$register Maxichen.16.Single.Recklinghausen
```

### Beispiel 2: Profil anzeigen

```text
$me
```

### Beispiel 3: Hilfe anzeigen

```text
$help
```

### Beispiel 4: Latenz prüfen

```text
$ping
```

### Beispiel 5: Link analysieren

```text
$url https://maxichen.de
```

---

## 9. Wichtig zu wissen

- Einige Befehle benötigen ein zitiertes oder konkretes Format.
- Wenn du falschen Input gibst, erhältst du oft eine Hilfemeldung.
- $register verlangt ein bestimmtes Muster.
- $me funktioniert nur, wenn der Nutzer registriert ist.

---

## 10. Abschluss

Diese Befehlsreferenz deckt die wichtigsten Befehle ab. Für vollständige Erklärungen nutze zusätzlich die Hauptdokumente und das allgemeine Handbuch.

> Die Nutzung der Befehle liegt in der Verantwortung des Nutzers.

# FAQ – Häufig gestellte Fragen zu LoveBot

## 1. Was ist LoveBot?

LoveBot ist ein lokaler WhatsApp-Bot für Node.js. Er verbindet sich mit WhatsApp und kann Befehle verarbeiten, Benutzerprofile verwalten und verschiedene automatisierte Aufgaben ausführen.

---

## 2. Muss ich Node.js installieren?

Ja. Für dieses Projekt ist mindestens Node.js 24 erforderlich.

Prüfe mit:

```bash
node -v
```

---

## 3. Wie installiere ich das Projekt?

1. Projekt herunterladen
2. entpacken
3. in den Projektordner wechseln
4. `npm install` ausführen
5. `npm start` starten

---

## 4. Wie verbinde ich WhatsApp?

Du hast zwei Möglichkeiten:

- QR-Code scannen
- Pairing-Code mit Nummer verwenden

---

## 5. Was ist der Unterschied zwischen QR-Code und Pairing-Code?

### QR-Code

Ein Bild wird im Terminal angezeigt. Du scannst es mit WhatsApp auf dem Smartphone.

### Pairing-Code

Du gibst eine Nummer mit Ländervorwahl ein. Der Bot generiert danach einen Code, den du in WhatsApp manuell eingibst.

---

## 6. Wo werden meine Session-Daten gespeichert?

Normalerweise im lokalen Session-Ordner des Projekts, z. B. in `Sessions/`.

---

## 7. Wie lösche ich die Session?

Du kannst im Pairing-Menü `d` wählen oder den Session-Ordner manuell entfernen.

---

## 8. Wie registriere ich mich?

Beispiel:

```text
$register Maxichen.16.Single.Recklinghausen
```

---

## 9. Wie sehe ich meine eigenen Daten?

```text
$me
```

---

## 10. Was ist `$help`?

Es zeigt ein Hilfe-Menü mit den wichtigsten Befehlen und Beispielen an.

---

## 11. Warum funktioniert `$me` nicht?

Weil du noch nicht registriert bist. Nutze dann:

```text
$register Maxichen.16.Single.Recklinghausen
```

---

## 12. Was passiert, wenn `npm install` fehlschlägt?

Prüfe:

- Node-Version
- Internetzugang
- Firewall/Proxy
- Berechtigungen im Terminal

---

## 13. Kann ich den Bot neu starten?

Ja. Einfach erneut:

```bash
npm start
```

---

## 14. Kann ich die Session wiederherstellen?

Ja, falls die Session noch vorhanden ist. Wenn nicht, musst du erneut pairen oder QR scannen.

---

## 15. Ist der Bot legal?

Die technische Nutzung kann legal sein, aber du musst selbst prüfen, ob die Nutzung in deinem Kontext rechtlich und ethisch zulässig ist.

---

## 16. Wer trägt die Verantwortung?

Du allein. Der Nutzer trägt die Verantwortung für Nutzung, Daten, Sicherheit und Folgen.

---

## 17. Ist das Projekt kostenlos?

Das hängt von der Version bzw. Quelle ab. Der Code selbst kann kostenlos genutzt werden, aber die Nutzung ist trotzdem deine eigene Verantwortung.

---

## 18. Was ist der Unterschied zwischen `Sessions` und `Database`?

- `Sessions` = Authentifizierung und Verbindung
- `Database` = lokale Profil-/Status-/Dateninformationen

---

## 19. Kann ich das Projekt in Gruppen nutzen?

Ja, aber du musst die Nutzung kontrollieren und sicherstellen, dass sie zulässig ist.

---

## 20. Was ist der wichtigste Hinweis?

> Du übernimmst die Verantwortung. Der Entwickler oder die bereitstellende Person übernimmt keine Haftung.

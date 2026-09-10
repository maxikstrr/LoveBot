# 🔐 LoveBot – Datei-Schutz (beim Öffnen)

Es gibt **drei Schutz-Wege** — je nachdem, was du brauchst:

| Weg | Datei | Beim Öffnen | Braucht |
|-----|-------|-------------|---------|
| **C) Automatisch beim Download** *(empfohlen)* | jede Office-Datei, die du im LoveBot-Panel herunterlädst — auch jede Datei in der All-in-One-ZIP | Excel/Word/PowerPoint fragen **selbst nach dem Passwort** | nur einmal auf dem Server: `pip install msoffcrypto-tool pycryptodome` + `DATEI_LOGIN_PW` in der .env |
| **A) LoveBot-Firmen-Login** | `.xlsx`→`.xlsm`, `.docx`→`.docm` | Liebevolles Login-Fenster mit **Benutzername + Passwort** | Windows + Microsoft Office (beim Schützen) |
| **B) Passwort-Sperre** (Office-Verschlüsselung) | `.xlsx/.docx/.pptx` bleiben unverändert | Excel/Word/PowerPoint fragen **selbst nach dem Passwort** | nur Python (einmal), kein Office nötig |

> Weg C = **automatisch & überall** (kein Extra-Schritt nach dem Download).
> Weg A = Benutzername **und** Passwort (Firmen-Look, Makro).
> Eine normale Office-Datei kann beim Öffnen technisch **nie** ein
> Benutzername-Feld zeigen — nur Passwort (C/B) oder Makro-Login (A).

---

# Weg C – Automatisch beim Download (empfohlen, ohne Office)

Ist in deinem LoveBot-Server eingebaut. Sobald in der `.env` steht:

```
DATEI_LOGIN_PW=DeinDateiPasswort
```

ist **jede** heruntergeladene Office-Datei automatisch geschützt:

- einzelne Brand-Datei (.docx/.pptx) herunterladen → beim Öffnen fragt
  Word/PowerPoint nach dem Passwort
- Live-Excel-Export → beim Öffnen fragt Excel nach dem Passwort
- **All-in-One-ZIP → jede Office-Datei INNERHALB der ZIP** ist geschützt
  (Text-, Logo- und SVG-Dateien in der ZIP bleiben normal lesbar)

Beim Öffnen erscheint das normale Office-Passwort-Fenster — auf jedem
Gerät, ohne „Inhalt aktivieren“. Einmal auf dem Server einrichten:

```bash
pip install msoffcrypto-tool pycryptodome   # einmalig auf dem Server
# dann in der .env: DATEI_LOGIN_PW=<Passwort>   (+ optional DATEI_LOGIN_USER=Maxichen)
```

Dann Server neu starten. Ohne `DATEI_LOGIN_PW` bleibt alles wie bisher
(Download ungeschützt, nur Admin-Passwort-Gate). `DATEI_LOGIN_USER` ist nur
der Anzeige-/Doku-Benutzername — eine verschlüsselte Datei hat technisch
kein Benutzername-Feld.

---

# Weg A – LoveBot-Firmen-Login (Benutzername + Passwort)

---

# Weg A – LoveBot-Firmen-Login (Benutzername + Passwort)

Beim Öffnen erscheint ein schwebendes Firmen-Login-Fenster:

```text
┌─────────────────────────────────────┐
│            LOVEBOT ☾                │
│      Sicherer Dokumenten-Zugriff    │
│─────────────────────────────────────│
│  Benutzername  […………………]           │
│  Passwort      [••••••••••]         │
│             [ ANMELDEN ]            │
│  © LoveBot by Maxichen              │
└─────────────────────────────────────┘
```

- Excel: Datenblätter **sehr-versteckt** → Login → richtig: alle Blätter da.
- Word: Fenster verborgen → Login → richtig: sichtbar / falsch: schließt.
- 3 Fehlversuche → Datei bleibt gesperrt.
- Passwort liegt **nur codiert (XOR)** in der Datei — kein Klartext, kein Log.
- **Fallback:** Kann das Login-Fenster auf einem System nicht erscheinen,
  fragt automatisch der **Windows-Anmelde-Dialog** nach — es passiert nie
  „nichts“.

## Schützen (auf dem Windows-PC mit Office)

Am einfachsten: im Ordner `LoveBot\Schutz\` die Datei
**`Schuetzen.bat` doppelklicken** (fragt Ordner, Word ja/nein, Marke).
Oder in PowerShell:

```powershell
.\Schutz\Datei-Login-Schutz.ps1 -Path .\Downloads          # Excel
.\Schutz\Datei-Login-Schutz.ps1 -Path .\Downloads -Word    # zusätzlich Word
```

Das Tool fragt nach dem Passwort (Benutzername voreingestellt: `Maxichen`),
**prüft nach dem Einbau selbst**, ob Login + versteckte Blätter wirklich
drin sind, und nutzt bei Problemen automatisch den Windows-Dialog.
Ergebnis: `.xlsm` / `.docm`; Originale → `_Datei-Login-Backup`.

Optionen: `-UserName 'Maxichen'` · `-Password '…'` · `-Brand 'LoveBot'` ·
`-Dialog Windows` (nur Windows-Dialog).

## Troubleshooting: „Beim Öffnen kommt kein Login“

1. **Makro-Leiste:** Beim ersten Öffnen **„Inhalt aktivieren“** klicken.
   Ohne Makros kann Excel den Login nicht starten (das ist Absicht von
   Windows/Office und lässt sich nicht aushebeln).
2. **Richtige Datei?** Es muss die **`.xlsm`/`.docm`** geöffnet werden,
   nicht die ungeschützte Original-`.xlsx` (die liegt im Backup-Ordner).
3. **Erfolgreich geschützt?** Das Tool druckt nach jeder Datei
   „OK geschuetzt als …“. Wenn dort eine rote Meldung stand: Text abtippen
   und schicken (z. B. „Excel ist nicht installiert“, „Zugriff verweigert“).
4. Datei aus dem Internet (Downloads) hat manchmal eine Sicherheits-
   sperre: Rechtsklick → **Eigenschaften** → ggf. „Blockierung aufheben“.

---

# Weg B – Passwort-Sperre (Office-Verschlüsselung, ohne Makro)

Verschlüsselt die Datei richtig: Beim Öffnen fragt **Excel/Word/PowerPoint
selbst** nach dem Passwort. Funktioniert in allen drei Programmen und
überall (auch LibreOffice, Handy-Apps). Kein Makro, kein „Inhalt
aktivieren“. Nicht ohne Passwort zu öffnen.

## Schützen (einmal, mit Python — kein Office nötig)

Am besten direkt auf dem LoveBot-Server (dort ist Python schon da) oder auf
jedem PC mit Python 3:

```bash
pip install msoffcrypto-tool pycryptodome        # einmalig
python3 Schutz/schuetzen-passwort.py Ordner-mit-Dateien -p 'DeinPasswort'
```

Ohne `-p` fragt das Skript das Passwort **verdeckt** ab (kein Log-Eintrag).
Ergebnis: `Name (geschuetzt).xlsx` im selben Ordner (bzw. `-o Ziel`).
Das Skript prüft selbst, dass Entschlüsseln + Inhalt identisch funktionieren.
Unterstützte Formate: `.xlsx .xlsm .docx .docm .pptx .pptm`.

> Wichtig: Passwort vergessen = Datei unbrauchbar. Vorher Originale sichern!

## Kombination A+B

Stärkste sinnvolle Kombination für Firmen-Dateien:
erst **Weg A** (Firmen-Login mit Benutzername + Passwort, `.xlsm`/`.docm`)
und zusätzlich **Weg B** (die `.xlsm`/`.docm` noch mit einem Passwort
verschlüsseln). Dann ist es eine Zugangssperre **und** verschlüsselt.

---

## Ehrliche Grenzen

- Weg A ist eine **Zugangssperre für normale Nutzer**, kein
  kryptografischer Schutz (Makros lassen sich von Profis umgehen).
- Weg B ist die offizielle Office-Verschlüsselung und der stärkste Schutz
  ohne Zusatz-Software — aber nur **ein** Passwort (kein Benutzername).
- **PowerPoint** kann beim Öffnen aus der Datei selbst keinen Auto-Login
  starten → für `.pptx` ist Weg B (oder „Mit Kennwort verschlüsseln“ in
  PowerPoint selbst) die Lösung.

**LoveBot by Maxichen ☾ — Passwörter werden nirgends gespeichert oder geloggt.**

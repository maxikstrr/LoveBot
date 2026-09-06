# 💜 LoveBot — Design-Update 2026

Komplettes Redesign der öffentlichen Website + schönere Befehle (Web & WhatsApp).
Orientiert an onimai.eu · gamebot.me · stormbot.me — dunkel, glasig, aufgeräumt.

---

## 1. Website (public/)

### Neu gestaltet
| Datei | Was ist neu |
|---|---|
| `css/style.css` | **Komplett neues Design-System**: Aurora-Hintergrund, Glas-Karten (Blur), Gradient-Brand (Violett→Pink→Cyan), moderne System-Schrift, Sticky-Glass-Navigation mit Burger-Menü (mobil), saubere Abstände wie bei mail.google.com. Alle alten Klassen (Dashboard, Login, FAQ) bleiben erhalten — nichts kaputt. |
| `index.html` | Neue Landing-Page: Hero mit schlagendem Titel + Chat-Demo ($marry-Verlauf!), **Live-Statistiken** (Nutzer, Gruppen, Befehle, Bot-Status) mit Hochzähl-Animation, 8 Feature-Karten, Befehle-Vorschau nach Kategorien, „In 2 Minuten drin“-Schritte, neuer 3-Spalten-Footer. |
| `cmd.html` | **Neue Befehle-Seite** (das Herzstück): Sticky **Kategorie-Tabs** mit Zählern, große Suche mit `/`-Shortcut, Befehls-Karten mit **Syntax-Highlighting** (`$` pink, Befehl weiß, Argumente blau), **Rechte-Badges** (👑 Owner / 🛡️ Admin / 👥 Gruppe), **Klick = Befehl kopieren** mit Toast-Bestätigung, Aliase eingeklappt in einer Klapp-Box. |
| `features.html` | Neues Layout mit Icon-Kacheln, Hover-Glow und animiertem Terminal. |
| `status.html` | Neuer Look: Status-Pille mit pulsierendem Punkt, Live-Statistiken, saubere Info-Box. |
| `faq.html` | Echtes **Akkordeon** (zum Aufklappen) statt langer Liste. |
| `login.html` | Auf das neue Design umgestellt — Ablauf (Nummer → 2FA-Code → Passwort) unverändert, alle IDs bleiben. |

### Neu in JS
| Datei | Was ist neu |
|---|---|
| `js/commands-data.js` | **Neu.** Alle 249 Befehle eingebettet — wenn der Server/API nicht erreichbar ist, zeigt die Befehle-Seite trotzdem alles an (Fallback). |
| `js/cmd.js` | Neue Render-Logik: Tabs, Suche, Syntax-Farben, Badges, Kopieren, Alias-Klappbox. |
| `js/landing.js` | Neu geschrieben: Live-Zähler mit Count-up-Animation, Status-Pille, Fallback-Daten. |
| `js/common.js` | Robustere `api()` (kein Crash ohne Server), plus Helfer: `toast()`, `initReveal()` (Scroll-Einblenden), `copyText()` (mit Fallback). |
| `js/status.js` | Sauberer Fallback, wenn keine API antwortet. |

### Sonstiges
- `preview-server.cjs` — kleiner Static-Server zum lokalen Anschauen: `node preview-server.cjs` → http://localhost:8080

---

## 2. Befehle schöner (Love.js)

`$help`, `$help <kategorie>`, `$help alle` und die Suche sehen im Chat jetzt so aus:

```
> 💍 *LOVE BOT — LIEBE & HERZEN*
> _3 Befehle_

❥ *$marry* _@user_ — Heiratsantrag stellen 💍
❥ *$ship* _@user @user_ — Love-o-Meter 💘
❥ *$divorce* — Scheidung einreichen 💔

━━━━━━━━━━━━━━━━━━━━
💡 *$help* → Übersicht · *$help alle* → alles
🌹 _LoveBot by Maxichen_
```

- `❥` statt `•`, Befehl **fett**, Argumente _kursiv_
- Kopfzeile mit Kategorie-Emoji + Befehlsanzahl
- `$help`-Übersicht zeigt jetzt pro Kategorie die Anzahl _(7)_
- Suche zeigt Trefferzahl im Header

---

## Nicht geändert
- `app.html` + `night/*` (Control-Panel) und die Logik von Bot/Dashboard — alles läuft weiter wie bisher.
- Alle API-Routen, Login-Flows und IDs bleiben identisch → einfach Dateien übernehmen.

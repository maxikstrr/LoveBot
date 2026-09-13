# 🏅 Team, Ränge, Tickets & Mute — Architektur (7.1.7)

> **Klare Hierarchie, klare Rechte, echtes Support-System:**
> Der Inhaber (Owner) darf alles. Der/die stellvertretende Inhaber:in darf fast
> alles — aber keine Ränge vergeben. Supporter betreuen ausschließlich das
> Ticket-System. Und alle Tickets landen automatisch in der Dev-Gruppe + im Web-Dashboard.

## Die Rang-Hierarchie

| Rang | Icon | Level | Darf | Darf NICHT |
|---|---|---|---|---|
| **Inhaber (owner)** | 👑 | 100 | ALLES: Ränge vergeben, Bans, Broadcast, System, DB, Logs, Accounts, Tickets | — |
| **Stellv. Inhaber:in (deputy)** | 🔱 | 90 | VIEL: Tickets, Bans, Broadcast, System-Control, DB-Backup/Restore, Sessions, XP/Economy | **Ränge vergeben** · Accounts anlegen · Owner-Rechte |
| **Admin** | ◆ | 70 | Tickets, Nutzer bearbeiten, Gruppen, Logs, Broadcast, DB-View | Ränge vergeben, System-Control |
| **Supporter** | ◇ | 40 | **NUR Tickets**: lesen · beantworten · schließen · wieder öffnen | alles andere |
| User | ○ | 10 | eigener Bereich | Verwaltung |

Technisch: `night/rbac.js` — Permission-Matrix (`can(role, perm)`),
`canAssignRole()` erzwingt: nur der Owner vergibt Ränge, Deputy kann NIEMALS
vergeben (hat kein `roles.assign`). Die Inhaber-Rolle selbst wird per Befehl
gar nicht vergeben (Schutzregel).

## Ränge vergeben: `$setteam` (NUR Inhaber)

```
$setteam                            → Übersicht: Ränge + aktuelles Team
$setteam @person stellvertretender inhaber   → 🔱 (auch: stellvertretende inhaberin / stellv / deputy)
$setteam @person supporter          → ◇ (nur Tickets)
$setteam @person admin              → ◆
$setteam @person user               → Rang entfernen
$setteam devgroup hier              → Diese Gruppe = Dev-Gruppe (Ticket-Ziel)
$setteam devgroup <gid>             → per Gruppen-ID setzen / weg → entfernen
```

Bei Erstkonto: Dashboard-Account wird automatisch erstellt, Zugangsdaten
(Username + Temp-Passwort) kommen **privat per DM** — nie in die Gruppe.
Deutsche Rang-Namen werden automatisch erkannt.
(Es bleibt auch `$setrang <rang> @person` aus 7.0 nutzbar.)

## 🎫 Das Ticket-System

```
Nutzer: $ticket <Anliegen>
   │
   ├─▶ Bestätigung mit Ticket-ID (T-0001 …) an den Nutzer
   └─▶ Bot postet das Ticket in die DEV-GRUPPE (falls gesetzt)
          │
          ▼
   TEAM bearbeitet (WhatsApp ODER Web-Dashboard):
   · $ticket info <id>              → Details + bisherige Antworten
   · $ticket answer <id> <text>     → Antwort → DM an den Nutzer
   · $ticket close <id> [grund]     → schließen → DM an den Nutzer
   · $ticket reopen <id>            → wieder öffnen
   · $tickets [offen|geschlossen]   → Team-Übersicht + Statistik
```

- **Speicher:** `Database/tickets.json` (max. 500 Tickets, fortlaufende IDs)
- **Dev-Gruppe:** `$setteam devgroup hier` in der Gruppe selbst — ab da
  landen neue Tickets (und Team-Antworten) dort.
- **Web → WhatsApp:** Antworten aus dem Web-Dashboard laufen über die
  Webmail-Queue (neuer Typ `dm-notice`) — der Bot versendet sie als DM.

## 🖥️ Web-Dashboard (`tickets.html`)

- **Sidebar:** eigenes „TEAM"-Menü mit 🎫 Ticket-Center (Supporter, Stellv.
  Inhaber:in, Admins); der Inhaber findet es unter „VERWALTUNG".
- **Statistik-Karten:** offen / geschlossen / heute / eigene Rolle
- **Pro Ticket:** Anliegen, Verlauf mit Rollen-Badges (👑/🔱/◆/◇),
  Antwort-Feld (Zustellung per WhatsApp-DM), Schließen mit Grund, Reopen
- **Live:** aktualisiert alle 15 s automatisch
- **API (alle Team-geprüft über `tickets.manage`):**
  `GET /api/tickets` · `POST /api/tickets/answer` · `POST /api/tickets/close`
  · `POST /api/tickets/reopen` · `GET /api/team`
  (401 ohne Login, 403 ohne Team-Rolle — Supporter sieht NUR diese Routen)

## Dateien

| Datei | Inhalt |
|---|---|
| `tickets.js` | **NEU** — Ticket-Store (CRUD, Stats, Dev-Gruppe) + alle WhatsApp-Texte (Dev-Nachricht, Antwort-DM, Schließen-DM) |
| `night/rbac.js` | Deputy: `roles.assign`/`accounts.manage` entzogen · Supporter: nur `tickets.manage` |
| `Love.js` | `$setteam` (deutsch, devgroup) · `$ticket`/`$tickets` (Team-Prüfung via rbac) · Webmail-Typ `dm-notice` |
| `server.js` | Ticket-API (4 Routen) + `/api/team` — rollen­geprüft, Admin-Log |
| `public/tickets.html` | **NEU** — Team-Dashboard mit Filter, Antworten, Close/Reopen |
| `public/js/common.js` | Sidebar: TEAM-Sektion für Team-Rollen + Rollen-Labels (Inhaber/Stellv./Supporter) |
| `registry/commands.json` | Neue Kategorie „Support & Team" ($ticket, $tickets, $setteam) — 335 Befehle |
| `ai/knowledge.js` | LoveKI kennt jetzt Team-Ränge & Ticket-System (erklärt sie auf Anfrage) |
| `mute.js` | **NEU 7.1.4** — Mute-Store: parseDuration (30s/10m/2h/1d/2w/permanent), mute/unmute, Auto-Ablauf, Device-JID-Normalisierung |
| `public/js/app.js` | **7.1.4** — Dashboard-Tabs: Übersicht · Tickets (Team) · Team & Ränge (Owner, mit `POST /api/team/role`) |
| `scripts/team-selftest.mjs` | 51 Checks (`npm run test:team`): Ränge · Rechte · Tickets · Dev-Gruppe · Mute · Web-Team-Anlegen (mit accounts.json-Backup/Restore) |

## Sicherheit

- Ränge vergibt **nur** der Inhaber (`isHost` + rbac-Sync, Audit-Log).
- Temp-Passwörter nur per **Privat-DM**, nie in Gruppen.
- Ticket-API: 401/403-Gates, Aktionen im Admin-Log (`ticket.answer/close/reopen`).
- Dev-Gruppen-IDs werden validiert (`<nummer>@g.us`).
- Supporter-Konto kann KEINE anderen Verwaltungs-Routen aufrufen (Matrix).

## 🖥️ Dashboard-Reiter (7.1.4)

Das Dashboard (`dashboard.html`) hat jetzt **Tabs**:

- **📊 Übersicht** — die bekannte Live-Übersicht
- **🎫 Tickets** (Team) — Statistik, Filter (offen/geschlossen/alle), Antworten
  mit DM-Zustellung, Schließen/Reopen — direkt im Dashboard
- **🏅 Team** (nur Inhaber) — die komplette Team-Verwaltung:
  - **➕ Neues Team-Mitglied anlegen:** Nummer + Name + Rang eintragen →
    Account wird sofort erstellt, Username + Temp-Passwort erscheinen
    **einmalig** im Dashboard UND werden der Person per WhatsApp-DM
    (Bot, webmail `dm-notice`) zugestellt. Duplikat-Nummern → 409.
    API: `POST /api/team/add` — nur Inhaber (`roles.assign` + `accounts.manage`).
  - **Rang ändern:** Dropdown pro Account (🔱 Stellv. Inhaber:in / ◆ Admin /
    ◇ Supporter / ○ User) + Speichern. API: `POST /api/team/role`.
  - **Statistik-Karten:** Team-Größe · offene Tickets · Dev-Gruppen-Status.
  - Owner-Konten sind geschützt (kein Demote, Owner-Rolle nie setzbar).
  - Alternativ weiterhin per WhatsApp: `$setteam @person <rang>`.

## 🌙 Control-Panel-Reiter (7.1.6) — nur Owner

Das Night-Control-Panel (`app.html`) hat zwei neue Reiter in der Sidebar
(Gruppe *Account & Team*):

| Reiter | Route | API |
|---|---|---|
| 🎫 **Tickets** | `app.html#/ticket` (auch `#/tickets`) | `GET /api/tickets?status=…`, `POST /api/tickets/answer|close|reopen` |
| 🏅 **Ränge & Team** | `app.html#/raenge` (auch `#/ränge`, `#/team`, `#/rang`) | `GET /api/team`, `POST /api/team/role`, `POST /api/team/add` |

- **Tickets-View:** Stat-Karten (offen/geschlossen/heute), Filter (Alle/Offen/
  Geschlossen), Antworten mit DM an den Ersteller, Schließen mit Grund,
  Wieder-Öffnen. NAV-Gate: `tickets.manage`.
- **Ränge-View:** Team-Tabelle mit Rang-Dropdowns (`deputy|admin|supporter|user`,
  Owner-Konten geschützt), Anlege-Formular (Nummer/Name/Rang) mit einmalig
  angezeigtem Temp-Passwort + automatischer Zugangsdaten-DM, Rang-Legende.
  NAV-Gate: `roles.assign`.
- **Sichtbarkeit:** Das gesamte Panel ist Owner-only (`chrome()` sperrt die
  komplette Navigation für Nicht-Owner; `route()` blockiert zusätzlich jede
  View). Dateien: `public/js/night/ui.js` (NAV), `public/js/night/app.js`
  (`V.ticket`, `V.raenge` + `APP.tkAnswer/tkClose/tkReopen/teamRoleSave/teamAdd`).
- **Design v2 (7.1.7):** Zentrale Styles in `public/css/night.css`
  (`.tk-hero`, `.tk-stat`, `.tk-card`, `.tk-ava`, `.tk-ans`, `.rt-role`,
  `.tk-filter`, `.rt-form`, `.rt-member`, `.rt-leg` …): Hero-Banner mit
  Live-Zähler, Stat-Karten mit Hover-Lift, Segment-Filter, Ticket-Karten mit
  farbigem Seitenrand (offen = pink leuchtend, geschlossen = gedimmt),
  Avatar-Initialen, Chat-Bubbles für Antworten mit farbcodierten Rang-Pills,
  relative Zeiten („vor 2 Std“), Karten-Fade-Kaskade, farbige Rang-Pills
  (owner=gold · deputy=cyan · admin=violett · supporter=pink). Das Web-Dashboard
  (`public/js/app.js`) bekam dieselben Polituren (Avatar-Initialen,
  `dashRolePill`/`dashAgo`, Schließ-Info).

## 🔇 Mute-System (7.1.6) — nur Inhaber

```
$mute @user [zeit] [grund]   🔇 ohne Zeit = PERMANENT bis $unmute
  Zeit-Formate: 30s · 10m · 2h/2std · 1d · 2w · plain Zahl = Minuten · permanent
$unmute @user                🔊 hebt die Stummschaltung auf
$mutelist                    📋 alle aktiven Mutes mit Restdauer
```

- **7.1.6-Bereinigung:** Die *alten Gruppen-Mute-Befehle* (Gruppe per
  `groupSettingUpdate` auf announcement/not_announcement schalten) sind
  **entfernt** — sie hatten die neuen User-Mute-Befehle shadowed (erster
  `case` gewinnt). Registry-Duplikate in der Kategorie `gruppe` ebenfalls weg;
  `mute/unmute/mutelist` liegen nur noch in `admin`.
- **Ziel:** @mention **oder** auf die Nachricht des Users antworten.
- **Wirkung (7.1.7 — „Geist-Prinzip“ 👻):** Der Mute-Check läuft jetzt an der
  **frühsten Stelle des Nachrichten-Handlers** — vor AutoModeration, XP, KI und
  Prefix-Prüfung. Dadurch wird **wirklich JEDE Nachricht** des Gemuteten
  gelöscht: normaler Chat, Befehle, Medien (Bilder/Videos/Sticker) — bis
  `$unmute` oder bis die Zeit abläuft. Danach `continue`: keine Befehle, keine
  XP, keine Reaktionen, nichts. Eine **2. Schicht** im Befehls-Pfad fängt
  zusätzlich JIDs ab, die erst über `resolveSender` aufgelöst werden mussten.
- **Stumme User werden komplett ignoriert** und **jede ihrer Nachrichten vom Bot gelöscht**
  (Gruppen: Bot braucht Admin-Rechte; schlägt das Löschen fehl, wird trotzdem
  ignoriert). Owner sind nie stumm, der Inhaber selbst kann nicht gemutet werden.
- **Ablauf:** Zeitmutes laufen automatisch ab (kein manueller Reset nötig).
- **Speicher:** `Database/mutes.json` (`mute.js` — getestet, Device-JIDs werden
  normalisiert). Beide Varianten im Audit-/Love-Log protokolliert.

## Test

```bash
npm run test:team   # 69 Checks: Ränge · Rechte · Tickets · Dev-Gruppe · Mute · Panel-Reiter
npm run test:ai     # 30 Checks: LoveKI inkl. Copilot (kennt Tickets)
```

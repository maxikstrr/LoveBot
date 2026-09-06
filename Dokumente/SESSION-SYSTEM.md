# 📡 LoveBot Session-System — Phase 1 (v1)

> **SessionManager · Session-Befehle (Owner) · Live-Session-Center im Web**
> Umsetzung der Punkte 1–3 aus der Control-Center-Roadmap.

---

## Architektur

```
                 ┌──────────────────────────────┐
                 │        Love.js (Bot)         │
                 │  SESSION_ID / SESSION_DIR    │
                 │  Hooks: open/close/qr/msg/cmd│
                 └──────────────┬───────────────┘
                                │ import
                 ┌──────────────▼───────────────┐
                 │       sessionManager.js      │  ← zentrale Registry
                 │  Registry · Lifecycle ·      │
                 │  Stats · Health · Activity   │
                 │  Spawn (optional, AUS)       │
                 └──────┬───────────────┬───────┘
                        │               │
             Database/sessions.json   server.js
             (Sessions + Feed)        /api/sessions
                                        │
                                 sessions.html (öffentlich, live)
```

## Die 3 neuen Bausteine

| Datei | Rolle |
|---|---|
| **`sessionManager.js`** | Zentrale Registry: Sessions mit vollem Lebenszyklus (`WAITING_FOR_AUTH → CONNECTING → CONNECTED → DISCONNECTED/QR_REQUIRED/STOPPED/ERROR`), Zähler (Nachrichten, Befehle, Gruppen, Reconnects, Fehler, RAM), Health-Bewertung (🟢 HEALTHY / 🟡 DEGRADED / 🔴 OFFLINE / 🟣 AUTH_REQUIRED / ⚫ STOPPED), Aktivitäts-Feed (letzte 200 Events), optionaler Auto-Spawn (Standard: aus). **Telefonnummern werden immer maskiert** (`4915•••714`). |
| **`sessioncmds.js`** | 13 Owner-only-Befehle für den Chat (siehe unten). Owner-Gate über `isHost` (Bot-/Owner-Gerät). |
| **`public/sessions.html`** | Öffentliches **Session-Center**: Live-Karten je Session (Status-Pille, Uptime, Gruppen, Nachrichten, Befehle), Gesamt-Statistik oben, Live-Aktivitäts-Feed — Auto-Refresh alle 5 s, ohne Login. |

## Dateien

- **`Database/sessions.json`** — Registry + Feed + Spawn-Config
- Pro Instanz: `heartbeat-<id>.json` / `webmail-<id>.json` (main behält die Original-Dateinamen → 100 % abwärtskompatibel)

## Befehle (Owner-only, im Chat)

| Befehl | Wirkung |
|---|---|
| `$sessions` | Alle Sessions: Status, Uptime, Gruppen |
| `$session <id>` | Details (Nummer maskiert, Quelle, RAM, Reconnects …) |
| `$sessionstats <id>` | Nachrichten/Befehle pro Minute, RAM, Fehler |
| `$sessionhealth` | Health-Check aller Sessions 🩺 |
| `$sessionlogs` | Letzte 15 Aktivitäts-Events |
| `$newsession <name>` | Neue Session anlegen (ID-Slug) + Anleitung |
| `$startsession <id>` | Gespawnte Session starten (falls Auto-Spawn aktiv) |
| `$restartsession <id>` | Neu starten (Spawned) / Erklärung (main) |
| `$killsession <id>` | Verbindung stoppen — **Credentials bleiben** |
| `$delsession <id>` | Nur Registry-Eintrag entfernen — **Credentials bleiben** |
| `$sessionname <id> <name>` | Umbenennen |
| `$sessiondefault <id>` | Standard-Session setzen ⭐ |
| `$sessionqr` | Erklärt, wo QR/Pairing erscheint (Terminal/Dashboard — nie im Chat) |

**Kill ≠ Delete** — so wie in der Architektur vorgesehen:
`kill` stoppt nur die Verbindung, `delete` entfernt den Registry-Eintrag.
Die `main`-Session ist bei beiden geschützt (kein Selbst-Aussperren aus dem Chat heraus).

## True Multi-Session (vorbereitet, sicher)

Love.js liest jetzt `LOVEBOT_SESSION_ID` und `LOVEBOT_SESSION_DIR` (Defaults: `main` / `./Sessions` —
Verhalten unverändert). Zweite Instanz starten:

```bash
LOVEBOT_SESSION_ID=soul_02 LOVEBOT_SESSION_DIR=Sessions/soul_02 node Love.js
```

→ erscheint automatisch im `$sessions`-Command und im Web-Session-Center.

**Auto-Spawn** (Bot startet Instanzen selbst als Kind-Prozesse):
`Database/sessions.json` → `config.spawn.enabled: true` setzen — danach funktionieren
`$newsession`/`$startsession`/`$killsession`/`$restartsession` vollautomatisch für gespawnte Sessions.
Standardmäßig **aus**, weil jeder Spawn eine zweite WhatsApp-Nummer braucht.

## Integration in Love.js (7 minimale Hooks)

1. `sessionPath`/`SESSION_ID` aus Env (Zeile ~117)
2. Import `sessionManager` + `sessioncmds`
3. `connection === 'open'` → `setLive()` + Gruppen zählen
4. `qr` → `setStatus('QR_REQUIRED')`
5. `connection === 'close'` → `setStatus('DISCONNECTED')`
6. `messages.upsert` → `trackMessage()`, Befehls-Loop → `trackCommand()`, Fehler → `trackError()`
7. `default:`-Case: erst `handleSessionCommand()` (Owner-Gate), dann LovePlus

## Website

- `server.js`: neuer Endpoint **`/api/sessions`** (Liste + Feed, maskiert); beim Start wird der
  vorhandene Heartbeat automatisch in die Registry übernommen (Boot-Migration)
- `sessions.html` + Nav-Link „Sessions“ auf allen Seiten
- Neue Kategorie **SESSION-CENTER (OWNER)** in der Befehlsliste (Chat `$help sessions` + Website) —
  jetzt **281 Befehle in 15 Kategorien**

## Sicherheit

- Telefonnummern **niemals** im Klartext (Chat & Web) — immer `4915•••714`
- QR/Pairing-Codes erscheinen nie im Gruppen-Chat
- Alle Befehle Owner-only; main-Session gegen Kill/Delete geschützt
- Credentials werden von Befehlen **nie** automatisch gelöscht

## Nächste Phasen (Roadmap)

- **Phase 2:** Session-Detailansicht im Web (Tabs: Overview/Logs/Errors/Performance) + WebSocket-Live-Updates statt Polling
- **Phase 3:** Owner-Control-Center `/admin` (Users, Groups, Economy, Pets, Achievements verwalten)
- **Phase 4:** Staff/RBAC ausbauen (`night/rbac.js` erweitern) + Audit-Logs durchsuchbar im Web
- **Phase 5:** Analytics-Charts (Nachrichten/Tag, Top-Commands), Alert-Center (RAM/CPU/Offline)
- **Phase 6:** Backup-Center + Bot-Tester (Command-Test im Dashboard)

---

# 🚀 Session-System 3.0 (Phase 2 umgesetzt)

## Neu in `sessionManager.js`

| Funktion | Wirkung |
|---|---|
| **Session-Profile** | Pro Session: `prefix`, `language`, `theme`, `mode` + Feature-Overrides (`love/economy/pets/games/ai/moderation` → `inherit/on/off`) — Kaskade **Global → Session**. Der Präfix wird von Love.js beim Start tatsächlich gelesen (`$sessionset <id> prefix #`). |
| **`cloneSession()`** | Klont Profil & Konfiguration — **niemals Credentials, niemals Zähler**. Neue Session braucht eigene QR/Pairing-Auth. |
| **Uptime-%** | `connectedMs`-Akkumulator → Verfügbarkeit in % pro Session (Monitor-Balken). |
| **Maintenance-Flag** | Wartungsmodus pro Session, sichtbar in `$sessions` + Web. |
| **Events mit `sid`** | Jeder Aktivitäts-Eintrag trägt die Session-ID → `$sessionevents <id>`, `$sessionerrors <id>`, Detail-Modal im Web. |
| **`adoptAllHeartbeats()`** | Adoptiert `heartbeat.json` **und** `heartbeat-<id>.json` — Server synchronisiert alle 15 s. Instanzen auf anderen Hosts erscheinen so automatisch in der Registry. |

## Neue Befehle (Session 3.0)

`$sessionprofile` · `$sessionset <id> <key> <wert>` · `$sessionfeature <id> <f> <inherit|on|off>`
`$sessionclone <id> <name>` · `$sessionexport <id>` / `$sessionbackup` · `$sessionmaintenance <id> <on|off>`
`$sessionevents <id>` · `$sessionerrors <id>` · `$sessiongroups/users/messages/commands <id>`
Aliase: `$stopsession` (= kill) · `$reconnectsession` (= restart) · `$sessionpair`/`$sessioncode` (= qr-Hinweis)

**Gesamt: 25 Session-Befehle.**

## ⚡ Live-Stream (statt Polling)

`server.js` stellt **`/api/live`** als **Server-Sent Events**-Endpoint bereit:
alle 3 Sekunden werden `{sessions, activity}` an alle offenen Browser gepusht —
kein Reload, kein Polling (mit automatischem Polling-Fallback).
`sessions.html` nutzt `EventSource` und zeigt im Hero „**Live-Stream aktiv**".

## Session-Center 3.0 im Web

- **Uptime-Monitor**: Balken je Session (grün ≥95%, gelb ≥60%, rot) — klickbar
- **Detail-Modal**: Klick auf Karte/Balken → Übersicht, Profil-Chips, letzte Events der Session
- **Session-Launcher**: 4-Schritte-Anleitung ($newsession → Instanz starten → live → steuern)

## Getestet (26 Unit-Tests + Browser-Audit)

✅ Registry/Lifecycle/Clone/Profile/Maintenance/Uptime-%/Adoption/Maskierung
✅ Alle neuen Befehle, Owner-Gate, Fremd-Befehl-Durchreiche
✅ SSE liefert, Live-Badge, Monitor, Modal (Escape), keine JS-Fehler auf allen Seiten
✅ Befehlsliste: **292 Befehle in 15 Kategorien**

## Nächste Schritte (Roadmap)

- **Phase 3:** Owner-Control-Center `/admin` (Users/Groups/Economy/Pets verwalten), Group-Dashboard mit Analytics
- **Phase 4:** RBAC/Staff ausbauen (`night/rbac.js`), durchsuchbare Audit-Logs
- **Phase 5:** Analytics-Charts, Alert-Center, Notification-Center
- **Phase 6:** Backup-Center (Credentials geschützt), Bot-Tester, Webhooks, Command-Builder
- Danach: Session Pools (Primary/Backup/Failover), Load-Balancing-Übersicht, Emergency-Panel

---

# 🧠 Session-System 4.0 — Desired-State, Locks, Audit & Fleet

## ⚠️ Wichtige Klarstellung zur Library

Dieses Projekt läuft auf **`@whiskeysockets/baileys`** (v7.0.0-rc14) mit eigenem `waApi.js`-Wrapper —
**nicht** auf `@neelegirly/wa-api`. Diese Library existiert zwar (npm, Multi-Session-Wrapper für einen
Baileys-Fork), eine Migration würde aber die komplette Verbindungsschicht umschreiben.
Die Konzepte (desiredState, Pause/Stop/Resume/Delete, Managed-vs-Running, Registry) sind deshalb
**library-neutral** hier umgesetzt. Falls später auf `@neelegirly/wa-api` migriert wird, übernimmt deren
Sessionverwaltung den WhatsApp-Teil — dieser Manager bleibt Adapter für LoveBot-Metadaten
(Profil, Tags, Audit, Fleet, Dashboard).

## Neu in 4.0

| Konzept | Umsetzung |
|---|---|
| **desiredState** | `running` / `paused` / `stopped` pro Session — nach Neustart weiß das System, was wieder hochkommen soll (`bootPlan()`) und was bewusst aus ist |
| **Pause ≠ Stop ≠ Delete** | `$pausesession` (vorübergehend, desiredState `paused`) · `$killsession` (bewusst aus, desiredState `stopped`) · `$delsession` (nur Registry; Credentials bleiben **immer**) |
| **Resume** | `$resumesession` → desiredState `running`, gespawnte Instanzen starten automatisch |
| **Auto-Start / Warm Restart** | `$sessionautostart <id> <on|off>` — `bootPlan()` listet Sessions mit desiredState `running` + autoStart |
| **Operation-Locks** | `acquireLock(sid, op, actor)` mit 60 s TTL — parallele Lifecycle-Aktionen auf dieselbe Session werden abgewiesen („Session ist beschäftigt: RESTART durch Admin A“) |
| **Audit-Trail** | Jede Admin-Aktion pro Session: CREATED/STARTED/STOPPED/PAUSED/RESUMED/DELETED/AUTOSTART/ENV/RESTART_FAILED — mit Akteur & Zeit, API + Modal |
| **Managed vs Running** | `fleetStats()` trennt wie `getAllManagedSessions` vs `getAll`: Managed gesamt / Running / Paused / Auth nötig / Stopped / Error + Ø Uptime |
| **Fleet-Befehl** | `$fleet` — die Fleet-Übersicht im Chat |
| **Restart Failed** | `$restartfailed` — nur Sessions mit desiredState `running` und Status ERROR/DISCONNECTED |
| **Phantom-Detection** | `$orphansessions` — findet `Sessions/`-Ordner mit `creds.json` ohne Registry-Eintrag (löscht nichts!) |
| **Tags + Environment** | `$sessiontags <id> production primary` · `$sessionenv <id> production|testing|development` — im Web als Filter-Chips |
| **Uptime & Downtime** | `connectedMs`-Akkumulation → Uptime-% **und** getrennte Zeit seit Registrierung |

## Neue Befehle (Session gesamt: 33)

`$pausesession` · `$resumesession` · `$sessionautostart` · `$sessiontags` · `$sessionenv`
`$fleet` · `$restartfailed` · `$orphansessions`

**Befehlsliste gesamt: 300 Befehle in 15 Kategorien.**

## Web (Session-Center 4.0)

- **Fleet-Chips**: Managed · Running · Paused · Auth nötig · Stopped · Error/Offline · Ø Uptime
- **Tag-/Env-Filter** über der Session-Liste (klickbar, client-seitig)
- **Modal erweitert**: Lifecycle-Anzeige (new→connecting→running→…), Soll-Zustand vs. Ist,
  Auto-Start, Tags, getrennte Zeit, **Audit-Trail** der Session
- `/api/sessions` + `/api/live` liefern jetzt `audit` + `fleet` mit (SSE alle 3 s)

## Sicherheit (unverändert geschärft)

- QR/Pairing nie im Chat, nie im SSE-Stream, nie in Logs
- Telefonnummern immer maskiert
- main-Session gegen Pause/Kill/Delete geschützt
- Credentials werden von keinem Befehl je angerührt oder exportiert

## Getestet

✅ 34 Unit-Tests (desiredState, Pause/Resume, Locks inkl. Busy-Meldung mit Akteur,
Audit, Fleet, Boot-Plan, Phantom-Detection, Tags/Env, alle neuen Befehle)
✅ Browser-Audit: SSE-Live, 7 Fleet-Chips, Filter, Modal mit Lifecycle/Soll-Zustand/Audit — keine JS-Fehler

## 👑 Owner Panel `/admin` (Phase 1)

Zentrale Verwaltung — nur `role: 'owner'` (adminGuard prüft bei jedem Request live gegen accounts.json).

**API** (alle `Authorization: Bearer`, sonst 401/403):

| Route | Methode | Inhalt |
|---|---|---|
| `/api/admin/overview` | GET | Counts, Fleet-Stats, Totals (Copper/Love/Pets/Achievements), Top-Listen, Activity, Audit |
| `/api/admin/users?q=` | GET | Live-Suche: Database.json × LoveUser-Profile × loveplus.json (Cap 50) |
| `/api/admin/groups` | GET | Gruppen-Registry (Cap 100) |
| `/api/admin/moderation` | GET | Bans + audit.jsonl-Tail(40) + security.jsonl-Tail(20) |
| `/api/admin/session-action` | POST | start/pause/resume/stop/restart/maintenance/autostart/tags/env/rename/default/delete — mit Lock (`WEB_<ACTION>`) + Audit |
| `/api/admin/emergency` | POST | `restartFailed` · `stopAllSpawned` (nur spawned), Confirm: `STOP ALL` |
| `/api/admin/search?q=` | GET | Global Search: Sessions, Nutzer, Gruppen, Audit, Befehle |

**Schutzregeln**: `delete` braucht `confirm: "DELETE <id>"`; Main-Session nicht löschbar (main_protected); gefährliche Aktionen schreiben Audit-Einträge mit Akteur.

**UI** (`public/admin.html`, SPA): Übersicht (12 Stats + Live-Feed), Sessions & Fleet (Alle Aktionen als Buttons), Nutzer (Live-Suche), Gruppen, Moderation, Audit, Emergency. Global Search oben (300 ms debounce). Ohne Owner-Token → Login-Hinweis. Verlinkt aus login.html + sessions.html.

**Getestet**: 401/403-Guard, alle Aktionen inkl. Confirm-Flows, main-Schutz, Not-found, Browser-Audit 0 JS-Fehler (Chromium/Playwright).

**Roadmap Phase 2**: Staff/Permission-Editor, Economy/Love/Pets-Deep-Views, Backups (Credentials nie im Download), Analytics, Alerts, Command Tester, Cross-Linking, /admin/sessions als Top-Level-Fleet-Seite.

## 📚 Command Registry — Single Source of Truth (neu)

**Problem vorher**: Befehlsdaten lebten an 4 Orten (server.js-Inline-Liste „300/15", Love.js HELP_CATEGORIES, SESSION_HELP_CMDS, generierte commands-data.js) und mussten von Hand synchron gehalten werden.

**Jetzt**: `registry/commands.json` ist DIE eine Quelle (211 Befehle · 143 Aliase · 14 Kategorien, v2).

| Konsument | Liest | Wie |
|---|---|---|
| Bot `$help`/`$menu`/`$menunew` | `getHelpCategories()` | Love.js-Block (7983 Zeichen) durch einen Registry-Aufruf ersetzt — identisches Shape `[usage, desc]` |
| Website `/api/commands` | `getCategories()` | Kompat-Shape wie bisher + `stats`; `?rich=1` = flache Liste mit Aliase/Perms/Cooldown; `?q=` = Suche |
| Admin „⚡ Befehle" | `/api/commands?rich=1` | Registry-Browser mit Live-Suche + Kategorie-Filter |
| Admin „🧪 Command-Tester" | `/api/admin/command-test` (POST) | **Trockenlauf**: validiert Input gegen Registry (Alias-Auflösung, Pflicht-Argumente aus Usage, Rechte, Cooldown, ms) — führt NICHTS aus |
| `/docs.html` (neu) | `/api/commands?rich=1` | Auto-Doku, 14 Kategorie-Tabellen, Live-Suche; Fallback: eingebettete Build-Kopie |
| `public/js/commands-data.js` | Build-Artefakt | `node scripts/build-registry.mjs` |

**Neue Bot-Befehle (Owner)**: `$cmdinfo <befehl>` (Registry-Info), `$cmdsuche <begriff>` (Alias `$cmdsearch`).

**Scripte**:
- `scripts/migrate-commands.mjs` — Einmal-Migration (re-run-sicher; liest Code-Alias-Gruppen aus case-Stacks + cmd()-Gruppen)
- `scripts/build-registry.mjs` — Registry → commands-data.js + Validierung (eindeutige Namen, Aliase≠Befehle, Pflichtfelder)
- `scripts/registry-sync.mjs` — Drift-Check Code ↔ Registry (Exit 1 bei unregistrierten Befehlen); hat 45 implementierte, aber nie dokumentierte Befehle gefunden (flirt, confess, goodnight, setrang, pairing …) → via `scripts/add-missing.mjs` aufgenommen

**Ehrliche Zahlen**: früher „300 Befehle" inkl. 118 Alias-Einträgen in einer Pseudo-Kategorie; jetzt sauber getrennt: 211 echte Befehle + 143 Aliase. 31 Alias-Mappings offen (eigene Cases, dokumentiert in registry meta.aliasResolution).

**Getestet**: /api/commands compat+rich+q ✓ · command-test (Alias kuss→kiss, fehlende Argumente, unbekannt, 401-Guard) ✓ · Browser-Audit Admin-Tabs + docs.html: 0 JS-Fehler ✓ · Sync: alle implementierten Befehle in der Registry ✓

## 🪪 Profil & 💍 Marriage 2.0 (2026-09-05)

### `$me` — drei Ebenen, mit Buttons (alles im selben Chat)
- **`$me`** → Kompakt-Karte: Level + XP-Balken (`████░░ 82%` + „noch X XP bis Level N+1“), Kupfer + Wallet-Rang, Love-Status, Pet, Streak, Achievements, Gruppenrolle. Danach interaktives Menü: 📋 Alles im Detail · ❤️ Liebe · 💎 Economy · 🏆 Achievements · 🐶 Pet.
- **`$me info`** → Detail-Karte in Bereichen: ACCOUNT (nur Owner sieht BID/DSGVO/Verify), PROFIL (ohne Alter!), LEVEL & XP, ECONOMY (Wallet+Bank+Rang+Items), LOVE (Partner, Tage, Couple-Level/Streak/Erinnerungen), PET (Bond/Glück/Hunger/Energie), ACHIEVEMENTS (Preview top 4), GAMES, ACTIVITY.
- **`$profile [@user]`** (neu, Alias `$profil`) → Profil einer anderen Person — öffentlich, **OHNE Alter & ohne JID/LID/BID**, mit Profilbild. Ohne Ziel: eigenes Kompakt-Profil. `$level` bleibt reine Level-Ansicht (Aliase profil/profile entfernt).

**Datengrundlage (ehrlich):** `getLoveSnapshot(userProfile, myKey)` in loveplus.js — einzige Quelle für alle Profil-Ansichten (Bot + Web). Nicht erfasste Werte (Nachrichten/Befehle pro Nutzer, XP heute/woche, Best-Streak, Pet-Rarity) erscheinen als `—` bzw. entfallen — nichts wird erfunden. **Alter wird gespeichert, aber nie öffentlich angezeigt.**

### `$register` — interaktiver Einstieg
Nach Erfolg: Willkommens-Menü (Mein Profil / Achievements / Haustier adoptieren / Konto & Daily / Alle Befehle) — nur echte Befehle als Rows.

### `$marry @user` — sicherer interaktiver Flow
- **Ablauf 2 Minuten** (vorher 60 min; Konstante `MARRY_EXPIRY_MS`).
- **Request-ID-Bindung**: Listen-Rows senden `cmd:marryaccept <shortId>` / `cmd:marrydeny <shortId>` (dein `marry:accept:<requestId>`-Prinzip, technisch über den bestehenden cmd-Router umgesetzt). Der Handler prüft: ID → Proposal → **nur der Adressat** darf antworten, sonst „🛡️ Nur der Adressat darf antworten“ mit Mention; abgelaufen/erledigt → „⏰ abgelaufen“.
- **Bei JA** (neu): Couple wird sofort angelegt (+100 Love-XP Startbonus), beide bekommen Achievement **💍 Just Married**, Celebration zeigt beides.
- Text-Fallback bleibt komplett: `Ja`/`Nein` im Chat, `$marryaccept`/`$marrydeny`.
- Checks unverändert: Selbst-Marry, beidseitig verheiratet, offener Antrag, Ziel-Auflösung.

### Neue Befehle
`$couplestats` (Alias `$paarestats`) · `$anniversary` (Alias `$jahrestag`) · `$relationship` hat neue Aliase `$couple/$paare/$ehe`. Registry-Stand: **214 Befehle + 147 Aliase**.

### Interaktivität — technischer Stand (ehrlich)
Genutzt wird das bewährte **Listen-Menü** (`listMessage` via relayMessage, wie `$menunew`) — das rendert in diesem Setup (Baileys 7.0.0-rc14) zuverlässig auf iOS/Android. Antworten kommen als `listResponseMessage` zurück; der Router `getInteractiveCommandSelection()` wertet zusätzlich `buttonsResponseMessage` und `templateButtonReplyMessage` aus. **Offline nicht testbar:** das reale Rendering/Geräteverhalten — bitte einmal live mit einer echten Session prüfen; die Text-Pfade funktionieren unabhängig davon immer.

### Owner-Panel
Users-Tab: Zeilen klickbar → **Detail-Modal** (Level&XP mit benötigtem XP, Economy alle vier Währungen, Love&Pet mit Partner/Verheiratet-seit, Achievements, Streak, Registrierdatum; Hinweis „Alter & IDs nie öffentlich“). `/api/admin/users` liefert dazu 19 Felder (u. a. silver/gold/platin, spouse, marriedAt, registeredAt, neededXp).

### Getestet
✅ 19/19 Unit-Tests (loveplus-Snapshot: Wallet-Rang über alle Nutzer, Couple-Findung via myKey, Pet/Streak/Items, Achievement-Preview, Tage zusammen; Marriage-Hook: +100 XP, Couple-Key sortiert, Achievement beide, kumulativ, marriedAt)
✅ Syntax alle Dateien · Registry-Build + Sync (214/147) · Users-API (19 Felder) · Browser-Audit Modal (öffnet, alle Bereiche, schließt, 0 JS-Fehler)

## 🎬 Media-Commands & Media Center (2026-09-05)

### Die vier Media-Standards (`mediacmds.js`, gemeinsam Konverter-Kern)
| Befehl | Aliase | Pipeline (echt via ffmpeg) |
|---|---|---|
| `$toimg` | `$sticker2img` | zitiertes stickerMessage → WebP → **JPEG als Foto** (kein Dokument) |
| `$tomp3` | `$toaudio` `$mp3` | zitiertes videoMessage → `-vn libmp3lame` → **MP3 als Audio** |
| `$tomp4` | `$video` `$audio2video` | zitierte audioMessage → **Standbild + AAC** → MP4 (Audio hat keine Videospur!) |
| `$sticker` | `$stiker` `$s` | zitiertes Bild → `scale 512:512 + libwebp` → **Sticker**; Sticker-Zitat wird direkt weitergeleitet |

- **Gemeinsamer Kern** (wie gewünscht keine FFmpeg-Copies pro Befehl): ffmpeg-Resolver (FFMPEG_PATH → ffmpeg-static → PATH), Temp-Dateien unter `tmp/media/<rand>` mit Cleanup, 64-MB-Limit, Lazy-Import von `waApi.js` (Kern ohne Baileys testbar).
- **`$tomp4`-Standbild** ist konfigurierbar statt hartkodiert: `Assets/max.jpeg` → `Bilder/max.jpeg` → `tmp/max.jpeg` → (Property `config.staticImage` in Database/media.json); ohne Treffer erzeugt ffmpeg einen dunklen LoveBot-Rahmen (`lavfi color`) — ehrlicher Fallback, in Nachricht + Log vermerkt.
- **Sticker-Paket/Autor**: Bestätigung zeigt `Pack: LoveBot · Author: <pushName aus der Nachricht>`. Hinweis: WhatsApp zeigt Pack/Author im Sticker nur bei EXIF-Chunk im WebP — der ist (bewusst) nicht gesetzt, kein Fake-Metadaten-Code.
- Integration: default-Case in Love.js nach Session-Befehlen, vor LovePlus; ohne ffmpeg → klare Install-Hilfe statt Absturz.
- **Statistik/Logs**: jede Konvertierung schreibt `Database/media.json` (stats pro Befehl, Logs mit Nutzer/Chat/Session/Input/Output/ms/Result, Live-Jobs mit Auto-Expiry 10 Min) — dieselbe Datei liest das Panel.

### 👑 Panel „🎬 Media“ + Glas-Redesign
- **Media-Tab**: Karten (Konvertierungen, Erfolgsrate, Ø Dauer, Fehler), Statistics-Tabelle pro Befehl, **7-Tage-Balkencharts** (echte Log-Zählung), Live Processing, Logs-Tabelle mit SUCCESS/Fehler-Pills, Standbild-Konfiginfo. API: `/api/admin/media` (Owner).
- **Glas-Look** (nur admin.html): Glass-Cards mit backdrop-blur, dezente Purple/Pink-Gradients, **Hero-Header** („Guten Abend, Max 👋“ + Uhr + Status-Pill „🟢 Operational“ aus Fleet-Fehlern), Stat-Karten mit **„+X heute“** (echte registeredAt/setupAt-Deltas via `overviewDeltas`), **Fleet-Karten** (Uptime/Gruppen/Nachrichten, Öffnen-Button), Mobile ≤900px (Sidebar horizontal, kein Overflow).
- Registry: **218 Befehle + 154 Aliase** (Medien-Kategorie +4). Docs/Tester/Website zeigen sie automatisch.

### Getestet
✅ 9/9 ffmpeg-Kern-Tests (RIFF/WEBP-Sticker, FFD8-JPEG, MP3-Magic, MP4-ftyp, Standbild-Fallback, Größen) mit echtem ffmpeg-static-Binary · API-Curl (stats/totals/byDay/live/logs) · Browser-Audit: Hero/Greeting/Clock/Status, Glass-Blur, Delta-Anzeige, Fleet-Karte, Media-Tab komplett, Mobile 375px ohne Overflow — **0 JS-Fehler**. Bot-seitige Live-Konvertierungen brauchen die echte Session (offline nicht prüfbar).

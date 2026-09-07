# 🚀 LOVEBOT — PLATTFORM-ROADMAP (Vision → Phasen)

> Stand: 2026-09-06 · Ziel: aus LoveBot ein **Bot-Management-System mit eigener
> Plattform** machen — Multi-Session-Fleet, Owner-Control-Center, Gruppen- &
> Userverwaltung, Automationen, Monitoring, Analytics, LovePlus und eine
> komplette öffentliche Webseite.

## ✅ Neu gebaut (2026-09-06)

| Bereich | Status |
|---|---|
| **Pro-Befehl-Tracking** | `sessionManager.js`: `commandStats`/`commandStatsDaily` (30-Tage-Fenster) → `topCommands()`, `totalCommandCalls()`, `commandActivityByDay()` |
| **`/api/statistics`** (öffentlich, kein Login) | Nutzer/Gruppen/Sessions, Registry-Zahlen (Befehle/Kategorien/Aliase), LovePlus-Summen, meistgenutzte Befehle, 14-Tage-Aktivität |
| **`/api/leaderboard`** (öffentlich, kein Login) | Top-Level/XP, Top-Reichste (Copper), Top-Paare (Love-XP) — Namen konsequent maskiert |
| **`public/statistics.html`** | Öffentliche Statistik-Seite mit Balken-Chart Top-Befehle + Aktivitäts-Verlauf |
| **`public/leaderboard.html`** | Öffentliche Bestenliste mit 3 Tabs (Level/Reichste/Paare) |
| **Datenschutz-Fix** | `safeDisplayName()` in server.js: verhindert, dass rohe Telefonnummern (statt Usernamen) unmaskiert in Paar-/Ranglisten-Ausgaben landen (betraf vorher `loveplusLiveSnapshot()` und damit `/api/siteinfo`, `/api/stats`) |

> Diese Bausteine sind bewusst zuerst gebaut, weil sie (a) auf bereits echten
> Daten in der laufenden Datenbank basieren, (b) ohne neue Infrastruktur
> auskommen und (c) direkt Nutzen stiften (Community-Wettbewerb,
> Transparenz), statt nur Mockups zu sein.

## 🗺️ Große Vision — „Maxichen-Plattform" (Einordnung)

Es gibt eine sehr weitreichende Vision, LoveBot zu einer kompletten
Bot-/Developer-Plattform auszubauen: Multi-Bot-Hosting, Plugin-Marktplatz,
Developer-Portal mit API-Keys/Webhooks/SDK, Community-Forum mit
Feature-Voting, Bot-Sandbox, Automation-Engine, Premium/Teams, PWA usw.

**Ehrlich eingeordnet:** Das ist im Umfang ein eigenständiges SaaS-Produkt,
keine Erweiterung, die in ein paar Arbeitssitzungen entsteht — realistisch
Wochen bis Monate Team-Arbeit. Bevor einzelne Teile davon gebaut werden,
sollte jeweils konkret entschieden werden, was *jetzt* echten Nutzen hat
(reale Daten, reale Nutzer) vs. was nur als UI-Mockup ohne Backend enden
würde. Nicht jeder Punkt unten passt zu einem Ein-Personen-WhatsApp-Bot-Projekt
— manche (Multi-Tenant-Hosting, Payment/Premium, eigenes Plugin-Ökosystem)
ergeben erst Sinn, wenn es mehrere Bots/Entwickler auf der Plattform gibt.

Grobe Priorisierung nach Aufwand/Nutzen-Verhältnis für den aktuellen
Ein-Bot-Stand:

1. **Sofort sinnvoll, kleiner Aufwand** (baut auf echten Daten auf):
   Public Statistics ✅, Public Leaderboard ✅, Command-Analytics ✅,
   Aktivitätskalender ✅, Changelog-Seite, Incident-Historie auf status.html.
2. **Mittelfristig sinnvoll** (braucht neue, aber überschaubare Backend-Logik):
   Event Explorer (Detailansicht pro Audit-Eintrag), Feature Requests /
   Community-Voting, striktere Rollen-/Permission-Granularität, Webhook für
   eigene Automationen (z. B. „Session disconnected" → eigener Alert).
3. **Großprojekt, nur mit klarem Bedarf** (SaaS-artig, hoher Aufwand):
   Multi-Bot-Hosting/Bot-Hub, Plugin-Marktplatz mit Downloads/Reviews,
   Developer-API mit Keys/Rate-Limits, Payment/Premium, Discord/Telegram-
   Bridge, eigenes Browser-Spiel („Couple Home"), Multi-Tenant-Architektur.

Punkt 3 wird hier bewusst **nicht** als fertige Oberfläche vorgebaut, weil
das ohne echtes Backend nur Fake-Buttons wären. Wenn eines dieser Systeme
gebraucht wird, sollte es gezielt und einzeln beauftragt werden.

## ✅ Bereits gebaut (Fundament)

| Bereich | Status |
|---|---|
| **Session-System 4.0** | desiredState, Pause≠Stop≠Delete, Locks, Audit, Fleet-Stats, Tags/Env, Phantom-Detection, Warm-Restart-Plan (`SESSION-SYSTEM.md`) |
| **👑 Owner Panel Phase 1** (`/admin.html`) | Overview, Sessions+Aktionen (mit Lock/Confirm/Audit), Users-Suche, Groups, Moderation, Audit, Emergency, Global Search |
| **📚 Command Registry** (done ✅ heute) | `registry/commands.json` = Single Source of Truth → speist **gleichzeitig**: Bot-`$help` (Love.js), Befehle-Webseite, Admin-**Befehle-Browser**, **Command-Tester** (Trockenlauf), **/docs.html** (Auto-Doku). 211 Befehle + 143 Aliase + 14 Kategorien. Drift-Check: `scripts/registry-sync.mjs`, Build: `scripts/build-registry.mjs` |

**Der zentrale Grundsatz ab jetzt:** Ein neuer Befehl wird **nur noch einmal**
definiert (Registry) und erscheint automatisch überall (Bot-Help, Website,
Tester, Doku).

---

## 📡 PHASE 2 — Multi-Session vertiefen

- **Session Pools**: `$pool create/delete/list/info/add/remove/primary/backup/standby/health`
  (production/testing-Pools mit Primary→Backup→Standby-Ordnung)
- **Failover**: Primary offline → Health-Check → Backup aktivieren; klares
  Routing (keine Doppelversendung); Dashboard-Event „⚠️ Soul_01 disconnected →
  ✅ Soul_02 selected"
- **Session Templates**: `$template list/create/edit/delete/use` (Love
  Production: Präfix, Sprache, Features ON/OFF …) → `$template use
  love-production soul_09`
- **Snapshots**: `$session snapshot|snapshots|rollback <id> <snapshot>` — nur
  Konfiguration, **nie** WhatsApp-Credentials anfassen
- **Scheduler**: `$schedule list/create/delete/enable/disable` (z. B. „Restart
  Soul_03 jeden Sonntag 04:00", „Daily announcement 18:00")
- **Vergleich & Zeitlinien**: Session Compare, Timeline (Created/Connected/
  Reconnect/Restart/Disconnect), Usage pro Session, Export-Report (HTML/JSON),
  Session Notes, Managed-by, Maintenance Window, Startup Order, Dependencies
- **Weitere Befehle**: sessionclone/export/import/lock/unlock/healthcheck/
  recover/diagnose/messages/commands/groups/users/events/errors, fleetstats,
  fleethealth, startall, stopall

## 👑 PHASE 3 — Owner Panel ausbauen (Navigationbaum)

```
👑 OWNER
├── 🏠 Overview (+ Quick Actions: New Session, Restart Failed, Fleet,
│     Emergency, Announcement, Backup)
├── 📡 Sessions (Fleet/Running/Managed/Pools/Templates/Health/Events/Logs/Errors)
│   └── /admin/sessions als Top-Level-Fleet-Seite (ASCII-Tabellen-Optik, alles klickbar)
├── 👤 Users (Übersicht + Detail-Tabs: Profile/Account/Activity/Commands/Groups/
│     Love/Relationship/Economy/Pets/Achievements/Warnings/Bans/Audit/Sessions)
│   └── Aktionen: Edit, Set Rank/Level/XP/Hearts, Reset XP/Economy/Love/Pet,
│       Warn/Unwarn, Ban/Unban, Mute — alles mit Audit
├── 👥 Groups (Members/Admins/Moderation/Rules/XP/Economy/Love/Pets/Games/
│     Activity/Analytics/Logs/Settings; betreuende Session sichtbar)
├── 👮 Staff Manager (Owners/Admins/Supporters/Moderators/Group Admins;
│     granularer Permission-Editor, NICHT an starre Ränge gebunden)
├── ❤️💌🎁🐶💎🏆🎮🤖 Fach-Admins: Love/Relationships/Letters/Gifts/Pets/
│     Economy (Wallet/Transaktionen/Shop/Items/Preise)/Achievements (Create/
│     Grant/Revoke)/Games (Scores/Leaderboards/Events)/AI (Usage/Latenz/
│     Fehler, enabled Global→Session→Group)/Media
├── 🛡️ Moderation Center (Bans/Warnings/Kicks/Mutes/Deleted/Anti-Spam/Anti-Link/
│     Anti-Flood/Auto-Mod + Live-Feed) · 🚫 Bans · ⚠️ Warnings
├── 📊 Analytics 2.0 (1h/24h/7d/30d/90d/1y/All; Grafiken: Messages/Commands/
│     Users/Groups/Sessions/Errors/Economy/Love/Pets; Session-Vergleich)
│   └── 📈 Reports
├── 📜 Audit 2.0 (Actor/Action/Target/Session/Group/WebSession/IP/Result,
│     global + pro Session, Filter) · 🚨 Alerts (Rule Builder: WHEN→IF→THEN)
│     · 🐞 Error Center
├── 💾 Backup Center (DB/Config/LovePlus/Economy/Pets/Achievements/Session-
│     Registry getrennt; **Credentials NIEMALS in Downloads**) · 🔄 Restore
│     Center (Preview Changes vor Restore) · 🧹 Data Management (Export/Delete/
│     Reset, alles mit Audit)
├── 🔐 Security Center (Login Attempts/Failed Logins/Rate Limits/Blocked/
│     Suspicious/API Access) · 🔑 Permissions · 📴 Login-Session-Manager
│     (Geräte anzeigen, Logout Device/All)
├── 🧪 Command Tester (✅ fertig — Trockenlauf) · 🧰 Developer Tools (JSON/
│     Event/Config/Environment/Log Viewer, Database Inspector, Command/
│     Feature Registry — **Secrets nie im Frontend**)
├── 🔌 API Center (Keys/Applications/Usage/Rate Limits) · 🪝 Webhooks
│     (session.connected/disconnected, user.created, achievement.unlocked …)
├── 📣 Announcements (Ziel: Website/Dashboard/Staff/Users/WhatsApp) · 📝
│     Changelog (Version/Title/Features/Fixes/Breaking) · 🎫 Support Center
│     (Tickets: Open/Waiting/Answered/Closed, Staff-Übernahme)
├── 📚 Documentation (✅ auto-generiert aus der Registry: Description/Usage/
│     Arguments/Aliases/Permissions/Cooldown/Category)
└── ⚙️ Settings (GLOBAL→SESSION→GROUP Overrides, Feature Flags mit
      inherit/enabled/disabled auch pro User)

## ⚙️ PHASE 4 — Engine-Systeme

- **Automation Engine**: Trigger → Condition → Action (z. B.
  SESSION_DISCONNECTED + production → Alert + Reconnect-Versuch)
- **Event Center**: alles als Events (SESSION_CONNECTED, MESSAGE_RECEIVED,
  COMMAND_EXECUTED, USER_REGISTERED, ACHIEVEMENT_UNLOCKED …) → `/api/events`
  für berechtigte Admins; **SSE liefert** sessions/fleet/events/activity/
  alerts/audit/stats → alles live im Dashboard
- **Alert Rule Builder**: Owner-Regeln (Session disconnected + production →
  Alert; Error count > 10 → Alert)
- **Feature Flags 2.0**: Global/Session/Group/User mit inherit/enabled/disabled
- **🚨 Emergency Center 2.0**: SYSTEM SAFE MODE (Disable commands, Maintenance,
  Stop new/all sessions, Disable Economy/AI/Media) — nur Owner, typed
  confirmation, System-wide-Warnbanner

## 🌍 PHASE 5 — Öffentliche Webseite

```
/ · /features · /commands · /sessions · /status · /statistics · /leaderboard
/updates · /docs (✅ fertig) · /faq · /support · /team · /privacy · /terms
```

- **Public Leaderboard**: Top Users/Couples/Pets/Gamers/Achievements/Groups
- **Public Status Page**: Website/API/Dashboard/Bot Core/Sessions/Database
  (🟢/🔴) + Incident History

## 🧭 Grundsätze (unverändert)

1. **Ehrlichkeit**: nur wirklich existierende APIs beschreiben — Konzepte
   klar als Konzepte markieren (wa-api = nur Referenz, kein Einsatz).
2. **Credentials heilig**: nie automatisch löschen, nie in Backups/Downloads,
   nie im Gruppen-Chat/SSE/Logs (nur Terminal/Dashboard).
3. **Gefährliche Aktionen**: explizite Bestätigung + Audit-Eintrag.
4. **Datenschutz/Jugendschutz**: kein echtes Matching/Dating zwischen Nutzern;
   `$ship` bleibt Zufalls-Gag.
5. **Bot & Web teilen alles** über die Registry und gemeinsame APIs.

## 🗺️ Empfohlene Reihenfolge

1. **Phase 2**: Pools + Failover + Templates (größter Mehrwert für Fleet)
2. **Phase 3**: Users-Detail + Staff/Permissions + Economy-Admin
3. **Phase 4**: Event Center + SSE-Erweiterung + Automation
4. **Phase 3 Rest**: Backups/Restore, Analytics, Alerts, API/Webhooks
5. **Phase 5**: Public Leaderboard + Status Page

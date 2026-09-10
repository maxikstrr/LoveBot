# 🛸 SOUL ECHO CONTROL CENTER

Zentrale Kommandozentrale für **Bot + Website + Benutzer + Netzwerk + Sicherheit** —
angelehnt an eine FRITZ!Box-Oberfläche, professionelle Benutzerverwaltung und ein
Security Center. Alles läuft **live auf den echten `/api/*`-Daten** des bestehenden
LoveBot-Dashboards; es ist eine reine Frontend-Erweiterung plus drei neue,
kleine Backend-Endpoints.

> Stand: 2026-09-08 · Deutsch · dark „Soul Echo"-Design (Glas/Aurora/Grid)

---

## 1) Dateien (alle unter `public/` + 1 Link + Backend)

| Datei | Zweck |
|---|---|
| `public/control.html` | Einstiegsseite des Control Centers |
| `public/css/control.css` | komplettes eigenes Design (kein Konflikt mit style.css) |
| `public/js/cc-core.js` | Router, Sidebar/Menü, Top-Tiles, Modal-, Reauth- & Suchsystem |
| `public/js/cc-dash.js` | Dashboard, Bot-Übersicht/Sessions/WhatsApp/Gruppen/Bot-Security, Website, Besucher, Web-Sessions |
| `public/js/cc-users.js` | Benutzerakten, Erstellen, Rollen & Rechte, Vorlagen, Einladungen, Massenaktionen |
| `public/js/cc-sec.js` | Security Center, Risk Engine, IP-Listen/Akten, Geräte, Cases, Sperren, Massenaktionen |
| `public/js/cc-sys.js` | Audit/Access/Security/Bot/System-Logs, Systeminfo, Konfiguration, DB, Backups, Wartung, Notfall, Rate Limits, Auto-Regeln |
| `server.js` | **+3 Endpoints:** `GET /api/security/rate-limits`, `GET /api/database/backups`, `POST /api/database/backup` |
| `public/admin.html` | +1 Link „🛸 Soul Echo Control Center ↗" im Owner-Panel-Hero |

## 2) Aktivieren

```bash
# 1. Server neu starten, damit die 3 neuen Endpoints aktiv sind:
#    (das Control Center selbst besteht aus statischen Dateien und ist sofort da)
cd LoveBot
node server.js            # bzw. der übliche Startbefehl / pm2 / systemd

# 2. Aufrufen (eingeloggt als Owner/Deputy/Admin …):
#    https://<deine-domain>/control.html
```

Rollen-Sichtbarkeit: Menü & Aktionen richten sich nach den **echten
RBAC-Einzelrechten** (`/api/me`) — z. B. Owner sieht alles, Deputy fast alles,
Supporter nur das Erlaubte. Kritische Aktionen (dauerhafte IP-Sperre,
Rollenvergabe ≥ Admin, Wartung AN, Deaktivieren/Sperren, „Alle Sessions beenden",
kritische Einzelrechte) verlangen automatisch **Step-up-Reauth** (frisches
Passwort) wie im Backend vorgesehen.

## 3) Was drin ist (Menü)

- **Dashboard** — Live-Uhr, Status-Tiles (Bot/Web/DB/WhatsApp/Security/Sessions/
  Users/IP-Blocks), Security-Lage 24 h, letzte Events & Audit-Aktionen, System kurz.
- **🤖 BOT** — Übersicht (Fleet/Health/Top-Daten), Sessions starten/pausieren/
  neu starten/Autostart (Owner), WhatsApp-Status, Gruppen, Bot-Sicherheit.
- **🌐 WEBSEITE** — Server-Status, Besucher & Seitenzugriffe (Access-Log-Aggregate),
  aktive Web-Sessions (einzeln beenden / alle anderen beenden).
- **👥 BENUTZER** — Akten (Profil/Zugang/aktive Sessions/effektive Rechte +
  Status-/Rollen-/Rechte-Verlauf mit Vorher/Nachher), Benutzer erstellen (zeigt das
  **Einmal-Passwort genau 1×**), Einladungen (mustChange/pending), Rollen &
  Einzelrechte, Rechtevorlagen, Statusmodell 🟢🟡🟠🔴⚫, **Massenaktionen**
  (aktivieren/einschränken/deaktivieren/sperren mit Grund + Audit je Benutzer).
- **🛡 SICHERHEIT** — Security Center (Level/Sperren/Cases), Risk Engine
  (Score → NORMAL/BEOBACHTUNG/EINGESCHRÄNKT/HOCH/KRITISCH), Rate Limits (live),
  Auto-Regeln (Eskalationskette), IP-Listen & **IP-Akten** (Status, erste/letzte
  Verbindung, Events, Zugriffe, Ban/Unban/Block aufheben, Sessions der IP killen),
  Geräte (Browser/OS), Cases (klären/wiedereröffnen mit Notiz).
- **🚫 SPERREN** — IP-Sperren (auto/manuell), Benutzer-Sperren, Session-Sperren.
- **📜 PROTOKOLLE** — Audit / Access / Security / Bot / System (Wer-Was-Wann-
  Woher-Darstellung; Audit bleibt hash-chain-geschützt — es wird nichts verändert).
- **⚙ SYSTEM** — Systeminfo (RAM/CPU/Uptime), Konfiguration, Datenbank, Backups
  (anlegen/auflisten), Wartungsmodus (503 mit Grund für Besucher, Owner bleibt rein),
  Notfallmodus (restartFailed / STOP ALL), Rate Limits.

## 4) Globale Suche & Sicherheit

- 🔎 oben rechts durchsucht Bot-Sessions, Benutzer, IPs/Sperren (Datensparsamkeit:
  volle IPs nur mit `security.manage`, sonst maskiert).
- Jede **Änderung** (Sperre, Status, Rolle, Rechte, Backup, Wartung, Session-Kills)
  wird über die bestehenden Endpoints auditiert (`audit.jsonl`, z. T. `security.jsonl`).

## 5) Hinweis / bekannte Baustelle (nicht Teil dieses Pakets)

Für Bot-Steuerung nutzt das Control Center die **SessionManager-Endpoints direkt**
(`/api/admin/session-action`, `/api/admin/emergency`) und umgeht damit die
Webmail-`sessionctl`-Queue. Die Legacy-Baustelle „Kanal-Relay/Badge" (Ein-/Ausgehend
mit Live-Abo) bleibt wie besprochen ruhend.

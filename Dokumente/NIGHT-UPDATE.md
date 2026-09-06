# ☾ LoveBot — Night-Update (Stand 2026-09-03)

Neues Night/Neon-System für Web + Login. Läuft lokal unter `public/` und wird
vom bestehenden `server.js` automatisch mit ausgeliefert (Ordner `public/`).

---

## 🌃 Was neu ist

### 1. Webseiten komplett im Nacht-Look
- **Farbwelt:** Hintergrund `#050508`, Panels fast schwarz, Schrift **Neon-Pink `#ff2d95`,
  Türkis `#00f0ff`, Lila `#a855f7`** mit weichem Glow. "90 % dunkel, 10 % leuchtend."
- **Atmosphäre:** Regen-Canvas, Sterne, verschwommene Neon-Orbs, unscharfe Stadt-Silhouette
  am unteren Rand, Vignette, Flacker-Animation auf Überschriften.
- **Mood-System:** `lonely · midnight · empty · nostalgic · dark · hopeful · broken · peaceful`
  — wechselt Akzentfarbe + Stimmungstexte. Automatisch nach Uhrzeit
  (23–04 Uhr = midnight, 04–06 = lonely, …), manuell im Topbar-Chip oder in Settings.
- **Nacht-Uhr:** oben rechts + Sidebar-Footer mit wechselnder Mood-Zeile
  ("nobody is awake anymore…", "stay a little longer.").
- **Nightmode-Schalter:** reduziert Animationen (`nightmode-low`).

### 2. `icon.png` ist jetzt das Gesicht
Aus deiner `icon.png` (1536×1024) generiert, in `public/assets/img/`:

| Datei | Zweck |
|---|---|
| `favicon-32.png` | Browser-Tab |
| `apple-touch-icon.png` | Handy-Startbildschirm |
| `icon-192.png` / `icon-512.png` | PWA / Sharing |
| `logo.png` | Sidebar, Login, Landing, Topbar-Avatar |
| `night-city.jpg` | unscharfer Stadt-Hintergrund (11 KB) |

### 3. Login mit 2FA — erst Code, dann Passwort (`login.html`)
Ablauf in 3 Schritten (Schritt-Anzeige oben in der Karte):

1. **Nummer/JID prüfen** → `/api/check-number`
2. **WhatsApp-Code (2FA)** → `/api/request-code` (purpose `login`) legt eine Mail in
   `Database/webmail.json`; Love.js versendet den Code; die Seite pollt `/api/mailbox/<id>`
   bis `status: sent`. Code 6-stellig, 5 Minuten gültig.
   → `/api/verify-code` (purpose `login`) gibt einen kurzlebigen `loginToken`.
3. **Passwort** → `/api/login` mit `{ number, password, loginToken }`.
   **Ohne gültigen loginToken kein Login — auch für den Owner nicht.**

Ban-Box, Fehler-Meldungen und "Code erneut senden" sind eingebaut.

### 4. Control-Panel als SPA (`app.html`, 20 Seiten)
Sidebar-Gruppen: Overview · Community · Control · System.

| Seite | Inhalt |
|---|---|
| Dashboard | Stat-Kacheln, Live-Feed, Sessions-tonight, Mood-Zeile |
| Live Monitor | CPU/RAM/Heap/Disk + tickende Monitor-Zeile wie `monitor watch` |
| Sessions | Multi-Session-Tabelle (Status, Uptime, Health-Bar), Restart/QR/Stop, **+ New Session** (QR oder Pairing) |
| User | Level/Prestige/XP/Streak/Rolle/Ban-Status/Titel |
| Gruppen | Mitglieder, Admins, Feature-Zähler, Schutz-Pills |
| Love-System | Leaderboard, Love-Level (Newbie → Love Legend), Couples-Statistik |
| Achievements | 💌  💗 ❤️  🌹 👑 mit locked/unlocked |
| Commands | komplette Registry nach Kategorien, mit Permission + Feature-Gate + Status live/geplant |
| Features | alle 14 Gruppen-Features als klickbare Kacheln (`$an`/`$aus`-Hinweis) |
| Broadcast | Text → Webmail-Queue → Love.js sendet an alle Gruppen |
| Logs | Live-Stream mit Filtern: ALL/BOOT/SESSION/MESSAGE/COMMAND/FEATURES/DASHBOARD/LOVE/ERROR |
| Terminal | Browser-Konsole: `help status sessions users logs love mood uptime whoami clear shutdown` — im Night-Wording |
| Security | Threat-Level, Events mit Risk-Score, Schutzschichten, Alert-Regeln |
| Audit | WHO · WHAT · WHEN · WHERE · RESULT |
| Database | Stats, Backup/Export/Validate/Optimize, Backup-Liste |
| Bans / Badwords / Owner | Verwaltung wie vorher, nur im Night-Look |
| System | Node, RAM, CPU, Uptime, Domains (maxichen.de · maxichen.gamebot.me), Restart/GC/Shutdown |
| Settings | Mood, Regen, Nightmode, Prefix, Bot-Name |

### 5. Landing (`index.html`)
Hero mit schwebendem Icon, Gradient-Titel, Mood-Quote, 8 Feature-Kacheln,
Links zu `maxichen.de` und `maxichen.gamebot.me`, Uhr + Datum.

### 6. Befehl-/Feature-Registry (`public/js/night/registry.js`)
Single Source of Truth fürs Web: **74 Befehle** in 8 Kategorien + **14 Features**
(die 12 bestehenden + neu: `night` ☾ und `afk` 😴). Jeder Eintrag hat
`status: 'live' | 'plan'` — das Dashboard zeigt ehrlich, was schon im Bot läuft
und was registriert, aber noch nicht implementiert ist.

---

## 🧪 Testen (Vorschau ohne laufenden Bot)

Wenn `server.js` **nicht** erreichbar ist, schaltet das Frontend automatisch in den
**Demo-Modus** (gelbe Pill unten links) mit realistischen Beispieldaten:

- Nummer: `4915155894714`
- Code: erscheint als Toast (im echten Betrieb per WhatsApp)
- Passwort: `lovebot`

Sobald dein `server.js` läuft, verschwindet der Demo-Modus von selbst —
es wird keine Zeile Code umgestellt.

Lokal starten (nur Vorschau, ohne Bot):

```bash
node tools/preview-server.cjs        # http://localhost:8080
```

Im echten Betrieb: `npm start` wie gehabt — `server.js` serviert `public/` bereits.

---

## ✅ Backend & Bot — umgesetzt (2. Welle)

### `server.js`
- **🔐 2FA-Pflicht für ALLE Logins (auch Owner):**
  `/api/request-code` mit `purpose: 'login'` (Owner nicht mehr ausgenommen),
  `/api/verify-code` gibt kurzlebigen `loginToken` (5 min),
  `/api/login` verweigert ohne gültigen Token — **auch mit richtigem Passwort**.
  Getestet: ohne Code → `401 need2fa`; falsches PW → Fehler, Token überlebt;
  richtiges PW → Session.
- **Rate-Limit** auf Passwort-Fehlversuche (`429` nach 3 Versuchen/10 min) +
  `AUTH_BRUTE_FORCE`-Event.
- **Audit-Trail** `Database/audit.jsonl` — append-only, **hash-chained**
  (jeder Eintrag trägt den sha256 des vorherigen): login.ok/failed/2fa_ok,
  session.*, system.*, config-Änderungen.
- **Security-Events** `Database/security.jsonl` mit Risk-Score:
  `AUTH_2FA_MISSING` (25), `AUTH_FAILURE` (10), `AUTH_UNKNOWN_ACCOUNT` (5),
  `AUTH_BRUTE_FORCE` (40).
- **Neue Endpoints** für das Night-Dashboard: `/api/sessions` (aus Heartbeat),
  `/api/users`, `/api/love`, `/api/database`, `/api/system`, `/api/security`,
  `/api/audit`, `POST /api/session/<act>`, `POST /api/system/<act>`
  (letztere über die Webmail-Queue an Love.js).
- **Security-Header** auf allen Responses: `X-Content-Type-Options`,
  `X-Frame-Options: DENY`, `Referrer-Policy`, CORS bleibt für API-Calls.
- **`HOST`-Default jetzt `127.0.0.1`** (per `HOST=0.0.0.0` überschreibbar).
- **`OWNER_PASSWORD`/`OWNER_NUMBER` aus `.env`** (`process.env.*`), Klartext nur
  noch als dokumentierter Fallback — bitte `.env` anlegen (Vorlage: `env.example`).

### `Love.js` + `night/`
- **`night/terminal.js`:** `logLove()` loggt jetzt im Night-Stil —
  Neon-Tags (pink/cyan/violet nach Kategorie), Mood-Zeile jede 14. Zeile,
  neues Startbanner („☾ waking up… / I was waiting for you."), Nacht-Uhr-Footer.
- **`night/commands.js`:** 17 neue Text-Befehle, datengetrieben:
  `$goodnight $goodmorning $nightquote $mood` (Feature **night**),
  `$lovecalc $flirt $confess $date $romantic $breakup` (Feature **liebe**),
  `$wouldyou $quote $roast` (Feature **fun**) — alle mit Aliases.
- **Direkt in Love.js:** `$profile/$level`, `$leaderboard/$lb/$top`, `$daily`,
  `$streak`, `$achievements/$badges`, `$title`, `$setbio`,
  `$tagall`, `$warn`, `$warnings`, `$lock`, `$unlock`, `$groupinfo`.
- **`GROUP_FEATURES` +2:** `night` ☾ und `afk` 😴 → tauchen automatisch in
  `$an` / `$aus` / `$gi` und im Web-Features-Tab auf (14 Features).
- **`FEATURE_COMMAND_MAP`** erweitert → neue Befehle respektieren die Toggles.

### Offen (bewusst nicht angefasst)
- `Sessions/`, `Database/`, `node_modules/` im Repo + Git-Historie
  → siehe `SECURITY-FINDINGS.md` + `cleanup.sh` (entscheidest du).
- WhatsApp-Gerät abmelden, falls die echte Nummer betroffen ist.
- `ffmpeg`-Dependency entfernen, `LICENSE`-Datei ergänzen.

> Hinweis: Die alten Seiten (`dashboard.html`, `logs.html`, …) liegen unverändert
> weiter in `public/` — nichts wurde gelöscht. Der neue Einstieg ist
> `index.html` → `login.html` → `app.html`.

---

# 🌑 3. Welle — RBAC, Accounts & Rollen (umgesetzt)

## Rollen & Permissions
```
OWNER 👑 › STELLV. INHABER:IN 🔱 › ADMIN ◆ › SUPPORTER ◇ › GROUP ADMIN 🛡 › USER ○   (+ BANNED ⛔)
```
- Permission-Strings statt `if role === 'admin'`: `sessions.control`, `users.ban`,
  `accounts.manage`, `roles.assign`, `logs.export`, `db.restore`, …
- Matrix lebt in `night/rbac.js` — Web UND Bot lesen dieselbe Quelle.
- **Live-Rollen-Sync:** Rollenänderung wirkt sofort auf bestehende Dashboard-Sessions
  (GET /api/me löst die Rolle frisch auf). Account-Lock/Ban widerruft alle Sessions sofort.
- Owner-Schutz: Owner-Rolle nicht per Befehl/API vergeben; Owner-Accounts nicht lockbar
  durch Nicht-Owner.

## Accounts (`Database/accounts.json`)
- **Nur scrypt-Hashes + Salt**, nie Klartext. Temp-Passwort wird **einmal** ausgegeben
  (Web-Response bzw. WhatsApp-PM) und nie gespeichert.
- `mustChange` erzwingt Passwortwechsel beim ersten Login (Web-Modal, nicht schließbar).
- Registrierung: **jeder darf** → Username + Nummer + WhatsApp-Code → Rolle `USER`.
- Login: Username **oder** Nummer → WhatsApp-Code (2FA) → Passwort. Gebannte/gesperrte
  Accounts: `403` + Ban-Box, Security-Event `AUTH_BANNED_LOGIN`.
- Selbst-Verwaltung: `/account` → Profil, Passwort ändern, aktive Sessions,
  „Alle anderen abmelden".
- Team-Verwaltung (Owner/Deputy): `/accounts` → erstellen (Temp-PW einmal sichtbar),
  Rolle setzen (`canAssignRole`-Hierarchie), locken/entsperren.
- Rollen-Matrix-Seite `/roles` zeigt alle Permissions pro Rolle.
- Navigation im Dashboard filtert sich nach Permissions — ein USER sieht nur sein Konto.

## WhatsApp ↔ Dashboard
| Befehl | Wirkung |
|---|---|
| `$setrang <rang> @user` | Owner-only. Rolle setzen, Account auto-erstellen, Temp-PW **privat** zustellen, Gruppenantwort ohne Secrets |
| `$delrang @user` | Rolle → USER, Dashboard-Rechte sofort weg |
| `$rangs` / `$getrang` / `$staff` / `$staffinfo` | Übersichten |
| `$login` (privat) | eigenen USER-Account erstellen/einsehen |
| `$adlogin` (Gruppe) | Gruppen-Admin → Account mit **Scope: nur diese Gruppe** |
| `$ban` (bestehend) | Dashboard-Zugang wird über Login-Check + Session-Revocation gesperrt |

Alles auditiert (`account.create`, `role.change`, `account.lock`, `login.*`,
`password.changed`, `sessions.revoked`) in der hash-chained `Database/audit.jsonl`.

## Getestet (End-to-end gegen server.js)
```
owner 2FA-login                        ✓
account create → tempPassword          ✓ (einmalig sichtbar)
supporter-login mit temp-PW            ✓ role=supporter, mustChange=true
supporter → /api/accounts              ✓ 403
Pflicht-Passwortwechsel (erstlogin)    ✓
role supporter→admin                   ✓ live in derselben Session
account lock                           ✓ Session sofort tot
register (neu) → USER                  ✓
```

---

# 🖥️ 4. Welle — Night Console im Node-Terminal (umgesetzt)

`night/console.js` startet nach erfolgreichem Connect im Bot-Prozess auf stdin —
**dasselbe Vokabular wie das Web-Terminal**:

```
help · ? · find <q> · status · status all · sessions · users · logs [n]
history · health · diagnose · mood · night · theme <name> · whoami
uptime · time · notify [test] · shutdown
```

- Ausgabe im Night-Wording (`☾ I'm still here.`, `♡ everything seems okay.`)
- `theme` speichert nach `Database/console-theme.json`
  (midnight · rain · ghost · neon · violet · cyan · void · bloodmoon · monochrome · minimal)
- `history` liest die hash-chained Audit-Chain
- Read-only: keine destruktiven Aktionen im Terminal ohne Web-/Owner-Flow

---

# 🗺️ Roadmap — Konzepte aus deinem NightOps-Entwurf, noch NICHT umgesetzt

Bewusst offen (jede Stufe einzeln testbar, nichts davon fehlt zum Betrieb):

1. **ProcessManager / PM2-Integration** — `process status|restart|logs`, Crash-Guard,
   Restart-Loop-Circuit-Breaker, `ecosystem.config.js`
2. **Echtes Multi-Session** — mehrere Baileys-Sockets parallel (`Sessions/<name>/`),
   Lifecycle-States, Orchestrator, `newsession/killsession` im Bot-Prozess
3. **Scheduler & Automation-Engine** — `WHEN session.offline THEN reconnect …`,
   Nightly-Backup 01:00, Daily-Digest an Owner
4. **Incident-Center + Forensik-UI** — Events zu Incidents bündeln, Timeline, Export
5. **Anomaly-Detection** — Baseline requests/min, Abweichungs-Alerts
6. **WebSocket-Live-Feed** fürs Dashboard (statt 3-s-Polling)
7. **Plugin-System** — `plugins/` mit manifest, Hot-Reload, Permissions pro Plugin
8. **Ticket-System** für Supporter-Rolle
9. **TOTP-2FA optional** pro Account + Recovery-Codes (zusätzlich zur WhatsApp-2FA)
10. **Backup-Manager** — `backup create/list/restore/verify`, Retention, Nightly-Job

Sag, welche Stufe ich als Nächste bauen soll — ich würde mit **2 (echtes Multi-Session)**
oder **3 (Scheduler + Nightly-Backup + Digest)** anfangen, weil die den größten
sichtbaren Nutzen bringen.

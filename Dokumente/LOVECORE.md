# 💜 LoveCore Engine — Architektur & Betrieb (v1.0)

**Stand:** 10.09.2026 · **Modul:** `loveengine.js` · **Fundament der LoveBot-4.x-Plattform**

LoveCore ist das zentrale Nervensystem: Jede relevante Aktion im System
(WhatsApp **und** Website) erzeugt einen **Event**, der gleichzeitig in
**Audit-Log**, **Security-Log** und **Live-Feed** landet — eine Aktion,
eine Wahrheit, keine divergierenden Werte.

---

## 1. Der EventBus

| Eigenschaft | Wert |
|---|---|
| In-Memory-Ring | 500 Events (Live-Feed) |
| Persistenz | `Database/events.jsonl` (max. 5.000 Zeilen, Rotation) |
| Semantik | **Fire-and-forget** — `emit()` darf niemals werfen oder blockieren |
| Warmup | Beim Server-Start werden die letzten 500 Events aus der Datei geladen |

### Event-Typen (stabile IDs — API & Website hängen daran)

| Event | Ausgelöst durch | Wichtigste Felder |
|---|---|---|
| `XP_GRANTED` | Jede XP-Vergabe (levelsystem.js) | `granted`, `source`, `level`, `bid`, `name` |
| `LEVEL_UP` | Level-Upgrade | `level` |
| `PRESTIGE_UP` | Prestige-Upgrade | `prestige` |
| `COINS_EARNED` | Kupfer-Belohnung | `granted`, `reason` |
| `GAME_WIN` / `GAME_LOSS` | Minigame (loveplus.js) | `xp` |
| `ACHIEVEMENT_UNLOCKED` | Achievement (loveplus.js) | `item` |
| `XP_ADJUSTED` | Owner-XP-Änderung | `delta`, `reason` |
| `USER_BANNED` | Benutzer-Bann (Audit-Kaskade) | `name` |
| `LOGIN_FAILED` | Fehlgeschlagener Login (Audit-Kaskade) | `reason` |
| `SESSION_EVENT` | Session/Rollen-Änderungen (Audit-Kaskade) | `reason` |

### Kaskaden-Prinzip

```
Aktion (z. B. nette Nachricht)
   │
   ├── levelsystem.grantXp()  →  Profil + Wallet (einzige Schreibstelle)
   │       └── emit('XP_GRANTED') + emit('LEVEL_UP') + emit('COINS_EARNED')
   │
   └── server.js: audit()  →  audit.jsonl (hash-verkettet)
           └── Kaskade: emit('USER_BANNED' | 'LOGIN_FAILED' | 'SESSION_EVENT')

Live: /api/live (SSE) pusht alle 3 s { sessions, activity, audit, fleet, events }
```

> **Zentraler Audit-Hook:** `audit()` in `server.js` kaskadiert bestimmte
> Audit-Aktionen automatisch als Live-Events. Neue Kaskaden dort ergänzen —
> niemals in einzelnen Routen.

## 2. APIs (Owner-Center)

| Endpoint | Recht | Funktion |
|---|---|---|
| `GET /api/xp` | `xp.view` | XP-Statistik (Lifetime, 24 h, Quellen, Top 15) + Level-Tabelle (50 Level) |
| `POST /api/xp/adjust` | `xp.adjust` ⚠️ kritisch | XP vergeben/abziehen — **Grund Pflicht** (≥ 5 Zeichen), Step-up-Passwort in der UI, `xp.adjusted` im Audit, `XP_ADJUSTED`-Event |
| `GET /api/health` | Admin | Komponenten-Check: WhatsApp-Heartbeat, Web, DB+Backups, Sessions, Media-Jobs, Security |
| `GET /api/live` | — (SSE) | Live-Payload inkl. `events` (LoveCore) |
| `GET /api/security/rules` | `security.view` | WEB-REQ-07-Regel (Version, Parameter, Stufen, aktive Zähler, Historie) |
| `POST /api/security/rules` | `security.manage` ⚠️ kritisch | Regel ändern — Step-up + `security.rules.changed` im Audit + Versionierung |

### XP-Adjust — Regeln

* Positive Deltas laufen **durch die Level-Engine** (Level-Ups + Kupfer möglich).
* Negative Deltas reduzieren **nur XP** (keine Quellen-Buchung), **kein
  Level-Down** (konservativ, bewusst dokumentiert).
* Delta-Grenze: ±10.000.000.
* Jede Änderung: `xp.adjusted` (Audit) + `XP_ADJUSTED` (Event) + UI-Feedback.

## 3. Konfigurierbare WEB-REQ-07 (Request-Flut-Regel)

Die Reload-/Request-Flut-Erkennung ist **nicht hart im Code**, sondern in
`Database/security-rules.json` hinterlegt (wird beim ersten Start mit Defaults
angelegt) und im Owner-Center unter **SICHERHEIT → Auto-Regeln** änderbar.

```json
{
  "version": 1,
  "webReqFlood": {
    "id": "WEB-REQ-07",
    "enabled": true,
    "threshold": 50,          // > N Anfragen einer IP …
    "windowSec": 10,          // … im N-Sekunden-Fenster = 1 Verstoß
    "violationDecayMin": 30,  // Verstöße verjähren nach N Min ohne Vorfall
    "tiers": [
      { "atViolations": 2, "action": "TEMP_BLOCK", "blockMin": 5 },
      { "atViolations": 4, "action": "LONG_BLOCK", "blockMin": 60 },
      { "atViolations": 6, "action": "PERM_BLOCK", "blockMin": 0 }
    ]
  }
}
```

* **Ablauf:** 1. Verstoß = nur Warnung (Security-Event `ABUSE_BURST_DETECTED`,
  mit `rule: "WEB-REQ-07"`), danach Eskalation über die Stufen.
* **Änderung:** Step-up-Passwort + Grund + Audit (`security.rules.changed`) +
  Versionsbump; die letzten 10 Versionen bleiben in `history` (Rückführbar).
* **Wirkung:** sofort, ohne Neustart (Regel wird pro Anfrage gelesen).
* `enabled: false` schaltet die Regel komplett ab (Warnung im Center sichtbar).

## 4. Owner-Center-Ansichten (SOUL ECHO, `public/control.html`)

| Ansicht | Recht | Inhalt |
|---|---|---|
| `#/dash` | — | + XP-Statistik-Kachel + **Live-Aktivitäts-Feed** (SSE, 3-s-Takt) |
| `#/xp` | `xp.view` | Statistik, Top-Nutzer, XP-Quellen, Level-Tabelle, **XP-Admin** (nur `xp.adjust`) |
| `#/economy` | `economy.view` | Kupfer-Gesamt, Top 10 reichste Nutzer, Top-Paare, Pet-Verteilung |
| `#/games` | `games.view` | Games 24 h, Achievements (Lifetime), Pet-Zähler, Game-System-Referenz |
| `#/health` | `system.view` | Komponenten-Health (WhatsApp/Web/DB/Sessions/Media/Security) |
| `#/autoRules` | `security.view` | + **WEB-REQ-07-Konfigurator** (Schwellwert, Fenster, Verjährung, Stufen, An/Aus) |

## 5. Neue Berechtigungen (RBAC)

| Recht | Kategorie | Kritisch | Deputy | Admin |
|---|---|---|---|---|
| `xp.view` | XP & Level | — | ✓ | ✓ |
| `xp.adjust` | XP & Level | ⚠️ | ✓ | — |
| `economy.view` | Economy | — | ✓ | ✓ |
| `economy.adjust` | Economy | ⚠️ | ✓ | — |
| `games.view` | Games | — | ✓ | ✓ |

Neue Vorlagen: `xp_moderator` (⭐ XP + Nutzer-Einsehen), `economy_viewer`
(💰 Read-only Economy/XP/Games).

## 6. Grenzen & bekannte Einschränkungen

* **Event-Fenster:** 24-h-Statistiken (XP heute, Level-Ups …) stammen aus dem
  Event-Ring/`events.jsonl` (5.000 Zeilen). Bei sehr hoher Aktivität kann das
  Fenster kürzer als 24 h sein; Lifetime-Werte (Gesamt-XP, Quellen) kommen
  immer aus den Profilen und sind exakt.
* **Kein Level-Down** bei negativer XP-Änderung (bewusste Entscheidung).
* `XP_ADJUSTED`-Events zeigen Name + Delta; der **Grund** liegt im
  Audit-Log (Datenschutz: Grund nicht in jedem Live-Feed mitschleppen).
* Der EventBus ist prozesslokal (kein Cluster-Messaging) — passt zum
  Single-Node-Betrieb des Bots.

## 7. Dateien

| Datei | Rolle |
|---|---|
| `loveengine.js` | EventBus, Ring-Buffer, `events.jsonl`, XP-Stats, Level-Tabelle |
| `levelsystem.js` | Emittiert XP_GRANTED / LEVEL_UP / PRESTIGE_UP / COINS_EARNED |
| `loveplus.js` | Emittiert GAME_WIN / GAME_LOSS / ACHIEVEMENT_UNLOCKED |
| `server.js` | `/api/xp`, `/api/xp/adjust`, `/api/health`, `/api/live` (+events), `/api/security/rules`, Audit-Event-Kaskade |
| `night/rbac.js` | Neue XP/Economy/Games-Rechte + Vorlagen |
| `public/js/cc-xp.js` | Owner-Ansichten XP/Economy/Games/Health + Live-Feed-Helper |
| `public/js/cc-sys.js` | WEB-REQ-07-Konfigurator (Auto-Regeln) |
| `Database/events.jsonl` | Event-Persistenz (rotierend) |
| `Database/security-rules.json` | WEB-REQ-07-Regel (versioniert) |

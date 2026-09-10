# LOVE BOT 5.0 — DIE SPEZIFIKATION
### „The Love Progression Engine" — zusammenhängende Architektur, keine Feature-Liste

**Stand:** 2026-09-10 · **Basis:** LoveBot-Codebase (Commit-Basis Phase 2, Progression 2.0 umgesetzt)
**Prinzip:** *One Source of Truth* — WhatsApp & Website lesen/schreiben dieselben Engines. Kein zweites Datenmodell.
**Position:** Private Hobby-Plattform. **Keine** Zahlungsstufen, kein Premium. Fortschritt ist pure, virtuelle Währung der Aufmerksamkeit.

---

## 0. ARCHITEKTUR-INSELN (und wie sie zusammenhängen)

```
 WhatsApp (Baileys) ──▶ Love.js (Bot-Hirn) ──┬─▶ levelsystem.js   (XP/Learn/Reward-Engine)
                                             ├─▶ loveplus.js      (Pets/Paare/Achievements)
                                             ├─▶ loveengine.js    (Event-Bus SOUL ECHO)
                                             ├─▶ notifications.js (Notification-Center)
                                             └─▶ Database/        (Profile, xp-rules, notifications)
 Web (server.js :7777) ───┬─▶ control.html  (Owner-Center, 12 Views)
                          ├─▶ level.html    (Public: Level/Leaderboard)
                          ├─▶ notifications.html (User: Benachrichtigungszentrale)
                          └─▶ public/js/cc-*.js (Owner-Views)
```

**Datenfluss-Regeln:**
1. Jede XP-Änderung geht durch `grantXp()` — ein einziger Trichter. Damit: 1× Audit-Event, 1× Level-Up-Check, 1× Notification, 1× xpLog-Eintrag.
2. Der Event-Bus (`loveengine.emit`) ist das Gedächtnis: `XP_GRANTED`, `LEVEL_UP`, `PRESTIGE_UP`, `ACHIEVEMENT_UNLOCKED`, `COINS_EARNED`, `GAME_WIN/LOSS`, `MEDIA_JOB_DONE`, `SECURITY_EVENT`. Website (`/api/live`, SSE) und Owner-Center (Live-Feed) konsumieren dasselbe.
3. Regeln sind **Daten, nicht Code**: `Database/xp-rules.json` — änderbar im Owner-Center (⭐ XP & Level → XP-Regeln), versioniert, auditiert, mit Step-up.

---

## 1. DATENMODELL

### 1.1 User-Profile (`Database/LoveUser/<bid>/<bid>.json`)

```jsonc
{
  "identity": { "bid": "49…@s.whatsapp.net", "lid": "…" },
  "registration": { "registered": true, "name": "…" },
  "status": { "dsgvo": { "accepted": true, "acceptedAt": "…" } },

  "progression": {
    "level": 7, "prestige": 0, "xp": 340, "totalXp": 5230,
    "xpSources": { "messages": 1200, "commands": 900, "love": 400,
                   "dailies": 500, "work": 100, "games": 300,
                   "compliments": 480, "media": 25, "admin": 0 },
    "streak": 12, "lastActiveDay": "2026-09-09",
    "streaks": {                                // Progression 2.0: drei getrennte Streaks
      "daily": { "c": 17, "last": "2026-09-09" },  // 📅 mindestens 1 Aktion pro Tag
      "chat":  { "c": 5,  "last": "2026-09-10" },  // 💬 aktive Chat-Beteiligung
      "xp":    { "c": 3,  "last": "2026-09-10" }   // ⭐ an XP-Tagen
    },
    "xpWindow": [{ "t": 175…, "a": 15, "s": "msg" }],   // Rolling 1h (Anti-Farm)
    "recentMsgs": [{ "h": 1823…, "t": 175… }],          // djb2-Hashes, KEINE Texte (DSGVO)
    "xpLog": [{ "a": 15, "s": "messages", "m": 1.25, "ok": true,
                "t": "2026-09-10T16:40:12Z", "af": null }],  // ≤ 40 Einträge, retention
    "xpDaily": [{ "d": "2026-09-10", "a": 78 }],          // ≤ 35 Tage
    "unlocks": { "5": "🏆 Sweetheart", "10": "🖼️ Profil-Rahmen" }
  },

  "flags": {
    "media": { "first": 175…, "providers": { "tiktok": 175…, "youtube": 175… },
               "day": "2026-09-10", "count": 2 }
  },
  "stats": { "compliments": { "day": "2026-09-10", "count": 2 }, "socialBond": 14,
             "games": { "wins": 3, "losses": 1 } },
  "notifications": { "levelup": true, "daily": true, "economy": false },  // Prefs

  /* loveplus: pets, couple, achievements, coins (Kupfer), … */
}
```

### 1.2 XP-Regel-Store (`Database/xp-rules.json`) — versioniert

```jsonc
{
  "version": 3, "updatedAt": "…", "updatedBy": "owner",
  "multipliers": {
    "weekend": 1.25, "event": 1.0, "eventActive": false,
    "prestigePerLevel": 0.05, "prestigeCap": 0.5
  },
  "categories": {
    "message":    { "enabled": true, "oneToOne": 5, "group": 3,
                    "kindMult": 2, "loveMult": 3, "complimentBonus": 5 },
    "command":    { "enabled": true, "base": 2, "loveAction": 5 },
    "compliment": { "enabled": true, "sender": 8, "recipient": 5,
                    "cooldownSec": 300, "dailyCap": 30 },
    "game":       { "enabled": true, "win": 15, "loss": 2 },
    "daily":      { "enabled": true, "daily": 50, "dailylove": 25, "work": 10 },
    "media":      { "enabled": true, "firstDownload": 15, "firstProvider": 10,
                    "dailyCap": 3 }
  },
  "antiFarm": {
    "msgCapPerHour": 300, "cmdCapPerHour": 150,
    "duplicateWindowSec": 45, "duplicateMaxPerDay": 5,
    "mutualFarmMaxPerHour": 6, "suspiciousXpPerDay": 1500
  }
}
```

### 1.3 Notifications (`Database/notifications.json`)
`{ [bid]: [ { id, type, title, data, read, ts } ] }` — max. 40 je Nutzer, trimmend.
11 Typen: `levelup, achievement, quest, daily, streak, economy, gift, game, media, group, security` (jeder mit Icon + Default-Prefs).

### 1.4 Was **NICHT** gespeichert wird (Art. 5 DSGVO)
- Kein Nachrichten-**Text** — nur djb2-Hash (Duplikat-Erkennung), Typ, Betrag, Zeitstempel.
- Keine IP-/Security-Daten öffentlich. Webhooks ohne Passwörter/Token.
- Retention: xpLog ≤ 40, xpDaily ≤ 35 Tage, notifications ≤ 40 — bewusst, dokumentiert, nie erfunden.

---

## 2. XP-FORMELN (exakt, wie implementiert)

```
base = Kategorie-Wert × Qualitäts-Multiplikator (normal 1× · nette 2× · love 3×)
     + Bonus (z. B. Kompliment in Nachricht +5)
granted = base × Multiplikatoren   →   Anti-Farm-Prüfungen   →   grantXp()
```

**Multiplikatoren (multiplikativ):**
`weekend (Sa/So 1.25×) × event (2.0× wenn aktiv) × (1 + min(prestigeCap, prestige × 0.05))`

**Anti-Farm-Kette (jede Prüfung schreibt den Grund ins xpLog):**
1. **Duplikat**: gleicher (normalisierter) Text im 45s-Fenster → `0 XP, duplicate`; >5×/Tag → `duplicate-day`.
2. **Hourly-Cap**: XP-Fenster 1h (Nachrichten 300, Commands 150).
3. **Richtungs-Cooldown**: A→B Kompliment alle 300s.
4. **Mutual-Farm**: A→B→A-Ping-Pong ≤6/h, sonst Flag `farmSuspect` (Owner-Abuse-Center).
5. **Daily-Cap** pro Kategorie (Komplimente 30, Media-Events 3, …).
6. **Suspicious-Spike**: >1500 XP/Tag → `suspiciousXp`-Zähler (Owner-Statistik rot).

**Kategorien-Tabellen** (Defaults, alles über Rules-UI änderbar):

| Kategorie | Base | Besonderheit |
|---|---|---|
| Nachricht 1:1 | 5 | ×2 nette, ×3 love, +5 Kompliment-Bonus |
| Nachricht Gruppe | 3 | Community-Beitrag |
| Command | 2 | Love-Actions +5 |
| Kompliment | 8 / 5 | Sender / Empfänger, Cooldown, Bond +1 |
| Game Sieg / Niederlage | 15 / 2 | nur echte Spiele |
| $daily / $dailylove / $work | 50 / 25 / 10 | einmal/Tag |
| Media first-download / neuer Provider | 15 / 10 | max. 3 Events/Tag |
| Download→XP generell | — | **nur** über Quests/Erstmal-Ereignisse, nie pro Download |

**Level-Kurve:** Basis 743 XP × 1.00743/Level, 744 Level/Prestige-Zyklus.
Copper-Belohnung pro Level-Up: `20 + 5·level`.

---

## 3. XP-EVENT-LOG & OWNER-SICHT (Warum hat jemand XP?)

Jedes `grantXp` schreibt: `{amount, source, multiplier, antiFarm-Status, ts}`.

**Owner-Center ⭐ XP & Level** (`control.html` → `cc-xp.js`):
- Stat-Grid: XP gesamt, XP 24h, Level-Ups 24h, Prestige-Ups 24h, **Anti-Spam-Cap aktiv (rot)**, Games 24h.
- **XP-Quellen** (Lifetime, %-förmig sortiert) — der „Source Chart".
- **Top-Nutzer** (Rang/Prestige/Level/XP) — inkl. Suchfeld.
- **Live-Event-Feed** (SSE `/api/live`): XP granted, Level-Up, Achievement, Media-Done …
- **XP anwenden/abziehen** (kritisch): Grund + Passwort (Step-up) + Audit `xp.adjusted`; negatives Delta reduziert nur XP, **kein** Level-Down.
- **XP-Regeln (Progression 2.0)**: alle Kategorien/Multiplikatoren/Anti-Farm-Grenzen editierbar → Grund + Passwort + Audit `xp.rules.changed` + Versionierung. Gilt sofort für alle Pfade.
- **XP Abuse Center** (Phasen-Flag): verdächtige Nutzer (XP/h, Spike-Flags) mit Review/Ignore/Limit/Reset — auditiert. *(Auto-Maßnahmen vorsichtig & erklärbar; kein stummer Ban.)*

---

## 4. COMMANDS (WhatsApp)

### 4.1 Progression (neu/erweitert in 2.0)

| Command | Funktion |
|---|---|
| `$xp` / `$level` | Aktuelles XP, Level, Fortschritt %, **heute/woche**, **3 Streaks** (🔥📅·💬chat·⭐xp), **aktiver Multiplikator**, freigeschaltete Belohnungen |
| `$rewards` | Level-Rewards & Meilensteine: ✓ freigeschaltet / 🔒 nächste Unlocks |
| `$streak` | Drei Streaks detailliert + Warnung, wenn eine heute droht |
| `$notif` | `Liste` aller Benachrichtigungs-Typen + Toggle `$notif <typ> [an|aus]` (wird in das Profil geschrieben, gilt sofort) |
| `$daily` / `$dailylove` | Regelgesteuert (Rules-UI), einmal/Tag, mit Notification + Love-Paar-Bonus |
| `$compliment <user>` | **Social XP Layer**: Sender +8, Empfänger +5, ❤️ Social Bond +1, Cooldown + Mutual-Farm-Schutz; Social-XP-Nachricht an beide |
| `$play <url> [audio|video|info|thumb|best]` | **Universal Media Router** (s. §5) |
| `$rank`, `$me`, `$achievements`, `$media` | Profil-Karten (Phase 2 bereits vorhanden; $media zeigt Play-Hilfe) |

### 4.2 Level-Up als EVENT (nicht Nachricht)
- **Große Karte** im Chat: Level, neuer Titel, Copper-Belohnung, Bonus-XP, neue Unlock-Meilensteine.
- **Mega-Level-Up** (5/10/20/30/50/100): Special-Karte mit Reward-Icon + WhatsApp-Format-Emphase.
- Meilensteine-Rewards (Rules-unabhängig, dokumentiert): 5 🏆 Sweetheart · 10 🖼️ Profil-Rahmen · 20 💞 Romantiker · 30 ⭐ Elite · 50 🎖️ Master · 100 ♾️ Eternal.
- **Prestige ab 100** (Phase 6): Zyklus neu (Level 0, Prestige +1) — **Lifetime-XP, Achievements, Titles, xpLog bleiben**; Season-Level separat.

---

## 5. $PLAY — UNIVERSAL MEDIA ROUTER

**Pipeline (non-blocking Media-Jobs):**
```
Input → Analyzer (URL?) → Provider-Detection → Capability-Check
     → Media Job (Queued→Analyzing→Processing→Completed/Failed)
     → Download/Convert/Stream → senden → Cleanup
```

**Provider-Adapter:** jeder Provider deklariert Capabilities
`{ supportsDownload, supportsAudio, supportsVideo, supportsThumbnail, supportsMetadata, requiresAuth }`.
**Legitimitäts-Check pro Operation:** `kann dieser Vorgang legal & ohne Login-Wall/DRM-Bypass?` → JA: verarbeiten · NEIN: höfliche Ablehnung mit Erklärung.
**Snapchat:** nur offizieller OAuth/Creative-Kit-Zugang, sonst Ablehnung. **Kein** universeller Downloader.

**Subcommands:** `<url> [audio|video|info|thumb|best]`
- `info`: Metadaten-Karte (Titel/Duration/Provider/Capabilities)
- `best`: beste legale Option automatisch

**Job-Status im Chat:** Queued → Analyzing → Processing → ✅ Completed / ❌ Failed (mit Grund). Nicht blockierend — Nutzer kann weiter schreiben.

**Auto-Media-Cleanup:** nach Versand + Retention-Timer (nicht „ewig"). Media-Library + History in der Website (Phase 6: eigener Tab).

**XP-Regel:** Downloads erzeugen **kein** pro-Download-XP. Nur: first-download +15, neuer Provider +10 (max. 3 Events/Tag), später: Daily-Media-Quest +50 (Phase 6).

---

## 6. NOTIFICATION-SYSTEM

**Prinzip:** Fire-and-forget, respektiert Prefs, max. 40 je Nutzer.

| Typ | Icon | Trigger |
|---|---|---|
| levelup | ⬆️ | jedes Level-Up (mit Reward) |
| achievement | 🏆 | Achievement/Meilenstein |
| quest | 🎯 | Quest-Fortschritt/-Abschluss (Phase 6) |
| daily | 📅 | Daily-Bonus wartet |
| streak | 🔥 | Streak-Update, Droh-Warnung |
| economy | 🪙 | Zahlungen, Transfers |
| gift | 🎁 | Geschenke |
| game | 🎮 | Turniere/Events (Phase 4/5) |
| media | 📺 | $play-Job fertig/fehlgeschlagen |
| group | 👥 | Gruppen-Level, Community-Events |
| security | 🛡️ | Sperrungen, IP-Wechsel (empfohlen AN) |

**Oberflächen:**
1. **WhatsApp**: in-Chat-Karten (Level-Up als Event, s. §4).
2. **Website**:
   - 🔔 **Bell oben rechts** auf allen Seiten (unread-Zähler, Live-Refresh)
   - **`/notifications.html`**: Zentrum — Liste (Klick = gelesen + Link zur relevanten Seite), „alle gelesen", **Einstellungen pro Typ** (Schalter), Auto-Refresh 30s.
3. **Web Push mit Consent** (Phase 7, erst nach Browser-Bestätigung).

**API:** `GET /api/notifications` (Liste+Prefs+Typen) · `POST /api/notifications/read` (id/all) · `POST /api/notifications/prefs`.

---

## 7. PERMISSION-MATRIX (Thinkproject-Prinzip, nicht Design)

**Kette:** `User → Group → Role → Permission → Resource → Action`

**XP-Rechte (relevant hier):**
| Recht | Liest | Ändert | Schritt-up? |
|---|---|---|---|
| `xp.view` | Statistik, Top, Rules (read-only) | — | nein |
| `xp.adjust` | + | XP +/-, **XP-Regeln** | ja: Grund + Passwort + Audit |
| `xp.audit` | + | — (nur Audit-Logs) | nein |

**Kritische Aktionen** (immer Step-up: Code/Passwort + Grund + Audit): permanente Löschung, Owner-Rollenwechsel, Security-Regeländerung, Maintenance, Massen-Berechtigungen, XP-Regeländerungen, XP-Manipulationen.

**Vier separate Ebenen (niemals vermischen):**
`Level ≠ Game-Rang ≠ Staff-Rolle ≠ Gruppenrolle`

**Activity Score:** %-basiert pro Domäne (Chat 34%, Games 22%, …) — **kein** Staff-Rang.

---

## 8. WEBSITE-NAVIGATION (komplett)

**Public (Login-frei):**
```
/ (Landing/Plattform-Start) · /level.html (Level-System + Leaderboard)
/status.html (System + Impressum-Status) · /impressum.html · /datenschutz.html
```

**User (Login: WhatsApp-Code + Passwort):**
```
/level.html (persönlich) · /games.html · /economy.html
/notifications.html (🔔 Zentrum + Prefs)
```

**Owner-Center (`/control.html`, Gate: Admin-Passwort, 12 Views):**
```
📊 Executive Dashboard · 👥 Benutzerakte 2.0 (12 Tabs)
🌳 Rechte-Matrix · 🧩 Feature-Registry (12 Module)
⭐ XP & Level (Statistik · Live-Feed · XP-Admin · ️ XP-Regeln)
💰 Economy · 🎮 Games · ❤️ Health (SOUL ECHO)
📡 Alerts · 🗺️ Roadmap · 🛡️ Security · 🖥️ System
```

**Design-Sprache:** User-Bereich dunkles Violett/Pink (Love-Branding), Owner-Bereich dunkler Graphit + Violett. Thinkproject nur als **Bedienprinzip** — eigenes Design bleibt.

---

## 9. WAS IN WELCHER PHASE (Konsens mit Roadmap)

| Phase | Inhalt | Status |
|---|---|---|
| 2.0 | XP-Regel-Engine, 3 Streaks, Social XP Layer, Media-XP, Notification-Center + Website, Owner-Rules-UI | ✅ **umgesetzt** |
| 3 | Games-Expansion + Game-XP-Regeln | offen |
| 4 | Quests (5 daily / 5 weekly, +500 XP +250 Coins +Badge) | offen |
| 5 | Turniere + Economy-XP-Selektion | offen |
| 6 | Prestige (ab 100), Season-Level, Pet-XP, Media-Library, XP Abuse Center | offen |
| 7 | Web Push (mit Consent), Group-Level/Top Communities, Community-Events | offen |
| 8 | Subdomain-Ökosystem (technisch ab jetzt ein System) | offen |

**Niemals:** echte Zahlungsmittel, Premium-Tiers, erfundene Retention-Zeiträume, automatische Bans ohne Erklärung.

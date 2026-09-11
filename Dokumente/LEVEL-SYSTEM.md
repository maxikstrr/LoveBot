# 💜 LoveBot — Level-System v3.0 (Dokumentation)

> Stand: 10.09.2026 · Modul: `levelsystem.js` · Anbindung: `Love.js` + `loveplus.js` + `server.js`
> Website: `public/level.html` (Detailseite), `public/index.html` (Vorschau-Sektion)

Das Level-System ist das zentrale Fortschrittssystem des Bots. Es ist **losgekoppelt** (eigene Datei, kein
Import aus `Love.js`), damit es getestet und wiederverwendet werden kann — im selben Stil wie `lovecore.js`
und `loveplus.js`.

---

## 1. Kernprinzipien

1. **Alles zählt — aber fair:** XP kommt aus echten Aktionen (Nachrichten, Befehle, Dailies, Spiele).
2. **Nettes Verhalten zahlt sich aus:** Nette/Liebesnachrichten geben bis zu **×3 XP** — das System belohnt
   genau das, was LoveBot ausmacht.
3. **Nichts wird erfunden:** Keine Zufalls-XP, keine Fantasie-Werte. Jede Zahl ist nachvollziehbar
   (XP-Quellen-Zähler im Profil).
4. **DSGVO-gated:** XP wird **nur** für Profile vergeben, die registriert sind **und** per
   `$dsgvo accept` zugestimmt haben (`xpEligible()` in `levelsystem.js`).
5. **Anti-Spam:** Gleitendes 60-Minuten-Fenster begrenzt XP-Quellen (siehe §5).

---

## 2. XP-Quellen (einzige Wahrheit: `XP`-Objekt in `levelsystem.js`)

| Quelle | XP | Anmerkung |
|---|---|---|
| Nachricht (1:1-Chat) | **+5** | jede Textnachricht ohne Präfix |
| Nachricht (Gruppe) | **+3** | halber Einsatz = Anti-Farm-Schutz |
| Nette Nachricht | **Basis ×2** | 1–2 Treffer in der Liebes-Wörter-/Emoji-Liste |
| Liebesnachricht | **Basis ×3** | 3+ Treffer |
| Kompliment-Muster | **+5 Bonus** | z. B. „du bist so schön / toll / sweet …" |
| Jeder Befehl | **+2** | jeder `$befehl` (auch in Gruppen) |
| Liebes-Aktion | **+5** | `$kiss`, `$hug`, `$compliment`, `$letter`, … (alle aus `LOVE_ACTIONS`) |
| `$daily` | **+50** | einmal pro Tag, Level-Ups möglich |
| `$dailylove` | **+25** | + 50 Kupfer (aus lovecore) |
| `$work` | **+10** | + Kupfer aus dem Arbeitsjob |
| Spiel-Sieg | **+15** | `$hangman`, `$riddle`, `$rob` (Erfolg) |
| Spiel-Niederlage | **+2** | Trost-XP, damit Verlierer nicht leer ausgehen |
| Erste Aktion des Tages | **+10** | einmal/Tag, nur organische Quellen (kein Doppel-Dip auf Dailies/Admin) |
| Streak 7 / 30 / 100 Tage | **+50 / +200 / +1000** | beim Überschreiten der Marke, automatisch |
| Streak-Multiplikator | **+5 % / +10 % / +25 %** | ab 3 / 7 / 30 Tagen Serie, gedeckelt (Cap +25 %) |

### Belohnungen

| Ereignis | Belohnung |
|---|---|
| Level-Up | **20 + 5·Level Kupfer** (max. 400) + Ankündigung im Chat |
| Prestige-Up | **+10.000 Kupfer** + Prestige-Titel + große Ankündigung |
| Meilenstein L5/10/20/30/50/100 | **100/250/500/1000/2500/5000 Kupfer** + Titel/Cosmetics-Label |

---

## 3. Progressions-Kurve (identisch zur SQL-Referenz)

- Basis: **743 XP** für Level 0 → 1
- Jedes Level: **×1.00743** (`ceil(prev · 100743 / 100000)`, BigInt-Arithmetik)
- **744 Level pro Prestige-Zyklus** (Level 0–743). Danach: Prestige +1, Level zurück auf 0,
  Kurve geht weiter (kein Reset auf 743 — die Kurve ist durchgehend, exakt wie
  `neededXpForLvOrPrestigeUp.sql`).
- Maximal: Prestige 743 + Level 743 (dann bleibt die XP-Leiste auf 100 % „MAX" stehen).

Referenzwerte:

| Meilenstein | XP (bis dorthin) |
|---|---|
| Level 1 | 743 |
| Level 2 | 1.492 |
| Level 10 | 8.503 |
| Level 50 | 55.459 |
| Level 100 | 136.450 |
| Level 743 (Zyklus-Ende) | ≈ 4,94 Mrd. |
| Prestige 1 · Level 1 | 199.419 (Zyklus-Beginn) |

### Streak

Jeder Kalendertag mit mindestens einer XP-Vergabe zählt: `progression.streak`. Gestern aktiv → +1,
sonst neu bei 1. Sichtbar in `$level`, Bestenliste und auf der Website.

---

## 4. Ränge & Prestige-Titel

### Level-Ränge (innerhalb eines Zyklus)

| Level | Rang |
|---|---|
| 0 | 🐣 Neuling |
| 5 | 🌱 Einsteiger |
| 10 | 🌸 Herzling |
| 25 | 🌷 Flirter |
| 50 | 💕 Romantiker |
| 75 | 💌 Liebespoet(in) |
| 100 | 🌹 Rose des Herzens |
| 150 | ❤️ Herzensbrecher(in) |
| 200 | 🔥 Flammenherz |
| 300 | ⚡ Liebesblitz |
| 400 | 🌟 Liebesstern |
| 500 | 👑 Herzfürst(in) |
| 600 | 🎩 Love-Magnat |
| 700 | 💎 Legende des Herzens |
| 743 | 💖 Mythisch |

### Prestige-Titel (bleiben nach jedem Zyklus sichtbar)

| Prestige | Titel |
|---|---|
| 1 | 🕊️ Herzengel |
| 2 | 🌹 Rosenritter(in) |
| 3 | 💜 Liebe-As |
| 4 | 🌙 Stern der Liebe |
| 5 | 🌌 Love-Mythos |
| 6+ | ✨ Unsterbliches Herz |

---

## 5. Anti-Spam (gleitendes 60-Minuten-Fenster)

| Quelle | Obergrenze |
|---|---|
| Nachrichten (inkl. nette/Liebe) | **300 XP/Stunde** |
| Befehle | **150 XP/Stunde** |
| Dailies, Arbeit, Spiele | keine Grenze (eigene Cooldowns) |

Das Fenster liegt pro Nutzer in `progression.xpWindow` (Einträge `{t, a, s}`, älter als 60 Min. werden
automatisch verworfen, max. 400 Einträge). Wer das Cap erreicht, bekommt 0 XP aus der Quelle —
der Bot meldet das **nicht** (kein Hinweis auf die Limitierung, kein Spam darüber).

**Nachrichten-Cooldown (seit 10.09.2026):** Zusätzlich gibt es `antiFarm.msgCooldownSec`
(Standard **60 s**, änderbar in `Database/xp-rules.json`): Nachrichten-XP gibt es nur alle
X Sekunden — gespeichert in `progression.lastMsgXpAt`. Der Cooldown begrenzt **nur die
XP-Vergabe**, Chatten bleibt unbegrenzt möglich (Rückgabe `skipped: 'cooldown'`).

---

## 6. Neue & geänderte Befehle

| Befehl | Was |
|---|---|
| `$xp` | Kompakt-Status: Level, Balken, Titel, Heute/Woche/Monat, Lifetime + letzte 3 XP-Ereignisse |
| `$level` / `$lvl [@user]` | Volles Profil (jetzt inkl. **Titel, Zeiträume, Badges, Rekord-Streak**) — mit `@user` fremde Profile |
| `$rank` / `$rang [@user]` | Rang + **globaler Platz (#n/N)**, Titel, Lifetime-XP |
| `$top … [level\|xp\|weekly\|monthly\|group]` | Filter: Standard, Lifetime-XP, Wochen-/Monats-XP, Gruppen-Rangliste (XP bleibt global) + eigener Platz |
| `$me` / `$profile` | Alle Karten mit **💜 Fortschritt**: Rang, Titel, Badges, Zeiträume, Streak, Aktivitäts-Stats |
| `$achievements` / `$badges` | **Echte Sammlung aus loveplus (32 Stück)** statt der alten 7er-Anzeige |
| `$daily` | Unverändert +50 XP — aber jetzt **mit Level-Logik** (Level-Ups können direkt im Daily passieren) |
| `$work` | Jetzt +10 XP (neben Kupfer) |
| `$dailylove` | +25 XP läuft jetzt durch die Level-Engine (Level-Ups möglich) |
| `$hangman` / `$riddle` / `$rob` | Sieg +15 XP, Niederlage +2 XP — Level-Ups werden im Spiel-Resultat gefeiert |

### Neue Achievements (loveplus, 9 neue)

Level 10 🌸 · Level 25 🌷 · Level 50 💕 · Level 100 🌹 · Level 250 🔥 · Level 500 👑 ·
Prestige 1 🕊️ · Prestige 2 🌹 · Prestige 3 💜

### Weitere Achievements (Progression 3.0, 10 neue — 32 gesamt)

Nachrichten 💬 (100 / 1.000 / 10.000) · Befehle ⚙️ (100 / 1.000) · XP Lifetime ✨
(10.000 / 100.000) · Spielsiege 🏅🏆 (10 / 100) · Komplimente 🌹 (50) —
alle aus **echten Profil-Zählern**, Prüfung nach jeder XP-Vergabe.

---

## 7. Nette-Nachrichten-Erkennung

- **Vollständig lokal** im Bot-Prozess (keine KI, keine externe API, keine Cloud).
- ~50 deutsche Liebes-Wörter/Phrasen + 20 Herz-Emojis; Muster „du bist so …" für den Kompliment-Bonus.
- **Wichtig (DSGVO):** Es wird nur der XP-Wert + Quelle gespeichert — **niemals der Nachrichtentext**.
  Die Erkennung liest den Text flüchtig im Arbeitsspeicher aus und vergisst ihn.

---

## 8. Technische Anbindung

### `Love.js`
- **Import** oben: `grantLevelXp, applyMessageXp, applyCommandXp, xpEligible, ensureProgression, levelUpAnnounce, prestigeAnnounce, profileCard, rankLine, topProgression`
- **Nicht-Befehl-Nachrichten:** XP-Hook in dem Ast `if (!trimmed.startsWith(pref))` — Sender auflösen,
  Profil laden, `applyMessageXp()`, bei Level-Up Ankündigung, `saveUserProfile()`.
- **Befehle:** XP-Hook direkt nach der Zugriffsprüfung — `applyCommandXp({ loveAction })`.
- **loveplus-Ctx:** neuer Helper `grantGameXp(amount, source)` in `helpers` — Spiele geben XP.
- **$daily / $dailylove / $work:** XP jetzt über `grantLevelXp()` (davor: nacktes `xp += 50` ohne Level-Check).

### `loveplus.js`
- Import `levelUpAnnounce, prestigeAnnounce` aus `./levelsystem.js`.
- Helper `gameXpLine(ctx, xp, source)` — gewährt XP und liefert den Anzeigetext (inkl. Level-Up-Feier).
- `checkAchievements()` prüft jetzt auch `progression` (Level-/Prestige-Achievements).

### `server.js` (Website)
- `/api/leaderboard`: topLevel jetzt mit `prestige`, `totalXp`, `streak`, `rank` — Sortierung
  (Prestige, Level, XP).
- `/api/legal-check`: **Impressum-Produktionscheck** (liest `public/impressum-data.json`).
- `/api/love`: Ränge synchronisiert (Neuling → Mythisch), Leaderboard nach Progression sortiert.

### Profil-Format (`progression` im User-Profil)

```json
{
  "level": 24,
  "prestige": 0,
  "xp": 1284,
  "neededXpForLvOrPrestigeUp": 1896,
  "totalXp": 5481,
  "streak": 3,
  "lastActiveDay": "2026-09-10",
  "lastDaily": "2026-09-10",
  "lastXpAt": 1757539200000,
  "xpWindow": [{ "t": 1757539100000, "a": 5, "s": "msg" }],
  "xpSources": { "messages": 3200, "love": 850, "commands": 900, "games": 331, "dailies": 150, "work": 50 },
  "title": { "min": 5, "emoji": "💜", "name": "Regular" },
  "titleLevel": 5,
  "badges": { "first_steps": 1757539200000 },
  "bestStreak": 12,
  "xpLog": [{ "s": "messages", "a": 15, "t": 1757539200000 }],
  "xpDaily": [{ "d": "2026-09-10", "a": 65 }],
  "streaks": { "daily": { "c": 3, "last": "2026-09-10" }, "chat": { "c": 3 }, "xp": { "c": 2 } },
  "unlocks": { "lv5": 1757539200000 }
}

/* Dazu: `profile.stats` = { messages, commands, games, gameWins, gameLosses,
   loveActions, complimentsGiven } — echte Aktivitäts-Zähler für Achievements. */
```

`ensureProgression()` migriert alte Profile automatisch (fehlende Felder werden ergänzt,
`neededXpForLvOrPrestigeUp` wird neu berechnet, falls es fehlt).

---

## 9. DSGVO

- XP/Level/Wallet/Spiel-Daten sind **Bestandteil des Profils** und werden erst mit `$dsgvo accept`
  verarbeitet (`xpEligible()` — sonst gibt es 0 XP, leise, ohne Abmahnung).
- Widerruf per `$dsgvo reject` bleibt bestehen; Level-Daten werden wie alle Profildaten behandelt
  (siehe `public/datenschutz.html`, Abschnitt „Level-System, Economy & Games").
- Die **Nette-Erkennung** speichert keine Inhalte — dokumentiert in der Datenschutzerklärung.

---

## 10. Impressum & Produktionscheck

- Neue Seite: **`public/impressum.html`** (komplettes Impressum, § 5 TMG + Haftung + Urheberrecht).
- Daten liegen **zentral** in **`public/impressum-data.json`** — dort werden **nur echte Angaben**
  hinterlegt. Leere Felder = markierte Platzhalter `[Dein Vorname]` etc.
- **Live-Produktionscheck** (Seite + Admin-Dashboard + `/api/legal-check`):
  - Name / Adresse / E-Mail / Telefon → ✓ hinterlegt oder ⚠ fehlt
  - Status: **🔴 nicht veröffentlichungsbereit** ↔ **🟢 veröffentlichungsbereit**
  - Warn-Banner: „⚠ IMPRESSUM UNVOLLSTÄNDIG — bitte echte Betreiberangaben hinterlegen, bevor die
    Website veröffentlicht wird."
- **Regel: Es werden NIEMALS erfundene Daten ausgegeben.**

---

## 11. Aktivierung & Härten (10.09.2026)

Das Level-System läuft als **automatisches Hintergrundsystem**: jede normale Nachricht und jeder
Befehl vergibt XP (DSGVO-gated, mit Cooldown + Caps), Level-Ups werden sofort im Chat gefeiert.

- **Zentrale Ankündigung:** `sendLevelUpAnnouncement()` in `Love.js` — EINE Stelle für alle
  XP-Quellen (Nachricht, Befehl, `$daily`, `$dailylove`, `$work`, `$play`-Media, `$compliment`,
  Spiele). In Gruppen mit **@User-Mention** (`mentions`-Array), im Privat-Chat ohne Mention,
  Mehrfach-Level-Up als **„Level 9 → Level 11“**.
- **Fehlende Ankündigungen ergänzt:** `$play`-Media-XP und `$compliment`-XP (Sender UND
  Empfänger) lösen jetzt ebenfalls Level-Up-Meldungen aus.
- **EINE Kurve, EINE Vergabe:** `waApi.js` (`PROGRESSION_CURVE`, `getNeededXp`, `addXp`)
  delegiert an `levelsystem.js` (`PROGRESSION`, `neededXp()`, `grantXp()`) — keine
  Parallel-Mathematik mehr. Toter Duplikat-`$top`-Block in `Love.js` entfernt (war durch
  doppeltes `case` unerreichbar und ignorierte Prestige in der Sortierung).
- **Emoji-Bugfix:** `LOVE_EMOJIS` enthielt zwei **leere Strings** — per `includes('')` gab das
  JEDER Nachricht +2 Score (min. ×2-XP, ab 1 Treffer ×3). Leereinträge entfernt + Guard
  (`if (e && …)`) gegen Regression.
- **Website:** `level.html` zeigt bei API-Fehler eine ehrliche Fehlermeldung statt
  Demo-Daten; `/api/leaderboard` liefert weiterhin echte Live-Daten.

---

## 12. Progression 3.0 — Vollsystem (10.09.2026)

Ausbau zum kompletten Fortschrittssystem **auf der bestehenden Architektur**
(Engine bleibt `levelsystem.js`, keine Parallelsysteme, `$ping` unangetastet).

- **Level-Titel (6):** 🌱 Newcomer (0) · 💜 Regular (5) · ⭐ Active (10) · 🔥 Veteran (20) ·
  👑 Elite (50) · 💎 Legendary (100). Automatisch verdient, in
  `progression.title` gespeichert — der frei wählbare `$title` (`identity.title`)
  wird **niemals** überschrieben.
- **Badges (8, permanent):** Erste Schritte, Aufsteiger (L10), Veteran (L25),
  Elite (L50), Legende (L100), 7/30/100-Tage-Streak. Vergabe automatisch in
  `grantXp()`, gespeichert als ID→Zeitstempel in `progression.badges`.
- **Achievements (32):** `$achievements` zeigt jetzt die **echte loveplus-Sammlung**
  (vorher: statische 7er-Liste mit falschen Metriken). 10 neue aus echten
  Zählern; Prüfung nach jeder XP-Vergabe via `awardProgressionAchievements()`
  (speichert nur bei Neu-Freischaltung).
- **Boni:** +10 erste Aktion/Tag (nur organische Quellen), +50/+200/+1000 bei
  Streak 7/30/100 — alles in `Database/xp-rules.json` (`bonuses`) konfigurierbar,
  inkl. Owner-Center-Editor (`cc-xp.js`) + Audit-Versionierung.
- **Ankündigung:** Eine Nachricht bündelt Level-Up + Titel + Badges + Boni +
  Achievements (`sendLevelUpAnnouncement` mit `extraUnlocks`); reine
  Freischaltungen ohne Level-Up bekommen eine eigene 🎉-Nachricht.
- **Streaks:** `bestStreak` (Rekord) wird jetzt wirklich geschrieben (war vorher
  nur Anzeige); Streak-Multiplikator +5/+10/+25 % (Cap, regelbar).
- **Befehle:** `$xp` (kompakt) vs. `$level` (voll, + `@user`); `$rank` mit
  globalem Platz; `$top` mit Filtern `xp/weekly/monthly/group`; `$me` mit
  Fortschritts-Block; `$daily` zeigt den echten gewährten Betrag.
- **Technik:** `withProfileLock()` (waApi) serialisiert parallele XP-Vergaben
  pro Profil; `globalRank()`/`xpPeriods()`/`recentXp()` als zentrale Helfer;
  `apply*` melden die **echte** Vergabe (inkl. Boni); Null-Guards überall;
  keine negativen XP; kein Nachrichtentext im Verlauf (nur Quelle/Betrag/Zeit).
- **Website:** `/api/leaderboard` liefert `title` + `badges`, `level.html` zeigt
  sie; neue Engine-Events (`TITLE_EARNED`, `BADGE_UNLOCKED`, `STREAK_MILESTONE`)
  laufen über den bestehenden Live-Feed (`/api/live`).
- **Tests:** Harness auf **128 Assertions** erweitert (Titel, Badges, Boni,
  Streak-Multi, Stats, Zeiträume, Verlauf, Rang, Achievements im echten Store,
  Lock mit echtem Code, Registry, Robustheit) — alle grün, Database per
  Backup/Restore unberührt. Live: `/api/leaderboard` + Regel-Migration verifiziert.
- **Offen (braucht WhatsApp-live):** `$top group`-Mitglieder-Matching,
  `$level/$rank @user`-Auflösung, Achievement-Popup im Chat, Couple-Streak.

## 13. Progression 4.0 — Profil-Center & Account-Lifecycle (10.09.2026)

Ausbau auf Basis von 3.0: **kein Ersatz, keine Parallelsysteme, `$ping`
unangetastet.** Neue Module: `progressstats.js` (nur lesende Statistik-Texte),
`account.js` (Unregister-Lifecycle). Engine bleibt `levelsystem.js`.

- **Titel (8):** + 🌌 Mythic (200), ✨ Immortal (400). `$title` zeigt jetzt die
  Übersicht (verdient 🔓/🔒 + Custom-Titel); `$title use <name>` wählt einen
  **verdienten** Titel als aktiv (`progression.activeTitle`), `clear` setzt auf
  den Höchsttitel zurück. Custom-`$title` und Anzeige-Logik bleiben unberührt.
- **Badges (24 in 6 Bereichen):** Level · Streak · Chat · Games · Social ·
  Sammlung. Jeder Badge hat Metrik+Ziel (`badgeProgress()`); `$badges` ist nun
  eine eigene Vitrine mit Fortschritt (vorher: Alias auf Achievements).
  Sammlungs-Badges nutzen die echte Achievement-Zahl aus dem loveplus-Store.
- **Achievements (60 in 10 Kategorien):** Katalog-Einträge tragen `cat` +
  optional `goal {m, n}`; **eine** Metrik-Schleife ersetzt alle hartkodierten
  Prüfungen (`achievementMetrics()` aus Profil + Store). `$achievements` zeigt
  Kategorie-Balken, ✅-Liste und Top-3-Nächste (`all` für alles).
- **Tages-/Wochenziele:** 50 / 500 XP (Regel `goals` in `xp-rules.json`,
  Owner-Center-speicherbar via Server-Merge) → Kupfer-Belohnung (50/250),
  **keine** XP-Inflation, je einmalig (`unlocks`). Events `dailygoal/weeklygoal`.
- **Rekorde & Tages-Aktivität:** `records {highestLevel, highestDailyXp,
  mostXpOneAction}` persistent; `statsDaily` (35 Tage, m/c/g/s) für
  Aktivitäts-Zeiträume; `recordGamePlayed()` als einzige Spiel-Erfassung.
- **`$me` = Profil-Center:** USER · PROGRESSION · GLOBAL RANK · STREAK ·
  ACTIVITY · GAMES · SOCIAL · SAMMLUNG · XP PERIOD · GOALS · RECORDS ·
  NEXT MILESTONE · LETZTE XP — alles echt, Fehlendes als „–“, keine IDs.
- **Neue Befehle:** `$progress` (Ziele+Balken+Rank), `$activity` (Perioden+
  Trends), `$records`, `$milestones`, `$mystats`/`$stats me` (persönlich;
  `$stats` allein bleibt System). `$streak`/`$rewards` als Karten. Registry v5.
- **`$unregister` (sicher):** nur eigener Account, Warnung mit echter
  Lösch-Vorschau, 6-stelliger Code (5 Min, RAM-only), explizites
  `confirm <code>`, `cancel`, Ablauf-to-Abbruch. Admins/Owner zusätzlich
  `LÖSCHEN`-Wort; Owner-Default: blockiert. Löscht Profil, AFK, Warns,
  Anträge, loveplus/lovecore-User+Couples (exakte Nummern-Beteiligung),
  LoveUser-Ordner, Sessions, offene Mails; **behält** Bans, Gruppen-Config,
  Accounts, Media, Logs. Backup vorher (`backups/unregister/`), Audit danach,
  Partner wird Single (ohne Ghost-Profil). Re-Register = sauberer Neustart;
  Owner-Restore mit Skip-statt-Überschreiben.
- **Events:** `MILESTONE_REACHED`, `GOAL_COMPLETED`, `REWARD_GRANTED`,
  `STREAK_UPDATED` (loveengine, Keys `kind/target/streak` freigegeben).
- **Tests:** Harness auf **147 Assertions** (4.0-API) + neue Suite
  `love40-test.mjs` mit **158 Assertions** (Engine, Katalog, Stats-Texte,
  Account-Lifecycle in Sandbox-Kopie, Statik) — alle grün, echte Database
  verifiziert unberührt. Live-offen wie 3.0 + `$unregister`-Chatflow.

## 14. Progression 5.0 — Game-/Social-System (10.09.2026)

Ausbau auf Basis von 4.0: **kein Ersatz, keine Parallel-XP, `$ping`
unangetastet.** Engine bleibt `levelsystem.js`; Anzeige in `progressstats.js`;
Katalog in `loveplus.js`; Lifecycle in `account.js`.

- **Titel (9 + 6 Spezial):** + 🪐 Eternal (600). Spezial-Titel aus echten
  Quellen: Prestige (Herzengel/Liebes-As/Love-Mythos), Sammlung
  (Trophäen-/Legendenjäger), Streak (Unaufhaltsam). `$title` zeigt
  Level-Titel (mit Restweg) + Spezial-Titel (mit Fortschritt); `use`
  prüft Verdienst inkl. echter Achievement-Zahl, `clear` geht zum
  Höchsttitel. Custom-Titel (`identity.title`) nie überschrieben.
- **Badges (39 in 6 Bereichen, mit Stufen):** bestehende IDs unverändert;
  neu u. a. Chatter-/Commander-/Gamer-/Winner-/Compliment-/Love-Serien,
  Collector bis 100, Daily-Serie, Eternal-600. Jede Serie zeigt
  „Stufe x/y“. Neue Metriken: `commands`, `complimentsGiven`,
  `dailiesClaimed`.
- **Achievements (120 in 14 Kategorien, 5 Tiers):** neue Kategorien
  Beziehung · Prestige · Ziele · Sammlung; jede Def trägt
  `tier` (Bronze→Mythisch). 115 metrische + 5 Event-Defs, **eine**
  Metrik-Schleife. Neue Metriken: Couple (Streak/Love-XP/Memories),
  Ehe-Tage, Wochenziele, Ziel-Streak (Best), Badge-Zahl, aktive Wochen/
  Stunden, Dailies/Work, Siegesserie, Tages-Rekord, Rätsel-Zähler (ab 5.0).
  `$achievements all` zeigt ✅ freigeschaltet / 🎯 in Arbeit / 🔒 gesperrt.
  Mehrpass-Vergabe (Achievements↔Badges stabil in einem Aufruf).
- **Meilensteine (11):** + 25/75/150/200/250 mit Kupfer (einmalig, Zyklus 0).
- **Rewards regelbar:** `rewards` in `xp-rules.json` (Level-Basis/Steigung/
  Cap, Prestige-Kupfer, Minor-Ziel-Kupfer, Truhen-Beträge) — Owner-Center
  (Ziel-/Reward-Editor, Step-up + Audit) + Server-Clamps.
- **Claim-Truhen:** Lv 25/75/150/200/250 + je Prestige-Up legen eine Truhe
  in `pendingRewards`; `$reward claim` holt ab (Unlock-Key + Entnahme =
  kein Doppel-Claim). Reward-Ledger (`rewardsLog`, 30) für Historie;
  Migration importiert alte Unlocks mit ehrlichem „–“ statt erfundenem Betrag.
- **Ziele erweitert:** + Tages-Nachrichten/-Befehle, Wochen-Nachrichten/
  -Spiele (aus `statsDaily`) + Ziel-Streak (`goalStreak {c, best}`).
  Events tragen `goal` (xp/messages/commands/games) + Streak.
- **Zeit-Stats (echt, ab 5.0):** `hourActivity[24]` + `weekdayActivity[7]`
  nur aus organischen XP-Quellen; `$activity` zeigt 28-Tage-Heatmap
  (Wochentage aus `xpDaily`) + aktivste Zeit/Tag, vorher „–“.
- **Ränge:** `$rank [weekly|monthly|group]` (Perioden-XP / Mitglieder);
  globaler Eigen-Rang schreibt Wochen-Snapshots (`rankHistory`, 12) mit
  Trend (📈/📉 nur bei echtem Vorwert). Event `RANK_CHANGED`
  (Keys `pos/total/prev` freigegeben). Ranglisten-Cache (30 s TTL) für
  `$me/$rank/$top/$compare` — dokumentiert, max. 30 s alt.
- **Neue Befehle:** `$xpsources` (Quellen-Anteile), `$weekly`/`$monthly`
  (Reports mit Historie + neue Achievements aus Store-Zeitstempeln),
  `$prestige` (Zyklus, Rest-XP aus der Kurve, Belohnungen),
  `$compare @user` (ein Kern mit `$profile`, nur öffentliche Daten),
  `$reward`, `$x`/`$lv`/`$vergleich`-Aliase. Registry v5 (297 Befehle).
- **Owner-XP-Tools (auditiert):** `$givexp`/`$takexp @user <n> <grund>`
  (gleiche Semantik wie `/api/xp/adjust`: plus durch Engine, minus ohne
  Level-Down, ±10 Mio, Grund ≥5), `$xprollback` (einmaliger Restore des
  letzten Adjusts; Titel/Badges bleiben), `$unlockach` (nur Katalog-IDs).
  Alle mit `auditAdmin()` nach `admin-actions.jsonl` + `XP_ADJUSTED`.
- **`$me`:** + Prestige-Rest, Truhen-Hinweis, Rank-Trend, Tier-Zeile,
  Minor-Ziele, Ziel-Streak, Insights (max. 3, datenbasiert), Menü um
  Statistiken/Badges/Streak/Rang/Woche erweitert (Buttons + Text-Fallback).
  `$profile` nutzt denselben Progressions-Kern (Rangzeile, Platz, Badges).
- **Mitteilungen:** ein gebündelter Text (Level/Prestige + Meilenstein/
  Titel/Badge/Truhe/Boni/Ziele mit Streak) + gruppierte
  🏆-ACHIEVEMENTS-/🏅-BADGES-Blöcke (max. 6 + Zähler).
- **Website/API:** `/api/leaderboard` + `weekXp/monthXp/achievements`
  (BIDs intern, nie im Output); `/api/xp` + `progression`-Feld; neu
  `/api/progression/summary` (Katalog, Regeln, `xpAnalytics`, `xp.view`).
  `level.html` zeigt 7d-XP + Achievement-Zahl.
- **Unregister:** löscht alle 5.0-Felder mit dem Profil (liegen in
  `progression`/Store); **Events werden anonymisiert** (bid→`deleted`,
  name→`–`, Statistik-Zeilen bleiben); Backup enthält 5.0-Felder.
  Re-Register = sauber (keine Reste).
- **Integrität/Analytik/Balancing:** `validateProgression()` (sanfte
  Reparatur + Warnungen), `validateAchievements()`, `xpAnalytics()`,
  `balanceScenario()` (4 Szenarien, als Schätzung gelabelt),
  `prestigeProgress()` (Rest-XP aus echter Kurve).
- **Nebenläufigkeit/Performance:** Claim/Admin-Pfade unter
  `withProfileLock` + `saveUserProfile`; Ranking per 30-s-Cache.
- **Tests:** Harness **147** + `love40-test.mjs` **158** (Katalog-
  Erwartungen auf 9/39/11/120/14 aktualisiert, Rest unverändert) +
  neu `love50-test.mjs` mit **186 Assertions** (Rewards/Truhen, Ziele,
  Ränge, Titel/Badges, Admin, Katalog, Builder, Unregister-Events,
  Statik, Full-Lifecycle bis Prestige) + `$ping`-Harness — alle grün,
  echte Database verifiziert unberührt.

## 15. Progression 6.0 — Account-System (10.09.2026)

Ausbau auf Basis von 5.0: **kein Ersatz, keine Parallel-XP/-Währung,
`$ping` unangetastet.** Engine bleibt `levelsystem.js`; Kupfer bleibt die
einzige Münze (`wallet.copper`), neu: zentrale Economy-Engine
(`economy.js`), Account-Lebenszyklus-Erweiterungen (`account.js`),
Chat-Schicht in `Love.js` (+ `loveplus.js`), Dashboard `account.html`.

- **Economy-Engine (`economy.js`, neu):** `addCoins/removeCoins/
  transferCoins/getBalance` als einzige Schreibwege (Idempotenz-Keys,
  `withProfileLock`-sicher); Tx-Log (`economy.tx`, 50) mit Quelle/Grund;
  Perioden-Aggregate (Tag/Woche/Monat/Jahr, je verdient/ausgegeben +
  `statsMonthly`, je 24 Buckets); Tages-/Transaktions-Caps (10.000),
  Minus-Schutz, Überlauf-Schutz (`coinCap` 100 Mio), Selbst-Transfer-
  Block, Währungs-Verweigerung (nur Kupfer); Engine-Events
  (`COINS_EARNED/SPENT`, `TRANSFER`); `validateEconomy()` meldet
  Rohwert-Funde + repariert sanft; `economyAnalytics()` (Top-Quellen).
- **Wallet & Bank:** `deposit/withdraw` (+ `all`), Bank-Kapazität
  (100.000 + 100/Level + 5.000/Prestige + 50/Achievement),
  **Zinsen** (1 %/24 h, Cap 5.000, 24-h-Cooldown). Starterpaket
  (500 Kupfer + 50 XP) genau einmal (`claimedStarter`-Flag).
- **Daily/Weekly/Monthly/Yearly:** Daily mit Basis 200 + 10/Serie
  (Cap +500), Rekord-Bonus 500, Meilensteine 7/30/100/365 Tage
  (2.500/25.000/100.000/250.000 Kupfer, je einmal); Daily-XP (25 + bis
  +25 aus Serie + 5 Titel-Bonus); Weekly/Monthly als echte Reports
  (verdient/ausgegeben/XP/Trend); `$yearly` neu (Jahres-Report aus
  `xpMonthly/periods`, dort „neu“-Label nur bei Vormonat mit Daten).
- **XP-Quellen (6.0):** `gifts` (Geben +3, Empfangen +1 an beide),
  `achievements` (+5/Unlock, `_skipBadges` — Badges bleiben beim
  Award-Loop mit `gotCount`), `monthlybonus`; **Monatsziel**
  (2.000 XP → +100 XP, einmalig/Monat, Event `monthlygoal`);
  **Multiplikatoren:** Wochenende ×1,25, Streak bis ×1,25, Prestige
  bis ×1,5, Event (regelbar), Owner +10 %, **Gesamt-Cap ×3,0**;
  `xpMultiplierBreakdown()` (5 Teile + `capped`-Flag); `$me`- und
  Report-Anzeigen nutzen die echten Werte.
- **Regeln:** `xp-rules.json` + Sektionen `xpRewards` (achievement/
  giftGiven/giftReceived) und `economy` (Caps, Daily-Basis, Meilen-
  steine, `yearlyBase`, Zinsen); `saveXpRules()` behält beide beim
  Owner-Speichern; Server-Clamps + Owner-Center-Editor (6.0-Sektionen,
  Event-Name/Ende, Monatsziele, Economy-Gesundheit mit Top-Quellen).
- **Shop/Inventar (echt, keine Demos):** 8 Geschenke (Rose→Diamantring,
  mit `type`/`requires`-Feldern); Kauf = `removeCoins(source: shop)`;
  Inventar in `loveplus.users[].inventory`; `$gift` mit Stufen-Freischal-
  tung (10 Lose→Common … 100 Diamanten→Mythisch) + Cooldown; Kauf-
  Validierung (`unknown-item/level/registered/funds`).
- **Befehle (14 neu, Registry v6 — 311 Befehle/228 Aliase):** `$bank/
  $deposit/$withdraw`, `$economy`, `$transactions`, `$report [day|week/
  month/year/all]`, `$yearly`, `$rich` (Top-Reichste), `$account`
  (Konto-Dashboard), `$settings` ( XP-/Economy-/Levelup-/Streak-Toggles
  + `hideEconomy`-Privatsphäre), `$givecoins/$takecoins` (auditiert,
  ±1 Mio, Grund ≥5), `$coinrollback` (einmalig), `$info`-Alias;
  `$daily` zeigt Serie/Rekord/Meilensteine/XP/Vorschau, `$me` kompakt/
  voll + Economy-Sektion + Perioden-Zeile + Vergleichs-Honouring.
- **Benachrichtigungen & Privatsphäre:** Economy/Levelup/Streak-Toggles
  + `hideEconomy` (versteckt Wallet/Bank/Lifetime/Top-Vergleiche);
  ein Opt-out blendet konsequent alle Economy-Zeilen aus.
- **Unregister/Re-Register:** Preview + Backup enthalten Wallet/Bank/
  Tx/Inventar/Daily-Rekord; Restore stellt alles her; Re-Register
  startet sauber (neues Starterpaket nur ohne `claimedStarter`).
- **Website/API:** neu `/api/profile/me` (Dashboard-Daten, Session)
  + `/api/profile/me/privacy` (POST, Whitelist), `/api/leaderboard` +
  `bank`-Summen + `event`-Block, `/api/admin/overview` +
  `economyAnalytics`; neu `public/account.html` (Mobile-first, 5 Tabs:
  Übersicht/Economy/Reports/Top/Privatsphäre); `level.html` + Account-
  Link + Event-Banner; alle Notify-Links zeigen auf `/account.html`.
- **Balancing/Senken:** Shop, Transfers, Zins-Cap, Streak-Verfall,
  Prestige-Kupfer als Senken; `economyAnalytics()` + Admin-Overview
  für Monitoring; keine Inflation (alle Quellen regelbar/capped).
- **Tests:** neu `love60-test.mjs` mit **175 Assertions** (Engine,
  Bank/Zinsen, Daily/Meilensteine, Admin/Rollback, Quellen/Monatsziel/
  Multiplikatoren/Cap, Aggregate, loveplus, Regeln, Builder, Lifecycle
  mit Backup/Restore, Full-Lifecycle, Registry/Statik) + Regression
  **v3 ✅, 4.0 (158) ✅, 5.0 (186) ✅, `$ping` ✅**, Server-Boot
  verifiziert (200/200/401), echte Database verifiziert unberührt.
  Realer Bug-Fund: Badge-Diebstahl durch Achievement-XP (Fix:
  `_skipBadges`); `validateEconomy` meldet jetzt Funde vor `ensure()`.

## 16. Progression 7.0 — Gruppen-System & LoveBot-AI (10.09.2026)

Ausbau auf Basis von 6.0: **3.0–6.0 bleiben intakt, `$ping`
unangetastet, keine Parallel-XP/-Währung, keine Fake-Daten.**
Engine bleibt `levelsystem.js`; Kupfer bleibt die einzige Münze.
Neu: Gruppen-Modul (`groups.js` + `groupstats.js`), Gruppen-Chat-
Schicht + AI-Plattform (`ai/*.js`) in `Love.js`, Dashboard-Seiten
(`group.html`, `ai.html`, `groups.html`, `home.html` u. a.).

- **Gruppen-System (`groups.js`, neu):** Gruppen-Profil mit
  `subject/memberCount/adminCount`, Feature-Flags (`welcome/goodbye/
  badwords/antilink/autodl`, je an/aus), Warn-System (3 Stufen +
  Eskalation), Gruppen-Bans (`gbanned`, überdauert Unregister),
  Treasury (`gtreasury`: spenden/log), Ziele (`goals`), Events
  (`activeEvents`, Ablauf-geprüft), Achievements/Badges/Rewards
  (`gach/gbadges`), Audit-Log (`gaudit`, Owner-sichtbar).
- **Gruppen-Progression (`groupstats.js`, neu):** Gruppen-XP/Level
  (eigene Kurve, kein Eingriff in User-XP), `topMembers()` (XP/Msgs/
  Games), Mitglieder-Zeilen, Historie (`xp.history`), `groupPublic()`
  (datensparsame API-Sicht), `renderGroupCard()` für `$groupinfo`.
- **Gruppen-Befehle (13 neu, Registry v7 — 332/242):** `$am`
  (Feature-Center), `$members` (Liste), `$gxp/$glevel/$gtop`
  (Progression), `$gsettings` (Flags), `$ggoal` (+`$gziele`),
  `$gevent`, `$gaudit` (Owner-Log), `$geconomy` (+`$gkasse`,
  Treasury), `$gdonate`, `$gban/$gunban` (Unregister-sicher);
  erhalten/gehärtet: `$aus` (Feature-Off), `$gi` (Feature-Liste),
  `$groupinfo` (+ Aliase `$gcinfo/$ginfo/$group`, Profilkarte),
  `$kick` (Bestätigung, Audit), `$members/$warnings` intakt.
- **Website Gruppen:** neu `public/groups.html` (Liste, Admin) +
  `public/group.html` (Profilseite: Level, Top-5, Ziele, Events,
  Treasury-Log, Audit für Owner); APIs `GET /api/groups` (Admin),
  `GET /api/groups/:id` + `/:id/stats` (Session); Bug-Fund:
  `:id`-Route rief `sendJson` mit falscher Signatur (500er) — Fix
  verifiziert live (`{ok,group,top5}` + Stats-Shape).
- **`$me`-Ultimate:** + Economy-/Progression-/Activity-Sichten,
  AI-/Social-/Group-/Trends-/Records-Blöcke; `$register` mit
  Welcome + Defaults; `$account/$settings` ausgebaut; Perioden
  verbunden (`$reports` + Aliase `reports/berichte`, Top-Source/
  Sink je Periode, Lifetime-Economy-Zeile); `$gdonate` füttert
  die Gruppen-Treasury (Quelle `gdonate`).
- **AI-Plattform (`ai/`, neu, kein Paid-API nötig):** Provider-
  Abstraktion (`providers.js`: `local` = Ollama/llama.cpp-kompatibel
  via `/api/chat`, `mock` für Tests), Engine (`engine.js`: Health-
  Cache 60 s, ReAct max. 3 Schritte, Streaming, ehrliches
  `{ok:false,reason:'unavailable'}` ohne Backend), Memory
  (`memory.js`: Gespräche/Fakten/Prefs/Usage in `ai.json`),
  Limits (`limits.js`: 6/Min, 60/Std, 200/Tag, Cooldowns),
  Tools (`tools.js`: nur lesend — Zeit, Profil-public, Economy-
  public, Leaderboard, Registry-Suche; Gate blockt Ban/Coins/XP/
  Delete/Settings/Owner-Aktionen), Kontext (`context.js`: baut
  System-Prompt aus Profil + Gruppe + Verlauf, filtert Secrets).
- **AI-Befehle (8 neu + Alias `$askai`):** `$ai/$ask` (Frage + Verlauf),
  `$aistatus` (Provider/Modell/Latenz), `$aimodel` (Owner: Modell-
  wechsel), `$aiclear` (Verlauf löschen), `$aistop` (Stream-Stop),
  `$aiconfig` (Owner: URL/Modell/Limits), `$aimemory` (Fakten/
  vergessen), DM-Chat-Modus (nur bei explizitem Trigger `$ai`/
  Antwort), Gruppen-AI nur auf Mention/Trigger; Moderation nur
  klassifizierend (Vorschlag statt Aktion).
- **AI-Website:** neu `public/ai.html` (Chat-UI, Verlauf, Memory-
  Panel, Status-Badge) + APIs `GET /api/ai/status|models`,
  `POST /api/ai/chat`, `GET/POST /api/ai/memory[/clear]`
  (Session-pflichtig, Owner-Gates für Config/Model); Overview-
  Analytics (`aiStats`); NAV-Eintrag + `common.js`-Link.
- **Security/Unregister:** Prompt-Injection-Filter (System-Prompt
  immun gegen „ignoriere Anweisungen“), Privacy-Pipeline (keine
  Tokens/Passwörter/IPs/Sessions an die AI), Rate-Limits pro User,
  Audit für AI-Config; Unregister-Preview + Backup enthalten
  `aiConvs/aiFacts/groupMembers`, Confirm löscht Gruppen-XP-Zeilen
  + AI-Memory (Backup, Restore stellt AI bewusst NICHT her),
  `gbanned` bleibt bestehen.
- **Tests:** neu `love70-test.mjs` mit **209 Assertions** (Gruppen/
  Progression/Modabstufung, Website-Statik, `$me/Register/Perioden/
  Economy`, AI-Core/Provider/Memory/Tools/Limits/Kontext, Security/
  Unregister-Purge, Registry/Statik) + Regression **v3 ✅,
  4.0 (158) ✅, 5.0 (186) ✅, 6.0 (175) ✅, `$ping` ✅**,
  authentifizierte Live-API-Tests (me/economy/progression/ai-
  status/ai-chat-unavailable/groups/groups-stats), echte Database
  verifiziert sauber (Test-Artefakte restlos entfernt).
- **Hotfix 7.0.1 (Produktion):** TDZ-Crash `isGroup` im Chatmodus-Hook
  (1-Zeilen-Fix, Nachrichten-XP läuft wieder); Registry-AI-Kategorie +
  `usage` für alle 21 neuen Commands (`$help ai` repariert); je ein
  statischer Guard in `love70-test.mjs` (→ 209 Assertions).
- **Hotfix 7.0.2 — AI-Diagnose (10.09.2026):** klassifizierte Fehler
  (`ECONNREFUSED` statt `fetch failed`, `error.cause`-Auswertung, HTTP-Mapping,
  max. 1 Retry nur transient), Modell-Check (`ready` vs. `ok`), `$ai diagnose`
  (8 Stufen + Mini-Generierung), `$ai debug` (Owner), `$aimodel <name>` schaltet
  echt (Owner), Fehlversuche ohne Quota-Verbrauch, atomare `ai.json`, Mock-Guard,
  Startup-Check (nicht blockierend), Website nutzt gleiche Health-Quelle;
  Voll-Doku `Dokumente/LOVEAI.md`; Suite P mit Ollama-Protokoll-Stub
  (→ **265 Assertions**, alle grün).

# 💜 LoveBot — Level-System v1.0 (Dokumentation)

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

### Belohnungen

| Ereignis | Belohnung |
|---|---|
| Level-Up | **20 + 5·Level Kupfer** (max. 400) + Ankündigung im Chat |
| Prestige-Up | **+10.000 Kupfer** + Prestige-Titel + große Ankündigung |

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

---

## 6. Neue & geänderte Befehle

| Befehl | Was |
|---|---|
| `$level` / `$xp` | Komplettes Level-Profil: Level, Prestige, Rang, XP-Balken, Lifetime-XP, Streak, XP-Quellen-Übersicht, nächster Rang, Wallet |
| `$rank` / `$rang [@user]` | Eigenen Rang anzeigen — oder den von jemandem |
| `$top` / `$leaderboard` / `$lb` | Bestenliste, jetzt nach **Prestige → Level → XP** sortiert, mit Rängen |
| `$daily` | Unverändert +50 XP — aber jetzt **mit Level-Logik** (Level-Ups können direkt im Daily passieren) |
| `$work` | Jetzt +10 XP (neben Kupfer) |
| `$dailylove` | +25 XP läuft jetzt durch die Level-Engine (Level-Ups möglich) |
| `$hangman` / `$riddle` / `$rob` | Sieg +15 XP, Niederlage +2 XP — Level-Ups werden im Spiel-Resultat gefeiert |

### Neue Achievements (loveplus, 9 neue)

Level 10 🌸 · Level 25 🌷 · Level 50 💕 · Level 100 🌹 · Level 250 🔥 · Level 500 👑 ·
Prestige 1 🕊️ · Prestige 2 🌹 · Prestige 3 💜

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
  "xpSources": { "messages": 3200, "love": 850, "commands": 900, "games": 331, "dailies": 150, "work": 50 }
}
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

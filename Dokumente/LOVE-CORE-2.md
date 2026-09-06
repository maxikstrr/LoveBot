# ❤️ LoveBot — Love Core 2.0 · Privatsphäre · Anti-Spam

Stand: **06.09.2026** · Neue Dateien: `lovecore.js` · `privacy.js` · `ratelimit.js` · `scripts/migrate-privacy.mjs`
Geändert: `Love.js` · `server.js` · `registry/commands.json` · `README.md`

> Ziel dieser Runde: **nicht noch mehr Befehle**, sondern die vorhandenen
> Systeme zu einem zusammenhängenden Kern verbinden — und den Bot dabei
> so absichern, dass er auch in offenen Gruppen mit Minderjährigen
> vertretbar läuft.

---

## 1. Was jetzt zusammengeführt ist

| Vorher | Jetzt |
|---|---|
| Beziehungsinfos verteilt auf `$relationship`, `$couplestats`, `$anniversary`, `$lovebonus` | **ein Panel: `$love`** — plus `$partner` als Kurzversion |
| Keine Zähler für Liebes-Aktionen | **echte Zähler** für 14 Aktionen, pro Nutzer *und* pro Paar |
| Meilensteine nur implizit | **10 Meilensteine** mit Fortschritt ("noch 223 Tage") |
| `$daily` = nur Economy | **`$dailylove`** = Tagesimpuls + Serie + XP/Coins |
| `$register` speichert Alter + Stadt + Status ungeschützt | **Datenschutz-Regeln** + `$privacy` + Migration |
| Kein Schutz gegen Command-Spam | **Rate-Limit** mit eskalierender Sperre |

---

## 2. `$love` — das Beziehungs-Panel

```text
╔══════════════════════════════╗
║   ❤️  L O V E   P R O F I L   ║
╚══════════════════════════════╝

*Maxichen* ❤️ *Lisa*

💕 *Liebeslevel 11*
   `▰▰▰▰▰▰▰▰▰▰▰▱` 91%
   14.200 Love-XP · noch 200 bis Level 12

🔥 Streak: *27 Tag(e)*
💌 Liebesnachrichten: *1.284*
💍 Zusammen seit: *142 Tag(en)* _(seit 16.4.2026)_
✨ Erinnerungen: 38 · 💒 Ehen: 1 · 💔 Trennungen: 0

🎯 *GEMEINSAME AKTIONEN*
   312 insgesamt — 💋 180 · 🤗 90 · 🌹 42

🏆 *MEILENSTEINE*
✅ 7 Tage zusammen
✅ 30 Tage zusammen
✅ 100 Liebesnachrichten
✅ 7 Tage Streak
✅ 100 Tage zusammen
✅ 500 Liebesnachrichten
🔒 1.000 Liebesnachrichten _(noch 96 Nachrichten)_
🔒 30 Tage Streak _(noch 3 Tage Streak)_

💡 Streak halten mit *$kiss* · *$hug* · *$compliment* · täglich *$lovebonus*
```

**Woher die Zahlen kommen — alles echt, nichts generiert:**

| Anzeige | Quelle |
|---|---|
| Liebeslevel · Love-XP · Streak · Erinnerungen | `loveplus.js` (bestehendes Couple-System) — Level L braucht 100·L² Love-XP |
| Tage zusammen · Hochzeitsdatum · Ehen · Trennungen | `profile.love` aus `Database.json` |
| Liebesnachrichten · Aktionen | **neu:** `Database/lovecore.json` |
| Meilensteine | **neu:** werden aus Tagen / Nachrichten / Streak berechnet |

Für Singles zeigt `$love` die eigenen Zähler und was als Nächstes möglich ist.

### Was gezählt wird

`$kiss` · `$hug` · `$slap` · `$compliment` · `$flirt` · `$anmachen` ·
`$confess` · `$confesslove` · `$romantic` · `$goodmorning` · `$goodnight` ·
`$gift` · `$letter` · `$dateidee`

Der Zähler läuft **vor** dem eigentlichen Befehl und kann einen Befehl nie
blockieren (Fehler werden geschluckt). Der Paar-Key ist derselbe, den
`loveplus.js` benutzt — beide Module treffen also dasselbe Paar.

---

## 3. `$partner` und `$dailylove`

```text
> 💞 *DEIN PARTNER*

❤️ *Lisa*
💕 Liebeslevel 11 (91% bis Level 12)
🔥 Streak: 27 Tag(e)
💌 Nachrichten: 1.284
💍 Zusammen seit 142 Tag(en)

💡 Details: *$love* · Jahrestag: *$anniversary*
```

```text
╔══════════════════════════════╗
║   🌹  D A I L Y   L O V E    ║
╚══════════════════════════════╝

🎯 *Deine heutige Challenge*

„Frag: »Was kann ich heute für dich tun?« — und tu es dann.“

🔥 Serie: *4 Tag(e)*
✨ *+25 XP* · *+50 🤎 Kupfer*

💡 Morgen wieder: *$dailylove*
```

Pro Kalendertag **ein** Impuls (Tipp · Kompliment · Challenge · Zitat),
stabil pro Nutzer — wer zweimal kommt, bekommt denselben Text und keine
zweite Belohnung. Der Tag wechselt um 00:00 UTC.

---

## 4. 🔒 Privatsphäre (Reaktion auf den Alter/Stadt-Hinweis)

Der Hinweis war berechtigt: `$register Name.Alter.Status.Stadt` hat exaktes
Alter, Stadt und Beziehungsstatus ungeschützt gespeichert — im README-Beispiel
mit 16 Jahren. In Gruppen ist nicht kontrollierbar, wer mitliest.

### Regeln (zentral in `privacy.js`, an einer Stelle)

| Situation | Verhalten |
|---|---|
| Alter unter 13 | Registrierung abgelehnt |
| Alter 13–17 | **kein exaktes Alter** gespeichert, nur „unter 18“ |
| Alter ab 18 | exaktes Alter erlaubt (freiwillig) |
| Stadt | optional; in Gruppen immer maskiert (`K●●●●●●●`) |
| Öffentliches Profil (Website) | nur ab 18 **und** mit Opt-in |
| `$me` Detail-Ansicht | Stadt/Alter nur im Privatchat unmaskiert |

### `$privacy`

```text
> 🔒 *LOVE BOT — PRIVATSPHÄRE*

• Name: *Maxichen*
• Alter: unter 18 _(geschützt)_
• Stadt: Recklinghausen → in Gruppen: *R●●●●●●●●●●●●●*
• Öffentliches Profil: ⛔ nicht möglich (unter 18)

*Einstellungen:*
• `$privacy stadt an|aus` — Stadt verstecken
• `$privacy alter an|aus` — Alter verstecken
• `$privacy profil an|aus` — öffentliches Profil (ab 18)
```

### Bestandsdaten migrieren

```bash
node scripts/migrate-privacy.mjs --dry-run   # erst ansehen
node scripts/migrate-privacy.mjs             # dann schreiben (mit Backup)
```

Das Skript legt ein Backup an (`Database/Database.privacy-backup-<zeit>.json`)
und entfernt exakte Alter von Minderjährigen. Es ist **idempotent** — mehrfaches
Ausführen schadet nicht.

### Website

`/api/profiles` liefert jetzt `minor` (true/false), `ageBracket`, eine
maskierte `city` und `publicProfile`. Exakte Alter von Minderjährigen werden
dort gar nicht erst ausgeliefert — die Maskierung passiert **serverseitig**,
nicht nur im Frontend.

---

## 5. 🛡️ Anti-Spam (Rate-Limit)

`ratelimit.js` — gleitendes Zeitfenster pro Nutzer:

| Parameter | Standard |
|---|---|
| Befehle pro Fenster | 10 |
| Fenster | 10 Sekunden |
| Grundsperre | 4 Sekunden |
| Eskalation | 4 s × Strikes (max. 4×) |
| Strikes verfallen | nach 60 s ohne Verstoß |

Owner/Host sind ausgenommen. Der Nutzer bekommt eine höfliche Nachricht mit
der Restzeit; der Bot macht danach normal weiter (kein Crash, kein Ban).
`rateLimit.stats()` liefert Zahlen für `$system` / Admin-Panel.

---

## 6. Dateien

| Datei | Rolle |
|---|---|
| `lovecore.js` | Love Core 2.0: Zähler, Meilensteine, `$love`-/`$partner`-Renderer, Daily-Love (eigener Speicher `Database/lovecore.json`) |
| `privacy.js` | Registrierungs-Normalisierung, Maskierung, `$privacy`, Migrations-Helfer |
| `ratelimit.js` | Anti-Spam (In-Memory, gleitendes Fenster) |
| `scripts/migrate-privacy.mjs` | Migration bestehender Profile |

Änderungen in `Love.js`:
- Imports + **Zähler-Hook** vor dem Befehls-Switch
- **Rate-Limit-Prüfung** (Owner ausgenommen)
- `case 'love'` → Panel · `case 'socials'/'links'` → die alten Social-Links
- neu: `case 'partner'`, `case 'dailylove'`, `case 'privacy'`
- `$register` → Format mit optionalen Feldern + `normalizeRegistration()`
- `$me` / Detail-Profil → maskierte Anzeige + Love-Core-Zähler
- `$divorce` → zählt die Trennung mit

`$socials`/`$links` sind neu, weil **`$love` jetzt das Beziehungs-Panel ist**.

---

## 7. Was als Nächstes sinnvoll ist

Der Kern steht — die Kette kann jetzt weitergebaut werden:

| Nr. | Nächster Schritt | Warum |
|---|---|---|
| 1 | **Couple Home** (Räume + Möbel-Shop) | Das größte Alleinstellungsmerkmal; verbindet Economy, Shop, XP |
| 2 | **Gemeinsames Haustier** | `$pet` gibt es schon, aber nur Solo |
| 3 | **Couple Games** (`$couplequiz`, `$lovetest`, `$compatibility`) | Hoher Spaßfaktor, baut auf denselben Zählern auf |
| 4 | Website: **Couple-Dashboard + Verlaufs-Graph** | Der Zähler-Store liefert die Zeitreihe dafür schon |
| 5 | LoveAI / Premium / Plugin-System | Erst wenn 1–4 stehen |

**Nicht empfohlen:** weitere „Suchen nach Nutzern in deiner Stadt“-Features
oder Matching über Alter/Stadt — genau die Kombination ist das Risiko, das
Abschnitt 4 entschärft.

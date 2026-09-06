# 💖 LovePlus — Erweiterungsmodul (v1)

> 19 neue Befehle für LoveBot: Beziehungssystem · Haustiere · Economy 2.0 ·
> Achievements · Streaks · Liebesbriefe · Mini-Games — komplett getrennt vom Bot-Kern.

---

## Wie es funktioniert

```
Love.js  ──(default-case im Befehls-Switch)──▶  loveplus.js
                                                     │
                                       Database/loveplus.json
                                       (eigener Speicher, kein Eingriff
                                        in bestehende DB-Struktur)
```

- **`loveplus.js`** ist ein eigenständiges ES-Modul — keine Imports aus Love.js,
  alle Bot-Funktionen (Profile laden/speichern, Ziel auflösen, Reactions) kommen
  per `ctx`-Objekt vom Aufrufer.
- Gespeichert wird in **`Database/loveplus.json`**: Nutzer (Pets, Inventar,
  Achievements, Streaks, Cooldowns), Couples (Love-XP, Streak, Erinnerungen)
  und laufende Spiele (Hangman, Rätsel) pro Chat.
- Coins nutzen das **bestehende Wallet** (`profile.wallet.copper` = Kupfer) —
  alles bleibt kompatibel mit `$balance`, `$daily`, `$work` & Co.
- Die Ehe-Erkennung nutzt das vorhandene `$marry`-System (`profile.love`).

## Neue Befehle (19)

### ❤️ Beziehung (baut auf `$marry` auf)
| Befehl | Wirkung |
|---|---|
| `$relationship` / `$beziehung` | Beziehungs-Panel: gemeinsame Tage, Love-XP, Couple-Level mit Fortschrittsbalken, Treue-%, Erinnerungen, nächster Jahrestag |
| `$lovebonus` | Täglicher Bonus: Singles 15+ Kupfer, Paare 30+ Kupfer **und +40 Love-XP** — mit Streak (Streak-Reset bei Lücke) |
| `$coupletop` / `$lovetop` | Top 8 Paare nach Love-XP (🥇🥈🥉) |

### 🐶 Haustier
| Befehl | Wirkung |
|---|---|
| `$pet create <name>` | Kostenlos adoptieren (zufälliges Tier 🐶🐱🐰🦊…) |
| `$pet` | Status mit Balken: Hunger, Liebe, Stimmung, Energie + Level/Alter |
| `$pet feed` | Füttern (10 Kupfer) — Hunger steigt, XP dazu |
| `$pet play` | Spielen (+Stimmung/Liebe, −Energie) |
| `$pet sleep` | Schlafen (+Energie) |
| `$pet name <name>` | Umbenennen |

Hintergrund: Werte verfallen über Zeit („Decay“), Energie regeneriert im Schlaf —
wer sein Tier ignoriert, bekommt „starving 🍖 SOFORT FÜTTERN!“.

### 💎 Economy 2.0
| Befehl | Wirkung |
|---|---|
| `$shop` | 8 Items: Rose (15 🪙) … Diamantring (999 🪙) |
| `$buy <item>` | Kaufen → Inventar |
| `$inv` | Inventar anzeigen |
| `$gift @user <item>` | Verschenken (kauft automatisch nach, wenn genug Kupfer auf dem Konto). Geschenk an den Ehepartner: **+25 Love-XP + Erinnerung** |
| `$pay @user <betrag>` | Kupfer überweisen (max. 10.000) |
| `$rob @user` | 40% Erfolgschance, 1h Cooldown, 10% Einsatz — Erfolg lootet bis ~35%, Misserfolg kostet Strafe |

### 💌 & 🏆 mehr
| Befehl | Wirkung |
|---|---|
| `$letter @user [romantisch\|suess\|lustig]` | Liebesbrief (an Partner: +15 Love-XP) |
| `$achievements` | 13 Achievements im Überblick (✅/🔒) |
| `$hangman [buchstabe\|wort\|stop]` | Galgenmännchen, Thema Liebe, 50 🪙 Belohnung, 8 Leben — eine Runde pro Chat |
| `$riddle [antwort\|tipp]` | Rätsel mit 5 Versuchen + Tipp-Funktion, 30 🪙 |
| `$wouldyou` | „Würdest du eher …?“-Diskussionsstarter |
| `$horoskop <zeichen>` | Tageshoroskop (Liebe/Glück/Tipp) |

## Achievements (13)

`first_pet` `pet_lv5` `first_gift` `gifts_10` `first_letter` `married`
`couple_7` `streak_7` `streak_30` `rich_1000` `hangman_win` `riddle_ok` `big_spender`

Freischaltung popup-artig direkt unter dem Befehlsergebnis:
```
🏆 ACHIEVEMENT UNLOCKED!
🎁 First Gift
Erstes Geschenk verschenkt.
```

## Integration in Love.js (3 Stellen)

1. **Import** (oben): `import { handleLovePlus, LOVEPLUS_HELP_CMDS } from './loveplus.js';`
2. **`default:`-Case** im Befehls-Switch (Ende der Switch-Blöcke) — übergibt
   `sock, msg, from, args, command, pref, quoted, sessionPath, senderJid/Lid,
   userProfile, groupProfile, isGroup, isHost` + Helper-Referenzen.
3. **`HELP_CATEGORIES`**: neue Kategorie `💖 LovePlus — Neu!` → erscheint
   automatisch in `$help`, `$help loveplus` und `$help alle`.

## Website

- `server.js` → `COMMAND_CATEGORIES`: neue Kategorie **LOVEPLUS (NEU)** (19 Befehle)
- `public/js/commands-data.js` regeneriert (Fallback-Daten: jetzt 268 Befehle)
- Startseite: neue Sektion **„Neu: LovePlus-Update“** mit 4 Karten + Chat-Demo
- Befehle-Seite zeigt die Kategorie automatisch mit Tab an

## Bewusst weggelassen (Datenschutz/Jugendschutz)

- **Kein Matchmaking / kein Secret Crush / kein $match zwischen echten Nutzern**:
  Der Bot speichert Alter & Status; in Gruppen mit Minderjährigen wäre
  „Wer hat wen als Crush markiert“ ein Risiko. `$ship` bleibt als rein
  zufallsbasierter Gag erhalten.
- Speicherung bewusst minimal: keine Nachrichteninhalte, keine Profile anderer
  Nutzer — nur Zähler, Pets, Inventar, Achievements pro Nutzer-ID.

## Fehlerbehandlung

- Modul-Fehler fangen sich selbst (`try/catch`) und werfen den Bot nicht um.
- Unbekannte Befehle geben `false` zurück → Verhalten wie vorher.

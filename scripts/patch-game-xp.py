#!/usr/bin/env python3
# Einmal-Patch: Game-XP in loveplus.js — ersetzt exakt die Ziel-Zeile (aus der Datei gelesen)
import io

p = 'loveplus.js'
lines = io.open(p, encoding='utf-8').read().split('\n')
done = []

def find_line(marker, start=0):
    for i in range(start, len(lines)):
        if marker in lines[i]:
            return i
    return -1

# 1) Hangman-Verlust: +2 Trost-XP
i = find_line('Verloren!* Das Wort war')
assert i > 0, 'Verloren-Zeile nicht gefunden'
old = lines[i]
assert "word + " in old and "hangman_" in old
lines[i] = old.replace(
    "word + " + chr(39) + "*.",
    "word + " + chr(39) + "*." + chr(39) + " + xpLine + " + chr(39)
)
# xpLine-Vorbereitung vor der delete-Zeile einschieben
j = i - 1
assert lines[j] == "        delete games['hangman:' + from];"
lines[j:j] = [
    "        const xpLine = gameXpLine(ctx, 2, 'games');",
    "        ctx.helpers.saveUserProfile(userProfile);",
]
done.append('Hangman-Verlust +2 XP')

# 2) Rätsel gelöst: +15 XP
i = find_line('RICHTIG!*')
assert i > 0, 'Rätsel-RICHTIG-Zeile nicht gefunden'
old = lines[i]
assert "reward + ' Kupfer' + (unlocked.length" in old
lines[i] = old.replace(
    "reward + ' Kupfer' + (unlocked.length",
    "reward + ' Kupfer' + xpLine + (unlocked.length"
)
# Vorbereitung einschieben: vor 'delete games[key];' in diesem Block
j = i - 2
assert lines[j] == "      delete games[key];"
lines[j:j] = ["      const xpLine = gameXpLine(ctx, 15, 'games');", "      ctx.helpers.saveUserProfile(userProfile);"]
# aber: es gibt ZWEI 'delete games[key];' — wir brauchen die im RICHTIG-Block.
# Sicherheits-Check: Zeile davor muss 'ctx.helpers.saveUserProfile(userProfile);' (originale) sein
done.append('Rätsel-Sieg +15 XP')

# 3) Rätsel 5 Versuche: +2 XP
i = find_line('5 Versuche vorbei')
assert i > 0, '5-Versuche-Zeile nicht gefunden'
old = lines[i]
assert "a + " + chr(39) + "*." in old
lines[i] = old.replace(
    "a + " + chr(39) + "*.",
    "a + " + chr(39) + "*." + chr(39) + " + xpLine + " + chr(39)
)
j = i - 1
assert lines[j] == "        delete games[key];"
lines[j:j] = ["        const xpLine = gameXpLine(ctx, 2, 'games');", "        ctx.helpers.saveUserProfile(userProfile);"]
done.append('Rätsel-Fehlschlag +2 XP')

# 4) Rob Erfolg: +15 XP
i = find_line('RAUB ERFOLGREICH')
assert i > 0, 'Rob-Erfolg-Zeile nicht gefunden'
old = lines[i]
assert "Kupfer* abgenommen!" in old
q = chr(39)
lines[i] = old.replace(
    "abgenommen! \U0001f608" + q,
    "abgenommen! \U0001f608" + q + " + xpLine + " + q
)
j = i - 1
assert lines[j] == "    ctx.helpers.saveUserProfile(userProfile);", repr(lines[j])
lines[j:j] = ["    const xpLine = gameXpLine(ctx, 15, 'games');"]
done.append('Rob-Erfolg +15 XP')

# 5) Rob geschnappt: +2 XP
i = find_line('GESCHNAPPT')
assert i > 0, 'Rob-Geschnappt-Zeile nicht gefunden'
old = lines[i]
assert "1 Stunde. \U0001f694" in old
q = chr(39)
lines[i] = old.replace(
    "1 Stunde. \U0001f694" + q,
    "1 Stunde. \U0001f694" + q + " + xpLine + " + q
)
j = i - 1
assert lines[j] == "    ctx.helpers.saveUserProfile(userProfile);", repr(lines[j])
lines[j:j] = ["    const xpLine = gameXpLine(ctx, 2, 'games');"]
done.append('Rob-Geschnappt +2 XP')

io.open(p, 'w', encoding='utf-8').write('\n'.join(lines))
print('Erledigt:')
for d in done:
    print(' -', d)

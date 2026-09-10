#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
LoveBot - PASSWORT-SCHUTZ fuer Office-Dateien (kein Makro noetig)
=================================================================
Verschluesselt .xlsx/.xlsm/.docx/.docm/.pptx/.pptm mit der offiziellen
Office-Agile-Verschluesselung (ECMA-376). Beim Oeffnen fragt Excel/Word/
PowerPoint selbst nach dem Passwort - auf jedem Gerät, ohne "Inhalt
aktivieren", ohne Makros. Excel/Word/LibreOffice koennen die Datei dann
nicht ohne Passwort oeffnen.

Benutzung (Python 3):
    python3 schuetzen-passwort.py Datei.xlsx
    python3 schuetzen-passwort.py Datei.xlsx Datei.pptx -p 'DeinPasswort'
    python3 schuetzen-passwort.py Ordner               (alle Dateien im Ordner)
    python3 schuetzen-passwort.py Ordner -o Ausgabe

Ohne -p wird das Passwort verdeckt abgefragt (nichts landet in Logs).
Ergebnis: "<Name> (geschuetzt).xlsx" im Ausgabeordner.
Kein Passwort wird in Dateien oder Logs gespeichert.
"""
import argparse
import getpass
import io
import os
import sys

EXTENSIONS = ('.xlsx', '.xlsm', '.docx', '.docm', '.pptx', '.pptm')

try:
    from msoffcrypto.method.ecma376_agile import ECMA376Agile
    import msoffcrypto
except Exception as exc:  # pragma: no cover
    sys.exit('FEHLER: fehlende Bibliothek msoffcrypto-tool.\n'
             'Installation:  pip install msoffcrypto-tool pycryptodome\n'
             'Originalfehler: %s' % exc)


def verschluesseln(datei, passwort, ausgabe_ordner):
    """Verschluesselt eine Datei und prueft den Rundlauf (entschluesseln)."""
    with open(datei, 'rb') as fh:
        original = fh.read()

    gepuffert = ECMA376Agile.encrypt(passwort, io.BytesIO(original))

    name, ext = os.path.splitext(os.path.basename(datei))
    ziel = os.path.join(ausgabe_ordner, name + ' (geschuetzt)' + ext)
    with open(ziel, 'wb') as fh:
        fh.write(gepuffert)

    # Selbsttest: verschluesselt -> entschluesselt muss identisch sein
    try:
        with open(ziel, 'rb') as fh:
            off = msoffcrypto.OfficeFile(fh)
            off.load_key(password=passwort)
            entpackt = io.BytesIO()
            off.decrypt(entpackt)
        if entpackt.getvalue() != original:
            raise RuntimeError('Inhalt stimmt nach Entschluesselung nicht ueberein.')
    except Exception as exc:
        os.remove(ziel)
        raise RuntimeError('Selbsttest fehlgeschlagen: %s' % exc)

    return ziel


def main():
    ap = argparse.ArgumentParser(
        description='LoveBot - Passwort-Schutz fuer Office-Dateien (Office-Verschluesselung).',
        add_help=True)
    ap.add_argument('eingaben', nargs='+',
                    help='Dateien ODER ein Ordner mit Office-Dateien')
    ap.add_argument('-p', '--passwort', default=None,
                    help='Passwort (ohne Angabe wird verdeckt abgefragt)')
    ap.add_argument('-o', '--out', default=None,
                    help='Ausgabeordner (Standard: neben der Eingabe)')
    args = ap.parse_args()

    passwort = args.passwort
    if passwort is None:
        passwort = getpass.getpass('Passwort fuer die Dateien (wird nicht angezeigt): ')
    if not passwort:
        sys.exit('Kein Passwort angegeben - Abbruch.')

    # Eingaben sammeln
    dateien = []
    for e in args.eingaben:
        if os.path.isdir(e):
            for f in sorted(os.listdir(e)):
                if f.lower().endswith(EXTENSIONS):
                    dateien.append(os.path.join(e, f))
        elif os.path.isfile(e):
            if e.lower().endswith(EXTENSIONS):
                dateien.append(e)
            else:
                print('Uebersprungen (kein Office-Format): %s' % e)
        else:
            print('Nicht gefunden: %s' % e)

    if not dateien:
        sys.exit('Keine passenden Dateien (.xlsx/.xlsm/.docx/.docm/.pptx/.pptm).')

    ok = 0
    for d in dateien:
        ausgabe = args.out
        if ausgabe is None:
            ausgabe = os.path.dirname(os.path.abspath(d))
        os.makedirs(ausgabe, exist_ok=True)
        try:
            ziel = verschluesseln(d, passwort, ausgabe)
            print('OK   %s' % ziel)
            ok += 1
        except Exception as exc:
            print('FEHLER %s: %s' % (d, exc))

    print('\nFertig: %d/%d Dateien geschuetzt.' % (ok, len(dateien)))
    print('WICHTIG: Beim Oeffnen fragt Excel/Word/PowerPoint jetzt nach dem Passwort.')
    print('Passwort vergessen = Datei unbrauchbar - Originale vorher sichern!')


if __name__ == '__main__':
    main()

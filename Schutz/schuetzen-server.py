#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
LoveBot - Server-Helfer: Office-Dateien beim Download automatisch schuetzen
==========================================================================
Schuetzt Office-Dateien mit der offiziellen Office-Agile-Verschluesselung
(ECMA-376). Beim Oeffnen fragt Excel/Word/PowerPoint dann selbst nach dem
Passwort - auf jedem Geraet, ohne Makro, ohne "Inhalt aktivieren".

Aufruf (intern, vom LoveBot-Server):
    python3 schuetzen-server.py single <eingabe> <ausgabe>
    python3 schuetzen-server.py zip    <eingabe> <ausgabe>
Das Passwort kommt UEBER DIE UMGEBUNGSVARIABLE LB_PW (nie ueber die
Kommandozeile, damit es nicht in Prozesslisten landet).

zip-Modus: Alle Office-Eintraege INNERHALB einer ZIP werden verschluesselt,
alle anderen Dateien (txt, png, svg, rtf ...) bleiben unveraendert.

Voraussetzung:  pip install msoffcrypto-tool pycryptodome
"""
import io
import os
import sys
import zipfile

OFFICE_EXT = ('.xlsx', '.xlsm', '.docx', '.docm', '.pptx', '.pptm')

try:
    from msoffcrypto.method.ecma376_agile import ECMA376Agile
    import msoffcrypto
except Exception as exc:  # pragma: no cover
    sys.stderr.write('FEHLER: msoffcrypto-tool fehlt. Installation: pip install msoffcrypto-tool pycryptodome\n')
    sys.exit(3)


def verschluesseln(data: bytes, pw: str) -> bytes:
    return ECMA376Agile.encrypt(pw, io.BytesIO(data), spin_count=50000)


def pruefe(data: bytes, enc: bytes, pw: str) -> bool:
    """Rundlauf-Pruefung: verschluesselt -> entschluesselt == Original."""
    try:
        off = msoffcrypto.OfficeFile(io.BytesIO(enc))
        off.load_key(password=pw)
        entpackt = io.BytesIO()
        off.decrypt(entpackt)
        return entpackt.getvalue() == data
    except Exception:
        return False


def main() -> int:
    if len(sys.argv) != 4:
        sys.stderr.write('Aufruf: schuetzen-server.py single|zip <eingabe> <ausgabe>\n')
        return 2
    mode, eingabe, ausgabe = sys.argv[1], sys.argv[2], sys.argv[3]
    pw = os.environ.get('LB_PW', '')
    if not pw:
        sys.stderr.write('LB_PW ist nicht gesetzt.\n')
        return 2

    if mode == 'zip':
        with zipfile.ZipFile(eingabe, 'r') as zin:
            infos = zin.infolist()
            daten = {i.filename: zin.read(i.filename) for i in infos}
        with zipfile.ZipFile(ausgabe, 'w', zipfile.ZIP_DEFLATED) as zout:
            for info in infos:
                d = daten[info.filename]
                if not info.is_dir() and info.filename.lower().endswith(OFFICE_EXT):
                    enc = verschluesseln(d, pw)
                    if not pruefe(d, enc, pw):
                        return 4
                    neuer_info = zipfile.ZipInfo(info.filename, date_time=info.date_time)
                    neuer_info.external_attr = info.external_attr
                    zout.writestr(neuer_info, enc, compress_type=zipfile.ZIP_DEFLATED)
                else:
                    zout.writestr(info, d)
        return 0

    with open(eingabe, 'rb') as f:
        daten = f.read()
    if not daten:
        return 0
    enc = verschluesseln(daten, pw)
    if not pruefe(daten, enc, pw):
        sys.stderr.write('Selbstpruefung fehlgeschlagen.\n')
        return 4
    with open(ausgabe, 'wb') as f:
        f.write(enc)
    return 0


if __name__ == '__main__':
    sys.exit(main())

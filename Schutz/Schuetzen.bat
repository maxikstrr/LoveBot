@echo off
chcp 65001 >nul
title LoveBot - Datei-Login-Schutz
cd /d "%~dp0"
echo.
echo  ==================================================
echo    LoveBot  Datei-Login-Schutz  (Doppelklick)
echo  ==================================================
echo.
echo  Benoetigt: Windows + installiertes Microsoft Office
echo.
set /p PFAD=  Ordner mit den Dateien?  (Enter = dieser Ordner):
if "%PFAD%"=="" set PFAD=.
set /p WORD=  Auch Word-Dateien (.docx) schuetzen?  j/n  [n]:
set WORDARG=
if /i "%WORD%"=="j" set WORDARG=-Word
set /p BRAND=  Firmenname oben im Login?  (Enter = LoveBot):
if "%BRAND%"=="" set BRAND=LoveBot
echo.
echo  Starte Schutz fuer Ordner: %PFAD%   (Marke: %BRAND%)
echo  --------------------------------------------------
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Datei-Login-Schutz.ps1" -Path "%PFAD%" %WORDARG% -Brand "%BRAND%"
echo.
echo  ==================================================
echo   FERTIG.
echo   - Wenn hier eine rote Fehlermeldung stand: bitte
echo     Text abtippen / Screenshot schicken.
echo   - Geschuetzte Dateien: *.xlsm bzw. *.docm
echo   - Originale: Unterordner _Datei-Login-Backup
echo   - Beim Oeffnen einmal "Inhalt aktivieren" klicken,
echo     dann kommt das LoveBot-Login-Fenster.
echo  ==================================================
pause

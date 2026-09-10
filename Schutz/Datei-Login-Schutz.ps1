# ============================================================================
#  LoveBot - DATEI-LOGIN-SCHUTZ  (Windows | Office Word/Excel)
#  ----------------------------------------------------------------------------
#  Schuetzt .xlsx/.docx so, dass die Datei beim Oeffnen erst nach
#  Benutzername + Passwort ihren Inhalt freigibt:
#
#    .xlsx  ->  .xlsm   Excel: LoveBot-Login-Fenster (Firmen-Look), Daten-
#                       blaetter sehr-versteckt. Nach Login freigegeben.
#                       Fallback: erscheint das Fenster nicht, fragt der
#                       Windows-Anmelde-Dialog nach - nie stumm.
#    .docx  ->  .docm   Word: Dokumentfenster verborgen, Login noetig.
#
#  Das Passwort wird NICHT als Klartext gespeichert - nur als codierte
#  Zeichenliste (XOR). Kein Passwort landet in Logs.
#
#  Beispiele:
#    .\Schutz\Datei-Login-Schutz.ps1 -Path .\Downloads
#    .\Schutz\Datei-Login-Schutz.ps1 -Path .\Downloads -Word
#    .\Schutz\Datei-Login-Schutz.ps1 -Path .\Downloads -Password 'DeinPass'
#    .\Schutz\Datei-Login-Schutz.ps1 -Path .\Downloads -Brand 'LoveBot'
#    .\Schutz\Datei-Login-Schutz.ps1 -Path .\Downloads -Dialog Windows
#  -Dialog Form    = LoveBot-Firmen-Login (Standard; Fallback Windows-Dialog
#                    wird bei Problemen automatisch benutzt)
#  -Dialog Windows = nur Windows-Anmelde-Dialog (ohne Formular-Import)
# ============================================================================
#Requires -Version 5.1
[CmdletBinding()]
param(
    [string]$Path     = (Get-Location).Path,
    [string]$UserName = 'Maxichen',
    [string]$Password,
    [string]$Cover    = 'Anmeldung',
    [string]$Brand    = 'LoveBot',
    [ValidateSet('Form', 'Windows')]
    [string]$Dialog   = 'Form',
    [switch]$Word,
    [switch]$KeepOriginals,
    [switch]$SkipVbom
)

$ErrorActionPreference = 'Stop'
$toolDir = $PSScriptRoot
$backupDir = Join-Path $Path '_Datei-Login-Backup'
$XOR = 77

# ---------- Passwort sicher abfragen, falls nicht uebergeben ---------------
if (-not $Password) {
    $sec = Read-Host -AsSecureString 'Datei-Login-Passwort (wird nur codiert in der Datei hinterlegt):'
    $ptr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
    try { $Password = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) } finally { [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}
if ([string]::IsNullOrEmpty($Password)) { Write-Host 'Kein Passwort - Abbruch.' -ForegroundColor Red; exit 1 }
if ([string]::IsNullOrEmpty($UserName)) { Write-Host 'Kein Benutzername - Abbruch.' -ForegroundColor Red; exit 1 }
if ([string]::IsNullOrEmpty($Brand))    { $Brand = 'LoveBot' }

function Read-TextFile([string]$file) {
    return [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::UTF8)
}

function Get-PassCodes([string]$plain) {
    $codes = New-Object System.Collections.Generic.List[int]
    foreach ($ch in $plain.ToCharArray()) { $codes.Add(([int][char]$ch) -bxor $XOR) }
    return ($codes -join ',')
}

function Test-FileLocked($file) {
    try { $fs = [System.IO.File]::Open($file, 'Open', 'ReadWrite', 'None'); $fs.Close(); return $false } catch { return $true }
}

# ---------- Makros / VBA-Objektmodell-Zugriff freischalten ------------------
if (-not $SkipVbom) {
    foreach ($ver in '15.0', '16.0') {
        foreach ($app in 'Excel', 'Word') {
            try { New-Item -Path ("HKCU:\Software\Microsoft\Office\{0}\{1}\Security" -f $ver, $app) -Force | Out-Null } catch {}
            try { Set-ItemProperty -Path ("HKCU:\Software\Microsoft\Office\{0}\{1}\Security" -f $ver, $app) -Name 'AccessVBOM' -Value 1 -Type DWord -Force } catch {}
        }
    }
}

# ---------- Login-Code in ein VBA-Projekt einbauen --------------------------
function Add-LoginCode {
    param($vbProject, [string]$hostName, [string]$dialog, [string]$enc, [string]$userName, [string]$brand, [string]$cover)

    $hostComp = $vbProject.VBComponents.Item($hostName)

    # alten LoveBot-Code aus dem Host-Modul entfernen (nur unserer!)
    if ($hostComp.CodeModule.CountOfLines -gt 0 -and $hostComp.CodeModule.Lines(1, 1) -like '*LoveBot*') {
        $hostComp.CodeModule.DeleteLines(1, $hostComp.CodeModule.CountOfLines)
    }

    # alte Login-Komponenten entfernen (Formular + Kern-Modul)
    foreach ($n in @('frmLogin', 'modLogin')) {
        try { $c = $vbProject.VBComponents.Item($n); $vbProject.VBComponents.Remove($c) } catch {}
    }

    if ($dialog -eq 'Form') {
        # Kern-Modul "modLogin" anlegen (Pruefung + Windows-Fallback)
        $core = Read-TextFile (Join-Path $toolDir 'LoginCore.bas')
        $core = $core.Replace('__LOGIN_USER__', $userName).Replace('__LOGIN_ENC__', $enc).Replace('__BRAND__', $brand)
        $mod = $vbProject.VBComponents.Add(1)
        $mod.Name = 'modLogin'
        $mod.CodeModule.AddFromString($core)

        # LoveBot-Login-Fenster (UserForm) importieren
        $vbProject.VBComponents.Import((Join-Path $toolDir 'LoginForm.frm')) | Out-Null

        # Host-Ereignis-Code
        if ($hostName -eq 'ThisWorkbook') {
            $code = Read-TextFile (Join-Path $toolDir 'vba_login_excel.bas')
            $code = $code.Replace('__LOGIN_COVER__', $cover)
        } else {
            $code = Read-TextFile (Join-Path $toolDir 'vba_login_word.bas')
        }
        $hostComp.CodeModule.AddFromString($code)
    } else {
        # Nur Windows-Anmelde-Dialog (kein Formular-Import)
        $src = if ($hostName -eq 'ThisWorkbook') { 'vba_credui_excel.bas' } else { 'vba_credui_word.bas' }
        $code = Read-TextFile (Join-Path $toolDir $src)
        $code = $code.Replace('__LOGIN_USER__', $userName).Replace('__LOGIN_ENC__', $enc).Replace('__LOGIN_COVER__', $cover)
        $hostComp.CodeModule.AddFromString($code)
    }
}

# ---------- Selbstpruefung: ist der Login wirklich drin? --------------------
function Test-ProjectState {
    param($vbProject, [string]$hostName, [string]$dialog)
    $hostComp = $vbProject.VBComponents.Item($hostName)
    $lines = $hostComp.CodeModule.CountOfLines
    $hasMod = $false; $hasFrm = $false
    foreach ($c in $vbProject.VBComponents) {
        if ($c.Name -eq 'modLogin') { $hasMod = $true }
        if ($c.Name -eq 'frmLogin') { $hasFrm = $true }
    }
    $okCode = ($lines -ge 5)
    $okComp = $hasMod -and ($dialog -ne 'Form' -or $hasFrm)
    return @{ lines = $lines; hasMod = $hasMod; hasFrm = $hasFrm; okCode = $okCode; okComp = $okComp }
}

# ---------- Eine Datei schuetzen (ein Versuch in einem Dialog-Modus) -------
function Protect-File {
    param($file, [string]$dialog)
    $full = $file.FullName
    $isXls = ($file.Extension -like '.xls*')
    $newExt = if ($isXls) { '.xlsm' } else { '.docm' }
    $out = [System.IO.Path]::ChangeExtension($full, $newExt)
    $wb = $null; $xl = $null; $doc = $null; $wd = $null
    try {
        if (Test-FileLocked $full) { throw 'Datei ist gerade geoeffnet - bitte schliessen.' }
        $enc = Get-PassCodes $Password

        if ($isXls) {
            # ---------------- Excel ----------------
            $xl = New-Object -ComObject Excel.Application
            $xl.Visible = $false
            $xl.DisplayAlerts = $false
            $xl.EnableEvents = $false
            $wb = $xl.Workbooks.Open($full)

            $cov = $null
            foreach ($ws in $wb.Worksheets) { if ($ws.Name -eq $Cover) { $cov = $ws } }
            if (-not $cov) { $cov = $wb.Worksheets.Add(); $cov.Name = $Cover }
            $cov.Move($wb.Worksheets.Item(1)) | Out-Null
            $cov.Visible = -1
            $cov.Cells.Clear()
            $cov.Rows.Item(1).RowHeight = 18
            $cov.Cells.Item(3, 1).Value = ('LOVEBOT  ' + [char]0x263E)
            $cov.Cells.Item(3, 1).Font.Size = 22
            $cov.Cells.Item(3, 1).Font.Bold = $true
            $cov.Cells.Item(3, 1).Font.Color = 10079487
            $cov.Cells.Item(4, 1) = 'GESCHUETZTE DATEI - BITTE ANMELDEN'
            $cov.Cells.Item(4, 1).Font.Size = 12
            $cov.Cells.Item(4, 1).Font.Color = 12611584
            $cov.Cells.Item(6, 1) = 'Diese Datei ist nur nach Anmeldung mit Benutzername und Passwort nutzbar.'
            $cov.Cells.Item(6, 1).Font.Italic = $true
            $cov.Cells.Item(8, 1) = 'Es erscheint gleich das LoveBot-Login-Fenster (sonst Windows-Dialog).'
            $cov.Columns.Item(1).ColumnWidth = 72
            $total = 0; $hidden = 0
            foreach ($ws in $wb.Worksheets) {
                $total++
                if ($ws.Name -ne $Cover) { $ws.Visible = 2; $hidden++ }
            }
            $cov.Activate()

            Add-LoginCode -vbProject $wb.VBProject -hostName 'ThisWorkbook' -dialog $dialog -enc $enc -userName $UserName -brand $Brand -cover $Cover

            # Selbstpruefung (im Speicher, vor dem Speichern)
            $st = Test-ProjectState -vbProject $wb.VBProject -hostName 'ThisWorkbook' -dialog $dialog
            if (-not $st.okCode -or -not $st.okComp -or $hidden -ne ($total - 1)) {
                throw ("Selbstpruefung fehlgeschlagen (Code={0} Zeilen, modLogin={1}, frmLogin={2}, versteckt {3}/{4})." -f $st.lines, $st.hasMod, $st.hasFrm, $hidden, ($total - 1))
            }
            $wb.SaveAs($out, 52)
            $wb.Close($false)
            $xl.Quit()
            [System.Runtime.InteropServices.Marshal]::ReleaseComObject($wb) | Out-Null
            [System.Runtime.InteropServices.Marshal]::ReleaseComObject($xl) | Out-Null
            $wb = $null; $xl = $null
        } else {
            # ---------------- Word ----------------
            $wd = New-Object -ComObject Word.Application
            $wd.Visible = $false
            $wd.DisplayAlerts = 0
            $wd.EnableEvents = $false
            $doc = $wd.Documents.Open($full, $false, $true)

            Add-LoginCode -vbProject $doc.VBProject -hostName 'ThisDocument' -dialog $dialog -enc $enc -userName $UserName -brand $Brand -cover $Cover

            $st = Test-ProjectState -vbProject $doc.VBProject -hostName 'ThisDocument' -dialog $dialog
            if (-not $st.okCode -or -not $st.okComp) {
                throw ("Selbstpruefung fehlgeschlagen (Code={0} Zeilen, modLogin={1}, frmLogin={2})." -f $st.lines, $st.hasMod, $st.hasFrm)
            }
            try { $doc.SaveAs2($out, 13) } catch { $doc.SaveAs($out, 13) }
            $doc.Close($false)
            $wd.Quit()
            [System.Runtime.InteropServices.Marshal]::ReleaseComObject($doc) | Out-Null
            [System.Runtime.InteropServices.Marshal]::ReleaseComObject($wd) | Out-Null
            $doc = $null; $wd = $null
        }
        return @{ ok = $true; out = $out; msg = '' }
    } catch {
        try { if ($wb)  { $wb.Close($false) } } catch {}
        try { if ($doc) { $doc.Close($false) } } catch {}
        try { if ($xl)  { $xl.Quit() } } catch {}
        try { if ($wd)  { $wd.Quit() } } catch {}
        return @{ ok = $false; out = $out; msg = $_.Exception.Message }
    }
}

# ---------- Dateien einsammeln ----------------------------------------------
$files = @()
if (-not $Word) {
    $files += Get-ChildItem -Path $Path -File -Filter *.xlsx -ErrorAction SilentlyContinue
    $files += Get-ChildItem -Path $Path -File -Filter *.xlsm -ErrorAction SilentlyContinue
}
if ($Word) {
    $files += Get-ChildItem -Path $Path -File -Filter *.docx -ErrorAction SilentlyContinue
    $files += Get-ChildItem -Path $Path -File -Filter *.docm -ErrorAction SilentlyContinue
}
$files = $files | Select-Object -Unique

if (-not $files) {
    Write-Host 'Keine .xlsx/.xlsm/.docx/.docm im Zielordner gefunden.' -ForegroundColor Yellow
    Write-Host 'PowerPoint (.pptx) kann kein Auto-Login beim Oeffnen - siehe ANLEITUNG.' -ForegroundColor Yellow
    exit 0
}

Write-Host ("Datei-Login-Schutz fuer {0} Datei(en) in: {1}  (Modus: {2}, Marke: {3})" -f $files.Count, $Path, $Dialog, $Brand) -ForegroundColor Cyan
Write-Host "Benutzername: $UserName" -ForegroundColor Cyan

$okCount = 0
$failCount = 0
foreach ($f in $files) {
    Write-Host ("`n> {0}" -f $f.Name) -ForegroundColor White
    $attempts = if ($Dialog -eq 'Form') { @('Form', 'Windows') } else { @('Windows') }
    $result = $null
    foreach ($a in $attempts) {
        if ($a -ne $Dialog) { Write-Host "  ... Formular-Modus fehlgeschlagen - versuche Windows-Dialog als Fallback." -ForegroundColor Yellow }
        $result = Protect-File -file $f -dialog $a
        if ($result.ok) { break }
    }
    if ($result.ok) {
        # Original sichern (nur wenn eine neue Datei entsteht)
        if (-not $KeepOriginals -and ([System.IO.Path]::GetFullPath($f.FullName) -ne [System.IO.Path]::GetFullPath($result.out))) {
            New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
            Move-Item -Force -LiteralPath $f.FullName -Destination (Join-Path $backupDir $f.Name)
        }
        Write-Host ("  OK  geschuetzt als {0}  (Benutzername: {1})" -f ([System.IO.Path]::GetFileName($result.out)), $UserName) -ForegroundColor Green
        $okCount++
    } else {
        Write-Host ("  X  Fehler: {0}" -f $result.msg) -ForegroundColor Red
        $failCount++
    }
}

Write-Host ("`nFertig: {0} OK, {1} fehlgeschlagen." -f $okCount, $failCount) -ForegroundColor Cyan
if (-not $KeepOriginals -and $okCount -gt 0) {
    Write-Host 'Die ungeschuetzten Originale liegen im Unterordner _Datei-Login-Backup (dort spaeter loeschen, sobald alles passt).' -ForegroundColor Yellow
}
Write-Host 'Tipp: Beim ersten Oeffnen einer geschuetzten Datei ggf. "Inhalt aktivieren" bestaetigen - dann erscheint der Login.' -ForegroundColor DarkGray
if ($failCount -gt 0) {
    Write-Host 'Bei Fehlern bitte die Meldung oben abtippen/screenshoten und schicken - dann fixe ich es gezielt.' -ForegroundColor Red
}

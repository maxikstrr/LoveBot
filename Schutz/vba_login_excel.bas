' LoveBot - DATEI-LOGIN (Excel / ThisWorkbook-Modul)
' Beim Oeffnen werden alle Datenblaetter sehr-versteckt und das
' LoveBot-Login-Fenster erscheint. Erst nach erfolgreicher Anmeldung
' wird der Inhalt freigegeben. Falls das Login-Fenster auf einem
' System nicht erscheinen kann, fragt automatisch der Windows-
' Anmelde-Dialog nach (Fallback in modLogin) - es passiert nie nichts.
'
' Platzhalter: __LOGIN_COVER__ -> Name des sichtbaren Anmelde-Blattes
Option Explicit

Private Const COVER_NAME As String = "__LOGIN_COVER__"

Private Sub Workbook_Open()
    On Error Resume Next
    Application.ScreenUpdating = False
    HideDataSheets
    modLogin.ResetLogin
    Dim r As Long
    r = TryFormLogin()
    If r = 0 Then
        ' Formular konnte nicht angezeigt werden -> Windows-Dialog
        modLogin.ResetLogin
        If modLogin.CredUiLogin() Then ShowDataSheets
    ElseIf r = 1 Then
        ShowDataSheets
    End If
    Application.ScreenUpdating = True
End Sub

Private Function TryFormLogin() As Long
    ' 0 = Fehler (Formular nicht verfuegbar)  1 = Login ok  2 = abgebrochen/falsch
    On Error GoTo Fail
    frmLogin.Show
    If modLogin.LoginOK Then
        TryFormLogin = 1
    Else
        TryFormLogin = 2
    End If
    Exit Function
Fail:
    TryFormLogin = 0
End Function

Private Sub HideDataSheets()
    Dim ws As Worksheet
    For Each ws In ThisWorkbook.Worksheets
        If StrComp(ws.Name, COVER_NAME, vbTextCompare) <> 0 Then
            ws.Visible = xlVeryHidden
        End If
    Next ws
    On Error Resume Next
    ThisWorkbook.Worksheets(COVER_NAME).Visible = xlSheetVisible
    ThisWorkbook.Worksheets(COVER_NAME).Activate
End Sub

Private Sub ShowDataSheets()
    Dim ws As Worksheet
    For Each ws In ThisWorkbook.Worksheets
        ws.Visible = xlSheetVisible
    Next ws
    On Error Resume Next
    ThisWorkbook.Worksheets(1).Activate
End Sub

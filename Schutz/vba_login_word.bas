' LoveBot - DATEI-LOGIN (Word / ThisDocument-Modul)
' Beim Oeffnen wird das Dokumentfenster verborgen und das LoveBot-
' Login-Fenster erscheint. Erst nach erfolgreicher Anmeldung wird das
' Dokument sichtbar. Falls das Login-Fenster auf einem System nicht
' erscheinen kann, fragt automatisch der Windows-Anmelde-Dialog nach
' (Fallback in modLogin). Ohne Login wird das Dokument geschlossen,
' ohne dass der Inhalt sichtbar war.
Option Explicit

Private Sub Document_Open()
    On Error Resume Next
    Dim win As Window
    Set win = ActiveWindow
    If Not win Is Nothing Then win.Visible = False

    modLogin.ResetLogin
    Dim r As Long
    r = TryFormLogin()
    If r = 0 Then
        ' Formular konnte nicht angezeigt werden -> Windows-Dialog
        modLogin.ResetLogin
        If modLogin.CredUiLogin() Then r = 1
    End If

    If r = 1 Then
        If Not win Is Nothing Then win.Visible = True
    Else
        MsgBox "Zugriff verweigert - ohne Anmeldung bleibt das Dokument gesperrt.", vbExclamation, "LoveBot - Datei-Login"
        ActiveDocument.Close wdDoNotSaveChanges
    End If
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

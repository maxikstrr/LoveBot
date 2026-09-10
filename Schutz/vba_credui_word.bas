' LoveBot - DATEI-LOGIN (Word, Fallback: Windows-Anmelde-Dialog)
'  LoveBot – DATEI-LOGIN (Word)
'  Beim Öffnen des Dokuments erscheint ein Login-Fenster
'  (Benutzername + Passwort). Ohne korrekte Anmeldung wird das
'  Dokument geschlossen.
'
'  Platzhalter werden vom „Datei-Login-Schutz“-Tool ersetzt:
'    __LOGIN_USER__   → Benutzername
'    __LOGIN_ENC__    → Passwort (XOR-codierte Zeichencodes)
' ============================================================
Private Const LOGIN_USER As String = "__LOGIN_USER__"
Private Const LOGIN_ENC As String = "__LOGIN_ENC__"
Private Const XOR_KEY As Long = 77

#If VBA7 Then
Private Type CREDUI_INFO
    cbSize As Long
    hwndParent As LongPtr
    pszMessageText As LongPtr
    pszCaptionText As LongPtr
    hbmBanner As LongPtr
End Type
#Else
Private Type CREDUI_INFO
    cbSize As Long
    hwndParent As Long
    pszMessageText As Long
    pszCaptionText As Long
    hbmBanner As Long
End Type
#End If

#If VBA7 Then
Private Declare PtrSafe Function CredUIPromptForWindowsCredentialsW Lib "credui.dll" (ByRef UiInfo As CREDUI_INFO, ByVal dwAuthError As Long, ByRef pulAuthPackage As Long, ByVal pvInAuthBuffer As LongPtr, ByVal ulInAuthBufferSize As Long, ByRef pszOutAuthBuffer As LongPtr, ByRef pulOutAuthBufferSize As Long, ByRef pfSave As Long, ByVal dwFlags As Long) As Long
Private Declare PtrSafe Function CredUnPackAuthenticationBufferW Lib "credui.dll" (ByVal dwFlags As Long, ByVal pAuthBuffer As LongPtr, ByVal cbAuthBuffer As Long, ByVal pszUserName As LongPtr, ByRef pcchMaxUserName As Long, ByVal pszDomainName As LongPtr, ByRef pcchMaxDomainName As Long, ByVal pszPassword As LongPtr, ByRef pcchMaxPassword As Long) As Long
Private Declare PtrSafe Sub CoTaskMemFree Lib "ole32.dll" (ByVal pv As LongPtr)
#Else
Private Declare Function CredUIPromptForWindowsCredentialsW Lib "credui.dll" (ByRef UiInfo As CREDUI_INFO, ByVal dwAuthError As Long, ByRef pulAuthPackage As Long, ByVal pvInAuthBuffer As Long, ByVal ulInAuthBufferSize As Long, ByRef pszOutAuthBuffer As Long, ByRef pulOutAuthBufferSize As Long, ByRef pfSave As Long, ByVal dwFlags As Long) As Long
Private Declare Function CredUnPackAuthenticationBufferW Lib "credui.dll" (ByVal dwFlags As Long, ByVal pAuthBuffer As Long, ByVal cbAuthBuffer As Long, ByVal pszUserName As Long, ByRef pcchMaxUserName As Long, ByVal pszDomainName As Long, ByRef pcchMaxDomainName As Long, ByVal pszPassword As Long, ByRef pcchMaxPassword As Long) As Long
Private Declare Sub CoTaskMemFree Lib "ole32.dll" (ByVal pv As Long)
#End If

Private Const CRED_PASSWORD As Long = &H1
Private Const CREDUI_FLAGS_ALWAYS_SHOW_UI As Long = &H80
Private Const CREDUI_FLAGS_GENERIC_CREDENTIALS As Long = &H1

' ---------- Auto-Start beim Öffnen -----------------------------
Private Sub Document_Open()
    On Error Resume Next
    Dim u As String, p As String
    If Not PromptLogin(u, p) Then Exit Sub
    If StrComp(u, LOGIN_USER, vbTextCompare) = 0 And StrComp(p, DecodePass(), vbBinaryCompare) = 0 Then Exit Sub
    MsgBox "Zugriff verweigert." & vbCrLf & _
           "Benutzername oder Passwort sind falsch." & vbCrLf & _
           "Das Dokument wird geschlossen.", vbExclamation, "LoveBot – Datei-Login"
    ActiveDocument.Close wdDoNotSaveChanges
End Sub

Private Function DecodePass() As String
    Dim parts() As String, i As Long, out As String
    parts = Split(LOGIN_ENC, ",")
    For i = LBound(parts) To UBound(parts)
        If Len(parts(i)) > 0 Then out = out & ChrW(CLng(parts(i)) Xor XOR_KEY)
    Next i
    DecodePass = out
End Function

Private Function PromptLogin(ByRef uname As String, ByRef pword As String) As Boolean
#If VBA7 Then
    Dim ui As CREDUI_INFO, authPkg As Long, pfSave As Long
    Dim outBuf As LongPtr, outSize As Long, ret As Long
    Dim msgPtr As LongPtr, capPtr As LongPtr
    ui.cbSize = LenB(ui)
    msgPtr = StrPtr("Bitte melde dich mit Benutzername und Passwort an, um dieses Dokument zu öffnen.")
    capPtr = StrPtr("LoveBot – Datei-Login")
    ui.pszMessageText = msgPtr
    ui.pszCaptionText = capPtr
    ret = CredUIPromptForWindowsCredentialsW(ui, 0, authPkg, 0, 0, outBuf, outSize, pfSave, CREDUI_FLAGS_ALWAYS_SHOW_UI Or CREDUI_FLAGS_GENERIC_CREDENTIALS)
    If ret = 0 Then
        If UnpackCredentials(outBuf, outSize, uname, pword) Then PromptLogin = True
    End If
    If outBuf <> 0 Then CoTaskMemFree outBuf
#Else
    uname = InputBox("Benutzername:", "LoveBot – Datei-Login")
    If uname = "" Then Exit Function
    pword = InputBox("Passwort:", "LoveBot – Datei-Login")
    If pword = "" Then Exit Function
    PromptLogin = True
#End If
End Function

#If VBA7 Then
Private Function UnpackCredentials(ByVal buf As LongPtr, ByVal bufSize As Long, ByRef uname As String, ByRef pword As String) As Boolean
    Dim uNameLen As Long, pWordLen As Long, ret As Long
    uNameLen = 256
    pWordLen = 512
    Dim uName As String, pWord As String
    uName = String(256, vbNullChar)
    pWord = String(512, vbNullChar)
    ret = CredUnPackAuthenticationBufferW(CRED_PASSWORD, buf, bufSize, StrPtr(uName), uNameLen, 0, 0, StrPtr(pWord), pWordLen)
    If ret = 0 Then Exit Function
    uname = Left$(uName, uNameLen - 1)
    pword = Left$(pWord, pWordLen - 1)
    UnpackCredentials = True
End Function
#End If

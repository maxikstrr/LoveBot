VERSION 5.00
Begin VB.UserForm frmLogin
   Caption         =   "LoveBot - Datei-Login"
   ClientHeight    =   5520
   ClientLeft      =   60
   ClientTop       =   390
   ClientWidth     =   6900
   StartUpPosition =   1  'CenterOwner
   Begin VB.CommandButton cmdLogin
      Caption         =   "ANMELDEN"
      Height          =   495
      Left            =   2460
      TabIndex        =   6
      Top             =   4440
      Width           =   1995
   End
   Begin VB.TextBox txtPass
      Height          =   420
      Left            =   1560
      TabIndex        =   5
      Top             =   3330
      Width           =   3900
   End
   Begin VB.TextBox txtUser
      Height          =   420
      Left            =   1560
      TabIndex        =   3
      Top             =   2430
      Width           =   3900
   End
   Begin VB.Label lblLine
      BackStyle       =   0  'Transparent
      Caption         =   ""
      Height          =   90
      Left            =   60
      TabIndex        =   9
      Top             =   1410
      Width           =   6780
   End
   Begin VB.Label lblFoot
      BackStyle       =   0  'Transparent
      Caption         =   "LoveBot by Maxichen - Firmen-Login aktiv"
      Height          =   270
      Left            =   240
      TabIndex        =   8
      Top             =   5160
      Width           =   6420
   End
   Begin VB.Label lblMsg
      BackStyle       =   0  'Transparent
      Caption         =   ""
      Height          =   330
      Left            =   1560
      TabIndex        =   7
      Top             =   3930
      Width           =   3900
   End
   Begin VB.Label lblPass
      BackStyle       =   0  'Transparent
      Caption         =   "Passwort"
      Height          =   300
      Left            =   1560
      TabIndex        =   4
      Top             =   3030
      Width           =   2400
   End
   Begin VB.Label lblUser
      BackStyle       =   0  'Transparent
      Caption         =   "Benutzername"
      Height          =   300
      Left            =   1560
      TabIndex        =   2
      Top             =   2130
      Width           =   2400
   End
   Begin VB.Label lblSub
      BackStyle       =   0  'Transparent
      Caption         =   "Sicherer Dokumenten-Zugriff"
      Height          =   330
      Left            =   240
      TabIndex        =   1
      Top             =   960
      Width           =   6420
   End
   Begin VB.Label lblBrand
      BackStyle       =   0  'Transparent
      Caption         =   "LOVEBOT"
      Height          =   600
      Left            =   240
      TabIndex        =   0
      Top             =   240
      Width           =   6420
   End
End
Attribute VB_Name = "frmLogin"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = False

Option Explicit

Private Const MAX_TRIES As Long = 3
Private mTries As Long

Private Sub StyleControl(c As Control, sz As Single, bold As Boolean, col As Long)
    With c
        .Font.Name = "Segoe UI"
        .Font.Size = sz
        .Font.Bold = bold
        .ForeColor = col
        .BackStyle = 0
    End With
End Sub

Private Sub UserForm_Initialize()
    Me.Caption = modLogin.BRAND_TEXT & " - Datei-Login"
    Me.BackColor = &H0015101F
    mTries = 0

    lblBrand.Caption = UCase$(modLogin.BRAND_TEXT)
    StyleControl lblBrand, 22, True, &H00952DFF
    lblBrand.TextAlign = 2

    lblSub.Caption = "Sicherer Dokumenten-Zugriff"
    StyleControl lblSub, 10, False, &H00C4BBD8
    lblSub.TextAlign = 2

    lblLine.BackColor = &H00952DFF

    lblUser.Caption = "Benutzername"
    StyleControl lblUser, 10, False, &H00E8E2F4

    lblPass.Caption = "Passwort"
    StyleControl lblPass, 10, False, &H00E8E2F4

    lblMsg.ForeColor = &H000040FF
    lblMsg.BackStyle = 0
    lblMsg.Font.Name = "Segoe UI"

    lblFoot.Caption = ChrW(169) & " " & modLogin.BRAND_TEXT & " by Maxichen - Firmen-Login aktiv"
    lblFoot.ForeColor = &H008E8E9E
    lblFoot.BackStyle = 0
    lblFoot.Font.Name = "Segoe UI"
    lblFoot.Font.Size = 8

    txtUser.Font.Name = "Segoe UI"
    txtPass.Font.Name = "Segoe UI"
    txtPass.PasswordChar = "*"
    txtUser.MaxLength = 64
    txtPass.MaxLength = 64

    cmdLogin.Font.Name = "Segoe UI"
    cmdLogin.Font.Bold = True
    cmdLogin.BackColor = &H00B02DFF
    cmdLogin.ForeColor = &H00FFFFFF
    cmdLogin.Default = True
End Sub

Private Sub cmdLogin_Click()
    Dim u As String
    Dim p As String
    lblMsg.Caption = ""
    u = Trim$(txtUser.Text)
    p = txtPass.Text
    If Len(u) = 0 Or Len(p) = 0 Then
        lblMsg.Caption = "Bitte Benutzername und Passwort eingeben."
        Exit Sub
    End If
    If modLogin.CheckLogin(u, p) Then
        Unload Me
        Exit Sub
    End If
    mTries = mTries + 1
    If mTries >= MAX_TRIES Then
        lblMsg.Caption = "Zu viele Versuche - diese Datei bleibt gesperrt."
        cmdLogin.Enabled = False
        txtUser.Enabled = False
        txtPass.Enabled = False
    Else
        lblMsg.Caption = "Benutzername oder Passwort falsch."
        txtPass.Text = ""
        txtPass.SetFocus
    End If
End Sub

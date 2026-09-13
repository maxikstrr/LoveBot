# 💎 LoveBot · Liquid-Glass-Designsystem

Zentrales Designsystem für die **gesamte** LoveBot-Oberfläche — Bot-Reports
(`$ping`, `$sys`) und komplette Website. Die Designsprache folgt der Referenz
aus `public/test.html` („Liquid Glass — exakt aus Vorgabe“): mehrschichtiges
Glas, elliptische Glanzlichter, Rim-Light, Gradient-Titel und die
Kategorie-Palette Violett · Cyan · Bernstein · Rose.

---

## 1 · Architektur — EIN System, ALLE Oberflächen

```
public/css/liquid-glass.css     ← das EINE zentrale Designsystem (Tokens + Komponenten)
        ↑ injiziert als letztes <link> in JEDE HTML-Seite (server.js · serveStatic)
        ↑
   ┌────┴─────────────────────────────────────────────┐
   │                                                  │
Style-2026-Seiten        Midnight-Control-SPA         Soul-Echo-Control-Center
(style.css)              (night.css · app.html)        (control.css · control.html)
Landing · Login ·         Hash-Router · Panels ·        cc-*-Komponenten ·
Dashboard · Admin ·       Tabellen · Modals ·           Modals · Tabs ·
Sessions · Status ·       Toasts                        Health-Bars · Feature-Registry
Statistik · Bestenliste …

glassCard.js              ← Liquid-Glass-Karten (PNG) für WhatsApp-Reports
        ↑
   $ping (pingcmd.js)  ·  $sys (Love.js → systemReport.js)
```

**Bewusst so gebaut:** Es gibt genau EINE Implementierung der Glas-Optik —
nicht fünf verschiedene. Alle Änderungen an Tokens wirken sofort überall.

## 2 · Design-Tokens (`--lg-*`)

| Token | Bedeutung |
|---|---|
| `--lg-hi` / `--lg-edge` / `--lg-inner` / `--lg-counter` | Kanten: obere Innenkante · Außenkante · Innenkante · dunkle Gegenkante |
| `--lg-sheen` / `--lg-tl` / `--lg-br` | radialer Sheen · Glanzlicht oben-links · Glanzlicht unten-rechts |
| `--lg-bg` / `--lg-bg-strong` / `--lg-bg-soft` | fertige Glas-Verlaufsstapel (Standard · Hero · zart) |
| `--lg-stack` / `--lg-shadow` / `--lg-shadow-lg` | kompletter Schatten-Stapel (Kanten + Tiefen) |
| `--lg-blur` / `--lg-blur-nav` | `backdrop-filter`-Stufen (14px / 20px + Sättigung) |
| `--lg-violet` · `--lg-cyan` · `--lg-amber` · `--lg-rose` | Kategorie-Akzente (wie Referenz-PALETTE) |
| `--lg-title-grad` | Titel-Gradient weiß → lavendel → cyan |
| `--lg-t` | Motion-Kurve für Übergänge |

## 3 · Kern-Klassen (für neue Views)

```html
<div class="lg lg-rim">        <!-- Standard-Glasfläche + Rim-Light -->
<div class="lg-strong">        <!-- Hero-Glas (Modals, Login-Karten) -->
<span class="lg-soft">         <!-- zarte Glas-Pille (Chips, Badges) -->
<h1 class="lg-text">           <!-- Gradient-Titel -->
<span class="lg-dot" style="color:var(--lg-ok)"></span>  <!-- leuchtender Status-Punkt -->
<div class="lg-acc">           <!-- Akzent-Balken links -->
```

## 4 · Abgedeckte Bereiche

- **Shell 1 (Design-2026):** Topnav · Sidebar/Nav-Pills · Buttons (primary/ghost)
  · Cards · Boxen · Stats · Pills/Chips/Badges · Formulare/Inputs · Code-Input ·
  Terminal · Toast · KV-Listen · Session-Karten · Level-Karten · Tabellen ·
  Auth-Karte · Chat-Demo · Livebar · Log-Ansicht
- **Shell 2 (Midnight-SPA):** Side · Nav · Top-Chips · Panels · Stats ·
  Tabellen · Pills · Buttons · Modal · Toasts · Router-Console
- **Shell 3 (Control-Center):** cc-top · cc-tiles · cc-sections · cc-stats ·
  cc-navitems · cc-buttons · cc-tabs · cc-modals · Health-Bars · Feature-Cards ·
  Tags · Empty-States
- **Overlays (alle Shells):** DSGVO-Consent-Gate · Security-Block ·
  Wartungsmodus-Seite (maintgate.js)
- **Fehlerseiten:** 404/500 als Liquid-Glass-Seite für Browser-Navigationen
  (API/Tools erhalten weiterhin schlanke Text-/JSON-Antworten)
- **Barrierefreiheit:** klarer `:focus-visible`-Glas-Ring, vollständige
  `prefers-reduced-motion`-Unterstützung, `@supports`-Fallback ohne Blur

**Nicht verändert:** Layouts, Logik, Auth, RBAC, API, Sessions, Datenbank,
Business-Logik — das System ist rein additiv (Oberflächen: Hintergrund ·
Rahmen · Schatten · Blur).

## 5 · Befehle-Seite (cmd.html) — Karten mit BEFEHL · BEISPIEL · ERKLÄRUNG

Die Befehls-Seite zeigt jeden Befehl als eigene Liquid-Glass-Karte im
Referenz-Layout:

```
▎$givecoins @person <anzahl> [bank] <grund>     [⧉]
  BEISPIEL    ┃ $givecoins @Leni 100 Geschein … ┃   ← Glas-Pille, klick = kopieren
  ERKLÄRUNG   Schenkt einem Nutzer Münzen aus der Bot-Kasse …
```

- **Kategorie-Sections** wie in der Referenz: leuchtender Dot + Gradient-Titel
  (Violett · Cyan · Bernstein · Rose je Kategorie) + Glas-Zähler-Pille — ohne
  störendes Panel drumherum, die Karten selbst sind das Glas.
- **Beispiel-Generator** (in `cmd.js`): wandelt die Usage in ein konkret
  nutzbares Beispiel (`$marry @user` → `$marry @Leni`, `<anzahl>` → `5`,
  `TT.MM.[JJJJ]` → `14.02.2010`, `on|off` → `on`, `owner/repo` →
  `maxikstrr/LoveBot` …). Optionale `[ … ]`-Teile werden weggelassen — das
  Beispiel zeigt immer die minimale funktionierende Nutzung.
- **Klick auf die Karte kopiert das Beispiel** (sofort benutzbar statt nur
  der Befehlsname); Syntax-Highlighting auch im Beispiel.
- Suche, Kategorie-Tabs, `/`-Shortcut, Aliase, Rechte-Badges und
  Copy-Feedback bleiben vollständig erhalten.

Tests: `node scripts/cmdpage-selftest.mjs` (DOM-Smoke-Test mit echten Daten —
prüft u. a., dass keine Karte einen ungefüllten Platzhalter ins Beispiel
lässt) · `node scripts/build-cmd-preview.mjs` baut eine statische
Design-Vorschau ohne Server.

## 6 · `$ping` & `$sys` — Glas-Karten für WhatsApp (glassCard.js)

Beide Commands senden ihre Reports jetzt zusätzlich als hochwertige
Liquid-Glass-PNG-Karte (900 px breit, @2x gerastert):

- **$ping** (`pingcmd.js → renderPingCard`): Health-Score-Balken + alle
  Messbereiche (Bot · Websites · Connection · Network · Speed · System ·
  Issues) mit Status-Dots aus den ECHTEN Messwerten.
- **$ping \<url\>** (`pingcmd.js → renderWebsiteCard`): Website-Ping-Karte
  mit Verdict, Zeiten (DNS · TCP · TLS · TTFB · Gesamt), Antwort-Details und
  ICMP — auch im OFFLINE-Fall als klar erkennbare Karte.
- **$sys** (`Love.js case 'sys' → renderSysCard`): System-Status-Karte aus
  dem echten `buildSystemReport`-Report.

Technik: SVG (nur Gradients — keine Filter, damit jedes librsvg identisch
rastert) → `sharp` → PNG. **Robustheit:** Ist `sharp` auf dem System nicht
ladbar, liefern die Renderer `null` zurück und die Commands senden einfach
nur den bewährten Text-Report — kein Befehl bricht je wegen des Designs.
Alle Messungen, Bewertungen, Reactions und Text-Reports bleiben vollständig
erhalten; die Karte ist eine zusätzliche Darstellung derselben Werte.

Da `glassCard.js` `sharp` direkt importiert, steht es jetzt auch in
`package.json` als eigene Abhängigkeit (war zuvor nur transitiv über
`@neelegirly/downloader` gebunden; Version unverändert).

## 7 · Selbsttest

```bash
node scripts/glasscard-selftest.mjs
```

Rendert eine `$ping`- und eine `$sys`-Beispielkarte mit realistischen
Mock-Daten (gleiche Shapes wie `netping.js`/`systemReport.js`) und prüft
per Pixel-Analyse, dass Titel, Health-Balken, Herz-Marke, Sections und
Texte tatsächlich gerastert wurden.

## 8 · Geänderte / neue Dateien

| Datei | Art | Inhalt |
|---|---|---|
| `public/css/liquid-glass.css` | erweitert (66 → ~980 Zeilen) | das zentrale Designsystem |
| `public/css/style.css` | ergänzt | Befehle-Seite: neue Glas-Karten (Befehl · Beispiel · Erklärung) + Kategorie-Sections + Glas-Tabs |
| `public/js/cmd.js` | ergänzt | Beispiel-Generator + neuer Karten-Renderer + Kategorie-Akzente |
| `public/cmd.html` | ergänzt | Unterzeile: Karte = Befehl · Beispiel · Erklärung |
| `glassCard.js` | **neu** | SVG-Karten-Baukasten ($ping · $ping \<url\> · $sys) + sharp-Rasterung + Fallback |
| `pingcmd.js` | ergänzt | `$ping` sendet zusätzlich die Glas-Karte (alle Modi inkl. Website-Ping) |
| `Love.js` | ergänzt (2 Stellen) | `$sys` sendet zusätzlich die Glas-Karte |
| `server.js` | ergänzt | Liquid-Glass-404/500 für Browser-Navigationen |
| `public/js/maintgate.js` | ergänzt | Wartungsseite im vollen Referenz-Glas |
| `package.json` | ergänzt | `sharp` als direkte Abhängigkeit · `npm run test:glass` |
| `scripts/glasscard-selftest.mjs` | **neu** | Karten-Selbsttest (3 Karten, Pixel-Verifikation) |
| `scripts/cmdpage-selftest.mjs` | **neu** | Befehle-Seite: DOM-Smoke-Test mit echten Daten |
| `scripts/build-cmd-preview.mjs` | **neu** | Befehle-Seite: statische Design-Vorschau bauen |
| `LIQUID-GLASS.md` | **neu** | diese Dokumentation |

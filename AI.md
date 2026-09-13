# 🤖 LoveKI — Architektur (7.1.2)

> **LoveKI ist der Copilot des Bots** — wie GitHub Copilot ein Repository kennt:
> Sie kennt LoveBot KOMPLETT (332 Befehle, alle 40 Web-Seiten, jedes Feature,
> Live-Systemstatus), erklärt alles — und ist strikt **READ-ONLY**: Sie darf
> niemals etwas ändern. Zusätzlich antwortet sie (mit kostenlosem API-Key)
> auf jede allgemeine Frage wie ChatGPT. Und sie **stirbt nie**: 3-Stufen-Kette.

## Die 3-Stufen-Kette (ChainProvider)

```
$ai / Web-Chat
      │
      ▼
┌──────────────────────────────────────┐
│  1. Ollama 🦙 (lokal, privat)        │  läuft Ollama lokal? → wird genutzt
│  2. Cloud-KI ☁️ (ECHTE KI)           │  kostenloses API-Key-Modell:
│     · Groq (Llama 3.3 70B) ★         │  console.groq.com → „$aiconfig key gsk_…“
│     · Google Gemini (Flash)          │  aistudio.google.com → „$aiconfig key AIza…“
│     · OpenRouter / Mistral /         │  oder custom (LM Studio & jeder
│       Cerebras / Pollinations        │  OpenAI-kompatible Server)
│  3. LoveAI Core 💜 (eingebaut)       │  IMMER verfügbar — offline, 0 ms
└──────────────────────────────────────┘
```

- **Kein Neustart nötig:** Health-Checks mit Cache (Ollama 30 s · Cloud 60 s).
  Fällt eine Stufe **mitten in einer Anfrage** aus, wechselt die Kette sofort
  auf die nächste („[AI] Tier-Fallback“) und sperrt die Stufe 60 s.
- **Startet mit dem Bot:** `bootAi()` (ai/boot.js) läuft beim Start von
  `server.js` UND `Love.js`, versucht sogar `ollama serve` mitzustarten.

## Echte KI aktivieren (kostenlos, 2 Minuten)

1. Kostenlos registrieren: **console.groq.com** (empfohlen — schnellstes
   Gratis-LLM) oder **aistudio.google.com** — ohne Kreditkarte.
2. Dort einen **API-Key** erstellen und kopieren.
3. Aktivieren — WhatsApp: `$aiconfig key gsk_DEIN_KEY` oder Web-Panel
   (ai.html → „🌟 Echte KI aktivieren“ → Key einfügen → Speichern).

Der Anbieter wird **automatisch am Key erkannt** (`gsk_`→Groq, `AIza`→Gemini,
`sk-or-`→OpenRouter, `csk-`→Cerebras, 32-Zeichen→Mistral). Der Key wird nur
lokal in `Database/ai.json` gespeichert (nie im Chat/Log ausgegeben).

Ohne Key: Kette probiert Pollinations (gratis, ohne Key, best effort) und
fällt sonst auf Core zurück — der Bot bleibt voll nutzbar.

## Copilot-Modus: Bot & Website erklären (read-only)

LoveKI ist fest mit dem Bot verknüpft — wie ein eigener Copilot:

- **Bot-Steckbrief** (`getBotOverview`): Version, 332 Befehle/242 Aliase/17 Kategorien,
  alle Features, Website-Infos — live aus der Registry gelesen.
- **Website-Erklärungen** (`getWebInfo`): alle 40 Web-Panel-Seiten mit Zweck,
  nach Kategorie gruppiert oder als Suche („Was ist auf der Bank-Seite?").
- **Befehl-Erklärung** (`getCommandDetails`): Name, Aliase, Kategorie,
  Beschreibung — direkt aus registry/commands.json („Wie funktioniert $daily?").
- **Live-Systemstatus** (`getSystemStatus`): Node-Version, RAM, Uptime,
  DB-Dateigrößen (read-only per fs.statSync).
- **Copilot-Wissen im System-Prompt** (`ai/knowledge.js` → `buildBotKnowledge()`):
  Jede Engine (Cloud/Ollama/Core) bekommt den Bot-Kontext injiziert — die KI
  „kennt" den Bot, egal welche Stufe antwortet.
- **Offline-konsistent:** Core beantwortet Bot-/Web-/System-Fragen auch ohne
  Cloud (Intents web/botinfo/system → dieselben Tools).

### 🔒 Read-Only-Garantie („nix ändern!")

1. **Tool-Layer:** Alle 12 Tools sind `write:false` — es existiert kein
   Schreib-Tool. runTool() erzwingt die Allowlist + Write-Gate (default aus).
2. **System-Prompt:** „Du bist NUR LESEND — du darfst NIEMALS etwas ändern."
3. **Keine Ausführungswege:** kein eval, kein Datei-Schreiben, keine
   Mutation-Funktionen — die KI kann nur definierte Lesefunktionen aufrufen.
4. **Keine Secrets:** Tools bekommen nur minimale ctx-Daten — niemals
   Sessions, Passwörter, Tokens oder Keys.

## Was die echte KI kann (Cloud-KI ☁️)

- **Allgemeinwissen wie ChatGPT:** „Erklär mir schwarze Löcher“, „Schreib ein
  Gedicht“, Hausaufgaben, Übersetzen, Code, Ideen — alles.
- **Bot-Daten über ECHTE Tools:** Der System-Prompt (ai/context.js) erlaubt
  freies Wissen, erzwingt aber für User-/Bot-Daten die 8 Read-Only-Tools
  (`getUserProfile`, `searchCommands`, `getLevel`, …). Die Cloud-KI gibt
  `TOOL:…`-Zeilen aus → der ReAct-Loop (runReact) führt die echten Tools aus
  → die KI antwortet mit **echten** Leveln, Kontoständen, Befehlen.
- **Aktuelles Datum** im System-Prompt, Memory (Fakten + Verlauf) fließt mit.
- **Engine-Badges überall:** Jede Antwort zeigt woher sie kommt —
  🦙 Ollama / ☁️ Cloud-KI / 💜 Core (WhatsApp-Status, Web-Chat, `/api/ai/status`).

## Dateien

| Datei | Inhalt |
|---|---|
| `ai/cloud.js` | **NEU** — CloudProvider: OpenAI-kompatible Cloud-LLMs; Presets (Groq/Gemini/OpenRouter/Mistral/Cerebras/Pollinations/custom), Key-Autoerkennung, Health mit 60-s-Cache, Timeout/Abort, klassifizierte Fehler |
| `ai/providers.js` | ChainProvider jetzt **3-Tier** (local→cloud→core) mit Per-Request-Fallback + 60-s-Sperre; re-exportiert CloudProvider |
| `ai/context.js` | System-Prompt: echte KI („wie ChatGPT: JEDE Frage“) + Tool-Pflicht für Bot-Daten + aktuelles Datum |
| `ai/memory.js` | Config-Felder: `cloudOn/cloudProvider/cloudKey/cloudModel/cloudEndpoint` (+ ENV-Overrides `AI_CLOUD_*`), Key wird sanitisiert gespeichert |
| `ai/boot.js` | bootAi meldet jetzt alle Stufen („Cloud-KI ☁️ bereit“-Detail) |
| `ai/engine.js` | aiChat gibt `model` der aktiven Engine zurück |
| `ai/report.js` | `$aistatus`: Engine + Cloud-Zeile (läuft / kein Key / aus) |
| `Love.js` | `$aiconfig key <KEY>` (Auto-Erkennung + Live-Test + „🌟 ECHTE KI AKTIVIERT!“), `$aiconfig cloud <an|aus>`, `cloudprovider`, `cloudmodel`, `cloudendpoint` |
| `server.js` | `/api/ai/status` mit `cloud:{on,provider,model,keySet,healthy,hint}`; **NEU** `/api/ai/cloud` (GET/POST/DELETE, Owner-only, Key-Live-Test); Boot-Banner 3-Stufen |
| `public/ai.html` | „🌟 Echte KI aktivieren“-Panel (Anleitung + Key-Eingabe + Live-Test), Cloud-Status-Karte, Wissens-Chips (Schwarzes Loch, Gedicht) |
| `ai/knowledge.js` | **NEU** — Copilot-Gedächtnis: 40 Web-Seiten mit Zweck, Feature-Wissen, Architektur, Registry-Fakten (live gelesen), buildBotKnowledge() fuer den System-Prompt |
| `ai/tools.js` | **NEU:** 4 Copilot-Tools (getBotOverview, getWebInfo, getCommandDetails, getSystemStatus) - alle write:false; jetzt 12 Tools |
| `ai/core.js` | Core (offline): Copilot-Intents (web/botinfo/system/$befehl) ueber dieselben Tools; Wissensfragen verweisen ehrlich auf den kostenlosen Key („$aiconfig key …“) |
| `scripts/ai-selftest.mjs` | **19 Checks** inkl. lokalem OpenAI-kompatiblem Mock-Server: Cloud-Provider, 3-Tier-Kette, ReAct über Cloud, Per-Request-Fallback — `npm run test:ai` |

## Unverändert (bewusst)

Rate-Limits (6/min · 30/h · 200/d — schützt auch die Gratis-Kontingente),
Memory (`Database/ai.json`), Tools-Schicht (read-only), `$ai`-Flow inkl.
Gruppen-Gating, Login-Schutz (401), Owner-Gating für Config (403),
MockProvider-Testgating (`LOVEAI_ALLOW_MOCK=1`), ehrliche Fehlerberichte.

## Privatsphäre-Hinweis

Bei aktiver Cloud-KI werden die Fragen (plus Fakten/Verlauf aus dem Kontext)
an den gewählten Anbieter (z. B. Groq/Google) übertragen — steht auch im
Web-Panel. Wer das nicht will: `$aiconfig cloud aus` → nur noch
Ollama (lokal) / Core (eingebaut).

## Test

```bash
npm run test:ai   # 30 Checks: Core ☁️ Cloud 💜 Chain + Copilot + Fallback, offline lauffähig
```

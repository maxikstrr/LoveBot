# 🤖 LoveAI — Architektur, Betrieb & Troubleshooting (7.0.2)

LoveAI ist die lokale, kostenlose KI von LoveBot. Kein Paid-API, kein Cloud-Zwang:
Standard ist ein lokales Ollama-Backend (`http://127.0.0.1:11434`). Ohne Backend
meldet der Bot ehrlich OFFLINE — niemals Fake-Antworten.

## 1. Architektur

```
WhatsApp ($ai/$ask/A-Chat) ─┐
Website-Chat (/api/ai/chat) ─┴─→ ai/engine.js (aiChat)
                                   ├─ ai/limits.js   (6/min, 60/h, 200/Tag)
                                   ├─ ai/providers.js (LocalProvider: Ollama)
                                   ├─ ai/memory.js    (ai.json: Conv/Fakten/Prefs/Stats)
                                   ├─ ai/context.js   (System-Prompt, ReAct max. 3)
                                   ├─ ai/tools.js     (nur lesend, Gate)
                                   └─ ai/report.js    (Texte für Status/Diagnose/Fehler)
```

`aiChat()`-Pipeline: Limits → Health (30-s-Cache) → Modell-Check → Memory →
ReAct (Tools) → Persist + Stats. Fehler überall klassifiziert, Health-Cache wird
bei Fehlern invalidiert (schnelle Erholung).

## 2. Provider (Ollama-Protokoll)

| Funktion     | Endpoint (POST/GET) | Zweck                          |
|--------------|---------------------|--------------------------------|
| `health()`   | `GET /api/tags`     | Erreichbar? Modelle? Konfig-Modell da? |
| `models()`   | `GET /api/tags`     | Installierte Modelle           |
| `generate()` | `POST /api/generate`| Prompt → Text (ReAct nutzt das) |
| `chat()`     | `POST /api/chat`    | Nachrichten-Array → Text       |
| `stream()`   | `POST /api/generate`| NDJSON-Stream (Abbruch via `$aistop`) |

`llama.cpp` (`llama-server`) ist kompatibel, solange es `/api/tags` + `/api/generate`
im Ollama-Format bedient. `MockProvider` existiert NUR für Tests und wird ohne
`LOVEAI_ALLOW_MOCK=1` nie erzeugt; `provider: mock` ist nicht speicherbar.

## 3. Konfiguration (`Database/ai.json`, Key `config`)

Priorität: **ENV → gespeicherte Config → Default**. Effektive Werte zeigt
`$aiconfig` (Owner ändert via `$aiconfig <key> <wert>`).

| Key           | ENV               | Default                 |
|---------------|-------------------|-------------------------|
| provider      | — (`local` fix)   | `local`                 |
| model         | `AI_MODEL`        | `llama3.1:8b`           |
| baseUrl       | `AI_BASE_URL`     | `http://127.0.0.1:11434`|
| timeoutMs     | `AI_TIMEOUT`      | `60000`                 |
| maxTokens     | `AI_MAX_TOKENS`   | `512`                   |
| temperature   | `AI_TEMPERATURE`  | `0.7`                   |
| contextChars  | `AI_CONTEXT_SIZE` | `6000`                  |
| perMin/Hour/Day | —               | `6 / 60 / 200`          |

Debug-Traces: `LOVEAI_DEBUG=1`. Schreiben ist atomar (tmp + rename); kaputte
`ai.json` → sichere Defaults, kein Crash.

## 4. Windows-Setup (Produktion)

1. Ollama für Windows installieren (https://ollama.com/download) — läuft als
   Dienst/Icon, horcht auf `127.0.0.1:11434`.
2. Modell laden: `ollama pull llama3.1:8b` (8 GB+ RAM; sonst `llama3.2:3b`).
3. Im Bot: `$ai diagnose` → alles ✅, dann `$ai hallo`.
4. `$aimodel <name>` (Owner) schaltet ECHT um und prüft sofort.

Hinweis: Default ist bewusst `127.0.0.1` (kein `localhost`), um IPv4/IPv6-
Uneindeutigkeiten auf Windows zu vermeiden.

## 5. Health & Status

- `ok` = Backend erreichbar + gültige Antwort. `ready` = `ok` UND konfiguriertes
  Modell installiert. `$aistatus` zeigt beides + Endpoint + Fehlercode + Latenz.
- `$ai diagnose` prüft 8 Stufen (Config → Provider → Backend → Modelle → Modell →
  Generierung → Memory → Tools); READY nur wenn ALLES ok inkl. Mini-Generierung.
- `$ai debug` (Owner): Endpoint, Backend-Health, letzter Call (Code/Latenz/Modell).
- Website `/api/ai/status` nutzt dieselbe Quelle (`aiHealth`) — identische Werte.
- Boot: eine Logzeile `🤖 LoveAI: Backend …` (blockiert nie).
- Pipeline-Log: `[AI] offline|fail|chat ok` — nie Nachrichteninhalte.

## 6. Troubleshooting (Fehlercodes)

| Code | Bedeutung | Maßnahme |
|------|-----------|----------|
| `ECONNREFUSED` | Backend läuft nicht / Port zu | Ollama starten (`ollama serve`) |
| `ENOTFOUND` / `EAI_AGAIN` | Host falsch / DNS | `$aiconfig baseurl …` prüfen |
| `ETIMEDOUT` / `timeout` | Backend antwortet nicht | Last prüfen, Timeout erhöhen |
| `bad-endpoint` | 404 bei `/api/tags` | baseUrl falsch (Pfad-Suffix weg) |
| `model-not-found` | Modell fehlt (404) | `ollama pull <modell>` / `$aimodel` |
| `backend-error` | HTTP 5xx | Backend-Logs prüfen |
| `denied` | HTTP 401/403 | Reverse-Proxy/Auth prüfen |
| `rate-limited` | HTTP 429 / Überlast | warten, Limits prüfen |
| `INVALID_JSON` / `empty-response` | Protokoll-Antwort kaputt/leer | Backend-Version prüfen |
| `aborted` | Abgebrochen (`$aistop`) | — |

Retry: max. 1× nach 300 ms, NUR transient (Reset/Timeout/502/503/504/429) —
nie bei refused/dns/abort/4xx. Fehlversuche verbrauchen KEIN Tages-Quota
(separate Fehlerzähler).

## 7. Befehle

`$ai <frage>` (+ `$ki`-Alias), `$ask`, `$aistatus`, `$aimodel [name]` (Set = Owner),
`$aimemory list|remember|forget|clear`, `$aiclear`, `$aistop`, `$aiconfig`,
`$ai diagnose`, `$ai debug` (Owner), `$ai group on|off` (Gruppen-Admin),
`$ai on|off` (DM-Chatmodus). Gruppen-AI nur nach Freischaltung + nur auf `$ai …`.

## 8. Memory & Tools & Security

- Verlauf je Chat (20), Fakten NUR via `remember` (20), Prefs (chatMode/lang).
  `$unregister` entfernt alles (Conversations, Fakten, Prefs, User-Stats).
- Tools strikt lesend (Profil/Level/Rang/Gruppe/Economy/Hilfe/Status/Befehle);
  Schreib-Tools ohne `AI_ALLOW_WRITE=true` geblockt. Tool-Fehler → ehrliche
  Antwort („konnte ich gerade nicht abrufen“), kein Halluzinieren.
- Privacy: keine Tokens/Passwörter/IPs/Sessions an die AI; Output-Sanitize
  redactet Secrets; Moderation nur klassifizierend (nie Ban/Delete durch AI).

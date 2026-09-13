/* ═══════════════════════════════════════════════════════════════════════
   LoveBot — LoveAI Selbsttest (Core · Cloud · Chain · komplette Pipeline)
   Simuliert alle Betriebsarten und prüft, dass LoveAI IMMER antwortet:
     · CoreProvider standalone (health · generate · Mathe · Intents)
     · CloudProvider (echte LLMs) — gegen lokalen OpenAI-kompatiblen Mock
     · ChainProvider 3-Tier: Ollama tot → Cloud → Core (mit Fallback)
     · runReact mit ECHTEN Tools (auch über die Cloud)
     · aiChat End-to-End inkl. Memory & Engine-Kennzeichnung
   Sicher: Database/ai.json wird gesichert und am Ende wiederhergestellt.
   ═══════════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import http from 'node:http';

const AI_FILE = 'Database/ai.json';
const BACKUP = '/tmp/ai.json.selftest-backup';
let hadBackup = false;
try { fs.copyFileSync(AI_FILE, BACKUP); hadBackup = true; } catch (e) {}

let fails = 0;
const check = (name, ok, extra = '') => {
  console.log(`  ${name} → ${ok ? 'OK' : 'FAIL'}${extra ? '  ' + extra : ''}`);
  if (!ok) fails++;
};

/* ── Lokaler OpenAI-kompatibler Cloud-Mock (echtes HTTP, kein Fake) ── */
function startMockCloud() {
  let failing = false;
  const server = http.createServer((req, res) => {
    if (req.url.includes('boom=1')) { failing = true; }
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      const send = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
      if (failing) return send(500, { error: { message: 'Mock-Cloud down' } });
      let msgs = [];
      try { msgs = JSON.parse(body).messages || []; } catch (e) {}
      const last = String(msgs[msgs.length - 1]?.content || '');
      let out = 'OK von Mock-Cloud';
      if (last.includes('TOOL-RESULT')) out = 'Du bist *Maxi* · Level *12* · 340/500 XP · 1200 Copper (echte Tool-Daten via Mock-Cloud).';
      else if (/stats/i.test(last)) out = 'TOOL:getUserProfile({})';
      else if (/schwarzes loch/i.test(last)) out = 'Ein Schwarzes Loch ist eine Region, deren Schwerkraft so stark ist, dass nicht einmal Licht entkommt. 🌌';
      if (req.url.includes('/authcheck') && !/Bearer test-key/.test(req.headers.authorization || '')) {
        return send(401, { error: { message: 'missing key' } });
      }
      send(200, { id: 'mock', object: 'chat.completion', model: 'mock-llm-70b', choices: [{ index: 0, message: { role: 'assistant', content: out }, finish_reason: 'stop' }], usage: { prompt_tokens: 1, completion_tokens: 1 } });
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({
      url: `http://127.0.0.1:${server.address().port}/v1/chat/completions`,
      close: () => new Promise((r) => server.close(() => r()))
    }));
  });
}

let mock = null;
try {
  const { CoreProvider, evalMath, parsePrompt } = await import('../ai/core.js');
  const { createProvider, ChainProvider, CloudProvider } = await import('../ai/providers.js');
  const { detectCloudProvider } = await import('../ai/cloud.js');
  const { buildSystemPrompt, runReact } = await import('../ai/context.js');
  const { aiChat, aiHealth, setProvider, _resetAiEngine } = await import('../ai/engine.js');
  const { _resetAiLimits } = await import('../ai/limits.js');
  const mem = await import('../ai/memory.js');

  console.log('═══ 1 · CoreProvider standalone (offline-Fallback) ═══');
  const core = new CoreProvider();
  const h = await core.health();
  check('health: ok & ready & engine=core', h.ok === true && h.ready === true && h.engine === 'core');
  const g = (user) => core.generate('\nUser: ' + user + '\nLoveAI:');
  check('Mathe: 12*4+3 = 51', (await g('Was ist 12*4+3?')).text.includes('51'));
  check('Mathe: eval-Sicherheit (kein Code)', evalMath('process.exit(1)') === null);
  check('Gruß antwortet', (await g('hallo')).text.length > 10);
  check('Profil-Frage → TOOL-Zeile', /^TOOL:getUserProfile/.test((await g('zeig meine stats')).text));

  console.log('\n═══ 2 · CloudProvider (echte LLMs, gegen Mock-Cloud) ═══');
  mock = await startMockCloud();
  check('Key-Erkennung: gsk_→groq · AIza→gemini · sk-or-→openrouter',
    detectCloudProvider('gsk_' + 'a'.repeat(30)) === 'groq' &&
    detectCloudProvider('AIza' + 'b'.repeat(33)) === 'gemini' &&
    detectCloudProvider('sk-or-v1-' + 'c'.repeat(30)) === 'openrouter');
  const cloud = new CloudProvider({ cloudProvider: 'custom', cloudEndpoint: mock.url, cloudKey: 'test-key', cloudOn: true });
  const chh = await cloud.health();
  check('Cloud-Health: ok, engine=cloud, Modell erkannt', chh.ok === true && chh.engine === 'cloud' && chh.model === 'mock-llm-70b', `· ${chh.cloudLabel || ''} ${chh.model}`);
  const cg = await cloud.generate('Du bist LoveAI.\n\nUser: Was ist ein schwarzes Loch?\nLoveAI:');
  check('Cloud-generate: echte Antwort', cg.engine === 'cloud' && cg.text.includes('Schwarzes Loch'), '· ' + cg.text.slice(0, 40) + '…');
  const cgAuth = new CloudProvider({ cloudProvider: 'custom', cloudEndpoint: mock.url.replace('/v1/', '/v1/authcheck/'), cloudKey: '' });
  const authH = await cgAuth.health();
  check('Cloud ohne Key → sauberer Fehler (kein Crash)', authH.ok === false && !!authH.code);

  console.log('\n═══ 3 · ChainProvider 3-Tier (Ollama tot → Cloud aktiv) ═══');
  const chain = createProvider('chain', { baseUrl: 'http://127.0.0.1:1/', model: 'llama3.1:8b', cloudProvider: 'custom', cloudEndpoint: mock.url, cloudKey: 'test-key', cloudOn: true });
  check('Chain ist 3-Tier (cloud eingebaut)', chain instanceof ChainProvider && !!chain.cloud);
  const chh2 = await chain.health();
  check('Chain-Health: aktive Engine = Cloud ☁️', chh2.ok === true && chh2.engine === 'cloud', `· ${chh2.engineLabel} · cloudOn=${chh2.cloudOn}`);
  const chainGen = await chain.generate('\nUser: Was ist ein schwarzes Loch?\nLoveAI:');
  check('Chain-generate über Cloud', chainGen.engine === 'cloud' && chainGen.text.length > 10);

  console.log('\n═══ 4 · ReAct mit ECHTEN Tools über die Cloud ═══');
  const sys = buildSystemPrompt({ lang: 'de' });
  const ctx = {
    bid: 'selftest-user',
    profile: { registration: { name: 'Maxi' }, progression: { level: 12, xp: 340, neededXpForLvOrPrestigeUp: 500, totalXp: 3000, prestige: 1 }, wallet: { copper: 1200 }, bank: { copper: 3400 } },
    rank: { pos: 3, total: 73 }
  };
  let r = await runReact(chain, { system: sys, history: [], facts: [], userText: 'Zeig meine stats', toolCtx: ctx, cfg: {} });
  check('Stats-Flow: TOOL über Cloud → echtes getUserProfile → finale Antwort',
    r.toolsUsed.includes('getUserProfile') && r.engine === 'cloud' && r.text.includes('Maxi'), '· ' + r.text.slice(0, 50) + '…');

  console.log('\n═══ 5 · Per-Request-Fallback: Cloud stirbt → Core 💜 ═══');
  await fetch(mock.url + '?boom=1'); /* Mock ab jetzt 500 */
  const fb = await chain.generate('\nUser: Was ist 1337 * 42?\nLoveAI:');
  check('Fallback auf Core ohne Fehler', fb.engine === 'core' && fb.text.includes('56154'), '· ' + fb.text.trim().slice(0, 30));
  const coreOnly = await chain.health();
  check('Chain bleibt ok (Core aktiv)', coreOnly.ok === true && coreOnly.engine === 'core');

  console.log('\n═══ 6 · Copilot: Bot & Website erklären (read-only Tools) ═══');
  const { runTool, toolSpec } = await import('../ai/tools.js');
  const { buildBotKnowledge } = await import('../ai/knowledge.js');
  const spec = toolSpec().map((t) => t.name);
  check('4 neue Copilot-Tools registriert', ['getBotOverview', 'getWebInfo', 'getCommandDetails', 'getSystemStatus'].every((t) => spec.includes(t)), '· ' + spec.length + ' Tools');
  const ov = runTool('getBotOverview', {}, {});
  check('getBotOverview: 335 Befehle + 41 Seiten + Features', ov.ok && ov.data.commands >= 300 && ov.data.websitePages === 41 && ov.data.features.length >= 10, `· ${ov.data.commands} Befehle`);
  const wi = runTool('getWebInfo', { q: 'bank' }, {});
  check('getWebInfo(q=bank): findet Bank-Seite', wi.ok && wi.data.pages.some((p) => p.page === 'bank.html'));
  const wiAll = runTool('getWebInfo', {}, {});
  check('getWebInfo(): alle Seiten nach Kategorie', wiAll.ok && Object.keys(wiAll.data.pagesByCategory).length >= 5);
  const cd = runTool('getCommandDetails', { q: 'daily' }, {});
  check('getCommandDetails(daily): Name, Aliase, Kategorie', cd.ok && cd.data.found && cd.data.cmd === '$daily' && Array.isArray(cd.data.aliases));
  const ss = runTool('getSystemStatus', {}, { uptimeMs: 5 * 60000, counts: { users: 3, groups: 2 } });
  check('getSystemStatus: RAM, Node, DB-Größen', ss.ok && ss.data.ramTotalMb > 0 && !!ss.data.node && !!ss.data.dbSizes['Database.json']);
  const knowledge = buildBotKnowledge();
  check('Copilot-Wissen für System-Prompt (Befehle + Seiten + Read-only)', knowledge.includes('Befehle') && knowledge.includes('40 Seiten') && knowledge.includes('NICHTS ändern'));
  /* Offline-Copilot: Core beantwortet Bot-/Web-Fragen über die Tools */
  const coreWeb = await core.generate('\nUser: Was gibt es für Webseiten?\nLoveAI:');
  check('Core-Intent web → TOOL:getWebInfo', /^TOOL:getWebInfo/.test(coreWeb.text));
  const coreInfo = await core.generate('\nUser: Was ist LoveBot? Erklär mir den Bot\nLoveAI:');
  check('Core-Intent botinfo → TOOL:getBotOverview', /^TOOL:getBotOverview/.test(coreInfo.text));
  const coreSys = await core.generate('\nUser: Wie viel RAM nutzt der Server? Systemstatus!\nLoveAI:');
  check('Core-Intent system → TOOL:getSystemStatus', /^TOOL:getSystemStatus/.test(coreSys.text));
  /* End-to-End über runReact (echte Tool-Ausführung + Formatierung) */
  r = await runReact(core, { system: sys, history: [], facts: [], userText: 'Was gibt es für Webseiten?', toolCtx: ctx, cfg: {} });
  check('runReact: Website-Erklärung formatiert', r.toolsUsed.includes('getWebInfo') && r.text.includes('Web-Panel') && r.text.includes('dashboard'), '· ' + r.text.split('\n')[0].slice(0, 45));
  r = await runReact(core, { system: sys, history: [], facts: [], userText: 'Wie funktioniert $daily?', toolCtx: ctx, cfg: {} });
  check('runReact: Befehl-Erklärung für $daily', r.toolsUsed.includes('getCommandDetails') && r.text.includes('$daily'), '· ' + r.text.split('\n')[0].slice(0, 45));

  console.log('\n═══ 7 · aiChat End-to-End ( komplette $ai-Pipeline mit Cloud ) ═══');
  await mock.close();
  mock = await startMockCloud(); /* frische, gesunde Mock-Cloud */
  mem.setAiConfig({ cloudProvider: 'custom', cloudEndpoint: mock.url, cloudKey: 'test-key', cloudOn: true }, 'selftest');
  setProvider(createProvider('chain', { baseUrl: 'http://127.0.0.1:1/', cloudProvider: 'custom', cloudEndpoint: mock.url, cloudKey: 'test-key', cloudOn: true }));
  _resetAiEngine();
  const eh = await aiHealth(true);
  check('aiHealth: engine=cloud', eh.engine === 'cloud' && eh.ok === true, `· ${eh.engineLabel}`);
  const cases = ['Test', 'Wie bekomme ich XP?', 'Zeig mir befehle für spiele', 'Zeig meine stats', 'Was ist ein schwarzes Loch?'];
  let okCount = 0, cloudCount = 0;
  for (const q of cases) {
    _resetAiLimits();
    const res = await aiChat({ ...ctx, text: q });
    if (res.ok && res.text && res.text.length > 3) okCount++;
    if (res.engine === 'cloud') cloudCount++;
    else console.log('    · engine für „' + q + '“:', res.engine || '?');
  }
  check(`alle ${cases.length} Fragen beantwortet`, okCount === cases.length, `· ${okCount}/${cases.length}`);
  check('Antworten kommen über die Cloud-KI ☁️', cloudCount >= 3, `· ${cloudCount}/${cases.length} via cloud`);
  /* Cloud stirbt mitten im Betrieb → aiChat fällt auf Core zurück (echtes Rechnen) */
  await fetch(mock.url + '?boom=1');
  _resetAiLimits();
  const res2 = await aiChat({ ...ctx, text: 'Was ist 1337 * 42?' });
  check('Cloud-Fallback in aiChat: Core rechnet 56154', (res2.text || '').includes('56154') && res2.engine === 'core', '· ' + String(res2.text || '').trim().slice(0, 30));

  console.log(`\n${fails ? '✘ ' + fails + ' Checks fehlgeschlagen' : '✔ LoveAI-Selbsttest erfolgreich — Core ☁️ Cloud 💜 Chain laufen'}`);
  process.exitCode = fails ? 1 : 0;
} catch (e) {
  console.log('✘ Testfehler:', e?.stack || e);
  process.exitCode = 1;
} finally {
  if (mock) { try { await mock.close(); } catch (e) {} }
  if (hadBackup) { try { fs.copyFileSync(BACKUP, AI_FILE); } catch (e) {} }
  else { try { fs.unlinkSync(AI_FILE); } catch (e) {} }
}

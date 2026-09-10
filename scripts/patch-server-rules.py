#!/usr/bin/env python3
# Konfigurierbare Web-Abuse-Regeln (WEB-REQ-07): DB-Datei + API + Memory-Reload
import io

p = 'server.js'
s = io.open(p, encoding='utf-8').read()
n = 0

# 1) Rule-Store: Laden/Speichern neben den Abuse-Konstanten
old = """const ABUSE_BURST_WINDOW_MS = 10 * 1000;          /* 10 Sek. Beobachtungsfenster */
const ABUSE_BURST_THRESHOLD = 50;                 /* > 50 Anfragen/10s einer IP = auffällig */
const ABUSE_VIOLATION_DECAY_MS = 30 * 60 * 1000;  /* Verstöße verjähren nach 30 Min Ruhe */
const ABUSE_TIERS = [
  { atViolations: 2, action: 'TEMP_BLOCK', blockMs: 5 * 60 * 1000, label: '5 Minuten' },
  { atViolations: 4, action: 'LONG_BLOCK', blockMs: 60 * 60 * 1000, label: '1 Stunde' },
  { atViolations: 6, action: 'PERM_BLOCK', blockMs: null, label: 'dauerhaft (manuelle Prüfung nötig)' }
];"""
new = """/* ── Konfigurierbare Web-Abuse-Regeln (WEB-REQ-07) ─────────────────────
   Die Parameter sind NICHT hart im Code, sondern liegen in
   Database/security-rules.json und können im Owner-Center (Auto-Regeln)
   geändert werden — jede Änderung wird versioniert, auditiert und
   erfordert ein Step-up-Passwort. Die Defaults unten gelten, solange die
   Datei fehlt, und werden beim ersten Start automatisch angelegt. */
const ABUSE_DEFAULTS = {
  id: 'WEB-REQ-07',
  enabled: true,
  threshold: 50,                /* > N Anfragen einer IP im Fenster = 1 Verstoß */
  windowSec: 10,                /* Beobachtungsfenster in Sekunden */
  violationDecayMin: 30,        /* Verstöße verjähren nach N Min ohne Vorfall */
  tiers: [
    { atViolations: 2, action: 'TEMP_BLOCK', blockMin: 5, label: '5 Minuten' },
    { atViolations: 4, action: 'LONG_BLOCK', blockMin: 60, label: '1 Stunde' },
    { atViolations: 6, action: 'PERM_BLOCK', blockMin: 0, label: 'dauerhaft (manuelle Prüfung nötig)' }
  ]
};
const SEC_RULES_FILE = path.join('Database', 'security-rules.json');

function normalizeAbuseRules(input) {
  const src = input || {};
  const t = Array.isArray(src.tiers) ? src.tiers.slice(0, 8) : ABUSE_DEFAULTS.tiers.map((x) => ({ ...x }));
  const tiers = t
    .map((x) => ({
      atViolations: Math.max(1, Math.min(50, Math.round(Number(x?.atViolations) || 0))),
      action: ['TEMP_BLOCK', 'LONG_BLOCK', 'PERM_BLOCK'].includes(x?.action) ? x.action : 'TEMP_BLOCK',
      blockMin: x?.action === 'PERM_BLOCK' ? 0 : Math.max(1, Math.min(10080, Math.round(Number(x?.blockMin) || 0) || ABUSE_DEFAULTS.tiers[0].blockMin)),
      label: String(x?.label || '').slice(0, 60)
    }))
    .filter((x) => x.atViolations > 0)
    .sort((a, b) => a.atViolations - b.atViolations);
  if (!tiers.length) tiers.push({ ...ABUSE_DEFAULTS.tiers[0] });
  return {
    id: String(src.id || 'WEB-REQ-07').slice(0, 40),
    enabled: src.enabled !== false,
    threshold: Math.max(3, Math.min(1000, Math.round(Number(src.threshold) || ABUSE_DEFAULTS.threshold))),
    windowSec: Math.max(2, Math.min(3600, Math.round(Number(src.windowSec) || ABUSE_DEFAULTS.windowSec))),
    violationDecayMin: Math.max(1, Math.min(1440, Math.round(Number(src.violationDecayMin) || ABUSE_DEFAULTS.violationDecayMin))),
    tiers
  };
}

let SEC_RULES = { version: 0, updatedAt: null, updatedBy: 'defaults', history: [], webReqFlood: normalizeAbuseRules(null) };

function loadSecurityRules() {
  try {
    const raw = JSON.parse(fs.readFileSync(SEC_RULES_FILE, 'utf8'));
    const wrf = normalizeAbuseRules(raw.webReqFlood || raw);
    SEC_RULES = {
      version: Math.max(1, Number(raw.version) || 1),
      updatedAt: raw.updatedAt || null,
      updatedBy: raw.updatedBy || 'datei',
      history: Array.isArray(raw.history) ? raw.history.slice(-10) : [],
      webReqFlood: wrf
    };
  } catch (e) {
    /* Datei fehlt oder kaputt → Defaults anlegen */
    SEC_RULES = { version: 1, updatedAt: new Date().toISOString(), updatedBy: 'system-init', history: [], webReqFlood: normalizeAbuseRules(null) };
    try { fs.writeFileSync(SEC_RULES_FILE, JSON.stringify(SEC_RULES, null, 2), 'utf8'); } catch (e2) {}
  }
  return SEC_RULES;
}
function saveSecurityRules(actor, reason) {
  const prev = { v: SEC_RULES.version, webReqFlood: SEC_RULES.webReqFlood };
  SEC_RULES.history = [...SEC_RULES.history, prev].slice(-10);
  SEC_RULES.version += 1;
  SEC_RULES.updatedAt = new Date().toISOString();
  SEC_RULES.updatedBy = String(actor || '?');
  fs.writeFileSync(SEC_RULES_FILE, JSON.stringify(SEC_RULES, null, 2), 'utf8');
  audit(actor, 'security.rules.changed', 'WEB-REQ-07 → v' + SEC_RULES.version + (reason ? ' — ' + String(reason).slice(0, 160) : ''), 'success');
  return SEC_RULES;
}
loadSecurityRules();
/* Der Effective-Wert kommt aus den Regeln (Default-Fallback bleibt als Konstante erhalten) */
const abuseRule = () => SEC_RULES.webReqFlood || ABUSE_DEFAULTS;
const ABUSE_BURST_WINDOW_MS = () => (abuseRule().windowSec || 10) * 1000;
const ABUSE_BURST_THRESHOLD = () => abuseRule().threshold || 50;
const ABUSE_VIOLATION_DECAY_MS = () => (abuseRule().violationDecayMin || 30) * 60 * 1000;
const ABUSE_TIERS = () => (abuseRule().tiers || ABUSE_DEFAULTS.tiers).map((t) => ({
  atViolations: t.atViolations,
  action: t.action,
  blockMs: t.action === 'PERM_BLOCK' ? null : (t.blockMin || 5) * 60 * 1000,
  label: t.label || (t.action === 'PERM_BLOCK' ? 'dauerhaft' : (t.blockMin || 5) + ' Minuten')
}));"""
assert old in s, 'Abuse-Konstanten-Block nicht gefunden'
s = s.replace(old, new, 1)
n += 1

# 2) recordAbuseCheck: Funktions-Referenzen nutzen + enabled-Check
s = s.replace("""function recordAbuseCheck(ip) {
  if (!ip) return;
  const now = Date.now();

  let burst = abuseBursts.get(ip);
  if (!burst || burst.windowStart + ABUSE_BURST_WINDOW_MS < now) {
    burst = { count: 0, windowStart: now, tier1Logged: false };
    abuseBursts.set(ip, burst);
  }
  burst.count++;
  if (burst.count <= ABUSE_BURST_THRESHOLD) return;""",
"""function recordAbuseCheck(ip) {
  if (!ip) return;
  const rule = abuseRule();
  if (!rule.enabled) return; /* Regel deaktiviert (im Owner-Center konfigurierbar) */
  const now = Date.now();

  let burst = abuseBursts.get(ip);
  if (!burst || burst.windowStart + ABUSE_BURST_WINDOW_MS() < now) {
    burst = { count: 0, windowStart: now, tier1Logged: false };
    abuseBursts.set(ip, burst);
  }
  burst.count++;
  if (burst.count <= ABUSE_BURST_THRESHOLD()) return;""", 1)
n += 1

s = s.replace("""  let viol = abuseViolations.get(ip);
  if (!viol || viol.lastAt + ABUSE_VIOLATION_DECAY_MS < now) {
    viol = { count: 0, lastAt: now };
  }
  viol.count++;
  viol.lastAt = now;
  abuseViolations.set(ip, viol);

  securityEvent('ABUSE_BURST_DETECTED', {
    ip, risk: Math.min(90, 25 + viol.count * 10),
    reason: 'Ungewöhnlich viele Anfragen in kurzer Zeit (Reload-/Request-Flut)',
    requestsInWindow: burst.count, windowSec: ABUSE_BURST_WINDOW_MS / 1000, violationCount: viol.count
  });

  let hitTier = null;
  for (const t of ABUSE_TIERS) if (viol.count >= t.atViolations) hitTier = t;""",
"""  let viol = abuseViolations.get(ip);
  if (!viol || viol.lastAt + ABUSE_VIOLATION_DECAY_MS() < now) {
    viol = { count: 0, lastAt: now };
  }
  viol.count++;
  viol.lastAt = now;
  abuseViolations.set(ip, viol);

  securityEvent('ABUSE_BURST_DETECTED', {
    ip, risk: Math.min(90, 25 + viol.count * 10),
    reason: 'Ungewöhnlich viele Anfragen in kurzer Zeit (Reload-/Request-Flut)',
    requestsInWindow: burst.count, windowSec: ABUSE_BURST_WINDOW_MS() / 1000, violationCount: viol.count, rule: rule.id
  });

  let hitTier = null;
  for (const t of ABUSE_TIERS()) if (viol.count >= t.atViolations) hitTier = t;""", 1)
n += 1

s = s.replace("""      manualBanIp(ip, `Automatisch gesperrt: wiederholte Reload-/Request-Flut (${viol.count}. Verstoß in ${ABUSE_VIOLATION_DECAY_MS / 60000} Min) — bitte manuell prüfen`, 'auto-security-system');""",
"""      manualBanIp(ip, `Automatisch gesperrt: wiederholte Reload-/Request-Flut (${viol.count}. Verstoß in ${ABUSE_VIOLATION_DECAY_MS() / 60000} Min) — bitte manuell prüfen`, 'auto-security-system');""", 1)
n += 1

# Aufräumen: Decay-Funktion
s = s.replace("""  for (const [ip, b] of abuseBursts) if (b.windowStart + ABUSE_BURST_WINDOW_MS < now) abuseBursts.delete(ip);
  for (const [ip, v] of abuseViolations) if (v.lastAt + ABUSE_VIOLATION_DECAY_MS < now) abuseViolations.delete(ip);""",
"""  for (const [ip, b] of abuseBursts) if (b.windowStart + ABUSE_BURST_WINDOW_MS() < now) abuseBursts.delete(ip);
  for (const [ip, v] of abuseViolations) if (v.lastAt + ABUSE_VIOLATION_DECAY_MS() < now) abuseViolations.delete(ip);""", 1)
n += 1

# 3) APIs: GET/POST /api/security/rules (vor /api/security/ban-ip einhängen)
anchor = "  if (pathname === '/api/security/ban-ip' && req.method === 'POST') {"
rules_api = """  /* ⚙️ Konfigurierbare Schutzregeln (WEB-REQ-07) — Lese-Zugang: security.view */
  if (pathname === '/api/security/rules' && req.method === 'GET') {
    if (!perm(session, 'security.view')) return sendJson(res, 403, { error: 'Keine Berechtigung (security.view).' });
    return sendJson(res, 200, { ok: true, version: SEC_RULES.version, updatedAt: SEC_RULES.updatedAt, updatedBy: SEC_RULES.updatedBy, webReqFlood: SEC_RULES.webReqFlood, activeCounts: { bursts: abuseBursts.size, violations: abuseViolations.size }, history: SEC_RULES.history.slice(-5).reverse() });
  }

  /* ⚙️ Regeln ändern (kritisch): security.manage + Step-up-Reauth + Audit */
  if (pathname === '/api/security/rules' && req.method === 'POST') {
    if (!perm(session, 'security.manage')) return sendJson(res, 403, { error: 'Keine Berechtigung (security.manage).' });
    const body = await readBody(req);
    /* 🔐 Sicherheitsregeln ändern = kritisch → Step-up-Reauth + Audit */
    if (!requireStepUp(req, res, session, body, 'security.rules.changed')) return;
    const actor = session.username || session.number;
    const reason = String(body.reason || 'Regel angepasst').trim().slice(0, 200);
    const next = normalizeAbuseRules(body.webReqFlood || body);
    const saved = saveSecurityRules(actor, reason);
    securityEvent('SECURITY_RULES_CHANGED', { actor, risk: 55, reason: reason, newVersion: saved.version, rule: next.id, threshold: next.threshold, windowSec: next.windowSec, enabled: next.enabled });
    return sendJson(res, 200, { ok: true, version: saved.version, webReqFlood: saved.webReqFlood });
  }

"""
assert anchor in s
s = s.replace(anchor, rules_api + anchor, 1)
n += 1

io.open(p, 'w', encoding='utf-8').write(s)
print('server.js abuse-rules Patches:', n)

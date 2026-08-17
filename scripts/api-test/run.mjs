/**
 * Prüft api/analyze.ts: Serverschlüssel, Eigenschlüssel und das Freikontingent
 * von drei Analysen pro Gerät und Monat.
 *
 *   node scripts/api-test/run.mjs           # lokaler Handler (Standard)
 *   node scripts/api-test/run.mjs vercel    # gegen `vercel dev`, schreibt kurzzeitig .env.local
 *   node scripts/api-test/run.mjs auto      # erst vercel dev, sonst lokaler Handler
 *
 * Anthropic und Upstash werden durch Ersatzdienste bedient, es entstehen
 * keine Kosten und es wird nichts nach außen geschickt.
 */
import { spawn } from 'node:child_process';
import { existsSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { startFakeUpstash, startFakeAnthropic } from './fakes.mjs';
import { startHandlerServer } from './serve-local.mjs';

const MODE = process.argv[2] ?? 'local';
const UPSTASH_PORT = 39412;
const ANTHROPIC_PORT = 39411;
const VERCEL_PORT = 39413;
const ENV_FILE = join(process.cwd(), '.env.local');

let failed = 0;
function check(label, ok, extra) {
  console.log(`${ok ? 'OK  ' : 'FEHL'} ${label}${extra !== undefined ? ` -> ${JSON.stringify(extra)}` : ''}`);
  if (!ok) failed++;
}

const upstash = await startFakeUpstash(UPSTASH_PORT);
const anthropic = await startFakeAnthropic(ANTHROPIC_PORT);

const env = {
  ANTHROPIC_API_KEY: 'sk-ant-server-testkey',
  ANTHROPIC_BASE_URL: anthropic.base,
  UPSTASH_REDIS_REST_URL: upstash.base,
  UPSTASH_REDIS_REST_TOKEN: 'test-token',
};

const cleanup = [];
async function shutdown() {
  for (const fn of cleanup.reverse()) {
    try { await fn(); } catch {}
  }
  upstash.server.close();
  anthropic.server.close();
}

// ─── Zielserver starten ──────────────────────────────────────────────────────

async function startVercelDev() {
  if (existsSync(ENV_FILE)) {
    console.log('Übersprungen: .env.local existiert bereits, wird nicht überschrieben.');
    return null;
  }
  writeFileSync(ENV_FILE, Object.entries(env).map(([k, v]) => `${k}=${v}`).join('\n') + '\n');
  cleanup.push(() => rmSync(ENV_FILE, { force: true }));

  const child = spawn(
    'npx',
    ['--yes', 'vercel@latest', 'dev', '--listen', String(VERCEL_PORT), '--yes'],
    { env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  cleanup.push(() => child.kill('SIGTERM'));

  let log = '';
  child.stdout.on('data', d => { log += d.toString(); });
  child.stderr.on('data', d => { log += d.toString(); });

  const base = `http://127.0.0.1:${VERCEL_PORT}`;
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      console.log(`vercel dev beendet (Code ${child.exitCode}):\n${log.split('\n').slice(-8).join('\n')}`);
      return null;
    }
    try {
      const res = await fetch(`${base}/api/analyze`, { headers: { 'x-device-token': 'aufwaermen' } });
      if (res.status < 500 || res.status === 503) return base;
    } catch {}
    await new Promise(r => setTimeout(r, 2000));
  }
  console.log(`vercel dev war nach 180s nicht bereit:\n${log.split('\n').slice(-8).join('\n')}`);
  return null;
}

async function startLocal() {
  Object.assign(process.env, env);
  const { server, base } = await startHandlerServer(0);
  cleanup.push(() => server.close());
  return base;
}

let base = null;
let modeUsed = '';
if (MODE === 'vercel' || MODE === 'auto') {
  base = await startVercelDev();
  if (base) modeUsed = 'vercel dev';
}
if (!base && MODE !== 'vercel') {
  base = await startLocal();
  modeUsed = 'lokaler Handler';
}
if (!base) {
  console.log('FEHL Kein Zielserver verfügbar.');
  await shutdown();
  process.exit(1);
}
console.log(`Ziel: ${base} (${modeUsed})\n`);

// ─── Prüfungen ───────────────────────────────────────────────────────────────

const DEVICE = 'geraet-test-1';
const body = JSON.stringify({
  model: 'claude-sonnet-4-6',
  max_tokens: 2048,
  messages: [{ role: 'user', content: 'Analysiere diesen Auszug' }],
});

async function analyze(device, ownKey, customBody) {
  const headers = { 'Content-Type': 'application/json', 'x-device-token': device };
  if (ownKey) headers['x-anthropic-key'] = ownKey;
  const res = await fetch(`${base}/api/analyze`, { method: 'POST', headers, body: customBody ?? body });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text, remaining: res.headers.get('x-free-remaining') };
}

async function status(device) {
  const res = await fetch(`${base}/api/analyze`, { headers: { 'x-device-token': device } });
  return { status: res.status, json: await res.json().catch(() => null) };
}

try {
  const before = await status(DEVICE);
  check('Statusabruf zeigt drei freie Analysen',
    before.status === 200 && before.json?.limit === 3 && before.json?.remaining === 3, before.json);

  for (let i = 1; i <= 3; i++) {
    const r = await analyze(DEVICE);
    check(`Analyse ${i} von 3 läuft über den Serverschlüssel`,
      r.status === 200 && r.remaining === String(3 - i), { status: r.status, remaining: r.remaining });
  }

  check('Serverschlüssel wurde verwendet',
    anthropic.calls.length === 3 && anthropic.calls.every(c => c.apiKey === env.ANTHROPIC_API_KEY),
    anthropic.calls.map(c => c.apiKey));

  const fourth = await analyze(DEVICE);
  const msg = fourth.json?.error?.message ?? '';
  check('vierte Analyse wird mit 429 blockiert', fourth.status === 429, fourth.status);
  check('Meldung ist deutsch und nennt Freikontingent', /Freikontingent/.test(msg) && /Monat/.test(msg), msg);
  check('Meldung nennt eigenen Key und Pro', /eigenen Anthropic API Key/.test(msg) && /Pro/.test(msg));
  check('vierte Analyse erreicht Anthropic nicht', anthropic.calls.length === 3, anthropic.calls.length);

  const after = await status(DEVICE);
  check('Statusabruf zeigt null freie Analysen',
    after.json?.remaining === 0 && after.json?.used === 3, after.json);

  const own = await analyze(DEVICE, 'sk-ant-eigener-testkey');
  check('eigener Key funktioniert trotz aufgebrauchtem Kontingent', own.status === 200, own.status);
  check('eigener Key geht an Anthropic durch',
    anthropic.calls.at(-1)?.apiKey === 'sk-ant-eigener-testkey', anthropic.calls.at(-1)?.apiKey);

  const afterOwn = await status(DEVICE);
  check('eigener Key verbraucht kein Kontingent', afterOwn.json?.used === 3, afterOwn.json);

  const badKey = await analyze(DEVICE, 'nicht-sk-ant');
  check('ungültiger eigener Key wird abgelehnt', badKey.status === 401, badKey.status);

  const other = await analyze('geraet-test-2');
  check('anderes Gerät hat eigenes Kontingent',
    other.status === 200 && other.remaining === '2', { status: other.status, remaining: other.remaining });

  const noToken = await fetch(`${base}/api/analyze`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
  });
  check('Anfrage ohne Geräte-Token wird abgelehnt', noToken.status === 400, noToken.status);

  // Missbrauch über den öffentlichen Endpunkt: Modell und Antwortlänge sind gedeckelt
  const greedy = await analyze('geraet-test-3', null, JSON.stringify({
    model: 'claude-opus-4-1', max_tokens: 64000,
    messages: [{ role: 'user', content: 'teuer bitte' }],
  }));
  const sent = JSON.parse(anthropic.calls.at(-1).body);
  check('teure Anfrage wird angenommen, aber beschnitten', greedy.status === 200, greedy.status);
  check('Modell wird erzwungen', sent.model === 'claude-sonnet-4-6', sent.model);
  check('max_tokens wird gedeckelt', sent.max_tokens === 2048, sent.max_tokens);

  const huge = await analyze('geraet-test-4', null, JSON.stringify({
    model: 'claude-sonnet-4-6', max_tokens: 2048,
    messages: [{ role: 'user', content: 'x'.repeat(6 * 1024 * 1024) }],
  }));
  check('zu große Anfrage wird mit 413 abgelehnt', huge.status === 413, huge.status);

  const callsBefore = anthropic.calls.length;
  const badJson = await fetch(`${base}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-device-token': 'geraet-test-5' },
    body: 'kein json',
  });
  check('kaputte Anfrage wird abgelehnt, ohne Anthropic zu rufen',
    badJson.status === 400 && anthropic.calls.length === callsBefore, badJson.status);

  if (modeUsed === 'lokaler Handler') {
    const savedUrl = process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_URL;
    const noStore = await analyze('geraet-test-6');
    const noStoreStatus = await status('geraet-test-6');
    process.env.UPSTASH_REDIS_REST_URL = savedUrl;
    check('ohne Upstash wird abgelehnt statt ungezählt analysiert', noStore.status === 503, noStore.status);
    check('ohne Zähler verspricht der Statusabruf kein Kontingent',
      noStoreStatus.json?.limit === 0 && noStoreStatus.json?.remaining === 0, noStoreStatus.json);

    const savedKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    const noKeyStatus = await status('geraet-test-7');
    const noKeyAnalyze = await analyze('geraet-test-7');
    process.env.ANTHROPIC_API_KEY = savedKey;
    check('ohne Serverschlüssel verspricht der Statusabruf kein Kontingent',
      noKeyStatus.json?.limit === 0, noKeyStatus.json);
    check('ohne Serverschlüssel wird die Analyse abgelehnt', noKeyAnalyze.status === 503, noKeyAnalyze.status);
  }
} catch (err) {
  console.log(`FEHL Testlauf abgebrochen -> ${err.message}`);
  failed++;
} finally {
  await shutdown();
}

console.log(failed === 0
  ? `\nAlle API-Prüfungen bestanden (${modeUsed}).`
  : `\n${failed} Prüfung(en) fehlgeschlagen (${modeUsed}).`);
process.exit(failed === 0 ? 0 : 1);

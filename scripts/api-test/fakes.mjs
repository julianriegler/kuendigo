/**
 * Ersatzdienste für den lokalen Test von api/analyze.ts:
 *
 *  - Fake-Upstash: versteht die REST-Kommandos GET, INCR, DECR und EXPIRE
 *  - Fake-Anthropic: antwortet wie /v1/messages, ohne echte Kosten
 *
 * Damit lässt sich das Freikontingent prüfen, ohne Geld auszugeben.
 */
import { createServer } from 'node:http';

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

export async function startFakeUpstash(port = 0) {
  const store = new Map();
  const server = createServer(async (req, res) => {
    const body = await readBody(req);
    let command;
    try {
      command = JSON.parse(body);
    } catch {
      res.writeHead(400).end(JSON.stringify({ error: 'bad command' }));
      return;
    }
    const [name, key, arg] = command;
    let result = null;
    switch (String(name).toUpperCase()) {
      case 'GET':    result = store.has(key) ? String(store.get(key)) : null; break;
      case 'INCR':   result = (store.set(key, (store.get(key) ?? 0) + 1), store.get(key)); break;
      case 'DECR':   result = (store.set(key, (store.get(key) ?? 0) - 1), store.get(key)); break;
      case 'EXPIRE': result = arg ? 1 : 0; break;
      default:
        res.writeHead(400).end(JSON.stringify({ error: `unsupported: ${name}` }));
        return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ result }));
  });
  await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
  return { server, store, base: `http://127.0.0.1:${server.address().port}` };
}

export async function startFakeAnthropic(port = 0) {
  const calls = [];
  const server = createServer(async (req, res) => {
    const body = await readBody(req);
    calls.push({ apiKey: req.headers['x-api-key'], body });
    const subs = [{
      name: 'Netflix', amount: 13.99, frequency: 'monthly', category: 'streaming',
      lastCharged: '2026-07-15', nextCharge: '2026-08-15',
    }];
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(subs) }] }));
  });
  await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
  return { server, calls, base: `http://127.0.0.1:${server.address().port}` };
}

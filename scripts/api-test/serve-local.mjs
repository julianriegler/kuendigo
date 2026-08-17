/**
 * Führt api/analyze.ts ohne Vercel aus: Node-Server, der jede Anfrage in ein
 * Web-Request-Objekt übersetzt und den Edge-Handler aufruft.
 *
 * Dient als Rückfallebene, wenn `vercel dev` lokal nicht startet.
 */
import { createServer } from 'node:http';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function startHandlerServer(port = 0) {
  const mod = await import(pathToFileURL(join(process.cwd(), 'api', 'analyze.ts')).href);
  const handler = mod.default;

  const server = createServer(async (nodeReq, nodeRes) => {
    const chunks = [];
    for await (const chunk of nodeReq) chunks.push(chunk);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;

    const request = new Request(`http://127.0.0.1${nodeReq.url}`, {
      method: nodeReq.method,
      headers: nodeReq.headers,
      body: nodeReq.method === 'GET' || nodeReq.method === 'HEAD' ? undefined : body,
    });

    try {
      const res = await handler(request);
      const text = await res.text();
      nodeRes.writeHead(res.status, Object.fromEntries(res.headers.entries()));
      nodeRes.end(text);
    } catch (err) {
      nodeRes.writeHead(500, { 'Content-Type': 'application/json' });
      nodeRes.end(JSON.stringify({ error: { message: String(err) } }));
    }
  });

  await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

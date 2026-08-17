/**
 * Kleiner statischer Server für den Web-Export in dist/, mit SPA-Fallback.
 *
 * Direkt aufgerufen dient er als devCommand für `vercel dev` (Port aus $PORT),
 * importiert liefert er createStaticServer() für die Testskripte.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.ttf': 'font/ttf',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.map': 'application/json',
};

export function createStaticServer(dist) {
  return createServer(async (req, res) => {
    const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
    let file = join(dist, normalize(url).replace(/^(\.\.[/\\])+/, ''));
    if (!existsSync(file) || url.endsWith('/')) {
      const html = `${file.replace(/\/$/, '')}.html`;
      file = existsSync(html) ? html : join(dist, 'index.html');
    }
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404).end('not found');
    }
  });
}

/** Startet den Server und gibt die Basis-URL zurück. */
export async function startStaticServer(dist, port = 0) {
  const server = createStaticServer(dist);
  await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop());
if (isMain) {
  const dist = join(process.cwd(), 'dist');
  const port = Number(process.env.PORT ?? 3001);
  const { base } = await startStaticServer(dist, port);
  console.log(`Kündigo Web-Export unter ${base} (aus ${dist})`);
}

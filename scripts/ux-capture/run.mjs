/**
 * Hält den Weg eines neuen Besuchers als Bildschirmfotos und Seitentext fest
 * (Handy-Breite, Kontingent aus wie live). Für die UX-Prüfung, zählt nichts mit.
 *
 *   node scripts/ux-capture/run.mjs <ausgabeordner>
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { startStaticServer } from '../dev-static.mjs';

const OUT = process.argv[2] ?? 'ux-capture';
await mkdir(OUT, { recursive: true });
const { server, base } = await startStaticServer(join(process.cwd(), 'dist'));
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await page.route('**/klickmill.app/api/**', r => r.fulfill({ status: 204, body: '' }));
await page.route('**/api/analyze', r => r.fulfill({ json: { limit: 0, used: 0, remaining: 0, reason: 'aus' } }));

let n = 0;
async function shot(name) {
  n++;
  const file = `${String(n).padStart(2, '0')}-${name}`;
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(OUT, `${file}.png`), fullPage: true });
  await writeFile(join(OUT, `${file}.txt`), `${page.url()}\n\n${await page.locator('body').innerText()}`);
}

try {
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  await page.getByText('Das Problem').first().waitFor({ timeout: 30000 });
  await shot('einfuehrung-1');
  for (const i of [2, 3]) {
    await page.mouse.move(350, 400);
    await page.locator('div[style*="overflow-x"], [data-testid]').first().evaluate(() => {}).catch(() => {});
    await page.evaluate(w => { const s = [...document.querySelectorAll('div')].find(d => d.scrollWidth > d.clientWidth * 2); if (s) s.scrollLeft = w; }, 390 * (i - 1));
    await shot(`einfuehrung-${i}`);
  }
  await page.getByText('Beispiel ansehen').first().click();
  await page.getByText('Jetzt meine Abos eintragen →').waitFor({ timeout: 15000 });
  await shot('beispiel-ergebnis');
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  await page.getByText('Abos eintragen →').waitFor({ timeout: 30000 });
  await shot('startseite-nach-einfuehrung');
  await page.getByText('Abos eintragen →').click();
  await page.getByText(/Betrag/).first().waitFor({ timeout: 15000 });
  await shot('eintragen-leer');
  await page.getByText('Netflix', { exact: true }).first().click();
  await page.getByPlaceholder(/z\.B\. 9,99|Betrag|0,00/).first().fill('13,99').catch(async () => {
    await page.locator('input').nth(2).fill('13,99');
  });
  await shot('eintragen-ausgefuellt');
  await writeFile(join(OUT, 'eintragen-knoepfe.txt'),
    (await page.locator('[role="button"]').allInnerTexts()).join('\n'));
  await page.goto(base + '/upload', { waitUntil: 'networkidle' });
  await page.getByText(/kommt später/).first().waitFor({ timeout: 15000 });
  await shot('upload');
  await page.goto(base + '/results', { waitUntil: 'networkidle' });
  await shot('ergebnis-direkt');
} catch (err) {
  console.log('Abbruch:', err.message);
  await shot('abbruch');
} finally {
  await browser.close();
  server.close();
}
console.log(`${n} Aufnahmen in ${OUT}`);

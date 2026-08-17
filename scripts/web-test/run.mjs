/**
 * End-to-End-Test der Persistenz im echten Browser.
 *
 * Erwartet einen fertigen Web-Build in dist/ (npx expo export -p web).
 * Serviert dist/ mit SPA-Fallback und steuert das installierte Google Chrome
 * über playwright-core.
 *
 *   node scripts/web-test/run.mjs
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright-core';

const DIST = join(process.cwd(), 'dist');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.ttf': 'font/ttf',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.map': 'application/json',
};

const server = createServer(async (req, res) => {
  const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
  let file = join(DIST, normalize(url).replace(/^(\.\.[/\\])+/, ''));
  if (!existsSync(file) || url.endsWith('/')) {
    const html = `${file.replace(/\/$/, '')}.html`;
    file = existsSync(html) ? html : join(DIST, 'index.html');
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
console.log(`Server: ${base}`);

let failed = 0;
function check(label, ok, extra) {
  console.log(`${ok ? 'OK  ' : 'FEHL'} ${label}${extra !== undefined ? ` -> ${JSON.stringify(extra)}` : ''}`);
  if (!ok) failed++;
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage();
page.on('dialog', d => d.accept());
page.on('pageerror', e => console.log(`   [Seitenfehler] ${e.message}`));

const deleteButtons = () => page.locator('[aria-label$=" entfernen"]');
const storedNames = () => page.evaluate(() => {
  const raw = window.localStorage.getItem('kuendigo_subs_v1');
  return raw ? JSON.parse(raw).map(s => s.name) : null;
});

async function open(path) {
  await page.goto(base + path, { waitUntil: 'networkidle' });
}

try {
  // 1) Startscreen ohne gespeicherte Abos
  await open('/');
  await page.getByText('Jetzt analysieren →').waitFor({ timeout: 30000 });
  check('Startscreen ohne Daten zeigt keine Kachel',
    await page.getByText('Deine gespeicherten Abos').count() === 0);

  // 2) Ergebnisliste zeigt Beispieldaten, ohne sie zu speichern
  await open('/results');
  await page.getByText('Alle Abos').waitFor({ timeout: 30000 });
  const first = await deleteButtons().count();
  check('Abos werden angezeigt', first === 9, first);
  check('Bilanz startet im Leerzustand',
    await page.getByText(/Noch nichts gekündigt/).count() > 0);
  // Netflix, Spotify und Co. haben hinterlegte Fristen, es muss also
  // mindestens ein konkretes Datum auftauchen, nicht nur der neutrale Hinweis.
  check('konkreter Kündigungstag steht auf den Karten',
    await page.getByText(/Kündigen bis \d\d\.\d\d\.\d{4}|Frist war am \d\d\.\d\d\.\d{4}|letzte Tag zum Kündigen/).count() > 0);
  // NY Times und Adobe haben keine hinterlegte Frist
  check('unbekannte Fristen bekommen einen neutralen Hinweis',
    await page.getByText(/Frist unbekannt, am besten gleich kündigen/).count() > 0);
  check('Beispieldaten werden nicht gespeichert', (await storedNames()) === null);
  check('Hinweis auf Beispieldaten sichtbar', await page.getByText(/Beispieldaten/).count() > 0);

  // 3) Abo löschen: dabei wird die Liste dauerhaft übernommen
  const victim = (await deleteButtons().first().getAttribute('aria-label'))?.replace(' entfernen', '');
  await deleteButtons().first().click();
  await page.waitForFunction(
    n => JSON.parse(localStorage.getItem('kuendigo_subs_v1') ?? '[]').length === n, 8, { timeout: 10000 });
  check('Löschen entfernt das Abo', await deleteButtons().count() === 8, victim);
  check('Hinweis auf Beispieldaten verschwindet', await page.getByText(/Beispieldaten/).count() === 0);

  // 4) Neuladen der Web-App
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByText('Alle Abos').waitFor({ timeout: 30000 });
  const namesAfter = await storedNames();
  check('nach Neuladen noch da', await deleteButtons().count() === 8, namesAfter?.length);
  check('Löschen persistiert nach Neuladen', !namesAfter.includes(victim), victim);

  // 5) Kachel auf dem Startscreen
  await open('/');
  const tile = await page.getByText(/\d+ Abos · €/).first().textContent();
  check('Kachel zeigt Anzahl und Monatssumme', /^8 Abos · €\d+,\d\d \/ Monat$/.test(tile ?? ''), tile);
  await open('/results');
  await page.getByText('Alle Abos').waitFor({ timeout: 30000 });

  // 6) Als gekündigt markieren
  await page.getByText('Kündigen →').first().click();
  await page.getByText('✓ Als gekündigt markieren').click();
  await page.waitForFunction(
    () => JSON.parse(localStorage.getItem('kuendigo_subs_v1') ?? '[]').some(s => s.cancelled), null, { timeout: 10000 });
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByText('Alle Abos').waitFor({ timeout: 30000 });
  check('gekündigt-Markierung persistiert', await page.getByText('✓ Gekündigt').count() > 0);

  // Bilanz-Karte nach dem Neuladen
  const balance = await page.getByText(/Abo(s)? gekündigt/).first().textContent();
  const perMonth = await page.getByText(/pro Monat · €/).first().textContent();
  check('Bilanz zählt das gekündigte Abo', /^✓ 1 Abo gekündigt/.test(balance ?? ''), balance);
  check('Bilanz nennt Monats- und Jahreswert',
    /^pro Monat · €\d+,\d\d pro Jahr$/.test(perMonth ?? ''), perMonth);
  check('Bilanz überlebt das Neuladen', await page.getByText(/Deine Ersparnis/).count() > 0);

  // Fehlklick zurücknehmen
  await page.getByText('✓ Erledigt').first().click();
  await page.getByText('↩︎ Doch nicht gekündigt').click();
  await page.waitForFunction(
    () => !JSON.parse(localStorage.getItem('kuendigo_subs_v1') ?? '[]').some(s => s.cancelled),
    null, { timeout: 10000 });
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByText('Alle Abos').waitFor({ timeout: 30000 });
  check('zurückgenommene Kündigung verschwindet aus der Bilanz',
    await page.getByText(/Noch nichts gekündigt/).count() > 0);

  // 7) Kachel spiegelt den neuen Stand
  await open('/');
  const tile2 = await page.getByText(/\d+ Abos · €/).first().textContent();
  check('Kachel nach dem Löschen aktualisiert', /^8 Abos · €/.test(tile2 ?? ''), tile2);

  // 8) Alle Abos löschen: die Beispieldaten dürfen nicht zurückkehren
  await open('/results');
  await page.getByText('Alle Abos').waitFor({ timeout: 30000 });
  for (let left = await deleteButtons().count(); left > 0; left--) {
    await deleteButtons().first().click();
    await page.waitForFunction(
      n => JSON.parse(localStorage.getItem('kuendigo_subs_v1') ?? '[]').length === n,
      left - 1, { timeout: 10000 });
  }
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByText('Alle Abos').waitFor({ timeout: 30000 });
  check('leere Liste bleibt nach Neuladen leer', await deleteButtons().count() === 0);
  check('Beispieldaten kehren nicht zurück', await page.getByText(/Beispieldaten/).count() === 0);
  check('Leerzustand wird angezeigt', await page.getByText(/Keine gespeicherten Abos/).count() > 0);
  await open('/');
  check('Kachel verschwindet ohne Abos', await page.getByText(/\d+ Abos · €/).count() === 0);
} catch (err) {
  console.log(`FEHL Testlauf abgebrochen -> ${err.message}`);
  failed++;
} finally {
  await browser.close();
  server.close();
}

console.log(failed === 0 ? '\nAlle Browser-Prüfungen bestanden.' : `\n${failed} Prüfung(en) fehlgeschlagen.`);
process.exit(failed === 0 ? 0 : 1);

/**
 * End-to-End-Test der Persistenz im echten Browser.
 *
 * Erwartet einen fertigen Web-Build in dist/ (npx expo export -p web).
 * Serviert dist/ mit SPA-Fallback und steuert das installierte Google Chrome
 * über playwright-core.
 *
 *   node scripts/web-test/run.mjs
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { startStaticServer } from '../dev-static.mjs';

const DIST = join(process.cwd(), 'dist');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// Derselbe SPA-Fallback wie der Rewrite in vercel.json
const { server, base } = await startStaticServer(DIST);
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
// Onboarding ist ein eigener Weg (siehe onboarding-e2e falls vorhanden) und
// würde sonst jeden ersten open('/') abfangen, bevor der Startscreen zu
// sehen ist.
await page.addInitScript(() => localStorage.setItem('kuendigo_onboarded', '1'));

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
  check('Abos werden angezeigt', first === 5, first);
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
    n => JSON.parse(localStorage.getItem('kuendigo_subs_v1') ?? '[]').length === n, 4, { timeout: 10000 });
  check('Löschen entfernt das Abo', await deleteButtons().count() === 4, victim);
  check('Hinweis auf Beispieldaten verschwindet', await page.getByText(/Beispieldaten/).count() === 0);

  // 4) Neuladen der Web-App
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByText('Alle Abos').waitFor({ timeout: 30000 });
  const namesAfter = await storedNames();
  check('nach Neuladen noch da', await deleteButtons().count() === 4, namesAfter?.length);
  check('Löschen persistiert nach Neuladen', !namesAfter.includes(victim), victim);

  // 5) Kachel auf dem Startscreen
  await open('/');
  const tile = await page.getByText(/\d+ Abos · €/).first().textContent();
  check('Kachel zeigt Anzahl und Monatssumme', /^4 Abos · €\d+,\d\d \/ Monat$/.test(tile ?? ''), tile);
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
  check('Kachel nach dem Löschen aktualisiert', /^4 Abos · €/.test(tile2 ?? ''), tile2);

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

  // 9) Rechtsseiten: direkt aufrufbar und aus dem Fuß verlinkt
  await open('/impressum');
  await page.getByText('Impressum').first().waitFor({ timeout: 30000 });
  check('Impressum ist direkt aufrufbar',
    await page.getByText(/§ 5 E-Commerce-Gesetz/).count() > 0);
  check('Impressum nennt die Pflichtangaben',
    (await page.getByText(/Unternehmensgegenstand/).count()) > 0
    && (await page.getByText(/UID-Nummer/).count()) > 0
    && (await page.getByText(/Blattlinie/).count()) > 0);

  await open('/datenschutz');
  await page.getByText('1. Verantwortlicher').waitFor({ timeout: 30000 });
  check('Datenschutz ist direkt aufrufbar',
    await page.getByText(/Anthropic PBC/).count() > 0);
  check('Datenschutz nennt Drittland, Rechtsgrundlagen und Behörde',
    (await page.getByText(/Drittlandtransfer in die USA/).count()) > 0
    && (await page.getByText(/Art. 6 Abs. 1 lit. b DSGVO/).count()) > 0
    && (await page.getByText(/Österreichische Datenschutzbehörde/).count()) > 0);

  await open('/');
  await page.getByText('Jetzt analysieren →').waitFor({ timeout: 30000 });
  await page.getByText('Datenschutz', { exact: true }).first().click();
  await page.getByText('1. Verantwortlicher').waitFor({ timeout: 15000 });
  check('Fußlink auf dem Startscreen führt zum Datenschutz',
    await page.getByText(/Verantwortlicher/).count() > 0);

  await page.getByText('← Zurück').first().click();
  await page.getByText('Jetzt analysieren →').waitFor({ timeout: 15000 });
  check('Zurück führt wieder auf den Startscreen', true);

  // Einwilligungshinweis dort, wo die Übermittlung ausgelöst wird
  await open('/upload');
  await page.getByText('Wo sind deine Abos?').waitFor({ timeout: 30000 });
  check('Upload nennt Anthropic und die USA vor der Analyse',
    await page.getByText(/an Anthropic in den USA/).count() > 0);
  await page.getByText('Details in der Datenschutzerklärung →').click();
  await page.getByText('1. Verantwortlicher').waitFor({ timeout: 15000 });
  check('Hinweis im Upload verlinkt die Datenschutzerklärung',
    await page.getByText(/Drittlandtransfer in die USA/).count() > 0);

  // 10) Einwilligung vor der ersten Übertragung
  const consent = () => page.evaluate(() => {
    const raw = window.localStorage.getItem('kuendigo_consent_v1');
    return raw ? JSON.parse(raw) : null;
  });

  await open('/upload');
  await page.getByText('Wo sind deine Abos?').waitFor({ timeout: 30000 });
  await page.getByText('Girokonto').first().click();
  await page.getByText('Beispiel-Auszug einsetzen →').click();
  await page.getByText('Abos analysieren →').click();
  await page.getByText('Analyse durch Anthropic').waitFor({ timeout: 15000 });
  check('Analyse öffnet zuerst die Einwilligungsabfrage', true);
  check('Abfrage nennt Anthropic, USA und Widerruf',
    (await page.getByText(/an Anthropic PBC in die USA übertragen/).count()) > 0
    && (await page.getByText(/freiwillig und jederzeit widerrufbar/).count()) > 0
    && (await page.getByText(/speichert diese Inhalte nicht/).count()) > 0);

  // Der Link zur Erklärung schließt die Abfrage, statt sie darüber zu lassen
  await page.getByText('Zur Datenschutzerklärung →').click();
  await page.getByText('1. Verantwortlicher').waitFor({ timeout: 15000 });
  // Das Sheet muss verschwinden, sonst liegt es über der Erklärung
  await page.getByText('Analyse durch Anthropic').waitFor({ state: 'hidden', timeout: 10000 });
  check('Link aus der Abfrage öffnet die Erklärung lesbar',
    await page.getByText(/Drittlandtransfer in die USA/).count() > 0);
  check('Link speichert keine Einwilligung', (await consent()) === null);

  await open('/upload');
  await page.getByText('Wo sind deine Abos?').waitFor({ timeout: 30000 });
  await page.getByText('Girokonto').first().click();
  await page.getByText('Beispiel-Auszug einsetzen →').click();
  await page.getByText('Abos analysieren →').click();
  await page.getByText('Analyse durch Anthropic').waitFor({ timeout: 15000 });

  // Ohne Häkchen bleibt Zustimmen wirkungslos
  await page.getByText('Zustimmen').click();
  check('ohne Häkchen wird nichts gespeichert', (await consent()) === null);
  check('Abfrage bleibt ohne Häkchen offen',
    await page.getByText('Analyse durch Anthropic').isVisible());

  // Abbrechen blockiert die Analyse
  await page.getByText('Abbrechen').click();
  await page.getByText('Analyse durch Anthropic').waitFor({ state: 'hidden', timeout: 10000 });
  check('Abbrechen speichert keine Einwilligung', (await consent()) === null);
  check('Abbrechen überträgt nichts', !page.url().includes('/results'));

  // Mit Häkchen zustimmen
  await page.getByText('Abos analysieren →').click();
  await page.getByText('Analyse durch Anthropic').waitFor({ timeout: 15000 });
  await page.getByLabel(/Ich stimme der Übertragung/).click();
  await page.getByText('Zustimmen').click();
  await page.waitForFunction(() => !!localStorage.getItem('kuendigo_consent_v1'), null, { timeout: 10000 });
  const stored = await consent();
  check('Zeitpunkt und Textversion werden gespeichert',
    typeof stored?.grantedAt === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(stored.grantedAt)
    && typeof stored?.version === 'string' && stored.text.includes('Anthropic'),
    { grantedAt: stored?.grantedAt, version: stored?.version });

  // Status und Widerruf in den Einstellungen
  await open('/settings');
  await page.getByText('🤝 Einwilligung in die Analyse').waitFor({ timeout: 30000 });
  const status = await page.getByText(/✓ Erteilt am/).first().textContent();
  check('Einstellungen zeigen den Einwilligungsstatus mit Datum',
    /^✓ Erteilt am \d\d\.\d\d\.\d{4} um \d\d:\d\d Uhr$/.test(status ?? ''), status);

  await page.getByText('Einwilligung widerrufen').click();
  await page.waitForFunction(() => !localStorage.getItem('kuendigo_consent_v1'), null, { timeout: 10000 });
  check('Widerruf löscht die gespeicherte Einwilligung', (await consent()) === null);
  check('Status wechselt auf nicht erteilt',
    await page.getByText(/○ Noch nicht erteilt/).count() > 0);

  // Nach dem Widerruf wird erneut gefragt
  await open('/upload');
  await page.getByText('Wo sind deine Abos?').waitFor({ timeout: 30000 });
  await page.getByText('Girokonto').first().click();
  await page.getByText('Beispiel-Auszug einsetzen →').click();
  await page.getByText('Abos analysieren →').click();
  await page.getByText('Analyse durch Anthropic').waitFor({ timeout: 15000 });
  check('nach Widerruf erscheint die Abfrage erneut', true);

  // 11) Startseite auf schmalen Bildschirmen
  for (const [w, h] of [[320, 568], [360, 640]]) {
    await page.setViewportSize({ width: w, height: h });
    await open('/');
    await page.getByText('Jetzt analysieren →').waitFor({ timeout: 30000 });

    const box = await page.evaluate(() => {
      const el = document.scrollingElement || document.documentElement;
      return { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth };
    });
    check(`kein horizontaler Überlauf bei ${w}px`,
      box.scrollWidth <= box.clientWidth + 1, box);

    // Die dekorativen Ringe ragen bewusst hinaus und werden beschnitten,
    // geprüft wird deshalb nur Inhalt mit Text.
    const clipped = await page.evaluate(vw => [...document.querySelectorAll('div, span, a')]
      .filter(n => (n.textContent ?? '').trim().length > 0)
      .filter(n => {
        const r = n.getBoundingClientRect();
        return r.width > 0 && (r.right > vw + 1 || r.left < -1);
      })
      .map(n => (n.textContent ?? '').trim().slice(0, 40)), w);
    check(`kein Text ragt über den Bildschirm hinaus bei ${w}px`, clipped.length === 0, clipped);

    check(`Schätzwerte sind als solche gekennzeichnet (${w}px)`,
      (await page.getByText('Schätzwerte').first().isVisible())
      && (await page.getByText(/Durchschnittsschätzung aus Erfahrungswerten/).count()) > 0);

    await page.getByText(/Zur Datenschutzerklärung/).first().scrollIntoViewIfNeeded();
    check(`Datenschutzhinweis erreichbar bei ${w}px`,
      await page.getByText(/verschlüsselt an unseren KI-Dienstleister/).first().isVisible());
    check(`Fußlinks erreichbar bei ${w}px`,
      (await page.getByText('Impressum').first().isVisible())
      && (await page.getByText('Datenschutz', { exact: true }).first().isVisible()));
    check(`Analyse-Knopf erreichbar bei ${w}px`,
      await page.getByText('Jetzt analysieren →').isVisible());
  }

  // Link im Fußhinweis: per Tastatur erreichbar und führt zur Erklärung
  const linkFocusable = await page.evaluate(() => {
    const el = [...document.querySelectorAll('div, span, a')]
      .find(n => (n.textContent ?? '').trim() === 'Zur Datenschutzerklärung');
    return el ? { role: el.getAttribute('role'), tabindex: el.getAttribute('tabindex') } : null;
  });
  check('Inline-Link ist als Link ausgezeichnet und fokussierbar',
    linkFocusable?.role === 'link' && linkFocusable?.tabindex !== null, linkFocusable);

  await page.getByText(/Zur Datenschutzerklärung/).first().click();
  await page.getByText('1. Verantwortlicher').waitFor({ timeout: 15000 });
  check('Fußhinweis verlinkt die Datenschutzerklärung',
    await page.getByText(/Drittlandtransfer in die USA/).count() > 0);
  await page.setViewportSize({ width: 1280, height: 900 });

  // Vercel liefert unbekannte Pfade an die SPA aus, sonst wären die Routen 404
  const rewrites = JSON.parse(await readFile(join(process.cwd(), 'vercel.json'), 'utf8')).rewrites ?? [];
  check('vercel.json leitet alle Seitenpfade auf index.html',
    rewrites.some(r => r.source === '/(.*)' && r.destination === '/index.html'), rewrites);
} catch (err) {
  console.log(`FEHL Testlauf abgebrochen -> ${err.message}`);
  failed++;
} finally {
  await browser.close();
  server.close();
}

console.log(failed === 0 ? '\nAlle Browser-Prüfungen bestanden.' : `\n${failed} Prüfung(en) fehlgeschlagen.`);
process.exit(failed === 0 ? 0 : 1);

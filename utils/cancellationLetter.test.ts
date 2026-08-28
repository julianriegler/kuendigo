/**
 * Prüft buildLetterHtml: Umlaute bleiben korrekt (kein Escaping-Schaden),
 * das Datum landet im Format TT.MM.JJJJ, die Pflichtformulierungen zur
 * ordentlichen Kündigung stehen drin, und HTML-Sonderzeichen in Nutzereingaben
 * werden escaped statt das Markup zu brechen.
 *
 * Frei von Expo- und React-Native-Importen, läuft direkt in Node
 * (node --experimental-strip-types --no-warnings utils/cancellationLetter.test.ts).
 */
import { buildLetterHtml } from './cancellationLetter.ts';

let failed = 0;
function check(label: string, ok: boolean, extra?: unknown) {
  console.log(`${ok ? 'OK  ' : 'FEHL'} ${label}${extra !== undefined ? ` -> ${JSON.stringify(extra)}` : ''}`);
  if (!ok) failed++;
}

const html = buildLetterHtml({
  sender: {
    name: 'Jürgen Müller',
    street: 'Grünstraße 5',
    zip: '80331',
    city: 'München',
    email: 'juergen@example.com',
  },
  serviceName: 'Netflix',
  providerAddress: 'Netflix Services Germany GmbH\nFriedrichstraße 88\n10117 Berlin',
  customerNumber: '12345',
  contractStart: '01.03.2022',
  desiredDate: '31.12.2026',
  today: new Date(2026, 7, 28), // 28.08.2026 (Monat 0-indiziert)
});

check('UTF-8 Meta gesetzt', html.includes('<meta charset="UTF-8" />'));
check('Umlaute im Namen bleiben erhalten', html.includes('Jürgen Müller'));
check('Umlaute in der Straße bleiben erhalten', html.includes('Grünstraße 5'));
check('Umlaute im Ort bleiben erhalten', html.includes('München'));
check('Heutiges Datum im Format TT.MM.JJJJ', html.includes('28.08.2026'));
check('Ordentliche Kündigung zum nächstmöglichen Termin', html.includes('ordentlich zum nächstmöglichen Termin'));
check('Hilfsweise zum Wunschtermin', html.includes('hilfsweise zum 31.12.2026'));
check('Bitte um schriftliche Bestätigung mit Beendigungsdatum', html.includes('schriftliche Bestätigung') && html.includes('Beendigungsdatum'));
check('Kundennummer steht drin', html.includes('Kundennummer: 12345'));
check('Vertragsbeginn steht drin', html.includes('Vertragsbeginn: 01.03.2022'));
check('Servicename steht drin', html.includes('Netflix'));
check('Unterschriftszeile vorhanden', html.includes('class="linie"'));
check('Anbieter-Anschrift steht mehrzeilig im Empfängerblock', html.includes('Netflix Services Germany GmbH<br />Friedrichstraße 88<br />10117 Berlin'));
check('Kein Platzhalter, wenn Anbieter-Anschrift angegeben ist', !html.includes('[Anschrift des Anbieters eintragen]'));

// Ohne Wunschtermin fällt „hilfsweise" weg, statt eine leere Phrase zu erzeugen.
// Ohne Anbieter-Anschrift steht die Platzhalterzeile sichtbar im Brief.
const ohneWunschtermin = buildLetterHtml({
  sender: { name: 'Anna Bauer', street: 'Teststr. 1', zip: '1010', city: 'Wien' },
  serviceName: 'Spotify',
  today: new Date(2026, 0, 5),
});
check('Ohne Wunschtermin kein "hilfsweise"', !ohneWunschtermin.includes('hilfsweise'));
check('Ohne Wunschtermin trotzdem ordentliche Kündigung', ohneWunschtermin.includes('ordentlich zum nächstmöglichen Termin'));
check('Datum 05.01.2026 korrekt (führende Nullen)', ohneWunschtermin.includes('05.01.2026'));
check('Ohne Anbieter-Anschrift erscheint die Platzhalterzeile', ohneWunschtermin.includes('[Anschrift des Anbieters eintragen]'));

// HTML-Sonderzeichen in Nutzereingaben dürfen das Markup nicht brechen.
const mitSonderzeichen = buildLetterHtml({
  sender: { name: 'Schmidt & Söhne <Test>', street: 'Weg 1', zip: '1000', city: 'Ort' },
  serviceName: 'Fitness"Club',
  providerAddress: 'Anbieter & Co <GmbH>',
  today: new Date(2026, 0, 1),
});
check('Kaufmanns-Und wird escaped', mitSonderzeichen.includes('Schmidt &amp; Söhne'));
check('Spitzklammern werden escaped', mitSonderzeichen.includes('&lt;Test&gt;') && !mitSonderzeichen.includes('<Test>'));
check('Anführungszeichen im Servicenamen werden escaped', mitSonderzeichen.includes('Fitness&quot;Club'));
check('Sonderzeichen in Anbieter-Anschrift werden escaped', mitSonderzeichen.includes('Anbieter &amp; Co &lt;GmbH&gt;'));

console.log(failed === 0 ? '\nAlle Prüfungen bestanden.' : `\n${failed} Prüfung(en) fehlgeschlagen.`);
process.exit(failed === 0 ? 0 : 1);

/**
 * Kündigungsschreiben als HTML, gedacht zum Drucken/als PDF (window.print
 * bzw. expo-print) und zum Teilen.
 *
 * Rechtlicher Rahmen (kein Rechtsrat im Einzelfall): ordentliche Kündigung
 * zum nächstmöglichen Termin, hilfsweise zum gewünschten Termin, mit Bitte
 * um schriftliche Bestätigung des Beendigungsdatums.
 */

export interface LetterSender {
  name: string;
  street: string;
  zip: string;
  city: string;
  email?: string;
}

export interface LetterInput {
  sender: LetterSender;
  serviceName: string;
  /** Freitext, mehrzeilig möglich (Straße, PLZ/Ort in eigenen Zeilen). */
  providerAddress?: string;
  /** Freitext, wie vom Nutzer eingegeben, z.B. „12345". */
  customerNumber?: string;
  /** Freitext im Format TT.MM.JJJJ, wie vom Nutzer eingegeben. */
  contractStart?: string;
  /** Freitext im Format TT.MM.JJJJ, wie vom Nutzer eingegeben ("Wunschtermin"). */
  desiredDate?: string;
  /** Datum für die Ort/Datum-Zeile. Default: heute (für Tests überschreibbar). */
  today?: Date;
}

/** Datum -> TT.MM.JJJJ. */
function formatDateDe(d: Date): string {
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  return `${day}.${month}.${d.getFullYear()}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Baut das Kündigungsschreiben als vollständiges HTML-Dokument (druckfertig, A4). */
export function buildLetterHtml(input: LetterInput): string {
  const { sender, serviceName, providerAddress, customerNumber, contractStart, desiredDate } = input;
  const today = input.today ?? new Date();
  const todayDe = formatDateDe(today);
  const ort = sender.city.trim() || 'Ort';

  const name = escapeHtml(sender.name.trim());
  const street = escapeHtml(sender.street.trim());
  const zipCity = escapeHtml(`${sender.zip.trim()} ${sender.city.trim()}`.trim());
  const email = sender.email?.trim() ? escapeHtml(sender.email.trim()) : '';
  const service = escapeHtml(serviceName.trim());

  const providerAddressHtml = providerAddress?.trim()
    ? providerAddress.trim().split('\n').map(line => escapeHtml(line.trim())).join('<br />')
    : '<span style="color:#999;font-style:italic;">[Anschrift des Anbieters eintragen]</span>';

  const bezugszeile = [
    customerNumber?.trim() ? `Kundennummer: ${escapeHtml(customerNumber.trim())}` : '',
    contractStart?.trim() ? `Vertragsbeginn: ${escapeHtml(contractStart.trim())}` : '',
  ].filter(Boolean).join(' · ');

  const wunschtermin = desiredDate?.trim() ? escapeHtml(desiredDate.trim()) : '';
  const kuendigungssatz = wunschtermin
    ? `hiermit kündige ich meinen Vertrag bei ${service} ordentlich zum nächstmöglichen Termin, hilfsweise zum ${wunschtermin}.`
    : `hiermit kündige ich meinen Vertrag bei ${service} ordentlich zum nächstmöglichen Termin.`;

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8" />
<title>Kündigung ${service}</title>
<style>
  @page { size: A4; margin: 2.5cm 2.5cm 2cm 2.5cm; }
  * { box-sizing: border-box; }
  body {
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 12pt;
    line-height: 1.5;
    color: #111;
    max-width: 700px;
    margin: 0 auto;
    padding: 24px;
  }
  .absender { margin-bottom: 48px; font-size: 11pt; }
  .empfaenger { margin-bottom: 32px; }
  .ort-datum { text-align: right; margin-bottom: 32px; }
  .betreff { font-weight: bold; margin-bottom: 24px; }
  p { margin: 0 0 16px 0; }
  .signatur { margin-top: 64px; }
  .signatur .linie { margin-top: 56px; border-top: 1px solid #111; width: 240px; }
  .signatur .beschriftung { font-size: 10pt; color: #555; margin-top: 4px; }
</style>
</head>
<body>
  <div class="absender">
    ${name}<br />
    ${street}<br />
    ${zipCity}${email ? `<br />${email}` : ''}
  </div>

  <div class="empfaenger">
    An<br />
    ${service}<br />
    ${providerAddressHtml}
  </div>

  <div class="ort-datum">${escapeHtml(ort)}, den ${todayDe}</div>

  <div class="betreff">Betreff: Ordentliche Kündigung${bezugszeile ? ` (${bezugszeile})` : ''}</div>

  <p>Sehr geehrte Damen und Herren,</p>

  <p>${kuendigungssatz}</p>

  <p>Ich bitte Sie um eine schriftliche Bestätigung dieser Kündigung sowie um Mitteilung des genauen Beendigungsdatums meines Vertrags.</p>

  <p>Mit freundlichen Grüßen</p>

  <div class="signatur">
    <div class="linie"></div>
    <div class="beschriftung">${name}</div>
  </div>
</body>
</html>`;
}

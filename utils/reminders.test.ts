/**
 * Prüft computeReminderPlans: X Tage vor nextCharge (samt Uhrzeit),
 * Vergangenheits-Termine werden übersprungen, Abos ohne Termin und
 * gekündigte Abos werden ignoriert, und ein heute schon verstrichener
 * dringendster Termin wird gerettet statt verworfen.
 *
 * Frei von Expo- und React-Native-Importen, läuft direkt in Node
 * (node --experimental-strip-types --no-warnings utils/reminders.test.ts).
 */
import { computeReminderPlans } from './reminderPlan.ts';

let failed = 0;
function check(label: string, ok: boolean, extra?: unknown) {
  console.log(`${ok ? 'OK  ' : 'FEHL'} ${label}${extra !== undefined ? ` -> ${JSON.stringify(extra)}` : ''}`);
  if (!ok) failed++;
}

function sub(over: Record<string, unknown> = {}) {
  return {
    id: 'x', name: 'Test', amount: 9.99, frequency: 'monthly', category: 'other',
    lastCharged: '2026-07-15', nextCharge: '2026-08-15', ...over,
  } as any;
}

const heute = new Date(2026, 7, 10); // 10.08.2026, 00:00 Uhr lokal wie in der App

// ─── X Tage vor nextCharge, um 09:00 Uhr ─────────────────────────────────

const netflix = sub({ id: 'a', name: 'Netflix', nextCharge: '2026-08-15' });
const plans3 = computeReminderPlans([netflix], 3, heute, 9);
check('3 Tage Vorlauf: Erinnerung am 12.08.2026 um 09:00',
  plans3.length === 1 && plans3[0].fireAt === new Date(2026, 7, 12, 9, 0, 0, 0).toISOString(), plans3);

const plans1 = computeReminderPlans([netflix], 1, heute, 9);
check('1 Tag Vorlauf: Erinnerung am 14.08.2026 um 09:00',
  plans1.length === 1 && plans1[0].fireAt === new Date(2026, 7, 14, 9, 0, 0, 0).toISOString(), plans1);

const plans7 = computeReminderPlans([netflix], 7, heute, 9);
check('7 Tage Vorlauf: Erinnerung am 08.08.2026 (Vergangenheit, wird übersprungen)', plans7.length === 0, plans7);

// ─── Vergangenheits-Termine werden übersprungen ───────────────────────────

const vergangen = sub({ id: 'b', name: 'Abgelaufen', nextCharge: '2026-08-11' });
const plansVergangen = computeReminderPlans([vergangen], 3, heute, 9);
check('Erinnerungstermin in der Vergangenheit wird übersprungen', plansVergangen.length === 0, plansVergangen);

const heuteGenau = sub({ id: 'c', name: 'Heute fällig', nextCharge: '2026-08-10' });
check('Erinnerungstermin heute wird noch geplant (nicht < heute)',
  computeReminderPlans([heuteGenau], 0, heute, 9).length === 1);

// ─── Abos ohne Termin werden ignoriert, kein Absturz ──────────────────────

const ohneTermin = sub({ id: 'd', name: 'Ohne Termin', nextCharge: '' });
const ungueltig = sub({ id: 'e', name: 'Ungültig', nextCharge: 'kein-datum' });
const plansOhneTermin = computeReminderPlans([ohneTermin, ungueltig], 3, heute, 9);
check('Abo ohne Termin wird ignoriert, kein Absturz', plansOhneTermin.length === 0, plansOhneTermin);

// ─── Gekündigte Abos werden ignoriert ─────────────────────────────────────

const gekuendigt = sub({ id: 'f', name: 'Gekündigt', nextCharge: '2026-08-20', cancelled: true });
const plansGekuendigt = computeReminderPlans([gekuendigt], 3, heute, 9);
check('Gekündigtes Abo bekommt keine Erinnerung', plansGekuendigt.length === 0, plansGekuendigt);

// ─── Mehrere Abos ergeben die richtige Anzahl ─────────────────────────────

const mix = computeReminderPlans([netflix, vergangen, ohneTermin, gekuendigt, heuteGenau], 3, heute, 9);
check('Aus fünf Abos wird genau eine Erinnerung geplant', mix.length === 1 && mix[0].subName === 'Netflix', mix.map(p => p.subName));

check('leere Liste stürzt nicht ab', computeReminderPlans([], 3, heute, 9).length === 0);

// ─── Uhrzeit-Bug: nextCharge genau daysBefore Tage entfernt, aber schon
// nach der Erinnerungs-Uhrzeit -> kein Trigger in der Vergangenheit ───────
//
// Vorher wurde nur der Tag verglichen (fireDay < today), nicht die Uhrzeit.
// heute 14:30 Uhr, nextCharge = heute + 3 Tage -> Erinnerung würde auf
// heute 09:00 Uhr fallen, das liegt schon 5,5 Stunden zurück. Der
// dringendste (einzige) Termin wird gerettet: auf jetzt+5 Minuten gelegt,
// statt in der Vergangenheit zu liegen oder wortlos zu verschwinden.

const heute1430 = new Date(2026, 7, 10, 14, 30, 0, 0);
const heuteObendrauf = sub({ id: 'g', name: 'Uhrzeit-Fall', nextCharge: '2026-08-13' }); // heute + 3 Tage
const plansUhrzeit = computeReminderPlans([heuteObendrauf], 3, heute1430, 9);
check('Kein Erinnerungs-Trigger in der Vergangenheit, dringendster Termin wird gerettet',
  plansUhrzeit.length === 1 && new Date(plansUhrzeit[0].fireAt).getTime() > heute1430.getTime(), plansUhrzeit);
check('Geretteter Termin liegt auf jetzt+5 Minuten',
  plansUhrzeit.length === 1 && plansUhrzeit[0].fireAt === new Date(heute1430.getTime() + 5 * 60 * 1000).toISOString(),
  plansUhrzeit);

console.log(failed === 0 ? '\nAlle Prüfungen bestanden.' : `\n${failed} Prüfung(en) fehlgeschlagen.`);
process.exit(failed === 0 ? 0 : 1);

/**
 * Prüft computeReminderPlans: X Tage vor nextCharge, Vergangenheits-Termine
 * werden übersprungen, Abos ohne Termin und gekündigte Abos werden ignoriert.
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

const heute = new Date(2026, 7, 10); // 10.08.2026, lokale Zeit wie in der App

// ─── X Tage vor nextCharge ────────────────────────────────────────────────

const netflix = sub({ id: 'a', name: 'Netflix', nextCharge: '2026-08-15' });
const plans3 = computeReminderPlans([netflix], 3, heute);
check('3 Tage Vorlauf: Erinnerung am 12.08.2026', plans3.length === 1 && plans3[0].fireDate === '2026-08-12', plans3);

const plans1 = computeReminderPlans([netflix], 1, heute);
check('1 Tag Vorlauf: Erinnerung am 14.08.2026', plans1.length === 1 && plans1[0].fireDate === '2026-08-14', plans1);

const plans7 = computeReminderPlans([netflix], 7, heute);
check('7 Tage Vorlauf: Erinnerung am 08.08.2026 (Vergangenheit, wird übersprungen)', plans7.length === 0, plans7);

// ─── Vergangenheits-Termine werden übersprungen ───────────────────────────

const vergangen = sub({ id: 'b', name: 'Abgelaufen', nextCharge: '2026-08-11' });
const plansVergangen = computeReminderPlans([vergangen], 3, heute);
check('Erinnerungstermin in der Vergangenheit wird übersprungen', plansVergangen.length === 0, plansVergangen);

const heuteGenau = sub({ id: 'c', name: 'Heute fällig', nextCharge: '2026-08-10' });
const plansHeute = computeReminderPlans([heuteGenau], 0, heute);
check('Erinnerungstermin heute wird noch geplant (nicht < heute)', computeReminderPlans([heuteGenau], 0, heute).length === 1);

// ─── Abos ohne Termin werden ignoriert, kein Absturz ──────────────────────

const ohneTermin = sub({ id: 'd', name: 'Ohne Termin', nextCharge: '' });
const ungueltig = sub({ id: 'e', name: 'Ungültig', nextCharge: 'kein-datum' });
const plansOhneTermin = computeReminderPlans([ohneTermin, ungueltig], 3, heute);
check('Abo ohne Termin wird ignoriert, kein Absturz', plansOhneTermin.length === 0, plansOhneTermin);

// ─── Gekündigte Abos werden ignoriert ─────────────────────────────────────

const gekuendigt = sub({ id: 'f', name: 'Gekündigt', nextCharge: '2026-08-20', cancelled: true });
const plansGekuendigt = computeReminderPlans([gekuendigt], 3, heute);
check('Gekündigtes Abo bekommt keine Erinnerung', plansGekuendigt.length === 0, plansGekuendigt);

// ─── Mehrere Abos ergeben die richtige Anzahl ─────────────────────────────

const mix = computeReminderPlans([netflix, vergangen, ohneTermin, gekuendigt, heuteGenau], 3, heute);
check('Aus fünf Abos wird genau eine Erinnerung geplant', mix.length === 1 && mix[0].subName === 'Netflix', mix.map(p => p.subName));

check('leere Liste stürzt nicht ab', computeReminderPlans([], 3, heute).length === 0);

console.log(failed === 0 ? '\nAlle Prüfungen bestanden.' : `\n${failed} Prüfung(en) fehlgeschlagen.`);
process.exit(failed === 0 ? 0 : 1);

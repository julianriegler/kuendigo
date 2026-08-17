/**
 * Prüft die Fristen-Rechnung (latestCancelDate, cancelDeadline) und den
 * Ersparnis-Zähler, inklusive jährlichem und wöchentlichem Abo.
 *
 * Beide Module sind frei von Expo- und React-Native-Importen und laufen
 * deshalb direkt in Node.
 */
import { latestCancelDate, cancelDeadline, getCancellationGuide } from '../../utils/cancellationSteps.ts';
import { monthlyAmount, annualAmount, cancelledSavings } from '../../utils/subscriptionMath.ts';

let failed = 0;
function check(label: string, ok: boolean, extra?: unknown) {
  console.log(`${ok ? 'OK  ' : 'FEHL'} ${label}${extra !== undefined ? ` -> ${JSON.stringify(extra)}` : ''}`);
  if (!ok) failed++;
}

function near(a: number, b: number, tolerance = 0.005) {
  return Math.abs(a - b) < tolerance;
}

function sub(over: Record<string, unknown> = {}) {
  return {
    id: 'x', name: 'Test', amount: 10, frequency: 'monthly', category: 'other',
    lastCharged: '2026-07-15', nextCharge: '2026-08-15', ...over,
  } as any;
}

// ─── latestCancelDate ────────────────────────────────────────────────────────

check('Frist 30 Tage zieht 30 Tage ab',
  latestCancelDate('2026-08-15', 30) === '2026-07-16', latestCancelDate('2026-08-15', 30));
check('Frist 0 Tage ergibt den Abbuchungstag',
  latestCancelDate('2026-08-15', 0) === '2026-08-15');
check('Frist über Monatsgrenze rechnet richtig',
  latestCancelDate('2026-03-01', 1) === '2026-02-28', latestCancelDate('2026-03-01', 1));
check('Schaltjahr wird berücksichtigt',
  latestCancelDate('2028-03-01', 1) === '2028-02-29', latestCancelDate('2028-03-01', 1));
check('Frist über Jahresgrenze rechnet richtig',
  latestCancelDate('2027-01-10', 14) === '2026-12-27', latestCancelDate('2027-01-10', 14));
check('unbekannte Frist ergibt null', latestCancelDate('2026-08-15', undefined) === null);
check('ungültiges Datum ergibt null', latestCancelDate('irgendwann', 30) === null);
check('negative Frist ergibt null', latestCancelDate('2026-08-15', -5) === null);

// ─── cancelDeadline mit echten Diensten ──────────────────────────────────────

const heute = new Date(2026, 7, 17); // 17.08.2026, lokale Zeit wie in der App

const dazn = cancelDeadline('DAZN', '2026-09-30', heute);
check('DAZN hat 30 Tage Frist und 12 Monate Mindestlaufzeit',
  dazn.noticePeriodDays === 30 && dazn.minTermMonths === 12, dazn);
check('DAZN Kündigungstag ist der 31.08.2026', dazn.date === '2026-08-31', dazn.date);
check('DAZN Restzeit sind 14 Tage', dazn.daysLeft === 14, dazn.daysLeft);

const netflix = cancelDeadline('Netflix', '2026-08-15', heute);
check('Netflix ist bis zum Abbuchungstag kündbar', netflix.date === '2026-08-15', netflix.date);
check('vergangene Frist ergibt negative Restzeit', netflix.daysLeft === -2, netflix.daysLeft);

const appStore = cancelDeadline('Headspace', '2026-08-20', heute);
check('App-Store-Abo braucht einen Tag Vorlauf', appStore.date === '2026-08-19', appStore.date);

const unbekannt = cancelDeadline('Kleiner Regionalanbieter', '2026-08-20', heute);
check('unbekannter Dienst hat keine Frist',
  unbekannt.date === null && unbekannt.daysLeft === null && unbekannt.noticePeriodDays === undefined, unbekannt);

const ohneFrist = cancelDeadline('Adobe', '2026-08-20', heute);
check('bekannter Dienst ohne Fristangabe zeigt nur die Mindestlaufzeit',
  ohneFrist.date === null && ohneFrist.minTermMonths === 12, ohneFrist);

check('Teiltreffer findet den Dienst',
  getCancellationGuide('Netflix Intl BV')?.noticePeriodDays === 0);

// ─── Ersparnis ───────────────────────────────────────────────────────────────

const jahresabo = sub({ id: 'a', name: 'Jahresabo', amount: 120, frequency: 'annual', cancelled: true });
const wochenabo = sub({ id: 'w', name: 'Wochenabo', amount: 5, frequency: 'weekly', cancelled: true });
const monatsabo = sub({ id: 'm', name: 'Monatsabo', amount: 9.99, frequency: 'monthly', cancelled: true });
const quartal   = sub({ id: 'q', name: 'Quartalsabo', amount: 30, frequency: 'quarterly', cancelled: true });
const aktiv     = sub({ id: 'n', name: 'Läuft weiter', amount: 50, frequency: 'monthly' });

check('Jahresabo: 120 im Jahr sind 10 im Monat', near(monthlyAmount(jahresabo), 10), monthlyAmount(jahresabo));
check('Jahresabo bleibt im Jahr bei 120', near(annualAmount(jahresabo), 120), annualAmount(jahresabo));
check('Wochenabo: 5 pro Woche sind 21,73 im Monat', near(monthlyAmount(wochenabo), 21.725), monthlyAmount(wochenabo));
check('Wochenabo: 5 pro Woche sind 260,70 im Jahr', near(annualAmount(wochenabo), 260.7), annualAmount(wochenabo));
check('Quartalsabo: 30 im Quartal sind 10 im Monat', near(monthlyAmount(quartal), 10));

const savings = cancelledSavings([jahresabo, wochenabo, monatsabo, quartal, aktiv]);
check('nur gekündigte Abos zählen', savings.count === 4, savings.count);
check('Ersparnis pro Monat stimmt', near(savings.perMonth, 10 + 21.725 + 9.99 + 10), savings.perMonth);
check('Ersparnis pro Jahr ist das Zwölffache', near(savings.perYear, savings.perMonth * 12), savings.perYear);

const leer = cancelledSavings([aktiv]);
check('ohne Kündigungen ist die Bilanz null',
  leer.count === 0 && leer.perMonth === 0 && leer.perYear === 0, leer);
check('leere Liste stürzt nicht ab', cancelledSavings([]).perYear === 0);

console.log(failed === 0 ? '\nAlle Prüfungen bestanden.' : `\n${failed} Prüfung(en) fehlgeschlagen.`);
process.exit(failed === 0 ? 0 : 1);

/**
 * Reine Berechnung, wann welches Abo eine Erinnerung bekommt: ohne Plattform-
 * Abhängigkeiten (kein react-native/expo-Import), damit sie sich ohne Expo
 * testen lässt.
 */
import type { Subscription } from './analyzeSubscriptions';

/** Standard-Uhrzeit, zu der Erinnerungen feuern (lokale Stunde, 0-23). */
export const DEFAULT_REMINDER_HOUR = 9;

export interface ReminderPlan {
  subId: string;
  subName: string;
  amount: number;
  /** ISO-Zeitstempel des tatsächlichen Feuerungs-Zeitpunkts (absoluter Moment, keine Kalender-Zeichenkette). */
  fireAt: string;
  nextCharge: string; // YYYY-MM-DD, Tag der Abbuchung
}

/**
 * Welche Abos bekommen eine Erinnerung X Tage vor nextCharge, um reminderHour
 * Uhr? Gekündigte Abos, Abos ohne (gültigen) Termin und Erinnerungstage, die
 * komplett in der Vergangenheit liegen, werden übersprungen statt zum
 * Absturz zu führen.
 *
 * Liegt der berechnete Zeitpunkt (Tag + Uhrzeit) für den dringendsten Termin
 * (die nächste Abbuchung) bereits in der Vergangenheit — z.B. weil nextCharge
 * genau daysBefore Tage entfernt ist und es schon nach reminderHour Uhr ist —
 * wird er nicht verworfen, sondern auf jetzt+5 Minuten gelegt. Andere an
 * diesem Tag schon verstrichene Termine fallen weg.
 */
export function computeReminderPlans(
  subs: Subscription[],
  daysBefore: number,
  now: Date = new Date(),
  reminderHour: number = DEFAULT_REMINDER_HOUR,
): ReminderPlan[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  type Candidate = ReminderPlan & { fireAt: string; overdue: boolean };
  const candidates: Candidate[] = [];

  for (const sub of subs) {
    if (sub.cancelled) continue;
    if (!sub.nextCharge) continue;
    const charge = new Date(`${sub.nextCharge}T00:00:00`);
    if (Number.isNaN(charge.getTime())) continue;

    const fireDay = new Date(charge);
    fireDay.setDate(fireDay.getDate() - daysBefore);
    if (fireDay < today) continue; // Tag komplett vergangen: überspringen

    const fireAt = new Date(fireDay);
    fireAt.setHours(reminderHour, 0, 0, 0);

    candidates.push({
      subId: sub.id,
      subName: sub.name,
      amount: sub.amount,
      fireAt: fireAt.toISOString(),
      nextCharge: sub.nextCharge,
      overdue: fireAt.getTime() <= now.getTime(),
    });
  }

  // Von den heute schon verstrichenen Zeitpunkten nur den dringendsten
  // (die nächste Abbuchung) retten statt wortlos zu verwerfen.
  const overdue = candidates.filter(c => c.overdue);
  if (overdue.length > 0) {
    overdue.sort((a, b) => a.nextCharge.localeCompare(b.nextCharge));
    const rescued = overdue[0];
    rescued.fireAt = new Date(now.getTime() + 5 * 60 * 1000).toISOString();
    rescued.overdue = false;
  }

  return candidates
    .filter(c => !c.overdue)
    .map(({ overdue: _overdue, ...plan }) => plan);
}

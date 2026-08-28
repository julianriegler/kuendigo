/**
 * Reine Berechnung, wann welches Abo eine Erinnerung bekommt: ohne Plattform-
 * Abhängigkeiten (kein react-native/expo-Import), damit sie sich ohne Expo
 * testen lässt.
 */
import type { Subscription } from './analyzeSubscriptions';

/** Lokales Datum -> YYYY-MM-DD, ohne UTC-Verschiebung (kein toISOString!). */
function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export interface ReminderPlan {
  subId: string;
  subName: string;
  amount: number;
  fireDate: string;   // YYYY-MM-DD, Tag der Erinnerung
  nextCharge: string; // YYYY-MM-DD, Tag der Abbuchung
}

/**
 * Welche Abos bekommen eine Erinnerung X Tage vor nextCharge? Gekündigte
 * Abos, Abos ohne (gültigen) Termin und bereits vergangene Erinnerungstermine
 * werden übersprungen statt zum Absturz zu führen.
 */
export function computeReminderPlans(
  subs: Subscription[],
  daysBefore: number,
  now: Date = new Date(),
): ReminderPlan[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const plans: ReminderPlan[] = [];

  for (const sub of subs) {
    if (sub.cancelled) continue;
    if (!sub.nextCharge) continue;
    const charge = new Date(`${sub.nextCharge}T00:00:00`);
    if (Number.isNaN(charge.getTime())) continue;

    const fireDay = new Date(charge);
    fireDay.setDate(fireDay.getDate() - daysBefore);
    if (fireDay < today) continue; // Vergangenheits-Termine überspringen

    plans.push({
      subId: sub.id,
      subName: sub.name,
      amount: sub.amount,
      fireDate: toIsoDate(fireDay),
      nextCharge: sub.nextCharge,
    });
  }
  return plans;
}

/**
 * Lokale Erinnerungen vor der nächsten Abbuchung.
 *
 * Auf Web tut alles hier still nichts (Platform.OS-Weiche): expo-notifications
 * wird nie statisch importiert, sondern erst zur Laufzeit auf Native geladen,
 * damit der Web-Build nicht daran crasht. Die reine Terminberechnung steckt
 * in reminderPlan.ts (ohne react-native-Import), damit sie ohne Expo testbar ist.
 */
import { Platform } from 'react-native';
import { computeReminderPlans } from './reminderPlan';
import type { Subscription } from './analyzeSubscriptions';

export { computeReminderPlans } from './reminderPlan';
export type { ReminderPlan } from './reminderPlan';

const REMINDER_HOUR = 9; // Erinnerungen feuern um 09:00 Uhr lokal

/** Datum -> TT.MM.JJJJ. */
function formatDateDe(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  return `${d}.${m}.${y}`;
}

/** Berechtigung erst beim Aktivieren des Schalters abfragen. Auf Web immer false. */
export async function requestReminderPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const Notifications = await import('expo-notifications');
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/**
 * Plant je Abo eine lokale Benachrichtigung X Tage vor nextCharge. Räumt
 * vorher alle bisher geplanten Erinnerungen auf, damit Änderungen an der
 * Abo-Liste die Planungen aktuell halten. Auf Web ein stilles No-Op.
 * Gibt die Anzahl der tatsächlich geplanten Erinnerungen zurück.
 */
export async function scheduleRemindersForSubs(
  subs: Subscription[],
  daysBefore: number,
): Promise<number> {
  if (Platform.OS === 'web') return 0;

  const Notifications = await import('expo-notifications');
  // ponytail: löscht ALLE geplanten Benachrichtigungen der App, nicht nur
  // Abo-Erinnerungen. Kündigo hat aktuell keine anderen lokalen Notifications;
  // kommen welche dazu, hier auf ein eigenes Tag-Präfix umstellen und nur
  // die eigenen IDs canceln statt cancelAllScheduledNotificationsAsync.
  await Notifications.cancelAllScheduledNotificationsAsync();

  const plans = computeReminderPlans(subs, daysBefore);

  for (const plan of plans) {
    const fireAt = new Date(`${plan.fireDate}T00:00:00`);
    fireAt.setHours(REMINDER_HOUR, 0, 0, 0);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `${plan.subName} wird bald abgebucht`,
        body: `${plan.amount.toFixed(2)} € am ${formatDateDe(plan.nextCharge)}. Jetzt prüfen, ob das Abo noch gebraucht wird.`,
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireAt },
    });
  }

  console.log(`[reminders] ${plans.length} Erinnerung(en) geplant`);
  return plans.length;
}

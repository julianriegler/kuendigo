/**
 * Lokale Erinnerungen vor der nächsten Abbuchung.
 *
 * Auf Web tut alles hier still nichts (Platform.OS-Weiche): expo-notifications
 * wird nie statisch importiert, sondern erst zur Laufzeit auf Native geladen,
 * damit der Web-Build nicht daran crasht. Die reine Terminberechnung steckt
 * in reminderPlan.ts (ohne react-native-Import), damit sie ohne Expo testbar ist.
 */
import { Platform } from 'react-native';
import { computeReminderPlans, DEFAULT_REMINDER_HOUR } from './reminderPlan';
import type { Subscription } from './analyzeSubscriptions';

export { computeReminderPlans, DEFAULT_REMINDER_HOUR } from './reminderPlan';
export type { ReminderPlan } from './reminderPlan';

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
 *
 * Wirft nie: entzogene Berechtigung oder ein sonstiger Expo-Fehler landet nur
 * im Log, nicht als Rejection bei den Aufrufern (persist() in resultStore.ts
 * und alle Screens, die darüber Abos speichern). Gibt die Anzahl der
 * tatsächlich geplanten Erinnerungen zurück.
 */
export async function scheduleRemindersForSubs(
  subs: Subscription[],
  daysBefore: number,
): Promise<number> {
  if (Platform.OS === 'web') return 0;

  let scheduled = 0;
  try {
    const Notifications = await import('expo-notifications');

    // Ohne das hier erscheinen geplante Erinnerungen nicht, wenn die App im
    // Vordergrund ist (Expo-Default unterdrückt sie sonst stillschweigend).
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true, shouldShowList: true,
        shouldPlaySound: true, shouldSetBadge: false,
      }),
    });

    // ponytail: löscht ALLE geplanten Benachrichtigungen der App, nicht nur
    // Abo-Erinnerungen. Kündigo hat aktuell keine anderen lokalen Notifications;
    // kommen welche dazu, hier auf ein eigenes Tag-Präfix umstellen und nur
    // die eigenen IDs canceln statt cancelAllScheduledNotificationsAsync.
    await Notifications.cancelAllScheduledNotificationsAsync();

    const plans = computeReminderPlans(subs, daysBefore, new Date(), DEFAULT_REMINDER_HOUR);

    for (const plan of plans) {
      const fireAt = new Date(plan.fireAt);
      // Netz gegen die Uhrzeit-Lücke in computeReminderPlans (Systemuhr,
      // Rundungsfehler): nie einen Trigger in der Vergangenheit einreichen,
      // sonst lehnt iOS mit ERR_NOTIFICATIONS_FAILED_TO_SCHEDULE ab und bricht
      // die ganze Schleife ab.
      if (fireAt.getTime() <= Date.now()) continue;

      await Notifications.scheduleNotificationAsync({
        content: {
          title: `${plan.subName} wird bald abgebucht`,
          body: `${plan.amount.toFixed(2)} € am ${formatDateDe(plan.nextCharge)}. Jetzt prüfen, ob das Abo noch gebraucht wird.`,
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireAt },
      });
      scheduled++;
    }
  } catch (err) {
    console.log('[reminders] Planung fehlgeschlagen:', err);
  }

  console.log(`[reminders] ${scheduled} Erinnerung(en) geplant`);
  return scheduled;
}

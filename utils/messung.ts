/**
 * Anonyme Zähler für die Messkette (Aufrufe → Klicks → Nutzung → Aktionen).
 * Ein Aufruf je App-Start, dazu je wichtiger Aktion ihr Name. Gespeichert wird
 * beim Empfänger nur App-Name, Tag und Zähler: keine IP, kein Cookie, keine
 * Kennung. Im Entwicklungsmodus passiert nichts, sonst zählt jeder Reload.
 */
const BASIS = 'https://klickmill.app';
export const APP_SLUG = 'kuendigo';

export function zaehle(aktion?: string): void {
  if (__DEV__) return;
  const url = `${BASIS}/api/ping?app=${APP_SLUG}${aktion ? `&ev=${encodeURIComponent(aktion)}` : ''}`;
  fetch(url).catch(() => {});
}

export type FeedbackErgebnis = 'gesendet' | 'zu_kurz' | 'fehler' | 'dev';

/** Schickt Feedback an den Empfänger; im Entwicklungsmodus nur vorgetäuscht. */
export async function sendeFeedback(text: string, kontakt: string): Promise<FeedbackErgebnis> {
  const sauber = text.trim();
  if (sauber.length < 3) return 'zu_kurz';
  if (__DEV__) return 'dev';
  try {
    const antwort = await fetch(`${BASIS}/api/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app: APP_SLUG, text: sauber.slice(0, 1000), kontakt: kontakt.trim().slice(0, 200) }),
    });
    return antwort.ok ? 'gesendet' : 'fehler';
  } catch {
    return 'fehler';
  }
}

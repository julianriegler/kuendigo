import { analyzeEndpoint } from './apiConfig';
import { loadDeviceToken } from './storage';
import { rememberQuotaFromResponse } from './quota';

export interface Subscription {
  id: string;
  name: string;
  amount: number;       // monthly EUR
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'annual';
  category: string;
  lastCharged: string;  // YYYY-MM-DD
  nextCharge: string;
  cancelled?: boolean;  // vom Nutzer als gekündigt markiert (persistiert)
  cancelledAt?: string; // YYYY-MM-DD, wann markiert wurde
  demo?: boolean;       // Beispieldaten aus dem Onboarding, keine echte Analyse
}

// ─── Prompts ────────────────────────────────────────────────────────────────

const BASE_INSTRUCTION = `Für jedes Abo gib an:
- name: Klarer Servicename (z.B. "Netflix" statt "NETFLIX INTL BV")
- amount: Monatlicher Betrag in EUR (bei jährlichen Abos durch 12 teilen)
- frequency: "weekly", "monthly", "quarterly" oder "annual"
- category: "streaming", "music", "software", "fitness", "news", "food", "cloud", "gaming" oder "other"
- lastCharged: Datum der letzten Abbuchung (YYYY-MM-DD, falls erkennbar, sonst heutiges Datum)
- nextCharge: Geschätztes Datum der nächsten Abbuchung (YYYY-MM-DD)

Antworte NUR mit einem validen JSON-Array, keine Erklärungen:
[{"name":"Netflix","amount":13.99,"frequency":"monthly","category":"streaming","lastCharged":"2026-07-15","nextCharge":"2026-08-15"}]`;

const STATEMENT_PROMPT = `Du bist ein Finanzassistent der wiederkehrende Abo-Zahlungen aus Kontoauszügen erkennt.
Analysiere die folgenden Kontotransaktionen und identifiziere alle wiederkehrenden Abonnements.
${BASE_INSTRUCTION}

Kontoauszug:
`;

const SCREENSHOT_PROMPT = `Du bist ein Finanzassistent. Analysiere diesen Screenshot einer Banking-App oder eines Kontoauszugs.
Identifiziere alle wiederkehrenden Abo-Zahlungen die du in den Transaktionen siehst.
${BASE_INSTRUCTION}`;

const EMAIL_PROMPT = `Du bist ein Finanzassistent der Abo-Zahlungen aus E-Mails erkennt.
Analysiere die folgenden E-Mail-Inhalte und identifiziere alle Abonnements und wiederkehrenden Zahlungen.
Achte auf: Rechnungen, Quittungen, Bestätigungen, "Vielen Dank für dein Abo", "Your subscription", etc.
${BASE_INSTRUCTION}

E-Mail-Inhalte:
`;

const AUTOFILL_PROMPT = `Du bist ein Assistent der Abo-Details automatisch ergänzt.
Der Nutzer hat folgenden Dienst eingegeben: "{NAME}"

Ergänze die typischen Details für diesen Dienst.
Falls du den Dienst nicht kennst, schätze vernünftige Werte.
${BASE_INSTRUCTION}`;

// ─── Core API call ───────────────────────────────────────────────────────────

/**
 * Ruft Claude auf. Standardweg ist der eigene Proxy /api/analyze: er nutzt den
 * Serverschlüssel samt Freikontingent und umgeht die CORS-Sperre des Browsers.
 * Ein eigener Key wird als x-anthropic-key mitgeschickt und läuft am
 * Kontingent vorbei. Nur wenn die Proxy-Adresse unbekannt ist (Native ohne
 * EXPO_PUBLIC_API_BASE_URL), geht der Aufruf direkt an Anthropic.
 */
async function callClaude(
  apiKey: string,
  messages: object[]
): Promise<string> {
  const body = JSON.stringify({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages,
  });

  const endpoint = analyzeEndpoint();
  let response: Response;

  if (endpoint) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-device-token': await loadDeviceToken(),
    };
    if (apiKey) headers['x-anthropic-key'] = apiKey;
    response = await fetch(endpoint, { method: 'POST', headers, body });
    rememberQuotaFromResponse(response);
  } else if (apiKey) {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body,
    });
  } else {
    throw new Error(
      'Die Analyse ist auf diesem Gerät nicht eingerichtet. Trage in den Einstellungen ' +
      'deinen eigenen Anthropic API Key ein.',
    );
  }

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    const msg = (errBody as any)?.error?.message ?? `HTTP ${response.status}`;
    throw new Error(msg);
  }
  const data = await response.json();
  return data.content[0]?.text ?? '[]';
}

function parseSubscriptions(text: string): Subscription[] {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];
  const raw: Omit<Subscription, 'id'>[] = JSON.parse(match[0]);
  return raw.map((s, i) => ({ ...s, id: String(i + 1) }));
}

// ─── Public API ──────────────────────────────────────────────────────────────

/** Option 1: Kontoauszug als Text (CSV / PDF-Text) */
export async function analyzeStatement(
  text: string,
  apiKey: string
): Promise<Subscription[]> {
  const result = await callClaude(apiKey, [
    { role: 'user', content: STATEMENT_PROMPT + text },
  ]);
  return parseSubscriptions(result);
}

/** Option A: Screenshot der Banking-App */
export async function analyzeScreenshot(
  base64: string,
  mimeType: string,
  apiKey: string
): Promise<Subscription[]> {
  const result = await callClaude(apiKey, [
    {
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: mimeType, data: base64 },
        },
        { type: 'text', text: SCREENSHOT_PROMPT },
      ],
    },
  ]);
  return parseSubscriptions(result);
}

/** Option B: E-Mail-Text einfügen */
export async function analyzeEmails(
  emailText: string,
  apiKey: string
): Promise<Subscription[]> {
  const result = await callClaude(apiKey, [
    { role: 'user', content: EMAIL_PROMPT + emailText },
  ]);
  return parseSubscriptions(result);
}

/** Option C: KI-Autofill für manuell eingetippten Dienst */
export async function autofillSubscription(
  name: string,
  apiKey: string
): Promise<Subscription | null> {
  const prompt = AUTOFILL_PROMPT.replace('{NAME}', name);
  const result = await callClaude(apiKey, [
    { role: 'user', content: prompt },
  ]);
  const subs = parseSubscriptions(result);
  return subs[0] ? { ...subs[0], name } : null;
}

// ─── Cancellation URLs ───────────────────────────────────────────────────────

/**
 * Direct cancellation URLs for popular subscription services.
 * Matched case-insensitively against subscription names.
 */
export const CANCELLATION_URLS: Record<string, string> = {
  'netflix':           'https://www.netflix.com/cancel',
  'spotify':           'https://www.spotify.com/de/account/subscription/cancel',
  'amazon prime':      'https://www.amazon.de/mc/pipelines/cancellation',
  'amazon':            'https://www.amazon.de/mc/pipelines/cancellation',
  'disney+':           'https://www.disneyplus.com/account/subscription',
  'disney plus':       'https://www.disneyplus.com/account/subscription',
  'apple tv+':         'https://tv.apple.com/settings',
  'apple tv':          'https://tv.apple.com/settings',
  'youtube premium':   'https://www.youtube.com/paid_memberships',
  'youtube':           'https://www.youtube.com/paid_memberships',
  'apple icloud':      'https://appleid.apple.com/account/manage',
  'icloud':            'https://appleid.apple.com/account/manage',
  'google one':        'https://one.google.com/storage/dashboard',
  'dropbox':           'https://www.dropbox.com/account/plan',
  'adobe':             'https://account.adobe.com/plans',
  'adobe creative':    'https://account.adobe.com/plans',
  'microsoft 365':     'https://account.microsoft.com/services',
  'microsoft':         'https://account.microsoft.com/services',
  'office 365':        'https://account.microsoft.com/services',
  'linkedin':          'https://www.linkedin.com/premium/manage-subscription',
  'linkedin premium':  'https://www.linkedin.com/premium/manage-subscription',
  'chatgpt':           'https://chat.openai.com/#settings/Subscription',
  'chatgpt plus':      'https://chat.openai.com/#settings/Subscription',
  'openai':            'https://chat.openai.com/#settings/Subscription',
  'xbox':              'https://account.microsoft.com/services',
  'xbox game pass':    'https://account.microsoft.com/services',
  'playstation':       'https://www.playstation.com/de-at/my-playstation/account-management/',
  'playstation plus':  'https://www.playstation.com/de-at/my-playstation/account-management/',
  'ps plus':           'https://www.playstation.com/de-at/my-playstation/account-management/',
  'headspace':         'https://www.headspace.com/account',
  'calm':              'https://account.calm.com/settings',
  'freeletics':        'https://www.freeletics.com/de/account/',
  'spiegel':           'https://www.spiegel.de/meinabo/',
  'spiegel+':          'https://www.spiegel.de/meinabo/',
  'bild+':             'https://mein.bild.de/abo/',
  'bild':              'https://mein.bild.de/abo/',
  'paypal':            'https://www.paypal.com/myaccount/autopay',
  'dazn':              'https://www.dazn.com/de-AT/account/subscription',
  'sky':               'https://sky.at/kundenportal',
  'magenta':           'https://www.magenta.at/mein-magenta',
  'a1':                'https://www.a1.net/mein-a1',
  'drei':              'https://www.drei.at/mein-drei',
  'duolingo':          'https://www.duolingo.com/settings/subscription',
  'audible':           'https://www.audible.de/account/cancelMembership',
  'kindle':            'https://www.amazon.de/mc/pipelines/cancellation',
  'apple arcade':      'https://appleid.apple.com/account/manage',
  'apple music':       'https://music.apple.com/account',
  'apple fitness':     'https://appleid.apple.com/account/manage',
  'apple news':        'https://appleid.apple.com/account/manage',
  'apple one':         'https://appleid.apple.com/account/manage',
  'tidal':             'https://account.tidal.com/subscription',
  'deezer':            'https://www.deezer.com/de/offers',
  'hbo':               'https://www.max.com/account/subscription',
  'max':               'https://www.max.com/account/subscription',
  'paramount':         'https://www.paramountplus.com/account/billing/',
  'paramount+':        'https://www.paramountplus.com/account/billing/',
  'peloton':           'https://members.onepeloton.de/account',
  'fitbit':            'https://www.fitbit.com/settings/account',
  'strava':            'https://www.strava.com/settings/subscription',
  'notion':            'https://www.notion.so/profile/billing',
  'evernote':          'https://www.evernote.com/Subscription.action',
  'canva':             'https://www.canva.com/settings/billing',
  'figma':             'https://www.figma.com/settings',
  'slack':             'https://slack.com/intl/de-de/services/account/billing',
  'zoom':              'https://zoom.us/billing',
  'grammarly':         'https://account.grammarly.com/subscription',
  'lastpass':          'https://lastpass.com/de/subscriptions/',
  '1password':         'https://my.1password.com/billing',
  'nordvpn':           'https://my.nordaccount.com/dashboard/nordvpn/',
  'expressvpn':        'https://www.expressvpn.com/de/subscriptions',
  'surfshark':         'https://my.surfshark.com/account',
};

/**
 * Returns the direct cancellation URL for a given subscription name.
 * Matches case-insensitively and tries partial matches.
 */
export function getCancellationUrl(name: string): string | null {
  const lower = name.toLowerCase().trim();
  // exact match first
  if (CANCELLATION_URLS[lower]) return CANCELLATION_URLS[lower];
  // partial match
  for (const [key, url] of Object.entries(CANCELLATION_URLS)) {
    if (lower.includes(key) || key.includes(lower)) return url;
  }
  return null;
}

/**
 * Returns how many days until the next charge.
 * Negative = already overdue.
 */
export function daysUntilCharge(nextCharge: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const next = new Date(nextCharge);
  return Math.round((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

// Die Umrechnung liegt in subscriptionMath, damit sie ohne Expo testbar bleibt.
export { monthlyAmount, annualAmount, cancelledSavings } from './subscriptionMath';
export type { Savings } from './subscriptionMath';

// ─── Demo data ───────────────────────────────────────────────────────────────

// Realistisch deutsche Auswahl fürs Sofort-Beispiel im Onboarding: bekannte
// Streaming-/Musik-Dienste plus die typischen "vergessenen" Abo-Arten
// (Fitnessstudio, Cloud-Speicher, ein Zeitungsabo, das schon lange nicht
// mehr genutzt wird). `demo` wird hier bewusst NICHT gesetzt: dieselbe Liste
// dient auch der bestehenden Vorschau in results.tsx, die beim ersten Eingriff
// des Nutzers zu echten Daten wird (siehe dortiger Hinweistext). Das Onboarding
// markiert seine eigene Kopie explizit mit demo: true (app/onboarding.tsx).
export const DEMO_SUBSCRIPTIONS: Subscription[] = [
  { id: '1', name: 'Netflix',           amount: 13.99, frequency: 'monthly', category: 'streaming', lastCharged: '2026-07-15', nextCharge: '2026-08-15' },
  { id: '2', name: 'Spotify',           amount: 9.99,  frequency: 'monthly', category: 'music',     lastCharged: '2026-07-20', nextCharge: '2026-08-20' },
  { id: '3', name: 'FitX Fitnessstudio',amount: 24.90, frequency: 'monthly', category: 'fitness',   lastCharged: '2026-07-03', nextCharge: '2026-08-03' },
  { id: '4', name: 'Google One Cloud-Speicher', amount: 2.99, frequency: 'monthly', category: 'cloud', lastCharged: '2026-07-27', nextCharge: '2026-08-27' },
  { id: '5', name: 'Tageszeitung Digital (vergessen)', amount: 19.99, frequency: 'monthly', category: 'news', lastCharged: '2026-02-11', nextCharge: '2026-08-11' },
];

export const POPULAR_SERVICES = [
  { name: 'Netflix',          category: 'streaming', emoji: '🎬' },
  { name: 'Spotify',          category: 'music',     emoji: '🎵' },
  { name: 'Amazon Prime',     category: 'streaming', emoji: '📦' },
  { name: 'Disney+',          category: 'streaming', emoji: '🏰' },
  { name: 'Apple TV+',        category: 'streaming', emoji: '🍎' },
  { name: 'YouTube Premium',  category: 'streaming', emoji: '▶️' },
  { name: 'Apple iCloud',     category: 'cloud',     emoji: '☁️' },
  { name: 'Google One',       category: 'cloud',     emoji: '🔵' },
  { name: 'Dropbox',          category: 'cloud',     emoji: '📂' },
  { name: 'Adobe Creative',   category: 'software',  emoji: '🎨' },
  { name: 'Microsoft 365',    category: 'software',  emoji: '💼' },
  { name: 'LinkedIn Premium', category: 'software',  emoji: '💼' },
  { name: 'ChatGPT Plus',     category: 'software',  emoji: '🤖' },
  { name: 'Xbox Game Pass',   category: 'gaming',    emoji: '🎮' },
  { name: 'PlayStation Plus', category: 'gaming',    emoji: '🕹️' },
  { name: 'Headspace',        category: 'fitness',   emoji: '🧘' },
  { name: 'Calm',             category: 'fitness',   emoji: '😌' },
  { name: 'Freeletics',       category: 'fitness',   emoji: '💪' },
  { name: 'Spiegel+',         category: 'news',      emoji: '📰' },
  { name: 'Bild+',            category: 'news',      emoji: '📰' },
];

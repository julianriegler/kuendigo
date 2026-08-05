export interface Subscription {
  id: string;
  name: string;
  amount: number;       // monthly EUR
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'annual';
  category: string;
  lastCharged: string;  // YYYY-MM-DD
  nextCharge: string;
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

async function callClaude(
  apiKey: string,
  messages: object[]
): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages,
    }),
  });

  if (!response.ok) throw new Error(`API Fehler: ${response.status}`);
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

// ─── Demo data ───────────────────────────────────────────────────────────────

export const DEMO_SUBSCRIPTIONS: Subscription[] = [
  { id: '1', name: 'Netflix',         amount: 13.99, frequency: 'monthly',   category: 'streaming', lastCharged: '2026-07-15', nextCharge: '2026-08-15' },
  { id: '2', name: 'Spotify',         amount: 9.99,  frequency: 'monthly',   category: 'music',     lastCharged: '2026-07-20', nextCharge: '2026-08-20' },
  { id: '3', name: 'Adobe Creative',  amount: 54.99, frequency: 'monthly',   category: 'software',  lastCharged: '2026-07-01', nextCharge: '2026-08-01' },
  { id: '4', name: 'Apple iCloud',    amount: 0.99,  frequency: 'monthly',   category: 'cloud',     lastCharged: '2026-07-25', nextCharge: '2026-08-25' },
  { id: '5', name: 'Amazon Prime',    amount: 8.99,  frequency: 'monthly',   category: 'streaming', lastCharged: '2026-07-10', nextCharge: '2026-08-10' },
  { id: '6', name: 'Xbox Game Pass',  amount: 14.99, frequency: 'monthly',   category: 'gaming',    lastCharged: '2026-07-05', nextCharge: '2026-08-05' },
  { id: '7', name: 'LinkedIn Premium',amount: 39.99, frequency: 'monthly',   category: 'software',  lastCharged: '2026-07-18', nextCharge: '2026-08-18' },
  { id: '8', name: 'Headspace',       amount: 12.99, frequency: 'monthly',   category: 'fitness',   lastCharged: '2026-07-22', nextCharge: '2026-08-22' },
  { id: '9', name: 'NY Times',        amount: 1.67,  frequency: 'monthly',   category: 'news',      lastCharged: '2026-07-12', nextCharge: '2026-08-12' },
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

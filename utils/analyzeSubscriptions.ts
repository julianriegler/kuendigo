export interface Subscription {
  id: string;
  name: string;
  amount: number;       // monthly EUR
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'annual';
  category: string;
  lastCharged: string;  // YYYY-MM-DD
  nextCharge: string;
}

const PROMPT = `Du bist ein Finanzassistent der wiederkehrende Abo-Zahlungen aus Kontoauszügen erkennt.

Analysiere die folgenden Kontotransaktionen und identifiziere alle wiederkehrenden Abonnements.

Für jedes Abo gib an:
- name: Name des Dienstes/Unternehmens (klar und erkennbar, z.B. "Netflix" nicht "NETFLIX INTL BV")
- amount: Monatlicher Betrag in EUR (bei jährlichen Abos durch 12 teilen)
- frequency: "weekly", "monthly", "quarterly" oder "annual"
- category: "streaming", "music", "software", "fitness", "news", "food", "cloud", "gaming" oder "other"
- lastCharged: Datum der letzten Abbuchung (YYYY-MM-DD Format)
- nextCharge: Geschätztes Datum der nächsten Abbuchung (YYYY-MM-DD Format)

Antworte NUR mit einem validen JSON-Array, ohne Erklärungen:
[{"name":"Netflix","amount":13.99,"frequency":"monthly","category":"streaming","lastCharged":"2026-07-15","nextCharge":"2026-08-15"}]

Kontoauszug:
`;

export async function analyzeSubscriptions(
  text: string,
  apiKey: string
): Promise<Subscription[]> {
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
      messages: [
        {
          role: 'user',
          content: PROMPT + text,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`API Fehler: ${response.status}`);
  }

  const data = await response.json();
  const content = data.content[0]?.text ?? '[]';

  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  const raw: Omit<Subscription, 'id'>[] = JSON.parse(jsonMatch[0]);
  return raw.map((s, i) => ({ ...s, id: String(i + 1) }));
}

// Demo-Daten für Screenshots/Marketing (ohne echte API)
export const DEMO_SUBSCRIPTIONS: Subscription[] = [
  { id: '1', name: 'Netflix',        amount: 13.99, frequency: 'monthly',   category: 'streaming', lastCharged: '2026-07-15', nextCharge: '2026-08-15' },
  { id: '2', name: 'Spotify',        amount: 9.99,  frequency: 'monthly',   category: 'music',     lastCharged: '2026-07-20', nextCharge: '2026-08-20' },
  { id: '3', name: 'Adobe Creative', amount: 54.99, frequency: 'monthly',   category: 'software',  lastCharged: '2026-07-01', nextCharge: '2026-08-01' },
  { id: '4', name: 'Apple iCloud',   amount: 0.99,  frequency: 'monthly',   category: 'cloud',     lastCharged: '2026-07-25', nextCharge: '2026-08-25' },
  { id: '5', name: 'Amazon Prime',   amount: 8.99,  frequency: 'monthly',   category: 'streaming', lastCharged: '2026-07-10', nextCharge: '2026-08-10' },
  { id: '6', name: 'Xbox Game Pass', amount: 14.99, frequency: 'monthly',   category: 'gaming',    lastCharged: '2026-07-05', nextCharge: '2026-08-05' },
  { id: '7', name: 'LinkedIn Premium',amount: 39.99,frequency: 'monthly',   category: 'software',  lastCharged: '2026-07-18', nextCharge: '2026-08-18' },
  { id: '8', name: 'Headspace',      amount: 12.99, frequency: 'monthly',   category: 'fitness',   lastCharged: '2026-07-22', nextCharge: '2026-08-22' },
  { id: '9', name: 'NY Times',       amount: 1.67,  frequency: 'monthly',   category: 'news',      lastCharged: '2026-07-12', nextCharge: '2026-08-12' },
];

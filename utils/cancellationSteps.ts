/**
 * Step-by-step cancellation guides for popular subscription services.
 * Matched case-insensitively against subscription names.
 */

export interface CancellationGuide {
  steps: string[];
  url: string;
  isAppStore?: boolean;   // Can be cancelled directly via iOS Settings
  isPlayStore?: boolean;  // Can be cancelled directly via Google Play
  tip?: string;
}

const GUIDES: Record<string, CancellationGuide> = {
  netflix: {
    url: 'https://www.netflix.com/cancel',
    steps: [
      'Auf netflix.com anmelden',
      'Oben rechts auf dein Profilbild tippen',
      'Konto auswählen',
      '„Mitgliedschaft kündigen" antippen',
      'Kündigung bestätigen',
    ],
    tip: 'Du kannst Netflix bis zum letzten bezahlten Tag nutzen.',
  },
  spotify: {
    url: 'https://www.spotify.com/de/account/subscription/cancel',
    steps: [
      'Auf spotify.com/account anmelden',
      'Links auf „Abo" klicken',
      '„Spotify Premium kündigen" wählen',
      'Kündigung bestätigen',
    ],
    tip: 'Premium bleibt bis Ende des Abrechnungszeitraums aktiv.',
  },
  'amazon prime': {
    url: 'https://www.amazon.de/mc/pipelines/cancellation',
    steps: [
      'Auf amazon.de anmelden',
      'Konto & Listen → Prime-Mitgliedschaft',
      '„Prime kündigen" antippen',
      'Kündigung bestätigen',
    ],
    tip: 'Bei jährlichem Abo gibt es eine anteilige Rückerstattung.',
  },
  'disney+': {
    url: 'https://www.disneyplus.com/account/subscription',
    steps: [
      'Auf disneyplus.com anmelden',
      'Profilbild → Konto',
      'Abo → „Abo kündigen" wählen',
      'Kündigung bestätigen',
    ],
  },
  'apple tv+': {
    url: 'https://appleid.apple.com/account/manage',
    isAppStore: true,
    steps: [
      'iPhone Einstellungen öffnen',
      'Oben auf deinen Namen tippen',
      '„Abonnements" auswählen',
      'Apple TV+ antippen',
      '„Abonnement kündigen" wählen',
    ],
  },
  'youtube premium': {
    url: 'https://www.youtube.com/paid_memberships',
    steps: [
      'YouTube.com öffnen und anmelden',
      'Profilbild → Bezahlte Mitgliedschaften',
      'YouTube Premium → Kündigen',
      'Kündigung bestätigen',
    ],
  },
  'apple icloud': {
    url: 'https://appleid.apple.com/account/manage',
    isAppStore: true,
    steps: [
      'iPhone Einstellungen öffnen',
      'Oben auf deinen Namen tippen',
      'iCloud → iCloud+ Abo verwalten',
      'Auf das Abo tippen → Kündigen',
    ],
    tip: 'Daten bleiben erhalten, du wirst auf 5 GB Gratis zurückgestuft.',
  },
  'apple one': {
    url: 'https://appleid.apple.com/account/manage',
    isAppStore: true,
    steps: [
      'iPhone Einstellungen öffnen',
      'Oben auf deinen Namen tippen',
      '„Abonnements" auswählen',
      'Apple One antippen → Kündigen',
    ],
  },
  'apple music': {
    url: 'https://music.apple.com/account',
    isAppStore: true,
    steps: [
      'iPhone Einstellungen öffnen',
      'Oben auf deinen Namen tippen',
      '„Abonnements" → Apple Music',
      '„Abonnement kündigen" wählen',
    ],
  },
  'google one': {
    url: 'https://one.google.com/storage/dashboard',
    steps: [
      'one.google.com öffnen und anmelden',
      'Links auf „Einstellungen" tippen',
      'Google One kündigen auswählen',
      'Kündigung bestätigen',
    ],
  },
  dropbox: {
    url: 'https://www.dropbox.com/account/plan',
    steps: [
      'dropbox.com anmelden',
      'Konto → Abonnements',
      'Plan ändern → Kostenlos downgraden',
      'Bestätigen',
    ],
    tip: 'Downgrade auf Gratisplan = Kündigung des bezahlten Plans.',
  },
  adobe: {
    url: 'https://account.adobe.com/plans',
    steps: [
      'account.adobe.com öffnen und anmelden',
      'Pläne & Produkte auswählen',
      'Plan verwalten → Kündigen',
      'Kündigungsgebühr prüfen und bestätigen',
    ],
    tip: '⚠️ Adobe berechnet bei Jahreszahlung oft eine Gebühr. Erst nach 12 Monaten ist die Kündigung kostenlos.',
  },
  'microsoft 365': {
    url: 'https://account.microsoft.com/services',
    steps: [
      'account.microsoft.com öffnen und anmelden',
      'Dienste & Abonnements',
      'Microsoft 365 → Kündigen',
      'Kündigung bestätigen',
    ],
  },
  'office 365': {
    url: 'https://account.microsoft.com/services',
    steps: [
      'account.microsoft.com öffnen und anmelden',
      'Dienste & Abonnements',
      'Office 365 → Kündigen',
      'Kündigung bestätigen',
    ],
  },
  linkedin: {
    url: 'https://www.linkedin.com/premium/manage-subscription',
    steps: [
      'LinkedIn.com öffnen und anmelden',
      'Ich → Premium-Features verwalten',
      '„Abo kündigen" wählen',
      'Grund angeben und bestätigen',
    ],
    tip: 'Premium-Features bleiben bis Ende des Abrechnungsmonats aktiv.',
  },
  chatgpt: {
    url: 'https://chat.openai.com/#settings/Subscription',
    steps: [
      'chat.openai.com öffnen und anmelden',
      'Links unten auf dein Profilbild tippen',
      'Mein Abo → Abo kündigen',
      'Kündigung bestätigen',
    ],
  },
  'xbox game pass': {
    url: 'https://account.microsoft.com/services',
    steps: [
      'account.microsoft.com öffnen und anmelden',
      'Dienste & Abonnements',
      'Game Pass → Kündigen',
      'Kündigung bestätigen',
    ],
  },
  'playstation plus': {
    url: 'https://www.playstation.com/de-at/my-playstation/account-management/',
    steps: [
      'playstation.com anmelden',
      'Mein PSN → Abonnements',
      'PlayStation Plus → Automatische Verlängerung deaktivieren',
      'Bestätigen',
    ],
    tip: 'PlayStation Plus läuft bis Ende des bezahlten Zeitraums weiter.',
  },
  headspace: {
    url: 'https://www.headspace.com/account',
    isAppStore: true,
    steps: [
      'iPhone Einstellungen öffnen',
      'Oben auf deinen Namen tippen',
      '„Abonnements" → Headspace',
      '„Abonnement kündigen" wählen',
    ],
  },
  calm: {
    url: 'https://account.calm.com/settings',
    isAppStore: true,
    steps: [
      'iPhone Einstellungen öffnen',
      'Oben auf deinen Namen tippen',
      '„Abonnements" → Calm',
      '„Abonnement kündigen" wählen',
    ],
  },
  freeletics: {
    url: 'https://www.freeletics.com/de/account/',
    isAppStore: true,
    steps: [
      'iPhone Einstellungen öffnen',
      'Oben auf deinen Namen tippen',
      '„Abonnements" → Freeletics',
      '„Abonnement kündigen" wählen',
    ],
  },
  dazn: {
    url: 'https://www.dazn.com/de-AT/account/subscription',
    steps: [
      'DAZN.com öffnen und anmelden',
      'Mein Konto → Abonnement',
      '„Kündigen" antippen',
      'Kündigung bestätigen',
    ],
  },
  audible: {
    url: 'https://www.audible.de/account/cancelMembership',
    steps: [
      'audible.de öffnen und anmelden',
      'Mein Konto → Mitgliedschaft',
      '„Mitgliedschaft kündigen" wählen',
      'Kündigung bestätigen',
    ],
  },
  duolingo: {
    url: 'https://www.duolingo.com/settings/subscription',
    isAppStore: true,
    steps: [
      'iPhone Einstellungen öffnen',
      'Oben auf deinen Namen tippen',
      '„Abonnements" → Duolingo Plus',
      '„Abonnement kündigen" wählen',
    ],
  },
  tidal: {
    url: 'https://account.tidal.com/subscription',
    steps: [
      'listen.tidal.com öffnen und anmelden',
      'Mein Konto → Abonnement',
      '„Kündigen" antippen',
      'Kündigung bestätigen',
    ],
  },
  notion: {
    url: 'https://www.notion.so/profile/billing',
    steps: [
      'notion.so öffnen und anmelden',
      'Einstellungen → Abrechnung',
      '„Abo kündigen" wählen',
      'Kündigung bestätigen',
    ],
  },
  canva: {
    url: 'https://www.canva.com/settings/billing',
    steps: [
      'canva.com öffnen und anmelden',
      'Konto → Abrechnung & Pläne',
      '„Abo kündigen" wählen',
      'Kündigung bestätigen',
    ],
  },
  nordvpn: {
    url: 'https://my.nordaccount.com/dashboard/nordvpn/',
    steps: [
      'my.nordaccount.com öffnen und anmelden',
      'Abonnements',
      '„Automatische Verlängerung deaktivieren"',
      'Bestätigen',
    ],
  },
  '1password': {
    url: 'https://my.1password.com/billing',
    steps: [
      'my.1password.com öffnen und anmelden',
      'Abrechnung',
      '„Abo kündigen" wählen',
      'Kündigung bestätigen',
    ],
  },
};

/** Returns the cancellation guide for a given service name, or null if unknown. */
export function getCancellationGuide(name: string): CancellationGuide | null {
  const lower = name.toLowerCase().trim();
  // Exact match first
  if (GUIDES[lower]) return GUIDES[lower];
  // Partial match
  for (const [key, guide] of Object.entries(GUIDES)) {
    if (lower.includes(key) || key.includes(lower)) return guide;
  }
  return null;
}

/**
 * Einwilligung in die Übertragung der hochgeladenen Inhalte an Anthropic.
 *
 * Gespeichert wird unter kuendigo_consent_v1 der Zeitpunkt, die Textversion
 * und der Wortlaut, dem zugestimmt wurde. Damit lässt sich später belegen,
 * wozu genau eingewilligt wurde (Nachweispflicht nach Art. 7 Abs. 1 DSGVO).
 */
import { readValue, writeValue, deleteValue } from './kvStorage';

export const CONSENT_STORAGE_KEY = 'kuendigo_consent_v1';

/** Bei inhaltlichen Änderungen am Text hochzählen, dann wird neu gefragt. */
export const CONSENT_VERSION = '2026-08-17';

export const CONSENT_TITLE = 'Analyse durch Anthropic';

/** Der Wortlaut, dem zugestimmt wird. Wird mitgespeichert. */
export const CONSENT_POINTS = [
  'Der Inhalt deiner Datei, deines Screenshots, deines eingefügten Textes oder der Name eines Dienstes beim automatischen Ergänzen wird zur Auswertung an Anthropic PBC in die USA übertragen.',
  'Kündigo speichert diese Inhalte nicht. Die erkannten Abos bleiben auf deinem Gerät.',
  'In den USA gilt kein gleichwertiges Datenschutzniveau, Behörden können unter bestimmten Voraussetzungen zugreifen.',
  'Deine Zustimmung ist freiwillig und jederzeit widerrufbar. Ohne sie kannst du deine Abos manuell eintragen.',
];

export const CONSENT_CHECKBOX_LABEL =
  'Ich stimme der Übertragung meiner hochgeladenen Inhalte an Anthropic in die USA zu.';

/** Vollständiger Wortlaut, wie er im Modal steht. */
export function consentText(): string {
  return [CONSENT_TITLE, ...CONSENT_POINTS, CONSENT_CHECKBOX_LABEL].join('\n');
}

export interface Consent {
  /** Zeitpunkt der Zustimmung als ISO-String mit Uhrzeit. */
  grantedAt: string;
  /** Version des Einwilligungstextes. */
  version: string;
  /** Wortlaut, dem zugestimmt wurde. */
  text: string;
}

let cached: Consent | null = null;
let loaded = false;

function parse(raw: string | null): Consent | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    if (typeof data?.grantedAt !== 'string' || typeof data?.version !== 'string') return null;
    return {
      grantedAt: data.grantedAt,
      version: data.version,
      text: typeof data.text === 'string' ? data.text : '',
    };
  } catch {
    return null;
  }
}

/** Lädt die gespeicherte Einwilligung. Beim App-Start und in den Screens aufrufen. */
export async function loadConsent(): Promise<Consent | null> {
  cached = parse(await readValue(CONSENT_STORAGE_KEY));
  loaded = true;
  return cached;
}

/** Synchroner Blick auf die zuletzt geladene Einwilligung. */
export function getConsent(): Consent | null {
  return cached;
}

export function isConsentLoaded(): boolean {
  return loaded;
}

/**
 * Gilt die Einwilligung für die aktuelle Textversion?
 * Nach einer Textänderung wird bewusst erneut gefragt.
 */
export function isConsentValid(consent: Consent | null = cached): boolean {
  return !!consent && consent.version === CONSENT_VERSION;
}

/** Merkt die Zustimmung samt Zeitpunkt und Wortlaut. */
export async function grantConsent(now: Date = new Date()): Promise<Consent> {
  const consent: Consent = {
    grantedAt: now.toISOString(),
    version: CONSENT_VERSION,
    text: consentText(),
  };
  cached = consent;
  loaded = true;
  await writeValue(CONSENT_STORAGE_KEY, JSON.stringify(consent));
  return consent;
}

/** Widerruf mit Wirkung für die Zukunft: die nächste Analyse fragt erneut. */
export async function revokeConsent(): Promise<void> {
  cached = null;
  loaded = true;
  await deleteValue(CONSENT_STORAGE_KEY);
}

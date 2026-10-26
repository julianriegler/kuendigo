/**
 * Freikontingent: drei Analysen pro Gerät und Monat.
 *
 * Der Serverstand kommt entweder per GET /api/analyze (Statusabruf) oder
 * nebenbei aus den Headern x-free-limit und x-free-remaining jeder Analyse.
 */
import { analyzeEndpoint } from './apiConfig';
import { loadDeviceToken } from './storage';

export interface Quota {
  limit: number;
  used: number;
  remaining: number;
  /** Bei limit 0: aus (nicht freigeschaltet), deckel (Monat vergeben), zaehler (Störung) */
  reason?: string;
}

let cached: Quota | null = null;

export function getCachedQuota(): Quota | null {
  return cached;
}

/**
 * Gibt es auf diesem Gerät überhaupt ein Freikontingent? Auf Native ohne
 * EXPO_PUBLIC_API_BASE_URL kennt die App den Proxy nicht, dann geht nur ein
 * eigener Key und ein Gratis-Hinweis wäre gelogen.
 */
export function quotaAvailable(): boolean {
  if (analyzeEndpoint() === null) return false;
  // Erst versprechen, wenn der Server ein Kontingent bestätigt hat. Er meldet
  // limit 0, wenn er keinen Schlüssel oder keinen Zähler hat.
  return cached !== null && cached.limit > 0;
}

/** Steht sicher fest, dass ohne eigenen Key gerade keine Analyse geht? */
export function quotaUnavailable(): boolean {
  if (analyzeEndpoint() === null) return true;
  return cached !== null && cached.limit === 0;
}

/** Liest die Kontingent-Header einer Analyse-Antwort mit. */
export function rememberQuotaFromResponse(res: Response): void {
  // Fehlender Header (eigener Key) und Header 0 (Sperre) auseinanderhalten: Number(null) ist auch 0
  const rawLimit = res.headers.get('x-free-limit');
  if (rawLimit === null) return;
  const limit = Number(rawLimit);
  const remaining = Number(res.headers.get('x-free-remaining'));
  if (!Number.isFinite(limit) || !Number.isFinite(remaining) || limit < 0) return;
  cached = limit === 0
    ? { limit: 0, used: 0, remaining: 0, reason: res.headers.get('x-free-reason') ?? 'aus' }
    : { limit, remaining, used: Math.max(0, limit - remaining) };
}

/** Fragt den Stand beim Server ab, ohne Kontingent zu verbrauchen. */
export async function fetchQuota(): Promise<Quota | null> {
  const endpoint = analyzeEndpoint();
  if (!endpoint) return null;
  try {
    // Im schlechten Netz nicht ewig im Zwischenzustand hängen
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: { 'x-device-token': await loadDeviceToken() },
      // ponytail: ohne AbortSignal.timeout (ältere Laufzeiten) bleibt es beim Warten ohne Zeitlimit
      signal: typeof AbortSignal?.timeout === 'function' ? AbortSignal.timeout(8000) : undefined,
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (typeof data?.limit !== 'number' || typeof data?.remaining !== 'number') return null;
    cached = { limit: data.limit, used: data.used ?? 0, remaining: data.remaining, reason: data.reason };
    return cached;
  } catch {
    return null;
  }
}

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
  // Der Server meldet limit 0, wenn er keinen Schlüssel oder keinen Zähler hat
  return cached === null || cached.limit > 0;
}

/** Liest die Kontingent-Header einer Analyse-Antwort mit. */
export function rememberQuotaFromResponse(res: Response): void {
  const limit = Number(res.headers.get('x-free-limit'));
  const remaining = Number(res.headers.get('x-free-remaining'));
  if (!Number.isFinite(limit) || !Number.isFinite(remaining) || limit <= 0) return;
  cached = { limit, remaining, used: Math.max(0, limit - remaining) };
}

/** Fragt den Stand beim Server ab, ohne Kontingent zu verbrauchen. */
export async function fetchQuota(): Promise<Quota | null> {
  const endpoint = analyzeEndpoint();
  if (!endpoint) return null;
  try {
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: { 'x-device-token': await loadDeviceToken() },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (typeof data?.limit !== 'number' || typeof data?.remaining !== 'number') return null;
    cached = { limit: data.limit, used: data.used ?? 0, remaining: data.remaining };
    return cached;
  } catch {
    return null;
  }
}

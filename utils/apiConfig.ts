/**
 * Adresse des eigenen Analyse-Proxys (/api/analyze).
 *
 * Web: relativ, die Funktion liegt unter derselben Domain wie die App.
 * Native: absolute URL nötig, per EXPO_PUBLIC_API_BASE_URL gesetzt
 * (zum Beispiel in .env: EXPO_PUBLIC_API_BASE_URL=https://kuendigo.vercel.app).
 */
export function apiBaseUrl(): string | null {
  if (typeof window !== 'undefined' && typeof window.location !== 'undefined') return '';
  const base = process.env.EXPO_PUBLIC_API_BASE_URL;
  return base ? base.replace(/\/$/, '') : null;
}

/** Null, wenn die App nicht weiß, wo der Proxy liegt (Native ohne Konfiguration). */
export function analyzeEndpoint(): string | null {
  const base = apiBaseUrl();
  return base === null ? null : `${base}/api/analyze`;
}

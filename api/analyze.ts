/**
 * Vercel Edge Function: Proxy für die Anthropic API mit Freikontingent.
 *
 * Reihenfolge der Schlüssel:
 *  1. process.env.ANTHROPIC_API_KEY (Server), verbraucht Freikontingent
 *  2. Header x-anthropic-key (optionaler Eigenschlüssel), ohne Kontingent
 *
 * Freikontingent: FREE_ANALYSES_PER_MONTH Analysen pro Gerät und Kalendermonat,
 * gezählt in Upstash Redis über den anonymen Geräte-Token aus dem Header
 * x-device-token. Bei Überschreitung antwortet die Funktion mit 429.
 *
 * Der Proxy existiert außerdem, weil Browser (vor allem iOS Safari) direkte
 * Aufrufe an api.anthropic.com per CORS blockieren.
 *
 * Erwartete Umgebungsvariablen:
 *   ANTHROPIC_API_KEY         Serverschlüssel
 *   UPSTASH_REDIS_REST_URL    Upstash Redis, kostenloser Tarif
 *   UPSTASH_REDIS_REST_TOKEN
 *   ANTHROPIC_BASE_URL        optional, Standard https://api.anthropic.com
 */

export const config = { runtime: 'edge' };

const DEFAULT_ANTHROPIC_BASE = 'https://api.anthropic.com';
const FREE_ANALYSES_PER_MONTH = 3;
const COUNTER_TTL_SECONDS = 60 * 60 * 24 * 40; // gut ein Monat plus Puffer

// Grenzen für den Serverschlüssel. Der Endpunkt ist öffentlich und der
// Geräte-Token frei wählbar, deshalb darf niemand Modell, Antwortlänge oder
// Anfragegröße selbst bestimmen.
const ALLOWED_MODELS = ['claude-sonnet-4-6'];
const MAX_TOKENS_CAP = 2048;
const MAX_BODY_BYTES = 5 * 1024 * 1024;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-anthropic-key, x-device-token',
  'Access-Control-Expose-Headers': 'x-free-limit, x-free-remaining',
};

const LIMIT_MESSAGE =
  `Dein Freikontingent von ${FREE_ANALYSES_PER_MONTH} Analysen pro Monat ist aufgebraucht. ` +
  'Trage in den Einstellungen deinen eigenen Anthropic API Key ein (ca. 1 bis 3 Cent pro Analyse) ' +
  'oder hol dir Kündigo Pro für unbegrenzte Analysen. Nächsten Monat sind wieder Analysen frei.';

function json(body: unknown, status: number, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', ...extra },
  });
}

function errorResponse(message: string, status: number, extra: Record<string, string> = {}): Response {
  return json({ error: { message } }, status, extra);
}

/** Schlüssel je Gerät und Kalendermonat, zum Beispiel kuendigo:free:2026-08:abc123 */
function counterKey(deviceToken: string): string {
  const now = new Date();
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  return `kuendigo:free:${month}:${deviceToken}`;
}

// ─── Zähler: Upstash Redis, lokal ein Speicher im Prozess ────────────────────

const memoryCounter = new Map<string, number>();

function upstashConfig(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ''), token } : null;
}

async function upstash(cfg: { url: string; token: string }, command: string[]): Promise<number> {
  const res = await fetch(cfg.url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  });
  if (!res.ok) throw new Error(`Upstash ${res.status}`);
  const data = await res.json();
  if (data?.error) throw new Error(String(data.error));
  return Number(data?.result ?? 0);
}

/** Aktueller Verbrauch, ohne ihn zu verändern. */
async function readUsage(key: string): Promise<number> {
  const cfg = upstashConfig();
  if (!cfg) return memoryCounter.get(key) ?? 0;
  return await upstash(cfg, ['GET', key]);
}

/** Erhöht den Verbrauch und gibt den neuen Stand zurück. */
async function consume(key: string): Promise<number> {
  const cfg = upstashConfig();
  if (!cfg) {
    const next = (memoryCounter.get(key) ?? 0) + 1;
    memoryCounter.set(key, next);
    return next;
  }
  const used = await upstash(cfg, ['INCR', key]);
  if (used === 1) await upstash(cfg, ['EXPIRE', key, String(COUNTER_TTL_SECONDS)]);
  return used;
}

/** Gibt eine Analyse zurück, wenn der Aufruf bei Anthropic gescheitert ist. */
async function refund(key: string): Promise<void> {
  const cfg = upstashConfig();
  if (!cfg) {
    memoryCounter.set(key, Math.max(0, (memoryCounter.get(key) ?? 1) - 1));
    return;
  }
  try {
    await upstash(cfg, ['DECR', key]);
  } catch {
    // Rückerstattung ist Kulanz, ein Fehler darf die Antwort nicht kippen
  }
}

/**
 * Prüft und beschneidet den Anfragekörper für den Serverschlüssel-Pfad.
 * Gibt entweder den bereinigten Körper oder eine Fehlerantwort zurück.
 */
function prepareServerBody(raw: string): { body: string } | { error: Response } {
  if (raw.length > MAX_BODY_BYTES) {
    return { error: errorResponse('Die Anfrage ist zu groß. Bitte einen kleineren Screenshot oder weniger Text schicken.', 413) };
  }

  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { error: errorResponse('Ungültige Anfrage.', 400) };
  }
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.messages)) {
    return { error: errorResponse('Ungültige Anfrage.', 400) };
  }

  const model = ALLOWED_MODELS.includes(parsed.model) ? parsed.model : ALLOWED_MODELS[0];
  const requested = Number(parsed.max_tokens);
  const maxTokens = Number.isFinite(requested) && requested > 0
    ? Math.min(requested, MAX_TOKENS_CAP)
    : MAX_TOKENS_CAP;

  return { body: JSON.stringify({ ...parsed, model, max_tokens: maxTokens }) };
}

function quotaHeaders(used: number): Record<string, string> {
  return {
    'x-free-limit': String(FREE_ANALYSES_PER_MONTH),
    'x-free-remaining': String(Math.max(0, FREE_ANALYSES_PER_MONTH - used)),
  };
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const deviceToken = (req.headers.get('x-device-token') ?? '').trim().slice(0, 100);
  const ownKey = (req.headers.get('x-anthropic-key') ?? '').trim();
  const serverKey = (process.env.ANTHROPIC_API_KEY ?? '').trim();

  // Reiner Statusabruf für die Einstellungen, verbraucht nichts
  if (req.method === 'GET') {
    if (!deviceToken) return errorResponse('Geräte-Token fehlt.', 400);
    // Ohne Serverschlüssel oder ohne Zähler gibt es kein Freikontingent,
    // dann darf die App auch keines versprechen.
    if (!serverKey || (!upstashConfig() && process.env.ALLOW_MEMORY_QUOTA !== '1')) {
      return json({ limit: 0, used: 0, remaining: 0 }, 200,
        { 'x-free-limit': '0', 'x-free-remaining': '0' });
    }
    try {
      const used = await readUsage(counterKey(deviceToken));
      return json(
        { limit: FREE_ANALYSES_PER_MONTH, used, remaining: Math.max(0, FREE_ANALYSES_PER_MONTH - used) },
        200,
        quotaHeaders(used),
      );
    } catch {
      return errorResponse('Kontingent konnte gerade nicht abgefragt werden.', 503);
    }
  }

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  // Eigener Key: unbegrenzt, ohne Kontingent
  if (ownKey) {
    if (!ownKey.startsWith('sk-ant-')) {
      return errorResponse('Ungültiger API Key. Bitte in den Einstellungen prüfen.', 401);
    }
    return await callAnthropic(await req.text(), ownKey);
  }

  if (!serverKey) {
    return errorResponse(
      'Die Analyse ist gerade nicht verfügbar (kein Serverschlüssel konfiguriert). ' +
      'Du kannst in den Einstellungen deinen eigenen Anthropic API Key eintragen.',
      503,
    );
  }

  if (!deviceToken) {
    return errorResponse('Geräte-Token fehlt. Bitte die App neu laden.', 400);
  }

  // Ohne Upstash ist das Kontingent nicht verlässlich zählbar (der Speicher im
  // Prozess lebt nur pro Instanz). Dann lieber ablehnen, als den Serverschlüssel
  // ungezählt zu verbrauchen. Lokal mit ALLOW_MEMORY_QUOTA=1 ausdrücklich erlaubt.
  if (!upstashConfig() && process.env.ALLOW_MEMORY_QUOTA !== '1') {
    return errorResponse(
      'Das Freikontingent ist gerade nicht verfügbar. Bitte später erneut versuchen ' +
      'oder in den Einstellungen einen eigenen Anthropic API Key eintragen.',
      503,
    );
  }

  // Erst prüfen, dann zählen: eine abgelehnte Anfrage kostet kein Kontingent.
  const prepared = prepareServerBody(await req.text());
  if ('error' in prepared) return prepared.error;

  const key = counterKey(deviceToken);
  let used: number;
  try {
    used = await consume(key);
  } catch {
    return errorResponse('Das Freikontingent konnte gerade nicht geprüft werden. Bitte später erneut versuchen.', 503);
  }

  if (used > FREE_ANALYSES_PER_MONTH) {
    await refund(key); // Zähler nicht ins Unendliche wachsen lassen
    return errorResponse(LIMIT_MESSAGE, 429, quotaHeaders(FREE_ANALYSES_PER_MONTH));
  }

  const res = await callAnthropic(prepared.body, serverKey, quotaHeaders(used));
  if (!res.ok) await refund(key); // gescheiterte Analyse kostet kein Kontingent
  return res;
}

async function callAnthropic(
  body: string,
  apiKey: string,
  extra: Record<string, string> = {},
): Promise<Response> {
  const base = (process.env.ANTHROPIC_BASE_URL ?? DEFAULT_ANTHROPIC_BASE).replace(/\/$/, '');
  try {
    const upstream = await fetch(`${base}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body,
    });
    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', ...extra },
    });
  } catch {
    return errorResponse('Die Analyse konnte nicht durchgeführt werden. Bitte später erneut versuchen.', 502, extra);
  }
}

/**
 * Vercel Edge Function — Proxy für Anthropic API
 *
 * Warum: Browser (v.a. iOS Safari) blockieren direkte Fetch-Calls
 * zu api.anthropic.com mit CORS-Fehlern ("Load failed").
 * Diese Funktion leitet die Anfrage server-seitig weiter —
 * kein CORS, kein API-Key im sichtbaren Netzwerk-Traffic.
 */

export const config = { runtime: 'edge' };

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

export default async function handler(req: Request): Promise<Response> {
  // CORS-Header für den Browser
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-anthropic-key',
  };

  // Preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  // API Key aus Request-Header
  const apiKey = req.headers.get('x-anthropic-key') ?? '';
  if (!apiKey.startsWith('sk-ant-')) {
    return new Response(
      JSON.stringify({ error: { message: 'Ungültiger API Key. Bitte in Einstellungen ⚙️ prüfen.' } }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Body weiterleiten an Anthropic
  const body = await req.text();

  const anthropicRes = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body,
  });

  const responseText = await anthropicRes.text();
  return new Response(responseText, {
    status: anthropicRes.status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

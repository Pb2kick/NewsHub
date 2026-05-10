/**
 * supabase/functions/fetch-ph-election/index.ts
 *
 * What changed and why:
 * - NEW FILE. Replaces the Spring Boot /api/ai/fetch-ph-election proxy that was
 *   returning 401 because ANTHROPIC_API_KEY could not be reliably injected into
 *   the Render environment.
 * - Reads the API key from Deno.env.get('ANTHROPIC_API_KEY') — set once via
 *   `supabase secrets set` and available to all Edge Function invocations
 *   immediately without redeploying any server.
 * - Uses only Deno native fetch — no npm packages, no Supabase client library.
 * - Returns the raw Anthropic response body so the frontend parse logic is unchanged.
 * - CORS headers on every response (including errors and OPTIONS preflight) so the
 *   browser can call this function directly from React without a CORS proxy.
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MODEL = "claude-sonnet-4-6";

// Word-for-word identical to the prompt in the original fetchLatestPhElection()
const PH_ELECTION_PROMPT =
  "Search for the single most recent or currently ongoing Philippine national or local election as of today. Return ONLY a JSON object (no markdown) with this exact shape: { election: { name, region, start_date (YYYY-MM-DD), end_date (YYYY-MM-DD), status (Active|Upcoming|Completed) }, candidates: [{ name, party, position, bio, photo_url }] }. Use real candidate names and real parties from search results. photo_url should be an empty string if not found.";

Deno.serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: CORS_HEADERS });
  }

  // Guard: API key must be present
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
  if (!apiKey.trim()) {
    return new Response(
      JSON.stringify({
        error:
          "ANTHROPIC_API_KEY secret is not set. Run: supabase secrets set ANTHROPIC_API_KEY=<your-key>",
      }),
      {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  }

  // Forward the fixed prompt to the Anthropic Messages API
  let anthropicResponse: Response;
  try {
    anthropicResponse = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1500,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [{ role: "user", content: PH_ELECTION_PROMPT }],
      }),
    });
  } catch (networkError) {
    const message = networkError instanceof Error ? networkError.message : String(networkError);
    return new Response(
      JSON.stringify({ error: `Network error reaching Anthropic API: ${message}` }),
      {
        status: 502,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  }

  // Non-2xx from Anthropic → 502 with actionable message
  if (!anthropicResponse.ok) {
    return new Response(
      JSON.stringify({
        error: `Anthropic returned status ${anthropicResponse.status}. Check your API key and account credits at console.anthropic.com.`,
      }),
      {
        status: 502,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  }

  // 2xx → stream the raw Anthropic body straight through to the caller
  const rawBody = await anthropicResponse.text();
  return new Response(rawBody, {
    status: 200,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
});

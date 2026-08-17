/* ==========================================================================
 * gemini-client.js — SECOND provider option for the Lyric Engine transport,
 * alongside js/claude-client.js. John, 2026-08-13: "Gemini pro is the model
 * I'd like to use for Lyrics, but I think having both options offers more
 * flexibility" — Gemini is the default provider (see js/state.js), Claude
 * remains fully available via the provider toggle in the lyric panel.
 *
 * Same key-handling architecture as claude-client.js: the API key is entered
 * by the user, lives client-side only (memory/localStorage on the user's own
 * machine), never committed to the repo, never sent anywhere but Google's API
 * (direct mode) or the user's own local proxy (proxy mode).
 *
 * MODEL NAMING CAVEAT: Google renames/versions Gemini models more often than
 * Anthropic does. GEMINI_MODELS below is a SUGGESTED list, not an exhaustive
 * or guaranteed-current one — the model field in the UI is a free-text input
 * with these as a dropdown of starting points, not a locked enum, specifically
 * so a rename doesn't leave this dead until code is edited. Verified against
 * Google's own API reference and Vertex AI docs at time of writing (2026-08).
 *
 * REQUEST SHAPE (verified, not guessed): POST to
 * https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
 * with header x-goog-api-key, body {contents:[{parts:[{text}]}], generationConfig}.
 * Response: candidates[0].content.parts[].text.
 * ========================================================================*/

export const GEMINI_DEFAULT_MODEL = 'gemini-3-pro-preview';
export const GEMINI_MODELS = [
  'gemini-3-pro-preview',
  'gemini-3.1-pro-preview',
  'gemini-3-flash-preview',
];

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const PROXY_URL = 'http://127.0.0.1:8788/v1beta/generateContent'; // different port than claude-client's proxy — the two can run side by side
const TRANSPORT_MODE_KEY = 'atmos.geminiTransportMode';

// NAMING NOTE: this bundler (build.mjs) flattens every module's exports into
// one shared window.__ATMOS namespace with no per-module scoping — a name
// used in two files collides silently (the later-bundled file wins). Hence
// getGeminiStoredTransportMode rather than the more obvious
// getStoredTransportMode, which js/claude-client.js also exports.
export function getGeminiStoredTransportMode() {
  try { return localStorage.getItem(TRANSPORT_MODE_KEY) || 'direct'; }
  catch { return 'direct'; }
}
export function setGeminiStoredTransportMode(mode) {
  try { localStorage.setItem(TRANSPORT_MODE_KEY, mode); } catch { /* best-effort */ }
}

// callGemini: the raw request. Shaped to match what runLyricEngine's
// `transport({prompt, model, temperature, maxTokens}) -> string` contract
// expects — see makeGeminiTransport() below for the adapter.
/* WEB GROUNDING (John, 2026-08-17: "The Call gets Web grounding").
 * Attached ONLY when the caller passes grounded:true — in practice only
 * core/source-research.js's premise pre-pass. Deliberately NOT enabled on the
 * creative lyric call: a search tool on that call invites the model to look
 * up existing songs about the same subject and echo their phrasing, which is
 * precisely what core/lyric.js's originalityRules() exists to prevent.
 * Gemini's grounding tool is declared as {google_search:{}} on the request's
 * `tools` array. */
const GEMINI_SEARCH_TOOL = { google_search: {} };

export async function callGemini({ apiKey, model, temperature, maxTokens, prompt, transportMode, grounded }) {
  const mode = transportMode || getGeminiStoredTransportMode();
  if (mode === 'direct' && !(apiKey && apiKey.trim())) {
    throw new Error('Missing Gemini API key. Enter a key in Gemini Settings before generating.');
  }
  const m = model || GEMINI_DEFAULT_MODEL;
  const url = mode === 'proxy' ? PROXY_URL : `${API_BASE}/${encodeURIComponent(m)}:generateContent`;

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(mode === 'direct' ? { 'x-goog-api-key': apiKey.trim() } : {}),
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: temperature != null ? Number(temperature) : 0.9,
          maxOutputTokens: Number(maxTokens) || 4096,
        },
        ...(grounded ? { tools: [GEMINI_SEARCH_TOOL] } : {}),
      }),
    });
  } catch (error) {
    const help = mode === 'direct'
      ? 'Direct browser mode may be blocked by CORS. Switch to Local proxy mode and start the optional proxy.'
      : 'Local proxy mode expects the optional proxy to be running at http://127.0.0.1:8788.';
    throw new Error(`Network or CORS failure while calling Gemini: ${error.message}. ${help}`);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    const modelHint = response.status === 404 ? ` The selected model ("${m}") may not exist or may have been renamed — Google renames Gemini models more often than most providers.` : '';
    throw new Error(`Gemini request failed (${response.status}).${modelHint} ${body || 'Check API key, model, quota, or browser CORS policy.'}`);
  }

  const data = await response.json();
  const candidate = (data.candidates || [])[0];
  const parts = (candidate && candidate.content && candidate.content.parts) || [];
  const text = parts.map(p => p.text || '').join('').trim();
  if (!text) {
    // Gemini returns a candidate with no text but a finishReason when blocked
    // by safety filters or truncated — surface that instead of a bare "empty".
    const reason = candidate && candidate.finishReason;
    throw new Error(`Gemini returned an empty response.${reason ? ` finishReason: ${reason}` : ''}`);
  }
  return text;
}

export async function testGeminiConnection(settings) {
  return callGemini({
    ...settings,
    maxTokens: 64,
    temperature: 0,
    prompt: 'Return JSON only: {"ok":true,"message":"Gemini connection ready"}',
  });
}

// makeGeminiTransport: adapts callGemini's {apiKey,...} shape to the plain
// {prompt, model, temperature, maxTokens} -> string function shape that
// core/lyric.js's runLyricEngine() expects as its `transport` argument.
export function makeGeminiTransport({ apiKey, transportMode }) {
  return async function transport({ prompt, model, temperature, maxTokens, grounded }) {
    return callGemini({ apiKey, transportMode, model, temperature, maxTokens, prompt, grounded });
  };
}

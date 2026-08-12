/* ==========================================================================
 * claude-client.js — REAL transport for the Lyric Engine's runLyricEngine().
 *
 * Ported forward from archive/js/claude-client.js (the proven ATMOS v7
 * design) with the model list updated to current models. The key-handling
 * architecture is UNCHANGED from that prior art — it was already the right
 * design for a local, single-user, file:// tool:
 *   - The API key is entered by the user in the app and lives client-side
 *     only (see js/state.js S.claude.apiKey). It is NEVER committed to the
 *     repo, never sent anywhere but Anthropic's API (direct mode) or the
 *     user's own local proxy (proxy mode).
 *   - DIRECT mode calls api.anthropic.com straight from the browser, using
 *     the anthropic-dangerous-direct-browser-access header Anthropic
 *     requires for that. Simplest path; may hit CORS in some browsers.
 *   - PROXY mode calls a local proxy at 127.0.0.1:8787 (not shipped here —
 *     an optional local relay for anyone who hits CORS in direct mode).
 * This module is NOT dependency-injected like the rest of core/ — it IS the
 * dependency that gets injected as `transport` into runLyricEngine().
 * ========================================================================*/

export const DEFAULT_MODEL = 'claude-opus-4-8'; // matches core/lyric.js's DEFAULT_LYRIC_MODEL
export const CLAUDE_MODELS = [
  'claude-opus-4-8',
  'claude-sonnet-5',
  'claude-haiku-4-5-20251001',
];

const API_URL = 'https://api.anthropic.com/v1/messages';
const PROXY_URL = 'http://127.0.0.1:8787/v1/messages';
const TRANSPORT_MODE_KEY = 'atmos.claudeTransportMode';

export function getStoredTransportMode() {
  try { return localStorage.getItem(TRANSPORT_MODE_KEY) || 'direct'; }
  catch { return 'direct'; } // localStorage unavailable (e.g. some file:// contexts)
}
export function setStoredTransportMode(mode) {
  try { localStorage.setItem(TRANSPORT_MODE_KEY, mode); } catch { /* best-effort */ }
}

// callClaude: the raw request. Shaped to match what runLyricEngine's
// `transport({prompt, model, temperature, maxTokens}) -> string` contract
// expects — see makeClaudeTransport() below for the adapter.
export async function callClaude({ apiKey, model, temperature, maxTokens, prompt, transportMode }) {
  const mode = transportMode || getStoredTransportMode();
  if (mode === 'direct' && !(apiKey && apiKey.trim())) {
    throw new Error('Missing Claude API key. Enter a key in Claude Settings before generating.');
  }

  let response;
  try {
    response = await fetch(mode === 'proxy' ? PROXY_URL : API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(mode === 'direct' ? { 'x-api-key': apiKey.trim() } : {}),
        'anthropic-version': '2023-06-01',
        ...(mode === 'direct' ? { 'anthropic-dangerous-direct-browser-access': 'true' } : {}),
      },
      body: JSON.stringify({
        model,
        max_tokens: Number(maxTokens) || 4096,
        temperature: temperature != null ? Number(temperature) : 0.9,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
  } catch (error) {
    const help = mode === 'direct'
      ? 'Direct browser mode may be blocked by CORS. Switch to Local proxy mode and start the optional proxy.'
      : 'Local proxy mode expects the optional proxy to be running at http://127.0.0.1:8787.';
    throw new Error(`Network or CORS failure while calling Claude: ${error.message}. ${help}`);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    const modelHint = response.status === 404 ? ` The selected model ("${model}") may not be available to this API key.` : '';
    throw new Error(`Claude request failed (${response.status}).${modelHint} ${body || 'Check API key, model, quota, or browser CORS policy.'}`);
  }

  const data = await response.json();
  const text = (data.content || []).map(item => item.text || '').join('\n').trim();
  if (!text) throw new Error('Claude returned an empty response.');
  return text;
}

export async function testClaudeConnection(settings) {
  return callClaude({
    ...settings,
    maxTokens: 64,
    temperature: 0,
    prompt: 'Return JSON only: {"ok":true,"message":"Claude connection ready"}',
  });
}

// makeClaudeTransport: adapts callClaude's {apiKey,...} shape to the plain
// {prompt, model, temperature, maxTokens} -> string function shape that
// core/lyric.js's runLyricEngine() expects as its `transport` argument. This
// is the ONE function that turns the (previously always-mocked) lyric
// pipeline into a real, live call.
export function makeClaudeTransport({ apiKey, transportMode }) {
  return async function transport({ prompt, model, temperature, maxTokens }) {
    return callClaude({ apiKey, transportMode, model, temperature, maxTokens, prompt });
  };
}

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

export const CLAUDE_DEFAULT_MODEL = 'claude-opus-4-8'; // matches core/lyric.js's DEFAULT_LYRIC_MODEL
export const CLAUDE_MODELS = [
  'claude-opus-4-8',
  'claude-sonnet-5',
  'claude-haiku-4-5-20251001',
];

import { sendWithParamRetry } from './llm-params.js';

const API_URL = 'https://api.anthropic.com/v1/messages';
const PROXY_URL = 'http://127.0.0.1:8787/v1/messages';
const TRANSPORT_MODE_KEY = 'atmos.claudeTransportMode';

// NAMING NOTE: this bundler (build.mjs) flattens every module's exports into
// one shared window.__ATMOS namespace with no per-module scoping — a name
// used in two files collides silently (the later-bundled file wins). Hence
// getClaudeStoredTransportMode rather than the more obvious
// getStoredTransportMode, which js/gemini-client.js also needs to export.
export function getClaudeStoredTransportMode() {
  try { return localStorage.getItem(TRANSPORT_MODE_KEY) || 'direct'; }
  catch { return 'direct'; } // localStorage unavailable (e.g. some file:// contexts)
}
export function setClaudeStoredTransportMode(mode) {
  try { localStorage.setItem(TRANSPORT_MODE_KEY, mode); } catch { /* best-effort */ }
}

// callClaude: the raw request. Shaped to match what runLyricEngine's
// `transport({prompt, model, temperature, maxTokens}) -> string` contract
// expects — see makeClaudeTransport() below for the adapter.
/* WEB GROUNDING (John, 2026-08-17) — see js/gemini-client.js for the full
 * rationale, including why this is never attached to the creative lyric call.
 * Anthropic's server-side web search tool; the model runs the searches itself
 * and returns a normal assistant turn, so no tool-result round trip is needed
 * here. */
const CLAUDE_SEARCH_TOOL = { type: 'web_search_20250305', name: 'web_search' };

export async function callClaude({ apiKey, model, temperature, maxTokens, prompt, transportMode, grounded }) {
  const mode = transportMode || getClaudeStoredTransportMode();
  if (mode === 'direct' && !(apiKey && apiKey.trim())) {
    throw new Error('Missing Claude API key. Enter a key in Claude Settings before generating.');
  }

  const headers = {
    'content-type': 'application/json',
    ...(mode === 'direct' ? { 'x-api-key': apiKey.trim() } : {}),
    'anthropic-version': '2023-06-01',
    ...(mode === 'direct' ? { 'anthropic-dangerous-direct-browser-access': 'true' } : {}),
  };
  const url = mode === 'proxy' ? PROXY_URL : API_URL;

  /* Tuning params are passed SEPARATELY from the essential request fields so
   * js/llm-params.js can drop one without touching model/messages/max_tokens.
   * 2026-08-17: a live call returned 400 "`temperature` is deprecated for this
   * model" — see that module's header for why the fix is a general retry
   * rather than deleting the field. */
  const tuning = { temperature: temperature != null ? Number(temperature) : 0.9 };

  let response, lastBody = '';
  try {
    const result = await sendWithParamRetry({
      provider: 'claude', model, params: tuning,
      attempt: async (params) => {
        const res = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model,
            max_tokens: Number(maxTokens) || 4096,
            ...params,
            messages: [{ role: 'user', content: prompt }],
            ...(grounded ? { tools: [CLAUDE_SEARCH_TOOL] } : {}),
          }),
        });
        // The body is read here rather than after the loop because a Response
        // can only be consumed once, and the retry decision needs to read it.
        const body = res.ok ? '' : await res.text().catch(() => '');
        return { ok: res.ok, status: res.status, body, res };
      },
    });
    response = result.res; lastBody = result.body;
  } catch (error) {
    const help = mode === 'direct'
      ? 'Direct browser mode may be blocked by CORS. Switch to Local proxy mode and start the optional proxy.'
      : 'Local proxy mode expects the optional proxy to be running at http://127.0.0.1:8787.';
    throw new Error(`Network or CORS failure while calling Claude: ${error.message}. ${help}`);
  }

  if (!response.ok) {
    const modelHint = response.status === 404 ? ` The selected model ("${model}") may not be available to this API key.` : '';
    throw new Error(`Claude request failed (${response.status}).${modelHint} ${lastBody || 'Check API key, model, quota, or browser CORS policy.'}`);
  }

  const data = await response.json();
  // Select TEXT-CARRYING BLOCKS, not positions. A grounded response
  // interleaves server_tool_use and web_search_tool_result blocks with the
  // assistant's own text; neither carries a `.text` field, and mapping them
  // to '' left stray newlines wrapped around the JSON the caller has to
  // parse. Tested on `.text` presence rather than a `type === 'text'`
  // whitelist deliberately: it excludes every tool block just as reliably
  // while staying tolerant of a block that omits `type`, which is how the
  // mocks in validate-live-lyric.mjs are shaped and how a local proxy might
  // legitimately relay a response.
  const text = (data.content || [])
    .filter(item => item && typeof item.text === 'string')
    .map(item => item.text)
    .join('\n').trim();
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
  return async function transport({ prompt, model, temperature, maxTokens, grounded }) {
    return callClaude({ apiKey, transportMode, model, temperature, maxTokens, prompt, grounded });
  };
}

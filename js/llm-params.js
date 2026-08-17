/* ==========================================================================
 * llm-params.js — SURVIVING PROVIDER PARAMETER CHURN (John, 2026-08-17).
 *
 * THE FAILURE THIS FIXES. A live Claude call came back:
 *   400 invalid_request_error — "`temperature` is deprecated for this model."
 * Nothing was wrong with the prompt, the key, the model name or the transport.
 * The request simply carried a parameter that the selected model no longer
 * accepts. John's question was the right one: not "how do we remove
 * temperature" but "is there a way to prevent this from happening as model
 * versions change".
 *
 * WHY NOT JUST DELETE TEMPERATURE. It would fix today's error and nothing
 * else. The same class of failure recurs every time a provider retires a
 * parameter, and it is guaranteed to recur — js/gemini-client.js already
 * carries a header comment about Google renaming models faster than most
 * providers, and that is the same churn showing up in a different field.
 * Hard-coding a request shape against a moving API surface is the bug;
 * removing one field just resets the clock. Temperature also still earns its
 * place where it IS accepted: core/source-research.js deliberately calls at
 * temperature 0 because that step is retrieval, not creativity.
 *
 * THE MECHANISM. A 400 that names a parameter is the provider telling us
 * exactly what to drop. So: parse the name out of the error, drop that one
 * field, retry once. Remember it per model so the round trip is paid once and
 * never again, and persist that memory so it is not re-paid every session.
 * Anything the provider does NOT name still surfaces as a normal error —
 * this narrows the request, it never retries blindly.
 *
 * WHAT THIS DOES NOT DO. It does not invent parameters, rename models, or
 * guess at replacements. If a provider deprecates temperature in favour of
 * some new field, this drops temperature and the model's own default applies;
 * adopting the replacement is a deliberate code change, not something to
 * infer from an error string.
 * ========================================================================*/

const STORAGE_KEY = 'atmos.unsupportedParams';

/* Per-model memory of parameters the provider has rejected. Keyed by
 * `${provider}:${model}` rather than by model alone — the same model name can
 * behave differently through a local proxy that rewrites the request, and two
 * providers could plausibly use the same short name. */
let cache = null;

function loadCache() {
  if (cache) return cache;
  cache = {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Shape-check rather than trusting whatever is in storage: a corrupted
      // or hand-edited entry must not be able to strip arbitrary fields out
      // of every future request.
      if (parsed && typeof parsed === 'object') {
        for (const [k, v] of Object.entries(parsed)) {
          if (Array.isArray(v)) cache[k] = v.filter(x => typeof x === 'string');
        }
      }
    }
  } catch { /* localStorage unavailable (some file:// contexts) — memory only */ }
  return cache;
}

function saveCache() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cache || {})); }
  catch { /* best-effort; the in-memory cache still holds for this session */ }
}

const keyFor = (provider, model) => `${provider}:${model || 'default'}`;

export function unsupportedParams(provider, model) {
  const c = loadCache();
  return c[keyFor(provider, model)] || [];
}

export function markUnsupported(provider, model, param) {
  const c = loadCache();
  const k = keyFor(provider, model);
  if (!c[k]) c[k] = [];
  if (!c[k].includes(param)) { c[k].push(param); saveCache(); }
  return c[k];
}

/* Test/support hook. Not called by the app — exists so a validator can run
 * against a known-empty cache, and so a user who switches back to an older
 * model that DOES accept a dropped parameter can clear the memory rather
 * than being permanently narrowed by a decision made for a different model. */
export function clearUnsupportedParams() { cache = {}; saveCache(); }

/* Parameter names this is allowed to drop. A CLOSED LIST on purpose: without
 * it, a 400 mentioning any backticked word could strip an essential field —
 * "`messages` is required" would happily delete the prompt and retry with
 * nothing. Only optional tuning knobs belong here. `model`, `messages`,
 * `contents`, `max_tokens` and `tools` are deliberately absent: dropping any
 * of those changes what is being asked, not how. */
export const DROPPABLE_PARAMS = Object.freeze([
  'temperature', 'top_p', 'topP', 'top_k', 'topK',
  'presence_penalty', 'frequency_penalty', 'stop_sequences', 'stopSequences',
  'candidateCount', 'seed',
]);

/* parseUnsupportedParam — pull the offending field name out of a provider's
 * 400 body. Handles both orders seen in the wild:
 *   "`temperature` is deprecated for this model."
 *   "this model does not support temperature"
 * Returns null when the message names nothing droppable, which is the safe
 * default: the caller then throws the original error rather than guessing.
 *
 * Deliberately matched against DROPPABLE_PARAMS rather than trusting the
 * regex capture, so a message quoting an unexpected token cannot cause a
 * field to be stripped. */
export function parseUnsupportedParam(status, body) {
  if (Number(status) !== 400) return null;
  const text = String(body || '');
  if (!/deprecat|unsupported|not support|not allowed|cannot be (?:used|set|specified)|is not a valid/i.test(text)) return null;
  for (const p of DROPPABLE_PARAMS) {
    // Word-boundary match so 'top_p' can't be found inside another token.
    const re = new RegExp(`(^|[^a-zA-Z0-9_])${p}([^a-zA-Z0-9_]|$)`);
    if (re.test(text)) return p;
  }
  return null;
}

/* omitUnsupported — strip the remembered fields before the request is built,
 * so a model that has already rejected something never pays the round trip
 * again. Returns a new object; never mutates the caller's. */
export function omitUnsupported(params, provider, model) {
  const drop = unsupportedParams(provider, model);
  if (!drop.length) return { ...params };
  const out = {};
  for (const [k, v] of Object.entries(params)) if (!drop.includes(k)) out[k] = v;
  return out;
}

/* sendWithParamRetry — the shared driver both clients use.
 *
 * `attempt(params)` builds and sends ONE request from the given tuning params
 * and returns {ok, status, body, data}. On a 400 naming a droppable field,
 * that field is remembered and the request is retried without it. Capped at
 * MAX_PARAM_RETRIES so a provider that keeps naming fields cannot loop, and
 * so a genuine 400 surfaces quickly rather than after a long silent series of
 * retries.
 *
 * Fields are dropped one at a time rather than all at once: providers report
 * one problem per response, and dropping speculatively would discard settings
 * that are still accepted. */
export const MAX_PARAM_RETRIES = 3;

export async function sendWithParamRetry({ provider, model, params, attempt }) {
  let current = omitUnsupported(params || {}, provider, model);
  let last = null;
  for (let i = 0; i <= MAX_PARAM_RETRIES; i++) {
    last = await attempt(current);
    if (last.ok) return last;
    const offending = parseUnsupportedParam(last.status, last.body);
    // Nothing droppable named, or we weren't sending it anyway — this is a
    // real error, not parameter churn. Hand it back untouched.
    if (!offending || !(offending in current)) return last;
    markUnsupported(provider, model, offending);
    const next = { ...current };
    delete next[offending];
    current = next;
  }
  return last;
}

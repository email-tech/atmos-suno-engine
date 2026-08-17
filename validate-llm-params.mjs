/* ==========================================================================
 * validate-llm-params.mjs — provider parameter churn (John, 2026-08-17).
 *
 * GUARDS THE ACTUAL REPORTED FAILURE: a live Claude call returned
 *   400 — "`temperature` is deprecated for this model."
 * and the app surfaced it as a hard error. The fix in js/llm-params.js is a
 * general retry, not a deletion of temperature, so what has to be tested is
 * the general behaviour: does an unknown-in-advance parameter rejection get
 * detected, dropped, retried and remembered — and, just as importantly, does
 * a REAL error still fail loudly instead of being retried into silence.
 *
 * The dangerous failure mode for a retry mechanism is over-eagerness: a bug
 * here would strip essential fields, or mask a genuine 400 behind a request
 * that succeeded only because it no longer asked for what was wanted. Most
 * of the checks below are negative for that reason.
 * ========================================================================*/
import {
  parseUnsupportedParam, omitUnsupported, sendWithParamRetry, markUnsupported,
  unsupportedParams, clearUnsupportedParams, DROPPABLE_PARAMS, MAX_PARAM_RETRIES,
} from './js/llm-params.js';
import { callClaude } from './js/claude-client.js';
import { callGemini } from './js/gemini-client.js';

let failures = 0, checks = 0;
const bad = (m) => { console.error(`  FAIL: ${m}`); failures++; };
const ok = (cond, m) => { if (!cond) bad(m); };

// No localStorage in node — the module falls back to an in-memory cache, which
// is exactly the path a file:// context with storage disabled would take, so
// this exercises the degraded path too.
clearUnsupportedParams();

/* ---- 1: the exact reported error is recognised ------------------------ */
{
  const REAL = '{"type":"error","error":{"type":"invalid_request_error","message":"`temperature` is deprecated for this model."},"request_id":"req_011Ce7tTF5RPxS9QPEWwQFR1"}';
  ok(parseUnsupportedParam(400, REAL) === 'temperature',
    'the exact 400 body John reported must be recognised as a temperature deprecation');
  // Same class, other phrasings providers actually use.
  ok(parseUnsupportedParam(400, 'this model does not support temperature') === 'temperature',
    'reverse word order must be recognised');
  ok(parseUnsupportedParam(400, '`top_p` is not allowed for this model') === 'top_p',
    'other droppable params must be recognised');
  ok(parseUnsupportedParam(400, 'topP cannot be set on this model') === 'topP',
    'camelCase (Gemini) param names must be recognised');
  checks++;
  console.log('  detection: the reported 400 plus 3 other real-world phrasings all parse.');
}

/* ---- 2: NEGATIVE — real errors must not be mistaken for churn ---------
 * This is the check that keeps the mechanism honest. Anything here returning
 * a param name would mean a genuine failure gets silently retried away. */
{
  ok(parseUnsupportedParam(401, '`temperature` is deprecated') === null,
    'a 401 must never trigger a param drop — wrong key is not param churn');
  ok(parseUnsupportedParam(404, 'model not found') === null, 'a 404 must not trigger a param drop');
  ok(parseUnsupportedParam(429, 'rate limit exceeded') === null, 'a 429 must not trigger a param drop');
  ok(parseUnsupportedParam(400, 'credit balance is too low') === null,
    'a billing 400 names no param and must not trigger a drop');
  ok(parseUnsupportedParam(400, 'invalid api key') === null, 'an auth-shaped 400 must not trigger a drop');
  ok(parseUnsupportedParam(400, '`messages`: field required') === null,
    'a missing REQUIRED field must not be droppable — dropping it would send an empty request');
  ok(parseUnsupportedParam(400, '`model` is not supported') === null,
    'model must never be droppable');
  ok(parseUnsupportedParam(400, '`max_tokens` is not supported') === null,
    'max_tokens must never be droppable');
  ok(parseUnsupportedParam(400, '`tools` is not supported') === null,
    'tools must never be droppable — silently dropping it would ungroundthe research call');
  for (const forbidden of ['model', 'messages', 'contents', 'max_tokens', 'maxTokens', 'tools'])
    ok(!DROPPABLE_PARAMS.includes(forbidden), `${forbidden} must not be in DROPPABLE_PARAMS`);
  checks++;
  console.log('  negative: 9 non-churn errors correctly ignored; essential fields not droppable.');
}

/* ---- 3: drop, retry, succeed, and REMEMBER ---------------------------- */
{
  clearUnsupportedParams();
  const sent = [];
  const result = await sendWithParamRetry({
    provider: 'claude', model: 'test-model-a', params: { temperature: 0, top_p: 0.9 },
    attempt: async (params) => {
      sent.push({ ...params });
      if ('temperature' in params) {
        return { ok: false, status: 400, body: '`temperature` is deprecated for this model.' };
      }
      return { ok: true, status: 200, body: '' };
    },
  });
  ok(result.ok, 'the retry must succeed once the offending param is dropped');
  ok(sent.length === 2, `expected exactly 2 attempts, saw ${sent.length}`);
  ok('temperature' in sent[0], 'attempt 1 must carry temperature');
  ok(!('temperature' in sent[1]), 'attempt 2 must not carry temperature');
  ok('top_p' in sent[1], 'attempt 2 must KEEP params the provider did not complain about');
  ok(unsupportedParams('claude', 'test-model-a').includes('temperature'),
    'the dropped param must be remembered for this model');

  // Second call: the round trip is paid once, never again.
  const sent2 = [];
  await sendWithParamRetry({
    provider: 'claude', model: 'test-model-a', params: { temperature: 0, top_p: 0.9 },
    attempt: async (params) => { sent2.push({ ...params }); return { ok: true, status: 200, body: '' }; },
  });
  ok(sent2.length === 1, 'a remembered param must be dropped up front, with no wasted retry');
  ok(!('temperature' in sent2[0]), 'a remembered param must be omitted from the first attempt');

  // Memory is PER MODEL — switching back to a model that accepts temperature
  // must not inherit another model's restriction.
  const sent3 = [];
  await sendWithParamRetry({
    provider: 'claude', model: 'test-model-b', params: { temperature: 0 },
    attempt: async (params) => { sent3.push({ ...params }); return { ok: true, status: 200, body: '' }; },
  });
  ok('temperature' in sent3[0], 'a different model must not inherit another model\u2019s dropped param');
  checks++;
  console.log('  drop/retry/remember: 2 attempts then 1, unrelated params kept, memory is per-model.');
}

/* ---- 4: a genuine error is returned, not retried into oblivion -------- */
{
  clearUnsupportedParams();
  let attempts = 0;
  const res = await sendWithParamRetry({
    provider: 'claude', model: 'test-model-c', params: { temperature: 0 },
    attempt: async () => { attempts++; return { ok: false, status: 400, body: 'credit balance is too low' }; },
  });
  ok(attempts === 1, `a non-param 400 must not be retried at all, saw ${attempts} attempts`);
  ok(res.ok === false && res.body === 'credit balance is too low',
    'the original error must be returned unchanged so the user sees the real cause');

  // A provider that names a param we are not sending must not loop.
  let attempts2 = 0;
  await sendWithParamRetry({
    provider: 'claude', model: 'test-model-d', params: { top_p: 1 },
    attempt: async () => { attempts2++; return { ok: false, status: 400, body: '`temperature` is deprecated' }; },
  });
  ok(attempts2 === 1, `naming a param we are not sending must not retry, saw ${attempts2}`);

  // Pathological provider: names a new droppable field every time. Must cap.
  clearUnsupportedParams();
  let attempts3 = 0;
  const names = ['temperature', 'top_p', 'top_k', 'seed', 'presence_penalty'];
  await sendWithParamRetry({
    provider: 'claude', model: 'test-model-e',
    params: { temperature: 0, top_p: 1, top_k: 1, seed: 1, presence_penalty: 0 },
    attempt: async (params) => {
      attempts3++;
      const still = names.find(n => n in params);
      return { ok: false, status: 400, body: `\`${still}\` is deprecated` };
    },
  });
  ok(attempts3 <= MAX_PARAM_RETRIES + 1,
    `a provider naming a new param each time must be capped, saw ${attempts3} attempts`);
  checks++;
  console.log(`  honesty: real 400s returned untouched, no loop on unsent params, capped at ${MAX_PARAM_RETRIES} retries.`);
}

/* ---- 5: omitUnsupported never mutates the caller's object ------------- */
{
  clearUnsupportedParams();
  markUnsupported('claude', 'm', 'temperature');
  const original = { temperature: 0.9, top_p: 1 };
  const out = omitUnsupported(original, 'claude', 'm');
  ok(!('temperature' in out), 'the remembered param must be omitted from the returned object');
  ok('temperature' in original, 'the caller\u2019s object must NOT be mutated');
  ok(out !== original, 'a new object must be returned even when nothing is dropped');
  checks++;
  console.log('  purity: omitUnsupported returns a new object and leaves the caller\u2019s intact.');
}

/* ---- 6: END TO END through the real clients ---------------------------
 * Pure-function tests would not catch a client that never routes through the
 * driver at all — the same wiring-vs-data gap that produced validate-ui-boot.
 * These mock fetch and assert the real callClaude/callGemini recover. */
{
  clearUnsupportedParams();
  const originalFetch = globalThis.fetch;
  try {
    let bodies = [];
    globalThis.fetch = async (url, init) => {
      const body = JSON.parse(init.body);
      bodies.push(body);
      if ('temperature' in body) {
        return { ok: false, status: 400, text: async () => '{"error":{"message":"`temperature` is deprecated for this model."}}' };
      }
      return { ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text: 'recovered' }] }) };
    };
    const text = await callClaude({
      apiKey: 'sk-test', transportMode: 'direct', model: 'claude-test',
      prompt: 'hi', maxTokens: 100, temperature: 0.7,
    });
    ok(text === 'recovered', 'callClaude must recover from a temperature deprecation, not throw');
    ok(bodies.length === 2, `callClaude should retry exactly once, saw ${bodies.length} requests`);
    ok(bodies[1].model === 'claude-test', 'the retry must keep the model');
    ok(bodies[1].messages[0].content === 'hi', 'the retry must keep the prompt');
    ok(bodies[1].max_tokens === 100, 'the retry must keep max_tokens');

    // Grounding must survive a param drop — losing it would silently ungroundthe research call.
    clearUnsupportedParams();
    bodies = [];
    await callClaude({
      apiKey: 'sk-test', transportMode: 'direct', model: 'claude-test-2',
      prompt: 'hi', maxTokens: 100, temperature: 0.7, grounded: true,
    });
    ok(Array.isArray(bodies[1].tools) && bodies[1].tools.length === 1,
      'a grounded request must still carry its search tool after a param drop');

    // Gemini: same recovery, through the nested generationConfig.
    clearUnsupportedParams();
    const gBodies = [];
    globalThis.fetch = async (url, init) => {
      const body = JSON.parse(init.body);
      gBodies.push(body);
      if (body.generationConfig && 'temperature' in body.generationConfig) {
        return { ok: false, status: 400, text: async () => '{"error":{"message":"temperature is not supported"}}' };
      }
      return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'g-recovered' }] } }] }) };
    };
    const gText = await callGemini({
      apiKey: 'AIza-test', transportMode: 'direct', model: 'gemini-test',
      prompt: 'hi', maxTokens: 100, temperature: 0.7, grounded: true,
    });
    ok(gText === 'g-recovered', 'callGemini must recover from a param deprecation');
    ok(gBodies.length === 2, `callGemini should retry exactly once, saw ${gBodies.length} requests`);
    ok(gBodies[1].generationConfig.maxOutputTokens === 100,
      'the Gemini retry must keep maxOutputTokens inside generationConfig');
    ok(Array.isArray(gBodies[1].tools), 'the Gemini retry must keep its grounding tool');

    // A real error must still reach the user with its message intact.
    clearUnsupportedParams();
    globalThis.fetch = async () => ({ ok: false, status: 400, text: async () => 'credit balance is too low' });
    let threw = null;
    try {
      await callClaude({ apiKey: 'sk-test', transportMode: 'direct', model: 'x', prompt: 'hi', maxTokens: 10 });
    } catch (e) { threw = e.message; }
    ok(threw && /credit balance is too low/.test(threw),
      `a genuine 400 must surface its real message, got: ${threw}`);
  } finally {
    globalThis.fetch = originalFetch;
    clearUnsupportedParams();
  }
  checks++;
  console.log('  end to end: both real clients recover, keep model/prompt/tokens/tools, real errors still surface.');
}

console.log(`validate-llm-params: ${checks} check groups, ${failures} failures.`);
process.exit(failures ? 1 : 0);

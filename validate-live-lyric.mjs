/* validate-live-lyric.mjs — headless proof for P7's live lyric wiring
 * (js/claude-client.js, js/generate.js's buildLiveLyricRequest/generateLyricsLive).
 *
 * This is the module that turns runLyricEngine() from "only ever called
 * with a fake transport in tests" into something that actually calls
 * Claude — but this harness NEVER makes a real network call. It proves:
 *   1. callClaude()'s guard rails: missing API key in direct mode throws a
 *      clear error before any fetch happens; the request shape (headers,
 *      body) is correct for both direct and proxy transport modes.
 *   2. buildLiveLyricRequest() correctly refuses non-atom engines (the P8
 *      gap — resolver/legacy engines have no DNA yet) with a clear error
 *      rather than silently building something wrong.
 *   3. buildLiveLyricRequest() correctly threads S.lyric inputs (subject,
 *      title override, lineLength, rhymeDensity) into the answers object
 *      runLyricEngine expects — including the title-omitted-by-default
 *      behaviour John asked about.
 *   4. generateLyricsLive() end-to-end with an INJECTED fake transport
 *      (dependency injection, not a real API call) — proves the whole P7
 *      chain (DNA -> CIL -> structure -> brief -> prompt -> transport ->
 *      quality gate) actually connects, using the same round-robin loop
 *      validate-lyric-quality.mjs already proved in isolation.
 *
 * Live network testing (a real API key, a real call) is NOT possible in
 * this environment and is NOT what this harness claims to do — that has to
 * happen in a real browser with a real key, exactly per the key-handling
 * design in js/claude-client.js's header.
 *
 * Run from repo root: node validate-live-lyric.mjs
 */
import { callClaude, makeClaudeTransport, CLAUDE_DEFAULT_MODEL, CLAUDE_MODELS } from './js/claude-client.js';
import { callGemini, makeGeminiTransport, GEMINI_DEFAULT_MODEL, GEMINI_MODELS } from './js/gemini-client.js';
import { initState, syncEngineDefaults, setLyricInputs, setClaudeSettings, setGeminiSettings, setProvider } from './js/state.js';
import { buildLiveLyricRequest, generateLyricsLive } from './js/generate.js';

let checks = 0, fails = 0;
const bad = (m) => { fails++; console.log('  FAIL: ' + m); };
const ok = (c, m) => { checks++; if (!c) bad(m); };

/* 1. callClaude GUARD RAILS — missing key in direct mode must throw BEFORE
 *    any network call, so no fetch is even attempted. */
{
  let threw = false;
  try {
    await callClaude({ apiKey: '', transportMode: 'direct', model: CLAUDE_DEFAULT_MODEL, prompt: 'x', maxTokens: 10 });
  } catch (e) {
    threw = true;
    ok(/Missing Claude API key/.test(e.message), `expected a clear missing-key error, got: "${e.message}"`);
  }
  ok(threw, 'callClaude with an empty key in direct mode should throw, not silently proceed');
  console.log('  callClaude guard rail: missing API key throws before any network call.');
}

/* 2. callClaude REQUEST SHAPE — mock global.fetch to inspect what would
 *    actually be sent, for both direct and proxy modes, without hitting the
 *    network. */
{
  const originalFetch = globalThis.fetch;
  let capturedUrl = null, capturedInit = null;
  globalThis.fetch = async (url, init) => {
    capturedUrl = url; capturedInit = init;
    return { ok: true, json: async () => ({ content: [{ text: 'mock response' }] }) };
  };
  try {
    await callClaude({ apiKey: 'sk-test-key', transportMode: 'direct', model: CLAUDE_DEFAULT_MODEL, prompt: 'hello', maxTokens: 100, temperature: 0.7 });
    ok(capturedUrl === 'https://api.anthropic.com/v1/messages', `direct mode should call the Anthropic API URL, got "${capturedUrl}"`);
    ok(capturedInit.headers['x-api-key'] === 'sk-test-key', 'direct mode should send the API key in x-api-key header');
    ok(capturedInit.headers['anthropic-dangerous-direct-browser-access'] === 'true', 'direct mode should send the browser-access header Anthropic requires');
    const body = JSON.parse(capturedInit.body);
    ok(body.model === CLAUDE_DEFAULT_MODEL, 'request body should carry the requested model');
    ok(body.messages[0].content === 'hello', 'request body should carry the prompt as the user message content');

    capturedUrl = null; capturedInit = null;
    await callClaude({ apiKey: '', transportMode: 'proxy', model: CLAUDE_DEFAULT_MODEL, prompt: 'hello', maxTokens: 100 });
    ok(capturedUrl === 'http://127.0.0.1:8787/v1/messages', `proxy mode should call the local proxy URL, got "${capturedUrl}"`);
    ok(!('x-api-key' in capturedInit.headers), 'proxy mode should NOT send an x-api-key header (the proxy holds the key, not the browser)');
  } finally {
    globalThis.fetch = originalFetch;
  }
  console.log('  callClaude request shape: correct URL/headers/body for both direct and proxy transport modes.');
}

/* 3. callClaude ERROR HANDLING — a non-ok HTTP response should throw a
 *    readable error, not return garbage or throw an unhandled type error. */
{
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 401, text: async () => 'invalid x-api-key' });
  let threw = false;
  try {
    await callClaude({ apiKey: 'bad-key', transportMode: 'direct', model: CLAUDE_DEFAULT_MODEL, prompt: 'x', maxTokens: 10 });
  } catch (e) {
    threw = true;
    ok(/401/.test(e.message), `error message should include the HTTP status, got: "${e.message}"`);
  } finally {
    globalThis.fetch = originalFetch;
  }
  ok(threw, 'a non-ok HTTP response should throw');
  console.log('  callClaude error handling: non-ok HTTP response throws a readable error.');
}

/* 4. makeClaudeTransport ADAPTER — produces a function matching the exact
 *    shape runLyricEngine's `transport` argument expects. */
{
  const originalFetch = globalThis.fetch;
  let capturedBody = null;
  globalThis.fetch = async (url, init) => { capturedBody = JSON.parse(init.body); return { ok: true, json: async () => ({ content: [{ text: 'ok' }] }) }; };
  try {
    const transport = makeClaudeTransport({ apiKey: 'sk-test', transportMode: 'direct' });
    ok(typeof transport === 'function', 'makeClaudeTransport should return a function');
    const result = await transport({ prompt: 'test prompt', model: 'claude-sonnet-5', temperature: 0.5, maxTokens: 200 });
    ok(result === 'ok', `transport should return the response text, got "${result}"`);
    ok(capturedBody.model === 'claude-sonnet-5', 'transport should forward the requested model through to the request body');
  } finally {
    globalThis.fetch = originalFetch;
  }
  console.log('  makeClaudeTransport: adapts to the exact {prompt,model,temperature,maxTokens}->string shape runLyricEngine expects.');
}

/* 5. buildLiveLyricRequest — P8 GAP GUARD: refuses non-atom engines clearly. */
{
  const S = initState();
  syncEngineDefaults(S, 'Delerium'); // a resolver engine — no DNA extractor yet
  let threw = false;
  try { buildLiveLyricRequest(S); }
  catch (e) { threw = true; ok(/only .atom. engines/.test(e.message), `expected the P8-gap error message, got: "${e.message}"`); }
  ok(threw, 'buildLiveLyricRequest should refuse a resolver engine (Delerium) with a clear error, not silently build something wrong');

  syncEngineDefaults(S, 'Balearic'); // a legacy engine — also no DNA extractor yet
  threw = false;
  try { buildLiveLyricRequest(S); } catch (e) { threw = true; }
  ok(threw, 'buildLiveLyricRequest should also refuse a legacy engine (Balearic)');
  console.log('  P8 gap guard: buildLiveLyricRequest refuses resolver/legacy engines with a clear error instead of producing something wrong.');
}

/* 6. buildLiveLyricRequest — answers threading, including the title
 *    default-vs-override behaviour John asked about. Explicit setProvider
 *    here since Gemini is now the default (John, 2026-08-13) — this test is
 *    about answers threading, which is provider-agnostic, so the choice
 *    doesn't matter EXCEPT that it must be set explicitly rather than
 *    relying on an assumed default that changed. */
{
  const S = initState();
  syncEngineDefaults(S, 'Balearic Atom'); // an atom engine — DNA extractor exists
  setProvider(S, 'claude');
  setLyricInputs(S, { subject: 'a long drive at dawn', lineLength: '6-8 syllables', rhymeDensity: 'Heavy' });
  setClaudeSettings(S, { apiKey: 'sk-test' });

  const noTitle = buildLiveLyricRequest(S);
  ok(!('song.title' in noTitle.answers), 'omitting a title should NOT set song.title at all (LLM invents one, per the prompt\u2019s own fallback instruction)');
  ok(noTitle.answers['song.subject'] === 'a long drive at dawn', 'subject should thread through to answers');
  ok(noTitle.answers['song.lineLength'] === '6-8 syllables', 'lineLength should thread through to answers');
  ok(noTitle.answers['song.rhymeDensity'] === 'Heavy', 'rhymeDensity should thread through to answers');

  setLyricInputs(S, { title: 'Neon Coastline' });
  const withTitle = buildLiveLyricRequest(S);
  ok(withTitle.answers['song.title'] === 'Neon Coastline', 'a user-supplied title should thread through to answers as an override');

  ok(withTitle.structure && withTitle.structure.songType === 'vocal', 'buildLiveLyricRequest should carry the resolved structure (Phase 3/4 wiring) alongside the answers');
  ok(typeof withTitle.transport === 'function', 'buildLiveLyricRequest should build a real transport function');
  console.log('  answers threading: subject/lineLength/rhymeDensity always present; title present only when the user supplied one.');
}

/* 7. generateLyricsLive — END TO END with an injected fake transport (no
 *    network). Proves the full P7 chain actually connects: DNA -> CIL ->
 *    structure -> brief -> prompt -> transport -> quality gate. */
{
  const S = initState();
  syncEngineDefaults(S, 'Balearic Atom');
  setLyricInputs(S, { subject: 'a long drive at dawn', lineLength: '6-8 syllables', rhymeDensity: 'Moderate' });
  // provider left at its default (Gemini, John 2026-08-13) deliberately —
  // this test uses transportOverride, so which provider's settings are on
  // state doesn't matter; the point is proving the CHAIN, not the provider.

  const goodLyrics = '[Verse 1]\ncat dog love dusk fire night\ncat dog love dusk fire light\n\n[Chorus]\ncat dog love dusk fire moon\ncat dog love dusk fire star';
  let calls = 0;
  const fakeTransport = async () => { calls++; return JSON.stringify({ title: 'Test Title', lyrics: goodLyrics }); };

  const result = await generateLyricsLive(S, fakeTransport);
  ok(calls >= 1, 'generateLyricsLive should have invoked the transport at least once');
  ok(result.instrumental === false, 'a vocal song type with a fake transport should produce a non-instrumental result');
  ok(!!result.quality, 'the result should carry a quality object from the independent validator');
  ok(result.brief && result.brief.subject === 'a long drive at dawn', 'the result\u2019s brief should reflect the subject that was set on state');

  // instrumental short-circuit should skip the transport entirely
  const { setSongType } = await import('./js/state.js');
  setSongType(S, 'instrumental');
  let instCalls = 0;
  const instTransport = async () => { instCalls++; return '{}'; };
  const instResult = await generateLyricsLive(S, instTransport);
  ok(instResult.instrumental === true && instResult.lyrics === '[Instrumental]', 'instrumental song type should short-circuit generateLyricsLive without calling the transport');
  ok(instCalls === 0, 'the transport should NOT be called at all for an instrumental song type');

  console.log('  generateLyricsLive end-to-end: fake-transport vocal generation connects the full P7 chain; instrumental short-circuit skips the transport entirely.');
}

/* 9. GEMINI GUARD RAILS + REQUEST SHAPE — mirrors tests 1-3 (the Claude
 *    equivalent) so both providers get the same level of proof. */
{
  let threw = false;
  try { await callGemini({ apiKey: '', transportMode: 'direct', model: GEMINI_DEFAULT_MODEL, prompt: 'x', maxTokens: 10 }); }
  catch (e) { threw = true; ok(/Missing Gemini API key/.test(e.message), `expected a clear missing-key error, got: "${e.message}"`); }
  ok(threw, 'callGemini with an empty key in direct mode should throw, not silently proceed');

  const originalFetch = globalThis.fetch;
  let capturedUrl = null, capturedInit = null;
  globalThis.fetch = async (url, init) => { capturedUrl = url; capturedInit = init; return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'mock response' }] } }] }) }; };
  try {
    await callGemini({ apiKey: 'AIza-test-key', transportMode: 'direct', model: GEMINI_DEFAULT_MODEL, prompt: 'hello', maxTokens: 100, temperature: 0.7 });
    ok(capturedUrl === `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_DEFAULT_MODEL}:generateContent`, `direct mode should call the Gemini generateContent URL for the requested model, got "${capturedUrl}"`);
    ok(capturedInit.headers['x-goog-api-key'] === 'AIza-test-key', 'direct mode should send the API key in x-goog-api-key header');
    const body = JSON.parse(capturedInit.body);
    ok(body.contents[0].parts[0].text === 'hello', 'request body should carry the prompt in contents[0].parts[0].text');
    ok(body.generationConfig.maxOutputTokens === 100, 'request body should carry maxTokens as generationConfig.maxOutputTokens');
  } finally {
    globalThis.fetch = originalFetch;
  }
  console.log('  Gemini guard rail + request shape: missing key throws before any call; correct URL/header/body for direct mode.');
}

/* 10. GEMINI ERROR HANDLING — non-ok HTTP and an empty/blocked candidate both
 *     surface as readable errors, not silent failures or crashes. */
{
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 403, text: async () => 'API key not valid' });
  let threw = false;
  try { await callGemini({ apiKey: 'bad-key', transportMode: 'direct', model: GEMINI_DEFAULT_MODEL, prompt: 'x', maxTokens: 10 }); }
  catch (e) { threw = true; ok(/403/.test(e.message), `error message should include the HTTP status, got: "${e.message}"`); }
  finally { globalThis.fetch = originalFetch; }
  ok(threw, 'a non-ok HTTP response should throw');

  globalThis.fetch = async () => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [] }, finishReason: 'SAFETY' }] }) });
  threw = false;
  try { await callGemini({ apiKey: 'sk-test', transportMode: 'direct', model: GEMINI_DEFAULT_MODEL, prompt: 'x', maxTokens: 10 }); }
  catch (e) { threw = true; ok(/SAFETY/.test(e.message), `a safety-blocked empty candidate should surface the finishReason, got: "${e.message}"`); }
  finally { globalThis.fetch = originalFetch; }
  ok(threw, 'an empty candidate (e.g. safety-blocked) should throw with the finishReason, not silently return empty text');
  console.log('  Gemini error handling: non-ok HTTP and safety-blocked empty candidates both throw readable errors.');
}

/* 11. PROVIDER SWITCHING — buildLiveLyricRequest picks the transport based
 *     on S.provider, and each provider's settings persist independently
 *     across a switch (entering a Claude key doesn't get wiped by then
 *     entering a Gemini key, or vice versa). */
{
  const S = initState();
  syncEngineDefaults(S, 'Balearic Atom');
  ok(S.provider === 'gemini', `default provider should be 'gemini' (John, 2026-08-13), got "${S.provider}"`);

  setGeminiSettings(S, { apiKey: 'AIza-gemini-key', model: 'gemini-3.1-pro-preview' });
  const geminiReq = buildLiveLyricRequest(S);
  ok(geminiReq.provider === 'gemini', 'buildLiveLyricRequest should report provider=gemini when S.provider is gemini');
  ok(geminiReq.model === 'gemini-3.1-pro-preview', 'buildLiveLyricRequest should use the Gemini model from S.gemini.model');

  setProvider(S, 'claude');
  setClaudeSettings(S, { apiKey: 'sk-claude-key', model: 'claude-sonnet-5' });
  const claudeReq = buildLiveLyricRequest(S);
  ok(claudeReq.provider === 'claude', 'buildLiveLyricRequest should report provider=claude after setProvider(S, "claude")');
  ok(claudeReq.model === 'claude-sonnet-5', 'buildLiveLyricRequest should use the Claude model from S.claude.model');

  // switching back — the Gemini settings entered earlier must still be there
  setProvider(S, 'gemini');
  ok(S.gemini.apiKey === 'AIza-gemini-key', 'switching provider away and back should not lose the previously-entered Gemini key');
  ok(S.claude.apiKey === 'sk-claude-key', 'the Claude key entered while on the Claude provider should persist even while Gemini is active');
  console.log('  provider switching: transport selection follows S.provider; each provider\u2019s settings persist independently across switches.');
}

/* 12. MODEL LISTS — sanity check both ported/authored model lists. */
{
  ok(CLAUDE_MODELS.includes(CLAUDE_DEFAULT_MODEL), 'CLAUDE_DEFAULT_MODEL should be one of the listed CLAUDE_MODELS');
  ok(CLAUDE_MODELS.length >= 3, 'expected at least 3 current Claude model options');
  ok(GEMINI_MODELS.includes(GEMINI_DEFAULT_MODEL), 'GEMINI_DEFAULT_MODEL should be one of the listed GEMINI_MODELS');
  ok(GEMINI_MODELS.length >= 2, 'expected at least 2 current Gemini model options');
  console.log(`  model lists: ${CLAUDE_MODELS.length} Claude models (default "${CLAUDE_DEFAULT_MODEL}"), ${GEMINI_MODELS.length} Gemini models (default "${GEMINI_DEFAULT_MODEL}").`);
}

console.log(`validate-live-lyric: ${checks} checks, ${fails} failures.`);
if (fails) process.exit(1);

/* ==========================================================================
 * validate-lyric-brief.mjs — the lyric-brief control panel + the two-step
 * grounded source flow (John, 2026-08-17).
 *
 * WHY THIS EXISTS. The failure this guards against is not a crash — it is a
 * control that LOOKS wired and isn't. That is the exact state the panel was
 * in before this build: CONTROL_OPTIONS carried hookStyle, imageryDensity,
 * narrativeClarity, vocalFraming and eraBias vocabulary, nothing read them
 * from answers, and nothing rendered them to the model. Selecting one changed
 * the prompt by zero characters and no test noticed, because every existing
 * validator asserts on things that are present rather than on things that
 * should have changed.
 *
 * So the central check here is DIFFERENTIAL: change one control, assert the
 * prompt actually changes. A control that fails that check is decoration.
 * ========================================================================*/
import { assembleLyricBrief, buildLyricPrompt } from './core/lyric.js';
import {
  CONTROL_OPTIONS, SOURCE_TYPE_GUIDANCE, THEME_LENS_GUIDANCE, PERSPECTIVE_GUIDANCE,
  HOOK_STYLE_GUIDANCE, IMAGERY_DENSITY_GUIDANCE, NARRATIVE_CLARITY_GUIDANCE,
  VOCAL_FRAMING_GUIDANCE, ERA_BIAS_GUIDANCE, DELIVERY_STYLE_GUIDANCE,
} from './core/lyric-controls.js';
import {
  RESEARCHABLE_SOURCE_TYPES, isResearchableSourceType, needsSourceResearch,
  buildSourceResearchPrompt, parseSourceResearch, researchToSubject, runSourceResearch,
} from './core/source-research.js';
import { initState, syncEngineDefaults, setSongType } from './js/state.js';
import { buildLiveLyricRequest, generateLyricsLive } from './js/generate.js';

let failures = 0, checks = 0;
const bad = (m) => { console.error(`  FAIL: ${m}`); failures++; };
const ok = (cond, m) => { if (!cond) bad(m); };

// Minimal DNA/CIL stand-ins. This module tests BRIEF + PROMPT assembly, which
// is pure — a real engine build is exercised by the end-to-end section below.
const DNA = {
  meta: { characterId: 'sunlit-mediterranean' },
  identity: { genreAnchor: 'balearic downtempo', subgenre: 'sunlit-mediterranean' },
  harmony: { keyMode: 'A minor' }, tempo: { spec: '96-104 BPM' }, influences: [],
};
const CIL = { fields: { 'vocal.mode': { value: 'vocal' } }, residue: [] };
const STRUCT = { songType: 'vocal', sections: ['Verse 1', 'Chorus', 'Verse 2', 'Chorus'], presetLabel: 'test' };

const promptFor = (answers) =>
  buildLyricPrompt(assembleLyricBrief(DNA, CIL, { 'vocal.mode': 'vocal', ...answers }, STRUCT)).prompt;

/* ---- 1: TV series is present and researchable ------------------------- */
{
  ok(CONTROL_OPTIONS.sourceType.includes('TV series'), "'TV series' missing from CONTROL_OPTIONS.sourceType");
  ok(isResearchableSourceType('TV series'), "'TV series' must be researchable");
  ok(!!SOURCE_TYPE_GUIDANCE['TV series'], "'TV series' has no guidance string");
  // Every source type must have guidance, or a user selection silently hands
  // the model an undefined term.
  for (const t of CONTROL_OPTIONS.sourceType)
    ok(!!SOURCE_TYPE_GUIDANCE[t], `source type "${t}" has no guidance string`);
  checks++;
  console.log(`  source types: ${CONTROL_OPTIONS.sourceType.length} options, all with guidance; TV series present and researchable.`);
}

/* ---- 2: the research GATE ---------------------------------------------
 * Both halves matter. A researchable type with no subject must NOT fire (it
 * would research an unnamed work and hallucinate); a non-researchable type
 * must never fire regardless of subject. */
{
  ok(needsSourceResearch('Movie', 'Blade Runner'), 'Movie + subject should trigger research');
  ok(needsSourceResearch('TV series', 'Twin Peaks'), 'TV series + subject should trigger research');
  ok(!needsSourceResearch('Movie', ''), 'Movie with an empty subject must not trigger research');
  ok(!needsSourceResearch('Movie', '   '), 'Movie with a whitespace subject must not trigger research');
  ok(!needsSourceResearch('Original concept', 'anything'), 'Original concept must never trigger research');
  ok(!needsSourceResearch('Personal memory', 'my grandmother'), 'Personal memory must never trigger research');
  for (const t of RESEARCHABLE_SOURCE_TYPES)
    ok(CONTROL_OPTIONS.sourceType.includes(t), `researchable type "${t}" is not a selectable source type`);
  checks++;
  console.log(`  research gate: ${RESEARCHABLE_SOURCE_TYPES.length} researchable types, 2 excluded, empty-subject guard holds.`);
}

/* ---- 3: the research prompt's copyright guardrail ---------------------
 * Grounding means this call really fetches source material, so the no-
 * reproduction instruction is load-bearing, not boilerplate. A verbatim
 * passage arriving here would be laundered into the lyric call where nothing
 * downstream would recognise it. */
{
  const p = buildSourceResearchPrompt({ sourceType: 'Movie', subject: 'Blade Runner' });
  ok(/own words/i.test(p), 'research prompt must require the model to write in its own words');
  ok(/do not quote/i.test(p), 'research prompt must forbid quoting');
  ok(/song lyrics/i.test(p), 'research prompt must explicitly forbid reproducing song lyrics');
  ok(/web search/i.test(p), 'research prompt must instruct the model to use web search');
  ok(p.includes('Blade Runner'), 'research prompt must contain the subject');
  ok(/confidence/i.test(p), 'research prompt must ask for a confidence rating');
  ok(/never fabricate/i.test(p), 'research prompt must forbid fabricating facts to fill a gap');
  // Per-type framing must actually differ, or the type control is cosmetic.
  const movie = buildSourceResearchPrompt({ sourceType: 'Movie', subject: 'X' });
  const figure = buildSourceResearchPrompt({ sourceType: 'Historical figure', subject: 'X' });
  ok(movie !== figure, 'research prompt must differ by source type');
  checks++;
  console.log('  research prompt: copyright guardrail, grounding instruction and per-type framing all present.');
}

/* ---- 4: research parsing survives grounded chatter ---------------------
 * A search-tool response is chattier than a plain one and can wrap the JSON
 * in citation prose even when the prompt forbids it. Failing the whole
 * pre-pass on a stray sentence would be a self-inflicted outage. */
{
  const clean = parseSourceResearch('{"premise":"a","identified":"A (1982)"}');
  ok(clean && clean.premise === 'a', 'clean JSON must parse');
  const fenced = parseSourceResearch('```json\n{"premise":"b"}\n```');
  ok(fenced && fenced.premise === 'b', 'fenced JSON must parse');
  const chatty = parseSourceResearch('Based on my search:\n{"premise":"c"}\nSources: [1]');
  ok(chatty && chatty.premise === 'c', 'JSON wrapped in citation prose must still parse');
  ok(parseSourceResearch('no json at all') === null, 'unparseable input must return null, not throw');
  ok(parseSourceResearch('') === null, 'empty input must return null');
  checks++;
  console.log('  research parsing: clean / fenced / chatty / unparseable all handled.');
}

/* ---- 5: researchToSubject folds the premise into ONE subject block -----
 * The premise replaces song.subject rather than arriving as a parallel field,
 * so every downstream consumer (repair prompt, validator, batch builder)
 * needs no change. This asserts that contract. */
{
  const s = researchToSubject({
    identified: 'Blade Runner (1982)', premise: 'A blade runner hunts replicants.',
    conflict: 'Empathy versus duty.', emotionalCore: 'Melancholy.', setting: 'Los Angeles, 2019.',
  }, 'Blade Runner');
  ok(s.includes('Blade Runner (1982)'), 'subject block must carry the identified work');
  ok(s.includes('hunts replicants'), 'subject block must carry the premise');
  ok(s.includes('Empathy versus duty'), 'subject block must carry the conflict');
  ok(researchToSubject(null, 'fallback') === 'fallback', 'null research must fall back to the raw subject');
  ok(researchToSubject({ identified: 'x' }, 'fallback') === 'fallback', 'research with no premise must fall back');
  checks++;
  console.log('  researchToSubject: premise folded into a single subject block; falls back cleanly.');
}

/* ---- 6: runSourceResearch FAILS SOFT ----------------------------------
 * A dead search tool must degrade the flow to its pre-2026-08-17 behaviour,
 * never take a lyric generation down. Also asserts grounded:true is actually
 * passed — the whole point of John's direction, and invisible if it silently
 * stopped being set. */
{
  let sawGrounded = null, sawTemp = null;
  await runSourceResearch({
    sourceType: 'Movie', subject: 'Blade Runner',
    transport: async ({ grounded, temperature }) => {
      sawGrounded = grounded; sawTemp = temperature;
      return '{"premise":"p","identified":"i","confidence":"high"}';
    },
  });
  ok(sawGrounded === true, 'the research call MUST set grounded:true');
  ok(sawTemp === 0, 'the research call must use temperature 0 (retrieval, not creativity)');

  const thrown = await runSourceResearch({
    sourceType: 'Movie', subject: 'X',
    transport: async () => { throw new Error('search unavailable'); },
  });
  ok(thrown.researched === false && thrown.reason === 'transport-failed',
    'a failing transport must fail soft, not throw');
  ok(thrown.subject === 'X', 'a failed research must return the original subject unchanged');

  const junk = await runSourceResearch({
    sourceType: 'Movie', subject: 'X', transport: async () => 'not json',
  });
  ok(junk.researched === false && junk.reason === 'unparseable-response',
    'an unparseable response must fail soft');

  const skipped = await runSourceResearch({
    sourceType: 'Original concept', subject: 'X',
    transport: async () => { throw new Error('should never be called'); },
  });
  ok(skipped.researched === false && skipped.reason === 'not-a-researchable-source',
    'a non-researchable type must skip the call entirely');
  checks++;
  console.log('  runSourceResearch: grounded:true asserted, temp 0, 3 soft-failure paths, gate short-circuits.');
}

/* ---- 7: THE DIFFERENTIAL CHECK — every control changes the prompt ------
 * The core test. For each control, build a prompt at its default and at a
 * different value, and require the two to differ. This is what would have
 * caught the pre-2026-08-17 state, where the vocabulary existed and the
 * prompt was byte-identical no matter what was selected. */
{
  const CONTROLS = [
    ['song.sourceType',       'Original concept',          'Movie',                       SOURCE_TYPE_GUIDANCE],
    ['song.themeLens',        'Inspired by source',        'Dark reinterpretation',       THEME_LENS_GUIDANCE],
    ['song.perspective',      'First person',              'Collective voice',            PERSPECTIVE_GUIDANCE],
    ['song.hookStyle',        'Subtle and emotional',      'Anthemic',                    HOOK_STYLE_GUIDANCE],
    ['song.imageryDensity',   'Moderate',                  'Symbolic',                    IMAGERY_DENSITY_GUIDANCE],
    ['song.narrativeClarity', 'Balanced',                  'Emotional fragments',         NARRATIVE_CLARITY_GUIDANCE],
    ['song.vocalFraming',     'Lead vocal centered',       'Duet',                        VOCAL_FRAMING_GUIDANCE],
    ['song.deliveryStyle',    'Controlled and intimate',   'Chanted',                     DELIVERY_STYLE_GUIDANCE],
    ['song.eraBias',          'Timeless',                  '1980s',                       ERA_BIAS_GUIDANCE],
    ['song.languageStyle',    'Poetic',                    'Minimal',                     null],
    ['song.lineLength',       'Flexible',                  '6-8 syllables',               null],
    ['song.rhymeDensity',     'Moderate',                  'Heavy',                       null],
  ];
  for (const [field, defVal, altVal, guidance] of CONTROLS) {
    const a = promptFor({ [field]: defVal });
    const b = promptFor({ [field]: altVal });
    ok(a !== b, `${field}: changing the value did not change the prompt — the control is inert`);
    ok(b.includes(altVal), `${field}: selected value "${altVal}" does not appear in the prompt`);
    if (guidance) {
      ok(!!guidance[altVal], `${field}: "${altVal}" has no guidance string`);
      ok(b.includes(guidance[altVal]), `${field}: guidance for "${altVal}" not rendered into the prompt`);
      // Only the SELECTED option's guidance should render — handing the model
      // every definition dilutes the one that was chosen.
      ok(!b.includes(guidance[defVal]) || defVal === altVal,
        `${field}: unselected option "${defVal}"'s guidance leaked into the prompt`);
    }
  }
  checks++;
  console.log(`  differential: all ${CONTROLS.length} controls measurably change the prompt, selected guidance only.`);
}

/* ---- 8: the foreign-language layer is OFF by default ------------------
 * An always-present "layer: none" stanza spends prompt attention on a feature
 * the model must ignore, and repeatedly names a language it must not use. */
{
  const off = promptFor({});
  // Matched on the ACTIVE marker specifically: buildLyricPrompt's standing
  // rule line ("Lyrics must be mainly English unless a foreign-language layer
  // is requested") legitimately contains the phrase and must stay.
  ok(!/Foreign-language layer \(ACTIVE\)/.test(off), 'the language layer must render nothing when disabled');
  ok(!/French/.test(off), 'a disabled language layer must not name a language');
  ok(!/Placement:/.test(off), 'a disabled language layer must not render its fields');

  const on = promptFor({
    'song.languageLayer.enabled': true, 'song.languageLayer.language': 'Latin',
    'song.languageLayer.mode': 'Sacred / chant layer',
    'song.languageLayer.placement': 'Intro texture', 'song.languageLayer.intensity': 'Prominent',
  });
  ok(/Foreign-language layer \(ACTIVE\): Latin/.test(on), 'an enabled layer must render with its language');
  ok(on.includes('Sacred / chant layer'), 'the layer mode must reach the prompt');
  ok(on.includes('Intro texture'), 'the layer placement must reach the prompt');
  ok(on.includes('Prominent'), 'the layer intensity must reach the prompt');
  ok(/do not translate/i.test(on), 'the layer must forbid translations in the output');
  checks++;
  console.log('  language layer: silent when off, all four fields reach the prompt when on.');
}

/* ---- 9: superseded controls stay unexposed ----------------------------
 * The 2026-08-13 open question. genreFamily duplicates DNA.identity.genreAnchor
 * (one-source-of-truth) and structureCategory duplicates the structure-first
 * pipeline's preset choice. Both remain as vocabulary; neither may reach the
 * prompt as a user-chosen control. */
{
  const p = promptFor({ 'song.genreFamily': 'Rock', 'song.structureCategory': 'Experimental' });
  ok(!p.includes('Genre family'), 'genreFamily must not be exposed — genre is owned by the style engine');
  ok(!p.includes('Structure category'), 'structureCategory must not be exposed — superseded by structure-first');
  ok(!p.includes('Rock'), 'a genreFamily answer must not leak into the prompt');
  ok(p.includes('balearic downtempo'), 'the genre anchor must still come from DNA');
  checks++;
  console.log('  superseded controls: genreFamily and structureCategory stay out of the prompt; DNA genre survives.');
}

/* ---- 10: research provenance is recorded on the brief -----------------  */
{
  const brief = assembleLyricBrief(DNA, CIL, {
    'vocal.mode': 'vocal', 'song.sourceResearched': true,
    'song.sourceIdentified': 'Blade Runner (1982)', 'song.sourceConfidence': 'high',
  }, STRUCT);
  ok(brief.sourceResearched === true, 'brief must record that research ran');
  ok(brief.sourceIdentified === 'Blade Runner (1982)', 'brief must record the identified work');
  ok(brief.sourceConfidence === 'high', 'brief must record confidence');
  const plain = assembleLyricBrief(DNA, CIL, { 'vocal.mode': 'vocal' }, STRUCT);
  ok(plain.sourceResearched === false, 'an unresearched brief must record false, not undefined');
  ok(plain.languageLayer === null, 'an unconfigured language layer must be null, not a stub object');
  checks++;
  console.log('  provenance: research state recorded on the brief in both directions.');
}

/* ---- 11: END TO END through the real state + generate() path -----------
 * Everything above tests pure assembly. This drives the ACTUAL entry point
 * the UI calls, with a fake transport, and asserts the two-step flow really
 * is two calls in the right order with the right grounding on each. Bundle-
 * and wiring-level bugs are invisible to pure-function tests — the same
 * lesson that produced validate-ui-boot.mjs. */
{
  const S = initState();
  syncEngineDefaults(S, 'Balearic Atom');
  S.songType = 'vocal';
  S.lyric.sourceType = 'TV series';
  S.lyric.subject = 'Twin Peaks';
  S.lyric.hookStyle = 'Anthemic';
  S.lyric.languageLayer = { enabled: true, language: 'French', mode: 'Chorus line', placement: 'Bridge only', intensity: 'Light' };

  const calls = [];
  const fake = async ({ prompt, grounded }) => {
    calls.push({ grounded: !!grounded, prompt });
    if (calls.length === 1) return '{"identified":"Twin Peaks (1990)","premise":"A federal agent investigates a death in a small town.","conflict":"Surface versus rot.","emotionalCore":"Dread.","setting":"Washington State, 1989.","confidence":"high"}';
    return JSON.stringify({
      title: 'T', themeBrief: 'b',
      lyrics: '[Verse 1]\nline one here\n\n[Chorus]\nline two here\n\n[Verse 2]\nline three here\n\n[Chorus]\nline four here',
      lyricMetaTags: '', validation: { score: 90, passed: true, summary: '', issues: [], fixesApplied: [] },
    });
  };

  const out = await generateLyricsLive(S, fake);
  ok(calls.length >= 2, `expected a research call then a lyric call, got ${calls.length} call(s)`);
  ok(calls[0].grounded === true, 'call 1 (research) must be grounded');
  ok(calls[1].grounded !== true, 'call 2 (lyrics) must NOT be grounded — grounding there invites echoing existing songs');
  ok(calls[0].prompt.includes('Twin Peaks'), 'the research call must carry the named work');
  ok(calls[1].prompt.includes('federal agent'), 'the researched premise must reach the lyric call');
  ok(calls[1].prompt.includes('Surface versus rot'), 'the researched conflict must reach the lyric call');
  ok(calls[1].prompt.includes('Anthemic'), 'a Tier 2 control set in real state must reach the lyric call');
  ok(/Foreign-language layer \(ACTIVE\): French/.test(calls[1].prompt), 'the language layer set in real state must reach the lyric call');
  ok(out.sourceResearch && out.sourceResearch.researched === true, 'the result must report that research ran');

  // Exactly ONE grounded call per generation, never more. Total call count is
  // deliberately not asserted here: the lyric step legitimately retries up to
  // MAX_LYRIC_ATTEMPTS through the quality gate, so counting all calls would
  // make this test a hostage to the repair loop. What must hold is that the
  // research step fires once and the retries are never grounded.
  ok(calls.filter(c => c.grounded).length === 1,
    `exactly one grounded call expected, saw ${calls.filter(c => c.grounded).length}`);

  // Instrumental builds must not spend a search call at all. setSongType() is
  // used rather than assigning S.songType directly: the structure preset is
  // type-specific, and a raw assignment leaves a vocal preset selected, which
  // then wins over songType downstream (structure.songType is authoritative
  // in assembleLyricBrief). Writing the field by hand here would silently
  // test a vocal build labelled instrumental.
  const S2 = initState();
  syncEngineDefaults(S2, 'Balearic Atom');
  setSongType(S2, 'instrumental');
  S2.lyric.sourceType = 'Movie';
  S2.lyric.subject = 'Blade Runner';
  let called = 0;
  await generateLyricsLive(S2, async () => { called++; return '{}'; });
  ok(called === 0, `an instrumental build must make no LLM call at all, made ${called}`);

  // A non-researchable type must never make a grounded call.
  const S3 = initState();
  syncEngineDefaults(S3, 'Balearic Atom');
  setSongType(S3, 'vocal');
  S3.lyric.sourceType = 'Original concept';
  S3.lyric.subject = 'a harbour at night';
  const c3 = [];
  await generateLyricsLive(S3, async ({ grounded }) => {
    c3.push(!!grounded);
    return JSON.stringify({ title: 'T', lyrics: '[Verse 1]\na\n\n[Chorus]\nb\n\n[Verse 2]\nc\n\n[Chorus]\nd', validation: { score: 90, passed: true, issues: [] } });
  });
  ok(c3.length >= 1, 'Original concept must still make the lyric call');
  ok(c3.every(g => g === false), 'Original concept must make NO grounded call');
  checks++;
  console.log(`  end to end: researchable type = 1 grounded + lyric call(s); Original concept = 0 grounded; instrumental = 0 calls.`);
}

console.log(`validate-lyric-brief: ${checks} check groups, ${failures} failures.`);
process.exit(failures ? 1 : 0);

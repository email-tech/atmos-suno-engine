/* validate-lyric-quality.mjs — headless proof for core/lyric-validator.js (the
 * deterministic quality gate) and the round-robin repair loop in
 * core/lyric.js's runLyricEngine().
 *
 * John, 2026-08-12: 85% threshold, round-robin repair on failure, heuristic-
 * only (no phonetic dictionary). This harness proves:
 *   1. Syllable counter and rhyme detector accuracy against hand-picked
 *      fixtures (the same measurement used to justify the ~90%/~92% figures
 *      quoted to John).
 *   2. Each individual check (section labels, syllables, rhyme, density) in
 *      isolation, against fixtures with hand-computed expected results.
 *   3. validateLyrics() composite scoring: a hard section-label gate that
 *      short-circuits to score 0 regardless of everything else, and a
 *      weighted composite otherwise.
 *   4. The round-robin loop itself, via an injected fake transport: retries
 *      on failure, stops on success, respects the MAX_LYRIC_ATTEMPTS cap,
 *      returns the best-scoring attempt when the threshold is never met, and
 *      does NOT retry at all when repair is false/omitted.
 *   5. buildRepairPrompt() is seeded with the independent validator's
 *      specific issues, not a generic message.
 *
 * Run from repo root: node validate-lyric-quality.mjs
 */
import {
  countSyllables, lineSyllables, rhymeKey, wordsRhyme,
  parseLineLengthSpec, parseRhymeDensitySpec, parseLyricSections,
  checkSectionLabels, checkSyllables, checkRhymeDensity, checkDensity,
  validateLyrics, QUALITY_THRESHOLD, MAX_LYRIC_ATTEMPTS,
} from './core/lyric-validator.js';
import { buildRepairPrompt, runLyricEngine } from './core/lyric.js';

let checks = 0, fails = 0;
const bad = (m) => { fails++; console.log('  FAIL: ' + m); };
const ok = (c, m) => { checks++; if (!c) bad(m); };

/* 1. SYLLABLE COUNTER ACCURACY — the same fixture used during development to
 *    justify the ~90% figure quoted to John, INCLUDING the known-hard cases
 *    (vowel hiatus, syllabic consonants) that were disclosed as limitations
 *    rather than hidden. A regression threshold below is set to the honest
 *    baseline, not to a cherry-picked easier subset. */
{
  const fixture = [
    ['cat', 1], ['dog', 1], ['love', 1], ['coastline', 2], ['dusk', 1],
    ['beautiful', 3], ['syllable', 3], ['generate', 3], ['music', 2],
    ['through', 1], ['though', 1], ['cough', 1], ['tough', 1],
    ['table', 2], ['little', 2], ['purple', 2], ['handle', 2],
    ['fire', 1], ['desire', 2], ['hour', 1],
    ['mountain', 2], ['ocean', 2], ['whisper', 2], ['midnight', 2],
    ['loving', 2], ['loved', 1], ['dancing', 2], ['dancer', 2],
    ['heart', 1], ['hearts', 1], ['broken', 2], ['golden', 2], ['silence', 2],
    ['forever', 3], ['remember', 3], ['tonight', 2], ['tomorrow', 3],
    ['drowning', 2], ['waves', 1], ['shadow', 2], ['light', 1], ['lights', 1],
    // known-hard cases (disclosed limitation, not hidden — see module header)
    ['create', 2], ['created', 3], ['creating', 3], ['rhythm', 2], ['every', 2],
  ];
  let hit = 0;
  for (const [w, expected] of fixture) if (countSyllables(w) === expected) hit++;
  const pct = Math.round(100 * hit / fixture.length);
  ok(pct >= 85, `syllable counter accuracy dropped below 85% (now ${pct}%, ${hit}/${fixture.length}) — heuristic regressed`);
  console.log(`  syllable counter: ${hit}/${fixture.length} correct (${pct}%) — includes disclosed hard cases, not just the easy set.`);
}

/* 2. RHYME DETECTOR ACCURACY — same protection for the rhyme heuristic,
 *    including disclosed hard cases (heart/apart, high/sky — sound-alike
 *    endings with divergent spelling not covered by the normalisation set). */
{
  const shouldRhyme = [
    ['night', 'light'], ['light', 'bright'], ['love', 'above'],
    ['blue', 'true'], ['rain', 'pain'], ['fire', 'desire'], ['down', 'town'],
    ['way', 'stay'], ['gone', 'alone'], ['free', 'sea'],
    ['mind', 'find'], ['dream', 'seem'], ['fall', 'all'], ['star', 'far'],
    ['heart', 'apart'], ['high', 'sky'], // disclosed hard cases
  ];
  const shouldNotRhyme = [
    ['night', 'love'], ['heart', 'blue'], ['fire', 'down'], ['way', 'gone'],
    ['dream', 'star'], ['mind', 'fall'], ['free', 'high'], ['rain', 'fire'],
  ];
  let hit = 0;
  for (const [a, b] of shouldRhyme) if (wordsRhyme(a, b)) hit++;
  for (const [a, b] of shouldNotRhyme) if (!wordsRhyme(a, b)) hit++;
  const total = shouldRhyme.length + shouldNotRhyme.length;
  const pct = Math.round(100 * hit / total);
  ok(pct >= 85, `rhyme detector accuracy dropped below 85% (now ${pct}%, ${hit}/${total}) — heuristic regressed`);
  ok(!wordsRhyme('light', 'light'), 'identical word must not count as a rhyme with itself');
  console.log(`  rhyme detector: ${hit}/${total} correct (${pct}%).`);
}

/* 3. SPEC PARSING — brief.lineLength / brief.rhymeDensity strings resolve to
 *    the correct numeric bands, or null for flexible/qualitative specs that
 *    must not be strictly checked. */
{
  ok(JSON.stringify(parseLineLengthSpec('6-8 syllables')) === JSON.stringify([6, 8]), 'parseLineLengthSpec should extract numeric range from "6-8 syllables"');
  ok(JSON.stringify(parseLineLengthSpec('10-12 syllables')) === JSON.stringify([10, 12]), 'parseLineLengthSpec should extract "10-12 syllables"');
  ok(parseLineLengthSpec('Flexible') === null, 'parseLineLengthSpec("Flexible") should skip strict checking (null)');
  ok(parseLineLengthSpec('Mixed by section') === null, 'parseLineLengthSpec("Mixed by section") should skip strict checking (null)');
  ok(JSON.stringify(parseLineLengthSpec('Short')) === JSON.stringify([4, 7]), 'parseLineLengthSpec("Short") should resolve to a named band');

  ok(JSON.stringify(parseRhymeDensitySpec('Moderate')) === JSON.stringify([35, 65]), 'parseRhymeDensitySpec("Moderate") band');
  ok(parseRhymeDensitySpec('Mixed / natural') === null, 'parseRhymeDensitySpec("Mixed / natural") should skip strict checking (null)');
  ok(parseRhymeDensitySpec('Internal rhyme') === null, 'parseRhymeDensitySpec("Internal rhyme") is not an end-rhyme spec, should skip');
  console.log('  spec parsing: numeric bands and flexible/qualitative skips resolve correctly.');
}

/* 4. SECTION PARSING + LABEL GATE ------------------------------------------ */
{
  const lyrics = '[Verse 1]\ncat dog love dusk fire night\ncat dog love dusk fire light\n\n[Chorus]\ncat dog love dusk fire blue\ncat dog love dusk fire true\n\n[Outro]\ncat dog love dusk fire day';
  const blocks = parseLyricSections(lyrics);
  ok(blocks.length === 3, `expected 3 parsed sections, got ${blocks.length}`);
  ok(blocks[0].label === 'Verse 1' && blocks[1].label === 'Chorus' && blocks[2].label === 'Outro', 'parsed section labels should match the bracketed headers in order');
  ok(blocks[0].lines.length === 2, `expected 2 lines in Verse 1, got ${blocks[0].lines.length}`);

  const good = checkSectionLabels(lyrics, ['Verse 1', 'Chorus', 'Outro']);
  ok(good.ok, 'matching section labels/order should pass checkSectionLabels');

  const bad1 = checkSectionLabels(lyrics, ['Verse 1', 'Bridge', 'Outro']);
  ok(!bad1.ok, 'mismatched section labels should fail checkSectionLabels');

  const bad2 = checkSectionLabels(lyrics, ['Verse 1', 'Chorus']); // wrong count
  ok(!bad2.ok, 'wrong section count should fail checkSectionLabels');
  console.log('  section parsing/labels: correct pass/fail on matching, mismatched, and wrong-count fixtures.');
}

/* 5. SYLLABLE CHECK — hand-built fixture where every line is exactly 6
 *    syllables (six single-syllable words: cat/dog/love/dusk/fire/night —
 *    all independently verified above), against a target band that either
 *    includes or excludes 6. */
{
  const sixSyllableLines = '[Verse 1]\ncat dog love dusk fire night\ncat dog love dusk fire light\n\n[Chorus]\ncat dog love dusk fire blue\ncat dog love dusk fire true';

  const inBand = checkSyllables(sixSyllableLines, '6-8 syllables');
  ok(inBand.score === 100, `all-6-syllable lines against a 6-8 band should score 100, got ${inBand.score}`);
  ok(inBand.ok, 'all lines within a 6-8 band should pass');

  const outOfBand = checkSyllables(sixSyllableLines, '10-12 syllables');
  ok(outOfBand.score === 0, `all-6-syllable lines against a 10-12 band should score 0, got ${outOfBand.score}`);
  ok(!outOfBand.ok, 'all lines outside a 10-12 band should fail');
  ok(outOfBand.violations.length > 0, 'out-of-band lines should be listed as violations');

  const flexible = checkSyllables(sixSyllableLines, 'Flexible');
  ok(flexible.skipped === true && flexible.ok === true, 'a "Flexible" spec should skip the check entirely (always ok)');
  console.log('  syllable check: in-band scores 100, out-of-band scores 0 with violations listed, flexible spec skips.');
}

/* 6. RHYME DENSITY CHECK — Verse 1 ends night/light (confirmed rhyme pair),
 *    Chorus ends blue/true (confirmed rhyme pair) -> 4/4 eligible lines
 *    participate = 100%. Checked against a band that includes and excludes
 *    100%. */
{
  const rhymedLyrics = '[Verse 1]\ncat dog love dusk fire night\ncat dog love dusk fire light\n\n[Chorus]\ncat dog love dusk fire blue\ncat dog love dusk fire true';

  const heavy = checkRhymeDensity(rhymedLyrics, 'Heavy'); // band [55,90]
  ok(heavy.percent === 100, `expected 100% rhyme participation, got ${heavy.percent}%`);
  ok(!heavy.ok, '100% measured against a Heavy [55-90] band should fail (over the top of the band, not just under)');

  const light = checkRhymeDensity(rhymedLyrics, 'Light'); // band [15,45]
  ok(!light.ok, '100% measured against a Light [15-45] band should fail (far over)');

  const unrhymedLyrics = '[Verse 1]\ncat dog love dusk fire moon\ncat dog love dusk fire star\n\n[Chorus]\ncat dog love dusk fire tree\ncat dog love dusk fire hand';
  const noneParticipate = checkRhymeDensity(unrhymedLyrics, 'Minimal, prioritise meaning'); // band [0,25]
  ok(noneParticipate.percent === 0, `expected 0% rhyme participation on deliberately unrhymed lines, got ${noneParticipate.percent}%`);
  ok(noneParticipate.ok, '0% against a Minimal [0-25] band should pass');

  const skip = checkRhymeDensity(rhymedLyrics, 'Mixed / natural');
  ok(skip.skipped === true && skip.ok === true, 'a qualitative rhymeDensity spec should skip the strict check');
  console.log('  rhyme density check: measured percentage correct, band pass/fail correct, qualitative specs skip.');
}

/* 7. DENSITY CHECK — soft signal, never a hard gate on its own. */
{
  const sixSyllableLines = '[Verse 1]\ncat dog love dusk fire night\ncat dog love dusk fire light';
  const midEnergy = checkDensity(sixSyllableLines, 'Mid'); // band [5,11], avg=6 -> inside
  ok(midEnergy.ok, 'average 6 syllables/line should fit the Mid energy band [5,11]');
  const unknownEnergy = checkDensity(sixSyllableLines, 'Not A Real Energy Value');
  ok(unknownEnergy.ok !== undefined, 'unrecognised energy value should fall back to a default band rather than throw');
  console.log('  density check: recognised energy band respected, unknown energy falls back safely.');
}

/* 8. VALIDATE LYRICS — composite scoring + hard gate integration.
 *    Note: a 100%-rhymed fixture is deliberately NOT "good" against a Heavy
 *    [55-90] band — perfect end-rhyme every line is more mechanical than
 *    "heavy" rhyme usually means, so the band correctly rejects it. The good
 *    fixture below mixes a rhymed section with an unrhymed one to land
 *    inside the band on purpose. */
{
  const goodBrief = { structureSections: ['Verse 1', 'Chorus', 'Bridge'], lineLength: '6-8 syllables', rhymeDensity: 'Heavy', energy: 'Mid' };
  const mixedRhyme = '[Verse 1]\ncat dog love dusk fire night\ncat dog love dusk fire light\n\n[Chorus]\ncat dog love dusk fire blue\ncat dog love dusk fire true\n\n[Bridge]\ncat dog love dusk fire moon\ncat dog love dusk fire star';
  const goodResult = validateLyrics(mixedRhyme, goodBrief);
  ok(goodResult.hardFail === null, 'matching section labels should not trigger the hard gate');
  ok(goodResult.score >= 90, `a fixture built to land inside the requested bands should score highly, got ${goodResult.score}`);
  ok(goodResult.passed === (goodResult.score >= QUALITY_THRESHOLD), 'passed should reflect score >= QUALITY_THRESHOLD');

  const wrongLabelsBrief = { structureSections: ['Intro', 'Chorus', 'Bridge'], lineLength: '6-8 syllables', rhymeDensity: 'Heavy', energy: 'Mid' };
  const hardFailResult = validateLyrics(mixedRhyme, wrongLabelsBrief);
  ok(hardFailResult.hardFail === 'sectionLabels', 'wrong section labels should set hardFail=sectionLabels');
  ok(hardFailResult.score === 0 && hardFailResult.passed === false, 'a hard section-label failure should force score=0, passed=false regardless of everything else');
  console.log('  validateLyrics: good fixture scores high and passes; wrong labels hard-fail to 0 regardless of content quality.');
}

/* 9. buildRepairPrompt — seeded with the INDEPENDENT validator's issues, not
 *    a generic message, when a qualityResult is supplied. */
{
  const brief = { structureSections: ['Verse 1'], template: { sections: ['Verse 1'] }, lineLength: '6-8 syllables', rhymeDensity: 'Heavy', energy: 'Mid',
    genreAnchor: 'x', subgenre: 'x', keyMode: 'x', tempoSpec: 'x', mood: 'x', writingTraits: ['x'], subject: 'x', sourceType: 'x', themeLens: 'x', perspective: 'x', languageStyle: 'x', titleSeed: null, deliveryClass: null, structurePresetLabel: 'Test' };
  const initialResult = { lyrics: '[Verse 1]\nsome bad lyrics here' };
  const quality = validateLyrics('[Wrong Label]\nsome bad lyrics here', { ...brief });
  const prompt = buildRepairPrompt(brief, initialResult, quality);
  ok(prompt.includes(String(QUALITY_THRESHOLD)), 'repair prompt should reference the actual QUALITY_THRESHOLD');
  ok(/section labels do not match/.test(prompt), 'repair prompt should include the SPECIFIC deterministic issue text, not a generic message');
  console.log('  buildRepairPrompt: seeded with the independent validator\u2019s specific issue text.');
}

/* 10. ROUND-ROBIN LOOP — fake transport, no network. Proves the loop itself:
 *     retries on failure, stops on success, respects MAX_LYRIC_ATTEMPTS, and
 *     single-shot mode (repair falsy) never retries. */
{
  const dna = { identity: { genreAnchor: 'Test Anchor', subgenre: 'test' }, harmony: { keyMode: 'minor' }, tempo: { spec: '90-100' }, influences: [], meta: { characterId: 'x' } };
  const cil = { fields: { 'vocal.mode': { value: 'vocal' } }, residue: [] };
  const structure = { songType: 'vocal', sections: ['Verse 1', 'Chorus'], presetLabel: 'Test Preset' };
  const answers = { 'song.subject': 'x', 'song.lineLength': '6-8 syllables', 'song.rhymeDensity': 'Moderate' };

  // goodLyrics deliberately mixes a rhymed section (Verse 1: night/light) with
  // an unrhymed one (Chorus: moon/star) to land at 50% participation, inside
  // the Moderate [35-65] band — a 100%-rhymed fixture would FAIL this check
  // (see test 8's comment: perfect end-rhyme every line exceeds "Moderate").
  const goodLyrics = '[Verse 1]\ncat dog love dusk fire night\ncat dog love dusk fire light\n\n[Chorus]\ncat dog love dusk fire moon\ncat dog love dusk fire star';
  const badLyrics = '[Wrong Section]\nx';

  // 10a. Succeeds on the FIRST attempt — transport called exactly once.
  {
    let calls = 0;
    const transport = async () => { calls++; return JSON.stringify({ title: 't', lyrics: goodLyrics }); };
    const result = await runLyricEngine({ dna, cil, answers, structure, transport, repair: true });
    ok(calls === 1, `expected 1 transport call for an immediate pass, got ${calls}`);
    ok(result.thresholdMet === true, 'immediate pass should report thresholdMet=true');
    ok(result.attempts === 1, `expected attempts=1, got ${result.attempts}`);
  }

  // 10b. Fails first, passes on repair — transport called exactly twice, and
  //      the SECOND prompt (the repair prompt) must contain the specific
  //      deterministic issue from the FIRST attempt.
  {
    let calls = 0; const prompts = [];
    const transport = async ({ prompt }) => {
      calls++; prompts.push(prompt);
      return JSON.stringify({ title: 't', lyrics: calls === 1 ? badLyrics : goodLyrics });
    };
    const result = await runLyricEngine({ dna, cil, answers, structure, transport, repair: true });
    ok(calls === 2, `expected 2 transport calls (fail then pass), got ${calls}`);
    ok(result.thresholdMet === true, 'eventual pass after repair should report thresholdMet=true');
    ok(result.attempts === 2, `expected attempts=2, got ${result.attempts}`);
    ok(/section labels do not match/.test(prompts[1]), 'the repair prompt (2nd transport call) should contain the specific section-label issue from attempt 1');
  }

  // 10c. NEVER passes — transport always returns bad output. Confirms the cap
  //      is respected (exactly MAX_LYRIC_ATTEMPTS calls, not more) and the
  //      BEST-scoring attempt is returned, flagged thresholdMet=false.
  {
    let calls = 0;
    const transport = async () => { calls++; return JSON.stringify({ title: 't', lyrics: badLyrics }); };
    const result = await runLyricEngine({ dna, cil, answers, structure, transport, repair: true });
    ok(calls === MAX_LYRIC_ATTEMPTS, `expected exactly MAX_LYRIC_ATTEMPTS (${MAX_LYRIC_ATTEMPTS}) transport calls, got ${calls}`);
    ok(result.thresholdMet === false, 'never crossing the threshold should report thresholdMet=false');
    ok(!!result.quality, 'the returned best-effort result should still carry a quality object for the caller/UI to inspect');
  }

  // 10d. repair FALSE (or omitted) — single shot, no retry even on failure.
  {
    let calls = 0;
    const transport = async () => { calls++; return JSON.stringify({ title: 't', lyrics: badLyrics }); };
    const result = await runLyricEngine({ dna, cil, answers, structure, transport, repair: false });
    ok(calls === 1, `repair=false should make exactly 1 transport call even on failure, got ${calls}`);
    ok(result.thresholdMet === false, 'single-shot failure should still report thresholdMet=false honestly');
  }

  console.log('  round-robin loop: immediate pass, fail-then-repair-pass, capped exhaustion with best-effort return, and single-shot mode all behave correctly.');
}

console.log(`validate-lyric-quality: ${checks} checks, ${fails} failures.`);
if (fails) process.exit(1);

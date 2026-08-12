/* validate-harmony-brightness.mjs — proves the two harmony-brightness levers
 * (John, 2026-08-13: "control it, don't eliminate it... don't make it the
 * only lever").
 *
 * Lever 2: DEFAULT_HARMONY_WEIGHT should measurably shift the distribution of
 * harmony picks toward minor/modal across many seeds, without ever making
 * major/resolves impossible to draw.
 * Lever 3: when a structure has a genuine earned peak (energy 5 somewhere),
 * 'resolves'/'major' should be picked MORE often than under the default
 * weights; when a structure has NO peak (Downtempo/Ambient), they should be
 * picked LESS often than default. Both directions checked, not just one.
 *
 * Also proves: every harmony pool entry across all 4 resolver engines was
 * actually classified (no entry silently falls through to a default without
 * being accounted for), determinism holds (same seed -> same pick, weighting
 * changes the distribution across seeds, not the reproducibility of any one
 * seed), and omitting structureHint entirely reproduces the pre-lever
 * (Lever-2-only) behaviour exactly — backward compatible with every existing
 * caller that doesn't know about structureHint.
 *
 * Run from repo root: node validate-harmony-brightness.mjs
 */
import { resolveArrangement, DEFAULT_HARMONY_WEIGHT, PEAK_HARMONY_WEIGHT, NO_PEAK_HARMONY_WEIGHT } from './core/resolver.js';
import { structureHasResolutionPoint, resolveStructure, STRUCTURE_PRESETS } from './core/structure.js';
import { DELERIUM } from './engines/delerium.js';
import { ERA } from './engines/era.js';
import { DEEPFOREST } from './engines/deepforest.js';
import { SACREDSPIRIT } from './engines/sacredspirit.js';

let checks = 0, fails = 0;
const bad = (m) => { fails++; console.log('  FAIL: ' + m); };
const ok = (c, m) => { checks++; if (!c) bad(m); };

const ENGINES = { Delerium: DELERIUM, Era: ERA, 'Deep Forest': DEEPFOREST, 'Sacred Spirit': SACREDSPIRIT };
const VALID_TAGS = new Set(['minor', 'modal', 'neutral', 'resolves', 'major']);

/* 1. CLASSIFICATION COVERAGE — every harmony pool entry, across all 4
 *    engines, has a valid, recognised bright tag. Nothing silently falls
 *    through to an unclassified default. */
{
  let total = 0;
  const byTag = { minor: 0, modal: 0, neutral: 0, resolves: 0, major: 0 };
  for (const [name, engine] of Object.entries(ENGINES)) {
    const pool = engine.master.harmony;
    ok(pool && Object.keys(pool).length > 0, `${name}: harmony pool should exist and be non-empty`);
    for (const [key, entry] of Object.entries(pool || {})) {
      total++;
      ok(VALID_TAGS.has(entry.bright), `${name}.harmony.${key} ("${entry.t}") has no valid bright tag, got "${entry.bright}"`);
      if (VALID_TAGS.has(entry.bright)) byTag[entry.bright]++;
    }
  }
  ok(total === 43, `expected 43 harmony pool entries across all 4 engines, got ${total}`);
  ok(byTag.resolves >= 4, `expected at least one 'resolves' (minor-to-major) entry per engine (4 engines), got ${byTag.resolves}`);
  ok(byTag.minor + byTag.modal > byTag.major + byTag.resolves, 'minor+modal entries should outnumber major+resolves entries across the pool (the base bias John asked for)');
  console.log(`  classification: ${total}/43 harmony entries classified (minor:${byTag.minor} modal:${byTag.modal} neutral:${byTag.neutral} resolves:${byTag.resolves} major:${byTag.major}).`);
}

/* 2. WEIGHT TABLE SANITY — every tag reachable (never fully eliminated,
 *    "controlled but not eliminated"), and the ordering matches intent. */
{
  for (const [name, table] of Object.entries({ DEFAULT: DEFAULT_HARMONY_WEIGHT, PEAK: PEAK_HARMONY_WEIGHT, NO_PEAK: NO_PEAK_HARMONY_WEIGHT })) {
    for (const tag of VALID_TAGS) ok(table[tag] > 0, `${name} weight table: "${tag}" must stay > 0 (never eliminated), got ${table[tag]}`);
  }
  ok(DEFAULT_HARMONY_WEIGHT.minor > DEFAULT_HARMONY_WEIGHT.major, 'default weights should favour minor over major');
  ok(PEAK_HARMONY_WEIGHT.resolves > DEFAULT_HARMONY_WEIGHT.resolves, 'a structure WITH a resolution point should boost "resolves" above the default');
  ok(NO_PEAK_HARMONY_WEIGHT.resolves < DEFAULT_HARMONY_WEIGHT.resolves, 'a structure WITHOUT a resolution point should suppress "resolves" below the default');
  ok(PEAK_HARMONY_WEIGHT.major > NO_PEAK_HARMONY_WEIGHT.major, 'major should be more likely with a genuine peak than without one');
  console.log('  weight tables: every tag reachable in all 3 tables; peak/no-peak ordering matches intent.');
}

/* 3. STRUCTURE RESOLUTION-POINT CHECK — matches the actual shipped presets:
 *    Downtempo/Ambient (tops at energy 4) has none; everything with a
 *    Chorus/Drop/Climax does. */
{
  const downtempo = resolveStructure('downtempo-ambient');
  ok(structureHasResolutionPoint(downtempo) === false, 'downtempo-ambient (max energy 4) should have NO resolution point');

  let withPeak = 0, withoutPeak = 0;
  const noPeakPresets = [];
  for (const preset of Object.values(STRUCTURE_PRESETS)) {
    const s = resolveStructure(preset.id);
    if (structureHasResolutionPoint(s)) withPeak++; else { withoutPeak++; noPeakPresets.push(preset.id); }
  }
  // aaba (no-chorus jazz-standard form, tops at energy 3) and downtempo-ambient
  // (tops at energy 4) both correctly have no earned peak — genuinely no
  // chorus/drop/climax section in either structure, not a bug.
  ok(withPeak === 10 && withoutPeak === 2, `expected 10 presets with a peak and 2 without (aaba, downtempo-ambient), got ${withPeak}/${withoutPeak}: no-peak=[${noPeakPresets.join(', ')}]`);
  ok(noPeakPresets.includes('aaba') && noPeakPresets.includes('downtempo-ambient'),
    `expected the no-peak presets to be exactly aaba and downtempo-ambient, got [${noPeakPresets.join(', ')}]`);
  ok(structureHasResolutionPoint(null) === false, 'a null/missing structure should report no resolution point, not throw');
  console.log(`  resolution-point check: ${withPeak}/12 presets have an earned peak; aaba and downtempo-ambient correctly do not.`);
}

/* 4. DISTRIBUTION SHIFT — sample many seeds under each weight regime and
 *    confirm the measured distribution actually moves in the right
 *    direction. Uses Delerium's gothicAmbient character, whose harmony pool
 *    subset is entirely non-major (droneTonic, phrygian, modalResolve,
 *    sacredCadence — see engines/delerium.js) as a control: with an
 *    all-non-major subset, weighting cannot possibly produce a major pick,
 *    proving the mechanism doesn't invent choices outside the character's
 *    own curated pool. A second character with a mixed subset is used to
 *    prove the actual shift. */
{
  const N = 2000;

  // Control: gothicAmbient's subset has zero 'major'/'resolves' entries —
  // confirms weighting only reorders WITHIN the character's own pool, never
  // introduces an option the character wasn't given.
  const controlCounts = {};
  for (let seed = 1; seed <= N; seed++) {
    const arr = resolveArrangement(DELERIUM, { characterId: 'gothicAmbient', palette: 'electronic', seed });
    controlCounts[arr.harmony] = (controlCounts[arr.harmony] || 0) + 1;
  }
  const controlPool = DELERIUM.characters.gothicAmbient.pools.harmony.map(p => p.t);
  ok(Object.keys(controlCounts).every(t => controlPool.includes(t)),
    'weighted selection must never produce text outside the character\u2019s own curated harmony subset');

  // Find a resolver character across the 4 engines whose harmony subset
  // includes at least one entry of each of 'minor'/'modal' and 'major'/
  // 'resolves', to measure an actual shift.
  let mixedEngine = null, mixedCharId = null;
  outer:
  for (const [ekey, engine] of Object.entries(ENGINES)) {
    for (const [cid, ch] of Object.entries(engine.characters)) {
      const subset = ch.pools.harmony || [];
      const tags = new Set(subset.map(p => {
        const full = engine.master.harmony[Object.keys(engine.master.harmony).find(k => engine.master.harmony[k].t === p.t)];
        return full ? full.bright : null;
      }));
      const hasDark = tags.has('minor') || tags.has('modal');
      const hasBright = tags.has('major') || tags.has('resolves');
      if (hasDark && hasBright) { mixedEngine = engine; mixedCharId = cid; break outer; }
    }
  }
  ok(!!mixedEngine, 'expected at least one resolver character with a mixed minor/modal + major/resolves harmony subset to test the shift against');

  if (mixedEngine) {
    const brightTagFor = (text) => {
      const key = Object.keys(mixedEngine.master.harmony).find(k => mixedEngine.master.harmony[k].t === text);
      return key ? mixedEngine.master.harmony[key].bright : null;
    };
    const countBrightBuckets = (structureHint) => {
      const buckets = { dark: 0, bright: 0 };
      for (let seed = 1; seed <= N; seed++) {
        const arr = resolveArrangement(mixedEngine, { characterId: mixedCharId, palette: 'electronic', seed, structureHint });
        const tag = brightTagFor(arr.harmony);
        if (tag === 'minor' || tag === 'modal') buckets.dark++;
        else if (tag === 'major' || tag === 'resolves') buckets.bright++;
      }
      return buckets;
    };

    const defaultB = countBrightBuckets(null);
    const peakB = countBrightBuckets({ hasResolutionPoint: true });
    const noPeakB = countBrightBuckets({ hasResolutionPoint: false });

    ok(defaultB.dark > defaultB.bright, `default weighting should draw dark (minor/modal) more often than bright (major/resolves) over ${N} seeds \u2014 got dark=${defaultB.dark} bright=${defaultB.bright}`);
    ok(peakB.bright > defaultB.bright, `a structure WITH a resolution point should draw bright MORE often than the default over ${N} seeds \u2014 default bright=${defaultB.bright}, peak bright=${peakB.bright}`);
    ok(noPeakB.bright < defaultB.bright, `a structure WITHOUT a resolution point should draw bright LESS often than the default over ${N} seeds \u2014 default bright=${defaultB.bright}, no-peak bright=${noPeakB.bright}`);
    ok(peakB.bright > noPeakB.bright, `peak structures should draw bright more than no-peak structures \u2014 peak=${peakB.bright}, no-peak=${noPeakB.bright}`);
    ok(noPeakB.bright > 0, 'bright must still be reachable even under no-peak suppression \u2014 controlled, not eliminated');

    console.log(`  distribution shift (${mixedEngine === DELERIUM ? 'Delerium' : mixedEngine === ERA ? 'Era' : mixedEngine === DEEPFOREST ? 'Deep Forest' : 'Sacred Spirit'}.${mixedCharId}, N=${N}): default bright=${defaultB.bright}, peak bright=${peakB.bright}, no-peak bright=${noPeakB.bright} \u2014 ordering correct in both directions.`);
  }
}

/* 5. DETERMINISM — the same seed always produces the same harmony pick,
 *    with or without a structureHint. Weighting changes the distribution
 *    ACROSS seeds, never the reproducibility of any single seed. */
{
  const a1 = resolveArrangement(DELERIUM, { characterId: 'gothicAmbient', palette: 'electronic', seed: 12345 });
  const a2 = resolveArrangement(DELERIUM, { characterId: 'gothicAmbient', palette: 'electronic', seed: 12345 });
  ok(a1.harmony === a2.harmony, 'the same seed must produce the same harmony pick (determinism)');

  const b1 = resolveArrangement(ERA, { characterId: Object.keys(ERA.characters)[0], palette: 'electronic', seed: 777, structureHint: { hasResolutionPoint: true } });
  const b2 = resolveArrangement(ERA, { characterId: Object.keys(ERA.characters)[0], palette: 'electronic', seed: 777, structureHint: { hasResolutionPoint: true } });
  ok(b1.harmony === b2.harmony, 'the same seed + structureHint must produce the same harmony pick');
  console.log('  determinism: identical seeds (with or without structureHint) always produce identical harmony picks.');
}

/* 6. BACKWARD COMPATIBILITY — omitting structureHint entirely (not even
 *    passing the key) must behave identically to passing structureHint: null
 *    (both fall back to DEFAULT_HARMONY_WEIGHT). Existing callers that don't
 *    know about this feature keep working exactly as before. */
{
  const withoutKey = resolveArrangement(DELERIUM, { characterId: 'gothicAmbient', palette: 'electronic', seed: 42 });
  const withNull = resolveArrangement(DELERIUM, { characterId: 'gothicAmbient', palette: 'electronic', seed: 42, structureHint: null });
  ok(withoutKey.harmony === withNull.harmony, 'omitting structureHint entirely should behave identically to passing structureHint: null');
  console.log('  backward compatibility: omitting structureHint matches structureHint:null exactly.');
}

console.log(`validate-harmony-brightness: ${checks} checks, ${fails} failures.`);
if (fails) process.exit(1);

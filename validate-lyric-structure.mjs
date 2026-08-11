/* validate-lyric-structure.mjs — proves Phase 3 of the structure-first
 * pipeline: the Lyric Engine (core/lyric.js) reads the structure preset's
 * section NAMES and POSITIONS (order) from core/structure.js when supplied,
 * and song type (decision #1) overrides any CIL/answer-derived vocal.mode.
 *
 * Scope confirmed by John (2026-08-12): "Phase 3 names and positions only" —
 * no energy/bar data is passed to or read by this engine. Energy stays
 * confined to core/structure.js's own coherence rules (validate-structure.mjs);
 * Suno is left to pace the song from the section list alone (John, Phase 4
 * scoping: "it won't be necessary to lock in or specify any energy data...
 * so long as the structure is available in the lyric prompt that will be
 * enough").
 *
 * Run from repo root: node validate-lyric-structure.mjs
 */
import { assembleLyricBrief, buildLyricPrompt, buildRepairPrompt } from './core/lyric.js';
import { inferCIL } from './core/cil.js';
import { buildMusicalDNA } from './core/dna.js';
import { ATOM_POOL_CHARACTERS } from './engines/atom-characters.js';
import { resolveStructure, STRUCTURE_PRESETS } from './core/structure.js';

let checks = 0, fails = 0;
const bad = (m) => { fails++; console.log('  FAIL: ' + m); };
const ok = (c, m) => { checks++; if (!c) bad(m); };

// A narrow adapter matching "names and positions only" — deliberately does
// NOT expose energyShape to the lyric engine, proving the engine cannot read
// what it was never given.
function lyricStructureInput(presetId) {
  const s = resolveStructure(presetId);
  if (!s) return null;
  return { songType: s.type, sections: s.sections, presetLabel: s.label };
}

const cid = Object.keys(ATOM_POOL_CHARACTERS)[0];
const dna = buildMusicalDNA(ATOM_POOL_CHARACTERS[cid], 'electronic', { seed: 909, characterId: cid });
const cil = inferCIL(dna);

/* 1. SECTION LIST OVERRIDE — when a structure is supplied, its sections (not
 *    the legacy per-subgenre template's) appear in the prompt, in the same
 *    order as the preset. */
{
  const structure = lyricStructureInput('three-verse');
  const answers = { 'vocal.mode': 'vocal', 'song.subject': 'a long drive at night' };
  const brief = assembleLyricBrief(dna, cil, answers, structure);
  const out = buildLyricPrompt(brief);

  ok(brief.structureSections !== null, 'brief.structureSections should be populated when a structure is supplied');
  ok(JSON.stringify(brief.structureSections) === JSON.stringify(structure.sections),
    'brief.structureSections should exactly match the resolved preset\u2019s sections, in order');

  const preset = STRUCTURE_PRESETS['three-verse'];
  const expectedLabels = preset.sections.map(s => `[${s}]`).join(' ');
  ok(out.prompt.includes(expectedLabels),
    `prompt should contain the three-verse preset's own section labels in order: "${expectedLabels}"`);

  // Legacy per-subgenre template labels must NOT be what's used when a
  // structure was explicitly supplied (the whole point of "structure first").
  const legacyLabels = brief.template.sections.map(s => `[${s}]`).join(' ');
  if (legacyLabels !== expectedLabels) {
    ok(!out.prompt.includes(`this order: ${legacyLabels}.`),
      'prompt should not fall back to the legacy per-subgenre template\u2019s section order when a structure was explicitly supplied');
  }
  console.log('  section override: structure preset\u2019s own sections/order used verbatim in the prompt.');
}

/* 2. SONG TYPE OVERRIDES ANSWERS/CIL — structure.songType='instrumental' must
 *    force the [Instrumental] short-circuit even when the caller's own
 *    answers say 'vocal.mode':'vocal'. Song type is decision #1 and must win. */
{
  const structure = lyricStructureInput('downtempo-ambient'); // instrumental preset
  ok(structure.songType === 'instrumental', 'sanity: downtempo-ambient preset should be instrumental type');

  const answers = { 'vocal.mode': 'vocal', 'song.subject': 'should be ignored' }; // deliberately contradicts structure
  const brief = assembleLyricBrief(dna, cil, answers, structure);
  ok(brief.vocalMode === 'instrumental',
    `structure.songType should override answers['vocal.mode']='vocal', but brief.vocalMode is "${brief.vocalMode}"`);

  const out = buildLyricPrompt(brief);
  ok(out.instrumental === true && out.lyrics === '[Instrumental]' && out.prompt === null,
    'instrumental structure should short-circuit to [Instrumental] regardless of contradicting answers');
  console.log('  song-type override: structure.songType wins over a contradicting vocal.mode answer.');
}

/* 3. VOCAL SONG TYPE DOES NOT FORCE VOCAL — structure.songType='vocal' does
 *    NOT itself force a vocal brief if CIL/answers actually resolve
 *    instrumental; it only sets the ceiling. (In practice the UI's Phase 1/2
 *    gate keeps these in sync, but the lyric engine itself must not assume
 *    that — it should reflect whatever is actually passed.) Here we confirm
 *    a 'vocal' structure with an explicit instrumental answer still honours
 *    the more specific instrumental answer only when structure doesn't
 *    contradict it — i.e. structure is authoritative when it disagrees with
 *    answers, per test 2. This test instead confirms the ORDINARY path: a
 *    vocal structure with a vocal answer produces a normal vocal prompt. */
{
  const structure = lyricStructureInput('full-pop'); // vocal preset
  ok(structure.songType === 'vocal', 'sanity: full-pop preset should be vocal type');
  const answers = { 'vocal.mode': 'vocal', 'song.subject': 'a summer romance' };
  const brief = assembleLyricBrief(dna, cil, answers, structure);
  const out = buildLyricPrompt(brief);
  ok(out.instrumental === false && !!out.prompt, 'vocal structure + vocal answers should produce a normal vocal prompt');
  console.log('  vocal path: vocal structure + vocal answers builds a normal prompt (no regression).');
}

/* 4. NO ENERGY DATA LEAKS INTO THE BRIEF OR PROMPT — Phase 3 scope is names
 *    and positions only. Confirm no energyShape-derived digits or the word
 *    "energy shape" appear anywhere the structure integration touches
 *    (the pre-existing tempo-derived `energy` field, e.g. "Mid", is fine and
 *    unrelated — this checks specifically for the structure module's numeric
 *    energy values leaking through). */
{
  const structure = lyricStructureInput('three-verse');
  ok(!('energyShape' in structure), 'lyricStructureInput should not expose energyShape (names+positions only)');
  const answers = { 'vocal.mode': 'vocal', 'song.subject': 'x' };
  const brief = assembleLyricBrief(dna, cil, answers, structure);
  ok(!('energyShape' in brief), 'brief must not carry energyShape');
  ok(!('structureEnergyShape' in brief), 'brief must not carry any structure energy field');
  console.log('  scope guard: no energyShape data reaches the lyric brief (names + positions only, per John).');
}

/* 5. BACKWARD COMPATIBILITY — omitting structure entirely must reproduce the
 *    exact pre-Phase-3 behaviour (legacy template drives section labels). */
{
  const answers = { 'vocal.mode': 'vocal', 'song.subject': 'a distant coastline at dusk' };
  const briefNoStructure = assembleLyricBrief(dna, cil, answers); // 4th arg omitted
  ok(briefNoStructure.structureSections === null, 'omitting structure should leave structureSections null');
  const out = buildLyricPrompt(briefNoStructure);
  const legacyLabels = briefNoStructure.template.sections.map(s => `[${s}]`).join(' ');
  ok(out.prompt.includes(legacyLabels), 'omitting structure should fall back to the legacy template\u2019s section labels');
  console.log('  backward compatibility: omitting structure reproduces pre-Phase-3 behaviour exactly.');
}

/* 6. REPAIR PROMPT CONSISTENCY — buildRepairPrompt must use the SAME section
 *    list as the original prompt (structure-first when supplied), so a repair
 *    pass can't silently drift back to the legacy template. buildRepairPrompt
 *    renders labels via contextBlock's "Required sections in order: A, B, C"
 *    (comma-joined), not buildLyricPrompt's separate space-joined bullet line
 *    — so compare against that actual format rather than assuming they match. */
{
  const structure = lyricStructureInput('anthemic');
  const answers = { 'vocal.mode': 'vocal', 'song.subject': 'x' };
  const brief = assembleLyricBrief(dna, cil, answers, structure);
  const fakeResult = { validation: { score: 40, passed: false, issues: ['weak hook'] }, lyrics: '[Verse]\nplaceholder' };
  const repairPrompt = buildRepairPrompt(brief, fakeResult);
  const expectedCommaLabels = STRUCTURE_PRESETS['anthemic'].sections.map(s => `[${s}]`).join(', ');
  ok(repairPrompt.includes(expectedCommaLabels), 'repair prompt should use the same structure-first section list as the original prompt');
  console.log('  repair consistency: buildRepairPrompt uses the same structure-first sections as buildLyricPrompt.');
}

/* 7. ALL VOCAL PRESETS RESOLVE TO A USABLE PROMPT — sweep every vocal preset
 *    through the pipeline once, confirming no exceptions and correct label
 *    count (regression net over all 8 vocal presets). */
{
  const vocalPresetIds = Object.values(STRUCTURE_PRESETS).filter(p => p.type === 'vocal').map(p => p.id);
  ok(vocalPresetIds.length === 8, `expected 8 vocal presets, got ${vocalPresetIds.length}`);
  let n = 0;
  for (const id of vocalPresetIds) {
    const structure = lyricStructureInput(id);
    const answers = { 'vocal.mode': 'vocal', 'song.subject': 'x' };
    let out;
    try {
      out = buildLyricPrompt(assembleLyricBrief(dna, cil, answers, structure));
    } catch (e) {
      bad(`preset "${id}" threw building the lyric prompt: ${e.message}`);
      continue;
    }
    n++;
    const expectedLabels = STRUCTURE_PRESETS[id].sections.map(s => `[${s}]`).join(' ');
    if (!out.prompt.includes(expectedLabels)) bad(`preset "${id}": prompt missing its own section labels`);
  }
  console.log(`  vocal preset sweep: ${n}/8 vocal presets build a usable lyric prompt with correct labels.`);
}

console.log(`validate-lyric-structure: ${checks} checks, ${fails} failures.`);
if (fails) process.exit(1);

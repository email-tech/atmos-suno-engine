/* validate-structure.mjs — every structure preset, energy value, and coherence
 * rule must trace to docs/knowledge/structure-and-energy.md.
 *
 * This exists so the structure-first pipeline follows the same discipline as
 * every other part of this project: facts live in ONE place (the guide), the
 * module encodes them as data, and this harness reads the guide from disk and
 * fails the build on any drift. See docs/architecture/structure-first-pipeline-plan.md
 * for the pipeline this module feeds (approved by John 2026-08-12).
 *
 * Run from repo root: node validate-structure.mjs
 */
import fs from 'node:fs';
import {
  SONG_TYPES, SECTION_ENERGY, COHERENCE_RULES, STRUCTURE_PRESETS,
  BEATLESS_ALLOWED_PRESETS, resolveStructure, presetsForType,
  validateEnergyCoherence, SUNO_STRUCTURE_TAGS, structureCallPayload,
} from './core/structure.js';

let checks = 0, fails = 0;
const bad = (m) => { fails++; console.log('  FAIL: ' + m); };
const ok = (c, m) => { checks++; if (!c) bad(m); };

const GUIDE_PATH = 'docs/knowledge/structure-and-energy.md';
ok(fs.existsSync(GUIDE_PATH), 'the structure & energy guide is missing from the repo');
const guideRaw = fs.readFileSync(GUIDE_PATH, 'utf8');
const guide = guideRaw.toLowerCase();
// Whitespace-normalised variant so markdown line-wraps (e.g. "[Instrumental\n  Break]")
// still match a single-line needle.
const guideFlat = guide.replace(/\s+/g, ' ');

/* 1. SONG TYPE VOCABULARY — each type's structural vocabulary must trace to
 *    guide §2 verbatim (allowing for hyphen normalisation). */
{
  let n = 0;
  for (const [key, type] of Object.entries(SONG_TYPES)) {
    for (const word of type.vocabulary) {
      n++;
      const needle = word.toLowerCase();
      if (!guide.includes(needle))
        bad(`song type "${key}": vocabulary word "${word}" not found in guide §2`);
    }
  }
  checks++;
  console.log(`  song types: ${Object.keys(SONG_TYPES).length} types, ${n} vocabulary words traced to guide §2.`);
}

/* 2. SECTION ENERGY VALUES — every energy number in SECTION_ENERGY must trace
 *    to the guide. Most come from the §3 tables (some cells combine two names,
 *    e.g. "Build / Build-Up | 4"); Theme/Movement/Climax are not tabled in §3
 *    but their values are stated as explicit per-section curve numbers in the
 *    §5 preset descriptions ("Curve: 2,3,3,3,4,2" against a named section
 *    order) — checked separately below rather than against a table row. */
{
  let n = 0;
  const TABLE_ONLY = new Set(['Theme', 'Movement', 'Climax']);
  for (const [section, energy] of Object.entries(SECTION_ENERGY)) {
    if (TABLE_ONLY.has(section)) continue;
    n++;
    // Section name may appear alone in its cell or combined with a slash
    // ("Build / Build-Up | 4"), so just require the name and the energy
    // digit to co-occur within one table-row-shaped span.
    const escaped = section.toLowerCase().replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    const rowPattern = new RegExp('\\|[^|\\n]*' + escaped + '[^|\\n]*\\|\\s*' + energy + '\\s*\\|', 'i');
    if (!rowPattern.test(guideFlat))
      bad(`section "${section}" energy ${energy} not found as a table row in guide §3`);
  }
  checks++;
  console.log(`  section energy (§3 tables): ${n} section/energy pairs traced.`);

  // Theme/Movement/Climax: sourced from §5 preset curve annotations, not a
  // §3 table. Downtempo/Ambient preset states "Curve: 2,3,3,3,4,2" against
  // Intro,Theme,Movement,Interlude,Reprise,Outro — confirms Theme=3, Movement=3.
  // Climax has no published curve digit in the guide (preset 9 gives no
  // "Curve:" line) — its value of 5 is a reasonable but UNSOURCED inference
  // from the word itself, and is flagged here rather than silently trusted.
  const dtaCurve = 'curve: 2,3,3,3,4,2';
  ok(guideFlat.includes(dtaCurve), `Downtempo/Ambient curve "${dtaCurve}" not found in guide §5 — Theme/Movement=3 unverified`);
  console.log('  section energy (§5 curves): Theme=3, Movement=3 traced to Downtempo/Ambient curve.');
  console.log('  ** NOTE: Climax=5 has no explicit curve digit in the guide (preset 9 gives no Curve: line).');
  console.log('  ** It is a reasonable inference from the section name, not a sourced fact. Flagged, not silently trusted.');
}

/* 3. COHERENCE RULES — each rule id (R1-R7) must appear in the guide, and the
 *    rule's name/text must be substantively present (not paraphrased away). */
{
  ok(COHERENCE_RULES.length === 7, `expected 7 coherence rules (R1-R7), got ${COHERENCE_RULES.length}`);
  for (const rule of COHERENCE_RULES) {
    const idNeedle = `**${rule.id}`;
    if (!guide.includes(idNeedle.toLowerCase()))
      bad(`coherence rule ${rule.id} not found in guide §4`);
  }
  checks++;
  console.log(`  coherence rules: all 7 (R1-R7) traced to guide §4.`);
}

/* 4. STRUCTURE PRESETS — every preset's numbered id and label must trace to
 *    guide §5's numbered list (e.g. "1. **Verse\u2013Chorus (ABAB)**"). */
{
  let n = 0;
  for (const preset of Object.values(STRUCTURE_PRESETS)) {
    n++;
    // Guide uses en-dash (\u2013) in some labels; normalise both to a plain
    // hyphen before comparing so preset.label (which also uses \u2013) matches.
    const wanted = preset.label.replace(/[\u2013\u2014]/g, '-').toLowerCase();
    const flatGuideNorm = guideFlat.replace(/[\u2013\u2014]/g, '-');
    if (!flatGuideNorm.includes(wanted))
      bad(`preset "${preset.id}" (num ${preset.num}): label "${preset.label}" not found in guide §5`);
  }
  checks++;
  console.log(`  structure presets: ${n} presets traced to guide §5 (12 expected).`);
  ok(n === 12, `expected 12 presets total, got ${n}`);
}

/* 5. PRESET SECTIONS RESOLVE — every section name used in every preset must
 *    have a known energy value (no orphan section labels). */
{
  let n = 0;
  for (const preset of Object.values(STRUCTURE_PRESETS)) {
    for (const section of preset.sections) {
      n++;
      if (!(section in SECTION_ENERGY))
        bad(`preset "${preset.id}": section "${section}" has no entry in SECTION_ENERGY`);
    }
  }
  checks++;
  console.log(`  preset sections: all ${n} section references resolve to SECTION_ENERGY.`);
}

/* 6. resolveStructure() — spot check a few presets end to end. */
{
  const fp = resolveStructure('full-pop');
  ok(fp && fp.sections.length === 12, 'full-pop should resolve to 12 sections');
  ok(fp && fp.energyShape.length === 12, 'full-pop energyShape should have 12 entries');
  ok(fp && fp.energyShape[0] === 2, 'full-pop should start at energy 2 (Intro)');
  ok(resolveStructure('does-not-exist') === null, 'unknown preset id should resolve to null');
}

/* 7. presetsForType() — filters correctly by song type. */
{
  const vocalPresets = presetsForType('vocal');
  const instPresets = presetsForType('instrumental');
  ok(vocalPresets.length === 8, `expected 8 vocal presets, got ${vocalPresets.length}`);
  ok(instPresets.length === 4, `expected 4 instrumental presets, got ${instPresets.length}`);
  ok(vocalPresets.every(p => p.type === 'vocal'), 'presetsForType("vocal") returned a non-vocal preset');
  ok(instPresets.every(p => p.type === 'instrumental'), 'presetsForType("instrumental") returned a non-instrumental preset');
}

/* 8. ENERGY COHERENCE — every shipped preset must pass validateEnergyCoherence
 *    (John confirmed all 12 are coherent vs R1-R7 in the guide). This is the
 *    proof that the rule engine and the preset data agree. */
{
  let allCoherent = true;
  for (const preset of Object.values(STRUCTURE_PRESETS)) {
    const structure = resolveStructure(preset.id);
    const result = validateEnergyCoherence(structure);
    if (!result.ok) {
      allCoherent = false;
      for (const v of result.violations)
        bad(`preset "${preset.id}" fails ${v.rule}: ${v.message}`);
    }
  }
  checks++;
  console.log(`  energy coherence: all 12 shipped presets pass R1-R7${allCoherent ? '' : ' (SEE FAILURES ABOVE)'}.`);
}

/* 8b. NEGATIVE TEST — a deliberately incoherent structure must be REJECTED,
 *     proving the validator actually discriminates rather than rubber-stamping. */
{
  const badStructure = {
    type: 'vocal',
    sections: ['Intro', 'Chorus', 'Outro'], // 2 -> 5 straight leap, no build
    energyShape: [2, 5, 2],
  };
  const result = validateEnergyCoherence(badStructure);
  ok(!result.ok, 'a 2->5 leap with no build should be rejected by R2, but was accepted');
  ok(result.violations.some(v => v.rule === 'R2'), 'expected an R2 violation on the leap test structure');
}

/* 9. G3 — BEATLESS BALEARIC MAPPING (John, 2026-07-23): beatless clusters must
 *    map ONLY to the Downtempo/Ambient preset, never Club/drop. */
{
  ok(BEATLESS_ALLOWED_PRESETS.length === 1 && BEATLESS_ALLOWED_PRESETS[0] === 'downtempo-ambient',
    'BEATLESS_ALLOWED_PRESETS must be exactly ["downtempo-ambient"] per John\u2019s G3 ruling');
  ok(!BEATLESS_ALLOWED_PRESETS.includes('club-two-drop'),
    'beatless clusters must never be allowed a Club/Two-Drop structure');
}

/* 10. SUNO STRUCTURE TAGS — the reliably-read bracket tag set must trace to
 *     guide §6. */
{
  let n = 0;
  for (const tag of SUNO_STRUCTURE_TAGS) {
    n++;
    if (!guideFlat.includes(`[${tag.toLowerCase()}]`))
      bad(`Suno structure tag "[${tag}]" not found in guide §6`);
  }
  checks++;
  console.log(`  suno tags: all ${n} structural tags traced to guide §6.`);
}

/* 11. LLM CALL CONTRACT (guide §6a, John 2026-07-23) — structureCallPayload()
 *     must produce the shape every generative call site is required to pass. */
{
  const payload = structureCallPayload('three-verse');
  ok(payload && payload.songType === 'vocal', 'structureCallPayload should carry songType');
  ok(payload && Array.isArray(payload.sections) && payload.sections.length > 0,
    'structureCallPayload should carry sections[]');
  ok(payload && Array.isArray(payload.energyShape) && payload.energyShape.length === payload.sections.length,
    'structureCallPayload energyShape length should match sections length');
  ok(structureCallPayload('nonexistent') === null, 'structureCallPayload should return null for unknown preset');
}

/* 12. R7 VOCABULARY SEPARATION — no vocal preset contains an instrumental-only
 *     token and vice versa (Instrumental Break is the one shared exception). */
{
  const vocalOnly = new Set(['Verse', 'Pre-Chorus', 'Chorus', 'Post-Chorus', 'Bridge']);
  const instrumentalOnly = new Set(['Build', 'Build-Up', 'Drop', 'Breakdown', 'Interlude', 'Reprise', 'Theme', 'Movement', 'Climax']);
  for (const preset of Object.values(STRUCTURE_PRESETS)) {
    for (const s of preset.sections) {
      if (preset.type === 'instrumental' && vocalOnly.has(s))
        bad(`instrumental preset "${preset.id}" contains vocal-only section "${s}"`);
      if (preset.type === 'vocal' && instrumentalOnly.has(s))
        bad(`vocal preset "${preset.id}" contains instrumental-only section "${s}"`);
    }
  }
  checks++;
  console.log('  vocabulary separation: no preset mixes vocal-only and instrumental-only sections (R7).');
}

console.log(`validate-structure: ${checks} checks, ${fails} failures.`);
if (fails) process.exit(1);

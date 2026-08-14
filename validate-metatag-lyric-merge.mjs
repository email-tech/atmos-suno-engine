/* validate-metatag-lyric-merge.mjs — proves the metatag/lyric merge (John,
 * 2026-08-14 decision, Path B) actually does what it claims:
 *
 *   1. STRUCTURE ALIGNMENT — core/metatag.js's new `sections` override
 *      actually wins over the template fallback, so metatags and lyrics
 *      never silently disagree on section labels when a structure preset
 *      is picked (the latent bug found while building this).
 *   2. INSTRUMENTAL MERGE — generate() for the atom engine kind folds the
 *      real metatag block directly into the Lyrics field for an
 *      instrumental track; the separate `metatags` field comes back empty
 *      (no duplicate block).
 *   3. LOCKED-TAG PARITY — js/generate.js's buildLiveLyricRequest() computes
 *      the SAME metatag block, from the same dna/seed/palette/structure/
 *      composer layer, as generate()'s own sync preview — this is the whole
 *      point: what the user previews is exactly what the LLM is locked to.
 *   4. PROMPT CONTENT — buildLyricPrompt() hands locked tags to the LLM
 *      verbatim as mandatory, additive-only content, and falls back to the
 *      original generic "invent your own tags" instruction whenever locked
 *      tags are absent OR misaligned (defensive — never silently point the
 *      model at the wrong tag for the wrong section).
 *   5. REPAIR CONSISTENCY — buildRepairPrompt() carries the same locked
 *      block, so a repair pass can't silently drop it.
 *   6. SCOPE — resolver/legacy engine kinds have no metatag engine yet
 *      (separate, still-open TODO), so they get lockedMetatags === null and
 *      fall back to the unchanged pre-2026-08-14 generic instruction.
 *
 * Run from repo root: node validate-metatag-lyric-merge.mjs
 */
import { initState, syncEngineDefaults, setSongType, setStructurePreset } from './js/state.js';
import { generate, buildLiveLyricRequest } from './js/generate.js';
import { assembleLyricBrief, buildLyricPrompt, buildRepairPrompt } from './core/lyric.js';
import { buildMetatagPlan, runMetatagEngine } from './core/metatag.js';
import { buildMusicalDNA } from './core/dna.js';
import { inferCIL } from './core/cil.js';
import { ATOM_POOL_CHARACTERS } from './engines/atom-characters.js';
import { STRUCTURE_PRESETS, presetsForType } from './core/structure.js';

let checks = 0, fails = 0;
const bad = (m) => { fails++; console.log('  FAIL: ' + m); };
const ok = (c, m) => { checks++; if (!c) bad(m); };

/* 1. STRUCTURE ALIGNMENT — the `sections` override wins over the metatag
 *    engine's own template fallback. */
{
  const cid = Object.keys(ATOM_POOL_CHARACTERS)[0];
  const dna = buildMusicalDNA(ATOM_POOL_CHARACTERS[cid], 'electronic', { seed: 707, characterId: cid });
  const withoutOverride = buildMetatagPlan(dna, {});
  const preset = STRUCTURE_PRESETS['verse-chorus-bridge'];
  ok(JSON.stringify(withoutOverride.sections) !== JSON.stringify(preset.sections)
     || withoutOverride.sections.length !== preset.sections.length,
     'sanity: this test needs a template whose own sections differ from the chosen preset — pick a different preset if this ever coincidentally matches');
  const withOverride = buildMetatagPlan(dna, { sections: preset.sections });
  ok(JSON.stringify(withOverride.sections) === JSON.stringify(preset.sections),
    `buildMetatagPlan's sections override should win over the template fallback — got ${JSON.stringify(withOverride.sections)}`);
  ok(withOverride.leanLines.length === preset.sections.length,
    'leanLines should have one line per overridden section, not per template section');
  preset.sections.forEach((label, i) => {
    ok(withOverride.leanLines[i].startsWith(`[${label}`),
      `overridden leanLines[${i}] should open with the preset's own label "${label}", got "${withOverride.leanLines[i]}"`);
  });
  console.log('  structure alignment: sections override wins over the template fallback, leanLines follow it exactly.');
}

/* 2 + 3. INSTRUMENTAL MERGE + LOCKED-TAG PARITY, swept across every atom
 *    character x both palettes x a vocal and an instrumental structure
 *    preset. */
{
  const charIds = Object.keys(ATOM_POOL_CHARACTERS);
  const vocalPreset = presetsForType('vocal')[0].id;
  const instPreset = presetsForType('instrumental')[0].id;
  let n = 0;

  for (const cid of charIds) {
    for (const palette of ['electronic', 'acoustic']) {
      // --- instrumental: lyrics field IS the metatag block ---
      {
        const S = initState();
        syncEngineDefaults(S, 'Balearic Atom');
        S.atom.characterId = cid;
        S.atom.palette = palette;
        setStructurePreset(S, instPreset);
        setSongType(S, 'instrumental');
        const out = generate(S);
        n++;
        ok(!!out.lyrics && out.lyrics !== '[Instrumental]' && out.lyrics.startsWith('['),
          `${cid}/${palette}/instrumental: lyrics should be the merged metatag block, got "${out.lyrics}"`);
        ok(out.metatags === '',
          `${cid}/${palette}/instrumental: metatags field should be empty (folded into lyrics, not duplicated), got "${out.metatags}"`);
        const expectedLines = STRUCTURE_PRESETS[instPreset].sections.length;
        const gotLines = out.lyrics.split('\n').length;
        ok(gotLines === expectedLines,
          `${cid}/${palette}/instrumental: merged lyrics should have ${expectedLines} lines (one per section), got ${gotLines}`);
      }

      // --- vocal: sync preview metatags must exactly match the locked
      //     block computed independently for the live-lyric handoff ---
      {
        const S = initState();
        syncEngineDefaults(S, 'Balearic Atom');
        S.atom.characterId = cid;
        S.atom.palette = palette;
        setStructurePreset(S, vocalPreset);
        setSongType(S, 'vocal');
        const syncOut = generate(S);
        const liveReq = buildLiveLyricRequest(S);
        n++;
        ok(syncOut.metatags && syncOut.metatags.length > 0,
          `${cid}/${palette}/vocal: sync preview metatags should be non-empty`);
        ok(liveReq.lockedMetatags === syncOut.metatags,
          `${cid}/${palette}/vocal: buildLiveLyricRequest's lockedMetatags should exactly match generate()'s sync metatags preview \u2014 same dna/seed/structure/composer layer, computed independently. Mismatch means the user's preview and what the LLM is locked to have drifted apart.`);
        const expectedLines = STRUCTURE_PRESETS[vocalPreset].sections.length;
        ok(liveReq.lockedMetatags.split('\n').length === expectedLines,
          `${cid}/${palette}/vocal: lockedMetatags should have ${expectedLines} lines matching the chosen structure preset`);
      }
    }
  }
  console.log(`  instrumental merge + locked-tag parity: ${n} builds across all atom characters x both palettes x vocal/instrumental presets, 0 drift.`);
}

/* 4. PROMPT CONTENT — locked tags handed to the LLM verbatim, additive-only
 *    instruction present, generic instruction ABSENT when locked tags are
 *    used; generic instruction PRESENT (unchanged) when they're not. */
{
  const cid = Object.keys(ATOM_POOL_CHARACTERS)[0];
  const dna = buildMusicalDNA(ATOM_POOL_CHARACTERS[cid], 'electronic', { seed: 202, characterId: cid });
  const cil = inferCIL(dna);
  const structure = { songType: 'vocal', sections: STRUCTURE_PRESETS['verse-chorus'].sections, presetLabel: 'test' };
  const metatagBlock = runMetatagEngine({ dna, cil, renderMode: 'lean', sections: structure.sections }).block;
  const answers = { 'vocal.mode': 'vocal', 'song.subject': 'a coastline at dusk' };

  const briefLocked = assembleLyricBrief(dna, cil, answers, structure, metatagBlock);
  const promptLocked = buildLyricPrompt(briefLocked).prompt;
  ok(promptLocked.includes('LOCKED METATAGS'), 'locked-tag prompt should include the LOCKED METATAGS heading');
  ok(!promptLocked.includes('Place 3-5 short functional Suno metatags inside the lyrics string'),
    'locked-tag prompt should NOT also contain the generic invent-your-own-tags instruction');
  ok(/ADD your own short vocal-performance tag/.test(promptLocked),
    'locked-tag prompt should explicitly scope the model\u2019s own additions to the additive vocal-performance layer');
  metatagBlock.split('\n').forEach((line, i) => {
    ok(promptLocked.includes(line), `locked-tag prompt should include section ${i}'s locked tag verbatim: "${line}"`);
  });

  const briefRepairLocked = briefLocked; // repair reuses the same brief, as runLyricEngine does
  const repairPromptLocked = buildRepairPrompt(briefRepairLocked, { validation: { score: 40, issues: ['weak hook'] }, lyrics: '[Verse]\nplaceholder' });
  ok(repairPromptLocked.includes('LOCKED METATAGS'), 'repair prompt should carry the same locked-tag block as the original prompt (not silently dropped on repair)');

  const briefGeneric = assembleLyricBrief(dna, cil, answers, structure); // no 5th arg — omitted
  const promptGeneric = buildLyricPrompt(briefGeneric).prompt;
  ok(!promptGeneric.includes('LOCKED METATAGS'), 'omitting locked tags should reproduce the pre-2026-08-14 prompt exactly (no LOCKED METATAGS block)');
  ok(promptGeneric.includes('Place 3-5 short functional Suno metatags inside the lyrics string'),
    'omitting locked tags should keep the original generic instruction, unchanged');

  console.log('  prompt content: locked tags appear verbatim + additive-only scoping present; generic path unchanged when tags are omitted; repair carries the lock forward.');
}

/* 5. DEFENSIVE FALLBACK — a locked-tag block whose line count doesn't match
 *    this exact prompt's section list must NOT be handed off as
 *    authoritative (would silently point the model at the wrong tag for the
 *    wrong section) — falls back to the generic instruction instead. */
{
  const cid = Object.keys(ATOM_POOL_CHARACTERS)[0];
  const dna = buildMusicalDNA(ATOM_POOL_CHARACTERS[cid], 'electronic', { seed: 303, characterId: cid });
  const cil = inferCIL(dna);
  const structure = { songType: 'vocal', sections: STRUCTURE_PRESETS['verse-chorus'].sections, presetLabel: 'test' };
  const answers = { 'vocal.mode': 'vocal', 'song.subject': 'x' };
  const mismatchedBlock = '[Intro | test]\n[Verse | test]'; // deliberately wrong line count vs. verse-chorus's own section count
  ok(mismatchedBlock.split('\n').length !== structure.sections.length, 'sanity: mismatched block should actually have a different line count');

  const brief = assembleLyricBrief(dna, cil, answers, structure, mismatchedBlock);
  ok(brief.lockedMetatags === mismatchedBlock, 'brief should still carry the mismatched block as-is (the SAFETY check belongs in prompt assembly, not the brief)');
  const prompt = buildLyricPrompt(brief).prompt;
  ok(!prompt.includes('LOCKED METATAGS'), 'a line-count mismatch should fall back to the generic instruction rather than risk misaligned tags');
  ok(prompt.includes('Place 3-5 short functional Suno metatags inside the lyrics string'),
    'the generic instruction should be present when falling back from a mismatched locked block');
  console.log('  defensive fallback: a misaligned locked-tag block safely falls back to the generic instruction instead of risking wrong-section tags.');
}

/* 6. SCOPE — resolver/legacy get lockedMetatags === null (no metatag engine
 *    for those kinds yet) and reproduce the unchanged generic-instruction
 *    behaviour end to end through buildLiveLyricRequest(). */
{
  for (const [kind, engineId] of [['resolver', 'Delerium'], ['legacy', 'Balearic']]) {
    const S = initState();
    syncEngineDefaults(S, engineId);
    setSongType(S, 'vocal');
    const req = buildLiveLyricRequest(S);
    ok(req.lockedMetatags === null,
      `${kind} engine "${engineId}": lockedMetatags should be null (no metatag engine wired for this kind yet), got ${JSON.stringify(req.lockedMetatags)}`);
  }
  console.log('  scope: resolver/legacy correctly get lockedMetatags=null \u2014 unchanged generic-instruction behaviour, no metatag engine for those kinds yet.');
}

console.log(`validate-metatag-lyric-merge: ${checks} checks, ${fails} failures.`);
if (fails) process.exit(1);

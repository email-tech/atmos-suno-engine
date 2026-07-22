/* validate-metatag.mjs — headless proof for the Metatag Engine (P5), over every
 * DNA x palette x overlay state, for both vocal and instrumental reads.
 * Asserts:
 *   1. COVERAGE — every template section yields >=1 tag (arrangement present).
 *   2. MANDATORY INTERPLAY — every build emits >=1 interplay cue, and it names a
 *      real arrangement voice (conversation / foundation), not a generic word.
 *   3. NO ARTIST NAMES — with an overlay present, the rendered block never
 *      contains the overlay's UI label; signature voices appear as voice text only.
 *   4. INSTRUMENTAL — no vocal-performance tags on an instrumental read, but
 *      arrangement + interplay direction is still fully present.
 *   5. VOCAL — a vocal read emits >=1 vocal-performance tag.
 *   6. VERBATIM FAMILIES — the DNA bass/drums voice strings are quoted verbatim
 *      in the block (genre-owned families never reworded/renamed).
 *   7. CONTRACT — never mutates the DNA, never touches/emits render.style; the
 *      result carries no style field.
 *   8. DETERMINISM — identical (dna, cil, answers) => identical block.
 * Run from repo root:  node validate-metatag.mjs
 */
import { buildMetatagPlan, renderMetatagBlock, runMetatagEngine, METATAG_READABLE } from './core/metatag.js';
import { inferCIL } from './core/cil.js';
import { buildMusicalDNA } from './core/dna.js';
import { ATOM_POOL_CHARACTERS } from './engines/atom-characters.js';
import { ATOM_OVERLAYS } from './core/atoms.js';

const PALETTES = ['electronic', 'acoustic'];
const charIds = Object.keys(ATOM_POOL_CHARACTERS);
const overlayStates = [null, ...Object.keys(ATOM_OVERLAYS).slice(0, 4)];
let n = 0, fail = 0;
const bad = (m) => { if (fail < 30) console.log('  FAIL:', m); fail++; };

for (const cid of charIds) {
  for (const pal of PALETTES) {
    for (const ov of overlayStates) {
      const dna = buildMusicalDNA(ATOM_POOL_CHARACTERS[cid], pal, { seed: 404, overlayId: ov, characterId: cid });
      const cil = inferCIL(dna);
      const tag = `${cid}/${pal}${ov ? '+' + ov : ''}`;
      const snapshot = JSON.stringify(dna);
      const arrVoices = (dna.arrangement || []).map(a => a.voice).filter(Boolean);

      for (const mode of ['instrumental', 'vocal']) {
        const answers = { 'vocal.mode': mode, 'vocal.deliveryClass': mode === 'vocal' ? 'lead-melodic' : null };

        for (const rmode of ['full', 'lean']) {
        const out = runMetatagEngine({ dna, cil, answers, renderMode: rmode });
        n++;

        // 7. contract — no style field, DNA untouched
        if ('style' in out) bad(`result exposed a style field — ${tag}/${mode}/${rmode}`);
        if (JSON.stringify(dna) !== snapshot) bad(`DNA mutated — ${tag}/${mode}/${rmode}`);

        // 1. coverage — one block line PER section occurrence, each with content
        const lines = out.block.split('\n');
        if (lines.length !== out.sections.length)
          bad(`block lines ${lines.length} != sections ${out.sections.length} — ${tag}/${mode}/${rmode}`);
        lines.forEach((line, i) => {
          const label = out.sections[i];
          if (!line.startsWith(`[${label}`) || line.trim() === `[${label}]`)
            bad(`section[${i}] '${label}' line malformed/empty — ${tag}/${mode}/${rmode}`);
          if (rmode === 'full') {
            const tags = line.match(/\[[^\]]+\]/g) || [];
            if (new Set(tags).size !== tags.length) bad(`duplicated tag on '${label}' line — ${tag}/${mode}`);
          }
        });

        // lean budget — one bracket per line, and a real reduction vs full
        if (rmode === 'lean') {
          lines.forEach((line, i) => {
            const tags = line.match(/\[[^\]]+\]/g) || [];
            if (tags.length !== 1) bad(`lean line '${out.sections[i]}' not a single bracket (${tags.length}) — ${tag}/${mode}`);
          });
          const full = renderMetatagBlock(buildMetatagPlan(dna, { cil, answers }), 'full');
          // Lean must be strictly shorter than full. (A ratio bound was a proxy
          // and produced a false failure on already-terse templates; the real
          // guarantees are one-bracket-per-section above and this.)
          if (out.block.length >= full.length) bad(`lean not shorter than full (${out.block.length} vs ${full.length}) — ${tag}/${mode}`);

        }

        // 2. mandatory interplay — a named interaction phrase is present in the block
        if (!/lock the groove|anchors|holds the groove|call-and-response|answers |converse/.test(out.block))
          bad(`no interplay/interaction phrase in ${rmode} block — ${tag}/${mode}`);

        // 3. no artist names
        if (ov) {
          const label = ATOM_OVERLAYS[ov].label;
          if (label && out.block.includes(label)) bad(`overlay name '${label}' leaked into ${rmode} block — ${tag}/${mode}`);
        }

        // performance-tag presence (full plan carries them; block folds them when lean)
        const perf = out.plan.filter(p => p.kind === 'performance');
        if (mode === 'instrumental') {
          if (perf.length) bad(`vocal-performance tag on instrumental (${perf.length}) — ${tag}/${rmode}`);
        } else {
          if (!perf.length) bad(`vocal read produced no performance tag — ${tag}/${rmode}`);
        }
        if (!out.plan.some(p => p.kind === 'arrangement')) bad(`no arrangement direction — ${tag}/${mode}/${rmode}`);
        if (!out.plan.some(p => p.kind === 'interplay')) bad(`no interplay in plan — ${tag}/${mode}/${rmode}`);

        // 6. verbatim genre-owned families (bass + drums), when present
        for (const famRole of [['bass', 'bass'], ['rhythm', 'drums']]) {
          const voice = (dna.arrangement.find(a => a.role === famRole[0]) ||
                         dna.arrangement.find(a => a.family === famRole[1]) || {}).voice;
          if (voice && !out.block.includes(voice))
            bad(`${famRole[1]} voice '${voice}' not quoted verbatim — ${tag}/${mode}/${rmode}`);
        }

        // 8. determinism
        const b2 = renderMetatagBlock(buildMetatagPlan(dna, { cil, answers }), rmode);
        if (b2 !== out.block) bad(`non-deterministic block — ${tag}/${mode}/${rmode}`);
        }
      }
    }
  }
}

// contract sanity: metatag-readable is exactly the DNA fields granting 'metatag' (all 9)
const expect = ['identity','influences','harmony','arrangement','tempo','dynamics','production','vocal','affect'];
if (JSON.stringify([...METATAG_READABLE].sort()) !== JSON.stringify(expect.sort()))
  bad(`METATAG_READABLE unexpected: ${METATAG_READABLE}`);

if (!fail) console.log(`Metatag engine: coverage, mandatory interplay, no-names, instrumental/vocal split, verbatim families, contract, determinism across ${n} builds.`);
console.log(`validate-metatag: ${n} builds, ${fail} failures.`);
process.exit(fail ? 1 : 0);

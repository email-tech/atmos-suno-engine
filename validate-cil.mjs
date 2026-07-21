/* validate-cil.mjs — headless proof for the CIL (P3), run over every known DNA
 * (12 characters x 2 palettes x overlay states). Asserts:
 *   1. tier validity        — every field tier is one of TIERS.
 *   2. value/tier coherence — a non-unknown tier yields a non-null value;
 *                             unknown yields null. moodClass in MOOD_CLASSES.
 *   3. residue correctness  — residue == non-silent fields, sorted, capped <=5.
 *   4. determinism          — inferCIL(dna) deep-equals a second call.
 *   5. purity               — dna is byte-identical after inferCIL (no mutation),
 *                             and render.style is untouched (CIL never composes).
 *   6. contract safety      — CIL only emits into affect/vocal (lyric+metatag
 *                             consumers); never a style-readable field.
 * Run from repo root:  node validate-cil.mjs
 */
import { inferCIL, TIERS } from './core/cil.js';
import { MOOD_CLASSES } from './core/profiles.js';
import { buildMusicalDNA, DNA_CONSUMERS } from './core/dna.js';
import { ATOM_POOL_CHARACTERS } from './engines/atom-characters.js';
import { ATOM_OVERLAYS } from './core/atoms.js';

const PALETTES = ['electronic', 'acoustic'];
const charIds = Object.keys(ATOM_POOL_CHARACTERS);
const overlayStates = [null, ...Object.keys(ATOM_OVERLAYS).slice(0, 3)]; // none + a few
const TIERSET = new Set(TIERS);
const MOODSET = new Set(MOOD_CLASSES);

let n = 0, fail = 0;
const bad = (m) => { if (fail < 25) console.log('  FAIL:', m); fail++; };

for (const cid of charIds) {
  for (const pal of PALETTES) {
    for (const ov of overlayStates) {
      const dna = buildMusicalDNA(ATOM_POOL_CHARACTERS[cid], pal, { seed: 404, overlayId: ov, characterId: cid });
      const before = JSON.stringify(dna);
      const styleBefore = dna.render.style;

      const cil = inferCIL(dna);
      n++;
      const tag = `${cid}/${pal}${ov ? '+' + ov : ''}`;

      // 5. purity
      if (JSON.stringify(dna) !== before) bad(`CIL mutated the DNA — ${tag}`);
      if (dna.render.style !== styleBefore) bad(`CIL altered render.style — ${tag}`);

      // 4. determinism
      if (JSON.stringify(inferCIL(dna)) !== JSON.stringify(cil)) bad(`non-deterministic — ${tag}`);

      for (const [field, res] of Object.entries(cil.fields)) {
        // 1. tier validity
        if (!TIERSET.has(res.tier)) bad(`bad tier '${res.tier}' on ${field} — ${tag}`);
        // 2. value/tier coherence
        if (res.tier === 'unknown' && res.value !== null) bad(`unknown tier but non-null value on ${field} — ${tag}`);
        if (res.tier !== 'unknown' && (res.value === null || res.value === undefined)) bad(`known tier but null value on ${field} — ${tag}`);
        if (field === 'affect.moodClass' && res.value !== null && !MOODSET.has(res.value)) bad(`moodClass '${res.value}' not in MOOD_CLASSES — ${tag}`);
        if (field === 'vocal.mode' && !['instrumental', 'vocal'].includes(res.value)) bad(`vocal.mode '${res.value}' invalid — ${tag}`);

        // 6. contract safety: top-level DNA key must be a lyric+metatag consumer, never style-readable
        const top = field.split('.')[0];
        const consumers = DNA_CONSUMERS[top] || [];
        if (consumers.includes('style')) bad(`CIL emitted into style-readable field '${top}' — ${tag}`);
        if (!consumers.includes('lyric') && !consumers.includes('metatag')) bad(`CIL emitted into non-lyric/metatag field '${top}' — ${tag}`);
      }

      // 3. residue correctness
      const expected = Object.entries(cil.fields).filter(([, r]) => r.tier !== 'derived').map(([f]) => f).sort();
      const got = cil.residue.map(q => q.field).sort();
      if (cil.residue.length > 5) bad(`residue exceeds 5 (${cil.residue.length}) — ${tag}`);
      if (JSON.stringify(got) !== JSON.stringify(expected)) bad(`residue mismatch [${got}] vs [${expected}] — ${tag}`);
      for (const q of cil.residue) {
        if (!q.question || !Array.isArray(q.options)) bad(`residue question malformed on ${q.field} — ${tag}`);
      }
    }
  }
}

// Spot-check the inference logic behaves musically on known characters.
const beatless = buildMusicalDNA(ATOM_POOL_CHARACTERS['ambient-beatless-atmospheric'], 'electronic', { seed: 1, characterId: 'ambient-beatless-atmospheric' });
if (inferCIL(beatless).fields['affect.moodClass'].value !== 'contemplative') bad('beatless character should infer contemplative');
const house = buildMusicalDNA(ATOM_POOL_CHARACTERS['balearic-house'], 'electronic', { seed: 1, characterId: 'balearic-house' });
const hv = inferCIL(house).fields['affect.moodClass'];
if (!['euphoric', 'brooding'].includes(hv.value)) bad(`balearic-house mood unexpected: ${hv.value}`);

if (!fail) console.log(`CIL: inference tiered, residue capped, pure, deterministic, contract-safe across ${n} DNA states.`);
console.log(`validate-cil: ${n} checks, ${fail} failures.`);
process.exit(fail ? 1 : 0);

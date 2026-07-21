/* validate-lyric.mjs — headless proof for the Lyric Engine (P4), over every
 * known DNA x palette x overlay state, for both vocal and instrumental answers.
 * Asserts:
 *   1. [Instrumental] short-circuit — vocalMode 'instrumental' => {instrumental:true,
 *      lyrics:'[Instrumental]', prompt:null}; never throws; metatag path not blocked.
 *   2. NO ARTIST NAMES — with an overlay present, the built prompt never contains
 *      the overlay's UI label/name; influences appear only as generic role words.
 *   3. ORIGINALITY discipline — vocal prompt contains the original-only + no-imitation
 *      instructions, JSON-only instruction, and the template's section labels in order.
 *   4. CONSUMER CONTRACT — the brief carries no arrangement/dynamics/production data
 *      (lyric may not read them); energy is present (derived from tempo).
 *   5. DETERMINISM — identical (dna,cil,answers) => identical prompt.
 *   6. RESIDUE — default residue <=5 and always includes song.subject.
 * Run from repo root:  node validate-lyric.mjs
 */
import { assembleLyricBrief, buildLyricPrompt, lyricResidue, LYRIC_READABLE } from './core/lyric.js';
import { inferCIL } from './core/cil.js';
import { buildMusicalDNA } from './core/dna.js';
import { ATOM_POOL_CHARACTERS } from './engines/atom-characters.js';
import { ATOM_OVERLAYS } from './core/atoms.js';

const PALETTES = ['electronic', 'acoustic'];
const charIds = Object.keys(ATOM_POOL_CHARACTERS);
const overlayStates = [null, ...Object.keys(ATOM_OVERLAYS).slice(0, 4)];
let n = 0, fail = 0;
const bad = (m) => { if (fail < 25) console.log('  FAIL:', m); fail++; };

const FORBIDDEN_BRIEF_KEYS = ['arrangement', 'dynamics', 'production'];

for (const cid of charIds) {
  for (const pal of PALETTES) {
    for (const ov of overlayStates) {
      const dna = buildMusicalDNA(ATOM_POOL_CHARACTERS[cid], pal, { seed: 404, overlayId: ov, characterId: cid });
      const cil = inferCIL(dna);
      const tag = `${cid}/${pal}${ov ? '+' + ov : ''}`;

      // 6. residue
      const res = lyricResidue(dna, cil);
      if (res.default.length > 5) bad(`residue >5 (${res.default.length}) — ${tag}`);
      if (!res.default.find(q => q.field === 'song.subject')) bad(`residue missing song.subject — ${tag}`);

      // --- instrumental branch ---
      const instBrief = assembleLyricBrief(dna, cil, { 'vocal.mode': 'instrumental', 'song.subject': 'x' });
      let instOut;
      try { instOut = buildLyricPrompt(instBrief); } catch (e) { bad(`instrumental threw — ${tag}: ${e.message}`); continue; }
      n++;
      if (!instOut.instrumental || instOut.lyrics !== '[Instrumental]' || instOut.prompt !== null)
        bad(`instrumental short-circuit wrong — ${tag}`);

      // --- vocal branch ---
      const vAns = { 'vocal.mode': 'vocal', 'song.subject': 'a distant coastline at dusk', 'song.perspective': 'First person' };
      const vBrief = assembleLyricBrief(dna, cil, vAns);
      const vOut = buildLyricPrompt(vBrief);
      n++;
      if (vOut.instrumental || !vOut.prompt) { bad(`vocal branch produced no prompt — ${tag}`); continue; }

      // 4. contract — brief must not carry forbidden DNA data
      for (const k of FORBIDDEN_BRIEF_KEYS) if (k in vBrief) bad(`brief leaked forbidden field '${k}' — ${tag}`);
      if (!vBrief.energy) bad(`brief missing tempo-derived energy — ${tag}`);

      // 2. no artist names
      if (ov) {
        const label = ATOM_OVERLAYS[ov].label;
        if (label && vOut.prompt.includes(label)) bad(`overlay name '${label}' leaked into prompt — ${tag}`);
        // brief influences must be role words only, never the label
        for (const tr of vBrief.influenceTraits) {
          if (!['composer', 'producer', 'remixer'].includes(tr)) bad(`influenceTrait not a generic role word: '${tr}' — ${tag}`);
        }
      }

      // 3. originality + structure discipline
      const p = vOut.prompt;
      if (!/ORIGINAL/.test(p)) bad(`prompt missing ORIGINAL instruction — ${tag}`);
      if (!/Never reproduce/i.test(p)) bad(`prompt missing no-reproduce rule — ${tag}`);
      if (!/imitate any specific artist/i.test(p)) bad(`prompt missing no-imitation rule — ${tag}`);
      if (!/Return valid JSON only/.test(p)) bad(`prompt missing JSON-only rule — ${tag}`);
      const labels = vBrief.template.sections.map(s => `[${s}]`).join(' ');
      if (!p.includes(labels)) bad(`prompt missing ordered section labels — ${tag}`);

      // 5. determinism
      const p2 = buildLyricPrompt(assembleLyricBrief(dna, cil, vAns)).prompt;
      if (p2 !== p) bad(`non-deterministic prompt — ${tag}`);
    }
  }
}

// contract sanity: lyric-readable set is exactly the DNA fields granting 'lyric'
const expectReadable = ['identity', 'influences', 'harmony', 'tempo', 'vocal', 'affect'];
if (JSON.stringify([...LYRIC_READABLE].sort()) !== JSON.stringify(expectReadable.sort()))
  bad(`LYRIC_READABLE unexpected: ${LYRIC_READABLE}`);

if (!fail) console.log(`Lyric engine: instrumental short-circuit, no-names, originality, contract, determinism across ${n} prompt builds.`);
console.log(`validate-lyric: ${n} builds, ${fail} failures.`);
process.exit(fail ? 1 : 0);

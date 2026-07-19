/* validate-atoms.mjs — headless harness for the atom assembly path.
 * Checks, over many seeds x characters x overlays:
 *   - char limit (<=1000)                       - determinism (same seed -> same style)
 *   - no duplicate instrument nouns in a prompt  - congruence gating (lean + takeover)
 *   - genre anchor front-loaded, mastering tail  - no banned/non-musical leaks
 * Run from repo root:  node validate-atoms.mjs
 */
import { buildAtoms, ATOM_OVERLAYS } from './core/atoms.js';
import { ATOM_CHARACTERS } from './engines/atom-balearic.js';
import { CHAR_LIMIT, ALWAYS_BAN } from './core/constants.js';

const DRAWS = 6000;
const charIds = Object.keys(ATOM_CHARACTERS);
const ovIds = [null, ...Object.keys(ATOM_OVERLAYS)];
let n = 0, fail = 0;
const bad = (msg) => { if (fail < 20) console.log('  FAIL:', msg); fail++; };

// instrument-noun dup scan: flag a noun that heads two different clauses
const NOUNS = ['sub bass','synth-bass','downtempo kit','lounge/house kit','frame-drum','shaker',
  'Rhodes','arpeggiated synth','soft piano','piano and glassy-mallet','sawtooth','synth pads',
  'string bed','plucked strings','pipe-organ','cor-anglais','cello','clarinet','glockenspiel',
  'flute','tubular-bell','pulsing synth texture','handclap','tambourine'];
function dupInstruments(style){
  const s = style.toLowerCase();
  return NOUNS.filter(nn => {
    const re = new RegExp(nn.toLowerCase().replace(/[.*+?^${}()|[\]\\/]/g,'\\$&'), 'g');
    return (s.match(re) || []).length > 1;
  });
}

for (let i = 0; i < DRAWS; i++) {
  const cid = charIds[i % charIds.length];
  const ov = ovIds[i % ovIds.length];
  const char = ATOM_CHARACTERS[cid];
  const seed = (i * 2654435761) >>> 0;
  const r = buildAtoms(char, { seed, overlayId: ov });
  n++;

  if (r.length > CHAR_LIMIT) bad(`over limit ${r.length} — ${cid}/${ov}`);
  if (!r.style.startsWith(char.atoms.genre.text)) bad(`genre anchor not front-loaded — ${cid}`);
  if (!r.style.trim().endsWith(char.mastering)) bad(`mastering not at tail — ${cid}`);

  const dups = dupInstruments(r.style);
  if (dups.length) bad(`duplicate instrument(s) [${dups.join(', ')}] — ${cid}/${ov}`);

  const leak = ALWAYS_BAN.find(b => r.style.toLowerCase().includes(b.toLowerCase()));
  if (leak) bad(`banned non-musical term "${leak}" leaked into style — ${cid}/${ov}`);

  // determinism
  const r2 = buildAtoms(char, { seed, overlayId: ov });
  if (r2.style !== r.style) bad(`non-deterministic — ${cid}/${ov} seed ${seed}`);

  // congruence: electronic-only overlay on a non-electronic char must be refused
  if (ov) {
    const c = ATOM_OVERLAYS[ov].congruence || {};
    const refused = !!r.overlayNote;
    const shouldRefuse = (c.lean === 'electronic' && !char.electronicLean) ||
                         (c.engines && !c.engines.includes(char.source));
    if (shouldRefuse && !refused) bad(`overlay ${ov} should be refused on ${cid} but applied`);
    if (!shouldRefuse && refused) bad(`overlay ${ov} wrongly refused on ${cid}`);
    // takeover gate: a refused overlay must equal the bare prompt
    if (refused) {
      const bare = buildAtoms(char, { seed, overlayId: null });
      if (bare.style !== r.style) bad(`refused overlay ${ov} altered the prompt — ${cid}`);
    }
    // genre-owned families a composer may not seize must survive untouched
    if (!refused && c.takeover) {
      const bare = buildAtoms(char, { seed, overlayId: null });
      for (const fam of (char.genreOwned || [])) {
        if (!c.takeover[fam]) {
          // the bass/drums text from the bare prompt must still be present
          const bassBare = bare.arrangement.find(a => a.family === fam);
          if (bassBare && bassBare.instrument && !r.style.includes(bassBare.instrument))
            bad(`overlay ${ov} seized genre-owned ${fam} on ${cid} (takeover forbidden)`);
        }
      }
    }
  }
}

console.log(`atom path: ${n} draws, ${fail} failures.`);
process.exit(fail ? 1 : 0);

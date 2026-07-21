/* validate-dna.mjs — Musical DNA emitter checks.
 * Verifies DNA emits for every character x palette x overlay-state, carries the
 * required shape + consumer contracts + seed, is deterministic, and is ADDITIVE
 * (its render.style equals a fresh buildAtoms call — DNA changes no rendering). */
import { buildMusicalDNA, DNA_CONSUMERS } from './core/dna.js';
import { buildAtoms, ATOM_OVERLAYS } from './core/atoms.js';
import { ATOM_POOL_CHARACTERS, atomCharacterForPalette } from './engines/atom-characters.js';

let fail = 0;
const bad = (m) => { if (fail < 25) console.log('  FAIL:', m); fail++; };

const ids = Object.keys(ATOM_POOL_CHARACTERS);
const oneOf = (kind) => Object.keys(ATOM_OVERLAYS).find(k => ATOM_OVERLAYS[k].kind === kind);
const overlays = [null, oneOf('composer'), oneOf('producer'), oneOf('remixer')];
const REQUIRED = ['meta','identity','influences','harmony','arrangement','tempo','dynamics','production','vocal','affect','provenance','consumers','render'];

// contract invariant: affect must never be readable by style.
if (DNA_CONSUMERS.affect.includes('style')) bad('affect is readable by style — contract breach');
if (!DNA_CONSUMERS.arrangement.includes('style')) bad('arrangement not readable by style');

let count = 0;
for (const id of ids) {
  for (const palette of ['electronic','acoustic']) {
    const base = ATOM_POOL_CHARACTERS[id];
    for (const ov of overlays) {
      for (const seed of [11, 909]) {
        count++;
        let dna;
        try { dna = buildMusicalDNA(base, palette, { seed, overlayId: ov, characterId: id }); }
        catch (e) { bad(`${id}/${palette}/${ov} threw: ${e.message}`); continue; }

        for (const k of REQUIRED) if (!(k in dna)) bad(`${id}/${palette}/${ov} missing field ${k}`);
        if (dna.meta.seed !== seed) bad(`${id}/${palette}/${ov} seed not captured`);
        if (dna.meta.palette !== palette) bad(`${id}/${palette}/${ov} palette mismatch`);
        if (!dna.identity.genreAnchor) bad(`${id}/${palette}/${ov} no genre anchor`);
        if (!Array.isArray(dna.arrangement) || !dna.arrangement.length) bad(`${id}/${palette}/${ov} empty arrangement`);
        if (dna.vocal.mode !== 'instrumental') bad(`${id}/${palette}/${ov} vocal default not instrumental`);
        if (dna.provenance.affect !== 'unknown') bad(`${id}/${palette}/${ov} affect provenance not unknown`);

        // every arrangement voice is tagged with origin + a voice string
        for (const v of dna.arrangement) {
          if (v.origin !== 'engine' && v.origin !== 'overlay') bad(`${id}/${palette}/${ov} untagged voice origin`);
          if (!v.voice) bad(`${id}/${palette}/${ov} arrangement entry has no voice`);
        }

        // overlay bookkeeping
        const fresh = buildAtoms(atomCharacterForPalette(base, palette), { seed, overlayId: ov });
        const refused = !!fresh.overlayNote;
        if (ov) {
          if (dna.influences.length !== 1) bad(`${id}/${palette}/${ov} influence not recorded`);
          else if (dna.influences[0].applied === refused) bad(`${id}/${palette}/${ov} influence.applied wrong`);
          if (refused && !dna.meta.overlayRefused) bad(`${id}/${palette}/${ov} refusal not noted`);
        } else if (dna.influences.length) bad(`${id}/${palette} spurious influence on bare build`);

        // ADDITIVE: DNA must not change rendering
        if (dna.render.style !== fresh.style) bad(`${id}/${palette}/${ov} render.style diverges from buildAtoms`);

        // determinism: identical inputs -> identical DNA
        const again = buildMusicalDNA(base, palette, { seed, overlayId: ov, characterId: id });
        if (JSON.stringify(again) !== JSON.stringify(dna)) bad(`${id}/${palette}/${ov} DNA non-deterministic`);
      }
    }
  }
}

console.log(fail
  ? `\nDNA: ${fail} failure(s) across ${count} emissions.`
  : `DNA: ${count} emissions across ${ids.length} characters x 2 palettes x ${overlays.length} overlay-states — schema, contracts, determinism, additive-parity all clean.`);
process.exit(fail ? 1 : 0);

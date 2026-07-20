/* validate-atoms.mjs — headless harness for the atom assembly path.
 * Covers the 12 Balearic clusters wired as atom characters (engines/atom-
 * characters.js) across BOTH palettes x overlays, plus a seed-parity GOLDEN for
 * the Suno-validated reference character (engines/atom-balearic.js) so wiring the
 * pools never disturbs the proven output.
 * Run from repo root:  node validate-atoms.mjs
 */
import { buildAtoms, ATOM_OVERLAYS } from './core/atoms.js';
import { ATOM_POOL_CHARACTERS, atomCharacterForPalette } from './engines/atom-characters.js';
import { ATOM_CHARACTERS } from './engines/atom-balearic.js';
import { CHAR_LIMIT, ALWAYS_BAN } from './core/constants.js';

const DRAWS = 12000;
const PALETTES = ['electronic', 'acoustic'];
const charIds = Object.keys(ATOM_POOL_CHARACTERS);
const ovIds = [null, ...Object.keys(ATOM_OVERLAYS)];
let n = 0, fail = 0;
const bad = (msg) => { if (fail < 25) console.log('  FAIL:', msg); fail++; };

// Reconcile keeps one voice per family; no two DRAWN instruments should share a
// name (one being the other, or one contained in the other, e.g. "cajón" inside
// "cajón kit"). This is a data-level check on the arrangement, independent of the
// prose text atoms (an arc line may legitimately echo a motif name).
function dupInstruments(arrangement) {
  const names = arrangement.filter(a => a.instrument).map(a => a.instrument.toLowerCase());
  const out = [];
  for (let x = 0; x < names.length; x++)
    for (let y = x + 1; y < names.length; y++) {
      const a = names[x], b = names[y];
      if (a === b || a.includes(b) || b.includes(a)) out.push(`${names[x]} ~ ${names[y]}`);
    }
  return out;
}

for (let i = 0; i < DRAWS; i++) {
  const cid = charIds[i % charIds.length];
  const pal = PALETTES[i % PALETTES.length];
  const ov = ovIds[i % ovIds.length];
  const char = atomCharacterForPalette(ATOM_POOL_CHARACTERS[cid], pal);
  const seed = (i * 2654435761) >>> 0;
  const r = buildAtoms(char, { seed, overlayId: ov });
  n++;
  const tag = `${cid}/${pal}/${ov}`;

  if (r.length > CHAR_LIMIT) bad(`over limit ${r.length} — ${tag}`);
  if (!r.style.startsWith(char.atoms.genre.text)) bad(`genre anchor not front-loaded — ${tag}`);
  if (!r.style.trim().endsWith(char.mastering)) bad(`mastering not at tail — ${tag}`);

  const engineSurv = r.arrangement.filter(a => a.source !== 'overlay' && a.instrument);
  for (const a of engineSurv)
    if (!r.style.includes(a.instrument)) bad(`drawn instrument "${a.instrument}" missing from style — ${tag}`);

  const drawn = r.arrangement.filter(a => a.instrument).map(a => a.instrument);
  const dups = dupInstruments(r.arrangement);
  if (dups.length) bad(`duplicate instrument(s) [${dups.join(', ')}] — ${tag}`);

  const leak = ALWAYS_BAN.find(b => r.style.toLowerCase().includes(b.toLowerCase()));
  if (leak) bad(`banned non-musical term "${leak}" leaked — ${tag}`);

  const r2 = buildAtoms(char, { seed, overlayId: ov });
  if (r2.style !== r.style) bad(`non-deterministic — ${tag} seed ${seed}`);

  if (ov) {
    const c = ATOM_OVERLAYS[ov].congruence || {};
    const refused = !!r.overlayNote;
    const shouldRefuse = (c.lean === 'electronic' && !char.electronicLean) ||
                         (c.engines && !c.engines.includes(char.source));
    if (shouldRefuse && !refused) bad(`overlay ${ov} should be refused on ${tag} but applied`);
    if (!shouldRefuse && refused) bad(`overlay ${ov} wrongly refused on ${tag}`);
    if (refused) {
      const bare = buildAtoms(char, { seed, overlayId: null });
      if (bare.style !== r.style) bad(`refused overlay ${ov} altered the prompt — ${tag}`);
    }
    if (!refused && c.takeover) {
      const bare = buildAtoms(char, { seed, overlayId: null });
      for (const fam of (char.genreOwned || [])) {
        if (!c.takeover[fam]) {
          const owned = bare.arrangement.find(a => a.family === fam);
          if (owned && owned.instrument && !r.style.includes(owned.instrument))
            bad(`overlay ${ov} seized genre-owned ${fam} on ${tag} (takeover forbidden)`);
        }
      }
    }
  }
}

// ---- SEED-PARITY GOLDEN: validated reference must be byte-identical ----------
const REF = ATOM_CHARACTERS['balearic-lush-cinematic'];
const GOLDEN = {
  '7|null': 'Balearic downtempo, mid chill, 90-105 BPM, medium energy, deep sub bass and a soft downtempo kit, locked in a soft, spacious pocket that anchors without intruding, a light frame-drum pulse threading the groove, a warm Rhodes electric-piano motif carrying the melody out front, lush layered synth pads moving through suspended add9 voicings opening into a major-seventh resolution, a soft sweeping string bed beneath the harmony, a low pipe-organ sustain sustaining under the chords, a clarinet counter-line, pianissimo, faint and buried well under the mix, answering only occasionally in a distant call-and-response with the lead, wide stereo panning and slow filter modulation across the pads, the melody stating a phrase and the chords swelling to meet and resolve it, a slow dynamic arc, layers stacking to a lush peak then receding, Polished Dolby Atmos-Master Atmos -2dB',
  '42|null': 'Balearic downtempo, mid chill, 90-105 BPM, medium energy, deep FM sub-bass and a soft downtempo kit, locked in a soft, spacious pocket that anchors without intruding, a light frame-drum pulse threading the groove, a warm arpeggiated synth lead carrying the melody out front, lush layered synth pads moving through a slow minor-to-relative-major progression over eight-bar cycles, soft layered strings beneath the harmony, a low pipe-organ sustain sustaining under the chords, a clarinet counter-line, pianissimo, faint and buried well under the mix, answering only occasionally in a distant call-and-response with the lead, an occasional glockenspiel accent in the gaps, LFO, chorus and phaser movement evolving across the synth layers, the melody stating a phrase and the chords swelling to meet and resolve it, a slow dynamic arc, layers stacking to a lush peak then receding, Polished Dolby Atmos-Master Atmos -2dB',
};
let parityFail = 0;
for (const [k, want] of Object.entries(GOLDEN)) {
  const [seed, ov] = k.split('|');
  const got = buildAtoms(REF, { seed: Number(seed), overlayId: ov === 'null' ? null : ov }).style;
  if (got !== want) { parityFail++; fail++; console.log(`  PARITY FAIL: validated ref seed ${seed} drifted`); }
}
if (!parityFail) console.log('parity: validated reference byte-identical (golden held).');

// ---- CROSS-COMPOSER DISTINCTNESS -------------------------------------------
// John's requirement: every composer is unmistakable. On a FIXED base character
// + seed, each composer must (a) render its own signature phrase, and (b) that
// phrase must appear in NO other composer's output — proving they're distinct,
// not just tonal variants. Runs on an electronic-lean character so electronic
// composers apply too (they'd be refused on a downtempo char).
function sigText(ov){ const a = Object.values(ov.atoms).find(x => x.signature); return a ? (a.text || a.instrument) : null; }
const composerIds = Object.keys(ATOM_OVERLAYS).filter(id => ATOM_OVERLAYS[id].kind === 'composer');
const baseElec = atomCharacterForPalette(ATOM_POOL_CHARACTERS['balearic-house'], 'electronic');
const baseAcou = atomCharacterForPalette(ATOM_POOL_CHARACTERS['lush-cinematic-chillout'], 'acoustic');
let distinctFail = 0;
const dbad = (m) => { if (distinctFail < 15) console.log('  DISTINCT FAIL:', m); distinctFail++; fail++; };

for (const seed of [7, 101, 2024]) {
  const rendered = {};   // id -> style (on whichever base accepts it)
  for (const id of composerIds) {
    const ov = ATOM_OVERLAYS[id];
    const elec = ov.congruence.lean === 'electronic';
    const base = elec ? baseElec : baseAcou;
    const r = buildAtoms(base, { seed, overlayId: id });
    if (r.overlayNote) { dbad(`${id} refused on its own base (${r.overlayNote})`); continue; }
    rendered[id] = r.style;
    const sig = sigText(ov);
    if (sig && !r.style.includes(sig)) dbad(`${id} signature phrase absent from its output @${seed}`);
  }
  // each composer's signature must be unique to it across the same-lean cohort
  for (const id of composerIds) {
    const ov = ATOM_OVERLAYS[id], sig = sigText(ov);
    if (!sig) continue;
    for (const other of composerIds) {
      if (other === id) continue;
      if (ATOM_OVERLAYS[other].congruence.lean !== ov.congruence.lean) continue;
      if (rendered[other] && rendered[other].includes(sig))
        dbad(`${id} signature also appears in ${other} @${seed} (not distinct)`);
    }
  }
}
if (!distinctFail) console.log(`distinctness: ${composerIds.length} composers each render a unique signature.`);

console.log(`atom path: ${n} draws across ${charIds.length} characters x ${PALETTES.length} palettes, ${fail} failures.`);
process.exit(fail ? 1 : 0);

/* ==========================================================================
 * atom-characters.js — the 12 Balearic clusters WIRED as atom characters.
 *
 * Each cluster in atom-pools.js becomes ONE atom character (John, 2026-07-20:
 * "one cluster = one character"). Palette (electronic | acoustic) is an AXIS,
 * not a separate character — collect() draws per role FROM THE SELECTED PALETTE.
 *
 * ATOMS HOLD PURE INSTRUMENT NAMES ONLY. All timbre / level / interplay language
 * is assembled at compose (core/atoms.js) from the structured attribute fields
 * below — never fused into the instrument string. The pools are already bare
 * names, so an atom's `instrument` is just that role's pool array for the palette
 * and `timbre` stays empty; compose supplies the relational/interaction language.
 *
 * The Suno-validated reference character still lives in atom-balearic.js and is
 * the seed-parity anchor for the harness; migrating IT onto this substrate
 * (staying byte-identical) is a separate open item.
 * ========================================================================*/
import { ATOM_POOLS_BALEARIC } from './atom-pools.js';

const MASTERING = 'Polished Dolby Atmos-Master Atmos -2dB';

// House-family + the one explicitly-electronic cluster lean electronic; these
// accept an electronic-only overlay (Moroder). Everything else is downtempo /
// acoustic-leaning and REFUSES it (2026-07-17 congruence finding).
const ELECTRONIC_LEAN = new Set([
  'dreamy-analog-electronic', 'balearic-house', 'nu-disco-slo-mo',
  'melodic-deep-house', 'lounge-house',
]);

// Pool role -> atom key + family + the structural (non-prose) attributes compose
// reads. instrument is filled per palette from the pool; timbre stays [] (pure
// identity — compose adds the language). Order here is documentation only;
// compose fixes clause order.
const ROLE_SPEC = {
  bass:    { key:'bass',    family:'bass',    register:'sub',      fn:'foundation-weight', priority:'core' },
  rhythm:  { key:'groove',  family:'drums',   register:'low-mid',  fn:'groove',            priority:'core' },
  perc:    { key:'perc',    family:'perc',    register:'high',     fn:'groove-thread',     priority:'decorative' },
  pads:    { key:'pads',    family:'pad',     register:'mid',      fn:'harmony-bed',       priority:'core' },
  strings: { key:'strings', family:'strings', register:'mid',      fn:'support-bed',       priority:'support' },
  texture: { key:'texture', family:'texture', register:'low-mid',  fn:'sustain-under',     priority:'decorative' },
  motif:   { key:'lead',    family:'lead',    register:'upper-mid',fn:'foreground-melody', priority:'core' },
  // counter carries the hard-won "answer without dominating" LEVEL as structured
  // attributes (not baked into the name) so a counter voice never over-renders.
  counter: { key:'counter', family:'counter', register:'low',     fn:'answer',            priority:'support',
             prominence:'background', mix:'faint and buried well under the mix',
             dynamic:'pianissimo', density:'answering only occasionally' },
  // pool role is spelled 'color'; compose owns the 'colour' family.
  color:   { key:'colour',  family:'colour',  register:'high',     fn:'accent',            priority:'decorative', chance:0.5 },
};

function paletteAtoms(cluster, pal) {
  const src = cluster[pal] || {};
  const atoms = {
    genre: { role:'genre', text: cluster.genre },
    tempo: { role:'tempo', text: cluster.tempo },
  };
  for (const [poolRole, spec] of Object.entries(ROLE_SPEC)) {
    // beatless characters emit no drum kit; skip empty pool roles entirely.
    if (cluster.beatless && poolRole === 'rhythm') continue;
    const names = src[poolRole];
    if (!names || !names.length) continue;
    const a = { role: spec.family === 'drums' ? 'rhythm' : poolRole,
                family: spec.family, register: spec.register, fn: spec.fn,
                instrument: names.slice(), timbre: [], priority: spec.priority };
    if (spec.prominence) a.prominence = spec.prominence;
    if (spec.mix) a.mix = spec.mix;
    if (spec.dynamic) a.dynamic = spec.dynamic;
    if (spec.density) a.density = spec.density;
    if (spec.chance != null) a.chance = spec.chance;
    atoms[spec.key] = a;
  }
  // harmony + movement are structural TEXT atoms drawn from cluster metadata.
  if (cluster.harmony && cluster.harmony.length)
    atoms.harmony = { role:'harmony', family:'harmony', register:'mid', fn:'chord-movement',
                      text: cluster.harmony.slice(), priority:'core' };
  if (cluster.movement && cluster.movement.length)
    atoms.movement = { role:'movement', family:'production', register:'n/a', fn:'movement',
                       text: cluster.movement.slice(), priority:'support' };
  return atoms;
}

function buildCharacters() {
  const out = {};
  for (const [key, cluster] of Object.entries(ATOM_POOLS_BALEARIC)) {
    const electronic = paletteAtoms(cluster, 'electronic');
    const acoustic   = paletteAtoms(cluster, 'acoustic');
    out[key] = {
      label: cluster.label,
      source: 'Balearic',
      electronicLean: ELECTRONIC_LEAN.has(key),
      genreOwned: ['bass', 'drums'],
      beatless: !!cluster.beatless,
      mastering: MASTERING,
      // palette axis: generate resolves char.atoms = palettes[palette].
      palettes: { electronic, acoustic },
      // default so any code reading char.atoms.tempo (lists/validation) works.
      atoms: electronic,
    };
  }
  return out;
}

export const ATOM_POOL_CHARACTERS = buildCharacters();

// Resolve a character's atom table for a palette (generate calls this).
export function atomCharacterForPalette(char, palette) {
  if (!char.palettes) return char;                       // e.g. the validated ref
  const atoms = char.palettes[palette] || char.palettes.electronic;
  return Object.assign({}, char, { atoms });
}

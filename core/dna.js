/* ==========================================================================
 * dna.js — Musical DNA (P0 of the Composition Workbench).
 *
 * Formalizes the atom holding-area into a serialized, versioned MusicalDNA object
 * that BOTH engines read: Style compose (already) and the future Lyric/Metatag
 * engine. It is NOT a second source of truth — it is a read-only projection of
 * what buildAtoms already resolves, plus seed (reproducibility) and per-field
 * CONSUMER CONTRACTS. Purely additive: it calls buildAtoms and never alters
 * rendering, so style output stays byte-identical (parity-safe).
 *
 * CONSUMER CONTRACTS enforce the standing rules structurally: `affect` (mood /
 * emotional atmosphere) is readable by the lyric + metatag engines and FORBIDDEN
 * to style compose — so mood words can never leak into the style prompt. Artist/
 * overlay influences render generic (renderPolicy), never as names in output.
 * ========================================================================*/

import { buildAtoms, ATOM_OVERLAYS } from './atoms.js';
import { atomCharacterForPalette } from '../engines/atom-characters.js';

export const DNA_VERSION = '1.0';

// which engines may READ each DNA field. 'style' deliberately absent from affect.
export const DNA_CONSUMERS = Object.freeze({
  identity:    ['style', 'lyric', 'metatag'],
  influences:  ['style', 'lyric', 'metatag'],
  harmony:     ['style', 'lyric', 'metatag'],
  arrangement: ['style', 'metatag'],
  tempo:       ['style', 'lyric', 'metatag'],
  dynamics:    ['style', 'metatag'],
  production:  ['style', 'metatag'],
  vocal:       ['lyric', 'metatag'],
  affect:      ['lyric', 'metatag'],   // NOT style — no mood words in the style prompt
});

const byRole   = (arr, role)   => arr.find(a => a.role === role);
const byFamily = (arr, family) => arr.find(a => a.family === family);

/**
 * buildMusicalDNA(baseChar, palette, opts)
 *  - baseChar: a pool character (from ATOM_POOL_CHARACTERS) or the validated ref
 *  - palette : 'electronic' | 'acoustic'
 *  - opts    : { seed, overlayId, characterId }
 * Returns a serializable MusicalDNA object.
 */
export function buildMusicalDNA(baseChar, palette, opts) {
  const o = opts || {};
  const seed = o.seed >>> 0;
  const char = atomCharacterForPalette(baseChar, palette);
  const r = buildAtoms(char, { seed, overlayId: o.overlayId || null, overlayDef: o.overlayDef || null });

  const arr = r.arrangement;
  const refused = !!r.overlayNote;
  const overlayDef = o.overlayDef || (o.overlayId ? ATOM_OVERLAYS[o.overlayId] : null);

  const genreAnchor = (byRole(arr, 'genre') || {}).text || null;
  const tempoSpec   = (byRole(arr, 'tempo') || {}).text || null;
  const keyMode     = (byFamily(arr, 'harmony') || {}).text || null;
  const arc         = (byRole(arr, 'arc') || {}).text || null;
  const movement    = arr.filter(a => a.role === 'movement').map(a => a.text || a.instrument).filter(Boolean);

  // arrangement projection: every surviving voice, tagged engine vs overlay.
  const arrangement = arr
    .filter(a => a.role !== 'genre' && a.role !== 'tempo')
    .map(a => ({
      role: a.role || null,
      family: a.family || null,
      fn: a.fn || null,
      voice: a.instrument || a.text || null,
      register: a.register || null,
      prominence: a.prominence || null,
      signature: !!a.signature,
      priority: a.priority || null,
      origin: a.source === 'overlay' ? 'overlay' : 'engine',
    }));

  return {
    meta: {
      dnaVersion: DNA_VERSION,
      engineKind: 'atom',
      source: char.source || null,
      characterId: o.characterId || null,
      label: char.label || null,
      palette,
      seed,
      overlayId: o.overlayId || (o.overlayDef ? o.overlayDef.label : null),
      overlayApplied: !!(o.overlayId || o.overlayDef) && !refused,
      overlayCoreId: (o.overlayDef && o.overlayDef.coreId) || null,
      overlaySignatureId: (o.overlayDef && o.overlayDef.signatureId) || null,
      overlayVariantLabel: (o.overlayDef && o.overlayDef.variantLabel) || null,
      overlayRefused: refused ? r.overlayNote : null,
    },
    identity: { genreFamily: char.source || null, subgenre: char.label || null, genreAnchor },
    influences: overlayDef ? [{
      key: o.overlayId,
      kind: overlayDef.kind,          // composer | producer | remixer
      label: overlayDef.label,        // UI label only
      nameClass: 'person',
      renderPolicy: 'never',          // generic fingerprint, never the name in output
      applied: !refused,
    }] : [],
    harmony: { keyMode },
    arrangement,
    tempo: { spec: tempoSpec, tempoLock: true },
    dynamics: { arc, beatless: !!char.beatless },
    production: { masteringTail: char.mastering || null, characteristics: movement },
    vocal: { mode: 'instrumental', characteristics: null, performanceStyle: null }, // lyric engine flips to 'vocal'
    affect: { mood: null, emotionalAtmosphere: null },                              // lyric/metatag only; CIL fills later
    provenance: {
      identity: 'derived',
      influences: overlayDef ? 'derived' : 'n/a',
      harmony: 'derived',
      arrangement: 'derived',
      tempo: 'derived',
      dynamics: 'derived',
      production: 'derived',
      vocal: 'unknown',   // must be asked / inferred
      affect: 'unknown',
    },
    consumers: DNA_CONSUMERS,
    render: { style: r.style, negative: r.negative, length: r.length },  // reference only
  };
}

/** Fields a given engine is contractually allowed to read. */
export function dnaFieldsFor(engine) {
  return Object.keys(DNA_CONSUMERS).filter(f => DNA_CONSUMERS[f].includes(engine));
}

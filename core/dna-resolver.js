/* ==========================================================================
 * dna-resolver.js — Musical DNA extractor for RESOLVER engines (P8, Phase 2).
 *
 * Companion to core/dna.js's buildMusicalDNA() (the atom-path producer). This
 * is the SECOND producer of the same MusicalDNA shape, sourced from
 * core/resolver.js's resolveArrangement()/build() output instead of
 * buildAtoms(). Every downstream consumer (CIL, Lyric, Metatag) reads one
 * shape regardless of which engine kind produced it — DNA_CONSUMERS and the
 * rest of the contract from core/dna.js are reused untouched.
 *
 * SCOPING (docs/architecture/p8-dna-extractors-plan.md, approved by John
 * 2026-08-13): resolver's arrangement model is structurally different from
 * the atom model, not just differently named — flat one-string-per-role
 * object vs. a tagged array of voice objects, and there is genuinely no
 * musical key/mode concept anywhere in the resolver data (confirmed by
 * reading every resolver engine file; "harmony" pool picks are harmonic-
 * character descriptions, e.g. "a dark phrygian cadence", never a tonic
 * pitch). Three decisions from that plan, each resolved by John before this
 * was written:
 *
 *   Q1 (musical key): John confirmed (A) — extend the SAME rotating-pool
 *      variety Balearic/Enigma already have, not invent a literal key value.
 *      That variety mechanism lives in core/resolver.js's harmony-brightness
 *      weighting (Levers 2+3, same session) — this module just reports
 *      harmony.keyMode: null honestly, with provenance:'n/a' (a THIRD
 *      provenance state, distinct from 'unknown' — 'n/a' means this engine
 *      kind structurally cannot produce this field, not "could exist, not
 *      resolved yet"). The actual selected harmony text still reaches the
 *      Lyric Engine via the arrangement[] projection below, tagged role:
 *      'harmony' — nothing useful is lost, only the (never-existing) literal
 *      key value is honestly absent.
 *   Q2 (arrangement fidelity for the Metatag Engine): John's own read, and it
 *      simplified this significantly — by the time resolveArrangement() has
 *      run, each voice's ROLE is already known by construction (arr.pads IS
 *      definitionally the pad, arr.bass IS definitionally the bass — there is
 *      no ambiguity to resolve). No bedId/behaviour functional-inference
 *      equivalent is needed; role is carried straight through.
 *   Q3 (mastering tail): traced. It's the shared MASTERING constant from
 *      core/constants.js, identical across every engine/character/modifier —
 *      confirmed by reading core/resolver.js's renderStyle() and every
 *      Composer/Producer/Remixer modifier file. Not per-character, not
 *      touched by any modifier.
 *
 * influences[] is sourced from the resolved overlay's `names` array
 * (core/overlays.js's resolveOverlays() return shape — resolver engines use
 * the legacy prose-per-slot overlay library, a different modifier data
 * source than the atom path's gen-2 modifiers, traced while writing this).
 * ========================================================================*/

import { DNA_VERSION, DNA_CONSUMERS } from './dna.js';
import { OVERLAYS } from './overlays.js';
import { MASTERING } from './constants.js';

const ROLE_ORDER = ['pads', 'harmony', 'bass', 'drums', 'voice', 'lead', 'color', 'movement'];

/* resolveInfluencesFromNames(names) — shared between the resolver and legacy
 * DNA producers (2026-08-12), both of which source their overlay from the
 * SAME core/overlays.js resolveOverlays() call (generate.js's overlayFor()),
 * unlike the atom path which has its own gen-2 modifier system entirely.
 * Extracted here rather than duplicated in core/dna-legacy.js, per the
 * project's one-source-of-truth rule — a fix to this logic (e.g. the
 * known applied:true-always limitation noted below) now only needs making
 * once for both engine kinds. */
export function resolveInfluencesFromNames(names) {
  return (names || []).map(nameStr => {
    const [kind, id] = String(nameStr).split(':');
    const ov = (OVERLAYS[kind] || {})[id];
    return {
      key: id,
      kind,                                  // 'composer' | 'producer' | 'remixer'
      label: ov ? ov.label : id,             // UI label only
      nameClass: 'person',
      renderPolicy: 'never',                 // generic fingerprint, never the name in output
      // NOTE: always true — neither this nor the legacy producer checks
      // whether the overlay's tags were banned or whether any role actually
      // landed (unlike the atom path's real refusal check via
      // fresh.overlayNote). Flagged, not fixed, in the P8 Phase 2 log entry.
      applied: true,
    };
  });
}

/**
 * buildResolverDNA(arrangement, overlay, opts)
 *  - arrangement: the `arr` object resolveArrangement()/build() already
 *    produced (NOT re-resolved here — this is a pure projection, same
 *    discipline as buildMusicalDNA() never re-resolving buildAtoms()'s work).
 *  - overlay: the resolved {roles, roleFamily, negative, names} object from
 *    core/overlays.js's resolveOverlays() — the same object generate.js
 *    already builds via overlayFor() and passes into build()'s opts.overlay.
 *    Pass null/undefined when no overlay was applied.
 *  - opts: { characterId, seed, palette }
 * Returns a MusicalDNA object in the exact shape core/dna.js produces.
 */
export function buildResolverDNA(arrangement, overlay, opts) {
  const o = opts || {};
  const arr = arrangement || {};

  // arrangement[] projection: one entry per populated role, in canonical
  // order. Role IS the functional answer here (Q2) — no bedId/behaviour
  // equivalent exists or is needed for resolver-sourced DNA.
  const arrangementProjection = ROLE_ORDER
    .filter(role => arr[role])
    .map(role => ({
      role,
      family: null,       // n/a — resolver doesn't compute an atom-style family
      fn: null,            // n/a
      voice: arr[role],
      register: null,      // n/a
      prominence: null,    // n/a
      signature: false,    // n/a — resolver overlays don't carry a signature flag at this layer
      priority: null,      // n/a
      origin: 'engine',
      bedId: null,          // n/a (Q2) — role itself disambiguates function, no tag needed
      behaviour: null,      // n/a (Q2)
    }));

  // influences[]: sourced from the resolved overlay's `names` (e.g.
  // ['composer:zimmer']), via the shared helper above.
  const influences = resolveInfluencesFromNames(overlay && overlay.names);

  const tempoSpec = arr.beatless
    ? 'beatless'
    : (Array.isArray(arr.bpm) ? `${arr.bpm[0]}-${arr.bpm[1]} BPM` : null);

  return {
    meta: {
      dnaVersion: DNA_VERSION,
      engineKind: 'resolver',
      source: null,
      characterId: o.characterId || null,
      label: arr.character || null,
      palette: o.palette || null,
      seed: o.seed != null ? (o.seed >>> 0) : null,
    },
    identity: {
      genreFamily: null,           // n/a — resolver has no separate family/subgenre split; genreAnchor carries both
      subgenre: arr.character || null,
      genreAnchor: arr.genre || null,
    },
    influences,
    // Q1: no key/mode concept exists in this data model — see module header.
    // Provenance 'n/a' below (not 'unknown') marks this as structurally
    // absent, not merely unresolved.
    harmony: { keyMode: null },
    arrangement: arrangementProjection,
    tempo: { spec: tempoSpec, tempoLock: !!arr.tempoLock },
    dynamics: { arc: (arr.ip && arr.ip.arc) || null, beatless: !!arr.beatless },
    // Q3: the mastering tail is a single shared constant across every
    // engine/character/modifier — never per-character, never touched by a
    // Composer/Producer/Remixer modifier. Traced, not guessed.
    production: { masteringTail: MASTERING, characteristics: [] },
    vocal: { mode: 'instrumental', characteristics: null, performanceStyle: null }, // lyric engine flips to 'vocal'; same as atom path
    affect: { mood: null, emotionalAtmosphere: null },                              // lyric/metatag only; CIL fills later
    provenance: {
      identity: 'derived',
      influences: influences.length ? 'derived' : 'n/a',
      harmony: 'n/a',     // structurally absent for this engine kind (Q1) — distinct from 'unknown'
      arrangement: 'derived',
      tempo: 'derived',
      dynamics: 'derived',
      production: 'derived',
      vocal: 'unknown',   // must be asked / inferred, same as atom path
      affect: 'unknown',
    },
    consumers: DNA_CONSUMERS,
    render: null,          // caller already has the rendered style from build(); not duplicated here
    anchor: null,           // resolver engines don't currently support anchor identities
  };
}

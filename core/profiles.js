/* ==========================================================================
 * profiles.js — INFERENCE PROFILES (data) for the CIL (P3).
 *
 * Subgenre-keyed affect + vocal disposition, read ONLY by core/cil.js — which is
 * a lyric/metatag consumer. NEVER read by style compose, so no affect vocabulary
 * can reach the style prompt (upholds the standing "no mood/affect words in the
 * style path" rule structurally).
 *
 * moodClass is an ABSTRACT CLASS, not Suno prose. The lyric engine (P4) realizes
 * prose from {class + user answers}; keeping CIL prose-free means these values
 * never touch a rendered prompt, so this table is safe to author ahead of John's
 * empirical sign-off. FIRST-PASS musical mapping — flagged for review.
 *
 * This is the "author genre/artist profiles as data" step P2 deferred until a
 * consumer needed it. It keys on SUBGENRE (real differentiation across the 12
 * characters), not a single-entry genre registry, so it is not premature config.
 * ========================================================================*/

// Abstract mood classes (CIL vocabulary; realized to prose later by the lyric engine).
export const MOOD_CLASSES = Object.freeze([
  'contemplative', 'ethereal', 'warm', 'nocturnal',
  'brooding', 'euphoric', 'driving', 'hypnotic', 'wistful',
]);

// How a subgenre disposes toward vocals (a suggestion; the user always decides).
export const VOCAL_DISPOSITIONS = Object.freeze([
  'instrumental-leaning', 'vocal-capable', 'either',
]);

export const INFERENCE_PROFILES = Object.freeze({
  // genre-level fallback (only 'Balearic' on the atom path today)
  bySource: {
    Balearic: { moodClass: 'warm', vocalDisposition: 'either' },
  },
  // subgenre refinement, keyed by dna.meta.characterId
  bySubgenre: {
    'organic-warm-downtempo':       { moodClass: 'warm',          vocalDisposition: 'either' },
    'lush-cinematic-chillout':      { moodClass: 'ethereal',      vocalDisposition: 'vocal-capable' },
    'dreamy-analog-electronic':     { moodClass: 'hypnotic',      vocalDisposition: 'instrumental-leaning' },
    'dub-space-downtempo':          { moodClass: 'hypnotic',      vocalDisposition: 'instrumental-leaning' },
    'deep-nocturnal-balearic':      { moodClass: 'nocturnal',     vocalDisposition: 'either' },
    'sunlit-mediterranean':         { moodClass: 'warm',          vocalDisposition: 'either' },
    'ambient-beatless-atmospheric': { moodClass: 'contemplative', vocalDisposition: 'instrumental-leaning' },
    'moody-trip-hop-downbeat':      { moodClass: 'brooding',      vocalDisposition: 'vocal-capable' },
    'balearic-house':               { moodClass: 'euphoric',      vocalDisposition: 'either' },
    'nu-disco-slo-mo':              { moodClass: 'warm',          vocalDisposition: 'vocal-capable' },
    'melodic-deep-house':           { moodClass: 'driving',       vocalDisposition: 'either' },
    'lounge-house':                 { moodClass: 'warm',          vocalDisposition: 'either' },
  },
});

// Resolve the best profile for a DNA: subgenre first, then genre fallback.
export function profileFor(dna) {
  const bySub = INFERENCE_PROFILES.bySubgenre;
  const id = dna.meta && dna.meta.characterId;
  const src = dna.identity && dna.identity.genreFamily;
  return (id && bySub[id]) || INFERENCE_PROFILES.bySource[src] || null;
}

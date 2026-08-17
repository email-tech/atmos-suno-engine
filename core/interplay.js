/* core/interplay.js — CONDITIONAL INTERPLAY (2026-08-17)
 *
 * THE DEFECT THIS FIXES
 * Interplay tails are free-standing prose picked independently of the resolved
 * arrangement, so a tail can name a voice the build does not contain. Real
 * output, Era/cathedralOverture/electronic seed 15:
 *
 *   "...a long-phrased solo cello lead ANSWERING THE CHOIR FROM ACROSS THE
 *    ORCHESTRA, a sustained tonic pedal..., a wordless soprano melisma..."
 *
 * There is no choir in that build. Suno is being told to render a relationship
 * with an instrument that was never named. Measured over 6,300 seeded resolver
 * builds before this change: Era 28.8%, Sacred Spirit 18.1%, Deep Forest 14.6%,
 * Delerium 14.1% of builds carry at least one dangling reference.
 *
 * WHY IT MATTERS RATHER THAN BEING COSMETIC
 * INTERACTION_LANGUAGE_MANDATORY (core/knowledge.js FACT 6) is the standing
 * project rule and it is the reason these tails exist at all. A tail that names
 * an absent voice is not weak interaction language, it is a contradiction: the
 * style string simultaneously says the cast is X and describes X answering
 * something outside the cast. GENRE_ANCHOR_IS_STRONGEST and CONVENTION_BLEED
 * both record that naming a thing imports its convention — so "the choir" in a
 * tail is a named voice by the back door, spent from the same attention budget
 * as a real one, with no instrument clause behind it.
 *
 * THE FIX (Codex continuation handoff section 10, accepted 2026-08-17)
 * Every tail declares what it REQUIRES. A tail is only legal for a build whose
 * resolved arrangement satisfies its requirements. Requirements are derived
 * from the phrase text rather than hand-tagged onto 354 existing phrases, so a
 * phrase added in a future session is gated automatically instead of relying on
 * whoever writes it to remember. An explicit `requires` list overrides the
 * derivation where the text is ambiguous.
 *
 * EVIDENCE STATE: REASONED, not Suno-tested. This does not claim Suno behaves
 * better; it removes a self-contradiction from the prompt. No Suno result is
 * needed to know a reference to an absent instrument is wrong, which is why this
 * job was safe to do while testing is still gated.
 * ------------------------------------------------------------------------- */

/* DETERMINER-ANCHORED EXTRACTION.
 * A referent is only counted when the phrase points AT something: "the choir",
 * "with the strings". The host's own action is not a reference — "chanting
 * beneath the lead" references the lead and is performed by the chant, so
 * `chant` here is not a requirement. Matching bare nouns instead would flag
 * every gerund and either empty the pools or force pointless requirements.
 *
 * It also drops metaphor for free: "while the upper voices soar" does not match
 * `the voices`, because the adjective breaks determiner adjacency. That is the
 * same exclusion the 2026-08-17 measurement made by hand. */

/* ROLE REFERENTS resolve against a SLOT being filled, not against a word in the
 * text — "the groove" is satisfied by whatever drums were drawn, whatever they
 * are called. */
export const ROLE_REFERENTS = Object.freeze({
  lead: 'lead', melody: 'lead', hook: 'lead', theme: 'lead', topline: 'lead', 'top line': 'lead',
  groove: 'drums', beat: 'drums', rhythm: 'drums', drums: 'drums', drum: 'drums',
  bass: 'bass', bassline: 'bass', 'low end': 'bass',
  pads: 'pads', pad: 'pads',
  voice: 'voice', vocal: 'voice', vocals: 'voice', voices: 'voice', singer: 'voice',
  percussion: 'percussion',
  pulse: 'pulse',
});

/* INSTRUMENT REFERENTS resolve against the TEXT of the arrangement: the build
 * must actually name that instrument somewhere. Stem-matched so "the strings"
 * is satisfied by "a sweeping orchestral string section". */
export const INSTRUMENT_REFERENTS = Object.freeze([
  'choir', 'chant', 'chants', 'strings', 'string', 'orchestra', 'brass', 'horns', 'horn',
  'guitar', 'piano', 'rhodes', 'wurlitzer', 'organ', 'harp', 'flute', 'ney', 'duduk',
  'shakuhachi', 'whistle', 'oud', 'sitar', 'kora', 'koto', 'violin', 'cello', 'viola',
  'marimba', 'kalimba', 'vibraphone', 'dulcimer', 'bells', 'bell', 'gong', 'timpani',
  'ostinato', 'arp', 'arpeggio', 'riff', 'synths', 'clarinet', 'saxophone', 'accordion',
]);

/* `harmony` is deliberately ABSENT from both lists. "grounding the harmony",
 * "under shifting harmony" refer to the music's harmonic content, which every
 * build has by definition. Treating it as a requirement would gate phrases on a
 * condition that is always true, which is noise, not a check. */

const ALL_REFERENTS = Object.freeze(
  [...new Set([...Object.keys(ROLE_REFERENTS), ...INSTRUMENT_REFERENTS])]
    .sort((a, b) => b.length - a.length)   // longest-first so "low end" beats "end"
);

const REFERENT_RE = new RegExp(`\\bthe (${ALL_REFERENTS.join('|')})\\b`, 'gi');

export function referentsIn(phrase) {
  const text = typeof phrase === 'string' ? phrase : String(phrase && phrase.t || '');
  if (phrase && typeof phrase === 'object' && Array.isArray(phrase.requires)) {
    return phrase.requires.map(r => String(r).toLowerCase());   // explicit override
  }
  const out = [];
  REFERENT_RE.lastIndex = 0;
  let m;
  while ((m = REFERENT_RE.exec(text))) {
    const r = m[1].toLowerCase();
    if (!out.includes(r)) out.push(r);
  }
  return out;
}

export const phraseText = (p) => (typeof p === 'string' ? p : String(p && p.t || ''));

/* HOST EXCLUSION, and why it applies to SOME dimensions only.
 *
 * A single-host tail hangs off one instrument and must point somewhere else:
 * "answering the chant" attached to the chant is the voice answering itself,
 * not a relationship. So voiceRel and colorRel exclude their own slot.
 *
 * A multi-host tail is the opposite case, and excluding there was a real bug
 * caught by measurement rather than by review. The foundation clause renders as
 * "<drums> and <bass> <tail>" — both are named in it, so "locked with the beat"
 * on the bass is describing exactly the relationship the clause exists to state.
 * The conversation clause renders as "<pads> with <lead> <tail>" for the same
 * reason. Excluding hosts there silenced 271 Era and 54 Sacred Spirit tails
 * across 6,300 builds, i.e. it deleted mandatory interaction language to prevent
 * a fault that was not occurring.
 *
 * Role referents are never host-excluded even on single-host dimensions: a lead
 * "stating the theme" is describing its own material, which is legitimate prose.
 * Only a named INSTRUMENT can be a genuine self-reference. */
export const HOST_SLOTS = Object.freeze({
  foundation:   [],            // drums + bass are co-hosts and relate to each other
  conversation: [],            // pads + lead are co-hosts and relate to each other
  voiceRel:     ['voice'],
  colorRel:     ['color'],
  arc:          [],            // describes the whole arrangement, not one voice
});

const TEXT_SLOTS = ['pads', 'harmony', 'bass', 'voice', 'lead', 'movement', 'color', 'drums'];
const PERC_RE = /percussion|hand drum|frame drum|tabla|djembe|conga|shaker|rattle|bodhran|tar\b|dumbek|darbuka/i;
const PULSE_RE = /puls|sequenc|arpegg|arp\b|throb|driving|four-on-the-floor/i;

/* Is `ref` satisfied by arrangement `arr`, ignoring the tail's own host slots? */
export function satisfies(ref, arr, hostSlots = []) {
  const allText  = TEXT_SLOTS.map(s => arr[s]).filter(Boolean).join(' | ').toLowerCase();
  const nonHost  = TEXT_SLOTS.filter(s => !hostSlots.includes(s))
                             .map(s => arr[s]).filter(Boolean).join(' | ').toLowerCase();

  /* ROLE referents ignore host exclusion — the host describing its own material
   * ("stating the theme", "carrying the melody") is legitimate. */
  const role = ROLE_REFERENTS[ref];
  if (role) {
    if (role === 'percussion') return !!arr.drums || PERC_RE.test(allText);
    if (role === 'pulse')      return !!arr.drums || PULSE_RE.test(allText);
    return !!arr[role];
  }
  /* INSTRUMENT referents must be satisfied by a voice other than the host. */
  const stem = ref.replace(/s$/, '');
  return nonHost.includes(stem);
}

export function isLegalTail(phrase, arr, dim) {
  const hosts = HOST_SLOTS[dim] || [];
  return referentsIn(phrase).every(r => satisfies(r, arr, hosts));
}

/* Legal subset of a dimension's pool for this arrangement. */
export function legalTails(pool, arr, dim) {
  return (pool || []).filter(p => isLegalTail(p, arr, dim));
}

/* PICK.
 * Filter first, then draw — so the draw is over legal phrases only rather than
 * drawing and rejecting, which would either bias toward whatever sits early in
 * the pool or need a variable number of rng calls and desynchronise every seed
 * downstream. Exactly ONE rng call per dimension, unchanged from before.
 *
 * FALLBACK ORDER when nothing is legal:
 *   1. any phrase in the pool carrying no referents at all (always safe)
 *   2. null — the dimension goes silent
 * Step 2 is a real loss of mandatory interaction language, so validate-interplay
 * -requires.mjs asserts it never happens across every character, palette and a
 * wide seed sweep. Measured at build time: 0 of 28,336 dimension draws hit even
 * step 1. The fallback exists so a future data edit degrades instead of
 * throwing, not because it is expected to run. */
export function pickTail(pool, arr, dim, rand) {
  const legal = legalTails(pool, arr, dim);
  const src = legal.length ? legal
            : (pool || []).filter(p => referentsIn(p).length === 0);
  const r = rand();
  if (!src.length) return null;
  return phraseText(src[Math.floor(r * src.length)]);
}

/* RENDER-TIME GUARD.
 * Overlays write into arrangement slots AFTER resolveArrangement has already
 * picked the tails (core/resolver.js applyOverlay: a foundational bass motif
 * replaces arr.bass, a composer motif can take the lead slot, an overlay arc
 * is injected wholesale into arr.ip). A tail legal at pick time can therefore
 * be dangling by the time it renders. Re-checking at render closes that, and
 * is also the only gate the injected overlay arc ever passes through.
 *
 * Deterministic: re-picks by rotating through the legal set on a hash of the
 * dimension name and the arrangement, never with fresh randomness, so the same
 * build always renders the same string. */
export function guardTail(pool, arr, dim, selected) {
  if (!selected) return null;
  if (isLegalTail(selected, arr, dim)) return phraseText(selected);
  const legal = legalTails(pool, arr, dim);
  if (!legal.length) return null;
  let h = 0;
  const key = dim + '|' + TEXT_SLOTS.map(s => arr[s] || '').join('|');
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return phraseText(legal[Math.abs(h) % legal.length]);
}

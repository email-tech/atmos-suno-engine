/* ==========================================================================
 * knowledge.js — EMPIRICALLY ESTABLISHED FACTS ABOUT SUNO.
 *
 * WHY THIS FILE EXISTS (John, 2026-07-23, after Suno round 4):
 *   "every new chat we regress in knowledge, progress and are always chasing
 *    our tails... It wouldn't be so bad if the lessons we learned were retained,
 *    but I don't feel that they are."
 *
 * He is right, and the cause is structural. Facts that live in a session's
 * reasoning, or in prose in the decision log, do not survive a chat boundary —
 * they get re-derived from scratch, and re-derived wrong. Two concrete failures
 * in round 4 came from exactly that:
 *   - 23 negatives were shipped when the effective ceiling is about 5, so the
 *     orchestral defence was largely inert and John had to hand-front-load it.
 *   - 'ostinato' and 'stabs' were left in composer atoms after John had already
 *     ruled them undesirable, because the rule lived only in a log entry.
 *
 * THE RULE THIS FILE ESTABLISHES: an empirical fact is not "recorded" until it
 * is DATA HERE and a VALIDATOR FAILS THE BUILD when it is violated. Prose is not
 * retention. Memory is not retention. A failing test is retention.
 *
 * Nothing in this file is inferred, extrapolated or assumed. Every entry cites
 * the test that produced it. If a fact has no test behind it, it does not belong
 * here — put it in the decision log as an open question instead.
 * ========================================================================*/

/* --------------------------------------------------------------------------
 * 1. NEGATIVE PROMPT CAPACITY
 * SOURCE: John, Suno round 4 — "I have had to front load the negative Orchestral
 * prompts as the negative prompt loses effectiveness beyond 5 elements."
 * Everything past the cap is effectively ignored, so an unordered list of 23
 * silently discards the ones that mattered.
 * ------------------------------------------------------------------------*/
export const NEGATIVE_CAP = 5;

/* Negatives are now RANKED and truncated to the cap, highest harm first.
 * Rank 1 = actively breaks the genre read. Rank 3 = cosmetic.
 * The old ALWAYS_BAN list (field recordings, foley, vinyl crackle...) is
 * cosmetic by this measure: it prevents non-musical content, but it never
 * caused a genre failure. Orchestral-convention bleed did. */
export const NEGATIVE_RANKS = {
  // rank 1 — observed to hijack the genre (round 4: A2, A3, A4)
  'orchestral drums': 1,
  'staccato strings': 1,
  'brass stabs': 1,
  'orchestral hits': 1,
  'symphonic arrangement': 1,
  // rank 1 — a beatless/ambient character receiving drum language is a
  // complete genre failure, not a stylistic nitpick (2026-08-13, atom path
  // never carried this even though resolver/legacy always have via
  // BEATLESS_BAN — same severity class as the round-4 orchestral hijacks).
  'drums': 1, 'kick': 1, 'beat': 1, 'percussion': 1, 'snare': 1,
  // rank 1 — vocal-restraint mechanism (2026-08-13, John: a genre/character
  // described as soft, easy, chill, gentle etc. should proactively reject
  // aggressive vocal delivery). DESIGN CHOICE, not an independently Suno-
  // tested fact like the entries above it — grounded in the project's
  // existing mood/energy data (MOOD_CLASSES, declared tempo/energy text),
  // not invented from nothing, but flagged here as reasoned inference so it
  // isn't mistaken for the same evidence class as a round-4 finding.
  'shouted vocals': 1, 'screaming vocals': 1, 'belted vocals': 1, 'aggressive vocal delivery': 1,
  // rank 2 — orchestral convention, less destructive
  'orchestral percussion': 2,
  'timpani': 2,
  'cinematic orchestral production': 2,
  'full orchestra': 2,
  'orchestral crescendo': 2,
  'marching percussion': 2,
  // rank 3 — non-musical content; never observed to break a genre read
  'field recordings': 3,
  'foley': 3,
  'sound effects': 3,
  'vinyl crackle': 3,
  'tape hiss': 3,
  'room tone': 3,
  'air texture': 3,
  'nature sounds': 3,
  'ambient noise': 3,
};

/* VOCAL_RESTRAINT_TERMS — the actual candidate strings added to a negative
 * prompt when a character reads as soft/gentle and vocals are active. Kept
 * as its own export (not just inline) so every engine path adds the exact
 * same wording rather than each hand-writing a slightly different phrase. */
export const VOCAL_RESTRAINT_TERMS = ['shouted vocals', 'screaming vocals', 'belted vocals', 'aggressive vocal delivery'];

/* SOFT_CHARACTER_RE — trigger words for the vocal-restraint mechanism.
 * John named "soft, easy, chill, gentle, and any other similar words";
 * extended with the project's own existing mood vocabulary (MOOD_CLASSES in
 * core/profiles.js: contemplative/ethereal/wistful/nocturnal read the same
 * way; brooding/euphoric/driving/hypnotic deliberately excluded, they don't)
 * plus the literal energy phrases already declared on character/cluster data
 * (low energy, very low energy, low-mid energy). This is a REASONED DESIGN
 * CHOICE grounded in existing project vocabulary, not an empirical Suno
 * finding — unlike NEGATIVE_RANKS' round-4 entries, nobody has tested that
 * Suno specifically over-shouts on these exact words. If a future session
 * gets contradicting Suno evidence, that evidence wins and this list changes. */
export const SOFT_CHARACTER_RE = /\b(soft|gentle|easy|chill|mellow|tender|hushed|serene|dreamy|contemplative|ethereal|wistful|nocturnal|ambient|lounge|downtempo|lush|delicate|intimate)\b|\b(very low|low[- ]mid|low)\s+energy\b/i;

/* vocalRestraintCandidates(descriptiveText, vocalActive) — descriptiveText is
 * any combination of a character/cluster's own label/genre/tempo text (never
 * user free-text, so this can't be gamed by a stray word in a lyric brief).
 * Returns [] when vocals aren't active at all (nothing to restrain) or the
 * text doesn't match — never invents a restraint the character didn't
 * actually signal. */
export function vocalRestraintCandidates(descriptiveText, vocalActive) {
  if (!vocalActive) return [];
  return SOFT_CHARACTER_RE.test(String(descriptiveText || '')) ? VOCAL_RESTRAINT_TERMS.slice() : [];
}

/* capNegativesOrdered(candidates, cap) — for the resolver and legacy paths,
 * which each carry dozens of engine/cluster-specific negative terms
 * (2026-08-13 finding: uncapped, e.g. 24 items on a resolver build, 37 on a
 * legacy one — directly violating NEGATIVE_CAP, the same round-4 finding
 * NEGATIVE_RANKS enforces on the atom path). Individually hand-ranking every
 * one of those terms against Suno evidence I don't have would mean inventing
 * harm scores exactly like the ungrounded metatag language John already
 * flagged this session — so instead of a global rank table, this preserves
 * whatever priority order the CALLER already assembled (highest-priority
 * candidates first: beatless-ban, vocal-restraint, then the engine's own
 * declared negatives, cosmetic ALWAYS_BAN last) and simply dedupes + caps at
 * the same limit the atom path already enforces. Same discipline, cheaper
 * evidence bar for content nobody has specifically Suno-tested term-by-term. */
export function capNegativesOrdered(candidates, cap) {
  const limit = (typeof cap === 'number') ? cap : NEGATIVE_CAP;
  const seen = new Set();
  const out = [];
  for (const c of candidates) {
    const k = String(c).toLowerCase().trim();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(String(c).trim());
    if (out.length >= limit) break;
  }
  return out;
}

// Select at most NEGATIVE_CAP negatives, most harmful first, order preserved
// within a rank. Duplicates and unknown entries are dropped rather than
// silently consuming a slot.
export function selectNegatives(candidates, cap) {
  const limit = (typeof cap === 'number') ? cap : NEGATIVE_CAP;
  const seen = new Set();
  return candidates
    .filter(c => { const k = String(c).toLowerCase();
                   if (seen.has(k) || !(k in NEGATIVE_RANKS)) return false;
                   seen.add(k); return true; })
    .sort((a, b) => NEGATIVE_RANKS[String(a).toLowerCase()] - NEGATIVE_RANKS[String(b).toLowerCase()])
    .slice(0, limit);
}

/* ORCHESTRAL_NEGATIVES — the rank-1/rank-2 orchestral-convention bans, as a
 * standalone always-available candidate list (2026-08-14, step 2 of the
 * Balearic reliability pass, audit finding 3).
 *
 * BEFORE THIS: these terms only entered buildAtoms()'s negative candidate
 * list via a composer overlay's own negative array (core/atom-modifiers.js
 * ORCHESTRAL_DEFENCE, gated `m.kind === 'composer' ? ... : []`). A plain
 * engine-only build, or one carrying a producer/remixer overlay, always
 * shipped ALWAYS_BAN's five rank-3 cosmetic terms ('field recordings, air
 * texture, room tone, foley, sound effects') while carrying no orchestral
 * defense on the negative side at all.
 *
 * WHY STILL NEEDED AFTER STEP 1: step 1 removed orchestral instruments from
 * the POSITIVE field. Round 4 (A2/A3/A4) showed Suno inventing orchestral
 * staccato/stabs/drums it was never given in the prompt at all — the bleed is
 * not solely a function of what's named positively. Belt and braces.
 *
 * A pure subset of NEGATIVE_RANKS (every entry here is already a ranked key
 * there — nothing new is being asserted about Suno's behaviour, this list
 * just makes the existing rank-1/2 orchestral entries reachable on every
 * build instead of only a composer-overlaid one). Deliberately excludes the
 * rank-1 beatless-drum terms (drums/kick/beat/percussion/snare) and the
 * rank-1 vocal-restraint terms — both already have their own dedicated,
 * character-conditional candidate sources in buildAtoms() and mixing them in
 * here would double-count against the same cap for the wrong reason. */
export const ORCHESTRAL_NEGATIVES = [
  'orchestral drums', 'staccato strings', 'brass stabs', 'orchestral hits', 'symphonic arrangement',
  'orchestral percussion', 'timpani', 'cinematic orchestral production', 'full orchestra',
  'orchestral crescendo', 'marching percussion',
];

/* --------------------------------------------------------------------------
 * 2. BANNED PERFORMANCE / ARTICULATION LANGUAGE
 * SOURCE: John, Suno round 4 A4 — "ostinato, stabs and staccatos are an
 * undesirable articulation and performance language for the Balearic engine."
 *
 * SCOPE CORRECTION: I first read "for the Balearic engine" as engine-conditional
 * and left 16 composer atoms carrying this language. That was wrong on the facts
 * — every engine in this project (Balearic, Enigma, Delerium, Era, Deep Forest,
 * Sacred Spirit) is a non-orchestral, groove-led engine, so "the Balearic engine"
 * is not a narrow case, it is the whole app. The ban is global.
 *
 * WHY IT MATTERS BEYOND TASTE: round 4 showed Suno inventing staccato and stabs
 * that were NOT in the prompt, purely from orchestral instrument context. Naming
 * the articulation ourselves compounds a bleed that is already happening.
 * ------------------------------------------------------------------------*/
export const BANNED_ARTICULATION = [
  'ostinato', 'staccato', 'stab', 'stabs', 'stabbing',
  'fanfare', 'orchestral hit', 'orchestra hit',
];

export const BANNED_ARTICULATION_RE =
  /\b(ostinato|ostinatos|staccato|stabs?|stabbing|fanfares?|orchestral hits?|orchestra hits?)\b/i;

/* --------------------------------------------------------------------------
 * 3. PROMPT POSITION == PROMINENCE
 * SOURCE: John, round 4. A1 — the marimba, cello and French horn sat late in the
 * prompt and were INAUDIBLE. A3/A4 — composer content sat early (position ~4)
 * and was "too front and centre in the arrangement in volume".
 * The same lever, observed in both directions in one test round.
 * ------------------------------------------------------------------------*/
export const POSITION_IS_PROMINENCE = true;

/* --------------------------------------------------------------------------
 * 4. INSTRUMENT NAMES IMPORT THEIR WHOLE CONVENTION
 * SOURCE: John, round 4 — "The presence of orchestra instruments is causing Suno
 * to lean into orchestra production", and "Suno is fighting its programming and
 * presenting both type of genre equally. It can't tell from our current
 * prompting, which should be the dominant Genre."
 * Naming an orchestral instrument does not add that instrument to a Balearic
 * track; it invokes orchestral music, including articulation, sectional writing,
 * orchestral percussion and a cinematic front-and-centre mix.
 * ------------------------------------------------------------------------*/
export const CONVENTION_BLEED = true;

/* --------------------------------------------------------------------------
 * 5. ONE VOICE, ONE MENTION
 * SOURCE: John, round 4 A2 — "French horn mentioned on 3 occasions in the
 * prompt???" and A3 — "The prompt has French horn use at odds with one another."
 * Naming one instrument N times tells Suno to render N of them.
 * Enforced in core/atoms.js by the cross-family de-dupe.
 * ------------------------------------------------------------------------*/
export const ONE_VOICE_ONE_MENTION = true;

/* SINGLETON_INSTRUMENT_WORDS — the bare-headword set the rule above applies
 * to (2026-08-14, found while building step 3 of the reliability pass: the
 * cross-family de-dupe matched on the full instrument STRING, so "grand
 * piano" [motif] and "felt piano" [texture] never clashed, then a linking-
 * guide phrase referring back to the lead as "piano" made it three bare
 * mentions of the word in one style string — exactly the round-4 pattern,
 * undetected because nothing compared bare headwords, only full names).
 *
 * Deliberately short and specific, NOT a general "last word of a multi-word
 * instrument name" rule — that would wrongly dedupe legitimately co-existing
 * voices sharing a family word (synth lead / synth pads / synth bass must
 * stay free to coexist; a nylon guitar and an electric guitar are two
 * different instruments, not the same one twice). Every entry here is a case
 * where the bare word alone already reads as one instrument to a listener
 * regardless of qualifier — two different pianos are still two pianos, the
 * same way two French horns are two French horns. Single source of truth for
 * both the reconcile-time prevention (core/atoms.js) and the regression
 * check (validate-knowledge.mjs) — previously the validator alone knew this
 * list, so nothing in generation prevented what the test could only detect
 * after the fact. */
export const SINGLETON_INSTRUMENT_WORDS =
  ['french horn', 'cello', 'violin', 'oboe', 'flute', 'piano', 'nylon guitar', 'marimba', 'vibraphone'];

/* --------------------------------------------------------------------------
 * 6. WOVEN INTERACTION LANGUAGE IS MANDATORY (standing project rule)
 * SOURCE: John's own Suno testing, established before round 4 and re-confirmed
 * since. The tight front-weighted 6-9 tag model from 2026 Suno-v5 research
 * produced hopeless results; fuller woven prompts render good, genre-accurate
 * music regardless of length. John's empirical test wins for this project.
 * ------------------------------------------------------------------------*/
export const INTERACTION_LANGUAGE_MANDATORY = true;

/* --------------------------------------------------------------------------
 * SUNO UNDERSTANDS EFFECT NAMES WITHOUT THE PRODUCTION MECHANICS
 * SOURCE: John, 2026-08-17 — "I have tested extensively in Suno the use of the
 * term talk box and vocoder, and Suno is able to produce the effects of talk box
 * and vocoder without the technical requirements of a carrier. It understands
 * the sound it's trying to achieve without the technicalities of proper music
 * production."
 *
 * Naming the EFFECT is sufficient. Suno is matching a sound it has heard, not
 * modelling a signal chain, so a talkbox does not need a carrier instrument
 * named alongside it and a vocoder does not need a modulator/carrier pair.
 *
 * THIS OVERRIDES THE SPEC. ATMOS_Detail_Movement_Vocal_Processing_Spec_v2_0 §8.7
 * makes a carrier a HARD REQUIREMENT for talkbox, reasoning correctly from
 * production practice (Sound On Sound: a talkbox is physically shaped by a
 * performer's mouth). Correct about talkboxes, wrong about Suno. The spec's own
 * evidence hierarchy §2.3 puts existing ATMOS Suno testing FIRST and established
 * production terminology FOURTH, so John's measurement wins on the spec's own
 * terms.
 *
 * WHAT DOES NOT CHANGE: ATMOS still never NAMES an instrument that is not in the
 * resolved cast. That is the cast-integrity rule (spec §1.2), not a Suno claim —
 * prose reading "through the existing synth lead" on a build with no synth lead
 * is a dangling reference, the same defect fixed across the interplay layer at
 * 84effaa. So a carrier is named when one exists and simply omitted when one
 * does not; it is never required and never invented.
 *
 * GENERAL LESSON worth carrying to the rest of this spec: correct audio
 * engineering is not automatically correct Suno prompting. Every other place the
 * spec reasons from production mechanics to a hard requirement is now suspect
 * and should be treated as a hypothesis until measured.
 * ------------------------------------------------------------------------*/
export const EFFECT_NAMES_NEED_NO_MECHANICS = true;

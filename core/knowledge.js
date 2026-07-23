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

/* --------------------------------------------------------------------------
 * 6. WOVEN INTERACTION LANGUAGE IS MANDATORY (standing project rule)
 * SOURCE: John's own Suno testing, established before round 4 and re-confirmed
 * since. The tight front-weighted 6-9 tag model from 2026 Suno-v5 research
 * produced hopeless results; fuller woven prompts render good, genre-accurate
 * music regardless of length. John's empirical test wins for this project.
 * ------------------------------------------------------------------------*/
export const INTERACTION_LANGUAGE_MANDATORY = true;

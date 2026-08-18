/* core/resolver-cast.js — ENSEMBLE RECONCILIATION FOR THE RESOLVER ENGINES
 * (Era, Delerium, Deep Forest, Sacred Spirit). 2026-08-17.
 *
 * WHY THIS IS NOT JUST core/cast.js CALLED AGAIN
 * cast.js reconciles ATOMS: typed objects carrying role, family, behaviour, mix
 * and density as separate fields. The resolver has none of that. It fills eight
 * named slots with finished prose strings, and the slot IS the role. So the
 * rules have to be re-derived against what the resolver actually holds, not
 * ported across, and two of cast.js's predicates give the WRONG ANSWER here:
 *
 *   - isSustainedBed() counts the MOVEMENT slot as a bed, because movement text
 *     says things like "tremolo bowed-string swells" and the behaviour regex
 *     matches "swells". On the atom path movement is not a slot at all. Here it
 *     is production process, not a harmonic layer, and counting it inflated the
 *     measured defect from a real 11-23% to a reported 53-65%.
 *   - It also counts the VOICE slot, which is worse: a wordless choir does
 *     sustain, but it is the vocal identity performing the voice function. A bed
 *     budget that can drop the vocal is a genre failure, not a fix. John's own
 *     rule already accepts two sustained layers where a signature bed exists.
 *
 * So the bed contest here is deliberately NARROWER than the atom path's:
 * candidates are pads, harmony and colour only.
 *
 * WHEN THIS RUNS. After applyOverlay(), before the style is rendered. Overlays
 * rewrite arr.bass / arr.lead / arr.color / arr.pads, so reconciling at resolve
 * time would judge an arrangement that is not the one Suno receives. Running it
 * here also composes correctly with the render-time interplay guard: a tail that
 * referenced a voice this module just dropped is caught by core/interplay.js on
 * the way out, which is exactly what that guard was built for.
 *
 * DROPPING A SLOT IS SAFE. renderStyle() builds every clause conditionally and
 * degrades cleanly on a null — "pads with lead" becomes just the lead, the
 * foundation clause survives losing either half. No dangling connectives.
 *
 * EVIDENCE STATE: REASONED for the bed contest (it applies John's settled
 * definition of a pad to a path that never had it). EMPIRICAL for the
 * duplicate-voice rule — round 4 established that naming one instrument twice
 * renders two of it, and that is recorded in core/knowledge.js.
 * ------------------------------------------------------------------------- */
import { SINGLETON_INSTRUMENT_WORDS } from './knowledge.js';
import { classifyInstrument } from './linking.js';

/* Same definition as core/cast.js. Duplicated deliberately rather than
 * exported across: these describe what a bed IS, and if a future session
 * changes the atom path's notion of a bed it must be a conscious decision to
 * change the resolver's too, not a side effect. */
const BED_INSTRUMENT_RE = /\b(pad|pads|synthpad|drone|wash|string machine|string ensemble|mellotron|choir|bed)\b/i;
const BED_BEHAVIOUR_RE  = /\b(sustain|sustained|sustains|held|holding|swell|swells|slow attack|wide chords|long chords)\b/i;

/* WHICH SLOT WINS A CONTEST, most protected first.
 *
 * bass and drums are the groove and are never dropped by anything here.
 * lead is the character's melodic identity.
 * VOICE SITS ABOVE PADS deliberately. If a choir pad and a chant voice collide
 * on the word "choir", the vocal is the thing to keep and the bed is the thing
 * to lose — dropping the voice to protect a pad would trade the song's identity
 * for its wallpaper.
 * colour and movement are decorative and optional; colour does not even fire on
 * every build. They lose every contest, which is why the common case costs the
 * arrangement nothing. */
/* 'tex' is the TEXTURE MODIFIER slot (John, 2026-08-18) and sits LAST on
 * purpose. Engine content is the character's own song and claims every word
 * first; a texture pick that duplicates a voice the character already drew —
 * Era and Sacred Spirit both draw cello, so a string pick there is a genuine
 * duplicate — loses and is reported through castDropped rather than doubling
 * the instrument. */
const SLOT_PRIORITY = Object.freeze(['bass', 'drums', 'lead', 'voice', 'pads', 'harmony', 'color', 'movement', 'tex']);

/* Never dropped, whatever collides. Losing either of these would break the
 * groove, and a duplicate involving them is better solved by fixing the pool. */
const PROTECTED = Object.freeze(['bass', 'drums', 'lead']);

/* 'tex' is deliberately ABSENT. A texture bed layers against the existing bed
 * rather than contesting it — the same decision core/cast.js documents on the
 * atom path, for the same reason: John's prose relates the second bed to the
 * first, and a related second bed is orchestration rather than the mud the
 * budget exists to prevent. */
const BED_CANDIDATES = Object.freeze(['pads', 'harmony', 'color']);

const rank = (slot) => {
  const i = SLOT_PRIORITY.indexOf(slot);
  return i === -1 ? SLOT_PRIORITY.length : i;
};

export function isBedSlot(slot, text) {
  if (!text) return false;
  /* ONLY the three harmonic-bed slots can ever be a bed. Without this the
   * behaviour regex fires on the movement slot ("tremolo bowed-string swells")
   * and on a sustained voice ("a wordless sustained choir") — the two false
   * positives that made the atom path's predicate wrong here, and that this
   * module exists to avoid. Caught by validate-resolver-cast group 1. */
  if (!BED_CANDIDATES.includes(slot)) return false;
  /* pads is a bed by function, whatever fills it — the same structural
   * reasoning as cast.js's BED_ROLES. A text-only test misses a pad slot whose
   * prose happens not to use a bed word. */
  if (slot === 'pads') return true;
  return BED_INSTRUMENT_RE.test(text) || BED_BEHAVIOUR_RE.test(text);
}

/* Reconcile a resolved (and overlaid) arrangement in place.
 * Returns the list of drops so callers and validators can see what happened
 * rather than inferring it from the prose. */
export function reconcileArrangement(arr) {
  const dropped = [];
  const drop = (slot, reason, detail) => {
    dropped.push({ slot, reason, instrument: arr[slot], detail });
    arr[slot] = null;
  };

  /* RULE 1 — ONE VOICE, ONE MENTION.
   * Real Sacred Spirit output, ceremonialPrelude/acoustic seed 1: pads drew "a
   * sustained bowed-cello drone" and colour drew "a swelling cello accent".
   * Two cellos in one prompt. Era/electronic seed 11 gets three. This is the
   * round-4 French-horn failure in a different engine, and it needs no musical
   * judgement to fix — SINGLETON_INSTRUMENT_WORDS is already the source of
   * truth for which instruments Suno renders one of per mention.
   *
   * Slots are compared pairwise by priority: the better-protected slot keeps the
   * word, the other is dropped. A collision between two PROTECTED slots is left
   * alone and reported — dropping the bass to save the lead would be a worse
   * prompt than the duplicate, and a protected-slot collision means the pool
   * itself needs fixing. */
  for (const word of SINGLETON_INSTRUMENT_WORDS) {
    const re = new RegExp(`\\b${word.replace(/[-\s]/g, '[-\\s]')}s?\\b`, 'i');
    const holders = SLOT_PRIORITY.filter(s => arr[s] && re.test(String(arr[s])));
    if (holders.length < 2) continue;
    const keeper = holders[0];
    for (const loser of holders.slice(1)) {
      if (PROTECTED.includes(loser)) {
        dropped.push({ slot: loser, reason: 'duplicate-voice-unresolved', instrument: arr[loser], detail: word });
        continue;
      }
      /* NEVER DROP THE LAST BED. Sacred Spirit draws a bowed-cello drone in
       * pads and a cello line in the lead; the lead is protected, so the pad
       * loses — and 44 builds ended with no harmonic bed at all. A build with
       * no bed is a worse prompt than one with a repeated word, so the
       * collision is reported unresolved instead. Caught by
       * validate-resolver-cast group 4, not by review. */
      if (isBedSlot(loser, arr[loser])
          && !BED_CANDIDATES.some(b => b !== loser && isBedSlot(b, arr[b]))) {
        dropped.push({ slot: loser, reason: 'duplicate-voice-unresolved', instrument: arr[loser], detail: `${word} (last bed, kept)` });
        continue;
      }
      drop(loser, 'duplicate-voice', `${word} already in ${keeper}`);
    }
  }

  /* RULE 1b — TEXTURE FAMILY COLLISION (John, 2026-08-18), texture slot only.
   * Same rule and same reasoning as core/cast.js rule 0c: SINGLETON_INSTRUMENT_
   * WORDS holds nine bare headwords and cannot see that "a low string ensemble"
   * beside an engine's own string writing is one instrument named twice. Matched
   * on the guide family instead, and only against the character's own slots —
   * engine content claims first. Fires often on Era and Sacred Spirit, which
   * already carry strings and brass; that is the correct answer, not a fault. */
  if (arr.tex) {
    const texFam = classifyInstrument(String(arr.tex));
    const clash = texFam && SLOT_PRIORITY.some(s2 =>
      s2 !== 'tex' && arr[s2] && classifyInstrument(String(arr[s2])) === texFam);
    if (clash) drop('tex', 'family-already-present', texFam);
  }

  /* RULE 2 — ONE HARMONIC BED.
   * Measured over 6,300 seeded builds: Sacred Spirit 22.9%, Era 17.6%, Deep
   * Forest 15.0%, Delerium 10.8% of builds stack a second sustained bed among
   * pads / harmony / colour. Two beds mud the harmony and spend two named
   * sources on one function.
   *
   * pads wins by default because it is the character's own bed and the slot the
   * engine designed around. When pads is empty the highest-priority remaining
   * bed keeps the function. */
  const beds = BED_CANDIDATES.filter(s => isBedSlot(s, arr[s]));
  if (beds.length > 1) {
    const keeper = beds.sort((a, b) => rank(a) - rank(b))[0];
    for (const loser of beds.slice(1)) drop(loser, 'bed-budget', `bed already held by ${keeper}`);
  }

  arr.castDropped = dropped;
  return dropped;
}

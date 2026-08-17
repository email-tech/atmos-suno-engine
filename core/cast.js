/* ==========================================================================
 * cast.js — THE RESOLVED CAST AS DATA (John, 2026-08-17).
 *
 * JOHN'S CALL, verbatim: "All the variables (Instruments/sounds/voices/vocals
 * and effects etc.) need to be on the table before prose even touches them.
 * Even while the user is messing around with dropdowns and selections, until
 * every decision by the user has been made, only then can work begin on the
 * prose, and Metatags. The systems musical knowledge and application must be
 * sound before touching a prompt or metatag."
 *
 * WHAT WAS WRONG. core/atoms.js already had a reconcile stage, but it only
 * checked family collision and singleton instrument words. Nothing ever looked
 * at the COMPLETE cast and asked whether it was a coherent band. Measured at
 * HEAD 08212c9 over 960 Balearic Atom builds:
 *   - 53% carried more than one sustained bed clause; 19% carried three or more
 *     (John's own live prompt carried FIVE)
 *   - 15% mentioned a lead in more than one clause, before any composer
 *   - 12% named distortion/saturation, including inside four-on-the-floor house
 *   - a real build named "synth counter-line, faint and buried well under the
 *     mix, answering the lead only occasionally" — an instrument given one of
 *     the ~5 slots Suno honours, then explicitly described as inaudible
 * Each individual clause was musically literate. The ENSEMBLE was not, because
 * no stage existed at which the ensemble was a thing that could be judged.
 *
 * THIS MODULE IS THAT STAGE. It converts held atoms plus any modifier content
 * into a typed cast, reconciles the cast as a whole, and hands the survivors
 * back for rendering. Prose is downstream of it and reads only what survives.
 *
 * WHAT THIS IS NOT. This is NOT a return to the tight 6-9 tag stack. John
 * Suno-tested that model and the results were hopeless; fuller woven prompts
 * render good genre-accurate music, and core/knowledge.js records that as
 * INTERACTION_LANGUAGE_MANDATORY. Length is not the target here — an
 * unreconciled cast is. This reduces the number of NAMED VOICES and removes
 * contradictions; every surviving voice keeps its full woven interaction
 * language. A future session must not read "bloated" as licence to shorten
 * prompts back toward the disproven tag model.
 * ========================================================================*/

/* --------------------------------------------------------------------------
 * COMPOSITE SOURCES (John's theory, 2026-08-17)
 *
 * "Stating a particular Drum kit is good, and there are many sounds within a
 * kit. Bass Drum, Snare, Toms, Hi hats etc. It should still be acceptable to
 * state in a Metatag Kick drum enters, even though it never appears in the
 * Style prompt. Same with Percussion."
 *
 * This is an important distinction and it splits a question the decision log
 * has carried as unresolved since 2026-08-15 ("can metatags introduce
 * instruments never named in the style field?") into two different questions:
 *
 *   CASE A — the metatag names a COMPONENT of a source already named in the
 *   style field. "house kit" is one named source; kick, snare, hats and toms
 *   are already inside it. A metatag saying "kick drum enters" is not adding a
 *   voice, it is directing one Suno has already been told to render. Low risk.
 *
 *   CASE B — the metatag names a wholly NEW source the style field never
 *   mentioned. That is the genuinely open question and the research pack's
 *   Test B.
 *
 * Consequence for the budget below: the ceiling counts NAMED SOURCES, not
 * audible sounds. A kit is one. Treating its components as separate voices
 * would wrongly price a drum kit at four or five slots.
 *
 * EVIDENCE STATE: John's stated theory, musically sound and consistent with
 * how Suno is prompted in practice, but NOT yet Suno-tested. Flagged
 * RESEARCH_CANDIDATE, not fact. The architecture is safe either way — the
 * worst case if the theory is wrong is that a component metatag is ignored,
 * which is the status quo, not a regression.
 * ------------------------------------------------------------------------*/
export const COMPOSITE_COMPONENTS = Object.freeze({
  kit:        ['kick drum', 'snare', 'hi-hats', 'toms', 'rimshot', 'ride', 'crash'],
  percussion: ['shaker', 'congas', 'bongos', 'tambourine', 'woodblock', 'claves', 'cowbell'],
  strings:    ['violins', 'violas', 'cellos', 'double basses'],
  choir:      ['sopranos', 'altos', 'tenors', 'basses'],
});

/* Which cast entries are composites, by family. A composite occupies exactly
 * ONE slot in the voice budget however many sounds it contains. */
const COMPOSITE_FAMILIES = Object.freeze(['drums', 'perc', 'kit']);

/* componentsFor — the legal component vocabulary a metatag may reference for
 * a given resolved cast. Everything returned here is Case A: already implied
 * by a source the style field names. core/metatag.js can direct these without
 * introducing anything new. */
export function componentsFor(cast) {
  const out = [];
  for (const v of cast) {
    if (!v.instrument) continue;
    const t = String(v.instrument).toLowerCase();
    if (/\bkit\b|\bdrums\b/.test(t))       out.push(...COMPOSITE_COMPONENTS.kit);
    else if (/percussion/.test(t))          out.push(...COMPOSITE_COMPONENTS.percussion);
    else if (/string (ensemble|machine)|strings/.test(t)) out.push(...COMPOSITE_COMPONENTS.strings);
    else if (/choir/.test(t))               out.push(...COMPOSITE_COMPONENTS.choir);
  }
  return Array.from(new Set(out));
}

/* --------------------------------------------------------------------------
 * SUSTAINED-BED DETECTION
 *
 * A bed is defined by FUNCTION, not by sound source — John's canonical
 * definition (2026-07-22): sustained, slow attack and release, background
 * placement, rich chords. String pads, choir pads and ambient pads are all
 * legitimate beds. That definition is exactly why the count went wrong: five
 * different ROLE slots (pad, strings, texture, harmony, colour) can each draw
 * something that is functionally a bed, and no role-based check would ever
 * notice, because each one is legitimately filling a different role.
 *
 * So detection is behavioural, matching the definition rather than the role.
 * ------------------------------------------------------------------------*/
const BED_INSTRUMENT_RE = /\b(pad|pads|synthpad|drone|wash|string machine|string ensemble|mellotron|choir|bed)\b/i;
const BED_BEHAVIOUR_RE  = /\b(sustain|sustained|sustains|held|holding|swell|swells|slow attack|wide chords|long chords)\b/i;

/* ROLES THAT ARE BEDS BY FUNCTION regardless of what instrument fills them.
 * Found while re-baselining the golden reference: seed 7 kept BOTH "lush
 * layered synth pads" and "a low pipe-organ sustain", because compose() adds
 * the words "sustained underneath" to a texture at RENDER time — the atom's
 * own text is just the instrument name, so a text-only detector never saw it.
 * The texture role is always rendered as a held layer under the arrangement,
 * which is the bed function by John's own definition, so it is classified
 * structurally rather than by string matching. */
const BED_ROLES = Object.freeze(['texture', 'pad', 'pads']);

/* A foreground melodic lead. Counted separately from beds because two leads is
 * a different musical fault from two beds: two beds mud the harmony, two leads
 * fight for the same melodic foreground and Suno picks one arbitrarily. */
export function isLead(entry) {
  if (entry.role === 'lead' || entry.family === 'lead') return true;
  const t = String(entry.instrument || '');
  /* SUBORDINATE MENTIONS ARE NOT LEADS. A bare /melody/ match condemned
   * "a hammered-dulcimer and marimba figure ticking under the melody" as a
   * second lead and dropped it on every seed — caught by validate-modifiers'
   * dead-atom check. A voice that says it sits UNDER the melody is asserting
   * the opposite of being the lead. Same for a phrase that only refers back
   * to the lead ("answering the lead"). */
  if (/\b(under|underneath|beneath|behind|below|against|around)\s+the\s+(melody|lead)\b/i.test(t)) return false;
  if (/\b(answering|shadowing|doubling|tracing|following)\s+the\s+lead\b/i.test(t)) return false;
  return /\blead\b|\bon the melody\b|\bsolo\b/i.test(t);
}

export function isSustainedBed(entry) {
  /* FOUNDATION AND FOREGROUND ARE NEVER BEDS. Caught by validate-cast's
   * not-by-deletion check: an ambient beatless build resolved its BASS as
   * "sub drone", which matched on the word 'drone', won the single bed slot
   * as a core voice, and then evicted both the actual pad and the drone synth
   * — leaving an ambient track with no harmonic bed at all. A bass holding a
   * sustained low note is performing the bass function, not the bed function,
   * and John's definition of a bed is explicitly functional: sustained, slow
   * attack and release, BACKGROUND placement, rich chords. Bass is foundation
   * and a lead is foreground; neither is background by definition. */
  if (entry.family === 'bass' || entry.family === 'drums' || entry.family === 'lead') return false;
  if (isLead(entry)) return false;
  /* Role-based classification applies to ENGINE atoms only. The rule exists
   * because compose() renders an engine texture with the literal words
   * "sustained underneath" at render time, making it a bed by function even
   * though its own text is just an instrument name. Modifier atoms do not go
   * through that clause, so classifying them by role would wrongly condemn
   * every modifier texture to lose the bed contest and never render at all —
   * caught by validate-modifiers' dead-atom check. A modifier voice that
   * genuinely reads as sustained is still caught by the text match below. */
  if (entry.source === 'engine' && (BED_ROLES.includes(entry.role) || BED_ROLES.includes(entry.family))) return true;
  const text = `${entry.instrument || ''} ${entry.behaviour || ''}`;
  return BED_INSTRUMENT_RE.test(text) || BED_BEHAVIOUR_RE.test(text);
}

/* --------------------------------------------------------------------------
 * SLOT-WASTE RULE
 *
 * The clearest single symptom in John's report: a build named a synth
 * counter-line and then said "faint and buried well under the mix, answering
 * the lead only occasionally". Naming a voice costs one of the ~5 slots Suno
 * reliably honours. If the voice's own description guarantees it will not be
 * heard, that slot buys nothing and displaces a voice that would have been.
 *
 * DELIBERATELY NARROW. This only fires on DECORATIVE entries whose own text
 * says they are inaudible. It must never touch:
 *   - a bed, which is SUPPOSED to sit low; that is correct pad behaviour and
 *     John has ruled explicitly that a character's own pad must not be buried
 *     or removed for sitting back
 *   - anything core or signature
 * Being quiet is not the same as being pointless; being quiet AND decorative
 * AND occasional is.
 * ------------------------------------------------------------------------*/
const INAUDIBLE_RE = /\b(faint|barely audible|buried|well under|far under|almost inaudible|scarcely)\b/i;
const OCCASIONAL_RE = /\b(occasional|occasionally|rarely|sparse|now and then|every so often)\b/i;

export function wastesItsSlot(entry) {
  if (entry.priority === 'core' || entry.signature) return false;
  if (isSustainedBed(entry)) return false;
  const text = `${entry.mix || ''} ${entry.density || ''} ${entry.behaviour || ''}`;
  return INAUDIBLE_RE.test(text) && OCCASIONAL_RE.test(text);
}

/* --------------------------------------------------------------------------
 * GENRE POLICY
 *
 * Measured: distortion/saturation appears in 12% of Balearic Atom builds, and
 * in lounge-house specifically 25% — a character that renders four-on-the-floor
 * 52% of the time. A saturated distorted guitar inside Balearic house is a
 * genre-breaking element, and nothing prevented it because colour atoms are
 * gated by PALETTE (electronic/acoustic), never by the genre anchor.
 *
 * Kept as DATA, engine-relative, per the Codex handoff's section 6/7 finding
 * that a single global rule set cannot serve every engine. Only decorative
 * entries are subject to it: a character whose genre genuinely IS built on a
 * distorted guitar would carry it as core, and this must not strip that.
 * ------------------------------------------------------------------------*/
export const GENRE_PROHIBITIONS = Object.freeze({
  // Four-on-the-floor / house-family genres: saturated guitar edge reads as
  // rock/indie-dance and fights the genre anchor, which core/knowledge.js
  // records as the strongest single lever.
  house: { match: /\bhouse\b|four-on-the-floor/i, prohibit: /\b(distort|distorted|saturated|overdriven|fuzz)\b/i },
});

export function violatesGenrePolicy(entry, genreText) {
  if (entry.priority === 'core' || entry.signature) return false;
  const g = String(genreText || '');
  for (const rule of Object.values(GENRE_PROHIBITIONS)) {
    if (!rule.match.test(g)) continue;
    const text = `${entry.instrument || ''} ${entry.behaviour || ''} ${entry.text || ''}`;
    if (rule.prohibit.test(text)) return true;
  }
  return false;
}

/* --------------------------------------------------------------------------
 * BUDGETS
 *
 * BED_BUDGET and LEAD_BUDGET are musical facts, not platform guesses: more
 * than one sustained harmonic bed muds the harmony and more than one foreground
 * lead has nothing to resolve. Those are safe to set here.
 *
 * VOICE_BUDGET is NOT. The community figure is ~3-5 named instruments before
 * silent dropout and core/knowledge.js records it as consensus, not as a
 * measured ATMOS result. Setting a hard number here from theory is exactly what
 * John's standing rule forbids. So the DEFAULT IS null — no voice cap is
 * enforced until the research pack (Tests A-D, issued 2026-08-15) returns a
 * measured figure. The machinery is built and tested; only the number is
 * pending, and it is a one-line change when the evidence lands.
 * ------------------------------------------------------------------------*/
/* Re-exported from core/knowledge.js so the cast and core/atoms.js compare
 * against the SAME list rather than two that can drift apart. */
import { SINGLETON_INSTRUMENT_WORDS as SINGLETON_WORDS } from './knowledge.js';

export const BED_BUDGET = 1;
export const LEAD_BUDGET = 1;
export const VOICE_BUDGET = null;   // DEFERRED_TEST — see above. Do not guess.

/* Drop order when a budget is exceeded: the least important voice goes first,
 * never the most.
 *
 * SOURCE OUTRANKS PRIORITY. First cut of this ranked by priority with source
 * as a tiebreak, and a composer's decorative choir beat the character's OWN
 * drone synth to the single bed slot — inverting the settled rule that the
 * character's song IS the genre and the modifier only decorates it. Engine
 * content now wins over modifier content at every priority level: an engine
 * decorative voice (weight 2) still outranks a composer core one (weight 20).
 * Signature is the sole exception and outranks everything, which is the whole
 * point of signatureLead protection. */
const SOURCE_WEIGHT = { engine: 0, overlay: 1, composer: 2 };
const PRIORITY_WEIGHT = { core: 0, support: 1, decorative: 2 };
const KEEP_RANK = (v) => {
  if (v.signature) return -1;
  const s = SOURCE_WEIGHT[v.source] != null ? SOURCE_WEIGHT[v.source] : 2;
  const p = PRIORITY_WEIGHT[v.priority] != null ? PRIORITY_WEIGHT[v.priority] : 2;
  return s * 10 + p;
};

/* --------------------------------------------------------------------------
 * buildCast — atoms (and modifier content) in, typed cast out.
 *
 * Modifier content enters HERE, not as prose appended after the fact. That is
 * the architectural fix: js/generate.js used to do
 *   style = `${style}, ${composerStyleLayer(id)}`
 * AFTER reconcile and dedupe had already run, so composer instruments bypassed
 * family collision, one-voice-one-mention, every budget, and clause ordering —
 * and landed after the mastering tail, which is terminal by design. Measured:
 * 342/342 composer builds put the clause after mastering, and 25/342 named a
 * synth lead in both the base body and the composer clause.
 * ------------------------------------------------------------------------*/
export function buildCast(heldAtoms, opts) {
  const o = opts || {};
  const cast = (heldAtoms || [])
    .filter(a => a && a.instrument)
    .map(a => ({
      key: a.key, role: a.key, family: a.family, instrument: a.instrument,
      behaviour: a.behaviour || null, mix: a.mix || null, density: a.density || null,
      timbre: a.timbre || [], priority: a.priority || 'decorative',
      signature: !!a.signature, source: a.source || 'engine',
      composite: COMPOSITE_FAMILIES.includes(a.family),
      atom: a,
    }));

  // Composer instruments arrive as a name list (core/composer-layers.js keeps
  // `instruments` explicitly so nothing has to parse them back out of prose).
  // They join the cast as ordinary decorative entries and take their chances
  // with every rule below, exactly like an engine atom.
  for (const name of (o.composerInstruments || [])) {
    cast.push({
      key: `composer:${name}`, role: 'composer', family: null, instrument: name,
      behaviour: null, mix: null, density: null, timbre: [],
      priority: 'decorative', signature: false, source: 'composer',
      composite: false, atom: null,
    });
  }
  return cast;
}

/* --------------------------------------------------------------------------
 * reconcileCast — judge the ensemble, return survivors + an audit trail.
 *
 * The audit trail is not decoration. Every drop records WHY, so a validator
 * can assert the rules fired for the stated reason rather than merely that the
 * count came out right, and so a future session can see which rule cost a
 * voice without re-deriving it.
 * ------------------------------------------------------------------------*/
export function reconcileCast(cast, opts) {
  const o = opts || {};
  const genre = o.genre || '';
  const voiceBudget = (o.voiceBudget !== undefined) ? o.voiceBudget : VOICE_BUDGET;
  const dropped = [];
  let kept = cast.slice();

  const drop = (v, reason) => { dropped.push({ instrument: v.instrument, source: v.source, reason }); };

  /* 0. ONE VOICE, ONE MENTION — across EVERY source, including modifiers.
   * core/knowledge.js records this as a round-4 finding ("French horn
   * mentioned on 3 occasions in the prompt???" — naming one instrument N times
   * tells Suno to render N of them). core/atoms.js enforces it, but only over
   * atoms it can see; composer instruments arrive as a name list and were
   * never compared against the resolved cast. Caught by validate-composer-
   * layers once composer content entered the cast: composer_newman's marimba
   * and the character's own marimba both survived into one style string.
   * Matched on SINGLETON_INSTRUMENT_WORDS, the project's existing list of
   * bare words that read as one instrument regardless of qualifier — NOT on a
   * general last-word rule, which would wrongly collapse synth lead / synth
   * pads / synth bass into one voice. Engine content claims first, so the
   * duplicate that loses is always the modifier's. */
  const claimedWords = new Set();
  kept = kept.slice().sort((a, b) => KEEP_RANK(a) - KEEP_RANK(b)).filter(v => {
    const t = String(v.instrument || '').toLowerCase();
    const words = SINGLETON_WORDS.filter(w => t.includes(w));
    if (!words.length) return true;
    if (words.some(w => claimedWords.has(w))) { drop(v, 'duplicate-voice'); return false; }
    words.forEach(w => claimedWords.add(w));
    return true;
  });

  // 1. Genre policy. Runs first: a genre-breaking voice should never survive
  //    long enough to win a budget contest against a legitimate one.
  kept = kept.filter(v => {
    if (violatesGenrePolicy(v, genre)) { drop(v, 'genre-policy'); return false; }
    return true;
  });

  // 2. Slot waste. Also before the budgets, for the same reason: a voice its
  //    own text says is inaudible must not displace an audible one.
  kept = kept.filter(v => {
    if (wastesItsSlot(v)) { drop(v, 'slot-waste'); return false; }
    return true;
  });

  // 3. Bed budget. THE measured defect — 53% of builds carried more than one.
  /* THE PAD WINS ITS OWN SLOT. First cut ranked bed candidates by source and
   * priority alone, so a character whose texture atom was 'core' and whose pad
   * was 'support' kept the texture and dropped the PAD — leaving 72 modifier
   * variants with no pad in the arrangement at all, caught by
   * validate-modifiers. The pad role IS the character's harmonic bed; every
   * other bed-functioning role (texture, drone, wash) is a secondary sustained
   * layer that exists alongside it. So the pad sorts first among bed
   * candidates, and the general source/priority ranking decides only between
   * equals. */
  const isPadRole = (v) => v.role === 'pad' || v.family === 'pad' || v.key === 'pad';
  /* SIGNATURE STILL OUTRANKS THE PAD PREFERENCE. Adding the pad rule above
   * inverted signatureLead protection: a modifier's signature bed lost the
   * slot to a plain engine pad, and its defining phrase vanished from the
   * style entirely (caught by validate-atoms' cross-composer distinctness and
   * validate-modifiers' signature check). Order is therefore: signature, then
   * the pad role, then the general source/priority ranking. */
  /* A SIGNATURE BED DOES NOT SPEND THE BUDGET. This took three passes and the
   * failing cases pointed in opposite directions, so the rule is written out
   * rather than left implicit.
   *
   * Signature content must render — settled (signatureLead protection). But
   * "must render" is not "must own the single bed slot", and treating it that
   * way made remixer_nelson's signature ("filtered disco string swells rising
   * under the groove", a bed by behaviour) evict the character's own pad,
   * leaving six modifier variants with no pad in the arrangement at all.
   *
   * Exempting the signature from the budget instead keeps BOTH: the character
   * keeps its bed, the modifier keeps its defining trait. There is at most one
   * signature per build, so the practical ceiling is two sustained layers when
   * a signature bed exists and one otherwise — against the five John reported.
   * It also matches his own modifier model: the composer "adds a sustained bed
   * plus a solo or two" ON TOP OF the character's song, rather than replacing
   * what the character already brought. */
  const beds = kept.filter(v => isSustainedBed(v) && !v.signature)
    .sort((a, b) => (isPadRole(b) - isPadRole(a)) || (KEEP_RANK(a) - KEEP_RANK(b)));
  const bedKeep = new Set(beds.slice(0, BED_BUDGET));
  kept.forEach(v => { if (v.signature) bedKeep.add(v); });
  kept = kept.filter(v => {
    if (!isSustainedBed(v)) return true;
    if (bedKeep.has(v)) return true;
    drop(v, 'bed-budget'); return false;
  });

  // 4. Lead budget.
  /* THE LEAD ROLE WINS ITS OWN SLOT, for the same reason the pad does — and
   * for one more: compose() looks the lead up by FAMILY (ownerOf('lead')) and
   * several later clauses are conditional on finding it. Dropping the
   * family-'lead' owner in favour of a higher-ranked lead-ish voice from
   * another slot left ownerOf('lead') undefined, and the counter clause that
   * depends on it silently stopped rendering — surfacing as a dead atom in
   * validate-modifiers rather than as anything visibly wrong. core/atoms.js's
   * own reconcile already documents this hazard ("orphans compose()'s
   * downstream clauses that assume lead's presence"); the same care has to
   * apply here. */
  const isLeadRole = (v) => v.role === 'lead' || v.family === 'lead' || v.key === 'lead';
  /* Signature first, then the lead role, then the general ranking — the same
   * precedence the bed contest uses. Putting the role preference above
   * signature (first attempt) stripped producer_horn's and composer_morricone's
   * defining phrases from the style entirely. */
  /* A SIGNATURE LEAD DOES NOT SPEND THE BUDGET EITHER — symmetric with the bed
   * rule above, and for the same two reasons. Letting a modifier's signature
   * solo WIN the single lead slot evicted the character's own family-'lead'
   * owner, which compose() looks up by family, silently killing the counter
   * clause that depends on it. Exempting it keeps both: the genre keeps its
   * lead, the modifier keeps its fingerprint.
   * This is also exactly John's modifier model — the composer "adds a
   * sustained bed plus a solo or two as fingerprint decoration, WITHOUT
   * displacing genre identity". A signature solo alongside the genre lead is
   * the intended outcome; two competing NON-signature leads (the composer-prose
   * case he reported, "analog synth lead" against the engine's "synth lead")
   * is not, and is still prevented. */
  const leads = kept.filter(v => isLead(v) && !v.signature)
    .sort((a, b) => (isLeadRole(b) - isLeadRole(a)) || (KEEP_RANK(a) - KEEP_RANK(b)));
  const leadKeep = new Set(leads.slice(0, LEAD_BUDGET));
  kept.forEach(v => { if (v.signature) leadKeep.add(v); });
  kept = kept.filter(v => {
    if (!isLead(v)) return true;
    if (leadKeep.has(v)) return true;
    drop(v, 'lead-budget'); return false;
  });

  // 5. Voice budget. Composites count as ONE (John's kit point) — the budget
  //    counts NAMED SOURCES, not audible sounds.
  if (typeof voiceBudget === 'number' && voiceBudget > 0) {
    const ordered = kept.slice().sort((a, b) => KEEP_RANK(a) - KEEP_RANK(b));
    const survivors = new Set(ordered.slice(0, voiceBudget));
    kept = kept.filter(v => {
      if (survivors.has(v)) return true;
      drop(v, 'voice-budget'); return false;
    });
  }

  return { kept, dropped, namedSources: kept.length, components: componentsFor(kept) };
}

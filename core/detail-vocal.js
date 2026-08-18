/* core/detail-vocal.js — VOCAL TREATMENT RESOLVER (spec v2.0 §8).
 *
 * First resolver in the chain, because it is the only one that can change vocal
 * IDENTITY and TEMPORAL STRUCTURE. Space & Movement and Ear Candy both have to
 * see its decision before making their own, or they double it.
 *
 * ALL PROSE IN THIS FILE IS TRANSCRIBED VERBATIM FROM THE SPEC'S CANONICAL
 * LIBRARY (§8.12). Not paraphrased, not "improved". This project has already
 * been burned twice by invented interaction language — the composer layer wrote
 * its own three-bucket vocabulary while a tested guide existed, and the fix for
 * that wrote a fourth. The library is the authority; the resolver's job is to
 * choose from it, not to write.
 *
 * EVIDENCE STATE (§2.3): Suno publishes no parameter named vocoder, talkbox,
 * stutter edit or glitch. These are natural-language steering strings built on
 * established production meanings, and they are DESIGN INFERENCES until John
 * A/B tests them. Nothing here may be promoted into core/knowledge.js as a
 * Suno fact.
 * ------------------------------------------------------------------------- */
import { rngFor, stablePick, SEED_LABELS } from './detail-seed.js';

/* ---- §8.4 VOCAL-ROLE TAXONOMY ---------------------------------------- */
export const VOCAL_ROLES = Object.freeze([
  'lead_lyric_vocal', 'backing_vocal', 'choir', 'chant_lead', 'chant_layer',
  'wordless_vocal', 'vocal_pad', 'sampled_vocal_fragment', 'looped_vocal_hook',
  'existing_vocal_chop', 'persona_or_voice_lead',
]);

/* Classify a vocal source from its prose, since resolver and legacy engines
 * hold vocals as sentences rather than typed objects. Order matters: the most
 * specific pattern must win, so an existing chop is not read as a plain lead. */
const ROLE_PATTERNS = [
  ['existing_vocal_chop',      /\bchop|chopped|chops\b/i],
  ['looped_vocal_hook',        /\b(vocal loop|looped vocal|vocal hook)\b/i],
  ['sampled_vocal_fragment',   /\bsampl\w*\s+\w*\s?vocal|vocal sample|vocal fragment\b/i],
  ['vocal_pad',                /\bvocal pad|choir pad|voice pad\b/i],
  ['choir',                    /\bchoir|chorus|SATB\b/i],
  ['chant_lead',               /\bchant lead|lead chant|solo chant\b/i],
  ['chant_layer',              /\bchant|chanting|plainsong|gregorian\b/i],
  ['wordless_vocal',           /\bwordless|melisma|vocalise|humm\w+|ooh|aah\b/i],
  ['backing_vocal',            /\bbacking|harmon\w+ vocal|backing vocal\b/i],
  ['lead_lyric_vocal',         /\bvocal|voice|sing\w*|soprano|tenor|baritone|alto\b/i],
];

export function classifyVocalRole(source) {
  if (source && typeof source === 'object' && source.role && VOCAL_ROLES.includes(source.role)) return source.role;
  const t = String((source && (source.text || source.instrument)) || source || '');
  if (!t) return null;
  /* §8.5 — a Persona / Suno Voice lead is identified by metadata, never by
   * prose, because "soaring female lead" reads identically whether or not a
   * Voice is attached. Guessing here would strip identity protection from
   * exactly the source that most needs it. */
  if (source && typeof source === 'object' && (source.persona || source.sunoVoice)) return 'persona_or_voice_lead';
  for (const [role, re] of ROLE_PATTERNS) if (re.test(t)) return role;
  return null;
}

/* ---- §8.6 TREATMENT CLASSES (subtypes are internal, never in the UI) --- */
export const TREATMENT_SUBTYPES = Object.freeze({
  vocoder:    ['vocoderAccentLayer', 'vocoderHookLayer', 'vocoderWordlessPad'],
  talkbox:    ['talkboxPhrase', 'talkboxHookResponse'],
  vocalChops: ['vocalChopAccent', 'vocalChopHook'],
  stutter:    ['phraseEndingStutter', 'syllableRetrigger'],
  glitch:     ['microSliceGlitch', 'gatedGlitchFragment', 'reverseGlitchFragment'],
});

/* ---- §8.13 INTENSITY, internal and engine-constrained ------------------ */
export const DEFAULT_INTENSITY = Object.freeze({
  vocoder: 'support', talkbox: 'accent', vocalChops: 'support', stutter: 'accent', glitch: 'accent',
});

/* ---- TALKBOX CARRIERS — SPEC §8.7 OVERRIDDEN BY MEASUREMENT ----------
 * §8.7 makes a carrier a HARD REQUIREMENT, reasoning from production practice:
 * a talkbox physically shapes an instrument signal through a performer's mouth,
 * so there must be an instrument. Correct about talkboxes, wrong about Suno.
 *
 * John, 2026-08-17, from extensive testing: Suno produces both talkbox and
 * vocoder from the term alone, with no carrier named. It is matching a sound it
 * has heard, not modelling a signal chain. The spec's own evidence hierarchy
 * (§2.3) ranks existing ATMOS Suno testing FIRST and production terminology
 * FOURTH, so the measurement wins on the spec's own terms. Recorded as
 * EFFECT_NAMES_NEED_NO_MECHANICS in core/knowledge.js.
 *
 * WHAT SURVIVES THE OVERRIDE: ATMOS still never NAMES an instrument absent from
 * the resolved cast. That is cast integrity (§1.2), not a Suno claim — "through
 * the existing synth lead" on a build with no synth lead is a dangling
 * reference, the defect fixed across the interplay layer at 84effaa. So a
 * carrier is NAMED WHEN ONE EXISTS and OMITTED WHEN ONE DOES NOT. Never
 * required, never invented. */
const CARRIER_RE = /\b(synth lead|lead synth|synth|analog\w* lead|arp|arpeggi\w+|chord pulse|pulse|clean electric guitar|electric guitar|guitar)\b/i;
const CARRIER_EXCLUDE_RE = /\b(nylon|acoustic guitar|classical guitar)\b/i;

export function eligibleTalkboxCarriers(cast) {
  return (cast || []).filter(c => {
    const t = String((c && (c.text || c.instrument)) || c || '');
    return CARRIER_RE.test(t) && !CARRIER_EXCLUDE_RE.test(t);
  });
}

const carrierName = (c) => String((c && (c.instrument || c.text)) || c || '')
  .replace(/^(a|an|the)\s+/i, '').trim();

/* ---- §8.12 CANONICAL PROSE LIBRARY, transcribed verbatim -------------- */
export const VOCAL_PROSE = Object.freeze({
  vocoderAccentLayer: {
    full: ['A restrained vocoder-treated backing layer shadows selected vocal phrases, blended behind the natural lead.',
           'Selected vocal phrases pass through a soft vocoder layer while the main vocal remains clear and human.'],
    compact: 'restrained vocoder layer behind selected vocal phrases.',
  },
  vocoderHookLayer: {
    full: ['A restrained vocoder-treated backing layer shadows selected vocal phrases, blended behind the natural lead.',
           'Selected vocal phrases pass through a soft vocoder layer while the main vocal remains clear and human.'],
    compact: 'restrained vocoder layer behind selected vocal phrases.',
  },
  vocoderWordlessPad: {
    full: ['A low-mixed vocoded wordless layer appears as synthetic vocal texture rather than a second lead.',
           'Wordless vocal tones are lightly vocoded into a soft harmonic texture behind the arrangement.'],
    compact: 'soft low-mixed vocoded wordless texture.',
  },
  /* CARRIER-FREE VARIANTS are the SPEC LINES WITH THE CARRIER CLAUSE DELETED,
   * not new sentences. Deletion keeps the wording traceable to §8.12 — the
   * library assumed a carrier was mandatory, and with that assumption falsified
   * the honest move is to remove the clause that depended on it rather than
   * author replacement prose. Flagged to John: if he wants purpose-written
   * carrier-free lines, those are his to supply, per the standing rule that
   * missing phrases are asked for and not invented. */
  talkboxPhrase: {
    full: ['Selected hook phrases take on a brief talkbox-style talking-instrument contour through the existing {carrier}, then return to the natural vocal.',
           'The existing {carrier} forms a short talkbox-treated response around selected vocal phrases, never replacing the lead.'],
    fullNoCarrier: ['Selected hook phrases take on a brief talkbox-style talking-instrument contour, then return to the natural vocal.',
                    'A short talkbox-treated response answers selected vocal phrases, never replacing the lead.'],
    compact: 'brief talkbox-style responses through the existing {carrier}.',
    compactNoCarrier: 'brief talkbox-style responses around selected vocal phrases.',
  },
  talkboxHookResponse: {
    full: ['The existing {carrier} forms a short talkbox-treated response around selected vocal phrases, never replacing the lead.',
           'Selected hook phrases take on a brief talkbox-style talking-instrument contour through the existing {carrier}, then return to the natural vocal.'],
    fullNoCarrier: ['A short talkbox-treated response answers selected vocal phrases, never replacing the lead.',
                    'Selected hook phrases take on a brief talkbox-style talking-instrument contour, then return to the natural vocal.'],
    compact: 'brief talkbox-style responses through the existing {carrier}.',
    compactNoCarrier: 'brief talkbox-style responses around selected vocal phrases.',
  },
  vocalChopAccent: {
    full: ['Short fragments of the existing vocal are chopped into sparse rhythmic accents between phrases.',
           'Selected syllables are rearranged into brief vocal-chop figures that remain secondary to the lead.'],
    compact: 'sparse rhythmic chops from the existing vocal.',
  },
  vocalChopHook: {
    full: ['A short fragment of the existing vocal becomes a restrained chopped hook in open spaces between lyric lines.',
           'Brief rearranged vocal fragments form an occasional hook without becoming a continuous new melody.'],
    compact: 'occasional chopped-vocal hook fragments.',
  },
  phraseEndingStutter: {
    full: ['Selected phrase endings repeat in a short tempo-locked vocal stutter before resolving cleanly.',
           'One or two syllables briefly retrigger at selected section edges as a tight rhythmic edit.'],
    compact: 'short tempo-locked stutters on selected phrase endings.',
  },
  syllableRetrigger: {
    full: ['One or two syllables briefly retrigger at selected section edges as a tight rhythmic edit.',
           'Selected phrase endings repeat in a short tempo-locked vocal stutter before resolving cleanly.'],
    compact: 'short tempo-locked stutters on selected phrase endings.',
  },
  microSliceGlitch: {
    full: ['Rare intentional vocal micro-slices punctuate selected transitions, kept brief and clearly secondary.',
           'Brief controlled digital vocal fragments interrupt selected section edges without obscuring the lyric.'],
    compact: 'rare controlled vocal micro-edits at transitions.',
  },
  gatedGlitchFragment: {
    full: ['Occasional gated or reversed fragments of the existing vocal create short digital punctuation around transitions.',
           'Selected vocal tails break into brief gated/reversed fragments and disappear quickly.'],
    compact: 'brief gated/reversed vocal fragments at selected transitions.',
  },
  reverseGlitchFragment: {
    full: ['Selected vocal tails break into brief gated/reversed fragments and disappear quickly.',
           'Occasional gated or reversed fragments of the existing vocal create short digital punctuation around transitions.'],
    compact: 'brief gated/reversed vocal fragments at selected transitions.',
  },
});

/* §8.11 — the UI may say Glitch, but the prose never says "glitchy vocals".
 * Suno already produces accidental artifacts, so the prompt has to distinguish
 * intended structure from noise. Asserted by the validator. */
export const VAGUE_GLITCH_RE = /\bglitchy\b/i;

/* ---- TARGET ELIGIBILITY ----------------------------------------------- */
const TEMPORAL = new Set(['vocalChops', 'stutter', 'glitch']);

/* §8.9 preserve intelligibility of the primary lyric lead; §8.5 protect a
 * Persona/Voice lead from automatic full-lead transformation. Both point the
 * same way: prefer a secondary vocal source, and where the lead is the only
 * source, treat selected phrases rather than the whole lead. */
const TARGET_WEIGHT = {
  existing_vocal_chop: 10, looped_vocal_hook: 9, sampled_vocal_fragment: 9,
  backing_vocal: 7, wordless_vocal: 6, vocal_pad: 5, chant_layer: 5, choir: 4,
  chant_lead: 3, lead_lyric_vocal: 2, persona_or_voice_lead: 1,
};

export function eligibleVocalTargets(vocalSources, treatment) {
  return (vocalSources || [])
    .map(s => ({ source: s, role: classifyVocalRole(s) }))
    .filter(x => x.role)
    /* A vocoder or talkbox imposes a synthetic contour; applied to a source
     * that is ALREADY a synthetic fragment there is nothing human left to
     * transform. Chops/stutter/glitch are the opposite — they score highest on
     * exactly those sources, because the engine already supports the behaviour
     * (§8.9). */
    .filter(x => TEMPORAL.has(treatment) || x.role !== 'existing_vocal_chop');
}

function chooseSubtype(treatment, role, isOnlyLead) {
  if (treatment === 'vocoder') {
    if (role === 'wordless_vocal' || role === 'vocal_pad' || role === 'choir') return 'vocoderWordlessPad';
    return isOnlyLead ? 'vocoderAccentLayer' : 'vocoderHookLayer';
  }
  if (treatment === 'talkbox')    return isOnlyLead ? 'talkboxPhrase' : 'talkboxHookResponse';
  if (treatment === 'vocalChops') return (role === 'looped_vocal_hook' || role === 'existing_vocal_chop') ? 'vocalChopHook' : 'vocalChopAccent';
  if (treatment === 'stutter')    return 'phraseEndingStutter';
  if (treatment === 'glitch')     return 'microSliceGlitch';
  return null;
}

/* §8.3 / auto — pick a treatment the build can actually support rather than
 * one that will immediately no-op. */
function chooseAutoTreatment(ctx, roles) {
  const has = (r) => roles.includes(r);
  if (has('existing_vocal_chop') || has('looped_vocal_hook')) return 'vocalChops';
  if (eligibleTalkboxCarriers(ctx.cast).length && (has('backing_vocal') || has('lead_lyric_vocal'))) return 'talkbox';
  if (has('wordless_vocal') || has('vocal_pad') || has('choir')) return 'vocoder';
  if (ctx.beatless) return 'vocoder';   // §13: temporal edits need a grid
  return 'stutter';
}

const noOp = (reason) => ({ noOp: true, reason, rendered: null, semanticTags: [] });

export function resolveVocalTreatmentFull(ctx, policy) {
  const intent = ctx.uiIntent && ctx.uiIntent.vocalTreatment;
  if (!intent || intent === 'off') return null;
  if (!ctx.vocalSources || !ctx.vocalSources.length) return noOp('no-vocal-source');

  const roles = ctx.vocalSources.map(classifyVocalRole).filter(Boolean);
  const treatment = intent === 'auto' ? chooseAutoTreatment(ctx, roles) : intent;

  if (policy && policy.deny && policy.deny.includes(treatment)) return noOp('engine-policy-deny');

  /* §13 — temporal edits are tempo-relative. On a beatless character there is
   * no grid for a tempo-locked stutter or a rhythmic chop to lock to, so the
   * instruction has nothing to mean. */
  if (ctx.beatless && TEMPORAL.has(treatment)) return noOp('beatless-character-no-temporal-edit');

  const targets = eligibleVocalTargets(ctx.vocalSources, treatment);
  if (!targets.length) return noOp('no-eligible-vocal-target');

  /* Carrier is now OPTIONAL. Present -> name it, because grounding the effect in
   * a voice the track already has is better prompting. Absent -> use the
   * carrier-free variant. Never a no-op and never invented. */
  let carrier = null;
  if (treatment === 'talkbox') {
    const carriers = eligibleTalkboxCarriers(ctx.cast);
    if (carriers.length) carrier = carrierName(carriers[0]);
  }

  const rand = rngFor(ctx.baseBuildSeed, SEED_LABELS.VOCAL_TREATMENT);
  const chosen = stablePick(targets, rand, x => TARGET_WEIGHT[x.role] || 1);
  if (!chosen) return noOp('no-eligible-vocal-target');

  const isOnlyLead = targets.length === 1;
  const subtype = chooseSubtype(treatment, chosen.role, isOnlyLead);
  const entry = VOCAL_PROSE[subtype];
  if (!entry) return noOp('no-prose-for-subtype');

  /* §8.5 — a Persona/Voice lead keeps its identity. An explicit user choice is
   * still honoured, but rendered as a layer around the lead rather than as the
   * lead itself, which the accent/backing prose already says. */
  /* Choose the variant set BEFORE drawing, so both sets consume exactly one
   * draw and a build with a carrier stays seed-aligned with one without. */
  const pool = (!carrier && entry.fullNoCarrier) ? entry.fullNoCarrier : entry.full;
  const variant = pool[Math.floor(rand() * pool.length)] || pool[0];
  /* No fallback carrier name. The old `carrier || 'synth lead'` would have
   * named an instrument the build does not contain the moment the requirement
   * was relaxed — a dangling reference smuggled in by a default. */
  const rendered = carrier ? variant.replace(/\{carrier\}/g, carrier) : variant;

  return {
    treatment, subtype, intensity: (policy && policy.intensity) || DEFAULT_INTENSITY[treatment] || 'accent',
    target: { role: chosen.role, source: chosen.source }, carrier,
    rendered,
    compact: carrier ? String(entry.compact || '').replace(/\{carrier\}/g, carrier)
                     : String(entry.compactNoCarrier || entry.compact || '').replace(/\{carrier\}/g, ''),
    /* §9.1 semantic tags — what dimension this consumed, so Space & Movement
     * and Ear Candy can avoid doubling it (§8.14, §8.15). */
    semanticTags: TEMPORAL.has(treatment) ? ['vocal', 'temporal-edit'] : ['vocal', 'timbral-transform'],
  };
}

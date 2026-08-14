/* ==========================================================================
 * instruments.js — INSTRUMENT RELIABILITY CLASSIFICATION (Balearic atom path).
 *
 * WHY THIS FILE EXISTS (John's spec, 2026-08-14, §4/§5/§6/§7; audit findings 2+E):
 *   The pools in engines/atom-pools.js descend from docs/knowledge/balearic-
 *   influence-trait-library-v1.md, which states its own purpose as a DIVERSITY
 *   engine seeded from artist fingerprints — explicitly NOT a fidelity engine.
 *   Nothing anywhere in the repo graded an instrument for stylistic RELIABILITY,
 *   so French horn, cello, saxophone and pan flute were drawn at exactly the same
 *   weight as nylon guitar and Rhodes. Measured over 4,800 builds: 50.0% of all
 *   output contained a §7-excluded instrument, cello was the 7th most-drawn
 *   instrument in the whole engine and French horn the 8th.
 *
 * WHAT IT IS: a lookup keyed on the EXACT pool string. Pools stay arrays of bare
 * names (the 2026-07-20 rubric is untouched); this file supplies the grade.
 *
 * TIERS
 *   primary   — dependable enough for automatic generation at full weight.
 *   secondary — authentic but specialised, scene-dependent or easily distracting.
 *               Automatic, but §18 weighting and §9 role-occupancy limits apply
 *               (those land in the role-budget step, not here).
 *   expert    — REMAINS IN THE DATA, zero automatic probability. §7: "If retained
 *               at all, place them behind an Expert / Manual / Experimental
 *               override and give them zero probability during normal automatic
 *               generation." Nothing is deleted; restoring one is a one-line
 *               tier change, not a re-authoring job.
 *
 * background:true — §10/§11. The instrument may never be drawn for a melodic
 * lead role by automatic generation, whatever pool it happens to sit in. Kalimba
 * is the spec's own worked example.
 *
 * EVIDENCE BASIS (honest statement — §4 asks for Tier-1 citations and the repo
 * has none; nothing here is invented to fill that gap):
 *   The axis that actually governs this engine is not "did a Balearic record ever
 *   contain a cello" but "does naming a cello in a Suno prompt reliably produce
 *   Balearic music". John's own Suno round-4 results answer the second question
 *   directly and are already enforced data in core/knowledge.js:
 *     - CONVENTION_BLEED — naming an orchestral instrument invokes orchestral
 *       music wholesale: articulation, sectional writing, orchestral percussion
 *       and a cinematic front-and-centre mix.
 *     - round 4 A2/A3/A4 — Suno invented staccato and stabs that were NOT in the
 *       prompt, purely from orchestral instrument context.
 *     - round 4 A1 — marimba, cello and French horn were INAUDIBLE where placed,
 *       so they cost prompt budget and delivered nothing.
 *   That is first-hand evidence for the decision being made here. External
 *   corroboration reaches Tier 2 at best (general genre references describe
 *   Balearic instrumentation as guitar, basslines, drums and keyboards/synths;
 *   pan flute is documented against the later Balearic TRANCE lineage, not the
 *   Café del Mar strand this engine targets) and is recorded in the decision log
 *   rather than dressed up as Tier 1 here.
 *
 * CLOSED-WORLD RULE: validate-instruments.mjs fails the build if ANY string in
 * any pool is missing from this table. An unclassified name can therefore never
 * reach a user, and the fallback below can stay conservative without the risk of
 * silently emptying a pool.
 * ========================================================================*/

const P  = { tier:'primary' };
const S  = { tier:'secondary' };
const SB = { tier:'secondary', background:true };
const X  = (why) => ({ tier:'expert', why });

// Shared reasons, so the same judgement always reads the same way.
const ORCH_STRING = 'orchestral strings — §7 default exclusion; CONVENTION_BLEED';
const ORCH_BRASS  = 'orchestral brass — §7 default exclusion; CONVENTION_BLEED';
const ORCH_WIND   = 'orchestral/solo wind — imports the orchestral convention with it';
const CINEMATIC   = 'turns the arrangement orchestral or cinematic (§11, §24)';
const CLICHE      = 'genre cliché the spec names explicitly (§11, §24)';
const WORLD       = 'world-music colour with no Balearic-specific evidence (§4)';

export const INSTRUMENT_CLASS = {
  // ---- bass -------------------------------------------------------------
  'analog synth bass': P, 'sub bass': P, 'FM bass': P, 'FM sub-bass': P,
  'Moog bass': P, 'dub sub bass': P, 'sine sub bass': P, 'sub drone': P,
  'plucked synth bass': P, 'upright bass': P, 'double bass': P,
  'fretless bass': P, 'electric bass': P,
  'bowed double bass': X(ORCH_STRING),

  // ---- drum kits --------------------------------------------------------
  'soft downtempo kit': P, 'downtempo kit': P, 'dusty boom-bap kit': P,
  'drum machine': P, 'soft drum machine': P, 'lounge kit': P,
  'LinnDrum-style kit': P, 'dub kit': P, 'one-drop kit': P,
  'deep house kit': P, 'soft four-on-the-floor kit': P, 'soft house kit': P,
  'trip-hop breakbeat kit': P, 'four-on-the-floor house kit': P,
  'disco four-on-the-floor kit': P, 'brushed drum kit': P, 'soft jazz kit': P,
  'live drum kit': P, 'cajón kit': P, 'live break kit': P, 'live house kit': P,
  'live disco kit': P, 'jazz drum kit': P,

  // ---- percussion -------------------------------------------------------
  'drum-machine hi-hats': P, 'rimshot clicks': P, 'synth clap': P,
  'electro shaker': P, 'shakers': P, 'congas': P, 'bongos': P, 'cabasa': P,
  'frame drum': P, 'tambourine': P,
  'hang drum': S, 'triangle': SB, 'synth triangle': SB,

  // ---- pads / beds ------------------------------------------------------
  'analog synth pads': P, 'layered synth pads': P, 'detuned analog pads': P,
  'string-machine pad': S, 'mellotron': S, 'choir pad': S,
  'clipped organ synth': S, 'harmonium': S,
  'Hammond organ': S,           // round-4: poor Balearic lead. Bed/colour only.
  // JOHN'S DIRECTION, 2026-08-14, reviewing the step-1 before/after output.
  // string ensemble RESTORED to automatic (it was parked as orchestral); it now
  // lives in the acoustic PAD pools rather than the permanent `strings` support
  // slot. The slot, not the instrument, was the defect: `strings` fired on 95.8%
  // of builds, so a bed-tier sound was behaving like a mandatory parallel layer.
  // As a pad it competes with harmonium and mellotron for one bed, which is what
  // a string bed actually is.
  'string ensemble': S,
  // accordion REMOVED by direction. Parked, not deleted, per §7.
  'accordion': X('John, 2026-08-14 — removed by direction on hearing the step-1 output'),
  'bowed string pad': X(ORCH_STRING),
  'pipe organ': X(CINEMATIC),

  // ---- sustained / support ---------------------------------------------
  'synth strings': S, 'string-machine ensemble': S,
  'drone synth': P, 'granular synth': P,
  'felt piano': P, 'grand piano': P, 'clavinet': S, 'jazz guitar': S,
  'cello': X(ORCH_STRING), 'viola': X(ORCH_STRING), 'violin': X(ORCH_STRING),
  'harp': X(CINEMATIC), 'bowed metallophone': X(ORCH_STRING),
  'glass harmonica': X(CINEMATIC),
  'cor anglais': X(ORCH_WIND), 'duduk': X(WORLD),

  // ---- guitars ----------------------------------------------------------
  'nylon guitar': P, 'lap-steel guitar': P, 'electric guitar': P,
  'acoustic guitar': P, 'clean electric guitar': P, 'delayed electric guitar': P,
  'flamenco guitar': S, 'mandolin': S,

  // ---- leads / motifs ---------------------------------------------------
  'Rhodes': P, 'Wurlitzer': P, 'synth lead': P, 'synth pluck': P,
  'synth arp': P, 'clipped synth chords': P, 'filtered saw lead': P,
  'synth chords': P, 'soft synth lead': P, 'synth motif': P,
  'melodica': S,
  'flute': X(CLICHE), 'pan flute': X(CLICHE), 'saxophone': X(CLICHE),
  'ney': X(WORLD),
  'muted trumpet': X(ORCH_BRASS), 'flugelhorn': X(ORCH_BRASS),
  'French horn': X(ORCH_BRASS), 'trombone': X(ORCH_BRASS),
  'synth brass': X(ORCH_BRASS),

  // ---- counter / answering voices --------------------------------------
  'synth counter-line': P,

  // ---- decorative colour -----------------------------------------------
  'synth bells': SB, 'glassy mallet synth': SB, 'synth marimba': SB,
  'glockenspiel': SB, 'vibraphone': SB, 'kalimba': SB, 'celeste': SB,
  'marimba': SB,
  'tubular bells': X(CINEMATIC),
};

/* Roles whose occupant carries a melodic LEAD. A background:true instrument is
 * never drawn for one of these by automatic generation (§10, §11): "kalimba" and
 * "sparse low-level kalimba punctuation in the background" are not equivalent
 * instructions, and the fix for that starts with never handing it the tune. */
export const LEAD_ROLES = new Set(['motif', 'counter']);

// Conservative fallback. Never reached at runtime — validate-instruments.mjs
// asserts every pool string is present above — but if it ever were, an unknown
// name must not gain automatic status by being forgotten.
const UNKNOWN = { tier:'expert', why:'unclassified' };

export function classOf(name) {
  return INSTRUMENT_CLASS[name] || UNKNOWN;
}

export function tierOf(name) {
  return classOf(name).tier;
}

export function isAutomatic(name) {
  return classOf(name).tier !== 'expert';
}

export function isBackgroundOnly(name) {
  return !!classOf(name).background;
}

/* eligible(names, poolRole) — the automatic-generation view of a pool.
 * Drops expert-tier entries entirely, and drops background-only entries from
 * lead-carrying roles. Returns a NEW array; the pool itself is never mutated,
 * so the full authored set stays available to an expert/manual path later. */
export function eligible(names, poolRole) {
  if (!Array.isArray(names)) return [];
  return names.filter(n =>
    isAutomatic(n) && !(LEAD_ROLES.has(poolRole) && isBackgroundOnly(n)));
}

// Introspection for the validator and any future expert-mode UI.
export function expertOnlyNames() {
  return Object.keys(INSTRUMENT_CLASS).filter(n => INSTRUMENT_CLASS[n].tier === 'expert');
}

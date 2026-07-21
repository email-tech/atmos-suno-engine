/* ==========================================================================
 * cil.js — Compositional Inference Layer (P3 of the Composition Workbench).
 *
 * A PURE CONSUMER of MusicalDNA (+ inference profiles). It fills the lyric /
 * performance fields the DNA leaves 'unknown' (affect, vocal), tags each with a
 * PROVENANCE TIER, and computes the RESIDUE: the low-confidence / unknown items
 * the Lyric engine (P4) will ask about. Default mode surfaces at most 5.
 *
 * Guarantees (all proven headless in validate-cil.mjs):
 *   - NEVER mutates the DNA and NEVER touches render/style. Style output is
 *     unaffected — CIL is downstream of compose, not part of it.
 *   - CONSUMER-CONTRACT SAFE: only emits into DNA fields whose consumer set
 *     includes lyric/metatag and EXCLUDES style (affect, vocal). Affect is an
 *     abstract CLASS, never Suno prose, so nothing here can leak into a prompt.
 *   - Deterministic: no RNG; identical DNA in → identical inference out.
 *
 * PROVENANCE TIERS (winning-evidence order): a concrete signal from THIS
 * composition beats a generic genre default, so:
 *     derived  > inferred > profile > unknown
 * Only 'derived' is silent; everything below is surfaced in the residue as a
 * pre-filled SUGGESTION the user can override. (Ordering lives in the rule table
 * and TIERS below — trivially flippable to strict profile>inferred if John
 * prefers.) The `ruleId` recorded per field is the provenance hook seeded in P2.
 * ========================================================================*/

import { profileFor, MOOD_CLASSES } from './profiles.js';

export const CIL_VERSION = '1.0';
export const TIERS = Object.freeze(['derived', 'inferred', 'profile', 'unknown']);
const SILENT = new Set(['derived']); // never asked

// ---- DNA signal readers (defensive: text fields may be null) --------------
const hasWord = (t, w) => !!t && String(t).toLowerCase().includes(w);
function bpmMid(dna) {
  const s = dna.tempo && dna.tempo.spec;
  if (!s) return null;
  const m = String(s).match(/(\d{2,3})\s*[-\u2013]\s*(\d{2,3})/);
  if (m) return (Number(m[1]) + Number(m[2])) / 2;
  const one = String(s).match(/(\d{2,3})/);
  return one ? Number(one[1]) : null;
}

// ---- affect.moodClass inference (data-driven; first strong signal wins) ----
// Each rule returns a moodClass when its DNA signal is unambiguous. Order below
// = evidence priority. Falls through to the profile default, then 'unknown'.
const MOOD_RULES = [
  { id: 'beatless-contemplative', value: 'contemplative',
    test: d => !!(d.dynamics && d.dynamics.beatless) },
  { id: 'darkminor-brooding', value: 'brooding',
    test: d => hasWord(d.harmony && d.harmony.keyMode, 'minor') || hasWord(d.harmony && d.harmony.keyMode, 'dark') },
  { id: 'uptempo-euphoric', value: 'euphoric',
    test: d => { const b = bpmMid(d); return b != null && b >= 118; } },
];

function inferMoodClass(dna) {
  for (const r of MOOD_RULES) {
    if (r.test(dna)) return { value: r.value, tier: 'inferred', ruleId: r.id };
  }
  const p = profileFor(dna);
  if (p && p.moodClass) return { value: p.moodClass, tier: 'profile', ruleId: 'profile-default' };
  return { value: null, tier: 'unknown', ruleId: null };
}

// ---- vocal.mode inference --------------------------------------------------
// Genuinely a user choice, so always residue — but pre-filled with a suggestion
// from disposition + beatless signal.
function inferVocalMode(dna) {
  const p = profileFor(dna);
  const disposition = p ? p.vocalDisposition : 'either';
  let suggest = 'instrumental';
  if (disposition === 'vocal-capable') suggest = 'vocal';
  if (dna.dynamics && dna.dynamics.beatless) suggest = 'instrumental';
  return { value: suggest, tier: 'inferred', ruleId: 'vocal-disposition', disposition };
}

// ---- residue question templates -------------------------------------------
const QUESTIONS = {
  'vocal.mode':          { priority: 1, question: 'Vocal or instrumental?', options: ['instrumental', 'vocal'] },
  'affect.moodClass':    { priority: 2, question: 'Overall mood class?', options: MOOD_CLASSES },
  'vocal.deliveryClass': { priority: 3, question: 'Vocal delivery?', options: ['lead-melodic', 'spoken/chant', 'wordless/textural', 'choir/pad'] },
};

function buildQuestion(field, res) {
  const q = QUESTIONS[field] || { priority: 99, question: field, options: [] };
  return {
    field,
    priority: q.priority,
    question: q.question,
    options: q.options,
    suggested: res.value,
    tier: res.tier,
    source: res.ruleId,
  };
}

// ---- light conflict scan (full recommendation engine is P6) ---------------
function scanConflicts(dna, fields) {
  const out = [];
  const v = fields['vocal.mode'];
  if (v && v.value === 'vocal' && dna.dynamics && dna.dynamics.beatless) {
    out.push({
      id: 'vocal-on-beatless',
      severity: 'note',
      message: 'Beatless ambient character — a vocal will need sparse, textural delivery to stay in-genre.',
    });
  }
  return out;
}

// ---- entry point -----------------------------------------------------------
// Pure: reads dna, returns a fresh inference object; never writes back.
export function inferCIL(dna) {
  const mood = inferMoodClass(dna);
  const vmode = inferVocalMode(dna);

  const fields = {
    'affect.moodClass': mood,
    'vocal.mode': vmode,
  };
  // delivery only matters once a vocal is plausible
  if (vmode.value === 'vocal' || (vmode.disposition && vmode.disposition !== 'instrumental-leaning')) {
    fields['vocal.deliveryClass'] = { value: null, tier: 'unknown', ruleId: null };
  }

  const residueFull = [];
  const provenance = {};
  for (const [field, res] of Object.entries(fields)) {
    provenance[field] = res.tier;
    if (!SILENT.has(res.tier)) residueFull.push(buildQuestion(field, res));
  }
  residueFull.sort((a, b) => a.priority - b.priority);

  return {
    cilVersion: CIL_VERSION,
    fields,
    provenance,
    residue: residueFull.slice(0, 5),   // Default mode: <=5
    residueFull,
    recommendations: scanConflicts(dna, fields),
  };
}

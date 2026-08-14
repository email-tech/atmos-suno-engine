/* ==========================================================================
 * lyric.js — Lyric Engine (P4 of the Composition Workbench). CRITICAL PATH.
 *
 * A DNA + CIL consumer. It asks only the residue, then either short-circuits to
 * the [Instrumental] tag or assembles a creative brief and builds a Claude prompt
 * for ORIGINAL lyrics. It FEEDS the proven lyric-prompt language John validated
 * empirically (concept hierarchy, section discipline, JSON contract, repair loop),
 * sourced from the prior prompt-lyric-builder.js — reused, not rebuilt — but wired
 * from Musical DNA instead of the old UI state object.
 *
 * CONSUMER CONTRACT (enforced): the lyric engine reads ONLY the DNA fields whose
 * consumer set includes 'lyric' — identity, influences, harmony, tempo, vocal,
 * affect. It never reads arrangement / dynamics / production (those are style +
 * metatag). Energy is derived from tempo (allowed), mood from CIL affect (allowed).
 *
 * SAFETY RULES (enforced + validated headless):
 *   - [Instrumental] short-circuit when vocal.mode resolves 'instrumental'. That
 *     tag is the reliable suppression mechanism; lyric GENERATION is skipped, but
 *     the metatag engine (P5) still runs downstream — this engine just returns.
 *   - ORIGINAL lyrics only; never reproduce/quote existing lyrics.
 *   - NO artist names in the prompt or output. Influences are applied as GENERIC
 *     craft traits only (renderPolicy 'never' on DNA.influences) — never "write
 *     like <name>".
 *   - Deterministic brief + prompt assembly (the model call is the only nondeterm-
 *     inism, and it is dependency-injected so this module is testable offline).
 * ========================================================================*/

import { CONTROL_OPTIONS, STRUCTURE_TEMPLATES, TEMPLATE_FOR_SUBGENRE, templateById } from './lyric-controls.js';
import { DNA_CONSUMERS } from './dna.js';
import { validateLyrics, QUALITY_THRESHOLD, MAX_LYRIC_ATTEMPTS } from './lyric-validator.js';

export const LYRIC_VERSION = '1.0';
export const DEFAULT_LYRIC_MODEL = 'claude-opus-4-8'; // current; configurable by the client

// DNA fields this engine may read (contract). Used to keep the brief honest.
export const LYRIC_READABLE = Object.freeze(
  Object.keys(DNA_CONSUMERS).filter(f => DNA_CONSUMERS[f].includes('lyric'))
);

// --- helpers (tempo is lyric-readable) -------------------------------------
function bpmMid(dna) {
  const s = dna.tempo && dna.tempo.spec;
  if (!s) return null;
  const m = String(s).match(/(\d{2,3})\s*[-\u2013]\s*(\d{2,3})/);
  if (m) return (Number(m[1]) + Number(m[2])) / 2;
  const one = String(s).match(/(\d{2,3})/);
  return one ? Number(one[1]) : null;
}
function energyFromTempo(dna) {
  const b = bpmMid(dna);
  if (b == null) return 'Mid';
  if (b < 90) return 'Low-mid';
  if (b < 110) return 'Mid';
  if (b < 122) return 'Medium-high';
  return 'High';
}
// CIL abstract mood class -> proven mood vocabulary (for guidance lookup).
const MOODCLASS_TO_MOOD = {
  contemplative: 'Serene', ethereal: 'Mystical', warm: 'Hopeful', nocturnal: 'Mysterious',
  brooding: 'Dark / brooding', euphoric: 'Euphoric but restrained', driving: 'Defiant',
  hypnotic: 'Mystical', wistful: 'Yearning',
};

// --- residue: CIL residue + the lyric-specific asks, capped <=5 -------------
export function lyricResidue(dna, cil) {
  const q = [
    { field: 'song.subject',     priority: 1, question: 'Subject / topic of the song?', options: [], suggested: null, tier: 'unknown' },
  ];
  for (const r of cil.residue) {
    const pr = r.field === 'vocal.mode' ? 2 : r.field === 'affect.moodClass' ? 3 : 6;
    q.push({ field: r.field, priority: pr, question: r.question, options: r.options, suggested: r.suggested, tier: r.tier });
  }
  q.push({ field: 'song.perspective', priority: 4, question: 'Perspective / speaker?',   options: CONTROL_OPTIONS.perspective, suggested: 'First person',     tier: 'profile' });
  q.push({ field: 'song.themeLens',   priority: 5, question: 'Interpretation lens?',      options: CONTROL_OPTIONS.themeLens,   suggested: 'Inspired by source', tier: 'profile' });
  q.push({ field: 'song.sourceType',  priority: 7, question: 'Source type?',              options: CONTROL_OPTIONS.sourceType,  suggested: 'Original concept',   tier: 'profile' });
  q.push({ field: 'song.languageStyle', priority: 8, question: 'Language style?',         options: CONTROL_OPTIONS.languageStyle, suggested: 'Poetic',           tier: 'profile' });
  q.sort((a, b) => a.priority - b.priority);
  return { all: q, default: q.slice(0, 5) };
}

// --- generic writing tendencies (NEVER names) ------------------------------
function writingTraits(moodClass, languageStyle) {
  const base = {
    contemplative: ['spacious', 'restrained', 'image-led'],
    ethereal:      ['symbolic', 'airy', 'open-vowel'],
    warm:          ['intimate', 'sensory', 'plain-poetic'],
    nocturnal:     ['shadowed', 'suggestive', 'sparse'],
    brooding:      ['tense', 'symbolic', 'controlled'],
    euphoric:      ['uplifting', 'repetitive-hook', 'bright'],
    driving:       ['direct', 'rhythmic', 'urgent'],
    hypnotic:      ['mantra-like', 'repetitive', 'minimal'],
    wistful:       ['longing', 'memory-led', 'gentle'],
  }[moodClass] || ['image-led', 'singable'];
  return Array.from(new Set([...base, (languageStyle || 'poetic').toLowerCase()]));
}

// --- brief: merge DNA (lyric-readable only) + CIL + user answers ------------
// STRUCTURE-FIRST PIPELINE, Phase 3 (docs/architecture/structure-first-pipeline-plan.md,
// approved by John 2026-08-12; scope confirmed as "names and positions only" —
// no energy/bar data passed to this engine). `structure`, when supplied, is
// {songType: 'vocal'|'instrumental', sections: [string, ...]} resolved from
// core/structure.js's STRUCTURE_PRESETS via resolveStructure(). Song type is
// decision #1 in John's ordering and OVERRIDES any vocal.mode inferred by CIL
// or given in answers — by the time a structure preset has been picked, song
// type was already decided upstream and the lyric brief must not re-derive or
// contradict it. structure.sections (names + order only) becomes the
// authoritative section list for the prompt, replacing the legacy
// STRUCTURE_TEMPLATES pick when present. Omitting `structure` preserves prior
// behaviour exactly (backward compatible with every existing caller/test).
// lockedMetatags (5th arg, optional): the real, pre-composed Suno metatag
// block for THIS build — one piped line per section, in the SAME order as
// structureSections/template.sections below (js/generate.js's
// buildLiveLyricRequest computes both from the same resolved structure, so
// they line up by construction). METATAG/LYRIC MERGE, VOCAL CASE (John,
// 2026-08-14 decision, Path B): these are grounded in the DNA-real
// arrangement, never invented, and buildLyricPrompt() below hands them to the
// LLM as FIXED, non-negotiable content — the model's only job for tags is an
// ADDITIVE layer (backing vocals / harmonies / ad-libs / call-and-response
// tied to specific lines) that the deterministic metatag engine structurally
// cannot produce, since it never sees lyric content. Omitting this argument
// (null/undefined) reproduces the exact pre-2026-08-14 behaviour — the LLM
// invents its own generic tags — so every existing caller is unaffected.
export function assembleLyricBrief(dna, cil, answers, structure, lockedMetatags) {
  const a = answers || {};
  const cilf = cil.fields || {};
  const vocalMode = (structure && structure.songType)
    || a['vocal.mode'] || (cilf['vocal.mode'] && cilf['vocal.mode'].value) || 'instrumental';
  const moodClass = a['affect.moodClass'] || (cilf['affect.moodClass'] && cilf['affect.moodClass'].value) || null;
  const characterId = dna.meta && dna.meta.characterId;

  const template = templateById(a.templateId)
    || templateById(TEMPLATE_FOR_SUBGENRE[characterId])
    || STRUCTURE_TEMPLATES[0];

  // influences applied as GENERIC context only — never names (renderPolicy 'never')
  const influenceTraits = (dna.influences || [])
    .filter(inf => inf.applied)
    .map(inf => inf.kind); // 'composer' | 'producer' | 'remixer' — a role word, not a name

  return {
    lyricVersion: LYRIC_VERSION,
    vocalMode,                                   // 'vocal' | 'instrumental'
    // musical context — DNA lyric-readable fields ONLY
    genreAnchor: dna.identity && dna.identity.genreAnchor,
    subgenre:    dna.identity && dna.identity.subgenre,
    keyMode:     dna.harmony && dna.harmony.keyMode,
    tempoSpec:   dna.tempo && dna.tempo.spec,
    energy:      energyFromTempo(dna),
    moodClass,
    mood:        moodClass ? (MOODCLASS_TO_MOOD[moodClass] || 'Serene') : 'Serene',
    influenceTraits,
    writingTraits: writingTraits(moodClass, a['song.languageStyle']),
    // resolved user controls (with proven defaults)
    subject:      a['song.subject'] || '',
    sourceType:   a['song.sourceType']   || 'Original concept',
    themeLens:    a['song.themeLens']    || 'Inspired by source',
    perspective:  a['song.perspective']  || 'First person',
    languageStyle:a['song.languageStyle']|| 'Poetic',
    titleSeed:    a['song.title'] || null,
    // QUALITY SPEC (2026-08-12, added alongside the lyric-quality validator).
    // CONTROL_OPTIONS.lineLength / rhymeDensity existed as vocabulary but were
    // never read from answers or surfaced to the LLM — a prompt asking for a
    // spec the model was never told, then silently graded against nothing.
    // Wired here so the SAME value drives both the prompt instruction and the
    // independent validator: one source of truth, not two things that can drift.
    lineLength:   a['song.lineLength']   || 'Flexible',
    rhymeDensity: a['song.rhymeDensity'] || 'Moderate',
    template,
    // structure-first pipeline section list (names + positions only). Null
    // when no structure was supplied — buildLyricPrompt() falls back to
    // template.sections in that case, unchanged from pre-Phase-3 behaviour.
    structureSections: (structure && Array.isArray(structure.sections) && structure.sections.length)
      ? structure.sections.slice() : null,
    structurePresetLabel: (structure && structure.presetLabel) || null,
    deliveryClass: a['vocal.deliveryClass'] || (cilf['vocal.deliveryClass'] && cilf['vocal.deliveryClass'].value) || null,
    // string or null — see the function header comment for what this is and
    // why it's only ever additive input, never something the brief derives.
    lockedMetatags: (typeof lockedMetatags === 'string' && lockedMetatags.trim()) ? lockedMetatags : null,
  };
}

// --- prompt assembly -------------------------------------------------------
// Instrumental short-circuit or a proven original-lyric Claude prompt.
export function buildLyricPrompt(brief) {
  if (brief.vocalMode === 'instrumental') {
    return { instrumental: true, lyrics: '[Instrumental]', prompt: null };
  }
  const t = brief.template;
  // STRUCTURE-FIRST: brief.structureSections (names + positions only) wins
  // when present — it's the preset the user picked upstream in the pipeline,
  // not a subgenre-inferred guess. Falls back to the legacy per-subgenre
  // template when no structure was supplied (pre-Phase-3 behaviour).
  const sectionNames = brief.structureSections || t.sections;
  const labels = sectionNames.map(s => `[${s}]`);
  const prompt = [
    'You are writing Suno-compatible ORIGINAL lyrics for a local music prompt tool.',
    'Return valid JSON only. Do not wrap in markdown fences. Do not include explanations outside JSON.',
    lyricSchema(),
    contextBlock(brief, labels),
    conceptRules(),
    originalityRules(),
    'Final lyrics rules:',
    '- Lyrics must be mainly English unless a foreign-language layer is requested.',
    '- Do not include translations, pronunciation guides, or explanations in final lyrics.',
    `- Use Suno section labels exactly and in this order: ${labels.join(' ')}.`,
    metatagInstructions(brief, sectionNames),
    '- Make the chorus memorable, singable, and clear.',
    validationBlock(),
  ].join('\n\n');
  return { instrumental: false, lyrics: null, prompt };
}

// --- metatag handoff: locked (Path B) or the legacy generic instruction ----
// John, 2026-08-14 decision: grounded per-section metatags — when the caller
// supplied them via assembleLyricBrief's lockedMetatags argument — are FIXED,
// authoritative content the LLM must reproduce verbatim, never invent. See
// assembleLyricBrief's header comment for the full reasoning. Falls back to
// the original generic "invent 3-5 tags" instruction whenever lockedMetatags
// is absent (unchanged prior behaviour) OR its line count doesn't match this
// exact prompt's section list — a mismatch would mean pointing the LLM at
// the wrong tag for the wrong section, worse than the generic instruction,
// so this refuses to hand off rather than risk that silently.
function metatagInstructions(brief, sectionNames) {
  const generic = '- Place 3-5 short functional Suno metatags inside the lyrics string as local musical direction (entrance, contrast, handoff, lift, release), not scenic labels.';
  if (!brief.lockedMetatags) return generic;
  const lines = brief.lockedMetatags.split('\n').filter(Boolean);
  if (lines.length !== sectionNames.length) return generic;
  return [
    'LOCKED METATAGS (mandatory \u2014 pre-composed from this build\u2019s real instrumentation, grounded, never invented):',
    'For each section below, use the exact bracketed tag shown as that section\u2019s marker in your lyrics output, in this same order, verbatim. Do not reword, reorder, drop, shorten, or invent an alternate version of any of them.',
    lines.join('\n'),
    'You may ADD your own short vocal-performance direction \u2014 but ONLY for content the locked tags structurally cannot know: backing-vocal entrances, harmony placement, ad-libs, or call-and-response tied to a specific line or word. Any addition must be woven INLINE into an actual lyric line\u2019s text (mixed with real words on that same line), 1-4 words, in its own bracket \u2014 e.g. "the night pulls me forward [harmony rises] toward something unnamed." NEVER place an addition alone on its own line: a line that is ONLY a bracket is read as a NEW section marker, which would corrupt the section count.',
  ].join('\n');
}

// buildRepairPrompt: seeded with the INDEPENDENT validator's specific findings
// (qualityResult, from core/lyric-validator.js's validateLyrics()) rather than
// the LLM's own self-report. qualityResult is optional for callers that only
// have the model's self-reported validation block (pre-quality-gate callers);
// when present it always wins, since it's the real check.
export function buildRepairPrompt(brief, initialResult, qualityResult) {
  const sectionNames = brief.structureSections || brief.template.sections;
  const labels = sectionNames.map(s => `[${s}]`);
  const issues = qualityResult ? qualityResult.issues
    : (initialResult.validation ? initialResult.validation.issues : []);
  const score = qualityResult ? qualityResult.score
    : (initialResult.validation ? initialResult.validation.score : 'n/a');
  return [
    `You generated lyrics that failed independent quality validation (score ${score}, threshold ${QUALITY_THRESHOLD}). Rewrite only where needed to fix the specific issues below — do not start over.`,
    'Specific issues found (fix these exactly, not general impressions):',
    JSON.stringify(issues, null, 2),
    'Preserve the concept, structure, section labels, language settings, and originality rules.',
    lyricSchema(),
    contextBlock(brief, labels),
    originalityRules(),
    metatagInstructions(brief, sectionNames),
    'Initial lyrics:', String(initialResult.lyrics || ''),
  ].join('\n\n');
}

// batch-of-10: one brief+prompt per answers entry (caller varies subject/etc.)
// structure (names+positions only, see assembleLyricBrief) is shared across
// the whole batch — every variation in a batch belongs to the same arrangement
// and must honour the same picked structure preset.
export function buildLyricBatch(dna, cil, answersList, structure, lockedMetatags) {
  return (answersList || []).map(answers => {
    const brief = assembleLyricBrief(dna, cil, answers, structure, lockedMetatags);
    return { brief, ...buildLyricPrompt(brief) };
  });
}

// --- runtime driver (transport injected; never called in headless tests) ----
// ROUND-ROBIN QUALITY GATE (2026-08-12, John — 85% threshold, round-robin
// repair on failure). `repair: true` enables the loop; false/omitted keeps the
// old single-shot behaviour (one generation, no retry) for callers that don't
// want the extra latency/cost. When looping: generate -> validate
// INDEPENDENTLY (core/lyric-validator.js, not the model's self-report) ->
// if below QUALITY_THRESHOLD, build a repair prompt seeded with the SPECIFIC
// deterministic failures -> regenerate -> re-validate -> repeat, capped at
// MAX_LYRIC_ATTEMPTS (initial + repairs). Returns the best-scoring attempt
// seen even if the threshold is never crossed, flagged via thresholdMet.
export async function runLyricEngine({ dna, cil, answers, structure, lockedMetatags, transport, model, temperature, maxTokens, repair }) {
  const brief = assembleLyricBrief(dna, cil, answers, structure, lockedMetatags);
  const built = buildLyricPrompt(brief);
  if (built.instrumental) {
    return { instrumental: true, title: brief.titleSeed || null, lyrics: '[Instrumental]', brief };
  }
  if (typeof transport !== 'function') throw new Error('runLyricEngine needs a transport(prompt)->text function.');

  const maxAttempts = repair ? MAX_LYRIC_ATTEMPTS : 1;
  let prompt = built.prompt;
  let best = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const raw = await transport({ prompt, model: model || DEFAULT_LYRIC_MODEL, temperature, maxTokens });
    const result = parseLyricJSON(raw);
    if (!result || typeof result.lyrics !== 'string') {
      // malformed JSON — nothing to validate; retry the SAME prompt if attempts remain.
      if (attempt === maxAttempts) {
        return { instrumental: false, brief, attempts: attempt, thresholdMet: false, parseError: true };
      }
      continue;
    }
    const quality = validateLyrics(result.lyrics, brief);
    const record = { ...result, brief, quality, attempts: attempt, thresholdMet: quality.passed };
    if (!best || quality.score > best.quality.score) best = record;
    if (quality.passed) return { instrumental: false, ...record };
    if (attempt < maxAttempts) prompt = buildRepairPrompt(brief, result, quality);
  }

  return { instrumental: false, ...best };
}

export function parseLyricJSON(text) {
  if (!text) return null;
  const clean = String(text).replace(/```json|```/g, '').trim();
  try { return JSON.parse(clean); } catch { return null; }
}

// --- proven prompt blocks (ported from prompt-lyric-builder.js, DNA-wired) ---
function lyricSchema() {
  return `Required JSON schema:
{
  "title": "A concise song title derived from the subject/topic.",
  "themeBrief": "1-2 paragraph internal creative brief.",
  "lyrics": "[Section]\\n...\\n[Section]",
  "lyricMetaTags": "Short explanation-free metatag strategy.",
  "validation": { "score": 88, "passed": true, "summary": "...", "issues": [], "fixesApplied": [] }
}`;
}
function contextBlock(brief, labels) {
  const structureLabel = brief.structurePresetLabel || brief.template.label;
  return `Musical context (from the finished arrangement's DNA):
Genre anchor: ${brief.genreAnchor || 'n/a'}
Subgenre: ${brief.subgenre || 'n/a'}
Key / mode: ${brief.keyMode || 'n/a'}
Tempo: ${brief.tempoSpec || 'n/a'}
Energy: ${brief.energy}
Mood: ${brief.mood} (class: ${brief.moodClass || 'n/a'})
Generic craft traits to honour (NOT artists): ${brief.writingTraits.join(', ')}

Song controls:
Subject/topic: ${brief.subject || 'none - create a fitting concept from the mood + genre'}
Source type: ${brief.sourceType}
Theme lens: ${brief.themeLens}
Perspective: ${brief.perspective}
Language style: ${brief.languageStyle}
Optional title seed: ${brief.titleSeed || 'none - create a suitable title from the subject/topic'}
Vocal delivery: ${brief.deliveryClass || 'lead-melodic'}
Line length target: ${brief.lineLength}
Rhyme density target: ${brief.rhymeDensity}
Structure: ${structureLabel}
Required sections in order: ${labels.join(', ')}`;
}
function conceptRules() {
  return `Concept hierarchy:
- Derive the main concept from Subject/topic; if none is given, invent one that fits the mood and genre.
- Create a suitable song title from the subject/topic; use the optional title seed only if it genuinely fits.
- Source type must shape the emotional evidence, imagery, and narrative frame.
- Theme lens must change the angle of interpretation, not just wording.
- Mood must be interpreted through the specific subject, never named as a bare adjective.
- Energy must affect lyric density, section momentum, and how fast the emotional point arrives.
- Perspective must control who is speaking in every section.
- Line length target and rhyme density target are requirements, not suggestions — every line should land inside the requested syllable range, and end-rhyme frequency should match the requested density. These will be checked independently after generation.`;
}
function originalityRules() {
  return `Originality and safety rules (mandatory):
- Write 100% ORIGINAL lyrics. Never reproduce, quote, or closely paraphrase existing song lyrics.
- Do NOT name, address, or imitate any specific artist, band, or songwriter. Apply any stylistic direction ONLY as generic craft traits (e.g. sparse, symbolic, open-vowel).
- No real public figures' words. No copyrighted text.`;
}
function validationBlock() {
  return `Validation:
Self-assess and report a score out of 100 in the JSON validation block. Aim for ${QUALITY_THRESHOLD}+. Assess concept fidelity, source-type interpretation, theme lens, perspective consistency, energy match, structure/section-label compliance, integrated Suno metatags, chorus memorability, hook clarity, singability, rhyme naturalness, cliche avoidance, originality, and absence of explanatory text.
Note: an independent, deterministic check runs after this response (section labels, syllable count, rhyme density) — your self-assessment is a sanity check, not the final gate. Meeting the line-length and rhyme-density targets exactly matters more than a high self-reported score.`;
}

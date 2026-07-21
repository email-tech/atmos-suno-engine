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
export function assembleLyricBrief(dna, cil, answers) {
  const a = answers || {};
  const cilf = cil.fields || {};
  const vocalMode = a['vocal.mode'] || (cilf['vocal.mode'] && cilf['vocal.mode'].value) || 'instrumental';
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
    template,
    deliveryClass: a['vocal.deliveryClass'] || (cilf['vocal.deliveryClass'] && cilf['vocal.deliveryClass'].value) || null,
  };
}

// --- prompt assembly -------------------------------------------------------
// Instrumental short-circuit or a proven original-lyric Claude prompt.
export function buildLyricPrompt(brief) {
  if (brief.vocalMode === 'instrumental') {
    return { instrumental: true, lyrics: '[Instrumental]', prompt: null };
  }
  const t = brief.template;
  const labels = t.sections.map(s => `[${s}]`);
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
    '- Place 3-5 short functional Suno metatags inside the lyrics string as local musical direction (entrance, contrast, handoff, lift, release), not scenic labels.',
    '- Make the chorus memorable, singable, and clear.',
    validationBlock(),
  ].join('\n\n');
  return { instrumental: false, lyrics: null, prompt };
}

export function buildRepairPrompt(brief, initialResult) {
  const labels = brief.template.sections.map(s => `[${s}]`);
  return [
    'You generated lyrics that failed validation. Rewrite only where needed; improve the score to 80+.',
    `Validation score: ${initialResult.validation ? initialResult.validation.score : 'n/a'}`,
    'Issues:', JSON.stringify(initialResult.validation ? initialResult.validation.issues : [], null, 2),
    'Preserve the concept, structure, section labels, language settings, and originality rules.',
    lyricSchema(),
    contextBlock(brief, labels),
    originalityRules(),
    'Initial lyrics:', String(initialResult.lyrics || ''),
  ].join('\n\n');
}

// batch-of-10: one brief+prompt per answers entry (caller varies subject/etc.)
export function buildLyricBatch(dna, cil, answersList) {
  return (answersList || []).map(answers => {
    const brief = assembleLyricBrief(dna, cil, answers);
    return { brief, ...buildLyricPrompt(brief) };
  });
}

// --- runtime driver (transport injected; never called in headless tests) ----
export async function runLyricEngine({ dna, cil, answers, transport, model, temperature, maxTokens, repair }) {
  const brief = assembleLyricBrief(dna, cil, answers);
  const built = buildLyricPrompt(brief);
  if (built.instrumental) {
    return { instrumental: true, title: brief.titleSeed || null, lyrics: '[Instrumental]', brief };
  }
  if (typeof transport !== 'function') throw new Error('runLyricEngine needs a transport(prompt)->text function.');
  const raw = await transport({ prompt: built.prompt, model: model || DEFAULT_LYRIC_MODEL, temperature, maxTokens });
  let result = parseLyricJSON(raw);
  if (repair && result && result.validation && result.validation.passed === false) {
    const raw2 = await transport({ prompt: buildRepairPrompt(brief, result), model: model || DEFAULT_LYRIC_MODEL, temperature, maxTokens });
    result = parseLyricJSON(raw2) || result;
  }
  return { instrumental: false, ...result, brief };
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
Structure: ${brief.template.label}
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
- Perspective must control who is speaking in every section.`;
}
function originalityRules() {
  return `Originality and safety rules (mandatory):
- Write 100% ORIGINAL lyrics. Never reproduce, quote, or closely paraphrase existing song lyrics.
- Do NOT name, address, or imitate any specific artist, band, or songwriter. Apply any stylistic direction ONLY as generic craft traits (e.g. sparse, symbolic, open-vowel).
- No real public figures' words. No copyrighted text.`;
}
function validationBlock() {
  return `Validation:
Standard validation passes at 80+. Assess concept fidelity, source-type interpretation, theme lens, perspective consistency, energy match, structure/section-label compliance, integrated Suno metatags, chorus memorability, hook clarity, singability, rhyme naturalness, cliche avoidance, originality, and absence of explanatory text.`;
}

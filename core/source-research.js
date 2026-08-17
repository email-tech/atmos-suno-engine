/* ==========================================================================
 * source-research.js — STEP 1 of the two-step lyric flow (John, 2026-08-17).
 *
 * WHAT THIS IS FOR
 * John's brief: "The user might suggest a movie, The app would send this
 * suggestion to an LLM to research the movie and report back in 1-2
 * paragraphs the Premise. Then the app would use the premise to resend back
 * to the LLM with the full spec built around the word density, rhyming,
 * syllable count etc."
 *
 * WHY TWO CALLS AND NOT ONE. core/lyric.js's JSON schema already asks the
 * model for a `themeBrief` ("1-2 paragraph internal creative brief") in the
 * same pass, so a single-call version is technically available and was
 * considered. It loses on cost, not on capability: if the model's reading of
 * the work is wrong, a one-pass design burns the entire lyric generation AND
 * its repair loop (thousands of output tokens, up to MAX_LYRIC_ATTEMPTS
 * times) before that is detectable. This pre-pass is a few hundred tokens and
 * fails early. It is also the only place web grounding can be attached
 * without putting a search tool on the creative call, where it would invite
 * the model to look up and echo existing song lyrics about the same subject —
 * exactly what originalityRules() exists to prevent.
 *
 * GATING. This never fires for every build. needsSourceResearch() requires
 * BOTH a known-work source type AND a non-empty subject. 'Original concept'
 * and 'Personal memory' have no external work to look up and stay single-call,
 * which is the common case.
 *
 * GROUNDING (John, 2026-08-17: "The Call gets Web grounding"). The research
 * transport is invoked with grounded:true; js/gemini-client.js and
 * js/claude-client.js each attach their provider's own web-search tool. An
 * ungrounded model will confidently invent a premise for anything obscure,
 * which then silently becomes the emotional basis of the whole lyric.
 *
 * NOT SHOWN IN THE UI (John, 2026-08-17: "Don't show the premise in the UI").
 * The premise flows straight through into the lyric brief. It is still
 * RETURNED on the result object so it can be inspected in a test harness and
 * so a future UI pass can surface it without touching this module.
 * ========================================================================*/

/* Source types that name an EXTERNAL WORK OR SUBJECT worth looking up.
 * 'TV series' added 2026-08-17 (John: "Perfect now you've added a TV Show").
 * Deliberately NOT here: 'Original concept' and 'Personal memory' — there is
 * nothing external to research, and a search on a personal memory is both
 * useless and a privacy smell. */
export const RESEARCHABLE_SOURCE_TYPES = Object.freeze([
  'Movie', 'TV series', 'Book', 'Historical figure', 'Myth / legend',
  'True event', 'Cultural movement',
]);

export function isResearchableSourceType(sourceType) {
  return RESEARCHABLE_SOURCE_TYPES.includes(String(sourceType || '').trim());
}

/* needsSourceResearch — the gate. Both conditions required: a researchable
 * type AND something to research. "Movie" with an empty subject means the
 * user picked a type and never named a film; researching nothing would waste
 * a call and return a hallucinated premise for an unnamed work. */
export function needsSourceResearch(sourceType, subject) {
  return isResearchableSourceType(sourceType) && !!String(subject || '').trim();
}

/* Per-type framing for the research call. This asks for DIFFERENT FACTS per
 * type, because the useful raw material differs: a film's premise is its
 * dramatic situation, a historical figure's is the human cost behind a public
 * record. Distinct from core/lyric-controls.js's SOURCE_TYPE_GUIDANCE, which
 * tells the LYRIC call how to WRITE from the material — this tells the
 * RESEARCH call what to GO AND FIND. */
const RESEARCH_FOCUS = Object.freeze({
  'Movie':             'the dramatic premise, the central conflict, who wants what and what stands in the way, the setting and period, and the emotional register of the ending.',
  'TV series':         'the series premise, its recurring central conflict, the main character situation, the setting and period, and the emotional register the show sustains across episodes.',
  'Book':              'the narrative premise, the central conflict, the protagonist\u2019s interior problem, the setting and period, and the emotional register of the resolution.',
  'Historical figure': 'who they were, what they are actually known for, the human cost or private tension behind the public record, the period and place, and how they are remembered.',
  'Myth / legend':     'the story as commonly told, its central transgression or trial, the figures involved, the culture and period it belongs to, and the moral or emotional weight it carries.',
  'True event':        'what actually happened, when and where, who it happened to, what was at stake, and the documented human aftermath.',
  'Cultural movement': 'what the movement was, when and where it happened, what it was reacting against, what it felt like to be inside it, and what it left behind.',
});

/* buildSourceResearchPrompt — deterministic, testable, no network.
 *
 * COPYRIGHT GUARDRAIL. Grounding means this call really does fetch source
 * material, so the prompt has to forbid reproduction explicitly rather than
 * relying on the model's own restraint. A factual premise stated in the
 * model's own words is fine; dialogue, script text, prose passages and song
 * lyrics are not, and a verbatim passage arriving here would be laundered
 * straight into the lyric call where nothing downstream would recognise it.
 *
 * The `confidence` field exists so a low-confidence premise is at least
 * visible to the caller rather than indistinguishable from a solid one. */
export function buildSourceResearchPrompt({ sourceType, subject }) {
  const type = String(sourceType || '').trim();
  const title = String(subject || '').trim();
  const focus = RESEARCH_FOCUS[type] || 'the premise, the central conflict, the setting and period, and the emotional register.';
  return [
    'You are a research assistant for a songwriting tool. Use web search to check your facts before answering.',
    `Research this ${type.toLowerCase()}: "${title}".`,
    `Report ${focus}`,
    '',
    'Return valid JSON only. No markdown fences, no commentary outside the JSON.',
    `{
  "identified": "The full canonical title/name you actually researched, with year where one applies. Use \\"unknown\\" if you could not confidently identify it.",
  "premise": "One to two paragraphs of plain factual premise, written entirely in your own words.",
  "conflict": "One sentence: the central conflict or tension.",
  "emotionalCore": "One sentence: the dominant emotional register.",
  "setting": "Place and period, briefly.",
  "confidence": "high | medium | low"
}`,
    '',
    'Rules:',
    '- Write everything in your own words. Do NOT quote or closely paraphrase dialogue, script text, prose passages, poetry, or song lyrics from the work or from any source you find. Not one line.',
    '- Do NOT return a scene-by-scene plot summary. The premise is the situation and its emotional pressure, not a retelling.',
    '- Report facts, not reviews. No critical opinion, no ratings, no marketing language.',
    '- If web search does not confirm the work exists, set identified to "unknown" and confidence to "low", and write the premise from whatever the user\u2019s wording most plausibly means rather than inventing a fake work.',
    '- Never fabricate names, dates or events to fill a gap. An honest gap is more useful here than a confident invention.',
  ].join('\n');
}

export function parseSourceResearch(text) {
  if (!text) return null;
  const clean = String(text).replace(/```json|```/g, '').trim();
  // A grounded response can arrive with citation prose wrapped around the
  // JSON even when the prompt forbids it (search-tool responses are chattier
  // than plain ones), so fall back to the first balanced-looking JSON object
  // rather than failing the whole pre-pass on a stray sentence.
  try { return JSON.parse(clean); } catch { /* fall through */ }
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try { return JSON.parse(clean.slice(start, end + 1)); } catch { return null; }
}

/* researchToSubject — collapses the researched object into the single block
 * of subject material the lyric call consumes. Kept separate from the parse
 * so the shape of what reaches the lyric prompt is testable without a
 * transport, and so the lyric engine keeps its existing single `subject`
 * contract instead of growing a parallel research-shaped input. */
export function researchToSubject(research, fallbackSubject) {
  if (!research || !research.premise) return String(fallbackSubject || '');
  const bits = [
    `${String(fallbackSubject || '').trim()}${research.identified && research.identified !== 'unknown' ? ` (researched as: ${research.identified})` : ''}`,
    String(research.premise).trim(),
  ];
  if (research.conflict)      bits.push(`Central conflict: ${String(research.conflict).trim()}`);
  if (research.emotionalCore) bits.push(`Emotional core: ${String(research.emotionalCore).trim()}`);
  if (research.setting)       bits.push(`Setting: ${String(research.setting).trim()}`);
  return bits.filter(Boolean).join('\n');
}

/* runSourceResearch — the driver. `transport` is the SAME injected
 * {prompt, model, temperature, maxTokens, grounded} -> string function
 * runLyricEngine() takes, so both steps of the flow go through one provider
 * abstraction and a test can fake either independently.
 *
 * FAILS SOFT ON PURPOSE. A dead search tool, a provider that ignores the
 * grounded flag, or unparseable output must not take the whole lyric
 * generation down with it — the pipeline degrades to the pre-2026-08-17
 * behaviour (bare subject line, model works from its own knowledge) and
 * reports why via `error`. Temperature 0: this step is retrieval, not
 * creativity. */
export async function runSourceResearch({ sourceType, subject, transport, model, maxTokens }) {
  if (!needsSourceResearch(sourceType, subject)) {
    return { researched: false, reason: 'not-a-researchable-source', subject: String(subject || ''), research: null };
  }
  if (typeof transport !== 'function') throw new Error('runSourceResearch needs a transport(prompt)->text function.');

  const prompt = buildSourceResearchPrompt({ sourceType, subject });
  let raw;
  try {
    raw = await transport({ prompt, model, temperature: 0, maxTokens: Number(maxTokens) || 1200, grounded: true });
  } catch (e) {
    return { researched: false, reason: 'transport-failed', error: e.message, subject: String(subject || ''), research: null };
  }
  const research = parseSourceResearch(raw);
  if (!research || !research.premise) {
    return { researched: false, reason: 'unparseable-response', subject: String(subject || ''), research: null };
  }
  return {
    researched: true,
    reason: null,
    subject: researchToSubject(research, subject),
    research,
    confidence: research.confidence || null,
  };
}

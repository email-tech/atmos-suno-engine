import { STYLE_ENGINES } from "./data-style-engines.js";
import { compatibilitySummary } from "./compatibility-rules.js";
import { buildAdLibPlan, buildSunoMetatagPlan, buildVocalArrangementPlan, formatAdLibPlan, formatMetatagPlan, formatVocalArrangementPlan } from "./metatag-builder.js";

export function buildGenerationPrompt(state, template) {
  const engine = STYLE_ENGINES[state.engine];
  const manualBrief = state.advanced.manualThemeBrief.trim();
  return [
    "You are writing Suno-compatible lyrics for a local music prompt tool.",
    "Return valid JSON only. Do not wrap in markdown fences. Do not include explanations outside JSON.",
    schema(),
    contextBlock(state, template, engine),
    manualBrief ? `Manual theme brief overrides automatic brief generation:\n${manualBrief}` : "Create the theme brief internally before writing lyrics.",
    conceptRules(),
    metatagRules(template, state),
    "Final lyrics rules:",
    "- Lyrics must be mainly English unless language mode requests a larger foreign-language section.",
    "- Do not include English translations, pronunciation guides, or explanations in final lyrics.",
    "- Use Suno section labels exactly, such as [Verse 1], [Chorus], [Bridge].",
    "- Put useful Suno metatags directly inside the lyrics string, not only in the lyricMetaTags field.",
    "- Make the chorus memorable, singable, and clear.",
    "- Respect clean language, cliche avoidance, structure, mood, energy, and line length settings.",
    validationBlock(state)
  ].join("\n\n");
}

export function buildRepairPrompt(state, template, initialResult) {
  return [
    "You generated lyrics that failed validation.",
    `Validation score: ${initialResult.validation.score}`,
    "Issues:",
    JSON.stringify(initialResult.validation.issues, null, 2),
    "Rewrite the lyrics only where needed. Preserve the selected style engine, structure template, song concept, language settings, and Suno section labels. Improve the score to 80 or above.",
    "Return the same JSON schema only.",
    schema(),
    contextBlock(state, template, STYLE_ENGINES[state.engine]),
    metatagRules(template, state),
    "Initial lyrics:",
    initialResult.lyrics,
    "Initial validation:",
    JSON.stringify(initialResult.validation, null, 2)
  ].join("\n\n");
}

function schema() {
  return `Required JSON schema:
{
  "title": "A concise song title derived from the subject/topic.",
  "themeBrief": "1-2 paragraph internal creative brief.",
  "lyrics": "[Intro]\\n...\\n[Outro]",
  "lyricMetaTags": "Short explanation-free list or integrated metatag strategy.",
  "validation": {
    "score": 88,
    "passed": true,
    "summary": "Brief validation summary.",
    "issues": [{"category": "Hook clarity", "severity": "minor", "note": "..."}],
    "fixesApplied": []
  }
}`;
}

function contextBlock(state, template, engine) {
  const styleContext = state.integration.useStyleToGuideLyrics
    ? `Style prompt: ${state.outputs.stylePrompt}\nEngine metatag vocabulary: ${engine.metatags.join(", ")}`
    : "Style-to-lyric guidance is off. Use only lyric controls.";
  return `App state:
Engine: ${state.engine}
${styleContext}
Negative style prompt: ${state.outputs.negativePrompt}
Optional title seed: ${state.song.title || "none - Claude must create a suitable title from the subject/topic"}
Source type: ${state.song.sourceType}
Theme lens: ${state.song.themeLens}
Subject/topic: ${state.song.subject}
Source notes: ${state.song.sourceNotes || "none"}
Genre family: ${state.song.genreFamily}
Era bias: ${state.song.eraBias}
Mood: ${state.song.mood}
Energy: ${state.song.energy}
Perspective: ${state.song.perspective}
Language style: ${state.song.languageStyle}
Imagery density: ${state.song.imageryDensity}
Narrative clarity: ${state.song.narrativeClarity}
Hook style: ${state.song.hookStyle}
Rhyme density: ${state.song.rhymeDensity}
Target line length: ${state.song.lineLength}
Vocal framing: ${state.song.vocalFraming}
Delivery style: ${state.song.deliveryStyle}
Negative lyric rules: ${state.song.negativeRules}
Clean language: ${state.song.cleanLanguage}
Avoid cliches: ${state.song.avoidCliche}
Use title in chorus: ${state.song.titleInChorus}
Repeat key hook wording: ${state.song.repeatHook}
Structure template: ${template.label}
Required sections: ${template.sections.map((section) => `[${section}]`).join(", ")}
Include pre-chorus where useful: ${state.structure.includePreChorus}
Include bridge where useful: ${state.structure.includeBridge}
Language layer enabled: ${state.languageLayer.enabled}
Language: ${state.languageLayer.language}
Language mode: ${state.languageLayer.mode}
Language placement: ${state.languageLayer.placement}
Language intensity: ${state.languageLayer.intensity}
Language notes: ${state.languageLayer.notes || "none"}

Selected control guidance:
${selectedGuidance(state)}

Compatibility guidance:
${compatibilitySummary(state)}`;
}

function conceptRules() {
  return `Concept hierarchy:
- Derive the main song concept from Subject/topic, not from Song title.
- Create a suitable song title from the subject/topic and return it in the JSON title field. Use the optional title seed only if it genuinely fits.
- If title-in-chorus is enabled, use the generated title or its strongest phrase naturally in the chorus.
- Source type must change the emotional evidence, imagery, and narrative frame used in the theme brief.
- Theme lens must change the angle of interpretation, not just the wording.
- Mood must be interpreted in context of the subject/topic; do not treat it as a single-word adjective.
- Energy must affect lyric density, section momentum, hook force, and how quickly the emotional point arrives.
- Perspective must control who is speaking in every section.
- The themeBrief must explicitly show how source type, theme lens, mood, energy, and perspective shaped the subject/topic.`;
}

function metatagRules(template, state) {
  const plan = buildSunoMetatagPlan(state, template);
  const adLibPlan = buildAdLibPlan(state, template);
  const vocalPlan = buildVocalArrangementPlan(state, template);
  return `Suno lyric structure and metatag requirements:
- The lyrics string must include these section labels in this order: ${template.sections.map((section) => `[${section}]`).join(" ")}.
- Add 3 to 5 Suno metatags directly inside the lyrics string as local timeline instructions.
- Keep required section labels exact and uncluttered, then place short standalone metatags immediately after the section label or just before the event they affect.
- Treat the style prompt as the global sound world. Treat lyric metatags as local musical direction: entrance, contrast, handoff, lift, release, echo.
- Use metatags as tasteful bracketed performance and arrangement cues, not copied UI labels and not poetic scenery.
- Good metatags describe functional musical events: [drums withheld | distant motif enters], [close soft vocal | rhythm stays sparse], [guitar answers vocal | drums stay low], [choir swells | ceremonial lift], [wide harmony halo | soft hook bloom], [last hook dissolves | long reverb tail].
- Do not use vague scenic labels such as [Golden-hour final chorus], [Oceanic instrumental break], or [Atmospheric outro] unless they also contain a concrete musical action.
- Prefer this generated metatag plan because it is derived from the selected style prompt instruments and structure:
${formatMetatagPlan(plan)}
- Supporting vocal arrangement rules:
- Preserve lead clarity first. Do not put choir, stacked vocals, or parenthetical backing phrases on every line.
- Stage backing vocals like an arrangement: verse restraint, chorus support, bridge contrast, final hook lift, outro memory.
- Use unison doubles for emphasis, female harmonies for lift and shimmer, choir/group vocals for scale, and open vowels for atmosphere.
- When using parentheses, write only words or vowels that should actually be sung. Never put instructions in parentheses.
- Generated supporting vocal plan:
${formatVocalArrangementPlan(vocalPlan)}
- Do not create generic [Ad-lib] or [Ad-libs] tags. Ad-libs are written vocal events inside the lyric body, usually in parentheses or as backing-vocal lines.
- Use ad-libs sparingly. They must answer, echo, extend, or fade an existing hook idea. Do not sprinkle random "oh", "yeah", or unrelated phrases through the song.
- Optional ad-lib / backing phrase plan:
${formatAdLibPlan(adLibPlan)}`;
}

function validationBlock(state) {
  return `Validation:
Standard validation passes at 80+.
Assess subject/topic concept fidelity, source type interpretation, theme lens, perspective consistency, energy match, structure compliance, section labels, integrated Suno metatags, chorus memorability, hook clarity, singability, line length, rhyme naturalness, cliche avoidance, language consistency, foreign phrase restraint, style engine match, clean language, title usage, and absence of explanatory text.
Strict validation: ${state.integration.strictValidation}. If strict, critique more aggressively for weak chorus, generic AI phrases, overused metaphors, poor section flow, unsuitable lyrical density, awkward scansion, repetition problems, and poor Suno fit.`;
}

function selectedGuidance(state) {
  return [
    `Source type guidance: ${guidance.sourceType[state.song.sourceType] || "Treat the subject as the primary creative seed and choose concrete emotional evidence."}`,
    `Theme lens guidance: ${guidance.themeLens[state.song.themeLens] || "Use the selected lens to define the angle of interpretation."}`,
    `Mood guidance: ${guidance.mood[state.song.mood] || "Interpret the mood through the specific subject rather than naming it directly."}`,
    `Energy guidance: ${guidance.energy[state.song.energy] || "Let the energy setting control pacing, repetition, lyric density, and chorus force."}`,
    `Perspective guidance: ${guidance.perspective[state.song.perspective] || "Keep the chosen speaker consistent across the lyric."}`
  ].join("\n");
}

const guidance = {
  sourceType: {
    "Movie": "Use cinematic scene logic: visible moments, emotional turns, and implied action. Avoid summarising the plot; write from the emotional pressure inside it.",
    "Book": "Use literary interiority: memory, motive, contradiction, and symbolic objects. Let the lyric feel read-between-the-lines rather than plot-summary.",
    "Historical figure": "Use human stakes behind public identity: cost, legacy, private doubt, devotion, sacrifice, or myth versus person.",
    "Myth / legend": "Use archetypal imagery and fate-scale emotion, but keep the words singable and personal rather than encyclopaedic.",
    "True event": "Use grounded realism and consequence. Avoid sensationalising; focus on the human aftermath, choice, loss, survival, or witness.",
    "Cultural movement": "Use collective feeling, shared language, generational tension, resistance, belonging, or change. The song can speak as an individual within a wider current.",
    "Original concept": "Build an invented emotional world from the subject. Choose concrete images that make the concept feel lived-in.",
    "Personal memory": "Use intimate sensory evidence, small details, and emotional specificity. The lyric should feel remembered rather than explained."
  },
  themeLens: {
    "Faithful to source": "Stay close to the subject's literal emotional situation. Preserve its core conflict, setting, and stakes.",
    "Inspired by source": "Use the subject as a springboard. Keep the central feeling but allow new scenes, images, and emotional framing.",
    "Loose metaphor only": "Transform the subject into metaphor. Avoid literal references; turn the topic into weather, distance, ritual, ocean, city, light, or body imagery.",
    "Dark reinterpretation": "Tilt the subject toward shadow, cost, obsession, grief, danger, or unresolved longing without becoming melodramatic.",
    "Romantic reinterpretation": "Tilt the subject toward desire, devotion, tenderness, distance, reunion, or intimate vulnerability.",
    "Triumphant reinterpretation": "Tilt the subject toward survival, release, courage, arrival, and earned uplift rather than simple positivity."
  },
  mood: {
    "Melancholic": "Let sadness have beauty and restraint. In context, focus on absence, memory, tenderness, and what cannot be fully recovered.",
    "Hopeful": "Make hope specific and earned: a small sign of return, a decision to keep moving, light after uncertainty, or trust forming despite the subject's tension.",
    "Defiant": "Turn the subject into refusal, resilience, boundary-setting, or standing upright under pressure. Keep it controlled rather than shouted.",
    "Romantic": "Find intimacy inside the subject: closeness, longing, devotion, touch, distance, or the private language between people.",
    "Mysterious": "Withhold some explanation. Use partial images, questions, symbols, and atmosphere so the subject feels alluring but coherent.",
    "Bittersweet": "Hold gain and loss together. Let the subject create both gratitude and ache in the same lines.",
    "Triumphant": "Make victory earned by struggle. Build toward release, arrival, recognition, or emotional breakthrough.",
    "Dark / brooding": "Use tension, shadow, doubt, obsession, or threat. Keep the lyric elegant and atmospheric, not cartoon-dark.",
    "Serene": "Turn the subject toward acceptance, stillness, breath, space, and gentle clarity.",
    "Yearning": "Let the subject create reach: distance, waiting, unfinished words, desire, or something almost touched.",
    "Mystical": "Frame the subject as ritual, omen, prayer, dream, or hidden pattern while keeping the emotional meaning clear.",
    "Sensual": "Use body, warmth, breath, movement, and texture with restraint. Keep it suggestive rather than explicit.",
    "Haunted": "Let the subject return like an echo: memory, trace, ghosted rooms, unresolved promises, or repeating signs.",
    "Euphoric but restrained": "Create lift without excess: controlled release, glowing repetition, upward motion, and emotional brightness held in check."
  },
  energy: {
    "Low": "Use spacious lines, few words, slow emotional reveal, soft repetition, and minimal dramatic turns.",
    "Low-mid": "Keep the lyric intimate but moving. Use gentle section growth and a chorus that blooms rather than explodes.",
    "Mid": "Use balanced momentum: clear verses, memorable chorus, moderate repetition, and enough detail to carry the subject.",
    "High": "Use direct emotional statements, strong rhythmic phrasing, repeated hook language, and fast-arriving payoff while avoiding clutter.",
    "Medium-high": "Create drive and lift with concise images, faster section movement, and a chorus that feels like release.",
    "Slow burn": "Delay the full emotional reveal. Start restrained, add pressure verse by verse, and let the chorus or final chorus make the subject's meaning clear."
  },
  perspective: {
    "First person": "Write from inside the speaker's experience using I/me/we only where natural. The subject becomes confession or testimony.",
    "Second person": "Address a you directly. The subject becomes confrontation, devotion, invitation, apology, or memory aimed at someone.",
    "Third person": "Observe the subject through he/she/they or named figures. Keep emotional closeness through concrete detail.",
    "Alternating first and second": "Use verses for inner confession and chorus for direct address, or alternate sections deliberately.",
    "Omniscient / cinematic": "Use a camera-like voice that can move between scene, symbol, and emotional overview without sounding detached.",
    "Collective voice": "Use we/us to make the subject communal, generational, ritual, or movement-based.",
    "Fragmented voices": "Use short perspective shifts, echo phrases, or call-and-response fragments while keeping the chorus stable."
  }
};

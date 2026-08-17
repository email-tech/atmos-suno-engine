export const CONTROL_OPTIONS = {
  // 'TV series' added 2026-08-17 (John). The other eight are the proven set
  // ported verbatim from archive/js/data-lyric-controls.js. Order matters to
  // the UI only; core/source-research.js decides which of these trigger the
  // grounded research pre-pass (everything except Original concept and
  // Personal memory).
  sourceType: ["Movie", "TV series", "Book", "Historical figure", "Myth / legend", "True event", "Cultural movement", "Original concept", "Personal memory"],
  themeLens: ["Faithful to source", "Inspired by source", "Loose metaphor only", "Dark reinterpretation", "Romantic reinterpretation", "Triumphant reinterpretation"],
  genreFamily: ["Synthpop", "Pop", "Dance-pop", "Rock", "Ballad", "R&B", "Soul", "Reggae", "Chillout / Balearic", "Cinematic / Score-pop", "Balearic chillout", "Downtempo pop", "Ethereal trance", "Trip-hop", "Ambient vocal", "Mystic electronic", "Cinematic pop"],
  eraBias: ["1980s", "1990s", "2000s", "2010s", "2020s", "Timeless / mixed-era", "Modern Suno polish", "Early 90s", "Late 90s", "Early 2000s", "Timeless"],
  mood: ["Melancholic", "Hopeful", "Defiant", "Romantic", "Mysterious", "Bittersweet", "Triumphant", "Dark / brooding", "Serene", "Yearning", "Mystical", "Sensual", "Haunted", "Euphoric but restrained"],
  energy: ["Low", "Low-mid", "Mid", "Medium-high", "High", "Slow burn"],
  perspective: ["First person", "Second person", "Third person", "Alternating first and second", "Omniscient / cinematic", "Collective voice", "Fragmented voices"],
  languageStyle: ["Conversational", "Poetic", "Cinematic", "Elegant / literary", "Simple / direct", "Plain poetic", "Mystic but clear", "Minimal", "Sensual and restrained", "Sacred-modern", "Dreamlike"],
  structureCategory: ["Commercial / Pop-Compatible", "Balearic / Chillout / Atmospheric", "Enigma / Ritual / Chant", "Delerium / Ethereal Vocal", "Experimental"],
  hookStyle: ["Immediate and memorable", "Subtle and emotional", "Anthemic", "Intimate", "Mantra-like repetition", "Short repeated phrase", "Question hook", "Title hook", "Mantra hook", "Call-and-response", "Melodic vowel hook"],
  lineLength: ["Flexible", "6-8 syllables", "8-10 syllables", "10-12 syllables", "Mixed by section", "Short", "Medium", "Long", "Mixed with singable anchors"],
  rhymeDensity: ["Light", "Moderate", "Heavy", "Mixed / natural", "Minimal, prioritise meaning", "Medium", "High but natural", "Internal rhyme"],
  imageryDensity: ["Low", "Moderate", "High", "Sparse", "Medium", "Rich", "Symbolic"],
  narrativeClarity: ["Very clear storyline", "Mostly clear with some poetry", "Balanced", "Abstract but coherent", "Abstract", "Clear story", "Emotional fragments"],
  vocalFraming: ["Male lead", "Female lead", "Gender-neutral", "Duet", "Lead vocal centered", "Airy lead with backing phrases", "Whispered layers", "Choir shadows", "Call-and-response"],
  deliveryStyle: ["Controlled and intimate", "Warm and emotional", "Cool and detached", "Confessional", "Dramatic but restrained", "Soft intimate", "Breathy", "Chanted", "Ethereal", "Pop direct"],
  languages: ["French", "Spanish", "Latin", "Arabic", "Turkish", "German", "Gaelic"],
  languageModes: ["None", "Foreign phrase layer", "Chorus line", "Full chorus", "Verse section", "Call-and-response", "Sacred / chant layer"],
  languagePlacement: ["Chorus or backing phrase", "Intro texture", "Bridge only", "Outro echo", "Call response after hook"],
  languageIntensity: ["Light", "Medium", "Prominent"]
};

/* Section labels below are restricted to docs/knowledge/suno-metatag-
 * vocabulary.md's confirmed set — see that file for sourcing and for why
 * several templates below now share an identical section sequence (they
 * were only ever differentiated by invented names, not real structure).
 * validate-metatag-vocabulary.mjs enforces this against every template. */
export const STRUCTURE_TEMPLATES = [
  ["Commercial / Pop-Compatible", "commercial-classic-pre-chorus", "Verse / Pre-Chorus / Chorus / Verse / Pre-Chorus / Chorus / Bridge / Final Chorus", ["Verse 1", "Pre-Chorus", "Chorus", "Verse 2", "Pre-Chorus", "Chorus", "Bridge", "Final Chorus"], ["Pop", "Synthpop", "Dance-pop"], "Strong commercial structure with clear hook return."],
  ["Commercial / Pop-Compatible", "commercial-intro-middle8", "Intro / Verse / Pre-Chorus / Chorus / Verse / Pre-Chorus / Chorus / Bridge / Final Chorus / Outro", ["Intro", "Verse 1", "Pre-Chorus", "Chorus", "Verse 2", "Pre-Chorus", "Chorus", "Bridge", "Final Chorus", "Outro"], ["Pop", "Cinematic pop"], "Radio-ready flow with an extra release valve before the final chorus."],
  ["Commercial / Pop-Compatible", "commercial-bridge", "Verse / Chorus / Verse / Chorus / Bridge / Final Chorus", ["Verse 1", "Chorus", "Verse 2", "Chorus", "Bridge", "Final Chorus"], ["Pop", "Downtempo"], "Compact hook-first structure."],
  ["Commercial / Pop-Compatible", "commercial-double-verse", "Verse / Verse / Chorus / Verse / Chorus / Bridge / Chorus", ["Verse 1", "Verse 2", "Chorus", "Verse 3", "Chorus", "Bridge", "Chorus"], ["Story songs"], "More narrative runway before the hook."],
  ["Commercial / Pop-Compatible", "commercial-refrain", "Verse / Chorus / Verse / Chorus / Bridge / Final Chorus", ["Verse 1", "Chorus", "Verse 2", "Chorus", "Bridge", "Final Chorus"], ["Folk-pop", "Ambient vocal"], "Soft, low-pressure return to the hook."],
  ["Commercial / Pop-Compatible", "commercial-post-chorus", "Intro / Verse / Chorus / Verse / Chorus / Bridge / Final Chorus / Outro", ["Intro", "Verse 1", "Chorus", "Verse 2", "Chorus", "Bridge", "Final Chorus", "Outro"], ["Pop", "Dance-pop"], "Standard full-length pop flow."],
  ["Commercial / Pop-Compatible", "commercial-lift", "Verse / Pre-Chorus / Chorus / Verse / Pre-Chorus / Chorus / Breakdown / Final Chorus", ["Verse 1", "Pre-Chorus", "Chorus", "Verse 2", "Pre-Chorus", "Chorus", "Breakdown", "Final Chorus"], ["Electronic pop"], "A stripped-back breakdown in place of a conventional pre-chorus."],
  ["Balearic / Chillout / Atmospheric", "balearic-drift", "Intro / Verse / Chorus / Instrumental Break / Verse / Chorus / Outro", ["Intro", "Verse 1", "Chorus", "Instrumental Break", "Verse 2", "Chorus", "Outro"], ["Balearic", "Chillout"], "Leaves space for instrumental atmosphere."],
  ["Balearic / Chillout / Atmospheric", "balearic-floating-hook", "Verse / Chorus / Verse / Chorus / Bridge / Final Chorus", ["Verse 1", "Chorus", "Verse 2", "Chorus", "Bridge", "Final Chorus"], ["Chillout"], "Gentle hook repetition without pop pressure."],
  ["Balearic / Chillout / Atmospheric", "balearic-spoken", "Intro / Verse / Chorus / Breakdown / Verse / Final Chorus / Outro", ["Intro", "Verse 1", "Chorus", "Breakdown", "Verse 2", "Final Chorus", "Outro"], ["Atmospheric"], "A cinematic drop to near-silence mid-song."],
  ["Balearic / Chillout / Atmospheric", "balearic-instrumental", "Intro / Verse / Chorus / Instrumental Break / Verse / Final Chorus", ["Intro", "Verse 1", "Chorus", "Instrumental Break", "Verse 2", "Final Chorus"], ["Balearic"], "Good for style-led tracks."],
  ["Balearic / Chillout / Atmospheric", "balearic-sunrise", "Intro / Verse / Chorus / Instrumental Break / Verse / Final Chorus / Outro", ["Intro", "Verse 1", "Chorus", "Instrumental Break", "Verse 2", "Final Chorus", "Outro"], ["Chillout"], "Slow open, soft payoff, long tail."],
  ["Enigma / Ritual / Chant", "enigma-invocation", "Intro / Verse / Pre-Chorus / Chorus / Breakdown / Final Chorus / Outro", ["Intro", "Verse 1", "Pre-Chorus", "Chorus", "Breakdown", "Final Chorus", "Outro"], ["Mystic electronic"], "Balances a stripped-back break with song form."],
  ["Enigma / Ritual / Chant", "enigma-chant-intro", "Intro / Verse / Chorus / Instrumental Break / Verse / Final Chorus", ["Intro", "Verse 1", "Chorus", "Instrumental Break", "Verse 2", "Final Chorus"], ["Enigma"], "Direct, song-forward framing."],
  ["Enigma / Ritual / Chant", "enigma-whisper", "Intro / Verse / Chorus / Bridge / Final Chorus / Outro", ["Intro", "Verse 1", "Chorus", "Bridge", "Final Chorus", "Outro"], ["Ritual"], "Understated verse into a single contrasting bridge."],
  ["Enigma / Ritual / Chant", "enigma-pulse", "Intro / Verse / Chorus / Instrumental Break / Verse / Final Chorus", ["Intro", "Verse 1", "Chorus", "Instrumental Break", "Verse 2", "Final Chorus"], ["Downtempo ritual"], "Pulse-forward without clutter."],
  ["Enigma / Ritual / Chant", "enigma-sacred", "Intro / Verse / Chorus / Bridge / Final Chorus", ["Intro", "Verse 1", "Chorus", "Bridge", "Final Chorus"], ["Sacred-modern"], "Short form, one contrasting bridge."],
  ["Delerium / Ethereal Vocal", "delerium-halo", "Intro / Verse / Pre-Chorus / Chorus / Breakdown / Verse / Final Chorus / Outro", ["Intro", "Verse 1", "Pre-Chorus", "Chorus", "Breakdown", "Verse 2", "Final Chorus", "Outro"], ["Ethereal vocal"], "Classic emotional lift with a spacious break."],
  ["Delerium / Ethereal Vocal", "delerium-floating", "Intro / Verse / Chorus / Bridge / Final Chorus", ["Intro", "Verse 1", "Chorus", "Bridge", "Final Chorus"], ["Ethereal pop"], "Simple and vocal-centered."],
  ["Delerium / Ethereal Vocal", "delerium-underwater", "Intro / Verse / Pre-Chorus / Chorus / Breakdown / Final Chorus", ["Intro", "Verse 1", "Pre-Chorus", "Chorus", "Breakdown", "Final Chorus"], ["Ambient trance"], "Good for immersive low-light tracks."],
  ["Delerium / Ethereal Vocal", "delerium-aria", "Intro / Verse / Chorus / Bridge / Final Chorus / Outro", ["Intro", "Verse 1", "Chorus", "Bridge", "Final Chorus", "Outro"], ["Cinematic"], "Lets the bridge carry the emotional weight, long tail out."],
  ["Delerium / Ethereal Vocal", "delerium-breath", "Intro / Verse / Chorus / Bridge / Final Chorus", ["Intro", "Verse 1", "Chorus", "Bridge", "Final Chorus"], ["Minimal"], "Restrained form for fragile vocals."],
  ["Experimental", "experimental-fragment", "Intro / Verse / Verse / Chorus / Breakdown / Outro", ["Intro", "Verse 1", "Verse 2", "Chorus", "Breakdown", "Outro"], ["Experimental"], "Sparse, cinematic flow."],
  ["Experimental", "experimental-response", "Intro / Verse / Chorus / Instrumental Break / Final Chorus", ["Intro", "Verse 1", "Chorus", "Instrumental Break", "Final Chorus"], ["Hybrid"], "Useful for a spoken-to-sung contrast within the verse/chorus delivery itself."],
  ["Experimental", "experimental-drone", "Verse / Breakdown / Verse / Chorus / Outro", ["Verse 1", "Breakdown", "Verse 2", "Chorus", "Outro"], ["Minimal"], "Sparse and hypnotic."],
  ["Experimental", "experimental-mantra", "Verse / Chorus / Breakdown / Final Chorus", ["Verse 1", "Chorus", "Breakdown", "Final Chorus"], ["Mantra"], "Built around repetition and tone."],
  ["Experimental", "experimental-dissolve", "Intro / Verse / Chorus / Breakdown / Final Chorus", ["Intro", "Verse 1", "Chorus", "Breakdown", "Final Chorus"], ["Cinematic"], "Loose structure with a returning hook."]
].map(([group, id, label, sections, bestFor, notes]) => ({ group, id, label, sections, bestFor, notes }));

/* -------------------------------------------------------------------------
 * Ported verbatim from the proven archive/js/data-lyric-controls.js into core/
 * as the DNA-era home for lyric control vocabulary + structure templates.
 * Proven language John validated empirically — reused, not rebuilt.
 * ---------------------------------------------------------------------- */

// Structure category → subgenre affinity, used to pick a default template from DNA.
export const TEMPLATE_FOR_SUBGENRE = Object.freeze({
  'ambient-beatless-atmospheric': 'balearic-instrumental',
  'organic-warm-downtempo':       'balearic-drift',
  'sunlit-mediterranean':         'balearic-sunrise',
  'lush-cinematic-chillout':      'delerium-halo',
  'dreamy-analog-electronic':     'balearic-floating-hook',
  'dub-space-downtempo':          'balearic-spoken',
  'deep-nocturnal-balearic':      'delerium-underwater',
  'moody-trip-hop-downbeat':      'balearic-spoken',
  'balearic-house':               'commercial-post-chorus',
  'nu-disco-slo-mo':              'commercial-lift',
  'melodic-deep-house':           'commercial-post-chorus',
  'lounge-house':                 'balearic-floating-hook',
});

export function templateById(id) {
  return STRUCTURE_TEMPLATES.find(t => t.id === id) || null;
}

/* =========================================================================
 * CONTROL GUIDANCE (2026-08-17) — the lyric-brief control panel build.
 *
 * The open question logged on 2026-08-13 was whether the Tier 1 controls
 * should ship with full guidance text or bare labels first. Full text, for a
 * reason that is not a preference: this vocabulary is PROVEN. It is ported
 * from archive/js/prompt-lyric-builder.js's `guidance` object, which is the
 * lyric engine John validated empirically before the DNA rewrite. A bare
 * enum hands the LLM a word like "Cinematic" with no shared definition and
 * lets it guess; the guidance string is the definition that produced good
 * output. Reused, not rebuilt — same rule as STRUCTURE_TEMPLATES above.
 *
 * WHAT IS DELIBERATELY *NOT* HERE. Two entries in CONTROL_OPTIONS are dead
 * weight in the DNA-era app and are NOT exposed as user controls (the other
 * half of the 2026-08-13 open question):
 *   - genreFamily: genre is owned by the style engine and arrives via
 *     DNA.identity.genreAnchor. Exposing a second genre control would put
 *     the same field in two places, violating the one-source-of-truth rule,
 *     and would let a user pick "Rock" against a Balearic arrangement.
 *   - structureCategory: superseded by the structure-first pipeline. Song
 *     type -> structure preset is decision #1 and #2 (core/structure.js);
 *     re-asking for a structure category downstream can only contradict it.
 * Both stay in CONTROL_OPTIONS as vocabulary (STRUCTURE_TEMPLATES still
 * groups by structureCategory internally) — they are simply never rendered.
 *
 * mood/energy guidance from the old file is also absent by design: both are
 * DERIVED in core/lyric.js (mood from CIL affect, energy from tempo), not
 * chosen by the user, so there is no control to attach guidance to.
 * ====================================================================== */

export const SOURCE_TYPE_GUIDANCE = Object.freeze({
  "Movie": "Use cinematic scene logic: visible moments, emotional turns, and implied action. Avoid summarising the plot; write from the emotional pressure inside it.",
  "TV series": "Use the recurring emotional situation rather than one episode's events: what repeats, what never resolves, and what the characters keep returning to. Avoid recapping storylines.",
  "Book": "Use literary interiority: memory, motive, contradiction, and symbolic objects. Let the lyric feel read-between-the-lines rather than plot-summary.",
  "Historical figure": "Use human stakes behind public identity: cost, legacy, private doubt, devotion, sacrifice, or myth versus person.",
  "Myth / legend": "Use archetypal imagery and fate-scale emotion, but keep the words singable and personal rather than encyclopaedic.",
  "True event": "Use grounded realism and consequence. Avoid sensationalising; focus on the human aftermath, choice, loss, survival, or witness.",
  "Cultural movement": "Use collective feeling, shared language, generational tension, resistance, belonging, or change. The song can speak as an individual within a wider current.",
  "Original concept": "Build an invented emotional world from the subject. Choose concrete images that make the concept feel lived-in.",
  "Personal memory": "Use intimate sensory evidence, small details, and emotional specificity. The lyric should feel remembered rather than explained.",
});

export const THEME_LENS_GUIDANCE = Object.freeze({
  "Faithful to source": "Stay close to the subject's literal emotional situation. Preserve its core conflict, setting, and stakes.",
  "Inspired by source": "Use the subject as a springboard. Keep the central feeling but allow new scenes, images, and emotional framing.",
  "Loose metaphor only": "Transform the subject into metaphor. Avoid literal references; turn the topic into weather, distance, ritual, ocean, city, light, or body imagery.",
  "Dark reinterpretation": "Tilt the subject toward shadow, cost, obsession, grief, danger, or unresolved longing without becoming melodramatic.",
  "Romantic reinterpretation": "Tilt the subject toward desire, devotion, tenderness, distance, reunion, or intimate vulnerability.",
  "Triumphant reinterpretation": "Tilt the subject toward survival, release, courage, arrival, and earned uplift rather than simple positivity.",
});

export const PERSPECTIVE_GUIDANCE = Object.freeze({
  "First person": "One speaker throughout, saying 'I'. Keep the same voice in every section.",
  "Second person": "Address someone directly as 'you' throughout. The speaker stays implied rather than described.",
  "Third person": "Observe the subject from outside. No 'I' and no direct address.",
  "Alternating first and second": "Move between 'I' and 'you' deliberately \u2014 verses inward, chorus addressed outward, or the reverse. Never mix both inside one line.",
  "Omniscient / cinematic": "Narrate from above the scene, seeing more than any one character does. Describe rather than confess.",
  "Collective voice": "Speak as 'we'. The feeling belongs to a group, not an individual.",
  "Fragmented voices": "Let more than one speaker surface across sections without naming them. Keep each fragment internally consistent.",
});

/* HOOK / IMAGERY / NARRATIVE / VOCAL FRAMING — Tier 2. These four were named
 * in the 2026-08-13 spec as net-new (vocabulary present in CONTROL_OPTIONS,
 * no UI and no prompt-construction logic). Guidance written here for the
 * first time rather than ported: the old engine listed these options but
 * never defined them to the model either. Marked as such so a future session
 * does not mistake them for John-validated language. */
export const HOOK_STYLE_GUIDANCE = Object.freeze({
  "Immediate and memorable": "The hook lands on its first appearance. Short words, strong vowels, no setup required.",
  "Subtle and emotional": "The hook earns its weight by repetition and context rather than by being catchy on contact.",
  "Anthemic": "Built to be sung back by a room. Wide vowels, few syllables, a line that completes itself.",
  "Intimate": "The hook is said close and quiet, as if to one person. Restraint over reach.",
  "Mantra-like repetition": "One phrase repeated until it changes meaning. Minimal variation between repeats.",
  "Short repeated phrase": "A three-to-five word figure returning verbatim in every chorus.",
  "Question hook": "The hook asks something and does not answer it.",
  "Title hook": "The song title is the hook line and appears in the chorus intact.",
  "Mantra hook": "A chant-shaped hook built for repetition rather than narrative progress.",
  "Call-and-response": "The hook is answered \u2014 lead states, backing replies, in the same breath.",
  "Melodic vowel hook": "The hook rests on open sustained vowels more than on the words themselves.",
});

export const IMAGERY_DENSITY_GUIDANCE = Object.freeze({
  "Low": "One clear image per section. Let plain statement carry the rest.",
  "Sparse": "Very few images, each given room. Silence between them is part of the writing.",
  "Moderate": "An image roughly every other line, balanced against direct emotional statement.",
  "Medium": "An image roughly every other line, balanced against direct emotional statement.",
  "High": "Image-led throughout. Concrete nouns doing the emotional work rather than adjectives.",
  "Rich": "Dense sensory writing \u2014 layered images per section, but each must still be concrete and singable.",
  "Symbolic": "Recurring symbolic objects rather than descriptive scenery. The same few symbols return and accumulate meaning.",
});

export const NARRATIVE_CLARITY_GUIDANCE = Object.freeze({
  "Very clear storyline": "A listener should be able to retell what happened after one play. Events in order.",
  "Clear story": "A listener should be able to retell what happened after one play. Events in order.",
  "Mostly clear with some poetry": "The situation is legible; the language is allowed to be figurative around it.",
  "Balanced": "Enough narrative to orient the listener, enough ambiguity to reward a second listen.",
  "Abstract but coherent": "No literal plot, but a consistent emotional logic the listener can follow.",
  "Abstract": "Impression over event. Coherence comes from tone and repetition, not sequence.",
  "Emotional fragments": "Disconnected moments of feeling. No connective narrative tissue between them.",
});

export const VOCAL_FRAMING_GUIDANCE = Object.freeze({
  "Male lead": "Write for a single male lead voice.",
  "Female lead": "Write for a single female lead voice.",
  "Gender-neutral": "Avoid gendered self-reference and gendered address so either voice can carry it.",
  "Duet": "Two lead voices in dialogue. Make clear from the writing which lines belong to which.",
  "Lead vocal centered": "One voice carries everything; backing exists only to support the hook.",
  "Airy lead with backing phrases": "A light lead with short answering backing phrases behind the hook.",
  "Whispered layers": "A close, quiet lead with whispered doubles rather than sung harmony.",
  "Choir shadows": "A solo lead shadowed by a group voice at the section peaks only.",
  "Call-and-response": "Lead and answering voice trade phrases as the primary structural device.",
});

/* ERA BIAS — a lyric-language control only. It biases IDIOM AND REFERENCE
 * FRAME (what a lyric of that period sounds like), never production, tempo or
 * instrumentation, all of which belong to the style engine and DNA. Named
 * explicitly because 'Era bias' reads like a production control and a future
 * session could plausibly wire it to one. */
export const ERA_BIAS_GUIDANCE = Object.freeze({
  "1980s": "Direct, declarative lyric idiom. Big simple emotional statements, few qualifiers.",
  "1990s": "Plainer, more conversational phrasing with room for ambiguity and understatement.",
  "2000s": "Polished, hook-forward phrasing with clean emotional resolution.",
  "2010s": "Confessional and specific, with small concrete details standing in for large feelings.",
  "2020s": "Fragmented, close, and unguarded. Short lines, present tense.",
  "Early 90s": "Plain, slightly formal phrasing; emotion stated rather than performed.",
  "Late 90s": "Smooth and melodic phrasing, comfortable with abstraction in the chorus.",
  "Early 2000s": "Polished, hook-forward phrasing with clean emotional resolution.",
  "Timeless": "Avoid period-specific idiom, slang, and technology. Nothing that dates the lyric.",
  "Timeless / mixed-era": "Avoid period-specific idiom, slang, and technology. Nothing that dates the lyric.",
  "Modern Suno polish": "Contemporary, clean, singable phrasing with no dated idiom and no filler syllables.",
});

/* VOCAL DELIVERY — resolves the second 2026-08-13 open question: how the old
 * 'Delivery style' vocabulary relates to the already-wired
 * vocal.deliveryClass. They are NOT the same axis and must not be merged.
 *   vocal.deliveryClass (core/cil.js) = STRUCTURAL: is there a lexical lead
 *     vocal at all, or is the voice chant/wordless/choir? It decides whether
 *     conventional lyrics make sense, so it stays CIL-owned and inferred.
 *   deliveryStyle (below) = EXPRESSIVE: how the lead is performed. Only
 *     meaningful when deliveryClass is lead-melodic or spoken/chant.
 * The panel shows deliveryStyle; deliveryClass keeps coming from CIL, with a
 * manual override retained since it is already in the residue questions. */
export const DELIVERY_STYLE_GUIDANCE = Object.freeze({
  "Controlled and intimate": "Held back and close. Emotion implied through restraint, never pushed.",
  "Warm and emotional": "Open and expressive, but always singing rather than emoting over the line.",
  "Cool and detached": "Even, unhurried delivery. The words carry the feeling; the voice does not add to it.",
  "Confessional": "Written as if admitted rather than performed. Plain words, first person, no posture.",
  "Dramatic but restrained": "Weight and scale in the writing, control in the delivery. No belting.",
  "Soft intimate": "Very close and quiet. Short lines that fit inside one breath.",
  "Breathy": "Airy and unpressed. Favour open vowels and avoid consonant clusters.",
  "Chanted": "Rhythmic and repetitive rather than melodic. Short even phrases.",
  "Ethereal": "Floating and unanchored. Sustained vowels, sparse consonants, few hard stops.",
  "Pop direct": "Clear, forward, unambiguous. Every line lands on its meaning immediately.",
});

/* Foreign-language layer. Placement/mode/intensity vocabulary already exists
 * in CONTROL_OPTIONS; this is the instruction text that turns a selection
 * into something the model can act on. The layer is OFF by default and
 * renders nothing into the prompt when off — an always-present "language
 * layer: none" block is noise that measurably dilutes prompt attention. */
export const LANGUAGE_MODE_GUIDANCE = Object.freeze({
  "Foreign phrase layer": "Use a small number of short phrases in the chosen language as a texture behind or beside the English line. Never a full translated verse.",
  "Chorus line": "One line of the chorus is in the chosen language; the rest of the chorus stays English.",
  "Full chorus": "The entire chorus is in the chosen language. Verses stay English.",
  "Verse section": "One complete verse is in the chosen language. Chorus stays English.",
  "Call-and-response": "The chosen language answers the English lead as a short response phrase.",
  "Sacred / chant layer": "The chosen language appears only as a sustained chant or invocation layer, not as narrative lyric.",
});

export const CONTROL_OPTIONS = {
  sourceType: ["Movie", "Book", "Historical figure", "Myth / legend", "True event", "Cultural movement", "Original concept", "Personal memory"],
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

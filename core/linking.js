/* ==========================================================================
 * linking.js — INSTRUMENT-FAMILY LINKING LANGUAGE.
 *
 * SOURCE: docs/knowledge/instrument-family-linking-guide.md (John, 2026-07-23).
 * Every phrase below is taken from that guide. Section numbers are cited on each
 * block. NOTHING HERE IS INVENTED — that is the entire point of the file.
 *
 * WHY: round 4 was lost partly because interaction language was written from
 * scratch while a tested library already existed. John: "I don't feel you're
 * using the information at all. You are trying to predict a logical set of
 * outcomes... instead of grounding your actions in evidence."
 *
 * DELIBERATE EXCLUSIONS FROM THE GUIDE — the guide is written for pure
 * ORCHESTRAL prompts; this app puts orchestral modifiers over non-orchestral
 * engines, so some of its material cannot be imported as-is:
 *   - Anything containing fanfare / stabs / ostinato is dropped. Banned by
 *     core/knowledge.js on John's round-4 ruling. That removes several §4, §5,
 *     §9, §10 phrases and guide Patterns B and D.
 *   - §10 (Brass + Percussion) is dropped entirely: "massive brass chords",
 *     "at full force", "powerful percussion hits" are dominance language, banned
 *     by the Phase B signature contract, and maximum-impact tutti writing is the
 *     opposite of what a groove-led engine needs.
 *   - §14 prompt patterns are NOT imported. They build complete orchestral
 *     prompts ("orchestral, rich strings, ... instrumental only"); our genre
 *     anchor must stay the engine's, never "orchestral".
 *
 * KNOWN GAP, STATED RATHER THAN FILLED: the guide covers strings, woodwinds,
 * brass, percussion, harp and piano. It does NOT cover synthesisers, drum
 * machines, electric bass or electric guitar, so the ELECTRONIC side of the
 * character layer is still ungrounded. Do not invent equivalents — that is the
 * failure this file exists to stop. Ask John for an electronic linking guide.
 * ========================================================================*/

/* ---- §1 Instrument families and core roles -------------------------------- */
export const FAMILY_ROLES = {
  strings:    { type: 'sustained', role: 'melodic and harmonic backbone',
                typical: 'sweeping melodies, rich harmonic support, background motion' },
  woodwinds:  { type: 'sustained', role: 'distinct colours, agile, blends with strings',
                typical: 'solos, countermelodies, colour accents, upper harmony' },
  brass:      { type: 'sustained', role: 'power, grandeur, strong foreground',
                typical: 'climaxes, broad harmonic statements' },
  percussion: { type: 'percussive', role: 'rhythmic drive, accents, dynamic reinforcement',
                typical: 'rhythmic foundation, punctuations, colour' },
  harp:       { type: 'plucked',   role: 'resonant plucked arpeggios, coloristic harmony',
                typical: 'arpeggiated background, soft harmonic support' },
  piano:      { type: 'plucked',   role: 'percussive attack with harmonic capability',
                typical: 'harmonic bed, rhythmic punctuation, solo lines' },
};

/* Map a written instrument name onto a guide family. Returns null when the
 * instrument is outside the guide's scope (synths, drum machines, electric
 * instruments) — callers must then fall back rather than guess. */
const FAMILY_PATTERNS = [
  ['strings',    /\b(string|strings|violin|viola|cello|double bass|pizzicato)\b/i],
  ['woodwinds',  /\b(woodwind|woodwinds|flute|oboe|clarinet|bassoon|cor anglais|recorder|duduk|shakuhachi|reed|reeds|saxophone)\b/i],
  ['brass',      /\b(brass|horn|horns|trumpet|trombone|tuba|flugelhorn|cornet)\b/i],
  ['harp',       /\b(harp)\b/i],
  ['piano',      /\b(piano|rhodes|clavinet|harpsichord|celesta)\b/i],
  // Electronic percussion sources are OUTSIDE the guide's scope and must fall
  // through to null rather than be mapped onto an orchestral family.
  ['electronic', /\b(drum machine|drum-machine|808|909|electro|synth|sampled|programmed)\b/i],
  ['percussion', /\b(percussion|timpani|marimba|vibraphone|glockenspiel|xylophone|dulcimer|cimbalom|bells|drum|drums|shaker|conga|cajón|cajon|tabla)\b/i],
];
export function classifyInstrument(name) {
  const t = String(name || '');
  for (const [fam, re] of FAMILY_PATTERNS) if (re.test(t)) return fam === 'electronic' ? null : fam;
  return null;
}

/* ---- §13 Planes of tone (Belkin) ------------------------------------------
 * The most useful section for this project. John's round-4 results were a
 * prominence failure in BOTH directions at once: A1 — the marimba, cello and
 * French horn were inaudible; A3/A4 — the composer's instruments were "too front
 * and centre in the arrangement in volume". Planes give an explicit vocabulary
 * for placing each voice instead of hoping position in the string does it. */
export const PLANES = {
  foreground: {
    line:  (fam) => `${fam} in the foreground with a clear singing line`,
    solo:  (inst) => `solo ${inst} in the foreground over supporting ensemble`,
  },
  middle: {
    support: (fam) => `supporting ${fam} in the middle plane with gentle motion`,
    inner:   (fam) => `inner ${fam} voices filling the middle register`,
  },
  background: {
    blend:  (fam) => `blended ${fam} background plane with quiet, sustained timbres`,
    enrich: (fam) => `soft ${fam} resonance in the background to enrich the texture`,
  },
};

export function planePhrase(plane, variant, subject) {
  const p = PLANES[plane];
  if (!p) return null;
  const fn = p[variant] || Object.values(p)[0];
  return fn(subject);
}

/* ---- §2 General linking templates ----------------------------------------- */
export const TEMPLATES = {
  role: [
    (a, b, adj) => `${a} carries the main melody while ${b} provides ${adj || 'warm'} harmonic support`,
    (a, b) => `${a} leads in the foreground, ${b} forms a subtle background layer`,
    (a, b) => `${a} adds colour and articulation around the ${b} texture`,
    (a, b) => `${a} reinforces the ${b} harmony for extra fullness`,
  ],
  texture: [
    (a, b, adj) => `${a} floats above a ${adj || 'warm'} ${b} bed`,
    (a, b) => `${a} weaves through the ${b} texture with light countermelodies`,
    (a, b) => `${a} punctuates the phrases shaped by ${b}`,
    (a, b) => `${a} and ${b} trade phrases in a call-and-response dialogue`,
  ],
  register: [
    (a, b) => `${a} in a higher register sings over soft, mid-range ${b}`,
    (a, b) => `${b} kept in a lower register to support ${a} in the foreground`,
    (a, b) => `${a} slightly louder than the restrained ${b} background`,
  ],
};

/* ---- §3-§9, §11 Family-pair linking phrases -------------------------------
 * Keyed by sorted family pair. Guide sections cited per entry. Phrases carrying
 * fanfare / stabs / ostinato are omitted (see header). */
export const PAIR_LINKS = {
  // §3 Strings + Woodwinds
  'strings|woodwinds': [
    'solo woodwind floats above a warm string bed',
    'strings present the theme, woodwinds answer with delicate echoes',
    'strings in sustained chords, woodwinds in agile ornamental lines',
    'strings forming a soft background pad, woodwinds adding bright colour accents',
  ],
  // §4 Strings + Brass — theory: brass naturally move to the foreground, so
  // strings provide background UNLESS the brass are soft and low. On a groove-led
  // engine we always want the soft-and-low variants, so only those are imported.
  'brass|strings': [
    'string melody in the foreground with quiet brass harmonies in the background',
    'high violins soaring over restrained, low brass harmonies',
    'strings carrying the melody, brass adding soft harmonic reinforcement',
    'strings shimmer above a grounded low brass foundation',
  ],
  // §5 Strings + Percussion
  'percussion|strings': [
    'strings carry the harmonic motion while percussion drives the rhythm',
    'string phrases punctuated by crisp percussion accents',
    'delicate string textures highlighted by soft cymbal resonance',
  ],
  // §6 Strings + Harp
  'harp|strings': [
    'harp arpeggios shimmer beneath a warm string ensemble',
    'string melody floats over delicate, plucked harp harmony',
    'harp outlines the chord changes while strings sustain the colour',
  ],
  // §7 Strings + Piano
  'piano|strings': [
    'piano articulates the harmony under a sustained string texture',
    'string lines sing over rhythmic piano accompaniment',
    'piano punctuates phrases shaped by the string ensemble',
  ],
  // §8 Woodwinds + Brass
  'brass|woodwinds': [
    'woodwinds crown the brass harmony with sparkling upper lines',
    'woodwinds carrying intricate figures above soft brass chords',
  ],
  // §9 Woodwinds + Percussion
  'percussion|woodwinds': [
    'percussion underlines the rhythmic shape of woodwind phrases',
    'woodwinds trace melodic contours while percussion marks key accents',
    'percussion maintains a steady pulse beneath dancing woodwind lines',
  ],
  // §11 Harp + Piano
  // §11 Harp + Piano. The guide's first phrase ends '...under the orchestral
  // texture'; importing the word 'orchestral' into a groove-led prompt is the
  // exact convention bleed John identified in round 4, so it is EXCLUDED rather
  // than paraphrased — paraphrasing is how invention creeps back in.
  'harp|piano': [
    'plucked harp and struck piano patterns enrich the string pad',
  ],
};

export function pairKey(a, b) { return [a, b].sort().join('|'); }

// Deterministic pick so a seed reproduces a prompt.
export function pairLink(famA, famB, n) {
  if (!famA || !famB || famA === famB) return null;
  const list = PAIR_LINKS[pairKey(famA, famB)];
  if (!list || !list.length) return null;
  return list[(n >>> 0) % list.length];
}

/* ---- §12 Sustained vs plucked vs percussive -------------------------------- */
export const CROSS_TYPE = {
  sustainedPlucked:   (s, p) => `sustained ${s} create a smooth pad while plucked ${p} outline the harmony in motion`,
  percussiveSustained:(p, s) => `percussive ${p} define the rhythmic grid beneath sustained ${s} lines`,
  pluckedSustained:   (p, s) => `plucked figures in ${p} sparkle around the long, held tones in ${s}`,
};

/* Every linking phrase this module can emit, for the validator to check that
 * nothing invented has crept in. */
export function allPhrases() {
  const out = [];
  for (const list of Object.values(PAIR_LINKS)) out.push(...list);
  for (const plane of Object.values(PLANES))
    for (const fn of Object.values(plane)) out.push(fn('X'));
  return out;
}

// Delerium engine — album-era (Faces -> Semantic Spaces -> Karma -> Poem).
// NOT the trance-remix identity. Domains: 'E' electronic, 'A' acoustic, 'B' both.

const P = {
  // ---- master role inventory (transparent, editable) ----
  pads: {
    cathedralPad:   { t: 'slowly swelling cathedral-reverb analog pad', d: 'E' },
    darkDrone:      { t: 'dark evolving drone bed', d: 'E' },
    glassyPad:      { t: 'glassy digital pad with shimmering high partials', d: 'E' },
    stringWash:     { t: 'warm string-synth wash', d: 'E' },
    metallicDrone:  { t: 'bowed metallic drone', d: 'B' },
    reversedPad:    { t: 'reversed pad swell into the downbeat', d: 'E' },
    harmoniumDrone: { t: 'sustained harmonium drone', d: 'A' },
    celloDroneBed:  { t: 'bowed cello drone bed', d: 'A' },
  },
  bass: {
    subBass:     { t: 'deep sustained sub-bass', d: 'E' },
    seqBass:     { t: 'sequenced synth bass pulsing eighth notes', d: 'E' },
    analogBass:  { t: 'slow legato round analog bass', d: 'E' },
    fretless:    { t: 'fretless bass glide', d: 'B' },
    upright:     { t: 'slow plucked upright acoustic bass', d: 'A' },
    oudLow:      { t: 'low oud register', d: 'A' },
  },
  lead: {
    duduk:      { t: 'sustained duduk lead', d: 'A' },
    bambooFl:   { t: 'bamboo flute motif', d: 'A' },
    piano:      { t: 'sparse grand-piano figure', d: 'A' },
    synthArp:   { t: 'plucked synth arpeggio lead', d: 'E' },
    sitar:      { t: 'sitar melodic phrase', d: 'A' },
    celloLead:  { t: 'long-phrased bowed cello lead', d: 'A' },
    fmBell:     { t: 'glassy FM bell lead', d: 'E' },
    detunedLd:  { t: 'detuned analog synth lead with slow portamento', d: 'E' },
  },
  harmony: {
    minorModal: { t: 'slow minor-modal chord changes', d: 'B' },
    suspended:  { t: 'suspended chords resolving on the chorus lift', d: 'B' },
    droneTonic: { t: 'unresolved static drone-tonic', d: 'B' },
  },
  voice: {
    latinChant:   { t: 'distant monastic Latin chant', d: 'A' },
    femaleWash:   { t: 'ethereal wordless female vocal wash', d: 'A' },
    euroChoir:    { t: 'Eastern-European choir texture', d: 'A' },
    throatChant:  { t: 'throat-overtone chant drone', d: 'A' },
    vocalChops:   { t: 'rhythmic sampled ethnic vocal chops', d: 'B' },
    vocoderPad:   { t: 'vocoded wordless vocal pad', d: 'E' },
    granularVox:  { t: 'granular stretched-vocal drone', d: 'E' },
  },
  color: {
    fingerCymb:   { t: 'finger cymbals and bells', d: 'A' },
    dulcimer:     { t: 'hammered dulcimer run', d: 'A' },
    sarangi:      { t: 'bowed sarangi ornament', d: 'A' },
    gong:         { t: 'gong swell', d: 'A' },
    kalimba:      { t: 'kalimba figure', d: 'A' },
    bellArp:      { t: 'bell-synth arpeggio sparkle', d: 'E' },
    revStab:      { t: 'reversed synth-stab accent', d: 'E' },
  },
  movement: {
    filterLFO:    { t: 'slow filter LFO sweep', d: 'E' },
    delayThrows:  { t: 'tempo-synced delay throws', d: 'E' },
    autopan:      { t: 'wide stereo autopan', d: 'E' },
    reversedTr:   { t: 'reversed-swell transitions', d: 'E' },
    reverbTail:   { t: 'long cathedral reverb tail', d: 'E' },
    tremoloSwell: { t: 'tremolo bowed-string swell', d: 'A' },
    handCresc:    { t: 'rolling hand-percussion crescendo', d: 'A' },
  },
};

// ---- drum families ----
const DRUMS = {
  worldbeat: ['deep frame drum','tabla pattern','dumbek groove','hand-played djembe','congas and shakers with tambourine'],
  softDown:  ['subdued soft programmed kick','brushed programmed snare','trip-hop-leaning downtempo groove'],
  firefly:   ['denser driving programmed pulse'],
  hybrid:    ['programmed kick under live hand percussion'],
};

// pick helper: list role keys
const r = (role, ...keys) => keys.map(k => P[role][k]);

// ---- 5 character pools (Option B: each role 2-3 swaps) ----
const CHARACTERS = {
  gothicAmbient: {
    label: 'Gothic Ambient', source: 'Faces / Morpheus',
    genre: 'Delerium Style, dark ritual ambient',
    beatless: true, energy: 'low', colorChance: 0.5,
    drums: { primary: null, secondary: null },
    pools: {
      pads:     r('pads','darkDrone','cathedralPad','metallicDrone'),
      bass:     r('bass','subBass','fretless'),
      harmony:  r('harmony','droneTonic','minorModal'),
      voice:    r('voice','throatChant','granularVox'),
      lead:     r('lead','celloLead'),
      color:    r('color','gong'),
      movement: r('movement','reversedTr','reverbTail','tremoloSwell'),
    },
  },
  worldbeatRitual: {
    label: 'Worldbeat Ritual', source: 'Semantic Spaces',
    genre: 'Delerium Style, worldbeat downtempo, tribal ethereal',
    beatless: false, bpm: [84,96], energy: 'low to medium', colorChance: 0.55,
    drums: { primary: 'worldbeat', secondary: null },
    pools: {
      pads:     r('pads','darkDrone','harmoniumDrone','metallicDrone'),
      bass:     r('bass','subBass','oudLow'),
      harmony:  r('harmony','droneTonic','minorModal'),
      voice:    r('voice','euroChoir','throatChant','vocalChops'),
      lead:     r('lead','duduk','bambooFl','sitar'),
      color:    r('color','fingerCymb','dulcimer','sarangi'),
      movement: r('movement','filterLFO','handCresc','reverbTail'),
    },
  },
  sacredDowntempo: {
    label: 'Sacred Downtempo', source: 'Silence / Karma',
    genre: 'Delerium Style, sacred ethereal downtempo',
    beatless: false, bpm: [92,100], energy: 'medium', colorChance: 0.45,
    drums: { primary: 'softDown', secondary: 'hybrid' },
    pools: {
      pads:     r('pads','cathedralPad','glassyPad','harmoniumDrone'),
      bass:     r('bass','subBass','seqBass','upright'),
      harmony:  r('harmony','minorModal','suspended'),
      voice:    r('voice','latinChant','femaleWash','vocoderPad'),
      lead:     r('lead','piano','duduk','fmBell'),
      color:    r('color','fingerCymb','dulcimer','revStab'),
      movement: r('movement','delayThrows','reversedTr','reverbTail'),
    },
  },
  ethereal: {
    label: 'Ethereal', source: 'Innocente / Poem',
    genre: 'Delerium Style, ethereal downtempo electronica',
    beatless: false, bpm: [100,112], energy: 'medium', colorChance: 0.4,
    drums: { primary: 'softDown', secondary: 'hybrid' },
    pools: {
      pads:     r('pads','cathedralPad','glassyPad','stringWash'),
      bass:     r('bass','seqBass','analogBass','upright'),
      harmony:  r('harmony','minorModal','suspended'),
      voice:    r('voice','femaleWash','vocoderPad','granularVox'),
      lead:     r('lead','piano','synthArp','detunedLd'),
      color:    r('color','kalimba','bellArp'),
      movement: r('movement','delayThrows','autopan','reverbTail'),
    },
  },
  firefly: {
    label: 'Firefly', source: 'Euphoria',
    genre: 'Delerium Style, driving ethereal downtempo',
    beatless: false, bpm: [112,126], energy: 'medium to high', colorChance: 0.4,
    drums: { primary: 'firefly', secondary: 'hybrid' },
    pools: {
      pads:     r('pads','cathedralPad','glassyPad','reversedPad'),
      bass:     r('bass','subBass','seqBass'),
      harmony:  r('harmony','suspended','minorModal'),
      voice:    r('voice','femaleWash','vocoderPad','vocalChops'),
      lead:     r('lead','synthArp','fmBell','detunedLd'),
      color:    r('color','bellArp','revStab'),
      movement: r('movement','delayThrows','autopan','reverbTail'),
    },
  },
};

// ---- interplay / arrangement layer (the "score", not the "cast") ----
// role-generic: references voices by FUNCTION only, never re-names an instrument.
// conversation = how melodic voices relate; foundation = how bass/groove lock or
// float; arc = how density/dynamics evolve. Present-participle, comma-free.
const INTERPLAY = {
  gothicAmbient: {
    conversation: [
      'voices emerging and receding without hierarchy each layer equal in the field',
      'the lead surfacing alone against deep space then dissolving back into texture',
      'cross-fading tones with melody dissolved into atmosphere',
    ],
    foundation: [
      'the low register holding a single harmonic centre with everything suspended above',
      'a sustained drone anchoring while timbres drift over it unmoving',
    ],
    arc: [
      'glacial evolution with the texture morphing so slowly change is felt rather than heard',
      'harmonic stasis with motion replaced by the slow turn of timbre',
      'tension sustained by what never resolves',
    ],
  },
  worldbeatRitual: {
    conversation: [
      'the lead wind and choir wash trading phrases over the percussion',
      'a flute motif answered now and then by an ornament rising through the mix',
      'the lead stating a phrase while the vocal wash breathes beneath it',
    ],
    foundation: [
      'hand percussion and deep bass locked in a rolling ritual pocket',
      'the low drone anchoring while the hand drums drive above it',
      'bass and frame drum interlocking in a loose earthy groove',
    ],
    arc: [
      'voices layering in one at a time building the ritual organically',
      'the percussion swelling and receding in long ceremonial waves',
      'density rising through added hand drums then opening back to space',
    ],
  },
  sacredDowntempo: {
    conversation: [
      'the lead and choir wash rising together then answered by soft chord swells',
      'a sparse lead phrase hanging over the chant with space between statements',
      'the melody and vocal wash trading the foreground unhurried',
    ],
    foundation: [
      'deep bass and the soft downtempo beat locked in a slow reverent pocket',
      'the bass sustaining long tones beneath the pads anchoring without intruding',
      'a gentle programmed groove holding steady while the low end floats',
    ],
    arc: [
      'a slow dynamic arc with layers stacking toward a lush sacred peak then receding',
      'the arrangement opening gradually with each voice given room to breathe',
      'tension built through rising harmony and released into open sustained chords',
    ],
  },
  ethereal: {
    conversation: [
      'the lead and chords trading phrases in warm ethereal dialogue',
      'a soft melody drifting over the harmony answered by a second voice',
      'the lead floating free while the chords comp around it',
    ],
    foundation: [
      'bass and the light downtempo beat rolling forward in a smooth pocket',
      'the bass gliding beneath the pulse tied to the cycle above',
      'a steady groove anchoring while the low end moves smooth and unhurried',
    ],
    arc: [
      'voices entering one at a time building organically with air around each',
      'a gentle arc swelling toward an emotional lift then settling back',
      'the arrangement layering toward immersion then thinning to open space',
    ],
  },
  firefly: {
    conversation: [
      'the lead and arpeggio interlocking in a tight bright weave',
      'the lead motif answered by chord stabs over the drive',
      'melodic fragments trading with their delayed repeats in call-and-response',
    ],
    foundation: [
      'sequenced bass and the driving pulse locked tight and propulsive',
      'the bass and beat chugging steady and forward beneath the layers',
      'a relentless low pulse anchoring while the synths climb over it',
    ],
    arc: [
      'the groove building through added layers toward an open peak',
      'filtered synths opening over the drive into a full-energy lift',
      'tension stacking through rising layers then released into the chorus',
    ],
  },
};

export const DELERIUM = {
  id: 'Delerium',
  styleAnchor: 'Delerium Style',
  master: P,
  drums: DRUMS,
  characters: CHARACTERS,
  interplay: INTERPLAY,
  sourceNegative: [
    'trance','four-on-the-floor','club anthem','EDM drop','supersaw',
    'hard kick','festival synths','big-room','pop hooks','radio pop',
  ],
  // render order over the structured arrangement
  order: ['pads','harmony','bass','drums','voice','lead','color','interplay','movement'],
};

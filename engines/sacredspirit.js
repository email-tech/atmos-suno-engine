// Sacred Spirit engine (Claus Zundel a.k.a. "The Fearsome Brave", w/ Ralf Hamm + Markus Staab)
// ---------------------------------------------------------------------------
// RESEARCH BASIS (catalogue, not general vibes):
//   Chants and Dances of the Native Americans (1994) — the defining record. Ceremonial
//   chant (Navajo / Pueblo / Sioux material, plus a Sami yoik on "Ly-O-Lay Ale Loya")
//   set over synthesizer backings and CELLO, and driven by a combination of traditional
//   drumming and electronic dance beats. Signature instruments repeatedly cited in the
//   record's reception: Native American cedar flute, drums/rattles, deep bowed cello,
//   keyboard wash. Track shapes give the character map directly:
//     "How the West Was Lost (Intro & Prelude)"      -> beatless ceremonial ambient
//     "Tor-Cheney-Nahana (Winter Ceremony)"          -> slow ceremonial, drum-as-heartbeat
//     "Yeha-Noha (Wishes of Happiness & Prosperity)" -> looping electro-acoustic chant groove
//     "Ta-Was-Ne (Elevation)"                        -> synth-forward hypnotic new-age
//     "Ly-O-Lay Ale Loya (Counterclockwise Circle Dance)" -> dance/club circle groove
//   Indians' Sacred Spirit (2000) — same world, more instrumental, chant chopped into
//   short pieced samples rather than one long line. Treated as colour on the above.
//   Zundel is also B-Tribe (Ibiza chillout) — that production hand (warm pads, nylon
//   guitar, hand percussion, wide reverb) is audible throughout and is part of the palette.
//
// CHARACTER LOGIC = GENRE -> SUB-GENRE -> INSTRUMENTATION (John's rule), never BPM alone:
//   Ceremonial Prelude  = new age/ambient -> ceremonial ambient    -> cedar flute, cello, drones
//   Winter Ceremony     = new age/world   -> slow ceremonial       -> heartbeat drum, cello, chant
//   Chant Groove        = world/electronic-> electro-acoustic downtempo -> looped chant, hand perc
//   Shamanic Elevation  = electronic      -> hypnotic new-age       -> arps, synth lead, tribal pulse
//   Circle Dance        = electronic      -> tribal dance/club      -> 4/4 kit + powwow frame drum
//
// VOCAL DIRECTION TAXONOMY (feeds the later lyric/metatag engine — do not lose this):
//   solo ceremonial : lone elder male chant, low male vocal drone
//   group           : unison powwow-style group chant, layered chant choir, call-and-response
//   northern colour : Sami-style yoik (used on the Circle Dance material)
//   wordless        : vocables (chanting with no lexical words), wordless female line, high cry
//   electronic use  : looped chant hook, chopped chant stabs
//   language        : vocable / untranslated; the chant functions as the lead instrument.
//   NOTE: chant is treated as MUSIC, never as spoken word or field recording.
//
// Domains: 'E' electronic, 'A' acoustic/organic, 'B' both.

const P = {
  pads: {
    warmPad:      { t: 'warm analog synth pads', d: 'E' },
    lowDrone:     { t: 'a deep sustained low synth drone', d: 'E' },
    stringPad:    { t: 'a lush string-section pad', d: 'A' },
    celloBed:     { t: 'a sustained bowed-cello drone', d: 'A' },
    choirPad:     { t: 'a wordless choir pad', d: 'B' },
    glassPad:     { t: 'a glassy digital pad', d: 'E' },
    shimmerPad:   { t: 'a shimmering high-string tremolo pad', d: 'A' },
    openAirWash:  { t: 'a wide open synth wash', d: 'E' },
    nylonBed:     { t: 'a soft nylon-guitar arpeggio bed', d: 'A' },
    bellPad:      { t: 'a bell-synth pad shimmer', d: 'E' },
    hybridWash:   { t: 'a hybrid strings-and-synth wash', d: 'B' },
    fluteBed:     { t: 'a layered wooden-flute pad', d: 'A' },
  },
  bass: {
    subBass:     { t: 'a deep round synth sub-bass', d: 'E' },
    celloBass:   { t: 'a low bowed cello foundation', d: 'A' },
    fretlessBass:{ t: 'a singing fretless bass', d: 'B' },
    dubBass:     { t: 'a deep dub bassline', d: 'E' },
    pluckedBass: { t: 'a plucked synth bass', d: 'E' },
    houseBass:   { t: 'a driving house bassline', d: 'E' },
    seqBass:     { t: 'a sequenced synth bass pulsing eighth notes', d: 'E' },
    uprightBass: { t: 'an upright bass pulse', d: 'A' },
    pedalDrone:  { t: 'a low sustained drone bass', d: 'B' },
    filterBass:  { t: 'a warm filtered analog bassline', d: 'E' },
  },
  lead: {
    cedarFlute:  { t: 'a breathy Native American cedar flute melody', d: 'B' },
    soloCello:   { t: 'an aching solo cello line', d: 'B' },
    lowDroneFlute:{ t: 'a low drone-flute counterline', d: 'A' },
    soloViolin:  { t: 'a keening solo violin', d: 'A' },
    nylonGuitar: { t: 'a nylon-string guitar figure', d: 'A' },
    pianoFigure: { t: 'a simple grand-piano figure', d: 'A' },
    rhodesFigure:{ t: 'a warm Rhodes electric-piano figure', d: 'B' },
    synthLead:   { t: 'a warm analog synth lead', d: 'E' },
    synthArp:    { t: 'a bubbling synth arpeggio lead', d: 'E' },
    fmBellLead:  { t: 'a glassy FM bell lead', d: 'E' },
    ocarinaLead: { t: 'a hollow ocarina line', d: 'A' },
    housePiano:  { t: 'a stabbing house piano riff', d: 'B' },
  },
  harmony: {
    modalMinor:   { t: 'modal minor chord changes', d: 'B' },
    pentatonic:   { t: 'a pentatonic modal movement', d: 'B' },
    droneTonic:   { t: 'a static tonic drone under a shifting melody', d: 'B' },
    suspendedLoop:{ t: 'a suspended two-chord loop that keeps turning', d: 'B' },
    majorLift:    { t: 'a warm major-key progression lifting on the chorus', d: 'B' },
    minorToMajor: { t: 'a minor-to-relative-major resolution on the lift', d: 'B' },
    plagalHome:   { t: 'a plagal cadence resolving home', d: 'B' },
    risingProg:   { t: 'a rising progression that resolves upward', d: 'B' },
    aeolianClose: { t: 'an aeolian cadence settling on the tonic', d: 'B' },
    pedalHarmony: { t: 'a sustained tonic pedal under shifting harmony', d: 'B' },
  },
  voice: {
    elderChant:   { t: 'a lone elder male ceremonial chant', d: 'A' },
    lowVocalDrone:{ t: 'a low male vocal drone', d: 'A' },
    groupChant:   { t: 'a unison powwow-style group chant', d: 'A' },
    layeredChant: { t: 'a layered chant choir', d: 'B' },
    yoikVocal:    { t: 'a Sami-style yoik vocal', d: 'A' },
    vocables:     { t: 'wordless vocable chanting', d: 'A' },
    callResponse: { t: 'call-and-response chant answers', d: 'A' },
    wordlessFemale:{ t: 'a wordless female vocal line', d: 'A' },
    highCry:      { t: 'a high female vocal cry', d: 'A' },
    chantHook:    { t: 'a looped chant hook', d: 'B' },
    chantStabs:   { t: 'chopped chant vocal stabs', d: 'E' },
    breathyFemale:{ t: 'a breathy close female vocal texture', d: 'A' },
  },
  color: {
    bellChime:    { t: 'a struck metal bell chime', d: 'A' },
    windChimes:   { t: 'a wind-chime shimmer', d: 'A' },
    fluteFlourish:{ t: 'a short flute flourish', d: 'A' },
    harpGliss:    { t: 'a harp glissando', d: 'A' },
    celloSwell:   { t: 'a swelling cello accent', d: 'A' },
    pizzStrings:  { t: 'a pizzicato string accent', d: 'A' },
    gongSwell:    { t: 'a gong swell', d: 'A' },
    synthStab:    { t: 'a filtered synth stab', d: 'E' },
    reversedStab: { t: 'a reversed synth-stab accent', d: 'E' },
    bellArp:      { t: 'a bell-synth arpeggio sparkle', d: 'E' },
  },
  movement: {
    reverbTail:   { t: 'a long reverb tail', d: 'E' },
    delayThrows:  { t: 'tempo-synced delay throws', d: 'E' },
    dubDelay:     { t: 'dub delay echoes trailing the chant', d: 'E' },
    filterSweep:  { t: 'a slow filter sweep across the pads', d: 'E' },
    autopan:      { t: 'a wide stereo autopan', d: 'E' },
    risers:       { t: 'filtered-noise risers into the lift', d: 'E' },
    tapeEcho:     { t: 'analog tape-echo repeats', d: 'E' },
    stringSwell:  { t: 'sweeping string swells', d: 'A' },
    sidechainPump:{ t: 'a pumping sidechained pad rhythm', d: 'E' },
    breakdown:    { t: 'a stripped breakdown before the lift', d: 'B' },
    vocalChops:   { t: 'stuttered vocal-chop edits', d: 'E' },
    pitchGlide:   { t: 'a slow pitch-bending pad glide', d: 'E' },
  },
};

// Drum pools kept ENTIRELY separate from the instrument palette (project rule).
const DRUMS = {
  heartbeat:  ['a slow deep frame-drum heartbeat pulse','a soft ceremonial drum pulse with light rattles','a slow tribal drum pattern with shakers'],
  ceremonial: ['a steady powwow-style frame drum with rattles','a mid-tempo tribal drum groove with shakers','a downtempo beat under a big frame drum'],
  chantGroove:['a laid-back electro-acoustic beat with hand percussion','a mellow programmed groove with shakers and soft toms','a downtempo beat with congas and rattles'],
  hypnotic:   ['a hypnotic programmed pulse with tribal percussion','a steady electronic groove with rattles and low toms','a driving mid-tempo beat with layered hand percussion'],
  circleDance:['a four-on-the-floor beat under a powwow frame drum','a driving club beat with tribal drums and shakers','a punchy dance beat layered with big tom hits'],
};

const r = (role, ...keys) => keys.map(k => P[role][k]);

const CHARACTERS = {
  ceremonialPrelude: {
    label: 'Ceremonial Prelude', source: 'How the West Was Lost (Intro & Prelude)',
    genre: 'Sacred Spirit Style, ceremonial ambient new age',
    beatless: true, energy: 'low', colorChance: 0.5,
    drums: { primary: null, secondary: null },
    pools: {
      pads:     r('pads','lowDrone','celloBed','fluteBed','choirPad','warmPad','shimmerPad'),
      bass:     r('bass','pedalDrone','celloBass','subBass','fretlessBass'),
      harmony:  r('harmony','droneTonic','pentatonic','aeolianClose','plagalHome','pedalHarmony'),
      voice:    r('voice','elderChant','lowVocalDrone','vocables','wordlessFemale','layeredChant'),
      lead:     r('lead','cedarFlute','soloCello','lowDroneFlute','ocarinaLead','pianoFigure'),
      color:    r('color','bellChime','windChimes','harpGliss','celloSwell','gongSwell'),
      movement: r('movement','reverbTail','pitchGlide','autopan','stringSwell','delayThrows'),
    },
  },
  winterCeremony: {
    label: 'Winter Ceremony', source: 'Tor-Cheney-Nahana (Winter Ceremony)',
    genre: 'Sacred Spirit Style, slow ceremonial world new age',
    beatless: false, bpm: [72,84], energy: 'low to medium', colorChance: 0.5,
    drums: { primary: 'heartbeat', secondary: 'ceremonial' },
    pools: {
      pads:     r('pads','celloBed','stringPad','warmPad','choirPad','hybridWash','shimmerPad'),
      bass:     r('bass','celloBass','pedalDrone','subBass','uprightBass','fretlessBass'),
      harmony:  r('harmony','modalMinor','aeolianClose','minorToMajor','pedalHarmony','plagalHome'),
      voice:    r('voice','elderChant','groupChant','vocables','lowVocalDrone','callResponse','wordlessFemale'),
      lead:     r('lead','soloCello','cedarFlute','soloViolin','pianoFigure','lowDroneFlute'),
      color:    r('color','celloSwell','bellChime','pizzStrings','fluteFlourish','gongSwell'),
      movement: r('movement','stringSwell','reverbTail','delayThrows','tapeEcho','autopan'),
    },
  },
  chantGroove: {
    label: 'Chant Groove', source: 'Yeha-Noha (Wishes of Happiness & Prosperity)',
    genre: 'Sacred Spirit Style, chant-led electro-acoustic downtempo',
    beatless: false, bpm: [92,102], energy: 'medium', colorChance: 0.5,
    drums: { primary: 'chantGroove', secondary: 'ceremonial' },
    pools: {
      pads:     r('pads','warmPad','nylonBed','openAirWash','choirPad','stringPad','bellPad'),
      bass:     r('bass','dubBass','subBass','fretlessBass','filterBass','uprightBass'),
      harmony:  r('harmony','suspendedLoop','pentatonic','majorLift','minorToMajor','droneTonic'),
      voice:    r('voice','chantHook','elderChant','vocables','layeredChant','breathyFemale','callResponse'),
      lead:     r('lead','cedarFlute','nylonGuitar','rhodesFigure','soloCello','synthLead','ocarinaLead'),
      color:    r('color','fluteFlourish','bellChime','harpGliss','bellArp','celloSwell'),
      movement: r('movement','dubDelay','delayThrows','reverbTail','tapeEcho','autopan','filterSweep'),
    },
  },
  shamanicElevation: {
    label: 'Shamanic Elevation', source: 'Ta-Was-Ne (Elevation)',
    genre: 'Sacred Spirit Style, hypnotic electronic new age',
    beatless: false, bpm: [106,116], energy: 'medium to high', colorChance: 0.5,
    drums: { primary: 'hypnotic', secondary: 'circleDance' },
    pools: {
      pads:     r('pads','glassPad','openAirWash','warmPad','bellPad','hybridWash','choirPad'),
      bass:     r('bass','seqBass','subBass','pluckedBass','filterBass','fretlessBass'),
      harmony:  r('harmony','modalMinor','risingProg','suspendedLoop','minorToMajor','majorLift'),
      voice:    r('voice','layeredChant','chantHook','yoikVocal','highCry','vocables','chantStabs'),
      lead:     r('lead','synthArp','synthLead','fmBellLead','cedarFlute','rhodesFigure','soloViolin'),
      color:    r('color','bellArp','synthStab','reversedStab','windChimes','fluteFlourish'),
      movement: r('movement','filterSweep','delayThrows','risers','autopan','breakdown','pitchGlide'),
    },
  },
  circleDance: {
    label: 'Circle Dance', source: 'Ly-O-Lay Ale Loya (Counterclockwise Circle Dance)',
    genre: 'Sacred Spirit Style, tribal dance circle groove',
    beatless: false, bpm: [118,128], energy: 'high', colorChance: 0.45,
    drums: { primary: 'circleDance', secondary: 'hypnotic' },
    pools: {
      pads:     r('pads','openAirWash','glassPad','warmPad','choirPad','bellPad','stringPad'),
      bass:     r('bass','houseBass','seqBass','subBass','pluckedBass','filterBass'),
      harmony:  r('harmony','pentatonic','modalMinor','risingProg','majorLift','suspendedLoop'),
      voice:    r('voice','yoikVocal','groupChant','chantStabs','chantHook','callResponse','highCry'),
      lead:     r('lead','housePiano','synthArp','cedarFlute','synthLead','fmBellLead','soloViolin'),
      color:    r('color','synthStab','reversedStab','bellArp','bellChime','windChimes'),
      movement: r('movement','sidechainPump','risers','vocalChops','breakdown','delayThrows','filterSweep'),
    },
  },
};

// Interaction/interplay language — WOVEN into the style string (standing project rule).
const INTERPLAY = {
  ceremonialPrelude: {
    conversation: ['answering the chant across a vast open space','stating the theme alone then dissolving into the drone',
                   'trading long slow phrases with the pad in call-and-response'],
    foundation:   ['holding one low centre while everything floats above','sustaining beneath the melody without ever pushing',
                   'anchoring the drone as the upper voices drift'],
    arc:          ['opening one voice at a time with air around each','swelling slowly then falling back to stillness',
                   'resolving at last onto a sustained tonic chord','easing into a slow resolving cadence as it closes'],
    voiceRel:     ['carried alone over the drone','floating far back in the reverb','answered in soft layered harmony'],
    colorRel:     ['ringing once into the open air','glinting in the quiet spaces','marking the turn of the phrase'],
  },
  winterCeremony: {
    conversation: ['answering the chant with a long aching counterline','trading slow phrases with the strings',
                   'stating the melody alone as the ensemble gathers behind it','weaving around the ceremonial voice without crowding it'],
    foundation:   ['pulsing slow and deep like a heartbeat under the chant','anchoring in slow motion while the melody rises',
                   'moving unhurried beneath the ceremony'],
    arc:          ['building from a lone voice to a full ceremonial weave','swelling toward a solemn peak then falling away',
                   'resolving onto a settled final chord','landing the ceremony on a resolved cadence'],
    voiceRel:     ['chanting from deep in the reverb','carried over the slow pulse','answered by the massed group chant'],
    colorRel:     ['swelling under the phrase','ringing across the drum pulse','marking the turn of the ceremony'],
  },
  chantGroove: {
    conversation: ['weaving around the chant loop without crowding it','answered by the vocal hook every second bar',
                   'trading warm phrases with the pads over the groove','locking with the chant hook in a rolling weave'],
    foundation:   ['rolling deep and unhurried under the chant','sitting low in the pocket while the flute breathes',
                   'anchoring the groove as the voice floats above'],
    arc:          ['building layer by layer then stripping back to the chant','swelling into a warm lift then easing home',
                   'resolving onto a warm final chord','settling into a resolved closing cadence'],
    voiceRel:     ['looping hypnotically over the groove','floating above the beat','answering the melody in close harmony'],
    colorRel:     ['sparkling between the phrases','tracing the top of the harmony','answering the vocal hook'],
  },
  shamanicElevation: {
    conversation: ['interlocking with the arpeggio in a hypnotic weave','answered by the chant on the lift',
                   'trading with its own delayed repeats in call-and-response','climbing over the pulse as the choir answers'],
    foundation:   ['pulsing steady and hypnotic under the layers','driving forward beneath the climbing synths',
                   'anchoring the trance while the percussion rolls above'],
    arc:          ['building through stacked layers toward an open peak','opening out of the breakdown into a soaring lift',
                   'released from the climb into a resolved chorus','resolving the ascent onto a bright final chord'],
    voiceRel:     ['soaring over the pulse','looping hypnotically through the groove','rising in answer to the lead'],
    colorRel:     ['sparking over the groove','accenting the lift','flickering between the beats'],
  },
  circleDance: {
    conversation: ['interlocking with the chant stabs in a driving weave','answered by the yoik over the four-on-the-floor pulse',
                   'stabbing against the beat as the group chant answers','riding the frame drum in a circling weave'],
    foundation:   ['locked tight and propulsive under the layers','pumping relentless beneath the massed chant',
                   'driving the floor while the frame drum thunders above'],
    arc:          ['building the circle from one drum to a full-energy dance','stacking chant and percussion toward an open peak',
                   'released from the break into a resolved euphoric chorus','resolving the dance onto a bright final chord'],
    voiceRel:     ['chanting massed over the drive','chopped rhythmically against the pulse','calling out high over the groove'],
    colorRel:     ['sparking over the groove','accenting the lift','flickering between the beats'],
  },
};

export const SACREDSPIRIT = {
  id: 'Sacred Spirit',
  styleAnchor: 'Sacred Spirit Style',
  master: P,
  drums: DRUMS,
  characters: CHARACTERS,
  interplay: INTERPLAY,
  sourceNegative: [
    'radio pop','cheesy pop hooks','rap verse','trap hi-hats','EDM festival drop',
    'supersaw stacks','chiptune','autotuned vocals','heavy metal','distorted electric guitar',
    'rock drums','spoken word narration',
  ],
  order: ['pads','harmony','bass','drums','voice','lead','color','movement'],
};

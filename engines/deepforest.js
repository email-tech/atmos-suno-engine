// Deep Forest engine (Eric Mouquet / Michel Sanchez, prod. Dan Lacksman)
// ---------------------------------------------------------------------------
// RESEARCH BASIS (catalogue, not general vibes):
//   Deep Forest (1992)  — "ethnic electronica": Central African / Solomon Islands
//                         chant material over early-90s ambient + dance-driven
//                         electronics. Beatless twilight interludes sit next to
//                         club-facing cuts (Sweet Lullaby, Forest Hymn, Savana Dance).
//   Boheme (1995)       — Eastern Europe: Hungarian/Romani/Bulgarian folk voices,
//                         cimbalom, folk violin, accordion, breakbeat.
//                         (Grammy, Best World Music Album.)
//   Comparsa (1997)     — Afro-Cuban / Latin / Caribbean carnival: congas, marimba,
//                         steel pan, nylon guitar, procession grooves.
//   Post-2005 (Mouquet solo: Deep Brasil / Deep Africa / Evo Devo) — same DNA,
//                         so it is treated as colour on the above, not a 4th world.
//
// CHARACTER LOGIC = GENRE -> SUB-GENRE -> INSTRUMENTATION (John's rule), never BPM alone:
//   Forest Nocturne  = world/ambient   -> ethno-ambient        -> kalimba, wooden flute, drones
//   Sweet Chillout   = world/electronic-> ethnic downtempo     -> hocketed chant, dub sub, marimba
//   Bohemian Fusion  = world/electronic-> Balkan folk-electronica -> cimbalom, folk violin, accordion
//   Comparsa Carnival= world/latin     -> Afro-Cuban worldbeat -> congas, steel pan, brass, nylon
//   Tribal Dance     = electronic      -> tribal house         -> 4/4 club kit, chant stabs, house piano
//
// VOCAL DIRECTION TAXONOMY (feeds the later lyric/metatag engine — do not lose this):
//   forest voices   : interlocking hocketed chant, high yodelled forest calls, lone lullaby
//   Balkan voices   : Hungarian folk female, open-fifth Bulgarian harmony, Romani male lament
//   Latin voices    : Afro-Cuban call-and-response, group carnival chant
//   electronic use  : chopped chant stabs, looped chant hook, wordless layered choir
//   language        : untranslated / vocable; the voice is used as an instrument
//
// Domains: 'E' electronic, 'A' acoustic/organic, 'B' both.
// NOTE: field recordings / nature sound / foley are FORBIDDEN in the positive prompt —
// the "forest" is made from instruments and voices only.

const P = {
  pads: {
    warmAnalogPad:  { t: 'lush warm analog synth pads', d: 'E' },
    forestDrone:    { t: 'a deep sustained low synth drone bed', d: 'E' },
    synthStringPad: { t: 'a warm synth-string pad wash', d: 'E' },
    choirPad:       { t: 'a wordless choir pad', d: 'B' },
    glassPad:       { t: 'a glassy digital pad', d: 'E' },
    bellPad:        { t: 'a shimmering bell-synth pad', d: 'E' },
    stringSection:  { t: 'a lush string section', d: 'A' },
    accordionDrone: { t: 'a sustained accordion drone', d: 'A' },
    marimbaBed:     { t: 'a soft marimba ostinato bed', d: 'A' },
    hybridWash:     { t: 'a hybrid orchestra-and-synth wash', d: 'B' },
    fluteBed:       { t: 'a layered wooden-flute pad', d: 'A' },
    rhodesBed:      { t: 'a warm Rhodes chord bed', d: 'B' },
    nylonBed:       { t: 'a soft nylon-guitar arpeggio bed', d: 'A' },
  },
  bass: {
    subBass:      { t: 'a deep round synth sub-bass', d: 'E' },
    fretlessBass: { t: 'a singing fretless bass', d: 'B' },
    dubBass:      { t: 'a deep dub bassline', d: 'E' },
    pluckedBass:  { t: 'a plucked synth bass', d: 'E' },
    houseBass:    { t: 'a driving house bassline', d: 'E' },
    tumbaoBass:   { t: 'a syncopated Latin tumbao bass', d: 'B' },
    uprightBass:  { t: 'a walking upright bass', d: 'A' },
    celloLow:     { t: 'a low bowed cello counterline', d: 'A' },
    balafonBass:  { t: 'a low balafon bass pulse', d: 'A' },
    seqBass:      { t: 'a sequenced synth bass pulsing eighth notes', d: 'E' },
    pedalDrone:   { t: 'a low sustained drone bass', d: 'B' },
  },
  lead: {
    kalimba:      { t: 'a bright kalimba melody', d: 'B' },
    woodenFlute:  { t: 'a breathy wooden flute melody', d: 'B' },
    panpipes:     { t: 'a soft panpipe melody', d: 'B' },
    synthLead:    { t: 'a warm analog synth lead', d: 'E' },
    nylonGuitar:  { t: 'a nylon-string guitar figure', d: 'B' },
    marimbaLead:  { t: 'a rippling marimba line', d: 'B' },
    balafon:      { t: 'a rippling balafon line', d: 'B' },
    cimbalom:     { t: 'a shimmering cimbalom tremolo', d: 'B' },
    balkanClarinet:{ t: 'a wailing Balkan clarinet line', d: 'B' },
    gypsyGuitar:  { t: 'a strummed gypsy-jazz guitar', d: 'B' },
    folkViolin:   { t: 'a keening folk violin lead', d: 'B' },
    accordionLead:{ t: 'a plaintive accordion melody', d: 'B' },
    rhodesFigure: { t: 'a warm Rhodes electric-piano figure', d: 'B' },
    latinBrass:   { t: 'a punchy Latin brass line', d: 'A' },
    steelPan:     { t: 'a bright steel-pan melody', d: 'B' },
    housePiano:   { t: 'a stabbing house piano riff', d: 'B' },
    synthArp:     { t: 'a bubbling synth arpeggio lead', d: 'E' },
    ocarinaLead:  { t: 'a hollow ocarina line', d: 'B' },
  },
  harmony: {
    modalMinor:   { t: 'modal minor chord changes', d: 'B' },
    suspendedLoop:{ t: 'a suspended two-chord loop that keeps turning', d: 'B' },
    majorLift:    { t: 'a warm major-key progression lifting on the chorus', d: 'B' },
    pentatonic:   { t: 'a pentatonic modal movement', d: 'B' },
    romaniMinor:  { t: 'a Romani harmonic-minor progression', d: 'B' },
    montuno:      { t: 'an Afro-Cuban montuno chord vamp', d: 'B' },
    droneTonic:   { t: 'a static tonic drone under a shifting melody', d: 'B' },
    plagalHome:   { t: 'a plagal cadence resolving home', d: 'B' },
    risingProg:   { t: 'a rising progression that resolves upward', d: 'B' },
    minorToMajor: { t: 'a minor-to-relative-major resolution on the lift', d: 'B' },
    aeolianClose: { t: 'an aeolian cadence settling on the tonic', d: 'B' },
  },
  voice: {
    pygmyHocket:  { t: 'interlocking hocketed forest chant', d: 'A' },
    forestYodel:  { t: 'a high yodelled forest vocal call', d: 'A' },
    loneLullaby:  { t: 'a lone female lullaby vocal in an untranslated language', d: 'A' },
    chantHook:    { t: 'a looped tribal chant hook', d: 'B' },
    wordlessChoir:{ t: 'a wordless layered choir', d: 'B' },
    maleTribalCall:{ t: 'a deep male tribal call', d: 'A' },
    hungarianFolk:{ t: 'a Hungarian folk female vocal', d: 'A' },
    bulgarianHarm:{ t: 'open-fifth Bulgarian female harmony', d: 'A' },
    romaniLament: { t: 'a Romani male lament vocal', d: 'A' },
    afroCubanCall:{ t: 'an Afro-Cuban call-and-response vocal', d: 'A' },
    carnivalGroup:{ t: 'a group carnival chant', d: 'A' },
    chantStabs:   { t: 'chopped chant vocal stabs', d: 'E' },
    breathyFemale:{ t: 'a breathy close female vocal texture', d: 'A' },
    ululation:    { t: 'a rising female ululation', d: 'A' },
  },
  color: {
    thumbPiano:   { t: 'a thumb-piano ostinato accent', d: 'A' },
    bellChime:    { t: 'a struck metal bell chime', d: 'A' },
    harpGliss:    { t: 'a harp glissando', d: 'A' },
    fluteFlourish:{ t: 'a short flute flourish', d: 'A' },
    marimbaAccent:{ t: 'a marimba accent figure', d: 'A' },
    steelPanAccent:{ t: 'a steel-pan accent', d: 'A' },
    brassStab:    { t: 'a brass stab accent', d: 'A' },
    cimbalomRun:  { t: 'a cimbalom ornament run', d: 'A' },
    synthStab:    { t: 'a filtered synth stab', d: 'E' },
    reversedStab: { t: 'a reversed synth-stab accent', d: 'E' },
    bellArp:      { t: 'a bell-synth arpeggio sparkle', d: 'E' },
    gongSwell:    { t: 'a gong swell', d: 'A' },
  },
  movement: {
    delayThrows:  { t: 'tempo-synced delay throws', d: 'E' },
    dubDelay:     { t: 'dub delay echoes trailing the chant', d: 'E' },
    filterSweep:  { t: 'a slow filter sweep across the pads', d: 'E' },
    reverbTail:   { t: 'a long reverb tail', d: 'E' },
    autopan:      { t: 'a wide stereo autopan', d: 'E' },
    risers:       { t: 'filtered-noise risers into the lift', d: 'E' },
    tapeEcho:     { t: 'analog tape-echo repeats', d: 'E' },
    stringSwell:  { t: 'sweeping string swells', d: 'A' },
    vocalChops:   { t: 'stuttered vocal-chop edits', d: 'E' },
    sidechainPump:{ t: 'a pumping sidechained pad rhythm', d: 'E' },
    breakdown:    { t: 'a stripped breakdown before the lift', d: 'B' },
    pitchGlide:   { t: 'a slow pitch-bending pad glide', d: 'E' },
  },
};

// Drum pools are kept ENTIRELY separate from the instrument palette (project rule).
const DRUMS = {
  downtempo:  ['a soft downtempo breakbeat','a laid-back trip-hop groove with hand percussion','a mellow programmed beat with shakers and congas','a slow half-time groove under a djembe'],
  worldbeat:  ['a mid-tempo programmed beat with djembe and talking drum','a syncopated worldbeat groove with hand percussion','a breakbeat laced with tribal percussion'],
  balkanbeat: ['a steady mid-tempo programmed groove with tabla and frame drum','a mid-tempo programmed groove with tambourine and hand percussion','an even mid-tempo groove with dumbek and light hand percussion'],
  carnival:   ['a rolling conga-and-timbale carnival groove','an Afro-Cuban percussion groove with congas and guiro','a live-feel Latin percussion groove with bongos and shakers'],
  tribalHouse:['a four-on-the-floor house beat with tribal percussion','a driving house groove with djembe and shakers','a punchy club beat with layered hand percussion'],
  tribalOrganic:['a rolling djembe-and-talking-drum groove','a layered hand-percussion groove with shakers and log drum','an organic tribal drum groove with congas and frame drum','a loping djembe groove with woven hand percussion'],
};

const r = (role, ...keys) => keys.map(k => P[role][k]);

const CHARACTERS = {
  forestNocturne: {
    label: 'Forest Nocturne', source: 'Deep Forest (twilight interludes)',
    genre: 'Deep Forest Style, ethno-ambient world music',
    beatless: true, energy: 'low', colorChance: 0.5,
    drums: { primary: null, secondary: null },
    pools: {
      pads:     r('pads','forestDrone','warmAnalogPad','synthStringPad','choirPad','glassPad','bellPad'),
      bass:     r('bass','pedalDrone','subBass','celloLow','fretlessBass'),
      harmony:  r('harmony','droneTonic','pentatonic','modalMinor','aeolianClose','plagalHome'),
      voice:    r('voice','loneLullaby','wordlessChoir','pygmyHocket','breathyFemale','maleTribalCall'),
      lead:     r('lead','kalimba','woodenFlute','panpipes','ocarinaLead','marimbaLead'),
      color:    r('color','thumbPiano','bellChime','harpGliss','marimbaAccent','gongSwell'),
      movement: r('movement','reverbTail','delayThrows','pitchGlide','autopan','stringSwell'),
    },
  },
  sweetChillout: {
    label: 'Sweet Chillout', source: 'Deep Forest (Sweet Lullaby / White Whisper)',
    genre: 'Deep Forest Style, ethnic-electronica downtempo chillout',
    beatless: false, bpm: [86,98], energy: 'low to medium', colorChance: 0.5,
    drums: { primary: 'downtempo', secondary: 'worldbeat' },
    pools: {
      pads:     r('pads','warmAnalogPad','synthStringPad','marimbaBed','choirPad','rhodesBed','bellPad'),
      bass:     r('bass','dubBass','subBass','fretlessBass','balafonBass','pluckedBass'),
      harmony:  r('harmony','suspendedLoop','pentatonic','minorToMajor','majorLift','droneTonic'),
      voice:    r('voice','loneLullaby','breathyFemale','pygmyHocket','chantHook','wordlessChoir'),
      lead:     r('lead','kalimba','panpipes','rhodesFigure','synthLead','marimbaLead'),
      color:    r('color','thumbPiano','bellChime','harpGliss','marimbaAccent','bellArp'),
      movement: r('movement','dubDelay','delayThrows','reverbTail','autopan','tapeEcho','pitchGlide'),
    },
  },
  bohemianFusion: {
    label: 'Bohemian Fusion', source: 'Boheme (Marta\u2019s Song / Freedom Cry)',
    genre: 'Deep Forest Style, Eastern European folk-electronica',
    beatless: false, bpm: [100,110], energy: 'medium', colorChance: 0.55,
    // TEMPO GUARD: fast Balkan folk playing over a breakbeat made Suno double-time into
    // jungle/DnB mid-song. Breakbeat removed from the drum family; tempo pinned here.
    tempoLock: 'one steady constant tempo held from start to finish',
    negative: ['drum and bass','jungle','breakcore','breakbeat','double-time','half-time switch',
               'tempo change','speeding up','accelerando','gabber','hardcore rave'],
    drums: { primary: 'balkanbeat', secondary: 'worldbeat' },
    pools: {
      pads:     r('pads','accordionDrone','stringSection','synthStringPad','hybridWash','choirPad','rhodesBed'),
      bass:     r('bass','uprightBass','subBass','celloLow','fretlessBass','seqBass'),
      harmony:  r('harmony','romaniMinor','modalMinor','minorToMajor','risingProg','aeolianClose'),
      voice:    r('voice','hungarianFolk','bulgarianHarm','romaniLament','wordlessChoir','breathyFemale','chantHook'),
      lead:     r('lead','cimbalom','folkViolin','accordionLead','balkanClarinet','gypsyGuitar'),
      color:    r('color','cimbalomRun','harpGliss','bellChime','synthStab','fluteFlourish'),
      movement: r('movement','delayThrows','stringSwell','tapeEcho','autopan','filterSweep','reverbTail'),
    },
  },
  comparsaCarnival: {
    label: 'Comparsa Carnival', source: 'Comparsa (Madazulu / Comparsa)',
    genre: 'Deep Forest Style, Afro-Cuban worldbeat carnival',
    beatless: false, bpm: [108,118], energy: 'medium to high', colorChance: 0.6,
    drums: { primary: 'carnival', secondary: 'worldbeat' },
    pools: {
      pads:     r('pads','marimbaBed','rhodesBed','nylonBed','warmAnalogPad','bellPad','choirPad'),
      bass:     r('bass','tumbaoBass','uprightBass','fretlessBass','subBass','balafonBass'),
      harmony:  r('harmony','montuno','majorLift','suspendedLoop','risingProg','modalMinor'),
      voice:    r('voice','afroCubanCall','carnivalGroup','ululation','maleTribalCall','chantHook','forestYodel'),
      lead:     r('lead','steelPan','nylonGuitar','latinBrass','marimbaLead','rhodesFigure','balafon'),
      color:    r('color','steelPanAccent','brassStab','marimbaAccent','bellChime','harpGliss'),
      movement: r('movement','delayThrows','breakdown','tapeEcho','autopan','stringSwell','filterSweep'),
    },
  },
  tribalWorldbeat: {
    label: 'Tribal Worldbeat', source: 'Deep Forest / Savana Dance, Hunting (album versions)',
    genre: 'Deep Forest Style, organic tribal worldbeat',
    beatless: false, bpm: [104,116], energy: 'medium to high', colorChance: 0.5,
    // The tribal character WITHOUT the club mix: organic percussion only, no house kit,
    // no four-on-the-floor, no dance-floor production.
    negative: ['house music','four-on-the-floor club beat','club remix','EDM drop',
               'techno','trance','dance remix','sidechain pumping'],
    drums: { primary: 'tribalOrganic', secondary: 'worldbeat' },
    pools: {
      pads:     r('pads','forestDrone','warmAnalogPad','choirPad','synthStringPad','hybridWash','bellPad'),
      bass:     r('bass','balafonBass','fretlessBass','subBass','pluckedBass','pedalDrone'),
      harmony:  r('harmony','pentatonic','modalMinor','suspendedLoop','droneTonic','risingProg'),
      voice:    r('voice','pygmyHocket','maleTribalCall','forestYodel','ululation','chantHook'),
      lead:     r('lead','balafon','kalimba','woodenFlute','marimbaLead','ocarinaLead','panpipes'),
      color:    r('color','thumbPiano','bellChime','gongSwell','marimbaAccent','harpGliss'),
      movement: r('movement','dubDelay','delayThrows','tapeEcho','filterSweep','reverbTail','breakdown'),
    },
  },
  tribalDance: {
    label: 'Tribal Dance', source: 'Deep Forest / Savana Dance (club mixes)',
    genre: 'Deep Forest Style, tribal house dance',
    beatless: false, bpm: [120,130], energy: 'high', colorChance: 0.45,
    drums: { primary: 'tribalHouse', secondary: 'worldbeat' },
    pools: {
      pads:     r('pads','glassPad','warmAnalogPad','bellPad','synthStringPad','choirPad','hybridWash'),
      bass:     r('bass','houseBass','seqBass','subBass','pluckedBass','dubBass'),
      harmony:  r('harmony','modalMinor','risingProg','majorLift','suspendedLoop','minorToMajor'),
      voice:    r('voice','chantStabs','chantHook','pygmyHocket','forestYodel','ululation','maleTribalCall'),
      lead:     r('lead','housePiano','synthArp','synthLead','kalimba','balafon','marimbaLead'),
      color:    r('color','synthStab','reversedStab','bellArp','thumbPiano','marimbaAccent'),
      movement: r('movement','sidechainPump','risers','vocalChops','delayThrows','filterSweep','breakdown'),
    },
  },
};

// Interaction/interplay language — WOVEN into the style string (standing project rule).
const INTERPLAY = {
  forestNocturne: {
    conversation: ['answering each other across a wide open space','stating the theme alone then dissolving back into the drone',
                   'trading slow phrases with the pad in call-and-response'],
    foundation:   ['holding a single low centre while everything floats above','sustaining beneath the melody without ever pushing',
                   'anchoring the drone as the upper voices drift'],
    arc:          ['opening one voice at a time with air around each','swelling gently then settling back to stillness',
                   'resolving at last onto a sustained tonic chord','easing into a slow resolving cadence as it closes'],
    voiceRel:     ['floating far back in the reverb','carried alone over the drone','answered in soft layered harmony'],
    colorRel:     ['glinting in the quiet spaces','ringing once into the open air','marking the turn of the phrase'],
  },
  sweetChillout: {
    conversation: ['weaving around the chant without crowding it','answered by the vocal hook on every second bar',
                   'trading gentle phrases with the pads over the groove','locking with the chant loop in a rolling weave'],
    foundation:   ['rolling deep and unhurried under the vocal','sitting low in the pocket while the melody breathes',
                   'anchoring the groove as the chant floats above'],
    arc:          ['building layer by layer then stripping back to the voice','swelling into a warm lift then easing home',
                   'resolving onto a warm final chord','settling into a resolved closing cadence'],
    voiceRel:     ['floating over the groove','looping hypnotically against the beat','answering the melody in close harmony'],
    colorRel:     ['sparkling between the phrases','tracing the top of the harmony','answering the vocal hook'],
  },
  bohemianFusion: {
    conversation: ['trading phrases with the folk voice in call-and-response','ornamenting around the vocal line as it rises',
                   'answering the melody with a keening counterline','locking with the pads while the folk voice leads'],
    foundation:   ['walking steadily beneath the breakbeat','driving the groove forward under the folk melody',
                   'holding the low centre while the ornaments fly above'],
    arc:          ['building from a solo voice to a full folk-electronic weave','lifting through each verse toward a soaring chorus',
                   'opening out into a resolved final chorus','resolving the lament onto a settled tonic'],
    voiceRel:     ['carrying the melody with raw folk edge','soaring over the steady groove','answering the lead in open harmony'],
    colorRel:     ['flashing across the top of the groove','ornamenting the turnaround','punctuating the phrase ends'],
  },
  comparsaCarnival: {
    conversation: ['trading calls with the percussion in a carnival weave','answered by the brass on the turnaround',
                   'locking with the montuno vamp in bright unison','riding over the congas answered by the chorus'],
    foundation:   ['locking with the congas in a syncopated pocket','pushing the procession forward beneath the chorus',
                   'swinging under the groove while the melody dances above'],
    arc:          ['building the procession from one drum to a full carnival','stacking voices and percussion to a joyful peak',
                   'released into a bright resolved final chorus','landing the carnival on a resolved major chord'],
    voiceRel:     ['calling out over the percussion','answered by the crowd on the refrain','trading the foreground with the lead'],
    colorRel:     ['flashing over the groove','punctuating the downbeats','answering the brass hits'],
  },
  tribalWorldbeat: {
    conversation: ['interlocking with the hand percussion in a rolling weave','answered by the chant across the groove',
                   'trading phrases with the drums in call-and-response','riding the djembe as the chant answers'],
    foundation:   ['locking with the drums in a deep organic pocket','rolling forward beneath the massed chant',
                   'anchoring the groove while the percussion breathes above'],
    arc:          ['building from one drum to a full tribal weave','layering voices and percussion toward an open peak',
                   'released from the break into a resolved final chorus','landing the procession on a resolved tonic'],
    voiceRel:     ['calling out over the drums','interlocking with the percussion','answered by the group in call-and-response'],
    colorRel:     ['ringing across the groove','marking the turn of the phrase','answering the drums'],
  },
  tribalDance: {
    conversation: ['interlocking with the chant stabs in a driving weave','answered by its own delayed repeats',
                   'stabbing against the pulse as the chant answers','climbing over the four-on-the-floor pulse'],
    foundation:   ['locked tight and propulsive under the layers','pumping relentless beneath the chant',
                   'driving the floor while the percussion rolls above'],
    arc:          ['building through the breakdown into a full-energy lift','stacking percussion toward an open peak',
                   'released from the break into a resolved euphoric chorus','resolving the drive onto a bright final chord'],
    voiceRel:     ['chopped rhythmically against the pulse','riding high over the drive','looping hypnotically through the groove'],
    colorRel:     ['sparking over the groove','accenting the lift','flickering between the beats'],
  },
};

export const DEEPFOREST = {
  // ethnic-electronica: the lead pool carries the signature instrument, so a
  // composer overlay's melodic trait is added as a second voice, never a swap.
  signatureLead: true,
  id: 'Deep Forest',
  styleAnchor: 'Deep Forest Style',
  master: P,
  drums: DRUMS,
  characters: CHARACTERS,
  interplay: INTERPLAY,
  sourceNegative: [
    'radio pop','cheesy pop hooks','rap verse','trap hi-hats','EDM festival drop',
    'supersaw stacks','chiptune','autotuned vocals','heavy metal','distorted electric guitar',
    'rock drums','orchestral fanfare',
  ],
  order: ['pads','harmony','bass','drums','voice','lead','color','movement'],
};

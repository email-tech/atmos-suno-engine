// GENERATED — do not edit. Build with: node build.mjs
window.__ATMOS = window.__ATMOS || {};

/* core/constants.js */
(function(){
const ALWAYS_BAN = [
  'field recordings','air texture','room tone','foley','sound effects',
  'vinyl crackle','tape hiss','nature sounds','ambient noise',
];
const BEATLESS_BAN = ['drums','kick','beat','percussion','snare'];
const MASTERING = 'Polished Dolby Atmos-Master Atmos -2dB.';
const CHAR_LIMIT = 1000;

// deterministic RNG so a seed reproduces an arrangement (needed for re-roll + locks)
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

// palette filter: keep options that fit the chosen palette; never empty a role
function filterPalette(options, palette) {
  const keep = options.filter(o =>
    palette === 'blend' ? true :
    palette === 'electronic' ? (o.d === 'E' || o.d === 'B') :
    /* acoustic */ (o.d === 'A' || o.d === 'B'));
  return keep.length ? keep : options;
}

Object.assign(window.__ATMOS, { rng, filterPalette, ALWAYS_BAN, BEATLESS_BAN, MASTERING, CHAR_LIMIT });
})();

/* core/resolver.js */
(function(){
const {ALWAYS_BAN, BEATLESS_BAN, MASTERING, CHAR_LIMIT, rng, filterPalette} = window.__ATMOS;

// opts: { characterId, palette:'electronic'|'acoustic'|'blend', locks:{role:text}, seed }
// locks drive all three control levels:
//   randomize all  = locks {}
//   lock some      = locks {pads:'...'}
//   full manual    = every role locked
function resolveArrangement(engine, opts) {
  const { characterId, palette = 'electronic', locks = {}, seed = Date.now() } = opts;
  const c = engine.characters[characterId];
  if (!c) throw new Error(`unknown character ${characterId}`);
  const rand = rng(seed);
  const pick = (role) => {
    if (locks[role] != null) return locks[role];
    const pool = filterPalette(c.pools[role] || [], palette);
    if (!pool.length) return null;
    return pool[Math.floor(rand() * pool.length)].t;
  };

  const arr = {
    engine: engine.id,
    character: c.label,
    genre: c.genre,
    beatless: !!c.beatless,
    bpm: c.bpm || null,
    energy: c.energy,
    pads: pick('pads'),
    harmony: pick('harmony'),
    bass: pick('bass'),
    voice: pick('voice'),
    lead: pick('lead'),
    movement: pick('movement'),
    color: null,
    drums: null,
    negative: c.negative || null,   // optional per-character bans (e.g. Era Driving Epic: no rock/metal)
  };

  // drums (skip when beatless)
  if (!c.beatless && c.drums.primary) {
    const fam = engine.drums[c.drums.primary];
    arr.drums = fam[Math.floor(rand() * fam.length)];
  }
  // colour fires occasionally
  if (rand() < c.colorChance) arr.color = pick('color');

  // interplay / arrangement layer — WOVEN into the style string (per John's Suno test).
  // role-generic tails that hang off already-named instruments (never re-name one).
  const ipPool = (engine.interplay && engine.interplay[characterId]) || {};
  const one = (dim) => (ipPool[dim] && ipPool[dim].length)
    ? ipPool[dim][Math.floor(rand() * ipPool[dim].length)] : null;
  arr.ip = {
    foundation:   one('foundation'),
    conversation: one('conversation'),
    arc:          one('arc'),
    voiceRel:     one('voiceRel'),
    colorRel:     one('colorRel'),
  };

  return arr;
}

// STYLE STRING = full woven cast (the approved gold-standard format). Instruments are
// threaded with their interplay inline, in musical layers, not a flat tag list:
//   genre -> tempo -> [drums+bass+foundation] -> [pads+lead+conversation] -> harmony
//         -> [voice+voiceRel] -> [colour+colourRel if it fires] -> [movement+arc] -> mastering
function renderStyle(engine, arr) {
  const ip = arr.ip || {};
  const clauses = [arr.genre];

  // tempo + energy
  clauses.push(arr.beatless
    ? `beatless, ${arr.energy} energy`
    : `${arr.bpm[0]}-${arr.bpm[1]} BPM, ${arr.energy} energy`);

  // foundation: drums(+)bass + how they lock/float
  if (arr.bass) {
    const low = arr.drums ? `${arr.drums} and ${arr.bass}` : arr.bass;
    clauses.push(ip.foundation ? `${low} ${ip.foundation}` : low);
  } else if (arr.drums) {
    clauses.push(ip.foundation ? `${arr.drums} ${ip.foundation}` : arr.drums);
  }

  // conversation: pads + lead + how they relate
  if (arr.pads && arr.lead) {
    clauses.push(ip.conversation ? `${arr.pads} with ${arr.lead} ${ip.conversation}`
                                 : `${arr.pads} with ${arr.lead}`);
  } else if (arr.pads) {
    clauses.push(arr.pads);
  } else if (arr.lead) {
    clauses.push(arr.lead);
  }

  // harmony (musicality slot — its own clause)
  if (arr.harmony) clauses.push(arr.harmony);

  // voice + how it sits
  if (arr.voice) clauses.push(ip.voiceRel ? `${arr.voice} ${ip.voiceRel}` : arr.voice);

  // colour (only when it fired) + how it sits
  if (arr.color) clauses.push(ip.colorRel ? `${arr.color} ${ip.colorRel}` : arr.color);

  // production movement + the arc of the whole arrangement
  if (arr.movement) clauses.push(ip.arc ? `${arr.movement} and ${ip.arc}` : arr.movement);
  else if (ip.arc) clauses.push(ip.arc);

  return clauses.join(', ') + '. ' + MASTERING;
}

function renderNegative(engine, arr) {
  const bans = [...engine.sourceNegative, ...ALWAYS_BAN];
  if (arr.negative) bans.push(...arr.negative);
  if (arr.beatless) bans.push(...BEATLESS_BAN);
  return [...new Set(bans)].join(', ');
}

function build(engine, opts) {
  const arr = resolveArrangement(engine, opts);
  const style = renderStyle(engine, arr);
  return { arrangement: arr, style, negative: renderNegative(engine, arr), length: style.length,
           overLimit: style.length > CHAR_LIMIT };
}

Object.assign(window.__ATMOS, { resolveArrangement, renderStyle, renderNegative, build });
})();

/* engines/delerium.js */
(function(){
// Delerium engine — album-era (Faces -> Semantic Spaces -> Karma -> Poem).
// NOT the trance-remix identity. Domains: 'E' electronic, 'A' acoustic, 'B' both.
//
// Rewrite (2026-07-09): fix "tempo was the only real change". Two changes:
//   1) Pools DEEPENED to album-scale and DE-OVERLAPPED so each character owns a
//      distinct pad / vocal / movement signature (Sacred/Ethereal/Firefly no longer
//      share cathedral-pad + vocoder + delay-throws).
//   2) Interplay restructured as attach-clauses (tails that hang off already-named
//      instruments) so the resolver can WEAVE it into the style string per the
//      approved gold-standard format — never re-naming an instrument.

const P = {
  pads: {
    cathedralPad:  { t: 'slowly swelling cathedral-reverb analog pad', d: 'E' },
    darkDrone:     { t: 'dark evolving drone bed', d: 'E' },
    glassyPad:     { t: 'glassy digital pad with shimmering high partials', d: 'E' },
    stringWash:    { t: 'warm string-synth wash', d: 'E' },
    metallicDrone: { t: 'bowed metallic drone', d: 'B' },
    reversedPad:   { t: 'reversed pad swell into the downbeat', d: 'E' },
    harmoniumDrone:{ t: 'sustained harmonium drone', d: 'A' },
    celloDroneBed: { t: 'bowed cello drone bed', d: 'A' },
    choirPad:      { t: 'sustained wordless choir pad', d: 'E' },
    analogueSwell: { t: 'warm analogue polysynth swell', d: 'E' },
    glacialPad:    { t: 'glacial slow-attack ambient pad', d: 'E' },
    tanpuraBed:    { t: 'shimmering tanpura drone bed', d: 'A' },
    feltMalletBed: { t: 'soft felt-mallet resonant bed', d: 'A' },
    jarrePad:      { t: 'spacey analog Jarre-style lead pad', d: 'E' },
    broodingPad:   { t: 'brooding dark atmospheric synth pad', d: 'E' },
    mellotronBed:  { t: 'Mellotron choir-and-flute pad', d: 'B' },
    fmCrystalPad:  { t: 'glassy FM crystalline pad', d: 'E' },
    warmStringEns: { t: 'warm sampled-string ensemble pad', d: 'B' },
    airVocalPad:   { t: 'airy layered vocal-synth pad', d: 'E' },
  },
  bass: {
    subBass:    { t: 'deep sustained sub-bass', d: 'E' },
    seqBass:    { t: 'sequenced synth bass pulsing eighth notes', d: 'E' },
    analogBass: { t: 'slow legato round analog bass', d: 'E' },
    fretless:   { t: 'fretless bass glide', d: 'B' },
    upright:    { t: 'slow plucked upright acoustic bass', d: 'A' },
    oudLow:     { t: 'low oud register', d: 'A' },
    pulsingBass:{ t: 'pulsing filtered synth bass', d: 'E' },
    warmSine:   { t: 'warm sine sub with a soft attack', d: 'E' },
    seqDriveBass:{ t: 'rolling sequenced bassline driving the groove', d: 'E' },
    filterBass: { t: 'warm filtered analog bassline', d: 'E' },
    dubBass:    { t: 'deep dub bassline with a long decay', d: 'E' },
  },
  lead: {
    duduk:     { t: 'sustained duduk lead', d: 'A' },
    bambooFl:  { t: 'bamboo flute motif', d: 'A' },
    piano:     { t: 'sparse grand-piano figure', d: 'A' },
    synthArp:  { t: 'plucked synth arpeggio lead', d: 'E' },
    sitar:     { t: 'sitar melodic phrase', d: 'A' },
    celloLead: { t: 'long-phrased bowed cello lead', d: 'A' },
    fmBell:    { t: 'glassy FM bell lead', d: 'E' },
    detunedLd: { t: 'detuned analog synth lead with slow portamento', d: 'E' },
    panFlute:  { t: 'breathy pan-flute melody', d: 'A' },
    ney:       { t: 'reedy ney flute lead', d: 'A' },
    erhu:      { t: 'bowed erhu melodic line', d: 'A' },
    ebowGuitar:{ t: 'ebow sustained guitar lead', d: 'B' },
    glassPluck:{ t: 'glassy plucked digital lead', d: 'E' },
    harpFigure:{ t: 'a plucked harp figure', d: 'A' },
    nylonGtr:  { t: 'a nylon acoustic-guitar motif', d: 'A' },
    shakuhachi:{ t: 'a breathy shakuhachi flute lead', d: 'A' },
    bansuri:   { t: 'a bansuri bamboo-flute melody', d: 'A' },
  },
  harmony: {
    minorModal:{ t: 'slow minor-modal chord changes', d: 'B' },
    suspended: { t: 'suspended chords resolving on the chorus lift', d: 'B' },
    droneTonic:{ t: 'an unresolved static drone-tonic', d: 'B' },
    add9:      { t: 'lush add9 chord voicings', d: 'B' },
    phrygian:  { t: 'a dark phrygian cadence', d: 'B' },
    majorLift: { t: 'a major-key chord lift on the chorus', d: 'B' },
    plagalCadence:{ t: 'a plagal cadence resolving to the tonic', d: 'B' },
    modalResolve: { t: 'a modal cadence landing on the root', d: 'B' },
    minorToMajor: { t: 'a minor-to-relative-major resolution on the chorus', d: 'B' },
    risingProg:   { t: 'a rising chord progression that resolves upward', d: 'B' },
    sacredCadence:{ t: 'a sacred choral cadence resolving on the final chord', d: 'B' },
  },
  voice: {
    latinChant:   { t: 'distant monastic Latin chant', d: 'A' },
    femaleWash:   { t: 'an ethereal wordless female vocal wash', d: 'A' },
    euroChoir:    { t: 'an Eastern-European choir texture', d: 'A' },
    throatChant:  { t: 'a throat-overtone chant drone', d: 'A' },
    vocalChops:   { t: 'rhythmic sampled ethnic vocal chops', d: 'B' },
    vocoderPad:   { t: 'a vocoded wordless vocal pad', d: 'E' },
    granularVox:  { t: 'a granular stretched-vocal drone', d: 'E' },
    sanskritChant:{ t: 'distant Sanskrit vocal chant', d: 'A' },
    breathyFemale:{ t: 'a breathy close female vocal texture', d: 'A' },
    maleDrone:    { t: 'a low male vocal drone', d: 'A' },
    childChoir:   { t: "a distant children's choir wash", d: 'A' },
    gregorianMale:{ t: 'Gregorian-style male chant', d: 'A' },
    liveChoirSwell:{ t: 'a live choir swell', d: 'A' },
    femaleHarmony: { t: 'layered ethereal female vocal harmonies', d: 'A' },
    bakaChant:     { t: 'a Baka-forest-style pygmy chant', d: 'A' },
    prayerCall:    { t: 'a distant call-to-prayer melisma', d: 'A' },
  },
  color: {
    fingerCymb: { t: 'finger cymbals and bells', d: 'A' },
    dulcimer:   { t: 'a hammered dulcimer run', d: 'A' },
    sarangi:    { t: 'a bowed sarangi ornament', d: 'A' },
    gong:       { t: 'a gong swell', d: 'A' },
    kalimba:    { t: 'a kalimba figure', d: 'A' },
    bellArp:    { t: 'a bell-synth arpeggio sparkle', d: 'E' },
    revStab:    { t: 'a reversed synth-stab accent', d: 'E' },
    windChimes: { t: 'a wind-chime shimmer', d: 'A' },
    santoor:    { t: 'a santoor tremolo run', d: 'A' },
    prepPiano:  { t: 'a prepared-piano pluck', d: 'A' },
    glocken:    { t: 'a glockenspiel sparkle', d: 'B' },
    harpGliss:  { t: 'a harp glissando', d: 'A' },
    handDrumFill:{ t: 'a tuned hand-drum fill', d: 'A' },
    tambShaker: { t: 'tambourine and shaker accents', d: 'A' },
    tablaFill:  { t: 'a tabla fill', d: 'A' },
  },
  movement: {
    filterLFO:   { t: 'a slow filter LFO sweep', d: 'E' },
    delayThrows: { t: 'tempo-synced delay throws', d: 'E' },
    autopan:     { t: 'a wide stereo autopan', d: 'E' },
    reversedTr:  { t: 'reversed-swell transitions', d: 'E' },
    reverbTail:  { t: 'a long cathedral reverb tail', d: 'E' },
    tremoloSwell:{ t: 'tremolo bowed-string swells', d: 'A' },
    handCresc:   { t: 'rolling hand-percussion crescendos', d: 'A' },
    dubEcho:     { t: 'dub delay echoes as a second voice', d: 'E' },
    risers:      { t: 'filtered-noise risers into the lift', d: 'E' },
    panSweep:    { t: 'a slow stereo pan sweep', d: 'E' },
    phaserSweep: { t: 'a slow phaser sweep across the pads', d: 'E' },
    flangeVocal: { t: 'a flanged sweep on the vocal', d: 'E' },
    tapeEcho:    { t: 'analog tape-echo repeats', d: 'E' },
    filterGate:  { t: 'a rhythmic filter-gate pulse', d: 'E' },
  },
};

const DRUMS = {
  worldbeat: ['deep frame drum','a tabla pattern','a dumbek groove','a hand-played djembe','congas and shakers with tambourine'],
  softDown:  ['a subdued soft programmed kick','a brushed programmed snare','a trip-hop-leaning downtempo groove','a soft measured downtempo beat'],
  firefly:   ['a denser driving programmed pulse','a propulsive sequenced groove'],
  hybrid:    ['a programmed kick under live hand percussion','a downtempo beat laced with hand percussion'],
};

const r = (role, ...keys) => keys.map(k => P[role][k]);

const CHARACTERS = {
  gothicAmbient: {
    label: 'Gothic Ambient', source: 'Faces / Morpheus',
    genre: 'Delerium Style, dark ritual ambient',
    beatless: true, energy: 'low', colorChance: 0.5,
    drums: { primary: null, secondary: null },
    pools: {
      pads:     r('pads','darkDrone','metallicDrone','glacialPad','celloDroneBed','broodingPad','mellotronBed'),
      bass:     r('bass','subBass','fretless','warmSine','dubBass','filterBass'),
      harmony:  r('harmony','droneTonic','phrygian','modalResolve','sacredCadence'),
      voice:    r('voice','throatChant','granularVox','maleDrone','bakaChant','prayerCall'),
      lead:     r('lead','celloLead','ebowGuitar','ney','shakuhachi'),
      color:    r('color','gong','windChimes','prepPiano','harpGliss'),
      movement: r('movement','reversedTr','reverbTail','tremoloSwell','phaserSweep','tapeEcho'),
    },
  },
  worldbeatRitual: {
    label: 'Worldbeat Ritual', source: 'Semantic Spaces',
    genre: 'Delerium Style, worldbeat downtempo, tribal ethereal',
    beatless: false, bpm: [84,96], energy: 'low to medium', colorChance: 0.55,
    drums: { primary: 'worldbeat', secondary: null },
    pools: {
      pads:     r('pads','harmoniumDrone','tanpuraBed','darkDrone','mellotronBed','broodingPad'),
      bass:     r('bass','subBass','oudLow','upright','dubBass','filterBass'),
      harmony:  r('harmony','droneTonic','minorModal','phrygian','modalResolve','sacredCadence'),
      voice:    r('voice','euroChoir','sanskritChant','throatChant','vocalChops','bakaChant','liveChoirSwell','prayerCall'),
      lead:     r('lead','duduk','bambooFl','sitar','ney','erhu','bansuri','shakuhachi','harpFigure'),
      color:    r('color','fingerCymb','dulcimer','sarangi','santoor','tablaFill','handDrumFill','tambShaker','harpGliss'),
      movement: r('movement','filterLFO','handCresc','dubEcho','tapeEcho','filterGate'),
    },
  },
  sacredDowntempo: {
    label: 'Sacred Downtempo', source: 'Silence / Karma',
    genre: 'Delerium Style, sacred ethereal downtempo',
    beatless: false, bpm: [92,100], energy: 'medium', colorChance: 0.45,
    drums: { primary: 'softDown', secondary: 'hybrid' },
    pools: {
      pads:     r('pads','cathedralPad','harmoniumDrone','choirPad','feltMalletBed','warmStringEns','mellotronBed'),
      bass:     r('bass','subBass','upright','warmSine','filterBass','dubBass'),
      harmony:  r('harmony','minorModal','suspended','add9','sacredCadence','plagalCadence','minorToMajor'),
      voice:    r('voice','latinChant','gregorianMale','childChoir','femaleWash','liveChoirSwell','femaleHarmony','prayerCall'),
      lead:     r('lead','piano','duduk','celloLead','panFlute','harpFigure','nylonGtr','shakuhachi'),
      color:    r('color','fingerCymb','glocken','prepPiano','harpGliss','handDrumFill','tambShaker'),
      movement: r('movement','delayThrows','reversedTr','reverbTail','phaserSweep','tapeEcho'),
    },
  },
  ethereal: {
    label: 'Ethereal', source: 'Innocente / Poem',
    genre: 'Delerium Style, ethereal downtempo electronica',
    beatless: false, bpm: [100,112], energy: 'medium', colorChance: 0.4,
    drums: { primary: 'softDown', secondary: 'hybrid' },
    pools: {
      pads:     r('pads','cathedralPad','glassyPad','stringWash','analogueSwell','jarrePad','fmCrystalPad','airVocalPad'),
      bass:     r('bass','analogBass','upright','warmSine','fretless','seqDriveBass','filterBass'),
      harmony:  r('harmony','suspended','add9','majorLift','minorToMajor','risingProg','plagalCadence'),
      voice:    r('voice','femaleWash','breathyFemale','vocoderPad','granularVox','femaleHarmony','liveChoirSwell'),
      lead:     r('lead','piano','synthArp','detunedLd','glassPluck','ebowGuitar','nylonGtr','harpFigure','shakuhachi'),
      color:    r('color','kalimba','bellArp','glocken','harpGliss','tambShaker'),
      movement: r('movement','delayThrows','autopan','dubEcho','panSweep','phaserSweep','flangeVocal','tapeEcho'),
    },
  },
  firefly: {
    label: 'Firefly', source: 'Euphoria',
    genre: 'Delerium Style, driving ethereal downtempo',
    beatless: false, bpm: [112,126], energy: 'medium to high', colorChance: 0.4,
    drums: { primary: 'firefly', secondary: 'hybrid' },
    pools: {
      pads:     r('pads','glassyPad','reversedPad','analogueSwell','choirPad','fmCrystalPad','airVocalPad','jarrePad'),
      bass:     r('bass','seqBass','pulsingBass','subBass','seqDriveBass','filterBass','dubBass'),
      harmony:  r('harmony','suspended','majorLift','minorModal','risingProg','minorToMajor'),
      voice:    r('voice','vocoderPad','breathyFemale','vocalChops','femaleWash','femaleHarmony','liveChoirSwell'),
      lead:     r('lead','synthArp','fmBell','detunedLd','glassPluck'),
      color:    r('color','bellArp','revStab','glocken','harpGliss'),
      movement: r('movement','delayThrows','autopan','risers','panSweep','flangeVocal','tapeEcho','filterGate'),
    },
  },
};

const INTERPLAY = {
  gothicAmbient: {
    conversation: ['surfacing alone against deep space then dissolving back into the texture',
                   'emerging and receding without hierarchy each equal in the field',
                   'cross-fading so the melody dissolves into atmosphere'],
    foundation:   ['holding a single harmonic centre with everything suspended above',
                   'anchoring in slow motion while the timbres drift unmoving'],
    arc:          ['evolving so slowly that change is felt rather than heard',
                   'replacing motion with the slow turn of timbre',
                   'sustaining tension through what never resolves',
                   'finally settling onto a single resolved chord',
                   'resolving at last into a sustained tonic'],
    voiceRel:     ['drifting over the top without hierarchy','breathing at the edge of the field','hanging in the deep reverb'],
    colorRel:     ['ringing once into the silence','surfacing briefly then gone'],
  },
  worldbeatRitual: {
    conversation: ['trading phrases over the percussion','stating the melody while the wash breathes beneath',
                   'answered now and then by an ornament rising through the mix'],
    foundation:   ['locked with the hand drums in a rolling ritual pocket',
                   'interlocking in a loose earthy groove','anchoring while the hand drums drive above'],
    arc:          ['building the ritual organically as voices layer in one at a time',
                   'swelling and receding in long ceremonial waves','rising through added hand drums then opening back to space',
                   'resolving the ritual onto a final grounded chord'],
    voiceRel:     ['breathing beneath the lead','chanting in the distance','layering in call-and-response with the flute'],
    colorRel:     ['ornamenting the gaps between phrases','sparkling through the ritual','answering the drums'],
  },
  sacredDowntempo: {
    conversation: ['rising together then answered by soft chord swells','hanging over the chant with space between statements',
                   'trading the foreground unhurried'],
    foundation:   ['locked in a slow reverent pocket','sustaining long tones beneath the pads anchoring without intruding',
                   'holding steady while the low end floats'],
    arc:          ['stacking toward a lush sacred peak then receding','opening gradually with each voice given room to breathe',
                   'built through rising harmony then released into open sustained chords',
                   'resolving into a lush final cadence'],
    voiceRel:     ['answering the lead from the reverb','rising over the chant','trading the foreground with the melody'],
    colorRel:     ['marking the phrase ends','threading through the sacred space','answering the choir'],
  },
  ethereal: {
    conversation: ['trading phrases in warm ethereal dialogue','floating free over the harmony',
                   'drifting over the chords answered by a second voice'],
    foundation:   ['rolling forward in a smooth unhurried pocket','gliding beneath the pulse tied to the cycle above',
                   'anchoring while the low end moves smooth and unhurried'],
    arc:          ['entering one at a time with air around each voice','swelling toward an emotional lift then settling back',
                   'layering toward immersion then thinning to open space',
                   'resolving into a warm final chord as it closes'],
    voiceRel:     ['answering the lead in warm dialogue','entering with air around it','drifting over the harmony'],
    colorRel:     ['threading through the spaces','shimmering between phrases','tracing the top of the harmony'],
  },
  firefly: {
    conversation: ['interlocking in a tight bright weave','answered by chord stabs over the drive',
                   'trading with their own delayed repeats in call-and-response'],
    foundation:   ['locked tight and propulsive','chugging steady and forward beneath the layers',
                   'anchoring as a relentless low pulse while the synths climb over it'],
    arc:          ['building through added layers toward an open peak','opening over the drive into a full-energy lift',
                   'stacking through rising layers then released into the chorus',
                   'resolving the climb onto a bright final chord'],
    voiceRel:     ['climbing over the drive','answering the lead','riding above the pulse'],
    colorRel:     ['sparkling over the groove','accenting the lift','flickering between the beats'],
  },
};

const DELERIUM = {
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
  order: ['pads','harmony','bass','drums','voice','lead','color','movement'],
};

Object.assign(window.__ATMOS, { DELERIUM });
})();

/* engines/era.js */
(function(){
// Era engine (Eric Lévi / +eRa+) — trilogy-era identity: Era (1996) -> Era 2 (2000)
// -> The Mass (2003), with Reborn's (2008) Arabic/electronic edge as colour.
// Core sound = pseudo-Latin / invented-language Gregorian CHOIR (the signature voice)
// over orchestral strings + pipe organ + lush synths + downtempo-to-driving beats +
// Lévi's rock electric guitar. Cinematic medieval-heroic grandeur (Carmina Burana on
// The Mass). Domains: 'E' electronic, 'A' acoustic/orchestral, 'B' both.
//
// Built to the Delerium resolver pattern: deep, DE-OVERLAPPED pools so each character
// owns a distinct pad / voice / movement signature (never "tempo is the only change"),
// with the interplay layer WOVEN into the style string per John's Suno test.

const P = {
  pads: {
    stringOrchestra: { t: 'a sweeping orchestral string section', d: 'B' },
    synthPadLush:    { t: 'lush warm analog synth pads', d: 'E' },
    choirPadWordless:{ t: 'a sustained wordless choir pad', d: 'B' },
    pipeOrgan:       { t: 'a swelling cathedral pipe organ', d: 'A' },
    darkOrchPad:     { t: 'a brooding low orchestral drone', d: 'A' },
    glassSynthPad:   { t: 'a glassy digital synth pad', d: 'E' },
    mellotronStrings:{ t: 'a Mellotron string-and-choir pad', d: 'B' },
    brassSwell:      { t: 'a low orchestral brass swell', d: 'A' },
    analogueSwell:   { t: 'a warm analogue polysynth swell', d: 'E' },
    cinematicDrone:  { t: 'a cinematic sub-orchestral drone bed', d: 'B' },
    shimmerPad:      { t: 'a shimmering high-string tremolo pad', d: 'A' },
    fmCrystalPad:    { t: 'a glassy FM crystalline pad', d: 'E' },
    hybridOrchSynth: { t: 'a hybrid orchestra-and-synth wash', d: 'B' },
    airVocalPad:     { t: 'an airy layered vocal-synth pad', d: 'E' },
  },
  bass: {
    orchestralCello: { t: 'a deep orchestral cello-and-contrabass foundation', d: 'A' },
    synthSubBass:    { t: 'a deep sustained synth sub-bass', d: 'E' },
    electricBass:    { t: 'a driving electric bass', d: 'B' },
    seqBass:         { t: 'a sequenced synth bass pulsing eighth notes', d: 'E' },
    pizzBass:        { t: 'a pizzicato double-bass', d: 'A' },
    warmSine:        { t: 'a warm sine sub with a soft attack', d: 'E' },
    rockBass:        { t: 'a distorted rock bass locked to the kick', d: 'B' },
    filterBass:      { t: 'a warm filtered analog bassline', d: 'E' },
    organPedal:      { t: 'a low organ pedal tone', d: 'A' },
    oudLow:          { t: 'a low oud register', d: 'A' },
    pulseCello:      { t: 'a staccato cello-and-contrabass ostinato', d: 'A' },
    driveSub:        { t: 'a hard-edged driving synth bass', d: 'E' },
  },
  lead: {
    soaringViolin:   { t: 'a soaring solo violin lead', d: 'A' },
    celloLead:       { t: 'a long-phrased solo cello lead', d: 'A' },
    electricGuitar:  { t: 'a soaring electric guitar lead', d: 'B' },
    pianoFigure:     { t: 'a dramatic grand-piano figure', d: 'A' },
    oboeLead:        { t: 'a plaintive oboe melody', d: 'A' },
    synthLead:       { t: 'a bright analog synth lead', d: 'E' },
    panFlute:        { t: 'a breathy pan-flute melody', d: 'A' },
    duduk:           { t: 'a mournful duduk lead', d: 'A' },
    distortedRiff:   { t: 'a driving distorted-guitar riff', d: 'B' },
    fmBellLead:      { t: 'a glassy FM bell lead', d: 'E' },
    harpFigure:      { t: 'a cascading harp figure', d: 'A' },
    brassFanfare:    { t: 'a heroic brass fanfare line', d: 'A' },
    neyLead:         { t: 'a reedy ney flute lead', d: 'A' },
    stringOstinato:  { t: 'a driving sixteenth-note string ostinato', d: 'A' },
    arpSynth:        { t: 'a climbing synth arpeggio lead', d: 'E' },
  },
  harmony: {
    minorCinematic: { t: 'dark minor-key cinematic chord changes', d: 'B' },
    carminaProg:    { t: 'a Carmina-Burana-style ostinato progression', d: 'A' },
    suspendedLift:  { t: 'suspended chords resolving on the chorus lift', d: 'B' },
    majorAnthem:    { t: 'a triumphant major-key anthem progression', d: 'B' },
    modalGregorian: { t: 'a modal Gregorian chord movement', d: 'B' },
    risingProg:     { t: 'a rising chord progression that resolves upward', d: 'B' },
    minorToMajor:   { t: 'a minor-to-relative-major resolution on the chorus', d: 'B' },
    plagalCadence:  { t: 'a plagal cadence resolving to the tonic', d: 'B' },
    phrygianCadence:{ t: 'a dark phrygian cadence', d: 'B' },
    sacredCadence:  { t: 'a sacred choral cadence resolving on the final chord', d: 'B' },
    pedalTonic:     { t: 'a sustained tonic pedal under shifting harmony', d: 'B' },
  },
  voice: {
    pseudoLatinChoir:{ t: 'a dramatic mixed choir chanting in a pseudo-Latin language', d: 'A' },
    gregorianMale:   { t: 'Gregorian-style male chant', d: 'A' },
    soaringFemale:   { t: 'a soaring operatic female lead vocal', d: 'A' },
    layeredChoirSATB:{ t: 'a full layered SATB choir', d: 'A' },
    solemnLatin:     { t: 'solemn liturgical Latin chant', d: 'A' },
    femaleAria:      { t: 'an ethereal female aria in an invented sacred language', d: 'A' },
    maleChoirLow:    { t: 'a deep male-choir drone', d: 'A' },
    boysChoir:       { t: "a distant boys' choir", d: 'A' },
    callResponse:    { t: 'a call-and-response choir exchange', d: 'A' },
    multitracked:    { t: 'a massive multi-tracked chant chorus', d: 'A' },
    arabicFemale:    { t: 'a Middle-Eastern female vocal melisma', d: 'A' },
    breathyFemale:   { t: 'a breathy close female vocal texture', d: 'A' },
    wordlessSoprano: { t: 'a wordless soprano melisma', d: 'A' },
    chantStabs:      { t: 'chant-fragment vocal stabs', d: 'A' },
  },
  color: {
    timpaniRoll:  { t: 'a timpani roll swelling into the phrase', d: 'A' },
    tubularBells: { t: 'tubular bells tolling', d: 'A' },
    harpGliss:    { t: 'a harp glissando', d: 'A' },
    glocken:      { t: 'a glockenspiel sparkle', d: 'B' },
    orchHit:      { t: 'an orchestral stab hit', d: 'A' },
    choirStab:    { t: 'a staccato choir stab', d: 'A' },
    cymbalSwell:  { t: 'a cymbal-swell transition', d: 'A' },
    pizzStrings:  { t: 'a pizzicato string accent', d: 'A' },
    oudRun:       { t: 'an oud ornament run', d: 'A' },
    windChimes:   { t: 'a wind-chime shimmer', d: 'A' },
    brassStab:    { t: 'a brass stab accent', d: 'A' },
    reversedStab: { t: 'a reversed synth-stab accent', d: 'E' },
    bellArp:      { t: 'a bell-synth arpeggio sparkle', d: 'E' },
    sitarAccent:  { t: 'a sitar ornament', d: 'A' },
  },
  movement: {
    orchestralSwell:{ t: 'sweeping orchestral crescendos', d: 'A' },
    delayThrows:    { t: 'tempo-synced delay throws', d: 'E' },
    cinematicRiser: { t: 'a cinematic riser into the drop', d: 'B' },
    reverbTail:     { t: 'a long cathedral reverb tail', d: 'E' },
    filterLFO:      { t: 'a slow filter LFO sweep', d: 'E' },
    guitarSustain:  { t: 'a sustained wall of electric guitar', d: 'B' },
    autopan:        { t: 'a wide stereo autopan', d: 'E' },
    reversedTr:     { t: 'reversed-swell transitions', d: 'E' },
    stringRiser:    { t: 'a rising string glissando into the chorus', d: 'A' },
    tapeEcho:       { t: 'analog tape-echo repeats', d: 'E' },
    risers:         { t: 'filtered-noise risers into the lift', d: 'E' },
    panSweep:       { t: 'a slow stereo pan sweep', d: 'E' },
    gatedPulse:     { t: 'a gated rhythmic pulse across the pads', d: 'E' },
  },
};

const DRUMS = {
  softDown:  ['a soft downtempo electronic beat','a mid-tempo programmed groove','a trip-hop-leaning downtempo beat','a subdued measured downtempo beat'],
  cinematic: ['a syncopated cinematic beat with orchestral percussion','a driving programmed beat under rolling timpani','a big cinematic drum groove with taiko hits'],
  driving:   ['a driving rock-electronic beat','a propulsive programmed pulse with live drums','a punchy rock groove with a programmed kick'],
  hybrid:    ['a programmed beat laced with orchestral percussion','a downtempo beat under a live drum kit'],
  epicDrive: ['a driving electronic beat under rolling timpani','a propulsive four-on-the-floor electronic pulse with taiko accents','a fast programmed groove with darbuka and tribal frame drums','a punchy programmed kick locked to orchestral percussion'],
};

const r = (role, ...keys) => keys.map(k => P[role][k]);

const CHARACTERS = {
  cathedralOverture: {
    label: 'Cathedral Overture', source: 'Classics / orchestral',
    genre: 'Era Style, orchestral choral cinematic',
    beatless: true, energy: 'low', colorChance: 0.5,
    drums: { primary: null, secondary: null },
    pools: {
      pads:     r('pads','stringOrchestra','pipeOrgan','darkOrchPad','choirPadWordless','mellotronStrings','shimmerPad'),
      bass:     r('bass','orchestralCello','pizzBass','organPedal','synthSubBass'),
      harmony:  r('harmony','modalGregorian','minorCinematic','sacredCadence','pedalTonic','plagalCadence'),
      voice:    r('voice','layeredChoirSATB','wordlessSoprano','gregorianMale','maleChoirLow','boysChoir','femaleAria'),
      lead:     r('lead','soaringViolin','celloLead','oboeLead','harpFigure','brassFanfare'),
      color:    r('color','timpaniRoll','tubularBells','harpGliss','cymbalSwell','pizzStrings'),
      movement: r('movement','orchestralSwell','reverbTail','reversedTr','stringRiser'),
    },
  },
  neoGregorianAnthem: {
    label: 'Neo-Gregorian Anthem', source: 'Era (Ameno / Mother)',
    genre: 'Era Style, neo-Gregorian downtempo anthem',
    beatless: false, bpm: [88,98], energy: 'medium', colorChance: 0.5,
    drums: { primary: 'softDown', secondary: 'hybrid' },
    pools: {
      pads:     r('pads','stringOrchestra','synthPadLush','choirPadWordless','mellotronStrings','hybridOrchSynth','analogueSwell'),
      bass:     r('bass','synthSubBass','orchestralCello','electricBass','warmSine','filterBass'),
      harmony:  r('harmony','minorCinematic','suspendedLift','modalGregorian','minorToMajor','sacredCadence','majorAnthem'),
      voice:    r('voice','pseudoLatinChoir','soaringFemale','gregorianMale','layeredChoirSATB','femaleAria','callResponse','multitracked'),
      lead:     r('lead','soaringViolin','pianoFigure','synthLead','electricGuitar','panFlute','oboeLead','harpFigure'),
      color:    r('color','timpaniRoll','glocken','harpGliss','choirStab','orchHit','bellArp'),
      movement: r('movement','delayThrows','orchestralSwell','reverbTail','stringRiser','tapeEcho'),
    },
  },
  etherealBallad: {
    label: 'Ethereal Ballad', source: 'Era 2 (Don\u2019t Go Away)',
    genre: 'Era Style, ethereal orchestral ballad',
    beatless: false, bpm: [72,84], energy: 'low to medium', colorChance: 0.4,
    drums: { primary: 'softDown', secondary: 'hybrid' },
    pools: {
      pads:     r('pads','synthPadLush','stringOrchestra','glassSynthPad','shimmerPad','airVocalPad','mellotronStrings'),
      bass:     r('bass','orchestralCello','synthSubBass','pizzBass','warmSine','filterBass'),
      harmony:  r('harmony','suspendedLift','minorToMajor','majorAnthem','risingProg','plagalCadence','pedalTonic'),
      voice:    r('voice','soaringFemale','breathyFemale','femaleAria','wordlessSoprano','layeredChoirSATB','boysChoir'),
      lead:     r('lead','pianoFigure','soaringViolin','celloLead','oboeLead','panFlute','harpFigure','synthLead'),
      color:    r('color','harpGliss','glocken','tubularBells','windChimes','pizzStrings'),
      movement: r('movement','delayThrows','reverbTail','autopan','stringRiser','panSweep','tapeEcho'),
    },
  },
  cinematicMass: {
    label: 'Cinematic Mass', source: 'The Mass',
    genre: 'Era Style, epic choral cinematic',
    beatless: false, bpm: [100,112], energy: 'medium to high', colorChance: 0.55,
    drums: { primary: 'cinematic', secondary: 'driving' },
    pools: {
      pads:     r('pads','stringOrchestra','pipeOrgan','choirPadWordless','brassSwell','cinematicDrone','hybridOrchSynth'),
      bass:     r('bass','orchestralCello','electricBass','rockBass','synthSubBass','organPedal'),
      harmony:  r('harmony','carminaProg','minorCinematic','phrygianCadence','risingProg','sacredCadence','majorAnthem'),
      voice:    r('voice','multitracked','pseudoLatinChoir','layeredChoirSATB','maleChoirLow','callResponse','chantStabs','soaringFemale'),
      lead:     r('lead','electricGuitar','distortedRiff','brassFanfare','stringOstinato','soaringViolin','synthLead'),
      color:    r('color','timpaniRoll','orchHit','choirStab','brassStab','cymbalSwell','tubularBells'),
      movement: r('movement','orchestralSwell','cinematicRiser','guitarSustain','stringRiser','risers','reversedTr'),
    },
  },
  drivingEpic: {
    label: 'Driving Epic', source: 'The Mass / Reborn',
    genre: 'Era Style, driving orchestral-electronic epic',
    beatless: false, bpm: [116,128], energy: 'high', colorChance: 0.45,
    drums: { primary: 'epicDrive', secondary: 'cinematic' },
    // NO rock/guitar sources: propulsion comes from the sixteenth-note string ostinato,
    // sequenced synth pulse and tribal/orchestral percussion (Reborn's Arabic-electronic edge).
    negative: ['rock','heavy metal','symphonic metal','death metal','metal guitar',
               'distorted electric guitar','power chords','double-kick blast beats',
               'screamed vocals','growled vocals','guitar solo'],
    pools: {
      pads:     r('pads','glassSynthPad','synthPadLush','cinematicDrone','hybridOrchSynth','fmCrystalPad','airVocalPad'),
      bass:     r('bass','seqBass','driveSub','synthSubBass','filterBass','pulseCello','oudLow'),
      harmony:  r('harmony','minorCinematic','carminaProg','risingProg','majorAnthem','minorToMajor','phrygianCadence'),
      voice:    r('voice','multitracked','chantStabs','pseudoLatinChoir','arabicFemale','callResponse','soaringFemale'),
      lead:     r('lead','stringOstinato','arpSynth','synthLead','fmBellLead','neyLead','brassFanfare','soaringViolin'),
      color:    r('color','orchHit','choirStab','brassStab','reversedStab','oudRun','sitarAccent','bellArp'),
      movement: r('movement','cinematicRiser','gatedPulse','risers','delayThrows','filterLFO','panSweep','stringRiser'),
    },
  },
};

const INTERPLAY = {
  cathedralOverture: {
    conversation: ['answering the choir from across the orchestra','stating the theme alone then swallowed by the ensemble',
                   'trading long phrases with the strings in call-and-response'],
    foundation:   ['grounding the harmony with a slow pedal beneath the swells','anchoring in slow motion while the upper voices soar',
                   'holding a single harmonic centre with everything rising above'],
    arc:          ['building from a lone voice to full orchestral grandeur','swelling toward a towering climax then falling to silence',
                   'resolving at last into a sustained sacred final chord','landing the overture on a resolved tonic cadence'],
    voiceRel:     ['soaring over the orchestra','chanting from the depth of the reverb','answering the theme in layered harmony'],
    colorRel:     ['tolling once into the vast space','swelling under the climax','marking the turn of the phrase'],
  },
  neoGregorianAnthem: {
    conversation: ['trading the melody with the choir over the groove','stating the hook while the chant breathes beneath',
                   'answered by soaring vocal lines on the lift'],
    foundation:   ['locked with the beat in a steady hypnotic pocket','rolling forward beneath the choir grounding the anthem',
                   'holding steady while the low end drives the groove'],
    arc:          ['building through layered chant toward a soaring chorus','stacking voices to an anthemic peak then easing back',
                   'lifting into a triumphant resolved chorus','resolving the anthem onto a bright final cadence'],
    voiceRel:     ['soaring over the groove','chanting beneath the lead','rising in call-and-response with the melody'],
    colorRel:     ['punctuating the downbeats','sparkling over the chant','answering the chorus hits'],
  },
  etherealBallad: {
    conversation: ['weaving in intimate dialogue over the pads','floating free above the harmony answered by strings',
                   'trading tender phrases with a second voice'],
    foundation:   ['moving slow and unhurried beneath the vocal','gliding under the arrangement tied to the gentle pulse',
                   'anchoring softly while the low end breathes'],
    arc:          ['opening one voice at a time with air around each','swelling to an emotional lift then settling back to stillness',
                   'building tenderly toward a resolved final chord','easing into a warm resolving cadence as it closes'],
    voiceRel:     ['carrying the melody with aching clarity','answering the lead in soft harmony','entering with air around it'],
    colorRel:     ['shimmering between the phrases','tracing the top of the harmony','glinting in the quiet spaces'],
  },
  cinematicMass: {
    conversation: ['answered by the guitar over the pounding choir','trading heroic phrases with the full ensemble',
                   'locking with the string ostinato in driving unison'],
    foundation:   ['pounding in lockstep with the cinematic beat','driving relentless beneath the massed choir',
                   'anchoring the ritual as the low end thunders'],
    arc:          ['building from ritual chant to a thunderous climax','stacking choir and orchestra to an overwhelming peak',
                   'released from the build into a triumphant resolved chorus','resolving the mass onto a towering final chord'],
    voiceRel:     ['thundering over the orchestra','chanting massed beneath the guitar','trading the foreground with the lead'],
    colorRel:     ['hammering the accents','crashing under the climax','punctuating the ritual build'],
  },
  drivingEpic: {
    conversation: ['interlocking with the string ostinato in a driving weave','answered by chant stabs over the pulse',
                   'trading with its own delayed repeats in call-and-response','climbing over the sequenced pulse as the choir answers'],
    foundation:   ['locked tight and propulsive under the layers','pulsing relentless beneath the climbing synths',
                   'anchoring as a driving low pulse while the epic builds','pushing the groove forward beneath the massed voices'],
    arc:          ['building through stacked layers toward an open peak','opening over the drive into a full-energy lift',
                   'released from the climb into a soaring resolved chorus','resolving the drive onto a bright final chord'],
    voiceRel:     ['riding high over the drive','stabbing rhythmically against the pulse','climbing over the groove'],
    colorRel:     ['sparking over the groove','accenting the lift','flickering between the beats'],
  },
};

const ERA = {
  id: 'Era',
  styleAnchor: 'Era Style',
  master: P,
  drums: DRUMS,
  characters: CHARACTERS,
  interplay: INTERPLAY,
  sourceNegative: [
    'radio pop','cheesy pop hooks','rap verse','trap hi-hats','EDM festival drop',
    'supersaw stacks','chiptune','autotuned vocals','lo-fi',
  ],
  order: ['pads','harmony','bass','drums','voice','lead','color','movement'],
};

Object.assign(window.__ATMOS, { ERA });
})();

/* legacy/data-style-engines.js */
(function(){
const MAX_MODE_STR = `[Is_MAX_MODE: MAX](MAX)
[QUALITY: MAX](MAX)
[REALISM: MAX](MAX)`;

const MASTERING = "Polished Dolby Atmos-Master Atmos -2dB.";

const STYLE_ENGINES = {
  Balearic: {
    accent: "ocean teal / blue",
    genre: "Balearic downtempo",
    presets: ["Poolside Warm", "Sunset Groove", "Twilight Drift", "Afterdark Deep"],
    phases: [
      "low-mid chill, 82-92 BPM, low energy",
      "mid chill, 90-100 BPM, medium energy",
      "mid chill, 88-98 BPM, low-medium energy",
      "mid-high chill, 96-108 BPM, medium energy",
      "low-mid chill, 84-94 BPM, low energy"
    ],
    pads: [
      "Warm analogue synth pads layered with Pulse Pad Textures and soft synth layers.",
      "Lush analogue pads blended with rich synth textures and evolving tonal layers.",
      "Deep ambient pad layers with soft Pulse Pad Textures and evolving atmosphere.",
      "Textured polysynth layers with analogue warmth and gentle modulation movement.",
      "Layered analogue pads combined with Pulse Pad Textures and soft harmonic synth layers."
    ],
    bass: [
      "Fretless bass groove with smooth melodic movement.",
      "FM bass with soft attack and subtle rhythmic pulse.",
      "Deep sub bass providing weight and low-end warmth.",
      "Electric bass guitar with warm rounded tone and flowing groove.",
      "Double bass with soft plucked articulation and organic movement.",
      "Hybrid bass combining sub bass depth with mid-range melodic tone.",
      "Acoustic bass guitar with warm natural tone and soft rhythmic movement.",
      "Plucky bass with warm analog character."
    ],
    rhythm: [
      "Natural brushed drums with organic percussion including congas, bongos, shakers and hand percussion.",
      "Live acoustic drums with a soft natural feel, subtle groove and light ghost notes, layered with organic percussion.",
      "Lounge/house drum kit with soft kick, clean snare and tight hi-hats, supported by congas, shakers and light percussion.",
      "Minimal downtempo drum groove with soft kick, rim clicks and light percussion textures."
    ],
    percussion: [
      "Slow string bed sitting deep in the mix.",
      "Soft layered strings blended underneath the pads for depth.",
      "Subtle string textures supporting the harmonic space."
    ],
    motifs: [
      "Clean nylon guitar motifs with soft rhythmic strumming drifting in and out of the mix.",
      "Soft acoustic guitar phrases with gentle rhythmic movement and natural flow.",
      "Rhodes electric piano motifs with warm chord movement and melodic phrasing.",
      "Arpeggiated synth leads weaving through the mix with evolving rhythmic motion.",
      "Soft flute motifs with airy phrasing and gentle movement through the mix.",
      "Vibraphone phrases with smooth sustained notes and gentle movement."
    ],
    movement: [
      "Wide stereo panning movement across pads and motifs using left-right automation and slow modulation.",
      "Delay-driven movement using tempo-synced echoes and cascading repeats creating evolving rhythmic space.",
      "Rhythmic autopan and modulation creating groove-based movement across percussion and melodic elements.",
      "Filter and modulation movement using LFO, chorus and phaser creating evolving tonal shifts across pads and textures."
    ],
    negatives: "no harsh EDM drops, no aggressive distortion, no busy festival synths, no brittle hi-hats, no overcompressed master",
    sourceNegative: "-EDM festival drops, -trap hi-hats, -hip hop beats, -aggressive synth leads, -distorted bass, -big room house, -future bass, -dubstep, -orchestral scoring, -cinematic trailer music, -lo-fi hip hop beats, -tropical house drops, -slap bass funk, -hardstyle kicks, -techno stabs, -psytrance leads, -brostep growls, -festival risers, -trap snares, -reggaeton dembow, -heavy metal guitars, -arena rock drums, -abrasive lead vocals, -hyperpop glitches, -EDM supersaw drops, -marching percussion, -epic choir hits, -trailer braams",
    metatags: ["[Warm sunset intro]", "[Soft Balearic groove]", "[Airy vocal]", "[Oceanic instrumental break]", "[Golden-hour final chorus]"]
  },
  Enigma: {
    accent: "violet",
    genre: "Enigma Style, ethereal world-electronic downtempo",
    presets: ["Gregorian sacred (MCMXC)", "Ethnic (Cross of Changes)", "Cinematic distorted (Screen)", "Ethereal ambient", "Modern (Voyageur)", "Breakbeat drive"],
    phases: [
      "Mid-low Tempo 84-90 BPM, low energy.",
      "Mid-low Tempo 88-92 BPM, low energy.",
      "Mid-low Tempo 90-96 BPM, low to medium energy.",
      "Mid Tempo 98-102 BPM, low to medium energy.",
      "Mid Tempo 102-108 BPM, low to medium energy.",
      "Mid Tempo 104-112 BPM, medium energy."
    ],
    pads: [
      "Dark analogue pads layered with rich ambient textures and slow evolving harmonic beds.",
      "Warm analogue pads layered with rich ambient textures and evolving harmonic layers.",
      "Warm analogue pads layered with ambient textures and soft orchestral string beds for expanded depth.",
      "Warm analogue pads layered with clean ambient textures and smooth evolving harmonic support.",
      "Morphed ethereal choir pads blended with ambient textures and slow evolving harmonic layers."
    ],
    bass: [
      "Deep sub bass or slow analogue bass with minimal movement supporting a hypnotic low-end foundation.",
      "Warm analogue bass or sub bass with a steady rhythmic pulse and subtle melodic movement.",
      "Warm analogue bass or sub bass with smooth rhythmic movement and a controlled low-end presence.",
      "Warm analogue or sub bass with a steady controlled pulse and defined low-end presence.",
      "Warm analogue or sub bass with rhythmic movement and subtle melodic phrasing supporting the groove."
    ],
    rhythm: [
      "Soft electronic and tribal drums using a hypnotic pulse groove.",
      "Soft electronic and tribal drums using a ritual pulse groove.",
      "Soft electronic and tribal drums using a flowing tribal groove.",
      "Soft electronic drums using a controlled pulse groove.",
      "Minimal pulse drums using a sparse ambient rhythmic foundation.",
      "Breakbeat-style drums with a laid-back hip-hop groove."
    ],
    percussion: ["Sparse percussion with tribal acoustic percussion textures.", "Moderate percussion with hybrid electronic + tribal textures.", "Layered percussion with breakbeat kit textures."],
    motifs: [
      "Breathy shakuhachi flute motifs with expressive phrasing and gentle repetition.",
      "Short melodic motif with gentle repetition acting as a subtle hook element.",
      "Gregorian chant fragments used as rhythmic and atmospheric motif elements.",
      "Morphed ethereal choir pads blended with ambient textures and slow evolving harmonic layers.",
      "Bell and chime accents with soft tonal decay and spatial depth.",
      "Reversed tonal swells and ambient textures creating atmospheric transitions."
    ],
    movement: [
      "Deep spatial reverb with cathedral-like ambience, long delay trails and subtle stereo movement.",
      "Wide stereo field with rhythmic delay, spatial reverb and evolving modulation movement.",
      "Wide stereo field with smooth spatial reverb, controlled delay and subtle modulation movement.",
      "Wide stereo field with deep spatial layering, rhythmic delay and evolving modulation movement.",
      "Wide stereo field with rhythmic delay, controlled reverb and subtle modulation movement."
    ],
    negatives: "no parody monk chants, no cartoon mysticism, no metal guitars, no bright pop-punk drums, no comic gothic effects",
    sourceNegative: "-EDM drops, -festival house, -big room, -future bass, -dubstep, -trap hi-hats, -hip hop beats, -aggressive synth leads, -distorted bass, -cinematic trailer music, -orchestral hits, -fast tempo, -high energy dance music, -rock guitars, -pop vocal hooks, -belting vocals, -anthem choruses",
    metatags: ["[Gregorian-style texture]", "[Whispered chant layer]", "[Hypnotic pulse]", "[Ritual bridge]", "[Atmospheric outro]"]
  },
  Delerium: {
    accent: "muted aqua",
    genre: "atmospheric vocal electronica, midtempo",
    presets: ["Silence Core", "Underwater Flow", "Afterall Lift", "Dark Alternative", "Textural Blend"],
    phases: [
      "Delerium electronic sacral profile, midtempo 114-120 BPM, steady electronic groove with natural variation, soft kick and snare backbeat, minor-key, suspended/add9 chords, wide reverberant space.",
      "Delerium fluid electronic profile, midtempo 114-118 BPM, smooth electronic groove, soft kick and snare backbeat, minor-key suspended chords, diffused space and low-contrast motion.",
      "Delerium modern emotional profile, midtempo 116-122 BPM, structured electronic groove with natural movement, soft kick and snare backbeat, polished minor-key suspended harmony.",
      "Delerium melodic lift profile, midtempo 114-120 BPM, steady electronic groove, suspended/add9 harmony with subtle modal brightness, wide reverb field."
    ],
    pads: [
      "electronic atmospheric style with subtle ambient trance influence, not downtempo, structured groove maintained. dense layered soundscape, pads, choir and textures fully blended, no isolated instruments.",
      "balanced choir and pad mass with lighter upper-air movement, blended textures and soft synthetic shimmer, still fully merged into a unified field.",
      "dense layered soundscape with pads, choir and textures supporting a clearer lead presence, still embedded in the field, not pop-forward or dry.",
      "darker tonal shading, cathedral depth, heavier low-mid density, haunting choir wash and shadowed pad mass, fully blended rather than performed."
    ],
    bass: ["tempo held within 112-116 BPM, no perceived tempo shift.", "tempo held within 114-118 BPM, no perceived tempo shift.", "tempo held within 116-120 BPM, no perceived tempo shift.", "tempo held within 118-122 BPM, no perceived tempo shift."],
    rhythm: [
      "simple repeating melodic motif, emotive and smooth, gently memorable without rhythmic emphasis.",
      "clear repeating melodic motif in upper layers, slightly more memorable and uplifted, still smooth and non-percussive.",
      "melodic content remains atmospheric and understated, no obvious hook emphasis."
    ],
    percussion: [
      "female vocal sustained, legato, layered and embedded, primary line smooth with low supporting textures.",
      "female vocal sustained, legato, slightly forward and emotionally expressive, still embedded in reverb.",
      "male vocal layer, chant-like, deep and blended into the harmonic field, never dominant.",
      "layered male and female vocals, female carries air and tone, male provides depth, unified delivery, no duet behaviour."
    ],
    motifs: [
      "layered choir bloom, wide stereo spread, slow attack, harmonic lift in chorus, no transient emphasis.",
      "glassy pad layers, slow modulation, airy shimmer, no brightness spikes.",
      "subtle sub pulse, low-frequency support, stable and constant, no rhythmic variation.",
      "soft piano tones and sustained string-like warmth blended into the pad mass, no percussive attack."
    ],
    movement: [
      "continuous harmonic evolution, no static looping, gradual tonal shifts.",
      "subtle stereo expansion and contraction, evolving width, no abrupt changes.",
      "elements gradually enter and dissolve, no hard transitions."
    ],
    negatives: "no hard trance supersaws, no aggressive club drop, no novelty vocals, no dry rock drums, no crowded arrangement",
    sourceNegative: "no ambient downtempo, no beatless ambient, no minimal rhythm, no loose groove, no weak backbeat, no sparse percussion, no thin mix, no orchestral scoring, no acoustic realism, no modern pop",
    metatags: ["[Ethereal vocal]", "[Sacral harmony]", "[Underwater ambience]", "[Layered emotional lift]", "[Ambient breakdown]"]
  },
  Era: {
    accent: "warm sand/gold",
    genre: "sacred cinematic choral",
    presets: ["Sacral Choir", "Orchestral Cinematic", "Luminous Atmos", "Ethnic Texture", "Vocal Forward"],
    phases: [
      "ERA sacred cinematic profile, ceremonial midtempo pulse, modal minor harmony, monumental choir-led field, restrained electronic and acoustic hybrid percussion.",
      "ERA cinematic sacred profile, broader ceremonial pulse, modal minor harmony, choir mass and dramatic but controlled low-mid weight.",
      "ERA luminous sacred profile, lighter ceremonial pulse, modal harmony with restrained brightness, choir-led atmosphere and uplift.",
      "ERA sacred world-cinematic profile, ceremonial pulse with soft ethnic texture, modal harmony, monumental choir field.",
      "ERA emotional ceremonial profile, clearer lead presence over monumental choir bed, controlled pulse and sacred grandeur."
    ],
    pads: ["tempo held within 96-102 BPM, ceremonial pace.", "tempo held within 100-106 BPM, controlled lift and procession.", "tempo held within 104-112 BPM, stronger ceremonial drive without trailer excess."],
    bass: ["melodic development remains atmospheric, ceremonial and understated.", "simple ceremonial motif repeats across sections, memorable but not pop-like.", "clear repeating sacred hook line in upper choir or lead layer, still smooth and processional."],
    rhythm: ["massed choir dominates, dense chant-led field, no intimate pop lead.", "female lead floats above choir bed, embedded not dry, choir retains scale.", "male chant or baritone texture leads the sacred field, monumental and blended.", "male and female layers unified with choir, broad sacred wall, no duet exchange."],
    percussion: ["full-spectrum sacred wall, choir and pad mass fill the field, restrained instrument separation.", "grand layered sacred field, stronger low-mid weight, broad choir and pad scale, still controlled.", "monumental choir wall, dense ceremonial layering, maximum scale without trailer hits."],
    motifs: ["expanding choir bloom with broad stereo spread and slow ceremonial rise.", "submerged string swells blended into the sacred mass, no isolated performance.", "soft bell tones and airy upper shimmer supporting the sacred hook.", "subtle ethnic texture and distant percussion colouring the atmosphere, no dominance."],
    movement: ["gradual build and release through ceremonial layering, no abrupt transitions.", "steady ceremonial pulse with slow harmonic unfolding and broad spatial rise.", "processional movement with lighter uplift, gentle expansion and release."],
    negatives: "no modern trap hats, no harsh dubstep bass, no hyperpop gloss, no novelty Gregorian effects, no excessive brightness",
    sourceNegative: "no trailer bombast, no EDM, no pop chorus, no hyper-modern synth pop, no thin choir, no dry percussion, no harsh transients, no cinematic impact hits, no bright plucks, no trap hats",
    metatags: ["[Downtempo intro]", "[Trip-hop pulse]", "[Breathy vocal]", "[Wide atmospheric break]", "[Soft cinematic outro]"]
  }
};

const VOCAL_MODES = ["Instrumental", "Descriptor", "Persona"];

/* Vocal descriptor pools, keyed by vocal gender. Used by the Descriptor vocal
 * mode: the gender select lists the keys, the descriptor select lists that
 * key's array. Delivery/timbre wording only (materially steers the vocal);
 * mood/affect words are intentionally avoided (Suno ignores them). The first
 * Female entry matches the default state so it stays selected on first load. */
const VOCAL_DESCRIPTOR_OPTIONS = {
  Female: [
    "Airy female vocal with intimate tone and restrained delivery.",
    "Breathy female vocal, close-mic, soft and hushed.",
    "Warm female vocal with smooth legato phrasing.",
    "Husky female vocal with relaxed low register.",
    "Clear female vocal with controlled dynamics and gentle vibrato.",
    "Ethereal layered female vocal with wide reverb and soft harmonies."
  ],
  Male: [
    "Warm male vocal with intimate low-register delivery.",
    "Breathy male vocal, close-mic, soft and restrained.",
    "Smooth male vocal with relaxed legato phrasing.",
    "Deep male vocal with calm controlled tone.",
    "Clear male vocal with gentle dynamics and subtle grain.",
    "Layered male vocal with wide reverb and soft harmony stacks."
  ],
  Androgynous: [
    "Androgynous vocal with soft neutral timbre and restrained delivery.",
    "Breathy androgynous vocal, close-mic and hushed.",
    "Smooth androgynous vocal with even legato phrasing.",
    "Ethereal androgynous vocal with wide reverb and layered harmonies."
  ],
  Duet: [
    "Male and female duet, unified blend with female carrying the top line.",
    "Male and female harmony pairing, close and layered, no call-and-response.",
    "Layered mixed-gender vocal wash blended into the atmosphere."
  ]
};

Object.assign(window.__ATMOS, { MAX_MODE_STR, MASTERING, STYLE_ENGINES, VOCAL_MODES, VOCAL_DESCRIPTOR_OPTIONS });
})();

/* legacy/engine-extras.js */
(function(){
/*
 * engine-extras.js
 * ----------------------------------------------------------------------------
 * Option A add-on layer for the unified Suno prompt tool.
 *
 * The base tool (data-style-engines.js + data-lyric-controls.js) stays exactly
 * as it is. This file sits ON TOP and holds the per-engine "richness" that only
 * Balearic has fully authored today. Every other engine is present as an empty
 * shelf with the same shape, so the batch generator can read them all the same
 * way and simply skip the parts that are empty.
 *
 * Each engine holds five things:
 *   bannedInstruments  - the shared "never let these appear" list for the engine
 *   moodBundles        - preset buttons; picking one pre-fills a coherent set of
 *                        musical choices, and may optionally tweak the keep-out
 *                        list for that mood only
 *   flavourClusters    - the richer-instrument / influence-flavour layer: a set
 *                        of distinct "sound fingerprints" that feed the slot
 *                        system. A diversity engine (variety within the genre),
 *                        NOT a fidelity engine. Source labels are internal
 *                        scaffolding only and never enter a Suno payload.
 *   synonymBank        - stock phrases with alternates, rotated across a batch so
 *                        ten generated prompts don't read identically
 *   refTracks          - real reference songs used as quality yardsticks
 *
 * KEEP-OUT LAYERING (the per-mood / per-cluster override mechanic):
 *   effective keep-out = (engine bannedInstruments + entry.bannedAdd)
 *                        minus entry.bannedRemove
 *   Both bannedAdd and bannedRemove default to empty, so until an entry is
 *   deliberately tuned it behaves identically to the single shared list.
 *
 * SLOTS ARE THE SINGLE SOURCE OF TRUTH for instrumentation. Each instrument is
 * named exactly once, in its slot. Tempo/feel never carries instruments, and
 * artist/brand names never enter a payload (Suno strips them anyway).
 *
 * PAYLOAD FORMAT: the builder renders these slots as ONE comma-separated
 * descriptor line, ordered genre -> BPM -> rhythm feel -> harmony ->
 * instruments -> production -> vocal. (Format decision, 2026-06-27.)
 *
 * NOTE: lyric-shaping layers (lyric density, story mode) are intentionally NOT
 * here. They are generic and live in the lyric-controls layer, not per-engine.
 * ----------------------------------------------------------------------------
 */

const EngineExtras = {

  Balearic: {

    // Shared keep-out list for the whole Balearic genre.
    bannedInstruments: [
      "saxophone", "trumpet", "violin", "cello",
      "electric guitar lead", "synth lead", "808",
      "trap", "EDM drop", "dubstep", "rock", "metal", "rap", "hip hop"
    ],

    moodBundles: {
      melancholic: {
        bpm: 85,
        harm: "minor7",
        drum: "brushed",
        bass: "fm",
        textures: ["fender-rhodes", "detuned-pads", "strings", "field-rec"],
        artists: ["Bonobo", "Air"],
        bannedAdd: [],     // extra keep-outs just for this mood
        bannedRemove: []   // items from the shared list this mood is allowed to use
      },
      euphoric: {
        bpm: 95,
        harm: "major9",
        drum: "congas",
        bass: "fretless",
        textures: ["fender-rhodes", "nylon-guitar", "vocal-pad", "field-rec"],
        artists: ["Zero 7", "Bonobo"],
        bannedAdd: [],
        bannedRemove: []
      },
      dark: {
        bpm: 90,
        harm: "dorian",
        drum: "electronic",
        bass: "fretless",
        textures: ["vinyl", "dub-delay", "detuned-pads", "prepared-piano"],
        artists: ["Chromatics", "Nicolas Jaar"],
        bannedAdd: [],
        bannedRemove: []
      },
      meditative: {
        bpm: 78,
        harm: "onechord",
        drum: "nearbeat",
        bass: "drone",
        textures: ["detuned-pads", "strings", "field-rec", "prepared-piano"],
        artists: ["Olafur Arnalds", "Nicolas Jaar"],
        bannedAdd: [],
        bannedRemove: []
      },
      golden: {
        bpm: 98,
        harm: "mixo",
        drum: "brushed",
        bass: "fm",
        textures: ["nylon-guitar", "fender-rhodes", "detuned-pads", "vinyl"],
        artists: ["Khruangbin", "Max Essa"],
        bannedAdd: [],
        bannedRemove: []
      }
    },

    /*
     * flavourClusters - the richer-instrument / influence-flavour layer.
     * VALIDATED in Suno 2026-06-27: all 8 generated audibly distinct tracks
     * while still reading as Balearic. No longer provisional.
     *
     * Each cluster is a slot fingerprint. `source` is INTERNAL scaffolding only
     * (the real act a fingerprint was mined from) and must NEVER be written to a
     * payload. Drums/percussion are named only in `rhythm`; melodic/harmonic
     * instruments only in `roles`; nothing is named twice.
     *
     * ROLE-POOL MODEL (2026-06-28 decision, implemented here):
     * `instruments` (flat array) is replaced by `roles` - named slots, each
     * holding several cluster-valid options. The builder draws ONE option per
     * populated role per generated song, so a single cluster yields many
     * distinct-sounding combinations instead of one fixed instrument set.
     * Every option in a pool is pre-vetted for the cluster's register, so a
     * random draw varies the texture without drifting out of character.
     *
     * Roles used (a cluster only defines the roles that make sense for it):
     *   lead      - the one melodic/foreground voice. Exactly one draw, by
     *               design, so melodic voices never compete for attention.
     *   harmony   - chordal/pad bed (instrument, not the chord-type wording
     *               in the `harmony` string field above).
     *   bass      - low end.
     *   texture   - ambient/atmospheric layers with no clear pitch center.
     *
     * Each lead-pool entry is written with a restraining qualifier where the
     * raw instrument name alone would skew bright/festive/foreground (see the
     * Mediterranean fix below) - framing (motif/texture vs. lead) is treated
     * as part of the instrument choice, not an afterthought.
     */
    flavourClusters: {
      organic: {
        label: "Organic warm downtempo",
        band: "84-96", bpm: 90, beatless: false,
        phase: "mid chill, 84-96 BPM, low-medium energy", energy: "low-medium energy",
        palettes: {
          electronic: {
            pads: ["Warm analogue synth pads layered with soft harmonic synth layers","Lush analogue pads blended with rich evolving tonal layers","Textured polysynth layers with analogue warmth and gentle modulation movement"],
            bass: ["Electric bass guitar with warm rounded tone and flowing groove","Fretless bass groove with smooth melodic movement","Deep sub bass providing weight and low-end warmth"],
            rhythm: ["Natural brushed drums with organic percussion including congas, shakers and hand percussion","Live acoustic drums with a soft natural feel, subtle groove and light ghost notes, layered with organic percussion","Minimal downtempo groove with soft kick, brushed snare and light percussion textures"],
            strings: ["Subtle string textures supporting the harmonic space","Soft layered strings blended underneath the pads for depth"],
            motif: ["Rhodes electric piano motifs with warm chord movement and melodic phrasing","Arpeggiated synth leads weaving through the mix with evolving rhythmic motion","Clean nylon guitar motifs with soft rhythmic strumming drifting in and out of the mix"],
            movement: ["Rhythmic autopan and modulation creating groove-based movement across percussion and melodic elements","Wide stereo panning movement across pads and motifs using left-right automation and slow modulation","Delay-driven movement using tempo-synced echoes and cascading repeats creating evolving rhythmic space"]
          },
          acoustic: {
            pads: ["Warm loose Rhodes chords comping gently around the groove with soft jazz-tinged voicings", "Soft-strummed nylon guitar chords with warm natural resonance and gentle rhythmic movement", "Mellow marimba chord pads with rounded wooden tone and soft sustain", "Gentle Wurlitzer chord voicings with warm vintage character drifting under the mix"],
            bass: ["Warm upright bass walking in a loose organic groove with soft fingered articulation", "Soft-attack fretless upright bass gliding melodically beneath the harmony", "Fingerstyle rounded electric bass with warm woody tone and relaxed movement"],
            rhythm: ["Loose live hand-percussion broken-beat with brushed snare backbeat, congas and shakers breathing between hits", "Natural brushed drums with soft ghost-note snare, congas and hand percussion for an organic live feel", "Soft live kit with brushed snare, light rimwork and warm hand percussion textures"],
            strings: ["Soft-bowed layered strings swelling gently underneath the harmony for warmth and depth", "Distant soft brass pad adding warm mellow colour beneath the mix", "Mellow muted-guitar comping weaving lightly through the texture"],
            motif: ["Restrained soft flute lines with airy breathy phrasing drifting through the mix", "Understated mallet melody with warm rounded tone and gentle sustained notes", "Muted vibraphone motif with soft mallet phrasing and smooth melodic movement", "Gentle kalimba melody with delicate plucked tone and hypnotic repetition", "Breathy soft clarinet line with warm woody tone and relaxed phrasing"],
            movement: ["Gentle ensemble dynamics rising and falling naturally as the arrangement breathes", "Soft tape-delay movement drifting melodic phrases through the mix", "Warm reverb space with the players easing in and out of the groove"]
          }
        },
        interplay: {
          conversation: ["lead and chords trading phrases in loose call-and-response","a counter-melody weaving beneath the lead and answering each phrase","the lead floating free while the chords comp around it"],
          foundation: ["bass and percussion locked in a loose broken-beat pocket with ghost notes between hits","the bass walking against the swing syncopated but relaxed"],
          arc: ["voices entering one at a time building organically with air around each","the groove ebbing and swelling then blooming back"]
        },
        bannedAdd: [], bannedRemove: []
      },
      cinematic: {
        label: "Lush cinematic chillout",
        band: "90-105", bpm: 96, beatless: false,
        phase: "mid chill, 90-105 BPM, medium energy", energy: "medium energy",
        palettes: {
          electronic: {
            pads: ["Lush analogue pads blended with rich synth textures and evolving tonal layers","Layered analogue pads combined with Pulse Pad Textures and soft harmonic synth layers","Cinematic synth pad swells with wide evolving harmonic layers"],
            bass: ["Fretless bass groove with smooth melodic movement","FM bass with soft attack and subtle rhythmic pulse","Deep sub bass providing weight and low-end warmth"],
            rhythm: ["Minimal downtempo drum groove with soft kick, brushed snare and light percussion textures","Lounge/house drum kit with soft kick, clean snare and tight hi-hats, supported by light percussion"],
            strings: ["Slow string bed sitting deep in the mix","Soft layered strings blended underneath the pads for depth","Sweeping string textures rising and falling beneath the pads"],
            motif: ["Rhodes electric piano motifs with warm chord movement and melodic phrasing","Arpeggiated synth leads weaving through the mix with evolving rhythmic motion","Soft piano motifs with gentle melodic phrasing drifting through the mix"],
            movement: ["Wide stereo panning movement across pads and motifs using left-right automation and slow modulation","Filter and modulation movement using LFO, chorus and phaser creating evolving tonal shifts across pads and textures"]
          },
          acoustic: {
            pads: ["Warm string-machine chords swelling slowly with lush cinematic depth", "Glossy electric-piano voicings with smooth sustained chord movement", "Soft harp glissando chords cascading gently through the harmonic space", "Lush bowed-string chord beds rising and falling beneath the melody"],
            bass: ["Bowed sustained upright bass holding long warm tones beneath the harmony", "Smooth fretless electric bass gliding melodically under the strings"],
            rhythm: ["Soft hybrid kit with a gentle brushed-snare shuffle and light orchestral percussion", "Brushed drums with delicate cymbal swells and soft timpani-style accents"],
            strings: ["Soft-focus sweeping strings rising in long cinematic phrases across the field", "Distant soft choir pad adding wordless warmth beneath the harmony", "Shimmering orchestral texture with gentle tremolo movement"],
            motif: ["Distant soft muted-horn swell with warm restrained phrasing", "Soft vibraphone melody with smooth sustained notes and cinematic space", "Delicate celeste melody with bell-like clarity drifting over the strings", "Restrained soft oboe line with warm expressive phrasing"],
            movement: ["A slow cinematic dynamic swell rising to a lush peak then receding", "Orchestral crescendo movement building tension then releasing into open space", "Warm reverb space with sweeping string dynamics"]
          }
        },
        interplay: {
          conversation: ["lush harmony answering the lead in long cinematic phrases across the stereo field","the lead stating a motif and the harmony swelling up to meet and resolve it"],
          foundation: ["the bass sustaining long tones beneath the harmony anchoring without intruding"],
          arc: ["a slow dynamic arc with layers stacking toward a lush peak then receding","tension built through rising harmony and released into open sustained chords"]
        },
        bannedAdd: [], bannedRemove: []
      },
      analog: {
        label: "Dreamy analog electronic",
        band: "85-100", bpm: 92, beatless: false,
        phase: "low-mid chill, 85-100 BPM, low-medium energy", energy: "low-medium energy",
        palettes: {
          electronic: {
            pads: ["Textured polysynth layers with analogue warmth and gentle modulation movement","Warm analogue synth pads layered with Pulse Pad Textures and soft synth layers","Vintage analogue synth pads with slow evolving filter movement"],
            bass: ["FM bass with soft attack and subtle rhythmic pulse","Deep sub bass providing weight and low-end warmth","Plucky bass with warm analog character","Hybrid bass combining sub bass depth with mid-range melodic tone"],
            rhythm: ["Minimal downtempo drum groove with soft kick, electronic snare and light percussion textures","Simple steady programmed beat with soft kick and tight light percussion"],
            strings: ["Subtle string textures supporting the harmonic space","Soft layered strings blended underneath the pads for depth"],
            motif: ["Arpeggiated synth leads weaving through the mix with evolving rhythmic motion","Soft synth lead motifs with gentle melodic phrasing and analog character","Rhodes electric piano motifs with warm chord movement and melodic phrasing"],
            movement: ["Filter and modulation movement using LFO, chorus and phaser creating evolving tonal shifts across pads and textures","Phaser and chorus modulation creating slow evolving movement across synth layers"]
          },
          acoustic: {
            pads: ["Watery Rhodes-through-chorus chords with lush shimmering movement", "Soft mellotron-style pad chords with warm vintage tape character", "Vintage electric-piano voicings with gentle tremolo and warm sustain"],
            bass: ["Gliding fretless electric bass with smooth warm melodic movement", "Warm upright bass with soft rounded tone anchoring the harmony"],
            rhythm: ["Simple soft live kit with a brushed backbeat and light steady percussion", "Minimal live groove with soft brushwork and gentle hand percussion"],
            strings: ["Soft mellotron string layer with warm hazy analog character", "Distant bowed-string shimmer adding subtle movement beneath the pads"],
            motif: ["Soft vibraphone melody with smooth mallet phrasing and hypnotic repetition", "Restrained Wurlitzer accents with warm vintage tone drifting through the mix", "Delicate glockenspiel bell melody with bright clear tone and sparse phrasing", "Gentle music-box-style melody with fragile plucked tone and slow movement"],
            movement: ["Slow evolving dynamics with the arrangement breathing in and out", "Tape-delay shimmer drifting melodic fragments through the mix"]
          }
        },
        interplay: {
          conversation: ["a sustained lead drifting over a cycling figure in hypnotic interlock","lead and pads holding separate registers and gliding past each other"],
          foundation: ["the bass gliding smoothly and tied to the cycle above"],
          arc: ["layers phasing in and out with the texture evolving through subtraction as much as addition","a long unbroken cycle with tension held by what is withheld"]
        },
        bannedAdd: [], bannedRemove: []
      },
      dub: {
        label: "Dub-space downtempo",
        band: "90-105", bpm: 100, beatless: false,
        phase: "mid chill, 90-105 BPM, medium energy", energy: "medium energy",
        palettes: {
          electronic: {
            pads: ["Deep ambient pad layers with soft Pulse Pad Textures and evolving atmosphere","Warm analogue synth pads with dub-style space and depth"],
            bass: ["Deep sub bass providing weight and low-end warmth","Hybrid bass combining sub bass depth with mid-range melodic tone","Dub bass with deep rounded tone and spacious movement"],
            rhythm: ["Minimal downtempo drum groove with soft kick, cross-stick snare and light percussion textures","Dub-influenced downtempo groove with soft kick, rim clicks and tabla-style hand percussion"],
            strings: ["Subtle string textures supporting the harmonic space","Soft layered strings blended underneath the pads for depth"],
            motif: ["Sparse Rhodes electric piano motifs drifting in and out of the mix","Soft synth lead motifs echoing through the mix with spacious phrasing","Clean guitar motifs with dub delay drifting through the mix"],
            movement: ["Delay-driven movement using tempo-synced echoes and cascading repeats creating evolving rhythmic space","Dub-style delay throws and spring reverb movement creating deep spacious motion"]
          },
          acoustic: {
            pads: ["Low steady harmonium drone holding a warm hypnotic harmonic centre", "Hazy detuned electric-piano chords with dub-style space and delay", "Hypnotic kalimba drone pattern with warm plucked repetition"],
            bass: ["Heavy sparse deep upright bass with rounded dub weight and long space between notes", "Rounded acoustic bass with dub delay throwing the low end into the reverb"],
            rhythm: ["Dub-tinged live groove with cross-stick snare, tabla hand percussion and heavy space", "Sparse hand-drum groove with rimshot accents and wide dub-style gaps"],
            strings: ["Warm bowed-string reverb tail drifting into the dub space", "Distant soft brass pad adding mellow colour beneath the drone"],
            motif: ["Distant soft muted trumpet with warm restrained phrasing echoing into the space", "Restrained bouzouki melodic line with bright plucked tone drifting in and out", "Breathy soft melodica melody with warm reedy tone and dub delay", "Gentle kora melodic line with delicate rippling plucked phrasing", "Sparse santoor melodic accents shimmering through the reverb"],
            movement: ["Dub delay throws and spring reverb spinning melodic fragments into deep space", "Echoing tape-delay movement smearing phrases across the mix"]
          }
        },
        interplay: {
          conversation: ["melodic fragments drifting in and echoing away on long delay throws as a second voice","sparse stabs trading with their own delayed repeats in call-and-response"],
          foundation: ["bass and beat locked deep and sparse with the low end holding it together underneath"],
          arc: ["long stretches of space with single elements surfacing then dissolving","the mix opening and closing through dub drops"]
        },
        bannedAdd: [], bannedRemove: ["trumpet"]
      },
      nocturnal: {
        label: "Deep nocturnal Balearic",
        band: "96-108", bpm: 104, beatless: false,
        phase: "mid-high chill, 96-108 BPM, medium energy", energy: "medium energy",
        palettes: {
          electronic: {
            pads: ["Deep ambient pad layers with soft Pulse Pad Textures and evolving atmosphere","Dark analogue synth pads with slow evolving filter movement"],
            bass: ["Deep sub bass providing weight and low-end warmth","FM bass with soft attack and subtle rhythmic pulse"],
            rhythm: ["Minimal downtempo groove with soft four-on-the-floor kick, brushed snare and light percussion","Deep hypnotic groove with soft kick, light hats and sparse percussion textures"],
            strings: ["Subtle string textures supporting the harmonic space","Slow string bed sitting deep in the mix"],
            motif: ["Sparse synth stabs drifting through the mix with deep reverb","Soft Rhodes electric piano motifs with sparse phrasing and deep space","Sparse arpeggiated synth lead weaving slowly through the mix"],
            movement: ["Filter and modulation movement using LFO and phaser creating slow evolving tonal shifts","Wide stereo panning movement across pads using left-right automation and slow modulation"]
          },
          acoustic: {
            pads: ["Dark sustained Rhodes chords holding long tones in deep space", "Sparse detuned electric-piano voicings with cold restrained movement"],
            bass: ["Dark deep upright bass with sparse fingered notes and heavy space", "Sparse plucked contrabass sitting low and barely moving in the dark"],
            rhythm: ["Sparse soft brushed groove with wide space and restrained ghost-note snare", "Minimal live kit with soft brushwork and long silences between hits"],
            strings: ["Cold bowed-string wash drifting slowly beneath the harmony", "Sparse low bowed drone holding a dark sustained tone"],
            motif: ["Isolated slow muted-vibraphone note ringing out into the reverb", "Faint distant muted-horn tone surfacing then dissolving into space", "Distant faint music-box melody with fragile sparse phrasing"],
            movement: ["Deep restrained dynamics with long dark space between phrases", "Slow reverb swells drifting single notes into the dark"]
          }
        },
        interplay: {
          conversation: ["a single voice surfacing at a time isolated against deep space","sparse stabs hanging unanswered in the reverb with tension left unresolved"],
          foundation: ["the pulse anchoring steady while the bass barely moves beneath"],
          arc: ["almost no dynamic change with hypnosis built through repetition and restraint","tension sustained by what never arrives"]
        },
        bannedAdd: ["bright nylon guitar lead"], bannedRemove: []
      },
      sunlit: {
        label: "Sunlit Mediterranean",
        band: "96-108", bpm: 102, beatless: false,
        phase: "mid chill, 96-108 BPM, medium energy", energy: "medium energy",
        palettes: {
          electronic: {
            pads: ["Warm analogue synth pads layered with soft harmonic synth layers","Lush analogue pads blended with rich synth textures and evolving tonal layers"],
            bass: ["Plucky bass with warm analog character","Electric bass guitar with warm rounded tone and flowing groove","Fretless bass groove with smooth melodic movement"],
            rhythm: ["Lounge/house drum kit with soft kick, clean snare and tight hi-hats, supported by congas, shakers and light percussion","Minimal downtempo groove with soft kick, clean snare and light percussion textures"],
            strings: ["Subtle string textures supporting the harmonic space","Soft layered strings blended underneath the pads for depth"],
            motif: ["Clean nylon guitar motifs with soft rhythmic strumming drifting in and out of the mix","Rhodes electric piano motifs with warm chord movement and melodic phrasing","Soft acoustic guitar phrases with gentle rhythmic movement and natural flow"],
            movement: ["Wide stereo panning movement across pads and motifs using left-right automation and slow modulation","Rhythmic autopan and modulation creating groove-based movement across percussion and melodic elements"]
          },
          acoustic: {
            pads: ["Sun-warmed Rhodes chords with soft warm voicings drifting under the melody", "Understated sustained classical-guitar chords with gentle fingered warmth", "Soft mandolin chord shimmer with bright delicate tremolo"],
            bass: ["Gentle warm upright bass rolling softly beneath the groove", "Rounded soft fretless bass with smooth melodic movement"],
            rhythm: ["Light bongos and shaker with a soft snare backbeat and gentle forward motion", "Warm live kit with congas, light percussion and a relaxed daytime feel"],
            strings: ["Sun-warmed soft strings adding gentle warmth beneath the harmony", "Light-touch string shimmer floating over the groove"],
            motif: ["Gentle airy pan-flute melody with soft breathy phrasing drifting through the mix", "Light warm marimba melody with rounded wooden tone and easy movement", "Softly fingerpicked nylon-guitar motif with warm delicate phrasing", "Soft restrained Rhodes melody with warm mellow tone and unhurried phrasing"],
            movement: ["Warm afternoon dynamics rising and falling gently as the groove breathes", "Soft tape-delay drifting melodic phrases warmly through the mix"]
          }
        },
        interplay: {
          conversation: ["lead and chords trading warm phrases unhurried and conversational","a soft melody drifting over the chords answered now and then by a second voice"],
          foundation: ["bass and light percussion rolling forward in a gentle relaxed pocket"],
          arc: ["the arrangement staying open and breathing with warmth valued over busyness","restraint throughout with space over density"]
        },
        bannedAdd: ["Spanish guitar lead", "flamenco phrasing", "festive runs", "bright trumpet fanfare", "jaunty rhythm"],
        bannedRemove: []
      },
      ambient: {
        label: "Ambient / beatless atmospheric",
        genre: "Balearic ambient",
        band: "beatless", bpm: null, beatless: true,
        phase: "beatless, no drums, slow evolving atmosphere", energy: "low energy",
        palettes: {
          electronic: {
            pads: ["Deep ambient pad layers with soft Pulse Pad Textures and evolving atmosphere","Lush evolving analogue pads with slow morphing harmonic layers","Textured polysynth layers with analogue warmth and slow modulation movement"],
            bass: ["Deep sub drone providing weight and low-end warmth","Sustained low synth drone underpinning the pads"],
            rhythm: [],
            strings: ["Slow string bed sitting deep in the mix","Soft layered strings blended underneath the pads for depth"],
            motif: ["Sparse soft synth tones drifting through the mix with deep reverb","Gentle bell-like synth tones with slow sparse phrasing"],
            movement: ["Filter and modulation movement using LFO, chorus and phaser creating slow evolving tonal shifts across pads and textures","Wide stereo panning movement across pad layers using left-right automation and slow modulation"]
          },
          acoustic: {
            pads: ["Slow-swelling soft choir pad with wordless warmth morphing over long spans", "Distant low organ-tone pad holding a sustained harmonic centre", "Warm bowed-string pad bed rising and falling in glacial swells"],
            bass: ["Deep sustained bowed drone holding the low register unmoving", "Low sustained cello drone underpinning the pads with warm weight"],
            rhythm: [],
            strings: ["Slow string bed sitting deep in the mix with soft evolving movement", "Soft layered bowed strings drifting slowly beneath the pads"],
            motif: ["Distant sparse piano tones ringing out with deep reverb and long decay", "Sparse slow bell tones surfacing gently through the atmosphere", "Isolated soft glass-harmonica tone shimmering faintly in the space"],
            movement: ["Glacial dynamic swells breathing in and out over long spans", "Slow reverb morphing the layers so change is felt rather than heard"]
          }
        },
        interplay: {
          conversation: ["tones emerging and receding without hierarchy each layer equal in the field","voices cross-fading into one another with melody dissolved into texture"],
          foundation: ["the low register holding a single harmonic centre with everything suspended above"],
          arc: ["glacial evolution with the texture morphing so slowly change is felt rather than heard","harmonic stasis with motion replaced by the slow turn of timbre"]
        },
        bannedAdd: ["drum kit", "kick drum", "congas", "bongos", "shaker", "hand percussion", "four-on-the-floor"],
        bannedRemove: []
      },
      triphop: {
        label: "Moody trip-hop downbeat",
        band: "82-92", bpm: 86, beatless: false,
        phase: "low-mid chill, 82-92 BPM, low-medium energy", energy: "low-medium energy",
        palettes: {
          electronic: {
            pads: ["Detuned analogue synth pads with hazy evolving tonal layers","Textured polysynth layers with analogue warmth and gentle modulation movement"],
            bass: ["Deep sub bass providing weight and low-end warmth","Hybrid bass combining sub bass depth with mid-range melodic tone"],
            rhythm: ["Lounge/downtempo drum kit with heavy swung kick, fat snare on the backbeat and tight hi-hats","Trip-hop drum groove with lazy swung kick, deep snare and light percussion textures"],
            strings: ["Subtle string textures supporting the harmonic space","Soft layered strings blended underneath the pads for depth"],
            motif: ["Rhodes electric piano motifs with hazy detuned chord movement","Vibraphone phrases with smooth sustained notes and gentle movement","Sparse synth lead motifs drifting through the mix with analog saturation"],
            movement: ["Filter and modulation movement using LFO, chorus and phaser creating evolving tonal shifts across pads and textures","Delay-driven movement using tempo-synced echoes creating evolving rhythmic space"]
          },
          acoustic: {
            pads: ["Hazy detuned Rhodes chords with warm dusty vintage tone", "Warm vintage electric-piano voicings with smoky detuned movement"],
            bass: ["Heavy upright bass with dark woody tone anchoring the swung groove", "Thick plucked contrabass sitting deep behind the beat"],
            rhythm: ["Heavy lazy swung live kit with a fat snare backbeat and dusty broken-beat feel", "Dusty broken-beat groove with rimshot accents, brushed snare and heavy head-nod"],
            strings: ["Smoky bowed-string tail drifting darkly beneath the beat", "Distant muted-brass pad adding moody colour to the mix"],
            motif: ["Muted distant brass stabs surfacing hazily above the beat", "Slow detuned vibraphone motif with warm smeared phrasing", "Hazy muted-trumpet line drifting loosely behind the rhythm", "Restrained muted electric-guitar motif with dark reverbed tone"],
            movement: ["Dark dusty dynamics with analog swells smearing into the reverb", "Tape-delay movement smearing melodic fragments across the beat"]
          }
        },
        interplay: {
          conversation: ["melodic fragments floating detached above the beat never quite locking to it","the lead drifting loose over the rhythm deliberately behind and hazy"],
          foundation: ["a heavy swung beat anchoring everything fat and deliberately lazy"],
          arc: ["the arrangement layering in collage fashion with elements dropping in and out","wide space between hits giving the groove room to breathe"]
        },
        bannedAdd: [], bannedRemove: ["brass stabs", "trumpet"]
      },
      balearic_house: {
        label: "Balearic house",
        genre: "Balearic house",
        band: "118-124", bpm: 122, beatless: false,
        phase: "club groove, 118-124 BPM, high energy", energy: "high energy",
        palettes: {
          electronic: {
            pads: ["Warm analogue house pads with bright uplifting chords","Lush Balearic synth pad stabs with rich harmonic movement","Classic house chord stabs with warm analog tone"],
            bass: ["Heavy electric slap bass with funky rhythmic groove","Deep house bassline with warm rounded analog tone","Punchy slap-bass groove driving the track forward"],
            rhythm: ["Four-on-the-floor house drum machine groove with crisp hi-hats and clap on the backbeat","Classic house beat with punchy kick, snappy claps and open hi-hats","TR-909 house groove with tight kick, crisp hats and shakers"],
            strings: ["Bright disco string stabs supporting the groove","Subtle string textures lifting the harmonic space"],
            motif: ["Prominent house piano riff with bright rhythmic chord stabs","Uplifting piano chord progression riff driving the track","Acoustic guitar phrases with rhythmic Balearic strumming","Sunlit synth-stab riff weaving through the groove"],
            movement: ["House-style filter sweeps opening and closing across the pads","Rhythmic gating and filter movement driving the groove","Wide stereo automation across stabs and piano riffs"]
          },
          acoustic: {
            pads: ["Warm live piano chord voicings with bright rhythmic stabs driving the groove", "Sun-warmed nylon-guitar chord strumming with rhythmic Balearic movement", "Warm Rhodes chord stabs punctuating the four-on-the-floor groove"],
            bass: ["Funky electric slap bass with live percussive articulation and driving groove", "Warm fingerstyle electric bass locking a funky rhythmic house groove"],
            rhythm: ["Live-feel house groove with congas, tambourine and hand percussion over a steady four-on-the-floor kick", "Organic house beat with live percussion, shakers and a punchy driving kick"],
            strings: ["Warm live string-section stabs lifting the groove with bright energy", "Soft layered strings adding warmth beneath the piano stabs"],
            motif: ["Bright live piano riff with rhythmic chord stabs driving the track forward", "Rhythmic acoustic-guitar Balearic strumming weaving through the groove", "Warm marimba riff with rounded wooden tone dancing over the beat"],
            movement: ["Live percussion breaks and rising dynamics building into the drop", "Hand-played fills and rolls lifting the groove into a full-energy peak"]
          }
        },
        interplay: {
          conversation: ["the riff and chord stabs trading rhythmic phrases over the groove","the lead riff answering the bassline in call-and-response"],
          foundation: ["slap bass and four-on-the-floor kick locked tight and driving"],
          arc: ["the groove building through added percussion toward an open peak","filtered intro opening up into a full-energy drop"]
        },
        bannedAdd: [], bannedRemove: []
      },
      nu_disco: {
        label: "Nu-disco / slo-mo disco",
        genre: "nu-disco, slo-mo disco",
        band: "100-112", bpm: 108, beatless: false,
        phase: "chugging disco groove, 100-112 BPM, medium-high energy", energy: "medium-high energy",
        palettes: {
          electronic: {
            pads: ["Cosmic analog synth pads with retro-futuristic warmth","Lush disco synth chords with evolving tonal layers","Warm string-machine pads with cosmic shimmer"],
            bass: ["Thick driving disco bassline with funky octave movement","Chugging analog bass with steady rhythmic pulse","Deep funky synth bass locking the groove"],
            rhythm: ["Steady disco drum groove with four-on-the-floor kick, crisp hats and tambourine","Slo-mo disco beat with punchy kick, claps and shakers","Chugging disco kit with tight hats and live-feel percussion"],
            strings: ["Sweeping cosmic disco strings rising over the groove","Lush disco string stabs punctuating the rhythm"],
            motif: ["Modern synth arpeggios cycling through the mix","Funky rhythm guitar with tight percussive chords","Cosmic synth lead with retro-futuristic phrasing","Bright clavinet funk riff driving the groove"],
            movement: ["Cosmic filter sweeps and phaser movement across synths and strings","Rhythmic autopan and modulation driving the chug","Wide stereo automation across arpeggios and pads"]
          },
          acoustic: {
            pads: ["Warm live electric-piano chords with funky rhythmic comping", "Funky rhythm-guitar chord comping with tight percussive strumming"],
            bass: ["Thick funky electric bass with driving octave movement and live feel", "Warm fingerstyle disco bass groove locking the chug"],
            rhythm: ["Live disco kit with four-on-the-floor kick, tambourine, congas and crisp hats", "Organic disco groove with live percussion, claps and steady driving hats"],
            strings: ["Lush live disco string section sweeping over the groove", "Warm string stabs punctuating the funky rhythm"],
            motif: ["Funky rhythm-guitar riff with tight percussive wah-inflected chords", "Bright clavinet funk riff with punchy rhythmic bite driving the groove", "Warm Rhodes lead with disco phrasing weaving through the mix"],
            movement: ["Live percussion drive with dynamic build-ups lifting the groove", "Hand-played funk dynamics chugging steadily across the track"]
          }
        },
        interplay: {
          conversation: ["the lead and rhythm parts interlocking in a tight funk weave","the lead and chords trading phrases over the chug"],
          foundation: ["thick bass and four-on-the-floor kick chugging steady and driving"],
          arc: ["the groove chugging steadily with cosmic layers phasing in and out","tension built through filtered synths opening over the drive"]
        },
        bannedAdd: [], bannedRemove: []
      },
      melodic_deep_house: {
        label: "Melodic deep house",
        genre: "melodic deep house",
        band: "120-124", bpm: 122, beatless: false,
        phase: "deep house groove, 120-124 BPM, medium-high energy", energy: "medium-high energy",
        palettes: {
          electronic: {
            pads: ["Lush emotional synth chords with warm evolving movement","Deep warm analog pads with atmospheric depth","Rich evolving synth chord layers with soft harmonic swell"],
            bass: ["Deep rolling house bassline with warm sub weight","Warm sub bass with smooth rolling groove","Deep house bass with rounded analog tone"],
            rhythm: ["Deep house drum groove with heavy four-on-the-floor kick, crisp hats and organic percussion","Four-on-the-floor deep house beat with shakers, congas and tight hats","Driving deep house kit with punchy kick and layered percussion"],
            strings: ["Warm atmospheric string textures beneath the chords","Subtle emotional strings lifting the harmonic space"],
            motif: ["Emotive plucked synth melody weaving through the mix","Melodic synth lead with warm emotional phrasing","Soulful vocal-chop textures drifting through the mix","Bright plucked synth arpeggio rising over the groove"],
            movement: ["Warm filter movement and evolving modulation across the deep house groove","Deep atmospheric swells rising and falling over the drive","Wide stereo automation across pads and plucked melodies"]
          },
          acoustic: {
            pads: ["Warm Rhodes chord voicings with deep emotional feel drifting over the groove", "Soft live piano chord layers with warm sustained movement"],
            bass: ["Warm fingerstyle electric bass with a deep rolling groove", "Deep upright bass with rounded warm tone underpinning the drive"],
            rhythm: ["Deep house groove with live congas, shakers and organic percussion over a heavy four-on-the-floor kick", "Organic four-on-the-floor with hand percussion, tight hats and warm live feel"],
            strings: ["Warm live string textures swelling beneath the chords", "Soft layered strings lifting the groove with emotional warmth"],
            motif: ["Emotive Rhodes melody weaving warmly through the mix", "Warm marimba melodic line dancing over the deep groove", "Soulful vocal-chop textures drifting emotively through the mix"],
            movement: ["Organic percussion build with rising dynamics lifting into deep immersion", "Warm dynamic swells lifting the groove toward an emotional peak"]
          }
        },
        interplay: {
          conversation: ["the lead melody and chords rising together in warm emotional phrasing","the lead melody answered by soft chord swells"],
          foundation: ["deep rolling bass and heavy four-on-the-floor kick driving smooth and powerful"],
          arc: ["the groove building through layered percussion into deep immersion","warm chords swelling toward an emotional peak"]
        },
        bannedAdd: [], bannedRemove: []
      }
    },

    synonymBank: {
      "lazy swing groove":   ["laidback Balearic groove", "loose swing feel", "languid groove"],
      "floating pad":        ["suspended synth pad", "drifting chord pad", "ambient pad wash"],
      "Ibiza sunset":        ["Balearic dusk", "Mediterranean twilight", "golden hour atmosphere"],
      "warm sub bass":       ["deep warm sub", "analogue bass warmth", "low-frequency warmth"],
      "emotional restraint": ["emotional understatement", "restrained feeling", "subtle emotional depth"],
      "slow cinematic build":["unhurried cinematic arc", "slow-building atmosphere", "gradual cinematic reveal"],
      "no hard drops":       ["no sudden drops", "no hard transitions", "seamless flow"],
      "lush detuned pads":   ["layered detuned chords", "rich analogue pad wash", "warm detuned synth texture"],
      "tape warmth":         ["analogue warmth", "vintage tape character", "warm analogue colouring"],
      "hall reverb":         ["large hall reverb", "spacious hall reverb", "open hall reverb"]
    },

    refTracks: [
      { rank: 1,  track: "La Femme d'Argent",                 artist: "Air",                  bpm: 98,  mood: "melancholic", drum: "nearbeat",   bass: "fretless", harm: "minor7",    textures: ["Fender Rhodes", "Synth pads", "Fretless bass"] },
      { rank: 2,  track: "Kiara",                              artist: "Bonobo",               bpm: 85,  mood: "melancholic", drum: "brushed",    bass: "walking",  harm: "minor7",    textures: ["Nylon guitar", "Fender Rhodes", "Broken beat"] },
      { rank: 3,  track: "Destiny",                            artist: "Zero 7",               bpm: 88,  mood: "euphoric",    drum: "brushed",    bass: "fm",       harm: "major9",    textures: ["Strings", "Female vocal", "Gospel chords"] },
      { rank: 4,  track: "Two Thousand and Seventeen",         artist: "Four Tet",             bpm: 100, mood: "euphoric",    drum: "electronic", bass: "fm",       harm: "major9",    textures: ["Tabla", "Micro-programmed house", "Warm pads"] },
      { rank: 5,  track: "Lady and Man",                       artist: "Khruangbin",           bpm: 82,  mood: "golden",      drum: "brushed",    bass: "dub",      harm: "mixo",      textures: ["Featherlight guitar", "Reggae bass", "Ghost-note groove"] },
      { rank: 6,  track: "Lebanese Blonde",                    artist: "Thievery Corporation", bpm: 90,  mood: "dark",        drum: "congas",     bass: "fretless", harm: "dorian",    textures: ["Tabla", "Hang drum", "Modal mood"] },
      { rank: 7,  track: "Running (Four Tet Remix)",           artist: "Jessie Ware",          bpm: 96,  mood: "euphoric",    drum: "electronic", bass: "fm",       harm: "major9",    textures: ["Vocal texture", "Balearic house structure"] },
      { rank: 8,  track: "Can't Do Without You",               artist: "Caribou",              bpm: 118, mood: "meditative",  drum: "electronic", bass: "drone",    harm: "onechord",  textures: ["Vocoder stacking", "One-chord hypnosis"] },
      { rank: 9,  track: "Near Light",                         artist: "Olafur Arnalds",       bpm: 80,  mood: "meditative",  drum: "nearbeat",   bass: "drone",    harm: "minor7",    textures: ["Strings", "Prepared piano", "Micro beats"] },
      { rank: 10, track: "Space Is Only Noise If You Can See", artist: "Nicolas Jaar",         bpm: 75,  mood: "dark",        drum: "nearbeat",   bass: "drone",    harm: "chromatic", textures: ["Noir minor", "Near-beatless", "Atmospheric"] },
      { rank: 11, track: "Cherry",                             artist: "Chromatics",           bpm: 90,  mood: "dark",        drum: "motorik",    bass: "dub",      harm: "chromatic", textures: ["Motorik groove", "Italo-noir", "No builds"] },
      { rank: 12, track: "Gold Hush",                          artist: "Max Essa",             bpm: 105, mood: "golden",      drum: "electronic", bass: "fm",       harm: "major9",    textures: ["FM bass", "Warm major", "DJ-friendly"] }
    ]
  },

  // ---- Stubs: same shape, empty for now. Fleshed out in later sessions. ----
  // The batch generator reads these identically and simply skips empty parts.
    Enigma: {
    // presetMap: the human-facing Engine Preset (a recognizable Enigma character/
    // era) drives the whole sound. Each preset selects a flavour cluster (which
    // carries the instrumentation + vocal texture + genre anchor) and a default
    // palette, so instruments are set behind the scenes. Phase controls tempo.
    presetMap: {
      "Gregorian sacred (MCMXC)":     { cluster: "sacred",    palette: "electronic" },
      "Ethnic (Cross of Changes)":    { cluster: "ethnic",    palette: "blend" },
      "Cinematic distorted (Screen)": { cluster: "cinematic", palette: "electronic" },
      "Ethereal ambient":             { cluster: "ambient",   palette: "electronic" },
      "Modern (Voyageur)":            { cluster: "modern",    palette: "electronic" },
      "Breakbeat drive":              { cluster: "breakbeat", palette: "electronic" }
    },
    // Corrected against the real catalogue: Enigma writes SONGS, not soundscapes.
    // Core = hypnotic sensual downtempo beat + deep bass + lush SYNTH pads + a
    // melodic HOOK (motif slot, always on, instrumental). Chant/choir = signature
    // textural layer (strings slot). Ethnic instruments (shakuhachi, pan flute,
    // sitar, ethnic percussion, acoustic guitar) = OCCASIONAL colour that fills
    // gaps (color slot, fires ~40-55%). Every cluster carries explicit harmonic
    // direction (harmony slot) so it reads as a song, not a film cue. Six clusters
    // anchored to the eras: sacred (MCMXC), ethnic (Cross of Changes), cinematic
    // (Screen Behind the Mirror), melodic ambient, modern (Voyageur), breakbeat.
    bannedInstruments: [],
    moodBundles: {},
    flavourClusters: {

      sacred: {
        label: "Sacred downtempo",
        genre: "Enigma Style, sacred downtempo electronica",
        band: "88-96", bpm: 92, beatless: false, colorChance: 0.5,
        phase: "88-96 BPM, low-medium energy, hypnotic sensual swing", energy: "low-medium energy",
        palettes: {
          electronic: {
            pads: ["Lush dark analogue synth pads with slow evolving harmonic layers","Warm layered synth pads with a deep evolving harmonic bed","Rich analogue pad wash with soft cathedral depth"],
            harmony: ["built on a clear minor-key progression moving from verse into a lifting chorus","moving through a warm minor progression with a resolving turnaround each cycle","a modal minor chord cycle giving the track a clear verse-chorus shape"],
            bass: ["Deep sub bass with a slow hypnotic pulse anchoring the groove","Warm analogue bass with a sensual rolling low-end pulse","Deep rounded synth bass with a recurring low-end motif"],
            rhythm: ["Downtempo electronic beat with a sensual swing and soft programmed kick and snare","Slow programmed groove with a swung kick soft snare and light shaker","Hypnotic downtempo beat with a laid-back club swing and brushed electronic percussion"],
            strings: ["Layered choir wash and Gregorian-style chant texture drifting through the harmony","Soft sampled choir pad with a sacred chant texture underneath","Warm string bed blended with a distant chant layer"],
            motif: ["A clear synth lead carrying the main melodic hook with gentle repetition","A warm synth motif stating the theme and returning through the track","A melodic synth line delivering a defined vocal-style hook"],
            color: ["an occasional breathy shakuhachi phrase answering in the gaps","a brief bell and chime accent drifting through the space","a short chant fragment surfacing between phrases","an occasional bamboo flute phrase filling a gap in the arrangement"],
            movement: ["Deep cathedral reverb with long delay trails and subtle stereo movement","Wide stereo field with tempo-synced delay and evolving modulation","Warm spatial reverb with slow filter movement across the pads"]
          },
          acoustic: {
            pads: ["Warm harmonium chords breathing beneath the harmony","Soft nylon-string chord bed with warm sustained voicings"],
            harmony: ["built on a clear minor-key progression cycling through verse and chorus","a warm minor chord cycle resolving each turnaround"],
            bass: ["Warm upright bass with a slow rounded pulse","Deep fretless bass with a sensual gliding low end"],
            rhythm: ["Soft live downtempo kit with brushed snare and light hand percussion","Gentle hand-drum and shaker groove with a laid-back swing"],
            strings: ["Live choir wash with a sacred chant texture underneath","Soft-bowed string bed blended with a distant chant layer"],
            motif: ["A warm Rhodes lead carrying the main melodic hook","A nylon-guitar motif stating the melodic theme with gentle repetition"],
            color: ["an occasional shakuhachi phrase answering in the gaps","a brief hand-bell accent drifting through the space","a short chant fragment surfacing between phrases"],
            movement: ["Warm reverberant space with the players easing through the groove","Soft tape-delay drifting phrases through a deep reverb"]
          }
        },
        interplay: {
          conversation: ["the synth hook leading while the chant wash breathes beneath it","the lead motif and an occasional flute phrase trading space over the beat"],
          foundation: ["deep bass and the hypnotic downtempo beat locked in a sensual pocket"],
          arc: ["a soft intro opening into a full verse then lifting into a hook-driven chorus","the groove building through the verse and dropping back for the bridge"]
        },
        bannedAdd: [], bannedRemove: []
      },

      ethnic: {
        label: "Ethnic voyage",
        genre: "Enigma Style, ethnic downtempo electronica",
        band: "90-100", bpm: 96, beatless: false, colorChance: 0.55,
        phase: "ethnic downtempo, 90-100 BPM, medium energy, earthy melodic groove", energy: "medium energy",
        palettes: {
          electronic: {
            pads: ["Warm analogue synth pads with an earthy evolving harmonic bed","Organic-tinged synth pad wash with warm harmonic layers","Textured polysynth layers with earthy warmth"],
            harmony: ["built on a bright modal progression with a clear verse-chorus lift","a warm major-minor progression cycling with an earthy lift","a folk-modal chord cycle giving a clear melodic shape"],
            bass: ["Warm analogue bass with a steady earthy pulse","Deep sub bass with a rolling melodic low end","Rounded bass locking a warm downtempo groove"],
            rhythm: ["Downtempo electronic beat with ethnic percussion accents and a soft programmed kick","Warm programmed groove with hand-percussion accents and a laid-back swing","Steady downtempo beat with shakers congas and a soft electronic backbone"],
            strings: ["Warm string bed with a distant ethnic vocal chant texture","Soft synth strings blended with an indigenous-style chant layer","Sustained string wash under an ethnic chant texture"],
            motif: ["A clear acoustic-guitar riff carrying the main melodic hook","A melodic synth lead stating the theme with folk phrasing","A bright melodic synth hook with an ethnic-scale flavour"],
            color: ["an occasional pan flute phrase drifting over the groove","a brief sitar lick answering in the gaps","a short ethnic chant fragment surfacing between phrases","an occasional shakuhachi phrase filling a gap"],
            movement: ["Wide stereo field with rhythmic delay and evolving modulation","Warm spatial reverb with tempo-synced delay across the percussion","Deep reverb with subtle stereo drift and filter movement"]
          },
          acoustic: {
            pads: ["Warm harmonium chords breathing under the groove","Soft-strummed nylon-string chords with warm movement"],
            harmony: ["built on a bright modal progression with a clear chorus lift","a folk-modal chord cycle with an earthy resolving turnaround"],
            bass: ["Warm upright bass walking a loose earthy groove","Deep fretless bass with a rolling melodic pulse"],
            rhythm: ["Live downtempo kit with congas shakers and hand percussion","Organic groove with frame drums and light hand percussion"],
            strings: ["Live string bed with a distant ethnic chant texture","Soft-bowed strings under an indigenous-style chant layer"],
            motif: ["A steel-string acoustic-guitar riff carrying the melodic hook","A plucked-string lead stating the melodic theme with folk phrasing"],
            color: ["an occasional real pan flute phrase drifting over the groove","a brief sitar lick answering in the gaps","a short ethnic chant fragment between phrases"],
            movement: ["Warm reverberant space with the percussion breathing","Hand-played dynamics lifting and easing the groove"]
          }
        },
        interplay: {
          conversation: ["the guitar or flute hook leading while ethnic percussion moves beneath","the melodic hook and an occasional sitar phrase trading space"],
          foundation: ["warm bass and a downtempo beat with ethnic percussion locked in an earthy pocket"],
          arc: ["an acoustic intro opening into a full melodic verse and chorus","the groove building with percussion then easing for a bridge"]
        },
        bannedAdd: [], bannedRemove: []
      },

      cinematic: {
        label: "Cinematic sacral",
        genre: "Enigma Style, cinematic downtempo electronica",
        band: "92-102", bpm: 98, beatless: false, colorChance: 0.5,
        phase: "cinematic downtempo, 92-102 BPM, medium energy, dark and melodic", energy: "medium energy",
        palettes: {
          electronic: {
            pads: ["Dark cinematic synth pads with a heavy evolving harmonic bed","Shadowed analogue pad mass with orchestral depth","Deep synth pads layered with orchestral string textures"],
            harmony: ["built on a dramatic minor-key progression with a strong chorus lift","a dark minor chord cycle rising to a clear melodic peak","a cinematic minor progression with a resolving turnaround into the hook"],
            bass: ["Deep sub bass with a driving controlled pulse","Dark analogue bass with a heavy rhythmic low end","Rounded bass driving the downtempo groove with weight"],
            rhythm: ["Driving downtempo electronic beat with a firm programmed kick and snare","Mid-tempo electronic groove with a strong kick crisp snare and layered percussion","Steady driving beat with cinematic weight and tight percussion"],
            strings: ["Full orchestral choir wash in a Carmina-style sacred texture","Layered choir and orchestral strings carrying dramatic weight","Massed choir texture blended with cinematic strings"],
            motif: ["A soaring synth lead carrying a strong melodic chorus hook","A bold melodic synth motif stating a dramatic theme","A clear lead line delivering a big cinematic hook"],
            color: ["an occasional shakuhachi phrase cutting through the space","a brief electric-guitar accent answering the hook","an occasional distorted electric-guitar accent cutting through the mix","a short chant fragment surfacing between phrases","an occasional bell toll marking the phrase"],
            movement: ["Deep cathedral reverb with long delay trails and wide stereo movement","Wide cinematic stereo field with tempo-synced delay and modulation","Big spatial reverb with dramatic filter movement"]
          },
          acoustic: {
            pads: ["Dark harmonium and bowed-string chord mass with orchestral weight","Deep bowed-string chord bed swelling under the harmony"],
            harmony: ["built on a dramatic minor progression rising to a clear chorus","a dark minor chord cycle lifting into a melodic peak"],
            bass: ["Deep bowed upright bass driving the low end","Dark cello-led bass with heavy rhythmic weight"],
            rhythm: ["Live driving kit with firm snare and layered hand percussion","Mid-tempo organic groove with strong snare and percussion"],
            strings: ["Full live choir wash in a sacred cinematic texture","Massed bowed strings and choir carrying dramatic weight"],
            motif: ["A soaring string lead carrying the melodic chorus hook","A bold cello-and-choir melodic theme"],
            color: ["an occasional electric-guitar accent answering the hook","an occasional gritty distorted-guitar accent answering the hook","a brief shakuhachi phrase cutting through","a short chant fragment between phrases"],
            movement: ["Vast reverberant space with dramatic dynamic swells","Big natural reverb with the ensemble rising to a peak"]
          }
        },
        interplay: {
          conversation: ["the lead hook soaring while the choir wash swells beneath","the melodic hook and a guitar accent answering across the beat"],
          foundation: ["deep driving bass and a firm downtempo beat anchoring the drama"],
          arc: ["a dark verse building to a soaring choir-backed chorus then falling back","tension rising through the verse and released into a big melodic peak"]
        },
        // Screen-era Enigma leans on electric/distorted guitar; lift the rock-guitar
        // ban for this cluster so its occasional distorted-guitar colour can land.
        bannedAdd: [], bannedRemove: ["rock guitars"]
      },

      ambient: {
        label: "Melodic ambient",
        genre: "Enigma Style, melodic ambient electronica",
        band: "free-tempo", bpm: null, beatless: true, colorChance: 0.5,
        phase: "beatless melodic ambient, free-floating, low energy, melody-led", energy: "low energy",
        palettes: {
          electronic: {
            pads: ["Lush evolving synth pads with a warm harmonic bed","Deep ambient synth layers with slow evolving harmony","Warm analogue pad wash with soft cathedral depth"],
            harmony: ["built on a slow clear minor-key chord progression that resolves each cycle","a warm suspended progression moving gently through the piece","a modal chord cycle giving the ambient piece a clear melodic shape"],
            bass: ["Soft sub drone giving weightless low-end support","Deep tonal drone anchoring the harmony softly"],
            strings: ["Soft choir wash and chant texture drifting through the harmony","Layered choir pad carrying a sacred texture","Warm string wash blended with a distant chant layer"],
            motif: ["A clear synth lead carrying a slow melodic theme","A warm melodic synth line stating the main theme softly","A gentle lead motif delivering a defined melodic hook"],
            color: ["an occasional shakuhachi phrase drifting through the space","a brief bell and chime accent with soft decay","a short chant fragment surfacing between phrases","an occasional flute phrase filling a gap"],
            movement: ["Deep cathedral reverb with long delay trails and glacial stereo movement","Wide stereo field with slow spatial layering and evolving modulation","Reversed swells and long reverb tails drifting across the field"]
          },
          acoustic: {
            pads: ["Warm harmonium drone breathing slowly","Soft bowed-string chord bed drifting through the harmony"],
            harmony: ["built on a slow clear minor progression resolving each cycle","a warm suspended chord cycle moving gently"],
            bass: ["Low cello drone anchoring the harmony","Deep bowed drone giving a soft weightless foundation"],
            strings: ["Soft live choir wash with a chant texture","Bowed-string wash blended with a distant chant layer"],
            motif: ["A warm piano lead carrying a slow melodic theme","A soft cello lead stating the main melodic theme"],
            color: ["an occasional shakuhachi phrase drifting through","a brief hand-bell accent with soft decay","a short chant fragment between phrases"],
            movement: ["Vast natural reverb with tones drifting and dissolving","Slow dynamic swell rising and receding"]
          }
        },
        interplay: {
          conversation: ["the melodic lead drifting while the choir wash breathes beneath","the lead theme and an occasional flute phrase dissolving into the space"],
          foundation: ["a deep drone holding beneath the harmony sustaining without pulse"],
          arc: ["a slow melodic theme stated then developed with layered harmony","the piece building gently through evolving chords then dissolving"]
        },
        bannedAdd: [], bannedRemove: []
      },

      modern: {
        label: "Modern voyage",
        genre: "Enigma Style, modern electronic downtempo",
        band: "100-112", bpm: 106, beatless: false, colorChance: 0.4,
        phase: "modern electronic downtempo, 100-112 BPM, medium energy, synth-driven", energy: "medium energy",
        palettes: {
          electronic: {
            pads: ["Clean modern synth pads with a bright evolving harmonic wash","Lush contemporary synth layers with smooth harmonic movement","Polished synth pad bed with clean tonal depth"],
            harmony: ["built on a clean pop-electronic chord progression with a clear chorus lift","a bright major-key cycle with a strong resolving hook","a modern chord progression giving a clear verse-chorus shape"],
            bass: ["Warm analogue bass with a steady driving pulse","Deep sub bass with a smooth modern low-end groove","Rounded synth bass locking a tight groove"],
            rhythm: ["Clean programmed electronic beat with a steady modern groove and crisp percussion","Modern downtempo kit with a soft kick tight hats and light percussion","Controlled electronic groove with programmed drums and subtle percussion"],
            strings: ["Soft synth strings supporting the harmony","Light choir pad adding a subtle sacred hint","Smooth string texture under the harmony"],
            motif: ["A bright synth lead carrying a strong modern hook","A clean arpeggiated synth line stating the main hook","A polished synth motif delivering a clear melodic hook"],
            color: ["an occasional flute-style synth phrase over the groove","a brief bell accent marking the phrase","an occasional short chant fragment for a subtle nod"],
            movement: ["Wide stereo field with tempo-synced delay and evolving modulation","Filter and modulation movement using LFO chorus and phaser","Rhythmic autopan and tempo-synced delay creating modern space"]
          },
          acoustic: {
            pads: ["Warm electric-piano chords with smooth voicings","Soft nylon-string chord comping with warm movement"],
            harmony: ["built on a clean progression with a clear chorus lift","a bright chord cycle with a strong resolving hook"],
            bass: ["Warm fingerstyle electric bass with a smooth groove","Rounded upright bass with a steady modern pulse"],
            rhythm: ["Soft live kit with a modern downtempo groove and light percussion","Organic groove with brushed snare tight hats and warm percussion"],
            strings: ["Soft live strings supporting the harmony","Light choir wash adding a subtle sacred hint"],
            motif: ["A warm Rhodes lead carrying a modern melodic hook","A clean plucked-guitar motif stating the main hook"],
            color: ["an occasional wooden flute phrase over the groove","a brief bell accent marking the phrase"],
            movement: ["Warm reverb with players easing through the groove","Soft tape-delay drifting phrases through the mix"]
          }
        },
        interplay: {
          conversation: ["the synth hook leading with clean chords answering around it","the melodic hook and a brief flute phrase trading space over the beat"],
          foundation: ["bass and a modern programmed groove locked in a tight pocket"],
          arc: ["a clean intro building into a strong hook-driven chorus","the groove driving forward then opening for a bright bridge"]
        },
        bannedAdd: [], bannedRemove: []
      },

      breakbeat: {
        label: "Breakbeat drive",
        genre: "Enigma Style, atmospheric breakbeat electronica",
        band: "118-126", bpm: 122, beatless: false, colorChance: 0.45,
        phase: "driving breakbeat, 118-126 BPM, medium-high energy", energy: "medium-high energy",
        palettes: {
          electronic: {
            pads: ["Warm analogue synth pads sitting behind the breaks","Deep atmospheric pad wash under the groove","Dark evolving synth pads with a wide harmonic bed"],
            harmony: ["built on a driving minor-key progression with a clear hook","a dark minor chord cycle pushing the groove forward","a modal progression giving the breaks a clear melodic shape"],
            bass: ["Deep sub bass with a driving rhythmic pulse locking the breaks","Warm analogue bass with punchy movement under the groove","Rounded synth bass driving the low end with momentum"],
            rhythm: ["Driving chopped hip-hop breakbeat with punchy kick crisp snare and tight hats","Energetic breakbeat groove with syncopated hip-hop drums and layered percussion","Uptempo broken-beat with hard snare hits and rolling hats"],
            strings: ["Choir wash and chant texture drifting over the breaks","Warm string bed under the driving groove","Layered choir texture adding atmosphere over the breaks"],
            motif: ["A synth lead cutting through with a driving melodic hook","A bold synth motif stating the theme over the breaks","A clear lead line delivering a strong hook over the groove"],
            color: ["an occasional shakuhachi phrase weaving over the breaks","a brief chant fragment surfacing in the groove","an occasional bell accent punctuating the breaks"],
            movement: ["Wide stereo field with tempo-synced delay and evolving modulation","Rhythmic autopan and delay driving movement across the breaks","Filter sweeps opening over the breakbeat drive"]
          },
          acoustic: {
            pads: ["Warm harmonium chords behind the breaks","Soft-strummed nylon-string chords with rhythmic movement"],
            harmony: ["built on a driving minor progression with a clear hook","a dark chord cycle pushing the groove"],
            bass: ["Warm fingerstyle electric bass driving the breaks","Deep upright bass with a driving pulse"],
            rhythm: ["Live chopped hip-hop breakbeat with punchy live drums and layered hand percussion","Energetic broken-beat kit with hard snare congas and rolling hats"],
            strings: ["Live choir wash drifting over the breaks","Warm bowed strings under the driving groove"],
            motif: ["A steel-string guitar riff cutting through with a driving hook","A bold melodic lead stating the theme over the breaks"],
            color: ["an occasional pan flute phrase weaving over the breaks","a brief chant fragment in the groove"],
            movement: ["Warm reverberant space with dynamic drive","Hand-played dynamics pushing the breaks"]
          }
        },
        interplay: {
          conversation: ["the lead hook cutting through while chant texture drifts over the breaks","the melodic hook and an occasional flute phrase riding the groove"],
          foundation: ["deep bass and chopped breakbeat locked in a hard driving pocket"],
          arc: ["the breaks driving hard then dropping to atmosphere and rebuilding","energy pushing forward through the breaks into a hook-driven peak"]
        },
        // Enigma's negative bans "hip hop beats"; this cluster deliberately uses a
        // hip-hop-derived breakbeat, so lift that one token here.
        bannedAdd: [], bannedRemove: ["hip hop beats"]
      }

    },
    synonymBank: {}, refTracks: []
  },

  Delerium:             { bannedInstruments: [], moodBundles: {}, flavourClusters: {}, synonymBank: {}, refTracks: [] },
  Era:                  { bannedInstruments: [], moodBundles: {}, flavourClusters: {}, synonymBank: {}, refTracks: [] },
  "Composer-Orchestral":{ bannedInstruments: [], moodBundles: {}, flavourClusters: {}, synonymBank: {}, refTracks: [] },
  "Composer-Electronic":{ bannedInstruments: [], moodBundles: {}, flavourClusters: {}, synonymBank: {}, refTracks: [] },
  Producer:             { bannedInstruments: [], moodBundles: {}, flavourClusters: {}, synonymBank: {}, refTracks: [] },
  Remixer:              { bannedInstruments: [], moodBundles: {}, flavourClusters: {}, synonymBank: {}, refTracks: [] }
};

/*
 * layerKeepOut(shared, add, remove)
 * Shared helper: shared + add, then drop anything in remove (case-insensitive),
 * de-duplicated. Used by both the mood and cluster resolvers.
 */
function layerKeepOut(shared, add, remove) {
  const removeLower = (remove || []).map(s => s.toLowerCase());
  const combined = [...(shared || []), ...(add || [])];
  const seen = new Set();
  const result = [];
  for (const item of combined) {
    const key = item.toLowerCase();
    if (removeLower.includes(key)) continue; // this entry is allowed to use it
    if (seen.has(key)) continue;             // avoid duplicates
    seen.add(key);
    result.push(item);
  }
  return result;
}

/*
 * resolveKeepOut(engineName, moodName)
 * Effective keep-out list for an engine + mood. Safe on stubs (returns []).
 */
function resolveKeepOut(engineName, moodName) {
  const engine = EngineExtras[engineName];
  if (!engine) return [];
  const mood = (engine.moodBundles && engine.moodBundles[moodName]) || {};
  return layerKeepOut(engine.bannedInstruments, mood.bannedAdd, mood.bannedRemove);
}

/*
 * resolveClusterKeepOut(engineName, clusterId)
 * Effective keep-out list for an engine + flavour cluster. Safe on stubs ([]).
 */
function resolveClusterKeepOut(engineName, clusterId) {
  const engine = EngineExtras[engineName];
  if (!engine) return [];
  const cluster = (engine.flavourClusters && engine.flavourClusters[clusterId]) || {};
  return layerKeepOut(engine.bannedInstruments, cluster.bannedAdd, cluster.bannedRemove);
}

/*
 * drawClusterRoles(engineName, clusterId)
 * Role-pool draw (2026-06-28 decision): returns ONE option per populated role
 * (lead, harmony, bass, texture) for the given cluster, picked at random from
 * that role's pool. A cluster that doesn't define a role simply has no entry
 * in the returned object - callers should skip absent roles rather than
 * assume all four are present (e.g. "nocturnal" has no harmony-instrument
 * role; "ambient" has no bass role).
 *
 * Every draw is independent, so repeated calls for the same cluster yield
 * varied combinations across a batch while staying inside the cluster's
 * pre-vetted character (the pools are the variety mechanism; curation of
 * what's IN each pool is the character guarantee).
 *
 * Returns {} for an unknown engine/cluster or a cluster with no roles yet
 * (safe on stub engines and not-yet-ported clusters).
 */
function drawClusterRoles(engineName, clusterId) {
  const engine = EngineExtras[engineName];
  if (!engine) return {};
  const cluster = (engine.flavourClusters && engine.flavourClusters[clusterId]) || {};
  const roles = cluster.roles || {};
  const drawn = {};
  for (const roleName of Object.keys(roles)) {
    const pool = roles[roleName];
    if (Array.isArray(pool) && pool.length) {
      drawn[roleName] = pool[Math.floor(Math.random() * pool.length)];
    }
  }
  return drawn;
}

/*
 * drawInterplay(engineName, clusterId)
 * The arrangement / interplay layer (the "score", not the "cast"). Returns ONE
 * phrase from each populated arrangement dimension the cluster defines:
 *   conversation - how melodic voices relate (call-and-response, counterpoint,
 *                  register separation, dialogue)
 *   foundation   - how bass and groove lock or float beneath
 *   arc          - how density and dynamics evolve across the track
 * Phrases reference voices by FUNCTION only (lead, chords, bass, groove,
 * layers) and never re-name a specific instrument, so they layer cleanly on top
 * of whatever the role draw produced - no double-naming, no contradictions. A
 * cluster only defines the dimensions that make sense for it (e.g. ambient has
 * no bass-driven foundation in the usual sense; it speaks of drones instead).
 * Returns [] safely for unknown engines/clusters or clusters with no interplay.
 */
function drawInterplay(engineName, clusterId) {
  const engine = EngineExtras[engineName];
  if (!engine) return [];
  const cluster = (engine.flavourClusters && engine.flavourClusters[clusterId]) || {};
  const ip = cluster.interplay || {};
  const order = ["conversation", "foundation", "arc"];
  const out = [];
  for (const dim of order) {
    const pool = ip[dim];
    if (Array.isArray(pool) && pool.length) {
      out.push(pool[Math.floor(Math.random() * pool.length)]);
    }
  }
  return out;
}


Object.assign(window.__ATMOS, { drawInterplay, EngineExtras });
})();

/* legacy/prompt-style-builder.js */
(function(){
/* ============================================================================
 * prompt-style-builder.js  -  turns selections into Suno payloads (BUILDER)
 *
 * Two build paths, both emit the validated format (a comma-separated descriptor
 * list, genre-anchored at the front):
 *   - classic slot path  : reads state.style.{phase,pad,bass,rhythm,percussion,
 *                          motif,movement} — the per-engine slot arrays.
 *   - flavour-cluster path: Balearic-validated. Reads a cluster fingerprint from
 *                          EngineExtras with an Electronic/Acoustic/Blend palette.
 *
 * buildStylePrompt/buildNegativePrompt are the entry points; they route to the
 * cluster path when state.style.buildMode === "cluster" AND the selected engine
 * actually defines the chosen cluster (otherwise they fall back to classic).
 *
 * State note: this app uses NESTED state — style fields live under state.style,
 * the engine name at state.engine. Era bias is a Lyric-engine control only and
 * is intentionally NOT in the style payload.
 * ==========================================================================*/
const {MASTERING, MAX_MODE_STR, STYLE_ENGINES} = window.__ATMOS;
const {EngineExtras, drawInterplay} = window.__ATMOS;

/* join descriptor parts into one clean comma line, drop trailing periods, honour
 * the 1000-char budget, lead with the MAX-mode meta-tag block when enabled. */
function assembleDescriptors(parts, maxMode) {
  const descriptors = parts
    .filter(Boolean)
    .map(p => String(p).replace(/\s*\.\s*$/, ""))
    .join(", ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .replace(/,\s*,/g, ", ")
    .trim();
  const out = maxMode ? (MAX_MODE_STR + "\n" + descriptors) : descriptors;
  return out.length <= 1000 ? out : out.slice(0, 997).trimEnd() + "...";
}

/* Instrumental is NOT declared in the style field (unreliable in Suno); the
 * reliable control is the [Instrumental] lyrics tag (buildLyricsField) + Suno's
 * own Instrumental toggle. Descriptor/Persona describe a WANTED vocal, so they
 * stay in the style prompt. */
function buildVocalPhrase(state) {
  const s = state.style;
  if (s.vocalMode === "Instrumental") return "";
  if (s.vocalMode === "Persona") return s.vocalPersona ? `vocal persona: ${s.vocalPersona}` : "";
  if (s.vocalMode === "Descriptor") return s.vocalDescriptor ? `vocal descriptor: ${s.vocalDescriptor}` : "";
  return "";
}

function buildLyricsField(state) {
  return state.style.vocalMode === "Instrumental" ? "[Instrumental]" : "";
}

/* ---- non-musical bans (every prompt) + beatless drum guard --------------- */
const ALWAYS_BAN = [
  "field recordings", "air texture", "room tone", "foley", "sound effects",
  "vinyl crackle", "tape hiss", "nature sounds", "ambient noise"
];
const BEATLESS_BAN = [
  "drums", "drum kit", "kick drum", "beat", "percussion", "hi-hats", "snare"
];

/* ---- flavour-cluster path (Balearic-validated) --------------------------- */
function buildClusterPrompt(clusterId, state) {
  const engineName = state.engine;
  const s = state.style;
  const engine = EngineExtras[engineName] || {};
  const c = (engine.flavourClusters || {})[clusterId];
  if (!c) return "";
  const pick = pool => (Array.isArray(pool) && pool.length)
    ? pool[Math.floor(Math.random() * pool.length)] : null;
  const palette = s.palette || "electronic";
  const E = (c.palettes && c.palettes.electronic) || {};
  const A = (c.palettes && c.palettes.acoustic) || {};
  // Electronic (proven default). Acoustic pulls the characterful pools. Blend
  // keeps the electronic production backbone (pads, rhythm, movement) and lets
  // the character slots (bass, strings, motif) pull from either palette per-song.
  function slot(name) {
    if (palette === "acoustic") return pick(A[name]) || pick(E[name]);
    if (palette === "blend") {
      const character = (name === "bass" || name === "strings" || name === "motif");
      if (character && Array.isArray(A[name]) && A[name].length && Math.random() < 0.5)
        return pick(A[name]);
      return pick(E[name]);
    }
    return pick(E[name]); // electronic
  }
  const presetDriven = !!(engine.presetMap);
  let tempo;
  if (c.beatless) {
    // Beatless stays beatless (no BPM), but in preset-driven mode let the Phase's
    // energy band still apply so ambient responds to the energy control.
    if (presetDriven && s.phase) {
      const energy = (s.phase.match(/([a-z-]+(?:\s+to\s+[a-z-]+)?\s+energy)/i) || [])[1];
      const base = c.phase.replace(/,?\s*[a-z-]+(?:\s+to\s+[a-z-]+)?\s+energy/i, "").replace(/,\s*,/g, ",").replace(/,\s*$/, "").trim();
      tempo = energy ? `${base}, ${energy}` : c.phase;
    } else tempo = c.phase;
  }
  else if (s.bpmOverride) tempo = s.bpmOverride + " BPM, " + (c.energy || "medium energy");
  else if (presetDriven && s.phase) tempo = s.phase;                 // Preset sets character, Phase sets tempo
  else tempo = c.phase;
  const arrangement = (s.arrangement && c.interplay)
    ? drawInterplay(engineName, clusterId).join(", ") : null;
  const colorPick = slot("color");
  const colorChance = (typeof c.colorChance === "number") ? c.colorChance : 0.5;
  const color = (colorPick && Math.random() < colorChance) ? colorPick : null;
  const parts = [
    c.genre || STYLE_ENGINES[engineName].genre,  // genre anchor (per-cluster, else engine default)
    tempo,                                // BPM range + energy (or override number)
    slot("pads"),
    slot("harmony"),                      // harmonic + song-structure direction
    slot("bass"),
    c.beatless ? null : slot("rhythm"),
    slot("strings"),                      // string / choir / chant bed
    slot("motif"),                        // always-on melodic hook (instrumental)
    color,                                // occasional colour, fills gaps
    arrangement,                          // optional interplay layer
    slot("movement"),                     // production movement
    buildVocalPhrase(state),
    MASTERING
  ];
  return assembleDescriptors(parts, s.maxMode);
}

function buildClusterNegative(clusterId, state) {
  const engineName = state.engine;
  const s = state.style;
  const engine = EngineExtras[engineName] || {};
  const c = (engine.flavourClusters || {})[clusterId] || {};
  const items = [
    (STYLE_ENGINES[engineName] || {}).sourceNegative,
    ...ALWAYS_BAN,
    ...(c.beatless ? BEATLESS_BAN : []),
    ...(c.bannedAdd || []),
    s.negativePrompt
  ].filter(Boolean);
  const removeSet = new Set((c.bannedRemove || []).map(
    x => x.replace(/^[-\s]+/, "").trim().toLowerCase()));
  const seen = new Set();
  const out = [];
  for (const it of items.join(", ").split(",").map(x => x.trim()).filter(Boolean)) {
    const bare = it.replace(/^[-\s]+/, "").trim().toLowerCase();
    if (removeSet.has(bare)) continue;
    if (seen.has(bare)) continue;
    seen.add(bare); out.push(it);
  }
  return out.join(", ");
}

/* ---- classic slot path (any engine) ------------------------------------- */
function buildClassicStyle(state) {
  const e = STYLE_ENGINES[state.engine];
  const s = state.style;
  const parts = [
    e.genre,        // genre anchor, front-weighted
    s.phase,        // tempo + energy/feel only
    s.pad,          // slots = single source of truth for instrumentation
    s.bass,
    s.rhythm,
    s.percussion,
    s.motif,
    s.movement,
    buildVocalPhrase(state),
    MASTERING
  ];
  return assembleDescriptors(parts, s.maxMode);
}

function clusterActive(state) {
  const s = state.style;
  if (s.buildMode !== "cluster") return false;
  const engine = EngineExtras[state.engine] || {};
  return !!(engine.flavourClusters || {})[s.cluster];
}

/* Preset-driven engines (those with a presetMap, e.g. Enigma): the Engine Preset
 * IS the character selector and maps to a flavour cluster, so instrumentation is
 * set behind the scenes. Returns the cluster id for the current preset, or null. */
function presetCluster(state) {
  const map = (EngineExtras[state.engine] || {}).presetMap;
  const hit = map && map[state.style.preset];
  return hit ? hit.cluster : null;
}

/* ---- entry points (app.js calls these) ---------------------------------- */
function buildStylePrompt(state) {
  const pc = presetCluster(state);
  if (pc) return buildClusterPrompt(pc, state);
  if (clusterActive(state)) return buildClusterPrompt(state.style.cluster, state);
  return buildClassicStyle(state);
}

function buildNegativePrompt(state) {
  const pc = presetCluster(state);
  if (pc) return buildClusterNegative(pc, state);
  if (clusterActive(state)) return buildClusterNegative(state.style.cluster, state);
  const e = STYLE_ENGINES[state.engine];
  return [e.sourceNegative || e.negatives, state.style.negativePrompt].filter(Boolean).join(", ");
}

Object.assign(window.__ATMOS, { buildLyricsField, buildClusterPrompt, buildClusterNegative, buildStylePrompt, buildNegativePrompt });
})();

/* js/registry.js */
(function(){
// Engine registry (Option B): two engine KINDS live in one shell.
//   'resolver' — new engine-agnostic resolver (Delerium; Era/Deep Forest slot in here later)
//   'legacy'   — proven cluster/classic path harvested verbatim (Balearic, Enigma)
//   'stub'     — registered scope, not yet built (Era, Deep Forest)
const {DELERIUM} = window.__ATMOS;
const {ERA} = window.__ATMOS;
const {EngineExtras} = window.__ATMOS;
const {STYLE_ENGINES} = window.__ATMOS;

const ENGINES = [
  { id: 'Balearic',    kind: 'legacy',   label: 'Balearic' },
  { id: 'Enigma',      kind: 'legacy',   label: 'Enigma' },
  { id: 'Delerium',    kind: 'resolver', label: 'Delerium', module: DELERIUM },
  { id: 'Era',         kind: 'resolver', label: 'Era', module: ERA },
  { id: 'Deep Forest', kind: 'stub',     label: 'Deep Forest' },
];

function getEngine(id) {
  return ENGINES.find(e => e.id === id);
}

// ---- resolver-kind helpers -------------------------------------------------
const RESOLVER_ROLES = ['pads', 'harmony', 'bass', 'lead', 'voice', 'color', 'movement'];

function resolverCharacters(module) {
  return Object.keys(module.characters).map(id => {
    const c = module.characters[id];
    const tempo = c.beatless ? 'beatless' : `${c.bpm[0]}\u2013${c.bpm[1]} BPM`;
    return { id, label: c.label, source: c.source, tempo };
  });
}

// filtered pool for one role/character/palette -> [{value,label}] for a <select>
function resolverRolePool(module, characterId, role, palette) {
  const pool = (module.characters[characterId].pools[role]) || [];
  const keep = pool.filter(o =>
    palette === 'blend' ? true :
    palette === 'electronic' ? (o.d === 'E' || o.d === 'B') :
    (o.d === 'A' || o.d === 'B'));
  return (keep.length ? keep : pool).map(o => ({ value: o.t, label: o.t }));
}

// ---- legacy-kind helpers ---------------------------------------------------
function legacyPresetMap(id) { return (EngineExtras[id] || {}).presetMap || null; }
function legacyClusters(id)  { return Object.keys((EngineExtras[id] || {}).flavourClusters || {}); }
function legacyClassic(id)   {
  const e = STYLE_ENGINES[id] || {};
  return {
    presets: e.presets || [],
    phases: e.phases || [],
    slots: {
      pad: e.pads || [], bass: e.bass || [], rhythm: e.rhythm || [],
      percussion: e.percussion || [], motif: e.motifs || [], movement: e.movement || [],
    },
  };
}

Object.assign(window.__ATMOS, { getEngine, resolverCharacters, resolverRolePool, legacyPresetMap, legacyClusters, legacyClassic, ENGINES, RESOLVER_ROLES });
})();

/* js/state.js */
(function(){
// Shell state. Two control sub-states (resolver vs legacy); the active one is
// chosen by the selected engine's kind. Kept deliberately small — the modifier
// overlays and the Lyric/Metatag engine will add their own sub-states later
// without touching this shape.
const {getEngine, resolverCharacters, legacyPresetMap, legacyClusters, legacyClassic} = window.__ATMOS;

function newSeed() { return (Math.random() * 2147483647) >>> 0; }

function initState() {
  // maxMode is global (persists across engine switches); res/leg are per-kind.
  const S = { engineId: 'Delerium', seed: newSeed(), maxMode: false, res: null, leg: null };
  syncEngineDefaults(S, 'Delerium');
  return S;
}

// (Re)build the control sub-state when the engine changes.
function syncEngineDefaults(S, engineId) {
  S.engineId = engineId;
  S.seed = newSeed();
  const eng = getEngine(engineId);

  if (eng.kind === 'resolver') {
    const chars = resolverCharacters(eng.module);
    S.res = {
      characterId: chars[0].id,
      palette: 'electronic',
      level: 'random',          // 'random' | 'lockSome' | 'manual'
      locks: {},                // role -> chosen text (only in lockSome/manual)
    };
    S.leg = null;
  } else if (eng.kind === 'legacy') {
    const presetMap = legacyPresetMap(engineId);
    const clusters = legacyClusters(engineId);
    const classic = legacyClassic(engineId);
    S.leg = {
      presetDriven: !!presetMap,
      engineMode: 'preset',      // preset-driven engines (Enigma): 'preset' | 'manual'
      preset: presetMap ? Object.keys(presetMap)[0] : (classic.presets[0] || ''),
      phase: classic.phases[0] || '',
      buildMode: clusters.length ? 'cluster' : 'classic',
      cluster: clusters[0] || '',
      palette: 'electronic',
      arrangement: false,
      bpmOverride: '',
      slots: {
        pad: classic.slots.pad[0] || '', bass: classic.slots.bass[0] || '',
        rhythm: classic.slots.rhythm[0] || '', percussion: classic.slots.percussion[0] || '',
        motif: classic.slots.motif[0] || '', movement: classic.slots.movement[0] || '',
      },
      slotLevel: 'random',       // classic manual: 'random' | 'lockSome' | 'manual'
      slotLocks: {},             // role -> chosen value (classic slot roles)
      vocalMode: 'Instrumental',
    };
    S.res = null;
  } else {
    S.res = null; S.leg = null;   // stub
  }
}

Object.assign(window.__ATMOS, { newSeed, initState, syncEngineDefaults });
})();

/* js/generate.js */
(function(){
// Routes a generate request to the right path for the engine's kind and returns a
// uniform result: { style, negative, lyrics, length, over }.
// Max Mode (global S.maxMode) prepends the MAX directive block for every engine:
//   - legacy engines apply it through their proven maxMode path (byte-identical to old app)
//   - resolver engines get it here in the router
const {getEngine, legacyClassic} = window.__ATMOS;
const {build} = window.__ATMOS;
const {CHAR_LIMIT, rng} = window.__ATMOS;
const {MAX_MODE_STR} = window.__ATMOS;
const {buildStylePrompt, buildNegativePrompt, buildLyricsField} = window.__ATMOS;

function applyMax(style, on) {
  if (!on) return style;
  const out = MAX_MODE_STR + '\n' + style;
  return out.length <= CHAR_LIMIT ? out : out.slice(0, CHAR_LIMIT - 3).trimEnd() + '...';
}

function generate(S) {
  const eng = getEngine(S.engineId);

  if (eng.kind === 'resolver') {
    const r = S.res;
    const locks = (r.level === 'random') ? {} : r.locks;
    const out = build(eng.module, {
      characterId: r.characterId, palette: r.palette, locks, seed: S.seed,
    });
    const style = applyMax(out.style, S.maxMode);
    return {
      style, negative: out.negative, lyrics: '',
      length: style.length, over: style.length > CHAR_LIMIT, arrangement: out.arrangement,
    };
  }

  if (eng.kind === 'legacy') {
    const state = toLegacyState(S);            // proven builder handles maxMode itself
    const style = buildStylePrompt(state);
    return {
      style,
      negative: buildNegativePrompt(state),
      lyrics: buildLyricsField(state),
      length: style.length,
      over: style.length > CHAR_LIMIT,
    };
  }

  return { style: '', negative: '', lyrics: '', length: 0, over: false, stub: true };
}

// Resolve classic slots for the 3-level manual control (Randomize all / Lock some / Full manual).
// Each role is either locked (chosen) or drawn fresh from the proven STYLE_ENGINES array.
function resolveClassicSlots(engineId, l, seed) {
  const arrs = legacyClassic(engineId).slots;   // {pad:[],bass:[],rhythm:[],percussion:[],motif:[],movement:[]}
  const roll = rng(seed);
  const rand = a => (a && a.length) ? a[Math.floor(roll() * a.length)] : '';
  const out = {};
  ['pad', 'bass', 'rhythm', 'percussion', 'motif', 'movement'].forEach(role => {
    if (l.slotLevel === 'random') out[role] = rand(arrs[role]);
    else {
      const locked = l.slotLocks[role];
      out[role] = (locked != null && locked !== '') ? locked : rand(arrs[role]);
    }
  });
  return out;
}

// Map the shell's legacy sub-state onto the nested shape the proven builder reads.
function toLegacyState(S) {
  const l = S.leg;

  // Classic slot path with the 3-level control: Enigma 'Manual mix' OR Balearic 'Classic mix'.
  const classicManual = (l.presetDriven && l.engineMode === 'manual') || (!l.presetDriven && l.buildMode === 'classic');
  if (classicManual) {
    const s = resolveClassicSlots(S.engineId, l, S.seed);
    return {
      engine: S.engineId,
      style: {
        buildMode: 'classic', cluster: '', preset: '',   // unmapped preset -> classic path
        palette: l.palette, arrangement: false, bpmOverride: '',
        phase: l.phase,
        pad: s.pad, bass: s.bass, rhythm: s.rhythm, percussion: s.percussion, motif: s.motif, movement: s.movement,
        vocalMode: l.vocalMode, vocalDescriptor: '', vocalPersona: '',
        maxMode: S.maxMode, negativePrompt: '',
      },
    };
  }

  return {
    engine: S.engineId,
    style: {
      buildMode: l.presetDriven ? 'classic' : l.buildMode, // preset-driven auto-routes via presetMap
      cluster: l.cluster,
      palette: l.palette,
      arrangement: l.arrangement,
      bpmOverride: l.bpmOverride,
      preset: l.preset,
      phase: l.phase,
      pad: l.slots.pad, bass: l.slots.bass, rhythm: l.slots.rhythm,
      percussion: l.slots.percussion, motif: l.slots.motif, movement: l.slots.movement,
      vocalMode: l.vocalMode, vocalDescriptor: '', vocalPersona: '',
      maxMode: S.maxMode, negativePrompt: '',
    },
  };
}

Object.assign(window.__ATMOS, { generate });
})();

/* js/ui.js */
(function(){
const {ENGINES, getEngine, RESOLVER_ROLES, resolverCharacters, resolverRolePool, legacyClusters, legacyClassic,} = window.__ATMOS;
const {syncEngineDefaults, newSeed} = window.__ATMOS;
const {generate} = window.__ATMOS;

// ---- tiny DOM helpers ------------------------------------------------------
function el(tag, attrs = {}, kids = []) {
  const n = document.createElement(tag);
  for (const k in attrs) {
    if (k === 'class') n.className = attrs[k];
    else if (k === 'text') n.textContent = attrs[k];
    else if (k === 'html') n.innerHTML = attrs[k];
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), attrs[k]);
    else n.setAttribute(k, attrs[k]);
  }
  (Array.isArray(kids) ? kids : [kids]).forEach(c => c && n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
  return n;
}
function field(label, control) { return el('label', { class: 'field' }, [el('span', { class: 'field-label', text: label }), control]); }
function select(options, value, onchange) {
  const s = el('select', { onchange: e => onchange(e.target.value) });
  options.forEach(o => {
    const opt = el('option', { value: o.value }, o.label);
    if (o.value === value) opt.selected = true;
    s.appendChild(opt);
  });
  return s;
}
function segmented(options, value, onpick) {
  return el('div', { class: 'seg' }, options.map(o =>
    el('button', { class: o.value === value ? 'active' : '', text: o.label, onclick: () => onpick(o.value) })));
}

// Shared 3-level control (Randomize all / Lock some / Full manual) over any role set.
// opts: { roles, labelFor, optionsFor(role)->[{value,label}], level, onLevel(v), locks }
function lockControl(root, opts) {
  root.appendChild(field('Control level', segmented(
    [['random', 'Randomize all'], ['lockSome', 'Lock some'], ['manual', 'Full manual']].map(([value, label]) => ({ value, label })),
    opts.level, v => opts.onLevel(v))));
  if (opts.level === 'random') return;
  const box = el('div', { class: 'locks' });
  opts.roles.forEach(role => {
    const options = [{ value: '', label: '\uD83C\uDFB2 random' }, ...opts.optionsFor(role)];
    const cur = opts.locks[role] != null ? opts.locks[role] : '';
    box.appendChild(field(opts.labelFor(role),
      select(options, cur, v => { if (v === '') delete opts.locks[role]; else opts.locks[role] = v; refreshOutput(); })));
  });
  root.appendChild(box);
}
function classicSlotLabel(role) {
  return { pad: 'Pad', bass: 'Bass', rhythm: 'Rhythm', percussion: 'Percussion', motif: 'Motif', movement: 'Movement' }[role] || role;
}
const CLASSIC_ROLES = ['pad', 'bass', 'rhythm', 'percussion', 'motif', 'movement'];

// ---- module state ----------------------------------------------------------
let S, rootEl;
function mount(state, root) { S = state; rootEl = root; renderAll(); }

function renderAll() {
  rootEl.innerHTML = '';
  rootEl.appendChild(el('div', { class: 'tabs' }, ENGINES.map(e => {
    const disabled = e.kind === 'stub';
    return el('button', {
      class: 'tab' + (e.id === S.engineId ? ' active' : '') + (disabled ? ' disabled' : ''),
      onclick: () => { if (!disabled) { syncEngineDefaults(S, e.id); renderAll(); } },
    }, [el('span', { text: e.label }), el('span', { class: 'kind', text: e.kind === 'resolver' ? 'resolver' : e.kind === 'legacy' ? 'proven' : 'soon' })]);
  })));

  const grid = el('div', { class: 'grid' });
  const controls = el('div', { class: 'panel controls' });
  const output = el('div', { class: 'panel output', id: 'output' });
  grid.appendChild(controls); grid.appendChild(output);
  rootEl.appendChild(grid);

  const eng = getEngine(S.engineId);
  if (eng.kind === 'resolver') renderResolverControls(controls, eng);
  else if (eng.kind === 'legacy') renderLegacyControls(controls, eng);
  else renderStub(controls, eng);

  refreshOutput();
}

// ---- resolver controls -----------------------------------------------------
function renderResolverControls(root, eng) {
  const r = S.res;
  const chars = resolverCharacters(eng.module);
  const c = eng.module.characters[r.characterId];

  root.appendChild(field('Character',
    select(chars.map(x => ({ value: x.id, label: `${x.label} \u2014 ${x.source} \u2014 ${x.tempo}` })), r.characterId,
      v => { r.characterId = v; r.locks = {}; renderAll(); })));

  root.appendChild(field('Palette',
    segmented([['electronic', 'Electronic'], ['acoustic', 'Acoustic'], ['blend', 'Blend']].map(([value, label]) => ({ value, label })),
      r.palette, v => { r.palette = v; r.locks = {}; renderAll(); })));

  lockControl(root, {
    roles: RESOLVER_ROLES.filter(role => !(role === 'color' && c.colorChance === 0)),
    labelFor: roleLabel,
    optionsFor: role => resolverRolePool(eng.module, r.characterId, role, r.palette),
    level: r.level,
    onLevel: v => { r.level = v; r.locks = {}; if (v === 'manual') seedManualLocks(eng, r); renderAll(); },
    locks: r.locks,
  });

  const drums = c.beatless ? 'Beatless (no drum pool)' : `Auto \u2014 ${c.drums.primary} family`;
  root.appendChild(el('p', { class: 'note', text: `Drums: ${drums}. Colour fires ~${Math.round(c.colorChance * 100)}% of draws.` }));

  root.appendChild(buttons());
}
function seedManualLocks(eng, r) {
  const c = eng.module.characters[r.characterId];
  RESOLVER_ROLES.forEach(role => {
    if (role === 'color' && c.colorChance === 0) return;
    const pool = resolverRolePool(eng.module, r.characterId, role, r.palette);
    if (pool.length) r.locks[role] = pool[0].value;
  });
}
function roleLabel(role) {
  return { pads: 'Pads', harmony: 'Harmony', bass: 'Bass', lead: 'Lead', voice: 'Voice', color: 'Colour', movement: 'Movement' }[role] || role;
}
function seedClassicManual(engineId, l) {
  const arrs = legacyClassic(engineId).slots;
  CLASSIC_ROLES.forEach(role => { const a = arrs[role] || []; if (a.length) l.slotLocks[role] = a[0]; });
}

// ---- legacy controls -------------------------------------------------------
function renderLegacyControls(root, eng) {
  const l = S.leg;

  if (l.presetDriven) {
    root.appendChild(field('Engine mode',
      segmented([['preset', 'Engine preset'], ['manual', 'Manual mix']].map(([value, label]) => ({ value, label })),
        l.engineMode, v => { l.engineMode = v; renderAll(); })));

    if (l.engineMode === 'preset') {
      const map = (window.__ATMOS.EngineExtras[eng.id] || {}).presetMap;
      root.appendChild(field('Engine preset',
        select(Object.keys(map).map(k => ({ value: k, label: k })), l.preset,
          v => { l.preset = v; refreshOutput(); })));
      root.appendChild(field('Phase (tempo / energy)',
        select(legacyClassic(eng.id).phases.map(p => ({ value: p, label: p })), l.phase,
          v => { l.phase = v; refreshOutput(); })));
      root.appendChild(field('Palette',
        segmented(seg3(), l.palette, v => { l.palette = v; refreshOutput(); })));
      root.appendChild(toggle('Arrangement language', l.arrangement, v => { l.arrangement = v; refreshOutput(); }));
      root.appendChild(field('Vocal', segmented(vocalSeg(), l.vocalMode, v => { l.vocalMode = v; refreshOutput(); })));
      root.appendChild(buttons());
      return;
    }

    // manual mix — proven classic slot path with the same 3-level control as Delerium
    root.appendChild(field('Phase (tempo / energy)',
      select(legacyClassic(eng.id).phases.map(p => ({ value: p, label: p })), l.phase, v => { l.phase = v; refreshOutput(); })));
    lockControl(root, {
      roles: CLASSIC_ROLES,
      labelFor: classicSlotLabel,
      optionsFor: role => (legacyClassic(eng.id).slots[role] || []).map(x => ({ value: x, label: x })),
      level: l.slotLevel,
      onLevel: v => { l.slotLevel = v; l.slotLocks = {}; if (v === 'manual') seedClassicManual(eng.id, l); renderAll(); },
      locks: l.slotLocks,
    });
    root.appendChild(field('Vocal', segmented(vocalSeg(), l.vocalMode, v => { l.vocalMode = v; refreshOutput(); })));
    root.appendChild(buttons());
    return;
  }

  // fork engine (Balearic): Flavour cluster / Classic mix
  root.appendChild(field('Build mode',
    segmented([['cluster', 'Flavour cluster'], ['classic', 'Classic mix']].map(([value, label]) => ({ value, label })),
      l.buildMode, v => { l.buildMode = v; renderAll(); })));

  if (l.buildMode === 'cluster') {
    root.appendChild(field('Cluster',
      select(legacyClusters(eng.id).map(k => ({ value: k, label: k })), l.cluster, v => { l.cluster = v; refreshOutput(); })));
    root.appendChild(field('Palette', segmented(seg3(), l.palette, v => { l.palette = v; refreshOutput(); })));
    root.appendChild(toggle('Arrangement language', l.arrangement, v => { l.arrangement = v; refreshOutput(); }));
    root.appendChild(field('BPM override', el('input', { class: 'txt', type: 'text', value: l.bpmOverride, placeholder: 'optional', oninput: e => { l.bpmOverride = e.target.value; refreshOutput(); } })));
  } else {
    root.appendChild(field('Phase', select(legacyClassic(eng.id).phases.map(p => ({ value: p, label: p })), l.phase, v => { l.phase = v; refreshOutput(); })));
    lockControl(root, {
      roles: CLASSIC_ROLES,
      labelFor: classicSlotLabel,
      optionsFor: role => (legacyClassic(eng.id).slots[role] || []).map(x => ({ value: x, label: x })),
      level: l.slotLevel,
      onLevel: v => { l.slotLevel = v; l.slotLocks = {}; if (v === 'manual') seedClassicManual(eng.id, l); renderAll(); },
      locks: l.slotLocks,
    });
  }
  root.appendChild(field('Vocal', segmented(vocalSeg(), l.vocalMode, v => { l.vocalMode = v; refreshOutput(); })));
  root.appendChild(buttons());
}

function seg3() { return [['electronic', 'Electronic'], ['acoustic', 'Acoustic'], ['blend', 'Blend']].map(([value, label]) => ({ value, label })); }
function vocalSeg() { return [['Instrumental', 'Instrumental'], ['Descriptor', 'Descriptor'], ['Persona', 'Persona']].map(([value, label]) => ({ value, label })); }
function toggle(label, checked, onchange) {
  const cb = el('input', { type: 'checkbox', onchange: e => onchange(e.target.checked) });
  cb.checked = checked;
  return el('label', { class: 'toggle' }, [cb, el('span', { text: label })]);
}

function renderStub(root, eng) {
  root.appendChild(el('div', { class: 'stub' }, [
    el('h3', { text: `${eng.label} \u2014 not built yet` }),
    el('p', { text: 'Registered in scope. Slots into the resolver kind (same as Delerium) once its palette + character pools are authored and validated.' }),
  ]));
}

// ---- shared buttons + output ----------------------------------------------
function buttons() {
  return el('div', { class: 'actions-wrap' }, [
    el('div', { class: 'maxmode' }, toggle('Max Mode', S.maxMode, v => { S.maxMode = v; refreshOutput(); })),
    el('div', { class: 'actions' }, [
      el('button', { class: 'primary', text: 'Generate', onclick: () => { S.seed = newSeed(); refreshOutput(); } }),
      el('button', { class: 'ghost', text: 'Re-roll instruments', onclick: () => { S.seed = newSeed(); refreshOutput(); } }),
    ]),
  ]);
}

function refreshOutput() {
  const host = document.getElementById('output');
  if (!host) return;
  host.innerHTML = '';
  const eng = getEngine(S.engineId);
  if (eng.kind === 'stub') { host.appendChild(el('p', { class: 'note', text: 'Select a built engine to generate.' })); return; }

  const res = generate(S);
  host.appendChild(outBlock('Style prompt', res.style, res.length, res.over));
  host.appendChild(outBlock('Negative prompt', res.negative, null, false));
  const lyr = res.lyrics || '[Instrumental]';
  host.appendChild(outBlock('Lyrics field', lyr, null, false, 'Paste into Suno\u2019s lyrics box; use Suno\u2019s Instrumental toggle for reliable vocal suppression.'));
}

function outBlock(title, text, length, over, hint) {
  const head = el('div', { class: 'out-head' }, [el('h4', { text: title })]);
  if (length != null) head.appendChild(el('span', { class: 'meter' + (over ? ' over' : ''), text: `${length}/1000` }));
  head.appendChild(el('button', { class: 'copy', text: 'Copy', onclick: (e) => { copy(text); e.target.textContent = 'Copied'; setTimeout(() => e.target.textContent = 'Copy', 1200); } }));
  const kids = [head, el('textarea', { class: 'out', readonly: 'readonly', rows: title === 'Style prompt' ? 5 : 2 }, text)];
  if (hint) kids.push(el('p', { class: 'hint', text: hint }));
  return el('div', { class: 'out-block' }, kids);
}
function copy(t) {
  if (navigator.clipboard) navigator.clipboard.writeText(t).catch(() => {});
}

Object.assign(window.__ATMOS, { mount });
})();

/* js/app.js */
(function(){
const {initState} = window.__ATMOS;
const {mount} = window.__ATMOS;

function boot() {
  const root = document.getElementById('app');
  if (!root) return;
  mount(initState(), root);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

})();

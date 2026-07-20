/* ==========================================================================
 * atom-pools.js — corrected instrument pools for the atom model (Balearic set).
 *
 * Rebuilt from scratch after the legacy engine-extras Balearic pools were found
 * 68% defective (palette mismatches, non-instruments, descriptive prose).
 *
 * RUBRIC (locked with John, 2026-07-20):
 *  - Palette = sound source. electronic = synthesized/sequenced. acoustic =
 *    acoustically sounded. Electro-acoustic instruments (Rhodes, Wurlitzer,
 *    Hammond, clavinet, electric guitar, mellotron) are the ONLY instruments
 *    allowed in either palette, and only where the genre supports them.
 *  - Instrument roles (bass, rhythm, perc, pads, strings, texture, motif,
 *    counter, color) hold a PURE INSTRUMENT NAME. No feel-adjectives, no
 *    "supporting harmonic space", no "minimal downtempo groove".
 *  - harmony holds key / mode / progression data (structural, not prose).
 *  - movement holds production directives (structural, not prose).
 *  - Every instrument is theory-appropriate to its cluster and complementary
 *    with the others in that cluster's arrangement.
 *
 * These pools are the instrument source for atom characters (one cluster = one
 * character): collect() draws an instrument per role/palette; identity is the
 * only thing stored here — timbre / level / interplay are assembled at compose.
 * ========================================================================*/

export const ATOM_POOLS_BALEARIC = {

  'organic-warm-downtempo': {
    label: 'Organic warm downtempo', genre: 'Balearic downtempo', tempo: '80-100 BPM, low-mid energy', beatless: false,
    harmony: ['minor key', 'Dorian mode', 'minor 7th and add9 voicings', 'ii-V-i in a minor key', 'a suspended-to-major resolution'],
    movement: ['wide stereo panning', 'slow low-pass filter sweeps', 'tape-saturated warmth', 'tempo-synced delay throws', 'gentle sidechain movement'],
    electronic: {
      bass: ['analog synth bass', 'sub bass', 'FM bass'],
      rhythm: ['soft downtempo kit', 'dusty boom-bap kit', 'drum machine'],
      perc: ['drum-machine hi-hats', 'rimshot clicks', 'synth clap', 'electro shaker'],
      pads: ['analog synth pads', 'string-machine pad', 'mellotron'],
      strings: ['synth strings'],
      texture: ['drone synth', 'granular synth', 'mellotron'],
      motif: ['Rhodes', 'synth lead', 'synth pluck'],
      counter: ['Wurlitzer', 'synth counter-line'],
      color: ['synth bells', 'glassy mallet synth'],
    },
    acoustic: {
      bass: ['upright bass', 'double bass'],
      rhythm: ['brushed drum kit', 'soft jazz kit'],
      perc: ['shakers', 'congas', 'bongos', 'cabasa', 'frame drum'],
      pads: ['harmonium', 'bowed string ensemble'],
      strings: ['cello', 'viola', 'string ensemble'],
      texture: ['felt piano', 'harp', 'bowed vibraphone'],
      motif: ['felt piano', 'nylon guitar', 'Rhodes', 'flugelhorn'],
      counter: ['cello', 'muted trumpet', 'clarinet'],
      color: ['glockenspiel', 'vibraphone', 'kalimba', 'celeste'],
    },
  },

  'lush-cinematic-chillout': {
    label: 'Lush cinematic chillout', genre: 'Balearic downtempo', tempo: '85-105 BPM, medium energy', beatless: false,
    harmony: ['minor-to-relative-major over eight-bar cycles', 'add9 voicings into a major-seventh resolution', 'wide sus2 voicings with a delayed resolve', 'Aeolian mode', 'a Picardy-third lift'],
    movement: ['wide stereo panning', 'slow filter modulation on the pads', 'orchestral swells rising and receding', 'long reverb tails', 'LFO and chorus movement on the synths'],
    electronic: {
      bass: ['sub bass', 'FM sub-bass'],
      rhythm: ['soft downtempo kit', 'lounge kit'],
      perc: ['electro shaker', 'synth triangle', 'drum-machine hi-hats'],
      pads: ['analog synth pads', 'layered synth pads', 'choir pad'],
      strings: ['synth strings', 'string-machine ensemble'],
      texture: ['drone synth', 'mellotron'],
      motif: ['Rhodes', 'synth lead'],
      counter: ['synth counter-line', 'Rhodes'],
      color: ['synth bells', 'glassy mallet synth'],
    },
    acoustic: {
      bass: ['double bass', 'upright bass'],
      rhythm: ['brushed drum kit'],
      perc: ['shakers', 'frame drum', 'triangle'],
      pads: ['pipe organ', 'bowed string ensemble', 'harmonium'],
      strings: ['cello', 'string ensemble', 'violin', 'viola'],
      texture: ['cor anglais', 'French horn', 'pipe organ'],
      motif: ['grand piano', 'felt piano', 'Rhodes', 'flute'],
      counter: ['cello', 'oboe', 'clarinet'],
      color: ['glockenspiel', 'tubular bells', 'harp', 'celeste'],
    },
  },

  'dreamy-analog-electronic': {
    label: 'Dreamy analog electronic', genre: 'dreamy analog electronic', tempo: '90-110 BPM, medium energy', beatless: false,
    harmony: ['major key with modal color', 'Lydian mode', 'slow major-seventh pads', 'a plagal cadence', 'suspended major voicings'],
    movement: ['slow pitch drift', 'slow filter sweeps', 'wide stereo panning', 'chorus and phaser on the synths', 'tempo-synced delay'],
    electronic: {
      bass: ['Moog bass', 'analog synth bass', 'sub bass'],
      rhythm: ['soft drum machine', 'LinnDrum-style kit'],
      perc: ['drum-machine hi-hats', 'synth clap', 'electro shaker', 'rimshot clicks'],
      pads: ['detuned analog pads', 'analog synth pads', 'mellotron', 'choir pad'],
      strings: ['synth strings', 'string-machine ensemble'],
      texture: ['granular synth', 'drone synth', 'mellotron'],
      motif: ['synth lead', 'synth arp', 'synth pluck', 'Rhodes'],
      counter: ['synth counter-line', 'Wurlitzer'],
      color: ['synth bells', 'glassy mallet synth', 'synth marimba'],
    },
    acoustic: {
      bass: [],
      rhythm: [],
      perc: [],
      pads: ['harmonium'],
      strings: [],
      texture: ['felt piano', 'harp'],
      motif: ['felt piano', 'Rhodes'],
      counter: ['glockenspiel'],
      color: ['glockenspiel', 'celeste', 'kalimba'],
    },
  },

  'dub-space-downtempo': {
    label: 'Dub-space downtempo', genre: 'dub-space downtempo', tempo: '70-95 BPM, low-mid energy', beatless: false,
    harmony: ['minor key', 'a modal minor vamp', 'dominant-seventh dub stabs', 'a two-chord minor rock', 'Phrygian color'],
    movement: ['spring reverb', 'tempo-synced dub delay throws', 'wide stereo panning', 'low-pass filter sweeps', 'echo feedback swells'],
    electronic: {
      bass: ['dub sub bass', 'sine sub bass', 'analog synth bass'],
      rhythm: ['dub kit', 'soft drum machine', 'one-drop kit'],
      perc: ['rimshot clicks', 'drum-machine hi-hats', 'electro shaker'],
      pads: ['analog synth pads', 'organ-stab synth'],
      strings: ['synth strings'],
      texture: ['drone synth', 'granular synth'],
      motif: ['synth stabs', 'synth lead', 'Rhodes'],
      counter: ['Wurlitzer', 'synth counter-line'],
      color: ['synth bells', 'glassy mallet synth'],
    },
    acoustic: {
      bass: ['upright bass'],
      rhythm: ['brushed drum kit'],
      perc: ['congas', 'bongos', 'shakers', 'frame drum'],
      pads: ['harmonium'],
      strings: ['cello'],
      texture: ['melodica'],
      motif: ['melodica', 'muted trumpet', 'Rhodes'],
      counter: ['trombone', 'muted trumpet'],
      color: ['glockenspiel', 'kalimba'],
    },
  },

  'deep-nocturnal-balearic': {
    label: 'Deep nocturnal Balearic', genre: 'Balearic downtempo', tempo: '100-115 BPM, medium energy', beatless: false,
    harmony: ['minor key', 'Aeolian mode', 'a minor-seventh vamp', 'add9 and sus4 voicings', 'Phrygian color'],
    movement: ['low-pass filter sweeps', 'wide stereo panning', 'long reverb tails', 'sidechain movement', 'tempo-synced delay'],
    electronic: {
      bass: ['sub bass', 'analog synth bass', 'FM bass'],
      rhythm: ['downtempo kit', 'deep house kit', 'soft four-on-the-floor kit'],
      perc: ['drum-machine hi-hats', 'electro shaker', 'rimshot clicks', 'synth clap'],
      pads: ['analog synth pads', 'organ-stab synth', 'choir pad'],
      strings: ['synth strings'],
      texture: ['drone synth', 'granular synth'],
      motif: ['synth lead', 'synth pluck', 'Rhodes'],
      counter: ['synth counter-line', 'Wurlitzer'],
      color: ['synth bells', 'glassy mallet synth'],
    },
    acoustic: {
      bass: ['upright bass'],
      rhythm: ['brushed drum kit'],
      perc: ['congas', 'bongos', 'shakers', 'cabasa'],
      pads: ['harmonium'],
      strings: ['cello', 'viola'],
      texture: ['felt piano'],
      motif: ['nylon guitar', 'Rhodes', 'muted trumpet'],
      counter: ['cello', 'muted trumpet'],
      color: ['vibraphone', 'kalimba'],
    },
  },

  'sunlit-mediterranean': {
    label: 'Sunlit Mediterranean', genre: 'Balearic downtempo', tempo: '100-118 BPM, medium energy', beatless: false,
    harmony: ['major key', 'Mixolydian mode', 'I-V-vi-IV', 'Andalusian cadence', 'sus2 into major voicings'],
    movement: ['wide stereo panning', 'slow filter sweeps', 'tape-saturated warmth', 'tempo-synced delay', 'bright reverb'],
    electronic: {
      bass: ['analog synth bass', 'sub bass'],
      rhythm: ['soft house kit', 'downtempo kit'],
      perc: ['drum-machine hi-hats', 'electro shaker', 'synth clap'],
      pads: ['analog synth pads', 'choir pad'],
      strings: ['synth strings'],
      texture: ['drone synth'],
      motif: ['synth pluck', 'synth lead', 'Rhodes'],
      counter: ['synth counter-line', 'Hammond organ'],
      color: ['synth marimba', 'synth bells'],
    },
    acoustic: {
      bass: ['upright bass'],
      rhythm: ['brushed drum kit', 'cajón kit'],
      perc: ['cajón', 'shakers', 'congas', 'tambourine', 'cabasa'],
      pads: ['accordion', 'harmonium'],
      strings: ['string ensemble', 'cello'],
      texture: ['nylon guitar', 'mandolin'],
      motif: ['nylon guitar', 'flamenco guitar', 'flugelhorn', 'pan flute'],
      counter: ['mandolin', 'clarinet', 'muted trumpet'],
      color: ['marimba', 'glockenspiel', 'vibraphone'],
    },
  },

  'ambient-beatless-atmospheric': {
    label: 'Ambient / beatless atmospheric', genre: 'ambient atmospheric', tempo: 'free, very low energy', beatless: true,
    harmony: ['a static major-seventh drone', 'Lydian mode', 'slow suspended-chord shifts', 'an open-fifth pedal', 'minor-to-major cross-fades'],
    movement: ['very long reverb tails', 'slow granular clouds', 'wide stereo panning', 'slow filter drift', 'cross-faded layer swells'],
    electronic: {
      bass: ['sub drone'],
      rhythm: [],
      perc: [],
      pads: ['analog synth pads', 'choir pad', 'mellotron', 'drone synth'],
      strings: ['synth strings'],
      texture: ['granular synth', 'drone synth', 'mellotron'],
      motif: ['synth lead', 'Rhodes'],
      counter: ['synth counter-line'],
      color: ['synth bells', 'glassy mallet synth'],
    },
    acoustic: {
      bass: ['bowed double bass'],
      rhythm: [],
      perc: [],
      pads: ['pipe organ', 'harmonium', 'bowed string ensemble'],
      strings: ['cello', 'string ensemble', 'violin'],
      texture: ['felt piano', 'harp', 'glass harmonica', 'bowed vibraphone', 'flute'],
      motif: ['felt piano', 'flute'],
      counter: ['cor anglais', 'clarinet'],
      color: ['glockenspiel', 'celeste', 'tubular bells', 'harp'],
    },
  },

  'moody-trip-hop-downbeat': {
    label: 'Moody trip-hop downbeat', genre: 'trip-hop downbeat', tempo: '70-90 BPM, low-mid energy', beatless: false,
    harmony: ['minor key', 'a minor-seventh vamp', 'Phrygian color', 'chromatic descending bass', 'add9 and minor-sixth voicings'],
    movement: ['tape-saturated warmth', 'low-pass filter sweeps', 'tempo-synced delay', 'wide stereo panning', 'spring reverb'],
    electronic: {
      bass: ['sub bass', 'analog synth bass'],
      rhythm: ['trip-hop breakbeat kit', 'dusty boom-bap kit', 'drum machine'],
      perc: ['drum-machine hi-hats', 'rimshot clicks', 'electro shaker'],
      pads: ['analog synth pads', 'detuned analog pads'],
      strings: ['synth strings'],
      texture: ['drone synth', 'granular synth', 'mellotron'],
      motif: ['Rhodes', 'synth lead', 'synth stabs'],
      counter: ['Wurlitzer', 'synth counter-line'],
      color: ['synth bells', 'glassy mallet synth'],
    },
    acoustic: {
      bass: ['upright bass'],
      rhythm: ['brushed drum kit', 'live break kit'],
      perc: ['congas', 'shakers', 'tambourine'],
      pads: ['harmonium', 'bowed string ensemble'],
      strings: ['cello', 'viola', 'string ensemble'],
      texture: ['felt piano', 'harp'],
      motif: ['Rhodes', 'muted trumpet', 'felt piano'],
      counter: ['cello', 'muted trumpet', 'clarinet'],
      color: ['vibraphone', 'glockenspiel', 'harp'],
    },
  },

  'balearic-house': {
    label: 'Balearic house', genre: 'Balearic house', tempo: '118-124 BPM, medium-high energy', beatless: false,
    harmony: ['minor key', 'a minor-seventh vamp', 'add9 and sus4 voicings', 'Dorian mode', 'I-V-vi-IV in a minor key'],
    movement: ['sidechain pump', 'low-pass filter sweeps', 'wide stereo panning', 'tempo-synced delay', 'long reverb tails'],
    electronic: {
      bass: ['analog synth bass', 'sub bass', 'plucked synth bass'],
      rhythm: ['four-on-the-floor house kit', 'soft house kit'],
      perc: ['drum-machine hi-hats', 'electro shaker', 'synth clap', 'rimshot clicks'],
      pads: ['analog synth pads', 'organ-stab synth', 'choir pad'],
      strings: ['synth strings'],
      texture: ['drone synth', 'granular synth'],
      motif: ['synth pluck', 'synth lead', 'Hammond organ', 'Rhodes'],
      counter: ['synth counter-line', 'Wurlitzer'],
      color: ['synth bells', 'synth marimba'],
    },
    acoustic: {
      bass: ['upright bass'],
      rhythm: ['live house kit'],
      perc: ['congas', 'bongos', 'shakers', 'tambourine', 'cabasa'],
      pads: ['harmonium'],
      strings: ['string ensemble', 'cello'],
      texture: ['nylon guitar'],
      motif: ['nylon guitar', 'Rhodes', 'saxophone', 'flute'],
      counter: ['saxophone', 'muted trumpet'],
      color: ['vibraphone', 'marimba', 'glockenspiel'],
    },
  },

  'nu-disco-slo-mo': {
    label: 'Nu-disco / slo-mo disco', genre: 'nu-disco', tempo: '100-120 BPM, medium-high energy', beatless: false,
    harmony: ['major key', 'ii-V-I with secondary dominants', 'a funk-minor vamp', 'seventh and ninth chords', 'I-vi-ii-V'],
    movement: ['sidechain pump', 'wide stereo panning', 'tempo-synced delay', 'filter sweeps on the strings', 'tape-saturated warmth'],
    electronic: {
      bass: ['analog synth bass', 'Moog bass', 'sub bass'],
      rhythm: ['disco four-on-the-floor kit', 'drum machine'],
      perc: ['drum-machine hi-hats', 'synth clap', 'electro shaker'],
      pads: ['analog synth pads', 'string-machine pad'],
      strings: ['synth strings', 'string-machine ensemble'],
      texture: ['clavinet', 'drone synth'],
      motif: ['synth arp', 'synth lead', 'clavinet', 'Rhodes'],
      counter: ['synth brass', 'Hammond organ'],
      color: ['synth bells', 'glassy mallet synth'],
    },
    acoustic: {
      bass: ['fretless bass', 'electric bass'],
      rhythm: ['live disco kit'],
      perc: ['congas', 'bongos', 'tambourine', 'shakers'],
      pads: ['string ensemble'],
      strings: ['string ensemble', 'cello', 'violin'],
      texture: ['electric guitar', 'clavinet'],
      motif: ['electric guitar', 'saxophone', 'flute', 'Rhodes'],
      counter: ['saxophone', 'muted trumpet', 'trombone'],
      color: ['vibraphone', 'marimba', 'glockenspiel'],
    },
  },

  'melodic-deep-house': {
    label: 'Melodic deep house', genre: 'melodic deep house', tempo: '120-124 BPM, medium-high energy', beatless: false,
    harmony: ['minor key', 'add9 and sus2 voicings', 'a minor-seventh arpeggio cycle', 'Aeolian mode', 'i-VI-III-VII'],
    movement: ['sidechain pump', 'long reverb tails', 'wide stereo panning', 'filter sweeps on the arp', 'tempo-synced delay'],
    electronic: {
      bass: ['sub bass', 'plucked synth bass', 'analog synth bass'],
      rhythm: ['deep house kit', 'four-on-the-floor house kit'],
      perc: ['drum-machine hi-hats', 'electro shaker', 'synth clap', 'rimshot clicks'],
      pads: ['analog synth pads', 'layered synth pads', 'choir pad'],
      strings: ['synth strings'],
      texture: ['drone synth', 'granular synth'],
      motif: ['synth arp', 'synth lead', 'synth pluck'],
      counter: ['synth counter-line', 'Rhodes'],
      color: ['synth bells', 'glassy mallet synth'],
    },
    acoustic: {
      bass: [],
      rhythm: [],
      perc: ['shakers', 'congas'],
      pads: ['harmonium'],
      strings: ['string ensemble'],
      texture: ['grand piano'],
      motif: ['grand piano', 'Rhodes'],
      counter: ['cello'],
      color: ['glockenspiel', 'vibraphone'],
    },
  },

  'lounge-house': {
    label: 'Lounge House', genre: 'lounge house', tempo: '100-120 BPM, medium energy', beatless: false,
    // Soft four-on-the-floor house pulse fused with jazz / bossa / soul lounge
    // instrumentation (St. Germain "Tourist", Cafe del Mar lineage).
    harmony: ['ii-V-I with jazz sevenths', 'a minor-seventh and ninth vamp', 'bossa-nova major-seventh changes', 'Dorian mode', 'add9 and thirteenth voicings'],
    movement: ['sidechain pump', 'wide stereo panning', 'tape-saturated warmth', 'tempo-synced delay', 'filter sweeps on the pads'],
    electronic: {
      bass: ['sub bass', 'analog synth bass'],
      rhythm: ['soft house kit', 'four-on-the-floor house kit'],
      perc: ['drum-machine hi-hats', 'electro shaker', 'synth clap'],
      pads: ['analog synth pads', 'organ-stab synth', 'choir pad'],
      strings: ['synth strings'],
      texture: ['Rhodes', 'drone synth'],
      motif: ['Rhodes', 'synth lead', 'Wurlitzer'],
      counter: ['Hammond organ', 'synth counter-line'],
      color: ['synth bells', 'glassy mallet synth'],
    },
    acoustic: {
      bass: ['upright bass', 'double bass'],
      rhythm: ['brushed drum kit', 'jazz drum kit'],
      perc: ['congas', 'bongos', 'shakers', 'cabasa'],
      pads: ['Hammond organ'],
      strings: ['string ensemble', 'cello'],
      texture: ['jazz guitar', 'nylon guitar'],
      motif: ['Rhodes', 'grand piano', 'saxophone', 'jazz guitar', 'flugelhorn'],
      counter: ['saxophone', 'muted trumpet', 'flute'],
      color: ['vibraphone', 'marimba', 'glockenspiel'],
    },
  },

};

/* ==========================================================================
 * atom-pools.js — corrected instrument pools for the atom model (Balearic set).
 *
 * Rebuilt from scratch (legacy engine-extras Balearic pools were 68% defective).
 * RUBRIC (locked with John, 2026-07-20):
 *  - Palette = sound source. electronic = synthesized/sequenced. acoustic =
 *    acoustically sounded. Electro-acoustic (Rhodes, Wurlitzer, Hammond, clavinet,
 *    electric guitar, lap-steel guitar, fretless bass, mellotron) are the only
 *    instruments allowed in either palette, where the genre supports them.
 *  - Instrument roles hold a PURE INSTRUMENT NAME. harmony = key/mode/progression.
 *    movement = production directives. Both structural, not prose.
 *  - Theory-appropriate + complementary per cluster; an instrument appears in at
 *    most one role per cluster+palette so draws don't self-collide.
 *
 * 2026-07-20 revision: clarinet removed everywhere (too dominant) -> French horn /
 * flugelhorn / cor anglais; fretless bass added across acoustic bass pools;
 * lap-steel guitar added (Guitar del Mar strand); thin pools deepened for batch
 * variety.
 *
 * 2026-08-14 revision — STEP 1 OF THE BALEARIC RELIABILITY PASS (John's spec
 * §4/§6/§7). The pools are UNCHANGED in kind: still arrays of bare instrument
 * names, still one instrument per role per cluster+palette. Two things happened:
 *   1. Every name is now GRADED in core/instruments.js (primary / secondary /
 *      expert). Expert-tier names — orchestral strings and brass, solo winds,
 *      harp, pipe organ, saxophone, pan flute — are left in place here on
 *      purpose and simply carry zero automatic probability (§7). Deleting them
 *      would throw away authored work and make restoring one a re-authoring job
 *      instead of a one-line tier change.
 *   2. Every role those exclusions would have emptied has been BACKFILLED with
 *      primary-tier content, so no cluster silently loses a voice. Backfill is
 *      drawn from the same electro-acoustic vocabulary the rubric already
 *      permits in either palette (Rhodes, Wurlitzer, melodica, Hammond) plus
 *      guitars and pianos already in use elsewhere in the set. Expert names are
 *      listed LAST in each pool so the file reads as "the automatic set, then
 *      the parked set".
 * Two pre-existing empty-pool bugs are fixed by the same pass: dreamy-analog-
 * electronic/acoustic had no bass, rhythm or perc at all, and melodic-deep-
 * house/acoustic had no rhythm — both shipped a beatless-sounding build at
 * 90-124 BPM.
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
      pads: ['analog synth pads', 'string-machine pad', 'mellotron', 'choir pad'],
      strings: ['synth strings', 'string-machine ensemble'],
      texture: ['drone synth', 'granular synth'],
      motif: ['Rhodes', 'synth lead', 'synth pluck'],
      counter: ['Wurlitzer', 'synth counter-line'],
      color: ['synth bells', 'glassy mallet synth', 'synth marimba'],
    },
    acoustic: {
      bass: ['upright bass', 'double bass', 'fretless bass'],
      rhythm: ['brushed drum kit', 'soft jazz kit', 'live drum kit'],
      perc: ['shakers', 'congas', 'bongos', 'cabasa', 'frame drum', 'hang drum'],
      pads: ['harmonium', 'string ensemble', 'mellotron', 'accordion', 'bowed string pad'],
      strings: ['cello', 'viola'],
      texture: ['felt piano', 'harp', 'bowed metallophone'],
      motif: ['nylon guitar', 'lap-steel guitar', 'acoustic guitar', 'flugelhorn'],
      counter: ['Wurlitzer', 'melodica', 'muted trumpet', 'French horn', 'cor anglais'],
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
      counter: ['synth counter-line'],
      color: ['synth bells', 'glassy mallet synth'],
    },
    acoustic: {
      bass: ['double bass', 'upright bass', 'fretless bass'],
      rhythm: ['brushed drum kit'],
      perc: ['shakers', 'frame drum', 'triangle'],
      pads: ['harmonium', 'string ensemble', 'mellotron', 'accordion', 'pipe organ', 'bowed string pad'],
      strings: ['cello', 'violin', 'viola'],
      texture: ['lap-steel guitar', 'cor anglais'],
      motif: ['grand piano', 'felt piano', 'flute'],
      counter: ['Wurlitzer', 'nylon guitar', 'French horn', 'flugelhorn', 'muted trumpet'],
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
      texture: ['granular synth', 'drone synth'],
      motif: ['synth lead', 'synth arp', 'synth pluck'],
      counter: ['Wurlitzer', 'synth counter-line'],
      color: ['synth bells', 'glassy mallet synth', 'synth marimba'],
    },
    acoustic: {
      bass: ['fretless bass', 'upright bass'],
      rhythm: ['brushed drum kit', 'live drum kit'],
      perc: ['shakers', 'frame drum', 'cabasa'],
      pads: ['harmonium', 'mellotron', 'string ensemble', 'accordion'],
      strings: [],
      texture: ['lap-steel guitar', 'harp'],
      motif: ['Rhodes', 'grand piano'],
      counter: ['Wurlitzer', 'melodica', 'French horn'],
      color: ['glockenspiel', 'celeste', 'kalimba'],
    },
  },

  'dub-space-downtempo': {
    label: 'Dub-space downtempo', genre: 'dub-space downtempo', tempo: '70-95 BPM, low-mid energy', beatless: false,
    harmony: ['minor key', 'a modal minor vamp', 'short dominant-seventh dub chords', 'a two-chord minor rock', 'Phrygian color'],
    movement: ['spring reverb', 'tempo-synced dub delay throws', 'wide stereo panning', 'low-pass filter sweeps', 'echo feedback swells'],
    electronic: {
      bass: ['dub sub bass', 'sine sub bass', 'analog synth bass'],
      rhythm: ['dub kit', 'soft drum machine', 'one-drop kit'],
      perc: ['rimshot clicks', 'drum-machine hi-hats', 'electro shaker'],
      pads: ['analog synth pads', 'clipped organ synth'],
      strings: ['synth strings', 'string-machine ensemble'],
      texture: ['drone synth', 'granular synth'],
      motif: ['clipped synth chords', 'synth lead', 'Rhodes'],
      counter: ['Wurlitzer', 'synth counter-line'],
      color: ['synth bells', 'glassy mallet synth'],
    },
    acoustic: {
      bass: ['upright bass', 'fretless bass'],
      rhythm: ['brushed drum kit'],
      perc: ['congas', 'bongos', 'shakers', 'frame drum', 'hang drum'],
      pads: ['harmonium', 'mellotron'],
      strings: ['cello'],
      texture: ['lap-steel guitar'],
      motif: ['melodica', 'nylon guitar', 'muted trumpet'],
      counter: ['Rhodes', 'Wurlitzer', 'trombone', 'French horn'],
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
      pads: ['analog synth pads', 'clipped organ synth', 'choir pad'],
      strings: ['synth strings', 'string-machine ensemble'],
      texture: ['drone synth', 'granular synth'],
      motif: ['synth lead', 'synth pluck', 'Rhodes'],
      counter: ['synth counter-line', 'Wurlitzer'],
      color: ['synth bells', 'glassy mallet synth'],
    },
    acoustic: {
      bass: ['upright bass', 'fretless bass'],
      rhythm: ['brushed drum kit'],
      perc: ['congas', 'bongos', 'shakers', 'cabasa', 'frame drum'],
      pads: ['harmonium', 'mellotron', 'string ensemble'],
      strings: ['cello', 'viola'],
      texture: ['felt piano', 'lap-steel guitar', 'duduk'],
      motif: ['nylon guitar', 'Rhodes', 'ney'],
      counter: ['Wurlitzer', 'melodica', 'French horn', 'flugelhorn'],
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
      strings: ['synth strings', 'string-machine ensemble'],
      texture: ['drone synth'],
      motif: ['synth pluck', 'synth lead', 'Rhodes'],
      counter: ['synth counter-line', 'Hammond organ'],
      color: ['synth marimba', 'synth bells'],
    },
    acoustic: {
      bass: ['upright bass', 'fretless bass'],
      rhythm: ['brushed drum kit', 'cajón kit'],
      perc: ['shakers', 'congas', 'tambourine', 'cabasa', 'frame drum'],
      pads: ['harmonium', 'string ensemble', 'mellotron', 'accordion'],
      strings: ['cello'],
      texture: ['nylon guitar', 'lap-steel guitar'],
      motif: ['flamenco guitar', 'mandolin', 'Rhodes', 'pan flute', 'flugelhorn'],
      counter: ['Wurlitzer', 'melodica', 'muted trumpet', 'French horn', 'saxophone'],
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
      pads: ['analog synth pads', 'choir pad'],
      strings: ['synth strings', 'string-machine ensemble'],
      texture: ['granular synth', 'drone synth', 'mellotron'],
      motif: ['synth lead', 'Rhodes'],
      counter: ['synth counter-line'],
      color: ['synth bells', 'glassy mallet synth'],
    },
    acoustic: {
      bass: ['upright bass', 'bowed double bass'],
      rhythm: [],
      perc: [],
      pads: ['harmonium', 'string ensemble', 'mellotron', 'accordion', 'pipe organ', 'bowed string pad'],
      strings: ['cello', 'violin'],
      texture: ['felt piano', 'lap-steel guitar', 'glass harmonica', 'bowed metallophone'],
      motif: ['nylon guitar', 'grand piano', 'flute', 'cor anglais'],
      counter: ['Wurlitzer', 'French horn'],
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
      strings: ['synth strings', 'string-machine ensemble'],
      texture: ['drone synth', 'granular synth', 'mellotron'],
      motif: ['Rhodes', 'synth lead', 'clipped synth chords'],
      counter: ['Wurlitzer', 'synth counter-line'],
      color: ['synth bells', 'glassy mallet synth'],
    },
    acoustic: {
      bass: ['upright bass', 'fretless bass'],
      rhythm: ['brushed drum kit', 'live break kit'],
      perc: ['congas', 'shakers', 'tambourine'],
      pads: ['harmonium', 'string ensemble', 'mellotron', 'accordion', 'bowed string pad'],
      strings: ['cello', 'viola'],
      texture: ['felt piano', 'lap-steel guitar'],
      motif: ['Rhodes', 'nylon guitar', 'grand piano', 'muted trumpet', 'flugelhorn'],
      counter: ['Wurlitzer', 'melodica', 'French horn', 'cor anglais'],
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
      pads: ['analog synth pads', 'clipped organ synth', 'choir pad'],
      strings: ['synth strings', 'string-machine ensemble'],
      texture: ['drone synth', 'granular synth'],
      motif: ['synth pluck', 'synth lead', 'filtered saw lead'],
      counter: ['synth counter-line', 'Wurlitzer'],
      color: ['synth bells', 'synth marimba'],
    },
    acoustic: {
      bass: ['upright bass', 'fretless bass'],
      rhythm: ['live house kit'],
      perc: ['congas', 'bongos', 'shakers', 'tambourine', 'cabasa'],
      pads: ['harmonium', 'string ensemble', 'mellotron'],
      strings: ['cello'],
      texture: ['nylon guitar', 'lap-steel guitar'],
      motif: ['Rhodes', 'grand piano', 'melodica', 'saxophone', 'flute'],
      counter: ['Wurlitzer', 'Hammond organ', 'muted trumpet', 'French horn', 'flugelhorn'],
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
      motif: ['synth arp', 'synth lead', 'Rhodes'],
      counter: ['synth counter-line', 'Hammond organ', 'synth brass'],
      color: ['synth bells', 'glassy mallet synth'],
    },
    acoustic: {
      bass: ['fretless bass', 'electric bass'],
      rhythm: ['live disco kit'],
      perc: ['congas', 'bongos', 'tambourine', 'shakers'],
      pads: ['Hammond organ', 'harmonium', 'string ensemble'],
      strings: ['cello', 'violin'],
      texture: ['electric guitar', 'clavinet'],
      motif: ['grand piano', 'Rhodes', 'saxophone', 'flute'],
      counter: ['Wurlitzer', 'melodica', 'muted trumpet', 'trombone', 'French horn'],
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
      strings: ['synth strings', 'string-machine ensemble'],
      texture: ['drone synth', 'granular synth'],
      motif: ['synth arp', 'synth lead', 'synth pluck'],
      counter: ['synth counter-line', 'Rhodes'],
      color: ['synth bells', 'glassy mallet synth'],
    },
    acoustic: {
      bass: ['fretless bass', 'upright bass'],
      rhythm: ['live house kit', 'brushed drum kit'],
      perc: ['shakers', 'congas', 'cabasa'],
      pads: ['harmonium', 'string ensemble', 'mellotron', 'accordion'],
      strings: [],
      texture: ['grand piano', 'nylon guitar'],
      motif: ['Rhodes', 'lap-steel guitar'],
      counter: ['Wurlitzer', 'melodica', 'cello'],
      color: ['glockenspiel', 'vibraphone'],
    },
  },

  'lounge-house': {
    label: 'Lounge House', genre: 'lounge house', tempo: '100-120 BPM, medium energy', beatless: false,
    harmony: ['ii-V-I with jazz sevenths', 'a minor-seventh and ninth vamp', 'bossa-nova major-seventh changes', 'Dorian mode', 'add9 and thirteenth voicings'],
    movement: ['sidechain pump', 'wide stereo panning', 'tape-saturated warmth', 'tempo-synced delay', 'filter sweeps on the pads'],
    electronic: {
      bass: ['sub bass', 'analog synth bass'],
      rhythm: ['soft house kit', 'four-on-the-floor house kit'],
      perc: ['drum-machine hi-hats', 'electro shaker', 'synth clap'],
      pads: ['analog synth pads', 'clipped organ synth', 'choir pad'],
      strings: ['synth strings', 'string-machine ensemble'],
      texture: ['drone synth'],
      motif: ['Rhodes', 'synth lead', 'Wurlitzer'],
      counter: ['Hammond organ', 'synth counter-line'],
      color: ['synth bells', 'glassy mallet synth'],
    },
    acoustic: {
      bass: ['upright bass', 'double bass', 'fretless bass'],
      rhythm: ['brushed drum kit', 'jazz drum kit'],
      perc: ['congas', 'bongos', 'shakers', 'cabasa'],
      pads: ['Hammond organ', 'string ensemble', 'mellotron'],
      strings: ['cello'],
      texture: ['jazz guitar', 'nylon guitar'],
      motif: ['grand piano', 'Rhodes', 'saxophone', 'flugelhorn'],
      counter: ['Wurlitzer', 'melodica', 'muted trumpet', 'French horn', 'flute'],
      color: ['vibraphone', 'marimba', 'glockenspiel'],
    },
  },

};

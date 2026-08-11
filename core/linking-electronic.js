/**
 * Electronic/Synth Family Linking Data
 * Mirrors core/linking.js structure for orchestral families
 * Source of truth: docs/knowledge/electronic-family-linking-guide.md
 */

export const ELECTRONIC_FAMILIES = {
  'synthpad': {
    name: 'Synth Pad',
    type: 'sustained',
    role: 'harmonic bed',
    plane: 'background',
    typical: 'continuous oscillators, filters, sustains indefinitely'
  },
  'synthlead': {
    name: 'Synth Lead',
    type: 'melodic',
    role: 'melody, foreground hook',
    plane: 'foreground',
    typical: 'pitched synth with articulate envelope, solo line'
  },
  'arpeggio': {
    name: 'Arpeggio',
    type: 'plucked',
    role: 'rhythmic texture',
    plane: 'middle',
    typical: 'gate-triggered or modulated repeating rhythmic shape'
  },
  'electricbass': {
    name: 'Electric Bass',
    type: 'sustained+percussive',
    role: 'rhythmic/harmonic foundation',
    plane: 'background',
    typical: 'sub, analog, acid, FM; distinct attack and sustain'
  },
  'drummachine': {
    name: 'Drum Machine',
    type: 'percussive',
    role: 'rhythmic drive',
    plane: 'background',
    typical: 'programmed kick, snare, hi-hat; short decay'
  },
  'electricpiano': {
    name: 'Electric Piano',
    type: 'plucked',
    role: 'harmonic punctuation',
    plane: 'middle',
    typical: 'struck strings with resonance, rhythmic color'
  },
  'organ': {
    name: 'Organ',
    type: 'sustained',
    role: 'harmonic bed, color warmth',
    plane: 'background',
    typical: 'continuous tone, filter sweep, drawbar or preset'
  },
  'sampledloop': {
    name: 'Sampled/Chopped Source',
    type: 'varies',
    role: 'textural color',
    plane: 'middle',
    typical: 'recorded loops, grains, one-shots; groove pocket'
  },
  'vocalsynthesis': {
    name: 'Vocal Synthesis',
    type: 'pitched',
    role: 'textural color, lead line',
    plane: 'middle',
    typical: 'vocoded voice, synth-modelled voice, glitch chops'
  }
};

export const ELECTRONIC_PATTERNS = {
  'synthpad': /\b(pad|synth pad|pad synth|padded|atmospheric pad)\b/i,
  'synthlead': /\b(synth lead|lead synth|lead|bright lead|lead voice|synth melody|supersaw)\b(?=\s)/i,
  'arpeggio': /\b(arpegg|arp|broken chord|repeating figure|rhythmic figure)\b/i,
  'electricbass': /\b(electric bass|sub bass|analog bass|acid bass|fm bass)\b|bass(?!\s*(?:drum|instrument|guitar))/i,
  'drummachine': /\b(drum machine|drum kit|programmed beat|808|909)\b/i,
  'electricpiano': /\b(electric piano|rhodes|epiano|keyboard|clavinet)\b/i,
  'organ': /\b(organ|hammond|tone wheel|swell)\b/i,
  'sampledloop': /\b(sampled|sample|loop|chopped|grain|one-shot|glitch)\b/i,
  'vocalsynthesis': /\b(vocoder|vocal pad|vocal chop|vocal synth|choir pad|vocal synthesis)\b|\bvoice\b/i
};

export function classifyElectronic(name) {
  if (!name) return null;
  
  for (const [family, pattern] of Object.entries(ELECTRONIC_PATTERNS)) {
    if (pattern.test(name)) {
      return family;
    }
  }
  
  return null;
}

export const ELECTRONIC_PLANES = {
  background: {
    pad: [
      'pad floats beneath the mix, underpinning the full arrangement',
      'bass sits deep in the background, locking the groove with the kick',
      'pad holds a slow-moving harmonic bed while leads move above',
      'drum machine drives the rhythmic pocket; pad sustains the color'
    ],
    supportive: [
      'pad rests on top of a grounded bass line',
      'pad and bass create a full harmonic foundation',
      'bass anchors the arrangement while the pad floats above'
    ]
  },
  middle: {
    texture: [
      'arpeggio pattern locks the groove while the pad holds color beneath',
      'electric piano threads light chords above the bass pocket',
      'synth sweep adds textural motion between the rhythm and the lead',
      'sampled loop sits in the mix, neither leading nor supporting the foundation'
    ],
    color: [
      'pad supports the harmonic motion as the arpeggio adds rhythmic color',
      'electric piano adds motion above a sustained pad foundation',
      'pad holds the harmonic bed; electric piano adds rhythmic color'
    ]
  },
  foreground: {
    lead: [
      'synth lead sings the main hook over the rhythmic and harmonic foundation',
      'vocal chop punctuates the groove at the top of the mix',
      'solo lead floats above the rest of the arrangement'
    ],
    melody: [
      'synth lead carries the melody while a slow pad underpins the harmony',
      'lead synth sings above a soft, sustained pad foundation',
      'pad holds the emotional space; lead melody shapes the foreground statement'
    ]
  }
};

export function electronicPlanePhrase(plane, variant = 'default') {
  const planeData = ELECTRONIC_PLANES[plane];
  if (!planeData) return null;
  
  // Try to find a category; if not specified, return first available
  const categories = Object.keys(planeData);
  if (categories.length === 0) return null;
  
  const category = categories[0];
  const phrases = planeData[category];
  
  return phrases && phrases.length > 0 ? phrases[0] : null;
}

export const ELECTRONIC_PAIR_LINKS = {
  'pad_lead': [
    'synth lead carries the melody while a slow pad underpins the harmony',
    'lead synth sings above a soft, sustained pad foundation',
    'pad holds the emotional space; lead melody shapes the foreground statement'
  ],
  'pad_arpeggio': [
    'arpeggio locks the groove while a pad sustains the chord harmony',
    'pad supports the harmonic motion as the arpeggio adds rhythmic color',
    'arpeggiated texture sits above a slow, deep pad foundation'
  ],
  'bass_drums': [
    'bass and kick lock together in the rhythmic foundation',
    'bass groove interlocks with the drum machine\'s pocket',
    'kick defines the rhythm; bass reinforces the low end'
  ],
  'bass_pad': [
    'bass sits in the low foundation while a pad holds the mid-range harmony',
    'pad rests on top of a grounded bass line',
    'pad and bass create a full harmonic foundation'
  ],
  'lead_arpeggio': [
    'synth lead carries the melody while arpeggios add rhythmic texture below',
    'arpeggio pattern supports the lead melody without competing',
    'lead melody soars above the steady arpeggio motion'
  ],
  'lead_electricpiano': [
    'electric piano adds harmonic punctuation beneath the lead melody',
    'lead synth sings while electric piano threads rhythmic chords',
    'electric piano supports the lead with warm harmonic texture'
  ],
  'electricpiano_pad': [
    'electric piano adds motion above a sustained pad foundation',
    'pad holds the harmonic bed; electric piano adds rhythmic color',
    'soft pad beneath, electric piano chords floating above'
  ],
  'organ_bass': [
    'organ and bass lock in a soulful, rhythmic foundation',
    'organ swell reinforces the bass groove',
    'bass and organ move together in the low-mid foundation'
  ]
};

export const ELECTRONIC_MOVEMENT = {
  'filter': {
    name: 'Filter Motion',
    examples: ['filter opens', 'filter sweep', 'brightens', 'darkens', 'tone opens'],
    phrases: [
      'synth lead brightens as the filter opens toward the chorus',
      'pad darkens with a smooth filter sweep as energy drops',
      'filtered texture moves from thin to rich across the phrase',
      'lead tone opens up with a rising filter curve'
    ]
  },
  'ducking': {
    name: 'Ducking/Pumping',
    examples: ['ducks back', 'breathes', 'compresses', 'dips', 'pumps'],
    phrases: [
      'bass ducks back each beat as the kick lands, then swells forward',
      'pad breathes in and out with each kick hit',
      'texture compresses slightly on the downbeat, releasing into the phrase',
      'pad dips back on the snare hit, creating space for the snare to land'
    ]
  },
  'delay': {
    name: 'Delay Throws and Echo',
    examples: ['echo', 'delayed', 'trails', 'repeats'],
    phrases: [
      'synth lead throws an echo into the next phrase',
      'vocal chop trails with delayed repetitions, fading away',
      'lead synth bounces with rhythmic echo delays',
      'delayed repeats of the melody blur into the background'
    ]
  },
  'width': {
    name: 'Chorus and Width',
    examples: ['widens', 'modulated', 'shimmers', 'broadens', 'expands'],
    phrases: [
      'pad widens with subtle chorus, creating space and movement',
      'synth texture expands and contracts with modulation',
      'lead synth shimmers with a wide, modulated tone',
      'pad tone broadens with added harmonic width'
    ]
  },
  'distortion': {
    name: 'Distortion and Harmonic Colour',
    examples: ['distortion', 'roughens', 'bite', 'edge', 'gritty', 'harmonic'],
    phrases: [
      'synth lead gains bite and edge with subtle distortion',
      'pad tone roughens slightly as distortion kicks in',
      'texture hardens with added harmonic aggression',
      'lead tone transforms from clean to gritty, adding intensity'
    ]
  },
  'pitch': {
    name: 'Pitch Modulation and Glide',
    examples: ['glide', 'bends', 'modulates', 'sweeps', 'rises', 'falls'],
    phrases: [
      'lead synth bends between notes with a smooth glide',
      'arpeggio notes glide together, blurring the rhythmic edge',
      'synth pitch modulates up and down, adding movement',
      'lead tone sweeps upward, rising with tension'
    ]
  }
};

export function movementPhrase(technique) {
  const movement = ELECTRONIC_MOVEMENT[technique];
  if (!movement || !movement.phrases || movement.phrases.length === 0) return null;
  return movement.phrases[0];
}

export const HYBRID_PAIR_LINKS = {
  'strings_pad': [
    'string pad floats above a soft electronic pad foundation',
    'strings add classical warmth to a cool synth bed',
    'electronic pad holds harmony while strings add lyrical motion'
  ],
  'strings_lead': [
    'string melody weaves with a bright synth lead',
    'synth lead cuts through a bed of warm strings',
    'strings and synth lead trade phrases in a call-and-response'
  ],
  'woodwinds_pad': [
    'woodwind color floats above a sustained synth foundation',
    'synth pad holds the emotional space; woodwinds add articulation',
    'woodwind accents punctuate the smooth synth bed'
  ],
  'woodwinds_lead': [
    'woodwind and synth lead trade melodic phrases',
    'synth lead carries the hook while woodwind adds answering color',
    'woodwind countermelody weaves beneath a bright synth lead'
  ],
  'brass_pad': [
    'brass adds power and punctuation above a soft synth pad',
    'pad foundation supports brass statements from above',
    'soft pad sustains while brass punches through on key moments'
  ],
  'brass_lead': [
    'brass fanfare cuts through a bright synth lead',
    'synth lead and brass trade foreground statements',
    'brass adds power while synth lead carries detail'
  ]
};

export function allElectronicPhrases() {
  const phrases = new Set();
  
  // Plane phrases
  Object.values(ELECTRONIC_PLANES).forEach(planeData => {
    Object.values(planeData).forEach(categoryPhrases => {
      categoryPhrases.forEach(phrase => phrases.add(phrase));
    });
  });
  
  // Pair links
  Object.values(ELECTRONIC_PAIR_LINKS).forEach(pairPhrases => {
    pairPhrases.forEach(phrase => phrases.add(phrase));
  });
  
  // Movement
  Object.values(ELECTRONIC_MOVEMENT).forEach(movement => {
    movement.phrases.forEach(phrase => phrases.add(phrase));
  });
  
  // Hybrid
  Object.values(HYBRID_PAIR_LINKS).forEach(hybridPhrases => {
    hybridPhrases.forEach(phrase => phrases.add(phrase));
  });
  
  return Array.from(phrases);
}

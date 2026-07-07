export const defaultState = {
  engine: "Balearic",
  style: {
    preset: "Poolside Warm",
    phase: "Mid Chill Tempo 90-100 BPM, medium Energy, Downtempo Balearic track inspired by Cafe Del Mar / Milchbar.",
    pad: "Warm analogue synth pads layered with Pulse Pad Textures and soft synth layers.",
    bass: "Fretless bass groove with smooth melodic movement.",
    rhythm: "Natural brushed drums with organic percussion including congas, bongos, shakers and hand percussion.",
    percussion: "Soft layered strings blended underneath the pads for depth.",
    motif: "Clean nylon guitar motifs with soft rhythmic strumming drifting in and out of the mix.",
    movement: "Wide stereo panning movement across pads and motifs using left-right automation and slow modulation.",
    vocalMode: "Descriptor",
    vocalGender: "Female",
    vocalDescriptor: "Airy female vocal with intimate tone and restrained delivery.",
    maxMode: true,
    negativePrompt: "",
    buildMode: "classic",
    palette: "electronic",
    cluster: "organic",
    arrangement: false,
    bpmOverride: ""
  },
  song: {
    title: "",
    sourceType: "Original concept",
    themeLens: "Inspired by source",
    subject: "two people finding peace across distance",
    sourceNotes: "",
    genreFamily: "Chillout / Balearic",
    eraBias: "Timeless / mixed-era",
    mood: "Melancholic",
    energy: "Low-mid",
    perspective: "First person",
    languageStyle: "Poetic",
    imageryDensity: "Moderate",
    narrativeClarity: "Balanced",
    hookStyle: "Immediate and memorable",
    rhymeDensity: "Light",
    lineLength: "8-10 syllables",
    vocalFraming: "Female lead",
    deliveryStyle: "Controlled and intimate",
    negativeRules: "avoid generic fire/ice metaphors, avoid explaining the song, avoid forced rhymes",
    cleanLanguage: true,
    avoidCliche: true,
    titleInChorus: true,
    repeatHook: true
  },
  structure: {
    templateId: "balearic-drift",
    includePreChorus: true,
    includeBridge: true
  },
  languageLayer: {
    enabled: true,
    language: "French",
    mode: "Foreign phrase layer",
    placement: "Chorus or backing phrase",
    intensity: "Light",
    notes: ""
  },
  integration: {
    useStyleToGuideLyrics: true,
    strictValidation: false
  },
  claude: {
    apiKeyRemembered: false,
    transport: "direct",
    model: "claude-opus-4-1-20250805",
    temperature: 0.8,
    maxTokens: 4000
  },
  advanced: {
    manualThemeBrief: "",
    manualLyrics: ""
  },
  outputs: {
    stylePrompt: "",
    lyrics: "",
    negativePrompt: "",
    themeBrief: "",
    validation: null,
    rawClaudeJson: null,
    rawClaudeText: ""
  }
};

export const appState = structuredClone(defaultState);

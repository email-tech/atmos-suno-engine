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
 * Each engine holds four things:
 *   bannedInstruments  - the shared "never let these appear" list for the engine
 *   moodBundles        - preset buttons; picking one pre-fills a coherent set of
 *                        musical choices, and may optionally tweak the keep-out
 *                        list for that mood only
 *   synonymBank        - stock phrases with alternates, rotated across a batch so
 *                        ten generated prompts don't read identically
 *   refTracks          - real reference songs used as quality yardsticks
 *
 * KEEP-OUT LAYERING (the per-mood override mechanic):
 *   A mood's effective keep-out list = (engine bannedInstruments + mood.bannedAdd)
 *                                       minus mood.bannedRemove
 *   Both bannedAdd and bannedRemove default to empty, so until a mood is
 *   deliberately tuned it behaves identically to the single shared list.
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

  Enigma:               { bannedInstruments: [], moodBundles: {}, synonymBank: {}, refTracks: [] },
  Delerium:             { bannedInstruments: [], moodBundles: {}, synonymBank: {}, refTracks: [] },
  Era:                  { bannedInstruments: [], moodBundles: {}, synonymBank: {}, refTracks: [] },
  "Composer-Orchestral":{ bannedInstruments: [], moodBundles: {}, synonymBank: {}, refTracks: [] },
  "Composer-Electronic":{ bannedInstruments: [], moodBundles: {}, synonymBank: {}, refTracks: [] },
  Producer:             { bannedInstruments: [], moodBundles: {}, synonymBank: {}, refTracks: [] },
  Remixer:              { bannedInstruments: [], moodBundles: {}, synonymBank: {}, refTracks: [] }
};

/*
 * resolveKeepOut(engineName, moodName)
 * Returns the effective keep-out list for a given engine + mood, applying the
 * per-mood add/remove layering. Safe to call on stub engines (returns []).
 */
function resolveKeepOut(engineName, moodName) {
  const engine = EngineExtras[engineName];
  if (!engine) return [];

  const shared = engine.bannedInstruments || [];
  const mood = (engine.moodBundles && engine.moodBundles[moodName]) || {};
  const add = mood.bannedAdd || [];
  const remove = mood.bannedRemove || [];

  // shared + add, then drop anything in remove (case-insensitive match)
  const removeLower = remove.map(s => s.toLowerCase());
  const combined = [...shared, ...add];
  const seen = new Set();
  const result = [];
  for (const item of combined) {
    const key = item.toLowerCase();
    if (removeLower.includes(key)) continue; // this mood is allowed to use it
    if (seen.has(key)) continue;             // avoid duplicates
    seen.add(key);
    result.push(item);
  }
  return result;
}

// Make available to the rest of the app (and harmless if loaded standalone).
if (typeof window !== "undefined") {
  window.EngineExtras = EngineExtras;
  window.resolveKeepOut = resolveKeepOut;
}

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

export const EngineExtras = {

  Balearic: {

    // Interaction/arrangement language is mandatory in the style string for this
    // engine (standing project rule) — it is no longer an optional toggle.
    interplayAlways: true,

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
        band: "84-96", bpm: 90, beatless: false, colorChance: 0.5,
        phase: "mid chill, 84-96 BPM, low-medium energy", energy: "low-medium energy",
        palettes: {
          electronic: {
            pads: ["Warm analogue synth pads layered with soft harmonic synth layers","Lush analogue pads blended with rich evolving tonal layers","Textured polysynth layers with analogue warmth and gentle modulation movement"],
            harmony: ["moving through warm minor-seventh voicings in a loose two-chord vamp across an eight-bar cycle","built on extended minor-ninth chord voicings with a soft turnaround resolving each cycle","a modal Dorian chord cycle looping steadily without a pop chorus lift"],
            bass: ["Electric bass guitar with warm rounded tone and flowing groove","Fretless bass groove with smooth melodic movement","Deep sub bass providing weight and low-end warmth"],
            rhythm: ["Natural brushed drums with organic percussion including congas, shakers and hand percussion","Live acoustic drums with a soft natural feel, subtle groove and light ghost notes, layered with organic percussion","Minimal downtempo groove with soft kick, brushed snare and light percussion textures"],
            strings: ["Subtle string textures supporting the harmonic space","Soft layered strings blended underneath the pads for depth"],
            motif: ["Rhodes electric piano motifs with warm chord movement and melodic phrasing","Arpeggiated synth leads weaving through the mix with evolving rhythmic motion","Clean nylon guitar motifs with soft rhythmic strumming drifting in and out of the mix"],
            color: ["an occasional melodica phrase answering in a gap","a brief hang drum figure surfacing between phrases","a short harp flourish drifting through the space"],
            movement: ["Rhythmic autopan and modulation creating groove-based movement across percussion and melodic elements","Wide stereo panning movement across pads and motifs using left-right automation and slow modulation","Delay-driven movement using tempo-synced echoes and cascading repeats creating evolving rhythmic space"]
          },
          acoustic: {
            pads: ["Warm loose Rhodes chords comping gently around the groove with soft jazz-tinged voicings", "Soft-strummed nylon guitar chords with warm natural resonance and gentle rhythmic movement", "Mellow marimba chord pads with rounded wooden tone and soft sustain", "Gentle Wurlitzer chord voicings with warm vintage character drifting under the mix"],
            bass: ["Warm upright bass walking in a loose organic groove with soft fingered articulation", "Soft-attack fretless upright bass gliding melodically beneath the harmony", "Fingerstyle rounded electric bass with warm woody tone and relaxed movement"],
            rhythm: ["Loose live hand-percussion broken-beat with brushed snare backbeat, congas and shakers breathing between hits", "Natural brushed drums with soft ghost-note snare, congas and hand percussion for an organic live feel", "Soft live kit with brushed snare, light rimwork and warm hand percussion textures"],
            strings: ["Soft-bowed layered strings swelling gently underneath the harmony for warmth and depth", "Distant soft brass pad adding warm mellow colour beneath the mix", "Mellow muted-guitar comping weaving lightly through the texture"],
            motif: ["Restrained soft flute lines with airy breathy phrasing drifting through the mix", "Understated mallet melody with warm rounded tone and gentle sustained notes", "Muted vibraphone motif with soft mallet phrasing and smooth melodic movement", "Gentle kalimba melody with delicate plucked tone and hypnotic repetition", "Breathy soft clarinet line with warm woody tone and relaxed phrasing"],
            color: ["an occasional melodica phrase answering in a gap","a brief hang drum figure surfacing between phrases","a short harp flourish drifting through the space"],
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
        band: "90-105", bpm: 96, beatless: false, colorChance: 0.5,
        phase: "mid chill, 90-105 BPM, medium energy", energy: "medium energy",
        palettes: {
          electronic: {
            pads: ["Lush analogue pads blended with rich synth textures and evolving tonal layers","Layered analogue pads combined with Pulse Pad Textures and soft harmonic synth layers","Cinematic synth pad swells with wide evolving harmonic layers"],
            harmony: ["built on suspended add9 voicings opening into a major-seventh resolution across long phrases","a slow minor-to-relative-major progression unfolding over eight-bar cycles","wide open sus2 chord voicings holding the harmony before a delayed resolve"],
            bass: ["Fretless bass groove with smooth melodic movement","FM bass with soft attack and subtle rhythmic pulse","Deep sub bass providing weight and low-end warmth"],
            rhythm: ["Minimal downtempo drum groove with soft kick, brushed snare and light percussion textures","Lounge/house drum kit with soft kick, clean snare and tight hi-hats, supported by light percussion"],
            strings: ["Slow string bed sitting deep in the mix","Soft layered strings blended underneath the pads for depth","Sweeping string textures rising and falling beneath the pads"],
            motif: ["Rhodes electric piano motifs with warm chord movement and melodic phrasing","Arpeggiated synth leads weaving through the mix with evolving rhythmic motion","Soft piano motifs with gentle melodic phrasing drifting through the mix"],
            color: ["an occasional glockenspiel accent shimmering above the chords","a brief flute line rising through a gap in the arrangement","a short tubular bell tone ringing beneath the harmony"],
            movement: ["Wide stereo panning movement across pads and motifs using left-right automation and slow modulation","Filter and modulation movement using LFO, chorus and phaser creating evolving tonal shifts across pads and textures"]
          },
          acoustic: {
            pads: ["Warm string-machine chords swelling slowly with lush cinematic depth", "Glossy electric-piano voicings with smooth sustained chord movement", "Soft harp glissando chords cascading gently through the harmonic space", "Lush bowed-string chord beds rising and falling beneath the melody"],
            bass: ["Bowed sustained upright bass holding long warm tones beneath the harmony", "Smooth fretless electric bass gliding melodically under the strings"],
            rhythm: ["Soft hybrid kit with a gentle brushed-snare shuffle and light orchestral percussion", "Brushed drums with delicate cymbal swells and soft timpani-style accents"],
            strings: ["Soft-focus sweeping strings rising in long cinematic phrases across the field", "Distant soft choir pad adding wordless warmth beneath the harmony", "Shimmering orchestral texture with gentle tremolo movement"],
            motif: ["Distant soft muted-horn swell with warm restrained phrasing", "Soft vibraphone melody with smooth sustained notes and cinematic space", "Delicate celeste melody with bell-like clarity drifting over the strings", "Restrained soft oboe line with warm expressive phrasing"],
            color: ["an occasional glockenspiel accent shimmering above the chords","a brief flute line rising through a gap in the arrangement","a short tubular bell tone ringing beneath the harmony"],
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
        band: "85-100", bpm: 92, beatless: false, colorChance: 0.5,
        phase: "low-mid chill, 85-100 BPM, low-medium energy", energy: "low-medium energy",
        palettes: {
          electronic: {
            pads: ["Textured polysynth layers with analogue warmth and gentle modulation movement","Warm analogue synth pads layered with Pulse Pad Textures and soft synth layers","Vintage analogue synth pads with slow evolving filter movement"],
            harmony: ["a hypnotic two-chord analogue vamp cycling with no chorus lift","held minor-ninth voicings drifting with slow chromatic inner movement","a one-chord modal centre with the harmony shifting only by inversion"],
            bass: ["FM bass with soft attack and subtle rhythmic pulse","Deep sub bass providing weight and low-end warmth","Plucky bass with warm analog character","Hybrid bass combining sub bass depth with mid-range melodic tone"],
            rhythm: ["Minimal downtempo drum groove with soft kick, electronic snare and light percussion textures","Simple steady programmed beat with soft kick and tight light percussion"],
            strings: ["Subtle string textures supporting the harmonic space","Soft layered strings blended underneath the pads for depth"],
            motif: ["Arpeggiated synth leads weaving through the mix with evolving rhythmic motion","Soft synth lead motifs with gentle melodic phrasing and analog character","Rhodes electric piano motifs with warm chord movement and melodic phrasing"],
            color: ["an occasional detuned chime accent surfacing between cycles","a brief plucked synth figure answering in the space","a short vintage organ chord swelling under the pads"],
            movement: ["Filter and modulation movement using LFO, chorus and phaser creating evolving tonal shifts across pads and textures","Phaser and chorus modulation creating slow evolving movement across synth layers"]
          },
          acoustic: {
            pads: ["Watery Rhodes-through-chorus chords with lush shimmering movement", "Soft mellotron-style pad chords with warm vintage tape character", "Vintage electric-piano voicings with gentle tremolo and warm sustain"],
            bass: ["Gliding fretless electric bass with smooth warm melodic movement", "Warm upright bass with soft rounded tone anchoring the harmony"],
            rhythm: ["Simple soft live kit with a brushed backbeat and light steady percussion", "Minimal live groove with soft brushwork and gentle hand percussion"],
            strings: ["Soft mellotron string layer with warm hazy analog character", "Distant bowed-string shimmer adding subtle movement beneath the pads"],
            motif: ["Soft vibraphone melody with smooth mallet phrasing and hypnotic repetition", "Restrained Wurlitzer accents with warm vintage tone drifting through the mix", "Delicate glockenspiel bell melody with bright clear tone and sparse phrasing", "Gentle music-box-style melody with fragile plucked tone and slow movement"],
            color: ["an occasional detuned chime accent surfacing between cycles","a brief plucked autoharp figure answering in the space","a short vintage organ chord swelling under the pads"],
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
        band: "90-105", bpm: 100, beatless: false, colorChance: 0.5,
        phase: "mid chill, 90-105 BPM, medium energy", energy: "medium energy",
        palettes: {
          electronic: {
            pads: ["Deep ambient pad layers with soft Pulse Pad Textures and evolving atmosphere","Warm analogue synth pads with dub-style space and depth"],
            harmony: ["a single modal chord centre held under the groove with dub-style harmonic stasis","a two-chord minor vamp cycling with heavy space between the changes","a Dorian one-chord vamp with the harmony implied by the bassline"],
            bass: ["Deep sub bass providing weight and low-end warmth","Hybrid bass combining sub bass depth with mid-range melodic tone","Dub bass with deep rounded tone and spacious movement"],
            rhythm: ["Minimal downtempo drum groove with soft kick, cross-stick snare and light percussion textures","Dub-influenced downtempo groove with soft kick, rim clicks and tabla-style hand percussion"],
            strings: ["Subtle string textures supporting the harmonic space","Soft layered strings blended underneath the pads for depth"],
            motif: ["Sparse Rhodes electric piano motifs drifting in and out of the mix","Soft synth lead motifs echoing through the mix with spacious phrasing","Clean guitar motifs with dub delay drifting through the mix"],
            color: ["an occasional dub organ stab spinning off into the delay","an occasional clavinet skank chopping into the echo","a short hand-bell accent ringing away into the space"],
            movement: ["Delay-driven movement using tempo-synced echoes and cascading repeats creating evolving rhythmic space","Dub-style delay throws and spring reverb movement creating deep spacious motion"]
          },
          acoustic: {
            pads: ["Low steady harmonium drone holding a warm hypnotic harmonic centre", "Hazy detuned electric-piano chords with dub-style space and delay", "Hypnotic kalimba drone pattern with warm plucked repetition"],
            bass: ["Heavy sparse deep upright bass with rounded dub weight and long space between notes", "Rounded acoustic bass with dub delay throwing the low end into the reverb"],
            rhythm: ["Dub-tinged live groove with cross-stick snare, tabla hand percussion and heavy space", "Sparse hand-drum groove with rimshot accents and wide dub-style gaps"],
            strings: ["Warm bowed-string reverb tail drifting into the dub space", "Distant soft brass pad adding mellow colour beneath the drone"],
            motif: ["Distant soft muted trumpet with warm restrained phrasing echoing into the space", "Restrained bouzouki melodic line with bright plucked tone drifting in and out", "Breathy soft melodica melody with warm reedy tone and dub delay", "Gentle kora melodic line with delicate rippling plucked phrasing", "Sparse santoor melodic accents shimmering through the reverb"],
            color: ["an occasional dub organ stab spinning off into the delay","an occasional clavinet skank chopping into the echo","a short hand-bell accent ringing away into the space"],
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
        band: "96-108", bpm: 104, beatless: false, colorChance: 0.5,
        phase: "mid-high chill, 96-108 BPM, medium energy", energy: "medium energy",
        palettes: {
          electronic: {
            pads: ["Deep ambient pad layers with soft Pulse Pad Textures and evolving atmosphere","Dark analogue synth pads with slow evolving filter movement"],
            harmony: ["a dark minor chord cycle repeating without resolution","held minor-seventh voicings shifting slowly through chromatic inner movement","a one-chord hypnotic centre with the harmony moving only by inversion"],
            bass: ["Deep sub bass providing weight and low-end warmth","FM bass with soft attack and subtle rhythmic pulse"],
            rhythm: ["Minimal downtempo groove with soft four-on-the-floor kick, brushed snare and light percussion","Deep hypnotic groove with soft kick, light hats and sparse percussion textures"],
            strings: ["Subtle string textures supporting the harmonic space","Slow string bed sitting deep in the mix"],
            motif: ["Sparse synth stabs drifting through the mix with deep reverb","Soft Rhodes electric piano motifs with sparse phrasing and deep space","Sparse arpeggiated synth lead weaving slowly through the mix"],
            color: ["an isolated celeste note surfacing then dissolving into the reverb","an occasional low bell tone ringing out into the space","a brief harp figure drifting faintly beneath the pulse"],
            movement: ["Filter and modulation movement using LFO and phaser creating slow evolving tonal shifts","Wide stereo panning movement across pads using left-right automation and slow modulation"]
          },
          acoustic: {
            pads: ["Dark sustained Rhodes chords holding long tones in deep space", "Sparse detuned electric-piano voicings with cold restrained movement"],
            bass: ["Dark deep upright bass with sparse fingered notes and heavy space", "Sparse plucked contrabass sitting low and barely moving in the dark"],
            rhythm: ["Sparse soft brushed groove with wide space and restrained ghost-note snare", "Minimal live kit with soft brushwork and long silences between hits"],
            strings: ["Cold bowed-string wash drifting slowly beneath the harmony", "Sparse low bowed drone holding a dark sustained tone"],
            motif: ["Isolated slow muted-vibraphone note ringing out into the reverb", "Faint distant muted-horn tone surfacing then dissolving into space", "Distant faint music-box melody with fragile sparse phrasing"],
            color: ["an isolated celeste note surfacing then dissolving into the reverb","an occasional low bell tone ringing out into the space","a brief harp figure drifting faintly beneath the pulse"],
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
        band: "96-108", bpm: 102, beatless: false, colorChance: 0.5,
        phase: "mid chill, 96-108 BPM, medium energy", energy: "medium energy",
        palettes: {
          electronic: {
            pads: ["Warm analogue synth pads layered with soft harmonic synth layers","Lush analogue pads blended with rich synth textures and evolving tonal layers"],
            harmony: ["warm major-seventh and add9 voicings moving through an unhurried eight-bar cycle","a Mixolydian chord vamp cycling gently with a soft turnaround","open sus2 voicings drifting between two chords with no chorus lift"],
            bass: ["Plucky bass with warm analog character","Electric bass guitar with warm rounded tone and flowing groove","Fretless bass groove with smooth melodic movement"],
            rhythm: ["Lounge/house drum kit with soft kick, clean snare and tight hi-hats, supported by congas, shakers and light percussion","Minimal downtempo groove with soft kick, clean snare and light percussion textures"],
            strings: ["Subtle string textures supporting the harmonic space","Soft layered strings blended underneath the pads for depth"],
            motif: ["Clean nylon guitar motifs with soft rhythmic strumming drifting in and out of the mix","Rhodes electric piano motifs with warm chord movement and melodic phrasing","Soft acoustic guitar phrases with gentle rhythmic movement and natural flow"],
            color: ["an occasional accordion phrase drifting through a gap","a brief kalimba figure surfacing over the groove","a short vibraphone accent shimmering above the chords"],
            movement: ["Wide stereo panning movement across pads and motifs using left-right automation and slow modulation","Rhythmic autopan and modulation creating groove-based movement across percussion and melodic elements"]
          },
          acoustic: {
            pads: ["Sun-warmed Rhodes chords with soft warm voicings drifting under the melody", "Understated sustained classical-guitar chords with gentle fingered warmth", "Soft mandolin chord shimmer with bright delicate tremolo"],
            bass: ["Gentle warm upright bass rolling softly beneath the groove", "Rounded soft fretless bass with smooth melodic movement"],
            rhythm: ["Light bongos and shaker with a soft snare backbeat and gentle forward motion", "Warm live kit with congas, light percussion and a relaxed daytime feel"],
            strings: ["Sun-warmed soft strings adding gentle warmth beneath the harmony", "Light-touch string shimmer floating over the groove"],
            motif: ["Gentle airy pan-flute melody with soft breathy phrasing drifting through the mix", "Light warm marimba melody with rounded wooden tone and easy movement", "Softly fingerpicked nylon-guitar motif with warm delicate phrasing", "Soft restrained Wurlitzer melody with warm mellow tone and unhurried phrasing"],
            color: ["an occasional accordion phrase drifting through a gap","a brief kalimba figure surfacing over the groove","a short vibraphone accent shimmering above the chords"],
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
        band: "beatless", bpm: null, beatless: true, colorChance: 0.5,
        phase: "beatless, no drums, slow evolving atmosphere", energy: "low energy",
        palettes: {
          electronic: {
            pads: ["Deep ambient pad layers with soft Pulse Pad Textures and evolving atmosphere","Lush evolving analogue pads with slow morphing harmonic layers","Textured polysynth layers with analogue warmth and slow modulation movement"],
            harmony: ["harmonic stasis on a single sustained modal centre with change carried by timbre","slow-moving suspended voicings drifting with no cadence","a two-chord glacial harmonic cycle turning over long spans"],
            bass: ["Deep sub drone providing weight and low-end warmth","Sustained low synth drone underpinning the pads"],
            rhythm: [],
            strings: ["Slow string bed sitting deep in the mix","Soft layered strings blended underneath the pads for depth"],
            motif: ["Sparse soft synth tones drifting through the mix with deep reverb","Gentle bell-like synth tones with slow sparse phrasing"],
            color: ["an occasional distant harp figure drifting through the field","a brief soft flute tone surfacing in the space","a short kalimba tone rippling faintly through the atmosphere"],
            movement: ["Filter and modulation movement using LFO, chorus and phaser creating slow evolving tonal shifts across pads and textures","Wide stereo panning movement across pad layers using left-right automation and slow modulation"]
          },
          acoustic: {
            pads: ["Slow-swelling soft choir pad with wordless warmth morphing over long spans", "Distant low organ-tone pad holding a sustained harmonic centre", "Warm bowed-string pad bed rising and falling in glacial swells"],
            bass: ["Deep sustained bowed drone holding the low register unmoving", "Low sustained cello drone underpinning the pads with warm weight"],
            rhythm: [],
            strings: ["Slow string bed sitting deep in the mix with soft evolving movement", "Soft layered bowed strings drifting slowly beneath the pads"],
            motif: ["Distant sparse piano tones ringing out with deep reverb and long decay", "Sparse slow bell tones surfacing gently through the atmosphere", "Isolated soft glass-harmonica tone shimmering faintly in the space"],
            color: ["an occasional distant harp figure drifting through the field","a brief soft flute tone surfacing in the space","a short kalimba tone rippling faintly through the atmosphere"],
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
        band: "82-92", bpm: 86, beatless: false, colorChance: 0.5,
        phase: "low-mid chill, 82-92 BPM, low-medium energy", energy: "low-medium energy",
        palettes: {
          electronic: {
            pads: ["Detuned analogue synth pads with hazy evolving tonal layers","Textured polysynth layers with analogue warmth and gentle modulation movement"],
            harmony: ["a hazy minor-seventh loop cycling behind the beat with no chorus lift","a two-chord vamp with flattened blues-inflected voicings","a Dorian chord loop drifting slightly detuned beneath the groove"],
            bass: ["Deep sub bass providing weight and low-end warmth","Hybrid bass combining sub bass depth with mid-range melodic tone"],
            rhythm: ["Lounge/downtempo drum kit with heavy swung kick, fat snare on the backbeat and tight hi-hats","Trip-hop drum groove with lazy swung kick, deep snare and light percussion textures"],
            strings: ["Subtle string textures supporting the harmonic space","Soft layered strings blended underneath the pads for depth"],
            motif: ["Rhodes electric piano motifs with hazy detuned chord movement","Vibraphone phrases with smooth sustained notes and gentle movement","Sparse synth lead motifs drifting through the mix with analog saturation"],
            color: ["an occasional dusty organ stab surfacing behind the beat","a brief harmonica phrase smeared through the delay","a short flute line drifting hazily above the groove"],
            movement: ["Filter and modulation movement using LFO, chorus and phaser creating evolving tonal shifts across pads and textures","Delay-driven movement using tempo-synced echoes creating evolving rhythmic space"]
          },
          acoustic: {
            pads: ["Hazy detuned Rhodes chords with warm dusty vintage tone", "Warm vintage electric-piano voicings with smoky detuned movement"],
            bass: ["Heavy upright bass with dark woody tone anchoring the swung groove", "Thick plucked contrabass sitting deep behind the beat"],
            rhythm: ["Heavy lazy swung live kit with a fat snare backbeat and dusty broken-beat feel", "Dusty broken-beat groove with rimshot accents, brushed snare and heavy head-nod"],
            strings: ["Smoky bowed-string tail drifting darkly beneath the beat", "Distant muted-brass pad adding moody colour to the mix"],
            motif: ["Muted distant brass stabs surfacing hazily above the beat", "Slow detuned vibraphone motif with warm smeared phrasing", "Hazy muted-trumpet line drifting loosely behind the rhythm", "Restrained muted electric-guitar motif with dark reverbed tone"],
            color: ["an occasional dusty organ stab surfacing behind the beat","a brief harmonica phrase smeared through the delay","a short flute line drifting hazily above the groove"],
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
        band: "118-124", bpm: 122, beatless: false, colorChance: 0.5,
        phase: "club groove, 118-124 BPM, high energy", energy: "high energy",
        palettes: {
          electronic: {
            pads: ["Warm analogue house pads with bright uplifting chords","Lush Balearic synth pad stabs with rich harmonic movement","Classic house chord stabs with warm analog tone"],
            harmony: ["bright major-seventh and ninth chord stabs cycling an eight-bar progression with a lifting turnaround","a minor-to-major progression looping through verse and peak sections","classic house chord voicings moving through a four-chord cycle with a clear lift"],
            bass: ["Heavy electric slap bass with funky rhythmic groove","Deep house bassline with warm rounded analog tone","Punchy slap-bass groove driving the track forward"],
            rhythm: ["Four-on-the-floor house drum machine groove with crisp hi-hats and clap on the backbeat","Classic house beat with punchy kick, snappy claps and open hi-hats","TR-909 house groove with tight kick, crisp hats and shakers"],
            strings: ["Bright disco string stabs supporting the groove","Subtle string textures lifting the harmonic space"],
            motif: ["Prominent house piano riff with bright rhythmic chord stabs","Uplifting piano chord progression riff driving the track","Acoustic guitar phrases with rhythmic Balearic strumming","Sunlit synth-stab riff weaving through the groove"],
            color: ["an occasional organ stab punching through the groove","a brief steel-pan accent lifting a bar","a short vocal-chop stab lifting the turnaround"],
            movement: ["House-style filter sweeps opening and closing across the pads","Rhythmic gating and filter movement driving the groove","Wide stereo automation across the chord stabs and riffs"]
          },
          acoustic: {
            pads: ["Warm live Wurlitzer chord voicings with bright rhythmic stabs driving the groove", "Sun-warmed nylon-guitar chord strumming with rhythmic Balearic movement", "Warm Rhodes chord stabs punctuating the four-on-the-floor groove"],
            bass: ["Funky electric slap bass with live percussive articulation and driving groove", "Warm fingerstyle electric bass locking a funky rhythmic house groove"],
            rhythm: ["Live-feel house groove with congas, tambourine and hand percussion over a steady four-on-the-floor kick", "Organic house beat with live percussion, shakers and a punchy driving kick"],
            strings: ["Warm live string-section stabs lifting the groove with bright energy", "Soft layered strings adding warmth beneath the chord stabs"],
            motif: ["Bright live piano riff with rhythmic chord stabs driving the track forward", "Rhythmic acoustic-guitar Balearic strumming weaving through the groove", "Warm marimba riff with rounded wooden tone dancing over the beat"],
            color: ["an occasional organ stab punching through the groove","a brief steel-pan accent lifting a bar","a short vocal-chop stab lifting the turnaround"],
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
        band: "100-112", bpm: 108, beatless: false, colorChance: 0.5,
        phase: "chugging disco groove, 100-112 BPM, medium-high energy", energy: "medium-high energy",
        palettes: {
          electronic: {
            pads: ["Cosmic analog synth pads with retro-futuristic warmth","Lush disco synth chords with evolving tonal layers","Warm string-machine pads with cosmic shimmer"],
            harmony: ["minor-seventh and ninth voicings chugging through a four-chord disco cycle","a two-chord cosmic vamp with a syncopated harmonic push","extended thirteenth voicings cycling with a disco turnaround"],
            bass: ["Thick driving disco bassline with funky octave movement","Chugging analog bass with steady rhythmic pulse","Deep funky synth bass locking the groove"],
            rhythm: ["Steady disco drum groove with four-on-the-floor kick, crisp hats and tambourine","Slo-mo disco beat with punchy kick, claps and shakers","Chugging disco kit with tight hats and live-feel percussion"],
            strings: ["Sweeping cosmic disco strings rising over the groove","Lush disco string stabs punctuating the rhythm"],
            motif: ["Modern synth arpeggios cycling through the mix","Funky rhythm guitar with tight percussive chords","Cosmic synth lead with retro-futuristic phrasing","Bright clavinet funk riff driving the groove"],
            color: ["an occasional vocoder-style synth phrase weaving through the chug","a brief brass-section stab punching the turnaround","a short organ riff lifting the groove"],
            movement: ["Cosmic filter sweeps and phaser movement across synths and strings","Rhythmic autopan and modulation driving the chug","Wide stereo automation across arpeggios and pads"]
          },
          acoustic: {
            pads: ["Warm live electric-piano chords with funky rhythmic comping", "Funky rhythm-guitar chord comping with tight percussive strumming"],
            bass: ["Thick funky electric bass with driving octave movement and live feel", "Warm fingerstyle disco bass groove locking the chug"],
            rhythm: ["Live disco kit with four-on-the-floor kick, tambourine, congas and crisp hats", "Organic disco groove with live percussion, claps and steady driving hats"],
            strings: ["Lush live disco string section sweeping over the groove", "Warm string stabs punctuating the funky rhythm"],
            motif: ["Funky rhythm-guitar riff with tight percussive wah-inflected chords", "Bright clavinet funk riff with punchy rhythmic bite driving the groove", "Warm Rhodes lead with disco phrasing weaving through the mix"],
            color: ["an occasional brass-section stab punching the turnaround","a brief organ riff lifting the groove","a short vibraphone accent dancing over the chug"],
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
        band: "120-124", bpm: 122, beatless: false, colorChance: 0.5,
        phase: "deep house groove, 120-124 BPM, medium-high energy", energy: "medium-high energy",
        palettes: {
          electronic: {
            pads: ["Lush emotional synth chords with warm evolving movement","Deep warm analog pads with atmospheric depth","Rich evolving synth chord layers with soft harmonic swell"],
            harmony: ["a minor-ninth chord progression cycling through an eight-bar build","a suspended add9 chord cycle rising toward a peak and resolving back","an extended minor-seventh progression looping with a lifting turnaround"],
            bass: ["Deep rolling house bassline with warm sub weight","Warm sub bass with smooth rolling groove","Deep house bass with rounded analog tone"],
            rhythm: ["Deep house drum groove with heavy four-on-the-floor kick, crisp hats and organic percussion","Four-on-the-floor deep house beat with shakers, congas and tight hats","Driving deep house kit with punchy kick and layered percussion"],
            strings: ["Warm atmospheric string textures beneath the chords","Subtle emotional strings lifting the harmonic space"],
            motif: ["Emotive plucked synth melody weaving through the mix","Melodic synth lead with warm emotional phrasing","Soulful vocal-chop textures drifting through the mix","Bright plucked synth arpeggio rising over the groove"],
            color: ["an occasional organ chord swelling under the groove","a brief bell-tone accent surfacing over the drive","a short harp figure rippling through a gap"],
            movement: ["Warm filter movement and evolving modulation across the deep house groove","Deep atmospheric swells rising and falling over the drive","Wide stereo automation across pads and plucked melodies"]
          },
          acoustic: {
            pads: ["Warm Rhodes chord voicings with deep emotional feel drifting over the groove", "Soft live piano chord layers with warm sustained movement"],
            bass: ["Warm fingerstyle electric bass with a deep rolling groove", "Deep upright bass with rounded warm tone underpinning the drive"],
            rhythm: ["Deep house groove with live congas, shakers and organic percussion over a heavy four-on-the-floor kick", "Organic four-on-the-floor with hand percussion, tight hats and warm live feel"],
            strings: ["Warm live string textures swelling beneath the chords", "Soft layered strings lifting the groove with emotional warmth"],
            motif: ["Emotive Wurlitzer melody weaving warmly through the mix", "Warm marimba melodic line dancing over the deep groove", "Soulful vocal-chop textures drifting emotively through the mix"],
            color: ["an occasional organ chord swelling under the groove","a brief bell-tone accent surfacing over the drive","a short harp figure rippling through a gap"],
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
export function drawInterplay(engineName, clusterId, rand) {
  const roll = (typeof rand === "function") ? rand : Math.random;
  const engine = EngineExtras[engineName];
  if (!engine) return [];
  const cluster = (engine.flavourClusters && engine.flavourClusters[clusterId]) || {};
  const ip = cluster.interplay || {};
  const order = ["conversation", "foundation", "arc"];
  const out = [];
  for (const dim of order) {
    const pool = ip[dim];
    if (Array.isArray(pool) && pool.length) {
      out.push(pool[Math.floor(roll() * pool.length)]);
    }
  }
  return out;
}


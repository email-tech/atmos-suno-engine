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
 *   effective keep-out = (entry.bannedAdd)
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
            perc: ["a tabla pattern ticking beneath the kit","light tambourine and cabasa accents threading the groove"],
            strings: ["Subtle string textures supporting the harmonic space","Soft layered strings blended underneath the pads for depth"],
            texture: ["a warm Hammond organ bed sustaining beneath the chords","a soft mellotron choir layer drifting under the harmony"],
            motif: ["Rhodes electric piano motifs with warm chord movement and melodic phrasing","Arpeggiated synth leads weaving through the mix with evolving rhythmic motion","Clean nylon guitar motifs with soft rhythmic strumming drifting in and out of the mix","Restrained soft soprano-sax lines with warm breathy phrasing drifting through the mix"],
            counter: ["a plucked bouzouki counter-figure weaving against the motif","a soft clavinet counter-line answering the lead"],
            color: ["an occasional melodica phrase answering in a gap","a brief hang drum figure surfacing between phrases","a short harp flourish drifting through the space"],
            movement: ["Rhythmic autopan and modulation creating groove-based movement across percussion and melodic elements","Wide stereo panning movement across pads and motifs using left-right automation and slow modulation","Delay-driven movement using tempo-synced echoes and cascading repeats creating evolving rhythmic space"]
          },
          acoustic: {
            pads: ["Warm loose Rhodes chords comping gently around the groove with soft jazz-tinged voicings", "Soft-strummed nylon guitar chords with warm natural resonance and gentle rhythmic movement", "Mellow marimba chord pads with rounded wooden tone and soft sustain", "Gentle Wurlitzer chord voicings with warm vintage character drifting under the mix"],
            bass: ["Warm upright bass walking in a loose organic groove with soft fingered articulation", "Soft-attack fretless upright bass gliding melodically beneath the harmony", "Fingerstyle rounded electric bass with warm woody tone and relaxed movement"],
            rhythm: ["Loose live hand-percussion broken-beat with brushed snare backbeat, congas and shakers breathing between hits", "Natural brushed drums with soft ghost-note snare, congas and hand percussion for an organic live feel", "Soft live kit with brushed snare, light rimwork and warm hand percussion textures"],
            strings: ["Soft-bowed layered strings swelling gently underneath the harmony for warmth and depth", "Distant soft brass pad adding warm mellow colour beneath the mix", "Mellow muted-guitar comping weaving lightly through the texture"],
            motif: ["Restrained soft flute lines with airy breathy phrasing drifting through the mix", "Understated mallet melody with warm rounded tone and gentle sustained notes", "Muted vibraphone motif with soft mallet phrasing and smooth melodic movement", "Gentle kalimba melody with delicate plucked tone and hypnotic repetition", "Breathy soft soprano-sax line with warm mellow tone and relaxed phrasing", "Soft slide-guitar motif with warm gliding phrasing drifting through the mix", "Warm grand-piano motif with soft rounded voicings and gentle melodic phrasing"],
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
            perc: ["light shaker and triangle accents threading the groove","a soft frame-drum pulse beneath the kit"],
            strings: ["Slow string bed sitting deep in the mix","Soft layered strings blended underneath the pads for depth","Sweeping string textures rising and falling beneath the pads"],
            texture: ["a low pipe-organ layer sustaining beneath the harmony","a soft cor-anglais layer drifting under the chords"],
            motif: ["Rhodes electric piano motifs with warm chord movement and melodic phrasing","Arpeggiated synth leads weaving through the mix with evolving rhythmic motion","Soft piano motifs with gentle melodic phrasing drifting through the mix"],
            counter: ["a cello counter-melody answering the lead beneath the strings","a soprano-saxophone counter-line weaving against the motif"],
            color: ["an occasional glockenspiel accent shimmering above the chords","a brief flute line rising through a gap in the arrangement","a short tubular bell tone ringing beneath the harmony"],
            movement: ["Wide stereo panning movement across pads and motifs using left-right automation and slow modulation","Filter and modulation movement using LFO, chorus and phaser creating evolving tonal shifts across pads and textures"]
          },
          acoustic: {
            pads: ["Warm string-machine chords swelling slowly with lush cinematic depth", "Glossy electric-piano voicings with smooth sustained chord movement", "Soft harp glissando chords cascading gently through the harmonic space", "Lush bowed-string chord beds rising and falling beneath the melody", "Soft felt-piano chord voicings with intimate muted tone and gentle sustain"],
            bass: ["Bowed sustained upright bass holding long warm tones beneath the harmony", "Smooth fretless electric bass gliding melodically under the strings"],
            rhythm: ["Soft hybrid kit with a gentle brushed-snare shuffle and light orchestral percussion", "Brushed drums with delicate cymbal swells and soft timpani-style accents"],
            strings: ["Soft-focus sweeping strings rising in long cinematic phrases across the field", "Distant soft choir pad adding wordless warmth beneath the harmony", "Shimmering orchestral texture with gentle tremolo movement"],
            motif: ["Distant soft muted-horn swell with warm restrained phrasing", "Soft vibraphone melody with smooth sustained notes and cinematic space", "Delicate celeste melody with bell-like clarity drifting over the strings", "Restrained soft flugelhorn line with warm mellow expressive phrasing"],
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
            perc: ["light rimshot and shaker accents ticking under the beat","a soft tambourine pulse threading the groove"],
            strings: ["Subtle string textures supporting the harmonic space","Soft layered strings blended underneath the pads for depth"],
            texture: ["a slow string-machine layer sustaining beneath the chords","a soft harmonium bed breathing under the pads"],
            motif: ["Arpeggiated synth leads weaving through the mix with evolving rhythmic motion","Soft synth lead motifs with gentle melodic phrasing and analog character","Rhodes electric piano motifs with warm chord movement and melodic phrasing"],
            counter: ["a soft clavinet counter-figure ticking against the motif","a marimba counter-line weaving beneath the lead"],
            color: ["an occasional detuned chime accent surfacing between cycles","a brief plucked synth figure answering in the space","a short vintage organ chord swelling under the pads"],
            movement: ["Filter and modulation movement using LFO, chorus and phaser creating evolving tonal shifts across pads and textures","Phaser and chorus modulation creating slow evolving movement across synth layers"]
          },
          acoustic: {
            pads: ["Watery Rhodes-through-chorus chords with lush shimmering movement", "Soft mellotron-style pad chords with warm vintage tape character", "Vintage electric-piano voicings with gentle tremolo and warm sustain"],
            bass: ["Gliding fretless electric bass with smooth warm melodic movement", "Warm upright bass with soft rounded tone anchoring the harmony"],
            rhythm: ["Simple soft live kit with a brushed backbeat and light steady percussion", "Minimal live groove with soft brushwork and gentle hand percussion"],
            strings: ["Soft tape-saturated string layer with warm hazy analog character", "Distant bowed-string shimmer adding subtle movement beneath the pads"],
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
            perc: ["udu and shaker accents drifting through the space","a woodblock pulse ticking between the beats"],
            strings: ["Subtle string textures supporting the harmonic space","Soft layered strings blended underneath the pads for depth"],
            texture: ["a sustained cello drone sitting beneath the groove","a slow flanged string layer drifting under the mix"],
            motif: ["Sparse Rhodes electric piano motifs drifting in and out of the mix","Soft synth lead motifs echoing through the mix with spacious phrasing","Clean guitar motifs with dub delay drifting through the mix","Spacious lap-steel slide guitar with dub delay gliding through the mix"],
            counter: ["a vibraphone counter-line answering the lead through the delay","a marimba counter-figure ticking against the motif","a breathy ney-flute counter-line drifting through the delay"],
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
            perc: ["sparse rim and shaker accents ticking in the space","a low tom pulse beneath the kick"],
            strings: ["Subtle string textures supporting the harmonic space","Slow string bed sitting deep in the mix"],
            texture: ["a low pipe-organ drone sustaining under the pulse","a dark analogue sequence pulsing beneath the chords"],
            motif: ["Sparse synth stabs drifting through the mix with deep reverb","Soft Rhodes electric piano motifs with sparse phrasing and deep space","Sparse arpeggiated synth lead weaving slowly through the mix"],
            counter: ["a muted trumpet counter-line answering across the space","a mournful duduk counter-figure weaving beneath the lead"],
            color: ["an isolated celeste note surfacing then dissolving into the reverb","an occasional low bell tone ringing out into the space","a brief harp figure drifting faintly beneath the pulse"],
            movement: ["Filter and modulation movement using LFO and phaser creating slow evolving tonal shifts","Wide stereo panning movement across pads using left-right automation and slow modulation"]
          },
          acoustic: {
            pads: ["Dark sustained Rhodes chords holding long tones in deep space", "Sparse detuned electric-piano voicings with cold restrained movement", "Soft felt-piano chords holding sparse muted tones in deep space"],
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
            perc: ["a cajon and tambourine pulse threading the groove","light claves and shaker accents ticking through the beat"],
            strings: ["Subtle string textures supporting the harmonic space","Soft layered strings blended underneath the pads for depth"],
            texture: ["a warm Hammond organ bed sustaining beneath the chords","a soft harmonium layer breathing under the harmony"],
            motif: ["Clean nylon guitar motifs with soft rhythmic strumming drifting in and out of the mix","Rhodes electric piano motifs with warm chord movement and melodic phrasing","Soft acoustic guitar phrases with gentle rhythmic movement and natural flow","Warm lap-steel guitar melody with smooth gliding sunset phrasing","Restrained soft soprano-sax melody with warm breathy sunset phrasing"],
            counter: ["a bouzouki counter-line answering the lead","a warm flugelhorn counter-figure drifting over the groove"],
            color: ["a brief melodica phrase drifting warmly through a gap","a brief kalimba figure surfacing over the groove","a short vibraphone accent shimmering above the chords","an occasional carefree whistled melody drifting over the groove"],
            movement: ["Wide stereo panning movement across pads and motifs using left-right automation and slow modulation","Rhythmic autopan and modulation creating groove-based movement across percussion and melodic elements"]
          },
          acoustic: {
            pads: ["Sun-warmed Rhodes chords with soft warm voicings drifting under the melody", "Understated sustained classical-guitar chords with gentle fingered warmth", "Soft mandolin chord shimmer with bright delicate tremolo"],
            bass: ["Gentle warm upright bass rolling softly beneath the groove", "Rounded soft fretless bass with smooth melodic movement"],
            rhythm: ["Light bongos and shaker with a soft snare backbeat and gentle forward motion", "Warm live kit with congas, light percussion and a relaxed daytime feel"],
            strings: ["Sun-warmed soft strings adding gentle warmth beneath the harmony", "Light-touch string shimmer floating over the groove"],
            motif: ["Gentle airy pan-flute melody with soft breathy phrasing drifting through the mix", "Light warm marimba melody with rounded wooden tone and easy movement", "Softly fingerpicked nylon-guitar motif with warm delicate phrasing", "Soft restrained Wurlitzer melody with warm mellow tone and unhurried phrasing"],
            color: ["a brief melodica phrase drifting warmly through a gap","a brief kalimba figure surfacing over the groove","a short vibraphone accent shimmering above the chords","an occasional carefree whistled melody drifting over the groove"],
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
            texture: ["a slow mellotron string layer drifting beneath the drone","a distant vibraphone shimmer sustaining in the field"],
            motif: ["Sparse soft synth tones drifting through the mix with deep reverb","Gentle bell-like synth tones with slow sparse phrasing"],
            counter: ["a viola counter-line rising slowly beneath the tones","a soft duduk counter-figure drifting through the space"],
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
            perc: ["a tambourine and shaker pulse dragging behind the beat","light rim and woodblock accents ticking under the groove"],
            strings: ["Subtle string textures supporting the harmonic space","Soft layered strings blended underneath the pads for depth"],
            texture: ["a dusty mellotron string layer smeared under the beat","a low harmonium bed sustaining beneath the groove"],
            motif: ["Rhodes electric piano motifs with hazy detuned chord movement","Vibraphone phrases with smooth sustained notes and gentle movement","Sparse synth lead motifs drifting through the mix with analog saturation"],
            counter: ["a smoky tenor-saxophone counter-line drifting against the lead","a sitar counter-figure weaving hazily behind the beat"],
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
            perc: ["bongos and cowbell accents driving under the kick","timbale and shaker accents lifting the groove"],
            strings: ["Bright disco string stabs supporting the groove","Subtle string textures lifting the harmonic space"],
            texture: ["a warm string-machine layer sustaining under the stabs","a soft Juno-style layer lifting beneath the chords"],
            motif: ["Prominent house piano riff with bright rhythmic chord stabs","Uplifting piano chord progression riff driving the track","Acoustic guitar phrases with rhythmic Balearic strumming","Sunlit synth-stab riff weaving through the groove"],
            counter: ["a funky clavinet counter-riff answering the lead","a plucked synth counter-line dancing against the riff"],
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
            perc: ["cowbell and shaker accents chugging under the kick","bongos and woodblock ticking through the groove"],
            strings: ["Sweeping cosmic disco strings rising over the groove","Lush disco string stabs punctuating the rhythm"],
            texture: ["a soft Juno-style layer sustaining under the chug","a mellotron string bed humming beneath the groove"],
            motif: ["Modern synth arpeggios cycling through the mix","Funky rhythm guitar with tight percussive chords","Cosmic synth lead with retro-futuristic phrasing","Bright clavinet funk riff driving the groove"],
            counter: ["a bright marimba counter-line dancing against the riff","a plucked synth counter-figure answering the lead"],
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
            perc: ["a bongo and rimshot pattern rolling under the kick","tambourine and woodblock accents lifting the groove"],
            strings: ["Warm atmospheric string textures beneath the chords","Subtle emotional strings lifting the harmonic space"],
            texture: ["a warm string-machine layer sustaining beneath the chords","a soft choir-pad layer drifting under the groove"],
            motif: ["Emotive plucked synth melody weaving through the mix","Melodic synth lead with warm emotional phrasing","Soulful vocal-chop textures drifting through the mix","Bright plucked synth arpeggio rising over the groove"],
            counter: ["a plucked nylon-guitar counter-line answering the lead","a vibraphone counter-figure weaving beneath the melody"],
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
    // Interaction/arrangement language is mandatory in the style string
    // (standing project rule) — no longer an optional toggle.
    interplayAlways: true,
    // ------------------------------------------------------------------------
    // Rebuilt 2026-07-14 against the actual catalogue (John: presets were
    // outputting the wrong music). Every cluster is now anchored to a real
    // album, with that album's INSTRUMENTATION, GROOVE FAMILY and BEHAVIOUR.
    //
    // Catalogue-wide constants (present in every cluster, era-shaded):
    //   groove  - slow hypnotic swung beat, hip-hop-derived, 78-100 BPM on the
    //             albums. The 118-140 BPM versions are CLUB REMIXES, not album
    //             tracks. Never four-on-the-floor.
    //   bass    - deep sub with a short recurring low-end motif (a riff, not a
    //             pad): the hook under the hook.
    //   chant   - sampled chant/choir is a TEXTURAL LAYER (strings slot), never
    //             the lead. Era decides WHICH chant: Gregorian (MCMXC),
    //             indigenous/tribal (Cross of Changes), Gregorian + Sanskrit
    //             (Le Roi), Carmina-style massed Latin chorus (Screen), none
    //             (Voyageur, A Posteriori).
    //   hook    - ONE repeating instrumental melodic hook (motif slot), usually
    //             breathy flute (shakuhachi / panpipe) or a vocal-style synth
    //             lead. Enigma writes SONGS: verse -> chorus lift, hook returns.
    //   colour  - the ethnic/acoustic sources are OCCASIONAL colour that fills
    //             gaps, never the spine.
    //   space   - deep cathedral reverb, long delay tails, wide slow panning.
    //
    // "Enigma Style" is KEPT in the genre anchor (John: Suno does not dismiss
    // it) and is now followed by the era's real genre traits rather than an
    // invented sub-genre.
    // ------------------------------------------------------------------------
    presetMap: {
      "Gregorian sacred (MCMXC a.D.)":        { cluster: "sacred",     palette: "electronic" },
      "Tribal worldbeat (Cross of Changes)":  { cluster: "tribal",     palette: "blend" },
      "Sanskrit hybrid (Le Roi Est Mort)":    { cluster: "sanskrit",   palette: "electronic" },
      "Carmina choral (Screen)":              { cluster: "carmina",    palette: "electronic" },
      "Heavy break (Push the Limits)":        { cluster: "heavybreak", palette: "electronic" },
      "Modern synth-pop (Voyageur)":          { cluster: "modern",     palette: "electronic" },
      "Cosmic instrumental (A Posteriori)":   { cluster: "cosmic",     palette: "electronic" },
      "Symphonic chillout (Seven Lives)":     { cluster: "symphonic",  palette: "blend" },
      "Beatless ambient interlude":           { cluster: "ambient",    palette: "electronic" }
    },
    moodBundles: {},
    flavourClusters: {

      // ---- MCMXC a.D. (1990) -------------------------------------------------
      // Gregorian chant samples over a slow Soul II Soul-style shuffle break,
      // breathy shakuhachi/panpipe hook, deep sub, church bells, low horn call.
      sacred: {
        label: "Gregorian sacred (MCMXC a.D.)",
        genre: "Enigma Style, new-age worldbeat downtempo with Gregorian chant",
        band: "78-90", bpm: 84, beatless: false, colorChance: 0.5,
        phase: "78-90 BPM, low energy, slow hypnotic swing", energy: "low energy",
        palettes: {
          electronic: {
            pads: ["Lush dark analogue synth pads with slow evolving harmonic layers","Warm analogue pad wash with deep cathedral space","Rich layered synth pads with a soft harmonic bed"],
            harmony: ["a hypnotic minor-key vamp opening into a lifting chorus","a modal minor cycle moving from verse into a clear chorus","a slow minor progression with a resolving turnaround each cycle"],
            bass: ["Deep sub bass with a short recurring low-end riff under the groove","Warm analogue bass rolling through a slow repeating low motif","Deep rounded synth bass with a sensual recurring pulse"],
            rhythm: ["Slow swung sampled shuffle break with a soft kick, rimshot snare and shaker","Laid-back downtempo beat with a swung programmed kick, brushed snare and light hats","Hypnotic slow break with a soft kick, tight snare and shaker groove"],
            perc: ["light shaker and tambourine ticking under the shuffle","a soft frame-drum pulse beneath the break"],
            strings: ["A sampled Gregorian male chant choir drifting through the harmony","A layered monastic Latin chant choir wash sitting behind the harmony","A distant sampled choir pad with a plainsong texture"],
            texture: ["a low pipe-organ layer sustaining beneath the chant","a soft mellotron string layer drifting under the harmony"],
            motif: ["A breathy shakuhachi hook stating the main melody and returning through the track","A panpipe-style flute hook with a simple repeating melodic phrase","A warm synth lead carrying a vocal-style hook with gentle repetition"],
            counter: ["a soft harp counter-figure weaving beneath the lead","a cello counter-line answering the melodic hook"],
            color: ["an occasional church-bell toll marking the phrase","a brief low horn call opening the section","an occasional panpipe answer in the gaps","a short chant fragment surfacing between phrases"],
            movement: ["Deep cathedral reverb with long delay trails and slow stereo drift","Wide stereo field with tempo-synced delay and slow filter movement","Warm spatial reverb with the pads drifting across the field"]
          },
          acoustic: {
            pads: ["Warm harmonium chords breathing under the groove","Soft bowed-string chord bed with cathedral depth"],
            bass: ["Deep upright bass with a short recurring low-end figure","Warm plucked contrabass rolling through a slow repeating motif"],
            rhythm: ["Slow swung live kit with a soft kick, rimshot snare and shaker","Laid-back organic break with brushed snare and light hand percussion"],
            strings: ["A live Gregorian male chant choir drifting through the harmony","A monastic Latin chant choir wash sitting behind the harmony"],
            motif: ["A breathy shakuhachi hook stating the main melody and returning","A wooden panpipe hook with a simple repeating melodic phrase"],
            color: ["an occasional church-bell toll marking the phrase","a brief low horn call opening the section","a short chant fragment between phrases"],
            movement: ["Vast natural reverb with long tails and slow stereo drift","Warm reverberant space with the ensemble breathing"]
          }
        },
        interplay: {
          conversation: ["the melodic hook stating the theme while the chant layer answers beneath","the hook and the chant layer trading the foreground across the phrases"],
          foundation: ["a deep sub riff and a slow swung break locked in a hypnotic pocket"],
          arc: ["a bare groove opening into a chant-backed chorus then falling away","the hook returning each cycle with layers added around it"]
        },
        // The groove is hip-hop-derived (Soul II Soul shuffle) — lift that ban.
        bannedAdd: ["four-on-the-floor", "house beat", "club tempo", "fast tempo"],
        bannedRemove: ["hip hop beats"]
      },

      // ---- The Cross of Changes (1993) ---------------------------------------
      // Indigenous/Amis chant sample, heavy slow sampled rock break (the
      // "When the Levee Breaks" family), acoustic steel-string guitar hook,
      // duduk / Middle-Eastern colour. No sitar — never an Enigma source.
      tribal: {
        label: "Tribal worldbeat (Cross of Changes)",
        genre: "Enigma Style, tribal worldbeat downtempo with indigenous chant",
        band: "84-96", bpm: 88, beatless: false, colorChance: 0.55,
        phase: "84-96 BPM, low-medium energy, heavy slow swing", energy: "low-medium energy",
        palettes: {
          electronic: {
            pads: ["Warm analogue synth pads with an earthy evolving wash","Deep ambient pad bed with a warm worldbeat colour","Layered analogue pads with a soft open harmonic bed"],
            harmony: ["a modal minor cycle rising into a big singable chorus","a folk-modal chord cycle with an earthy resolving turnaround","a minor progression lifting into an open melodic chorus"],
            bass: ["Deep sub bass with a rolling recurring low-end riff","Warm analogue bass locking the heavy break with a repeating motif","Deep synth bass driving a slow repeating low figure"],
            rhythm: ["Heavy slow sampled rock break with a fat backbeat snare and a half-time feel","Slow heavy breakbeat with a deep kick, big room snare and tribal hand percussion","Dragging sampled break with a thick snare backbeat and shaker groove"],
            perc: ["djembe and frame-drum layers threading the break","light shaker and rattle accents ticking through the groove"],
            strings: ["A sampled indigenous chant vocal layered over a warm string bed","A tribal chant chorus wash sitting behind the harmony","A layered indigenous vocal sample drifting through the strings"],
            texture: ["a low bowed drone layer sustaining beneath the chant","a warm organ layer sitting under the harmony"],
            motif: ["A steel-string acoustic guitar hook carrying the main melody","A duduk-style reed lead stating the melodic hook","A nylon-string guitar hook with warm folk phrasing"],
            counter: ["a low bamboo-flute counter-line answering the guitar hook","a plucked santoor counter-figure weaving against the lead"],
            color: ["an occasional oud lick answering in the gaps","a short tribal chant fragment surfacing between phrases","an occasional Middle-Eastern plucked-string lick","a brief panpipe phrase drifting over the groove"],
            movement: ["Wide stereo field with tempo-synced delay across the percussion","Deep reverb with slow stereo drift and filter movement","Big open reverb with the break breathing in the space"]
          },
          acoustic: {
            pads: ["Warm harmonium chords breathing under the groove","Soft-strummed nylon-string chords with warm open movement"],
            bass: ["Deep upright bass rolling a recurring low-end figure","Warm fretless bass locking the heavy break with a repeating motif"],
            rhythm: ["Heavy slow live break with a fat backbeat snare and a half-time feel","Slow heavy live break with a deep kick, thick snare and tribal hand percussion"],
            strings: ["A live indigenous chant vocal layered over a warm string bed","A tribal chant chorus wash sitting behind the harmony"],
            motif: ["A steel-string acoustic guitar hook carrying the main melody","A duduk reed lead stating the melodic hook"],
            color: ["an occasional oud lick answering in the gaps","a short tribal chant fragment between phrases","an occasional low reed phrase filling a gap"],
            movement: ["Warm reverberant space with the hand percussion breathing","Hand-played dynamics lifting and easing the break"]
          }
        },
        interplay: {
          conversation: ["the melodic hook leading while the chant layer answers beneath","the hook and an occasional colour phrase trading space over the break"],
          foundation: ["a deep sub riff and a heavy half-time break locked in an earthy pocket"],
          arc: ["a stripped verse opening into a full chant-backed chorus","the break dropping out for a bridge then returning with the hook"]
        },
        bannedAdd: ["drum and bass", "big beat", "breakbeat hardcore", "jungle", "fast breaks", "four-on-the-floor", "club tempo"],
        bannedRemove: ["hip hop beats"]
      },

      // ---- Le Roi Est Mort, Vive Le Roi! (1996) -------------------------------
      // The two earlier records fused, with a tighter, more futuristic digital
      // production: Gregorian chant AND Sanskrit/Vedic chant, harder programmed
      // beats, sampled brass stabs (T.N.T. for the Brain).
      sanskrit: {
        label: "Sanskrit hybrid (Le Roi Est Mort)",
        genre: "Enigma Style, new-age downtempo with Gregorian and Sanskrit chant",
        band: "88-98", bpm: 94, beatless: false, colorChance: 0.5,
        phase: "88-98 BPM, medium energy, tight hypnotic swing", energy: "medium energy",
        palettes: {
          electronic: {
            pads: ["Glassy digital synth pads with a futuristic harmonic sheen","Hybrid analogue-digital pad bed with cold evolving layers","Bright layered synth pads with a clean harmonic wash"],
            harmony: ["a minor progression with a defined verse-chorus shape","a suspended minor cycle resolving into the hook","a modal minor progression with a firm turnaround into the chorus"],
            bass: ["Tight sub bass with a punchy recurring low-end riff","Deep synth bass with a firm repeating low figure","Hard rounded synth bass driving a short low motif"],
            rhythm: ["Tight programmed downtempo beat with a crisp snare, swung hats and shaker","Mid-tempo electronic groove with a firm kick, snappy snare and light percussion","Hard swung programmed break with a punchy kick and tight snare"],
            perc: ["tabla and shaker accents ticking under the beat","light frame-drum accents threading the groove"],
            strings: ["A sampled Gregorian chant layered with a Sanskrit mantra texture","A monastic chant sample blended with a Vedic chant layer","A choir wash carrying both a Latin chant and a Sanskrit mantra texture"],
            texture: ["a low pipe-organ layer sustaining beneath the chant","a glassy string-synth layer drifting under the harmony"],
            motif: ["A breathy shakuhachi hook stating the melody and returning","A bright digital flute-synth lead carrying the hook","A clean synth lead delivering a defined melodic hook"],
            counter: ["a cello counter-line answering the melodic hook","a plucked santoor counter-figure weaving against the lead"],
            color: ["an occasional sampled brass stab punching the phrase","a short Sanskrit mantra fragment surfacing between phrases","an occasional bell and chime accent","a brief breathy reed answer in the gaps"],
            movement: ["Wide stereo field with tempo-synced delay and evolving modulation","Deep reverb with long delay tails and rhythmic filter movement","Sharp spatial delay driving movement across the beat"]
          },
          acoustic: {
            pads: ["Warm harmonium chords with a firm sustained bed","Soft bowed-string chord bed with clean depth"],
            bass: ["Tight upright bass with a punchy recurring low figure","Deep plucked contrabass driving a short repeating motif"],
            rhythm: ["Tight live downtempo kit with a crisp snare, swung hats and shaker","Mid-tempo organic groove with a firm kick and snappy snare"],
            strings: ["A live Gregorian chant layered with a Sanskrit mantra texture","A chant choir blended with a Vedic mantra layer"],
            motif: ["A breathy shakuhachi hook stating the melody and returning","A wooden flute lead carrying the melodic hook"],
            color: ["a short Sanskrit mantra fragment between phrases","an occasional bell accent marking the phrase","a brief reed answer in the gaps"],
            movement: ["Big natural reverb with long tails and rhythmic space","Warm reverberant space with the percussion driving"]
          }
        },
        interplay: {
          conversation: ["the melodic hook leading while the two chant layers answer beneath","the hook and a short stab punctuating each other across the beat"],
          foundation: ["a tight sub riff and a firm swung beat locked hard beneath the layers"],
          arc: ["a tight verse driving into a chant-backed chorus","layers stacking through the verse then stripping back to the hook"]
        },
        bannedAdd: ["trance", "drum and bass", "four-on-the-floor", "club tempo"],
        bannedRemove: ["hip hop beats", "orchestral hits"]
      },

      // ---- The Screen Behind the Mirror (2000) --------------------------------
      // Carmina Burana (O Fortuna) massed Latin chorus samples + DISTORTED
      // ELECTRIC GUITAR + the low horn call, over the heavy sampled break.
      // Not "cinematic" — that framing was pulling Suno toward trailer music.
      carmina: {
        label: "Carmina choral (Screen Behind the Mirror)",
        genre: "Enigma Style, new-age downtempo with massed Latin chorus and distorted guitar",
        band: "88-100", bpm: 94, beatless: false, colorChance: 0.5,
        phase: "88-100 BPM, medium energy, heavy hypnotic swing", energy: "medium energy",
        palettes: {
          electronic: {
            pads: ["Dark analogue pad mass with deep orchestral weight","Shadowed synth pads layered with orchestral string texture","Deep pad bed with a heavy evolving harmonic mass"],
            harmony: ["a dramatic minor progression with a strong chorus lift","a dark minor cycle rising to a clear melodic peak","a minor progression with a resolving turnaround into the hook"],
            bass: ["Deep sub bass with a heavy driving recurring riff","Dark analogue bass with a controlled repeating low figure","Heavy synth bass pushing a short low-end motif"],
            rhythm: ["Heavy sampled rock break with a fat backbeat snare and a half-time feel","Driving downtempo beat with a firm kick, hard snare and layered percussion","Slow heavy break with a cracking snare and tight hats"],
            perc: ["deep taiko-style toms and shaker under the break","heavy tambourine and rim accents driving the groove"],
            strings: ["A massed Latin chorus sample in a Carmina-style choral texture","A sampled classical choir singing Latin over orchestral strings","A heavy massed choir sample carrying the choral weight"],
            texture: ["a low pipe-organ layer sustaining beneath the chorus","a dark mellotron string layer drifting under the mass"],
            motif: ["A soaring synth lead carrying the main melodic hook","A distorted electric guitar riff carrying the hook","A big melodic lead line stating the chorus hook"],
            counter: ["a cello counter-line answering the lead hook","a low brass counter-line pushing against the riff"],
            color: ["a low horn call marking the section","a short Latin chorus fragment surfacing between phrases","an occasional bell toll punctuating the phrase","an occasional orchestral swell lifting the phrase"],
            movement: ["Deep cathedral reverb with long delay trails and wide stereo movement","Big spatial reverb with heavy filter movement across the break","Wide stereo field with tempo-synced delay and dramatic swells"]
          },
          acoustic: {
            pads: ["Dark harmonium and bowed-string chord mass with orchestral weight","Deep bowed-string chord bed swelling under the harmony"],
            bass: ["Deep bowed upright bass driving a heavy recurring low figure","Dark contrabass with a controlled repeating low motif"],
            rhythm: ["Heavy live rock break with a fat backbeat snare and a half-time feel","Driving live kit with a firm kick, hard snare and layered hand percussion"],
            strings: ["A live massed Latin chorus in a Carmina-style choral texture","A classical choir singing Latin over bowed orchestral strings"],
            motif: ["A distorted electric guitar riff carrying the hook","A soaring string lead carrying the main melodic hook"],
            color: ["a low horn call marking the section","a short Latin chorus fragment between phrases","an occasional bell toll punctuating the phrase"],
            movement: ["Vast reverberant space with heavy dynamic swells","Big natural reverb with the ensemble rising to a peak"]
          }
        },
        interplay: {
          conversation: ["the lead hook soaring while the massed chorus swells beneath","the hook and a colour accent answering each other across the break"],
          foundation: ["a heavy sub riff and a half-time break anchoring the weight"],
          arc: ["a dark verse building into a chorus-backed peak then falling back","tension stacking through the verse and released on the hook"]
        },
        // Screen leans on distorted guitar, orchestral choral samples and the
        // heavy hip-hop-derived break — lift those three bans here only.
        bannedAdd: ["metal guitars", "symphonic metal", "trailer braams", "cinematic trailer music", "four-on-the-floor"],
        bannedRemove: ["rock guitars", "hip hop beats", "orchestral hits"]
      },

      // ---- Push the Limits / Modern Crusaders ---------------------------------
      // The break-driven Enigma character, at ALBUM tempo. Previously 118-126
      // BPM "driving hip-hop breakbeat", which is club-remix territory (the
      // 128/133/140 BPM versions are all remixes) and was rendering as big beat.
      heavybreak: {
        label: "Heavy break (Push the Limits)",
        genre: "Enigma Style, downtempo worldbeat with a heavy sampled break",
        band: "92-100", bpm: 96, beatless: false, colorChance: 0.45,
        phase: "92-100 BPM, medium energy, heavy half-time drive", energy: "medium energy",
        palettes: {
          electronic: {
            pads: ["Dark analogue synth pads with a heavy evolving bed","Deep pad mass with a shadowed harmonic wash","Warm dark pads layered under the break"],
            harmony: ["a driving minor riff-cycle repeating with a hard chorus lift","a dark minor progression built around a repeating low riff","a modal minor cycle pushing into a heavy chorus"],
            bass: ["Heavy sub bass riff driving a hard recurring low motif","Dark analogue bass pushing a repeating low-end figure","Deep distorted-edge synth bass locking the break"],
            rhythm: ["Heavy chopped sampled break with a fat snare backbeat and half-time swing","Hard slow breakbeat with a deep kick, cracking snare and tight hats","Thick sampled break with a dragging backbeat and shaker groove"],
            perc: ["heavy toms and tambourine driving under the break","hard shaker and rim accents pushing the groove"],
            strings: ["A massed Latin chorus sample carrying weight behind the riff","A sampled chant choir wash sitting under the break","A choir texture layered with orchestral strings under the groove"],
            texture: ["a dark pipe-organ layer sustaining under the riff","a low mellotron string layer thickening the break"],
            motif: ["A heavy distorted electric guitar riff carrying the hook","A big synth lead riff stating the main hook","A low horn-call hook driving the section"],
            counter: ["a cello counter-line answering the riff","a low brass counter-figure pushing against the hook"],
            color: ["a low horn call marking the section","a short chant fragment surfacing between phrases","an occasional shakuhachi phrase cutting across the groove","an occasional bell toll punctuating the phrase"],
            movement: ["Wide stereo field with tempo-synced delay across the break","Heavy filter movement opening over the groove","Deep reverb with hard rhythmic delay driving the break"]
          },
          acoustic: {
            pads: ["Dark harmonium chord mass with heavy weight","Deep bowed-string chord bed under the break"],
            bass: ["Heavy upright bass riff driving a recurring low motif","Dark contrabass pushing a repeating low-end figure"],
            rhythm: ["Heavy chopped live break with a fat snare backbeat and half-time swing","Hard slow live break with a deep kick, cracking snare and hand percussion"],
            strings: ["A live massed chorus carrying weight behind the riff","A chant choir wash sitting under the break"],
            motif: ["A heavy distorted electric guitar riff carrying the hook","A low brass-call hook driving the section"],
            color: ["a low horn call marking the section","a short chant fragment between phrases","an occasional shakuhachi phrase cutting across the groove"],
            movement: ["Big natural reverb with the break breathing hard in the space","Heavy dynamic swells lifting the groove"]
          }
        },
        interplay: {
          conversation: ["the riff hook driving while the chorus layer swells behind it","the riff and the chant layer answering across the break"],
          foundation: ["a heavy sub riff and a chopped half-time break locked in a hard pocket"],
          arc: ["the break dropping out for a stripped bridge then slamming back with the riff","the riff returning each cycle with layers stacked around it"]
        },
        bannedAdd: ["big beat", "drum and bass", "breakbeat hardcore", "jungle", "club house", "uptempo breaks", "four-on-the-floor", "club tempo"],
        bannedRemove: ["hip hop beats", "rock guitars"]
      },

      // ---- Voyageur (2003) ----------------------------------------------------
      // The departure record: pop-oriented songs, synth-driven, electric guitar,
      // and NO chant at all. Still minor/modal — the old "bright major-key"
      // harmony pool was what pushed this cluster into generic pop.
      modern: {
        label: "Modern synth-pop (Voyageur)",
        genre: "Enigma Style, electronic downtempo synth-pop",
        band: "96-110", bpm: 104, beatless: false, colorChance: 0.4,
        phase: "96-110 BPM, medium energy, steady synth-driven groove", energy: "medium energy",
        palettes: {
          electronic: {
            pads: ["Clean modern synth pads with a smooth evolving wash","Polished synth pad bed with clean tonal depth","Lush contemporary synth layers with smooth harmonic movement"],
            harmony: ["a minor-key electronic progression with a clear chorus lift","a modal minor cycle with a strong resolving hook","a minor progression giving a defined verse-chorus shape"],
            bass: ["Warm analogue bass with a steady driving recurring pulse","Rounded synth bass locking a tight repeating low figure","Deep sub bass with a smooth modern low-end groove"],
            rhythm: ["Clean programmed electronic beat with a steady kick, tight hats and light percussion","Modern downtempo kit with a soft kick, crisp snare and subtle percussion","Controlled electronic groove with programmed drums and light shaker"],
            perc: ["light shaker and tambourine ticking under the beat","soft conga accents threading the groove"],
            strings: ["Soft synth strings supporting the harmony","Smooth string texture sitting under the chords","Light synth string bed adding depth beneath the pads"],
            texture: ["a warm string-machine layer sustaining under the chords","a soft mellotron layer drifting beneath the harmony"],
            motif: ["A bright synth lead carrying a strong modern hook","A clean arpeggiated synth line stating the main hook","A melodic electric guitar line carrying the hook"],
            counter: ["a plucked synth counter-line answering the hook","a warm clavinet counter-figure weaving beneath the lead"],
            color: ["a brief bell accent marking the phrase","an occasional filtered synth stab lifting the bar","an occasional plucked-string accent answering the hook"],
            movement: ["Wide stereo field with tempo-synced delay and evolving modulation","Filter and modulation movement using LFO, chorus and phaser","Rhythmic autopan and tempo-synced delay creating modern space"]
          },
          acoustic: {
            pads: ["Warm electric-piano chords with smooth voicings","Soft nylon-string chord comping with clean movement"],
            bass: ["Warm fingerstyle electric bass with a steady recurring groove","Rounded upright bass with a tight repeating low figure"],
            rhythm: ["Soft live kit with a steady downtempo groove and light percussion","Organic groove with a crisp snare, tight hats and warm percussion"],
            strings: ["Soft live strings supporting the harmony","Warm string texture sitting under the chords"],
            motif: ["A melodic electric guitar line carrying the hook","A warm Rhodes lead stating the main hook"],
            color: ["a brief bell accent marking the phrase","an occasional plucked-string accent answering the hook"],
            movement: ["Warm reverb with the players easing through the groove","Soft tape-delay drifting phrases through the mix"]
          }
        },
        interplay: {
          conversation: ["the lead hook leading while a second voice answers in the gaps","the lead hook and the chord bed rising together into the chorus"],
          foundation: ["a steady bass pulse and a clean programmed beat driving the song"],
          arc: ["a clean verse opening into a full chorus then stripping back","the hook returning across the chorus with layers added"]
        },
        // Era-accurate: Voyageur has no chant and no Gregorian sampling at all.
        bannedAdd: ["Gregorian chant", "monastic chant", "plainsong", "Latin chorus", "sampled choir"],
        bannedRemove: []
      },

      // ---- A Posteriori (2006) ------------------------------------------------
      // Cosmic, largely instrumental, trance-leaning arpeggios, grand piano
      // themes, orchestral swells. No chant, no vocal hook.
      cosmic: {
        label: "Cosmic instrumental (A Posteriori)",
        genre: "Enigma Style, cosmic instrumental electronica with ambient and trance textures",
        band: "104-118", bpm: 112, beatless: false, colorChance: 0.45,
        phase: "104-118 BPM, medium energy, steady instrumental drive", energy: "medium energy",
        palettes: {
          electronic: {
            pads: ["Vast cold synth pads with deep cosmic space","Wide digital pad wash with slow evolving layers","Deep space-synth pad bed with glassy harmonic depth"],
            harmony: ["a slow minor progression developing across long instrumental sections","a suspended minor cycle evolving without a vocal chorus","a modal minor progression unfolding through the piece"],
            bass: ["Deep pulsing synth bass with a steady rolling low motif","Tight sub bass driving a repeating low-end figure","Rounded analogue bass with a smooth recurring pulse"],
            rhythm: ["Steady electronic beat with a tight kick, crisp hats and programmed percussion","Driving programmed groove with a clean kick, snappy snare and light percussion","Controlled electronic beat with a firm kick and rolling hats"],
            perc: ["light shaker and rim accents ticking under the beat","soft hand-percussion layers threading the groove"],
            strings: ["Orchestral string layer swelling beneath the synths","Soft wordless choir pad drifting under the harmony","Warm string section rising under the electronic layers"],
            texture: ["a warm string-machine layer sustaining beneath the arpeggio","a soft mellotron layer drifting under the theme"],
            motif: ["A cycling arpeggio carrying the main theme","A grand piano theme stating the melody","A melodic synth lead developing the theme across the piece"],
            counter: ["a viola counter-line answering the theme","a plucked synth counter-figure weaving against the arpeggio"],
            color: ["an occasional harp figure surfacing between phrases","a brief bell and chime accent with soft decay","an occasional filtered arpeggio burst lifting the bar"],
            movement: ["Wide stereo field with tempo-synced delay and slow evolving modulation","Deep reverb with long tails and cosmic filter sweeps","Big spatial movement with the layers rising and receding"]
          },
          acoustic: {
            pads: ["Soft bowed-string chord bed drifting under the theme","Warm harmonium bed sustaining beneath the harmony"],
            bass: ["Deep upright bass with a steady rolling low motif","Low cello line driving a repeating low figure"],
            rhythm: ["Steady live kit with a tight kick, crisp hats and light percussion","Driving organic groove with a clean snare and rolling hats"],
            strings: ["Live orchestral strings swelling beneath the theme","Soft wordless choir wash drifting under the harmony"],
            motif: ["A grand piano theme stating the melody","A bowed string-section theme carrying the melodic line"],
            color: ["an occasional harp figure surfacing between phrases","a brief bell accent with soft decay"],
            movement: ["Big natural reverb with long tails and slow swells","Wide orchestral space with the layers rising and receding"]
          }
        },
        interplay: {
          conversation: ["the cycling figure driving while the theme answers over it","the theme passing between the lead and the counter voice"],
          foundation: ["a rolling bass motif and a steady beat carrying the instrumental drive"],
          arc: ["a theme stated then developed through layered instrumental sections","the piece building through stacked layers then opening out"]
        },
        bannedAdd: ["Gregorian chant", "monastic chant", "vocal hooks", "hard trance", "EDM drops", "supersaw leads"],
        bannedRemove: []
      },

      // ---- Seven Lives Many Faces (2008) / Fall of a Rebel Angel (2016) --------
      // Orchestral arrangement fused with modern electronic rhythm; Spanish
      // nylon-guitar and ethnic vocal colour; symphonic chillout.
      symphonic: {
        label: "Symphonic chillout (Seven Lives / Rebel Angel)",
        genre: "Enigma Style, symphonic chillout downtempo with orchestral arrangement and modern electronic rhythm",
        band: "92-104", bpm: 98, beatless: false, colorChance: 0.5,
        phase: "92-104 BPM, medium energy, orchestral downtempo drive", energy: "medium energy",
        palettes: {
          electronic: {
            pads: ["Lush orchestral-synth hybrid pad bed with warm depth","Wide synth pads layered with orchestral texture","Rich pad wash blended with a soft string section"],
            harmony: ["a minor progression opening into a full orchestral chorus lift","a modal minor cycle resolving into a broad melodic chorus","a warm minor progression with a strong turnaround into the hook"],
            bass: ["Deep sub bass with a modern recurring low-end groove","Warm synth bass driving a repeating low figure","Rounded electronic bass locking a steady low motif"],
            rhythm: ["Modern downtempo electronic beat with a punchy kick, crisp snare and layered percussion","Mid-tempo programmed groove with a firm kick, tight hats and hand percussion","Clean electronic beat with a driving kick and warm percussion"],
            perc: ["light congas and shaker threading the groove","soft tambourine and rim accents lifting the beat"],
            strings: ["Full orchestral string section woven with a wordless choir","Layered orchestral strings with a distant ethnic vocal texture","Warm string section swelling behind the harmony"],
            texture: ["a warm harmonium layer sustaining beneath the strings","a soft organ layer drifting under the orchestra"],
            motif: ["A Spanish nylon-guitar hook carrying the main melody","A soaring synth lead stating the melodic hook","An orchestral string theme carrying the chorus melody"],
            counter: ["a soft oboe counter-figure weaving beneath the lead","a low brass counter-line answering the hook"],
            color: ["an occasional Spanish guitar flourish answering the hook","a brief ethnic vocal fragment surfacing between phrases","an occasional piano figure lifting the phrase","a short low horn call marking the section"],
            movement: ["Wide cinematic stereo field with tempo-synced delay and orchestral swells","Deep reverb with the orchestra rising beneath the beat","Big spatial movement with the strings breathing across the groove"]
          },
          acoustic: {
            pads: ["Warm orchestral string chord bed with soft depth","Live bowed-string and woodwind chord layers under the harmony"],
            bass: ["Deep upright bass with a recurring low-end groove","Warm fingerstyle electric bass locking a steady low motif"],
            rhythm: ["Live downtempo kit with a punchy kick, crisp snare and layered hand percussion","Mid-tempo organic groove with a firm kick, tight hats and warm percussion"],
            strings: ["Full live orchestral strings woven with a wordless choir","Live string section with a distant ethnic vocal texture"],
            motif: ["A Spanish nylon-guitar hook carrying the main melody","A live string theme carrying the chorus melody"],
            color: ["an occasional Spanish guitar flourish answering the hook","a brief ethnic vocal fragment between phrases","an occasional piano figure lifting the phrase"],
            movement: ["Vast orchestral reverb with the ensemble swelling beneath the beat","Big natural space with the strings breathing across the groove"]
          }
        },
        interplay: {
          conversation: ["the melodic hook leading while the orchestra swells beneath","the lead theme and the string section answering each other into the chorus"],
          foundation: ["a modern electronic beat and a deep bass motif carrying the orchestra"],
          arc: ["a restrained verse opening into a full orchestral chorus","the arrangement stacking strings and choir toward the melodic peak"]
        },
        bannedAdd: ["EDM drops", "trailer braams", "four-on-the-floor"],
        bannedRemove: ["orchestral hits"]
      },

      // ---- Beatless interludes (Rivers of Belief / Shadows in Silence) ---------
      ambient: {
        label: "Beatless ambient interlude",
        genre: "Enigma Style, beatless new-age ambient with chant",
        band: "beatless", bpm: null, beatless: true, colorChance: 0.5,
        phase: "beatless, no drums, free-floating, melody-led", energy: "low energy",
        palettes: {
          electronic: {
            pads: ["Lush evolving synth pads with a warm harmonic bed","Deep ambient synth layers with slow evolving harmony","Warm analogue pad wash with soft cathedral depth"],
            harmony: ["a slow minor progression resolving gently each cycle","a suspended chord cycle moving gently through the piece","a modal chord cycle giving the piece a clear melodic shape"],
            bass: ["Soft sub drone giving weightless low-end support","Deep tonal drone anchoring the harmony softly"],
            rhythm: [],
            strings: ["A sampled chant choir wash drifting through the harmony","A layered choir pad carrying a sacred chant texture","A warm string wash blended with a distant chant layer"],
            texture: ["a soft mellotron string layer drifting beneath the drone","a low pipe-organ layer sustaining under the chant"],
            motif: ["A breathy shakuhachi line carrying a slow melodic theme","A warm synth lead stating the theme softly","A gentle lead motif delivering a defined melodic hook"],
            counter: ["a viola counter-line rising slowly beneath the theme","a soft harp counter-figure drifting through the space"],
            color: ["an occasional bell and chime accent with soft decay","a short chant fragment surfacing between phrases","an occasional panpipe phrase filling a gap","a brief low horn call drifting through the space"],
            movement: ["Deep cathedral reverb with long delay trails and glacial stereo movement","Wide stereo field with slow spatial layering and evolving modulation","Reversed swells and long reverb tails drifting across the field"]
          },
          acoustic: {
            pads: ["Warm harmonium drone breathing slowly","Soft bowed-string chord bed drifting through the harmony"],
            bass: ["Low cello drone anchoring the harmony","Deep bowed drone giving a soft weightless foundation"],
            rhythm: [],
            strings: ["A live chant choir wash with a sacred texture","A bowed-string wash blended with a distant chant layer"],
            motif: ["A breathy shakuhachi line carrying a slow melodic theme","A warm piano lead stating the main theme softly"],
            color: ["a brief hand-bell accent with soft decay","a short chant fragment between phrases","an occasional wooden flute phrase drifting through"],
            movement: ["Vast natural reverb with tones drifting and dissolving","Slow dynamic swells rising and receding"]
          }
        },
        interplay: {
          conversation: ["the melodic lead drifting while the chant wash breathes beneath","the theme and an occasional colour phrase dissolving into the space"],
          foundation: ["a deep drone holding beneath the harmony sustaining without pulse"],
          arc: ["a slow theme stated then developed with layered harmony","the piece building gently through evolving chords then dissolving"]
        },
        bannedAdd: [], bannedRemove: []
      }
    },

    synonymBank: {}, refTracks: []
  },

  Delerium:             { moodBundles: {}, flavourClusters: {}, synonymBank: {}, refTracks: [] },
  Era:                  { moodBundles: {}, flavourClusters: {}, synonymBank: {}, refTracks: [] },
  "Composer-Orchestral":{ moodBundles: {}, flavourClusters: {}, synonymBank: {}, refTracks: [] },
  "Composer-Electronic":{ moodBundles: {}, flavourClusters: {}, synonymBank: {}, refTracks: [] },
  Producer:             { moodBundles: {}, flavourClusters: {}, synonymBank: {}, refTracks: [] },
  Remixer:              { moodBundles: {}, flavourClusters: {}, synonymBank: {}, refTracks: [] }
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
  return layerKeepOut([], mood.bannedAdd, mood.bannedRemove);
}

/*
 * resolveClusterKeepOut(engineName, clusterId)
 * Effective keep-out list for an engine + flavour cluster. Safe on stubs ([]).
 */
function resolveClusterKeepOut(engineName, clusterId) {
  const engine = EngineExtras[engineName];
  if (!engine) return [];
  const cluster = (engine.flavourClusters && engine.flavourClusters[clusterId]) || {};
  return layerKeepOut([], cluster.bannedAdd, cluster.bannedRemove);
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


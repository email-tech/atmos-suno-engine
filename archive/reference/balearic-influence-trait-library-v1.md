# Balearic Influence-Flavour Trait Library — v1 (draft)

**Project:** Suno Prompt Tool (ATMOS) · **Category sub-layer:** Influence flavour, inside the Balearic instrumentation axis
**Status:** Draft for Suno testing once the richer-instrument layer is in place. NOT yet ported into `engine-extras.js`.

---

## What this is (and what it is NOT)

This is a **diversity engine**, not a fidelity engine.

- The purpose is **range and variety within the genre** — a set of clearly distinct "sound fingerprints" the tool can pull from so two generations don't sound like near-duplicates.
- **It is NOT about sounding identifiably like a named artist.** Output never has to be recognisable as the source act, and you never need to validate it by ear against the real artist.
- **Artist names are internal scaffolding only.** They are a convenient real-world source for mining ingredient combinations that are distinct from each other yet still genre-valid. **Names are never written into the Suno payload** (Suno strips artist names anyway — T&Cs / copyright). Only the translated musical traits go to Suno.
- The **only meaningful test** of this library is: do the clusters sound clearly *different from one another* while all still reading as Balearic? And that only shows up once there is enough instrumentation around them to carry the contrast — so this layer is **evaluated together with the richer-instrument layer, not on a bare skeleton prompt.**

**Content rule (persistent):** musical content only — instruments, playing techniques, production terms. No field recordings, foley, nature sounds, or lo-fi artifacts.

---

## The spread (how variety is guaranteed)

Eight clusters chosen to cover the stylistic space along four axes. Each cluster sits at a different point so the set spans the range rather than clustering in one corner.

| # | Internal label (source) | organic ↔ electronic | sparse ↔ lush | warm ↔ cool | beat-driven ↔ ambient |
|---|---|---|---|---|---|
| 1 | Organic live-band downtempo | organic | mid–lush | warm | beat-driven |
| 2 | Lush cinematic chillout | organic–electronic | lush | warm | mid |
| 3 | Dreamy analog electronic | electronic | lush | cool–warm | mid |
| 4 | Dub-global downtempo | organic–electronic | mid–lush | warm | beat-driven |
| 5 | Deep nocturnal Balearic | electronic | sparse | cool | mid |
| 6 | Sunlit Mediterranean | organic | mid | warm–bright | light-beat |
| 7 | Ambient / beatless atmospheric | electronic | sparse | cool | ambient |
| 8 | Moody trip-hop downbeat | organic–electronic | mid–lush | cool | beat-driven |

---

## The clusters

Each is a self-contained trait fingerprint: BPM band · rhythmic feel · harmonic character · signature instruments · production texture · a sample payload seed (concrete terms only, ready to test).

### 1. Organic live-band downtempo *(source: Bonobo)*
- **BPM:** 80–100
- **Rhythm:** loose, live-feel percussion; hand drums; broken-beat swing
- **Harmony:** jazz-tinged modal chords, minor-key warmth
- **Instruments:** Rhodes, warm sub-bass or upright bass, layered strings, mallets, woodwind/flute lines
- **Production:** spacious reverb, dub-style delay movement, warm analog-style tone
- **Payload seed:** `organic downtempo, 92 BPM, loose live-feel hand percussion, broken-beat swing, jazz-tinged Rhodes chords, warm upright bass, layered strings and flute, spacious reverb with dub delay`

### 2. Lush cinematic chillout *(source: Zero 7 / early Café del Mar)*
- **BPM:** 90–105
- **Rhythm:** soft hybrid drums (brushed + programmed), gentle shuffle
- **Harmony:** rich major-7/9 chords, smooth and consonant
- **Instruments:** electric piano, analog pad beds, round or fretless electric bass, lush string arrangements, soft horn swells, wordless vocal pads
- **Production:** glossy reverb, smooth compression, polished sheen
- **Payload seed:** `lush cinematic chillout, 96 BPM, soft brushed hybrid drums, major-9 electric piano chords, fretless bass, sweeping string arrangement, wordless vocal pads, glossy reverb`

### 3. Dreamy analog electronic *(source: Air)*
- **BPM:** 85–100
- **Rhythm:** simple steady programmed beat, understated
- **Harmony:** melancholic modal harmony, suspended colour
- **Instruments:** vintage analog synths (Moog-style leads, Solina-style strings), vocoder textures, deep synth bass, Wurlitzer/Rhodes accents
- **Production:** airy reverb, phaser and chorus movement, retro-futurist gloss
- **Payload seed:** `dreamy analog electronic downtempo, 90 BPM, steady soft programmed beat, melancholic modal synth pads, vocoder texture, deep synth bass, Wurlitzer accents, phaser-chorus movement`

### 4. Dub-global downtempo *(source: Thievery Corporation)*
- **BPM:** 90–110
- **Rhythm:** dub bass-heavy groove; sidestick/rimshot reggae-tinged drums; tabla and hand percussion; global rhythmic accents
- **Harmony:** minor-key dub chords, sparse and hypnotic
- **Instruments:** deep dub bass, sitar or bouzouki melodic lines, muted trumpet
- **Production:** heavy spring reverb, long dub delay throws
- **Payload seed:** `dub-influenced global downtempo, 100 BPM, bass-heavy dub groove, rimshot drums and tabla, minor-key dub chords, sitar line, muted trumpet, spring reverb and dub delay throws`

### 5. Deep nocturnal Balearic *(source: late-night deep chill)*
- **BPM:** 95–110
- **Rhythm:** sparse deep-house-adjacent kick with soft hats; lots of space; hypnotic
- **Harmony:** minor-9 pads, sustained and unresolved
- **Instruments:** sustained sub-bass, sparse Rhodes stabs, occasional plucked guitar harmonic
- **Production:** deep reverb, long delay tails, restrained and dark
- **Payload seed:** `deep nocturnal Balearic, 104 BPM, sparse soft four-on-the-floor kick, wide space, minor-9 sustained pads, deep sub-bass, occasional Rhodes stab, long delay tails`

### 6. Sunlit Mediterranean *(source: classic daytime Balearic)*
- **BPM:** 100–115
- **Rhythm:** light congas/bongos, shaker, gentle forward motion
- **Harmony:** bright major harmony, open and warm
- **Instruments:** nylon-string Spanish guitar lead, acoustic piano flourishes, soft fretless bass, pan flute or soft sax
- **Production:** clean warm production, sun-toned brightness
- **Payload seed:** `sunlit Mediterranean Balearic, 108 BPM, light congas and shaker, bright major harmony, nylon-string Spanish guitar lead, acoustic piano, soft fretless bass, pan flute, clean warm tone`

### 7. Ambient / beatless atmospheric *(source: ambient chillout)*
- **BPM:** beatless, or 60–80 implied feel — use for intros, breakdowns, and contrast
- **Rhythm:** none or barely-there pulse
- **Harmony:** suspended/modal, no strong root movement
- **Instruments:** evolving synth pads, drones, slow-attack textures, sub swells, sparse piano or bell tones, granular pads
- **Production:** vast reverb, slow morphing, deep stereo width
- **Payload seed:** `ambient beatless atmospheric chillout, evolving synth pads and drones, suspended modal harmony, slow-attack textures, sparse piano tones, sub swells, vast reverb, slow morphing`

### 8. Moody trip-hop downbeat *(source: trip-hop / downbeat)*
- **BPM:** 80–95
- **Rhythm:** heavy lazy hip-hop-influenced drums, deep swung kick and snare, slow head-nod
- **Harmony:** minor-key cinematic chords, detuned colour
- **Instruments:** thick sub-bass, detuned Rhodes, string stabs, muted electric guitar, brass stabs
- **Production:** dark reverb, analog-style saturation and filtering, moody depth
- **Payload seed:** `moody trip-hop downbeat, 86 BPM, heavy swung kick and snare, minor-key cinematic chords, detuned Rhodes, thick sub-bass, muted guitar and brass stabs, dark reverb with analog saturation`

---

## How this slots into the engine

- Each cluster becomes a **selectable flavour preset inside the Balearic instrumentation axis** — not a separate naming layer. One extra dimension on the existing slot system.
- A chosen cluster contributes its instruments/feel into the slots; the **slots stay single source of truth** (no instrument words duplicated in phase prose), so guard rails still hold.
- **Keep-out review pending:** each cluster will need its keep-out implications checked when ported into `engine-extras.js` (e.g. cluster 7 should suppress strong percussion; cluster 6 should keep out heavy dub bass). Not authored here — done at port time.
- **Expansion expected:** this is v1 and a starting point, not a fixed library. More clusters can be added for wider spread; the same fingerprint template applies.

---

## Open / next

1. Build (or extend the tester for) the **richer-instrument layer**, since this flavour layer is only testable alongside it.
2. Once both exist: run the real test — generate one prompt per cluster and confirm they sound **clearly distinct from one another** while all reading as Balearic.
3. Port validated clusters into `engine-extras.js`, authoring per-cluster keep-outs at that point.
4. Repeat the template for the other ATMOS categories when their turn comes.

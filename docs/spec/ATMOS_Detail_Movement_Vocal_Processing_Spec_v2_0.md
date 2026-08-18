# ATMOS Detail, Movement and Vocal Processing System
## Master Implementation Specification and Claude/Codex Handoff

**Version:** 2.0  
**Date:** 18 August 2026  
**Status:** Design-complete handoff specification; implementation and Suno validation pending  
**Scope:** Balearic, Enigma, Delerium, ERA, Sacred Spirit, Deep Forest  
**Supersedes:** `ATMOS_Ear_Candy_Resolver_Spec_v1.0` for all implementation decisions in this feature area  
**Replaces in the application:** Composer, Producer and Remixer modifier concepts

---

## 1. Authority, purpose and change record

This document is the authoritative design specification for the new ATMOS **Detail & Movement** layer. It is intentionally standalone: Claude or Codex should be able to implement the feature from this document plus the existing engine/source files without needing the earlier Ear Candy discussion.

The system adds three small user-facing controls while keeping the underlying musical logic engine-aware and deterministic:

| Control | User purpose | Internal responsibility |
|---|---|---|
| **Ear Candy** | Add small incidental musical/production details | Short non-structural behaviours on existing eligible cast members |
| **Space & Movement** | Add depth, width, modulation and time-based motion | Layer-level spatial/timbral processing on compatible existing sources |
| **Vocal Treatment** | Add deliberate vocal transformation/edit behaviour | Timbral or temporal transformation of an existing eligible vocal source |

### 1.1 Exact changes from v1.0

The v1.0 Ear Candy Resolver remains the basis of the Ear Candy subsystem. Version 2.0 changes the surrounding architecture as follows.

| v1.0 position / rule | v2.0 revision | Exact reason for change |
|---|---|---|
| Ear Candy was the only new user-facing modifier | Add **Space & Movement** and **Vocal Treatment** as separate sibling resolvers | Continuous layer processing and vocal transformation are not the same job as incidental Ear Candy |
| Ear Candy ran directly after the finished cast | Insert Vocal Treatment and Space & Movement before Ear Candy | Later resolvers must see processing already assigned so they can avoid duplication and choose complementary detail |
| Electronic sources were handled mostly by broad instrument family | Add explicit **electronic source / patch / drum-voice metadata** | A sustained pad, pluck, arp and drum-machine hat require different processing rules even when all are electronic |
| Vocal details existed mainly as an Ear Candy capability | Make deliberate vocoder/talkbox/chop/stutter/glitch behaviour authoritative in **Vocal Treatment** | These can change vocal identity or temporal structure and therefore need protection, compatibility and section-staging rules |
| Style Prompt completion ended the feature | Add an explicit downstream **Style → Lyrics → Metatag** consumer contract | Existing project architecture already establishes that Style Prompt comes first and lyric/metatag generation follows |

### 1.2 Non-negotiable implementation principle

> **The new system modifies behaviour around the cast; it does not rebuild the engine.**

The underlying engine/character/palette/cast remains the source of truth. The new resolvers may annotate, process or briefly repurpose eligible existing voices, but must not silently replace signature instruments, rewrite legacy prompt content, or use a modifier to bypass an engine exclusion.

### 1.3 Regression default

For the first integrated release, all three controls MUST default to **Off**:

```text
Ear Candy: Off
Space & Movement: Off
Vocal Treatment: Off
```

This is required so the existing application can be regression-tested against the pre-modification baseline. Product defaults may be changed later only after controlled Suno A/B validation.

---

## 2. Evidence model and Suno confidence limits

### 2.1 Official Suno evidence

Suno does not publish official parameters named `ear candy`, `ping-pong delay`, `vocoder`, `stutter edit`, or `glitch vocal` with DAW-like deterministic behaviour. ATMOS is therefore constructing high-quality natural-language steering instructions, not controlling a literal DSP graph.

The following official Suno material supports the design direction:

- **Create in V4.5: Detailed Style Instructions** — Suno states that the Style field can use more conversational, detailed instructions covering arrangement development, layered instruments, subtle percussion and sonic detail.  
  https://help.suno.com/en/articles/5782849
- **Create in V4.5: Better Prompts in Lyrics** — Suno states that additional song context can be placed in the Lyrics field while Style carries genre/style information.  
  https://help.suno.com/en/articles/5782977
- **What's New in V4.5** — Suno describes improved prompt adherence, enhanced vocals, layered instruments, tone shifts and sonic detail.  
  https://help.suno.com/en/articles/5782593
- **What's New in v5.5** — v5.5 is the current published model family as of the date of this specification and introduces Voices / additional personalization.  
  https://help.suno.com/en/articles/11362305
- **Add Vocals** — Suno recommends that the Style box describe the combined instrumental + vocal result desired when adding vocals.  
  https://help.suno.com/en/articles/6882817

### 2.2 Production evidence for the new vocal classes

The implementation distinctions in this document are based on established production meanings:

- A **vocoder** electronically imposes the spectral/articulation shape of a modulator, commonly a voice, onto a carrier, commonly a synthesizer.
- A **talkbox** is a different process: an instrument signal is physically shaped by a performer's mouth and captured by microphone. For ATMOS prompting, talkbox therefore requires an existing plausible carrier source rather than being treated as a synonym for vocoder.
- **Vocal chops** are vocal samples cut into fragments and rearranged to form a new rhythmic or melodic figure.
- **Stutter editing** rhythmically retriggers small slices of audio; iZotope's Stutter Edit documentation specifically describes vocals as a common source and treats the technique as detailed ear-candy/transition editing.
- **Glitch** in this spec means intentional, controlled micro-editing (micro-slices, gated/reversed fragments, short digital interruptions), not accidental Suno artifacts.

Reference material:

- Sound On Sound, “What's the difference between a talk box and a vocoder?”  
  https://www.soundonsound.com/sound-advice/q-whats-difference-between-talk-box-and-vocoder
- Soundtrap, “What are vocal chops and how to create them”  
  https://blog.soundtrap.com/what-are-vocal-chops/
- iZotope Stutter Edit 2 documentation  
  https://downloads.izotope.com/docs/stutteredit2/en/index.html
- iZotope Stutter Edit product documentation  
  https://www.izotope.com/products/stutter-edit

### 2.3 Evidence hierarchy inside ATMOS

When rules conflict, use this order:

1. **Existing ATMOS Suno testing and engine-specific measured failures**.
2. **Current engine/source files and their documented identity/exclusion rules**.
3. **Official Suno prompting guidance**.
4. **Established production/audio terminology**.
5. **New design inference in this document**, which must be treated as a hypothesis until Suno A/B validation.

Do not silently promote a design inference into a “known Suno fact”.

---

## 3. Unified architecture

### 3.1 Final processing order

The authoritative v2.0 order is:

```text
ENGINE / CHARACTER / PALETTE
        ↓
NORMAL CAST RESOLUTION
        ↓
ELECTRONIC SOURCE + PATCH NORMALISATION
        ↓
BASE VOCAL IDENTITY / ROLE NORMALISATION
        ↓
BASE INTERPLAY / MOVEMENT
        ↓
VOCAL TREATMENT RESOLVER
        ↓
SPACE & MOVEMENT RESOLVER
        ↓
EAR CANDY RESOLVER
        ↓
CROSS-RESOLVER CONFLICT / DEDUPE
        ↓
PROMPT-BUDGET COMPACTION
        ↓
FINAL STYLE PROMPT + NEGATIVE PROMPT
        ↓
LYRIC GENERATION / ACCEPTANCE
        ↓
METATAG RESOLVER
        ↓
FINAL LYRICS + METATAGS
```

### 3.2 Why Vocal Treatment comes before Space & Movement

A deliberate vocal transformation can change what counts as a safe effect target. Example:

```text
Lead vocal
→ vocal chops
→ Space & Movement sees a chopped vocal layer
→ avoids adding a long smeared delay that would destroy rhythmic clarity
```

Conversely, a vocoder-treated backing layer may safely accept width/depth processing while the natural lead stays centered.

### 3.3 Why Ear Candy remains last

Ear Candy is the smallest and most disposable layer. It should inspect all earlier assignments and fill an unused dimension rather than duplicate them.

Example:

```text
Vocal Treatment: short phrase-ending stutter
Space & Movement: synth counterline ping-pong delay
Ear Candy: vibraphone isolated accent
```

This is preferable to assigning delay, stutter and additional vocal chops to the same vocal simply because all are individually legal.

### 3.4 No prompt-string rewriting

All three resolvers MUST operate on structured state before the final Style Prompt is flattened. Prohibited architecture:

```text
final prompt string
→ regex for “synth” / “vocal”
→ creative rewrite
```

Legacy sentence-form engine data may be accompanied by sidecar metadata, but the original sentence must remain intact.

---

## 4. Deterministic randomness and one-variable testing

Changing any new dropdown MUST NOT re-roll the underlying musical build.

Use independent derived sub-seeds:

```js
const castSeed           = deriveSeed(baseBuildSeed, "cast");
const vocalTreatmentSeed = deriveSeed(baseBuildSeed, "vocal-treatment");
const spaceMovementSeed  = deriveSeed(baseBuildSeed, "space-movement");
const earCandySeed       = deriveSeed(baseBuildSeed, "ear-candy");
```

Required behaviour:

- `Ear Candy Off → Balanced` changes only the Ear Candy layer.
- `Space & Movement Off → Rhythmic Motion` changes only the Space & Movement layer plus any direct conflict-driven compaction downstream.
- `Vocal Treatment Off → Vocoder` changes only vocal-treatment state plus direct conflict-driven choices in later resolvers.
- No change may re-roll character, palette, pad, bass, lead, percussion, core drum kit, vocal identity, harmony or other existing engine decisions.

If a later resolver must change because a new earlier choice creates a collision, the change must be explainable in the debug report as a **conflict resolution**, not random drift.

---

## 5. Normalised source model: instruments, electronic patches and drum-machine voices

### 5.1 Required principle

The system must distinguish **source identity** from **the sound/patch that source is producing**.

A generic value such as `synth` is insufficient for effects logic. The same synthesizer family can be a slow pad, tight pluck, sequenced arp, clipped chord pulse, sub-bass or bell-like patch. These have different effect permissions.

### 5.2 Core source schema

```js
{
  id: "bal_synth_pad_01",
  displayName: "warm analogue polysynth pad",
  role: "pad",
  family: "synth",
  sourceClass: "electronic",
  prominence: "background",
  protected: false,
  continuity: "sustained",
  behaviourTags: ["wide", "slow-attack"],

  patch: {
    voiceType: "sustained_pad",
    architecture: "subtractive_analog",
    envelope: "slow_attack_long_release",
    articulation: "sustained",
    brightness: "warm_dark",
    rhythmicity: "low",
    stereoRole: "wide_support",
    density: "continuous"
  },

  earCandyCapabilities: ["reverbBloom", "filterTail", "widthBloom"],
  spaceMovementCapabilities: ["chorusMovement", "slowFilterSweep", "widthBreath"],
  protectionTags: []
}
```

The `architecture` value is descriptive metadata only. Do not imply Suno is emulating a literal hardware circuit unless the existing engine already names a specific instrument or machine.

### 5.3 Minimum electronic patch taxonomy

The following `patch.voiceType` values should be supported initially:

| Voice type | Examples already present/compatible with ATMOS vocabulary | Typical processing character |
|---|---|---|
| `sustained_pad` | warm analogue pad, glassy digital pad, vocal-synth pad | width, chorus, phaser, slow filtering, depth |
| `synth_lead` | soft synth lead, filtered saw lead, synth motif | restrained delay, filter movement, occasional modulation |
| `synth_pluck` | synth pluck, clipped chord/pluck | ping-pong/digital delay, filter motion |
| `synth_arp` | synth arp, sequenced synth pulse | tempo delay, stereo motion, filter LFO |
| `synth_chord_pulse` | clipped synth chords, rhythmic synth chords | rhythmic filter/pan, short delays |
| `synth_bell_mallet` | synth bells, glassy mallet synth, FM bell | sparse delays, stereo movement, isolated accents |
| `drone` | drone synth, granular drone, sub drone | slow filter/width/timbre motion; avoid busy rhythmic effects |
| `granular_texture` | granular synth / stretched texture | slow evolving motion; avoid stacking glitch on already-fragmented texture |
| `synth_bass` | analogue bass, Moog bass, FM bass | conservative mono-compatible filter movement only |
| `sub_bass` | sine sub, FM sub, dub sub | normally protected from stereo/time effects |
| `electronic_perc_voice` | synthetic percussion accent | short delay, pan, modulation if not core pulse |

### 5.4 Drum-machine decomposition

The existing Balearic source material already contains first-class `drum machine` and `LinnDrum-style kit` vocabulary. Version 2.0 should therefore stop treating the entire drum machine as one opaque effect target where possible.

Normalise into voices when the current engine/prompt data supports it:

```js
{
  source: "LinnDrum-style kit",
  family: "drum_machine",
  voices: [
    { id: "kick",  role: "core_kick",  descriptor: "soft rounded electronic kick" },
    { id: "snare", role: "core_snare", descriptor: "dry synthetic snare" },
    { id: "clap",  role: "aux_clap",   descriptor: "muted electronic clap" },
    { id: "hat",   role: "hat",        descriptor: "tight closed electronic hats" }
  ]
}
```

Do not invent individual voices if the engine only has a validated opaque kit phrase and no safe way to express them without rewriting the engine. In that case keep the kit opaque and mark it `effectTarget: false` except for already-authored whole-groove behaviours.

### 5.5 Drum-voice safety defaults

| Voice | Default movement eligibility |
|---|---|
| Kick | protected; no widening, chorus, phaser or delay |
| Sub-bass | protected; mono/center stability |
| Core snare/backbeat | normally protected from obvious delay/modulation |
| Clap | eligible for short stereo/delay accents if engine-compatible |
| Closed/open hats | eligible for restrained stereo movement / short delay |
| Rim/click | strong candidate for short stereo or digital-delay motion |
| Auxiliary electronic percussion | strong candidate |

### 5.6 Patch metadata migration

Do not rewrite every existing instrument pool manually in one pass. Add metadata in layers:

1. explicit entries for sources already known to be electronic;
2. a conservative classifier for unannotated entries;
3. per-engine overrides where the classifier would be wrong;
4. debug logging for `patchMetadataSource: explicit | inferred | legacyOpaque`.

Explicit metadata always wins over inference.

---

## 6. Ear Candy Resolver

The Ear Candy subsystem retains the v1.0 design principle:

> **Ear Candy changes what an existing eligible sound briefly does. It does not normally add another sound.**

Version 2.0 keeps the v1.0 hard rule that Ear Candy MUST NOT introduce a new instrumental or vocal source solely because Ear Candy is enabled. If no safe existing candidate exists, the resolver returns no clause.

### 6.1 User-facing control

| Value | Intended effect | Target count | Hard maximum |
|---|---|---:|---:|
| Off | baseline | 0 | 0 |
| Subtle | one small incidental detail | 1 | 1 |
| Balanced | noticeable but restrained detail | 2 | 2 |
| Active | richer micro-detail without changing arrangement | up to 3 | 3 |

Counts are targets, not quotas. A no-op or reduced count is valid.

### 6.2 V1.0 Ear Candy core retained

### Core Ear Candy capability taxonomy

Version 1.0 uses a finite capability library. These are behavioural concepts, not instrument names.

#### 10.1 Melodic/detail capabilities

1. `isolatedAccent`  
   A brief note/chord/tone placed in an open space or phrase ending.

2. `phraseAnswer`  
   A short answering figure after or between primary phrases.

3. `graceNote`  
   A very short ornamental note/figure attached to an existing melodic voice.

4. `shortFragment`  
   A brief fragment of an existing synth/arp/motif voice that appears intermittently rather than continuously.

#### 10.2 Rhythmic capabilities

5. `phraseEndingFill`  
   A short percussion fill at selected phrase endings while the core groove remains unchanged.

6. `pickupFill`  
   A short pickup into selected sections; not a mandatory pre-transition fill.

7. `densityFlutter`  
   A temporary increase in activity from an existing light-percussion source, then immediate return to its base pattern.

#### 10.3 Spatial/processing capabilities

8. `delayThrow`  
   A selected note/phrase tail enters a short delay.

9. `reverbBloom`  
   A selected tail briefly expands into reverb and recedes.

10. `filterTail`  
    A selected tail changes tone through a brief filtered decay.

11. `reversePull`  
    A reversed fragment of an existing eligible source draws softly into a selected transition.

12. `stereoThrow`  
    An occasional accent briefly moves across the stereo field.

13. `widthBloom`  
    An existing sustained sound briefly widens, then returns to its normal placement.

#### 10.4 Vocal-texture capability

14. `vocalResponse`  
    An existing chant/wordless/vocal-texture source returns as a short response without becoming a second lead or spoken phrase.

#### 10.5 Sustained/orchestral capabilities

15. `shortSwell`  
    A short restrained swell from an existing sustained string/pad/choir source.

16. `orchestralPunctuation`  
    A brief existing orchestral/choir/brass accent used as punctuation. **ERA-only unless a future engine policy explicitly enables it.**

17. `harpFlourish`  
    A short harp figure used as an occasional answer. **ERA-only by default and only if harp is already present.**

---

### Canonical prose library

The library must contain authored variants. The runtime resolver selects from these; it does not invent new prose.

The prose is deliberately action-oriented: **source + behaviour + frequency/placement + protection against dominance**.

#### 11.1 `isolatedAccent`

**Compatible families:** mallet/bell, keys, synth pluck, selected brass/choir only where engine policy permits.

Variant A:
> `{subject} appears as occasional low-level accents at selected phrase endings.`

Variant B:
> `Isolated {subject} notes punctuate a few open spaces, kept behind the main lead.`

Variant C:
> `{subject} adds brief tonal punctuation in selected gaps without becoming a repeating hook.`

#### 11.2 `phraseAnswer`

**Compatible families:** keys, guitar/plucked, wind/flute, mallet/bell, synth lead/pluck, selected folk/orchestral solo voices.

Variant A:
> `{subject} adds occasional short answering figures between lead phrases.`

Variant B:
> `{subject} briefly answers selected melodic phrases from a secondary position in the mix.`

Variant C:
> `{subject} contributes restrained responses in open spaces between phrases.`

#### 11.3 `graceNote`

**Compatible families:** keys, guitar/plucked, mallet/bell, wind/flute, selected solo strings.

Variant A:
> `Selected {subject} phrases gain brief grace-note ornaments at occasional phrase endings.`

Variant B:
> `{subject} adds tiny ornamental turns to a few phrase endings, never continuously.`

Variant C:
> `Brief {subject} embellishments appear on selected notes while the main melodic shape stays unchanged.`

#### 11.4 `shortFragment`

**Compatible families:** synth arp, synth motif, synth pluck, chopped vocal texture, selected mallet patterns.

Variant A:
> `{subject} surfaces in occasional short fragments rather than a continuous counter-line.`

Variant B:
> `Brief fragments of the existing {subject} appear in selected gaps and then disappear.`

Variant C:
> `{subject} contributes short intermittent figures without becoming another permanent layer.`

#### 11.5 `phraseEndingFill`

**Compatible families:** hand percussion, light percussion, drum-kit detail where permitted.

Variant A:
> `{subject} adds brief phrase-ending fills while the core groove remains unchanged.`

Variant B:
> `Short {subject} flourishes appear around selected phrase endings without altering the main pulse.`

Variant C:
> `{subject} adds occasional compact fills in open rhythmic spaces, then returns to its base pattern.`

#### 11.6 `pickupFill`

**Compatible families:** hand percussion, light percussion, selected drum-kit detail.

Variant A:
> `{subject} provides short pickups into selected sections, not every transition.`

Variant B:
> `A brief {subject} pickup occasionally leads into a new phrase while the groove itself stays stable.`

Variant C:
> `{subject} adds restrained pre-phrase pickups at selected moments only.`

#### 11.7 `densityFlutter`

**Compatible families:** shakers, rattles, cabasa, tambourine, hi-hat detail, light hand percussion.

Variant A:
> `{subject} briefly increases activity in selected gaps, then returns to its normal pattern.`

Variant B:
> `The existing {subject} becomes momentarily busier around a few phrase endings, then settles back.`

Variant C:
> `{subject} adds short bursts of extra rhythmic detail without changing the underlying groove.`

#### 11.8 `delayThrow`

**Compatible families:** keys, guitar, synth, wind/flute, vocal texture, mallet/bell.

Variant A:
> `Selected {subject} notes trail into short tempo-synced delays at occasional phrase endings.`

Variant B:
> `A few {subject} phrase endings leave brief delayed echoes, kept secondary to the dry source.`

Variant C:
> `{subject} occasionally throws its final note into a short rhythmic delay before returning dry.`

#### 11.9 `reverbBloom`

**Compatible families:** pads, drones, choir/vocal texture, strings, winds, keys, bells.

Variant A:
> `Selected {subject} tails briefly bloom into reverb before receding into the background.`

Variant B:
> `{subject} occasionally opens into a longer reverberant tail, then returns to its normal depth.`

Variant C:
> `A few {subject} endings expand into soft reverb blooms without changing the base arrangement.`

#### 11.10 `filterTail`

**Compatible families:** synths, pads, processed keys, processed guitar, vocal texture.

Variant A:
> `Selected {subject} tails soften through a brief filtered decay before disappearing.`

Variant B:
> `{subject} occasionally closes into a short filtered tail at phrase endings.`

Variant C:
> `A few {subject} endings darken through brief filter movement, then return to the normal tone.`

#### 11.11 `reversePull`

**Compatible families:** pads, synth textures, processed vocal textures, selected percussion fragments.

Variant A:
> `An occasional reversed fragment of the existing {subject} draws softly into selected transitions.`

Variant B:
> `A brief reversed {subject} tail appears before a few transitions, never as a recurring riser.`

Variant C:
> `Selected transitions receive a short reversed pull made from the existing {subject}.`

#### 11.12 `stereoThrow`

**Compatible families:** bells/mallets, light percussion, synth plucks, processed keys/guitar, vocal fragments.

Variant A:
> `Occasional {subject} accents shift briefly across the stereo field, then return to their normal placement.`

Variant B:
> `A few {subject} details move momentarily left-to-right while the main instruments remain stable.`

Variant C:
> `{subject} adds brief stereo-moving accents in selected gaps without changing its base mix position.`

#### 11.13 `widthBloom`

**Compatible families:** pads, drones, choir, sustained strings, sustained synth textures.

Variant A:
> `The existing {subject} briefly widens around selected phrase endings before receding.`

Variant B:
> `{subject} occasionally expands in stereo width for a moment, then returns to the established field.`

Variant C:
> `A few {subject} tails open wider in the stereo image without increasing overall arrangement density.`

#### 11.14 `vocalResponse`

**Compatible families:** chant, wordless vocal wash, choir texture, sampled/chopped vocal fragments.

Variant A:
> `The existing {subject} returns occasionally as brief distant responses, never as a second lead.`

Variant B:
> `Short {subject} responses appear in selected gaps while the primary vocal role remains unchanged.`

Variant C:
> `{subject} contributes occasional brief call-and-response fragments, used as musical texture rather than narration.`

#### 11.15 `shortSwell`

**Compatible families:** strings, pads, drones, choir, sustained guitar.

Variant A:
> `{subject} adds occasional restrained swells around selected section edges.`

Variant B:
> `Brief {subject} swells rise and fall behind the main voices at selected moments.`

Variant C:
> `{subject} occasionally lifts into a short sustained swell before returning to the background.`

#### 11.16 `orchestralPunctuation` — ERA policy only by default

**Compatible families:** orchestral hit, choir stab, brass stab, orchestral percussion.

Variant A:
> `Brief {subject} accents punctuate selected phrase endings without becoming a repeating hook.`

Variant B:
> `{subject} provides isolated dramatic punctuation at a few structural moments rather than every transition.`

Variant C:
> `Selected transitions receive a short {subject} accent, used selectively rather than as a constant marker.`

#### 11.17 `harpFlourish` — ERA policy only by default

Variant A:
> `A short {subject} flourish occasionally answers the lead line before returning to the orchestral bed.`

Variant B:
> `{subject} adds brief answering figures in selected open spaces, never as a continuous arpeggio layer.`

Variant C:
> `Occasional {subject} flourishes connect selected phrases while remaining secondary to the main melody.`

---

### Prose rendering rules

#### 12.1 Frequency vocabulary

Use frequency language as semantic guidance, not as a promise that Suno will obey exact event counts.

Preferred terms:

- `occasional`
- `selected`
- `a few`
- `brief`
- `intermittent`
- `momentarily`
- `at selected phrase endings`
- `in open spaces between phrases`

Do not depend on exact statements such as “once every 16 bars” in the final Suno prompt. Bar counts may be useful internally for design intent but are not reliable prompt controls.

#### 12.2 Prominence language

When the candidate is background/secondary, the prose SHOULD explicitly protect its position using language such as:

- `kept behind the main lead`
- `secondary to the lead`
- `low-level`
- `from a secondary position in the mix`
- `receding into the background`
- `without becoming a repeating hook`
- `without becoming another permanent layer`

This is especially important in Balearic, where existing project testing found that prompt position alone is not a sufficient prominence control.

#### 12.3 No over-qualification

Do not stack every concept into every clause. A single Ear Candy clause should usually contain:

**source + behaviour + frequency/placement + one non-dominance guard**

Example:

> `Vibraphone adds occasional low-level accents at selected phrase endings, kept behind the lead.`

Not:

> `Warm vibraphone with soft attack and rounded transients adds occasional sparse low-level subtle background accents at selected phrase endings with gentle stereo width and restrained dynamics behind the lead.`

The latter wastes prompt budget and risks changing the sound source itself.

---

### Instrument-family capability matrix

| Family | Typical existing ATMOS sources | Preferred capabilities | Restricted capabilities |
|---|---|---|---|
| `mallet_bell` | vibraphone, kalimba, marimba, celeste, glockenspiel, synth bells, glassy FM bell, cimbalom, steel pan | isolatedAccent, phraseAnswer, graceNote, stereoThrow, delayThrow | continuous counter-line unless already its base role |
| `keys` | Rhodes, Wurlitzer, piano, felt piano, clavinet | phraseAnswer, graceNote, delayThrow, reverbBloom, isolatedAccent | do not demote a primary hook into “background” wording |
| `guitar_plucked` | nylon guitar, acoustic steel guitar, clean electric, delayed electric, lap-steel, sustained guitar where suitable | phraseAnswer, graceNote, delayThrow, filterTail, reverbBloom | no new guitar in characters that exclude it |
| `synth_melodic` | synth lead, pluck, arp, motif, counter-line, clipped synth chords | shortFragment, phraseAnswer, delayThrow, filterTail, stereoThrow | avoid making an existing subtle motif into a second hook |
| `light_percussion` | shaker, rattles, cabasa, tambourine, rim clicks, light hats | phraseEndingFill, pickupFill, densityFlutter, stereoThrow | forbidden on beatless characters |
| `hand_percussion` | congas, bongos, frame drum, djembe, dumbek, tabla patterns | phraseEndingFill, pickupFill | respect ceremonial/heartbeat rules and tempo guards |
| `pads_drones` | analog pad, glassy pad, FM pad, synth wash, drones, organ/pad beds where native | reverbBloom, filterTail, reversePull, widthBloom, shortSwell | do not add rhythmic gating unless already native |
| `strings_sustained` | synth strings, string-machine ensemble, orchestral strings where engine-native | shortSwell, reverbBloom, widthBloom | real orchestral strings prohibited in Balearic automatic behaviour |
| `wind_flute` | shakuhachi, duduk, cedar flute, ocarina, ney, bamboo flute, oboe where already present | phraseAnswer, graceNote, delayThrow, reverbBloom | primary/signature lead protection applies |
| `choir_vocal_texture` | Gregorian chant, wordless choir, vocal wash, vocal chops, chant fragments | vocalResponse, reverbBloom, widthBloom, shortFragment | never convert chant to spoken narration |
| `orchestral_brass_hit` | ERA brass stab, orchestral hit, selected existing brass accents | orchestralPunctuation | disabled outside engine/character policy |
| `harp` | ERA harp, Delerium harp where already present | harpFlourish, phraseAnswer, reverbBloom | no new harp in Balearic |
| `bass` | sub bass, analog bass, electric/fretless/upright bass | normally none | Version 1.0 avoids bass Ear Candy unless later Suno testing proves value |
| `core_drum_kit` | full kit descriptors / primary beat | only carefully-authored fill behaviour if engine exposes separable detail | do not rewrite opaque kit descriptors; prefer separate percussion candidates |

---

### Candidate scoring

The resolver should score **candidate + capability pairs**, not instruments alone.

#### 14.1 Recommended base role weights

| Role | Base score |
|---|---:|
| colour | 100 |
| counter | 90 |
| texture | 84 |
| light percussion / percussion | 80 |
| vocal texture | 76 |
| pad/drone | 66 |
| harmony/support | 58 |
| motif/lead | 44 |
| core rhythm | 30 |
| bass | 10 |

#### 14.2 Bonuses

Suggested starting bonuses:

```text
backgroundOnly           +20
secondaryRole            +12
enginePreferred          +15
alreadyDecorative        +12
complementsMovement       +8
underusedFamily           +5
```

#### 14.3 Penalties and hard exclusions

```text
signatureLeadInLeadRole   HARD EXCLUDE
engineDeniedCapability    HARD EXCLUDE
beatlessPercussion        HARD EXCLUDE
negativePromptCollision   HARD EXCLUDE
expertParkedInstrument    HARD EXCLUDE
newInstrument             HARD EXCLUDE (v1.0)
primaryLead               -50
repeatingHook             -35
movementDuplicate         -45
interplayDuplicate        -35
existingBehaviourOverlap  -30
sameFamilyAsChosenCandy   -20
sameCapabilityClass       -20
highBaseDensity           -15
```

The numerical values are starting implementation values, not proven musical constants. They should be placed in configuration rather than hard-coded throughout the resolver so they can be tuned after Suno testing.

---

### Complementarity rules

Balanced and Active modes should prefer different classes of detail rather than stacking multiple melodic flourishes.

#### 15.1 Capability classes

```js
const capabilityClass = {
  isolatedAccent: "melodic",
  phraseAnswer: "melodic",
  graceNote: "melodic",
  shortFragment: "melodic",

  phraseEndingFill: "rhythmic",
  pickupFill: "rhythmic",
  densityFlutter: "rhythmic",

  delayThrow: "spatial",
  reverbBloom: "spatial",
  filterTail: "spatial",
  reversePull: "spatial",
  stereoThrow: "spatial",
  widthBloom: "spatial",

  vocalResponse: "vocal",
  shortSwell: "sustained",
  orchestralPunctuation: "orchestral",
  harpFlourish: "melodic"
};
```

#### 15.2 Selection limits

Version 1.0 SHOULD enforce:

- maximum one Ear Candy treatment per cast member;
- maximum one melodic-class treatment in Subtle/Balanced;
- Active may use two melodic-adjacent details only if one is orchestral punctuation in ERA and they affect different sources;
- prefer one tonal/melodic + one spatial treatment in Balanced;
- Active preferably adds a rhythmic or vocal/sustained third treatment rather than a second similar melodic treatment;
- do not choose two different capabilities that create the same audible result (for example `delayThrow` plus an existing Movement directive already specifying delay throws).

---

### Existing-behaviour conflict system

This is essential. The resolver must know what an instrument is already doing.

Example base sentence:

> `Clean nylon guitar motifs with soft rhythmic strumming drifting in and out of the mix.`

Existing behaviour tags:

```js
[
  "motif",
  "rhythmicStrum",
  "intermittentPresence",
  "mixMovement"
]
```

Therefore do not select an Ear Candy capability whose rendered meaning duplicates:

- intermittent presence;
- drifting in/out;
- phrase-level motif repetition.

A compatible new dimension might be:

- `delayThrow`;
- `reverbBloom`;
- a restrained `graceNote` if the source is not the primary hook.

#### 16.1 Metadata first, text parsing second

Where current engine data already has structured role/behaviour information, use it.

For legacy strings, build sidecar tags manually as part of migration. Do not make runtime natural-language parsing the primary architecture.

A lightweight text scanner may be used only as a final safeguard for obvious duplicate terms such as `delay`, `reverb`, `reverse`, `widen`, `stereo`, `fill`, `answer`, but it is not the source of truth.

---

### Movement and Interplay dedupe

The Ear Candy resolver must see normalized capabilities already represented by Movement and Interplay.

Examples:

| Existing Movement/Interplay meaning | Ear Candy capabilities to suppress |
|---|---|
| tempo-synced delay throws | delayThrow |
| rhythmic delay | delayThrow |
| deep reverb blooms / reverberant bloom | reverbBloom |
| stereo expansion/contraction | widthBloom, stereoThrow if redundant |
| reversed pad swell into downbeat | reversePull |
| elements enter and dissolve | shortFragment/intermittent presence if semantically redundant |
| percussion already performs phrase fills | phraseEndingFill, pickupFill |

Dedupe is semantic, not just exact-string matching.

---

### Negative-prompt collision rule

Ear Candy MUST adapt to the effective negative prompt, not alter it.

Process:

1. compute the engine/character/preset effective negative list using existing logic;
2. normalize negative terms to semantic tags where possible;
3. reject Ear Candy capabilities or prose variants that collide with those terms;
4. try another prose variant/capability/candidate;
5. if no safe option remains, return no Ear Candy clause.

Do **not** remove a negative term because an Ear Candy phrase would otherwise conflict.

This matters because the legacy/current codebase may contain different defensive wording across versions. A phrase library should therefore not assume that a word such as `sparse` is always safe; the final phrase selector must check the actual effective negative prompt.

---

### Prompt-budget priority

The existing unified app specification treats 1000 characters as a hard Style Prompt budget and warns near 900 characters. Ear Candy is decorative and therefore lower priority than core engine identity.

#### 19.1 Priority order for trimming

If the final prompt is too long:

1. shorten Ear Candy wording using a compact approved variant;
2. drop the lowest-scoring Ear Candy treatment;
3. repeat until within budget;
4. never delete core genre, cast, tempo, signature lead, negative-defense or other load-bearing content merely to preserve Ear Candy.

#### 19.2 Compact fallback variants

Each capability should have a compact fallback, for example:

```text
phraseAnswer      → "{subject} adds occasional brief answers between phrases."
delayThrow        → "Selected {subject} notes leave short delay tails."
reverbBloom       → "Selected {subject} tails briefly bloom into reverb."
phraseEndingFill  → "{subject} adds occasional brief phrase-ending fills."
isolatedAccent    → "{subject} adds occasional low-level accents."
```

---

---

## 7. Space & Movement Resolver

### 7.1 Definition

> **Space & Movement is a layer-level processing resolver that assigns restrained time, stereo, modulation or filter behaviour to compatible existing sources in order to create depth, width and motion without changing the instrument cast.**

This is separate from Ear Candy because the behaviour can persist for a section or substantial part of the arrangement rather than appearing only as an incidental event.

### 7.2 User-facing control

Recommended first-release dropdown:

| Value | User intent | Resolver emphasis |
|---|---|---|
| **Off** | preserve current engine behaviour | no added resolver clause |
| **Auto** | engine decides the safest movement | choose one compatible class based on cast/character |
| **Width & Depth** | larger spatial field | width, depth, restrained ambience |
| **Rhythmic Motion** | audible movement tied to pulse | tempo-linked echoes, alternating stereo movement |
| **Modulated Motion** | slow cyclic timbral/stereo movement | chorus, phaser, gentle modulation |
| **Filter Evolution** | changing tone/brightness over time | slow filter sweeps/LFO-controlled filtering |

Do not expose a rack of individual effect controls in the normal UI. The resolver should decide whether the selected intent is best achieved with ping-pong delay, chorus, phaser, autopan, filter LFO, etc.

### 7.3 Optional advanced mode

If an Advanced panel is introduced later, it MAY expose the resolved effect for inspection/override, but this is out of scope for the first implementation. The initial implementation should keep the single dropdown.

### 7.4 Core capability taxonomy

| Capability ID | Class | Intent | Typical target |
|---|---|---|---|
| `shortDigitalDelay` | time | short depth/echo | pluck, guitar, vocal texture, percussion accent |
| `pingPongDelay` | time/stereo | alternating left-right repeats | pluck, arp, mallet, secondary vocal |
| `tempoSyncedDelay` | time/rhythm | pulse-linked echo | arp, counterline, guitar, secondary vocal |
| `stereoDelay` | time/stereo | width through offset echoes | counterline, keys, vocal texture |
| `chorusMovement` | modulation | slow width/timbre movement | pads, clean guitar, electric keys |
| `phaserMovement` | modulation | moving spectral notches | synth pad/lead, guitar; restrained by engine |
| `subtleFlange` | modulation | light comb-like motion | specialist electronic source only |
| `autoPan` | stereo/rhythm | controlled left-right motion | hats, perc, synth fragments |
| `widthBreath` | stereo | slow width expansion/contraction | pads, choir textures, sustained synths |
| `reverbDepth` | depth | deeper front/back placement | vocal texture, pad, selected acoustic support |
| `slowFilterSweep` | filter | gradual brightness/tone change | pad, drone, synth counterline |
| `filterLfo` | filter/modulation | cyclic cutoff movement | arp, pluck, pad, synth pulse |
| `resonantFilterMotion` | filter | more audible filter movement | electronic characters only; high drift risk |
| `amplitudeLfo` | modulation | gentle pulsing level movement | pad/synth texture; not core vocal lead |
| `rhythmicFilterPulse` | filter/rhythm | pulse-synced tonal movement | synth chord/arp/pulse |
| `stereoEchoAccent` | time/stereo | selected accents move into short stereo echoes | perc, mallet, vocal fragment |
| `modulationFlow` | generic | resolver chooses a subtle compatible modulation | fallback when exact DSP word would over-specify |

### 7.5 LFO rendering rule

Never render the bare term `LFO` by itself. Render the parameter being moved:

```text
slow LFO-modulated filter movement
subtle LFO-controlled stereo motion
gentle amplitude modulation under a slow LFO
```

The user selects an audible intent; the prompt should describe the audible behaviour.

### 7.6 Canonical prose library

Each capability must have authored variants plus a compact fallback. These strings are data, not runtime LLM prose.

#### `shortDigitalDelay`

- Full A: `{source} carries a short digital delay, with repeats kept quiet and behind the dry source.`
- Full B: `Short digital echoes trail selected {source} phrases without blurring the main line.`
- Compact: `{source} with restrained short digital delay.`

#### `pingPongDelay`

- Full A: `{source} carries restrained tempo-synced ping-pong delay, the repeats alternating behind the dry source.`
- Full B: `Selected {source} phrases open into short left-right echoes while the original stays clear and centered.`
- Compact: `{source} with restrained ping-pong delay.`

#### `tempoSyncedDelay`

- Full A: `{source} uses a restrained tempo-synced delay that reinforces the groove without creating a second melody.`
- Full B: `Quiet rhythmic echoes follow the {source}, locked to the pulse and kept secondary.`
- Compact: `{source} with quiet tempo-synced echoes.`

#### `stereoDelay`

- Full A: `{source} gains depth from short offset stereo delays while the dry source remains stable.`
- Full B: `A restrained stereo delay gives the {source} width without pulling it forward.`
- Compact: `{source} with restrained stereo delay.`

#### `chorusMovement`

- Full A: `{source} carries slow gentle chorus movement, widening the sustained tone without obvious wobble.`
- Full B: `Subtle chorus modulation gives the {source} a slowly breathing stereo texture.`
- Compact: `{source} with gentle chorus movement.`

#### `phaserMovement`

- Full A: `{source} develops slow restrained phaser movement, audible as gradual tonal motion rather than a dominant effect.`
- Full B: `A soft slow phaser passes through the {source} while its musical role remains unchanged.`
- Compact: `{source} with slow restrained phaser motion.`

#### `subtleFlange`

- Full A: `{source} carries very light slow flanging, used only as background timbral motion.`
- Full B: `A restrained flange gives the {source} slight moving colour without metallic dominance.`
- Compact: `{source} with very light flange movement.`

#### `autoPan`

- Full A: `{source} moves gently across the stereo field in a controlled pulse-linked pattern.`
- Full B: `Subtle auto-pan gives the {source} measured left-right motion while the core groove stays centered.`
- Compact: `{source} with subtle stereo panning motion.`

#### `widthBreath`

- Full A: `{source} slowly widens and narrows around its existing position, creating gentle spatial breathing.`
- Full B: `The stereo width of {source} opens slightly in selected passages and settles back afterward.`
- Compact: `{source} with slow width breathing.`

#### `reverbDepth`

- Full A: `{source} sits deeper in the field with a restrained reverberant tail, preserving clarity in front.`
- Full B: `A soft depth reverb places {source} behind the primary voices rather than enlarging it.`
- Compact: `{source} set deeper with restrained reverb.`

#### `slowFilterSweep`

- Full A: `{source} evolves through a slow filter opening and closing, changing brightness without changing its notes.`
- Full B: `A gradual filter sweep gives the {source} slow tonal evolution while it remains secondary.`
- Compact: `{source} with slow filter evolution.`

#### `filterLfo`

- Full A: `{source} carries gentle LFO-modulated filter movement, adding slow cyclic tonal change.`
- Full B: `A restrained filter LFO moves the {source} between darker and brighter colour without becoming a rhythmic gimmick.`
- Compact: `{source} with gentle filter-LFO motion.`

#### `resonantFilterMotion`

- Full A: `{source} uses restrained resonant filter movement for a more audible electronic sweep, kept below the lead.`
- Full B: `Controlled resonant filtering animates {source} without pushing the track toward acid or rave convention.`
- Compact: `{source} with restrained resonant filter motion.`

#### `amplitudeLfo`

- Full A: `{source} carries gentle LFO-controlled amplitude movement, creating a slow pulse without replacing the groove.`
- Full B: `Subtle cyclic level modulation gives {source} motion while leaving the rhythmic foundation unchanged.`
- Compact: `{source} with gentle amplitude modulation.`

#### `rhythmicFilterPulse`

- Full A: `{source} moves through a restrained pulse-synced filter pattern that follows the existing groove.`
- Full B: `A quiet rhythmic filter pulse animates {source} without turning it into a new sequenced lead.`
- Compact: `{source} with restrained rhythmic filter motion.`

#### `stereoEchoAccent`

- Full A: `Selected {source} accents leave short alternating stereo echoes, appearing only where the arrangement has space.`
- Full B: `Occasional {source} hits throw briefly into the stereo field and decay quickly.`
- Compact: `occasional stereo echoes on {source} accents.`

#### `modulationFlow`

- Full A: `{source} carries subtle slow modulation that creates movement without changing its musical role.`
- Full B: `Gentle modulation keeps {source} in motion while remaining background support.`
- Compact: `{source} with subtle modulation flow.`

### 7.7 Compatibility by source/patch

Legend: `P` preferred, `A` allowed, `R` restricted/contextual, `X` default deny.

| Source / patch | Delay | Ping-pong | Chorus | Phaser | Auto-pan | Filter/LFO | Width/depth |
|---|---:|---:|---:|---:|---:|---:|---:|
| sustained synth pad | A | R | P | A | R | P | P |
| synth pluck | P | P | R | R | A | P | A |
| synth arp | P | P | R | R | P | P | A |
| synth lead | A | A | A | A | R | A | A |
| synth chord pulse | A | A | R | R | A | P | A |
| synth bell/mallet | P | P | X | R | A | A | A |
| drone/granular pad | R | X | A | A | X | P | P |
| electric/Rhodes keys | A | A | P | R | X | A | A |
| clean/delayed guitar | P | A | P | A | R | A | A |
| acoustic/nylon guitar | A | R | R | X | X | X | A |
| hats/rim/aux perc | A | A | X | X | P | R | X |
| core kick | X | X | X | X | X | X | X |
| sub bass | X | X | X | X | X | R | X |
| synth/electric bass | X | X | R | X | X | R | X |
| orchestral strings | X | X | X | X | X | X | P (ERA/context only) |
| choir/vocal pad | A | R | A | R | R | R | P |
| natural lead vocal | R | R | R | X | X | X | A; Vocal Treatment has priority |
| chopped vocal layer | A | A | X | X | A | R | A |

### 7.8 Selection scoring

Recommended score inputs:

```text
source compatibility
+ patch compatibility
+ engine permission
+ character permission
+ requested Space & Movement mode
+ role suitability
+ complementarity with Vocal Treatment
- signature/protected penalty
- existing Movement duplicate penalty
- existing effect duplicate penalty
- prompt-budget penalty
- genre-drift risk
```

### 7.9 Mode behaviour

**Width & Depth** should prefer `widthBreath`, `reverbDepth`, restrained `stereoDelay`, `chorusMovement`.

**Rhythmic Motion** should prefer `tempoSyncedDelay`, `pingPongDelay`, `autoPan`, `stereoEchoAccent`, `rhythmicFilterPulse`.

**Modulated Motion** should prefer `chorusMovement`, `phaserMovement`, conservative `subtleFlange`, `amplitudeLfo`.

**Filter Evolution** should prefer `slowFilterSweep`, `filterLfo`, and only where engine-safe `resonantFilterMotion`.

**Auto** should select one mode internally from the engine/character policy rather than drawing from the full capability pool indiscriminately.

### 7.10 Treatment count

Space & Movement should normally resolve **one primary treatment**. It MAY resolve a second tiny supporting movement only in `Auto` where the engine already has a strong spatial identity and both treatments are complementary (for example pad width + sparse percussion pan). Do not create an effects rack.

### 7.11 Existing Movement dedupe

If the base engine already states:

```text
tempo-synced delay throws
slow filter motion
pads widen in chorus
```

those semantic capabilities are already consumed. The new resolver must either:

- choose a different compatible movement dimension, or
- no-op.

Do not generate synonyms of the same movement simply to satisfy the dropdown.

---

## 8. Vocal Treatment Resolver

### 8.1 Definition

> **Vocal Treatment is the authoritative resolver for deliberate timbral or temporal transformation of an existing eligible vocal source.**

It is separate from Ear Candy and Space & Movement because it can change vocal identity, intelligibility, rhythmic structure or sample behaviour.

### 8.2 User-facing control

Recommended dropdown:

| Value | Meaning |
|---|---|
| **Off** | existing engine vocal behaviour only |
| **Auto** | engine/character chooses one safe treatment if a suitable vocal source exists |
| **Vocoder** | synthetic/electronic vocal transformation |
| **Talkbox** | talking-instrument treatment tied to an existing eligible carrier |
| **Vocal Chops** | rearranged vocal fragments used rhythmically/melodically |
| **Stutter** | short tempo-locked retrigger/micro-repeat edits |
| **Glitch** | controlled digital micro-edits, gated/reversed/sliced fragments |

Initial default: **Off**.

Do not add separate public dropdowns for “amount”, “rate”, “carrier”, “slice size”, etc. Those would reintroduce choice fatigue. The engine resolves those concepts qualitatively.

### 8.3 Visibility and enablement

If the selected vocal mode is `Instrumental`, the Vocal Treatment control MUST be disabled and forced to Off.

If the engine has non-lyrical voice/chant content but no conventional lead singer, the control may remain enabled only for treatments allowed on that voice role.

### 8.4 Vocal-role taxonomy

Normalise every vocal source into one of these roles where possible:

```text
lead_lyric_vocal
backing_vocal
choir
chant_lead
chant_layer
wordless_vocal
vocal_pad
sampled_vocal_fragment
looped_vocal_hook
existing_vocal_chop
persona_or_voice_lead
```

### 8.5 Persona / Voice protection

Suno v5.5 Voices and existing ATMOS Persona usage make identity preservation important.

Rules:

- `persona_or_voice_lead` is protected from automatic full-lead transformation.
- `Auto` may add a derived/background treatment around a Persona/Voice lead, but must not replace the primary identity.
- An explicit user selection such as `Vocoder` may still be honoured, but the default rendering should prefer **selected phrases / backing layer / hook layer** rather than “the entire lead is vocoded”.
- A future Advanced control may permit full-lead transformation; it is not required in v2.0.

### 8.6 Treatment classes

#### Timbral transformations

- `vocoderAccentLayer`
- `vocoderHookLayer`
- `vocoderWordlessPad`
- `talkboxPhrase`
- `talkboxHookResponse`

#### Temporal / sample-edit transformations

- `vocalChopAccent`
- `vocalChopHook`
- `phraseEndingStutter`
- `syllableRetrigger`
- `microSliceGlitch`
- `gatedGlitchFragment`
- `reverseGlitchFragment`

The UI does not expose these subtypes. They are resolver capabilities beneath the selected top-level treatment.

### 8.7 Talkbox is not vocoder

This is a hard semantic rule.

`Talkbox` MUST require an existing plausible carrier source in the resolved cast, preferably:

```text
synth_lead
synth_chord_pulse
synth_arp
clean_electric_guitar
electric_guitar
```

If no eligible carrier exists:

- Talkbox should be disabled in the dropdown when the UI can determine this before selection; or
- if a stale saved preset requests Talkbox after the cast changes, resolve to Off and display a non-blocking explanation in the validation/debug panel.

Do NOT invent a new guitar or synth solely to make Talkbox work.

### 8.8 Vocoder carrier policy

A vocoder is technically a carrier/modulator process, but ATMOS does not need to invent or expose a literal carrier signal in the Style Prompt. Prefer:

```text
vocoder-treated backing vocal
restrained vocoded wordless layer
selected vocal phrases pass through a soft vocoder layer
```

If an existing synth pad/lead is an obvious compatible carrier, metadata may record it for internal logic, but the renderer does not need to restate it unless doing so improves clarity without duplicating the instrument.

### 8.9 Vocal Chops policy

Vocal Chops derive from a vocal source already present in the cast. They do not count as a new singer.

Rules:

- Prefer background/secondary placement unless the source character already treats chopped vocals as a signature element.
- Never transform all lyric lines into chops by default.
- Preserve intelligibility of the primary lyric lead.
- Existing `sampled_vocal_fragment`, `looped_vocal_hook` or `existing_vocal_chop` sources score highly because the engine already supports that behaviour.

### 8.10 Stutter policy

Stutter means a short, controlled, tempo-related micro-repeat. Default use:

- phrase ending;
- transition edge;
- one or two syllables;
- brief hook punctuation.

Do not render “constant stuttered vocals” unless a future expert mode explicitly asks for it.

### 8.11 Glitch policy

The UI label may say `Glitch`, but canonical prose should prefer controlled descriptions:

```text
intentional digital vocal micro-edits
brief micro-sliced vocal fragments
short gated and reversed vocal fragments
controlled digital interruption at selected section edges
```

Avoid vague phrases such as `glitchy vocals` because Suno can already produce accidental artifacts and the prompt should distinguish intended structure from noise/failure.

### 8.12 Canonical Vocal Treatment prose library

#### Vocoder — accent/backing

- Full A: `A restrained vocoder-treated backing layer shadows selected vocal phrases, blended behind the natural lead.`
- Full B: `Selected vocal phrases pass through a soft vocoder layer while the main vocal remains clear and human.`
- Compact: `restrained vocoder layer behind selected vocal phrases.`

#### Vocoder — wordless/texture

- Full A: `A low-mixed vocoded wordless layer appears as synthetic vocal texture rather than a second lead.`
- Full B: `Wordless vocal tones are lightly vocoded into a soft harmonic texture behind the arrangement.`
- Compact: `soft low-mixed vocoded wordless texture.`

#### Talkbox — phrase

- Full A: `Selected hook phrases take on a brief talkbox-style talking-instrument contour through the existing {carrier}, then return to the natural vocal.`
- Full B: `The existing {carrier} forms a short talkbox-treated response around selected vocal phrases, never replacing the lead.`
- Compact: `brief talkbox-style responses through the existing {carrier}.`

#### Vocal Chops — accents

- Full A: `Short fragments of the existing vocal are chopped into sparse rhythmic accents between phrases.`
- Full B: `Selected syllables are rearranged into brief vocal-chop figures that remain secondary to the lead.`
- Compact: `sparse rhythmic chops from the existing vocal.`

#### Vocal Chops — hook

- Full A: `A short fragment of the existing vocal becomes a restrained chopped hook in open spaces between lyric lines.`
- Full B: `Brief rearranged vocal fragments form an occasional hook without becoming a continuous new melody.`
- Compact: `occasional chopped-vocal hook fragments.`

#### Stutter — phrase ending

- Full A: `Selected phrase endings repeat in a short tempo-locked vocal stutter before resolving cleanly.`
- Full B: `One or two syllables briefly retrigger at selected section edges as a tight rhythmic edit.`
- Compact: `short tempo-locked stutters on selected phrase endings.`

#### Glitch — micro-slice

- Full A: `Rare intentional vocal micro-slices punctuate selected transitions, kept brief and clearly secondary.`
- Full B: `Brief controlled digital vocal fragments interrupt selected section edges without obscuring the lyric.`
- Compact: `rare controlled vocal micro-edits at transitions.`

#### Glitch — gated/reversed

- Full A: `Occasional gated or reversed fragments of the existing vocal create short digital punctuation around transitions.`
- Full B: `Selected vocal tails break into brief gated/reversed fragments and disappear quickly.`
- Compact: `brief gated/reversed vocal fragments at selected transitions.`

### 8.13 Treatment intensity is internal

Every top-level treatment has an engine/character-constrained internal intensity:

```text
accent
support
feature
```

Normal UI does not expose it.

Default rules:

- Vocoder: `support` unless the engine already has vocoded voice as a native signature.
- Talkbox: `accent`.
- Vocal Chops: `support`; may become `feature` only in characters where chopped voice is already source-derived.
- Stutter: `accent`.
- Glitch: `accent`.

### 8.14 Vocal Treatment versus Ear Candy

The same technique can exist at two scales, but only one resolver owns the deliberate choice.

Example:

```text
Vocal Treatment = Stutter
→ authoritative stutter assignment
→ Ear Candy must not independently add a second stutter or vocal chop
```

If Vocal Treatment is Off, Ear Candy MAY still choose its existing `vocalResponse` capability or another small vocal-texture event where the engine policy allows it. Ear Candy should not silently decide to turn the lead vocal into a vocoder/talkbox/stutter/glitch effect.

### 8.15 Vocal Treatment versus Space & Movement

Space & Movement MAY process the transformed vocal if compatible:

```text
Vocoder backing layer + width/depth = often compatible
Vocal chops + short stereo echo = sometimes compatible
Stutter + long ping-pong delay = usually conflict
Glitch micro-slices + phaser + filter LFO = likely over-processing; avoid
```

The Vocal Treatment result must therefore be part of the Space & Movement context.

---

## 9. Cross-resolver conflict and complementarity system

### 9.1 Capability classes

Every assignment should be tagged into one or more dimensions:

```text
melodic_detail
rhythmic_detail
time_echo
stereo_motion
modulation
filter_motion
depth
vocal_transform
vocal_edit
orchestral_punctuation
```

### 9.2 Default anti-stacking rules

Avoid assigning more than one strong capability in the same dimension to the same source.

Examples:

- `pingPongDelay` + `tempoSyncedDelay` on one source: duplicate, choose one.
- `filterLfo` + `slowFilterSweep`: usually duplicate.
- `phraseEndingStutter` + `microSliceGlitch` on one vocal: usually too dense.
- `vocalChopHook` + Ear Candy `vocalResponse`: often redundant.
- `widthBreath` + existing engine “pads widen in chorus”: duplicate.

### 9.3 Cross-source complementarity

Prefer combinations such as:

```text
vocal transform + pad width
synth delay + mallet accent
percussion stereo motion + melodic Ear Candy
filter movement + vocal chop accent
```

Avoid:

```text
three simultaneous melodic embellishments
three separate delay instructions
glitch + stutter + chops on the same vocal
wide bass + wide kick + ping-pong low-end processing
```

### 9.4 Busy-source penalty

A source already carrying a complex role receives a penalty:

```text
primary lead
signature lead
fast arp
existing chop loop
complex glitch texture
multi-layered choir lead
```

This pushes detail toward simpler secondary voices.

### 9.5 Explicit-user-choice priority

If the user explicitly selects a named Vocal Treatment or Space & Movement mode, later resolvers must work around it. Ear Candy is the most disposable system and should give way first.

### 9.6 No-op is valid

A resolver returning no clause is preferable to violating engine identity, exceeding the prompt budget or duplicating a stronger assignment.

---

## 10. Prompt-budget policy

The existing ATMOS 1000-character Style Prompt budget remains authoritative.

### 10.1 Priority order

When compaction is needed, preserve content in approximately this order:

1. engine/character identity and tempo/groove anchors;
2. signature/primary lead and protected vocal identity;
3. core cast required for engine identity;
4. essential engine Interplay / Movement already validated;
5. explicit user-selected Vocal Treatment;
6. explicit user-selected Space & Movement;
7. Auto-resolved Vocal Treatment / Space & Movement;
8. Ear Candy;
9. secondary adjective/detail redundancy.

### 10.2 Compaction before dropping

Each resolver must provide compact prose variants. Before dropping an explicit user-selected treatment:

1. remove semantic duplicate phrases;
2. use the compact renderer;
3. remove lower-priority Ear Candy;
4. remove Auto-only secondary movement;
5. only then suppress an explicit treatment if the prompt still cannot validate.

If an explicit selection is suppressed, show it in the validation report.

### 10.3 One-voice-one-mention

Existing ATMOS testing found that repeated naming can produce duplicated rendered voices. Attach-clauses should therefore refer to already-named sources economically rather than restating long instrument descriptors. Do not create multiple differently-qualified duplicate mentions of the same underlying source unless the engine explicitly intends multiple instances.

---

## 11. Engine-specific Ear Candy policies retained from v1.0

The following v1.0 engine rules remain binding for Ear Candy and also inform the newer resolvers.

### Engine policy: Balearic

#### 20.1 Source-derived constraints

Balearic Atom is warm, groove-led and deliberately non-orchestral. Its audit found convention bleed from named orchestral sources. The colour role already contains background-only decorative instruments. Its placement language needs explicit prominence control.

If the current app uses Balearic Legacy rather than Atom, preserve its full sentence-form strings and use the legacy sidecar/append strategy.

#### 20.2 Preferred existing candidates

**Very high priority**

- synth bells
- glassy mallet synth
- synth marimba
- glockenspiel
- vibraphone
- kalimba
- celeste
- marimba
- synth counter-line

**High priority**

- Rhodes
- Wurlitzer
- felt piano
- grand piano
- clavinet
- nylon guitar
- lap-steel guitar
- acoustic guitar
- clean electric guitar
- delayed electric guitar
- synth pluck
- synth arp
- synth motif
- soft synth lead
- shakers
- congas
- bongos
- cabasa
- tambourine
- rimshot clicks
- electro shaker

**Spatial-only or lower-priority**

- analog/sustained pad sources
- drone synth
- granular synth
- synth strings
- string-machine ensemble

#### 20.3 Preferred capability mapping

| Existing source/family | Preferred Ear Candy |
|---|---|
| vibraphone / kalimba / marimba / celeste / bells | isolatedAccent, phraseAnswer, stereoThrow |
| Rhodes / Wurlitzer / piano | phraseAnswer, graceNote, delayThrow |
| guitar family | phraseAnswer, delayThrow, filterTail |
| synth pluck / arp / motif / counter | shortFragment, phraseAnswer, filterTail, stereoThrow |
| shakers / light percussion | phraseEndingFill, pickupFill, densityFlutter |
| pad / drone / texture | reverbBloom, filterTail, widthBloom |
| synth strings / string-machine | shortSwell only when already a support layer |

#### 20.4 Balearic hard denials

Ear Candy MUST NOT resurrect parked/expert material, including the engine's excluded orchestral/wind/brass families, merely because a capability would sound decorative.

Do not introduce:

- cello/viola/violin as new Ear Candy;
- French horn, trumpet/flugelhorn, trombone, synth brass;
- harp;
- pipe organ;
- orchestral hits/stabs/fanfare vocabulary;
- pan flute/flute/saxophone as a new colour source;
- duduk/ney as generic world-music decoration;
- accordion/harmonium/melodica from the parked free-reed family.

If a frozen Legacy Balearic string already contains material the newer Atom engine would now park, Ear Candy does not silently “correct” the legacy source. It simply must not add new conflicting behaviour around it.

#### 20.5 Example outputs

> `Vibraphone adds occasional low-level accents at selected phrase endings, kept behind the lead.`

> `Selected Rhodes notes trail into short tempo-synced delays at occasional phrase endings.`

> `Shakers add brief phrase-ending flourishes while the core groove remains unchanged.`

> `The existing analog pad briefly widens around selected phrase endings before receding.`

---

### Engine policy: Enigma

#### 21.1 Source-derived constraints

Enigma is legacy/preset-driven. Preserve its native “Enigma Style” genre anchor and existing preset sentences. Several presets intentionally mix acoustic and electronic sources. The Tribal worldbeat preset explicitly excludes sitar.

#### 21.2 Existing candidates visible in the current/project data

- breathy shakuhachi / flute motifs
- acoustic steel-string guitar where present
- duduk where present
- church bells / bell and chime accents
- vibraphone
- analogue synth motifs
- rhythmic tonal motifs
- Gregorian chant fragments
- male vocal tonal accents
- processed atmospheric fragments
- reversed tonal swells
- analogue/ambient pads
- string beds where already native to the preset
- oboe phrases where already present in the legacy source
- synthetic brass swell only where already present in the legacy source

#### 21.3 Preferred capability mapping

| Existing source | Preferred Ear Candy |
|---|---|
| shakuhachi / flute / duduk / oboe | phraseAnswer, delayThrow, reverbBloom |
| steel-string guitar | phraseAnswer, delayThrow, filterTail |
| bells / chimes / vibraphone | isolatedAccent, stereoThrow, reverbBloom |
| synth motif / tonal motif | shortFragment, delayThrow, filterTail |
| chant fragments / male vocal accents | vocalResponse, shortFragment |
| processed atmospheric fragments | shortFragment, stereoThrow |
| pad/string bed | reverbBloom, widthBloom, shortSwell |
| reversed tonal source | reversePull only if Movement does not already provide it |

#### 21.4 Enigma hard denials

- never add sitar;
- never add a new “world” instrument because it seems plausible;
- do not rewrite legacy source strings;
- do not duplicate existing Rhythmic Delay / Cathedral Depth / Controlled Spatial movement;
- do not turn dominant Gregorian chant into a secondary vocal-response instruction if it is already the main identity-bearing feature.

#### 21.5 Example outputs

> `Selected shakuhachi notes leave brief delayed echoes at occasional phrase endings.`

> `Bell and chime accents appear as occasional low-level punctuation in open spaces.`

> `Existing chant fragments return as brief distant responses, never as a second lead.`

> `A few processed atmospheric fragments move momentarily across the stereo field.`

---

### Engine policy: Delerium

#### 22.1 Source-derived constraints

Delerium is a resolver-kind engine whose current identity is its album-era evolution, not the famous trance-remix identity. Its architecture already uses attach-clauses. It carries explicit defense against trance, four-on-the-floor club production, EDM drops, supersaws, hard kicks, festival synths and related drift.

#### 22.2 Preferred existing candidates

- glassy digital pads
- glassy FM crystalline pads
- warm analogue polysynth swells
- vocal-synth pads
- cathedral-reverb pads
- reversed pad material
- felt-mallet resonant beds
- piano
- sampled ethnic vocal chops
- breathy female vocal textures
- vocoded wordless vocal pads
- choir textures
- chant textures
- light/hand percussion
- sustained guitar
- long-breath wind voices
- secondary string/cello textures where already present

#### 22.3 Preferred capability mapping

| Existing source | Preferred Ear Candy |
|---|---|
| glassy/FM/analogue pad | reverbBloom, filterTail, widthBloom |
| reversed pad source | reversePull if not already used |
| vocal/choir/chant texture | vocalResponse, reverbBloom, widthBloom |
| felt mallet / piano | isolatedAccent, phraseAnswer, delayThrow |
| hand/light percussion | phraseEndingFill, pickupFill |
| sustained guitar/wind | delayThrow, reverbBloom, phraseAnswer if secondary |
| secondary strings/cello | shortSwell, reverbBloom |

#### 22.4 Delerium hard denials

Do not introduce Ear Candy language that implies:

- EDM build;
- riser-to-drop architecture;
- festival impact;
- supersaw accent;
- big-room transition;
- hard club escalation;
- repeated transition marker at every section.

#### 22.5 Example outputs

> `The glassy pad briefly widens around selected phrase endings before receding into the field.`

> `Existing wordless vocal textures return occasionally as brief distant responses.`

> `Selected piano notes trail into short delays in otherwise open spaces.`

> `An occasional reversed fragment of the existing pad draws softly into selected transitions.`

---

### Engine policy: ERA

#### 23.1 Source-derived constraints

ERA is the load-bearing exception to the project's usual anti-orchestral rules. The engine deliberately includes orchestral hits, choir stabs, brass stabs, string ostinati, cello/contrabass ostinati and Carmina-Burana-adjacent orchestral/choral language where character-appropriate.

The Ear Candy system MUST therefore use engine-relative rules rather than one global blacklist.

#### 23.2 Preferred existing candidates

- orchestral hit
- choir stab
- brass stab
- harp
- high strings / string section
- solo violin/cello where not protected as current lead
- oboe where already present
- choir layers
- pipe organ / orchestral pad where already present
- orchestral percussion / timpani where character is rhythmic
- synth pulse where present
- electric guitar only in characters that actually permit it

#### 23.3 Preferred capability mapping

| Existing source | Preferred Ear Candy |
|---|---|
| orchestral hit / choir stab / brass stab | orchestralPunctuation |
| harp | harpFlourish, phraseAnswer |
| string section / high strings | shortSwell, widthBloom, reverbBloom |
| solo oboe / violin / cello when secondary | phraseAnswer, graceNote, reverbBloom |
| choir | vocalResponse, shortSwell, reverbBloom; choir-stab punctuation only when character supports it |
| pipe organ / sustained orchestral bed | reverbBloom, widthBloom |
| timpani / orchestral percussion | pickupFill, phraseEndingFill only on non-beatless characters |
| synth pulse | shortFragment, filterTail |
| existing guitar where character permits | phraseAnswer, delayThrow |

#### 23.4 Character exceptions

**Cathedral Overture**

- beatless: no percussion Ear Candy;
- favour harp flourish, short string swell, oboe/solo voice answer, choir/organ reverb bloom;
- avoid turning a heroic brass lead into repeated punctuation.

**Cinematic Mass**

- orchestralPunctuation is strongly permitted;
- choir/brass/orchestral accents may be more assertive than in other engines, but still selective.

**Driving Epic**

- preserve the documented no-rock/guitar defense;
- never add guitar Ear Candy if guitar is absent;
- favour string/synth/percussion/choir sources already in the cast.

#### 23.5 Example outputs

> `Brief choir-stab accents punctuate selected phrase endings without becoming a repeating hook.`

> `A short harp flourish occasionally answers the lead line before returning to the orchestral bed.`

> `High strings add brief swells behind selected transitions.`

> `Selected brass accents provide isolated punctuation at a few structural moments rather than every transition.`

---

### Engine policy: Sacred Spirit

#### 24.1 Source-derived constraints

Sacred Spirit is resolver-kind and `signatureLead: true`. Cedar flute and solo cello are identity-bearing sources. Chant functions as musical material, never spoken narration or field recording. Winter Ceremony uses a heartbeat-like drum concept rather than a conventional groove.

#### 24.2 Preferred existing candidates

- light rattles
- frame drum / hand percussion
- ocarina
- low drone-flute
- grand piano
- Rhodes-style electric piano
- nylon guitar
- synth lead
- synth arpeggio
- glassy FM bell
- chopped chant fragments / chant hook when already present
- pads/drones
- cedar flute or solo cello only if the selected instance is not the protected primary lead

#### 24.3 Preferred capability mapping

| Existing source | Preferred Ear Candy |
|---|---|
| rattles / light hand percussion | phraseEndingFill, densityFlutter, pickupFill |
| ocarina / drone-flute | phraseAnswer, reverbBloom, delayThrow |
| piano / Rhodes | phraseAnswer, graceNote, delayThrow |
| nylon guitar | phraseAnswer, delayThrow, filterTail |
| synth lead / arp | shortFragment, filterTail, stereoThrow |
| glassy FM bell | isolatedAccent, stereoThrow, reverbBloom |
| chant fragments | vocalResponse, shortFragment |
| pad/drone | reverbBloom, widthBloom |
| cedar flute / solo cello as secondary only | phraseAnswer or reverbBloom with a large scoring penalty |

#### 24.4 Signature-lead protection

If `signatureLead: true` and the candidate occupies the lead slot:

```text
Ear Candy eligibility = false
```

Do not turn the primary cedar flute or cello into decorative background material.

If the same instrument appears in a genuinely secondary/counter role, it may be considered with a reduced score.

#### 24.5 Character exceptions

**Ceremonial Prelude**

- beatless: no percussion;
- favour drone/choir/secondary wind spatial details.

**Winter Ceremony**

- do not convert the heartbeat drum into busy fill behaviour;
- light rattles may add very brief selected details;
- do not accelerate the ceremonial pulse.

**Circle Dance**

- rhythmic Ear Candy is permitted but must remain tribal/circle-groove consistent;
- no EDM festival-drop language.

#### 24.6 Vocal hard rule

Any `vocalResponse` prose for Sacred Spirit must preserve:

> chant as musical texture, not speech or narration.

#### 24.7 Example outputs

> `Light rattles add brief phrase-ending flourishes around selected phrases while the ceremonial pulse remains unchanged.`

> `The existing ocarina offers occasional short answering notes with long decaying tails.`

> `Selected nylon-guitar notes leave brief delayed tails between chant phrases.`

> `Existing chopped chant fragments return as brief musical responses, never as spoken narration.`

---

### Engine policy: Deep Forest

#### 25.1 Source-derived constraints

Deep Forest is resolver-kind and `signatureLead: true`. Character identity is album/region-derived, not tempo-derived. Kalimba, cimbalom, steel pan and other character-specific voices may be signature leads. Literal forest ambience, field recordings, nature sounds and foley are forbidden. Bohemian Fusion has a tested tempo-drift failure mode and explicit tempo/genre defenses.

#### 25.2 Preferred existing candidates

- kalimba
- marimba
- cimbalom
- steel pan
- nylon guitar
- hand percussion / congas
- chant fragments / chopped chant / looped chant
- folk violin or accordion where already present in the appropriate character and not the primary signature lead
- house piano riff where already present in Tribal Dance and not the protected primary hook
- pads/synth textures
- existing brass in Comparsa where present, using non-fanfare behaviour

#### 25.3 Preferred capability mapping

| Existing source | Preferred Ear Candy |
|---|---|
| kalimba / marimba / cimbalom / steel pan when secondary | isolatedAccent, phraseAnswer, graceNote, stereoThrow |
| nylon guitar | phraseAnswer, delayThrow, filterTail |
| hand percussion / congas | phraseEndingFill, pickupFill, densityFlutter |
| chant fragments | vocalResponse, shortFragment |
| folk violin when secondary | phraseAnswer, shortSwell, reverbBloom |
| accordion when already native to Bohemian character | phraseAnswer, graceNote; no new accordion elsewhere |
| house piano riff when not primary | isolatedAccent, shortFragment |
| pads/synth textures | reverbBloom, filterTail, widthBloom |
| existing Comparsa brass when secondary | isolatedAccent only; never fanfare language |

#### 25.4 Signature-lead protection

If kalimba/cimbalom/steel pan/etc. is the resolved signature lead, Ear Candy must not repurpose it as a low-level decorative voice. Choose another cast member.

#### 25.5 Deep Forest hard denials

Ear Candy MUST NOT add:

- nature sounds;
- forest ambience;
- birds/water/wind field recordings;
- foley;
- literal environmental texture;
- orchestral fanfare.

#### 25.6 Bohemian Fusion guard

For Bohemian Fusion:

- do not generate breakbeat/double-time wording;
- do not increase drum density in a way that suggests acceleration;
- avoid `pickupFill` if the wording implies a tempo push;
- prefer melodic/spatial Ear Candy over aggressive rhythmic Ear Candy;
- preserve the existing one-steady-tempo directive and negative list.

#### 25.7 Example outputs

> `The existing kalimba adds occasional one- or two-note answers between chant phrases.`

> `Congas add brief phrase-ending fills while the core groove remains unchanged.`

> `Existing chant fragments return as short rhythmic responses rather than a new vocal lead.`

> `Cimbalom adds isolated upper-register punctuation in selected open spaces, kept secondary to the main lead.`

---

### Beatless-character rules

Every engine has at least one beatless/ambient character or preset. For a beatless selection:

#### MUST suppress

- phraseEndingFill
- pickupFill
- densityFlutter
- core-drum treatment
- wording that implies a beat, groove lift or rhythmic transition if no beat exists

#### Prefer

- isolatedAccent
- phraseAnswer
- delayThrow
- reverbBloom
- filterTail
- reversePull where engine-native
- stereoThrow
- widthBloom
- vocalResponse
- shortSwell
- harpFlourish / orchestral punctuation only where ERA character policy allows and the source already exists

---

### Protection hierarchy

When deciding whether a source may receive Ear Candy, apply protection in this order:

1. **Engine hard denial**
2. **Character hard denial**
3. **Signature lead protection**
4. **Beatless protection**
5. **Reliability tier / expert parking**
6. **Primary lead/hook protection**
7. **Existing behaviour overlap**
8. **Movement/Interplay duplication**
9. **Negative-prompt collision**
10. **Prompt-budget availability**
11. **Scoring and variety**

Hard exclusions are not overridable by a higher Ear Candy intensity setting.

---

---

## 12. Integrated engine policy for Space & Movement and Vocal Treatment

The matrices below contain two kinds of information:

- **Source-derived constraints**: inherited from the current engine files and must be preserved.
- **New v2.0 design permissions**: implementation decisions intended to fit those constraints; these require Suno A/B validation and may be tuned without rewriting engine identity.

### 12.1 Balearic

**Source-derived anchors:** groove-led, keys/guitars/synths, electronic drum-machine vocabulary is already first-class; non-orchestral identity is load-bearing; prompt position and duplicate naming affect prominence; the current engine includes movement concepts such as stereo sweep, delay cascade, autopan groove and modulation flow.

**Space & Movement preferences:**

- preferred: restrained ping-pong/digital delay on plucks/arps/counterlines, slow chorus on pads/keys, gentle stereo movement on hats/aux perc, slow filter evolution on synth layers;
- contextual: phaser on synth/guitar in Dreamy Analog, Dub Space, Deep Nocturnal, Nu-disco and house-oriented characters;
- restricted: resonant filter motion; must not drift into acid/rave convention;
- deny: widening/delay on kick or sub-bass, orchestral-style cinematic movement language.

**Vocal Treatment v2 design policy:**

| Treatment | Default | Character guidance |
|---|---|---|
| Vocoder | allowed, restrained | strongest in Dreamy Analog, Deep Nocturnal, Nu-disco, Balearic/Deep/Lounge house; secondary elsewhere |
| Talkbox | contextual | only when an existing synth/electric-guitar carrier is present; strongest in Nu-disco/slo-mo and house-adjacent characters |
| Vocal Chops | allowed | best in electronic/house/nocturnal characters; keep sparse in organic/sunlit characters |
| Stutter | restricted | short phrase-ending edits only in electronic/house characters |
| Glitch | restricted | controlled micro-edits only; avoid Ambient Beatless and Organic Warm by default |

### 12.2 Enigma

**Source-derived anchors:** legacy/preset structure; source strings are load-bearing; `no sitar, ever` for the Enigma engine's documented tribal-worldbeat content; vocal setup includes chant, breathy female and Cretu-style male accent behaviours; movement is already an explicit engine dimension.

**Space & Movement preferences:**

- preferred: deep spatial delay, restrained rhythmic delay, slow filter motion, broad atmospheric width;
- contextual: chorus/phaser on electronic synth layers in later electronic presets;
- avoid duplicating existing Cathedral Depth / Rhythmic Delay / movement selections;
- legacy rendering must append, never rewrite existing sentence-form source content.

**Vocal Treatment v2 design policy:**

| Treatment | Default | Guidance |
|---|---|---|
| Vocoder | contextual | later electronic / modern synth-pop / cosmic material; background layer rather than replacing signature vocal phrasing |
| Talkbox | default deny | not part of current source identity; do not add for variety |
| Vocal Chops | contextual | where sampled/chant-fragment behaviour is already present; keep away from solemn Gregorian lead passages unless source preset supports it |
| Stutter | restricted | later electronic/heavy-break contexts only; short accents |
| Glitch | restricted | modern electronic contexts only; controlled micro-edits, not noisy artifacts |

### 12.3 Delerium

**Source-derived anchors:** album-era identity, not trance-remix identity; attach-clauses are native architecture; existing pools already contain vocoded wordless vocal pad, granular vocal drone and sampled ethnic vocal chops in appropriate characters.

**Space & Movement preferences:**

- strong engine for width/depth, ping-pong/digital delay, chorus, phaser, slow filter motion and stereo modulation;
- respect existing Delerium movement/interplay; do not add trance/EDM lift vocabulary;
- Firefly may support more active motion but still must not become a club/trance remix.

**Vocal Treatment policy:**

| Treatment | Default | Guidance |
|---|---|---|
| Vocoder | preferred | Ethereal and Firefly are especially strong because vocoded wordless treatment already exists in source pools |
| Talkbox | default deny / experimental only | not source-native enough for automatic use |
| Vocal Chops | preferred/contextual | Worldbeat Ritual, Ethereal, Firefly; sampled ethnic vocal chops already source-derived |
| Stutter | allowed, restrained | Firefly/Ethereal; keep phrase-scale and non-EDM |
| Glitch | allowed, restrained | Firefly/Ethereal; micro-edit, not harsh digital destruction |

### 12.4 ERA

**Source-derived anchors:** orchestral/cinematic vocabulary is deliberately legal; Cathedral Overture is beatless and orchestral; Cinematic Mass has choir/colour stabs; Driving Epic is electronic-forward but explicitly no rock/guitar content.

**Space & Movement preferences:**

- Cathedral Overture: depth/reverb/controlled width only; no rhythmic delay/pan gimmicks;
- Neo-Gregorian Anthem: restrained depth, width, occasional synth support motion;
- Ethereal Ballad: soft synth-pad width/chorus/filter movement is allowed;
- Cinematic Mass: orchestral depth/width; electronic pulse may accept filter motion;
- Driving Epic: synth pulse may take filter/rhythmic movement, but no guitar-derived processing.

**Vocal Treatment v2 design policy:**

| Treatment | Default | Guidance |
|---|---|---|
| Vocoder | restricted/contextual | only as a secondary electronic vocal texture in Ethereal Ballad or Driving Epic; never replace the signature choir by default |
| Talkbox | deny | wrong source convention and Driving Epic forbids guitar content |
| Vocal Chops | contextual | chant stabs already exist in Cinematic Mass; treat those as native chopped/sectional voice rather than trendy pop chops |
| Stutter | default deny | may be revisited only after testing a specific electronic-forward character |
| Glitch | default deny | same reasoning; preserve orchestral/choral identity |

### 12.5 Sacred Spirit

**Source-derived anchors:** `signatureLead: true`; cedar flute/cello signature; chant is music, never spoken word/field recording; Shamanic Elevation already includes chopped chant vocal stabs and is the most synth-forward character.

**Space & Movement preferences:**

- preferred: soft stereo delay on secondary electronic layers, gentle width, slow filter motion on Shamanic Elevation synths, restrained delay tails on guitar/pluck;
- ceremonial/heartbeat characters: depth and stillness rather than obvious cyclic/rhythmic FX;
- never use processing to turn the cedar-flute/cello signature lead into a generic electronic effect by default.

**Vocal Treatment policy:**

| Treatment | Default | Guidance |
|---|---|---|
| Vocoder | restricted | Shamanic Elevation only by default, as secondary texture |
| Talkbox | deny | not source-derived |
| Vocal Chops | preferred where source supports | Shamanic Elevation; Chant Groove may use looped/chopped derived accents conservatively |
| Stutter | restricted | Circle Dance/Shamanic Elevation only, brief and secondary |
| Glitch | restricted | same; no glitching of ceremonial elder chant by default |

### 12.6 Deep Forest

**Source-derived anchors:** `signatureLead: true`; voice is often used as an instrument; chopped chant stabs and looped chant hooks are explicitly part of the electronic-use taxonomy; literal nature sounds/field recordings/foley are forbidden; Bohemian Fusion has a tempo-instability guard.

**Space & Movement preferences:**

- preferred: rhythmic echoes on mallets/synths, stereo percussion movement, filter motion on electronic support, depth around vocal textures;
- Forest Nocturne: slow width/filter/depth only;
- Tribal Worldbeat: do not let motion imply house/club remix;
- Bohemian Fusion: avoid movement language that suggests double-time, breakcore or acceleration.

**Vocal Treatment policy:**

| Treatment | Default | Guidance |
|---|---|---|
| Vocoder | contextual | electronic support in Sweet Chillout/Tribal Dance or post-2005 colour; not a universal lead treatment |
| Talkbox | deny | not source-derived |
| Vocal Chops | preferred | already source-native: chopped chant stabs / looped chant hooks; can be a feature where character supports it |
| Stutter | contextual | strongest in Tribal Dance; avoid Bohemian Fusion until tempo-stability testing proves safe |
| Glitch | contextual | Tribal Dance/electronic material; avoid turning regional vocal identity into generic EDM glitch |

---

## 13. Beatless and low-density rules across all three resolvers

When `beatless: true`:

### Vocal Treatment

- Vocoder may be used only as a sustained/slow texture if engine-appropriate.
- Talkbox should normally be disabled.
- Vocal Chops are normally suppressed unless the source character already has non-rhythmic fragmented voice as part of its identity.
- Stutter and rhythmic glitch are suppressed.

### Space & Movement

Prefer:

```text
reverbDepth
widthBreath
slowFilterSweep
chorusMovement
very slow phaserMovement (engine-dependent)
```

Suppress or heavily penalise:

```text
rhythmicFilterPulse
autoPan tied to beat
tempoSyncedDelay that implies groove
rapid pingPongDelay
```

### Ear Candy

Retain the v1.0 beatless rules: sparse tonal accents, swells and spatial tails are safer than percussion fills or groove-signalling activity.

---

## 14. Vocal Treatment, Lyrics and Metatags consumer contract

### 14.1 Existing project order is correct

The current unified lyric handoff already states:

```text
Style Prompt comes first.
Lyrics are generated second.
Once lyrics are accepted, Style Prompt output + selected style state guide lyric metatags and section labels.
```

Version 2.0 preserves that order.

### 14.2 What the Style Prompt must contain

The Style Prompt is the authority for **what sonic treatment exists**:

```text
vocoder layer
vocal chops
stutter treatment
controlled vocal micro-edits
ping-pong delay
filter evolution
etc.
```

### 14.3 What Metatags should do

Metatags may stage or localise a treatment that was already resolved upstream.

Examples:

```text
[Vocoder backing layer]
[Vocal chops]
[Brief vocal stutter]
[Filtered vocal break]
[Glitched vocal fragments]
```

Metatags must not independently invent a new treatment that the Style system did not select, unless the lyric engine has an explicit user override for that purpose in a future version.

### 14.4 Persistent versus sectional treatment

If Vocal Treatment is intended to persist broadly (for example a low-mixed vocoded backing texture), the Style Prompt may be sufficient and metatag use should be minimal.

If it is event/sectional (stutter, glitch, chops), the resolver should emit `metatagHints` containing preferred section placement concepts. The lyric/metatag engine decides where they fit the accepted structure.

### 14.5 Metatag hints object

```js
{
  vocalTreatment: "stutter",
  persistence: "event",
  preferredSections: ["post_chorus", "bridge", "outro"],
  avoidSections: ["verse_1_opening"],
  tagOptions: [
    "[Brief vocal stutter]",
    "[Stuttered vocal tail]"
  ],
  maxTags: 2
}
```

### 14.6 Do not over-tag

A Style Prompt decision does not need a tag beside every lyric section. Default metatag budgets:

- persistent treatment: 0–1 treatment tags;
- sectional chops/stutter/glitch: 1–2 treatment tags;
- special engine-native chant/chop structures: up to 3 only where the structure genuinely changes.

### 14.7 Instrumental mode

If instrumental mode is active:

- Vocal Treatment = Off;
- no vocal-treatment metatags;
- Ear Candy and Space & Movement may still operate on instruments.

---

## 15. Unified state model

Recommended additions:

```js
state.detailMovement = {
  earCandy: "off",            // off | subtle | balanced | active
  spaceMovement: "off",       // off | auto | widthDepth | rhythmicMotion | modulatedMotion | filterEvolution
  vocalTreatment: "off"       // off | auto | vocoder | talkbox | vocalChops | stutter | glitch
};
```

Resolved state should be separate from UI intent:

```js
state.resolvedDetail = {
  vocalTreatment: null,
  spaceMovement: [],
  earCandy: [],
  conflicts: [],
  compacted: [],
  metatagHints: []
};
```

Do not overwrite user intent with the resolver result.

---

## 16. Normalised context object

A single context should be passed through all three resolvers:

```js
const detailContext = {
  baseBuildSeed,
  engineId,
  engineKind,           // atom | resolver | legacy
  characterId,
  palette,
  beatless,
  energy,
  tempo,
  maxMode,

  cast: [ /* normalised source objects */ ],
  vocalSources: [ /* normalised vocal roles */ ],
  baseMovement: [],
  interplay: [],
  negativePrompt: [],
  promptBudget: {
    maxChars: 1000,
    currentBaseChars: 0
  },

  uiIntent: {
    earCandy: "balanced",
    spaceMovement: "rhythmicMotion",
    vocalTreatment: "vocalChops"
  },

  enginePolicy,
  characterPolicy
};
```

---

## 17. Engine policy configuration model

Recommended shape:

```js
const enginePolicy = {
  earCandy: {
    allow: [],
    deny: [],
    roleWeights: {},
    sourceOverrides: {}
  },

  spaceMovement: {
    allowedModes: ["auto", "widthDepth", "rhythmicMotion"],
    allow: [],
    deny: [],
    sourceOverrides: {},
    patchOverrides: {},
    characterOverrides: {}
  },

  vocalTreatment: {
    allowed: ["vocoder", "vocalChops"],
    denied: ["talkbox"],
    rolePermissions: {},
    carrierFamilies: ["synth_lead", "electric_guitar"],
    personaProtection: true,
    characterOverrides: {}
  }
};
```

Legacy engines may use sidecar maps keyed by stable source/preset IDs.

---

## 18. Resolver algorithms

### 18.1 Vocal Treatment

```js
function resolveVocalTreatment(ctx) {
  if (ctx.uiIntent.vocalTreatment === "off") return null;
  if (ctx.vocalSources.length === 0) return null;

  const requested = ctx.uiIntent.vocalTreatment;
  const treatment = requested === "auto"
    ? chooseAutoTreatment(ctx)
    : requested;

  if (!engineAllowsVocalTreatment(ctx, treatment)) {
    return noOp("engine-policy-deny");
  }

  const targets = eligibleVocalTargets(ctx, treatment);
  if (!targets.length) return noOp("no-eligible-vocal-target");

  if (treatment === "talkbox" && !eligibleTalkboxCarriers(ctx).length) {
    return noOp("talkbox-requires-existing-carrier");
  }

  const target = weightedPick(targets, deriveSeed(ctx.baseBuildSeed, "vocal-treatment"));
  const subtype = chooseTreatmentSubtype(ctx, treatment, target);
  const rendered = renderVocalTreatment(ctx, treatment, subtype, target);

  return { treatment, subtype, target, rendered, semanticTags: tagsFor(treatment, subtype) };
}
```

### 18.2 Space & Movement

```js
function resolveSpaceMovement(ctx, vocalResult) {
  if (ctx.uiIntent.spaceMovement === "off") return [];

  const candidates = buildSpaceMovementCandidates(ctx, vocalResult)
    .filter(c => engineAllowsMovement(ctx, c))
    .filter(c => !duplicatesBaseMovement(ctx, c))
    .filter(c => !conflictsWithVocalTreatment(vocalResult, c));

  const scored = candidates.map(c => ({ ...c, score: scoreMovementCandidate(ctx, c) }));
  const best = stableWeightedPick(scored, deriveSeed(ctx.baseBuildSeed, "space-movement"));

  return best ? [best] : [];
}
```

### 18.3 Ear Candy

Use the v1.0 algorithm but add the earlier resolver results to its conflict context:

```js
function resolveEarCandy(ctx, vocalResult, movementResults) {
  // v1 candidate construction and scoring
  // plus penalties for semantic dimensions already consumed above
}
```

### 18.4 Cross-resolver compaction

```js
function resolveDetailSystem(ctx) {
  const vocal = resolveVocalTreatment(ctx);
  const movement = resolveSpaceMovement(ctx, vocal);
  const earCandy = resolveEarCandy(ctx, vocal, movement);

  const merged = dedupeAndResolveConflicts({ vocal, movement, earCandy, ctx });
  return compactToPromptBudget(merged, ctx.promptBudget);
}
```

---

## 19. Legacy-engine adapter rules

Legacy source sentences are load-bearing.

### 19.1 Sidecar metadata

```js
legacyMeta[stableId] = {
  role: "motif",
  family: "guitar",
  patch: { voiceType: "guitar_clean" },
  behaviourTags: ["motif", "intermittent"],
  earCandyCapabilities: ["delayThrow"],
  spaceMovementCapabilities: ["shortDigitalDelay"],
  vocalTreatmentCapabilities: []
};
```

### 19.2 Rendering

```text
ORIGINAL LEGACY SENTENCE + short compatible attach-clause
```

Never:

```text
LLM paraphrase of the original sentence
```

### 19.3 Conflict detection

Because legacy prose may already encode effects or movement, sidecar `behaviourTags` must be populated for known validated sentences. Text parsing is fallback only.

---

## 20. UI / UX specification

### 20.1 Recommended panel

Use one compact section titled **Detail & Movement**.

```text
Detail & Movement

Ear Candy          [ Off ▼ ]
Space & Movement   [ Off ▼ ]
Vocal Treatment    [ Off ▼ ]
```

### 20.2 Conditional behaviour

- Vocal Treatment row disabled in Instrumental mode.
- Talkbox option disabled if no existing eligible carrier after cast resolution.
- Engine-denied Vocal Treatment options may be disabled with a short tooltip/reason.
- Do not hide denied options completely if doing so would make saved-state behaviour confusing; disabled is preferable.

### 20.3 User-facing labels versus internal terminology

Use simple labels in UI. Keep technical IDs internal.

Example:

```text
UI: Filter Evolution
Internal candidates: slowFilterSweep | filterLfo | resonantFilterMotion
```

### 20.4 Build summary

The summary may show compact resolved values:

```text
Ear Candy: Balanced · vibraphone accent + pad bloom
Space & Movement: Rhythmic Motion · synth counterline ping-pong delay
Vocal Treatment: Vocal Chops · sparse phrase fragments
```

This is for transparency/debugging. The normal user should not need to edit those internal selections.

### 20.5 Validation feedback

Warnings should be factual and non-blocking where possible:

```text
Talkbox unavailable: the current cast contains no eligible synth/guitar carrier.
Vocal Treatment reset to Off because Instrumental mode is active.
Ear Candy reduced from 2 to 1 treatment to stay within the Style Prompt budget.
```

---

## 21. Migration from Composer / Producer / Remixer

### 21.1 Remove/deprecate old modifier paths

Audit and remove or isolate:

```text
Composer modifier state
Producer modifier state
Remixer modifier state
overlay prompt fragments
modifier-specific negative merges
modifier UI controls
saved preset fields
modifier randomisation paths
```

Do not delete old code before baseline fixtures are captured.

### 21.2 Saved-state migration

For saved states containing old modifier selections:

```js
{
  earCandy: "off",
  spaceMovement: "off",
  vocalTreatment: "off"
}
```

Do not attempt to algorithmically translate “Producer X” into effects. That would reproduce the abandoned abstraction by stealth.

### 21.3 New saved-state compatibility

If a saved v2 state is loaded into an engine/character where a treatment is no longer allowed after policy changes:

- keep the original saved value in migration metadata;
- resolve UI to Off/disabled;
- show a concise compatibility note;
- do not silently substitute a different treatment.

---

## 22. Suggested module/file boundaries

Names are illustrative; adapt to current repository conventions.

```text
js/
  detail/
    seed.js
    normalise-source.js
    patch-classifier.js
    drum-voice-normaliser.js

    ear-candy-data.js
    ear-candy-resolver.js

    space-movement-data.js
    space-movement-resolver.js

    vocal-treatment-data.js
    vocal-treatment-resolver.js

    detail-conflicts.js
    detail-budget.js
    detail-renderer.js
    detail-validation.js

  engine-policies/
    balearic-detail-policy.js
    enigma-detail-policy.js
    delerium-detail-policy.js
    era-detail-policy.js
    sacred-spirit-detail-policy.js
    deep-forest-detail-policy.js

  lyrics/
    metatag-resolver.js
```

Do not force this folder structure if the current app has a different clean modular architecture. Preserve current repo conventions where they are sound.

---

## 23. Validation requirements

### 23.1 Structural validation

Must verify:

- all three UI values are valid enums;
- Vocal Treatment is Off in Instrumental mode;
- Talkbox has an eligible existing carrier;
- no Ear Candy-added source is absent from the cast;
- no protected signature source was replaced;
- no resolver changed the base cast seed/state;
- no duplicate source mention violates the existing one-voice-one-mention rule;
- final Style Prompt <= existing application budget.

### 23.2 Semantic validation

Check semantic tags rather than exact wording where possible:

```text
no duplicate delay dimension
no duplicate filter-motion dimension
no stutter + glitch + chops stack on one vocal
no bass/kick stereo widening
no engine-denied treatment
no beatless rhythmic-processing violation
no Persona/Voice automatic full-lead replacement
```

### 23.3 Negative-prompt validation

A positive treatment cannot conflict with an active negative.

Example:

```text
positive: vocoder-treated vocal
negative: autotuned vocals
```

These are not necessarily the same concept, so do not use naive substring matching. Use semantic categories and engine-specific exceptions.

When a true collision occurs, the positive explicit user choice does NOT automatically delete the negative; follow the existing narrow `bannedRemove`-style override discipline only when the engine/character explicitly permits it.

### 23.4 Debug report

For every generation, developer/debug mode should be able to show:

```text
base seed
resolved cast
inferred vs explicit patch metadata
vocal target + treatment
space/movement target + capability
ear-candy target(s) + capability(s)
rejected candidates with reason
conflicts resolved
prompt-budget compaction
metatag hints emitted
```

This will substantially reduce future rework.

---

## 24. Acceptance tests

### 24.1 Baseline parity

With all three controls Off, each engine must produce the same Style/Negative output as the captured pre-feature fixture, apart from intentionally removed Composer/Producer/Remixer UI/state fields that do not affect prompt text.

### 24.2 Seed isolation

For one fixed base seed:

```text
Off / Off / Off
Balanced / Off / Off
Balanced / Rhythmic Motion / Off
Balanced / Rhythmic Motion / Vocal Chops
```

The underlying engine cast must remain identical.

### 24.3 Electronic patch tests

Test at minimum:

- sustained synth pad receives pad-compatible movement, not pluck-style ping-pong by default;
- synth pluck/arp can receive rhythmic delay/filter movement;
- drum-machine hat can receive stereo motion while kick remains protected;
- sub-bass is never widened or ping-ponged;
- opaque legacy drum kit is not decomposed unless metadata exists.

### 24.4 Talkbox tests

- existing clean electric guitar → Talkbox selectable;
- existing synth lead/chord carrier → Talkbox selectable;
- no eligible carrier → Talkbox disabled/no-op with reason;
- resolver must not add a guitar/synth to make Talkbox possible.

### 24.5 Vocoder tests

- natural lead + Persona mode + Auto → natural lead remains protected; any vocoder is background/derived;
- Delerium Ethereal existing vocoded voice content → no duplicate second vocoder instruction;
- explicit Vocoder request gets compacted rather than dropped before Ear Candy under budget pressure.

### 24.6 Vocal Chops tests

- Sacred Spirit Shamanic Elevation may resolve chopped chant treatment consistent with existing source pool;
- Deep Forest existing chopped chant source is recognised as already consuming the chop dimension;
- no new singer is introduced;
- primary lyric remains intelligible in normal policy.

### 24.7 Stutter / Glitch tests

- short event only by default;
- no constant whole-song stutter instruction;
- `Glitch` compiles to controlled micro-edit prose rather than vague “glitchy vocals”;
- ERA default-deny path works;
- Deep Forest Bohemian Fusion avoids stutter/glitch unless a future tested override is added.

### 24.8 Space & Movement tests

- existing Movement “tempo-synced delay” blocks duplicate ping-pong/tempo-delay assignment on the same source/dimension;
- Width & Depth on beatless character avoids rhythm-signalling autopan/delay;
- Filter Evolution never outputs bare `LFO`;
- kick/sub protections hold across all engines.

### 24.9 Cross-resolver tests

- Vocal Stutter + Rhythmic Motion does not add another long vocal delay if it would smear the edit;
- Vocoder backing + pad width may coexist;
- Space delay + Ear Candy delay on same source is deduped;
- explicit Vocal Treatment has priority over Ear Candy under budget pressure.

### 24.10 Engine identity regression

Retain all v1.0 Ear Candy engine tests plus:

- Balearic: no orchestral-convention bleed from new effect prose;
- Enigma: `no sitar, ever` remains intact and legacy strings are untouched;
- Delerium: no trance/festival/EDM drift;
- ERA: orchestral vocabulary remains legal where source-derived;
- Sacred Spirit: chant remains music, not narration/field recording; signature lead protected;
- Deep Forest: no literal nature/field recordings; signature lead protected; Bohemian tempo guard preserved.

### 24.11 Metatag tests

- Style Prompt finalises before lyrics/metatags;
- metatag resolver reads resolved detail state;
- Off treatments do not create corresponding tags;
- persistent effects are not spammed into every section;
- sectional stutter/chops/glitch produce at most the configured tag budget;
- instrumental builds emit no vocal treatment tags.

---

## 25. Suno listening-test protocol

Code correctness is not enough. The new language must be tested in Suno because adherence is probabilistic.

### 25.1 Phase A — module isolation

For a fixed engine/seed/cast, generate comparisons:

```text
baseline
+ one Vocal Treatment only
+ one Space & Movement mode only
+ Ear Candy only
```

Judge whether the intended dimension is audible without unrelated identity drift.

### 25.2 Phase B — specific effect vocabulary

Test canonical pairs one variable at a time:

```text
short digital delay vs ping-pong delay
chorus movement vs phaser movement
slow filter sweep vs filter-LFO motion
vocoder accent vs vocoder wordless texture
vocal chops vs phrase-ending stutter
stutter vs controlled vocal micro-glitch
```

Do not change two prose variables simultaneously when comparing.

### 25.3 Phase C — engine coverage

At minimum test each treatment/mode on one compatible character in every engine where it is allowed. Also test one deliberately denied/incompatible character to confirm the application suppresses it before Suno.

### 25.4 Phase D — prompt-position testing

Because existing Balearic testing found prompt position affects prominence, test where each resolver clause renders best:

- after its source's main mention;
- in a small consolidated production-detail clause;
- before mastering/final mix language.

Change position only; keep wording fixed.

### 25.5 Phase E — failure capture

Record:

```text
engine
character
base seed
full Style Prompt
negative prompt
new resolver settings
resolved internal assignment
Suno model/version
generation date
result: pass / weak / ignored / drift / artifact
notes
```

A failed Suno result should change the smallest possible rule or prose variable, not trigger a broad rewrite.

---

## 26. End-to-end worked examples

### 26.1 Balearic electronic build

**Resolved cast (illustrative):**

```text
warm analogue pad
fretless bass
LinnDrum-style kit
shaker
Rhodes motif
synth counter-line
vibraphone colour
female lead vocal
```

**User:**

```text
Ear Candy: Balanced
Space & Movement: Rhythmic Motion
Vocal Treatment: Vocal Chops
```

**Resolver:**

```text
Vocal Treatment → sparse chopped fragments from existing female vocal
Space & Movement → synth counter-line restrained ping-pong delay
Ear Candy → vibraphone phrase-ending accents
```

**Rejected:**

```text
kick delay → protected core kick
Rhodes phraseAnswer → too many melodic detail sources after vibraphone
vocal delay throw → vocal edit dimension already active; would smear chops
```

**Rendered detail concept:**

```text
Short fragments of the existing vocal form sparse rhythmic accents between phrases. The synth counter-line carries restrained tempo-synced ping-pong delay with repeats behind the dry line. Vibraphone appears only as occasional low-mixed phrase-ending accents.
```

### 26.2 Delerium Ethereal

**User:**

```text
Ear Candy: Subtle
Space & Movement: Width & Depth
Vocal Treatment: Vocoder
```

If the base voice pool already contains `vocoded wordless vocal pad`, the Vocal Treatment resolver should recognise the semantic dimension as already present and avoid duplicating the phrase. It may treat the explicit selection as satisfied-by-base-state and report that status.

Space & Movement may then widen/deepen a compatible glassy pad. Ear Candy should choose a non-vocal detail.

### 26.3 Sacred Spirit Shamanic Elevation

**User:**

```text
Ear Candy: Balanced
Space & Movement: Filter Evolution
Vocal Treatment: Vocal Chops
```

Appropriate resolution:

```text
existing chopped chant vocal stabs acknowledged / lightly staged
synth arpeggio receives slow filter evolution
light rattle or FM-bell colour receives small Ear Candy accent
cedar flute/solo cello signature lead remains untouched
```

### 26.4 ERA Cathedral Overture

**User:**

```text
Ear Candy: Balanced
Space & Movement: Auto
Vocal Treatment: Glitch
```

Expected:

```text
Vocal Treatment → denied/no-op by character policy
Space & Movement → depth/width treatment on choir/strings, no rhythmic delay
Ear Candy → harp flourish / restrained orchestral swell if eligible
```

The application should not force `Glitch` merely because the user chose it. The UI ideally disables it for this character before generation.

### 26.5 Talkbox eligibility

**Cast A:**

```text
clean electric guitar + lead vocal
```

Talkbox may resolve:

```text
Selected hook phrases take on a brief talkbox-style talking-instrument contour through the existing clean electric guitar, then return to the natural vocal.
```

**Cast B:**

```text
acoustic piano + strings + lead vocal
```

Talkbox must not invent an electric guitar/synth carrier. Resolve Off/unavailable.

---

## 27. What Claude/Codex must not infer

Do NOT infer that:

- the words `ping-pong delay`, `phaser`, `vocoder`, `glitch`, etc. behave like deterministic DAW controls in Suno;
- every engine should permit every treatment;
- Talkbox and Vocoder are synonyms;
- LFO is an audible effect without naming what it modulates;
- Vocal Chops, Stutter and Glitch are interchangeable;
- Ear Candy should become a catch-all bucket for all processing;
- enabling a detail feature justifies adding a new instrument;
- Persona/Voice identity may be replaced freely;
- legacy sentence-form engine content may be paraphrased;
- negative prompts may be broadly weakened to make a requested effect fit;
- an explicit dropdown must always yield audible output if engine/cast rules say it is incompatible;
- a new resolver is allowed to reroll the base cast;
- a treatment selected in Style should be re-invented independently by the Metatag layer.

---

## 28. Implementation handoff sequence

### Stage 1 — Repository audit

Before editing:

1. locate current engine data and prompt-build functions;
2. identify current modifier code paths;
3. identify state persistence/versioning;
4. identify the existing 1000-character budget/validator;
5. identify current Movement/Interplay rendering;
6. identify vocal mode/descriptor/persona/Voice state;
7. identify Style → lyric/metatag handoff points;
8. capture baseline fixtures for all six engines.

### Stage 2 — Remove/deprecate old modifiers without changing output

Disable Composer/Producer/Remixer state and UI behind feature flags or a reversible migration. Run baseline tests before introducing new prompt content.

### Stage 3 — Add source/patch normalisation

Implement explicit metadata + conservative inference. Do not yet render new effects. Verify normalised cast in debug output.

### Stage 4 — Implement Vocal Treatment

Implement resolver/data/policies with UI still hidden. Unit-test eligibility, Talkbox carrier rules, Persona protection and engine denials.

### Stage 5 — Implement Space & Movement

Implement capability/prose library, scoring, dedupe against base Movement, source/patch safety.

### Stage 6 — Integrate Ear Candy v1.0 into new conflict context

Reuse the existing v1.0 resolver design. Add semantic penalties for Vocal Treatment and Space & Movement dimensions already consumed.

### Stage 7 — Implement cross-resolver budget/validation

No UI exposure until the combined output passes deterministic fixtures and prompt-budget tests.

### Stage 8 — Add UI

Add the three dropdowns in one compact panel. Preserve existing visual language and app simplicity.

### Stage 9 — Add Metatag consumer state

Expose resolved vocal/sectional hints to the lyric/metatag engine after Style Prompt finalisation. Do not change lyric generation behaviour unrelated to this feature.

### Stage 10 — Full regression

Run all six engines with all three controls Off and compare against baseline fixtures.

### Stage 11 — Controlled functional tests

Run the acceptance suite in Section 24.

### Stage 12 — Suno listening validation

Follow Section 25. Record failures as data. Modify one variable at a time.

---

## 29. Definition of Done

Implementation is not complete until all of the following are true:

- Composer/Producer/Remixer modifiers no longer affect prompt generation.
- Existing engine output is unchanged with all new controls Off.
- Ear Candy v1.0 functionality is implemented as a post-cast incidental resolver.
- Electronic sources can carry patch-level metadata sufficient to distinguish pad/pluck/arp/lead/bass/drum-voice behaviour.
- Drum-machine kick/sub/core voices are protected from inappropriate stereo/time effects.
- Space & Movement exists as a separate resolver and user dropdown.
- Vocal Treatment exists as a separate resolver and user dropdown.
- Talkbox requires an existing eligible carrier and never invents one.
- Vocoder, Vocal Chops, Stutter and Glitch use authored, engine-aware prose.
- `Glitch` renders as controlled intentional micro-edit language, not vague artifact language.
- Persona/Voice lead identity is protected from automatic wholesale transformation.
- Delerium's existing vocoded/chopped content is recognised rather than duplicated.
- Sacred Spirit and Deep Forest signature leads remain protected.
- Balearic convention-bleed protections remain intact.
- ERA's deliberate orchestral exception remains intact.
- Enigma legacy strings remain unchanged and its documented exclusions remain intact.
- Deep Forest field-recording and Bohemian tempo guards remain intact.
- Each resolver has its own deterministic sub-seed.
- New controls do not reroll the base cast.
- Cross-resolver semantic dedupe works.
- Final Style Prompt remains within the existing character budget.
- The Style Prompt is final before Lyrics/Metatags are generated.
- Metatags consume resolved treatment state and do not invent conflicting treatments.
- Debug output explains selections, rejections, conflicts and compaction.
- Automated acceptance tests pass.
- Real Suno A/B tests have been recorded before any default is changed from Off.

---

## 30. Project source basis reviewed

This v2.0 design is grounded in the current project knowledge files, including:

- `Balearic-Atom.md` — reliability tiers, electronic drum-kit vocabulary, source roles, convention-bleed testing, prompt-position/duplicate-name findings.
- `Balearic-Legacy.md` — legacy sentence-form architecture, vocal descriptor discipline, narrow negative-prompt override mechanism.
- `Enigma.md` — preset/legacy architecture, vocal descriptor behaviours, documented exclusions including `no sitar, ever`.
- `Delerium.md` — resolver architecture, attach-clauses, source-native vocoder/chop content, explicit anti-trance identity.
- `Era.md` — deliberate orchestral exception, character-specific orchestral/choral and electronic-forward content.
- `Sacred-Spirit.md` — `signatureLead: true`, chant-as-music rule, source-native looped/chopped chant and synth-forward Shamanic Elevation.
- `Deep-Forest.md` — `signatureLead: true`, voice-as-instrument taxonomy, chopped chant/looped hook use, no field recordings, Bohemian tempo guard.
- `unified_suno_style_lyric_engine_codex_handoff.md` — Style Prompt first, lyrics second, metatags generated from accepted style/lyric state.

### 30.1 Source-derived versus new-design content

Claude/Codex must preserve source-derived engine constraints. The following are **new v2 design decisions** and can be tuned only after test evidence:

- exact Space & Movement mode names;
- exact capability weights;
- exact Vocal Treatment allow/deny matrix where the source files do not already contain the treatment;
- exact prose variants;
- exact internal intensity defaults;
- exact metatag budgets;
- exact candidate-score constants.

Do not tune those by rewriting the underlying engine identity.

---

## Appendix A — Recommended initial constants

These are starting values, not source facts.

```js
const ROLE_WEIGHTS = {
  color: 100,
  counter: 92,
  lightPercussion: 88,
  texture: 82,
  pad: 70,
  harmony: 62,
  lead: 35,
  signatureLead: -999,
  coreKick: -999,
  subBass: -999
};

const DETAIL_CONFLICT_PENALTIES = {
  sameSourceSameDimension: -100,
  sameDimensionDifferentSource: -35,
  primaryLeadBusy: -45,
  signatureProtected: -999,
  negativePromptConflict: -999,
  beatlessRhythmicEffect: -90,
  promptBudgetNearLimit: -30
};
```

The actual implementation may use different numeric values if its current scoring system has another scale. Preserve the **ordering and intent**, not these exact numbers, unless tests establish them.

---

## Appendix B — Compact UI copy

Recommended help text:

**Ear Candy**  
`Adds small incidental details using sounds already in the arrangement.`

**Space & Movement**  
`Adds restrained width, delay, modulation or filter movement to compatible layers.`

**Vocal Treatment**  
`Adds a compatible vocoder, talkbox, chop, stutter or controlled digital vocal treatment.`

Talkbox unavailable tooltip:  
`Requires an existing compatible synth or electric-guitar carrier in this build.`

Instrumental-mode tooltip:  
`Vocal Treatment is unavailable while Instrumental mode is selected.`

---

## Appendix C — Implementation rule summary

```text
SOURCE FIRST.
PATCH SECOND.
ROLE AND PROTECTION ALWAYS.
VOCAL TREATMENT BEFORE SPACE & MOVEMENT.
SPACE & MOVEMENT BEFORE EAR CANDY.
NO NEW EAR-CANDY INSTRUMENTS.
NO TALKBOX WITHOUT AN EXISTING CARRIER.
NO LFO WITHOUT NAMING WHAT IT MODULATES.
NO WHOLE-RACK EFFECT STACKS.
NO REROLL OF THE BASE CAST.
NO LEGACY PROSE REWRITE.
NO NEGATIVE-PROMPT WEAKENING BY ACCIDENT.
NO METATAG INVENTION THAT CONTRADICTS THE STYLE STATE.
NO-OP IS A VALID RESULT.
```

# Song structure & energy — knowledge base

**Status: research complete, 2026-07-23. Source of truth for the structure-first
pipeline. Grounded in web research, not inference.** John was explicit that the
Project-folder skill files are pointers, not the map — they name concepts
(energy mapping, song forms, tension/release) but contain none of the actual
data. This file is the data.

The rule from every other part of this project applies here too: once this
becomes code, the facts move into an enforced module (`core/structure.js`) with a
validator that fails the build. This document is the human-readable source; the
validator reads the same facts.

---

## 1. Why structure comes FIRST (John's ordering)

The user works lyrics-out, but the *decision* order is fixed:

1. **Song type** — instrumental vs vocal. This is decision #1 and it gates
   everything. It decides which structural vocabulary is even legal and whether
   the style prompt may carry vocal-delivery language.
2. **Structure preset** — chosen from a menu, carrying a section order AND an
   energy shape.
3. **Style prompt** — shaped by 1 and 2 (instrumental prompt vs vocal prompt).
4. **Metatags** — the section markers, which must be musically coherent with the
   energy shape (no drop at an intro, no climax at a breakdown).

Research backs the ordering directly: "A great 8-bar loop is not a song. The
thing that turns a loop into a track is structure — the order of sections and how
energy rises and falls across them" (veena.studio). And energy coherence is the
whole game: "Every section is a step up or down on an energy curve, and a song
that lands is usually a song whose energy curve makes sense... When a song feels
monotonous, the sections are all sitting at the same energy level" (songcage.com).

---

## 2. Song type gate

### Vocal song
- Structural vocabulary: Intro, Verse, Pre-Chorus, Chorus, Post-Chorus, Bridge,
  Instrumental Break, Outro.
- Style prompt MAY carry vocal delivery + backing-vocal language.
- Lyrics field carries real lyrics under section tags.

### Instrumental
- Structural vocabulary is DIFFERENT: Intro, Theme/Movement, Build, Drop,
  Breakdown, Interlude, Reprise, Outro. (Electronic engines use Build/Drop/
  Breakdown; through-composed/cinematic use Movement/Theme/Reprise.)
- Style prompt must NOT carry vocal-delivery language.
- Lyrics field = `[Instrumental]` (the proven suppression mechanism) with the
  structural markers only.

This split is the thing the current pipeline does NOT do — vocal mode resolves
late, inside the lyric engine, and never gates the style prompt.

---

## 3. The energy curve (the coherence spine)

Energy is scored 1 (lowest) to 5 (peak). These are the conventional levels each
section sits at, from research:

| Section | Energy | Role (researched) |
|---|---|---|
| Intro | 2 | Sets mood, stripped-back, "often a stripped-back version of what's coming". Pulls the listener in. |
| Verse | 3 | Storytelling, "lower in energy than the chorus... leaves somewhere to go". |
| Pre-Chorus | 4 | Builds anticipation; "ascending melodies, increasing dynamics"; a ramp that makes the chorus "feel earned". |
| Chorus | 5 | "The loudest and most dense part"; the hook; the payoff/climax. |
| Post-Chorus | 4 | Chantable restatement, slightly simpler; keeps the lift without a full verse reset. |
| Bridge | 2 | "Resets the song"; contrast; either strips down (intimacy) or lifts toward a final climax. Its job is to make the final chorus "feel earned". |
| Instrumental Break | 3 | Solo/theme statement; sits mid-energy. |
| Outro | 2 | Resolves, thins out, reverb/fade. |

### Electronic (instrumental) energy levels
| Section | Energy | Role (researched) |
|---|---|---|
| Intro | 2 | Steady, simple, "gives DJs space to mix"; establishes mood. |
| Build / Build-Up | 4 | "Rising synth patterns, intensifying drum fills"; generates tension toward the drop. Ascending only. |
| Drop | 5 | "The peak of energy"; main hook, heavy bass/drums; the payoff. |
| Breakdown | 2 | "Removes energy to create space and tension"; stripped, atmospheric; a palate cleanser. Must come DOWN. |
| Interlude | 3 | Transitional, re-introduces a motif. |
| Reprise | 4 | Returns an earlier theme, near-peak. |
| Outro | 2 | Thins, mixable tail. |

---

## 4. THE COHERENCE RULES (what makes a structure musically wrong)

These are the rules the engine must enforce — John's "no drop at the intro, no
climax at a breakdown". Derived from the research, stated as checkable constraints:

- **R1 — Intro is low.** An intro must be energy ≤ 2. It cannot be a drop/chorus/
  climax. (Every source: intro is stripped-back, eases in.)
- **R2 — A peak must be earned by a build.** A Drop or Chorus (energy 5) must be
  immediately preceded by a section of energy ≥ its own minus 2 that is *rising*
  — i.e. a Build, Pre-Chorus, or Verse. You cannot jump from energy 2 straight to
  energy 5 without the ramp. "A build-up culminates in the drop"; "a pre-chorus
  makes the chorus feel earned."
- **R3 — A breakdown/bridge drops.** A Breakdown or Bridge must be LOWER energy
  than the section before it. "The breakdown removes energy"; "the bridge resets."
  A climax at a breakdown (John's example) violates this.
- **R4 — No two adjacent sections at identical energy** for more than a
  verse-repeat. "If every section has the same energy, the song feels flat." (A
  Verse→Verse repeat is allowed; Chorus→Chorus back-to-back is the earned-double
  exception at the end.)
- **R5 — End resolves.** The last section is an Outro (energy ≤ 2) OR a final
  Chorus/Drop followed by an Outro. A song should not end on a mid-build.
- **R6 — The overall curve must rise then resolve.** Peak energy should occur in
  the back half, not the first section. "Save your biggest moment for after a
  build."
- **R7 — Instrumental/vocal vocabulary must not mix.** A vocal structure cannot
  contain a Drop token; an instrumental cannot contain a Verse-with-lyrics. (Suno
  reads them differently, and the style prompt is gated by song type.)

---

## 5. STRUCTURE PRESETS (the selectable menu)

Each preset carries a section order AND the per-section energy, so the curve is
built in. All validated against R1–R7. Section labels use Suno's reliably-read
tags (see §6).

### Vocal presets
1. **Verse–Chorus (ABAB)** — Intro, Verse, Chorus, Verse, Chorus, Outro.
   Curve: 2,3,5,3,5,2. The streaming-era default without a bridge.
2. **Verse–Chorus–Bridge (ABABCB)** — Intro, Verse, Chorus, Verse, Chorus,
   Bridge, Chorus, Outro. Curve: 2,3,5,3,5,2,5,2. "The most common in modern pop."
3. **Pre-Chorus Pop** — Intro, Verse, Pre-Chorus, Chorus, Verse, Pre-Chorus,
   Chorus, Bridge, Chorus, Outro. Curve: 2,3,4,5,3,4,5,2,5,2. Firework/Rolling in
   the Deep shape.
4. **AABA (32-bar)** — Intro, Verse(A), Verse(A), Bridge(B), Verse(A), Outro.
   Curve: 2,3,3,2,3,2. No chorus; the A-section carries the hook/refrain. Jazz
   standard, classic pop, folk.
5. **Anthemic (double final chorus)** — Intro, Verse, Pre-Chorus, Chorus, Verse,
   Pre-Chorus, Chorus, Bridge, Chorus, Chorus, Outro. Ends on the earned double.

### Instrumental presets
6. **Club / Two-Drop EDM** — Intro, Build, Drop, Breakdown, Build, Drop, Outro.
   Curve: 2,4,5,2,4,5,2. The mainstage formula; two waves of tension/release with
   mixable bookends.
7. **Progressive / Melodic** — Intro, Build, Drop, Breakdown, Interlude, Build,
   Drop, Outro. Longer, more evolving; the melodic-techno/prog-house shape.
8. **Downtempo / Ambient** — Intro, Theme, Movement, Interlude, Reprise, Outro.
   Curve: 2,3,3,3,4,2. Beatless-friendly; evolving loops, no drop. Fits the
   Balearic ambient/beatless clusters.
9. **Cinematic / Through-composed** — Intro, Theme, Movement 1, Movement 2,
   Climax, Reprise, Outro. Builds to one climax; the film-score shape.

John may add a structure or two once he sees these; the menu is designed to be
extended, and any addition is validated against R1–R7 before it ships.

---

## 6. Suno rendering facts for structure (researched, 2026)

- Suno reads a fixed set of bracket tags reliably in v5: `[Intro] [Verse]
  [Pre-Chorus] [Chorus] [Post-Chorus] [Bridge] [Instrumental] [Instrumental
  Break] [Break] [Interlude] [Drop] [Build-Up] [Breakdown] [Outro] [End]`.
  Multiple sources confirm this list; Suno publishes no official list.
- Each tag goes on its OWN LINE, directly above the section it applies to.
- Without structure tags, "Suno guesses your song structure — and often gets it
  wrong." This is the justification for making structure explicit and first.
- Tags are probabilistic hints, not commands — Suno follows them most of the time
  but can ignore them. So the STYLE PROMPT and the structure must agree; a
  contradiction is worse than silence (this matches our own round-3 finding that
  a contradicting metatag is worse than no metatag).
- `[Instrumental]` in the lyrics field is the reliable vocal-suppression path
  (already an established project fact).
- Section-energy can be nudged inline, e.g. `[Chorus: powerful]`, but this is a
  hint, not precise control. Our piped `[Section | short | short]` format already
  aligns with "short, comma/pipe-separated cues render better than prose."

---

## 7. GAPS — what I still need, and from where

Stated plainly rather than filled by guessing (John's standing instruction).

**Need from JOHN (product decisions, not researchable):**
- **G1.** Confirm the preset menu in §5 — which to ship, which to cut, which to
  add. He said he may add a structure or two after seeing these.
- **G2.** Does he want the preset to be *fixed* (user picks one, engine fills it)
  or *editable* (user picks one, then can add/remove sections with the engine
  refusing incoherent edits)? Earlier discussion pointed at fixed; confirm.
- **G3.** For instrumental presets, how should the Balearic engine's existing
  beatless clusters map — always Downtempo/Ambient (#8), or can a beatless
  cluster still take a Club structure? (Musically it should not; confirm.)

**Need to RESEARCH FURTHER before building (not yet grounded enough):**
- **G4.** Genre-specific section *lengths* in bars (intro 8/16/32, drop at bar 32
  in 140 BPM, etc.). Research gave ranges; needs a per-engine table so the energy
  map can carry approximate durations, which may affect how Suno paces sections.
- **G5.** How the composer-layer (just shipped) interacts with instrumental
  structures — a composer's section map is keyed to intro/verse/chorus/etc.; it
  needs an instrumental key set (intro/build/drop/breakdown) or a translation.
- **G6.** Electronic-family linking guide (the standing TODO) — still open, and
  the instrumental presets lean on electronic sections, so this and the structure
  work are now coupled.

**Confirmed NON-gaps (researched, don't re-open):**
- The section list, the energy levels, the coherence rules, and the Suno tag set
  are grounded above and should not be re-derived from memory next session.

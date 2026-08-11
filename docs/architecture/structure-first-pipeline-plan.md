# Structure-First Pipeline — Implementation Plan

**Date:** 2026-08-12  
**Status:** PLANNING (awaiting John sign-off before build)  
**Research basis:** docs/knowledge/structure-and-energy.md (complete)

---

## Executive Summary

Reorder the generation pipeline to put **song type and structure FIRST**, before style selection, with energy coherence validated throughout. This ensures structural vocabulary gates style language (no vocal delivery in instrumental prompts) and metatags are musically coherent with the energy curve.

**Current order (broken):**
- Character → Style → Lyric/Metatag (vocal mode resolves late, doesn't gate)

**Proposed order (structure-first):**
1. **Song type** (Instrumental vs Vocal) → gates structural vocabulary + style language
2. **Structure preset** (section order + energy shape) → shapes metatag menu  
3. **Character + Style** (genre/engine) → inherits song type constraints
4. **Lyric + Metatag** → reads completed style, emits section markers coherent with energy curve

---

## Module Architecture

### New Module: `core/structure.js`

**Contents:**
- `SONG_TYPES`: {instrumental, vocal} (2 types, gated)
- `STRUCTURE_PRESETS`: {name, type, sections[], energyShape[], coherenceRules}
  - Example: "Classic Pop (3m)": {type: 'vocal', sections: [Intro, Verse, PreChorus, Chorus, Verse, PreChorus, Chorus, Bridge, Chorus, Outro], energyShape: [2,3,4,5,3,4,5,2,5,2]}
  - Example: "Electronic Drop": {type: 'instrumental', sections: [Intro, Build, Drop, Breakdown, Build, Drop, Outro], energyShape: [2,4,5,2,4,5,2]}
- `resolveStructure(presetName)` → {sections, energyShape}
- `validateEnergyCoherence(metatags, energyShape)` → true/false + violations array
- All presets, shapes, and rules DIRECTLY FROM docs/knowledge/structure-and-energy.md

**Validator:** `validate-structure.mjs`
- Loads `docs/knowledge/structure-and-energy.md` from disk
- Asserts every preset in `STRUCTURE_PRESETS` is mentioned verbatim in the guide
- Asserts every energy value, rule, and section name matches the guide exactly
- Tests energy coherence rules on sample metatag sequences
- Fails build on violation (proof that structure/energy facts live in one place)

---

## UI Flow Changes

### Current Flow (app.js context):
```
[Engine Selector] → [Palette Selector] → [Modifier Selectors] → [Generate Style] 
→ [Generate Lyric/Metatag] → Output (style + lyric)
```

### Proposed Flow:
```
[Song Type Selector] 
  ↓ (gates structural vocab)
[Structure Preset Selector] 
  ↓ (gates style constraints + metatag sections)
[Engine Selector] 
  ↓ (constrained to type, inherits energy curve)
[Palette Selector] 
[Modifier Selectors] 
[Generate Style] 
  ↓ (style inherits song-type constraints: no vocal-delivery if instrumental)
[Generate Lyric/Metatag] 
  ↓ (reads: song type + structure + completed style)
  ↓ (emits: lyrics + metatags coherent with energy curve)
Output (style + lyric + metatag)
```

**UI elements:**
- NEW: Song Type radio buttons (Instrumental | Vocal) — top-level control
- NEW: Structure Preset dropdown (populated dynamically based on song type)
  - Example for Vocal: "Classic Pop", "Three-Verse", "Bridge+Chorus", etc.
  - Example for Instrumental: "Electronic Drop", "Downtempo Groove", etc.
- MODIFIED: Engine Selector → filter by song type (e.g., hide vocal-only engines if Instrumental selected)
- MODIFIED: Style Prompt output → note: "Vocal-safe mode" or "Instrumental-safe mode"
- MODIFIED: Lyric/Metatag Input → require section tags aligned with selected structure

---

## Generation Pipeline Changes

### Song Type → Style Constraints

When song type is **Instrumental**:
- Style prompt: NEVER carry vocal-delivery language (e.g., "breathy falsetto", "syncopated vocals")
- Lyric output: auto-prefix `[Instrumental]` and ONLY include section markers
- Metatag sections: instrumental vocabulary only (Build, Drop, Breakdown, etc.)

When song type is **Vocal**:
- Style prompt: CAN carry vocal-delivery language
- Lyric output: real lyrics under section tags
- Metatag sections: vocal vocabulary (Verse, Chorus, Bridge, etc.)

**Implementation:** 
- `core/generation.js` `generate()` function gets `{songType, structurePreset, ...}` as input
- Passes `songType` to style builder → filters/rewrites vocal-language clauses
- Passes `songType + structure` to lyric engine → shapes output format

### Energy Coherence Enforcement

**Lyric engine flow:**
1. Accept: `{songType, structure, style, energyShape}`
2. Emit: `lyrics` + `metatags` where each section tag sits at the CORRECT energy level
3. Validator: `validateEnergyCoherence(metatags, energyShape)` → fail if incoherent

**Example:**
- Structure: "Classic Pop" → energyShape: [2,3,4,5,3,4,5,2,5,2]
- Generated metatags: `[Intro] [Verse] [Pre-Chorus] [Chorus] [Verse] [Pre-Chorus] [Chorus] [Bridge] [Chorus] [Outro]`
- Validator: confirm section 0=Intro (energy 2 ✓), section 3=Chorus (energy 5 after Pre-Chorus ✓), etc.

---

## Implementation Order (Dependency Chain)

1. **Phase 1 — Foundational**
   - Create `core/structure.js` with STRUCTURE_PRESETS (data only)
   - Create `validate-structure.mjs` (facts traced to knowledge base)
   - Add song-type + structure selectors to HTML UI (no wiring yet)
   - ✅ All validators pass

2. **Phase 2 — Style Constraints**
   - Modify `core/generation.js` `generate()` signature to accept `{songType, structure, ...}`
   - Add vocal-language filter to style builder (strip vocal-delivery clauses if instrumental)
   - Wire song-type selector to generation pipeline
   - Test: instrumental character produces non-vocal style; vocal character produces vocal style

3. **Phase 3 — Lyric Engine Replan**
   - Read current `core/lyric.js` architecture
   - Plan lyric-engine refactor to:
     - Accept `{songType, structure, energyShape, completedStyle}`
     - Read the completed style (John's confirmed architecture)
     - Emit lyrics + metatags coherent with structure
   - Create `validateEnergyCoherence()` function
   - PRESENT TO JOHN FOR SIGN-OFF before implementing

4. **Phase 4 — Integration + Validation**
   - Implement lyric-engine refactor (Phase 3 design)
   - Extend `validate-structure.mjs` to run energy-coherence checks on sample outputs
   - Wire structure selector to UI + generation
   - Run full validator suite
   - Test end-to-end: song type → structure → style → lyric → metatag

---

## Decision Points (Requiring John Input)

### Q1: Structure Presets Scope
**Current plan:** 10–15 presets across vocal + instrumental.  
**Ask John:**
- Number of presets to ship initially?
- Any preset names/structures not listed in the knowledge base?
- Should presets be extensible (user can add) or locked?

### Q2: Song Type Gating
**Current plan:** Song type is immutable once chosen (full pipeline restart to change).  
**Ask John:**
- Should switching song type reset the entire session, or just re-filter menus?

### Q3: Lyric Engine Refactor Scope
**Current plan:** Lyric engine reads completed style + energyShape, emits coherent metatags.  
**Ask John:**
- Should the lyric engine ALSO emit time/BPM-aware section lengths (e.g., "Intro 8 bars")?
- Or just section names + position markers?

### Q4: Validator Enforcement
**Current plan:** Energy-coherence validator fails the build if metatags are incoherent.  
**Ask John:**
- Should misaligned metatags auto-repair (validator suggests fixes) or fail hard?

---

## Rollout Plan

**Session A (now — planning):**
- Finalize architecture with John (address Q1–Q4)
- Create core/structure.js + validate-structure.mjs
- Review + sign-off

**Session B (after sign-off):**
- Implement Phase 2 (song-type constraints in style builder)
- Quick smoke test

**Session C:**
- Implement Phase 3 (lyric-engine replan) after John review
- Implement Phase 4 (integration + validation)
- Ship

---

## Risk Mitigation

**Risk: Lyric engine refactor too large**  
→ Plan: Test Phase 2 (style constraints) independently; Phase 3 refactor is additive on top

**Risk: Energy coherence is hard to test**  
→ Plan: Start with 3–5 hand-written test cases in the validator; expand as patterns emerge

**Risk: User confusion about song-type choice**  
→ Plan: UI brief text under selector explaining what vocal vs instrumental means (in context of THIS app)

---

## Definition of Done

- ✅ core/structure.js created with all presets from knowledge base
- ✅ validate-structure.mjs reads guide from disk and passes all checks
- ✅ Song-type selector wired; produces instrumental-safe + vocal-safe style prompts
- ✅ Lyric engine refactored to read structure + energyShape
- ✅ validateEnergyCoherence() implemented and tested
- ✅ Full validator suite passes
- ✅ End-to-end test: song type → structure → style → lyric → metatag (coherent)

---

## Notes for John

This plan follows the same discipline we used for electronic-linking:

1. **Facts in data:** All structure/energy facts live in ONE place (docs/knowledge/ + core/structure.js)
2. **Validator as enforcer:** validate-structure.mjs reads facts from disk, fails the build on violation
3. **No guessing:** Song type and structure are user choices, not inferred; energy coherence is checkable

The structure-first ordering is a **high-impact change** that touches the UI flow, the generation pipeline, and the lyric engine. Recommend review + approval of this plan before coding Phase 1, so we catch scope issues early.

Lyric engine refactor (Phase 3) is the most complex piece. I've scoped it to "read the completed style + energyShape, emit coherent metatags" but want your input on whether that's the right scope or if we should add time-aware section lengths.

Ready to start Phase 1 once you sign off.

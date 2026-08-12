# P8 — DNA Extractors for Resolver/Legacy Engines: Scoping Plan (Phase 1 = Resolver)

**Date:** 2026-08-13
**Status:** PLANNING (awaiting John sign-off before build)
**Research basis:** core/dna.js, core/resolver.js, engines/delerium.js read in full for this plan.

---

## Why this matters

Only atom-path engines (`Balearic Atom` today; more as they migrate) can currently reach the Lyric Engine, the quality gate, or live generation — because `buildMusicalDNA()` only knows how to read `buildAtoms()`'s output. Every resolver engine (Delerium, Era, Deep Forest, Sacred Spirit — 4 of 6 engines) and every legacy engine (Balearic, Enigma) throws a clear "not built yet" error the moment you try. P8 closes that gap, engine kind by engine kind.

## Finding: this is not a mechanical port

I read `resolveArrangement()` (`core/resolver.js`) end to end and a real character definition (`engines/delerium.js`). The resolver arrangement model is **structurally different** from the atom model `buildMusicalDNA()` was written against, not just differently named:

| | Atom path (`buildAtoms`) | Resolver path (`resolveArrangement`) |
|---|---|---|
| Per-voice shape | Array of tagged objects: role, family, register, prominence, signature, bedId, behaviour, priority | Flat object: one plain text string per role (`pads`, `harmony`, `bass`, `lead`, `voice`, `color`, `movement`, `drums`) |
| Key/mode | A resolved musical key/mode string | **Does not exist.** `arr.harmony` is an *instrument choice* from the harmony pool (e.g. "phrygian" is a pool item label, not a confirmed key signature), not a key/mode value |
| Genre anchor | Assembled from atom parts | Already a complete string on the character (`c.genre`, e.g. `"Delerium Style, dark ritual ambient"`) |
| Subgenre | `char.label` | `c.label` (e.g. `"Gothic Ambient"`) — same idea, works |
| Tempo | Resolved BPM spec string | `c.bpm` as `[min, max]`, or absent when `c.beatless` |
| Bed/pad detection (metatag engine's Phase A functional test) | Reads `bedId`/`behaviour` tags per voice | **No equivalent exists.** Resolver never computes this |

So the honest options for each DNA field are: (a) directly derivable, (b) derivable with a real judgment call, or (c) genuinely absent — report `unknown`, don't invent a value. That's the same discipline already used this session for the Climax=5 energy gap and the dead vocal-option findings — stated, not papered over.

---

## Field-by-field assessment (resolver path)

| DNA field | Resolver source | Verdict |
|---|---|---|
| `identity.genreAnchor` | `arr.genre` | **Direct** — already a complete string |
| `identity.subgenre` | `c.label` | **Direct** |
| `harmony.keyMode` | — | **Absent.** No key/mode concept in this data model. Report `null`/`unknown`, do not infer one from the harmony pool text |
| `tempo.spec` | `c.bpm` / `arr.beatless` | **Direct**, reformatted to match the atom path's spec string shape |
| `dynamics.beatless` | `arr.beatless` | **Direct** |
| `dynamics.arc` | `arr.ip.arc` (interplay pool) | **Derivable**, different flavour of text than the atom path's arc (a full descriptive phrase vs. a short atom role text) but usable as-is |
| `arrangement[]` (per-voice) | `arr.pads/bass/lead/voice/color/movement/drums` | **Lossy.** Can build one entry per populated role with `voice` (the text) and `role`, but **no** `bedId`, `behaviour`, `signature`, or `prominence` — those don't exist in this model. Any downstream logic keyed on those fields (metatag's functional pad detection) will not see resolver-sourced arrangements correctly without a follow-up decision (see Q2) |
| `vocal.mode` | — | Same as atom path: default `'instrumental'`, CIL asks/infers the rest. No resolver-specific issue |
| `affect.*` | — | Same as atom path: `unknown`, CIL fills. No resolver-specific issue |
| `influences[]` | overlay application in `js/generate.js`'s `overlayFor()` | **Needs a closer look during implementation** — haven't yet traced whether resolver overlay application carries the same kind/label/renderPolicy metadata `buildAtoms()` attaches. Flagging rather than guessing |
| `production.masteringTail` | — | Not found on resolver characters in the read so far; likely a shared constant (`MASTERING` in `core/resolver.js`) rather than per-character. Needs confirming during implementation |

---

## Proposed module

`core/dna-resolver.js`, exporting `buildResolverDNA(engine, arrangement, opts)` — takes the ALREADY-RESOLVED `arr` object `resolveArrangement()`/`build()` produced (not a fresh re-resolve) and projects it into the exact same `MusicalDNA` shape `core/dna.js` produces, so every downstream consumer (CIL, Lyric, Metatag) reads one shape regardless of which engine kind it came from. Fields with no honest resolver equivalent (`harmony.keyMode`, per-voice `bedId`/`behaviour`/`signature`/`prominence`) are explicitly `null`, with `provenance: 'n/a'` rather than `'derived'` or `'unknown'` — a third provenance state meaning "this engine kind structurally cannot produce this field," distinct from `'unknown'` which means "could exist, just not resolved/asked yet."

`DNA_CONSUMERS` and the rest of the contract stay untouched — this is purely an alternate *producer* of the same DNA shape, same as `buildMusicalDNA()` is for atoms.

**Validator:** `validate-dna-resolver.mjs` — every field-mapping decision in the table above encoded as an assertion (direct fields match exactly; absent fields are `null` with `provenance: 'n/a'`, never invented; consumer contract fields stay identical to `core/dna.js`'s). Runs across all resolver-engine characters (Delerium/Era/Deep Forest/Sacred Spirit × their palettes), same coverage discipline as `validate-dna.mjs`.

---

## Implementation phases

**Phase 1 (this scoping — awaiting sign-off):** resolver only. Legacy (Balearic/Enigma's cluster/preset/classic-slot model) is a *third* data shape, not yet read in depth — deliberately deferred rather than guessed at now. A legacy-specific scoping pass would follow this one, not be folded into it.

**Phase 2 (after sign-off):**
- `core/dna-resolver.js` + `validate-dna-resolver.mjs`, built against the field table above.
- Wire `buildLiveLyricRequest()` in `js/generate.js` to use it for `eng.kind === 'resolver'`, alongside the existing atom path — the P8-gap error narrows to legacy only.
- Extend `validate-live-lyric.mjs`'s P8-gap test: resolver should now succeed, legacy should still refuse.

**Phase 3 (separate future scoping):** legacy engines (Balearic/Enigma).

---

## Decision points for John

**Q1 — `harmony.keyMode: null` for resolver DNA.** The Lyric Engine's context block currently prints `"Key / mode: n/a"` when this is null (already handles the atom-path `unknown` case the same way). Confirms this is fine to ship as a real, permanent gap for resolver-sourced lyrics, not a placeholder to fill later?

**Q2 — Arrangement fidelity for the Metatag Engine.** Resolver-sourced `arrangement[]` entries won't carry `bedId`/`behaviour`, so the metatag engine's functional pad-detection (mentioned in `core/dna.js`'s own comments as a past fix) may not correctly identify beds/pads for resolver engines even after this phase ships. Options: (a) ship Phase 2 with this known limitation, flagged, Metatag-engine-for-resolver becomes its own later ticket; (b) fold a minimal heuristic (e.g. "the `pads` role's text always counts as a bed") into Phase 2 now. Leaning (a) — keeps this phase's scope to what it says on the tin — but your call.

**Q3 — Scope check on `influences[]` and `production.masteringTail`.** Both need tracing during implementation (noted above, not yet resolved). Fine to resolve those as part of building Phase 2, or would you rather I trace them fully now before you sign off on the plan?

---

## Definition of done (Phase 2)

- `core/dna-resolver.js` built exactly against the field table above — no field invented beyond what's justified there.
- `validate-dna-resolver.mjs` passes across every resolver character × palette combination.
- `buildLiveLyricRequest()` accepts resolver engines; the P8-gap error narrows to legacy only, with an updated, accurate message.
- `validate-live-lyric.mjs` extended to prove a resolver engine can now build a live lyric request end-to-end (fake transport, no network — same discipline as every other test this session).
- Full validator suite still green.

Ready to start Phase 2 once you've weighed in on Q1–Q3.

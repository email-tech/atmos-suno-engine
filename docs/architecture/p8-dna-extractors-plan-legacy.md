# P8 Phase 3 — Legacy DNA extractor: research + scoping (awaiting sign-off)

Picking up the item Phase 1/2 explicitly deferred: "legacy engines are a
THIRD data shape, not yet read in depth — deliberately deferred rather than
guessed at now" (`p8-dna-extractors-plan.md`, Phase 1 scope note). This
document is that deferred read, done in full before proposing anything, per
the same discipline the resolver plan used: `legacy/prompt-style-builder.js`
(354 lines), `legacy/data-style-engines.js` (237 lines), `legacy/engine-
extras.js` (1098 lines), `js/state.js`'s `S.leg` shape, and `js/generate.js`'s
`toLegacyState()` / `resolveClassicSlots()` were all read in full, not
sampled.

**No code changes in this document.** Same pattern as the resolver plan:
research, a field table, decision points, then implementation only after
sign-off.

## Headline finding: this is bigger than "a third shape"

Resolver turned out to be one flat data shape. Legacy is **two data shapes
per engine**, chosen at generation time, plus a scoping fact resolver didn't
have:

1. **Cluster path** (`buildClusterPrompt`) — Balearic's primary, Suno-
   validated path (`buildMode:'cluster'`). Deterministic per seed, 11 roles:
   `pads, harmony, bass, strings, texture, motif, counter, movement` (drawn)
   + `rhythm, perc, color` (drawn separately, `color` conditional on
   `colorChance`). Closest of the two to the resolver/atom shape.
2. **Classic slot path** (`buildClassicStyle`) — the pre-cluster mechanism,
   still live and selectable (`buildMode:'classic'` on Balearic, `engineMode:
   'manual'` on Enigma). 7 roles: `pad, harmony, bass, rhythm, percussion,
   motif, movement`. Also seed-deterministic (`resolveClassicSlots()`), but a
   structurally different, flatter draw with no strings/texture/counter/
   color/perc roles at all.
3. **Enigma's preset dropdown** isn't a third shape — `presetCluster()` maps
   a chosen preset straight to a cluster id and routes into path 1. Only
   matters for DNA in that `identity.subgenre` should read the preset label
   the user actually picked, not the cluster id underneath it.

Both engines can be in either mode at generation time (`S.leg.buildMode` /
`S.leg.engineMode`), so a legacy DNA extractor has to branch on mode, not
just on engine.

## The blocking fact: `generate()`'s legacy branch has no arrangement to read

Resolver's `build()` already returned `{ arrangement: arr, style, ... }` —
Phase 2 just had to project an object that was already escaping the builder.
Legacy is different: `buildClusterPrompt()` and `buildClassicStyle()` compute
`drawn` / `resolveClassicSlots()`'s `out` entirely as **local variables** and
return only the rendered `style` string. Nothing structured escapes.
`generate()`'s own legacy branch (`js/generate.js` ~L133-142) confirms this —
its return object is `{ style, negative, lyrics, length, over, structure }`,
the only one of the three engine kinds with no `arrangement` field at all.

**This means Phase 3 cannot be scoped as "just add a DNA projector" the way
Phase 2 was.** The prerequisite is an additive change to expose the resolved
slot values from the builder — e.g. having `buildClusterPrompt`/
`buildClassicStyle` also return the `drawn`/`out` object (or a thin wrapper
function that does), and `generate()`'s legacy branch surfacing it the way
the resolver branch already does. That touches
`legacy/prompt-style-builder.js`, which is the most tested, longest-proven
path in the whole app and explicitly protected by the standing rule ("proven
prompt paths never changed without explicit sign-off"). Even a
return-shape-only, zero-rendering-impact change to that file needs your
go-ahead before I touch it — flagging it here rather than doing it and
asking forgiveness.

## Secondary fact worth knowing before deciding

Balearic's legacy cluster pools (`legacy/engine-extras.js`'s
`flavourClusters`) are the **pre-audit** pool data — the same pools the
2026-07-20 audit found "68% defective" (palette mismatches, non-instrument
entries, descriptive prose instead of instrument names). That audit's fixes
(clarinet removed, fretless bass + lap-steel added, 500 clean entries, etc.)
were built as `engines/atom-pools.js`, a **new, separate file** — the legacy
pools were deliberately left untouched ("legacy engine-extras untouched
(proven legacy engine intact)"). So DNA sourced from Balearic's legacy
cluster path would inherit those known, never-fixed quality issues verbatim.
Not a blocker to scoping this — the DNA extractor's job is to report what's
actually selected, not to improve it — but worth knowing going in: fixing
those pools is a separate, much larger, explicitly-flagged decision that
this phase should not fold in.

## Field-by-field assessment

Applies to both sub-paths except where noted; classic-path gaps are called
out explicitly since it has 4 fewer roles.

| DNA field | Legacy source | Verdict |
|---|---|---|
| `identity.genreAnchor` | `c.genre \|\| STYLE_ENGINES[engine].genre` (cluster) / `e.genre` (classic) | **Direct** |
| `identity.subgenre` | Cluster id/label (cluster path) or the classic preset label; **for Enigma, the chosen preset label**, not the cluster id it maps to | **Direct**, needs the presetCluster() label lookup, not just the id |
| `harmony.keyMode` | — | **Absent**, same as resolver — harmony pool entries are chord/mode *descriptions* ("Built on warm minor-seventh chord voicings..."), never a literal key. `null` / `provenance:'n/a'`, not invented |
| `tempo.spec` | `c.phase` (beatless) or BPM range text embedded in the phase string | **Derivable but messier than resolver** — legacy phase strings are pre-composed prose ("mid chill, 90-100 BPM, medium energy"), not a clean `{bpm:[lo,hi]}` pair like resolver's `c.bpm`. Would need a light regex extraction (already exists in `buildClusterPrompt`'s energy-band regex, could be reused) or ship `tempo.spec` as the raw phase string and accept it's less structured than the other two paths |
| `dynamics.beatless` | `c.beatless` (cluster) / not tracked at all on the classic path | **Direct on cluster; absent on classic** — the classic slot path has no beatless concept anywhere in its data (no `c.beatless` equivalent exists for classic-only engines/roles). Report `null`/`n/a` on classic, not inferred from BPM text |
| `dynamics.arc` | `arr.ip.arc` equivalent = `ipArc` (cluster path only, from `drawInterplay()`) | **Derivable on cluster; absent on classic** — the classic path has no interplay/arc mechanism at all (`wantInterplay`/`drawInterplay` are cluster-path-only code) |
| `arrangement[]` | `drawn.{pads,harmony,bass,strings,texture,motif,counter,movement}` + `rhythm`/`perc`/`color` (cluster) or `resolveClassicSlots()`'s `{pad,harmony,bass,rhythm,percussion,motif,movement}` (classic) | **Lossy, and shape differs by sub-path** — cluster path gives 11 possible roles, classic gives 7, with different names for overlapping concepts (`perc` vs `percussion`, `strings`/`texture`/`counter`/`color` don't exist on classic at all). No `bedId`/`behaviour`/`signature`/`prominence`, same as resolver. **Blocked entirely until the prerequisite above ships** — none of this is currently reachable outside the builder |
| `vocal.mode` | `S.leg.vocalMode` / `effectiveVocalMode` | **Direct**, actually richer than atom/resolver — legacy already tracks `Instrumental \| Persona \| Descriptor` as a real per-engine choice (`toLegacyState`), not something CIL has to infer from scratch. Should probably feed this as a `derived` provenance rather than leaving CIL to ask, though the vocalDescriptor/vocalPersona text fields are the known-dead ones flagged in the structure-first Phase 2 entry (state exists, no UI wiring) |
| `affect.*` | — | Same as the other two paths: `unknown`, CIL fills |
| `influences[]` | `s.ov` / `ov.roles`, built by the SAME `resolveOverlays()` the resolver path uses (`legacy/prompt-style-builder.js` imports nothing overlay-specific of its own — `overlayFor()` in `js/generate.js` is shared across resolver and legacy) | **Direct, and simpler than expected** — legacy and resolver already share the exact same overlay resolution call, so this field can very likely reuse resolver DNA's `influences[]` logic almost verbatim, including its already-flagged `applied:true`-always limitation (see the P8 Phase 2 log entry) |
| `production.masteringTail` | `MASTERING` constant, imported from `legacy/data-style-engines.js`, value confirmed identical to `core/constants.js`'s `MASTERING` used by resolver/atom | **Direct**, shared constant, already traced (not guessed) |

## Proposed module (once the prerequisite is approved and built)

`core/dna-legacy.js`, exporting `buildLegacyDNA(resolvedSlots, overlay, opts)`
— same pattern as `buildResolverDNA`, taking already-resolved data rather
than re-resolving it. Would need a `subPath` discriminator
(`'cluster'|'classic'`) in `opts` so consumers (eventually the Metatag
Engine) know which of the two role sets to expect, since they aren't the
same shape. `harmony.keyMode`, and on the classic path also
`dynamics.beatless`/`dynamics.arc`, get `provenance:'n/a'` for the reasons
in the table above.

**Validator:** `validate-dna-legacy.mjs`, same coverage discipline as
`validate-dna-resolver.mjs` (336 checks across every resolver character x
palette x overlay-state x seed) — here that means every Balearic cluster x
every Enigma preset+cluster x classic-vs-cluster mode x palette x overlay-
state x seed, which is a substantially larger matrix than resolver's. Sizing
that precisely is implementation work, not scoping work, but expect it to be
the largest of the three DNA validators.

## Decision points for John

**Q1 — the prerequisite.** OK to make an additive, return-shape-only change
to `legacy/prompt-style-builder.js` (`buildClusterPrompt`/`buildClassicStyle`
also returning their resolved slot object, not just the rendered string) and
to `generate()`'s legacy branch (surfacing it, mirroring how the resolver
branch already does)? Zero rendering impact — `buildStylePrompt`/
`buildNegativePrompt`/`buildLyricsField`'s actual output is untouched, byte-
identical — but it is a change to the most proven file in the repo, which is
why I'm asking rather than just doing it.

**Q2 — classic-path scope.** The classic slot path is missing 4 of the 11
cluster-path roles and both beatless/arc concepts entirely. Ship DNA for it
anyway (with more `n/a` fields than the cluster path), or scope Phase 3 to
the cluster path only (which is the Suno-validated, primary-use path for
both engines) and treat classic-path DNA as its own smaller follow-up, or
skip it entirely on the reasoning that it's a legacy-of-the-legacy mode? My
lean: ship both, since the code cost of the classic branch is small once the
prerequisite exists and the `n/a` fields are honest rather than invented —
but it's more `n/a`-heavy than either of the other two DNA producers, worth
your call.

**Q3 — tempo.spec extraction.** Take the light regex approach (parse a clean
BPM range out of the existing phase prose, reusing the pattern
`buildClusterPrompt` already has for preset-driven beatless energy bands) so
`tempo.spec` looks like the other two paths' output, or ship the raw phase
string as-is and accept `tempo.spec` is less structured on this path? Regex-
extraction risks silently misparsing an edge-case phase string; raw-string
risks giving the Lyric Engine noisier input than the other two paths.

**Q4 — Enigma preset vs cluster labelling.** Confirm `identity.subgenre`
should show the preset label the user picked ("Gregorian sacred (MCMXC)")
rather than the cluster id it resolves to ("sacred") — this is what a person
reading the DNA would expect to recognise, but flagging since it means one
extra lookup Phase 2 didn't need.

## Definition of done (once Q1–Q4 are answered)

- Prerequisite change to `legacy/prompt-style-builder.js` + `generate()`'s
  legacy branch, additive only, `buildStylePrompt`/`buildNegativePrompt`/
  `buildLyricsField` output proven byte-identical before/after.
- `core/dna-legacy.js` built exactly against the (possibly Q2/Q3-revised)
  field table above.
- `validate-dna-legacy.mjs` passing across the full matrix — both engines,
  both sub-paths (if Q2 says ship both), every cluster/preset, both
  palettes, every overlay state.
- `buildLiveLyricRequest()` in `js/generate.js` accepts legacy engines; the
  P8 gap error retires entirely (legacy was the last engine kind it named).
- `validate-live-lyric.mjs` extended to prove a legacy engine can build a
  live lyric request end-to-end, same discipline as the resolver extension.
- Full validator suite still green.

Ready to start once you've weighed in on Q1–Q4 — Q1 in particular, since
nothing else here can be built without it.

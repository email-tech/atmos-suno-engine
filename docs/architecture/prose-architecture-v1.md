# Prose architecture v1 — sketch for review

Status: **SKETCH. Nothing built. No measurement done yet** (John's instruction:
see the architecture before effort goes into scoring).

## 1. What is actually wrong

John, 2026-08-19:

> "It seems like there has been a library of pre-determined descriptions built
> up. Then a drop down or choice has been made it randomly places a description
> between the instruments, using phrases to link instruments etc. Rarely do any
> of them make any musical sense."

That is not an impression, it is literally the implementation. `TEXTURE_PROSE`
in `core/texture.js` is 45 hand-written sentences with a `{n}` slot, selected by
a hash of the seed. `PLANE_VARIANTS_BY_TYPE` and `PAIR_LINKS` in
`core/linking.js` are the same shape. `core/metatag.js` rotates a small pool per
section, which is why the metatags "describe little and rotate between a very
small selection".

### Why it survived this long

**Every validator in the repo measures structure, not truth.** Is the instrument
named twice; does the clause contain a legato word; does it sit before the
mastering tail; does it come from an approved phrase bank. Thirty-eight
validators, 20,000+ checks, and not one of them asks whether the sentence says
anything true about the music.

So the system was optimised for what was on the scoreboard. This clause:

> supporting synth strings in the middle plane with gentle motion

passes every check in the project and would be equally "true" of a cello, a
choir, or a marimba, in any genre, at any tempo. It is decoration wearing the
costume of description.

### Why more templates cannot fix it

Describing how a Rhodes relates to a mellotron and an FM sub-bass in Balearic
downtempo at 90 BPM requires judgement over a combinatorial space. A phrase bank
can only enumerate. Adding phrases adds ways to be generic; it does not add
musical truth. This is a category error, not a coverage gap.

## 2. The seam

Split at the point where enumeration stops working and judgement starts.

```
  Layer 1   CAST                    deterministic   EXISTS, KEEP
            what is in the arrangement

  Layer 2   ARRANGEMENT GRAPH       deterministic   NEW — the hard part
            how those things relate to each other

  Layer 3   PROSE RENDERER          LLM             NEW
            wording the graph, grounded in a corpus

  Layer 4   GATE                    deterministic   MOSTLY EXISTS
            validators run on the OUTPUT, fail = regenerate
```

**The governing rule: the LLM never decides a musical fact. It only renders
facts the engine has already computed.**

That single constraint is what makes this different from "ask an AI to write a
Suno prompt". It keeps content deterministic, keeps hallucinated instruments
impossible to introduce silently, keeps every reconciliation decision already
made in `cast.js` and `resolver-cast.js` in force, and reduces the model's job
to the one thing a phrase bank genuinely cannot do — saying it well and saying
it specifically.

## 3. Layer 2 — the arrangement graph (where the work really is)

This is the counterintuitive part and the reason the current system is generic.

`core/interplay.js` today **picks a phrase** about interaction. It does not
**compute** interaction. Nothing in the codebase knows that the sub-bass and the
kick occupy the same octave, or that the Rhodes and the mellotron are both
mid-register sustained sources and therefore need separating, or that exactly
one voice should be carrying the harmonic changes.

Layer 2 derives those as facts. Sketch of the relation types:

| Relation | Derived from | Why prose needs it |
|---|---|---|
| `lock(a,b)` | groove-led genre, bass + kit both present | "locked tight" is TRUE here and false in beatless |
| `masks(a,b)` | overlapping register + both sustained | forces the prose to state separation, or the cast to drop one |
| `answers(a,b)` | lead present + counter-melodic voice present | licenses call-and-response wording |
| `under(a,b)` | bed + second sustained layer | the texture support case, computed not asserted |
| `carriesHarmony(a)` | exactly one, by role priority | stops two voices both "moving through the changes" |
| `foreground(a)` | lead budget | one voice out front, everything else placed relative to it |
| `doubles(a,b,interval)` | same family, different register | low+high strings as one section |
| `arcs(section, in[], out[])` | structure preset + density | the temporal shape, and the metatag source |

Every one of these is testable and deterministic. **If this layer is weak the
prose stays generic no matter how good the corpus or the model is.** Most of the
build effort belongs here, not in prompting.

It also has a side benefit: `masks(a,b)` is a real arrangement fault the current
reconciler cannot see, because it reasons about instrument NAMES and families,
never about register occupancy.

## 4. Layer 3 — the prose renderer

Input to the model, per build:

1. **The spec** (context + voices + relations + arc + constraints) as JSON.
2. **Corpus excerpts retrieved by the families actually present.** Not the whole
   reference — only strings/brass/etc. as relevant. Keeps tokens down and
   relevance up.
3. **A genre convention card** for the engine's genre.
4. **Few-shot examples: John's own Suno-validated prompts.** These are the
   ground truth for house style and already exist in the repo.

Output: the woven style prompt, one string.

Then layer 4 runs the existing validators on it. Failure feeds the specific
violation back and regenerates. After N attempts, fall back and mark the build
as degraded rather than shipping something unchecked.

### Determinism

John's entire comparison method is identical-seed before/after. LLM output is
non-deterministic, so:

- temperature 0
- **cache keyed by hash(spec)** — same spec always returns the same prose, and
  the cache is exportable so a test result stays reproducible later
- the spec hash is shown in the UI next to the build fingerprint

### Metatags get the same treatment

Their rotating handful of options is the identical disease. `arcs()` from layer 2
already contains who enters, who leaves, and how density moves per section —
that is exactly what a metatag should say, and it is currently thrown away.

## 5. What gets deleted

Being explicit, because it is a large deletion and John should see it coming:

- `TEXTURE_PROSE` and `TEXTURE_FLAVOUR` (`core/texture.js`) — 54 phrases
- `PLANE_VARIANTS_BY_TYPE`, `PAIR_LINKS`, template banks (`core/linking.js`)
- the interplay phrase banks (`core/interplay.js`)
- the metatag section pools (`core/metatag.js`)

What survives: every reconciliation rule, the cast, the budgets, genre policy,
the negative-prompt logic, the mastering tails, the knowledge facts, the
articulation rules. The engine stays. Only the wording layer goes.

## 6. Honest risks

- **An API call per generate.** Mitigated by the cache, but it is a real
  dependency and the app currently works with no network at all.
- **The corpus may not exist in usable form.** Orchestration texts describe
  orchestral writing; almost nothing describes Balearic downtempo arrangement in
  those terms. Some of the genre layer may have to come from John.
- **Layer 2 could be built and still be shallow.** The relation list above is a
  first cut and needs review by someone who arranges — that is John.
- **This does not guarantee good prose.** It removes the structural reason the
  prose is bad. Whether the result is good is a measurement question, which is
  step two by John's instruction.

## 7. Decision points for John

1. Is a per-generate API call acceptable, or must there be a working offline
   path?
2. Delete the phrase banks outright, or keep them as a marked degraded fallback?
3. Which model writes the prose — Gemini (already the lyric default) or Claude?
4. Should the arrangement graph be visible in the UI, or stay internal?
5. Review the relation list in section 3. Anything missing that an arranger
   would consider basic?

## 8. Sequence

1. John reviews this sketch. **Nothing is built until then.**
2. Research briefs (`docs/research/`) go out — John farms them to whichever
   model or source he prefers and brings results back.
3. Build the quality rubric and judge; score the CURRENT system to get a
   baseline number. Every later change is measured against it.
4. Build layer 2. Test it in isolation.
5. Build layer 3 + gate. Score against the baseline.
6. Metatags last, reusing layer 2's arc data.

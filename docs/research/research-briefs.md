# Research briefs

For John to farm out to whichever model or source he prefers, and bring results
back. Written so each brief stands alone — paste one, get one answer back.

**Return format matters more than volume.** Each brief says what shape the
answer must come back in, because the results become DATA in the repo, not prose
to be read once. If an answer comes back as an essay it will have to be
converted, which is where meaning gets lost.

**Cite or say "no source".** The standing project rule is that inferences are
flagged as research candidates rather than shipped as facts. An unsourced claim
is still useful — it just gets marked as such.

Priority order below is the order they are needed. Briefs 1–3 block layer 2.
Brief 4 blocks layer 3. Briefs 5–6 can arrive later.

---

## Brief 1 — Instrument role vocabulary (blocks layer 2)

**Ask:**

> In arranging and orchestration practice, what are the standard FUNCTIONAL
> roles an instrument can occupy in an arrangement? Not instrument families —
> roles. For each role, give the standard name, a one-line definition, and which
> instruments typically take it in (a) orchestral writing and (b) popular /
> electronic production. Cover at minimum: bass/foundation, harmonic bed or pad,
> lead or melody, counter-melody, obbligato, inner voice, doubling, pedal,
> rhythmic drive, colour or ear-candy, and anything standard I have missed.
> Cite the orchestration or arranging texts each role name comes from.

**Return as:** a table — role name, definition, typical orchestral instruments,
typical pop/electronic instruments, source.

**Why:** the cast currently has an ad-hoc role list (bass, drums, pad, lead,
strings, perc). If the real vocabulary is richer, layer 2's relations get
sharper. If it is not, that is worth knowing too.

---

## Brief 2 — Register allocation and masking (blocks layer 2)

**Ask:**

> How do arrangers and mixing engineers decide which instruments can share a
> frequency register without masking each other? Give the practical rules of
> thumb, the approximate frequency ranges of common orchestral and electronic
> instruments, and the standard techniques for separating two sources that
> overlap (octave displacement, thinning, filtering, arrangement spacing). What
> makes two sustained sources in the same register muddy, and what makes the
> same pairing work?

**Return as:** (a) a list of separation techniques with a one-line description
each; (b) a table of instrument → approximate register (low/low-mid/mid/high-mid/
high) and Hz range where known.

**Why:** `masks(a,b)` is the relation the current reconciler cannot compute
because nothing in the codebase knows an instrument's register. This is the
single most valuable brief for making prose musically true — it is the
difference between "supporting strings in the middle plane" and a sentence that
says why those two things can coexist.

---

## Brief 3 — Interaction and interplay vocabulary (blocks layer 2)

**Ask:**

> What are the standard terms for the ways two or more instrument parts relate
> to each other over time? Cover call and response, counterpoint, imitation,
> homophony, heterophony, doubling at the unison and octave, pedal point,
> ostinato, riff, comping, fills, hocketing, and anything standard I have
> missed. For each: definition, what it sounds like, and the conditions under
> which it is used. Then: which of these are common in electronic and
> groove-based popular music as opposed to orchestral writing?

**Return as:** table — term, definition, conditions of use, orchestral or
popular or both, source.

**Why:** the current interplay layer picks from three role-generic categories
(conversation, foundation, arc). This brief tells us whether that is a
reasonable simplification or a severe one.

---

## Brief 4 — Genre convention cards (blocks layer 3)

Run this **once per genre**, not all at once. The genres:

Balearic / downtempo / chillout · ambient and beatless · deep house and
nu-disco · lounge house · trip-hop and downbeat · ethno-ambient and world fusion
(Deep Forest, Sacred Spirit territory) · cinematic and orchestral crossover
(Era, Delerium territory)

**Ask, substituting the genre:**

> Describe the standard arrangement conventions of [GENRE]. What instruments
> typically carry the bass, the harmonic bed, the lead, and the colour? How do
> those parts typically relate — what locks to what, what floats, what answers
> what? What is the typical density and how does it change across a track? What
> would immediately sound wrong to someone who knows the genre? Name specific
> representative artists and records. Where possible, describe a specific track's
> arrangement part by part.

**Return as:** for each genre — a role → typical instrument table; 5–10 bullet
points on how the parts relate; 3–5 things that would sound wrong; and a
worked example of one real track's arrangement.

**Why:** this is the layer no orchestration textbook covers. Adler will not tell
us what a Balearic pad does against a Rhodes. Without these cards the model
defaults to orchestral convention, which is exactly the CONVENTION_BLEED problem
already recorded in `core/knowledge.js`.

**John's own knowledge is the best source here.** If the models come back thin,
his own answers to these questions are worth more than anything they produce.

---

## Brief 5 — How to describe an arrangement in prose (informs layer 3)

**Ask:**

> Where can I find good examples of prose that describes how instruments
> function together in a recording? I am interested in writing that is specific
> and technically accurate rather than impressionistic. Consider: liner notes,
> production analysis, Sound on Sound "Classic Tracks", orchestration treatises,
> arranging manuals, music-theory analyses of popular records. Quote or point to
> a handful of examples of description done WELL, and explain what makes each one
> specific rather than generic.

**Return as:** 10–20 example descriptions with a one-line note on why each works.

**Why:** these become the few-shot examples for layer 3, alongside John's own
validated prompts. The model needs to be shown the difference between specific
and generic, not told about it.

---

## Brief 6 — Suno prompt behaviour (ongoing, lower priority)

**Ask:**

> What is currently known about how Suno interprets style prompts? Specifically:
> how many distinct instruments will it reliably render; does prompt position
> affect prominence; how does it handle instructions about how an instrument is
> played as opposed to which instrument; what makes a negative prompt effective
> or ineffective; does it respond to described relationships between instruments
> at all, or only to instrument names?

**Return as:** claims list, each marked as documented / community consensus /
speculation.

**Why:** `core/knowledge.js` holds what is known. Most of it is John's own
testing, which outranks anything found here — but community findings are worth
having as hypotheses to test.

**Caution:** community consensus has been WRONG twice already in this project.
The tight-tag model tested as hopeless against John's full woven prompts. Treat
everything from this brief as a hypothesis, never as a fact.

---

## What comes back and where it goes

| Brief | Becomes |
|---|---|
| 1 | role taxonomy in the cast |
| 2 | register table + masking rules — a new engine module |
| 3 | relation types in layer 2 |
| 4 | genre convention cards, retrieved per build |
| 5 | few-shot examples for the prose renderer |
| 6 | hypotheses for a future test pack, not facts |

Nothing from any brief ships as fact without either a citation or John's
sign-off. Unsourced material enters as a research candidate and is marked.

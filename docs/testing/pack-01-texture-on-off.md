# Test pack 01 — Texture modifier on vs off

Issued 2026-08-18. First pack written under John's complete-build rule.

## Why the three old packs were thrown away

They were instrumental-only, hand-typed, or changed one variable in isolation.
None of them matched how the app is actually used, so a result from them said
nothing about a real build. This pack does it John's way: **generate everything
from the app, change one setting, change nothing else.**

That means for every run — style field, negative field, app-generated metatags,
lyrics and vocals together. Do not hand-edit a prompt. If a prompt looks wrong,
that is a result, not something to correct before pasting.

## The one question this pack answers

The texture modifier adds one or two named instruments to a build. Base builds
average 6.1 named sources; with a texture pick that goes to about 7.2. Community
consensus says Suno starts dropping voices somewhere around 3–5.

**Does Suno actually render the added instrument, and does adding it cost you
something you already had?**

`VOICE_BUDGET` in the app is deliberately set to `null` and stays that way until
this pack gives a real number. It must not be guessed.

## How to run it

Six pairs. Each pair is two Suno generations. Twelve generations total.

For each pair:

1. Set the engine, character, palette and seed exactly as listed.
2. Leave every other control at its default. Do not touch Detail & Movement.
3. Generate build A (texture off), copy all four fields into Suno, render.
4. Change **only** the texture selectors to build B's setting. Re-generate.
5. Copy all four fields into Suno, render.
6. Answer the three questions below for that pair.

The seed is the same in both halves of a pair, so everything except the texture
clause is identical. If anything else differs, stop — that is a bug and worth
more than the test.

---

## Pair 1 — does a string bed arrive at all?

Balearic Atom · balearic-lush-cinematic · electronic · seed 4242

- **A:** Texture 1 = none, Texture 2 = none
- **B:** Texture 1 = String ensemble — low, Texture 2 = String ensemble — high

Both picks are strings, so the app merges them into one section spanning both
registers. That is deliberate — naming strings twice would tell Suno to render
two string sections.

B adds, after the pads clause:

> a soft string ensemble spanning low and high registers blended into the
> background plane with quiet, sustained timbres

Named sources: 5 → 6.

---

## Pair 2 — two different families at once

Balearic Atom · balearic-lush-cinematic · acoustic · seed 4242

- **A:** none / none
- **B:** Texture 1 = String ensemble — mid, Texture 2 = French horns

B adds two clauses:

> a mid-register string ensemble blended into the background plane with quiet,
> sustained timbres, a soft French horn section adding quiet harmonic
> reinforcement beneath the bed in slow sustained swells

Named sources: 5 → 7. This is the highest-count build in the pack and the most
likely to show dropout.

---

## Pair 3 — plucked plus reed

Balearic Atom · balearic-lush-cinematic · acoustic · seed 4242

- **A:** none / none
- **B:** Texture 1 = Harp, Texture 2 = Alto saxophone

B adds:

> a harp resonating behind the pad, plucked notes enriching the texture, an alto
> saxophone answering the melody with slow sustained countermelodies

Named sources: 5 → 7. The harp is the only pool entry that keeps a percussive
attack; everything else is legato by design. Worth hearing whether Suno renders
the pluck-and-swell or flattens it into a pad.

---

## Pair 4 — texture on an engine that already has orchestral content

Era · Ethereal Ballad · acoustic · seed 4242

- **A:** none / none
- **B:** Texture 1 = String ensemble — low, Texture 2 = Trombones

**The string pick will be refused.** Era's ethereal ballad already draws a
Mellotron string-and-choir pad, and the app will not name strings twice. The
trombones land:

> a soft trombone section restrained in the background with quiet, sustained
> tone

This pair is here to confirm the refusal is the right call. If Suno would have
handled two string layers fine, that changes the rule.

---

## Pair 5 — support vs foundation

Balearic Atom · balearic-lush-cinematic · electronic · seed 91

- **A:** Texture 1 = String ensemble — mid, Texture 2 = none
- **B:** same pick, but lock the pads slot off if the engine offers it; otherwise
  run this pair on a seed where the build has no pad

The prose changes depending on whether a pad survives. With a pad, the strings
are described as sitting under it. With no pad, they are described as the
foundation. This checks that the difference is audible and not just wording.

If you cannot easily produce a no-pad build, skip this pair and say so — it is
the least important of the six.

---

## Pair 6 — instrumental on a resolver engine

Era · Ethereal Ballad · acoustic · seed 4242 · **song type = Instrumental**

- **A:** none / none
- **B:** Texture 1 = Oboes, Texture 2 = none

This one is a bug check, not a texture check. Until today, choosing Instrumental
on Era, Delerium, Deep Forest or Sacred Spirit still put a singer into the style
field. That is fixed. Confirm no vocal appears in either build.

---

## What to write down for each pair

Three questions. Short answers are fine.

1. **Did you hear the added instrument in B?** Yes / faintly / no.
2. **Did anything from A go missing in B?** Name it if so. This is the important
   one — it is how the voice ceiling gets measured.
3. **Is B better or worse as a track?** Your judgement, one line.

Then one overall answer at the end:

4. **What is the highest number of named instruments that still rendered
   cleanly?** That number becomes `VOICE_BUDGET`.

## What not to do

- Do not fix a prompt before pasting it. A bad prompt is a result.
- Do not change two settings between A and B.
- Do not compare across pairs — different characters, different seeds.
- Do not re-roll a Suno generation you did not like. First render counts.

## Prompt lengths

All twelve builds are well inside Suno's style-field limit. Nothing in this pack
is at risk of truncation.

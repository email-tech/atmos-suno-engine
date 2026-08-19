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

## Vocal or instrumental?

**Pairs 1 to 5 are VOCAL builds with lyrics.** Song type = Vocal, lyrics
generated in the app as normal. A test is not valid otherwise — the standing
rule is that a complete build means style field, negative field, app-generated
metatags, lyrics and vocals together, because that is how the app is actually
used. The three old packs were thrown out largely for being instrumental-only.

**Pair 6 is the only instrumental one**, and it is a bug check rather than a
texture check.

### The one thing to be careful about with lyrics

Lyrics come from the language model, so generating them twice gives you two
different sets of words. That would change two things between A and B instead of
one.

**Generate the lyrics once for build A, then paste the exact same lyrics into
build B.** Do not re-generate them.

Metatags are safe to re-generate — they are worked out from the character and
the seed, not from the language model, and texture voices are deliberately kept
out of them. I have checked: metatags come out byte-identical between A and B.
If you ever see them differ, that is a bug worth reporting.

So for each pair the four fields behave like this:

- Style field — differs (this is the thing being tested)
- Negative field — identical
- Metatags — identical
- Lyrics — identical, because you are reusing A's

## How to run it

Six pairs. Each pair is two Suno generations. Twelve generations total.

For each pair:

1. Set the engine, character, palette and seed exactly as listed.
2. Song type = Vocal (except pair 6). Leave every other control at its default.
   Do not touch Detail & Movement.
3. Generate build A with texture off. Generate lyrics. Keep them.
4. Copy all four fields into Suno, render.
5. Change **only** the texture selectors to build B's setting. Re-generate the
   style field. Paste A's lyrics back in.
6. Copy all four fields into Suno, render.
7. Answer the three questions below.

The seed is the same in both halves, so everything except the texture clause is
identical. If anything else differs, stop — that is a bug and worth more than
the test.

---

## Pair 1 — the important one: real strings against synth strings

Balearic Atom · Lush Cinematic Chillout · electronic · seed 4242

- **A:** Texture 1 = none, Texture 2 = none
- **B:** Texture 1 = String ensemble — low, Texture 2 = String ensemble — high

Both picks are strings, so the app merges them into one section spanning both
registers. Naming strings twice would tell Suno to render two string sections.

This build already contains **synth strings**. Until today the app refused a real
string ensemble here, treating the two as the same instrument — which killed the
feature on 11 of the 12 characters on the electronic palette, the main Balearic
use and exactly what your spec asked for. A Solina-style synth pad and an
orchestral section are two different sources and layering them is ordinary
practice, so the refusal was removed.

**That decision is reasoned, not tested. This pair is the test.** If Suno muds
the two string layers together, the refusal goes back in.

B adds, after the harmony clause:

> a soft string ensemble spanning low and high registers blended into the
> background plane with quiet, sustained timbres

Named sources: 5 → 6.

---

## Pair 2 — two different families at once

Balearic Atom · Lush Cinematic Chillout · acoustic · seed 4242

- **A:** none / none
- **B:** Texture 1 = String ensemble — mid, Texture 2 = French horns

B adds two clauses:

> a mid-register string ensemble blended into the background plane with quiet,
> sustained timbres, a soft French horn section adding quiet harmonic
> reinforcement beneath the bed in slow sustained swells

Named sources: 5 → 7. Joint highest count in the pack and the most likely to
show dropout.

---

## Pair 3 — plucked plus reed

Balearic Atom · Deep Nocturnal Balearic · electronic · seed 4242

- **A:** none / none
- **B:** Texture 1 = Harp, Texture 2 = Alto saxophone

B adds:

> a harp resonating behind the pad, plucked notes enriching the texture, an alto
> saxophone answering the melody with slow sustained countermelodies

Named sources: 5 → 7. The harp is the only pool entry that keeps a percussive
attack; everything else is legato by design. Worth hearing whether Suno renders
the pluck-and-swell or flattens it into a pad.

---

## Pair 4 — texture on an engine that already has real orchestral content

Era · Ethereal Ballad · acoustic · seed 4242

- **A:** none / none
- **B:** Texture 1 = String ensemble — low, Texture 2 = Trombones

**The string pick will be refused and the trombones will land.** Era's ethereal
ballad already draws a Mellotron string-and-choir pad, which is a real string
sound rather than a synth emulation, so the app will not name strings twice
here. The trombones have nothing to collide with:

> a soft trombone section restrained in the background with quiet, sustained
> tone

This pair and pair 1 are two halves of the same question — pair 1 allows the
layering, pair 4 refuses it. Comparing them tells us whether the line is drawn
in the right place.

---

## Pair 5 — support vs foundation

Balearic Atom · Ambient Beatless Atmospheric · acoustic · seed 91

- **A:** none / none
- **B:** Texture 1 = String ensemble — mid, Texture 2 = none

The prose changes depending on whether a pad survives in the build. With a pad,
the strings are described as sitting under it. With no pad, they are described
as the foundation. This checks the difference is audible and not just wording.

Beatless character chosen on purpose — with no drums there is nowhere for a
weak string layer to hide.

---

## Pair 6 — instrumental on a resolver engine

Era · Ethereal Ballad · acoustic · seed 4242 · **song type = Instrumental**

- **A:** none / none
- **B:** Texture 1 = Oboes, Texture 2 = none

A bug check, not a texture check. Until today, choosing Instrumental on Era,
Delerium, Deep Forest or Sacred Spirit still put a singer into the style field.
That is fixed. Confirm no vocal appears in either build, and that the lyrics
field reads `[Instrumental]`.

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

# Suno research pack — instrument placement, 2026-08-15

**This is a different kind of pack from the round 4/5/6 test packs.** Those
test whether ATMOS's own output sounds right. This one tests **Suno itself**
— the open question from today's session: does an instrument need to be
named in the *style* field to be "available" for a metatag to bring it in
later, or can a metatag introduce an instrument style never mentioned at
all? And separately: how many named instruments does Suno actually render
before it starts dropping some?

Web research (cross-checked across ~8 independent 2026 guides) says Suno
reliably renders only **~3-5 named instruments** before it starts
prioritizing some and silently dropping others, and that the style field
truncates silently past its character cap — no error, content just isn't
read. Community sources, not Suno-official, and not yet tested against
*this* app's output. That's what this pack is for.

**Honesty note on Tests B and C:** A and D below are real, unmodified
`generate()` output (organic-warm-downtempo, acoustic, seed 26 and seed 3).
B and C are **hand-built diagnostic variants of A** — the app has no feature
to introduce an instrument via metatag only, because that is precisely the
behaviour being tested, not a feature. Built from A's real base, not
invented from scratch. Tenor saxophone was picked deliberately: it's
expert-tier in `core/instruments.js` (parked, never drawn automatically), so
it's a genuinely fresh mention with nothing else in the prompt biasing
toward it — not a proposal to add it to the automatic pools.

---

## Test A — control (real, unmodified)

Confirms the base 4-instrument build is clean before touching anything.

```
Balearic downtempo, 80-100 BPM, low-mid energy, double bass and live drum kit, locked tight together, lap-steel guitar on the melody out front, string ensemble, moving through a suspended-to-major resolution, tempo-synced delay throws, chords resolve behind the melody, builds to a peak then thins out, Polished Dolby Atmos-Master Atmos -2dB
```
**Exclude:** `orchestral drums, staccato strings, brass stabs, field recordings, air texture`

**Metatags:**
```
[Intro | sustained only | slow build]
[Verse | sparse | lap-steel guitar | steady groove]
[Chorus | full arrangement | bass and drums locked]
[Verse | sparse | lap-steel guitar | steady groove]
[Chorus | full arrangement | bass and drums locked]
[Outro | thinning out | reverb tail]
```
**Check:** four instruments only — double bass, drum kit, lap-steel guitar,
string ensemble. Nothing else should be audible anywhere in the track.

---

## Test B — metatag-only introduction (hand-built from A)

Same style field as A, **byte-identical, nothing added**. Only the metatags
differ: a bridge section is inserted that introduces tenor saxophone — an
instrument named nowhere in style.

```
Balearic downtempo, 80-100 BPM, low-mid energy, double bass and live drum kit, locked tight together, lap-steel guitar on the melody out front, string ensemble, moving through a suspended-to-major resolution, tempo-synced delay throws, chords resolve behind the melody, builds to a peak then thins out, Polished Dolby Atmos-Master Atmos -2dB
```
**Exclude:** `orchestral drums, staccato strings, brass stabs, field recordings, air texture`

**Metatags:**
```
[Intro | sustained only | slow build]
[Verse | sparse | lap-steel guitar | steady groove]
[Chorus | full arrangement | bass and drums locked]
[Bridge | stripped back | tenor saxophone enters, brief solo | drums out]
[Verse | sparse | lap-steel guitar | steady groove]
[Chorus | full arrangement | bass and drums locked]
[Outro | thinning out | reverb tail]
```
**The question:** does a tenor saxophone actually appear at the bridge, with
nothing in the style field pointing at it? If yes — metatags alone can
introduce an instrument. If no (bridge just thins out with no sax, or the
model reaches for something else woodwind-ish) — style naming is a
prerequisite and metatags can only shape *when*, not *what*.

---

## Test C — named in style, gated by metatag (hand-built from A)

Tenor saxophone now added to the END of the style field (deliberately
low-position, per the existing position-is-prominence finding) — a 5th
instrument. Metatags are identical to B: saxophone mentioned **only** at
the bridge, omitted everywhere else.

```
Balearic downtempo, 80-100 BPM, low-mid energy, double bass and live drum kit, locked tight together, lap-steel guitar on the melody out front, string ensemble, moving through a suspended-to-major resolution, tempo-synced delay throws, chords resolve behind the melody, builds to a peak then thins out, Polished Dolby Atmos-Master Atmos -2dB, tenor saxophone
```
**Exclude:** `orchestral drums, staccato strings, brass stabs, field recordings, air texture`

**Metatags:**
```
[Intro | sustained only | slow build]
[Verse | sparse | lap-steel guitar | steady groove]
[Chorus | full arrangement | bass and drums locked]
[Bridge | stripped back | tenor saxophone enters, brief solo | drums out]
[Verse | sparse | lap-steel guitar | steady groove]
[Chorus | full arrangement | bass and drums locked]
[Outro | thinning out | reverb tail]
```
**The question:** two things to listen for. (1) Does the sax reliably
appear at the bridge now that it's named in style too — more reliably than
B? (2) Does it *stay scoped* to the bridge, or does naming it in style
cause it to bleed into verses/choruses where the metatag never mentions it?
(2) is the one that actually matters for the "full cast in style, metatags
switch it in/out" model — if naming in style makes it bleed everywhere
regardless of metatags, that model doesn't work as hoped.

---

## Test D — crowding ceiling (real, unmodified)

Same character, a seed where 8 roles fire at once — the "everything on"
case role budget is now supposed to make rare, but still possible.

```
Balearic downtempo, 80-100 BPM, low-mid energy, fretless bass and brushed drum kit, locked tight together, shakers over the groove, nylon guitar on the melody out front, mellotron, moving through ii-V-i in a minor key, felt piano sustained underneath, Rhodes, faint and buried well under the mix, answering the lead only occasionally, glockenspiel in the gaps, tape-saturated warmth, chords resolve behind the melody, builds to a peak then thins out, Polished Dolby Atmos-Master Atmos -2dB
```
**Exclude:** `orchestral drums, staccato strings, brass stabs, field recordings, air texture`

**8 named instruments, in this order:** fretless bass, brushed drum kit,
shakers, nylon guitar, mellotron, felt piano, Rhodes, glockenspiel.

**The question:** which of these 8 actually render? If the ~3-5 ceiling from
research holds here too, expect roughly the first 4-5 in that list to come
through clearly and the last few (Rhodes counter, glockenspiel colour) to
be quiet, absent, or replaced with something generic. If position tracks
with survival, that's the same lever `POSITION_IS_PROMINENCE` already
established — just confirming it also predicts *complete absence*, not only
volume.

---

## What to report back

For each test: what you actually heard, instrument by instrument, and
whether it matches what's named above. For B/C specifically — timestamp
roughly where (if at all) the saxophone shows up. That's the whole
experiment; no need to grade or score anything else about these four.

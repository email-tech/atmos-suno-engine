# Suno research pack — composer as flavour, and the metatag lever
2026-08-17. John's brief: *"They are to be a flavour and not the dominant sound...
the composer's fingerprint should be noticeable but subtle at the same time...
we should try and test a small amount in combination with metatags to see if we
can introduce a few more instruments for flavour by nominating them by using the
metatag lever."*

## What this pack is for

Four prompts, same character, same seed, same negative field. The style field is
the only thing that changes between them, apart from the metatags. So the
question is answerable by listening rather than by argument.

Two things are being tested at once, deliberately, because they are the same
question from two sides:

1. **Does the metatag lever work at all for a NEW instrument?** This overlaps
   Test B in the 2026-08-15 pack and does not replace it — run that one too, it
   is the cleaner single-variable version. If metatags cannot introduce an
   instrument, E3 below will sound identical to E0 and the flavour idea is dead.
2. **Does moving an instrument OUT of the style field and INTO a metatag make it
   subtler?** That is the actual thing John wants. An instrument named in the
   style field is on the whole track; the same instrument named in one section's
   metatag should be a moment rather than a texture.

## The composer under test

Hans Zimmer, on Sunlit Mediterranean (acoustic), seed 11. Chosen because it is
the layer John already tested and reported as having no effect, and because its
instruments — low strings, French horns, trombones — are exactly the ones most
likely to dominate.

## A note on the articulation wording

E1–E3 name the brass and strings with an explicit **long legato** instruction,
per John's 2026-08-17 rule that a composer's classical instruments must be long
legato notes and never crisp, staccato or accented. That wording is PROPOSED,
not taken from the linking guide, and is one of the things this pack is testing.
If the legato instruction does not survive, that is a result worth having before
it goes into the engine.

The negative field keeps `staccato strings, brass stabs` in all four prompts.
That is not a contradiction with naming strings and brass — it is the other half
of the same instruction: name the instrument, ban the articulation we do not
want. (An earlier session called this self-contradictory. It is not, once the
articulation is specified.)

---

## E0 — control, no composer (real, unmodified app output)

```
Balearic downtempo, 100-118 BPM, medium energy, fretless bass and cajón kit, locked tight together, Rhodes on the melody out front, mellotron, moving through I-V-vi-IV, tape-saturated warmth, chords resolve behind the melody, builds to a peak then thins out, Polished Dolby Atmos-Master Atmos -2dB
```
**Exclude:** `orchestral drums, staccato strings, brass stabs, field recordings, air texture`

**Metatags:**
```
[Intro | sustained only | slow build]
[Verse | sparse | Rhodes | steady groove]
[Chorus | full arrangement | bass and drums locked]
[Bridge | stripped back | mellotron holds]
[Verse | sparse | Rhodes | steady groove]
[Chorus | full arrangement | bass and drums locked]
[Outro | thinning out | reverb tail]
```
**Check:** four sources only — fretless bass, cajón kit, Rhodes, mellotron.
This is the reference the other three are judged against.

---

## E1 — full style footprint (real, unmodified app output at HEAD)

Three composer instruments in the style field. This is what the app produces
today and it is the **dominance baseline**: if Zimmer is too loud anywhere, it
should be loudest here.

```
Balearic downtempo, 100-118 BPM, medium energy, fretless bass and cajón kit, locked tight together, Rhodes on the melody out front, mellotron, moving through I-V-vi-IV, tape-saturated warmth, chords resolve behind the melody, builds to a peak then thins out, blended long legato low strings background plane with quiet, sustained timbres, soft long legato French horns resonance in the background to enrich the texture, supporting long legato trombones in the middle plane with gentle motion, Polished Dolby Atmos-Master Atmos -2dB
```
**Exclude:** `orchestral drums, staccato strings, brass stabs, field recordings, air texture`

**Metatags:** same as E0.

**Check:** are the strings and brass *background flavour*, or have they taken
over the arrangement? Is the Balearic character still the song? Do they play
long held notes, or short accented ones despite the instruction?

---

## E2 — minimum style footprint, rest on the metatag lever (hand-built)

**One** composer instrument in the style field. The other two are named only in
the metatags, and only in specific sections.

```
Balearic downtempo, 100-118 BPM, medium energy, fretless bass and cajón kit, locked tight together, Rhodes on the melody out front, mellotron, moving through I-V-vi-IV, tape-saturated warmth, chords resolve behind the melody, builds to a peak then thins out, blended long legato low strings background plane with quiet, sustained timbres, Polished Dolby Atmos-Master Atmos -2dB
```
**Exclude:** `orchestral drums, staccato strings, brass stabs, field recordings, air texture`

**Metatags:**
```
[Intro | sustained only | slow build]
[Verse | sparse | Rhodes | steady groove]
[Chorus | full arrangement | bass and drums locked | long legato French horns swell underneath]
[Bridge | stripped back | mellotron holds | long legato trombones hold one low chord]
[Verse | sparse | Rhodes | steady groove]
[Chorus | full arrangement | bass and drums locked | long legato French horns swell underneath]
[Outro | thinning out | reverb tail]
```
**Check:** do the French horns appear at the choruses and the trombones at the
bridge? If yes, are they subtler than in E1 — noticeable but not dominant? This
is the prompt that would become the new default if it works.

---

## E3 — composer entirely on the metatag lever (hand-built)

**Nothing** from the composer in the style field. The style field is byte-identical
to E0.

```
Balearic downtempo, 100-118 BPM, medium energy, fretless bass and cajón kit, locked tight together, Rhodes on the melody out front, mellotron, moving through I-V-vi-IV, tape-saturated warmth, chords resolve behind the melody, builds to a peak then thins out, Polished Dolby Atmos-Master Atmos -2dB
```
**Exclude:** `orchestral drums, staccato strings, brass stabs, field recordings, air texture`

**Metatags:**
```
[Intro | sustained only | slow build | long legato low strings enter quietly]
[Verse | sparse | Rhodes | steady groove]
[Chorus | full arrangement | bass and drums locked | long legato French horns swell underneath]
[Bridge | stripped back | long legato trombones hold one low chord]
[Verse | sparse | Rhodes | steady groove]
[Chorus | full arrangement | bass and drums locked | long legato French horns swell underneath]
[Outro | thinning out | long legato low strings fade]
```
**Check:** is Zimmer present at all? If E3 is indistinguishable from E0, the
metatag lever cannot introduce instruments and the composer's whole contribution
has to live in the style field, which caps it at two or three voices and makes
the choice of WHICH ones the entire design problem.

---

## What to report back

Per prompt, a line or two is enough:

1. **E1** — did the strings and brass dominate? Long notes or short?
2. **E2** — did the horns arrive at the choruses and the trombones at the bridge?
   Subtler than E1?
3. **E3** — was the composer audible at all with nothing in the style field?
4. Across all four — did the legato instruction hold, or did Suno play them
   short and accented regardless?
5. Any of the four where the Balearic character stopped being the song.

## What each outcome changes in the engine

- **E3 works** → composer contribution moves mostly to metatags; the style field
  keeps one signature voice. This is the cheapest possible fix for dominance and
  it also frees style-field slots for the character's own instruments.
- **E3 fails but E2 works** → the split is right: one voice named in style, the
  rest introduced per-section. Note this only proves metatags can direct an
  instrument the style *implies* by family, not a wholly new one.
- **Both fail** → the composer is capped at two or three style-field voices for
  good, and the work becomes choosing the two that read as fingerprint without
  dominating. Under John's rule that means the quiet sustained ones, and the
  struck/percussive instruments come out of the composer layers entirely.
- **Legato instruction ignored** → naming an orchestral instrument imports its
  default articulation regardless of wording, which would be a new empirical
  fact for `core/knowledge.js` and a hard constraint on every composer layer.

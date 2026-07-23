# ATMOS Suno retest — round 4b (Block A only)

Same base character and same seed as round 4, so this is a clean A/B against what
you just heard. Three things changed: duplicate voices removed, the residual
second beds removed, and orchestral-defence negatives added.

**The Exclude field matters more than usual this time** — it is doing the work
against the staccato/stabs/orchestral-drums problem. Paste it in full.

---

### A1 — BASE, no modifier (unchanged, for reference)
```
Balearic downtempo, 100-118 BPM, medium energy, upright bass and cajón kit, locked tight together, frame drum over the groove, flugelhorn on the melody out front, harmonium, moving through sus2 into major voicings, cello under the melody, nylon guitar sustained underneath, French horn, faint and buried well under the mix, answering the lead only occasionally, marimba in the gaps, bright reverb, chords resolve behind the melody, builds to a peak then thins out, Polished Dolby Atmos-Master Atmos -2dB
```
**Exclude:** `field recordings, air texture, room tone, foley, sound effects, vinyl crackle, tape hiss, nature sounds, ambient noise`

*Only re-run if you want the reference fresh in your ear. Nothing changed here.*

---

### A2b — Horner (was 3 French horns, now 1)
```
Balearic downtempo, 100-118 BPM, medium energy, upright bass and cajón kit, locked tight together, frame drum over the groove, a string section with held french horns swelling together in slow rich chords well behind the melody, moving through sus2 into major voicings, cello under the melody, nylon guitar sustained underneath, a soaring long-breathed solo violin melody, marimba in the gaps, bright reverb, the melody rises to one sustained peak, chords resolve behind the melody, Polished Dolby Atmos-Master Atmos -2dB
```
**Exclude:** `field recordings, air texture, room tone, foley, sound effects, vinyl crackle, tape hiss, nature sounds, ambient noise, staccato strings, string stabs, brass stabs, orchestral stabs, orchestral hits, orchestral percussion, timpani, orchestral drums, marching percussion, symphonic arrangement, cinematic orchestral production, film score production, full orchestra, orchestral crescendo`

**Changed:** one French horn instead of three. **The nylon guitar is back** — it had been displaced. 88 characters shorter.
**Listen for:** are the staccato strings and horn stabs gone? Is it still leaning orchestral?

---

### A3b — Barry (was 3 French horns, now 2)
```
Balearic downtempo, 100-118 BPM, medium energy, upright bass and cajón kit, locked tight together, frame drum over the groove, a string section with held french horns swelling together in slow rich chords well behind the melody, moving through sus2 into major voicings, cello under the melody, nylon guitar sustained underneath, a broad lyrical melody carried on solo horn, a soft vibraphone shimmer low in the mix, bright reverb, one long statement, no climax, chords resolve behind the melody, Polished Dolby Atmos-Master Atmos -2dB
```
**Exclude:** *(same long list as A2b)*

**Changed:** the two horns left are the bed's held horns and Barry's own solo horn — that pairing is real Barry orchestration, so I kept it deliberately. The conflicting third is gone, and the nylon guitar is back.
**Listen for:** do the horns still sound "at odds"? Does the string bed still arrive late, or earlier now that there is less competing for the opening?

---

### A4b — Zimmer (doubled cello fixed)
```
Balearic downtempo, 100-118 BPM, medium energy, upright bass and cajón kit, locked tight together, frame drum over the groove, a hybrid synth-and-strings pad building slowly into wide sustained chords underneath, moving through sus2 into major voicings, nylon guitar sustained underneath, French horn, faint and buried well under the mix, answering the lead only occasionally, a solo cello line over the ostinato, stacked ostinato layers building quietly bar by bar under the melody, bright reverb, builds to a unison then one resolving chord, chords resolve behind the melody, Polished Dolby Atmos-Master Atmos -2dB
```
**Exclude:** *(same long list as A2b)*

**Changed:** the cello is named once, not twice. Nylon guitar and French horn are back from the character.
**Listen for:** this was your worst case — only drums and bass survived from Balearic. Does more of the Balearic character survive now? Did the orchestral drums stop?

---

## What I did NOT change, on purpose

Three things you flagged are still open, because each needs a decision rather than a guess:

1. **Composer instruments too front and centre (A3, A4).** This is a *position* problem — Suno front-weights, and the bed currently sits at position four, right after the drums. Your A1 complaint is the same lever in reverse: the marimba, cello and horn were inaudible because they sit late. Moving composer content after the character's identity voices, and character decoration earlier, is cheap to try — but it changes every prompt, so I want a test to confirm the direction first.

2. **The genre's own lead is still replaced by the composer's solo** (flugelhorn → violin here; Rhodes → horn on nu-disco). Your model says the genre signature should stay. The fix isn't just protecting the lead slot, because the composer's solo lives in that same slot — it needs a separate "solo" slot so both can coexist. Real change to the atom model, so it wants your go-ahead.

3. **Metatags** — you raised them twice, for making buried character instruments audible and for controlling when the bed enters. The engine exists and metatag format has tested well before. Unbuilt.

On your articulation point: I read "undesirable **for the Balearic engine**" as engine-conditional, not universal — Todd Terry's chopped stabs and Pettibone's echo stabs genuinely are their fingerprints in a dance context, so I left those alone rather than stripping the language globally. If you want it gone everywhere, say so.

# ATMOS Suno test pack — round 5 (complete set)

Everything below is generated from `main` at commit `80dfe3a`. Same base characters
and same seeds as round 4, so A1–A4 are a direct A/B against what you already heard.

**Paste the Exclude list exactly as given.** It is now capped at 5 elements and
ranked by harm, per your finding that the field loses effectiveness beyond that.
For composer tests the 5 slots are all genre-defence; the cosmetic bans (field
recordings, foley) have been pushed out because they have never once caused a
genre failure and were consuming slots that mattered.

---

## What changed since round 4

| Your finding | What was done |
|---|---|
| French horn named 3× | Cross-family de-dupe. Horner now 1, Barry 2 (bed + his own solo horn — real Barry orchestration) |
| Ostinato / stabs / staccato | Banned globally in code. 35 modifier atoms + 7 engine-pool entries rewritten. A validator now fails the build if any returns |
| Negatives ineffective past ~5 | Capped at 5, ranked by observed harm |
| Composer instruments too front | Modifier beds moved to your guide's **background plane** |
| Couldn't hear marimba / cello / horn | Character voices moved to your guide's **middle plane** |
| Second beds stacking | 86 residual sustaining atoms removed — Phase A had missed them |

---

## Block A — Balearic "Sunlit Mediterranean", acoustic, seed 20260723

### A1 — BASE, no modifier (control)
```
Balearic downtempo, 100-118 BPM, medium energy, upright bass and cajón kit, locked tight together, frame drum over the groove, flugelhorn on the melody out front, harmonium, moving through sus2 into major voicings, supporting cello in the middle plane with gentle motion, nylon guitar sustained underneath, French horn, faint and buried well under the mix, answering the lead only occasionally, marimba in the gaps, bright reverb, chords resolve behind the melody, builds to a peak then thins out, Polished Dolby Atmos-Master Atmos -2dB
```
**Exclude:** `field recordings, air texture, room tone, foley, sound effects`

**The question:** can you now hear the cello and the marimba? This is the direct
test of the middle-plane change against your A1 report.

### A2 — Horner
```
Balearic downtempo, 100-118 BPM, medium energy, upright bass and cajón kit, locked tight together, frame drum over the groove, a string section with held french horns swelling together in slow rich chords, blended strings background plane with quiet, sustained timbres, moving through sus2 into major voicings, supporting cello in the middle plane with gentle motion, nylon guitar sustained underneath, a soaring long-breathed solo violin melody, marimba in the gaps, bright reverb, the melody rises to one sustained peak, chords resolve behind the melody, Polished Dolby Atmos-Master Atmos -2dB
```
**Exclude:** `staccato strings, brass stabs, orchestral hits, orchestral drums, symphonic arrangement`

**The question:** staccato strings and horn stabs gone? Is the string bed sitting
*behind* now rather than front and centre?

### A3 — Barry
```
Balearic downtempo, 100-118 BPM, medium energy, upright bass and cajón kit, locked tight together, frame drum over the groove, a string section with held french horns swelling together in slow rich chords, blended strings background plane with quiet, sustained timbres, moving through sus2 into major voicings, supporting cello in the middle plane with gentle motion, nylon guitar sustained underneath, a broad lyrical melody carried on solo horn, a soft vibraphone shimmer low in the mix, bright reverb, one long statement, no climax, chords resolve behind the melody, Polished Dolby Atmos-Master Atmos -2dB
```
**Exclude:** `staccato strings, brass stabs, orchestral hits, orchestral drums, symphonic arrangement`

**The question:** do the horns still sound at odds? Does the string bed arrive
early now, or still halfway through?

### A4 — Zimmer (your worst case in round 4)
```
Balearic downtempo, 100-118 BPM, medium energy, upright bass and cajón kit, locked tight together, frame drum over the groove, a hybrid synth-and-strings pad building slowly into wide sustained chords, blended strings background plane with quiet, sustained timbres, moving through sus2 into major voicings, nylon guitar sustained underneath, French horn, faint and buried well under the mix, answering the lead only occasionally, a solo cello line over the repeating figure, stacked repeating figures building quietly bar by bar under the melody, bright reverb, builds to a unison then one resolving chord, chords resolve behind the melody, Polished Dolby Atmos-Master Atmos -2dB
```
**Exclude:** `staccato strings, brass stabs, orchestral hits, orchestral drums, symphonic arrangement`

**The question:** round 4 left you only drums and bass from Balearic, with
orchestral drums appearing as energy built. How much Balearic survives now? Note
"ostinato" is gone — it reads "repeating figure".

### A5 — Newman (new; his solo is felt piano, a different test)
```
Balearic downtempo, 100-118 BPM, medium energy, upright bass and cajón kit, locked tight together, frame drum over the groove, a muted mid-register string section swelling slowly and sitting low, blended strings background plane with quiet, sustained timbres, moving through sus2 into major voicings, supporting cello in the middle plane with gentle motion, nylon guitar sustained underneath, French horn, faint and buried well under the mix, answering the lead only occasionally, a sparse solo felt-piano melody, a hammered-dulcimer and marimba figure ticking quietly under the melody, bright reverb, the repeating figure drops out then returns alone, chords resolve behind the melody, Polished Dolby Atmos-Master Atmos -2dB
```
**Exclude:** `staccato strings, brass stabs, orchestral hits, orchestral drums, symphonic arrangement`

**The question:** Newman's bed is muted strings, his fingerprint a felt piano with
dulcimer/marimba decoration. Does a piano-led composer intrude less than a
horn/violin-led one? If so, the problem is specifically orchestral *sections*.

---

## Block B — producers on the same base (untested in round 4)

*Your model: a producer keeps the genre core and reshapes movement, rhythm and
vocal behaviour, rather than adding orchestral voices.*

### B1 — Stuart Price (movement), electronic palette
```
Balearic downtempo, 100-118 BPM, medium energy, analog synth bass and downtempo kit, locked tight together, synth clap over the groove, synth lead on the melody out front, choir pad, moving through sus2 into major voicings, supporting string-machine ensemble in the middle plane with gentle motion, drone synth sustained underneath, Hammond organ, faint and buried well under the mix, answering the lead only occasionally, synth marimba in the gaps, tempo-synced delay, chords resolve behind the melody, builds to a peak then thins out, Polished Dolby Atmos-Master Atmos -2dB
```
**Exclude:** `field recordings, air texture, room tone, foley, sound effects`

### B2 — Quincy Jones (horns + vocal stacks), acoustic
```
Balearic downtempo, 100-118 BPM, medium energy, upright bass and cajón kit, locked tight together, frame drum over the groove, a soulful melodic line on the melody out front, a held brass chorale entering slowly and sustaining low, blended brass background plane with quiet, sustained timbres, moving through sus2 into major voicings, supporting cello in the middle plane with gentle motion, nylon guitar sustained underneath, French horn, faint and buried well under the mix, answering the lead only occasionally, stacked backing harmonies answering behind the lead, bright reverb, a final chorus with horns and voices together, chords resolve behind the melody, Polished Dolby Atmos-Master Atmos -2dB
```
**Exclude:** `field recordings, air texture, room tone, foley, sound effects`

**The question:** Quincy is the producer closest to instrumentation. Does he stay
"Balearic, produced by Quincy," or tip into another genre like the composers did?

---

## Block C — generalisation: nu-disco base, seed 55501234

### C1 — BASE, no modifier (control)
```
nu-disco, 100-120 BPM, medium-high energy, sub bass and disco four-on-the-floor kit, locked tight together, electro shaker over the groove, Rhodes on the melody out front, analog synth pads, moving through seventh and ninth chords, supporting synth strings in the middle plane with gentle motion, drone synth sustained underneath, Hammond organ, faint and buried well under the mix, answering the lead only occasionally, glassy mallet synth in the gaps, wide stereo panning, chords resolve behind the melody, builds to a peak then thins out, Polished Dolby Atmos-Master Atmos -2dB
```
**Exclude:** `field recordings, air texture, room tone, foley, sound effects`

### C2 — Barry on nu-disco (composer)
```
nu-disco, 100-120 BPM, medium-high energy, sub bass and disco four-on-the-floor kit, locked tight together, electro shaker over the groove, a hybrid synth-and-strings pad building slowly into wide sustained chords, blended strings background plane with quiet, sustained timbres, moving through seventh and ninth chords, supporting synth strings in the middle plane with gentle motion, drone synth sustained underneath, Hammond organ, faint and buried well under the mix, answering the lead only occasionally, a broad lyrical melody carried on solo horn, a soft vibraphone shimmer low in the mix, wide stereo panning, one long statement, no climax, chords resolve behind the melody, Polished Dolby Atmos-Master Atmos -2dB
```
**Exclude:** `staccato strings, brass stabs, orchestral hits, orchestral drums, symphonic arrangement`

**Note:** the Rhodes lead is still replaced by Barry's solo horn. That's the one
outstanding item from your model I have *not* fixed — see below.

### C3 — Price on nu-disco (producer)
```
nu-disco, 100-120 BPM, medium-high energy, sub bass and disco four-on-the-floor kit, locked tight together, electro shaker over the groove, Rhodes on the melody out front, a deep filtered synth pad opening slowly across long held chords, low in the mix, moving through seventh and ninth chords, supporting synth strings in the middle plane with gentle motion, drone synth sustained underneath, Hammond organ, faint and buried well under the mix, answering the lead only occasionally, sustained chords ducking and pumping in time with the kick, wide stereo panning, the pump deepening as the arrangement fills out, chords resolve behind the melody, Polished Dolby Atmos-Master Atmos -2dB
```
**Exclude:** `field recordings, air texture, room tone, foley, sound effects`

**The contrast that matters:** C3 keeps the Rhodes lead, C2 loses it. Same base,
same seed. That is the composer/producer asymmetry in one pair.

### C4 — Oliver Nelson (remixer)
```
nu-disco, 100-120 BPM, medium-high energy, a plucky disco bassline and disco four-on-the-floor kit, locked tight together, crisp live-feel percussion layers over the groove, Rhodes on the melody out front, a warm analog synth pad fading in slowly and holding wide chords under the mix, moving through seventh and ninth chords, supporting synth strings in the middle plane with gentle motion, drone synth sustained underneath, Hammond organ, faint and buried well under the mix, answering the lead only occasionally, filtered disco string swells rising under the groove, wide stereo panning, a smooth filter build into the chorus, chords resolve behind the melody, Polished Dolby Atmos-Master Atmos -2dB
```
**Exclude:** `field recordings, air texture, room tone, foley, sound effects`

**The question:** a remixer replaces the bassline (his craft). Does the nu-disco
identity survive that, and does his fingerprint read as a remix rather than a
different song?

---

## What I still have NOT fixed, and why

1. **The genre's lead is still replaced by the composer's solo** (flugelhorn →
   violin in A2; Rhodes → horn in C2). Your model says the genre signature should
   stay. The fix is not simply protecting the lead slot, because the composer's
   solo *lives in* that slot — it needs a separate "solo" family so both coexist.
   Real change to the atom model; I want your ear on A2/C2 first to confirm the
   loss actually hurts.

2. **Bed entry timing** (your A3: the string bed didn't arrive until halfway).
   Almost certainly a structure/metatag problem, not a style-string one.

3. **The metatag prominence layer.** You've raised it three times. It's the next
   substantial build after the electronic linking research.

## Things to note while testing

- The negative list is now 5 items. If you still find yourself needing to
  front-load or trim, tell me the working number and I'll change the cap — it's a
  single constant in `core/knowledge.js` and the whole app follows it.
- Producers and remixers get *no* orchestral defence (they import no orchestral
  instruments), so their 5 slots hold the cosmetic bans. If a producer test shows
  genre bleed, that assumption is wrong and I'll rank differently.
- "Ostinato" is gone everywhere — you'll see "repeating figure" in A4 and A5.

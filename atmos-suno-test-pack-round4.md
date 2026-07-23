# ATMOS Suno test pack — round 4

**What this round settles:** whether the rebuilt modifiers (Phase A bed layer +
Phase B solo-signature layer) now **flavour** a character instead of **hijacking**
it — the round-2 / round-3 failure — and whether the result matches the use-case
model you described (genre stays the genre; composer adds a bed + a solo or two;
producer reshapes movement/rhythm/vocal, not orchestration).

**How to run:** paste each Style prompt as-is. Put the Negative into Suno's Exclude
field. No lyrics needed — instrumental is fine for judging arrangement. **Same base
character and same seed within each block**, so any difference you hear is the
modifier, nothing else.

Two questions to hold in your ear throughout:
1. Does the track still sound like the base genre (drums, bass, groove, feel)?
2. Is the modifier's flavour **present but subordinate**, or does it take over?

---

## Block A — Balearic base "Sunlit Mediterranean" (acoustic), seed 20260723

### A1 — BASE, no modifier (control)
```
Balearic downtempo, 100-118 BPM, medium energy, upright bass and cajón kit, locked tight together, frame drum over the groove, flugelhorn on the melody out front, harmonium, moving through sus2 into major voicings, cello under the melody, nylon guitar sustained underneath, French horn, faint and buried well under the mix, answering the lead only occasionally, marimba in the gaps, bright reverb, chords resolve behind the melody, builds to a peak then thins out, Polished Dolby Atmos-Master Atmos -2dB
```
Exclude: `field recordings, air texture, room tone, foley, sound effects, vinyl crackle, tape hiss, nature sounds, ambient noise`

*This is the reference. Note the flugelhorn lead, the nylon guitar, the cajón groove — that is the Balearic identity the modifiers below should preserve.*

### A2 — + Thomas Newman is NOT here on purpose
*(Newman's solo is felt-piano; it reads clearest on a different base. Skipped to keep the block tight.)*

### A2 — + James Horner (violin solo)
```
Balearic downtempo, 100-118 BPM, medium energy, upright bass and cajón kit, locked tight together, frame drum over the groove, a string section with held french horns swelling together in slow rich chords well behind the melody, moving through sus2 into major voicings, cello under the melody, French horn sustained underneath, French horn, faint and buried well under the mix, answering the lead only occasionally, a soaring long-breathed solo violin melody, marimba in the gaps, bright reverb, the melody rises to one sustained peak, chords resolve behind the melody, Polished Dolby Atmos-Master Atmos -2dB
```
Exclude: `field recordings, air texture, room tone, foley, sound effects, vinyl crackle, tape hiss, nature sounds, ambient noise`

**Listen for:** Is the cajón/upright-bass groove still there (genre retained)? Does the Horner string bed + solo violin **sit on top** of the Balearic track, or replace it? **Note:** in this build the composer bed also displaced the flugelhorn lead — the violin is now carrying the melody, not decorating it. That is the open question below; tell me whether losing the flugelhorn hurt it.

### A3 — + John Barry (horn solo)
```
Balearic downtempo, 100-118 BPM, medium energy, upright bass and cajón kit, locked tight together, frame drum over the groove, a string section with held french horns swelling together in slow rich chords well behind the melody, moving through sus2 into major voicings, cello under the melody, French horn and oboe sustained underneath, French horn, faint and buried well under the mix, answering the lead only occasionally, a broad lyrical melody carried on solo horn, a soft vibraphone shimmer low in the mix, bright reverb, one long statement, no climax, chords resolve behind the melody, Polished Dolby Atmos-Master Atmos -2dB
```
Exclude: `field recordings, air texture, room tone, foley, sound effects, vinyl crackle, tape hiss, nature sounds, ambient noise`

**Listen for:** A3 vs A2 — same base, different composer. Do Barry (strings + horns bed, solo horn, level dynamics) and Horner (string bed, solo violin, one rising peak) sound **distinctly different** while both still sounding Balearic? If they blur together, the composer identities aren't landing.

### A4 — + Hans Zimmer (cello solo)
```
Balearic downtempo, 100-118 BPM, medium energy, upright bass and cajón kit, locked tight together, frame drum over the groove, a hybrid synth-and-strings pad building slowly into wide sustained chords underneath, moving through sus2 into major voicings, a solo cello line under the melody, a synth-orchestra hybrid layer sustained underneath, French horn, faint and buried well under the mix, answering the lead only occasionally, a solo cello line over the ostinato, stacked ostinato layers building quietly bar by bar under the melody, bright reverb, builds to a unison then one resolving chord, chords resolve behind the melody, Polished Dolby Atmos-Master Atmos -2dB
```
Exclude: `field recordings, air texture, room tone, foley, sound effects, vinyl crackle, tape hiss, nature sounds, ambient noise`

**Listen for:** Zimmer's palette-gate swapped his synth pad for the hybrid bed on this acoustic base — does the hybrid bed still sit under a Balearic track, or does it drag it toward Zimmer's world? Also: "a solo cello line" appears **twice** here (once from the character's own cello slot, once as Zimmer's solo). Does that read as one cello or two competing ones? This tells me whether the character-side and modifier-side need de-duplicating.

---

## Block B — Producer modifiers on the same Balearic base, seed 20260723

*Your model: a producer keeps the genre core and reshapes movement / rhythm / vocal behaviour, rather than adding orchestral voices.*

### B1 — + Stuart Price (movement / sidechain), electronic palette
```
Balearic downtempo, 100-118 BPM, medium energy, analog synth bass and downtempo kit, locked tight together, synth clap over the groove, synth lead on the melody out front, choir pad, moving through sus2 into major voicings, string-machine ensemble under the melody, drone synth sustained underneath, Hammond organ, faint and buried well under the mix, answering the lead only occasionally, synth marimba in the gaps, tempo-synced delay, chords resolve behind the melody, builds to a peak then thins out, Polished Dolby Atmos-Master Atmos -2dB
```
Exclude: `field recordings, air texture, room tone, foley, sound effects, vinyl crackle, tape hiss, nature sounds, ambient noise`

**Listen for:** Does the Price fingerprint show up as **movement** — the sustained chords ducking/pumping with the kick, the tempo-synced delay — without adding orchestral instruments? This is the clearest test of the producer half of your model.

### B2 — + Quincy Jones (horns + vocal stacks), acoustic palette
```
Balearic downtempo, 100-118 BPM, medium energy, upright bass and cajón kit, locked tight together, frame drum over the groove, a soulful melodic line on the melody out front, a held brass chorale entering slowly and sustaining low under the arrangement, moving through sus2 into major voicings, a tight funk horn section under the melody, nylon guitar sustained underneath, French horn, faint and buried well under the mix, answering the lead only occasionally, stacked backing harmonies answering behind the lead, bright reverb, a final chorus with horns and voices together, chords resolve behind the melody, Polished Dolby Atmos-Master Atmos -2dB
```
Exclude: `field recordings, air texture, room tone, foley, sound effects, vinyl crackle, tape hiss, nature sounds, ambient noise`

**Listen for:** The nylon guitar and cajón groove **survive** here (genre retained), and Quincy adds funk horns + backing-vocal stacks as flavour. Does this feel like "Balearic, produced by Quincy," or like a different genre? Quincy is the producer whose fingerprint is closest to instrumentation, so if any producer over-reaches it will be this one.

---

## Block C — does the model generalise? Second Balearic base "Nu-disco / slo-mo" (electronic), seed 55501234

*A different base with different genre selections, to check the same behaviour holds. Note this base leads on a **Rhodes** — watch what happens to it.*

### C1 — BASE, no modifier (control)
```
nu-disco, 100-120 BPM, medium-high energy, sub bass and disco four-on-the-floor kit, locked tight together, electro shaker over the groove, Rhodes on the melody out front, analog synth pads, moving through seventh and ninth chords, synth strings under the melody, drone synth sustained underneath, Hammond organ, faint and buried well under the mix, answering the lead only occasionally, glassy mallet synth in the gaps, wide stereo panning, chords resolve behind the melody, builds to a peak then thins out, Polished Dolby Atmos-Master Atmos -2dB
```
Exclude: `field recordings, air texture, room tone, foley, sound effects, vinyl crackle, tape hiss, nature sounds, ambient noise`

### C2 — + John Barry (composer)
```
nu-disco, 100-120 BPM, medium-high energy, sub bass and disco four-on-the-floor kit, locked tight together, electro shaker over the groove, a hybrid synth-and-strings pad building slowly into wide sustained chords underneath, moving through seventh and ninth chords, synth strings under the melody, French horn and oboe sustained underneath, Hammond organ, faint and buried well under the mix, answering the lead only occasionally, a broad lyrical melody carried on solo horn, a soft vibraphone shimmer low in the mix, wide stereo panning, one long statement, no climax, chords resolve behind the melody, Polished Dolby Atmos-Master Atmos -2dB
```
Exclude: `field recordings, air texture, room tone, foley, sound effects, vinyl crackle, tape hiss, nature sounds, ambient noise`

**Listen for:** Same as A3, on a disco base. The four-on-the-floor and sub bass should hold. **Note:** the Rhodes lead was again replaced by the composer's solo horn — same behaviour as Block A. This is consistent, which is good (it's not random) but it's the thing to decide on.

### C3 — + Stuart Price (producer)
```
nu-disco, 100-120 BPM, medium-high energy, sub bass and disco four-on-the-floor kit, locked tight together, electro shaker over the groove, Rhodes on the melody out front, a deep filtered synth pad opening slowly across long held chords, low in the mix, moving through seventh and ninth chords, a stabbing synth chord layer under the melody, drone synth sustained underneath, Hammond organ, faint and buried well under the mix, answering the lead only occasionally, sustained chords ducking and pumping in time with the kick, wide stereo panning, the pump deepening as the arrangement fills out, chords resolve behind the melody, Polished Dolby Atmos-Master Atmos -2dB
```
Exclude: `field recordings, air texture, room tone, foley, sound effects, vinyl crackle, tape hiss, nature sounds, ambient noise`

**Listen for:** **The Rhodes lead SURVIVES here.** C3 (producer) keeps the genre's signature lead and adds movement; C2 (composer) replaced it. That contrast is the heart of your model working correctly on the producer side and incompletely on the composer side. Confirm you hear that difference.

---

## The decision this round is aimed at

Your stated model has two halves. Round 4 is built to tell us which half is already right:

- **Producer half (B1, B2, C3):** predicted to already match — genre core intact, fingerprint shows as movement / rhythm / vocal / a horn-and-vocal layer. If these sound like "the genre, produced by X," the producer path is done.

- **Composer half (A2, A3, A4, C2):** predicted to be *close but incomplete*. The composer bed + solo lands, but two things need your ear before I build the fix:
  1. **The genre's own lead is being replaced by the composer's solo** (flugelhorn → violin in A2; Rhodes → horn in C2). Your model says the genre's signature sound should stay and the composer solo should be added *alongside* it. Do you agree after hearing it, or does replacing the lead actually sound better?
  2. **Two sustained beds still stack** (composer bed + the character's own strings/texture), and in A4 a voice (cello) doubles. Your model says the character's redundant sustained voices should **yield** to the composer bed while drums/bass/lead stay. Confirm the stacking is audible and worth fixing.

If you confirm both, the next build is a **character-side yield rule**: when a composer modifier applies, the character keeps drums + bass + its lead/signature instrument, and lets its *sustained pad/strings/texture* give way to the composer's bed. That is the one change that would make the composer path match the producer path — and match your model exactly.

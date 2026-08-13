# ATMOS Suno test pack — round 6 (real, late, and expanded)

Generated from `main` at commit `0d51b6e`.

**Honesty note first:** a round 6 pack was promised in the log on 2026-08-11
(the composer-rebuild commit message references it by name) but the file
was never actually written — a prior session described it and didn't
deliver it. Caught during this session's reconciliation. This is that pack,
built now from real, live `generate()` calls (not hand-written), and
expanded to cover everything else that's shipped since and gone unheard.

**Everything below is real.** Every style/negative/metatag string was
produced by actually calling the app's own `generate()` — nothing here is
written from memory or invented to illustrate a point.

---

## Scope: three things to listen for, one thing not to test here

1. **Block A — the composer rebuild.** The single biggest behaviour change.
   Composers used to be woven into the main style string; now they're a
   separate, clearly-subordinate clause plus a metatag section map — **the
   first time you'll hear metatags at all**, since they were built months
   ago but never wired into the app until this same change.
2. **Block B — harmony brightness.** A subtler, statistical lever, not a
   dramatic single-example difference — explained below.
3. **Block C — the electronic/synth linking guide.** New interaction
   language for synth-family instruments (filter, chorus/phaser, width,
   ducking, delay, pitch), same idea as the orchestral linking guide you
   already validated, now covering electronic material.

**Not in this pack:** live lyric generation (Claude/Gemini) isn't a
listening test — it needs your own API key in your own browser, and what
you're checking there is lyric *content* (does it hit your syllable/rhyme
targets, does the subject and title track), not audio. P8 (the DNA layer
under all this) has nothing audible of its own — it's plumbing for the
Metatag Engine's next phase and produces no sound by itself. Nothing to
test for either of those here.

---

## Block A — composer rebuild: Balearic "Sunlit Mediterranean", acoustic, seed 20260723

Same character and seed as round 4/5's A-block, so BASE below is a direct
byte-for-byte check that nothing about the underlying character moved.

### A1 — BASE, no composer (control)
```
Balearic downtempo, 100-118 BPM, medium energy, upright bass and cajón kit, locked tight together, frame drum over the groove, flugelhorn on the melody out front, harmonium, moving through sus2 into major voicings, supporting cello in the middle plane with gentle motion, nylon guitar sustained underneath, French horn, faint and buried well under the mix, answering the lead only occasionally, marimba in the gaps, bright reverb, chords resolve behind the melody, builds to a peak then thins out, Polished Dolby Atmos-Master Atmos -2dB
```
**Exclude:** `field recordings, air texture, room tone, foley, sound effects`

**Check:** this should sound identical to your round-4/5 A1. If it doesn't,
something regressed in the base character and that's worth flagging before
judging any of the composer variants below.

### A2 — Zimmer
```
Balearic downtempo, 100-118 BPM, medium energy, upright bass and cajón kit, locked tight together, frame drum over the groove, flugelhorn on the melody out front, harmonium, moving through sus2 into major voicings, supporting cello in the middle plane with gentle motion, nylon guitar sustained underneath, French horn, faint and buried well under the mix, answering the lead only occasionally, marimba in the gaps, bright reverb, chords resolve behind the melody, builds to a peak then thins out, Polished Dolby Atmos-Master Atmos -2dB, secondary arrangement layer of low strings, French horns, trombones, deep synth bass, analog synth pulse and large low toms in short repeating cells and pedal tones, building gradually and kept beneath the existing lead except at transitions and hook reinforcement
```
**Exclude:** `field recordings, air texture, room tone, foley, sound effects`

**Metatags:**
```
[Sunrise Intro | sustained only | slow build | analog synth pulse | sparse low strings]
[Verse 1 | sparse | lead forward | steady groove | low strings | light large low toms]
[Soft Chorus | full arrangement | bass and drums locked | counter answers | French horns reinforce hook | trombones | deep synth bass | large low toms]
[Drift | instrumental | lead takes theme | call and response]
[Verse 2 | sparse | lead forward | steady groove | low strings | light large low toms]
[Final Chorus | full arrangement | bass and drums locked | counter answers | French horns reinforce hook | trombones | deep synth bass | large low toms]
[Long Outro | thinning out | reverb tail | low strings | final French horns]
```

**The question:** does the Balearic flugelhorn/marimba lead stay in charge
throughout — the whole point of the rebuild — with the Zimmer layer
audibly underneath it, only stepping forward at the chorus hook? Does the
metatag structure actually correspond to what you hear section-to-section?

### A3 — Williams (the orchestral stress test — 9 instruments)
```
Balearic downtempo, 100-118 BPM, medium energy, upright bass and cajón kit, locked tight together, frame drum over the groove, flugelhorn on the melody out front, harmonium, moving through sus2 into major voicings, supporting cello in the middle plane with gentle motion, nylon guitar sustained underneath, French horn, faint and buried well under the mix, answering the lead only occasionally, marimba in the gaps, bright reverb, chords resolve behind the melody, builds to a peak then thins out, Polished Dolby Atmos-Master Atmos -2dB, secondary arrangement layer of trumpets, French horns, string ensemble, flutes, clarinets, harp, timpani, snare drum and glockenspiel in short answering motifs, woodwind counterlines and brass punctuation woven around the existing lead
```
**Exclude:** `field recordings, air texture, room tone, foley, sound effects`

**Metatags:**
```
[Sunrise Intro | sustained only | slow build | trumpets and French horns motif | snare drum pickup | harp]
[Verse 1 | sparse | lead forward | steady groove | string ensemble | flutes and clarinets answer | glockenspiel]
[Soft Chorus | full arrangement | bass and drums locked | counter answers | trumpets and French horns reinforce hook | timpani | glockenspiel]
[Drift | instrumental | lead takes theme | call and response]
[Verse 2 | sparse | lead forward | steady groove | string ensemble | flutes and clarinets answer | glockenspiel]
[Final Chorus | full arrangement | bass and drums locked | counter answers | trumpets and French horns reinforce hook | timpani | glockenspiel]
[Long Outro | thinning out | reverb tail | short trumpets reprise | string ensemble | timpani]
```

**The question:** this is the most crowded composer layer that exists (9
instruments). Does it intrude on the Balearic identity, or does the
subordinate-clause structure hold even under this much weight?

### A4 — Newman (the clean-blend case — mallets/piano, no brass)
```
Balearic downtempo, 100-118 BPM, medium energy, upright bass and cajón kit, locked tight together, frame drum over the groove, flugelhorn on the melody out front, harmonium, moving through sus2 into major voicings, supporting cello in the middle plane with gentle motion, nylon guitar sustained underneath, French horn, faint and buried well under the mix, answering the lead only occasionally, marimba in the gaps, bright reverb, chords resolve behind the melody, builds to a peak then thins out, Polished Dolby Atmos-Master Atmos -2dB, secondary arrangement layer of piano, marimba, xylophone, string ensemble, acoustic guitar, flute and frame drum in short repeating cells, isolated notes and interlocking mallet figures with deliberate gaps around the existing melody
```
**Exclude:** `field recordings, air texture, room tone, foley, sound effects`

**Metatags:**
```
[Sunrise Intro | sustained only | slow build | isolated piano notes | single marimba | flute]
[Verse 1 | sparse | lead forward | steady groove | marimba and xylophone interlock | acoustic guitar replies | frame drum]
[Soft Chorus | full arrangement | bass and drums locked | counter answers | piano motif | marimba | string ensemble]
[Drift | instrumental | lead takes theme | call and response]
[Verse 2 | sparse | lead forward | steady groove | marimba and xylophone interlock | acoustic guitar replies | frame drum]
[Final Chorus | full arrangement | bass and drums locked | counter answers | piano motif | marimba | string ensemble]
[Long Outro | thinning out | reverb tail | reduced piano cell | single marimba | final string ensemble swell]
```

**The question:** A3 vs A4 is the real diagnostic pair — same base, same
seed, one composer crowded with orchestral sections (brass/winds/timpani),
one clean (mallets/piano, no sections). If A3 intrudes and A4 doesn't, the
issue really is orchestral *sections* specifically, same hypothesis the
original round-5 plan was built to test, now testable for the first time
against code that actually ships.

---

## Block B — harmony brightness levers (resolver engines)

Different kind of test. This isn't a single dramatic before/after — it's a
weighted bias, checked in the code across many seeds (default ~12% bright
picks, ~22% when there's a real peak to resolve onto, ~5% when the
structure is flat/ambient). One pair below happens to land on genuinely
different picks at the *same* seed, which is a fair single example, but
don't read a single generation as the whole story — the honest test is
generating the same character a handful of times and noticing whether the
harmony language trends darker/modal by default.

**Character: Delerium, "Gothic Ambient," seed 6.** Only the chosen song
STRUCTURE differs between these two — everything else about the character
is identical.

### B1 — structure WITH an earned peak (Verse–Chorus)
```
Delerium Style, dark ritual ambient, beatless, low energy, warm filtered analog bassline holding a single harmonic centre with everything suspended above, bowed metallic drone with ebow sustained guitar lead emerging and receding without hierarchy each equal in the field, a sacred choral cadence resolving on the final chord, a granular stretched-vocal drone breathing at the edge of the field, reversed-swell transitions and resolving at last into a sustained tonic. Polished Dolby Atmos-Master Atmos -2dB.
```

### B2 — structure with no peak (Downtempo/Ambient)
```
Delerium Style, dark ritual ambient, beatless, low energy, warm filtered analog bassline holding a single harmonic centre with everything suspended above, bowed metallic drone with ebow sustained guitar lead emerging and receding without hierarchy each equal in the field, a modal cadence landing on the root, a granular stretched-vocal drone breathing at the edge of the field, reversed-swell transitions and resolving at last into a sustained tonic. Polished Dolby Atmos-Master Atmos -2dB.
```

**The question:** does B1 (chosen because a real chorus exists to resolve
onto) actually land somewhere more resolved/settled by the end than B2
(nothing to resolve onto, deliberately kept open/modal)? This is the thing
you originally asked for — less reflexive "happy" major-key resolution,
kept in reserve for when the structure has actually earned it.

---

## Block C — electronic/synth linking guide (Balearic legacy, electronic palette)

The synth-family counterpart to the orchestral linking guide you already
validated. Look for the italicised-in-spirit movement/interaction phrases
below — they didn't exist in this form before this guide shipped.

### C1 — "Analog," electronic palette, seed 909
```
Balearic downtempo, low-mid chill, 85-100 BPM, low-medium energy, Vintage analogue synth pads with slow evolving filter movement, a one-chord modal centre with the harmony shifting only by inversion, FM bass with soft attack and subtle rhythmic pulse, Simple steady programmed beat with soft kick and tight light percussion, light rimshot and shaker accents ticking under the beat, Soft layered strings blended underneath the pads for depth, soft harmonium bed breathing under the pads, Soft synth lead motifs with gentle melodic phrasing and analog character, soft clavinet counter-figure ticking against the motif, brief plucked synth figure answering in the space, lead and pads holding separate registers and gliding past each other, the bass gliding and tied to the cycle above, layers phasing in and out with the texture evolving through subtraction as much as addition, Phaser and chorus modulation creating slow evolving movement across synth layers, Polished Dolby Atmos-Master Atmos -2dB
```

**Listen for:** "slow evolving filter movement," "phasing in and out," and
especially the closing "phaser and chorus modulation creating slow
evolving movement across synth layers" — does the pad/lead relationship
actually audibly shift and breathe over the track, or does it sound static
regardless of the words?

### C2 — "Balearic House," electronic palette, seed 909 (higher-energy contrast)
```
Balearic house, club groove, 118-124 BPM, high energy, Classic house chord stabs with warm analog tone, classic house chord voicings moving through a four-chord cycle with a clear lift, Heavy electric slap bass with funky rhythmic groove, Classic house beat with punchy kick, snappy claps and open hi-hats, bongos and cowbell accents driving under the kick, Subtle string textures lifting the harmonic space, a soft Juno-style layer lifting beneath the chords, Acoustic guitar phrases with rhythmic Balearic strumming, a funky clavinet counter-riff answering the lead, a brief steel-pan accent lifting a bar, the lead riff answering the bassline in call-and-response, slap bass and four-on-the-floor kick locked tight and driving, the groove building through added percussion toward an open peak, Wide stereo automation across the chord stabs and riffs, Polished Dolby Atmos-Master Atmos -2dB
```

**Listen for:** "wide stereo automation across the chord stabs and riffs" —
does the stereo field actually widen/move on those elements, or is it
inert the way bare production-desk terms have been before (same failure
mode as the old sidechain-pump finding)?

---

## What to report back

For each block, same format as before: does the described interaction
actually render audibly, or is the language going unheard? If a phrase
consistently doesn't render (like the old sidechain case), that's data for
`core/knowledge.js`, not a one-off note — same standing rule as always.

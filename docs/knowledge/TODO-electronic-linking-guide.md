# TODO — ELECTRONIC / SYNTH LINKING GUIDE (deep research)

**Status: OUTSTANDING. This is the first substantive task of the next session.**
**Assigned by John, 2026-07-23.**

## Why this exists

`core/linking.js` grounds all orchestral interaction language in
`instrument-family-linking-guide.md`, which John produced with an LLM. That guide
covers strings, woodwinds, brass, percussion, harp and piano — and nothing else.

Every engine in this app is electronic or hybrid. Synths, drum machines, electric
bass, electric guitar and sampled sources therefore have **no grounded linking
language at all**. `classifyInstrument()` deliberately returns `null` for them so
that nothing gets guessed onto an orchestral family, and `validate-linking.mjs`
asserts that null. The gap is visible in code rather than hidden — but it is still
a gap, and it is currently filled by the very thing that caused round 4 to fail:
inference.

John: *"I managed to find and produce that with an LLM. As you are an LLM, I would
like you to do that deep research this time... Then file your research in a
retrievable way for you to access and use as a source of truth, instead of
inferring, guessing, making-up."*

## The brief

Produce an electronic/synth equivalent of the orchestral guide, on **the same
principles**, in John's words:

> "It's all based on the same principles — Background (Bed/Pads), middle ground
> and foreground (leads etc)."

So the organising spine is the plane-of-tone model already proven in §13 of the
orchestral guide: **background (beds/pads) → middle ground → foreground (leads)**.

### Required contents

1. **Electronic families and their core roles** — the counterpart to orchestral
   §1. At minimum: synth pads, synth leads, plucks/arps, bass (sub, analog,
   acid, FM), electric piano/Rhodes, organ, drum machines and electronic
   percussion, sampled and chopped sources, vocal synthesis (vocoder, choir pad,
   chops). For each: sound-source type, typical role, register, and whether it
   sustains, plucks or strikes.

2. **Plane-of-tone placement for electronic voices** — how a pad sits in the
   background, what occupies the middle ground in an electronic arrangement
   (counter-melodies, arps, stabs-as-chords, string machines), and what holds the
   foreground. This is the section that matters most: it is the direct fix for the
   prominence problems John reported, applied to the electronic side.

3. **Family-pair linking phrases** — the counterpart to orchestral §3–§11:
   pad + lead, pad + arp, bass + drums, lead + counter-melody, arp + pluck,
   electric piano + pad, vocal chop + groove, and so on.

4. **Cross-type roles** — sustained vs plucked vs percussive within an electronic
   texture (the counterpart to §12).

5. **Movement and modulation language** — filter motion, sidechain/ducking, delay
   throws, chorus width. Must be expressed as **audible instrument behaviour**,
   never as desk terminology: an established project learning is that Suno
   under-renders production-desk terms such as "sidechain".

6. **Hybrid linking** — how an orchestral family sits with an electronic one.
   This is what the modifier layer actually does (a composer's string bed over a
   Balearic engine), and neither existing guide covers it.

### Constraints — non-negotiable

- **No banned articulation.** `ostinato`, `staccato`, `stab`/`stabs`/`stabbing`,
  `fanfare`, `orchestral hits` are banned project-wide by `core/knowledge.js` on
  John's round-4 ruling. Use `repeating figure`, `short chords`, `clipped chords`.
- **No dominance language** — massive, huge, wall-of-sound, hammering, punching,
  relentless. Banned by the Phase B signature contract.
- **No mood or affect words.** Suno ignores them.
- **No non-musical content** — field recordings, foley, vinyl crackle, room tone.
- Phrases must state **placement** and **behaviour**, not just name a thing.
  Round 3 proved that naming a pad does not make Suno render one.

### How to file it — this is the part that must not be skipped

1. Write it to `docs/knowledge/electronic-family-linking-guide.md` **in this
   repo**. Not in a chat, not in Notion prose, not in a summary. The repo is the
   only store that survives a chat boundary intact.
2. Encode it as data in `core/linking-electronic.js`, mirroring
   `core/linking.js`.
3. Extend `validate-linking.mjs` so it reads the new guide **from disk** and
   fails the build on any phrase that is not in it verbatim. That harness caught a
   one-word paraphrase on its first run; it is the mechanism that makes this
   retention rather than aspiration.
4. Extend `classifyInstrument()` to resolve electronic families, and update the
   null-case test — the current test asserts synths return null, which must
   become an assertion that they resolve correctly instead.
5. Log completion to Notion and delete this file.

## Verification that it worked

`node validate-linking.mjs` should report electronic phrases traced to the new
guide, and a build on an electronic character should place its pad in the
background plane and its supporting voices in the middle plane — the same
treatment orchestral builds already get.

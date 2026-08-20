# PROJECT_STATE

**Read this first, every session, before anything else.** It replaces reading a
Notion entry to work out where things are. Notion keeps the decision HISTORY;
this file is the current STATE.

Last updated: 2026-08-19 · HEAD at time of writing: `d394efd`

---

## Where the project is right now

**Testing is suspended.** John ran 10 Suno tests on 2026-08-19 and stopped. His
verdict: the app functions, the UI is poor but usable, and the prose in the
style prompts has no real grounding in music. He will not test further until
that is fixed. That is the correct call — testing a prompt generator whose
prompts are wrong measures nothing.

**Current work: rebuilding the prose layer.** Architecture sketched at
`docs/architecture/prose-architecture-v1.md`, awaiting John's review. Nothing
built. Research briefs at `docs/research/research-briefs.md` are with John.

**Do not build any part of the prose architecture until John has reviewed the
sketch and answered its section 7 decision points.**

---

## Why the prose is bad — the diagnosis, so it is not re-litigated

The prose is generated from hand-written phrase banks with instrument-name slots,
selected by a hash of the seed. `TEXTURE_PROSE`, `PLANE_VARIANTS_BY_TYPE`,
`PAIR_LINKS`, the interplay banks, the metatag section pools — all the same
shape.

It survived because **every validator measures structure, not truth.** 38
validators, 20,000+ checks, none of which asks whether a sentence says anything
true about the music. The system was optimised for what was measurable.

More phrases makes it worse, not better. This is a category error, not a
coverage gap. See the sketch for the full argument.

---

## The working method (changed 2026-08-19)

Sessions regress because state was being carried in Notion prose. Two changes:

**Claude Code is the build environment.** Real file tools, tests it runs itself,
a browser it can open. Most of the recent error rate — re-wrapping cast entries,
using character ids that do not exist in the app, putting reconciliation rules in
the wrong order — came from patching files blind and validating against tests
that never open the app.

**Chat is for thinking, Claude Code is for building.** John is token-conscious in
Claude Code, so the split is deliberate:

| Chat | Claude Code |
|---|---|
| architecture and design | implementation |
| writing research briefs | running the validator suite |
| reviewing research John brings back | browser and DOM checks |
| designing schemas and rubrics | refactors and deletions |
| drafting prompt templates | anything touching many files |

**State lives in this file, in the repo, versioned with the code.** Notion keeps
the decision log. It is no longer the handoff mechanism.

---

## The standing rules (unchanged, still binding)

- No change to a proven path without John's explicit sign-off.
- All prose, instrument choices and wording trace to John's examples, a cited
  guide section, or a guide template. Nothing invented.
- No guessing at Suno behaviour. John's tests beat community consensus beats
  spec. Community consensus has been wrong twice.
- Decisions are recorded as DATA in the codebase, not as comments.
- Inferences are flagged as research candidates, never shipped as facts.
- The validator suite stays green before every commit.
- A valid test is a COMPLETE build — style, negative, metatags, lyrics, vocals.
- John reviews identical-seed before/after pairs for code-level changes.

---

## The lesson that keeps recurring

**A feature can be correct in `core/` and wrong or unreachable in the app.**
Three instances in two days:

1. The texture family-collision rule was correct in isolation and killed the
   feature on 11 of 12 characters on the electronic palette. Invisible because
   every measurement called `buildAtoms` directly.
2. Test pack 01 named characters from `engines/atom-balearic.js` that do not
   exist in the app's own `ATOM_POOL_CHARACTERS` registry. Same root cause.
3. John reported the texture selectors doing nothing; his ZIP was stale, and
   neither of us could prove it because the build marker read one commit behind
   and nothing in the suite had ever touched a texture dropdown.

37 of 38 validators import modules directly and never open the app.
**Outstanding and unapproved: a validator that sweeps every character and
palette through `js/generate.js` the way the app does.** Needs John's go-ahead.

---

## Open items needing John

**Blocking the prose rebuild:**

- Review `docs/architecture/prose-architecture-v1.md` and answer its five
  decision points.
- Return research briefs 1–4 (briefs 1–3 block layer 2, brief 4 blocks layer 3).

**Engine questions, unchanged from 2026-08-18:**

- Sacred Spirit: `"a sustained bowed-cello drone"` is a single cello used as a
  pad, and duplicates the lead's solo cello. Change to a low-string section?
- Delerium `gothicAmbient`: is `"bowed metallic drone"` a pitched pad or a
  texture (bowed cymbal, waterphone)? If a texture it should leave the pad slot.
- 86 sustaining pool entries state no articulation either way; Suno fills the gap
  with the short orchestral default. Bulk pass? One decision, not 86.
- `SINGLETON_INSTRUMENT_WORDS` holds nine bare headwords; choir, chant, organ,
  guitar, harp and drone collisions go undetected. Widening changes proven
  engines, so it needs a test result.

**Housekeeping:**

- GitHub PAT in the Notion entry "GITHUB TOKEN STORED IN LOG" expired
  **2026-08-19**. Needs rotating; replace in that same entry.
- UI redesign pass still deferred. John: "poor UI layout". Deferred until the
  control surface is final, but it is now on the record as a real complaint.

---

## What is built and working

Six engines: Balearic (atom + legacy), Enigma (legacy), Delerium, Era, Deep
Forest, Sacred Spirit (resolvers). Cast reconciliation with genre policy, slot
waste, bed and lead budgets, one-voice-one-mention. Detail & Movement (Vocal
Treatment implemented; Ear Candy and Space & Movement unbuilt, controls default
off). Texture modifier (two selectors, nine voices, cast-integrated). Song-type
gating on all paths. Build fingerprint in the header — current `3c2a7b38`; if
the app shows a different one the copy is stale.

Suite: 38 validators, all green.

**Nothing in the texture modifier or the 2026-08-18 fixes has been Suno-tested,
and it should not be until the prose layer is rebuilt.**

---

## VOICE_BUDGET

Still `null`. Still requires a measured figure from a real Suno test. Do not
guess it. Test pack 01 exists to produce it but is on hold with the rest of
testing.

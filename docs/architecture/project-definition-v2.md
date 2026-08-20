# Project definition v2 — the restart

Status: **FIRST CUT, FOR JOHN TO STRIKE THROUGH.** Written as assertions rather
than questions so there is something concrete to disagree with. Anything wrong
gets crossed out and replaced; anything not crossed out is taken as agreed.

Written 2026-08-19 after John called for a restart:

> "I think we need to take a massive step back and redefine the project. We need
> to decide what the tool is and isn't. I think we need to start all over again
> from scratch rather than inherit poor information."

---

## 1. What the tool is

A **prompt construction tool for Suno**, for one user, run in a browser as a
static page with no server.

It produces four things for a single song:

1. a style prompt
2. a negative prompt
3. per-section metatags
4. lyrics

An **engine** is a style target — a named musical world the output should land
in. Each engine is defined by **researched, cited facts about how that music is
actually arranged**, not by a hand-written list of instruments.

The content of a build is **deterministic**: same settings and seed, same
arrangement. The **wording** is written by a language model from that
arrangement, and is cached so a given build always produces the same text.

## 2. What the tool is not

- Not a general-purpose prompt generator for any genre. It covers John's engines
  and nothing else. Breadth is what produced the generic prose.
- Not a music theory teacher, a DAW, or an arrangement tool.
- Not multi-user. No accounts, no sharing, no server.
- Not a lyric-writing tool in its own right. Lyrics serve the song.
- Not a cloning tool. An engine targets the **arrangement conventions** of a
  style — instrumentation, register, how parts relate. It does not reproduce
  melodies, lyrics, or any protected material, and the research must not either.

## 3. The rule that prevents this happening again

**Every piece of musical data in the codebase carries a source, or it does not
ship.**

A source is one of:

- `john` — John's own statement or his own Suno test result
- `cite:<work>, <location>` — a named book, article, interview or record
- `derived:<rule>` — computed from other sourced data by a stated rule
- `candidate` — an inference. **Ships disabled.** Visible in the repo, excluded
  from output, listed for John to confirm or kill.

No fourth option. Nothing enters a pool, a character, a genre anchor or a phrase
without one of these. This is enforced by a validator, not by discipline.

This is the single change that would have prevented the current state. Every
instrument pool in the repo today is `candidate` in reality and `fact` in
practice, because there was no field to record the difference.

## 4. What is kept

Sound, and expensive to rebuild for no gain:

- **Reconciliation logic** — budgets, one-voice-one-mention, slot waste, genre
  policy, foundation collision. The rules are good; they have been operating on
  bad data.
- **John's Suno findings** in `core/knowledge.js` that came from his own tests:
  negative-prompt saturation, position as prominence, talkbox and vocoder needing
  no carrier, genre-owned bass timbre, naming an instrument twice.
- **The bundler**, the build fingerprint, the DOM validator.
- **The validator suite as a gate concept**, though what it measures changes.
- **John's Suno-validated prompt examples** — real ground truth, and the only
  prose in the project that has ever been confirmed to work.

## 5. What is rebuilt from nothing

- **Every instrument pool.** Derived from engine research, not written by hand.
- **Every character definition.**
- **Every genre anchor and its wording.**
- **All prose**, everywhere — style, interplay, metatags.
- **The `knowledge.js` entries that are inference rather than John's testing.**
  They need separating and re-marking; some are probably right and none are
  currently distinguishable from the tested ones.

## 6. The consolidation John has not asked for but should have

**The project has three code paths doing the same job.**

| Path | Engines | How it builds |
|---|---|---|
| atom | Balearic Atom | atom table → cast → reconcile → prose |
| resolver | Delerium, Era, Deep Forest, Sacred Spirit | 8 prose slots → reconcile → render |
| legacy | Balearic Legacy, Enigma | frozen proven builders, byte-identical |

This is why a fix lands in one place and not the others. It happened three times
in two days: the texture ordering fault had to be fixed twice, in two different
files, with two different shapes of bug. The song-type gate was correct on two
paths and broken on the third for two days.

**Proposal: one path. Every engine becomes data, not code.** An engine is a
research-derived description of a musical world; the same builder handles all of
them. The legacy engines are preserved as frozen reference output so the new
path can be diffed against them, but they stop being a separate implementation.

If John disagrees, the reason to keep three paths would be that the legacy
builders produce output he has validated and does not want touched. That is a
real argument, and the answer is to keep their OUTPUT as test fixtures rather
than their CODE as a live path.

## 7. Open scope questions for John

Assertions again — cross out what is wrong.

1. **Six engines is the right number.** Balearic, Enigma, Delerium, Era, Deep
   Forest, Sacred Spirit. No new ones until these six are good.
2. **Balearic is a genre; the other five are artists.** They need different
   research treatment and probably different engine shapes. Balearic's twelve
   characters may be the wrong model for an artist engine, where the "characters"
   should be that artist's actual modes of working.
3. **The lyric engine stays as it is for now.** It is a separate problem and
   changing two things at once is how the current mess is diagnosed slowly.
4. **The UI is rebuilt after the data and prose are right**, not before. John
   has called the layout poor; it is on the record and it waits.
5. **Existing test packs are void.** Nothing may be Suno-tested until the data
   and prose layers are rebuilt.

## 8. Order of work

1. John marks up this document and the architecture sketch.
2. **Engine identity research** — one brief per engine, comprehensive. This is
   the foundation everything else stands on and nothing else starts until it is
   in.
3. Instrument pools and characters derived from that research, every entry
   sourced.
4. Arrangement graph (layer 2 of the prose architecture).
5. Quality rubric and baseline scoring.
6. Prose renderer and gate.
7. Metatags.
8. UI.

Steps 2 and 3 are the restart. Everything after is the architecture already
sketched.

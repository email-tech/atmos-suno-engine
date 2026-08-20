# Engine identity research briefs

**These are the foundation. Nothing else in the restart starts until these are
in.** They are separate from `research-briefs.md`, which covers general
arrangement knowledge; these cover *what each engine actually is*.

This is the gap John identified on 2026-08-19. The instrument pools in the repo
today were never derived from anything — they are inference presented as data,
and every reconciliation rule operates on top of them. Fixing the prose without
fixing this would produce well-written descriptions of the wrong music.

---

## How to run these

**One engine per session.** These are long. Splitting them keeps the answers
deep rather than broad, and depth is the whole point.

**Run each one twice, on different models,** and bring both back. Where two
models agree, that is worth something. Where they disagree, that is worth more —
it marks the places where the answer is genuinely uncertain rather than
confidently wrong.

**Anything the model cannot source, it must say so.** An unsourced claim still
enters the repo, but marked `candidate` and disabled. A confident-sounding
invention that gets marked `cite:` is exactly how the project reached its current
state.

**Boundary:** this is research into arrangement practice and instrumentation. Do
not ask for and do not accept lyrics, melodies, chord-by-chord transcriptions, or
anything else that reproduces protected work. Instrumentation, register, texture,
production approach and how parts relate — all fine, and all we need.

---

## The template

Substitute the engine. The bracketed notes are for John, not part of the prompt.

> I am researching the arrangement and production practice of **[ARTIST/PROJECT]**
> so I can describe their sound accurately. I do not want lyrics, melodies or
> transcriptions — I want to understand how the records are put together.
>
> **1. Identity.** Who is behind it, over what period, and what changed across
> that period? Are there distinct eras or modes of working that sound
> meaningfully different from each other?
>
> **2. Instrumentation.** What instruments and sound sources actually appear on
> these records? Be specific — named synths, particular acoustic instruments,
> the kind of percussion, the kind of vocal. Which are present on almost
> everything, and which appear occasionally? What is conspicuously ABSENT that a
> listener might wrongly assume is there?
>
> **3. Roles.** For a typical track: what carries the bass, what carries the
> harmonic bed, what carries the lead, what provides rhythm, what provides
> colour? Does that allocation change between the eras in question 1?
>
> **4. How the parts relate.** What locks to what rhythmically? What floats free?
> What answers what? Where does the space sit in the arrangement? How dense is a
> typical track and how does that density move from beginning to end?
>
> **5. Production.** Reverb and space, stereo treatment, how vocals are treated,
> how the low end is handled, anything characteristic about the mix.
>
> **6. Vocals.** What kind of voices, singing in what, treated how? Lead, choir,
> chant, wordless, sampled? What language or languages, and is it real or
> invented?
>
> **7. The tells.** What are the three or four things that make someone
> immediately say "that sounds like [ARTIST]"? And what would sound WRONG — what
> would break the impression instantly?
>
> **8. Worked examples.** Take three well-known tracks and describe each one's
> arrangement part by part: what comes in when, what sits where, what relates to
> what.
>
> **9. Sources.** Where does each of the above come from — interviews,
> production magazine features, liner notes, documented gear lists, your own
> analysis? Mark clearly which claims you are confident about and which are
> inference.

---

## The six engines

### Delerium
Bill Leeb and Rhys Fulber. Note the very large stylistic range across the
catalogue — early ambient/industrial through to the vocal-led electronic
records. Question 1 matters more here than for any other engine; "Delerium
Style" almost certainly means the later era, and that needs confirming with
John rather than assuming.

### Enigma
Michael Cretu. Ask specifically about the sampled and chant elements, the
production approach, and the way the vocal and instrumental layers sit against
each other.

### Era
Eric Lévi. Choral and orchestral crossover with rock and electronic elements.
Ask specifically about the invented language, the choir treatment, and how the
orchestral and rhythmic layers are combined — this engine's current pools
contain a driving string ostinato and a staccato bass line, and whether that is
actually characteristic needs checking rather than assuming.

### Deep Forest
Eric Mouquet and Michel Sanchez. Ask about the sampled vocal sources, the
relationship between the sampled material and the programmed material, and how
the percussion is built.

### Sacred Spirit
Ask who is actually behind it, since it is a producer project rather than a
band, and about the same sampled-vocal-versus-programmed-material question as
Deep Forest.

### Balearic
**Not an artist — a genre, and it needs a different brief.** Substitute into the
template but replace question 1 with:

> **1. Definition.** What does "Balearic" actually mean as a musical term? Where
> did it come from, how has the meaning shifted, and what does it cover today?
> Which artists, labels, DJs and records define it? Is it a sound, a tempo, a
> mood, a context, or a set of production conventions?

And add:

> **10. Adjacent genres.** How does Balearic relate to downtempo, chillout,
> ambient house, nu-disco, and lounge? Where are the boundaries, and what
> distinguishes them from each other?

The Balearic engine currently has twelve characters spanning downtempo,
beatless, house and nu-disco. Whether those are twelve genuine modes of one
genre or a fan-out of guesswork is exactly what this brief should settle.

---

## What comes back and what happens to it

Each returned brief becomes an **engine identity file** in the repo, with every
claim carrying a source marker (`john`, `cite:`, `derived:` or `candidate`).

From that file, and only from that file:

- the instrument pool for that engine
- the character definitions
- the genre anchor and its wording
- the negative prompt content — what would sound wrong is question 7
- the register and role allocation feeding the arrangement graph

**Nothing is hand-written into a pool again.** If a claim is not in the identity
file it does not reach the output, and if it is a `candidate` it reaches the
output only after John says so.

---

## The one question only John can answer

For each engine: **which era or mode does he actually want?** A Delerium engine
targeting *Semantic Spaces* and one targeting the early ambient records are
different tools. The research will surface the eras; choosing between them is
his call, and it should be recorded in the identity file before any pool is
built from it.

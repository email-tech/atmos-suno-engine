# Suno metatag section-label vocabulary — sourced, not invented

**Why this file exists.** John questioned specific metatag section labels and
descriptor phrases on 2026-08-13 (Floating Bridge, Hook-instead-of-Chorus,
"lead takes theme," Halo Outro, "lead forward," unspecified "call and
response," Atmos Intro, "thinning out"), noting they read as buzzwords with
no grounding. Investigation confirmed this: `core/lyric-controls.js`'s
`STRUCTURE_TEMPLATES` traces via git history to `c435691`, the FIRST commit
of the entire repository — written before `core/knowledge.js`'s empirical-
fact discipline existed. A code comment claiming this content was "proven"
and "John validated empirically" cites no test, no date, no result, unlike
every other empirical claim in this codebase. That claim does not hold up.

This file is the fix for that: an actually-sourced vocabulary, with
citations, that `validate-metatag-vocabulary.mjs` enforces the same way
`validate-linking.mjs` enforces the orchestral/electronic linking guides —
reading this file from disk and failing the build on any paraphrase or
unlisted term reaching a rendered structure template.

## Sources consulted (2026-08-13, web search)

Suno publishes no official tag list. The vocabulary below is the
intersection confirmed across multiple independent sources, cross-checked
against Suno's own July 2026 Lyrics Editor UI (which offers exactly three
clickable section labels — the strongest first-party signal available):

- Suno's July 2026 Lyrics Editor: "label sections Verse, Chorus, or Outro
  from the UI... the same job [Verse]/[Chorus]/[Outro] bracket tags do."
  (blakecrosley.com, "Suno Guide: Tags, Meta Tags & Prompts (V5.5)")
- "The most reliable structure tags are [Intro], [Verse], [Pre-Chorus],
  [Chorus], [Bridge], [Instrumental Break], [Guitar Solo], [Outro] and
  [End]." (sunometatagcreator.com)
- "Suno recognizes these bracket tags: [Intro], [Verse], [Verse 1],
  [Verse 2], [Pre-Chorus], [Chorus], [Hook], [Bridge], [Instrumental],
  [Instrumental Break], [Break], [Interlude], [Drop], [Build-Up],
  [Breakdown]..." (hookgenius.app)
- "Start with a readable structure... [Intro] [Verse 1] [Pre-Chorus]
  [Chorus] [Verse 2] [Chorus] [Bridge] [Final Chorus] [Outro]" and a
  second example structure using [Theme] [Build-Up] [Drop] [Breakdown]
  [Final Build] [Outro] for more electronic material. (jackrighteous.com,
  "Suno Meta Tags Guide 2026")
- "In practice, '[Bridge | Key Change]' or '[Final Chorus | key change]'
  will attempt a modulation upward." (scribd.com, "Suno AI Meta Tags —
  Verification and Usage Guide")
- Universal, repeated finding across every source with no exception: tags
  work best SHORT (1-3 words) and CONCRETE. "[Chorus] outperforms [This is
  the main emotional chorus hook]." "Shorten the bracket, remove sentence-
  like wording." A worked example from stokemctoke.com: "[Intro | ambient |
  minimal] [Verse | spoken word | low energy] [Chorus | chill | melodic |
  layered vocals] [Outro | silence | reverb tail]" — concrete production
  language, not narrative description.

## Confirmed section-label vocabulary

Use ONLY these as a template's structural section names:

- `Intro`
- `Verse` (numbered: `Verse 1`, `Verse 2`, ...)
- `Pre-Chorus`
- `Chorus` (numbered/qualified: `Final Chorus`)
- `Bridge`
- `Outro`
- `Instrumental Break` — for a no-vocal passage that carries melodic/
  arrangement content forward (replaces the old "Drift" / "Instrumental
  Drift" / "Ambient Break" / "Ritual Break" / "Ritual Interlude" family)
- `Breakdown` — for a stripped-back, lower-energy passage (replaces "Drone
  Break" / "Harmonic Break" / "Dissolve")
- `Build-Up`, `Drop` — electronic/club-specific; use only where a preset is
  genuinely club/EDM-adjacent, never elsewhere
- `Guitar Solo` — genuinely rare in this project's catalogue; kept for
  completeness, not currently used by any template

## Retired: labels that were never grounded in anything

Every one of these existed only in `core/lyric-controls.js`'s original,
uncited content. None appear in any source consulted above. Retired, not
relabelled with a wink — the words themselves carried no signal Suno was
ever shown to act on: *Floating Bridge, Halo Outro, Atmos Intro, Sacral
Bridge, Underwater Intro, Aria Intro, Vocal Texture Intro, Sunrise Intro,
Sunset Outro, Long Outro, Long Tail Outro, Ambient Intro, Chant Intro,
Chant Bridge, Chant Hook, Whispered Intro, Pulse Intro, Sacred Texture,
Invocation, Spoken Fragment, Spoken Bridge, Spoken Verse, Breath Intro,
Emotional Lift* (recategorised to Bridge or Pre-Chorus by actual position
in the form, not preserved as a label), *Fragment, Abstract Intro,
Cinematic Verse, Minimal Verse, Repeated Mantra, Final Mantra, Hook
Reprise, Instrumental Response, Instrumental Passage, Drone Break,
Harmonic Break, Dissolve, Middle 8* (real British songwriting term, but not
on any confirmed Suno list — folded into `Bridge`), *Refrain / Final
Refrain* (a real term, not a confirmed Suno tag — folded into `Chorus` /
`Final Chorus`), *Hook / Final Hook* (a real songwriting term for a catchy
device, not confirmed as a safe section-label substitute for `Chorus` —
Suno's own editor treats `Chorus` as first-class; `Hook` doesn't get that
same confirmation as a section name), *Lift* (functionally closest to
`Pre-Chorus`, mapped there by position in the form), *Post-Chorus* (a real,
increasingly common pop structural device, but not on the confirmed list —
folded into `Chorus` rather than kept as an unconfirmed extra section).

## An honest consequence, not a bug

Several of the original 24 templates were differentiated ONLY by invented
label names — once those are stripped to the confirmed vocabulary, some
templates now share an identical section sequence (e.g. the old
`balearic-floating-hook` and `commercial-bridge` both become `Verse /
Chorus / Verse / Chorus / Bridge / Final Chorus`). That's the correct
result of removing false differentiation, not a defect introduced by this
rebuild — the templates were never actually that structurally diverse; the
naming just made them look it.

## Per-section descriptor phrases (the piped elements)

Same standard applies to the content after the section name — e.g. the
`ambient | reverb tail` half of `[Outro | ambient | reverb tail]`. These
must be concrete production/arrangement language, sourced from the actual
DNA arrangement for THIS build (which specific voice, not a generic role),
never narrative filler. "Lead takes theme" and unspecified "call and
response" are retired for the same reason as the section labels above —
see `core/metatag.js`'s `leanTag()` for the rebuilt version and its own
citation back to this file.

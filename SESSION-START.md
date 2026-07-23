# Session start — mandatory, before any work

This file exists because John's round-4 message identified the real failure mode:
"every new chat we regress in knowledge, progress and are always chasing our
tails... It wouldn't be so bad if the lessons we learned were retained, but I
don't feel that they are."

Retention is not memory and not prose. Work through this list in order.

1. **Read `core/knowledge.js`.** Every empirically established fact about how
   Suno behaves, each citing the test that produced it. This overrides any
   assumption carried in from a previous session or from general training.

2. **Read `docs/knowledge/`.** John's music, production and arrangement
   knowledgebase, vendored into the repo so it is always present:
   - `instrument-family-linking-guide.md` — tested wording for how orchestral
     families interact. **Use these phrases; do not invent interaction language.**
   - `music-knowledge.md` — index to the discipline skill files
   - `arrange-skill.md`, `prod-mix-skill.md`, `music-theory-skill.md`,
     `songwriting-skill.md`, `ai-music-skill.md`, `hardware-studio.md`
   - `balearic-influence-trait-library-v1.md`

3. **Run `node validate-knowledge.mjs`.** If it fails, something regressed since
   the last session — fix that before anything else.

4. **Query the Notion decision log** for state and open questions.

5. **Confirm HEAD matches origin** before proposing work.

## The rule that keeps this from happening again

An empirical fact is not recorded until it is DATA in `core/knowledge.js` and a
VALIDATOR FAILS THE BUILD when it is violated. If John establishes something by
testing in Suno, it goes there in the same session — not into a log entry, and
never into a summary that assumes the next session will remember it.

Do not infer a musical fact that could be looked up in `docs/knowledge/`.
Round 4 was lost to exactly that: interaction language was invented when a tested
library existed, negatives were shipped 23-deep when the effective cap is 5, and
banned articulation was left in place because the rule lived only in prose.

# ATMOS — Skill Docs Index

Reference material for developing the **prompt (style) engine** and the **lyric/metatag engine**.
The eight `*-skill.md` files are generic music-education docs; this index maps them to where they
actually bite in ATMOS. These are reference, not learning-app features. Read `claude-app-guide.md`
+ `music-knowledge.md` first to route, then open the disciplines a task touches.

## Discipline → engine touchpoint

| Doc | Where it applies in ATMOS |
|---|---|
| `music-theory-skill.md` | Key/scale/harmony choices in atom pools; harmony=key/scale rule; metatag key hints. |
| `arrange-skill.md` | **Mandatory interplay/interaction language** in the style string; register/density separation; foreground/mid/background per section. |
| `songwriting-skill.md` | Lyric/metatag engine — structure, hooks, prosody, section arc; vocal elements bolt on here. |
| `prod-mix-skill.md` | Production-movement descriptors; mastering-tail language; clarity/masking guidance for pool timbres. |
| `ai-music-skill.md` | Prompt-design discipline and the curation loop. **John's Suno tests override any external research.** |
| `hardware-studio.md` | Reference only — no recording path in a prompt generator. Rarely binds. |

## Standing ATMOS rules these docs sit under (do not let a doc override them)

- No artist names; no mood/affect words; no non-musical content in positive prompts.
- Genre anchor front-loads every prompt; mastering language at the tail; negatives in a separate field.
- Interplay language is mandatory and threaded inline per voice — never omitted, never dumped at the end.
- Proven prompt paths are never changed without John's explicit sign-off.
- Empirical Suno results beat theory when they conflict.

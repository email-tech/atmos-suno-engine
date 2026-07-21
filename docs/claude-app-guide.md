# Music App – Source of Truth for Claude

## Purpose
This project is a music learning and creation app. All musical explanations, exercises, and features must follow the principles in the documentation files under the `docs/` folder.

## Knowledgebase Layout

- `docs/music-theory-skill.md` – musical foundations: notation, scales, intervals, chords, keys, harmony, rhythm, and ear training.
- `docs/songwriting-skill.md` – songwriting and composition: lyrics, melody, hooks, song forms, storytelling, and creative practice.
- `docs/arrange-skill.md` – arrangement and instrumentation: roles of instruments, register and density, orchestration, texture, and dynamics.
- `docs/prod-mix-skill.md` – production, recording, editing, mixing, and basic mastering.
- `docs/hardware-studio.md` – hardware, monitoring, acoustics, and studio setup.
- `docs/ai-music-skill.md` – AI music creation: tools, prompt patterns, hybrid human+AI workflow, and ethics.
- `docs/music-knowledge.md` – overview of the whole music knowledgebase and how to use it.

## Rules for Claude

1. When you work on this app, always treat the files in `docs/` as the source of truth for musical concepts and workflows.
2. Before implementing or changing any feature that touches music theory, songwriting, arrangement, production, mixing, hardware, or AI music, read the relevant `*-skill.md` file.
3. If a concept or workflow is not covered in the docs, ask the user before inventing new theory or practices.
4. Keep the apps explanations, exercises, and feature logic consistent with these docs. If you change the docs, explain why and adjust the app accordingly.
5. Use `docs/music-knowledge.md` as a high-level map to decide which discipline files you need for a given task.

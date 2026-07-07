import { MASTERING, MAX_MODE_STR, STYLE_ENGINES } from "./data-style-engines.js";

export function buildStylePrompt(state) {
  const engine = STYLE_ENGINES[state.engine];
  const vocal = buildVocalPhrase(state);

  // Comma-separated descriptor list, genre-anchored at the front (Suno weights
  // the front of the prompt most heavily). Instrumentation lives only in the
  // slots; phase carries tempo + energy/feel only; mood is filter-only and is
  // intentionally NOT in the payload. (Format decision, 2026-06-27.)
  // NOTE: era bias is a LYRIC-engine control (state.song.eraBias, lyric mechanics
  // panel -> prompt-lyric-builder). It is intentionally NOT in the style payload.
  const descriptorParts = [
    engine.genre,        // 1. genre anchor, front-weighted
    state.style.phase,   // 2. tempo + energy/feel only (no instruments, no brand names)
    state.style.pad,     // 3-8. slots = single source of truth for instrumentation
    state.style.bass,
    state.style.rhythm,
    state.style.percussion,
    state.style.motif,
    state.style.movement,
    vocal,               // 10. vocal direction
    MASTERING            // 11. production tail
  ].filter(Boolean);

  const descriptors = descriptorParts
    .map(p => p.replace(/\s*\.\s*$/, ""))   // drop trailing period so phrases read as clean descriptors
    .join(", ")
    .replace(/[ \t]+/g, " ")     // collapse runs of spaces/tabs
    .replace(/\s*,\s*/g, ", ")   // normalise comma spacing
    .replace(/,\s*,/g, ", ")     // drop any empty descriptor gaps
    .trim();

  // MAX-mode meta tags (bracketed) lead as their own block, then the comma list.
  const out = state.style.maxMode ? (MAX_MODE_STR + "\n" + descriptors) : descriptors;

  return out.length <= 1000 ? out : out.slice(0, 997).trimEnd() + "...";
}

export function buildNegativePrompt(state) {
  const engine = STYLE_ENGINES[state.engine];
  return [engine.sourceNegative || engine.negatives, state.style.negativePrompt]
    .filter(Boolean)
    .join(", ");
}

function buildVocalPhrase(state) {
  if (state.style.vocalMode === "Instrumental") return "instrumental focus, no lead vocal";
  if (state.style.vocalMode === "Persona") return `vocal persona: ${state.style.vocalPersona}`;
  return `vocal descriptor: ${state.style.vocalDescriptor}`;
}

/* ============================================================================
 * prompt-style-builder.js  -  turns selections into Suno payloads (BUILDER)
 *
 * Two build paths, both emit the validated format (a comma-separated descriptor
 * list, genre-anchored at the front):
 *   - classic slot path  : reads state.style.{phase,pad,bass,rhythm,percussion,
 *                          motif,movement} — the per-engine slot arrays.
 *   - flavour-cluster path: Balearic-validated. Reads a cluster fingerprint from
 *                          EngineExtras with an Electronic/Acoustic/Blend palette.
 *
 * buildStylePrompt/buildNegativePrompt are the entry points; they route to the
 * cluster path when state.style.buildMode === "cluster" AND the selected engine
 * actually defines the chosen cluster (otherwise they fall back to classic).
 *
 * State note: this app uses NESTED state — style fields live under state.style,
 * the engine name at state.engine. Era bias is a Lyric-engine control only and
 * is intentionally NOT in the style payload.
 * ==========================================================================*/
import { MASTERING, MAX_MODE_STR, STYLE_ENGINES } from "./data-style-engines.js";
import { EngineExtras, drawInterplay } from "./engine-extras.js";

/* join descriptor parts into one clean comma line, drop trailing periods, honour
 * the 1000-char budget, lead with the MAX-mode meta-tag block when enabled. */
function assembleDescriptors(parts, maxMode) {
  const descriptors = parts
    .filter(Boolean)
    .map(p => String(p).replace(/\s*\.\s*$/, ""))
    .join(", ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .replace(/,\s*,/g, ", ")
    .trim();
  const out = maxMode ? (MAX_MODE_STR + "\n" + descriptors) : descriptors;
  return out.length <= 1000 ? out : out.slice(0, 997).trimEnd() + "...";
}

/* Instrumental is NOT declared in the style field (unreliable in Suno); the
 * reliable control is the [Instrumental] lyrics tag (buildLyricsField) + Suno's
 * own Instrumental toggle. Descriptor/Persona describe a WANTED vocal, so they
 * stay in the style prompt. */
function buildVocalPhrase(state) {
  const s = state.style;
  if (s.vocalMode === "Instrumental") return "";
  if (s.vocalMode === "Persona") return s.vocalPersona ? `vocal persona: ${s.vocalPersona}` : "";
  if (s.vocalMode === "Descriptor") return s.vocalDescriptor ? `vocal descriptor: ${s.vocalDescriptor}` : "";
  return "";
}

export function buildLyricsField(state) {
  return state.style.vocalMode === "Instrumental" ? "[Instrumental]" : "";
}

/* ---- non-musical bans (every prompt) + beatless drum guard --------------- */
const ALWAYS_BAN = [
  "field recordings", "air texture", "room tone", "foley", "sound effects",
  "vinyl crackle", "tape hiss", "nature sounds", "ambient noise"
];
const BEATLESS_BAN = [
  "drums", "drum kit", "kick drum", "beat", "percussion", "hi-hats", "snare"
];

/* ---- flavour-cluster path (Balearic-validated) --------------------------- */
export function buildClusterPrompt(clusterId, state) {
  const engineName = state.engine;
  const s = state.style;
  const engine = EngineExtras[engineName] || {};
  const c = (engine.flavourClusters || {})[clusterId];
  if (!c) return "";
  const pick = pool => (Array.isArray(pool) && pool.length)
    ? pool[Math.floor(Math.random() * pool.length)] : null;
  const palette = s.palette || "electronic";
  const E = (c.palettes && c.palettes.electronic) || {};
  const A = (c.palettes && c.palettes.acoustic) || {};
  // Electronic (proven default). Acoustic pulls the characterful pools. Blend
  // keeps the electronic production backbone (pads, rhythm, movement) and lets
  // the character slots (bass, strings, motif) pull from either palette per-song.
  function slot(name) {
    if (palette === "acoustic") return pick(A[name]) || pick(E[name]);
    if (palette === "blend") {
      const character = (name === "bass" || name === "strings" || name === "motif");
      if (character && Array.isArray(A[name]) && A[name].length && Math.random() < 0.5)
        return pick(A[name]);
      return pick(E[name]);
    }
    return pick(E[name]); // electronic
  }
  const presetDriven = !!(engine.presetMap);
  let tempo;
  if (c.beatless) tempo = c.phase;                                   // beatless: tempo is moot
  else if (s.bpmOverride) tempo = s.bpmOverride + " BPM, " + (c.energy || "medium energy");
  else if (presetDriven && s.phase) tempo = s.phase;                 // Preset sets character, Phase sets tempo
  else tempo = c.phase;
  const arrangement = (s.arrangement && c.interplay)
    ? drawInterplay(engineName, clusterId).join(", ") : null;
  const colorPick = slot("color");
  const colorChance = (typeof c.colorChance === "number") ? c.colorChance : 0.5;
  const color = (colorPick && Math.random() < colorChance) ? colorPick : null;
  const parts = [
    c.genre || STYLE_ENGINES[engineName].genre,  // genre anchor (per-cluster, else engine default)
    tempo,                                // BPM range + energy (or override number)
    slot("pads"),
    slot("harmony"),                      // harmonic + song-structure direction
    slot("bass"),
    c.beatless ? null : slot("rhythm"),
    slot("strings"),                      // string / choir / chant bed
    slot("motif"),                        // always-on melodic hook (instrumental)
    color,                                // occasional colour, fills gaps
    arrangement,                          // optional interplay layer
    slot("movement"),                     // production movement
    buildVocalPhrase(state),
    MASTERING
  ];
  return assembleDescriptors(parts, s.maxMode);
}

export function buildClusterNegative(clusterId, state) {
  const engineName = state.engine;
  const s = state.style;
  const engine = EngineExtras[engineName] || {};
  const c = (engine.flavourClusters || {})[clusterId] || {};
  const items = [
    (STYLE_ENGINES[engineName] || {}).sourceNegative,
    ...ALWAYS_BAN,
    ...(c.beatless ? BEATLESS_BAN : []),
    ...(c.bannedAdd || []),
    s.negativePrompt
  ].filter(Boolean);
  const removeSet = new Set((c.bannedRemove || []).map(
    x => x.replace(/^[-\s]+/, "").trim().toLowerCase()));
  const seen = new Set();
  const out = [];
  for (const it of items.join(", ").split(",").map(x => x.trim()).filter(Boolean)) {
    const bare = it.replace(/^[-\s]+/, "").trim().toLowerCase();
    if (removeSet.has(bare)) continue;
    if (seen.has(bare)) continue;
    seen.add(bare); out.push(it);
  }
  return out.join(", ");
}

/* ---- classic slot path (any engine) ------------------------------------- */
function buildClassicStyle(state) {
  const e = STYLE_ENGINES[state.engine];
  const s = state.style;
  const parts = [
    e.genre,        // genre anchor, front-weighted
    s.phase,        // tempo + energy/feel only
    s.pad,          // slots = single source of truth for instrumentation
    s.bass,
    s.rhythm,
    s.percussion,
    s.motif,
    s.movement,
    buildVocalPhrase(state),
    MASTERING
  ];
  return assembleDescriptors(parts, s.maxMode);
}

function clusterActive(state) {
  const s = state.style;
  if (s.buildMode !== "cluster") return false;
  const engine = EngineExtras[state.engine] || {};
  return !!(engine.flavourClusters || {})[s.cluster];
}

/* Preset-driven engines (those with a presetMap, e.g. Enigma): the Engine Preset
 * IS the character selector and maps to a flavour cluster, so instrumentation is
 * set behind the scenes. Returns the cluster id for the current preset, or null. */
function presetCluster(state) {
  const map = (EngineExtras[state.engine] || {}).presetMap;
  const hit = map && map[state.style.preset];
  return hit ? hit.cluster : null;
}

/* ---- entry points (app.js calls these) ---------------------------------- */
export function buildStylePrompt(state) {
  const pc = presetCluster(state);
  if (pc) return buildClusterPrompt(pc, state);
  if (clusterActive(state)) return buildClusterPrompt(state.style.cluster, state);
  return buildClassicStyle(state);
}

export function buildNegativePrompt(state) {
  const pc = presetCluster(state);
  if (pc) return buildClusterNegative(pc, state);
  if (clusterActive(state)) return buildClusterNegative(state.style.cluster, state);
  const e = STYLE_ENGINES[state.engine];
  return [e.sourceNegative || e.negatives, state.style.negativePrompt].filter(Boolean).join(", ");
}

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
/* Budget-aware assembly. Parts may be plain strings (core, never dropped) or
 * {t, drop} objects (optional layers, with a drop priority — highest number is
 * shed first). The extra instrument layers (perc/texture/counter/colour) and the
 * interplay arc are shed in that order only if the prompt would exceed 1000
 * chars, so arrangements are as full as the budget allows and never truncated. */
function fitParts(parts, maxMode, locked) {
  const isLocked = p => p && p.role && locked && locked[p.role] != null && locked[p.role] !== "";
  const drops = [...new Set(parts.filter(p => p && p.drop != null && !isLocked(p)).map(p => p.drop))]
    .sort((a, b) => b - a);   // highest drop number is shed first
  let live = parts.slice();
  for (let i = 0; ; i++) {
    const flat = live.map(p => (p && p.t !== undefined) ? p.t : p);
    const raw = joinDescriptors(flat, maxMode);          // untruncated length is what we budget against
    if (raw.length <= 1000 || i >= drops.length) return raw.length <= 1000 ? raw : assembleDescriptors(flat, maxMode);
    live = live.filter(p => !(p && p.drop === drops[i] && !isLocked(p)));
  }
}

function joinDescriptors(parts, maxMode) {
  const descriptors = parts
    .filter(Boolean)
    .map(p => String(p).replace(/\s*\.\s*$/, ""))
    .join(", ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .replace(/,\s*,/g, ", ")
    .trim();
  return maxMode ? (MAX_MODE_STR + "\n" + descriptors) : descriptors;
}

function assembleDescriptors(parts, maxMode) {
  const out = joinDescriptors(parts, maxMode);
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

/* ---- flavour-cluster path (Balearic-validated) ---------------------------
 * Deterministic per seed (state.style.rngSeed): the same seed always yields the
 * same draw, which is what makes the 3-level control (Randomize all / Lock some /
 * Full manual) meaningful on this path. state.style.slotLocks maps a cluster role
 * (pads|harmony|bass|rhythm|strings|motif|color|movement) to a chosen option; an
 * absent/empty lock is drawn from the pool as before.
 * Interaction/arrangement language is FORCED ON for engines flagged
 * interplayAlways (standing project rule); other engines keep the toggle.
 * ------------------------------------------------------------------------*/
function mulberry32(a) {
  let t = (a >>> 0) || 1;
  return function () {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildClusterPrompt(clusterId, state) {
  const engineName = state.engine;
  const s = state.style;
  const engine = EngineExtras[engineName] || {};
  const c = (engine.flavourClusters || {})[clusterId];
  if (!c) return "";
  const roll = (s.rngSeed != null) ? mulberry32(s.rngSeed) : Math.random;
  const locks = s.slotLocks || {};
  const pick = pool => (Array.isArray(pool) && pool.length)
    ? pool[Math.floor(roll() * pool.length)] : null;
  const palette = s.palette || "electronic";
  const E = (c.palettes && c.palettes.electronic) || {};
  const A = (c.palettes && c.palettes.acoustic) || {};
  // Electronic (proven default). Acoustic pulls the characterful pools. Blend
  // keeps the electronic production backbone (pads, rhythm, movement) and lets
  // the character slots (bass, strings, motif) pull from either palette per-song.
  function draw(name) {
    if (palette === "acoustic") return pick(A[name]) || pick(E[name]);
    if (palette === "blend") {
      const character = (name === "bass" || name === "strings" || name === "motif");
      if (character && Array.isArray(A[name]) && A[name].length && roll() < 0.5)
        return pick(A[name]);
      return pick(E[name]);
    }
    return pick(E[name]); // electronic
  }
  function slot(name) {
    const locked = locks[name];
    if (locked != null && locked !== "") { draw(name); return locked; }  // keep the draw sequence stable
    return draw(name);
  }
  const presetDriven = !!(engine.presetMap);
  let tempo;
  if (c.beatless) {
    // Beatless stays beatless (no BPM), but in preset-driven mode let the Phase's
    // energy band still apply so ambient responds to the energy control.
    if (presetDriven && s.phase) {
      const energy = (s.phase.match(/([a-z-]+(?:\s+to\s+[a-z-]+)?\s+energy)/i) || [])[1];
      const base = c.phase.replace(/,?\s*[a-z-]+(?:\s+to\s+[a-z-]+)?\s+energy/i, "").replace(/,\s*,/g, ",").replace(/,\s*$/, "").trim();
      tempo = energy ? `${base}, ${energy}` : c.phase;
    } else tempo = c.phase;
  }
  else if (s.bpmOverride) tempo = s.bpmOverride + " BPM, " + (c.energy || "medium energy");
  else if (presetDriven && s.phase) tempo = s.phase;                 // Preset sets character, Phase sets tempo
  else tempo = c.phase;
  const wantInterplay = engine.interplayAlways || s.arrangement;
  const ipPhrases = (wantInterplay && c.interplay) ? drawInterplay(engineName, clusterId, roll) : [];
  const ipCore = ipPhrases.slice(0, 2).join(", ") || null;   // conversation + foundation
  const ipArc = ipPhrases[2] || null;                        // arc (first to be shed if tight)
  const colorLocked = locks.color != null && locks.color !== "";
  const colorPick = slot("color");
  const colorChance = (typeof c.colorChance === "number") ? c.colorChance : 0.5;
  const color = colorPick && (colorLocked || roll() < colorChance) ? colorPick : null;
  const parts = [
    c.genre || STYLE_ENGINES[engineName].genre,  // genre anchor (per-cluster, else engine default)
    tempo,                                // BPM range + energy (or override number)
    slot("pads"),
    slot("harmony"),                      // harmonic + song-structure direction
    slot("bass"),
    c.beatless ? null : slot("rhythm"),
    c.beatless ? null : { t: slot("perc"), drop: 2, role: "perc" },      // extra percussion layer
    slot("strings"),                      // string / choir / chant bed
    { t: slot("texture"), drop: 3, role: "texture" },   // secondary sustained layer
    slot("motif"),                        // always-on melodic hook (instrumental)
    { t: slot("counter"), drop: 1, role: "counter" },   // counter-melody / second voice
    color ? { t: color, drop: 4, role: "color" } : null,  // occasional colour, fills gaps
    ipCore,                               // interaction / arrangement language (mandatory)
    ipArc ? { t: ipArc, drop: 5 } : null, // arc — shed first when the budget is tight
    slot("movement"),                     // production movement
    buildVocalPhrase(state),
    MASTERING
  ];
  return fitParts(parts, s.maxMode, locks);
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
    s.harmony,      // chord / song-structure direction (Chords control)
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

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
import { compactPart } from "../core/compress.js";

/* join descriptor parts into one clean comma line, drop trailing periods, honour
 * the 1000-char budget, lead with the MAX-mode meta-tag block when enabled. */
/* Budget-aware assembly. Parts may be plain strings (core, never dropped) or
 * {t, drop} objects (optional layers, with a drop priority — highest number is
 * shed first). The extra instrument layers (perc/texture/counter/colour) and the
 * interplay arc are shed in that order only if the prompt would exceed 1000
 * chars, so arrangements are as full as the budget allows and never truncated. */
/* COMPRESSION BEFORE SHEDDING (2026-07-14). A modifier overlay needs room inside
 * the same 1,000 chars. Shedding a part to make that room would either strip the
 * engine's identity or drop the overlay the user asked for, so phrasing is
 * compacted first (core/compress.js — filler adverbs only, an instrument noun can
 * never be lost), decorative bands before core, and content is only shed if the
 * fully-compacted prompt is STILL over. Overlay parts (ov:true) are never shed. */
function fitParts(parts, maxMode, locked) {
  const isLocked = p => p && p.role && locked && locked[p.role] != null && locked[p.role] !== "";
  const flatten = ps => ps.map(p => (p && p.t !== undefined) ? p.t : p);
  const measure = ps => joinDescriptors(flatten(ps), maxMode);

  let raw = measure(parts);
  if (raw.length <= 1000) return raw;

  // 1) compact phrasing: optional layers (drop != null) first, then everything.
  for (const level of [1, 2]) {
    for (const scope of ["optional", "all"]) {
      parts = parts.map(p => {
        if (!p) return p;
        const isObj = p && p.t !== undefined;
        const optional = isObj && p.drop != null;
        if (scope === "optional" && !optional) return p;
        if (isLocked(p)) return p;                    // a locked slot is never reworded
        if (isObj) return Object.assign({}, p, { t: compactPart(p.t, level) });
        return compactPart(p, level);
      });
      raw = measure(parts);
      if (raw.length <= 1000) return raw;
    }
  }

  // 2) last resort: shed optional layers, highest drop number first (never overlays,
  //    never locked roles).
  const drops = [...new Set(parts.filter(p => p && p.drop != null && !p.ov && !isLocked(p)).map(p => p.drop))]
    .sort((a, b) => b - a);
  let live = parts.slice();
  for (let i = 0; ; i++) {
    raw = measure(live);
    if (raw.length <= 1000 || i >= drops.length)
      return raw.length <= 1000 ? raw : assembleDescriptors(flatten(live), maxMode);
    live = live.filter(p => !(p && p.drop === drops[i] && !p.ov && !isLocked(p)));
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
  // ---- MODIFIER OVERLAY: writes INTO existing slots; a user lock always wins ----
  const ov = (s.ov && s.ov.roles) || {};
  const lockedRole = n => locks[n] != null && locks[n] !== "";
  const ovv = (name, val) => (ov[name] && !lockedRole(name)) ? ov[name] : val;

  const wantInterplay = engine.interplayAlways || s.arrangement;
  const ipPhrases = (wantInterplay && c.interplay) ? drawInterplay(engineName, clusterId, roll) : [];
  const ipCore = ipPhrases.slice(0, 2).join(", ") || null;   // conversation + foundation
  const ipArc = ov.arc || ipPhrases[2] || null;              // arc (overlay may rewrite it)
  const colorLocked = locks.color != null && locks.color !== "";
  const colorPick = slot("color");
  const colorChance = (typeof c.colorChance === "number") ? c.colorChance : 0.5;
  let color = colorPick && (colorLocked || roll() < colorChance) ? colorPick : null;
  if (ov.color && !lockedRole("color")) color = ov.color;   // an overlay colour always fires
  const rhythmSlot = c.beatless ? null : slot("rhythm");
  const rhythm = (rhythmSlot && ov.groove) ? `${rhythmSlot} ${ov.groove}` : rhythmSlot;  // remixer treats the engine's own drums
  const parts = [
    c.genre || STYLE_ENGINES[engineName].genre,  // genre anchor (per-cluster, else engine default)
    tempo,                                // BPM range + energy (or override number)
    { t: slot("pads"), role: "pads" },
    { t: ovv("harmony", slot("harmony")), role: "harmony" },   // harmonic + song-structure direction
    { t: slot("bass"), role: "bass" },
    { t: rhythm, role: "rhythm" },
    c.beatless ? null : { t: slot("perc"), drop: 2, role: "perc" },      // extra percussion layer
    { t: slot("strings"), role: "strings" },                   // string / choir / chant bed
    { t: ovv("texture", slot("texture")), drop: 3, role: "texture" },    // secondary sustained layer
    { t: ovv("motif", slot("motif")), role: "motif" },         // always-on melodic hook (instrumental)
    { t: ovv("counter", slot("counter")), drop: 1, role: "counter" },    // counter-melody / second voice
    color ? { t: color, drop: 4, role: "color" } : null,  // occasional colour, fills gaps
    ipCore,                               // interaction / arrangement language (mandatory)
    ipArc ? { t: ipArc, drop: 5, ov: !!ov.arc } : null,   // arc — shed first when the budget is tight
    ov.edit || null,                      // remixer edit treatment
    { t: ovv("movement", slot("movement")), role: "movement" },   // production movement
    ov.treat || null,                     // producer mix treatment
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
    ...((s.ov && s.ov.negative) || []),      // overlay bans (e.g. no SAW-era drums)
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
  const ov = (s.ov && s.ov.roles) || {};
  const rhythm = (s.rhythm && ov.groove) ? `${s.rhythm} ${ov.groove}` : s.rhythm;
  const parts = [
    e.genre,                    // genre anchor, front-weighted
    s.phase,                    // tempo + energy/feel only
    s.pad,                      // slots = single source of truth for instrumentation
    ov.harmony || s.harmony,    // chord / song-structure direction (Chords control)
    s.bass,
    rhythm,
    s.percussion,
    ov.motif || s.motif,
    ov.counter || null,         // overlay-only roles (the classic path has no such slots)
    ov.texture || null,
    ov.color || null,
    ov.arc || null,
    ov.edit || null,
    ov.movement || s.movement,
    ov.treat || null,
    buildVocalPhrase(state),
    MASTERING
  ];
  return fitParts(parts, s.maxMode, null);
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
  const ovNeg = ((state.style.ov && state.style.ov.negative) || []).join(", ");
  return [e.sourceNegative || e.negatives, ovNeg, state.style.negativePrompt].filter(Boolean).join(", ");
}

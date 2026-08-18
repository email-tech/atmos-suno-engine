/* core/detail-seed.js — DETAIL & MOVEMENT SUB-SEEDS (spec v2.0 §4).
 *
 * THE PROPERTY THIS EXISTS TO GUARANTEE: changing one of the three new
 * dropdowns must not re-roll the musical build. Ear Candy Off → Balanced
 * changes the Ear Candy layer and nothing else — not the character, palette,
 * pad, bass, lead, percussion, kit, vocal identity or harmony.
 *
 * WHY A SHARED RNG WOULD BREAK THAT, and why it is worth stating rather than
 * assuming: every draw from a sequential generator shifts every draw after it.
 * The interplay layer already taught this project the lesson in miniature — the
 * conditional-interplay work (84effaa) had to keep exactly one rng call per
 * dimension for precisely this reason. Three new resolvers drawing from the
 * build's generator would move every subsequent decision, so switching Ear
 * Candy on would silently change the bass. The user would read that as the tool
 * being unpredictable, and A/B testing a single control would be impossible.
 *
 * So each layer gets its own independent stream derived from the build seed and
 * a label. Same build seed plus same label always yields the same stream,
 * regardless of what any other layer did or whether it ran at all.
 *
 * FNV-1a: chosen because it is short, has no dependencies, and distributes
 * single-character label differences well — "cast" and "ear-candy" must not
 * land near each other. Cryptographic quality is irrelevant here; independence
 * and reproducibility are the whole requirement.
 * ------------------------------------------------------------------------- */

export const SEED_LABELS = Object.freeze({
  CAST: 'cast',
  VOCAL_TREATMENT: 'vocal-treatment',
  SPACE_MOVEMENT: 'space-movement',
  EAR_CANDY: 'ear-candy',
});

export function deriveSeed(baseBuildSeed, label) {
  const base = (Number(baseBuildSeed) >>> 0) || 0;
  let h = 0x811c9dc5 ^ base;
  const s = String(label);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  /* Fold the base back in after the label so two builds one seed apart do not
   * produce adjacent streams for the same layer. */
  h ^= Math.imul(base ^ 0x9e3779b9, 0x85ebca6b) >>> 0;
  return h >>> 0;
}

/* mulberry32 — same generator family the rest of the app uses, so a reader
 * comparing this to the engine RNG sees one kind of stream, not two. */
export function rngFor(baseBuildSeed, label) {
  let a = deriveSeed(baseBuildSeed, label);
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Deterministic weighted pick that consumes exactly one draw, so a resolver
 * choosing between three candidates and one choosing between nine advance their
 * own stream by the same amount. Keeps a later data edit from shifting an
 * earlier decision. */
export function stablePick(items, rand, weightOf = () => 1) {
  /* filter(Boolean) would drop a legitimately falsy candidate — index 0, an
   * empty-string id, a zero-valued entry. Only null and undefined are absent. */
  const list = (items || []).filter(x => x !== null && x !== undefined);
  if (!list.length) return null;
  /* The single-candidate case still DRAWS. Returning early without consuming
   * the draw would leave the stream in a different place depending on how many
   * candidates a data file happened to contain, so adding one entry to a
   * library would silently shift every later decision — the exact desync the
   * sub-seed design exists to prevent. */
  const r = rand();                       // ALWAYS draw first — see note above
  const weights = list.map(x => Math.max(0, Number(weightOf(x)) || 0));
  const total = weights.reduce((a, b) => a + b, 0);
  if (list.length === 1) return (weights[0] > 0 || total <= 0) ? list[0] : null;
  if (total <= 0) return list[Math.floor(r * list.length)] || list[list.length - 1];
  let acc = 0;
  const target = r * total;
  for (let i = 0; i < list.length; i++) {
    acc += weights[i];
    if (target < acc) return list[i];
  }
  return list[list.length - 1];
}

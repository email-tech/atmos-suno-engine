/* ==========================================================================
 * rules.js — the RULE ENGINE (P2 of the Composition Workbench).
 *
 * Generalizes the congruence PRE-PASS that used to live as inline if/else in
 * core/atoms.js (congruenceGate) into a shared, data-driven evaluator:
 *
 *   - PROFILES are data. A genre profile projects the character side (what a
 *     genre owns + its lean); an overlay profile normalizes the congruence block
 *     already authored on each overlay. Neither copies data — both are read-only
 *     projections of the authored fields, so there is still ONE source of truth
 *     (the character's electronicLean/genreOwned and the overlay's congruence).
 *
 *   - RULES are data. CONGRUENCE_RULES is an ordered list of rule objects, each
 *     a pure predicate over {overlay-profile, genre-profile[, atom]}. A `refuse`
 *     rule short-circuits the whole overlay (genre clash); a `filter` rule drops
 *     individual overlay atoms that would seize a genre-owned family they may not
 *     take. Behaviour lives in the table, not in branches — new congruence policy
 *     is authored by adding a rule, never by editing the evaluator.
 *
 * PARITY: evaluateCongruence returns the EXACT same { ok, atoms, reason } shape
 * and the exact same decision as the old congruenceGate (same rule order, same
 * reason strings), so the holding area — and therefore the composed style string
 * — stays byte-identical. This is a refactor of HOW the decision is made, not
 * WHAT it decides. validate-rules.mjs proves decision-equivalence overlay ×
 * character × palette; the atom parity golden proves the style output is
 * unchanged.
 *
 * P3 (CIL) will read `ruleId` on a refusal for provenance-tiered inference.
 * ========================================================================*/

// ---- PROFILE PROJECTIONS (read-only; no data duplication) ----------------

// Genre profile — the character side of congruence, as data.
// source: the engine/genre a character belongs to (e.g. 'Balearic').
// electronicLean: whether the character accepts an electronic-only overlay.
// owned: the genre-owned families a cross-genre overlay may not seize by default.
export function genreProfile(char) {
  return {
    source: char.source || null,
    electronicLean: !!char.electronicLean,
    owned: new Set(char.genreOwned || []),
  };
}

// Overlay profile — the congruence block authored on each overlay, normalized.
// lean: 'any' | 'electronic'   — required character lean.
// engines: string[] | null      — compatible engine sources (null = any).
// takeover: { family: bool }    — which genre-owned families this overlay may seize.
export function overlayProfile(ov) {
  const c = ov.congruence || {};
  return {
    lean: c.lean || 'any',
    engines: c.engines || null,
    takeover: c.takeover || {},
  };
}

// ---- RULE TABLE (data-driven; order = evaluation order) ------------------
// `refuse` rules run first, in order, and short-circuit. `filter` rules then
// narrow the overlay's atoms. Reason strings are kept byte-identical to the
// former inline gate so nothing downstream (overlayNote, DNA overlayRefused,
// negative-merge decision) shifts.
export const CONGRUENCE_RULES = [
  {
    id: 'lean-gate',
    kind: 'refuse',
    test: (ovp, gp) => ovp.lean === 'electronic' && !gp.electronicLean,
    reason: (ov, char) =>
      `${ov.label} is electronic-only; ${char.label} is not electronic-leaning — refused (genre clash).`,
  },
  {
    id: 'engine-gate',
    kind: 'refuse',
    test: (ovp, gp) => !!ovp.engines && !ovp.engines.includes(gp.source),
    reason: (ov, char) =>
      `${ov.label} is not congruent with ${char.source} — refused.`,
  },
  {
    id: 'takeover-gate',
    kind: 'filter',
    // keep an overlay atom UNLESS it would seize a genre-owned family it may not take.
    keep: (atom, ovp, gp) =>
      !(atom.family && gp.owned.has(atom.family) && !ovp.takeover[atom.family]),
  },
];

// ---- EVALUATOR -----------------------------------------------------------
// The single entry point that replaces the inline congruenceGate. Pure data:
// project both sides to profiles, run the refuse rules, then apply the filter
// rules to the overlay's atoms.
export function evaluateCongruence(ov, char, rules) {
  const table = rules || CONGRUENCE_RULES;
  const ovp = overlayProfile(ov);
  const gp = genreProfile(char);

  for (const rule of table) {
    if (rule.kind === 'refuse' && rule.test(ovp, gp))
      return { ok: false, atoms: {}, reason: rule.reason(ov, char), ruleId: rule.id };
  }

  const filters = table.filter(r => r.kind === 'filter');
  const atoms = {};
  for (const [k, a] of Object.entries(ov.atoms)) {
    if (filters.every(f => f.keep(a, ovp, gp))) atoms[k] = a;
  }
  return { ok: true, atoms, reason: null, ruleId: null };
}

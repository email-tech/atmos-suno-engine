/* core/detail-system.js — DETAIL & MOVEMENT SYSTEM (spec v2.0).
 *
 * Replaces the Composer / Producer / Remixer modifier concept. Three sibling
 * user controls, each a separate job:
 *
 *   Ear Candy         short non-structural details on existing cast members
 *   Space & Movement  spatial/timbral processing on compatible existing sources
 *   Vocal Treatment   deliberate transformation of an existing vocal source
 *
 * THE NON-NEGOTIABLE PRINCIPLE (§1.2): this modifies behaviour AROUND the cast;
 * it does not rebuild the engine. The engine, character, palette and cast stay
 * the source of truth. These resolvers may annotate, process or briefly
 * repurpose an eligible existing voice. They must never silently replace a
 * signature instrument, rewrite legacy prompt content, or be used to route
 * around an engine exclusion.
 *
 * That principle is why this is a separate module rather than an extension of
 * core/cast.js. Reconciliation decides WHO IS IN THE BAND. This decides WHAT IS
 * DONE TO THEM. Folding the two together would let a detail resolver win a
 * budget contest against an instrument, which is exactly the failure the
 * composer layer produced before it was rebuilt.
 *
 * WHAT IS BUILT HERE, AND WHAT IS NOT — stated plainly so the next session does
 * not mistake a skeleton for a finished feature:
 *   BUILT   the state model, the normalised context, the fixed resolver order,
 *           independent sub-seeds, the no-op paths, and the parity guarantee
 *   PENDING the canonical prose libraries (§6.4, §7.6, §8.12), the capability
 *           matrices, candidate scoring, the six engine policies (§11, §12), the
 *           cross-resolver conflict system (§9), budget compaction (§10) and the
 *           metatag hints contract (§14)
 * With all three controls Off — which §1.3 REQUIRES for the first integrated
 * release — this module is a no-op and output is byte-identical to the build
 * before it existed. That is asserted by validate-detail-system.mjs, and it is
 * the property that lets the rest land incrementally without a regression risk
 * on every commit.
 *
 * EVIDENCE STATE: the spec is explicit that Suno publishes no parameters named
 * ear candy, ping-pong delay, vocoder or stutter edit. This is natural-language
 * steering, not a DSP graph. Everything the prose libraries will assert is a
 * DESIGN INFERENCE until John A/B tests it, and must not be promoted to a Suno
 * fact in core/knowledge.js on the strength of sounding right.
 * ------------------------------------------------------------------------- */
import { rngFor, stablePick, SEED_LABELS } from './detail-seed.js';
import { resolveVocalTreatmentFull } from './detail-vocal.js';

/* ---- STATE (§15) ------------------------------------------------------
 * UI INTENT AND RESOLVED RESULT ARE KEPT SEPARATE, deliberately. A resolver
 * that finds no eligible target returns a no-op WITH A REASON; if that
 * overwrote the user's choice, the control would appear to reset itself and the
 * reason would be lost. The user asked for a vocoder; the build could not give
 * them one. Both facts have to survive. */
export const EAR_CANDY_MODES      = Object.freeze(['off', 'subtle', 'balanced', 'active']);
export const SPACE_MOVEMENT_MODES = Object.freeze(['off', 'auto', 'widthDepth', 'rhythmicMotion', 'modulatedMotion', 'filterEvolution']);
export const VOCAL_TREATMENT_MODES = Object.freeze(['off', 'auto', 'vocoder', 'talkbox', 'vocalChops', 'stutter', 'glitch']);

/* §1.3 REGRESSION DEFAULT. All three Off for the first integrated release, so
 * the app can be regression-tested against the pre-modification baseline.
 * Product defaults may only change after controlled Suno A/B validation. */
export function defaultDetailState() {
  return { earCandy: 'off', spaceMovement: 'off', vocalTreatment: 'off' };
}

export function emptyResolvedDetail() {
  return { vocalTreatment: null, spaceMovement: [], earCandy: [], conflicts: [], compacted: [], metatagHints: [] };
}

const isOff = (v) => !v || v === 'off';

/* ---- CONTEXT (§16) ---------------------------------------------------
 * One normalised object through all three resolvers. Built from whatever the
 * calling path already has, because the three engine kinds hold their cast in
 * three different shapes: the atom path has typed atoms, the resolver path has
 * eight prose slots, and legacy has load-bearing source sentences. Normalising
 * here is what lets one set of resolvers serve all three without each of them
 * learning three shapes. */
export function buildDetailContext(input) {
  const i = input || {};
  return {
    baseBuildSeed: (Number(i.seed) >>> 0) || 0,
    engineId: i.engineId || null,
    engineKind: i.engineKind || 'resolver',      // atom | resolver | legacy
    characterId: i.characterId || null,
    palette: i.palette || null,
    beatless: !!i.beatless,
    energy: i.energy || null,
    tempo: i.tempo || null,
    maxMode: !!i.maxMode,

    cast: i.cast || [],
    vocalSources: i.vocalSources || [],
    baseMovement: i.baseMovement || [],
    interplay: i.interplay || [],
    negativePrompt: i.negativePrompt || [],
    promptBudget: { maxChars: (i.promptBudget && i.promptBudget.maxChars) || 1000,
                    currentBaseChars: (i.promptBudget && i.promptBudget.currentBaseChars) || 0 },

    uiIntent: Object.assign(defaultDetailState(), i.uiIntent || {}),
    enginePolicy: i.enginePolicy || null,
    characterPolicy: i.characterPolicy || null,
  };
}

/* A no-op carries its REASON. §9.6 makes no-op a valid outcome, and §20.5 wants
 * validation feedback in the UI — "you asked for talkbox and this build has no
 * plausible carrier" is useful; a silently empty result is not. */
const noOp = (reason) => ({ noOp: true, reason, rendered: null, semanticTags: [] });

/* ---- RESOLVERS (§18) -------------------------------------------------
 * Order is fixed and is NOT arbitrary (§3.2, §3.3): Vocal Treatment first
 * because it can change vocal identity and temporal structure, so everything
 * after it must see that decision; Space & Movement second because it processes
 * layers continuously and must avoid doubling what the vocal treatment already
 * did; Ear Candy last because incidental detail should fill the gaps the other
 * two left rather than compete with them.
 *
 * Each currently returns a no-op for any non-off intent, with the reason naming
 * the missing piece. That is honest — the control is wired, the library is not
 * written — and it means turning a control on today changes nothing rather than
 * emitting half-designed prose into a prompt. */
export function resolveVocalTreatment(ctx) {
  if (isOff(ctx.uiIntent.vocalTreatment)) return null;
  /* IMPLEMENTED — core/detail-vocal.js carries the §8 taxonomy, protection
   * rules and the canonical prose library transcribed verbatim. */
  return resolveVocalTreatmentFull(ctx, ctx.enginePolicy && ctx.enginePolicy.vocalTreatment);
}

export function resolveSpaceMovement(ctx, vocalResult) {
  if (isOff(ctx.uiIntent.spaceMovement)) return [];
  if (!ctx.cast.length) return [noOp('no-eligible-source')];
  return [noOp('space-movement-library-pending')];
}

export function resolveEarCandy(ctx, vocalResult, movementResults) {
  if (isOff(ctx.uiIntent.earCandy)) return [];
  if (!ctx.cast.length) return [noOp('no-eligible-source')];
  return [noOp('ear-candy-library-pending')];
}

/* ---- ORCHESTRATION (§18.4) ------------------------------------------- */
export function resolveDetailSystem(input) {
  const ctx = buildDetailContext(input);
  const out = emptyResolvedDetail();
  out.uiIntent = ctx.uiIntent;

  const allOff = isOff(ctx.uiIntent.earCandy)
              && isOff(ctx.uiIntent.spaceMovement)
              && isOff(ctx.uiIntent.vocalTreatment);
  /* THE PARITY FAST PATH. Not an optimisation — it is the guarantee. With every
   * control off, nothing downstream can observe that this module ran. */
  if (allOff) return out;

  const vocal = resolveVocalTreatment(ctx);
  const movement = resolveSpaceMovement(ctx, vocal);
  const earCandy = resolveEarCandy(ctx, vocal, movement);

  out.vocalTreatment = vocal;
  out.spaceMovement = movement;
  out.earCandy = earCandy;

  /* Conflict resolution (§9), budget compaction (§10) and metatag hints (§14)
   * land here once the libraries exist. Until then every result is a no-op, so
   * there is nothing to deduplicate, nothing to compact and nothing to hint. */
  return out;
}

/* ---- RENDERING (§3.4) ------------------------------------------------
 * NO PROMPT-STRING REWRITING. Detail clauses are APPENDED to the assembled
 * style string; the engine's own prose is never edited in place. Rewriting
 * would put this module in the business of authoring engine content, which
 * §1.2 forbids and which the composer layer already demonstrated goes wrong. */
export function renderDetailClauses(resolved) {
  if (!resolved) return [];
  const all = [
    resolved.vocalTreatment,
    ...(resolved.spaceMovement || []),
    ...(resolved.earCandy || []),
  ];
  return all.filter(x => x && !x.noOp && x.rendered).map(x => x.rendered);
}

/* Every no-op with a reason, for §20.5 UI feedback and §23.4 the debug report.
 * Surfaced rather than swallowed: a user who picks talkbox on a build with no
 * plausible carrier should be told, not left wondering. */
export function detailNoOpReasons(resolved) {
  if (!resolved) return [];
  const all = [resolved.vocalTreatment, ...(resolved.spaceMovement || []), ...(resolved.earCandy || [])];
  return all.filter(x => x && x.noOp).map(x => x.reason);
}

/* NOTE: no `export { ... }` re-export of the seed helpers here. The bundler
 * rewrites imports into destructures off a shared registry and has no rule for
 * a re-export statement — its fail-loud guard (added 84effaa) caught this on
 * the first build rather than writing an unparseable bundle. Consumers import
 * from core/detail-seed.js directly, which is the clearer dependency anyway. */

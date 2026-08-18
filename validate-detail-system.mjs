/* ==========================================================================
 * validate-detail-system.mjs — DETAIL & MOVEMENT SYSTEM (spec v2.0).
 *
 * The skeleton's whole value is two guarantees. Both are asserted here, because
 * the libraries land incrementally and every one of those commits needs
 * something standing behind it.
 *
 *   §1.3 BASELINE PARITY   all three controls Off => byte-identical output
 *   §4   SEED ISOLATION    changing one control changes only that layer
 * ========================================================================*/
import {
  resolveDetailSystem, buildDetailContext, defaultDetailState, emptyResolvedDetail,
  renderDetailClauses, detailNoOpReasons,
  EAR_CANDY_MODES, SPACE_MOVEMENT_MODES, VOCAL_TREATMENT_MODES,
} from './core/detail-system.js';
import { deriveSeed, rngFor, stablePick, SEED_LABELS } from './core/detail-seed.js';
import { ERA } from './engines/era.js';
import { DELERIUM } from './engines/delerium.js';
import { DEEPFOREST } from './engines/deepforest.js';
import { SACREDSPIRIT } from './engines/sacredspirit.js';
import { build } from './core/resolver.js';

let failures = 0, checks = 0;
const bad = (m) => { console.error(`  FAIL: ${m}`); failures++; };
const ok = (c, m) => { if (!c) bad(m); };

/* ---- 1: the regression default is Off on all three -------------------- */
{
  const d = defaultDetailState();
  ok(d.earCandy === 'off' && d.spaceMovement === 'off' && d.vocalTreatment === 'off',
    '§1.3 requires all three controls default to Off so the app can be regression-tested against the pre-modification baseline');
  ok(EAR_CANDY_MODES[0] === 'off' && SPACE_MOVEMENT_MODES[0] === 'off' && VOCAL_TREATMENT_MODES[0] === 'off',
    'off must be the first mode of each control');
  checks++;
  console.log('  §1.3 default: all three controls Off.');
}

/* ---- 2: baseline parity ---------------------------------------------- */
{
  /* With everything off the resolver must produce the empty result and render
   * nothing. If it ever emitted a clause here, every existing golden reference
   * and every A/B comparison in the project would shift under it. */
  const empty = JSON.stringify(emptyResolvedDetail());
  let n = 0;
  for (const e of [ERA, DELERIUM, DEEPFOREST, SACREDSPIRIT]) {
    for (const chId of Object.keys(e.characters)) {
      for (const seed of [1, 2, 3, 17, 99]) {
        const out = build(e, { characterId: chId, palette: 'electronic', seed });
        const r = resolveDetailSystem({
          seed, engineId: e.id, engineKind: 'resolver', characterId: chId, palette: 'electronic',
          cast: [{ id: 'x' }], vocalSources: [{ id: 'v' }],
        });
        n++;
        const { uiIntent, ...rest } = r;
        ok(JSON.stringify(rest) === empty, `${e.id}/${chId}/${seed}: detail system produced output with every control Off`);
        ok(renderDetailClauses(r).length === 0, `${e.id}/${chId}/${seed}: a clause was rendered with every control Off`);
        ok(out.style.length > 0, 'the underlying build must still produce a style string');
      }
    }
  }
  checks++;
  console.log(`  §1.3 parity: ${n} builds, nothing rendered and nothing resolved with all controls Off.`);
}

/* ---- 3: seed isolation ------------------------------------------------
 * The property the whole sub-seed design exists for. Turning Ear Candy on must
 * not move the Space & Movement or Vocal Treatment streams, or A/B testing one
 * control would be impossible and the tool would look non-deterministic. */
{
  const labels = Object.values(SEED_LABELS);
  for (const base of [0, 1, 2, 7, 12345, 4294967295]) {
    const seeds = labels.map(l => deriveSeed(base, l));
    ok(new Set(seeds).size === labels.length, `seed ${base}: two layers share a stream — one control would re-roll another`);
    for (const s of seeds) ok(Number.isInteger(s) && s >= 0, `seed ${base}: derived seed must be a non-negative integer`);
  }
  // same input, same stream, always
  for (const l of labels) {
    ok(deriveSeed(42, l) === deriveSeed(42, l), `${l}: derivation must be deterministic`);
    const a = rngFor(42, l), b = rngFor(42, l);
    ok(a() === b() && a() === b(), `${l}: the same seed and label must produce the same stream`);
  }
  // adjacent build seeds must not produce adjacent streams for the same layer
  const near = [deriveSeed(1000, 'ear-candy'), deriveSeed(1001, 'ear-candy'), deriveSeed(1002, 'ear-candy')];
  ok(Math.abs(near[0] - near[1]) > 1000 && Math.abs(near[1] - near[2]) > 1000,
    'adjacent build seeds produce adjacent streams — neighbouring builds would share detail choices');
  // one label differing by a single character must not collide
  ok(deriveSeed(7, 'ear-candy') !== deriveSeed(7, 'ear-candz'), 'single-character label differences must not collide');
  checks++;
  console.log('  §4 seed isolation: four independent, deterministic, well-separated streams.');
}

/* ---- 4: stablePick consumes exactly one draw -------------------------- */
{
  /* A resolver choosing between three candidates and one choosing between nine
   * must advance their own stream by the same amount, or a later data edit
   * silently changes an earlier decision. This is the same contract the
   * interplay work had to hold (exactly one rng call per dimension). */
  for (const size of [1, 3, 9, 40]) {
    let calls = 0;
    const items = Array.from({ length: size }, (_, i) => i);
    stablePick(items, () => { calls++; return 0.5; });
    ok(calls === 1, `stablePick over ${size} items made ${calls} draws, must be exactly 1`);
  }
  ok(stablePick([], () => 0.5) === null, 'an empty candidate list must return null, not throw');
  const weighted = stablePick(['a', 'b'], () => 0.99, (x) => (x === 'a' ? 0 : 1));
  ok(weighted === 'b', 'a zero-weight candidate must never be picked');
  checks++;
  console.log('  stablePick: exactly one draw whatever the candidate count, zero weights excluded.');
}

/* ---- 5: no-ops carry a reason ---------------------------------------- */
{
  /* §9.6 makes no-op valid and §20.5 wants the user told why. A silently empty
   * result would leave someone who picked talkbox on a build with no plausible
   * carrier wondering whether the control is broken. */
  const r = resolveDetailSystem({
    seed: 5, engineId: 'Era', engineKind: 'resolver', characterId: 'x',
    cast: [], vocalSources: [],
    uiIntent: { earCandy: 'balanced', spaceMovement: 'rhythmicMotion', vocalTreatment: 'vocoder' },
  });
  const reasons = detailNoOpReasons(r);
  ok(reasons.length === 3, `every unfulfilled control must report a reason, got ${reasons.length}`);
  ok(reasons.every(x => typeof x === 'string' && x.length > 3), 'every no-op reason must be a readable string');
  ok(renderDetailClauses(r).length === 0, 'a no-op must never render a clause');
  /* User intent survives the resolver — §15 is explicit that the resolved
   * result must not overwrite what the user asked for. */
  ok(r.uiIntent.vocalTreatment === 'vocoder', 'the resolver must not overwrite user intent with its own result');
  checks++;
  console.log('  no-ops: reason carried, nothing rendered, user intent preserved.');
}

/* ---- 6: the context normalises all three engine kinds ----------------- */
{
  for (const kind of ['atom', 'resolver', 'legacy']) {
    const c = buildDetailContext({ seed: 3, engineKind: kind });
    ok(c.engineKind === kind, `context must carry engineKind ${kind}`);
    ok(c.promptBudget.maxChars === 1000, 'default prompt budget is 1000 chars');
    ok(Array.isArray(c.cast) && Array.isArray(c.vocalSources) && Array.isArray(c.negativePrompt),
      `${kind}: context collections must always be arrays, never undefined`);
    ok(c.uiIntent.earCandy === 'off', `${kind}: missing intent must fall back to the Off default, not to undefined`);
  }
  checks++;
  console.log('  §16 context: normalised for atom, resolver and legacy paths.');
}

console.log(`validate-detail-system: ${checks} check groups, ${failures} failures.`);
process.exit(failures ? 1 : 0);

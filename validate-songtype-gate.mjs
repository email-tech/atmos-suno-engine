/* validate-songtype-gate.mjs — proves Phase 2 of the structure-first pipeline:
 * S.songType === 'instrumental' must force lyrics to '[Instrumental]' and
 * suppress vocal-delivery language in the style prompt, across all three
 * engine kinds (atom, resolver, legacy). S.songType === 'vocal' must leave
 * the engine's own vocal control in charge, unchanged from pre-Phase-2
 * behaviour.
 *
 * See docs/architecture/structure-first-pipeline-plan.md (approved by John
 * 2026-08-12) for the pipeline this gate implements, and guide §2
 * (docs/knowledge/structure-and-energy.md): "Lyrics field = [Instrumental]
 * ... with the structural markers only" for instrumental song type.
 *
 * Run from repo root: node validate-songtype-gate.mjs
 */
import { initState, syncEngineDefaults, setSongType } from './js/state.js';
import { generate } from './js/generate.js';

let checks = 0, fails = 0;
const bad = (m) => { fails++; console.log('  FAIL: ' + m); };
const ok = (c, m) => { checks++; if (!c) bad(m); };

const ENGINE_BY_KIND = { atom: 'Balearic Atom', resolver: 'Delerium', legacy: 'Balearic' };

/* 1. INSTRUMENTAL GATE — lyrics must be exactly '[Instrumental]' for every
 *    engine kind when songType is instrumental, regardless of the engine's
 *    own per-engine vocal control default. */
{
  for (const [kind, engineId] of Object.entries(ENGINE_BY_KIND)) {
    const S = initState();
    syncEngineDefaults(S, engineId);
    setSongType(S, 'instrumental');
    const out = generate(S);
    ok(out.lyrics === '[Instrumental]',
      `${kind} engine "${engineId}": instrumental songType should force lyrics='[Instrumental]', got "${out.lyrics}"`);
  }
  console.log(`  instrumental gate: lyrics forced to [Instrumental] across ${Object.keys(ENGINE_BY_KIND).length} engine kinds.`);
}

/* 2. LEGACY VOCAL-DELIVERY LANGUAGE SUPPRESSED — the legacy path's vocalMode
 *    control has three options (Instrumental / Descriptor / Persona), and
 *    Descriptor/Persona are DESIGNED to put vocal-delivery text in the style
 *    prompt (buildVocalPhrase in legacy/prompt-style-builder.js). As found
 *    while writing this validator: state.js's S.leg never carries
 *    vocalDescriptor/vocalPersona fields and toLegacyState() hardcodes both
 *    to '' — there is no UI text input for either (js/ui.js only renders the
 *    3-way mode toggle, vocalSeg()). So today, Descriptor/Persona text NEVER
 *    reaches the builder regardless of song type; this is a pre-existing gap
 *    in the app, not something Phase 2 introduces or is responsible for
 *    fixing (noted separately, not blocking this phase). What Phase 2 DOES
 *    control — vocalMode itself — is tested here and in test 4 below.
 */
{
  const S = initState();
  syncEngineDefaults(S, 'Balearic');
  S.leg.vocalMode = 'Descriptor'; // the one wired option that could carry vocal text
  const before = generate(S);
  ok(before.lyrics === '',
    'sanity: vocalMode=Descriptor under songType=vocal should NOT force [Instrumental] lyrics');

  setSongType(S, 'instrumental');
  const after = generate(S);
  ok(after.lyrics === '[Instrumental]',
    'instrumental songType should force lyrics=[Instrumental] even when the per-engine control is set to Descriptor');
  console.log('  legacy vocalMode override: Descriptor -> forced to Instrumental under songType=instrumental.');
}

/* 3. STORED STATE NOT MUTATED — switching songType to instrumental and back
 *    to vocal must restore the user's own per-engine vocal choice untouched.
 *    This is the "does not touch S.leg.vocalMode" guarantee from generate.js. */
{
  const S = initState();
  syncEngineDefaults(S, 'Balearic');
  S.leg.vocalMode = 'Descriptor'; // user's own per-engine choice

  setSongType(S, 'instrumental');
  generate(S); // force a build while instrumental
  ok(S.leg.vocalMode === 'Descriptor',
    `S.leg.vocalMode should be untouched by the instrumental gate, but is now "${S.leg.vocalMode}"`);

  setSongType(S, 'vocal');
  const restored = generate(S);
  ok(restored.lyrics === '',
    'switching songType back to vocal should restore the user\u2019s own vocalMode=Descriptor (lyrics should no longer be forced to [Instrumental])');
  console.log('  state preservation: per-engine vocal choice survives an instrumental round-trip.');
}

/* 4. VOCAL SONG TYPE LEAVES ENGINE CONTROL ALONE — default songType is
 *    'vocal' (see state.js initState); an engine's own Instrumental choice
 *    must still be respected (global gate is a ceiling, not a floor). */
{
  const S = initState();
  syncEngineDefaults(S, 'Balearic');
  S.leg.vocalMode = 'Instrumental'; // user's own per-engine choice
  // songType left at default 'vocal'
  const out = generate(S);
  ok(out.lyrics === '[Instrumental]',
    'engine-level vocalMode=Instrumental should still resolve to [Instrumental] lyrics under songType=vocal');
  console.log('  vocal songType: per-engine Instrumental choice still honoured (gate is a ceiling, not a floor).');
}

/* 5. ATOM AND RESOLVER PATHS — regression guard for actual vocal-DELIVERY
 *    language (a singer performing lyrics), as opposed to vocal-as-TEXTURE
 *    language that some engines legitimately use (e.g. Delerium's proven
 *    "granular stretched-vocal drone", "sacred choral cadence" — vocal-derived
 *    sound design, not a lead singer). Confirmed by source inspection that
 *    neither core/atoms.js nor core/resolver.js reference delivery terms
 *    today; this guards against a future regression introducing them under
 *    an instrumental song type. Deliberately narrower than "contains the
 *    word vocal" — that would false-positive on proven, shipped texture
 *    language and is not what guide §2's "vocal-delivery language" means. */
{
  const DELIVERY_RE = /\bfalsetto\b|\bbreathy vocal\b|\blead vocal\b|\bspoken[- ]word verse\b|\bsung lyrics\b|\bvocal delivery\b|\bbelt(?:ing)? vocal\b|\bcroon(?:ing)?\b|\brap verse\b/i;
  for (const [kind, engineId] of [['atom', 'Balearic Atom'], ['resolver', 'Delerium']]) {
    const S = initState();
    syncEngineDefaults(S, engineId);
    setSongType(S, 'instrumental');
    const out = generate(S);
    ok(!DELIVERY_RE.test(out.style),
      `${kind} engine "${engineId}": style prompt contains vocal-delivery language under songType=instrumental: "${out.style.slice(0, 160)}"`);
  }
  console.log('  atom/resolver: no vocal-delivery language present under instrumental songType (regression guard).');
}

console.log(`validate-songtype-gate: ${checks} checks, ${fails} failures.`);
if (fails) process.exit(1);

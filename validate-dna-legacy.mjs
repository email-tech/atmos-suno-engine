/* validate-dna-legacy.mjs — Musical DNA extractor checks for LEGACY engines
 * (P8, Phase 3). Same coverage discipline as validate-dna.mjs and validate-
 * dna-resolver.mjs, adapted for legacy's two sub-paths per engine (Q2: both
 * shipped). CLUSTER PATH exercised with real pool-driven draws (many seeds
 * per cluster/preset, matching validate-legacy.mjs's own approach) since
 * it's the primary, most complex path. CLASSIC PATH exercised with realistic
 * hand-built states (matching validate-legacy.mjs's classic-parity checks) —
 * this validator's job is buildLegacyDNA's FIELD-MAPPING correctness, not
 * re-proving the random-draw mechanism itself (already 21,396/0 elsewhere). */
import { buildStylePromptWithArrangement } from './legacy/prompt-style-builder.js';
import { buildLegacyDNA } from './core/dna-legacy.js';
import { DNA_CONSUMERS } from './core/dna.js';
import { EngineExtras } from './legacy/engine-extras.js';
import { STYLE_ENGINES } from './legacy/data-style-engines.js';
import { OVERLAYS } from './core/overlays.js';
import { resolveOverlays } from './core/overlays.js';
import { MASTERING } from './core/constants.js';

let fail = 0;
const bad = (m) => { if (fail < 40) console.log('  FAIL:', m); fail++; };

const REQUIRED = ['meta','identity','influences','harmony','arrangement','tempo','dynamics','production','vocal','affect','provenance','consumers','render'];
const oneOf = (kind) => Object.keys(OVERLAYS[kind] || {})[0];
const OVERLAY_SELECTIONS = [null, { composer: oneOf('composer') }, { producer: oneOf('producer') }, { remixer: oneOf('remixer') }];

let clusterCount = 0, classicCount = 0;

function checkCommon(tag, built, dna, opts) {
  for (const k of REQUIRED) if (!(k in dna)) bad(`${tag} missing field ${k}`);
  if (dna.meta.engineKind !== 'legacy') bad(`${tag} engineKind not 'legacy'`);
  if (dna.meta.seed !== (opts.seed >>> 0)) bad(`${tag} seed not captured`);
  if (!dna.identity.genreAnchor) bad(`${tag} no genre anchor`);
  if (dna.identity.genreFamily !== null) bad(`${tag} genreFamily should be null (n/a)`);
  if (dna.harmony.keyMode !== null) bad(`${tag} harmony.keyMode should be null — no key/mode concept exists`);
  if (dna.provenance.harmony !== 'n/a') bad(`${tag} provenance.harmony should be 'n/a'`);
  if (dna.production.masteringTail !== MASTERING) bad(`${tag} masteringTail doesn't match the shared constant`);
  if (dna.affect.mood !== null || dna.affect.emotionalAtmosphere !== null) bad(`${tag} affect fields should be null pre-CIL`);
  if (dna.provenance.affect !== 'unknown') bad(`${tag} provenance.affect should be 'unknown'`);
  if (JSON.stringify(dna.consumers) !== JSON.stringify(DNA_CONSUMERS)) bad(`${tag} consumers contract diverges from core/dna.js's DNA_CONSUMERS`);
  if (dna.render !== null) bad(`${tag} render should be null`);
  if (dna.anchor !== null) bad(`${tag} anchor should be null — legacy engines don't support anchor identities`);
  if (!Array.isArray(dna.arrangement) || !dna.arrangement.length) bad(`${tag} empty arrangement`);
  for (const v of dna.arrangement) {
    if (!v.role || !v.voice) bad(`${tag} arrangement entry missing role/voice`);
    if (v.origin !== 'engine') bad(`${tag} arrangement[${v.role}].origin should be 'engine'`);
    if (v.bedId !== null || v.behaviour !== null || v.signature !== false) bad(`${tag} arrangement[${v.role}] invented a field the legacy model doesn't have`);
  }
  // tempo.spec: either a clean "{n}-{n} BPM" string, 'beatless', or (rare, honest fallback) the raw clause
  const t = dna.tempo.spec;
  if (t !== null && !/^\d+-\d+ BPM$/.test(t) && t !== 'beatless') {
    // raw fallback is allowed but should be flagged as worth knowing about, not silently accepted
    console.log(`  NOTE: ${tag} tempo.spec fell back to raw text: "${t}"`);
  }
  if (dna.tempo.tempoLock !== false) bad(`${tag} tempoLock should be false — legacy has no such concept`);

  // determinism
  const dna2 = buildLegacyDNA(built, opts);
  if (JSON.stringify(dna2) !== JSON.stringify(dna)) bad(`${tag} DNA non-deterministic for identical inputs`);

  // influences bookkeeping (shared helper with the resolver path)
  const sel = opts.overlaySelection;
  if (sel) {
    const kind = Object.keys(sel)[0];
    if (dna.influences.length !== 1) bad(`${tag} expected exactly 1 influence, got ${dna.influences.length}`);
    else {
      const inf = dna.influences[0];
      if (inf.kind !== kind || inf.key !== sel[kind]) bad(`${tag} influence kind/key mismatch`);
      if (inf.renderPolicy !== 'never') bad(`${tag} influence renderPolicy should be 'never'`);
      if (inf.applied !== true) bad(`${tag} influence.applied should be true (known limitation, asserted as observed)`);
    }
    if (dna.provenance.influences !== 'derived') bad(`${tag} provenance.influences should be 'derived' with an overlay selected`);
  } else {
    if (dna.influences.length) bad(`${tag} spurious influence on a bare build`);
    if (dna.provenance.influences !== 'n/a') bad(`${tag} provenance.influences should be 'n/a' with no overlay`);
  }
}

// ---- CLUSTER PATH: real pool-driven draws, both engines --------------------
function mkClusterState(engine, cluster, preset, palette, seed, ov) {
  return {
    engine,
    style: {
      buildMode: preset ? 'classic' : 'cluster',  // irrelevant when preset is set — presetCluster() checks state.style.preset directly
      cluster: cluster || '', preset: preset || '', palette,
      arrangement: false, bpmOverride: '', phase: '',
      rngSeed: seed, slotLocks: {},
      pad: '', bass: '', rhythm: '', percussion: '', motif: '', movement: '',
      vocalMode: 'Instrumental', vocalDescriptor: '', vocalPersona: '',
      maxMode: false, negativePrompt: '', ov,
    },
  };
}

for (const engine of ['Balearic', 'Enigma']) {
  const ex = EngineExtras[engine];
  const presetMap = ex.presetMap;
  const entries = presetMap
    ? Object.keys(presetMap).map(p => ({ preset: p, cluster: presetMap[p].cluster }))
    : Object.keys(ex.flavourClusters).map(k => ({ cluster: k, preset: null }));

  for (const e of entries) {
    for (const palette of ['electronic', 'acoustic']) {
      for (const sel of OVERLAY_SELECTIONS) {
        for (const seed of [11, 909]) {
          clusterCount++;
          const c = ex.flavourClusters[e.cluster];
          const ov = resolveOverlays(sel || {}, { beatless: !!c.beatless, banTags: [] });
          const state = mkClusterState(engine, e.cluster, e.preset, palette, seed, ov);
          const opts = { seed, palette, overlay: ov, vocalMode: 'Instrumental', overlaySelection: sel };
          const tag = `${engine}/${e.preset || e.cluster}/${palette}/${sel ? Object.keys(sel)[0] : 'bare'}`;

          let built, dna;
          try {
            built = buildStylePromptWithArrangement(state);
            dna = buildLegacyDNA(built, opts);
          } catch (err) { bad(`${tag} threw: ${err.message}`); continue; }

          checkCommon(tag, built, dna, opts);

          // cluster-path-specific field checks
          if (dna.arrangement.some(v => v.role === 'pad' || v.role === 'percussion')) {
            bad(`${tag} cluster-path arrangement used classic-path role names`);
          }
          if (dna.dynamics.beatless !== !!c.beatless) bad(`${tag} dynamics.beatless doesn't match the cluster`);
          if (dna.provenance.dynamics !== 'derived') bad(`${tag} cluster path should report dynamics provenance 'derived'`);
          // Q4: subgenre — preset label when preset-driven, else the cluster's own label
          const expectedSubgenre = e.preset || c.label;
          if (dna.identity.subgenre !== expectedSubgenre) {
            bad(`${tag} subgenre "${dna.identity.subgenre}" !== expected "${expectedSubgenre}" (Q4)`);
          }
          if (dna.meta.characterId !== e.cluster) bad(`${tag} meta.characterId should be the cluster id, not the preset label`);
        }
      }
    }
  }
}

// ---- CLASSIC PATH: realistic hand-built states, both engines ---------------
for (const engine of ['Balearic', 'Enigma']) {
  const classic = STYLE_ENGINES[engine];
  for (const sel of OVERLAY_SELECTIONS) {
    for (const seed of [11, 909]) {
      classicCount++;
      const ov = resolveOverlays(sel || {}, { beatless: false, banTags: [] });
      const state = {
        engine,
        style: {
          buildMode: 'classic', cluster: '', preset: '', palette: 'electronic',
          arrangement: false, bpmOverride: '',
          phase: classic.phases[0],
          pad: classic.pads[0], harmony: classic.harmony[0], bass: classic.bass[0],
          rhythm: classic.rhythm[0], percussion: classic.percussion[0],
          motif: classic.motifs[0], movement: classic.movement[0],
          vocalMode: 'Persona', vocalDescriptor: '', vocalPersona: 'breathy alto',
          maxMode: false, negativePrompt: '', ov,
        },
      };
      const opts = { seed, palette: 'electronic', overlay: ov, vocalMode: 'Persona', overlaySelection: sel };
      const tag = `${engine}/classic/${sel ? Object.keys(sel)[0] : 'bare'}`;

      let built, dna;
      try {
        built = buildStylePromptWithArrangement(state);
        dna = buildLegacyDNA(built, opts);
      } catch (err) { bad(`${tag} threw: ${err.message}`); continue; }

      checkCommon(tag, built, dna, opts);

      // classic-path-specific field checks — the absences ARE the contract
      if (dna.identity.subgenre !== null) bad(`${tag} classic-path subgenre should be null (no character/preset concept)`);
      if (dna.meta.characterId !== null) bad(`${tag} classic-path characterId should be null`);
      if (dna.dynamics.beatless !== null) bad(`${tag} classic-path dynamics.beatless should be null (n/a), not false`);
      if (dna.dynamics.arc !== null) bad(`${tag} classic-path dynamics.arc should be null (no interplay mechanism exists)`);
      if (dna.provenance.dynamics !== 'n/a') bad(`${tag} classic path should report dynamics provenance 'n/a'`);
      if (dna.arrangement.some(v => v.role === 'pads' || v.role === 'perc')) {
        bad(`${tag} classic-path arrangement used cluster-path role names`);
      }
      if (dna.vocal.mode !== 'vocal' || dna.vocal.performanceStyle !== 'Persona') {
        bad(`${tag} vocal fields not reading the Persona mode correctly`);
      }
    }
  }
}

console.log(fail
  ? `\nvalidate-dna-legacy: ${fail} failure(s) across ${clusterCount} cluster-path + ${classicCount} classic-path emissions.`
  : `validate-dna-legacy: ${clusterCount} cluster-path + ${classicCount} classic-path emissions (Balearic/Enigma) — schema, Q2/Q3/Q4 field-mapping fidelity, consumer contract, determinism all clean.`);
process.exit(fail ? 1 : 0);

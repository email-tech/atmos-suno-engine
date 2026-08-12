/* validate-dna-resolver.mjs — Musical DNA extractor checks for RESOLVER engines
 * (P8, Phase 2). Required by docs/architecture/p8-dna-extractors-plan.md's own
 * "Definition of done" but not built when Phase 2 shipped (main 1cfc636) —
 * this closes that gap, same coverage discipline as validate-dna.mjs: every
 * resolver character x palette x overlay-state, every field-mapping decision
 * from the plan's field table encoded as an assertion (direct fields present,
 * absent fields null with provenance:'n/a' and never invented), determinism,
 * and the shared consumer contract held identical to the atom-path producer. */
import { buildResolverDNA } from './core/dna-resolver.js';
import { DNA_CONSUMERS } from './core/dna.js';
import { build, resolveArrangement } from './core/resolver.js';
import { resolveOverlays, OVERLAYS } from './core/overlays.js';
import { MASTERING } from './core/constants.js';
import { DELERIUM } from './engines/delerium.js';
import { ERA } from './engines/era.js';
import { DEEPFOREST } from './engines/deepforest.js';
import { SACREDSPIRIT } from './engines/sacredspirit.js';

let fail = 0;
const bad = (m) => { if (fail < 40) console.log('  FAIL:', m); fail++; };

const ENGINES = [
  { id: 'Delerium', module: DELERIUM },
  { id: 'Era', module: ERA },
  { id: 'Deep Forest', module: DEEPFOREST },
  { id: 'Sacred Spirit', module: SACREDSPIRIT },
];

const REQUIRED = ['meta','identity','influences','harmony','arrangement','tempo','dynamics','production','vocal','affect','provenance','consumers','render'];

const oneOf = (kind) => Object.keys(OVERLAYS[kind] || {})[0];
// null = no overlay; otherwise a {composer|producer|remixer: id} selection, one of each kind.
const OVERLAY_SELECTIONS = [
  null,
  { composer: oneOf('composer') },
  { producer: oneOf('producer') },
  { remixer: oneOf('remixer') },
];

let count = 0;
let charCount = 0;

for (const { id: engineId, module: engine } of ENGINES) {
  const charIds = Object.keys(engine.characters);
  for (const characterId of charIds) {
    charCount++;
    const c = engine.characters[characterId];
    for (const palette of ['electronic', 'acoustic']) {
      for (const sel of OVERLAY_SELECTIONS) {
        for (const seed of [11, 909]) {
          count++;
          const tag = `${engineId}/${characterId}/${palette}/${sel ? Object.keys(sel)[0] : 'bare'}`;

          const overlay = resolveOverlays(sel || {}, { beatless: !!c.beatless, banTags: [] });
          let out, dna;
          try {
            out = build(engine, { characterId, palette, locks: {}, seed, overlay });
            dna = buildResolverDNA(out.arrangement, overlay, { characterId, seed, palette });
          } catch (e) { bad(`${tag} threw: ${e.message}`); continue; }

          // ---- required shape --------------------------------------------
          for (const k of REQUIRED) if (!(k in dna)) bad(`${tag} missing field ${k}`);

          // ---- meta --------------------------------------------------------
          if (dna.meta.engineKind !== 'resolver') bad(`${tag} engineKind not 'resolver'`);
          if (dna.meta.seed !== (seed >>> 0)) bad(`${tag} seed not captured`);
          if (dna.meta.palette !== palette) bad(`${tag} palette mismatch`);
          if (dna.meta.characterId !== characterId) bad(`${tag} characterId not captured`);
          if (dna.meta.source !== null) bad(`${tag} meta.source should be null (n/a for resolver)`);

          // ---- identity: DIRECT fields (plan table) -------------------------
          if (!dna.identity.genreAnchor) bad(`${tag} no genre anchor (identity.genreAnchor should be direct from arr.genre)`);
          if (dna.identity.genreAnchor !== out.arrangement.genre) bad(`${tag} genreAnchor doesn't match arr.genre verbatim`);
          if (!dna.identity.subgenre) bad(`${tag} no subgenre`);
          if (dna.identity.subgenre !== c.label) bad(`${tag} subgenre doesn't match character label verbatim`);
          if (dna.identity.genreFamily !== null) bad(`${tag} genreFamily should be null (n/a — resolver has no family/subgenre split)`);

          // ---- harmony: ABSENT, never invented (plan Q1) --------------------
          if (dna.harmony.keyMode !== null) bad(`${tag} harmony.keyMode should be null — no key/mode concept in resolver data`);
          if (dna.provenance.harmony !== 'n/a') bad(`${tag} provenance.harmony should be 'n/a', not 'unknown' or 'derived'`);

          // ---- tempo: DIRECT ------------------------------------------------
          if (!dna.tempo.spec) bad(`${tag} tempo.spec missing`);
          if (c.beatless && dna.tempo.spec !== 'beatless') bad(`${tag} beatless character should report tempo.spec:'beatless'`);
          if (!c.beatless && !/BPM/.test(dna.tempo.spec || '')) bad(`${tag} non-beatless character should report a BPM spec`);

          // ---- dynamics: DIRECT (beatless) + DERIVABLE (arc) ----------------
          if (dna.dynamics.beatless !== !!c.beatless) bad(`${tag} dynamics.beatless doesn't match character`);
          if (dna.dynamics.arc !== null && typeof dna.dynamics.arc !== 'string') bad(`${tag} dynamics.arc should be a string or null, never invented`);
          if (dna.dynamics.arc !== ((out.arrangement.ip && out.arrangement.ip.arc) || null)) bad(`${tag} dynamics.arc doesn't match arr.ip.arc verbatim`);

          // ---- production: TRACED shared constant (plan Q3) -----------------
          if (dna.production.masteringTail !== MASTERING) bad(`${tag} masteringTail doesn't match the shared MASTERING constant`);

          // ---- arrangement[]: LOSSY projection, no invented fields ----------
          if (!Array.isArray(dna.arrangement) || !dna.arrangement.length) bad(`${tag} empty arrangement`);
          for (const v of dna.arrangement) {
            if (!v.role) bad(`${tag} arrangement entry missing role`);
            if (!v.voice) bad(`${tag} arrangement entry missing voice text`);
            if (v.voice !== out.arrangement[v.role]) bad(`${tag} arrangement[${v.role}].voice doesn't match arr.${v.role} verbatim`);
            if (v.origin !== 'engine') bad(`${tag} arrangement[${v.role}].origin should be 'engine' (resolver has no per-voice origin tagging — known limitation)`);
            if (v.bedId !== null || v.behaviour !== null) bad(`${tag} arrangement[${v.role}] invented bedId/behaviour — plan says these don't exist for resolver`);
            if (v.signature !== false) bad(`${tag} arrangement[${v.role}] invented a signature flag`);
            if (v.family !== null || v.fn !== null || v.register !== null || v.prominence !== null || v.priority !== null) {
              bad(`${tag} arrangement[${v.role}] invented a field the resolver model doesn't have`);
            }
          }
          // every populated role on arr should have a corresponding entry, and vice versa
          const arrRoles = ['pads','harmony','bass','drums','voice','lead','color','movement'].filter(r => out.arrangement[r]);
          const dnaRoles = dna.arrangement.map(v => v.role);
          if (arrRoles.length !== dnaRoles.length || arrRoles.some(r => !dnaRoles.includes(r))) {
            bad(`${tag} arrangement role set doesn't match populated arr roles (arr:${arrRoles.join(',')} dna:${dnaRoles.join(',')})`);
          }

          // ---- vocal / affect: same as atom path, CIL fills later -----------
          if (dna.vocal.mode !== 'instrumental') bad(`${tag} vocal.mode default not instrumental`);
          if (dna.provenance.vocal !== 'unknown') bad(`${tag} provenance.vocal should be 'unknown'`);
          if (dna.affect.mood !== null || dna.affect.emotionalAtmosphere !== null) bad(`${tag} affect fields should be null pre-CIL`);
          if (dna.provenance.affect !== 'unknown') bad(`${tag} provenance.affect should be 'unknown'`);

          // ---- consumer contract: IDENTICAL to the atom-path producer -------
          if (JSON.stringify(dna.consumers) !== JSON.stringify(DNA_CONSUMERS)) bad(`${tag} consumers contract diverges from core/dna.js's DNA_CONSUMERS`);
          if (DNA_CONSUMERS.affect.includes('style')) bad(`${tag} affect readable by style — contract breach (shared contract, checked once per run is enough, but cheap to assert per-loop)`);

          // ---- influences[]: observed actual behaviour, not idealised -------
          if (sel) {
            const kind = Object.keys(sel)[0];
            const id = sel[kind];
            if (dna.influences.length !== 1) bad(`${tag} expected exactly 1 influence, got ${dna.influences.length}`);
            else {
              const inf = dna.influences[0];
              if (inf.kind !== kind || inf.key !== id) bad(`${tag} influence kind/key mismatch`);
              if (inf.renderPolicy !== 'never') bad(`${tag} influence renderPolicy should be 'never'`);
              if (inf.nameClass !== 'person') bad(`${tag} influence nameClass should be 'person'`);
              // NOTE: buildResolverDNA marks every named overlay applied:true
              // unconditionally — it does not check whether the overlay's tags
              // were banned or whether any role actually landed (unlike the
              // atom path, which checks fresh.overlayNote for a real refusal).
              // Asserting the OBSERVED behaviour, not a stricter ideal.
              if (inf.applied !== true) bad(`${tag} influence.applied should be true (resolver DNA does not currently detect refusal)`);
            }
            if (dna.provenance.influences !== 'derived') bad(`${tag} provenance.influences should be 'derived' when an overlay is selected`);
          } else {
            if (dna.influences.length) bad(`${tag} spurious influence on a bare (no-overlay) build`);
            if (dna.provenance.influences !== 'n/a') bad(`${tag} provenance.influences should be 'n/a' with no overlay selected`);
          }

          // ---- explicit n/a fields (documented, not just absent) ------------
          if (dna.render !== null) bad(`${tag} render should be null — caller already has the rendered style, not duplicated in DNA`);
          if (dna.anchor !== null) bad(`${tag} anchor should be null — resolver engines don't support anchor identities`);

          // ---- determinism ---------------------------------------------------
          const overlay2 = resolveOverlays(sel || {}, { beatless: !!c.beatless, banTags: [] });
          const out2 = build(engine, { characterId, palette, locks: {}, seed, overlay: overlay2 });
          const dna2 = buildResolverDNA(out2.arrangement, overlay2, { characterId, seed, palette });
          if (JSON.stringify(dna2) !== JSON.stringify(dna)) bad(`${tag} DNA non-deterministic for identical inputs`);
        }
      }
    }
  }
}

console.log(fail
  ? `\nvalidate-dna-resolver: ${fail} failure(s) across ${count} emissions (${charCount} characters across ${ENGINES.length} engines).`
  : `validate-dna-resolver: ${count} emissions across ${charCount} characters (${ENGINES.map(e => e.id).join('/')}) x 2 palettes x 4 overlay-states x 2 seeds — schema, field-mapping fidelity, consumer contract, determinism all clean.`);
process.exit(fail ? 1 : 0);

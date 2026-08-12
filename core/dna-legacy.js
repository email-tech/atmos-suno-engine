/* ==========================================================================
 * dna-legacy.js — Musical DNA extractor for LEGACY engines (P8, Phase 3).
 *
 * Third producer of the same MusicalDNA shape core/dna.js's buildMusicalDNA()
 * (atom path) and core/dna-resolver.js's buildResolverDNA() (resolver path)
 * produce. Sourced from legacy/prompt-style-builder.js's `arrangement` object
 * — the resolved-picks projection added as the Q1 prerequisite (2026-08-12,
 * John's go-ahead) to buildClusterPrompt()/buildStylePromptWithArrangement().
 * Every downstream consumer (CIL, Lyric, Metatag) reads one shape regardless
 * of which of the three engine kinds produced it — DNA_CONSUMERS and the
 * rest of the contract from core/dna.js are reused untouched.
 *
 * SCOPING (docs/architecture/p8-dna-extractors-plan-legacy.md). Q1 (the
 * prerequisite) shipped 2026-08-12. Q2–Q4 resolved by John ("proceed"):
 *
 *   Q2 (classic-path scope): SHIP BOTH sub-paths, not cluster-only. The code
 *      cost was small once Q1 landed — the classic slot picks were already
 *      sitting on state.style before buildClassicStyle() ever runs, so no
 *      further prerequisite was needed for that half.
 *   Q3 (tempo.spec extraction): parse a clean "{lo}-{hi} BPM" out of the
 *      already-resolved `arrangement.tempo` clause (every non-beatless
 *      cluster/phase in both engines' data was checked and matches this
 *      pattern — see the plan doc's verification), falling back to the raw
 *      clause text ONLY on the (currently unreached) case a future phase
 *      string doesn't match. Never invents a number that isn't in the text.
 *   Q4 (Enigma preset vs. cluster labelling): identity.subgenre reports the
 *      PRESET the user actually picked (arrangement.presetLabel) when the
 *      build was preset-driven, not the cluster id underneath it — because
 *      preset labels and their target cluster's own `label` field are NOT
 *      always identical text (e.g. preset "Carmina choral (Screen)" maps to
 *      cluster label "Carmina choral (Screen Behind the Mirror)" — checked,
 *      not assumed). Falls back to the cluster's own label when not preset-
 *      driven (Balearic), and to the classic-path preset text otherwise.
 *
 * Both sub-paths share: no key/mode concept (harmony pool entries are chord
 * *descriptions*, same finding as the resolver plan — keyMode:null,
 * provenance:'n/a'); no per-voice bedId/behaviour/signature/prominence
 * (same lossy-projection limitation as resolver); the exact same overlay
 * resolution call as resolver (resolveInfluencesFromNames(), imported from
 * core/dna-resolver.js rather than duplicated — one source of truth).
 *
 * Sub-path-specific absences, reported honestly as provenance:'n/a' rather
 * than invented: the CLASSIC path has no beatless concept and no interplay/
 * arc mechanism anywhere in its data (confirmed in the plan doc's read of
 * legacy/prompt-style-builder.js — wantInterplay/drawInterplay are cluster-
 * path-only code).
 * ========================================================================*/

import { DNA_VERSION, DNA_CONSUMERS } from './dna.js';
import { resolveInfluencesFromNames } from './dna-resolver.js';
import { MASTERING } from './constants.js';

const CLUSTER_ROLE_ORDER = ['pads', 'harmony', 'bass', 'strings', 'texture', 'motif', 'counter', 'movement', 'rhythm', 'perc', 'color'];
const CLASSIC_ROLE_ORDER = ['pad', 'harmony', 'bass', 'rhythm', 'percussion', 'motif', 'movement'];

// Q3: extract a clean "{lo}-{hi} BPM" from the already-resolved tempo clause.
// Checked against every phase string in both engines' live data before
// shipping (docs/architecture/p8-dna-extractors-plan-legacy.md) — all match.
// Never invents a number: if a future phase string doesn't match, the raw
// clause is reported as-is rather than a guessed range.
function parseTempoSpec(tempoClause) {
  if (!tempoClause) return { spec: null, parsed: false };
  if (/^beatless\b/i.test(tempoClause)) return { spec: 'beatless', parsed: true };
  const m = tempoClause.match(/(\d+)\s*-\s*(\d+)\s*BPM/i);
  if (m) return { spec: `${m[1]}-${m[2]} BPM`, parsed: true };
  // honest fallback — not currently reachable against shipped data, kept
  // for whenever a new phase string is authored that doesn't fit the pattern
  return { spec: tempoClause, parsed: false };
}

/**
 * buildLegacyDNA(built, opts)
 *  - built: the { style, arrangement } object buildStylePromptWithArrangement()
 *    already produced (NOT re-resolved here — pure projection, same
 *    discipline as buildResolverDNA() never re-resolving resolveArrangement()'s
 *    work).
 *  - opts: { seed, palette, overlay, vocalMode }
 *      overlay:   the resolved {roles, roleFamily, negative, names} object —
 *                 state.style.ov, the exact same shape/source resolveOverlays()
 *                 gives the resolver path. Pass null/undefined when none.
 *      vocalMode: the effective vocalMode string ('Instrumental'|'Persona'|
 *                 'Descriptor') the caller already has on state.style —
 *                 legacy tracks this explicitly, richer than the other two
 *                 paths where CIL has to infer it from scratch. Optional;
 *                 provenance drops to 'unknown' (CIL asks) if omitted.
 * Returns a MusicalDNA object in the exact shape core/dna.js produces.
 */
export function buildLegacyDNA(built, opts) {
  const o = opts || {};
  const arr = (built && built.arrangement) || {};
  const overlay = o.overlay || null;
  const isCluster = arr.subPath === 'cluster';

  const roleOrder = isCluster ? CLUSTER_ROLE_ORDER : CLASSIC_ROLE_ORDER;
  const arrangementProjection = roleOrder
    .filter(role => arr[role])
    .map(role => ({
      role,
      family: null, fn: null,
      voice: arr[role],
      register: null, prominence: null, priority: null,
      signature: false,
      origin: 'engine',
      bedId: null, behaviour: null,
    }));

  const influences = resolveInfluencesFromNames(overlay && overlay.names);

  const { spec: tempoSpec } = parseTempoSpec(arr.tempo);

  // Q4: preset label wins when the build was preset-driven (Enigma); else
  // the cluster's own label (Balearic direct cluster pick). Classic path has
  // no preset/cluster/character concept in its data at all — toLegacyState's
  // classicManual branch explicitly sets preset:'' — so subgenre is honestly
  // null there, not derived from anything.
  const subgenre = isCluster ? (arr.presetLabel || arr.label || arr.cluster || null) : null;

  return {
    meta: {
      dnaVersion: DNA_VERSION,
      engineKind: 'legacy',
      source: null,
      characterId: isCluster ? (arr.cluster || null) : null,
      label: subgenre,
      palette: o.palette || arr.palette || null,
      seed: o.seed != null ? (o.seed >>> 0) : null,
    },
    identity: {
      genreFamily: null,                 // n/a — same as resolver, genreAnchor carries the full identity
      subgenre,
      genreAnchor: arr.genre || null,
    },
    influences,
    // no key/mode concept in either legacy sub-path's data — same finding as
    // the resolver plan (harmony pool entries are chord DESCRIPTIONS, never
    // a literal key).
    harmony: { keyMode: null },
    arrangement: arrangementProjection,
    tempo: { spec: tempoSpec, tempoLock: false }, // legacy has no tempoLock concept at all, unlike resolver's c.tempoLock
    dynamics: {
      arc: isCluster ? ((arr.ip && arr.ip.arc) || null) : null,
      beatless: isCluster ? !!arr.beatless : null,  // classic path: no beatless concept exists — null, not false
    },
    production: { masteringTail: MASTERING, characteristics: [] },
    vocal: {
      mode: o.vocalMode === 'Instrumental' ? 'instrumental' : (o.vocalMode ? 'vocal' : 'instrumental'),
      characteristics: null,
      performanceStyle: o.vocalMode || null,
    },
    affect: { mood: null, emotionalAtmosphere: null },
    provenance: {
      identity: 'derived',
      influences: influences.length ? 'derived' : 'n/a',
      harmony: 'n/a',
      arrangement: 'derived',
      tempo: 'derived',   // still 'derived' even on the raw-fallback branch — it's real sourced text, just less cleanly parsed
      dynamics: isCluster ? 'derived' : 'n/a',
      production: 'derived',
      vocal: o.vocalMode ? 'derived' : 'unknown',
      affect: 'unknown',
    },
    consumers: DNA_CONSUMERS,
    render: null,
    anchor: null,   // legacy engines don't support the atom-path anchor-identity system
  };
}

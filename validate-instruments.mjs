/* ==========================================================================
 * validate-instruments.mjs — STEP 1 OF THE BALEARIC RELIABILITY PASS.
 *
 * The project rule from core/knowledge.js applies here: prose is not retention,
 * memory is not retention, a failing test is retention. The audit measured that
 * 50.0% of all builds carried a §7-excluded instrument. Nothing stops that
 * coming back except a check that fails the build when it does.
 *
 * CHECKS
 *  1. CLOSED WORLD    — every string in every pool is graded in core/instruments.js.
 *  2. ZERO REACH      — no expert-tier name survives into an automatic build.
 *  3. NO LEAD DEMOTION— no background-only name is handed a lead-carrying role.
 *  4. NO EMPTY ROLE   — every cluster x palette has a non-empty eligible pool for
 *                       every role the arrangement actually depends on.
 *  5. LIVE MEASURE    — full sweep of real builds; asserts the §7 exclusion rate
 *                       is 0% and reports the before/after for the record.
 *  6. NO FALSE BEATLESS — "no drums" appears only on a beatless character (Bug A).
 * ========================================================================*/
import { ATOM_POOLS_BALEARIC } from './engines/atom-pools.js';
import { ATOM_POOL_CHARACTERS, atomCharacterForPalette } from './engines/atom-characters.js';
import { buildAtoms } from './core/atoms.js';
import { INSTRUMENT_CLASS, eligible, tierOf, isBackgroundOnly, LEAD_ROLES, expertOnlyNames } from './core/instruments.js';

let fail = 0;
const ok = (cond, msg) => { if (!cond) { console.error('FAIL: ' + msg); fail++; } };

const PALETTES = ['electronic', 'acoustic'];
const ROLES = ['bass', 'rhythm', 'perc', 'pads', 'strings', 'texture', 'motif', 'counter', 'color'];

// ---- 1. CLOSED WORLD -----------------------------------------------------
const unclassified = new Set();
for (const cluster of Object.values(ATOM_POOLS_BALEARIC))
  for (const pal of PALETTES)
    for (const role of ROLES)
      for (const name of (cluster[pal] || {})[role] || [])
        if (!(name in INSTRUMENT_CLASS)) unclassified.add(name);
ok(unclassified.size === 0,
   `unclassified pool names (add them to core/instruments.js): ${[...unclassified].join(', ')}`);

// ---- 2 + 3. THE ELIGIBLE SET IS CLEAN ------------------------------------
for (const [id, cluster] of Object.entries(ATOM_POOLS_BALEARIC))
  for (const pal of PALETTES)
    for (const role of ROLES) {
      for (const name of eligible((cluster[pal] || {})[role], role)) {
        ok(tierOf(name) !== 'expert', `${id}/${pal}/${role}: expert-tier "${name}" reached the eligible set`);
        if (LEAD_ROLES.has(role))
          ok(!isBackgroundOnly(name), `${id}/${pal}/${role}: background-only "${name}" was given a lead role`);
      }
    }

// ---- 4. NO ROLE THE ARRANGEMENT DEPENDS ON IS EMPTY ----------------------
// `strings` is deliberately absent from this list: its content was wholly
// orchestral and it has no non-orchestral replacement, so it is now allowed to
// be empty. Everything below is load-bearing — an empty pool here is the class
// of defect that produced Bug A.
const REQUIRED = ['bass', 'pads', 'motif'];
for (const [id, cluster] of Object.entries(ATOM_POOLS_BALEARIC))
  for (const pal of PALETTES) {
    const src = cluster[pal] || {};
    for (const role of REQUIRED)
      ok(eligible(src[role], role).length > 0, `${id}/${pal}: required role "${role}" has an empty eligible pool`);
    // rhythm and perc are load-bearing only where the character has a pulse at
    // all; a beatless character legitimately carries neither.
    if (!cluster.beatless) {
      ok(eligible(src.rhythm, 'rhythm').length > 0, `${id}/${pal}: non-beatless cluster has no eligible drum kit`);
      ok(eligible(src.perc, 'perc').length > 0, `${id}/${pal}: non-beatless cluster has no eligible percussion`);
    }
  }

// ---- 5 + 6. LIVE SWEEP ---------------------------------------------------
// `string ensemble` is deliberately ABSENT from this list: John restored it to
// automatic on 2026-08-14 after reading the step-1 output. It now sits in the
// acoustic PAD pools rather than the permanent `strings` support slot, so it
// competes for one bed instead of firing on 95.8% of builds.
// The FREE-REED FAMILY (accordion, harmonium, melodica) and mandolin are present
// because John removed them by direction in the same review — accordion first,
// then "any piercing instrument that sounds like an accordion", which is the
// free-reed class. Recorded here so a later session cannot mistake the policy
// for an inconsistency in the orchestral rules and quietly reverse it.
const EXCLUDED_RE = /\b(cello|viola|violin|bowed (double bass|string pad|metallophone)|french horn|muted trumpet|flugelhorn|trombone|synth brass|cor anglais|saxophone|pan flute|flute|ney|duduk|harp|pipe organ|glass harmonica|tubular bells|accordion|harmonium|melodica|mandolin)\b/i;
const SEEDS = 200;
let builds = 0, excluded = 0, falseBeatless = 0;
const offenders = new Map();

for (const [id, base] of Object.entries(ATOM_POOL_CHARACTERS))
  for (const pal of PALETTES) {
    const char = atomCharacterForPalette(base, pal);
    for (let seed = 1; seed <= SEEDS; seed++) {
      const { style } = buildAtoms(char, { seed });
      builds++;
      const hit = style.match(EXCLUDED_RE);
      if (hit) { excluded++; offenders.set(hit[0].toLowerCase(), `${id}/${pal}`); }
      if (/no drums/.test(style) && !base.beatless) falseBeatless++;
    }
  }

ok(excluded === 0,
   `${excluded}/${builds} builds still name a §7-excluded instrument` +
   (offenders.size ? ` — e.g. ${[...offenders].slice(0, 5).map(([n, w]) => `"${n}" in ${w}`).join(', ')}` : ''));
ok(falseBeatless === 0, `${falseBeatless}/${builds} non-beatless builds still claim "no drums" (Bug A)`);

// ---- 7. NO DEGENERATE ROLE ----------------------------------------------
// A role whose eligible pool holds exactly one name is not a choice, it is a
// constant: that instrument appears on 100% of that cluster's builds and the
// variation engine has nothing to vary. Removing a family collapses pools
// quietly, so this is measured rather than eyeballed.
//
// WARNING, NOT A FAILURE, and deliberately so. Every case this currently reports
// PRE-DATES the 2026-08-14 reliability work — they are original pool-authoring
// gaps (sunlit-mediterranean/electronic has always had exactly one texture
// option, ambient/electronic exactly one bass). Failing the build on inherited
// debt would either block unrelated work or invite someone to weaken the check.
// It is reported every run so it cannot be forgotten, and it is on file as the
// deepening task. Promote to a hard failure once that task is done.
const degenerate = [];
for (const [id, cluster] of Object.entries(ATOM_POOLS_BALEARIC))
  for (const pal of PALETTES)
    for (const role of ['bass', 'pads', 'motif', 'counter', 'texture']) {
      const set = eligible((cluster[pal] || {})[role], role);
      if (set.length === 1) degenerate.push(`${id}/${pal}/${role} = "${set[0]}"`);
    }

if (degenerate.length) {
  console.warn(`Instruments WARNING: ${degenerate.length} single-option roles (pre-existing pool depth gaps, not failures):`);
  degenerate.forEach(d => console.warn(`  - ${d}`));
}

if (!fail) {
  const parked = expertOnlyNames().length;
  console.log(`Instruments: ${Object.keys(INSTRUMENT_CLASS).length} graded, ${parked} parked expert-only (retained in data, zero automatic probability).`);
  console.log(`Instruments: §7-excluded content in 0/${builds} builds (was 50.0% at HEAD 36d1634); no background-only instrument holds a lead; no required role empty; no false beatless claim.`);
}
process.exit(fail ? 1 : 0);

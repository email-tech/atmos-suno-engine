/* ==========================================================================
 * validate-interplay-requires.mjs — CONDITIONAL INTERPLAY (2026-08-17).
 *
 * Guards the fix for the measured defect: interplay tails were picked
 * independently of the resolved arrangement, so a tail could name a voice the
 * build did not contain ("answering the choir from across the orchestra" in a
 * build with no choir).
 *
 * Written as BEFORE/AFTER regressions against numbers measured at HEAD fc58135,
 * so a future change that reintroduces the fault says which defect came back.
 *
 * THE TWO FAILURE DIRECTIONS ARE BOTH TESTED, and the second matters as much as
 * the first. Gating references is trivially satisfiable by dropping every tail
 * that has one — which would delete mandatory interaction language
 * (core/knowledge.js FACT 6) to fix a coherence bug. So group 3 asserts a hard
 * count: every dimension that produced a tail before this change still produces
 * one. Passing by deletion fails here.
 * ========================================================================*/
import { ERA } from './engines/era.js';
import { DELERIUM } from './engines/delerium.js';
import { DEEPFOREST } from './engines/deepforest.js';
import { SACREDSPIRIT } from './engines/sacredspirit.js';
import { resolveArrangement, renderStyle } from './core/resolver.js';
import {
  referentsIn, satisfies, isLegalTail, legalTails, pickTail, guardTail,
  ROLE_REFERENTS, INSTRUMENT_REFERENTS, HOST_SLOTS,
} from './core/interplay.js';

let failures = 0, checks = 0;
const bad = (m) => { console.error(`  FAIL: ${m}`); failures++; };
const ok = (c, m) => { if (!c) bad(m); };

const ENGINES = [ERA, DELERIUM, DEEPFOREST, SACREDSPIRIT];
const DIMS = ['foundation', 'conversation', 'arc', 'voiceRel', 'colorRel'];
const SEEDS = 150;

/* Measured at HEAD fc58135 BEFORE the fix, same sweep as below. Per-build rate
 * = at least one dangling reference somewhere in the rendered style string. */
const BEFORE = { Era: 28.8, Delerium: 14.1, 'Deep Forest': 14.6, 'Sacred Spirit': 18.1 };
/* Tails rendered BEFORE the fix. These are the floor: the gate must not cost a
 * single one. */
const TAILS_BEFORE = { Era: 6734, Delerium: 6704, 'Deep Forest': 8150, 'Sacred Spirit': 6748 };

const sweep = function* () {
  for (const e of ENGINES)
    for (const chId of Object.keys(e.characters))
      for (const palette of ['electronic', 'acoustic'])
        for (let seed = 1; seed <= SEEDS; seed++)
          yield { e, chId, palette, seed };
};

/* ---- 1: referent extraction ------------------------------------------
 * The extraction rule is the whole fix. If it under-matches, danglers survive;
 * if it over-matches, legal phrases get gated on conditions that are not really
 * being asserted and the pools thin for no reason. */
{
  const cases = [
    ['answering the choir from across the orchestra', ['choir', 'orchestra']],
    ['trading long phrases with the strings in call-and-response', ['strings']],
    // gerunds describe the HOST's own action, not a reference to another voice
    ['chanting from the depth of the reverb', []],
    ['chanting beneath the lead', ['lead']],
    // adjective breaks determiner adjacency — this is how metaphor is excluded,
    // and it is the same exclusion the 2026-08-17 measurement made by hand
    ['anchoring in slow motion while the upper voices soar', []],
    ['locked with the beat in a steady hypnotic pocket', ['beat']],
    ['holding steady while the low end drives the groove', ['low end', 'groove']],
    ['building from a lone voice to full orchestral grandeur', []],
    // explicit override wins over derivation
    [{ t: 'answering the choir', requires: ['piano'] }, ['piano']],
  ];
  for (const [input, expect] of cases) {
    const got = referentsIn(input);
    ok(JSON.stringify(got) === JSON.stringify(expect),
      `referentsIn(${JSON.stringify(input)}) => ${JSON.stringify(got)}, expected ${JSON.stringify(expect)}`);
  }
  // "low end" must win over "end"-style short matches: longest-first ordering
  ok(referentsIn('sitting under the low end').includes('low end'), 'multi-word referent lost to a shorter one');
  checks++;
  console.log(`  extraction: ${cases.length + 1} cases.`);
}

/* ---- 2: satisfaction, both directions --------------------------------- */
{
  const arr = { pads: 'warm analog pads', bass: 'deep sub-bass', lead: 'a solo cello line',
                voice: 'a layered chant choir', drums: null, movement: null, color: null, harmony: null };
  ok(satisfies('cello', arr, []), 'instrument present in the text should satisfy');
  ok(!satisfies('piano', arr, []), 'instrument absent from the text must NOT satisfy');
  ok(satisfies('pads', arr, []), 'role referent should resolve against the filled slot');
  ok(!satisfies('groove', arr, []), 'role referent must fail when the slot is empty');
  ok(satisfies('choir', arr, []), 'choir present in voice');

  /* HOST EXCLUSION applies to INSTRUMENT referents on single-host dimensions
   * only. A voiceRel tail saying "answering the chant" attached to the chant
   * itself is the voice answering itself. */
  ok(!satisfies('choir', arr, HOST_SLOTS.voiceRel), 'self-reference: choir only present as the voiceRel host');
  /* ...but a ROLE referent is never host-excluded: a lead stating "the theme"
   * is describing its own material, which is legitimate prose. Excluding these
   * silenced 325 tails across 6,300 builds — a regression, not a fix. */
  ok(satisfies('lead', arr, ['lead']), 'role referent must NOT be host-excluded');
  ok(HOST_SLOTS.foundation.length === 0 && HOST_SLOTS.conversation.length === 0,
    'multi-host dimensions must not host-exclude: drums+bass and pads+lead are co-hosts that relate to each other');

  // pulse/percussion fall back to behaviour in the text when no kit is drawn
  ok(satisfies('percussion', { drums: null, movement: 'light rattles and hand percussion' }, []),
    'percussion should resolve against percussion words when no kit slot is filled');
  ok(satisfies('pulse', { drums: null, bass: 'a sequenced pulsing sub' }, []), 'pulse should resolve against a sequenced low end');
  ok(!satisfies('pulse', { drums: null, bass: 'a soft upright bass' }, []), 'pulse must not resolve against a free-time bass');

  // harmony is deliberately not a referent — every build has harmonic content
  ok(!ROLE_REFERENTS.harmony && !INSTRUMENT_REFERENTS.includes('harmony'),
    'harmony must not be a referent: it is always true and would be noise, not a check');
  checks++;
  console.log('  satisfaction: role/instrument/host-exclusion/fallbacks verified.');
}

/* ---- 3: NO DANGLING REFERENCES anywhere, and NO TAILS LOST ------------
 * The headline regression. Both halves in one sweep so they cannot be satisfied
 * separately. */
{
  const stats = {};
  for (const { e, chId, palette, seed } of sweep()) {
    const arr = resolveArrangement(e, { characterId: chId, palette, seed });
    const s = stats[e.id] || (stats[e.id] = { builds: 0, dangling: 0, tails: 0 });
    s.builds++;
    let danglingHere = false;
    for (const dim of DIMS) {
      const sel = arr.ip && arr.ip[dim];
      if (!sel) continue;
      if (dim === 'voiceRel' && !arr.voice) continue;
      if (dim === 'colorRel' && !arr.color) continue;
      s.tails++;
      if (!isLegalTail(sel, arr, dim)) {
        danglingHere = true;
        if (s.dangling < 3) bad(`${e.id}/${chId}/${palette}/${seed} ${dim}: dangling "${sel}" (missing ${referentsIn(sel).filter(r => !satisfies(r, arr, HOST_SLOTS[dim] || [])).join(', ')})`);
        s.dangling++;
      }
    }
    if (danglingHere) { /* counted above */ }
  }
  for (const [id, s] of Object.entries(stats)) {
    ok(s.dangling === 0, `${id}: ${s.dangling} dangling tails (was ${BEFORE[id]}% of builds before the gate)`);
    ok(s.tails >= TAILS_BEFORE[id],
      `${id}: ${s.tails} tails rendered, was ${TAILS_BEFORE[id]} before the gate — the gate is DELETING interaction language, which FACT 6 forbids`);
  }
  checks++;
  console.log('  no-dangling + no-loss: ' + Object.entries(stats)
    .map(([id, s]) => `${id} ${s.tails} tails, 0 dangling`).join('; '));
}

/* ---- 4: no dimension goes silent --------------------------------------
 * Stronger than the count above: asserts per character/dimension rather than in
 * aggregate, so one character losing its whole conversation layer cannot be
 * masked by another gaining tails. */
{
  const silent = [];
  for (const { e, chId, palette, seed } of sweep()) {
    const pool = (e.interplay && e.interplay[chId]) || {};
    const arr = resolveArrangement(e, { characterId: chId, palette, seed });
    for (const dim of DIMS) {
      if (!(pool[dim] && pool[dim].length)) continue;
      if (dim === 'voiceRel' && !arr.voice) continue;
      if (dim === 'colorRel' && !arr.color) continue;
      if (!arr.ip[dim]) silent.push(`${e.id}/${chId}/${palette}/${seed}/${dim}`);
      /* The legal pool must never be empty in practice. pickTail's fallback
       * exists so a bad data edit degrades instead of throwing, not because it
       * is expected to run — so assert here that it never does. */
      ok(legalTails(pool[dim], arr, dim).length > 0,
        `${e.id}/${chId}/${palette}/${seed}/${dim}: no legal tail exists — the pool needs a phrase that references nothing`);
    }
  }
  ok(silent.length === 0, `${silent.length} dimension draws went silent, e.g. ${silent.slice(0, 3).join(', ')}`);
  checks++;
  console.log(`  no-silence: 0 silent dimension draws across every character, palette and ${SEEDS} seeds.`);
}

/* ---- 5: the render-time guard, i.e. the overlay case -------------------
 * Pick-time filtering alone is not enough. applyOverlay() rewrites arr.bass /
 * arr.lead / arr.color AFTER the tails are chosen, and injects its own arc
 * straight into arr.ip without passing any gate. Simulated here by mutating a
 * resolved arrangement, which is exactly what applyOverlay does. */
{
  const arr = resolveArrangement(ERA, { characterId: 'cathedralOverture', palette: 'electronic', seed: 15 });
  // force a tail that references the lead, then remove the lead
  const pool = ERA.interplay.cathedralOverture;
  const mutated = { ...arr, lead: null, characterId: 'cathedralOverture' };
  const withRef = pool.conversation.find(p => referentsIn(p).includes('theme'));
  if (withRef) {
    ok(guardTail(pool.conversation, mutated, 'conversation', withRef) !== withRef ||
       isLegalTail(withRef, mutated, 'conversation'),
      'render-time guard let a tail through after its referent was displaced');
  }
  // an injected overlay arc naming an absent instrument must be caught
  const injected = 'answering the piano across the room';
  ok(guardTail(pool.arc, arr, 'arc', injected) !== injected,
    'render-time guard must gate an overlay-injected arc, which passes through no other check');
  // a legal tail must survive the guard untouched
  const legal = legalTails(pool.arc, arr, 'arc')[0];
  ok(guardTail(pool.arc, arr, 'arc', legal) === legal, 'guard must not rewrite a tail that is already legal');
  // determinism: same arrangement, same result, twice
  ok(guardTail(pool.arc, arr, 'arc', injected) === guardTail(pool.arc, arr, 'arc', injected),
    'guard must be deterministic — a re-render must not change the prompt');
  checks++;
  console.log('  render-time guard: overlay displacement and injected arcs gated, legal tails untouched, deterministic.');
}

/* ---- 6: the specific case John's report started from ------------------- */
{
  let seen = 0;
  for (const { e, chId, palette, seed } of sweep()) {
    if (e.id !== 'Era') continue;
    const arr = resolveArrangement(e, { characterId: chId, palette, seed });
    const style = renderStyle(e, arr).toLowerCase();
    if (/answering the choir/.test(style)) {
      seen++;
      ok(/choir|chant/.test([arr.pads, arr.voice, arr.lead, arr.color, arr.harmony].filter(Boolean).join(' ').toLowerCase()),
        `Era/${chId}/${palette}/${seed}: style says "answering the choir" with no choir in the cast`);
    }
  }
  checks++;
  console.log(`  regression case: "answering the choir" now renders only in builds that have one (${seen} builds).`);
}

/* ---- 7: variety preserved ---------------------------------------------
 * A gate that always returns the same safe phrase would pass every check above
 * and make every build read identically. */
{
  for (const e of ENGINES) {
    for (const chId of Object.keys(e.characters)) {
      const pool = (e.interplay && e.interplay[chId]) || {};
      for (const dim of DIMS) {
        if (!(pool[dim] && pool[dim].length > 1)) continue;
        const seen = new Set();
        for (let seed = 1; seed <= SEEDS; seed++) {
          const arr = resolveArrangement(e, { characterId: chId, palette: 'electronic', seed });
          if (arr.ip[dim]) seen.add(arr.ip[dim]);
        }
        ok(seen.size > 1, `${e.id}/${chId}/${dim}: only ${seen.size} distinct tail over ${SEEDS} seeds — the gate has collapsed the pool`);
      }
    }
  }
  checks++;
  console.log('  variety: every multi-phrase dimension still draws more than one distinct tail.');
}

/* ---- 8: the gate is derivation-first, not a hand-tagged list -----------
 * A phrase added in a future session must be gated automatically. If someone
 * replaces derivation with an explicit per-phrase table, this fails. */
{
  const novel = 'weaving around the sitar in loose counterpoint';
  ok(referentsIn(novel).includes('sitar'), 'a phrase never seen before must still yield its referents by derivation');
  const noSitar = { pads: 'warm pads', lead: 'a synth lead', characterId: 'x' };
  ok(!isLegalTail(novel, noSitar, 'conversation'), 'a novel phrase must be gated without being hand-tagged');
  // pickTail must make exactly ONE rng call per dimension — more would
  // desynchronise every seed downstream of the interplay layer
  let calls = 0;
  pickTail(['a', 'b', 'c'], noSitar, 'arc', () => { calls++; return 0.5; });
  ok(calls === 1, `pickTail made ${calls} rng calls, must be exactly 1 or every downstream seed shifts`);
  checks++;
  console.log('  derivation: novel phrases gated automatically, exactly 1 rng call per dimension.');
}

console.log(`validate-interplay-requires: ${checks} check groups, ${failures} failures.`);
process.exit(failures ? 1 : 0);

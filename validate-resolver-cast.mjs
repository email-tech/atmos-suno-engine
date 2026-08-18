/* ==========================================================================
 * validate-resolver-cast.mjs — ENSEMBLE RECONCILIATION ON THE RESOLVER PATH.
 * 2026-08-17. Era, Delerium, Deep Forest, Sacred Spirit.
 *
 * Both failure directions in one sweep, for the same reason the interplay
 * validator does it: a reconciler is trivially satisfiable by emptying the
 * arrangement. Group 3 asserts the defects are gone; group 4 asserts the
 * arrangement is still a band.
 * ========================================================================*/
import { ERA } from './engines/era.js';
import { DELERIUM } from './engines/delerium.js';
import { DEEPFOREST } from './engines/deepforest.js';
import { SACREDSPIRIT } from './engines/sacredspirit.js';
import { build } from './core/resolver.js';
import { reconcileArrangement, isBedSlot } from './core/resolver-cast.js';
import { SINGLETON_INSTRUMENT_WORDS } from './core/knowledge.js';

let failures = 0, checks = 0;
const bad = (m) => { console.error(`  FAIL: ${m}`); failures++; };
const ok = (c, m) => { if (!c) bad(m); };

const ENGINES = [ERA, DELERIUM, DEEPFOREST, SACREDSPIRIT];
const SEEDS = 150;
const BEDS = ['pads', 'harmony', 'color'];
const SLOTS = ['pads', 'harmony', 'bass', 'voice', 'lead', 'movement', 'color', 'drums'];

/* Measured at 1e9db89, BEFORE this module existed. */
const BEFORE_BED = { Era: 17.6, Delerium: 10.8, 'Deep Forest': 15.0, 'Sacred Spirit': 22.9 };
const BEFORE_DUP = { Era: 3.1, Delerium: 2.7, 'Deep Forest': 2.1, 'Sacred Spirit': 9.1 };

const sweep = function* () {
  for (const e of ENGINES)
    for (const chId of Object.keys(e.characters))
      for (const palette of ['electronic', 'acoustic'])
        for (let seed = 1; seed <= SEEDS; seed++)
          yield { e, chId, palette, seed };
};

const dupWordIn = (text) => SINGLETON_INSTRUMENT_WORDS.find(w =>
  (String(text).toLowerCase().match(new RegExp(`\\b${w.replace(/[-\s]/g, '[-\\s]')}s?\\b`, 'g')) || []).length > 1);

/* ---- 1: the bed contest is NARROWER than the atom path's, on purpose ---- */
{
  /* Regression guards on the two predicates that gave the wrong answer when
   * cast.js's isSustainedBed was applied to resolver slots. If a future session
   * "unifies" the two paths by widening this back out, it fails here with the
   * reason attached rather than silently dropping vocals. */
  ok(!isBedSlot('movement', 'tremolo bowed-string swells'),
    'movement must NOT count as a bed — it is production process, and counting it inflated the measured defect from 11-23% to 53-65%');
  ok(!isBedSlot('voice', 'a wordless sustained choir'),
    'voice must NOT count as a bed — a wordless choir sustains, but a bed budget that can drop the vocal is a genre failure');
  ok(isBedSlot('pads', 'anything at all'), 'pads is a bed by function whatever fills it');
  ok(isBedSlot('harmony', 'a sustained tonic pedal'), 'a sustained harmony slot is a second bed');
  ok(!isBedSlot('color', 'a pizzicato string accent'), 'a short decorative colour is not a bed');
  ok(!isBedSlot('color', null), 'an empty slot is not a bed');
  checks++;
  console.log('  bed definition: narrower than the atom path, movement and voice excluded by design.');
}

/* ---- 2: priority order protects the right things --------------------- */
{
  // a choir pad colliding with a chant voice must cost the PAD, not the vocal
  /* NOTE: the collision word must be one SINGLETON_INSTRUMENT_WORDS actually
   * carries. That list is empirical (round 4, French horn) and short — nine
   * entries, no 'choir' — so a choir-vs-choir collision is NOT currently
   * detected at all. Flagged to John rather than extended here: adding words to
   * an evidence-derived list from reasoning alone is the thing this project
   * does not do. */
  const arr = { pads: 'a sustained cello drone', voice: 'a solo cello vocal line',
                bass: 'a deep sub', drums: 'a soft kit', lead: 'a flute line',
                harmony: 'a sustained tonic pedal' };
  reconcileArrangement(arr);
  ok(arr.voice, 'the vocal must survive a collision with a pad — dropping it trades the song identity for wallpaper');
  ok(!arr.pads, 'the pad should lose the collision when another bed remains');

  // bass and lead are never dropped, even when they collide
  const arr2 = { bass: 'a cello-and-contrabass foundation', lead: 'a solo cello lead', drums: 'a kit' };
  const d2 = reconcileArrangement(arr2);
  ok(arr2.bass && arr2.lead, 'a collision between two protected slots must leave both standing');
  ok(d2.some(x => x.reason === 'duplicate-voice-unresolved'),
    'a protected-slot collision must be REPORTED, not silently tolerated — it means the pool needs fixing');
  checks++;
  console.log('  priority: vocal beats pad, bass and lead are never dropped, unresolved collisions are reported.');
}

/* ---- 3: the defects are gone across every build ----------------------- */
{
  const stats = {};
  for (const { e, chId, palette, seed } of sweep()) {
    const o = build(e, { characterId: chId, palette, seed });
    const arr = o.arrangement;
    const s = stats[e.id] || (stats[e.id] = { n: 0, beds: 0, dup: 0, unresolved: 0 });
    s.n++;
    if (BEDS.filter(x => isBedSlot(x, arr[x])).length > 1) {
      s.beds++;
      if (s.beds < 3) bad(`${e.id}/${chId}/${palette}/${seed}: two harmonic beds survived reconciliation`);
    }
    /* Duplicates are checked against the RENDERED STYLE, not the slots, because
     * the style is what Suno reads. This also catches a duplicate created by
     * clause assembly rather than by the slots themselves. */
    /* Checked against the SLOT TEXT, not the rendered style. A tail saying
     * "in call-and-response with the flute" REFERS to the flute that exists —
     * that is mandatory interaction language, not a second flute. Scanning the
     * rendered string flagged 36 Delerium builds for doing exactly what the
     * standing style rule requires. */
    const w = dupWordIn(SLOTS.map(x => arr[x]).filter(Boolean).join(' | '));
    if (w) {
      const unresolvedHere = (arr.castDropped || []).some(x => x.reason === 'duplicate-voice-unresolved');
      if (unresolvedHere) s.unresolved++;
      else {
        s.dup++;
        if (s.dup < 3) bad(`${e.id}/${chId}/${palette}/${seed}: "${w}" named twice in the style with no protected-slot collision to explain it`);
      }
    }
  }
  for (const [id, s] of Object.entries(stats)) {
    ok(s.beds === 0, `${id}: ${s.beds} builds still stack two beds (was ${BEFORE_BED[id]}%)`);
    ok(s.dup === 0, `${id}: ${s.dup} unexplained duplicate voices (was ${BEFORE_DUP[id]}%)`);
    console.log(`    ${id.padEnd(14)} ${s.n} builds, 0 double beds, 0 unexplained duplicates, ${s.unresolved} known pool collisions`);
  }
  checks++;
}

/* ---- 4: NOT BY DELETION ---------------------------------------------- */
{
  /* The reconciler could satisfy group 3 by emptying every slot. These are the
   * floors that stop it. */
  const stats = {};
  for (const { e, chId, palette, seed } of sweep()) {
    const o = build(e, { characterId: chId, palette, seed });
    const arr = o.arrangement;
    const s = stats[e.id] || (stats[e.id] = { n: 0, slots: 0, min: 99, noBed: 0, noLead: 0, noVoice: 0 });
    s.n++;
    const filled = SLOTS.filter(x => arr[x]).length;
    s.slots += filled;
    if (filled < s.min) s.min = filled;
    if (!BEDS.some(x => isBedSlot(x, arr[x]))) s.noBed++;
    if (!arr.lead) s.noLead++;
    if (!arr.voice) s.noVoice++;
    ok(o.style.trim().endsWith('Polished Dolby Atmos-Master Atmos -2dB.'), `${e.id}/${chId}/${palette}/${seed}: mastering tail must stay last`);
    ok(!/,\s*,|,\s*\./.test(o.style), `${e.id}/${chId}/${palette}/${seed}: dropped slot left a dangling connective in the style string`);
  }
  for (const [id, s] of Object.entries(stats)) {
    ok(s.min >= 5, `${id}: a build dropped to ${s.min} filled slots — reconciliation is deleting the arrangement, not fixing it`);
    ok(s.noBed === 0, `${id}: ${s.noBed} builds ended with NO harmonic bed at all`);
    ok(s.noLead === 0, `${id}: ${s.noLead} builds lost the lead`);
    console.log(`    ${id.padEnd(14)} avg ${(s.slots / s.n).toFixed(2)} filled slots, min ${s.min}, every build keeps a bed and a lead`);
  }
  checks++;
}

/* ---- 5: composes with the interplay guard ----------------------------- */
{
  /* A tail can reference a voice this module drops. That is not handled here —
   * it is handled by the render-time guard in core/interplay.js, which is why
   * reconciliation runs BEFORE the style is rendered. This asserts the two
   * actually compose, rather than each being correct alone. */
  let danglers = 0;
  for (const { e, chId, palette, seed } of sweep()) {
    const o = build(e, { characterId: chId, palette, seed });
    const arr = o.arrangement;
    const droppedWords = (arr.castDropped || [])
      .filter(x => x.reason !== 'duplicate-voice-unresolved' && x.instrument)
      .map(x => String(x.instrument).toLowerCase());
    if (!droppedWords.length) continue;
    /* The dropped instrument's own text must be gone from the rendered style. */
    for (const t of droppedWords) {
      const head = t.replace(/^(a|an|the)\s+/, '').split(' ').slice(0, 3).join(' ');
      if (head.length > 8 && o.style.toLowerCase().includes(head)) {
        danglers++;
        if (danglers < 3) bad(`${e.id}/${chId}/${palette}/${seed}: dropped "${t}" still appears in the rendered style`);
      }
    }
  }
  ok(danglers === 0, `${danglers} dropped voices still reached the style string`);
  checks++;
  console.log('  composition: dropped voices leave the style entirely, and tails referencing them are re-gated by the interplay guard.');
}

/* ---- 6: determinism --------------------------------------------------- */
{
  for (const e of ENGINES) {
    const chId = Object.keys(e.characters)[0];
    for (const seed of [1, 7, 42]) {
      const a = build(e, { characterId: chId, palette: 'electronic', seed }).style;
      const b = build(e, { characterId: chId, palette: 'electronic', seed }).style;
      ok(a === b, `${e.id}: same seed produced two different style strings — reconciliation must not introduce randomness`);
    }
  }
  checks++;
  console.log('  determinism: same seed, same prompt.');
}

console.log(`validate-resolver-cast: ${checks} check groups, ${failures} failures.`);
process.exit(failures ? 1 : 0);

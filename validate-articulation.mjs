/* ==========================================================================
 * validate-articulation.mjs — JOHN'S TWO MUSICAL RULES, 2026-08-17.
 *   1. Sustaining orchestral instruments play long legato notes. Struck and
 *      plucked ones (harp, mallets, vibraphone, glockenspiel...) keep their
 *      percussive character and are NOT touched by the rule.
 *   2. Anything acting as a pad must be an ensemble or a chord of 3+ notes.
 *
 * Enforced against ENGINE POOL DATA rather than rendered output, because that
 * is where the fault lives: a pool entry that says "brass stab accent" produces
 * a bad prompt on every seed that draws it, and catching it at render time
 * would be catching it 6,300 times instead of once.
 * ========================================================================*/
import { ERA } from './engines/era.js';
import { DELERIUM } from './engines/delerium.js';
import { DEEPFOREST } from './engines/deepforest.js';
import { SACREDSPIRIT } from './engines/sacredspirit.js';
import { articulationFault, padWidthFault, isSustaining, isStruckOrPlucked,
         GENRE_ARTICULATION_EXCEPTIONS, isGenreException } from './core/articulation.js';

let failures = 0, checks = 0;
const bad = (m) => { console.error(`  FAIL: ${m}`); failures++; };
const ok = (c, m) => { if (!c) bad(m); };

/* AWAITING JOHN. Every entry here breaks a rule for a reason that is a musical
 * decision rather than an oversight, so it is listed openly with the reason and
 * the proposed replacement instead of being quietly fixed or quietly ignored.
 * An allowlist that is not printed is a hidden failure; this one is printed
 * every run. */
const AWAITING_JOHN = [
    ['Sacred Spirit/ceremonialPrelude + winterCeremony', 'a sustained bowed-cello drone',
   'RULE 2 single-voice. One cello cannot be a pad, however sustained. Proposed: "a sustained bowed low-string section". Overlaps the separate cello-in-bass-and-lead pool collision already flagged (111 builds), so both are one decision.'],
  ['Delerium/gothicAmbient', 'bowed metallic drone',
   'RULE 2 single-voice as written. May not be orchestral at all — a bowed cymbal or waterphone is a texture, not a pitched pad. Needs John to say which it is before it is either widened or moved out of the pads slot.'],
      ['Era/cathedralOverture + etherealBallad', 'a pizzicato string accent',
   'Plucked strings. John\'s refinement puts plucked technique with the percussive group, which this validator follows — flagged only because pizzicato on a bowed instrument is the boundary case of that refinement.'],
];

const ENGINES = [ERA, DELERIUM, DEEPFOREST, SACREDSPIRIT];
const allow = new Set(AWAITING_JOHN.map(x => x[1].toLowerCase()));
const isAllowed = (t) => [...allow].some(a => String(t).toLowerCase().includes(a) ||
                                              a.includes(String(t).toLowerCase()));

/* ---- 1: the split itself ---------------------------------------------- */
{
  ok(isSustaining('a swelling cathedral pipe organ'), 'an organ can hold a note');
  ok(isSustaining('French horns'), 'brass can hold a note');
  ok(isSustaining('a sweeping orchestral string section'), 'bowed strings can hold a note');
  ok(!isSustaining('a glockenspiel figure'), 'a glockenspiel cannot hold a note — the legato rule must not touch it');
  ok(!isSustaining('a harp glissando'), 'a harp is plucked');
  ok(isStruckOrPlucked('soft mallet vibraphone'), 'mallets are struck');
  ok(isStruckOrPlucked('a pizzicato string accent'), 'pizzicato is plucked, so it keeps its percussive character');
  ok(!isSustaining('grand piano'), 'a piano is struck, whatever its sustain pedal does');
  checks++;
  console.log('  the split: bowed/blown/wind-driven sources are held to the rule, struck and plucked ones are not.');
}

/* ---- 2: no sustaining source carries attack articulation --------------- */
{
  const found = [];
  for (const e of ENGINES)
    for (const [cid, c] of Object.entries(e.characters))
      for (const [slot, pool] of Object.entries(c.pools || {}))
        for (const entry of pool) {
          const t = typeof entry === 'string' ? entry : entry.t;
          /* An approved genre exception is not a failure. It is still PRINTED
           * below with its reason, so an exception can never quietly become
           * invisible — the same discipline the awaiting-John list follows. */
          if (articulationFault(t) === 'contradicts' && !isAllowed(t) && !isGenreException(t)) {
            found.push(`${e.id}/${cid}/${slot}: "${t}"`);
          }
        }
  for (const f of found) bad(`sustaining source with attack articulation — ${f}`);
  ok(found.length === 0, `${found.length} pool entries contradict the legato rule`);
  checks++;
  console.log('  rule 1: no bowed, blown or wind-driven source carries stab, staccato, fanfare or ostinato wording.');
}

/* ---- 3: nothing single-voiced fills the pads slot ---------------------- */
{
  const found = [];
  for (const e of ENGINES)
    for (const [cid, c] of Object.entries(e.characters))
      for (const entry of (c.pools && c.pools.pads) || []) {
        const t = typeof entry === 'string' ? entry : entry.t;
        const fault = padWidthFault(t);
        if (fault && !isAllowed(t)) found.push(`${e.id}/${cid}: "${t}" (${fault})`);
      }
  for (const f of found) bad(`pad is not an ensemble or a 3+ note chord — ${f}`);
  ok(found.length === 0, `${found.length} pad entries are too narrow`);
  checks++;
  console.log('  rule 2: every pads entry can produce three or more simultaneous notes.');
}

/* ---- 4: the unstated cases, reported not enforced ---------------------- */
{
  /* A sustaining source with NO articulation either way is not wrong, it is
   * undecided — and CONVENTION_BLEED says an undecided orchestral instrument
   * gets the orchestral default, which is short. Counted rather than failed,
   * because filling these in is pool authoring on proven engines. */
  let unstated = 0;
  const sample = [];
  for (const e of ENGINES)
    for (const [cid, c] of Object.entries(e.characters))
      for (const [slot, pool] of Object.entries(c.pools || {}))
        for (const entry of pool) {
          const t = typeof entry === 'string' ? entry : entry.t;
          if (articulationFault(t) === 'unstated') { unstated++; if (sample.length < 4) sample.push(`${e.id}/${cid}/${slot}: "${t}"`); }
        }
  console.log(`  unstated articulation: ${unstated} sustaining entries say nothing about how they play${sample.length ? ' — e.g. ' + sample.join('; ') : ''}.`);
  checks++;
}

console.log('  approved genre exceptions (John, 2026-08-18) — the articulation IS the genre:');
for (const e of GENRE_ARTICULATION_EXCEPTIONS)
  console.log(`    ${e.engine}/${e.characters.join('+')} — "${e.text}"\n      ${e.reason}`);
console.log('  awaiting John:');
for (const [where, what, why] of AWAITING_JOHN) console.log(`    ${where} — "${what}"\n      ${why}`);

console.log(`validate-articulation: ${checks} check groups, ${failures} failures.`);
process.exit(failures ? 1 : 0);

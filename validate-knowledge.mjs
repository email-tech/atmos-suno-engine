/* validate-knowledge.mjs — ENFORCES core/knowledge.js AGAINST THE LIVE BUILD.
 *
 * This harness exists because of John's round-4 message: every new chat regresses,
 * the same ground gets re-covered, and lessons do not stick. The cause is that
 * facts lived in reasoning and in prose. Prose does not fail a build.
 *
 * Every check below corresponds to something John established BY TESTING IN SUNO.
 * If a future session quietly reverts one of them, this fails and the commit is
 * blocked. That is the retention mechanism — not memory, not a log entry.
 */
import { buildAtoms } from './core/atoms.js';
import { ATOM_POOL_CHARACTERS, atomCharacterForPalette } from './engines/atom-characters.js';
import { ATOM_MODIFIERS, resolveModifier } from './core/atom-modifiers.js';
import {
  NEGATIVE_CAP, NEGATIVE_RANKS, selectNegatives, BANNED_ARTICULATION_RE,
} from './core/knowledge.js';

let checks = 0, fails = 0;
const bad = (m) => { fails++; console.log('  FAIL: ' + m); };
const ok = (c, m) => { checks++; if (!c) bad(m); };

const CHARS = Object.keys(ATOM_POOL_CHARACTERS);
const MODS = Object.keys(ATOM_MODIFIERS);

/* ---- FACT 1: the negative field loses effectiveness beyond ~5 elements ------
 * John, round 4: "I have had to front load the negative Orchestral prompts as
 * the negative prompt loses effectiveness beyond 5 elements." */
{
  let maxSeen = 0;
  for (const cid of CHARS) {
    for (const pal of ['acoustic', 'electronic']) {
      const ch = atomCharacterForPalette(ATOM_POOL_CHARACTERS[cid], pal);
      const cases = [null, ...MODS.map(m => resolveModifier(m, null, null, pal))];
      for (const def of cases) {
        const out = buildAtoms(ch, { seed: 909, overlayDef: def });
        const n = out.negative.replace(/\.$/, '').split(',').filter(x => x.trim()).length;
        maxSeen = Math.max(maxSeen, n);
        if (n > NEGATIVE_CAP)
          bad(`negative field carries ${n} elements, cap is ${NEGATIVE_CAP}`);
      }
    }
  }
  checks++;
  console.log(`  negatives: max ${maxSeen} elements across all builds (cap ${NEGATIVE_CAP}).`);

  // ranking must put genre-breaking bans ahead of cosmetic ones
  const picked = selectNegatives(['field recordings', 'orchestral drums', 'foley', 'staccato strings']);
  ok(picked[0] === 'orchestral drums' || picked[0] === 'staccato strings',
    'ranking put a cosmetic ban ahead of a genre-breaking one');
  ok(selectNegatives(Object.keys(NEGATIVE_RANKS)).length === NEGATIVE_CAP,
    'selectNegatives does not truncate to the cap');
  ok(selectNegatives(['not a real negative']).length === 0,
    'unknown negatives must not consume a slot');
}

/* ---- FACT 2: ostinato / staccato / stabs / fanfare are banned ---------------
 * John, round 4 A4: "ostinato, stabs and staccatos are an undesirable
 * articulation and performance language for the Balearic engine."
 * Global, not engine-conditional: every engine in this app is non-orchestral
 * and groove-led, so "the Balearic engine" describes the whole app. */
{
  for (const [id, m] of Object.entries(ATOM_MODIFIERS)) {
    for (const group of [...Object.values(m.cores), ...Object.values(m.signatures)]) {
      for (const [k, a] of Object.entries(group.atoms)) {
        const t = a.instrument || a.text || '';
        if (BANNED_ARTICULATION_RE.test(t))
          bad(`${id}/${k}: banned articulation "${t.match(BANNED_ARTICULATION_RE)[0]}" in "${t.slice(0, 44)}"`);
      }
    }
  }
  // and it must never reach a rendered prompt by any other route
  let rendered = 0;
  for (const cid of CHARS.slice(0, 4)) {
    for (const pal of ['acoustic', 'electronic']) {
      const ch = atomCharacterForPalette(ATOM_POOL_CHARACTERS[cid], pal);
      for (const mid of MODS) {
        const out = buildAtoms(ch, { seed: 4242, overlayDef: resolveModifier(mid, null, null, pal) });
        if (BANNED_ARTICULATION_RE.test(out.style))
          bad(`${mid} on ${cid} [${pal}]: banned articulation reached the style string`);
        rendered++;
      }
    }
  }
  checks++;
  console.log(`  articulation: clean across all declared atoms and ${rendered} rendered builds.`);
}

/* ---- FACT 3: one voice, one mention -----------------------------------------
 * John, round 4 A2: "French horn mentioned on 3 occasions in the prompt???"
 * A3: "The prompt has French horn use at odds with one another."
 * Naming one instrument N times tells Suno to render N of them. */
{
  const WATCH = ['french horn', 'cello', 'violin', 'oboe', 'flute', 'piano', 'nylon guitar', 'marimba', 'vibraphone'];
  let worst = 0, worstWhat = '';
  for (const cid of CHARS) {
    for (const pal of ['acoustic', 'electronic']) {
      const ch = atomCharacterForPalette(ATOM_POOL_CHARACTERS[cid], pal);
      for (const mid of MODS) {
        const out = buildAtoms(ch, { seed: 777, overlayDef: resolveModifier(mid, null, null, pal) });
        const style = out.style.toLowerCase();
        for (const w of WATCH) {
          const n = (style.match(new RegExp(w.replace(' ', '\\s+') + 's?', 'g')) || []).length;
          if (n > worst) { worst = n; worstWhat = `${w} x${n} (${mid} on ${cid} [${pal}])`; }
          // 2 is the tolerated ceiling: a bed may legitimately contain the same
          // family the signature solos on (Barry's solo horn over held horns).
          // 3+ is the defect John reported.
          if (n >= 3) bad(`"${w}" named ${n} times — ${mid} on ${cid} [${pal}]`);
        }
      }
    }
  }
  checks++;
  console.log(`  one-voice-one-mention: worst case ${worstWhat || 'none'}.`);
}

/* ---- FACT 4: interaction language is mandatory ------------------------------
 * Standing project rule from John's own testing: the tight front-weighted 6-9
 * tag model rendered hopeless; fuller woven prompts render accurate music. Every
 * style string must carry relational language, never a bare instrument list. */
{
  const REL = /\b(under|underneath|beneath|behind|over|against|answering|locked|together|around|through|between|while|as the)\b/i;
  let n = 0;
  for (const cid of CHARS) {
    const ch = atomCharacterForPalette(ATOM_POOL_CHARACTERS[cid], 'acoustic');
    const out = buildAtoms(ch, { seed: 31337 });
    if (!REL.test(out.style)) bad(`${cid}: style string carries no interaction language`);
    n++;
  }
  checks++;
  console.log(`  interaction language: present on all ${n} characters.`);
}

console.log(`validate-knowledge: ${checks} fact groups, ${fails} failures.`);
if (fails) process.exit(1);

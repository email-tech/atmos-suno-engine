/* validate-linking.mjs — every linking phrase must trace to John's guide.
 *
 * This exists because round 4 was partly lost to invented interaction language
 * while docs/knowledge/instrument-family-linking-guide.md already contained
 * tested wording. The guide file itself is the source of truth: these checks
 * read it from disk and assert that core/linking.js did not paraphrase, drift
 * from, or add to it.
 */
import fs from 'node:fs';
import {
  PAIR_LINKS, PLANES, FAMILY_ROLES, classifyInstrument, pairLink, allPhrases,
} from './core/linking.js';
import { BANNED_ARTICULATION_RE } from './core/knowledge.js';
import { buildAtoms } from './core/atoms.js';
import { ATOM_POOL_CHARACTERS, atomCharacterForPalette } from './engines/atom-characters.js';
import { ATOM_MODIFIERS, resolveModifier } from './core/atom-modifiers.js';

let checks = 0, fails = 0;
const bad = (m) => { fails++; console.log('  FAIL: ' + m); };
const ok = (c, m) => { checks++; if (!c) bad(m); };

const GUIDE_PATH = 'docs/knowledge/instrument-family-linking-guide.md';
ok(fs.existsSync(GUIDE_PATH), 'the source guide is missing from the repo');
const guide = fs.readFileSync(GUIDE_PATH, 'utf8')
  .replace(/[\u2010-\u2015\u2212]/g, '-')     // guide uses non-ASCII hyphens
  .replace(/\u2019/g, "'")
  .toLowerCase();

/* 1. PROVENANCE — every pair-link phrase must appear verbatim in the guide.
 *    This is the check that makes invention impossible: a phrase written from
 *    scratch cannot be found in the source and fails here. */
{
  let n = 0;
  for (const [key, list] of Object.entries(PAIR_LINKS)) {
    for (const phrase of list) {
      const needle = phrase.toLowerCase().replace(/colour/g, 'color');  // guide is US spelling
      if (!guide.includes(needle))
        bad(`${key}: "${phrase.slice(0, 52)}" is not in the guide — invented or paraphrased`);
      n++;
    }
  }
  checks++;
  console.log(`  provenance: all ${n} pair-link phrases traced to the guide.`);
}

/* 2. PLANE-OF-TONE templates must match the guide's §13 wording. */
{
  const samples = [
    PLANES.foreground.line('strings'),
    PLANES.middle.support('strings'),
    PLANES.middle.inner('strings'),
    PLANES.background.blend('strings'),
    PLANES.background.enrich('strings'),
  ];
  for (const p of samples) {
    const needle = p.toLowerCase().replace('strings', '[family]');
    if (!guide.includes(needle))
      bad(`plane phrase not in guide §13: "${p}"`);
  }
  checks++;
  console.log('  planes: foreground / middle / background wording matches §13.');
}

/* 3. NOTHING IMPORTED MAY CARRY BANNED ARTICULATION.
 *    The guide predates John's ruling and still contains fanfare / stabs /
 *    ostinato phrasing (§4, §5, §9, §10, and Patterns B and D). Those must have
 *    been excluded on import. */
{
  for (const p of allPhrases())
    if (BANNED_ARTICULATION_RE.test(p))
      bad(`imported phrase carries banned articulation: "${p}"`);
  ok(!Object.keys(PAIR_LINKS).includes('brass|percussion'),
    '§10 Brass+Percussion must not be imported — dominance language');
  checks++;
  console.log('  exclusions: no banned articulation, §10 not imported.');
}

/* 4. CLASSIFIER — instruments actually used in this app must resolve, and
 *    out-of-scope electronic instruments must return null rather than a guess.
 *    The guide covers orchestral families ONLY; silently mapping a supersaw to
 *    'strings' would be exactly the invention this harness prevents. */
{
  const shouldResolve = {
    'French horn': 'brass', 'flugelhorn': 'brass', 'cello': 'strings',
    'a soaring long-breathed solo violin melody': 'strings', 'oboe': 'woodwinds',
    'cor anglais': 'woodwinds', 'harp': 'harp', 'a sparse solo felt-piano melody': 'piano',
    'marimba': 'percussion', 'timpani': 'percussion',
  };
  for (const [inst, want] of Object.entries(shouldResolve))
    ok(classifyInstrument(inst) === want,
      `classifier: "${inst}" -> ${classifyInstrument(inst)}, expected ${want}`);

  for (const inst of ['a warm analog synth pad', 'sub bass', 'drum machine', 'supersaw lead'])
    ok(classifyInstrument(inst) === null,
      `classifier: "${inst}" is outside the guide's scope and must return null, got ${classifyInstrument(inst)}`);
}

/* 5. DETERMINISM — a seed must reproduce the same linking phrase. */
{
  ok(pairLink('strings', 'brass', 7) === pairLink('strings', 'brass', 7), 'pairLink is not deterministic');
  ok(pairLink('strings', 'strings', 1) === null, 'a family must not link to itself');
  ok(pairLink('strings', null, 1) === null, 'a null family must not link');
  ok(FAMILY_ROLES.brass.type === 'sustained' && FAMILY_ROLES.harp.type === 'plucked',
    'family cross-types do not match guide §12');
}

/* 6. END TO END — a modifier bed must reach the style string in the BACKGROUND
 *    plane, and the character's supporting voice in the MIDDLE plane. These are
 *    the two halves of John's round-4 prominence complaint. */
{
  let back = 0, mid = 0;
  for (const cid of Object.keys(ATOM_POOL_CHARACTERS)) {
    for (const pal of ['acoustic', 'electronic']) {
      const ch = atomCharacterForPalette(ATOM_POOL_CHARACTERS[cid], pal);
      const plain = buildAtoms(ch, { seed: 5150 });
      if (/middle plane/.test(plain.style)) mid++;
      for (const mid_ of Object.keys(ATOM_MODIFIERS)) {
        const out = buildAtoms(ch, { seed: 5150, overlayDef: resolveModifier(mid_, null, null, pal) });
        const pad = out.arrangement.find(a => a.family === 'pad');
        if (pad && pad.source === 'overlay' && classifyInstrument(pad.instrument)) {
          if (!/background plane/.test(out.style))
            bad(`${mid_} on ${cid} [${pal}]: modifier bed did not reach the background plane`);
          else back++;
        }
      }
    }
  }
  ok(back > 0, 'no modifier bed was ever placed in the background plane');
  ok(mid > 0, 'no character voice was ever placed in the middle plane');
  console.log(`  placement: ${back} modifier beds in the background plane, ${mid} characters using the middle plane.`);
}

console.log(`validate-linking: ${checks} checks, ${fails} failures.`);
if (fails) process.exit(1);

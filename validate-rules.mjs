/* validate-rules.mjs — proves the P2 rule engine (core/rules.js) makes the
 * IDENTICAL congruence decision the former inline congruenceGate made, across
 * every overlay × character × palette. This is the parity proof for the refactor
 * at the decision layer; validate-atoms.mjs proves the composed style string is
 * byte-identical downstream.
 *
 * The "oracle" below is a verbatim copy of the pre-P2 inline gate. If the rule
 * engine ever diverges from it, this harness fails.
 * Run from repo root:  node validate-rules.mjs
 */
import { evaluateCongruence } from './core/rules.js';
import { ATOM_OVERLAYS } from './core/atoms.js';
import { ATOM_POOL_CHARACTERS, atomCharacterForPalette } from './engines/atom-characters.js';

// ---- ORACLE: the exact pre-P2 inline gate, frozen here as ground truth -----
function oracleGate(ov, char){
  const c = ov.congruence || { lean:'any', engines:null, takeover:{} };
  if (c.lean === 'electronic' && !char.electronicLean)
    return { ok:false, atoms:{}, reason:`${ov.label} is electronic-only; ${char.label} is not electronic-leaning — refused (genre clash).` };
  if (c.engines && !c.engines.includes(char.source))
    return { ok:false, atoms:{}, reason:`${ov.label} is not congruent with ${char.source} — refused.` };
  const owned = new Set(char.genreOwned || []);
  const take = c.takeover || {};
  const atoms = {};
  for (const [k,a] of Object.entries(ov.atoms)){
    if (a.family && owned.has(a.family) && !take[a.family]) continue;
    atoms[k] = a;
  }
  return { ok:true, atoms, reason:null };
}

const PALETTES = ['electronic', 'acoustic'];
const charIds = Object.keys(ATOM_POOL_CHARACTERS);
const ovIds = Object.keys(ATOM_OVERLAYS);
let n = 0, fail = 0;
const bad = (m) => { if (fail < 25) console.log('  FAIL:', m); fail++; };

for (const cid of charIds){
  for (const pal of PALETTES){
    const char = atomCharacterForPalette(ATOM_POOL_CHARACTERS[cid], pal);
    for (const ov of ovIds){
      const O = ATOM_OVERLAYS[ov];
      const want = oracleGate(O, char);
      const got  = evaluateCongruence(O, char);
      n++;
      const tag = `${ov} on ${cid}/${pal}`;
      if (got.ok !== want.ok) bad(`ok mismatch (${got.ok} vs ${want.ok}) — ${tag}`);
      if ((got.reason || null) !== (want.reason || null)) bad(`reason mismatch — ${tag}`);
      const gk = Object.keys(got.atoms).sort().join(',');
      const wk = Object.keys(want.atoms).sort().join(',');
      if (gk !== wk) bad(`surviving-atom set mismatch ([${gk}] vs [${wk}]) — ${tag}`);
    }
  }
}

// Sanity: the known refusals still fire (electronic overlay on a non-electronic
// character) and the known applications still pass.
const elecChar = atomCharacterForPalette(ATOM_POOL_CHARACTERS['balearic-house'], 'electronic');
const acouChar = atomCharacterForPalette(ATOM_POOL_CHARACTERS['lush-cinematic-chillout'], 'acoustic');
const elecOv = ovIds.find(id => (ATOM_OVERLAYS[id].congruence || {}).lean === 'electronic');
if (elecOv){
  if (evaluateCongruence(ATOM_OVERLAYS[elecOv], acouChar).ok) bad(`${elecOv} should refuse on acoustic char`);
  if (!evaluateCongruence(ATOM_OVERLAYS[elecOv], elecChar).ok) bad(`${elecOv} should apply on electronic char`);
}

if (!fail) console.log(`rule engine: decision-equivalent to inline gate across ${n} overlay×char×palette combinations.`);
console.log(`validate-rules: ${n} checks, ${fail} failures.`);
process.exit(fail ? 1 : 0);

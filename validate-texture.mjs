/* validate-texture.mjs — THE TEXTURE MODIFIER (John, 2026-08-18).
 *
 * Nine checks, each pinned to a decision that was ARGUED rather than assumed,
 * so a future session that changes one of them fails here instead of finding
 * out from a bad Suno render. The two that matter most:
 *
 *   - PARITY. With both selectors empty, output must be byte-identical to the
 *     build before this module existed. Every feature that lands while the
 *     engines are unproven has to be provably invisible when off; that is the
 *     same guarantee core/detail-system.js carries and the reason a regression
 *     can be attributed rather than hunted.
 *   - THE RELATIONSHIP RULE. A texture bed is allowed to stand alongside the
 *     character's own bed ONLY because its clause states how it sits against
 *     it. That is the entire justification for exempting it from BED_BUDGET,
 *     and if the prose ever stops saying so the exemption becomes the mud the
 *     budget exists to prevent.
 */
import { ATOM_CHARACTERS as BALEARIC_ATOM } from './engines/atom-balearic.js';
import { atomCharacterForPalette } from './engines/atom-characters.js';
import { buildAtoms } from './core/atoms.js';
import { DELERIUM } from './engines/delerium.js';
import { ERA } from './engines/era.js';
import { build as resolverBuild } from './core/resolver.js';
import {
  TEXTURE_VOICES, TEXTURE_IDS, TEXTURE_PROSE, TEXTURE_FLAVOUR,
  resolveTexturePicks, textureCastEntries, renderTextureClauses, statesRelationship,
} from './core/texture.js';
import { articulationFault, padWidthFault, isStruckOrPlucked } from './core/articulation.js';
import { runMetatagEngine } from './core/metatag.js';
import { buildMusicalDNA } from './core/dna.js';

let checks = 0, fails = 0;
const ok = (cond, msg) => { checks++; if (!cond) { fails++; console.log('  FAIL: ' + msg); } };

const atomChars = Object.keys(BALEARIC_ATOM).filter(k => BALEARIC_ATOM[k] && BALEARIC_ATOM[k].atoms);
const SEEDS = [1, 7, 11, 23, 41, 97, 313, 1024];

function atomBuild(charId, palette, seed, picks) {
  const char = atomCharacterForPalette(BALEARIC_ATOM[charId], palette);
  return buildAtoms(char, { seed, textureVoices: textureCastEntries(resolveTexturePicks(picks)) });
}

/* ---- 1. POOL SHAPE ------------------------------------------------------ */
console.log('1. pool matches John\'s spec');
ok(TEXTURE_IDS.length === 9, `pool should hold 9 voices, holds ${TEXTURE_IDS.length}`);
ok(TEXTURE_IDS.filter(id => TEXTURE_VOICES[id].family === 'strings').length === 3,
   'three string registers (low/mid/high)');
for (const id of TEXTURE_IDS) {
  const v = TEXTURE_VOICES[id];
  ok(!!TEXTURE_PROSE[v.family], `${id}: family "${v.family}" has a prose bank`);
  ok(!!TEXTURE_FLAVOUR[id], `${id}: has a per-voice flavour line`);
}

/* ---- 2. JOHN'S TWO MUSICAL RULES ---------------------------------------- */
/* Rule 1 is checked on the RENDERED CLAUSE, not the bare name: the name alone
 * ("a soft French horn section") is legitimately articulation-free, and the
 * whole point of the library is that the clause supplies it. 'unstated' is the
 * failure that matters — CONVENTION_BLEED says an undecided orchestral
 * instrument gets the orchestral default, which is short and accented. */
console.log('2. articulation and pad width');
for (const id of TEXTURE_IDS) {
  const [voice] = resolveTexturePicks([id]);
  for (const bedPresent of [true, false]) {
    for (const seed of SEEDS) {
      const [clause] = renderTextureClauses([voice], { seed, bedPresent });
      const fault = articulationFault(clause);
      ok(fault === null, `${id} (bed=${bedPresent}, seed ${seed}): articulation ${fault} — "${clause}"`);
    }
  }
  if (TEXTURE_VOICES[id].kind === 'bed') {
    ok(padWidthFault(TEXTURE_VOICES[id].name) === null,
       `${id}: bed name "${TEXTURE_VOICES[id].name}" fails John's 3+ note pad width rule`);
  }
}
/* The harp keeps its attack — John's own refinement. A legato harp would be a
 * contradiction, so assert the library never asks for one. */
ok(isStruckOrPlucked(TEXTURE_VOICES.harp.name), 'harp classifies as struck-or-plucked');
for (const list of [TEXTURE_PROSE.harp.withBed, TEXTURE_PROSE.harp.alone])
  for (const p of list)
    ok(/\b(pluck|plucked|arpeggio|arpeggios|picking|ring|resonance)\b/i.test(p),
       `harp phrase keeps its attack: "${p}"`);

/* ---- 3. THE MERGE RULE -------------------------------------------------- */
/* Two picks in one family must become ONE named source. Naming an instrument
 * twice tells Suno to render two of it (core/knowledge.js, round 4), and the
 * merged name must not reintroduce the duplication inside itself — which is
 * exactly what a naive join of "a soprano saxophone" and "an alto saxophone"
 * does with the word saxophone. */
console.log('3. same-family picks merge to one named source');
const HEADWORDS = ['saxophone', 'string', 'horn', 'trombone', 'oboe', 'harp', 'ensemble', 'section'];
for (let i = 0; i < TEXTURE_IDS.length; i++) {
  for (let j = i + 1; j < TEXTURE_IDS.length; j++) {
    const a = TEXTURE_IDS[i], b = TEXTURE_IDS[j];
    const res = resolveTexturePicks([a, b]);
    const sameFamily = TEXTURE_VOICES[a].family === TEXTURE_VOICES[b].family;
    ok(res.length === (sameFamily ? 1 : 2),
       `${a}+${b}: expected ${sameFamily ? 1 : 2} named sources, got ${res.length}`);
    for (const v of res) {
      const low = v.name.toLowerCase();
      for (const w of HEADWORDS) {
        const n = (low.match(new RegExp(`\\b${w}s?\\b`, 'g')) || []).length;
        ok(n <= 1, `${a}+${b}: merged name repeats "${w}" — "${v.name}"`);
      }
      ok(padWidthFault(v.name) === null || v.kind !== 'bed',
         `${a}+${b}: merged bed "${v.name}" fails pad width`);
    }
  }
}
ok(resolveTexturePicks(['stringsLow', 'stringsLow']).length === 1,
   'the same entry picked twice is one voice, not a merge');
ok(resolveTexturePicks([]).length === 0 && resolveTexturePicks(['', null]).length === 0,
   'empty selectors resolve to nothing');

/* ---- 4. THE RELATIONSHIP RULE ------------------------------------------- */
/* This is what earns a texture bed its exemption from BED_BUDGET. Every
 * withBed phrase must say where the voice sits relative to what is already
 * there; a phrase that only describes itself would leave two unrelated beds in
 * one prompt, which is the mud the budget was written to stop. */
console.log('4. withBed prose states the relationship');
for (const [fam, bank] of Object.entries(TEXTURE_PROSE)) {
  for (const p of bank.withBed)
    ok(statesRelationship(p), `${fam} withBed phrase states no relationship: "${p}"`);
}
for (const id of TEXTURE_IDS) {
  const [voice] = resolveTexturePicks([id]);
  for (const seed of SEEDS) {
    const [clause] = renderTextureClauses([voice], { seed, bedPresent: true });
    ok(statesRelationship(clause), `${id} seed ${seed}: withBed clause states no relationship — "${clause}"`);
  }
}

/* ---- 5. PARITY WHEN OFF ------------------------------------------------- */
console.log('5. both selectors empty == byte-identical output');
for (const id of atomChars) for (const palette of ['electronic', 'acoustic']) for (const seed of SEEDS) {
  const base = atomBuild(id, palette, seed, []);
  const none = atomBuild(id, palette, seed, ['', '']);
  ok(base.style === none.style, `${id}/${palette}/${seed}: empty selectors changed the style`);
}
for (const seed of SEEDS) {
  for (const [eng, name] of [[DELERIUM, 'Delerium'], [ERA, 'Era']]) {
    const cid = Object.keys(eng.characters)[0];
    const a = resolverBuild(eng, { characterId: cid, palette: 'electronic', seed });
    const b = resolverBuild(eng, { characterId: cid, palette: 'electronic', seed, texture: [] });
    ok(a.style === b.style, `${name}/${seed}: empty texture changed the style`);
  }
}

/* ---- 6. IT ACTUALLY REACHES THE PROMPT, AND ONLY ONCE ------------------- */
/* Both directions in one sweep. Every reconciler is trivially satisfiable by
 * deletion, so a check that texture never duplicates is worthless without a
 * floor proving it renders at all — the lesson logged 2026-08-17. */
console.log('6. texture renders, threaded, exactly once');
let rendered = 0, attempted = 0, dropped = 0;
for (const id of atomChars) for (const seed of SEEDS) {
  for (const picks of [['stringsLow'], ['frenchHorns'], ['harp'], ['stringsLow', 'altoSax'], ['stringsLow', 'stringsHigh']]) {
    attempted++;
    const out = atomBuild(id, 'acoustic', seed, picks);
    const voices = resolveTexturePicks(picks);
    const survivors = (out.cast || []).filter(v => v.source === 'texture');
    if (!survivors.length) { dropped++; continue; }
    rendered++;
    for (const v of survivors) {
      const n = (out.style.split(v.instrument).length - 1);
      ok(n === 1, `${id}/${seed}/${picks.join('+')}: "${v.instrument}" appears ${n} times`);
      /* FAMILY COLLISION, the fault this check was extended for. A texture
       * string ensemble rendered alongside the acoustic character's own "soft
       * layered strings" is one instrument named twice, which round 4
       * established renders two of it — and SINGLETON_INSTRUMENT_WORDS cannot
       * see it, because 'strings' is not one of its nine bare headwords. */
      const engineFams = new Set((out.cast || []).filter(c => c.source === 'engine' && c.family).map(c => c.family));
      ok(!engineFams.has(v.family),
         `${id}/${seed}/${picks.join('+')}: texture family "${v.family}" duplicates engine content`);
    }
    ok(voices.length >= survivors.length, 'survivors cannot exceed picks');
  }
}
/* THE FLOOR MATTERS MORE SINCE 0c LANDED. Every reconciler is trivially
 * satisfiable by deletion, and a family-collision rule is the easiest of all to
 * over-apply — the acoustic sweep below drops ~40% legitimately (the character
 * already carries strings), so the floor is set where a rule that started
 * silently eating everything would still fail. */
ok(rendered > attempted * 0.4,
   `floor: texture reached the prompt in only ${rendered}/${attempted} builds`);
console.log(`   texture rendered in ${rendered}/${attempted} builds (${dropped} dropped by reconciliation)`);

/* ---- 7. NEVER AFTER THE MASTERING TAIL --------------------------------- */
/* The composer defect measured at 08212c9 was 342/342 builds placing modifier
 * content after the Dolby Atmos tail, which is terminal by design. It matters
 * more here: this feature deliberately raises the named-source count, and
 * last-named is what Suno drops. */
console.log('7. texture sits inside the body, before mastering');
for (const id of atomChars) for (const seed of SEEDS) {
  const picks = ['stringsLow', 'frenchHorns'];
  const out = atomBuild(id, 'acoustic', seed, picks);
  const mast = out.style.toLowerCase().indexOf('polished dolby');
  if (mast < 0) continue;
  for (const v of (out.cast || []).filter(v => v.source === 'texture')) {
    ok(out.style.indexOf(v.instrument) < mast,
       `${id}/${seed}: "${v.instrument}" rendered after the mastering tail`);
  }
}

/* ---- 8. NO METATAG DIRECTION ------------------------------------------- */
/* John, 2026-08-18: "Textured voice don't get a Metatag direction." Path B
 * would permit it — they are named in the style field — so this is a musical
 * call, not a safety rule, and it needs a test or it will drift back. */
console.log('8. texture voices are never directed in the metatags');
for (const id of atomChars) for (const seed of [1, 11, 97]) {
  const picks = ['stringsHigh', 'sopranoSax'];
  const out = atomBuild(id, 'acoustic', seed, picks);
  const dna = buildMusicalDNA(BALEARIC_ATOM[id], 'acoustic', { seed, characterId: id });
  let block = '';
  try {
    block = runMetatagEngine({ dna, renderMode: 'lean', answers: { 'vocal.mode': 'vocal' } }).block;
  } catch (e) { block = ''; }
  for (const v of (out.cast || []).filter(v => v.source === 'texture')) {
    ok(!block.toLowerCase().includes(v.instrument.toLowerCase()),
       `${id}/${seed}: metatags direct the texture voice "${v.instrument}"`);
  }
}

/* ---- 9. SUPPORT-OR-REPLACE ACTUALLY SWITCHES --------------------------- */
/* John's whole point: the same pick reads as support when a bed survives and
 * as the foundation when none does. A library where both contexts produce the
 * same sentence would satisfy every other check here and still be wrong. */
console.log('9. support and replace produce different prose');
for (const id of TEXTURE_IDS) {
  const [voice] = resolveTexturePicks([id]);
  for (const seed of SEEDS) {
    const [withBed] = renderTextureClauses([voice], { seed, bedPresent: true });
    const [alone] = renderTextureClauses([voice], { seed, bedPresent: false });
    ok(withBed !== alone, `${id}/${seed}: support and replace prose identical — "${withBed}"`);
  }
}
/* Two picks in one build must never read the same sentence — the distributed
 * blanket-clause fault (five voices reading one identical phrase) caught on the
 * composer path on 2026-08-17. */
for (const seed of SEEDS) {
  const voices = resolveTexturePicks(['stringsLow', 'altoSax']);
  const clauses = renderTextureClauses(voices, { seed, bedPresent: true });
  ok(new Set(clauses).size === clauses.length, `seed ${seed}: two texture voices share a clause`);
}

console.log(`\nvalidate-texture: ${checks} checks, ${fails} failures.`);
if (fails) process.exit(1);

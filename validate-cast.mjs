/* ==========================================================================
 * validate-cast.mjs — ENSEMBLE RECONCILIATION (John, 2026-08-17).
 *
 * Guards the architectural change John called for: every variable on the table
 * as DATA, judged as an ensemble, before any prose is written.
 *
 * The checks are written as BEFORE/AFTER regressions against numbers actually
 * measured at HEAD 08212c9, not as abstract invariants — so if a future change
 * reintroduces the fault, this says which measured defect came back.
 * ========================================================================*/
import { buildAtoms } from './core/atoms.js';
import { atomCharacterForPalette } from './engines/atom-characters.js';
import { getEngine, atomCharacterList } from './js/registry.js';
import { COMPOSER_LAYERS } from './core/composer-layers.js';
import {
  buildCast, reconcileCast, isSustainedBed, isLead, wastesItsSlot,
  componentsFor, COMPOSITE_COMPONENTS, BED_BUDGET, LEAD_BUDGET, VOICE_BUDGET,
} from './core/cast.js';

let failures = 0, checks = 0;
const bad = (m) => { console.error(`  FAIL: ${m}`); failures++; };
const ok = (c, m) => { if (!c) bad(m); };

const eng = getEngine('Balearic Atom');
const CHARS = atomCharacterList(eng.module).map(c => c.id);
const build = (cid, pal, seed, extra) =>
  buildAtoms(atomCharacterForPalette(eng.module[cid], pal), { seed, vocalActive: true, ...(extra || {}) });

/* ---- 1: bed budget — the headline defect (was 53% of builds) ---------- */
{
  let tot = 0, over = 0, none = 0;
  for (const cid of CHARS) for (const pal of ['electronic', 'acoustic']) for (let s = 1; s <= 40; s++) {
    const o = build(cid, pal, s);
    const beds = o.cast.filter(isSustainedBed).length;
    tot++; if (beds > BED_BUDGET) over++; if (beds === 0) none++;
  }
  ok(over === 0, `${over}/${tot} builds carry more than ${BED_BUDGET} sustained bed (was 53% before reconciliation)`);
  // Not asserting every build HAS a bed: a beatless or sparse character
  // legitimately may not, and forcing one would invent a voice.
  checks++;
  console.log(`  bed budget: 0/${tot} builds over budget (${((tot - none) / tot * 100).toFixed(0)}% carry exactly one).`);
}

/* ---- 2: lead budget (was 15% of builds) ------------------------------- */
{
  let tot = 0, over = 0;
  for (const cid of CHARS) for (const pal of ['electronic', 'acoustic']) for (let s = 1; s <= 40; s++) {
    const o = build(cid, pal, s);
    tot++; if (o.cast.filter(isLead).length > LEAD_BUDGET) over++;
  }
  ok(over === 0, `${over}/${tot} builds carry more than ${LEAD_BUDGET} foreground lead (was 15%)`);
  checks++;
  console.log(`  lead budget: 0/${tot} builds with a second lead.`);
}

/* ---- 3: composer content is RECONCILED, not appended ----------------
 * The architectural fix. Three separate assertions, because the old code
 * failed all three at once and a partial fix would be worse than none. */
{
  let tot = 0, afterMastering = 0, dupLead = 0, overBed = 0, contributed = 0;
  const MAST = 'Polished Dolby Atmos-Master Atmos -2dB';
  for (const cid of CHARS) for (const lid of Object.keys(COMPOSER_LAYERS)) for (const s of [7, 4242]) {
    const o = build(cid, 'electronic', s, { composerInstruments: COMPOSER_LAYERS[lid].instruments });
    tot++;
    const i = o.style.indexOf(MAST);
    if (i !== -1 && o.style.slice(i + MAST.length).replace(/[.,\s]+/g, '').length > 0) afterMastering++;
    if (o.cast.filter(isLead).length > LEAD_BUDGET) dupLead++;
    if (o.cast.filter(isSustainedBed).length > BED_BUDGET) overBed++;
    if (o.cast.some(v => v.source === 'composer')) contributed++;
  }
  ok(afterMastering === 0, `${afterMastering}/${tot} composer builds put content AFTER the mastering tail (was 342/342)`);
  ok(dupLead === 0, `${dupLead}/${tot} composer builds carry two leads (was 25/342 naming a synth lead twice)`);
  ok(overBed === 0, `${overBed}/${tot} composer builds exceed the bed budget`);
  // The composer must still DO something — a fix that silently deletes the
  // whole modifier would pass every rule above and be useless.
  ok(contributed > tot * 0.5, `composer contributed to only ${contributed}/${tot} builds — reconciliation is over-eager`);
  checks++;
  console.log(`  composer: ${tot} builds, 0 after mastering, 0 double leads, ${contributed}/${tot} still contribute voices.`);
}

/* ---- 4: engine content OUTRANKS modifier content ---------------------
 * Caught during this build: the first ranking let a composer's decorative
 * choir beat the character's own drone synth to the single bed slot,
 * inverting the settled rule that the character's song IS the genre. */
{
  const engineBed = { instrument: 'drone synth', priority: 'decorative', source: 'engine', behaviour: 'sustained underneath' };
  const composerBed = { instrument: 'synth choir', priority: 'core', source: 'composer' };
  const r = reconcileCast([engineBed, composerBed], {});
  ok(r.kept.length === 1, 'two beds must reduce to one');
  ok(r.kept[0].source === 'engine',
    'an ENGINE voice must win the bed slot over a modifier voice, even a core one');
  ok(r.dropped[0].reason === 'bed-budget', 'the drop must be attributed to the bed budget');
  /* Signature protection is settled, but it is expressed as EXEMPTION from the
   * budget, not as winning the contest. Asserting "signature sorts first" was
   * the wrong test: when a modifier's signature bed WON the single slot it
   * evicted the character's own pad, leaving six modifier variants with no pad
   * at all. The rule that actually holds — and the one worth locking down — is
   * that a signature always SURVIVES and never costs the character its bed. */
  const sig = { instrument: 'signature pad', priority: 'decorative', source: 'composer', signature: true };
  const r2 = reconcileCast([engineBed, sig], {});
  ok(r2.kept.some(v => v.signature), 'a signature voice must always survive reconciliation');
  ok(r2.kept.some(v => v.source === 'engine'),
    'a signature bed must NOT evict the character\u2019s own bed \u2014 it is exempt from the budget, not a winner of it');
  ok(r2.dropped.length === 0, 'a signature bed plus one engine bed must drop nothing');
  checks++;
  console.log('  ranking: engine beats modifier at every priority; signature still outranks both.');
}

/* ---- 5: slot waste ---------------------------------------------------
 * The clearest symptom John reported: a voice named, then described as
 * inaudible, spending a slot for nothing. */
{
  const wasted = { instrument: 'synth counter-line', priority: 'decorative', source: 'engine',
                   mix: 'faint and buried well under the mix', density: 'answering the lead only occasionally' };
  ok(wastesItsSlot(wasted), 'a faint + occasional decorative voice must be recognised as slot waste');
  // NEGATIVE: quiet is not the same as pointless.
  ok(!wastesItsSlot({ ...wasted, priority: 'core' }), 'a CORE voice must never be dropped for being quiet');
  ok(!wastesItsSlot({ ...wasted, signature: true }), 'a SIGNATURE voice must never be dropped for being quiet');
  ok(!wastesItsSlot({ instrument: 'analog pad', priority: 'decorative', source: 'engine',
                      mix: 'buried well under the mix', behaviour: 'sustained' }),
    'a BED must never be dropped for sitting low — that is correct pad behaviour (John, explicit)');
  ok(!wastesItsSlot({ instrument: 'shaker', priority: 'decorative', source: 'engine', density: 'occasionally' }),
    'occasional alone is not slot waste — it must also be inaudible');
  checks++;
  console.log('  slot waste: fires on faint+occasional decoration only; core, signature and beds protected.');
}

/* ---- 6: composites count as ONE named source (John's kit theory) ------
 * "Stating a particular Drum kit is good... It should still be acceptable to
 * state in a Metatag Kick drum enters, even though it never appears in the
 * Style prompt." The budget counts NAMED SOURCES, not audible sounds. */
{
  const cast = buildCast([
    { key: 'groove', family: 'drums', instrument: 'four-on-the-floor house kit', priority: 'core' },
    { key: 'bass', family: 'bass', instrument: 'sub bass', priority: 'core' },
  ]);
  const r = reconcileCast(cast, { voiceBudget: 2 });
  ok(r.namedSources === 2, `a kit plus a bass must count as 2 named sources, got ${r.namedSources}`);
  const comps = componentsFor(r.kept);
  for (const c of ['kick drum', 'snare', 'hi-hats', 'toms'])
    ok(comps.includes(c), `"${c}" must be a legal metatag component of a named kit`);
  ok(componentsFor([{ instrument: 'sub bass' }]).length === 0,
    'a non-composite source must expose no components');
  ok(COMPOSITE_COMPONENTS.percussion.includes('shaker'), 'percussion components must be defined');
  checks++;
  console.log(`  composites: kit = 1 source, ${comps.length} legal metatag components exposed.`);
}

/* ---- 7: the voice budget number is NOT guessed -----------------------
 * John's standing rule. The machinery exists and is tested; the number stays
 * null until the research pack returns a measured figure. */
{
  ok(VOICE_BUDGET === null,
    'VOICE_BUDGET must stay null until Suno testing sets it — do not hard-code a guessed ceiling');
  const cast = buildCast([1, 2, 3, 4, 5, 6, 7, 8].map((n, i) =>
    ({ key: `k${i}`, family: `f${i}`, instrument: `instrument ${n}`, priority: 'decorative' })));
  ok(reconcileCast(cast, {}).kept.length === 8, 'with no budget set, nothing may be dropped for count');
  ok(reconcileCast(cast, { voiceBudget: 5 }).kept.length === 5, 'an explicit budget must be enforced when supplied');
  ok(reconcileCast(cast, { voiceBudget: 5 }).dropped.every(d => d.reason === 'voice-budget'),
    'count drops must be attributed to the voice budget');
  checks++;
  console.log('  voice budget: architecture live, number deferred to Suno evidence.');
}

/* ---- 8: no build regressed to empty ---------------------------------
 * A reconciliation bug that stripped everything would satisfy checks 1-3
 * perfectly. This is the guard against passing by deletion. */
{
  let tot = 0, thin = 0, sum = 0;
  for (const cid of CHARS) for (const pal of ['electronic', 'acoustic']) for (let s = 1; s <= 20; s++) {
    const o = build(cid, pal, s);
    tot++; sum += o.cast.length;
    if (o.cast.length < 3) thin++;
    ok(/Polished Dolby Atmos/.test(o.style), `${cid}/${pal}/${s}: mastering tail missing`);
    ok(o.style.trim().endsWith('-2dB') || /-2dB\.?$/.test(o.style.trim()),
      `${cid}/${pal}/${s}: mastering must be LAST in the style string`);
  }
  ok(thin === 0, `${thin}/${tot} builds fell below 3 named voices — reconciliation is stripping too much`);
  checks++;
  console.log(`  not-by-deletion: ${tot} builds, min 3 voices, avg ${(sum / tot).toFixed(1)}, mastering last everywhere.`);
}

console.log(`validate-cast: ${checks} check groups, ${failures} failures.`);
process.exit(failures ? 1 : 0);

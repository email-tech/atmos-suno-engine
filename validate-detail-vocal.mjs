/* ==========================================================================
 * validate-detail-vocal.mjs — VOCAL TREATMENT RESOLVER (spec v2.0 §8).
 *
 * The rules worth guarding are the ones where getting it wrong produces prose
 * that READS FINE and is musically or semantically false — a talkbox with no
 * carrier, a tempo-locked stutter on a beatless character, a vocoder that eats
 * a Persona lead. Those do not announce themselves in output review.
 * ========================================================================*/
import {
  resolveVocalTreatmentFull, classifyVocalRole, eligibleTalkboxCarriers,
  eligibleVocalTargets, VOCAL_PROSE, TREATMENT_SUBTYPES, DEFAULT_INTENSITY,
  VAGUE_GLITCH_RE, VOCAL_ROLES,
} from './core/detail-vocal.js';
import { buildDetailContext, resolveDetailSystem, renderDetailClauses } from './core/detail-system.js';

let failures = 0, checks = 0;
const bad = (m) => { console.error(`  FAIL: ${m}`); failures++; };
const ok = (c, m) => { if (!c) bad(m); };

const ctxWith = (over) => buildDetailContext(Object.assign({
  seed: 42, engineId: 'Delerium', engineKind: 'resolver', characterId: 'x',
  cast: [{ instrument: 'a warm analog synth lead' }, { instrument: 'a soft house kit' }],
  vocalSources: [{ instrument: 'a breathy close female vocal' }],
  uiIntent: { vocalTreatment: 'vocoder' },
}, over));

/* ---- 1: role classification ------------------------------------------ */
{
  const cases = [
    ['a layered chant choir', 'choir'],
    ['a wordless soprano melisma', 'wordless_vocal'],
    ['rhythmic sampled ethnic vocal chops', 'existing_vocal_chop'],
    ['a breathy close female vocal texture', 'lead_lyric_vocal'],
    ['Gregorian-style male chant', 'chant_layer'],
    ['a sustained wordless choir pad', 'vocal_pad'],
  ];
  for (const [t, expect] of cases) {
    const got = classifyVocalRole(t);
    ok(got === expect, `classifyVocalRole("${t}") => ${got}, expected ${expect}`);
  }
  ok(VOCAL_ROLES.includes(classifyVocalRole('a soft synth pad')) === false, 'a non-vocal source must not classify as a vocal role');
  /* §8.5 — a Persona/Voice lead is identified by METADATA, never by prose.
   * "soaring female lead" reads identically with or without a Voice attached,
   * so guessing would strip identity protection from the source that most
   * needs it. */
  ok(classifyVocalRole({ instrument: 'a soaring female lead', persona: 'X' }) === 'persona_or_voice_lead',
    'a Persona/Voice lead must be recognised from metadata');
  ok(classifyVocalRole({ instrument: 'a soaring female lead' }) !== 'persona_or_voice_lead',
    'a plain lead must NOT be guessed to be a Persona — that would be protection by accident');
  checks++;
  console.log('  §8.4 roles: classified from prose, Persona only from metadata.');
}

/* ---- 2: §8.7 talkbox is not vocoder ----------------------------------- */
{
  ok(eligibleTalkboxCarriers([{ instrument: 'a warm analog synth lead' }]).length === 1, 'a synth lead is a plausible talkbox carrier');
  ok(eligibleTalkboxCarriers([{ instrument: 'a clean electric guitar' }]).length === 1, 'a clean electric guitar is a plausible carrier');
  ok(eligibleTalkboxCarriers([{ instrument: 'a soft nylon-string guitar' }]).length === 0,
    'a nylon acoustic is not a talkbox carrier — the technique needs an amplified signal');
  ok(eligibleTalkboxCarriers([{ instrument: 'a cathedral pipe organ' }]).length === 0, 'an organ is not a talkbox carrier');

  /* CONTRACT INVERTED 2026-08-17. This asserted that talkbox with no carrier
   * must NO-OP, per spec §8.7. John's extensive Suno testing says Suno produces
   * talkbox and vocoder from the term alone — it matches a sound it has heard
   * rather than modelling a signal chain. The spec's own evidence hierarchy
   * (§2.3) ranks ATMOS Suno testing above production terminology, so the
   * measurement wins. Recorded as EFFECT_NAMES_NEED_NO_MECHANICS. */
  const noCarrier = resolveVocalTreatmentFull(ctxWith({
    cast: [{ instrument: 'a bowed cello drone' }], uiIntent: { vocalTreatment: 'talkbox' },
  }));
  ok(noCarrier && !noCarrier.noOp, 'talkbox with no carrier must still resolve — Suno needs the effect name, not the signal chain');
  ok(!/\{carrier\}/.test(noCarrier.rendered), 'the carrier placeholder must never survive into output');
  /* What the override does NOT relax: cast integrity. Naming an instrument the
   * build does not contain is a dangling reference whatever Suno can do with
   * the effect name. */
  ok(!/\b(synth lead|electric guitar|guitar|arp)\b/i.test(noCarrier.rendered),
    'a carrier-free talkbox line must not name an instrument absent from the cast');
  ok(!/\b(through|via) the existing\b/i.test(noCarrier.rendered),
    'a carrier-free line must not point at a carrier that does not exist');

  const withCarrier = resolveVocalTreatmentFull(ctxWith({ uiIntent: { vocalTreatment: 'talkbox' } }));
  ok(withCarrier && !withCarrier.noOp, 'talkbox with a carrier present must resolve');
  ok(withCarrier.rendered.includes('synth lead'), 'the rendered talkbox line must name the EXISTING carrier');
  ok(!withCarrier.rendered.includes('{carrier}'), 'the carrier placeholder must be substituted');
  checks++;
  console.log('  talkbox: resolves with or without a carrier (§8.7 overridden by John\'s Suno testing); names one only when the cast has one.');
}

/* ---- 3: §13 beatless characters --------------------------------------- */
{
  for (const t of ['vocalChops', 'stutter', 'glitch']) {
    const r = resolveVocalTreatmentFull(ctxWith({ beatless: true, uiIntent: { vocalTreatment: t } }));
    ok(r && r.noOp && r.reason === 'beatless-character-no-temporal-edit',
      `${t} on a beatless character must no-op — a tempo-locked edit has no grid to lock to`);
  }
  const vocoder = resolveVocalTreatmentFull(ctxWith({ beatless: true, uiIntent: { vocalTreatment: 'vocoder' } }));
  ok(vocoder && !vocoder.noOp, 'a timbral treatment is still valid on a beatless character');
  checks++;
  console.log('  §13 beatless: temporal edits blocked, timbral ones allowed.');
}

/* ---- 4: prose provenance ---------------------------------------------- */
{
  /* Every subtype must have prose, and every rendered string must come FROM the
   * library. This project has twice shipped invented interaction language while
   * a canonical library existed; this is the check that stops a third time. */
  for (const [treatment, subtypes] of Object.entries(TREATMENT_SUBTYPES)) {
    for (const st of subtypes) {
      ok(VOCAL_PROSE[st], `${treatment}: subtype ${st} has no prose entry`);
      if (!VOCAL_PROSE[st]) continue;
      ok(VOCAL_PROSE[st].full.length >= 2, `${st}: needs at least two full variants`);
      /* Any subtype whose prose names a carrier needs a carrier-free set, or a
       * build without one has nothing legal to render. */
      if (VOCAL_PROSE[st].full.some(l => l.includes('{carrier}'))) {
        ok((VOCAL_PROSE[st].fullNoCarrier || []).length >= 2, `${st}: carrier-bearing prose needs carrier-free variants too`);
        ok((VOCAL_PROSE[st].fullNoCarrier || []).every(l => !l.includes('{carrier}')), `${st}: carrier-free variants must not reference a carrier`);
        ok(VOCAL_PROSE[st].compactNoCarrier, `${st}: needs a carrier-free compact form for budget compaction`);
      }
      ok(typeof VOCAL_PROSE[st].compact === 'string' && VOCAL_PROSE[st].compact.length > 0, `${st}: needs a compact form for budget compaction`);
    }
    ok(DEFAULT_INTENSITY[treatment], `${treatment}: no default intensity (§8.13)`);
  }
  /* §8.11 — the UI label may say Glitch; the prose must never say "glitchy
   * vocals", because Suno already produces accidental artifacts and the prompt
   * has to distinguish intended structure from failure. */
  for (const [st, e] of Object.entries(VOCAL_PROSE))
    for (const line of [...e.full, e.compact])
      ok(!VAGUE_GLITCH_RE.test(line), `${st}: vague glitch wording in "${line}"`);
  checks++;
  console.log('  §8.12 prose: every subtype covered, two variants and a compact form, no vague glitch wording.');
}

/* ---- 5: rendered output is always from the library --------------------- */
{
  const allLines = Object.values(VOCAL_PROSE).flatMap(e => [...e.full, ...(e.fullNoCarrier || [])]);
  let n = 0;
  for (const t of ['vocoder', 'talkbox', 'vocalChops', 'stutter', 'glitch', 'auto']) {
    for (const seed of [1, 5, 42, 999]) {
      const r = resolveVocalTreatmentFull(ctxWith({ seed, uiIntent: { vocalTreatment: t } }));
      if (!r || r.noOp) continue;
      n++;
      const template = r.rendered.replace(r.carrier || '\u0000', '{carrier}');
      ok(allLines.some(l => l === r.rendered || l === template),
        `${t}/${seed}: rendered a line that is not in the canonical library — "${r.rendered}"`);
      ok(r.semanticTags.includes('vocal'), `${t}: result must tag the vocal dimension so later resolvers can avoid doubling it`);
    }
  }
  ok(n > 0, 'no treatment resolved at all — the test context is wrong, not the resolver');
  checks++;
  console.log(`  provenance: ${n} resolved treatments, every line traced to the canonical library.`);
}

/* ---- 6: determinism and seed isolation -------------------------------- */
{
  for (const seed of [3, 77]) {
    const a = resolveVocalTreatmentFull(ctxWith({ seed }));
    const b = resolveVocalTreatmentFull(ctxWith({ seed }));
    ok(JSON.stringify(a) === JSON.stringify(b), `seed ${seed}: same input must give the same treatment`);
  }
  /* Changing the Ear Candy or Space & Movement intent must not move the vocal
   * result — that is the whole point of the sub-seeds (§4). */
  const base = resolveVocalTreatmentFull(ctxWith({ seed: 11 }));
  const other = resolveVocalTreatmentFull(ctxWith({ seed: 11, uiIntent: { vocalTreatment: 'vocoder', earCandy: 'active', spaceMovement: 'rhythmicMotion' } }));
  ok(JSON.stringify(base) === JSON.stringify(other),
    'changing another control moved the vocal treatment — sub-seed isolation is broken');
  checks++;
  console.log('  §4 isolation: vocal result unchanged by the other two controls.');
}

/* ---- 7: still a no-op with the control off ---------------------------- */
{
  const r = resolveDetailSystem({ seed: 9, cast: [{ instrument: 'a synth lead' }], vocalSources: [{ instrument: 'a female lead vocal' }] });
  ok(r.vocalTreatment === null, 'Vocal Treatment Off must resolve to null');
  ok(renderDetailClauses(r).length === 0, 'nothing may render with the control Off');
  checks++;
  console.log('  §1.3 parity holds with the resolver implemented.');
}

console.log(`validate-detail-vocal: ${checks} check groups, ${failures} failures.`);
process.exit(failures ? 1 : 0);

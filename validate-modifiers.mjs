/* validate-modifiers.mjs — proof for the TWO-TIER modifier model.
 * Asserts, for every modifier and all 9 (core x signature) variants:
 *   1. SHAPE — 3 cores, 3 signatures; each core/signature is MULTI-ATOM (>=2).
 *   2. SLOT DISJOINTNESS — coreSlots ∩ sigSlots = ∅, and every atom stays inside
 *      its declared lane. This is what makes all 9 combinations safe by
 *      construction rather than by luck.
 *   3. NO SLOT COLLISION in any resolved variant — no two atoms share a role.
 *   4. BODY PRESENT — every core atom is priority 'core' (survives reconcile),
 *      so a modifier can never again be garnish-only.
 *   5. ONE SIGNATURE — exactly one signature:true atom per variant.
 *   6. OSTINATO-IS-NOT-A-LEAD — no atom whose text reads as an ostinato/stab/
 *      figure sits in role 'motif'.
 *   7. NO ARTIST NAMES in any rendered atom text (labels are UI-only).
 *   8. RENDERS — each variant builds real DNA on a real character, applies (not
 *      refused), and the signature text reaches the style string.
 * Run: node validate-modifiers.mjs
 */
import { ATOM_MODIFIERS, resolveModifier, modifierVariants, modifierList } from './core/atom-modifiers.js';
import { buildMusicalDNA } from './core/dna.js';
import { ATOM_POOL_CHARACTERS } from './engines/atom-characters.js';

let n = 0, fail = 0;
const bad = (m) => { if (fail < 40) console.log('  FAIL:', m); fail++; };
const textOf = (a) => String(a.instrument || a.text || '');
const NAMES = Object.values(ATOM_MODIFIERS).map(m => m.label);
const CHARS = Object.keys(ATOM_POOL_CHARACTERS);
const PALETTES = ['electronic', 'acoustic'];

for (const [modId, m] of Object.entries(ATOM_MODIFIERS)) {
  // 1. shape
  const cores = Object.keys(m.cores), sigs = Object.keys(m.signatures);
  if (cores.length !== 3) bad(`${modId}: ${cores.length} cores, expected 3`);
  if (sigs.length !== 3) bad(`${modId}: ${sigs.length} signatures, expected 3`);
  for (const c of cores) {
    if (Object.keys(m.cores[c].atoms).length < 2)
      bad(`${modId}/core ${c}: single-atom core (must be multi-atom)`);
    // PURE-NAME RULE: core instrument atoms carry names only — compose owns all
    // function/interaction language. (Signature atoms are exempt: they hoist to
    // the front and must read complete there.)
    for (const a of Object.values(m.cores[c].atoms)) {
      if (!a.instrument) continue;
      if (/\b(?:answering|threading|riding|washing|driving|sustaining|carrying|held|locked|punctuating|dropping|trading|ticking|chopping|opening)\b/i.test(a.instrument))
        bad(`${modId}/core ${c}: action language in a core atom — "${a.instrument.slice(0, 45)}"`);
    }
  }
  for (const s of sigs) if (Object.keys(m.signatures[s].atoms).length < 2)
    bad(`${modId}/sig ${s}: single-atom signature (must be multi-atom)`);

  // 2. slot disjointness + lane discipline
  const overlap = m.coreSlots.filter(r => m.sigSlots.includes(r));
  if (overlap.length) bad(`${modId}: coreSlots and sigSlots overlap on ${overlap.join(',')}`);
  for (const c of cores) for (const a of Object.values(m.cores[c].atoms))
    if (a.role && !m.coreSlots.includes(a.role)) bad(`${modId}/core ${c}: role '${a.role}' outside coreSlots`);
  for (const s of sigs) for (const a of Object.values(m.signatures[s].atoms))
    if (a.role && !m.sigSlots.includes(a.role)) bad(`${modId}/sig ${s}: role '${a.role}' outside sigSlots`);

  // per-variant checks
  for (const v of modifierVariants(modId)) {
    n++;
    const atoms = Object.values(v.atoms);

    // 3. no slot collision
    const roles = atoms.map(a => a.role).filter(Boolean);
    if (new Set(roles).size !== roles.length) bad(`${modId}/${v.coreId}+${v.signatureId}: duplicate role slot`);

    // 4. body present at 'core' priority
    const coreAtoms = Object.entries(v.atoms).filter(([k]) => k.startsWith('core_')).map(([, a]) => a);
    if (!coreAtoms.length) bad(`${modId}/${v.coreId}: no core atoms`);
    for (const a of coreAtoms) if (a.priority !== 'core')
      bad(`${modId}/${v.coreId}: core atom at priority '${a.priority}' (must be core)`);

    // 5. exactly one signature
    const sigCount = atoms.filter(a => a.signature === true).length;
    if (sigCount !== 1) bad(`${modId}/${v.coreId}+${v.signatureId}: ${sigCount} signature atoms, expected 1`);

    // 6. ostinato is not a lead — inspect the SUBJECT of the phrase (the head,
    //    up to the first preposition), so "a piano motif over the ostinato" is
    //    fine while "a dulcimer ostinato under the melody" is not.
    for (const a of atoms) {
      if (a.role !== 'motif') continue;
      const subject = textOf(a).split(/\b(?:over|under|beneath|above|through|across|against)\b/i)[0];
      if (/ostinato|stab|figure|shimmer|sweep|\bhit\b/i.test(subject))
        bad(`${modId}/${v.signatureId}: non-melodic subject slotted as motif — "${subject.slice(0, 50)}"`);
    }

    // 7. no artist names in rendered text
    for (const a of atoms) for (const nm of NAMES)
      if (textOf(a).includes(nm)) bad(`${modId}: artist name '${nm}' leaked into atom text`);

    // 8. renders on real characters — and the BODY + SIGNATURE actually land in
    //    the style string (this is the whole point: no more garnish-only).
    const sigAtom = atoms.find(a => a.signature === true);
    let appliedSomewhere = false, refusedSeen = false;
    for (const cid of CHARS) for (const pal of PALETTES) {
      const dna = buildMusicalDNA(ATOM_POOL_CHARACTERS[cid], pal,
        { seed: 404, characterId: cid, overlayDef: v });
      const style = dna && dna.render && dna.render.style;
      if (!style) { bad(`${modId}/${v.coreId}+${v.signatureId} on ${cid}: no style rendered`); continue; }
      // A REFUSAL is legitimate: the lean gate correctly refuses an electronic
      // composer on an acoustic character (the Moroder-on-downtempo rule). Skip
      // refused pairings; applicability is asserted per-modifier below instead.
      if (!dna.meta.overlayApplied) { refusedSeen = true; continue; }
      appliedSomewhere = true;
      if (sigAtom && !style.includes(textOf(sigAtom)))
        bad(`${modId}/${v.signatureId} on ${cid}: signature text absent from style`);
      // EVERY core INSTRUMENT atom must land — not merely one (garnish-only again).
      // Harmony/arc text atoms are exempt: takeover.harmony is false by design, so
      // the CHARACTER's harmonic identity deliberately wins and the modifier's
      // harmony only surfaces on characters that have none of their own.
      const bodyAtoms = coreAtoms.filter(a => a.instrument && a.role !== 'harmony');
      if (!bodyAtoms.length) bad(`${modId}/${v.coreId}: core has no instrument body`);
      for (const a of bodyAtoms) if (!style.includes(textOf(a)))
        bad(`${modId}/${v.coreId} on ${cid}: core body "${textOf(a).slice(0, 40)}" did not reach the style`);
      // a takeover bass must actually displace the character's bass
      if (m.congruence.takeover && m.congruence.takeover.bass) {
        const b = coreAtoms.find(a => a.role === 'bass');
        if (b && !b.foundational) bad(`${modId}/${v.coreId}: takeover bass not marked foundational`);
      }
      if (dna.meta.overlayVariantLabel !== v.variantLabel)
        bad(`${modId} on ${cid}: variant label not surfaced for the UI panel`);
    }
    if (!appliedSomewhere) bad(`${modId}/${v.coreId}+${v.signatureId}: refused on EVERY character`);
  }
}

// UI contract: the list the panel will render carries cores + signatures
for (const entry of modifierList()) {
  if (entry.cores.length !== 3 || entry.signatures.length !== 3)
    bad(`modifierList(): ${entry.id} missing cores/signatures for the UI panel`);
  if (!entry.label) bad(`modifierList(): ${entry.id} has no UI label`);
}

if (!fail) console.log(`Two-tier modifiers: shape, slot disjointness, no collision, body-at-core, one signature, slot correctness, no-names, render — across ${n} variants.`);
console.log(`validate-modifiers: ${n} variants, ${fail} failures.`);
process.exit(fail ? 1 : 0);

/* ==========================================================================
 * atom-modifiers.js — TWO-TIER modifier model (cores + signatures).
 *
 * WHY THIS EXISTS (John, 2026-07-22): the first-generation overlays in
 * atom-composers/producers/remixers.js were SIGNATURE-DELTA ONLY — a handful of
 * outlier traits with no common body. Signature hoisting (Lever 1) then promoted
 * that outlier to the FRONT of the prompt with nothing underneath to contextualise
 * it, which is what produced quirky arrangements (Newman rendering as a bare
 * dulcimer/mallet ostinato; Liebrand as three garnishes and no body).
 *
 * THE MODEL
 *   Each modifier carries THREE CORES and THREE SIGNATURES.
 *     CORE      = the common, recurring body of that artist's sound. Multi-atom.
 *                 Emitted at priority 'core' so it survives reconcile and sits in
 *                 the arrangement properly rather than as decoration.
 *     SIGNATURE = the delta — the unmistakable tell. Multi-atom. Exactly one atom
 *                 per set flagged signature:true, which hoists to the front.
 *   ANY core combines with ANY signature (9 valid variants per modifier).
 *
 * HOW THE 9 COMBINATIONS ARE MADE SAFE — SLOT DISJOINTNESS
 *   A core and a signature must never contend for the same role slot, or reconcile
 *   drops one and the arrangement gets a hole. Rather than impose one global slot
 *   map on every artist (too rigid — some artists' tell genuinely IS the melody,
 *   others' is a texture), each modifier declares its OWN ownership:
 *       coreSlots  = roles every core of this modifier may use
 *       sigSlots   = roles every signature of this modifier may use
 *   and validate-modifiers.mjs asserts coreSlots ∩ sigSlots = ∅ and that every set
 *   stays inside its declared lane. Disjointness is then true BY CONSTRUCTION for
 *   all 9 combinations — no combinatorial luck required.
 *
 * SLOT-CORRECTNESS RULE (fixes a real bug found in gen-1)
 *   An OSTINATO IS NOT A LEAD. Newman's dulcimer/mallet figure was slotted
 *   role:'motif' in gen-1, so it displaced the character's actual lead melody.
 *   Ostinati, figures and stabs belong in colour/texture; only an actual melodic
 *   line belongs in motif.
 *
 * TAKEOVER
 *   Composers still seize no genre-owned family. REMIXERS may take bass and
 *   percussion layers, because re-played bass and added percussion ARE the remix
 *   craft — without them a remixer is only garnish (the gen-1 Liebrand failure).
 *   The drum KIT itself is still never replaced; remixer percussion layers OVER it.
 *
 * OUTPUT SHAPE
 *   resolveModifier() flattens (core + signature) into exactly the overlay shape
 *   the existing pipeline already consumes — { label, kind, family, congruence,
 *   atoms } — so atoms.js, reconcile, compose, DNA and the metatag engine need no
 *   changes at all. This module is additive.
 * ========================================================================*/

const ORCH_ANY = { lean:'any', engines:['Balearic','Enigma','Delerium','Era'],
                   takeover:{ bass:false, drums:false, harmony:false } };
const REMIX_ANY = { lean:'any', engines:null,
                    takeover:{ bass:true, drums:false, harmony:false } };

export const ATOM_MODIFIERS = {

  /* ======================================================================
   * THOMAS NEWMAN — orchestral composer.
   * Body: transparent, unhurried orchestral writing — warm mid-register strings,
   * reed and woodwind colour, harp, slow modal harmonic rhythm. Never dense.
   * Tell: the struck/plucked tuned-percussion ostinato ticking UNDER the melody.
   * coreSlots {strings, counter, harmony} / sigSlots {colour, motif, texture, arc}
   * ==================================================================== */
  composer_newman: {
    label: 'Thomas Newman', kind: 'composer', family: 'orchestral',
    congruence: ORCH_ANY,
    coreSlots: ['strings', 'counter', 'harmony'],
    sigSlots:  ['colour', 'motif', 'texture', 'arc'],

    cores: {
      // C1 — the warm chamber body (Shawshank / Road to Perdition lean).
      warm_chamber: { label: 'Warm string chamber', atoms: {
        mo_strings:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core',
                     instrument:'a warm mid-register string section' },
        mo_counter:{ role:'counter', family:'counter', fn:'answer', priority:'core',
                     instrument:'solo cor anglais' },
        mo_harm:   { role:'harmony', family:'harmony', fn:'chord-movement', priority:'core',
                     text:'modal Dorian movement resolving late and quietly onto the tonic' },
      }},
      // C2 — the airy pastel body (American Beauty / WALL-E lean).
      airy_pastel: { label: 'Airy woodwind pastel', atoms: {
        mo_strings:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core',
                     instrument:'thin transparent high strings' },
        mo_counter:{ role:'counter', family:'counter', fn:'answer', priority:'core',
                     instrument:'alto flute and bass clarinet' },
        mo_harm:   { role:'harmony', family:'harmony', fn:'chord-movement', priority:'core',
                     text:'slow plagal movement drifting between two chords' },
      }},
      // C3 — the low sustained body (1917 / Skyfall lean).
      low_sustain: { label: 'Low sustained and muted brass', atoms: {
        mo_strings:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core',
                     instrument:'sustained low strings' },
        mo_counter:{ role:'counter', family:'counter', fn:'answer', priority:'core',
                     instrument:'muted flugelhorn' },
        mo_harm:   { role:'harmony', family:'harmony', fn:'chord-movement', priority:'core',
                     text:'a suspended pedal tone with the harmony shifting slowly above it' },
      }},
    },

    signatures: {
      // S1 — the classic mallet ostinato. NOTE: colour, not motif (ostinato ≠ lead).
      mallet_ostinato: { label: 'Hammered-dulcimer and marimba ostinato', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true,
                    instrument:'a hammered-dulcimer and marimba ostinato ticking evenly under the melody' },
        mo_lead:  { role:'motif', family:'lead', fn:'foreground-melody', priority:'support',
                    instrument:'a sparse felt-piano motif stated plainly over the ostinato' },
        mo_arc:   { role:'arc', fn:'arc', priority:'support',
                    text:'the ostinato thinning away to nothing then returning alone' },
      }},
      // S2 — the prepared/plucked tell.
      prepared_pluck: { label: 'Prepared piano and pizzicato', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true,
                    instrument:'prepared-piano shimmer over a plucked pizzicato ostinato' },
        mo_lead:  { role:'motif', family:'lead', fn:'foreground-melody', priority:'support',
                    instrument:'a simple tack-piano line left to breathe between phrases' },
        mo_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'support',
                    instrument:'vibraphone and celesta sparkle held under the line' },
      }},
      // S3 — the exotic-colour tell.
      exotic_colour: { label: 'Cimbalom and exotic colour', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true,
                    instrument:'a cimbalom and bowed-psaltery figure threading through the texture' },
        mo_lead:  { role:'motif', family:'lead', fn:'foreground-melody', priority:'support',
                    instrument:'a duduk line carrying the melody long and unhurried' },
        mo_arc:   { role:'arc', fn:'arc', priority:'support',
                    text:'the exotic colour receding as the strings take the theme over' },
      }},
    },
  },

  /* ======================================================================
   * BEN LIEBRAND — remixer.
   * Body: 12-inch remix craft — rolling layered percussion over the intact kit,
   * a re-played prominent bassline, orchestral-hit and synth-brass stabs,
   * string-machine sweeps. This is the part gen-1 omitted entirely.
   * Tell: scratch/transformer cuts, the dramatic sampled fanfare, the re-edit.
   * coreSlots {perc, bass, texture} / sigSlots {colour, counter, arc}
   * ==================================================================== */
  remixer_liebrand: {
    label: 'Ben Liebrand', kind: 'remixer', family: 'remixer',
    congruence: REMIX_ANY,
    coreSlots: ['perc', 'bass', 'texture'],
    sigSlots:  ['colour', 'counter', 'arc'],

    cores: {
      // C1 — the classic 12-inch re-edit body.
      twelve_inch: { label: 'Classic 12-inch re-edit body', atoms: {
        mo_perc: { role:'perc', family:'perc', fn:'groove', priority:'core',
                   instrument:'rolling layered latin percussion' },
        mo_bass: { role:'bass', family:'bass', fn:'foundation-weight', priority:'core',
                   instrument:'a re-played melodic bassline', foundational:true },
        mo_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core',
                   instrument:'string-machine sweeps' },
      }},
      // C2 — the orchestral-hit dance body.
      hit_dance: { label: 'Orchestral-hit dance body', atoms: {
        mo_perc: { role:'perc', family:'perc', fn:'groove', priority:'core',
                   instrument:'crisp handclap layers and tom fills' },
        mo_bass: { role:'bass', family:'bass', fn:'foundation-weight', priority:'core',
                   instrument:'an octave-jumping synth bassline', foundational:true },
        mo_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core',
                   instrument:'sampled orchestral hits and bright synth-brass stabs' },
      }},
      // C3 — the dub/megamix body.
      dub_megamix: { label: 'Dub megamix body', atoms: {
        mo_perc: { role:'perc', family:'perc', fn:'groove', priority:'core',
                   instrument:'echoing tom rolls and delayed hand percussion' },
        mo_bass: { role:'bass', family:'bass', fn:'foundation-weight', priority:'core',
                   instrument:'a dubbed-out bassline', foundational:true },
        mo_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core',
                   instrument:'filtered breakdown pads' },
      }},
    },

    signatures: {
      // S1 — the scratch/transformer tell.
      scratch_cut: { label: 'Scratch and transformer cuts', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true,
                    instrument:'scratch-style synth stabs and transformer cut effects chopping across the beat' },
        mo_arc:   { role:'arc', fn:'arc', priority:'support',
                    text:'the arrangement cutting to a single stab then rebuilding' },
      }},
      // S2 — the dramatic sampled fanfare tell.
      fanfare_intro: { label: 'Dramatic sampled fanfare', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true,
                    instrument:'a dramatic sampled orchestral-hit and vocal-stab fanfare opening the bars' },
        mo_counter:{ role:'counter', family:'counter', fn:'answer', priority:'support',
                    instrument:'a stabbing synth-brass counter-line answering the hook' },
        mo_arc:   { role:'arc', fn:'arc', priority:'support',
                    text:'a cinematic intro bed opening out into the full groove' },
      }},
      // S3 — the extended re-edit tell.
      reedit_break: { label: 'Extended re-edit breakdown', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true,
                    instrument:'chopped and re-triggered vocal stabs threading through the mix' },
        mo_counter:{ role:'counter', family:'counter', fn:'answer', priority:'support',
                    instrument:'a filtered synth line rising through the breakdown' },
        mo_arc:   { role:'arc', fn:'arc', priority:'support',
                    text:'extended re-edited breakdowns that chop and rebuild the arrangement' },
      }},
    },
  },
};

/* ---- helpers --------------------------------------------------------------- */

export function modifierCores(modId) {
  const m = ATOM_MODIFIERS[modId]; if (!m) return [];
  return Object.keys(m.cores).map(id => ({ id, label: m.cores[id].label }));
}
export function modifierSignatures(modId) {
  const m = ATOM_MODIFIERS[modId]; if (!m) return [];
  return Object.keys(m.signatures).map(id => ({ id, label: m.signatures[id].label }));
}
export function modifierList() {
  return Object.keys(ATOM_MODIFIERS).map(id => ({
    id, label: ATOM_MODIFIERS[id].label, kind: ATOM_MODIFIERS[id].kind,
    cores: modifierCores(id), signatures: modifierSignatures(id),
  }));
}

/* resolveModifier — flatten (core + signature) into the legacy overlay shape the
 * existing pipeline already consumes. Defaults to the first core/signature.
 * Atom keys are namespaced per tier so a core and a signature can never overwrite
 * each other in the merged object even if both used the same internal key. */
export function resolveModifier(modId, coreId, sigId) {
  const m = ATOM_MODIFIERS[modId];
  if (!m) return null;
  const cId = (coreId && m.cores[coreId]) ? coreId : Object.keys(m.cores)[0];
  const sId = (sigId && m.signatures[sigId]) ? sigId : Object.keys(m.signatures)[0];
  const atoms = {};
  for (const [k, a] of Object.entries(m.cores[cId].atoms))      atoms[`core_${k}`] = a;
  for (const [k, a] of Object.entries(m.signatures[sId].atoms)) atoms[`sig_${k}`]  = a;
  return {
    label: m.label, kind: m.kind, family: m.family, congruence: m.congruence,
    atoms, coreId: cId, signatureId: sId,
    variantLabel: `${m.cores[cId].label} + ${m.signatures[sId].label}`,
  };
}

/* Every (core x signature) variant of a modifier — used by the UI panel and by
 * the validation harness. */
export function modifierVariants(modId) {
  const m = ATOM_MODIFIERS[modId]; if (!m) return [];
  const out = [];
  for (const c of Object.keys(m.cores))
    for (const s of Object.keys(m.signatures))
      out.push(resolveModifier(modId, c, s));
  return out;
}

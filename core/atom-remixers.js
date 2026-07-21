/* ==========================================================================
 * atom-remixers.js — the Remixer modifier overlays, ATOM-NATIVE.
 *
 * Third and final overlay arm (after Composers and Producers). Same model: each
 * remixer contributes a few SIGNATURE-DELTA atoms; reconcile drops collisions;
 * compose weaves the language. Artist names are UI LABELS ONLY — rendered text is
 * generic and carries the remix fingerprint, not the name.
 *
 * REMIXERS reshape ARRANGEMENT and DYNAMICS. Per the standing rule, overlays never
 * rewrite the genre-owned DRUM family, so the rhythm-reprogramming remixers
 * (Liebrand, Pettibone) express their signature as percussion / vocal-stab / arc
 * layers OVER the intact groove, not by replacing the kit. The one exception is a
 * FOUNDATIONAL BASS signature (Harris' funky sliding bassline) — allowed to seize
 * the bass family via takeover:{bass:true}, electronic-gated, exactly like the
 * composer Fidel/Moroder precedent.
 *
 * DISTINCTNESS: one signature:true atom each; the harness enforces uniqueness in
 * the lean cohort. Signatures hoist to the front (Lever 1).
 * ========================================================================*/

const REMIX_ANY  = { lean:'any', engines:null, takeover:{ bass:false, drums:false, harmony:false } };
const REMIX_ELEC = (takeover) => ({ lean:'electronic', engines:null,
                    takeover: Object.assign({ bass:false, drums:false, harmony:false }, takeover||{}) });

function remixer(label, congruence, atoms, negative) {
  return { label, kind:'remixer', family:'remixer', congruence, atoms, negative:negative||[] };
}

export const ATOM_REMIXERS = {

  // Guetta — a massive supersaw festival lead exploding on the drop (big-room).
  remixer_guetta: remixer('David Guetta', REMIX_ELEC(), {
    ov_lead:   { role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true,
                 instrument:'a massive supersaw festival lead exploding on the drop' },
    ov_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'support',
                 instrument:'stacked anthemic supersaw chord stabs' },
    ov_colour: { role:'colour', family:'colour', fn:'accent', priority:'support',
                 instrument:'filtered vocal chops' },
    ov_arc:    { role:'arc', fn:'arc', priority:'support',
                 text:'a long riser building to an explosive drop' },
  }),

  // Harris — a funky sliding synth bassline drives the groove (foundational bass).
  remixer_harris: remixer('Calvin Harris', REMIX_ELEC({ bass:true }), {
    ov_bass:   { role:'bass', family:'bass', fn:'foundation-drive', priority:'signature', signature:true, foundational:true, prominence:'foreground',
                 instrument:'a funky sliding synth bassline driving the groove' },
    ov_colour: { role:'colour', family:'colour', fn:'accent', priority:'support',
                 instrument:'glowy plucked electric-piano licks' },
    ov_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'support',
                 instrument:'breezy warm synth-stab pads' },
    ov_arc:    { role:'arc', fn:'arc', priority:'support',
                 text:'stripping to the bassline and groove then building the keys back in' },
  }),

  // Oliver Nelson — filtered disco-sample chops re-triggered into the hook (nu-disco).
  remixer_nelson: remixer('Oliver Nelson', REMIX_ELEC(), {
    ov_colour: { role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true,
                 instrument:'filtered disco-sample chops re-triggered into the hook' },
    ov_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'support',
                 instrument:'funky filtered disco-guitar licks' },
    ov_counter:{ role:'counter', family:'counter', fn:'answer', priority:'support',
                 instrument:'a bright plucky synth topline answering the lead' },
    ov_arc:    { role:'arc', fn:'arc', priority:'support',
                 text:'a feel-good discofied filter build into the lift' },
  }),

  // Liebrand — scratch-style stabs and transformer cut FX chopping the arrangement.
  remixer_liebrand: remixer('Ben Liebrand', REMIX_ANY, {
    ov_colour: { role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true,
                 instrument:'scratch-style synth stabs and transformer cut effects chopping across the beat' },
    ov_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'support',
                 instrument:'a dramatic sampled orchestral-hit and vocal-stab intro bed' },
    ov_arc:    { role:'arc', fn:'arc', priority:'support',
                 text:'extended re-edited breakdowns that chop and rebuild the arrangement' },
  }),

  // Pettibone — looped echo-drenched vocal stabs over an extended dub breakdown.
  remixer_pettibone: remixer('Shep Pettibone', REMIX_ANY, {
    ov_colour: { role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true,
                 instrument:'looped echo-drenched vocal stabs threading the mix' },
    ov_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'support',
                 instrument:'a bed of crisp layered latin hand percussion' },
    ov_arc:    { role:'arc', fn:'arc', priority:'support',
                 text:'a long dub breakdown stripping back then rebuilding' },
  }),

};

/* ==========================================================================
 * atom-producers.js — the Producer modifier overlays, ATOM-NATIVE.
 *
 * Ported from the prose-per-slot library (core/overlays.js PRODUCER table) into
 * the atom model, the same way the Composers were (core/atom-composers.js): each
 * producer contributes a few SIGNATURE-DELTA atoms into the holding area,
 * reconcile drops collisions, compose weaves the language. No prewritten full
 * prompt, no second prompt glued on.
 *
 * PRODUCERS vs COMPOSERS: a producer's fingerprint is a PRODUCTION treatment —
 * processing, backing-vocal stacks, sample treatment, mix character, dynamic arc.
 * So producers write into the non-owned finesse families only (texture / colour /
 * counter / harmony) plus the arc; they seize NO genre-owned family (bass, drums)
 * — takeover is all-false for every producer. That makes them strictly safer than
 * the composer arm (no Moroder-style foundational bass takeover here).
 *
 * RULES (unchanged, project-wide): artist names are UI LABELS ONLY — Suno strips
 * names, so the rendered text is generic and carries the PRODUCTION fingerprint,
 * not the name. No mood/affect words, no non-musical content.
 *
 * DISTINCTNESS: every producer carries exactly one atom flagged `signature:true`
 * — the one treatment that makes them unmistakable (the sidechain pump, the
 * chopped-vocal stabs, the wall of sound, the full-stop sampled stabs, ...). The
 * distinctness harness enforces each signature renders and is unique in its lean
 * cohort. A signature atom hoists to the front (Lever 1) via compose.
 *
 * CONGRUENCE: production polish is largely genre-neutral, so most producers are
 * lean:'any', engines:null. The two whose signature IS an electronic-production
 * gesture (Price's sidechain, Terry's house re-edit) are lean:'electronic' and
 * are refused on a non-electronic character by the lean gate — the same rule that
 * refuses Moroder on downtempo Balearic.
 * ========================================================================*/

const PROD_ANY  = { lean:'any',        engines:null, takeover:{ bass:false, drums:false, harmony:false } };
const PROD_ELEC = { lean:'electronic', engines:null, takeover:{ bass:false, drums:false, harmony:false } };

function producer(label, congruence, atoms, negative) {
  return { label, kind:'producer', family:'producer', congruence, atoms, negative:negative||[] };
}

export const ATOM_PRODUCERS = {

  // Price — a hard sidechain pump breathing the whole mix (electronic signature).
  producer_price: producer('Stuart Price', PROD_ELEC, {
    ov_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'signature', signature:true,
                 instrument:'a hard sidechain pump breathing the whole mix in time with the groove' },
    ov_colour: { role:'colour', family:'colour', fn:'accent', priority:'support',
                 instrument:'vocoded harmony doubles' },
    ov_arc:    { role:'arc', fn:'arc', priority:'support',
                 text:'filtering down to a long build then bursting open into the hook' },
  }),

  // Terry — chopped vocal-sample stabs re-triggered across the bar (house re-edit).
  producer_terry: producer('Todd Terry', PROD_ELEC, {
    ov_colour: { role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true,
                 instrument:'chopped vocal-sample stabs re-triggered across the bar' },
    ov_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'support',
                 instrument:'a bed of filtered loop stabs' },
    ov_arc:    { role:'arc', fn:'arc', priority:'support',
                 text:'stripping to the bare loop then dropping the full groove back in' },
  }),

  // Flood — everything blended into one saturated shimmering wall of sound.
  producer_flood: producer('Flood', PROD_ANY, {
    ov_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'signature', signature:true,
                 instrument:'synths and guitars blended into one saturated shimmering wall of sound' },
    ov_colour: { role:'colour', family:'colour', fn:'accent', priority:'support',
                 instrument:'grainy delays and filtered reverb tails' },
    ov_arc:    { role:'arc', fn:'arc', priority:'support',
                 text:'roomy ambience swelling and compressing as one mass' },
  }),

  // SAW — bright stacked backing-vocal harmonies around the hook. No 80s drums.
  producer_saw: producer('Stock Aitken Waterman', PROD_ANY, {
    ov_colour: { role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true,
                 instrument:'bright stacked layered backing-vocal harmonies built around the hook' },
    ov_harm:   { role:'harmony', family:'harmony', fn:'chord-movement', priority:'support',
                 text:'a simple bright diatonic progression built around the hook' },
    ov_arc:    { role:'arc', fn:'arc', priority:'support',
                 text:'a hook-first arrangement returning quickly to the chorus' },
  }, ['gated 80s drums', 'eighties drum machine']),

  // Mendelsohn — tight bright reverbs wrapping every part in a polished sheen.
  producer_mendelsohn: producer('Julian Mendelsohn', PROD_ANY, {
    ov_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'signature', signature:true,
                 instrument:'tight controlled bright reverbs wrapping every part in a polished sheen' },
    ov_colour: { role:'colour', family:'colour', fn:'accent', priority:'support',
                 instrument:'layered backing-vocal stacks' },
    ov_arc:    { role:'arc', fn:'arc', priority:'support',
                 text:'a punchy disciplined arrangement with a bright top end' },
  }),

  // Hague — bell-like synth counter-lines entering one part at a time (precision).
  producer_hague: producer('Stephen Hague', PROD_ANY, {
    ov_counter:{ role:'counter', family:'counter', fn:'answer', priority:'signature', signature:true,
                 instrument:'bell-like synth counter-lines entering one part at a time' },
    ov_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'support',
                 instrument:'a spacious digital sheen with controlled delays' },
    ov_arc:    { role:'arc', fn:'arc', priority:'support',
                 text:'a disciplined sequencer-locked arrangement with parts entering one at a time' },
  }),

  // Horn — sampled orchestral stabs and choir beds as an instrument; sudden stops.
  producer_horn: producer('Trevor Horn', PROD_ANY, {
    ov_colour: { role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true,
                 instrument:'sampled orchestral stabs and sampled choir beds played as a lead instrument, the arrangement snapping to sudden full stops' },
    ov_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'support',
                 instrument:'a high-gloss large-scale digital production bed' },
    ov_arc:    { role:'arc', fn:'arc', priority:'support',
                 text:'a layered build broken by sudden full stops then rebuilding' },
  }),

  // Quincy — rich extended jazz voicings through modulations and turnarounds.
  producer_quincy: producer('Quincy Jones', PROD_ANY, {
    ov_harm:   { role:'harmony', family:'harmony', fn:'chord-movement', priority:'signature', signature:true,
                 text:'rich extended jazz voicings moving through modulations and turnarounds' },
    ov_counter:{ role:'counter', family:'counter', fn:'answer', priority:'support',
                 instrument:'a horn section answering the lead in call-and-response' },
    ov_colour: { role:'colour', family:'colour', fn:'accent', priority:'support',
                 instrument:'stacked gospel-tinged backing harmonies' },
    ov_arc:    { role:'arc', fn:'arc', priority:'support',
                 text:'a wide arrangement over a deep controlled low end' },
  }),

};

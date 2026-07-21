/* ==========================================================================
 * atom-composers.js — the Composer modifier overlays, ATOM-NATIVE.
 *
 * Ported from the prose-per-slot library (core/overlays.js) into the atom model:
 * each composer contributes a few SIGNATURE-DELTA atoms into the holding area,
 * reconcile drops collisions, compose weaves the language. No prewritten full
 * prompt, no second prompt glued on.
 *
 * RULES (unchanged, project-wide): artist names are UI LABELS ONLY — Suno strips
 * names, so the rendered text is generic and carries the MUSICAL fingerprint, not
 * the name. No mood/affect words, no non-musical content. Composers seize NO
 * genre-owned family (bass/drums) EXCEPT the sequencer composers whose bass IS the
 * signature (Moroder, Fidel) — they carry a foundational bass that displaces.
 *
 * DISTINCTNESS: every composer carries exactly one atom flagged `signature:true`
 * (occasionally a second) — the one trait that makes them unmistakable even when
 * cluster-mates share a gesture (e.g. many "build to a brass climax", but only one
 * returns its theme TRANSFORMED, only one holds a STATIC centre under massed low
 * brass, etc.). The distinctness harness enforces each signature is unique.
 *
 * A signature atom hoists to the front (Lever 1) via compose; its instrument/text
 * therefore carries its own action phrase so it reads complete at the front.
 * ========================================================================*/

// orchestral composers apply over any lean but not over the ethnic engines.
const ORCH = { lean:'any', engines:['Balearic','Enigma','Delerium','Era'],
               takeover:{ bass:false, drums:false, harmony:false } };
// electronic composers impose synth-lead/timbre — refused on a non-electronic
// character by the lean gate (the Moroder-on-downtempo clash, generalised).
const ELEC = (takeover) => ({ lean:'electronic', engines:null,
               takeover: Object.assign({ bass:false, drums:false, harmony:false }, takeover||{}) });

function composer(label, kind, congruence, atoms) {
  return { label, kind:'composer', family:kind, congruence, atoms };
}

export const ATOM_COMPOSERS = {

  // ---- ORCHESTRAL ----------------------------------------------------------
  // Williams — thematic DEVELOPMENT: the motif returns transformed. That is the tell.
  composer_williams: composer('John Williams', 'orchestral', ORCH, {
    ov_lead:   { role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true,
                 instrument:'a long-form thematic melody developed and returning transformed at the climax' },
    ov_counter:{ role:'counter', family:'counter', fn:'answer', priority:'support',
                 instrument:'contrapuntal woodwind and horn lines against the theme' },
    ov_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'support',
                 instrument:'full-orchestra tutti with tremolo strings' },
    ov_harm:   { role:'harmony', family:'harmony', fn:'chord-movement', priority:'support',
                 text:'functional harmony with a bold modulation into a full cadence' },
    ov_arc:    { role:'arc', fn:'arc', priority:'support',
                 text:'the theme breaking down and returning transformed at the peak' },
  }),

  // Zimmer — STATIC harmonic centre + massed low-brass ostinato accumulation.
  composer_zimmer: composer('Hans Zimmer', 'orchestral', ORCH, {
    ov_lead:   { role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true,
                 instrument:'a massed low-brass ostinato motif accumulating in layers' },
    ov_counter:{ role:'counter', family:'counter', fn:'answer', priority:'support',
                 instrument:'a sixteenth-note string ostinato driving underneath' },
    ov_harm:   { role:'harmony', family:'harmony', fn:'chord-movement', priority:'support',
                 text:'a single harmonic centre held static while the layers stack' },
    ov_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'decorative',
                 instrument:'a synth-orchestra hybrid bed under the brass' },
    ov_arc:    { role:'arc', fn:'arc', priority:'support',
                 text:'a layered build to a huge unison then one resolving chord' },
  }),

  // Horner — soaring HIGH-string lyricism + ethnic wooden flute + wordless choir.
  composer_horner: composer('James Horner', 'orchestral', ORCH, {
    ov_lead:   { role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true,
                 instrument:'a soaring long-breathed melody high in the strings' },
    ov_counter:{ role:'counter', family:'counter', fn:'answer', priority:'support',
                 instrument:'a solo wooden flute answering the theme' },
    ov_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'support',
                 instrument:'a wordless choir held beneath the strings' },
    ov_colour: { role:'colour', family:'colour', fn:'accent', priority:'decorative',
                 instrument:'harp and celesta figures' },
    ov_harm:   { role:'harmony', family:'harmony', fn:'chord-movement', priority:'support',
                 text:'warm modal harmony resolving on a plagal cadence' },
  }),

  // Barry — silky sustained legato bed with the dynamics deliberately held back.
  composer_barry: composer('John Barry', 'orchestral', ORCH, {
    ov_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'signature', signature:true,
                 instrument:'silky sustained legato strings held as one unbroken bed with the dynamics reined in' },
    ov_lead:   { role:'motif', family:'lead', fn:'foreground-melody', priority:'support',
                 instrument:'a simple melody stated plainly and left to breathe' },
    ov_counter:{ role:'counter', family:'counter', fn:'answer', priority:'support',
                 instrument:'French horn and oboe accents answering the melody' },
    ov_harm:   { role:'harmony', family:'harmony', fn:'chord-movement', priority:'support',
                 text:'a slow tread of minor-to-major harmony resolving warmly' },
    ov_colour: { role:'colour', family:'colour', fn:'accent', priority:'decorative',
                 instrument:'muted brass and low woodwind' },
  }),

  // Goldsmith — angular chromaticism + inventive metallic/struck percussion.
  composer_goldsmith: composer('Jerry Goldsmith', 'orchestral', ORCH, {
    ov_harm:   { role:'harmony', family:'harmony', fn:'chord-movement', priority:'signature', signature:true,
                 text:'angular chromatic harmony wound tight before resolving firmly to the tonic' },
    ov_lead:   { role:'motif', family:'lead', fn:'foreground-melody', priority:'support',
                 instrument:'a terse repeated brass motif' },
    ov_counter:{ role:'counter', family:'counter', fn:'answer', priority:'support',
                 instrument:'a low woodwind ostinato under the theme' },
    ov_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'decorative',
                 instrument:'metallic struck percussion and clustered strings' },
    ov_arc:    { role:'arc', fn:'arc', priority:'support',
                 text:'tension wound tight then released on the final cadence' },
  }),

  // Newman — sparse marimba/hammered-dulcimer ostinato + prepared-piano shimmer.
  composer_newman: composer('Thomas Newman', 'orchestral', ORCH, {
    ov_lead:   { role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true,
                 instrument:'a sparse piano motif over hammered-dulcimer and mallet-percussion ostinato' },
    ov_counter:{ role:'counter', family:'counter', fn:'answer', priority:'support',
                 instrument:'a lone oboe line answering in the gaps' },
    ov_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'decorative',
                 instrument:'prepared-piano shimmer' },
    ov_colour: { role:'colour', family:'colour', fn:'accent', priority:'decorative',
                 instrument:'vibraphone and celesta sparkle' },
    ov_harm:   { role:'harmony', family:'harmony', fn:'chord-movement', priority:'support',
                 text:'modal Dorian movement resolving late and quietly onto the tonic' },
  }),

  // Nyman — baroque ground-bass minimalism + quaver pulse + amplified sax doubling.
  composer_nyman: composer('Michael Nyman', 'orchestral', ORCH, {
    ov_lead:   { role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true,
                 instrument:'an insistent unison melodic line doubled by saxophone an octave above over a baroque ground bass' },
    ov_harm:   { role:'harmony', family:'harmony', fn:'chord-movement', priority:'support',
                 text:'driving repeated modal chord cells over the ground bass' },
    ov_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'support',
                 instrument:'a mechanical quaver string pulse' },
    ov_arc:    { role:'arc', fn:'arc', priority:'support',
                 text:'repetition thickening in layers before a clean stop' },
  }),

  // Morricone — lone whistle/ocarina + wordless soprano + twang guitar in wide space.
  composer_morricone: composer('Ennio Morricone', 'orchestral', ORCH, {
    ov_lead:   { role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true,
                 instrument:'a lone whistled ocarina melody carrying the tune in wide open space' },
    ov_counter:{ role:'counter', family:'counter', fn:'answer', priority:'support',
                 instrument:'a wordless soprano answering the melody' },
    ov_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'support',
                 instrument:'sparse tremolo strings with a twanging reverbed guitar' },
    ov_colour: { role:'colour', family:'colour', fn:'accent', priority:'decorative',
                 instrument:'a distant trumpet call' },
    ov_harm:   { role:'harmony', family:'harmony', fn:'chord-movement', priority:'support',
                 text:'simple modal harmony with a wide plagal resolution' },
  }),

  // Goransson — a single hand-played motif looped and layered against itself.
  composer_goransson: composer('Ludwig Goransson', 'orchestral', ORCH, {
    ov_lead:   { role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true,
                 instrument:'a single hand-played motif looped and layered against itself' },
    ov_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'support',
                 instrument:'processed hybrid strings over an analog synth bed with a deep saturated low-end pulse' },
    ov_harm:   { role:'harmony', family:'harmony', fn:'chord-movement', priority:'support',
                 text:'spare modal harmony over a sustained low drone resolving to the root' },
    ov_arc:    { role:'arc', fn:'arc', priority:'support',
                 text:'one idea layered upward until it fills the field then settling' },
  }),

  // Dudley — sampled orchestral stabs + choir hits punched over a programmed groove.
  composer_dudley: composer('Anne Dudley', 'orchestral', ORCH, {
    ov_colour: { role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true,
                 instrument:'sampled orchestral stabs and choir hits punched over the groove' },
    ov_strings:{ role:'strings', family:'strings', fn:'support-bed', priority:'support',
                 instrument:'neo-classical strings with rich suspended voicings' },
    ov_lead:   { role:'motif', family:'lead', fn:'foreground-melody', priority:'support',
                 instrument:'a lyrical string theme carried over the programmed groove' },
    ov_arc:    { role:'arc', fn:'arc', priority:'support',
                 text:'live orchestra and sampled elements trading the foreground' },
  }),

  // Lloyd Webber — theatrical key-lift modulation into a restated singable theme.
  composer_lloydwebber: composer('Andrew Lloyd Webber', 'orchestral', ORCH, {
    ov_harm:   { role:'harmony', family:'harmony', fn:'chord-movement', priority:'signature', signature:true,
                 text:'theatrical harmony lifting through a key-change modulation into the final chorus' },
    ov_lead:   { role:'motif', family:'lead', fn:'foreground-melody', priority:'support',
                 instrument:'a broad singable theme restated in rising keys' },
    ov_counter:{ role:'counter', family:'counter', fn:'answer', priority:'support',
                 instrument:'a string counter-melody running against the lead' },
    ov_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'decorative',
                 instrument:'pit-orchestra strings with brass' },
    ov_arc:    { role:'arc', fn:'arc', priority:'support',
                 text:'building to a full theatrical final-chorus statement' },
  }),

  // Conti — rising major brass fanfare climbing to a triumphant horn statement.
  composer_conti: composer('Bill Conti', 'orchestral', ORCH, {
    ov_lead:   { role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true,
                 instrument:'a rising brass fanfare in the horns climbing to a triumphant statement' },
    ov_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'support',
                 instrument:'a punchy horn section over sustained strings' },
    ov_harm:   { role:'harmony', family:'harmony', fn:'chord-movement', priority:'support',
                 text:'rising major progressions resolving upward' },
    ov_arc:    { role:'arc', fn:'arc', priority:'support',
                 text:'a steady build to a full brass statement' },
  }),

  // Arnold — orchestral brass action riding an electronic rhythm bed underneath.
  composer_arnold: composer('David Arnold', 'orchestral', ORCH, {
    ov_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'signature', signature:true,
                 instrument:'orchestral brass and strings riding an electronic rhythm bed underneath' },
    ov_lead:   { role:'motif', family:'lead', fn:'foreground-melody', priority:'support',
                 instrument:'a thematic motif expanded into a full orchestral statement' },
    ov_counter:{ role:'counter', family:'counter', fn:'answer', priority:'support',
                 instrument:'intricate woodwind counter-melodies under the theme' },
    ov_colour: { role:'colour', family:'colour', fn:'accent', priority:'decorative',
                 instrument:'a warm brass fanfare' },
    ov_arc:    { role:'arc', fn:'arc', priority:'support',
                 text:'building to a massed orchestral crescendo then resolving' },
  }),

  // ---- ELECTRONIC ----------------------------------------------------------
  // Moroder — an unbroken sequenced arp-bass drives the whole track (foundational).
  composer_moroder: composer('Giorgio Moroder', 'electronic', ELEC({ bass:true, drums:true, harmony:true }), {
    ov_bass:   { role:'bass', family:'bass', fn:'foundation-drive', priority:'signature', signature:true, foundational:true, prominence:'foreground',
                 instrument:'an arpeggiated analog synth-bass sequence running unbroken and driving the whole track' },
    ov_harm:   { role:'harmony', family:'harmony', fn:'chord-movement', priority:'signature', signature:true,
                 text:'a simple minor vamp with filtered chord pumps' },
    ov_lead:   { role:'motif', family:'lead', fn:'foreground-melody', priority:'support',
                 instrument:'a filtered saw lead carrying the melody' },
    ov_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'decorative',
                 instrument:'shimmering analog pads' },
    ov_colour: { role:'colour', family:'perc-accent', fn:'accent', priority:'decorative',
                 instrument:'handclap and tambourine accents on the backbeat' },
    ov_arc:    { role:'arc', fn:'arc', priority:'support',
                 text:'the sequence running unbroken while the layers stack over it' },
  }),

  // Fidel — a static minor bass ostinato over cold metallic industrial pulses.
  composer_fidel: composer('Brad Fidel', 'electronic', ELEC({ bass:true }), {
    ov_bass:   { role:'bass', family:'bass', fn:'foundation-drive', priority:'signature', signature:true, foundational:true, prominence:'foreground',
                 instrument:'a static minor bass ostinato held long over cold metallic industrial pulses' },
    ov_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'support',
                 instrument:'icy digital pads' },
    ov_colour: { role:'colour', family:'colour', fn:'accent', priority:'decorative',
                 instrument:'filtered-noise swells and dissonant stabs' },
    ov_harm:   { role:'harmony', family:'harmony', fn:'chord-movement', priority:'support',
                 text:'a static minor centre held before a late, withheld resolution' },
    ov_arc:    { role:'arc', fn:'arc', priority:'support',
                 text:'mechanical tension building without release until the close' },
  }),

  // DiCola — a syncopated synth-brass hook + a hard key-change into an anthem.
  composer_dicola: composer('Vince DiCola', 'electronic', ELEC(), {
    ov_lead:   { role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true,
                 instrument:'a syncopated synth-brass melodic hook' },
    ov_harm:   { role:'harmony', family:'harmony', fn:'chord-movement', priority:'support',
                 text:'driving major-key progressions with a hard key-change modulation' },
    ov_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'support',
                 instrument:'stacked polysynth chords' },
    ov_arc:    { role:'arc', fn:'arc', priority:'support',
                 text:'a high-energy build into a full anthem statement' },
  }),

  // Vangelis — a sustained pitch-bent analog lead over vast layered pads.
  composer_vangelis: composer('Vangelis', 'electronic', ELEC(), {
    ov_lead:   { role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true,
                 instrument:'a long sustained analog lead shaped with expressive pitch bend' },
    ov_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'support',
                 instrument:'layered analog brass and choral synth washes with wide evolving chorus and long reverb tails' },
    ov_harm:   { role:'harmony', family:'harmony', fn:'chord-movement', priority:'support',
                 text:'slow drifting harmonic movement resolving softly' },
    ov_arc:    { role:'arc', fn:'arc', priority:'support',
                 text:'unfolding slowly across a vast field' },
  }),

  // Hammer — a bright synth lead played with guitar-style bends over rock minor.
  composer_hammer: composer('Jan Hammer', 'electronic', ELEC(), {
    ov_lead:   { role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true,
                 instrument:'a bright synth lead played with guitar-style bends' },
    ov_harm:   { role:'harmony', family:'harmony', fn:'chord-movement', priority:'support',
                 text:'rock-derived minor progressions' },
    ov_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'support',
                 instrument:'glassy FM pads with gated ambience and stereo delay throws' },
  }),

  // Faltermeyer — a bright staccato polysynth lead hook + punchy stacked stabs.
  composer_faltermeyer: composer('Harold Faltermeyer', 'electronic', ELEC(), {
    ov_lead:   { role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true,
                 instrument:'a bright staccato analog polysynth lead hook' },
    ov_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'support',
                 instrument:'punchy stacked polysynth stabs with clean bright chorus delays' },
    ov_harm:   { role:'harmony', family:'harmony', fn:'chord-movement', priority:'support',
                 text:'a simple major-to-minor vamp' },
  }),

};

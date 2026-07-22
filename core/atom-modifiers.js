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
// Electronic composers impose synth timbre — refused on a non-electronic
// character by the lean gate (the Moroder-on-downtempo clash, generalised).
const ELEC_ANY  = { lean:'electronic', engines:null,
                    takeover:{ bass:true, drums:false, harmony:false } };
// Production polish is largely genre-neutral; the two whose signature IS an
// electronic-production gesture are electronic-gated.
const PROD_ANY  = { lean:'any', engines:null,
                    takeover:{ bass:false, drums:false, harmony:false } };
const PROD_ELEC = { lean:'electronic', engines:null,
                    takeover:{ bass:false, drums:false, harmony:false } };
const REMIX_ELEC= { lean:'electronic', engines:null,
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
    coreSlots: ['strings', 'texture', 'pads'],
    sigSlots:  ['colour', 'motif', 'counter', 'arc'],

    cores: {
      // C1 — the warm chamber body (Shawshank / Road to Perdition lean).
      warm_chamber: { label: 'Warm string chamber', atoms: {
        mo_strings:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core',
                     instrument:'a warm mid-register string section' },
        mo_body:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core',
                     instrument:'a warm woodwind section' },
        mo_pads:{ role:'pads', family:'pad', fn:'sustain-under', priority:'core', instrument:'sustained woodwinds' },
      }},
      // C2 — the airy pastel body (American Beauty / WALL-E lean).
      airy_pastel: { label: 'Airy woodwind pastel', atoms: {
        mo_strings:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core',
                     instrument:'thin transparent high strings' },
        mo_body:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core',
                     instrument:'a low woodwind section' },
        mo_pads:{ role:'pads', family:'pad', fn:'sustain-under', priority:'core', instrument:'sustained celesta and harp, airy' },
      }},
      // C3 — the low sustained body (1917 / Skyfall lean).
      low_sustain: { label: 'Low sustained and muted brass', atoms: {
        mo_strings:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core',
                     instrument:'sustained low strings' },
        mo_body:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core',
                     instrument:'a muted brass section' },
        mo_pads:{ role:'pads', family:'pad', fn:'sustain-under', priority:'core', instrument:'a sustained muted brass section' },
      }},
    },

    signatures: {
      // S1 — the classic mallet ostinato. NOTE: colour, not motif (ostinato ≠ lead).
      mallet_ostinato: { label: 'Hammered-dulcimer and marimba ostinato', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true,
                    instrument:'a hammered-dulcimer and marimba ostinato, low in the mix under the melody' },
        mo_lead:  { role:'motif', family:'lead', fn:'foreground-melody', priority:'core',
                    instrument:'a sparse felt-piano motif' },
        mo_arc:   { role:'arc', fn:'arc', priority:'support',
                    text:'the ostinato drops out then returns alone' },
      }},
      // S2 — the prepared/plucked tell.
      prepared_pluck: { label: 'Prepared piano and pizzicato', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true,
                    instrument:'prepared-piano and plucked pizzicato ostinato, low in the mix' },
        mo_lead:  { role:'motif', family:'lead', fn:'foreground-melody', priority:'core',
                    instrument:'a spare tack-piano line' },
        mo_counter:{ role:'counter', family:'counter', fn:'answer', priority:'support',
                    instrument:'vibraphone and celesta under the melody' },
      }},
      // S3 — the exotic-colour tell.
      exotic_colour: { label: 'Cimbalom and exotic colour', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true,
                    instrument:'a cimbalom and bowed-psaltery figure through the texture' },
        mo_lead:  { role:'motif', family:'lead', fn:'foreground-melody', priority:'core',
                    instrument:'a long unhurried duduk line' },
        mo_arc:   { role:'arc', fn:'arc', priority:'support',
                    text:'the strings take over the theme' },
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
    coreSlots: ['perc', 'bass', 'texture', 'strings'],
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
                    instrument:'scratch-style synth stabs and transformer cut effects across the beat' },
        mo_arc:   { role:'arc', fn:'arc', priority:'support',
                    text:'the arrangement cuts to one stab then rebuilds' },
      }},
      // S2 — the dramatic sampled fanfare tell.
      fanfare_intro: { label: 'Dramatic sampled fanfare', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true,
                    instrument:'a dramatic sampled orchestral-hit and vocal-stab fanfare opening the bars' },
        mo_counter:{ role:'counter', family:'counter', fn:'answer', priority:'support',
                    instrument:'a stabbing synth-brass counter-line answering the hook' },
        mo_arc:   { role:'arc', fn:'arc', priority:'support',
                    text:'a cinematic intro bed into the full groove' },
      }},
      // S3 — the extended re-edit tell.
      reedit_break: { label: 'Extended re-edit breakdown', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true,
                    instrument:'chopped and re-triggered vocal stabs' },
        mo_counter:{ role:'counter', family:'counter', fn:'answer', priority:'support',
                    instrument:'a filtered synth line rising through the breakdown' },
        mo_arc:   { role:'arc', fn:'arc', priority:'support',
                    text:'extended re-edited breakdowns' },
      }},
    },
  },
  // Williams — thematic DEVELOPMENT is the tell: the motif returns transformed.
  composer_williams: {
    label: 'John Williams', kind: 'composer', family: 'orchestral',
    congruence: ORCH_ANY,
    coreSlots: ['strings', 'texture', 'pads'],
    sigSlots:  ['colour', 'motif', 'counter', 'arc'],
    cores: {
      full_tutti: { label: 'Full symphonic tutti', atoms: {
        mo_strings:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'a massed symphonic string section' },
        mo_body:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a horn section' },
        mo_pads:{ role:'pads', family:'pad', fn:'sustain-under', priority:'core', instrument:'a sustained brass chorale' },
      }},
      woodwind_adventure: { label: 'Woodwind adventure', atoms: {
        mo_strings:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'bright agile upper strings' },
        mo_body:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'flute and clarinet runs' },
        mo_pads:{ role:'pads', family:'pad', fn:'sustain-under', priority:'core', instrument:'a sustained woodwind ensemble' },
      }},
      dark_lowbrass: { label: 'Dark low brass and choir', atoms: {
        mo_strings:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'dark tremolo low strings' },
        mo_body:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'trombone and tuba' },
        mo_pads:{ role:'pads', family:'pad', fn:'sustain-under', priority:'core', instrument:'a sustained massed choir' },
      }},
    },
    signatures: {
      theme_transformed: { label: 'Theme returning transformed', atoms: {
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true, instrument:'a long-form thematic melody returning transformed at the climax' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'the theme returns transformed at the peak' },
      }},
      brass_fanfare: { label: 'Heroic brass fanfare', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'a heroic brass fanfare figure' },
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'core', instrument:'a broad noble horn melody' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'a rising build into a full brass statement' },
      }},
      wonder_motif: { label: 'Celesta wonder motif', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'celesta and harp over the harmony' },
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'core', instrument:'a delicate solo flute melody' },
        mo_counter:{ role:'counter', family:'counter', fn:'answer', priority:'support', instrument:'a wordless childrens choir' },
      }},
    },
  },

  // Zimmer — a STATIC harmonic centre with layers accumulating over it.
  composer_zimmer: {
    label: 'Hans Zimmer', kind: 'composer', family: 'orchestral',
    congruence: ORCH_ANY,
    coreSlots: ['strings', 'texture', 'pads'],
    sigSlots:  ['colour', 'motif', 'counter', 'arc'],
    cores: {
      lowbrass_hybrid: { label: 'Massed low brass and hybrid bed', atoms: {
        mo_strings:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'sustained low strings' },
        mo_body:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a massed low-brass section' },
        mo_pads:{ role:'pads', family:'pad', fn:'sustain-under', priority:'core', instrument:'a hybrid synth-orchestra pad' },
      }},
      ostinato_perc: { label: 'String ostinato and percussion', atoms: {
        mo_strings:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'a sixteenth-note string ostinato' },
        mo_body:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'taiko and orchestral percussion' },
        mo_pads:{ role:'pads', family:'pad', fn:'sustain-under', priority:'core', instrument:'a sustained brass pad' },
      }},
      solo_cello: { label: 'Solo cello over sustained pad', atoms: {
        mo_strings:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'a solo cello over a sustained string bed' },
        mo_body:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a synth-orchestra hybrid layer' },
        mo_pads:{ role:'pads', family:'pad', fn:'sustain-under', priority:'core', instrument:'a deep sustained synth pad' },
      }},
    },
    signatures: {
      accumulation: { label: 'Layered accumulation', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'stacked ostinato layers building bar by bar' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'builds to a unison then one resolving chord' },
      }},
      brass_swell: { label: 'Low-brass swell', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'a low-brass swell under the harmony' },
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'core', instrument:'a weighty two-note brass motif' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'a slow crescendo to one sustained hit' },
      }},
      ticking_pulse: { label: 'Ticking clock pulse', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'a ticking clock-like pulse' },
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'core', instrument:'a simple rising four-note motif' },
        mo_counter:{ role:'counter', family:'counter', fn:'answer', priority:'support', instrument:'a shepard-tone riser bed' },
      }},
    },
  },

  // Horner — soaring long-breathed lyricism, ethnic flute, wordless voice.
  composer_horner: {
    label: 'James Horner', kind: 'composer', family: 'orchestral',
    congruence: ORCH_ANY,
    coreSlots: ['strings', 'texture', 'pads'],
    sigSlots:  ['colour', 'motif', 'counter', 'arc'],
    cores: {
      high_lyric: { label: 'High string lyricism', atoms: {
        mo_strings:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'soaring high strings' },
        mo_body:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'French horn' },
        mo_pads:{ role:'pads', family:'pad', fn:'sustain-under', priority:'core', instrument:'sustained harp and celesta' },
      }},
      ethnic_choir: { label: 'Ethnic flute and choir', atoms: {
        mo_strings:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'warm mid-register strings' },
        mo_body:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a massed wooden-flute ensemble' },
        mo_pads:{ role:'pads', family:'pad', fn:'sustain-under', priority:'core', instrument:'a wordless choir bed' },
      }},
      danger_brass: { label: 'Low brass and timpani', atoms: {
        mo_strings:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'dark sustained low strings' },
        mo_body:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'low brass and timpani' },
        mo_pads:{ role:'pads', family:'pad', fn:'sustain-under', priority:'core', instrument:'a sustained dark brass section' },
      }},
    },
    signatures: {
      long_breath: { label: 'Soaring long-breathed melody', atoms: {
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true, instrument:'a soaring long-breathed melody high in the strings' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'the melody rises to one sustained peak' },
      }},
      wordless_soprano: { label: 'Wordless solo soprano', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'a wordless solo soprano above the orchestra' },
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'core', instrument:'a folk-like shakuhachi melody' },
        mo_counter:{ role:'counter', family:'counter', fn:'answer', priority:'support', instrument:'a distant wordless vocal layer' },
      }},
      four_note: { label: 'Four-note danger motif', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'a four-note descending brass motif' },
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'core', instrument:'an urgent high string line' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'the motif returns louder each time' },
      }},
    },
  },

  // Barry — restraint IS the signature: sustained, level, unhurried.
  composer_barry: {
    label: 'John Barry', kind: 'composer', family: 'orchestral',
    congruence: ORCH_ANY,
    coreSlots: ['strings', 'texture', 'pads'],
    sigSlots:  ['colour', 'motif', 'counter', 'arc'],
    cores: {
      legato_bed: { label: 'Silky legato string bed', atoms: {
        mo_strings:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'silky sustained legato strings' },
        mo_body:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'French horn and oboe' },
        mo_pads:{ role:'pads', family:'pad', fn:'sustain-under', priority:'core', instrument:'a soft vibraphone and harp bed' },
      }},
      chamber_horn: { label: 'Horn and oboe chamber', atoms: {
        mo_strings:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'a small warm string ensemble' },
        mo_body:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a double-reed section' },
        mo_pads:{ role:'pads', family:'pad', fn:'sustain-under', priority:'core', instrument:'a sustained warm horn section' },
      }},
      brass_swagger: { label: 'Brass swagger and twang', atoms: {
        mo_strings:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'punchy staccato strings' },
        mo_body:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a muted trumpet section' },
        mo_pads:{ role:'pads', family:'pad', fn:'sustain-under', priority:'core', instrument:'a sustained low brass section' },
      }},
    },
    signatures: {
      held_back: { label: 'Dynamics reined in', atoms: {
        mo_counter:{ role:'counter', family:'counter', fn:'answer', priority:'signature', signature:true, instrument:'a sustained string bed, even dynamics' },
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'core', instrument:'a plain unadorned melody' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'dynamics stay level throughout' },
      }},
      plain_theme: { label: 'Plain lyrical theme', atoms: {
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true, instrument:'a broad lyrical melody carried on solo horn' },
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'support', instrument:'vibraphone shimmer' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'one long statement, no climax' },
      }},
      brass_stabs: { label: 'Sharp brass stabs', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'sharp syncopated brass stabs punctuating the bars' },
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'core', instrument:'a twanging surf-guitar melody' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'a taut vamp, no release' },
      }},
    },
  },

  // Goldsmith — orchestra fused with early electronics and exotic percussion.
  composer_goldsmith: {
    label: 'Jerry Goldsmith', kind: 'composer', family: 'orchestral',
    congruence: ORCH_ANY,
    coreSlots: ['strings', 'texture', 'pads'],
    sigSlots:  ['colour', 'motif', 'counter', 'arc'],
    cores: {
      angular_brass: { label: 'Angular brass and strings', atoms: {
        mo_strings:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'angular staccato strings' },
        mo_body:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a stabbing brass section' },
        mo_pads:{ role:'pads', family:'pad', fn:'sustain-under', priority:'core', instrument:'sustained string clusters' },
      }},
      orch_electronics: { label: 'Orchestra and analog electronics', atoms: {
        mo_strings:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'sustained string clusters' },
        mo_body:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'an analog synth layer under the orchestra' },
        mo_pads:{ role:'pads', family:'pad', fn:'sustain-under', priority:'core', instrument:'an analog electronic pad bed' },
      }},
      exotic_woodwind: { label: 'Exotic percussion and woodwind', atoms: {
        mo_strings:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'light transparent strings' },
        mo_body:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'bass flute and contrabassoon' },
        mo_pads:{ role:'pads', family:'pad', fn:'sustain-under', priority:'core', instrument:'sustained low reeds and contrabassoon' },
      }},
    },
    signatures: {
      asym_ostinato: { label: 'Driving asymmetric ostinato', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'a driving asymmetric ostinato across the bar' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'the ostinato tightens as layers stack' },
      }},
      shimmer_colour: { label: 'Shimmering electronic colour', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'a shimmering metallic electronic sweep' },
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'core', instrument:'a stark solo horn motif' },
        mo_counter:{ role:'counter', family:'counter', fn:'answer', priority:'support', instrument:'a bed of bowed metal and echo' },
      }},
      noble_horn: { label: 'Noble horn theme', atoms: {
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true, instrument:'a noble expansive melody carried by the horns' },
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'support', instrument:'log drums and exotic hand percussion' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'the theme opens into a full orchestral statement' },
      }},
    },
  },

  // Nyman — baroque ground-bass minimalism with a hammering pulse.
  composer_nyman: {
    label: 'Michael Nyman', kind: 'composer', family: 'orchestral',
    congruence: ORCH_ANY,
    coreSlots: ['strings', 'texture', 'pads'],
    sigSlots:  ['colour', 'motif', 'counter', 'arc'],
    cores: {
      reed_band: { label: 'Amplified reed band', atoms: {
        mo_strings:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'a string quartet' },
        mo_body:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'an amplified saxophone section' },
        mo_pads:{ role:'pads', family:'pad', fn:'sustain-under', priority:'core', instrument:'sustained massed reeds' },
      }},
      string_piano: { label: 'String ensemble and piano', atoms: {
        mo_strings:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'a tight string ensemble' },
        mo_body:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a percussive piano part' },
        mo_pads:{ role:'pads', family:'pad', fn:'sustain-under', priority:'core', instrument:'a sustained string ensemble' },
      }},
      baroque_chamber: { label: 'Harpsichord chamber', atoms: {
        mo_strings:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'a baroque-styled string band' },
        mo_body:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a baroque continuo section' },
        mo_pads:{ role:'pads', family:'pad', fn:'sustain-under', priority:'core', instrument:'a sustained chamber organ' },
      }},
    },
    signatures: {
      ground_bass: { label: 'Baroque ground-bass figure', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'a repeating baroque ground-bass figure underneath' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'the same cycle repeats, layers added' },
      }},
      quaver_drive: { label: 'Hammering quaver pulse', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'a hammering quaver pulse every bar' },
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'core', instrument:'a stark repeated melodic cell' },
        mo_counter:{ role:'counter', family:'counter', fn:'answer', priority:'support', instrument:'massed sustained reeds' },
      }},
      piano_minimal: { label: 'Minimal piano figure', atoms: {
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true, instrument:'a spare repeating piano melody' },
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'support', instrument:'pizzicato string punctuation' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'one figure repeats and thickens' },
      }},
    },
  },

  // Morricone — the whistle, the vocalise, the twang against lush strings.
  composer_morricone: {
    label: 'Ennio Morricone', kind: 'composer', family: 'orchestral',
    congruence: ORCH_ANY,
    coreSlots: ['strings', 'texture', 'pads'],
    sigSlots:  ['colour', 'motif', 'counter', 'arc'],
    cores: {
      lush_choir: { label: 'Lush strings and choir', atoms: {
        mo_strings:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'lush sweeping strings' },
        mo_body:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a wordless mixed choir' },
        mo_pads:{ role:'pads', family:'pad', fn:'sustain-under', priority:'core', instrument:'a wordless mixed choir bed' },
      }},
      twang_trumpet: { label: 'Twang guitar and trumpet', atoms: {
        mo_strings:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'tense tremolo strings' },
        mo_body:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a lone mariachi trumpet' },
        mo_pads:{ role:'pads', family:'pad', fn:'sustain-under', priority:'core', instrument:'a sustained tremolo string bed' },
      }},
      chamber_reed: { label: 'Chamber woodwind', atoms: {
        mo_strings:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'a small chamber string group' },
        mo_body:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a chamber woodwind section' },
        mo_pads:{ role:'pads', family:'pad', fn:'sustain-under', priority:'core', instrument:'sustained chamber woodwinds' },
      }},
    },
    signatures: {
      whistle_motif: { label: 'Whistled ocarina melody', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:' a whistled ocarina line through the texture' },
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'core', instrument:'a plaintive twanging electric guitar line' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'the whistle answers across the empty bars' },
      }},
      soprano_vocalise: { label: 'Soprano vocalise', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'a wordless soprano vocalise over the orchestra' },
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'core', instrument:'a long aching solo string melody' },
        mo_counter:{ role:'counter', family:'counter', fn:'answer', priority:'support', instrument:'a hushed sustained choir' },
      }},
      jews_harp: { label: 'Jews-harp and percussion', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'jews-harp and hand percussion accents' },
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'core', instrument:'a terse solo trumpet motif' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'a tightening vamp then a full entry' },
      }},
    },
  },
  // Goransson — hybrid orchestra, African percussion, saturated brass.
  composer_goransson: {
    label: 'Ludwig Goransson', kind: 'composer', family: 'orchestral',
    congruence: ORCH_ANY,
    coreSlots: ['strings', 'texture', 'pads'],
    sigSlots:  ['colour', 'motif', 'counter', 'arc'],
    cores: {
      hybrid_bed: { label: 'Hybrid orchestra and synth', atoms: {
        mo_strings:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'sustained hybrid strings' },
        mo_body:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a distorted brass layer' },
        mo_pads:{ role:'pads', family:'pad', fn:'sustain-under', priority:'core', instrument:'a granular synth-orchestra pad' },
      }},
      tribal_low: { label: 'Tribal percussion and low strings', atoms: {
        mo_strings:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'deep low strings' },
        mo_body:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'massed tribal drums' },
        mo_pads:{ role:'pads', family:'pad', fn:'sustain-under', priority:'core', instrument:'a sustained deep brass section' },
      }},
      sparse_solo: { label: 'Sparse solo and pad', atoms: {
        mo_strings:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'a thin high string line' },
        mo_body:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a processed cello section' },
        mo_pads:{ role:'pads', family:'pad', fn:'sustain-under', priority:'core', instrument:'a warm sustained synth pad' },
      }},
    },
    signatures: {
      talking_drum: { label: 'Talking-drum figure', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'a talking-drum and shaker figure' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'the percussion thickens bar by bar' },
      }},
      distorted_brass: { label: 'Distorted brass', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'a distorted saturated brass blast' },
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'core', instrument:'a terse low horn motif' },
        mo_counter:{ role:'counter', family:'counter', fn:'answer', priority:'support', instrument:'a granular processed orchestral bed' },
      }},
      processed_chant: { label: 'Processed vocal chant', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'a looped processed group vocal chant' },
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'core', instrument:'a simple modal solo flute melody' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'the chant builds into a full unison' },
      }},
    },
  },

  // Dudley — orchestral craft crossed with sampled stab production.
  composer_dudley: {
    label: 'Anne Dudley', kind: 'composer', family: 'orchestral',
    congruence: ORCH_ANY,
    coreSlots: ['strings', 'texture', 'pads'],
    sigSlots:  ['colour', 'motif', 'counter', 'arc'],
    cores: {
      orch_brass: { label: 'Orchestral strings and brass', atoms: {
        mo_strings:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'a bright full string section' },
        mo_body:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a punchy brass section' },
        mo_pads:{ role:'pads', family:'pad', fn:'sustain-under', priority:'core', instrument:'a sustained bright brass section' },
      }},
      chamber_piano: { label: 'Chamber strings and piano', atoms: {
        mo_strings:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'an intimate chamber string group' },
        mo_body:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'layered piano and sustained strings' },
        mo_pads:{ role:'pads', family:'pad', fn:'sustain-under', priority:'core', instrument:'sustained celesta and harp' },
      }},
      choir_orch: { label: 'Choir and orchestra', atoms: {
        mo_strings:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'warm sustained strings' },
        mo_body:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a full mixed choir' },
        mo_pads:{ role:'pads', family:'pad', fn:'sustain-under', priority:'core', instrument:'a sustained mixed choir' },
      }},
    },
    signatures: {
      sampled_stabs: { label: 'Sampled orchestral stabs', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'sampled orchestral stabs across the beat' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'the stabs break the arrangement into blocks' },
      }},
      pizz_playful: { label: 'Playful pizzicato', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'playful pizzicato string figures through the bars' },
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'core', instrument:'a light solo oboe melody' },
        mo_counter:{ role:'counter', family:'counter', fn:'answer', priority:'support', instrument:'celesta and glockenspiel sparkle' },
      }},
      gospel_lift: { label: 'Gospel choir lift', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'a gospel choir answering in block harmony' },
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'core', instrument:'a soulful solo saxophone melody' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'a lift into a full choir and orchestra final chorus' },
      }},
    },
  },

  // Lloyd Webber — theatrical melody written to carry a room.
  composer_lloydwebber: {
    label: 'Andrew Lloyd Webber', kind: 'composer', family: 'orchestral',
    congruence: ORCH_ANY,
    coreSlots: ['strings', 'texture', 'pads'],
    sigSlots:  ['colour', 'motif', 'counter', 'arc'],
    cores: {
      theatrical: { label: 'Theatrical string orchestra', atoms: {
        mo_strings:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'a sweeping theatrical string orchestra' },
        mo_body:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a full brass section' },
        mo_pads:{ role:'pads', family:'pad', fn:'sustain-under', priority:'core', instrument:'sustained massed brass and choir' },
      }},
      rock_hybrid: { label: 'Rock band and orchestra', atoms: {
        mo_strings:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'urgent staccato strings' },
        mo_body:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'overdriven electric guitar' },
        mo_pads:{ role:'pads', family:'pad', fn:'sustain-under', priority:'core', instrument:'a sustained organ' },
      }},
      ballad_piano: { label: 'Ballad piano and strings', atoms: {
        mo_strings:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'warm lush strings' },
        mo_body:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'layered piano and sustained strings' },
        mo_pads:{ role:'pads', family:'pad', fn:'sustain-under', priority:'core', instrument:'a sustained warm string section' },
      }},
    },
    signatures: {
      soaring_theme: { label: 'Soaring theatrical melody', atoms: {
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true, instrument:'a soaring theatrical melody' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'the melody restated a tone higher for the final chorus' },
      }},
      pipe_organ: { label: 'Dramatic pipe organ', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'a dramatic pipe-organ entry' },
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'core', instrument:'a bold descending melodic line' },
        mo_counter:{ role:'counter', family:'counter', fn:'answer', priority:'support', instrument:'a sustained massed choir' },
      }},
      keychange_lift: { label: 'Key-change lift', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'a cascading harp and string run into the lift' },
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'core', instrument:'a broad anthemic massed string melody' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'a key-change lift into the last chorus' },
      }},
    },
  },

  // Conti — the triumphant fanfare and the funk-inflected horn section.
  composer_conti: {
    label: 'Bill Conti', kind: 'composer', family: 'orchestral',
    congruence: ORCH_ANY,
    coreSlots: ['strings', 'texture', 'pads'],
    sigSlots:  ['colour', 'motif', 'counter', 'arc'],
    cores: {
      brass_strings: { label: 'Brass section and strings', atoms: {
        mo_strings:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'bright punchy strings' },
        mo_body:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a tight brass section' },
        mo_pads:{ role:'pads', family:'pad', fn:'sustain-under', priority:'core', instrument:'a sustained horn section' },
      }},
      funk_horns: { label: 'Funky rhythm and horns', atoms: {
        mo_strings:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'stabbing rhythmic strings' },
        mo_body:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a funk horn section' },
        mo_pads:{ role:'pads', family:'pad', fn:'sustain-under', priority:'core', instrument:'a sustained electric piano' },
      }},
      lyric_piano: { label: 'Lyrical strings and piano', atoms: {
        mo_strings:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'warm lyrical strings' },
        mo_body:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'layered piano and sustained strings' },
        mo_pads:{ role:'pads', family:'pad', fn:'sustain-under', priority:'core', instrument:'a sustained soft string section' },
      }},
    },
    signatures: {
      trumpet_fanfare: { label: 'Triumphant trumpet fanfare', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'a triumphant trumpet fanfare over the arrangement' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'a build from one line to a full brass statement' },
      }},
      horn_riff: { label: 'Driving horn riff', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'a driving syncopated horn riff' },
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'core', instrument:'a bold trumpet-doubled melody' },
        mo_counter:{ role:'counter', family:'counter', fn:'answer', priority:'support', instrument:'sustained brass pads' },
      }},
      tender_piano: { label: 'Tender piano theme', atoms: {
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true, instrument:'a tender unhurried melody on solo piano' },
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'support', instrument:'soft string swells answering the piano' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'a build from solo piano to full orchestra' },
      }},
    },
  },

  // Arnold — brass stabs, surf twang, big modern cinematic weight.
  composer_arnold: {
    label: 'David Arnold', kind: 'composer', family: 'orchestral',
    congruence: ORCH_ANY,
    coreSlots: ['strings', 'texture', 'pads'],
    sigSlots:  ['colour', 'motif', 'counter', 'arc'],
    cores: {
      big_brass: { label: 'Big brass and strings', atoms: {
        mo_strings:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'wide cinematic strings' },
        mo_body:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a massive brass section' },
        mo_pads:{ role:'pads', family:'pad', fn:'sustain-under', priority:'core', instrument:'a sustained wide brass section' },
      }},
      orch_beats: { label: 'Orchestra and electronic beats', atoms: {
        mo_strings:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'urgent staccato strings' },
        mo_body:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'an electronic synth layer under the orchestra' },
        mo_pads:{ role:'pads', family:'pad', fn:'sustain-under', priority:'core', instrument:'a glossy synth pad' },
      }},
      sultry_sax: { label: 'Sultry sax and strings', atoms: {
        mo_strings:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'smoky sustained strings' },
        mo_body:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a saxophone section' },
        mo_pads:{ role:'pads', family:'pad', fn:'sustain-under', priority:'core', instrument:'a sustained smoky string section' },
      }},
    },
    signatures: {
      bond_stabs: { label: 'Sharp brass stabs', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'sharp syncopated brass stabs punching across the groove' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'stabs on every turnaround' },
      }},
      surf_guitar: { label: 'Twangy surf guitar', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'a twanging tremolo surf guitar line' },
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'core', instrument:'a suave muted trumpet melody' },
        mo_counter:{ role:'counter', family:'counter', fn:'answer', priority:'support', instrument:'shimmering vibraphone and strings' },
      }},
      diva_vocalise: { label: 'Diva vocalise', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'a soaring wordless female vocalise over the orchestra' },
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'core', instrument:'a broad massed string melody' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'a full orchestral swell into the final statement' },
      }},
    },
  },
  // Moroder — the sequenced octave bassline IS the signature (bass takeover).
  composer_moroder: {
    label: 'Giorgio Moroder', kind: 'composer', family: 'electronic',
    congruence: ELEC_ANY,
    coreSlots: ['texture', 'texture', 'pads', 'strings'],
    sigSlots:  ['bass', 'motif', 'colour', 'arc'],
    cores: {
      arp_strings: { label: 'Arpeggiated synth and strings', atoms: {
        mo_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a pulsing arpeggiated synth bed' },
        mo_body:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'sweeping disco strings' },
        mo_pads:{ role:'pads', family:'pad', fn:'sustain-under', priority:'core', instrument:'a warm analog pad' },
      }},
      vocoder_brass: { label: 'Vocoder pad and synth brass', atoms: {
        mo_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a vocoder choir pad' },
        mo_body:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'a punchy synth-brass section' },
        mo_pads:{ role:'pads', family:'pad', fn:'sustain-under', priority:'core', instrument:'a bright sustained pad' },
      }},
      analog_filter: { label: 'Analog lead and filtered pads', atoms: {
        mo_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'warm filtered analog pads' },
        mo_body:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'a resonant filtered synth layer' },
        mo_pads:{ role:'pads', family:'pad', fn:'sustain-under', priority:'core', instrument:'a soft resonant pad bed' },
      }},
    },
    signatures: {
      sequenced_bass: { label: 'Sequenced octave bassline', atoms: {
        mo_bass:{ role:'bass', family:'bass', fn:'foundation-weight', priority:'signature', signature:true, foundational:true, instrument:'a relentless sequenced octave synth bassline' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'the sequence runs unbroken, layers enter over it' },
      }},
      analog_lead: { label: 'Soaring analog lead', atoms: {
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true, instrument:'a soaring analog synth lead over the sequence' },
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'support', instrument:'bright synth-brass punctuation' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'a long filter opening into a full-energy peak' },
      }},
      filter_arp: { label: 'Filtered arpeggio sweep', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'a filtered arpeggio sweeping open across the bars' },
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'core', instrument:'a simple insistent synth melody' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'the filter slowly opening then closing again' },
      }},
    },
  },

  // Fidel — industrial metal percussion and a pounding bass ostinato.
  composer_fidel: {
    label: 'Brad Fidel', kind: 'composer', family: 'electronic',
    congruence: ELEC_ANY,
    coreSlots: ['texture', 'texture', 'pads', 'strings'],
    sigSlots:  ['bass', 'motif', 'colour', 'arc'],
    cores: {
      dark_metal: { label: 'Dark pad and metallic texture', atoms: {
        mo_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a dark brooding synth pad' },
        mo_body:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'a metallic struck-steel layer' },
        mo_pads:{ role:'pads', family:'pad', fn:'sustain-under', priority:'core', instrument:'a cold sustained synth pad' },
      }},
      low_drone: { label: 'Low drone and sparse synth', atoms: {
        mo_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a low sustained drone bed' },
        mo_body:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'a sparse cold synth line' },
        mo_pads:{ role:'pads', family:'pad', fn:'sustain-under', priority:'core', instrument:'a deep drone pad' },
      }},
      choir_pad: { label: 'Synth choir and string pad', atoms: {
        mo_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a synthetic choir pad' },
        mo_body:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'a cold synth string layer' },
        mo_pads:{ role:'pads', family:'pad', fn:'sustain-under', priority:'core', instrument:'a synthetic choir bed' },
      }},
    },
    signatures: {
      industrial_bass: { label: 'Industrial pounding bass', atoms: {
        mo_bass:{ role:'bass', family:'bass', fn:'foundation-weight', priority:'signature', signature:true, foundational:true, instrument:'a pounding industrial synth bass ostinato' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'the ostinato stays unchanged underneath' },
      }},
      anvil_hits: { label: 'Metallic anvil hits', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'metallic anvil hits on the downbeat' },
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'core', instrument:'a stark descending synth motif' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'a build of stacking metallic layers' },
      }},
      descend_motif: { label: 'Descending synth motif', atoms: {
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true, instrument:'a cold descending synth melody' },
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'support', instrument:'sheet-metal scrapes and struck steel accents' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'a slow crescendo, no release' },
      }},
    },
  },

  // DiCola — 80s synth-brass power riffs and relentless energy.
  composer_dicola: {
    label: 'Vince DiCola', kind: 'composer', family: 'electronic',
    congruence: ELEC_ANY,
    coreSlots: ['texture', 'texture', 'pads', 'strings'],
    sigSlots:  ['bass', 'motif', 'colour', 'arc'],
    cores: {
      synth_brass: { label: 'Synth brass and gated pad', atoms: {
        mo_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a big gated synth pad' },
        mo_body:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'a stacked synth-brass section' },
        mo_pads:{ role:'pads', family:'pad', fn:'sustain-under', priority:'core', instrument:'a wide gated synth pad' },
      }},
      rock_synth: { label: 'Rock guitar and synth', atoms: {
        mo_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a wide chorused synth bed' },
        mo_body:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'overdriven electric guitar' },
        mo_pads:{ role:'pads', family:'pad', fn:'sustain-under', priority:'core', instrument:'a chorused synth pad' },
      }},
      piano_orch: { label: 'Piano and orchestral synth', atoms: {
        mo_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'sustained orchestral strings' },
        mo_body:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'layered piano and sustained synth' },
        mo_pads:{ role:'pads', family:'pad', fn:'sustain-under', priority:'core', instrument:'a lush orchestral synth pad' },
      }},
    },
    signatures: {
      power_riff: { label: 'Driving synth-brass riff', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'a driving synth-brass power riff' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'a relentless build into the final chorus' },
      }},
      octave_drive: { label: 'Octave synth bass drive', atoms: {
        mo_bass:{ role:'bass', family:'bass', fn:'foundation-weight', priority:'signature', signature:true, foundational:true, instrument:'a driving octave synth bassline' },
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'core', instrument:'a bright anthemic synth lead' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'a full-energy climb into a key change' },
      }},
      anthem_lead: { label: 'Anthemic key-change lead', atoms: {
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true, instrument:'an anthemic soaring synth lead' },
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'support', instrument:'gated tom fills and cymbal swells' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'a key-change lift into the last section' },
      }},
    },
  },

  // Vangelis — the singing pitch-bent analog lead over vast pads.
  composer_vangelis: {
    label: 'Vangelis', kind: 'composer', family: 'electronic',
    congruence: ELEC_ANY,
    coreSlots: ['texture', 'texture', 'pads', 'strings'],
    sigSlots:  ['bass', 'motif', 'colour', 'arc'],
    cores: {
      lush_analog: { label: 'Lush analog pad bed', atoms: {
        mo_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a vast lush analog pad bed' },
        mo_body:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'a warm analog string layer' },
        mo_pads:{ role:'pads', family:'pad', fn:'sustain-under', priority:'core', instrument:'a sustained analog choir' },
      }},
      choir_bells: { label: 'Choir pad and bells', atoms: {
        mo_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a soft synthetic choir pad' },
        mo_body:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'tuned bells and struck metal' },
        mo_pads:{ role:'pads', family:'pad', fn:'sustain-under', priority:'core', instrument:'a warm sustained pad' },
      }},
      perc_strings: { label: 'Percussive synth and strings', atoms: {
        mo_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a rhythmic percussive synth bed' },
        mo_body:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'sweeping synth strings' },
        mo_pads:{ role:'pads', family:'pad', fn:'sustain-under', priority:'core', instrument:'a shimmering synth pad' },
      }},
    },
    signatures: {
      cs80_lead: { label: 'Pitch-bent analog lead', atoms: {
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true, instrument:'a singing analog lead with slow pitch bends' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'one long unhurried melodic statement over the pad' },
      }},
      bell_arp: { label: 'Shimmering bell arpeggio', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'a shimmering bell arpeggio over the harmony' },
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'core', instrument:'a stately breathy analog brass melody' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'a slow majestic swell to a sustained peak' },
      }},
      deep_sweep: { label: 'Deep resonant sweep', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'a deep resonant filter sweep' },
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'core', instrument:'a solemn hymn-like synth melody' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'a slow widening swell' },
      }},
    },
  },

  // Hammer — the guitar-emulating synth lead with expressive bends.
  composer_hammer: {
    label: 'Jan Hammer', kind: 'composer', family: 'electronic',
    congruence: ELEC_ANY,
    coreSlots: ['texture', 'texture', 'pads', 'strings'],
    sigSlots:  ['bass', 'motif', 'colour', 'arc'],
    cores: {
      pad_perc: { label: 'Synth pad and electronic percussion', atoms: {
        mo_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a wide chorused synth pad' },
        mo_body:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'crisp electronic percussion layers' },
        mo_pads:{ role:'pads', family:'pad', fn:'sustain-under', priority:'core', instrument:'a warm analog pad' },
      }},
      rhodes_keys: { label: 'Electric keys and pad', atoms: {
        mo_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a warm analog pad' },
        mo_body:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'a bright electric piano' },
        mo_pads:{ role:'pads', family:'pad', fn:'sustain-under', priority:'core', instrument:'a soft chorused synth pad' },
      }},
      arp_strings: { label: 'Sequenced arp and synth strings', atoms: {
        mo_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a sequenced synth arpeggio bed' },
        mo_body:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'a synth string layer' },
        mo_pads:{ role:'pads', family:'pad', fn:'sustain-under', priority:'core', instrument:'a wide sustained pad' },
      }},
    },
    signatures: {
      guitar_synth: { label: 'Guitar-style synth lead', atoms: {
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true, instrument:'a guitar-style synth lead with bends, sustained' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'the lead answers itself across the empty bars' },
      }},
      bass_riff: { label: 'Punchy synth-bass riff', atoms: {
        mo_bass:{ role:'bass', family:'bass', fn:'foundation-weight', priority:'signature', signature:true, foundational:true, instrument:'a punchy syncopated synth-bass riff' },
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'core', instrument:'a bright cutting synth melody' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'a tight vamp opening into a full-energy chorus' },
      }},
      stab_chords: { label: 'Bright stab chords', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'bright synth stab chords on the offbeat' },
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'core', instrument:'a fast agile synth line' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'a driving build of stacking synth layers' },
      }},
    },
  },

  // Faltermeyer — the plucky synth hook and glossy 80s sheen.
  composer_faltermeyer: {
    label: 'Harold Faltermeyer', kind: 'composer', family: 'electronic',
    congruence: ELEC_ANY,
    coreSlots: ['texture', 'texture', 'pads', 'strings'],
    sigSlots:  ['bass', 'motif', 'colour', 'arc'],
    cores: {
      stabs_pad: { label: 'Bright synth stabs and pad', atoms: {
        mo_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a bright glossy synth pad' },
        mo_body:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'stabbing synth chord layers' },
        mo_pads:{ role:'pads', family:'pad', fn:'sustain-under', priority:'core', instrument:'a warm sustained synth pad' },
      }},
      brass_gated: { label: 'Synth brass and gated texture', atoms: {
        mo_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a big gated reverb pad' },
        mo_body:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'a stacked synth-brass section' },
        mo_pads:{ role:'pads', family:'pad', fn:'sustain-under', priority:'core', instrument:'a wide gated pad' },
      }},
      warm_strings: { label: 'Warm pad and synth strings', atoms: {
        mo_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a warm analog pad' },
        mo_body:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'lush synth strings' },
        mo_pads:{ role:'pads', family:'pad', fn:'sustain-under', priority:'core', instrument:'a soft analog pad' },
      }},
    },
    signatures: {
      marimba_hook: { label: 'Plucky marimba-toned hook', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'a plucky marimba-toned synth hook' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'the hook returning between every section' },
      }},
      octave_bass: { label: 'Octave synth bassline', atoms: {
        mo_bass:{ role:'bass', family:'bass', fn:'foundation-weight', priority:'signature', signature:true, foundational:true, instrument:'a bouncing octave synth bassline' },
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'core', instrument:'a bright confident synth lead' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'a clean build into a full-energy chorus' },
      }},
      anthem_guitar: { label: 'Anthemic guitar-synth lead', atoms: {
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true, instrument:'an anthemic soaring guitar-synth lead' },
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'support', instrument:'gated snare accents and bright bell stabs' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'a final chorus with every layer in' },
      }},
    },
  },
  // Price — the sidechain pump and disco-house polish.
  producer_price: {
    label: 'Stuart Price', kind: 'producer', family: 'producer',
    congruence: PROD_ELEC,
    coreSlots: ['texture', 'texture', 'pads', 'strings'],
    sigSlots:  ['colour', 'motif', 'arc'],
    cores: {
      analog_arp: { label: 'Analog arpeggios and pads', atoms: {
        mo_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a warm analog synth pad' },
        mo_body:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'a running analog arpeggio layer' },
        mo_pads:{ role:'pads', family:'pad', fn:'sustain-under', priority:'core', instrument:'a lush analog pad' },
      }},
      disco_strings: { label: 'Disco strings and keys', atoms: {
        mo_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a glossy synth string bed' },
        mo_body:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'a clavinet and electric piano layer' },
        mo_pads:{ role:'pads', family:'pad', fn:'sustain-under', priority:'core', instrument:'a warm sustained pad' },
      }},
      filtered_house: { label: 'Filtered pads and stabs', atoms: {
        mo_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'deep filtered house pads' },
        mo_body:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'a stabbing synth chord layer' },
        mo_pads:{ role:'pads', family:'pad', fn:'sustain-under', priority:'core', instrument:'a deep filtered pad' },
      }},
    },
    signatures: {
      sidechain_pump: { label: 'Sidechain pump', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'sustained layers pumping in time with the kick' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'the pump deepening as the arrangement fills out' },
      }},
      vocal_chop: { label: 'Filtered vocal chops', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'filtered vocal chops on the offbeats' },
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'core', instrument:'a bright analog synth melody' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'a long filter build into the chorus' },
      }},
      arp_climb: { label: 'Climbing arpeggio build', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'a climbing arpeggio figure' },
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'core', instrument:'a warm melodic synth lead' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'a steady build, one layer per eight bars' },
      }},
    },
  },

  // Terry — chopped vocal stabs and raw house organ.
  producer_terry: {
    label: 'Todd Terry', kind: 'producer', family: 'producer',
    congruence: PROD_ELEC,
    coreSlots: ['texture', 'texture', 'pads', 'strings'],
    sigSlots:  ['colour', 'motif', 'arc'],
    cores: {
      house_organ: { label: 'House organ and pads', atoms: {
        mo_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a warm house pad' },
        mo_body:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'a stabbing house organ layer' },
        mo_pads:{ role:'pads', family:'pad', fn:'sustain-under', priority:'core', instrument:'a warm sustained pad' },
      }},
      sample_loop: { label: 'Sampled loops and keys', atoms: {
        mo_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a filtered sample-loop bed' },
        mo_body:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'a bright electric piano layer' },
        mo_pads:{ role:'pads', family:'pad', fn:'sustain-under', priority:'core', instrument:'a soft filtered pad' },
      }},
      deep_pad: { label: 'Deep pads and strings', atoms: {
        mo_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a deep sustained pad' },
        mo_body:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'a synth string layer' },
        mo_pads:{ role:'pads', family:'pad', fn:'sustain-under', priority:'core', instrument:'a deep sustained synth pad' },
      }},
    },
    signatures: {
      chopped_stabs: { label: 'Chopped vocal stabs', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'chopped vocal stabs across the beat' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'the stabs re-trigger harder in the breakdown' },
      }},
      organ_riff: { label: 'Driving organ riff', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'a driving house organ riff' },
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'core', instrument:'a raw insistent synth hook' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'a stripped breakdown, rebuilds to full' },
      }},
      filter_sweep: { label: 'Raw filter sweep', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'a raw resonant filter sweep across the bars' },
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'core', instrument:'a simple looping synth melody' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'a cut-and-rebuild through the middle section' },
      }},
    },
  },

  // Flood — density, saturation and treated texture.
  producer_flood: {
    label: 'Flood', kind: 'producer', family: 'producer',
    congruence: PROD_ANY,
    coreSlots: ['texture', 'texture', 'pads', 'strings'],
    sigSlots:  ['colour', 'motif', 'arc'],
    cores: {
      dense_layers: { label: 'Dense atmospheric layers', atoms: {
        mo_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a dense layered atmospheric bed' },
        mo_body:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'a processed guitar layer' },
        mo_pads:{ role:'pads', family:'pad', fn:'sustain-under', priority:'core', instrument:'a dense treated pad' },
      }},
      processed_gtr: { label: 'Processed guitars', atoms: {
        mo_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a wall of processed guitar texture' },
        mo_body:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'a distorted synth layer' },
        mo_pads:{ role:'pads', family:'pad', fn:'sustain-under', priority:'core', instrument:'a saturated sustained pad' },
      }},
      sparse_dark: { label: 'Sparse and dark', atoms: {
        mo_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a sparse cold synth bed' },
        mo_body:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'a treated piano layer' },
        mo_pads:{ role:'pads', family:'pad', fn:'sustain-under', priority:'core', instrument:'a cold sparse pad' },
      }},
    },
    signatures: {
      industrial_bed: { label: 'Industrial distortion bed', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'a saturated distortion bed underneath' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'the distortion rises over the arrangement' },
      }},
      treated_noise: { label: 'Treated textural noise', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'treated metallic noise, wide stereo' },
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'core', instrument:'a stark repeated melodic fragment' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'a slow build, no release' },
      }},
      space_drop: { label: 'Cavernous drop', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'a long reverb tail between phrases' },
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'core', instrument:'a fragile exposed melodic line' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'drops to one voice then returns full' },
      }},
    },
  },

  // SAW — hi-NRG bounce, stacked backing hooks, relentless brightness.
  producer_saw: {
    label: 'Stock Aitken Waterman', kind: 'producer', family: 'producer',
    congruence: PROD_ANY,
    coreSlots: ['texture', 'texture', 'pads', 'strings'],
    sigSlots:  ['colour', 'motif', 'arc'],
    cores: {
      bright_stabs: { label: 'Bright synth stabs', atoms: {
        mo_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a bright glossy synth pad' },
        mo_body:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'stabbing synth chord hits' },
        mo_pads:{ role:'pads', family:'pad', fn:'sustain-under', priority:'core', instrument:'a bright glossy pad' },
      }},
      gated_pop: { label: 'Gated pop production', atoms: {
        mo_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a big gated reverb bed' },
        mo_body:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'a punchy synth-brass layer' },
        mo_pads:{ role:'pads', family:'pad', fn:'sustain-under', priority:'core', instrument:'a wide gated pad' },
      }},
      piano_pop: { label: 'Pop piano and strings', atoms: {
        mo_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a lush synth string pad' },
        mo_body:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'layered piano and sustained synth' },
        mo_pads:{ role:'pads', family:'pad', fn:'sustain-under', priority:'core', instrument:'a bright sustained pad' },
      }},
    },
    signatures: {
      hinrg_bass: { label: 'Hi-NRG octave bass', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'a bouncing hi-NRG octave bass every bar' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'a relentless four-on-the-floor drive' },
      }},
      backing_hooks: { label: 'Layered backing vocal hooks', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'stacked backing vocal hooks answering each line' },
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'core', instrument:'a bright singalong synth melody' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'a key-change lift into the final chorus' },
      }},
      orch_hit: { label: 'Orchestral hit punctuation', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'sampled orchestral hits on the turnarounds' },
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'core', instrument:'a simple insistent synth hook' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'a short sharp build straight into the hook' },
      }},
    },
  },

  // Mendelsohn — clarity, separation and polish.
  producer_mendelsohn: {
    label: 'Julian Mendelsohn', kind: 'producer', family: 'producer',
    congruence: PROD_ANY,
    coreSlots: ['texture', 'texture', 'pads', 'strings'],
    sigSlots:  ['colour', 'motif', 'arc'],
    cores: {
      polished_keys: { label: 'Polished layered keys', atoms: {
        mo_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a clean polished synth pad' },
        mo_body:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'a layered electric piano and synth bed' },
        mo_pads:{ role:'pads', family:'pad', fn:'sustain-under', priority:'core', instrument:'a clean polished pad' },
      }},
      wide_strings: { label: 'Wide synth strings', atoms: {
        mo_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a wide lush synth string bed' },
        mo_body:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'a chorused guitar layer' },
        mo_pads:{ role:'pads', family:'pad', fn:'sustain-under', priority:'core', instrument:'a wide lush pad' },
      }},
      crisp_pop: { label: 'Crisp pop bed', atoms: {
        mo_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a crisp bright synth bed' },
        mo_body:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'a clean rhythm guitar layer' },
        mo_pads:{ role:'pads', family:'pad', fn:'sustain-under', priority:'core', instrument:'a crisp bright pad' },
      }},
    },
    signatures: {
      crystal_clarity: { label: 'Crystalline separation', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'wide stereo separation, each layer distinct' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'the arrangement widens each section' },
      }},
      wide_chorus: { label: 'Wide chorused sheen', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'a wide chorused sheen on the upper layers' },
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'core', instrument:'a clean melodic synth line' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'a smooth build into the chorus' },
      }},
      vocal_stack: { label: 'Polished vocal stacks', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'stacked harmony layers answering the lead' },
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'core', instrument:'a warm singing melodic line' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'a full open final chorus' },
      }},
    },
  },

  // Hague — restraint, space and precision.
  producer_hague: {
    label: 'Stephen Hague', kind: 'producer', family: 'producer',
    congruence: PROD_ANY,
    coreSlots: ['texture', 'texture', 'pads', 'strings'],
    sigSlots:  ['colour', 'motif', 'arc'],
    cores: {
      clean_synthpop: { label: 'Clean synth-pop keys', atoms: {
        mo_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a clean restrained synth pad' },
        mo_body:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'a precise synth keyboard layer' },
        mo_pads:{ role:'pads', family:'pad', fn:'sustain-under', priority:'core', instrument:'a clean restrained pad' },
      }},
      restrained_arr: { label: 'Restrained arrangement', atoms: {
        mo_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a sparse controlled synth bed' },
        mo_body:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'a muted rhythm guitar layer' },
        mo_pads:{ role:'pads', family:'pad', fn:'sustain-under', priority:'core', instrument:'a sparse controlled pad' },
      }},
      warm_analog: { label: 'Warm analog keys', atoms: {
        mo_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a warm analog synth pad' },
        mo_body:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'an electric piano layer' },
        mo_pads:{ role:'pads', family:'pad', fn:'sustain-under', priority:'core', instrument:'a warm analog pad' },
      }},
    },
    signatures: {
      precise_arp: { label: 'Precise arpeggio figure', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'a precise clockwork arpeggio figure' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'one element enters at a time' },
      }},
      space_placement: { label: 'Deliberate space', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'space left around every voice' },
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'core', instrument:'a plain unadorned melodic line' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'a restrained build, never saturated' },
      }},
      bell_accent: { label: 'Bell accents', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'clean bell accents on the phrase ends' },
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'core', instrument:'a simple memorable synth melody' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'a controlled lift into the chorus' },
      }},
    },
  },

  // Horn — maximalist layering, sampled orchestra, wall of sound.
  producer_horn: {
    label: 'Trevor Horn', kind: 'producer', family: 'producer',
    congruence: PROD_ANY,
    coreSlots: ['texture', 'texture', 'pads', 'strings'],
    sigSlots:  ['colour', 'motif', 'arc'],
    cores: {
      sampled_orch: { label: 'Sampled orchestral layers', atoms: {
        mo_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a sustained sampled orchestral section' },
        mo_body:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'a stacked synth-brass layer' },
        mo_pads:{ role:'pads', family:'pad', fn:'sustain-under', priority:'core', instrument:'a sustained massed brass section' },
      }},
      layered_wall: { label: 'Layered production wall', atoms: {
        mo_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a vast layered production bed' },
        mo_body:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'a massed choir layer' },
        mo_pads:{ role:'pads', family:'pad', fn:'sustain-under', priority:'core', instrument:'a sustained massed choir and synth' },
      }},
      digital_sheen: { label: 'Digital sheen and keys', atoms: {
        mo_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a glossy digital synth bed' },
        mo_body:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'a bright sampled keyboard layer' },
        mo_pads:{ role:'pads', family:'pad', fn:'sustain-under', priority:'core', instrument:'a glossy digital pad' },
      }},
    },
    signatures: {
      wall_fanfare: { label: 'Wall-of-sound fanfare', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'a wall-of-sound sampled fanfare filling the arrangement' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'a build to a full wall of sound' },
      }},
      sampled_stab: { label: 'Sampled stab punctuation', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'huge sampled stabs through the arrangement' },
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'core', instrument:'a bold anthemic melodic line' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'a full stop then full re-entry' },
      }},
      choir_swell: { label: 'Massed choir swell', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'a massed choir behind the chorus' },
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'core', instrument:'a soaring theatrical melody' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'a layered climb to the final statement' },
      }},
    },
  },

  // Quincy — horn punches, vocal stacks, immaculate groove.
  producer_quincy: {
    label: 'Quincy Jones', kind: 'producer', family: 'producer',
    congruence: PROD_ANY,
    coreSlots: ['texture', 'texture', 'pads', 'strings'],
    sigSlots:  ['colour', 'motif', 'arc'],
    cores: {
      horn_funk: { label: 'Horn section and funk keys', atoms: {
        mo_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'sustained layered keyboards' },
        mo_body:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'a tight funk horn section' },
        mo_pads:{ role:'pads', family:'pad', fn:'sustain-under', priority:'core', instrument:'a sustained warm brass section' },
      }},
      lush_strings: { label: 'Lush strings and keys', atoms: {
        mo_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a sustained lush string section' },
        mo_body:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'an electric piano and clavinet layer' },
        mo_pads:{ role:'pads', family:'pad', fn:'sustain-under', priority:'core', instrument:'a sustained warm horn section' },
      }},
      smooth_jazz: { label: 'Smooth jazz bed', atoms: {
        mo_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a smooth warm synth pad' },
        mo_body:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'a saxophone section' },
        mo_pads:{ role:'pads', family:'pad', fn:'sustain-under', priority:'core', instrument:'a smooth warm pad' },
      }},
    },
    signatures: {
      brass_punch: { label: 'Tight brass punches', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'tight brass punches on the offbeats' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'the horns answer the hook every turnaround' },
      }},
      vocal_stacks: { label: 'Layered vocal stacks', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'stacked backing vocal harmonies answering the lead' },
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'core', instrument:'a soulful melodic line' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'a final chorus with horns and voices together' },
      }},
      perc_bed: { label: 'Layered percussion bed', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'layered congas and shakers in the groove' },
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'core', instrument:'a smooth saxophone line' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'a groove-led build, one layer per section' },
      }},
    },
  },

  // Guetta — the festival lead and the drop.
  remixer_guetta: {
    label: 'David Guetta', kind: 'remixer', family: 'remixer',
    congruence: REMIX_ELEC,
    coreSlots: ['perc', 'bass', 'texture', 'strings'],
    sigSlots:  ['colour', 'counter', 'motif', 'arc'],
    cores: {
      bigroom: { label: 'Big-room dance body', atoms: {
        mo_perc:{ role:'perc', family:'perc', fn:'groove', priority:'core', instrument:'layered clap and snare-roll percussion' },
        mo_bass:{ role:'bass', family:'bass', fn:'foundation-weight', priority:'core', foundational:true, instrument:'a sidechained synth bass' },
        mo_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'stacked anthemic supersaw chords' },
      }},
      electro_pop: { label: 'Electro-pop body', atoms: {
        mo_perc:{ role:'perc', family:'perc', fn:'groove', priority:'core', instrument:'crisp electronic percussion layers' },
        mo_bass:{ role:'bass', family:'bass', fn:'foundation-weight', priority:'core', foundational:true, instrument:'a punchy electro synth bass' },
        mo_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a glossy wide synth pad' },
      }},
      progressive: { label: 'Progressive build body', atoms: {
        mo_perc:{ role:'perc', family:'perc', fn:'groove', priority:'core', instrument:'rolling tom and shaker layers' },
        mo_bass:{ role:'bass', family:'bass', fn:'foundation-weight', priority:'core', foundational:true, instrument:'an offbeat synth bass' },
        mo_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a warm filtered pad bed' },
      }},
    },
    signatures: {
      festival_lead: { label: 'Supersaw festival lead', atoms: {
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true, instrument:'a massive supersaw festival lead exploding on the drop' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'a long riser into the drop' },
      }},
      vocal_chop: { label: 'Filtered vocal chops', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'filtered vocal chops across the beat' },
        mo_counter:{ role:'counter', family:'counter', fn:'answer', priority:'support', instrument:'a bright plucked synth answering the hook' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'a stripped build then a full-energy drop' },
      }},
      piano_house: { label: 'Piano house lift', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'bright house piano chords stabbing on the offbeat' },
        mo_counter:{ role:'counter', family:'counter', fn:'answer', priority:'support', instrument:'a soaring synth line rising through the build' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'a lift into the final chorus' },
      }},
    },
  },

  // Harris — the funky sliding bassline IS the tell (bass takeover).
  remixer_harris: {
    label: 'Calvin Harris', kind: 'remixer', family: 'remixer',
    congruence: REMIX_ELEC,
    coreSlots: ['perc', 'texture', 'pads', 'strings'],
    sigSlots:  ['bass', 'colour', 'counter', 'arc'],
    cores: {
      funky_house: { label: 'Funky house body', atoms: {
        mo_perc:{ role:'perc', family:'perc', fn:'groove', priority:'core', instrument:'crisp handclap and shaker layers' },
        mo_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a warm analog synth pad' },
        mo_pads:{ role:'pads', family:'pad', fn:'sustain-under', priority:'core', instrument:'a warm sustained pad' },
      }},
      electro_body: { label: 'Electro body', atoms: {
        mo_perc:{ role:'perc', family:'perc', fn:'groove', priority:'core', instrument:'punchy electronic percussion layers' },
        mo_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a glossy saw-chord bed' },
        mo_pads:{ role:'pads', family:'pad', fn:'sustain-under', priority:'core', instrument:'a wide electro pad' },
      }},
      summer_house: { label: 'Summer house body', atoms: {
        mo_perc:{ role:'perc', family:'perc', fn:'groove', priority:'core', instrument:'light tambourine and clap layers' },
        mo_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a bright airy synth pad' },
        mo_pads:{ role:'pads', family:'pad', fn:'sustain-under', priority:'core', instrument:'a bright airy pad' },
      }},
    },
    signatures: {
      sliding_bass: { label: 'Funky sliding bassline', atoms: {
        mo_bass:{ role:'bass', family:'bass', fn:'foundation-weight', priority:'signature', signature:true, foundational:true, instrument:'a funky sliding synth bassline' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'the bassline carries the groove through the drop' },
      }},
      pluck_hook: { label: 'Plucked synth hook', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'a bright plucked synth hook' },
        mo_counter:{ role:'counter', family:'counter', fn:'answer', priority:'support', instrument:'a filtered chord stab answering the hook' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'a clean build into an open drop' },
      }},
      filtered_disco: { label: 'Filtered disco loop', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'a filtered disco guitar loop under the beat' },
        mo_counter:{ role:'counter', family:'counter', fn:'answer', priority:'support', instrument:'a bright brass-synth stab layer' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'a long filter opening into the chorus' },
      }},
    },
  },

  // Nelson — modern nu-disco warmth and live-feel groove.
  remixer_nelson: {
    label: 'Oliver Nelson', kind: 'remixer', family: 'remixer',
    congruence: REMIX_ANY,
    coreSlots: ['perc', 'bass', 'texture', 'strings'],
    sigSlots:  ['colour', 'counter', 'motif', 'arc'],
    cores: {
      nudisco: { label: 'Nu-disco body', atoms: {
        mo_perc:{ role:'perc', family:'perc', fn:'groove', priority:'core', instrument:'crisp live-feel percussion layers' },
        mo_bass:{ role:'bass', family:'bass', fn:'foundation-weight', priority:'core', foundational:true, instrument:'a plucky disco bassline' },
        mo_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a warm analog string bed' },
      }},
      funk_guitar: { label: 'Funk guitar body', atoms: {
        mo_perc:{ role:'perc', family:'perc', fn:'groove', priority:'core', instrument:'tight shaker and conga layers' },
        mo_bass:{ role:'bass', family:'bass', fn:'foundation-weight', priority:'core', foundational:true, instrument:'a slap-inflected funk bassline' },
        mo_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a chorused rhythm guitar bed' },
      }},
      warm_house: { label: 'Warm house body', atoms: {
        mo_perc:{ role:'perc', family:'perc', fn:'groove', priority:'core', instrument:'soft brushed percussion layers' },
        mo_bass:{ role:'bass', family:'bass', fn:'foundation-weight', priority:'core', foundational:true, instrument:'a round warm synth bassline' },
        mo_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a soft filtered pad' },
      }},
    },
    signatures: {
      disco_strings: { label: 'Filtered disco strings', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'filtered disco string swells' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'a smooth filter build into the chorus' },
      }},
      guitar_lick: { label: 'Funk guitar licks', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'clipped funk guitar licks answering on the offbeat' },
        mo_counter:{ role:'counter', family:'counter', fn:'answer', priority:'support', instrument:'a warm electric piano layer' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'a groove-led build adding one layer per section' },
      }},
      sunset_lead: { label: 'Sunset synth lead', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'a warm singing synth lead over the groove' },
        mo_counter:{ role:'counter', family:'counter', fn:'answer', priority:'support', instrument:'a soft brass-synth stab layer' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'a lift into a wide final chorus' },
      }},
    },
  },

  // Pettibone — echo-drenched stabs over extended dub breakdowns.
  remixer_pettibone: {
    label: 'Shep Pettibone', kind: 'remixer', family: 'remixer',
    congruence: REMIX_ANY,
    coreSlots: ['perc', 'bass', 'texture', 'strings'],
    sigSlots:  ['colour', 'counter', 'motif', 'arc'],
    cores: {
      latin_perc: { label: 'Latin percussion body', atoms: {
        mo_perc:{ role:'perc', family:'perc', fn:'groove', priority:'core', instrument:'crisp layered latin hand percussion' },
        mo_bass:{ role:'bass', family:'bass', fn:'foundation-weight', priority:'core', foundational:true, instrument:'a bouncing bassline' },
        mo_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a warm house pad bed' },
      }},
      dub_body: { label: 'Dub remix body', atoms: {
        mo_perc:{ role:'perc', family:'perc', fn:'groove', priority:'core', instrument:'echoing timbale and conga layers' },
        mo_bass:{ role:'bass', family:'bass', fn:'foundation-weight', priority:'core', foundational:true, instrument:'a dubbed-out bassline' },
        mo_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a filtered delay-soaked pad' },
      }},
      piano_house: { label: 'Piano house body', atoms: {
        mo_perc:{ role:'perc', family:'perc', fn:'groove', priority:'core', instrument:'crisp clap and shaker layers' },
        mo_bass:{ role:'bass', family:'bass', fn:'foundation-weight', priority:'core', foundational:true, instrument:'a house bassline' },
        mo_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a bright house piano bed' },
      }},
    },
    signatures: {
      echo_stabs: { label: 'Echo-drenched vocal stabs', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'looped echo-drenched vocal stabs' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'an extended dub breakdown, percussion and echo only' },
      }},
      dub_delay: { label: 'Dub delay throws', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'dub delay throws on every phrase end' },
        mo_counter:{ role:'counter', family:'counter', fn:'answer', priority:'support', instrument:'a filtered organ stab layer' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'a long breakdown, one layer at a time' },
      }},
      piano_riff: { label: 'House piano riff', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'a rolling house piano riff' },
        mo_counter:{ role:'counter', family:'counter', fn:'answer', priority:'support', instrument:'a bright string-synth stab layer' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'a percussive build into a full open chorus' },
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

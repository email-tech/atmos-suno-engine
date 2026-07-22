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
import { bedAtom, bedAllowed } from './beds.js';

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
      warm_chamber: { label: 'Warm string chamber', bed: 'muted_strings', atoms: {
      }},
      // C2 — the airy pastel body (American Beauty / WALL-E lean).
      airy_pastel: { label: 'Airy woodwind pastel', bed: 'woodwind_bed', atoms: {
      }},
      // C3 — the low sustained body (1917 / Skyfall lean).
      low_sustain: { label: 'Low sustained and muted brass', bed: 'low_strings', atoms: {
      }},
    },

    signatures: {
      // S1 — the classic mallet ostinato. NOTE: colour, not motif (ostinato ≠ lead).
      mallet_ostinato: { label: 'Hammered-dulcimer and marimba ostinato', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature',
                    instrument:'a hammered-dulcimer and marimba figure ticking quietly under the melody' },
        mo_lead:  { role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true,
                    instrument:'a sparse solo felt-piano melody' },
        mo_arc:   { role:'arc', fn:'arc', priority:'support',
                    text:'the ostinato drops out then returns alone' },
      }},
      // S2 — the prepared/plucked tell.
      prepared_pluck: { label: 'Prepared piano and pizzicato', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature',
                    instrument:'prepared-piano and pizzicato accents, quiet under the melody' },
        mo_lead:  { role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true,
                    instrument:'a spare solo tack-piano melody' },
        mo_counter:{ role:'counter', family:'counter', fn:'answer', priority:'support',
                    instrument:'a solo vibraphone answering softly under the melody' },
      }},
      // S3 — the exotic-colour tell.
      exotic_colour: { label: 'Cimbalom and exotic colour', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature',
                    instrument:'a cimbalom figure threading quietly through the texture' },
        mo_lead:  { role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true,
                    instrument:'a long unhurried solo duduk melody' },
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
      twelve_inch: { label: 'Classic 12-inch re-edit body', bed: 'warm_analog_pad', atoms: {
        mo_perc: { role:'perc', family:'perc', fn:'groove', priority:'core',
                   instrument:'rolling layered latin percussion' },
        mo_bass: { role:'bass', family:'bass', fn:'foundation-weight', priority:'core',
                   instrument:'a re-played melodic bassline', foundational:true },
      }},
      // C2 — the orchestral-hit dance body.
      hit_dance: { label: 'Orchestral-hit dance body', bed: 'bright_synth_pad', atoms: {
        mo_perc: { role:'perc', family:'perc', fn:'groove', priority:'core',
                   instrument:'crisp handclap layers and tom fills' },
        mo_bass: { role:'bass', family:'bass', fn:'foundation-weight', priority:'core',
                   instrument:'an octave-jumping synth bassline', foundational:true },
        mo_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core',
                   instrument:'sampled orchestral hits and bright synth-brass stabs' },
      }},
      // C3 — the dub/megamix body.
      dub_megamix: { label: 'Dub megamix body', bed: 'filtered_pad', atoms: {
        mo_perc: { role:'perc', family:'perc', fn:'groove', priority:'core',
                   instrument:'echoing tom rolls and delayed hand percussion' },
        mo_bass: { role:'bass', family:'bass', fn:'foundation-weight', priority:'core',
                   instrument:'a dubbed-out bassline', foundational:true },
      }},
    },

    signatures: {
      // S1 — the scratch/transformer tell.
      scratch_cut: { label: 'Scratch and transformer cuts', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true,
                    instrument:'scratch-style stabs and transformer cuts across the beat, low in the mix' },
        mo_arc:   { role:'arc', fn:'arc', priority:'support',
                    text:'the arrangement cuts to one stab then rebuilds' },
      }},
      // S2 — the dramatic sampled fanfare tell.
      fanfare_intro: { label: 'Dramatic sampled fanfare', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true,
                    instrument:'a sampled orchestral-hit fanfare opening the bars' },
        mo_counter:{ role:'counter', family:'counter', fn:'answer', priority:'support',
                    instrument:'a synth-brass counter-line answering under the hook' },
        mo_arc:   { role:'arc', fn:'arc', priority:'support',
                    text:'a cinematic intro bed into the full groove' },
      }},
      // S3 — the extended re-edit tell.
      reedit_break: { label: 'Extended re-edit breakdown', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true,
                    instrument:'chopped re-triggered vocal stabs low in the mix' },
        mo_counter:{ role:'counter', family:'counter', fn:'answer', priority:'support',
                    instrument:'a filtered synth line rising quietly through the breakdown' },
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
      full_tutti: { label: 'Full symphonic tutti', bed: 'strings_horns', atoms: {
      }},
      woodwind_adventure: { label: 'Woodwind adventure', bed: 'woodwind_bed', atoms: {
        mo_strings:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'bright agile upper strings' },
        mo_body:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'flute and clarinet runs' },
      }},
      dark_lowbrass: { label: 'Dark low brass and choir', bed: 'low_brass', atoms: {
        mo_body:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'trombone and tuba' },
      }},
    },
    signatures: {
      theme_transformed: { label: 'Theme returning transformed', atoms: {
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true, instrument:'a long-form solo horn theme returning transformed' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'the theme returns transformed at the peak' },
      }},
      brass_fanfare: { label: 'Heroic brass fanfare', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', instrument:'a brass fanfare figure answering behind the melody' },
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true, instrument:'a broad noble solo horn melody' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'a rising build into a full brass statement' },
      }},
      wonder_motif: { label: 'Celesta wonder motif', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', instrument:'celesta and harp sparkle under the harmony, low in the mix' },
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true, instrument:'a delicate solo flute melody' },
        mo_counter:{ role:'counter', family:'counter', fn:'answer', priority:'support', instrument:'a wordless childrens choir soft behind the melody' },
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
      lowbrass_hybrid: { label: 'Massed low brass and hybrid bed', bed: 'low_brass', atoms: {
      }},
      ostinato_perc: { label: 'String ostinato and percussion', bed: 'hybrid_pad', atoms: {
        mo_strings:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'a sixteenth-note string ostinato' },
        mo_body:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'taiko and orchestral percussion' },
      }},
      solo_cello: { label: 'Solo cello over sustained pad', bed: 'filtered_pad', atoms: {
        mo_strings:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'a solo cello line' },
        mo_body:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a synth-orchestra hybrid layer' },
      }},
    },
    signatures: {
      accumulation: { label: 'Layered accumulation', atoms: {
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true,
                  instrument:'a solo cello line over the ostinato' },
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', instrument:'stacked ostinato layers building quietly bar by bar under the melody' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'builds to a unison then one resolving chord' },
      }},
      brass_swell: { label: 'Low-brass swell', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', instrument:'a low-brass swell rising slowly under the harmony' },
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true, instrument:'a weighty two-note solo horn motif' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'a slow crescendo to one sustained hit' },
      }},
      ticking_pulse: { label: 'Ticking clock pulse', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', instrument:'a ticking clock-like pulse low in the mix' },
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true, instrument:'a simple rising four-note solo piano motif' },
        mo_counter:{ role:'counter', family:'counter', fn:'answer', priority:'support', instrument:'a shepard-tone riser low underneath' },
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
      high_lyric: { label: 'High string lyricism', bed: 'strings_horns', atoms: {
        mo_body:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'French horn' },
      }},
      ethnic_choir: { label: 'Ethnic flute and choir', bed: 'wordless_choir', atoms: {
        mo_body:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a massed wooden-flute ensemble' },
      }},
      danger_brass: { label: 'Low brass and timpani', bed: 'low_brass', atoms: {
        mo_body:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'low brass and timpani' },
      }},
    },
    signatures: {
      long_breath: { label: 'Soaring long-breathed melody', atoms: {
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true, instrument:'a soaring long-breathed solo violin melody' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'the melody rises to one sustained peak' },
      }},
      wordless_soprano: { label: 'Wordless solo soprano', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', instrument:'a wordless solo soprano floating quietly above the arrangement' },
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true, instrument:'a folk-like solo shakuhachi melody' },
        mo_counter:{ role:'counter', family:'counter', fn:'answer', priority:'support', instrument:'a distant wordless vocal low in the mix' },
      }},
      four_note: { label: 'Four-note danger motif', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', instrument:'a four-note descending brass motif answering underneath' },
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true, instrument:'an urgent solo violin line' },
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
      legato_bed: { label: 'Silky legato string bed', bed: 'strings_horns', atoms: {
        mo_body:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'French horn and oboe' },
      }},
      chamber_horn: { label: 'Horn and oboe chamber', bed: 'brass_chorale', atoms: {
      }},
      brass_swagger: { label: 'Brass swagger and twang', bed: 'low_brass', atoms: {
        mo_strings:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'punchy staccato strings' },
        mo_body:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a muted trumpet section' },
      }},
    },
    signatures: {
      held_back: { label: 'Dynamics reined in', atoms: {
        mo_counter:{ role:'counter', family:'counter', fn:'answer', priority:'signature', instrument:'a solo oboe answering quietly under the melody' },
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true, instrument:'a plain unadorned solo horn melody' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'dynamics stay level throughout' },
      }},
      plain_theme: { label: 'Plain lyrical theme', atoms: {
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true, instrument:'a broad lyrical melody carried on solo horn' },
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'support', instrument:'a soft vibraphone shimmer low in the mix' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'one long statement, no climax' },
      }},
      brass_stabs: { label: 'Sharp brass stabs', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', instrument:'muted plunger-brass accents answering under the melody' },
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true, instrument:'a twanging solo guitar melody' },
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
      angular_brass: { label: 'Angular brass and strings', bed: 'low_strings', atoms: {
        mo_strings:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'angular staccato strings' },
        mo_body:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a stabbing brass section' },
      }},
      orch_electronics: { label: 'Orchestra and analog electronics', bed: 'warm_analog_pad', atoms: {
        mo_body:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'an analog synth layer under the orchestra' },
      }},
      exotic_woodwind: { label: 'Exotic percussion and woodwind', bed: 'woodwind_bed', atoms: {
        mo_body:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'bass flute and contrabassoon' },
      }},
    },
    signatures: {
      asym_ostinato: { label: 'Driving asymmetric ostinato', atoms: {
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true,
                  instrument:'a stark solo horn motif over the ostinato' },
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', instrument:'an asymmetric ostinato running quietly across the bar' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'the ostinato tightens as layers stack' },
      }},
      shimmer_colour: { label: 'Shimmering electronic colour', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', instrument:'a shimmering metallic sweep low behind the melody' },
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true, instrument:'a stark solo horn motif' },
        mo_counter:{ role:'counter', family:'counter', fn:'answer', priority:'support', instrument:'bowed metal and echo low underneath' },
      }},
      noble_horn: { label: 'Noble horn theme', atoms: {
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true, instrument:'a noble expansive melody carried by a solo horn' },
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'support', instrument:'log drums and exotic hand percussion under the groove' },
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
      reed_band: { label: 'Amplified reed band', bed: 'woodwind_bed', atoms: {
        mo_strings:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'a string quartet' },
        mo_body:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'an amplified saxophone section' },
      }},
      string_piano: { label: 'String ensemble and piano', bed: 'lush_strings', atoms: {
        mo_strings:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'a tight string ensemble' },
        mo_body:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a percussive piano part' },
      }},
      baroque_chamber: { label: 'Harpsichord chamber', bed: 'organ_bed', atoms: {
        mo_strings:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'a baroque-styled string band' },
        mo_body:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a baroque continuo section' },
      }},
    },
    signatures: {
      ground_bass: { label: 'Baroque ground-bass figure', atoms: {
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true,
                  instrument:'a spare repeating solo piano melody' },
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', instrument:'a baroque ground-bass figure cycling quietly underneath' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'the same cycle repeats, layers added' },
      }},
      quaver_drive: { label: 'Hammering quaver pulse', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', instrument:'a quaver pulse driving steadily under the melody' },
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true, instrument:'a stark repeated solo saxophone cell' },
        mo_counter:{ role:'counter', family:'counter', fn:'answer', priority:'support', instrument:'massed reeds held quietly under the melody' },
      }},
      piano_minimal: { label: 'Minimal piano figure', atoms: {
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true, instrument:'a spare repeating solo piano melody' },
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'support', instrument:'pizzicato string punctuation low in the mix' },
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
      lush_choir: { label: 'Lush strings and choir', bed: 'wordless_choir', atoms: {
      }},
      twang_trumpet: { label: 'Twang guitar and trumpet', bed: 'lush_strings', atoms: {
        mo_body:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a lone mariachi trumpet' },
      }},
      chamber_reed: { label: 'Chamber woodwind', bed: 'woodwind_bed', atoms: {
        mo_strings:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'a small chamber string group' },
      }},
    },
    signatures: {
      whistle_motif: { label: 'Whistled ocarina melody', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'a whistled solo ocarina line threading through the texture' },
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'core', instrument:'a plaintive twanging solo electric-guitar melody' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'the whistle answers across the empty bars' },
      }},
      soprano_vocalise: { label: 'Soprano vocalise', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'a wordless solo soprano vocalise floating over the arrangement' },
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'core', instrument:'a long aching solo violin melody' },
        mo_counter:{ role:'counter', family:'counter', fn:'answer', priority:'support', instrument:'a hushed sustained choir' },
      }},
      jews_harp: { label: 'Jews-harp and percussion', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', instrument:'jews-harp and hand-percussion accents quiet in the gaps' },
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true, instrument:'a terse solo trumpet motif' },
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
      hybrid_bed: { label: 'Hybrid orchestra and synth', bed: 'hybrid_pad', atoms: {
        mo_body:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a distorted brass layer' },
      }},
      tribal_low: { label: 'Tribal percussion and low strings', bed: 'low_brass', atoms: {
        mo_body:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'massed tribal drums' },
      }},
      sparse_solo: { label: 'Sparse solo and pad', bed: 'warm_analog_pad', atoms: {
        mo_strings:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'a thin high string line' },
      }},
    },
    signatures: {
      talking_drum: { label: 'Talking-drum figure', atoms: {
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true,
                  instrument:'a simple modal solo flute melody' },
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', instrument:'a talking-drum and shaker figure under the groove' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'the percussion thickens bar by bar' },
      }},
      distorted_brass: { label: 'Distorted brass', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', instrument:'a distorted saturated brass edge low under the harmony' },
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true, instrument:'a terse solo low-horn motif' },
        mo_counter:{ role:'counter', family:'counter', fn:'answer', priority:'support', instrument:'a granular processed orchestral layer low underneath' },
      }},
      processed_chant: { label: 'Processed vocal chant', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', instrument:'a looped processed group chant quiet behind the melody' },
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true, instrument:'a simple modal solo flute melody' },
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
      orch_brass: { label: 'Orchestral strings and brass', bed: 'brass_chorale', atoms: {
        mo_body:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a punchy brass section' },
      }},
      chamber_piano: { label: 'Chamber strings and piano', bed: 'lush_strings', atoms: {
        mo_strings:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'an intimate chamber string group' },
        mo_body:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'layered piano' },
      }},
      choir_orch: { label: 'Choir and orchestra', bed: 'wordless_choir', atoms: {
      }},
    },
    signatures: {
      sampled_stabs: { label: 'Sampled orchestral stabs', atoms: {
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true,
                  instrument:'a light solo oboe melody' },
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', instrument:'sampled orchestral stabs punctuating quietly across the beat' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'the stabs break the arrangement into blocks' },
      }},
      pizz_playful: { label: 'Playful pizzicato', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', instrument:'playful pizzicato figures low through the bars' },
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true, instrument:'a light solo oboe melody' },
        mo_counter:{ role:'counter', family:'counter', fn:'answer', priority:'support', instrument:'a solo celesta answering softly under the melody' },
      }},
      gospel_lift: { label: 'Gospel choir lift', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', instrument:'a gospel choir answering in block harmony behind the melody' },
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true, instrument:'a soulful solo saxophone melody' },
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
      theatrical: { label: 'Theatrical string orchestra', bed: 'strings_horns', atoms: {
      }},
      rock_hybrid: { label: 'Rock band and orchestra', bed: 'organ_bed', atoms: {
        mo_strings:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'urgent staccato strings' },
        mo_body:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'overdriven electric guitar' },
      }},
      ballad_piano: { label: 'Ballad piano and strings', bed: 'lush_strings', atoms: {
        mo_body:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'layered piano' },
      }},
    },
    signatures: {
      soaring_theme: { label: 'Soaring theatrical melody', atoms: {
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true, instrument:'a soaring theatrical solo violin melody' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'the melody restated a tone higher for the final chorus' },
      }},
      pipe_organ: { label: 'Dramatic pipe organ', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', instrument:'a pipe-organ entry swelling in under the harmony' },
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true, instrument:'a bold descending solo trumpet line' },
        mo_counter:{ role:'counter', family:'counter', fn:'answer', priority:'support', instrument:'a massed choir held softly behind the melody' },
      }},
      keychange_lift: { label: 'Key-change lift', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', instrument:'a cascading harp run quiet into the lift' },
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true, instrument:'a broad anthemic solo violin melody' },
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
      brass_strings: { label: 'Brass section and strings', bed: 'strings_horns', atoms: {
        mo_strings:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'bright punchy strings' },
        mo_body:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a tight brass section' },
      }},
      funk_horns: { label: 'Funky rhythm and horns', bed: 'brass_chorale', atoms: {
        mo_strings:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'stabbing rhythmic strings' },
      }},
      lyric_piano: { label: 'Lyrical strings and piano', bed: 'lush_strings', atoms: {
        mo_body:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'layered piano' },
      }},
    },
    signatures: {
      trumpet_fanfare: { label: 'Triumphant trumpet fanfare', atoms: {
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true,
                  instrument:'a bold solo trumpet melody' },
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', instrument:'a trumpet fanfare figure answering behind the melody' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'a build from one line to a full brass statement' },
      }},
      horn_riff: { label: 'Driving horn riff', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', instrument:'a syncopated horn riff under the groove' },
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true, instrument:'a bold solo trumpet melody' },
        mo_counter:{ role:'counter', family:'counter', fn:'answer', priority:'support', instrument:'brass held quietly under the harmony' },
      }},
      tender_piano: { label: 'Tender piano theme', atoms: {
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true, instrument:'a tender unhurried melody on solo piano' },
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'support', instrument:'soft string swells answering quietly under the piano' },
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
      big_brass: { label: 'Big brass and strings', bed: 'brass_chorale', atoms: {
      }},
      orch_beats: { label: 'Orchestra and electronic beats', bed: 'bright_synth_pad', atoms: {
        mo_strings:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'urgent staccato strings' },
        mo_body:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'an electronic synth layer under the orchestra' },
      }},
      sultry_sax: { label: 'Sultry sax and strings', bed: 'lush_strings', atoms: {
        mo_body:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a saxophone section' },
      }},
    },
    signatures: {
      bond_stabs: { label: 'Sharp brass stabs', atoms: {
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true,
                  instrument:'a suave muted solo trumpet melody' },
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', instrument:'syncopated brass stabs punctuating quietly across the groove' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'stabs on every turnaround' },
      }},
      surf_guitar: { label: 'Twangy surf guitar', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', instrument:'a twanging tremolo surf-guitar line low under the melody' },
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true, instrument:'a suave muted solo trumpet melody' },
        mo_counter:{ role:'counter', family:'counter', fn:'answer', priority:'support', instrument:'shimmering vibraphone low under the melody' },
      }},
      diva_vocalise: { label: 'Diva vocalise', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'a wordless solo female vocalise floating over the arrangement' },
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'core', instrument:'a broad solo violin melody' },
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
      arp_strings: { label: 'Arpeggiated synth and strings', bed: 'warm_analog_pad', atoms: {
        mo_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a pulsing arpeggiated synth' },
      }},
      vocoder_brass: { label: 'Vocoder pad and synth brass', bed: 'synth_choir_pad', atoms: {
        mo_body:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'a punchy synth-brass section' },
      }},
      analog_filter: { label: 'Analog lead and filtered pads', bed: 'filtered_pad', atoms: {
        mo_body:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'a resonant filtered synth layer' },
      }},
    },
    signatures: {
      sequenced_bass: { label: 'Sequenced octave bassline', atoms: {
        mo_bass:{ role:'bass', family:'bass', fn:'foundation-weight', priority:'signature', signature:true, foundational:true, instrument:'an unbroken sequenced solo synth bassline' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'the sequence runs unbroken, layers enter over it' },
      }},
      analog_lead: { label: 'Soaring analog lead', atoms: {
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true, instrument:'a soaring solo analog synth lead' },
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'support', instrument:'synth-brass punctuation low under the sequence' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'a long filter opening into a full-energy peak' },
      }},
      filter_arp: { label: 'Filtered arpeggio sweep', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', instrument:'a filtered arpeggio sweeping quietly open across the bars' },
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true, instrument:'a simple insistent solo synth melody' },
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
      dark_metal: { label: 'Dark pad and metallic texture', bed: 'filtered_pad', atoms: {
        mo_body:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'a metallic struck-steel layer' },
      }},
      low_drone: { label: 'Low drone and sparse synth', bed: 'drone_bed', atoms: {
        mo_body:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'a sparse cold synth line' },
      }},
      choir_pad: { label: 'Synth choir and string pad', bed: 'synth_choir_pad', atoms: {
        mo_body:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'a cold synth string layer' },
      }},
    },
    signatures: {
      industrial_bass: { label: 'Industrial pounding bass', atoms: {
        mo_bass:{ role:'bass', family:'bass', fn:'foundation-weight', priority:'signature', signature:true, foundational:true, instrument:'an industrial solo synth bassline, one repeating figure' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'the ostinato stays unchanged underneath' },
      }},
      anvil_hits: { label: 'Metallic anvil hits', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', instrument:'metallic anvil hits low on the downbeat' },
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true, instrument:'a stark descending solo synth motif' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'a build of stacking metallic layers' },
      }},
      descend_motif: { label: 'Descending synth motif', atoms: {
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true, instrument:'a cold descending solo synth melody' },
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'support', instrument:'struck-steel accents quiet in the gaps' },
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
      synth_brass: { label: 'Synth brass and gated pad', bed: 'bright_synth_pad', atoms: {
      }},
      rock_synth: { label: 'Rock guitar and synth', bed: 'warm_analog_pad', atoms: {
        mo_body:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'overdriven electric guitar' },
      }},
      piano_orch: { label: 'Piano and orchestral synth', bed: 'hybrid_pad', atoms: {
        mo_body:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'layered piano' },
      }},
    },
    signatures: {
      power_riff: { label: 'Driving synth-brass riff', atoms: {
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true,
                  instrument:'a bright anthemic solo synth lead' },
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', instrument:'a synth-brass power riff driving under the melody' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'a steady build into the final chorus' },
      }},
      octave_drive: { label: 'Octave synth bass drive', atoms: {
        mo_bass:{ role:'bass', family:'bass', fn:'foundation-weight', priority:'signature', foundational:true, instrument:'a driving octave synth bassline' },
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true, instrument:'a bright anthemic solo synth lead' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'a full-energy climb into a key change' },
      }},
      anthem_lead: { label: 'Anthemic key-change lead', atoms: {
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true, instrument:'an anthemic soaring solo synth lead' },
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'support', instrument:'gated tom fills low under the groove' },
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
      lush_analog: { label: 'Lush analog pad bed', bed: 'warm_analog_pad', atoms: {
        mo_body:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'a warm analog string layer' },
      }},
      choir_bells: { label: 'Choir pad and bells', bed: 'synth_choir_pad', atoms: {
        mo_body:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'tuned bells and struck metal' },
      }},
      perc_strings: { label: 'Percussive synth and strings', bed: 'bright_synth_pad', atoms: {
        mo_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a rhythmic percussive synth' },
      }},
    },
    signatures: {
      cs80_lead: { label: 'Pitch-bent analog lead', atoms: {
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true, instrument:'a singing solo analog lead with slow pitch bends' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'one long unhurried melodic statement over the pad' },
      }},
      bell_arp: { label: 'Shimmering bell arpeggio', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', instrument:'a shimmering bell arpeggio quiet over the harmony' },
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true, instrument:'a stately breathy solo analog-brass melody' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'a slow majestic swell to a sustained peak' },
      }},
      deep_sweep: { label: 'Deep resonant sweep', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', instrument:'a deep resonant filter sweep low under the harmony' },
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true, instrument:'a solemn hymn-like solo synth melody' },
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
      pad_perc: { label: 'Synth pad and electronic percussion', bed: 'warm_analog_pad', atoms: {
        mo_body:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'crisp electronic percussion layers' },
      }},
      rhodes_keys: { label: 'Electric keys and pad', bed: 'bright_synth_pad', atoms: {
        mo_body:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'a bright electric piano' },
      }},
      arp_strings: { label: 'Sequenced arp and synth strings', bed: 'filtered_pad', atoms: {
        mo_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a sequenced synth arpeggio' },
        mo_body:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'a synth string layer' },
      }},
    },
    signatures: {
      guitar_synth: { label: 'Guitar-style synth lead', atoms: {
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true, instrument:'a guitar-style solo synth lead with bends' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'the lead answers itself across the empty bars' },
      }},
      bass_riff: { label: 'Punchy synth-bass riff', atoms: {
        mo_bass:{ role:'bass', family:'bass', fn:'foundation-weight', priority:'signature', foundational:true, instrument:'a punchy syncopated synth-bass riff' },
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true, instrument:'a bright cutting solo synth melody' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'a tight vamp opening into a full-energy chorus' },
      }},
      stab_chords: { label: 'Bright stab chords', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', instrument:'bright synth stab chords low on the offbeat' },
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true, instrument:'a fast agile solo synth line' },
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
      stabs_pad: { label: 'Bright synth stabs and pad', bed: 'filtered_pad', atoms: {
        mo_body:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'stabbing synth chord layers' },
      }},
      brass_gated: { label: 'Synth brass and gated texture', bed: 'bright_synth_pad', atoms: {
      }},
      warm_strings: { label: 'Warm pad and synth strings', bed: 'warm_analog_pad', atoms: {
      }},
    },
    signatures: {
      marimba_hook: { label: 'Plucky marimba-toned hook', atoms: {
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true,
                  instrument:'a bright confident solo synth lead' },
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', instrument:'a plucky marimba-toned synth hook under the melody' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'the hook returning between every section' },
      }},
      octave_bass: { label: 'Octave synth bassline', atoms: {
        mo_bass:{ role:'bass', family:'bass', fn:'foundation-weight', priority:'signature', foundational:true, instrument:'a bouncing octave synth bassline' },
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true, instrument:'a bright confident solo synth lead' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'a clean build into a full-energy chorus' },
      }},
      anthem_guitar: { label: 'Anthemic guitar-synth lead', atoms: {
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true, instrument:'an anthemic soaring solo guitar-synth lead' },
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'support', instrument:'bright bell stabs quiet on the phrase ends' },
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
      analog_arp: { label: 'Analog arpeggios and pads', bed: 'warm_analog_pad', atoms: {
        mo_body:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'a running analog arpeggio layer' },
      }},
      disco_strings: { label: 'Disco strings and keys', bed: 'bright_synth_pad', atoms: {
        mo_body:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'a clavinet and electric piano layer' },
      }},
      filtered_house: { label: 'Filtered pads and stabs', bed: 'filtered_pad', atoms: {
        mo_body:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'a stabbing synth chord layer' },
      }},
    },
    signatures: {
      sidechain_pump: { label: 'Sidechain pump', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'sustained chords ducking and pumping in time with the kick' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'the pump deepening as the arrangement fills out' },
      }},
      vocal_chop: { label: 'Filtered vocal chops', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'filtered vocal chops on the offbeats, low in the mix' },
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'core', instrument:'a bright analog synth melody' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'a long filter build into the chorus' },
      }},
      arp_climb: { label: 'Climbing arpeggio build', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'a climbing arpeggio figure under the melody' },
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
      house_organ: { label: 'House organ and pads', bed: 'warm_analog_pad', atoms: {
        mo_body:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'a stabbing house organ layer' },
      }},
      sample_loop: { label: 'Sampled loops and keys', bed: 'bright_synth_pad', atoms: {
        mo_body:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'a bright electric piano layer' },
      }},
      deep_pad: { label: 'Deep pads and strings', bed: 'filtered_pad', atoms: {
        mo_body:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'a synth string layer' },
      }},
    },
    signatures: {
      chopped_stabs: { label: 'Chopped vocal stabs', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'chopped vocal stabs across the beat, low in the mix' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'the stabs re-trigger harder in the breakdown' },
      }},
      organ_riff: { label: 'Driving organ riff', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'a house organ riff under the groove' },
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'core', instrument:'a raw insistent synth hook' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'a stripped breakdown, rebuilds to full' },
      }},
      filter_sweep: { label: 'Raw filter sweep', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'a resonant filter sweep opening across the bars' },
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
      dense_layers: { label: 'Dense atmospheric layers', bed: 'hybrid_pad', atoms: {
        mo_body:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'a processed guitar layer' },
      }},
      processed_gtr: { label: 'Processed guitars', bed: 'filtered_pad', atoms: {
        mo_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a wall of processed guitar texture' },
        mo_body:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'a distorted synth layer' },
      }},
      sparse_dark: { label: 'Sparse and dark', bed: 'drone_bed', atoms: {
        mo_body:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'a treated piano layer' },
      }},
    },
    signatures: {
      industrial_bed: { label: 'Industrial distortion bed', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'a saturated distorted guitar edge low underneath' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'the distortion rises over the arrangement' },
      }},
      treated_noise: { label: 'Treated textural noise', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'treated metallic noise wide and low in the mix' },
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'core', instrument:'a stark repeated melodic fragment' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'a slow build, no release' },
      }},
      space_drop: { label: 'Cavernous drop', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'a lone struck piano note ringing out between the phrases' },
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
      bright_stabs: { label: 'Bright synth stabs', bed: 'bright_synth_pad', atoms: {
        mo_body:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'stabbing synth chord hits' },
      }},
      gated_pop: { label: 'Gated pop production', bed: 'hybrid_pad', atoms: {
        mo_body:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'a punchy synth-brass layer' },
      }},
      piano_pop: { label: 'Pop piano and strings', bed: 'warm_analog_pad', atoms: {
        mo_body:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'layered piano' },
      }},
    },
    signatures: {
      hinrg_bass: { label: 'Hi-NRG octave bass', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'a bouncing hi-NRG octave bass under every bar' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'a steady four-on-the-floor drive' },
      }},
      backing_hooks: { label: 'Layered backing vocal hooks', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'stacked backing-vocal hooks answering behind each line' },
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'core', instrument:'a bright singalong synth melody' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'a key-change lift into the final chorus' },
      }},
      orch_hit: { label: 'Orchestral hit punctuation', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'sampled orchestral hits on the turnarounds, low in the mix' },
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
      polished_keys: { label: 'Polished layered keys', bed: 'warm_analog_pad', atoms: {
        mo_body:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'a layered electric piano' },
      }},
      wide_strings: { label: 'Wide synth strings', bed: 'hybrid_pad', atoms: {
        mo_body:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'a chorused guitar layer' },
      }},
      crisp_pop: { label: 'Crisp pop bed', bed: 'bright_synth_pad', atoms: {
        mo_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'crisp bright synth chords' },
        mo_body:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'a clean rhythm guitar layer' },
      }},
    },
    signatures: {
      crystal_clarity: { label: 'Crystalline separation', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'a clean bell accent ringing clear between the phrases' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'the arrangement widens each section' },
      }},
      wide_chorus: { label: 'Wide chorused sheen', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'a chorused sheen on the upper layers, wide and low' },
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'core', instrument:'a clean melodic synth line' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'a smooth build into the chorus' },
      }},
      vocal_stack: { label: 'Polished vocal stacks', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'stacked harmony layers answering behind the lead' },
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
      clean_synthpop: { label: 'Clean synth-pop keys', bed: 'bright_synth_pad', atoms: {
        mo_body:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'a precise synth keyboard layer' },
      }},
      restrained_arr: { label: 'Restrained arrangement', bed: 'filtered_pad', atoms: {
        mo_body:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'a muted rhythm guitar layer' },
      }},
      warm_analog: { label: 'Warm analog keys', bed: 'warm_analog_pad', atoms: {
        mo_body:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'an electric piano layer' },
      }},
    },
    signatures: {
      precise_arp: { label: 'Precise arpeggio figure', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'a clockwork arpeggio figure ticking under the melody' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'one element enters at a time' },
      }},
      space_placement: { label: 'Deliberate space', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'a single sustained synth note held in the gaps between phrases' },
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'core', instrument:'a plain unadorned melodic line' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'a restrained build, never saturated' },
      }},
      bell_accent: { label: 'Bell accents', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'clean bell accents quiet on the phrase ends' },
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
      sampled_orch: { label: 'Sampled orchestral layers', bed: 'hybrid_pad', atoms: {
        mo_body:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'a stacked synth-brass layer' },
      }},
      layered_wall: { label: 'Layered production wall', bed: 'wordless_choir', atoms: {
      }},
      digital_sheen: { label: 'Digital sheen and keys', bed: 'bright_synth_pad', atoms: {
        mo_body:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'a bright sampled keyboard layer' },
      }},
    },
    signatures: {
      wall_fanfare: { label: 'Wall-of-sound fanfare', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'a sampled brass fanfare answering behind the arrangement' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'a build to a full wall of sound' },
      }},
      sampled_stab: { label: 'Sampled stab punctuation', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'sampled orchestral stabs through the arrangement, low in the mix' },
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'core', instrument:'a bold anthemic melodic line' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'a full stop then full re-entry' },
      }},
      choir_swell: { label: 'Massed choir swell', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'a massed choir swelling in behind the chorus' },
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
      horn_funk: { label: 'Horn section and funk keys', bed: 'brass_chorale', atoms: {
        mo_body:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'a tight funk horn section' },
      }},
      lush_strings: { label: 'Lush strings and keys', bed: 'lush_strings', atoms: {
        mo_body:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'an electric piano and clavinet layer' },
      }},
      smooth_jazz: { label: 'Smooth jazz bed', bed: 'warm_analog_pad', atoms: {
        mo_body:{ role:'strings', family:'strings', fn:'sustain-under', priority:'core', instrument:'a saxophone section' },
      }},
    },
    signatures: {
      brass_punch: { label: 'Tight brass punches', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'tight brass punches on the offbeats under the groove' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'the horns answer the hook every turnaround' },
      }},
      vocal_stacks: { label: 'Layered vocal stacks', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'stacked backing harmonies answering behind the lead' },
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'core', instrument:'a soulful melodic line' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'a final chorus with horns and voices together' },
      }},
      perc_bed: { label: 'Layered percussion bed', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'layered congas and shakers riding under the groove' },
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
      bigroom: { label: 'Big-room dance body', bed: 'bright_synth_pad', atoms: {
        mo_perc:{ role:'perc', family:'perc', fn:'groove', priority:'core', instrument:'layered clap and snare-roll percussion' },
        mo_bass:{ role:'bass', family:'bass', fn:'foundation-weight', priority:'core', foundational:true, instrument:'a sidechained synth bass' },
        mo_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'stacked anthemic supersaw chords' },
      }},
      electro_pop: { label: 'Electro-pop body', bed: 'warm_analog_pad', atoms: {
        mo_perc:{ role:'perc', family:'perc', fn:'groove', priority:'core', instrument:'crisp electronic percussion layers' },
        mo_bass:{ role:'bass', family:'bass', fn:'foundation-weight', priority:'core', foundational:true, instrument:'a punchy electro synth bass' },
      }},
      progressive: { label: 'Progressive build body', bed: 'filtered_pad', atoms: {
        mo_perc:{ role:'perc', family:'perc', fn:'groove', priority:'core', instrument:'rolling tom and shaker layers' },
        mo_bass:{ role:'bass', family:'bass', fn:'foundation-weight', priority:'core', foundational:true, instrument:'an offbeat synth bass' },
      }},
    },
    signatures: {
      festival_lead: { label: 'Supersaw festival lead', atoms: {
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true, instrument:'a supersaw festival lead opening out on the drop' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'a long riser into the drop' },
      }},
      vocal_chop: { label: 'Filtered vocal chops', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'filtered vocal chops across the beat, low in the mix' },
        mo_counter:{ role:'counter', family:'counter', fn:'answer', priority:'support', instrument:'a bright plucked synth answering under the hook' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'a stripped build then a full-energy drop' },
      }},
      piano_house: { label: 'Piano house lift', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'house piano chords stabbing on the offbeat under the groove' },
        mo_counter:{ role:'counter', family:'counter', fn:'answer', priority:'support', instrument:'a synth line rising quietly through the build' },
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
      funky_house: { label: 'Funky house body', bed: 'warm_analog_pad', atoms: {
        mo_perc:{ role:'perc', family:'perc', fn:'groove', priority:'core', instrument:'crisp handclap and shaker layers' },
      }},
      electro_body: { label: 'Electro body', bed: 'filtered_pad', atoms: {
        mo_perc:{ role:'perc', family:'perc', fn:'groove', priority:'core', instrument:'punchy electronic percussion layers' },
      }},
      summer_house: { label: 'Summer house body', bed: 'bright_synth_pad', atoms: {
        mo_perc:{ role:'perc', family:'perc', fn:'groove', priority:'core', instrument:'light tambourine and clap layers' },
      }},
    },
    signatures: {
      sliding_bass: { label: 'Funky sliding bassline', atoms: {
        mo_bass:{ role:'bass', family:'bass', fn:'foundation-weight', priority:'signature', signature:true, foundational:true, instrument:'a funky sliding synth bassline' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'the bassline carries the groove through the drop' },
      }},
      pluck_hook: { label: 'Plucked synth hook', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'a bright plucked synth hook under the melody' },
        mo_counter:{ role:'counter', family:'counter', fn:'answer', priority:'support', instrument:'a filtered chord stab answering under the hook' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'a clean build into an open drop' },
      }},
      filtered_disco: { label: 'Filtered disco loop', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'a filtered disco guitar loop cycling under the beat' },
        mo_counter:{ role:'counter', family:'counter', fn:'answer', priority:'support', instrument:'a brass-synth stab layer low in the mix' },
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
      nudisco: { label: 'Nu-disco body', bed: 'warm_analog_pad', atoms: {
        mo_perc:{ role:'perc', family:'perc', fn:'groove', priority:'core', instrument:'crisp live-feel percussion layers' },
        mo_bass:{ role:'bass', family:'bass', fn:'foundation-weight', priority:'core', foundational:true, instrument:'a plucky disco bassline' },
      }},
      funk_guitar: { label: 'Funk guitar body', bed: 'bright_synth_pad', atoms: {
        mo_perc:{ role:'perc', family:'perc', fn:'groove', priority:'core', instrument:'tight shaker and conga layers' },
        mo_bass:{ role:'bass', family:'bass', fn:'foundation-weight', priority:'core', foundational:true, instrument:'a slap-inflected funk bassline' },
        mo_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a chorused rhythm guitar' },
      }},
      warm_house: { label: 'Warm house body', bed: 'filtered_pad', atoms: {
        mo_perc:{ role:'perc', family:'perc', fn:'groove', priority:'core', instrument:'soft brushed percussion layers' },
        mo_bass:{ role:'bass', family:'bass', fn:'foundation-weight', priority:'core', foundational:true, instrument:'a round warm synth bassline' },
      }},
    },
    signatures: {
      disco_strings: { label: 'Filtered disco strings', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'filtered disco string swells rising under the groove' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'a smooth filter build into the chorus' },
      }},
      guitar_lick: { label: 'Funk guitar licks', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'clipped funk guitar licks answering on the offbeat' },
        mo_counter:{ role:'counter', family:'counter', fn:'answer', priority:'support', instrument:'a warm electric piano low under the groove' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'a groove-led build adding one layer per section' },
      }},
      sunset_lead: { label: 'Sunset synth lead', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'a warm singing synth lead over the groove' },
        mo_counter:{ role:'counter', family:'counter', fn:'answer', priority:'support', instrument:'a brass-synth stab layer soft under the groove' },
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
      latin_perc: { label: 'Latin percussion body', bed: 'warm_analog_pad', atoms: {
        mo_perc:{ role:'perc', family:'perc', fn:'groove', priority:'core', instrument:'crisp layered latin hand percussion' },
        mo_bass:{ role:'bass', family:'bass', fn:'foundation-weight', priority:'core', foundational:true, instrument:'a bouncing bassline' },
      }},
      dub_body: { label: 'Dub remix body', bed: 'filtered_pad', atoms: {
        mo_perc:{ role:'perc', family:'perc', fn:'groove', priority:'core', instrument:'echoing timbale and conga layers' },
        mo_bass:{ role:'bass', family:'bass', fn:'foundation-weight', priority:'core', foundational:true, instrument:'a dubbed-out bassline' },
      }},
      piano_house: { label: 'Piano house body', bed: 'bright_synth_pad', atoms: {
        mo_perc:{ role:'perc', family:'perc', fn:'groove', priority:'core', instrument:'crisp clap and shaker layers' },
        mo_bass:{ role:'bass', family:'bass', fn:'foundation-weight', priority:'core', foundational:true, instrument:'a house bassline' },
        mo_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'core', instrument:'a bright house piano' },
      }},
    },
    signatures: {
      echo_stabs: { label: 'Echo-drenched vocal stabs', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'looped echo-drenched vocal stabs low in the mix' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'an extended dub breakdown, percussion and echo only' },
      }},
      dub_delay: { label: 'Dub delay throws', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'dub delay throws trailing off every phrase end' },
        mo_counter:{ role:'counter', family:'counter', fn:'answer', priority:'support', instrument:'a filtered organ stab layer low in the mix' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'a long breakdown, one layer at a time' },
      }},
      piano_riff: { label: 'House piano riff', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'a rolling house piano riff under the groove' },
        mo_counter:{ role:'counter', family:'counter', fn:'answer', priority:'support', instrument:'a string-synth stab layer low under the groove' },
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
export function resolveModifier(modId, coreId, sigId, palette) {
  const m = ATOM_MODIFIERS[modId];
  if (!m) return null;
  const cId = (coreId && m.cores[coreId]) ? coreId : Object.keys(m.cores)[0];
  const sId = (sigId && m.signatures[sigId]) ? sigId : Object.keys(m.signatures)[0];
  const atoms = {};
  // THE BED (Phase A). Exactly one sustained bed per core, drawn from the SHARED
  // library in core/beds.js. Injected here rather than authored per modifier so
  // that two artists can legitimately share a bed — John's model: the body is
  // common ground, the fingerprint lives in the signature.
  const bedId = m.cores[cId].bed;
  if (bedId) {
    // A bed authored for the wrong palette would leak synthesis vocabulary onto
    // an acoustic build (or vice versa). Fall back to the palette-neutral hybrid
    // rather than dropping the bed entirely — a core with no bed has no body.
    const useId = bedAllowed(bedId, palette) ? bedId : 'hybrid_pad';
    const bed = bedAtom(useId);
    if (bed) atoms.core_mo_bed = bed;
  }
  for (const [k, a] of Object.entries(m.cores[cId].atoms))      atoms[`core_${k}`] = a;
  for (const [k, a] of Object.entries(m.signatures[sId].atoms)) atoms[`sig_${k}`]  = a;
  return {
    label: m.label, kind: m.kind, family: m.family, congruence: m.congruence,
    atoms, coreId: cId, signatureId: sId, bedId: m.cores[cId].bed || null,
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

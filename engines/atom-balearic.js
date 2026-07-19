/* ==========================================================================
 * atom-balearic.js — atom-character DATA for the atom assembly path.
 * Promoted from proto/atom-proto.mjs. The atom table below is the Suno-VALIDATED
 * Balearic / "Lush cinematic chillout" / Electronic character (John, 2026-07-16)
 * and is preserved VERBATIM — this file relocates it into production, it does
 * not re-author it. The character-agnostic engine lives in core/atoms.js.
 *
 * A character carries, alongside its atom table:
 *   electronicLean — false here (downtempo). Drives overlay congruence gating:
 *                    electronic-only overlays are refused on a non-electronic char.
 *   genreOwned     — families Suno sets from the genre prior (bass timbre, drum
 *                    kit). A cross-genre overlay may not seize these (2026-07-17).
 * ========================================================================*/

export const ATOM_CHARACTERS = {
  'balearic-lush-cinematic': {
    label: 'Lush Cinematic Chillout',
    source: 'Balearic',
    electronicLean: false,
    genreOwned: ['bass', 'drums'],
    mastering: 'Polished Dolby Atmos-Master Atmos -2dB',
    atoms: {
      genre:   { role:'genre', text:'Balearic downtempo' },
      tempo:   { role:'tempo', text:'mid chill, 90-105 BPM, medium energy' },
      bass:    { role:'bass',   family:'bass',   register:'sub',     fn:'foundation-weight',
                 instrument:['sub bass','FM sub-bass'], timbre:['deep'], priority:'core' },
      groove:  { role:'rhythm', family:'drums',  register:'low-mid', fn:'groove',
                 instrument:['a soft downtempo kit','a lounge/house kit with soft kick and brushed snare'],
                 timbre:[], priority:'core' },
      perc:    { role:'perc',   family:'perc',   register:'high',    fn:'groove-thread',
                 instrument:['shaker and triangle accents','a light frame-drum pulse'], timbre:[], priority:'decorative' },
      pads:    { role:'pads',   family:'pad',    register:'mid',     fn:'harmony-bed',
                 instrument:['analogue pads','layered synth pads'], timbre:['lush','evolving'], priority:'core' },
      harmony: { role:'harmony',family:'harmony',register:'mid',     fn:'chord-movement',
                 text:['a slow minor-to-relative-major progression over eight-bar cycles',
                       'suspended add9 voicings opening into a major-seventh resolution',
                       'wide-open sus2 voicings holding before a delayed resolve'], priority:'core' },
      strings: { role:'strings',family:'strings',register:'mid',     fn:'support-bed',
                 instrument:['a sweeping string bed','layered strings'], timbre:['soft'], priority:'support' },
      texture: { role:'texture',family:'texture',register:'low-mid', fn:'sustain-under',
                 instrument:['a low pipe-organ sustain','a cor-anglais layer'], timbre:[], priority:'decorative' },
      lead:    { role:'motif',  family:'lead',   register:'upper-mid',fn:'foreground-melody',
                 instrument:['a Rhodes electric-piano motif','an arpeggiated synth lead','a soft piano motif'],
                 timbre:['warm'], priority:'core' },
      // COUNTER — clarinet was over-rendering. Level is an ATTRIBUTE: low register +
      // pianissimo + buried + occasional, so it answers without dominating.
      counter: { role:'counter',family:'counter',register:'low',     fn:'answer',
                 instrument:['a cello counter-melody','a clarinet counter-line'], timbre:[], priority:'support',
                 prominence:'background', mix:'faint and buried well under the mix',
                 dynamic:'pianissimo', density:'answering only occasionally' },
      colour:  { role:'colour', family:'colour', register:'high',    fn:'accent',
                 instrument:['an occasional glockenspiel accent','a brief flute line','a short tubular-bell tone'],
                 timbre:[], priority:'decorative', chance:0.5 },
      movement:{ role:'movement',family:'production',register:'n/a', fn:'movement',
                 text:['wide stereo panning and slow filter modulation across the pads',
                       'LFO, chorus and phaser movement evolving across the synth layers'], priority:'support' },
    },
  },
};

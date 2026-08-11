/* ==========================================================================
 * composer-layers.js — THE COMPOSER MODIFIER, SIMPLIFIED (John, 2026-07-23).
 *
 * John's decision after round 4: stop building the song AROUND a composer
 * fingerprint. Instead treat the composer as a SECONDARY ARRANGEMENT LAYER that
 * decorates a song already defined by its own genre, character, tempo and
 * sections. The hierarchy is:
 *
 *     existing song -> genre/style/mood/tempo -> section instruction -> fingerprint
 *
 * not the previous "fingerprint -> song built around it". This sidesteps every
 * problem round 4 surfaced: the composer never competes with the genre anchor,
 * never displaces the genre's lead, and never front-weights, because it lives in
 * a secondary clause and in the per-section metatags rather than in the primary
 * style body.
 *
 * EACH COMPOSER PROVIDES TWO THINGS:
 *   1. `style`   — one secondary-layer sentence appended after the character's
 *                  own style prompt. Names the composer's instruments and their
 *                  role, explicitly subordinate ("kept beneath the existing lead
 *                  except at transitions and hook reinforcement").
 *   2. `sections`— what each composer instrument does at each structural point,
 *                  merged into the metatag engine's per-section output in the
 *                  proven piped [Section | short | short] format.
 *
 * THE CONSISTENCY CONTRACT (John, explicit):
 *   "any instrument that the composer layer states in the prompt must at some
 *    point be stated in the meta tags."
 *   Every member of `instruments` MUST appear in `style` AND in at least one
 *   `sections` entry. validate-composer-layers.mjs fails the build otherwise.
 *
 * BANNED LANGUAGE:
 *   John: "Anything that was banned originally still keep that banned." The
 *   round-4 ban (ostinato, staccato, stab/stabs, fanfare, orchestral hits) is
 *   global and still applies here. The reference document he supplied used
 *   'low-string ostinato', 'orchestral stabs' etc.; those are translated to the
 *   neutral forms the ban already uses — 'repeating figure/cell', 'short chords',
 *   'sampled orchestral chords'. core/knowledge.js BANNED_ARTICULATION_RE is
 *   enforced across every string in this file.
 *
 * Section keys are the metatag engine's canonical types: intro, verse,
 * prechorus, chorus, bridge, outro.
 * ========================================================================*/

// A composer's instruments as short metatag tokens. Kept as an explicit list so
// the consistency validator has a canonical set to check `style` and `sections`
// against, rather than trying to parse instruments back out of prose.
export const COMPOSER_LAYERS = {

  composer_zimmer: {
    label: 'Hans Zimmer',
    instruments: ['low strings', 'French horns', 'trombones', 'deep synth bass', 'analog synth pulse', 'large low toms'],
    style: 'secondary arrangement layer of low strings, French horns, trombones, deep synth bass, analog synth pulse and large low toms in short repeating cells and pedal tones, building gradually and kept beneath the existing lead except at transitions and hook reinforcement',
    sections: {
      intro:     ['analog synth pulse', 'sparse low strings'],
      verse:     ['low strings', 'light large low toms'],
      prechorus: ['thicker low strings', 'short French horns'],
      chorus:    ['French horns reinforce hook', 'trombones', 'deep synth bass', 'large low toms'],
      bridge:    ['analog synth pulse', 'deep synth bass', 'reduced low strings'],
      outro:     ['low strings', 'final French horns'],
    },
  },

  composer_williams: {
    label: 'John Williams',
    instruments: ['trumpets', 'French horns', 'string ensemble', 'flutes', 'clarinets', 'harp', 'timpani', 'snare drum', 'glockenspiel'],
    style: 'secondary arrangement layer of trumpets, French horns, string ensemble, flutes, clarinets, harp, timpani, snare drum and glockenspiel in short answering motifs, woodwind counterlines and brass punctuation woven around the existing lead',
    sections: {
      intro:     ['trumpets and French horns motif', 'snare drum pickup', 'harp'],
      verse:     ['string ensemble', 'flutes and clarinets answer', 'glockenspiel'],
      prechorus: ['harp movement', 'rising French horns'],
      chorus:    ['trumpets and French horns reinforce hook', 'timpani', 'glockenspiel'],
      bridge:    ['flutes and clarinets motif', 'harp', 'string ensemble'],
      outro:     ['short trumpets reprise', 'string ensemble', 'timpani'],
    },
  },

  composer_arnold: {
    label: 'David Arnold',
    instruments: ['brass section', 'string ensemble', 'electric guitar', 'synth bass', 'electronic drum kit', 'piano'],
    style: 'secondary arrangement layer of brass section, string ensemble, electric guitar, synth bass, electronic drum kit and piano in syncopated accents and short brass hooks around the existing song',
    sections: {
      intro:     ['piano figure', 'synth bass pulse'],
      verse:     ['string ensemble', 'restrained electronic drum kit', 'electric guitar'],
      prechorus: ['denser string ensemble', 'rising brass section'],
      chorus:    ['brass section reinforces hook', 'synth bass', 'electronic drum kit', 'electric guitar'],
      bridge:    ['piano figure', 'reduced string ensemble'],
      outro:     ['short brass section reprise', 'synth bass', 'electronic drum kit'],
    },
  },

  composer_newman: {
    label: 'Thomas Newman',
    instruments: ['piano', 'marimba', 'xylophone', 'string ensemble', 'acoustic guitar', 'flute', 'frame drum'],
    style: 'secondary arrangement layer of piano, marimba, xylophone, string ensemble, acoustic guitar, flute and frame drum in short repeating cells, isolated notes and interlocking mallet figures with deliberate gaps around the existing melody',
    sections: {
      intro:     ['isolated piano notes', 'single marimba', 'flute'],
      verse:     ['marimba and xylophone interlock', 'acoustic guitar replies', 'frame drum'],
      prechorus: ['brief string ensemble swells', 'flute', 'light frame drum'],
      chorus:    ['piano motif', 'marimba', 'string ensemble'],
      bridge:    ['acoustic guitar', 'flute', 'frame drum accents'],
      outro:     ['reduced piano cell', 'single marimba', 'final string ensemble swell'],
    },
  },

  composer_goransson: {
    label: 'Ludwig Goransson',
    instruments: ['bass recorder', 'talking drum', '808 bass', 'acoustic guitar', 'piano', 'Mellotron', 'string ensemble'],
    style: 'secondary arrangement layer of bass recorder, talking drum, 808 bass, acoustic guitar, piano, Mellotron and string ensemble where a short bass-recorder cell seeds the rhythm and the others interlock around the existing lead',
    sections: {
      intro:     ['short bass recorder cell', 'isolated piano', 'Mellotron'],
      verse:     ['talking drum', '808 bass', 'acoustic guitar'],
      prechorus: ['bass recorder cell', 'acoustic guitar', 'Mellotron'],
      chorus:    ['string ensemble over bass recorder cell', 'talking drum', '808 bass'],
      bridge:    ['piano', 'Mellotron', 'bass recorder'],
      outro:     ['bass recorder cell', 'acoustic guitar', 'reduced 808 bass', 'piano'],
    },
  },

  composer_horner: {
    label: 'James Horner',
    instruments: ['piano', 'string ensemble', 'French horns', 'solo flute', 'low whistle', 'mixed choir', 'timpani'],
    style: 'secondary arrangement layer of piano, string ensemble, French horns, solo flute, low whistle, mixed choir and timpani in piano fragments, long string support and horn counterlines around the existing lead',
    sections: {
      intro:     ['short piano figure', 'low whistle', 'solo flute'],
      verse:     ['sustained string ensemble', 'piano fragments', 'French horns'],
      prechorus: ['solo flute reply', 'expanding string ensemble', 'light timpani'],
      chorus:    ['string ensemble', 'French horns', 'restrained mixed choir', 'timpani'],
      bridge:    ['piano to solo flute', 'low whistle'],
      outro:     ['piano and string ensemble', 'final French horns', 'solo flute'],
    },
  },

  composer_goldsmith: {
    label: 'Jerry Goldsmith',
    instruments: ['string ensemble', 'French horn', 'trumpets', 'piano', 'synthesizer', 'snare drum', 'bass drum', 'guiro'],
    style: 'secondary arrangement layer of string ensemble, French horn, trumpets, piano, synthesizer, snare drum, bass drum and guiro in short odd-meter repeating cells with offset accents and orchestral-electronic hand-offs around the existing lead',
    sections: {
      intro:     ['synthesizer cell', 'guiro', 'isolated piano notes'],
      verse:     ['string ensemble', 'snare drum offsets', 'short French horn'],
      prechorus: ['bass drum', 'trumpets'],
      chorus:    ['French horn over string ensemble', 'synthesizer', 'trumpets'],
      bridge:    ['piano', 'guiro', 'synthesizer'],
      outro:     ['reduced string ensemble', 'French horn', 'single bass drum', 'piano'],
    },
  },

  composer_nyman: {
    label: 'Michael Nyman',
    instruments: ['piano arpeggios', 'string quartet', 'soprano saxophone', 'alto saxophone', 'tenor saxophone', 'bass trombone', 'bass guitar'],
    style: 'secondary arrangement layer of piano arpeggios, string quartet, soprano saxophone, alto saxophone, tenor saxophone, bass trombone and bass guitar repeating short cells with minimal variation while the existing melody stays primary',
    sections: {
      intro:     ['repeated piano arpeggios', 'bass trombone'],
      verse:     ['string quartet', 'piano arpeggios', 'bass guitar'],
      prechorus: ['soprano saxophone', 'alto saxophone', 'tenor saxophone'],
      chorus:    ['piano arpeggios', 'string quartet', 'soprano saxophone', 'alto saxophone', 'tenor saxophone'],
      bridge:    ['bass trombone', 'bass guitar'],
      outro:     ['piano arpeggios', 'string quartet', 'bass guitar'],
    },
  },

  composer_dudley: {
    label: 'Anne Dudley',
    instruments: ['grand piano', 'string ensemble', 'sampled orchestral chords', 'synth bass', 'electronic drum kit', 'sampled metal strikes'],
    style: 'secondary arrangement layer of grand piano, string ensemble, sampled orchestral chords, synth bass, electronic drum kit and sampled metal strikes in short sampled punctuation and precise string voicings around the existing song',
    sections: {
      intro:     ['grand piano figure', 'sampled orchestral chords'],
      verse:     ['electronic drum kit', 'synth bass', 'sampled metal strikes'],
      prechorus: ['grand piano', 'string ensemble', 'sampled orchestral chords'],
      chorus:    ['string ensemble reinforces hook', 'electronic drum kit', 'synth bass'],
      bridge:    ['grand piano', 'sampled orchestral chords'],
      outro:     ['grand piano', 'string ensemble', 'sampled metal strikes'],
    },
  },

  composer_barry: {
    label: 'John Barry',
    instruments: ['violin section', 'French horns', 'muted trumpets', 'electric guitar', 'cimbalom', 'analog synthesizer', 'drum kit'],
    style: 'secondary arrangement layer of violin section, French horns, muted trumpets, electric guitar, cimbalom, analog synthesizer and drum kit in short recurring motifs, sustained string lines and brass punctuation around the existing lead',
    sections: {
      intro:     ['electric guitar motif', 'cimbalom'],
      verse:     ['sustained violin section', 'analog synthesizer', 'electric guitar', 'drum kit'],
      prechorus: ['French horns', 'restrained drum kit'],
      chorus:    ['French horns and muted trumpets reinforce hook', 'violin section', 'muted trumpets'],
      bridge:    ['cimbalom', 'analog synthesizer', 'reduced violin section'],
      outro:     ['violin section', 'French horns', 'electric guitar motif'],
    },
  },

  composer_conti: {
    label: 'Bill Conti',
    instruments: ['piano', 'string ensemble', 'trumpets', 'French horns', 'electric guitar', 'bass guitar', 'drum kit'],
    style: 'secondary arrangement layer of piano, string ensemble, trumpets, French horns, electric guitar, bass guitar and drum kit starting from a small piano motif with brass responses around the existing hook',
    sections: {
      intro:     ['short piano motif', 'single trumpets'],
      verse:     ['piano motif', 'bass guitar', 'restrained drum kit', 'light string ensemble'],
      prechorus: ['French horns', 'stronger bass guitar and drum kit'],
      chorus:    ['trumpets and French horns reinforce hook', 'electric guitar', 'bass guitar', 'drum kit'],
      bridge:    ['piano motif', 'reduced string ensemble'],
      outro:     ['short trumpets reprise', 'electric guitar', 'final piano motif'],
    },
  },

  composer_morricone: {
    label: 'Ennio Morricone',
    instruments: ['ocarina', 'wordless soprano', 'twanging electric guitar', 'trumpet', 'string ensemble', 'jews-harp', 'hand percussion'],
    style: 'secondary arrangement layer of ocarina, wordless soprano, twanging electric guitar, trumpet, string ensemble, jews-harp and hand percussion in lone solo lines threaded around the existing melody',
    sections: {
      intro:     ['ocarina', 'hand percussion', 'jews-harp'],
      verse:     ['twanging electric guitar', 'string ensemble'],
      prechorus: ['wordless soprano', 'rising string ensemble'],
      chorus:    ['trumpet', 'wordless soprano over string ensemble'],
      bridge:    ['jews-harp', 'hand percussion'],
      outro:     ['ocarina', 'reduced string ensemble', 'wordless soprano'],
    },
  },

  composer_lloydwebber: {
    label: 'Andrew Lloyd Webber',
    instruments: ['string ensemble', 'solo violin', 'trumpet', 'pipe organ', 'harp', 'piano', 'electric guitar'],
    style: 'secondary arrangement layer of string ensemble, solo violin, trumpet, pipe organ, harp, piano and electric guitar in soaring theatrical lines around the existing lead',
    sections: {
      intro:     ['piano', 'soft string ensemble', 'harp'],
      verse:     ['solo violin', 'string ensemble', 'electric guitar'],
      prechorus: ['harp', 'rising string ensemble'],
      chorus:    ['solo violin and trumpet reinforce hook', 'pipe organ'],
      bridge:    ['piano', 'electric guitar', 'reduced string ensemble'],
      outro:     ['solo violin', 'string ensemble', 'pipe organ'],
    },
  },

  // ---- ELECTRONIC / SYNTH-ERA COMPOSERS -------------------------------------
  composer_moroder: {
    label: 'Giorgio Moroder',
    instruments: ['sequenced synth bass', 'analog synth lead', 'synth brass', 'filtered arpeggio', 'vocoder', 'drum machine'],
    style: 'secondary arrangement layer of sequenced synth bass, analog synth lead, synth brass, filtered arpeggio, vocoder and drum machine in a relentless sequence around the existing lead',
    sections: {
      intro:     ['filtered arpeggio', 'sequenced synth bass', 'vocoder'],
      verse:     ['sequenced synth bass', 'drum machine'],
      prechorus: ['filtered arpeggio opens', 'synth brass'],
      chorus:    ['analog synth lead', 'synth brass', 'sequenced synth bass', 'vocoder'],
      bridge:    ['vocoder', 'filtered arpeggio'],
      outro:     ['sequenced synth bass', 'reduced drum machine'],
    },
  },

  composer_fidel: {
    label: 'Brad Fidel',
    instruments: ['industrial synth bass', 'metallic synth', 'struck steel', 'synth choir', 'drum machine'],
    style: 'secondary arrangement layer of industrial synth bass, metallic synth, struck steel, synth choir and drum machine in a cold repeating figure around the existing lead',
    sections: {
      intro:     ['struck steel', 'industrial synth bass'],
      verse:     ['industrial synth bass', 'drum machine'],
      prechorus: ['metallic synth', 'struck steel'],
      chorus:    ['metallic synth', 'industrial synth bass', 'drum machine', 'synth choir'],
      bridge:    ['synth choir', 'metallic synth'],
      outro:     ['industrial synth bass', 'struck steel', 'synth choir'],
    },
  },

  composer_dicola: {
    label: 'Vince DiCola',
    instruments: ['synth brass', 'analog synth lead', 'piano', 'gated toms', 'drum machine'],
    style: 'secondary arrangement layer of synth brass, analog synth lead, piano, gated toms and drum machine in bright anthemic lines around the existing lead',
    sections: {
      intro:     ['piano', 'drum machine'],
      verse:     ['synth brass', 'drum machine'],
      prechorus: ['rising synth brass', 'gated toms'],
      chorus:    ['analog synth lead', 'synth brass', 'gated toms'],
      bridge:    ['piano', 'reduced drum machine'],
      outro:     ['analog synth lead', 'drum machine'],
    },
  },

  composer_vangelis: {
    label: 'Vangelis',
    instruments: ['analog synth lead', 'analog synth brass', 'bell arpeggio', 'synth choir', 'deep filter sweep'],
    style: 'secondary arrangement layer of analog synth lead, analog synth brass, bell arpeggio, synth choir and a deep filter sweep in slow singing lines around the existing lead',
    sections: {
      intro:     ['bell arpeggio', 'deep filter sweep'],
      verse:     ['analog synth brass', 'bell arpeggio'],
      prechorus: ['synth choir', 'rising analog synth brass'],
      chorus:    ['analog synth lead', 'synth choir'],
      bridge:    ['deep filter sweep', 'bell arpeggio'],
      outro:     ['analog synth lead', 'synth choir'],
    },
  },

  composer_hammer: {
    label: 'Jan Hammer',
    instruments: ['guitar-style synth lead', 'analog synth bass', 'electric piano', 'synth brass', 'drum machine'],
    style: 'secondary arrangement layer of a guitar-style synth lead, analog synth bass, electric piano, synth brass and drum machine in bright cutting lines around the existing lead',
    sections: {
      intro:     ['electric piano', 'analog synth bass'],
      verse:     ['analog synth bass', 'drum machine'],
      prechorus: ['synth brass', 'rising electric piano'],
      chorus:    ['guitar-style synth lead', 'synth brass', 'analog synth bass'],
      bridge:    ['electric piano', 'reduced drum machine'],
      outro:     ['guitar-style synth lead', 'analog synth bass'],
    },
  },

  composer_faltermeyer: {
    label: 'Harold Faltermeyer',
    instruments: ['marimba-toned synth', 'analog synth lead', 'analog synth bass', 'synth brass', 'gated drum machine'],
    style: 'secondary arrangement layer of a marimba-toned synth, analog synth lead, analog synth bass, synth brass and gated drum machine in a bright confident hook around the existing lead',
    sections: {
      intro:     ['marimba-toned synth', 'analog synth bass'],
      verse:     ['analog synth bass', 'gated drum machine'],
      prechorus: ['synth brass', 'marimba-toned synth'],
      chorus:    ['analog synth lead', 'synth brass', 'analog synth bass'],
      bridge:    ['marimba-toned synth', 'reduced gated drum machine'],
      outro:     ['analog synth lead', 'analog synth bass'],
    },
  },
};

export const COMPOSER_LAYER_IDS = Object.keys(COMPOSER_LAYERS);

// A composer's list for the dropdown.
export function composerLayerList() {
  return COMPOSER_LAYER_IDS.map((id) => ({ id, label: COMPOSER_LAYERS[id].label }));
}

// The secondary-layer style clause for a composer, appended to the character's
// own style prompt. Returns '' for an unknown id so a stale selection degrades
// to no layer rather than throwing.
export function composerStyleLayer(layerId) {
  const layer = COMPOSER_LAYERS[layerId];
  return layer ? layer.style : '';
}

// Merge a composer's section tokens into an existing metatag section line.
// The engine emits '[Section | a | b | c]'; we append the composer tokens after a
// separator so the original song section is preserved and the composer decorates
// it. `sectionType` is the canonical type (intro/verse/prechorus/chorus/bridge/
// outro); `existingLine` is the engine's already-built line for that section.
export function decorateSection(existingLine, layerId, sectionType) {
  const layer = COMPOSER_LAYERS[layerId];
  if (!layer) return existingLine;
  const tokens = layer.sections[sectionType];
  if (!tokens || !tokens.length) return existingLine;
  // strip the trailing ] , add the composer tokens, re-close.
  const base = existingLine.replace(/\]\s*$/, '');
  return `${base} | ${tokens.join(' | ')}]`;
}

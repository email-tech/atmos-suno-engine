/* ============================================================================
 * overlays.js — MODIFIER OVERLAYS (Composer / Producer / Remixer)
 *
 * An overlay is NOT a genre and NOT a prompt. It is a small set of SIGNATURE
 * DELTAS — the 3-6 traits that make one composer/producer/remixer unmistakably
 * themselves — written INTO the engine's existing arrangement slots.
 *
 * WHY SLOT-WRITES, NOT APPENDED CLAUSES:
 *   an overlay replaces the text of a slot the engine already carries (harmony,
 *   motif, counter, texture, movement, colour, arc). Slot COUNT stays flat, so
 *   the prompt does not balloon and the result reads as ONE arrangement rather
 *   than an engine prompt with a second prompt glued to the end.
 *
 * SLOT RIGHTS (hard):
 *   composer -> harmony, motif, counter, texture, colour, arc
 *   producer -> movement, colour, processing, arc   (+ 'treat', a drum-mix
 *               treatment clause — never the drum FAMILY itself)
 *   remixer  -> groove (a treatment on the engine's own drums), edit, movement, arc
 *   NOBODY writes: genre anchor, tempo/BPM, drum family, bass family.
 *   A USER-LOCKED slot always beats an overlay.
 *
 * TEXT RULES (same as every engine): no artist names (Suno strips them — the
 * name is UI only), no mood/affect words, no non-musical content.
 *
 * TAGS + FORBIDS:
 *   tags[]   - traits a character may reject (e.g. 'four-on-floor' cannot land
 *              on a beatless character).
 *   forbid[] - roles this overlay is never allowed to write. SAW carries
 *              forbid:['rhythm'] per John (their drum signature is too 80s).
 *   negative[] - bans merged into the negative field when the overlay is on.
 * ==========================================================================*/

/* ---- Composer (Orchestral) ---------------------------------------------- */
const COMPOSER_ORCHESTRAL = {
  arnold: {
    label: 'David Arnold', family: 'orchestral',
    harmony: 'wide functional harmonic movement landing on a full cadence',
    motif: 'a small thematic motif expanded into a full orchestral statement',
    counter: 'intricate woodwind counter-melodies threading under the theme',
    texture: 'tremolo string swells with timpani accents',
    color: 'a warm brass fanfare',
    arc: 'building to a massed orchestral crescendo then resolving on the final chord',
    tags: ['orchestral', 'crescendo'],
  },
  newman: {
    label: 'Thomas Newman', family: 'orchestral',
    harmony: 'modal Dorian chord movement resolving late and quietly onto the tonic',
    motif: 'a sparse piano motif over a marimba ostinato',
    counter: 'a lone oboe line answering in the gaps',
    texture: 'prepared piano and hammered dulcimer shimmer',
    color: 'vibraphone and celesta sparkle',
    arc: 'the ostinato holding while colours enter and thin away',
    tags: ['orchestral', 'ostinato', 'tuned-percussion'],
  },
  goransson: {
    label: 'Ludwig Goransson', family: 'orchestral',
    harmony: 'spare modal harmony over a sustained low drone resolving to the root',
    motif: 'a single hand-played motif layered against itself',
    texture: 'processed hybrid strings over an analog synth bed',
    movement: 'deep low-end pulse with evolving saturation',
    arc: 'one idea layered upward until it fills the field then settling',
    tags: ['orchestral', 'hybrid'],
  },
  horner: {
    label: 'James Horner', family: 'orchestral',
    harmony: 'warm modal harmony resolving on a plagal cadence',
    motif: 'a long-breathed soaring melody in the high strings',
    counter: 'a solo wooden flute answering the theme',
    texture: 'a wordless choir pad beneath the strings',
    color: 'harp and celesta figures',
    arc: 'a long lyrical build to a full-orchestra statement',
    tags: ['orchestral', 'crescendo'],
  },
  goldsmith: {
    label: 'Jerry Goldsmith', family: 'orchestral',
    harmony: 'angular chromatic harmony resolving firmly to the tonic',
    motif: 'a terse repeated brass motif',
    counter: 'a low woodwind ostinato under the theme',
    texture: 'metallic percussion and clustered strings',
    arc: 'tension wound tight then released on the final cadence',
    tags: ['orchestral', 'chromatic'],
  },
  nyman: {
    label: 'Michael Nyman', family: 'orchestral',
    harmony: 'driving repeated modal chord cells over a baroque ground bass',
    motif: 'an insistent unison melodic line doubled across the ensemble',
    counter: 'saxophone doubling the string line an octave above',
    texture: 'a mechanical quaver string pulse',
    arc: 'repetition thickening in layers before a clean stop',
    tags: ['orchestral', 'minimalist', 'repetition'],
  },
  morricone: {
    label: 'Ennio Morricone', family: 'orchestral',
    harmony: 'simple modal harmony with a wide plagal resolution',
    motif: 'a lone whistled ocarina melody carrying the tune',
    counter: 'a wordless soprano answering the melody',
    texture: 'sparse tremolo strings with twanging reverbed guitar',
    color: 'a distant trumpet call',
    arc: 'wide open space with single voices entering one at a time',
    tags: ['orchestral', 'sparse'],
  },
  dudley: {
    label: 'Anne Dudley', family: 'orchestral',
    harmony: 'neo-classical string writing with rich suspended voicings',
    motif: 'a lyrical string theme carried over the programmed groove',
    texture: 'sampled orchestral stabs and choir hits',
    arc: 'orchestra and sampled elements trading the foreground',
    tags: ['orchestral', 'sampled'],
  },
  lloydwebber: {
    label: 'Andrew Lloyd Webber', family: 'orchestral',
    harmony: 'theatrical harmony with a key-lift modulation into the final chorus',
    motif: 'a broad singable theme restated in rising keys',
    counter: 'a string counter-melody running against the vocal line',
    texture: 'pit-orchestra strings with brass',
    arc: 'building to a full theatrical final-chorus statement',
    tags: ['orchestral', 'theatrical', 'modulation'],
  },
  barry: {
    label: 'John Barry', family: 'orchestral',
    harmony: 'a slow tread of minor-to-major harmony resolving warmly',
    motif: 'a simple melody stated plainly and left to breathe',
    counter: 'French horn and oboe accents answering the melody',
    texture: 'slow silky legato strings held as a sustained bed',
    color: 'muted brass and low flute',
    arc: 'restrained and unhurried with the dynamics held back',
    tags: ['orchestral', 'restrained', 'legato-strings'],
  },
  conti: {
    label: 'Bill Conti', family: 'orchestral',
    harmony: 'rising major progressions resolving upward',
    motif: 'a brass fanfare theme in the horns',
    texture: 'a punchy horn section over sustained strings',
    arc: 'a steady build to a full brass statement',
    tags: ['orchestral', 'brass'],
  },
  williams: {
    label: 'John Williams', family: 'orchestral',
    harmony: 'functional harmony with bold modulation and a full cadence',
    motif: 'a long-form thematic melody developed and restated',
    counter: 'contrapuntal woodwind and horn lines against the theme',
    texture: 'full-orchestra tutti with tremolo strings',
    arc: 'the theme returning transformed at the climax',
    tags: ['orchestral', 'thematic', 'crescendo'],
  },
  zimmer: {
    label: 'Hans Zimmer', family: 'orchestral',
    harmony: 'one harmonic centre held while the layers accumulate',
    motif: 'a low brass ostinato motif',
    counter: 'a sixteenth-note string ostinato driving underneath',
    texture: 'massed low brass over a synth-orchestra hybrid bed',
    arc: 'a layered build to a huge unison statement then a resolving chord',
    tags: ['orchestral', 'ostinato', 'hybrid'],
  },
};

/* ---- Composer (Electronic) ---------------------------------------------- */
const COMPOSER_ELECTRONIC = {
  moroder: {
    label: 'Giorgio Moroder', family: 'electronic',
    harmony: 'a simple minor vamp with filtered chord pumps',
    motif: 'a sequenced arpeggiated synth-bass line driving the whole track',
    counter: 'a filtered saw lead carrying the melody',
    texture: 'shimmering analog pads',
    color: 'handclap and tambourine accents on the backbeat',
    arc: 'the sequence running unbroken while layers stack over it',
    tags: ['electronic', 'sequenced', 'four-on-floor'],
  },
  fidel: {
    label: 'Brad Fidel', family: 'electronic',
    harmony: 'a static minor ostinato held long before a late resolution',
    motif: 'a low analog arpeggio motif',
    texture: 'icy digital pads over metallic bass pulses',
    color: 'filtered noise swells and dissonant stabs',
    arc: 'mechanical tension building without release until the close',
    tags: ['electronic', 'ostinato', 'static-harmony'],
  },
  dicola: {
    label: 'Vince DiCola', family: 'electronic',
    harmony: 'driving major-key progressions with a hard modulation',
    motif: 'a syncopated synth-brass melodic hook',
    texture: 'stacked polysynth chords',
    arc: 'a high-energy build into a full anthem statement',
    tags: ['electronic', 'anthem'],
  },
  vangelis: {
    label: 'Vangelis', family: 'electronic',
    harmony: 'slow drifting harmonic movement resolving softly',
    motif: 'a long sustained lead line shaped with expressive pitch bend',
    texture: 'layered analog brass and choir pads',
    movement: 'wide evolving chorus with long reverb tails',
    arc: 'unfolding slowly across a vast field',
    tags: ['electronic', 'analog', 'sustained'],
  },
  hammer: {
    label: 'Jan Hammer', family: 'electronic',
    harmony: 'rock-derived minor progressions',
    motif: 'a bright synth lead played with guitar-style bends',
    texture: 'glassy FM pads',
    movement: 'gated ambience with stereo delay throws',
    tags: ['electronic', 'synthwave'],
  },
  faltermeyer: {
    label: 'Harold Faltermeyer', family: 'electronic',
    harmony: 'a simple major-to-minor vamp',
    motif: 'a bright analog polysynth lead hook',
    texture: 'punchy stacked polysynth chords',
    movement: 'clean chorus with short bright delays',
    tags: ['electronic', 'synthwave'],
  },
};

/* ---- Producer ------------------------------------------------------------ */
const PRODUCER = {
  price: {
    label: 'Stuart Price',
    movement: 'sidechain pumping with long filtered builds',
    color: 'vocoder harmony doubles',
    treat: 'a glossy automated mix with tight punchy drums',
    arc: 'filtering down then opening into the hook',
    tags: ['electronic', 'sidechain'],
  },
  flood: {
    label: 'Flood',
    movement: 'saturated analog compression with roomy ambience',
    texture: 'synths and guitars blended into a shimmering wall',
    color: 'grainy delays and filtered reverb tails',
    treat: 'chorused bass and parallel-distorted vocals',
    tags: ['saturation', 'wall-of-sound'],
  },
  terry: {
    label: 'Todd Terry',
    movement: 'filtered loop stabs with rough sample chops',
    color: 'chopped vocal stabs',
    treat: 'a raw punchy drum-machine mix',
    arc: 'stripping to the loop then dropping the full groove back in',
    tags: ['house', 'sample-chop'],
  },
  saw: {
    label: 'Stock Aitken Waterman',
    harmony: 'a simple diatonic progression built around the hook',
    color: 'bright layered backing-vocal stacks',
    treat: 'a clean bright polished mix',
    arc: 'hook-first arrangement returning to the chorus quickly',
    forbid: ['rhythm'],                       // John: no SAW drum signature — too 80s
    negative: ['gated 80s drums', 'eighties drum machine'],
    tags: ['pop', 'hook-first'],
  },
  mendelsohn: {
    label: 'Julian Mendelsohn',
    movement: 'crisp bright reverbs with tight controlled dynamics',
    color: 'layered backing-vocal stacks',
    treat: 'a punchy mix with a bright top end',
    tags: ['pop', 'polish'],
  },
  hague: {
    label: 'Stephen Hague',
    movement: 'spacious digital sheen with controlled delays',
    color: 'bell-like synth counter-lines',
    treat: 'a clean precise mix with sequencer-locked parts',
    arc: 'a disciplined arrangement with parts entering one at a time',
    tags: ['synthpop', 'precision'],
  },
  horn: {
    label: 'Trevor Horn',
    texture: 'sampled orchestral stabs and sampled vocal beds played as an instrument',
    movement: 'the arrangement clearing to a full stop then rebuilding',
    color: 'sampled choir hits',
    treat: 'a high-gloss digital mix built at large scale',
    arc: 'a layered build broken by sudden full stops',
    tags: ['sampled', 'orchestral-stabs', 'large-scale'],
  },
  quincy: {
    label: 'Quincy Jones',
    harmony: 'rich extended jazz voicings with modulations and turnarounds',
    counter: 'a horn section answering the lead in call-and-response',
    color: 'stacked gospel-tinged backing harmonies',
    texture: 'a sweeping string bed gluing the arrangement together',
    treat: 'a wide mix with a deep controlled low end',
    tags: ['soul', 'horns', 'jazz-harmony'],
  },
};

/* ---- Remixer ------------------------------------------------------------- */
const REMIXER = {
  liebrand: {
    label: 'Ben Liebrand',
    groove: 'edited tight into a club arrangement',
    edit: 'spliced hook edits and re-triggered stabs',
    movement: 'a long filtered breakdown and rebuild',
    color: 'sampled orchestral hit accents',
    tags: ['club', 'edit'],
  },
  pettibone: {
    label: 'Shep Pettibone',
    groove: 'stripped back to a dub-style extended groove',
    edit: 'stuttered staccato vocal-fragment edits',
    movement: 'eighth-note triplet delay throws over long breakdowns',
    arc: 'breaking down to the bare groove then rebuilding to the hook',
    tags: ['club', 'dub', 'edit'],
  },
};

export const OVERLAYS = {
  composer: Object.assign({}, COMPOSER_ORCHESTRAL, COMPOSER_ELECTRONIC),
  producer: PRODUCER,
  remixer: REMIXER,
};

// roles an overlay TYPE is allowed to write. Nothing else is ever accepted.
export const SLOT_RIGHTS = {
  composer: ['harmony', 'motif', 'counter', 'texture', 'color', 'arc'],
  producer: ['harmony', 'counter', 'texture', 'movement', 'color', 'treat', 'arc'],
  remixer:  ['groove', 'edit', 'movement', 'color', 'arc'],
};

export function overlayList(kind) {
  const g = OVERLAYS[kind] || {};
  return Object.keys(g).map(id => ({ id, label: g[id].label, family: g[id].family || null }));
}

/* Resolve the chosen overlays into ONE role map the builders can apply.
 *   sel  = { composer:'barry'|'', producer:'horn'|'', remixer:'' }
 *   ctx  = { beatless:bool, banTags:[..] }   (from the engine character)
 * Later overlays do not clobber earlier ones: first writer of a role wins,
 * in order composer -> producer -> remixer, so the composer keeps the harmony
 * and the producer/remixer keep the production/edit roles.
 * Returns { roles:{...}, negative:[...], names:[...] }.
 */
export function resolveOverlays(sel = {}, ctx = {}) {
  const roles = {};
  const negative = [];
  const names = [];
  const banTags = new Set(ctx.banTags || []);

  for (const kind of ['composer', 'producer', 'remixer']) {
    const id = sel[kind];
    if (!id) continue;
    const ov = (OVERLAYS[kind] || {})[id];
    if (!ov) continue;
    names.push(`${kind}:${id}`);

    // character-level rejection of a whole overlay trait family
    const tags = ov.tags || [];
    if (tags.some(t => banTags.has(t))) continue;

    const forbid = new Set(ov.forbid || []);
    for (const role of SLOT_RIGHTS[kind]) {
      if (!ov[role]) continue;
      if (forbid.has(role)) continue;
      // rhythm-writing roles never land on a beatless character
      if (ctx.beatless && (role === 'groove' || role === 'treat')) continue;
      if (forbid.has('rhythm') && (role === 'groove' || role === 'treat')) continue;
      if (roles[role] == null) roles[role] = ov[role];
    }
    if (ov.negative) negative.push(...ov.negative);
  }
  return { roles, negative, names };
}

export function hasOverlay(sel = {}) {
  return !!(sel.composer || sel.producer || sel.remixer);
}

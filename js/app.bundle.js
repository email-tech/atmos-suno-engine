// GENERATED — do not edit. Build with: node build.mjs
window.__ATMOS = window.__ATMOS || {};

/* core/constants.js */
(function(){
const ALWAYS_BAN = [
  'field recordings','air texture','room tone','foley','sound effects',
  'vinyl crackle','tape hiss','nature sounds','ambient noise',
];
const BEATLESS_BAN = ['drums','kick','beat','percussion','snare'];
const MASTERING = 'Polished Dolby Atmos-Master Atmos -2dB.';
const CHAR_LIMIT = 1000;

// deterministic RNG so a seed reproduces an arrangement (needed for re-roll + locks)
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

// palette filter: keep options that fit the chosen palette; never empty a role
function filterPalette(options, palette) {
  const keep = options.filter(o =>
    palette === 'blend' ? true :
    palette === 'electronic' ? (o.d === 'E' || o.d === 'B') :
    /* acoustic */ (o.d === 'A' || o.d === 'B'));
  return keep.length ? keep : options;
}

Object.assign(window.__ATMOS, { rng, filterPalette, ALWAYS_BAN, BEATLESS_BAN, MASTERING, CHAR_LIMIT });
})();

/* core/compress.js */
(function(){
/* ============================================================================
 * compress.js — PHRASING COMPRESSION
 *
 * The problem: engine prompts already run ~19 descriptor parts and land near the
 * 1,000-char ceiling. A modifier overlay needs room. The old answer was to SHED
 * parts, which destroys either the engine's identity or the overlay the user
 * explicitly asked for.
 *
 * The answer here: compress PHRASING before removing CONTENT.
 *
 * SAFETY GUARANTEE (this is the whole design):
 *   compaction may ONLY delete tokens that appear in the FILLER list below, and
 *   may only rewrite the connective patterns in TIGHTEN. It can never delete a
 *   word it does not recognise, so an INSTRUMENT NOUN CAN NEVER BE LOST. Suno
 *   weights instrument nouns and genre words heavily and adverbs barely at all,
 *   so this is close to musically free.
 *
 * Two levels:
 *   1 — strip filler adverbs/intensifiers
 *   2 — level 1 + tighten connectives and leading articles
 * ==========================================================================*/

// adverbs / intensifiers only. NOTHING here names an instrument, a genre, a
// tempo, a chord, or an interaction.
const FILLER = [
  'slowly', 'gently', 'softly', 'quietly', 'gradually', 'steadily', 'subtly',
  'deliberately', 'unhurried', 'loosely', 'lightly', 'hazily', 'faintly',
  'endlessly', 'constantly', 'continually', 'genuinely', 'truly', 'really',
  'very', 'quite', 'somewhat', 'slightly', 'deeply', 'richly', 'beautifully',
  'carefully', 'neatly', 'cleanly', 'smoothly', 'evenly', 'freely',
];

// connective tightening — meaning-preserving rewrites, applied at level 2 only.
const TIGHTEN = [
  [/\bwith a\b/g, 'with'],
  [/\bwith an\b/g, 'with'],
  [/\bin a\b/g, 'in'],
  [/\bunder a\b/g, 'under'],
  [/\bover a\b/g, 'over'],
  [/\bthat is\b/g, ''],
  [/\bwhich is\b/g, ''],
  [/\bthe whole\b/g, 'the'],
  [/\bkind of\b/g, ''],
  [/\bsort of\b/g, ''],
];

const FILLER_RE = new RegExp(`\\b(?:${FILLER.join('|')})\\b`, 'gi');

function tidy(s) {
  return s.replace(/\s{2,}/g, ' ').replace(/\s+,/g, ',').replace(/,\s*,/g, ',').trim();
}

/* Compact one descriptor part. level 0 = untouched. */
function compactPart(text, level) {
  if (!text || !level) return text;
  let out = String(text);
  out = out.replace(FILLER_RE, '');
  if (level >= 2) {
    for (const [re, to] of TIGHTEN) out = out.replace(re, to);
    out = out.replace(/^(a|an|the)\s+/i, '');   // leading article on a clause only
  }
  return tidy(out);
}

/* Assert-able check used by the validation harness: compaction must never remove
 * a word that is not filler. Returns the list of illegally-removed words ([] = ok). */
function lostWords(before, after) {
  const norm = s => String(s).toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter(Boolean);
  const allowed = new Set([...FILLER.map(f => f.toLowerCase()), 'a', 'an', 'the', 'is', 'that', 'which', 'whole', 'kind', 'sort', 'of']);
  const afterCounts = new Map();
  for (const w of norm(after)) afterCounts.set(w, (afterCounts.get(w) || 0) + 1);
  const lost = [];
  for (const w of norm(before)) {
    const n = afterCounts.get(w) || 0;
    if (n > 0) { afterCounts.set(w, n - 1); continue; }
    if (!allowed.has(w)) lost.push(w);
  }
  return lost;
}

Object.assign(window.__ATMOS, { compactPart, lostWords });
})();

/* core/overlays.js */
(function(){
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

/* ---- INSTRUMENT-FAMILY COLLISION GUARD ----------------------------------
 * Some overlay traits name a specific instrument that occupies the SAME sonic
 * role the engine may already have drawn (bass, lead, pad, choir, string bed).
 * Two basses or two leads in one prompt is the duplicate-instrument bug. Each
 * such trait is tagged with the family it occupies and whether it is FOUNDATIONAL
 * (must own that role outright -> it DISPLACES the engine's slot) or a COLOUR
 * layer (must yield -> its instrument mention is dropped when the engine already
 * fills that family). Traits with no instrument (harmony direction, arc, mix
 * treatment) carry no family and never collide.
 * FAMILY[kind][id][role] = { family, foundational:bool }
 * ------------------------------------------------------------------------*/
const TRAIT_FAMILY = {
  // FOUNDATIONAL overrides only: a trait that must OWN its role and displace the
  // engine's slot (rather than yield). Everything else derives its family from the
  // trait text automatically (slotFamily), so any collision is caught without
  // per-trait bookkeeping.
  composer: { moroder: { motif: { family: 'bass', foundational: true } } },
  producer: {},
  remixer: {},
};

// what instrument family, if any, does an engine slot text occupy? (keyword scan)
// Narrow, role-defining keywords. A family is only claimed when the text is the
// PRIMARY carrier of that role, not a decorative accent (e.g. 'arpeggio sparkle'
// is colour, not a lead). Ordering: most specific first.
const FAMILY_WORDS = {
  bass:    /\bbass(line)?\b|\bsub-?bass\b|\b808\b|\bupright bass\b|\boud register\b/i,
  lead:    /\blead\b|\bcarrying the melody\b|\bsteel-?pan (melody|lead)\b|\bwhistled\b|\bocarina melody\b/i,
  choir:   /\bchoir\b|\bchant(ing)?\b|\bwordless (soprano|voice)\b/i,
  brass:   /\bbrass\b|\bhorn section\b|\btrumpet\b|\btrombone\b/i,
  strings: /\bstring (bed|ostinato|section)\b|\blegato strings\b|\btremolo strings\b|\bsilky.*strings\b/i,
  pad:     /\bpad(s)? bed\b|\banalog pads\b|\bsynth pads\b/i,
};
function slotFamily(text) {
  if (!text) return null;
  for (const [fam, re] of Object.entries(FAMILY_WORDS)) if (re.test(text)) return fam;
  return null;
}
function traitFamily(name) {   // name like 'composer:moroder'
  const [kind, id] = name.split(':');
  return (TRAIT_FAMILY[kind] && TRAIT_FAMILY[kind][id]) || {};
}

const OVERLAYS = {
  composer: Object.assign({}, COMPOSER_ORCHESTRAL, COMPOSER_ELECTRONIC),
  producer: PRODUCER,
  remixer: REMIXER,
};

// roles an overlay TYPE is allowed to write. Nothing else is ever accepted.
const SLOT_RIGHTS = {
  composer: ['harmony', 'motif', 'counter', 'texture', 'color', 'arc'],
  producer: ['harmony', 'counter', 'texture', 'movement', 'color', 'treat', 'arc'],
  remixer:  ['groove', 'edit', 'movement', 'color', 'arc'],
};

function overlayList(kind) {
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
function resolveOverlays(sel = {}, ctx = {}) {
  const roles = {};
  const roleFamily = {};   // role -> { family, foundational } for collision handling
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
      if (roles[role] == null) {
        roles[role] = ov[role];
        const hand = traitFamily(`${kind}:${id}`)[role];              // foundational override, if any
        const auto = slotFamily(ov[role]);                            // else derive from the text
        const fam = hand || (auto ? { family: auto } : null);
        if (fam) roleFamily[role] = fam;
      }
    }
    if (ov.negative) negative.push(...ov.negative);
  }
  return { roles, roleFamily, negative, names };
}

function hasOverlay(sel = {}) {
  return !!(sel.composer || sel.producer || sel.remixer);
}

Object.assign(window.__ATMOS, { slotFamily, traitFamily, overlayList, resolveOverlays, hasOverlay, TRAIT_FAMILY, OVERLAYS, SLOT_RIGHTS });
})();

/* core/resolver.js */
(function(){
const {ALWAYS_BAN, BEATLESS_BAN, MASTERING, CHAR_LIMIT, rng, filterPalette} = window.__ATMOS;
const {compactPart} = window.__ATMOS;
const {slotFamily} = window.__ATMOS;

// opts: { characterId, palette:'electronic'|'acoustic'|'blend', locks:{role:text}, seed }
// locks drive all three control levels:
//   randomize all  = locks {}
//   lock some      = locks {pads:'...'}
//   full manual    = every role locked
function resolveArrangement(engine, opts) {
  const { characterId, palette = 'electronic', locks = {}, seed = Date.now() } = opts;
  const c = engine.characters[characterId];
  if (!c) throw new Error(`unknown character ${characterId}`);
  const rand = rng(seed);
  const pick = (role) => {
    if (locks[role] != null) return locks[role];
    const pool = filterPalette(c.pools[role] || [], palette);
    if (!pool.length) return null;
    return pool[Math.floor(rand() * pool.length)].t;
  };

  const arr = {
    engine: engine.id,
    character: c.label,
    genre: c.genre,
    beatless: !!c.beatless,
    bpm: c.bpm || null,
    energy: c.energy,
    pads: pick('pads'),
    harmony: pick('harmony'),
    bass: pick('bass'),
    voice: pick('voice'),
    lead: pick('lead'),
    movement: pick('movement'),
    color: null,
    drums: null,
    negative: c.negative || null,   // optional per-character bans (e.g. Era Driving Epic: no rock/metal)
    tempoLock: c.tempoLock || null, // optional tempo-stability directive (stops Suno double-timing)
  };

  // drums (skip when beatless)
  if (!c.beatless && c.drums.primary) {
    const fam = engine.drums[c.drums.primary];
    arr.drums = fam[Math.floor(rand() * fam.length)];
  }
  // colour fires occasionally
  if (rand() < c.colorChance) arr.color = pick('color');

  // interplay / arrangement layer — WOVEN into the style string (per John's Suno test).
  // role-generic tails that hang off already-named instruments (never re-name one).
  const ipPool = (engine.interplay && engine.interplay[characterId]) || {};
  const one = (dim) => (ipPool[dim] && ipPool[dim].length)
    ? ipPool[dim][Math.floor(rand() * ipPool[dim].length)] : null;
  arr.ip = {
    foundation:   one('foundation'),
    conversation: one('conversation'),
    arc:          one('arc'),
    voiceRel:     one('voiceRel'),
    colorRel:     one('colorRel'),
  };

  return arr;
}

// STYLE STRING = full woven cast (the approved gold-standard format). Instruments are
// threaded with their interplay inline, in musical layers, not a flat tag list:
//   genre -> tempo -> [drums+bass+foundation] -> [pads+lead+conversation] -> harmony
//         -> [voice+voiceRel] -> [colour+colourRel if it fires] -> [movement+arc] -> mastering
function renderStyle(engine, arr) {
  const ip = arr.ip || {};
  const clauses = [arr.genre];

  // tempo + energy
  clauses.push(arr.beatless
    ? `beatless, ${arr.energy} energy`
    : `${arr.bpm[0]}-${arr.bpm[1]} BPM, ${arr.energy} energy`);
  if (arr.tempoLock) clauses.push(arr.tempoLock);

  // LEVER 1 — OVERLAY FRONT-LOADING. Suno front-weights descriptors and renders
  // only a bounded number of them, so an overlay's defining traits must sit right
  // after the genre+tempo anchor (not buried at the back where they get dropped).
  // The signature carriers (thematic motif, counter-melody, harmonic language) are
  // hoisted here; they are then skipped in their old mid-list positions so nothing
  // renders twice. When no overlay is active none of these exist and the order is
  // unchanged (no-overlay output stays byte-identical — asserted in validation).
  if (arr.ovMotif) clauses.push(arr.ovMotif);
  if (arr.ovCounter) clauses.push(arr.ovCounter);
  if (arr.ovHarmony && arr.harmony) clauses.push(arr.harmony);

  // foundation: drums(+)bass + how they lock/float (+ remixer groove treatment)
  const drumText = arr.drums ? (arr.groove ? `${arr.drums} ${arr.groove}` : arr.drums) : null;
  if (arr.bass) {
    const low = drumText ? `${drumText} and ${arr.bass}` : arr.bass;
    clauses.push(ip.foundation ? `${low} ${ip.foundation}` : low);
  } else if (drumText) {
    clauses.push(ip.foundation ? `${drumText} ${ip.foundation}` : drumText);
  }

  // conversation: pads + lead + how they relate
  if (arr.pads && arr.lead) {
    clauses.push(ip.conversation ? `${arr.pads} with ${arr.lead} ${ip.conversation}`
                                 : `${arr.pads} with ${arr.lead}`);
  } else if (arr.pads) {
    clauses.push(arr.pads);
  } else if (arr.lead) {
    clauses.push(arr.lead);
  }

  // harmony (musicality slot — its own clause). An OVERLAY harmony was already
  // front-loaded above; only an ENGINE harmony renders here.
  if (arr.harmony && !arr.ovHarmony) clauses.push(arr.harmony);

  // overlay: secondary sustained layer
  if (arr.ovTexture) clauses.push(arr.ovTexture);

  // voice + how it sits
  if (arr.voice) clauses.push(ip.voiceRel ? `${arr.voice} ${ip.voiceRel}` : arr.voice);

  // colour (only when it fired) + how it sits
  if (arr.color) clauses.push(ip.colorRel ? `${arr.color} ${ip.colorRel}` : arr.color);

  // overlay: remixer edit treatment + producer mix treatment
  if (arr.ovEdit) clauses.push(arr.ovEdit);
  if (arr.ovTreat) clauses.push(arr.ovTreat);

  // production movement + the arc of the whole arrangement
  if (arr.movement) clauses.push(ip.arc ? `${arr.movement} and ${ip.arc}` : arr.movement);
  else if (ip.arc) clauses.push(ip.arc);

  return clauses.join(', ') + '. ' + MASTERING;
}

function renderNegative(engine, arr) {
  const bans = [...engine.sourceNegative, ...ALWAYS_BAN];
  if (arr.negative) bans.push(...arr.negative);
  if (arr.beatless) bans.push(...BEATLESS_BAN);
  return [...new Set(bans)].join(', ');
}

/* ---- MODIFIER OVERLAYS ---------------------------------------------------
 * ov = { roles:{harmony,motif,counter,texture,color,movement,arc,groove,edit,treat},
 *        negative:[...] } — already resolved by core/overlays.js.
 * Overlays WRITE INTO existing slots (they do not append a second prompt), a
 * USER-LOCKED slot always wins, and the engine's genre / tempo / drum family /
 * bass family are never touched.
 * engine.signatureLead (Deep Forest, Sacred Spirit): the lead pool carries the
 * engine's ethnic signature instrument, so a composer's melodic trait is demoted
 * to a second melodic voice instead of replacing it — the standing rule that the
 * signature instrument must persist beats the overlay.
 * ------------------------------------------------------------------------*/
function applyOverlay(engine, arr, ov, locks = {}) {
  if (!ov || !ov.roles) return arr;
  const r = ov.roles;
  const fam = ov.roleFamily || {};
  const free = role => locks[role] == null || locks[role] === '';

  // Which instrument families has the ENGINE already put on the track? A slot the
  // user locked counts too (never silently displace a locked instrument).
  const present = new Set();
  for (const k of ['bass', 'lead', 'pads', 'color']) {
    const f = slotFamily(arr[k]); if (f) present.add(f);
  }

  // Decide what to do when an overlay trait names an instrument family the engine
  // already carries:
  //   foundational (e.g. Moroder's arp-bass) -> DISPLACE the engine's slot in that
  //     family, so there is exactly one instrument in that role.
  //   otherwise -> the overlay YIELDS: its instrument mention is dropped so it does
  //     not duplicate what is already there.
  const resolveTrait = (role, text) => {
    const meta = fam[role];
    if (!meta || !meta.family) return { text, displace: null };
    const clash = present.has(meta.family);
    if (!clash) { present.add(meta.family); return { text, displace: null }; }
    if (meta.foundational) return { text, displace: meta.family };   // overlay wins the role
    return { text: null, displace: null };                           // overlay drops the mention
  };

  if (r.harmony && free('harmony')) { arr.harmony = r.harmony; arr.ovHarmony = true; }
  if (r.movement && free('movement')) arr.movement = r.movement;
  if (r.arc) arr.ip = Object.assign({}, arr.ip, { arc: r.arc });

  // LEVER 1 — DEMOTE OVERLAY COLOUR. Colour is the lowest-priority, occasional
  // decoration slot. When the overlay already carries a foreground melodic voice
  // (motif or counter), its colour trait is SUPPRESSED — it competes for attention
  // and over-renders (John's test: an overlay trumpet came through too strong). An
  // overlay whose only melodic contribution IS colour (e.g. a producer's sampled
  // choir hits) keeps it.
  const overlayHasForeground = !!(r.motif || r.counter);
  if (r.color && free('color') && !overlayHasForeground) {
    const t = resolveTrait('color', r.color);
    if (t.text) { arr.color = t.text; arr.colorFromOverlay = true; }
  }

  // motif = the composer's melodic/thematic hand
  if (r.motif) {
    const t = resolveTrait('motif', r.motif);
    if (t.displace === 'bass' && free('bass')) {
      // foundational bass motif (Moroder) OWNS the low end: it replaces the drawn
      // bass in the foundation clause; no second bass elsewhere.
      arr.bass = t.text; arr.ovMotifIsBass = true;
    } else if (t.text) {
      if (engine.signatureLead || !free('lead')) arr.ovMotif = t.text; // keep engine lead
      else arr.lead = t.text;
    }
  }

  if (r.counter) { const t = resolveTrait('counter', r.counter); if (t.text) arr.ovCounter = t.text; }
  if (r.texture) { const t = resolveTrait('texture', r.texture); if (t.text) arr.ovTexture = t.text; }
  if (r.groove && arr.drums) arr.groove = r.groove;
  if (r.edit) arr.ovEdit = r.edit;
  if (r.treat) arr.ovTreat = r.treat;

  if (ov.negative && ov.negative.length)
    arr.negative = [...(arr.negative || []), ...ov.negative];

  return arr;
}

/* Compression: shrink PHRASING before shedding CONTENT (see core/compress.js).
 * Bands are compacted in priority order — decorative layers first, core last —
 * and only as far as the budget actually requires. */
const CORE_KEYS = ['genre', 'tempoClause'];
function compressStyle(engine, arr, limit, locks = {}) {
  const roleOf = { pads: 'pads', harmony: 'harmony', bass: 'bass', voice: 'voice', lead: 'lead', movement: 'movement', color: 'color' };
  const lockedKey = k => { const r = roleOf[k]; return r && locks[r] != null && locks[r] !== ''; };
  let style = renderStyle(engine, arr);
  if (style.length <= limit) return style;
  const bands = [
    ['color', 'ovTexture', 'ovCounter', 'ovEdit', 'ovTreat'],   // decorative / overlay extras
    ['movement', 'ovMotif'],                                     // production + secondary melodic
    ['pads', 'harmony', 'voice', 'lead', 'bass', 'drums', 'groove'], // core, last resort
  ];
  const work = Object.assign({}, arr, { ip: Object.assign({}, arr.ip) });
  for (const level of [1, 2]) {
    for (const band of bands) {
      for (const k of band) if (work[k] && !lockedKey(k)) work[k] = compactPart(work[k], level);   // a locked slot is never reworded
      if (level === 2) for (const k of Object.keys(work.ip || {}))
        if (work.ip[k]) work.ip[k] = compactPart(work.ip[k], level);
      style = renderStyle(engine, work);
      if (style.length <= limit) return style;
    }
  }

  // last resort (only reachable when several overlays are stacked on an already
  // dense character): shed decoration, never an instrument, never the genre/tempo.
  // Order: interplay tails -> the engine's own gap-filler colour -> overlay extras.
  const shed = [
    () => { if (work.ip) work.ip.colorRel = null; },
    () => { if (!work.colorFromOverlay && !lockedKey('color')) work.color = null; },
    () => { if (work.ip) work.ip.voiceRel = null; },
    () => { work.ovEdit = null; },
    () => { work.ovTexture = null; },
    () => { work.ovTreat = null; },
    () => { if (!lockedKey('color')) work.color = null; },
  ];
  for (const cut of shed) {
    cut();
    style = renderStyle(engine, work);
    if (style.length <= limit) return style;
  }
  return style;
}

function build(engine, opts) {
  const arr = resolveArrangement(engine, opts);
  applyOverlay(engine, arr, opts.overlay, opts.locks || {});
  const style = compressStyle(engine, arr, CHAR_LIMIT, opts.locks || {});
  return { arrangement: arr, style, negative: renderNegative(engine, arr), length: style.length,
           overLimit: style.length > CHAR_LIMIT };
}

Object.assign(window.__ATMOS, { resolveArrangement, renderStyle, renderNegative, build });
})();

/* core/atom-composers.js */
(function(){
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

const ATOM_COMPOSERS = {

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

Object.assign(window.__ATMOS, { ATOM_COMPOSERS });
})();

/* core/atom-producers.js */
(function(){
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

const ATOM_PRODUCERS = {

  // Price — pumping chord stabs ducking hard on the kick (electronic signature).
  // Sidechain expressed as an audible INSTRUMENT gesture, not the desk term
  // "sidechain" (Suno under-renders production-desk words from text).
  producer_price: producer('Stuart Price', PROD_ELEC, {
    ov_texture:{ role:'texture', family:'texture', fn:'sustain-under', priority:'signature', signature:true,
                 instrument:'pumping filtered synth-chord stabs ducking hard on every kick then surging back' },
    ov_colour: { role:'colour', family:'colour', fn:'accent', priority:'support',
                 instrument:'vocoded vocal-harmony doubles shadowing the melody' },
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

Object.assign(window.__ATMOS, { ATOM_PRODUCERS });
})();

/* core/atom-remixers.js */
(function(){
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

const ATOM_REMIXERS = {

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

Object.assign(window.__ATMOS, { ATOM_REMIXERS });
})();

/* core/beds.js */
(function(){
/* ==========================================================================
 * beds.js — THE SHARED BED LIBRARY (the pad layer).
 *
 * WHY THIS EXISTS (John, 2026-07-22 / 2026-07-23):
 *
 * A PAD IS DEFINED BY FUNCTION, NOT BY SOUND SOURCE. John's canonical test:
 *     sustained duration + slow attack and release + background placement +
 *     rich chordal harmony.
 * Whether it is a synth, a string section, a choir or a drone is irrelevant.
 * Synth pads, string pads, vocal pads and ambient pads are ALL pads.
 *
 * And in John's model CORE == PAD. The core of a modifier IS its sustained
 * ensemble bed, and that bed is LARGELY SHARED between artists — most orchestral
 * writers sit on something like a string section, or strings and horns. The bed is
 * common ground, not a differentiator. The fingerprint lives in the SIGNATURE
 * (subtle solo instruments as decoration, harmony or melody), not in the body.
 *
 * WHAT THIS REPLACES (audited 2026-07-23, all counted in code):
 *   - 86 of 96 gen-2 cores emitted TWO OR THREE simultaneous sustained voices —
 *     a strings atom, a texture atom AND a pads atom, all fn:'sustain-under'.
 *     Three beds at once on top of whatever the character already brought. That
 *     density, not mix level, is the likely cause of Suno round 3's 'pads
 *     unrecognisable' and 'instrumentation hit and miss'.
 *   - 29 pairs inside a single core named the same family twice
 *     ('a muted brass section' + 'a sustained muted brass section').
 *   - 5 pad slots held struck/plucked, fast-attack, DECAYING instruments —
 *     celesta, harp, vibraphone, electric piano. Prefixing them with the word
 *     'sustained' does not make them sustain. These are decoration and belong in
 *     the signature.
 *   - Producer and remixer beds had collapsed into interchangeable adjective mush
 *     ('a warm sustained pad' authored verbatim for four different artists).
 *
 * THE RULE THIS MODULE ENFORCES
 *   ONE core, ONE bed, drawn from this shared library. Two artists may share a
 *   bed — that is the point. Nothing enters this library unless it passes the
 *   functional test above.
 *
 * BEHAVIOUR, NOT JUST A NAME
 *   Round 3 showed that naming an instrument in the pad slot does not make Suno
 *   render it AS a pad. Each bed therefore carries `behaviour` — how it moves and
 *   where it sits — which compose() threads into the style string. Atoms still
 *   hold pure instrument names (standing project rule); compose still owns all
 *   prose. `behaviour` is authored here as data for compose to use, never
 *   concatenated into `instrument`.
 *
 *   Mix placement is deliberately LOW. John: 'there was a pad present, I could
 *   not tell what it comprised, it was so low in the mix' — being low in the mix
 *   is CORRECT pad behaviour by his own definition. The fix is not more level, it
 *   is richer harmonic content and an audible slow swell.
 *
 * PALETTE
 *   'acoustic' beds are suppressed on electronic-only builds and vice versa;
 *   'any' beds pass everywhere. This continues the round-3 fix that stopped
 *   synthesis vocabulary leaking onto acoustic builds.
 * ========================================================================*/

const BEDS = {

  // ---- string pads ---------------------------------------------------------
  muted_strings: {
    label: 'Muted string section',
    instrument: 'a muted mid-register string section',
    palette: 'acoustic',
    behaviour: 'swelling slowly and sitting low behind the melody',
  },
  lush_strings: {
    label: 'Lush string section',
    instrument: 'a lush sustained string section',
    palette: 'acoustic',
    behaviour: 'holding long rich chords low under everything else',
  },
  low_strings: {
    label: 'Low sustained strings',
    instrument: 'a deep sustained low string section',
    palette: 'acoustic',
    behaviour: 'held long and dark underneath, rising and falling slowly',
  },

  // ---- strings + horns (the commonest orchestral bed) ----------------------
  strings_horns: {
    label: 'Strings and held horns',
    instrument: 'a string section with held french horns',
    palette: 'acoustic',
    behaviour: 'swelling together in slow rich chords well behind the melody',
  },

  // ---- brass pads ----------------------------------------------------------
  brass_chorale: {
    label: 'Held brass chorale',
    instrument: 'a held brass chorale',
    palette: 'acoustic',
    behaviour: 'entering slowly and sustaining low under the arrangement',
  },
  low_brass: {
    label: 'Low sustained brass',
    instrument: 'a sustained low brass section',
    palette: 'acoustic',
    behaviour: 'held long and heavy underneath, swelling in gradually',
  },

  // ---- woodwind and organ pads --------------------------------------------
  woodwind_bed: {
    label: 'Sustained woodwind ensemble',
    instrument: 'a sustained woodwind ensemble',
    palette: 'acoustic',
    behaviour: 'holding soft chords quietly beneath the melody',
  },
  organ_bed: {
    label: 'Sustained organ',
    instrument: 'a sustained chamber organ',
    palette: 'acoustic',
    behaviour: 'holding long unbroken chords far back in the mix',
  },

  // ---- vocal pads ----------------------------------------------------------
  wordless_choir: {
    label: 'Wordless choir',
    instrument: 'a wordless sustained choir',
    palette: 'any',
    behaviour: 'holding slow open chords low behind the arrangement',
  },

  // ---- synth pads ----------------------------------------------------------
  warm_analog_pad: {
    label: 'Warm analog synth pad',
    instrument: 'a warm analog synth pad',
    palette: 'electronic',
    behaviour: 'fading in slowly and holding wide chords under the mix',
  },
  bright_synth_pad: {
    label: 'Bright synth pad',
    instrument: 'a bright wide synth pad',
    palette: 'electronic',
    behaviour: 'swelling in and sustaining behind the lead',
  },
  filtered_pad: {
    label: 'Deep filtered pad',
    instrument: 'a deep filtered synth pad',
    palette: 'electronic',
    behaviour: 'opening slowly across long held chords, low in the mix',
  },
  synth_choir_pad: {
    label: 'Synthetic choir pad',
    instrument: 'a synthetic choir pad',
    palette: 'electronic',
    behaviour: 'fading in and holding soft vocal chords far behind the melody',
  },

  // ---- hybrid and ambient pads --------------------------------------------
  hybrid_pad: {
    label: 'Hybrid synth-orchestra pad',
    instrument: 'a hybrid synth-and-strings pad',
    palette: 'any',
    behaviour: 'building slowly into wide sustained chords underneath',
  },
  drone_bed: {
    label: 'Low ambient drone',
    instrument: 'a low sustained drone',
    palette: 'any',
    behaviour: 'holding one unbroken low tone beneath everything',
  },
};

const BED_IDS = Object.keys(BEDS);

// Build the single pad atom for a core. Returns null for an unknown id so an
// authoring slip degrades to 'no bed' rather than throwing mid-build.
function bedAtom(bedId) {
  const b = BEDS[bedId];
  if (!b) return null;
  return {
    role: 'pads', family: 'pad', fn: 'sustain-under', priority: 'core',
    instrument: b.instrument, behaviour: b.behaviour, bedId,
    palette: b.palette,
  };
}

// A bed is only admissible on a palette it belongs to. 'any' passes everywhere.
function bedAllowed(bedId, palette) {
  const b = BEDS[bedId];
  if (!b) return false;
  return b.palette === 'any' || !palette || b.palette === palette;
}

Object.assign(window.__ATMOS, { bedAtom, bedAllowed, BEDS, BED_IDS });
})();

/* core/knowledge.js */
(function(){
/* ==========================================================================
 * knowledge.js — EMPIRICALLY ESTABLISHED FACTS ABOUT SUNO.
 *
 * WHY THIS FILE EXISTS (John, 2026-07-23, after Suno round 4):
 *   "every new chat we regress in knowledge, progress and are always chasing
 *    our tails... It wouldn't be so bad if the lessons we learned were retained,
 *    but I don't feel that they are."
 *
 * He is right, and the cause is structural. Facts that live in a session's
 * reasoning, or in prose in the decision log, do not survive a chat boundary —
 * they get re-derived from scratch, and re-derived wrong. Two concrete failures
 * in round 4 came from exactly that:
 *   - 23 negatives were shipped when the effective ceiling is about 5, so the
 *     orchestral defence was largely inert and John had to hand-front-load it.
 *   - 'ostinato' and 'stabs' were left in composer atoms after John had already
 *     ruled them undesirable, because the rule lived only in a log entry.
 *
 * THE RULE THIS FILE ESTABLISHES: an empirical fact is not "recorded" until it
 * is DATA HERE and a VALIDATOR FAILS THE BUILD when it is violated. Prose is not
 * retention. Memory is not retention. A failing test is retention.
 *
 * Nothing in this file is inferred, extrapolated or assumed. Every entry cites
 * the test that produced it. If a fact has no test behind it, it does not belong
 * here — put it in the decision log as an open question instead.
 * ========================================================================*/

/* --------------------------------------------------------------------------
 * 1. NEGATIVE PROMPT CAPACITY
 * SOURCE: John, Suno round 4 — "I have had to front load the negative Orchestral
 * prompts as the negative prompt loses effectiveness beyond 5 elements."
 * Everything past the cap is effectively ignored, so an unordered list of 23
 * silently discards the ones that mattered.
 * ------------------------------------------------------------------------*/
const NEGATIVE_CAP = 5;

/* Negatives are now RANKED and truncated to the cap, highest harm first.
 * Rank 1 = actively breaks the genre read. Rank 3 = cosmetic.
 * The old ALWAYS_BAN list (field recordings, foley, vinyl crackle...) is
 * cosmetic by this measure: it prevents non-musical content, but it never
 * caused a genre failure. Orchestral-convention bleed did. */
const NEGATIVE_RANKS = {
  // rank 1 — observed to hijack the genre (round 4: A2, A3, A4)
  'orchestral drums': 1,
  'staccato strings': 1,
  'brass stabs': 1,
  'orchestral hits': 1,
  'symphonic arrangement': 1,
  // rank 2 — orchestral convention, less destructive
  'orchestral percussion': 2,
  'timpani': 2,
  'cinematic orchestral production': 2,
  'full orchestra': 2,
  'orchestral crescendo': 2,
  'marching percussion': 2,
  // rank 3 — non-musical content; never observed to break a genre read
  'field recordings': 3,
  'foley': 3,
  'sound effects': 3,
  'vinyl crackle': 3,
  'tape hiss': 3,
  'room tone': 3,
  'air texture': 3,
  'nature sounds': 3,
  'ambient noise': 3,
};

// Select at most NEGATIVE_CAP negatives, most harmful first, order preserved
// within a rank. Duplicates and unknown entries are dropped rather than
// silently consuming a slot.
function selectNegatives(candidates, cap) {
  const limit = (typeof cap === 'number') ? cap : NEGATIVE_CAP;
  const seen = new Set();
  return candidates
    .filter(c => { const k = String(c).toLowerCase();
                   if (seen.has(k) || !(k in NEGATIVE_RANKS)) return false;
                   seen.add(k); return true; })
    .sort((a, b) => NEGATIVE_RANKS[String(a).toLowerCase()] - NEGATIVE_RANKS[String(b).toLowerCase()])
    .slice(0, limit);
}

/* --------------------------------------------------------------------------
 * 2. BANNED PERFORMANCE / ARTICULATION LANGUAGE
 * SOURCE: John, Suno round 4 A4 — "ostinato, stabs and staccatos are an
 * undesirable articulation and performance language for the Balearic engine."
 *
 * SCOPE CORRECTION: I first read "for the Balearic engine" as engine-conditional
 * and left 16 composer atoms carrying this language. That was wrong on the facts
 * — every engine in this project (Balearic, Enigma, Delerium, Era, Deep Forest,
 * Sacred Spirit) is a non-orchestral, groove-led engine, so "the Balearic engine"
 * is not a narrow case, it is the whole app. The ban is global.
 *
 * WHY IT MATTERS BEYOND TASTE: round 4 showed Suno inventing staccato and stabs
 * that were NOT in the prompt, purely from orchestral instrument context. Naming
 * the articulation ourselves compounds a bleed that is already happening.
 * ------------------------------------------------------------------------*/
const BANNED_ARTICULATION = [
  'ostinato', 'staccato', 'stab', 'stabs', 'stabbing',
  'fanfare', 'orchestral hit', 'orchestra hit',
];

const BANNED_ARTICULATION_RE =
  /\b(ostinato|ostinatos|staccato|stabs?|stabbing|fanfares?|orchestral hits?|orchestra hits?)\b/i;

/* --------------------------------------------------------------------------
 * 3. PROMPT POSITION == PROMINENCE
 * SOURCE: John, round 4. A1 — the marimba, cello and French horn sat late in the
 * prompt and were INAUDIBLE. A3/A4 — composer content sat early (position ~4)
 * and was "too front and centre in the arrangement in volume".
 * The same lever, observed in both directions in one test round.
 * ------------------------------------------------------------------------*/
const POSITION_IS_PROMINENCE = true;

/* --------------------------------------------------------------------------
 * 4. INSTRUMENT NAMES IMPORT THEIR WHOLE CONVENTION
 * SOURCE: John, round 4 — "The presence of orchestra instruments is causing Suno
 * to lean into orchestra production", and "Suno is fighting its programming and
 * presenting both type of genre equally. It can't tell from our current
 * prompting, which should be the dominant Genre."
 * Naming an orchestral instrument does not add that instrument to a Balearic
 * track; it invokes orchestral music, including articulation, sectional writing,
 * orchestral percussion and a cinematic front-and-centre mix.
 * ------------------------------------------------------------------------*/
const CONVENTION_BLEED = true;

/* --------------------------------------------------------------------------
 * 5. ONE VOICE, ONE MENTION
 * SOURCE: John, round 4 A2 — "French horn mentioned on 3 occasions in the
 * prompt???" and A3 — "The prompt has French horn use at odds with one another."
 * Naming one instrument N times tells Suno to render N of them.
 * Enforced in core/atoms.js by the cross-family de-dupe.
 * ------------------------------------------------------------------------*/
const ONE_VOICE_ONE_MENTION = true;

/* --------------------------------------------------------------------------
 * 6. WOVEN INTERACTION LANGUAGE IS MANDATORY (standing project rule)
 * SOURCE: John's own Suno testing, established before round 4 and re-confirmed
 * since. The tight front-weighted 6-9 tag model from 2026 Suno-v5 research
 * produced hopeless results; fuller woven prompts render good, genre-accurate
 * music regardless of length. John's empirical test wins for this project.
 * ------------------------------------------------------------------------*/
const INTERACTION_LANGUAGE_MANDATORY = true;

Object.assign(window.__ATMOS, { selectNegatives, NEGATIVE_CAP, NEGATIVE_RANKS, BANNED_ARTICULATION, BANNED_ARTICULATION_RE, POSITION_IS_PROMINENCE, CONVENTION_BLEED, ONE_VOICE_ONE_MENTION, INTERACTION_LANGUAGE_MANDATORY });
})();

/* core/rules.js */
(function(){
/* ==========================================================================
 * rules.js — the RULE ENGINE (P2 of the Composition Workbench).
 *
 * Generalizes the congruence PRE-PASS that used to live as inline if/else in
 * core/atoms.js (congruenceGate) into a shared, data-driven evaluator:
 *
 *   - PROFILES are data. A genre profile projects the character side (what a
 *     genre owns + its lean); an overlay profile normalizes the congruence block
 *     already authored on each overlay. Neither copies data — both are read-only
 *     projections of the authored fields, so there is still ONE source of truth
 *     (the character's electronicLean/genreOwned and the overlay's congruence).
 *
 *   - RULES are data. CONGRUENCE_RULES is an ordered list of rule objects, each
 *     a pure predicate over {overlay-profile, genre-profile[, atom]}. A `refuse`
 *     rule short-circuits the whole overlay (genre clash); a `filter` rule drops
 *     individual overlay atoms that would seize a genre-owned family they may not
 *     take. Behaviour lives in the table, not in branches — new congruence policy
 *     is authored by adding a rule, never by editing the evaluator.
 *
 * PARITY: evaluateCongruence returns the EXACT same { ok, atoms, reason } shape
 * and the exact same decision as the old congruenceGate (same rule order, same
 * reason strings), so the holding area — and therefore the composed style string
 * — stays byte-identical. This is a refactor of HOW the decision is made, not
 * WHAT it decides. validate-rules.mjs proves decision-equivalence overlay ×
 * character × palette; the atom parity golden proves the style output is
 * unchanged.
 *
 * P3 (CIL) will read `ruleId` on a refusal for provenance-tiered inference.
 * ========================================================================*/

// ---- PROFILE PROJECTIONS (read-only; no data duplication) ----------------

// Genre profile — the character side of congruence, as data.
// source: the engine/genre a character belongs to (e.g. 'Balearic').
// electronicLean: whether the character accepts an electronic-only overlay.
// owned: the genre-owned families a cross-genre overlay may not seize by default.
function genreProfile(char) {
  return {
    source: char.source || null,
    electronicLean: !!char.electronicLean,
    owned: new Set(char.genreOwned || []),
  };
}

// Overlay profile — the congruence block authored on each overlay, normalized.
// lean: 'any' | 'electronic'   — required character lean.
// engines: string[] | null      — compatible engine sources (null = any).
// takeover: { family: bool }    — which genre-owned families this overlay may seize.
function overlayProfile(ov) {
  const c = ov.congruence || {};
  return {
    lean: c.lean || 'any',
    engines: c.engines || null,
    takeover: c.takeover || {},
  };
}

// ---- RULE TABLE (data-driven; order = evaluation order) ------------------
// `refuse` rules run first, in order, and short-circuit. `filter` rules then
// narrow the overlay's atoms. Reason strings are kept byte-identical to the
// former inline gate so nothing downstream (overlayNote, DNA overlayRefused,
// negative-merge decision) shifts.
const CONGRUENCE_RULES = [
  {
    id: 'lean-gate',
    kind: 'refuse',
    test: (ovp, gp) => ovp.lean === 'electronic' && !gp.electronicLean,
    reason: (ov, char) =>
      `${ov.label} is electronic-only; ${char.label} is not electronic-leaning — refused (genre clash).`,
  },
  {
    id: 'engine-gate',
    kind: 'refuse',
    test: (ovp, gp) => !!ovp.engines && !ovp.engines.includes(gp.source),
    reason: (ov, char) =>
      `${ov.label} is not congruent with ${char.source} — refused.`,
  },
  {
    id: 'takeover-gate',
    kind: 'filter',
    // keep an overlay atom UNLESS it would seize a genre-owned family it may not take.
    keep: (atom, ovp, gp) =>
      !(atom.family && gp.owned.has(atom.family) && !ovp.takeover[atom.family]),
  },
];

// ---- EVALUATOR -----------------------------------------------------------
// The single entry point that replaces the inline congruenceGate. Pure data:
// project both sides to profiles, run the refuse rules, then apply the filter
// rules to the overlay's atoms.
function evaluateCongruence(ov, char, rules) {
  const table = rules || CONGRUENCE_RULES;
  const ovp = overlayProfile(ov);
  const gp = genreProfile(char);

  for (const rule of table) {
    if (rule.kind === 'refuse' && rule.test(ovp, gp))
      return { ok: false, atoms: {}, reason: rule.reason(ov, char), ruleId: rule.id };
  }

  const filters = table.filter(r => r.kind === 'filter');
  const atoms = {};
  for (const [k, a] of Object.entries(ov.atoms)) {
    if (filters.every(f => f.keep(a, ovp, gp))) atoms[k] = a;
  }
  return { ok: true, atoms, reason: null, ruleId: null };
}

Object.assign(window.__ATMOS, { genreProfile, overlayProfile, evaluateCongruence, CONGRUENCE_RULES });
})();

/* core/atoms.js */
(function(){
/* ==========================================================================
 * atoms.js — the atom ASSEMBLY engine (character-agnostic).
 * Promoted from proto/atom-proto.mjs. Pipeline is unchanged from the validated
 * prototype: atoms -> holding area (engine + overlay) -> reconcile -> compose.
 * Reconcile is pure data: one voice per family, priority wins (signature > core
 * > support > decorative); a foundational overlay bass DISPLACES; a colliding
 * overlay voice YIELDS; signature carriers hoist to the front (Lever 1).
 *
 * NEW (congruence, 2026-07-19 direction): overlays are congruent-by-default.
 * Each overlay carries a congruence profile; a congruence PRE-PASS runs before
 * the family contest. As of P2 this pre-pass is DATA-DRIVEN — the lean / engine /
 * takeover policy is authored as rules in core/rules.js and applied by
 * evaluateCongruence; congruenceGate() below is a thin delegator. The rules are:
 *   - lean gate: an electronic-only overlay on a non-electronic character is
 *     REFUSED entirely (Moroder-on-Balearic — a confirmed genre clash).
 *   - takeover gate: an overlay may only seize a genre-owned family (bass timbre,
 *     drum kit) if its profile permits AND the character's lean allows it. A
 *     classical/orchestral composer takes over none — it finesses lead / strings
 *     / texture / perc / colour over an intact engine foundation.
 * Genre-owned attributes can't be claimed by a cross-genre overlay regardless of
 * prompt craft or position — so we don't author a prompt that fights the prior.
 * ========================================================================*/
const {CHAR_LIMIT, ALWAYS_BAN} = window.__ATMOS;
const {evaluateCongruence} = window.__ATMOS;
const {bedAtom, bedAllowed} = window.__ATMOS;
const {selectNegatives} = window.__ATMOS;
const {modifierList} = window.__ATMOS;
const {ATOM_COMPOSERS} = window.__ATMOS;
const {ATOM_PRODUCERS} = window.__ATMOS;
const {ATOM_REMIXERS} = window.__ATMOS;

function mulberry32(a){let t=(a>>>0)||1;return()=>{t+=0x6D2B79F5;let r=Math.imul(t^(t>>>15),1|t);r^=r+Math.imul(r^(r>>>7),61|r);return((r^(r>>>14))>>>0)/4294967296;};}
const RANK = { signature:0, core:1, support:2, decorative:3 };

// ---- OVERLAY ATOM TABLES (ingredients + congruence profile) --------------
// congruence.lean:'any'|'electronic'  — required character lean.
// congruence.engines: compatible engine sources (null = any).
// congruence.takeover: which genre-owned families this overlay may seize.
// signature:true -> hoists to the front; foundational:true on a bass -> displaces.
// All three overlay arms now live atom-native: Composers (./atom-composers.js, 19),
// Producers (./atom-producers.js, 8), Remixers (./atom-remixers.js, 5) — each a
// distinct signature-delta set. Overlay system complete on the atom path.
const ATOM_OVERLAYS = { ...ATOM_COMPOSERS, ...ATOM_PRODUCERS, ...ATOM_REMIXERS };

/* RELATIONSHIP LANGUAGE — John, 2026-07-22 (Suno test round 2).
 * Rewritten from literary to FUNCTIONAL. The standing project rule that
 * interplay language is mandatory still holds — every voice must say how it sits
 * against the others — but it now says so in plain, unambiguous terms Suno can
 * act on. Poetic phrasing ('swelling to meet and resolve it', 'stacking to a
 * lush peak then receding') gave Suno nothing actionable and burned characters. */
const REL = {
  foundation:    { needs:['bass','drums'], render:'locked tight together' },
  arc:           { needs:['pad'],          render:'builds to a peak then thins out' },
  harmonyResolve:{ needs:['lead','harmony'],render:'chords resolve behind the melody' },
};

// ---- CONGRUENCE PRE-PASS -------------------------------------------------
// The pre-pass is now DATA-DRIVEN (P2): the lean / engine / takeover policy is
// authored as rules in core/rules.js and evaluated by evaluateCongruence. This
// wrapper keeps the call shape { ok, atoms, reason } the rest of atoms.js uses.
// Decision is identical to the former inline gate — parity-safe.
function congruenceGate(ov, char){
  return evaluateCongruence(ov, char);
}

// ---- HOLDING AREA --------------------------------------------------------
function collect(char, seed, overlayId, overlayDef){
  const roll = mulberry32(seed);
  const pick = a => Array.isArray(a) ? a[Math.floor(roll()*a.length)] : a;
  const held = [];
  const push = (key, a, source) => {
    if (a.chance!=null && roll()>=a.chance) return;
    held.push({ key, source, role:a.role, family:a.family||null, register:a.register||null, fn:a.fn||null,
      priority:a.priority||'support', instrument:a.instrument?pick(a.instrument):null, text:a.text?pick(a.text):null,
      timbre:(a.timbre||[]).slice(), prominence:a.prominence||'foreground', mix:a.mix||null,
      dynamic:a.dynamic||null, density:a.density||null,
      foundational:!!a.foundational, signature:!!a.signature,
      // bed fields (Phase A): behaviour is how the pad MOVES and where it sits —
      // compose states it explicitly because naming a pad does not make Suno
      // render one. bedId is carried so DNA and the metatag engine can key off
      // the functional pad test rather than a family label.
      behaviour:a.behaviour||null, bedId:a.bedId||null });
  };
  for (const [k,a] of Object.entries(char.atoms)) push(k,a,'engine');
  let overlayNote = null;
  // A resolved TWO-TIER modifier (core + signature) may be passed directly as
  // overlayDef; otherwise fall back to a gen-1 overlay looked up by id.
  let ov = overlayDef || (overlayId ? ATOM_OVERLAYS[overlayId] : null);
  // BED PALETTE GATE. A bed authored for the wrong palette would leak synthesis
  // vocabulary onto an acoustic build (or an orchestral section onto a synth
  // one) — the round-3 leak, applied to the pad layer. Swap to the palette-
  // neutral hybrid rather than dropping it: a core with no bed has no body.
  if (ov && char.palette) {
    const bedKey = Object.keys(ov.atoms || {}).find(k => ov.atoms[k] && ov.atoms[k].bedId);
    if (bedKey && !bedAllowed(ov.atoms[bedKey].bedId, char.palette)) {
      const swap = bedAtom('hybrid_pad');
      ov = Object.assign({}, ov, { atoms: Object.assign({}, ov.atoms, { [bedKey]: swap }) });
    }
  }
  if (ov){
    const gate = congruenceGate(ov, char);
    overlayNote = gate.reason;
    for (const [k,a] of Object.entries(gate.atoms)) push(k,a,'overlay');
  }
  return { held, overlayNote };
}

// ---- RECONCILE (pure data) ----------------------------------------------
function reconcile(held){
  const survivor = new Map();
  for (const at of held){
    if (!at.family) continue;
    const cur = survivor.get(at.family);
    // Higher priority wins. A FOUNDATIONAL overlay atom (e.g. a remixer's
    // re-played bassline, where the bass IS the remix craft) also displaces an
    // equal-ranked incumbent — the behaviour this file's header has always
    // documented but which was never implemented, so overlay bass silently lost.
    const outranks = RANK[at.priority] < RANK[cur ? cur.priority : 'decorative'];
    const displaces = cur && at.foundational && !cur.foundational &&
                      RANK[at.priority] <= RANK[cur.priority];
    // OVERLAY WINS TIES outside the genre-owned families. The user picked the
    // modifier deliberately, so its body should occupy the slot rather than lose
    // an insertion-order tie to the character. bass/drums/harmony stay protected
    // — those carry the genre identity and are governed by the takeover policy.
    const PROTECTED = at.family==='bass'||at.family==='drums'||at.family==='harmony';
    const overlayTie = cur && at.source==='overlay' && cur.source!=='overlay' &&
                       !PROTECTED && RANK[at.priority] <= RANK[cur.priority];
    if (!cur || outranks || displaces || overlayTie) survivor.set(at.family, at);
  }
  let kept = held.filter(at => !at.family || survivor.get(at.family)===at);

  /* CROSS-FAMILY INSTRUMENT DE-DUPE (John, Suno test round 4).
   * Family-based reconcile cannot see one voice named twice under DIFFERENT
   * families. John heard 'French horn mentioned on 3 occasions': the strings-and-
   * horns BED (family pad), the composer's body texture (family texture) and the
   * character's counter line (family counter) all named the same horn, and
   * reported the horn parts 'at odds with one another'. Three mentions of one
   * instrument tells Suno to render three of them.
   *
   * PRECEDENCE, not array order: the SIGNATURE claims first (it is the
   * fingerprint and must always survive), then the OVERLAY body (the modifier is
   * the user's deliberate choice), then the character. A voice naming an
   * instrument an earlier claimant already took is dropped. bass and drums are
   * exempt — they carry the genre identity and must never vanish silently.
   */
  const claimed = new Set();
  // Only the INSTRUMENT part of an atom counts. Atoms are authored as
  // '<instrument> <behaviour>', so cut at the first behaviour/placement marker —
  // otherwise trailing fragments like 'the melody' or 'the groove' get treated as
  // instruments and every atom collides with every other one.
  const STOP = /\b(answering|swelling|holding|ticking|sitting|building|opening|fading|rising|running|cycling|driving|punctuating|threading|floating|entering|carried|low|under|underneath|beneath|behind|below|quiet|quietly|soft|softly|hushed|distant|faint|through|across|over|in the|on the|between)\b/;
  const heads = (txt) => {
    let t = String(txt||'').toLowerCase().replace(/^(a|an|the) /,'');
    const m = t.match(STOP);
    if (m && m.index > 0) t = t.slice(0, m.index);
    return t.split(/\s*(?:,| and | with )\s*/)
      .map(x => x.replace(/[^a-z- ]/g,'').trim())
      .filter(x => x && x.length > 3);
  };
  const rank = (at) => at.signature ? 0 : (at.source==='overlay' ? 1 : 2);
  const doomed = new Set();
  for (const at of [...kept].sort((a,b) => rank(a)-rank(b))) {
    if (!at.instrument) continue;
    if (at.family==='bass' || at.family==='drums') continue;
    const h = heads(at.instrument);
    if (!h.length) continue;
    const clash = h.some(x => [...claimed].some(c => c.includes(x) || x.includes(c)));
    if (clash && !at.signature) { doomed.add(at); continue; }
    h.forEach(x => claimed.add(x));
  }
  kept = kept.filter(at => !doomed.has(at));
  return kept;
}

// ---- COMPOSE -------------------------------------------------------------
function wt(at){
  if(!at.instrument) return at.text||'';
  if(!at.timbre.length) return at.instrument;
  const adj=at.timbre[0]; const s=at.instrument.replace(/^(a |an )/i,'');
  const had=/^(a |an )/i.test(at.instrument); const art=/^[aeiou]/i.test(adj)?'an ':'a ';
  return (had?art:'')+adj+' '+s;
}
function counterClause(c){
  // Plain and non-duplicating: instrument, how loud, then ONE statement of how it
  // answers the lead. The density field already carries frequency, so it replaces
  // the generic tail rather than stacking a second 'answering' on top of it.
  const bits=[c.instrument];
  if(c.mix) bits.push(c.mix);
  // density may already read as "answering only occasionally" — fold the lead
  // reference into it rather than appending a second 'answering'.
  const tail = !c.density ? 'answering the lead between phrases'
             : /answer/i.test(c.density) ? c.density.replace(/^answering/i, 'answering the lead')
             : `${c.density}, answering the lead`;
  return `${bits.join(', ')}, ${tail}`;
}
function compose(held, mastering, o){
  o=o||{};
  const fams=new Set(held.map(a=>a.family).filter(Boolean));
  const has=f=>fams.has(f);
  const A=k=>held.find(a=>a.key===k);
  const ownerOf=f=>held.find(a=>a.family===f);
  const sig = f => { const o=ownerOf(f); return o&&o.signature?o:null; };
  const cl=[];
  cl.push(A('genre').text, A('tempo').text);

  const sigBass=sig('bass'), sigHarm=sig('harmony');
  if(sigBass) cl.push(sigBass.instrument);
  if(sigHarm) cl.push(sigHarm.text||sigHarm.instrument);
  // SIGNATURE PLACEMENT — John, 2026-07-22 (Suno test round 2).
  // Lever 1 used to hoist the signature to the FRONT. That was correct when
  // overlays were delta-only garnish that would otherwise be inaudible. With
  // gen-2 modifiers carrying a real body it backfired: the tell landed in the
  // hardest-weighted position and Suno read the exotic instrument as the GENRE
  // ("modifier instruments dominate... alter Suno's understanding of what music
  // it is trying to produce"). The signature is now DEFERRED and emitted after
  // the core body, below — decoration, not identity.
  const deferredSig=[];
  const SIG_SLOTS=['lead','strings','texture','counter','colour'];
  for(const f of SIG_SLOTS){ const x=sig(f); if(x) deferredSig.push(x.text||x.instrument); }

  const bass=ownerOf('bass'), groove=A('groove');
  if(groove){
    if(sigBass) cl.push(`${groove.instrument} locked to the bassline`);
    else if(bass) cl.push(`${wt(bass)} and ${groove.instrument}, ${REL.foundation.render}`);
  } else if(bass && !sigBass){
    // groove-absent (beatless) character: bass still anchors, no drum pocket.
    cl.push(`${wt(bass)} holding the low end, no drums`);
  }
  const perc=ownerOf('perc'); if(perc) cl.push(`${perc.instrument} over the groove`);

  const lead=ownerOf('lead'); if(lead && !lead.signature) cl.push(`${wt(lead)} on the melody out front`);

  // THE BED. Round 3 showed that NAMING a pad does not make Suno render one —
  // John's own definition is behavioural (sustained, slow attack and release,
  // background placement, rich chords), so the behaviour is stated explicitly
  // here rather than left implied by the instrument name. Mix placement stays
  // LOW on purpose: sitting behind the lead is correct pad behaviour, and the
  // answer to 'I could not tell what the pad comprised' is richer harmonic
  // content and an audible swell, not more level.
  const pads=ownerOf('pad'), harm=ownerOf('harmony');
  if(pads||harm){ let h='';
    if(pads) h = pads.behaviour ? `${wt(pads)} ${pads.behaviour}` : wt(pads);
    if(harm && !sigHarm) h=(h?`${h}, moving through `:'')+ (harm.text||harm.instrument);
    if(h) cl.push(h); }

  const strings=ownerOf('strings'); if(strings && !strings.signature) cl.push(`${wt(strings)} under the melody`);
  const texture=ownerOf('texture'); if(texture && !texture.signature) cl.push(`${texture.instrument} sustained underneath`);

  const counter=ownerOf('counter');
  if(counter && lead && !counter.signature) cl.push(counterClause(counter));

  // LIGHT TOUCH (John-approved default): the modifier contributes its body plus
  // ONE signature statement. Extra signature voices are dropped unless the build
  // explicitly asks for the full-strength application.
  if(deferredSig.length) cl.push(...(o.fullModifier ? deferredSig : deferredSig.slice(0,1)));

  // Phase B: decoration atoms now state their own mix placement, so the blanket
  // 'in the gaps' suffix would double it ('low in the mix in the gaps'). Only add
  // it when the atom has not already said where it sits.
  const colour=ownerOf('colour')||ownerOf('perc-accent');
  if(colour && !colour.signature){
    const placed=/\b(under|underneath|beneath|behind|below|low\b|in the gaps|between the phrases|quiet|soft|hushed|distant|faint)/i.test(colour.instrument||'');
    cl.push(placed ? colour.instrument : `${colour.instrument} in the gaps`);
  }
  const movement=A('movement'); if(movement) cl.push(movement.text);

  // Find the overlay's arc by SOURCE+FN, not by a literal key: the two-tier
  // resolver namespaces atom keys (core_/sig_), so the old A('ov_arc') lookup
  // silently missed and every overlay arc line was dropped.
  const ovArc=A('ov_arc')||held.find(a=>a.source==='overlay'&&a.fn==='arc');
  if(ovArc) cl.push(ovArc.text);
  else { if(REL.harmonyResolve.needs.every(has)) cl.push(REL.harmonyResolve.render);
         if(REL.arc.needs.every(has)) cl.push(REL.arc.render); }
  if(ovArc && REL.harmonyResolve.needs.every(has)) cl.push(REL.harmonyResolve.render);

  cl.push(mastering);
  return cl.filter(Boolean).join(', ').replace(/\s+/g,' ').replace(/\s*,\s*/g,', ').trim();
}

// ---- PUBLIC: build one atom character (+ optional overlay) ----------------
// Returns the shell's uniform result shape. `arrangement` is the reconciled
// atom list — the structured layer the Lyric/Metatag engine will read.
function buildAtoms(char, opts){
  const o = opts || {};
  const { held, overlayNote } = collect(char, o.seed >>> 0, o.overlayId || null, o.overlayDef || null);
  const kept = reconcile(held);
  let style = compose(kept, char.mastering, o);
  const over = style.length > CHAR_LIMIT;
  if (o.maxMode) { /* atom path is already budget-safe; Max is a legacy-only directive */ }
  // overlay-specific negatives merge in only when the overlay actually APPLIED
  // (not refused). Engine-only + composer paths carry none, so their negative
  // field is unchanged — ALWAYS_BAN only (parity-safe).
  const ovDef = !overlayNote ? (o.overlayDef || (o.overlayId ? ATOM_OVERLAYS[o.overlayId] : null)) : null;
  const ovNeg = (ovDef && ovDef.negative) ? ovDef.negative : [];
  // NEGATIVE CAP (John, round 4): the negative field loses effectiveness beyond
  // about five elements, so an unranked list of 23 silently discarded the ones
  // that mattered and John had to front-load them by hand. Negatives are now
  // ranked by observed harm and truncated — genre-breaking bans first, cosmetic
  // non-musical bans only if slots remain.
  const negative = selectNegatives([...ovNeg, ...ALWAYS_BAN]).join(', ') + '.';
  return { style, negative, lyrics:'', length:style.length, over,
           arrangement:kept, overlayNote };
}

/* GEN-1 RETIRED — John signed off the gen-2 two-tier modifier set on 2026-07-22.
 * The gen-1 signature-delta overlays in ATOM_OVERLAYS are kept ONLY so the
 * existing harnesses (validate-dna, validate-overlays) keep exercising the
 * legacy path; they are no longer offered to the user. The UI list is now the
 * gen-2 modifiers, each carrying its 3 cores and 3 signatures. */
const GEN1_OVERLAYS_RETIRED = true;

function atomOverlayList(){
  return modifierList();   // gen-2: { id, label, kind, cores[], signatures[] }
}

// Explicit accessor for the retired gen-1 sets (harnesses only).
function legacyOverlayList(){
  return Object.keys(ATOM_OVERLAYS).map(id => ({ id, label:ATOM_OVERLAYS[id].label, kind:ATOM_OVERLAYS[id].kind }));
}

function atomCharacters(module){
  return Object.keys(module).map(id => ({ id, label:module[id].label, source:module[id].source,
    tempo: module[id].atoms.tempo ? module[id].atoms.tempo.text : '' }));
}

Object.assign(window.__ATMOS, { buildAtoms, atomOverlayList, legacyOverlayList, atomCharacters, ATOM_OVERLAYS, GEN1_OVERLAYS_RETIRED });
})();

/* engines/atom-pools.js */
(function(){
/* ==========================================================================
 * atom-pools.js — corrected instrument pools for the atom model (Balearic set).
 *
 * Rebuilt from scratch (legacy engine-extras Balearic pools were 68% defective).
 * RUBRIC (locked with John, 2026-07-20):
 *  - Palette = sound source. electronic = synthesized/sequenced. acoustic =
 *    acoustically sounded. Electro-acoustic (Rhodes, Wurlitzer, Hammond, clavinet,
 *    electric guitar, lap-steel guitar, fretless bass, mellotron) are the only
 *    instruments allowed in either palette, where the genre supports them.
 *  - Instrument roles hold a PURE INSTRUMENT NAME. harmony = key/mode/progression.
 *    movement = production directives. Both structural, not prose.
 *  - Theory-appropriate + complementary per cluster; an instrument appears in at
 *    most one role per cluster+palette so draws don't self-collide.
 *
 * 2026-07-20 revision: clarinet removed everywhere (too dominant) -> French horn /
 * flugelhorn / cor anglais; fretless bass added across acoustic bass pools;
 * lap-steel guitar added (Guitar del Mar strand); thin pools deepened for batch
 * variety.
 * ========================================================================*/

const ATOM_POOLS_BALEARIC = {

  'organic-warm-downtempo': {
    label: 'Organic warm downtempo', genre: 'Balearic downtempo', tempo: '80-100 BPM, low-mid energy', beatless: false,
    harmony: ['minor key', 'Dorian mode', 'minor 7th and add9 voicings', 'ii-V-i in a minor key', 'a suspended-to-major resolution'],
    movement: ['wide stereo panning', 'slow low-pass filter sweeps', 'tape-saturated warmth', 'tempo-synced delay throws', 'gentle sidechain movement'],
    electronic: {
      bass: ['analog synth bass', 'sub bass', 'FM bass'],
      rhythm: ['soft downtempo kit', 'dusty boom-bap kit', 'drum machine'],
      perc: ['drum-machine hi-hats', 'rimshot clicks', 'synth clap', 'electro shaker'],
      pads: ['analog synth pads', 'string-machine pad', 'mellotron', 'choir pad'],
      strings: ['synth strings', 'string-machine ensemble'],
      texture: ['drone synth', 'granular synth'],
      motif: ['Rhodes', 'synth lead', 'synth pluck'],
      counter: ['Wurlitzer', 'synth counter-line'],
      color: ['synth bells', 'glassy mallet synth', 'synth marimba'],
    },
    acoustic: {
      bass: ['upright bass', 'double bass', 'fretless bass'],
      rhythm: ['brushed drum kit', 'soft jazz kit', 'live drum kit'],
      perc: ['shakers', 'congas', 'bongos', 'cabasa', 'frame drum', 'hang drum'],
      pads: ['harmonium', 'bowed string pad'],
      strings: ['cello', 'viola', 'string ensemble'],
      texture: ['felt piano', 'harp', 'bowed metallophone'],
      motif: ['nylon guitar', 'lap-steel guitar', 'flugelhorn'],
      counter: ['muted trumpet', 'French horn', 'cor anglais'],
      color: ['glockenspiel', 'vibraphone', 'kalimba', 'celeste'],
    },
  },

  'lush-cinematic-chillout': {
    label: 'Lush cinematic chillout', genre: 'Balearic downtempo', tempo: '85-105 BPM, medium energy', beatless: false,
    harmony: ['minor-to-relative-major over eight-bar cycles', 'add9 voicings into a major-seventh resolution', 'wide sus2 voicings with a delayed resolve', 'Aeolian mode', 'a Picardy-third lift'],
    movement: ['wide stereo panning', 'slow filter modulation on the pads', 'orchestral swells rising and receding', 'long reverb tails', 'LFO and chorus movement on the synths'],
    electronic: {
      bass: ['sub bass', 'FM sub-bass'],
      rhythm: ['soft downtempo kit', 'lounge kit'],
      perc: ['electro shaker', 'synth triangle', 'drum-machine hi-hats'],
      pads: ['analog synth pads', 'layered synth pads', 'choir pad'],
      strings: ['synth strings', 'string-machine ensemble'],
      texture: ['drone synth', 'mellotron'],
      motif: ['Rhodes', 'synth lead'],
      counter: ['synth counter-line'],
      color: ['synth bells', 'glassy mallet synth'],
    },
    acoustic: {
      bass: ['double bass', 'upright bass', 'fretless bass'],
      rhythm: ['brushed drum kit'],
      perc: ['shakers', 'frame drum', 'triangle'],
      pads: ['pipe organ', 'harmonium', 'bowed string pad'],
      strings: ['cello', 'string ensemble', 'violin', 'viola'],
      texture: ['cor anglais', 'lap-steel guitar'],
      motif: ['grand piano', 'felt piano', 'flute'],
      counter: ['French horn', 'flugelhorn', 'muted trumpet'],
      color: ['glockenspiel', 'tubular bells', 'harp', 'celeste'],
    },
  },

  'dreamy-analog-electronic': {
    label: 'Dreamy analog electronic', genre: 'dreamy analog electronic', tempo: '90-110 BPM, medium energy', beatless: false,
    harmony: ['major key with modal color', 'Lydian mode', 'slow major-seventh pads', 'a plagal cadence', 'suspended major voicings'],
    movement: ['slow pitch drift', 'slow filter sweeps', 'wide stereo panning', 'chorus and phaser on the synths', 'tempo-synced delay'],
    electronic: {
      bass: ['Moog bass', 'analog synth bass', 'sub bass'],
      rhythm: ['soft drum machine', 'LinnDrum-style kit'],
      perc: ['drum-machine hi-hats', 'synth clap', 'electro shaker', 'rimshot clicks'],
      pads: ['detuned analog pads', 'analog synth pads', 'mellotron', 'choir pad'],
      strings: ['synth strings', 'string-machine ensemble'],
      texture: ['granular synth', 'drone synth'],
      motif: ['synth lead', 'synth arp', 'synth pluck'],
      counter: ['Wurlitzer', 'synth counter-line'],
      color: ['synth bells', 'glassy mallet synth', 'synth marimba'],
    },
    acoustic: {
      bass: [],
      rhythm: [],
      perc: [],
      pads: ['harmonium'],
      strings: [],
      texture: ['harp', 'lap-steel guitar'],
      motif: ['Rhodes', 'grand piano'],
      counter: ['French horn'],
      color: ['glockenspiel', 'celeste', 'kalimba'],
    },
  },

  'dub-space-downtempo': {
    label: 'Dub-space downtempo', genre: 'dub-space downtempo', tempo: '70-95 BPM, low-mid energy', beatless: false,
    harmony: ['minor key', 'a modal minor vamp', 'short dominant-seventh dub chords', 'a two-chord minor rock', 'Phrygian color'],
    movement: ['spring reverb', 'tempo-synced dub delay throws', 'wide stereo panning', 'low-pass filter sweeps', 'echo feedback swells'],
    electronic: {
      bass: ['dub sub bass', 'sine sub bass', 'analog synth bass'],
      rhythm: ['dub kit', 'soft drum machine', 'one-drop kit'],
      perc: ['rimshot clicks', 'drum-machine hi-hats', 'electro shaker'],
      pads: ['analog synth pads', 'clipped organ synth'],
      strings: ['synth strings', 'string-machine ensemble'],
      texture: ['drone synth', 'granular synth'],
      motif: ['clipped synth chords', 'synth lead', 'Rhodes'],
      counter: ['Wurlitzer', 'synth counter-line'],
      color: ['synth bells', 'glassy mallet synth'],
    },
    acoustic: {
      bass: ['upright bass', 'fretless bass'],
      rhythm: ['brushed drum kit'],
      perc: ['congas', 'bongos', 'shakers', 'frame drum', 'hang drum'],
      pads: ['harmonium'],
      strings: ['cello'],
      texture: ['lap-steel guitar'],
      motif: ['melodica', 'muted trumpet'],
      counter: ['trombone', 'French horn'],
      color: ['glockenspiel', 'kalimba'],
    },
  },

  'deep-nocturnal-balearic': {
    label: 'Deep nocturnal Balearic', genre: 'Balearic downtempo', tempo: '100-115 BPM, medium energy', beatless: false,
    harmony: ['minor key', 'Aeolian mode', 'a minor-seventh vamp', 'add9 and sus4 voicings', 'Phrygian color'],
    movement: ['low-pass filter sweeps', 'wide stereo panning', 'long reverb tails', 'sidechain movement', 'tempo-synced delay'],
    electronic: {
      bass: ['sub bass', 'analog synth bass', 'FM bass'],
      rhythm: ['downtempo kit', 'deep house kit', 'soft four-on-the-floor kit'],
      perc: ['drum-machine hi-hats', 'electro shaker', 'rimshot clicks', 'synth clap'],
      pads: ['analog synth pads', 'clipped organ synth', 'choir pad'],
      strings: ['synth strings', 'string-machine ensemble'],
      texture: ['drone synth', 'granular synth'],
      motif: ['synth lead', 'synth pluck', 'Rhodes'],
      counter: ['synth counter-line', 'Wurlitzer'],
      color: ['synth bells', 'glassy mallet synth'],
    },
    acoustic: {
      bass: ['upright bass', 'fretless bass'],
      rhythm: ['brushed drum kit'],
      perc: ['congas', 'bongos', 'shakers', 'cabasa', 'frame drum'],
      pads: ['harmonium'],
      strings: ['cello', 'viola'],
      texture: ['felt piano', 'lap-steel guitar', 'duduk'],
      motif: ['nylon guitar', 'ney'],
      counter: ['French horn', 'flugelhorn'],
      color: ['vibraphone', 'kalimba'],
    },
  },

  'sunlit-mediterranean': {
    label: 'Sunlit Mediterranean', genre: 'Balearic downtempo', tempo: '100-118 BPM, medium energy', beatless: false,
    harmony: ['major key', 'Mixolydian mode', 'I-V-vi-IV', 'Andalusian cadence', 'sus2 into major voicings'],
    movement: ['wide stereo panning', 'slow filter sweeps', 'tape-saturated warmth', 'tempo-synced delay', 'bright reverb'],
    electronic: {
      bass: ['analog synth bass', 'sub bass'],
      rhythm: ['soft house kit', 'downtempo kit'],
      perc: ['drum-machine hi-hats', 'electro shaker', 'synth clap'],
      pads: ['analog synth pads', 'choir pad'],
      strings: ['synth strings', 'string-machine ensemble'],
      texture: ['drone synth'],
      motif: ['synth pluck', 'synth lead', 'Rhodes'],
      counter: ['synth counter-line', 'Hammond organ'],
      color: ['synth marimba', 'synth bells'],
    },
    acoustic: {
      bass: ['upright bass', 'fretless bass'],
      rhythm: ['brushed drum kit', 'cajón kit'],
      perc: ['shakers', 'congas', 'tambourine', 'cabasa', 'frame drum'],
      pads: ['accordion', 'harmonium'],
      strings: ['string ensemble', 'cello'],
      texture: ['nylon guitar', 'lap-steel guitar'],
      motif: ['flamenco guitar', 'pan flute', 'flugelhorn', 'mandolin'],
      counter: ['muted trumpet', 'French horn', 'saxophone'],
      color: ['marimba', 'glockenspiel', 'vibraphone'],
    },
  },

  'ambient-beatless-atmospheric': {
    label: 'Ambient / beatless atmospheric', genre: 'ambient atmospheric', tempo: 'free, very low energy', beatless: true,
    harmony: ['a static major-seventh drone', 'Lydian mode', 'slow suspended-chord shifts', 'an open-fifth pedal', 'minor-to-major cross-fades'],
    movement: ['very long reverb tails', 'slow granular clouds', 'wide stereo panning', 'slow filter drift', 'cross-faded layer swells'],
    electronic: {
      bass: ['sub drone'],
      rhythm: [],
      perc: [],
      pads: ['analog synth pads', 'choir pad'],
      strings: ['synth strings', 'string-machine ensemble'],
      texture: ['granular synth', 'drone synth', 'mellotron'],
      motif: ['synth lead', 'Rhodes'],
      counter: ['synth counter-line'],
      color: ['synth bells', 'glassy mallet synth'],
    },
    acoustic: {
      bass: ['bowed double bass'],
      rhythm: [],
      perc: [],
      pads: ['pipe organ', 'harmonium', 'bowed string pad'],
      strings: ['cello', 'string ensemble', 'violin'],
      texture: ['felt piano', 'glass harmonica', 'bowed metallophone', 'lap-steel guitar'],
      motif: ['flute', 'cor anglais'],
      counter: ['French horn'],
      color: ['glockenspiel', 'celeste', 'tubular bells', 'harp'],
    },
  },

  'moody-trip-hop-downbeat': {
    label: 'Moody trip-hop downbeat', genre: 'trip-hop downbeat', tempo: '70-90 BPM, low-mid energy', beatless: false,
    harmony: ['minor key', 'a minor-seventh vamp', 'Phrygian color', 'chromatic descending bass', 'add9 and minor-sixth voicings'],
    movement: ['tape-saturated warmth', 'low-pass filter sweeps', 'tempo-synced delay', 'wide stereo panning', 'spring reverb'],
    electronic: {
      bass: ['sub bass', 'analog synth bass'],
      rhythm: ['trip-hop breakbeat kit', 'dusty boom-bap kit', 'drum machine'],
      perc: ['drum-machine hi-hats', 'rimshot clicks', 'electro shaker'],
      pads: ['analog synth pads', 'detuned analog pads'],
      strings: ['synth strings', 'string-machine ensemble'],
      texture: ['drone synth', 'granular synth', 'mellotron'],
      motif: ['Rhodes', 'synth lead', 'clipped synth chords'],
      counter: ['Wurlitzer', 'synth counter-line'],
      color: ['synth bells', 'glassy mallet synth'],
    },
    acoustic: {
      bass: ['upright bass', 'fretless bass'],
      rhythm: ['brushed drum kit', 'live break kit'],
      perc: ['congas', 'shakers', 'tambourine'],
      pads: ['harmonium', 'bowed string pad'],
      strings: ['cello', 'viola', 'string ensemble'],
      texture: ['felt piano', 'lap-steel guitar'],
      motif: ['muted trumpet', 'flugelhorn', 'Rhodes'],
      counter: ['French horn', 'cor anglais'],
      color: ['vibraphone', 'glockenspiel', 'harp'],
    },
  },

  'balearic-house': {
    label: 'Balearic house', genre: 'Balearic house', tempo: '118-124 BPM, medium-high energy', beatless: false,
    harmony: ['minor key', 'a minor-seventh vamp', 'add9 and sus4 voicings', 'Dorian mode', 'I-V-vi-IV in a minor key'],
    movement: ['sidechain pump', 'low-pass filter sweeps', 'wide stereo panning', 'tempo-synced delay', 'long reverb tails'],
    electronic: {
      bass: ['analog synth bass', 'sub bass', 'plucked synth bass'],
      rhythm: ['four-on-the-floor house kit', 'soft house kit'],
      perc: ['drum-machine hi-hats', 'electro shaker', 'synth clap', 'rimshot clicks'],
      pads: ['analog synth pads', 'clipped organ synth', 'choir pad'],
      strings: ['synth strings', 'string-machine ensemble'],
      texture: ['drone synth', 'granular synth'],
      motif: ['synth pluck', 'synth lead', 'filtered saw lead'],
      counter: ['synth counter-line', 'Wurlitzer'],
      color: ['synth bells', 'synth marimba'],
    },
    acoustic: {
      bass: ['upright bass', 'fretless bass'],
      rhythm: ['live house kit'],
      perc: ['congas', 'bongos', 'shakers', 'tambourine', 'cabasa'],
      pads: ['harmonium'],
      strings: ['string ensemble', 'cello'],
      texture: ['nylon guitar', 'lap-steel guitar'],
      motif: ['saxophone', 'flute', 'Rhodes'],
      counter: ['muted trumpet', 'French horn', 'flugelhorn'],
      color: ['vibraphone', 'marimba', 'glockenspiel'],
    },
  },

  'nu-disco-slo-mo': {
    label: 'Nu-disco / slo-mo disco', genre: 'nu-disco', tempo: '100-120 BPM, medium-high energy', beatless: false,
    harmony: ['major key', 'ii-V-I with secondary dominants', 'a funk-minor vamp', 'seventh and ninth chords', 'I-vi-ii-V'],
    movement: ['sidechain pump', 'wide stereo panning', 'tempo-synced delay', 'filter sweeps on the strings', 'tape-saturated warmth'],
    electronic: {
      bass: ['analog synth bass', 'Moog bass', 'sub bass'],
      rhythm: ['disco four-on-the-floor kit', 'drum machine'],
      perc: ['drum-machine hi-hats', 'synth clap', 'electro shaker'],
      pads: ['analog synth pads', 'string-machine pad'],
      strings: ['synth strings', 'string-machine ensemble'],
      texture: ['clavinet', 'drone synth'],
      motif: ['synth arp', 'synth lead', 'Rhodes'],
      counter: ['synth brass', 'Hammond organ'],
      color: ['synth bells', 'glassy mallet synth'],
    },
    acoustic: {
      bass: ['fretless bass', 'electric bass'],
      rhythm: ['live disco kit'],
      perc: ['congas', 'bongos', 'tambourine', 'shakers'],
      pads: ['string ensemble'],
      strings: ['cello', 'violin'],
      texture: ['electric guitar', 'clavinet'],
      motif: ['saxophone', 'flute', 'grand piano'],
      counter: ['muted trumpet', 'trombone', 'French horn'],
      color: ['vibraphone', 'marimba', 'glockenspiel'],
    },
  },

  'melodic-deep-house': {
    label: 'Melodic deep house', genre: 'melodic deep house', tempo: '120-124 BPM, medium-high energy', beatless: false,
    harmony: ['minor key', 'add9 and sus2 voicings', 'a minor-seventh arpeggio cycle', 'Aeolian mode', 'i-VI-III-VII'],
    movement: ['sidechain pump', 'long reverb tails', 'wide stereo panning', 'filter sweeps on the arp', 'tempo-synced delay'],
    electronic: {
      bass: ['sub bass', 'plucked synth bass', 'analog synth bass'],
      rhythm: ['deep house kit', 'four-on-the-floor house kit'],
      perc: ['drum-machine hi-hats', 'electro shaker', 'synth clap', 'rimshot clicks'],
      pads: ['analog synth pads', 'layered synth pads', 'choir pad'],
      strings: ['synth strings', 'string-machine ensemble'],
      texture: ['drone synth', 'granular synth'],
      motif: ['synth arp', 'synth lead', 'synth pluck'],
      counter: ['synth counter-line', 'Rhodes'],
      color: ['synth bells', 'glassy mallet synth'],
    },
    acoustic: {
      bass: ['fretless bass'],
      rhythm: [],
      perc: ['shakers', 'congas'],
      pads: ['harmonium'],
      strings: ['string ensemble'],
      texture: ['grand piano'],
      motif: ['Rhodes'],
      counter: ['cello'],
      color: ['glockenspiel', 'vibraphone'],
    },
  },

  'lounge-house': {
    label: 'Lounge House', genre: 'lounge house', tempo: '100-120 BPM, medium energy', beatless: false,
    harmony: ['ii-V-I with jazz sevenths', 'a minor-seventh and ninth vamp', 'bossa-nova major-seventh changes', 'Dorian mode', 'add9 and thirteenth voicings'],
    movement: ['sidechain pump', 'wide stereo panning', 'tape-saturated warmth', 'tempo-synced delay', 'filter sweeps on the pads'],
    electronic: {
      bass: ['sub bass', 'analog synth bass'],
      rhythm: ['soft house kit', 'four-on-the-floor house kit'],
      perc: ['drum-machine hi-hats', 'electro shaker', 'synth clap'],
      pads: ['analog synth pads', 'clipped organ synth', 'choir pad'],
      strings: ['synth strings', 'string-machine ensemble'],
      texture: ['drone synth'],
      motif: ['Rhodes', 'synth lead', 'Wurlitzer'],
      counter: ['Hammond organ', 'synth counter-line'],
      color: ['synth bells', 'glassy mallet synth'],
    },
    acoustic: {
      bass: ['upright bass', 'double bass', 'fretless bass'],
      rhythm: ['brushed drum kit', 'jazz drum kit'],
      perc: ['congas', 'bongos', 'shakers', 'cabasa'],
      pads: ['Hammond organ'],
      strings: ['string ensemble', 'cello'],
      texture: ['jazz guitar', 'nylon guitar'],
      motif: ['grand piano', 'saxophone', 'flugelhorn'],
      counter: ['muted trumpet', 'French horn', 'flute'],
      color: ['vibraphone', 'marimba', 'glockenspiel'],
    },
  },

};

Object.assign(window.__ATMOS, { ATOM_POOLS_BALEARIC });
})();

/* engines/atom-characters.js */
(function(){
/* ==========================================================================
 * atom-characters.js — the 12 Balearic clusters WIRED as atom characters.
 *
 * Each cluster in atom-pools.js becomes ONE atom character (John, 2026-07-20:
 * "one cluster = one character"). Palette (electronic | acoustic) is an AXIS,
 * not a separate character — collect() draws per role FROM THE SELECTED PALETTE.
 *
 * ATOMS HOLD PURE INSTRUMENT NAMES ONLY. All timbre / level / interplay language
 * is assembled at compose (core/atoms.js) from the structured attribute fields
 * below — never fused into the instrument string. The pools are already bare
 * names, so an atom's `instrument` is just that role's pool array for the palette
 * and `timbre` stays empty; compose supplies the relational/interaction language.
 *
 * The Suno-validated reference character still lives in atom-balearic.js and is
 * the seed-parity anchor for the harness; migrating IT onto this substrate
 * (staying byte-identical) is a separate open item.
 * ========================================================================*/
const {ATOM_POOLS_BALEARIC} = window.__ATMOS;

const MASTERING = 'Polished Dolby Atmos-Master Atmos -2dB';

// House-family + the one explicitly-electronic cluster lean electronic; these
// accept an electronic-only overlay (Moroder). Everything else is downtempo /
// acoustic-leaning and REFUSES it (2026-07-17 congruence finding).
const ELECTRONIC_LEAN = new Set([
  'dreamy-analog-electronic', 'balearic-house', 'nu-disco-slo-mo',
  'melodic-deep-house', 'lounge-house',
]);

// Pool role -> atom key + family + the structural (non-prose) attributes compose
// reads. instrument is filled per palette from the pool; timbre stays [] (pure
// identity — compose adds the language). Order here is documentation only;
// compose fixes clause order.
const ROLE_SPEC = {
  bass:    { key:'bass',    family:'bass',    register:'sub',      fn:'foundation-weight', priority:'core' },
  rhythm:  { key:'groove',  family:'drums',   register:'low-mid',  fn:'groove',            priority:'core' },
  perc:    { key:'perc',    family:'perc',    register:'high',     fn:'groove-thread',     priority:'decorative' },
  pads:    { key:'pads',    family:'pad',     register:'mid',      fn:'harmony-bed',       priority:'core' },
  strings: { key:'strings', family:'strings', register:'mid',      fn:'support-bed',       priority:'support' },
  texture: { key:'texture', family:'texture', register:'low-mid',  fn:'sustain-under',     priority:'decorative' },
  motif:   { key:'lead',    family:'lead',    register:'upper-mid',fn:'foreground-melody', priority:'core' },
  // counter carries the hard-won "answer without dominating" LEVEL as structured
  // attributes (not baked into the name) so a counter voice never over-renders.
  counter: { key:'counter', family:'counter', register:'low',     fn:'answer',            priority:'support',
             prominence:'background', mix:'faint and buried well under the mix',
             dynamic:'pianissimo', density:'answering only occasionally' },
  // pool role is spelled 'color'; compose owns the 'colour' family.
  color:   { key:'colour',  family:'colour',  register:'high',     fn:'accent',            priority:'decorative', chance:0.5 },
};

function paletteAtoms(cluster, pal) {
  const src = cluster[pal] || {};
  const atoms = {
    genre: { role:'genre', text: cluster.genre },
    tempo: { role:'tempo', text: cluster.tempo },
  };
  for (const [poolRole, spec] of Object.entries(ROLE_SPEC)) {
    // beatless characters emit no drum kit; skip empty pool roles entirely.
    if (cluster.beatless && poolRole === 'rhythm') continue;
    const names = src[poolRole];
    if (!names || !names.length) continue;
    const a = { role: spec.family === 'drums' ? 'rhythm' : poolRole,
                family: spec.family, register: spec.register, fn: spec.fn,
                instrument: names.slice(), timbre: [], priority: spec.priority };
    if (spec.prominence) a.prominence = spec.prominence;
    if (spec.mix) a.mix = spec.mix;
    if (spec.dynamic) a.dynamic = spec.dynamic;
    if (spec.density) a.density = spec.density;
    if (spec.chance != null) a.chance = spec.chance;
    atoms[spec.key] = a;
  }
  // harmony + movement are structural TEXT atoms drawn from cluster metadata.
  if (cluster.harmony && cluster.harmony.length)
    atoms.harmony = { role:'harmony', family:'harmony', register:'mid', fn:'chord-movement',
                      text: cluster.harmony.slice(), priority:'core' };
  if (cluster.movement && cluster.movement.length) {
    // PALETTE-APPROPRIATE MOVEMENT — John, round 3: an ACOUSTIC ambient build
    // (pipe organ, flute, string ensemble, French horn) was still emitting
    // "slow granular clouds", which is a synthesis term with no acoustic
    // meaning ("I've never seen these in an orchestra"). Electronic-only
    // production vocabulary is suppressed on acoustic palettes; if that would
    // empty the pool, the acoustic-safe terms are used instead.
    const ELECTRONIC_ONLY = /granular|filter|sidechain|vocoder|bitcrush|resonan|LFO|synth/i;
    let mv = cluster.movement.slice();
    if (pal !== 'electronic') {
      const safe = mv.filter(t => !ELECTRONIC_ONLY.test(t));
      mv = safe.length ? safe : ['very long reverb tails', 'wide stereo panning'];
    }
    atoms.movement = { role:'movement', family:'production', register:'n/a', fn:'movement',
                       text: mv, priority:'support' };
  }
  return atoms;
}

function buildCharacters() {
  const out = {};
  for (const [key, cluster] of Object.entries(ATOM_POOLS_BALEARIC)) {
    const electronic = paletteAtoms(cluster, 'electronic');
    const acoustic   = paletteAtoms(cluster, 'acoustic');
    out[key] = {
      label: cluster.label,
      source: 'Balearic',
      electronicLean: ELECTRONIC_LEAN.has(key),
      genreOwned: ['bass', 'drums'],
      beatless: !!cluster.beatless,
      mastering: MASTERING,
      // palette axis: generate resolves char.atoms = palettes[palette].
      palettes: { electronic, acoustic },
      // default so any code reading char.atoms.tempo (lists/validation) works.
      atoms: electronic,
    };
  }
  return out;
}

const ATOM_POOL_CHARACTERS = buildCharacters();

// Resolve a character's atom table for a palette (generate calls this).
function atomCharacterForPalette(char, palette) {
  if (!char.palettes) return char;                       // e.g. the validated ref
  const pal = char.palettes[palette] ? palette : 'electronic';
  const atoms = char.palettes[pal];
  // record the resolved palette so downstream (the bed layer) can gate on it
  return Object.assign({}, char, { atoms, palette: pal });
}

Object.assign(window.__ATMOS, { atomCharacterForPalette, ATOM_POOL_CHARACTERS });
})();

/* core/dna.js */
(function(){
/* ==========================================================================
 * dna.js — Musical DNA (P0 of the Composition Workbench).
 *
 * Formalizes the atom holding-area into a serialized, versioned MusicalDNA object
 * that BOTH engines read: Style compose (already) and the future Lyric/Metatag
 * engine. It is NOT a second source of truth — it is a read-only projection of
 * what buildAtoms already resolves, plus seed (reproducibility) and per-field
 * CONSUMER CONTRACTS. Purely additive: it calls buildAtoms and never alters
 * rendering, so style output stays byte-identical (parity-safe).
 *
 * CONSUMER CONTRACTS enforce the standing rules structurally: `affect` (mood /
 * emotional atmosphere) is readable by the lyric + metatag engines and FORBIDDEN
 * to style compose — so mood words can never leak into the style prompt. Artist/
 * overlay influences render generic (renderPolicy), never as names in output.
 * ========================================================================*/

const {resolveModifier} = window.__ATMOS;
const {applyAnchor, anchorCongruent} = window.__ATMOS;
const {buildAtoms, ATOM_OVERLAYS} = window.__ATMOS;
const {atomCharacterForPalette} = window.__ATMOS;

const DNA_VERSION = '1.0';

// which engines may READ each DNA field. 'style' deliberately absent from affect.
const DNA_CONSUMERS = Object.freeze({
  identity:    ['style', 'lyric', 'metatag'],
  influences:  ['style', 'lyric', 'metatag'],
  harmony:     ['style', 'lyric', 'metatag'],
  arrangement: ['style', 'metatag'],
  tempo:       ['style', 'lyric', 'metatag'],
  dynamics:    ['style', 'metatag'],
  production:  ['style', 'metatag'],
  vocal:       ['lyric', 'metatag'],
  affect:      ['lyric', 'metatag'],   // NOT style — no mood words in the style prompt
});

const byRole   = (arr, role)   => arr.find(a => a.role === role);
const byFamily = (arr, family) => arr.find(a => a.family === family);

/**
 * buildMusicalDNA(baseChar, palette, opts)
 *  - baseChar: a pool character (from ATOM_POOL_CHARACTERS) or the validated ref
 *  - palette : 'electronic' | 'acoustic'
 *  - opts    : { seed, characterId, modifierId, coreId, signatureId }
 *              modifierId/coreId/signatureId select a gen-2 two-tier modifier and
 *              are the LIVE path. overlayId/overlayDef remain for the harnesses
 *              and the retired gen-1 sets.
 * Returns a serializable MusicalDNA object.
 */
function buildMusicalDNA(baseChar, palette, opts) {
  const o = opts || {};
  const seed = o.seed >>> 0;
  const char = atomCharacterForPalette(baseChar, palette);
  // Gen-2 two-tier modifier (live path) resolves to an overlay definition.
  const modDef = o.modifierId ? resolveModifier(o.modifierId, o.coreId, o.signatureId) : null;
  const useDef = modDef || o.overlayDef || null;
  const r = buildAtoms(char, { seed, overlayId: useDef ? null : (o.overlayId || null), overlayDef: useDef });

  const arr = r.arrangement;
  const refused = !!r.overlayNote;
  const overlayDef = useDef || (o.overlayId ? ATOM_OVERLAYS[o.overlayId] : null);

  const genreAnchor = (byRole(arr, 'genre') || {}).text || null;
  const tempoSpec   = (byRole(arr, 'tempo') || {}).text || null;
  const keyMode     = (byFamily(arr, 'harmony') || {}).text || null;
  const arc         = (byRole(arr, 'arc') || {}).text || null;
  const movement    = arr.filter(a => a.role === 'movement').map(a => a.text || a.instrument).filter(Boolean);

  // arrangement projection: every surviving voice, tagged engine vs overlay.
  const arrangement = arr
    .filter(a => a.role !== 'genre' && a.role !== 'tempo')
    .map(a => ({
      role: a.role || null,
      family: a.family || null,
      fn: a.fn || null,
      voice: a.instrument || a.text || null,
      register: a.register || null,
      prominence: a.prominence || null,
      signature: !!a.signature,
      priority: a.priority || null,
      origin: a.source === 'overlay' ? 'overlay' : 'engine',
      // BED FIELDS (Phase A). The metatag engine's pad cue previously keyed off
      // the family LABEL ('pads only' whenever a pad-family voice existed), which
      // is why it announced pads over arrangements that had none. Carrying bedId
      // and behaviour lets it key off the FUNCTIONAL test instead: a voice is a
      // pad because it sustains, swells slowly and sits behind the lead.
      bedId: a.bedId || null,
      behaviour: a.behaviour || null,
    }));

  return {
    meta: {
      dnaVersion: DNA_VERSION,
      engineKind: 'atom',
      source: char.source || null,
      characterId: o.characterId || null,
      label: char.label || null,
      palette,
      seed,
      overlayId: o.modifierId || o.overlayId || (o.overlayDef ? o.overlayDef.label : null),
      overlayApplied: !!(o.modifierId || o.overlayId || o.overlayDef) && !refused,
      overlayCoreId: (o.overlayDef && o.overlayDef.coreId) || null,
      overlaySignatureId: (o.overlayDef && o.overlayDef.signatureId) || null,
      overlayVariantLabel: (o.overlayDef && o.overlayDef.variantLabel) || null,
      overlayRefused: refused ? r.overlayNote : null,
    },
    identity: { genreFamily: char.source || null, subgenre: char.label || null, genreAnchor },
    influences: overlayDef ? [{
      key: o.overlayId,
      kind: overlayDef.kind,          // composer | producer | remixer
      label: overlayDef.label,        // UI label only
      nameClass: 'person',
      renderPolicy: 'never',          // generic fingerprint, never the name in output
      applied: !refused,
    }] : [],
    harmony: { keyMode },
    arrangement,
    tempo: { spec: tempoSpec, tempoLock: true },
    dynamics: { arc, beatless: !!char.beatless },
    production: { masteringTail: char.mastering || null, characteristics: movement },
    vocal: { mode: 'instrumental', characteristics: null, performanceStyle: null }, // lyric engine flips to 'vocal'
    affect: { mood: null, emotionalAtmosphere: null },                              // lyric/metatag only; CIL fills later
    provenance: {
      identity: 'derived',
      influences: overlayDef ? 'derived' : 'n/a',
      harmony: 'derived',
      arrangement: 'derived',
      tempo: 'derived',
      dynamics: 'derived',
      production: 'derived',
      vocal: 'unknown',   // must be asked / inferred
      affect: 'unknown',
    },
    consumers: DNA_CONSUMERS,
    // ANCHOR IDENTITY (opt-in, default OFF so existing output is byte-identical):
    // a scene/compilation anchor is inserted directly AFTER the genre anchor,
    // never in place of it. Non-congruent anchors are ignored, not forced.
    render: (() => {
      const st = applyAnchor(r.style, o.anchorId || null, palette);
      return { style: st, negative: r.negative, length: st.length };  // reference only
    })(),
    anchor: o.anchorId && anchorCongruent(o.anchorId, palette) ? o.anchorId : null,
  };
}

/** Fields a given engine is contractually allowed to read. */
function dnaFieldsFor(engine) {
  return Object.keys(DNA_CONSUMERS).filter(f => DNA_CONSUMERS[f].includes(engine));
}

Object.assign(window.__ATMOS, { buildMusicalDNA, dnaFieldsFor, DNA_VERSION, DNA_CONSUMERS });
})();

/* core/profiles.js */
(function(){
/* ==========================================================================
 * profiles.js — INFERENCE PROFILES (data) for the CIL (P3).
 *
 * Subgenre-keyed affect + vocal disposition, read ONLY by core/cil.js — which is
 * a lyric/metatag consumer. NEVER read by style compose, so no affect vocabulary
 * can reach the style prompt (upholds the standing "no mood/affect words in the
 * style path" rule structurally).
 *
 * moodClass is an ABSTRACT CLASS, not Suno prose. The lyric engine (P4) realizes
 * prose from {class + user answers}; keeping CIL prose-free means these values
 * never touch a rendered prompt, so this table is safe to author ahead of John's
 * empirical sign-off. FIRST-PASS musical mapping — flagged for review.
 *
 * This is the "author genre/artist profiles as data" step P2 deferred until a
 * consumer needed it. It keys on SUBGENRE (real differentiation across the 12
 * characters), not a single-entry genre registry, so it is not premature config.
 * ========================================================================*/

// Abstract mood classes (CIL vocabulary; realized to prose later by the lyric engine).
const MOOD_CLASSES = Object.freeze([
  'contemplative', 'ethereal', 'warm', 'nocturnal',
  'brooding', 'euphoric', 'driving', 'hypnotic', 'wistful',
]);

// How a subgenre disposes toward vocals (a suggestion; the user always decides).
const VOCAL_DISPOSITIONS = Object.freeze([
  'instrumental-leaning', 'vocal-capable', 'either',
]);

const INFERENCE_PROFILES = Object.freeze({
  // genre-level fallback (only 'Balearic' on the atom path today)
  bySource: {
    Balearic: { moodClass: 'warm', vocalDisposition: 'vocal-capable' },
  },
  // subgenre refinement, keyed by dna.meta.characterId
  bySubgenre: {
    'organic-warm-downtempo':       { moodClass: 'warm',          vocalDisposition: 'vocal-capable' },
    'lush-cinematic-chillout':      { moodClass: 'ethereal',      vocalDisposition: 'vocal-capable' },
    'dreamy-analog-electronic':     { moodClass: 'hypnotic',      vocalDisposition: 'vocal-capable' },
    'dub-space-downtempo':          { moodClass: 'hypnotic',      vocalDisposition: 'vocal-capable' },
    'deep-nocturnal-balearic':      { moodClass: 'nocturnal',     vocalDisposition: 'vocal-capable' },
    'sunlit-mediterranean':         { moodClass: 'warm',          vocalDisposition: 'vocal-capable' },
    'ambient-beatless-atmospheric': { moodClass: 'contemplative', vocalDisposition: 'vocal-capable' },
    'moody-trip-hop-downbeat':      { moodClass: 'brooding',      vocalDisposition: 'vocal-capable' },
    'balearic-house':               { moodClass: 'euphoric',      vocalDisposition: 'vocal-capable' },
    'nu-disco-slo-mo':              { moodClass: 'warm',          vocalDisposition: 'vocal-capable' },
    'melodic-deep-house':           { moodClass: 'driving',       vocalDisposition: 'vocal-capable' },
    'lounge-house':                 { moodClass: 'warm',          vocalDisposition: 'vocal-capable' },
  },
});

// Resolve the best profile for a DNA: subgenre first, then genre fallback.
function profileFor(dna) {
  const bySub = INFERENCE_PROFILES.bySubgenre;
  const id = dna.meta && dna.meta.characterId;
  const src = dna.identity && dna.identity.genreFamily;
  return (id && bySub[id]) || INFERENCE_PROFILES.bySource[src] || null;
}

Object.assign(window.__ATMOS, { profileFor, MOOD_CLASSES, VOCAL_DISPOSITIONS, INFERENCE_PROFILES });
})();

/* core/cil.js */
(function(){
/* ==========================================================================
 * cil.js — Compositional Inference Layer (P3 of the Composition Workbench).
 *
 * A PURE CONSUMER of MusicalDNA (+ inference profiles). It fills the lyric /
 * performance fields the DNA leaves 'unknown' (affect, vocal), tags each with a
 * PROVENANCE TIER, and computes the RESIDUE: the low-confidence / unknown items
 * the Lyric engine (P4) will ask about. Default mode surfaces at most 5.
 *
 * Guarantees (all proven headless in validate-cil.mjs):
 *   - NEVER mutates the DNA and NEVER touches render/style. Style output is
 *     unaffected — CIL is downstream of compose, not part of it.
 *   - CONSUMER-CONTRACT SAFE: only emits into DNA fields whose consumer set
 *     includes lyric/metatag and EXCLUDES style (affect, vocal). Affect is an
 *     abstract CLASS, never Suno prose, so nothing here can leak into a prompt.
 *   - Deterministic: no RNG; identical DNA in → identical inference out.
 *
 * PROVENANCE TIERS (winning-evidence order): a concrete signal from THIS
 * composition beats a generic genre default, so:
 *     derived  > inferred > profile > unknown
 * Only 'derived' is silent; everything below is surfaced in the residue as a
 * pre-filled SUGGESTION the user can override. (Ordering lives in the rule table
 * and TIERS below — trivially flippable to strict profile>inferred if John
 * prefers.) The `ruleId` recorded per field is the provenance hook seeded in P2.
 * ========================================================================*/

const {profileFor, MOOD_CLASSES} = window.__ATMOS;

const CIL_VERSION = '1.0';
const TIERS = Object.freeze(['derived', 'inferred', 'profile', 'unknown']);
const SILENT = new Set(['derived']); // never asked

// ---- DNA signal readers (defensive: text fields may be null) --------------
const hasWord = (t, w) => !!t && String(t).toLowerCase().includes(w);
function bpmMid(dna) {
  const s = dna.tempo && dna.tempo.spec;
  if (!s) return null;
  const m = String(s).match(/(\d{2,3})\s*[-\u2013]\s*(\d{2,3})/);
  if (m) return (Number(m[1]) + Number(m[2])) / 2;
  const one = String(s).match(/(\d{2,3})/);
  return one ? Number(one[1]) : null;
}

// ---- affect.moodClass inference (data-driven; first strong signal wins) ----
// Each rule returns a moodClass when its DNA signal is unambiguous. Order below
// = evidence priority. Falls through to the profile default, then 'unknown'.
const MOOD_RULES = [
  { id: 'beatless-contemplative', value: 'contemplative',
    test: d => !!(d.dynamics && d.dynamics.beatless) },
  { id: 'darkminor-brooding', value: 'brooding',
    test: d => hasWord(d.harmony && d.harmony.keyMode, 'minor') || hasWord(d.harmony && d.harmony.keyMode, 'dark') },
  { id: 'uptempo-euphoric', value: 'euphoric',
    test: d => { const b = bpmMid(d); return b != null && b >= 118; } },
];

function inferMoodClass(dna) {
  for (const r of MOOD_RULES) {
    if (r.test(dna)) return { value: r.value, tier: 'inferred', ruleId: r.id };
  }
  const p = profileFor(dna);
  if (p && p.moodClass) return { value: p.moodClass, tier: 'profile', ruleId: 'profile-default' };
  return { value: null, tier: 'unknown', ruleId: null };
}

// ---- vocal.mode inference --------------------------------------------------
// Genuinely a user choice, so always residue — but pre-filled with a suggestion
// from disposition + beatless signal.
function inferVocalMode(dna) {
  const p = profileFor(dna);
  const disposition = p ? p.vocalDisposition : 'either';
  let suggest = 'instrumental';
  if (disposition === 'vocal-capable') suggest = 'vocal';
  if (dna.dynamics && dna.dynamics.beatless) suggest = 'instrumental';
  return { value: suggest, tier: 'inferred', ruleId: 'vocal-disposition', disposition };
}

// ---- residue question templates -------------------------------------------
const QUESTIONS = {
  'vocal.mode':          { priority: 1, question: 'Vocal or instrumental?', options: ['instrumental', 'vocal'] },
  'affect.moodClass':    { priority: 2, question: 'Overall mood class?', options: MOOD_CLASSES },
  'vocal.deliveryClass': { priority: 3, question: 'Vocal delivery?', options: ['lead-melodic', 'spoken/chant', 'wordless/textural', 'choir/pad'] },
};

function buildQuestion(field, res) {
  const q = QUESTIONS[field] || { priority: 99, question: field, options: [] };
  return {
    field,
    priority: q.priority,
    question: q.question,
    options: q.options,
    suggested: res.value,
    tier: res.tier,
    source: res.ruleId,
  };
}

// ---- light conflict scan (full recommendation engine is P6) ---------------
function scanConflicts(dna, fields) {
  const out = [];
  const v = fields['vocal.mode'];
  if (v && v.value === 'vocal' && dna.dynamics && dna.dynamics.beatless) {
    out.push({
      id: 'vocal-on-beatless',
      severity: 'note',
      message: 'Beatless ambient character — a vocal will need sparse, textural delivery to stay in-genre.',
    });
  }
  return out;
}

// ---- entry point -----------------------------------------------------------
// Pure: reads dna, returns a fresh inference object; never writes back.
function inferCIL(dna) {
  const mood = inferMoodClass(dna);
  const vmode = inferVocalMode(dna);

  const fields = {
    'affect.moodClass': mood,
    'vocal.mode': vmode,
  };
  // delivery only matters once a vocal is plausible
  if (vmode.value === 'vocal' || (vmode.disposition && vmode.disposition !== 'instrumental-leaning')) {
    fields['vocal.deliveryClass'] = { value: null, tier: 'unknown', ruleId: null };
  }

  const residueFull = [];
  const provenance = {};
  for (const [field, res] of Object.entries(fields)) {
    provenance[field] = res.tier;
    if (!SILENT.has(res.tier)) residueFull.push(buildQuestion(field, res));
  }
  residueFull.sort((a, b) => a.priority - b.priority);

  return {
    cilVersion: CIL_VERSION,
    fields,
    provenance,
    residue: residueFull.slice(0, 5),   // Default mode: <=5
    residueFull,
    recommendations: scanConflicts(dna, fields),
  };
}

Object.assign(window.__ATMOS, { inferCIL, CIL_VERSION, TIERS });
})();

/* core/anchors.js */
(function(){
/* ==========================================================================
 * anchors.js — ANCHOR IDENTITIES (scene / compilation anchors).
 *
 * WHY (John, 2026-07-22): the style prompts stated only GENRE and SUBGENRE.
 * Stronger scene identities — Cafe del Mar, Milchbar and the like — were used as
 * RESEARCH GROUNDING when the Balearic instrument pools were rebuilt, but never
 * reached the prompt text. This module puts them in front of Suno.
 *
 * WHY THESE ARE NOT ARTIST NAMES (the rule they must not break)
 *   Artist names are excluded because Suno rejects/ignores them. An anchor here
 *   is a COMPILATION SERIES, VENUE or SCENE — a catalogue identifier, not a
 *   person. 'Cafe del Mar' names a room and a record series the way 'Motown' or
 *   'Balearic' names a scene. NO ANCHOR MAY BE A PERSON OR A BAND, and the
 *   validator enforces that against the modifier roster and a denylist.
 *
 * PLACEMENT — alongside, never instead of
 *   The genre anchor is the strongest lever John has empirically proven, so an
 *   anchor identity is appended DIRECTLY AFTER it at the front of the prompt
 *   ("Balearic house, Cafe del Mar sunset-terrace lineage, 118-124 BPM, ...").
 *   It never replaces the genre anchor and never moves it from position one.
 *
 * OPT-IN — this is UNTESTED IN SUNO
 *   Default OFF. John A/B tests anchor-on vs anchor-off and his result decides,
 *   per the standing rule that his empirical test beats theory. Because it is
 *   off by default, existing style output stays byte-identical.
 *
 * BUDGET
 *   Anchors are short (a few words). The 1,000-char positive-prompt ceiling is
 *   checked by the validator with the anchor applied.
 * ========================================================================*/

// Anchors are grouped by engine. Each carries the engines/subgenres it suits, so
// the UI can offer only anchors congruent with the current character.
const ANCHOR_IDENTITIES = {

  /* ---- Balearic / downtempo scene anchors ------------------------------ */
  cafe_del_mar: {
    label: 'Café del Mar', engine: 'Balearic',
    text: 'Café del Mar sunset-terrace lineage',
    note: 'Ibiza sunset terrace: unhurried, melodic, warm — the founding chillout series.',
    lean: 'any',
  },
  milchbar: {
    label: 'Milchbar', engine: 'Balearic',
    text: 'Milchbar seaside-lounge lineage',
    note: 'Polished seaside lounge — songful, downtempo, vocal-friendly.',
    lean: 'any',
  },
  balearic_sunset: {
    label: 'Balearic sunset session', engine: 'Balearic',
    text: 'Balearic sunset-session lineage',
    note: 'Generic scene anchor for when a named series is too specific.',
    lean: 'any',
  },
  hotel_costes: {
    label: 'Hotel Costes', engine: 'Balearic',
    text: 'Hotel Costes late-lounge lineage',
    note: 'Parisian after-dark lounge — smokier, more nocturnal than Café del Mar.',
    lean: 'any',
  },
  buddha_bar: {
    label: 'Buddha-Bar', engine: 'Balearic',
    text: 'Buddha-Bar world-lounge lineage',
    note: 'Ethnic-instrument lounge; pairs with world/ethnic-leaning characters.',
    lean: 'any',
  },
  ibiza_terrace: {
    label: 'Ibiza terrace house', engine: 'Balearic',
    text: 'Ibiza terrace-house lineage',
    note: 'The club-side of the island — for the house-leaning characters.',
    lean: 'electronic',
  },

  /* ---- Enigma / ethereal-ethnic anchors --------------------------------- */
  gregorian_ambient: {
    label: 'Gregorian ambient', engine: 'Enigma',
    text: 'Gregorian-ambient crossover lineage',
    note: 'Plainchant over downtempo beats — the founding Enigma formula.',
    lean: 'any',
  },
  ethno_ambient: {
    label: 'Ethno-ambient', engine: 'Enigma',
    text: 'ethno-ambient crossover lineage',
    note: 'World vocal samples over ambient electronics.',
    lean: 'any',
  },
  sacred_chant: {
    label: 'Sacred chant crossover', engine: 'Enigma',
    text: 'sacred-chant crossover lineage',
    note: 'Ceremonial/devotional vocal material in a modern production frame.',
    lean: 'any',
  },

  /* ---- Delerium / ethereal-vocal anchors -------------------------------- */
  ethereal_vocal: {
    label: 'Ethereal vocal trance', engine: 'Delerium',
    text: 'ethereal vocal-trance lineage',
    note: 'Soaring female lead over lush electronic beds.',
    lean: 'electronic',
  },
  dreampop_electronic: {
    label: 'Electronic dream-pop', engine: 'Delerium',
    text: 'electronic dream-pop lineage',
    note: 'Songful, hazy, vocal-forward.',
    lean: 'any',
  },

  /* ---- Era / choral-cinematic anchors ----------------------------------- */
  choral_cinematic: {
    label: 'Choral cinematic', engine: 'Era',
    text: 'choral-cinematic crossover lineage',
    note: 'Massed choir over orchestral-electronic drive.',
    lean: 'any',
  },
  neo_medieval: {
    label: 'Neo-medieval', engine: 'Era',
    text: 'neo-medieval crossover lineage',
    note: 'Imagined-liturgical language over modern production.',
    lean: 'any',
  },

  /* ---- Deep Forest / world-electronic anchors --------------------------- */
  world_electronic: {
    label: 'World-electronic', engine: 'Deep Forest',
    text: 'world-electronic crossover lineage',
    note: 'Field-recorded vocal traditions reframed electronically.',
    lean: 'any',
  },
  tribal_ambient: {
    label: 'Tribal ambient', engine: 'Deep Forest',
    text: 'tribal-ambient crossover lineage',
    note: 'Percussion-led world ambience.',
    lean: 'any',
  },
};

// Anchors that must never appear — these ARE people/bands, and Suno rejects
// artist names. Kept explicit so the rule is testable rather than assumed.
const ANCHOR_DENYLIST = Object.freeze([
  'Blank & Jones', 'Enigma', 'Delerium', 'Deep Forest', 'Era', 'Sacred Spirit',
  'Chicane', 'Jose Padilla', 'José Padilla', 'Schiller', 'Moby',
]);

function anchorList(engine) {
  return Object.entries(ANCHOR_IDENTITIES)
    .filter(([, a]) => !engine || a.engine === engine)
    .map(([id, a]) => ({ id, label: a.label, engine: a.engine, note: a.note, lean: a.lean }));
}

/* Is this anchor congruent with the character/palette in play? An
 * electronic-lean anchor is refused on an acoustic palette, mirroring the
 * modifier lean gate. */
function anchorCongruent(anchorId, palette) {
  const a = ANCHOR_IDENTITIES[anchorId];
  if (!a) return false;
  if (a.lean === 'electronic' && palette !== 'electronic') return false;
  return true;
}

/* applyAnchor — insert the anchor text directly AFTER the genre anchor at the
 * front of a rendered style string. Returns the style unchanged when no anchor
 * is selected or the anchor is not congruent, so default output is untouched. */
function applyAnchor(style, anchorId, palette) {
  if (!style || !anchorId) return style;
  const a = ANCHOR_IDENTITIES[anchorId];
  if (!a || !anchorCongruent(anchorId, palette)) return style;
  if (style.includes(a.text)) return style;   // idempotent: never double-anchor
  const i = style.indexOf(',');
  if (i < 0) return `${style}, ${a.text}`;
  return `${style.slice(0, i)}, ${a.text}${style.slice(i)}`;
}

Object.assign(window.__ATMOS, { anchorList, anchorCongruent, applyAnchor, ANCHOR_IDENTITIES, ANCHOR_DENYLIST });
})();

/* core/atom-modifiers.js */
(function(){
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
const {bedAtom, bedAllowed} = window.__ATMOS;

/* GENRE-DEFENCE NEGATIVES (John, Suno test round 4).
 * Round 4 finding: naming orchestral instruments does not add those instruments
 * to a Balearic track — in Suno's training an orchestral instrument name drags
 * the ENTIRE orchestral production convention with it. John heard staccato
 * strings, french-horn stabs, syncopation and orchestral drums that were NOT in
 * the prompt, and reported 'Suno is fighting its programming and presenting both
 * genres equally. It can't tell which should be the dominant genre.'
 *
 * These bans target the CONVENTION, never the instruments the composer
 * legitimately brings. Banning 'french horn' would delete Barry's bed; banning
 * 'brass stabs' removes only the articulation Suno invents around it. */
const ORCHESTRAL_DEFENCE = [
  'staccato strings', 'string stabs', 'brass stabs', 'orchestral stabs',
  'orchestral hits', 'orchestral percussion', 'timpani', 'orchestral drums',
  'marching percussion', 'symphonic arrangement', 'cinematic orchestral production',
  'film score production', 'full orchestra', 'orchestral crescendo',
];

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

const ATOM_MODIFIERS = {

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
                    text:'the repeating figure drops out then returns alone' },
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
                    instrument:'scratch-style cuts and transformer edits across the beat, low in the mix' },
        mo_arc:   { role:'arc', fn:'arc', priority:'support',
                    text:'the arrangement cuts to one chord then rebuilds' },
      }},
      // S2 — the dramatic sampled fanfare tell.
      fanfare_intro: { label: 'Dramatic sampled fanfare', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true,
                    instrument:'a sampled orchestral swell opening the bars' },
        mo_counter:{ role:'counter', family:'counter', fn:'answer', priority:'support',
                    instrument:'a synth-brass counter-line answering under the hook' },
        mo_arc:   { role:'arc', fn:'arc', priority:'support',
                    text:'a cinematic intro bed into the full groove' },
      }},
      // S3 — the extended re-edit tell.
      reedit_break: { label: 'Extended re-edit breakdown', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true,
                    instrument:'chopped re-triggered vocal shots low in the mix' },
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
      }},
      dark_lowbrass: { label: 'Dark low brass and choir', bed: 'low_brass', atoms: {
      }},
    },
    signatures: {
      theme_transformed: { label: 'Theme returning transformed', atoms: {
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true, instrument:'a long-form solo horn theme returning transformed' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'the theme returns transformed at the peak' },
      }},
      brass_fanfare: { label: 'Heroic brass fanfare', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', instrument:'a bold brass call answering behind the melody' },
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
      }},
      solo_cello: { label: 'Solo cello over sustained pad', bed: 'filtered_pad', atoms: {
      }},
    },
    signatures: {
      accumulation: { label: 'Layered accumulation', atoms: {
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true,
                  instrument:'a solo cello line over the repeating figure' },
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', instrument:'stacked repeating figures building quietly bar by bar under the melody' },
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
      }},
      ethnic_choir: { label: 'Ethnic flute and choir', bed: 'wordless_choir', atoms: {
      }},
      danger_brass: { label: 'Low brass and timpani', bed: 'low_brass', atoms: {
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
      }},
      chamber_horn: { label: 'Horn and oboe chamber', bed: 'brass_chorale', atoms: {
      }},
      brass_swagger: { label: 'Brass swagger and twang', bed: 'low_brass', atoms: {
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
      }},
      orch_electronics: { label: 'Orchestra and analog electronics', bed: 'warm_analog_pad', atoms: {
      }},
      exotic_woodwind: { label: 'Exotic percussion and woodwind', bed: 'woodwind_bed', atoms: {
      }},
    },
    signatures: {
      asym_ostinato: { label: 'Driving asymmetric ostinato', atoms: {
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true,
                  instrument:'a stark solo horn motif over the repeating figure' },
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', instrument:'an asymmetric repeating figure running quietly across the bar' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'the repeating figure tightens as layers stack' },
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
      }},
      string_piano: { label: 'String ensemble and piano', bed: 'lush_strings', atoms: {
      }},
      baroque_chamber: { label: 'Harpsichord chamber', bed: 'organ_bed', atoms: {
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
      }},
      chamber_reed: { label: 'Chamber woodwind', bed: 'woodwind_bed', atoms: {
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
      }},
      tribal_low: { label: 'Tribal percussion and low strings', bed: 'low_brass', atoms: {
      }},
      sparse_solo: { label: 'Sparse solo and pad', bed: 'warm_analog_pad', atoms: {
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
      }},
      chamber_piano: { label: 'Chamber strings and piano', bed: 'lush_strings', atoms: {
      }},
      choir_orch: { label: 'Choir and orchestra', bed: 'wordless_choir', atoms: {
      }},
    },
    signatures: {
      sampled_stabs: { label: 'Sampled orchestral stabs', atoms: {
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true,
                  instrument:'a light solo oboe melody' },
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', instrument:'short sampled orchestral chords punctuating quietly across the beat' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'the short chords break the arrangement into blocks' },
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
      }},
      ballad_piano: { label: 'Ballad piano and strings', bed: 'lush_strings', atoms: {
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
      }},
      funk_horns: { label: 'Funky rhythm and horns', bed: 'brass_chorale', atoms: {
      }},
      lyric_piano: { label: 'Lyrical strings and piano', bed: 'lush_strings', atoms: {
      }},
    },
    signatures: {
      trumpet_fanfare: { label: 'Triumphant trumpet fanfare', atoms: {
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true,
                  instrument:'a bold solo trumpet melody' },
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', instrument:'a bold trumpet call answering behind the melody' },
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
      }},
      sultry_sax: { label: 'Sultry sax and strings', bed: 'lush_strings', atoms: {
      }},
    },
    signatures: {
      bond_stabs: { label: 'Sharp brass stabs', atoms: {
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true,
                  instrument:'a suave muted solo trumpet melody' },
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', instrument:'short syncopated brass chords punctuating quietly across the groove' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'short brass chords on every turnaround' },
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
      }},
      vocoder_brass: { label: 'Vocoder pad and synth brass', bed: 'synth_choir_pad', atoms: {
      }},
      analog_filter: { label: 'Analog lead and filtered pads', bed: 'filtered_pad', atoms: {
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
      }},
      low_drone: { label: 'Low drone and sparse synth', bed: 'drone_bed', atoms: {
      }},
      choir_pad: { label: 'Synth choir and string pad', bed: 'synth_choir_pad', atoms: {
      }},
    },
    signatures: {
      industrial_bass: { label: 'Industrial pounding bass', atoms: {
        mo_bass:{ role:'bass', family:'bass', fn:'foundation-weight', priority:'signature', signature:true, foundational:true, instrument:'an industrial solo synth bassline, one repeating figure' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'the repeating figure stays unchanged underneath' },
      }},
      anvil_hits: { label: 'Metallic anvil hits', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', instrument:'struck metal accents low on the downbeat' },
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
      }},
      piano_orch: { label: 'Piano and orchestral synth', bed: 'hybrid_pad', atoms: {
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
      }},
      choir_bells: { label: 'Choir pad and bells', bed: 'synth_choir_pad', atoms: {
      }},
      perc_strings: { label: 'Percussive synth and strings', bed: 'bright_synth_pad', atoms: {
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
      }},
      rhodes_keys: { label: 'Electric keys and pad', bed: 'bright_synth_pad', atoms: {
      }},
      arp_strings: { label: 'Sequenced arp and synth strings', bed: 'filtered_pad', atoms: {
      }},
    },
    signatures: {
      guitar_synth: { label: 'Guitar-style synth lead', atoms: {
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true, instrument:'a guitar-style solo synth lead with bends' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'the lead answers itself across the empty bars' },
      }},
      bass_riff: { label: 'Punchy synth-bass riff', atoms: {
        mo_bass:{ role:'bass', family:'bass', fn:'foundation-weight', priority:'signature', foundational:true, instrument:'a tight syncopated synth-bass riff' },
        mo_motif:{ role:'motif', family:'lead', fn:'foreground-melody', priority:'signature', signature:true, instrument:'a bright cutting solo synth melody' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'a tight vamp opening into a full-energy chorus' },
      }},
      stab_chords: { label: 'Bright stab chords', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', instrument:'short bright synth chords low on the offbeat' },
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
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'support', instrument:'short bell accents quiet on the phrase ends' },
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
      }},
      disco_strings: { label: 'Disco strings and keys', bed: 'bright_synth_pad', atoms: {
      }},
      filtered_house: { label: 'Filtered pads and stabs', bed: 'filtered_pad', atoms: {
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
      }},
      sample_loop: { label: 'Sampled loops and keys', bed: 'bright_synth_pad', atoms: {
      }},
      deep_pad: { label: 'Deep pads and strings', bed: 'filtered_pad', atoms: {
      }},
    },
    signatures: {
      chopped_stabs: { label: 'Chopped vocal stabs', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'chopped vocal shots across the beat, low in the mix' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'the vocal shots re-trigger harder in the breakdown' },
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
      }},
      processed_gtr: { label: 'Processed guitars', bed: 'filtered_pad', atoms: {
      }},
      sparse_dark: { label: 'Sparse and dark', bed: 'drone_bed', atoms: {
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
      }},
      gated_pop: { label: 'Gated pop production', bed: 'hybrid_pad', atoms: {
      }},
      piano_pop: { label: 'Pop piano and strings', bed: 'warm_analog_pad', atoms: {
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
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'short sampled orchestral chords on the turnarounds, low in the mix' },
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
      }},
      wide_strings: { label: 'Wide synth strings', bed: 'hybrid_pad', atoms: {
      }},
      crisp_pop: { label: 'Crisp pop bed', bed: 'bright_synth_pad', atoms: {
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
      }},
      restrained_arr: { label: 'Restrained arrangement', bed: 'filtered_pad', atoms: {
      }},
      warm_analog: { label: 'Warm analog keys', bed: 'warm_analog_pad', atoms: {
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
      }},
      layered_wall: { label: 'Layered production wall', bed: 'wordless_choir', atoms: {
      }},
      digital_sheen: { label: 'Digital sheen and keys', bed: 'bright_synth_pad', atoms: {
      }},
    },
    signatures: {
      wall_fanfare: { label: 'Wall-of-sound fanfare', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'a sampled brass call answering behind the arrangement' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'a build to a full wall of sound' },
      }},
      sampled_stab: { label: 'Sampled stab punctuation', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'short sampled orchestral chords through the arrangement, low in the mix' },
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
      }},
      lush_strings: { label: 'Lush strings and keys', bed: 'lush_strings', atoms: {
      }},
      smooth_jazz: { label: 'Smooth jazz bed', bed: 'warm_analog_pad', atoms: {
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
      }},
      electro_pop: { label: 'Electro-pop body', bed: 'warm_analog_pad', atoms: {
        mo_perc:{ role:'perc', family:'perc', fn:'groove', priority:'core', instrument:'crisp electronic percussion layers' },
        mo_bass:{ role:'bass', family:'bass', fn:'foundation-weight', priority:'core', foundational:true, instrument:'a tight electro synth bass' },
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
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'clipped house piano chords on the offbeat under the groove' },
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
        mo_perc:{ role:'perc', family:'perc', fn:'groove', priority:'core', instrument:'crisp electronic percussion layers' },
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
        mo_counter:{ role:'counter', family:'counter', fn:'answer', priority:'support', instrument:'a short filtered chord answering under the hook' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'a clean build into an open drop' },
      }},
      filtered_disco: { label: 'Filtered disco loop', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'a filtered disco guitar loop cycling under the beat' },
        mo_counter:{ role:'counter', family:'counter', fn:'answer', priority:'support', instrument:'short brass-synth chords low in the mix' },
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
        mo_counter:{ role:'counter', family:'counter', fn:'answer', priority:'support', instrument:'short brass-synth chords soft under the groove' },
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
      }},
    },
    signatures: {
      echo_stabs: { label: 'Echo-drenched vocal stabs', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'looped echo-drenched vocal shots low in the mix' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'an extended dub breakdown, percussion and echo only' },
      }},
      dub_delay: { label: 'Dub delay throws', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'dub delay throws trailing off every phrase end' },
        mo_counter:{ role:'counter', family:'counter', fn:'answer', priority:'support', instrument:'short filtered organ chords low in the mix' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'a long breakdown, one layer at a time' },
      }},
      piano_riff: { label: 'House piano riff', atoms: {
        mo_colour:{ role:'colour', family:'colour', fn:'accent', priority:'signature', signature:true, instrument:'a rolling house piano riff under the groove' },
        mo_counter:{ role:'counter', family:'counter', fn:'answer', priority:'support', instrument:'short string-synth chords low under the groove' },
        mo_arc:{ role:'arc', fn:'arc', priority:'support', text:'a percussive build into a full open chorus' },
      }},
    },
  },

};

/* ---- helpers --------------------------------------------------------------- */

function modifierCores(modId) {
  const m = ATOM_MODIFIERS[modId]; if (!m) return [];
  return Object.keys(m.cores).map(id => ({ id, label: m.cores[id].label }));
}
function modifierSignatures(modId) {
  const m = ATOM_MODIFIERS[modId]; if (!m) return [];
  return Object.keys(m.signatures).map(id => ({ id, label: m.signatures[id].label }));
}
function modifierList() {
  return Object.keys(ATOM_MODIFIERS).map(id => ({
    id, label: ATOM_MODIFIERS[id].label, kind: ATOM_MODIFIERS[id].kind,
    cores: modifierCores(id), signatures: modifierSignatures(id),
  }));
}

/* resolveModifier — flatten (core + signature) into the legacy overlay shape the
 * existing pipeline already consumes. Defaults to the first core/signature.
 * Atom keys are namespaced per tier so a core and a signature can never overwrite
 * each other in the merged object even if both used the same internal key. */
function resolveModifier(modId, coreId, sigId, palette) {
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
    // Composers are the only arm that imports orchestral instruments into a
    // non-orchestral engine, so they are the only arm that needs the defence.
    negative: m.kind === 'composer' ? ORCHESTRAL_DEFENCE : [],
    variantLabel: `${m.cores[cId].label} + ${m.signatures[sId].label}`,
  };
}

/* Every (core x signature) variant of a modifier — used by the UI panel and by
 * the validation harness. */
function modifierVariants(modId) {
  const m = ATOM_MODIFIERS[modId]; if (!m) return [];
  const out = [];
  for (const c of Object.keys(m.cores))
    for (const s of Object.keys(m.signatures))
      out.push(resolveModifier(modId, c, s));
  return out;
}

Object.assign(window.__ATMOS, { modifierCores, modifierSignatures, modifierList, resolveModifier, modifierVariants, ATOM_MODIFIERS });
})();

/* core/lyric-controls.js */
(function(){
const CONTROL_OPTIONS = {
  sourceType: ["Movie", "Book", "Historical figure", "Myth / legend", "True event", "Cultural movement", "Original concept", "Personal memory"],
  themeLens: ["Faithful to source", "Inspired by source", "Loose metaphor only", "Dark reinterpretation", "Romantic reinterpretation", "Triumphant reinterpretation"],
  genreFamily: ["Synthpop", "Pop", "Dance-pop", "Rock", "Ballad", "R&B", "Soul", "Reggae", "Chillout / Balearic", "Cinematic / Score-pop", "Balearic chillout", "Downtempo pop", "Ethereal trance", "Trip-hop", "Ambient vocal", "Mystic electronic", "Cinematic pop"],
  eraBias: ["1980s", "1990s", "2000s", "2010s", "2020s", "Timeless / mixed-era", "Modern Suno polish", "Early 90s", "Late 90s", "Early 2000s", "Timeless"],
  mood: ["Melancholic", "Hopeful", "Defiant", "Romantic", "Mysterious", "Bittersweet", "Triumphant", "Dark / brooding", "Serene", "Yearning", "Mystical", "Sensual", "Haunted", "Euphoric but restrained"],
  energy: ["Low", "Low-mid", "Mid", "Medium-high", "High", "Slow burn"],
  perspective: ["First person", "Second person", "Third person", "Alternating first and second", "Omniscient / cinematic", "Collective voice", "Fragmented voices"],
  languageStyle: ["Conversational", "Poetic", "Cinematic", "Elegant / literary", "Simple / direct", "Plain poetic", "Mystic but clear", "Minimal", "Sensual and restrained", "Sacred-modern", "Dreamlike"],
  structureCategory: ["Commercial / Pop-Compatible", "Balearic / Chillout / Atmospheric", "Enigma / Ritual / Chant", "Delerium / Ethereal Vocal", "Experimental"],
  hookStyle: ["Immediate and memorable", "Subtle and emotional", "Anthemic", "Intimate", "Mantra-like repetition", "Short repeated phrase", "Question hook", "Title hook", "Mantra hook", "Call-and-response", "Melodic vowel hook"],
  lineLength: ["Flexible", "6-8 syllables", "8-10 syllables", "10-12 syllables", "Mixed by section", "Short", "Medium", "Long", "Mixed with singable anchors"],
  rhymeDensity: ["Light", "Moderate", "Heavy", "Mixed / natural", "Minimal, prioritise meaning", "Medium", "High but natural", "Internal rhyme"],
  imageryDensity: ["Low", "Moderate", "High", "Sparse", "Medium", "Rich", "Symbolic"],
  narrativeClarity: ["Very clear storyline", "Mostly clear with some poetry", "Balanced", "Abstract but coherent", "Abstract", "Clear story", "Emotional fragments"],
  vocalFraming: ["Male lead", "Female lead", "Gender-neutral", "Duet", "Lead vocal centered", "Airy lead with backing phrases", "Whispered layers", "Choir shadows", "Call-and-response"],
  deliveryStyle: ["Controlled and intimate", "Warm and emotional", "Cool and detached", "Confessional", "Dramatic but restrained", "Soft intimate", "Breathy", "Chanted", "Ethereal", "Pop direct"],
  languages: ["French", "Spanish", "Latin", "Arabic", "Turkish", "German", "Gaelic"],
  languageModes: ["None", "Foreign phrase layer", "Chorus line", "Full chorus", "Verse section", "Call-and-response", "Sacred / chant layer"],
  languagePlacement: ["Chorus or backing phrase", "Intro texture", "Bridge only", "Outro echo", "Call response after hook"],
  languageIntensity: ["Light", "Medium", "Prominent"]
};

const STRUCTURE_TEMPLATES = [
  ["Commercial / Pop-Compatible", "commercial-classic-pre-chorus", "Verse / Pre / Chorus / Verse / Pre / Chorus / Bridge / Final Chorus", ["Verse 1", "Pre-Chorus", "Chorus", "Verse 2", "Pre-Chorus", "Chorus", "Bridge", "Final Chorus"], ["Pop", "Synthpop", "Dance-pop"], "Strong commercial structure with clear hook return."],
  ["Commercial / Pop-Compatible", "commercial-intro-middle8", "Intro / Verse / Pre / Chorus / Verse / Pre / Chorus / Middle 8 / Final Chorus / Outro", ["Intro", "Verse 1", "Pre-Chorus", "Chorus", "Verse 2", "Pre-Chorus", "Chorus", "Middle 8", "Final Chorus", "Outro"], ["Pop", "Cinematic pop"], "Radio-ready flow with an extra release valve before the final chorus."],
  ["Commercial / Pop-Compatible", "commercial-bridge", "Verse / Chorus / Verse / Chorus / Bridge / Final Chorus", ["Verse 1", "Chorus", "Verse 2", "Chorus", "Bridge", "Final Chorus"], ["Pop", "Downtempo"], "Compact hook-first structure."],
  ["Commercial / Pop-Compatible", "commercial-double-verse", "Verse / Verse / Chorus / Verse / Chorus / Bridge / Chorus", ["Verse 1", "Verse 2", "Chorus", "Verse 3", "Chorus", "Bridge", "Chorus"], ["Story songs"], "More narrative runway before the hook."],
  ["Commercial / Pop-Compatible", "commercial-refrain", "Verse / Refrain / Verse / Refrain / Bridge / Final Refrain", ["Verse 1", "Refrain", "Verse 2", "Refrain", "Bridge", "Final Refrain"], ["Folk-pop", "Ambient vocal"], "Soft refrain structure for subtle hooks."],
  ["Commercial / Pop-Compatible", "commercial-post-chorus", "Intro / Verse / Chorus / Post-Chorus / Verse / Chorus / Bridge / Final Chorus / Outro", ["Intro", "Verse 1", "Chorus", "Post-Chorus", "Verse 2", "Chorus", "Bridge", "Final Chorus", "Outro"], ["Pop", "Dance-pop"], "Adds a chantable post-chorus moment."],
  ["Commercial / Pop-Compatible", "commercial-lift", "Verse / Lift / Chorus / Verse / Lift / Chorus / Breakdown / Final Chorus", ["Verse 1", "Lift", "Chorus", "Verse 2", "Lift", "Chorus", "Breakdown", "Final Chorus"], ["Electronic pop"], "Useful when pre-chorus should feel atmospheric rather than conventional."],
  ["Balearic / Chillout / Atmospheric", "balearic-drift", "Ambient Intro / Verse / Chorus / Instrumental Drift / Verse / Chorus / Sunset Outro", ["Ambient Intro", "Verse 1", "Chorus", "Instrumental Drift", "Verse 2", "Chorus", "Sunset Outro"], ["Balearic", "Chillout"], "Leaves space for instrumental atmosphere."],
  ["Balearic / Chillout / Atmospheric", "balearic-floating-hook", "Intro Texture / Verse / Hook / Verse / Hook / Floating Bridge / Final Hook", ["Intro Texture", "Verse 1", "Hook", "Verse 2", "Hook", "Floating Bridge", "Final Hook"], ["Chillout"], "Gentle hook repetition without pop pressure."],
  ["Balearic / Chillout / Atmospheric", "balearic-spoken", "Spoken Fragment / Verse / Chorus / Ambient Break / Verse / Final Chorus / Outro", ["Spoken Fragment", "Verse 1", "Chorus", "Ambient Break", "Verse 2", "Final Chorus", "Outro"], ["Atmospheric"], "Creates a cinematic entry point."],
  ["Balearic / Chillout / Atmospheric", "balearic-instrumental", "Instrumental Intro / Verse / Refrain / Instrumental Passage / Verse / Final Refrain", ["Instrumental Intro", "Verse 1", "Refrain", "Instrumental Passage", "Verse 2", "Final Refrain"], ["Balearic"], "Good for style-led tracks."],
  ["Balearic / Chillout / Atmospheric", "balearic-sunrise", "Sunrise Intro / Verse / Soft Chorus / Drift / Verse / Final Chorus / Long Outro", ["Sunrise Intro", "Verse 1", "Soft Chorus", "Drift", "Verse 2", "Final Chorus", "Long Outro"], ["Chillout"], "Slow open, soft payoff, long tail."],
  ["Enigma / Ritual / Chant", "enigma-invocation", "Invocation / Verse / Lift / Chorus / Ritual Break / Final Chorus / Outro", ["Invocation", "Verse 1", "Lift", "Chorus", "Ritual Break", "Final Chorus", "Outro"], ["Mystic electronic"], "Balances chant texture with song form."],
  ["Enigma / Ritual / Chant", "enigma-chant-intro", "Chant Intro / Verse / Chorus / Instrumental Drift / Verse / Final Chorus", ["Chant Intro", "Verse 1", "Chorus", "Instrumental Drift", "Verse 2", "Final Chorus"], ["Enigma"], "Direct ritual framing."],
  ["Enigma / Ritual / Chant", "enigma-whisper", "Whispered Intro / Verse / Refrain / Chant Bridge / Final Refrain / Outro", ["Whispered Intro", "Verse 1", "Refrain", "Chant Bridge", "Final Refrain", "Outro"], ["Ritual"], "Subtle refrain plus chant bridge."],
  ["Enigma / Ritual / Chant", "enigma-pulse", "Pulse Intro / Verse / Hook / Ritual Interlude / Verse / Final Hook", ["Pulse Intro", "Verse 1", "Hook", "Ritual Interlude", "Verse 2", "Final Hook"], ["Downtempo ritual"], "Pulse-forward without clutter."],
  ["Enigma / Ritual / Chant", "enigma-sacred", "Sacred Texture / Verse / Chorus / Spoken Bridge / Layered Final Chorus", ["Sacred Texture", "Verse 1", "Chorus", "Spoken Bridge", "Layered Final Chorus"], ["Sacred-modern"], "Best for spoken and chanted contrast."],
  ["Delerium / Ethereal Vocal", "delerium-halo", "Atmos Intro / Verse / Pre / Chorus / Ambient Break / Verse / Final Chorus / Halo Outro", ["Atmos Intro", "Verse 1", "Pre-Chorus", "Chorus", "Ambient Break", "Verse 2", "Final Chorus", "Halo Outro"], ["Ethereal vocal"], "Classic emotional lift with spacious break."],
  ["Delerium / Ethereal Vocal", "delerium-floating", "Vocal Texture Intro / Verse / Chorus / Floating Bridge / Final Chorus", ["Vocal Texture Intro", "Verse 1", "Chorus", "Floating Bridge", "Final Chorus"], ["Ethereal pop"], "Simple and vocal-centered."],
  ["Delerium / Ethereal Vocal", "delerium-underwater", "Underwater Intro / Verse / Lift / Chorus / Breakdown / Final Chorus", ["Underwater Intro", "Verse 1", "Lift", "Chorus", "Breakdown", "Final Chorus"], ["Ambient trance"], "Good for immersive low-light tracks."],
  ["Delerium / Ethereal Vocal", "delerium-aria", "Aria Intro / Verse / Chorus / Sacral Bridge / Final Chorus / Long Tail Outro", ["Aria Intro", "Verse 1", "Chorus", "Sacral Bridge", "Final Chorus", "Long Tail Outro"], ["Cinematic"], "Lets the bridge feel devotional."],
  ["Delerium / Ethereal Vocal", "delerium-breath", "Breath Intro / Verse / Refrain / Emotional Lift / Final Refrain", ["Breath Intro", "Verse 1", "Refrain", "Emotional Lift", "Final Refrain"], ["Minimal"], "Restrained form for fragile vocals."],
  ["Experimental", "experimental-fragment", "Fragment / Verse / Fragment / Chorus / Breakdown / Final Fragment", ["Fragment", "Verse 1", "Fragment", "Chorus", "Breakdown", "Final Fragment"], ["Experimental"], "Fragmented, cinematic flow."],
  ["Experimental", "experimental-response", "Invocation / Spoken Verse / Sung Chorus / Instrumental Response / Final Chorus", ["Invocation", "Spoken Verse", "Sung Chorus", "Instrumental Response", "Final Chorus"], ["Hybrid"], "Useful for spoken-to-sung contrast."],
  ["Experimental", "experimental-drone", "Verse / Drone Break / Verse / Chant Hook / Outro", ["Verse 1", "Drone Break", "Verse 2", "Chant Hook", "Outro"], ["Minimal"], "Sparse and hypnotic."],
  ["Experimental", "experimental-mantra", "Minimal Verse / Repeated Mantra / Harmonic Break / Final Mantra", ["Minimal Verse", "Repeated Mantra", "Harmonic Break", "Final Mantra"], ["Mantra"], "Built around repetition and tone."],
  ["Experimental", "experimental-dissolve", "Abstract Intro / Cinematic Verse / Hook / Dissolve / Hook Reprise", ["Abstract Intro", "Cinematic Verse", "Hook", "Dissolve", "Hook Reprise"], ["Cinematic"], "Loose structure with a returning hook."]
].map(([group, id, label, sections, bestFor, notes]) => ({ group, id, label, sections, bestFor, notes }));

/* -------------------------------------------------------------------------
 * Ported verbatim from the proven archive/js/data-lyric-controls.js into core/
 * as the DNA-era home for lyric control vocabulary + structure templates.
 * Proven language John validated empirically — reused, not rebuilt.
 * ---------------------------------------------------------------------- */

// Structure category → subgenre affinity, used to pick a default template from DNA.
const TEMPLATE_FOR_SUBGENRE = Object.freeze({
  'ambient-beatless-atmospheric': 'balearic-instrumental',
  'organic-warm-downtempo':       'balearic-drift',
  'sunlit-mediterranean':         'balearic-sunrise',
  'lush-cinematic-chillout':      'delerium-halo',
  'dreamy-analog-electronic':     'balearic-floating-hook',
  'dub-space-downtempo':          'balearic-spoken',
  'deep-nocturnal-balearic':      'delerium-underwater',
  'moody-trip-hop-downbeat':      'balearic-spoken',
  'balearic-house':               'commercial-post-chorus',
  'nu-disco-slo-mo':              'commercial-lift',
  'melodic-deep-house':           'commercial-post-chorus',
  'lounge-house':                 'balearic-floating-hook',
});

function templateById(id) {
  return STRUCTURE_TEMPLATES.find(t => t.id === id) || null;
}

Object.assign(window.__ATMOS, { templateById, CONTROL_OPTIONS, STRUCTURE_TEMPLATES, TEMPLATE_FOR_SUBGENRE });
})();

/* core/lyric.js */
(function(){
/* ==========================================================================
 * lyric.js — Lyric Engine (P4 of the Composition Workbench). CRITICAL PATH.
 *
 * A DNA + CIL consumer. It asks only the residue, then either short-circuits to
 * the [Instrumental] tag or assembles a creative brief and builds a Claude prompt
 * for ORIGINAL lyrics. It FEEDS the proven lyric-prompt language John validated
 * empirically (concept hierarchy, section discipline, JSON contract, repair loop),
 * sourced from the prior prompt-lyric-builder.js — reused, not rebuilt — but wired
 * from Musical DNA instead of the old UI state object.
 *
 * CONSUMER CONTRACT (enforced): the lyric engine reads ONLY the DNA fields whose
 * consumer set includes 'lyric' — identity, influences, harmony, tempo, vocal,
 * affect. It never reads arrangement / dynamics / production (those are style +
 * metatag). Energy is derived from tempo (allowed), mood from CIL affect (allowed).
 *
 * SAFETY RULES (enforced + validated headless):
 *   - [Instrumental] short-circuit when vocal.mode resolves 'instrumental'. That
 *     tag is the reliable suppression mechanism; lyric GENERATION is skipped, but
 *     the metatag engine (P5) still runs downstream — this engine just returns.
 *   - ORIGINAL lyrics only; never reproduce/quote existing lyrics.
 *   - NO artist names in the prompt or output. Influences are applied as GENERIC
 *     craft traits only (renderPolicy 'never' on DNA.influences) — never "write
 *     like <name>".
 *   - Deterministic brief + prompt assembly (the model call is the only nondeterm-
 *     inism, and it is dependency-injected so this module is testable offline).
 * ========================================================================*/

const {CONTROL_OPTIONS, STRUCTURE_TEMPLATES, TEMPLATE_FOR_SUBGENRE, templateById} = window.__ATMOS;
const {DNA_CONSUMERS} = window.__ATMOS;

const LYRIC_VERSION = '1.0';
const DEFAULT_LYRIC_MODEL = 'claude-opus-4-8'; // current; configurable by the client

// DNA fields this engine may read (contract). Used to keep the brief honest.
const LYRIC_READABLE = Object.freeze(
  Object.keys(DNA_CONSUMERS).filter(f => DNA_CONSUMERS[f].includes('lyric'))
);

// --- helpers (tempo is lyric-readable) -------------------------------------
function bpmMid(dna) {
  const s = dna.tempo && dna.tempo.spec;
  if (!s) return null;
  const m = String(s).match(/(\d{2,3})\s*[-\u2013]\s*(\d{2,3})/);
  if (m) return (Number(m[1]) + Number(m[2])) / 2;
  const one = String(s).match(/(\d{2,3})/);
  return one ? Number(one[1]) : null;
}
function energyFromTempo(dna) {
  const b = bpmMid(dna);
  if (b == null) return 'Mid';
  if (b < 90) return 'Low-mid';
  if (b < 110) return 'Mid';
  if (b < 122) return 'Medium-high';
  return 'High';
}
// CIL abstract mood class -> proven mood vocabulary (for guidance lookup).
const MOODCLASS_TO_MOOD = {
  contemplative: 'Serene', ethereal: 'Mystical', warm: 'Hopeful', nocturnal: 'Mysterious',
  brooding: 'Dark / brooding', euphoric: 'Euphoric but restrained', driving: 'Defiant',
  hypnotic: 'Mystical', wistful: 'Yearning',
};

// --- residue: CIL residue + the lyric-specific asks, capped <=5 -------------
function lyricResidue(dna, cil) {
  const q = [
    { field: 'song.subject',     priority: 1, question: 'Subject / topic of the song?', options: [], suggested: null, tier: 'unknown' },
  ];
  for (const r of cil.residue) {
    const pr = r.field === 'vocal.mode' ? 2 : r.field === 'affect.moodClass' ? 3 : 6;
    q.push({ field: r.field, priority: pr, question: r.question, options: r.options, suggested: r.suggested, tier: r.tier });
  }
  q.push({ field: 'song.perspective', priority: 4, question: 'Perspective / speaker?',   options: CONTROL_OPTIONS.perspective, suggested: 'First person',     tier: 'profile' });
  q.push({ field: 'song.themeLens',   priority: 5, question: 'Interpretation lens?',      options: CONTROL_OPTIONS.themeLens,   suggested: 'Inspired by source', tier: 'profile' });
  q.push({ field: 'song.sourceType',  priority: 7, question: 'Source type?',              options: CONTROL_OPTIONS.sourceType,  suggested: 'Original concept',   tier: 'profile' });
  q.push({ field: 'song.languageStyle', priority: 8, question: 'Language style?',         options: CONTROL_OPTIONS.languageStyle, suggested: 'Poetic',           tier: 'profile' });
  q.sort((a, b) => a.priority - b.priority);
  return { all: q, default: q.slice(0, 5) };
}

// --- generic writing tendencies (NEVER names) ------------------------------
function writingTraits(moodClass, languageStyle) {
  const base = {
    contemplative: ['spacious', 'restrained', 'image-led'],
    ethereal:      ['symbolic', 'airy', 'open-vowel'],
    warm:          ['intimate', 'sensory', 'plain-poetic'],
    nocturnal:     ['shadowed', 'suggestive', 'sparse'],
    brooding:      ['tense', 'symbolic', 'controlled'],
    euphoric:      ['uplifting', 'repetitive-hook', 'bright'],
    driving:       ['direct', 'rhythmic', 'urgent'],
    hypnotic:      ['mantra-like', 'repetitive', 'minimal'],
    wistful:       ['longing', 'memory-led', 'gentle'],
  }[moodClass] || ['image-led', 'singable'];
  return Array.from(new Set([...base, (languageStyle || 'poetic').toLowerCase()]));
}

// --- brief: merge DNA (lyric-readable only) + CIL + user answers ------------
function assembleLyricBrief(dna, cil, answers) {
  const a = answers || {};
  const cilf = cil.fields || {};
  const vocalMode = a['vocal.mode'] || (cilf['vocal.mode'] && cilf['vocal.mode'].value) || 'instrumental';
  const moodClass = a['affect.moodClass'] || (cilf['affect.moodClass'] && cilf['affect.moodClass'].value) || null;
  const characterId = dna.meta && dna.meta.characterId;

  const template = templateById(a.templateId)
    || templateById(TEMPLATE_FOR_SUBGENRE[characterId])
    || STRUCTURE_TEMPLATES[0];

  // influences applied as GENERIC context only — never names (renderPolicy 'never')
  const influenceTraits = (dna.influences || [])
    .filter(inf => inf.applied)
    .map(inf => inf.kind); // 'composer' | 'producer' | 'remixer' — a role word, not a name

  return {
    lyricVersion: LYRIC_VERSION,
    vocalMode,                                   // 'vocal' | 'instrumental'
    // musical context — DNA lyric-readable fields ONLY
    genreAnchor: dna.identity && dna.identity.genreAnchor,
    subgenre:    dna.identity && dna.identity.subgenre,
    keyMode:     dna.harmony && dna.harmony.keyMode,
    tempoSpec:   dna.tempo && dna.tempo.spec,
    energy:      energyFromTempo(dna),
    moodClass,
    mood:        moodClass ? (MOODCLASS_TO_MOOD[moodClass] || 'Serene') : 'Serene',
    influenceTraits,
    writingTraits: writingTraits(moodClass, a['song.languageStyle']),
    // resolved user controls (with proven defaults)
    subject:      a['song.subject'] || '',
    sourceType:   a['song.sourceType']   || 'Original concept',
    themeLens:    a['song.themeLens']    || 'Inspired by source',
    perspective:  a['song.perspective']  || 'First person',
    languageStyle:a['song.languageStyle']|| 'Poetic',
    titleSeed:    a['song.title'] || null,
    template,
    deliveryClass: a['vocal.deliveryClass'] || (cilf['vocal.deliveryClass'] && cilf['vocal.deliveryClass'].value) || null,
  };
}

// --- prompt assembly -------------------------------------------------------
// Instrumental short-circuit or a proven original-lyric Claude prompt.
function buildLyricPrompt(brief) {
  if (brief.vocalMode === 'instrumental') {
    return { instrumental: true, lyrics: '[Instrumental]', prompt: null };
  }
  const t = brief.template;
  const labels = t.sections.map(s => `[${s}]`);
  const prompt = [
    'You are writing Suno-compatible ORIGINAL lyrics for a local music prompt tool.',
    'Return valid JSON only. Do not wrap in markdown fences. Do not include explanations outside JSON.',
    lyricSchema(),
    contextBlock(brief, labels),
    conceptRules(),
    originalityRules(),
    'Final lyrics rules:',
    '- Lyrics must be mainly English unless a foreign-language layer is requested.',
    '- Do not include translations, pronunciation guides, or explanations in final lyrics.',
    `- Use Suno section labels exactly and in this order: ${labels.join(' ')}.`,
    '- Place 3-5 short functional Suno metatags inside the lyrics string as local musical direction (entrance, contrast, handoff, lift, release), not scenic labels.',
    '- Make the chorus memorable, singable, and clear.',
    validationBlock(),
  ].join('\n\n');
  return { instrumental: false, lyrics: null, prompt };
}

function buildRepairPrompt(brief, initialResult) {
  const labels = brief.template.sections.map(s => `[${s}]`);
  return [
    'You generated lyrics that failed validation. Rewrite only where needed; improve the score to 80+.',
    `Validation score: ${initialResult.validation ? initialResult.validation.score : 'n/a'}`,
    'Issues:', JSON.stringify(initialResult.validation ? initialResult.validation.issues : [], null, 2),
    'Preserve the concept, structure, section labels, language settings, and originality rules.',
    lyricSchema(),
    contextBlock(brief, labels),
    originalityRules(),
    'Initial lyrics:', String(initialResult.lyrics || ''),
  ].join('\n\n');
}

// batch-of-10: one brief+prompt per answers entry (caller varies subject/etc.)
function buildLyricBatch(dna, cil, answersList) {
  return (answersList || []).map(answers => {
    const brief = assembleLyricBrief(dna, cil, answers);
    return { brief, ...buildLyricPrompt(brief) };
  });
}

// --- runtime driver (transport injected; never called in headless tests) ----
async function runLyricEngine({ dna, cil, answers, transport, model, temperature, maxTokens, repair }) {
  const brief = assembleLyricBrief(dna, cil, answers);
  const built = buildLyricPrompt(brief);
  if (built.instrumental) {
    return { instrumental: true, title: brief.titleSeed || null, lyrics: '[Instrumental]', brief };
  }
  if (typeof transport !== 'function') throw new Error('runLyricEngine needs a transport(prompt)->text function.');
  const raw = await transport({ prompt: built.prompt, model: model || DEFAULT_LYRIC_MODEL, temperature, maxTokens });
  let result = parseLyricJSON(raw);
  if (repair && result && result.validation && result.validation.passed === false) {
    const raw2 = await transport({ prompt: buildRepairPrompt(brief, result), model: model || DEFAULT_LYRIC_MODEL, temperature, maxTokens });
    result = parseLyricJSON(raw2) || result;
  }
  return { instrumental: false, ...result, brief };
}

function parseLyricJSON(text) {
  if (!text) return null;
  const clean = String(text).replace(/```json|```/g, '').trim();
  try { return JSON.parse(clean); } catch { return null; }
}

// --- proven prompt blocks (ported from prompt-lyric-builder.js, DNA-wired) ---
function lyricSchema() {
  return `Required JSON schema:
{
  "title": "A concise song title derived from the subject/topic.",
  "themeBrief": "1-2 paragraph internal creative brief.",
  "lyrics": "[Section]\\n...\\n[Section]",
  "lyricMetaTags": "Short explanation-free metatag strategy.",
  "validation": { "score": 88, "passed": true, "summary": "...", "issues": [], "fixesApplied": [] }
}`;
}
function contextBlock(brief, labels) {
  return `Musical context (from the finished arrangement's DNA):
Genre anchor: ${brief.genreAnchor || 'n/a'}
Subgenre: ${brief.subgenre || 'n/a'}
Key / mode: ${brief.keyMode || 'n/a'}
Tempo: ${brief.tempoSpec || 'n/a'}
Energy: ${brief.energy}
Mood: ${brief.mood} (class: ${brief.moodClass || 'n/a'})
Generic craft traits to honour (NOT artists): ${brief.writingTraits.join(', ')}

Song controls:
Subject/topic: ${brief.subject || 'none - create a fitting concept from the mood + genre'}
Source type: ${brief.sourceType}
Theme lens: ${brief.themeLens}
Perspective: ${brief.perspective}
Language style: ${brief.languageStyle}
Optional title seed: ${brief.titleSeed || 'none - create a suitable title from the subject/topic'}
Vocal delivery: ${brief.deliveryClass || 'lead-melodic'}
Structure: ${brief.template.label}
Required sections in order: ${labels.join(', ')}`;
}
function conceptRules() {
  return `Concept hierarchy:
- Derive the main concept from Subject/topic; if none is given, invent one that fits the mood and genre.
- Create a suitable song title from the subject/topic; use the optional title seed only if it genuinely fits.
- Source type must shape the emotional evidence, imagery, and narrative frame.
- Theme lens must change the angle of interpretation, not just wording.
- Mood must be interpreted through the specific subject, never named as a bare adjective.
- Energy must affect lyric density, section momentum, and how fast the emotional point arrives.
- Perspective must control who is speaking in every section.`;
}
function originalityRules() {
  return `Originality and safety rules (mandatory):
- Write 100% ORIGINAL lyrics. Never reproduce, quote, or closely paraphrase existing song lyrics.
- Do NOT name, address, or imitate any specific artist, band, or songwriter. Apply any stylistic direction ONLY as generic craft traits (e.g. sparse, symbolic, open-vowel).
- No real public figures' words. No copyrighted text.`;
}
function validationBlock() {
  return `Validation:
Standard validation passes at 80+. Assess concept fidelity, source-type interpretation, theme lens, perspective consistency, energy match, structure/section-label compliance, integrated Suno metatags, chorus memorability, hook clarity, singability, rhyme naturalness, cliche avoidance, originality, and absence of explanatory text.`;
}

Object.assign(window.__ATMOS, { runLyricEngine, lyricResidue, assembleLyricBrief, buildLyricPrompt, buildRepairPrompt, buildLyricBatch, parseLyricJSON, LYRIC_VERSION, DEFAULT_LYRIC_MODEL, LYRIC_READABLE });
})();

/* core/metatag.js */
(function(){
/* ==========================================================================
 * metatag.js — Metatag Engine (P5 of the Composition Workbench).
 *
 * A PURE consumer of MusicalDNA (+ the finished lyric result when the track is
 * vocal). It turns the resolved arrangement into Suno POSITIONAL PERFORMANCE
 * TAGS: per-section arrangement direction (entrances/exits, density, register
 * separation), a re-render of the interplay ledger as section-level cues, an
 * energy map, and — only when vocal — vocal-performance tags. No model call:
 * this is deterministic assembly from data, so it is fully headless-testable.
 *
 * GROUNDING (not invented — sourced from docs/ + the proven scaffolding):
 *   - The section language is driven by each voice's REAL functional data in the
 *     DNA arrangement: fn (foundation-weight | groove | answer | chord-movement |
 *     foreground-melody | sustain-under | accent ...), register (sub..high),
 *     prominence (foreground/background) and priority (core/support/decorative).
 *     Instruments are placed by function, per docs/arrange-skill.md (instrument
 *     roles; register separation to avoid masking; foreground/mid/background per
 *     section; energy mapping across sections; build/thin/vary over time).
 *   - Section inventory + arc (intro→verse→pre→chorus→bridge→outro, tension/
 *     release, contrast) follows docs/songwriting-skill.md and the validated
 *     STRUCTURE_TEMPLATES the lyric engine already uses.
 *   - Cadence/brightening hints read dna.harmony.keyMode (docs/music-theory).
 *   - Outro tail reuses dna.production.masteringTail (docs/prod-mix).
 *   - Tag phrasing patterns mirror archive/reference/suno_metatag_examples_32-2.md
 *     and archive/js/metatag-builder.js — reused, DNA-wired, not rebuilt.
 *
 * CONTRACT / SAFETY (enforced + validated headless in validate-metatag.mjs):
 *   - Never mutates the DNA; never emits into or reads back dna.render.style.
 *     Style output stays byte-identical (P5 is downstream of compose).
 *   - The MANDATORY INTERPLAY RULE holds identically in style and metatags: every
 *     build emits >=1 interplay cue that names a real arrangement voice inline
 *     with its function (conversation / foundation / arc).
 *   - NO ARTIST NAMES: influences are renderPolicy 'never'; overlay signature
 *     voices are referenced only by their generic voice text, never the label.
 *   - GENRE ANCHOR + drum/bass families are never renamed — voices are quoted
 *     verbatim from the DNA arrangement.
 *   - Instrumental still gets FULL performance direction, minus vocal-performance
 *     tags. [Instrumental] suppression stays the lyric field's job, not prose here.
 *   - Deterministic: no RNG; identical (dna, lyricResult, answers) => identical out.
 * ========================================================================*/

const {STRUCTURE_TEMPLATES, TEMPLATE_FOR_SUBGENRE, templateById} = window.__ATMOS;
const {DNA_CONSUMERS} = window.__ATMOS;

const METATAG_VERSION = '1.0';

// DNA fields this engine may read (contract). Metatag may read everything.
const METATAG_READABLE = Object.freeze(
  Object.keys(DNA_CONSUMERS).filter(f => DNA_CONSUMERS[f].includes('metatag'))
);

/* ---- section classification ------------------------------------------------
 * Map any template section label (incl. the exotic Balearic/Enigma/Delerium
 * ones) to a canonical section type. Order matters: pre-chorus before chorus,
 * bridge/instrumental before intro so "Chant Bridge"/"Instrumental Drift" don't
 * misfire on the word 'chant'/'intro'. Position is only a fallback. */
function sectionType(label, index, total) {
  const s = String(label).toLowerCase();
  if (/outro|long tail|sunset|halo outro|\btail\b|\bend\b/.test(s)) return 'outro';
  if (/\bintro\b|invocation|sunrise|\batmos\b|underwater|\baria\b|breath intro|whispered|pulse intro|chant intro|sacred texture|abstract|intro texture|vocal texture/.test(s)) return 'intro';
  if (/pre-chorus|^lift$|\blift\b/.test(s) && !/emotional lift/.test(s)) return 'prechorus';
  if (/bridge|middle 8|emotional lift|harmonic break/.test(s)) return 'bridge';
  if (/chorus|hook|refrain|mantra/.test(s)) return 'chorus';
  if (/instrumental|break|interlude|drift|passage|response|breakdown|dissolve|drone|ritual/.test(s)) return 'instrumental';
  if (/verse|fragment|cinematic verse|minimal verse/.test(s)) return 'verse';
  if (index === 0) return 'intro';
  if (index === total - 1) return 'outro';
  return 'verse';
}

// Is this an inherently no-vocal section even in a vocal track?
function isNonVocalSection(type, label) {
  if (type === 'instrumental') return true;
  const s = String(label).toLowerCase();
  return /instrumental|drone break|drift|passage|response/.test(s);
}

/* ---- pull the working voice set out of the DNA arrangement ------------------
 * Everything downstream references these verbatim voice strings, so the drum/
 * bass families and genre-owned voices are quoted, never reworded. */
function voiceSet(dna) {
  const arr = (dna.arrangement || []).filter(a => a.voice);
  const byRole = (role) => arr.filter(a => a.role === role);
  const byFam  = (fam)  => arr.filter(a => a.family === fam);
  const first  = (list) => (list[0] ? list[0].voice : null);

  const bass    = first(byRole('bass'))    || first(byFam('bass'));
  const rhythm  = first(byRole('rhythm'))  || first(byFam('drums'));
  const perc    = first(byRole('perc'))    || first(byFam('perc'));
  const lead    = first(byRole('motif'))   || first(byFam('lead'));
  const pads    = first(byRole('pads'))    || first(byFam('pad'));
  const strings = first(byRole('strings')) || first(byFam('strings'));
  const counter = first(byRole('counter')) || first(byFam('counter'));
  const color   = first(byRole('color'))   || first(byFam('colour'));
  const texture = first(byRole('texture')) || first(byFam('texture'));
  const move    = first(byRole('movement'))|| first(byFam('production'));

  // harmony bed = pad first, then strings, then the harmony voice
  const harmonyBed = pads || strings || (byRole('harmony')[0] ? byRole('harmony')[0].voice : null);
  // a melodic non-vocal feature for instrumental sections: signature > counter > color > strings > lead
  const signature = arr.filter(a => a.signature).map(a => a.voice);
  const feature = signature[0] || counter || color || strings || lead;
  // the "conversation" partner: a background answering line
  const answerVoice = (arr.find(a => a.fn === 'answer') || {}).voice || counter || color;

  return { bass, rhythm, perc, lead, pads, strings, counter, color, texture, move, harmonyBed, feature, answerVoice, signature, arr };
}

// cadence / brightening hint from key-mode (music-theory), phrased for a metatag
function cadenceHint(dna) {
  const km = String((dna.harmony && dna.harmony.keyMode) || '').toLowerCase();
  if (/picardy|major lift|lift/.test(km)) return 'brightening at the cadence';
  if (/suspend|sus|unresolved/.test(km)) return 'holding an unresolved suspension';
  if (/minor|dark|modal|dorian|aeolian|phrygian/.test(km)) return 'leaning into the minor colour';
  return 'resolving the phrase';
}

// short reverb/space tail from the mastering language (prod-mix)
function tailHint(dna) {
  const m = String((dna.production && dna.production.masteringTail) || '').toLowerCase();
  if (/atmos|wide|spatial|stereo/.test(m)) return 'wide reverb tail';
  if (/warm|analog|tape/.test(m)) return 'warm reverb tail';
  return 'long reverb tail';
}

const bracket = (parts) => `[${parts.filter(Boolean).join(', ')}]`;
const cap = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

/* ---- arrangement tag per section (grounded in fn/register/prominence) ------ */
function arrangementTag(type, v, dna, label) {
  const beatless = !!(dna.dynamics && dna.dynamics.beatless);
  const atmos = /ambient|atmos|texture|breath|sunrise|underwater|drift|aria|sacred|abstract|invocation/.test(String(label).toLowerCase());

  switch (type) {
    case 'intro':
      if (beatless || atmos)
        return bracket([`${cap(label)}: ${v.harmonyBed || v.pads || 'pads'} and ${v.texture || v.color || 'texture'} enter from near silence`,
                        v.lead ? `${v.lead} hinted sparsely` : null, 'no pulse yet, slow build']);
      return bracket([`${cap(label)}: ${v.bass || 'bass'} and ${v.rhythm || 'drums'} establish the groove`,
                      v.harmonyBed ? `${v.harmonyBed} underneath` : null, v.lead ? `${v.lead} withheld` : null]);
    case 'verse':
      return bracket([`${cap(label)}: sparse and dry`, v.lead ? `${v.lead} carries the line` : null,
                      v.harmonyBed ? `${v.harmonyBed} thin underneath` : null,
                      v.rhythm ? `${v.rhythm} steady` : null,
                      (v.counter || v.color) ? `${v.counter || v.color} held back` : null]);
    case 'prechorus':
      return bracket([`${cap(label)}: rising tension`, v.perc ? `${v.perc} adds movement` : null,
                      (v.strings || v.harmonyBed) ? `${v.strings || v.harmonyBed} climbs` : null,
                      v.rhythm ? `${v.rhythm} adds fills into the hook` : null]);
    case 'chorus':
      if (/post-chorus/i.test(String(label)))   // chantable restatement, not a chorus clone
        return bracket([`${cap(label)}: hook restated simpler and chantable`,
                        v.harmonyBed ? `${v.harmonyBed} holds` : null,
                        (v.bass || v.rhythm) ? `${[v.bass, v.rhythm].filter(Boolean).join(' and ')} loop under it` : null,
                        v.lead ? `${v.lead} steps back` : null]);
      return bracket([`${cap(label)}: full arrangement in`, v.lead ? `${v.lead} foreground` : null,
                      v.harmonyBed ? `${v.harmonyBed} wide` : null,
                      (v.bass && v.rhythm) ? `${v.bass} and ${v.rhythm} lock the foundation` : (v.bass || v.rhythm),
                      v.move ? `${v.move} engaged` : null]);
    case 'instrumental':
      return bracket([`${cap(label)}: ${v.feature || v.lead || 'lead'} takes the theme`,
                      v.answerVoice && v.answerVoice !== v.feature ? `call-and-response with ${v.answerVoice}` : null,
                      (v.rhythm || v.bass) ? `${[v.rhythm, v.bass].filter(Boolean).join(' and ')} simplify and hold` : null]);
    case 'bridge':
      return bracket([`${cap(label)}: harmonic departure, stripped to ${v.harmonyBed || 'pads'}${v.bass ? ' and ' + v.bass : ''}`,
                      v.rhythm ? `${v.rhythm} drops out` : null, cadenceHint(dna)]);
    case 'outro':
      return bracket([`${cap(label)}: ${v.lead ? v.lead + ' returns then thins' : 'texture thins'}`,
                      v.rhythm ? `${v.rhythm} out` : null,
                      (v.harmonyBed || v.texture) ? `${v.harmonyBed || v.texture} sustains` : null, tailHint(dna)]);
    default:
      return bracket([cap(label)]);
  }
}

/* ---- vocal-performance tag per section (vocal only) ------------------------ */
function performanceTag(type, deliveryClass, moodClass) {
  const d = deliveryClass || 'lead-melodic';
  const shade = ({ brooding: 'restrained, shadowed', nocturnal: 'hushed', euphoric: 'open and lifted',
                   contemplative: 'unhurried', ethereal: 'airy', wistful: 'aching', warm: 'warm',
                   driving: 'urgent', hypnotic: 'even, trance-like' }[moodClass]) || 'controlled';

  if (d === 'wordless/textural') {
    const m = { verse: 'wordless vowel textures, breathy, no hard consonants',
                chorus: 'open vowel swells widen on the hook',
                bridge: 'a single held vowel, exposed',
                prechorus: 'vowels lift and thin', outro: 'vowel tail dissolves' };
    return m[type] ? bracket([m[type]]) : null;
  }
  if (d === 'spoken/chant') {
    const m = { verse: `${shade} spoken-word, low and measured, close-mic`,
                chorus: 'chant rises to a group unison on the hook',
                bridge: 'spoken line pulls back, one answering chant',
                prechorus: 'phrasing tightens, chant shadow enters', outro: 'chant fades under reverb' };
    return m[type] ? bracket([m[type]]) : null;
  }
  if (d === 'choir/pad') {
    const m = { verse: 'solo lead over a low choir undercurrent',
                chorus: 'full choir answers the hook, lead stays intelligible',
                bridge: 'choir holds vowels, ceremonial lift', prechorus: 'choir swells underneath',
                outro: 'choir resolves on long open vowels' };
    return m[type] ? bracket([m[type]]) : null;
  }
  // lead-melodic (default)
  const m = { verse: `close, intimate lead vocal, ${shade}, minimal vibrato, sitting forward`,
              chorus: 'lead opens on the hook, stacked harmonies on the title phrase, line-ends doubled',
              bridge: `exposed, vulnerable lead, ${shade}, harmonies thin to one held vowel`,
              prechorus: 'vocal register rises, phrasing tightens, backing harmonies climb',
              outro: 'lead relaxes an octave down, one hook-word echo fades' };
  return m[type] ? bracket([m[type]]) : null;
}

/* ---- interplay cues (the mandatory-rule re-render, section-level) ---------- */
function foundationCue(v) {
  if (v.bass && v.rhythm) return bracket([`${v.bass} anchors while ${v.rhythm} locks the groove`]);
  if (v.bass) return bracket([`${v.bass} anchors the low end`]);
  if (v.rhythm) return bracket([`${v.rhythm} holds the groove`]);
  return null;
}
function conversationCue(v) {
  if (v.answerVoice && v.lead && v.answerVoice !== v.lead)
    return bracket([`${v.answerVoice} answers ${v.lead} between phrases`]);
  if (v.counter && v.lead) return bracket([`${v.counter} converses with ${v.lead}`]);
  return null;
}

/* ---- resolve the vocal read (independent of the lyric engine) -------------- */
function resolveVocal(dna, cil, answers, lyricResult) {
  const a = answers || {};
  const cilf = (cil && cil.fields) || {};
  let vocalMode = a['vocal.mode'] || (cilf['vocal.mode'] && cilf['vocal.mode'].value) || 'instrumental';
  if (lyricResult && lyricResult.instrumental === true) vocalMode = 'instrumental';
  if (lyricResult && lyricResult.instrumental === false) vocalMode = 'vocal';
  const deliveryClass = a['vocal.deliveryClass']
    || (cilf['vocal.deliveryClass'] && cilf['vocal.deliveryClass'].value) || 'lead-melodic';
  const moodClass = a['affect.moodClass'] || (cilf['affect.moodClass'] && cilf['affect.moodClass'].value) || null;
  return { vocalMode, deliveryClass, moodClass };
}

function pickTemplate(dna, answers, lyricResult) {
  const a = answers || {};
  // if the lyric engine already resolved a template, reuse it (aligned sections)
  const fromLyric = lyricResult && lyricResult.brief && lyricResult.brief.template;
  return fromLyric
    || templateById(a.templateId)
    || templateById(TEMPLATE_FOR_SUBGENRE[dna.meta && dna.meta.characterId])
    || STRUCTURE_TEMPLATES[0];
}

/* ---- LEAN per-section tag (one compact bracket, budget-safe) ---------------
 * Folds the section change + the single most important arrangement move + one
 * interplay phrase (+ a short vocal cue when vocal) into ONE bracket, targeting
 * ~40-90 chars/section. Grounded in the same fn/register data as the full tag;
 * bass+drums are still named verbatim in the groove-lock so genre-owned families
 * are quoted, and the interplay rule (a named interaction) still holds. Evidence:
 * Suno reads bracketed tags best when short and placed at section changes; long
 * stacked tags dilute adherence and eat the shared 5,000-char lyrics budget. */
function leanTag(type, v, dna, label, vocalMode, deliveryClass, moodClass) {
  /* PIPED, AND DERIVED FROM THE ACTUAL ARRANGEMENT — John, round 3.
   * Round-3 tags were generic templates that CONTRADICTED the style prompt: an
   * acoustic beatless ambient track (no drums, no pad, no groove) still received
   * "pads only", "bass and drums locked" and "steady groove". The research is
   * explicit that tags reinforce only when ALIGNED with genre and lyrics, so a
   * contradicting tag is worse than no tag. Every cue below is now conditional on
   * the voice actually being present in the DNA arrangement.
   *
   * "PADS" TERMINOLOGY — CORRECTED TWICE, NOW FUNCTIONAL (John, 2026-07-23).
   * First error: the internal slot was a generic 'sustaining bed' bucket and the
   * word 'pads' was emitted regardless of what occupied it. Second error: the fix
   * OVERCORRECTED, assuming a pad must be a synth and stripping the word from
   * string and choir beds. By John's canonical definition a pad is defined by
   * FUNCTION, not sound source — sustained, slow attack and release, background
   * placement, rich chords — so a sustained string section IS a string pad and a
   * sustained choir IS a vocal pad. The test below is now the functional one: a
   * voice counts as a pad if it came from the shared bed library (bedId), or if
   * it is literally named as a pad. Anything else that merely sustains is called
   * 'sustained', not a pad.
   * Format stays [Section | short | short | short], 3-5 elements, 1-3 words each. */
  const vocal = vocalMode === 'vocal';
  const dc = deliveryClass || 'lead-melodic';
  const hasDrums = !!v.rhythm, hasBass = !!v.bass;
  // Interplay is mandatory in every build. With no drums/bass to name, the
  // interaction is between the sustaining voices themselves — say that, rather
  // than claiming a groove the arrangement does not have.
  const groove = hasDrums && hasBass ? 'bass and drums locked'
               : hasDrums ? 'drums steady' : hasBass ? 'bass holds' : 'layers interlock';
  const grooveLite = hasDrums ? 'steady groove' : null;

  // What actually sustains underneath? Only call it a pad if it IS one.
  const bedAtomInArr = (dna.arrangement || []).find(a => a && a.bedId);
  const isPad = (t) => /\bpad\b|\bpads\b/i.test(String(t || ''));
  const bedVoice = v.pads || v.harmonyBed || v.texture || v.strings;
  const bedWord = (bedAtomInArr || isPad(bedVoice)) ? 'pads only'
                : bedVoice ? 'sustained only' : null;

  const vVerse = dc === 'spoken/chant' ? 'spoken' : dc === 'wordless/textural' ? 'wordless vowels'
               : dc === 'choir/pad' ? 'solo over choir' : 'intimate vocal';
  const vChorus = dc === 'choir/pad' ? 'choir answers' : 'harmonies lift';
  const pipe = (...els) => `[${[label, ...els.filter(Boolean)].join(' | ')}]`;

  const beatless = !!(dna.dynamics && dna.dynamics.beatless) || !hasDrums;
  const atmos = /ambient|atmos|texture|breath|sunrise|underwater|drift|aria|sacred|abstract|invocation/.test(String(label).toLowerCase());

  switch (type) {
    case 'intro':
      return (beatless || atmos)
        ? pipe(hasDrums ? null : 'no drums', bedWord, 'slow build')
        : pipe('groove in', 'no lead yet');
    case 'verse':
      return pipe('sparse', vocal ? vVerse : 'lead forward', grooveLite);
    case 'prechorus':
      return pipe('building', hasDrums ? 'drums fill' : 'swell', vocal ? 'vocal lifts' : null);
    case 'chorus':
      if (/post-chorus/i.test(String(label))) return pipe('chantable', 'simpler', 'lead back');
      return pipe('full arrangement', groove, vocal ? vChorus : 'counter answers');
    case 'instrumental':
      return pipe('instrumental', 'lead takes theme', 'call and response');
    case 'bridge':
      return pipe('stripped back', hasDrums ? 'drums out' : 'thinned', vocal ? 'exposed vocal' : 'sustained');
    case 'outro':
      return pipe('thinning out', 'reverb tail');
    default:
      return `[${label}]`;
  }
}

function buildMetatagPlan(dna, opts) {
  const o = opts || {};
  const cil = o.cil || null;
  const { vocalMode, deliveryClass, moodClass } = resolveVocal(dna, cil, o.answers, o.lyricResult);
  const template = pickTemplate(dna, o.answers, o.lyricResult);
  const v = voiceSet(dna);
  const sections = template.sections;
  const total = sections.length;

  const plan = [];
  const chorusIdx = [...sections].reverse().findIndex(s => sectionType(s, 0, total) === 'chorus');
  const lastChorusIdx = chorusIdx < 0 ? -1 : total - 1 - chorusIdx;
  let interplayEmitted = false;

  sections.forEach((label, i) => {
    const type = sectionType(label, i, total);
    const nonVocal = isNonVocalSection(type, label);
    const isPost = /post-chorus/i.test(String(label));

    // 1) arrangement direction — always
    plan.push({ idx: i, section: label, type, kind: 'arrangement', tag: arrangementTag(type, v, dna, label) });

    // 2) interplay cue — foundation where the groove is present, conversation on features
    if ((type === 'verse' || type === 'chorus') && (v.bass || v.rhythm)) {
      const fc = foundationCue(v);
      if (fc) { plan.push({ idx: i, section: label, type, kind: 'interplay', tag: fc }); interplayEmitted = true; }
    }
    if ((type === 'instrumental' || (type === 'chorus' && !isPost))) {
      const cc = conversationCue(v);
      if (cc) { plan.push({ idx: i, section: label, type, kind: 'interplay', tag: cc }); interplayEmitted = true; }
    }

    // 3) vocal-performance — vocal tracks only, never on inherently non-vocal sections
    if (vocalMode === 'vocal' && !nonVocal) {
      const pt = performanceTag(type, deliveryClass, moodClass);
      if (pt) plan.push({ idx: i, section: label, type, kind: 'performance', tag: pt });
    }
  });

  // guarantee the mandatory-interplay rule even on minimal templates
  if (!interplayEmitted) {
    const fc = foundationCue(v) || conversationCue(v);
    if (fc) plan.push({ idx: 0, section: sections[0], type: 'intro', kind: 'interplay', tag: fc });
  }

  return {
    metatagVersion: METATAG_VERSION,
    vocalMode,
    deliveryClass: vocalMode === 'vocal' ? deliveryClass : null,
    templateId: template.id,
    sections: sections.slice(),
    energyMap: energyMap(sections, total),
    plan,
    leanLines: sections.map((label, i) =>
      leanTag(sectionType(label, i, total), v, dna, label, vocalMode, deliveryClass, moodClass)),
    minimalLines: sections.map((label, i) => {
      const t = sectionType(label, i, total);
      if (vocalMode !== 'vocal' || isNonVocalSection(t, label)) return `[${label}]`;
      const cue = { verse: 'intimate vocal', chorus: 'full vocal, harmonies',
                    bridge: 'exposed vocal', prechorus: 'vocal lifts',
                    outro: 'vocal fades' }[t];
      return cue ? `[${label}] [${cue}]` : `[${label}]`;
    }),
  };
}

/* ---- energy map (docs/arrange-skill "energy mapping across sections") ------ */
function energyMap(sections, total) {
  const LEVEL = { intro: 2, verse: 3, prechorus: 4, chorus: 5, instrumental: 3, bridge: 2, outro: 2 };
  return sections.map((label, i) => ({ section: label, level: LEVEL[sectionType(label, i, total)] || 3 }));
}

/* ---- render: a paste-ready Suno tag block, aligned to the section order -----
 * mode 'full' = one line per section occurrence with every tag (rich; best for
 * instrumentals, no lyrics competing). mode 'lean' = one compact bracket per
 * section (budget-safe; default for vocal tracks that also carry lyrics). */
function renderMetatagBlock(built, mode) {
  /* MINIMAL — John's Suno round 2: across T1-T4 Suno placed drums and bass by its
   * own GENRE PROGRAMMING and ignored the per-section arrangement direction
   * entirely. Elaborate structural tags are therefore inert: they cost lyric-box
   * budget and buy nothing. 'minimal' emits the plain section marker plus a short
   * vocal cue only, which is the part Suno does act on. This is now the default
   * for vocal tracks; 'lean' and 'full' are kept for A/B. */
  if (mode === 'minimal') return built.minimalLines.join('\n');
  if (mode === 'lean') return built.leanLines.join('\n');
  const byIdx = new Map();
  for (const item of built.plan) {
    const k = (item.idx == null ? 0 : item.idx);
    if (!byIdx.has(k)) byIdx.set(k, []);
    byIdx.get(k).push(item.tag);
  }
  return built.sections.map((s, i) => {
    // The line already opens with [Section]; strip a duplicate label from the
    // arrangement tag so it reads "[Verse 1] [sparse and dry, ...]".
    const tags = (byIdx.get(i) || []).map(t => t.startsWith(`[${s}: `) ? `[${t.slice(s.length + 3)}` : t);
    return `[${s}] ${tags.join(' ')}`.trim();
  }).join('\n');
}

// flat list of just the tag strings (order-preserving, full plan)
function metatagList(built) {
  return built.plan.map(p => p.tag);
}

/* ---- runtime driver (no model call — deterministic assembly) ---------------
 * renderMode default: vocal -> 'lean' (share the lyrics budget), instrumental
 * -> 'full' (whole lyrics box free). Pass renderMode to override. */
function runMetatagEngine({ dna, cil, answers, lyricResult, renderMode }) {
  const built = buildMetatagPlan(dna, { cil, answers, lyricResult });
  // Evidence-based default: metatags DO work when aligned with genre and lyrics,
  // so always emit them — in the piped short-element format. 'minimal' (bare
  // section markers) and 'full' remain available for A/B.
  const mode = renderMode || 'lean';
  return { ...built, renderMode: mode, block: renderMetatagBlock(built, mode) };
}

Object.assign(window.__ATMOS, { buildMetatagPlan, renderMetatagBlock, metatagList, runMetatagEngine, METATAG_VERSION, METATAG_READABLE });
})();

/* engines/delerium.js */
(function(){
// Delerium engine — album-era (Faces -> Semantic Spaces -> Karma -> Poem).
// NOT the trance-remix identity. Domains: 'E' electronic, 'A' acoustic, 'B' both.
//
// Rewrite (2026-07-09): fix "tempo was the only real change". Two changes:
//   1) Pools DEEPENED to album-scale and DE-OVERLAPPED so each character owns a
//      distinct pad / vocal / movement signature (Sacred/Ethereal/Firefly no longer
//      share cathedral-pad + vocoder + delay-throws).
//   2) Interplay restructured as attach-clauses (tails that hang off already-named
//      instruments) so the resolver can WEAVE it into the style string per the
//      approved gold-standard format — never re-naming an instrument.

const P = {
  pads: {
    cathedralPad:  { t: 'slowly swelling cathedral-reverb analog pad', d: 'E' },
    darkDrone:     { t: 'dark evolving drone bed', d: 'E' },
    glassyPad:     { t: 'glassy digital pad with shimmering high partials', d: 'E' },
    stringWash:    { t: 'warm string-synth wash', d: 'E' },
    metallicDrone: { t: 'bowed metallic drone', d: 'B' },
    reversedPad:   { t: 'reversed pad swell into the downbeat', d: 'E' },
    harmoniumDrone:{ t: 'sustained harmonium drone', d: 'A' },
    celloDroneBed: { t: 'bowed cello drone bed', d: 'A' },
    choirPad:      { t: 'sustained wordless choir pad', d: 'E' },
    analogueSwell: { t: 'warm analogue polysynth swell', d: 'E' },
    glacialPad:    { t: 'glacial slow-attack ambient pad', d: 'E' },
    tanpuraBed:    { t: 'shimmering tanpura drone bed', d: 'A' },
    feltMalletBed: { t: 'soft felt-mallet resonant bed', d: 'A' },
    jarrePad:      { t: 'spacey analog Jarre-style lead pad', d: 'E' },
    broodingPad:   { t: 'brooding dark atmospheric synth pad', d: 'E' },
    mellotronBed:  { t: 'Mellotron choir-and-flute pad', d: 'B' },
    fmCrystalPad:  { t: 'glassy FM crystalline pad', d: 'E' },
    warmStringEns: { t: 'warm sampled-string ensemble pad', d: 'B' },
    airVocalPad:   { t: 'airy layered vocal-synth pad', d: 'E' },
  },
  bass: {
    subBass:    { t: 'deep sustained sub-bass', d: 'E' },
    seqBass:    { t: 'sequenced synth bass pulsing eighth notes', d: 'E' },
    analogBass: { t: 'slow legato round analog bass', d: 'E' },
    fretless:   { t: 'fretless bass glide', d: 'B' },
    upright:    { t: 'slow plucked upright acoustic bass', d: 'A' },
    oudLow:     { t: 'low oud register', d: 'A' },
    pulsingBass:{ t: 'pulsing filtered synth bass', d: 'E' },
    warmSine:   { t: 'warm sine sub with a soft attack', d: 'E' },
    seqDriveBass:{ t: 'rolling sequenced bassline driving the groove', d: 'E' },
    filterBass: { t: 'warm filtered analog bassline', d: 'E' },
    dubBass:    { t: 'deep dub bassline with a long decay', d: 'E' },
  },
  lead: {
    duduk:     { t: 'sustained duduk lead', d: 'A' },
    bambooFl:  { t: 'bamboo flute motif', d: 'A' },
    piano:     { t: 'sparse grand-piano figure', d: 'A' },
    synthArp:  { t: 'plucked synth arpeggio lead', d: 'E' },
    sitar:     { t: 'sitar melodic phrase', d: 'A' },
    celloLead: { t: 'long-phrased bowed cello lead', d: 'A' },
    fmBell:    { t: 'glassy FM bell lead', d: 'E' },
    detunedLd: { t: 'detuned analog synth lead with slow portamento', d: 'E' },
    panFlute:  { t: 'breathy pan-flute melody', d: 'A' },
    ney:       { t: 'reedy ney flute lead', d: 'A' },
    erhu:      { t: 'bowed erhu melodic line', d: 'A' },
    ebowGuitar:{ t: 'ebow sustained guitar lead', d: 'B' },
    glassPluck:{ t: 'glassy plucked digital lead', d: 'E' },
    harpFigure:{ t: 'a plucked harp figure', d: 'A' },
    nylonGtr:  { t: 'a nylon acoustic-guitar motif', d: 'A' },
    shakuhachi:{ t: 'a breathy shakuhachi flute lead', d: 'A' },
    bansuri:   { t: 'a bansuri bamboo-flute melody', d: 'A' },
  },
  harmony: {
    minorModal:{ t: 'slow minor-modal chord changes', d: 'B' },
    suspended: { t: 'suspended chords resolving on the chorus lift', d: 'B' },
    droneTonic:{ t: 'an unresolved static drone-tonic', d: 'B' },
    add9:      { t: 'lush add9 chord voicings', d: 'B' },
    phrygian:  { t: 'a dark phrygian cadence', d: 'B' },
    majorLift: { t: 'a major-key chord lift on the chorus', d: 'B' },
    plagalCadence:{ t: 'a plagal cadence resolving to the tonic', d: 'B' },
    modalResolve: { t: 'a modal cadence landing on the root', d: 'B' },
    minorToMajor: { t: 'a minor-to-relative-major resolution on the chorus', d: 'B' },
    risingProg:   { t: 'a rising chord progression that resolves upward', d: 'B' },
    sacredCadence:{ t: 'a sacred choral cadence resolving on the final chord', d: 'B' },
  },
  voice: {
    latinChant:   { t: 'distant monastic Latin chant', d: 'A' },
    femaleWash:   { t: 'an ethereal wordless female vocal wash', d: 'A' },
    euroChoir:    { t: 'an Eastern-European choir texture', d: 'A' },
    throatChant:  { t: 'a throat-overtone chant drone', d: 'A' },
    vocalChops:   { t: 'rhythmic sampled ethnic vocal chops', d: 'B' },
    vocoderPad:   { t: 'a vocoded wordless vocal pad', d: 'E' },
    granularVox:  { t: 'a granular stretched-vocal drone', d: 'E' },
    sanskritChant:{ t: 'distant Sanskrit vocal chant', d: 'A' },
    breathyFemale:{ t: 'a breathy close female vocal texture', d: 'A' },
    maleDrone:    { t: 'a low male vocal drone', d: 'A' },
    childChoir:   { t: "a distant children's choir wash", d: 'A' },
    gregorianMale:{ t: 'Gregorian-style male chant', d: 'A' },
    liveChoirSwell:{ t: 'a live choir swell', d: 'A' },
    femaleHarmony: { t: 'layered ethereal female vocal harmonies', d: 'A' },
    bakaChant:     { t: 'a Baka-forest-style pygmy chant', d: 'A' },
    prayerCall:    { t: 'a distant call-to-prayer melisma', d: 'A' },
  },
  color: {
    fingerCymb: { t: 'finger cymbals and bells', d: 'A' },
    dulcimer:   { t: 'a hammered dulcimer run', d: 'A' },
    sarangi:    { t: 'a bowed sarangi ornament', d: 'A' },
    gong:       { t: 'a gong swell', d: 'A' },
    kalimba:    { t: 'a kalimba figure', d: 'A' },
    bellArp:    { t: 'a bell-synth arpeggio sparkle', d: 'E' },
    revStab:    { t: 'a reversed synth-stab accent', d: 'E' },
    windChimes: { t: 'a wind-chime shimmer', d: 'A' },
    santoor:    { t: 'a santoor tremolo run', d: 'A' },
    prepPiano:  { t: 'a prepared-piano pluck', d: 'A' },
    glocken:    { t: 'a glockenspiel sparkle', d: 'B' },
    harpGliss:  { t: 'a harp glissando', d: 'A' },
    handDrumFill:{ t: 'a tuned hand-drum fill', d: 'A' },
    tambShaker: { t: 'tambourine and shaker accents', d: 'A' },
    tablaFill:  { t: 'a tabla fill', d: 'A' },
  },
  movement: {
    filterLFO:   { t: 'a slow filter LFO sweep', d: 'E' },
    delayThrows: { t: 'tempo-synced delay throws', d: 'E' },
    autopan:     { t: 'a wide stereo autopan', d: 'E' },
    reversedTr:  { t: 'reversed-swell transitions', d: 'E' },
    reverbTail:  { t: 'a long cathedral reverb tail', d: 'E' },
    tremoloSwell:{ t: 'tremolo bowed-string swells', d: 'A' },
    handCresc:   { t: 'rolling hand-percussion crescendos', d: 'A' },
    dubEcho:     { t: 'dub delay echoes as a second voice', d: 'E' },
    risers:      { t: 'filtered-noise risers into the lift', d: 'E' },
    panSweep:    { t: 'a slow stereo pan sweep', d: 'E' },
    phaserSweep: { t: 'a slow phaser sweep across the pads', d: 'E' },
    flangeVocal: { t: 'a flanged sweep on the vocal', d: 'E' },
    tapeEcho:    { t: 'analog tape-echo repeats', d: 'E' },
    filterGate:  { t: 'a rhythmic filter-gate pulse', d: 'E' },
  },
};

const DRUMS = {
  worldbeat: ['deep frame drum','a tabla pattern','a dumbek groove','a hand-played djembe','congas and shakers with tambourine'],
  softDown:  ['a subdued soft programmed kick','a brushed programmed snare','a trip-hop-leaning downtempo groove','a soft measured downtempo beat'],
  firefly:   ['a denser driving programmed pulse','a propulsive sequenced groove'],
  hybrid:    ['a programmed kick under live hand percussion','a downtempo beat laced with hand percussion'],
};

const r = (role, ...keys) => keys.map(k => P[role][k]);

const CHARACTERS = {
  gothicAmbient: {
    label: 'Gothic Ambient', source: 'Faces / Morpheus',
    genre: 'Delerium Style, dark ritual ambient',
    beatless: true, energy: 'low', colorChance: 0.5,
    drums: { primary: null, secondary: null },
    pools: {
      pads:     r('pads','darkDrone','metallicDrone','glacialPad','celloDroneBed','broodingPad','mellotronBed'),
      bass:     r('bass','subBass','fretless','warmSine','dubBass','filterBass'),
      harmony:  r('harmony','droneTonic','phrygian','modalResolve','sacredCadence'),
      voice:    r('voice','throatChant','granularVox','maleDrone','bakaChant','prayerCall'),
      lead:     r('lead','celloLead','ebowGuitar','ney','shakuhachi'),
      color:    r('color','gong','windChimes','prepPiano','harpGliss'),
      movement: r('movement','reversedTr','reverbTail','tremoloSwell','phaserSweep','tapeEcho'),
    },
  },
  worldbeatRitual: {
    label: 'Worldbeat Ritual', source: 'Semantic Spaces',
    genre: 'Delerium Style, worldbeat downtempo, tribal ethereal',
    beatless: false, bpm: [84,96], energy: 'low to medium', colorChance: 0.55,
    drums: { primary: 'worldbeat', secondary: null },
    pools: {
      pads:     r('pads','harmoniumDrone','tanpuraBed','darkDrone','mellotronBed','broodingPad'),
      bass:     r('bass','subBass','oudLow','upright','dubBass','filterBass'),
      harmony:  r('harmony','droneTonic','minorModal','phrygian','modalResolve','sacredCadence'),
      voice:    r('voice','euroChoir','sanskritChant','throatChant','vocalChops','bakaChant','liveChoirSwell','prayerCall'),
      lead:     r('lead','duduk','bambooFl','sitar','ney','erhu','bansuri','shakuhachi','harpFigure'),
      color:    r('color','fingerCymb','dulcimer','sarangi','santoor','tablaFill','handDrumFill','tambShaker','harpGliss'),
      movement: r('movement','filterLFO','handCresc','dubEcho','tapeEcho','filterGate'),
    },
  },
  sacredDowntempo: {
    label: 'Sacred Downtempo', source: 'Silence / Karma',
    genre: 'Delerium Style, sacred ethereal downtempo',
    beatless: false, bpm: [92,100], energy: 'medium', colorChance: 0.45,
    drums: { primary: 'softDown', secondary: 'hybrid' },
    pools: {
      pads:     r('pads','cathedralPad','harmoniumDrone','choirPad','feltMalletBed','warmStringEns','mellotronBed'),
      bass:     r('bass','subBass','upright','warmSine','filterBass','dubBass'),
      harmony:  r('harmony','minorModal','suspended','add9','sacredCadence','plagalCadence','minorToMajor'),
      voice:    r('voice','latinChant','gregorianMale','childChoir','femaleWash','liveChoirSwell','femaleHarmony','prayerCall'),
      lead:     r('lead','piano','duduk','celloLead','panFlute','harpFigure','nylonGtr','shakuhachi'),
      color:    r('color','fingerCymb','glocken','prepPiano','harpGliss','handDrumFill','tambShaker'),
      movement: r('movement','delayThrows','reversedTr','reverbTail','phaserSweep','tapeEcho'),
    },
  },
  ethereal: {
    label: 'Ethereal', source: 'Innocente / Poem',
    genre: 'Delerium Style, ethereal downtempo electronica',
    beatless: false, bpm: [100,112], energy: 'medium', colorChance: 0.4,
    drums: { primary: 'softDown', secondary: 'hybrid' },
    pools: {
      pads:     r('pads','cathedralPad','glassyPad','stringWash','analogueSwell','jarrePad','fmCrystalPad','airVocalPad'),
      bass:     r('bass','analogBass','upright','warmSine','fretless','seqDriveBass','filterBass'),
      harmony:  r('harmony','suspended','add9','majorLift','minorToMajor','risingProg','plagalCadence'),
      voice:    r('voice','femaleWash','breathyFemale','vocoderPad','granularVox','femaleHarmony','liveChoirSwell'),
      lead:     r('lead','piano','synthArp','detunedLd','glassPluck','ebowGuitar','nylonGtr','harpFigure','shakuhachi'),
      color:    r('color','kalimba','bellArp','glocken','harpGliss','tambShaker'),
      movement: r('movement','delayThrows','autopan','dubEcho','panSweep','phaserSweep','flangeVocal','tapeEcho'),
    },
  },
  firefly: {
    label: 'Firefly', source: 'Euphoria',
    genre: 'Delerium Style, driving ethereal downtempo',
    beatless: false, bpm: [112,126], energy: 'medium to high', colorChance: 0.4,
    drums: { primary: 'firefly', secondary: 'hybrid' },
    pools: {
      pads:     r('pads','glassyPad','reversedPad','analogueSwell','choirPad','fmCrystalPad','airVocalPad','jarrePad'),
      bass:     r('bass','seqBass','pulsingBass','subBass','seqDriveBass','filterBass','dubBass'),
      harmony:  r('harmony','suspended','majorLift','minorModal','risingProg','minorToMajor'),
      voice:    r('voice','vocoderPad','breathyFemale','vocalChops','femaleWash','femaleHarmony','liveChoirSwell'),
      lead:     r('lead','synthArp','fmBell','detunedLd','glassPluck'),
      color:    r('color','bellArp','revStab','glocken','harpGliss'),
      movement: r('movement','delayThrows','autopan','risers','panSweep','flangeVocal','tapeEcho','filterGate'),
    },
  },
};

const INTERPLAY = {
  gothicAmbient: {
    conversation: ['surfacing alone against deep space then dissolving back into the texture',
                   'emerging and receding without hierarchy each equal in the field',
                   'cross-fading so the melody dissolves into atmosphere'],
    foundation:   ['holding a single harmonic centre with everything suspended above',
                   'anchoring in slow motion while the timbres drift unmoving'],
    arc:          ['evolving so slowly that change is felt rather than heard',
                   'replacing motion with the slow turn of timbre',
                   'sustaining tension through what never resolves',
                   'finally settling onto a single resolved chord',
                   'resolving at last into a sustained tonic'],
    voiceRel:     ['drifting over the top without hierarchy','breathing at the edge of the field','hanging in the deep reverb'],
    colorRel:     ['ringing once into the silence','surfacing briefly then gone'],
  },
  worldbeatRitual: {
    conversation: ['trading phrases over the percussion','stating the melody while the wash breathes beneath',
                   'answered now and then by an ornament rising through the mix'],
    foundation:   ['locked with the hand drums in a rolling ritual pocket',
                   'interlocking in a loose earthy groove','anchoring while the hand drums drive above'],
    arc:          ['building the ritual organically as voices layer in one at a time',
                   'swelling and receding in long ceremonial waves','rising through added hand drums then opening back to space',
                   'resolving the ritual onto a final grounded chord'],
    voiceRel:     ['breathing beneath the lead','chanting in the distance','layering in call-and-response with the flute'],
    colorRel:     ['ornamenting the gaps between phrases','sparkling through the ritual','answering the drums'],
  },
  sacredDowntempo: {
    conversation: ['rising together then answered by soft chord swells','hanging over the chant with space between statements',
                   'trading the foreground unhurried'],
    foundation:   ['locked in a slow reverent pocket','sustaining long tones beneath the pads anchoring without intruding',
                   'holding steady while the low end floats'],
    arc:          ['stacking toward a lush sacred peak then receding','opening gradually with each voice given room to breathe',
                   'built through rising harmony then released into open sustained chords',
                   'resolving into a lush final cadence'],
    voiceRel:     ['answering the lead from the reverb','rising over the chant','trading the foreground with the melody'],
    colorRel:     ['marking the phrase ends','threading through the sacred space','answering the choir'],
  },
  ethereal: {
    conversation: ['trading phrases in warm ethereal dialogue','floating free over the harmony',
                   'drifting over the chords answered by a second voice'],
    foundation:   ['rolling forward in a smooth unhurried pocket','gliding beneath the pulse tied to the cycle above',
                   'anchoring while the low end moves smooth and unhurried'],
    arc:          ['entering one at a time with air around each voice','swelling toward an emotional lift then settling back',
                   'layering toward immersion then thinning to open space',
                   'resolving into a warm final chord as it closes'],
    voiceRel:     ['answering the lead in warm dialogue','entering with air around it','drifting over the harmony'],
    colorRel:     ['threading through the spaces','shimmering between phrases','tracing the top of the harmony'],
  },
  firefly: {
    conversation: ['interlocking in a tight bright weave','answered by chord stabs over the drive',
                   'trading with their own delayed repeats in call-and-response'],
    foundation:   ['locked tight and propulsive','chugging steady and forward beneath the layers',
                   'anchoring as a relentless low pulse while the synths climb over it'],
    arc:          ['building through added layers toward an open peak','opening over the drive into a full-energy lift',
                   'stacking through rising layers then released into the chorus',
                   'resolving the climb onto a bright final chord'],
    voiceRel:     ['climbing over the drive','answering the lead','riding above the pulse'],
    colorRel:     ['sparkling over the groove','accenting the lift','flickering between the beats'],
  },
};

const DELERIUM = {
  id: 'Delerium',
  styleAnchor: 'Delerium Style',
  master: P,
  drums: DRUMS,
  characters: CHARACTERS,
  interplay: INTERPLAY,
  sourceNegative: [
    'trance','four-on-the-floor','club anthem','EDM drop','supersaw',
    'hard kick','festival synths','big-room','pop hooks','radio pop',
  ],
  order: ['pads','harmony','bass','drums','voice','lead','color','movement'],
};

Object.assign(window.__ATMOS, { DELERIUM });
})();

/* engines/era.js */
(function(){
// Era engine (Eric Lévi / +eRa+) — trilogy-era identity: Era (1996) -> Era 2 (2000)
// -> The Mass (2003), with Reborn's (2008) Arabic/electronic edge as colour.
// Core sound = pseudo-Latin / invented-language Gregorian CHOIR (the signature voice)
// over orchestral strings + pipe organ + lush synths + downtempo-to-driving beats +
// Lévi's rock electric guitar. Cinematic medieval-heroic grandeur (Carmina Burana on
// The Mass). Domains: 'E' electronic, 'A' acoustic/orchestral, 'B' both.
//
// Built to the Delerium resolver pattern: deep, DE-OVERLAPPED pools so each character
// owns a distinct pad / voice / movement signature (never "tempo is the only change"),
// with the interplay layer WOVEN into the style string per John's Suno test.

const P = {
  pads: {
    stringOrchestra: { t: 'a sweeping orchestral string section', d: 'B' },
    synthPadLush:    { t: 'lush warm analog synth pads', d: 'E' },
    choirPadWordless:{ t: 'a sustained wordless choir pad', d: 'B' },
    pipeOrgan:       { t: 'a swelling cathedral pipe organ', d: 'A' },
    darkOrchPad:     { t: 'a brooding low orchestral drone', d: 'A' },
    glassSynthPad:   { t: 'a glassy digital synth pad', d: 'E' },
    mellotronStrings:{ t: 'a Mellotron string-and-choir pad', d: 'B' },
    brassSwell:      { t: 'a low orchestral brass swell', d: 'A' },
    analogueSwell:   { t: 'a warm analogue polysynth swell', d: 'E' },
    cinematicDrone:  { t: 'a cinematic sub-orchestral drone bed', d: 'B' },
    shimmerPad:      { t: 'a shimmering high-string tremolo pad', d: 'A' },
    fmCrystalPad:    { t: 'a glassy FM crystalline pad', d: 'E' },
    hybridOrchSynth: { t: 'a hybrid orchestra-and-synth wash', d: 'B' },
    airVocalPad:     { t: 'an airy layered vocal-synth pad', d: 'E' },
  },
  bass: {
    orchestralCello: { t: 'a deep orchestral cello-and-contrabass foundation', d: 'A' },
    synthSubBass:    { t: 'a deep sustained synth sub-bass', d: 'E' },
    electricBass:    { t: 'a driving electric bass', d: 'B' },
    seqBass:         { t: 'a sequenced synth bass pulsing eighth notes', d: 'E' },
    pizzBass:        { t: 'a pizzicato double-bass', d: 'A' },
    warmSine:        { t: 'a warm sine sub with a soft attack', d: 'E' },
    rockBass:        { t: 'a distorted rock bass locked to the kick', d: 'B' },
    filterBass:      { t: 'a warm filtered analog bassline', d: 'E' },
    organPedal:      { t: 'a low organ pedal tone', d: 'A' },
    oudLow:          { t: 'a low oud register', d: 'A' },
    pulseCello:      { t: 'a staccato cello-and-contrabass ostinato', d: 'A' },
    driveSub:        { t: 'a hard-edged driving synth bass', d: 'E' },
  },
  lead: {
    soaringViolin:   { t: 'a soaring solo violin lead', d: 'A' },
    celloLead:       { t: 'a long-phrased solo cello lead', d: 'A' },
    electricGuitar:  { t: 'a soaring electric guitar lead', d: 'B' },
    pianoFigure:     { t: 'a dramatic grand-piano figure', d: 'A' },
    oboeLead:        { t: 'a plaintive oboe melody', d: 'A' },
    synthLead:       { t: 'a bright analog synth lead', d: 'E' },
    panFlute:        { t: 'a breathy pan-flute melody', d: 'A' },
    duduk:           { t: 'a mournful duduk lead', d: 'A' },
    distortedRiff:   { t: 'a driving distorted-guitar riff', d: 'B' },
    fmBellLead:      { t: 'a glassy FM bell lead', d: 'E' },
    harpFigure:      { t: 'a cascading harp figure', d: 'A' },
    brassFanfare:    { t: 'a heroic brass fanfare line', d: 'A' },
    neyLead:         { t: 'a reedy ney flute lead', d: 'A' },
    stringOstinato:  { t: 'a driving sixteenth-note string ostinato', d: 'A' },
    arpSynth:        { t: 'a climbing synth arpeggio lead', d: 'E' },
  },
  harmony: {
    minorCinematic: { t: 'dark minor-key cinematic chord changes', d: 'B' },
    carminaProg:    { t: 'a Carmina-Burana-style ostinato progression', d: 'A' },
    suspendedLift:  { t: 'suspended chords resolving on the chorus lift', d: 'B' },
    majorAnthem:    { t: 'a triumphant major-key anthem progression', d: 'B' },
    modalGregorian: { t: 'a modal Gregorian chord movement', d: 'B' },
    risingProg:     { t: 'a rising chord progression that resolves upward', d: 'B' },
    minorToMajor:   { t: 'a minor-to-relative-major resolution on the chorus', d: 'B' },
    plagalCadence:  { t: 'a plagal cadence resolving to the tonic', d: 'B' },
    phrygianCadence:{ t: 'a dark phrygian cadence', d: 'B' },
    sacredCadence:  { t: 'a sacred choral cadence resolving on the final chord', d: 'B' },
    pedalTonic:     { t: 'a sustained tonic pedal under shifting harmony', d: 'B' },
  },
  voice: {
    pseudoLatinChoir:{ t: 'a dramatic mixed choir chanting in a pseudo-Latin language', d: 'A' },
    gregorianMale:   { t: 'Gregorian-style male chant', d: 'A' },
    soaringFemale:   { t: 'a soaring operatic female lead vocal', d: 'A' },
    layeredChoirSATB:{ t: 'a full layered SATB choir', d: 'A' },
    solemnLatin:     { t: 'solemn liturgical Latin chant', d: 'A' },
    femaleAria:      { t: 'an ethereal female aria in an invented sacred language', d: 'A' },
    maleChoirLow:    { t: 'a deep male-choir drone', d: 'A' },
    boysChoir:       { t: "a distant boys' choir", d: 'A' },
    callResponse:    { t: 'a call-and-response choir exchange', d: 'A' },
    multitracked:    { t: 'a massive multi-tracked chant chorus', d: 'A' },
    arabicFemale:    { t: 'a Middle-Eastern female vocal melisma', d: 'A' },
    breathyFemale:   { t: 'a breathy close female vocal texture', d: 'A' },
    wordlessSoprano: { t: 'a wordless soprano melisma', d: 'A' },
    chantStabs:      { t: 'chant-fragment vocal stabs', d: 'A' },
  },
  color: {
    timpaniRoll:  { t: 'a timpani roll swelling into the phrase', d: 'A' },
    tubularBells: { t: 'tubular bells tolling', d: 'A' },
    harpGliss:    { t: 'a harp glissando', d: 'A' },
    glocken:      { t: 'a glockenspiel sparkle', d: 'B' },
    orchHit:      { t: 'an orchestral stab hit', d: 'A' },
    choirStab:    { t: 'a staccato choir stab', d: 'A' },
    cymbalSwell:  { t: 'a cymbal-swell transition', d: 'A' },
    pizzStrings:  { t: 'a pizzicato string accent', d: 'A' },
    oudRun:       { t: 'an oud ornament run', d: 'A' },
    windChimes:   { t: 'a wind-chime shimmer', d: 'A' },
    brassStab:    { t: 'a brass stab accent', d: 'A' },
    reversedStab: { t: 'a reversed synth-stab accent', d: 'E' },
    bellArp:      { t: 'a bell-synth arpeggio sparkle', d: 'E' },
    sitarAccent:  { t: 'a sitar ornament', d: 'A' },
  },
  movement: {
    orchestralSwell:{ t: 'sweeping orchestral crescendos', d: 'A' },
    delayThrows:    { t: 'tempo-synced delay throws', d: 'E' },
    cinematicRiser: { t: 'a cinematic riser into the drop', d: 'B' },
    reverbTail:     { t: 'a long cathedral reverb tail', d: 'E' },
    filterLFO:      { t: 'a slow filter LFO sweep', d: 'E' },
    guitarSustain:  { t: 'a sustained wall of electric guitar', d: 'B' },
    autopan:        { t: 'a wide stereo autopan', d: 'E' },
    reversedTr:     { t: 'reversed-swell transitions', d: 'E' },
    stringRiser:    { t: 'a rising string glissando into the chorus', d: 'A' },
    tapeEcho:       { t: 'analog tape-echo repeats', d: 'E' },
    risers:         { t: 'filtered-noise risers into the lift', d: 'E' },
    panSweep:       { t: 'a slow stereo pan sweep', d: 'E' },
    gatedPulse:     { t: 'a gated rhythmic pulse across the pads', d: 'E' },
  },
};

const DRUMS = {
  softDown:  ['a soft downtempo electronic beat','a mid-tempo programmed groove','a trip-hop-leaning downtempo beat','a subdued measured downtempo beat'],
  cinematic: ['a syncopated cinematic beat with orchestral percussion','a driving programmed beat under rolling timpani','a big cinematic drum groove with taiko hits'],
  driving:   ['a driving rock-electronic beat','a propulsive programmed pulse with live drums','a punchy rock groove with a programmed kick'],
  hybrid:    ['a programmed beat laced with orchestral percussion','a downtempo beat under a live drum kit'],
  epicDrive: ['a driving electronic beat under rolling timpani','a propulsive four-on-the-floor electronic pulse with taiko accents','a fast programmed groove with darbuka and tribal frame drums','a punchy programmed kick locked to orchestral percussion'],
};

const r = (role, ...keys) => keys.map(k => P[role][k]);

const CHARACTERS = {
  cathedralOverture: {
    label: 'Cathedral Overture', source: 'Classics / orchestral',
    genre: 'Era Style, orchestral choral cinematic',
    beatless: true, energy: 'low', colorChance: 0.5,
    drums: { primary: null, secondary: null },
    pools: {
      pads:     r('pads','stringOrchestra','pipeOrgan','darkOrchPad','choirPadWordless','mellotronStrings','shimmerPad'),
      bass:     r('bass','orchestralCello','pizzBass','organPedal','synthSubBass'),
      harmony:  r('harmony','modalGregorian','minorCinematic','sacredCadence','pedalTonic','plagalCadence'),
      voice:    r('voice','layeredChoirSATB','wordlessSoprano','gregorianMale','maleChoirLow','boysChoir','femaleAria'),
      lead:     r('lead','soaringViolin','celloLead','oboeLead','harpFigure','brassFanfare'),
      color:    r('color','timpaniRoll','tubularBells','harpGliss','cymbalSwell','pizzStrings'),
      movement: r('movement','orchestralSwell','reverbTail','reversedTr','stringRiser'),
    },
  },
  neoGregorianAnthem: {
    label: 'Neo-Gregorian Anthem', source: 'Era (Ameno / Mother)',
    genre: 'Era Style, neo-Gregorian downtempo anthem',
    beatless: false, bpm: [88,98], energy: 'medium', colorChance: 0.5,
    drums: { primary: 'softDown', secondary: 'hybrid' },
    pools: {
      pads:     r('pads','stringOrchestra','synthPadLush','choirPadWordless','mellotronStrings','hybridOrchSynth','analogueSwell'),
      bass:     r('bass','synthSubBass','orchestralCello','electricBass','warmSine','filterBass'),
      harmony:  r('harmony','minorCinematic','suspendedLift','modalGregorian','minorToMajor','sacredCadence','majorAnthem'),
      voice:    r('voice','pseudoLatinChoir','soaringFemale','gregorianMale','layeredChoirSATB','femaleAria','callResponse','multitracked'),
      lead:     r('lead','soaringViolin','pianoFigure','synthLead','electricGuitar','panFlute','oboeLead','harpFigure'),
      color:    r('color','timpaniRoll','glocken','harpGliss','choirStab','orchHit','bellArp'),
      movement: r('movement','delayThrows','orchestralSwell','reverbTail','stringRiser','tapeEcho'),
    },
  },
  etherealBallad: {
    label: 'Ethereal Ballad', source: 'Era 2 (Don\u2019t Go Away)',
    genre: 'Era Style, ethereal orchestral ballad',
    beatless: false, bpm: [72,84], energy: 'low to medium', colorChance: 0.4,
    drums: { primary: 'softDown', secondary: 'hybrid' },
    pools: {
      pads:     r('pads','synthPadLush','stringOrchestra','glassSynthPad','shimmerPad','airVocalPad','mellotronStrings'),
      bass:     r('bass','orchestralCello','synthSubBass','pizzBass','warmSine','filterBass'),
      harmony:  r('harmony','suspendedLift','minorToMajor','majorAnthem','risingProg','plagalCadence','pedalTonic'),
      voice:    r('voice','soaringFemale','breathyFemale','femaleAria','wordlessSoprano','layeredChoirSATB','boysChoir'),
      lead:     r('lead','pianoFigure','soaringViolin','celloLead','oboeLead','panFlute','harpFigure','synthLead'),
      color:    r('color','harpGliss','glocken','tubularBells','windChimes','pizzStrings'),
      movement: r('movement','delayThrows','reverbTail','autopan','stringRiser','panSweep','tapeEcho'),
    },
  },
  cinematicMass: {
    label: 'Cinematic Mass', source: 'The Mass',
    genre: 'Era Style, epic choral cinematic',
    beatless: false, bpm: [100,112], energy: 'medium to high', colorChance: 0.55,
    drums: { primary: 'cinematic', secondary: 'driving' },
    pools: {
      pads:     r('pads','stringOrchestra','pipeOrgan','choirPadWordless','brassSwell','cinematicDrone','hybridOrchSynth'),
      bass:     r('bass','orchestralCello','electricBass','rockBass','synthSubBass','organPedal'),
      harmony:  r('harmony','carminaProg','minorCinematic','phrygianCadence','risingProg','sacredCadence','majorAnthem'),
      voice:    r('voice','multitracked','pseudoLatinChoir','layeredChoirSATB','maleChoirLow','callResponse','chantStabs','soaringFemale'),
      lead:     r('lead','electricGuitar','distortedRiff','brassFanfare','stringOstinato','soaringViolin','synthLead'),
      color:    r('color','timpaniRoll','orchHit','choirStab','brassStab','cymbalSwell','tubularBells'),
      movement: r('movement','orchestralSwell','cinematicRiser','guitarSustain','stringRiser','risers','reversedTr'),
    },
  },
  drivingEpic: {
    label: 'Driving Epic', source: 'The Mass / Reborn',
    genre: 'Era Style, driving orchestral-electronic epic',
    beatless: false, bpm: [116,128], energy: 'high', colorChance: 0.45,
    drums: { primary: 'epicDrive', secondary: 'cinematic' },
    // NO rock/guitar sources: propulsion comes from the sixteenth-note string ostinato,
    // sequenced synth pulse and tribal/orchestral percussion (Reborn's Arabic-electronic edge).
    negative: ['rock','heavy metal','symphonic metal','death metal','metal guitar',
               'distorted electric guitar','power chords','double-kick blast beats',
               'screamed vocals','growled vocals','guitar solo'],
    pools: {
      pads:     r('pads','glassSynthPad','synthPadLush','cinematicDrone','hybridOrchSynth','fmCrystalPad','airVocalPad'),
      bass:     r('bass','seqBass','driveSub','synthSubBass','filterBass','pulseCello','oudLow'),
      harmony:  r('harmony','minorCinematic','carminaProg','risingProg','majorAnthem','minorToMajor','phrygianCadence'),
      voice:    r('voice','multitracked','chantStabs','pseudoLatinChoir','arabicFemale','callResponse','soaringFemale'),
      lead:     r('lead','stringOstinato','arpSynth','synthLead','fmBellLead','neyLead','brassFanfare','soaringViolin'),
      color:    r('color','orchHit','choirStab','brassStab','reversedStab','oudRun','sitarAccent','bellArp'),
      movement: r('movement','cinematicRiser','gatedPulse','risers','delayThrows','filterLFO','panSweep','stringRiser'),
    },
  },
};

const INTERPLAY = {
  cathedralOverture: {
    conversation: ['answering the choir from across the orchestra','stating the theme alone then swallowed by the ensemble',
                   'trading long phrases with the strings in call-and-response'],
    foundation:   ['grounding the harmony with a slow pedal beneath the swells','anchoring in slow motion while the upper voices soar',
                   'holding a single harmonic centre with everything rising above'],
    arc:          ['building from a lone voice to full orchestral grandeur','swelling toward a towering climax then falling to silence',
                   'resolving at last into a sustained sacred final chord','landing the overture on a resolved tonic cadence'],
    voiceRel:     ['soaring over the orchestra','chanting from the depth of the reverb','answering the theme in layered harmony'],
    colorRel:     ['tolling once into the vast space','swelling under the climax','marking the turn of the phrase'],
  },
  neoGregorianAnthem: {
    conversation: ['trading the melody with the choir over the groove','stating the hook while the chant breathes beneath',
                   'answered by soaring vocal lines on the lift'],
    foundation:   ['locked with the beat in a steady hypnotic pocket','rolling forward beneath the choir grounding the anthem',
                   'holding steady while the low end drives the groove'],
    arc:          ['building through layered chant toward a soaring chorus','stacking voices to an anthemic peak then easing back',
                   'lifting into a triumphant resolved chorus','resolving the anthem onto a bright final cadence'],
    voiceRel:     ['soaring over the groove','chanting beneath the lead','rising in call-and-response with the melody'],
    colorRel:     ['punctuating the downbeats','sparkling over the chant','answering the chorus hits'],
  },
  etherealBallad: {
    conversation: ['weaving in intimate dialogue over the pads','floating free above the harmony answered by strings',
                   'trading tender phrases with a second voice'],
    foundation:   ['moving slow and unhurried beneath the vocal','gliding under the arrangement tied to the gentle pulse',
                   'anchoring softly while the low end breathes'],
    arc:          ['opening one voice at a time with air around each','swelling to an emotional lift then settling back to stillness',
                   'building tenderly toward a resolved final chord','easing into a warm resolving cadence as it closes'],
    voiceRel:     ['carrying the melody with aching clarity','answering the lead in soft harmony','entering with air around it'],
    colorRel:     ['shimmering between the phrases','tracing the top of the harmony','glinting in the quiet spaces'],
  },
  cinematicMass: {
    conversation: ['answered by the guitar over the pounding choir','trading heroic phrases with the full ensemble',
                   'locking with the string ostinato in driving unison'],
    foundation:   ['pounding in lockstep with the cinematic beat','driving relentless beneath the massed choir',
                   'anchoring the ritual as the low end thunders'],
    arc:          ['building from ritual chant to a thunderous climax','stacking choir and orchestra to an overwhelming peak',
                   'released from the build into a triumphant resolved chorus','resolving the mass onto a towering final chord'],
    voiceRel:     ['thundering over the orchestra','chanting massed beneath the guitar','trading the foreground with the lead'],
    colorRel:     ['hammering the accents','crashing under the climax','punctuating the ritual build'],
  },
  drivingEpic: {
    conversation: ['interlocking with the string ostinato in a driving weave','answered by chant stabs over the pulse',
                   'trading with its own delayed repeats in call-and-response','climbing over the sequenced pulse as the choir answers'],
    foundation:   ['locked tight and propulsive under the layers','pulsing relentless beneath the climbing synths',
                   'anchoring as a driving low pulse while the epic builds','pushing the groove forward beneath the massed voices'],
    arc:          ['building through stacked layers toward an open peak','opening over the drive into a full-energy lift',
                   'released from the climb into a soaring resolved chorus','resolving the drive onto a bright final chord'],
    voiceRel:     ['riding high over the drive','stabbing rhythmically against the pulse','climbing over the groove'],
    colorRel:     ['sparking over the groove','accenting the lift','flickering between the beats'],
  },
};

const ERA = {
  id: 'Era',
  styleAnchor: 'Era Style',
  master: P,
  drums: DRUMS,
  characters: CHARACTERS,
  interplay: INTERPLAY,
  sourceNegative: [
    'radio pop','cheesy pop hooks','rap verse','trap hi-hats','EDM festival drop',
    'supersaw stacks','chiptune','autotuned vocals','lo-fi',
  ],
  order: ['pads','harmony','bass','drums','voice','lead','color','movement'],
};

Object.assign(window.__ATMOS, { ERA });
})();

/* engines/deepforest.js */
(function(){
// Deep Forest engine (Eric Mouquet / Michel Sanchez, prod. Dan Lacksman)
// ---------------------------------------------------------------------------
// RESEARCH BASIS (catalogue, not general vibes):
//   Deep Forest (1992)  — "ethnic electronica": Central African / Solomon Islands
//                         chant material over early-90s ambient + dance-driven
//                         electronics. Beatless twilight interludes sit next to
//                         club-facing cuts (Sweet Lullaby, Forest Hymn, Savana Dance).
//   Boheme (1995)       — Eastern Europe: Hungarian/Romani/Bulgarian folk voices,
//                         cimbalom, folk violin, accordion, breakbeat.
//                         (Grammy, Best World Music Album.)
//   Comparsa (1997)     — Afro-Cuban / Latin / Caribbean carnival: congas, marimba,
//                         steel pan, nylon guitar, procession grooves.
//   Post-2005 (Mouquet solo: Deep Brasil / Deep Africa / Evo Devo) — same DNA,
//                         so it is treated as colour on the above, not a 4th world.
//
// CHARACTER LOGIC = GENRE -> SUB-GENRE -> INSTRUMENTATION (John's rule), never BPM alone:
//   Forest Nocturne  = world/ambient   -> ethno-ambient        -> kalimba, wooden flute, drones
//   Sweet Chillout   = world/electronic-> ethnic downtempo     -> hocketed chant, dub sub, marimba
//   Bohemian Fusion  = world/electronic-> Balkan folk-electronica -> cimbalom, folk violin, accordion
//   Comparsa Carnival= world/latin     -> Afro-Cuban worldbeat -> congas, steel pan, brass, nylon
//   Tribal Dance     = electronic      -> tribal house         -> 4/4 club kit, chant stabs, house piano
//
// VOCAL DIRECTION TAXONOMY (feeds the later lyric/metatag engine — do not lose this):
//   forest voices   : interlocking hocketed chant, high yodelled forest calls, lone lullaby
//   Balkan voices   : Hungarian folk female, open-fifth Bulgarian harmony, Romani male lament
//   Latin voices    : Afro-Cuban call-and-response, group carnival chant
//   electronic use  : chopped chant stabs, looped chant hook, wordless layered choir
//   language        : untranslated / vocable; the voice is used as an instrument
//
// Domains: 'E' electronic, 'A' acoustic/organic, 'B' both.
// NOTE: field recordings / nature sound / foley are FORBIDDEN in the positive prompt —
// the "forest" is made from instruments and voices only.

const P = {
  pads: {
    warmAnalogPad:  { t: 'lush warm analog synth pads', d: 'E' },
    forestDrone:    { t: 'a deep sustained low synth drone bed', d: 'E' },
    synthStringPad: { t: 'a warm synth-string pad wash', d: 'E' },
    choirPad:       { t: 'a wordless choir pad', d: 'B' },
    glassPad:       { t: 'a glassy digital pad', d: 'E' },
    bellPad:        { t: 'a shimmering bell-synth pad', d: 'E' },
    stringSection:  { t: 'a lush string section', d: 'A' },
    accordionDrone: { t: 'a sustained accordion drone', d: 'A' },
    marimbaBed:     { t: 'a soft marimba ostinato bed', d: 'A' },
    hybridWash:     { t: 'a hybrid orchestra-and-synth wash', d: 'B' },
    fluteBed:       { t: 'a layered wooden-flute pad', d: 'A' },
    rhodesBed:      { t: 'a warm Rhodes chord bed', d: 'B' },
    nylonBed:       { t: 'a soft nylon-guitar arpeggio bed', d: 'A' },
  },
  bass: {
    subBass:      { t: 'a deep round synth sub-bass', d: 'E' },
    fretlessBass: { t: 'a singing fretless bass', d: 'B' },
    dubBass:      { t: 'a deep dub bassline', d: 'E' },
    pluckedBass:  { t: 'a plucked synth bass', d: 'E' },
    houseBass:    { t: 'a driving house bassline', d: 'E' },
    tumbaoBass:   { t: 'a syncopated Latin tumbao bass', d: 'B' },
    uprightBass:  { t: 'a walking upright bass', d: 'A' },
    celloLow:     { t: 'a low bowed cello counterline', d: 'A' },
    balafonBass:  { t: 'a low balafon bass pulse', d: 'A' },
    seqBass:      { t: 'a sequenced synth bass pulsing eighth notes', d: 'E' },
    pedalDrone:   { t: 'a low sustained drone bass', d: 'B' },
  },
  lead: {
    kalimba:      { t: 'a bright kalimba melody', d: 'B' },
    woodenFlute:  { t: 'a breathy wooden flute melody', d: 'B' },
    panpipes:     { t: 'a soft panpipe melody', d: 'B' },
    synthLead:    { t: 'a warm analog synth lead', d: 'E' },
    nylonGuitar:  { t: 'a nylon-string guitar figure', d: 'B' },
    marimbaLead:  { t: 'a rippling marimba line', d: 'B' },
    balafon:      { t: 'a rippling balafon line', d: 'B' },
    cimbalom:     { t: 'a shimmering cimbalom tremolo', d: 'B' },
    balkanClarinet:{ t: 'a wailing Balkan clarinet line', d: 'B' },
    gypsyGuitar:  { t: 'a strummed gypsy-jazz guitar', d: 'B' },
    folkViolin:   { t: 'a keening folk violin lead', d: 'B' },
    accordionLead:{ t: 'a plaintive accordion melody', d: 'B' },
    rhodesFigure: { t: 'a warm Rhodes electric-piano figure', d: 'B' },
    latinBrass:   { t: 'a punchy Latin brass line', d: 'A' },
    steelPan:     { t: 'a bright steel-pan melody', d: 'B' },
    housePiano:   { t: 'a stabbing house piano riff', d: 'B' },
    synthArp:     { t: 'a bubbling synth arpeggio lead', d: 'E' },
    ocarinaLead:  { t: 'a hollow ocarina line', d: 'B' },
  },
  harmony: {
    modalMinor:   { t: 'modal minor chord changes', d: 'B' },
    suspendedLoop:{ t: 'a suspended two-chord loop that keeps turning', d: 'B' },
    majorLift:    { t: 'a warm major-key progression lifting on the chorus', d: 'B' },
    pentatonic:   { t: 'a pentatonic modal movement', d: 'B' },
    romaniMinor:  { t: 'a Romani harmonic-minor progression', d: 'B' },
    montuno:      { t: 'an Afro-Cuban montuno chord vamp', d: 'B' },
    droneTonic:   { t: 'a static tonic drone under a shifting melody', d: 'B' },
    plagalHome:   { t: 'a plagal cadence resolving home', d: 'B' },
    risingProg:   { t: 'a rising progression that resolves upward', d: 'B' },
    minorToMajor: { t: 'a minor-to-relative-major resolution on the lift', d: 'B' },
    aeolianClose: { t: 'an aeolian cadence settling on the tonic', d: 'B' },
  },
  voice: {
    pygmyHocket:  { t: 'interlocking hocketed forest chant', d: 'A' },
    forestYodel:  { t: 'a high yodelled forest vocal call', d: 'A' },
    loneLullaby:  { t: 'a lone female lullaby vocal in an untranslated language', d: 'A' },
    chantHook:    { t: 'a looped tribal chant hook', d: 'B' },
    wordlessChoir:{ t: 'a wordless layered choir', d: 'B' },
    maleTribalCall:{ t: 'a deep male tribal call', d: 'A' },
    hungarianFolk:{ t: 'a Hungarian folk female vocal', d: 'A' },
    bulgarianHarm:{ t: 'open-fifth Bulgarian female harmony', d: 'A' },
    romaniLament: { t: 'a Romani male lament vocal', d: 'A' },
    afroCubanCall:{ t: 'an Afro-Cuban call-and-response vocal', d: 'A' },
    carnivalGroup:{ t: 'a group carnival chant', d: 'A' },
    chantStabs:   { t: 'chopped chant vocal stabs', d: 'E' },
    breathyFemale:{ t: 'a breathy close female vocal texture', d: 'A' },
    ululation:    { t: 'a rising female ululation', d: 'A' },
  },
  color: {
    thumbPiano:   { t: 'a thumb-piano ostinato accent', d: 'A' },
    bellChime:    { t: 'a struck metal bell chime', d: 'A' },
    harpGliss:    { t: 'a harp glissando', d: 'A' },
    fluteFlourish:{ t: 'a short flute flourish', d: 'A' },
    marimbaAccent:{ t: 'a marimba accent figure', d: 'A' },
    steelPanAccent:{ t: 'a steel-pan accent', d: 'A' },
    brassStab:    { t: 'a brass stab accent', d: 'A' },
    cimbalomRun:  { t: 'a cimbalom ornament run', d: 'A' },
    synthStab:    { t: 'a filtered synth stab', d: 'E' },
    reversedStab: { t: 'a reversed synth-stab accent', d: 'E' },
    bellArp:      { t: 'a bell-synth arpeggio sparkle', d: 'E' },
    gongSwell:    { t: 'a gong swell', d: 'A' },
  },
  movement: {
    delayThrows:  { t: 'tempo-synced delay throws', d: 'E' },
    dubDelay:     { t: 'dub delay echoes trailing the chant', d: 'E' },
    filterSweep:  { t: 'a slow filter sweep across the pads', d: 'E' },
    reverbTail:   { t: 'a long reverb tail', d: 'E' },
    autopan:      { t: 'a wide stereo autopan', d: 'E' },
    risers:       { t: 'filtered-noise risers into the lift', d: 'E' },
    tapeEcho:     { t: 'analog tape-echo repeats', d: 'E' },
    stringSwell:  { t: 'sweeping string swells', d: 'A' },
    vocalChops:   { t: 'stuttered vocal-chop edits', d: 'E' },
    sidechainPump:{ t: 'a pumping sidechained pad rhythm', d: 'E' },
    breakdown:    { t: 'a stripped breakdown before the lift', d: 'B' },
    pitchGlide:   { t: 'a slow pitch-bending pad glide', d: 'E' },
  },
};

// Drum pools are kept ENTIRELY separate from the instrument palette (project rule).
const DRUMS = {
  downtempo:  ['a soft downtempo breakbeat','a laid-back trip-hop groove with hand percussion','a mellow programmed beat with shakers and congas','a slow half-time groove under a djembe'],
  worldbeat:  ['a mid-tempo programmed beat with djembe and talking drum','a syncopated worldbeat groove with hand percussion','a breakbeat laced with tribal percussion'],
  balkanbeat: ['a steady mid-tempo programmed groove with tabla and frame drum','a mid-tempo programmed groove with tambourine and hand percussion','an even mid-tempo groove with dumbek and light hand percussion'],
  carnival:   ['a rolling conga-and-timbale carnival groove','an Afro-Cuban percussion groove with congas and guiro','a live-feel Latin percussion groove with bongos and shakers'],
  tribalHouse:['a four-on-the-floor house beat with tribal percussion','a driving house groove with djembe and shakers','a punchy club beat with layered hand percussion'],
  tribalOrganic:['a rolling djembe-and-talking-drum groove','a layered hand-percussion groove with shakers and log drum','an organic tribal drum groove with congas and frame drum','a loping djembe groove with woven hand percussion'],
};

const r = (role, ...keys) => keys.map(k => P[role][k]);

const CHARACTERS = {
  forestNocturne: {
    label: 'Forest Nocturne', source: 'Deep Forest (twilight interludes)',
    genre: 'Deep Forest Style, ethno-ambient world music',
    beatless: true, energy: 'low', colorChance: 0.5,
    drums: { primary: null, secondary: null },
    pools: {
      pads:     r('pads','forestDrone','warmAnalogPad','synthStringPad','choirPad','glassPad','bellPad'),
      bass:     r('bass','pedalDrone','subBass','celloLow','fretlessBass'),
      harmony:  r('harmony','droneTonic','pentatonic','modalMinor','aeolianClose','plagalHome'),
      voice:    r('voice','loneLullaby','wordlessChoir','pygmyHocket','breathyFemale','maleTribalCall'),
      lead:     r('lead','kalimba','woodenFlute','panpipes','ocarinaLead','marimbaLead'),
      color:    r('color','thumbPiano','bellChime','harpGliss','marimbaAccent','gongSwell'),
      movement: r('movement','reverbTail','delayThrows','pitchGlide','autopan','stringSwell'),
    },
  },
  sweetChillout: {
    label: 'Sweet Chillout', source: 'Deep Forest (Sweet Lullaby / White Whisper)',
    genre: 'Deep Forest Style, ethnic-electronica downtempo chillout',
    beatless: false, bpm: [86,98], energy: 'low to medium', colorChance: 0.5,
    drums: { primary: 'downtempo', secondary: 'worldbeat' },
    pools: {
      pads:     r('pads','warmAnalogPad','synthStringPad','marimbaBed','choirPad','rhodesBed','bellPad'),
      bass:     r('bass','dubBass','subBass','fretlessBass','balafonBass','pluckedBass'),
      harmony:  r('harmony','suspendedLoop','pentatonic','minorToMajor','majorLift','droneTonic'),
      voice:    r('voice','loneLullaby','breathyFemale','pygmyHocket','chantHook','wordlessChoir'),
      lead:     r('lead','kalimba','panpipes','rhodesFigure','synthLead','marimbaLead'),
      color:    r('color','thumbPiano','bellChime','harpGliss','marimbaAccent','bellArp'),
      movement: r('movement','dubDelay','delayThrows','reverbTail','autopan','tapeEcho','pitchGlide'),
    },
  },
  bohemianFusion: {
    label: 'Bohemian Fusion', source: 'Boheme (Marta\u2019s Song / Freedom Cry)',
    genre: 'Deep Forest Style, Eastern European folk-electronica',
    beatless: false, bpm: [100,110], energy: 'medium', colorChance: 0.55,
    // TEMPO GUARD: fast Balkan folk playing over a breakbeat made Suno double-time into
    // jungle/DnB mid-song. Breakbeat removed from the drum family; tempo pinned here.
    tempoLock: 'one steady constant tempo held from start to finish',
    negative: ['drum and bass','jungle','breakcore','breakbeat','double-time','half-time switch',
               'tempo change','speeding up','accelerando','gabber','hardcore rave'],
    drums: { primary: 'balkanbeat', secondary: 'worldbeat' },
    pools: {
      pads:     r('pads','accordionDrone','stringSection','synthStringPad','hybridWash','choirPad','rhodesBed'),
      bass:     r('bass','uprightBass','subBass','celloLow','fretlessBass','seqBass'),
      harmony:  r('harmony','romaniMinor','modalMinor','minorToMajor','risingProg','aeolianClose'),
      voice:    r('voice','hungarianFolk','bulgarianHarm','romaniLament','wordlessChoir','breathyFemale','chantHook'),
      lead:     r('lead','cimbalom','folkViolin','accordionLead','balkanClarinet','gypsyGuitar'),
      color:    r('color','cimbalomRun','harpGliss','bellChime','synthStab','fluteFlourish'),
      movement: r('movement','delayThrows','stringSwell','tapeEcho','autopan','filterSweep','reverbTail'),
    },
  },
  comparsaCarnival: {
    label: 'Comparsa Carnival', source: 'Comparsa (Madazulu / Comparsa)',
    genre: 'Deep Forest Style, Afro-Cuban worldbeat carnival',
    beatless: false, bpm: [108,118], energy: 'medium to high', colorChance: 0.6,
    drums: { primary: 'carnival', secondary: 'worldbeat' },
    pools: {
      pads:     r('pads','marimbaBed','rhodesBed','nylonBed','warmAnalogPad','bellPad','choirPad'),
      bass:     r('bass','tumbaoBass','uprightBass','fretlessBass','subBass','balafonBass'),
      harmony:  r('harmony','montuno','majorLift','suspendedLoop','risingProg','modalMinor'),
      voice:    r('voice','afroCubanCall','carnivalGroup','ululation','maleTribalCall','chantHook','forestYodel'),
      lead:     r('lead','steelPan','nylonGuitar','latinBrass','marimbaLead','rhodesFigure','balafon'),
      color:    r('color','steelPanAccent','brassStab','marimbaAccent','bellChime','harpGliss'),
      movement: r('movement','delayThrows','breakdown','tapeEcho','autopan','stringSwell','filterSweep'),
    },
  },
  tribalWorldbeat: {
    label: 'Tribal Worldbeat', source: 'Deep Forest / Savana Dance, Hunting (album versions)',
    genre: 'Deep Forest Style, organic tribal worldbeat',
    beatless: false, bpm: [104,116], energy: 'medium to high', colorChance: 0.5,
    // The tribal character WITHOUT the club mix: organic percussion only, no house kit,
    // no four-on-the-floor, no dance-floor production.
    negative: ['house music','four-on-the-floor club beat','club remix','EDM drop',
               'techno','trance','dance remix','sidechain pumping'],
    drums: { primary: 'tribalOrganic', secondary: 'worldbeat' },
    pools: {
      pads:     r('pads','forestDrone','warmAnalogPad','choirPad','synthStringPad','hybridWash','bellPad'),
      bass:     r('bass','balafonBass','fretlessBass','subBass','pluckedBass','pedalDrone'),
      harmony:  r('harmony','pentatonic','modalMinor','suspendedLoop','droneTonic','risingProg'),
      voice:    r('voice','pygmyHocket','maleTribalCall','forestYodel','ululation','chantHook'),
      lead:     r('lead','balafon','kalimba','woodenFlute','marimbaLead','ocarinaLead','panpipes'),
      color:    r('color','thumbPiano','bellChime','gongSwell','marimbaAccent','harpGliss'),
      movement: r('movement','dubDelay','delayThrows','tapeEcho','filterSweep','reverbTail','breakdown'),
    },
  },
  tribalDance: {
    label: 'Tribal Dance', source: 'Deep Forest / Savana Dance (club mixes)',
    genre: 'Deep Forest Style, tribal house dance',
    beatless: false, bpm: [120,130], energy: 'high', colorChance: 0.45,
    drums: { primary: 'tribalHouse', secondary: 'worldbeat' },
    pools: {
      pads:     r('pads','glassPad','warmAnalogPad','bellPad','synthStringPad','choirPad','hybridWash'),
      bass:     r('bass','houseBass','seqBass','subBass','pluckedBass','dubBass'),
      harmony:  r('harmony','modalMinor','risingProg','majorLift','suspendedLoop','minorToMajor'),
      voice:    r('voice','chantStabs','chantHook','pygmyHocket','forestYodel','ululation','maleTribalCall'),
      lead:     r('lead','housePiano','synthArp','synthLead','kalimba','balafon','marimbaLead'),
      color:    r('color','synthStab','reversedStab','bellArp','thumbPiano','marimbaAccent'),
      movement: r('movement','sidechainPump','risers','vocalChops','delayThrows','filterSweep','breakdown'),
    },
  },
};

// Interaction/interplay language — WOVEN into the style string (standing project rule).
const INTERPLAY = {
  forestNocturne: {
    conversation: ['answering each other across a wide open space','stating the theme alone then dissolving back into the drone',
                   'trading slow phrases with the pad in call-and-response'],
    foundation:   ['holding a single low centre while everything floats above','sustaining beneath the melody without ever pushing',
                   'anchoring the drone as the upper voices drift'],
    arc:          ['opening one voice at a time with air around each','swelling gently then settling back to stillness',
                   'resolving at last onto a sustained tonic chord','easing into a slow resolving cadence as it closes'],
    voiceRel:     ['floating far back in the reverb','carried alone over the drone','answered in soft layered harmony'],
    colorRel:     ['glinting in the quiet spaces','ringing once into the open air','marking the turn of the phrase'],
  },
  sweetChillout: {
    conversation: ['weaving around the chant without crowding it','answered by the vocal hook on every second bar',
                   'trading gentle phrases with the pads over the groove','locking with the chant loop in a rolling weave'],
    foundation:   ['rolling deep and unhurried under the vocal','sitting low in the pocket while the melody breathes',
                   'anchoring the groove as the chant floats above'],
    arc:          ['building layer by layer then stripping back to the voice','swelling into a warm lift then easing home',
                   'resolving onto a warm final chord','settling into a resolved closing cadence'],
    voiceRel:     ['floating over the groove','looping hypnotically against the beat','answering the melody in close harmony'],
    colorRel:     ['sparkling between the phrases','tracing the top of the harmony','answering the vocal hook'],
  },
  bohemianFusion: {
    conversation: ['trading phrases with the folk voice in call-and-response','ornamenting around the vocal line as it rises',
                   'answering the melody with a keening counterline','locking with the pads while the folk voice leads'],
    foundation:   ['walking steadily beneath the breakbeat','driving the groove forward under the folk melody',
                   'holding the low centre while the ornaments fly above'],
    arc:          ['building from a solo voice to a full folk-electronic weave','lifting through each verse toward a soaring chorus',
                   'opening out into a resolved final chorus','resolving the lament onto a settled tonic'],
    voiceRel:     ['carrying the melody with raw folk edge','soaring over the steady groove','answering the lead in open harmony'],
    colorRel:     ['flashing across the top of the groove','ornamenting the turnaround','punctuating the phrase ends'],
  },
  comparsaCarnival: {
    conversation: ['trading calls with the percussion in a carnival weave','answered by the brass on the turnaround',
                   'locking with the montuno vamp in bright unison','riding over the congas answered by the chorus'],
    foundation:   ['locking with the congas in a syncopated pocket','pushing the procession forward beneath the chorus',
                   'swinging under the groove while the melody dances above'],
    arc:          ['building the procession from one drum to a full carnival','stacking voices and percussion to a joyful peak',
                   'released into a bright resolved final chorus','landing the carnival on a resolved major chord'],
    voiceRel:     ['calling out over the percussion','answered by the crowd on the refrain','trading the foreground with the lead'],
    colorRel:     ['flashing over the groove','punctuating the downbeats','answering the brass hits'],
  },
  tribalWorldbeat: {
    conversation: ['interlocking with the hand percussion in a rolling weave','answered by the chant across the groove',
                   'trading phrases with the drums in call-and-response','riding the djembe as the chant answers'],
    foundation:   ['locking with the drums in a deep organic pocket','rolling forward beneath the massed chant',
                   'anchoring the groove while the percussion breathes above'],
    arc:          ['building from one drum to a full tribal weave','layering voices and percussion toward an open peak',
                   'released from the break into a resolved final chorus','landing the procession on a resolved tonic'],
    voiceRel:     ['calling out over the drums','interlocking with the percussion','answered by the group in call-and-response'],
    colorRel:     ['ringing across the groove','marking the turn of the phrase','answering the drums'],
  },
  tribalDance: {
    conversation: ['interlocking with the chant stabs in a driving weave','answered by its own delayed repeats',
                   'stabbing against the pulse as the chant answers','climbing over the four-on-the-floor pulse'],
    foundation:   ['locked tight and propulsive under the layers','pumping relentless beneath the chant',
                   'driving the floor while the percussion rolls above'],
    arc:          ['building through the breakdown into a full-energy lift','stacking percussion toward an open peak',
                   'released from the break into a resolved euphoric chorus','resolving the drive onto a bright final chord'],
    voiceRel:     ['chopped rhythmically against the pulse','riding high over the drive','looping hypnotically through the groove'],
    colorRel:     ['sparking over the groove','accenting the lift','flickering between the beats'],
  },
};

const DEEPFOREST = {
  // ethnic-electronica: the lead pool carries the signature instrument, so a
  // composer overlay's melodic trait is added as a second voice, never a swap.
  signatureLead: true,
  id: 'Deep Forest',
  styleAnchor: 'Deep Forest Style',
  master: P,
  drums: DRUMS,
  characters: CHARACTERS,
  interplay: INTERPLAY,
  sourceNegative: [
    'radio pop','cheesy pop hooks','rap verse','trap hi-hats','EDM festival drop',
    'supersaw stacks','chiptune','autotuned vocals','heavy metal','distorted electric guitar',
    'rock drums','orchestral fanfare',
  ],
  order: ['pads','harmony','bass','drums','voice','lead','color','movement'],
};

Object.assign(window.__ATMOS, { DEEPFOREST });
})();

/* engines/sacredspirit.js */
(function(){
// Sacred Spirit engine (Claus Zundel a.k.a. "The Fearsome Brave", w/ Ralf Hamm + Markus Staab)
// ---------------------------------------------------------------------------
// RESEARCH BASIS (catalogue, not general vibes):
//   Chants and Dances of the Native Americans (1994) — the defining record. Ceremonial
//   chant (Navajo / Pueblo / Sioux material, plus a Sami yoik on "Ly-O-Lay Ale Loya")
//   set over synthesizer backings and CELLO, and driven by a combination of traditional
//   drumming and electronic dance beats. Signature instruments repeatedly cited in the
//   record's reception: Native American cedar flute, drums/rattles, deep bowed cello,
//   keyboard wash. Track shapes give the character map directly:
//     "How the West Was Lost (Intro & Prelude)"      -> beatless ceremonial ambient
//     "Tor-Cheney-Nahana (Winter Ceremony)"          -> slow ceremonial, drum-as-heartbeat
//     "Yeha-Noha (Wishes of Happiness & Prosperity)" -> looping electro-acoustic chant groove
//     "Ta-Was-Ne (Elevation)"                        -> synth-forward hypnotic new-age
//     "Ly-O-Lay Ale Loya (Counterclockwise Circle Dance)" -> dance/club circle groove
//   Indians' Sacred Spirit (2000) — same world, more instrumental, chant chopped into
//   short pieced samples rather than one long line. Treated as colour on the above.
//   Zundel is also B-Tribe (Ibiza chillout) — that production hand (warm pads, nylon
//   guitar, hand percussion, wide reverb) is audible throughout and is part of the palette.
//
// CHARACTER LOGIC = GENRE -> SUB-GENRE -> INSTRUMENTATION (John's rule), never BPM alone:
//   Ceremonial Prelude  = new age/ambient -> ceremonial ambient    -> cedar flute, cello, drones
//   Winter Ceremony     = new age/world   -> slow ceremonial       -> heartbeat drum, cello, chant
//   Chant Groove        = world/electronic-> electro-acoustic downtempo -> looped chant, hand perc
//   Shamanic Elevation  = electronic      -> hypnotic new-age       -> arps, synth lead, tribal pulse
//   Circle Dance        = electronic      -> tribal dance/club      -> 4/4 kit + powwow frame drum
//
// VOCAL DIRECTION TAXONOMY (feeds the later lyric/metatag engine — do not lose this):
//   solo ceremonial : lone elder male chant, low male vocal drone
//   group           : unison powwow-style group chant, layered chant choir, call-and-response
//   northern colour : Sami-style yoik (used on the Circle Dance material)
//   wordless        : vocables (chanting with no lexical words), wordless female line, high cry
//   electronic use  : looped chant hook, chopped chant stabs
//   language        : vocable / untranslated; the chant functions as the lead instrument.
//   NOTE: chant is treated as MUSIC, never as spoken word or field recording.
//
// Domains: 'E' electronic, 'A' acoustic/organic, 'B' both.

const P = {
  pads: {
    warmPad:      { t: 'warm analog synth pads', d: 'E' },
    lowDrone:     { t: 'a deep sustained low synth drone', d: 'E' },
    stringPad:    { t: 'a lush string-section pad', d: 'A' },
    celloBed:     { t: 'a sustained bowed-cello drone', d: 'A' },
    choirPad:     { t: 'a wordless choir pad', d: 'B' },
    glassPad:     { t: 'a glassy digital pad', d: 'E' },
    shimmerPad:   { t: 'a shimmering high-string tremolo pad', d: 'A' },
    openAirWash:  { t: 'a wide open synth wash', d: 'E' },
    nylonBed:     { t: 'a soft nylon-guitar arpeggio bed', d: 'A' },
    bellPad:      { t: 'a bell-synth pad shimmer', d: 'E' },
    hybridWash:   { t: 'a hybrid strings-and-synth wash', d: 'B' },
    fluteBed:     { t: 'a layered wooden-flute pad', d: 'A' },
  },
  bass: {
    subBass:     { t: 'a deep round synth sub-bass', d: 'E' },
    celloBass:   { t: 'a low bowed cello foundation', d: 'A' },
    fretlessBass:{ t: 'a singing fretless bass', d: 'B' },
    dubBass:     { t: 'a deep dub bassline', d: 'E' },
    pluckedBass: { t: 'a plucked synth bass', d: 'E' },
    houseBass:   { t: 'a driving house bassline', d: 'E' },
    seqBass:     { t: 'a sequenced synth bass pulsing eighth notes', d: 'E' },
    uprightBass: { t: 'an upright bass pulse', d: 'A' },
    pedalDrone:  { t: 'a low sustained drone bass', d: 'B' },
    filterBass:  { t: 'a warm filtered analog bassline', d: 'E' },
  },
  lead: {
    cedarFlute:  { t: 'a breathy Native American cedar flute melody', d: 'B' },
    soloCello:   { t: 'an aching solo cello line', d: 'B' },
    lowDroneFlute:{ t: 'a low drone-flute counterline', d: 'A' },
    soloViolin:  { t: 'a keening solo violin', d: 'A' },
    nylonGuitar: { t: 'a nylon-string guitar figure', d: 'A' },
    pianoFigure: { t: 'a simple grand-piano figure', d: 'A' },
    rhodesFigure:{ t: 'a warm Rhodes electric-piano figure', d: 'B' },
    synthLead:   { t: 'a warm analog synth lead', d: 'E' },
    synthArp:    { t: 'a bubbling synth arpeggio lead', d: 'E' },
    fmBellLead:  { t: 'a glassy FM bell lead', d: 'E' },
    ocarinaLead: { t: 'a hollow ocarina line', d: 'A' },
    housePiano:  { t: 'a stabbing house piano riff', d: 'B' },
  },
  harmony: {
    modalMinor:   { t: 'modal minor chord changes', d: 'B' },
    pentatonic:   { t: 'a pentatonic modal movement', d: 'B' },
    droneTonic:   { t: 'a static tonic drone under a shifting melody', d: 'B' },
    suspendedLoop:{ t: 'a suspended two-chord loop that keeps turning', d: 'B' },
    majorLift:    { t: 'a warm major-key progression lifting on the chorus', d: 'B' },
    minorToMajor: { t: 'a minor-to-relative-major resolution on the lift', d: 'B' },
    plagalHome:   { t: 'a plagal cadence resolving home', d: 'B' },
    risingProg:   { t: 'a rising progression that resolves upward', d: 'B' },
    aeolianClose: { t: 'an aeolian cadence settling on the tonic', d: 'B' },
    pedalHarmony: { t: 'a sustained tonic pedal under shifting harmony', d: 'B' },
  },
  voice: {
    elderChant:   { t: 'a lone elder male ceremonial chant', d: 'A' },
    lowVocalDrone:{ t: 'a low male vocal drone', d: 'A' },
    groupChant:   { t: 'a unison powwow-style group chant', d: 'A' },
    layeredChant: { t: 'a layered chant choir', d: 'B' },
    yoikVocal:    { t: 'a Sami-style yoik vocal', d: 'A' },
    vocables:     { t: 'wordless vocable chanting', d: 'A' },
    callResponse: { t: 'call-and-response chant answers', d: 'A' },
    wordlessFemale:{ t: 'a wordless female vocal line', d: 'A' },
    highCry:      { t: 'a high female vocal cry', d: 'A' },
    chantHook:    { t: 'a looped chant hook', d: 'B' },
    chantStabs:   { t: 'chopped chant vocal stabs', d: 'E' },
    breathyFemale:{ t: 'a breathy close female vocal texture', d: 'A' },
  },
  color: {
    bellChime:    { t: 'a struck metal bell chime', d: 'A' },
    windChimes:   { t: 'a wind-chime shimmer', d: 'A' },
    fluteFlourish:{ t: 'a short flute flourish', d: 'A' },
    harpGliss:    { t: 'a harp glissando', d: 'A' },
    celloSwell:   { t: 'a swelling cello accent', d: 'A' },
    pizzStrings:  { t: 'a pizzicato string accent', d: 'A' },
    gongSwell:    { t: 'a gong swell', d: 'A' },
    synthStab:    { t: 'a filtered synth stab', d: 'E' },
    reversedStab: { t: 'a reversed synth-stab accent', d: 'E' },
    bellArp:      { t: 'a bell-synth arpeggio sparkle', d: 'E' },
  },
  movement: {
    reverbTail:   { t: 'a long reverb tail', d: 'E' },
    delayThrows:  { t: 'tempo-synced delay throws', d: 'E' },
    dubDelay:     { t: 'dub delay echoes trailing the chant', d: 'E' },
    filterSweep:  { t: 'a slow filter sweep across the pads', d: 'E' },
    autopan:      { t: 'a wide stereo autopan', d: 'E' },
    risers:       { t: 'filtered-noise risers into the lift', d: 'E' },
    tapeEcho:     { t: 'analog tape-echo repeats', d: 'E' },
    stringSwell:  { t: 'sweeping string swells', d: 'A' },
    sidechainPump:{ t: 'a pumping sidechained pad rhythm', d: 'E' },
    breakdown:    { t: 'a stripped breakdown before the lift', d: 'B' },
    vocalChops:   { t: 'stuttered vocal-chop edits', d: 'E' },
    pitchGlide:   { t: 'a slow pitch-bending pad glide', d: 'E' },
  },
};

// Drum pools kept ENTIRELY separate from the instrument palette (project rule).
const DRUMS = {
  heartbeat:  ['a slow deep frame-drum heartbeat pulse','a soft ceremonial drum pulse with light rattles','a slow tribal drum pattern with shakers'],
  ceremonial: ['a steady powwow-style frame drum with rattles','a mid-tempo tribal drum groove with shakers','a downtempo beat under a big frame drum'],
  chantGroove:['a laid-back electro-acoustic beat with hand percussion','a mellow programmed groove with shakers and soft toms','a downtempo beat with congas and rattles'],
  hypnotic:   ['a hypnotic programmed pulse with tribal percussion','a steady electronic groove with rattles and low toms','a driving mid-tempo beat with layered hand percussion'],
  circleDance:['a four-on-the-floor beat under a powwow frame drum','a driving club beat with tribal drums and shakers','a punchy dance beat layered with big tom hits'],
};

const r = (role, ...keys) => keys.map(k => P[role][k]);

const CHARACTERS = {
  ceremonialPrelude: {
    label: 'Ceremonial Prelude', source: 'How the West Was Lost (Intro & Prelude)',
    genre: 'Sacred Spirit Style, ceremonial ambient new age',
    beatless: true, energy: 'low', colorChance: 0.5,
    drums: { primary: null, secondary: null },
    pools: {
      pads:     r('pads','lowDrone','celloBed','choirPad','warmPad','shimmerPad','openAirWash'),
      bass:     r('bass','pedalDrone','celloBass','subBass','fretlessBass'),
      harmony:  r('harmony','droneTonic','pentatonic','aeolianClose','plagalHome','pedalHarmony'),
      voice:    r('voice','elderChant','lowVocalDrone','vocables','wordlessFemale','layeredChant'),
      lead:     r('lead','cedarFlute','soloCello','lowDroneFlute','ocarinaLead','pianoFigure'),
      color:    r('color','bellChime','windChimes','harpGliss','celloSwell','gongSwell'),
      movement: r('movement','reverbTail','pitchGlide','autopan','stringSwell','delayThrows'),
    },
  },
  winterCeremony: {
    label: 'Winter Ceremony', source: 'Tor-Cheney-Nahana (Winter Ceremony)',
    genre: 'Sacred Spirit Style, slow ceremonial world new age',
    beatless: false, bpm: [72,84], energy: 'low to medium', colorChance: 0.5,
    drums: { primary: 'heartbeat', secondary: 'ceremonial' },
    pools: {
      pads:     r('pads','celloBed','stringPad','warmPad','choirPad','hybridWash','shimmerPad'),
      bass:     r('bass','celloBass','pedalDrone','subBass','uprightBass','fretlessBass'),
      harmony:  r('harmony','modalMinor','aeolianClose','minorToMajor','pedalHarmony','plagalHome'),
      voice:    r('voice','elderChant','groupChant','vocables','lowVocalDrone','callResponse','wordlessFemale'),
      lead:     r('lead','soloCello','cedarFlute','soloViolin','pianoFigure','lowDroneFlute'),
      color:    r('color','celloSwell','bellChime','pizzStrings','harpGliss','gongSwell'),
      movement: r('movement','stringSwell','reverbTail','delayThrows','tapeEcho','autopan'),
    },
  },
  chantGroove: {
    label: 'Chant Groove', source: 'Yeha-Noha (Wishes of Happiness & Prosperity)',
    genre: 'Sacred Spirit Style, chant-led electro-acoustic downtempo',
    beatless: false, bpm: [92,102], energy: 'medium', colorChance: 0.5,
    drums: { primary: 'chantGroove', secondary: 'ceremonial' },
    pools: {
      pads:     r('pads','warmPad','nylonBed','openAirWash','choirPad','stringPad','bellPad'),
      bass:     r('bass','dubBass','subBass','fretlessBass','filterBass','uprightBass'),
      harmony:  r('harmony','suspendedLoop','pentatonic','majorLift','minorToMajor','droneTonic'),
      voice:    r('voice','chantHook','elderChant','vocables','layeredChant','breathyFemale','callResponse'),
      lead:     r('lead','cedarFlute','nylonGuitar','rhodesFigure','soloCello','synthLead','ocarinaLead'),
      color:    r('color','bellChime','harpGliss','bellArp','celloSwell','windChimes'),
      movement: r('movement','dubDelay','delayThrows','reverbTail','tapeEcho','autopan','filterSweep'),
    },
  },
  shamanicElevation: {
    label: 'Shamanic Elevation', source: 'Ta-Was-Ne (Elevation)',
    genre: 'Sacred Spirit Style, hypnotic electronic new age',
    beatless: false, bpm: [106,116], energy: 'medium to high', colorChance: 0.5,
    drums: { primary: 'hypnotic', secondary: 'circleDance' },
    pools: {
      pads:     r('pads','glassPad','openAirWash','warmPad','bellPad','hybridWash','choirPad'),
      bass:     r('bass','seqBass','subBass','pluckedBass','filterBass','fretlessBass'),
      harmony:  r('harmony','modalMinor','risingProg','suspendedLoop','minorToMajor','majorLift'),
      voice:    r('voice','layeredChant','chantHook','yoikVocal','highCry','vocables','chantStabs'),
      lead:     r('lead','synthArp','synthLead','fmBellLead','cedarFlute','rhodesFigure','soloViolin'),
      color:    r('color','bellArp','synthStab','reversedStab','windChimes','pizzStrings'),
      movement: r('movement','filterSweep','delayThrows','risers','autopan','breakdown','pitchGlide'),
    },
  },
  circleDance: {
    label: 'Circle Dance', source: 'Ly-O-Lay Ale Loya (Counterclockwise Circle Dance)',
    genre: 'Sacred Spirit Style, tribal dance circle groove',
    beatless: false, bpm: [118,128], energy: 'high', colorChance: 0.45,
    drums: { primary: 'circleDance', secondary: 'hypnotic' },
    pools: {
      pads:     r('pads','openAirWash','glassPad','warmPad','choirPad','bellPad','stringPad'),
      bass:     r('bass','houseBass','seqBass','subBass','pluckedBass','filterBass'),
      harmony:  r('harmony','pentatonic','modalMinor','risingProg','majorLift','suspendedLoop'),
      voice:    r('voice','yoikVocal','groupChant','chantStabs','chantHook','callResponse','highCry'),
      lead:     r('lead','housePiano','synthArp','cedarFlute','synthLead','fmBellLead','soloViolin'),
      color:    r('color','synthStab','reversedStab','bellArp','bellChime','windChimes'),
      movement: r('movement','sidechainPump','risers','vocalChops','breakdown','delayThrows','filterSweep'),
    },
  },
};

// Interaction/interplay language — WOVEN into the style string (standing project rule).
const INTERPLAY = {
  ceremonialPrelude: {
    conversation: ['answering the chant across a vast open space','stating the theme alone then dissolving into the drone',
                   'trading long slow phrases with the pad in call-and-response'],
    foundation:   ['holding one low centre while everything floats above','sustaining beneath the melody without ever pushing',
                   'anchoring the drone as the upper voices drift'],
    arc:          ['opening one voice at a time with air around each','swelling slowly then falling back to stillness',
                   'resolving at last onto a sustained tonic chord','easing into a slow resolving cadence as it closes'],
    voiceRel:     ['carried alone over the drone','floating far back in the reverb','answered in soft layered harmony'],
    colorRel:     ['ringing once into the open air','glinting in the quiet spaces','marking the turn of the phrase'],
  },
  winterCeremony: {
    conversation: ['answering the chant with a long aching counterline','trading slow phrases with the strings',
                   'stating the melody alone as the ensemble gathers behind it','weaving around the ceremonial voice without crowding it'],
    foundation:   ['pulsing slow and deep like a heartbeat under the chant','anchoring in slow motion while the melody rises',
                   'moving unhurried beneath the ceremony'],
    arc:          ['building from a lone voice to a full ceremonial weave','swelling toward a solemn peak then falling away',
                   'resolving onto a settled final chord','landing the ceremony on a resolved cadence'],
    voiceRel:     ['chanting from deep in the reverb','carried over the slow pulse','answered by the massed group chant'],
    colorRel:     ['swelling under the phrase','ringing across the drum pulse','marking the turn of the ceremony'],
  },
  chantGroove: {
    conversation: ['weaving around the chant loop without crowding it','answered by the vocal hook every second bar',
                   'trading warm phrases with the pads over the groove','locking with the chant hook in a rolling weave'],
    foundation:   ['rolling deep and unhurried under the chant','sitting low in the pocket while the melody breathes',
                   'anchoring the groove as the voice floats above'],
    arc:          ['building layer by layer then stripping back to the chant','swelling into a warm lift then easing home',
                   'resolving onto a warm final chord','settling into a resolved closing cadence'],
    voiceRel:     ['looping hypnotically over the groove','floating above the beat','answering the melody in close harmony'],
    colorRel:     ['sparkling between the phrases','tracing the top of the harmony','answering the vocal hook'],
  },
  shamanicElevation: {
    conversation: ['interlocking with the arpeggio in a hypnotic weave','answered by the chant on the lift',
                   'trading with its own delayed repeats in call-and-response','climbing over the pulse as the choir answers'],
    foundation:   ['pulsing steady and hypnotic under the layers','driving forward beneath the climbing synths',
                   'anchoring the trance while the percussion rolls above'],
    arc:          ['building through stacked layers toward an open peak','opening out of the breakdown into a soaring lift',
                   'released from the climb into a resolved chorus','resolving the ascent onto a bright final chord'],
    voiceRel:     ['soaring over the pulse','looping hypnotically through the groove','rising in answer to the lead'],
    colorRel:     ['sparking over the groove','accenting the lift','flickering between the beats'],
  },
  circleDance: {
    conversation: ['interlocking with the chant stabs in a driving weave','answered by the yoik over the four-on-the-floor pulse',
                   'stabbing against the beat as the group chant answers','riding the frame drum in a circling weave'],
    foundation:   ['locked tight and propulsive under the layers','pumping relentless beneath the massed chant',
                   'driving the floor while the frame drum thunders above'],
    arc:          ['building the circle from one drum to a full-energy dance','stacking chant and percussion toward an open peak',
                   'released from the break into a resolved euphoric chorus','resolving the dance onto a bright final chord'],
    voiceRel:     ['chanting massed over the drive','chopped rhythmically against the pulse','calling out high over the groove'],
    colorRel:     ['sparking over the groove','accenting the lift','flickering between the beats'],
  },
};

const SACREDSPIRIT = {
  // ethnic-electronica: the lead pool carries the signature instrument, so a
  // composer overlay's melodic trait is added as a second voice, never a swap.
  signatureLead: true,
  id: 'Sacred Spirit',
  styleAnchor: 'Sacred Spirit Style',
  master: P,
  drums: DRUMS,
  characters: CHARACTERS,
  interplay: INTERPLAY,
  sourceNegative: [
    'radio pop','cheesy pop hooks','rap verse','trap hi-hats','EDM festival drop',
    'supersaw stacks','chiptune','autotuned vocals','heavy metal','distorted electric guitar',
    'rock drums','spoken word narration',
  ],
  order: ['pads','harmony','bass','drums','voice','lead','color','movement'],
};

Object.assign(window.__ATMOS, { SACREDSPIRIT });
})();

/* legacy/data-style-engines.js */
(function(){
const MAX_MODE_STR = `[Is_MAX_MODE: MAX](MAX)
[QUALITY: MAX](MAX)
[REALISM: MAX](MAX)`;

const MASTERING = "Polished Dolby Atmos-Master Atmos -2dB.";

const STYLE_ENGINES = {
  Balearic: {
    accent: "ocean teal / blue",
    genre: "Balearic downtempo",
    presets: ["Poolside Warm", "Sunset Groove", "Twilight Drift", "Afterdark Deep"],
    phases: [
      "low-mid chill, 82-92 BPM, low energy",
      "mid chill, 90-100 BPM, medium energy",
      "mid chill, 88-98 BPM, low-medium energy",
      "mid-high chill, 96-108 BPM, medium energy",
      "low-mid chill, 84-94 BPM, low energy"
    ],
    pads: [
      "Warm analogue synth pads layered with Pulse Pad Textures and soft synth layers.",
      "Lush analogue pads blended with rich synth textures and evolving tonal layers.",
      "Deep ambient pad layers with soft Pulse Pad Textures and evolving atmosphere.",
      "Textured polysynth layers with analogue warmth and gentle modulation movement.",
      "Layered analogue pads combined with Pulse Pad Textures and soft harmonic synth layers."
    ],
    harmony: [
      "Built on warm minor-seventh chord voicings moving through an eight-bar cycle with a soft turnaround.",
      "A modal Dorian chord cycle looping steadily without a pop chorus lift.",
      "Open sus2 and add9 voicings drifting between two chords with an unhurried resolve.",
      "Major-seventh and ninth voicings moving through a relaxed Mixolydian vamp.",
      "A one-chord hypnotic centre with the harmony shifting only by inversion.",
      "A minor-to-relative-major progression unfolding across long eight-bar phrases."
    ],
    bass: [
      "Fretless bass groove with smooth melodic movement.",
      "FM bass with soft attack and subtle rhythmic pulse.",
      "Deep sub bass providing weight and low-end warmth.",
      "Electric bass guitar with warm rounded tone and flowing groove.",
      "Double bass with soft plucked articulation and organic movement.",
      "Hybrid bass combining sub bass depth with mid-range melodic tone.",
      "Acoustic bass guitar with warm natural tone and soft rhythmic movement.",
      "Plucky bass with warm analog character."
    ],
    rhythm: [
      "Natural brushed drums with organic percussion including congas, bongos, shakers and hand percussion.",
      "Live acoustic drums with a soft natural feel, subtle groove and light ghost notes, layered with organic percussion.",
      "Lounge/house drum kit with soft kick, clean snare and tight hi-hats, supported by congas, shakers and light percussion.",
      "Minimal downtempo drum groove with soft kick, rim clicks and light percussion textures."
    ],
    percussion: [
      "Slow string bed sitting deep in the mix.",
      "Soft layered strings blended underneath the pads for depth.",
      "Subtle string textures supporting the harmonic space."
    ],
    motifs: [
      "Clean nylon guitar motifs with soft rhythmic strumming drifting in and out of the mix.",
      "Soft acoustic guitar phrases with gentle rhythmic movement and natural flow.",
      "Rhodes electric piano motifs with warm chord movement and melodic phrasing.",
      "Arpeggiated synth leads weaving through the mix with evolving rhythmic motion.",
      "Soft flute motifs with airy phrasing and gentle movement through the mix.",
      "Vibraphone phrases with smooth sustained notes and gentle movement."
    ],
    movement: [
      "Wide stereo panning movement across pads and motifs using left-right automation and slow modulation.",
      "Delay-driven movement using tempo-synced echoes and cascading repeats creating evolving rhythmic space.",
      "Rhythmic autopan and modulation creating groove-based movement across percussion and melodic elements.",
      "Filter and modulation movement using LFO, chorus and phaser creating evolving tonal shifts across pads and textures."
    ],
    negatives: "no harsh EDM drops, no aggressive distortion, no busy festival synths, no brittle hi-hats, no overcompressed master",
    sourceNegative: "-EDM festival drops, -trap hi-hats, -hip hop beats, -aggressive synth leads, -distorted bass, -big room house, -future bass, -dubstep, -orchestral scoring, -cinematic trailer music, -lo-fi hip hop beats, -tropical house drops, -slap bass funk, -hardstyle kicks, -techno stabs, -psytrance leads, -brostep growls, -festival risers, -trap snares, -reggaeton dembow, -heavy metal guitars, -arena rock drums, -abrasive lead vocals, -hyperpop glitches, -EDM supersaw drops, -marching percussion, -epic choir hits, -trailer braams",
    metatags: ["[Warm sunset intro]", "[Soft Balearic groove]", "[Airy vocal]", "[Oceanic instrumental break]", "[Golden-hour final chorus]"]
  },
  Enigma: {
    accent: "violet",
    genre: "Enigma Style, ethereal world-electronic downtempo",
    presets: ["Gregorian sacred (MCMXC)", "Ethnic (Cross of Changes)", "Cinematic distorted (Screen)", "Ethereal ambient", "Modern (Voyageur)", "Breakbeat drive"],
    // Rebased 2026-07-14 to album tempo. The catalogue sits at 78-100 BPM; the
    // 118-140 BPM versions are club remixes. The upper bands exist for the later
    // instrumental/orchestral eras (A Posteriori, Seven Lives), not for remixes.
    phases: [
      "Slow Tempo 78-84 BPM, low energy.",
      "Mid-low Tempo 84-90 BPM, low energy.",
      "Mid-low Tempo 88-94 BPM, low to medium energy.",
      "Mid Tempo 92-100 BPM, medium energy.",
      "Mid Tempo 100-108 BPM, medium energy.",
      "Mid-high Tempo 108-118 BPM, medium energy."
    ],
    pads: [
      "Dark analogue pads layered with rich ambient textures and slow evolving harmonic beds.",
      "Warm analogue pads layered with rich ambient textures and evolving harmonic layers.",
      "Warm analogue pads layered with ambient textures and soft orchestral string beds for expanded depth.",
      "Warm analogue pads layered with clean ambient textures and smooth evolving harmonic support.",
      "Morphed ethereal choir pads blended with ambient textures and slow evolving harmonic layers."
    ],
    harmony: [
      "Built on a clear minor-key progression moving from verse into a lifting chorus.",
      "A modal minor chord cycle giving the track a defined verse-chorus shape.",
      "Moving through a warm minor progression with a resolving turnaround each cycle.",
      "A minor chord cycle with a lifting pre-chorus and a strong hook resolution."
    ],
    bass: [
      "Deep sub bass or slow analogue bass with minimal movement supporting a hypnotic low-end foundation.",
      "Warm analogue bass or sub bass with a steady rhythmic pulse and subtle melodic movement.",
      "Warm analogue bass or sub bass with smooth rhythmic movement and a controlled low-end presence.",
      "Warm analogue or sub bass with a steady controlled pulse and defined low-end presence.",
      "Warm analogue or sub bass with rhythmic movement and subtle melodic phrasing supporting the groove."
    ],
    rhythm: [
      "Soft electronic and tribal drums using a hypnotic pulse groove.",
      "Soft electronic and tribal drums using a ritual pulse groove.",
      "Soft electronic and tribal drums using a flowing tribal groove.",
      "Soft electronic drums using a controlled pulse groove.",
      "Minimal pulse drums using a sparse ambient rhythmic foundation.",
      "Breakbeat-style drums with a laid-back hip-hop groove."
    ],
    percussion: ["Sparse percussion with tribal acoustic percussion textures.", "Moderate percussion with hybrid electronic + tribal textures.", "Layered percussion with breakbeat kit textures."],
    motifs: [
      "Breathy shakuhachi flute motifs with expressive phrasing and gentle repetition.",
      "Short melodic motif with gentle repetition acting as a subtle hook element.",
      "Gregorian chant fragments used as rhythmic and atmospheric motif elements.",
      "Morphed ethereal choir pads blended with ambient textures and slow evolving harmonic layers.",
      "Bell and chime accents with soft tonal decay and spatial depth.",
      "Reversed tonal swells and ambient textures creating atmospheric transitions."
    ],
    movement: [
      "Deep spatial reverb with cathedral-like ambience, long delay trails and subtle stereo movement.",
      "Wide stereo field with rhythmic delay, spatial reverb and evolving modulation movement.",
      "Wide stereo field with smooth spatial reverb, controlled delay and subtle modulation movement.",
      "Wide stereo field with deep spatial layering, rhythmic delay and evolving modulation movement.",
      "Wide stereo field with rhythmic delay, controlled reverb and subtle modulation movement."
    ],
    negatives: "no parody monk chants, no cartoon mysticism, no metal guitars, no bright pop-punk drums, no comic gothic effects",
    sourceNegative: "-EDM drops, -festival house, -big room, -future bass, -dubstep, -trap hi-hats, -hip hop beats, -aggressive synth leads, -distorted bass, -cinematic trailer music, -orchestral hits, -fast tempo, -high energy dance music, -rock guitars, -pop vocal hooks, -belting vocals, -anthem choruses",
    metatags: ["[Gregorian-style texture]", "[Whispered chant layer]", "[Hypnotic pulse]", "[Ritual bridge]", "[Atmospheric outro]"]
  },
  Delerium: {
    accent: "muted aqua",
    genre: "atmospheric vocal electronica, midtempo",
    presets: ["Silence Core", "Underwater Flow", "Afterall Lift", "Dark Alternative", "Textural Blend"],
    phases: [
      "Delerium electronic sacral profile, midtempo 114-120 BPM, steady electronic groove with natural variation, soft kick and snare backbeat, minor-key, suspended/add9 chords, wide reverberant space.",
      "Delerium fluid electronic profile, midtempo 114-118 BPM, smooth electronic groove, soft kick and snare backbeat, minor-key suspended chords, diffused space and low-contrast motion.",
      "Delerium modern emotional profile, midtempo 116-122 BPM, structured electronic groove with natural movement, soft kick and snare backbeat, polished minor-key suspended harmony.",
      "Delerium melodic lift profile, midtempo 114-120 BPM, steady electronic groove, suspended/add9 harmony with subtle modal brightness, wide reverb field."
    ],
    pads: [
      "electronic atmospheric style with subtle ambient trance influence, not downtempo, structured groove maintained. dense layered soundscape, pads, choir and textures fully blended, no isolated instruments.",
      "balanced choir and pad mass with lighter upper-air movement, blended textures and soft synthetic shimmer, still fully merged into a unified field.",
      "dense layered soundscape with pads, choir and textures supporting a clearer lead presence, still embedded in the field, not pop-forward or dry.",
      "darker tonal shading, cathedral depth, heavier low-mid density, haunting choir wash and shadowed pad mass, fully blended rather than performed."
    ],
    bass: ["tempo held within 112-116 BPM, no perceived tempo shift.", "tempo held within 114-118 BPM, no perceived tempo shift.", "tempo held within 116-120 BPM, no perceived tempo shift.", "tempo held within 118-122 BPM, no perceived tempo shift."],
    rhythm: [
      "simple repeating melodic motif, emotive and smooth, gently memorable without rhythmic emphasis.",
      "clear repeating melodic motif in upper layers, slightly more memorable and uplifted, still smooth and non-percussive.",
      "melodic content remains atmospheric and understated, no obvious hook emphasis."
    ],
    percussion: [
      "female vocal sustained, legato, layered and embedded, primary line smooth with low supporting textures.",
      "female vocal sustained, legato, slightly forward and emotionally expressive, still embedded in reverb.",
      "male vocal layer, chant-like, deep and blended into the harmonic field, never dominant.",
      "layered male and female vocals, female carries air and tone, male provides depth, unified delivery, no duet behaviour."
    ],
    motifs: [
      "layered choir bloom, wide stereo spread, slow attack, harmonic lift in chorus, no transient emphasis.",
      "glassy pad layers, slow modulation, airy shimmer, no brightness spikes.",
      "subtle sub pulse, low-frequency support, stable and constant, no rhythmic variation.",
      "soft piano tones and sustained string-like warmth blended into the pad mass, no percussive attack."
    ],
    movement: [
      "continuous harmonic evolution, no static looping, gradual tonal shifts.",
      "subtle stereo expansion and contraction, evolving width, no abrupt changes.",
      "elements gradually enter and dissolve, no hard transitions."
    ],
    negatives: "no hard trance supersaws, no aggressive club drop, no novelty vocals, no dry rock drums, no crowded arrangement",
    sourceNegative: "no ambient downtempo, no beatless ambient, no minimal rhythm, no loose groove, no weak backbeat, no sparse percussion, no thin mix, no orchestral scoring, no acoustic realism, no modern pop",
    metatags: ["[Ethereal vocal]", "[Sacral harmony]", "[Underwater ambience]", "[Layered emotional lift]", "[Ambient breakdown]"]
  },
  Era: {
    accent: "warm sand/gold",
    genre: "sacred cinematic choral",
    presets: ["Sacral Choir", "Orchestral Cinematic", "Luminous Atmos", "Ethnic Texture", "Vocal Forward"],
    phases: [
      "ERA sacred cinematic profile, ceremonial midtempo pulse, modal minor harmony, monumental choir-led field, restrained electronic and acoustic hybrid percussion.",
      "ERA cinematic sacred profile, broader ceremonial pulse, modal minor harmony, choir mass and dramatic but controlled low-mid weight.",
      "ERA luminous sacred profile, lighter ceremonial pulse, modal harmony with restrained brightness, choir-led atmosphere and uplift.",
      "ERA sacred world-cinematic profile, ceremonial pulse with soft ethnic texture, modal harmony, monumental choir field.",
      "ERA emotional ceremonial profile, clearer lead presence over monumental choir bed, controlled pulse and sacred grandeur."
    ],
    pads: ["tempo held within 96-102 BPM, ceremonial pace.", "tempo held within 100-106 BPM, controlled lift and procession.", "tempo held within 104-112 BPM, stronger ceremonial drive without trailer excess."],
    bass: ["melodic development remains atmospheric, ceremonial and understated.", "simple ceremonial motif repeats across sections, memorable but not pop-like.", "clear repeating sacred hook line in upper choir or lead layer, still smooth and processional."],
    rhythm: ["massed choir dominates, dense chant-led field, no intimate pop lead.", "female lead floats above choir bed, embedded not dry, choir retains scale.", "male chant or baritone texture leads the sacred field, monumental and blended.", "male and female layers unified with choir, broad sacred wall, no duet exchange."],
    percussion: ["full-spectrum sacred wall, choir and pad mass fill the field, restrained instrument separation.", "grand layered sacred field, stronger low-mid weight, broad choir and pad scale, still controlled.", "monumental choir wall, dense ceremonial layering, maximum scale without trailer hits."],
    motifs: ["expanding choir bloom with broad stereo spread and slow ceremonial rise.", "submerged string swells blended into the sacred mass, no isolated performance.", "soft bell tones and airy upper shimmer supporting the sacred hook.", "subtle ethnic texture and distant percussion colouring the atmosphere, no dominance."],
    movement: ["gradual build and release through ceremonial layering, no abrupt transitions.", "steady ceremonial pulse with slow harmonic unfolding and broad spatial rise.", "processional movement with lighter uplift, gentle expansion and release."],
    negatives: "no modern trap hats, no harsh dubstep bass, no hyperpop gloss, no novelty Gregorian effects, no excessive brightness",
    sourceNegative: "no trailer bombast, no EDM, no pop chorus, no hyper-modern synth pop, no thin choir, no dry percussion, no harsh transients, no cinematic impact hits, no bright plucks, no trap hats",
    metatags: ["[Downtempo intro]", "[Trip-hop pulse]", "[Breathy vocal]", "[Wide atmospheric break]", "[Soft cinematic outro]"]
  }
};

const VOCAL_MODES = ["Instrumental", "Descriptor", "Persona"];

/* Vocal descriptor pools, keyed by vocal gender. Used by the Descriptor vocal
 * mode: the gender select lists the keys, the descriptor select lists that
 * key's array. Delivery/timbre wording only (materially steers the vocal);
 * mood/affect words are intentionally avoided (Suno ignores them). The first
 * Female entry matches the default state so it stays selected on first load. */
const VOCAL_DESCRIPTOR_OPTIONS = {
  Female: [
    "Airy female vocal with intimate tone and restrained delivery.",
    "Breathy female vocal, close-mic, soft and hushed.",
    "Warm female vocal with smooth legato phrasing.",
    "Husky female vocal with relaxed low register.",
    "Clear female vocal with controlled dynamics and gentle vibrato.",
    "Ethereal layered female vocal with wide reverb and soft harmonies."
  ],
  Male: [
    "Warm male vocal with intimate low-register delivery.",
    "Breathy male vocal, close-mic, soft and restrained.",
    "Smooth male vocal with relaxed legato phrasing.",
    "Deep male vocal with calm controlled tone.",
    "Clear male vocal with gentle dynamics and subtle grain.",
    "Layered male vocal with wide reverb and soft harmony stacks."
  ],
  Androgynous: [
    "Androgynous vocal with soft neutral timbre and restrained delivery.",
    "Breathy androgynous vocal, close-mic and hushed.",
    "Smooth androgynous vocal with even legato phrasing.",
    "Ethereal androgynous vocal with wide reverb and layered harmonies."
  ],
  Duet: [
    "Male and female duet, unified blend with female carrying the top line.",
    "Male and female harmony pairing, close and layered, no call-and-response.",
    "Layered mixed-gender vocal wash blended into the atmosphere."
  ]
};

Object.assign(window.__ATMOS, { MAX_MODE_STR, MASTERING, STYLE_ENGINES, VOCAL_MODES, VOCAL_DESCRIPTOR_OPTIONS });
})();

/* legacy/engine-extras.js */
(function(){
/*
 * engine-extras.js
 * ----------------------------------------------------------------------------
 * Option A add-on layer for the unified Suno prompt tool.
 *
 * The base tool (data-style-engines.js + data-lyric-controls.js) stays exactly
 * as it is. This file sits ON TOP and holds the per-engine "richness" that only
 * Balearic has fully authored today. Every other engine is present as an empty
 * shelf with the same shape, so the batch generator can read them all the same
 * way and simply skip the parts that are empty.
 *
 * Each engine holds five things:
 *   moodBundles        - preset buttons; picking one pre-fills a coherent set of
 *                        musical choices, and may optionally tweak the keep-out
 *                        list for that mood only
 *   flavourClusters    - the richer-instrument / influence-flavour layer: a set
 *                        of distinct "sound fingerprints" that feed the slot
 *                        system. A diversity engine (variety within the genre),
 *                        NOT a fidelity engine. Source labels are internal
 *                        scaffolding only and never enter a Suno payload.
 *   synonymBank        - stock phrases with alternates, rotated across a batch so
 *                        ten generated prompts don't read identically
 *   refTracks          - real reference songs used as quality yardsticks
 *
 * KEEP-OUT LAYERING (the per-mood / per-cluster override mechanic):
 *   effective keep-out = (entry.bannedAdd)
 *                        minus entry.bannedRemove
 *   Both bannedAdd and bannedRemove default to empty, so until an entry is
 *   deliberately tuned it behaves identically to the single shared list.
 *
 * SLOTS ARE THE SINGLE SOURCE OF TRUTH for instrumentation. Each instrument is
 * named exactly once, in its slot. Tempo/feel never carries instruments, and
 * artist/brand names never enter a payload (Suno strips them anyway).
 *
 * PAYLOAD FORMAT: the builder renders these slots as ONE comma-separated
 * descriptor line, ordered genre -> BPM -> rhythm feel -> harmony ->
 * instruments -> production -> vocal. (Format decision, 2026-06-27.)
 *
 * NOTE: lyric-shaping layers (lyric density, story mode) are intentionally NOT
 * here. They are generic and live in the lyric-controls layer, not per-engine.
 * ----------------------------------------------------------------------------
 */

const EngineExtras = {

  Balearic: {

    // Interaction/arrangement language is mandatory in the style string for this
    // engine (standing project rule) — it is no longer an optional toggle.
    interplayAlways: true,

    // Shared keep-out list for the whole Balearic genre.

    moodBundles: {
      melancholic: {
        bpm: 85,
        harm: "minor7",
        drum: "brushed",
        bass: "fm",
        textures: ["fender-rhodes", "detuned-pads", "strings", "field-rec"],
        artists: ["Bonobo", "Air"],
        bannedAdd: [],     // extra keep-outs just for this mood
        bannedRemove: []   // items from the shared list this mood is allowed to use
      },
      euphoric: {
        bpm: 95,
        harm: "major9",
        drum: "congas",
        bass: "fretless",
        textures: ["fender-rhodes", "nylon-guitar", "vocal-pad", "field-rec"],
        artists: ["Zero 7", "Bonobo"],
        bannedAdd: [],
        bannedRemove: []
      },
      dark: {
        bpm: 90,
        harm: "dorian",
        drum: "electronic",
        bass: "fretless",
        textures: ["vinyl", "dub-delay", "detuned-pads", "prepared-piano"],
        artists: ["Chromatics", "Nicolas Jaar"],
        bannedAdd: [],
        bannedRemove: []
      },
      meditative: {
        bpm: 78,
        harm: "onechord",
        drum: "nearbeat",
        bass: "drone",
        textures: ["detuned-pads", "strings", "field-rec", "prepared-piano"],
        artists: ["Olafur Arnalds", "Nicolas Jaar"],
        bannedAdd: [],
        bannedRemove: []
      },
      golden: {
        bpm: 98,
        harm: "mixo",
        drum: "brushed",
        bass: "fm",
        textures: ["nylon-guitar", "fender-rhodes", "detuned-pads", "vinyl"],
        artists: ["Khruangbin", "Max Essa"],
        bannedAdd: [],
        bannedRemove: []
      }
    },

    /*
     * flavourClusters - the richer-instrument / influence-flavour layer.
     * VALIDATED in Suno 2026-06-27: all 8 generated audibly distinct tracks
     * while still reading as Balearic. No longer provisional.
     *
     * Each cluster is a slot fingerprint. `source` is INTERNAL scaffolding only
     * (the real act a fingerprint was mined from) and must NEVER be written to a
     * payload. Drums/percussion are named only in `rhythm`; melodic/harmonic
     * instruments only in `roles`; nothing is named twice.
     *
     * ROLE-POOL MODEL (2026-06-28 decision, implemented here):
     * `instruments` (flat array) is replaced by `roles` - named slots, each
     * holding several cluster-valid options. The builder draws ONE option per
     * populated role per generated song, so a single cluster yields many
     * distinct-sounding combinations instead of one fixed instrument set.
     * Every option in a pool is pre-vetted for the cluster's register, so a
     * random draw varies the texture without drifting out of character.
     *
     * Roles used (a cluster only defines the roles that make sense for it):
     *   lead      - the one melodic/foreground voice. Exactly one draw, by
     *               design, so melodic voices never compete for attention.
     *   harmony   - chordal/pad bed (instrument, not the chord-type wording
     *               in the `harmony` string field above).
     *   bass      - low end.
     *   texture   - ambient/atmospheric layers with no clear pitch center.
     *
     * Each lead-pool entry is written with a restraining qualifier where the
     * raw instrument name alone would skew bright/festive/foreground (see the
     * Mediterranean fix below) - framing (motif/texture vs. lead) is treated
     * as part of the instrument choice, not an afterthought.
     */
    flavourClusters: {
      organic: {
        label: "Organic warm downtempo",
        band: "84-96", bpm: 90, beatless: false, colorChance: 0.5,
        phase: "mid chill, 84-96 BPM, low-medium energy", energy: "low-medium energy",
        palettes: {
          electronic: {
            pads: ["Warm analogue synth pads layered with soft harmonic synth layers","Lush analogue pads blended with rich evolving tonal layers","Textured polysynth layers with analogue warmth and gentle modulation movement"],
            harmony: ["moving through warm minor-seventh voicings in a loose two-chord vamp across an eight-bar cycle","built on extended minor-ninth chord voicings with a soft turnaround resolving each cycle","a modal Dorian chord cycle looping steadily without a pop chorus lift"],
            bass: ["Electric bass guitar with warm rounded tone and flowing groove","Fretless bass groove with smooth melodic movement","Deep sub bass providing weight and low-end warmth"],
            rhythm: ["Natural brushed drums with organic percussion including congas, shakers and hand percussion","Live acoustic drums with a soft natural feel, subtle groove and light ghost notes, layered with organic percussion","Minimal downtempo groove with soft kick, brushed snare and light percussion textures"],
            perc: ["a tabla pattern ticking beneath the kit","light tambourine and cabasa accents threading the groove"],
            strings: ["Subtle string textures supporting the harmonic space","Soft layered strings blended underneath the pads for depth"],
            texture: ["a warm Hammond organ bed sustaining beneath the chords","a soft mellotron choir layer drifting under the harmony"],
            motif: ["Rhodes electric piano motifs with warm chord movement and melodic phrasing","Arpeggiated synth leads weaving through the mix with evolving rhythmic motion","Clean nylon guitar motifs with soft rhythmic strumming drifting in and out of the mix","Restrained soft soprano-sax lines with warm breathy phrasing drifting through the mix"],
            counter: ["a plucked bouzouki counter-figure weaving against the motif","a soft clavinet counter-line answering the lead"],
            color: ["an occasional melodica phrase answering in a gap","a brief hang drum figure surfacing between phrases","a short harp flourish drifting through the space"],
            movement: ["Rhythmic autopan and modulation creating groove-based movement across percussion and melodic elements","Wide stereo panning movement across pads and motifs using left-right automation and slow modulation","Delay-driven movement using tempo-synced echoes and cascading repeats creating evolving rhythmic space"]
          },
          acoustic: {
            pads: ["Warm loose Rhodes chords comping gently around the groove with soft jazz-tinged voicings", "Soft-strummed nylon guitar chords with warm natural resonance and gentle rhythmic movement", "Mellow marimba chord pads with rounded wooden tone and soft sustain", "Gentle Wurlitzer chord voicings with warm vintage character drifting under the mix"],
            bass: ["Warm upright bass walking in a loose organic groove with soft fingered articulation", "Soft-attack fretless upright bass gliding melodically beneath the harmony", "Fingerstyle rounded electric bass with warm woody tone and relaxed movement"],
            rhythm: ["Loose live hand-percussion broken-beat with brushed snare backbeat, congas and shakers breathing between hits", "Natural brushed drums with soft ghost-note snare, congas and hand percussion for an organic live feel", "Soft live kit with brushed snare, light rimwork and warm hand percussion textures"],
            strings: ["Soft-bowed layered strings swelling gently underneath the harmony for warmth and depth", "Distant soft brass pad adding warm mellow colour beneath the mix", "Mellow muted-guitar comping weaving lightly through the texture"],
            motif: ["Restrained soft flute lines with airy breathy phrasing drifting through the mix", "Understated mallet melody with warm rounded tone and gentle sustained notes", "Muted vibraphone motif with soft mallet phrasing and smooth melodic movement", "Gentle kalimba melody with delicate plucked tone and hypnotic repetition", "Breathy soft soprano-sax line with warm mellow tone and relaxed phrasing", "Soft slide-guitar motif with warm gliding phrasing drifting through the mix", "Warm grand-piano motif with soft rounded voicings and gentle melodic phrasing"],
            color: ["an occasional melodica phrase answering in a gap","a brief hang drum figure surfacing between phrases","a short harp flourish drifting through the space"],
            movement: ["Gentle ensemble dynamics rising and falling naturally as the arrangement breathes", "Soft tape-delay movement drifting melodic phrases through the mix", "Warm reverb space with the players easing in and out of the groove"]
          }
        },
        interplay: {
          conversation: ["lead and chords trading phrases in loose call-and-response","a counter-melody weaving beneath the lead and answering each phrase","the lead floating free while the chords comp around it"],
          foundation: ["bass and percussion locked in a loose broken-beat pocket with ghost notes between hits","the bass walking against the swing syncopated but relaxed"],
          arc: ["voices entering one at a time building organically with air around each","the groove ebbing and swelling then blooming back"]
        },
        bannedAdd: [], bannedRemove: []
      },
      cinematic: {
        label: "Lush cinematic chillout",
        band: "90-105", bpm: 96, beatless: false, colorChance: 0.5,
        phase: "mid chill, 90-105 BPM, medium energy", energy: "medium energy",
        palettes: {
          electronic: {
            pads: ["Lush analogue pads blended with rich synth textures and evolving tonal layers","Layered analogue pads combined with Pulse Pad Textures and soft harmonic synth layers","Cinematic synth pad swells with wide evolving harmonic layers"],
            harmony: ["built on suspended add9 voicings opening into a major-seventh resolution across long phrases","a slow minor-to-relative-major progression unfolding over eight-bar cycles","wide open sus2 chord voicings holding the harmony before a delayed resolve"],
            bass: ["Fretless bass groove with smooth melodic movement","FM bass with soft attack and subtle rhythmic pulse","Deep sub bass providing weight and low-end warmth"],
            rhythm: ["Minimal downtempo drum groove with soft kick, brushed snare and light percussion textures","Lounge/house drum kit with soft kick, clean snare and tight hi-hats, supported by light percussion"],
            perc: ["light shaker and triangle accents threading the groove","a soft frame-drum pulse beneath the kit"],
            strings: ["Slow string bed sitting deep in the mix","Soft layered strings blended underneath the pads for depth","Sweeping string textures rising and falling beneath the pads"],
            texture: ["a low pipe-organ layer sustaining beneath the harmony","a soft cor-anglais layer drifting under the chords"],
            motif: ["Rhodes electric piano motifs with warm chord movement and melodic phrasing","Arpeggiated synth leads weaving through the mix with evolving rhythmic motion","Soft piano motifs with gentle melodic phrasing drifting through the mix"],
            counter: ["a cello counter-melody answering the lead beneath the strings","a soprano-saxophone counter-line weaving against the motif"],
            color: ["an occasional glockenspiel accent shimmering above the chords","a brief flute line rising through a gap in the arrangement","a short tubular bell tone ringing beneath the harmony"],
            movement: ["Wide stereo panning movement across pads and motifs using left-right automation and slow modulation","Filter and modulation movement using LFO, chorus and phaser creating evolving tonal shifts across pads and textures"]
          },
          acoustic: {
            pads: ["Warm string-machine chords swelling slowly with lush cinematic depth", "Glossy electric-piano voicings with smooth sustained chord movement", "Soft harp glissando chords cascading gently through the harmonic space", "Lush bowed-string chord beds rising and falling beneath the melody", "Soft felt-piano chord voicings with intimate muted tone and gentle sustain"],
            bass: ["Bowed sustained upright bass holding long warm tones beneath the harmony", "Smooth fretless electric bass gliding melodically under the strings"],
            rhythm: ["Soft hybrid kit with a gentle brushed-snare shuffle and light orchestral percussion", "Brushed drums with delicate cymbal swells and soft timpani-style accents"],
            strings: ["Soft-focus sweeping strings rising in long cinematic phrases across the field", "Distant soft choir pad adding wordless warmth beneath the harmony", "Shimmering orchestral texture with gentle tremolo movement"],
            motif: ["Distant soft muted-horn swell with warm restrained phrasing", "Soft vibraphone melody with smooth sustained notes and cinematic space", "Delicate celeste melody with bell-like clarity drifting over the strings", "Restrained soft flugelhorn line with warm mellow expressive phrasing"],
            color: ["an occasional glockenspiel accent shimmering above the chords","a brief flute line rising through a gap in the arrangement","a short tubular bell tone ringing beneath the harmony"],
            movement: ["A slow cinematic dynamic swell rising to a lush peak then receding", "Orchestral crescendo movement building tension then releasing into open space", "Warm reverb space with sweeping string dynamics"]
          }
        },
        interplay: {
          conversation: ["lush harmony answering the lead in long cinematic phrases across the stereo field","the lead stating a motif and the harmony swelling up to meet and resolve it"],
          foundation: ["the bass sustaining long tones beneath the harmony anchoring without intruding"],
          arc: ["a slow dynamic arc with layers stacking toward a lush peak then receding","tension built through rising harmony and released into open sustained chords"]
        },
        bannedAdd: [], bannedRemove: []
      },
      analog: {
        label: "Dreamy analog electronic",
        band: "85-100", bpm: 92, beatless: false, colorChance: 0.5,
        phase: "low-mid chill, 85-100 BPM, low-medium energy", energy: "low-medium energy",
        palettes: {
          electronic: {
            pads: ["Textured polysynth layers with analogue warmth and gentle modulation movement","Warm analogue synth pads layered with Pulse Pad Textures and soft synth layers","Vintage analogue synth pads with slow evolving filter movement"],
            harmony: ["a hypnotic two-chord analogue vamp cycling with no chorus lift","held minor-ninth voicings drifting with slow chromatic inner movement","a one-chord modal centre with the harmony shifting only by inversion"],
            bass: ["FM bass with soft attack and subtle rhythmic pulse","Deep sub bass providing weight and low-end warmth","Plucky bass with warm analog character","Hybrid bass combining sub bass depth with mid-range melodic tone"],
            rhythm: ["Minimal downtempo drum groove with soft kick, electronic snare and light percussion textures","Simple steady programmed beat with soft kick and tight light percussion"],
            perc: ["light rimshot and shaker accents ticking under the beat","a soft tambourine pulse threading the groove"],
            strings: ["Subtle string textures supporting the harmonic space","Soft layered strings blended underneath the pads for depth"],
            texture: ["a slow string-machine layer sustaining beneath the chords","a soft harmonium bed breathing under the pads"],
            motif: ["Arpeggiated synth leads weaving through the mix with evolving rhythmic motion","Soft synth lead motifs with gentle melodic phrasing and analog character","Rhodes electric piano motifs with warm chord movement and melodic phrasing"],
            counter: ["a soft clavinet counter-figure ticking against the motif","a marimba counter-line weaving beneath the lead"],
            color: ["an occasional detuned chime accent surfacing between cycles","a brief plucked synth figure answering in the space","a short vintage organ chord swelling under the pads"],
            movement: ["Filter and modulation movement using LFO, chorus and phaser creating evolving tonal shifts across pads and textures","Phaser and chorus modulation creating slow evolving movement across synth layers"]
          },
          acoustic: {
            pads: ["Watery Rhodes-through-chorus chords with lush shimmering movement", "Soft mellotron-style pad chords with warm vintage tape character", "Vintage electric-piano voicings with gentle tremolo and warm sustain"],
            bass: ["Gliding fretless electric bass with smooth warm melodic movement", "Warm upright bass with soft rounded tone anchoring the harmony"],
            rhythm: ["Simple soft live kit with a brushed backbeat and light steady percussion", "Minimal live groove with soft brushwork and gentle hand percussion"],
            strings: ["Soft tape-saturated string layer with warm hazy analog character", "Distant bowed-string shimmer adding subtle movement beneath the pads"],
            motif: ["Soft vibraphone melody with smooth mallet phrasing and hypnotic repetition", "Restrained Wurlitzer accents with warm vintage tone drifting through the mix", "Delicate glockenspiel bell melody with bright clear tone and sparse phrasing", "Gentle music-box-style melody with fragile plucked tone and slow movement"],
            color: ["an occasional detuned chime accent surfacing between cycles","a brief plucked autoharp figure answering in the space","a short vintage organ chord swelling under the pads"],
            movement: ["Slow evolving dynamics with the arrangement breathing in and out", "Tape-delay shimmer drifting melodic fragments through the mix"]
          }
        },
        interplay: {
          conversation: ["a sustained lead drifting over a cycling figure in hypnotic interlock","lead and pads holding separate registers and gliding past each other"],
          foundation: ["the bass gliding smoothly and tied to the cycle above"],
          arc: ["layers phasing in and out with the texture evolving through subtraction as much as addition","a long unbroken cycle with tension held by what is withheld"]
        },
        bannedAdd: [], bannedRemove: []
      },
      dub: {
        label: "Dub-space downtempo",
        band: "90-105", bpm: 100, beatless: false, colorChance: 0.5,
        phase: "mid chill, 90-105 BPM, medium energy", energy: "medium energy",
        palettes: {
          electronic: {
            pads: ["Deep ambient pad layers with soft Pulse Pad Textures and evolving atmosphere","Warm analogue synth pads with dub-style space and depth"],
            harmony: ["a single modal chord centre held under the groove with dub-style harmonic stasis","a two-chord minor vamp cycling with heavy space between the changes","a Dorian one-chord vamp with the harmony implied by the bassline"],
            bass: ["Deep sub bass providing weight and low-end warmth","Hybrid bass combining sub bass depth with mid-range melodic tone","Dub bass with deep rounded tone and spacious movement"],
            rhythm: ["Minimal downtempo drum groove with soft kick, cross-stick snare and light percussion textures","Dub-influenced downtempo groove with soft kick, rim clicks and tabla-style hand percussion"],
            perc: ["udu and shaker accents drifting through the space","a woodblock pulse ticking between the beats"],
            strings: ["Subtle string textures supporting the harmonic space","Soft layered strings blended underneath the pads for depth"],
            texture: ["a sustained cello drone sitting beneath the groove","a slow flanged string layer drifting under the mix"],
            motif: ["Sparse Rhodes electric piano motifs drifting in and out of the mix","Soft synth lead motifs echoing through the mix with spacious phrasing","Clean guitar motifs with dub delay drifting through the mix","Spacious lap-steel slide guitar with dub delay gliding through the mix"],
            counter: ["a vibraphone counter-line answering the lead through the delay","a marimba counter-figure ticking against the motif","a breathy ney-flute counter-line drifting through the delay"],
            color: ["an occasional dub organ stab spinning off into the delay","an occasional clavinet skank chopping into the echo","a short hand-bell accent ringing away into the space"],
            movement: ["Delay-driven movement using tempo-synced echoes and cascading repeats creating evolving rhythmic space","Dub-style delay throws and spring reverb movement creating deep spacious motion"]
          },
          acoustic: {
            pads: ["Low steady harmonium drone holding a warm hypnotic harmonic centre", "Hazy detuned electric-piano chords with dub-style space and delay", "Hypnotic kalimba drone pattern with warm plucked repetition"],
            bass: ["Heavy sparse deep upright bass with rounded dub weight and long space between notes", "Rounded acoustic bass with dub delay throwing the low end into the reverb"],
            rhythm: ["Dub-tinged live groove with cross-stick snare, tabla hand percussion and heavy space", "Sparse hand-drum groove with rimshot accents and wide dub-style gaps"],
            strings: ["Warm bowed-string reverb tail drifting into the dub space", "Distant soft brass pad adding mellow colour beneath the drone"],
            motif: ["Distant soft muted trumpet with warm restrained phrasing echoing into the space", "Restrained bouzouki melodic line with bright plucked tone drifting in and out", "Breathy soft melodica melody with warm reedy tone and dub delay", "Gentle kora melodic line with delicate rippling plucked phrasing", "Sparse santoor melodic accents shimmering through the reverb"],
            color: ["an occasional dub organ stab spinning off into the delay","an occasional clavinet skank chopping into the echo","a short hand-bell accent ringing away into the space"],
            movement: ["Dub delay throws and spring reverb spinning melodic fragments into deep space", "Echoing tape-delay movement smearing phrases across the mix"]
          }
        },
        interplay: {
          conversation: ["melodic fragments drifting in and echoing away on long delay throws as a second voice","sparse stabs trading with their own delayed repeats in call-and-response"],
          foundation: ["bass and beat locked deep and sparse with the low end holding it together underneath"],
          arc: ["long stretches of space with single elements surfacing then dissolving","the mix opening and closing through dub drops"]
        },
        bannedAdd: [], bannedRemove: ["trumpet"]
      },
      nocturnal: {
        label: "Deep nocturnal Balearic",
        band: "96-108", bpm: 104, beatless: false, colorChance: 0.5,
        phase: "mid-high chill, 96-108 BPM, medium energy", energy: "medium energy",
        palettes: {
          electronic: {
            pads: ["Deep ambient pad layers with soft Pulse Pad Textures and evolving atmosphere","Dark analogue synth pads with slow evolving filter movement"],
            harmony: ["a dark minor chord cycle repeating without resolution","held minor-seventh voicings shifting slowly through chromatic inner movement","a one-chord hypnotic centre with the harmony moving only by inversion"],
            bass: ["Deep sub bass providing weight and low-end warmth","FM bass with soft attack and subtle rhythmic pulse"],
            rhythm: ["Minimal downtempo groove with soft four-on-the-floor kick, brushed snare and light percussion","Deep hypnotic groove with soft kick, light hats and sparse percussion textures"],
            perc: ["sparse rim and shaker accents ticking in the space","a low tom pulse beneath the kick"],
            strings: ["Subtle string textures supporting the harmonic space","Slow string bed sitting deep in the mix"],
            texture: ["a low pipe-organ drone sustaining under the pulse","a dark analogue sequence pulsing beneath the chords"],
            motif: ["Sparse synth stabs drifting through the mix with deep reverb","Soft Rhodes electric piano motifs with sparse phrasing and deep space","Sparse arpeggiated synth lead weaving slowly through the mix"],
            counter: ["a muted trumpet counter-line answering across the space","a mournful duduk counter-figure weaving beneath the lead"],
            color: ["an isolated celeste note surfacing then dissolving into the reverb","an occasional low bell tone ringing out into the space","a brief harp figure drifting faintly beneath the pulse"],
            movement: ["Filter and modulation movement using LFO and phaser creating slow evolving tonal shifts","Wide stereo panning movement across pads using left-right automation and slow modulation"]
          },
          acoustic: {
            pads: ["Dark sustained Rhodes chords holding long tones in deep space", "Sparse detuned electric-piano voicings with cold restrained movement", "Soft felt-piano chords holding sparse muted tones in deep space"],
            bass: ["Dark deep upright bass with sparse fingered notes and heavy space", "Sparse plucked contrabass sitting low and barely moving in the dark"],
            rhythm: ["Sparse soft brushed groove with wide space and restrained ghost-note snare", "Minimal live kit with soft brushwork and long silences between hits"],
            strings: ["Cold bowed-string wash drifting slowly beneath the harmony", "Sparse low bowed drone holding a dark sustained tone"],
            motif: ["Isolated slow muted-vibraphone note ringing out into the reverb", "Faint distant muted-horn tone surfacing then dissolving into space", "Distant faint music-box melody with fragile sparse phrasing"],
            color: ["an isolated celeste note surfacing then dissolving into the reverb","an occasional low bell tone ringing out into the space","a brief harp figure drifting faintly beneath the pulse"],
            movement: ["Deep restrained dynamics with long dark space between phrases", "Slow reverb swells drifting single notes into the dark"]
          }
        },
        interplay: {
          conversation: ["a single voice surfacing at a time isolated against deep space","sparse stabs hanging unanswered in the reverb with tension left unresolved"],
          foundation: ["the pulse anchoring steady while the bass barely moves beneath"],
          arc: ["almost no dynamic change with hypnosis built through repetition and restraint","tension sustained by what never arrives"]
        },
        bannedAdd: ["bright nylon guitar lead"], bannedRemove: []
      },
      sunlit: {
        label: "Sunlit Mediterranean",
        band: "96-108", bpm: 102, beatless: false, colorChance: 0.5,
        phase: "mid chill, 96-108 BPM, medium energy", energy: "medium energy",
        palettes: {
          electronic: {
            pads: ["Warm analogue synth pads layered with soft harmonic synth layers","Lush analogue pads blended with rich synth textures and evolving tonal layers"],
            harmony: ["warm major-seventh and add9 voicings moving through an unhurried eight-bar cycle","a Mixolydian chord vamp cycling gently with a soft turnaround","open sus2 voicings drifting between two chords with no chorus lift"],
            bass: ["Plucky bass with warm analog character","Electric bass guitar with warm rounded tone and flowing groove","Fretless bass groove with smooth melodic movement"],
            rhythm: ["Lounge/house drum kit with soft kick, clean snare and tight hi-hats, supported by congas, shakers and light percussion","Minimal downtempo groove with soft kick, clean snare and light percussion textures"],
            perc: ["a cajon and tambourine pulse threading the groove","light claves and shaker accents ticking through the beat"],
            strings: ["Subtle string textures supporting the harmonic space","Soft layered strings blended underneath the pads for depth"],
            texture: ["a warm Hammond organ bed sustaining beneath the chords","a soft harmonium layer breathing under the harmony"],
            motif: ["Clean nylon guitar motifs with soft rhythmic strumming drifting in and out of the mix","Rhodes electric piano motifs with warm chord movement and melodic phrasing","Soft acoustic guitar phrases with gentle rhythmic movement and natural flow","Warm lap-steel guitar melody with smooth gliding sunset phrasing","Restrained soft soprano-sax melody with warm breathy sunset phrasing"],
            counter: ["a bouzouki counter-line answering the lead","a warm flugelhorn counter-figure drifting over the groove"],
            color: ["a brief melodica phrase drifting warmly through a gap","a brief kalimba figure surfacing over the groove","a short vibraphone accent shimmering above the chords","an occasional carefree whistled melody drifting over the groove"],
            movement: ["Wide stereo panning movement across pads and motifs using left-right automation and slow modulation","Rhythmic autopan and modulation creating groove-based movement across percussion and melodic elements"]
          },
          acoustic: {
            pads: ["Sun-warmed Rhodes chords with soft warm voicings drifting under the melody", "Understated sustained classical-guitar chords with gentle fingered warmth", "Soft mandolin chord shimmer with bright delicate tremolo"],
            bass: ["Gentle warm upright bass rolling softly beneath the groove", "Rounded soft fretless bass with smooth melodic movement"],
            rhythm: ["Light bongos and shaker with a soft snare backbeat and gentle forward motion", "Warm live kit with congas, light percussion and a relaxed daytime feel"],
            strings: ["Sun-warmed soft strings adding gentle warmth beneath the harmony", "Light-touch string shimmer floating over the groove"],
            motif: ["Gentle airy pan-flute melody with soft breathy phrasing drifting through the mix", "Light warm marimba melody with rounded wooden tone and easy movement", "Softly fingerpicked nylon-guitar motif with warm delicate phrasing", "Soft restrained Wurlitzer melody with warm mellow tone and unhurried phrasing"],
            color: ["a brief melodica phrase drifting warmly through a gap","a brief kalimba figure surfacing over the groove","a short vibraphone accent shimmering above the chords","an occasional carefree whistled melody drifting over the groove"],
            movement: ["Warm afternoon dynamics rising and falling gently as the groove breathes", "Soft tape-delay drifting melodic phrases warmly through the mix"]
          }
        },
        interplay: {
          conversation: ["lead and chords trading warm phrases unhurried and conversational","a soft melody drifting over the chords answered now and then by a second voice"],
          foundation: ["bass and light percussion rolling forward in a gentle relaxed pocket"],
          arc: ["the arrangement staying open and breathing with warmth valued over busyness","restraint throughout with space over density"]
        },
        bannedAdd: ["Spanish guitar lead", "flamenco phrasing", "festive runs", "bright trumpet fanfare", "jaunty rhythm"],
        bannedRemove: []
      },
      ambient: {
        label: "Ambient / beatless atmospheric",
        genre: "Balearic ambient",
        band: "beatless", bpm: null, beatless: true, colorChance: 0.5,
        phase: "beatless, no drums, slow evolving atmosphere", energy: "low energy",
        palettes: {
          electronic: {
            pads: ["Deep ambient pad layers with soft Pulse Pad Textures and evolving atmosphere","Lush evolving analogue pads with slow morphing harmonic layers","Textured polysynth layers with analogue warmth and slow modulation movement"],
            harmony: ["harmonic stasis on a single sustained modal centre with change carried by timbre","slow-moving suspended voicings drifting with no cadence","a two-chord glacial harmonic cycle turning over long spans"],
            bass: ["Deep sub drone providing weight and low-end warmth","Sustained low synth drone underpinning the pads"],
            rhythm: [],
            strings: ["Slow string bed sitting deep in the mix","Soft layered strings blended underneath the pads for depth"],
            texture: ["a slow mellotron string layer drifting beneath the drone","a distant vibraphone shimmer sustaining in the field"],
            motif: ["Sparse soft synth tones drifting through the mix with deep reverb","Gentle bell-like synth tones with slow sparse phrasing"],
            counter: ["a viola counter-line rising slowly beneath the tones","a soft duduk counter-figure drifting through the space"],
            color: ["an occasional distant harp figure drifting through the field","a brief soft flute tone surfacing in the space","a short kalimba tone rippling faintly through the atmosphere"],
            movement: ["Filter and modulation movement using LFO, chorus and phaser creating slow evolving tonal shifts across pads and textures","Wide stereo panning movement across pad layers using left-right automation and slow modulation"]
          },
          acoustic: {
            pads: ["Slow-swelling soft choir pad with wordless warmth morphing over long spans", "Distant low organ-tone pad holding a sustained harmonic centre", "Warm bowed-string pad bed rising and falling in glacial swells"],
            bass: ["Deep sustained bowed drone holding the low register unmoving", "Low sustained cello drone underpinning the pads with warm weight"],
            rhythm: [],
            strings: ["Slow string bed sitting deep in the mix with soft evolving movement", "Soft layered bowed strings drifting slowly beneath the pads"],
            motif: ["Distant sparse piano tones ringing out with deep reverb and long decay", "Sparse slow bell tones surfacing gently through the atmosphere", "Isolated soft glass-harmonica tone shimmering faintly in the space"],
            color: ["an occasional distant harp figure drifting through the field","a brief soft flute tone surfacing in the space","a short kalimba tone rippling faintly through the atmosphere"],
            movement: ["Glacial dynamic swells breathing in and out over long spans", "Slow reverb morphing the layers so change is felt rather than heard"]
          }
        },
        interplay: {
          conversation: ["tones emerging and receding without hierarchy each layer equal in the field","voices cross-fading into one another with melody dissolved into texture"],
          foundation: ["the low register holding a single harmonic centre with everything suspended above"],
          arc: ["glacial evolution with the texture morphing so slowly change is felt rather than heard","harmonic stasis with motion replaced by the slow turn of timbre"]
        },
        bannedAdd: ["drum kit", "kick drum", "congas", "bongos", "shaker", "hand percussion", "four-on-the-floor"],
        bannedRemove: []
      },
      triphop: {
        label: "Moody trip-hop downbeat",
        band: "82-92", bpm: 86, beatless: false, colorChance: 0.5,
        phase: "low-mid chill, 82-92 BPM, low-medium energy", energy: "low-medium energy",
        palettes: {
          electronic: {
            pads: ["Detuned analogue synth pads with hazy evolving tonal layers","Textured polysynth layers with analogue warmth and gentle modulation movement"],
            harmony: ["a hazy minor-seventh loop cycling behind the beat with no chorus lift","a two-chord vamp with flattened blues-inflected voicings","a Dorian chord loop drifting slightly detuned beneath the groove"],
            bass: ["Deep sub bass providing weight and low-end warmth","Hybrid bass combining sub bass depth with mid-range melodic tone"],
            rhythm: ["Lounge/downtempo drum kit with heavy swung kick, fat snare on the backbeat and tight hi-hats","Trip-hop drum groove with lazy swung kick, deep snare and light percussion textures"],
            perc: ["a tambourine and shaker pulse dragging behind the beat","light rim and woodblock accents ticking under the groove"],
            strings: ["Subtle string textures supporting the harmonic space","Soft layered strings blended underneath the pads for depth"],
            texture: ["a dusty mellotron string layer smeared under the beat","a low harmonium bed sustaining beneath the groove"],
            motif: ["Rhodes electric piano motifs with hazy detuned chord movement","Vibraphone phrases with smooth sustained notes and gentle movement","Sparse synth lead motifs drifting through the mix with analog saturation"],
            counter: ["a smoky tenor-saxophone counter-line drifting against the lead","a sitar counter-figure weaving hazily behind the beat"],
            color: ["an occasional dusty organ stab surfacing behind the beat","a brief harmonica phrase smeared through the delay","a short flute line drifting hazily above the groove"],
            movement: ["Filter and modulation movement using LFO, chorus and phaser creating evolving tonal shifts across pads and textures","Delay-driven movement using tempo-synced echoes creating evolving rhythmic space"]
          },
          acoustic: {
            pads: ["Hazy detuned Rhodes chords with warm dusty vintage tone", "Warm vintage electric-piano voicings with smoky detuned movement"],
            bass: ["Heavy upright bass with dark woody tone anchoring the swung groove", "Thick plucked contrabass sitting deep behind the beat"],
            rhythm: ["Heavy lazy swung live kit with a fat snare backbeat and dusty broken-beat feel", "Dusty broken-beat groove with rimshot accents, brushed snare and heavy head-nod"],
            strings: ["Smoky bowed-string tail drifting darkly beneath the beat", "Distant muted-brass pad adding moody colour to the mix"],
            motif: ["Muted distant brass stabs surfacing hazily above the beat", "Slow detuned vibraphone motif with warm smeared phrasing", "Hazy muted-trumpet line drifting loosely behind the rhythm", "Restrained muted electric-guitar motif with dark reverbed tone"],
            color: ["an occasional dusty organ stab surfacing behind the beat","a brief harmonica phrase smeared through the delay","a short flute line drifting hazily above the groove"],
            movement: ["Dark dusty dynamics with analog swells smearing into the reverb", "Tape-delay movement smearing melodic fragments across the beat"]
          }
        },
        interplay: {
          conversation: ["melodic fragments floating detached above the beat never quite locking to it","the lead drifting loose over the rhythm deliberately behind and hazy"],
          foundation: ["a heavy swung beat anchoring everything fat and deliberately lazy"],
          arc: ["the arrangement layering in collage fashion with elements dropping in and out","wide space between hits giving the groove room to breathe"]
        },
        bannedAdd: [], bannedRemove: ["brass stabs", "trumpet"]
      },
      balearic_house: {
        label: "Balearic house",
        genre: "Balearic house",
        band: "118-124", bpm: 122, beatless: false, colorChance: 0.5,
        phase: "club groove, 118-124 BPM, high energy", energy: "high energy",
        palettes: {
          electronic: {
            pads: ["Warm analogue house pads with bright uplifting chords","Lush Balearic synth pad stabs with rich harmonic movement","Classic house chord stabs with warm analog tone"],
            harmony: ["bright major-seventh and ninth chord stabs cycling an eight-bar progression with a lifting turnaround","a minor-to-major progression looping through verse and peak sections","classic house chord voicings moving through a four-chord cycle with a clear lift"],
            bass: ["Heavy electric slap bass with funky rhythmic groove","Deep house bassline with warm rounded analog tone","Punchy slap-bass groove driving the track forward"],
            rhythm: ["Four-on-the-floor house drum machine groove with crisp hi-hats and clap on the backbeat","Classic house beat with punchy kick, snappy claps and open hi-hats","TR-909 house groove with tight kick, crisp hats and shakers"],
            perc: ["bongos and cowbell accents driving under the kick","timbale and shaker accents lifting the groove"],
            strings: ["Bright disco string stabs supporting the groove","Subtle string textures lifting the harmonic space"],
            texture: ["a warm string-machine layer sustaining under the stabs","a soft Juno-style layer lifting beneath the chords"],
            motif: ["Prominent house piano riff with bright rhythmic chord stabs","Uplifting piano chord progression riff driving the track","Acoustic guitar phrases with rhythmic Balearic strumming","Sunlit synth-stab riff weaving through the groove"],
            counter: ["a funky clavinet counter-riff answering the lead","a plucked synth counter-line dancing against the riff"],
            color: ["an occasional organ stab punching through the groove","a brief steel-pan accent lifting a bar","a short vocal-chop stab lifting the turnaround"],
            movement: ["House-style filter sweeps opening and closing across the pads","Rhythmic gating and filter movement driving the groove","Wide stereo automation across the chord stabs and riffs"]
          },
          acoustic: {
            pads: ["Warm live Wurlitzer chord voicings with bright rhythmic stabs driving the groove", "Sun-warmed nylon-guitar chord strumming with rhythmic Balearic movement", "Warm Rhodes chord stabs punctuating the four-on-the-floor groove"],
            bass: ["Funky electric slap bass with live percussive articulation and driving groove", "Warm fingerstyle electric bass locking a funky rhythmic house groove"],
            rhythm: ["Live-feel house groove with congas, tambourine and hand percussion over a steady four-on-the-floor kick", "Organic house beat with live percussion, shakers and a punchy driving kick"],
            strings: ["Warm live string-section stabs lifting the groove with bright energy", "Soft layered strings adding warmth beneath the chord stabs"],
            motif: ["Bright live piano riff with rhythmic chord stabs driving the track forward", "Rhythmic acoustic-guitar Balearic strumming weaving through the groove", "Warm marimba riff with rounded wooden tone dancing over the beat"],
            color: ["an occasional organ stab punching through the groove","a brief steel-pan accent lifting a bar","a short vocal-chop stab lifting the turnaround"],
            movement: ["Live percussion breaks and rising dynamics building into the drop", "Hand-played fills and rolls lifting the groove into a full-energy peak"]
          }
        },
        interplay: {
          conversation: ["the riff and chord stabs trading rhythmic phrases over the groove","the lead riff answering the bassline in call-and-response"],
          foundation: ["slap bass and four-on-the-floor kick locked tight and driving"],
          arc: ["the groove building through added percussion toward an open peak","filtered intro opening up into a full-energy drop"]
        },
        bannedAdd: [], bannedRemove: []
      },
      nu_disco: {
        label: "Nu-disco / slo-mo disco",
        genre: "nu-disco, slo-mo disco",
        band: "100-112", bpm: 108, beatless: false, colorChance: 0.5,
        phase: "chugging disco groove, 100-112 BPM, medium-high energy", energy: "medium-high energy",
        palettes: {
          electronic: {
            pads: ["Cosmic analog synth pads with retro-futuristic warmth","Lush disco synth chords with evolving tonal layers","Warm string-machine pads with cosmic shimmer"],
            harmony: ["minor-seventh and ninth voicings chugging through a four-chord disco cycle","a two-chord cosmic vamp with a syncopated harmonic push","extended thirteenth voicings cycling with a disco turnaround"],
            bass: ["Thick driving disco bassline with funky octave movement","Chugging analog bass with steady rhythmic pulse","Deep funky synth bass locking the groove"],
            rhythm: ["Steady disco drum groove with four-on-the-floor kick, crisp hats and tambourine","Slo-mo disco beat with punchy kick, claps and shakers","Chugging disco kit with tight hats and live-feel percussion"],
            perc: ["cowbell and shaker accents chugging under the kick","bongos and woodblock ticking through the groove"],
            strings: ["Sweeping cosmic disco strings rising over the groove","Lush disco string stabs punctuating the rhythm"],
            texture: ["a soft Juno-style layer sustaining under the chug","a mellotron string bed humming beneath the groove"],
            motif: ["Modern synth arpeggios cycling through the mix","Funky rhythm guitar with tight percussive chords","Cosmic synth lead with retro-futuristic phrasing","Bright clavinet funk riff driving the groove"],
            counter: ["a bright marimba counter-line dancing against the riff","a plucked synth counter-figure answering the lead"],
            color: ["an occasional vocoder-style synth phrase weaving through the chug","a brief brass-section stab punching the turnaround","a short organ riff lifting the groove"],
            movement: ["Cosmic filter sweeps and phaser movement across synths and strings","Rhythmic autopan and modulation driving the chug","Wide stereo automation across arpeggios and pads"]
          },
          acoustic: {
            pads: ["Warm live electric-piano chords with funky rhythmic comping", "Funky rhythm-guitar chord comping with tight percussive strumming"],
            bass: ["Thick funky electric bass with driving octave movement and live feel", "Warm fingerstyle disco bass groove locking the chug"],
            rhythm: ["Live disco kit with four-on-the-floor kick, tambourine, congas and crisp hats", "Organic disco groove with live percussion, claps and steady driving hats"],
            strings: ["Lush live disco string section sweeping over the groove", "Warm string stabs punctuating the funky rhythm"],
            motif: ["Funky rhythm-guitar riff with tight percussive wah-inflected chords", "Bright clavinet funk riff with punchy rhythmic bite driving the groove", "Warm Rhodes lead with disco phrasing weaving through the mix"],
            color: ["an occasional brass-section stab punching the turnaround","a brief organ riff lifting the groove","a short vibraphone accent dancing over the chug"],
            movement: ["Live percussion drive with dynamic build-ups lifting the groove", "Hand-played funk dynamics chugging steadily across the track"]
          }
        },
        interplay: {
          conversation: ["the lead and rhythm parts interlocking in a tight funk weave","the lead and chords trading phrases over the chug"],
          foundation: ["thick bass and four-on-the-floor kick chugging steady and driving"],
          arc: ["the groove chugging steadily with cosmic layers phasing in and out","tension built through filtered synths opening over the drive"]
        },
        bannedAdd: [], bannedRemove: []
      },
      melodic_deep_house: {
        label: "Melodic deep house",
        genre: "melodic deep house",
        band: "120-124", bpm: 122, beatless: false, colorChance: 0.5,
        phase: "deep house groove, 120-124 BPM, medium-high energy", energy: "medium-high energy",
        palettes: {
          electronic: {
            pads: ["Lush emotional synth chords with warm evolving movement","Deep warm analog pads with atmospheric depth","Rich evolving synth chord layers with soft harmonic swell"],
            harmony: ["a minor-ninth chord progression cycling through an eight-bar build","a suspended add9 chord cycle rising toward a peak and resolving back","an extended minor-seventh progression looping with a lifting turnaround"],
            bass: ["Deep rolling house bassline with warm sub weight","Warm sub bass with smooth rolling groove","Deep house bass with rounded analog tone"],
            rhythm: ["Deep house drum groove with heavy four-on-the-floor kick, crisp hats and organic percussion","Four-on-the-floor deep house beat with shakers, congas and tight hats","Driving deep house kit with punchy kick and layered percussion"],
            perc: ["a bongo and rimshot pattern rolling under the kick","tambourine and woodblock accents lifting the groove"],
            strings: ["Warm atmospheric string textures beneath the chords","Subtle emotional strings lifting the harmonic space"],
            texture: ["a warm string-machine layer sustaining beneath the chords","a soft choir-pad layer drifting under the groove"],
            motif: ["Emotive plucked synth melody weaving through the mix","Melodic synth lead with warm emotional phrasing","Soulful vocal-chop textures drifting through the mix","Bright plucked synth arpeggio rising over the groove"],
            counter: ["a plucked nylon-guitar counter-line answering the lead","a vibraphone counter-figure weaving beneath the melody"],
            color: ["an occasional organ chord swelling under the groove","a brief bell-tone accent surfacing over the drive","a short harp figure rippling through a gap"],
            movement: ["Warm filter movement and evolving modulation across the deep house groove","Deep atmospheric swells rising and falling over the drive","Wide stereo automation across pads and plucked melodies"]
          },
          acoustic: {
            pads: ["Warm Rhodes chord voicings with deep emotional feel drifting over the groove", "Soft live piano chord layers with warm sustained movement"],
            bass: ["Warm fingerstyle electric bass with a deep rolling groove", "Deep upright bass with rounded warm tone underpinning the drive"],
            rhythm: ["Deep house groove with live congas, shakers and organic percussion over a heavy four-on-the-floor kick", "Organic four-on-the-floor with hand percussion, tight hats and warm live feel"],
            strings: ["Warm live string textures swelling beneath the chords", "Soft layered strings lifting the groove with emotional warmth"],
            motif: ["Emotive Wurlitzer melody weaving warmly through the mix", "Warm marimba melodic line dancing over the deep groove", "Soulful vocal-chop textures drifting emotively through the mix"],
            color: ["an occasional organ chord swelling under the groove","a brief bell-tone accent surfacing over the drive","a short harp figure rippling through a gap"],
            movement: ["Organic percussion build with rising dynamics lifting into deep immersion", "Warm dynamic swells lifting the groove toward an emotional peak"]
          }
        },
        interplay: {
          conversation: ["the lead melody and chords rising together in warm emotional phrasing","the lead melody answered by soft chord swells"],
          foundation: ["deep rolling bass and heavy four-on-the-floor kick driving smooth and powerful"],
          arc: ["the groove building through layered percussion into deep immersion","warm chords swelling toward an emotional peak"]
        },
        bannedAdd: [], bannedRemove: []
      }
    },

    synonymBank: {
      "lazy swing groove":   ["laidback Balearic groove", "loose swing feel", "languid groove"],
      "floating pad":        ["suspended synth pad", "drifting chord pad", "ambient pad wash"],
      "Ibiza sunset":        ["Balearic dusk", "Mediterranean twilight", "golden hour atmosphere"],
      "warm sub bass":       ["deep warm sub", "analogue bass warmth", "low-frequency warmth"],
      "emotional restraint": ["emotional understatement", "restrained feeling", "subtle emotional depth"],
      "slow cinematic build":["unhurried cinematic arc", "slow-building atmosphere", "gradual cinematic reveal"],
      "no hard drops":       ["no sudden drops", "no hard transitions", "seamless flow"],
      "lush detuned pads":   ["layered detuned chords", "rich analogue pad wash", "warm detuned synth texture"],
      "tape warmth":         ["analogue warmth", "vintage tape character", "warm analogue colouring"],
      "hall reverb":         ["large hall reverb", "spacious hall reverb", "open hall reverb"]
    },

    refTracks: [
      { rank: 1,  track: "La Femme d'Argent",                 artist: "Air",                  bpm: 98,  mood: "melancholic", drum: "nearbeat",   bass: "fretless", harm: "minor7",    textures: ["Fender Rhodes", "Synth pads", "Fretless bass"] },
      { rank: 2,  track: "Kiara",                              artist: "Bonobo",               bpm: 85,  mood: "melancholic", drum: "brushed",    bass: "walking",  harm: "minor7",    textures: ["Nylon guitar", "Fender Rhodes", "Broken beat"] },
      { rank: 3,  track: "Destiny",                            artist: "Zero 7",               bpm: 88,  mood: "euphoric",    drum: "brushed",    bass: "fm",       harm: "major9",    textures: ["Strings", "Female vocal", "Gospel chords"] },
      { rank: 4,  track: "Two Thousand and Seventeen",         artist: "Four Tet",             bpm: 100, mood: "euphoric",    drum: "electronic", bass: "fm",       harm: "major9",    textures: ["Tabla", "Micro-programmed house", "Warm pads"] },
      { rank: 5,  track: "Lady and Man",                       artist: "Khruangbin",           bpm: 82,  mood: "golden",      drum: "brushed",    bass: "dub",      harm: "mixo",      textures: ["Featherlight guitar", "Reggae bass", "Ghost-note groove"] },
      { rank: 6,  track: "Lebanese Blonde",                    artist: "Thievery Corporation", bpm: 90,  mood: "dark",        drum: "congas",     bass: "fretless", harm: "dorian",    textures: ["Tabla", "Hang drum", "Modal mood"] },
      { rank: 7,  track: "Running (Four Tet Remix)",           artist: "Jessie Ware",          bpm: 96,  mood: "euphoric",    drum: "electronic", bass: "fm",       harm: "major9",    textures: ["Vocal texture", "Balearic house structure"] },
      { rank: 8,  track: "Can't Do Without You",               artist: "Caribou",              bpm: 118, mood: "meditative",  drum: "electronic", bass: "drone",    harm: "onechord",  textures: ["Vocoder stacking", "One-chord hypnosis"] },
      { rank: 9,  track: "Near Light",                         artist: "Olafur Arnalds",       bpm: 80,  mood: "meditative",  drum: "nearbeat",   bass: "drone",    harm: "minor7",    textures: ["Strings", "Prepared piano", "Micro beats"] },
      { rank: 10, track: "Space Is Only Noise If You Can See", artist: "Nicolas Jaar",         bpm: 75,  mood: "dark",        drum: "nearbeat",   bass: "drone",    harm: "chromatic", textures: ["Noir minor", "Near-beatless", "Atmospheric"] },
      { rank: 11, track: "Cherry",                             artist: "Chromatics",           bpm: 90,  mood: "dark",        drum: "motorik",    bass: "dub",      harm: "chromatic", textures: ["Motorik groove", "Italo-noir", "No builds"] },
      { rank: 12, track: "Gold Hush",                          artist: "Max Essa",             bpm: 105, mood: "golden",      drum: "electronic", bass: "fm",       harm: "major9",    textures: ["FM bass", "Warm major", "DJ-friendly"] }
    ]
  },

  // ---- Stubs: same shape, empty for now. Fleshed out in later sessions. ----
  // The batch generator reads these identically and simply skips empty parts.
  Enigma: {
    // Interaction/arrangement language is mandatory in the style string
    // (standing project rule) — no longer an optional toggle.
    interplayAlways: true,
    // ------------------------------------------------------------------------
    // Rebuilt 2026-07-14 against the actual catalogue (John: presets were
    // outputting the wrong music). Every cluster is now anchored to a real
    // album, with that album's INSTRUMENTATION, GROOVE FAMILY and BEHAVIOUR.
    //
    // Catalogue-wide constants (present in every cluster, era-shaded):
    //   groove  - slow hypnotic swung beat, hip-hop-derived, 78-100 BPM on the
    //             albums. The 118-140 BPM versions are CLUB REMIXES, not album
    //             tracks. Never four-on-the-floor.
    //   bass    - deep sub with a short recurring low-end motif (a riff, not a
    //             pad): the hook under the hook.
    //   chant   - sampled chant/choir is a TEXTURAL LAYER (strings slot), never
    //             the lead. Era decides WHICH chant: Gregorian (MCMXC),
    //             indigenous/tribal (Cross of Changes), Gregorian + Sanskrit
    //             (Le Roi), Carmina-style massed Latin chorus (Screen), none
    //             (Voyageur, A Posteriori).
    //   hook    - ONE repeating instrumental melodic hook (motif slot), usually
    //             breathy flute (shakuhachi / panpipe) or a vocal-style synth
    //             lead. Enigma writes SONGS: verse -> chorus lift, hook returns.
    //   colour  - the ethnic/acoustic sources are OCCASIONAL colour that fills
    //             gaps, never the spine.
    //   space   - deep cathedral reverb, long delay tails, wide slow panning.
    //
    // "Enigma Style" is KEPT in the genre anchor (John: Suno does not dismiss
    // it) and is now followed by the era's real genre traits rather than an
    // invented sub-genre.
    // ------------------------------------------------------------------------
    presetMap: {
      "Gregorian sacred (MCMXC a.D.)":        { cluster: "sacred",     palette: "electronic" },
      "Tribal worldbeat (Cross of Changes)":  { cluster: "tribal",     palette: "blend" },
      "Sanskrit hybrid (Le Roi Est Mort)":    { cluster: "sanskrit",   palette: "electronic" },
      "Carmina choral (Screen)":              { cluster: "carmina",    palette: "electronic" },
      "Heavy break (Push the Limits)":        { cluster: "heavybreak", palette: "electronic" },
      "Modern synth-pop (Voyageur)":          { cluster: "modern",     palette: "electronic" },
      "Cosmic instrumental (A Posteriori)":   { cluster: "cosmic",     palette: "electronic" },
      "Symphonic chillout (Seven Lives)":     { cluster: "symphonic",  palette: "blend" },
      "Beatless ambient interlude":           { cluster: "ambient",    palette: "electronic" }
    },
    moodBundles: {},
    flavourClusters: {

      // ---- MCMXC a.D. (1990) -------------------------------------------------
      // Gregorian chant samples over a slow Soul II Soul-style shuffle break,
      // breathy shakuhachi/panpipe hook, deep sub, church bells, low horn call.
      sacred: {
        label: "Gregorian sacred (MCMXC a.D.)",
        genre: "Enigma Style, new-age worldbeat downtempo with Gregorian chant",
        band: "78-90", bpm: 84, beatless: false, colorChance: 0.5,
        phase: "78-90 BPM, low energy, slow hypnotic swing", energy: "low energy",
        palettes: {
          electronic: {
            pads: ["Lush dark analogue synth pads with slow evolving harmonic layers","Warm analogue pad wash with deep cathedral space","Rich layered synth pads with a soft harmonic bed"],
            harmony: ["a hypnotic minor-key vamp opening into a lifting chorus","a modal minor cycle moving from verse into a clear chorus","a slow minor progression with a resolving turnaround each cycle"],
            bass: ["Deep sub bass with a short recurring low-end riff under the groove","Warm analogue bass rolling through a slow repeating low motif","Deep rounded synth bass with a sensual recurring pulse"],
            rhythm: ["Slow swung sampled shuffle break with a soft kick, rimshot snare and shaker","Laid-back downtempo beat with a swung programmed kick, brushed snare and light hats","Hypnotic slow break with a soft kick, tight snare and shaker groove"],
            perc: ["light shaker and tambourine ticking under the shuffle","a soft frame-drum pulse beneath the break"],
            strings: ["A sampled Gregorian male chant choir drifting through the harmony","A layered monastic Latin chant choir wash sitting behind the harmony","A distant sampled choir pad with a plainsong texture"],
            texture: ["a low pipe-organ layer sustaining beneath the chant","a soft mellotron string layer drifting under the harmony"],
            motif: ["A breathy shakuhachi hook stating the main melody and returning through the track","A panpipe-style flute hook with a simple repeating melodic phrase","A warm synth lead carrying a vocal-style hook with gentle repetition"],
            counter: ["a soft harp counter-figure weaving beneath the lead","a cello counter-line answering the melodic hook"],
            color: ["an occasional church-bell toll marking the phrase","a brief low horn call opening the section","an occasional panpipe answer in the gaps","a short chant fragment surfacing between phrases"],
            movement: ["Deep cathedral reverb with long delay trails and slow stereo drift","Wide stereo field with tempo-synced delay and slow filter movement","Warm spatial reverb with the pads drifting across the field"]
          },
          acoustic: {
            pads: ["Warm harmonium chords breathing under the groove","Soft bowed-string chord bed with cathedral depth"],
            bass: ["Deep upright bass with a short recurring low-end figure","Warm plucked contrabass rolling through a slow repeating motif"],
            rhythm: ["Slow swung live kit with a soft kick, rimshot snare and shaker","Laid-back organic break with brushed snare and light hand percussion"],
            strings: ["A live Gregorian male chant choir drifting through the harmony","A monastic Latin chant choir wash sitting behind the harmony"],
            motif: ["A breathy shakuhachi hook stating the main melody and returning","A wooden panpipe hook with a simple repeating melodic phrase"],
            color: ["an occasional church-bell toll marking the phrase","a brief low horn call opening the section","a short chant fragment between phrases"],
            movement: ["Vast natural reverb with long tails and slow stereo drift","Warm reverberant space with the ensemble breathing"]
          }
        },
        interplay: {
          conversation: ["the melodic hook stating the theme while the chant layer answers beneath","the hook and the chant layer trading the foreground across the phrases"],
          foundation: ["a deep sub riff and a slow swung break locked in a hypnotic pocket"],
          arc: ["a bare groove opening into a chant-backed chorus then falling away","the hook returning each cycle with layers added around it"]
        },
        // The groove is hip-hop-derived (Soul II Soul shuffle) — lift that ban.
        bannedAdd: ["four-on-the-floor", "house beat", "club tempo", "fast tempo"],
        bannedRemove: ["hip hop beats"]
      },

      // ---- The Cross of Changes (1993) ---------------------------------------
      // Indigenous/Amis chant sample, heavy slow sampled rock break (the
      // "When the Levee Breaks" family), acoustic steel-string guitar hook,
      // duduk / Middle-Eastern colour. No sitar — never an Enigma source.
      tribal: {
        label: "Tribal worldbeat (Cross of Changes)",
        genre: "Enigma Style, tribal worldbeat downtempo with indigenous chant",
        band: "84-96", bpm: 88, beatless: false, colorChance: 0.55,
        phase: "84-96 BPM, low-medium energy, heavy slow swing", energy: "low-medium energy",
        palettes: {
          electronic: {
            pads: ["Warm analogue synth pads with an earthy evolving wash","Deep ambient pad bed with a warm worldbeat colour","Layered analogue pads with a soft open harmonic bed"],
            harmony: ["a modal minor cycle rising into a big singable chorus","a folk-modal chord cycle with an earthy resolving turnaround","a minor progression lifting into an open melodic chorus"],
            bass: ["Deep sub bass with a rolling recurring low-end riff","Warm analogue bass locking the heavy break with a repeating motif","Deep synth bass driving a slow repeating low figure"],
            rhythm: ["Heavy slow sampled rock break with a fat backbeat snare and a half-time feel","Slow heavy breakbeat with a deep kick, big room snare and tribal hand percussion","Dragging sampled break with a thick snare backbeat and shaker groove"],
            perc: ["djembe and frame-drum layers threading the break","light shaker and rattle accents ticking through the groove"],
            strings: ["A sampled indigenous chant vocal layered over a warm string bed","A tribal chant chorus wash sitting behind the harmony","A layered indigenous vocal sample drifting through the strings"],
            texture: ["a low bowed drone layer sustaining beneath the chant","a warm organ layer sitting under the harmony"],
            motif: ["A steel-string acoustic guitar hook carrying the main melody","A duduk-style reed lead stating the melodic hook","A nylon-string guitar hook with warm folk phrasing"],
            counter: ["a low bamboo-flute counter-line answering the guitar hook","a plucked santoor counter-figure weaving against the lead"],
            color: ["an occasional oud lick answering in the gaps","a short tribal chant fragment surfacing between phrases","an occasional Middle-Eastern plucked-string lick","a brief panpipe phrase drifting over the groove"],
            movement: ["Wide stereo field with tempo-synced delay across the percussion","Deep reverb with slow stereo drift and filter movement","Big open reverb with the break breathing in the space"]
          },
          acoustic: {
            pads: ["Warm harmonium chords breathing under the groove","Soft-strummed nylon-string chords with warm open movement"],
            bass: ["Deep upright bass rolling a recurring low-end figure","Warm fretless bass locking the heavy break with a repeating motif"],
            rhythm: ["Heavy slow live break with a fat backbeat snare and a half-time feel","Slow heavy live break with a deep kick, thick snare and tribal hand percussion"],
            strings: ["A live indigenous chant vocal layered over a warm string bed","A tribal chant chorus wash sitting behind the harmony"],
            motif: ["A steel-string acoustic guitar hook carrying the main melody","A duduk reed lead stating the melodic hook"],
            color: ["an occasional oud lick answering in the gaps","a short tribal chant fragment between phrases","an occasional low reed phrase filling a gap"],
            movement: ["Warm reverberant space with the hand percussion breathing","Hand-played dynamics lifting and easing the break"]
          }
        },
        interplay: {
          conversation: ["the melodic hook leading while the chant layer answers beneath","the hook and an occasional colour phrase trading space over the break"],
          foundation: ["a deep sub riff and a heavy half-time break locked in an earthy pocket"],
          arc: ["a stripped verse opening into a full chant-backed chorus","the break dropping out for a bridge then returning with the hook"]
        },
        bannedAdd: ["drum and bass", "big beat", "breakbeat hardcore", "jungle", "fast breaks", "four-on-the-floor", "club tempo"],
        bannedRemove: ["hip hop beats"]
      },

      // ---- Le Roi Est Mort, Vive Le Roi! (1996) -------------------------------
      // The two earlier records fused, with a tighter, more futuristic digital
      // production: Gregorian chant AND Sanskrit/Vedic chant, harder programmed
      // beats, sampled brass stabs (T.N.T. for the Brain).
      sanskrit: {
        label: "Sanskrit hybrid (Le Roi Est Mort)",
        genre: "Enigma Style, new-age downtempo with Gregorian and Sanskrit chant",
        band: "88-98", bpm: 94, beatless: false, colorChance: 0.5,
        phase: "88-98 BPM, medium energy, tight hypnotic swing", energy: "medium energy",
        palettes: {
          electronic: {
            pads: ["Glassy digital synth pads with a futuristic harmonic sheen","Hybrid analogue-digital pad bed with cold evolving layers","Bright layered synth pads with a clean harmonic wash"],
            harmony: ["a minor progression with a defined verse-chorus shape","a suspended minor cycle resolving into the hook","a modal minor progression with a firm turnaround into the chorus"],
            bass: ["Tight sub bass with a punchy recurring low-end riff","Deep synth bass with a firm repeating low figure","Hard rounded synth bass driving a short low motif"],
            rhythm: ["Tight programmed downtempo beat with a crisp snare, swung hats and shaker","Mid-tempo electronic groove with a firm kick, snappy snare and light percussion","Hard swung programmed break with a punchy kick and tight snare"],
            perc: ["tabla and shaker accents ticking under the beat","light frame-drum accents threading the groove"],
            strings: ["A sampled Gregorian chant layered with a Sanskrit mantra texture","A monastic chant sample blended with a Vedic chant layer","A choir wash carrying both a Latin chant and a Sanskrit mantra texture"],
            texture: ["a low pipe-organ layer sustaining beneath the chant","a glassy string-synth layer drifting under the harmony"],
            motif: ["A breathy shakuhachi hook stating the melody and returning","A bright digital flute-synth lead carrying the hook","A clean synth lead delivering a defined melodic hook"],
            counter: ["a cello counter-line answering the melodic hook","a plucked santoor counter-figure weaving against the lead"],
            color: ["an occasional sampled brass stab punching the phrase","a short Sanskrit mantra fragment surfacing between phrases","an occasional bell and chime accent","a brief breathy reed answer in the gaps"],
            movement: ["Wide stereo field with tempo-synced delay and evolving modulation","Deep reverb with long delay tails and rhythmic filter movement","Sharp spatial delay driving movement across the beat"]
          },
          acoustic: {
            pads: ["Warm harmonium chords with a firm sustained bed","Soft bowed-string chord bed with clean depth"],
            bass: ["Tight upright bass with a punchy recurring low figure","Deep plucked contrabass driving a short repeating motif"],
            rhythm: ["Tight live downtempo kit with a crisp snare, swung hats and shaker","Mid-tempo organic groove with a firm kick and snappy snare"],
            strings: ["A live Gregorian chant layered with a Sanskrit mantra texture","A chant choir blended with a Vedic mantra layer"],
            motif: ["A breathy shakuhachi hook stating the melody and returning","A wooden flute lead carrying the melodic hook"],
            color: ["a short Sanskrit mantra fragment between phrases","an occasional bell accent marking the phrase","a brief reed answer in the gaps"],
            movement: ["Big natural reverb with long tails and rhythmic space","Warm reverberant space with the percussion driving"]
          }
        },
        interplay: {
          conversation: ["the melodic hook leading while the two chant layers answer beneath","the hook and a short stab punctuating each other across the beat"],
          foundation: ["a tight sub riff and a firm swung beat locked hard beneath the layers"],
          arc: ["a tight verse driving into a chant-backed chorus","layers stacking through the verse then stripping back to the hook"]
        },
        bannedAdd: ["trance", "drum and bass", "four-on-the-floor", "club tempo"],
        bannedRemove: ["hip hop beats", "orchestral hits"]
      },

      // ---- The Screen Behind the Mirror (2000) --------------------------------
      // Carmina Burana (O Fortuna) massed Latin chorus samples + DISTORTED
      // ELECTRIC GUITAR + the low horn call, over the heavy sampled break.
      // Not "cinematic" — that framing was pulling Suno toward trailer music.
      carmina: {
        label: "Carmina choral (Screen Behind the Mirror)",
        genre: "Enigma Style, new-age downtempo with massed Latin chorus and distorted guitar",
        band: "88-100", bpm: 94, beatless: false, colorChance: 0.5,
        phase: "88-100 BPM, medium energy, heavy hypnotic swing", energy: "medium energy",
        palettes: {
          electronic: {
            pads: ["Dark analogue pad mass with deep orchestral weight","Shadowed synth pads layered with orchestral string texture","Deep pad bed with a heavy evolving harmonic mass"],
            harmony: ["a dramatic minor progression with a strong chorus lift","a dark minor cycle rising to a clear melodic peak","a minor progression with a resolving turnaround into the hook"],
            bass: ["Deep sub bass with a heavy driving recurring riff","Dark analogue bass with a controlled repeating low figure","Heavy synth bass pushing a short low-end motif"],
            rhythm: ["Heavy sampled rock break with a fat backbeat snare and a half-time feel","Driving downtempo beat with a firm kick, hard snare and layered percussion","Slow heavy break with a cracking snare and tight hats"],
            perc: ["deep taiko-style toms and shaker under the break","heavy tambourine and rim accents driving the groove"],
            strings: ["A massed Latin chorus sample in a Carmina-style choral texture","A sampled classical choir singing Latin over orchestral strings","A heavy massed choir sample carrying the choral weight"],
            texture: ["a low pipe-organ layer sustaining beneath the chorus","a dark mellotron string layer drifting under the mass"],
            motif: ["A soaring synth lead carrying the main melodic hook","A distorted electric guitar riff carrying the hook","A big melodic lead line stating the chorus hook"],
            counter: ["a cello counter-line answering the lead hook","a low brass counter-line pushing against the riff"],
            color: ["a low horn call marking the section","a short Latin chorus fragment surfacing between phrases","an occasional bell toll punctuating the phrase","an occasional orchestral swell lifting the phrase"],
            movement: ["Deep cathedral reverb with long delay trails and wide stereo movement","Big spatial reverb with heavy filter movement across the break","Wide stereo field with tempo-synced delay and dramatic swells"]
          },
          acoustic: {
            pads: ["Dark harmonium and bowed-string chord mass with orchestral weight","Deep bowed-string chord bed swelling under the harmony"],
            bass: ["Deep bowed upright bass driving a heavy recurring low figure","Dark contrabass with a controlled repeating low motif"],
            rhythm: ["Heavy live rock break with a fat backbeat snare and a half-time feel","Driving live kit with a firm kick, hard snare and layered hand percussion"],
            strings: ["A live massed Latin chorus in a Carmina-style choral texture","A classical choir singing Latin over bowed orchestral strings"],
            motif: ["A distorted electric guitar riff carrying the hook","A soaring string lead carrying the main melodic hook"],
            color: ["a low horn call marking the section","a short Latin chorus fragment between phrases","an occasional bell toll punctuating the phrase"],
            movement: ["Vast reverberant space with heavy dynamic swells","Big natural reverb with the ensemble rising to a peak"]
          }
        },
        interplay: {
          conversation: ["the lead hook soaring while the massed chorus swells beneath","the hook and a colour accent answering each other across the break"],
          foundation: ["a heavy sub riff and a half-time break anchoring the weight"],
          arc: ["a dark verse building into a chorus-backed peak then falling back","tension stacking through the verse and released on the hook"]
        },
        // Screen leans on distorted guitar, orchestral choral samples and the
        // heavy hip-hop-derived break — lift those three bans here only.
        bannedAdd: ["metal guitars", "symphonic metal", "trailer braams", "cinematic trailer music", "four-on-the-floor"],
        bannedRemove: ["rock guitars", "hip hop beats", "orchestral hits"]
      },

      // ---- Push the Limits / Modern Crusaders ---------------------------------
      // The break-driven Enigma character, at ALBUM tempo. Previously 118-126
      // BPM "driving hip-hop breakbeat", which is club-remix territory (the
      // 128/133/140 BPM versions are all remixes) and was rendering as big beat.
      heavybreak: {
        label: "Heavy break (Push the Limits)",
        genre: "Enigma Style, downtempo worldbeat with a heavy sampled break",
        band: "92-100", bpm: 96, beatless: false, colorChance: 0.45,
        phase: "92-100 BPM, medium energy, heavy half-time drive", energy: "medium energy",
        palettes: {
          electronic: {
            pads: ["Dark analogue synth pads with a heavy evolving bed","Deep pad mass with a shadowed harmonic wash","Warm dark pads layered under the break"],
            harmony: ["a driving minor riff-cycle repeating with a hard chorus lift","a dark minor progression built around a repeating low riff","a modal minor cycle pushing into a heavy chorus"],
            bass: ["Heavy sub bass riff driving a hard recurring low motif","Dark analogue bass pushing a repeating low-end figure","Deep distorted-edge synth bass locking the break"],
            rhythm: ["Heavy chopped sampled break with a fat snare backbeat and half-time swing","Hard slow breakbeat with a deep kick, cracking snare and tight hats","Thick sampled break with a dragging backbeat and shaker groove"],
            perc: ["heavy toms and tambourine driving under the break","hard shaker and rim accents pushing the groove"],
            strings: ["A massed Latin chorus sample carrying weight behind the riff","A sampled chant choir wash sitting under the break","A choir texture layered with orchestral strings under the groove"],
            texture: ["a dark pipe-organ layer sustaining under the riff","a low mellotron string layer thickening the break"],
            motif: ["A heavy distorted electric guitar riff carrying the hook","A big synth lead riff stating the main hook","A low horn-call hook driving the section"],
            counter: ["a cello counter-line answering the riff","a low brass counter-figure pushing against the hook"],
            color: ["a low horn call marking the section","a short chant fragment surfacing between phrases","an occasional shakuhachi phrase cutting across the groove","an occasional bell toll punctuating the phrase"],
            movement: ["Wide stereo field with tempo-synced delay across the break","Heavy filter movement opening over the groove","Deep reverb with hard rhythmic delay driving the break"]
          },
          acoustic: {
            pads: ["Dark harmonium chord mass with heavy weight","Deep bowed-string chord bed under the break"],
            bass: ["Heavy upright bass riff driving a recurring low motif","Dark contrabass pushing a repeating low-end figure"],
            rhythm: ["Heavy chopped live break with a fat snare backbeat and half-time swing","Hard slow live break with a deep kick, cracking snare and hand percussion"],
            strings: ["A live massed chorus carrying weight behind the riff","A chant choir wash sitting under the break"],
            motif: ["A heavy distorted electric guitar riff carrying the hook","A low brass-call hook driving the section"],
            color: ["a low horn call marking the section","a short chant fragment between phrases","an occasional shakuhachi phrase cutting across the groove"],
            movement: ["Big natural reverb with the break breathing hard in the space","Heavy dynamic swells lifting the groove"]
          }
        },
        interplay: {
          conversation: ["the riff hook driving while the chorus layer swells behind it","the riff and the chant layer answering across the break"],
          foundation: ["a heavy sub riff and a chopped half-time break locked in a hard pocket"],
          arc: ["the break dropping out for a stripped bridge then slamming back with the riff","the riff returning each cycle with layers stacked around it"]
        },
        bannedAdd: ["big beat", "drum and bass", "breakbeat hardcore", "jungle", "club house", "uptempo breaks", "four-on-the-floor", "club tempo"],
        bannedRemove: ["hip hop beats", "rock guitars"]
      },

      // ---- Voyageur (2003) ----------------------------------------------------
      // The departure record: pop-oriented songs, synth-driven, electric guitar,
      // and NO chant at all. Still minor/modal — the old "bright major-key"
      // harmony pool was what pushed this cluster into generic pop.
      modern: {
        label: "Modern synth-pop (Voyageur)",
        genre: "Enigma Style, electronic downtempo synth-pop",
        band: "96-110", bpm: 104, beatless: false, colorChance: 0.4,
        phase: "96-110 BPM, medium energy, steady synth-driven groove", energy: "medium energy",
        palettes: {
          electronic: {
            pads: ["Clean modern synth pads with a smooth evolving wash","Polished synth pad bed with clean tonal depth","Lush contemporary synth layers with smooth harmonic movement"],
            harmony: ["a minor-key electronic progression with a clear chorus lift","a modal minor cycle with a strong resolving hook","a minor progression giving a defined verse-chorus shape"],
            bass: ["Warm analogue bass with a steady driving recurring pulse","Rounded synth bass locking a tight repeating low figure","Deep sub bass with a smooth modern low-end groove"],
            rhythm: ["Clean programmed electronic beat with a steady kick, tight hats and light percussion","Modern downtempo kit with a soft kick, crisp snare and subtle percussion","Controlled electronic groove with programmed drums and light shaker"],
            perc: ["light shaker and tambourine ticking under the beat","soft conga accents threading the groove"],
            strings: ["Soft synth strings supporting the harmony","Smooth string texture sitting under the chords","Light synth string bed adding depth beneath the pads"],
            texture: ["a warm string-machine layer sustaining under the chords","a soft mellotron layer drifting beneath the harmony"],
            motif: ["A bright synth lead carrying a strong modern hook","A clean arpeggiated synth line stating the main hook","A melodic electric guitar line carrying the hook"],
            counter: ["a plucked synth counter-line answering the hook","a warm clavinet counter-figure weaving beneath the lead"],
            color: ["a brief bell accent marking the phrase","an occasional filtered synth stab lifting the bar","an occasional plucked-string accent answering the hook"],
            movement: ["Wide stereo field with tempo-synced delay and evolving modulation","Filter and modulation movement using LFO, chorus and phaser","Rhythmic autopan and tempo-synced delay creating modern space"]
          },
          acoustic: {
            pads: ["Warm electric-piano chords with smooth voicings","Soft nylon-string chord comping with clean movement"],
            bass: ["Warm fingerstyle electric bass with a steady recurring groove","Rounded upright bass with a tight repeating low figure"],
            rhythm: ["Soft live kit with a steady downtempo groove and light percussion","Organic groove with a crisp snare, tight hats and warm percussion"],
            strings: ["Soft live strings supporting the harmony","Warm string texture sitting under the chords"],
            motif: ["A melodic electric guitar line carrying the hook","A warm Rhodes lead stating the main hook"],
            color: ["a brief bell accent marking the phrase","an occasional plucked-string accent answering the hook"],
            movement: ["Warm reverb with the players easing through the groove","Soft tape-delay drifting phrases through the mix"]
          }
        },
        interplay: {
          conversation: ["the lead hook leading while a second voice answers in the gaps","the lead hook and the chord bed rising together into the chorus"],
          foundation: ["a steady bass pulse and a clean programmed beat driving the song"],
          arc: ["a clean verse opening into a full chorus then stripping back","the hook returning across the chorus with layers added"]
        },
        // Era-accurate: Voyageur has no chant and no Gregorian sampling at all.
        bannedAdd: ["Gregorian chant", "monastic chant", "plainsong", "Latin chorus", "sampled choir"],
        bannedRemove: []
      },

      // ---- A Posteriori (2006) ------------------------------------------------
      // Cosmic, largely instrumental, trance-leaning arpeggios, grand piano
      // themes, orchestral swells. No chant, no vocal hook.
      cosmic: {
        label: "Cosmic instrumental (A Posteriori)",
        genre: "Enigma Style, cosmic instrumental electronica with ambient and trance textures",
        band: "104-118", bpm: 112, beatless: false, colorChance: 0.45,
        phase: "104-118 BPM, medium energy, steady instrumental drive", energy: "medium energy",
        palettes: {
          electronic: {
            pads: ["Vast cold synth pads with deep cosmic space","Wide digital pad wash with slow evolving layers","Deep space-synth pad bed with glassy harmonic depth"],
            harmony: ["a slow minor progression developing across long instrumental sections","a suspended minor cycle evolving without a vocal chorus","a modal minor progression unfolding through the piece"],
            bass: ["Deep pulsing synth bass with a steady rolling low motif","Tight sub bass driving a repeating low-end figure","Rounded analogue bass with a smooth recurring pulse"],
            rhythm: ["Steady electronic beat with a tight kick, crisp hats and programmed percussion","Driving programmed groove with a clean kick, snappy snare and light percussion","Controlled electronic beat with a firm kick and rolling hats"],
            perc: ["light shaker and rim accents ticking under the beat","soft hand-percussion layers threading the groove"],
            strings: ["Orchestral string layer swelling beneath the synths","Soft wordless choir pad drifting under the harmony","Warm string section rising under the electronic layers"],
            texture: ["a warm string-machine layer sustaining beneath the arpeggio","a soft mellotron layer drifting under the theme"],
            motif: ["A cycling arpeggio carrying the main theme","A grand piano theme stating the melody","A melodic synth lead developing the theme across the piece"],
            counter: ["a viola counter-line answering the theme","a plucked synth counter-figure weaving against the arpeggio"],
            color: ["an occasional harp figure surfacing between phrases","a brief bell and chime accent with soft decay","an occasional filtered arpeggio burst lifting the bar"],
            movement: ["Wide stereo field with tempo-synced delay and slow evolving modulation","Deep reverb with long tails and cosmic filter sweeps","Big spatial movement with the layers rising and receding"]
          },
          acoustic: {
            pads: ["Soft bowed-string chord bed drifting under the theme","Warm harmonium bed sustaining beneath the harmony"],
            bass: ["Deep upright bass with a steady rolling low motif","Low cello line driving a repeating low figure"],
            rhythm: ["Steady live kit with a tight kick, crisp hats and light percussion","Driving organic groove with a clean snare and rolling hats"],
            strings: ["Live orchestral strings swelling beneath the theme","Soft wordless choir wash drifting under the harmony"],
            motif: ["A grand piano theme stating the melody","A bowed string-section theme carrying the melodic line"],
            color: ["an occasional harp figure surfacing between phrases","a brief bell accent with soft decay"],
            movement: ["Big natural reverb with long tails and slow swells","Wide orchestral space with the layers rising and receding"]
          }
        },
        interplay: {
          conversation: ["the cycling figure driving while the theme answers over it","the theme passing between the lead and the counter voice"],
          foundation: ["a rolling bass motif and a steady beat carrying the instrumental drive"],
          arc: ["a theme stated then developed through layered instrumental sections","the piece building through stacked layers then opening out"]
        },
        bannedAdd: ["Gregorian chant", "monastic chant", "vocal hooks", "hard trance", "EDM drops", "supersaw leads"],
        bannedRemove: []
      },

      // ---- Seven Lives Many Faces (2008) / Fall of a Rebel Angel (2016) --------
      // Orchestral arrangement fused with modern electronic rhythm; Spanish
      // nylon-guitar and ethnic vocal colour; symphonic chillout.
      symphonic: {
        label: "Symphonic chillout (Seven Lives / Rebel Angel)",
        genre: "Enigma Style, symphonic chillout downtempo with orchestral arrangement and modern electronic rhythm",
        band: "92-104", bpm: 98, beatless: false, colorChance: 0.5,
        phase: "92-104 BPM, medium energy, orchestral downtempo drive", energy: "medium energy",
        palettes: {
          electronic: {
            pads: ["Lush orchestral-synth hybrid pad bed with warm depth","Wide synth pads layered with orchestral texture","Rich pad wash blended with a soft string section"],
            harmony: ["a minor progression opening into a full orchestral chorus lift","a modal minor cycle resolving into a broad melodic chorus","a warm minor progression with a strong turnaround into the hook"],
            bass: ["Deep sub bass with a modern recurring low-end groove","Warm synth bass driving a repeating low figure","Rounded electronic bass locking a steady low motif"],
            rhythm: ["Modern downtempo electronic beat with a punchy kick, crisp snare and layered percussion","Mid-tempo programmed groove with a firm kick, tight hats and hand percussion","Clean electronic beat with a driving kick and warm percussion"],
            perc: ["light congas and shaker threading the groove","soft tambourine and rim accents lifting the beat"],
            strings: ["Full orchestral string section woven with a wordless choir","Layered orchestral strings with a distant ethnic vocal texture","Warm string section swelling behind the harmony"],
            texture: ["a warm harmonium layer sustaining beneath the strings","a soft organ layer drifting under the orchestra"],
            motif: ["A Spanish nylon-guitar hook carrying the main melody","A soaring synth lead stating the melodic hook","An orchestral string theme carrying the chorus melody"],
            counter: ["a soft oboe counter-figure weaving beneath the lead","a low brass counter-line answering the hook"],
            color: ["an occasional Spanish guitar flourish answering the hook","a brief ethnic vocal fragment surfacing between phrases","an occasional piano figure lifting the phrase","a short low horn call marking the section"],
            movement: ["Wide cinematic stereo field with tempo-synced delay and orchestral swells","Deep reverb with the orchestra rising beneath the beat","Big spatial movement with the strings breathing across the groove"]
          },
          acoustic: {
            pads: ["Warm orchestral string chord bed with soft depth","Live bowed-string and woodwind chord layers under the harmony"],
            bass: ["Deep upright bass with a recurring low-end groove","Warm fingerstyle electric bass locking a steady low motif"],
            rhythm: ["Live downtempo kit with a punchy kick, crisp snare and layered hand percussion","Mid-tempo organic groove with a firm kick, tight hats and warm percussion"],
            strings: ["Full live orchestral strings woven with a wordless choir","Live string section with a distant ethnic vocal texture"],
            motif: ["A Spanish nylon-guitar hook carrying the main melody","A live string theme carrying the chorus melody"],
            color: ["an occasional Spanish guitar flourish answering the hook","a brief ethnic vocal fragment between phrases","an occasional piano figure lifting the phrase"],
            movement: ["Vast orchestral reverb with the ensemble swelling beneath the beat","Big natural space with the strings breathing across the groove"]
          }
        },
        interplay: {
          conversation: ["the melodic hook leading while the orchestra swells beneath","the lead theme and the string section answering each other into the chorus"],
          foundation: ["a modern electronic beat and a deep bass motif carrying the orchestra"],
          arc: ["a restrained verse opening into a full orchestral chorus","the arrangement stacking strings and choir toward the melodic peak"]
        },
        bannedAdd: ["EDM drops", "trailer braams", "four-on-the-floor"],
        bannedRemove: ["orchestral hits"]
      },

      // ---- Beatless interludes (Rivers of Belief / Shadows in Silence) ---------
      ambient: {
        label: "Beatless ambient interlude",
        genre: "Enigma Style, beatless new-age ambient with chant",
        band: "beatless", bpm: null, beatless: true, colorChance: 0.5,
        phase: "beatless, no drums, free-floating, melody-led", energy: "low energy",
        palettes: {
          electronic: {
            pads: ["Lush evolving synth pads with a warm harmonic bed","Deep ambient synth layers with slow evolving harmony","Warm analogue pad wash with soft cathedral depth"],
            harmony: ["a slow minor progression resolving gently each cycle","a suspended chord cycle moving gently through the piece","a modal chord cycle giving the piece a clear melodic shape"],
            bass: ["Soft sub drone giving weightless low-end support","Deep tonal drone anchoring the harmony softly"],
            rhythm: [],
            strings: ["A sampled chant choir wash drifting through the harmony","A layered choir pad carrying a sacred chant texture","A warm string wash blended with a distant chant layer"],
            texture: ["a soft mellotron string layer drifting beneath the drone","a low pipe-organ layer sustaining under the chant"],
            motif: ["A breathy shakuhachi line carrying a slow melodic theme","A warm synth lead stating the theme softly","A gentle lead motif delivering a defined melodic hook"],
            counter: ["a viola counter-line rising slowly beneath the theme","a soft harp counter-figure drifting through the space"],
            color: ["an occasional bell and chime accent with soft decay","a short chant fragment surfacing between phrases","an occasional panpipe phrase filling a gap","a brief low horn call drifting through the space"],
            movement: ["Deep cathedral reverb with long delay trails and glacial stereo movement","Wide stereo field with slow spatial layering and evolving modulation","Reversed swells and long reverb tails drifting across the field"]
          },
          acoustic: {
            pads: ["Warm harmonium drone breathing slowly","Soft bowed-string chord bed drifting through the harmony"],
            bass: ["Low cello drone anchoring the harmony","Deep bowed drone giving a soft weightless foundation"],
            rhythm: [],
            strings: ["A live chant choir wash with a sacred texture","A bowed-string wash blended with a distant chant layer"],
            motif: ["A breathy shakuhachi line carrying a slow melodic theme","A warm piano lead stating the main theme softly"],
            color: ["a brief hand-bell accent with soft decay","a short chant fragment between phrases","an occasional wooden flute phrase drifting through"],
            movement: ["Vast natural reverb with tones drifting and dissolving","Slow dynamic swells rising and receding"]
          }
        },
        interplay: {
          conversation: ["the melodic lead drifting while the chant wash breathes beneath","the theme and an occasional colour phrase dissolving into the space"],
          foundation: ["a deep drone holding beneath the harmony sustaining without pulse"],
          arc: ["a slow theme stated then developed with layered harmony","the piece building gently through evolving chords then dissolving"]
        },
        bannedAdd: [], bannedRemove: []
      }
    },

    synonymBank: {}, refTracks: []
  },

  Delerium:             { moodBundles: {}, flavourClusters: {}, synonymBank: {}, refTracks: [] },
  Era:                  { moodBundles: {}, flavourClusters: {}, synonymBank: {}, refTracks: [] },
  "Composer-Orchestral":{ moodBundles: {}, flavourClusters: {}, synonymBank: {}, refTracks: [] },
  "Composer-Electronic":{ moodBundles: {}, flavourClusters: {}, synonymBank: {}, refTracks: [] },
  Producer:             { moodBundles: {}, flavourClusters: {}, synonymBank: {}, refTracks: [] },
  Remixer:              { moodBundles: {}, flavourClusters: {}, synonymBank: {}, refTracks: [] }
};

/*
 * layerKeepOut(shared, add, remove)
 * Shared helper: shared + add, then drop anything in remove (case-insensitive),
 * de-duplicated. Used by both the mood and cluster resolvers.
 */
function layerKeepOut(shared, add, remove) {
  const removeLower = (remove || []).map(s => s.toLowerCase());
  const combined = [...(shared || []), ...(add || [])];
  const seen = new Set();
  const result = [];
  for (const item of combined) {
    const key = item.toLowerCase();
    if (removeLower.includes(key)) continue; // this entry is allowed to use it
    if (seen.has(key)) continue;             // avoid duplicates
    seen.add(key);
    result.push(item);
  }
  return result;
}

/*
 * resolveKeepOut(engineName, moodName)
 * Effective keep-out list for an engine + mood. Safe on stubs (returns []).
 */
function resolveKeepOut(engineName, moodName) {
  const engine = EngineExtras[engineName];
  if (!engine) return [];
  const mood = (engine.moodBundles && engine.moodBundles[moodName]) || {};
  return layerKeepOut([], mood.bannedAdd, mood.bannedRemove);
}

/*
 * resolveClusterKeepOut(engineName, clusterId)
 * Effective keep-out list for an engine + flavour cluster. Safe on stubs ([]).
 */
function resolveClusterKeepOut(engineName, clusterId) {
  const engine = EngineExtras[engineName];
  if (!engine) return [];
  const cluster = (engine.flavourClusters && engine.flavourClusters[clusterId]) || {};
  return layerKeepOut([], cluster.bannedAdd, cluster.bannedRemove);
}

/*
 * drawClusterRoles(engineName, clusterId)
 * Role-pool draw (2026-06-28 decision): returns ONE option per populated role
 * (lead, harmony, bass, texture) for the given cluster, picked at random from
 * that role's pool. A cluster that doesn't define a role simply has no entry
 * in the returned object - callers should skip absent roles rather than
 * assume all four are present (e.g. "nocturnal" has no harmony-instrument
 * role; "ambient" has no bass role).
 *
 * Every draw is independent, so repeated calls for the same cluster yield
 * varied combinations across a batch while staying inside the cluster's
 * pre-vetted character (the pools are the variety mechanism; curation of
 * what's IN each pool is the character guarantee).
 *
 * Returns {} for an unknown engine/cluster or a cluster with no roles yet
 * (safe on stub engines and not-yet-ported clusters).
 */
function drawClusterRoles(engineName, clusterId) {
  const engine = EngineExtras[engineName];
  if (!engine) return {};
  const cluster = (engine.flavourClusters && engine.flavourClusters[clusterId]) || {};
  const roles = cluster.roles || {};
  const drawn = {};
  for (const roleName of Object.keys(roles)) {
    const pool = roles[roleName];
    if (Array.isArray(pool) && pool.length) {
      drawn[roleName] = pool[Math.floor(Math.random() * pool.length)];
    }
  }
  return drawn;
}

/*
 * drawInterplay(engineName, clusterId)
 * The arrangement / interplay layer (the "score", not the "cast"). Returns ONE
 * phrase from each populated arrangement dimension the cluster defines:
 *   conversation - how melodic voices relate (call-and-response, counterpoint,
 *                  register separation, dialogue)
 *   foundation   - how bass and groove lock or float beneath
 *   arc          - how density and dynamics evolve across the track
 * Phrases reference voices by FUNCTION only (lead, chords, bass, groove,
 * layers) and never re-name a specific instrument, so they layer cleanly on top
 * of whatever the role draw produced - no double-naming, no contradictions. A
 * cluster only defines the dimensions that make sense for it (e.g. ambient has
 * no bass-driven foundation in the usual sense; it speaks of drones instead).
 * Returns [] safely for unknown engines/clusters or clusters with no interplay.
 */
function drawInterplay(engineName, clusterId, rand) {
  const roll = (typeof rand === "function") ? rand : Math.random;
  const engine = EngineExtras[engineName];
  if (!engine) return [];
  const cluster = (engine.flavourClusters && engine.flavourClusters[clusterId]) || {};
  const ip = cluster.interplay || {};
  const order = ["conversation", "foundation", "arc"];
  const out = [];
  for (const dim of order) {
    const pool = ip[dim];
    if (Array.isArray(pool) && pool.length) {
      out.push(pool[Math.floor(roll() * pool.length)]);
    }
  }
  return out;
}


Object.assign(window.__ATMOS, { drawInterplay, EngineExtras });
})();

/* legacy/prompt-style-builder.js */
(function(){
/* ============================================================================
 * prompt-style-builder.js  -  turns selections into Suno payloads (BUILDER)
 *
 * Two build paths, both emit the validated format (a comma-separated descriptor
 * list, genre-anchored at the front):
 *   - classic slot path  : reads state.style.{phase,pad,bass,rhythm,percussion,
 *                          motif,movement} — the per-engine slot arrays.
 *   - flavour-cluster path: Balearic-validated. Reads a cluster fingerprint from
 *                          EngineExtras with an Electronic/Acoustic/Blend palette.
 *
 * buildStylePrompt/buildNegativePrompt are the entry points; they route to the
 * cluster path when state.style.buildMode === "cluster" AND the selected engine
 * actually defines the chosen cluster (otherwise they fall back to classic).
 *
 * State note: this app uses NESTED state — style fields live under state.style,
 * the engine name at state.engine. Era bias is a Lyric-engine control only and
 * is intentionally NOT in the style payload.
 * ==========================================================================*/
const {MASTERING, MAX_MODE_STR, STYLE_ENGINES} = window.__ATMOS;
const {EngineExtras, drawInterplay} = window.__ATMOS;
const {compactPart} = window.__ATMOS;
const {slotFamily} = window.__ATMOS;

/* join descriptor parts into one clean comma line, drop trailing periods, honour
 * the 1000-char budget, lead with the MAX-mode meta-tag block when enabled. */
/* Budget-aware assembly. Parts may be plain strings (core, never dropped) or
 * {t, drop} objects (optional layers, with a drop priority — highest number is
 * shed first). The extra instrument layers (perc/texture/counter/colour) and the
 * interplay arc are shed in that order only if the prompt would exceed 1000
 * chars, so arrangements are as full as the budget allows and never truncated. */
/* COMPRESSION BEFORE SHEDDING (2026-07-14). A modifier overlay needs room inside
 * the same 1,000 chars. Shedding a part to make that room would either strip the
 * engine's identity or drop the overlay the user asked for, so phrasing is
 * compacted first (core/compress.js — filler adverbs only, an instrument noun can
 * never be lost), decorative bands before core, and content is only shed if the
 * fully-compacted prompt is STILL over. Overlay parts (ov:true) are never shed. */
function fitParts(parts, maxMode, locked) {
  const isLocked = p => p && p.role && locked && locked[p.role] != null && locked[p.role] !== "";
  const flatten = ps => ps.map(p => (p && p.t !== undefined) ? p.t : p);
  const measure = ps => joinDescriptors(flatten(ps), maxMode);

  let raw = measure(parts);
  if (raw.length <= 1000) return raw;

  // 1) compact phrasing: optional layers (drop != null) first, then everything.
  for (const level of [1, 2]) {
    for (const scope of ["optional", "all"]) {
      parts = parts.map(p => {
        if (!p) return p;
        const isObj = p && p.t !== undefined;
        const optional = isObj && p.drop != null;
        if (scope === "optional" && !optional) return p;
        if (isLocked(p)) return p;                    // a locked slot is never reworded
        if (isObj) return Object.assign({}, p, { t: compactPart(p.t, level) });
        return compactPart(p, level);
      });
      raw = measure(parts);
      if (raw.length <= 1000) return raw;
    }
  }

  // 2) last resort: shed optional layers, highest drop number first (never overlays,
  //    never locked roles).
  const drops = [...new Set(parts.filter(p => p && p.drop != null && !p.ov && !isLocked(p)).map(p => p.drop))]
    .sort((a, b) => b - a);
  let live = parts.slice();
  for (let i = 0; ; i++) {
    raw = measure(live);
    if (raw.length <= 1000 || i >= drops.length)
      return raw.length <= 1000 ? raw : assembleDescriptors(flatten(live), maxMode);
    live = live.filter(p => !(p && p.drop === drops[i] && !p.ov && !isLocked(p)));
  }
}

function joinDescriptors(parts, maxMode) {
  const descriptors = parts
    .filter(Boolean)
    .map(p => String(p).replace(/\s*\.\s*$/, ""))
    .join(", ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .replace(/,\s*,/g, ", ")
    .trim();
  return maxMode ? (MAX_MODE_STR + "\n" + descriptors) : descriptors;
}

function assembleDescriptors(parts, maxMode) {
  const out = joinDescriptors(parts, maxMode);
  return out.length <= 1000 ? out : out.slice(0, 997).trimEnd() + "...";
}

/* Instrumental is NOT declared in the style field (unreliable in Suno); the
 * reliable control is the [Instrumental] lyrics tag (buildLyricsField) + Suno's
 * own Instrumental toggle. Descriptor/Persona describe a WANTED vocal, so they
 * stay in the style prompt. */
function buildVocalPhrase(state) {
  const s = state.style;
  if (s.vocalMode === "Instrumental") return "";
  if (s.vocalMode === "Persona") return s.vocalPersona ? `vocal persona: ${s.vocalPersona}` : "";
  if (s.vocalMode === "Descriptor") return s.vocalDescriptor ? `vocal descriptor: ${s.vocalDescriptor}` : "";
  return "";
}

function buildLyricsField(state) {
  return state.style.vocalMode === "Instrumental" ? "[Instrumental]" : "";
}

/* ---- non-musical bans (every prompt) + beatless drum guard --------------- */
const ALWAYS_BAN = [
  "field recordings", "air texture", "room tone", "foley", "sound effects",
  "vinyl crackle", "tape hiss", "nature sounds", "ambient noise"
];
const BEATLESS_BAN = [
  "drums", "drum kit", "kick drum", "beat", "percussion", "hi-hats", "snare"
];

/* ---- flavour-cluster path (Balearic-validated) ---------------------------
 * Deterministic per seed (state.style.rngSeed): the same seed always yields the
 * same draw, which is what makes the 3-level control (Randomize all / Lock some /
 * Full manual) meaningful on this path. state.style.slotLocks maps a cluster role
 * (pads|harmony|bass|rhythm|strings|motif|color|movement) to a chosen option; an
 * absent/empty lock is drawn from the pool as before.
 * Interaction/arrangement language is FORCED ON for engines flagged
 * interplayAlways (standing project rule); other engines keep the toggle.
 * ------------------------------------------------------------------------*/
function mulberry32(a) {
  let t = (a >>> 0) || 1;
  return function () {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function buildClusterPrompt(clusterId, state) {
  const engineName = state.engine;
  const s = state.style;
  const engine = EngineExtras[engineName] || {};
  const c = (engine.flavourClusters || {})[clusterId];
  if (!c) return "";
  const roll = (s.rngSeed != null) ? mulberry32(s.rngSeed) : Math.random;
  const locks = s.slotLocks || {};
  const pick = pool => (Array.isArray(pool) && pool.length)
    ? pool[Math.floor(roll() * pool.length)] : null;
  const palette = s.palette || "electronic";
  const E = (c.palettes && c.palettes.electronic) || {};
  const A = (c.palettes && c.palettes.acoustic) || {};
  // Electronic (proven default). Acoustic pulls the characterful pools. Blend
  // keeps the electronic production backbone (pads, rhythm, movement) and lets
  // the character slots (bass, strings, motif) pull from either palette per-song.
  function draw(name) {
    if (palette === "acoustic") return pick(A[name]) || pick(E[name]);
    if (palette === "blend") {
      const character = (name === "bass" || name === "strings" || name === "motif");
      if (character && Array.isArray(A[name]) && A[name].length && roll() < 0.5)
        return pick(A[name]);
      return pick(E[name]);
    }
    return pick(E[name]); // electronic
  }
  function slot(name) {
    const locked = locks[name];
    if (locked != null && locked !== "") { draw(name); return locked; }  // keep the draw sequence stable
    return draw(name);
  }
  const presetDriven = !!(engine.presetMap);
  let tempo;
  if (c.beatless) {
    // Beatless stays beatless (no BPM), but in preset-driven mode let the Phase's
    // energy band still apply so ambient responds to the energy control.
    if (presetDriven && s.phase) {
      const energy = (s.phase.match(/([a-z-]+(?:\s+to\s+[a-z-]+)?\s+energy)/i) || [])[1];
      const base = c.phase.replace(/,?\s*[a-z-]+(?:\s+to\s+[a-z-]+)?\s+energy/i, "").replace(/,\s*,/g, ",").replace(/,\s*$/, "").trim();
      tempo = energy ? `${base}, ${energy}` : c.phase;
    } else tempo = c.phase;
  }
  else if (s.bpmOverride) tempo = s.bpmOverride + " BPM, " + (c.energy || "medium energy");
  else if (presetDriven && s.phase) tempo = s.phase;                 // Preset sets character, Phase sets tempo
  else tempo = c.phase;
  // ---- MODIFIER OVERLAY: writes INTO existing slots; a user lock always wins ----
  // Draw the engine's structural slots FIRST so overlay traits can be checked for
  // instrument-family collisions against what the engine actually put down.
  const ov = (s.ov && s.ov.roles) || {};
  const ovFam = (s.ov && s.ov.roleFamily) || {};
  const lockedRole = n => locks[n] != null && locks[n] !== "";
  const drawn = { pads: slot("pads"), harmony: slot("harmony"), bass: slot("bass"),
                  strings: slot("strings"), texture: slot("texture"), motif: slot("motif"),
                  counter: slot("counter"), movement: slot("movement") };
  // families already on the track from the engine's own draw
  const present = new Set(["pads", "bass", "strings"].map(k => slotFamily(drawn[k])).filter(Boolean));
  let ovBass = null;   // set if a foundational overlay bass DISPLACES the engine bass

  // ovv(role): overlay writes into the slot when present and unlocked, but a trait
  // that would DUPLICATE an instrument family already on the track either displaces
  // (foundational, e.g. Moroder's arp-bass -> owns the bass slot) or yields (its
  // instrument mention is dropped, so no second bass/lead/string bed appears).
  const ovv = (name, val) => {
    if (!ov[name] || lockedRole(name)) return val;
    const meta = ovFam[name];
    if (!meta || !meta.family) { if (name === "motif" || name === "counter") { const f = slotFamily(ov[name]); if (f) present.add(f); } return ov[name]; }
    if (!present.has(meta.family)) { present.add(meta.family); return ov[name]; }
    if (meta.foundational && meta.family === "bass") { ovBass = ov[name]; return val; }  // handled at the bass slot
    if (meta.foundational) return ov[name];
    return val;   // yield: keep the engine's slot, drop the overlay's duplicate
  };

  // resolve overlay-affected slots up front (order matters: ovBass is set here and
  // read by the bass slot below, which is emitted before the motif slot).
  const ovHarmony = ovv("harmony", drawn.harmony);
  const ovTexture = ovv("texture", drawn.texture);
  const ovMotif   = ovv("motif", drawn.motif);
  { const mf = slotFamily(ovMotif); if (mf) present.add(mf); }   // the emitted motif may be a lead
  const ovCounter = ovv("counter", drawn.counter);
  const ovMovement= ovv("movement", drawn.movement);
  const bassSlot  = ovBass || drawn.bass;

  const wantInterplay = engine.interplayAlways || s.arrangement;
  const ipPhrases = (wantInterplay && c.interplay) ? drawInterplay(engineName, clusterId, roll) : [];
  const ipCore = ipPhrases.slice(0, 2).join(", ") || null;   // conversation + foundation
  const ipArc = ov.arc || ipPhrases[2] || null;              // arc (overlay may rewrite it)
  const colorLocked = locks.color != null && locks.color !== "";
  const colorPick = slot("color");
  const colorChance = (typeof c.colorChance === "number") ? c.colorChance : 0.5;
  let color = colorPick && (colorLocked || roll() < colorChance) ? colorPick : null;
  // LEVER 1 — demote overlay colour: suppress it when the overlay already carries a
  // foreground melodic voice (motif/counter), which over-renders otherwise. A
  // producer whose only melodic contribution is colour still gets it.
  const overlayHasForeground = !!(ov.motif || ov.counter);
  if (ov.color && !lockedRole("color") && !overlayHasForeground) color = ov.color;

  // LEVER 1 — front-load the overlay's signature carriers (harmony / motif / counter)
  // directly after the genre+tempo anchor so Suno, which front-weights descriptors,
  // actually renders them. Each is emitted here ONLY when it is overlay-supplied;
  // the engine's own slot content stays in its normal position (so no-overlay output
  // is unchanged). The normal slot below is blanked for whichever the overlay owns.
  const ovFrontHarmony = (ov.harmony && !lockedRole("harmony")) ? ovHarmony : null;
  const ovFrontMotif   = (ov.motif   && !lockedRole("motif"))   ? ovMotif   : null;
  const ovFrontCounter = (ov.counter && !lockedRole("counter"))? ovCounter : null;
  const rhythmSlot = c.beatless ? null : slot("rhythm");
  const rhythm = (rhythmSlot && ov.groove) ? `${rhythmSlot} ${ov.groove}` : rhythmSlot;  // remixer treats the engine's own drums
  const parts = [
    c.genre || STYLE_ENGINES[engineName].genre,  // genre anchor (per-cluster, else engine default)
    tempo,                                // BPM range + energy (or override number)
    ovFrontMotif,                         // LEVER 1: overlay signature carriers, hoisted to the front
    ovFrontCounter,
    ovFrontHarmony,
    { t: drawn.pads, role: "pads" },
    { t: ovFrontHarmony ? null : ovHarmony, role: "harmony" },   // engine harmony only (overlay harmony was hoisted)
    { t: bassSlot, role: "bass" },       // foundational overlay bass displaces the drawn bass here
    { t: rhythm, role: "rhythm" },
    c.beatless ? null : { t: slot("perc"), drop: 2, role: "perc" },      // extra percussion layer
    { t: drawn.strings, role: "strings" },                   // string / choir / chant bed
    { t: ovTexture, drop: 3, role: "texture" },    // secondary sustained layer
    { t: ovFrontMotif ? null : ovMotif, role: "motif" },         // engine motif only (overlay motif hoisted)
    { t: ovFrontCounter ? null : ovCounter, drop: 1, role: "counter" },    // engine counter only (overlay counter hoisted)
    color ? { t: color, drop: 4, role: "color" } : null,  // occasional colour, fills gaps
    ipCore,                               // interaction / arrangement language (mandatory)
    ipArc ? { t: ipArc, drop: 5, ov: !!ov.arc } : null,   // arc — shed first when the budget is tight
    ov.edit ? { t: ov.edit, drop: 6 } : null,     // remixer edit treatment (shed before truncation)
    { t: ovMovement, role: "movement" },   // production movement
    ov.treat ? { t: ov.treat, drop: 7 } : null,   // producer mix treatment (shed first of all)
    buildVocalPhrase(state),
    MASTERING
  ];
  return fitParts(parts, s.maxMode, locks);
}

function buildClusterNegative(clusterId, state) {
  const engineName = state.engine;
  const s = state.style;
  const engine = EngineExtras[engineName] || {};
  const c = (engine.flavourClusters || {})[clusterId] || {};
  const items = [
    (STYLE_ENGINES[engineName] || {}).sourceNegative,
    ...ALWAYS_BAN,
    ...(c.beatless ? BEATLESS_BAN : []),
    ...(c.bannedAdd || []),
    ...((s.ov && s.ov.negative) || []),      // overlay bans (e.g. no SAW-era drums)
    s.negativePrompt
  ].filter(Boolean);
  const removeSet = new Set((c.bannedRemove || []).map(
    x => x.replace(/^[-\s]+/, "").trim().toLowerCase()));
  const seen = new Set();
  const out = [];
  for (const it of items.join(", ").split(",").map(x => x.trim()).filter(Boolean)) {
    const bare = it.replace(/^[-\s]+/, "").trim().toLowerCase();
    if (removeSet.has(bare)) continue;
    if (seen.has(bare)) continue;
    seen.add(bare); out.push(it);
  }
  return out.join(", ");
}

/* ---- classic slot path (any engine) ------------------------------------- */
function buildClassicStyle(state) {
  const e = STYLE_ENGINES[state.engine];
  const s = state.style;
  const ov = (s.ov && s.ov.roles) || {};
  const rhythm = (s.rhythm && ov.groove) ? `${s.rhythm} ${ov.groove}` : s.rhythm;
  const parts = [
    e.genre,                    // genre anchor, front-weighted
    s.phase,                    // tempo + energy/feel only
    s.pad,                      // slots = single source of truth for instrumentation
    ov.harmony || s.harmony,    // chord / song-structure direction (Chords control)
    s.bass,
    rhythm,
    s.percussion,
    ov.motif || s.motif,
    ov.counter || null,         // overlay-only roles (the classic path has no such slots)
    ov.texture || null,
    ov.color || null,
    ov.arc || null,
    ov.edit || null,
    ov.movement || s.movement,
    ov.treat || null,
    buildVocalPhrase(state),
    MASTERING
  ];
  return fitParts(parts, s.maxMode, null);
}

function clusterActive(state) {
  const s = state.style;
  if (s.buildMode !== "cluster") return false;
  const engine = EngineExtras[state.engine] || {};
  return !!(engine.flavourClusters || {})[s.cluster];
}

/* Preset-driven engines (those with a presetMap, e.g. Enigma): the Engine Preset
 * IS the character selector and maps to a flavour cluster, so instrumentation is
 * set behind the scenes. Returns the cluster id for the current preset, or null. */
function presetCluster(state) {
  const map = (EngineExtras[state.engine] || {}).presetMap;
  const hit = map && map[state.style.preset];
  return hit ? hit.cluster : null;
}

/* ---- entry points (app.js calls these) ---------------------------------- */
function buildStylePrompt(state) {
  const pc = presetCluster(state);
  if (pc) return buildClusterPrompt(pc, state);
  if (clusterActive(state)) return buildClusterPrompt(state.style.cluster, state);
  return buildClassicStyle(state);
}

function buildNegativePrompt(state) {
  const pc = presetCluster(state);
  if (pc) return buildClusterNegative(pc, state);
  if (clusterActive(state)) return buildClusterNegative(state.style.cluster, state);
  const e = STYLE_ENGINES[state.engine];
  const ovNeg = ((state.style.ov && state.style.ov.negative) || []).join(", ");
  return [e.sourceNegative || e.negatives, ovNeg, state.style.negativePrompt].filter(Boolean).join(", ");
}

Object.assign(window.__ATMOS, { buildLyricsField, buildClusterPrompt, buildClusterNegative, buildStylePrompt, buildNegativePrompt });
})();

/* core/favourites.js */
(function(){
// Favourites — save a generated prompt and recall it later.
//
// A favourite stores TWO things deliberately:
//   1. CONFIG  — engine, character/palette/preset sub-state, overlays, maxMode and
//                the SEED. Because every path is seeded/deterministic, restoring the
//                config regenerates the same prompt from the live engine.
//   2. SNAPSHOT — the literal style / negative / lyrics text at save time.
//
// Why both: config alone is not durable. The engines are still being revised, so a
// config saved today can render differently after a pool or compose change. The
// snapshot is the guarantee that what John heard in Suno is recoverable verbatim;
// the config is what lets him re-roll around it. On recall the two are compared and
// any divergence is reported rather than silently swallowed.
//
// Storage is browser-local (localStorage). That is the only option for a static,
// backend-free app — see exportAll/importAll for the durable off-machine path.

const KEY = 'atmos.favourites.v1';
const MAX_ITEMS = 500;

function storage() {
  try {
    const s = (typeof localStorage !== 'undefined') ? localStorage : null;
    if (!s) return null;
    s.setItem('__atmos_probe', '1'); s.removeItem('__atmos_probe');
    return s;
  } catch (e) { return null; }   // file:// origin, private mode, or quota-locked
}

function favStorageAvailable() { return storage() !== null; }

function readRaw() {
  const s = storage();
  if (!s) return [];
  try {
    const parsed = JSON.parse(s.getItem(KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter(isValidRecord) : [];
  } catch (e) { return []; }
}

function writeRaw(list) {
  const s = storage();
  if (!s) return false;
  try { s.setItem(KEY, JSON.stringify(list.slice(0, MAX_ITEMS))); return true; }
  catch (e) { return false; }    // quota exceeded
}

function isValidRecord(r) {
  return !!r && typeof r === 'object'
    && typeof r.id === 'string'
    && typeof r.name === 'string'
    && !!r.config && typeof r.config === 'object'
    && !!r.snapshot && typeof r.snapshot.style === 'string';
}

function newId() {
  return 'fav_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

// Deep clone via JSON — the control sub-states are plain data by design.
function clone(o) { return JSON.parse(JSON.stringify(o)); }

// The subset of shell state that fully determines a build. Kept explicit rather
// than cloning S wholesale so a future transient UI field can never leak in.
function favConfigFromState(S) {
  return {
    engineId: S.engineId,
    seed: S.seed,
    maxMode: !!S.maxMode,
    ov: clone(S.ov || {}),
    res: S.res ? clone(S.res) : null,
    leg: S.leg ? clone(S.leg) : null,
    atom: S.atom ? clone(S.atom) : null,
  };
}

// Write a config back onto the live shell state, in place.
function favApplyConfigToState(S, config) {
  S.engineId = config.engineId;
  S.seed = config.seed;
  S.maxMode = !!config.maxMode;
  S.ov = clone(config.ov || { composer: '', producer: '', remixer: '' });
  S.res = config.res ? clone(config.res) : null;
  S.leg = config.leg ? clone(config.leg) : null;
  S.atom = config.atom ? clone(config.atom) : null;
  return S;
}

function favList() {
  return readRaw().sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || ''));
}

function favGet(id) { return readRaw().find(r => r.id === id) || null; }

// out = the generate() result being saved.
function favSave(name, S, out, now) {
  const rec = {
    id: newId(),
    name: (name || '').trim() || defaultName(S),
    savedAt: (now || new Date()).toISOString(),
    engineId: S.engineId,
    config: favConfigFromState(S),
    snapshot: {
      style: out.style || '',
      negative: out.negative || '',
      lyrics: out.lyrics || '',
      metatags: out.metatags || '',
    },
  };
  const next = [rec, ...readRaw().filter(r => r.id !== rec.id)];
  return writeRaw(next) ? rec : null;
}

function favRename(id, name) {
  const list_ = readRaw();
  const r = list_.find(x => x.id === id);
  if (!r) return false;
  r.name = (name || '').trim() || r.name;
  return writeRaw(list_);
}

function favRemove(id) {
  const next = readRaw().filter(r => r.id !== id);
  return writeRaw(next);
}

function favClear() { return writeRaw([]); }

function defaultName(S) {
  const bits = [S.engineId];
  if (S.atom && S.atom.characterId) bits.push(S.atom.characterId);
  else if (S.res && S.res.characterId) bits.push(S.res.characterId);
  else if (S.leg) bits.push(S.leg.preset || S.leg.cluster || 'classic');
  return bits.filter(Boolean).join(' / ');
}

// Recall: restore the config, regenerate from the live engine, and report whether
// the live render still matches the snapshot. `regenerate` is injected so this
// module stays free of engine imports (and testable without the shell).
function favRecall(id, S, regenerate) {
  const rec = favGet(id);
  if (!rec) return null;
  favApplyConfigToState(S, rec.config);
  const live = regenerate ? regenerate(S) : null;
  const drifted = !!live && live.style !== rec.snapshot.style;
  return { record: rec, live, drifted };
}

// ---- portability -----------------------------------------------------------
// localStorage is per-browser and per-origin, and is unavailable on some file://
// origins. Export/import is the durable path: it survives a cache clear, a new
// machine and the download-ZIP build.
function favExportAll() {
  return JSON.stringify({ kind: 'atmos-favourites', version: 1, items: readRaw() }, null, 2);
}

// mode: 'merge' (default, keeps existing) | 'replace'
function favImportAll(json, mode) {
  let parsed;
  try { parsed = JSON.parse(json); } catch (e) { return { ok: false, error: 'Not valid JSON', added: 0 }; }
  const tagged = !!parsed && parsed.kind === 'atmos-favourites';
  const items = (tagged && Array.isArray(parsed.items)) ? parsed.items.filter(isValidRecord) : null;
  if (!items) return { ok: false, error: 'Not an ATMOS favourites file', added: 0 };
  const existing = (mode === 'replace') ? [] : readRaw();
  const seen = new Set(existing.map(r => r.id));
  const added = items.filter(r => !seen.has(r.id));
  const ok = writeRaw([...added, ...existing]);
  return { ok, error: ok ? null : 'Could not write to storage', added: ok ? added.length : 0 };
}

Object.assign(window.__ATMOS, { favStorageAvailable, favConfigFromState, favApplyConfigToState, favList, favGet, favSave, favRename, favRemove, favClear, favRecall, favExportAll, favImportAll });
})();

/* js/registry.js */
(function(){
// Engine registry (Option B): two engine KINDS live in one shell.
//   'resolver' — new engine-agnostic resolver (Delerium; Era/Deep Forest slot in here later)
//   'legacy'   — proven cluster/classic path harvested verbatim (Balearic, Enigma)
//   'stub'     — registered scope, not yet built (none remaining: all six engines are live)
const {ATOM_POOL_CHARACTERS} = window.__ATMOS;
const {atomCharacters, atomOverlayList} = window.__ATMOS;
const {DELERIUM} = window.__ATMOS;
const {ERA} = window.__ATMOS;
const {DEEPFOREST} = window.__ATMOS;
const {SACREDSPIRIT} = window.__ATMOS;
const {EngineExtras} = window.__ATMOS;
const {STYLE_ENGINES} = window.__ATMOS;

const ENGINES = [
  { id: 'Balearic',    kind: 'legacy',   label: 'Balearic' },
  { id: 'Balearic Atom', kind: 'atom',   label: 'Balearic \u00b7 atom', module: ATOM_POOL_CHARACTERS },
  { id: 'Enigma',      kind: 'legacy',   label: 'Enigma' },
  { id: 'Delerium',    kind: 'resolver', label: 'Delerium', module: DELERIUM },
  { id: 'Era',         kind: 'resolver', label: 'Era', module: ERA },
  { id: 'Deep Forest',   kind: 'resolver', label: 'Deep Forest', module: DEEPFOREST },
  { id: 'Sacred Spirit', kind: 'resolver', label: 'Sacred Spirit', module: SACREDSPIRIT },
];

function getEngine(id) {
  return ENGINES.find(e => e.id === id);
}

// ---- atom-kind helpers -----------------------------------------------------
function atomCharacterList(module) { return atomCharacters(module); }
function atomOverlays() { return atomOverlayList(); }

// ---- resolver-kind helpers -------------------------------------------------
const RESOLVER_ROLES = ['pads', 'harmony', 'bass', 'lead', 'voice', 'color', 'movement'];

function resolverCharacters(module) {
  return Object.keys(module.characters).map(id => {
    const c = module.characters[id];
    const tempo = c.beatless ? 'beatless' : `${c.bpm[0]}\u2013${c.bpm[1]} BPM`;
    return { id, label: c.label, source: c.source, tempo };
  });
}

// filtered pool for one role/character/palette -> [{value,label}] for a <select>
function resolverRolePool(module, characterId, role, palette) {
  const pool = (module.characters[characterId].pools[role]) || [];
  const keep = pool.filter(o =>
    palette === 'blend' ? true :
    palette === 'electronic' ? (o.d === 'E' || o.d === 'B') :
    (o.d === 'A' || o.d === 'B'));
  return (keep.length ? keep : pool).map(o => ({ value: o.t, label: o.t }));
}

// ---- legacy-kind helpers ---------------------------------------------------
function legacyPresetMap(id) { return (EngineExtras[id] || {}).presetMap || null; }
function legacyClusters(id)  { return Object.keys((EngineExtras[id] || {}).flavourClusters || {}); }
function legacyClassic(id)   {
  const e = STYLE_ENGINES[id] || {};
  return {
    presets: e.presets || [],
    phases: e.phases || [],
    slots: {
      pad: e.pads || [], harmony: e.harmony || [], bass: e.bass || [], rhythm: e.rhythm || [],
      percussion: e.percussion || [], motif: e.motifs || [], movement: e.movement || [],
    },
  };
}

// Cluster-kind role pools (Balearic flavour clusters + Enigma preset clusters).
// Mirrors the builder's palette rule: acoustic falls back to electronic when a
// palette doesn't define a role; blend can pull either on the character slots.
const CLUSTER_ROLES = ['pads', 'harmony', 'bass', 'rhythm', 'perc', 'strings', 'texture', 'motif', 'counter', 'color', 'movement'];

function legacyCluster(engineId, clusterId) {
  return ((EngineExtras[engineId] || {}).flavourClusters || {})[clusterId] || null;
}

function legacyClusterRolePool(engineId, clusterId, role, palette) {
  const c = legacyCluster(engineId, clusterId);
  if (!c) return [];
  const E = (c.palettes && c.palettes.electronic) || {};
  const A = (c.palettes && c.palettes.acoustic) || {};
  const e = E[role] || [], a = A[role] || [];
  let pool;
  if (palette === 'acoustic') pool = a.length ? a : e;
  else if (palette === 'blend') {
    const character = (role === 'bass' || role === 'strings' || role === 'motif');
    pool = character ? [...new Set([...e, ...a])] : e;
  } else pool = e;
  return pool.map(x => ({ value: x, label: x }));
}

Object.assign(window.__ATMOS, { getEngine, atomCharacterList, atomOverlays, resolverCharacters, resolverRolePool, legacyPresetMap, legacyClusters, legacyClassic, legacyCluster, legacyClusterRolePool, ENGINES, RESOLVER_ROLES, CLUSTER_ROLES });
})();

/* js/state.js */
(function(){
// Shell state. Two control sub-states (resolver vs legacy); the active one is
// chosen by the selected engine's kind. Kept deliberately small — the modifier
// overlays and the Lyric/Metatag engine will add their own sub-states later
// without touching this shape.
const {getEngine, resolverCharacters, atomCharacterList, legacyPresetMap, legacyClusters, legacyClassic} = window.__ATMOS;

function newSeed() { return (Math.random() * 2147483647) >>> 0; }

function initState() {
  // maxMode is global (persists across engine switches); res/leg are per-kind.
  // ov = modifier overlays (Composer / Producer / Remixer). Global like maxMode:
  // an overlay is a hand applied ON TOP of whichever engine is selected.
  const S = { engineId: 'Delerium', seed: newSeed(), maxMode: false,
              ov: { composer: '', producer: '', remixer: '' }, res: null, leg: null, atom: null };
  syncEngineDefaults(S, 'Delerium');
  return S;
}

// (Re)build the control sub-state when the engine changes.
function syncEngineDefaults(S, engineId) {
  S.engineId = engineId;
  S.seed = newSeed();
  const eng = getEngine(engineId);

  if (eng.kind === 'atom') {
    const chars = atomCharacterList(eng.module);
    // palette is an axis on the atom path (electronic | acoustic); characters
    // without palettes (e.g. a validated ref) simply ignore it at generate.
    S.atom = { characterId: chars[0].id, palette: 'electronic', overlayId: '' };
    S.res = null; S.leg = null;
  } else if (eng.kind === 'resolver') {
    const chars = resolverCharacters(eng.module);
    S.res = {
      characterId: chars[0].id,
      palette: 'electronic',
      level: 'random',          // 'random' | 'lockSome' | 'manual'
      locks: {},                // role -> chosen text (only in lockSome/manual)
    };
    S.leg = null; S.atom = null;
  } else if (eng.kind === 'legacy') {
    const presetMap = legacyPresetMap(engineId);
    const clusters = legacyClusters(engineId);
    const classic = legacyClassic(engineId);
    S.leg = {
      presetDriven: !!presetMap,
      engineMode: 'preset',      // preset-driven engines (Enigma): 'preset' | 'manual'
      preset: presetMap ? Object.keys(presetMap)[0] : (classic.presets[0] || ''),
      phase: classic.phases[0] || '',
      buildMode: clusters.length ? 'cluster' : 'classic',
      cluster: clusters[0] || '',
      palette: 'electronic',
      arrangement: false,
      bpmOverride: '',
      chord: '',                 // dedicated Chords control (cluster/preset path)
      classicChord: '',          // dedicated Chords control (classic slot path)
      slots: {
        pad: classic.slots.pad[0] || '', bass: classic.slots.bass[0] || '',
        rhythm: classic.slots.rhythm[0] || '', percussion: classic.slots.percussion[0] || '',
        motif: classic.slots.motif[0] || '', movement: classic.slots.movement[0] || '',
      },
      slotLevel: 'random',       // classic manual: 'random' | 'lockSome' | 'manual'
      slotLocks: {},             // role -> chosen value (classic slot roles)
      clusterLevel: 'random',    // cluster/preset path: 'random' | 'lockSome' | 'manual'
      clusterLocks: {},          // cluster role -> chosen value
      vocalMode: 'Instrumental',
    };
    S.res = null; S.atom = null;
  } else {
    S.res = null; S.leg = null; S.atom = null;   // stub
  }
}

Object.assign(window.__ATMOS, { newSeed, initState, syncEngineDefaults });
})();

/* js/generate.js */
(function(){
// Routes a generate request to the right path for the engine's kind and returns a
// uniform result: { style, negative, lyrics, length, over }.
// Max Mode (global S.maxMode) prepends the MAX directive block for every engine:
//   - legacy engines apply it through their proven maxMode path (byte-identical to old app)
//   - resolver engines get it here in the router
const {getEngine, legacyClassic} = window.__ATMOS;
const {buildAtoms} = window.__ATMOS;
const {atomCharacterForPalette} = window.__ATMOS;
const {build} = window.__ATMOS;
const {CHAR_LIMIT, rng} = window.__ATMOS;
const {resolveOverlays} = window.__ATMOS;
const {EngineExtras} = window.__ATMOS;
const {MAX_MODE_STR} = window.__ATMOS;
const {buildStylePrompt, buildNegativePrompt, buildLyricsField} = window.__ATMOS;

function applyMax(style, on) {
  if (!on) return style;
  const out = MAX_MODE_STR + '\n' + style;
  return out.length <= CHAR_LIMIT ? out : out.slice(0, CHAR_LIMIT - 3).trimEnd() + '...';
}

// A beatless character cannot take a club/rhythm-derived overlay trait.
const BEATLESS_BAN_TAGS = ['four-on-floor', 'club', 'house'];

function overlayFor(S, beatless) {
  const ctx = { beatless, banTags: beatless ? BEATLESS_BAN_TAGS : [] };
  return resolveOverlays(S.ov || {}, ctx);
}

function generate(S) {
  const eng = getEngine(S.engineId);

  if (eng.kind === 'atom') {
    const a = S.atom;
    const char = atomCharacterForPalette(eng.module[a.characterId], a.palette || 'electronic');
    const out = buildAtoms(char, { seed: S.seed, overlayId: a.overlayId || null, maxMode: S.maxMode });
    const style = applyMax(out.style, S.maxMode);
    return {
      style, negative: out.negative, lyrics: '',
      length: style.length, over: style.length > CHAR_LIMIT,
      arrangement: out.arrangement, overlayNote: out.overlayNote,
    };
  }

  if (eng.kind === 'resolver') {
    const r = S.res;
    const locks = (r.level === 'random') ? {} : r.locks;
    const ch = eng.module.characters[r.characterId] || {};
    const out = build(eng.module, {
      characterId: r.characterId, palette: r.palette, locks, seed: S.seed,
      overlay: overlayFor(S, !!ch.beatless),
    });
    const style = applyMax(out.style, S.maxMode);
    return {
      style, negative: out.negative, lyrics: '',
      length: style.length, over: style.length > CHAR_LIMIT, arrangement: out.arrangement,
    };
  }

  if (eng.kind === 'legacy') {
    const state = toLegacyState(S);            // proven builder handles maxMode itself
    const style = buildStylePrompt(state);
    return {
      style,
      negative: buildNegativePrompt(state),
      lyrics: buildLyricsField(state),
      length: style.length,
      over: style.length > CHAR_LIMIT,
    };
  }

  return { style: '', negative: '', lyrics: '', length: 0, over: false, stub: true };
}

// Resolve classic slots for the 3-level manual control (Randomize all / Lock some / Full manual).
// Each role is either locked (chosen) or drawn fresh from the proven STYLE_ENGINES array.
function resolveClassicSlots(engineId, l, seed) {
  const arrs = legacyClassic(engineId).slots;   // {pad:[],bass:[],rhythm:[],percussion:[],motif:[],movement:[]}
  const roll = rng(seed);
  const rand = a => (a && a.length) ? a[Math.floor(roll() * a.length)] : '';
  const out = {};
  ['pad', 'harmony', 'bass', 'rhythm', 'percussion', 'motif', 'movement'].forEach(role => {
    if (l.slotLevel === 'random') out[role] = rand(arrs[role]);
    else {
      const locked = l.slotLocks[role];
      out[role] = (locked != null && locked !== '') ? locked : rand(arrs[role]);
    }
  });
  if (l.classicChord) out.harmony = l.classicChord;   // dedicated Chords control wins at every level
  return out;
}

// Is the legacy path about to render a beatless cluster? (drives overlay context)
function legacyBeatless(S) {
  const l = S.leg;
  const ex = EngineExtras[S.engineId] || {};
  const id = l.presetDriven
    ? ((ex.presetMap && ex.presetMap[l.preset] && ex.presetMap[l.preset].cluster) || '')
    : (l.buildMode === 'cluster' ? l.cluster : '');
  const c = id && (ex.flavourClusters || {})[id];
  return !!(c && c.beatless);
}

// Map the shell's legacy sub-state onto the nested shape the proven builder reads.
function toLegacyState(S) {
  const l = S.leg;
  const ov = overlayFor(S, legacyBeatless(S));

  // Classic slot path with the 3-level control: Enigma 'Manual mix' OR Balearic 'Classic mix'.
  const classicManual = (l.presetDriven && l.engineMode === 'manual') || (!l.presetDriven && l.buildMode === 'classic');
  if (classicManual) {
    const s = resolveClassicSlots(S.engineId, l, S.seed);
    return {
      engine: S.engineId,
      style: {
        buildMode: 'classic', cluster: '', preset: '',   // unmapped preset -> classic path
        palette: l.palette, arrangement: false, bpmOverride: '',
        phase: l.phase,
        pad: s.pad, harmony: s.harmony, bass: s.bass, rhythm: s.rhythm,
        percussion: s.percussion, motif: s.motif, movement: s.movement,
        vocalMode: l.vocalMode, vocalDescriptor: '', vocalPersona: '',
        maxMode: S.maxMode, negativePrompt: '', ov,
      },
    };
  }

  return {
    engine: S.engineId,
    style: {
      buildMode: l.presetDriven ? 'classic' : l.buildMode, // preset-driven auto-routes via presetMap
      cluster: l.cluster,
      palette: l.palette,
      arrangement: l.arrangement,
      rngSeed: S.seed,                                     // cluster path is deterministic per seed
      // Chords is its own top-level control and applies at every control level.
      slotLocks: Object.assign({},
        (l.clusterLevel === 'random') ? {} : l.clusterLocks,
        l.chord ? { harmony: l.chord } : {}),
      bpmOverride: l.bpmOverride,
      preset: l.preset,
      phase: l.phase,
      pad: l.slots.pad, bass: l.slots.bass, rhythm: l.slots.rhythm,
      percussion: l.slots.percussion, motif: l.slots.motif, movement: l.slots.movement,
      vocalMode: l.vocalMode, vocalDescriptor: '', vocalPersona: '',
      maxMode: S.maxMode, negativePrompt: '', ov,
    },
  };
}

Object.assign(window.__ATMOS, { generate });
})();

/* js/ui.js */
(function(){
const {ENGINES, getEngine, RESOLVER_ROLES, resolverCharacters, resolverRolePool, atomCharacterList, atomOverlays, legacyClusters, legacyClassic, legacyCluster, legacyClusterRolePool, CLUSTER_ROLES,} = window.__ATMOS;
const {syncEngineDefaults, newSeed} = window.__ATMOS;
const {generate} = window.__ATMOS;
const {overlayList} = window.__ATMOS;
const {favStorageAvailable, favList, favSave, favRemove, favRecall, favExportAll, favImportAll} = window.__ATMOS;

// ---- tiny DOM helpers ------------------------------------------------------
function el(tag, attrs = {}, kids = []) {
  const n = document.createElement(tag);
  for (const k in attrs) {
    if (k === 'class') n.className = attrs[k];
    else if (k === 'text') n.textContent = attrs[k];
    else if (k === 'html') n.innerHTML = attrs[k];
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), attrs[k]);
    else n.setAttribute(k, attrs[k]);
  }
  (Array.isArray(kids) ? kids : [kids]).forEach(c => c && n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
  return n;
}
function field(label, control) { return el('label', { class: 'field' }, [el('span', { class: 'field-label', text: label }), control]); }
function select(options, value, onchange) {
  const s = el('select', { onchange: e => onchange(e.target.value) });
  options.forEach(o => {
    const opt = el('option', { value: o.value }, o.label);
    if (o.value === value) opt.selected = true;
    s.appendChild(opt);
  });
  return s;
}
function segmented(options, value, onpick) {
  // The active class is updated here on click. Handlers that only call
  // refreshOutput() (they repaint the output panel, not the controls) previously
  // left the highlight stuck on the old option even though the prompt changed.
  const wrap = el('div', { class: 'seg' });
  const btns = options.map(o => el('button', {
    class: o.value === value ? 'active' : '',
    text: o.label,
    onclick: (e) => {
      btns.forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      onpick(o.value);
    },
  }));
  btns.forEach(b => wrap.appendChild(b));
  return wrap;
}

// Shared 3-level control (Randomize all / Lock some / Full manual) over any role set.
// opts: { roles, labelFor, optionsFor(role)->[{value,label}], level, onLevel(v), locks }
function lockControl(root, opts) {
  root.appendChild(field('Control level', segmented(
    [['random', 'Randomize all'], ['lockSome', 'Lock some'], ['manual', 'Full manual']].map(([value, label]) => ({ value, label })),
    opts.level, v => opts.onLevel(v))));
  if (opts.level === 'random') return;
  const box = el('div', { class: 'locks' });
  opts.roles.forEach(role => {
    const options = [{ value: '', label: '\uD83C\uDFB2 random' }, ...opts.optionsFor(role)];
    const cur = opts.locks[role] != null ? opts.locks[role] : '';
    box.appendChild(field(opts.labelFor(role),
      select(options, cur, v => { if (v === '') delete opts.locks[role]; else opts.locks[role] = v; refreshOutput(); })));
  });
  root.appendChild(box);
}
function clusterRoleLabel(role) {
  return { pads: 'Pads', harmony: 'Chords', bass: 'Bass', rhythm: 'Drums', perc: 'Percussion layer',
           strings: 'Strings / choir', texture: 'Texture layer', motif: 'Motif',
           counter: 'Counter-melody', color: 'Colour', movement: 'Movement' }[role] || role;
}
// Chords is surfaced as its own top-level control (it drives the song's harmonic
// and structural shape), so it is excluded from the instrument lock box.
function chordField(pool, value, onpick) {
  const options = [{ value: '', label: '\uD83C\uDFB2 random chords' }, ...pool];
  return field('Chords', select(options, value, onpick));
}
// Roles this cluster actually populates for the active palette (beatless clusters
// have no rhythm pool; a cluster with no colour pool shows no Colour row).
function clusterRolesFor(engineId, clusterId, palette) {
  return CLUSTER_ROLES.filter(r => r !== 'harmony' && legacyClusterRolePool(engineId, clusterId, r, palette).length);
}
function seedClusterManual(engineId, clusterId, palette, l) {
  clusterRolesFor(engineId, clusterId, palette).forEach(role => {
    const pool = legacyClusterRolePool(engineId, clusterId, role, palette);
    if (pool.length) l.clusterLocks[role] = pool[0].value;
  });
}
function clusterLockControl(root, engineId, clusterId, l) {
  lockControl(root, {
    roles: clusterRolesFor(engineId, clusterId, l.palette),
    labelFor: clusterRoleLabel,
    optionsFor: role => legacyClusterRolePool(engineId, clusterId, role, l.palette),
    level: l.clusterLevel,
    onLevel: v => {
      l.clusterLevel = v; l.clusterLocks = {};
      if (v === 'manual') seedClusterManual(engineId, clusterId, l.palette, l);
      renderAll();
    },
    locks: l.clusterLocks,
  });
}
function classicSlotLabel(role) {
  return { pad: 'Pad', bass: 'Bass', rhythm: 'Rhythm', percussion: 'Strings', motif: 'Motif', movement: 'Movement' }[role] || role;
}
const CLASSIC_ROLES = ['pad', 'bass', 'rhythm', 'percussion', 'motif', 'movement'];

// ---- module state ----------------------------------------------------------
let S, rootEl;
function mount(state, root) { S = state; rootEl = root; renderAll(); }

function renderAll() {
  rootEl.innerHTML = '';
  rootEl.appendChild(el('div', { class: 'tabs' }, ENGINES.map(e => {
    const disabled = e.kind === 'stub';
    return el('button', {
      class: 'tab' + (e.id === S.engineId ? ' active' : '') + (disabled ? ' disabled' : ''),
      onclick: () => { if (!disabled) { syncEngineDefaults(S, e.id); favRecalled = null; favNotice = ''; renderAll(); } },
    }, [el('span', { text: e.label }), el('span', { class: 'kind', text: e.kind === 'resolver' ? 'resolver' : e.kind === 'legacy' ? 'proven' : e.kind === 'atom' ? 'atom' : 'soon' })]);
  })));

  const grid = el('div', { class: 'grid' });
  const controls = el('div', { class: 'panel controls' });
  const output = el('div', { class: 'panel output', id: 'output' });
  grid.appendChild(controls); grid.appendChild(output);
  rootEl.appendChild(grid);

  const eng = getEngine(S.engineId);
  if (eng.kind === 'atom') renderAtomControls(controls, eng);
  else if (eng.kind === 'resolver') renderResolverControls(controls, eng);
  else if (eng.kind === 'legacy') renderLegacyControls(controls, eng);
  else renderStub(controls, eng);
  if (eng.kind !== 'stub' && eng.kind !== 'atom') overlayPanel(controls);
  if (eng.kind !== 'stub') favouritesPanel(controls);

  refreshOutput();
}

// ---- favourites ------------------------------------------------------------
// Save the current build (config + the literal prompt text) and recall it later.
// Recall restores the config so the prompt can be re-rolled around, and warns if
// the live engine no longer renders what was saved.
let favNotice = '';

function favouritesPanel(root) {
  const box = el('div', { class: 'favourites' });
  box.appendChild(el('h4', { text: 'Favourites' }));

  if (!favStorageAvailable()) {
    box.appendChild(el('p', { class: 'hint', text: 'Browser storage is unavailable here (this happens on file:// pages). Favourites cannot be saved in this window.' }));
    root.appendChild(box);
    return;
  }

  const nameInput = el('input', { type: 'text', placeholder: 'name this prompt\u2026', class: 'fav-name' });
  const saveBtn = el('button', {
    class: 'ghost', text: 'Save current',
    onclick: () => {
      const rec = favSave(nameInput.value, S, generate(S));
      favNotice = rec ? `Saved \u201c${rec.name}\u201d` : 'Could not save \u2014 browser storage is full.';
      renderAll();
    },
  });
  box.appendChild(el('div', { class: 'fav-save' }, [nameInput, saveBtn]));

  const items = favList();
  if (!items.length) box.appendChild(el('p', { class: 'hint', text: 'No favourites saved yet.' }));

  items.forEach(r => {
    const row = el('div', { class: 'fav-row' }, [
      el('span', { class: 'fav-label', text: r.name, title: `${r.engineId} \u00b7 ${r.savedAt.slice(0, 16).replace('T', ' ')}` }),
      el('button', {
        class: 'link', text: 'Load',
        onclick: () => {
          const res = favRecall(r.id, S, generate);
          favNotice = res && res.drifted
            ? `Loaded \u201c${r.name}\u201d \u2014 the engine has changed since it was saved, so the live render differs from the snapshot. The saved text is below.`
            : `Loaded \u201c${r.name}\u201d.`;
          favRecalled = res && res.drifted ? res.record : null;
          renderAll();
        },
      }),
      el('button', {
        class: 'link', text: 'Copy',
        onclick: (e) => { copy(r.snapshot.style); e.target.textContent = 'Copied'; setTimeout(() => e.target.textContent = 'Copy', 1200); },
      }),
      el('button', {
        class: 'link danger', text: 'Delete',
        onclick: () => { favRemove(r.id); favNotice = `Deleted \u201c${r.name}\u201d.`; renderAll(); },
      }),
    ]);
    box.appendChild(row);
  });

  box.appendChild(el('div', { class: 'fav-io' }, [
    el('button', {
      class: 'link', text: 'Export all',
      onclick: () => downloadText('atmos-favourites.json', favExportAll()),
    }),
    el('button', {
      class: 'link', text: 'Import',
      onclick: () => pickJson(txt => {
        const r = favImportAll(txt, 'merge');
        favNotice = r.ok ? `Imported ${r.added} favourite${r.added === 1 ? '' : 's'}.` : `Import failed: ${r.error}`;
        renderAll();
      }),
    }),
  ]));

  if (favNotice) box.appendChild(el('p', { class: 'hint', text: favNotice }));
  root.appendChild(box);
}

// Set when a recalled favourite no longer matches the live engine; the saved text
// is then shown alongside the live output so nothing is silently lost.
let favRecalled = null;

function downloadText(filename, text) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: filename });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function pickJson(onload) {
  const input = el('input', { type: 'file', accept: 'application/json,.json' });
  input.addEventListener('change', () => {
    const f = input.files && input.files[0];
    if (!f) return;
    const fr = new FileReader();
    fr.onload = () => onload(String(fr.result || ''));
    fr.readAsText(f);
  });
  input.click();
}

// ---- atom controls ---------------------------------------------------------
function renderAtomControls(root, eng) {
  const a = S.atom;
  const chars = atomCharacterList(eng.module);
  root.appendChild(field('Character',
    select(chars.map(x => ({ value: x.id, label: `${x.label} \u2014 ${x.source}` })), a.characterId,
      v => { a.characterId = v; renderAll(); })));

  // Palette axis (electronic | acoustic) — draws each role from that palette's pool.
  if (eng.module[a.characterId] && eng.module[a.characterId].palettes) {
    const palOpts = [{ value: 'electronic', label: 'Electronic' }, { value: 'acoustic', label: 'Acoustic' }];
    root.appendChild(field('Palette', segmented(palOpts, a.palette || 'electronic',
      v => { a.palette = v; refreshOutput(); })));
  }

  const ovOpts = [{ value: '', label: 'None' }]
    .concat(atomOverlays().map(o => ({ value: o.id, label: `${o.label} (${o.kind})` })));
  root.appendChild(field('Overlay', select(ovOpts, a.overlayId || '', v => { a.overlayId = v; refreshOutput(); })));

  root.appendChild(el('p', { class: 'note', text: 'Atom assembly path. Overlays are congruent-by-default \u2014 an incongruent one is refused (shown below the prompt).' }));
  root.appendChild(buttons());
}

// ---- resolver controls -----------------------------------------------------
function renderResolverControls(root, eng) {
  const r = S.res;
  const chars = resolverCharacters(eng.module);
  const c = eng.module.characters[r.characterId];

  root.appendChild(field('Character',
    select(chars.map(x => ({ value: x.id, label: `${x.label} \u2014 ${x.source} \u2014 ${x.tempo}` })), r.characterId,
      v => { r.characterId = v; r.locks = {}; renderAll(); })));

  root.appendChild(field('Palette',
    segmented([['electronic', 'Electronic'], ['acoustic', 'Acoustic'], ['blend', 'Blend']].map(([value, label]) => ({ value, label })),
      r.palette, v => { r.palette = v; r.locks = {}; renderAll(); })));

  lockControl(root, {
    roles: RESOLVER_ROLES.filter(role => !(role === 'color' && c.colorChance === 0)),
    labelFor: roleLabel,
    optionsFor: role => resolverRolePool(eng.module, r.characterId, role, r.palette),
    level: r.level,
    onLevel: v => { r.level = v; r.locks = {}; if (v === 'manual') seedManualLocks(eng, r); renderAll(); },
    locks: r.locks,
  });

  const drums = c.beatless ? 'Beatless (no drum pool)' : `Auto \u2014 ${c.drums.primary} family`;
  root.appendChild(el('p', { class: 'note', text: `Drums: ${drums}. Colour fires ~${Math.round(c.colorChance * 100)}% of draws.` }));

  root.appendChild(buttons());
}
function seedManualLocks(eng, r) {
  const c = eng.module.characters[r.characterId];
  RESOLVER_ROLES.forEach(role => {
    if (role === 'color' && c.colorChance === 0) return;
    const pool = resolverRolePool(eng.module, r.characterId, role, r.palette);
    if (pool.length) r.locks[role] = pool[0].value;
  });
}
function roleLabel(role) {
  return { pads: 'Pads', harmony: 'Harmony', bass: 'Bass', lead: 'Lead', voice: 'Voice', color: 'Colour', movement: 'Movement' }[role] || role;
}
function seedClassicManual(engineId, l) {
  const arrs = legacyClassic(engineId).slots;
  CLASSIC_ROLES.forEach(role => { const a = arrs[role] || []; if (a.length) l.slotLocks[role] = a[0]; });
}

// ---- legacy controls -------------------------------------------------------
function renderLegacyControls(root, eng) {
  const l = S.leg;

  if (l.presetDriven) {
    root.appendChild(field('Engine mode',
      segmented([['preset', 'Engine preset'], ['manual', 'Manual mix']].map(([value, label]) => ({ value, label })),
        l.engineMode, v => { l.engineMode = v; renderAll(); })));

    if (l.engineMode === 'preset') {
      const map = (window.__ATMOS.EngineExtras[eng.id] || {}).presetMap;
      root.appendChild(field('Engine preset',
        select(Object.keys(map).map(k => ({ value: k, label: k })), l.preset,
          v => { l.preset = v; l.clusterLocks = {}; l.chord = ''; renderAll(); })));
      root.appendChild(field('Phase (tempo / energy)',
        select(legacyClassic(eng.id).phases.map(p => ({ value: p, label: p })), l.phase,
          v => { l.phase = v; refreshOutput(); })));
      root.appendChild(field('Palette',
        segmented(seg3(), l.palette, v => { l.palette = v; l.clusterLocks = {}; l.chord = ''; renderAll(); })));
      root.appendChild(chordField(
        legacyClusterRolePool(eng.id, (map[l.preset] || {}).cluster, 'harmony', l.palette),
        l.chord, v => { l.chord = v; refreshOutput(); }));
      clusterLockControl(root, eng.id, (map[l.preset] || {}).cluster, l);
      root.appendChild(el('p', { class: 'note', text: 'Interaction / arrangement language is always on.' }));
      root.appendChild(field('Vocal', segmented(vocalSeg(), l.vocalMode, v => { l.vocalMode = v; refreshOutput(); })));
      root.appendChild(buttons());
      return;
    }

    // manual mix — proven classic slot path with the same 3-level control as Delerium
    root.appendChild(field('Phase (tempo / energy)',
      select(legacyClassic(eng.id).phases.map(p => ({ value: p, label: p })), l.phase, v => { l.phase = v; refreshOutput(); })));
    root.appendChild(chordField(
      (legacyClassic(eng.id).slots.harmony || []).map(x => ({ value: x, label: x })),
      l.classicChord, v => { l.classicChord = v; refreshOutput(); }));
    lockControl(root, {
      roles: CLASSIC_ROLES,
      labelFor: classicSlotLabel,
      optionsFor: role => (legacyClassic(eng.id).slots[role] || []).map(x => ({ value: x, label: x })),
      level: l.slotLevel,
      onLevel: v => { l.slotLevel = v; l.slotLocks = {}; if (v === 'manual') seedClassicManual(eng.id, l); renderAll(); },
      locks: l.slotLocks,
    });
    root.appendChild(field('Vocal', segmented(vocalSeg(), l.vocalMode, v => { l.vocalMode = v; refreshOutput(); })));
    root.appendChild(buttons());
    return;
  }

  // fork engine (Balearic): Flavour cluster / Classic mix
  root.appendChild(field('Build mode',
    segmented([['cluster', 'Flavour cluster'], ['classic', 'Classic mix']].map(([value, label]) => ({ value, label })),
      l.buildMode, v => { l.buildMode = v; renderAll(); })));

  if (l.buildMode === 'cluster') {
    root.appendChild(field('Cluster',
      select(legacyClusters(eng.id).map(k => ({ value: k, label: clusterLabel(eng.id, k) })), l.cluster,
        v => { l.cluster = v; l.clusterLocks = {}; l.chord = ''; renderAll(); })));
    root.appendChild(field('Palette', segmented(seg3(), l.palette,
      v => { l.palette = v; l.clusterLocks = {}; l.chord = ''; renderAll(); })));
    root.appendChild(field('BPM override', el('input', { class: 'txt', type: 'text', value: l.bpmOverride, placeholder: 'optional', oninput: e => { l.bpmOverride = e.target.value; refreshOutput(); } })));
    root.appendChild(chordField(
      legacyClusterRolePool(eng.id, l.cluster, 'harmony', l.palette),
      l.chord, v => { l.chord = v; refreshOutput(); }));
    clusterLockControl(root, eng.id, l.cluster, l);
    root.appendChild(el('p', { class: 'note', text: 'Interaction / arrangement language is always on for Balearic clusters.' }));
  } else {
    root.appendChild(field('Phase', select(legacyClassic(eng.id).phases.map(p => ({ value: p, label: p })), l.phase, v => { l.phase = v; refreshOutput(); })));
    root.appendChild(chordField(
      (legacyClassic(eng.id).slots.harmony || []).map(x => ({ value: x, label: x })),
      l.classicChord, v => { l.classicChord = v; refreshOutput(); }));
    lockControl(root, {
      roles: CLASSIC_ROLES,
      labelFor: classicSlotLabel,
      optionsFor: role => (legacyClassic(eng.id).slots[role] || []).map(x => ({ value: x, label: x })),
      level: l.slotLevel,
      onLevel: v => { l.slotLevel = v; l.slotLocks = {}; if (v === 'manual') seedClassicManual(eng.id, l); renderAll(); },
      locks: l.slotLocks,
    });
  }
  root.appendChild(field('Vocal', segmented(vocalSeg(), l.vocalMode, v => { l.vocalMode = v; refreshOutput(); })));
  root.appendChild(buttons());
}

function clusterLabel(engineId, clusterId) {
  const c = legacyCluster(engineId, clusterId);
  return c && c.label ? c.label : clusterId;
}
function seg3() { return [['electronic', 'Electronic'], ['acoustic', 'Acoustic'], ['blend', 'Blend']].map(([value, label]) => ({ value, label })); }
function vocalSeg() { return [['Instrumental', 'Instrumental'], ['Descriptor', 'Descriptor'], ['Persona', 'Persona']].map(([value, label]) => ({ value, label })); }
function toggle(label, checked, onchange) {
  const cb = el('input', { type: 'checkbox', onchange: e => onchange(e.target.checked) });
  cb.checked = checked;
  return el('label', { class: 'toggle' }, [cb, el('span', { text: label })]);
}

function renderStub(root, eng) {
  root.appendChild(el('div', { class: 'stub' }, [
    el('h3', { text: `${eng.label} \u2014 not built yet` }),
    el('p', { text: 'Registered in scope. Slots into the resolver kind (same as Delerium) once its palette + character pools are authored and validated.' }),
  ]));
}

// ---- modifier overlays (Composer / Producer / Remixer) ---------------------
// Engine-agnostic: an overlay is a hand applied on top of whichever engine is
// selected. It writes into the engine's existing slots (harmony / motif / counter
// / texture / colour / movement / arc), never the genre anchor, tempo or drums.
function overlayPanel(root) {
  const box = el('div', { class: 'overlays' });
  box.appendChild(el('h4', { text: 'Modifier overlays' }));
  const kinds = [['composer', 'Composer'], ['producer', 'Producer'], ['remixer', 'Remixer']];
  kinds.forEach(([kind, label]) => {
    const opts = [{ value: '', label: 'none' }].concat(
      overlayList(kind).map(o => ({ value: o.id, label: o.family ? `${o.label} (${o.family})` : o.label })));
    box.appendChild(field(label, select(opts, S.ov[kind], v => { S.ov[kind] = v; refreshOutput(); })));
  });
  root.appendChild(box);
}

// ---- shared buttons + output ----------------------------------------------
function buttons() {
  return el('div', { class: 'actions-wrap' }, [
    el('div', { class: 'maxmode' }, toggle('Max Mode', S.maxMode, v => { S.maxMode = v; refreshOutput(); })),
    el('div', { class: 'actions' }, [
      el('button', { class: 'primary', text: 'Generate', onclick: () => { S.seed = newSeed(); favRecalled = null; refreshOutput(); } }),
      el('button', { class: 'ghost', text: 'Re-roll instruments', onclick: () => { S.seed = newSeed(); favRecalled = null; refreshOutput(); } }),
    ]),
  ]);
}

function refreshOutput() {
  const host = document.getElementById('output');
  if (!host) return;
  host.innerHTML = '';
  const eng = getEngine(S.engineId);
  if (eng.kind === 'stub') { host.appendChild(el('p', { class: 'note', text: 'Select a built engine to generate.' })); return; }

  const res = generate(S);
  if (favRecalled) {
    host.appendChild(outBlock('Saved snapshot \u2014 style prompt', favRecalled.snapshot.style,
      favRecalled.snapshot.style.length, favRecalled.snapshot.style.length > 1000,
      'Captured when this favourite was saved. The engine has changed since, so the live render below differs.'));
  }
  host.appendChild(outBlock('Style prompt', res.style, res.length, res.over));
  if (res.overlayNote) host.appendChild(el('p', { class: 'note', text: `Overlay: ${res.overlayNote}` }));
  host.appendChild(outBlock('Negative prompt', res.negative, null, false));
  const lyr = res.lyrics || '[Instrumental]';
  host.appendChild(outBlock('Lyrics field', lyr, null, false, 'Paste into Suno\u2019s lyrics box; use Suno\u2019s Instrumental toggle for reliable vocal suppression.'));
}

function outBlock(title, text, length, over, hint) {
  const head = el('div', { class: 'out-head' }, [el('h4', { text: title })]);
  if (length != null) head.appendChild(el('span', { class: 'meter' + (over ? ' over' : ''), text: `${length}/1000` }));
  head.appendChild(el('button', { class: 'copy', text: 'Copy', onclick: (e) => { copy(text); e.target.textContent = 'Copied'; setTimeout(() => e.target.textContent = 'Copy', 1200); } }));
  const ta = el('textarea', { class: 'out', readonly: 'readonly', rows: 1 }, text);
  autoGrow(ta);
  const kids = [head, ta];
  if (hint) kids.push(el('p', { class: 'hint', text: hint }));
  return el('div', { class: 'out-block' }, kids);
}
// Grow/shrink a textarea to fit its content so the window expands and contracts
// with the prompt instead of snapping back to a fixed height on every change.
function autoGrow(ta) {
  const fit = () => { ta.style.height = 'auto'; ta.style.height = (ta.scrollHeight + 2) + 'px'; };
  ta.addEventListener('input', fit);
  // scrollHeight is only correct once the element is in the document + laid out.
  requestAnimationFrame(fit);
  setTimeout(fit, 0);
}
function copy(t) {
  if (navigator.clipboard) navigator.clipboard.writeText(t).catch(() => {});
}

Object.assign(window.__ATMOS, { mount });
})();

/* js/app.js */
(function(){
const {initState} = window.__ATMOS;
const {mount} = window.__ATMOS;

function boot() {
  const root = document.getElementById('app');
  if (!root) return;
  mount(initState(), root);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

})();

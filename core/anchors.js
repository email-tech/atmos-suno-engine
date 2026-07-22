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
export const ANCHOR_IDENTITIES = {

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
export const ANCHOR_DENYLIST = Object.freeze([
  'Blank & Jones', 'Enigma', 'Delerium', 'Deep Forest', 'Era', 'Sacred Spirit',
  'Chicane', 'Jose Padilla', 'José Padilla', 'Schiller', 'Moby',
]);

export function anchorList(engine) {
  return Object.entries(ANCHOR_IDENTITIES)
    .filter(([, a]) => !engine || a.engine === engine)
    .map(([id, a]) => ({ id, label: a.label, engine: a.engine, note: a.note, lean: a.lean }));
}

/* Is this anchor congruent with the character/palette in play? An
 * electronic-lean anchor is refused on an acoustic palette, mirroring the
 * modifier lean gate. */
export function anchorCongruent(anchorId, palette) {
  const a = ANCHOR_IDENTITIES[anchorId];
  if (!a) return false;
  if (a.lean === 'electronic' && palette !== 'electronic') return false;
  return true;
}

/* applyAnchor — insert the anchor text directly AFTER the genre anchor at the
 * front of a rendered style string. Returns the style unchanged when no anchor
 * is selected or the anchor is not congruent, so default output is untouched. */
export function applyAnchor(style, anchorId, palette) {
  if (!style || !anchorId) return style;
  const a = ANCHOR_IDENTITIES[anchorId];
  if (!a || !anchorCongruent(anchorId, palette)) return style;
  if (style.includes(a.text)) return style;   // idempotent: never double-anchor
  const i = style.indexOf(',');
  if (i < 0) return `${style}, ${a.text}`;
  return `${style.slice(0, i)}, ${a.text}${style.slice(i)}`;
}

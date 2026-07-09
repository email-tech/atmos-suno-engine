import { ALWAYS_BAN, BEATLESS_BAN, MASTERING, CHAR_LIMIT, rng, filterPalette } from './constants.js';

// opts: { characterId, palette:'electronic'|'acoustic'|'blend', locks:{role:text}, seed }
// locks drive all three control levels:
//   randomize all  = locks {}
//   lock some      = locks {pads:'...'}
//   full manual    = every role locked
export function resolveArrangement(engine, opts) {
  const { characterId, palette = 'electronic', locks = {}, seed = Date.now() } = opts;
  const c = engine.characters[characterId];
  if (!c) throw new Error(`unknown character ${characterId}`);
  const rand = rng(seed);
  const pick = (role) => {
    if (locks[role] != null) return locks[role];               // manual / locked
    const pool = filterPalette(c.pools[role] || [], palette);
    if (!pool.length) return null;
    return pool[Math.floor(rand() * pool.length)].t;           // randomized
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
  };

  // drums (skip when beatless)
  if (!c.beatless && c.drums.primary) {
    const fam = engine.drums[c.drums.primary];
    arr.drums = fam[Math.floor(rand() * fam.length)];
  }
  // color fires occasionally
  if (rand() < c.colorChance) arr.color = pick('color');

  // interplay / arrangement layer: RESOLVED into the structured arrangement but
  // NOT rendered into the style string. It is carried to the metatag/section
  // layer as bracketed functional cues (Suno reads structure in the lyrics field).
  const ip = (engine.interplay && engine.interplay[characterId]) || {};
  arr.interplay = ['conversation','foundation','arc']
    .map(dim => (ip[dim] && ip[dim].length) ? ip[dim][Math.floor(rand() * ip[dim].length)] : null)
    .filter(Boolean);
  // first-pass metatag cues (final functional rework happens in the metatag engine)
  arr.metatagCues = arr.interplay.map(p => `[${p}]`);

  // tight-style fields
  arr.bpmSingle = c.bpm ? Math.round((c.bpm[0] + c.bpm[1]) / 2) : null;
  arr.groove = (!c.beatless && c.drums.primary) ? (engine.grooveTag?.[c.drums.primary] || null) : null;
  arr.styleArc = (engine.styleArc && engine.styleArc[characterId]) || null;

  return arr;
}

// STYLE STRING = tight, front-weighted tag stack (~8-9 tags). Order:
// genre anchor -> tempo -> groove -> featured instruments -> production -> arc -> mastering.
// Interplay prose, harmony, color and the full drum phrase are deliberately excluded
// (they live in the structured arrangement for the metatag/section layer).
export function renderStyle(engine, arr) {
  const parts = [arr.genre];
  const tempo = arr.beatless ? 'beatless'
    : `${arr.bpmSingle} BPM${arr.groove ? ' ' + arr.groove : ''}`;
  parts.push(tempo);
  for (const role of engine.styleFeatured) if (arr[role]) parts.push(arr[role]);
  if (arr.movement) parts.push(arr.movement);   // one production cue
  if (arr.styleArc) parts.push(arr.styleArc);    // one distilled arc tag
  return parts.join(', ') + '. ' + MASTERING;
}

export function renderNegative(engine, arr) {
  const bans = [...engine.sourceNegative, ...ALWAYS_BAN];
  if (arr.beatless) bans.push(...BEATLESS_BAN);
  // de-dupe, preserve order
  return [...new Set(bans)].join(', ');
}

export function build(engine, opts) {
  const arr = resolveArrangement(engine, opts);
  const style = renderStyle(engine, arr);
  return { arrangement: arr, style, negative: renderNegative(engine, arr), length: style.length,
           overLimit: style.length > CHAR_LIMIT };
}

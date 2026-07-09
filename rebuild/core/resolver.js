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

  // interplay / arrangement layer (always on): one phrase per applicable dimension
  const ip = (engine.interplay && engine.interplay[characterId]) || {};
  arr.interplay = ['conversation','foundation','arc']
    .map(dim => (ip[dim] && ip[dim].length) ? ip[dim][Math.floor(rand() * ip[dim].length)] : null)
    .filter(Boolean);

  return arr;
}

export function renderStyle(engine, arr) {
  const tempo = arr.beatless
    ? `beatless, ${arr.energy} energy`
    : `${arr.bpm[0]}-${arr.bpm[1]} BPM, ${arr.energy} energy`;

  const parts = [arr.genre, tempo];
  for (const role of engine.order) {
    if (role === 'drums' && arr.beatless) continue;
    if (role === 'interplay') { if (arr.interplay) parts.push(...arr.interplay); continue; }
    if (arr[role]) parts.push(arr[role]);
  }
  let out = parts.join(', ') + '. ' + MASTERING;
  return out;
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

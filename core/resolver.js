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
export function renderStyle(engine, arr) {
  const ip = arr.ip || {};
  const clauses = [arr.genre];

  // tempo + energy
  clauses.push(arr.beatless
    ? `beatless, ${arr.energy} energy`
    : `${arr.bpm[0]}-${arr.bpm[1]} BPM, ${arr.energy} energy`);
  if (arr.tempoLock) clauses.push(arr.tempoLock);

  // foundation: drums(+)bass + how they lock/float
  if (arr.bass) {
    const low = arr.drums ? `${arr.drums} and ${arr.bass}` : arr.bass;
    clauses.push(ip.foundation ? `${low} ${ip.foundation}` : low);
  } else if (arr.drums) {
    clauses.push(ip.foundation ? `${arr.drums} ${ip.foundation}` : arr.drums);
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

  // harmony (musicality slot — its own clause)
  if (arr.harmony) clauses.push(arr.harmony);

  // voice + how it sits
  if (arr.voice) clauses.push(ip.voiceRel ? `${arr.voice} ${ip.voiceRel}` : arr.voice);

  // colour (only when it fired) + how it sits
  if (arr.color) clauses.push(ip.colorRel ? `${arr.color} ${ip.colorRel}` : arr.color);

  // production movement + the arc of the whole arrangement
  if (arr.movement) clauses.push(ip.arc ? `${arr.movement} and ${ip.arc}` : arr.movement);
  else if (ip.arc) clauses.push(ip.arc);

  return clauses.join(', ') + '. ' + MASTERING;
}

export function renderNegative(engine, arr) {
  const bans = [...engine.sourceNegative, ...ALWAYS_BAN];
  if (arr.negative) bans.push(...arr.negative);
  if (arr.beatless) bans.push(...BEATLESS_BAN);
  return [...new Set(bans)].join(', ');
}

export function build(engine, opts) {
  const arr = resolveArrangement(engine, opts);
  const style = renderStyle(engine, arr);
  return { arrangement: arr, style, negative: renderNegative(engine, arr), length: style.length,
           overLimit: style.length > CHAR_LIMIT };
}

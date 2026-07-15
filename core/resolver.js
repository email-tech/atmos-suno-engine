import { ALWAYS_BAN, BEATLESS_BAN, MASTERING, CHAR_LIMIT, rng, filterPalette } from './constants.js';
import { compactPart } from './compress.js';
import { slotFamily } from './overlays.js';

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

  // overlay: secondary melodic voice / composer's thematic hand (when the engine's
  // signature lead is kept) and the composer's counter-melody
  if (arr.ovMotif) clauses.push(arr.ovMotif);
  if (arr.ovCounter) clauses.push(arr.ovCounter);

  // harmony (musicality slot — its own clause)
  if (arr.harmony) clauses.push(arr.harmony);

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

export function renderNegative(engine, arr) {
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

  if (r.harmony && free('harmony')) arr.harmony = r.harmony;
  if (r.movement && free('movement')) arr.movement = r.movement;
  if (r.arc) arr.ip = Object.assign({}, arr.ip, { arc: r.arc });

  if (r.color && free('color')) {
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

export function build(engine, opts) {
  const arr = resolveArrangement(engine, opts);
  applyOverlay(engine, arr, opts.overlay, opts.locks || {});
  const style = compressStyle(engine, arr, CHAR_LIMIT, opts.locks || {});
  return { arrangement: arr, style, negative: renderNegative(engine, arr), length: style.length,
           overLimit: style.length > CHAR_LIMIT };
}

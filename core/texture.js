/* ==========================================================================
 * texture.js — THE TEXTURE MODIFIER (John, 2026-08-18).
 *
 * Replaces the abandoned Composer / Producer / Remixer libraries with the far
 * smaller thing John actually wanted. His spec, verbatim:
 *
 *   "A texture modifier that allowed me to add slow soft legato string
 *    ensembles as a pad/bed to existing tracks. In different frequency ranges
 *    Low, Mid and High. In addition to these I wanted a slow attack legato
 *    French horns, Oboes, Soprano and Alto Saxophones and trombones. Finally
 *    Harps, that pluck and swell... two modifier selectors (Duplicated) based
 *    on these individual instruments should suffice."
 *
 * And on what the strings are FOR:
 *
 *   "My request to include the string ensemble is intended to either support
 *    the existing bed or replace. I hope, depending on the prose used to
 *    introduce the strings. If the strings are just there to create the wide
 *    warm foundation that's okay."
 *
 * SUPPORT-OR-REPLACE IS NOT A MODE SWITCH. It cannot be, because prose does not
 * remove a voice from a prompt: if the character's pad and the texture strings
 * are both named, both are named. What the prose decides is which one reads as
 * the foundation. So the CONTEXT decides and the user does not have to:
 *   - a bed already survives  -> the strings render as SUPPORT, and the clause
 *     must say so ("blended underneath the pads for depth")
 *   - no bed survives         -> the strings render as the FOUNDATION
 *
 * WHY THAT MATTERS TO THE BED BUDGET. core/cast.js caps sustained beds at one
 * because two beds mud the harmony. John's own examples defeat that objection
 * by RELATING the second bed to the first, which is the standing interaction-
 * language rule doing real work rather than a carve-out being made for this
 * feature. So the rule core/cast.js enforces is: a texture bed may coexist with
 * an existing bed only while its clause states the relationship. If we cannot
 * say how it sits against what is already there, it is mud and it goes.
 *
 * WHAT THIS MODULE IS NOT. It is not part of the Detail & Movement system.
 * Spec v2.0 §1.2 is explicit that those three resolvers modify behaviour AROUND
 * the cast and never add instruments; every one of them processes a voice that
 * is already there. Texture ADDS NAMED SOURCES, which is a cast question, so it
 * emits cast candidates and takes its chances with every reconciliation rule —
 * one-voice-one-mention, genre policy, slot waste, the budgets. That is the
 * whole point: the 2026-08-17 session close flagged, before this feature had a
 * spec, that content injected "outside the predetermined cast" would walk past
 * all of it.
 *
 * EVIDENCE STATE: REASONED, not Suno-tested. Nothing here may be promoted into
 * core/knowledge.js. The merge rule, the relationship requirement and the
 * clause position are all decidable without a Suno result because they are
 * about the prompt asking for something musically coherent; whether Suno
 * honours the resulting voice count is NOT, and is the measurement this
 * feature finally makes possible under John's complete-build testing rule.
 * ========================================================================*/

/* --------------------------------------------------------------------------
 * THE POOL — nine entries, exactly John's list.
 *
 * NAMING IS LOAD-BEARING IN TWO PLACES, so it is not free-text:
 *
 * (1) "ENSEMBLE" / "SECTION" ARE THERE ON PURPOSE. John's rule 2 (a pad must be
 *     an ensemble or a chord of three or more notes) is tested by POLYPHONY, and
 *     core/articulation.js's padWidthFault() reads the name. "low strings" fails
 *     it — one sustaining source, however many players are implied. "a low
 *     string ensemble" passes, and is also John's own word.
 *
 * (2) REGISTERS ARE NAMED AS REGISTERS, NOT AS INSTRUMENTS. The obvious way to
 *     write the low entry is "cellos and double basses", which is more specific
 *     and would be wrong here: 'cello' is in SINGLETON_INSTRUMENT_WORDS, Era and
 *     Sacred Spirit both draw cello in their own pools, and the duplicate rule
 *     would then drop John's pick on exactly the engines where an orchestral bed
 *     is most likely to be wanted. Register adjectives collide with nothing and
 *     say the same thing about where the sound sits.
 * ------------------------------------------------------------------------*/
export const TEXTURE_VOICES = Object.freeze({
  stringsLow:  { label: 'String ensemble — low',  family: 'strings',   kind: 'bed',
                 name: 'a low string ensemble',          register: 'low' },
  stringsMid:  { label: 'String ensemble — mid',  family: 'strings',   kind: 'bed',
                 name: 'a mid-register string ensemble', register: 'mid' },
  stringsHigh: { label: 'String ensemble — high', family: 'strings',   kind: 'bed',
                 name: 'a high string ensemble',         register: 'high' },

  frenchHorns: { label: 'French horns',           family: 'brass',     kind: 'colour',
                 name: 'a soft French horn section' },
  trombones:   { label: 'Trombones',              family: 'brass',     kind: 'colour',
                 name: 'a soft trombone section' },

  oboes:       { label: 'Oboes',                  family: 'woodwinds', kind: 'colour',
                 name: 'oboes' },
  sopranoSax:  { label: 'Soprano saxophone',      family: 'woodwinds', kind: 'colour',
                 name: 'a soprano saxophone' },
  altoSax:     { label: 'Alto saxophone',         family: 'woodwinds', kind: 'colour',
                 name: 'an alto saxophone' },

  harp:        { label: 'Harp',                   family: 'harp',      kind: 'plucked',
                 name: 'a harp' },
});

export const TEXTURE_IDS = Object.freeze(Object.keys(TEXTURE_VOICES));

export function textureList() {
  return TEXTURE_IDS.map(id => ({ id, label: TEXTURE_VOICES[id].label }));
}

/* --------------------------------------------------------------------------
 * SAME-FAMILY PICKS MERGE INTO ONE NAMED SOURCE.
 *
 * Two selectors, both set to strings, is the case John is most likely to reach
 * for — low plus high is a standard orchestral voicing. Rendered as two cast
 * entries it names strings twice, and core/knowledge.js records the round-4
 * finding that naming one instrument twice tells Suno to render two of it. It
 * is also not what he means: one section voiced across registers, not two
 * sections. Soprano plus alto is the same fault with the word "saxophone".
 *
 * So two picks in the same guide family become ONE entry naming both members.
 * This also halves the voice-count cost in precisely the case that would
 * otherwise cost the most, which matters because John has explicitly accepted
 * pushing the count and the base build already averages 6.4 named sources.
 * ------------------------------------------------------------------------*/
const REGISTER_ORDER = ['low', 'mid', 'high'];

/* Merged names are written out rather than generated by string-joining the
 * singular names, because the join produces the exact duplication the merge
 * exists to prevent ("a soprano saxophone and an alto saxophone" names the
 * saxophone twice inside one clause). */
function mergedName(family, entries) {
  if (family === 'strings') {
    const regs = entries.map(e => e.register)
      .sort((a, b) => REGISTER_ORDER.indexOf(a) - REGISTER_ORDER.indexOf(b));
    return `a soft string ensemble spanning ${regs[0]} and ${regs[1]} registers`;
  }
  if (family === 'brass')  return 'a soft French horn and trombone section';
  if (family === 'woodwinds') {
    const ids = entries.map(e => e.id).sort();
    const key = ids.join('+');
    if (key === 'altoSax+sopranoSax') return 'soprano and alto saxophones';
    if (key === 'altoSax+oboes')      return 'oboes and an alto saxophone';
    if (key === 'oboes+sopranoSax')   return 'oboes and a soprano saxophone';
  }
  return entries.map(e => e.name).join(' and ');
}

/* resolveTexturePicks — the two selector values in, one or two resolved voices
 * out. A resolved voice is what the cast receives and what the prose is written
 * about; the selector ids survive on it so the UI can report what happened. */
export function resolveTexturePicks(picks) {
  const ids = (picks || []).filter(id => id && TEXTURE_VOICES[id]);
  if (!ids.length) return [];

  /* The SAME entry chosen twice is one voice, not a merge — "a low string
   * ensemble and a low string ensemble" is the duplicate fault in its purest
   * form, and there is no second register to name. */
  const unique = Array.from(new Set(ids));
  const entries = unique.map(id => Object.assign({ id }, TEXTURE_VOICES[id]));

  const byFamily = new Map();
  for (const e of entries) {
    if (!byFamily.has(e.family)) byFamily.set(e.family, []);
    byFamily.get(e.family).push(e);
  }

  const out = [];
  for (const [family, group] of byFamily) {
    if (group.length === 1) {
      out.push({ ids: [group[0].id], family, kind: group[0].kind, name: group[0].name,
                 flavour: group[0].id });
    } else {
      /* Kind of a merged group: a bed wins, because a string ensemble that has
       * absorbed a second register is more of a bed, not less. */
      const kind = group.some(g => g.kind === 'bed') ? 'bed' : group[0].kind;
      out.push({ ids: group.map(g => g.id), family, kind, name: mergedName(family, group),
                 flavour: null });
    }
  }
  return out;
}

/* --------------------------------------------------------------------------
 * THE PROSE LIBRARY
 *
 * John: "There needs to be sufficient musically appropriate creative prose for
 * the Textured instruments though."
 *
 * PROVENANCE, because SESSION-START.md forbids inventing interaction language
 * and this library is large. Every phrase below comes from one of three places
 * and nowhere else:
 *   john   — John's own wording, 2026-08-18. He supplied four examples ("lush
 *            soft string pads swelling", "subtle string textures supporting the
 *            harmonic space", "soft layered strings blended underneath the pads
 *            for depth", "wide warm foundation"). His wording is a source of
 *            truth on the same terms as the guide; he is the one testing it.
 *   guide  — docs/knowledge/instrument-family-linking-guide.md, the cited
 *            section given per entry.
 *   tmpl   — the guide's own §2 role/texture/register templates or §13 plane
 *            phrases with the instrument named in the slot. Composing a
 *            template is not inventing wording; that is what the slot is for.
 *
 * WHY THE SHAPE DIFFERS FROM THE GUIDE'S PAIR PHRASES. The guide relates one
 * FAMILY to another ("solo woodwind floats above a warm string bed"), which
 * assumes both families are present and that the prompt is orchestral. A
 * texture voice has to relate to whatever the character happened to draw, which
 * varies per build and is usually not orchestral at all — on a Balearic house
 * build "strings lay out the harmony" is simply false, the synth does. John's
 * four examples establish the shape that works here: relate the voice to the
 * ARRANGEMENT'S FUNCTIONS (the bed, the harmonic space, the melody) rather than
 * to a named second family. That is why they are the template class and not
 * merely seed entries.
 *
 * TWO CONTEXTS PER FAMILY, and the split is the support-or-replace decision:
 *   withBed — a sustained bed survived reconciliation. The clause MUST name the
 *             relationship to it; this is what earns a second bed its place.
 *   alone   — no bed survived. The voice is free to read as the foundation.
 * Non-bed families keep both lists too, because a horn line behaves differently
 * when there is a pad under it than when it is the only sustained thing there.
 * ------------------------------------------------------------------------*/
export const TEXTURE_PROSE = Object.freeze({
  strings: {
    withBed: [
      '{n} soft and layered in long sustained chords, blended underneath the pads for depth', // john
      '{n} swelling slowly beneath the existing bed, long legato notes only',            // john
      '{n} supporting the harmonic space under the pad in long sustained chords',        // john
      '{n} sustained under the arrangement, slow to swell and slower to fall away',      // tmpl §2 texture
      '{n} blended into the background plane with quiet, sustained timbres',             // guide §13
      '{n} resonating behind the arrangement, sustained chords thickening the harmony',  // guide §13 enrich
    ],
    alone: [
      '{n} laying a wide warm harmonic foundation, sustained and slow to swell',         // john
      '{n} in sustained chords forming a soft background pad',                           // guide §3
      '{n} as the sustained harmonic bed, long legato notes carrying the changes',       // guide §6
      '{n} swelling lushly under the whole arrangement in slow legato chords',           // john
      '{n} holding wide open chords low behind the melody',                              // tmpl §2 register
    ],
  },

  /* BRASS SITS BACK, ALWAYS. core/linking.js already records the decision that
   * only the soft-and-low §4 brass variants are imported onto a groove-led
   * engine, and John's round-4 result was an overlay trumpet coming through too
   * strong. Every phrase here keeps brass low, quiet and legato — which is also
   * exactly what "slow attack legato French horns" asks for. */
  brass: {
    withBed: [
      '{n} holding long legato harmonies low beneath the pad',                           // guide §4
      '{n} adding quiet harmonic reinforcement beneath the bed in slow sustained swells',// guide §4
      '{n} entering on slow legato lines and settling back under the bed',               // tmpl §2 role
      '{n} restrained in the background with quiet, sustained tone',                     // guide §13
      '{n} kept low behind the pad, long held notes warming the harmony',                // guide §2 register
    ],
    alone: [
      '{n} grounding the harmony in long legato tones',                                  // guide §4
      '{n} in slow sustained swells behind the melody, never accented',                  // guide §4
      '{n} holding broad legato chords low in the arrangement',                          // tmpl §2 register
      '{n} resonating in the background, sustained and soft, enriching the texture',     // guide §13
      '{n} rising and falling slowly under the melody, long notes only',                 // tmpl §2 texture
    ],
  },

  /* WOODWINDS ARE COLOUR AND COUNTERMELODY (guide §1, §3) and sit in the middle
   * plane (core/linking.js DECORATION_PLANE). Saxophone is not in the guide by
   * name — John accepted it running through the woodwind family on 2026-08-18,
   * which is what classifyInstrument() already resolves it to, so the wording
   * is family-level guide language with the instrument in the slot. */
  woodwinds: {
    withBed: [
      '{n} floating above the bed in long legato phrases',                               // guide §3
      '{n} answering the melody with slow sustained countermelodies',                    // guide §3
      '{n} weaving unhurried legato lines through the texture',                          // guide §2 texture
      '{n} supported in the middle plane with gentle motion, long legato phrases',       // guide §13
      '{n} drifting over the pad in slow, breathy held notes',                           // tmpl §2 texture
    ],
    alone: [
      '{n} carrying long legato lines over the arrangement',                             // guide §3
      '{n} and the melody trading slow phrases in call-and-response',                    // guide §2 texture
      '{n} adding sustained colour between the phrases, never hurried',                  // guide §3
      '{n} filling the middle register with held notes as an inner voice',               // guide §13
      '{n} in long breathy tones sitting just behind the lead',                          // tmpl §2 register
    ],
  },

  /* HARP KEEPS ITS ATTACK. John's refinement to rule 1 (2026-08-17): only
   * instruments that can hold a note are made legato; harps, mallets and
   * vibraphone stay percussive. His own wording for this entry — "harps, that
   * pluck and swell" — says the same thing, so every phrase here is plucked
   * with a ring or a bloom after it, never sustained. */
  harp: {
    withBed: [
      '{n} outlining the chord changes above the bed in plucked figures left to ring',   // guide §6
      '{n} shimmering beneath the pad in soft arpeggios that bloom and decay',           // guide §6
      '{n} plucked in figures sparkling around the long held tones of the bed',          // guide §12
      '{n} resonating behind the pad, plucked notes enriching the texture',              // guide §13
      '{n} picking out the harmony above the bed, each note allowed to swell',           // john
    ],
    alone: [
      '{n} outlining the harmony in slow arpeggios that bloom and decay',                // guide §6
      '{n} plucked and left to ring, carrying the chord changes on its own',             // john
      '{n} plucked in figures sparkling in the open space around the melody',            // guide §12
      '{n} arpeggios rising softly under the lead, each figure left to swell',           // guide §6
      '{n} marking the harmony with sparse plucked chords and long decays',              // tmpl §2 role
    ],
  },
});

/* Per-voice flavour lines. These exist because John asked for SUFFICIENT prose,
 * and a family-level library alone makes a soprano saxophone and an oboe read
 * identically when the whole reason he listed both is that they do not sound
 * alike. Only reachable for an UNMERGED pick — a merged entry is a section, and
 * a line written about one instrument's character would be false of the pair —
 * and only in the alone context, because they describe the voice rather than
 * its relationship to a bed. */
export const TEXTURE_FLAVOUR = Object.freeze({
  stringsLow:  ['{n} sitting deep under the arrangement, wide and slow-moving'],
  stringsMid:  ['{n} filling the middle register with warm sustained chords'],
  stringsHigh: ['{n} floating high above the arrangement in soft sustained lines'],
  frenchHorns: ['{n} in slow rounded legato swells, warm and far back'],
  trombones:   ['{n} holding low legato harmonies, soft-edged and unhurried'],
  oboes:       ['{n} in long reedy legato lines threading through the texture'],
  sopranoSax:  ['{n} in slow breathy legato phrases drifting over the arrangement'],
  altoSax:     ['{n} in warm sustained lines, breath audible, never rushed'],
  harp:        ['{n} plucked in slow arpeggios, each note left to swell and ring out'],
});

/* --------------------------------------------------------------------------
 * CLAUSE SELECTION
 *
 * Deterministic on the build seed: the same seed must reproduce the same
 * prompt, which is the precondition for John's identical-seed before/after
 * gate. Each selector slot draws from a different offset so two picks never
 * land on the same phrase, and a collision after merging is stepped past
 * rather than tolerated.
 * ------------------------------------------------------------------------*/
function hash(seed, i) {
  let h = ((seed >>> 0) ^ ((i + 1) * 2654435761)) >>> 0;
  h ^= h >>> 15; h = Math.imul(h, 2246822507) >>> 0; h ^= h >>> 13;
  return h >>> 0;
}

/* THE PHRASE MUST NAME THE RELATIONSHIP. This is the predicate core/cast.js
 * consults before letting a texture bed stand alongside an existing one, so it
 * is exported and tested rather than left implicit in the library's wording.
 * A phrase qualifies when it says where this voice sits relative to something
 * else in the arrangement — under the pad, beneath the bed, behind the melody,
 * in the background plane. A phrase that only describes the voice itself does
 * not, and a second bed carrying one of those is the mud the budget exists to
 * prevent. */
const RELATIONAL_RE = /\b(underneath|beneath|under|below|behind|above|over|around|through|between|background|middle plane|answering|supporting|with the|against)\b/i;
export const statesRelationship = (t) => RELATIONAL_RE.test(String(t || ''));

/* renderTextureClause — one resolved voice + context in, one woven clause out.
 *
 * THE CONTEXT ARGUMENT IS THE SUPPORT-OR-REPLACE DECISION and it is read from
 * the RECONCILED cast, never from the raw arrangement: a pad that lost the bed
 * contest is not there, and writing "blended underneath the pads" about a pad
 * Suno was never told to render is the dangling-reference fault core/
 * interplay.js exists to stop. */
export function renderTextureClause(voice, ctx) {
  const o = ctx || {};
  const bank = TEXTURE_PROSE[voice.family] || TEXTURE_PROSE.strings;
  const pool = (o.bedPresent ? bank.withBed : bank.alone).slice();

  /* Flavour lines are context-neutral by construction (they describe the voice,
   * not a relationship), so they are only offered where a relationship is not
   * required — i.e. when nothing else is holding the bed. */
  if (!o.bedPresent && voice.flavour && TEXTURE_FLAVOUR[voice.flavour]) {
    pool.push(...TEXTURE_FLAVOUR[voice.flavour]);
  }

  const slot = o.slot || 0;
  const used = o.used || [];
  let text = '';
  for (let step = 0; step < pool.length; step++) {
    const cand = pool[(hash(o.seed || 0, slot) + step) % pool.length].replace('{n}', voice.name);
    if (!used.includes(cand)) { text = cand; break; }
    text = cand;
  }
  return text;
}

/* renderTextureClauses — the whole texture contribution for one build.
 * Order is stable (selector order after merging) so the prompt is reproducible.
 */
export function renderTextureClauses(voices, ctx) {
  const out = [];
  (voices || []).forEach((v, i) => {
    const text = renderTextureClause(v, Object.assign({}, ctx, { slot: i, used: out }));
    if (text) out.push(text);
  });
  return out;
}

/* Cast candidates. Deliberately carries NO prose: core/cast.js reconciles data,
 * and the clause is chosen afterwards from the survivor list. Cast is data
 * before prose — the same rule that moved composer placement onto the cast. */
export function textureCastEntries(voices) {
  return (voices || []).map(v => ({
    instrument: v.name, family: v.family, kind: v.kind, ids: v.ids,
  }));
}

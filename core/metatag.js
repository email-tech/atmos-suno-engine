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

import { STRUCTURE_TEMPLATES, TEMPLATE_FOR_SUBGENRE, templateById } from './lyric-controls.js';
import { DNA_CONSUMERS } from './dna.js';

export const METATAG_VERSION = '1.0';

// DNA fields this engine may read (contract). Metatag may read everything.
export const METATAG_READABLE = Object.freeze(
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
  const L = cap(label);
  const lead = v.lead || 'lead';
  const beatless = !!(dna.dynamics && dna.dynamics.beatless);
  const atmos = /ambient|atmos|texture|breath|sunrise|underwater|drift|aria|sacred|abstract|invocation/.test(String(label).toLowerCase());
  const groove = (v.bass && v.rhythm) ? `${v.bass} + ${v.rhythm} lock the groove`
               : v.bass ? `${v.bass} anchors` : v.rhythm ? `${v.rhythm} holds the groove`
               : (v.answerVoice && v.answerVoice !== lead) ? `${v.answerVoice} answers ${lead}`
               : `${lead} carries, voices converse`;
  const vocal = vocalMode === 'vocal';
  const shade = ({ brooding: 'shadowed', nocturnal: 'hushed', euphoric: 'lifted', ethereal: 'airy',
                   wistful: 'aching', warm: 'warm', driving: 'urgent', hypnotic: 'trance-like',
                   contemplative: 'unhurried' }[moodClass]) || 'close';
  const dc = deliveryClass || 'lead-melodic';
  const vVerse = dc === 'spoken/chant' ? 'spoken and low' : dc === 'wordless/textural' ? 'wordless vowels'
               : dc === 'choir/pad' ? 'solo over choir bed' : `${shade} intimate vocal`;
  const vChorus = dc === 'choir/pad' ? 'choir answers the hook' : 'lead + stacked harmonies lift';
  const body = (b) => `[${L}: ${b}]`;

  switch (type) {
    case 'intro':
      return (beatless || atmos)
        ? body(`${v.harmonyBed || v.pads || 'pads'} from near silence, no pulse`)
        : body(`${groove}, ${lead} withheld`);
    case 'verse':
      return body(`sparse and dry, ${vocal ? vVerse : lead + ' forward'}, steady groove`);
    case 'prechorus':
      return body('rising tension, drums build into the hook');
    case 'chorus':
      if (/post-chorus/i.test(String(label))) return body('hook restated simpler, chantable, lead steps back');
      return body(`full arrangement, ${groove}, ${vocal ? vChorus : (v.answerVoice || v.counter || 'counter') + ' answers ' + lead}`);
    case 'instrumental':
      return body(`${v.feature || lead} leads, call-and-response, groove simplifies`);
    case 'bridge':
      return body(`stripped back, drums out, ${cadenceHint(dna)}${vocal ? ', exposed vocal' : ''}`);
    case 'outro':
      return body(`${lead} thins out, ${tailHint(dna)}`);
    default:
      return `[${L}]`;
  }
}

export function buildMetatagPlan(dna, opts) {
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
export function renderMetatagBlock(built, mode) {
  if (mode === 'lean') return built.leanLines.join('\n');
  const byIdx = new Map();
  for (const item of built.plan) {
    const k = (item.idx == null ? 0 : item.idx);
    if (!byIdx.has(k)) byIdx.set(k, []);
    byIdx.get(k).push(item.tag);
  }
  return built.sections.map((s, i) => {
    const tags = byIdx.get(i) || [];
    return `[${s}] ${tags.join(' ')}`.trim();
  }).join('\n');
}

// flat list of just the tag strings (order-preserving, full plan)
export function metatagList(built) {
  return built.plan.map(p => p.tag);
}

/* ---- runtime driver (no model call — deterministic assembly) ---------------
 * renderMode default: vocal -> 'lean' (share the lyrics budget), instrumental
 * -> 'full' (whole lyrics box free). Pass renderMode to override. */
export function runMetatagEngine({ dna, cil, answers, lyricResult, renderMode }) {
  const built = buildMetatagPlan(dna, { cil, answers, lyricResult });
  const mode = renderMode || (built.vocalMode === 'vocal' ? 'lean' : 'full');
  return { ...built, renderMode: mode, block: renderMetatagBlock(built, mode) };
}

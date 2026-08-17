// Routes a generate request to the right path for the engine's kind and returns a
// uniform result: { style, negative, lyrics, length, over }.
// Max Mode (global S.maxMode) prepends the MAX directive block for every engine:
//   - legacy engines apply it through their proven maxMode path (byte-identical to old app)
//   - resolver engines get it here in the router
import { getEngine, legacyClassic } from './registry.js';
import { buildAtoms } from '../core/atoms.js';
import { resolveModifier } from '../core/atom-modifiers.js';
import { buildMusicalDNA } from '../core/dna.js';
import { buildResolverDNA } from '../core/dna-resolver.js';
import { buildLegacyDNA } from '../core/dna-legacy.js';
import { inferCIL } from '../core/cil.js';
import { runLyricEngine } from '../core/lyric.js';
import { needsSourceResearch, runSourceResearch } from '../core/source-research.js';
import { runMetatagEngine } from '../core/metatag.js';
import { COMPOSER_LAYERS, composerStyleLayer } from '../core/composer-layers.js';
import { atomCharacterForPalette } from '../engines/atom-characters.js';
import { build } from '../core/resolver.js';
import { CHAR_LIMIT, rng } from '../core/constants.js';
import { resolveOverlays } from '../core/overlays.js';
import { EngineExtras } from '../legacy/engine-extras.js';
import { MAX_MODE_STR } from '../legacy/data-style-engines.js';
import { buildStylePromptWithArrangement, buildNegativePrompt, buildLyricsField } from '../legacy/prompt-style-builder.js';
import { resolveStructure, structureHasResolutionPoint } from '../core/structure.js';
import { makeClaudeTransport } from './claude-client.js';
import { makeGeminiTransport } from './gemini-client.js';

function applyMax(style, on) {
  if (!on) return style;
  const out = MAX_MODE_STR + '\n' + style;
  return out.length <= CHAR_LIMIT ? out : out.slice(0, CHAR_LIMIT - 3).trimEnd() + '...';
}

/* MAX MODE LYRIC MARKER (John, 2026-08-17, after the first live generation):
 * "Whether it's a Vocal or Instrumental song, when MAX MODE is selected, the
 * Lyric prompt field must have the slash-star marker (see MAX_LYRIC_MARKER
 * below for the exact literal) at the very top."
 *
 * This is a SEPARATE mechanism from applyMax() above, which prefixes the
 * STYLE field with MAX_MODE_STR. Two different Suno inputs, two different
 * markers — the style block is the [Is_MAX_MODE: MAX](MAX) directive set, the
 * lyrics box takes this delimiter. Conflating them would put the wrong text
 * in the wrong field.
 *
 * Provenance: this is John's own instruction, and it is the standing item
 * from the prior app's NEXT_SESSION_HANDOFF.txt ("Next alteration reminder:
 * Prefix Lyric prompt with the following line: <the same marker>"), which was
 * recorded but never implemented in either the old app or this one.
 *
 * VERY TOP means above everything, including the first section marker — so it
 * is prepended, never merged into an existing line. Applied to BOTH song
 * types per John's wording: an instrumental build's lyrics field carries the
 * metatag block, and that still needs the marker.
 *
 * NOT length-capped, unlike applyMax(): CHAR_LIMIT is the style field's 1000-
 * character budget. The lyrics box has no such limit, and truncating a lyric
 * to fit a style-field constraint would silently destroy the song. */
export const MAX_LYRIC_MARKER = '///*****///';

export function applyMaxToLyrics(lyrics, on) {
  if (!on) return lyrics;
  const text = String(lyrics == null ? '' : lyrics);
  // Idempotent: a lyric that already carries the marker (a recalled
  // favourite, a re-render of the same result) must not accumulate copies.
  if (text.trimStart().startsWith(MAX_LYRIC_MARKER)) return text;
  return MAX_LYRIC_MARKER + '\n' + text;
}

// SONG-TYPE GATE (structure-first pipeline, Phase 2 — docs/architecture/
// structure-first-pipeline-plan.md, approved by John 2026-08-12; guide §2:
// "Lyrics field = [Instrumental] ... with the structural markers only" when
// song type is instrumental). Song type is decision #1 and OVERRIDES any
// per-engine vocal control — an instrumental song type always resolves to
// [Instrumental], regardless of what a legacy engine's own Vocal control is
// set to. This does not touch the per-engine control's stored value, only
// what generate() actually returns, so switching back to Vocal restores the
// user's own choice.
function songTypeLyrics(S, fallback) {
  return applyMaxToLyrics(S.songType === 'instrumental' ? '[Instrumental]' : fallback, S.maxMode);
}

// Phase 3/4 (approved by John 2026-08-12, "names and positions only" — no
// energy data): the resolved structure preset's section names and order,
// shaped for core/lyric.js's assembleLyricBrief(dna, cil, answers, structure)
// fourth argument. Exposed on generate()'s return value so that whenever the
// (currently unwired) async lyric-engine call is made, the structure the user
// picked is already sitting there rather than needing to be re-derived from
// S. John: "so long as the structure is available in the lyric prompt that
// will be enough" — this is what makes it available.
function lyricStructure(S) {
  const structure = resolveStructure(S.structurePresetId);
  if (!structure) return null;
  return { songType: structure.type, sections: structure.sections, presetLabel: structure.label };
}

// A beatless character cannot take a club/rhythm-derived overlay trait.
const BEATLESS_BAN_TAGS = ['four-on-floor', 'club', 'house'];

function overlayFor(S, beatless) {
  const ctx = { beatless, banTags: beatless ? BEATLESS_BAN_TAGS : [] };
  return resolveOverlays(S.ov || {}, ctx);
}

export function generate(S) {
  const eng = getEngine(S.engineId);

  if (eng.kind === 'atom') {
    const a = S.atom;
    const palette = a.palette || 'electronic';
    const baseChar = eng.module[a.characterId];
    const char = atomCharacterForPalette(baseChar, palette);

    // COMPOSER LAYER (John, 2026-07-23): a composer modifier is no longer an atom
    // overlay injected into the style body. It is a SECONDARY layer — one clause
    // appended to the style prompt plus per-section metatag decoration — applied
    // over the song the character already defines. The character build is
    // untouched; the composer only decorates it.
    const composerLayerId = (a.composerLayerId && COMPOSER_LAYERS[a.composerLayerId]) ? a.composerLayerId : null;

    /* COMPOSER INTO THE CAST (John, 2026-08-17). This used to be:
     *     if (composerLayerId) style = `${style}, ${composerStyleLayer(id)}`;
     * appended AFTER buildAtoms() had already reconciled and deduped, and
     * after the mastering tail — which is terminal by design. Measured at
     * 08212c9: 342/342 composer builds placed the clause after mastering, and
     * 25/342 named a synth lead in both the base body and the composer clause,
     * because the dedupe never saw it. The clause also carried one blanket
     * interaction phrase for five to nine instruments, which is the shape the
     * standing interaction rule explicitly bans.
     * Composer instruments now enter buildAtoms() as cast candidates and face
     * the same bed budget, lead budget, genre policy and slot-waste rules as
     * every engine atom. Survivors are rendered by compose() in the normal
     * clause order, before mastering. */
    const composerInstruments = composerLayerId ? (COMPOSER_LAYERS[composerLayerId].instruments || []) : [];

    const out = buildAtoms(char, { seed: S.seed, overlayDef: a.overlayId ? resolveModifier(a.overlayId, null, null, palette) : null, maxMode: S.maxMode, vocalActive: S.songType !== 'instrumental', composerInstruments });
    let style = out.style;
    style = applyMax(style, S.maxMode);

    // Metatags: the character's own section plan, decorated at structural points
    // by the composer layer. This is also the first time the atom path surfaces
    // metatags to the app at all.
    //
    // STRUCTURE-FIRST ALIGNMENT (2026-08-14): pass the SAME resolved structure
    // preset's section list the lyric engine uses (structure.sections), not
    // whatever the metatag engine's own template fallback would pick. Without
    // this, metatags and lyrics could silently disagree on section labels
    // whenever a structure preset was chosen — see core/metatag.js's o.sections
    // comment for the full reasoning.
    //
    // VOCAL-MODE FIX (2026-08-14, found while building the merge below): this
    // call never used to pass answers/cil, so core/metatag.js's resolveVocal()
    // fell all the way to its own 'instrumental' default — meaning the
    // Metatags preview has ALWAYS silently omitted vocal-performance tags for
    // a VOCAL song too, regardless of the actual songType. Pre-existing bug,
    // not introduced by this change, but it directly breaks the merge's whole
    // point (preview == what gets locked into the LLM), so fixed here.
    // S.songType is decision #1 and authoritative everywhere else in this
    // file (songTypeLyrics, vocalActive) — mirrored here the same way.
    const structure = lyricStructure(S);
    const vocalAnswers = { 'vocal.mode': S.songType === 'instrumental' ? 'instrumental' : 'vocal' };
    let metatags = '';
    try {
      const dna = buildMusicalDNA(baseChar, palette, {
        seed: S.seed, characterId: a.characterId, modifierId: a.overlayId || null,
      });
      metatags = runMetatagEngine({
        dna, renderMode: 'lean', composerLayerId, answers: vocalAnswers,
        sections: structure && structure.sections,
        /* RECONCILED survivors, not the layer's declared list. A composer
         * instrument dropped by the cast (second bass, kit component, no legal
         * placement left) must not be directed by a metatag — Path B. */
        composerInstruments: (out.cast || []).filter(v => v.source === 'composer').map(v => v.instrument),
      }).block;
    } catch (e) { metatags = ''; }

    // MERGE METATAGS INTO LYRICS — INSTRUMENTAL CASE (John, 2026-08-14 decision,
    // Path B). No lyric text exists for an instrumental track; the old behaviour
    // showed a bare '[Instrumental]' placeholder in the Lyrics field next to a
    // separate Metatags block the user had to paste in manually. Zero design
    // ambiguity here (unlike the vocal case): the Lyrics field IS the metatag
    // block directly. `metatags` is therefore not also returned as a separate
    // field when instrumental — js/ui.js only renders a standalone Metatags
    // block when `res.metatags` is present, so this naturally removes the
    // duplicate block too. Falls back to the literal '[Instrumental]' tag only
    // if metatag generation itself failed (see the catch above).
    const instrumental = S.songType === 'instrumental';

    return {
      style, negative: out.negative,
      lyrics: instrumental ? applyMaxToLyrics(metatags || '[Instrumental]', S.maxMode) : songTypeLyrics(S, ''),
      metatags: instrumental ? '' : metatags,
      length: style.length, over: style.length > CHAR_LIMIT,
      arrangement: out.arrangement, overlayNote: out.overlayNote,
      /* The reconciled cast, exposed so consumers and validators can see WHICH
       * voices survived rather than inferring it from the prose. Needed by
       * validate-composer-layers' Path B check: a metatag must not direct a
       * composer instrument that reconciliation dropped. */
      cast: out.cast, castDropped: out.castDropped,
      structure,
    };
  }

  if (eng.kind === 'resolver') {
    const r = S.res;
    const locks = (r.level === 'random') ? {} : r.locks;
    const ch = eng.module.characters[r.characterId] || {};
    // Harmony brightness Lever 3 (John, 2026-08-13): feed the already-resolved
    // structure into resolveArrangement() so its harmony pick can favour a
    // minor-to-major resolution when there's a genuine peak to land on, or
    // stay flatter when there isn't. resolveStructure(S.structurePresetId)
    // is the same call lyricStructure(S) makes below — computed once here to
    // avoid resolving it twice.
    const structureForHarmony = resolveStructure(S.structurePresetId);
    const structureHint = structureForHarmony
      ? { hasResolutionPoint: structureHasResolutionPoint(structureForHarmony) } : null;
    const out = build(eng.module, {
      characterId: r.characterId, palette: r.palette, locks, seed: S.seed,
      overlay: overlayFor(S, !!ch.beatless),
      structureHint, vocalActive: S.songType !== 'instrumental',
    });
    const style = applyMax(out.style, S.maxMode);
    return {
      style, negative: out.negative, lyrics: songTypeLyrics(S, ''),
      length: style.length, over: style.length > CHAR_LIMIT, arrangement: out.arrangement,
      structure: lyricStructure(S),
    };
  }

  if (eng.kind === 'legacy') {
    const state = toLegacyState(S);            // proven builder handles maxMode itself
    // P8 PHASE 3 PREREQUISITE (2026-08-12): now surfaces `arrangement` too,
    // the same way the atom and resolver branches above already do — the
    // resolved slot picks (pad/bass/motif/etc) used to be discarded once
    // woven into the style string; buildStylePromptWithArrangement() returns
    // both. `style` itself is computed identically to the old
    // buildStylePrompt(state) call (same underlying function, proven byte-
    // identical in validate-legacy.mjs), so this is additive only.
    const built = buildStylePromptWithArrangement(state);
    const style = built.style;
    return {
      style,
      negative: buildNegativePrompt(state),
      lyrics: applyMaxToLyrics(songTypeLyrics(S, buildLyricsField(state)), S.maxMode),
      length: style.length,
      over: style.length > CHAR_LIMIT,
      arrangement: built.arrangement,
      structure: lyricStructure(S),
    };
  }

  return { style: '', negative: '', lyrics: '', length: 0, over: false, stub: true };
}

// ---- P7: LIVE lyric generation (2026-08-12) --------------------------------
// The one function in this file that makes a real network call. Everything
// upstream of the transport is pure and testable without a network — see
// buildLiveLyricRequest() below and validate-live-lyric.mjs, which tests that
// piece plus the full async flow with an injected fake transport.
//
// P8 COMPLETE (2026-08-12): all three engine kinds now produce Musical DNA —
// atom (buildMusicalDNA), resolver (buildResolverDNA), and legacy
// (buildLegacyDNA, docs/architecture/p8-dna-extractors-plan-legacy.md,
// Q1-Q4 all resolved). The P8 gap this function used to throw for legacy
// engines is retired.
export function buildLiveLyricRequest(S) {
  const eng = getEngine(S.engineId);

  let dna;
  // METATAG/LYRIC MERGE, VOCAL CASE (John, 2026-08-14 decision, Path B):
  // composerLayerId only exists on the atom path (see core/metatag.js's
  // composerLayerId usage — no other engine kind has the concept). Metatags
  // are therefore only computed here for atom engines, same scope limit as
  // generate()'s sync render and the still-open "wire composer+metatag onto
  // a proven engine" TODO for resolver/legacy.
  let composerLayerId = null;
  if (eng.kind === 'atom') {
    const a = S.atom;
    const palette = a.palette || 'electronic';
    const baseChar = eng.module[a.characterId];
    dna = buildMusicalDNA(baseChar, palette, {
      seed: S.seed, characterId: a.characterId, modifierId: a.overlayId || null,
    });
    composerLayerId = (a.composerLayerId && COMPOSER_LAYERS[a.composerLayerId]) ? a.composerLayerId : null;
  } else if (eng.kind === 'resolver') {
    // resolver: resolve the arrangement the SAME way generate()'s resolver
    // branch does (same overlayFor/structureHint inputs), then project it
    // into Musical DNA via buildResolverDNA() rather than re-deriving style.
    const r = S.res;
    const locks = (r.level === 'random') ? {} : r.locks;
    const ch = eng.module.characters[r.characterId] || {};
    const structureForHarmony = resolveStructure(S.structurePresetId);
    const structureHint = structureForHarmony
      ? { hasResolutionPoint: structureHasResolutionPoint(structureForHarmony) } : null;
    const overlay = overlayFor(S, !!ch.beatless);
    const out = build(eng.module, {
      characterId: r.characterId, palette: r.palette, locks, seed: S.seed,
      overlay, structureHint,
    });
    dna = buildResolverDNA(out.arrangement, overlay, {
      characterId: r.characterId, seed: S.seed, palette: r.palette,
    });
  } else if (eng.kind === 'legacy') {
    // legacy: resolve the SAME way generate()'s legacy branch does (same
    // toLegacyState() call), then project via buildLegacyDNA(). vocalMode is
    // read off state.style AFTER toLegacyState() has already applied the
    // song-type gate (S.songType='instrumental' forcing it), so this reports
    // the effective mode actually in play for this build, not the raw
    // per-engine S.leg.vocalMode.
    const state = toLegacyState(S);
    const built = buildStylePromptWithArrangement(state);
    dna = buildLegacyDNA(built, {
      seed: S.seed, palette: state.style.palette,
      overlay: state.style.ov, vocalMode: state.style.vocalMode,
    });
  } else {
    throw new Error(`Live lyric generation needs Musical DNA. Unknown engine kind "${eng.kind}" for engine "${S.engineId}".`);
  }

  const cil = inferCIL(dna);
  const structure = lyricStructure(S);

  // METATAG/LYRIC MERGE, VOCAL CASE (John, 2026-08-14 decision, Path B): the
  // real, grounded per-section metatags for THIS build — same dna, same
  // structure.sections the lyric prompt will require, same composer layer —
  // computed here so runLyricEngine can hand them to the LLM as LOCKED,
  // authoritative content instead of the old generic "invent 3-5 tags
  // yourself" instruction. Cheap and deterministic (no model call); computed
  // unconditionally (even for an instrumental brief, which short-circuits
  // before ever reading it) rather than branching on vocal mode here, since
  // vocal mode can come from CIL/answers as well as structure and this stays
  // correct either way. atom-only for now (composerLayerId scope, see above);
  // resolver/legacy get `null` and fall back to the pre-existing behaviour
  // unchanged.
  let lockedMetatags = null;
  if (eng.kind === 'atom') {
    try {
      // Same S.songType-authoritative override as generate()'s sync preview
      // above (see that comment for the full reasoning) — guarantees this
      // and the preview resolve vocalMode identically, so what the user sees
      // is exactly what the LLM gets locked to.
      const vocalAnswers = { 'vocal.mode': S.songType === 'instrumental' ? 'instrumental' : 'vocal' };
      lockedMetatags = runMetatagEngine({
        dna, cil, renderMode: 'lean', composerLayerId, answers: vocalAnswers,
        sections: structure && structure.sections,
      }).block;
    } catch (e) { lockedMetatags = null; }
  }

  const l = S.lyric || {};
  // LYRIC-BRIEF CONTROL PANEL (2026-08-17). Previously only three of these
  // reached the brief; the rest of the vocabulary existed but was never read
  // from state, so the controls that did exist upstream were inert. Anything
  // omitted here still falls back to assembleLyricBrief()'s own defaults, so
  // a partially-populated state (an old saved session, a test harness) stays
  // valid rather than throwing.
  const answers = {
    'song.subject': l.subject || '',
    'song.lineLength': l.lineLength || 'Flexible',
    'song.rhymeDensity': l.rhymeDensity || 'Moderate',
    'song.sourceType': l.sourceType || 'Original concept',
    'song.themeLens': l.themeLens || 'Inspired by source',
    'song.perspective': l.perspective || 'First person',
    'song.languageStyle': l.languageStyle || 'Poetic',
    'song.deliveryStyle': l.deliveryStyle || 'Controlled and intimate',
    'song.hookStyle': l.hookStyle || 'Subtle and emotional',
    'song.imageryDensity': l.imageryDensity || 'Moderate',
    'song.narrativeClarity': l.narrativeClarity || 'Balanced',
    'song.vocalFraming': l.vocalFraming || 'Lead vocal centered',
    'song.eraBias': l.eraBias || 'Timeless',
  };
  const LL = l.languageLayer;
  if (LL && LL.enabled) {
    answers['song.languageLayer.enabled'] = true;
    answers['song.languageLayer.language'] = LL.language;
    answers['song.languageLayer.mode'] = LL.mode;
    answers['song.languageLayer.placement'] = LL.placement;
    answers['song.languageLayer.intensity'] = LL.intensity;
  }
  if (l.title && l.title.trim()) answers['song.title'] = l.title.trim(); // user override; LLM invents one if absent

  // Provider choice (2026-08-13, John): Gemini is the default for lyrics,
  // Claude remains fully available via S.provider. Both providers' transport
  // functions share the exact same {prompt,model,temperature,maxTokens}->string
  // shape, so runLyricEngine() never needs to know which one it's calling.
  const provider = S.provider === 'claude' ? 'claude' : 'gemini';
  const providerSettings = (provider === 'claude' ? S.claude : S.gemini) || {};
  const transport = provider === 'claude'
    ? makeClaudeTransport(providerSettings)
    : makeGeminiTransport(providerSettings);
  return { dna, cil, structure, answers, lockedMetatags, transport, model: providerSettings.model || undefined, provider };
}

// generateLyricsLive: the async entry point. `transportOverride` is test-only
// dependency injection (see validate-live-lyric.mjs) — omit it in the live
// app to use the real Claude transport built above.
export async function generateLyricsLive(S, transportOverride) {
  const req = buildLiveLyricRequest(S);
  const transport = transportOverride || req.transport;

  /* STEP 1 — GROUNDED SOURCE RESEARCH (John, 2026-08-17). Fires only for a
   * researchable source type with a named subject (see
   * core/source-research.js's gate); Original concept and Personal memory
   * skip it entirely and the flow stays a single call, which is the common
   * case. The researched premise REPLACES song.subject rather than arriving
   * as a parallel field, so the lyric prompt keeps one coherent subject block
   * and every downstream consumer (repair prompt, validator, batch builder)
   * needs no change at all.
   *
   * Skipped for an instrumental build: there is no lyric call to ground, and
   * spending a search on a track that short-circuits to [Instrumental] is
   * pure waste. runLyricEngine() does that short-circuit itself, but only
   * after this point, so the check is repeated here.
   *
   * Fails soft — see runSourceResearch()'s header. A failed pre-pass degrades
   * to the bare subject line, never to a failed generation. */
  let sourceResearch = null;
  const instrumentalBuild = S.songType === 'instrumental';
  if (!instrumentalBuild && needsSourceResearch(req.answers['song.sourceType'], req.answers['song.subject'])) {
    sourceResearch = await runSourceResearch({
      sourceType: req.answers['song.sourceType'],
      subject: req.answers['song.subject'],
      transport, model: req.model,
    });
    if (sourceResearch.researched) {
      req.answers['song.subject'] = sourceResearch.subject;
      req.answers['song.sourceResearched'] = true;
      req.answers['song.sourceIdentified'] = (sourceResearch.research && sourceResearch.research.identified) || null;
      req.answers['song.sourceConfidence'] = sourceResearch.confidence || null;
    }
  }

  /* STEP 2 — the creative call, ungrounded, with the full spec. */
  const out = await runLyricEngine({
    dna: req.dna, cil: req.cil, structure: req.structure, answers: req.answers,
    lockedMetatags: req.lockedMetatags,
    transport,
    model: req.model, repair: true,
  });
  /* The generated lyric is a SECOND route into Suno's lyrics box, separate
   * from generate()'s `lyrics` field — this is the text John actually pastes
   * for a vocal track, so it needs the Max marker on the same terms. Applied
   * here rather than inside runLyricEngine() because Max Mode is shell state
   * (S.maxMode), and core/lyric.js is deliberately free of shell concerns. */
  const lyrics = applyMaxToLyrics(out.lyrics, S.maxMode);
  return { ...out, lyrics, sourceResearch };
}
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
// SONG-TYPE GATE: when S.songType is 'instrumental', vocalMode is forced to
// 'Instrumental' for THIS BUILD ONLY — S.leg.vocalMode itself is left
// untouched, so switching songType back to 'vocal' restores whatever vocal
// control the user had selected.
function toLegacyState(S) {
  const l = S.leg;
  const ov = overlayFor(S, legacyBeatless(S));
  const effectiveVocalMode = S.songType === 'instrumental' ? 'Instrumental' : l.vocalMode;

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
        vocalMode: effectiveVocalMode, vocalDescriptor: '', vocalPersona: '',
        maxMode: S.maxMode, negativePrompt: '', ov, vocalActive: effectiveVocalMode !== 'Instrumental',
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
      vocalMode: effectiveVocalMode, vocalDescriptor: '', vocalPersona: '',
      maxMode: S.maxMode, negativePrompt: '', ov, vocalActive: effectiveVocalMode !== 'Instrumental',
    },
  };
}

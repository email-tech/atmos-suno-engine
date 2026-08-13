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
  return S.songType === 'instrumental' ? '[Instrumental]' : fallback;
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

    const out = buildAtoms(char, { seed: S.seed, overlayDef: a.overlayId ? resolveModifier(a.overlayId, null, null, palette) : null, maxMode: S.maxMode });
    let style = out.style;
    if (composerLayerId) style = `${style}, ${composerStyleLayer(composerLayerId)}`;
    style = applyMax(style, S.maxMode);

    // Metatags: the character's own section plan, decorated at structural points
    // by the composer layer. This is also the first time the atom path surfaces
    // metatags to the app at all.
    let metatags = '';
    try {
      const dna = buildMusicalDNA(baseChar, palette, {
        seed: S.seed, characterId: a.characterId, modifierId: a.overlayId || null,
      });
      metatags = runMetatagEngine({ dna, renderMode: 'lean', composerLayerId }).block;
    } catch (e) { metatags = ''; }

    return {
      style, negative: out.negative, lyrics: songTypeLyrics(S, ''), metatags,
      length: style.length, over: style.length > CHAR_LIMIT,
      arrangement: out.arrangement, overlayNote: out.overlayNote,
      structure: lyricStructure(S),
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
      structureHint,
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
      lyrics: buildLyricsField(state),
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
  if (eng.kind === 'atom') {
    const a = S.atom;
    const palette = a.palette || 'electronic';
    const baseChar = eng.module[a.characterId];
    dna = buildMusicalDNA(baseChar, palette, {
      seed: S.seed, characterId: a.characterId, modifierId: a.overlayId || null,
    });
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
  const l = S.lyric || {};
  const answers = {
    'song.subject': l.subject || '',
    'song.lineLength': l.lineLength || 'Flexible',
    'song.rhymeDensity': l.rhymeDensity || 'Moderate',
  };
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
  return { dna, cil, structure, answers, transport, model: providerSettings.model || undefined, provider };
}

// generateLyricsLive: the async entry point. `transportOverride` is test-only
// dependency injection (see validate-live-lyric.mjs) — omit it in the live
// app to use the real Claude transport built above.
export async function generateLyricsLive(S, transportOverride) {
  const req = buildLiveLyricRequest(S);
  return runLyricEngine({
    dna: req.dna, cil: req.cil, structure: req.structure, answers: req.answers,
    transport: transportOverride || req.transport,
    model: req.model, repair: true,
  });
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
      vocalMode: effectiveVocalMode, vocalDescriptor: '', vocalPersona: '',
      maxMode: S.maxMode, negativePrompt: '', ov,
    },
  };
}

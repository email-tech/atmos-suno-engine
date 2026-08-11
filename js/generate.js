// Routes a generate request to the right path for the engine's kind and returns a
// uniform result: { style, negative, lyrics, length, over }.
// Max Mode (global S.maxMode) prepends the MAX directive block for every engine:
//   - legacy engines apply it through their proven maxMode path (byte-identical to old app)
//   - resolver engines get it here in the router
import { getEngine, legacyClassic } from './registry.js';
import { buildAtoms } from '../core/atoms.js';
import { buildMusicalDNA } from '../core/dna.js';
import { runMetatagEngine } from '../core/metatag.js';
import { COMPOSER_LAYERS, composerStyleLayer } from '../core/composer-layers.js';
import { atomCharacterForPalette } from '../engines/atom-characters.js';
import { build } from '../core/resolver.js';
import { CHAR_LIMIT, rng } from '../core/constants.js';
import { resolveOverlays } from '../core/overlays.js';
import { EngineExtras } from '../legacy/engine-extras.js';
import { MAX_MODE_STR } from '../legacy/data-style-engines.js';
import { buildStylePrompt, buildNegativePrompt, buildLyricsField } from '../legacy/prompt-style-builder.js';

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

    const out = buildAtoms(char, { seed: S.seed, overlayId: a.overlayId || null, maxMode: S.maxMode });
    let style = out.style;
    if (composerLayerId) style = `${style}, ${composerStyleLayer(composerLayerId)}`;
    style = applyMax(style, S.maxMode);

    // Metatags: the character's own section plan, decorated at structural points
    // by the composer layer. This is also the first time the atom path surfaces
    // metatags to the app at all.
    let metatags = '';
    try {
      const dna = buildMusicalDNA(baseChar, palette, {
        seed: S.seed, characterId: a.characterId, overlayId: a.overlayId || null,
      });
      metatags = runMetatagEngine({ dna, renderMode: 'lean', composerLayerId }).block;
    } catch (e) { metatags = ''; }

    return {
      style, negative: out.negative, lyrics: '', metatags,
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

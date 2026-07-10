// Routes a generate request to the right path for the engine's kind and returns a
// uniform result: { style, negative, lyrics, length, over }.
// Max Mode (global S.maxMode) prepends the MAX directive block for every engine:
//   - legacy engines apply it through their proven maxMode path (byte-identical to old app)
//   - resolver engines get it here in the router
import { getEngine, legacyClassic } from './registry.js';
import { build } from '../core/resolver.js';
import { CHAR_LIMIT, rng } from '../core/constants.js';
import { MAX_MODE_STR } from '../legacy/data-style-engines.js';
import { buildStylePrompt, buildNegativePrompt, buildLyricsField } from '../legacy/prompt-style-builder.js';

function applyMax(style, on) {
  if (!on) return style;
  const out = MAX_MODE_STR + '\n' + style;
  return out.length <= CHAR_LIMIT ? out : out.slice(0, CHAR_LIMIT - 3).trimEnd() + '...';
}

export function generate(S) {
  const eng = getEngine(S.engineId);

  if (eng.kind === 'resolver') {
    const r = S.res;
    const locks = (r.level === 'random') ? {} : r.locks;
    const out = build(eng.module, {
      characterId: r.characterId, palette: r.palette, locks, seed: S.seed,
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
  ['pad', 'bass', 'rhythm', 'percussion', 'motif', 'movement'].forEach(role => {
    if (l.slotLevel === 'random') out[role] = rand(arrs[role]);
    else {
      const locked = l.slotLocks[role];
      out[role] = (locked != null && locked !== '') ? locked : rand(arrs[role]);
    }
  });
  return out;
}

// Map the shell's legacy sub-state onto the nested shape the proven builder reads.
function toLegacyState(S) {
  const l = S.leg;

  // Preset-driven engine (Enigma) in MANUAL mode -> proven classic slot path with 3-level locks.
  if (l.presetDriven && l.engineMode === 'manual') {
    const s = resolveClassicSlots(S.engineId, l, S.seed);
    return {
      engine: S.engineId,
      style: {
        buildMode: 'classic', cluster: '', preset: '',   // unmapped preset -> classic path
        palette: l.palette, arrangement: false, bpmOverride: '',
        phase: l.phase,
        pad: s.pad, bass: s.bass, rhythm: s.rhythm, percussion: s.percussion, motif: s.motif, movement: s.movement,
        vocalMode: l.vocalMode, vocalDescriptor: '', vocalPersona: '',
        maxMode: S.maxMode, negativePrompt: '',
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
      bpmOverride: l.bpmOverride,
      preset: l.preset,
      phase: l.phase,
      pad: l.slots.pad, bass: l.slots.bass, rhythm: l.slots.rhythm,
      percussion: l.slots.percussion, motif: l.slots.motif, movement: l.slots.movement,
      vocalMode: l.vocalMode, vocalDescriptor: '', vocalPersona: '',
      maxMode: S.maxMode, negativePrompt: '',
    },
  };
}

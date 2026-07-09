// Routes a generate request to the right path for the engine's kind and returns a
// uniform result: { style, negative, lyrics, length, over }.
import { getEngine } from './registry.js';
import { build } from '../core/resolver.js';
import { CHAR_LIMIT } from '../core/constants.js';
import { buildStylePrompt, buildNegativePrompt, buildLyricsField } from '../legacy/prompt-style-builder.js';

export function generate(S) {
  const eng = getEngine(S.engineId);

  if (eng.kind === 'resolver') {
    const r = S.res;
    const locks = (r.level === 'random') ? {} : r.locks;
    const out = build(eng.module, {
      characterId: r.characterId, palette: r.palette, locks, seed: S.seed,
    });
    return {
      style: out.style, negative: out.negative, lyrics: '',
      length: out.length, over: out.overLimit, arrangement: out.arrangement,
    };
  }

  if (eng.kind === 'legacy') {
    const state = toLegacyState(S);
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

// Map the shell's legacy sub-state onto the nested shape the proven builder reads.
function toLegacyState(S) {
  const l = S.leg;
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
      vocalMode: l.vocalMode,
      vocalDescriptor: '', vocalPersona: '',
      maxMode: false,
      negativePrompt: '',
    },
  };
}

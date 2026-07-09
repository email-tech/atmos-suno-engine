// Shell state. Two control sub-states (resolver vs legacy); the active one is
// chosen by the selected engine's kind. Kept deliberately small — the modifier
// overlays and the Lyric/Metatag engine will add their own sub-states later
// without touching this shape.
import { getEngine, resolverCharacters, legacyPresetMap, legacyClusters, legacyClassic } from './registry.js';

export function newSeed() { return (Math.random() * 2147483647) >>> 0; }

export function initState() {
  const S = { engineId: 'Delerium', seed: newSeed(), res: null, leg: null };
  syncEngineDefaults(S, 'Delerium');
  return S;
}

// (Re)build the control sub-state when the engine changes.
export function syncEngineDefaults(S, engineId) {
  S.engineId = engineId;
  S.seed = newSeed();
  const eng = getEngine(engineId);

  if (eng.kind === 'resolver') {
    const chars = resolverCharacters(eng.module);
    S.res = {
      characterId: chars[0].id,
      palette: 'electronic',
      level: 'random',          // 'random' | 'lockSome' | 'manual'
      locks: {},                // role -> chosen text (only in lockSome/manual)
    };
    S.leg = null;
  } else if (eng.kind === 'legacy') {
    const presetMap = legacyPresetMap(engineId);
    const clusters = legacyClusters(engineId);
    const classic = legacyClassic(engineId);
    S.leg = {
      presetDriven: !!presetMap,
      preset: presetMap ? Object.keys(presetMap)[0] : (classic.presets[0] || ''),
      phase: classic.phases[0] || '',
      buildMode: clusters.length ? 'cluster' : 'classic',
      cluster: clusters[0] || '',
      palette: 'electronic',
      arrangement: false,
      bpmOverride: '',
      slots: {
        pad: classic.slots.pad[0] || '', bass: classic.slots.bass[0] || '',
        rhythm: classic.slots.rhythm[0] || '', percussion: classic.slots.percussion[0] || '',
        motif: classic.slots.motif[0] || '', movement: classic.slots.movement[0] || '',
      },
      vocalMode: 'Instrumental',
    };
    S.res = null;
  } else {
    S.res = null; S.leg = null;   // stub
  }
}

// Shell state. Two control sub-states (resolver vs legacy); the active one is
// chosen by the selected engine's kind. Kept deliberately small — the modifier
// overlays and the Lyric/Metatag engine will add their own sub-states later
// without touching this shape.
import { getEngine, resolverCharacters, atomCharacterList, legacyPresetMap, legacyClusters, legacyClassic } from './registry.js';

export function newSeed() { return (Math.random() * 2147483647) >>> 0; }

export function initState() {
  // maxMode is global (persists across engine switches); res/leg are per-kind.
  // ov = modifier overlays (Composer / Producer / Remixer). Global like maxMode:
  // an overlay is a hand applied ON TOP of whichever engine is selected.
  const S = { engineId: 'Delerium', seed: newSeed(), maxMode: false,
              ov: { composer: '', producer: '', remixer: '' }, res: null, leg: null, atom: null };
  syncEngineDefaults(S, 'Delerium');
  return S;
}

// (Re)build the control sub-state when the engine changes.
export function syncEngineDefaults(S, engineId) {
  S.engineId = engineId;
  S.seed = newSeed();
  const eng = getEngine(engineId);

  if (eng.kind === 'atom') {
    const chars = atomCharacterList(eng.module);
    // palette is an axis on the atom path (electronic | acoustic); characters
    // without palettes (e.g. a validated ref) simply ignore it at generate.
    S.atom = { characterId: chars[0].id, palette: 'electronic', overlayId: '' };
    S.res = null; S.leg = null;
  } else if (eng.kind === 'resolver') {
    const chars = resolverCharacters(eng.module);
    S.res = {
      characterId: chars[0].id,
      palette: 'electronic',
      level: 'random',          // 'random' | 'lockSome' | 'manual'
      locks: {},                // role -> chosen text (only in lockSome/manual)
    };
    S.leg = null; S.atom = null;
  } else if (eng.kind === 'legacy') {
    const presetMap = legacyPresetMap(engineId);
    const clusters = legacyClusters(engineId);
    const classic = legacyClassic(engineId);
    S.leg = {
      presetDriven: !!presetMap,
      engineMode: 'preset',      // preset-driven engines (Enigma): 'preset' | 'manual'
      preset: presetMap ? Object.keys(presetMap)[0] : (classic.presets[0] || ''),
      phase: classic.phases[0] || '',
      buildMode: clusters.length ? 'cluster' : 'classic',
      cluster: clusters[0] || '',
      palette: 'electronic',
      arrangement: false,
      bpmOverride: '',
      chord: '',                 // dedicated Chords control (cluster/preset path)
      classicChord: '',          // dedicated Chords control (classic slot path)
      slots: {
        pad: classic.slots.pad[0] || '', bass: classic.slots.bass[0] || '',
        rhythm: classic.slots.rhythm[0] || '', percussion: classic.slots.percussion[0] || '',
        motif: classic.slots.motif[0] || '', movement: classic.slots.movement[0] || '',
      },
      slotLevel: 'random',       // classic manual: 'random' | 'lockSome' | 'manual'
      slotLocks: {},             // role -> chosen value (classic slot roles)
      clusterLevel: 'random',    // cluster/preset path: 'random' | 'lockSome' | 'manual'
      clusterLocks: {},          // cluster role -> chosen value
      vocalMode: 'Instrumental',
    };
    S.res = null; S.atom = null;
  } else {
    S.res = null; S.leg = null; S.atom = null;   // stub
  }
}

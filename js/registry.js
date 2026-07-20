// Engine registry (Option B): two engine KINDS live in one shell.
//   'resolver' — new engine-agnostic resolver (Delerium; Era/Deep Forest slot in here later)
//   'legacy'   — proven cluster/classic path harvested verbatim (Balearic, Enigma)
//   'stub'     — registered scope, not yet built (none remaining: all six engines are live)
import { ATOM_POOL_CHARACTERS } from '../engines/atom-characters.js';
import { atomCharacters, atomOverlayList } from '../core/atoms.js';
import { DELERIUM } from '../engines/delerium.js';
import { ERA } from '../engines/era.js';
import { DEEPFOREST } from '../engines/deepforest.js';
import { SACREDSPIRIT } from '../engines/sacredspirit.js';
import { EngineExtras } from '../legacy/engine-extras.js';
import { STYLE_ENGINES } from '../legacy/data-style-engines.js';

export const ENGINES = [
  { id: 'Balearic',    kind: 'legacy',   label: 'Balearic' },
  { id: 'Balearic Atom', kind: 'atom',   label: 'Balearic \u00b7 atom', module: ATOM_POOL_CHARACTERS },
  { id: 'Enigma',      kind: 'legacy',   label: 'Enigma' },
  { id: 'Delerium',    kind: 'resolver', label: 'Delerium', module: DELERIUM },
  { id: 'Era',         kind: 'resolver', label: 'Era', module: ERA },
  { id: 'Deep Forest',   kind: 'resolver', label: 'Deep Forest', module: DEEPFOREST },
  { id: 'Sacred Spirit', kind: 'resolver', label: 'Sacred Spirit', module: SACREDSPIRIT },
];

export function getEngine(id) {
  return ENGINES.find(e => e.id === id);
}

// ---- atom-kind helpers -----------------------------------------------------
export function atomCharacterList(module) { return atomCharacters(module); }
export function atomOverlays() { return atomOverlayList(); }

// ---- resolver-kind helpers -------------------------------------------------
export const RESOLVER_ROLES = ['pads', 'harmony', 'bass', 'lead', 'voice', 'color', 'movement'];

export function resolverCharacters(module) {
  return Object.keys(module.characters).map(id => {
    const c = module.characters[id];
    const tempo = c.beatless ? 'beatless' : `${c.bpm[0]}\u2013${c.bpm[1]} BPM`;
    return { id, label: c.label, source: c.source, tempo };
  });
}

// filtered pool for one role/character/palette -> [{value,label}] for a <select>
export function resolverRolePool(module, characterId, role, palette) {
  const pool = (module.characters[characterId].pools[role]) || [];
  const keep = pool.filter(o =>
    palette === 'blend' ? true :
    palette === 'electronic' ? (o.d === 'E' || o.d === 'B') :
    (o.d === 'A' || o.d === 'B'));
  return (keep.length ? keep : pool).map(o => ({ value: o.t, label: o.t }));
}

// ---- legacy-kind helpers ---------------------------------------------------
export function legacyPresetMap(id) { return (EngineExtras[id] || {}).presetMap || null; }
export function legacyClusters(id)  { return Object.keys((EngineExtras[id] || {}).flavourClusters || {}); }
export function legacyClassic(id)   {
  const e = STYLE_ENGINES[id] || {};
  return {
    presets: e.presets || [],
    phases: e.phases || [],
    slots: {
      pad: e.pads || [], harmony: e.harmony || [], bass: e.bass || [], rhythm: e.rhythm || [],
      percussion: e.percussion || [], motif: e.motifs || [], movement: e.movement || [],
    },
  };
}

// Cluster-kind role pools (Balearic flavour clusters + Enigma preset clusters).
// Mirrors the builder's palette rule: acoustic falls back to electronic when a
// palette doesn't define a role; blend can pull either on the character slots.
export const CLUSTER_ROLES = ['pads', 'harmony', 'bass', 'rhythm', 'perc', 'strings', 'texture', 'motif', 'counter', 'color', 'movement'];

export function legacyCluster(engineId, clusterId) {
  return ((EngineExtras[engineId] || {}).flavourClusters || {})[clusterId] || null;
}

export function legacyClusterRolePool(engineId, clusterId, role, palette) {
  const c = legacyCluster(engineId, clusterId);
  if (!c) return [];
  const E = (c.palettes && c.palettes.electronic) || {};
  const A = (c.palettes && c.palettes.acoustic) || {};
  const e = E[role] || [], a = A[role] || [];
  let pool;
  if (palette === 'acoustic') pool = a.length ? a : e;
  else if (palette === 'blend') {
    const character = (role === 'bass' || role === 'strings' || role === 'motif');
    pool = character ? [...new Set([...e, ...a])] : e;
  } else pool = e;
  return pool.map(x => ({ value: x, label: x }));
}

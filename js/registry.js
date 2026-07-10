// Engine registry (Option B): two engine KINDS live in one shell.
//   'resolver' — new engine-agnostic resolver (Delerium; Era/Deep Forest slot in here later)
//   'legacy'   — proven cluster/classic path harvested verbatim (Balearic, Enigma)
//   'stub'     — registered scope, not yet built (Era, Deep Forest)
import { DELERIUM } from '../engines/delerium.js';
import { ERA } from '../engines/era.js';
import { EngineExtras } from '../legacy/engine-extras.js';
import { STYLE_ENGINES } from '../legacy/data-style-engines.js';

export const ENGINES = [
  { id: 'Balearic',    kind: 'legacy',   label: 'Balearic' },
  { id: 'Enigma',      kind: 'legacy',   label: 'Enigma' },
  { id: 'Delerium',    kind: 'resolver', label: 'Delerium', module: DELERIUM },
  { id: 'Era',         kind: 'resolver', label: 'Era', module: ERA },
  { id: 'Deep Forest', kind: 'stub',     label: 'Deep Forest' },
];

export function getEngine(id) {
  return ENGINES.find(e => e.id === id);
}

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
      pad: e.pads || [], bass: e.bass || [], rhythm: e.rhythm || [],
      percussion: e.percussion || [], motif: e.motifs || [], movement: e.movement || [],
    },
  };
}

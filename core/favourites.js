// Favourites — save a generated prompt and recall it later.
//
// A favourite stores TWO things deliberately:
//   1. CONFIG  — engine, character/palette/preset sub-state, overlays, maxMode and
//                the SEED. Because every path is seeded/deterministic, restoring the
//                config regenerates the same prompt from the live engine.
//   2. SNAPSHOT — the literal style / negative / lyrics text at save time.
//
// Why both: config alone is not durable. The engines are still being revised, so a
// config saved today can render differently after a pool or compose change. The
// snapshot is the guarantee that what John heard in Suno is recoverable verbatim;
// the config is what lets him re-roll around it. On recall the two are compared and
// any divergence is reported rather than silently swallowed.
//
// Storage is browser-local (localStorage). That is the only option for a static,
// backend-free app — see exportAll/importAll for the durable off-machine path.

const KEY = 'atmos.favourites.v1';
const MAX_ITEMS = 500;

function storage() {
  try {
    const s = (typeof localStorage !== 'undefined') ? localStorage : null;
    if (!s) return null;
    s.setItem('__atmos_probe', '1'); s.removeItem('__atmos_probe');
    return s;
  } catch (e) { return null; }   // file:// origin, private mode, or quota-locked
}

export function favStorageAvailable() { return storage() !== null; }

function readRaw() {
  const s = storage();
  if (!s) return [];
  try {
    const parsed = JSON.parse(s.getItem(KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter(isValidRecord) : [];
  } catch (e) { return []; }
}

function writeRaw(list) {
  const s = storage();
  if (!s) return false;
  try { s.setItem(KEY, JSON.stringify(list.slice(0, MAX_ITEMS))); return true; }
  catch (e) { return false; }    // quota exceeded
}

function isValidRecord(r) {
  return !!r && typeof r === 'object'
    && typeof r.id === 'string'
    && typeof r.name === 'string'
    && !!r.config && typeof r.config === 'object'
    && !!r.snapshot && typeof r.snapshot.style === 'string';
}

function newId() {
  return 'fav_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

// Deep clone via JSON — the control sub-states are plain data by design.
function clone(o) { return JSON.parse(JSON.stringify(o)); }

// The subset of shell state that fully determines a build. Kept explicit rather
// than cloning S wholesale so a future transient UI field can never leak in.
export function favConfigFromState(S) {
  return {
    engineId: S.engineId,
    seed: S.seed,
    maxMode: !!S.maxMode,
    ov: clone(S.ov || {}),
    res: S.res ? clone(S.res) : null,
    leg: S.leg ? clone(S.leg) : null,
    atom: S.atom ? clone(S.atom) : null,
  };
}

// Write a config back onto the live shell state, in place.
export function favApplyConfigToState(S, config) {
  S.engineId = config.engineId;
  S.seed = config.seed;
  S.maxMode = !!config.maxMode;
  S.ov = clone(config.ov || { composer: '', producer: '', remixer: '' });
  S.res = config.res ? clone(config.res) : null;
  S.leg = config.leg ? clone(config.leg) : null;
  S.atom = config.atom ? clone(config.atom) : null;
  return S;
}

export function favList() {
  return readRaw().sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || ''));
}

export function favGet(id) { return readRaw().find(r => r.id === id) || null; }

// out = the generate() result being saved.
export function favSave(name, S, out, now) {
  const rec = {
    id: newId(),
    name: (name || '').trim() || defaultName(S),
    savedAt: (now || new Date()).toISOString(),
    engineId: S.engineId,
    config: favConfigFromState(S),
    snapshot: {
      style: out.style || '',
      negative: out.negative || '',
      lyrics: out.lyrics || '',
      metatags: out.metatags || '',
    },
  };
  const next = [rec, ...readRaw().filter(r => r.id !== rec.id)];
  return writeRaw(next) ? rec : null;
}

export function favRename(id, name) {
  const list_ = readRaw();
  const r = list_.find(x => x.id === id);
  if (!r) return false;
  r.name = (name || '').trim() || r.name;
  return writeRaw(list_);
}

export function favRemove(id) {
  const next = readRaw().filter(r => r.id !== id);
  return writeRaw(next);
}

export function favClear() { return writeRaw([]); }

function defaultName(S) {
  const bits = [S.engineId];
  if (S.atom && S.atom.characterId) bits.push(S.atom.characterId);
  else if (S.res && S.res.characterId) bits.push(S.res.characterId);
  else if (S.leg) bits.push(S.leg.preset || S.leg.cluster || 'classic');
  return bits.filter(Boolean).join(' / ');
}

// Recall: restore the config, regenerate from the live engine, and report whether
// the live render still matches the snapshot. `regenerate` is injected so this
// module stays free of engine imports (and testable without the shell).
export function favRecall(id, S, regenerate) {
  const rec = favGet(id);
  if (!rec) return null;
  favApplyConfigToState(S, rec.config);
  const live = regenerate ? regenerate(S) : null;
  const drifted = !!live && live.style !== rec.snapshot.style;
  return { record: rec, live, drifted };
}

// ---- portability -----------------------------------------------------------
// localStorage is per-browser and per-origin, and is unavailable on some file://
// origins. Export/import is the durable path: it survives a cache clear, a new
// machine and the download-ZIP build.
export function favExportAll() {
  return JSON.stringify({ kind: 'atmos-favourites', version: 1, items: readRaw() }, null, 2);
}

// mode: 'merge' (default, keeps existing) | 'replace'
export function favImportAll(json, mode) {
  let parsed;
  try { parsed = JSON.parse(json); } catch (e) { return { ok: false, error: 'Not valid JSON', added: 0 }; }
  const tagged = !!parsed && parsed.kind === 'atmos-favourites';
  const items = (tagged && Array.isArray(parsed.items)) ? parsed.items.filter(isValidRecord) : null;
  if (!items) return { ok: false, error: 'Not an ATMOS favourites file', added: 0 };
  const existing = (mode === 'replace') ? [] : readRaw();
  const seen = new Set(existing.map(r => r.id));
  const added = items.filter(r => !seen.has(r.id));
  const ok = writeRaw([...added, ...existing]);
  return { ok, error: ok ? null : 'Could not write to storage', added: ok ? added.length : 0 };
}

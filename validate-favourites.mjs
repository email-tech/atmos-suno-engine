// Favourites validator. Exercises the store against an in-memory localStorage
// stand-in, and proves the round trip that actually matters: save a build, mutate
// the shell state, recall it, and confirm the regenerated prompt is byte-identical
// to the snapshot. That is the whole promise of the feature.
const mem = new Map();
globalThis.localStorage = {
  getItem: k => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => { mem.set(k, String(v)); },
  removeItem: k => { mem.delete(k); },
};

const F = await import('./core/favourites.js');
const { initState, newSeed } = await import('./js/state.js');
const { generate } = await import('./js/generate.js');
const { ENGINES } = await import('./js/registry.js');

let checks = 0, fails = 0;
const ok = (cond, msg) => { checks++; if (!cond) { fails++; console.log('  FAIL: ' + msg); } };

// 1. storage detection
ok(F.favStorageAvailable() === true, 'storage should be available with the stand-in');
F.favClear();
ok(F.favList().length === 0, 'store starts empty');

// 2. save + recall round trip on EVERY built engine
const built = ENGINES.filter(e => e.kind !== 'stub');
for (const eng of built) {
  const S = initState();
  const { syncEngineDefaults } = await import('./js/state.js');
  syncEngineDefaults(S, eng.id);
  S.seed = 123456789;
  const out = generate(S);

  const rec = F.favSave(`test ${eng.id}`, S, out);
  ok(!!rec, `${eng.id}: save returns a record`);
  ok(rec.snapshot.style === out.style, `${eng.id}: snapshot captures the style verbatim`);

  // scramble the live state, then recall
  S.seed = newSeed();
  S.maxMode = !S.maxMode;
  const res = F.favRecall(rec.id, S, generate);
  ok(!!res, `${eng.id}: recall finds the record`);
  ok(S.seed === 123456789, `${eng.id}: recall restores the seed`);
  ok(res.live.style === rec.snapshot.style, `${eng.id}: regenerated style is byte-identical to the snapshot`);
  ok(res.drifted === false, `${eng.id}: no drift reported on an unchanged engine`);
  ok(res.live.negative === rec.snapshot.negative, `${eng.id}: negative prompt round-trips`);
}

// 3. drift detection — a snapshot that no longer matches must be flagged
{
  const S = initState();
  const rec = F.favSave('drift probe', S, generate(S));
  const all = JSON.parse(localStorage.getItem('atmos.favourites.v1'));
  all.find(r => r.id === rec.id).snapshot.style = 'something the engine would never emit';
  localStorage.setItem('atmos.favourites.v1', JSON.stringify(all));
  const res = F.favRecall(rec.id, S, generate);
  ok(res.drifted === true, 'drift is detected when the live render differs from the snapshot');
}

// 4. naming, rename, delete
{
  const S = initState();
  const rec = F.favSave('', S, generate(S));       // blank name -> default
  ok(rec.name.includes(S.engineId), 'blank name falls back to an engine-derived default');
  ok(F.favRename(rec.id, 'renamed') === true, 'rename succeeds');
  ok(F.favGet(rec.id).name === 'renamed', 'rename persists');
  F.favRemove(rec.id);
  ok(F.favGet(rec.id) === null, 'delete removes the record');
}

// 5. export / import
{
  const before = F.favList().length;
  const json = F.favExportAll();
  ok(JSON.parse(json).kind === 'atmos-favourites', 'export is a tagged ATMOS file');
  const merged = F.favImportAll(json, 'merge');
  ok(merged.ok && merged.added === 0, 'importing the same file adds no duplicates');
  ok(F.favList().length === before, 'merge import does not change the count');
  ok(F.favImportAll('not json').ok === false, 'garbage input is rejected cleanly');
  ok(F.favImportAll('{"items":[]}').ok === false, 'an untagged file is rejected');
}

// 6. corrupt store must not throw
{
  localStorage.setItem('atmos.favourites.v1', '{{{');
  ok(Array.isArray(F.favList()) && F.favList().length === 0, 'corrupt store degrades to empty, not a throw');
}

// 7. config isolation — the saved config must not alias live state
{
  F.favClear();
  const S = initState();
  const rec = F.favSave('isolation', S, generate(S));
  if (S.atom) S.atom.characterId = '__mutated__';
  if (S.res) S.res.characterId = '__mutated__';
  if (S.leg) S.leg.preset = '__mutated__';
  const stored = F.favGet(rec.id).config;
  const mutated = JSON.stringify(stored).includes('__mutated__');
  ok(!mutated, 'stored config is a deep clone, not a live reference');
}

console.log(`favourites: ${checks} checks, ${fails} failures`);
if (fails) process.exit(1);

// Headless validation of the legacy cluster/preset path after the Balearic
// harmony+colour+interplay work and the 3-level cluster lock control.
import { EngineExtras } from './legacy/engine-extras.js';
import { buildStylePrompt, buildNegativePrompt } from './legacy/prompt-style-builder.js';
import { STYLE_ENGINES } from './legacy/data-style-engines.js';

const LIMIT = 1000;
const PALETTES = ['electronic', 'acoustic', 'blend'];
const BEATLESS_WORDS = ['drum kit', 'kick drum', 'four-on-the-floor', 'snare', 'hi-hat', 'congas', 'bongos', 'shaker'];

// instrument tokens we never want named twice in one prompt
const INSTR = ['tabla', 'bouzouki', 'clavinet', 'hammond organ', 'mellotron', 'cello', 'viola', 'harmonium',
  'string-machine', 'juno-style', 'marimba', 'sitar', 'cowbell', 'tambourine', 'cajon', 'timbale', 'woodblock',
  'rhodes', 'wurlitzer', 'nylon guitar', 'acoustic guitar', 'electric guitar', 'marimba', 'vibraphone',
  'kalimba', 'harp', 'flute', 'pan flute', 'clarinet', 'oboe', 'celeste', 'glockenspiel', 'melodica', 'trumpet',
  'accordion', 'mandolin', 'harmonica', 'clavinet', 'organ', 'piano', 'upright bass', 'sub bass', 'fretless bass',
  'bouzouki', 'kora', 'santoor', 'hang drum', 'toy-piano', 'autoharp', 'steel-pan', 'tubular bell', 'music-box',
  'shakuhachi', 'sitar', 'duduk', 'bamboo flute', 'sax', 'flugelhorn', 'lap-steel', 'slide guitar', 'ney-flute', 'felt-piano', 'grand-piano', 'whistl'];

let draws = 0, over = 0, fails = [];
const stats = {};

function mkState(engine, l, seed) {
  return {
    engine,
    style: {
      buildMode: l.presetDriven ? 'classic' : 'cluster',
      cluster: l.cluster, preset: l.preset, palette: l.palette,
      arrangement: false, bpmOverride: '', phase: l.phase,
      rngSeed: seed, slotLocks: l.locks || {},
      pad: '', bass: '', rhythm: '', percussion: '', motif: '', movement: '',
      vocalMode: 'Instrumental', vocalDescriptor: '', vocalPersona: '',
      maxMode: false, negativePrompt: '',
    },
  };
}

function check(engine, clusterId, palette, style, negative, seed) {
  draws++;
  const key = `${engine}/${clusterId}/${palette}`;
  stats[key] = stats[key] || { n: 0, harmony: 0, color: 0, interplay: 0, min: 1e9, max: 0, uniq: new Set() };
  const st = stats[key];
  st.n++; st.min = Math.min(st.min, style.length); st.max = Math.max(st.max, style.length);
  st.uniq.add(style);
  if (style.length > LIMIT) { over++; fails.push(`OVER ${key} seed ${seed} (${style.length})`); }

  const c = EngineExtras[engine].flavourClusters[clusterId];
  const low = style.toLowerCase();

  // harmony present?
  const H = (c.palettes.electronic.harmony || []).concat(c.palettes.acoustic.harmony || []);
  if (H.some(h => style.includes(h))) st.harmony++;
  ['perc', 'texture', 'counter'].forEach(r => {
    const P = (c.palettes.electronic[r] || []).concat(c.palettes.acoustic[r] || []);
    if (!P.length) return;
    st[r] = st[r] || 0;
    if (P.some(x => style.includes(x))) st[r]++;
  });
  // instrument-layer count: how many named-instrument slots survived the budget
  st.layers = (st.layers || 0) + style.split(',').length;
  const C = (c.palettes.electronic.color || []).concat(c.palettes.acoustic.color || []);
  if (C.some(x => style.includes(x))) st.color++;
  const IP = Object.values(c.interplay || {}).flat();
  if (IP.some(x => style.includes(x))) st.interplay++;

  // beatless leak
  if (c.beatless && BEATLESS_WORDS.some(w => low.includes(w)))
    fails.push(`BEATLESS LEAK ${key} seed ${seed}`);

  // banned leak — cluster-level bans only (engine bannedInstruments is legacy dead
  // data: it is not fed into the negative builder and the proven motif pools
  // already contradict it, e.g. "arpeggiated synth leads". Reported separately.)
  const remove = new Set((c.bannedRemove || []).map(x => x.toLowerCase().trim()));
  const bans = (c.bannedAdd || []).map(x => x.toLowerCase().trim()).filter(x => !remove.has(x));
  bans.forEach(b => { if (low.includes(b)) fails.push(`BANNED "${b}" ${key} seed ${seed}`); });

  // duplicate instrument naming (word-boundary, so "organic" != "organ")
  INSTR.forEach(tok => {
    const re = new RegExp('\\b' + tok.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') + 's?\\b', 'g');
    const n = (low.match(re) || []).length;
    if (n > 1) fails.push(`DUP "${tok}" x${n} ${key} seed ${seed}`);
  });

  if (!negative || !negative.length) fails.push(`NO NEGATIVE ${key}`);
}

for (const engine of ['Balearic', 'Enigma']) {
  const ex = EngineExtras[engine];
  const presetMap = ex.presetMap;
  const phases = (STYLE_ENGINES[engine].phases || []);
  const entries = presetMap
    ? Object.keys(presetMap).map(p => ({ preset: p, cluster: presetMap[p].cluster, presetDriven: true }))
    : Object.keys(ex.flavourClusters).map(k => ({ cluster: k, presetDriven: false }));

  for (const e of entries) {
    for (const palette of PALETTES) {
      for (let i = 0; i < 350; i++) {
        const seed = (Math.random() * 2 ** 31) >>> 0;
        const l = { ...e, palette, phase: phases[i % phases.length] || '' };
        const state = mkState(engine, l, seed);
        check(engine, e.cluster, palette, buildStylePrompt(state), buildNegativePrompt(state), seed);
      }
    }
  }
}

// lock behaviour: locked role must appear verbatim; determinism per seed
let lockFails = 0;
for (const clusterId of Object.keys(EngineExtras.Balearic.flavourClusters)) {
  const c = EngineExtras.Balearic.flavourClusters[clusterId];
  for (const palette of PALETTES) {
    for (const role of ['pads', 'harmony', 'bass', 'motif', 'color', 'movement']) {
      const pool = (c.palettes.electronic[role] || []);
      if (!pool.length) continue;
      const want = pool[pool.length - 1];
      const seed = 12345;
      const l = { cluster: clusterId, palette, phase: '', locks: { [role]: want } };
      const s1 = buildStylePrompt(mkState('Balearic', l, seed));
      const s2 = buildStylePrompt(mkState('Balearic', l, seed));
      if (s1 !== s2) { lockFails++; fails.push(`NON-DETERMINISTIC ${clusterId}/${palette}`); }
      if (!s1.includes(want)) { lockFails++; fails.push(`LOCK IGNORED ${role} ${clusterId}/${palette}`); }
      draws += 2;
    }
  }
}

// report
const rows = Object.keys(stats).sort();
let missingHarm = 0, missingIP = 0;
for (const k of rows) {
  const s = stats[k];
  const hPct = Math.round(100 * s.harmony / s.n), cPct = Math.round(100 * s.color / s.n), iPct = Math.round(100 * s.interplay / s.n);
  if (hPct < 100) missingHarm++;
  if (k.startsWith('Balearic') && iPct < 100) missingIP++;
  const pc = r => s[r] == null ? '  -' : String(Math.round(100 * s[r] / s.n)).padStart(3) + '%';
  console.log(`${k.padEnd(40)} len ${String(s.min).padStart(3)}-${String(s.max).padStart(4)} uniq=${String(s.uniq.size).padStart(3)}  chords ${String(hPct).padStart(3)}%  perc ${pc('perc')}  texture ${pc('texture')}  counter ${pc('counter')}  colour ${String(cPct).padStart(3)}%  interplay ${String(iPct).padStart(3)}%  parts~${(s.layers / s.n).toFixed(1)}`);
}
console.log(`\ndraws: ${draws}  over-limit: ${over}  lock failures: ${lockFails}`);
console.log(`clusters without 100% harmony: ${missingHarm}   Balearic clusters without 100% interplay: ${missingIP}`);
const uniqFails = [...new Set(fails)];
console.log(`failures: ${fails.length} (${uniqFails.length} unique)`);
uniqFails.slice(0, 25).forEach(f => console.log('  ' + f));

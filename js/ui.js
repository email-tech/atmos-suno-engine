import {
  ENGINES, getEngine, RESOLVER_ROLES, resolverCharacters, resolverRolePool,
  legacyClusters, legacyClassic, legacyCluster, legacyClusterRolePool, CLUSTER_ROLES,
} from './registry.js';
import { syncEngineDefaults, newSeed } from './state.js';
import { generate } from './generate.js';

// ---- tiny DOM helpers ------------------------------------------------------
function el(tag, attrs = {}, kids = []) {
  const n = document.createElement(tag);
  for (const k in attrs) {
    if (k === 'class') n.className = attrs[k];
    else if (k === 'text') n.textContent = attrs[k];
    else if (k === 'html') n.innerHTML = attrs[k];
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), attrs[k]);
    else n.setAttribute(k, attrs[k]);
  }
  (Array.isArray(kids) ? kids : [kids]).forEach(c => c && n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
  return n;
}
function field(label, control) { return el('label', { class: 'field' }, [el('span', { class: 'field-label', text: label }), control]); }
function select(options, value, onchange) {
  const s = el('select', { onchange: e => onchange(e.target.value) });
  options.forEach(o => {
    const opt = el('option', { value: o.value }, o.label);
    if (o.value === value) opt.selected = true;
    s.appendChild(opt);
  });
  return s;
}
function segmented(options, value, onpick) {
  // The active class is updated here on click. Handlers that only call
  // refreshOutput() (they repaint the output panel, not the controls) previously
  // left the highlight stuck on the old option even though the prompt changed.
  const wrap = el('div', { class: 'seg' });
  const btns = options.map(o => el('button', {
    class: o.value === value ? 'active' : '',
    text: o.label,
    onclick: (e) => {
      btns.forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      onpick(o.value);
    },
  }));
  btns.forEach(b => wrap.appendChild(b));
  return wrap;
}

// Shared 3-level control (Randomize all / Lock some / Full manual) over any role set.
// opts: { roles, labelFor, optionsFor(role)->[{value,label}], level, onLevel(v), locks }
function lockControl(root, opts) {
  root.appendChild(field('Control level', segmented(
    [['random', 'Randomize all'], ['lockSome', 'Lock some'], ['manual', 'Full manual']].map(([value, label]) => ({ value, label })),
    opts.level, v => opts.onLevel(v))));
  if (opts.level === 'random') return;
  const box = el('div', { class: 'locks' });
  opts.roles.forEach(role => {
    const options = [{ value: '', label: '\uD83C\uDFB2 random' }, ...opts.optionsFor(role)];
    const cur = opts.locks[role] != null ? opts.locks[role] : '';
    box.appendChild(field(opts.labelFor(role),
      select(options, cur, v => { if (v === '') delete opts.locks[role]; else opts.locks[role] = v; refreshOutput(); })));
  });
  root.appendChild(box);
}
function clusterRoleLabel(role) {
  return { pads: 'Pads', harmony: 'Chords', bass: 'Bass', rhythm: 'Drums', perc: 'Percussion layer',
           strings: 'Strings / choir', texture: 'Texture layer', motif: 'Motif',
           counter: 'Counter-melody', color: 'Colour', movement: 'Movement' }[role] || role;
}
// Chords is surfaced as its own top-level control (it drives the song's harmonic
// and structural shape), so it is excluded from the instrument lock box.
function chordField(pool, value, onpick) {
  const options = [{ value: '', label: '\uD83C\uDFB2 random chords' }, ...pool];
  return field('Chords', select(options, value, onpick));
}
// Roles this cluster actually populates for the active palette (beatless clusters
// have no rhythm pool; a cluster with no colour pool shows no Colour row).
function clusterRolesFor(engineId, clusterId, palette) {
  return CLUSTER_ROLES.filter(r => r !== 'harmony' && legacyClusterRolePool(engineId, clusterId, r, palette).length);
}
function seedClusterManual(engineId, clusterId, palette, l) {
  clusterRolesFor(engineId, clusterId, palette).forEach(role => {
    const pool = legacyClusterRolePool(engineId, clusterId, role, palette);
    if (pool.length) l.clusterLocks[role] = pool[0].value;
  });
}
function clusterLockControl(root, engineId, clusterId, l) {
  lockControl(root, {
    roles: clusterRolesFor(engineId, clusterId, l.palette),
    labelFor: clusterRoleLabel,
    optionsFor: role => legacyClusterRolePool(engineId, clusterId, role, l.palette),
    level: l.clusterLevel,
    onLevel: v => {
      l.clusterLevel = v; l.clusterLocks = {};
      if (v === 'manual') seedClusterManual(engineId, clusterId, l.palette, l);
      renderAll();
    },
    locks: l.clusterLocks,
  });
}
function classicSlotLabel(role) {
  return { pad: 'Pad', bass: 'Bass', rhythm: 'Rhythm', percussion: 'Strings', motif: 'Motif', movement: 'Movement' }[role] || role;
}
const CLASSIC_ROLES = ['pad', 'bass', 'rhythm', 'percussion', 'motif', 'movement'];

// ---- module state ----------------------------------------------------------
let S, rootEl;
export function mount(state, root) { S = state; rootEl = root; renderAll(); }

function renderAll() {
  rootEl.innerHTML = '';
  rootEl.appendChild(el('div', { class: 'tabs' }, ENGINES.map(e => {
    const disabled = e.kind === 'stub';
    return el('button', {
      class: 'tab' + (e.id === S.engineId ? ' active' : '') + (disabled ? ' disabled' : ''),
      onclick: () => { if (!disabled) { syncEngineDefaults(S, e.id); renderAll(); } },
    }, [el('span', { text: e.label }), el('span', { class: 'kind', text: e.kind === 'resolver' ? 'resolver' : e.kind === 'legacy' ? 'proven' : 'soon' })]);
  })));

  const grid = el('div', { class: 'grid' });
  const controls = el('div', { class: 'panel controls' });
  const output = el('div', { class: 'panel output', id: 'output' });
  grid.appendChild(controls); grid.appendChild(output);
  rootEl.appendChild(grid);

  const eng = getEngine(S.engineId);
  if (eng.kind === 'resolver') renderResolverControls(controls, eng);
  else if (eng.kind === 'legacy') renderLegacyControls(controls, eng);
  else renderStub(controls, eng);

  refreshOutput();
}

// ---- resolver controls -----------------------------------------------------
function renderResolverControls(root, eng) {
  const r = S.res;
  const chars = resolverCharacters(eng.module);
  const c = eng.module.characters[r.characterId];

  root.appendChild(field('Character',
    select(chars.map(x => ({ value: x.id, label: `${x.label} \u2014 ${x.source} \u2014 ${x.tempo}` })), r.characterId,
      v => { r.characterId = v; r.locks = {}; renderAll(); })));

  root.appendChild(field('Palette',
    segmented([['electronic', 'Electronic'], ['acoustic', 'Acoustic'], ['blend', 'Blend']].map(([value, label]) => ({ value, label })),
      r.palette, v => { r.palette = v; r.locks = {}; renderAll(); })));

  lockControl(root, {
    roles: RESOLVER_ROLES.filter(role => !(role === 'color' && c.colorChance === 0)),
    labelFor: roleLabel,
    optionsFor: role => resolverRolePool(eng.module, r.characterId, role, r.palette),
    level: r.level,
    onLevel: v => { r.level = v; r.locks = {}; if (v === 'manual') seedManualLocks(eng, r); renderAll(); },
    locks: r.locks,
  });

  const drums = c.beatless ? 'Beatless (no drum pool)' : `Auto \u2014 ${c.drums.primary} family`;
  root.appendChild(el('p', { class: 'note', text: `Drums: ${drums}. Colour fires ~${Math.round(c.colorChance * 100)}% of draws.` }));

  root.appendChild(buttons());
}
function seedManualLocks(eng, r) {
  const c = eng.module.characters[r.characterId];
  RESOLVER_ROLES.forEach(role => {
    if (role === 'color' && c.colorChance === 0) return;
    const pool = resolverRolePool(eng.module, r.characterId, role, r.palette);
    if (pool.length) r.locks[role] = pool[0].value;
  });
}
function roleLabel(role) {
  return { pads: 'Pads', harmony: 'Harmony', bass: 'Bass', lead: 'Lead', voice: 'Voice', color: 'Colour', movement: 'Movement' }[role] || role;
}
function seedClassicManual(engineId, l) {
  const arrs = legacyClassic(engineId).slots;
  CLASSIC_ROLES.forEach(role => { const a = arrs[role] || []; if (a.length) l.slotLocks[role] = a[0]; });
}

// ---- legacy controls -------------------------------------------------------
function renderLegacyControls(root, eng) {
  const l = S.leg;

  if (l.presetDriven) {
    root.appendChild(field('Engine mode',
      segmented([['preset', 'Engine preset'], ['manual', 'Manual mix']].map(([value, label]) => ({ value, label })),
        l.engineMode, v => { l.engineMode = v; renderAll(); })));

    if (l.engineMode === 'preset') {
      const map = (window.__ATMOS.EngineExtras[eng.id] || {}).presetMap;
      root.appendChild(field('Engine preset',
        select(Object.keys(map).map(k => ({ value: k, label: k })), l.preset,
          v => { l.preset = v; l.clusterLocks = {}; l.chord = ''; renderAll(); })));
      root.appendChild(field('Phase (tempo / energy)',
        select(legacyClassic(eng.id).phases.map(p => ({ value: p, label: p })), l.phase,
          v => { l.phase = v; refreshOutput(); })));
      root.appendChild(field('Palette',
        segmented(seg3(), l.palette, v => { l.palette = v; l.clusterLocks = {}; l.chord = ''; renderAll(); })));
      root.appendChild(chordField(
        legacyClusterRolePool(eng.id, (map[l.preset] || {}).cluster, 'harmony', l.palette),
        l.chord, v => { l.chord = v; refreshOutput(); }));
      clusterLockControl(root, eng.id, (map[l.preset] || {}).cluster, l);
      root.appendChild(el('p', { class: 'note', text: 'Interaction / arrangement language is always on.' }));
      root.appendChild(field('Vocal', segmented(vocalSeg(), l.vocalMode, v => { l.vocalMode = v; refreshOutput(); })));
      root.appendChild(buttons());
      return;
    }

    // manual mix — proven classic slot path with the same 3-level control as Delerium
    root.appendChild(field('Phase (tempo / energy)',
      select(legacyClassic(eng.id).phases.map(p => ({ value: p, label: p })), l.phase, v => { l.phase = v; refreshOutput(); })));
    root.appendChild(chordField(
      (legacyClassic(eng.id).slots.harmony || []).map(x => ({ value: x, label: x })),
      l.classicChord, v => { l.classicChord = v; refreshOutput(); }));
    lockControl(root, {
      roles: CLASSIC_ROLES,
      labelFor: classicSlotLabel,
      optionsFor: role => (legacyClassic(eng.id).slots[role] || []).map(x => ({ value: x, label: x })),
      level: l.slotLevel,
      onLevel: v => { l.slotLevel = v; l.slotLocks = {}; if (v === 'manual') seedClassicManual(eng.id, l); renderAll(); },
      locks: l.slotLocks,
    });
    root.appendChild(field('Vocal', segmented(vocalSeg(), l.vocalMode, v => { l.vocalMode = v; refreshOutput(); })));
    root.appendChild(buttons());
    return;
  }

  // fork engine (Balearic): Flavour cluster / Classic mix
  root.appendChild(field('Build mode',
    segmented([['cluster', 'Flavour cluster'], ['classic', 'Classic mix']].map(([value, label]) => ({ value, label })),
      l.buildMode, v => { l.buildMode = v; renderAll(); })));

  if (l.buildMode === 'cluster') {
    root.appendChild(field('Cluster',
      select(legacyClusters(eng.id).map(k => ({ value: k, label: clusterLabel(eng.id, k) })), l.cluster,
        v => { l.cluster = v; l.clusterLocks = {}; l.chord = ''; renderAll(); })));
    root.appendChild(field('Palette', segmented(seg3(), l.palette,
      v => { l.palette = v; l.clusterLocks = {}; l.chord = ''; renderAll(); })));
    root.appendChild(field('BPM override', el('input', { class: 'txt', type: 'text', value: l.bpmOverride, placeholder: 'optional', oninput: e => { l.bpmOverride = e.target.value; refreshOutput(); } })));
    root.appendChild(chordField(
      legacyClusterRolePool(eng.id, l.cluster, 'harmony', l.palette),
      l.chord, v => { l.chord = v; refreshOutput(); }));
    clusterLockControl(root, eng.id, l.cluster, l);
    root.appendChild(el('p', { class: 'note', text: 'Interaction / arrangement language is always on for Balearic clusters.' }));
  } else {
    root.appendChild(field('Phase', select(legacyClassic(eng.id).phases.map(p => ({ value: p, label: p })), l.phase, v => { l.phase = v; refreshOutput(); })));
    root.appendChild(chordField(
      (legacyClassic(eng.id).slots.harmony || []).map(x => ({ value: x, label: x })),
      l.classicChord, v => { l.classicChord = v; refreshOutput(); }));
    lockControl(root, {
      roles: CLASSIC_ROLES,
      labelFor: classicSlotLabel,
      optionsFor: role => (legacyClassic(eng.id).slots[role] || []).map(x => ({ value: x, label: x })),
      level: l.slotLevel,
      onLevel: v => { l.slotLevel = v; l.slotLocks = {}; if (v === 'manual') seedClassicManual(eng.id, l); renderAll(); },
      locks: l.slotLocks,
    });
  }
  root.appendChild(field('Vocal', segmented(vocalSeg(), l.vocalMode, v => { l.vocalMode = v; refreshOutput(); })));
  root.appendChild(buttons());
}

function clusterLabel(engineId, clusterId) {
  const c = legacyCluster(engineId, clusterId);
  return c && c.label ? c.label : clusterId;
}
function seg3() { return [['electronic', 'Electronic'], ['acoustic', 'Acoustic'], ['blend', 'Blend']].map(([value, label]) => ({ value, label })); }
function vocalSeg() { return [['Instrumental', 'Instrumental'], ['Descriptor', 'Descriptor'], ['Persona', 'Persona']].map(([value, label]) => ({ value, label })); }
function toggle(label, checked, onchange) {
  const cb = el('input', { type: 'checkbox', onchange: e => onchange(e.target.checked) });
  cb.checked = checked;
  return el('label', { class: 'toggle' }, [cb, el('span', { text: label })]);
}

function renderStub(root, eng) {
  root.appendChild(el('div', { class: 'stub' }, [
    el('h3', { text: `${eng.label} \u2014 not built yet` }),
    el('p', { text: 'Registered in scope. Slots into the resolver kind (same as Delerium) once its palette + character pools are authored and validated.' }),
  ]));
}

// ---- shared buttons + output ----------------------------------------------
function buttons() {
  return el('div', { class: 'actions-wrap' }, [
    el('div', { class: 'maxmode' }, toggle('Max Mode', S.maxMode, v => { S.maxMode = v; refreshOutput(); })),
    el('div', { class: 'actions' }, [
      el('button', { class: 'primary', text: 'Generate', onclick: () => { S.seed = newSeed(); refreshOutput(); } }),
      el('button', { class: 'ghost', text: 'Re-roll instruments', onclick: () => { S.seed = newSeed(); refreshOutput(); } }),
    ]),
  ]);
}

function refreshOutput() {
  const host = document.getElementById('output');
  if (!host) return;
  host.innerHTML = '';
  const eng = getEngine(S.engineId);
  if (eng.kind === 'stub') { host.appendChild(el('p', { class: 'note', text: 'Select a built engine to generate.' })); return; }

  const res = generate(S);
  host.appendChild(outBlock('Style prompt', res.style, res.length, res.over));
  host.appendChild(outBlock('Negative prompt', res.negative, null, false));
  const lyr = res.lyrics || '[Instrumental]';
  host.appendChild(outBlock('Lyrics field', lyr, null, false, 'Paste into Suno\u2019s lyrics box; use Suno\u2019s Instrumental toggle for reliable vocal suppression.'));
}

function outBlock(title, text, length, over, hint) {
  const head = el('div', { class: 'out-head' }, [el('h4', { text: title })]);
  if (length != null) head.appendChild(el('span', { class: 'meter' + (over ? ' over' : ''), text: `${length}/1000` }));
  head.appendChild(el('button', { class: 'copy', text: 'Copy', onclick: (e) => { copy(text); e.target.textContent = 'Copied'; setTimeout(() => e.target.textContent = 'Copy', 1200); } }));
  const kids = [head, el('textarea', { class: 'out', readonly: 'readonly', rows: title === 'Style prompt' ? 5 : 2 }, text)];
  if (hint) kids.push(el('p', { class: 'hint', text: hint }));
  return el('div', { class: 'out-block' }, kids);
}
function copy(t) {
  if (navigator.clipboard) navigator.clipboard.writeText(t).catch(() => {});
}

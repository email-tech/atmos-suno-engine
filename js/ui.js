import {
  ENGINES, getEngine, RESOLVER_ROLES, resolverCharacters, resolverRolePool,
  atomCharacterList, atomOverlays,
  legacyClusters, legacyClassic, legacyCluster, legacyClusterRolePool, CLUSTER_ROLES,
} from './registry.js';
import { syncEngineDefaults, newSeed, setSongType, setStructurePreset, setLyricInputs, setLanguageLayer, setClaudeSettings, setGeminiSettings, setProvider } from './state.js';
import { generate, generateLyricsLive } from './generate.js';
import { overlayList } from '../core/overlays.js';
import { favStorageAvailable, favList, favSave, favRemove, favRecall, favExportAll, favImportAll } from '../core/favourites.js';
import { composerLayerList } from '../core/composer-layers.js';
import { SONG_TYPES, presetsForType, resolveStructure } from '../core/structure.js';
import { CONTROL_OPTIONS } from '../core/lyric-controls.js';
import { isResearchableSourceType } from '../core/source-research.js';
import { CLAUDE_MODELS } from './claude-client.js';
import { GEMINI_MODELS } from './gemini-client.js';

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

  // STRUCTURE-FIRST PANEL. Song type + structure preset are surfaced here,
  // ahead of the engine tabs, matching John's confirmed decision order: song
  // type -> structure -> style -> metatags. WIRED into generate() since
  // Phase 2/3/4 (approved by John 2026-08-12, docs/architecture/structure-
  // first-pipeline-plan.md) — this selection drives the song-type gate, the
  // resolver harmony-brightness structure hint, and the lyric engine's
  // section names/positions. (This comment previously said "not yet wired,"
  // left over from when only Phase 1 had shipped — caught 2026-08-12 while
  // confirming for John exactly what's reproducible live in the UI.)
  structurePanel(rootEl);

  rootEl.appendChild(el('div', { class: 'tabs' }, ENGINES.map(e => {
    const disabled = e.kind === 'stub';
    return el('button', {
      class: 'tab' + (e.id === S.engineId ? ' active' : '') + (disabled ? ' disabled' : ''),
      onclick: () => { if (!disabled) { syncEngineDefaults(S, e.id); favRecalled = null; favNotice = ''; renderAll(); } },
    }, [el('span', { text: e.label }), el('span', { class: 'kind', text: e.kind === 'resolver' ? 'resolver' : e.kind === 'legacy' ? 'proven' : e.kind === 'atom' ? 'atom' : 'soon' })]);
  })));

  const grid = el('div', { class: 'grid' });
  const controls = el('div', { class: 'panel controls' });
  const output = el('div', { class: 'panel output', id: 'output' });
  grid.appendChild(controls); grid.appendChild(output);
  rootEl.appendChild(grid);

  const eng = getEngine(S.engineId);
  if (eng.kind === 'atom') renderAtomControls(controls, eng);
  else if (eng.kind === 'resolver') renderResolverControls(controls, eng);
  else if (eng.kind === 'legacy') renderLegacyControls(controls, eng);
  else renderStub(controls, eng);
  if (eng.kind !== 'stub' && eng.kind !== 'atom') overlayPanel(controls);
  if (eng.kind !== 'stub') favouritesPanel(controls);

  refreshOutput();
}

// ---- structure-first panel (song type + structure preset) ------------------
// Decision #1 in John's pipeline ordering. Song type gates which structure
// presets are offered (vocal vs instrumental vocabularies never mix, R7).
// Changing song type resets the preset to the first valid option for the new
// type (see state.js setSongType).
function structurePanel(root) {
  const box = el('div', { class: 'structure-panel' });
  box.appendChild(el('h4', { text: 'Song structure' }));

  const typeOptions = Object.values(SONG_TYPES).map(t => ({ value: t.id, label: t.label }));
  box.appendChild(field('Song type', segmented(typeOptions, S.songType, v => {
    setSongType(S, v);
    renderAll();
  })));

  const presets = presetsForType(S.songType);
  const presetOptions = presets.map(p => ({ value: p.id, label: p.label }));
  box.appendChild(field('Structure preset', select(presetOptions, S.structurePresetId, v => {
    setStructurePreset(S, v);
    renderAll();
  })));

  const structure = resolveStructure(S.structurePresetId);
  if (structure) {
    const sectionsText = structure.sections
      .map((s, i) => `${s} (${structure.energyShape[i]})`)
      .join(' \u2192 ');
    box.appendChild(el('p', { class: 'hint structure-preview', text: sectionsText }));
    if (structure.description) box.appendChild(el('p', { class: 'hint', text: structure.description }));
  }

  root.appendChild(box);
}

// ---- favourites ------------------------------------------------------------
// Save the current build (config + the literal prompt text) and recall it later.
// Recall restores the config so the prompt can be re-rolled around, and warns if
// the live engine no longer renders what was saved.
let favNotice = '';

function favouritesPanel(root) {
  const box = el('div', { class: 'favourites' });
  box.appendChild(el('h4', { text: 'Favourites' }));

  if (!favStorageAvailable()) {
    box.appendChild(el('p', { class: 'hint', text: 'Browser storage is unavailable here (this happens on file:// pages). Favourites cannot be saved in this window.' }));
    root.appendChild(box);
    return;
  }

  const nameInput = el('input', { type: 'text', placeholder: 'name this prompt\u2026', class: 'fav-name' });
  const saveBtn = el('button', {
    class: 'ghost', text: 'Save current',
    onclick: () => {
      const rec = favSave(nameInput.value, S, generate(S));
      favNotice = rec ? `Saved \u201c${rec.name}\u201d` : 'Could not save \u2014 browser storage is full.';
      renderAll();
    },
  });
  box.appendChild(el('div', { class: 'fav-save' }, [nameInput, saveBtn]));

  const items = favList();
  if (!items.length) box.appendChild(el('p', { class: 'hint', text: 'No favourites saved yet.' }));

  items.forEach(r => {
    const row = el('div', { class: 'fav-row' }, [
      el('span', { class: 'fav-label', text: r.name, title: `${r.engineId} \u00b7 ${r.savedAt.slice(0, 16).replace('T', ' ')}` }),
      el('button', {
        class: 'link', text: 'Load',
        onclick: () => {
          const res = favRecall(r.id, S, generate);
          favNotice = res && res.drifted
            ? `Loaded \u201c${r.name}\u201d \u2014 the engine has changed since it was saved, so the live render differs from the snapshot. The saved text is below.`
            : `Loaded \u201c${r.name}\u201d.`;
          favRecalled = res && res.drifted ? res.record : null;
          renderAll();
        },
      }),
      el('button', {
        class: 'link', text: 'Copy',
        onclick: (e) => { copy(r.snapshot.style); e.target.textContent = 'Copied'; setTimeout(() => e.target.textContent = 'Copy', 1200); },
      }),
      el('button', {
        class: 'link danger', text: 'Delete',
        onclick: () => { favRemove(r.id); favNotice = `Deleted \u201c${r.name}\u201d.`; renderAll(); },
      }),
    ]);
    box.appendChild(row);
  });

  box.appendChild(el('div', { class: 'fav-io' }, [
    el('button', {
      class: 'link', text: 'Export all',
      onclick: () => downloadText('atmos-favourites.json', favExportAll()),
    }),
    el('button', {
      class: 'link', text: 'Import',
      onclick: () => pickJson(txt => {
        const r = favImportAll(txt, 'merge');
        favNotice = r.ok ? `Imported ${r.added} favourite${r.added === 1 ? '' : 's'}.` : `Import failed: ${r.error}`;
        renderAll();
      }),
    }),
  ]));

  if (favNotice) box.appendChild(el('p', { class: 'hint', text: favNotice }));
  root.appendChild(box);
}

// Set when a recalled favourite no longer matches the live engine; the saved text
// is then shown alongside the live output so nothing is silently lost.
let favRecalled = null;

function downloadText(filename, text) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: filename });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function pickJson(onload) {
  const input = el('input', { type: 'file', accept: 'application/json,.json' });
  input.addEventListener('change', () => {
    const f = input.files && input.files[0];
    if (!f) return;
    const fr = new FileReader();
    fr.onload = () => onload(String(fr.result || ''));
    fr.readAsText(f);
  });
  input.click();
}

// ---- atom controls ---------------------------------------------------------
function renderAtomControls(root, eng) {
  const a = S.atom;
  const chars = atomCharacterList(eng.module);
  root.appendChild(field('Character',
    select(chars.map(x => ({ value: x.id, label: `${x.label} \u2014 ${x.source}` })), a.characterId,
      v => { a.characterId = v; renderAll(); })));

  // Palette axis (electronic | acoustic | blend) — draws each role from that
  // palette's pool. Blend added 2026-08-14 (John: atom path had no Blend,
  // legacy always did) — reuses the same seg3() control the legacy path uses,
  // so the option reads identically everywhere it appears.
  if (eng.module[a.characterId] && eng.module[a.characterId].palettes) {
    const pals = eng.module[a.characterId].palettes;
    const palOpts = seg3().filter(o => pals[o.value]);
    root.appendChild(field('Palette', segmented(palOpts, a.palette || 'electronic',
      v => { a.palette = v; refreshOutput(); })));
  }

  // "Overlay" is Producer/Remixer only (John, 2026-08-13) — composers have
  // their own dedicated Composer control below (the current, correct model:
  // a subordinate secondary layer that never displaces the character's own
  // lead). Composer entries used to also appear here from the retired gen-1
  // atom-overlay days; they're gone now, not just relabelled — selecting one
  // here always meant the character-competing atom-overlay model, which is
  // exactly what the Composer control was built to retire for composers.
  // Producers and remixers stay here because they haven't been migrated to
  // that model yet — their job is reshaping movement/rhythm/vocal, not
  // adding an instrument layer, so the same secondary-layer model doesn't
  // apply to them the same way. Convert them the same way if/when John signs
  // off on that.
  const ovOpts = [{ value: '', label: 'None' }]
    .concat(atomOverlays().filter(o => o.kind !== 'composer').map(o => ({ value: o.id, label: `${o.label} (${o.kind})` })));
  root.appendChild(field('Overlay', select(ovOpts, a.overlayId || '', v => { a.overlayId = v; refreshOutput(); })));

  // Composer modifier (John's simplified model): a secondary arrangement layer
  // that decorates the song at structural points via style + metatags, rather
  // than an atom overlay competing in the style body. Simple dropdown select.
  const compOpts = [{ value: '', label: 'none' }].concat(
    composerLayerList().map(c => ({ value: c.id, label: c.label })));
  root.appendChild(field('Composer', select(compOpts, a.composerLayerId || '', v => { a.composerLayerId = v; refreshOutput(); })));

  root.appendChild(el('p', { class: 'note', text: 'Atom assembly path. Overlays are congruent-by-default \u2014 an incongruent one is refused (shown below the prompt).' }));
  root.appendChild(buttons());
  // P8 complete (2026-08-12): all three engine kinds now have a DNA producer.
  lyricPanel(root);
}

// ---- P7: live lyric generation panel ---------------------------------------
// Deliberately plain — matching structurePanel's unstyled aesthetic. This is
// "structure and logic" wiring (John, 2026-08-12), not a UI design pass;
// visual polish is explicitly deferred to a later pass using the design
// skills John has installed.
function lyricPanel(root) {
  const box = el('div', { class: 'lyric-panel' });
  box.appendChild(el('h4', { text: 'Lyrics (live, P7)' }));

  const l = S.lyric;

  // opt(key, options) — every one of these writes to S.lyric[key] and is read
  // back out in js/generate.js's buildLiveLyricRequest(). A control that
  // doesn't appear in both places is inert, which is exactly the state the
  // panel was in before 2026-08-17 (vocabulary present, nothing wired).
  const opt = (key, options) => select(options.map(v => ({ value: v, label: v })), l[key],
    v => { setLyricInputs(S, { [key]: v }); renderAll(); });

  box.appendChild(el('h5', { text: 'Song concept', style: 'margin:10px 0 4px;' }));
  box.appendChild(field('Source type', opt('sourceType', CONTROL_OPTIONS.sourceType)));

  // Subject label and placeholder change with source type, because what the
  // field wants changes: a researchable type wants the WORK'S NAME (it gets
  // looked up), everything else wants a free description. Without this the
  // same box silently means two different things.
  const researchable = isResearchableSourceType(l.sourceType);
  box.appendChild(field(researchable ? `${l.sourceType} title` : 'Subject / topic', el('input', {
    type: 'text', value: l.subject,
    placeholder: researchable ? 'name the work \u2014 it will be researched before the lyrics are written'
                              : 'leave blank to let the LLM invent one',
    oninput: e => setLyricInputs(S, { subject: e.target.value }),
  })));
  if (researchable) {
    box.appendChild(el('p', { class: 'note',
      text: 'Two-step flow: the title is researched with web grounding first, and the premise that comes back becomes the subject material for the lyric call.' }));
  }

  box.appendChild(field('Title (optional override)', el('input', {
    type: 'text', value: l.title, placeholder: 'leave blank for an LLM-generated title',
    oninput: e => setLyricInputs(S, { title: e.target.value }),
  })));
  box.appendChild(field('Theme lens', opt('themeLens', CONTROL_OPTIONS.themeLens)));
  box.appendChild(field('Perspective', opt('perspective', CONTROL_OPTIONS.perspective)));
  box.appendChild(field('Era bias (lyric idiom only)', opt('eraBias', CONTROL_OPTIONS.eraBias)));

  box.appendChild(el('h5', { text: 'Writing', style: 'margin:10px 0 4px;' }));
  box.appendChild(field('Language style', opt('languageStyle', CONTROL_OPTIONS.languageStyle)));
  box.appendChild(field('Hook style', opt('hookStyle', CONTROL_OPTIONS.hookStyle)));
  box.appendChild(field('Imagery density', opt('imageryDensity', CONTROL_OPTIONS.imageryDensity)));
  box.appendChild(field('Narrative clarity', opt('narrativeClarity', CONTROL_OPTIONS.narrativeClarity)));
  box.appendChild(field('Line length target', opt('lineLength', CONTROL_OPTIONS.lineLength)));
  box.appendChild(field('Rhyme density target', opt('rhymeDensity', CONTROL_OPTIONS.rhymeDensity)));

  box.appendChild(el('h5', { text: 'Voice', style: 'margin:10px 0 4px;' }));
  box.appendChild(field('Vocal framing', opt('vocalFraming', CONTROL_OPTIONS.vocalFraming)));
  box.appendChild(field('Delivery style', opt('deliveryStyle', CONTROL_OPTIONS.deliveryStyle)));

  // Foreign-language layer. Collapsed to a single toggle until enabled — four
  // permanently-visible controls for an off-by-default feature is exactly the
  // control-burden problem the novice model is meant to avoid.
  const LL = l.languageLayer;
  box.appendChild(el('h5', { text: 'Foreign-language layer', style: 'margin:10px 0 4px;' }));
  box.appendChild(field('Enabled', segmented(
    [{ value: 'off', label: 'Off' }, { value: 'on', label: 'On' }], LL.enabled ? 'on' : 'off',
    v => { setLanguageLayer(S, { enabled: v === 'on' }); renderAll(); })));
  if (LL.enabled) {
    const llOpt = (key, options) => select(options.map(v => ({ value: v, label: v })), LL[key],
      v => { setLanguageLayer(S, { [key]: v }); renderAll(); });
    box.appendChild(field('Language', llOpt('language', CONTROL_OPTIONS.languages)));
    // 'None' is dropped from the mode list here: the Off/On toggle above is
    // the enable mechanism, so a second "None" would be a mode that means
    // "ignore the layer I just switched on".
    box.appendChild(field('Mode', llOpt('mode', CONTROL_OPTIONS.languageModes.filter(m => m !== 'None'))));
    box.appendChild(field('Placement', llOpt('placement', CONTROL_OPTIONS.languagePlacement)));
    box.appendChild(field('Intensity', llOpt('intensity', CONTROL_OPTIONS.languageIntensity)));
  }

  box.appendChild(el('h4', { text: 'Model provider', style: 'margin-top:14px;' }));
  box.appendChild(field('Provider', segmented(
    [{ value: 'gemini', label: 'Gemini' }, { value: 'claude', label: 'Claude' }], S.provider || 'gemini',
    v => { setProvider(S, v); renderAll(); })));

  if ((S.provider || 'gemini') === 'gemini') {
    const g = S.gemini;
    box.appendChild(field('Gemini API key', el('input', {
      type: 'password', value: g.apiKey, placeholder: 'AIza...',
      oninput: e => setGeminiSettings(S, { apiKey: e.target.value }),
    })));
    // Free-text combo, not a locked dropdown — Google renames Gemini models
    // more often than most providers; GEMINI_MODELS is a starting list, not
    // an exhaustive one. See js/gemini-client.js header.
    box.appendChild(field('Model (editable \u2014 Google renames these often)', el('input', {
      type: 'text', value: g.model, list: 'gemini-model-suggestions',
      oninput: e => setGeminiSettings(S, { model: e.target.value }),
    })));
    const datalist = el('datalist', { id: 'gemini-model-suggestions' },
      GEMINI_MODELS.map(m => el('option', { value: m })));
    box.appendChild(datalist);
    box.appendChild(field('Transport', segmented(
      [{ value: 'direct', label: 'Direct' }, { value: 'proxy', label: 'Local proxy' }], g.transportMode,
      v => setGeminiSettings(S, { transportMode: v }))));
  } else {
    const c = S.claude;
    box.appendChild(field('Claude API key', el('input', {
      type: 'password', value: c.apiKey, placeholder: 'sk-ant-...',
      oninput: e => setClaudeSettings(S, { apiKey: e.target.value }),
    })));
    box.appendChild(field('Model', select(CLAUDE_MODELS.map(m => ({ value: m, label: m })), c.model,
      v => setClaudeSettings(S, { model: v }))));
    box.appendChild(field('Transport', segmented(
      [{ value: 'direct', label: 'Direct' }, { value: 'proxy', label: 'Local proxy' }], c.transportMode,
      v => setClaudeSettings(S, { transportMode: v }))));
  }

  const genBtnAttrs = {
    class: 'ghost', text: l.status === 'running' ? 'Generating\u2026' : 'Generate lyrics',
    onclick: async () => {
      l.status = 'running'; l.error = null; l.result = null;
      renderAll();
      try {
        const result = await generateLyricsLive(S);
        l.status = 'done'; l.result = result;
      } catch (e) {
        l.status = 'error'; l.error = e.message;
      }
      renderAll();
    },
  };
  if (l.status === 'running') genBtnAttrs.disabled = 'true'; // omit the key entirely when not disabled — setAttribute('disabled', null) would stringify to "null" and disable it anyway
  const genBtn = el('button', genBtnAttrs);
  box.appendChild(genBtn);

  if (l.status === 'error') {
    box.appendChild(el('p', { class: 'note', text: `Error: ${l.error}` }));
  }
  if (l.status === 'done' && l.result) {
    const r = l.result;
    if (r.instrumental) {
      box.appendChild(el('p', { class: 'note', text: 'Instrumental song type \u2014 no LLM call made. The Lyrics field above already carries the metatag block directly.' }));
    } else {
      const q = r.quality;
      box.appendChild(el('p', { class: 'note',
        text: q ? `Quality score: ${q.score} (threshold 85) \u2014 ${q.passed ? 'PASSED' : 'below threshold, best of ' + r.attempts + ' attempt(s)'}`
                 : (r.parseError ? 'Model response could not be parsed as JSON after all attempts.' : '') }));
      // Visibility for testing, John 2026-08-14: confirms whether this
      // specific generation actually used the locked-metatag handoff (Path B)
      // or fell back to the model inventing its own generic tags \u2014 so a
      // Suno test result can be traced back to which mode produced it.
      if (r.brief) {
        box.appendChild(el('p', { class: 'note',
          text: r.brief.lockedMetatags
            ? 'Metatags: locked \u2014 the real per-section tags above were handed to the model as fixed content.'
            : 'Metatags: generic \u2014 no locked tags were available for this build; the model invented its own.' }));
      }
      // Source-research provenance (2026-08-17). John's direction was NOT to
      // show the premise itself in the UI — this is one line saying whether
      // the grounded pre-pass ran and how sure it was, not the premise text.
      // Without it a soft failure (search unavailable, unparseable response)
      // is indistinguishable from a successful lookup, and a Suno result
      // couldn't be traced back to which of the two produced it.
      // Source type on the readout (John, 2026-08-17: "Will there be a
      // section stating what the source is"). The control itself is the first
      // field in the panel above; this echoes the resolved value back on the
      // OUTPUT so a saved or pasted result is self-describing rather than
      // requiring the user to scroll up and re-read a dropdown.
      if (r.brief && r.brief.sourceType) {
        box.appendChild(el('p', { class: 'note', text: `Source type: ${r.brief.sourceType}` }));
      }
      if (r.sourceResearch) {
        const sr = r.sourceResearch;
        box.appendChild(el('p', { class: 'note',
          text: sr.researched
            ? `Source research: ran with web grounding \u2014 identified "${(sr.research && sr.research.identified) || 'unknown'}", confidence ${sr.confidence || 'unstated'}.`
            : `Source research: did not run (${sr.reason}). Lyrics were written from the subject line alone.` }));
      }
      if (r.title) box.appendChild(el('p', { text: `Title: ${r.title}` }));
      if (r.lyrics) box.appendChild(el('pre', { text: r.lyrics, style: 'white-space:pre-wrap; font-size:12px;' }));
    }
  }

  root.appendChild(box);
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
  // P8 complete (2026-08-12): resolver engines produce Musical DNA too
  // (buildResolverDNA) — the lyric panel was wired for atom engines only
  // when P7 shipped and never extended here when Phase 2 landed. Fixed now
  // that all three engine kinds have a DNA producer.
  lyricPanel(root);
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
      lyricPanel(root);
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
    lyricPanel(root);
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
  lyricPanel(root);
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

// ---- modifier overlays (Composer / Producer / Remixer) ---------------------
// Engine-agnostic: an overlay is a hand applied on top of whichever engine is
// selected. It writes into the engine's existing slots (harmony / motif / counter
// / texture / colour / movement / arc), never the genre anchor, tempo or drums.
function overlayPanel(root) {
  const box = el('div', { class: 'overlays' });
  box.appendChild(el('h4', { text: 'Modifier overlays' }));
  const kinds = [['composer', 'Composer'], ['producer', 'Producer'], ['remixer', 'Remixer']];
  kinds.forEach(([kind, label]) => {
    const opts = [{ value: '', label: 'none' }].concat(
      overlayList(kind).map(o => ({ value: o.id, label: o.family ? `${o.label} (${o.family})` : o.label })));
    box.appendChild(field(label, select(opts, S.ov[kind], v => { S.ov[kind] = v; refreshOutput(); })));
  });
  root.appendChild(box);
}

// ---- shared buttons + output ----------------------------------------------
function buttons() {
  return el('div', { class: 'actions-wrap' }, [
    el('div', { class: 'maxmode' }, toggle('Max Mode', S.maxMode, v => { S.maxMode = v; refreshOutput(); })),
    el('div', { class: 'actions' }, [
      el('button', { class: 'primary', text: 'Generate', onclick: () => { S.seed = newSeed(); favRecalled = null; refreshOutput(); } }),
      el('button', { class: 'ghost', text: 'Re-roll instruments', onclick: () => { S.seed = newSeed(); favRecalled = null; refreshOutput(); } }),
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
  if (favRecalled) {
    host.appendChild(outBlock('Saved snapshot \u2014 style prompt', favRecalled.snapshot.style,
      favRecalled.snapshot.style.length, favRecalled.snapshot.style.length > 1000,
      'Captured when this favourite was saved. The engine has changed since, so the live render below differs.'));
  }
  host.appendChild(outBlock('Style prompt', res.style, res.length, res.over));
  if (res.overlayNote) host.appendChild(el('p', { class: 'note', text: `Overlay: ${res.overlayNote}` }));
  host.appendChild(outBlock('Negative prompt', res.negative, null, false));
  // METATAG/LYRIC MERGE (John, 2026-08-14 decision, Path B):
  // - Instrumental: res.lyrics IS the metatag block now (js/generate.js), not
  //   a bare '[Instrumental]' placeholder next to a separate block \u2014 so
  //   res.metatags comes back empty and the standalone block below simply
  //   doesn't render (no more manual copy-paste for this case).
  // - Vocal: res.metatags still renders as a PREVIEW here (sync, no LLM call
  //   yet), but the hint now reflects reality \u2014 once live lyrics are
  //   generated below, these exact tags are handed to the model as locked
  //   content and come back woven into the returned lyrics automatically.
  const instrumental = S.songType === 'instrumental';
  const lyr = res.lyrics || '[Instrumental]';
  const lyricsHint = instrumental
    ? 'Paste into Suno\u2019s lyrics box; use Suno\u2019s Instrumental toggle for reliable vocal suppression. No separate lyric text exists for an instrumental track, so the metatag engine\u2019s per-section direction goes directly in this field.'
    : 'Paste into Suno\u2019s lyrics box; use Suno\u2019s Instrumental toggle for reliable vocal suppression. Generate live lyrics below \u2014 the real per-section metatags are handed to the model as locked content, so they come back woven in automatically.';
  host.appendChild(outBlock('Lyrics field', lyr, null, false, lyricsHint));
  if (res.metatags) host.appendChild(outBlock('Metatags', res.metatags, null, false, 'Preview of the locked per-section tags handed to the LLM for live lyric generation below \u2014 they come back woven into the generated lyrics automatically; you shouldn\u2019t need to paste these in by hand.'));
}

function outBlock(title, text, length, over, hint) {
  const head = el('div', { class: 'out-head' }, [el('h4', { text: title })]);
  if (length != null) head.appendChild(el('span', { class: 'meter' + (over ? ' over' : ''), text: `${length}/1000` }));
  head.appendChild(el('button', { class: 'copy', text: 'Copy', onclick: (e) => { copy(text); e.target.textContent = 'Copied'; setTimeout(() => e.target.textContent = 'Copy', 1200); } }));
  const ta = el('textarea', { class: 'out', readonly: 'readonly', rows: 1 }, text);
  autoGrow(ta);
  const kids = [head, ta];
  if (hint) kids.push(el('p', { class: 'hint', text: hint }));
  return el('div', { class: 'out-block' }, kids);
}
// Grow/shrink a textarea to fit its content so the window expands and contracts
// with the prompt instead of snapping back to a fixed height on every change.
function autoGrow(ta) {
  const fit = () => { ta.style.height = 'auto'; ta.style.height = (ta.scrollHeight + 2) + 'px'; };
  ta.addEventListener('input', fit);
  // scrollHeight is only correct once the element is in the document + laid out.
  requestAnimationFrame(fit);
  setTimeout(fit, 0);
}
function copy(t) {
  if (navigator.clipboard) navigator.clipboard.writeText(t).catch(() => {});
}

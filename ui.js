import { STYLE_ENGINES, VOCAL_DESCRIPTOR_OPTIONS, VOCAL_MODES } from "./data-style-engines.js";
import { CONTROL_OPTIONS, STRUCTURE_TEMPLATES } from "./data-lyric-controls.js";
import { buildStylePrompt, buildNegativePrompt } from "./prompt-style-builder.js";
import { buildGenerationPrompt } from "./prompt-lyric-builder.js";
import { buildAdLibPlan, buildSunoMetatagPlan, buildVocalArrangementPlan, formatAdLibPlan, formatMetatagPlan, formatVocalArrangementPlan } from "./metatag-builder.js";
import { compatibilitySummary } from "./compatibility-rules.js";

const $ = (id) => document.getElementById(id);

export const els = {
  engineSelect: $("engineSelect"),
  styleControls: $("styleControls"),
  songControls: $("songControls"),
  languageControls: $("languageControls"),
  structureTemplate: $("structureTemplate"),
  structureNotes: $("structureNotes"),
  includePreChorus: $("includePreChorus"),
  includeBridge: $("includeBridge"),
  useStyleToGuideLyrics: $("useStyleToGuideLyrics"),
  strictValidation: $("strictValidation"),
  apiKey: $("apiKey"),
  rememberKey: $("rememberKey"),
  claudeModel: $("claudeModel"),
  claudeTransport: $("claudeTransport"),
  temperature: $("temperature"),
  temperatureValue: $("temperatureValue"),
  maxTokens: $("maxTokens"),
  manualThemeBrief: $("manualThemeBrief"),
  manualLyrics: $("manualLyrics"),
  promptPreview: $("promptPreview"),
  stateTransfer: $("stateTransfer"),
  styleOutput: $("styleOutput"),
  lyricsOutput: $("lyricsOutput"),
  metatagOutput: $("metatagOutput"),
  negativeOutput: $("negativeOutput"),
  validationOutput: $("validationOutput"),
  themeBriefOutput: $("themeBriefOutput"),
  rawJsonOutput: $("rawJsonOutput"),
  styleBudget: $("styleBudget"),
  lyricsStatus: $("lyricsStatus"),
  validationBadge: $("validationBadge"),
  claudeStatus: $("claudeStatus"),
  progressList: $("progressList"),
  errorBox: $("errorBox"),
  generateBtn: $("generateBtn"),
  testClaudeBtn: $("testClaudeBtn"),
  clearKeyBtn: $("clearKeyBtn"),
  validateManualBtn: $("validateManualBtn"),
  saveSetupBtn: $("saveSetupBtn"),
  loadSetupBtn: $("loadSetupBtn"),
  exportStateBtn: $("exportStateBtn"),
  importStateBtn: $("importStateBtn"),
  resetBtn: $("resetBtn")
};

const ENGINE_HINTS = {
  Balearic: "Atmospheric chillout, sunset warmth, organic groove.",
  Enigma: "Mystic identity, chant texture, hypnotic downtempo pulse.",
  Delerium: "Ethereal vocal bloom, choir haze, emotional lift.",
  Era: "Ceremonial scale, sacred choir, restrained cinematic motion."
};

export function initStaticOptions(state, models) {
  fillSelect(els.engineSelect, Object.keys(STYLE_ENGINES));
  fillSelect(els.structureTemplate, STRUCTURE_TEMPLATES.map((template) => ({ value: template.id, label: `${template.group} - ${template.label}` })));
  fillSelect(els.claudeModel, models);
  document.body.dataset.engine = state.engine;
}

export function renderControls(state) {
  const engine = STYLE_ENGINES[state.engine];
  if (!VOCAL_MODES.includes(state.style.vocalMode)) state.style.vocalMode = "Descriptor";
  if (!VOCAL_DESCRIPTOR_OPTIONS[state.style.vocalGender]) state.style.vocalGender = "Female";
  if (!VOCAL_DESCRIPTOR_OPTIONS[state.style.vocalGender].includes(state.style.vocalDescriptor)) {
    state.style.vocalDescriptor = VOCAL_DESCRIPTOR_OPTIONS[state.style.vocalGender][0];
  }
  document.body.dataset.engine = state.engine;
  els.engineSelect.value = state.engine;
  const engineDeckName = document.getElementById("engineDeckName");
  const engineDeckHint = document.getElementById("engineDeckHint");
  if (engineDeckName) engineDeckName.textContent = state.engine;
  if (engineDeckHint) engineDeckHint.textContent = ENGINE_HINTS[state.engine] || "";

  els.styleControls.innerHTML = "";
  addChoiceGroup(els.styleControls, "Engine preset", "style.preset", engine.presets, state.style.preset, "Choose the source identity first.", "preset");
  addChoiceGroup(els.styleControls, "Phase / profile", "style.phase", engine.phases, state.style.phase, "Sets tempo, era behavior, and scale.", "phase");
  addChoiceGroup(els.styleControls, "Vocal mode", "style.vocalMode", VOCAL_MODES, state.style.vocalMode, "Decides how much the style prompt talks about voice.", "voice");
  if (state.style.vocalMode === "Descriptor") {
    els.styleControls.insertAdjacentHTML("beforeend", `<div class="vocal-descriptor-panel"><div><div class="decision-label">Vocal tone / delivery</div><p class="field-note">Choose a descriptor that can materially change the generated vocal performance.</p></div><div class="field-grid" id="vocalDescriptorGrid"></div></div>`);
    const vocalGrid = document.getElementById("vocalDescriptorGrid");
    addSelect(vocalGrid, "Vocal gender", "style.vocalGender", Object.keys(VOCAL_DESCRIPTOR_OPTIONS), state.style.vocalGender);
    addSelect(vocalGrid, "Descriptor", "style.vocalDescriptor", VOCAL_DESCRIPTOR_OPTIONS[state.style.vocalGender], state.style.vocalDescriptor);
  }
  addToggle(els.styleControls, "Max Mode", "style.maxMode", state.style.maxMode);
  els.styleControls.insertAdjacentHTML("beforeend", `<details class="subsection"><summary>Fine tune arrangement</summary><div class="control-stack detail-body" id="styleFineTune"></div></details>`);
  const styleFineTune = document.getElementById("styleFineTune");
  addSelect(styleFineTune, "Pad / texture", "style.pad", engine.pads, state.style.pad);
  addSelect(styleFineTune, "Bass / tempo support", "style.bass", engine.bass, state.style.bass);
  addSelect(styleFineTune, "Rhythm / hook", "style.rhythm", engine.rhythm, state.style.rhythm);
  addSelect(styleFineTune, "Strings / vocal blend / density", "style.percussion", engine.percussion, state.style.percussion);
  addSelect(styleFineTune, "Motif", "style.motif", engine.motifs, state.style.motif);
  addSelect(styleFineTune, "Movement", "style.movement", engine.movement, state.style.movement);
  addTextarea(styleFineTune, "Extra negative prompt", "style.negativePrompt", state.style.negativePrompt, 3);

  els.songControls.innerHTML = "";
  addInput(els.songControls, "Optional title seed", "song.title", state.song.title);
  addInput(els.songControls, "Subject / topic", "song.subject", state.song.subject);
  addChoiceGroup(els.songControls, "Source type", "song.sourceType", CONTROL_OPTIONS.sourceType, state.song.sourceType, "What kind of seed is this?", "source");
  addChoiceGroup(els.songControls, "Theme lens", "song.themeLens", CONTROL_OPTIONS.themeLens, state.song.themeLens, "How literally should Claude treat the seed?", "lens");
  addTextarea(els.songControls, "Optional source notes", "song.sourceNotes", state.song.sourceNotes, 3);
  addChoiceGroup(els.songControls, "Mood", "song.mood", CONTROL_OPTIONS.mood, state.song.mood, "Primary emotional color.", "mood");
  addChoiceGroup(els.songControls, "Energy", "song.energy", CONTROL_OPTIONS.energy, state.song.energy, "Performance intensity.", "energy");
  addChoiceGroup(els.songControls, "Perspective", "song.perspective", CONTROL_OPTIONS.perspective, state.song.perspective, "Who is speaking?", "perspective");
  els.songControls.insertAdjacentHTML("beforeend", `<details class="subsection"><summary>Lyric mechanics</summary><div class="control-stack detail-body" id="lyricMechanics"></div></details>`);
  const lyricMechanics = document.getElementById("lyricMechanics");
  lyricMechanics.insertAdjacentHTML("beforeend", `<div class="field-grid" id="lyricMechanicsGrid"></div>`);
  const lyricMechanicsGrid = document.getElementById("lyricMechanicsGrid");
  addSelect(lyricMechanicsGrid, "Genre family", "song.genreFamily", CONTROL_OPTIONS.genreFamily, state.song.genreFamily);
  addSelect(lyricMechanicsGrid, "Era bias", "song.eraBias", CONTROL_OPTIONS.eraBias, state.song.eraBias);
  addSelect(lyricMechanicsGrid, "Language style", "song.languageStyle", CONTROL_OPTIONS.languageStyle, state.song.languageStyle);
  addSelect(lyricMechanicsGrid, "Hook style", "song.hookStyle", CONTROL_OPTIONS.hookStyle, state.song.hookStyle);
  addSelect(lyricMechanicsGrid, "Target line length", "song.lineLength", CONTROL_OPTIONS.lineLength, state.song.lineLength);
  addSelect(lyricMechanicsGrid, "Rhyme density", "song.rhymeDensity", CONTROL_OPTIONS.rhymeDensity, state.song.rhymeDensity);
  addSelect(lyricMechanicsGrid, "Imagery density", "song.imageryDensity", CONTROL_OPTIONS.imageryDensity, state.song.imageryDensity);
  addSelect(lyricMechanicsGrid, "Narrative clarity", "song.narrativeClarity", CONTROL_OPTIONS.narrativeClarity, state.song.narrativeClarity);
  addSelect(lyricMechanicsGrid, "Vocal framing", "song.vocalFraming", CONTROL_OPTIONS.vocalFraming, state.song.vocalFraming);
  addSelect(lyricMechanicsGrid, "Delivery style", "song.deliveryStyle", CONTROL_OPTIONS.deliveryStyle, state.song.deliveryStyle);
  addTextarea(lyricMechanics, "Negative lyric rules", "song.negativeRules", state.song.negativeRules, 3);
  addToggle(els.songControls, "Clean language", "song.cleanLanguage", state.song.cleanLanguage);
  addToggle(els.songControls, "Avoid cliches", "song.avoidCliche", state.song.avoidCliche);
  addToggle(els.songControls, "Use title in chorus", "song.titleInChorus", state.song.titleInChorus);
  addToggle(els.songControls, "Repeat key hook wording", "song.repeatHook", state.song.repeatHook);

  els.languageControls.innerHTML = "";
  addToggle(els.languageControls, "Enable language layer", "languageLayer.enabled", state.languageLayer.enabled);
  addChoiceGroup(els.languageControls, "Language", "languageLayer.language", CONTROL_OPTIONS.languages, state.languageLayer.language, "Phrase layer language.", "language");
  addChoiceGroup(els.languageControls, "Mode", "languageLayer.mode", CONTROL_OPTIONS.languageModes, state.languageLayer.mode, "Defaults to phrase layer, not full translation.", "mode");
  addSelect(els.languageControls, "Placement", "languageLayer.placement", CONTROL_OPTIONS.languagePlacement, state.languageLayer.placement);
  addSelect(els.languageControls, "Intensity", "languageLayer.intensity", CONTROL_OPTIONS.languageIntensity, state.languageLayer.intensity);
  addTextarea(els.languageControls, "Language QA notes", "languageLayer.notes", state.languageLayer.notes, 3);

  els.structureTemplate.value = state.structure.templateId;
  els.includePreChorus.checked = state.structure.includePreChorus;
  els.includeBridge.checked = state.structure.includeBridge;
  els.useStyleToGuideLyrics.checked = state.integration.useStyleToGuideLyrics;
  els.strictValidation.checked = state.integration.strictValidation;
  els.rememberKey.checked = state.claude.apiKeyRemembered;
  state.claude.model = els.claudeModel.options[0]?.value || state.claude.model;
  els.claudeModel.value = state.claude.model;
  els.claudeTransport.value = state.claude.transport || "direct";
  els.temperature.value = state.claude.temperature;
  els.temperatureValue.textContent = state.claude.temperature;
  els.maxTokens.value = state.claude.maxTokens;
  els.manualThemeBrief.value = state.advanced.manualThemeBrief;
  els.manualLyrics.value = state.advanced.manualLyrics;
  updateStructureNotes(state);
}

export function renderOutputs(state) {
  state.outputs.stylePrompt = buildStylePrompt(state);
  state.outputs.negativePrompt = state.outputs.negativePrompt || buildNegativePrompt(state);
  els.styleOutput.value = state.outputs.stylePrompt;
  const template = selectedTemplate(state);
  const metatagPlan = formatMetatagPlan(buildSunoMetatagPlan(state, template));
  const vocalPlan = formatVocalArrangementPlan(buildVocalArrangementPlan(state, template));
  const adLibPlan = formatAdLibPlan(buildAdLibPlan(state, template));
  els.metatagOutput.value = `Compatibility rules\n${compatibilitySummary(state)}\n\nMetatags\n${metatagPlan}\n\nSupporting vocal arrangement\n${vocalPlan}\n\nLyric inserts / ad-libs\n${adLibPlan}`;
  els.negativeOutput.value = state.outputs.negativePrompt;
  els.lyricsOutput.value = state.outputs.lyrics || "";
  els.themeBriefOutput.value = state.outputs.themeBrief || "";
  els.rawJsonOutput.value = state.outputs.rawClaudeJson ? JSON.stringify(state.outputs.rawClaudeJson, null, 2) : state.outputs.rawClaudeText || "";
  els.validationOutput.value = state.outputs.validationText || "";
  const count = state.outputs.stylePrompt.length;
  els.styleBudget.textContent = `${count} / 1000 characters`;
  els.styleBudget.style.color = count >= 1000 ? "var(--danger)" : count >= 900 ? "var(--warning)" : "var(--text-muted)";
  els.promptPreview.value = buildGenerationPrompt(state, template);
}

export function updateValidationBadge(validation) {
  els.validationBadge.className = "status-pill";
  if (!validation) {
    els.validationBadge.textContent = "No validation yet";
    return;
  }
  const ok = validation.passed && validation.score >= 80;
  els.validationBadge.textContent = `${validation.score}/100 - ${ok ? "Passed" : "Needs manual review"}`;
  els.validationBadge.classList.add(ok ? "status-ok" : "status-bad");
}

export function selectedTemplate(state) {
  return STRUCTURE_TEMPLATES.find((template) => template.id === state.structure.templateId) || STRUCTURE_TEMPLATES[0];
}

export function updateStructureNotes(state) {
  const template = selectedTemplate(state);
  els.structureNotes.textContent = `${template.notes} Best for: ${template.bestFor.join(", ")}.`;
}

export function setProgress(items, activeIndex = -1, failedIndex = -1) {
  els.progressList.innerHTML = items.map((item, index) => {
    const cls = failedIndex === index ? "failed" : index < activeIndex ? "done" : index === activeIndex ? "active" : "";
    return `<li class="${cls}">${item}</li>`;
  }).join("");
}

export function setError(message = "") {
  els.errorBox.hidden = !message;
  els.errorBox.textContent = message;
  if (message) {
    document.querySelectorAll("[data-output-panel]").forEach((panel) => {
      panel.hidden = panel.id !== "progressPanel";
    });
    document.querySelectorAll("[data-output-tab]").forEach((tab) => {
      tab.classList.toggle("active", tab.dataset.outputTab === "progressPanel");
    });
  }
}

export function setBusy(isBusy) {
  els.generateBtn.disabled = isBusy;
  els.testClaudeBtn.disabled = isBusy;
  els.generateBtn.textContent = isBusy ? "Generating..." : "Generate Lyrics with Claude";
}

function addInput(parent, label, path, value) {
  parent.insertAdjacentHTML("beforeend", `<label><span>${label}</span><input data-path="${path}" value="${escapeAttr(value)}"></label>`);
}

function addTextarea(parent, label, path, value, rows) {
  parent.insertAdjacentHTML("beforeend", `<label><span>${label}</span><textarea data-path="${path}" rows="${rows}">${escapeHtml(value)}</textarea></label>`);
}

function addSelect(parent, label, path, options, value) {
  const opts = options.map((option) => {
    const item = typeof option === "string" ? { value: option, label: option } : option;
    return `<option value="${escapeAttr(item.value)}"${item.value === value ? " selected" : ""}>${escapeHtml(item.label)}</option>`;
  }).join("");
  parent.insertAdjacentHTML("beforeend", `<label><span>${label}</span><select data-path="${path}">${opts}</select></label>`);
}

function addToggle(parent, label, path, checked) {
  parent.insertAdjacentHTML("beforeend", `<label class="toggle-row"><input type="checkbox" data-path="${path}" ${checked ? "checked" : ""}><span>${label}</span></label>`);
}

function addChoiceGroup(parent, label, path, options, value, hint = "", tone = "") {
  const buttons = options.map((option) => {
    const item = typeof option === "string" ? { value: option, label: option } : option;
    const selected = item.value === value ? " active" : "";
    return `<button class="decision-option${selected}" type="button" data-choice-path="${path}" data-choice-value="${escapeAttr(item.value)}"><strong>${escapeHtml(shortLabel(item.label))}</strong><small>${escapeHtml(item.label)}</small></button>`;
  }).join("");
  parent.insertAdjacentHTML("beforeend", `<div class="decision-group decision-${escapeAttr(tone)}"><div><div class="decision-label">${escapeHtml(label)}</div>${hint ? `<p class="field-note">${escapeHtml(hint)}</p>` : ""}</div><div class="decision-grid">${buttons}</div></div>`);
}

function shortLabel(label) {
  const text = String(label);
  if (text.length <= 26) return text;
  return text.split(/[,.]/)[0].slice(0, 26).trim();
}

function fillSelect(select, options) {
  select.innerHTML = options.map((option) => {
    const item = typeof option === "string" ? { value: option, label: option } : option;
    return `<option value="${escapeAttr(item.value)}">${escapeHtml(item.label)}</option>`;
  }).join("");
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}

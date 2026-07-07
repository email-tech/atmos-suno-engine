import { appState, defaultState } from "./state.js";
import { STYLE_ENGINES, VOCAL_DESCRIPTOR_OPTIONS, VOCAL_MODES } from "./data-style-engines.js";
import { EngineExtras } from "./engine-extras.js";
import { CLAUDE_MODELS, testClaudeConnection, callClaude } from "./claude-client.js";
import { buildStylePrompt, buildNegativePrompt } from "./prompt-style-builder.js";
import { applyCompatibilityRules } from "./compatibility-rules.js";
import { buildSunoMetatagPlan } from "./metatag-builder.js";
import { buildGenerationPrompt, buildRepairPrompt } from "./prompt-lyric-builder.js";
import { formatValidation, localValidateLyrics, normalizeClaudeResult, parseClaudeJson, validationPassed } from "./validation.js";
import { clearApiKey, loadApiKey, loadPersistedState, loadSetup, persistState, saveApiKey, saveSetup } from "./storage.js";
import { els, initStaticOptions, renderControls, renderOutputs, selectedTemplate, setBusy, setError, setProgress, updateStructureNotes, updateValidationBadge } from "./ui.js";

const progressSteps = [
  "Preparing style context",
  "Calling Claude",
  "Building theme brief",
  "Drafting lyrics",
  "Validating",
  "Repairing if needed",
  "Final output ready"
];

boot();

function boot() {
  mergeState(loadPersistedState());
  appState.claude.model = CLAUDE_MODELS[0];
  normalizeEngineState();
  normalizeVocalState();
  normalizeLyricState();
  normalizeCompatibility("boot");
  initStaticOptions(appState, CLAUDE_MODELS);
  if (appState.claude.apiKeyRemembered) els.apiKey.value = loadApiKey();
  renderControls(appState);
  rebuildOutputs(false);
  bindEvents();
  setProgress(progressSteps);
}

function bindEvents() {
  document.addEventListener("input", handleInput);
  document.addEventListener("change", handleInput);
  document.addEventListener("click", handleChoiceClick);
  document.addEventListener("click", handleOutputTabClick);
  document.addEventListener("click", handleWorkflowTabClick);
  els.generateBtn.addEventListener("click", generateLyrics);
  document.getElementById("randomizeBtn")?.addEventListener("click", randomizeStyle);
  els.testClaudeBtn.addEventListener("click", testConnection);
  els.clearKeyBtn.addEventListener("click", () => {
    clearApiKey();
    els.apiKey.value = "";
    appState.claude.apiKeyRemembered = false;
    els.rememberKey.checked = false;
    setClaudeStatus("Stored key cleared", "warn");
    persist();
  });
  els.validateManualBtn.addEventListener("click", validateManualLyrics);
  els.saveSetupBtn.addEventListener("click", () => {
    saveSetup(appState);
    setError("Current setup saved in this browser.");
  });
  els.loadSetupBtn.addEventListener("click", () => {
    const setup = loadSetup();
    if (!setup) return setError("No saved setup was found in this browser.");
    mergeState(setup);
    normalizeLyricState();
    normalizeCompatibility("load");
    renderControls(appState);
    rebuildOutputs();
  });
  els.exportStateBtn.addEventListener("click", () => {
    const copy = structuredClone(appState);
    delete copy.claude.apiKey;
    els.stateTransfer.value = JSON.stringify(copy, null, 2);
  });
  els.importStateBtn.addEventListener("click", () => {
    try {
      mergeState(JSON.parse(els.stateTransfer.value));
      normalizeLyricState();
      normalizeCompatibility("import");
      renderControls(appState);
      rebuildOutputs();
      setError("Imported app state.");
    } catch (error) {
      setError(`Import failed: ${error.message}`);
    }
  });
  els.resetBtn.addEventListener("click", () => {
    mergeState(structuredClone(defaultState), true);
    normalizeLyricState();
    normalizeCompatibility("reset");
    renderControls(appState);
    rebuildOutputs();
  });
  document.querySelectorAll("[data-copy]").forEach((button) => button.addEventListener("click", () => copyFrom(button.dataset.copy)));
  document.querySelectorAll("[data-select]").forEach((button) => button.addEventListener("click", () => selectOutput(button.dataset.select)));
  document.querySelectorAll("[data-clear]").forEach((button) => button.addEventListener("click", () => clearOutput(button.dataset.clear)));
}

function handleWorkflowTabClick(event) {
  const button = event.target.closest("[data-workflow-tab]");
  if (!button) return;
  document.querySelectorAll("[data-workflow-panel]").forEach((panel) => {
    panel.hidden = panel.id !== button.dataset.workflowTab;
  });
  document.querySelectorAll("[data-workflow-tab]").forEach((tab) => {
    tab.classList.toggle("active", tab === button);
  });
}

function handleOutputTabClick(event) {
  const button = event.target.closest("[data-output-tab]");
  if (!button) return;
  document.querySelectorAll("[data-output-panel]").forEach((panel) => {
    panel.hidden = panel.id !== button.dataset.outputTab;
  });
  document.querySelectorAll("[data-output-tab]").forEach((tab) => {
    tab.classList.toggle("active", tab === button);
  });
}

function handleChoiceClick(event) {
  const button = event.target.closest("[data-choice-path]");
  if (!button) return;
  setPath(appState, button.dataset.choicePath, button.dataset.choiceValue);
  if (button.dataset.choicePath === "style.preset") applyPresetMap();
  normalizeCompatibility(button.dataset.choicePath);
  renderControls(appState);
  rebuildOutputs();
}

function handleInput(event) {
  const target = event.target;
  if (target.dataset.path) {
    setPath(appState, target.dataset.path, target.type === "checkbox" ? target.checked : target.value);
    if (target.dataset.path === "style.vocalGender") {
      appState.style.vocalDescriptor = VOCAL_DESCRIPTOR_OPTIONS[appState.style.vocalGender][0];
    }
    normalizeVocalState();
    normalizeCompatibility(target.dataset.path);
    if (/style\.vocal|style\.phase|style\.percussion|song\.vocalFraming|song\.deliveryStyle/.test(target.dataset.path)) renderControls(appState);
  }
  if (target === els.engineSelect) {
    appState.engine = target.value;
    syncEngineDefaults();
    normalizeEngineState();
    normalizeCompatibility("engine");
    renderControls(appState);
  }
  if (target === els.structureTemplate) appState.structure.templateId = target.value;
  if (target === els.includePreChorus) appState.structure.includePreChorus = target.checked;
  if (target === els.includeBridge) appState.structure.includeBridge = target.checked;
  if (target === els.useStyleToGuideLyrics) appState.integration.useStyleToGuideLyrics = target.checked;
  if (target === els.strictValidation) appState.integration.strictValidation = target.checked;
  if (target === els.rememberKey) appState.claude.apiKeyRemembered = target.checked;
  if (target === els.claudeModel) appState.claude.model = target.value;
  if (target === els.claudeTransport) {
    appState.claude.transport = target.value;
    localStorage.setItem("unifiedSunoLyricEngine.claudeTransport", target.value);
  }
  if (target === els.temperature) appState.claude.temperature = Number(target.value);
  if (target === els.maxTokens) appState.claude.maxTokens = Number(target.value);
  if (target === els.manualThemeBrief) appState.advanced.manualThemeBrief = target.value;
  if (target === els.manualLyrics) appState.advanced.manualLyrics = target.value;
  if (target === els.negativeOutput) {
    appState.outputs.negativePrompt = target.value;
    appState.style.negativePrompt = target.value.replace(STYLE_ENGINES[appState.engine].negatives, "").replace(/^,\s*/, "");
  }
  if (target === els.apiKey && appState.claude.apiKeyRemembered) saveApiKey(target.value);
  els.temperatureValue.textContent = appState.claude.temperature;
  updateStructureNotes(appState);
  rebuildOutputs();
}

async function generateLyrics() {
  setBusy(true);
  setError("");
  try {
    appState.outputs.stylePrompt = buildStylePrompt(appState);
    appState.outputs.negativePrompt = buildNegativePrompt(appState);
    const template = selectedTemplate(appState);
    setProgress(progressSteps, 0);
    await idle();
    const prompt = buildGenerationPrompt(appState, template);
    setProgress(progressSteps, 1);
    const raw = await callClaude(settings(prompt));
    setProgress(progressSteps, 2);
    let result = normalizeClaudeResult(parseClaudeJson(raw));
    appState.outputs.rawClaudeText = raw;
    appState.outputs.rawClaudeJson = result;
    setProgress(progressSteps, 4);

    let repairStatus = "";
    if (!validationPassed(result.validation)) {
      setProgress(progressSteps, 5);
      const repairPrompt = buildRepairPrompt(appState, template, result);
      const repairRaw = await callClaude(settings(repairPrompt));
      const repaired = normalizeClaudeResult(parseClaudeJson(repairRaw));
      result = repaired;
      appState.outputs.rawClaudeText = repairRaw;
      appState.outputs.rawClaudeJson = repaired;
      repairStatus = validationPassed(repaired) ? "Automatic repair applied." : "Repair attempted; needs manual review.";
    }

    applyClaudeResult(result, repairStatus);
    setProgress(progressSteps, 7);
  } catch (error) {
    setProgress(progressSteps, -1, 1);
    setError(error.message);
  } finally {
    setBusy(false);
    persist();
  }
}

async function testConnection() {
  setBusy(true);
  setError("");
  try {
    const raw = await testClaudeConnection(settings("test"));
    parseClaudeJson(raw);
    setClaudeStatus("Claude connected", "ok");
    if (appState.claude.apiKeyRemembered) saveApiKey(els.apiKey.value);
  } catch (error) {
    setClaudeStatus("Claude failed", "bad");
    setError(error.message);
  } finally {
    setBusy(false);
  }
}

function validateManualLyrics() {
  const template = selectedTemplate(appState);
  const validation = localValidateLyrics(appState.advanced.manualLyrics, appState, template);
  appState.outputs.lyrics = appState.advanced.manualLyrics;
  appState.outputs.validation = validation;
  appState.outputs.validationText = formatValidation(validation, "Local manual validation only.");
  els.lyricsStatus.textContent = validation.passed ? "Manual lyrics passed local validation." : "Manual lyrics need review.";
  updateValidationBadge(validation);
  renderOutputs(appState);
  persist();
}

function applyClaudeResult(result, repairStatus) {
  if (result.title.trim()) appState.song.title = result.title.trim();
  const lyrics = lyricsWithIntegratedMetatags(result);
  const localValidation = localValidateLyrics(lyrics, appState, selectedTemplate(appState));
  const validation = localValidation.passed ? result.validation : localValidation;
  appState.outputs.themeBrief = result.themeBrief;
  appState.outputs.lyrics = lyrics;
  appState.outputs.validation = validation;
  appState.outputs.validationText = formatValidation(validation, repairStatus);
  els.lyricsStatus.textContent = validationPassed(validation) ? "Final output ready." : "Needs manual review.";
  updateValidationBadge(validation);
  renderControls(appState);
  renderOutputs(appState);
}

function lyricsWithIntegratedMetatags(result) {
  const lyrics = String(result.lyrics || "").trim();
  const plannedTags = buildSunoMetatagPlan(appState, selectedTemplate(appState));
  if (!result.lyricMetaTags) return injectPlannedMetatags(lyrics, plannedTags);
  const tags = String(result.lyricMetaTags).trim();
  if (!tags || lyrics.includes(tags) || countArrangementTags(lyrics) >= 3) return lyrics;
  const cleanTags = tags
    .split(/\r?\n|,\s*/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => tag.startsWith("[") ? tag : `[${tag.replace(/^\[|\]$/g, "")}]`)
    .slice(0, 5)
    .join("\n");
  return cleanTags ? `${cleanTags}\n\n${lyrics}` : lyrics;
}

function injectPlannedMetatags(lyrics, plannedTags) {
  return plannedTags.reduce((current, item) => {
    const sectionPattern = new RegExp(`(^\\[${escapeRegExp(item.section)}\\]\\s*)`, "im");
    if (!sectionPattern.test(current) || current.includes(item.tag)) return current;
    return current.replace(sectionPattern, `$1\n${item.tag}\n`);
  }, lyrics);
}

function countArrangementTags(lyrics) {
  const template = selectedTemplate(appState);
  return (lyrics.match(/^\[[^\]\n]+\]/gm) || []).filter((tag) => !template.sections.some((section) => tag === `[${section}]`)).length;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function rebuildOutputs(save = true) {
  normalizeEngineState();
  normalizeLyricState();
  normalizeCompatibility("rebuild");
  appState.outputs.stylePrompt = buildStylePrompt(appState);
  if (!appState.outputs.negativePrompt || document.activeElement !== els.negativeOutput) {
    appState.outputs.negativePrompt = buildNegativePrompt(appState);
  }
  renderOutputs(appState);
  updateValidationBadge(appState.outputs.validation);
  if (save) persist();
}

function settings(prompt) {
  return {
    apiKey: els.apiKey.value,
    model: CLAUDE_MODELS[0],
    temperature: appState.claude.temperature,
    maxTokens: appState.claude.maxTokens,
    prompt
  };
}

// Preset-driven engines (presetMap, e.g. Enigma): the Engine Preset sets the
// flavour cluster + palette behind the scenes so instrumentation follows the
// chosen character. No-op for engines without a presetMap.
function applyPresetMap() {
  const map = (EngineExtras[appState.engine] || {}).presetMap;
  const hit = map && map[appState.style.preset];
  if (hit) { appState.style.cluster = hit.cluster; appState.style.palette = hit.palette; }
}

function syncEngineDefaults() {
  const engine = STYLE_ENGINES[appState.engine];
  appState.style.preset = engine.presets[0];
  appState.style.phase = engine.phases[0];
  appState.style.pad = engine.pads[0];
  appState.style.bass = engine.bass[0];
  appState.style.rhythm = engine.rhythm[0];
  appState.style.percussion = engine.percussion[0];
  appState.style.motif = engine.motifs[0];
  appState.style.movement = engine.movement[0];
  appState.outputs.negativePrompt = "";
  applyPresetMap();
}

function normalizeEngineState() {
  const engine = STYLE_ENGINES[appState.engine] || STYLE_ENGINES.Balearic;
  if (!STYLE_ENGINES[appState.engine]) appState.engine = "Balearic";
  if (!engine.presets.includes(appState.style.preset)) appState.style.preset = engine.presets[0];
  if (!engine.phases.includes(appState.style.phase)) appState.style.phase = engine.phases[0];
}

function randomizeStyle() {
  const engine = STYLE_ENGINES[appState.engine];
  appState.style.preset = pick(engine.presets);
  appState.style.phase = pick(engine.phases);
  appState.style.pad = pick(engine.pads);
  appState.style.bass = pick(engine.bass);
  appState.style.rhythm = pick(engine.rhythm);
  appState.style.percussion = pick(engine.percussion);
  appState.style.motif = pick(engine.motifs);
  appState.style.movement = pick(engine.movement);
  appState.style.vocalMode = weightedPick([["Descriptor", 0.88], ["Instrumental", 0.12]]);
  appState.style.vocalGender = weightedPick([["Female", 0.58], ["Male", 0.42]]);
  appState.style.vocalDescriptor = pick(VOCAL_DESCRIPTOR_OPTIONS[appState.style.vocalGender]);
  appState.style.maxMode = Math.random() > 0.18;
  if (appState.engine === "Delerium") appState.style.vocalMode = weightedPick([["Descriptor", 0.94], ["Instrumental", 0.06]]);
  if (appState.engine === "Era") appState.style.vocalMode = weightedPick([["Descriptor", 0.9], ["Instrumental", 0.1]]);
  normalizeCompatibility("randomize");
  appState.outputs.negativePrompt = "";
  renderControls(appState);
  rebuildOutputs();
}

function normalizeVocalState() {
  if (!VOCAL_MODES.includes(appState.style.vocalMode)) appState.style.vocalMode = "Descriptor";
  if (!VOCAL_DESCRIPTOR_OPTIONS[appState.style.vocalGender]) appState.style.vocalGender = "Female";
  if (!VOCAL_DESCRIPTOR_OPTIONS[appState.style.vocalGender].includes(appState.style.vocalDescriptor)) {
    appState.style.vocalDescriptor = VOCAL_DESCRIPTOR_OPTIONS[appState.style.vocalGender][0];
  }
}

function normalizeLyricState() {
  const energyAliases = {
    "Mid-high": "Medium-high",
    "Low-medium": "Low-mid",
    "Medium": "Mid"
  };
  appState.song.energy = energyAliases[appState.song.energy] || appState.song.energy;
}

function normalizeCompatibility(trigger) {
  return applyCompatibilityRules(appState, STYLE_ENGINES[appState.engine], trigger);
}

function pick(values) {
  return values[Math.floor(Math.random() * values.length)];
}

function weightedPick(entries) {
  const roll = Math.random();
  let total = 0;
  for (const [value, weight] of entries) {
    total += weight;
    if (roll <= total) return value;
  }
  return entries[0][0];
}

function persist() {
  if (appState.claude.apiKeyRemembered) saveApiKey(els.apiKey.value);
  persistState(appState);
}

function copyFrom(id) {
  const target = document.getElementById(id);
  target.select();
  navigator.clipboard?.writeText(target.value);
}

function selectOutput(id) {
  document.getElementById(id).select();
}

function clearOutput(kind) {
  if (kind === "style") {
    appState.style = structuredClone(defaultState.style);
    syncEngineDefaults();
  }
  if (kind === "lyrics") appState.outputs.lyrics = "";
  if (kind === "negative") {
    appState.outputs.negativePrompt = "";
    appState.style.negativePrompt = "";
  }
  rebuildOutputs();
}

function setClaudeStatus(text, kind) {
  els.claudeStatus.textContent = text;
  els.claudeStatus.className = `status-pill status-${kind}`;
}

function setPath(obj, path, value) {
  const keys = path.split(".");
  const last = keys.pop();
  const target = keys.reduce((current, key) => current[key], obj);
  target[last] = value;
}

function mergeState(source, replace = false) {
  if (replace) {
    for (const key of Object.keys(appState)) delete appState[key];
  }
  deepMerge(appState, structuredClone(source || defaultState));
}

function deepMerge(target, source) {
  for (const [key, value] of Object.entries(source || {})) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      target[key] = target[key] || {};
      deepMerge(target[key], value);
    } else {
      target[key] = value;
    }
  }
}

function idle() {
  return new Promise((resolve) => setTimeout(resolve, 80));
}

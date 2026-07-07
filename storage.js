const STATE_KEY = "unifiedSunoLyricEngine.state";
const KEY_KEY = "unifiedSunoLyricEngine.claudeApiKey";
const SAVED_SETUP_KEY = "unifiedSunoLyricEngine.savedSetup";

export function loadPersistedState() {
  return readJson(STATE_KEY);
}

export function persistState(state) {
  const copy = structuredClone(state);
  delete copy.claude.apiKey;
  localStorage.setItem(STATE_KEY, JSON.stringify(copy));
}

export function loadApiKey() {
  return localStorage.getItem(KEY_KEY) || "";
}

export function saveApiKey(key) {
  localStorage.setItem(KEY_KEY, key);
}

export function clearApiKey() {
  localStorage.removeItem(KEY_KEY);
}

export function saveSetup(state) {
  const copy = structuredClone(state);
  copy.outputs = {};
  localStorage.setItem(SAVED_SETUP_KEY, JSON.stringify(copy));
}

export function loadSetup() {
  return readJson(SAVED_SETUP_KEY);
}

function readJson(key) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

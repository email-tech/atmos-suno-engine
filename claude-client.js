export const DEFAULT_MODEL = "claude-opus-4-1-20250805";
export const CLAUDE_MODELS = [
  "claude-opus-4-1-20250805"
];

const API_URL = "https://api.anthropic.com/v1/messages";
const PROXY_URL = "http://127.0.0.1:8787/v1/messages";

export async function callClaude({ apiKey, model, temperature, maxTokens, prompt }) {
  const mode = localStorage.getItem("unifiedSunoLyricEngine.claudeTransport") || "direct";
  if (mode === "direct" && !apiKey?.trim()) {
    throw new Error("Missing Claude API key. Enter a key in Claude Settings before generating.");
  }

  let response;
  try {
    response = await fetch(mode === "proxy" ? PROXY_URL : API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(mode === "direct" ? { "x-api-key": apiKey.trim() } : {}),
        "anthropic-version": "2023-06-01",
        ...(mode === "direct" ? { "anthropic-dangerous-direct-browser-access": "true" } : {})
      },
      body: JSON.stringify({
        model,
        max_tokens: Number(maxTokens),
        temperature: Number(temperature),
        messages: [{ role: "user", content: prompt }]
      })
    });
  } catch (error) {
    const help = mode === "direct"
      ? "Direct browser mode may be blocked by CORS. Switch to Local proxy mode and start the optional proxy."
      : "Local proxy mode expects the optional proxy to be running at http://127.0.0.1:8787.";
    throw new Error(`Network or CORS failure while calling Claude: ${error.message}. ${help}`);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const modelHint = response.status === 404 ? " The selected model is not available to this API key. Use claude-opus-4-1-20250805." : "";
    throw new Error(`Claude request failed (${response.status}).${modelHint} ${body || "Check API key, model, quota, or browser CORS policy."}`);
  }

  const data = await response.json();
  const text = data.content?.map((item) => item.text || "").join("\n").trim();
  if (!text) throw new Error("Claude returned an empty response.");
  return text;
}

export async function testClaudeConnection(settings) {
  const text = await callClaude({
    ...settings,
    maxTokens: 64,
    temperature: 0,
    prompt: "Return JSON only: {\"ok\":true,\"message\":\"Claude connection ready\"}"
  });
  return text;
}

# Inified Suno Lyric Engine — Combined Source Bundle

All files from Inified_Suno_Lyric_Engine.zip concatenated into one document for Project Knowledge upload (zip archives not supported as a source type). app.bundle.js (generated build output, 2220 lines) is excluded to save space — it's a compiled concatenation of the js/ source modules below, which are all present individually.


---
## FILE: NEXT_SESSION_HANDOFF.txt
---
```
﻿Unified Suno Style + Lyric Engine save point
Date: 2026-05-28 15:54:52
Source: E:\Documents\Atmos Prompt and Lyric Engine\unified-suno-lyric-engine
Save point: E:\Documents\Atmos Prompt and Lyric Engine\save-points\unified-suno-lyric-engine_2026-05-28_15-54-52

Current state summary:
- Local static app for Suno style prompt + Claude lyric generation.
- Claude proxy/direct support remains in place; model forced through existing app settings.
- app.bundle.js is generated from source modules using build-bundle.mjs.
- Style, Lyrics, and Negative prompts now appear together in the Suno Export module, each with its own window and copy/select controls.
- Male/Female vocal descriptor lists were expanded into more distinct vocal performance archetypes.
- Metatag/ad-lib system now includes compatibility rules, supporting vocal arrangement, and purposeful lyric inserts.
- Compatibility layer added in js/compatibility-rules.js.
- Phase/profile now controls bass support by tempo band.
- Vocal tone/delivery now aligns vocal blend/density, lyric vocal framing, and lyric delivery style.
- Instrumental mode neutralizes lyric vocal behavior.
- build-bundle.mjs now includes js/compatibility-rules.js before metatag/prompt/UI/app modules.

Next alteration reminder:
Prefix Lyric prompt with the following line:
///*****///

Workflow reminder:
After source edits, rebuild with:
node .\unified-suno-lyric-engine\build-bundle.mjs
Then check:
node --check .\unified-suno-lyric-engine\js\app.bundle.js
```

---
## FILE: build-bundle.mjs
---
```
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

const files = [
  "js/data-style-engines.js",
  "js/data-lyric-controls.js",
  "js/state.js",
  "js/storage.js",
  "js/prompt-style-builder.js",
  "js/compatibility-rules.js",
  "js/metatag-builder.js",
  "js/validation.js",
  "js/claude-client.js",
  "js/prompt-lyric-builder.js",
  "js/ui.js",
  "js/app.js"
];

let output = "// Generated local-file bundle. Source modules are kept alongside this file.\n";

for (const file of files) {
  let text = fs.readFileSync(path.join(root, file), "utf8");
  text = text.replace(/^import .+?;\r?\n/gm, "");
  text = text
    .replace(/\bexport async function\b/g, "async function")
    .replace(/\bexport function\b/g, "function")
    .replace(/\bexport const\b/g, "const");
  output += `\n/* ${file} */\n${text}\n`;
}

fs.writeFileSync(path.join(root, "js/app.bundle.js"), output);
```

---
## FILE: claude-local-proxy.mjs
---
```
import http from "node:http";

const port = 8787;
const apiKey = process.env.ANTHROPIC_API_KEY;

if (!apiKey) {
  console.error("Set ANTHROPIC_API_KEY before starting the proxy.");
  console.error("PowerShell: $env:ANTHROPIC_API_KEY='sk-ant-...'; node claude-local-proxy.mjs");
  process.exit(1);
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type, anthropic-version");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== "POST" || req.url !== "/v1/messages") {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
    return;
  }

  let body = "";
  req.on("data", (chunk) => { body += chunk; });
  req.on("end", async () => {
    try {
      const parsed = JSON.parse(body);
      console.log(`[proxy] Claude request received. model=${parsed.model} max_tokens=${parsed.max_tokens}`);
      const upstream = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01"
        },
        body
      });
      const text = await upstream.text();
      console.log(`[proxy] Anthropic responded HTTP ${upstream.status}`);
      res.writeHead(upstream.status, { "content-type": upstream.headers.get("content-type") || "application/json" });
      res.end(text);
    } catch (error) {
      console.log(`[proxy] Error: ${error.message}`);
      res.writeHead(502, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: error.message }));
    }
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Claude local proxy listening at http://127.0.0.1:${port}`);
});
```

---
## FILE: css/components.css
---
```
.panel,
.output-card {
  background: var(--canvas);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow);
}

.panel {
  position: relative;
  overflow: hidden;
  padding: 18px;
  background:
    linear-gradient(180deg, rgba(255,255,255,0.96), rgba(255,255,255,0.9)),
    var(--panel-tint, var(--accent-soft));
}

.panel::before {
  content: "";
  position: absolute;
  inset: 0 auto 0 0;
  width: 5px;
  background: var(--panel-accent, var(--accent));
}

.panel-style { --panel-accent: var(--accent); --panel-tint: var(--accent-soft); }
.panel-song { --panel-accent: var(--coral); --panel-tint: #fff0ed; }
.panel-structure { --panel-accent: var(--sky); --panel-tint: #edf5ff; }
.panel-language { --panel-accent: var(--plum); --panel-tint: #f5eff8; }
.panel-claude { --panel-accent: var(--mint); --panel-tint: #e9faf6; }

.output-card {
  padding: 20px;
  scroll-margin-top: 130px;
  background:
    linear-gradient(180deg, rgba(255,255,255,0.98), rgba(250,252,255,0.94));
}

.output-card .output-head {
  align-items: center;
  margin: -4px -2px 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-muted);
}

.output-card .output-head h2 {
  font-size: 17px;
}

.output-card .button-row button {
  border-radius: 10px;
  background: #fff;
}

.export-grid {
  display: grid;
  gap: 14px;
}

.export-window {
  display: grid;
  gap: 10px;
  border: 1px solid var(--border-muted);
  border-radius: 14px;
  padding: 14px;
  background:
    linear-gradient(180deg, rgba(255,255,255,0.76), rgba(255,255,255,0.48)),
    var(--canvas-subtle);
}

.mini-output-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.mini-output-head h3 {
  margin: 0;
  font-size: 14px;
  letter-spacing: 0;
}

.mini-output-head .button-row {
  justify-content: flex-end;
}

.panel-title,
.output-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.panel-title {
  align-items: flex-start;
  margin-bottom: 14px;
}

.panel-title > div {
  display: flex;
  align-items: center;
  gap: 10px;
}

.panel-subtitle {
  max-width: 210px;
  margin: 0;
  color: var(--text-muted);
  font-size: 12px;
  text-align: right;
}

.panel h2,
.output-card h2,
summary {
  margin: 0;
  font-size: 16px;
  letter-spacing: 0;
}

summary {
  cursor: pointer;
  font-weight: 700;
}

.detail-body { margin-top: 12px; }

.step {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--panel-accent, var(--accent));
  color: #fff;
  font-weight: 800;
}

.control-stack {
  display: grid;
  gap: 14px;
}

label,
.compact-field {
  display: grid;
  gap: 5px;
  color: var(--text);
  font-weight: 600;
}

label span,
.compact-field span {
  color: var(--text-muted);
  font-size: 12px;
}

input,
select,
textarea,
button {
  font: inherit;
}

.decision-group {
  display: grid;
  gap: 8px;
  border: 1px solid color-mix(in srgb, var(--border) 78%, white);
  border-radius: 16px;
  padding: 14px 14px 16px;
  background:
    linear-gradient(135deg, rgba(255,255,255,0.64), rgba(255,255,255,0.24)),
    var(--decision-tint, var(--canvas-subtle));
}

.decision-preset { --decision-tint: #ccefeb; }
.decision-phase { --decision-tint: #dbeafe; }
.decision-voice { --decision-tint: #ffe7ae; }
.decision-source { --decision-tint: #eadcf2; }
.decision-lens { --decision-tint: #ffd9d2; }
.decision-mood { --decision-tint: #d2f3eb; }
.decision-energy { --decision-tint: #ffedb8; }
.decision-perspective { --decision-tint: #dfe5ff; }
.decision-language { --decision-tint: #e6dcff; }
.decision-mode { --decision-tint: #d9efff; }

.vocal-descriptor-panel {
  display: grid;
  gap: 12px;
  border: 1px solid color-mix(in srgb, var(--border) 72%, white);
  border-radius: 16px;
  padding: 14px 14px 16px;
  background:
    linear-gradient(135deg, rgba(255,255,255,0.58), rgba(255,255,255,0.22)),
    #ffe7ae;
}

.decision-label {
  color: var(--text);
  font-size: 14px;
  font-weight: 800;
}

.decision-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 11px;
}

.decision-option {
  display: grid;
  align-items: start;
  min-height: 64px;
  gap: 6px;
  padding: 12px 13px;
  text-align: left;
  border-color: #d9e1ea;
  background: var(--canvas-raised);
  border-radius: 13px;
  box-shadow: 0 4px 10px rgba(23, 32, 51, 0.04);
  transition: transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease;
}

.decision-option:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 18px rgba(23, 32, 51, 0.08);
}

.decision-option strong {
  color: var(--text);
  font-size: 13px;
}

.decision-option small {
  display: block;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  font-weight: 600;
}

.decision-option.active {
  border-color: var(--accent);
  background:
    linear-gradient(180deg, rgba(255,255,255,0.72), rgba(255,255,255,0.42)),
    var(--accent-soft);
  color: var(--accent);
  box-shadow: inset 0 0 0 1px var(--accent), 0 8px 18px rgba(8, 127, 140, 0.12);
}

.field-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.field-grid label {
  min-width: 0;
}

.subsection {
  border: 1px solid var(--border-muted);
  border-radius: var(--radius);
  background: var(--canvas-subtle);
  padding: 11px;
}

.subsection summary {
  color: var(--text);
  font-size: 13px;
}

.subsection .detail-body {
  margin-top: 12px;
}

input,
select,
textarea {
  width: 100%;
  border: 1px solid #cfd8e3;
  border-radius: var(--radius);
  background: var(--canvas-raised);
  color: var(--text);
  padding: 10px 11px;
}

textarea {
  resize: vertical;
  min-height: 44px;
}

input:focus,
select:focus,
textarea:focus,
button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

button {
  border: 1px solid #cfd8e3;
  border-radius: var(--radius);
  background: var(--canvas-raised);
  color: var(--text);
  padding: 9px 12px;
  cursor: pointer;
  font-weight: 700;
}

button:hover:not(:disabled) {
  border-color: var(--accent);
  background: var(--accent-soft);
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.primary-btn {
  background: linear-gradient(135deg, var(--accent), var(--mint));
  border-color: transparent;
  color: #fff;
  box-shadow: 0 8px 20px rgba(8, 127, 140, 0.25);
}

.button-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.output-card textarea {
  border-color: #d6e0ea;
  border-radius: 14px;
  background:
    linear-gradient(#fff, #fff) padding-box,
    linear-gradient(135deg, color-mix(in srgb, var(--accent) 32%, white), rgba(239,111,97,0.28)) border-box;
  font-family: "Segoe UI", system-ui, sans-serif;
  line-height: 1.6;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.8), 0 10px 24px rgba(23,32,51,0.06);
}

#styleOutput {
  min-height: 190px;
}

#lyricsOutput {
  min-height: 390px;
}

#negativeOutput {
  min-height: 130px;
}

.output-card[hidden] {
  display: none;
}

.toggle-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toggle-row input {
  width: auto;
}

.field-note,
.field-warning {
  margin: 0;
  color: var(--text-muted);
  font-size: 12px;
}

.field-warning {
  color: var(--warning);
}

.status-pill {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  min-height: 28px;
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 3px 9px;
  color: var(--text-muted);
  background: var(--canvas-raised);
  font-size: 12px;
  font-weight: 800;
}

.status-ok { color: var(--success); border-color: rgba(63, 185, 80, 0.5); }
.status-warn { color: var(--warning); border-color: rgba(210, 153, 34, 0.5); }
.status-bad { color: var(--danger); border-color: rgba(248, 81, 73, 0.55); }

.output-tabs .output-tab:nth-child(1).active { background: var(--accent); border-color: var(--accent); }
.output-tabs .output-tab:nth-child(2).active { background: var(--coral); border-color: var(--coral); }
.output-tabs .output-tab:nth-child(3).active { background: var(--plum); border-color: var(--plum); }
.output-tabs .output-tab:nth-child(4).active { background: var(--sky); border-color: var(--sky); }
.output-tabs .output-tab:nth-child(5).active { background: var(--era); border-color: var(--era); }
.output-tabs .output-tab:nth-child(6).active { background: #4b5563; border-color: #4b5563; }
.output-tabs .output-tab:nth-child(7).active { background: var(--mint); border-color: var(--mint); }

.progress-list {
  margin: 8px 0 0;
  padding-left: 24px;
  color: var(--text-muted);
}

.progress-list li.active { color: var(--accent); font-weight: 800; }
.progress-list li.done { color: var(--success); }
.progress-list li.failed { color: var(--danger); }

.error-box {
  margin-top: 12px;
  border: 1px solid rgba(248, 81, 73, 0.55);
  border-radius: var(--radius);
  padding: 10px;
  color: #ffd2cf;
  background: rgba(248, 81, 73, 0.08);
}
```

---
## FILE: css/layout.css
---
```
* { box-sizing: border-box; }

body {
  margin: 0;
  min-height: 100vh;
  background:
    linear-gradient(135deg, rgba(239, 111, 97, 0.12), transparent 30%),
    linear-gradient(315deg, rgba(43, 179, 163, 0.16), transparent 32%),
    radial-gradient(circle at top left, var(--page-tint), transparent 430px),
    var(--bg);
  color: var(--text);
  font: 14px/1.5 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.app-header {
  position: sticky;
  top: 0;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 22px;
  background:
    linear-gradient(90deg, rgba(255,255,255,0.98), rgba(255,255,255,0.88)),
    linear-gradient(120deg, rgba(8,127,140,0.18), rgba(239,111,97,0.10));
  border-bottom: 1px solid var(--border);
  backdrop-filter: blur(12px);
}

.brand-block {
  position: relative;
  padding-left: 14px;
}

.brand-block::before {
  content: "";
  position: absolute;
  left: 0;
  top: 4px;
  bottom: 4px;
  width: 4px;
  border-radius: 999px;
  background: linear-gradient(180deg, var(--accent), var(--coral), var(--sun));
}

.workflow-nav {
  position: sticky;
  top: 68px;
  z-index: 3;
  display: flex;
  gap: 4px;
  padding: 10px 22px;
  overflow-x: auto;
  background: rgba(255, 255, 255, 0.9);
  border-bottom: 1px solid var(--border-muted);
  backdrop-filter: blur(12px);
}

.studio-strip {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  padding: 16px 22px 4px;
}

.studio-card {
  position: relative;
  overflow: hidden;
  min-height: 92px;
  border: 1px solid rgba(255,255,255,0.65);
  border-radius: 18px;
  padding: 18px;
  color: white;
  box-shadow: var(--shadow);
}

.studio-card::after {
  content: "";
  position: absolute;
  inset: auto 16px 14px auto;
  width: 86px;
  height: 10px;
  border-radius: 999px;
  background: rgba(255,255,255,0.36);
}

.studio-card-style { background: linear-gradient(135deg, #087f8c, #2f80ed); }
.studio-card-song { background: linear-gradient(135deg, #ef6f61, #b26b25); }
.studio-card-output { background: linear-gradient(135deg, #7257d6, #2bb3a3); }

.studio-kicker {
  display: block;
  margin-bottom: 8px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.8;
}

.studio-card strong {
  display: block;
  font-size: 20px;
  letter-spacing: 0;
}

.workflow-tab {
  flex: 0 0 auto;
  border: 0;
  border-radius: 10px;
  padding: 9px 14px;
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 700;
  background: transparent;
}

.workflow-tab:hover,
.workflow-tab:focus {
  color: var(--text);
  border-color: var(--accent);
  background: var(--accent-soft);
}

.workflow-tab.active {
  color: #fff;
  border-color: transparent;
  background: var(--accent);
  box-shadow: 0 8px 18px rgba(8, 127, 140, 0.18);
}

.app-header h1 {
  margin: 0;
  font-size: 20px;
  letter-spacing: 0;
}

.eyebrow {
  margin: 0 0 2px;
  color: var(--accent);
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
}

.header-controls {
  display: flex;
  align-items: end;
  gap: 10px;
  flex-wrap: wrap;
}

.engine-deck {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(180px, 220px);
  gap: 14px;
  align-items: center;
  margin: 6px 0 18px;
  border: 1px solid color-mix(in srgb, var(--accent) 28%, white);
  border-radius: 16px;
  padding: 18px 20px;
  color: #fff;
  background:
    radial-gradient(circle at 85% 20%, rgba(255,255,255,0.26), transparent 30%),
    linear-gradient(135deg, color-mix(in srgb, var(--accent) 82%, #12333a), color-mix(in srgb, var(--accent) 42%, #92635f)),
    var(--accent);
  box-shadow: 0 16px 34px rgba(23, 32, 51, 0.16);
}

.engine-deck strong {
  display: block;
  margin-top: 4px;
  font-size: 28px;
  line-height: 1;
  letter-spacing: 0;
}

.engine-deck p {
  margin: 8px 0 0;
  max-width: 260px;
  color: rgba(255,255,255,0.88);
}

.engine-deck-actions {
  display: grid;
  gap: 10px;
}

.engine-deck select {
  color: var(--text);
  background: rgba(255,255,255,0.92);
}

.spark-btn {
  border-color: rgba(255,255,255,0.36);
  color: #172033;
  background: linear-gradient(135deg, #fffdf5, #fff4c7);
  box-shadow: 0 10px 22px rgba(0,0,0,0.14);
}

.spark-btn:hover {
  background: linear-gradient(135deg, #fff8d8, #ffe7d8);
}

.app-grid {
  display: grid;
  grid-template-columns: minmax(390px, 500px) minmax(0, 1fr);
  gap: 16px;
  padding: 16px 22px 22px;
}

.control-rail {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

[data-workflow-panel][hidden] {
  display: none;
}

.workspace {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.output-tabs {
  position: sticky;
  top: 119px;
  z-index: 2;
  display: flex;
  gap: 4px;
  padding: 7px;
  overflow-x: auto;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: var(--shadow);
  backdrop-filter: blur(12px);
}

.output-tab {
  flex: 0 0 auto;
  border: 0;
  border-radius: 11px;
  background: transparent;
  color: var(--text-muted);
}

.output-tab.active {
  color: #fff;
  background: var(--accent);
  border-color: var(--accent);
}

@media (max-width: 980px) {
  .app-header { align-items: flex-start; flex-direction: column; }
  .workflow-nav { top: 143px; }
  .studio-strip { grid-template-columns: 1fr; }
  .app-grid { grid-template-columns: 1fr; }
}
```

---
## FILE: css/tokens.css
---
```
:root {
  --bg: #f4f1ec;
  --page-tint: #e7f6f4;
  --canvas: #ffffff;
  --canvas-subtle: #f8fafc;
  --canvas-raised: #ffffff;
  --border: #d8dee8;
  --border-muted: rgba(216, 222, 232, 0.72);
  --text: #172033;
  --text-muted: #667085;
  --accent: #087f8c;
  --accent-soft: #dff7f4;
  --success: #16833a;
  --warning: #ad6f00;
  --danger: #d12f45;
  --balearic: #087f8c;
  --enigma: #7257d6;
  --delerium: #25856f;
  --era: #b26b25;
  --coral: #ef6f61;
  --sun: #f7b801;
  --plum: #6f4e7c;
  --sky: #2f80ed;
  --mint: #2bb3a3;
  --radius: 10px;
  --radius-lg: 14px;
  --shadow: 0 18px 45px rgba(23, 32, 51, 0.12);
  color-scheme: light;
}

[data-engine="Balearic"] { --accent: var(--balearic); --accent-soft: #dff7f4; --page-tint: #e4f6f3; }
[data-engine="Enigma"] { --accent: var(--enigma); --accent-soft: #f0ebff; --page-tint: #f3efff; }
[data-engine="Delerium"] { --accent: var(--delerium); --accent-soft: #e2f8ef; --page-tint: #e9f8f1; }
[data-engine="Era"] { --accent: var(--era); --accent-soft: #fff2d8; --page-tint: #fff3dd; }
```

---
## FILE: docs/README.md
---
```
# Unified Suno Style + Lyric Engine

This is a local, folder-contained web app for building a Suno style prompt first, then generating Suno-ready lyrics with Claude.

## How to Open

Open `index.html` in a modern browser from this folder:

```txt
unified-suno-lyric-engine/index.html
```

No install, build step, login, database, Node, React, Vite, or backend server is required.

## Claude API Key

Enter your Claude API key in the Claude Settings panel.

The key is used only in your browser. If you enable "Remember API key on this PC", it is stored in this browser's `localStorage`. Do not enable that option on a shared computer.

The app files do not contain a hardcoded API key.

## Optional Local Proxy

If direct browser calls fail, use the included local proxy:

```powershell
$env:ANTHROPIC_API_KEY="sk-ant-..."
node claude-local-proxy.mjs
```

Then set **Connection mode** in the app to **Local proxy at 127.0.0.1:8787**.

On Windows, you can also double-click `start-claude-proxy.bat`, paste the key when prompted, and leave that window open.

If your browser blocks JavaScript modules or local requests from a double-clicked HTML file, double-click `start-local-app.bat`. It will choose an available local port and open the app automatically. The usual URL is:

```txt
http://127.0.0.1:8765/index.html
```

If port `8765` is already busy, the launcher will try `8766`, `8767`, and so on.

This app defaults to `claude-opus-4-1-20250805` because it was verified with the supplied key during local troubleshooting. If you change models and see a 404 model error, that model is not available to the current API key/workspace.

## CORS Warning

Direct browser calls to Claude may be blocked depending on Anthropic's current CORS policy. This app is designed for local PC use with a frontend-stored API key, as requested. If browser calls fail, the next upgrade path is a tiny local proxy server.

## Workflow

1. Build the Style Prompt in Step 1.
2. Configure the song concept, structure, and optional language layer.
3. Enter your Claude API key and test the connection if desired.
4. Click **Generate Lyrics with Claude**.
5. Review the validation result.
6. Copy **Suno Style Prompt**, **Suno Lyrics**, and **Negative Prompt** separately.

The app asks Claude for theme brief, lyrics, metatags, and validation in one pass. If validation fails below 80 or returns `passed: false`, it sends one automatic repair request.

## Interface Notes

The interface uses GitHub Primer-inspired product patterns: a focused split layout, pill workflow navigation, compact panels, choice chips for major decisions, collapsed fine-tuning sections for lower-level controls, and tabbed outputs to reduce visual noise.

## File Structure

```txt
unified-suno-lyric-engine/
  index.html
  css/
    tokens.css
    layout.css
    components.css
  js/
    app.bundle.js
    app.js
    state.js
    data-style-engines.js
    data-lyric-controls.js
    prompt-style-builder.js
    prompt-lyric-builder.js
    claude-client.js
    validation.js
    storage.js
    ui.js
  docs/
    README.md
    source-migration.md
```

`index.html` loads `js/app.bundle.js` so the app can run from a plain local file path. The other JavaScript files are the organized source modules used to maintain the app.

See `docs/source-migration.md` for notes on what was migrated from the two original HTML apps.

## Local Storage

The app may store:

- Claude API key, only when "Remember API key on this PC" is enabled
- Last selected controls
- Last successful output
- Saved setup data

Use **Export JSON** to back up your setup. Keep exported files somewhere private if they include creative notes.

## If Claude Calls Fail

Check:

- API key is present and valid
- Model name is available to your Anthropic account
- Browser is online
- Browser or Anthropic CORS policy is not blocking direct API calls

If CORS blocks the call, keep this frontend and add a small local proxy as the next upgrade path.
```

---
## FILE: docs/source-migration.md
---
```
# Source Migration Notes

The unified app was updated against these original local source files:

- `C:/Users/Admin/Downloads/atmos_engine_balearic_enigma_delerium_era_integrated_v7.html`
- `C:/Users/Admin/Downloads/lyric_prompt_engine.html`

Migrated from the Atmos engine:

- Exact Max Mode block
- Exact mastering phrase
- Original Balearic, Enigma, Delerium, and ERA negative prompts
- Balearic phase, pad, string, drum, bass, motif, movement, and vocal descriptor language
- Enigma album-era tempo, pad, rhythm, bass, motif, movement, and vocal descriptor language
- Updated Delerium profile/variant/hook/tempo/vocal/density/motif/character/movement language
- ERA profile, hook, tempo, vocal blend, density, motif, character, movement, and mastering language

Migrated from the Lyric Prompt Engine:

- Source type options
- Theme lens options
- Genre, era, mood, energy, perspective, and language style options
- Hook, line length, rhyme, imagery, narrative clarity, vocal framing, and delivery options
- Negative lyric rules and validation concepts

The old manual workflow remains represented only in advanced override panels. The primary workflow is now the one-pass Claude generation flow with one automatic repair attempt.
```

---
## FILE: index.html
---
```
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Unified Suno Style + Lyric Engine</title>
    <link rel="stylesheet" href="css/tokens.css">
    <link rel="stylesheet" href="css/layout.css">
    <link rel="stylesheet" href="css/components.css">
  </head>
  <body>
    <header class="app-header">
      <div class="brand-block">
        <p class="eyebrow">Local Suno workflow</p>
        <h1>Unified Style + Lyric Engine</h1>
      </div>
      <div class="header-controls">
        <div id="claudeStatus" class="status-pill status-warn">Claude not tested</div>
        <button id="generateBtn" class="primary-btn" type="button">Generate Lyrics with Claude</button>
      </div>
    </header>

    <section class="studio-strip" aria-label="Current workflow summary">
      <div class="studio-card studio-card-style">
        <span class="studio-kicker">Style DNA</span>
        <strong>Atmos engine first</strong>
      </div>
      <div class="studio-card studio-card-song">
        <span class="studio-kicker">Song Brief</span>
        <strong>Concept, hook, voice</strong>
      </div>
      <div class="studio-card studio-card-output">
        <span class="studio-kicker">Final Export</span>
        <strong>Style, lyrics, negative</strong>
      </div>
    </section>

    <nav class="workflow-nav" aria-label="Workflow">
      <button class="workflow-tab active" type="button" data-workflow-tab="styleStep">Style</button>
      <button class="workflow-tab" type="button" data-workflow-tab="conceptStep">Concept</button>
      <button class="workflow-tab" type="button" data-workflow-tab="structureStep">Structure</button>
      <button class="workflow-tab" type="button" data-workflow-tab="languageStep">Language</button>
      <button class="workflow-tab" type="button" data-workflow-tab="claudeStep">Claude</button>
      <button class="workflow-tab" type="button" data-workflow-tab="advancedStep">Advanced</button>
    </nav>

    <main class="app-grid">
      <aside class="control-rail" aria-label="Workflow controls">
        <section class="panel panel-style" id="styleStep" data-workflow-panel>
          <div class="panel-title">
            <div>
              <span class="step">1</span>
              <h2>Style</h2>
            </div>
            <p class="panel-subtitle">Choose the sonic world before writing lyrics.</p>
          </div>
          <div class="engine-deck">
            <div>
              <span class="studio-kicker">Active Engine</span>
              <strong id="engineDeckName">Balearic</strong>
              <p id="engineDeckHint">Atmospheric chillout and sunset groove logic.</p>
            </div>
            <div class="engine-deck-actions">
              <select id="engineSelect" data-bind="engine"></select>
              <button id="randomizeBtn" class="spark-btn" type="button">Randomize Style</button>
            </div>
          </div>
          <div id="styleControls" class="control-stack"></div>
        </section>

        <section class="panel panel-song" id="conceptStep" data-workflow-panel hidden>
          <div class="panel-title">
            <div>
              <span class="step">2</span>
              <h2>Song Concept</h2>
            </div>
            <p class="panel-subtitle">Define the emotional target and point of view.</p>
          </div>
          <div id="songControls" class="control-stack"></div>
        </section>

        <section class="panel panel-structure" id="structureStep" data-workflow-panel hidden>
          <div class="panel-title">
            <div>
              <span class="step">3</span>
              <h2>Structure</h2>
            </div>
            <p class="panel-subtitle">Pick the section map Claude should obey.</p>
          </div>
          <div class="control-stack">
            <label>
              <span>Structure template</span>
              <select id="structureTemplate"></select>
            </label>
            <p id="structureNotes" class="field-note"></p>
            <label class="toggle-row">
              <input type="checkbox" id="includePreChorus">
              <span>Include pre-chorus where useful</span>
            </label>
            <label class="toggle-row">
              <input type="checkbox" id="includeBridge">
              <span>Include bridge where useful</span>
            </label>
          </div>
        </section>

        <section class="panel panel-language" id="languageStep" data-workflow-panel hidden>
          <div class="panel-title">
            <div>
              <span class="step">4</span>
              <h2>Language Layer</h2>
            </div>
            <p class="panel-subtitle">Add restrained phrase color without translating the song.</p>
          </div>
          <div id="languageControls" class="control-stack"></div>
        </section>

        <section class="panel panel-claude" id="claudeStep" data-workflow-panel hidden>
          <div class="panel-title">
            <div>
              <span class="step">5</span>
              <h2>Claude Settings</h2>
            </div>
            <p class="panel-subtitle">Use the local proxy for the most reliable connection.</p>
          </div>
          <div class="control-stack">
            <label>
              <span>API key</span>
              <input id="apiKey" type="password" autocomplete="off" placeholder="sk-ant-...">
            </label>
            <p class="field-warning">Local PC mode only. Your API key is stored in this browser if "remember" is enabled. Do not use this on a shared computer.</p>
            <label class="toggle-row">
              <input type="checkbox" id="rememberKey">
              <span>Remember API key on this PC</span>
            </label>
            <label>
              <span>Connection mode</span>
              <select id="claudeTransport">
                <option value="direct">Direct browser call</option>
                <option value="proxy">Local proxy at 127.0.0.1:8787</option>
              </select>
            </label>
            <label>
              <span>Claude model</span>
              <select id="claudeModel"></select>
            </label>
            <label>
              <span>Temperature <b id="temperatureValue"></b></span>
              <input id="temperature" type="range" min="0" max="1.2" step="0.05">
            </label>
            <label>
              <span>Max output tokens</span>
              <input id="maxTokens" type="number" min="1000" max="8000" step="250">
            </label>
            <div class="button-row">
              <button id="testClaudeBtn" type="button">Test connection</button>
              <button id="clearKeyBtn" type="button">Clear stored key</button>
            </div>
            <p class="field-note">Direct browser calls to Claude may be blocked depending on Anthropic's current CORS policy. If that happens, switch to local proxy mode and start the optional proxy included in this folder.</p>
          </div>
        </section>

        <details class="panel" id="advancedStep" data-workflow-panel hidden open>
          <summary>Advanced / Manual Overrides</summary>
          <div class="control-stack detail-body">
            <label class="toggle-row">
              <input type="checkbox" id="useStyleToGuideLyrics">
              <span>Use style engine to guide lyrics</span>
            </label>
            <label class="toggle-row">
              <input type="checkbox" id="strictValidation">
              <span>Strict validation</span>
            </label>
            <label>
              <span>Manual theme brief</span>
              <textarea id="manualThemeBrief" rows="4" placeholder="Overrides automatic theme brief generation."></textarea>
            </label>
            <label>
              <span>Manual lyrics for validation</span>
              <textarea id="manualLyrics" rows="5" placeholder="Paste existing lyrics, then use Validate Manual Lyrics."></textarea>
            </label>
            <label>
              <span>Raw Claude prompt preview</span>
              <textarea id="promptPreview" rows="8" readonly></textarea>
            </label>
            <div class="button-row">
              <button id="validateManualBtn" type="button">Validate Manual Lyrics</button>
              <button id="saveSetupBtn" type="button">Save Current Setup</button>
              <button id="loadSetupBtn" type="button">Load Setup</button>
              <button id="exportStateBtn" type="button">Export JSON</button>
              <button id="importStateBtn" type="button">Import JSON</button>
              <button id="resetBtn" type="button">Reset App</button>
            </div>
            <textarea id="stateTransfer" rows="5" placeholder="Exported or imported app JSON appears here."></textarea>
          </div>
        </details>
      </aside>

      <section class="workspace" aria-label="Generated outputs">
        <div class="output-tabs" role="tablist" aria-label="Output panels">
          <button class="output-tab active" type="button" data-output-tab="exportPanel">Suno Export</button>
          <button class="output-tab" type="button" data-output-tab="metatagPanel">Tags</button>
          <button class="output-tab" type="button" data-output-tab="validationPanel">Validation</button>
          <button class="output-tab" type="button" data-output-tab="themePanel">Theme</button>
          <button class="output-tab" type="button" data-output-tab="debugPanel">Debug</button>
          <button class="output-tab" type="button" data-output-tab="progressPanel">Progress</button>
        </div>

        <section class="output-card export-card" id="exportPanel" data-output-panel>
          <div class="output-head">
            <div>
              <h2>Suno Export</h2>
              <p class="field-note">Copy these into Suno Custom Mode.</p>
            </div>
          </div>

          <div class="export-grid">
            <div class="export-window export-window-style">
              <div class="mini-output-head">
                <div>
                  <h3>Style Prompt</h3>
                  <p id="styleBudget" class="field-note">0 / 1000 characters</p>
                </div>
                <div class="button-row">
                  <button data-copy="styleOutput" type="button">Copy Style</button>
                  <button data-select="styleOutput" type="button">Select</button>
                  <button data-clear="style" type="button">Clear</button>
                </div>
              </div>
              <textarea id="styleOutput" rows="8" readonly></textarea>
            </div>

            <div class="export-window export-window-lyrics">
              <div class="mini-output-head">
                <div>
                  <h3>Lyrics</h3>
                  <p id="lyricsStatus" class="field-note">Generate or validate lyrics to fill this panel.</p>
                </div>
                <div class="button-row">
                  <button data-copy="lyricsOutput" type="button">Copy Lyrics</button>
                  <button data-select="lyricsOutput" type="button">Select</button>
                  <button data-clear="lyrics" type="button">Clear</button>
                </div>
              </div>
              <textarea id="lyricsOutput" rows="18" readonly></textarea>
            </div>

            <div class="export-window export-window-negative">
              <div class="mini-output-head">
                <div>
                  <h3>Negative Prompt</h3>
                  <p class="field-note">Kept separate for Suno copy/paste.</p>
                </div>
                <div class="button-row">
                  <button data-copy="negativeOutput" type="button">Copy Negative</button>
                  <button data-select="negativeOutput" type="button">Select</button>
                  <button data-clear="negative" type="button">Clear</button>
                </div>
              </div>
              <textarea id="negativeOutput" rows="5"></textarea>
            </div>
          </div>
        </section>

        <section class="output-card" id="metatagPanel" data-output-panel hidden>
          <div class="output-head">
            <div>
              <h2>Suno Metatag Plan</h2>
              <p class="field-note">Arrangement cues derived from the selected instruments, vocal mode, and lyric structure.</p>
            </div>
            <div class="button-row">
              <button data-copy="metatagOutput" type="button">Copy Tags</button>
              <button data-select="metatagOutput" type="button">Select All</button>
            </div>
          </div>
          <textarea id="metatagOutput" rows="8" readonly></textarea>
        </section>

        <section class="output-card" id="validationPanel" data-output-panel hidden>
          <div class="output-head">
            <div>
              <h2>Validation Report</h2>
              <p id="validationBadge" class="status-pill">No validation yet</p>
            </div>
            <div class="button-row">
              <button data-copy="validationOutput" type="button">Copy Validation Report</button>
              <button data-select="validationOutput" type="button">Select All</button>
            </div>
          </div>
          <textarea id="validationOutput" rows="8" readonly></textarea>
        </section>

        <section class="output-card" id="themePanel" data-output-panel hidden>
          <h2>Theme Brief</h2>
          <textarea id="themeBriefOutput" rows="6" readonly></textarea>
        </section>

        <section class="output-card" id="debugPanel" data-output-panel hidden>
          <h2>Claude Raw JSON</h2>
          <textarea id="rawJsonOutput" rows="10" readonly></textarea>
        </section>

        <section class="output-card" id="progressPanel" data-output-panel hidden>
          <h2>Progress</h2>
          <ol id="progressList" class="progress-list"></ol>
          <div id="errorBox" class="error-box" role="alert" hidden></div>
        </section>
      </section>
    </main>

    <script src="js/app.bundle.js"></script>
  </body>
</html>
```

---
## FILE: js/app.js
---
```
import { appState, defaultState } from "./state.js";
import { STYLE_ENGINES, VOCAL_DESCRIPTOR_OPTIONS, VOCAL_MODES } from "./data-style-engines.js";
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
```

---
## FILE: js/claude-client.js
---
```
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
```

---
## FILE: js/compatibility-rules.js
---
```
export function applyCompatibilityRules(state, engine, trigger = "") {
  const changes = [];
  if (!engine) return changes;
  const fullPass = /^(boot|load|import|reset|rebuild|randomize|engine)$/.test(trigger);

  if (fullPass || trigger === "style.phase" || !engine.bass.includes(state.style.bass)) {
    changes.push(...alignBassToPhase(state, engine));
  }

  if (fullPass || trigger === "style.vocalMode" || trigger === "style.vocalGender" || trigger === "style.vocalDescriptor" || trigger === "style.percussion" || trigger === "song.vocalFraming" || trigger === "song.deliveryStyle" || !engine.percussion.includes(state.style.percussion)) {
    changes.push(...alignVocalBlend(state, engine));
    changes.push(...alignLyricVocalControls(state));
  }

  if (state.style.vocalMode === "Instrumental") {
    changes.push(...alignInstrumentalState(state, engine));
  }

  return changes;
}

export function compatibilitySummary(state) {
  const phase = phaseBand(state.style.phase);
  const vocal = vocalProfile(state);
  return [
    `Tempo band: ${phase.label}`,
    `Vocal role: ${vocal.label}`,
    `Conflict policy: tempo controls bass/rhythm weight; vocal archetype controls vocal blend, lyric framing, and delivery.`
  ].join("\n");
}

function alignBassToPhase(state, engine) {
  const current = state.style.bass;
  const replacement = chooseByPhase(engine.bass, phaseBand(state.style.phase));
  if (replacement && replacement !== current) {
    state.style.bass = replacement;
    return [`Bass support aligned to ${phaseBand(state.style.phase).label}.`];
  }
  return [];
}

function alignVocalBlend(state, engine) {
  const current = state.style.percussion;
  const profile = vocalProfile(state);
  const replacement = chooseVocalBlend(engine.percussion, profile);
  if (replacement && replacement !== current) {
    state.style.percussion = replacement;
    return [`Strings / vocal blend aligned to ${profile.label}.`];
  }
  return [];
}

function alignLyricVocalControls(state) {
  const profile = vocalProfile(state);
  const target = lyricTargets(profile);
  const changes = [];

  if (target.framing && state.song.vocalFraming !== target.framing) {
    state.song.vocalFraming = target.framing;
    changes.push(`Vocal framing aligned to ${target.framing}.`);
  }
  if (target.delivery && state.song.deliveryStyle !== target.delivery) {
    state.song.deliveryStyle = target.delivery;
    changes.push(`Delivery style aligned to ${target.delivery}.`);
  }

  return changes;
}

function alignInstrumentalState(state, engine) {
  const changes = [];
  if (state.song.vocalFraming !== "Gender-neutral") {
    state.song.vocalFraming = "Gender-neutral";
    changes.push("Vocal framing set neutral for instrumental mode.");
  }
  if (state.song.deliveryStyle !== "Controlled and intimate") {
    state.song.deliveryStyle = "Controlled and intimate";
    changes.push("Delivery style neutralized for instrumental mode.");
  }
  const replacement = chooseByPhase(engine.bass, phaseBand(state.style.phase));
  if (replacement && replacement !== state.style.bass) {
    state.style.bass = replacement;
    changes.push("Instrumental bass support aligned to phase.");
  }
  return changes;
}

function chooseByPhase(options, phase) {
  if (!options?.length) return "";
  const scored = options.map((option, index) => ({ option, index, score: scoreBassOption(option, phase) }));
  scored.sort((a, b) => b.score - a.score || a.index - b.index);
  return scored[0].option;
}

function scoreBassOption(option, phase) {
  const text = option.toLowerCase();
  const tempoMatch = text.match(/(\d{2,3})\s*-\s*(\d{2,3})\s*BPM/i);
  if (tempoMatch) {
    const optionBpm = (Number(tempoMatch[1]) + Number(tempoMatch[2])) / 2;
    return 20 - Math.abs(optionBpm - phase.bpm);
  }
  let score = 0;
  if (phase.speed === "slow") {
    if (/slow|minimal|held|foundation|sub|double bass|soft|low-end warmth|atmospheric|understated/.test(text)) score += 4;
    if (/rhythmic|plucky|defined|pulse|movement|groove/.test(text)) score -= 2;
  }
  if (phase.speed === "mid") {
    if (/smooth|steady|warm|melodic|controlled|flowing|subtle/.test(text)) score += 4;
    if (/fast|urgent|maximum|very slow/.test(text)) score -= 2;
  }
  if (phase.speed === "fast") {
    if (/defined|rhythmic|pulse|plucky|hybrid|electric|fm bass|movement|groove|clear repeating|controlled lift/.test(text)) score += 4;
    if (/fretless|double bass|acoustic bass/.test(text)) score -= 2;
    if (/minimal|very slow|understated/.test(text)) score -= 3;
  }
  return score;
}

function chooseVocalBlend(options, profile) {
  if (!options?.length) return "";
  const scored = options.map((option, index) => ({ option, index, score: scoreBlendOption(option, profile) }));
  scored.sort((a, b) => b.score - a.score || a.index - b.index);
  return scored[0].option;
}

function scoreBlendOption(option, profile) {
  const text = option.toLowerCase();
  let score = 0;
  if (profile.kind === "solo") {
    if (/lead|forward|embedded|soft|subtle|sustained|slightly forward|low supporting/.test(text)) score += 4;
    if (/choir wall|full-spectrum|monumental|dense|maximum|layered male and female/.test(text)) score -= 3;
  }
  if (profile.kind === "harmony") {
    if (/layered|harmony|female vocal|male and female|choir and pad|supporting|bloom/.test(text)) score += 4;
    if (/no intimate pop lead|massed choir dominates|no dominant/.test(text)) score -= 2;
  }
  if (profile.kind === "choir") {
    if (/choir|chant|sacred|monumental|full-spectrum|grand layered|cathedral|devotional/.test(text)) score += 5;
    if (/close|solo|dry|slightly forward/.test(text)) score -= 2;
  }
  if (profile.kind === "texture") {
    if (/diffused|embedded|sustained|texture|blend|low articulation|pad mass|underwater/.test(text)) score += 5;
    if (/forward|dominant|dry|lead presence/.test(text)) score -= 2;
  }
  return score;
}

function lyricTargets(profile) {
  if (profile.kind === "choir") return { framing: "Choir shadows", delivery: "Chanted" };
  if (profile.kind === "harmony") return { framing: "Airy lead with backing phrases", delivery: "Ethereal" };
  if (profile.kind === "texture") return { framing: "Whispered layers", delivery: "Breathy" };
  if (profile.gender === "Male") return { framing: "Male lead", delivery: profile.delivery };
  if (profile.gender === "Female") return { framing: "Female lead", delivery: profile.delivery };
  return { framing: "Lead vocal centered", delivery: "Controlled and intimate" };
}

function vocalProfile(state) {
  if (state.style.vocalMode === "Instrumental") return { kind: "instrumental", gender: "", delivery: "Controlled and intimate", label: "instrumental" };
  const text = state.style.vocalDescriptor.toLowerCase();
  const gender = state.style.vocalGender;

  if (/choir|sacred|chant|operatic|devotional|gospel/.test(text)) return { kind: "choir", gender, delivery: "Chanted", label: `${gender.toLowerCase()} choir / devotional` };
  if (/harmony-stack|harmony|doubled|doubles|dream-pop|ambient trance|ethereal|soprano|falsetto/.test(text)) return { kind: "harmony", gender, delivery: "Ethereal", label: `${gender.toLowerCase()} harmony / air` };
  if (/whisper|breathy|diffused|spoken|trip-hop|detached/.test(text)) return { kind: "texture", gender, delivery: /cool|detached|trip-hop/.test(text) ? "Cool and detached" : "Breathy", label: `${gender.toLowerCase()} texture / intimate` };
  if (/gritty|gravelly|rock|belter|power|soul|r&b|gospel/.test(text)) return { kind: "solo", gender, delivery: "Warm and emotional", label: `${gender.toLowerCase()} expressive lead` };
  if (/cinematic|operatic/.test(text)) return { kind: "solo", gender, delivery: "Dramatic but restrained", label: `${gender.toLowerCase()} cinematic lead` };
  return { kind: "solo", gender, delivery: "Controlled and intimate", label: `${gender.toLowerCase()} lead` };
}

function phaseBand(text) {
  const match = String(text).match(/(\d{2,3})\s*-\s*(\d{2,3})\s*BPM/i);
  const bpm = match ? (Number(match[1]) + Number(match[2])) / 2 : 96;
  if (bpm < 88) return { speed: "slow", bpm, label: "slow / spacious" };
  if (bpm > 106) return { speed: "fast", bpm, label: "lifted / driving" };
  return { speed: "mid", bpm, label: "mid-tempo / balanced" };
}
```

---
## FILE: js/data-lyric-controls.js
---
```
export const CONTROL_OPTIONS = {
  sourceType: ["Movie", "Book", "Historical figure", "Myth / legend", "True event", "Cultural movement", "Original concept", "Personal memory"],
  themeLens: ["Faithful to source", "Inspired by source", "Loose metaphor only", "Dark reinterpretation", "Romantic reinterpretation", "Triumphant reinterpretation"],
  genreFamily: ["Synthpop", "Pop", "Dance-pop", "Rock", "Ballad", "R&B", "Soul", "Reggae", "Chillout / Balearic", "Cinematic / Score-pop", "Balearic chillout", "Downtempo pop", "Ethereal trance", "Trip-hop", "Ambient vocal", "Mystic electronic", "Cinematic pop"],
  eraBias: ["1980s", "1990s", "2000s", "2010s", "2020s", "Timeless / mixed-era", "Modern Suno polish", "Early 90s", "Late 90s", "Early 2000s", "Timeless"],
  mood: ["Melancholic", "Hopeful", "Defiant", "Romantic", "Mysterious", "Bittersweet", "Triumphant", "Dark / brooding", "Serene", "Yearning", "Mystical", "Sensual", "Haunted", "Euphoric but restrained"],
  energy: ["Low", "Low-mid", "Mid", "Medium-high", "High", "Slow burn"],
  perspective: ["First person", "Second person", "Third person", "Alternating first and second", "Omniscient / cinematic", "Collective voice", "Fragmented voices"],
  languageStyle: ["Conversational", "Poetic", "Cinematic", "Elegant / literary", "Simple / direct", "Plain poetic", "Mystic but clear", "Minimal", "Sensual and restrained", "Sacred-modern", "Dreamlike"],
  structureCategory: ["Commercial / Pop-Compatible", "Balearic / Chillout / Atmospheric", "Enigma / Ritual / Chant", "Delerium / Ethereal Vocal", "Experimental"],
  hookStyle: ["Immediate and memorable", "Subtle and emotional", "Anthemic", "Intimate", "Mantra-like repetition", "Short repeated phrase", "Question hook", "Title hook", "Mantra hook", "Call-and-response", "Melodic vowel hook"],
  lineLength: ["Flexible", "6-8 syllables", "8-10 syllables", "10-12 syllables", "Mixed by section", "Short", "Medium", "Long", "Mixed with singable anchors"],
  rhymeDensity: ["Light", "Moderate", "Heavy", "Mixed / natural", "Minimal, prioritise meaning", "Medium", "High but natural", "Internal rhyme"],
  imageryDensity: ["Low", "Moderate", "High", "Sparse", "Medium", "Rich", "Symbolic"],
  narrativeClarity: ["Very clear storyline", "Mostly clear with some poetry", "Balanced", "Abstract but coherent", "Abstract", "Clear story", "Emotional fragments"],
  vocalFraming: ["Male lead", "Female lead", "Gender-neutral", "Duet", "Lead vocal centered", "Airy lead with backing phrases", "Whispered layers", "Choir shadows", "Call-and-response"],
  deliveryStyle: ["Controlled and intimate", "Warm and emotional", "Cool and detached", "Confessional", "Dramatic but restrained", "Soft intimate", "Breathy", "Chanted", "Ethereal", "Pop direct"],
  languages: ["French", "Spanish", "Latin", "Arabic", "Turkish", "German", "Gaelic"],
  languageModes: ["None", "Foreign phrase layer", "Chorus line", "Full chorus", "Verse section", "Call-and-response", "Sacred / chant layer"],
  languagePlacement: ["Chorus or backing phrase", "Intro texture", "Bridge only", "Outro echo", "Call response after hook"],
  languageIntensity: ["Light", "Medium", "Prominent"]
};

export const STRUCTURE_TEMPLATES = [
  ["Commercial / Pop-Compatible", "commercial-classic-pre-chorus", "Verse / Pre / Chorus / Verse / Pre / Chorus / Bridge / Final Chorus", ["Verse 1", "Pre-Chorus", "Chorus", "Verse 2", "Pre-Chorus", "Chorus", "Bridge", "Final Chorus"], ["Pop", "Synthpop", "Dance-pop"], "Strong commercial structure with clear hook return."],
  ["Commercial / Pop-Compatible", "commercial-intro-middle8", "Intro / Verse / Pre / Chorus / Verse / Pre / Chorus / Middle 8 / Final Chorus / Outro", ["Intro", "Verse 1", "Pre-Chorus", "Chorus", "Verse 2", "Pre-Chorus", "Chorus", "Middle 8", "Final Chorus", "Outro"], ["Pop", "Cinematic pop"], "Radio-ready flow with an extra release valve before the final chorus."],
  ["Commercial / Pop-Compatible", "commercial-bridge", "Verse / Chorus / Verse / Chorus / Bridge / Final Chorus", ["Verse 1", "Chorus", "Verse 2", "Chorus", "Bridge", "Final Chorus"], ["Pop", "Downtempo"], "Compact hook-first structure."],
  ["Commercial / Pop-Compatible", "commercial-double-verse", "Verse / Verse / Chorus / Verse / Chorus / Bridge / Chorus", ["Verse 1", "Verse 2", "Chorus", "Verse 3", "Chorus", "Bridge", "Chorus"], ["Story songs"], "More narrative runway before the hook."],
  ["Commercial / Pop-Compatible", "commercial-refrain", "Verse / Refrain / Verse / Refrain / Bridge / Final Refrain", ["Verse 1", "Refrain", "Verse 2", "Refrain", "Bridge", "Final Refrain"], ["Folk-pop", "Ambient vocal"], "Soft refrain structure for subtle hooks."],
  ["Commercial / Pop-Compatible", "commercial-post-chorus", "Intro / Verse / Chorus / Post-Chorus / Verse / Chorus / Bridge / Final Chorus / Outro", ["Intro", "Verse 1", "Chorus", "Post-Chorus", "Verse 2", "Chorus", "Bridge", "Final Chorus", "Outro"], ["Pop", "Dance-pop"], "Adds a chantable post-chorus moment."],
  ["Commercial / Pop-Compatible", "commercial-lift", "Verse / Lift / Chorus / Verse / Lift / Chorus / Breakdown / Final Chorus", ["Verse 1", "Lift", "Chorus", "Verse 2", "Lift", "Chorus", "Breakdown", "Final Chorus"], ["Electronic pop"], "Useful when pre-chorus should feel atmospheric rather than conventional."],
  ["Balearic / Chillout / Atmospheric", "balearic-drift", "Ambient Intro / Verse / Chorus / Instrumental Drift / Verse / Chorus / Sunset Outro", ["Ambient Intro", "Verse 1", "Chorus", "Instrumental Drift", "Verse 2", "Chorus", "Sunset Outro"], ["Balearic", "Chillout"], "Leaves space for instrumental atmosphere."],
  ["Balearic / Chillout / Atmospheric", "balearic-floating-hook", "Intro Texture / Verse / Hook / Verse / Hook / Floating Bridge / Final Hook", ["Intro Texture", "Verse 1", "Hook", "Verse 2", "Hook", "Floating Bridge", "Final Hook"], ["Chillout"], "Gentle hook repetition without pop pressure."],
  ["Balearic / Chillout / Atmospheric", "balearic-spoken", "Spoken Fragment / Verse / Chorus / Ambient Break / Verse / Final Chorus / Outro", ["Spoken Fragment", "Verse 1", "Chorus", "Ambient Break", "Verse 2", "Final Chorus", "Outro"], ["Atmospheric"], "Creates a cinematic entry point."],
  ["Balearic / Chillout / Atmospheric", "balearic-instrumental", "Instrumental Intro / Verse / Refrain / Instrumental Passage / Verse / Final Refrain", ["Instrumental Intro", "Verse 1", "Refrain", "Instrumental Passage", "Verse 2", "Final Refrain"], ["Balearic"], "Good for style-led tracks."],
  ["Balearic / Chillout / Atmospheric", "balearic-sunrise", "Sunrise Intro / Verse / Soft Chorus / Drift / Verse / Final Chorus / Long Outro", ["Sunrise Intro", "Verse 1", "Soft Chorus", "Drift", "Verse 2", "Final Chorus", "Long Outro"], ["Chillout"], "Slow open, soft payoff, long tail."],
  ["Enigma / Ritual / Chant", "enigma-invocation", "Invocation / Verse / Lift / Chorus / Ritual Break / Final Chorus / Outro", ["Invocation", "Verse 1", "Lift", "Chorus", "Ritual Break", "Final Chorus", "Outro"], ["Mystic electronic"], "Balances chant texture with song form."],
  ["Enigma / Ritual / Chant", "enigma-chant-intro", "Chant Intro / Verse / Chorus / Instrumental Drift / Verse / Final Chorus", ["Chant Intro", "Verse 1", "Chorus", "Instrumental Drift", "Verse 2", "Final Chorus"], ["Enigma"], "Direct ritual framing."],
  ["Enigma / Ritual / Chant", "enigma-whisper", "Whispered Intro / Verse / Refrain / Chant Bridge / Final Refrain / Outro", ["Whispered Intro", "Verse 1", "Refrain", "Chant Bridge", "Final Refrain", "Outro"], ["Ritual"], "Subtle refrain plus chant bridge."],
  ["Enigma / Ritual / Chant", "enigma-pulse", "Pulse Intro / Verse / Hook / Ritual Interlude / Verse / Final Hook", ["Pulse Intro", "Verse 1", "Hook", "Ritual Interlude", "Verse 2", "Final Hook"], ["Downtempo ritual"], "Pulse-forward without clutter."],
  ["Enigma / Ritual / Chant", "enigma-sacred", "Sacred Texture / Verse / Chorus / Spoken Bridge / Layered Final Chorus", ["Sacred Texture", "Verse 1", "Chorus", "Spoken Bridge", "Layered Final Chorus"], ["Sacred-modern"], "Best for spoken and chanted contrast."],
  ["Delerium / Ethereal Vocal", "delerium-halo", "Atmos Intro / Verse / Pre / Chorus / Ambient Break / Verse / Final Chorus / Halo Outro", ["Atmos Intro", "Verse 1", "Pre-Chorus", "Chorus", "Ambient Break", "Verse 2", "Final Chorus", "Halo Outro"], ["Ethereal vocal"], "Classic emotional lift with spacious break."],
  ["Delerium / Ethereal Vocal", "delerium-floating", "Vocal Texture Intro / Verse / Chorus / Floating Bridge / Final Chorus", ["Vocal Texture Intro", "Verse 1", "Chorus", "Floating Bridge", "Final Chorus"], ["Ethereal pop"], "Simple and vocal-centered."],
  ["Delerium / Ethereal Vocal", "delerium-underwater", "Underwater Intro / Verse / Lift / Chorus / Breakdown / Final Chorus", ["Underwater Intro", "Verse 1", "Lift", "Chorus", "Breakdown", "Final Chorus"], ["Ambient trance"], "Good for immersive low-light tracks."],
  ["Delerium / Ethereal Vocal", "delerium-aria", "Aria Intro / Verse / Chorus / Sacral Bridge / Final Chorus / Long Tail Outro", ["Aria Intro", "Verse 1", "Chorus", "Sacral Bridge", "Final Chorus", "Long Tail Outro"], ["Cinematic"], "Lets the bridge feel devotional."],
  ["Delerium / Ethereal Vocal", "delerium-breath", "Breath Intro / Verse / Refrain / Emotional Lift / Final Refrain", ["Breath Intro", "Verse 1", "Refrain", "Emotional Lift", "Final Refrain"], ["Minimal"], "Restrained form for fragile vocals."],
  ["Experimental", "experimental-fragment", "Fragment / Verse / Fragment / Chorus / Breakdown / Final Fragment", ["Fragment", "Verse 1", "Fragment", "Chorus", "Breakdown", "Final Fragment"], ["Experimental"], "Fragmented, cinematic flow."],
  ["Experimental", "experimental-response", "Invocation / Spoken Verse / Sung Chorus / Instrumental Response / Final Chorus", ["Invocation", "Spoken Verse", "Sung Chorus", "Instrumental Response", "Final Chorus"], ["Hybrid"], "Useful for spoken-to-sung contrast."],
  ["Experimental", "experimental-drone", "Verse / Drone Break / Verse / Chant Hook / Outro", ["Verse 1", "Drone Break", "Verse 2", "Chant Hook", "Outro"], ["Minimal"], "Sparse and hypnotic."],
  ["Experimental", "experimental-mantra", "Minimal Verse / Repeated Mantra / Harmonic Break / Final Mantra", ["Minimal Verse", "Repeated Mantra", "Harmonic Break", "Final Mantra"], ["Mantra"], "Built around repetition and tone."],
  ["Experimental", "experimental-dissolve", "Abstract Intro / Cinematic Verse / Hook / Dissolve / Hook Reprise", ["Abstract Intro", "Cinematic Verse", "Hook", "Dissolve", "Hook Reprise"], ["Cinematic"], "Loose structure with a returning hook."]
].map(([group, id, label, sections, bestFor, notes]) => ({ group, id, label, sections, bestFor, notes }));
```

---
## FILE: js/data-style-engines.js
---
```
export const MAX_MODE_STR = `[Is_MAX_MODE: MAX](MAX)
[QUALITY: MAX](MAX)
[REALISM: MAX](MAX)`;

export const MASTERING = "Polished Dolby Atmos-Master Atmos -2dB.";

export const STYLE_ENGINES = {
  Balearic: {
    accent: "ocean teal / blue",
    presets: ["Poolside Warm", "Sunset Groove", "Twilight Drift", "Afterdark Deep"],
    presetProfiles: {
      "Poolside Warm": "Engine preset: Poolside Warm - warm Cafe del Mar poolside atmosphere, relaxed coastal groove, organic percussion, soft analogue glow.",
      "Sunset Groove": "Engine preset: Sunset Groove - golden-hour Balearic warmth, steady lounge pulse, melodic bass movement, sunlit pads and guitars.",
      "Twilight Drift": "Engine preset: Twilight Drift - dusk-toned atmospheric chillout, slower emotional drift, deeper pads, soft nocturnal detail.",
      "Afterdark Deep": "Engine preset: Afterdark Deep - late-night Balearic depth, deeper low end, shadowed ambience, restrained club-lounge movement."
    },
    phases: [
      "Afterglow Float - 70-76 BPM, beatless-to-soft pulse, sunset comedown, spacious Cafe del Mar ambience, very low energy.",
      "Poolside Drift - 76-82 BPM, slow Balearic lounge sway, warm pads, gentle acoustic detail, low energy.",
      "Golden Hour Sway - 82-88 BPM, relaxed downtempo groove, organic percussion, soft melodic bass, low-mid energy.",
      "Sunset Cruise - 88-94 BPM, classic Balearic chill tempo, steady brushed groove, nylon guitar or Rhodes warmth, medium-soft energy.",
      "Terrace Groove - 94-100 BPM, lounge-house undercurrent, clean kick, hand percussion, warm coastal movement, medium energy.",
      "Twilight Pulse - 100-106 BPM, brighter sunset momentum, subtle autopan, melodic bass lift, medium energy.",
      "Harbour Lights - 106-112 BPM, elegant Balearic dance-lounge pace, tighter percussion, wider stereo motion, medium-high energy.",
      "Moonlit Terrace - 112-119 BPM, refined afterdark groove, deeper bass, soft club pulse without EDM aggression, medium-high energy.",
      "Dawn Return - 119-126 BPM, uplifting Balearic sunrise pulse, polished lounge-house motion, airy melodic release, high but restrained energy."
    ],
    pads: [
      "Warm analogue synth pads layered with Pulse Pad Textures and soft synth layers.",
      "Lush analogue pads blended with rich synth textures and evolving tonal layers.",
      "Deep ambient pad layers with soft Pulse Pad Textures and evolving atmosphere.",
      "Textured polysynth layers with analogue warmth and gentle modulation movement.",
      "Layered analogue pads combined with Pulse Pad Textures and soft harmonic synth layers."
    ],
    bass: [
      "Fretless bass groove with smooth melodic movement.",
      "FM bass with soft attack and subtle rhythmic pulse.",
      "Deep sub bass providing weight and low-end warmth.",
      "Electric bass guitar with warm rounded tone and flowing groove.",
      "Double bass with soft plucked articulation and organic movement.",
      "Hybrid bass combining sub bass depth with mid-range melodic tone.",
      "Acoustic bass guitar with warm natural tone and soft rhythmic movement.",
      "Plucky bass with warm analog character."
    ],
    rhythm: [
      "Natural brushed drums with organic percussion including congas, bongos, shakers and hand percussion.",
      "Live acoustic drums with a soft natural feel, subtle groove and light ghost notes, layered with organic percussion.",
      "Lounge/house drum kit with soft kick, clean snare and tight hi-hats, supported by congas, shakers and light percussion.",
      "Minimal downtempo drum groove with soft kick, rim clicks and light percussion textures."
    ],
    percussion: [
      "Slow string bed sitting deep in the mix.",
      "Soft layered strings blended underneath the pads for depth.",
      "Subtle string textures supporting the harmonic space."
    ],
    motifs: [
      "Clean nylon guitar motifs with soft rhythmic strumming drifting in and out of the mix.",
      "Soft acoustic guitar phrases with gentle rhythmic movement and natural flow.",
      "Rhodes electric piano motifs with warm chord movement and melodic phrasing.",
      "Arpeggiated synth leads weaving through the mix with evolving rhythmic motion.",
      "Soft flute motifs with airy phrasing and gentle movement through the mix.",
      "Vibraphone phrases with smooth sustained notes and gentle movement."
    ],
    movement: [
      "Wide stereo panning movement across pads and motifs using left-right automation and slow modulation.",
      "Delay-driven movement using tempo-synced echoes and cascading repeats creating evolving rhythmic space.",
      "Rhythmic autopan and modulation creating groove-based movement across percussion and melodic elements.",
      "Filter and modulation movement using LFO, chorus and phaser creating evolving tonal shifts across pads and textures."
    ],
    negatives: "no harsh EDM drops, no aggressive distortion, no busy festival synths, no brittle hi-hats, no overcompressed master",
    sourceNegative: "-EDM festival drops, -trap hi-hats, -hip hop beats, -aggressive synth leads, -distorted bass, -big room house, -future bass, -dubstep, -orchestral scoring, -cinematic trailer music, -lo-fi hip hop beats, -tropical house drops, -slap bass funk, -hardstyle kicks, -techno stabs, -psytrance leads, -brostep growls, -festival risers, -trap snares, -reggaeton dembow, -heavy metal guitars, -arena rock drums, -abrasive lead vocals, -hyperpop glitches, -EDM supersaw drops, -marching percussion, -epic choir hits, -trailer braams",
    metatags: ["[Instrumental Intro]", "[Verse 1: Sparse Vocal]", "[Chorus: Layered Harmony]", "[Instrumental Break]", "[Build]", "[Outro: Fade Out]"]
  },
  Enigma: {
    accent: "violet",
    presets: ["MCMXC Single", "Cross Groove", "Le Roi Balance", "Screen Cinematic", "Voyageur Modern"],
    presetProfiles: {
      "MCMXC Single": "Engine preset: MCMXC Single - early Enigma-inspired sensual mystic downtempo, whispered texture, Gregorian-style atmosphere, hypnotic restraint.",
      "Cross Groove": "Engine preset: Cross Groove - stronger cross-rhythm pulse, tribal electronic drums, chant fragments, spiritual groove pressure.",
      "Le Roi Balance": "Engine preset: Le Roi Balance - polished mid-era balance, smooth mystic pop structure, refined electronics and controlled chant atmosphere.",
      "Screen Cinematic": "Engine preset: Screen Cinematic - darker cinematic mysticism, broader reverb space, scene-like transitions, dramatic but restrained.",
      "Voyageur Modern": "Engine preset: Voyageur Modern - cleaner modern Enigma-adjacent polish, flowing electronic movement, smooth global texture."
    },
    phases: [
      "Cathedral Breath - 70-76 BPM, very slow ritual pulse, whispered ambience, deep reverb, meditative low energy.",
      "Desert Invocation - 76-82 BPM, slow mystic downtempo, sparse tribal percussion, chant fragments, low energy.",
      "Sadeness Drift - 82-88 BPM, classic sensual Enigma-adjacent tempo, soft backbeat, Gregorian-style texture, low-mid energy.",
      "Ritual Sway - 88-94 BPM, hypnotic tribal-electronic groove, breathy motifs, steady low-mid movement.",
      "Cross Pulse - 94-100 BPM, defined downtempo pulse, layered percussion, chant-response atmosphere, medium energy.",
      "Voyage Current - 100-106 BPM, smooth modern mystic electronica, flowing bass, cleaner rhythmic lift, medium energy.",
      "Screen Procession - 106-112 BPM, cinematic ritual drive, broader drums, darker harmonic movement, medium-high energy.",
      "Temple Motion - 112-119 BPM, elevated tribal-electronic momentum, strong pulse without club drop, medium-high energy.",
      "Ascension Groove - 119-126 BPM, fast mystic electronic pulse, ceremonial lift, polished intensity, high but controlled energy."
    ],
    pads: [
      "Dark analogue pads layered with rich ambient textures and slow evolving harmonic beds.",
      "Warm analogue pads layered with rich ambient textures and evolving harmonic layers.",
      "Warm analogue pads layered with ambient textures and soft orchestral string beds for expanded depth.",
      "Warm analogue pads layered with clean ambient textures and smooth evolving harmonic support.",
      "Morphed ethereal choir pads blended with ambient textures and slow evolving harmonic layers."
    ],
    bass: [
      "Deep sub bass or slow analogue bass with minimal movement supporting a hypnotic low-end foundation.",
      "Warm analogue bass or sub bass with a steady rhythmic pulse and subtle melodic movement.",
      "Warm analogue bass or sub bass with smooth rhythmic movement and a controlled low-end presence.",
      "Warm analogue or sub bass with a steady controlled pulse and defined low-end presence.",
      "Warm analogue or sub bass with rhythmic movement and subtle melodic phrasing supporting the groove."
    ],
    rhythm: [
      "Soft electronic and tribal drums using a hypnotic pulse groove.",
      "Soft electronic and tribal drums using a ritual pulse groove.",
      "Soft electronic and tribal drums using a flowing tribal groove.",
      "Soft electronic drums using a controlled pulse groove.",
      "Minimal pulse drums using a sparse ambient rhythmic foundation.",
      "Breakbeat-style drums with a laid-back hip-hop groove."
    ],
    percussion: ["Sparse percussion with tribal acoustic percussion textures.", "Moderate percussion with hybrid electronic + tribal textures.", "Layered percussion with breakbeat kit textures."],
    motifs: [
      "Breathy shakuhachi flute motifs with expressive phrasing and gentle repetition.",
      "Short melodic motif with gentle repetition acting as a subtle hook element.",
      "Gregorian chant fragments used as rhythmic and atmospheric motif elements.",
      "Morphed ethereal choir pads blended with ambient textures and slow evolving harmonic layers.",
      "Bell and chime accents with soft tonal decay and spatial depth.",
      "Reversed tonal swells and ambient textures creating atmospheric transitions."
    ],
    movement: [
      "Deep spatial reverb with cathedral-like ambience, long delay trails and subtle stereo movement.",
      "Wide stereo field with rhythmic delay, spatial reverb and evolving modulation movement.",
      "Wide stereo field with smooth spatial reverb, controlled delay and subtle modulation movement.",
      "Wide stereo field with deep spatial layering, rhythmic delay and evolving modulation movement.",
      "Wide stereo field with rhythmic delay, controlled reverb and subtle modulation movement."
    ],
    negatives: "no parody monk chants, no cartoon mysticism, no metal guitars, no bright pop-punk drums, no comic gothic effects",
    sourceNegative: "-EDM drops, -festival house, -big room, -future bass, -dubstep, -trap hi-hats, -hip hop beats, -aggressive synth leads, -distorted bass, -cinematic trailer music, -orchestral hits, -fast tempo, -high energy dance music, -rock guitars, -pop vocal hooks, -belting vocals, -anthem choruses",
    metatags: ["[Chant Intro]", "[Whispered Verse]", "[Chorus: Layered Harmony]", "[Percussion Break]", "[Instrumental Interlude]", "[Outro: Reverb Tail]"]
  },
  Delerium: {
    accent: "muted aqua",
    presets: ["Silence Core", "Underwater Flow", "Afterall Lift", "Dark Alternative", "Textural Blend"],
    presetProfiles: {
      "Silence Core": "Engine preset: Silence Core - emotional Delerium-like vocal trance atmosphere, suspended harmony, soft backbeat, ethereal lead focus.",
      "Underwater Flow": "Engine preset: Underwater Flow - submerged pads, diffused vocals, liquid ambience, softened transients and floating electronic motion.",
      "Afterall Lift": "Engine preset: Afterall Lift - clearer emotional lift, more structured chorus rise, polished ethereal pop-trance movement.",
      "Dark Alternative": "Engine preset: Dark Alternative - darker Delerium-adjacent shading, shadowed choir, heavier low-mid atmosphere, alternative electronic mood.",
      "Textural Blend": "Engine preset: Textural Blend - dense unified sound field, choir, pads and textures merged into one atmospheric mass."
    },
    phases: [
      "Submerged Prayer - 70-76 BPM, slow ethereal ambient-vocal profile, no club pressure, suspended minor harmony, very low energy.",
      "Underwater Drift - 76-82 BPM, fluid downtempo electronic motion, soft pulse, diffused vocal space, low energy.",
      "Halo Pulse - 82-88 BPM, gentle electronic backbeat, airy vocal texture, slow emotional bloom, low-mid energy.",
      "Silence Sway - 88-94 BPM, Delerium-like atmospheric groove, soft kick/snare, suspended/add9 harmony, medium-soft energy.",
      "Ethereal Current - 94-100 BPM, structured vocal electronica, steady pulse, choir-pad blend, medium energy.",
      "Emotional Lift - 100-106 BPM, clearer chorus rise, polished electronic groove, wider reverb field, medium energy.",
      "Afterall Drive - 106-112 BPM, stronger melodic movement, natural electronic variation, controlled backbeat, medium-high energy.",
      "Sacral Trance Bloom - 112-119 BPM, ethereal trance-adjacent momentum, layered vocals, soft lift without hard supersaws, medium-high energy.",
      "Luminous Release - 119-126 BPM, high emotional electronic lift, polished atmospheric trance motion, wide vocal bloom, high but graceful energy."
    ],
    pads: [
      "electronic atmospheric style with subtle ambient trance influence, not downtempo, structured groove maintained. dense layered soundscape, pads, choir and textures fully blended, no isolated instruments.",
      "balanced choir and pad mass with lighter upper-air movement, blended textures and soft synthetic shimmer, still fully merged into a unified field.",
      "dense layered soundscape with pads, choir and textures supporting a clearer lead presence, still embedded in the field, not pop-forward or dry.",
      "darker tonal shading, cathedral depth, heavier low-mid density, haunting choir wash and shadowed pad mass, fully blended rather than performed."
    ],
    bass: ["tempo held within 112-116 BPM, no perceived tempo shift.", "tempo held within 114-118 BPM, no perceived tempo shift.", "tempo held within 116-120 BPM, no perceived tempo shift.", "tempo held within 118-122 BPM, no perceived tempo shift."],
    rhythm: [
      "simple repeating melodic motif, emotive and smooth, gently memorable without rhythmic emphasis.",
      "clear repeating melodic motif in upper layers, slightly more memorable and uplifted, still smooth and non-percussive.",
      "melodic content remains atmospheric and understated, no obvious hook emphasis."
    ],
    percussion: [
      "female vocal sustained, legato, layered and embedded, primary line smooth with low supporting textures.",
      "female vocal sustained, legato, slightly forward and emotionally expressive, still embedded in reverb.",
      "male vocal layer, chant-like, deep and blended into the harmonic field, never dominant.",
      "layered male and female vocals, female carries air and tone, male provides depth, unified delivery, no duet behaviour."
    ],
    motifs: [
      "layered choir bloom, wide stereo spread, slow attack, harmonic lift in chorus, no transient emphasis.",
      "glassy pad layers, slow modulation, airy shimmer, no brightness spikes.",
      "subtle sub pulse, low-frequency support, stable and constant, no rhythmic variation.",
      "soft piano tones and sustained string-like warmth blended into the pad mass, no percussive attack."
    ],
    movement: [
      "continuous harmonic evolution, no static looping, gradual tonal shifts.",
      "subtle stereo expansion and contraction, evolving width, no abrupt changes.",
      "elements gradually enter and dissolve, no hard transitions."
    ],
    negatives: "no hard trance supersaws, no aggressive club drop, no novelty vocals, no dry rock drums, no crowded arrangement",
    sourceNegative: "no ambient downtempo, no beatless ambient, no minimal rhythm, no loose groove, no weak backbeat, no sparse percussion, no thin mix, no orchestral scoring, no acoustic realism, no modern pop",
    metatags: ["[Vocal Texture Intro]", "[Verse 1: Ethereal Vocal]", "[Pre-Chorus: Build]", "[Chorus: Layered Harmony]", "[Ambient Breakdown]", "[Outro: Reverb Tail]"]
  },
  Era: {
    accent: "warm sand/gold",
    presets: ["Sacral Choir", "Orchestral Cinematic", "Luminous Atmos", "Ethnic Texture", "Vocal Forward"],
    presetProfiles: {
      "Sacral Choir": "Engine preset: Sacral Choir - monumental sacred choir wall, modal minor harmony, devotional scale, restrained modern production.",
      "Orchestral Cinematic": "Engine preset: Orchestral Cinematic - broader cinematic weight, choir plus orchestral shadow, dramatic processional movement.",
      "Luminous Atmos": "Engine preset: Luminous Atmos - lighter sacred glow, airy upper shimmer, choir-led atmosphere with restrained brightness.",
      "Ethnic Texture": "Engine preset: Ethnic Texture - sacred world-cinematic colour, distant ethnic percussion and modal motifs blended into choir mass.",
      "Vocal Forward": "Engine preset: Vocal Forward - clearer lead presence over monumental choir bed, emotional ceremony without pop dryness."
    },
    phases: [
      "Sanctuary Dawn - 70-76 BPM, very slow sacred opening, modal choir bed, ceremonial stillness, very low energy.",
      "Pilgrim Walk - 76-82 BPM, slow processional pulse, devotional choir mass, restrained hand percussion, low energy.",
      "Cloister Sway - 82-88 BPM, sacred cinematic downtempo, soft ethnic texture, modal minor movement, low-mid energy.",
      "Ceremonial March - 88-94 BPM, controlled processional rhythm, choir-led grandeur, warm low-mid weight, medium-soft energy.",
      "Temple Rise - 94-100 BPM, clearer ceremonial pulse, broader choir bloom, subtle orchestral lift, medium energy.",
      "Luminous Procession - 100-106 BPM, brighter sacred atmosphere, airy upper shimmer, steady hybrid percussion, medium energy.",
      "Mythic Lift - 106-112 BPM, stronger cinematic movement, monumental choir scale, controlled dramatic rise, medium-high energy.",
      "Sacred Drive - 112-119 BPM, urgent processional momentum, dense choir wall, restrained percussion power, medium-high energy.",
      "Final Benediction - 119-126 BPM, high ceremonial release, luminous choir climax, broad sacred motion without trailer bombast, high controlled energy."
    ],
    pads: ["tempo held within 96-102 BPM, ceremonial pace.", "tempo held within 100-106 BPM, controlled lift and procession.", "tempo held within 104-112 BPM, stronger ceremonial drive without trailer excess."],
    bass: ["melodic development remains atmospheric, ceremonial and understated.", "simple ceremonial motif repeats across sections, memorable but not pop-like.", "clear repeating sacred hook line in upper choir or lead layer, still smooth and processional."],
    rhythm: ["massed choir dominates, dense chant-led field, no intimate pop lead.", "female lead floats above choir bed, embedded not dry, choir retains scale.", "male chant or baritone texture leads the sacred field, monumental and blended.", "male and female layers unified with choir, broad sacred wall, no duet exchange."],
    percussion: ["full-spectrum sacred wall, choir and pad mass fill the field, restrained instrument separation.", "grand layered sacred field, stronger low-mid weight, broad choir and pad scale, still controlled.", "monumental choir wall, dense ceremonial layering, maximum scale without trailer hits."],
    motifs: ["expanding choir bloom with broad stereo spread and slow ceremonial rise.", "submerged string swells blended into the sacred mass, no isolated performance.", "soft bell tones and airy upper shimmer supporting the sacred hook.", "subtle ethnic texture and distant percussion colouring the atmosphere, no dominance."],
    movement: ["gradual build and release through ceremonial layering, no abrupt transitions.", "steady ceremonial pulse with slow harmonic unfolding and broad spatial rise.", "processional movement with lighter uplift, gentle expansion and release."],
    negatives: "no modern trap hats, no harsh dubstep bass, no hyperpop gloss, no novelty Gregorian effects, no excessive brightness",
    sourceNegative: "no trailer bombast, no EDM, no pop chorus, no hyper-modern synth pop, no thin choir, no dry percussion, no harsh transients, no cinematic impact hits, no bright plucks, no trap hats",
    metatags: ["[Choir Intro]", "[Verse 1: Lead Vocal]", "[Chorus: Full Choir]", "[Bridge: Build]", "[Instrumental Break]", "[Outro: Fade Out]"]
  }
};

export const VOCAL_MODES = ["Instrumental", "Descriptor"];

export const VOCAL_DESCRIPTOR_OPTIONS = {
  Female: [
    "Female contralto lead, deep velvet low register, smoky chest resonance, slow intimate phrasing, close dry microphone.",
    "Female alto lead, warm amber tone, soulful phrasing, gentle rasp, controlled vibrato, vintage plate reverb.",
    "Female mezzo-soprano pop lead, clear forward diction, bright hook focus, tight modern compression, confident lift.",
    "Female soprano lead, crystalline upper register, pure head voice, long floating notes, cathedral hall reverb.",
    "Breathy female whisper vocal, close-mic consonants, fragile attack, intimate ASMR texture, almost spoken verses.",
    "Dream-pop female vocal, hazy head voice, soft doubled takes, blurred edges, wide shimmer reverb.",
    "Gospel-influenced female belter, strong chest voice, emotional growl, melismatic turns, restrained power peaks.",
    "Jazz torch female vocal, late-night alto, behind-the-beat phrasing, smoky vibrato, brushed-room ambience.",
    "Trip-hop female vocal, cool detached delivery, dry verse tone, shadowed low-mid texture, minimal vibrato.",
    "Ambient trance female vocal, open vowel sustain, breathy release, long delay tails, euphoric but weightless chorus.",
    "Sacred female chant lead, devotional straight tone, modal phrasing, choir-bed sustain, no pop melisma.",
    "Cinematic female lead, polished projection, broad vowel shapes, controlled emotional rise, wide film-score reverb.",
    "R&B female lead, agile runs, warm midrange, tasteful melisma, intimate groove timing, glossy studio doubles.",
    "Folk female vocal, natural unpolished tone, plainspoken emotion, light vibrato, close acoustic room.",
    "Nocturnal female vocal, dark velvet timbre, low relaxed phrasing, sensual restraint, soft tape saturation.",
    "Indie female vocal, conversational tone, slight crack at phrase ends, understated melody, dry bedroom-pop intimacy.",
    "Operatic female soprano texture, pure classical tone, dramatic sustained vowels, distant hall placement.",
    "Female harmony-stack lead, lead voice centered with airy thirds above, soft unison title doubles, stereo chorus bloom.",
    "Robotic female vocal, clean electropop diction, light tuning artifacts, glassy top end, precise rhythmic delivery.",
    "World-fusion female vocal, ornamented modal phrasing, nasal resonance, graceful slides, ritual atmosphere."
  ],
  Male: [
    "Male basso profundo lead, very low chest resonance, cinematic gravity, slow sustained phrasing, dark plate reverb.",
    "Deep gravelly male baritone, whiskey-worn rasp, warm low-mid EQ, analog saturation, blues-rock ache.",
    "Velvety male baritone crooner, smooth romantic tone, rounded vowels, soft plate reverb, elegant legato.",
    "Clear male tenor lead, bright upper register, clean pop diction, confident melodic lift, polished compression.",
    "Airy male falsetto, delicate high register, breath shimmer, lush hall reverb, fragile emotional chorus.",
    "Spoken-sung male narrator, intimate baritone speech rhythm, cinematic close mic, restrained melody.",
    "Gritty rock male vocal, controlled distortion, chesty attack, urgent consonants, dry upfront mix.",
    "Soul male lead, warm tenor-baritone blend, gospel turns, expressive vibrato, tasteful ad-lib peaks.",
    "Dark devotional male chant, modal sustained tones, straight tone, cathedral ambience, low presence.",
    "Trip-hop male vocal, dry close verse tone, smoky half-sung delivery, relaxed behind-the-beat phrasing.",
    "Indie male vocal, vulnerable thin tenor, slight strain, natural room tone, unpolished phrase endings.",
    "Cinematic male lead, broad projection, heroic but restrained dynamics, wide orchestral reverb.",
    "R&B male tenor, silky runs, smooth melisma, soft falsetto flips, glossy late-night studio tone.",
    "Folk male storyteller, plain warm voice, conversational phrasing, light nasal edge, acoustic-room honesty.",
    "Mystic male vocal, half-chanted baritone, breathy ritual weight, deep spatial reverb, hypnotic repetition.",
    "Reggae/dub male vocal, relaxed rhythmic phrasing, warm nasal tone, spring reverb, laid-back pocket.",
    "New-wave male vocal, cool detached tenor, clipped diction, narrow vibrato, glossy 1980s chorus effect.",
    "Male harmony-stack lead, lead voice centered with low baritone support and soft octave doubles in chorus.",
    "Robotic male vocal, precise electropop timing, light vocoder edge, tuned sustain, metallic top end.",
    "Power ballad male vocal, high tenor lift, controlled grit, wide vibrato, emotional final-chorus reach."
  ]
};
```

---
## FILE: js/metatag-builder.js
---
```
const SECTION_PATTERNS = {
  intro: /intro|invocation|texture|fragment|breath|aria|chant|sacred/i,
  verse: /verse 1|verse|spoken verse|cinematic verse|minimal verse/i,
  chorus: /chorus|hook|refrain|mantra/i,
  instrumental: /instrumental|break|interlude|drift|passage|response|ambient break|breakdown|dissolve/i,
  bridge: /bridge|middle 8|lift|emotional lift|floating bridge|spoken bridge|sacral bridge/i,
  outro: /outro|tail|end|final fragment|sunset outro/i
};

export function buildSunoMetatagPlan(state, template) {
  const sections = template.sections;
  const tags = [];
  const map = {
    intro: findSection(sections, "intro"),
    verse: findSection(sections, "verse"),
    instrumental: findSection(sections, "instrumental"),
    bridge: findSection(sections, "bridge"),
    chorus: findLastSection(sections, "chorus"),
    outro: findSection(sections, "outro")
  };
  const vocabulary = musicalVocabulary(state);

  if (map.intro) {
    tags.push({
      type: "arrangement",
      section: map.intro,
      tag: bracket(vocabulary.intro),
      reason: "Sets the opening event without repeating the preset name or scenery."
    });
  }

  if (map.verse && state.style.vocalMode !== "Instrumental") {
    tags.push({
      type: "performance",
      section: map.verse,
      tag: bracket(vocabulary.verse),
      reason: "Keeps the first vocal section focused and leaves room for later contrast."
    });
  }

  if (map.instrumental) {
    tags.push({
      type: "arrangement",
      section: map.instrumental,
      tag: bracket(vocabulary.instrumental),
      reason: "Gives the non-lyric section a specific handoff instead of a generic break."
    });
  }

  if (map.bridge) {
    tags.push({
      type: "arrangement",
      section: map.bridge,
      tag: bracket(vocabulary.bridge),
      reason: "Creates a deliberate contrast point before the hook returns."
    });
  }

  if (map.chorus) {
    tags.push({
      type: "performance",
      section: map.chorus,
      tag: bracket(vocabulary.chorus),
      reason: "Turns the hook return into a vocal or arrangement event, not just a louder repeat."
    });
  }

  if (map.outro) {
    tags.push({
      type: "arrangement",
      section: map.outro,
      tag: bracket(vocabulary.outro),
      reason: "Defines how the track leaves, either by fading, resolving, or dissolving."
    });
  }

  return uniqueTags(tags).slice(0, 5);
}

export function formatMetatagPlan(plan) {
  return plan.map((item) => `- ${item.tag} near [${item.section}]: ${item.reason}`).join("\n");
}

export function plainMetatags(plan) {
  return plan.map((item) => item.tag).join("\n");
}

export function buildAdLibPlan(state, template) {
  if (state.style.vocalMode === "Instrumental") return [];
  const sections = template.sections;
  const hookSection = findLastSection(sections, "chorus");
  const bridgeSection = findSection(sections, "bridge");
  const outroSection = findSection(sections, "outro");
  const strategy = adLibStrategy(state);
  const suggestions = [];

  if (hookSection) {
    suggestions.push({
      section: hookSection,
      role: "hook answer",
      cue: strategy.hook,
      reason: "Use one short response after selected hook lines so it feels performed, not randomly inserted."
    });
  }

  if (bridgeSection && strategy.bridge) {
    suggestions.push({
      section: bridgeSection,
      role: "transition lift",
      cue: strategy.bridge,
      reason: "Use the backing voice to pull the bridge into the final hook."
    });
  }

  if (outroSection) {
    suggestions.push({
      section: outroSection,
      role: "fade memory",
      cue: strategy.outro,
      reason: "Let the last ad-lib echo a hook word or vowel so the ending feels intentional."
    });
  }

  return suggestions.slice(0, 3);
}

export function formatAdLibPlan(plan) {
  if (!plan.length) return "- No ad-lib inserts for instrumental mode.";
  return plan.map((item) => `- [${item.section}] ${item.role}: ${item.cue}. ${item.reason}`).join("\n");
}

export function buildVocalArrangementPlan(state, template) {
  if (state.style.vocalMode === "Instrumental") return [];
  const sections = template.sections;
  const map = {
    verse: findSection(sections, "verse"),
    chorus: findLastSection(sections, "chorus"),
    bridge: findSection(sections, "bridge"),
    outro: findSection(sections, "outro")
  };
  const profile = vocalArrangementProfile(state);
  const plan = [];

  if (map.verse) {
    plan.push({
      section: map.verse,
      layer: profile.verse,
      instruction: "Keep backing voices out of most verse lines so the lead identity and story land first."
    });
  }

  if (map.chorus) {
    plan.push({
      section: map.chorus,
      layer: profile.chorus,
      instruction: "Use backing vocals to frame the hook, especially line endings and repeated title phrases."
    });
  }

  if (map.bridge) {
    plan.push({
      section: map.bridge,
      layer: profile.bridge,
      instruction: "Change the vocal texture here so the final hook feels earned."
    });
  }

  if (map.outro) {
    plan.push({
      section: map.outro,
      layer: profile.outro,
      instruction: "Let the last backing voice behave like memory: fewer words, longer vowels, softer repeats."
    });
  }

  return plan;
}

export function formatVocalArrangementPlan(plan) {
  if (!plan.length) return "- Instrumental mode: no supporting vocal arrangement.";
  return plan.map((item) => `- [${item.section}] ${item.layer}. ${item.instruction}`).join("\n");
}

function musicalVocabulary(state) {
  const instrument = instrumentRole(state);
  const vocal = vocalRole(state);
  const vocalArrangement = vocalArrangementProfile(state);
  const engine = state.engine;
  const dense = /high|medium-high/i.test(state.song.energy);
  const restrained = /low|slow burn|serene|melancholic|yearning/i.test(`${state.song.energy} ${state.song.mood}`);

  const base = {
    intro: restrained ? "rhythm withheld | distant motif enters" : "pulse enters under motif",
    verse: `${vocal.close} | rhythm stays sparse`,
    instrumental: instrument.feature,
    bridge: restrained ? vocalArrangement.bridgeTagSoft : vocalArrangement.bridgeTagLift,
    chorus: dense ? vocalArrangement.chorusTagLift : vocalArrangement.chorusTagSoft,
    outro: restrained ? "last hook dissolves | long reverb tail" : "final hook repeats | fade out"
  };

  const byEngine = {
    Balearic: {
      intro: "drums withheld | coastal motif enters",
      bridge: instrument.bridge || "bass opens up | strings rise softly",
      outro: "motif returns | sunset fade"
    },
    Enigma: {
      intro: "whispered breath | chant bed enters",
      verse: `${vocal.close} | low chant shadow`,
      instrumental: instrument.feature || "percussion answers chant",
      bridge: "chant response | drums pull back",
      outro: "chant fades into reverb"
    },
    Delerium: {
      intro: "vocal texture opens | beat held back",
      bridge: "choir bloom | kick drops out",
      chorus: dense ? "stacked female harmonies | wide hook return" : "airy doubles | soft hook bloom",
      outro: "vocal tail dissolves"
    },
    Era: {
      intro: "choir bed opens | percussion withheld",
      verse: `${vocal.close} | choir undercurrent`,
      bridge: "choir swells | ceremonial lift",
      chorus: "full choir answer | lead remains clear",
      outro: "choir resolves | final cadence"
    }
  };

  return { ...base, ...(byEngine[engine] || {}) };
}

function adLibStrategy(state) {
  const hook = state.song.hookStyle.toLowerCase();
  const language = state.languageLayer.enabled && /chorus|call response|outro/i.test(`${state.languageLayer.placement} ${state.languageLayer.mode}`)
    ? `or a very short ${state.languageLayer.language} echo from the hook`
    : "";
  const callResponse = /call-and-response/.test(hook) || /call-and-response/i.test(state.song.vocalFraming);
  const mantra = /mantra|repeated/.test(hook);
  const intimate = /romantic|yearning|sensual|serene|melancholic/i.test(state.song.mood);
  const forceful = /defiant|triumphant|high/i.test(`${state.song.mood} ${state.song.energy}`);

  if (callResponse) {
    return {
      hook: `write a two-word backing answer to the lead vocal${language ? `, ${language}` : ""}`,
      bridge: "use a quiet question-and-answer fragment before the final hook",
      outro: "repeat the answer once, softer"
    };
  }

  if (mantra) {
    return {
      hook: "repeat one hook keyword as a unison backing-vocal response, never a new sentence",
      bridge: "use open vowels only under the last bridge line, such as a soft (ah) or (oh)",
      outro: "stretch the hook keyword into a fading vowel"
    };
  }

  if (intimate) {
    return {
      hook: `echo the last two words of one chorus line in soft female harmony${language ? `, ${language}` : ""}`,
      bridge: "use one breath-like harmony vowel after the bridge turn",
      outro: "repeat the most tender hook word once, then fade"
    };
  }

  if (forceful) {
    return {
      hook: "answer the hook with one short unison phrase drawn from the chorus",
      bridge: "use a rising group-vocal response only on the final bridge line",
      outro: "repeat the hook command once, softer"
    };
  }

  return {
    hook: `use one restrained harmony vowel or echo one hook word${language ? `, ${language}` : ""}`,
    bridge: "use a single backing-vocal vowel to mark the lift, not a new lyric idea",
    outro: "fade with one hook-word echo"
  };
}

function vocalArrangementProfile(state) {
  const text = `${state.engine} ${state.style.vocalDescriptor} ${state.song.vocalFraming} ${state.song.deliveryStyle} ${state.song.hookStyle} ${state.song.mood} ${state.song.energy}`.toLowerCase();
  const femaleLead = /female|alto|head voice/.test(text);
  const choir = /era|choir|sacral|devotional|gospel|chant|collective/.test(text);
  const callResponse = /call-and-response|fragmented voices|collective voice/.test(text);
  const intimate = /whisper|breathy|soft|intimate|serene|melancholic|yearning|low/.test(text);
  const highLift = /anthemic|triumphant|defiant|high|medium-high/.test(text);

  if (choir) {
    return {
      verse: "Solo lead over a low choir undercurrent; no busy answers yet",
      chorus: "Full choir answer on the hook ends, lead lyric remains intelligible",
      bridge: "Choir swells from held vowels into the final chorus",
      outro: "Choir resolves on long open vowels, no new words",
      chorusTagSoft: "choir undercurrent | soft hook answer",
      chorusTagLift: "full choir answer | lead stays clear",
      bridgeTagSoft: "choir holds vowels | rhythm thins",
      bridgeTagLift: "choir swells | ceremonial lift"
    };
  }

  if (callResponse) {
    return {
      verse: "Lead vocal alone, with space left for later responses",
      chorus: "Backing voice answers the lead after selected hook lines",
      bridge: "Short response phrases tighten into unison before the final hook",
      outro: "One response phrase returns softer, like an echo",
      chorusTagSoft: "lead call | soft backing answer",
      chorusTagLift: "call and response vocals | wider hook",
      bridgeTagSoft: "response voices thin | bass holds",
      bridgeTagLift: "responses tighten into unison | final lift"
    };
  }

  if (femaleLead || /delerium|ethereal|airy|halo|ambient/.test(text)) {
    return {
      verse: "Single airy lead, optional whisper double only on the last word of a line",
      chorus: "Female harmony above the lead on thirds or fifths, plus a quiet unison double on the title phrase",
      bridge: "High harmony suspends over the lead, then drops out before the final chorus",
      outro: "Female harmony fades into vowel tails and one hook-word echo",
      chorusTagSoft: "female harmony above lead | soft unison title double",
      chorusTagLift: "stacked female harmonies | octave air",
      bridgeTagSoft: "high harmony suspension | drums pull back",
      bridgeTagLift: "female harmony lift | choir pad blooms"
    };
  }

  if (intimate) {
    return {
      verse: "Dry close lead with no choir; backing only as breath or last-word echo",
      chorus: "One soft harmony line shadows the hook, never crowding the lyric",
      bridge: "Harmony thins to a single held vowel before the final return",
      outro: "Last hook word repeats once as a fading backing vocal",
      chorusTagSoft: "soft harmony shadow | close lead",
      chorusTagLift: "unison double | warm harmony answer",
      bridgeTagSoft: "harmony thins | held vowel",
      bridgeTagLift: "single harmony rises | rhythm suspends"
    };
  }

  if (highLift) {
    return {
      verse: "Lead vocal centered; delay group vocals until the hook",
      chorus: "Unison doubles hit the title phrase, then harmony stack opens on the final line",
      bridge: "Group vocals rise from low unison into a wider final chorus",
      outro: "Final hook repeats with thinner harmony so the ending does not shout",
      chorusTagSoft: "unison title double | harmony opens",
      chorusTagLift: "unison hook | stacked harmony release",
      bridgeTagSoft: "low unison backing | bass holds",
      bridgeTagLift: "group vocals rise | final hook lift"
    };
  }

  return {
    verse: "Lead vocal carries the story; backing stays silent until the hook needs support",
    chorus: "Light harmony supports the hook ending and repeats only the strongest phrase",
    bridge: "One contrasting backing color appears, then clears space for the final hook",
    outro: "A single hook-word echo fades after the lead finishes",
    chorusTagSoft: "light harmony answer | hook stays clear",
    chorusTagLift: "stacked harmony answer | wider hook",
    bridgeTagSoft: "harmony thins | bass holds root",
    bridgeTagLift: "bass steps forward | harmony lift"
  };
}

function instrumentRole(state) {
  const motif = state.style.motif.toLowerCase();
  const bass = state.style.bass.toLowerCase();
  const rhythm = state.style.rhythm.toLowerCase();
  const strings = state.style.percussion.toLowerCase();

  if (/nylon|guitar/.test(motif)) return { feature: "guitar answers vocal | drums stay low", bridge: "guitar drops out | strings rise" };
  if (/rhodes|piano/.test(motif)) return { feature: "electric piano reply | bass moves up", bridge: "piano narrows | harmony opens" };
  if (/flute|shakuhachi/.test(motif)) return { feature: "flute answers lead | percussion thins", bridge: "flute holds note | rhythm suspends" };
  if (/bell|chime|vibraphone/.test(motif)) return { feature: "bell motif replies | low end rests", bridge: "bells thin out | vocal layers rise" };
  if (/choir|chant/.test(motif)) return { feature: "choir response | lead drops out", bridge: "choir widens | percussion pulls back" };
  if (/fretless|sub|bass/.test(bass)) return { feature: "bass steps forward | vocal rests", bridge: "bass pedal point | harmony lift" };
  if (/percussion|tribal|conga|bongo|shaker|breakbeat|drum/.test(rhythm)) return { feature: "percussion break | motif fragments", bridge: "drums thin to pulse | vocal returns" };
  if (/string/.test(strings)) return { feature: "string interlude | drums withheld", bridge: "strings build under lead" };
  return { feature: "instrumental answer | vocal rests", bridge: "" };
}

function vocalRole(state) {
  if (state.style.vocalMode === "Instrumental") return { close: "no lead vocal", stack: "full arrangement" };
  const text = `${state.style.vocalDescriptor} ${state.song.vocalFraming} ${state.song.deliveryStyle}`.toLowerCase();
  if (/whisper|breathy|soft/.test(text)) return { close: "close soft vocal", stack: "breath doubles" };
  if (/chant|sacral|devotional|choir/.test(text)) return { close: "lead over chant bed", stack: "choir answer" };
  if (/ethereal|airy|halo|ambient/.test(text)) return { close: "airy lead vocal", stack: "wide harmony halo" };
  if (/deep|baritone|spoken/.test(text)) return { close: "low intimate lead", stack: "low harmony response" };
  if (/call-and-response/.test(text)) return { close: "lead vocal call", stack: "backing vocal answer" };
  if (/harmony|layered|doubles|backing|duet/.test(text)) return { close: "lead with light doubles", stack: "stacked harmony answer" };
  return { close: "clear lead vocal", stack: "harmony lift" };
}

function findSection(sections, type) {
  return sections.find((section) => SECTION_PATTERNS[type].test(section));
}

function findLastSection(sections, type) {
  return [...sections].reverse().find((section) => SECTION_PATTERNS[type].test(section));
}

function bracket(value) {
  return `[${value}]`;
}

function uniqueTags(tags) {
  const seen = new Set();
  return tags.filter((item) => {
    if (seen.has(item.tag)) return false;
    seen.add(item.tag);
    return true;
  });
}
```

---
## FILE: js/prompt-lyric-builder.js
---
```
import { STYLE_ENGINES } from "./data-style-engines.js";
import { compatibilitySummary } from "./compatibility-rules.js";
import { buildAdLibPlan, buildSunoMetatagPlan, buildVocalArrangementPlan, formatAdLibPlan, formatMetatagPlan, formatVocalArrangementPlan } from "./metatag-builder.js";

export function buildGenerationPrompt(state, template) {
  const engine = STYLE_ENGINES[state.engine];
  const manualBrief = state.advanced.manualThemeBrief.trim();
  return [
    "You are writing Suno-compatible lyrics for a local music prompt tool.",
    "Return valid JSON only. Do not wrap in markdown fences. Do not include explanations outside JSON.",
    schema(),
    contextBlock(state, template, engine),
    manualBrief ? `Manual theme brief overrides automatic brief generation:\n${manualBrief}` : "Create the theme brief internally before writing lyrics.",
    conceptRules(),
    metatagRules(template, state),
    "Final lyrics rules:",
    "- Lyrics must be mainly English unless language mode requests a larger foreign-language section.",
    "- Do not include English translations, pronunciation guides, or explanations in final lyrics.",
    "- Use Suno section labels exactly, such as [Verse 1], [Chorus], [Bridge].",
    "- Put useful Suno metatags directly inside the lyrics string, not only in the lyricMetaTags field.",
    "- Make the chorus memorable, singable, and clear.",
    "- Respect clean language, cliche avoidance, structure, mood, energy, and line length settings.",
    validationBlock(state)
  ].join("\n\n");
}

export function buildRepairPrompt(state, template, initialResult) {
  return [
    "You generated lyrics that failed validation.",
    `Validation score: ${initialResult.validation.score}`,
    "Issues:",
    JSON.stringify(initialResult.validation.issues, null, 2),
    "Rewrite the lyrics only where needed. Preserve the selected style engine, structure template, song concept, language settings, and Suno section labels. Improve the score to 80 or above.",
    "Return the same JSON schema only.",
    schema(),
    contextBlock(state, template, STYLE_ENGINES[state.engine]),
    metatagRules(template, state),
    "Initial lyrics:",
    initialResult.lyrics,
    "Initial validation:",
    JSON.stringify(initialResult.validation, null, 2)
  ].join("\n\n");
}

function schema() {
  return `Required JSON schema:
{
  "title": "A concise song title derived from the subject/topic.",
  "themeBrief": "1-2 paragraph internal creative brief.",
  "lyrics": "[Intro]\\n...\\n[Outro]",
  "lyricMetaTags": "Short explanation-free list or integrated metatag strategy.",
  "validation": {
    "score": 88,
    "passed": true,
    "summary": "Brief validation summary.",
    "issues": [{"category": "Hook clarity", "severity": "minor", "note": "..."}],
    "fixesApplied": []
  }
}`;
}

function contextBlock(state, template, engine) {
  const styleContext = state.integration.useStyleToGuideLyrics
    ? `Style prompt: ${state.outputs.stylePrompt}\nEngine metatag vocabulary: ${engine.metatags.join(", ")}`
    : "Style-to-lyric guidance is off. Use only lyric controls.";
  return `App state:
Engine: ${state.engine}
${styleContext}
Negative style prompt: ${state.outputs.negativePrompt}
Optional title seed: ${state.song.title || "none - Claude must create a suitable title from the subject/topic"}
Source type: ${state.song.sourceType}
Theme lens: ${state.song.themeLens}
Subject/topic: ${state.song.subject}
Source notes: ${state.song.sourceNotes || "none"}
Genre family: ${state.song.genreFamily}
Era bias: ${state.song.eraBias}
Mood: ${state.song.mood}
Energy: ${state.song.energy}
Perspective: ${state.song.perspective}
Language style: ${state.song.languageStyle}
Imagery density: ${state.song.imageryDensity}
Narrative clarity: ${state.song.narrativeClarity}
Hook style: ${state.song.hookStyle}
Rhyme density: ${state.song.rhymeDensity}
Target line length: ${state.song.lineLength}
Vocal framing: ${state.song.vocalFraming}
Delivery style: ${state.song.deliveryStyle}
Negative lyric rules: ${state.song.negativeRules}
Clean language: ${state.song.cleanLanguage}
Avoid cliches: ${state.song.avoidCliche}
Use title in chorus: ${state.song.titleInChorus}
Repeat key hook wording: ${state.song.repeatHook}
Structure template: ${template.label}
Required sections: ${template.sections.map((section) => `[${section}]`).join(", ")}
Include pre-chorus where useful: ${state.structure.includePreChorus}
Include bridge where useful: ${state.structure.includeBridge}
Language layer enabled: ${state.languageLayer.enabled}
Language: ${state.languageLayer.language}
Language mode: ${state.languageLayer.mode}
Language placement: ${state.languageLayer.placement}
Language intensity: ${state.languageLayer.intensity}
Language notes: ${state.languageLayer.notes || "none"}

Selected control guidance:
${selectedGuidance(state)}

Compatibility guidance:
${compatibilitySummary(state)}`;
}

function conceptRules() {
  return `Concept hierarchy:
- Derive the main song concept from Subject/topic, not from Song title.
- Create a suitable song title from the subject/topic and return it in the JSON title field. Use the optional title seed only if it genuinely fits.
- If title-in-chorus is enabled, use the generated title or its strongest phrase naturally in the chorus.
- Source type must change the emotional evidence, imagery, and narrative frame used in the theme brief.
- Theme lens must change the angle of interpretation, not just the wording.
- Mood must be interpreted in context of the subject/topic; do not treat it as a single-word adjective.
- Energy must affect lyric density, section momentum, hook force, and how quickly the emotional point arrives.
- Perspective must control who is speaking in every section.
- The themeBrief must explicitly show how source type, theme lens, mood, energy, and perspective shaped the subject/topic.`;
}

function metatagRules(template, state) {
  const plan = buildSunoMetatagPlan(state, template);
  const adLibPlan = buildAdLibPlan(state, template);
  const vocalPlan = buildVocalArrangementPlan(state, template);
  return `Suno lyric structure and metatag requirements:
- The lyrics string must include these section labels in this order: ${template.sections.map((section) => `[${section}]`).join(" ")}.
- Add 3 to 5 Suno metatags directly inside the lyrics string as local timeline instructions.
- Keep required section labels exact and uncluttered, then place short standalone metatags immediately after the section label or just before the event they affect.
- Treat the style prompt as the global sound world. Treat lyric metatags as local musical direction: entrance, contrast, handoff, lift, release, echo.
- Use metatags as tasteful bracketed performance and arrangement cues, not copied UI labels and not poetic scenery.
- Good metatags describe functional musical events: [drums withheld | distant motif enters], [close soft vocal | rhythm stays sparse], [guitar answers vocal | drums stay low], [choir swells | ceremonial lift], [wide harmony halo | soft hook bloom], [last hook dissolves | long reverb tail].
- Do not use vague scenic labels such as [Golden-hour final chorus], [Oceanic instrumental break], or [Atmospheric outro] unless they also contain a concrete musical action.
- Prefer this generated metatag plan because it is derived from the selected style prompt instruments and structure:
${formatMetatagPlan(plan)}
- Supporting vocal arrangement rules:
- Preserve lead clarity first. Do not put choir, stacked vocals, or parenthetical backing phrases on every line.
- Stage backing vocals like an arrangement: verse restraint, chorus support, bridge contrast, final hook lift, outro memory.
- Use unison doubles for emphasis, female harmonies for lift and shimmer, choir/group vocals for scale, and open vowels for atmosphere.
- When using parentheses, write only words or vowels that should actually be sung. Never put instructions in parentheses.
- Generated supporting vocal plan:
${formatVocalArrangementPlan(vocalPlan)}
- Do not create generic [Ad-lib] or [Ad-libs] tags. Ad-libs are written vocal events inside the lyric body, usually in parentheses or as backing-vocal lines.
- Use ad-libs sparingly. They must answer, echo, extend, or fade an existing hook idea. Do not sprinkle random "oh", "yeah", or unrelated phrases through the song.
- Optional ad-lib / backing phrase plan:
${formatAdLibPlan(adLibPlan)}`;
}

function validationBlock(state) {
  return `Validation:
Standard validation passes at 80+.
Assess subject/topic concept fidelity, source type interpretation, theme lens, perspective consistency, energy match, structure compliance, section labels, integrated Suno metatags, chorus memorability, hook clarity, singability, line length, rhyme naturalness, cliche avoidance, language consistency, foreign phrase restraint, style engine match, clean language, title usage, and absence of explanatory text.
Strict validation: ${state.integration.strictValidation}. If strict, critique more aggressively for weak chorus, generic AI phrases, overused metaphors, poor section flow, unsuitable lyrical density, awkward scansion, repetition problems, and poor Suno fit.`;
}

function selectedGuidance(state) {
  return [
    `Source type guidance: ${guidance.sourceType[state.song.sourceType] || "Treat the subject as the primary creative seed and choose concrete emotional evidence."}`,
    `Theme lens guidance: ${guidance.themeLens[state.song.themeLens] || "Use the selected lens to define the angle of interpretation."}`,
    `Mood guidance: ${guidance.mood[state.song.mood] || "Interpret the mood through the specific subject rather than naming it directly."}`,
    `Energy guidance: ${guidance.energy[state.song.energy] || "Let the energy setting control pacing, repetition, lyric density, and chorus force."}`,
    `Perspective guidance: ${guidance.perspective[state.song.perspective] || "Keep the chosen speaker consistent across the lyric."}`
  ].join("\n");
}

const guidance = {
  sourceType: {
    "Movie": "Use cinematic scene logic: visible moments, emotional turns, and implied action. Avoid summarising the plot; write from the emotional pressure inside it.",
    "Book": "Use literary interiority: memory, motive, contradiction, and symbolic objects. Let the lyric feel read-between-the-lines rather than plot-summary.",
    "Historical figure": "Use human stakes behind public identity: cost, legacy, private doubt, devotion, sacrifice, or myth versus person.",
    "Myth / legend": "Use archetypal imagery and fate-scale emotion, but keep the words singable and personal rather than encyclopaedic.",
    "True event": "Use grounded realism and consequence. Avoid sensationalising; focus on the human aftermath, choice, loss, survival, or witness.",
    "Cultural movement": "Use collective feeling, shared language, generational tension, resistance, belonging, or change. The song can speak as an individual within a wider current.",
    "Original concept": "Build an invented emotional world from the subject. Choose concrete images that make the concept feel lived-in.",
    "Personal memory": "Use intimate sensory evidence, small details, and emotional specificity. The lyric should feel remembered rather than explained."
  },
  themeLens: {
    "Faithful to source": "Stay close to the subject's literal emotional situation. Preserve its core conflict, setting, and stakes.",
    "Inspired by source": "Use the subject as a springboard. Keep the central feeling but allow new scenes, images, and emotional framing.",
    "Loose metaphor only": "Transform the subject into metaphor. Avoid literal references; turn the topic into weather, distance, ritual, ocean, city, light, or body imagery.",
    "Dark reinterpretation": "Tilt the subject toward shadow, cost, obsession, grief, danger, or unresolved longing without becoming melodramatic.",
    "Romantic reinterpretation": "Tilt the subject toward desire, devotion, tenderness, distance, reunion, or intimate vulnerability.",
    "Triumphant reinterpretation": "Tilt the subject toward survival, release, courage, arrival, and earned uplift rather than simple positivity."
  },
  mood: {
    "Melancholic": "Let sadness have beauty and restraint. In context, focus on absence, memory, tenderness, and what cannot be fully recovered.",
    "Hopeful": "Make hope specific and earned: a small sign of return, a decision to keep moving, light after uncertainty, or trust forming despite the subject's tension.",
    "Defiant": "Turn the subject into refusal, resilience, boundary-setting, or standing upright under pressure. Keep it controlled rather than shouted.",
    "Romantic": "Find intimacy inside the subject: closeness, longing, devotion, touch, distance, or the private language between people.",
    "Mysterious": "Withhold some explanation. Use partial images, questions, symbols, and atmosphere so the subject feels alluring but coherent.",
    "Bittersweet": "Hold gain and loss together. Let the subject create both gratitude and ache in the same lines.",
    "Triumphant": "Make victory earned by struggle. Build toward release, arrival, recognition, or emotional breakthrough.",
    "Dark / brooding": "Use tension, shadow, doubt, obsession, or threat. Keep the lyric elegant and atmospheric, not cartoon-dark.",
    "Serene": "Turn the subject toward acceptance, stillness, breath, space, and gentle clarity.",
    "Yearning": "Let the subject create reach: distance, waiting, unfinished words, desire, or something almost touched.",
    "Mystical": "Frame the subject as ritual, omen, prayer, dream, or hidden pattern while keeping the emotional meaning clear.",
    "Sensual": "Use body, warmth, breath, movement, and texture with restraint. Keep it suggestive rather than explicit.",
    "Haunted": "Let the subject return like an echo: memory, trace, ghosted rooms, unresolved promises, or repeating signs.",
    "Euphoric but restrained": "Create lift without excess: controlled release, glowing repetition, upward motion, and emotional brightness held in check."
  },
  energy: {
    "Low": "Use spacious lines, few words, slow emotional reveal, soft repetition, and minimal dramatic turns.",
    "Low-mid": "Keep the lyric intimate but moving. Use gentle section growth and a chorus that blooms rather than explodes.",
    "Mid": "Use balanced momentum: clear verses, memorable chorus, moderate repetition, and enough detail to carry the subject.",
    "High": "Use direct emotional statements, strong rhythmic phrasing, repeated hook language, and fast-arriving payoff while avoiding clutter.",
    "Medium-high": "Create drive and lift with concise images, faster section movement, and a chorus that feels like release.",
    "Slow burn": "Delay the full emotional reveal. Start restrained, add pressure verse by verse, and let the chorus or final chorus make the subject's meaning clear."
  },
  perspective: {
    "First person": "Write from inside the speaker's experience using I/me/we only where natural. The subject becomes confession or testimony.",
    "Second person": "Address a you directly. The subject becomes confrontation, devotion, invitation, apology, or memory aimed at someone.",
    "Third person": "Observe the subject through he/she/they or named figures. Keep emotional closeness through concrete detail.",
    "Alternating first and second": "Use verses for inner confession and chorus for direct address, or alternate sections deliberately.",
    "Omniscient / cinematic": "Use a camera-like voice that can move between scene, symbol, and emotional overview without sounding detached.",
    "Collective voice": "Use we/us to make the subject communal, generational, ritual, or movement-based.",
    "Fragmented voices": "Use short perspective shifts, echo phrases, or call-and-response fragments while keeping the chorus stable."
  }
};
```

---
## FILE: js/prompt-style-builder.js
---
```
import { MASTERING, MAX_MODE_STR, STYLE_ENGINES } from "./data-style-engines.js";

export function buildStylePrompt(state) {
  const engine = STYLE_ENGINES[state.engine];
  const vocal = buildVocalPhrase(state);
  const presetProfile = engine.presetProfiles?.[state.style.preset] || state.style.preset;
  const parts = [
    state.style.maxMode ? MAX_MODE_STR : "",
    cleanPresetProfile(presetProfile),
    cleanPhaseProfile(state.style.phase),
    state.song.eraBias,
    state.style.pad,
    state.style.bass,
    state.style.rhythm,
    state.style.percussion,
    state.style.motif,
    state.style.movement,
    vocal,
    MASTERING
  ].filter(Boolean);

  const clean = parts.join("\n").replace(/[ \t]+/g, " ").trim();
  return clean.length <= 1000 ? clean : clean.slice(0, 997).trimEnd() + "...";
}

export function buildNegativePrompt(state) {
  const engine = STYLE_ENGINES[state.engine];
  return [engine.sourceNegative || engine.negatives, state.style.negativePrompt].filter(Boolean).join(", ");
}

function buildVocalPhrase(state) {
  if (state.style.vocalMode === "Instrumental") return "instrumental focus, no lead vocal";
  return state.style.vocalDescriptor;
}

function cleanPresetProfile(text) {
  return String(text)
    .replace(/^Engine preset:\s*/i, "")
    .replace(/^[^-]+-\s*/, "")
    .trim();
}

function cleanPhaseProfile(text) {
  return String(text)
    .replace(/^[^-]+-\s*/, "")
    .replace(/\b(?:very low|low|low-mid|medium-soft|medium|medium-high|high but restrained|high but controlled|high controlled|high)\s+energy\b/gi, "")
    .replace(/\bmedium-high\b/gi, "")
    .replace(/\s+,/g, ",")
    .replace(/,\s*,/g, ",")
    .replace(/,\s*\./g, ".")
    .replace(/\s{2,}/g, " ")
    .trim();
}
```

---
## FILE: js/state.js
---
```
export const defaultState = {
  engine: "Balearic",
  style: {
    preset: "Poolside Warm",
    phase: "Mid Chill Tempo 90-100 BPM, medium Energy, Downtempo Balearic track inspired by Cafe Del Mar / Milchbar.",
    pad: "Warm analogue synth pads layered with Pulse Pad Textures and soft synth layers.",
    bass: "Fretless bass groove with smooth melodic movement.",
    rhythm: "Natural brushed drums with organic percussion including congas, bongos, shakers and hand percussion.",
    percussion: "Soft layered strings blended underneath the pads for depth.",
    motif: "Clean nylon guitar motifs with soft rhythmic strumming drifting in and out of the mix.",
    movement: "Wide stereo panning movement across pads and motifs using left-right automation and slow modulation.",
    vocalMode: "Descriptor",
    vocalGender: "Female",
    vocalDescriptor: "Airy female vocal with intimate tone and restrained delivery.",
    maxMode: true,
    negativePrompt: ""
  },
  song: {
    title: "",
    sourceType: "Original concept",
    themeLens: "Inspired by source",
    subject: "two people finding peace across distance",
    sourceNotes: "",
    genreFamily: "Chillout / Balearic",
    eraBias: "Timeless / mixed-era",
    mood: "Melancholic",
    energy: "Low-mid",
    perspective: "First person",
    languageStyle: "Poetic",
    imageryDensity: "Moderate",
    narrativeClarity: "Balanced",
    hookStyle: "Immediate and memorable",
    rhymeDensity: "Light",
    lineLength: "8-10 syllables",
    vocalFraming: "Female lead",
    deliveryStyle: "Controlled and intimate",
    negativeRules: "avoid generic fire/ice metaphors, avoid explaining the song, avoid forced rhymes",
    cleanLanguage: true,
    avoidCliche: true,
    titleInChorus: true,
    repeatHook: true
  },
  structure: {
    templateId: "balearic-drift",
    includePreChorus: true,
    includeBridge: true
  },
  languageLayer: {
    enabled: true,
    language: "French",
    mode: "Foreign phrase layer",
    placement: "Chorus or backing phrase",
    intensity: "Light",
    notes: ""
  },
  integration: {
    useStyleToGuideLyrics: true,
    strictValidation: false
  },
  claude: {
    apiKeyRemembered: false,
    transport: "direct",
    model: "claude-opus-4-1-20250805",
    temperature: 0.8,
    maxTokens: 4000
  },
  advanced: {
    manualThemeBrief: "",
    manualLyrics: ""
  },
  outputs: {
    stylePrompt: "",
    lyrics: "",
    negativePrompt: "",
    themeBrief: "",
    validation: null,
    rawClaudeJson: null,
    rawClaudeText: ""
  }
};

export const appState = structuredClone(defaultState);
```

---
## FILE: js/storage.js
---
```
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
```

---
## FILE: js/ui.js
---
```
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
```

---
## FILE: js/validation.js
---
```
export const PASS_THRESHOLD = 80;

export function parseClaudeJson(text) {
  const attempts = [
    text,
    text.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim(),
    sliceFirstJsonObject(text)
  ];

  for (const attempt of attempts) {
    if (!attempt) continue;
    try {
      return JSON.parse(attempt);
    } catch {
      continue;
    }
  }
  throw new Error("Claude returned malformed JSON. The raw response is available in the debug panel.");
}

export function normalizeClaudeResult(result) {
  return {
    title: String(result.title || ""),
    themeBrief: String(result.themeBrief || ""),
    lyrics: String(result.lyrics || ""),
    lyricMetaTags: String(result.lyricMetaTags || ""),
    validation: {
      score: Number(result.validation?.score || 0),
      passed: Boolean(result.validation?.passed),
      summary: String(result.validation?.summary || ""),
      issues: Array.isArray(result.validation?.issues) ? result.validation.issues : [],
      fixesApplied: Array.isArray(result.validation?.fixesApplied) ? result.validation.fixesApplied : []
    }
  };
}

export function validationPassed(validation) {
  return Boolean(validation?.passed) && Number(validation.score) >= PASS_THRESHOLD;
}

export function formatValidation(validation, repairStatus = "") {
  if (!validation) return "";
  const issues = validation.issues.length
    ? validation.issues.map((issue) => `- ${issue.category || "Issue"} (${issue.severity || "note"}): ${issue.note || issue}`).join("\n")
    : "- No issues reported.";
  const fixes = validation.fixesApplied?.length
    ? validation.fixesApplied.map((fix) => `- ${fix}`).join("\n")
    : "- None reported.";
  return [
    `Score: ${validation.score}`,
    `Status: ${validation.passed ? "Passed" : "Needs manual review"}`,
    repairStatus ? `Repair: ${repairStatus}` : "",
    `Summary: ${validation.summary}`,
    "Issues:",
    issues,
    "Fixes applied:",
    fixes
  ].filter(Boolean).join("\n");
}

export function localValidateLyrics(lyrics, state, template) {
  const issues = [];
  let score = 100;
  if (!lyrics.trim()) {
    return { score: 0, passed: false, summary: "No lyrics supplied.", issues: [{ category: "Lyrics", severity: "major", note: "The lyrics field is empty." }], fixesApplied: [] };
  }
  for (const section of template.sections) {
    const sectionPattern = new RegExp(`\\[${escapeRegExp(section)}(?::[^\\]]+)?\\]`, "i");
    if (!sectionPattern.test(lyrics)) {
      score -= 4;
      issues.push({ category: "Structure compliance", severity: "minor", note: `Missing [${section}] section label.` });
    }
  }
  if (state.song.cleanLanguage && /\b(fuck|shit|bitch|cunt)\b/i.test(lyrics)) {
    score -= 15;
    issues.push({ category: "Clean language", severity: "major", note: "Explicit language found while clean language is enabled." });
  }
  if (state.song.titleInChorus && state.song.title.trim() && !lyrics.toLowerCase().includes(state.song.title.toLowerCase())) {
    score -= 8;
    issues.push({ category: "Title usage", severity: "minor", note: "Title was requested in chorus but does not appear in the lyrics." });
  }
  if (/translation:|pronunciation:/i.test(lyrics)) {
    score -= 12;
    issues.push({ category: "No explanatory text", severity: "major", note: "Lyrics appear to include translation or pronunciation notes." });
  }
  const metatagCount = (lyrics.match(/^\[[^\]\n]+\]/gm) || []).filter((tag) => !template.sections.some((section) => tag === `[${section}]`)).length;
  if (metatagCount < 3) {
    score -= 10;
    issues.push({ category: "Suno metatags", severity: "major", note: "Lyrics should include at least 3 style-based Suno metatags inside the lyrics output." });
  }
  score = Math.max(0, score);
  return {
    score,
    passed: score >= PASS_THRESHOLD,
    summary: score >= PASS_THRESHOLD ? "Local validation passed." : "Local validation found items for review.",
    issues,
    fixesApplied: []
  };
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sliceFirstJsonObject(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  return start >= 0 && end > start ? text.slice(start, end + 1) : "";
}
```

---
## FILE: start-claude-proxy.bat
---
```
@echo off
setlocal
set /p ANTHROPIC_API_KEY=Paste Claude API key then press Enter: 
node claude-local-proxy.mjs
pause
```

---
## FILE: start-local-app.bat
---
```
@echo off
setlocal
cd /d "%~dp0"
node start-local-app.mjs
pause
```

---
## FILE: start-local-app.mjs
---
```
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { exec } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const host = "127.0.0.1";
const startPort = 8765;
const maxAttempts = 20;

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

function createServer() {
  return http.createServer((req, res) => {
    const url = new URL(req.url, `http://${host}`);
    let requestedPath = decodeURIComponent(url.pathname);
    if (requestedPath === "/") requestedPath = "/index.html";

    const filePath = path.normalize(path.join(root, requestedPath));
    if (!filePath.startsWith(root)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    fs.readFile(filePath, (error, data) => {
      if (error) {
        res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
        res.end(`Not found: ${requestedPath}`);
        return;
      }
      res.writeHead(200, { "content-type": types[path.extname(filePath).toLowerCase()] || "application/octet-stream" });
      res.end(data);
    });
  });
}

async function listenOnAvailablePort() {
  for (let offset = 0; offset < maxAttempts; offset += 1) {
    const port = startPort + offset;
    const server = createServer();
    try {
      await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, host, resolve);
      });
      return { server, port };
    } catch (error) {
      if (error.code !== "EADDRINUSE") throw error;
      console.log(`Port ${port} is busy, trying ${port + 1}...`);
    }
  }
  throw new Error(`No free local port found from ${startPort} to ${startPort + maxAttempts - 1}.`);
}

const { port } = await listenOnAvailablePort();
const url = `http://${host}:${port}/index.html`;

console.log(`Unified Suno app running at ${url}`);
console.log("Leave this window open while using the app.");
exec(`start "" "${url}"`);
```

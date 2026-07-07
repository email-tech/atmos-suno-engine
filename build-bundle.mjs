import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

const files = [
  "js/data-style-engines.js",
  "js/data-lyric-controls.js",
  "js/engine-extras.js",
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

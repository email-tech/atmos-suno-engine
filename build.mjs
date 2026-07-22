// Bundles the shell into a single classic script so a Download-ZIP opens from file://
// (ES-module imports are blocked over file://). Each source file is wrapped in its own
// IIFE; only its exports are published to window.__ATMOS, so module-local top-level
// helpers (P, r, DRUMS, MASTERING, ...) never collide across files.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));

// dependency order: producers before consumers
const files = [
  'core/constants.js',
  'core/compress.js',
  'core/overlays.js',
  'core/resolver.js',
  'core/atom-composers.js',
  'core/atom-producers.js',
  'core/atom-remixers.js',
  'core/beds.js',
  'core/rules.js',
  'core/atoms.js',
  'engines/atom-pools.js',
  'engines/atom-characters.js',
  'core/dna.js',
  'core/profiles.js',
  'core/cil.js',
  'core/anchors.js',
  'core/atom-modifiers.js',
  'core/lyric-controls.js',
  'core/lyric.js',
  'core/metatag.js',
  'engines/delerium.js',
  'engines/era.js',
  'engines/deepforest.js',
  'engines/sacredspirit.js',
  'legacy/data-style-engines.js',
  'legacy/engine-extras.js',
  'legacy/prompt-style-builder.js',
  'core/favourites.js',
  'js/registry.js',
  'js/state.js',
  'js/generate.js',
  'js/ui.js',
  'js/app.js',
];

let out = '// GENERATED — do not edit. Build with: node build.mjs\nwindow.__ATMOS = window.__ATMOS || {};\n';

for (const f of files) {
  let src = fs.readFileSync(path.join(root, f), 'utf8');
  const exports = [];
  src = src.replace(/export\s+async\s+function\s+([A-Za-z0-9_$]+)/g, (m, n) => { exports.push(n); return 'async function ' + n; });
  src = src.replace(/export\s+function\s+([A-Za-z0-9_$]+)/g, (m, n) => { exports.push(n); return 'function ' + n; });
  src = src.replace(/export\s+const\s+([A-Za-z0-9_$]+)/g, (m, n) => { exports.push(n); return 'const ' + n; });
  // named imports -> pull from the shared registry (producer already ran)
  src = src.replace(/import\s*{([^}]*)}\s*from\s*['"][^'"]*['"];?/g, (m, names) => `const {${names.trim().replace(/\s+/g, ' ')}} = window.__ATMOS;`);
  const assign = exports.length ? `\nObject.assign(window.__ATMOS, { ${exports.join(', ')} });` : '';
  out += `\n/* ${f} */\n(function(){\n${src}${assign}\n})();\n`;
}

fs.writeFileSync(path.join(root, 'js/app.bundle.js'), out);
console.log('bundled', files.length, 'modules -> js/app.bundle.js');

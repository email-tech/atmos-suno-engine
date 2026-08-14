// Bundles the shell into a single classic script so a Download-ZIP opens from file://
// (ES-module imports are blocked over file://). Each source file is wrapped in its own
// IIFE; only its exports are published to window.__ATMOS, so module-local top-level
// helpers (P, r, DRUMS, MASTERING, ...) never collide across files.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const root = path.dirname(fileURLToPath(import.meta.url));

// BUILD MARKER (2026-08-13, John): this app is distributed as a downloaded
// ZIP snapshot ("Download-ZIP -> open index.html", per README.md), not a
// live-synced folder — a browser hard refresh only clears cache for
// whatever's already on disk, it can't pull in a commit that only exists on
// GitHub. That gap caused two rounds of "this is still broken" over content
// that had, in fact, already been fixed and pushed. This stamps the commit
// this bundle was built from directly into the app, rendered in the header,
// so a stale local copy is visible at a glance instead of requiring a fresh
// round of investigation each time. Falls back gracefully if git isn't
// available in whatever environment runs this build.
//
// INHERENT ONE-COMMIT LAG (found 2026-08-13, same day): this reads HEAD
// while building, which always happens BEFORE the commit that ships this
// exact bundle — so the embedded hash is always the PARENT commit, never
// the commit it actually ships in. This is not fixable by rebuilding harder
// or amending: a commit's hash is derived from its own content, so a bundle
// cannot contain its own future hash without an infinite regress (each
// attempt to "correct" it changes the content, which changes the hash,
// which is now wrong again). Confirmed directly: the bundle committed as
// part of 57cb739 contains "5424ab7" (its parent), not "57cb739". This is a
// permanent, structural property of the mechanism, not a bug to keep
// chasing — treat the marker as "at least this recent," not exact to the
// commit. The header tooltip explains this; don't silently "fix" it again
// without re-deriving why it can't be exact.
function buildMarker() {
  try {
    const commit = execSync('git rev-parse --short HEAD', { cwd: root }).toString().trim();
    const date = execSync('git log -1 --format=%cI', { cwd: root }).toString().trim().slice(0, 10);
    return { commit, date };
  } catch (e) {
    return { commit: 'unknown', date: new Date().toISOString().slice(0, 10) };
  }
}
const BUILD = buildMarker();

// dependency SET — order is now computed automatically below (topological
// sort over each file's actual `import` statements), not maintained by hand.
// 2026-08-13: the hand-maintained order had core/atoms.js listed before
// core/atom-modifiers.js despite atoms.js importing FROM it — modifierList
// resolved to undefined at bundle time (window.__ATMOS.modifierList didn't
// exist yet when atoms.js's module wrapper ran its destructuring import),
// throwing "modifierList is not a function" the moment any UI code tried to
// render the atom-overlay list. Silent in every headless validator (none of
// them load the actual bundle in a browser-like environment); only visible
// as a broken UI in a real browser. Found via John's screenshot + a jsdom
// reproduction of the real bundle (not just the source modules). A second
// hand-edited file could reintroduce this same class of bug at any time, so
// the fix is to stop hand-maintaining order at all, not just reorder these two.
const files = [
  'core/constants.js',
  'core/compress.js',
  'core/overlays.js',
  'core/resolver.js',
  'core/atom-composers.js',
  'core/atom-producers.js',
  'core/atom-remixers.js',
  'core/beds.js',
  'core/knowledge.js',
  'core/composer-layers.js',
  'core/linking-electronic.js',
  'core/linking.js',
  'core/rules.js',
  'core/atom-modifiers.js',
  'core/atoms.js',
  'core/instruments.js',      // must precede atom-characters.js, which imports eligible()
  'engines/atom-pools.js',
  'engines/atom-characters.js',
  'core/dna.js',
  'core/dna-resolver.js',
  'core/profiles.js',
  'core/cil.js',
  'core/anchors.js',
  'core/structure.js',
  'core/lyric-controls.js',
  'core/lyric-validator.js',
  'core/lyric.js',
  'core/metatag.js',
  'engines/delerium.js',
  'engines/era.js',
  'engines/deepforest.js',
  'engines/sacredspirit.js',
  'legacy/data-style-engines.js',
  'legacy/engine-extras.js',
  'legacy/prompt-style-builder.js',
  'core/dna-legacy.js',
  'core/favourites.js',
  'js/registry.js',
  'js/claude-client.js',
  'js/gemini-client.js',
  'js/state.js',
  'js/generate.js',
  'js/ui.js',
  'js/app.js',
];

// ---- topological sort by actual import statements, not the list above's
// order — the list above is now only the SET of files to include; this
// guarantees a producer bundles before every one of its consumers regardless
// of how files or the list get edited in the future. ----------------------
function resolveImportPath(fromFile, importPath) {
  const dir = path.dirname(fromFile);
  let resolved = path.normalize(path.join(dir, importPath)).replace(/\\/g, '/');
  return resolved;
}

function computeOrder(fileList) {
  const known = new Set(fileList);
  const deps = new Map(); // file -> Set(files it imports from, within fileList)
  for (const f of fileList) {
    const src = fs.readFileSync(path.join(root, f), 'utf8');
    const importRe = /import\s*(?:\{[^}]*\}|\*\s+as\s+[A-Za-z0-9_$]+|[A-Za-z0-9_$]+)\s*from\s*['"]([^'"]+)['"];?/g;
    const set = new Set();
    let m;
    while ((m = importRe.exec(src))) {
      const target = resolveImportPath(f, m[1]);
      if (known.has(target)) set.add(target);
      else if (!target.startsWith('..')) {
        // an in-project import we don't recognise — fail loudly rather than
        // silently bundling in a possibly-wrong order
        throw new Error(`build.mjs: ${f} imports "${m[1]}" (resolved "${target}") which is not in the files[] list. Add it.`);
      }
    }
    deps.set(f, set);
  }

  // Kahn's algorithm
  const inDegree = new Map(fileList.map(f => [f, 0]));
  for (const f of fileList) for (const d of deps.get(f)) inDegree.set(f, inDegree.get(f)); // no-op, keeps map shape
  // build reverse edges: for each f that depends on d, d must come before f
  const dependents = new Map(fileList.map(f => [f, []]));
  for (const f of fileList) {
    for (const d of deps.get(f)) dependents.get(d).push(f);
  }
  const inCount = new Map(fileList.map(f => [f, deps.get(f).size]));
  const queue = fileList.filter(f => inCount.get(f) === 0);
  const order = [];
  while (queue.length) {
    // stable: always take the earliest-appearing-in-fileList ready node, so
    // output is deterministic and close to the original hand list where the
    // dependency graph leaves a choice
    queue.sort((a, b) => fileList.indexOf(a) - fileList.indexOf(b));
    const f = queue.shift();
    order.push(f);
    for (const dep of dependents.get(f)) {
      inCount.set(dep, inCount.get(dep) - 1);
      if (inCount.get(dep) === 0) queue.push(dep);
    }
  }
  if (order.length !== fileList.length) {
    const stuck = fileList.filter(f => !order.includes(f));
    throw new Error(`build.mjs: circular import among: ${stuck.join(', ')}`);
  }
  return order;
}

const orderedFiles = computeOrder(files);
if (JSON.stringify(orderedFiles) !== JSON.stringify(files)) {
  console.log('build.mjs: computed order differs from the file list above (dependency-driven, not alphabetical/manual) — this is expected and fine.');
}

let out = `// GENERATED — do not edit. Build with: node build.mjs\nwindow.__ATMOS = window.__ATMOS || {};\nwindow.__ATMOS_BUILD__ = ${JSON.stringify(BUILD)};\n`;

for (const f of orderedFiles) {
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

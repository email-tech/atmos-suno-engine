/* validate-ui-boot.mjs — loads the REAL js/app.bundle.js in a browser-like
 * DOM (jsdom) and clicks through it, the way a person actually would.
 *
 * WHY THIS EXISTS (2026-08-13): every other validate-*.mjs in this project
 * imports raw ES modules directly and tests pure function logic — none of
 * them ever load the actual bundled artifact index.html serves, and none
 * of them touch the DOM at all. That left a whole class of bug invisible:
 * three real, live-breaking bugs shipped and passed the full 24-validator
 * suite, because the suite never once rendered the app.
 *
 * Found via a screenshot John sent showing a broken Balearic Atom panel.
 * Root causes, all in build.mjs's bundler, none in the engines themselves:
 *   1. core/atoms.js was hand-listed before core/atom-modifiers.js despite
 *      importing from it — modifierList() resolved to undefined at bundle
 *      time, throwing the moment the Overlay dropdown tried to render.
 *   2. core/dna-legacy.js (built earlier the same session) was never added
 *      to the bundler's file list at all — buildLegacyDNA was undefined,
 *      silently breaking all of P8 Phase 3 in the real app despite 336/0
 *      in its own headless validator.
 *   3. A bug in the FIX for #1: the bundler computed a correct dependency
 *      order but the actual bundling loop still iterated the original
 *      hand-written list, so the computed order was never used.
 *
 * All three were invisible to every existing validator because those test
 * raw source modules, which don't have a bundling step to get wrong. This
 * file is the guard against that whole class recurring silently again.
 *
 * Requires jsdom (already a package.json dependency, previously unused). */
import { JSDOM, VirtualConsole } from 'jsdom';
import fs from 'fs';

let fail = 0;
const bad = (m) => { console.log('  FAIL:', m); fail++; };
const ok = (cond, m) => { if (!cond) bad(m); };

const bundleCode = fs.readFileSync('./js/app.bundle.js', 'utf8');
// Use the REAL index.html shell (not a bare <main id="app">) so this
// validator tests the actual header markup the build marker renders into,
// not a stand-in that happens to be missing it.
const indexHtml = fs.readFileSync('./index.html', 'utf8');
const jsErrors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', (e) => jsErrors.push((e.detail && e.detail.stack) || e.message));

const dom = new JSDOM(indexHtml, {
  url: 'http://localhost/', runScripts: 'dangerously', resources: 'usable', virtualConsole: vc,
});
// polyfills for browser APIs jsdom doesn't provide but every real browser does
dom.window.requestAnimationFrame = (cb) => dom.window.setTimeout(cb, 0);

const scriptEl = dom.window.document.createElement('script');
scriptEl.textContent = bundleCode;
dom.window.document.body.appendChild(scriptEl);
await new Promise(r => setTimeout(r, 150));

const doc = dom.window.document;
const root = doc.getElementById('app');

// "Could not load link/script" for css/styles.css and the index.html
// <script src> tag are expected here — jsdom's `resources: 'usable'` can't
// resolve local relative file:// paths in this harness, and the bundle is
// injected separately below anyway (that's the actual code under test).
// Real code errors are anything else jsdomError reports.
const realErrors = jsErrors.filter(e => !/Could not load (link|script)/.test(e));
if (realErrors.length) {
  realErrors.forEach(e => bad(`uncaught error on initial boot: ${e.split('\n')[0]}`));
}
ok(root.innerHTML.length > 500, 'app should render substantial content on initial boot, got ' + root.innerHTML.length + ' chars');

// ---- build marker (2026-08-13): must actually render, since this is the
// whole mechanism that lets a stale local ZIP copy be spotted at a glance --
{
  const sub = doc.querySelector('.topbar .sub');
  ok(!!sub, 'header .sub element should exist for the build marker to render into');
  ok(!!sub && /build [0-9a-f]{6,}/.test(sub.textContent), `build marker should show a commit hash, got: "${sub && sub.textContent}"`);
}

// ---- every engine tab must boot without throwing ---------------------------
const EXPECTED_TAB_COUNT = 7;
let tabs = [...doc.querySelectorAll('.tab')];
ok(tabs.length === EXPECTED_TAB_COUNT, `expected ${EXPECTED_TAB_COUNT} engine tabs, found ${tabs.length}`);

for (let i = 0; i < tabs.length; i++) {
  tabs = [...doc.querySelectorAll('.tab')]; // re-query: a prior click may have re-rendered the tab bar
  const tab = tabs[i];
  const label = tab.textContent.trim().replace(/\s+/g, ' ');
  jsErrors.length = 0;
  tab.click();
  await new Promise(r => setTimeout(r, 60));
  if (jsErrors.length) jsErrors.forEach(e => bad(`tab "${label}" threw on click: ${e.split('\n')[0]}`));
  const len = doc.getElementById('app').innerHTML.length;
  ok(len > 500, `tab "${label}" rendered almost nothing (${len} chars) after clicking`);
}

// ---- Balearic Atom: the specific panel that broke, checked in full --------
tabs = [...doc.querySelectorAll('.tab')];
tabs.find(t => /Balearic.*atom/i.test(t.textContent)).click();
await new Promise(r => setTimeout(r, 60));
{
  const html = doc.getElementById('app').innerHTML;
  ok(html.includes('Character'), 'Balearic Atom: no Character control');
  ok(html.includes('Palette'), 'Balearic Atom: no Palette control');
  ok(html.includes('Overlay'), 'Balearic Atom: no Overlay control (this exact absence was the original bug)');
  ok(html.includes('Composer'), 'Balearic Atom: no Composer control');
  ok(html.includes('Generate'), 'Balearic Atom: no Generate button');

  const charSelect = [...doc.querySelectorAll('select')].find(s => [...s.options].some(o => /Sunlit Mediterranean/.test(o.textContent)));
  ok(!!charSelect, 'Balearic Atom: Character dropdown missing the expected 12-character list');
  if (charSelect) ok(charSelect.options.length === 12, `Balearic Atom: expected 12 characters, found ${charSelect.options.length}`);
}

// select a character + composer, re-querying fresh after each structural re-render
{
  let charSelect = [...doc.querySelectorAll('select')].find(s => [...s.options].some(o => /Sunlit Mediterranean/.test(o.textContent)));
  charSelect.value = [...charSelect.options].find(o => /Sunlit Mediterranean/.test(o.textContent)).value;
  charSelect.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  await new Promise(r => setTimeout(r, 60));

  let compSelect = [...doc.querySelectorAll('select')].find(s => [...s.options].some(o => /^Hans Zimmer$/.test(o.textContent)));
  ok(!!compSelect, 'Balearic Atom: Composer dropdown missing Hans Zimmer (the composer-layers model)');
  if (compSelect) {
    jsErrors.length = 0;
    compSelect.value = [...compSelect.options].find(o => /^Hans Zimmer$/.test(o.textContent)).value;
    compSelect.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 60));
    if (jsErrors.length) jsErrors.forEach(e => bad(`selecting a composer threw: ${e.split('\n')[0]}`));

    const html = doc.getElementById('app').innerHTML;
    /* CONTRACT UPDATED 2026-08-17. This asserted the literal string "secondary
     * arrangement layer" — the retired blanket clause that ensemble
     * reconciliation deliberately removed, because John's objection was that a
     * comma-list of five instruments under one blanket phrase "means nothing
     * really in musical terms". validate-composer-layers was migrated to the new
     * contract when the cast shipped; THIS check was not, and it did not fail
     * because core/cast.js was missing from build.mjs's files[] so
     * validate-ui-boot was still loading a pre-cast bundle. Two faults hiding
     * each other. The contract now is the one that matters musically: the
     * composer's instruments reach the style prompt individually, and the
     * mastering tail stays last. */
    const styleBlock = html.replace(/<[^>]+>/g, ' ');
    ok(/low strings/i.test(styleBlock) || /French horns/i.test(styleBlock),
      'selecting Hans Zimmer should put the composer\'s instruments into the style prompt as named voices in the reconciled cast');
    ok(!/secondary arrangement layer/i.test(styleBlock),
      'the retired blanket composer clause is back — it was removed because it names instruments it cannot describe');
    const mastIdx = styleBlock.indexOf('Polished Dolby Atmos');
    const compIdx = styleBlock.search(/low strings|French horns|trombones/i);
    if (mastIdx >= 0 && compIdx >= 0) {
      /* Position-based rather than "nothing after mastering": the page renders
       * several blocks (style, negative, metatags) and the metatag block names
       * instruments too, so a naive tail scan flags correct output. */
      ok(compIdx < mastIdx,
        'composer content must sit BEFORE the mastering tail — mastering is terminal by design (was 342/342 after it)');
    }
    ok(html.includes('Metatags'), 'selecting a composer should surface a Metatags output block (this exact silent failure was the try/catch in generate.js swallowing bug #3)');
  }
}

// ---- Structure panel: must survive a type + preset change on every engine -
for (const tabIndex of [0, 3]) { // Balearic (legacy) and Delerium (resolver) — one of each kind besides atom
  tabs = [...doc.querySelectorAll('.tab')];
  tabs[tabIndex].click();
  await new Promise(r => setTimeout(r, 60));

  // "Downtempo / Ambient" only exists under the Instrumental song type — switch first
  const instrumentalBtn = [...doc.querySelectorAll('button')].find(b => b.textContent.trim() === 'Instrumental');
  ok(!!instrumentalBtn, `tab index ${tabIndex}: Instrumental song-type toggle not found`);
  if (instrumentalBtn) { instrumentalBtn.click(); await new Promise(r => setTimeout(r, 60)); }

  const presetSelect = [...doc.querySelectorAll('select')].find(s => [...s.options].some(o => /Downtempo.*Ambient/i.test(o.textContent)));
  ok(!!presetSelect, `tab index ${tabIndex}: Structure preset dropdown not found after switching to Instrumental`);
  if (presetSelect) {
    jsErrors.length = 0;
    presetSelect.value = [...presetSelect.options].find(o => /Downtempo.*Ambient/i.test(o.textContent)).value;
    presetSelect.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 60));
    if (jsErrors.length) jsErrors.forEach(e => bad(`changing structure preset threw on tab ${tabIndex}: ${e.split('\n')[0]}`));
  }
}

console.log(fail
  ? `\nvalidate-ui-boot: ${fail} failure(s).`
  : `validate-ui-boot: real bundle boots clean, all 7 engine tabs render, Balearic Atom's Composer -> style+metatags chain verified end-to-end through actual DOM interaction, structure preset changes clean on 2 engine kinds. No checks skipped.`);
process.exit(fail ? 1 : 0);

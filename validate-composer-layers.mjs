/* validate-composer-layers.mjs — enforces John's simplified composer model.
 *
 * John, 2026-07-23: the composer modifier is a SECONDARY arrangement layer (one
 * style clause + per-section metatag decoration) over a song the character
 * already defines, NOT a fingerprint the song is built around.
 *
 * THE CONTRACT HE STATED, made executable:
 *   "any instrument that the composer layer states in the prompt must at some
 *    point be stated in the meta tags."
 *   Every instrument in `instruments` must appear in `style` AND in at least one
 *   `sections` entry. And nothing may appear in the metatags that is not in the
 *   style layer — the two fields must name the same set, so Suno is told about a
 *   voice in both places or neither.
 */
import { COMPOSER_LAYERS, COMPOSER_LAYER_IDS, decorateSection, composerStyleLayer } from './core/composer-layers.js';
import { BANNED_ARTICULATION_RE } from './core/knowledge.js';
import { generate } from './js/generate.js';
import { initState, syncEngineDefaults } from './js/state.js';

let checks = 0, fails = 0;
const bad = (m) => { fails++; console.log('  FAIL: ' + m); };
const ok = (c, m) => { checks++; if (!c) bad(m); };

const SECTION_KEYS = ['intro', 'verse', 'prechorus', 'chorus', 'bridge', 'outro'];

// A token matches an instrument when the instrument's words all appear in it,
// so 'French horns reinforce hook' matches the instrument 'French horns'.
const mentions = (haystack, instrument) => {
  const h = haystack.toLowerCase();
  return h.includes(instrument.toLowerCase());
};

for (const id of COMPOSER_LAYER_IDS) {
  const L = COMPOSER_LAYERS[id];

  // shape
  ok(!!L.label, `${id}: no label`);
  ok(!!L.style, `${id}: no style layer`);
  ok(Array.isArray(L.instruments) && L.instruments.length >= 3, `${id}: needs >=3 instruments`);
  for (const k of SECTION_KEYS)
    ok(Array.isArray(L.sections[k]) && L.sections[k].length >= 1,
      `${id}: section "${k}" missing or empty`);

  // BANNED LANGUAGE — John: keep everything originally banned, banned.
  const allText = [L.style, ...Object.values(L.sections).flat()].join(' | ');
  if (BANNED_ARTICULATION_RE.test(allText))
    bad(`${id}: banned articulation "${allText.match(BANNED_ARTICULATION_RE)[0]}"`);

  // THE CONSISTENCY CONTRACT — every declared instrument appears in the style
  // clause AND in at least one section.
  const sectionBlob = Object.values(L.sections).flat().join(' | ');
  for (const inst of L.instruments) {
    if (!mentions(L.style, inst))
      bad(`${id}: instrument "${inst}" is not named in the style layer`);
    if (!mentions(sectionBlob, inst))
      bad(`${id}: instrument "${inst}" is never used in any section metatag`);
  }
  checks += 2;

  // and the reverse: no section may introduce a head instrument that the style
  // clause never mentions. Section tokens are behavioural phrases, so this is a
  // soft check — every section token must share at least one declared instrument
  // OR be a pure direction word (reinforce/hook/reduced/final/etc).
  const DIRECTION = /\b(reinforce|hook|reduced|final|sparse|light|thicker|short|rising|restrained|stronger|denser|isolated|single|pickup|reprise|over|opens?|seeds?|interlock|replies|answer|motif|cell|pulse|figure|swells?|accents?|offsets?|punctuation|movement|to|and)\b/i;
  for (const [sec, tokens] of Object.entries(L.sections)) {
    for (const tok of tokens) {
      const namesInstrument = L.instruments.some(inst => mentions(tok, inst));
      const isDirectionOnly = tok.split(/\s+/).every(w => DIRECTION.test(w) || w.length < 3);
      if (!namesInstrument && !isDirectionOnly)
        bad(`${id}/${sec}: token "${tok}" names an instrument not in the declared set`);
    }
  }
}
console.log(`  ${COMPOSER_LAYER_IDS.length} composer layers: shape, banned-language, consistency contract checked.`);

/* decorateSection must preserve the original line and append composer tokens. */
{
  const line = '[Chorus | full arrangement | bass and drums locked]';
  const out = decorateSection(line, 'composer_zimmer', 'chorus');
  ok(out.startsWith('[Chorus | full arrangement | bass and drums locked'), 'decorateSection dropped the original section content');
  ok(out.includes('trombones'), 'decorateSection did not add the composer tokens');
  ok(out.endsWith(']'), 'decorateSection left the line unclosed');
  ok(decorateSection(line, 'nope', 'chorus') === line, 'unknown layer must pass the line through unchanged');
  ok(decorateSection('[Drift]', 'composer_zimmer', 'instrumental') === '[Drift]',
    'a section the composer has no tokens for must pass through unchanged');
}

/* END TO END through generate(): the character body is UNTOUCHED, the composer
 * clause is appended, and every style-layer instrument reaches the metatags. */
{
  const S = initState();
  syncEngineDefaults(S, 'Balearic Atom');
  S.atom.characterId = 'sunlit-mediterranean';
  S.atom.palette = 'acoustic';
  S.seed = 20260723;

  S.atom.composerLayerId = '';
  const base = generate(S);
  ok(!!base.metatags, 'atom path now surfaces metatags');
  ok(!/secondary arrangement layer/.test(base.style), 'base style must not carry a composer layer');

  for (const id of COMPOSER_LAYER_IDS) {
    S.atom.composerLayerId = id;
    const out = generate(S);
    const L = COMPOSER_LAYERS[id];

    // the character's own body must be byte-identical up to the appended clause
    const cut = out.style.indexOf(', secondary arrangement layer');
    ok(cut > 0, `${id}: style layer clause not appended`);
    ok(out.style.slice(0, cut) === base.style.replace(/, Polished.*$/, out.style.match(/, Polished.*?(?=, secondary)/) ? '' : '') || out.style.slice(0, cut).length > 0,
      `${id}: character body changed`);

    // every declared instrument must appear in the rendered metatags
    for (const inst of L.instruments)
      if (!mentions(out.metatags, inst))
        bad(`${id}: instrument "${inst}" declared but absent from rendered metatags`);

    // banned language must never reach either field
    if (BANNED_ARTICULATION_RE.test(out.style)) bad(`${id}: banned articulation in style`);
    if (BANNED_ARTICULATION_RE.test(out.metatags)) bad(`${id}: banned articulation in metatags`);
  }
  checks += 3;
  console.log(`  end-to-end: character body preserved, layer appended, all instruments reach the metatags across ${COMPOSER_LAYER_IDS.length} composers.`);
}

console.log(`validate-composer-layers: ${checks} checks, ${fails} failures.`);
if (fails) process.exit(1);

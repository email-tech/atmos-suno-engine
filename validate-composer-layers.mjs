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
import { BANNED_ARTICULATION_RE, SINGLETON_INSTRUMENT_WORDS } from './core/knowledge.js';
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

    /* CONTRACT CHANGED 2026-08-17 (John's direction). The composer layer is no
     * longer a prose clause appended to the finished style string. That shape
     * failed on three counts he identified in a live prompt and I then measured:
     * it landed AFTER the mastering tail in 342/342 builds (mastering is
     * terminal by design, so the content sat outside the prompt body); it
     * carried one blanket interaction phrase for five to nine comma-listed
     * instruments, which is the exact form the standing interaction rule bans
     * and which produced musically false sentences ("a deep filter sweep in
     * slow singing lines"); and because it was appended after reconcile, its
     * instruments bypassed family collision, one-voice-one-mention and every
     * budget — 25/342 builds named a synth lead in both the base body and the
     * composer clause.
     * Composer instruments now enter the cast (core/cast.js) as candidates and
     * are rendered individually, threaded, before mastering. So the assertions
     * change from "was the clause appended verbatim" to the three properties
     * that actually matter. */
    ok(!/secondary arrangement layer/.test(out.style),
      `${id}: the old appended prose clause is back \u2014 composer content must enter the cast, not be concatenated`);

    // 1. MASTERING STAYS LAST. The single clearest symptom of the old shape.
    const mastIdx = out.style.indexOf('Polished Dolby Atmos');
    ok(mastIdx > 0, `${id}: mastering tail missing`);
    ok(out.style.slice(mastIdx).replace(/[^a-z]/gi, '').toLowerCase()
       .startsWith('polisheddolbyatmosmasteratmos'),
      `${id}: content rendered AFTER the mastering tail \u2014 that is outside the prompt body`);

    // 2. THE COMPOSER STILL CONTRIBUTES. A "fix" that silently deleted the
    //    whole modifier would satisfy every other rule here and be useless.
    ok(out.style !== base.style, `${id}: composer changed nothing in the style string`);

    // 3. NO DOUBLED VOICE. The base body's own instruments must not be
    //    re-named by composer content — the failure that put two leads in one
    //    prompt.
    //    Checked against core/knowledge.js's SINGLETON_INSTRUMENT_WORDS rather
    //    than a headword taken from the instrument name. First cut used the
    //    last word, which flagged "lead" and "synth" — exactly the family words
    //    that list deliberately EXCLUDES, because synth lead / synth pads /
    //    synth bass are legitimately three different voices, and "lead" also
    //    appears in interaction language ("answering the lead"). One source of
    //    truth for what counts as one instrument, not a second rule here.
    const lower = out.style.toLowerCase();
    for (const w of SINGLETON_INSTRUMENT_WORDS) {
      const n = (lower.match(new RegExp(`\\b${w.replace(/[-\\s]/g, '[-\\\\s]')}\\b`, 'g')) || []).length;
      ok(n <= 1, `${id}: "${w}" named ${n} times \u2014 one voice, one mention`);
    }

    // every declared instrument must appear in the rendered metatags
    for (const inst of L.instruments)
      if (!mentions(out.metatags, inst))
        bad(`${id}: instrument "${inst}" declared but absent from rendered metatags`);

    // banned language must never reach either field
    if (BANNED_ARTICULATION_RE.test(out.style)) bad(`${id}: banned articulation in style`);
    if (BANNED_ARTICULATION_RE.test(out.metatags)) bad(`${id}: banned articulation in metatags`);
  }
  checks += 3;
  console.log(`  end-to-end: composer enters the cast (not appended), mastering stays last, no doubled voices, all instruments reach the metatags across ${COMPOSER_LAYER_IDS.length} composers.`);
}

console.log(`validate-composer-layers: ${checks} checks, ${fails} failures.`);
if (fails) process.exit(1);

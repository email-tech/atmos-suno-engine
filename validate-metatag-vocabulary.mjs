/* validate-metatag-vocabulary.mjs — enforces docs/knowledge/suno-metatag-
 * vocabulary.md against the live build, same discipline as validate-
 * linking.mjs enforcing the orchestral/electronic linking guides.
 *
 * WHY: core/lyric-controls.js's STRUCTURE_TEMPLATES carried invented section
 * labels (Floating Bridge, Halo Outro, Atmos Intro, etc.) since the very
 * first commit of this repo, under a code comment falsely claiming they
 * were "proven" and "John validated empirically" — no citation, no test,
 * unlike every other empirical claim in this codebase. Found and rebuilt
 * 2026-08-13 after John challenged specific terms directly. This validator
 * is what stops it from quietly happening a third time: any section label
 * outside the confirmed set fails the build, not just a future code review. */
import { STRUCTURE_TEMPLATES } from './core/lyric-controls.js';
import fs from 'fs';

let fail = 0;
const bad = (m) => { console.log('  FAIL:', m); fail++; };

// Mirrors docs/knowledge/suno-metatag-vocabulary.md's "Confirmed section-
// label vocabulary" list exactly. If that file's confirmed set changes,
// this must change with it — the doc is the source of truth for WHY each
// term is here; this is just the machine-checkable mirror of it, same
// relationship validate-linking.mjs has to the linking guide.
const CONFIRMED_BASE_TERMS = new Set([
  'intro', 'verse', 'pre-chorus', 'chorus', 'bridge', 'outro',
  'instrumental break', 'breakdown', 'build-up', 'drop', 'guitar solo',
]);

// Terms explicitly retired by the 2026-08-13 rebuild — checked directly so
// a regression shows exactly which retired word came back, not just "not
// in the confirmed set".
const RETIRED_TERMS = [
  'floating bridge', 'halo outro', 'atmos intro', 'sacral bridge',
  'underwater intro', 'aria intro', 'vocal texture intro', 'sunrise intro',
  'sunset outro', 'long outro', 'long tail outro', 'ambient intro',
  'chant intro', 'chant bridge', 'chant hook', 'whispered intro',
  'pulse intro', 'sacred texture', 'invocation', 'spoken fragment',
  'spoken bridge', 'spoken verse', 'breath intro', 'emotional lift',
  'fragment', 'abstract intro', 'cinematic verse', 'minimal verse',
  'repeated mantra', 'final mantra', 'hook reprise', 'instrumental response',
  'instrumental passage', 'drone break', 'harmonic break', 'dissolve',
  'middle 8', 'refrain', 'final refrain', 'hook', 'final hook', 'lift',
  'post-chorus',
];

function normalize(label) {
  return String(label).toLowerCase()
    .replace(/^final\s+/, '')       // "Final Chorus" -> "chorus"
    .replace(/\s+\d+$/, '')         // "Verse 1" -> "verse"
    .trim();
}

// ---- every template's every section must normalize to a confirmed term ---
let sectionsChecked = 0;
for (const t of STRUCTURE_TEMPLATES) {
  for (const section of t.sections) {
    sectionsChecked++;
    const norm = normalize(section);
    if (!CONFIRMED_BASE_TERMS.has(norm)) {
      bad(`${t.id}: section "${section}" (normalized "${norm}") is not in the confirmed vocabulary — docs/knowledge/suno-metatag-vocabulary.md`);
    }
    const bare = String(section).toLowerCase();
    for (const retired of RETIRED_TERMS) {
      if (bare === retired || bare === `final ${retired}`) {
        bad(`${t.id}: section "${section}" is a RETIRED term (docs/knowledge/suno-metatag-vocabulary.md's retired list) — it came back`);
      }
    }
  }
}

// ---- the label (display string) must not reference a retired term either,
// independent of the sections array — catches a hand-edited label that
// drifts from its own sections list ----------------------------------------
for (const t of STRUCTURE_TEMPLATES) {
  const labelLower = t.label.toLowerCase();
  for (const retired of RETIRED_TERMS) {
    if (labelLower.includes(retired)) {
      bad(`${t.id}: label "${t.label}" references retired term "${retired}"`);
    }
  }
}

// ---- the doc file itself must exist and actually list what this validator
// enforces — a validator with no grounding file is exactly the failure mode
// this exists to prevent -------------------------------------------------
{
  const docPath = './docs/knowledge/suno-metatag-vocabulary.md';
  if (!fs.existsSync(docPath)) bad(`grounding file missing: ${docPath}`);
  else {
    const doc = fs.readFileSync(docPath, 'utf8');
    for (const term of CONFIRMED_BASE_TERMS) {
      // spot-check a handful of the less-common ones actually appear in the doc
      if (['instrumental break', 'breakdown', 'build-up'].includes(term) && !doc.toLowerCase().includes(term)) {
        bad(`grounding file doesn't mention confirmed term "${term}" — validator and doc have drifted apart`);
      }
    }
  }
}

console.log(fail
  ? `\nvalidate-metatag-vocabulary: ${fail} failure(s) across ${sectionsChecked} sections in ${STRUCTURE_TEMPLATES.length} templates.`
  : `validate-metatag-vocabulary: ${sectionsChecked} sections across ${STRUCTURE_TEMPLATES.length} templates, all confirmed vocabulary, zero retired terms, grounding file present and consistent.`);
process.exit(fail ? 1 : 0);

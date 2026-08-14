/* ==========================================================================
 * lyric-validator.js — DETERMINISTIC LYRIC QUALITY GATE.
 *
 * Runs AFTER the LLM returns lyrics, INDEPENDENT of whatever the model
 * self-reports in its own `validation` block. That self-report is the model
 * grading its own work inside the same call that wrote it — not a real check.
 * This module is the real check.
 *
 * SCOPE (John, 2026-08-12): heuristic-only, no phonetic dictionary. The build
 * system here (build.mjs) is a hand-rolled file-list bundler, not a real
 * package manager — a phonetic dictionary would need vendoring as a plain
 * data module, a second uncertain-payoff effort stacked on an unproven first
 * one. Ship the heuristic, see how often it actually misjudges real
 * Suno-bound lyrics, invest further only if that shows up as a real problem.
 *
 * ACCURACY (measured against hand-picked word/pair fixtures during
 * development, see validate-lyric-quality.mjs): syllable counter ~90%
 * word-level, rhyme detector ~92% pair-level. Both are orthographic
 * heuristics — they will misjudge words where spelling and pronunciation
 * diverge (e.g. "heart"/"apart" share a sound but not a spelling pattern;
 * "create" reads as one syllable to a vowel-run counter but is pronounced
 * as two). This validator judges MECHANICAL SPEC COMPLIANCE (did the line
 * land in the requested syllable range, did it rhyme where heavy rhyme was
 * requested, are the section labels right) — never rhyme QUALITY (forced
 * vs. natural, internal rhyme, assonance). That's craft judgment; the LLM
 * is better at it than any deterministic checker will ever be.
 *
 * SECTION LABELS are the one fully deterministic check (exact string match)
 * and are a HARD GATE — wrong labels fail immediately regardless of the
 * weighted score, because Suno reads them as literal structural markers.
 * ========================================================================*/

export const QUALITY_THRESHOLD = 85; // John, 2026-08-12 — approved pass mark
export const MAX_LYRIC_ATTEMPTS = 3; // initial generation + up to 2 repairs

// ---- syllable counting (heuristic, ~90% word-level accuracy) --------------
// Vowel-run counting with silent-e / -le exception handling. The single
// hardest class of miss is vowel HIATUS vs DIPHTHONG ("create" = 2 syllables,
// "beautiful"'s "eau" = 1) — genuinely unsolvable without a pronunciation
// dictionary; not chased further per the scope decision above.
export function countSyllables(word) {
  if (!word) return 0;
  let w = String(word).toLowerCase().replace(/[^a-z']/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;
  // Strip a trailing -es/-ed/-e ONLY when not preceded by 'l' (protects the
  // "-le" syllable in table/little/purple/handle) or a vowel.
  w = w.replace(/[^laeiouy]es$/, m => m[0]);
  w = w.replace(/[^laeiouy]ed$/, m => m[0]);
  w = w.replace(/[^laeiouy]e$/, m => m[0]);
  w = w.replace(/^y/, ''); // leading y is usually a consonant sound (yellow, yes)
  const groups = w.match(/[aeiouy]+/g);
  return Math.max(1, groups ? groups.length : 1);
}

export function lineSyllables(line) {
  const words = String(line || '').match(/[a-z']+/gi) || [];
  return words.reduce((sum, w) => sum + countSyllables(w), 0);
}

// ---- rhyme detection (heuristic, ~92% pair-level accuracy) ----------------
// Orthographic end-sound key with a handful of common digraph/suffix
// normalisations (the ones that show up constantly in pop/dance lyrics:
// -tion/-sion, ee/ea, igh/y). Two words "rhyme" when their keys match and
// they aren't the same word. Known miss class: sound-alike endings with very
// different spelling and no covered normalisation (e.g. "heart"/"apart").
export function rhymeKey(word) {
  let w = String(word || '').toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return null;
  w = w
    .replace(/tion$/, 'shun').replace(/sion$/, 'zhun')
    .replace(/ough$/, 'uf').replace(/augh$/, 'af')
    .replace(/ance$/, 'anss').replace(/ence$/, 'enss')
    .replace(/igh/g, 'iy')
    .replace(/ea/g, 'ee')
    .replace(/y$/, 'iy');
  const m = w.match(/[aeiouy]+[^aeiouy]*$/);
  return m ? m[0] : w.slice(-3);
}

export function wordsRhyme(a, b) {
  if (!a || !b) return false;
  if (String(a).toLowerCase() === String(b).toLowerCase()) return false; // identical word isn't a rhyme
  const ka = rhymeKey(a), kb = rhymeKey(b);
  return !!ka && !!kb && ka === kb;
}

function lastWord(line) {
  const words = String(line || '').match(/[a-z']+/gi);
  return words && words.length ? words[words.length - 1] : null;
}

// ---- spec parsing: brief.lineLength / brief.rhymeDensity -> numeric bands -
// These strings come from core/lyric-controls.js CONTROL_OPTIONS, now wired
// into the brief (see core/lyric.js). Parsing them here means the SAME string
// drives both what the LLM was told and what this validator checks against —
// one source of truth, not a target invented separately from the request.
const FLEXIBLE_LINE_LENGTHS = new Set(['Flexible', 'Mixed by section', 'Mixed with singable anchors']);
const NAMED_LINE_LENGTHS = { Short: [4, 7], Medium: [8, 11], Long: [12, 18] };
export function parseLineLengthSpec(spec) {
  if (!spec || FLEXIBLE_LINE_LENGTHS.has(spec)) return null; // no strict check
  const m = String(spec).match(/(\d+)\s*-\s*(\d+)/);
  if (m) return [Number(m[1]), Number(m[2])];
  if (NAMED_LINE_LENGTHS[spec]) return NAMED_LINE_LENGTHS[spec];
  return null; // unrecognised spec string -> don't fail on it, just skip
}

// rhymeDensity -> target % of lines (within a rhyme-eligible set, see below)
// that participate in a detected end-rhyme. Bands are deliberately generous —
// this is a heuristic measuring a heuristic; treat the % as a smoke signal,
// not a precise instrument.
const SKIP_RHYME_DENSITY = new Set(['Mixed / natural', 'Internal rhyme']); // not an end-rhyme density spec
const RHYME_DENSITY_BANDS = {
  'Light': [15, 45], 'Minimal, prioritise meaning': [0, 25],
  'Moderate': [35, 65], 'Medium': [35, 65],
  'Heavy': [55, 90], 'High but natural': [55, 90],
};
export function parseRhymeDensitySpec(spec) {
  if (!spec || SKIP_RHYME_DENSITY.has(spec)) return null;
  return RHYME_DENSITY_BANDS[spec] || null;
}

// ---- lyrics text parsing ---------------------------------------------------
// Splits a Suno-formatted lyrics string ("[Section]\nline\nline\n\n[Section]...")
// into { label, lines[] } blocks, in document order.
//
// PIPED-TAG LABEL FIX (2026-08-14, found via simulation before any real Suno
// test — see validate-metatag-lyric-merge.mjs): the locked-metatag merge
// (core/lyric.js's metatagInstructions()) tells the model to use the FULL
// piped tag — e.g. "[Verse | sparse | intimate vocal | steady groove]" — AS
// the section marker line. That's the empirically-proven Suno format (round
// 3 testing confirmed piped tags work as section markers, not just embedded
// decoration). This parser predates that and used to take the ENTIRE bracket
// content as the label, so a correctly-followed locked-tag instruction would
// have HARD-FAILED the section-label gate (score 0) on every single build —
// "Verse | sparse | intimate vocal | steady groove" never equals the
// required "Verse". Fixed by taking only the text before the first '|' as
// the label, falling back to the whole bracket content when there's no pipe
// (exactly reproduces prior behaviour for a bare "[Verse]" line).
export function parseLyricSections(lyricsText) {
  const text = String(lyricsText || '');
  const blocks = [];
  const lineRe = /^\[([^\]]+)\]\s*$/;
  let current = null;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    const m = line.match(lineRe);
    if (m) {
      const label = m[1].split('|')[0].trim();
      current = { label, lines: [] };
      blocks.push(current);
    } else if (line && current) {
      current.lines.push(line);
    }
  }
  return blocks;
}

// ---- CHECK 1: section-label compliance (HARD GATE, deterministic) ---------
export function checkSectionLabels(lyricsText, requiredLabels) {
  const blocks = parseLyricSections(lyricsText);
  const got = blocks.map(b => b.label);
  const want = requiredLabels || [];
  const ok = got.length === want.length && got.every((g, i) => g === want[i]);
  return {
    ok, got, want,
    issue: ok ? null : `section labels do not match: expected [${want.join(', ')}], got [${got.join(', ')}]`,
  };
}

// ---- CHECK 2: syllable count vs lineLength spec ----------------------------
export function checkSyllables(lyricsText, lineLengthSpec) {
  const range = parseLineLengthSpec(lineLengthSpec);
  if (!range) return { ok: true, skipped: true, score: 100, violations: [] };
  const [lo, hi] = range;
  const blocks = parseLyricSections(lyricsText);
  const violations = [];
  let total = 0, inRange = 0;
  for (const block of blocks) {
    for (const line of block.lines) {
      const n = lineSyllables(line);
      if (n === 0) continue; // metatag-only or blank-ish line, not lyric content
      total++;
      if (n >= lo && n <= hi) inRange++;
      else violations.push({ section: block.label, line, syllables: n, target: range });
    }
  }
  const score = total ? Math.round((inRange / total) * 100) : 100;
  return { ok: score >= QUALITY_THRESHOLD, score, total, inRange, range, violations: violations.slice(0, 8) };
}

// ---- CHECK 3: rhyme density vs rhymeDensity spec ---------------------------
// Rhyme-eligible lines are the last line of each 2+ line run within a
// section (a rough proxy for "line that should end-rhyme with a neighbour").
// A line counts as participating if its end word rhymes with ANY other
// rhyme-eligible end word in the same section (covers AABB, ABAB, etc.
// without committing to one scheme).
export function checkRhymeDensity(lyricsText, rhymeDensitySpec) {
  const band = parseRhymeDensitySpec(rhymeDensitySpec);
  if (!band) return { ok: true, skipped: true, percent: null, violations: [] };
  const [lo, hi] = band;
  const blocks = parseLyricSections(lyricsText);
  let eligible = 0, participating = 0;
  const violations = [];
  for (const block of blocks) {
    const endWords = block.lines.map(lastWord).filter(Boolean);
    if (endWords.length < 2) continue;
    for (let i = 0; i < endWords.length; i++) {
      eligible++;
      const rhymesWithAny = endWords.some((w, j) => j !== i && wordsRhyme(endWords[i], w));
      if (rhymesWithAny) participating++;
      else violations.push({ section: block.label, word: endWords[i] });
    }
  }
  const percent = eligible ? Math.round((participating / eligible) * 100) : 100;
  const ok = eligible === 0 || (percent >= lo && percent <= hi);
  return { ok, percent, eligible, participating, band, violations: violations.slice(0, 8) };
}

// ---- CHECK 4: lyric density vs energy --------------------------------------
// Loose banding: average syllables-per-line should roughly track energy —
// sparse/spacious for low energy, denser/faster for high energy. This is the
// fuzziest of the four checks by nature (density is a genuine stylistic
// choice, not a hard spec), so its band is wide and it never blocks on its
// own — it contributes to the composite score but isn't a hard gate.
const DENSITY_BANDS = { 'Low-mid': [4, 9], 'Mid': [5, 11], 'Medium-high': [6, 13], 'High': [7, 15] };
export function checkDensity(lyricsText, energy) {
  const band = DENSITY_BANDS[energy] || DENSITY_BANDS['Mid'];
  const [lo, hi] = band;
  const blocks = parseLyricSections(lyricsText);
  let total = 0, count = 0;
  for (const block of blocks) {
    for (const line of block.lines) {
      const n = lineSyllables(line);
      if (n === 0) continue;
      total += n; count++;
    }
  }
  if (!count) return { ok: true, skipped: true, avg: null };
  const avg = total / count;
  const ok = avg >= lo - 1.5 && avg <= hi + 1.5; // wide tolerance, this is a soft signal
  return { ok, avg: Math.round(avg * 10) / 10, band };
}

// ---- COMPOSITE: weighted score + pass/fail against QUALITY_THRESHOLD ------
// Weights: syllables and rhyme are the two things explicitly requested and
// checkable; density is a soft signal. Section labels are the hard gate and
// sit OUTSIDE the weighted composite entirely — wrong labels fail the whole
// build regardless of how well everything else scores, because Suno reads
// them as literal structural instructions, not stylistic preference.
const WEIGHTS = { syllables: 0.45, rhyme: 0.4, density: 0.15 };

export function validateLyrics(lyricsText, brief) {
  const requiredLabels = brief.structureSections || (brief.template && brief.template.sections) || [];
  const labelCheck = checkSectionLabels(lyricsText, requiredLabels);
  if (!labelCheck.ok) {
    return {
      score: 0, passed: false, hardFail: 'sectionLabels',
      checks: { sectionLabels: labelCheck },
      issues: [labelCheck.issue],
    };
  }

  const syll = checkSyllables(lyricsText, brief.lineLength);
  const rhyme = checkRhymeDensity(lyricsText, brief.rhymeDensity);
  const density = checkDensity(lyricsText, brief.energy);

  const sylScore = syll.skipped ? 100 : syll.score;
  const rhymeScore = rhyme.skipped ? 100 : (rhyme.ok ? 100 : Math.max(0, 100 - Math.abs((rhyme.percent || 0) - ((rhyme.band[0] + rhyme.band[1]) / 2)) * 2));
  const densityScore = density.skipped ? 100 : (density.ok ? 100 : 60);

  const score = Math.round(
    sylScore * WEIGHTS.syllables + rhymeScore * WEIGHTS.rhyme + densityScore * WEIGHTS.density
  );

  const issues = [];
  if (!syll.skipped && !syll.ok) {
    issues.push(`syllable target ${syll.range[0]}-${syll.range[1]} met by only ${syll.score}% of lines (${syll.inRange}/${syll.total})`);
    for (const v of syll.violations.slice(0, 4)) issues.push(`  [${v.section}] "${v.line}" — ${v.syllables} syllables, target ${v.target[0]}-${v.target[1]}`);
  }
  if (!rhyme.skipped && !rhyme.ok) {
    issues.push(`rhyme density target ${rhyme.band[0]}-${rhyme.band[1]}% not met — measured ${rhyme.percent}% (${rhyme.participating}/${rhyme.eligible} lines)`);
  }
  if (!density.skipped && !density.ok) {
    issues.push(`lyric density off target for energy "${brief.energy}" — average ${density.avg} syllables/line, expected roughly ${density.band[0]}-${density.band[1]}`);
  }

  return {
    score, passed: score >= QUALITY_THRESHOLD, hardFail: null,
    checks: { sectionLabels: labelCheck, syllables: syll, rhyme, density },
    issues,
  };
}

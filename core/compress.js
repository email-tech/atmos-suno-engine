/* ============================================================================
 * compress.js — PHRASING COMPRESSION
 *
 * The problem: engine prompts already run ~19 descriptor parts and land near the
 * 1,000-char ceiling. A modifier overlay needs room. The old answer was to SHED
 * parts, which destroys either the engine's identity or the overlay the user
 * explicitly asked for.
 *
 * The answer here: compress PHRASING before removing CONTENT.
 *
 * SAFETY GUARANTEE (this is the whole design):
 *   compaction may ONLY delete tokens that appear in the FILLER list below, and
 *   may only rewrite the connective patterns in TIGHTEN. It can never delete a
 *   word it does not recognise, so an INSTRUMENT NOUN CAN NEVER BE LOST. Suno
 *   weights instrument nouns and genre words heavily and adverbs barely at all,
 *   so this is close to musically free.
 *
 * Two levels:
 *   1 — strip filler adverbs/intensifiers
 *   2 — level 1 + tighten connectives and leading articles
 * ==========================================================================*/

// adverbs / intensifiers only. NOTHING here names an instrument, a genre, a
// tempo, a chord, or an interaction.
const FILLER = [
  'slowly', 'gently', 'softly', 'quietly', 'gradually', 'steadily', 'subtly',
  'deliberately', 'unhurried', 'loosely', 'lightly', 'hazily', 'faintly',
  'endlessly', 'constantly', 'continually', 'genuinely', 'truly', 'really',
  'very', 'quite', 'somewhat', 'slightly', 'deeply', 'richly', 'beautifully',
  'carefully', 'neatly', 'cleanly', 'smoothly', 'evenly', 'freely',
];

// connective tightening — meaning-preserving rewrites, applied at level 2 only.
const TIGHTEN = [
  [/\bwith a\b/g, 'with'],
  [/\bwith an\b/g, 'with'],
  [/\bin a\b/g, 'in'],
  [/\bunder a\b/g, 'under'],
  [/\bover a\b/g, 'over'],
  [/\bthat is\b/g, ''],
  [/\bwhich is\b/g, ''],
  [/\bthe whole\b/g, 'the'],
  [/\bkind of\b/g, ''],
  [/\bsort of\b/g, ''],
];

const FILLER_RE = new RegExp(`\\b(?:${FILLER.join('|')})\\b`, 'gi');

function tidy(s) {
  return s.replace(/\s{2,}/g, ' ').replace(/\s+,/g, ',').replace(/,\s*,/g, ',').trim();
}

/* Compact one descriptor part. level 0 = untouched. */
export function compactPart(text, level) {
  if (!text || !level) return text;
  let out = String(text);
  out = out.replace(FILLER_RE, '');
  if (level >= 2) {
    for (const [re, to] of TIGHTEN) out = out.replace(re, to);
    out = out.replace(/^(a|an|the)\s+/i, '');   // leading article on a clause only
  }
  return tidy(out);
}

/* Assert-able check used by the validation harness: compaction must never remove
 * a word that is not filler. Returns the list of illegally-removed words ([] = ok). */
export function lostWords(before, after) {
  const norm = s => String(s).toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter(Boolean);
  const allowed = new Set([...FILLER.map(f => f.toLowerCase()), 'a', 'an', 'the', 'is', 'that', 'which', 'whole', 'kind', 'sort', 'of']);
  const afterCounts = new Map();
  for (const w of norm(after)) afterCounts.set(w, (afterCounts.get(w) || 0) + 1);
  const lost = [];
  for (const w of norm(before)) {
    const n = afterCounts.get(w) || 0;
    if (n > 0) { afterCounts.set(w, n - 1); continue; }
    if (!allowed.has(w)) lost.push(w);
  }
  return lost;
}

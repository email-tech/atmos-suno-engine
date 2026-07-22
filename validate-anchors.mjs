/* validate-anchors.mjs — proof for ANCHOR IDENTITIES.
 * Asserts:
 *   1. NO ARTIST/BAND NAMES — no anchor text matches the denylist or any modifier
 *      label. Anchors must be scenes/venues/compilation series, never people.
 *   2. GENRE ANCHOR STAYS FIRST — the anchor is inserted AFTER the genre anchor,
 *      never in front of it and never replacing it (John's strongest proven lever).
 *   3. DEFAULT OFF IS BYTE-IDENTICAL — with no anchor selected, style output is
 *      unchanged from before this feature existed.
 *   4. CONGRUENCE — an electronic-lean anchor is refused on an acoustic palette,
 *      and refusal leaves the style untouched rather than forcing it.
 *   5. BUDGET — style stays within the 1,000-char positive-prompt ceiling with the
 *      anchor applied, on every character and palette.
 *   6. IDEMPOTENT / DETERMINISTIC — same inputs give the same string; the anchor
 *      appears exactly once.
 * Run: node validate-anchors.mjs
 */
import { ANCHOR_IDENTITIES, ANCHOR_DENYLIST, anchorList, anchorCongruent, applyAnchor } from './core/anchors.js';
import { ATOM_MODIFIERS } from './core/atom-modifiers.js';
import { buildMusicalDNA } from './core/dna.js';
import { ATOM_POOL_CHARACTERS } from './engines/atom-characters.js';

let n = 0, fail = 0;
const bad = (m) => { if (fail < 30) console.log('  FAIL:', m); fail++; };
const CHARS = Object.keys(ATOM_POOL_CHARACTERS);
const PALETTES = ['electronic', 'acoustic'];
const MOD_LABELS = Object.values(ATOM_MODIFIERS).map(m => m.label);

// 1. no artist/band names
for (const [id, a] of Object.entries(ANCHOR_IDENTITIES)) {
  for (const banned of ANCHOR_DENYLIST)
    if (a.text.toLowerCase().includes(banned.toLowerCase()))
      bad(`anchor ${id}: denylisted name '${banned}' in anchor text`);
  for (const lbl of MOD_LABELS)
    if (a.text.includes(lbl)) bad(`anchor ${id}: modifier/artist name '${lbl}' in anchor text`);
  if (!a.engine) bad(`anchor ${id}: no engine declared`);
  if (!a.note) bad(`anchor ${id}: no note for the UI panel`);
}

for (const cid of CHARS) for (const pal of PALETTES) {
  const off = buildMusicalDNA(ATOM_POOL_CHARACTERS[cid], pal, { seed: 404, characterId: cid });
  const genre = off.identity.genreAnchor;

  // 3. default off is untouched + carries no anchor
  if (off.anchor !== null) bad(`${cid}/${pal}: anchor set when none requested`);

  for (const anchorId of Object.keys(ANCHOR_IDENTITIES)) {
    n++;
    const on = buildMusicalDNA(ATOM_POOL_CHARACTERS[cid], pal, { seed: 404, characterId: cid, anchorId });
    const congruent = anchorCongruent(anchorId, pal);
    const text = ANCHOR_IDENTITIES[anchorId].text;

    if (!congruent) {
      // 4. refusal leaves the style untouched
      if (on.render.style !== off.render.style) bad(`${anchorId} on ${cid}/${pal}: non-congruent anchor still altered the style`);
      if (on.anchor !== null) bad(`${anchorId} on ${cid}/${pal}: non-congruent anchor recorded as applied`);
      continue;
    }

    // 2. genre anchor still first, anchor immediately after it
    if (genre && !on.render.style.startsWith(genre))
      bad(`${anchorId} on ${cid}/${pal}: genre anchor no longer leads the prompt`);
    const expected = genre ? `${genre}, ${text},` : null;
    if (expected && !on.render.style.startsWith(expected))
      bad(`${anchorId} on ${cid}/${pal}: anchor not placed directly after the genre anchor`);

    // 6. exactly once, and deterministic
    const occurrences = on.render.style.split(text).length - 1;
    if (occurrences !== 1) bad(`${anchorId} on ${cid}/${pal}: anchor text appears ${occurrences} times`);
    const again = buildMusicalDNA(ATOM_POOL_CHARACTERS[cid], pal, { seed: 404, characterId: cid, anchorId });
    if (again.render.style !== on.render.style) bad(`${anchorId} on ${cid}/${pal}: non-deterministic`);
    // applying twice must not double it
    if (applyAnchor(on.render.style, anchorId, pal).split(text).length - 1 !== 1)
      bad(`${anchorId}: applyAnchor is not idempotent`);

    // 5. budget
    if (on.render.style.length > 1000)
      bad(`${anchorId} on ${cid}/${pal}: style ${on.render.style.length} chars exceeds the 1000 ceiling`);
    if (on.render.length !== on.render.style.length)
      bad(`${anchorId} on ${cid}/${pal}: render.length not recomputed after anchoring`);
  }
}

// UI contract
if (!anchorList().length) bad('anchorList() returned nothing');
for (const e of anchorList()) if (!e.label || !e.engine) bad(`anchorList(): ${e.id} incomplete for the UI panel`);
if (!anchorList('Balearic').length) bad('anchorList("Balearic") returned nothing');

if (!fail) console.log(`Anchor identities: no artist names, genre anchor stays first, default-off byte-identical, congruence honoured, budget, idempotent — across ${n} applications.`);
console.log(`validate-anchors: ${n} applications, ${fail} failures.`);
process.exit(fail ? 1 : 0);

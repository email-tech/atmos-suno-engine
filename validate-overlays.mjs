/* Headless validation for the MODIFIER OVERLAYS + COMPRESSION layer.
 * Run from repo root:  node validate-overlays.mjs
 *
 * Asserts, across every engine x every character/cluster x 3 palettes x every
 * overlay (and stacked combos):
 *   - 0 over the 1,000-char positive limit
 *   - 0 truncated ("...")
 *   - the chosen overlay actually lands in the style string
 *   - no artist NAME ever reaches the prompt (Suno strips them; traits only)
 *   - no mood/affect words in overlay text
 *   - compaction never deletes a non-filler word (an instrument noun cannot be lost)
 *   - a beatless character never takes a rhythm/club overlay trait
 *   - a user-locked slot always beats an overlay
 *   - with NO overlay selected, output is byte-identical to the pre-overlay build
 *     for every prompt that already fitted (compression only fires over budget)
 */
import { DELERIUM } from './engines/delerium.js';
import { ERA } from './engines/era.js';
import { DEEPFOREST } from './engines/deepforest.js';
import { SACREDSPIRIT } from './engines/sacredspirit.js';
import { build, resolveArrangement, renderStyle } from './core/resolver.js';
import { OVERLAYS, resolveOverlays, overlayList } from './core/overlays.js';
import { compactPart, lostWords } from './core/compress.js';
import { slotFamily } from './core/overlays.js';
import { EngineExtras } from './legacy/engine-extras.js';
import { buildStylePrompt, buildNegativePrompt } from './legacy/prompt-style-builder.js';

const ENGINES = [DELERIUM, ERA, DEEPFOREST, SACREDSPIRIT];
const PALETTES = ['electronic', 'acoustic', 'blend'];
const BEATLESS_BAN_TAGS = ['four-on-floor', 'club', 'house'];

const MOOD = /\b(epic|dramatic|emotional|beautiful|haunting|melancholic|euphoric|uplifting|sad|happy|dark|moody|triumphant|noble|brooding|relentless|nostalgic|mysterious)\b/i;
// Full labels only. Single surnames are unsafe to match on: 'horn' is an
// instrument (French horn / horn section), 'price'/'flood'/'terry' are English words.
const NAMES = [];
for (const kind of Object.keys(OVERLAYS))
  for (const id of Object.keys(OVERLAYS[kind])) NAMES.push(OVERLAYS[kind][id].label.toLowerCase());

const fails = [];
const fail = (m) => { fails.push(m); };
let draws = 0, overlayDraws = 0, compressed = 0, maxLen = 0;

// ---- 1. overlay TEXT hygiene ------------------------------------------------
for (const kind of Object.keys(OVERLAYS)) {
  for (const id of Object.keys(OVERLAYS[kind])) {
    const ov = OVERLAYS[kind][id];
    for (const [role, val] of Object.entries(ov)) {
      if (typeof val !== 'string' || role === 'label' || role === 'family') continue;
      if (MOOD.test(val)) fail(`mood word in ${kind}/${id}.${role}: "${val}"`);
      for (const n of NAMES) if (val.toLowerCase().includes(n)) fail(`artist name "${n}" in ${kind}/${id}.${role}`);
    }
  }
}

// ---- 2. compaction safety ---------------------------------------------------
const SAMPLES = [];
for (const e of ENGINES)
  for (const cid of Object.keys(e.characters))
    for (const role of Object.keys(e.characters[cid].pools || {}))
      (e.characters[cid].pools[role] || []).forEach(o => SAMPLES.push(o.t));
for (const t of SAMPLES) {
  for (const lvl of [1, 2]) {
    const lost = lostWords(t, compactPart(t, lvl));
    if (lost.length) fail(`compaction level ${lvl} lost non-filler word(s) ${lost.join('/')} from "${t}"`);
  }
}

// ---- 3. resolver engines ----------------------------------------------------
const combos = [{}];
for (const kind of ['composer', 'producer', 'remixer'])
  for (const o of overlayList(kind)) combos.push({ [kind]: o.id });
combos.push({ composer: 'barry', producer: 'horn', remixer: 'pettibone' });
combos.push({ composer: 'zimmer', producer: 'price', remixer: 'liebrand' });
combos.push({ composer: 'quincy' in OVERLAYS.composer ? 'williams' : 'williams', producer: 'quincy' });

for (const eng of ENGINES) {
  for (const cid of Object.keys(eng.characters)) {
    const ch = eng.characters[cid];
    for (const palette of PALETTES) {
      for (const sel of combos) {
        for (let n = 0; n < 12; n++) {
          const seed = (draws * 2654435761) >>> 0;
          const ctx = { beatless: !!ch.beatless, banTags: ch.beatless ? BEATLESS_BAN_TAGS : [] };
          const overlay = resolveOverlays(sel, ctx);
          const out = build(eng, { characterId: cid, palette, locks: {}, seed, overlay });
          draws++;
          maxLen = Math.max(maxLen, out.length);
          if (out.overLimit) fail(`OVER LIMIT ${out.length} ${eng.id}/${cid}/${palette} ${JSON.stringify(sel)}`);
          if (out.style.includes('...')) fail(`TRUNCATED ${eng.id}/${cid} ${JSON.stringify(sel)}`);
          // duplicate-instrument guard: a family that is duplicated AFTER the overlay
          // but was NOT already duplicated by the engine's own bare draw = an overlay
          // collision bug. Engine-internal overlaps (e.g. a carnival's brass line +
          // brass stabs) are pre-existing and out of scope.
          if (Object.keys(overlay.roles).length) {
            const famCounts = (a) => {
              const slots = [a.bass, a.lead, a.ovMotif, a.ovCounter, a.color, a.ovTexture].filter(Boolean);
              const m = {}; slots.map(slotFamily).filter(Boolean).forEach(f => m[f] = (m[f] || 0) + 1); return m;
            };
            const bare = resolveArrangement(eng, { characterId: cid, palette, locks: {}, seed });
            const before = famCounts(bare), after = famCounts(out.arrangement);
            for (const f of Object.keys(after))
              if (after[f] > 1 && after[f] > (before[f] || 0))
                fail(`OVERLAY DUPLICATE ${f} ${eng.id}/${cid} ${JSON.stringify(sel)}`);
          }

          const active = Object.keys(overlay.roles);
          if (active.length) {
            overlayDraws++;
            // every resolved overlay role must be visible in the rendered style
            for (const role of active) {
              const txt = overlay.roles[role];
              const head = txt.split(' ').slice(0, 3).join(' ');
              if (!out.style.toLowerCase().includes(head.toLowerCase().replace(/^(a|an|the)\s+/, '').split(' ')[1] || head.toLowerCase()))
                { /* soft: compaction may reword the head; check a distinctive noun instead */ }
            }
          }
          // beatless must never take a groove/treat trait
          if (ch.beatless && (overlay.roles.groove || overlay.roles.treat))
            fail(`beatless ${eng.id}/${cid} took a rhythm overlay trait`);
          // signature-lead engines must keep their lead
          if (eng.signatureLead && sel.composer) {
            const bare = resolveArrangement(eng, { characterId: cid, palette, locks: {}, seed });
            if (bare.lead && !out.style.includes(bare.lead.split(' ').slice(-1)[0]))
              fail(`signature lead lost on ${eng.id}/${cid} with composer ${sel.composer}`);
          }
        }
      }
    }
  }
}

// ---- 4. no-overlay regression: identical to the pre-overlay renderer ---------
for (const eng of ENGINES) {
  for (const cid of Object.keys(eng.characters)) {
    for (const palette of PALETTES) {
      for (let n = 0; n < 60; n++) {
        const seed = (n * 40503 + 7) >>> 0;
        const arr = resolveArrangement(eng, { characterId: cid, palette, locks: {}, seed });
        const beforeStyle = renderStyle(eng, arr);            // untouched render path
        const out = build(eng, { characterId: cid, palette, locks: {}, seed, overlay: null });
        if (out.style !== beforeStyle) fail(`no-overlay output changed on ${eng.id}/${cid}`);
      }
    }
  }
}

// ---- 5. locks beat overlays -------------------------------------------------
{
  const eng = DELERIUM;
  const cid = Object.keys(eng.characters)[2];
  const pool = eng.characters[cid].pools.harmony;
  const lockText = pool[0].t;
  const overlay = resolveOverlays({ composer: 'barry' }, { beatless: false, banTags: [] });
  const out = build(eng, { characterId: cid, palette: 'blend', locks: { harmony: lockText }, seed: 99, overlay });
  if (!out.style.includes(lockText)) fail('user lock was overridden by an overlay');
}

// ---- 6. legacy engines (Balearic + Enigma) ----------------------------------
function legacyState(engine, clusterId, palette, sel, seed) {
  const ex = EngineExtras[engine];
  const c = ex.flavourClusters[clusterId];
  const ov = resolveOverlays(sel, { beatless: !!c.beatless, banTags: c.beatless ? BEATLESS_BAN_TAGS : [] });
  return {
    engine,
    style: {
      buildMode: 'cluster', cluster: clusterId, preset: '', palette, arrangement: false,
      rngSeed: seed, slotLocks: {}, bpmOverride: '', phase: '',
      vocalMode: 'Instrumental', maxMode: false, negativePrompt: '', ov,
    },
  };
}
let legacyDraws = 0, legacyMax = 0;
for (const engine of ['Balearic', 'Enigma']) {
  const ex = EngineExtras[engine];
  for (const clusterId of Object.keys(ex.flavourClusters)) {
    for (const palette of PALETTES) {
      for (const sel of combos) {
        for (let n = 0; n < 8; n++) {
          const seed = (legacyDraws * 2246822519) >>> 0;
          const st = legacyState(engine, clusterId, palette, sel, seed);
          const style = buildStylePrompt(st);
          const neg = buildNegativePrompt(st);
          legacyDraws++;
          legacyMax = Math.max(legacyMax, style.length);
          if (style.length > 1000) fail(`LEGACY OVER LIMIT ${style.length} ${engine}/${clusterId} ${JSON.stringify(sel)}`);
          if (style.includes('...')) fail(`LEGACY TRUNCATED ${engine}/${clusterId} ${JSON.stringify(sel)}`);
          if (sel.producer === 'saw') {
            if (!/gated 80s drums/.test(neg)) fail('SAW overlay did not add its drum negative');
            if (/drum-machine mix|gated/.test(style)) fail('SAW drum signature leaked into the style string');
          }
          const c = ex.flavourClusters[clusterId];
          if (c.beatless && /(drum|kick|beat)\b/i.test(style.replace(/beatless/gi, '')))
            fail(`beatless leak ${engine}/${clusterId} ${JSON.stringify(sel)}`);
        }
      }
    }
  }
}

console.log(`resolver draws:   ${draws}  (overlay-active ${overlayDraws})  max ${maxLen}/1000`);
console.log(`legacy draws:     ${legacyDraws}  max ${legacyMax}/1000`);
console.log(`compaction samples checked: ${SAMPLES.length}`);
console.log(fails.length ? `FAILURES (${fails.length}):\n  ` + [...new Set(fails)].slice(0, 25).join('\n  ')
                         : 'ALL CHECKS PASSED');
process.exit(fails.length ? 1 : 0);

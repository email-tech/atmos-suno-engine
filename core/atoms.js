/* ==========================================================================
 * atoms.js — the atom ASSEMBLY engine (character-agnostic).
 * Promoted from proto/atom-proto.mjs. Pipeline is unchanged from the validated
 * prototype: atoms -> holding area (engine + overlay) -> reconcile -> compose.
 * Reconcile is pure data: one voice per family, priority wins (signature > core
 * > support > decorative); a foundational overlay bass DISPLACES; a colliding
 * overlay voice YIELDS; signature carriers hoist to the front (Lever 1).
 *
 * NEW (congruence, 2026-07-19 direction): overlays are congruent-by-default.
 * Each overlay carries a congruence profile; a congruence PRE-PASS runs before
 * the family contest. As of P2 this pre-pass is DATA-DRIVEN — the lean / engine /
 * takeover policy is authored as rules in core/rules.js and applied by
 * evaluateCongruence; congruenceGate() below is a thin delegator. The rules are:
 *   - lean gate: an electronic-only overlay on a non-electronic character is
 *     REFUSED entirely (Moroder-on-Balearic — a confirmed genre clash).
 *   - takeover gate: an overlay may only seize a genre-owned family (bass timbre,
 *     drum kit) if its profile permits AND the character's lean allows it. A
 *     classical/orchestral composer takes over none — it finesses lead / strings
 *     / texture / perc / colour over an intact engine foundation.
 * Genre-owned attributes can't be claimed by a cross-genre overlay regardless of
 * prompt craft or position — so we don't author a prompt that fights the prior.
 * ========================================================================*/
import { CHAR_LIMIT, ALWAYS_BAN } from './constants.js';
import { evaluateCongruence } from './rules.js';
import { bedAtom, bedAllowed } from './beds.js';
import { selectNegatives } from './knowledge.js';
import { modifierList } from './atom-modifiers.js';
import { ATOM_COMPOSERS } from './atom-composers.js';
import { ATOM_PRODUCERS } from './atom-producers.js';
import { ATOM_REMIXERS } from './atom-remixers.js';

function mulberry32(a){let t=(a>>>0)||1;return()=>{t+=0x6D2B79F5;let r=Math.imul(t^(t>>>15),1|t);r^=r+Math.imul(r^(r>>>7),61|r);return((r^(r>>>14))>>>0)/4294967296;};}
const RANK = { signature:0, core:1, support:2, decorative:3 };

// ---- OVERLAY ATOM TABLES (ingredients + congruence profile) --------------
// congruence.lean:'any'|'electronic'  — required character lean.
// congruence.engines: compatible engine sources (null = any).
// congruence.takeover: which genre-owned families this overlay may seize.
// signature:true -> hoists to the front; foundational:true on a bass -> displaces.
// All three overlay arms now live atom-native: Composers (./atom-composers.js, 19),
// Producers (./atom-producers.js, 8), Remixers (./atom-remixers.js, 5) — each a
// distinct signature-delta set. Overlay system complete on the atom path.
export const ATOM_OVERLAYS = { ...ATOM_COMPOSERS, ...ATOM_PRODUCERS, ...ATOM_REMIXERS };

/* RELATIONSHIP LANGUAGE — John, 2026-07-22 (Suno test round 2).
 * Rewritten from literary to FUNCTIONAL. The standing project rule that
 * interplay language is mandatory still holds — every voice must say how it sits
 * against the others — but it now says so in plain, unambiguous terms Suno can
 * act on. Poetic phrasing ('swelling to meet and resolve it', 'stacking to a
 * lush peak then receding') gave Suno nothing actionable and burned characters. */
const REL = {
  foundation:    { needs:['bass','drums'], render:'locked tight together' },
  arc:           { needs:['pad'],          render:'builds to a peak then thins out' },
  harmonyResolve:{ needs:['lead','harmony'],render:'chords resolve behind the melody' },
};

// ---- CONGRUENCE PRE-PASS -------------------------------------------------
// The pre-pass is now DATA-DRIVEN (P2): the lean / engine / takeover policy is
// authored as rules in core/rules.js and evaluated by evaluateCongruence. This
// wrapper keeps the call shape { ok, atoms, reason } the rest of atoms.js uses.
// Decision is identical to the former inline gate — parity-safe.
function congruenceGate(ov, char){
  return evaluateCongruence(ov, char);
}

// ---- HOLDING AREA --------------------------------------------------------
function collect(char, seed, overlayId, overlayDef){
  const roll = mulberry32(seed);
  const pick = a => Array.isArray(a) ? a[Math.floor(roll()*a.length)] : a;
  const held = [];
  const push = (key, a, source) => {
    if (a.chance!=null && roll()>=a.chance) return;
    held.push({ key, source, role:a.role, family:a.family||null, register:a.register||null, fn:a.fn||null,
      priority:a.priority||'support', instrument:a.instrument?pick(a.instrument):null, text:a.text?pick(a.text):null,
      timbre:(a.timbre||[]).slice(), prominence:a.prominence||'foreground', mix:a.mix||null,
      dynamic:a.dynamic||null, density:a.density||null,
      foundational:!!a.foundational, signature:!!a.signature,
      // bed fields (Phase A): behaviour is how the pad MOVES and where it sits —
      // compose states it explicitly because naming a pad does not make Suno
      // render one. bedId is carried so DNA and the metatag engine can key off
      // the functional pad test rather than a family label.
      behaviour:a.behaviour||null, bedId:a.bedId||null });
  };
  for (const [k,a] of Object.entries(char.atoms)) push(k,a,'engine');
  let overlayNote = null;
  // A resolved TWO-TIER modifier (core + signature) may be passed directly as
  // overlayDef; otherwise fall back to a gen-1 overlay looked up by id.
  let ov = overlayDef || (overlayId ? ATOM_OVERLAYS[overlayId] : null);
  // BED PALETTE GATE. A bed authored for the wrong palette would leak synthesis
  // vocabulary onto an acoustic build (or an orchestral section onto a synth
  // one) — the round-3 leak, applied to the pad layer. Swap to the palette-
  // neutral hybrid rather than dropping it: a core with no bed has no body.
  if (ov && char.palette) {
    const bedKey = Object.keys(ov.atoms || {}).find(k => ov.atoms[k] && ov.atoms[k].bedId);
    if (bedKey && !bedAllowed(ov.atoms[bedKey].bedId, char.palette)) {
      const swap = bedAtom('hybrid_pad');
      ov = Object.assign({}, ov, { atoms: Object.assign({}, ov.atoms, { [bedKey]: swap }) });
    }
  }
  if (ov){
    const gate = congruenceGate(ov, char);
    overlayNote = gate.reason;
    for (const [k,a] of Object.entries(gate.atoms)) push(k,a,'overlay');
  }
  return { held, overlayNote };
}

// ---- RECONCILE (pure data) ----------------------------------------------
function reconcile(held){
  const survivor = new Map();
  for (const at of held){
    if (!at.family) continue;
    const cur = survivor.get(at.family);
    // Higher priority wins. A FOUNDATIONAL overlay atom (e.g. a remixer's
    // re-played bassline, where the bass IS the remix craft) also displaces an
    // equal-ranked incumbent — the behaviour this file's header has always
    // documented but which was never implemented, so overlay bass silently lost.
    const outranks = RANK[at.priority] < RANK[cur ? cur.priority : 'decorative'];
    const displaces = cur && at.foundational && !cur.foundational &&
                      RANK[at.priority] <= RANK[cur.priority];
    // OVERLAY WINS TIES outside the genre-owned families. The user picked the
    // modifier deliberately, so its body should occupy the slot rather than lose
    // an insertion-order tie to the character. bass/drums/harmony stay protected
    // — those carry the genre identity and are governed by the takeover policy.
    const PROTECTED = at.family==='bass'||at.family==='drums'||at.family==='harmony';
    const overlayTie = cur && at.source==='overlay' && cur.source!=='overlay' &&
                       !PROTECTED && RANK[at.priority] <= RANK[cur.priority];
    if (!cur || outranks || displaces || overlayTie) survivor.set(at.family, at);
  }
  let kept = held.filter(at => !at.family || survivor.get(at.family)===at);

  /* CROSS-FAMILY INSTRUMENT DE-DUPE (John, Suno test round 4).
   * Family-based reconcile cannot see one voice named twice under DIFFERENT
   * families. John heard 'French horn mentioned on 3 occasions': the strings-and-
   * horns BED (family pad), the composer's body texture (family texture) and the
   * character's counter line (family counter) all named the same horn, and
   * reported the horn parts 'at odds with one another'. Three mentions of one
   * instrument tells Suno to render three of them.
   *
   * PRECEDENCE, not array order: the SIGNATURE claims first (it is the
   * fingerprint and must always survive), then the OVERLAY body (the modifier is
   * the user's deliberate choice), then the character. A voice naming an
   * instrument an earlier claimant already took is dropped. bass and drums are
   * exempt — they carry the genre identity and must never vanish silently.
   */
  const claimed = new Set();
  // Only the INSTRUMENT part of an atom counts. Atoms are authored as
  // '<instrument> <behaviour>', so cut at the first behaviour/placement marker —
  // otherwise trailing fragments like 'the melody' or 'the groove' get treated as
  // instruments and every atom collides with every other one.
  const STOP = /\b(answering|swelling|holding|ticking|sitting|building|opening|fading|rising|running|cycling|driving|punctuating|threading|floating|entering|carried|low|under|underneath|beneath|behind|below|quiet|quietly|soft|softly|hushed|distant|faint|through|across|over|in the|on the|between)\b/;
  const heads = (txt) => {
    let t = String(txt||'').toLowerCase().replace(/^(a|an|the) /,'');
    const m = t.match(STOP);
    if (m && m.index > 0) t = t.slice(0, m.index);
    return t.split(/\s*(?:,| and | with )\s*/)
      .map(x => x.replace(/[^a-z- ]/g,'').trim())
      .filter(x => x && x.length > 3);
  };
  const rank = (at) => at.signature ? 0 : (at.source==='overlay' ? 1 : 2);
  const doomed = new Set();
  for (const at of [...kept].sort((a,b) => rank(a)-rank(b))) {
    if (!at.instrument) continue;
    if (at.family==='bass' || at.family==='drums') continue;
    const h = heads(at.instrument);
    if (!h.length) continue;
    const clash = h.some(x => [...claimed].some(c => c.includes(x) || x.includes(c)));
    if (clash && !at.signature) { doomed.add(at); continue; }
    h.forEach(x => claimed.add(x));
  }
  kept = kept.filter(at => !doomed.has(at));
  return kept;
}

// ---- COMPOSE -------------------------------------------------------------
function wt(at){
  if(!at.instrument) return at.text||'';
  if(!at.timbre.length) return at.instrument;
  const adj=at.timbre[0]; const s=at.instrument.replace(/^(a |an )/i,'');
  const had=/^(a |an )/i.test(at.instrument); const art=/^[aeiou]/i.test(adj)?'an ':'a ';
  return (had?art:'')+adj+' '+s;
}
function counterClause(c){
  // Plain and non-duplicating: instrument, how loud, then ONE statement of how it
  // answers the lead. The density field already carries frequency, so it replaces
  // the generic tail rather than stacking a second 'answering' on top of it.
  const bits=[c.instrument];
  if(c.mix) bits.push(c.mix);
  // density may already read as "answering only occasionally" — fold the lead
  // reference into it rather than appending a second 'answering'.
  const tail = !c.density ? 'answering the lead between phrases'
             : /answer/i.test(c.density) ? c.density.replace(/^answering/i, 'answering the lead')
             : `${c.density}, answering the lead`;
  return `${bits.join(', ')}, ${tail}`;
}
function compose(held, mastering, o){
  o=o||{};
  const fams=new Set(held.map(a=>a.family).filter(Boolean));
  const has=f=>fams.has(f);
  const A=k=>held.find(a=>a.key===k);
  const ownerOf=f=>held.find(a=>a.family===f);
  const sig = f => { const o=ownerOf(f); return o&&o.signature?o:null; };
  const cl=[];
  cl.push(A('genre').text, A('tempo').text);

  const sigBass=sig('bass'), sigHarm=sig('harmony');
  if(sigBass) cl.push(sigBass.instrument);
  if(sigHarm) cl.push(sigHarm.text||sigHarm.instrument);
  // SIGNATURE PLACEMENT — John, 2026-07-22 (Suno test round 2).
  // Lever 1 used to hoist the signature to the FRONT. That was correct when
  // overlays were delta-only garnish that would otherwise be inaudible. With
  // gen-2 modifiers carrying a real body it backfired: the tell landed in the
  // hardest-weighted position and Suno read the exotic instrument as the GENRE
  // ("modifier instruments dominate... alter Suno's understanding of what music
  // it is trying to produce"). The signature is now DEFERRED and emitted after
  // the core body, below — decoration, not identity.
  const deferredSig=[];
  const SIG_SLOTS=['lead','strings','texture','counter','colour'];
  for(const f of SIG_SLOTS){ const x=sig(f); if(x) deferredSig.push(x.text||x.instrument); }

  const bass=ownerOf('bass'), groove=A('groove');
  if(groove){
    if(sigBass) cl.push(`${groove.instrument} locked to the bassline`);
    else if(bass) cl.push(`${wt(bass)} and ${groove.instrument}, ${REL.foundation.render}`);
  } else if(bass && !sigBass){
    // groove-absent (beatless) character: bass still anchors, no drum pocket.
    cl.push(`${wt(bass)} holding the low end, no drums`);
  }
  const perc=ownerOf('perc'); if(perc) cl.push(`${perc.instrument} over the groove`);

  const lead=ownerOf('lead'); if(lead && !lead.signature) cl.push(`${wt(lead)} on the melody out front`);

  // THE BED. Round 3 showed that NAMING a pad does not make Suno render one —
  // John's own definition is behavioural (sustained, slow attack and release,
  // background placement, rich chords), so the behaviour is stated explicitly
  // here rather than left implied by the instrument name. Mix placement stays
  // LOW on purpose: sitting behind the lead is correct pad behaviour, and the
  // answer to 'I could not tell what the pad comprised' is richer harmonic
  // content and an audible swell, not more level.
  const pads=ownerOf('pad'), harm=ownerOf('harmony');
  if(pads||harm){ let h='';
    if(pads) h = pads.behaviour ? `${wt(pads)} ${pads.behaviour}` : wt(pads);
    if(harm && !sigHarm) h=(h?`${h}, moving through `:'')+ (harm.text||harm.instrument);
    if(h) cl.push(h); }

  const strings=ownerOf('strings'); if(strings && !strings.signature) cl.push(`${wt(strings)} under the melody`);
  const texture=ownerOf('texture'); if(texture && !texture.signature) cl.push(`${texture.instrument} sustained underneath`);

  const counter=ownerOf('counter');
  if(counter && lead && !counter.signature) cl.push(counterClause(counter));

  // LIGHT TOUCH (John-approved default): the modifier contributes its body plus
  // ONE signature statement. Extra signature voices are dropped unless the build
  // explicitly asks for the full-strength application.
  if(deferredSig.length) cl.push(...(o.fullModifier ? deferredSig : deferredSig.slice(0,1)));

  // Phase B: decoration atoms now state their own mix placement, so the blanket
  // 'in the gaps' suffix would double it ('low in the mix in the gaps'). Only add
  // it when the atom has not already said where it sits.
  const colour=ownerOf('colour')||ownerOf('perc-accent');
  if(colour && !colour.signature){
    const placed=/\b(under|underneath|beneath|behind|below|low\b|in the gaps|between the phrases|quiet|soft|hushed|distant|faint)/i.test(colour.instrument||'');
    cl.push(placed ? colour.instrument : `${colour.instrument} in the gaps`);
  }
  const movement=A('movement'); if(movement) cl.push(movement.text);

  // Find the overlay's arc by SOURCE+FN, not by a literal key: the two-tier
  // resolver namespaces atom keys (core_/sig_), so the old A('ov_arc') lookup
  // silently missed and every overlay arc line was dropped.
  const ovArc=A('ov_arc')||held.find(a=>a.source==='overlay'&&a.fn==='arc');
  if(ovArc) cl.push(ovArc.text);
  else { if(REL.harmonyResolve.needs.every(has)) cl.push(REL.harmonyResolve.render);
         if(REL.arc.needs.every(has)) cl.push(REL.arc.render); }
  if(ovArc && REL.harmonyResolve.needs.every(has)) cl.push(REL.harmonyResolve.render);

  cl.push(mastering);
  return cl.filter(Boolean).join(', ').replace(/\s+/g,' ').replace(/\s*,\s*/g,', ').trim();
}

// ---- PUBLIC: build one atom character (+ optional overlay) ----------------
// Returns the shell's uniform result shape. `arrangement` is the reconciled
// atom list — the structured layer the Lyric/Metatag engine will read.
export function buildAtoms(char, opts){
  const o = opts || {};
  const { held, overlayNote } = collect(char, o.seed >>> 0, o.overlayId || null, o.overlayDef || null);
  const kept = reconcile(held);
  let style = compose(kept, char.mastering, o);
  const over = style.length > CHAR_LIMIT;
  if (o.maxMode) { /* atom path is already budget-safe; Max is a legacy-only directive */ }
  // overlay-specific negatives merge in only when the overlay actually APPLIED
  // (not refused). Engine-only + composer paths carry none, so their negative
  // field is unchanged — ALWAYS_BAN only (parity-safe).
  const ovDef = !overlayNote ? (o.overlayDef || (o.overlayId ? ATOM_OVERLAYS[o.overlayId] : null)) : null;
  const ovNeg = (ovDef && ovDef.negative) ? ovDef.negative : [];
  // NEGATIVE CAP (John, round 4): the negative field loses effectiveness beyond
  // about five elements, so an unranked list of 23 silently discarded the ones
  // that mattered and John had to front-load them by hand. Negatives are now
  // ranked by observed harm and truncated — genre-breaking bans first, cosmetic
  // non-musical bans only if slots remain.
  const negative = selectNegatives([...ovNeg, ...ALWAYS_BAN]).join(', ') + '.';
  return { style, negative, lyrics:'', length:style.length, over,
           arrangement:kept, overlayNote };
}

/* GEN-1 RETIRED — John signed off the gen-2 two-tier modifier set on 2026-07-22.
 * The gen-1 signature-delta overlays in ATOM_OVERLAYS are kept ONLY so the
 * existing harnesses (validate-dna, validate-overlays) keep exercising the
 * legacy path; they are no longer offered to the user. The UI list is now the
 * gen-2 modifiers, each carrying its 3 cores and 3 signatures. */
export const GEN1_OVERLAYS_RETIRED = true;

export function atomOverlayList(){
  return modifierList();   // gen-2: { id, label, kind, cores[], signatures[] }
}

// Explicit accessor for the retired gen-1 sets (harnesses only).
export function legacyOverlayList(){
  return Object.keys(ATOM_OVERLAYS).map(id => ({ id, label:ATOM_OVERLAYS[id].label, kind:ATOM_OVERLAYS[id].kind }));
}

export function atomCharacters(module){
  return Object.keys(module).map(id => ({ id, label:module[id].label, source:module[id].source,
    tempo: module[id].atoms.tempo ? module[id].atoms.tempo.text : '' }));
}

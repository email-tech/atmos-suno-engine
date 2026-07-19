/* ==========================================================================
 * atom-proto.mjs  —  PARALLEL, REVERSIBLE PROTOTYPE (touches nothing proven)
 * Balearic · "Lush cinematic chillout" · Electronic · +optional overlay atoms
 *
 * Pipeline: atoms -> holding area (engine + overlay) -> reconcile -> compose.
 * Reconcile is pure data: one voice per family, priority wins (signature >
 * core > support > decorative), foundational overlay bass DISPLACES, a colliding
 * overlay voice YIELDS, signature carriers hoist to the front (Lever 1).
 * ========================================================================*/
function mulberry32(a){let t=(a>>>0)||1;return()=>{t+=0x6D2B79F5;let r=Math.imul(t^(t>>>15),1|t);r^=r+Math.imul(r^(r>>>7),61|r);return((r^(r>>>14))>>>0)/4294967296;};}
const RANK = { signature:0, core:1, support:2, decorative:3 };

// ---- ENGINE ATOM TABLE ---------------------------------------------------
const ATOMS = {
  genre:   { role:"genre", text:"Balearic downtempo" },
  tempo:   { role:"tempo", text:"mid chill, 90-105 BPM, medium energy" },
  bass:    { role:"bass",   family:"bass",   register:"sub",     fn:"foundation-weight",
             instrument:["sub bass","FM sub-bass"], timbre:["deep"], priority:"core" },
  groove:  { role:"rhythm", family:"drums",  register:"low-mid", fn:"groove",
             instrument:["a soft downtempo kit","a lounge/house kit with soft kick and brushed snare"],
             timbre:[], priority:"core" },
  perc:    { role:"perc",   family:"perc",   register:"high",    fn:"groove-thread",
             instrument:["shaker and triangle accents","a light frame-drum pulse"], timbre:[], priority:"decorative" },
  pads:    { role:"pads",   family:"pad",    register:"mid",     fn:"harmony-bed",
             instrument:["analogue pads","layered synth pads"], timbre:["lush","evolving"], priority:"core" },
  harmony: { role:"harmony",family:"harmony",register:"mid",     fn:"chord-movement",
             text:["a slow minor-to-relative-major progression over eight-bar cycles",
                   "suspended add9 voicings opening into a major-seventh resolution",
                   "wide-open sus2 voicings holding before a delayed resolve"], priority:"core" },
  strings: { role:"strings",family:"strings",register:"mid",     fn:"support-bed",
             instrument:["a sweeping string bed","layered strings"], timbre:["soft"], priority:"support" },
  texture: { role:"texture",family:"texture",register:"low-mid", fn:"sustain-under",
             instrument:["a low pipe-organ sustain","a cor-anglais layer"], timbre:[], priority:"decorative" },
  lead:    { role:"motif",  family:"lead",   register:"upper-mid",fn:"foreground-melody",
             instrument:["a Rhodes electric-piano motif","an arpeggiated synth lead","a soft piano motif"],
             timbre:["warm"], priority:"core" },
  // COUNTER — clarinet was over-rendering. Level is an ATTRIBUTE: low register +
  // pianissimo + buried + occasional, so it answers without dominating.
  counter: { role:"counter",family:"counter",register:"low",     fn:"answer",
             instrument:["a cello counter-melody","a clarinet counter-line"], timbre:[], priority:"support",
             prominence:"background", mix:"faint and buried well under the mix",
             dynamic:"pianissimo", density:"answering only occasionally" },
  colour:  { role:"colour", family:"colour", register:"high",    fn:"accent",
             instrument:["an occasional glockenspiel accent","a brief flute line","a short tubular-bell tone"],
             timbre:[], priority:"decorative", chance:0.5 },
  movement:{ role:"movement",family:"production",register:"n/a", fn:"movement",
             text:["wide stereo panning and slow filter modulation across the pads",
                   "LFO, chorus and phaser movement evolving across the synth layers"], priority:"support" },
};

// ---- OVERLAY ATOM TABLES (represented as ingredients, not sentences) ------
// signature:true -> hoists to the front; foundational:true on a bass -> displaces.
const OVERLAYS = {
  moroder: {
    label:"Giorgio Moroder (composer)",
    atoms: {
      ov_bass:   { role:"bass",   family:"bass",   fn:"foundation-drive",
                   instrument:"an arpeggiated analog synth-bass sequence driving the pulse",
                   priority:"signature", foundational:true, signature:true, prominence:"foreground" },
      ov_harm:   { role:"harmony",family:"harmony",fn:"chord-movement",
                   text:"a simple minor vamp with filtered chord pumps",
                   priority:"signature", signature:true },
      ov_lead:   { role:"motif",  family:"lead",   fn:"foreground-melody",
                   instrument:"a filtered sawtooth synth lead", priority:"support" }, // collides w/ Rhodes -> YIELDS
      ov_colour: { role:"colour", family:"perc-accent", fn:"accent",
                   instrument:"handclap and tambourine accents on the backbeat",
                   priority:"decorative" },
      ov_arc:    { role:"arc", fn:"arc", text:"the sequence running unbroken while the layers stack over it",
                   priority:"support" },
    }
  }
};

const REL = {
  foundation:    { needs:["bass","drums"], render:"locked in a soft, spacious pocket that anchors without intruding" },
  arc:           { needs:["pad"],          render:"a slow dynamic arc, layers stacking to a lush peak then receding" },
  harmonyResolve:{ needs:["lead","harmony"],render:"the melody stating a phrase and the chords swelling to meet and resolve it" },
};
const MASTERING = "Polished Dolby Atmos-Master Atmos -2dB";

// ---- HOLDING AREA --------------------------------------------------------
function collect(seed, overlayId){
  const roll = mulberry32(seed);
  const pick = a => Array.isArray(a) ? a[Math.floor(roll()*a.length)] : a;
  const held = [];
  const push = (key, a, source) => {
    if (a.chance!=null && roll()>=a.chance) return;
    held.push({ key, source, role:a.role, family:a.family||null, register:a.register||null, fn:a.fn||null,
      priority:a.priority||"support", instrument:a.instrument?pick(a.instrument):null, text:a.text?pick(a.text):null,
      timbre:(a.timbre||[]).slice(), prominence:a.prominence||"foreground", mix:a.mix||null,
      dynamic:a.dynamic||null, density:a.density||null,
      foundational:!!a.foundational, signature:!!a.signature });
  };
  for (const [k,a] of Object.entries(ATOMS)) push(k,a,"engine");
  if (overlayId && OVERLAYS[overlayId])
    for (const [k,a] of Object.entries(OVERLAYS[overlayId].atoms)) push(k,a,"overlay");
  return held;
}

// ---- RECONCILE (pure data) ----------------------------------------------
function reconcile(held){
  // 1) one voice per family — highest priority survives (signature > core > ...).
  //    A tie keeps the engine atom. This single rule expresses both the
  //    foundational DISPLACE (overlay bass is 'signature') and the YIELD
  //    (overlay lead is 'support', loses to the engine 'core' lead).
  const survivor = new Map();
  for (const at of held){
    if (!at.family) continue;
    const cur = survivor.get(at.family);
    if (!cur || RANK[at.priority] < RANK[cur.priority]) survivor.set(at.family, at);
  }
  let kept = held.filter(at => !at.family || survivor.get(at.family)===at);
  // 2) cap timbre words globally (each affect word once; never if the noun has it)
  const used=new Set();
  for (const at of kept){
    at.timbre = at.timbre.filter(w=>{ const k=w.toLowerCase();
      if(used.has(k)) return false;
      if(at.instrument && at.instrument.toLowerCase().includes(k)){ used.add(k); return false; }
      used.add(k); return true; });
  }
  return kept;
}

// ---- COMPOSE -------------------------------------------------------------
function wt(at){
  if(!at.instrument) return at.text||"";
  if(!at.timbre.length) return at.instrument;
  const adj=at.timbre[0]; const s=at.instrument.replace(/^(a |an )/i,"");
  const had=/^(a |an )/i.test(at.instrument); const art=/^[aeiou]/i.test(adj)?"an ":"a ";
  return (had?art:"")+adj+" "+s;
}
function counterClause(c){
  const bits=[c.instrument];
  if(c.dynamic) bits.push(c.dynamic);
  if(c.mix) bits.push(c.mix);
  const tail = c.density ? `${c.density} in a distant call-and-response with the lead`
                         : "answering the lead in call-and-response";
  return `${bits.join(", ")}, ${tail}`;
}
function compose(held){
  const fams=new Set(held.map(a=>a.family).filter(Boolean));
  const has=f=>fams.has(f);
  const A=k=>held.find(a=>a.key===k);
  const ownerOf=f=>held.find(a=>a.family===f);
  const sig = f => { const o=ownerOf(f); return o&&o.signature?o:null; };
  const cl=[];
  cl.push(A("genre").text, A("tempo").text);

  // signature carriers hoisted to the front (Lever 1): bass drive + harmony
  const sigBass=sig("bass"), sigHarm=sig("harmony");
  if(sigBass) cl.push(sigBass.instrument);
  if(sigHarm) cl.push(sigHarm.text||sigHarm.instrument);

  // foundation — if the bass was hoisted, reference the sequence instead of re-naming a bass
  const bass=ownerOf("bass"), groove=A("groove");
  if(groove){
    if(sigBass) cl.push(`${groove.instrument} locking to the sequence`);
    else if(bass) cl.push(`${wt(bass)} and ${groove.instrument}, ${REL.foundation.render}`);
  }
  const perc=ownerOf("perc"); if(perc) cl.push(`${perc.instrument} threading the groove`);

  // lead (engine core survives family reconcile)
  const lead=ownerOf("lead"); if(lead) cl.push(`${wt(lead)} carrying the melody out front`);

  // pads + harmony (skip harmony here if a signature harmony was hoisted)
  const pads=ownerOf("pad"), harm=ownerOf("harmony");
  if(pads||harm){ let h=pads?wt(pads):"";
    if(harm && !sigHarm) h=(h?`${h} moving through `:"")+ (harm.text||harm.instrument);
    if(h) cl.push(h); }

  const strings=ownerOf("strings"); if(strings) cl.push(`${wt(strings)} beneath the harmony`);
  const texture=ownerOf("texture"); if(texture) cl.push(`${texture.instrument} sustaining under the chords`);

  const counter=ownerOf("counter");
  if(counter && lead) cl.push(counterClause(counter));

  const colour=ownerOf("colour")||ownerOf("perc-accent");
  if(colour) cl.push(`${colour.instrument} in the gaps`);
  const movement=A("movement"); if(movement) cl.push(movement.text);

  // arc — overlay arc wins if present, else engine arc relation
  const ovArc=A("ov_arc");
  if(ovArc) cl.push(ovArc.text);
  else { if(REL.harmonyResolve.needs.every(has)) cl.push(REL.harmonyResolve.render);
         if(REL.arc.needs.every(has)) cl.push(REL.arc.render); }
  if(ovArc && REL.harmonyResolve.needs.every(has)) cl.push(REL.harmonyResolve.render);

  cl.push(MASTERING);
  return cl.filter(Boolean).join(", ").replace(/\s+/g," ").replace(/\s*,\s*/g,", ").trim();
}

const run=(seed,ov)=>{ const out=compose(reconcile(collect(seed,ov)));
  console.log(`--- ${ov?ov:"no-overlay"} seed ${seed} (len ${out.length}) ---\n${out}\n`); };
run(7);            // clarinet fix, bare
run(7,"moroder");  // + Moroder overlay atoms (displace + yield + signature)

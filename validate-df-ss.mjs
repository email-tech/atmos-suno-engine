import { DEEPFOREST } from './engines/deepforest.js';
import { SACREDSPIRIT } from './engines/sacredspirit.js';
import { DELERIUM } from './engines/delerium.js';
import { ERA } from './engines/era.js';
import { build, resolveArrangement } from './core/resolver.js';
import { ALWAYS_BAN, BEATLESS_BAN } from './core/constants.js';

const palettes = ['electronic','acoustic','blend'];
// non-musical content that must NEVER appear in a positive prompt (project rule)
const NONMUSICAL = ['field recording','vinyl crackle','tape hiss','room tone','foley','birdsong','rainfall','nature sound','jungle sounds','crickets'];
const resWords = ['resolv','cadence','lift','final chord','landing','released','settl','home'];

function run(ENG) {
  const chars = Object.keys(ENG.characters);
  const banned = [...ALWAYS_BAN, ...ENG.sourceNegative.map(s=>s.toLowerCase())];
  let over=0, bannedLeak=0, beatlessLeak=0, nonMusical=0, noRes=0, noVoice=0, min=1e9, max=0, n=0;
  for (const id of chars) for (const p of palettes) for (let s=0;s<400;s++){
    const {style,length,overLimit,arrangement}=build(ENG,{characterId:id,palette:p,seed:s*7+1});
    n++; if(overLimit)over++; min=Math.min(min,length); max=Math.max(max,length);
    const low=style.toLowerCase();
    if(banned.some(b=>low.includes(b)))bannedLeak++;
    if(NONMUSICAL.some(b=>low.includes(b)))nonMusical++;
    if(arrangement.beatless && BEATLESS_BAN.some(b=>new RegExp('\\b'+b+'\\b').test(low)))beatlessLeak++;
    if(!resWords.some(w=>low.includes(w)))noRes++;
    if(!arrangement.voice)noVoice++;
  }
  console.log(`\n=== ${ENG.id} ===`);
  console.log(`draws=${n} over1000=${over} bannedLeak=${bannedLeak} beatlessLeak=${beatlessLeak} nonMusicalLeak=${nonMusical} noResolution=${noRes} noVoice=${noVoice} len=${min}-${max}`);

  const sig=(id,seed)=>{const a=resolveArrangement(ENG,{characterId:id,palette:'electronic',seed});return a.pads+'|'+a.voice+'|'+a.lead+'|'+a.movement;};
  console.log('-- cross-character collisions (200 seeds; unlisted = 0) --');
  for(let i=0;i<chars.length;i++)for(let j=i+1;j<chars.length;j++){
    let same=0; for(let s=0;s<200;s++) if(sig(chars[i],s*13+5)===sig(chars[j],s*13+5))same++;
    if(same>0) console.log(`  ${ENG.characters[chars[i]].label} vs ${ENG.characters[chars[j]].label}: ${same}/200`);
  }
  console.log('-- within-character unique styles / 200 seeds --');
  for(const id of chars){const set=new Set();for(let s=0;s<200;s++)set.add(build(ENG,{characterId:id,palette:'electronic',seed:s*3+2}).style);
    console.log(`  ${ENG.characters[id].label}: ${set.size}/200`);}
  console.log('-- one sample per character (blend) --');
  for(const id of chars){const {style,length}=build(ENG,{characterId:id,palette:'blend',seed:42});
    console.log(`\n[${ENG.characters[id].label}] (${length})\n${style}`);}
}

run(DEEPFOREST);
run(SACREDSPIRIT);

// character-identity check: signature instrument families must actually show up
function freq(ENG, id, needle, seeds=600){
  let hit=0; for(let s=0;s<seeds;s++){const st=build(ENG,{characterId:id,palette:'blend',seed:s*5+1}).style.toLowerCase(); if(needle.some(w=>st.includes(w)))hit++;}
  return (100*hit/seeds).toFixed(0)+'%';
}
console.log('\n=== signature-instrument presence (blend, 600 draws each) ===');
console.log('DF Bohemian: cimbalom/violin/accordion  ', freq(DEEPFOREST,'bohemianFusion',['cimbalom','folk violin','accordion','clarinet','gypsy-jazz']));
console.log('DF Comparsa: steel pan/brass/conga/nylon', freq(DEEPFOREST,'comparsaCarnival',['steel-pan','steel pan','brass','conga','nylon']));
console.log('DF Nocturne: kalimba/flute/panpipe      ', freq(DEEPFOREST,'forestNocturne',['kalimba','flute','panpipe','ocarina','marimba']));
console.log('SS all: cedar flute/cello/chant         ', ['ceremonialPrelude','winterCeremony','chantGroove','shamanicElevation','circleDance'].map(c=>c+'='+freq(SACREDSPIRIT,c,['cedar flute','cello','chant','yoik','vocable'])).join('  '));

// cross-ENGINE distinctness: a Deep Forest style must not read as Sacred Spirit / Era / Delerium
console.log('\n=== cross-engine style collisions (400 seeds) ===');
const engs=[DEEPFOREST,SACREDSPIRIT,ERA,DELERIUM];
const styles={};
for(const E of engs){const set=new Set();for(const id of Object.keys(E.characters))for(let s=0;s<400;s++)set.add(build(E,{characterId:id,palette:'blend',seed:s*11+3}).style);styles[E.id]=set;}
for(let i=0;i<engs.length;i++)for(let j=i+1;j<engs.length;j++){
  const a=styles[engs[i].id], b=styles[engs[j].id];
  let same=0; for(const x of a) if(b.has(x)) same++;
  console.log(`  ${engs[i].id} vs ${engs[j].id}: ${same} identical styles`);
}

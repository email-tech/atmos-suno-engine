import { DELERIUM } from './engines/delerium.js';
import { build, resolveArrangement } from './core/resolver.js';
import { ALWAYS_BAN, BEATLESS_BAN } from './core/constants.js';

const chars = Object.keys(DELERIUM.characters);
const palettes = ['electronic','acoustic','blend'];
const banned = [...ALWAYS_BAN, 'trance','four-on-the-floor','supersaw','big-room','pop hooks'];

let over=0, bannedLeak=0, beatlessLeak=0, min=1e9, max=0, n=0;
for (const id of chars) for (const p of palettes) for (let s=0;s<400;s++){
  const {style,length,overLimit,arrangement}=build(DELERIUM,{characterId:id,palette:p,seed:s*7+1});
  n++; if(overLimit)over++; min=Math.min(min,length); max=Math.max(max,length);
  const low=style.toLowerCase();
  if(banned.some(b=>low.includes(b)))bannedLeak++;
  if(arrangement.beatless && BEATLESS_BAN.some(b=>new RegExp('\\b'+b+'\\b').test(low)))beatlessLeak++;
}
console.log(`draws=${n} over1000=${over} bannedLeak=${bannedLeak} beatlessLeak=${beatlessLeak} len=${min}-${max}`);

// cross-character distinctness: for each pair, over 200 seeds, how often do pads+voice+movement all match?
function sig(id,seed){const a=resolveArrangement(DELERIUM,{characterId:id,palette:'electronic',seed});return a.pads+'|'+a.voice+'|'+a.movement;}
console.log('\n-- shared pad+voice+movement across character pairs (200 seeds, lower=more distinct) --');
for(let i=0;i<chars.length;i++)for(let j=i+1;j<chars.length;j++){
  let same=0; for(let s=0;s<200;s++) if(sig(chars[i],s*13+5)===sig(chars[j],s*13+5))same++;
  if(same>0) console.log(`${DELERIUM.characters[chars[i]].label} vs ${DELERIUM.characters[chars[j]].label}: ${same}/200`);
}
console.log('(pairs not listed = 0 collisions)');

// within-character variety: unique full styles over 200 seeds
console.log('\n-- within-character unique styles / 200 seeds --');
for(const id of chars){const set=new Set();for(let s=0;s<200;s++)set.add(build(DELERIUM,{characterId:id,palette:'electronic',seed:s*3+2}).style);console.log(`${DELERIUM.characters[id].label}: ${set.size}/200`);}

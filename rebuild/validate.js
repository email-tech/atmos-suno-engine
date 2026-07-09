import { DELERIUM } from './engines/delerium.js';
import { build } from './core/resolver.js';
import { ALWAYS_BAN } from './core/constants.js';

const chars = Object.keys(DELERIUM.characters);
const palettes = ['electronic','acoustic','blend'];
let max = 0, over = 0, beatLeak = 0, banLeak = 0, n = 0;

// stress: 400 draws per character per palette
for (const ch of chars) for (const pal of palettes) {
  for (let i = 0; i < 400; i++) {
    const { style, arrangement, length, overLimit } = build(DELERIUM, { characterId: ch, palette: pal, seed: i * 7 + 1 });
    n++; max = Math.max(max, length);
    if (overLimit) over++;
    if (arrangement.beatless && /\b(drums|kick|snare|percussion|beat)\b/i.test(style)) beatLeak++;
    if (ALWAYS_BAN.some(b => style.toLowerCase().includes(b))) banLeak++;
  }
}
console.log(`draws=${n}  maxLen=${max}/1000  overLimit=${over}  beatlessLeak=${beatLeak}  banLeak=${banLeak}`);

console.log('\n--- one sample per character (electronic, seed 42) ---');
for (const ch of chars) {
  const b = build(DELERIUM, { characterId: ch, palette: 'electronic', seed: 42 });
  console.log(`\n[${DELERIUM.characters[ch].label}]  (${b.length} chars)`);
  console.log('STYLE   :', b.style);
  console.log('NEGATIVE:', b.negative);
}

console.log('\n--- palette contrast: Worldbeat Ritual, seed 42 ---');
for (const pal of palettes) {
  const b = build(DELERIUM, { characterId: 'worldbeatRitual', palette: pal, seed: 42 });
  console.log(`\n[${pal}]`, b.style);
}

console.log('\n--- control levels: Ethereal, pads+lead locked, rest randomized ---');
const locked = build(DELERIUM, { characterId: 'ethereal', palette: 'electronic', seed: 5,
  locks: { pads: 'glassy digital pad with shimmering high partials', lead: 'sparse grand-piano figure' } });
console.log(locked.style);

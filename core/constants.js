export const ALWAYS_BAN = [
  'field recordings','air texture','room tone','foley','sound effects',
  'vinyl crackle','tape hiss','nature sounds','ambient noise',
];
export const BEATLESS_BAN = ['drums','kick','beat','percussion','snare'];
export const MASTERING = 'Polished Dolby Atmos-Master Atmos -2dB.';
export const CHAR_LIMIT = 1000;

// deterministic RNG so a seed reproduces an arrangement (needed for re-roll + locks)
export function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

// palette filter: keep options that fit the chosen palette; never empty a role
export function filterPalette(options, palette) {
  const keep = options.filter(o =>
    palette === 'blend' ? true :
    palette === 'electronic' ? (o.d === 'E' || o.d === 'B') :
    /* acoustic */ (o.d === 'A' || o.d === 'B'));
  return keep.length ? keep : options;
}

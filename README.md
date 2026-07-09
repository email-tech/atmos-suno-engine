# ATMOS Suno Style Engine — multi-engine shell

One shell, all engines. Download-ZIP → open `index.html` (no install, no server).

## Engine kinds (Option B)
- **resolver** — the engine-agnostic resolver (`core/resolver.js`). Structured arrangement → woven style string, driven by per-role locks + palette. **Delerium** runs here; **Era** and **Deep Forest** slot in the same way once authored.
- **legacy** — the proven cluster/classic path, harvested verbatim. **Balearic** (Flavour cluster / Classic mix fork) and **Enigma** (preset-driven).
- **stub** — registered scope, not yet built (Era, Deep Forest).

## Controls
- Resolver: character, palette (Electronic/Acoustic/Blend), control level (Randomize all / Lock some / Full manual via per-role locks), Generate, Re-roll.
- Legacy Balearic: build-mode fork + palette + cluster/preset/phase/slots.
- Legacy Enigma: Engine preset (drives cluster) + phase + palette.
- Output: Style prompt (with /1000 meter) · separate Negative prompt · Lyrics field (`[Instrumental]`).

## Layout
```
index.html  css/  js/            shell (registry, state, generate, ui, app + app.bundle.js)
core/                            resolver + constants (engine-agnostic)
engines/delerium.js              resolver engine data
legacy/                          proven Balearic/Enigma modules (verbatim)
build.mjs                        IIFE-registry bundler (file://-safe)
validate.js                      Delerium headless validation
archive/                         previous single-app build (reference only)
```

## Rebuild after editing source
```
node build.mjs        # regenerates js/app.bundle.js
node validate.js      # Delerium resolver checks
```
`app.bundle.js` is generated — edit the source modules, not the bundle.

## Bolt-on points (no rebuild of the above)
- Composer/Producer/Remixer modifier overlays: operate on the structured arrangement / finished style string within the 1000-char budget.
- Lyric + Metatag engine: consumes engine output; interplay language reinforced there later.

# ATMOS rebuild (new multi-engine app, from scratch)

Work-in-progress core for the reset-directive rebuild. The working legacy app
stays at repo root and on `main` HEAD; nothing here touches it.

- `engines/delerium.js` — Delerium engine spec: bounded master palette, 5
  character pools (Option B), per-character interplay layer, drum families,
  anti-trance/pop negatives, render order.
- `core/constants.js` — ALWAYS_BAN, BEATLESS_BAN, mastering tail, seeded RNG,
  palette filter (electronic/acoustic/blend).
- `core/resolver.js` — engine-agnostic: resolveArrangement (structured) →
  renderStyle / renderNegative. Three control levels via per-role locks.
- `validate.js` — DOM-free harness (node rebuild/validate.js).

Status: core + interplay validated (6000 draws, 0 over-limit, 0 beatless
leaks, 0 banned leaks, max 639/1000). UI + multi-engine shell not yet built.

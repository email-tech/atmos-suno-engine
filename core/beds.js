/* ==========================================================================
 * beds.js — THE SHARED BED LIBRARY (the pad layer).
 *
 * WHY THIS EXISTS (John, 2026-07-22 / 2026-07-23):
 *
 * A PAD IS DEFINED BY FUNCTION, NOT BY SOUND SOURCE. John's canonical test:
 *     sustained duration + slow attack and release + background placement +
 *     rich chordal harmony.
 * Whether it is a synth, a string section, a choir or a drone is irrelevant.
 * Synth pads, string pads, vocal pads and ambient pads are ALL pads.
 *
 * And in John's model CORE == PAD. The core of a modifier IS its sustained
 * ensemble bed, and that bed is LARGELY SHARED between artists — most orchestral
 * writers sit on something like a string section, or strings and horns. The bed is
 * common ground, not a differentiator. The fingerprint lives in the SIGNATURE
 * (subtle solo instruments as decoration, harmony or melody), not in the body.
 *
 * WHAT THIS REPLACES (audited 2026-07-23, all counted in code):
 *   - 86 of 96 gen-2 cores emitted TWO OR THREE simultaneous sustained voices —
 *     a strings atom, a texture atom AND a pads atom, all fn:'sustain-under'.
 *     Three beds at once on top of whatever the character already brought. That
 *     density, not mix level, is the likely cause of Suno round 3's 'pads
 *     unrecognisable' and 'instrumentation hit and miss'.
 *   - 29 pairs inside a single core named the same family twice
 *     ('a muted brass section' + 'a sustained muted brass section').
 *   - 5 pad slots held struck/plucked, fast-attack, DECAYING instruments —
 *     celesta, harp, vibraphone, electric piano. Prefixing them with the word
 *     'sustained' does not make them sustain. These are decoration and belong in
 *     the signature.
 *   - Producer and remixer beds had collapsed into interchangeable adjective mush
 *     ('a warm sustained pad' authored verbatim for four different artists).
 *
 * THE RULE THIS MODULE ENFORCES
 *   ONE core, ONE bed, drawn from this shared library. Two artists may share a
 *   bed — that is the point. Nothing enters this library unless it passes the
 *   functional test above.
 *
 * BEHAVIOUR, NOT JUST A NAME
 *   Round 3 showed that naming an instrument in the pad slot does not make Suno
 *   render it AS a pad. Each bed therefore carries `behaviour` — how it moves and
 *   where it sits — which compose() threads into the style string. Atoms still
 *   hold pure instrument names (standing project rule); compose still owns all
 *   prose. `behaviour` is authored here as data for compose to use, never
 *   concatenated into `instrument`.
 *
 *   Mix placement is deliberately LOW. John: 'there was a pad present, I could
 *   not tell what it comprised, it was so low in the mix' — being low in the mix
 *   is CORRECT pad behaviour by his own definition. The fix is not more level, it
 *   is richer harmonic content and an audible slow swell.
 *
 * PALETTE
 *   'acoustic' beds are suppressed on electronic-only builds and vice versa;
 *   'any' beds pass everywhere. This continues the round-3 fix that stopped
 *   synthesis vocabulary leaking onto acoustic builds.
 * ========================================================================*/

export const BEDS = {

  // ---- string pads ---------------------------------------------------------
  muted_strings: {
    label: 'Muted string section',
    instrument: 'a muted mid-register string section',
    palette: 'acoustic',
    behaviour: 'swelling slowly and sitting low behind the melody',
  },
  lush_strings: {
    label: 'Lush string section',
    instrument: 'a lush sustained string section',
    palette: 'acoustic',
    behaviour: 'holding long rich chords low under everything else',
  },
  low_strings: {
    label: 'Low sustained strings',
    instrument: 'a deep sustained low string section',
    palette: 'acoustic',
    behaviour: 'held long and dark underneath, rising and falling slowly',
  },

  // ---- strings + horns (the commonest orchestral bed) ----------------------
  strings_horns: {
    label: 'Strings and held horns',
    instrument: 'a string section with held french horns',
    palette: 'acoustic',
    behaviour: 'swelling together in slow rich chords well behind the melody',
  },

  // ---- brass pads ----------------------------------------------------------
  brass_chorale: {
    label: 'Held brass chorale',
    instrument: 'a held brass chorale',
    palette: 'acoustic',
    behaviour: 'entering slowly and sustaining low under the arrangement',
  },
  low_brass: {
    label: 'Low sustained brass',
    instrument: 'a sustained low brass section',
    palette: 'acoustic',
    behaviour: 'held long and heavy underneath, swelling in gradually',
  },

  // ---- woodwind and organ pads --------------------------------------------
  woodwind_bed: {
    label: 'Sustained woodwind ensemble',
    instrument: 'a sustained woodwind ensemble',
    palette: 'acoustic',
    behaviour: 'holding soft chords quietly beneath the melody',
  },
  organ_bed: {
    label: 'Sustained organ',
    instrument: 'a sustained chamber organ',
    palette: 'acoustic',
    behaviour: 'holding long unbroken chords far back in the mix',
  },

  /* ---- NON-ORCHESTRAL ACOUSTIC BEDS (John, 2026-08-17) --------------------
   * WHY THESE EXIST. John: "Are there any pad sounds or instruments that can
   * also be used in the acoustic selection? This is light on options." He is
   * right, and the shape of the gap mattered more than the count: of the eight
   * acoustic beds above, SIX are orchestral sections (strings x3, strings +
   * horns, brass x2), plus a woodwind ensemble and a chamber organ. Only the
   * wordless choir was non-orchestral.
   *
   * That put the bed layer directly at odds with the engine's own defence.
   * Every Balearic build ships rank-1 orchestral negatives unconditionally
   * (core/knowledge.js ORCHESTRAL_NEGATIVES, shipped 2026-08-15), and
   * CONVENTION_BLEED records that naming an orchestral instrument imports the
   * entire orchestral production convention rather than just that instrument.
   * Three steps of the Balearic reliability pass stripped orchestral content
   * out of the positive field; the acoustic bed library is where it walked
   * back in — negating orchestral convention in one field while naming a lush
   * sustained string section in the other.
   *
   * EVIDENCE STATE: RESEARCH_CANDIDATE, every one of them. The repo's own
   * knowledge base has nothing on acoustic pads — docs/knowledge/instrument-
   * family-linking-guide.md is explicitly an ORCHESTRAL guide and treats
   * sustained strings as *the* harmonic pad, so it is the source of the
   * assumption rather than a check on it. These are music-domain reasoning,
   * not tested facts, and none has been through Suno. They are added so John
   * can run identical-seed before/after pairs swapping ONLY the bed.
   *
   * EXCLUDED BY STANDING RULE: harmonium, pump organ, shruti box, bandoneon
   * and accordion are all free-reed and banned as a family. Bowed crotales,
   * glass harmonica and bowed psaltery are the piercing profile John named
   * ("I'm not keen on so-called pads that have a piercing nature to their
   * sound and profile like accordions"). Hurdy-gurdy is buzzy in the same way.
   * ---------------------------------------------------------------------- */
  steel_swells: {
    label: 'Pedal-steel swells',
    // The strongest candidate. A volume pedal removes the attack entirely, so
    // this is genuinely sustained with slow attack and release, and it is
    // chordal — John's own functional definition of a pad, met without naming
    // an orchestral section. Lap steel is already proven in the acoustic
    // texture pool, so the instrument is established in this palette; only the
    // BEHAVIOUR was never modelled as a bed. Balearic-native rather than
    // cinematic.
    instrument: 'pedal-steel guitar chords',
    palette: 'acoustic',
    behaviour: 'swelling in on the volume pedal with no attack, holding wide chords behind the melody',
  },
  close_choir: {
    label: 'Close wordless voices',
    // The wordless choir above was doing all the non-orchestral work alone.
    // Close-miked low-dynamic voices have no attack transient, sustain
    // naturally and are properly chordal. This is what the Balearic canon
    // actually uses as a bed.
    instrument: 'close wordless female voices',
    palette: 'acoustic',
    behaviour: 'holding soft open vowels in slow chords well behind the melody',
  },
  low_voice_bed: {
    label: 'Low wordless voices',
    instrument: 'a low wordless male vocal layer',
    palette: 'acoustic',
    behaviour: 'held long and dark, opening slowly wide underneath everything else',
  },
  /* BOWED VIBRAPHONE CONSIDERED AND REJECTED, 2026-08-17. It was in the first
   * draft of this set: bowing a vibraphone genuinely does sustain, unlike
   * striking it. validate-modifiers' DECAYING check blocked it, and that check
   * is correct to. Its whole reason for existing is the earlier error of
   * prefixing struck instruments with the word 'sustained' and calling them
   * pads — 5 pad slots held decaying instruments before Phase A. Carving a
   * bowed-technique exception into a rule John already paid for, to admit a
   * candidate I proposed myself, is not a trade worth making. If it is ever
   * wanted, it needs his sign-off on the exception, not a quiet regex edit. */
  low_flute_bed: {
    label: 'Alto and bass flutes',
    // Distinct from woodwind_bed above, which reads as an orchestral section.
    // Breathy and warm, and specifically the register that avoids piercing.
    instrument: 'alto and bass flutes',
    palette: 'acoustic',
    behaviour: 'holding long soft chords, fading in slowly low behind the arrangement',
  },
  low_clarinet_bed: {
    label: 'Low clarinet bed',
    /* JOHN'S CALL, 2026-08-17: "You can add the low clarinet for testing
     * purposes and I'll make a call on it once I've heard it in some context."
     * FLAGGED, not quietly reinstated. Clarinet was removed from this engine
     * as too dominant, and the standing rule is that a confirmed removal is
     * respected on reintroduction. The bass clarinet is a different instrument
     * in practice — low, warm, sustaining, no piercing register — which is why
     * it is worth testing, but it shares a headword with a banned instrument
     * and MUST NOT be treated as settled by a future session. It is here on
     * John's explicit authorisation, pending his listening test, and comes out
     * again if it behaves like the clarinet did. */
    instrument: 'low bass clarinets',
    palette: 'acoustic',
    behaviour: 'holding warm dark chords quietly underneath',
  },

  // ---- vocal pads ----------------------------------------------------------
  wordless_choir: {
    label: 'Wordless choir',
    instrument: 'a wordless sustained choir',
    palette: 'any',
    behaviour: 'holding slow open chords low behind the arrangement',
  },

  // ---- synth pads ----------------------------------------------------------
  warm_analog_pad: {
    label: 'Warm analog synth pad',
    instrument: 'a warm analog synth pad',
    palette: 'electronic',
    behaviour: 'fading in slowly and holding wide chords under the mix',
  },
  bright_synth_pad: {
    label: 'Bright synth pad',
    instrument: 'a bright wide synth pad',
    palette: 'electronic',
    behaviour: 'swelling in and sustaining behind the lead',
  },
  filtered_pad: {
    label: 'Deep filtered pad',
    instrument: 'a deep filtered synth pad',
    palette: 'electronic',
    behaviour: 'opening slowly across long held chords, low in the mix',
  },
  synth_choir_pad: {
    label: 'Synthetic choir pad',
    instrument: 'a synthetic choir pad',
    palette: 'electronic',
    behaviour: 'fading in and holding soft vocal chords far behind the melody',
  },

  // ---- hybrid and ambient pads --------------------------------------------
  hybrid_pad: {
    label: 'Hybrid synth-orchestra pad',
    instrument: 'a hybrid synth-and-strings pad',
    palette: 'any',
    behaviour: 'building slowly into wide sustained chords underneath',
  },
  drone_bed: {
    label: 'Low ambient drone',
    instrument: 'a low sustained drone',
    palette: 'any',
    behaviour: 'holding one unbroken low tone beneath everything',
  },
};

export const BED_IDS = Object.keys(BEDS);

// Build the single pad atom for a core. Returns null for an unknown id so an
// authoring slip degrades to 'no bed' rather than throwing mid-build.
export function bedAtom(bedId) {
  const b = BEDS[bedId];
  if (!b) return null;
  return {
    role: 'pads', family: 'pad', fn: 'sustain-under', priority: 'core',
    instrument: b.instrument, behaviour: b.behaviour, bedId,
    palette: b.palette,
  };
}

// A bed is only admissible on a palette it belongs to. 'any' passes everywhere.
export function bedAllowed(bedId, palette) {
  const b = BEDS[bedId];
  if (!b) return false;
  return b.palette === 'any' || !palette || b.palette === palette;
}

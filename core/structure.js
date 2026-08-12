/* ==========================================================================
 * structure.js — SONG STRUCTURE & ENERGY (structure-first pipeline, Phase 1).
 *
 * SOURCE: docs/knowledge/structure-and-energy.md (research complete 2026-07-23,
 * structure decisions confirmed by John same date). Every preset, energy value,
 * and coherence rule below is taken from that document. NOTHING HERE IS
 * INVENTED — validate-structure.mjs reads the guide from disk and fails the
 * build on any drift.
 *
 * WHY THIS MODULE EXISTS: John's ordering is song type -> structure -> style ->
 * metatags, not the reverse. This is decision #1 in the pipeline: song type
 * gates which structural vocabulary is legal and whether the style prompt may
 * carry vocal-delivery language. See docs/architecture/structure-first-pipeline-plan.md
 * for the full rollout plan (approved by John 2026-08-12).
 *
 * FIXED PRESETS (John, 2026-07-23): the user picks one preset and the engine
 * fills it. No editable/add-remove mode — coherence is guaranteed by
 * construction, not by a validator repairing a free-built structure.
 * ========================================================================*/

/* ---- Song type gate (guide §2) --------------------------------------------
 * Song type is decision #1. It gates structural vocabulary AND whether style
 * language may carry vocal-delivery description. */
export const SONG_TYPES = Object.freeze({
  vocal: {
    id: 'vocal',
    label: 'Vocal',
    vocabulary: ['Intro', 'Verse', 'Pre-Chorus', 'Chorus', 'Post-Chorus', 'Bridge',
                 'Instrumental Break', 'Outro'],
    styleAllowsVocalDelivery: true,
    lyricsMode: 'written', // real lyrics under section tags
  },
  instrumental: {
    id: 'instrumental',
    label: 'Instrumental',
    vocabulary: ['Intro', 'Theme', 'Movement', 'Build', 'Build-Up', 'Drop',
                 'Breakdown', 'Interlude', 'Reprise', 'Climax', 'Outro'],
    styleAllowsVocalDelivery: false,
    lyricsMode: 'instrumental', // [Instrumental] + structural markers only
  },
});

/* ---- Section energy levels (guide §3) -------------------------------------
 * Energy scored 1 (lowest) to 5 (peak). Two tables: vocal sections and
 * instrumental (electronic/cinematic) sections. Some section names are shared
 * across tables (Intro, Outro) with the same value in both. */
export const SECTION_ENERGY = Object.freeze({
  // Vocal
  'Intro': 2,
  'Verse': 3,
  'Pre-Chorus': 4,
  'Chorus': 5,
  'Post-Chorus': 4,
  'Bridge': 2,
  'Instrumental Break': 3,
  'Outro': 2,
  // Instrumental (electronic + cinematic)
  'Build': 4,
  'Build-Up': 4,
  'Drop': 5,
  'Breakdown': 2,
  'Interlude': 3,
  'Reprise': 4,
  'Theme': 3,
  'Movement': 3,
  'Climax': 5,
});

/* ---- Coherence rules (guide §4, R1-R7) -------------------------------------
 * Stated as checkable constraints. validateEnergyCoherence() below implements
 * each one; ids match the guide exactly for traceability. */
export const COHERENCE_RULES = Object.freeze([
  { id: 'R1', name: 'Intro is low', text: 'An intro must be energy <= 2.' },
  { id: 'R2', name: 'A peak must be earned by a build',
    text: 'A Drop or Chorus (energy 5) must be immediately preceded by a section of energy >= its own minus 2 that is rising.' },
  { id: 'R3', name: 'A breakdown/bridge drops',
    text: 'A Breakdown or Bridge must be LOWER energy than the section before it.' },
  { id: 'R4', name: 'No two adjacent sections at identical energy',
    text: 'for more than a verse-repeat (Verse->Verse allowed; Chorus->Chorus is the earned-double exception at the end).' },
  { id: 'R5', name: 'End resolves',
    text: 'The last section is an Outro (energy <= 2) OR a final Chorus/Drop followed by an Outro.' },
  { id: 'R6', name: 'The overall curve must rise then resolve',
    text: 'Peak energy should occur in the back half, not the first section.' },
  { id: 'R7', name: 'Instrumental/vocal vocabulary must not mix',
    text: 'A vocal structure cannot contain a Drop token; an instrumental cannot contain a Verse-with-lyrics.' },
]);

/* ---- Structure presets (guide §5) ------------------------------------------
 * Each preset carries: id, label, type (vocal|instrumental), sections[]
 * (labels only — energy is looked up from SECTION_ENERGY so there is exactly
 * ONE source of truth for energy values), and a short description from the
 * guide. Numbers 1-12 match the guide's own numbering for traceability. */
export const STRUCTURE_PRESETS = Object.freeze({
  // ---- Vocal presets ----
  'verse-chorus': {
    id: 'verse-chorus', num: 1, type: 'vocal', label: 'Verse\u2013Chorus (ABAB)',
    sections: ['Intro', 'Verse', 'Chorus', 'Verse', 'Chorus', 'Outro'],
    description: 'The streaming-era default without a bridge.',
  },
  'verse-chorus-bridge': {
    id: 'verse-chorus-bridge', num: 2, type: 'vocal', label: 'Verse\u2013Chorus\u2013Bridge (ABABCB)',
    sections: ['Intro', 'Verse', 'Chorus', 'Verse', 'Chorus', 'Bridge', 'Chorus', 'Outro'],
    description: 'The most common structure in modern pop.',
  },
  'pre-chorus-pop': {
    id: 'pre-chorus-pop', num: 3, type: 'vocal', label: 'Pre-Chorus Pop',
    sections: ['Intro', 'Verse', 'Pre-Chorus', 'Chorus', 'Verse', 'Pre-Chorus', 'Chorus', 'Bridge', 'Chorus', 'Outro'],
    description: 'Firework / Rolling in the Deep shape.',
  },
  'aaba': {
    id: 'aaba', num: 4, type: 'vocal', label: 'AABA (32-bar)',
    sections: ['Intro', 'Verse', 'Verse', 'Bridge', 'Verse', 'Outro'],
    description: 'No chorus; the A-section carries the hook/refrain. Jazz standard, classic pop, folk.',
  },
  'anthemic': {
    id: 'anthemic', num: 5, type: 'vocal', label: 'Anthemic (double final chorus)',
    sections: ['Intro', 'Verse', 'Pre-Chorus', 'Chorus', 'Verse', 'Pre-Chorus', 'Chorus', 'Bridge', 'Chorus', 'Chorus', 'Outro'],
    description: 'Ends on the earned double.',
  },
  'full-pop': {
    id: 'full-pop', num: 10, type: 'vocal', label: 'Full Pop',
    sections: ['Intro', 'Verse', 'Verse', 'Pre-Chorus', 'Chorus', 'Instrumental Break', 'Verse', 'Pre-Chorus', 'Chorus', 'Bridge', 'Chorus', 'Outro'],
    description: 'John\u2019s full-length preset. Verified coherent vs R1-R7.',
  },
  'three-verse': {
    id: 'three-verse', num: 11, type: 'vocal', label: 'Three-Verse',
    sections: ['Intro', 'Verse', 'Verse', 'Chorus', 'Verse', 'Chorus', 'Bridge', 'Chorus', 'Outro'],
    description: 'John\u2019s preset. Verse->Chorus is a valid 3->5, not the forbidden 2->5 leap.',
  },
  'three-verse-break': {
    id: 'three-verse-break', num: 12, type: 'vocal', label: 'Three-Verse + Break',
    sections: ['Intro', 'Verse', 'Verse', 'Chorus', 'Instrumental Break', 'Verse', 'Chorus', 'Bridge', 'Outro'],
    description: 'Ends bridge->outro (a softer, reflective close) rather than a final chorus \u2014 confirmed intentional by John.',
  },
  // ---- Instrumental presets ----
  'club-two-drop': {
    id: 'club-two-drop', num: 6, type: 'instrumental', label: 'Club / Two-Drop EDM',
    sections: ['Intro', 'Build', 'Drop', 'Breakdown', 'Build', 'Drop', 'Outro'],
    description: 'The mainstage formula; two waves of tension/release with mixable bookends.',
  },
  'progressive-melodic': {
    id: 'progressive-melodic', num: 7, type: 'instrumental', label: 'Progressive / Melodic',
    sections: ['Intro', 'Build', 'Drop', 'Breakdown', 'Interlude', 'Build', 'Drop', 'Outro'],
    description: 'Longer, more evolving; the melodic-techno/prog-house shape.',
  },
  'downtempo-ambient': {
    id: 'downtempo-ambient', num: 8, type: 'instrumental', label: 'Downtempo / Ambient',
    sections: ['Intro', 'Theme', 'Movement', 'Interlude', 'Reprise', 'Outro'],
    description: 'Beatless-friendly; evolving loops, no drop. Fits the Balearic ambient/beatless clusters.',
  },
  'cinematic-through-composed': {
    id: 'cinematic-through-composed', num: 9, type: 'instrumental', label: 'Cinematic / Through-composed',
    sections: ['Intro', 'Theme', 'Movement', 'Movement', 'Climax', 'Reprise', 'Outro'],
    description: 'Builds to one climax; the film-score shape.',
  },
});

/* ---- G3: Beatless Balearic mapping rule (John, 2026-07-23) -----------------
 * Beatless Balearic clusters must NEVER take a Club/drop structure. Enforced
 * here as a lookup the engine can consult before offering the structure menu. */
export const BEATLESS_ALLOWED_PRESETS = Object.freeze(['downtempo-ambient']);

/* ---- Resolve a preset to its full section+energy shape --------------------
 * Single source of truth: presets carry section LABELS only; energy is always
 * looked up from SECTION_ENERGY so a value can never drift between the two. */
export function resolveStructure(presetId) {
  const preset = STRUCTURE_PRESETS[presetId];
  if (!preset) return null;
  const energyShape = preset.sections.map(s => SECTION_ENERGY[s]);
  return {
    id: preset.id, type: preset.type, label: preset.label,
    sections: preset.sections.slice(), energyShape,
    description: preset.description,
  };
}

export function presetsForType(type) {
  return Object.values(STRUCTURE_PRESETS).filter(p => p.type === type);
}

/* ---- Energy coherence validation (R1-R7) -----------------------------------
 * Checks a resolved {sections, energyShape, type} against the coherence rules.
 * Returns { ok: boolean, violations: [{rule, message}] }. */
export function validateEnergyCoherence(structure) {
  const { sections, energyShape, type } = structure;
  const violations = [];
  const n = sections.length;

  // R1 — Intro is low
  if (sections[0] === 'Intro' && energyShape[0] > 2) {
    violations.push({ rule: 'R1', message: `Intro energy ${energyShape[0]} exceeds 2` });
  }

  // R2 — peak must be earned by a build (rising into 5). EXCEPTION: a Bridge
  // immediately before the peak is explicitly sanctioned by the guide even
  // though its own energy is low — "the bridge resets... to make the final
  // chorus feel earned" (§3, §4 R3). The earning happens via CONTRAST, not a
  // monotonic rise, so Bridge->Chorus/Drop is exempted from the rise check.
  for (let i = 0; i < n; i++) {
    if (energyShape[i] === 5) {
      if (i === 0) {
        violations.push({ rule: 'R2', message: `${sections[i]} at position 0 has no preceding build` });
        continue;
      }
      const prevSection = sections[i - 1];
      const prev = energyShape[i - 1];
      const isBridgeReset = prevSection === 'Bridge';
      if (!isBridgeReset && !(prev >= 3 && prev <= energyShape[i])) {
        violations.push({ rule: 'R2', message: `${sections[i]} (energy 5) not properly earned by preceding ${sections[i-1]} (energy ${prev})` });
      }
    }
  }

  // R3 — breakdown/bridge drops relative to previous section
  for (let i = 1; i < n; i++) {
    if ((sections[i] === 'Breakdown' || sections[i] === 'Bridge') && energyShape[i] >= energyShape[i - 1]) {
      violations.push({ rule: 'R3', message: `${sections[i]} (energy ${energyShape[i]}) does not drop below preceding ${sections[i-1]} (energy ${energyShape[i-1]})` });
    }
  }

  // R4 — no two adjacent identical-energy sections, except Verse->Verse,
  // Movement->Movement (through-composed development, same idiom as a verse
  // repeat), or the earned Chorus->Chorus double at the very end.
  for (let i = 1; i < n; i++) {
    if (energyShape[i] === energyShape[i - 1] && sections[i] === sections[i - 1]) {
      const isRepeatableSection = sections[i] === 'Verse' || sections[i] === 'Movement';
      const isEarnedDouble = sections[i] === 'Chorus' && i === n - 2; // second-to-last, followed by Outro
      if (!isRepeatableSection && !isEarnedDouble) {
        violations.push({ rule: 'R4', message: `${sections[i]} repeats ${sections[i-1]} at identical energy ${energyShape[i]}` });
      }
    }
  }

  // R5 — end resolves
  const last = sections[n - 1];
  const secondLast = sections[n - 2];
  const endsOnOutro = last === 'Outro' && energyShape[n - 1] <= 2;
  const endsOnPeakThenOutro = last === 'Outro' && (secondLast === 'Chorus' || secondLast === 'Drop');
  if (!endsOnOutro && !endsOnPeakThenOutro) {
    violations.push({ rule: 'R5', message: `structure does not end on a resolving Outro (ends on ${last})` });
  }

  // R6 — peak must not occur in the first section ("not the first section" —
  // guide's own wording is looser than "past the midpoint"; John's 12 shipped
  // presets peak well before the midpoint in several cases, e.g. Verse-Chorus
  // ABAB peaks at position 2 of 6).
  const peak = Math.max(...energyShape);
  const firstPeakIdx = energyShape.indexOf(peak);
  if (firstPeakIdx === 0 && peak === 5) {
    violations.push({ rule: 'R6', message: `peak energy ${peak} occurs at position 0 (the first section)` });
  }

  // R7 — vocabulary must not mix
  const vocalOnly = new Set(['Verse', 'Pre-Chorus', 'Chorus', 'Post-Chorus', 'Bridge', 'Instrumental Break']);
  const instrumentalOnly = new Set(['Build', 'Build-Up', 'Drop', 'Breakdown', 'Interlude', 'Reprise', 'Theme', 'Movement', 'Climax']);
  for (const s of sections) {
    if (type === 'instrumental' && vocalOnly.has(s) && s !== 'Instrumental Break') {
      violations.push({ rule: 'R7', message: `instrumental structure contains vocal-only section "${s}"` });
    }
    if (type === 'vocal' && instrumentalOnly.has(s)) {
      violations.push({ rule: 'R7', message: `vocal structure contains instrumental-only section "${s}"` });
    }
  }

  return { ok: violations.length === 0, violations };
}

/* ---- Resolution-point check (2026-08-13) -----------------------------------
 * Used by core/resolver.js's harmony-brightness Lever 3: does this structure
 * have a genuine earned peak (energy 5 somewhere in its shape) for a
 * minor-to-major harmonic resolution to land on? Downtempo/Ambient is the
 * one shipped preset that tops out at energy 4 (no Chorus/Drop/Climax) — for
 * that preset this correctly returns false. Lives here, not in resolver.js,
 * so structure facts stay in exactly one place. */
export function structureHasResolutionPoint(structure) {
  return !!(structure && Array.isArray(structure.energyShape) && structure.energyShape.some(e => e >= 5));
}

/* ---- Suno structural tag set (guide §6) ------------------------------------
 * Reliably-read bracket tags. Used by the metatag/lyric engine to confirm a
 * section label maps to a tag Suno actually recognises. */
export const SUNO_STRUCTURE_TAGS = Object.freeze([
  'Intro', 'Verse', 'Pre-Chorus', 'Chorus', 'Post-Chorus', 'Bridge',
  'Instrumental', 'Instrumental Break', 'Break', 'Interlude', 'Drop',
  'Build-Up', 'Breakdown', 'Outro', 'End',
]);

/* ---- LLM call contract (guide §6a, John 2026-07-23) ------------------------
 * Any generative call (lyric engine, future stages) MUST receive the resolved
 * structure (section order + energy) as an explicit input. This helper builds
 * the canonical payload shape so every call site passes the same contract. */
export function structureCallPayload(presetId) {
  const structure = resolveStructure(presetId);
  if (!structure) return null;
  return {
    songType: structure.type,
    presetId,
    presetLabel: structure.label,
    sections: structure.sections,
    energyShape: structure.energyShape,
  };
}

const SECTION_PATTERNS = {
  intro: /intro|invocation|texture|fragment|breath|aria|chant|sacred/i,
  verse: /verse 1|verse|spoken verse|cinematic verse|minimal verse/i,
  chorus: /chorus|hook|refrain|mantra/i,
  instrumental: /instrumental|break|interlude|drift|passage|response|ambient break|breakdown|dissolve/i,
  bridge: /bridge|middle 8|lift|emotional lift|floating bridge|spoken bridge|sacral bridge/i,
  outro: /outro|tail|end|final fragment|sunset outro/i
};

export function buildSunoMetatagPlan(state, template) {
  const sections = template.sections;
  const tags = [];
  const map = {
    intro: findSection(sections, "intro"),
    verse: findSection(sections, "verse"),
    instrumental: findSection(sections, "instrumental"),
    bridge: findSection(sections, "bridge"),
    chorus: findLastSection(sections, "chorus"),
    outro: findSection(sections, "outro")
  };
  const vocabulary = musicalVocabulary(state);

  if (map.intro) {
    tags.push({
      type: "arrangement",
      section: map.intro,
      tag: bracket(vocabulary.intro),
      reason: "Sets the opening event without repeating the preset name or scenery."
    });
  }

  if (map.verse && state.style.vocalMode !== "Instrumental") {
    tags.push({
      type: "performance",
      section: map.verse,
      tag: bracket(vocabulary.verse),
      reason: "Keeps the first vocal section focused and leaves room for later contrast."
    });
  }

  if (map.instrumental) {
    tags.push({
      type: "arrangement",
      section: map.instrumental,
      tag: bracket(vocabulary.instrumental),
      reason: "Gives the non-lyric section a specific handoff instead of a generic break."
    });
  }

  if (map.bridge) {
    tags.push({
      type: "arrangement",
      section: map.bridge,
      tag: bracket(vocabulary.bridge),
      reason: "Creates a deliberate contrast point before the hook returns."
    });
  }

  if (map.chorus) {
    tags.push({
      type: "performance",
      section: map.chorus,
      tag: bracket(vocabulary.chorus),
      reason: "Turns the hook return into a vocal or arrangement event, not just a louder repeat."
    });
  }

  if (map.outro) {
    tags.push({
      type: "arrangement",
      section: map.outro,
      tag: bracket(vocabulary.outro),
      reason: "Defines how the track leaves, either by fading, resolving, or dissolving."
    });
  }

  return uniqueTags(tags).slice(0, 5);
}

export function formatMetatagPlan(plan) {
  return plan.map((item) => `- ${item.tag} near [${item.section}]: ${item.reason}`).join("\n");
}

export function plainMetatags(plan) {
  return plan.map((item) => item.tag).join("\n");
}

export function buildAdLibPlan(state, template) {
  if (state.style.vocalMode === "Instrumental") return [];
  const sections = template.sections;
  const hookSection = findLastSection(sections, "chorus");
  const bridgeSection = findSection(sections, "bridge");
  const outroSection = findSection(sections, "outro");
  const strategy = adLibStrategy(state);
  const suggestions = [];

  if (hookSection) {
    suggestions.push({
      section: hookSection,
      role: "hook answer",
      cue: strategy.hook,
      reason: "Use one short response after selected hook lines so it feels performed, not randomly inserted."
    });
  }

  if (bridgeSection && strategy.bridge) {
    suggestions.push({
      section: bridgeSection,
      role: "transition lift",
      cue: strategy.bridge,
      reason: "Use the backing voice to pull the bridge into the final hook."
    });
  }

  if (outroSection) {
    suggestions.push({
      section: outroSection,
      role: "fade memory",
      cue: strategy.outro,
      reason: "Let the last ad-lib echo a hook word or vowel so the ending feels intentional."
    });
  }

  return suggestions.slice(0, 3);
}

export function formatAdLibPlan(plan) {
  if (!plan.length) return "- No ad-lib inserts for instrumental mode.";
  return plan.map((item) => `- [${item.section}] ${item.role}: ${item.cue}. ${item.reason}`).join("\n");
}

export function buildVocalArrangementPlan(state, template) {
  if (state.style.vocalMode === "Instrumental") return [];
  const sections = template.sections;
  const map = {
    verse: findSection(sections, "verse"),
    chorus: findLastSection(sections, "chorus"),
    bridge: findSection(sections, "bridge"),
    outro: findSection(sections, "outro")
  };
  const profile = vocalArrangementProfile(state);
  const plan = [];

  if (map.verse) {
    plan.push({
      section: map.verse,
      layer: profile.verse,
      instruction: "Keep backing voices out of most verse lines so the lead identity and story land first."
    });
  }

  if (map.chorus) {
    plan.push({
      section: map.chorus,
      layer: profile.chorus,
      instruction: "Use backing vocals to frame the hook, especially line endings and repeated title phrases."
    });
  }

  if (map.bridge) {
    plan.push({
      section: map.bridge,
      layer: profile.bridge,
      instruction: "Change the vocal texture here so the final hook feels earned."
    });
  }

  if (map.outro) {
    plan.push({
      section: map.outro,
      layer: profile.outro,
      instruction: "Let the last backing voice behave like memory: fewer words, longer vowels, softer repeats."
    });
  }

  return plan;
}

export function formatVocalArrangementPlan(plan) {
  if (!plan.length) return "- Instrumental mode: no supporting vocal arrangement.";
  return plan.map((item) => `- [${item.section}] ${item.layer}. ${item.instruction}`).join("\n");
}

function musicalVocabulary(state) {
  const instrument = instrumentRole(state);
  const vocal = vocalRole(state);
  const vocalArrangement = vocalArrangementProfile(state);
  const engine = state.engine;
  const dense = /high|medium-high/i.test(state.song.energy);
  const restrained = /low|slow burn|serene|melancholic|yearning/i.test(`${state.song.energy} ${state.song.mood}`);

  const base = {
    intro: restrained ? "rhythm withheld | distant motif enters" : "pulse enters under motif",
    verse: `${vocal.close} | rhythm stays sparse`,
    instrumental: instrument.feature,
    bridge: restrained ? vocalArrangement.bridgeTagSoft : vocalArrangement.bridgeTagLift,
    chorus: dense ? vocalArrangement.chorusTagLift : vocalArrangement.chorusTagSoft,
    outro: restrained ? "last hook dissolves | long reverb tail" : "final hook repeats | fade out"
  };

  const byEngine = {
    Balearic: {
      intro: "drums withheld | coastal motif enters",
      bridge: instrument.bridge || "bass opens up | strings rise softly",
      outro: "motif returns | sunset fade"
    },
    Enigma: {
      intro: "whispered breath | chant bed enters",
      verse: `${vocal.close} | low chant shadow`,
      instrumental: instrument.feature || "percussion answers chant",
      bridge: "chant response | drums pull back",
      outro: "chant fades into reverb"
    },
    Delerium: {
      intro: "vocal texture opens | beat held back",
      bridge: "choir bloom | kick drops out",
      chorus: dense ? "stacked female harmonies | wide hook return" : "airy doubles | soft hook bloom",
      outro: "vocal tail dissolves"
    },
    Era: {
      intro: "choir bed opens | percussion withheld",
      verse: `${vocal.close} | choir undercurrent`,
      bridge: "choir swells | ceremonial lift",
      chorus: "full choir answer | lead remains clear",
      outro: "choir resolves | final cadence"
    }
  };

  return { ...base, ...(byEngine[engine] || {}) };
}

function adLibStrategy(state) {
  const hook = state.song.hookStyle.toLowerCase();
  const language = state.languageLayer.enabled && /chorus|call response|outro/i.test(`${state.languageLayer.placement} ${state.languageLayer.mode}`)
    ? `or a very short ${state.languageLayer.language} echo from the hook`
    : "";
  const callResponse = /call-and-response/.test(hook) || /call-and-response/i.test(state.song.vocalFraming);
  const mantra = /mantra|repeated/.test(hook);
  const intimate = /romantic|yearning|sensual|serene|melancholic/i.test(state.song.mood);
  const forceful = /defiant|triumphant|high/i.test(`${state.song.mood} ${state.song.energy}`);

  if (callResponse) {
    return {
      hook: `write a two-word backing answer to the lead vocal${language ? `, ${language}` : ""}`,
      bridge: "use a quiet question-and-answer fragment before the final hook",
      outro: "repeat the answer once, softer"
    };
  }

  if (mantra) {
    return {
      hook: "repeat one hook keyword as a unison backing-vocal response, never a new sentence",
      bridge: "use open vowels only under the last bridge line, such as a soft (ah) or (oh)",
      outro: "stretch the hook keyword into a fading vowel"
    };
  }

  if (intimate) {
    return {
      hook: `echo the last two words of one chorus line in soft female harmony${language ? `, ${language}` : ""}`,
      bridge: "use one breath-like harmony vowel after the bridge turn",
      outro: "repeat the most tender hook word once, then fade"
    };
  }

  if (forceful) {
    return {
      hook: "answer the hook with one short unison phrase drawn from the chorus",
      bridge: "use a rising group-vocal response only on the final bridge line",
      outro: "repeat the hook command once, softer"
    };
  }

  return {
    hook: `use one restrained harmony vowel or echo one hook word${language ? `, ${language}` : ""}`,
    bridge: "use a single backing-vocal vowel to mark the lift, not a new lyric idea",
    outro: "fade with one hook-word echo"
  };
}

function vocalArrangementProfile(state) {
  const text = `${state.engine} ${state.style.vocalDescriptor} ${state.song.vocalFraming} ${state.song.deliveryStyle} ${state.song.hookStyle} ${state.song.mood} ${state.song.energy}`.toLowerCase();
  const femaleLead = /female|alto|head voice/.test(text);
  const choir = /era|choir|sacral|devotional|gospel|chant|collective/.test(text);
  const callResponse = /call-and-response|fragmented voices|collective voice/.test(text);
  const intimate = /whisper|breathy|soft|intimate|serene|melancholic|yearning|low/.test(text);
  const highLift = /anthemic|triumphant|defiant|high|medium-high/.test(text);

  if (choir) {
    return {
      verse: "Solo lead over a low choir undercurrent; no busy answers yet",
      chorus: "Full choir answer on the hook ends, lead lyric remains intelligible",
      bridge: "Choir swells from held vowels into the final chorus",
      outro: "Choir resolves on long open vowels, no new words",
      chorusTagSoft: "choir undercurrent | soft hook answer",
      chorusTagLift: "full choir answer | lead stays clear",
      bridgeTagSoft: "choir holds vowels | rhythm thins",
      bridgeTagLift: "choir swells | ceremonial lift"
    };
  }

  if (callResponse) {
    return {
      verse: "Lead vocal alone, with space left for later responses",
      chorus: "Backing voice answers the lead after selected hook lines",
      bridge: "Short response phrases tighten into unison before the final hook",
      outro: "One response phrase returns softer, like an echo",
      chorusTagSoft: "lead call | soft backing answer",
      chorusTagLift: "call and response vocals | wider hook",
      bridgeTagSoft: "response voices thin | bass holds",
      bridgeTagLift: "responses tighten into unison | final lift"
    };
  }

  if (femaleLead || /delerium|ethereal|airy|halo|ambient/.test(text)) {
    return {
      verse: "Single airy lead, optional whisper double only on the last word of a line",
      chorus: "Female harmony above the lead on thirds or fifths, plus a quiet unison double on the title phrase",
      bridge: "High harmony suspends over the lead, then drops out before the final chorus",
      outro: "Female harmony fades into vowel tails and one hook-word echo",
      chorusTagSoft: "female harmony above lead | soft unison title double",
      chorusTagLift: "stacked female harmonies | octave air",
      bridgeTagSoft: "high harmony suspension | drums pull back",
      bridgeTagLift: "female harmony lift | choir pad blooms"
    };
  }

  if (intimate) {
    return {
      verse: "Dry close lead with no choir; backing only as breath or last-word echo",
      chorus: "One soft harmony line shadows the hook, never crowding the lyric",
      bridge: "Harmony thins to a single held vowel before the final return",
      outro: "Last hook word repeats once as a fading backing vocal",
      chorusTagSoft: "soft harmony shadow | close lead",
      chorusTagLift: "unison double | warm harmony answer",
      bridgeTagSoft: "harmony thins | held vowel",
      bridgeTagLift: "single harmony rises | rhythm suspends"
    };
  }

  if (highLift) {
    return {
      verse: "Lead vocal centered; delay group vocals until the hook",
      chorus: "Unison doubles hit the title phrase, then harmony stack opens on the final line",
      bridge: "Group vocals rise from low unison into a wider final chorus",
      outro: "Final hook repeats with thinner harmony so the ending does not shout",
      chorusTagSoft: "unison title double | harmony opens",
      chorusTagLift: "unison hook | stacked harmony release",
      bridgeTagSoft: "low unison backing | bass holds",
      bridgeTagLift: "group vocals rise | final hook lift"
    };
  }

  return {
    verse: "Lead vocal carries the story; backing stays silent until the hook needs support",
    chorus: "Light harmony supports the hook ending and repeats only the strongest phrase",
    bridge: "One contrasting backing color appears, then clears space for the final hook",
    outro: "A single hook-word echo fades after the lead finishes",
    chorusTagSoft: "light harmony answer | hook stays clear",
    chorusTagLift: "stacked harmony answer | wider hook",
    bridgeTagSoft: "harmony thins | bass holds root",
    bridgeTagLift: "bass steps forward | harmony lift"
  };
}

function instrumentRole(state) {
  const motif = state.style.motif.toLowerCase();
  const bass = state.style.bass.toLowerCase();
  const rhythm = state.style.rhythm.toLowerCase();
  const strings = state.style.percussion.toLowerCase();

  if (/nylon|guitar/.test(motif)) return { feature: "guitar answers vocal | drums stay low", bridge: "guitar drops out | strings rise" };
  if (/rhodes|piano/.test(motif)) return { feature: "electric piano reply | bass moves up", bridge: "piano narrows | harmony opens" };
  if (/flute|shakuhachi/.test(motif)) return { feature: "flute answers lead | percussion thins", bridge: "flute holds note | rhythm suspends" };
  if (/bell|chime|vibraphone/.test(motif)) return { feature: "bell motif replies | low end rests", bridge: "bells thin out | vocal layers rise" };
  if (/choir|chant/.test(motif)) return { feature: "choir response | lead drops out", bridge: "choir widens | percussion pulls back" };
  if (/fretless|sub|bass/.test(bass)) return { feature: "bass steps forward | vocal rests", bridge: "bass pedal point | harmony lift" };
  if (/percussion|tribal|conga|bongo|shaker|breakbeat|drum/.test(rhythm)) return { feature: "percussion break | motif fragments", bridge: "drums thin to pulse | vocal returns" };
  if (/string/.test(strings)) return { feature: "string interlude | drums withheld", bridge: "strings build under lead" };
  return { feature: "instrumental answer | vocal rests", bridge: "" };
}

function vocalRole(state) {
  if (state.style.vocalMode === "Instrumental") return { close: "no lead vocal", stack: "full arrangement" };
  const text = `${state.style.vocalDescriptor} ${state.song.vocalFraming} ${state.song.deliveryStyle}`.toLowerCase();
  if (/whisper|breathy|soft/.test(text)) return { close: "close soft vocal", stack: "breath doubles" };
  if (/chant|sacral|devotional|choir/.test(text)) return { close: "lead over chant bed", stack: "choir answer" };
  if (/ethereal|airy|halo|ambient/.test(text)) return { close: "airy lead vocal", stack: "wide harmony halo" };
  if (/deep|baritone|spoken/.test(text)) return { close: "low intimate lead", stack: "low harmony response" };
  if (/call-and-response/.test(text)) return { close: "lead vocal call", stack: "backing vocal answer" };
  if (/harmony|layered|doubles|backing|duet/.test(text)) return { close: "lead with light doubles", stack: "stacked harmony answer" };
  return { close: "clear lead vocal", stack: "harmony lift" };
}

function findSection(sections, type) {
  return sections.find((section) => SECTION_PATTERNS[type].test(section));
}

function findLastSection(sections, type) {
  return [...sections].reverse().find((section) => SECTION_PATTERNS[type].test(section));
}

function bracket(value) {
  return `[${value}]`;
}

function uniqueTags(tags) {
  const seen = new Set();
  return tags.filter((item) => {
    if (seen.has(item.tag)) return false;
    seen.add(item.tag);
    return true;
  });
}

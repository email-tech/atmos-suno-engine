export function applyCompatibilityRules(state, engine, trigger = "") {
  const changes = [];
  if (!engine) return changes;
  const fullPass = /^(boot|load|import|reset|rebuild|randomize|engine)$/.test(trigger);

  if (fullPass || trigger === "style.phase" || !engine.bass.includes(state.style.bass)) {
    changes.push(...alignBassToPhase(state, engine));
  }

  if (fullPass || trigger === "style.vocalMode" || trigger === "style.vocalGender" || trigger === "style.vocalDescriptor" || trigger === "style.percussion" || trigger === "song.vocalFraming" || trigger === "song.deliveryStyle" || !engine.percussion.includes(state.style.percussion)) {
    changes.push(...alignVocalBlend(state, engine));
    changes.push(...alignLyricVocalControls(state));
  }

  if (state.style.vocalMode === "Instrumental") {
    changes.push(...alignInstrumentalState(state, engine));
  }

  return changes;
}

export function compatibilitySummary(state) {
  const phase = phaseBand(state.style.phase);
  const vocal = vocalProfile(state);
  return [
    `Tempo band: ${phase.label}`,
    `Vocal role: ${vocal.label}`,
    `Conflict policy: tempo controls bass/rhythm weight; vocal archetype controls vocal blend, lyric framing, and delivery.`
  ].join("\n");
}

function alignBassToPhase(state, engine) {
  const current = state.style.bass;
  const replacement = chooseByPhase(engine.bass, phaseBand(state.style.phase));
  if (replacement && replacement !== current) {
    state.style.bass = replacement;
    return [`Bass support aligned to ${phaseBand(state.style.phase).label}.`];
  }
  return [];
}

function alignVocalBlend(state, engine) {
  const current = state.style.percussion;
  const profile = vocalProfile(state);
  const replacement = chooseVocalBlend(engine.percussion, profile);
  if (replacement && replacement !== current) {
    state.style.percussion = replacement;
    return [`Strings / vocal blend aligned to ${profile.label}.`];
  }
  return [];
}

function alignLyricVocalControls(state) {
  const profile = vocalProfile(state);
  const target = lyricTargets(profile);
  const changes = [];

  if (target.framing && state.song.vocalFraming !== target.framing) {
    state.song.vocalFraming = target.framing;
    changes.push(`Vocal framing aligned to ${target.framing}.`);
  }
  if (target.delivery && state.song.deliveryStyle !== target.delivery) {
    state.song.deliveryStyle = target.delivery;
    changes.push(`Delivery style aligned to ${target.delivery}.`);
  }

  return changes;
}

function alignInstrumentalState(state, engine) {
  const changes = [];
  if (state.song.vocalFraming !== "Gender-neutral") {
    state.song.vocalFraming = "Gender-neutral";
    changes.push("Vocal framing set neutral for instrumental mode.");
  }
  if (state.song.deliveryStyle !== "Controlled and intimate") {
    state.song.deliveryStyle = "Controlled and intimate";
    changes.push("Delivery style neutralized for instrumental mode.");
  }
  const replacement = chooseByPhase(engine.bass, phaseBand(state.style.phase));
  if (replacement && replacement !== state.style.bass) {
    state.style.bass = replacement;
    changes.push("Instrumental bass support aligned to phase.");
  }
  return changes;
}

function chooseByPhase(options, phase) {
  if (!options?.length) return "";
  const scored = options.map((option, index) => ({ option, index, score: scoreBassOption(option, phase) }));
  scored.sort((a, b) => b.score - a.score || a.index - b.index);
  return scored[0].option;
}

function scoreBassOption(option, phase) {
  const text = option.toLowerCase();
  const tempoMatch = text.match(/(\d{2,3})\s*-\s*(\d{2,3})\s*BPM/i);
  if (tempoMatch) {
    const optionBpm = (Number(tempoMatch[1]) + Number(tempoMatch[2])) / 2;
    return 20 - Math.abs(optionBpm - phase.bpm);
  }
  let score = 0;
  if (phase.speed === "slow") {
    if (/slow|minimal|held|foundation|sub|double bass|soft|low-end warmth|atmospheric|understated/.test(text)) score += 4;
    if (/rhythmic|plucky|defined|pulse|movement|groove/.test(text)) score -= 2;
  }
  if (phase.speed === "mid") {
    if (/smooth|steady|warm|melodic|controlled|flowing|subtle/.test(text)) score += 4;
    if (/fast|urgent|maximum|very slow/.test(text)) score -= 2;
  }
  if (phase.speed === "fast") {
    if (/defined|rhythmic|pulse|plucky|hybrid|electric|fm bass|movement|groove|clear repeating|controlled lift/.test(text)) score += 4;
    if (/fretless|double bass|acoustic bass/.test(text)) score -= 2;
    if (/minimal|very slow|understated/.test(text)) score -= 3;
  }
  return score;
}

function chooseVocalBlend(options, profile) {
  if (!options?.length) return "";
  const scored = options.map((option, index) => ({ option, index, score: scoreBlendOption(option, profile) }));
  scored.sort((a, b) => b.score - a.score || a.index - b.index);
  return scored[0].option;
}

function scoreBlendOption(option, profile) {
  const text = option.toLowerCase();
  let score = 0;
  if (profile.kind === "solo") {
    if (/lead|forward|embedded|soft|subtle|sustained|slightly forward|low supporting/.test(text)) score += 4;
    if (/choir wall|full-spectrum|monumental|dense|maximum|layered male and female/.test(text)) score -= 3;
  }
  if (profile.kind === "harmony") {
    if (/layered|harmony|female vocal|male and female|choir and pad|supporting|bloom/.test(text)) score += 4;
    if (/no intimate pop lead|massed choir dominates|no dominant/.test(text)) score -= 2;
  }
  if (profile.kind === "choir") {
    if (/choir|chant|sacred|monumental|full-spectrum|grand layered|cathedral|devotional/.test(text)) score += 5;
    if (/close|solo|dry|slightly forward/.test(text)) score -= 2;
  }
  if (profile.kind === "texture") {
    if (/diffused|embedded|sustained|texture|blend|low articulation|pad mass|underwater/.test(text)) score += 5;
    if (/forward|dominant|dry|lead presence/.test(text)) score -= 2;
  }
  return score;
}

function lyricTargets(profile) {
  if (profile.kind === "choir") return { framing: "Choir shadows", delivery: "Chanted" };
  if (profile.kind === "harmony") return { framing: "Airy lead with backing phrases", delivery: "Ethereal" };
  if (profile.kind === "texture") return { framing: "Whispered layers", delivery: "Breathy" };
  if (profile.gender === "Male") return { framing: "Male lead", delivery: profile.delivery };
  if (profile.gender === "Female") return { framing: "Female lead", delivery: profile.delivery };
  return { framing: "Lead vocal centered", delivery: "Controlled and intimate" };
}

function vocalProfile(state) {
  if (state.style.vocalMode === "Instrumental") return { kind: "instrumental", gender: "", delivery: "Controlled and intimate", label: "instrumental" };
  const text = state.style.vocalDescriptor.toLowerCase();
  const gender = state.style.vocalGender;

  if (/choir|sacred|chant|operatic|devotional|gospel/.test(text)) return { kind: "choir", gender, delivery: "Chanted", label: `${gender.toLowerCase()} choir / devotional` };
  if (/harmony-stack|harmony|doubled|doubles|dream-pop|ambient trance|ethereal|soprano|falsetto/.test(text)) return { kind: "harmony", gender, delivery: "Ethereal", label: `${gender.toLowerCase()} harmony / air` };
  if (/whisper|breathy|diffused|spoken|trip-hop|detached/.test(text)) return { kind: "texture", gender, delivery: /cool|detached|trip-hop/.test(text) ? "Cool and detached" : "Breathy", label: `${gender.toLowerCase()} texture / intimate` };
  if (/gritty|gravelly|rock|belter|power|soul|r&b|gospel/.test(text)) return { kind: "solo", gender, delivery: "Warm and emotional", label: `${gender.toLowerCase()} expressive lead` };
  if (/cinematic|operatic/.test(text)) return { kind: "solo", gender, delivery: "Dramatic but restrained", label: `${gender.toLowerCase()} cinematic lead` };
  return { kind: "solo", gender, delivery: "Controlled and intimate", label: `${gender.toLowerCase()} lead` };
}

function phaseBand(text) {
  const match = String(text).match(/(\d{2,3})\s*-\s*(\d{2,3})\s*BPM/i);
  const bpm = match ? (Number(match[1]) + Number(match[2])) / 2 : 96;
  if (bpm < 88) return { speed: "slow", bpm, label: "slow / spacious" };
  if (bpm > 106) return { speed: "fast", bpm, label: "lifted / driving" };
  return { speed: "mid", bpm, label: "mid-tempo / balanced" };
}

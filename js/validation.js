export const PASS_THRESHOLD = 80;

export function parseClaudeJson(text) {
  const attempts = [
    text,
    text.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim(),
    sliceFirstJsonObject(text)
  ];

  for (const attempt of attempts) {
    if (!attempt) continue;
    try {
      return JSON.parse(attempt);
    } catch {
      continue;
    }
  }
  throw new Error("Claude returned malformed JSON. The raw response is available in the debug panel.");
}

export function normalizeClaudeResult(result) {
  return {
    title: String(result.title || ""),
    themeBrief: String(result.themeBrief || ""),
    lyrics: String(result.lyrics || ""),
    lyricMetaTags: String(result.lyricMetaTags || ""),
    validation: {
      score: Number(result.validation?.score || 0),
      passed: Boolean(result.validation?.passed),
      summary: String(result.validation?.summary || ""),
      issues: Array.isArray(result.validation?.issues) ? result.validation.issues : [],
      fixesApplied: Array.isArray(result.validation?.fixesApplied) ? result.validation.fixesApplied : []
    }
  };
}

export function validationPassed(validation) {
  return Boolean(validation?.passed) && Number(validation.score) >= PASS_THRESHOLD;
}

export function formatValidation(validation, repairStatus = "") {
  if (!validation) return "";
  const issues = validation.issues.length
    ? validation.issues.map((issue) => `- ${issue.category || "Issue"} (${issue.severity || "note"}): ${issue.note || issue}`).join("\n")
    : "- No issues reported.";
  const fixes = validation.fixesApplied?.length
    ? validation.fixesApplied.map((fix) => `- ${fix}`).join("\n")
    : "- None reported.";
  return [
    `Score: ${validation.score}`,
    `Status: ${validation.passed ? "Passed" : "Needs manual review"}`,
    repairStatus ? `Repair: ${repairStatus}` : "",
    `Summary: ${validation.summary}`,
    "Issues:",
    issues,
    "Fixes applied:",
    fixes
  ].filter(Boolean).join("\n");
}

export function localValidateLyrics(lyrics, state, template) {
  const issues = [];
  let score = 100;
  if (!lyrics.trim()) {
    return { score: 0, passed: false, summary: "No lyrics supplied.", issues: [{ category: "Lyrics", severity: "major", note: "The lyrics field is empty." }], fixesApplied: [] };
  }
  for (const section of template.sections) {
    const sectionPattern = new RegExp(`\\[${escapeRegExp(section)}(?::[^\\]]+)?\\]`, "i");
    if (!sectionPattern.test(lyrics)) {
      score -= 4;
      issues.push({ category: "Structure compliance", severity: "minor", note: `Missing [${section}] section label.` });
    }
  }
  if (state.song.cleanLanguage && /\b(fuck|shit|bitch|cunt)\b/i.test(lyrics)) {
    score -= 15;
    issues.push({ category: "Clean language", severity: "major", note: "Explicit language found while clean language is enabled." });
  }
  if (state.song.titleInChorus && state.song.title.trim() && !lyrics.toLowerCase().includes(state.song.title.toLowerCase())) {
    score -= 8;
    issues.push({ category: "Title usage", severity: "minor", note: "Title was requested in chorus but does not appear in the lyrics." });
  }
  if (/translation:|pronunciation:/i.test(lyrics)) {
    score -= 12;
    issues.push({ category: "No explanatory text", severity: "major", note: "Lyrics appear to include translation or pronunciation notes." });
  }
  const metatagCount = (lyrics.match(/^\[[^\]\n]+\]/gm) || []).filter((tag) => !template.sections.some((section) => tag === `[${section}]`)).length;
  if (metatagCount < 3) {
    score -= 10;
    issues.push({ category: "Suno metatags", severity: "major", note: "Lyrics should include at least 3 style-based Suno metatags inside the lyrics output." });
  }
  score = Math.max(0, score);
  return {
    score,
    passed: score >= PASS_THRESHOLD,
    summary: score >= PASS_THRESHOLD ? "Local validation passed." : "Local validation found items for review.",
    issues,
    fixesApplied: []
  };
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sliceFirstJsonObject(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  return start >= 0 && end > start ? text.slice(start, end + 1) : "";
}

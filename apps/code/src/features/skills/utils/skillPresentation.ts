import type { SkillOption } from "../../../types";

export const SKILL_REFERENCE_SCHEME = "skill://";

type SkillReferencePattern = {
  skill: SkillOption;
  label: string;
  normalizedLabel: string;
  priority: number;
};

export type SkillReferenceSegment =
  | {
      kind: "text";
      value: string;
    }
  | {
      kind: "skill";
      value: string;
      referenceName: string;
      skill: SkillOption;
    };

function normalizeSkillLookupValue(value: string) {
  return value.trim().toLowerCase();
}

function normalizeSkillPathLookupValue(value: string) {
  return value.trim().replace(/\\/g, "/").toLowerCase();
}

function findSkillByReferencePath(skills: SkillOption[], referencePath: string) {
  const normalizedReferencePath = normalizeSkillPathLookupValue(referencePath);
  if (!normalizedReferencePath) {
    return null;
  }
  return (
    skills.find((skill) => normalizeSkillPathLookupValue(skill.path) === normalizedReferencePath) ??
    null
  );
}

function titleCaseSkillToken(token: string) {
  if (!token) {
    return "";
  }
  if (/^\d/.test(token)) {
    return token.toUpperCase();
  }
  return `${token[0]?.toUpperCase() ?? ""}${token.slice(1)}`;
}

export function formatSkillDisplayName(value: string) {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return "";
  }
  return trimmedValue
    .split(/[-_/]+/)
    .filter(Boolean)
    .map((token) => titleCaseSkillToken(token))
    .join(" ");
}

function matchMarkdownSkillReference(value: string, start: number, skills: SkillOption[]) {
  if (value[start] !== "[") {
    return null;
  }
  const labelEnd = value.indexOf("](", start + 1);
  if (labelEnd <= start + 1) {
    return null;
  }
  const hrefEnd = value.indexOf(")", labelEnd + 2);
  if (hrefEnd <= labelEnd + 2) {
    return null;
  }
  const rawLabel = value.slice(start + 1, labelEnd).trim();
  const rawHref = value.slice(labelEnd + 2, hrefEnd).trim();
  if (!rawLabel || !rawHref) {
    return null;
  }
  if (!/SKILL\.md(?:[#?].*)?$/i.test(rawHref.replace(/\\/g, "/"))) {
    return null;
  }
  const referenceName = rawLabel.replace(/^\$/, "").trim();
  if (!referenceName) {
    return null;
  }
  const skill =
    findSkillByReferenceName(skills, referenceName) ?? findSkillByReferencePath(skills, rawHref);
  if (!skill) {
    return null;
  }
  return {
    end: hrefEnd + 1,
    skill,
    referenceName,
  };
}

function comparePatterns(left: SkillReferencePattern, right: SkillReferencePattern) {
  if (left.label.length !== right.label.length) {
    return right.label.length - left.label.length;
  }
  if (left.priority !== right.priority) {
    return left.priority - right.priority;
  }
  return left.normalizedLabel.localeCompare(right.normalizedLabel);
}

function isContinuationCharacter(character: string | undefined) {
  if (!character) {
    return false;
  }
  return /[A-Za-z0-9_/-]/.test(character);
}

function buildSkillReferencePatterns(skills: SkillOption[]) {
  const seen = new Set<string>();
  const patterns: SkillReferencePattern[] = [];

  skills.forEach((skill) => {
    const entries = [skill.name, ...(skill.aliases ?? [])];
    entries.forEach((label, index) => {
      const trimmedLabel = label.trim();
      if (!trimmedLabel) {
        return;
      }
      const normalizedLabel = normalizeSkillLookupValue(trimmedLabel);
      if (!normalizedLabel || seen.has(normalizedLabel)) {
        return;
      }
      seen.add(normalizedLabel);
      patterns.push({
        skill,
        label: trimmedLabel,
        normalizedLabel,
        priority: index,
      });
    });
  });

  return patterns.sort(comparePatterns);
}

export function findSkillByReferenceName(skills: SkillOption[], referenceName: string) {
  const normalizedReferenceName = normalizeSkillLookupValue(referenceName);
  if (!normalizedReferenceName) {
    return null;
  }
  return (
    skills.find((skill) => {
      if (normalizeSkillLookupValue(skill.name) === normalizedReferenceName) {
        return true;
      }
      return (skill.aliases ?? []).some(
        (alias) => normalizeSkillLookupValue(alias) === normalizedReferenceName
      );
    }) ?? null
  );
}

export function splitTextWithSkillReferences(
  value: string,
  skills: SkillOption[]
): SkillReferenceSegment[] {
  if ((!value.includes("$") && !value.includes("SKILL.md")) || skills.length === 0) {
    return [{ kind: "text", value }] satisfies SkillReferenceSegment[];
  }

  const patterns = buildSkillReferencePatterns(skills);
  if (patterns.length === 0) {
    return [{ kind: "text", value }] satisfies SkillReferenceSegment[];
  }

  const normalizedValue = value.toLowerCase();
  const segments: SkillReferenceSegment[] = [];
  let cursor = 0;
  let textStart = 0;

  while (cursor < value.length) {
    const markdownReference = matchMarkdownSkillReference(value, cursor, skills);
    if (markdownReference) {
      if (textStart < cursor) {
        segments.push({
          kind: "text",
          value: value.slice(textStart, cursor),
        });
      }

      segments.push({
        kind: "skill",
        value: value.slice(cursor, markdownReference.end),
        referenceName: markdownReference.referenceName,
        skill: markdownReference.skill,
      });

      cursor = markdownReference.end;
      textStart = markdownReference.end;
      continue;
    }

    if (value[cursor] !== "$" || value[cursor - 1] === "\\") {
      cursor += 1;
      continue;
    }

    const referenceStart = cursor + 1;
    const matchedPattern = patterns.find((pattern) => {
      const candidate = normalizedValue.slice(
        referenceStart,
        referenceStart + pattern.normalizedLabel.length
      );
      if (candidate !== pattern.normalizedLabel) {
        return false;
      }
      return !isContinuationCharacter(value[referenceStart + pattern.label.length]);
    });

    if (!matchedPattern) {
      cursor += 1;
      continue;
    }

    if (textStart < cursor) {
      segments.push({
        kind: "text",
        value: value.slice(textStart, cursor),
      });
    }

    const referenceEnd = referenceStart + matchedPattern.label.length;
    segments.push({
      kind: "skill",
      value: value.slice(cursor, referenceEnd),
      referenceName: value.slice(referenceStart, referenceEnd),
      skill: matchedPattern.skill,
    });

    cursor = referenceEnd;
    textStart = referenceEnd;
  }

  if (textStart < value.length) {
    segments.push({
      kind: "text",
      value: value.slice(textStart),
    });
  }

  return segments.length > 0
    ? segments
    : ([{ kind: "text", value }] satisfies SkillReferenceSegment[]);
}

export function formatSkillScopeLabel(scope?: SkillOption["scope"]) {
  if (scope === "workspace") {
    return "Project";
  }
  if (scope === "global") {
    return "Global";
  }
  return null;
}

export function formatSkillSourceLabel(sourceFamily?: SkillOption["sourceFamily"]) {
  if (sourceFamily === "agents") {
    return ".agents";
  }
  if (sourceFamily === "codex") {
    return ".codex";
  }
  if (sourceFamily === "bundled") {
    return "Bundled";
  }
  return null;
}

export function buildSkillMetaChips(skill: SkillOption) {
  return [
    "Skill",
    formatSkillScopeLabel(skill.scope),
    formatSkillSourceLabel(skill.sourceFamily),
  ].filter((value): value is string => Boolean(value));
}

export function buildSkillStateChips(skill: SkillOption) {
  return [
    skill.enabled === false ? "Disabled" : null,
    skill.shadowedBy ? `Shadowed by ${skill.shadowedBy}` : null,
  ].filter((value): value is string => Boolean(value));
}

export function normalizeSkillReferenceText(
  value: string,
  skills: SkillOption[],
  cursor: number | null = null
) {
  if (!value.includes("SKILL.md")) {
    return { text: value, cursor };
  }

  let changed = false;
  let output = "";
  let sourceIndex = 0;
  let nextCursor = cursor;

  while (sourceIndex < value.length) {
    const markdownReference = matchMarkdownSkillReference(value, sourceIndex, skills);
    if (!markdownReference) {
      output += value[sourceIndex];
      sourceIndex += 1;
      continue;
    }

    const rawValue = value.slice(sourceIndex, markdownReference.end);
    const normalizedValue = `$${markdownReference.skill.name}`;
    output += normalizedValue;
    changed = true;

    if (nextCursor !== null) {
      if (nextCursor > sourceIndex && nextCursor <= markdownReference.end) {
        nextCursor = output.length;
      } else if (nextCursor > markdownReference.end) {
        nextCursor += normalizedValue.length - rawValue.length;
      }
    }

    sourceIndex = markdownReference.end;
  }

  return changed
    ? {
        text: output,
        cursor: nextCursor,
      }
    : { text: value, cursor };
}

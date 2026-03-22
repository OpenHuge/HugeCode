import type { AgentTaskSummary } from "@ku0/code-runtime-host-contract";

const FILE_PATH_PATTERN = /[A-Za-z0-9_./-]+\.(?:ts|tsx|js|jsx|json|md|css|rs|yml|yaml)/g;

export function extractLatestTaskOutput(task: AgentTaskSummary): string {
  const reversedSteps = [...task.steps].reverse();
  for (const step of reversedSteps) {
    if (typeof step.output === "string" && step.output.trim().length > 0) {
      return step.output.trim();
    }
  }
  return task.errorMessage?.trim() || task.title?.trim() || "No task output recorded.";
}

export function extractFilePaths(text: string): string[] {
  const matches = text.match(FILE_PATH_PATTERN) ?? [];
  return [...new Set(matches)];
}

export function parseGoalReached(text: string): boolean {
  return /goal reached:\s*yes/i.test(text);
}

export function parseBooleanSection(text: string, heading: string): boolean {
  const match = text.match(new RegExp(`${heading}:\\s*(yes|no)`, "i"));
  return match?.[1]?.toLowerCase() === "yes";
}

export function extractSingleLineSection(text: string, heading: string): string | null {
  const match = text.match(new RegExp(`${heading}:\\s*(.+)`, "i"));
  if (!match) {
    return null;
  }
  const value = match[1].trim();
  if (value.length === 0 || /^(none|n\/a)$/i.test(value)) {
    return null;
  }
  return value;
}

export function extractListSection(text: string, heading: string): string[] {
  const line = extractSingleLineSection(text, heading);
  if (!line) {
    return [];
  }
  return line
    .split(/[|,]/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0 && entry.toLowerCase() !== "none");
}

export function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

import type { CustomPromptOption } from "../types";
import { buildCustomCommandInsertText, expandCustomCommandText } from "./slashCommands";

const PROMPT_ARG_REGEX = /\$[A-Z][A-Z0-9_]*/g;

export type PromptArgRange = {
  start: number;
  end: number;
};

function normalizeQuotes(input: string) {
  return input.replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'");
}

export function promptArgumentNames(content: string) {
  const names: string[] = [];
  const seen = new Set<string>();
  const matches = content.matchAll(PROMPT_ARG_REGEX);
  for (const match of matches) {
    const index = match.index ?? 0;
    if (index > 0 && content[index - 1] === "$") {
      continue;
    }
    const name = match[0].slice(1);
    if (name === "ARGUMENTS") {
      continue;
    }
    if (!seen.has(name)) {
      seen.add(name);
      names.push(name);
    }
  }
  return names;
}

export function promptHasNumericPlaceholders(content: string) {
  if (content.includes("$ARGUMENTS")) {
    return true;
  }
  for (let i = 0; i + 1 < content.length; i += 1) {
    if (content[i] === "$" && /[1-9]/.test(content[i + 1] ?? "")) {
      return true;
    }
  }
  return false;
}

export function getPromptArgumentHint(prompt: CustomPromptOption) {
  const hint = prompt.argumentHint?.trim();
  if (hint) {
    return hint;
  }
  const names = promptArgumentNames(prompt.content);
  if (names.length > 0) {
    return names.map((name) => `${name}=`).join(" ");
  }
  if (promptHasNumericPlaceholders(prompt.content)) {
    return "[args]";
  }
  return undefined;
}

export function buildPromptInsertText(prompt: CustomPromptOption) {
  return buildCustomCommandInsertText(prompt);
}

export function parseSlashName(line: string) {
  if (!line.startsWith("/")) {
    return null;
  }
  const stripped = line.slice(1);
  let nameEnd = stripped.length;
  for (let index = 0; index < stripped.length; index += 1) {
    if (/\s/.test(stripped[index] ?? "")) {
      nameEnd = index;
      break;
    }
  }
  const name = stripped.slice(0, nameEnd);
  if (!name) {
    return null;
  }
  const rest = stripped.slice(nameEnd).trimStart();
  return { name, rest };
}

function isPromptCommandLine(line: string) {
  return parseSlashName(line) !== null;
}

function findPromptArgRangesInLine(line: string): PromptArgRange[] {
  if (!isPromptCommandLine(line)) {
    return [];
  }
  const normalized = normalizeQuotes(line);
  const ranges: PromptArgRange[] = [];
  let index = 0;
  while (index < line.length) {
    const assignIndex = normalized.indexOf('="', index);
    if (assignIndex === -1) {
      break;
    }
    const valueStart = assignIndex + 2;
    let end = valueStart;
    let found = false;
    while (end < normalized.length) {
      const char = normalized[end];
      if (char === '"' && line[end - 1] !== "\\") {
        found = true;
        break;
      }
      end += 1;
    }
    if (!found) {
      break;
    }
    ranges.push({ start: valueStart, end });
    index = end + 1;
  }
  return ranges;
}

export function findPromptArgRangeAtCursor(text: string, cursor: number) {
  const newlineIndex = text.indexOf("\n");
  const lineEnd = newlineIndex === -1 ? text.length : newlineIndex;
  if (cursor > lineEnd) {
    return null;
  }
  const line = text.slice(0, lineEnd);
  const ranges = findPromptArgRangesInLine(line);
  return ranges.find((range) => cursor >= range.start && cursor <= range.end) ?? null;
}

export function findNextPromptArgCursor(text: string, cursor: number) {
  const newlineIndex = text.indexOf("\n");
  const lineEnd = newlineIndex === -1 ? text.length : newlineIndex;
  if (cursor > lineEnd) {
    return null;
  }
  const line = text.slice(0, lineEnd);
  const ranges = findPromptArgRangesInLine(line);
  if (!ranges.length) {
    return null;
  }
  for (let i = 0; i < ranges.length; i += 1) {
    const range = ranges[i];
    if (cursor >= range.start && cursor <= range.end) {
      return ranges[i + 1]?.start ?? null;
    }
    if (cursor < range.start) {
      return range.start;
    }
  }
  return null;
}

export function expandCustomPromptText(
  text: string,
  prompts: CustomPromptOption[]
): { expanded: string } | { error: string } | null {
  return expandCustomCommandText(text, prompts);
}

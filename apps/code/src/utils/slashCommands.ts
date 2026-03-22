import type { CustomPromptOption } from "../types";

const PROMPTS_CMD_PREFIX = "prompts";
const LEGACY_PROMPT_ALIAS_PREFIX = `${PROMPTS_CMD_PREFIX}:`;
const PROMPT_ARG_REGEX = /\$[A-Z][A-Z0-9_]*/g;

export type BuiltInSlashCommandName =
  | "compact"
  | "fork"
  | "mcp"
  | "new"
  | "resume"
  | "review"
  | "status";

export type SlashCommandEntry = {
  id: string;
  name: string;
  primaryTrigger: string;
  legacyAliases: string[];
  description?: string;
  hint?: string;
  scope: "workspace" | "global" | null;
  kind: "builtin" | "custom";
  source: "builtin" | "prompt-library";
  insertText: string;
  cursorOffset?: number;
  shadowedByBuiltin: boolean;
  prompt?: CustomPromptOption;
};

export type SlashCommandRegistry = {
  entries: SlashCommandEntry[];
};

type ParsedSlashName = {
  name: string;
  rest: string;
};

const BUILT_IN_SLASH_COMMANDS: ReadonlyArray<{
  name: BuiltInSlashCommandName;
  description: string;
}> = [
  { name: "compact", description: "compact the active thread context" },
  { name: "fork", description: "branch into a new thread" },
  { name: "mcp", description: "list configured MCP tools" },
  { name: "new", description: "start a new chat" },
  { name: "resume", description: "refresh the active thread" },
  { name: "review", description: "start a code review" },
  { name: "status", description: "show session status" },
];

function normalizeQuotes(input: string) {
  return input.replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'");
}

function parseSlashName(line: string): ParsedSlashName | null {
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

function splitShlex(input: string) {
  const tokens: string[] = [];
  let current = "";
  let inSingle = false;
  let inDouble = false;
  let escaped = false;

  for (const char of input) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (!inSingle && char === "\\") {
      escaped = true;
      continue;
    }

    if (!inDouble && char === "'") {
      inSingle = !inSingle;
      continue;
    }

    if (!inSingle && char === '"') {
      inDouble = !inDouble;
      continue;
    }

    if (!inSingle && !inDouble && /\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (escaped) {
    current += "\\";
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
}

function parsePositionalArgs(rest: string) {
  return splitShlex(normalizeQuotes(rest));
}

type PromptArgsError =
  | { kind: "MissingAssignment"; token: string }
  | { kind: "MissingKey"; token: string };

type PromptInputsResult = { values: Record<string, string> } | { error: PromptArgsError };

function formatPromptArgsError(command: string, error: PromptArgsError) {
  if (error.kind === "MissingAssignment") {
    return `Could not parse ${command}: expected key=value but found '${error.token}'. Wrap values in double quotes if they contain spaces.`;
  }
  return `Could not parse ${command}: expected a name before '=' in '${error.token}'.`;
}

function parsePromptInputs(rest: string): PromptInputsResult {
  const values: Record<string, string> = {};
  if (!rest.trim()) {
    return { values } as const;
  }
  const tokens = splitShlex(normalizeQuotes(rest));
  for (const token of tokens) {
    const eqIndex = token.indexOf("=");
    if (eqIndex <= 0) {
      if (eqIndex === 0) {
        return { error: { kind: "MissingKey", token } } as const;
      }
      return { error: { kind: "MissingAssignment", token } } as const;
    }
    const key = token.slice(0, eqIndex);
    const value = token.slice(eqIndex + 1);
    values[key] = value;
  }
  return { values } as const;
}

function expandNamedPlaceholders(content: string, inputs: Record<string, string>) {
  return content.replace(PROMPT_ARG_REGEX, (match, offset) => {
    if (offset > 0 && content[offset - 1] === "$") {
      return match;
    }
    const key = match.slice(1);
    return inputs[key] ?? match;
  });
}

function expandNumericPlaceholders(content: string, args: string[]) {
  let output = "";
  let index = 0;
  let cachedJoined: string | null = null;

  while (index < content.length) {
    const next = content.indexOf("$", index);
    if (next === -1) {
      output += content.slice(index);
      break;
    }
    output += content.slice(index, next);
    const rest = content.slice(next);
    const nextChar = rest[1];

    if (nextChar === "$" && rest.length >= 2) {
      output += "$$";
      index = next + 2;
      continue;
    }

    if (nextChar && /[1-9]/.test(nextChar)) {
      const argIndex = Number(nextChar) - 1;
      if (Number.isFinite(argIndex) && args[argIndex]) {
        output += args[argIndex];
      }
      index = next + 2;
      continue;
    }

    if (rest.length > 1 && rest.slice(1).startsWith("ARGUMENTS")) {
      if (args.length > 0) {
        if (!cachedJoined) {
          cachedJoined = args.join(" ");
        }
        output += cachedJoined;
      }
      index = next + 1 + "ARGUMENTS".length;
      continue;
    }

    output += "$";
    index = next + 1;
  }

  return output;
}

function promptArgumentNames(content: string) {
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

function promptHasNumericPlaceholders(content: string) {
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

function getPromptArgumentHint(prompt: CustomPromptOption) {
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

function formatCustomCommandScope(scope: CustomPromptOption["scope"]) {
  return scope === "workspace" ? "Project command" : "Personal command";
}

function normalizeBuiltInEntries(): SlashCommandEntry[] {
  return BUILT_IN_SLASH_COMMANDS.map((entry) => ({
    id: entry.name,
    name: entry.name,
    primaryTrigger: `/${entry.name}`,
    legacyAliases: [],
    description: entry.description,
    scope: null,
    kind: "builtin",
    source: "builtin",
    insertText: entry.name,
    shadowedByBuiltin: false,
  }));
}

export function isBuiltInSlashCommandName(name: string): boolean {
  return normalizeBuiltInEntries().some((entry) => entry.name === name);
}

export function parseBuiltInSlashCommand(text: string): BuiltInSlashCommandName | null {
  const parsed = parseSlashName(text.trim());
  if (!parsed) {
    return null;
  }
  return isBuiltInSlashCommandName(parsed.name) ? (parsed.name as BuiltInSlashCommandName) : null;
}

export function isBuiltInSlashCommandText(text: string) {
  return parseBuiltInSlashCommand(text) !== null;
}

export function buildCustomCommandText(prompt: CustomPromptOption, args = "") {
  const trimmedArgs = args.trim();
  const shadowedByBuiltin = isBuiltInSlashCommandName(prompt.name);
  const commandName = shadowedByBuiltin
    ? `${LEGACY_PROMPT_ALIAS_PREFIX}${prompt.name}`
    : prompt.name;
  return `/${commandName}${trimmedArgs ? ` ${trimmedArgs}` : ""}`;
}

export function buildCustomCommandInsertText(prompt: CustomPromptOption) {
  const names = promptArgumentNames(prompt.content);
  let text = buildCustomCommandText(prompt, "").slice(1);
  let cursorOffset: number | undefined;
  names.forEach((name) => {
    if (cursorOffset === undefined) {
      cursorOffset = text.length + 1 + name.length + 2;
    }
    text += ` ${name}=""`;
  });
  return { text, cursorOffset };
}

export function buildSlashCommandRegistry(input: {
  prompts: CustomPromptOption[];
}): SlashCommandRegistry {
  const builtInEntries = normalizeBuiltInEntries();
  const customEntries = input.prompts
    .filter((prompt) => prompt.name)
    .slice()
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((prompt) => {
      const shadowedByBuiltin = isBuiltInSlashCommandName(prompt.name);
      const insert = buildCustomCommandInsertText(prompt);
      const descriptionParts = [
        prompt.description?.trim(),
        formatCustomCommandScope(prompt.scope),
        shadowedByBuiltin ? `use /${LEGACY_PROMPT_ALIAS_PREFIX}${prompt.name}` : null,
      ].filter((value): value is string => Boolean(value));
      return {
        id: `prompt:${prompt.name}`,
        name: prompt.name,
        primaryTrigger: `/${prompt.name}`,
        legacyAliases: [`/${LEGACY_PROMPT_ALIAS_PREFIX}${prompt.name}`],
        description: descriptionParts.join(" · "),
        hint: getPromptArgumentHint(prompt),
        scope: prompt.scope ?? "global",
        kind: "custom" as const,
        source: "prompt-library" as const,
        insertText: insert.text,
        cursorOffset: insert.cursorOffset,
        shadowedByBuiltin,
        prompt,
      } satisfies SlashCommandEntry;
    });

  return {
    entries: [...builtInEntries, ...customEntries],
  };
}

export function expandCustomCommandText(
  text: string,
  prompts: CustomPromptOption[]
): { expanded: string } | { error: string } | null {
  const parsed = parseSlashName(text);
  if (!parsed) {
    return null;
  }

  const usesLegacyAlias = parsed.name.startsWith(LEGACY_PROMPT_ALIAS_PREFIX);
  const promptName = usesLegacyAlias
    ? parsed.name.slice(LEGACY_PROMPT_ALIAS_PREFIX.length)
    : parsed.name;
  if (!promptName) {
    return null;
  }
  if (!usesLegacyAlias && isBuiltInSlashCommandName(promptName)) {
    return null;
  }

  const prompt = prompts.find((entry) => entry.name === promptName);
  if (!prompt) {
    return null;
  }

  const required = promptArgumentNames(prompt.content);
  if (required.length > 0) {
    const parsedInputs = parsePromptInputs(parsed.rest);
    if ("error" in parsedInputs) {
      return {
        error: formatPromptArgsError(`/${parsed.name}`, parsedInputs.error),
      } as const;
    }
    const missing = required.filter((name) => !(name in parsedInputs.values));
    if (missing.length > 0) {
      return {
        error: `Missing required args for /${parsed.name}: ${missing.join(", ")}. Provide as key=value (quote values with spaces).`,
      } as const;
    }
    return {
      expanded: expandNamedPlaceholders(prompt.content, parsedInputs.values),
    } as const;
  }

  const args = parsePositionalArgs(parsed.rest);
  return { expanded: expandNumericPlaceholders(prompt.content, args) } as const;
}

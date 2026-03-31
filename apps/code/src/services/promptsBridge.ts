import { getRuntimeClient } from "./runtimeClient";

type LooseResultEnvelope = Record<string, unknown>;

function normalizeNullableText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toLegacyPromptRecord(prompt: {
  id: string;
  title: string;
  description: string;
  content: string;
  scope: "workspace" | "global";
}) {
  const parsed = parseLegacyPromptContent(prompt.content);
  return {
    name: prompt.title,
    path: prompt.id,
    description: prompt.description,
    content: parsed.content,
    scope: prompt.scope,
    ...(parsed.argumentHint ? { argumentHint: parsed.argumentHint } : {}),
  };
}

function parseLegacyPromptContent(content: string): { content: string; argumentHint?: string } {
  const frontmatterMatch = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/u.exec(content);
  if (!frontmatterMatch) {
    return { content };
  }
  const frontmatterBody = frontmatterMatch[1];
  const contentBody = frontmatterMatch[2];
  const nonEmptyLines = frontmatterBody
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (nonEmptyLines.length === 0) {
    return { content };
  }
  const entries = nonEmptyLines.reduce<Record<string, string>>((acc, line) => {
    const match = /^([a-z0-9_-]+)\s*:\s*(.+)$/iu.exec(line);
    if (!match) {
      return acc;
    }
    acc[match[1].toLowerCase()] = match[2].trim();
    return acc;
  }, {});

  const runtimeMeta = entries.runtime_adapter_meta;
  const hasUnderscoreHint = "argument_hint" in entries;
  const hasHyphenHint = "argument-hint" in entries;
  const legacyHintOnly = nonEmptyLines.length === 1 && (hasUnderscoreHint || hasHyphenHint);
  const hasCurrentMeta = runtimeMeta === "prompt_v1";
  const hasAnyHint = hasUnderscoreHint || hasHyphenHint;
  if (!hasAnyHint || (!hasCurrentMeta && !legacyHintOnly)) {
    return { content };
  }

  const rawValue = entries.argument_hint ?? entries["argument-hint"];
  if (!rawValue) {
    return { content };
  }
  let decoded = rawValue;
  if (decoded.startsWith('"') && decoded.endsWith('"')) {
    try {
      decoded = JSON.parse(decoded) as string;
    } catch {
      // Keep raw content when quoted JSON decoding fails.
    }
  } else if (decoded.startsWith("'") && decoded.endsWith("'")) {
    // YAML-style single-quoted scalars escape apostrophes as doubled single quotes.
    decoded = decoded.slice(1, -1).replace(/''/gu, "'");
  }
  return {
    content: contentBody,
    argumentHint: decoded,
  };
}

function encodeLegacyPromptContent(content: string, argumentHint?: string | null): string {
  const normalizedHint = normalizeNullableText(argumentHint);
  if (!normalizedHint) {
    return content;
  }
  return `---\nruntime_adapter_meta: prompt_v1\nargument_hint: ${JSON.stringify(normalizedHint)}\n---\n${content}`;
}

export async function getPromptsList(workspaceId: string): Promise<LooseResultEnvelope> {
  const runtimeClient = getRuntimeClient();
  const [workspacePrompts, globalPrompts] = await Promise.all([
    runtimeClient.promptLibrary(workspaceId),
    runtimeClient.promptLibrary(null),
  ]);
  const promptById = new Map<
    string,
    {
      name: string;
      path: string;
      description: string;
      content: string;
      scope: "workspace" | "global";
    }
  >();
  for (const prompt of [...workspacePrompts, ...globalPrompts]) {
    if (promptById.has(prompt.id)) {
      continue;
    }
    promptById.set(prompt.id, toLegacyPromptRecord(prompt));
  }
  const prompts = [...promptById.values()];
  return {
    result: { prompts },
    prompts,
  };
}

export async function createPrompt(
  workspaceId: string,
  data: {
    scope: "workspace" | "global";
    name: string;
    description?: string | null;
    argumentHint?: string | null;
    content: string;
  }
): Promise<LooseResultEnvelope> {
  const encodedContent = encodeLegacyPromptContent(data.content, data.argumentHint);
  const prompt = await getRuntimeClient().promptLibraryCreate({
    workspaceId,
    scope: data.scope,
    title: data.name,
    description: data.description ?? "",
    content: encodedContent,
  });
  const mappedPrompt = toLegacyPromptRecord(prompt);
  return {
    result: { prompt: mappedPrompt },
    prompt: mappedPrompt,
  };
}

export async function updatePrompt(
  workspaceId: string,
  data: {
    path: string;
    name: string;
    description?: string | null;
    argumentHint?: string | null;
    content: string;
  }
): Promise<LooseResultEnvelope> {
  const encodedContent = encodeLegacyPromptContent(data.content, data.argumentHint);
  const prompt = await getRuntimeClient().promptLibraryUpdate({
    workspaceId,
    promptId: data.path,
    title: data.name,
    description: data.description ?? "",
    content: encodedContent,
  });
  const mappedPrompt = toLegacyPromptRecord(prompt);
  return {
    result: { prompt: mappedPrompt },
    prompt: mappedPrompt,
  };
}

export async function deletePrompt(
  workspaceId: string,
  path: string
): Promise<LooseResultEnvelope> {
  const deleted = await getRuntimeClient().promptLibraryDelete({
    workspaceId,
    promptId: path,
  });
  return {
    result: { deleted },
    deleted,
  };
}

export async function movePrompt(
  workspaceId: string,
  data: { path: string; scope: "workspace" | "global" }
): Promise<LooseResultEnvelope> {
  const prompt = await getRuntimeClient().promptLibraryMove({
    workspaceId,
    promptId: data.path,
    targetScope: data.scope,
  });
  const mappedPrompt = toLegacyPromptRecord(prompt);
  return {
    result: { prompt: mappedPrompt },
    prompt: mappedPrompt,
  };
}

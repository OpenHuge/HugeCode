import type { InvocationDescriptor } from "@ku0/code-runtime-host-contract";
import { describe, expect, it } from "vitest";
import type { CustomPromptOption } from "../types";
import {
  buildSlashCommandRegistry,
  expandCustomCommandText,
  isBuiltInSlashCommandText,
  resolveInvocationSlashCommandText,
} from "./slashCommands";

const makePrompt = (overrides: Partial<CustomPromptOption> = {}): CustomPromptOption => ({
  name: "summarize",
  path: "/tmp/summarize.md",
  description: "Summarize a target",
  content: "Summarize $TARGET",
  scope: "workspace",
  ...overrides,
});

describe("buildSlashCommandRegistry", () => {
  it("keeps built-in commands ahead of custom commands and exposes plain triggers", () => {
    const registry = buildSlashCommandRegistry({
      prompts: [makePrompt()],
    });

    expect(registry.entries.slice(0, 7).map((entry) => entry.name)).toEqual([
      "compact",
      "fork",
      "mcp",
      "new",
      "resume",
      "review",
      "status",
    ]);
    expect(registry.entries.find((entry) => entry.kind === "custom")).toMatchObject({
      name: "summarize",
      primaryTrigger: "/summarize",
      legacyAliases: ["/prompts:summarize"],
      hint: "TARGET=",
      insertText: 'summarize TARGET=""',
      source: "prompt-library",
      shadowedByBuiltin: false,
    });
  });

  it("marks built-in collisions and falls back to the legacy alias for insertion", () => {
    const registry = buildSlashCommandRegistry({
      prompts: [makePrompt({ name: "review", path: "/tmp/review.md" })],
    });

    expect(registry.entries.find((entry) => entry.kind === "custom")).toMatchObject({
      name: "review",
      primaryTrigger: "/review",
      legacyAliases: ["/prompts:review"],
      insertText: 'prompts:review TARGET=""',
      shadowedByBuiltin: true,
    });
  });
});

describe("expandCustomCommandText", () => {
  it("expands plain custom slash commands", () => {
    expect(expandCustomCommandText('/summarize TARGET="src/features"', [makePrompt()])).toEqual({
      expanded: "Summarize src/features",
    });
  });

  it("keeps the legacy alias working for shadowed commands", () => {
    expect(
      expandCustomCommandText('/prompts:review TARGET="diff"', [
        makePrompt({ name: "review", path: "/tmp/review.md" }),
      ])
    ).toEqual({
      expanded: "Summarize diff",
    });
  });

  it("does not expand plain syntax when the name belongs to a built-in command", () => {
    expect(
      expandCustomCommandText('/review TARGET="diff"', [
        makePrompt({ name: "review", path: "/tmp/review.md" }),
      ])
    ).toBeNull();
  });
});

describe("isBuiltInSlashCommandText", () => {
  it("recognizes built-in slash command text including compact", () => {
    expect(isBuiltInSlashCommandText("/compact now")).toBe(true);
    expect(isBuiltInSlashCommandText("/apps")).toBe(false);
    expect(isBuiltInSlashCommandText("/unknown")).toBe(false);
  });
});

describe("resolveInvocationSlashCommandText", () => {
  const invocation: InvocationDescriptor = {
    id: "session:prompt:prompt.summarize",
    title: "summarize",
    summary: "Summarize a target",
    description: "Summarize a target",
    kind: "session_command",
    source: {
      kind: "session_command",
      contributionType: "session_scoped",
      authority: "workspace",
      label: "Runtime prompt library",
      sourceId: "prompt.summarize",
      workspaceId: "ws-1",
      provenance: null,
    },
    runtimeTool: null,
    argumentSchema: null,
    aliases: [],
    tags: ["prompt_overlay"],
    safety: {
      level: "read",
      readOnly: true,
      destructive: false,
      openWorld: false,
      idempotent: true,
    },
    exposure: {
      operatorVisible: true,
      modelVisible: false,
      requiresReadiness: false,
      hiddenReason: null,
    },
    readiness: {
      state: "ready",
      available: true,
      reason: null,
      warnings: [],
      checkedAt: null,
    },
    metadata: {
      promptOverlay: {
        promptId: "prompt.summarize",
        scope: "workspace",
      },
      slashCommand: {
        primaryTrigger: "/summarize",
        legacyAliases: [],
        insertText: 'summarize TARGET=""',
        cursorOffset: 18,
        hint: "TARGET=",
        shadowedByBuiltin: false,
      },
    },
  };

  it("resolves named slash inputs for runtime prompt overlays", () => {
    expect(
      resolveInvocationSlashCommandText('/summarize TARGET="src/features"', [invocation])
    ).toEqual({
      invocationId: "session:prompt:prompt.summarize",
      arguments: {
        TARGET: "src/features",
      },
    });
  });

  it("keeps shadowed built-in triggers reserved for built-in commands", () => {
    expect(
      resolveInvocationSlashCommandText("/review TARGET=diff", [
        {
          ...invocation,
          id: "session:prompt:prompt.review",
          title: "review",
          metadata: {
            promptOverlay: {
              promptId: "prompt.review",
              scope: "workspace",
            },
            slashCommand: {
              primaryTrigger: "/review",
              legacyAliases: ["/prompts:review"],
              insertText: 'prompts:review TARGET=""',
              cursorOffset: 22,
              hint: "TARGET=",
              shadowedByBuiltin: true,
            },
          },
        },
      ])
    ).toBeNull();
  });

  it("resolves legacy aliases for shadowed runtime prompt overlays", () => {
    expect(
      resolveInvocationSlashCommandText("/prompts:review TARGET=diff", [
        {
          ...invocation,
          id: "session:prompt:prompt.review",
          title: "review",
          metadata: {
            promptOverlay: {
              promptId: "prompt.review",
              scope: "workspace",
            },
            slashCommand: {
              primaryTrigger: "/review",
              legacyAliases: ["/prompts:review"],
              insertText: 'prompts:review TARGET=""',
              cursorOffset: 22,
              hint: "TARGET=",
              shadowedByBuiltin: true,
            },
          },
        },
      ])
    ).toEqual({
      invocationId: "session:prompt:prompt.review",
      arguments: {
        TARGET: "diff",
      },
    });
  });
});

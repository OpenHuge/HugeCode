import { describe, expect, it } from "vitest";
import type { CustomPromptOption } from "../types";
import {
  buildSlashCommandRegistry,
  expandCustomCommandText,
  isBuiltInSlashCommandText,
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

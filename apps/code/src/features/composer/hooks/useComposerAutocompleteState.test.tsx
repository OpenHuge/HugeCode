/** @vitest-environment jsdom */

import { renderHook } from "@testing-library/react";
import type { InvocationDescriptor } from "@ku0/code-runtime-host-contract";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { useComposerAutocompleteState } from "./useComposerAutocompleteState";

describe("useComposerAutocompleteState file mentions", () => {
  it("suggests a file even if it is already mentioned earlier in the message", () => {
    const files = ["src/App.tsx", "src/main.tsx"];
    const text = "Please review @src/App.tsx and also @";
    const selectionStart = text.length;
    const textareaRef = createRef<HTMLTextAreaElement>();
    textareaRef.current = {
      focus: vi.fn(),
      setSelectionRange: vi.fn(),
    } as unknown as HTMLTextAreaElement;

    const { result } = renderHook(() =>
      useComposerAutocompleteState({
        text,
        selectionStart,
        disabled: false,
        skills: [],
        prompts: [],
        files,
        textareaRef,
        setText: vi.fn(),
        setSelectionStart: vi.fn(),
      })
    );

    expect(result.current.isAutocompleteOpen).toBe(true);
    expect(result.current.autocompleteMatches.map((item) => item.label)).toContain("src/App.tsx");
  });

  it("marks root-level file suggestions as Files group", () => {
    const files = ["AGENTS.md", "src/main.tsx"];
    const text = "@";
    const selectionStart = text.length;
    const textareaRef = createRef<HTMLTextAreaElement>();
    textareaRef.current = {
      focus: vi.fn(),
      setSelectionRange: vi.fn(),
    } as unknown as HTMLTextAreaElement;

    const { result } = renderHook(() =>
      useComposerAutocompleteState({
        text,
        selectionStart,
        disabled: false,
        skills: [],
        prompts: [],
        files,
        textareaRef,
        setText: vi.fn(),
        setSelectionStart: vi.fn(),
      })
    );

    const rootItem = result.current.autocompleteMatches.find((item) => item.label === "AGENTS.md");
    expect(rootItem?.group).toBe("Files");
  });
});

describe("useComposerAutocompleteState slash commands", () => {
  it("includes built-in slash commands in alphabetical order", () => {
    const text = "/";
    const selectionStart = text.length;
    const textareaRef = createRef<HTMLTextAreaElement>();
    textareaRef.current = {
      focus: vi.fn(),
      setSelectionRange: vi.fn(),
    } as unknown as HTMLTextAreaElement;

    const { result } = renderHook(() =>
      useComposerAutocompleteState({
        text,
        selectionStart,
        disabled: false,
        skills: [],
        prompts: [],
        files: [],
        textareaRef,
        setText: vi.fn(),
        setSelectionStart: vi.fn(),
      })
    );

    const labels = result.current.autocompleteMatches.map((item) => item.label);
    expect(labels).toEqual(
      expect.arrayContaining(["compact", "fork", "mcp", "new", "resume", "review", "status"])
    );
    expect(labels.slice(0, 7)).toEqual([
      "compact",
      "fork",
      "mcp",
      "new",
      "resume",
      "review",
      "status",
    ]);
  });

  it("shows custom commands with plain names, scope metadata, and argument hints", () => {
    const text = "/";
    const selectionStart = text.length;
    const textareaRef = createRef<HTMLTextAreaElement>();
    textareaRef.current = {
      focus: vi.fn(),
      setSelectionRange: vi.fn(),
    } as unknown as HTMLTextAreaElement;

    const { result } = renderHook(() =>
      useComposerAutocompleteState({
        text,
        selectionStart,
        disabled: false,
        skills: [],
        prompts: [
          {
            name: "summarize",
            path: "/tmp/summarize.md",
            description: "Summarize a target",
            content: "Summarize $TARGET",
            scope: "workspace",
          },
        ],
        files: [],
        textareaRef,
        setText: vi.fn(),
        setSelectionStart: vi.fn(),
      })
    );

    const item = result.current.autocompleteMatches.find(
      (entry) => entry.id === "prompt:summarize"
    );
    expect(item).toMatchObject({
      label: "summarize",
      description: "Summarize a target · Project command",
      hint: "TARGET=",
      insertText: 'summarize TARGET=""',
      group: "Slash",
    });
  });

  it("prefers catalog-derived slash overlays when invocation items are provided", () => {
    const text = "/";
    const selectionStart = text.length;
    const textareaRef = createRef<HTMLTextAreaElement>();
    textareaRef.current = {
      focus: vi.fn(),
      setSelectionRange: vi.fn(),
    } as unknown as HTMLTextAreaElement;
    const slashInvocationItems: InvocationDescriptor[] = [
      {
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
          hiddenReason: "Prompt-library overlays stay operator-facing in the invocation plane.",
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
      },
    ];

    const { result } = renderHook(() =>
      useComposerAutocompleteState({
        text,
        selectionStart,
        disabled: false,
        skills: [],
        prompts: [],
        slashInvocationItems,
        files: [],
        textareaRef,
        setText: vi.fn(),
        setSelectionStart: vi.fn(),
      })
    );

    expect(result.current.autocompleteMatches).toContainEqual(
      expect.objectContaining({
        id: "session:prompt:prompt.summarize",
        label: "summarize",
        description: "Summarize a target · Project command",
        hint: "TARGET=",
        insertText: 'summarize TARGET=""',
        group: "Slash",
      })
    );
  });
});

describe("useComposerAutocompleteState $ completions", () => {
  it("shows skill results only", () => {
    const text = "$";
    const selectionStart = text.length;
    const textareaRef = createRef<HTMLTextAreaElement>();
    textareaRef.current = {
      focus: vi.fn(),
      setSelectionRange: vi.fn(),
    } as unknown as HTMLTextAreaElement;

    const { result } = renderHook(() =>
      useComposerAutocompleteState({
        text,
        selectionStart,
        disabled: false,
        skills: [
          { name: "skill-a", description: "Skill A" },
          { name: "skill-b", description: "Skill B" },
        ],
        prompts: [],
        files: [],
        textareaRef,
        setText: vi.fn(),
        setSelectionStart: vi.fn(),
      })
    );

    const ids = result.current.autocompleteMatches.map((item) => item.id);
    const groups = result.current.autocompleteMatches.map((item) => item.group);
    expect(ids).toEqual(["skill:skill-a", "skill:skill-b"]);
    expect(groups).toEqual(["Skills", "Skills"]);
  });

  it("shows instruction skill scope, source, enablement, and conflict metadata", () => {
    const text = "$";
    const selectionStart = text.length;
    const textareaRef = createRef<HTMLTextAreaElement>();
    textareaRef.current = {
      focus: vi.fn(),
      setSelectionRange: vi.fn(),
    } as unknown as HTMLTextAreaElement;

    const { result } = renderHook(() =>
      useComposerAutocompleteState({
        text,
        selectionStart,
        disabled: false,
        skills: [
          {
            name: "review",
            path: "global.codex.review",
            description: "Review the current patch",
            scope: "global",
            sourceFamily: "codex",
            enabled: false,
            aliases: ["codex:review"],
            shadowedBy: "workspace.agents.review",
          },
        ],
        prompts: [],
        files: [],
        textareaRef,
        setText: vi.fn(),
        setSelectionStart: vi.fn(),
      })
    );

    expect(result.current.autocompleteMatches).toContainEqual(
      expect.objectContaining({
        id: "skill:review",
        label: "review",
        description: "Review the current patch · Global skill · .codex",
        hint: "Disabled · Shadowed by workspace.agents.review · codex:review",
        group: "Skills",
      })
    );
  });
});

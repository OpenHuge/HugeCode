// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useThreadCodexSync } from "./useThreadCodexSync";

describe("useThreadCodexSync", () => {
  it("does not immediately rehydrate thread-scoped composer state from stale stored params after a local selection change", () => {
    const setThreadCodexSelectionKey = vi.fn();
    const setAccessMode = vi.fn();
    const setPreferredModelId = vi.fn();
    const setPreferredEffort = vi.fn();
    const setSelectionMode = vi.fn();
    const setPreferredProviderFamilyId = vi.fn();
    const setPreferredFastMode = vi.fn();
    const setPreferredCollabModeId = vi.fn();
    const setExecutionMode = vi.fn();

    const baseProps = {
      activeThreadId: "thread-1",
      activeThreadIdRef: { current: null as string | null },
      activeWorkspaceId: "ws-1",
      appDefaultAccessMode: "full-access" as const,
      lastComposerModelId: "openai::gpt-5.4",
      lastComposerReasoningEffort: "medium",
      composerModelSelectionMode: "manual" as const,
      lastComposerProviderFamilyId: "codex" as const,
      lastComposerFastMode: false,
      lastComposerExecutionMode: "runtime" as const,
      threadCodexParamsVersion: 1,
      getThreadCodexParams: vi.fn(() => ({
        modelId: "openai::gpt-5.4",
        effort: "medium",
        selectionMode: "manual" as const,
        providerFamilyId: "codex" as const,
        fastMode: false,
        accessMode: "full-access" as const,
        collaborationModeId: null,
        executionMode: "runtime" as const,
        updatedAt: 10,
      })),
      patchThreadCodexParams: vi.fn(),
      setThreadCodexSelectionKey,
      setAccessMode,
      setPreferredModelId,
      setPreferredEffort,
      setSelectionMode,
      setPreferredProviderFamilyId,
      setPreferredFastMode,
      setPreferredCollabModeId,
      setExecutionMode,
      pendingNewThreadSeedRef: { current: null },
      selectedModelId: "openai::gpt-5.4",
      resolvedModel: "gpt-5.4",
      resolvedEffort: "medium",
      selectionMode: "manual" as const,
      preferredProviderFamilyId: "codex" as const,
      threadCodexSelectionKey: "ws-1:thread-1",
      accessMode: "full-access" as const,
      fastModeEnabled: false,
      selectedCollaborationModeId: null,
      executionMode: "runtime" as const,
    };

    const { rerender } = renderHook((props: typeof baseProps) => useThreadCodexSync(props), {
      initialProps: baseProps,
    });

    expect(setSelectionMode).toHaveBeenCalledWith("manual");
    expect(setPreferredProviderFamilyId).toHaveBeenCalledWith("codex");

    setSelectionMode.mockClear();
    setPreferredProviderFamilyId.mockClear();

    rerender({
      ...baseProps,
      selectionMode: "auto",
      preferredProviderFamilyId: "claude",
    });

    expect(setSelectionMode).not.toHaveBeenCalled();
    expect(setPreferredProviderFamilyId).not.toHaveBeenCalled();
  });
});

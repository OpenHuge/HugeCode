import { describe, expect, it } from "vitest";
import {
  buildThreadCodexSeedPatch,
  createPendingThreadSeed,
  resolveThreadCodexState,
} from "./threadCodexParamsSeed";

describe("threadCodexParamsSeed", () => {
  it("creates a pending seed only for first-message no-thread composer", () => {
    expect(
      createPendingThreadSeed({
        activeThreadId: "thread-1",
        activeWorkspaceId: "ws-1",
        selectedCollaborationModeId: "plan",
        fastMode: true,
        accessMode: "full-access",
        executionMode: "local-cli",
      })
    ).toBeNull();

    expect(
      createPendingThreadSeed({
        activeThreadId: null,
        activeWorkspaceId: null,
        selectedCollaborationModeId: "plan",
        fastMode: true,
        accessMode: "full-access",
        executionMode: "local-cli",
      })
    ).toBeNull();

    expect(
      createPendingThreadSeed({
        activeThreadId: null,
        activeWorkspaceId: "ws-1",
        selectedCollaborationModeId: "plan",
        fastMode: true,
        accessMode: "full-access",
        executionMode: "local-cli",
      })
    ).toEqual({
      workspaceId: "ws-1",
      collaborationModeId: "plan",
      fastMode: true,
      accessMode: "full-access",
      executionMode: "local-cli",
    });
  });

  it("resolves thread state from stored params, then pending seed, then global defaults", () => {
    const storedResolved = resolveThreadCodexState({
      workspaceId: "ws-1",
      threadId: "thread-1",
      defaultAccessMode: "full-access",
      lastComposerModelId: "gpt-5",
      lastComposerReasoningEffort: "medium",
      lastComposerFastMode: true,
      lastComposerExecutionMode: "runtime",
      stored: {
        modelId: "gpt-4.1",
        effort: "low",
        fastMode: false,
        accessMode: "read-only",
        collaborationModeId: "default",
        executionMode: "local-cli",
        updatedAt: 100,
      },
      pendingSeed: {
        workspaceId: "ws-1",
        collaborationModeId: "plan",
        fastMode: true,
        accessMode: "full-access",
        executionMode: "hybrid",
      },
    });

    expect(storedResolved).toEqual({
      scopeKey: "ws-1:thread-1",
      accessMode: "read-only",
      preferredModelId: "gpt-4.1",
      preferredEffort: "low",
      preferredFastMode: false,
      preferredCollabModeId: "default",
      executionMode: "local-cli",
    });

    const seededResolved = resolveThreadCodexState({
      workspaceId: "ws-1",
      threadId: "thread-2",
      defaultAccessMode: "full-access",
      lastComposerModelId: "gpt-5",
      lastComposerReasoningEffort: "medium",
      lastComposerFastMode: false,
      lastComposerExecutionMode: "runtime",
      stored: null,
      pendingSeed: {
        workspaceId: "ws-1",
        collaborationModeId: "plan",
        fastMode: true,
        accessMode: "full-access",
        executionMode: "hybrid",
      },
    });

    expect(seededResolved).toEqual({
      scopeKey: "ws-1:thread-2",
      accessMode: "full-access",
      preferredModelId: "gpt-5",
      preferredEffort: "medium",
      preferredFastMode: true,
      preferredCollabModeId: "plan",
      executionMode: "hybrid",
    });
  });

  it("preserves no-thread composer overrides within the same workspace scope", () => {
    const resolved = resolveThreadCodexState({
      workspaceId: "ws-1",
      threadId: null,
      defaultAccessMode: "full-access",
      lastComposerModelId: "gpt-5.4",
      lastComposerReasoningEffort: "medium",
      lastComposerFastMode: false,
      lastComposerExecutionMode: "runtime",
      stored: null,
      pendingSeed: null,
      currentScopeKey: "ws-1:__no_thread__",
      currentModelId: "gpt-5.3-codex",
      currentReasoningEffort: "low",
      currentAccessMode: "read-only",
      currentFastMode: true,
      currentCollaborationModeId: "plan",
      currentExecutionMode: "hybrid",
    });

    expect(resolved).toEqual({
      scopeKey: "ws-1:__no_thread__",
      accessMode: "read-only",
      preferredModelId: "gpt-5.3-codex",
      preferredEffort: "low",
      preferredFastMode: true,
      preferredCollabModeId: "plan",
      executionMode: "hybrid",
    });
  });

  it("builds first-message seed patch with pending workspace snapshot", () => {
    expect(
      buildThreadCodexSeedPatch({
        workspaceId: "ws-1",
        resolvedModel: "gpt-5",
        resolvedEffort: "high",
        fastMode: false,
        accessMode: "full-access",
        selectedCollaborationModeId: "default",
        executionMode: "runtime",
        pendingSeed: {
          workspaceId: "ws-1",
          collaborationModeId: "plan",
          fastMode: true,
          accessMode: "full-access",
          executionMode: "local-cli",
        },
      })
    ).toEqual({
      modelId: "gpt-5",
      effort: "high",
      fastMode: true,
      accessMode: "full-access",
      collaborationModeId: "plan",
      executionMode: "local-cli",
    });

    expect(
      buildThreadCodexSeedPatch({
        workspaceId: "ws-1",
        resolvedModel: "gpt-5",
        resolvedEffort: "high",
        fastMode: false,
        accessMode: "full-access",
        selectedCollaborationModeId: "default",
        executionMode: "runtime",
        pendingSeed: {
          workspaceId: "ws-other",
          collaborationModeId: "plan",
          fastMode: true,
          accessMode: "full-access",
          executionMode: "local-cli",
        },
      })
    ).toEqual({
      modelId: "gpt-5",
      effort: "high",
      fastMode: false,
      accessMode: "full-access",
      collaborationModeId: "default",
      executionMode: "runtime",
    });
  });

  it("builds first-message seed patch from stable model slug instead of transient option id", () => {
    expect(
      buildThreadCodexSeedPatch({
        workspaceId: "ws-1",
        resolvedModel: "gpt-5.4",
        resolvedEffort: "high",
        fastMode: true,
        accessMode: "full-access",
        selectedCollaborationModeId: null,
        executionMode: "hybrid",
        pendingSeed: null,
      })
    ).toEqual({
      modelId: "gpt-5.4",
      effort: "high",
      fastMode: true,
      accessMode: "full-access",
      collaborationModeId: null,
      executionMode: "hybrid",
    });
  });
});

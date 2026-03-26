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
        selectionMode: "manual",
        providerFamilyId: "codex",
        selectedCollaborationModeId: "plan",
        fastMode: true,
        accessMode: "full-access",
        executionMode: "local-cli",
        autoDriveDraft: null,
      })
    ).toBeNull();

    expect(
      createPendingThreadSeed({
        activeThreadId: null,
        activeWorkspaceId: null,
        selectionMode: "manual",
        providerFamilyId: "codex",
        selectedCollaborationModeId: "plan",
        fastMode: true,
        accessMode: "full-access",
        executionMode: "local-cli",
        autoDriveDraft: null,
      })
    ).toBeNull();

    expect(
      createPendingThreadSeed({
        activeThreadId: null,
        activeWorkspaceId: "ws-1",
        selectionMode: "manual",
        providerFamilyId: "claude",
        selectedCollaborationModeId: "plan",
        fastMode: true,
        accessMode: "full-access",
        executionMode: "local-cli",
        autoDriveDraft: {
          enabled: true,
          destination: {
            title: "Ship validation",
            endState: "",
            doneDefinition: "",
            avoid: "",
            routePreference: "stability_first",
          },
          budget: {
            maxTokens: 6000,
            maxIterations: 3,
            maxDurationMinutes: 10,
            maxFilesPerIteration: 6,
            maxNoProgressIterations: 2,
            maxValidationFailures: 2,
            maxReroutes: 2,
          },
          riskPolicy: {
            pauseOnDestructiveChange: true,
            pauseOnDependencyChange: true,
            pauseOnLowConfidence: true,
            pauseOnHumanCheckpoint: true,
            allowNetworkAnalysis: true,
            allowValidationCommands: true,
            allowChatgptDecisionLab: true,
            autoRunChatgptDecisionLab: true,
            chatgptDecisionLabMinConfidence: "medium",
            chatgptDecisionLabMaxScoreGap: 8,
            minimumConfidence: "medium",
          },
          continuation: {
            enabled: true,
            maxAutomaticFollowUps: 2,
            requireValidationSuccessToStop: true,
            minimumConfidenceToStop: "high",
          },
        },
      })
    ).toEqual({
      workspaceId: "ws-1",
      selectionMode: "manual",
      providerFamilyId: "claude",
      collaborationModeId: "plan",
      fastMode: true,
      accessMode: "full-access",
      executionMode: "local-cli",
      autoDriveDraft: expect.objectContaining({
        enabled: true,
        destination: expect.objectContaining({ title: "Ship validation" }),
      }),
    });
  });

  it("resolves thread state from stored params, then pending seed, then global defaults", () => {
    const storedResolved = resolveThreadCodexState({
      workspaceId: "ws-1",
      threadId: "thread-1",
      defaultAccessMode: "full-access",
      lastComposerModelId: "gpt-5",
      lastComposerReasoningEffort: "medium",
      composerModelSelectionMode: "auto",
      lastComposerProviderFamilyId: null,
      lastComposerFastMode: true,
      lastComposerExecutionMode: "runtime",
      stored: {
        modelId: "gpt-4.1",
        effort: "low",
        selectionMode: "manual",
        providerFamilyId: "codex",
        fastMode: false,
        accessMode: "read-only",
        collaborationModeId: "default",
        executionMode: "local-cli",
        updatedAt: 100,
      },
      pendingSeed: {
        workspaceId: "ws-1",
        selectionMode: "manual",
        providerFamilyId: "claude",
        collaborationModeId: "plan",
        fastMode: true,
        accessMode: "full-access",
        executionMode: "hybrid",
        autoDriveDraft: null,
      },
    });

    expect(storedResolved).toEqual({
      scopeKey: "ws-1:thread-1",
      accessMode: "read-only",
      preferredModelId: "gpt-4.1",
      preferredEffort: "low",
      selectionMode: "manual",
      providerFamilyId: "codex",
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
      composerModelSelectionMode: "auto",
      lastComposerProviderFamilyId: "claude",
      lastComposerFastMode: false,
      lastComposerExecutionMode: "runtime",
      stored: null,
      pendingSeed: {
        workspaceId: "ws-1",
        selectionMode: "manual",
        providerFamilyId: "claude",
        collaborationModeId: "plan",
        fastMode: true,
        accessMode: "full-access",
        executionMode: "hybrid",
        autoDriveDraft: null,
      },
    });

    expect(seededResolved).toEqual({
      scopeKey: "ws-1:thread-2",
      accessMode: "full-access",
      preferredModelId: "gpt-5",
      preferredEffort: "medium",
      selectionMode: "manual",
      providerFamilyId: "claude",
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
      composerModelSelectionMode: "auto",
      lastComposerProviderFamilyId: "codex",
      lastComposerFastMode: false,
      lastComposerExecutionMode: "runtime",
      stored: null,
      pendingSeed: null,
      currentScopeKey: "ws-1:__no_thread__",
      currentModelId: "gpt-5.3-codex",
      currentReasoningEffort: "low",
      currentSelectionMode: "manual",
      currentProviderFamilyId: "claude",
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
      selectionMode: "manual",
      providerFamilyId: "claude",
      preferredFastMode: true,
      preferredCollabModeId: "plan",
      executionMode: "hybrid",
    });
  });

  it("builds first-message seed patch with pending workspace snapshot", () => {
    expect(
      buildThreadCodexSeedPatch({
        workspaceId: "ws-1",
        selectedModelId: "openai::gpt-5",
        resolvedModel: "gpt-5",
        resolvedEffort: "high",
        selectionMode: "auto",
        providerFamilyId: "codex",
        fastMode: false,
        accessMode: "full-access",
        selectedCollaborationModeId: "default",
        executionMode: "runtime",
        pendingSeed: {
          workspaceId: "ws-1",
          selectionMode: "manual",
          providerFamilyId: "claude",
          collaborationModeId: "plan",
          fastMode: true,
          accessMode: "full-access",
          executionMode: "local-cli",
          autoDriveDraft: {
            enabled: true,
            destination: {
              title: "Auto continue",
              endState: "",
              doneDefinition: "",
              avoid: "",
              routePreference: "stability_first",
            },
            budget: {
              maxTokens: 6000,
              maxIterations: 3,
              maxDurationMinutes: 10,
              maxFilesPerIteration: 6,
              maxNoProgressIterations: 2,
              maxValidationFailures: 2,
              maxReroutes: 2,
            },
            riskPolicy: {
              pauseOnDestructiveChange: true,
              pauseOnDependencyChange: true,
              pauseOnLowConfidence: true,
              pauseOnHumanCheckpoint: true,
              allowNetworkAnalysis: true,
              allowValidationCommands: true,
              allowChatgptDecisionLab: true,
              autoRunChatgptDecisionLab: true,
              chatgptDecisionLabMinConfidence: "medium",
              chatgptDecisionLabMaxScoreGap: 8,
              minimumConfidence: "medium",
            },
            continuation: {
              enabled: true,
              maxAutomaticFollowUps: 2,
              requireValidationSuccessToStop: true,
              minimumConfidenceToStop: "high",
            },
          },
        },
      })
    ).toEqual({
      modelId: "openai::gpt-5",
      effort: "high",
      selectionMode: "manual",
      providerFamilyId: "claude",
      fastMode: true,
      accessMode: "full-access",
      collaborationModeId: "plan",
      executionMode: "local-cli",
      autoDriveDraft: expect.objectContaining({
        enabled: true,
        destination: expect.objectContaining({ title: "Auto continue" }),
      }),
    });

    expect(
      buildThreadCodexSeedPatch({
        workspaceId: "ws-1",
        selectedModelId: "openai::gpt-5",
        resolvedModel: "gpt-5",
        resolvedEffort: "high",
        selectionMode: "auto",
        providerFamilyId: "codex",
        fastMode: false,
        accessMode: "full-access",
        selectedCollaborationModeId: "default",
        executionMode: "runtime",
        pendingSeed: {
          workspaceId: "ws-other",
          selectionMode: "manual",
          providerFamilyId: "claude",
          collaborationModeId: "plan",
          fastMode: true,
          accessMode: "full-access",
          executionMode: "local-cli",
          autoDriveDraft: null,
        },
      })
    ).toEqual({
      modelId: "openai::gpt-5",
      effort: "high",
      selectionMode: "auto",
      providerFamilyId: "codex",
      fastMode: false,
      accessMode: "full-access",
      collaborationModeId: "default",
      executionMode: "runtime",
      autoDriveDraft: null,
    });
  });

  it("builds first-message seed patch from the selected model id while preserving the runtime slug separately", () => {
    expect(
      buildThreadCodexSeedPatch({
        workspaceId: "ws-1",
        selectedModelId: "claude_code_local::claude-sonnet-4-5",
        resolvedModel: "claude-sonnet-4-5",
        resolvedEffort: "high",
        selectionMode: "manual",
        providerFamilyId: "claude",
        fastMode: true,
        accessMode: "full-access",
        selectedCollaborationModeId: null,
        executionMode: "hybrid",
        pendingSeed: null,
      })
    ).toEqual({
      modelId: "claude_code_local::claude-sonnet-4-5",
      effort: "high",
      selectionMode: "manual",
      providerFamilyId: "claude",
      fastMode: true,
      accessMode: "full-access",
      collaborationModeId: null,
      executionMode: "hybrid",
      autoDriveDraft: null,
    });
  });
});

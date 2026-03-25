import type { AgentTaskSourceSummary } from "@ku0/code-runtime-host-contract";
import { describe, expect, it, vi } from "vitest";
import { RuntimeUnavailableError } from "../ports/runtimeClient";
import * as runtimeClientPort from "../ports/runtimeClient";
import {
  parseRepositoryExecutionContract,
  readRepositoryExecutionContract,
  resolveRepositoryExecutionDefaults,
} from "./runtimeRepositoryExecutionContract";

function createContract() {
  return parseRepositoryExecutionContract(
    JSON.stringify({
      version: 1,
      metadata: {
        label: "Workspace defaults",
      },
      defaults: {
        executionProfileId: "balanced-delegate",
        reviewProfileId: "default-review",
        validationPresetId: "standard",
      },
      defaultReviewProfileId: "default-review",
      sourceMappings: {
        github_issue: {
          executionProfileId: "autonomous-delegate",
          reviewProfileId: "issue-review",
          validationPresetId: "review-first",
          preferredBackendIds: ["backend-issue"],
        },
        schedule: {
          executionProfileId: "autonomous-delegate",
          reviewProfileId: "schedule-review",
          validationPresetId: "review-first",
          preferredBackendIds: ["backend-schedule"],
          accessMode: "on-request",
        },
        github_discussion: {
          executionProfileId: "balanced-delegate",
          reviewProfileId: "issue-review",
        },
        customer_feedback: {
          executionProfileId: "balanced-delegate",
          validationPresetId: "standard",
        },
      },
      validationPresets: [
        {
          id: "review-first",
          label: "Review first",
          commands: ["pnpm validate:fast"],
        },
        {
          id: "standard",
          label: "Standard",
          commands: ["pnpm validate", "pnpm test:component"],
        },
      ],
      reviewProfiles: [
        {
          id: "default-review",
          label: "Default Review",
          allowedSkillIds: ["review-agent"],
          validationPresetId: "standard",
          autofixPolicy: "bounded",
          githubMirrorPolicy: "summary",
        },
        {
          id: "issue-review",
          label: "Issue Review",
          allowedSkillIds: ["review-agent", "repo-policy-check"],
          validationPresetId: "review-first",
          autofixPolicy: "manual",
          githubMirrorPolicy: "check_output",
        },
        {
          id: "schedule-review",
          label: "Schedule Review",
          allowedSkillIds: ["review-agent"],
          validationPresetId: "standard",
          autofixPolicy: "disabled",
          githubMirrorPolicy: "disabled",
        },
      ],
    })
  );
}

function createTaskSource(kind: AgentTaskSourceSummary["kind"]): AgentTaskSourceSummary {
  return {
    kind,
    title: "Task source",
  };
}

describe("runtimeRepositoryExecutionContract", () => {
  it("loads a valid v1 contract", () => {
    const contract = createContract();

    expect(contract.defaults).toMatchObject({
      executionProfileId: "balanced-delegate",
      reviewProfileId: "default-review",
      validationPresetId: "standard",
    });
    expect(contract.sourceMappings.github_issue).toMatchObject({
      executionProfileId: "autonomous-delegate",
      reviewProfileId: "issue-review",
      preferredBackendIds: ["backend-issue"],
    });
    expect(contract.sourceMappings.schedule).toMatchObject({
      executionProfileId: "autonomous-delegate",
      reviewProfileId: "schedule-review",
      preferredBackendIds: ["backend-schedule"],
      accessMode: "on-request",
    });
    expect(contract.validationPresets).toHaveLength(2);
    expect(contract.reviewProfiles).toHaveLength(3);
  });

  it("rejects unknown versions with an actionable error", () => {
    expect(() =>
      parseRepositoryExecutionContract(
        JSON.stringify({
          version: 2,
          validationPresets: [
            {
              id: "standard",
              commands: ["pnpm validate"],
            },
          ],
        })
      )
    ).toThrow(/Unsupported repository execution contract version/u);
  });

  it("rejects malformed source mappings and preset references", () => {
    expect(() =>
      parseRepositoryExecutionContract(
        JSON.stringify({
          version: 1,
          defaults: {},
          sourceMappings: {
            github_issue: {
              validationPresetId: "missing-preset",
            },
          },
          validationPresets: [
            {
              id: "standard",
              commands: ["pnpm validate"],
            },
          ],
        })
      )
    ).toThrow(/must reference a declared validation preset/u);

    expect(() =>
      parseRepositoryExecutionContract(
        JSON.stringify({
          version: 1,
          defaults: {},
          sourceMappings: {
            jira_issue: {},
          },
          validationPresets: [
            {
              id: "standard",
              commands: ["pnpm validate"],
            },
          ],
        })
      )
    ).toThrow(/supported task source/u);

    expect(() =>
      parseRepositoryExecutionContract(
        JSON.stringify({
          version: 1,
          defaults: {
            reviewProfileId: "missing-review-profile",
          },
          validationPresets: [
            {
              id: "standard",
              commands: ["pnpm validate"],
            },
          ],
          reviewProfiles: [
            {
              id: "default-review",
              label: "Default Review",
              allowedSkillIds: ["review-agent"],
              validationPresetId: "standard",
              autofixPolicy: "bounded",
              githubMirrorPolicy: "summary",
            },
          ],
        })
      )
    ).toThrow(/must reference a declared review profile/u);
  });

  it("degrades to no contract when runtime file reads are unavailable", async () => {
    const runtimeClientSpy = vi.spyOn(runtimeClientPort, "getRuntimeClient").mockReturnValue({
      workspaceFileRead: vi
        .fn()
        .mockRejectedValue(new RuntimeUnavailableError("read workspace file")),
    } as unknown as ReturnType<typeof runtimeClientPort.getRuntimeClient>);

    await expect(readRepositoryExecutionContract("ws-1")).resolves.toBeNull();

    runtimeClientSpy.mockRestore();
  });

  it("lets explicit launch input override source mappings", () => {
    const resolved = resolveRepositoryExecutionDefaults({
      contract: createContract(),
      taskSource: createTaskSource("github_issue"),
      explicitLaunchInput: {
        executionProfileId: "balanced-delegate",
        validationPresetId: "standard",
        preferredBackendIds: ["backend-explicit"],
      },
    });

    expect(resolved).toMatchObject({
      sourceMappingKind: "github_issue",
      executionProfileId: "balanced-delegate",
      reviewProfileId: "issue-review",
      validationPresetId: "standard",
      preferredBackendIds: ["backend-explicit"],
    });
  });

  it("prefers schedule source mappings over repo defaults and explicit launch input", () => {
    const resolved = resolveRepositoryExecutionDefaults({
      contract: createContract(),
      taskSource: createTaskSource("schedule"),
    });

    expect(resolved).toMatchObject({
      sourceMappingKind: "schedule",
      executionProfileId: "autonomous-delegate",
      reviewProfileId: "schedule-review",
      validationPresetId: "review-first",
      validationCommands: ["pnpm validate:fast"],
      preferredBackendIds: ["backend-schedule"],
      accessMode: "on-request",
    });
  });

  it("accepts expanded source mapping kinds for context-driven intake", () => {
    const resolvedDiscussion = resolveRepositoryExecutionDefaults({
      contract: createContract(),
      taskSource: createTaskSource("github_discussion"),
    });
    const resolvedFeedback = resolveRepositoryExecutionDefaults({
      contract: createContract(),
      taskSource: createTaskSource("customer_feedback"),
    });

    expect(resolvedDiscussion).toMatchObject({
      sourceMappingKind: "github_discussion",
      executionProfileId: "balanced-delegate",
      reviewProfileId: "issue-review",
    });
    expect(resolvedFeedback).toMatchObject({
      sourceMappingKind: "customer_feedback",
      executionProfileId: "balanced-delegate",
      validationPresetId: "standard",
    });
  });
});

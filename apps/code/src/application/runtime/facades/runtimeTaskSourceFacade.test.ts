import { describe, expect, it } from "vitest";
import {
  buildGitHubIssueTaskSource,
  buildScheduleTaskSource,
  resolveRepoContext,
} from "./runtimeTaskSourceFacade";

describe("runtimeTaskSourceFacade", () => {
  it("normalizes GitHub issue URLs to canonical repository URLs when no git remote is loaded", () => {
    expect(
      resolveRepoContext({
        sourceUrl: "https://github.com/acme/hugecode/issues/42",
      })
    ).toEqual({
      owner: "acme",
      name: "hugecode",
      fullName: "acme/hugecode",
      remoteUrl: "https://github.com/acme/hugecode",
    });
  });

  it("prefers the workspace git remote when it is available", () => {
    expect(
      resolveRepoContext({
        sourceUrl: "https://github.com/acme/hugecode/pull/17",
        gitRemoteUrl: "https://github.com/acme/hugecode.git",
      })
    ).toEqual({
      owner: "acme",
      name: "hugecode",
      fullName: "acme/hugecode",
      remoteUrl: "https://github.com/acme/hugecode.git",
    });
  });

  it("keeps SSH remotes while still resolving canonical repo identity", () => {
    expect(
      resolveRepoContext({
        sourceUrl: "https://github.com/acme/hugecode/issues/42",
        gitRemoteUrl: "git@github.com:acme/hugecode.git",
      })
    ).toEqual({
      owner: "acme",
      name: "hugecode",
      fullName: "acme/hugecode",
      remoteUrl: "git@github.com:acme/hugecode.git",
    });
  });

  it("parses SSH remotes even without a source URL fallback", () => {
    expect(
      resolveRepoContext({
        gitRemoteUrl: "git@github.com:acme/hugecode.git",
      })
    ).toEqual({
      owner: "acme",
      name: "hugecode",
      fullName: "acme/hugecode",
      remoteUrl: "git@github.com:acme/hugecode.git",
    });
  });

  it("builds GitHub issue task sources with stable provenance fields", () => {
    expect(
      buildGitHubIssueTaskSource({
        issue: {
          number: 42,
          title: "Unify ingress",
          url: "https://github.com/acme/hugecode/issues/42",
          updatedAt: "2026-03-27T00:00:00.000Z",
        },
        workspaceId: "ws-1",
        workspaceRoot: "/workspace/hugecode",
        gitRemoteUrl: "https://github.com/acme/hugecode.git",
        sourceTaskId: "issue-42",
      })
    ).toEqual(
      expect.objectContaining({
        kind: "github_issue",
        label: "GitHub issue #42",
        shortLabel: "Issue #42",
        externalId: "https://github.com/acme/hugecode/issues/42",
        canonicalUrl: "https://github.com/acme/hugecode/issues/42",
        sourceTaskId: "issue-42",
        sourceRunId: "https://github.com/acme/hugecode/issues/42",
        workspaceId: "ws-1",
        workspaceRoot: "/workspace/hugecode",
      })
    );
  });

  it("builds schedule task sources with canonical schedule provenance", () => {
    expect(
      buildScheduleTaskSource({
        scheduleId: "schedule-1",
        title: "Nightly review",
        workspaceId: "ws-1",
      })
    ).toEqual(
      expect.objectContaining({
        kind: "schedule",
        label: "Scheduled task",
        shortLabel: "Schedule",
        title: "Nightly review",
        externalId: "schedule-1",
        canonicalUrl: "schedule://schedule-1",
        sourceTaskId: "schedule-1",
        sourceRunId: "schedule-1",
        workspaceId: "ws-1",
      })
    );
  });
});

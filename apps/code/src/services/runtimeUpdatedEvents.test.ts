import { describe, expect, it } from "vitest";
import {
  parseRuntimeUpdatedEvent,
  runtimeUpdatedEventMatchesWorkspace,
} from "./runtimeUpdatedEvents";

describe("parseRuntimeUpdatedEvent", () => {
  it("returns null for non runtime/updated events", () => {
    const parsed = parseRuntimeUpdatedEvent({
      workspace_id: "workspace-1",
      message: {
        method: "thread/started",
        params: {},
      },
    });

    expect(parsed).toBeNull();
  });

  it("normalizes reason and scope", () => {
    const parsed = parseRuntimeUpdatedEvent({
      workspace_id: "workspace-local",
      message: {
        method: "runtime/updated",
        params: {
          reason: " stream_reconnected ",
          scope: ["threads", "threads", " oauth "],
        },
      },
    });

    expect(parsed).not.toBeNull();
    expect(parsed?.reason).toBe("stream_reconnected");
    expect(parsed?.scope).toEqual(["threads", "oauth"]);
    expect(parsed?.isWorkspaceLocalEvent).toBe(true);
  });

  it("canonicalizes legacy runtime run reasons onto v2 reason names", () => {
    const parsed = parseRuntimeUpdatedEvent({
      workspace_id: "workspace-local",
      message: {
        method: "runtime/updated",
        params: {
          reason: "code_runtime_run_start",
          scope: ["agents"],
        },
      },
    });

    expect(parsed).not.toBeNull();
    expect(parsed?.reason).toBe("code_runtime_run_start_v2");
    expect(parsed?.scope).toEqual(["agents"]);
  });

  it("maps native state fabric events onto runtime-updated scopes", () => {
    const parsed = parseRuntimeUpdatedEvent({
      workspace_id: "workspace-local",
      message: {
        method: "native_state_fabric_updated",
        params: {
          revision: 9,
          scopeKind: "skills",
          changeKind: "skillsCatalogPatched",
          workspaceId: "workspace-1",
        },
      },
    });

    expect(parsed).not.toBeNull();
    expect(parsed?.reason).toBe("skillsCatalogPatched");
    expect(parsed?.scope).toEqual(["skills"]);
    expect(parsed?.paramsWorkspaceId).toBe("workspace-1");
  });

  it("maps native task and run state fabric events onto agents scope", () => {
    const taskParsed = parseRuntimeUpdatedEvent({
      workspace_id: "workspace-local",
      message: {
        method: "native_state_fabric_updated",
        params: {
          revision: 10,
          scopeKind: "task",
          changeKind: "taskUpsert",
          workspaceId: "workspace-1",
          taskId: "task-1",
        },
      },
    });

    const runParsed = parseRuntimeUpdatedEvent({
      workspace_id: "workspace-local",
      message: {
        method: "native_state_fabric_updated",
        params: {
          revision: 11,
          scopeKind: "run",
          changeKind: "runUpsert",
          workspaceId: "workspace-1",
          runId: "run-1",
        },
      },
    });

    expect(taskParsed?.scope).toEqual(["agents"]);
    expect(taskParsed?.reason).toBe("taskUpsert");
    expect(taskParsed?.paramsWorkspaceId).toBe("workspace-1");

    expect(runParsed?.scope).toEqual(["agents"]);
    expect(runParsed?.reason).toBe("runUpsert");
    expect(runParsed?.paramsWorkspaceId).toBe("workspace-1");
  });
});

describe("runtimeUpdatedEventMatchesWorkspace", () => {
  it("matches explicit event workspace id", () => {
    const parsed = parseRuntimeUpdatedEvent({
      workspace_id: "workspace-2",
      message: {
        method: "runtime/updated",
        params: { scope: ["threads"] },
      },
    });

    expect(parsed).not.toBeNull();
    expect(
      runtimeUpdatedEventMatchesWorkspace(parsed as NonNullable<typeof parsed>, "workspace-2")
    ).toBe(true);
    expect(
      runtimeUpdatedEventMatchesWorkspace(parsed as NonNullable<typeof parsed>, "workspace-3")
    ).toBe(false);
  });

  it("matches workspace-local events without explicit params workspace id", () => {
    const parsed = parseRuntimeUpdatedEvent({
      workspace_id: "workspace-local",
      message: {
        method: "runtime/updated",
        params: { scope: ["workspaces"] },
      },
    });

    expect(parsed).not.toBeNull();
    expect(
      runtimeUpdatedEventMatchesWorkspace(parsed as NonNullable<typeof parsed>, "workspace-a")
    ).toBe(true);
  });

  it("enforces params workspace id for workspace-local scoped events", () => {
    const parsed = parseRuntimeUpdatedEvent({
      workspace_id: "workspace-local",
      message: {
        method: "runtime/updated",
        params: {
          scope: ["workspaces"],
          workspaceId: "workspace-b",
        },
      },
    });

    expect(parsed).not.toBeNull();
    expect(
      runtimeUpdatedEventMatchesWorkspace(parsed as NonNullable<typeof parsed>, "workspace-b")
    ).toBe(true);
    expect(
      runtimeUpdatedEventMatchesWorkspace(parsed as NonNullable<typeof parsed>, "workspace-a")
    ).toBe(false);
  });
});

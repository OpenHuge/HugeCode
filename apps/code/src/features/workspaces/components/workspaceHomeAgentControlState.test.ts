// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import {
  readCachedState,
  readCachedStateWithStatus,
  writeCachedState,
} from "./workspaceHomeAgentControlState";

const workspaceId = "ws-state-test";
const storageKey = `workspace-home-agent-control:${workspaceId}`;

afterEach(() => {
  window.localStorage.removeItem(storageKey);
});

describe("workspaceHomeAgentControlState", () => {
  it("migrates legacy state to the cache-backed v7 command-center shape", () => {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        version: 1,
        webMcpEnabled: true,
        readOnlyMode: false,
        requireUserApproval: true,
      })
    );

    const restored = readCachedState(workspaceId);
    expect(restored).toBeTruthy();
    if (!restored) {
      throw new Error("expected restored state");
    }
    expect(restored.version).toBe(7);
    expect(restored.lastKnownPersistedControls).toEqual({
      readOnlyMode: false,
      requireUserApproval: true,
      webMcpAutoExecuteCalls: true,
    });
    expect(restored.webMcpConsoleMode).toBe("basic");
    expect(restored).not.toHaveProperty("tasks");
    expect(restored).not.toHaveProperty("governancePolicy");
    expect(restored).not.toHaveProperty("lastSupervisionCycle");
    expect(restored).not.toHaveProperty("auditLog");
  });

  it("migrates v4 state with basic webmcp mode default", () => {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        version: 4,
        webMcpEnabled: true,
        readOnlyMode: false,
        requireUserApproval: true,
        webMcpAutoExecuteCalls: false,
        governancePolicy: {
          autoEnabled: false,
          intervalMinutes: 5,
          pauseBlockedInProgress: true,
          reassignUnowned: true,
          terminateOverdueDays: 5,
          ownerPool: [],
        },
        lastSupervisionCycle: null,
        auditLog: [],
      })
    );

    const restored = readCachedState(workspaceId);
    expect(restored).toBeTruthy();
    if (!restored) {
      throw new Error("expected restored state");
    }
    expect(restored.version).toBe(7);
    expect(restored.lastKnownPersistedControls).toEqual({
      readOnlyMode: false,
      requireUserApproval: true,
      webMcpAutoExecuteCalls: false,
    });
    expect(restored.webMcpConsoleMode).toBe("basic");
  });

  it("restores and persists the cache-backed v7 state", () => {
    writeCachedState(workspaceId, {
      version: 7,
      webMcpEnabled: true,
      webMcpConsoleMode: "advanced",
      lastKnownPersistedControls: {
        readOnlyMode: false,
        requireUserApproval: true,
        webMcpAutoExecuteCalls: false,
      },
    });

    const restored = readCachedState(workspaceId);
    expect(restored).toBeTruthy();
    if (!restored) {
      throw new Error("expected restored state");
    }
    expect(restored.lastKnownPersistedControls).toEqual({
      readOnlyMode: false,
      requireUserApproval: true,
      webMcpAutoExecuteCalls: false,
    });
    expect(restored.webMcpConsoleMode).toBe("advanced");
  });

  it("falls back to basic mode when stored value is invalid", () => {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        version: 6,
        webMcpEnabled: true,
        readOnlyMode: false,
        requireUserApproval: true,
        webMcpAutoExecuteCalls: true,
        webMcpConsoleMode: "unknown",
      })
    );

    const restored = readCachedState(workspaceId);
    expect(restored).toBeTruthy();
    if (!restored) {
      throw new Error("expected restored state");
    }
    expect(restored.webMcpConsoleMode).toBe("basic");
  });

  it("marks malformed cache payloads as corrupted so host-backed flow can recover safely", () => {
    window.localStorage.setItem(storageKey, "{invalid-json");

    const restored = readCachedStateWithStatus(workspaceId);

    expect(restored.state).toBeNull();
    expect(restored.corrupted).toBe(true);
  });
});

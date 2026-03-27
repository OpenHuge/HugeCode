import { describe, expect, it, vi } from "vitest";
import type { OAuthAccountSummary } from "../ports/tauriOauth";
import {
  leaveDeactivatedChatgptWorkspacesWithDeps,
  resolveLocalChromeDebuggerEndpointWithDeps,
  reviewDeactivatedChatgptWorkspacesWithDeps,
} from "./chatgptWorkspaceAutomation";

function buildAccount(overrides: Partial<OAuthAccountSummary> = {}): OAuthAccountSummary {
  return {
    accountId: "codex-account-1",
    provider: "codex",
    externalAccountId: "chatgpt-account-1",
    email: "dev@example.com",
    displayName: "Dev",
    status: "enabled",
    disabledReason: null,
    metadata: {},
    createdAt: 1,
    updatedAt: 2,
    chatgptWorkspaces: [
      {
        workspaceId: "ws-active",
        title: "Alpha Team",
        role: "member",
        isDefault: true,
      },
      {
        workspaceId: "ws-deactivated",
        title: "Beta Org",
        role: "member",
        isDefault: false,
      },
    ],
    defaultChatgptWorkspaceId: "ws-active",
    ...overrides,
  };
}

describe("chatgptWorkspaceAutomation", () => {
  it("prefers Electron-discovered debugger endpoints before probing fallback ports", async () => {
    const endpoint = await resolveLocalChromeDebuggerEndpointWithDeps({
      fetchVersionPayload: vi.fn(async (httpBaseUrl) => ({
        webSocketDebuggerUrl: `${httpBaseUrl.replace("http", "ws")}/devtools/browser/browser-1`,
      })),
      listDesktopHostEndpoints: vi.fn(async () => [
        {
          httpBaseUrl: "http://127.0.0.1:9333",
          webSocketDebuggerUrl: "ws://127.0.0.1:9333/devtools/browser/browser-electron",
        },
      ]),
      fallbackPorts: [9222, 9223],
    });

    expect(endpoint).toEqual({
      httpBaseUrl: "http://127.0.0.1:9333",
      webSocketDebuggerUrl: "ws://127.0.0.1:9333/devtools/browser/browser-electron",
    });
  });

  it("falls back to probing common localhost debug ports when desktop endpoints are unavailable", async () => {
    const fetchVersionPayload = vi.fn(async (httpBaseUrl: string) => {
      if (httpBaseUrl === "http://127.0.0.1:9223") {
        return {
          webSocketDebuggerUrl: "ws://127.0.0.1:9223/devtools/browser/browser-fallback",
        };
      }
      throw new Error("unreachable");
    });

    const endpoint = await resolveLocalChromeDebuggerEndpointWithDeps({
      fetchVersionPayload,
      listDesktopHostEndpoints: vi.fn(async () => []),
      fallbackPorts: [9222, 9223],
    });

    expect(endpoint).toEqual({
      httpBaseUrl: "http://127.0.0.1:9223",
      webSocketDebuggerUrl: "ws://127.0.0.1:9223/devtools/browser/browser-fallback",
    });
    expect(fetchVersionPayload).toHaveBeenCalledTimes(2);
  });

  it("reports a blocked status when no local Chrome CDP endpoint is available", async () => {
    const result = await reviewDeactivatedChatgptWorkspacesWithDeps(buildAccount(), {
      reviewRemoteWorkspaces: vi.fn(),
      resolveChromeDebuggerEndpoint: vi.fn(async () => null),
    });

    expect(result).toEqual({
      status: "blocked",
      message: expect.stringContaining("--remote-debugging-port=9222"),
      candidates: [],
      endpoint: null,
      remoteWorkspaces: [],
    });
  });

  it("returns only locally recorded workspaces that remote ChatGPT confirms as deactivated", async () => {
    const result = await reviewDeactivatedChatgptWorkspacesWithDeps(buildAccount(), {
      resolveChromeDebuggerEndpoint: vi.fn(async () => ({
        httpBaseUrl: "http://127.0.0.1:9222",
        webSocketDebuggerUrl: "ws://127.0.0.1:9222/devtools/browser/browser-1",
      })),
      reviewRemoteWorkspaces: vi.fn(async () => [
        {
          remoteWorkspaceId: "ws-active",
          title: "Alpha Team",
          isDeactivated: false,
        },
        {
          remoteWorkspaceId: "ws-deactivated",
          title: "Beta Org",
          isDeactivated: true,
        },
        {
          remoteWorkspaceId: "ws-remote-only",
          title: "Gamma",
          isDeactivated: true,
        },
      ]),
    });

    expect(result.status).toBe("supported");
    expect(result.endpoint?.httpBaseUrl).toBe("http://127.0.0.1:9222");
    expect(result.candidates).toEqual([
      {
        localWorkspace: {
          workspaceId: "ws-deactivated",
          title: "Beta Org",
          role: "member",
          isDefault: false,
        },
        remoteWorkspace: {
          remoteWorkspaceId: "ws-deactivated",
          title: "Beta Org",
          isDeactivated: true,
        },
      },
    ]);
  });

  it("aggregates leave results and refresh candidates by workspace id", async () => {
    const account = buildAccount();
    const result = await leaveDeactivatedChatgptWorkspacesWithDeps(
      {
        account,
        candidates: [
          {
            localWorkspace: account.chatgptWorkspaces?.[1]!,
            remoteWorkspace: {
              remoteWorkspaceId: "ws-deactivated",
              title: "Beta Org",
              isDeactivated: true,
            },
          },
        ],
      },
      {
        executeLeave: vi.fn(async () => ({
          remoteWorkspaceId: "ws-deactivated",
          left: true,
        })),
        resolveChromeDebuggerEndpoint: vi.fn(async () => ({
          httpBaseUrl: "http://127.0.0.1:9222",
          webSocketDebuggerUrl: "ws://127.0.0.1:9222/devtools/browser/browser-1",
        })),
      }
    );

    expect(result).toEqual({
      status: "completed",
      endpoint: {
        httpBaseUrl: "http://127.0.0.1:9222",
        webSocketDebuggerUrl: "ws://127.0.0.1:9222/devtools/browser/browser-1",
      },
      leftWorkspaceIds: ["ws-deactivated"],
      failedWorkspaceIds: [],
      message: expect.stringContaining("Beta Org"),
    });
  });
});

import { describe, expect, it, vi } from "vitest";
import type { OAuthAccountSummary } from "../ports/tauriOauth";
import {
  doesActiveChatgptAccountMatch,
  leaveDeactivatedChatgptWorkspacesWithDeps,
  parseRemoteChatgptAccountIdentity,
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
      readActiveAccountIdentity: vi.fn(async () => null),
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
      readActiveAccountIdentity: vi.fn(async () => ({
        externalAccountId: "chatgpt-account-1",
        email: "dev@example.com",
        title: "Dev",
      })),
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

  it("blocks destructive cleanup when the active ChatGPT session belongs to a different account", async () => {
    const result = await reviewDeactivatedChatgptWorkspacesWithDeps(buildAccount(), {
      readActiveAccountIdentity: vi.fn(async () => ({
        externalAccountId: "chatgpt-account-2",
        email: "other@example.com",
        title: "Other Account",
      })),
      resolveChromeDebuggerEndpoint: vi.fn(async () => ({
        httpBaseUrl: "http://127.0.0.1:9222",
        webSocketDebuggerUrl: "ws://127.0.0.1:9222/devtools/browser/browser-1",
      })),
      reviewRemoteWorkspaces: vi.fn(async () => [
        {
          remoteWorkspaceId: "ws-deactivated",
          title: "Beta Org",
          isDeactivated: true,
        },
      ]),
    });

    expect(result.status).toBe("blocked");
    expect(result.message).toContain("does not match");
    expect(result.candidates).toEqual([]);
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
        readActiveAccountIdentity: vi.fn(async () => ({
          externalAccountId: "chatgpt-account-1",
          email: "dev@example.com",
          title: "Dev",
        })),
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

  it("blocks leave when the active ChatGPT session drifts to another account after review", async () => {
    const account = buildAccount();
    const executeLeave = vi.fn();

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
        readActiveAccountIdentity: vi.fn(async () => ({
          externalAccountId: "chatgpt-account-2",
          email: "other@example.com",
          title: "Other Account",
        })),
        executeLeave,
        resolveChromeDebuggerEndpoint: vi.fn(async () => ({
          httpBaseUrl: "http://127.0.0.1:9222",
          webSocketDebuggerUrl: "ws://127.0.0.1:9222/devtools/browser/browser-1",
        })),
      }
    );

    expect(result.status).toBe("blocked");
    expect(result.message).toContain("does not match");
    expect(result.leftWorkspaceIds).toEqual([]);
    expect(result.failedWorkspaceIds).toEqual(["ws-deactivated"]);
    expect(executeLeave).not.toHaveBeenCalled();
  });

  it("leaves deactivated workspaces sequentially instead of racing the same ChatGPT page", async () => {
    let releaseFirstLeave: (() => void) | null = null;
    const firstLeaveCompleted = new Promise<void>((resolve) => {
      releaseFirstLeave = resolve;
    });
    const callOrder: string[] = [];
    const account = buildAccount({
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
        {
          workspaceId: "ws-gamma",
          title: "Gamma Org",
          role: "member",
          isDefault: false,
        },
      ],
    });
    const executeLeave = vi.fn(async (_endpoint, _account, candidate) => {
      callOrder.push(`start:${candidate.localWorkspace.workspaceId}`);
      if (candidate.localWorkspace.workspaceId === "ws-deactivated") {
        await firstLeaveCompleted;
      }
      callOrder.push(`end:${candidate.localWorkspace.workspaceId}`);
      return {
        remoteWorkspaceId: candidate.localWorkspace.workspaceId,
        left: candidate.localWorkspace.workspaceId !== "ws-gamma",
      };
    });

    const resultPromise = leaveDeactivatedChatgptWorkspacesWithDeps(
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
          {
            localWorkspace: account.chatgptWorkspaces?.[2]!,
            remoteWorkspace: {
              remoteWorkspaceId: "ws-gamma",
              title: "Gamma Org",
              isDeactivated: true,
            },
          },
        ],
      },
      {
        readActiveAccountIdentity: vi.fn(async () => ({
          externalAccountId: "chatgpt-account-1",
          email: "dev@example.com",
          title: "Dev",
        })),
        executeLeave,
        resolveChromeDebuggerEndpoint: vi.fn(async () => ({
          httpBaseUrl: "http://127.0.0.1:9222",
          webSocketDebuggerUrl: "ws://127.0.0.1:9222/devtools/browser/browser-1",
        })),
      }
    );

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(executeLeave).toHaveBeenCalledTimes(1);
    expect(callOrder).toEqual(["start:ws-deactivated"]);

    releaseFirstLeave?.();
    const result = await resultPromise;

    expect(executeLeave).toHaveBeenCalledTimes(2);
    expect(callOrder).toEqual([
      "start:ws-deactivated",
      "end:ws-deactivated",
      "start:ws-gamma",
      "end:ws-gamma",
    ]);
    expect(result).toEqual({
      status: "failed",
      endpoint: {
        httpBaseUrl: "http://127.0.0.1:9222",
        webSocketDebuggerUrl: "ws://127.0.0.1:9222/devtools/browser/browser-1",
      },
      leftWorkspaceIds: ["ws-deactivated"],
      failedWorkspaceIds: ["ws-gamma"],
      message: "Left Beta Org, but failed to leave another workspace.",
    });
  });

  it("parses the active ChatGPT account identity from accounts-check payloads", () => {
    expect(
      parseRemoteChatgptAccountIdentity({
        current_account_id: "chatgpt-account-1",
        accounts: [
          {
            account_id: "chatgpt-account-1",
            email: "dev@example.com",
            account_name: "Dev Account",
          },
        ],
      })
    ).toEqual({
      externalAccountId: "chatgpt-account-1",
      email: "dev@example.com",
      title: "Dev Account",
    });
  });

  it("matches active ChatGPT identity by account id or email", () => {
    const account = buildAccount();
    expect(
      doesActiveChatgptAccountMatch(account, {
        externalAccountId: "chatgpt-account-1",
        email: null,
        title: null,
      })
    ).toBe(true);
    expect(
      doesActiveChatgptAccountMatch(account, {
        externalAccountId: null,
        email: "dev@example.com",
        title: null,
      })
    ).toBe(true);
    expect(
      doesActiveChatgptAccountMatch(account, {
        externalAccountId: "chatgpt-account-2",
        email: "other@example.com",
        title: null,
      })
    ).toBe(false);
  });
});

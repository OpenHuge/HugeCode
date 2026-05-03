import { afterEach, describe, expect, it, vi } from "vitest";
import { CODE_RUNTIME_RPC_METHODS } from "@ku0/code-runtime-host-contract";
import {
  cancelT3CodexOAuthLogin,
  importT3CodexAuthJson,
  startT3CodexOAuthLogin,
  startT3CodexOAuthLoginInLocalDefaultBrowser,
} from "./t3CodexOAuth";

describe("t3CodexOAuth", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete window.hugeCodeDesktopHost;
  });

  it("starts Codex OAuth login through the runtime gateway", async () => {
    const fetchMock = vi.fn(async (_input: unknown, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body)) as {
        method?: string;
        params?: Record<string, unknown>;
      };
      expect(request).toEqual({
        method: CODE_RUNTIME_RPC_METHODS.OAUTH_CODEX_LOGIN_START,
        params: {
          workspaceId: "workspace-web",
          forceOAuth: true,
        },
      });
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          result: {
            loginId: "login-1",
            authUrl: "https://auth.example.test/codex",
            immediateSuccess: false,
          },
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(startT3CodexOAuthLogin("workspace-web")).resolves.toEqual({
      loginId: "login-1",
      authUrl: "https://auth.example.test/codex",
      immediateSuccess: false,
    });
  });

  it("cancels a pending Codex OAuth login through the runtime gateway", async () => {
    const fetchMock = vi.fn(async (_input: unknown, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body)) as {
        method?: string;
        params?: Record<string, unknown>;
      };
      expect(request).toEqual({
        method: CODE_RUNTIME_RPC_METHODS.OAUTH_CODEX_LOGIN_CANCEL,
        params: {
          workspaceId: "workspace-web",
        },
      });
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          result: {
            canceled: true,
            status: "canceled",
          },
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(cancelT3CodexOAuthLogin("workspace-web")).resolves.toEqual({
      canceled: true,
      status: "canceled",
    });
  });

  it("opens Codex OAuth in the desktop host default browser when available", async () => {
    const authUrl = "https://auth.example.test/codex";
    const openExternalUrl = vi.fn(async () => true);
    window.hugeCodeDesktopHost = {
      shell: {
        openExternalUrl,
      },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          result: {
            loginId: "login-default-browser",
            authUrl,
            immediateSuccess: false,
          },
        }),
      }))
    );

    await expect(startT3CodexOAuthLoginInLocalDefaultBrowser("workspace-web")).resolves.toEqual({
      login: {
        loginId: "login-default-browser",
        authUrl,
        immediateSuccess: false,
      },
      openMode: "local_default_browser",
    });
    expect(openExternalUrl).toHaveBeenCalledWith(authUrl);
  });

  it("imports pasted Codex auth.json and returns compatible formats", async () => {
    const fetchMock = vi.fn(async (_input: unknown, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body)) as {
        method?: string;
        params?: Record<string, unknown>;
      };
      expect(request).toEqual({
        method: CODE_RUNTIME_RPC_METHODS.OAUTH_CODEX_AUTH_JSON_IMPORT,
        params: {
          authJson: '{"tokens":{"access_token":"token"}}',
          sourceLabel: "pasted",
        },
      });
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          result: {
            accountId: "codex-auth-json:123",
            displayName: "codex@example.test",
            email: "codex@example.test",
            imported: true,
            updated: false,
            sourceLabel: "pasted",
            formats: [
              {
                formatId: "new-api",
                fileName: "codex.new-api.json",
                contentType: "application/json",
                content: "{}",
                notes: ["new-api-compatible OpenAI/Codex channel token bundle."],
              },
            ],
            message: "Imported Codex account from auth.json.",
          },
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      importT3CodexAuthJson('{"tokens":{"access_token":"token"}}', "pasted")
    ).resolves.toMatchObject({
      accountId: "codex-auth-json:123",
      formats: [expect.objectContaining({ formatId: "new-api" })],
    });
  });
});

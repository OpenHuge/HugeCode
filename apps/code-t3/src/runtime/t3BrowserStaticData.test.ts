import { beforeEach, describe, expect, it } from "vitest";
import {
  buildT3BrowserPortableLoginStateContract,
  T3_BROWSER_CHATGPT_ALLOWED_ORIGINS,
  T3_BROWSER_PORTABLE_ENCRYPTION,
  T3_BROWSER_PORTABLE_PAYLOAD_POLICY,
  T3_BROWSER_STATIC_DATA_SCHEMA_VERSION_V2,
} from "./t3BrowserAccountDataContract";
import {
  buildT3BrowserStaticDataBundleWithLoginState,
  buildT3BrowserStaticDataExportWitness,
  checkT3BrowserChatGptLoginState,
  formatT3BrowserStaticDataImportError,
  importT3BrowserStaticDataBundle,
  importT3BrowserStaticDataLoginStateBundles,
  serializeT3BrowserStaticDataBundleWithLoginState,
  type T3BrowserEncryptedLoginStateBundle,
  type T3BrowserLoginStatePreflightResult,
} from "./t3BrowserStaticData";

function portableLoginStateBundle(): T3BrowserEncryptedLoginStateBundle {
  return {
    cookieCount: 2,
    createdAt: 1700000000000,
    encryptedPayloadBase64: "portable-ciphertext",
    encryption: T3_BROWSER_PORTABLE_ENCRYPTION,
    id: "portable-chatgpt-login-state:test",
    originCount: 1,
    payloadFormat: "electron-session-state/v2",
    portableContract: buildT3BrowserPortableLoginStateContract(),
    portableCrypto: {
      authTagBase64: "auth-tag",
      ivBase64: "iv",
      saltBase64: "salt",
    },
    stateByteCount: 0,
    stateFileCount: 0,
    summary: "Portable ChatGPT browser account state.",
  };
}

describe("t3BrowserStaticData portable account data", () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete (window as Window & { hugeCodeDesktopHost?: unknown }).hugeCodeDesktopHost;
  });

  it("serializes portable v2 account data as the minimal customer handoff payload", async () => {
    (
      window as Window & {
        hugeCodeDesktopHost?: {
          browserStaticData?: {
            exportLoginState: (input?: {
              allowedOrigins?: readonly string[];
              importSecret?: string;
            }) => Promise<T3BrowserEncryptedLoginStateBundle>;
          };
        };
      }
    ).hugeCodeDesktopHost = {
      browserStaticData: {
        exportLoginState: async (input) => {
          expect(input?.allowedOrigins).toEqual([...T3_BROWSER_CHATGPT_ALLOWED_ORIGINS]);
          expect(input?.importSecret).toBe("delivery-code");
          return portableLoginStateBundle();
        },
      },
    };

    const serialized = await serializeT3BrowserStaticDataBundleWithLoginState({
      importSecret: "delivery-code",
    });
    const parsed = JSON.parse(serialized) as {
      payload: Record<string, unknown>;
      payloadPolicy: string;
      schemaVersion: string;
    };

    expect(parsed.schemaVersion).toBe(T3_BROWSER_STATIC_DATA_SCHEMA_VERSION_V2);
    expect(parsed.payloadPolicy).toBe(T3_BROWSER_PORTABLE_PAYLOAD_POLICY);
    expect(parsed.payload.remoteProfiles).toEqual([]);
    expect(parsed.payload.recentSessions).toEqual([]);
    expect(parsed.payload.loginStateBundles).toEqual([
      expect.objectContaining({
        encryption: T3_BROWSER_PORTABLE_ENCRYPTION,
        id: "portable-chatgpt-login-state:test",
      }),
    ]);
    expect(serialized).not.toContain("electron-safe-storage");
    expect(serialized).not.toContain("accessToken");
    expect(serialized).not.toContain("raw-cookie-value");
  });

  it("builds a masked portable export witness from the account data bundle", async () => {
    (
      window as Window & {
        hugeCodeDesktopHost?: {
          browserStaticData?: {
            exportLoginState: () => Promise<T3BrowserEncryptedLoginStateBundle>;
          };
        };
      }
    ).hugeCodeDesktopHost = {
      browserStaticData: {
        exportLoginState: async () => ({
          ...portableLoginStateBundle(),
          cookieCount: 3,
          originCount: 2,
          stateFileCount: 4,
        }),
      },
    };

    const bundle = await buildT3BrowserStaticDataBundleWithLoginState({
      importSecret: "delivery-code",
    });
    const witness = buildT3BrowserStaticDataExportWitness(bundle);

    expect(witness).toEqual(
      expect.objectContaining({
        cookieCount: 3,
        originCount: 2,
        provider: "chatgpt",
        storageFileCount: 4,
      })
    );
    expect(witness.summary).toContain("hugecode.browser-account-portable/v2");
    expect(witness.summary).not.toContain("portable-ciphertext");
  });

  it("normalizes the ChatGPT login preflight result from the desktop bridge", async () => {
    (
      window as Window & {
        hugeCodeDesktopHost?: {
          browserStaticData?: {
            checkLoginState: (input?: {
              allowedOrigins?: readonly string[];
            }) => Promise<T3BrowserLoginStatePreflightResult>;
          };
        };
      }
    ).hugeCodeDesktopHost = {
      browserStaticData: {
        checkLoginState: async (input) => {
          expect(input?.allowedOrigins).toEqual([...T3_BROWSER_CHATGPT_ALLOWED_ORIGINS]);
          return {
            allowedOrigins: ["https://chatgpt.com", "https://evil.example"],
            cookieCount: 2,
            originCount: 1,
            provider: "chatgpt",
            status: "loggedIn",
            storageFileCount: 0,
            summary: "ChatGPT login preflight found 2 allowlisted cookies across 1 origins.",
          };
        },
      },
    };

    await expect(checkT3BrowserChatGptLoginState()).resolves.toEqual(
      expect.objectContaining({
        allowedOrigins: ["https://chatgpt.com"],
        cookieCount: 2,
        provider: "chatgpt",
        status: "loggedIn",
      })
    );
  });

  it("rejects portable v2 files without login state before writing local metadata", () => {
    const serialized = JSON.stringify({
      payload: {
        remoteProfiles: [
          {
            id: "remote-profile",
            label: "Should not persist",
          },
        ],
      },
      payloadPolicy: T3_BROWSER_PORTABLE_PAYLOAD_POLICY,
      schemaVersion: T3_BROWSER_STATIC_DATA_SCHEMA_VERSION_V2,
    });

    expect(() => importT3BrowserStaticDataBundle(serialized)).toThrow(
      "Portable browser account data file does not contain login state."
    );
    expect(window.localStorage.length).toBe(0);
  });

  it("requires an import code before restoring portable bundles", async () => {
    await expect(
      importT3BrowserStaticDataLoginStateBundles([portableLoginStateBundle()])
    ).rejects.toThrow("Import code is required");
  });

  it("returns success only from the structured desktop restore result", async () => {
    (
      window as Window & {
        hugeCodeDesktopHost?: {
          browserStaticData?: {
            importLoginState: (
              bundle: T3BrowserEncryptedLoginStateBundle,
              input?: { importSecret?: string }
            ) => Promise<{
              importedCookies: number;
              originCount: number;
              restoredBytes: number;
              restoredFiles: number;
              success: boolean;
              summary: string;
            }>;
          };
        };
      }
    ).hugeCodeDesktopHost = {
      browserStaticData: {
        importLoginState: async (_bundle, input) => {
          expect(input?.importSecret).toBe("delivery-code");
          return {
            importedCookies: 2,
            originCount: 1,
            restoredBytes: 0,
            restoredFiles: 0,
            success: true,
            summary: "Restored 2 ChatGPT cookies across 1 origins.",
          };
        },
      },
    };

    await expect(
      importT3BrowserStaticDataLoginStateBundles([portableLoginStateBundle()], {
        importSecret: "delivery-code",
      })
    ).resolves.toEqual(
      expect.objectContaining({
        importedCookies: 2,
        originCount: 1,
        success: true,
      })
    );
  });

  it("keeps portable restore failures out of the success path", async () => {
    (
      window as Window & {
        hugeCodeDesktopHost?: {
          browserStaticData?: {
            importLoginState: () => Promise<{
              importedCookies: number;
              originCount: number;
              restoredBytes: number;
              restoredFiles: number;
              success: boolean;
              summary: string;
            }>;
          };
        };
      }
    ).hugeCodeDesktopHost = {
      browserStaticData: {
        importLoginState: async () => ({
          importedCookies: 0,
          originCount: 0,
          restoredBytes: 0,
          restoredFiles: 0,
          success: false,
          summary: "Portable browser account data restore failed.",
        }),
      },
    };

    await expect(
      importT3BrowserStaticDataLoginStateBundles([portableLoginStateBundle()], {
        importSecret: "delivery-code",
      })
    ).rejects.toThrow("Portable browser account data restore failed.");
  });

  it("redacts import failure strings before rendering notices", () => {
    expect(
      formatT3BrowserStaticDataImportError(
        new Error(
          "Wrong import code abcdefgh and ciphertext ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef1234567890=="
        )
      )
    ).toBe("Wrong import code [redacted] and ciphertext [redacted]");
  });
});

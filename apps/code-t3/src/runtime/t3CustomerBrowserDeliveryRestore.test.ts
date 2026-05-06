import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildT3BrowserPortableLoginStateContract,
  T3_BROWSER_PORTABLE_ENCRYPTION,
  T3_BROWSER_PORTABLE_PAYLOAD_POLICY,
  T3_BROWSER_STATIC_DATA_SCHEMA_VERSION_V2,
} from "./t3BrowserAccountDataContract";
import { restoreT3CustomerBrowserDelivery } from "./t3CustomerBrowserDeliveryRestore";
import type { T3DeliveryProjection, T3DeliveryService } from "./t3DeliveryService";

function redeemedProjection(): T3DeliveryProjection {
  return {
    activationCode: "ku0-red-v1-valid-code",
    activationId: "activation_10002",
    artifactId: "artifact_10002",
    browserFileUnlockCode: "server-file-unlock-code",
    deliveryId: "delivery-1",
    effectiveUntil: "2026-05-20T10:00:00Z",
    entitlementEndsAt: "2026-06-04T10:00:00Z",
    entitlementId: "dlvent_delivery_10001",
    entitlementSummary: null,
    fileHash: null,
    status: "redeemed",
    summary: "OpenHuge redeemed the delivery.",
    updatedAt: "2026-05-06T00:00:00.000Z",
  };
}

describe("restoreT3CustomerBrowserDelivery", () => {
  beforeEach(() => {
    delete (window as Window & { hugeCodeDesktopHost?: unknown }).hugeCodeDesktopHost;
  });

  it("redeems first when the customer only enters a redemption code", async () => {
    const redeem = vi.fn(async () => ({
      artifact: null,
      projection: redeemedProjection(),
    }));
    const deliveryService = {
      prepare: vi.fn(),
      readStatus: vi.fn(),
      redeem,
      submitExportWitness: vi.fn(),
      uploadArtifact: vi.fn(),
    } as unknown as T3DeliveryService;

    const result = await restoreT3CustomerBrowserDelivery({
      activationCodeInput: "ku0-red-v1-valid-code",
      deliveryService,
      fileUnlockCodeInput: "",
    });

    expect(redeem).toHaveBeenCalledWith({ activationCode: "ku0-red-v1-valid-code" });
    expect(result.status).toBe("failed");
    expect(result.notice).not.toContain("文件解锁码至少需要 8 位");
    expect(result.projection.status).toBe("redeemed");
  });

  it("uses the customer redemption code as the portable account restore secret", async () => {
    const redemptionCode = "ku0-red-v1-valid-code";
    const serialized = JSON.stringify({
      exportedAt: Date.now(),
      payload: {
        loginStateBundles: [
          {
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
            stateFileCount: 1,
            summary: "Portable ChatGPT browser account state.",
          },
        ],
      },
      payloadPolicy: T3_BROWSER_PORTABLE_PAYLOAD_POLICY,
      schemaVersion: T3_BROWSER_STATIC_DATA_SCHEMA_VERSION_V2,
      summary: "Portable HugeCode ChatGPT account data file.",
    });
    const importLoginState = vi.fn(async (_bundle: unknown, input?: { importSecret?: string }) => {
      expect(input?.importSecret).toBe(redemptionCode);
      return {
        importedCookies: 2,
        originCount: 1,
        restoredBytes: 128,
        restoredFiles: 1,
        success: true,
        summary: "Restored ChatGPT account data.",
      };
    });
    (
      window as Window & {
        hugeCodeDesktopHost?: {
          browserStaticData?: {
            importLoginState: typeof importLoginState;
          };
        };
      }
    ).hugeCodeDesktopHost = {
      browserStaticData: {
        importLoginState,
      },
    };
    const deliveryService = {
      prepare: vi.fn(),
      readStatus: vi.fn(),
      redeem: vi.fn(async () => ({
        artifact: {
          byteLength: serialized.length,
          fileHash: "a".repeat(64),
          fileName: "hugecode-browser-data.hcbrowser",
          serialized,
        },
        projection: {
          ...redeemedProjection(),
          activationCode: redemptionCode,
          browserFileUnlockCode: null,
        },
      })),
      submitExportWitness: vi.fn(),
      uploadArtifact: vi.fn(),
    } as unknown as T3DeliveryService;

    const result = await restoreT3CustomerBrowserDelivery({
      activationCodeInput: redemptionCode,
      deliveryService,
      fileUnlockCodeInput: "",
    });

    expect(result.status).toBe("restored");
    expect(importLoginState).toHaveBeenCalledOnce();
  });
});

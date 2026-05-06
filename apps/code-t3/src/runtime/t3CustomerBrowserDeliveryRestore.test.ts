import { describe, expect, it, vi } from "vitest";
import { restoreT3CustomerBrowserDelivery } from "./t3CustomerBrowserDeliveryRestore";
import type { T3DeliveryProjection, T3DeliveryService } from "./t3DeliveryService";

function redeemedProjection(): T3DeliveryProjection {
  return {
    activationCode: "ku0-red-v1-valid-code",
    browserFileUnlockCode: "server-file-unlock-code",
    deliveryId: "delivery-1",
    entitlementSummary: null,
    fileHash: null,
    status: "redeemed",
    summary: "OpenHuge redeemed the delivery.",
    updatedAt: "2026-05-06T00:00:00.000Z",
  };
}

describe("restoreT3CustomerBrowserDelivery", () => {
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
});

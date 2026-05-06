import type { T3BrowserProfileDescriptor } from "./t3BrowserProfiles";
import {
  formatT3BrowserStaticDataImportError,
  importT3BrowserStaticDataBundle,
  importT3BrowserStaticDataLoginStateBundles,
} from "./t3BrowserStaticData";
import {
  T3_DELIVERY_SERVICE,
  type T3DeliveryProjection,
  type T3DeliveryService,
} from "./t3DeliveryService";

export type T3CustomerBrowserDeliveryRestoreResult =
  | {
      notice: string;
      profiles: readonly T3BrowserProfileDescriptor[];
      projection: T3DeliveryProjection;
      status: "restored";
    }
  | {
      notice: string;
      projection: T3DeliveryProjection;
      status: "failed";
    };

function failedCustomerDeliveryProjection(summary: string): T3DeliveryProjection {
  return {
    activationCode: null,
    browserFileUnlockCode: null,
    deliveryId: null,
    entitlementSummary: null,
    fileHash: null,
    status: "failed",
    summary,
    updatedAt: new Date().toISOString(),
  };
}

export async function restoreT3CustomerBrowserDelivery(input: {
  activationCodeInput: string;
  deliveryService?: T3DeliveryService;
  fileUnlockCodeInput: string;
}): Promise<T3CustomerBrowserDeliveryRestoreResult> {
  const activationCode = input.activationCodeInput.trim();
  if (activationCode.length < 8) {
    const notice = "兑换码至少需要 8 位。";
    return { notice, projection: failedCustomerDeliveryProjection(notice), status: "failed" };
  }
  let projection: T3DeliveryProjection | null = null;
  try {
    const redemption = await (input.deliveryService ?? T3_DELIVERY_SERVICE).redeem({
      activationCode,
    });
    projection = redemption.projection;
    if (redemption.projection.status !== "redeemed") {
      throw new Error(redemption.projection.summary);
    }
    if (!redemption.artifact) {
      throw new Error("Remote delivery did not return an encrypted account data artifact.");
    }
    const importSecret =
      input.fileUnlockCodeInput.trim() || redemption.projection.browserFileUnlockCode?.trim() || "";
    if (importSecret.length < 8) {
      throw new Error("文件解锁码至少需要 8 位，且后端未返回可用解锁码。");
    }
    const result = importT3BrowserStaticDataBundle(redemption.artifact.serialized);
    const loginStateResult = await importT3BrowserStaticDataLoginStateBundles(
      result.loginStateBundles,
      { importSecret }
    );
    if (!loginStateResult.success) {
      throw new Error(loginStateResult.summary ?? "Browser account data restore failed.");
    }
    const notice = loginStateResult.summary
      ? `${redemption.projection.summary} ${loginStateResult.summary}`
      : redemption.projection.summary;
    return {
      notice,
      profiles: result.profiles,
      projection: redemption.projection,
      status: "restored",
    };
  } catch (error) {
    const notice = formatT3BrowserStaticDataImportError(error);
    return {
      notice,
      projection: projection ?? failedCustomerDeliveryProjection(notice),
      status: "failed",
    };
  }
}

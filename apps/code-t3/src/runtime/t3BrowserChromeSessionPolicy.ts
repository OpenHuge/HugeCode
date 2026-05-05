export const T3_OPERATOR_DELIVERY_CAPTURE_MODE = "operator-delivery";
export const T3_OPERATOR_DELIVERY_PARTITION_PREFIX = "persist:hugecode-operator-delivery";

export type T3BrowserCaptureMode = typeof T3_OPERATOR_DELIVERY_CAPTURE_MODE;

export type T3BrowserSessionPlan = {
  captureMode: T3BrowserCaptureMode | null;
  cleanupOnClose: boolean;
  partition: string | null;
};

export type T3BrowserSessionCleanupTarget = {
  clearCache(): Promise<void> | void;
  clearStorageData(): Promise<void> | void;
  flushStorageData(): Promise<void> | void;
};

export function normalizeT3BrowserCaptureMode(value: unknown): T3BrowserCaptureMode | null {
  return value === T3_OPERATOR_DELIVERY_CAPTURE_MODE ? T3_OPERATOR_DELIVERY_CAPTURE_MODE : null;
}

export function createT3OperatorDeliveryPartitionName(id: string) {
  const normalizedId = id
    .trim()
    .replace(/[^a-z0-9-]/giu, "-")
    .replace(/-+/gu, "-");
  return `${T3_OPERATOR_DELIVERY_PARTITION_PREFIX}-${normalizedId || "session"}`;
}

export function resolveT3BrowserSessionPlanFromLaunchUrl(
  launchUrl: string,
  operatorPartitionId: string
): T3BrowserSessionPlan {
  try {
    const parsed = new URL(launchUrl);
    const captureMode = normalizeT3BrowserCaptureMode(parsed.searchParams.get("captureMode"));
    if (captureMode === T3_OPERATOR_DELIVERY_CAPTURE_MODE) {
      return {
        captureMode,
        cleanupOnClose: true,
        partition: createT3OperatorDeliveryPartitionName(operatorPartitionId),
      };
    }
  } catch {
    // Invalid launch URLs fall back to the customer/default browser session.
  }
  return {
    captureMode: null,
    cleanupOnClose: false,
    partition: null,
  };
}

export async function clearT3BrowserSessionStorage(target: T3BrowserSessionCleanupTarget) {
  await target.flushStorageData();
  await target.clearStorageData();
  await target.clearCache();
}

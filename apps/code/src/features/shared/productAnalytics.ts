import { recordSentryMetricIfAvailable } from "./sentry";

export const PRODUCT_ANALYTICS_EVENT_NAMES = [
  "define_started",
  "delegate_started",
  "placement_confirmed",
  "approval_wait_started",
  "review_pack_ready",
  "review_decision_submitted",
  "review_follow_up_prepared",
  "manual_rescue_invoked",
  "review_agent_requested",
  "review_autofix_requested",
  "model_selection_mode_changed",
  "provider_family_switched",
] as const;

export type ProductAnalyticsEventName = (typeof PRODUCT_ANALYTICS_EVENT_NAMES)[number];

export type ProductAnalyticsEventAttributes = {
  workspaceId?: string | null;
  threadId?: string | null;
  taskId?: string | null;
  runId?: string | null;
  reviewPackId?: string | null;
  executionProfileId?: string | null;
  backendId?: string | null;
  runState?: string | null;
  reviewStatus?: string | null;
  approvalStatus?: string | null;
  decision?: string | null;
  eventSource?: string | null;
  requestMode?: string | null;
  interventionKind?: string | null;
  autofixCandidateId?: string | null;
  isFallbackPlacement?: boolean | null;
};

type ProductAnalyticsMetricOptions = {
  attributes?: Record<string, string>;
};

type ProductAnalyticsAdapter = {
  count: (
    metricName: string,
    value: number,
    options?: ProductAnalyticsMetricOptions
  ) => void | Promise<void>;
};

let adapterOverrideForTests: ProductAnalyticsAdapter | null = null;

function toSnakeCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[\s-]+/g, "_")
    .toLowerCase();
}

function normalizeAttributes(
  attributes: ProductAnalyticsEventAttributes | undefined
): Record<string, string> {
  if (!attributes) {
    return {};
  }
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(attributes)) {
    if (value === null || value === undefined) {
      continue;
    }
    normalized[toSnakeCase(key)] = String(value);
  }
  return normalized;
}

async function resolveProductAnalyticsAdapter(): Promise<ProductAnalyticsAdapter | null> {
  if (adapterOverrideForTests) {
    return adapterOverrideForTests;
  }
  return {
    count: async (metricName, value, options) => {
      await recordSentryMetricIfAvailable(metricName, value, options);
    },
  };
}

export async function trackProductAnalyticsEvent(
  eventName: ProductAnalyticsEventName,
  attributes?: ProductAnalyticsEventAttributes
): Promise<void> {
  const adapter = await resolveProductAnalyticsAdapter();
  if (!adapter) {
    return;
  }
  try {
    await adapter.count(eventName, 1, {
      attributes: normalizeAttributes(attributes),
    });
  } catch (error) {
    // oxlint-disable-next-line no-console -- best-effort analytics failures should not block feature flows.
    console.warn(`[product-analytics] failed to record ${eventName} event`, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export function __setProductAnalyticsAdapterForTests(
  adapter: ProductAnalyticsAdapter | null
): void {
  adapterOverrideForTests = adapter;
}

export function __resetProductAnalyticsAdapterForTests(): void {
  adapterOverrideForTests = null;
}

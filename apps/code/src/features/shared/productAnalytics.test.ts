import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetProductAnalyticsAdapterForTests,
  __setProductAnalyticsAdapterForTests,
  trackProductAnalyticsEvent,
} from "./productAnalytics";

describe("productAnalytics", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    __resetProductAnalyticsAdapterForTests();
    vi.clearAllMocks();
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  it("records typed product-loop events through the active adapter", async () => {
    const count = vi.fn();
    __setProductAnalyticsAdapterForTests({ count });

    await trackProductAnalyticsEvent("placement_confirmed", {
      workspaceId: "ws-1",
      executionProfileId: "delegate-balanced",
      backendId: "backend-a",
      runState: "running",
      reviewStatus: "ready",
      eventSource: "mission_control",
      isFallbackPlacement: false,
    });

    expect(count).toHaveBeenCalledWith("placement_confirmed", 1, {
      attributes: {
        workspace_id: "ws-1",
        execution_profile_id: "delegate-balanced",
        backend_id: "backend-a",
        run_state: "running",
        review_status: "ready",
        event_source: "mission_control",
        is_fallback_placement: "false",
      },
    });
  });

  it("drops nullish attributes and logs adapter failures without throwing", async () => {
    __setProductAnalyticsAdapterForTests({
      count: vi.fn(async () => {
        throw new Error("metrics unavailable");
      }),
    });

    await expect(
      trackProductAnalyticsEvent("approval_wait_started", {
        workspaceId: "ws-1",
        backendId: null,
        reviewStatus: undefined,
      })
    ).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalledWith(
      "[product-analytics] failed to record approval_wait_started event",
      expect.objectContaining({
        error: "metrics unavailable",
      })
    );
  });
});

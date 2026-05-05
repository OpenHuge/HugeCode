import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  clearT3BrowserSessionStorage,
  createT3OperatorDeliveryPartitionName,
  resolveT3BrowserSessionPlanFromLaunchUrl,
  T3_OPERATOR_DELIVERY_PARTITION_PREFIX,
} from "./t3BrowserChromeSessionPolicy";

describe("t3BrowserChromeSessionPolicy", () => {
  it("routes operator-delivery browser launches to an isolated production partition", () => {
    const plan = resolveT3BrowserSessionPlanFromLaunchUrl(
      "file:///app/index.html?hcbrowser=1&target=https%3A%2F%2Fchatgpt.com%2F&captureMode=operator-delivery",
      "operator-window-1"
    );

    expect(plan).toEqual({
      captureMode: "operator-delivery",
      cleanupOnClose: true,
      partition: createT3OperatorDeliveryPartitionName("operator-window-1"),
    });
    expect(plan.partition).toContain(T3_OPERATOR_DELIVERY_PARTITION_PREFIX);
  });

  it("keeps ordinary customer browser launches on the default session", () => {
    expect(
      resolveT3BrowserSessionPlanFromLaunchUrl(
        "file:///app/index.html?hcbrowser=1&target=https%3A%2F%2Fchatgpt.com%2F",
        "unused"
      )
    ).toEqual({
      captureMode: null,
      cleanupOnClose: false,
      partition: null,
    });
  });

  it("cleans operator session storage before close and fails closed on cleanup errors", async () => {
    const calls: string[] = [];
    await clearT3BrowserSessionStorage({
      clearCache: vi.fn(async () => {
        calls.push("clearCache");
      }),
      clearStorageData: vi.fn(async () => {
        calls.push("clearStorageData");
      }),
      flushStorageData: vi.fn(async () => {
        calls.push("flushStorageData");
      }),
    });

    expect(calls).toEqual(["flushStorageData", "clearStorageData", "clearCache"]);

    await expect(
      clearT3BrowserSessionStorage({
        clearCache: vi.fn(async () => {
          calls.push("unexpected-clearCache");
        }),
        clearStorageData: vi.fn(async () => {
          throw new Error("cleanup rejected");
        }),
        flushStorageData: vi.fn(async () => undefined),
      })
    ).rejects.toThrow("cleanup rejected");
    expect(calls).not.toContain("unexpected-clearCache");
  });

  it("does not clear customer state through defaultSession.clearStorageData", () => {
    const source = readFileSync("electron/main.ts", "utf8");

    expect(source).not.toContain("defaultSession.clearStorageData");
  });
});

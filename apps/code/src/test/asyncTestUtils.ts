import { act } from "@testing-library/react";
import { vi } from "vitest";

export async function flushBrowserMicrotasks() {
  await act(async () => {
    await Promise.resolve();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  });
}

export async function flushLazyBoundary() {
  await act(async () => {
    await vi.dynamicImportSettled();
    await Promise.resolve();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  });
}

export async function waitForAppTimer(delayMs: number) {
  await act(async () => {
    await new Promise((resolve) => window.setTimeout(resolve, delayMs));
  });
}

import { act, cleanup, render } from "@testing-library/react";
import { userEvent } from "vitest/browser";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ComposerAutoDriveStatusBar,
  ComposerMetaBarAutoDriveMeta,
} from "./ComposerMetaBarAutoDriveMeta";

async function click(element: Element) {
  await act(async () => {
    await userEvent.click(element);
  });
}

function createAutoDrive() {
  return {
    source: "runtime_snapshot_v1",
    enabled: true,
    budget: {
      maxTokens: 8_000,
      maxIterations: 4,
      maxDurationMinutes: 30,
      maxValidationFailures: 2,
      maxReroutes: 2,
    },
    riskPolicy: {
      allowValidationCommands: true,
      minimumConfidence: "medium" as const,
    },
    preset: {
      active: "safe_default" as const,
    },
    controls: {
      canStart: false,
      canPause: true,
      canResume: false,
      canStop: true,
      busyAction: null,
      onStart: vi.fn(),
      onPause: vi.fn(),
      onResume: vi.fn(),
      onStop: vi.fn(),
    },
    recovering: false,
    readiness: {
      readyToLaunch: true,
      issues: [],
      setupProgress: 100,
    },
    run: {
      status: "running" as const,
      stage: "executing_task",
      overallProgress: 66,
      offRoute: false,
      rerouting: false,
      stopReason: null,
    },
    onToggleEnabled: vi.fn(),
  };
}

afterEach(() => {
  cleanup();
});

describe("ComposerMetaBarAutoDriveMeta browser styles", () => {
  it("keeps AutoDrive chrome flat while preserving the running rail interactions", async () => {
    const autoDrive = createAutoDrive();

    render(
      <>
        <ComposerMetaBarAutoDriveMeta autoDrive={autoDrive} disabled={false} />
        <ComposerAutoDriveStatusBar
          autoDrive={autoDrive}
          disabled={false}
          autoDriveBackendLabel="Local desktop runtime"
          visibilityState="visible"
        />
      </>
    );

    const triggerTrack = document.querySelector<HTMLElement>(
      '[data-testid="autodrive-trigger-state"]'
    );
    const triggerThumb = document.querySelector<HTMLElement>(
      '[data-testid="autodrive-trigger-thumb"]'
    );
    const triggerButton = document.querySelector<HTMLButtonElement>(
      'button[aria-label="Toggle AutoDrive"]'
    );
    const statusRail = document.querySelector<HTMLElement>('[aria-label="AutoDrive status rail"]');
    if (!triggerTrack || !triggerThumb || !triggerButton || !statusRail) {
      throw new Error("Expected AutoDrive controls");
    }

    const triggerTrackStyle = window.getComputedStyle(triggerTrack);
    const triggerThumbStyle = window.getComputedStyle(triggerThumb);
    const statusRailStyle = window.getComputedStyle(statusRail);

    expect(triggerTrackStyle.boxShadow).toContain("inset");
    expect(triggerTrackStyle.backgroundImage).toBe("none");
    expect(triggerThumbStyle.boxShadow).toBe("none");
    expect(triggerThumbStyle.backgroundImage).toBe("none");
    expect(statusRailStyle.boxShadow).toBe("none");
    expect(statusRailStyle.backgroundImage).toBe("none");

    await click(statusRail.querySelector("button") ?? statusRail);

    const statusCard = document.querySelector<HTMLElement>('[data-testid="autodrive-status-card"]');
    if (!statusCard) {
      throw new Error("Expected expanded AutoDrive status card");
    }

    const statusCardStyle = window.getComputedStyle(statusCard);
    expect(statusCardStyle.boxShadow).toBe("none");
    expect(statusCardStyle.backgroundImage).toBe("none");

    await click(triggerButton);
    expect(autoDrive.onToggleEnabled).toHaveBeenCalledWith(false);

    await click(screenButton("Pause AutoDrive"));
    await click(screenButton("Stop AutoDrive"));

    expect(autoDrive.controls.onPause).toHaveBeenCalledTimes(1);
    expect(autoDrive.controls.onStop).toHaveBeenCalledTimes(1);
  });
});

function screenButton(label: string) {
  const button = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
    (candidate) => candidate.getAttribute("aria-label") === label
  );
  if (!button) {
    throw new Error(`Expected button: ${label}`);
  }
  return button;
}

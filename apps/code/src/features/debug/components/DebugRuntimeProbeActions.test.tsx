// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DebugRuntimeProbeActions } from "./DebugRuntimeProbeActions";

describe("DebugRuntimeProbeActions", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("wires all probe action buttons", () => {
    const onRunHealthProbe = vi.fn();
    const onRunRemoteStatusProbe = vi.fn();
    const onRunTerminalStatusProbe = vi.fn();
    const onRunSettingsProbe = vi.fn();
    const onRunBootstrapProbe = vi.fn();
    const onRunToolLifecycleProbe = vi.fn();

    render(
      <DebugRuntimeProbeActions
        isRuntimeProbeBusy={false}
        onRunHealthProbe={onRunHealthProbe}
        onRunRemoteStatusProbe={onRunRemoteStatusProbe}
        onRunTerminalStatusProbe={onRunTerminalStatusProbe}
        onRunSettingsProbe={onRunSettingsProbe}
        onRunBootstrapProbe={onRunBootstrapProbe}
        onRunToolLifecycleProbe={onRunToolLifecycleProbe}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Health" }));
    fireEvent.click(screen.getByRole("button", { name: "Remote" }));
    fireEvent.click(screen.getByRole("button", { name: "Terminal" }));
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    fireEvent.click(screen.getByRole("button", { name: "Bootstrap" }));
    fireEvent.click(screen.getByRole("button", { name: "Lifecycle" }));

    expect(onRunHealthProbe).toHaveBeenCalledTimes(1);
    expect(onRunRemoteStatusProbe).toHaveBeenCalledTimes(1);
    expect(onRunTerminalStatusProbe).toHaveBeenCalledTimes(1);
    expect(onRunSettingsProbe).toHaveBeenCalledTimes(1);
    expect(onRunBootstrapProbe).toHaveBeenCalledTimes(1);
    expect(onRunToolLifecycleProbe).toHaveBeenCalledTimes(1);
  });

  it("disables all action buttons while a probe is running", () => {
    render(
      <DebugRuntimeProbeActions
        isRuntimeProbeBusy
        onRunHealthProbe={vi.fn()}
        onRunRemoteStatusProbe={vi.fn()}
        onRunTerminalStatusProbe={vi.fn()}
        onRunSettingsProbe={vi.fn()}
        onRunBootstrapProbe={vi.fn()}
        onRunToolLifecycleProbe={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "Health" }).getAttribute("disabled")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Remote" }).getAttribute("disabled")).not.toBeNull();
    expect(
      screen.getByRole("button", { name: "Terminal" }).getAttribute("disabled")
    ).not.toBeNull();
    expect(
      screen.getByRole("button", { name: "Settings" }).getAttribute("disabled")
    ).not.toBeNull();
    expect(
      screen.getByRole("button", { name: "Bootstrap" }).getAttribute("disabled")
    ).not.toBeNull();
    expect(
      screen.getByRole("button", { name: "Lifecycle" }).getAttribute("disabled")
    ).not.toBeNull();
  });
});

// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MobileServerSetupWizard } from "./MobileServerSetupWizard";

describe("MobileServerSetupWizard", () => {
  it("renders validate-first actions and a limited-mode fallback", () => {
    const onConnectTest = vi.fn();
    const onSaveConnection = vi.fn();
    const onContinueLimitedMode = vi.fn();

    render(
      <MobileServerSetupWizard
        provider="tcp"
        remoteHostDraft="desktop.tailnet.ts.net:4732"
        orbitWsUrlDraft=""
        remoteTokenDraft="secret-token"
        busy={false}
        checking={false}
        statusMessage="Draft connection validated. Save to continue."
        statusError={false}
        canSaveValidatedConnection
        onProviderChange={vi.fn()}
        onRemoteHostChange={vi.fn()}
        onOrbitWsUrlChange={vi.fn()}
        onRemoteTokenChange={vi.fn()}
        onConnectTest={onConnectTest}
        onSaveConnection={onSaveConnection}
        onContinueLimitedMode={onContinueLimitedMode}
      />
    );

    expect(screen.getByRole("button", { name: "Validate connection" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save connection" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Continue in limited mode" })).toBeTruthy();
    expect(screen.getByText(/unlock runtime-backed work/i)).toBeTruthy();
    expect(
      screen.getByText(/continue in limited mode for review, settings, and handoff/i)
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Validate connection" }));
    fireEvent.click(screen.getByRole("button", { name: "Save connection" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue in limited mode" }));

    expect(onConnectTest).toHaveBeenCalledTimes(1);
    expect(onSaveConnection).toHaveBeenCalledTimes(1);
    expect(onContinueLimitedMode).toHaveBeenCalledTimes(1);
  });
});

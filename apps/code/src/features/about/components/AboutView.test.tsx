// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  openUrl,
  resolveAppInfo,
  resolveDesktopDiagnosticsInfo,
  resolveAppVersion,
  revealItemInDir,
} from "../../../application/runtime/facades/desktopHostFacade";
import { AboutView } from "./AboutView";

vi.mock("../../../application/runtime/facades/desktopHostFacade", () => ({
  openUrl: vi.fn(async () => true),
  resolveAppInfo: vi.fn(async () => null),
  resolveDesktopDiagnosticsInfo: vi.fn(async () => null),
  resolveAppVersion: vi.fn(async () => null),
  revealItemInDir: vi.fn(async () => true),
}));

vi.mock("../../../application/runtime/ports/toasts", () => ({
  pushErrorToast: vi.fn(),
}));

const openUrlMock = vi.mocked(openUrl);
const resolveAppInfoMock = vi.mocked(resolveAppInfo);
const resolveDesktopDiagnosticsInfoMock = vi.mocked(resolveDesktopDiagnosticsInfo);
const resolveAppVersionMock = vi.mocked(resolveAppVersion);
const revealItemInDirMock = vi.mocked(revealItemInDir);

describe("AboutView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders desktop app metadata when available", async () => {
    resolveAppInfoMock.mockResolvedValue({
      version: "41.0.3",
      channel: "beta",
      platform: "darwin",
      updateCapability: "manual",
      updateMessage:
        "Beta builds update manually from GitHub Releases unless HUGECODE_ELECTRON_UPDATE_BASE_URL is configured.",
      updateMode: "disabled_beta_manual",
    });
    resolveDesktopDiagnosticsInfoMock.mockResolvedValue({
      incidentLogPath: "/tmp/hugecode/logs/desktop-incidents.ndjson",
      lastIncidentAt: "2026-03-25T10:00:00.000Z",
      logsDirectoryPath: "/tmp/hugecode/logs",
      recentIncidentCount: 2,
      reportIssueUrl: "https://github.com/OpenHuge/HugeCode/issues/new",
    });

    render(<AboutView />);

    await waitFor(() => {
      expect(screen.getByText("Version 41.0.3")).toBeTruthy();
    });
    expect(screen.getByLabelText("Desktop release metadata").textContent).toContain("Beta channel");
    expect(screen.getByLabelText("Desktop release metadata").textContent).toContain("macOS");
    expect(
      screen.getByText(
        "Beta builds update manually from GitHub Releases unless HUGECODE_ELECTRON_UPDATE_BASE_URL is configured."
      )
    ).toBeTruthy();
    expect(screen.getByLabelText("Desktop diagnostics metadata").textContent).toContain(
      "2 recent desktop incidents logged"
    );
    fireEvent.click(screen.getByRole("button", { name: "Open Incident Log" }));
    expect(revealItemInDirMock).toHaveBeenCalledWith("/tmp/hugecode/logs/desktop-incidents.ndjson");
    fireEvent.click(screen.getByRole("button", { name: "Report Issue" }));
    expect(openUrlMock).toHaveBeenCalledWith("https://github.com/OpenHuge/HugeCode/issues/new");
  });

  it("falls back to the app version surface and opens external links", async () => {
    resolveAppInfoMock.mockResolvedValue(null);
    resolveDesktopDiagnosticsInfoMock.mockResolvedValue(null);
    resolveAppVersionMock.mockResolvedValue("9.9.9");

    render(<AboutView />);

    await waitFor(() => {
      expect(screen.getByText("Version 9.9.9")).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "GitHub" }));
    expect(openUrlMock).toHaveBeenCalled();
  });
});

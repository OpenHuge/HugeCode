import { describe, expect, it, vi } from "vitest";
import {
  buildDesktopIssueReporterUrl,
  resolveDesktopDiagnosticsPaths,
  startDesktopLocalCrashReporter,
} from "./desktopDiagnostics.js";

describe("desktopDiagnostics", () => {
  it("prefers Electron's canonical logs and crash dump directories when available", () => {
    const setAppLogsPath = vi.fn();

    expect(
      resolveDesktopDiagnosticsPaths({
        app: {
          getPath: vi.fn((name: "crashDumps" | "logs" | "userData") => {
            switch (name) {
              case "logs":
                return "/Users/test/Library/Logs/HugeCode";
              case "crashDumps":
                return "/Users/test/Library/Application Support/HugeCode/Crashpad";
              case "userData":
              default:
                return "/Users/test/Library/Application Support/HugeCode";
            }
          }),
          setAppLogsPath,
        },
      })
    ).toEqual({
      crashDumpsDirectoryPath: "/Users/test/Library/Application Support/HugeCode/Crashpad",
      incidentLogPath: "/Users/test/Library/Logs/HugeCode/desktop-incidents.ndjson",
      logsDirectoryPath: "/Users/test/Library/Logs/HugeCode",
    });

    expect(setAppLogsPath).toHaveBeenCalledTimes(1);
  });

  it("starts a local crash reporter without enabling remote uploads", () => {
    const start = vi.fn();

    expect(
      startDesktopLocalCrashReporter({
        channel: "beta",
        crashReporter: { start },
        version: "41.0.3-beta.2",
      })
    ).toBe(true);

    expect(start).toHaveBeenCalledWith(
      expect.objectContaining({
        companyName: "OpenHuge",
        productName: "HugeCode",
        uploadToServer: false,
      })
    );
  });

  it("builds a prefilled GitHub issue URL with desktop environment details", () => {
    const issueReporterUrl = buildDesktopIssueReporterUrl({
      arch: "arm64",
      channel: "beta",
      crashDumpsDirectoryPath: "/Users/test/Library/Application Support/HugeCode/Crashpad",
      diagnosticsSummary: {
        incidentLogPath:
          "/Users/test/Library/Application Support/HugeCode/logs/desktop-incidents.ndjson",
        lastIncidentAt: "2026-03-25T10:00:00.000Z",
        logsDirectoryPath: "/Users/test/Library/Application Support/HugeCode/logs",
        recentIncidentCount: 3,
      },
      platform: "darwin",
      repoUrl: "https://github.com/OpenHuge/HugeCode",
      updateMode: "disabled_beta_manual",
      version: "41.0.3-beta.2",
    });

    expect(issueReporterUrl).toContain("https://github.com/OpenHuge/HugeCode/issues/new");
    expect(issueReporterUrl).toContain("Version%3A+41.0.3-beta.2");
    expect(issueReporterUrl).toContain("Recent+desktop+incidents%3A+3");
    expect(issueReporterUrl).toContain("Update+mode%3A+disabled_beta_manual");
    expect(issueReporterUrl).toContain("Crash+dumps+directory%3A+%2FUsers%2Ftest");
  });

  it("returns null when the repository URL is invalid", () => {
    expect(
      buildDesktopIssueReporterUrl({
        arch: "x64",
        channel: "stable",
        crashDumpsDirectoryPath: null,
        diagnosticsSummary: {
          incidentLogPath: "/tmp/desktop-incidents.ndjson",
          lastIncidentAt: null,
          logsDirectoryPath: "/tmp",
          recentIncidentCount: 0,
        },
        platform: "linux",
        repoUrl: "not a url",
        updateMode: "enabled_stable_public_service",
        version: "1.0.0",
      })
    ).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { buildDesktopIssueReporterUrl } from "./desktopDiagnostics.js";

describe("desktopDiagnostics", () => {
  it("builds a prefilled GitHub issue URL with desktop environment details", () => {
    const issueReporterUrl = buildDesktopIssueReporterUrl({
      arch: "arm64",
      channel: "beta",
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
  });

  it("returns null when the repository URL is invalid", () => {
    expect(
      buildDesktopIssueReporterUrl({
        arch: "x64",
        channel: "stable",
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

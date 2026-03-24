import type { DesktopReleaseChannel, DesktopUpdateMode } from "@ku0/code-platform-interfaces";
import type { DesktopIncidentSummary } from "./desktopIncidentStore.js";

export type BuildDesktopIssueReporterUrlInput = {
  arch: NodeJS.Architecture;
  channel: DesktopReleaseChannel;
  diagnosticsSummary: DesktopIncidentSummary;
  platform: NodeJS.Platform;
  repoUrl: string;
  updateMode: DesktopUpdateMode;
  version: string | null;
};

function normalizeRepositoryIssuesUrl(repoUrl: string) {
  const trimmedRepoUrl = repoUrl.trim().replace(/\/+$/, "");
  if (trimmedRepoUrl.length === 0) {
    return null;
  }

  try {
    const repositoryUrl = new URL(trimmedRepoUrl);
    repositoryUrl.pathname = `${repositoryUrl.pathname.replace(/\/+$/, "")}/issues/new`;
    repositoryUrl.search = "";
    repositoryUrl.hash = "";
    return repositoryUrl;
  } catch {
    return null;
  }
}

export function buildDesktopIssueReporterUrl(input: BuildDesktopIssueReporterUrlInput) {
  const issueUrl = normalizeRepositoryIssuesUrl(input.repoUrl);
  if (!issueUrl) {
    return null;
  }

  const issueBodyLines = [
    "### HugeCode Desktop Environment",
    "",
    `- Version: ${input.version ?? "unknown"}`,
    `- Channel: ${input.channel}`,
    `- Platform: ${input.platform}`,
    `- Architecture: ${input.arch}`,
    `- Update mode: ${input.updateMode}`,
    `- Recent desktop incidents: ${String(input.diagnosticsSummary.recentIncidentCount)}`,
    `- Last desktop incident: ${input.diagnosticsSummary.lastIncidentAt ?? "none"}`,
    "",
    "### What happened?",
    "",
    "<!-- Describe the bug, reproduction steps, and expected behavior. -->",
    "",
    "### Diagnostics",
    "",
    `- Incident log path: ${input.diagnosticsSummary.incidentLogPath}`,
    `- Logs directory: ${input.diagnosticsSummary.logsDirectoryPath}`,
    "",
    "<!-- Attach the incident log if it helps reproduce the problem. -->",
  ];

  issueUrl.searchParams.set("title", "[Desktop] ");
  issueUrl.searchParams.set("body", issueBodyLines.join("\n"));
  return issueUrl.toString();
}

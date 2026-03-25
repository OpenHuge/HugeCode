import { join } from "node:path";
import type { DesktopReleaseChannel, DesktopUpdateMode } from "@ku0/code-platform-interfaces";
import type { DesktopIncidentSummary } from "./desktopIncidentStore.js";

type DesktopLogsPathApp = {
  getPath(name: "crashDumps" | "logs" | "userData"): string;
  setAppLogsPath?: (path?: string) => void;
};

type DesktopCrashReporterLike = {
  start(options: {
    companyName?: string;
    compress?: boolean;
    ignoreSystemCrashHandler?: boolean;
    productName?: string;
    submitURL?: string;
    uploadToServer: boolean;
  }): void;
};

type DesktopDiagnosticsLogger = Pick<Console, "warn">;

export type DesktopDiagnosticsPaths = {
  crashDumpsDirectoryPath: string | null;
  incidentLogPath: string;
  logsDirectoryPath: string;
};

export type BuildDesktopIssueReporterUrlInput = {
  arch: NodeJS.Architecture;
  channel: DesktopReleaseChannel;
  crashDumpsDirectoryPath: string | null;
  diagnosticsSummary: DesktopIncidentSummary;
  platform: NodeJS.Platform;
  repoUrl: string;
  updateMode: DesktopUpdateMode;
  version: string | null;
};

export type ResolveDesktopDiagnosticsPathsInput = {
  app: DesktopLogsPathApp;
  logger?: DesktopDiagnosticsLogger;
};

export type StartDesktopLocalCrashReporterInput = {
  channel: DesktopReleaseChannel;
  crashReporter?: DesktopCrashReporterLike | null;
  logger?: DesktopDiagnosticsLogger;
  version: string | null;
};

function normalizeDesktopPath(path: string | null | undefined) {
  if (typeof path !== "string") {
    return null;
  }

  const trimmedPath = path.trim();
  return trimmedPath.length > 0 ? trimmedPath : null;
}

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

export function resolveDesktopDiagnosticsPaths(input: ResolveDesktopDiagnosticsPathsInput) {
  const logger = input.logger ?? console;
  const userDataPath = input.app.getPath("userData");
  let logsDirectoryPath = join(userDataPath, "logs");

  try {
    input.app.setAppLogsPath?.();
    logsDirectoryPath = normalizeDesktopPath(input.app.getPath("logs")) ?? logsDirectoryPath;
  } catch (error) {
    logger.warn("HugeCode desktop could not resolve Electron logs path; using userData fallback.", {
      error: error instanceof Error ? error.message : String(error),
      fallbackLogsDirectoryPath: logsDirectoryPath,
    });
  }

  let crashDumpsDirectoryPath: string | null = null;
  try {
    crashDumpsDirectoryPath = normalizeDesktopPath(input.app.getPath("crashDumps"));
  } catch {
    crashDumpsDirectoryPath = null;
  }

  return {
    crashDumpsDirectoryPath,
    incidentLogPath: join(logsDirectoryPath, "desktop-incidents.ndjson"),
    logsDirectoryPath,
  } satisfies DesktopDiagnosticsPaths;
}

export function startDesktopLocalCrashReporter(input: StartDesktopLocalCrashReporterInput) {
  const logger = input.logger ?? console;
  if (!input.crashReporter) {
    return false;
  }

  try {
    input.crashReporter.start({
      companyName: "OpenHuge",
      compress: true,
      ignoreSystemCrashHandler: false,
      productName: "HugeCode",
      submitURL: "",
      uploadToServer: false,
    });
    return true;
  } catch (error) {
    logger.warn("HugeCode desktop could not start the local crash reporter.", {
      channel: input.channel,
      error: error instanceof Error ? error.message : String(error),
      version: input.version,
    });
    return false;
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
    `- Crash dumps directory: ${input.crashDumpsDirectoryPath ?? "unknown"}`,
    "",
    "<!-- Attach the incident log if it helps reproduce the problem. -->",
  ];

  issueUrl.searchParams.set("title", "[Desktop] ");
  issueUrl.searchParams.set("body", issueBodyLines.join("\n"));
  return issueUrl.toString();
}

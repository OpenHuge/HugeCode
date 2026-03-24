import { useEffect, useState } from "react";
import {
  ABOUT_FOOTER,
  ABOUT_ICON_ALT,
  ABOUT_LINKS,
  ABOUT_PRODUCT_NAME,
  ABOUT_TAGLINE,
  ABOUT_VERSION_PREFIX,
} from "@ku0/shared/aboutContent";
import type { DesktopAppInfo, DesktopDiagnosticsInfo } from "@ku0/code-platform-interfaces";
import {
  openUrl,
  resolveAppInfo,
  resolveDesktopDiagnosticsInfo,
  resolveAppVersion,
  revealItemInDir,
} from "../../../application/runtime/facades/desktopHostFacade";
import { pushErrorToast } from "../../../application/runtime/ports/toasts";
import "./AboutView.global.css";

async function openExternalUrl(url: string) {
  const opened = await openUrl(url);
  if (opened) {
    return;
  }

  pushErrorToast({
    title: "Couldn’t open link",
    message: "Unable to open link.",
  });
}

function formatReleaseChannel(channel: DesktopAppInfo["channel"]) {
  switch (channel) {
    case "beta":
      return "Beta";
    case "dev":
      return "Dev";
    case "stable":
    default:
      return "Stable";
  }
}

function formatPlatform(platform: DesktopAppInfo["platform"]) {
  switch (platform) {
    case "darwin":
      return "macOS";
    case "win32":
      return "Windows";
    case "linux":
      return "Linux";
    default:
      return platform;
  }
}

function describeUpdateCapability(appInfo: DesktopAppInfo | null) {
  if (appInfo?.updateMessage) {
    return appInfo.updateMessage;
  }

  switch (appInfo?.updateMode) {
    case "enabled_stable_public_service":
      return "Automatic stable updates are enabled through the public Electron update service.";
    case "enabled_beta_static_feed":
      return "Automatic beta updates are enabled from the configured static feed.";
    case "disabled_beta_manual":
      return "Beta builds update manually from GitHub Releases unless a static beta feed is configured.";
    case "disabled_unpacked":
      return "Automatic desktop updates are disabled in unpackaged development builds.";
    case "disabled_first_run_lock":
      return "Automatic desktop updates resume after the Windows installer finishes first-run setup.";
    case "misconfigured":
      return "Desktop update configuration is invalid for this build.";
    case "unsupported_platform":
      return "Automatic desktop updates are unavailable on this platform.";
    default:
      break;
  }

  switch (appInfo?.updateCapability) {
    case "automatic":
      return "Automatic desktop updates are enabled for this build.";
    case "manual":
      return "Updates are delivered manually through GitHub Releases for this build.";
    case "unsupported":
      return "Desktop auto-update is unavailable in this environment.";
    default:
      return null;
  }
}

export function AboutView() {
  const [version, setVersion] = useState<string | null>(null);
  const [appInfo, setAppInfo] = useState<DesktopAppInfo | null>(null);
  const [diagnosticsInfo, setDiagnosticsInfo] = useState<DesktopDiagnosticsInfo | null>(null);

  const handleOpenGitHub = () => {
    void openExternalUrl(ABOUT_LINKS[0].href);
  };

  const handleOpenTwitter = () => {
    void openExternalUrl(ABOUT_LINKS[1].href);
  };

  const handleOpenIncidentLog = () => {
    if (!diagnosticsInfo) {
      return;
    }

    const nextPath =
      diagnosticsInfo.recentIncidentCount > 0
        ? diagnosticsInfo.incidentLogPath
        : diagnosticsInfo.logsDirectoryPath;
    if (!nextPath) {
      return;
    }

    void revealItemInDir(nextPath);
  };

  const handleOpenLogsFolder = () => {
    if (!diagnosticsInfo?.logsDirectoryPath) {
      return;
    }

    void revealItemInDir(diagnosticsInfo.logsDirectoryPath);
  };

  const handleReportIssue = () => {
    if (!diagnosticsInfo?.reportIssueUrl) {
      return;
    }

    void openExternalUrl(diagnosticsInfo.reportIssueUrl);
  };

  useEffect(() => {
    let active = true;
    void (async () => {
      const info = await resolveAppInfo().catch(() => null);
      const diagnostics = await resolveDesktopDiagnosticsInfo().catch(() => null);
      const fallbackVersion = info?.version ?? (await resolveAppVersion().catch(() => null));
      if (!active) {
        return;
      }

      setAppInfo(info);
      setDiagnosticsInfo(diagnostics);
      setVersion(fallbackVersion);
    })();

    return () => {
      active = false;
    };
  }, []);

  const updateCapabilityMessage = describeUpdateCapability(appInfo);

  return (
    <div className="about">
      <div className="about-card">
        <div className="about-header">
          <img className="about-icon" src="/app-icon.png" alt={ABOUT_ICON_ALT} />
          <div className="about-title">{ABOUT_PRODUCT_NAME}</div>
        </div>
        <div className="about-version">
          {version ? `${ABOUT_VERSION_PREFIX} ${version}` : `${ABOUT_VERSION_PREFIX} —`}
        </div>
        {appInfo ? (
          <div className="about-meta" aria-label="Desktop release metadata">
            <span>{formatReleaseChannel(appInfo.channel)} channel</span>
            <span aria-hidden="true">•</span>
            <span>{formatPlatform(appInfo.platform)}</span>
          </div>
        ) : null}
        <div className="about-tagline">{ABOUT_TAGLINE}</div>
        {updateCapabilityMessage ? (
          <div className="about-update-capability">{updateCapabilityMessage}</div>
        ) : null}
        {diagnosticsInfo ? (
          <div className="about-update-capability" aria-label="Desktop diagnostics metadata">
            {diagnosticsInfo.recentIncidentCount > 0
              ? `${diagnosticsInfo.recentIncidentCount} recent desktop incident${diagnosticsInfo.recentIncidentCount === 1 ? "" : "s"} logged${diagnosticsInfo.lastIncidentAt ? `, last seen ${diagnosticsInfo.lastIncidentAt}` : ""}.`
              : "No recent desktop incidents are currently logged."}
          </div>
        ) : null}
        <div className="about-divider" />
        <div className="about-links">
          <button type="button" className="about-link" onClick={handleOpenGitHub}>
            {ABOUT_LINKS[0].label}
          </button>
          <span className="about-link-sep">|</span>
          <button type="button" className="about-link" onClick={handleOpenTwitter}>
            {ABOUT_LINKS[1].label}
          </button>
        </div>
        {diagnosticsInfo ? (
          <div className="about-links" aria-label="Desktop support actions">
            <button type="button" className="about-link" onClick={handleOpenIncidentLog}>
              Open Incident Log
            </button>
            <span className="about-link-sep">|</span>
            <button type="button" className="about-link" onClick={handleOpenLogsFolder}>
              Open Logs Folder
            </button>
            {diagnosticsInfo.reportIssueUrl ? (
              <>
                <span className="about-link-sep">|</span>
                <button type="button" className="about-link" onClick={handleReportIssue}>
                  Report Issue
                </button>
              </>
            ) : null}
          </div>
        ) : null}
        <div className="about-footer">{ABOUT_FOOTER}</div>
      </div>
    </div>
  );
}

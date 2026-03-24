import { useEffect, useState } from "react";
import {
  ABOUT_FOOTER,
  ABOUT_ICON_ALT,
  ABOUT_LINKS,
  ABOUT_PRODUCT_NAME,
  ABOUT_TAGLINE,
  ABOUT_VERSION_PREFIX,
} from "@ku0/shared/aboutContent";
import type { DesktopAppInfo } from "@ku0/code-platform-interfaces";
import {
  openUrl,
  resolveAppInfo,
  resolveAppVersion,
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

  const handleOpenGitHub = () => {
    void openExternalUrl(ABOUT_LINKS[0].href);
  };

  const handleOpenTwitter = () => {
    void openExternalUrl(ABOUT_LINKS[1].href);
  };

  useEffect(() => {
    let active = true;
    void (async () => {
      const info = await resolveAppInfo().catch(() => null);
      const fallbackVersion = info?.version ?? (await resolveAppVersion().catch(() => null));
      if (!active) {
        return;
      }

      setAppInfo(info);
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
        <div className="about-footer">{ABOUT_FOOTER}</div>
      </div>
    </div>
  );
}

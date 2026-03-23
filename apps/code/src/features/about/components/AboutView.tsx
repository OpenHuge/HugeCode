import { useEffect, useState } from "react";
import {
  ABOUT_FOOTER,
  ABOUT_ICON_ALT,
  ABOUT_LINKS,
  ABOUT_PRODUCT_NAME,
  ABOUT_TAGLINE,
  ABOUT_VERSION_PREFIX,
} from "@ku0/shared/aboutContent";
import { openUrl, resolveAppVersion } from "../../../application/runtime/facades/desktopHostFacade";
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

export function AboutView() {
  const [version, setVersion] = useState<string | null>(null);

  const handleOpenGitHub = () => {
    void openExternalUrl(ABOUT_LINKS[0].href);
  };

  const handleOpenTwitter = () => {
    void openExternalUrl(ABOUT_LINKS[1].href);
  };

  useEffect(() => {
    let active = true;
    void resolveAppVersion().then((value) => {
      if (active) {
        setVersion(value);
      }
    });

    return () => {
      active = false;
    };
  }, []);

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
        <div className="about-tagline">{ABOUT_TAGLINE}</div>
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

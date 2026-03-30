import {
  buildDesktopBrowserAssessmentTargetUrl,
  readDesktopBrowserAssessmentProxyRequest,
} from "@ku0/code-platform-interfaces";

function readProxySearch(): string {
  if (typeof window === "undefined") {
    return "";
  }
  return window.location.search;
}

export function BrowserAssessmentProxyFixture() {
  const proxyRequest = readDesktopBrowserAssessmentProxyRequest(readProxySearch());
  if (!proxyRequest.ok) {
    return (
      <main
        className="app-boot-shell"
        data-browser-assessment-proxy-code={proxyRequest.code}
        data-browser-assessment-proxy-state="blocked"
      >
        <div className="app-boot-card">
          <span className="app-boot-eyebrow">Browser Assessment Proxy</span>
          <strong className="app-boot-title">Assessment target unavailable</strong>
          <span className="app-boot-detail">{proxyRequest.message}</span>
        </div>
      </main>
    );
  }

  try {
    const iframeSrc = buildDesktopBrowserAssessmentTargetUrl(proxyRequest.request.target);
    const targetLabel =
      proxyRequest.request.target.kind === "fixture"
        ? proxyRequest.request.target.fixtureName
        : proxyRequest.request.target.routePath;

    return (
      <main
        className="app-boot-shell"
        data-browser-assessment-proxy-state="ready"
        data-browser-assessment-target={targetLabel}
      >
        <div className="app-boot-card">
          <span className="app-boot-eyebrow">Browser Assessment Proxy</span>
          <strong className="app-boot-title">Localized browser assessment target</strong>
          <span className="app-boot-detail">
            The hidden assessment renderer mounts the requested target through this proxy so loop
            prevention and DOM capture stay canonical.
          </span>
        </div>
        <iframe
          data-browser-assessment-frame=""
          sandbox="allow-same-origin allow-scripts"
          src={iframeSrc}
          title="Browser assessment target"
        />
      </main>
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to resolve assessment target.";
    return (
      <main
        className="app-boot-shell"
        data-browser-assessment-proxy-code="BROWSER_ASSESSMENT_PROXY_TARGET_INVALID"
        data-browser-assessment-proxy-state="blocked"
      >
        <div className="app-boot-card">
          <span className="app-boot-eyebrow">Browser Assessment Proxy</span>
          <strong className="app-boot-title">Assessment target blocked</strong>
          <span className="app-boot-detail">{message}</span>
        </div>
      </main>
    );
  }
}

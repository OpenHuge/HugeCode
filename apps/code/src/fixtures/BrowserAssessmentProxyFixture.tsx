import { useEffect, useState } from "react";
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
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [ready, setReady] = useState(false);

  const resolvedTarget =
    proxyRequest.ok === true
      ? (() => {
          try {
            return {
              ok: true as const,
              iframeSrc: buildDesktopBrowserAssessmentTargetUrl(proxyRequest.request.target),
              targetLabel:
                proxyRequest.request.target.kind === "fixture"
                  ? proxyRequest.request.target.fixtureName
                  : proxyRequest.request.target.routePath,
              waitForMs: proxyRequest.request.waitForMs ?? 0,
            };
          } catch (error) {
            return {
              ok: false as const,
              message:
                error instanceof Error ? error.message : "Unable to resolve assessment target.",
            };
          }
        })()
      : null;
  const resolvedIframeSrc = resolvedTarget?.ok ? resolvedTarget.iframeSrc : null;
  const resolvedWaitForMs = resolvedTarget?.ok ? resolvedTarget.waitForMs : 0;

  useEffect(() => {
    if (!resolvedTarget || !resolvedTarget.ok) {
      setIframeLoaded(false);
      setReady(false);
      return;
    }
    setIframeLoaded(false);
    setReady(false);
  }, [resolvedIframeSrc]);

  useEffect(() => {
    if (!resolvedTarget || !resolvedTarget.ok || !iframeLoaded) {
      setReady(false);
      return;
    }
    if (resolvedWaitForMs <= 0) {
      setReady(true);
      return;
    }
    const timeoutId = window.setTimeout(() => {
      setReady(true);
    }, resolvedWaitForMs);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [iframeLoaded, resolvedTarget?.ok, resolvedWaitForMs]);

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

  if (!resolvedTarget?.ok) {
    const message = resolvedTarget?.message ?? "Unable to resolve assessment target.";
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

  return (
    <main
      className="app-boot-shell"
      data-browser-assessment-proxy-state={ready ? "ready" : "loading"}
      data-browser-assessment-target={resolvedTarget.targetLabel}
    >
      <div className="app-boot-card">
        <span className="app-boot-eyebrow">Browser Assessment Proxy</span>
        <strong className="app-boot-title">Localized browser assessment target</strong>
        <span className="app-boot-detail">
          {ready
            ? "The hidden assessment renderer mounts the requested target through this proxy so loop prevention and DOM capture stay canonical."
            : "Waiting for the localized target to finish loading before the browser assessment begins."}
        </span>
      </div>
      <iframe
        data-browser-assessment-frame=""
        key={resolvedTarget.iframeSrc}
        onLoad={() => {
          setIframeLoaded(true);
        }}
        sandbox="allow-same-origin allow-scripts"
        src={resolvedTarget.iframeSrc}
        title="Browser assessment target"
      />
    </main>
  );
}

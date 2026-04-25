import {
  ArrowLeft,
  ArrowRight,
  Copy,
  ExternalLink,
  Fingerprint,
  Globe2,
  Lock,
  RefreshCw,
  Search,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { useMemo, useState } from "react";
import { buildT3BrowserFingerprintSummary } from "../runtime/t3BrowserProfiles";

type BrowserLaunchPageProps = {
  initialAppId: string | null;
  initialAppKey: string | null;
  initialAppLabel: string | null;
  initialIsolationMode: string | null;
  initialProfileId: string;
  initialProfileLabel: string;
  initialProvider: string;
  initialTargetUrl: string;
};

const QUICK_STARTS = [
  { label: "ChatGPT", url: "https://chatgpt.com/" },
  { label: "Gemini", url: "https://gemini.google.com/app" },
  { label: "GitHub", url: "https://github.com/" },
  { label: "Linear", url: "https://linear.app/" },
  { label: "Notion", url: "https://www.notion.so/" },
  { label: "Slack", url: "https://app.slack.com/" },
] as const;

function normalizeAddressInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (/^https?:\/\//iu.test(trimmed)) {
    return new URL(trimmed).toString();
  }
  return new URL(`https://${trimmed}`).toString();
}

function hostLabel(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return "New tab";
  }
}

function isSecureUrl(url: string) {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

function providerLabel(provider: string) {
  if (provider === "chatgpt") {
    return "ChatGPT";
  }
  if (provider === "gemini") {
    return "Gemini";
  }
  return "Web";
}

export function BrowserLaunchPage({
  initialAppId,
  initialAppKey,
  initialAppLabel,
  initialIsolationMode,
  initialProfileId,
  initialProfileLabel,
  initialProvider,
  initialTargetUrl,
}: BrowserLaunchPageProps) {
  const [address, setAddress] = useState(initialTargetUrl);
  const [error, setError] = useState<string | null>(null);
  const secure = isSecureUrl(address);
  const currentHost = hostLabel(address);
  const fingerprintSummary = useMemo(() => buildT3BrowserFingerprintSummary(), []);
  const provider = providerLabel(initialProvider);
  const appLabel = initialAppLabel?.trim() || "Default app";
  const profileBadge = useMemo(
    () => `${initialProfileLabel}${initialProfileId === "current-browser" ? "" : " remote"}`,
    [initialProfileId, initialProfileLabel]
  );

  function navigateToAddress(nextAddress = address) {
    try {
      const normalized = normalizeAddressInput(nextAddress);
      if (!normalized) {
        setError("Enter a web address to continue.");
        return;
      }
      setError(null);
      window.location.assign(normalized);
    } catch {
      setError("Use a valid http or https web address.");
    }
  }

  async function copyAddress() {
    const normalized = normalizeAddressInput(address);
    if (!normalized) {
      setError("Enter a web address before copying.");
      return;
    }
    await navigator.clipboard?.writeText(normalized);
    setError(null);
  }

  return (
    <main className="browser-product-shell">
      <header className="browser-product-topbar" aria-label="Browser window controls">
        <div className="browser-product-window-controls" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="browser-product-tab active">
          <Globe2 size={14} />
          <span>{currentHost}</span>
        </div>
        <button type="button" aria-label="New tab">
          +
        </button>
      </header>

      <section className="browser-product-toolbar" aria-label="Browser toolbar">
        <button type="button" aria-label="Back" disabled>
          <ArrowLeft size={15} />
        </button>
        <button type="button" aria-label="Forward" disabled>
          <ArrowRight size={15} />
        </button>
        <button type="button" aria-label="Reload" onClick={() => navigateToAddress()}>
          <RefreshCw size={15} />
        </button>
        <form
          className={`browser-product-address ${secure ? "secure" : "insecure"}`}
          onSubmit={(event) => {
            event.preventDefault();
            navigateToAddress();
          }}
        >
          {secure ? <Lock size={14} /> : <TriangleAlert size={14} />}
          <input
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            aria-label="Browser address"
            spellCheck={false}
          />
          <button type="submit" aria-label="Go to address">
            <Search size={14} />
          </button>
        </form>
        <button type="button" aria-label="Copy address" onClick={() => void copyAddress()}>
          <Copy size={15} />
        </button>
      </section>

      <section className="browser-product-page">
        <aside className="browser-product-sidebar" aria-label="Browser spaces">
          <strong>HugeCode Browser</strong>
          <span>{profileBadge}</span>
          <div className="browser-product-space active">
            <ShieldCheck size={14} />
            {appLabel}
          </div>
          <div className="browser-product-space">
            <Globe2 size={14} />
            {provider}
          </div>
          {initialAppId ? (
            <div className="browser-product-fingerprint" aria-label="Isolated app scope">
              <span>
                <ShieldCheck size={14} />
                App scope
              </span>
              <strong>{initialIsolationMode ?? "local-mock-app-scope"}</strong>
              <small>{initialAppId}</small>
              <small>{initialAppKey ?? "electron partition pending"}</small>
            </div>
          ) : null}
          <div className="browser-product-fingerprint" aria-label="Fingerprint profile">
            <span>
              <Fingerprint size={14} />
              Fingerprint
            </span>
            <strong>Native transparent</strong>
            <small>{fingerprintSummary.browserFamily}</small>
            <small>{fingerprintSummary.language}</small>
            <small>{fingerprintSummary.timezone}</small>
          </div>
        </aside>

        <section className="browser-product-start">
          <div className="browser-product-hero">
            <span className={secure ? "secure" : "insecure"}>
              {secure ? <Lock size={15} /> : <TriangleAlert size={15} />}
              {secure ? "HTTPS connection" : "Not secure"}
            </span>
            <h1>{currentHost}</h1>
            <p>
              Open this site in a dedicated browser-style window. HugeCode keeps session data in the
              selected browser profile and does not copy cookies, passwords, or tokens.
            </p>
            {initialAppId ? (
              <div className="browser-product-fingerprint-banner">
                <ShieldCheck size={15} />
                <span>
                  <strong>Isolated app:</strong> {appLabel} uses appId {initialAppId}. This web mock
                  carries isolation metadata; Electron will bind it to a dedicated partition later.
                </span>
              </div>
            ) : null}
            <div className="browser-product-fingerprint-banner">
              <Fingerprint size={15} />
              <span>
                <strong>Fingerprint profile:</strong> {fingerprintSummary.disclosure}
              </span>
            </div>
            {error ? <div className="browser-product-error">{error}</div> : null}
            <div className="browser-product-actions">
              <button type="button" onClick={() => navigateToAddress()}>
                <ExternalLink size={15} />
                Open Site
              </button>
              <button type="button" onClick={() => void copyAddress()}>
                <Copy size={15} />
                Copy URL
              </button>
            </div>
          </div>

          <div className="browser-product-grid" aria-label="Quick starts">
            {QUICK_STARTS.map((entry) => (
              <button
                type="button"
                key={entry.url}
                onClick={() => {
                  setAddress(entry.url);
                  navigateToAddress(entry.url);
                }}
              >
                <span>{entry.label.slice(0, 1)}</span>
                <strong>{entry.label}</strong>
                <small>{hostLabel(entry.url)}</small>
              </button>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}

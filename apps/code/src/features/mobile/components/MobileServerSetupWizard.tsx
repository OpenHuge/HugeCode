import "../../../styles/mobile-setup-wizard.css";
import { Button } from "../../../design-system";
import type { RemoteBackendProvider } from "../../../types";
import { ModalShell } from "../../../design-system";

export type MobileServerSetupWizardProps = {
  provider: RemoteBackendProvider;
  remoteHostDraft: string;
  orbitWsUrlDraft: string;
  remoteTokenDraft: string;
  busy: boolean;
  checking: boolean;
  statusMessage: string | null;
  statusError: boolean;
  canSaveValidatedConnection: boolean;
  onProviderChange: (provider: RemoteBackendProvider) => void;
  onRemoteHostChange: (value: string) => void;
  onOrbitWsUrlChange: (value: string) => void;
  onRemoteTokenChange: (value: string) => void;
  onConnectTest: () => void | Promise<void>;
  onSaveConnection: () => void | Promise<void>;
  onContinueLimitedMode: () => void;
};

export function MobileServerSetupWizard({
  provider,
  remoteHostDraft,
  orbitWsUrlDraft,
  remoteTokenDraft,
  busy,
  checking,
  statusMessage,
  statusError,
  canSaveValidatedConnection,
  onProviderChange,
  onRemoteHostChange,
  onOrbitWsUrlChange,
  onRemoteTokenChange,
  onConnectTest,
  onSaveConnection,
  onContinueLimitedMode,
}: MobileServerSetupWizardProps) {
  return (
    <ModalShell
      className="mobile-setup-wizard-overlay"
      cardClassName="mobile-setup-wizard-card"
      ariaLabel="Mobile server setup"
    >
      <div className="mobile-setup-wizard-header">
        <div className="mobile-setup-wizard-kicker">Desktop Connection</div>
        <h2 className="mobile-setup-wizard-title">Connect to your desktop backend</h2>
        <p className="mobile-setup-wizard-subtitle">
          Validate and save the same connection details configured on your desktop CodexMonitor
          server settings to unlock runtime-backed work. You can continue in limited mode for
          review, settings, and handoff while this connection is still unavailable.
        </p>
      </div>

      <div className="mobile-setup-wizard-body">
        <label className="mobile-setup-wizard-label" htmlFor="mobile-setup-provider">
          Connection type
        </label>
        <select
          id="mobile-setup-provider"
          className="mobile-setup-wizard-input"
          value={provider}
          onChange={(event) => onProviderChange(event.target.value as RemoteBackendProvider)}
          disabled={busy || checking}
        >
          <option value="tcp">TCP</option>
          <option value="orbit">Orbit</option>
        </select>

        {provider === "tcp" && (
          <>
            <label className="mobile-setup-wizard-label" htmlFor="mobile-setup-host">
              Tailscale host
            </label>
            <input
              id="mobile-setup-host"
              className="mobile-setup-wizard-input"
              value={remoteHostDraft}
              placeholder="macbook.your-tailnet.ts.net:4732"
              onChange={(event) => onRemoteHostChange(event.target.value)}
              disabled={busy || checking}
            />
          </>
        )}

        {provider === "orbit" && (
          <>
            <label className="mobile-setup-wizard-label" htmlFor="mobile-setup-orbit-url">
              Orbit websocket URL
            </label>
            <input
              id="mobile-setup-orbit-url"
              className="mobile-setup-wizard-input"
              value={orbitWsUrlDraft}
              placeholder="wss://..."
              onChange={(event) => onOrbitWsUrlChange(event.target.value)}
              disabled={busy || checking}
            />
          </>
        )}

        <label className="mobile-setup-wizard-label" htmlFor="mobile-setup-token">
          Remote backend token
        </label>
        <input
          id="mobile-setup-token"
          type="password"
          className="mobile-setup-wizard-input"
          value={remoteTokenDraft}
          placeholder="Token"
          onChange={(event) => onRemoteTokenChange(event.target.value)}
          disabled={busy || checking}
        />

        <Button
          variant="primary"
          size="sm"
          className="mobile-setup-wizard-action"
          onClick={onConnectTest}
          disabled={busy || checking}
        >
          {checking ? "Validating..." : busy ? "Validating..." : "Validate connection"}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="mobile-setup-wizard-action"
          onClick={onSaveConnection}
          disabled={busy || checking || !canSaveValidatedConnection}
        >
          Save connection
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="mobile-setup-wizard-action"
          onClick={onContinueLimitedMode}
          disabled={busy || checking}
        >
          Continue in limited mode
        </Button>

        {statusMessage ? (
          <output
            className={`mobile-setup-wizard-status${
              statusError ? " mobile-setup-wizard-status-error" : ""
            }`}
            aria-live="polite"
          >
            {statusMessage}
          </output>
        ) : null}

        <div className="mobile-setup-wizard-hint">
          {provider === "tcp"
            ? "Validate the desktop Tailscale host and token first. Save only after the draft connection succeeds."
            : "Validate the Orbit websocket URL and token first. Save only after the draft connection succeeds."}
        </div>
      </div>
    </ModalShell>
  );
}

import { WEB_RUNTIME_GATEWAY_ENDPOINT_ENV_KEY } from "@ku0/shared/runtimeGatewayEnv";
import type { DiscoveredLocalRuntimeGatewayTarget, WorkspaceClientRuntimeMode } from "./bindings";
import {
  unavailableActionPrimary,
  unavailableActionSecondary,
  unavailableActions,
  unavailableBody,
  unavailableDetailBody,
  unavailableDetailCard,
  unavailableDetailLabel,
  unavailableDetailTitle,
  unavailableDetails,
  unavailableHero,
  unavailableInlineCode,
  unavailableKicker,
  unavailablePanel,
  unavailableProbeButton,
  unavailableProbeButtonDetail,
  unavailableProbeButtonTitle,
  unavailableProbeList,
  unavailableProbePanel,
  unavailableProbeStatus,
  unavailableShell,
  unavailableTitle,
} from "./WorkspaceClientEntry.css";

export type WorkspaceWebUnavailableProps = {
  runtimeMode?: WorkspaceClientRuntimeMode;
  probeState?: "idle" | "probing" | "multiple" | "none";
  localRuntimeCandidates?: DiscoveredLocalRuntimeGatewayTarget[];
  isConnectingCandidate?: boolean;
  onSelectLocalRuntimeCandidate?: (candidate: DiscoveredLocalRuntimeGatewayTarget) => void;
};

export function WorkspaceWebUnavailable({
  runtimeMode = "unavailable",
  probeState = "none",
  localRuntimeCandidates = [],
  isConnectingCandidate = false,
  onSelectLocalRuntimeCandidate,
}: WorkspaceWebUnavailableProps) {
  const showCandidatePicker =
    probeState === "multiple" &&
    localRuntimeCandidates.length > 1 &&
    typeof onSelectLocalRuntimeCandidate === "function";

  return (
    <div className={unavailableShell}>
      <div className={unavailablePanel}>
        <section className={unavailableHero}>
          <span className={unavailableKicker}>Web workspace</span>
          <h1 className={unavailableTitle}>Connect a runtime to open the workspace.</h1>
          <p className={unavailableBody}>
            Public pages stay fast on the web, but the full workspace needs either the desktop
            runtime or a configured remote runtime endpoint. To enable browser access, set{" "}
            <code className={unavailableInlineCode}>{WEB_RUNTIME_GATEWAY_ENDPOINT_ENV_KEY}</code>{" "}
            and reload this page.
          </p>
          <p className={unavailableBody}>
            Review and handoff can stay visible on the web, but repo execution and durable workspace
            state still require a connected runtime service. Local desktop discovery is a fallback,
            not the primary route.
          </p>
          {probeState === "probing" || runtimeMode === "discoverable" ? (
            <div className={unavailableProbePanel}>
              <p className={unavailableProbeStatus}>
                Scanning common local runtime ports on this machine while the browser waits for a
                configured remote runtime.
              </p>
            </div>
          ) : null}
          {showCandidatePicker ? (
            <div className={unavailableProbePanel}>
              <p className={unavailableProbeStatus}>
                Multiple local runtimes responded. Choose which one this browser session should use.
              </p>
              <div className={unavailableProbeList}>
                {localRuntimeCandidates.map((candidate) => (
                  <button
                    key={`${candidate.host}:${candidate.port}`}
                    type="button"
                    className={unavailableProbeButton}
                    onClick={() => onSelectLocalRuntimeCandidate(candidate)}
                    disabled={isConnectingCandidate}
                    aria-label={`Use local runtime ${candidate.host}:${candidate.port}`}
                  >
                    <span className={unavailableProbeButtonTitle}>{candidate.port}</span>
                    <span className={unavailableProbeButtonDetail}>{candidate.host}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <div className={unavailableActions}>
            <a className={unavailableActionPrimary} href="/">
              Back to web home
            </a>
            <a className={unavailableActionSecondary} href="/about">
              View platform overview
            </a>
          </div>
        </section>

        <section className={unavailableDetails}>
          <article className={unavailableDetailCard}>
            <span className={unavailableDetailLabel}>Desktop</span>
            <strong className={unavailableDetailTitle}>
              Use the local runtime for repos and OS tools
            </strong>
            <span className={unavailableDetailBody}>
              The desktop path keeps filesystem access, native window controls, and local repo
              workflows inside the Electron desktop host. This is the path for writable execution
              and durable local state.
            </span>
          </article>

          <article className={unavailableDetailCard}>
            <span className={unavailableDetailLabel}>Gateway</span>
            <strong className={unavailableDetailTitle}>
              Point the browser at a remote runtime
            </strong>
            <span className={unavailableDetailBody}>
              Configure the web runtime gateway when you want the same workspace shell in a browser
              session without attaching the Electron desktop runtime. Gateway-backed sessions may
              expose a narrower capability set than desktop and should explain degraded or read-only
              states explicitly.
            </span>
          </article>

          <article className={unavailableDetailCard}>
            <span className={unavailableDetailLabel}>Boundary</span>
            <strong className={unavailableDetailTitle}>
              Keep the workspace client-only on the web
            </strong>
            <span className={unavailableDetailBody}>
              The SSR shell stays focused on public pages while the interactive workspace only loads
              once a runtime target is available. Browser-local fallbacks are convenience-only and
              must not be mistaken for runtime-backed persistence.
            </span>
          </article>
        </section>
      </div>
    </div>
  );
}

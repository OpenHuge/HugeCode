import { useMemo, useState } from "react";
import { Button } from "@ku0/design-system";
import SlidersHorizontal from "lucide-react/dist/esm/icons/sliders-horizontal";
import { SettingsFieldGroup, SettingsFooterBar } from "./SettingsSectionGrammar";
import type {
  SettingsServerBackendPoolBootstrapPreview,
  SettingsServerBackendPoolDiagnostics,
  SettingsServerBackendPoolEntry,
  SettingsServerBackendPoolSnapshot,
} from "./serverControlPlaneTypes";

type BackendAction = "drain" | "disable" | "enable" | "remove";
type PendingBackendAction = BackendAction | "probe";

export type SettingsBackendPoolSectionProps = {
  backendPool: SettingsServerBackendPoolSnapshot | null;
  loading?: boolean;
  error?: string | null;
  readOnlyReason?: string | null;
  stateActionsEnabled?: boolean;
  removeEnabled?: boolean;
  upsertEnabled?: boolean;
  probeEnabled?: boolean;
  editEnabled?: boolean;
  bootstrapPreview?: SettingsServerBackendPoolBootstrapPreview | null;
  bootstrapPreviewError?: string | null;
  diagnostics?: SettingsServerBackendPoolDiagnostics | null;
  diagnosticsError?: string | null;
  showFieldGroup?: boolean;
  onRefresh?: () => void;
  onOpenControlDrawer?: (backendId: string) => void;
  onBackendAction?: (request: { backendId: string; action: BackendAction }) => Promise<void>;
  onBackendUpsert?: () => void | Promise<void>;
  onNativeBackendEdit?: (backendId: string) => void;
  onAcpBackendUpsert?: () => void | Promise<void>;
  onAcpBackendProbe?: (backendId: string) => Promise<void>;
  onAcpBackendEdit?: (backendId: string) => void;
};

function formatStateLabel(state: string): string {
  if (!state) {
    return "Unknown";
  }
  return `${state.slice(0, 1).toUpperCase()}${state.slice(1)}`;
}

function formatQueueDepth(queueDepth: number | null | undefined): string {
  if (queueDepth === null || queueDepth === undefined) {
    return "-";
  }
  return `${queueDepth}`;
}

function formatActionLabel(action: BackendAction): string {
  if (action === "drain") {
    return "Drain";
  }
  if (action === "disable") {
    return "Disable";
  }
  if (action === "remove") {
    return "Remove";
  }
  return "Enable";
}

function formatActionConfirmation(action: BackendAction, label: string): string {
  if (action === "drain") {
    return `Drain backend '${label}'?`;
  }
  if (action === "disable") {
    return `Disable backend '${label}'?`;
  }
  if (action === "remove") {
    return `Remove backend '${label}' from the pool?`;
  }
  return `Enable backend '${label}'?`;
}

function formatBackendClassLabel(value: "primary" | "burst" | "specialized"): string {
  if (value === "primary") {
    return "Primary";
  }
  if (value === "burst") {
    return "Burst";
  }
  return "Specialized";
}

function formatBackendPolicySummary(
  policy: SettingsServerBackendPoolEntry["policy"]
): string | null {
  if (!policy) {
    return null;
  }
  const trustTier = policy.trustTier ?? "standard";
  const dataSensitivity = policy.dataSensitivity ?? "internal";
  const approvalPolicy = policy.approvalPolicy ?? "checkpoint-required";
  const allowedToolClasses = policy.allowedToolClasses?.join(", ") ?? "read, write";
  return `Policy: ${trustTier} / ${dataSensitivity} / ${approvalPolicy} / ${allowedToolClasses}`;
}

function formatProbeTimestamp(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "Not probed yet";
  }
  return new Date(value).toLocaleString();
}

function AcpProbeStatusSummary({
  healthy,
  lastError,
  lastProbeAt,
  emptyLabel = "No ACP probe has completed yet.",
}: {
  healthy?: boolean | null;
  lastError?: string | null;
  lastProbeAt?: number | null;
  emptyLabel?: string;
}) {
  const hasProbe = lastProbeAt !== null && lastProbeAt !== undefined;

  if (!hasProbe && !lastError) {
    return <div className="settings-help">{emptyLabel}</div>;
  }

  return (
    <>
      <div className="settings-help">
        Probe: {healthy === false ? "unhealthy" : "healthy"}. Last probe:{" "}
        {formatProbeTimestamp(lastProbeAt)}
      </div>
      {lastError ? <div className="settings-help settings-help-error">{lastError}</div> : null}
    </>
  );
}

export function SettingsBackendPoolSection({
  backendPool,
  loading = false,
  error = null,
  readOnlyReason = null,
  stateActionsEnabled = false,
  removeEnabled = false,
  upsertEnabled = false,
  probeEnabled = false,
  editEnabled = false,
  bootstrapPreview = null,
  bootstrapPreviewError = null,
  diagnostics = null,
  diagnosticsError = null,
  showFieldGroup = true,
  onRefresh,
  onOpenControlDrawer,
  onBackendAction,
  onBackendUpsert,
  onNativeBackendEdit,
  onAcpBackendUpsert,
  onAcpBackendProbe,
  onAcpBackendEdit,
}: SettingsBackendPoolSectionProps) {
  const [pendingActionByBackend, setPendingActionByBackend] = useState<
    Record<string, PendingBackendAction>
  >({});
  const [actionError, setActionError] = useState<string | null>(null);

  const hasBackends = (backendPool?.backends.length ?? 0) > 0;
  const diagnosticsReasons = diagnostics?.reasons ?? [];
  const diagnosticsWarnings = diagnostics?.warnings ?? [];

  const metrics = useMemo(
    () => [
      { label: "Total", value: backendPool?.backendsTotal ?? 0 },
      { label: "Healthy", value: backendPool?.backendsHealthy ?? 0 },
      { label: "Draining", value: backendPool?.backendsDraining ?? 0 },
      { label: "Queue", value: backendPool?.queueDepth ?? "-" },
    ],
    [backendPool]
  );

  const handleAction = async (
    backendId: string,
    backendLabel: string,
    action: BackendAction
  ): Promise<void> => {
    const isStateAction = action === "drain" || action === "disable" || action === "enable";
    const actionEnabled = isStateAction ? stateActionsEnabled : removeEnabled;
    if (!actionEnabled || !onBackendAction) {
      return;
    }

    let confirmAction: boolean | undefined;
    try {
      confirmAction = globalThis.confirm?.(formatActionConfirmation(action, backendLabel));
    } catch {
      confirmAction = true;
    }
    if (confirmAction === false) {
      return;
    }

    setActionError(null);
    setPendingActionByBackend((previous) => ({ ...previous, [backendId]: action }));

    try {
      await onBackendAction({ backendId, action });
    } catch {
      setActionError(`Failed to ${action} backend '${backendLabel}'.`);
    } finally {
      setPendingActionByBackend((previous) => {
        const next = { ...previous };
        delete next[backendId];
        return next;
      });
    }
  };

  const actionDisabledReason =
    readOnlyReason ?? "Runtime backend actions are unavailable in current runtime.";
  const probeDisabledReason =
    readOnlyReason ?? "ACP probe action is unavailable in current runtime.";

  const content = (
    <>
      <div className="settings-help">
        Observe backend health and placement pressure. Control actions are gated behind runtime
        capability and RPC readiness.
      </div>
      <div className="settings-help">
        Remote-provider execution is default. Local machine execution may be disabled by runtime
        policy.
      </div>
      <ul className="settings-backend-pool-metrics" aria-label="Backend pool metrics">
        {metrics.map((metric) => (
          <li key={metric.label} className="settings-backend-pool-metric">
            <span className="settings-backend-pool-metric-label">{metric.label}</span>
            <span className="settings-backend-pool-metric-value">{metric.value}</span>
          </li>
        ))}
      </ul>

      <SettingsFooterBar className="settings-backend-pool-actions-top">
        <Button
          variant="secondary"
          size="sm"
          className="settings-button-compact"
          onClick={onRefresh}
          disabled={!onRefresh || loading}
        >
          {loading ? "Refreshing..." : "Refresh"}
        </Button>
        {upsertEnabled ? (
          <Button
            variant="secondary"
            size="sm"
            className="settings-button-compact"
            onClick={() => {
              void onBackendUpsert?.();
            }}
            disabled={!onBackendUpsert || loading}
          >
            Add backend
          </Button>
        ) : null}
        {upsertEnabled ? (
          <Button
            variant="secondary"
            size="sm"
            className="settings-button-compact"
            onClick={() => {
              void onAcpBackendUpsert?.();
            }}
            disabled={!onAcpBackendUpsert || loading}
          >
            Add ACP backend
          </Button>
        ) : null}
      </SettingsFooterBar>

      {readOnlyReason ? (
        <div className="settings-help">Read-only mode: {readOnlyReason}</div>
      ) : null}
      {error ? <div className="settings-help settings-help-error">{error}</div> : null}
      {bootstrapPreviewError ? (
        <div className="settings-help settings-help-error">{bootstrapPreviewError}</div>
      ) : null}
      {diagnosticsError ? (
        <div className="settings-help settings-help-error">{diagnosticsError}</div>
      ) : null}
      {actionError ? <div className="settings-help settings-help-error">{actionError}</div> : null}

      {bootstrapPreview ? (
        <div className="settings-field">
          <div className="settings-backend-pool-row-title">Backend onboarding</div>
          <div className="settings-help">
            Self-host join preview is ready for {bootstrapPreview.templates.length} backend classes.
            Use the prepared command, token contract, and registration metadata instead of manual
            payload patching.
          </div>
          <ul className="settings-backend-pool-list" aria-label="Backend onboarding templates">
            {bootstrapPreview.templates.map((template) => (
              <li
                key={`${template.backendClass}-${template.backendIdExample}`}
                className="settings-backend-pool-row"
              >
                <div className="settings-backend-pool-row-main">
                  <div className="settings-backend-pool-row-title">{template.title}</div>
                  <div className="settings-backend-pool-row-meta">
                    <span className="settings-backend-pool-row-provider">
                      {formatBackendClassLabel(template.backendClass)}
                    </span>
                    <span className="settings-backend-pool-row-provider">
                      Host {bootstrapPreview.remoteHost}
                    </span>
                    <span className="settings-backend-pool-row-provider">
                      Token {bootstrapPreview.remoteTokenConfigured ? "configured" : "missing"}
                    </span>
                  </div>
                  <div className="settings-help">{template.command}</div>
                  {template.args.length > 0 ? (
                    <div className="settings-help">Args: {template.args.join(" ")}</div>
                  ) : null}
                  <div className="settings-help">
                    Backend ID example: {template.backendIdExample}
                  </div>
                  {template.notes.map((note) => (
                    <div key={`${template.backendIdExample}-${note}`} className="settings-help">
                      {note}
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {diagnostics ? (
        <div className="settings-field">
          <div className="settings-backend-pool-row-title">Backend diagnostics</div>
          <div className="settings-help">
            Diagnostics source: {diagnostics.registrySource}. Default route:{" "}
            {diagnostics.defaultExecutionBackendId ?? "Automatic runtime routing"}
          </div>
          <div className="settings-help">
            Overlay: {diagnostics.tcpOverlay ?? "none"} · Remote host: {diagnostics.remoteHost}
          </div>
          <div className="settings-help">
            Token {diagnostics.remoteTokenConfigured ? "configured" : "missing"} · Daemon{" "}
            {diagnostics.tcpDaemon.state}
          </div>
          {diagnosticsReasons.length > 0 ? (
            <ul
              className="settings-backend-pool-list"
              aria-label="Backend pool diagnostics reasons"
            >
              {diagnosticsReasons.map((reason) => (
                <li key={reason.code} className="settings-backend-pool-row">
                  <div className="settings-backend-pool-row-main">
                    <div className="settings-help">{reason.summary}</div>
                    {reason.detail ? <div className="settings-help">{reason.detail}</div> : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
          {diagnosticsWarnings.map((warning) => (
            <div key={warning} className="settings-help settings-help-error">
              {warning}
            </div>
          ))}
        </div>
      ) : null}

      {!hasBackends && !loading ? (
        <div className="settings-help">No backend pool data available.</div>
      ) : null}

      {hasBackends ? (
        <ul className="settings-backend-pool-list" aria-label="Backend pool list">
          {backendPool?.backends.map((backend) => {
            const pendingAction = pendingActionByBackend[backend.backendId] ?? null;
            const isAcpBackend = backend.backendKind === "acp" && backend.integrationId;

            return (
              <li key={backend.backendId} className="settings-backend-pool-row">
                <div className="settings-backend-pool-row-main">
                  <div className="settings-backend-pool-row-title">{backend.label}</div>
                  <div className="settings-backend-pool-row-meta">
                    <span className="settings-backend-pool-row-provider">
                      {backend.provider ?? "unknown provider"}
                    </span>
                    {backend.backendKind === "acp" ? (
                      <span className="settings-backend-pool-row-provider">ACP</span>
                    ) : null}
                    {backend.backendClass ? (
                      <span className="settings-backend-pool-row-provider">
                        {formatBackendClassLabel(backend.backendClass)}
                      </span>
                    ) : null}
                    {backend.specializations?.map((specialization) => (
                      <span
                        key={`${backend.backendId}-${specialization}`}
                        className="settings-backend-pool-row-provider"
                      >
                        {specialization}
                      </span>
                    ))}
                    {backend.transport ? (
                      <span className="settings-backend-pool-row-provider">
                        {backend.transport.toUpperCase()}
                      </span>
                    ) : null}
                    {backend.connectivity?.overlay ? (
                      <span className="settings-backend-pool-row-provider">
                        {backend.connectivity.overlay}
                      </span>
                    ) : null}
                    {backend.transport === "http" && backend.httpExperimental !== null ? (
                      <span className="settings-backend-pool-row-provider">
                        Experimental {backend.httpExperimental ? "On" : "Off"}
                      </span>
                    ) : null}
                    {backend.origin === "acp-projection" ? (
                      <span className="settings-backend-pool-row-provider">Projected</span>
                    ) : null}
                    <span
                      className={`settings-backend-pool-state settings-backend-pool-state-${backend.state}`}
                    >
                      {formatStateLabel(backend.state)}
                    </span>
                    <span>Queue {formatQueueDepth(backend.queueDepth)}</span>
                  </div>
                  {isAcpBackend ? (
                    <AcpProbeStatusSummary
                      healthy={backend.healthy}
                      lastError={backend.lastError}
                      lastProbeAt={backend.lastProbeAt}
                    />
                  ) : null}
                  {backend.diagnostics?.summary ? (
                    <div className="settings-help">{backend.diagnostics.summary}</div>
                  ) : null}
                  {backend.policy ? (
                    <div className="settings-help">
                      {formatBackendPolicySummary(backend.policy)}
                    </div>
                  ) : null}
                  {backend.connectivity?.reachability || backend.connectivity?.endpoint ? (
                    <div className="settings-help">
                      Connectivity: {backend.connectivity?.reachability ?? "unknown"}
                      {backend.connectivity?.endpoint
                        ? ` via ${backend.connectivity.endpoint}`
                        : ""}
                      {backend.connectivity?.reason ? ` (${backend.connectivity.reason})` : ""}
                    </div>
                  ) : null}
                  {backend.lease ? (
                    <div className="settings-help">
                      Lease: {backend.lease.status}
                      {backend.lease.holderId ? ` by ${backend.lease.holderId}` : ""}
                      {backend.lease.expiresAt
                        ? ` until ${new Date(backend.lease.expiresAt).toLocaleString()}`
                        : ""}
                    </div>
                  ) : null}
                  {backend.diagnostics?.reasons && backend.diagnostics.reasons.length > 0 ? (
                    <div className="settings-help">
                      Diagnostics: {backend.diagnostics.reasons.join(", ")}
                    </div>
                  ) : null}
                </div>
                <div className="settings-backend-pool-row-controls">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="settings-backend-pool-icon-button"
                    aria-label={`Open backend controls for ${backend.label}`}
                    onClick={() => onOpenControlDrawer?.(backend.backendId)}
                  >
                    <SlidersHorizontal size={14} aria-hidden />
                  </Button>
                  {!isAcpBackend ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="settings-button-compact"
                      disabled={pendingAction !== null || !editEnabled}
                      title={
                        pendingAction !== null || !editEnabled ? actionDisabledReason : undefined
                      }
                      onClick={() => {
                        onNativeBackendEdit?.(backend.backendId);
                      }}
                    >
                      Edit
                    </Button>
                  ) : null}
                  {isAcpBackend ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="settings-button-compact"
                      disabled={pendingAction !== null || !editEnabled}
                      title={
                        pendingAction !== null || !editEnabled ? actionDisabledReason : undefined
                      }
                      onClick={() => {
                        onAcpBackendEdit?.(backend.backendId);
                      }}
                    >
                      Edit
                    </Button>
                  ) : null}
                  {isAcpBackend ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="settings-button-compact"
                      disabled={pendingAction !== null || !probeEnabled}
                      title={
                        pendingAction !== null || !probeEnabled ? probeDisabledReason : undefined
                      }
                      onClick={() => {
                        if (!onAcpBackendProbe) {
                          return;
                        }
                        setActionError(null);
                        setPendingActionByBackend((previous) => ({
                          ...previous,
                          [backend.backendId]: "probe",
                        }));
                        void onAcpBackendProbe(backend.backendId)
                          .catch(() => {
                            setActionError(`Failed to probe ACP backend '${backend.label}'.`);
                          })
                          .finally(() => {
                            setPendingActionByBackend((previous) => {
                              const next = { ...previous };
                              delete next[backend.backendId];
                              return next;
                            });
                          });
                      }}
                    >
                      Probe
                    </Button>
                  ) : null}
                  {(["drain", "disable", "enable", "remove"] as BackendAction[]).map((action) => {
                    const isStateAction =
                      action === "drain" || action === "disable" || action === "enable";
                    const actionEnabled = isStateAction ? stateActionsEnabled : removeEnabled;
                    const controlsDisabled = pendingAction !== null || !actionEnabled;
                    return (
                      <Button
                        key={action}
                        variant="secondary"
                        size="sm"
                        className="settings-button-compact"
                        disabled={controlsDisabled}
                        title={controlsDisabled ? actionDisabledReason : undefined}
                        onClick={() => {
                          void handleAction(backend.backendId, backend.label, action);
                        }}
                      >
                        {pendingAction === action
                          ? `${formatActionLabel(action)}...`
                          : formatActionLabel(action)}
                      </Button>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </>
  );

  return (
    <section className="settings-field settings-backend-pool" data-testid="settings-backend-pool">
      {showFieldGroup ? (
        <SettingsFieldGroup title="Backend Pool">{content}</SettingsFieldGroup>
      ) : (
        content
      )}
    </section>
  );
}

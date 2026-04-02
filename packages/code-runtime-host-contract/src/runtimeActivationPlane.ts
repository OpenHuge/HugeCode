export type RuntimeExtensionActivationState =
  | "discovered"
  | "verified"
  | "installed"
  | "bound"
  | "active"
  | "degraded"
  | "refresh_pending"
  | "deactivated"
  | "failed"
  | "uninstalled";

export type RuntimeExtensionActivationReadinessState = "ready" | "attention" | "blocked";

export type RuntimeExtensionActivationRefreshMode = "cache_only" | "full";

export type RuntimeExtensionContributionKind =
  | "invocation"
  | "skill"
  | "hook"
  | "resource"
  | "route"
  | "policy"
  | "subagent_role"
  | "host_binding";

export type RuntimeExtensionContributionBindingStage =
  | "compile_time_descriptor"
  | "runtime_binding"
  | "session_overlay";

export type RuntimeExtensionActivationSourceType =
  | "runtime_plugin"
  | "behavior_asset"
  | "registry_package"
  | "session_overlay";

export type RuntimeExtensionActivationSourceScope =
  | "runtime"
  | "workspace"
  | "package"
  | "session_overlay"
  | "host";

export type RuntimeExtensionActivationDiagnosticPhase =
  | "discover"
  | "verify"
  | "install"
  | "bind"
  | "activate"
  | "refresh"
  | "deactivate"
  | "uninstall";

export type RuntimeExtensionActivationDiagnosticSeverity = "info" | "warning" | "error";

export type RuntimeExtensionActivationDiagnostic = {
  phase: RuntimeExtensionActivationDiagnosticPhase;
  severity: RuntimeExtensionActivationDiagnosticSeverity;
  code: string;
  message: string;
  at: number;
};

export type RuntimeExtensionActivationTransition = {
  state: RuntimeExtensionActivationState;
  at: number;
  reason: string;
};

export type RuntimeExtensionContributionDescriptor = {
  id: string;
  kind: RuntimeExtensionContributionKind;
  sourceId: string;
  title: string;
  bindingStage: RuntimeExtensionContributionBindingStage;
  active: boolean;
  metadata: Record<string, unknown> | null;
};

export type RuntimeExtensionActivationReadiness = {
  state: RuntimeExtensionActivationReadinessState;
  summary: string;
  detail: string;
};

export type RuntimeExtensionActivationRecord = {
  activationId: string;
  sourceType: RuntimeExtensionActivationSourceType;
  sourceScope: RuntimeExtensionActivationSourceScope;
  sourceRef: string;
  pluginId: string | null;
  packageRef: string | null;
  overlayId: string | null;
  sessionId: string | null;
  name: string;
  version: string;
  state: RuntimeExtensionActivationState;
  readiness: RuntimeExtensionActivationReadiness;
  diagnostics: RuntimeExtensionActivationDiagnostic[];
  contributions: RuntimeExtensionContributionDescriptor[];
  transitionHistory: RuntimeExtensionActivationTransition[];
  metadata: Record<string, unknown> | null;
};

export type RuntimeExtensionActivationSnapshot = {
  workspaceId: string;
  sessionId: string | null;
  refreshMode: RuntimeExtensionActivationRefreshMode;
  refreshedAt: number;
  records: RuntimeExtensionActivationRecord[];
  activeContributions: RuntimeExtensionContributionDescriptor[];
  summary: {
    total: number;
    active: number;
    degraded: number;
    failed: number;
    deactivated: number;
    refreshPending: number;
    uninstalled: number;
  };
};

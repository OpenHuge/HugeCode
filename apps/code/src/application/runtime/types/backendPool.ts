export const MULTI_BACKEND_POOL_CAPABILITY = "multi_backend_pool_v1";
export const BACKEND_PLACEMENT_OBSERVABILITY_CAPABILITY = "backend_placement_observability_v1";

export type BackendPoolState = "enabled" | "disabled" | "draining" | "degraded" | "unknown";

export type BackendPoolReachability = "reachable" | "degraded" | "unreachable" | "unknown";

export type BackendPoolLeaseStatus = "active" | "expiring" | "expired" | "released" | "none";

export type BackendPoolEntry = {
  backendId: string;
  label: string;
  capabilities?: string[] | null;
  maxConcurrency?: number | null;
  costTier?: string | null;
  latencyClass?: string | null;
  rolloutState?: "current" | "ramping" | "draining" | "drained" | null;
  status?: "active" | "draining" | "disabled" | null;
  provider?: string | null;
  state: BackendPoolState;
  backendKind?: "native" | "acp" | null;
  integrationId?: string | null;
  transport?: "stdio" | "http" | null;
  httpExperimental?: boolean | null;
  origin?: "runtime-native" | "acp-projection" | null;
  contract?: {
    kind: "native" | "acp";
    origin: "runtime-native" | "acp-projection";
    transport: "stdio" | "http" | null;
    capabilityCount: number;
    health: "active" | "draining" | "disabled";
    rolloutState: "current" | "ramping" | "draining" | "drained";
    backendClass?: "primary" | "burst" | "specialized" | null;
    reachability?: BackendPoolReachability | null;
    leaseStatus?: BackendPoolLeaseStatus | null;
  } | null;
  healthy?: boolean | null;
  lastError?: string | null;
  lastProbeAt?: number | null;
  queueDepth?: number | null;
  placementFailuresTotal?: number | null;
  capacity?: number | null;
  inFlight?: number | null;
  updatedAt?: number | null;
  heartbeatIntervalMs?: number | null;
  backendClass?: "primary" | "burst" | "specialized" | null;
  specializations?: string[] | null;
  connectivity?: {
    mode?: "direct" | "overlay" | "gateway" | null;
    overlay?: "tailscale" | "netbird" | "orbit" | null;
    endpoint?: string | null;
    reachability?: BackendPoolReachability | null;
    checkedAt?: number | null;
    source?: "runtime" | "overlay" | "operator" | "probe" | null;
    reason?: string | null;
  } | null;
  lease?: {
    status: BackendPoolLeaseStatus;
    leaseId?: string | null;
    holderId?: string | null;
    scope?: "backend" | "slot" | "node" | "overlay-session" | null;
    acquiredAt?: number | null;
    expiresAt?: number | null;
    ttlMs?: number | null;
    observedAt?: number | null;
  } | null;
  diagnostics?: {
    availability?:
      | "available"
      | "saturated"
      | "draining"
      | "disabled"
      | "degraded"
      | "unknown"
      | null;
    summary?: string | null;
    reasons?: string[] | null;
    degraded?: boolean | null;
    heartbeatAgeMs?: number | null;
    lastHeartbeatAt?: number | null;
    reachability?: BackendPoolReachability | null;
    leaseStatus?: BackendPoolLeaseStatus | null;
  } | null;
  policy?: {
    trustTier?: "trusted" | "standard" | "isolated" | null;
    dataSensitivity?: "public" | "internal" | "restricted" | null;
    approvalPolicy?: "runtime-default" | "checkpoint-required" | "never-auto-approve" | null;
    allowedToolClasses?: ("read" | "write" | "exec" | "network" | "browser" | "mcp")[] | null;
  } | null;
  tcpOverlay?: "tailscale" | "netbird" | null;
  metadata?: Record<string, unknown> | null;
};

export type BackendPoolSnapshot = {
  backends: BackendPoolEntry[];
  backendsTotal: number;
  backendsHealthy: number;
  backendsDraining: number;
  placementFailuresTotal: number;
  queueDepth: number | null;
  updatedAt: number | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") {
      return true;
    }
    if (normalized === "false") {
      return false;
    }
  }
  return null;
}

function asTcpOverlay(value: unknown): BackendPoolEntry["tcpOverlay"] {
  if (value === "netbird") {
    return "netbird";
  }
  if (value === "tailscale") {
    return "tailscale";
  }
  return null;
}

function asStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const normalized = value
    .map((entry) => asString(entry))
    .filter((entry): entry is string => Boolean(entry));
  return normalized.length > 0 ? normalized : [];
}

function asBackendClass(value: unknown): BackendPoolEntry["backendClass"] {
  if (value === "primary" || value === "burst" || value === "specialized") {
    return value;
  }
  return null;
}

function asTrustTier(value: unknown): NonNullable<BackendPoolEntry["policy"]>["trustTier"] {
  if (value === "trusted" || value === "standard" || value === "isolated") {
    return value;
  }
  return null;
}

function asDataSensitivity(
  value: unknown
): NonNullable<BackendPoolEntry["policy"]>["dataSensitivity"] {
  if (value === "public" || value === "internal" || value === "restricted") {
    return value;
  }
  return null;
}

function asApprovalPolicy(
  value: unknown
): NonNullable<BackendPoolEntry["policy"]>["approvalPolicy"] {
  if (
    value === "runtime-default" ||
    value === "checkpoint-required" ||
    value === "never-auto-approve"
  ) {
    return value;
  }
  return null;
}

function asAllowedToolClasses(
  value: unknown
): NonNullable<BackendPoolEntry["policy"]>["allowedToolClasses"] {
  const values = asStringArray(value);
  if (!values) {
    return null;
  }
  return values.filter(
    (
      entry
    ): entry is NonNullable<
      NonNullable<BackendPoolEntry["policy"]>["allowedToolClasses"]
    >[number] =>
      entry === "read" ||
      entry === "write" ||
      entry === "exec" ||
      entry === "network" ||
      entry === "browser" ||
      entry === "mcp"
  );
}

function asConnectivityMode(value: unknown): NonNullable<BackendPoolEntry["connectivity"]>["mode"] {
  if (value === "direct" || value === "overlay" || value === "gateway") {
    return value;
  }
  return null;
}

function asOverlay(value: unknown): NonNullable<BackendPoolEntry["connectivity"]>["overlay"] {
  if (value === "tailscale" || value === "netbird" || value === "orbit") {
    return value;
  }
  return null;
}

function asReachability(
  value: unknown
): NonNullable<BackendPoolEntry["connectivity"]>["reachability"] {
  if (
    value === "reachable" ||
    value === "degraded" ||
    value === "unreachable" ||
    value === "unknown"
  ) {
    return value;
  }
  return null;
}

function asLeaseStatus(value: unknown): BackendPoolLeaseStatus | null {
  if (
    value === "active" ||
    value === "expiring" ||
    value === "expired" ||
    value === "released" ||
    value === "none"
  ) {
    return value;
  }
  return null;
}

function normalizeBackendPoolState(value: unknown): BackendPoolState {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!raw) {
    return "unknown";
  }
  if (raw === "active" || raw === "enabled" || raw === "ready") {
    return "enabled";
  }
  if (raw === "disabled" || raw === "offline") {
    return "disabled";
  }
  if (raw === "draining") {
    return "draining";
  }
  if (raw === "degraded" || raw === "error" || raw === "unhealthy") {
    return "degraded";
  }
  return "unknown";
}

function normalizeBackendEntry(entry: unknown, index: number): BackendPoolEntry | null {
  const record = asRecord(entry);
  if (!record) {
    return null;
  }

  const backendId =
    asString(record.backendId ?? record.backend_id ?? record.id) ?? `backend-${index + 1}`;
  const label =
    asString(record.label ?? record.name ?? record.displayName ?? record.display_name) ?? backendId;

  return {
    backendId,
    label,
    capabilities: asStringArray(record.capabilities),
    maxConcurrency: asNumber(record.maxConcurrency ?? record.max_concurrency),
    costTier: asString(record.costTier ?? record.cost_tier),
    latencyClass: asString(record.latencyClass ?? record.latency_class),
    rolloutState:
      (asString(record.rolloutState ?? record.rollout_state) as BackendPoolEntry["rolloutState"]) ??
      null,
    status: (asString(record.status) as BackendPoolEntry["status"]) ?? null,
    provider: asString(record.provider),
    state: normalizeBackendPoolState(record.state),
    backendKind:
      (asString(record.backendKind ?? record.backend_kind) as BackendPoolEntry["backendKind"]) ??
      null,
    integrationId: asString(record.integrationId ?? record.integration_id),
    transport: (asString(record.transport) as BackendPoolEntry["transport"]) ?? null,
    httpExperimental: asBoolean(record.httpExperimental ?? record.http_experimental),
    origin: (asString(record.origin) as BackendPoolEntry["origin"]) ?? null,
    contract: asRecord(record.contract)
      ? {
          kind:
            (asString(asRecord(record.contract)?.kind) as NonNullable<
              BackendPoolEntry["contract"]
            >["kind"]) ?? "native",
          origin:
            (asString(asRecord(record.contract)?.origin) as NonNullable<
              BackendPoolEntry["contract"]
            >["origin"]) ?? "runtime-native",
          transport:
            (asString(asRecord(record.contract)?.transport) as NonNullable<
              BackendPoolEntry["contract"]
            >["transport"]) ?? null,
          capabilityCount: asNumber(asRecord(record.contract)?.capabilityCount) ?? 0,
          health:
            (asString(asRecord(record.contract)?.health) as NonNullable<
              BackendPoolEntry["contract"]
            >["health"]) ?? "disabled",
          rolloutState:
            (asString(asRecord(record.contract)?.rolloutState) as NonNullable<
              BackendPoolEntry["contract"]
            >["rolloutState"]) ?? "current",
          backendClass: asBackendClass(asRecord(record.contract)?.backendClass),
          reachability: asReachability(asRecord(record.contract)?.reachability),
          leaseStatus: asLeaseStatus(asRecord(record.contract)?.leaseStatus),
        }
      : null,
    healthy: asBoolean(record.healthy),
    lastError: asString(record.lastError ?? record.last_error),
    lastProbeAt: asNumber(record.lastProbeAt ?? record.last_probe_at),
    queueDepth: asNumber(record.queueDepth ?? record.queue_depth),
    placementFailuresTotal: asNumber(
      record.placementFailuresTotal ?? record.placement_failures_total
    ),
    capacity: asNumber(record.capacity),
    inFlight: asNumber(record.inFlight ?? record.in_flight),
    updatedAt: asNumber(record.updatedAt ?? record.updated_at),
    heartbeatIntervalMs: asNumber(record.heartbeatIntervalMs ?? record.heartbeat_interval_ms),
    backendClass: asBackendClass(record.backendClass ?? record.backend_class),
    specializations: asStringArray(record.specializations),
    connectivity: asRecord(record.connectivity)
      ? {
          mode: asConnectivityMode(asRecord(record.connectivity)?.mode),
          overlay: asOverlay(asRecord(record.connectivity)?.overlay),
          endpoint: asString(asRecord(record.connectivity)?.endpoint),
          reachability: asReachability(asRecord(record.connectivity)?.reachability),
          checkedAt: asNumber(
            asRecord(record.connectivity)?.checkedAt ?? asRecord(record.connectivity)?.checked_at
          ),
          source:
            (asString(asRecord(record.connectivity)?.source) as NonNullable<
              BackendPoolEntry["connectivity"]
            >["source"]) ?? null,
          reason: asString(asRecord(record.connectivity)?.reason),
        }
      : null,
    lease: asRecord(record.lease)
      ? {
          status: asLeaseStatus(asRecord(record.lease)?.status) ?? "none",
          leaseId: asString(asRecord(record.lease)?.leaseId ?? asRecord(record.lease)?.lease_id),
          holderId: asString(asRecord(record.lease)?.holderId ?? asRecord(record.lease)?.holder_id),
          scope:
            (asString(asRecord(record.lease)?.scope) as NonNullable<
              BackendPoolEntry["lease"]
            >["scope"]) ?? null,
          acquiredAt: asNumber(
            asRecord(record.lease)?.acquiredAt ?? asRecord(record.lease)?.acquired_at
          ),
          expiresAt: asNumber(
            asRecord(record.lease)?.expiresAt ?? asRecord(record.lease)?.expires_at
          ),
          ttlMs: asNumber(asRecord(record.lease)?.ttlMs ?? asRecord(record.lease)?.ttl_ms),
          observedAt: asNumber(
            asRecord(record.lease)?.observedAt ?? asRecord(record.lease)?.observed_at
          ),
        }
      : null,
    diagnostics: asRecord(record.diagnostics)
      ? {
          availability:
            (asString(asRecord(record.diagnostics)?.availability) as NonNullable<
              BackendPoolEntry["diagnostics"]
            >["availability"]) ?? null,
          summary: asString(asRecord(record.diagnostics)?.summary),
          reasons: asStringArray(asRecord(record.diagnostics)?.reasons),
          degraded: asBoolean(asRecord(record.diagnostics)?.degraded),
          heartbeatAgeMs: asNumber(
            asRecord(record.diagnostics)?.heartbeatAgeMs ??
              asRecord(record.diagnostics)?.heartbeat_age_ms
          ),
          lastHeartbeatAt: asNumber(
            asRecord(record.diagnostics)?.lastHeartbeatAt ??
              asRecord(record.diagnostics)?.last_heartbeat_at
          ),
          reachability: asReachability(asRecord(record.diagnostics)?.reachability),
          leaseStatus: asLeaseStatus(
            asRecord(record.diagnostics)?.leaseStatus ?? asRecord(record.diagnostics)?.lease_status
          ),
        }
      : null,
    policy: asRecord(record.policy)
      ? {
          trustTier: asTrustTier(asRecord(record.policy)?.trustTier),
          dataSensitivity: asDataSensitivity(asRecord(record.policy)?.dataSensitivity),
          approvalPolicy: asApprovalPolicy(asRecord(record.policy)?.approvalPolicy),
          allowedToolClasses: asAllowedToolClasses(asRecord(record.policy)?.allowedToolClasses),
        }
      : null,
    tcpOverlay: asTcpOverlay(
      record.tcpOverlay ??
        record.tcp_overlay ??
        asRecord(record.connectivity)?.overlay ??
        asRecord(record.metadata)?.tcpOverlay
    ),
    metadata: asRecord(record.metadata),
  };
}

function readBackends(record: Record<string, unknown>): unknown[] {
  const candidates = [
    record.backends,
    record.items,
    record.list,
    record.entries,
    record.pool,
    record.data,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  return [];
}

export function normalizeBackendPoolSnapshot(value: unknown): BackendPoolSnapshot | null {
  const rootArray = Array.isArray(value) ? value : null;
  const rootRecord = asRecord(value);
  const rawBackends = rootArray ?? (rootRecord ? readBackends(rootRecord) : []);

  const backends = rawBackends
    .map((entry, index) => normalizeBackendEntry(entry, index))
    .filter((entry): entry is BackendPoolEntry => Boolean(entry));

  if (backends.length === 0 && !rootRecord) {
    return null;
  }

  const backendsTotal =
    asNumber(rootRecord?.backendsTotal ?? rootRecord?.backends_total) ?? backends.length;
  const backendsHealthy =
    asNumber(rootRecord?.backendsHealthy ?? rootRecord?.backends_healthy) ??
    backends.filter((backend) => backend.healthy !== false && backend.state !== "degraded").length;
  const backendsDraining =
    asNumber(rootRecord?.backendsDraining ?? rootRecord?.backends_draining) ??
    backends.filter((backend) => backend.state === "draining").length;
  const placementFailuresTotal =
    asNumber(rootRecord?.placementFailuresTotal ?? rootRecord?.placement_failures_total) ??
    backends.reduce((total, backend) => total + (backend.placementFailuresTotal ?? 0), 0);
  const queueDepth =
    asNumber(rootRecord?.queueDepth ?? rootRecord?.queue_depth) ??
    backends.reduce<number | null>((total, backend) => {
      if (backend.queueDepth === null || backend.queueDepth === undefined) {
        return total;
      }
      return (total ?? 0) + backend.queueDepth;
    }, null);

  return {
    backends,
    backendsTotal,
    backendsHealthy,
    backendsDraining,
    placementFailuresTotal,
    queueDepth,
    updatedAt: asNumber(rootRecord?.updatedAt ?? rootRecord?.updated_at),
  };
}

import { describe, expect, it } from "vitest";
import { normalizeBackendPoolSnapshot } from "./backendPool";

describe("normalizeBackendPoolSnapshot", () => {
  it("normalizes backend pool entries with contract, connectivity, lease, and diagnostics fields", () => {
    const snapshot = normalizeBackendPoolSnapshot({
      backends: [
        {
          backend_id: "backend-specialized-gpu",
          display_name: "GPU Backend",
          state: "degraded",
          healthy: false,
          backend_class: "specialized",
          specializations: ["gpu", "vision"],
          heartbeat_interval_ms: 15_000,
          queue_depth: 2,
          placement_failures_total: 3,
          contract: {
            kind: "acp",
            origin: "acp-projection",
            transport: "http",
            capabilityCount: 4,
            health: "active",
            rolloutState: "current",
            backendClass: "specialized",
            reachability: "degraded",
            leaseStatus: "expiring",
          },
          connectivity: {
            mode: "overlay",
            overlay: "tailscale",
            endpoint: "gpu.tailnet.ts.net:4732",
            reachability: "degraded",
            checked_at: 111,
            source: "probe",
            reason: "high_latency",
          },
          lease: {
            status: "expiring",
            lease_id: "lease-123",
            holder_id: "node-specialized",
            scope: "node",
            acquired_at: 100,
            expires_at: 200,
            ttl_ms: 300,
            observed_at: 150,
          },
          diagnostics: {
            availability: "degraded",
            summary: "Overlay reachable but stale heartbeat",
            reasons: ["connectivity_degraded", "heartbeat_stale"],
            degraded: true,
            heartbeat_age_ms: 45_000,
            last_heartbeat_at: 99,
            reachability: "degraded",
            lease_status: "expiring",
          },
          metadata: {
            region: "us-central",
          },
        },
      ],
      backends_total: 1,
      backends_healthy: 0,
      backends_draining: 0,
      placement_failures_total: 3,
      queue_depth: 2,
      updated_at: 222,
    });

    expect(snapshot).toEqual({
      backends: [
        {
          backendId: "backend-specialized-gpu",
          label: "GPU Backend",
          capabilities: null,
          maxConcurrency: null,
          costTier: null,
          latencyClass: null,
          rolloutState: null,
          status: null,
          provider: null,
          state: "degraded",
          backendKind: null,
          integrationId: null,
          transport: null,
          httpExperimental: null,
          origin: null,
          contract: {
            kind: "acp",
            origin: "acp-projection",
            transport: "http",
            capabilityCount: 4,
            health: "active",
            rolloutState: "current",
            backendClass: "specialized",
            reachability: "degraded",
            leaseStatus: "expiring",
          },
          healthy: false,
          lastError: null,
          lastProbeAt: null,
          queueDepth: 2,
          placementFailuresTotal: 3,
          capacity: null,
          inFlight: null,
          updatedAt: null,
          heartbeatIntervalMs: 15_000,
          backendClass: "specialized",
          specializations: ["gpu", "vision"],
          connectivity: {
            mode: "overlay",
            overlay: "tailscale",
            endpoint: "gpu.tailnet.ts.net:4732",
            reachability: "degraded",
            checkedAt: 111,
            source: "probe",
            reason: "high_latency",
          },
          lease: {
            status: "expiring",
            leaseId: "lease-123",
            holderId: "node-specialized",
            scope: "node",
            acquiredAt: 100,
            expiresAt: 200,
            ttlMs: 300,
            observedAt: 150,
          },
          diagnostics: {
            availability: "degraded",
            summary: "Overlay reachable but stale heartbeat",
            reasons: ["connectivity_degraded", "heartbeat_stale"],
            degraded: true,
            heartbeatAgeMs: 45_000,
            lastHeartbeatAt: 99,
            reachability: "degraded",
            leaseStatus: "expiring",
          },
          policy: null,
          tcpOverlay: "tailscale",
          metadata: {
            region: "us-central",
          },
        },
      ],
      backendsTotal: 1,
      backendsHealthy: 0,
      backendsDraining: 0,
      placementFailuresTotal: 3,
      queueDepth: 2,
      updatedAt: 222,
    });
  });

  it("derives aggregate counts when only backend entries are provided", () => {
    const snapshot = normalizeBackendPoolSnapshot([
      {
        backendId: "backend-primary-home",
        label: "Primary Home Backend",
        state: "enabled",
        healthy: true,
        queueDepth: 1,
        placementFailuresTotal: 0,
      },
      {
        backendId: "backend-burst-laptop",
        label: "Burst Laptop Backend",
        state: "draining",
        healthy: true,
        queueDepth: 2,
        placementFailuresTotal: 1,
      },
      {
        backendId: "backend-stale",
        label: "Stale Backend",
        state: "degraded",
        healthy: false,
      },
    ]);

    expect(snapshot).toEqual({
      backends: [
        expect.objectContaining({ backendId: "backend-primary-home", state: "enabled" }),
        expect.objectContaining({ backendId: "backend-burst-laptop", state: "draining" }),
        expect.objectContaining({ backendId: "backend-stale", state: "degraded" }),
      ],
      backendsTotal: 3,
      backendsHealthy: 2,
      backendsDraining: 1,
      placementFailuresTotal: 1,
      queueDepth: 3,
      updatedAt: null,
    });
  });

  it("returns null for non-object non-array payloads", () => {
    expect(normalizeBackendPoolSnapshot("invalid payload")).toBeNull();
  });
});

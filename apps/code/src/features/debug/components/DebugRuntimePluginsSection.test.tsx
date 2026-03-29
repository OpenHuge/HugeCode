// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DebugRuntimePluginsSection } from "./DebugRuntimePluginsSection";

describe("DebugRuntimePluginsSection", () => {
  it("renders plugin entries and projection state", () => {
    render(
      <DebugRuntimePluginsSection
        loading={false}
        error={null}
        projectionBacked
        registry={{
          packages: [],
          installedCount: 0,
          verifiedCount: 0,
          blockedCount: 0,
          error: null,
        }}
        composition={{
          profiles: [],
          activeProfileId: null,
          activeProfile: null,
          resolution: null,
          error: null,
        }}
        plugins={[
          {
            id: "ext-1",
            name: "Test Plugin",
            version: "1.0.0",
            summary: null,
            source: "runtime_extension",
            transport: "runtime_extension",
            hostProfile: {
              kind: "runtime",
              executionBoundaries: ["runtime"],
            },
            workspaceId: "workspace-1",
            enabled: true,
            runtimeBacked: true,
            capabilities: [{ id: "tool:bash", enabled: true }],
            permissions: ["network"],
            resources: [],
            executionBoundaries: ["runtime"],
            binding: {
              state: "bound",
              contractFormat: "runtime_extension",
              contractBoundary: "runtime-extension-record",
              interfaceId: "ext-1",
              surfaces: [
                {
                  id: "ext-1",
                  kind: "extension",
                  direction: "export",
                  summary: "Runtime extension record exported through the kernel plugin catalog.",
                },
              ],
            },
            operations: {
              execution: {
                executable: false,
                mode: "none",
                reason:
                  "Plugin `ext-1` is bound for catalog/resource access only and does not expose an execution provider.",
              },
              resources: {
                readable: true,
                mode: "runtime_extension_resource",
                reason: null,
              },
              permissions: {
                evaluable: true,
                mode: "runtime_extension_permissions",
                reason: null,
              },
            },
            metadata: null,
            permissionDecision: null,
            health: null,
          },
        ]}
      />
    );

    expect(screen.getByTestId("debug-runtime-plugins")).toBeTruthy();
    expect(screen.getByText(/projection extensions: connected/i)).toBeTruthy();
    expect(screen.getByText(/Test Plugin \(1\.0\.0\)/)).toBeTruthy();
    expect(screen.getByText("network")).toBeTruthy();
    expect(screen.getByText("bound")).toBeTruthy();
    expect(screen.getByText("blocked")).toBeTruthy();
    expect(screen.getByText("readable")).toBeTruthy();
    expect(screen.getByText("evaluable")).toBeTruthy();
    expect(screen.getByText("export:extension:ext-1")).toBeTruthy();
    expect(
      screen.getByText(/catalog\/resource access only and does not expose an execution provider/i)
    ).toBeTruthy();
    expect(screen.getByText("runtime-extension-record")).toBeTruthy();
  });

  it("renders routing plugin metadata alongside execution contract surfaces", () => {
    render(
      <DebugRuntimePluginsSection
        loading={false}
        error={null}
        projectionBacked={false}
        registry={{
          packages: [],
          installedCount: 1,
          verifiedCount: 1,
          blockedCount: 0,
          error: null,
        }}
        composition={{
          profiles: [],
          activeProfileId: "workspace-default",
          activeProfile: {
            id: "workspace-default",
            name: "Workspace Default",
            scope: "workspace",
            enabled: true,
            pluginSelectors: [],
            routePolicy: {
              preferredRoutePluginIds: [],
              providerPreference: [],
              allowRuntimeFallback: true,
            },
            backendPolicy: {
              preferredBackendIds: ["backend-primary"],
              resolvedBackendId: null,
            },
            trustPolicy: {
              requireVerifiedSignatures: true,
              allowDevOverrides: false,
              blockedPublishers: [],
            },
            executionPolicyRefs: [],
            observabilityPolicy: {
              emitStableEvents: true,
              emitOtelAlignedTelemetry: true,
            },
            configLayers: [],
          },
          resolution: {
            selectedPlugins: [
              {
                pluginId: "route:openai",
                packageRef: "hugecode.mcp.search@1.0.0",
                source: "execution_route",
                reason: null,
              },
            ],
            selectedRouteCandidates: [
              {
                pluginId: "route:openai",
                routeKind: "combined_execution",
                providerId: "openai",
                preferredBackendIds: ["backend-primary"],
                resolvedBackendId: "backend-primary",
              },
            ],
            selectedBackendCandidates: [
              {
                backendId: "backend-primary",
                sourcePluginId: "route:openai",
              },
            ],
            blockedPlugins: [],
            trustDecisions: [],
            provenance: {
              activeProfileId: "workspace-default",
              activeProfileName: "Workspace Default",
              appliedLayerOrder: ["built_in", "user", "workspace", "launch_override"],
              selectorDecisions: {},
            },
          },
          error: null,
        }}
        plugins={[
          {
            id: "route:openai",
            name: "OpenAI Route",
            version: "routing",
            summary: null,
            source: "execution_route",
            transport: "execution_route",
            hostProfile: {
              kind: "routing",
              executionBoundaries: ["routing", "runtime"],
            },
            workspaceId: null,
            enabled: true,
            runtimeBacked: true,
            capabilities: [],
            permissions: [],
            resources: [],
            executionBoundaries: ["routing", "runtime"],
            binding: {
              state: "bound",
              contractFormat: "route",
              contractBoundary: "runtime-routing",
              interfaceId: "route:openai",
              surfaces: [
                {
                  id: "route:openai",
                  kind: "route",
                  direction: "export",
                  summary: "Route selection surface.",
                },
              ],
            },
            operations: {
              execution: {
                executable: true,
                mode: "execution_route",
                reason: null,
              },
              resources: {
                readable: false,
                mode: "none",
                reason:
                  "Route plugins do not expose readable resources through the runtime kernel.",
              },
              permissions: {
                evaluable: false,
                mode: "none",
                reason: "Route plugins do not publish runtime-evaluable permission state.",
              },
            },
            metadata: {
              routeKind: "combined_execution",
              routeValue: "openai",
              readiness: "ready",
              launchAllowed: true,
              detail: "OpenAI route is ready for launch.",
              providerId: "openai",
              oauthProviderId: "codex",
              pool: "codex",
              preferredBackendIds: ["backend-primary"],
              resolvedBackendId: "backend-primary",
              provenance: "backend_preference",
              pluginRegistry: {
                packageRef: "hugecode.mcp.search@1.0.0",
                transport: "mcp_remote",
                source: "installed",
                installed: true,
                installedPluginId: "route:openai",
                publisher: "HugeCode Labs",
                trust: {
                  status: "verified",
                  verificationStatus: "verified",
                  publisher: "HugeCode Labs",
                  attestationSource: "sigstore",
                  blockedReason: null,
                  packageRef: "hugecode.mcp.search@1.0.0",
                  pluginId: "route:openai",
                },
                compatibility: {
                  status: "compatible",
                  minimumHostContractVersion: "2026-03-25",
                  supportedRuntimeProtocolVersions: ["2026-03-25"],
                  supportedCapabilityKeys: ["plugins.catalog"],
                  optionalTransportFeatures: [],
                  blockers: [],
                },
              },
              composition: {
                activeProfileId: "workspace-default",
                activeProfileName: "Workspace Default",
                selectedInActiveProfile: true,
                blockedInActiveProfile: false,
                blockedReason: null,
                selectedRouteCandidate: true,
                selectedBackendCandidateIds: ["backend-primary"],
                layerOrder: ["built_in", "user", "workspace", "launch_override"],
              },
            },
            permissionDecision: "unsupported",
            health: {
              state: "healthy",
              checkedAt: null,
              warnings: [],
            },
          },
        ]}
      />
    );

    expect(screen.getByText(/OpenAI Route \(routing\)/)).toBeTruthy();
    expect(
      screen.getByText(/registry packages: 1 installed \| 1 verified \| 0 blocked/i)
    ).toBeTruthy();
    expect(
      screen.getByText(
        /active profile: Workspace Default \| routes selected: 1 \| backends selected: 1/i
      )
    ).toBeTruthy();
    expect(screen.getByText("export:route:route:openai")).toBeTruthy();
    expect(screen.getAllByText("execution_route")).toHaveLength(3);
    expect(screen.getByText("backend_preference")).toBeTruthy();
    expect(screen.getAllByText("backend-primary")).toHaveLength(3);
    expect(screen.getByText("codex")).toBeTruthy();
    expect(screen.getByText("hugecode.mcp.search@1.0.0")).toBeTruthy();
    expect(screen.getAllByText("verified").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("workspace-default")).toBeTruthy();
  });
});

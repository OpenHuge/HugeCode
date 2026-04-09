import type { RuntimeRegistryPackageDescriptor } from "@ku0/code-runtime-host-contract";
import {
  readRuntimeControlPlanePluginCompositionMetadata,
  readRuntimeControlPlanePluginRegistryMetadata,
  type RuntimeControlPlanePluginCompositionMetadata,
  type RuntimeControlPlanePluginRegistryMetadata,
} from "../runtimeControlPlaneOperatorModel";
import {
  buildRuntimeKernelPluginReadinessEntries,
  buildRuntimeKernelPluginReadinessSections,
} from "./runtimeKernelPluginReadiness";
import {
  readRuntimeControlPlaneRoutingPluginMetadata,
  type RuntimeKernelPluginReadinessBadge,
  type RuntimeKernelPluginReadinessEntry,
  type RuntimeKernelPluginReadinessSection,
  type RuntimeKernelPluginReadinessState,
  type RuntimeKernelPluginReadinessTone,
  type RuntimeMissionControlActivationReadiness,
  type RuntimeMissionControlActivationRecord,
  type RuntimeMissionControlPluginCatalogStatus,
  type RuntimeMissionControlPluginCatalogSummary,
  type RuntimeMissionControlPluginDescriptor,
  type RuntimeMissionControlPluginSource,
} from "./runtimeMissionControlPluginCatalogTypes";

export function buildRuntimeMissionControlPluginCatalogSummary(input: {
  plugins: RuntimeMissionControlPluginDescriptor[];
  error: string | null;
  projectionBacked: boolean;
  registryPackages?: Array<Pick<RuntimeRegistryPackageDescriptor, "source">>;
}): RuntimeMissionControlPluginCatalogSummary {
  const summary: RuntimeMissionControlPluginCatalogSummary = {
    status: {
      label: "Empty",
      tone: "neutral",
    },
    plugins: input.plugins,
    readinessEntries: buildRuntimeKernelPluginReadinessEntries(input.plugins),
    readinessSections: [],
    total: input.plugins.length,
    enabled: 0,
    runtimeBacked: 0,
    executableCount: 0,
    nonExecutableCount: 0,
    readableResourceCount: 0,
    permissionEvaluableCount: 0,
    contractSurfaceCount: 0,
    contractImportSurfaceCount: 0,
    contractExportSurfaceCount: 0,
    boundCount: 0,
    declarationOnlyCount: 0,
    unboundCount: 0,
    runtimeExtensionCount: 0,
    liveSkillCount: 0,
    repoManifestCount: 0,
    routingCount: 0,
    providerRouteCount: 0,
    backendRouteCount: 0,
    executionRouteCount: 0,
    externalPackageCount: 0,
    verifiedPackageCount: 0,
    blockedPackageCount: 0,
    selectedInActiveProfileCount: 0,
    readyRouteCount: 0,
    attentionRouteCount: 0,
    blockedRouteCount: 0,
    unsupportedHostCount: 0,
    healthyCount: 0,
    degradedCount: 0,
    unsupportedCount: 0,
    readyCount: 0,
    attentionCount: 0,
    blockedCount: 0,
    projectionBacked: input.projectionBacked,
    error: input.error,
  };

  for (const [index, plugin] of input.plugins.entries()) {
    const readinessEntry = summary.readinessEntries[index];
    if (plugin.enabled) {
      summary.enabled += 1;
    }
    if (plugin.runtimeBacked) {
      summary.runtimeBacked += 1;
    }
    if (plugin.operations.execution.executable) {
      summary.executableCount += 1;
    } else {
      summary.nonExecutableCount += 1;
    }
    if (plugin.operations.resources.readable) {
      summary.readableResourceCount += 1;
    }
    if (plugin.operations.permissions.evaluable) {
      summary.permissionEvaluableCount += 1;
    }
    summary.contractSurfaceCount += plugin.binding.surfaces.length;
    for (const surface of plugin.binding.surfaces) {
      if (surface.direction === "import") {
        summary.contractImportSurfaceCount += 1;
      } else {
        summary.contractExportSurfaceCount += 1;
      }
    }
    if (plugin.binding.state === "bound") {
      summary.boundCount += 1;
    } else if (plugin.binding.state === "declaration_only") {
      summary.declarationOnlyCount += 1;
    } else if (plugin.binding.state === "unbound") {
      summary.unboundCount += 1;
    }
    if (plugin.source === "runtime_extension") {
      summary.runtimeExtensionCount += 1;
    } else if (plugin.source === "live_skill") {
      summary.liveSkillCount += 1;
    } else if (plugin.source === "repo_manifest") {
      summary.repoManifestCount += 1;
    } else if (
      plugin.source === "mcp_remote" ||
      plugin.source === "wasi_component" ||
      plugin.source === "a2a_remote" ||
      plugin.source === "host_bridge"
    ) {
      summary.externalPackageCount += 1;
    } else if (
      plugin.source === "provider_route" ||
      plugin.source === "backend_route" ||
      plugin.source === "execution_route"
    ) {
      summary.routingCount += 1;
      if (plugin.source === "provider_route") {
        summary.providerRouteCount += 1;
      } else if (plugin.source === "backend_route") {
        summary.backendRouteCount += 1;
      } else {
        summary.executionRouteCount += 1;
      }
      const routingMetadata = readRuntimeControlPlaneRoutingPluginMetadata(plugin.metadata);
      if (routingMetadata?.readiness === "ready") {
        summary.readyRouteCount += 1;
      } else if (routingMetadata?.readiness === "attention") {
        summary.attentionRouteCount += 1;
      } else if (routingMetadata?.readiness === "blocked") {
        summary.blockedRouteCount += 1;
      }
    } else {
      summary.unsupportedHostCount += 1;
    }

    const registryMetadata = readRuntimeControlPlanePluginRegistryMetadata(plugin.metadata);
    if (
      registryMetadata?.trust.status === "verified" ||
      registryMetadata?.trust.status === "runtime_managed"
    ) {
      summary.verifiedPackageCount += 1;
    } else if (registryMetadata?.trust.status === "blocked") {
      summary.blockedPackageCount += 1;
    }

    const compositionMetadata = readRuntimeControlPlanePluginCompositionMetadata(plugin.metadata);
    if (compositionMetadata?.selectedInActiveProfile) {
      summary.selectedInActiveProfileCount += 1;
    }

    if (plugin.health?.state === "healthy") {
      summary.healthyCount += 1;
    } else if (plugin.health?.state === "degraded") {
      summary.degradedCount += 1;
    } else if (plugin.health?.state === "unsupported") {
      summary.unsupportedCount += 1;
    }

    if (readinessEntry?.readiness.state === "ready") {
      summary.readyCount += 1;
    } else if (readinessEntry?.readiness.state === "attention") {
      summary.attentionCount += 1;
    } else if (readinessEntry?.readiness.state === "blocked") {
      summary.blockedCount += 1;
    }
  }

  summary.externalPackageCount = Math.max(
    summary.externalPackageCount,
    (input.registryPackages ?? []).filter((entry) => entry.source !== "runtime_managed").length
  );
  summary.readinessSections = buildRuntimeKernelPluginReadinessSections(summary.readinessEntries);
  summary.status = input.error
    ? {
        label: "Attention",
        tone: "warning",
      }
    : summary.executableCount > 0
      ? {
          label: "Ready",
          tone: "success",
        }
      : summary.total > 0
        ? {
            label: "Cataloged",
            tone: "neutral",
          }
        : {
            label: "Empty",
            tone: "neutral",
          };

  return summary;
}

export {
  buildRuntimeKernelPluginReadinessEntries,
  buildRuntimeKernelPluginReadinessSections,
  readRuntimeControlPlaneRoutingPluginMetadata,
};

export type {
  RuntimeControlPlanePluginCompositionMetadata,
  RuntimeControlPlanePluginRegistryMetadata,
  RuntimeKernelPluginReadinessBadge,
  RuntimeKernelPluginReadinessEntry,
  RuntimeKernelPluginReadinessSection,
  RuntimeKernelPluginReadinessState,
  RuntimeKernelPluginReadinessTone,
  RuntimeMissionControlActivationReadiness,
  RuntimeMissionControlActivationRecord,
  RuntimeMissionControlPluginCatalogStatus,
  RuntimeMissionControlPluginCatalogSummary,
  RuntimeMissionControlPluginDescriptor,
  RuntimeMissionControlPluginSource,
};

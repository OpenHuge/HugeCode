import type {
  KernelCapabilityDescriptor,
  KernelExtensionBundle,
  RuntimeCompositionResolveV2Response,
  RuntimeCompositionResolution,
  RuntimeRegistryPackageDescriptor,
} from "@ku0/code-runtime-host-contract";
import {
  normalizeRuntimeHostCapabilityPluginDescriptor,
  type RuntimeKernelPluginDescriptor,
} from "../kernel/runtimeKernelPlugins";
import { createRuntimeKernelPluginCompositionMetadata } from "../kernel/runtimeKernelComposition";
import {
  createRuntimeKernelPluginRegistryMetadata,
  normalizeRuntimeRegistryPackagePluginDescriptor,
} from "../kernel/runtimeKernelPluginRegistry";

function readOptionalText(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function normalizeKernelExtensionBundlePluginDescriptor(
  bundle: KernelExtensionBundle
): RuntimeKernelPluginDescriptor {
  const metadata = bundle.metadata ?? {};

  return {
    id: bundle.id,
    name: bundle.name,
    version: readOptionalText(metadata.version) ?? "unknown",
    summary: readOptionalText(metadata.summary),
    source: "runtime_extension",
    transport: "runtime_extension",
    hostProfile: {
      kind: "runtime",
      executionBoundaries: ["runtime"],
    },
    workspaceId: bundle.workspaceId,
    enabled: bundle.enabled,
    runtimeBacked: true,
    capabilities: [],
    permissions: [],
    resources: [],
    executionBoundaries: ["runtime"],
    binding: {
      state: "bound",
      contractFormat: "runtime_extension",
      contractBoundary: "kernel-extension-bundle",
      interfaceId: bundle.id,
      surfaces: [
        {
          id: bundle.id,
          kind: "extension",
          direction: "export",
          summary: "Kernel projection export for a runtime extension bundle.",
        },
      ],
    },
    operations: {
      execution: {
        executable: false,
        mode: "none",
        reason: `Plugin \`${bundle.id}\` is bound for catalog/resource access only and does not expose an execution provider.`,
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
    metadata: {
      ...metadata,
      kernelExtensionBundle: {
        transport: bundle.transport,
        toolCount: bundle.toolCount,
        resourceCount: bundle.resourceCount,
        surfaces: bundle.surfaces,
        installedAt: bundle.installedAt,
        updatedAt: bundle.updatedAt,
      },
    },
    permissionDecision: null,
    health: null,
  };
}

export function mergeRuntimeKernelProjectionPlugins(input: {
  extensionBundles: KernelExtensionBundle[] | null;
  capabilities: KernelCapabilityDescriptor[] | null;
  capabilityPlugins: RuntimeKernelPluginDescriptor[];
  registryPackages?: RuntimeRegistryPackageDescriptor[] | null;
  compositionResolution?: RuntimeCompositionResolution | null;
  compositionSnapshot?: RuntimeCompositionResolveV2Response | null;
}): RuntimeKernelPluginDescriptor[] {
  const merged = new Map<string, RuntimeKernelPluginDescriptor>();

  for (const plugin of input.capabilityPlugins) {
    merged.set(plugin.id, plugin);
  }

  for (const capability of input.capabilities ?? []) {
    const hostPlugin = normalizeRuntimeHostCapabilityPluginDescriptor(capability);
    if (!hostPlugin) {
      continue;
    }
    const existing = merged.get(hostPlugin.id);
    if (!existing || !existing.runtimeBacked) {
      merged.set(hostPlugin.id, hostPlugin);
      continue;
    }
    merged.set(hostPlugin.id, {
      ...existing,
      ...hostPlugin,
      metadata: {
        ...(existing.metadata ?? {}),
        ...(hostPlugin.metadata ?? {}),
      },
    });
  }

  for (const bundle of input.extensionBundles ?? []) {
    const projectionPlugin = normalizeKernelExtensionBundlePluginDescriptor(bundle);
    const existing = merged.get(bundle.id);

    if (!existing || existing.source !== "runtime_extension") {
      merged.set(bundle.id, projectionPlugin);
      continue;
    }

    merged.set(bundle.id, {
      ...existing,
      name: projectionPlugin.name,
      enabled: projectionPlugin.enabled,
      workspaceId: projectionPlugin.workspaceId,
      metadata: {
        ...(existing.metadata ?? {}),
        ...(projectionPlugin.metadata ?? {}),
      },
    });
  }

  for (const packageDescriptor of input.registryPackages ?? []) {
    if (packageDescriptor.installedPluginId && merged.has(packageDescriptor.installedPluginId)) {
      const existing = merged.get(packageDescriptor.installedPluginId);
      if (existing) {
        merged.set(packageDescriptor.installedPluginId, {
          ...existing,
          metadata: {
            ...(existing.metadata ?? {}),
            pluginRegistry: createRuntimeKernelPluginRegistryMetadata(packageDescriptor),
            packageManifest: packageDescriptor.manifest,
          },
        });
      }
      continue;
    }
    if (packageDescriptor.source === "runtime_managed") {
      continue;
    }
    const registryPlugin = normalizeRuntimeRegistryPackagePluginDescriptor(packageDescriptor);
    const existing = merged.get(registryPlugin.id);
    if (!existing) {
      merged.set(registryPlugin.id, registryPlugin);
      continue;
    }
    merged.set(registryPlugin.id, {
      ...existing,
      metadata: {
        ...(existing.metadata ?? {}),
        ...(registryPlugin.metadata ?? {}),
      },
    });
  }

  const compositionResolution = input.compositionResolution ?? null;
  const withComposition = [...merged.values()].map((plugin) => ({
    ...plugin,
    metadata: {
      ...(plugin.metadata ?? {}),
      ...(compositionResolution
        ? {
            composition: createRuntimeKernelPluginCompositionMetadata(
              plugin.id,
              compositionResolution,
              input.compositionSnapshot ?? null
            ),
          }
        : {}),
    },
  }));

  return withComposition.sort((left, right) => left.id.localeCompare(right.id));
}

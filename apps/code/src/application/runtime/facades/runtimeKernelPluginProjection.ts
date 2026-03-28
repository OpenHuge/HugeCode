import type { KernelExtensionBundle } from "@ku0/code-runtime-host-contract";
import { type RuntimeKernelPluginDescriptor } from "../kernel/runtimeKernelPlugins";

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
  capabilityPlugins: RuntimeKernelPluginDescriptor[];
}): RuntimeKernelPluginDescriptor[] {
  const merged = new Map<string, RuntimeKernelPluginDescriptor>();

  for (const plugin of input.capabilityPlugins) {
    merged.set(plugin.id, plugin);
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

  return [...merged.values()].sort((left, right) => left.id.localeCompare(right.id));
}

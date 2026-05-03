import type { ModelProvider } from "@ku0/code-runtime-host-contract";

import type {
  T3CodeProviderKind,
  T3CodeProviderModel,
  T3CodeProviderModelOption,
  T3CodeProviderModelOptionsByProvider,
  T3CodeProviderRoute,
  T3CodeProviderAuthState,
} from "./index";

export type T3CodeServerProviderState = "ready" | "warning" | "error" | "disabled";

export type T3CodeServerProviderAvailability = "available" | "unavailable";

export type T3CodeProviderOptionSelectDescriptor = {
  currentValue?: string;
  id: string;
  label: string;
  options: Array<{
    id: string;
    isDefault?: boolean;
    label: string;
  }>;
  promptInjectedValues?: string[];
  type: "select";
};

export type T3CodeProviderOptionBooleanDescriptor = {
  currentValue?: boolean;
  id: string;
  label: string;
  type: "boolean";
};

export type T3CodeProviderOptionDescriptor =
  | T3CodeProviderOptionSelectDescriptor
  | T3CodeProviderOptionBooleanDescriptor;

export type T3CodeServerProviderModel = {
  capabilities: {
    optionDescriptors: T3CodeProviderOptionDescriptor[];
  };
  isCustom: boolean;
  name: string;
  runtimeProvider?: ModelProvider;
  shortName?: string;
  slug: string;
  subProvider?: string;
};

export type T3CodeServerProvider = {
  auth: {
    label?: string;
    status: T3CodeProviderAuthState;
    type?: string;
  };
  accentColor?: string;
  availability: T3CodeServerProviderAvailability;
  checkedAt: string;
  continuation?: {
    groupKey: string;
  };
  displayName: string;
  driver: T3CodeProviderKind;
  enabled: boolean;
  instanceId: string;
  installed: boolean;
  message?: string;
  models: T3CodeServerProviderModel[];
  provider: T3CodeProviderKind;
  showInteractionModeToggle: boolean;
  skills: [];
  slashCommands: [];
  status: T3CodeServerProviderState;
  version: string | null;
};

export type T3CodeProviderModelOptionsByInstance = Record<string, T3CodeProviderModelOption[]>;

export const DEFAULT_CODEX_CONTEXT_WINDOWS = ["auto", "large", "max"] as const;

const DEFAULT_CODEX_AGENT_MODES = ["auto", "codex", "codex-max"] as const;

const SERVER_PROVIDER_DISPLAY_NAMES = {
  codex: "Codex",
  claudeAgent: "Claude",
} as const satisfies Record<T3CodeProviderKind, string>;

const SERVER_PROVIDER_ACCENT_COLORS = {
  codex: "#10A37F",
  claudeAgent: "#D97706",
} as const satisfies Record<T3CodeProviderKind, string>;

function uniqueStrings(values: readonly string[] | null | undefined): string[] {
  if (!values) {
    return [];
  }
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (trimmed.length === 0 || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

export function contextWindowsFromCapabilities(
  capabilities: readonly string[],
  provider: T3CodeProviderKind
): string[] {
  const explicit = capabilities
    .map((capability) => capability.match(/^context-window:(.+)$/u)?.[1]?.trim())
    .filter((value): value is string => Boolean(value));
  if (explicit.length > 0) {
    return uniqueStrings(explicit);
  }
  if (provider === "codex") {
    return [...DEFAULT_CODEX_CONTEXT_WINDOWS];
  }
  return [];
}

function optionLabel(value: string): string {
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function selectDescriptor(input: {
  currentValue?: string;
  id: string;
  label: string;
  options: readonly string[];
  promptInjectedValues?: readonly string[];
}): T3CodeProviderOptionSelectDescriptor {
  const defaultValue = input.currentValue ?? input.options[0];
  return {
    id: input.id,
    label: input.label,
    options: input.options.map((option) => ({
      id: option,
      label: optionLabel(option),
      ...(option === defaultValue ? { isDefault: true } : {}),
    })),
    ...(defaultValue ? { currentValue: defaultValue } : {}),
    ...(input.promptInjectedValues
      ? { promptInjectedValues: [...input.promptInjectedValues] }
      : {}),
    type: "select",
  };
}

function reasoningDescriptor(
  provider: T3CodeProviderKind,
  model: T3CodeProviderModel
): T3CodeProviderOptionSelectDescriptor | null {
  if (!model.supportsReasoning) {
    return null;
  }
  const efforts =
    model.reasoningEfforts.length > 0
      ? model.reasoningEfforts
      : (["medium", "high", "xhigh"] as const);
  return selectDescriptor({
    currentValue: efforts.includes("medium") ? "medium" : efforts[0],
    id: provider === "codex" ? "reasoningEffort" : "effort",
    label: "Reasoning",
    options: efforts,
  });
}

function codexContextWindowDescriptor(
  model: T3CodeProviderModel
): T3CodeProviderOptionSelectDescriptor {
  const contextWindows =
    model.contextWindows && model.contextWindows.length > 0
      ? model.contextWindows
      : [...DEFAULT_CODEX_CONTEXT_WINDOWS];
  return selectDescriptor({
    currentValue: contextWindows.includes("auto") ? "auto" : contextWindows[0],
    id: "contextWindow",
    label: "Context",
    options: contextWindows,
  });
}

function providerOptionDescriptors(
  provider: T3CodeProviderKind,
  model: T3CodeProviderModel
): T3CodeProviderOptionDescriptor[] {
  const descriptors: T3CodeProviderOptionDescriptor[] = [];
  const reasoning = reasoningDescriptor(provider, model);
  if (reasoning) {
    descriptors.push(reasoning);
  }
  if (provider === "codex") {
    descriptors.push(
      codexContextWindowDescriptor(model),
      selectDescriptor({
        currentValue: "auto",
        id: "agent",
        label: "Agent",
        options: DEFAULT_CODEX_AGENT_MODES,
      }),
      {
        currentValue: false,
        id: "fastMode",
        label: "Fast Mode",
        type: "boolean",
      }
    );
  }
  return descriptors;
}

function mapRouteModelToServerProviderModel(
  provider: T3CodeProviderKind,
  model: T3CodeProviderModel
): T3CodeServerProviderModel {
  return {
    capabilities: {
      optionDescriptors: providerOptionDescriptors(provider, model),
    },
    isCustom: model.source !== "fallback" && model.source !== "oauth-account",
    name: model.name,
    runtimeProvider: model.runtimeProvider,
    ...(model.shortName ? { shortName: model.shortName } : {}),
    slug: model.slug,
    ...(model.subProvider ? { subProvider: model.subProvider } : {}),
  };
}

function routeStatusToServerState(
  route: Pick<T3CodeProviderRoute, "installed" | "status">
): T3CodeServerProviderState {
  if (!route.installed) {
    return "disabled";
  }
  if (route.status === "ready") {
    return "ready";
  }
  if (route.status === "blocked") {
    return "error";
  }
  return "warning";
}

function providerInstanceIdForRoute(
  route: Pick<T3CodeProviderRoute, "backendId" | "provider">,
  occurrenceIndex: number,
  providerRouteCount: number
): string {
  if (providerRouteCount <= 1 || occurrenceIndex === 0) {
    return route.provider;
  }
  const backendSlug = route.backendId
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "_")
    .replace(/^_+|_+$/gu, "");
  return `${route.provider}_${backendSlug || occurrenceIndex}`;
}

export function mapT3ProviderRoutesToServerProviders(
  routes: readonly T3CodeProviderRoute[],
  checkedAt = new Date().toISOString()
): T3CodeServerProvider[] {
  const providerRouteCounts = routes.reduce<Record<T3CodeProviderKind, number>>(
    (counts, route) => ({
      ...counts,
      [route.provider]: counts[route.provider] + 1,
    }),
    { codex: 0, claudeAgent: 0 }
  );
  const providerRouteIndexes: Record<T3CodeProviderKind, number> = { codex: 0, claudeAgent: 0 };
  return routes.map((route) => {
    const occurrenceIndex = providerRouteIndexes[route.provider];
    providerRouteIndexes[route.provider] += 1;
    const instanceId = providerInstanceIdForRoute(
      route,
      occurrenceIndex,
      providerRouteCounts[route.provider]
    );
    return {
      auth: {
        label: route.backendLabel,
        status: route.authState,
        type: route.provider === "codex" ? "codex_oauth" : "claude_cli",
      },
      accentColor: SERVER_PROVIDER_ACCENT_COLORS[route.provider],
      availability: route.status === "blocked" ? "unavailable" : "available",
      checkedAt,
      continuation: {
        groupKey: route.provider,
      },
      displayName:
        instanceId === route.provider
          ? SERVER_PROVIDER_DISPLAY_NAMES[route.provider]
          : route.backendLabel,
      driver: route.provider,
      enabled: route.status === "ready" || route.status === "attention",
      instanceId,
      installed: route.installed,
      message: route.summary,
      models: route.models.map((model) =>
        mapRouteModelToServerProviderModel(route.provider, model)
      ),
      provider: route.provider,
      showInteractionModeToggle: true,
      skills: [],
      slashCommands: [],
      status: routeStatusToServerState(route),
      version: null,
    };
  });
}

export function mapT3ServerProvidersToModelOptionsByProvider(
  serverProviders: readonly T3CodeServerProvider[]
): T3CodeProviderModelOptionsByProvider {
  const grouped: T3CodeProviderModelOptionsByProvider = {
    codex: [],
    claudeAgent: [],
  };
  for (const serverProvider of serverProviders) {
    grouped[serverProvider.provider].push(
      ...serverProvider.models.map((model) => ({
        name: model.name,
        ...(model.runtimeProvider ? { runtimeProvider: model.runtimeProvider } : {}),
        ...(model.shortName ? { shortName: model.shortName } : {}),
        slug: model.slug,
        ...(model.subProvider ? { subProvider: model.subProvider } : {}),
      }))
    );
  }
  return grouped;
}

export function mapT3ServerProvidersToModelOptionsByInstance(
  serverProviders: readonly T3CodeServerProvider[]
): T3CodeProviderModelOptionsByInstance {
  return Object.fromEntries(
    serverProviders.map((serverProvider) => [
      serverProvider.instanceId,
      serverProvider.models.map((model) => ({
        name: model.name,
        ...(model.runtimeProvider ? { runtimeProvider: model.runtimeProvider } : {}),
        ...(model.shortName ? { shortName: model.shortName } : {}),
        slug: model.slug,
        ...(model.subProvider ? { subProvider: model.subProvider } : {}),
      })),
    ])
  );
}

import type {
  ActiveInvocationCatalogExecutionPlane,
  InvocationAudience,
  InvocationDescriptor,
  InvocationExecutionBinding,
  InvocationExecutionEvidence,
  InvocationExecutionOutcome,
  InvocationExecutionPlan,
  InvocationExecutionPlacementRationale,
  InvocationExecutionProvenance,
  InvocationHostRequirement,
} from "@ku0/code-runtime-host-contract";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readString(record: Record<string, unknown> | null, key: string): string | null {
  const value = record?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function readStringArray(record: Record<string, unknown> | null, key: string): string[] {
  const value = record?.[key];
  if (!Array.isArray(value)) {
    return [];
  }
  const seen = new Set<string>();
  const entries: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") {
      continue;
    }
    const trimmed = entry.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    entries.push(trimmed);
  }
  return entries;
}

function buildHostRequirements(binding: InvocationExecutionBinding): InvocationHostRequirement[] {
  switch (binding.kind) {
    case "runtime_run":
    case "runtime_live_skill":
      return [
        {
          key: "runtime_service",
          summary: "Requires a reachable runtime service to execute the canonical runtime path.",
        },
      ];
    case "runtime_extension_tool":
      return [
        {
          key: "runtime_service",
          summary: "Requires runtime service availability for extension tool dispatch.",
        },
        {
          key: "extension_bridge",
          summary: "Requires the runtime extension bridge for host-dispatched tool execution.",
        },
      ];
    case "session_message":
    case "approval_response":
      return [
        {
          key: "session_facade",
          summary: "Requires the runtime session command facade for thread-bound actions.",
        },
      ];
    case "prompt_overlay":
      return [
        {
          key: "prompt_library",
          summary: "Requires prompt-library access to resolve operator-facing prompt overlays.",
        },
      ];
    case "unsupported":
      return [];
  }
}

function buildPreflight(descriptor: InvocationDescriptor): InvocationExecutionPlan["preflight"] {
  if (!descriptor.exposure.requiresReadiness) {
    return {
      state: "not_required",
      summary: "This invocation does not require runtime readiness gating before use.",
    };
  }

  if (descriptor.readiness.available) {
    return {
      state: "ready",
      summary:
        descriptor.readiness.reason ??
        `Invocation \`${descriptor.id}\` passed readiness checks and is executable.`,
    };
  }

  return {
    state: "blocked",
    summary:
      descriptor.readiness.reason ?? `Invocation \`${descriptor.id}\` is blocked by readiness.`,
  };
}

function buildPreflightOutcome(
  descriptor: InvocationDescriptor,
  preflight: InvocationExecutionPlan["preflight"]
): InvocationExecutionPlan["preflightOutcome"] {
  return {
    ...preflight,
    required: descriptor.exposure.requiresReadiness,
    readinessState: descriptor.readiness.state,
  };
}

function inferBinding(descriptor: InvocationDescriptor): InvocationExecutionBinding {
  const metadata = asRecord(descriptor.metadata);
  const promptOverlay = asRecord(metadata?.promptOverlay);
  const extensionId = readString(metadata, "extensionId") ?? descriptor.source.sourceId;
  const toolName = descriptor.runtimeTool?.toolName ?? descriptor.title;

  if (descriptor.kind === "plugin") {
    return {
      kind: "unsupported",
      host: descriptor.source.authority,
    };
  }

  if (descriptor.kind === "runtime_tool" && descriptor.source.kind === "runtime_extension") {
    return {
      kind: "runtime_extension_tool",
      host: "runtime",
      extensionId,
      toolName,
    };
  }

  if (
    descriptor.kind === "runtime_tool" &&
    descriptor.runtimeTool?.toolName === "start-runtime-run"
  ) {
    return {
      kind: "runtime_run",
      host: "runtime",
      toolName: descriptor.runtimeTool.toolName,
    };
  }

  if (
    descriptor.kind === "runtime_tool" &&
    descriptor.runtimeTool?.toolName === "run-runtime-live-skill"
  ) {
    return {
      kind: "runtime_live_skill",
      host: "runtime",
      toolName: descriptor.runtimeTool.toolName,
    };
  }

  if (descriptor.kind === "session_command" && promptOverlay) {
    return {
      kind: "prompt_overlay",
      host: descriptor.source.authority,
      promptId: readString(promptOverlay, "promptId"),
    };
  }

  if (descriptor.id === "session:send-message") {
    return {
      kind: "session_message",
      host: "session",
    };
  }

  if (descriptor.id === "session:respond-to-approval") {
    return {
      kind: "approval_response",
      host: "session",
    };
  }

  return {
    kind: "unsupported",
    host: descriptor.source.authority,
    toolName,
  };
}

function buildInvocationProvenance(
  descriptor: InvocationDescriptor,
  execution: InvocationExecutionPlan
): InvocationExecutionProvenance {
  return {
    descriptorKind: descriptor.kind,
    bindingKind: execution.binding.kind,
    sourceKind: descriptor.source.kind,
    sourceId: descriptor.source.sourceId,
    sourceAuthority: descriptor.source.authority,
    executionHost: execution.binding.host,
    toolName: execution.binding.toolName ?? descriptor.runtimeTool?.toolName ?? null,
    extensionId: execution.binding.extensionId ?? null,
    promptId: execution.binding.promptId ?? null,
  };
}

function buildPlacementRationale(
  descriptor: InvocationDescriptor,
  execution: InvocationExecutionPlan
): InvocationExecutionPlacementRationale {
  switch (execution.binding.kind) {
    case "runtime_run":
      return {
        summary:
          "Dispatches through the runtime-run path so launch placement, approvals, and lifecycle stay runtime-owned.",
        reason: descriptor.readiness.reason,
      };
    case "runtime_live_skill":
      return {
        summary:
          "Dispatches through the canonical runtime live-skill path so execution remains inside runtime governance.",
        reason: descriptor.readiness.reason,
      };
    case "runtime_extension_tool":
      return {
        summary:
          "Dispatches through the runtime extension bridge because this invocation targets a runtime-owned extension tool.",
        reason: descriptor.readiness.reason,
      };
    case "session_message":
      return {
        summary:
          "Dispatches through the session facade because this invocation targets the current thread context.",
        reason: descriptor.readiness.reason,
      };
    case "approval_response":
      return {
        summary:
          "Dispatches through the session approval path because this invocation resolves an active operator approval.",
        reason: descriptor.readiness.reason,
      };
    case "prompt_overlay":
      return {
        summary:
          "Resolves through the workspace prompt library because this invocation contributes a prompt overlay rather than a runtime tool call.",
        reason: descriptor.readiness.reason,
      };
    case "unsupported":
      return {
        summary:
          "No canonical execution host is available yet for this invocation descriptor; treat it as non-executable control-plane metadata.",
        reason: descriptor.readiness.reason,
      };
  }
}

function readToolCallIds(descriptor: InvocationDescriptor): string[] {
  const metadata = asRecord(descriptor.metadata);
  const toolCallIds = readStringArray(metadata, "toolCallIds");
  const singularToolCallId = readString(metadata, "toolCallId");
  return singularToolCallId && !toolCallIds.includes(singularToolCallId)
    ? [...toolCallIds, singularToolCallId]
    : toolCallIds;
}

export function buildInvocationExecutionPlan(
  descriptor: InvocationDescriptor
): InvocationExecutionPlan {
  const binding = inferBinding(descriptor);
  const hostRequirements = buildHostRequirements(binding);
  const preflight = buildPreflight(descriptor);
  return {
    binding,
    hostRequirements,
    hostCapabilityRequirements: hostRequirements.map((requirement) => ({ ...requirement })),
    preflight,
    preflightOutcome: buildPreflightOutcome(descriptor, preflight),
  };
}

export function withInvocationExecutionPlan(
  descriptor: InvocationDescriptor
): InvocationDescriptor {
  return {
    ...descriptor,
    execution: descriptor.execution ?? buildInvocationExecutionPlan(descriptor),
  };
}

export function buildInvocationExecutionEvidence(input: {
  descriptor: InvocationDescriptor;
  caller: InvocationAudience;
  outcome: InvocationExecutionOutcome;
}): InvocationExecutionEvidence {
  const execution = input.descriptor.execution ?? buildInvocationExecutionPlan(input.descriptor);
  return {
    invocationId: input.descriptor.id,
    caller: input.caller,
    source: { ...input.descriptor.source },
    readiness: {
      ...input.descriptor.readiness,
      warnings: [...input.descriptor.readiness.warnings],
    },
    binding: { ...execution.binding },
    hostRequirements: execution.hostRequirements.map((requirement) => ({ ...requirement })),
    hostCapabilityRequirements: execution.hostCapabilityRequirements.map((requirement) => ({
      ...requirement,
    })),
    preflight: { ...execution.preflight },
    preflightOutcome: { ...execution.preflightOutcome },
    invocationProvenance: buildInvocationProvenance(input.descriptor, execution),
    placementRationale: buildPlacementRationale(input.descriptor, execution),
    toolCallIds: readToolCallIds(input.descriptor),
    outcome: { ...input.outcome },
  };
}

export function summarizeInvocationExecutionCatalog(
  descriptors: InvocationDescriptor[]
): ActiveInvocationCatalogExecutionPlane {
  const bindings = new Map<
    string,
    {
      bindingKind: InvocationExecutionBinding["kind"];
      host: InvocationExecutionBinding["host"];
      count: number;
      readyCount: number;
      blockedCount: number;
      notRequiredCount: number;
      requirementKeys: Set<InvocationHostRequirement["key"]>;
    }
  >();
  const requirements = new Map<InvocationHostRequirement["key"], number>();

  for (const descriptor of descriptors) {
    const execution = descriptor.execution ?? buildInvocationExecutionPlan(descriptor);
    const bindingKey = `${execution.binding.kind}:${execution.binding.host}`;
    const existing = bindings.get(bindingKey) ?? {
      bindingKind: execution.binding.kind,
      host: execution.binding.host,
      count: 0,
      readyCount: 0,
      blockedCount: 0,
      notRequiredCount: 0,
      requirementKeys: new Set<InvocationHostRequirement["key"]>(),
    };

    existing.count += 1;
    if (execution.preflight.state === "ready") {
      existing.readyCount += 1;
    } else if (execution.preflight.state === "blocked") {
      existing.blockedCount += 1;
    } else {
      existing.notRequiredCount += 1;
    }

    for (const requirement of execution.hostRequirements) {
      existing.requirementKeys.add(requirement.key);
      requirements.set(requirement.key, (requirements.get(requirement.key) ?? 0) + 1);
    }

    bindings.set(bindingKey, existing);
  }

  return {
    bindings: [...bindings.values()]
      .map((summary) => ({
        bindingKind: summary.bindingKind,
        host: summary.host,
        count: summary.count,
        readyCount: summary.readyCount,
        blockedCount: summary.blockedCount,
        notRequiredCount: summary.notRequiredCount,
        requirementKeys: [...summary.requirementKeys].sort(),
      }))
      .sort((left, right) =>
        `${left.host}:${left.bindingKind}`.localeCompare(`${right.host}:${right.bindingKind}`)
      ),
    requirements: [...requirements.entries()]
      .map(([key, count]) => ({ key, count }))
      .sort((left, right) => left.key.localeCompare(right.key)),
  };
}

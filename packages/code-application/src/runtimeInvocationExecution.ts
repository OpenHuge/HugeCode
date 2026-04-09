import type {
  ActiveInvocationCatalogExecutionPlane,
  InvocationAudience,
  InvocationDescriptor,
  InvocationExecutionBinding,
  InvocationExecutionEvidence,
  InvocationExecutionOutcome,
  InvocationExecutionPlan,
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

export function buildInvocationExecutionPlan(
  descriptor: InvocationDescriptor
): InvocationExecutionPlan {
  const binding = inferBinding(descriptor);
  return {
    binding,
    hostRequirements: buildHostRequirements(binding),
    preflight: buildPreflight(descriptor),
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
    preflight: { ...execution.preflight },
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

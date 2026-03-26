import type { RuntimeToolExecutionScope } from "@ku0/code-runtime-host-contract";

export type RuntimeToolExecutionHookAnnotationCode =
  | "guardrail-required"
  | "guardrail-skipped"
  | "input-extra-fields"
  | "input-schema-warning"
  | "metrics-diagnostics-tool"
  | "output-truncated"
  | "runtime-failed"
  | "runtime-timeout"
  | "validation-failed"
  | "workspace-dry-run";

type RuntimeToolExecutionFailureStatus =
  | "blocked"
  | "runtime_failed"
  | "timeout"
  | "validation_failed";

export type RuntimeToolExecutionPreflightHookContext = {
  toolName: string;
  scope: RuntimeToolExecutionScope;
  workspaceId: string | null;
  isMetricsDiagnosticsTool: boolean;
  isWorkspaceDryRun: boolean;
  guardrailRequired: boolean;
  validationWarnings: string[];
  validationExtraFields: string[];
};

export type RuntimeToolExecutionSuccessHookContext = {
  toolName: string;
  scope: RuntimeToolExecutionScope;
  workspaceId: string | null;
  truncatedOutput: boolean;
  durationMs: number;
};

export type RuntimeToolExecutionFailureHookContext = {
  toolName: string;
  scope: RuntimeToolExecutionScope;
  workspaceId: string | null;
  status: RuntimeToolExecutionFailureStatus;
  errorCode: string | null;
  durationMs: number;
};

type RuntimeToolExecutionHookDecision = {
  annotationCodes?: RuntimeToolExecutionHookAnnotationCode[];
};

export type RuntimeToolExecutionHooks = {
  onPreflight?:
    | ((
        context: RuntimeToolExecutionPreflightHookContext
      ) => RuntimeToolExecutionHookDecision | Promise<RuntimeToolExecutionHookDecision>)
    | undefined;
  onSuccess?:
    | ((
        context: RuntimeToolExecutionSuccessHookContext
      ) => RuntimeToolExecutionHookDecision | Promise<RuntimeToolExecutionHookDecision>)
    | undefined;
  onFailure?:
    | ((
        context: RuntimeToolExecutionFailureHookContext
      ) => RuntimeToolExecutionHookDecision | Promise<RuntimeToolExecutionHookDecision>)
    | undefined;
};

function dedupeAnnotationCodes(
  values: RuntimeToolExecutionHookAnnotationCode[]
): RuntimeToolExecutionHookAnnotationCode[] {
  const deduped: RuntimeToolExecutionHookAnnotationCode[] = [];
  const seen = new Set<RuntimeToolExecutionHookAnnotationCode>();
  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }
    seen.add(value);
    deduped.push(value);
  }
  return deduped;
}

async function collectAnnotationCodes(
  hooks: RuntimeToolExecutionHooks[],
  run: (
    hook: RuntimeToolExecutionHooks
  ) => RuntimeToolExecutionHookDecision | Promise<RuntimeToolExecutionHookDecision> | undefined
): Promise<RuntimeToolExecutionHookAnnotationCode[]> {
  const annotationCodes: RuntimeToolExecutionHookAnnotationCode[] = [];
  for (const hook of hooks) {
    const decision = await run(hook);
    if (!decision?.annotationCodes || decision.annotationCodes.length === 0) {
      continue;
    }
    annotationCodes.push(...decision.annotationCodes);
  }
  return dedupeAnnotationCodes(annotationCodes);
}

export async function runRuntimeToolExecutionPreflightHooks(
  hooks: RuntimeToolExecutionHooks[],
  context: RuntimeToolExecutionPreflightHookContext
): Promise<RuntimeToolExecutionHookAnnotationCode[]> {
  return collectAnnotationCodes(hooks, (hook) => hook.onPreflight?.(context));
}

export async function runRuntimeToolExecutionSuccessHooks(
  hooks: RuntimeToolExecutionHooks[],
  context: RuntimeToolExecutionSuccessHookContext
): Promise<RuntimeToolExecutionHookAnnotationCode[]> {
  return collectAnnotationCodes(hooks, (hook) => hook.onSuccess?.(context));
}

export async function runRuntimeToolExecutionFailureHooks(
  hooks: RuntimeToolExecutionHooks[],
  context: RuntimeToolExecutionFailureHookContext
): Promise<RuntimeToolExecutionHookAnnotationCode[]> {
  return collectAnnotationCodes(hooks, (hook) => hook.onFailure?.(context));
}

export function mergeRuntimeToolExecutionAnnotationCodes(
  ...groups: ReadonlyArray<ReadonlyArray<RuntimeToolExecutionHookAnnotationCode>>
): RuntimeToolExecutionHookAnnotationCode[] {
  return dedupeAnnotationCodes(groups.flat());
}

export function createDefaultRuntimeToolExecutionHooks(): RuntimeToolExecutionHooks {
  return {
    onPreflight(context) {
      const annotationCodes: RuntimeToolExecutionHookAnnotationCode[] = [];
      if (context.isMetricsDiagnosticsTool) {
        annotationCodes.push("metrics-diagnostics-tool");
      }
      if (context.isWorkspaceDryRun) {
        annotationCodes.push("workspace-dry-run");
      }
      annotationCodes.push(context.guardrailRequired ? "guardrail-required" : "guardrail-skipped");
      if (context.validationWarnings.length > 0) {
        annotationCodes.push("input-schema-warning");
      }
      if (context.validationExtraFields.length > 0) {
        annotationCodes.push("input-extra-fields");
      }
      return { annotationCodes };
    },
    onSuccess(context) {
      return {
        annotationCodes: context.truncatedOutput ? ["output-truncated"] : [],
      };
    },
    onFailure(context) {
      if (context.status === "validation_failed") {
        return { annotationCodes: ["validation-failed"] };
      }
      if (context.status === "timeout") {
        return { annotationCodes: ["runtime-timeout"] };
      }
      if (context.status === "runtime_failed") {
        return { annotationCodes: ["runtime-failed"] };
      }
      return { annotationCodes: [] };
    },
  };
}

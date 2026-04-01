import { describe, expect, it } from "vitest";
import type { WorkspaceDiagnostic } from "@ku0/code-runtime-host-contract";
import type { AgentIntentState } from "../types/webMcpBridge";
import {
  buildActiveIntentContext,
  buildPersistentFlowIndicator,
} from "./runtimePersistentFlowState";

const baseIntent: AgentIntentState = {
  objective: "Persist continuity intent across restart",
  constraints: "Do not bypass runtime boundaries",
  successCriteria: "Workspace restarts with intent and unresolved errors intact",
  deadline: null,
  priority: "high",
  managerNotes: "Prefer host-backed state over local cache",
};

function buildDiagnostic(overrides: Partial<WorkspaceDiagnostic> = {}): WorkspaceDiagnostic {
  return {
    path: "apps/code/src/application/runtime/facades/runtimeContinuityReadiness.ts",
    severity: "error",
    message: "Type mismatch in continuity projection",
    source: "tsc",
    code: "TS2322",
    startLine: 12,
    startColumn: 3,
    endLine: 12,
    endColumn: 18,
    ...overrides,
  };
}

describe("runtimePersistentFlowState", () => {
  it("builds a bounded persistent context from intent, recent files, and unresolved diagnostics", () => {
    const context = buildActiveIntentContext({
      intent: baseIntent,
      runs: [
        {
          id: "run-1",
          title: "Persist flow state",
          updatedAt: 30,
          changedPaths: [
            "apps/code/src/application/runtime/facades/runtimeContinuityReadiness.ts",
            "packages/code-platform-interfaces/src/index.ts",
          ],
          validations: [
            {
              id: "validation-1",
              label: "TypeScript",
              outcome: "failed",
              summary: "TypeScript failed after adding persistent flow state fields.",
            },
          ],
          reviewPackId: "review-pack-1",
        },
      ],
      diagnostics: {
        generatedAtMs: 45,
        items: [
          buildDiagnostic(),
          buildDiagnostic({
            source: "oxlint",
            severity: "warning",
            code: "unused_import",
            message: "Unused import.",
            path: "apps/code/src/types.ts",
          }),
          buildDiagnostic({
            source: "native",
            severity: "hint",
            message: "Ignored hint.",
          }),
        ],
      },
    });

    expect(context.intent).toEqual(baseIntent);
    expect(context.focusedFiles).toEqual([
      {
        path: "apps/code/src/application/runtime/facades/runtimeContinuityReadiness.ts",
        reason: "recent_change",
      },
      {
        path: "packages/code-platform-interfaces/src/index.ts",
        reason: "recent_change",
      },
      {
        path: "apps/code/src/types.ts",
        reason: "diagnostic",
      },
    ]);
    expect(context.unresolvedErrors).toEqual([
      {
        source: "tsc",
        severity: "error",
        message: "Type mismatch in continuity projection",
        path: "apps/code/src/application/runtime/facades/runtimeContinuityReadiness.ts",
        code: "TS2322",
        startLine: 12,
        startColumn: 3,
        endLine: 12,
        endColumn: 18,
      },
      {
        source: "oxlint",
        severity: "warning",
        message: "Unused import.",
        path: "apps/code/src/types.ts",
        code: "unused_import",
        startLine: 12,
        startColumn: 3,
        endLine: 12,
        endColumn: 18,
      },
    ]);
    expect(context.history).toEqual({
      latestRunId: "run-1",
      latestRunTitle: "Persist flow state",
      latestReviewPackId: "review-pack-1",
      lastUpdatedAt: 45,
      recentChangedPaths: [
        "apps/code/src/application/runtime/facades/runtimeContinuityReadiness.ts",
        "packages/code-platform-interfaces/src/index.ts",
      ],
      validationSummaries: ["TypeScript failed after adding persistent flow state fields."],
    });
  });

  it("surfaces a recovered indicator when host-backed context rehydrates after restart", () => {
    const indicator = buildPersistentFlowIndicator({
      source: "host",
      context: buildActiveIntentContext({
        intent: baseIntent,
        runs: [
          {
            id: "run-1",
            title: "Persist flow state",
            updatedAt: 30,
            changedPaths: [
              "apps/code/src/application/runtime/facades/runtimeContinuityReadiness.ts",
            ],
            validations: [],
            reviewPackId: null,
          },
        ],
        diagnostics: {
          generatedAtMs: 30,
          items: [],
        },
      }),
      loadState: "ready",
      saveError: null,
    });

    expect(indicator.tone).toBe("success");
    expect(indicator.label).toBe("Recovered flow state");
    expect(indicator.detail).toContain("host-backed");
  });

  it("keeps the last persisted run history when refreshed startup evidence has not arrived yet", () => {
    const priorContext = buildActiveIntentContext({
      intent: baseIntent,
      runs: [
        {
          id: "run-1",
          title: "Persist flow state",
          updatedAt: 30,
          changedPaths: ["packages/code-platform-interfaces/src/index.ts"],
          validations: [
            {
              id: "validation-1",
              label: "TypeScript",
              outcome: "failed",
              summary: "TypeScript failed after adding persistent flow state fields.",
            },
          ],
          reviewPackId: "review-pack-1",
        },
      ],
      diagnostics: {
        generatedAtMs: 30,
        items: [buildDiagnostic()],
      },
    });

    const refreshed = buildActiveIntentContext({
      intent: {
        ...baseIntent,
        objective: "Hydrated objective",
      },
      runs: [],
      diagnostics: {
        generatedAtMs: null,
        items: [],
      },
    });

    expect(refreshed.history.latestRunId).toBeNull();
    expect(refreshed.history.recentChangedPaths).toEqual([]);
    expect(priorContext.history.latestRunId).toBe("run-1");
  });
});

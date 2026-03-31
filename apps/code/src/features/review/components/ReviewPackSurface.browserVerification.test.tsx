// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RuntimeBrowserReadinessSummary } from "../../../application/runtime/ports/browserCapability";
import {
  __resetRuntimeBrowserVerificationEvidenceForTests,
  recordRuntimeBrowserVerificationResult,
} from "../../../application/runtime/facades/runtimeBrowserVerificationEvidence";
import { ReviewPackSurface } from "./ReviewPackSurface";

vi.mock("../../shared/productAnalytics", () => ({
  trackProductAnalyticsEvent: vi.fn(async () => undefined),
}));

const { readBrowserReadinessMock } = vi.hoisted(() => ({
  readBrowserReadinessMock: vi.fn(),
}));

vi.mock("../../../application/runtime/ports/browserCapability", async () => {
  const actual = await vi.importActual<
    typeof import("../../../application/runtime/ports/browserCapability")
  >("../../../application/runtime/ports/browserCapability");
  return {
    ...actual,
    readBrowserReadiness: readBrowserReadinessMock,
    extractBrowserContent: vi.fn(async () => null),
    getLastBrowserExtractionResult: vi.fn(async () => null),
  };
});

function buildReadiness(
  overrides: Partial<RuntimeBrowserReadinessSummary> = {}
): RuntimeBrowserReadinessSummary {
  return {
    state: "ready",
    headline: "Browser readiness confirmed",
    detail: "Desktop host bridge publishes the browser extraction contract.",
    recommendedAction: "Use the desktop-host browser extraction contract.",
    runtimeHost: "electron",
    source: "desktop_host_bridge",
    sourceLabel: "Desktop host bridge",
    assessmentAvailable: false,
    assessmentHistoryAvailable: false,
    extractionAvailable: true,
    historyAvailable: true,
    localOnly: false,
    lastAssessmentResult: null,
    lastResult: null,
    capabilities: {
      browserAssessment: false,
      browserAssessmentHistory: false,
      browserDebug: true,
      browserExtraction: true,
      browserExtractionHistory: true,
      webMcp: false,
    },
    ...overrides,
  };
}

describe("ReviewPackSurface browser verification", () => {
  beforeEach(() => {
    __resetRuntimeBrowserVerificationEvidenceForTests();
    readBrowserReadinessMock.mockReset();
    readBrowserReadinessMock.mockReturnValue(buildReadiness());
  });

  it("lets the review surface attach pending browser evidence and fold it into artifacts and decision guidance", async () => {
    recordRuntimeBrowserVerificationResult({
      workspaceId: "workspace-1",
      readiness: buildReadiness(),
      source: "extract",
      input: {
        sourceUrl: "https://example.com/review",
        selector: "main article",
      },
      result: {
        status: "succeeded",
        normalizedText: "Browser verification captured the published UI state.",
        snippet: "Browser verification captured the published UI state.",
        sourceUrl: "https://example.com/review",
        title: "Review page",
        errorCode: null,
        errorMessage: null,
        traceId: "browser-trace-1",
        trace: [
          {
            stage: "availability",
            at: "2026-03-31T00:00:00.000Z",
            message: "Resolved a local Chrome DevTools endpoint for browser extraction.",
          },
          {
            stage: "capture",
            at: "2026-03-31T00:00:01.000Z",
            message: "Captured normalized browser text.",
          },
        ],
      },
    });

    render(
      <ReviewPackSurface
        workspaceName="Workspace One"
        items={[]}
        selection={{
          request: {
            workspaceId: "workspace-1",
            reviewPackId: "review-pack-1",
            source: "review_surface",
          },
          status: "selected",
          source: "runtime_snapshot_v1",
          selectedWorkspaceId: "workspace-1",
          selectedTaskId: "task-1",
          selectedRunId: "run-1",
          selectedReviewPackId: "review-pack-1",
          fallbackReason: null,
        }}
        detail={{
          kind: "review_pack",
          id: "review-pack-1",
          workspaceId: "workspace-1",
          workspaceName: "Workspace One",
          taskId: "task-1",
          taskTitle: "Browser verification review",
          runId: "run-1",
          runTitle: "Browser verification review",
          summary: "Inspect browser-grounded evidence before accepting this run.",
          createdAt: Date.now() - 30_000,
          reviewStatus: "ready",
          reviewStatusLabel: "Ready",
          evidenceState: "confirmed",
          evidenceLabel: "Confirmed evidence",
          validationOutcome: "passed",
          validationLabel: "Passed",
          warningCount: 0,
          nextActionLabel: "Open review",
          nextActionDetail: "Review the available evidence before accepting.",
          warnings: [],
          validations: [],
          artifacts: [],
          checksPerformed: [],
          recommendedNextAction: "Review the available evidence before accepting.",
          navigationTarget: {
            kind: "review",
            workspaceId: "workspace-1",
            taskId: "task-1",
            runId: "run-1",
            reviewPackId: "review-pack-1",
            limitation: null,
          },
          secondaryLabel: null,
          source: "runtime_snapshot_v1",
          sourceLabel: "Runtime snapshot",
          failureClass: null,
          failureClassLabel: null,
          failureClassSummary: null,
          publishHandoff: null,
          continuity: null,
          assumptions: [],
          reproductionGuidance: [],
          rollbackGuidance: [],
          reviewDecision: {
            status: "pending",
            reviewPackId: "review-pack-1",
            label: "Decision pending",
            summary: "Accept or reject this result from the review surface.",
            decidedAt: null,
          },
          reviewIntelligence: null,
          reviewProfileId: null,
          reviewGate: null,
          reviewFindings: [],
          reviewRunId: null,
          skillUsage: [],
          autofixCandidate: null,
          provenanceSummary: null,
          backendAudit: {
            summary: "Runtime backend audit unavailable.",
            details: [],
            missingReason: "No route evidence was published.",
          },
          decisionActionability: {
            summary: "Runtime review decision actions use fixture defaults in this test.",
            details: ["Decision source: test fixture defaults."],
            sourceLabel: "Test fixture defaults",
            usesFallback: true,
          },
          decisionActions: [],
          governance: undefined,
          operatorSnapshot: undefined,
          placement: undefined,
          workspaceEvidence: undefined,
          sourceProvenance: undefined,
          lineage: undefined,
          ledger: undefined,
          checkpoint: undefined,
          executionContext: undefined,
          missionBrief: undefined,
          relaunchContext: undefined,
          compactEvidenceInput: null,
          limitations: [],
          relaunchOptions: [],
          subAgentSummary: [],
          emptySectionLabels: {
            assumptions: "No assumptions recorded.",
            warnings: "No warnings recorded.",
            validations: "No validations recorded.",
            artifacts: "No artifacts recorded.",
            reproduction: "No reproduction guidance recorded.",
            rollback: "No rollback guidance recorded.",
          },
        }}
        onSelectReviewPack={() => undefined}
      />
    );

    expect(screen.getByText("Browser verification")).toBeTruthy();
    expect(screen.getByText("Browser extraction completed.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Attach browser evidence" }));

    await waitFor(() => {
      expect(screen.getAllByText("Browser verification | evidence").length).toBeGreaterThan(0);
    });

    expect(screen.getByText(/Browser verification evidence attached/i)).toBeTruthy();
    expect(screen.getByText("Review page")).toBeTruthy();
    expect(screen.getByText("https://example.com/review")).toBeTruthy();
  });

  it("does not surface pending browser evidence from a different review pack in the same workspace", () => {
    recordRuntimeBrowserVerificationResult({
      workspaceId: "workspace-1",
      readiness: buildReadiness(),
      source: "extract",
      intendedScope: {
        workspaceId: "workspace-1",
        taskId: "task-1",
        runId: "run-1",
        reviewPackId: "review-pack-1",
      },
      result: {
        status: "succeeded",
        normalizedText: "Browser verification captured the published UI state.",
        snippet: "Browser verification captured the published UI state.",
        sourceUrl: "https://example.com/review",
        title: "Review page",
        errorCode: null,
        errorMessage: null,
        traceId: "browser-trace-1",
        trace: [],
      },
    });

    render(
      <ReviewPackSurface
        workspaceName="Workspace One"
        items={[]}
        selection={{
          request: {
            workspaceId: "workspace-1",
            reviewPackId: "review-pack-2",
            source: "review_surface",
          },
          status: "selected",
          source: "runtime_snapshot_v1",
          selectedWorkspaceId: "workspace-1",
          selectedTaskId: "task-2",
          selectedRunId: "run-2",
          selectedReviewPackId: "review-pack-2",
          fallbackReason: null,
        }}
        detail={{
          kind: "review_pack",
          id: "review-pack-2",
          workspaceId: "workspace-1",
          workspaceName: "Workspace One",
          taskId: "task-2",
          taskTitle: "Other review pack",
          runId: "run-2",
          runTitle: "Other review pack",
          summary: "Different review pack in the same workspace.",
          createdAt: Date.now() - 30_000,
          reviewStatus: "ready",
          reviewStatusLabel: "Ready",
          evidenceState: "confirmed",
          evidenceLabel: "Confirmed evidence",
          validationOutcome: "passed",
          validationLabel: "Passed",
          warningCount: 0,
          nextActionLabel: "Open review",
          nextActionDetail: "Review the available evidence before accepting.",
          warnings: [],
          validations: [],
          artifacts: [],
          checksPerformed: [],
          recommendedNextAction: "Review the available evidence before accepting.",
          navigationTarget: {
            kind: "review",
            workspaceId: "workspace-1",
            taskId: "task-2",
            runId: "run-2",
            reviewPackId: "review-pack-2",
            limitation: null,
          },
          secondaryLabel: null,
          source: "runtime_snapshot_v1",
          sourceLabel: "Runtime snapshot",
          failureClass: null,
          failureClassLabel: null,
          failureClassSummary: null,
          publishHandoff: null,
          continuity: null,
          assumptions: [],
          reproductionGuidance: [],
          rollbackGuidance: [],
          reviewDecision: {
            status: "pending",
            reviewPackId: "review-pack-2",
            label: "Decision pending",
            summary: "Accept or reject this result from the review surface.",
            decidedAt: null,
          },
          reviewIntelligence: null,
          reviewProfileId: null,
          reviewGate: null,
          reviewFindings: [],
          reviewRunId: null,
          skillUsage: [],
          autofixCandidate: null,
          provenanceSummary: null,
          backendAudit: {
            summary: "Runtime backend audit unavailable.",
            details: [],
            missingReason: "No route evidence was published.",
          },
          decisionActionability: {
            summary: "Runtime review decision actions use fixture defaults in this test.",
            details: ["Decision source: test fixture defaults."],
            sourceLabel: "Test fixture defaults",
            usesFallback: true,
          },
          decisionActions: [],
          governance: undefined,
          operatorSnapshot: undefined,
          placement: undefined,
          workspaceEvidence: undefined,
          sourceProvenance: undefined,
          lineage: undefined,
          ledger: undefined,
          checkpoint: undefined,
          executionContext: undefined,
          missionBrief: undefined,
          relaunchContext: undefined,
          compactEvidenceInput: null,
          limitations: [],
          relaunchOptions: [],
          subAgentSummary: [],
          emptySectionLabels: {
            assumptions: "No assumptions recorded.",
            warnings: "No warnings recorded.",
            validations: "No validations recorded.",
            artifacts: "No artifacts recorded.",
            reproduction: "No reproduction guidance recorded.",
            rollback: "No rollback guidance recorded.",
          },
        }}
        onSelectReviewPack={() => undefined}
      />
    );

    expect(screen.queryByRole("button", { name: "Attach browser evidence" })).toBeNull();
    expect(
      screen.getByText("No browser verification evidence is attached to this review pack yet.")
    ).toBeTruthy();
  });
});
